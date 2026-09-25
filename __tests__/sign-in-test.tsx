import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

// Jest doesn't run Expo's .env → process.env.EXPO_PUBLIC_* inlining (that's
// a Metro/CLI-time step), so signInWithGoogle's own env read needs a stand-in
// here to match what a real build always has set.
process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = "test-google-web-client-id";

// Mock the native Google Sign-In module (can't run in Jest) so
// signInWithGoogle's own logic — and the real GoogleSignInButton — render
// and behave as they would on-device.
const mockSignIn = jest.fn();
const mockHasPlayServices = jest.fn().mockResolvedValue(true);
jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: (...args: unknown[]) => mockHasPlayServices(...args),
    signIn: (...args: unknown[]) => mockSignIn(...args),
  },
  isSuccessResponse: (response: { type?: string }) => response?.type === "success",
}));

// Mock Supabase's client too, so a successful Google sign-in doesn't attempt
// a real network call.
const mockSignInWithIdToken = jest.fn().mockResolvedValue({ error: null });
jest.mock("@/lib/supabase", () => ({
  supabase: { auth: { signInWithIdToken: (...args: unknown[]) => mockSignInWithIdToken(...args) } },
}));

// sign-in.tsx logs failures to Sentry; @/lib/sentry throws at import time
// without a real DSN env var (not present in the Jest process), so stub it.
jest.mock("@/lib/sentry", () => ({ Sentry: { captureException: jest.fn() } }));

import SignIn from "@/app/(auth)/sign-in";

describe("Sign-in screen", () => {
  beforeEach(() => {
    mockSignIn.mockReset();
    mockSignInWithIdToken.mockClear();
  });

  it("renders the idle state with wordmark, tagline and Google button", async () => {
    await render(<SignIn />);

    expect(screen.getByText("🦉 perchable")).toBeTruthy();
    expect(screen.getByText("Sign in with Google")).toBeTruthy();
    expect(screen.queryByText(/Couldn't sign in/)).toBeNull();
  });

  it("shows the loading label while sign-in is in flight", async () => {
    let resolveSignIn: (value: unknown) => void = () => {};
    mockSignIn.mockReturnValue(new Promise((resolve) => (resolveSignIn = resolve)));
    await render(<SignIn />);

    fireEvent.press(screen.getByText("Sign in with Google"));

    await waitFor(() => expect(screen.getByText("Signing in…")).toBeTruthy());

    resolveSignIn({ type: "success", data: { idToken: "fake-token" } });
    await waitFor(() => expect(mockSignInWithIdToken).toHaveBeenCalled());
  });

  it("shows the generic error card when the Google sign-in flow fails", async () => {
    mockSignIn.mockRejectedValue(new Error("user cancelled"));
    await render(<SignIn />);

    fireEvent.press(screen.getByText("Sign in with Google"));

    await waitFor(() =>
      expect(
        screen.getByText("⚠ Couldn't sign in. Check your connection and try again."),
      ).toBeTruthy(),
    );
  });
});
