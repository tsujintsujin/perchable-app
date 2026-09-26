import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";

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
    expect(screen.getByText("✏️ Edit profile")).toBeTruthy();
    expect(screen.getByText("⚙ Settings")).toBeTruthy();
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
});
