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
const mockPickAvatar = jest.fn();
const mockUploadAvatar = jest.fn();
const mockUpdateProfile = jest.fn();
const mockDeleteAvatarObject = jest.fn();

jest.mock("@/modules/profile", () => ({
  useOwnProfile: () => mockUseOwnProfile(),
  useUsertagAvailability: (...args: unknown[]) => mockUseUsertagAvailability(...args),
  pickAvatar: (...args: unknown[]) => mockPickAvatar(...args),
  uploadAvatar: (...args: unknown[]) => mockUploadAvatar(...args),
  updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
  deleteAvatarObject: (...args: unknown[]) => mockDeleteAvatarObject(...args),
}));

jest.mock("@/lib/sentry", () => ({ Sentry: { captureException: jest.fn() } }));

// Build 7 · Bug 1: the real `router.back()` reads expo-router's global
// navigation store, which only gets initialized by a real Stack/root
// layout mounting — not present when unit-rendering a leaf screen like
// this one in isolation. An earlier test in this file happened to pass by
// relying on that store being left "ready" from some other render; mocking
// it here makes every test's use of `router.back()` correct on its own
// terms instead of by test-order accident.
const mockRouterBack = jest.fn();
jest.mock("expo-router", () => ({ router: { back: (...args: unknown[]) => mockRouterBack(...args) } }));

import EditProfile from "@/app/(tabs)/profile/edit";

const PROFILE = {
  id: "u1",
  displayName: "Justin Masiga",
  avatarUrl: null,
  usertag: "cineowl",
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
};

describe("Edit profile screen", () => {
  beforeEach(() => {
    mockUseOwnProfile.mockReturnValue({ state: "loaded", refetch: jest.fn(), profile: PROFILE });
    mockUseUsertagAvailability.mockReturnValue({ status: "unchanged" });
    mockPickAvatar.mockReset();
    mockUploadAvatar.mockReset();
    mockUpdateProfile.mockReset().mockResolvedValue(undefined);
    mockDeleteAvatarObject.mockReset().mockResolvedValue(undefined);
    mockRouterBack.mockReset();
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

  it("shows the upload-error card when the photo upload fails", async () => {
    mockPickAvatar.mockResolvedValue({ uri: "file:///fake.jpg" });
    mockUploadAvatar.mockRejectedValue(new Error("network down"));
    await render(<EditProfile />);

    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Change photo" }));
      await flushMicrotasks();
    });

    expect(
      screen.getByText("⚠ Photo upload failed. Your old photo is unchanged — tap the photo to try again."),
    ).toBeTruthy();
  });

  it("uploads and saves a new photo immediately on pick, independent of Save", async () => {
    mockPickAvatar.mockResolvedValue({ uri: "file:///fake.jpg" });
    mockUploadAvatar.mockResolvedValue("https://cdn.example/avatars/u1/avatar-1.jpg");
    await render(<EditProfile />);

    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Change photo" }));
      await flushMicrotasks();
    });

    expect(mockUpdateProfile).toHaveBeenCalledWith("u1", {
      avatarUrl: "https://cdn.example/avatars/u1/avatar-1.jpg",
    });
  });

  // Build 7 · Bug 1 (1): a photo upload and a usertag save are two
  // different network calls against the same row — the form must not let
  // one race the other. Holds `uploadAvatar`'s promise open so the
  // uploading state is observable before it resolves.
  it("disables Save and the usertag field while a photo is uploading", async () => {
    mockUseUsertagAvailability.mockReturnValue({ status: "available" });
    mockPickAvatar.mockResolvedValue({ uri: "file:///fake.jpg" });
    let resolveUpload: (url: string) => void = () => {};
    mockUploadAvatar.mockReturnValue(
      new Promise<string>((resolve) => {
        resolveUpload = resolve;
      }),
    );
    await render(<EditProfile />);

    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Change photo" }));
      await flushMicrotasks();
    });

    expect(screen.getByRole("button", { name: "Save" }).props.accessibilityState?.disabled).toBe(
      true,
    );
    expect(screen.getByDisplayValue("cineowl").props.editable).toBe(false);

    // Let the held-open upload resolve so the test doesn't leak a pending
    // timer/promise into the next one.
    await act(async () => {
      resolveUpload("https://cdn.example/avatars/u1/avatar-1.jpg");
      await flushMicrotasks();
    });
  });

  // Build 7 · Bug 1 (2): tapping Cancel while a photo is mid-upload must
  // not let the (un-abortable) upload's result reach `updateProfile` —
  // that call is what would make the cancelled photo visible.
  it("cancel mid-upload does not call updateProfile with the cancelled photo", async () => {
    mockPickAvatar.mockResolvedValue({ uri: "file:///fake.jpg" });
    let resolveUpload: (url: string) => void = () => {};
    mockUploadAvatar.mockReturnValue(
      new Promise<string>((resolve) => {
        resolveUpload = resolve;
      }),
    );
    await render(<EditProfile />);

    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Change photo" }));
      await flushMicrotasks();
    });

    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
      await flushMicrotasks();
    });

    await act(async () => {
      resolveUpload("https://cdn.example/avatars/u1/avatar-cancelled.jpg");
      await flushMicrotasks();
    });

    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  // Build 7 · Bug 1b: a successful photo replace must clean up the object
  // it just superseded — otherwise every photo change leaks one orphaned
  // Storage object forever.
  it("deletes the previous avatar object after a successful photo replace", async () => {
    mockUseOwnProfile.mockReturnValue({
      state: "loaded",
      refetch: jest.fn(),
      profile: { ...PROFILE, avatarUrl: "https://cdn.example/avatars/u1/avatar-old.jpg" },
    });
    mockPickAvatar.mockResolvedValue({ uri: "file:///fake.jpg" });
    mockUploadAvatar.mockResolvedValue("https://cdn.example/avatars/u1/avatar-new.jpg");
    await render(<EditProfile />);

    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Change photo" }));
      await flushMicrotasks();
    });

    expect(mockDeleteAvatarObject).toHaveBeenCalledWith(
      "u1",
      "https://cdn.example/avatars/u1/avatar-old.jpg",
    );
  });

  // Build 7 · Bug 1b: cancel can land after the (un-abortable) upload has
  // already finished but before the commit check — the just-uploaded,
  // now-unreferenced object must be cleaned up there, not left behind.
  it("deletes the just-uploaded object when cancelled after the upload finished", async () => {
    mockPickAvatar.mockResolvedValue({ uri: "file:///fake.jpg" });
    let resolveUpload: (url: string) => void = () => {};
    mockUploadAvatar.mockReturnValue(
      new Promise<string>((resolve) => {
        resolveUpload = resolve;
      }),
    );
    await render(<EditProfile />);

    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Change photo" }));
      await flushMicrotasks();
    });

    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
      await flushMicrotasks();
    });

    // The upload resolves after the screen is already gone — the promise
    // chain keeps running regardless, it just checks cancelledRef instead
    // of touching state.
    await act(async () => {
      resolveUpload("https://cdn.example/avatars/u1/avatar-cancelled.jpg");
      await flushMicrotasks();
    });

    expect(mockDeleteAvatarObject).toHaveBeenCalledWith(
      "u1",
      "https://cdn.example/avatars/u1/avatar-cancelled.jpg",
    );
    // Not the profile's original (null) avatar — only the cancelled upload
    // itself should ever be targeted here.
    expect(mockDeleteAvatarObject).toHaveBeenCalledTimes(1);
  });
});
