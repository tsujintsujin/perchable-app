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
jest.mock("@/modules/auth", () => {
  const { Pressable, Text } = jest.requireActual("react-native");
  return {
    useSignOut: () => ({ signOut: mockSignOut, isSigningOut: mockIsSigningOut }),
    // Stand-in for the real sheet (covered by its own test): visible only while mounted.
    DeleteAccountSheet: ({ onClose }: { onClose: () => void }) => (
      <Pressable accessibilityRole="button" accessibilityLabel="close-sheet" onPress={onClose}>
        <Text>sheet-open</Text>
      </Pressable>
    ),
  };
});

import ProfileSettings from "@/app/(tabs)/profile/settings";

describe("Settings screen", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockBack.mockReset();
    mockSignOut.mockReset();
    mockIsSigningOut = false;
  });

  it("shows the Account rows, About with the verbatim TMDB sentence, and the Danger zone", async () => {
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
    expect(screen.getByText("Danger zone")).toBeTruthy();
    expect(screen.getByText("🗑 Delete my account")).toBeTruthy();
  });

  it("opens the delete sheet from the Danger zone row and closes it again, deleting nothing itself", async () => {
    await render(<ProfileSettings />);
    expect(screen.queryByText("sheet-open")).toBeNull();

    await act(async () => {
      fireEvent.press(screen.getByText("🗑 Delete my account"));
    });
    expect(screen.getByText("sheet-open")).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByLabelText("close-sheet"));
    });
    expect(screen.queryByText("sheet-open")).toBeNull();
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

  it("labels the back chip for screen readers", async () => {
    await render(<ProfileSettings />);
    expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
  });

  it("marks the Sign out row busy while signing out", async () => {
    mockIsSigningOut = true;
    await render(<ProfileSettings />);
    expect(screen.getByRole("button", { name: /Sign out/ })).toBeBusy();
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
    expect(screen.getByRole("alert")).toBeTruthy();

    // Real timers: the toast's auto-dismiss (2.5s) is what is under test.
    await waitFor(() => expect(screen.queryByText("Comment settings are coming soon.")).toBeNull(), {
      timeout: 4000,
    });
  });
});
