import { StyleSheet } from "react-native";
import { size } from "@/ui/tokens";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";

// No <SafeAreaProvider> in the test tree — fixed insets stand in for it.
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const mockPush = jest.fn();
let mockFocusCallbacks: (() => void)[] = [];
jest.mock("expo-router", () => {
  const { useEffect } = jest.requireActual("react");
  return {
    router: { push: (...args: unknown[]) => mockPush(...args) },
    // Runs the callback on mount and records it so a test can simulate regaining focus.
    useFocusEffect: (cb: () => void) => {
      useEffect(() => {
        mockFocusCallbacks.push(cb);
        cb();
      }, [cb]);
    },
  };
});

// Mock the profile module's hook directly (not Supabase) — this test is
// about the screen's rendering per state, not the fetch itself (that's
// api/getOwnProfile's own concern).
const mockUseOwnProfile = jest.fn();
jest.mock("@/modules/profile", () => ({
  useOwnProfile: () => mockUseOwnProfile(),
}));

import MyProfile from "@/app/(tabs)/profile/index";

describe("My Profile screen", () => {
  beforeEach(() => {
    mockUseOwnProfile.mockReset();
    mockPush.mockReset();
    mockFocusCallbacks = [];
  });

  const loaded = (usertag: string | null) =>
    mockUseOwnProfile.mockReturnValue({
      state: "loaded",
      refetch: jest.fn(),
      profile: {
        id: "u1",
        displayName: "Justin Masiga",
        avatarUrl: null,
        usertag,
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
      },
    });

  it("renders shimmer placeholders in the loading state", async () => {
    mockUseOwnProfile.mockReturnValue({ state: "loading", refetch: jest.fn() });
    await render(<MyProfile />);

    expect(screen.getByText("My Profile")).toBeTruthy();
    // Loaded-only content must not render yet.
    expect(screen.queryByText("0 movies watched")).toBeNull();
  });

  it("renders the loaded profile, including the empty-usertag chip", async () => {
    mockUseOwnProfile.mockReturnValue({
      state: "loaded",
      refetch: jest.fn(),
      profile: {
        id: "u1",
        displayName: "Justin Masiga",
        avatarUrl: null,
        usertag: null,
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
      },
    });
    await render(<MyProfile />);

    expect(screen.getByText("Justin Masiga")).toBeTruthy();
    expect(screen.getByText(/No usertag yet/)).toBeTruthy();
    expect(screen.queryByText("✏️ Edit profile")).toBeNull();
    expect(screen.queryByText("⚙ Settings")).toBeNull();
    expect(screen.getByText("0 movies watched")).toBeTruthy();
  });

  it("renders @usertag once one is set", async () => {
    mockUseOwnProfile.mockReturnValue({
      state: "loaded",
      refetch: jest.fn(),
      profile: {
        id: "u1",
        displayName: "Justin Masiga",
        avatarUrl: null,
        usertag: "cineowl",
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
      },
    });
    await render(<MyProfile />);

    expect(screen.getByText("@cineowl")).toBeTruthy();
    expect(screen.queryByText(/No usertag yet/)).toBeNull();
  });

  it("renders the load-error state and calls refetch on Retry", async () => {
    const refetch = jest.fn();
    mockUseOwnProfile.mockReturnValue({ state: "error", message: "network down", refetch });
    await render(<MyProfile />);

    expect(screen.getByText("Couldn't load your profile")).toBeTruthy();
    expect(screen.getByText("Check your connection and try again.")).toBeTruthy();

    fireEvent.press(screen.getByText("Retry"));
    await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1));
  });

  it("empty-usertag chip pushes Edit profile and is labelled", async () => {
    loaded(null);
    await render(<MyProfile />);
    const chip = screen.getByRole("button", { name: "Add a usertag" });
    await fireEvent.press(chip);
    expect(mockPush).toHaveBeenCalledWith({ pathname: "/profile/edit", params: { focus: "usertag" } });
  });

  it("@usertag chip pushes Edit profile, has role button, a label and a 44dp+ tap height", async () => {
    loaded("cineowl");
    await render(<MyProfile />);
    const chip = screen.getByRole("button", { name: "Edit usertag, currently @cineowl" });
    expect(StyleSheet.flatten(chip.props.style).minHeight).toBeGreaterThanOrEqual(44);
    await fireEvent.press(chip);
    expect(mockPush).toHaveBeenCalledWith({ pathname: "/profile/edit", params: { focus: "usertag" } });
  });

  it("the header Settings chip is the only Settings entry and opens Settings", async () => {
    loaded(null);
    await render(<MyProfile />);
    expect(screen.getAllByText("⚙")).toHaveLength(1);
    await fireEvent.press(screen.getByText("⚙"));
    expect(mockPush).toHaveBeenCalledWith("/profile/settings");
  });

  it("a double tap pushes once, and tapping works again after focus returns", async () => {
    loaded("cineowl");
    await render(<MyProfile />);
    const chip = screen.getByRole("button", { name: /Edit usertag/ });
    await fireEvent.press(chip);
    await fireEvent.press(chip);
    await fireEvent.press(screen.getByText("⚙"));
    expect(mockPush).toHaveBeenCalledTimes(1);

    await act(async () => {
      mockFocusCallbacks[mockFocusCallbacks.length - 1]();
    });
    await fireEvent.press(chip);
    expect(mockPush).toHaveBeenCalledTimes(2);
  });

  it("a failed push re-arms the guard so the next tap works", async () => {
    loaded("cineowl");
    mockPush.mockImplementationOnce(() => {
      throw new Error("nav failed");
    });
    await render(<MyProfile />);
    const chip = screen.getByRole("button", { name: /Edit usertag/ });
    let thrown: unknown;
    try {
      await fireEvent.press(chip);
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(Error);
    await fireEvent.press(chip);
    expect(mockPush).toHaveBeenCalledTimes(2);
  });

  it("the Settings chip is labelled and grown to the minimum touch size", async () => {
    loaded(null);
    await render(<MyProfile />);
    const chip = screen.getByRole("button", { name: "Settings" });
    expect(chip.props.hitSlop).toBe((size.minTouch - size.iconButton) / 2);
  });

  it("loading state shows exactly the four shimmer bars, no rows or loaded content", async () => {
    mockUseOwnProfile.mockReturnValue({ state: "loading", refetch: jest.fn() });
    await render(<MyProfile />);
    expect(
      screen.getAllByTestId(/^shimmer-/).map((n) => n.props.testID),
    ).toEqual(["shimmer-avatar", "shimmer-name", "shimmer-usertag", "shimmer-count"]);
    expect(screen.queryByText(/Edit profile/)).toBeNull();
    expect(screen.queryByText("0 movies watched")).toBeNull();
  });
});
