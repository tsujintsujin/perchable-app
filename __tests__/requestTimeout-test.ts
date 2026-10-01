const mockGetSession = jest.fn();
const mockInvoke = jest.fn();
const mockFrom = jest.fn();
jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getSession: () => mockGetSession() },
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));
const mockCapture = jest.fn();
jest.mock("@/lib/sentry", () => ({ Sentry: { captureException: (...args: unknown[]) => mockCapture(...args) } }));

import { authReady, REQUEST_TIMEOUT_MS, RequestTimeoutError } from "@/lib/requestTimeout";
import { createQueryClient } from "@/lib/queryClient";
import { getPopularMovies } from "@/modules/movies/api/getPopularMovies";
import { MovieApiError } from "@/modules/movies/api/MovieApiError";
import { getOwnProfile } from "@/modules/profile/api/getOwnProfile";

/** A getSession that never settles, like auth-js stuck in its offline refresh retry. */
const stuck = () => new Promise(() => {});

describe("auth wait is bounded by the request timeout", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockGetSession.mockReset().mockImplementation(stuck);
    mockInvoke.mockReset();
    mockFrom.mockReset();
    mockCapture.mockReset();
  });
  afterEach(() => jest.useRealTimers());

  it("authReady resolves as soon as getSession answers, and keeps no timer", async () => {
    mockGetSession.mockResolvedValue({});
    await expect(authReady()).resolves.toBeUndefined();
    expect(jest.getTimerCount()).toBe(0);
  });

  it("authReady also resolves when getSession rejects (the request reports its own error)", async () => {
    mockGetSession.mockRejectedValue(new Error("boom"));
    await expect(authReady()).resolves.toBeUndefined();
  });

  it("authReady rejects with RequestTimeoutError when getSession never answers", async () => {
    const result = authReady().catch((e) => e);
    await jest.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    expect(await result).toBeInstanceOf(RequestTimeoutError);
  });

  it("a movies call times out as a MovieApiError and never sends the request", async () => {
    const result = getPopularMovies(1).catch((e) => e);
    await jest.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 1);
    expect(mockInvoke).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    const error = await result;
    expect(error).toBeInstanceOf(MovieApiError);
    expect((error as MovieApiError).kind).toBe("timeout");
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("the Home query reaches its error after one retry (~17 s) without reporting to Sentry", async () => {
    const client = createQueryClient();
    const result = client.fetchQuery({ queryKey: ["movies", "x"], queryFn: () => getPopularMovies(1) }).catch((e) => e);
    await jest.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS * 2 + 1000);
    const error = await result;
    expect(error).toBeInstanceOf(MovieApiError);
    expect((error as MovieApiError).kind).toBe("timeout");
    expect(mockCapture).not.toHaveBeenCalled();
    client.clear();
  });

  it("a profile call rejects after the timeout and never queries the table", async () => {
    const result = getOwnProfile("u1").catch((e) => e);
    await jest.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    expect(await result).toBeInstanceOf(RequestTimeoutError);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
