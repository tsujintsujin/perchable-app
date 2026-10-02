import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from "@supabase/supabase-js";

const mockInvoke = jest.fn();
jest.mock("@/lib/supabase", () => ({ supabase: { auth: { getSession: () => Promise.resolve({}) }, functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } } }));

import { getPopularMovies } from "@/modules/movies/api/getPopularMovies";
import { MovieApiError, RELAY_CODE, isRetryableMovieError, shouldReportMovieError } from "@/modules/movies/api/MovieApiError";
import { parsePopular } from "@/modules/movies/api/parsePopular";

const page = { results: [{ id: 1, title: "A", poster_path: null, vote_average: 1, release_date: "" }], page: 1, total_pages: 3 };

// Builds an http error the way functions-js does: the Response is the context.
const httpError = (status: number, body?: unknown) =>
  new FunctionsHttpError({
    status,
    json: async () => {
      if (body === undefined) throw new Error("no body");
      return body;
    },
  });

// Runs getPopularMovies against a failing invoke and returns the thrown error.
async function failWith(error: unknown, signal?: AbortSignal) {
  mockInvoke.mockResolvedValueOnce({ data: null, error });
  return getPopularMovies(1, signal).then(
    () => {
      throw new Error("expected a rejection");
    },
    (e: unknown) => e as MovieApiError,
  );
}

beforeEach(() => mockInvoke.mockReset());

describe("getPopularMovies request options", () => {
  it("passes the 8 s timeout and the query signal, and defaults to page 1", async () => {
    mockInvoke.mockResolvedValue({ data: page, error: null });
    const controller = new AbortController();
    await getPopularMovies(2, controller.signal);
    expect(mockInvoke).toHaveBeenCalledWith("tmdb?endpoint=popular&page=2", {
      method: "GET",
      timeout: 8000,
      signal: controller.signal,
    });
    await getPopularMovies();
    expect(mockInvoke.mock.calls[1][0]).toBe("tmdb?endpoint=popular&page=1");
  });

  it("returns the parsed page", async () => {
    mockInvoke.mockResolvedValue({ data: page, error: null });
    await expect(getPopularMovies()).resolves.toEqual(page);
  });
});

describe("error mapping from real functions-js errors", () => {
  it("maps an http error to kind http with its status and the proxy code", async () => {
    const err = await failWith(httpError(502, { error: "x", code: "upstream_auth" }));
    expect(err).toBeInstanceOf(MovieApiError);
    expect(err).toMatchObject({ kind: "http", status: 502, code: "upstream_auth" });
  });

  it("keeps the status when the error body has no code or is not JSON", async () => {
    expect(await failWith(httpError(500, { error: "x" }))).toMatchObject({ kind: "http", status: 500, code: undefined });
    expect(await failWith(httpError(404))).toMatchObject({ kind: "http", status: 404, code: undefined });
  });

  it("maps a relay error to http 502 with the relay marker", async () => {
    expect(await failWith(new FunctionsRelayError({}))).toMatchObject({ kind: "http", status: 502, code: "relay" });
  });

  it("maps a fetch failure to network, and an abort we did not ask for to timeout", async () => {
    expect(await failWith(new FunctionsFetchError(new TypeError("Network request failed")))).toMatchObject({ kind: "network" });
    const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
    expect(await failWith(new FunctionsFetchError(abort))).toMatchObject({ kind: "timeout" });
    const controller = new AbortController();
    controller.abort();
    expect(await failWith(new FunctionsFetchError(abort), controller.signal)).toMatchObject({ kind: "network" });
  });

  it("passes an unrecognised error through unchanged", async () => {
    const odd = new Error("odd");
    expect(await failWith(odd)).toBe(odd);
  });

  it("throws a shape error for a body that fails validation", async () => {
    mockInvoke.mockResolvedValue({ data: "<html>", error: null });
    await expect(getPopularMovies()).rejects.toMatchObject({ kind: "shape" });
  });
});

describe("retry and report rules", () => {
  const http = (status: number, code?: string) => new MovieApiError("http", { status, code });

  it("retries timeout, network and 5xx only", () => {
    expect(isRetryableMovieError(new MovieApiError("timeout"))).toBe(true);
    expect(isRetryableMovieError(new MovieApiError("network"))).toBe(true);
    expect(isRetryableMovieError(http(500))).toBe(true);
    expect(isRetryableMovieError(http(502, "upstream_auth"))).toBe(true);
    for (const status of [400, 401, 404, 429]) expect(isRetryableMovieError(http(status))).toBe(false);
    expect(isRetryableMovieError(new MovieApiError("shape"))).toBe(false);
    expect(isRetryableMovieError(new Error("x"))).toBe(false);
  });

  it("reports only misconfigured, upstream_auth, shape, a codeless 5xx and unexpected errors", () => {
    expect(shouldReportMovieError(http(500, "misconfigured"))).toBe(true);
    expect(shouldReportMovieError(http(502, "upstream_auth"))).toBe(true);
    expect(shouldReportMovieError(new MovieApiError("shape"))).toBe(true);
    expect(shouldReportMovieError(http(500))).toBe(true);
    expect(shouldReportMovieError(http(503))).toBe(true);
    expect(shouldReportMovieError(new Error("unexpected"))).toBe(true);
  });

  it("does not report TMDB outages, relay errors, 4xx, timeout or offline", () => {
    expect(shouldReportMovieError(http(502, "upstream_error"))).toBe(false);
    expect(shouldReportMovieError(http(500, "upstream_error"))).toBe(false);
    expect(shouldReportMovieError(http(502, "upstream_network"))).toBe(false);
    expect(shouldReportMovieError(http(502, RELAY_CODE))).toBe(false);
    expect(shouldReportMovieError(new MovieApiError("network"))).toBe(false);
    expect(shouldReportMovieError(new MovieApiError("timeout"))).toBe(false);
    for (const status of [400, 401, 404, 429]) expect(shouldReportMovieError(http(status))).toBe(false);
  });
});

describe("parsePopular", () => {
  it("accepts a normal page and a page with zero results", () => {
    expect(parsePopular(page)).toEqual(page);
    expect(parsePopular({ results: [], page: 1, total_pages: 1 }).results).toEqual([]);
  });

  it.each([
    ["a string", "nope"],
    ["null", null],
    ["an array", []],
    ["results not an array", { results: {}, page: 1, total_pages: 1 }],
    ["a movie without an id", { results: [{ title: "A" }], page: 1, total_pages: 1 }],
    ["a string id", { results: [{ id: "1", title: "A" }], page: 1, total_pages: 1 }],
    ["a movie without a title", { results: [{ id: 1 }], page: 1, total_pages: 1 }],
    ["a missing page", { results: [], total_pages: 1 }],
  ])("throws shape for %s", (_name, body) => {
    expect(() => parsePopular(body)).toThrow(MovieApiError);
    expect(() => parsePopular(body)).toThrow(/shape/);
  });
});
