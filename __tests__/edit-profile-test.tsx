import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

/** Flushes pending microtasks so an async handler's state update lands
 * inside `act`'s scope instead of after it returns (same pattern as
 * sign-in-test.tsx's Build 5 · Bug 1 fix). */
const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

// No <SafeAreaProvider> in the test tree — fixed insets stand in for it.
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const mockUseOwnProfile = jest.fn();
const mockUseUsertagAvailability = jest.fn();
const mockUpdateProfile = jest.fn();
const mockUseAvatarUpload = jest.fn();

jest.mock("@/modules/profile", () => ({
  useOwnProfile: () => mockUseOwnProfile(),
  useUsertagAvailability: (...args: unknown[]) => mockUseUsertagAvailability(...args),
  updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
  useAvatarUpload: (...args: unknown[]) => mockUseAvatarUpload(...args),
}));

jest.mock("@/lib/sentry", () => ({ Sentry: { captureException: jest.fn() } }));
jest.mock("@/lib/supabase", () => ({ supabase: {} }));

// Build 7 · Bug 1: the real `router.back()` reads expo-router's global
// navigation store, which only gets initialized by a real Stack/root
// layout mounting — not present when unit-rendering a leaf screen like
// this one in isolation. An earlier test in this file happened to pass by
// relying on that store being left "ready" from some other render; mocking
// it here makes every test's use of `router.back()` correct on its own
// terms instead of by test-order accident.
const mockRouterBack = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({
  router: { back: (...args: unknown[]) => mockRouterBack(...args) },
  useLocalSearchParams: () => mockParams,
}));

import EditProfile from "@/app/(tabs)/profile/edit";
import { Sentry } from "@/lib/sentry";
import { RequestTimeoutError } from "@/lib/requestTimeout";

const PROFILE = {
  id: "u1",
  displayName: "Justin Masiga",
  avatarUrl: null,
  usertag: "cineowl",
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
};

describe("Edit profile screen", () => {
  const mockPickAndUpload = jest.fn();
  const mockCancel = jest.fn();

  beforeEach(() => {
    mockUseOwnProfile.mockReturnValue({ state: "loaded", refetch: jest.fn(), profile: PROFILE });
    mockUseUsertagAvailability.mockReturnValue({ status: "unchanged" });
    mockUpdateProfile.mockReset().mockResolvedValue(undefined);
    mockRouterBack.mockReset();
    (Sentry.captureException as jest.Mock).mockClear();
    mockParams = {};
    mockPickAndUpload.mockReset();
    mockCancel.mockReset();
    mockUseAvatarUpload.mockReset().mockReturnValue({
      avatarUrl: null,
      photo: { state: "idle" },
      isUploading: false,
      pickAndUpload: mockPickAndUpload,
      cancel: mockCancel,
    });
  });

  it("does not autofocus the usertag field without the focus param", async () => {
    await render(<EditProfile />);
    expect(screen.getByPlaceholderText("usertag").props.autoFocus).toBe(false);
  });

  it("autofocuses the usertag field when opened with focus=usertag", async () => {
    mockParams = { focus: "usertag" };
    await render(<EditProfile />);
    expect(screen.getByPlaceholderText("usertag").props.autoFocus).toBe(true);
  });

  it("renders the idle state and disables Save with no change", async () => {
    await render(<EditProfile />);

    expect(screen.getByText("Edit profile")).toBeTruthy();
    expect(screen.getByDisplayValue("cineowl")).toBeTruthy();
    expect(
      screen.getByText("3–20 characters · lowercase letters, numbers, underscore · must start with a letter"),
    ).toBeTruthy();

    fireEvent.press(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mockUpdateProfile).not.toHaveBeenCalledWith("u1", { usertag: expect.anything() }));
  });

  it("keeps Save disabled while the usertag is invalid", async () => {
    mockUseUsertagAvailability.mockReturnValue({ status: "invalid" });
    await render(<EditProfile />);

    fireEvent.changeText(screen.getByDisplayValue("cineowl"), "1bad");
    fireEvent.press(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(mockUpdateProfile).not.toHaveBeenCalled());
  });

  it("shows the taken error and keeps Save disabled", async () => {
    mockUseUsertagAvailability.mockReturnValue({ status: "taken" });
    await render(<EditProfile />);

    expect(screen.getByText("That usertag is already taken.")).toBeTruthy();

    fireEvent.press(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mockUpdateProfile).not.toHaveBeenCalled());
  });

  it("saves the usertag when available and goes back", async () => {
    mockUseUsertagAvailability.mockReturnValue({ status: "available" });
    await render(<EditProfile />);

    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Save" }));
      await flushMicrotasks();
    });

    expect(mockUpdateProfile).toHaveBeenCalledWith("u1", { usertag: "cineowl" });
  });

  // Expected offline timeout shows the save error but is not reported; any other failure is.
  it.each([
    ["a RequestTimeoutError", new RequestTimeoutError(), 0],
    ["another error", new Error("boom"), 1],
  ])("on %s from updateProfile, reports to Sentry %i time(s)", async (_label, error, reports) => {
    mockUseUsertagAvailability.mockReturnValue({ status: "available" });
    mockUpdateProfile.mockRejectedValue(error);
    await render(<EditProfile />);

    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Save" }));
      await flushMicrotasks();
    });

    expect(screen.getByText("Couldn't save. Check your connection and try again.")).toBeTruthy();
    expect(Sentry.captureException).toHaveBeenCalledTimes(reports);
  });

  // Photo pick/upload/cleanup logic itself is covered by
  // useAvatarUpload-test.tsx — this screen only wires the hook's returned
  // state and actions to the UI.
  it("shows the upload-error card when the hook reports an error", async () => {
    mockUseAvatarUpload.mockReturnValue({
      avatarUrl: null,
      photo: { state: "error" },
      isUploading: false,
      pickAndUpload: mockPickAndUpload,
      cancel: mockCancel,
    });
    await render(<EditProfile />);

    expect(
      screen.getByText("⚠ Photo upload failed. Your old photo is unchanged — tap the photo to try again."),
    ).toBeTruthy();
  });

  it("calls the hook's pickAndUpload when the photo is tapped", async () => {
    await render(<EditProfile />);

    fireEvent.press(screen.getByRole("button", { name: "Change photo" }));

    expect(mockPickAndUpload).toHaveBeenCalledTimes(1);
  });

  // Build 7 · Bug 1 (1): a photo upload and a usertag save are two
  // different network calls against the same row — the form must not let
  // one race the other.
  it("disables Save and the usertag field while a photo is uploading", async () => {
    mockUseUsertagAvailability.mockReturnValue({ status: "available" });
    mockUseAvatarUpload.mockReturnValue({
      avatarUrl: null,
      photo: { state: "uploading" },
      isUploading: true,
      pickAndUpload: mockPickAndUpload,
      cancel: mockCancel,
    });
    await render(<EditProfile />);

    expect(screen.getByRole("button", { name: "Save" }).props.accessibilityState?.disabled).toBe(
      true,
    );
    expect(screen.getByDisplayValue("cineowl").props.editable).toBe(false);
  });

  // Build 7 · Bug 1 (2): Cancel must still call the hook's cancel() even
  // mid-upload — that's what stops an in-flight upload's result from
  // applying after the screen is gone.
  it("calls the hook's cancel and navigates back when Cancel is pressed", async () => {
    await render(<EditProfile />);

    fireEvent.press(screen.getByRole("button", { name: "Cancel" }));

    expect(mockCancel).toHaveBeenCalledTimes(1);
    expect(mockRouterBack).toHaveBeenCalledTimes(1);
  });
});
