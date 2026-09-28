import { act, render, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

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
});
