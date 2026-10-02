const mockGetSession = jest.fn();
const mockInvoke = jest.fn();
const mockFrom = jest.fn();
const mockStorageFrom = jest.fn();
jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getSession: () => mockGetSession() },
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
    from: (...args: unknown[]) => mockFrom(...args),
    storage: { from: (...args: unknown[]) => mockStorageFrom(...args) },
  },
}));
const mockCapture = jest.fn();
jest.mock("@/lib/sentry", () => ({ Sentry: { captureException: (...args: unknown[]) => mockCapture(...args) } }));

import { authReady, REQUEST_TIMEOUT_MS, RequestTimeoutError } from "@/lib/requestTimeout";
import { createQueryClient } from "@/lib/queryClient";
import { getPopularMovies } from "@/modules/movies/api/getPopularMovies";
import { MovieApiError } from "@/modules/movies/api/MovieApiError";
import { getOwnProfile } from "@/modules/profile/api/getOwnProfile";
import { DeleteAccountOfflineError, deleteAccount } from "@/modules/auth/api/deleteAccount";
import { blockUser, unblockUser } from "@/modules/moderation/api/blockUser";
import { getBlockedUsers } from "@/modules/moderation/api/getBlockedUsers";
import { reportContent } from "@/modules/moderation/api/reportContent";
import { checkUsertagAvailable } from "@/modules/profile/api/checkUsertagAvailable";
import { updateProfile } from "@/modules/profile/api/updateProfile";
import { uploadAvatar } from "@/modules/profile/api/uploadAvatar";

/** A getSession that never settles, like auth-js stuck in its offline refresh retry. */
const stuck = () => new Promise(() => {});

describe("auth wait is bounded by the request timeout", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockGetSession.mockReset().mockImplementation(stuck);
    mockInvoke.mockReset();
    mockFrom.mockReset();
    mockStorageFrom.mockReset();
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

  // Every gated API function, called with auth stuck: the timeout error, and no request sent.
  it.each<[string, () => Promise<unknown>, new () => Error]>([
    ["deleteAccount", () => deleteAccount(), DeleteAccountOfflineError],
    ["blockUser", () => blockUser("u1", "u2"), RequestTimeoutError],
    ["unblockUser", () => unblockUser("u1", "u2"), RequestTimeoutError],
    ["getBlockedUsers", () => getBlockedUsers("u1"), RequestTimeoutError],
    [
      "reportContent",
      () => reportContent({ type: "profile", id: "u2", ownerId: "u2" }, "spam", null),
      RequestTimeoutError,
    ],
    ["checkUsertagAvailable", () => checkUsertagAvailable("cineowl", "u1"), RequestTimeoutError],
    ["updateProfile", () => updateProfile("u1", { usertag: "cineowl" }), RequestTimeoutError],
    ["uploadAvatar", () => uploadAvatar("u1", "file:///a.jpg"), RequestTimeoutError],
  ])("%s: stuck getSession rejects with the timeout error and no request is sent", async (_name, call, ErrorClass) => {
    // uploadAvatar reads the local file before the gate; that read is not a server request.
    globalThis.fetch = jest.fn().mockResolvedValue({ arrayBuffer: async () => new ArrayBuffer(0) });
    const result = call().catch((e) => e);
    await jest.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    expect(await result).toBeInstanceOf(ErrorClass);
    expect(mockInvoke).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockStorageFrom).not.toHaveBeenCalled();
  });
});
