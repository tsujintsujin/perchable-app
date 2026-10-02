import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";

const mockInvoke = jest.fn();
jest.mock("@/lib/supabase", () => ({ supabase: { auth: { getSession: () => Promise.resolve({}) }, functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } } }));
const mockCapture = jest.fn();
jest.mock("@/lib/sentry", () => ({ Sentry: { captureException: (...args: unknown[]) => mockCapture(...args) } }));

import { createQueryClient, queryClient } from "@/lib/queryClient";
import { getMovieDetails, parseMovieIdParam } from "@/modules/movies/api/getMovieDetails";
import { MovieApiError } from "@/modules/movies/api/MovieApiError";
import { parseDetails } from "@/modules/movies/api/parseDetails";
import { formatRating, formatRuntime, metaLine } from "@/modules/movies/format";

const BODY = {
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
    cast: [{ id: 1, name: "Keanu", character: "Neo", profile_path: "/k.jpg" }],
  },
  attribution: "attr",
};

const httpError = (status: number, code?: string) =>
  new FunctionsHttpError({ status, json: async () => (code ? { error: "x", code } : { error: "x" }) });

beforeEach(() => {
  mockInvoke.mockReset();
  mockCapture.mockReset();
});

describe("parseMovieIdParam", () => {
  it.each([[undefined], [""], ["abc"], ["0"], ["-1"], ["1.5"], ["1e3"], [" 5"], ["5 "], ["0x10"], ["2147483648"]])(
    "rejects %p",
    (raw) => {
      expect(parseMovieIdParam(raw)).toBeNull();
    },
  );

  it("accepts digits in 1..2147483647", () => {
    expect(parseMovieIdParam("603")).toBe(603);
    expect(parseMovieIdParam("2147483647")).toBe(2147483647);
  });
});

describe("parseDetails", () => {
  it("returns the typed movie, with absent optional fields as null", () => {
    expect(parseDetails(BODY).movie).toEqual(BODY.movie);
    const sparse = parseDetails({ movie: { id: 1, title: "X", cast: [], genres: [], runtime: "n/a", vote_average: NaN } });
    expect(sparse.movie).toMatchObject({
      tagline: null, overview: null, poster_path: null, backdrop_path: null, release_date: null,
      runtime: null, vote_average: null, vote_count: null, genres: [], cast: [],
    });
  });

  it("drops cast and genre entries that have no id or name instead of failing", () => {
    const parsed = parseDetails({
      movie: { ...BODY.movie, cast: [null, { id: 2 }, { id: 3, name: "Ok" }], genres: [{ id: 1 }, { id: 2, name: "Drama" }] },
    });
    expect(parsed.movie.cast).toEqual([{ id: 3, name: "Ok", character: null, profile_path: null }]);
    expect(parsed.movie.genres).toEqual([{ id: 2, name: "Drama" }]);
  });

  it.each([
    ["null", null],
    ["no movie", {}],
    ["array movie", { movie: [] }],
    ["string id", { movie: { id: "1", title: "X", cast: [], genres: [] } }],
    ["no title", { movie: { id: 1, cast: [], genres: [] } }],
    ["cast not an array", { movie: { id: 1, title: "X", cast: "no", genres: [] } }],
    ["genres missing", { movie: { id: 1, title: "X", cast: [] } }],
  ])("rejects a bad body (%s) as a shape error", (_name, body) => {
    expect(() => parseDetails(body)).toThrow(expect.objectContaining({ kind: "shape" }));
  });
});

describe("getMovieDetails", () => {
  it("calls the details endpoint with the id, the 8 s timeout and the abort signal", async () => {
    mockInvoke.mockResolvedValue({ data: BODY, error: null });
    const controller = new AbortController();
    const result = await getMovieDetails(603, controller.signal);
    expect(result.movie.title).toBe("The Matrix");
    expect(mockInvoke).toHaveBeenCalledWith("tmdb?endpoint=details&id=603", {
      method: "GET",
      timeout: 8000,
      signal: controller.signal,
    });
  });

  it("throws a shape error for a bad body", async () => {
    mockInvoke.mockResolvedValue({ data: { nope: true }, error: null });
    await expect(getMovieDetails(1)).rejects.toMatchObject({ kind: "shape" });
  });

  it("maps a 404 to an http error carrying status and code", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: httpError(404, "not_found") });
    await expect(getMovieDetails(1)).rejects.toMatchObject({ kind: "http", status: 404, code: "not_found" });
  });

  it("maps an unrequested abort to a timeout", async () => {
    const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
    mockInvoke.mockResolvedValue({ data: null, error: new FunctionsFetchError(abort) });
    await expect(getMovieDetails(1)).rejects.toMatchObject({ kind: "timeout" });
  });
});

describe("details through the real query client", () => {
  // Fetches the details key with the real mapping and defaults; returns the invoke count.
  async function run(error: unknown) {
    mockInvoke.mockResolvedValue({ data: null, error });
    const client = createQueryClient();
    await client
      .fetchQuery({ queryKey: ["movies", "details", 1], queryFn: ({ signal }) => getMovieDetails(1, signal), retryDelay: 0 })
      .catch(() => undefined);
    client.clear();
    return mockInvoke.mock.calls.length;
  }

  it("keeps details fresh for 30 minutes", () => {
    expect(queryClient.getQueryDefaults(["movies", "details", 5])).toMatchObject({ staleTime: 30 * 60 * 1000 });
  });

  it("does not retry a 404 and does not report it to Sentry", async () => {
    expect(await run(httpError(404, "not_found"))).toBe(1);
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it("retries a 5xx once and does not report a coded upstream_error", async () => {
    expect(await run(httpError(502, "upstream_error"))).toBe(2);
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it("does not report an offline failure or a timeout", async () => {
    expect(await run(new FunctionsFetchError(new TypeError("Network request failed")))).toBe(2);
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it("reports a bad TMDB key and a misconfigured proxy once each", async () => {
    await run(httpError(502, "upstream_auth"));
    await run(httpError(500, "misconfigured"));
    expect(mockCapture).toHaveBeenCalledTimes(2);
  });

  it("reports a malformed body as a shape error", async () => {
    mockInvoke.mockResolvedValue({ data: { nope: 1 }, error: null });
    const client = createQueryClient();
    await client
      .fetchQuery({ queryKey: ["movies", "details", 1], queryFn: () => getMovieDetails(1), retryDelay: 0 })
      .catch(() => undefined);
    client.clear();
    expect(mockCapture).toHaveBeenCalledTimes(1);
    expect(mockCapture.mock.calls[0][0]).toBeInstanceOf(MovieApiError);
  });
});

describe("format helpers", () => {
  it.each([
    [45, "45m"], [60, "1h"], [120, "2h"], [148, "2h 28m"], [61, "1h 1m"], [0, null], [null, null], [undefined, null], [-5, null],
  ])("formatRuntime(%p) is %p", (minutes, expected) => {
    expect(formatRuntime(minutes)).toBe(expected);
  });

  it("formats the rating to one decimal and hides it without votes", () => {
    expect(formatRating(8.44, 10)).toBe("8.4");
    expect(formatRating(8, 3)).toBe("8.0");
    expect(formatRating(0, 0)).toBeNull();
    expect(formatRating(7, null)).toBeNull();
    expect(formatRating(null, 5)).toBeNull();
    expect(formatRating(NaN, 5)).toBeNull();
  });

  it("joins the meta line, showing a lone part alone and nothing when both are missing", () => {
    expect(metaLine(1999, "2h 16m")).toBe("1999 · 2h 16m");
    expect(metaLine(1999, null)).toBe("1999");
    expect(metaLine(null, "45m")).toBe("45m");
    expect(metaLine(null, null)).toBeNull();
  });
});
