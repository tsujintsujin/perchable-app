import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from "@supabase/supabase-js";

const mockInvoke = jest.fn();
jest.mock("@/lib/supabase", () => ({ supabase: { auth: { getSession: () => Promise.resolve({}) }, functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } } }));
const mockCapture = jest.fn();
jest.mock("@/lib/sentry", () => ({ Sentry: { captureException: (...args: unknown[]) => mockCapture(...args) } }));

import { createQueryClient, queryClient } from "@/lib/queryClient";
import { getPopularMovies } from "@/modules/movies/api/getPopularMovies";

const httpError = (status: number, code?: string) =>
  new FunctionsHttpError({ status, json: async () => (code ? { error: "x", code } : { error: "x" }) });
const abortError = () => Object.assign(new Error("aborted"), { name: "AbortError" });

// Fetches the Popular key through the real client, api layer and mapping (no retry wait); returns the invoke count.
async function runFailing(result: { data: unknown; error: unknown }) {
  mockInvoke.mockReset();
  mockCapture.mockReset();
  mockInvoke.mockResolvedValue(result);
  const client = createQueryClient();
  await client
    .fetchQuery({ queryKey: ["movies", "popular"], queryFn: ({ signal }) => getPopularMovies(1, signal), retryDelay: 0 })
    .catch(() => undefined);
  client.clear();
  return mockInvoke.mock.calls.length;
}

describe("queryClient defaults", () => {
  it("is one shared instance with the M4 defaults", () => {
    expect(createQueryClient()).not.toBe(queryClient);
    const defaults = queryClient.getDefaultOptions().queries;
    expect(defaults?.gcTime).toBe(30 * 60 * 1000);
    expect(defaults?.retryDelay).toBe(1000);
    expect(defaults?.refetchOnWindowFocus).toBe(false);
    expect(queryClient.getQueryDefaults(["movies", "popular"])).toMatchObject({
      staleTime: 5 * 60 * 1000,
      refetchOnMount: false,
    });
  });

  // A reconnect or focus must never reload or reorder the pages a user is swiping, and a retry would restart the page loop.
  it("keeps the Quick Add deck out of reconnect, focus and automatic retries", () => {
    expect(queryClient.getQueryDefaults(["movies", "deck", "popular"])).toMatchObject({
      staleTime: 30 * 60 * 1000,
      refetchOnMount: false,
      refetchOnReconnect: false,
      refetchOnWindowFocus: false,
      retry: 0,
    });
  });

  it("leaves Home's Popular list on the default retry and reconnect behaviour", () => {
    expect(queryClient.getQueryDefaults(["movies", "popular"]).refetchOnReconnect).toBeUndefined();
    expect(queryClient.getQueryDefaults(["movies", "popular"]).retry).toBeUndefined();
  });
});

describe("retry policy through the real error mapping", () => {
  it.each([
    ["timeout", () => ({ data: null, error: new FunctionsFetchError(abortError()) })],
    ["network", () => ({ data: null, error: new FunctionsFetchError(new TypeError("offline")) })],
    ["http 500", () => ({ data: null, error: httpError(500) })],
    ["http 502 relay", () => ({ data: null, error: new FunctionsRelayError({}) })],
  ])("tries twice for %s", async (_name, make) => {
    expect(await runFailing(make())).toBe(2);
  });

  it.each([
    ["http 400", () => ({ data: null, error: httpError(400) })],
    ["http 401", () => ({ data: null, error: httpError(401) })],
    ["http 404", () => ({ data: null, error: httpError(404) })],
    ["http 429", () => ({ data: null, error: httpError(429) })],
    ["shape", () => ({ data: { nope: true }, error: null })],
  ])("tries once for %s", async (_name, make) => {
    expect(await runFailing(make())).toBe(1);
  });
});

describe("Sentry from the QueryCache", () => {
  it.each([
    ["500 misconfigured", () => ({ data: null, error: httpError(500, "misconfigured") })],
    ["502 upstream_auth", () => ({ data: null, error: httpError(502, "upstream_auth") })],
    ["shape", () => ({ data: { nope: true }, error: null })],
    ["codeless 500 (function crash)", () => ({ data: null, error: httpError(500) })],
  ])("captures %s once, even though a 5xx is retried", async (_name, make) => {
    await runFailing(make());
    expect(mockCapture).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["offline", () => ({ data: null, error: new FunctionsFetchError(new TypeError("offline")) })],
    ["timeout", () => ({ data: null, error: new FunctionsFetchError(abortError()) })],
    ["400", () => ({ data: null, error: httpError(400) })],
    ["401", () => ({ data: null, error: httpError(401) })],
    ["404", () => ({ data: null, error: httpError(404) })],
    ["429", () => ({ data: null, error: httpError(429) })],
    ["502 upstream_network", () => ({ data: null, error: httpError(502, "upstream_network") })],
    ["502 upstream_error", () => ({ data: null, error: httpError(502, "upstream_error") })],
    ["500 upstream_error", () => ({ data: null, error: httpError(500, "upstream_error") })],
    ["503 upstream_error", () => ({ data: null, error: httpError(503, "upstream_error") })],
    ["relay 502", () => ({ data: null, error: new FunctionsRelayError({}) })],
  ])("does not capture %s", async (_name, make) => {
    await runFailing(make());
    expect(mockCapture).not.toHaveBeenCalled();
  });
});
