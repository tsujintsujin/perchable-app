import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

/** Flushes pending microtasks so an async handler's state update lands
 * inside `act`'s scope instead of after it returns (same pattern as
 * sign-in-test.tsx's Build 5 · Bug 1 fix). */
const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

const mockUseOwnProfile = jest.fn();
const mockUseUsertagAvailability = jest.fn();
const mockPickAvatar = jest.fn();
const mockUploadAvatar = jest.fn();
const mockUpdateProfile = jest.fn();

jest.mock("@/modules/profile", () => ({
  useOwnProfile: () => mockUseOwnProfile(),
  useUsertagAvailability: (...args: unknown[]) => mockUseUsertagAvailability(...args),
  pickAvatar: (...args: unknown[]) => mockPickAvatar(...args),
  uploadAvatar: (...args: unknown[]) => mockUploadAvatar(...args),
  updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
}));

jest.mock("@/lib/sentry", () => ({ Sentry: { captureException: jest.fn() } }));

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
    mockUploadAvatar.mockResolvedValue("https://cdn.example/avatars/u1/avatar.jpg?v=1");
    await render(<EditProfile />);

    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Change photo" }));
      await flushMicrotasks();
    });

    expect(mockUpdateProfile).toHaveBeenCalledWith("u1", {
      avatarUrl: "https://cdn.example/avatars/u1/avatar.jpg?v=1",
    });
  });
});
