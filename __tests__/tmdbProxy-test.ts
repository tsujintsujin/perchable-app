import {
  CAST_LIMIT,
  handleDetails,
  handlePopular,
  handleTmdb,
  parseMovieId,
  parsePage,
  TMDB_ATTRIBUTION,
  type UpstreamResponse,
} from "../supabase/functions/_shared/tmdb";

const KEY = "secret-key-123";

// Builds a stub upstream response with a JSON body.
const upstream = (status: number, body: unknown): UpstreamResponse => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

// Runs the handler with a stubbed TMDB and returns the result plus recorded calls.
async function run(opts: {
  endpoint?: string | null;
  page?: string | null;
  apiKey?: string | undefined;
  res?: UpstreamResponse;
  throws?: Error;
}) {
  const logs: string[] = [];
  const urls: string[] = [];
  const result = await handlePopular({
    endpoint: opts.endpoint === undefined ? "popular" : opts.endpoint,
    page: opts.page === undefined ? null : opts.page,
    apiKey: "apiKey" in opts ? opts.apiKey : KEY,
    fetchUpstream: async (url) => {
      urls.push(url);
      if (opts.throws) throw opts.throws;
      return opts.res ?? upstream(200, { results: [], page: 1, total_pages: 1 });
    },
    logError: (m) => logs.push(m),
  });
  return { result, logs, urls };
}

describe("parsePage", () => {
  it.each([
    ["abc"], ["-1"], ["0"], ["501"], ["1.5"], ["1e2"], ["0x10"], [" 5"], [""], ["99999999999999999999"],
  ])("rejects %p", (raw) => {
    expect(parsePage(raw)).toBeNull();
  });

  it("accepts digits in range and defaults an absent page to 1", () => {
    expect(parsePage(null)).toBe(1);
    expect(parsePage("1")).toBe(1);
    expect(parsePage("500")).toBe(500);
    expect(parsePage("050")).toBe(50);
  });
});

describe("handlePopular", () => {
  it("rejects an endpoint outside the whitelist with 400 and never calls TMDB", async () => {
    const { result, urls } = await run({ endpoint: "foo" });
    expect(result.status).toBe(400);
    expect(urls).toHaveLength(0);
    expect((await run({ endpoint: null })).result.status).toBe(400);
  });

  it("rejects a bad page with 400 and never calls TMDB", async () => {
    const { result, urls } = await run({ page: "1e2" });
    expect(result).toMatchObject({ status: 400, body: { code: "invalid_page" } });
    expect(urls).toHaveLength(0);
  });

  it("answers 500 misconfigured without naming the key when it is missing", async () => {
    const { result, urls } = await run({ apiKey: undefined });
    expect(result).toMatchObject({ status: 500, body: { code: "misconfigured" } });
    expect(JSON.stringify(result.body)).not.toMatch(/TMDB_API_KEY|api_key/i);
    expect(urls).toHaveLength(0);
  });

  it("returns 200 with attribution, Cache-Control and the page requested", async () => {
    const { result, urls } = await run({ page: "3", res: upstream(200, { results: [], page: 3, total_pages: 9 }) });
    expect(urls[0]).toContain("page=3");
    expect(result.status).toBe(200);
    expect(result.cacheControl).toBe("public, max-age=300");
    expect(result.body).toEqual({ results: [], page: 3, total_pages: 9, attribution: TMDB_ATTRIBUTION });
  });

  it("drops adult titles, trims fields and can return fewer than 20 or none", async () => {
    const movie = (id: number, adult: boolean) => ({
      id, title: `T${id}`, poster_path: null, vote_average: 5, release_date: "2020-01-01", adult, genre_ids: [1],
    });
    const some = await run({ res: upstream(200, { results: [movie(1, false), movie(2, true)], page: 1, total_pages: 5 }) });
    expect((some.result.body as { results: unknown[] }).results).toEqual([
      { id: 1, title: "T1", poster_path: null, vote_average: 5, release_date: "2020-01-01" },
    ]);
    const none = await run({ res: upstream(200, { results: [movie(3, true)], page: 1, total_pages: 5 }) });
    expect((none.result.body as { results: unknown[] }).results).toEqual([]);
  });

  it("ignores non-object items in results instead of throwing", async () => {
    const { result } = await run({
      res: upstream(200, { results: [null, 5, "x", { id: 1, title: "A", adult: false }], page: 1, total_pages: 1 }),
    });
    expect(result.status).toBe(200);
    expect((result.body as { results: { id: number }[] }).results.map((m) => m.id)).toEqual([1]);
  });

  it.each([
    [401, 502, "upstream_auth"],
    [403, 502, "upstream_auth"],
    [404, 404, "not_found"],
    [429, 429, "rate_limited"],
    [500, 502, "upstream_error"],
    [503, 502, "upstream_error"],
    [422, 502, "upstream_error"],
  ])("maps TMDB %i to %i %s with a fixed body", async (tmdb, status, code) => {
    const { result } = await run({ res: upstream(tmdb, { status_message: `leak ${KEY}` }) });
    expect(result.status).toBe(status);
    expect(result.body).toMatchObject({ code });
    expect(result.cacheControl).toBeUndefined();
    expect(JSON.stringify(result.body)).not.toContain(KEY);
    expect(JSON.stringify(result.body)).not.toContain("leak");
  });

  it("maps a 200 with an unusable body to 502 upstream_error", async () => {
    const bad = await run({ res: upstream(200, { nope: true }) });
    expect(bad.result).toMatchObject({ status: 502, body: { code: "upstream_error" } });
    const unparsable = await run({
      res: { ok: true, status: 200, json: async () => { throw new Error("bad json"); } },
    });
    expect(unparsable.result.status).toBe(502);
  });

  it("maps a network failure to 502 upstream_network and logs it with the key redacted", async () => {
    const { result, logs } = await run({
      throws: new Error(`error sending request for url (https://x/?api_key=${KEY}&page=1)`),
    });
    expect(result).toMatchObject({ status: 502, body: { code: "upstream_network" } });
    expect(JSON.stringify(result.body)).not.toContain(KEY);
    expect(logs).toHaveLength(1);
    expect(logs[0]).not.toContain(KEY);
    expect(logs[0]).toContain("api_key=***");
  });
});

// A TMDB movie-with-credits body carrying extra fields the proxy must drop.
const tmdbMovie = (
  over: Record<string, unknown> = {},
  cast: unknown[] = [{ id: 1, name: "A", character: "B", profile_path: "/p.jpg", order: 0 }],
) => ({
  id: 603,
  title: "The Matrix",
  tagline: "Welcome",
  overview: "A hacker...",
  poster_path: "/p.jpg",
  backdrop_path: "/b.jpg",
  release_date: "1999-03-30",
  runtime: 136,
  vote_average: 8.2,
  vote_count: 100,
  adult: false,
  budget: 63000000,
  genres: [{ id: 28, name: "Action" }],
  credits: { cast, crew: [{ id: 9 }] },
  ...over,
});

// Runs the details handler with a stubbed TMDB and returns the result plus recorded calls.
async function runDetails(opts: {
  id?: string | null;
  endpoint?: string | null;
  apiKey?: string | undefined;
  res?: UpstreamResponse;
  throws?: Error;
}) {
  const logs: string[] = [];
  const urls: string[] = [];
  const result = await handleDetails({
    endpoint: opts.endpoint === undefined ? "details" : opts.endpoint,
    page: null,
    id: opts.id === undefined ? "603" : opts.id,
    apiKey: "apiKey" in opts ? opts.apiKey : KEY,
    fetchUpstream: async (url) => {
      urls.push(url);
      if (opts.throws) throw opts.throws;
      return opts.res ?? upstream(200, tmdbMovie());
    },
    logError: (m) => logs.push(m),
  });
  return { result, logs, urls };
}

describe("parseMovieId", () => {
  it.each([
    [null], [""], ["abc"], ["0"], ["-1"], ["1.5"], ["1e3"], ["0x10"], [" 5"], ["5 "], ["2147483648"], ["99999999999"],
  ])("rejects %p", (raw) => {
    expect(parseMovieId(raw)).toBeNull();
  });

  it("accepts digits in 1..2147483647", () => {
    expect(parseMovieId("1")).toBe(1);
    expect(parseMovieId("603")).toBe(603);
    expect(parseMovieId("2147483647")).toBe(2147483647);
  });
});

describe("handleDetails", () => {
  it.each([["abc"], ["0"], ["1e3"], [" 5"], ["2147483648"], [null]])(
    "rejects id %p with 400 invalid_id and never calls TMDB",
    async (id) => {
      const { result, urls } = await runDetails({ id });
      expect(result).toMatchObject({ status: 400, body: { code: "invalid_id" } });
      expect(urls).toHaveLength(0);
    },
  );

  it("rejects another endpoint with 400", async () => {
    const { result, urls } = await runDetails({ endpoint: "popular" });
    expect(result).toMatchObject({ status: 400, body: { code: "invalid_endpoint" } });
    expect(urls).toHaveLength(0);
  });

  it("answers 500 misconfigured without naming the key when it is missing", async () => {
    const { result, urls } = await runDetails({ apiKey: undefined });
    expect(result).toMatchObject({ status: 500, body: { code: "misconfigured" } });
    expect(JSON.stringify(result.body)).not.toMatch(/TMDB_API_KEY|api_key/i);
    expect(urls).toHaveLength(0);
  });

  it("asks TMDB for the movie with credits in one call and returns only the trimmed fields", async () => {
    const { result, urls } = await runDetails({});
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("/movie/603?");
    expect(urls[0]).toContain("append_to_response=credits");
    expect(result.status).toBe(200);
    expect(result.cacheControl).toBe("public, max-age=300");
    expect(result.body).toEqual({
      movie: {
        id: 603,
        title: "The Matrix",
        tagline: "Welcome",
        overview: "A hacker...",
        poster_path: "/p.jpg",
        backdrop_path: "/b.jpg",
        release_date: "1999-03-30",
        runtime: 136,
        vote_average: 8.2,
        vote_count: 100,
        genres: [{ id: 28, name: "Action" }],
        cast: [{ id: 1, name: "A", character: "B", profile_path: "/p.jpg" }],
      },
      attribution: TMDB_ATTRIBUTION,
    });
    expect(JSON.stringify(result.body)).not.toMatch(/budget|crew|adult|order/);
  });

  it("keeps only the first 15 cast members, in TMDB's order", async () => {
    const cast = Array.from({ length: 40 }, (_, i) => ({ id: i, name: `N${i}`, character: "C", profile_path: null }));
    const { result } = await runDetails({ res: upstream(200, tmdbMovie({}, cast)) });
    const got = (result.body as { movie: { cast: { id: number }[] } }).movie.cast;
    expect(got).toHaveLength(CAST_LIMIT);
    expect(got.map((c) => c.id)).toEqual(Array.from({ length: CAST_LIMIT }, (_, i) => i));
  });

  it("returns empty cast and genres when credits or genres are missing or malformed", async () => {
    const { result } = await runDetails({
      res: upstream(200, { id: 5, title: "X", genres: "nope", credits: { cast: [null, 7] } }),
    });
    expect(result.status).toBe(200);
    expect((result.body as { movie: unknown }).movie).toMatchObject({ id: 5, title: "X", genres: [], cast: [] });
    const none = await runDetails({ res: upstream(200, { id: 5, title: "X" }) });
    expect((none.result.body as { movie: { cast: unknown[] } }).movie.cast).toEqual([]);
  });

  it("answers an adult title with 404 not_found and no movie data", async () => {
    const { result } = await runDetails({ res: upstream(200, tmdbMovie({ adult: true })) });
    expect(result).toMatchObject({ status: 404, body: { code: "not_found" } });
    expect(JSON.stringify(result.body)).not.toContain("Matrix");
    expect(result.cacheControl).toBeUndefined();
  });

  it.each([
    [401, 502, "upstream_auth"],
    [403, 502, "upstream_auth"],
    [404, 404, "not_found"],
    [429, 429, "rate_limited"],
    [500, 502, "upstream_error"],
  ])("maps TMDB %i to %i %s with a fixed body", async (tmdb, status, code) => {
    const { result } = await runDetails({ res: upstream(tmdb, { status_message: `leak ${KEY}` }) });
    expect(result.status).toBe(status);
    expect(result.body).toMatchObject({ code });
    expect(JSON.stringify(result.body)).not.toContain(KEY);
    expect(JSON.stringify(result.body)).not.toContain("leak");
  });

  it("maps a 200 without a numeric id and string title to 502 upstream_error", async () => {
    expect((await runDetails({ res: upstream(200, { nope: true }) })).result).toMatchObject({
      status: 502,
      body: { code: "upstream_error" },
    });
    expect((await runDetails({ res: upstream(200, { id: "1", title: "X" }) })).result.status).toBe(502);
    const unparsable = await runDetails({
      res: { ok: true, status: 200, json: async () => { throw new Error("bad json"); } },
    });
    expect(unparsable.result.status).toBe(502);
  });

  it("maps a network failure to 502 upstream_network and logs it with the key redacted", async () => {
    const { result, logs } = await runDetails({ throws: new Error(`failed (https://x/?api_key=${KEY})`) });
    expect(result).toMatchObject({ status: 502, body: { code: "upstream_network" } });
    expect(JSON.stringify(result.body)).not.toContain(KEY);
    expect(logs).toHaveLength(1);
    expect(logs[0]).not.toContain(KEY);
  });
});

describe("handleTmdb", () => {
  // Routes by endpoint without touching TMDB for an unknown one.
  it("routes details and popular, and answers 400 for anything else", async () => {
    const deps = { page: null, id: "603", apiKey: KEY, logError: () => {} };
    const urls: string[] = [];
    const fetchUpstream = async (url: string) => {
      urls.push(url);
      return upstream(200, url.includes("/movie/603") ? tmdbMovie() : { results: [], page: 1, total_pages: 1 });
    };
    expect((await handleTmdb({ ...deps, endpoint: "details", fetchUpstream })).body).toHaveProperty("movie");
    expect((await handleTmdb({ ...deps, endpoint: "popular", fetchUpstream })).body).toHaveProperty("results");
    const before = urls.length;
    expect((await handleTmdb({ ...deps, endpoint: "search", fetchUpstream })).status).toBe(400);
    expect((await handleTmdb({ ...deps, endpoint: null, fetchUpstream })).status).toBe(400);
    expect(urls).toHaveLength(before);
  });
});
