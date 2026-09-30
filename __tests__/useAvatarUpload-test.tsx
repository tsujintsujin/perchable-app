import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";

const mockPickAvatar = jest.fn();
const mockUploadAvatar = jest.fn();
const mockUpdateProfile = jest.fn();
const mockDeleteAvatarObject = jest.fn();

jest.mock("@/modules/profile/pickAvatar", () => ({
  pickAvatar: (...args: unknown[]) => mockPickAvatar(...args),
}));
jest.mock("@/modules/profile/api/uploadAvatar", () => ({
  uploadAvatar: (...args: unknown[]) => mockUploadAvatar(...args),
}));
jest.mock("@/modules/profile/api/updateProfile", () => ({
  updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
}));
jest.mock("@/modules/profile/api/deleteAvatarObject", () => ({
  deleteAvatarObject: (...args: unknown[]) => mockDeleteAvatarObject(...args),
}));
jest.mock("@/lib/sentry", () => ({ Sentry: { captureException: jest.fn() } }));

import { useAvatarUpload } from "@/modules/profile/hooks/useAvatarUpload";

/** Renders the hook's state as plain text and exposes its actions as
 * buttons — no hook-testing library is set up in this project, so a tiny
 * harness component stands in for one (same pattern as useOwnProfile-test.tsx). */
function Harness({ initialAvatarUrl }: { initialAvatarUrl: string | null }) {
  const upload = useAvatarUpload("u1", initialAvatarUrl);
  return (
    <>
      <Text testID="state">{JSON.stringify({ avatarUrl: upload.avatarUrl, photo: upload.photo })}</Text>
      <Pressable onPress={upload.pickAndUpload} accessibilityRole="button" accessibilityLabel="pick" />
      <Pressable onPress={upload.cancel} accessibilityRole="button" accessibilityLabel="cancel" />
    </>
  );
}

describe("useAvatarUpload", () => {
  beforeEach(() => {
    mockPickAvatar.mockReset();
    mockUploadAvatar.mockReset();
    mockUpdateProfile.mockReset().mockResolvedValue(undefined);
    mockDeleteAvatarObject.mockReset().mockResolvedValue(undefined);
  });

  it("shows an error state when the upload fails", async () => {
    mockPickAvatar.mockResolvedValue({ uri: "file:///fake.jpg" });
    mockUploadAvatar.mockRejectedValue(new Error("network down"));
    await render(<Harness initialAvatarUrl={null} />);

    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "pick" }));
    });

    await waitFor(() => expect(screen.getByTestId("state").props.children).toContain('"error"'));
  });

  // Build 7 · Bug 1b: a successful photo replace must clean up the object
  // it just superseded — otherwise every photo change leaks one orphaned
  // Storage object forever.
  it("deletes the previous avatar object after a successful photo replace", async () => {
    mockPickAvatar.mockResolvedValue({ uri: "file:///fake.jpg" });
    mockUploadAvatar.mockResolvedValue("https://cdn.example/avatars/u1/avatar-new.jpg");
    await render(<Harness initialAvatarUrl="https://cdn.example/avatars/u1/avatar-old.jpg" />);

    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "pick" }));
    });

    await waitFor(() =>
      expect(mockDeleteAvatarObject).toHaveBeenCalledWith(
        "u1",
        "https://cdn.example/avatars/u1/avatar-old.jpg",
      ),
    );
  });

  // Build 7 · Bug 1 (2) + 1b: cancel mid-upload must not let the
  // (un-abortable) upload's result reach `updateProfile`, and must clean up
  // the now-unreferenced object it already uploaded to Storage.
  it("does not save and deletes the uploaded object when cancelled mid-upload", async () => {
    mockPickAvatar.mockResolvedValue({ uri: "file:///fake.jpg" });
    let resolveUpload: (url: string) => void = () => {};
    mockUploadAvatar.mockReturnValue(
      new Promise<string>((resolve) => {
        resolveUpload = resolve;
      }),
    );
    await render(<Harness initialAvatarUrl={null} />);

    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "pick" }));
    });
    await waitFor(() => expect(mockUploadAvatar).toHaveBeenCalled());

    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "cancel" }));
    });

    await act(async () => {
      resolveUpload("https://cdn.example/avatars/u1/avatar-cancelled.jpg");
    });

    expect(mockUpdateProfile).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(mockDeleteAvatarObject).toHaveBeenCalledWith(
        "u1",
        "https://cdn.example/avatars/u1/avatar-cancelled.jpg",
      ),
    );
    expect(mockDeleteAvatarObject).toHaveBeenCalledTimes(1);
  });
});
