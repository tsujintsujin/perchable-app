import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

// No <SafeAreaProvider> in the test tree — fixed insets stand in for it.
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  router: { push: (...args: unknown[]) => mockPush(...args), back: () => mockBack() },
}));

const mockSignOut = jest.fn();
let mockIsSigningOut = false;
jest.mock("@/modules/auth", () => ({
  useSignOut: () => ({ signOut: mockSignOut, isSigningOut: mockIsSigningOut }),
}));

import ProfileSettings from "@/app/(tabs)/profile/settings";

describe("Settings screen", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockBack.mockReset();
    mockSignOut.mockReset();
    mockIsSigningOut = false;
  });

  it("shows the Account rows, About with the verbatim TMDB sentence, and no Danger zone", async () => {
    await render(<ProfileSettings />);

    expect(screen.getByText("Settings")).toBeTruthy();
    expect(screen.getByText("Edit profile photo / usertag")).toBeTruthy();
    expect(screen.getByText("🚪 Sign out")).toBeTruthy();
    expect(screen.getByText("TMDB")).toBeTruthy();
    expect(screen.getByText("The Movie Database")).toBeTruthy();
    expect(
      screen.getByText(
        "This application uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("Danger zone")).toBeNull();
    expect(screen.queryByText(/Delete my account/)).toBeNull();
  });

  it("calls signOut when the Sign out row is tapped", async () => {
    await render(<ProfileSettings />);
    await act(async () => {
      fireEvent.press(screen.getByText("🚪 Sign out"));
    });
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it("ignores taps on the Sign out row while a sign-out is running", async () => {
    mockIsSigningOut = true;
    await render(<ProfileSettings />);
    await act(async () => {
      fireEvent.press(screen.getByText("🚪 Sign out"));
    });
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Sign out/ })).toBeDisabled();
  });

  it("opens Edit profile from the first row and goes back from the header chip", async () => {
    await render(<ProfileSettings />);
    await act(async () => {
      fireEvent.press(screen.getByText("Edit profile photo / usertag"));
    });
    expect(mockPush).toHaveBeenCalledWith("/profile/edit");
    await act(async () => {
      fireEvent.press(screen.getByText("←"));
    });
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it("gives feedback on the not-yet-built comments row, then clears it", async () => {
    await render(<ProfileSettings />);
    expect(screen.queryByText("Comment settings are coming soon.")).toBeNull();

    await act(async () => {

      fireEvent.press(screen.getByText(/Comments on my collection/));

    });
    expect(screen.getByText("Comment settings are coming soon.")).toBeTruthy();

    // Real timers: the toast's auto-dismiss (2.5s) is what is under test.
    await waitFor(() => expect(screen.queryByText("Comment settings are coming soon.")).toBeNull(), {
      timeout: 4000,
    });
  });
});
