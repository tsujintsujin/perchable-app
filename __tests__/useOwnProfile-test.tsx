import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";

// Mirrors react-navigation's real behavior closely enough for this test:
// reruns only when the passed callback's identity changes.
jest.mock("expo-router/react-navigation", () => {
  const ReactActual = require("react");
  return {
    useFocusEffect: (effect: () => void | (() => void)) => {
      ReactActual.useEffect(effect, [effect]);
    },
  };
});

const mockUseAuthSession = jest.fn();
jest.mock("@/modules/auth", () => ({
  useAuthSession: () => mockUseAuthSession(),
}));

const mockGetOwnProfile = jest.fn();
jest.mock("@/modules/profile/api/getOwnProfile", () => ({
  getOwnProfile: (...args: unknown[]) => mockGetOwnProfile(...args),
}));

import { useOwnProfile } from "@/modules/profile/hooks/useOwnProfile";

/** Renders the hook's state as plain text — no hook-testing library is set
 * up in this project, so a tiny harness component stands in for one. */
function Harness() {
  const profile = useOwnProfile();
  return <Text testID="state">{JSON.stringify(profile)}</Text>;
}

/** Same as Harness, plus a Retry button wired to refetch. */
function HarnessWithRetry() {
  const profile = useOwnProfile();
  return (
    <>
      <Text testID="state">{JSON.stringify(profile)}</Text>
      <Pressable onPress={profile.refetch} accessibilityRole="button" accessibilityLabel="retry" />
    </>
  );
}

const PROFILE = {
  id: "u1",
  displayName: "Justin",
  avatarUrl: null,
  usertag: "cineowl",
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
};

describe("useOwnProfile", () => {
  beforeEach(() => {
    mockGetOwnProfile.mockReset();
  });

  it("drops the previous user's data and goes back to loading when signed out", async () => {
    mockUseAuthSession.mockReturnValue({ session: { user: { id: "u1" } } });
    mockGetOwnProfile.mockResolvedValue(PROFILE);

    const { rerender } = await render(<Harness />);
    await waitFor(() => expect(screen.getByTestId("state").props.children).toContain('"loaded"'));

    mockUseAuthSession.mockReturnValue({ session: null });
    await act(async () => {
      await rerender(<Harness />);
    });

    const state = screen.getByTestId("state").props.children;
    expect(state).toContain('"loading"');
    expect(state).not.toContain("Justin");
  });

  it("does not apply a fetch that finishes after sign-out", async () => {
    let resolveFetch: (profile: typeof PROFILE) => void = () => {};
    mockUseAuthSession.mockReturnValue({ session: { user: { id: "u1" } } });
    mockGetOwnProfile.mockReturnValue(new Promise((resolve) => (resolveFetch = resolve)));

    const { rerender } = await render(<Harness />);
    mockUseAuthSession.mockReturnValue({ session: null });
    await act(async () => {
      await rerender(<Harness />);
    });
    await act(async () => resolveFetch(PROFILE));

    const state = screen.getByTestId("state").props.children;
    expect(state).toContain('"loading"');
    expect(state).not.toContain("Justin");
  });

  it("does not show an error from a fetch that fails after sign-out", async () => {
    let rejectFetch: (err: Error) => void = () => {};
    mockUseAuthSession.mockReturnValue({ session: { user: { id: "u1" } } });
    mockGetOwnProfile.mockReturnValue(new Promise((_, reject) => (rejectFetch = reject)));

    const { rerender } = await render(<Harness />);
    mockUseAuthSession.mockReturnValue({ session: null });
    await act(async () => {
      await rerender(<Harness />);
    });
    await act(async () => rejectFetch(new Error("JWT expired")));

    expect(screen.getByTestId("state").props.children).not.toContain('"error"');
  });

  it("does not apply a Retry fetch that finishes after sign-out", async () => {
    let resolveRetry: (profile: typeof PROFILE) => void = () => {};
    mockUseAuthSession.mockReturnValue({ session: { user: { id: "u1" } } });
    mockGetOwnProfile.mockRejectedValueOnce(new Error("offline"));
    mockGetOwnProfile.mockReturnValueOnce(new Promise((resolve) => (resolveRetry = resolve)));

    const { rerender } = await render(<HarnessWithRetry />);
    await waitFor(() => expect(screen.getByTestId("state").props.children).toContain('"error"'));
    await act(async () => {
      fireEvent.press(screen.getByLabelText("retry"));
    });

    mockUseAuthSession.mockReturnValue({ session: null });
    await act(async () => {
      await rerender(<HarnessWithRetry />);
    });
    await act(async () => resolveRetry(PROFILE));

    const state = screen.getByTestId("state").props.children;
    expect(state).toContain('"loading"');
    expect(state).not.toContain("Justin");
  });
});
