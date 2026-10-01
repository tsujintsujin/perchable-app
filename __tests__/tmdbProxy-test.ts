import {
  handlePopular,
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
