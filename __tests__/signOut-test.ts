// Env the Google config reads; Jest doesn't inline EXPO_PUBLIC_* like Metro does.
process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = "test-google-web-client-id";

const mockSupabaseSignOut = jest.fn();
jest.mock("@/lib/supabase", () => ({
  supabase: { auth: { signOut: (...args: unknown[]) => mockSupabaseSignOut(...args) } },
}));

const mockGoogleSignOut = jest.fn();
jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: { configure: jest.fn(), signOut: () => mockGoogleSignOut() },
}));

const mockCaptureException = jest.fn();
const mockSetUser = jest.fn();
jest.mock("@/lib/sentry", () => ({
  Sentry: {
    captureException: (...args: unknown[]) => mockCaptureException(...args),
    setUser: (...args: unknown[]) => mockSetUser(...args),
  },
}));

import { signOut } from "@/modules/auth/api/signOut";

describe("signOut", () => {
  beforeEach(() => {
    mockSupabaseSignOut.mockReset().mockResolvedValue({ error: null });
    mockGoogleSignOut.mockReset().mockResolvedValue(null);
    mockCaptureException.mockReset();
    mockSetUser.mockReset();
  });

  it("signs out of Supabase (this device only) and Google, and reports nothing on success", async () => {
    await signOut();

    expect(mockSupabaseSignOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mockGoogleSignOut).toHaveBeenCalledTimes(1);
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it("clears the Sentry user", async () => {
    await signOut();
    expect(mockSetUser).toHaveBeenCalledWith(null);
  });

  it("still signs out of Google when Supabase fails on the network, and reports it", async () => {
    const offline = new Error("Network request failed");
    mockSupabaseSignOut.mockResolvedValue({ error: offline });

    await expect(signOut()).resolves.toBeUndefined();

    expect(mockGoogleSignOut).toHaveBeenCalledTimes(1);
    expect(mockCaptureException).toHaveBeenCalledWith(offline);
  });

  it("still signs out of Supabase when Google fails, and reports it", async () => {
    const googleFailure = new Error("Google sign-out failed");
    mockGoogleSignOut.mockRejectedValue(googleFailure);

    await expect(signOut()).resolves.toBeUndefined();

    expect(mockSupabaseSignOut).toHaveBeenCalledTimes(1);
    expect(mockCaptureException).toHaveBeenCalledWith(googleFailure);
  });

  it("resolves and reports when the local session store rejects", async () => {
    const storageFailure = new Error("SecureStore delete failed");
    mockSupabaseSignOut.mockRejectedValue(storageFailure);

    await expect(signOut()).resolves.toBeUndefined();

    expect(mockGoogleSignOut).toHaveBeenCalledTimes(1);
    expect(mockCaptureException).toHaveBeenCalledWith(storageFailure);
  });
});
