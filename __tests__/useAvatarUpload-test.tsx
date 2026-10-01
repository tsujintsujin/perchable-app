import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";

const mockPickAvatar = jest.fn();
const mockPrepareAvatar = jest.fn();
const mockUploadAvatar = jest.fn();
const mockUpdateProfile = jest.fn();
const mockDeleteAvatarObject = jest.fn();

jest.mock("@/modules/profile/pickAvatar", () => ({
  pickAvatarAsset: (...args: unknown[]) => mockPickAvatar(...args),
  prepareAvatar: (...args: unknown[]) => mockPrepareAvatar(...args),
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
jest.mock("@/lib/supabase", () => ({ supabase: {} }));

import { useAvatarUpload } from "@/modules/profile/hooks/useAvatarUpload";
import { Sentry } from "@/lib/sentry";
import { RequestTimeoutError } from "@/lib/requestTimeout";

/** Renders the hook's state as plain text and exposes its actions as
 * buttons — no hook-testing library is set up in this project, so a tiny
 * harness component stands in for one (same pattern as useOwnProfile-test.tsx). */
function Harness({ initialAvatarUrl }: { initialAvatarUrl: string | null }) {
  const upload = useAvatarUpload("u1", initialAvatarUrl);
  return (
    <>
      <Text testID="state">{JSON.stringify({ avatarUrl: upload.avatarUrl, photo: upload.photo })}</Text>
      <Pressable onPress={upload.pickAndUpload} accessibilityRole="button" accessibilityLabel="pick" />
      <Pressable
        onPress={() => {
          void upload.pickAndUpload();
          void upload.pickAndUpload();
        }}
        accessibilityRole="button"
        accessibilityLabel="pick-twice"
      />
      <Pressable onPress={upload.cancel} accessibilityRole="button" accessibilityLabel="cancel" />
    </>
  );
}

describe("useAvatarUpload", () => {
  beforeEach(() => {
    mockPickAvatar.mockReset();
    mockPrepareAvatar.mockReset().mockImplementation(async (uri: string) => ({ uri }));
    mockUploadAvatar.mockReset();
    mockUpdateProfile.mockReset().mockResolvedValue(undefined);
    mockDeleteAvatarObject.mockReset().mockResolvedValue(undefined);
    (Sentry.captureException as jest.Mock).mockClear();
  });

  // Expected offline timeout shows the error state but is not reported; any other failure is.
  it.each([
    ["a RequestTimeoutError", new RequestTimeoutError(), 0],
    ["another error", new Error("boom"), 1],
  ])("on %s from the upload, reports to Sentry %i time(s)", async (_label, error, reports) => {
    mockPickAvatar.mockResolvedValue({ uri: "file:///fake.jpg" });
    mockUploadAvatar.mockRejectedValue(error);
    await render(<Harness initialAvatarUrl={null} />);

    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "pick" }));
    });

    await waitFor(() => expect(screen.getByTestId("state").props.children).toContain('"error"'));
    expect(Sentry.captureException).toHaveBeenCalledTimes(reports);
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

  // A photo picked then Save tapped during the resize must not be dropped.
  it("is uploading while the resize is pending", async () => {
    mockPickAvatar.mockResolvedValue({ uri: "file:///fake.jpg" });
    let finishResize: (r: { uri: string }) => void = () => {};
    mockPrepareAvatar.mockReturnValue(new Promise((resolve) => (finishResize = resolve)));
    mockUploadAvatar.mockResolvedValue("https://cdn.example/avatars/u1/avatar-new.jpg");
    await render(<Harness initialAvatarUrl={null} />);

    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "pick" }));
    });
    await waitFor(() => expect(screen.getByTestId("state").props.children).toContain('"uploading"'));
    expect(mockUploadAvatar).not.toHaveBeenCalled();

    await act(async () => finishResize({ uri: "file:///small.jpg" }));
    await waitFor(() => expect(mockUploadAvatar).toHaveBeenCalledWith("u1", "file:///small.jpg"));
  });

  it("shows an error state when the resize fails", async () => {
    mockPickAvatar.mockResolvedValue({ uri: "file:///fake.jpg" });
    mockPrepareAvatar.mockRejectedValue(new Error("resize failed"));
    await render(<Harness initialAvatarUrl={null} />);

    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "pick" }));
    });

    await waitFor(() => expect(screen.getByTestId("state").props.children).toContain('"error"'));
    expect(mockUploadAvatar).not.toHaveBeenCalled();
  });

  it("stays idle when the picker is cancelled", async () => {
    mockPickAvatar.mockResolvedValue(null);
    await render(<Harness initialAvatarUrl={null} />);

    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "pick" }));
    });

    expect(screen.getByTestId("state").props.children).toContain('"idle"');
    expect(mockPrepareAvatar).not.toHaveBeenCalled();
  });

  // Busy must start before the picker opens so Save is disabled in the gap
  // between the crop closing and the picker promise resolving.
  it("is uploading while the picker promise is pending, and idle again after a picker cancel", async () => {
    let resolvePick: (v: { uri: string } | null) => void = () => {};
    mockPickAvatar.mockReturnValue(new Promise((resolve) => (resolvePick = resolve)));
    await render(<Harness initialAvatarUrl={null} />);

    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "pick" }));
    });
    expect(screen.getByTestId("state").props.children).toContain('"uploading"');

    await act(async () => resolvePick(null));
    expect(screen.getByTestId("state").props.children).toContain('"idle"');
    expect(mockUploadAvatar).not.toHaveBeenCalled();
  });

  it("shows an error state when the picker throws", async () => {
    mockPickAvatar.mockRejectedValue(new Error("picker failed"));
    await render(<Harness initialAvatarUrl={null} />);

    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "pick" }));
    });

    await waitFor(() => expect(screen.getByTestId("state").props.children).toContain('"error"'));
  });

  it("never uploads when cancelled while the resize is pending", async () => {
    mockPickAvatar.mockResolvedValue({ uri: "file:///fake.jpg" });
    let finishResize: (r: { uri: string }) => void = () => {};
    mockPrepareAvatar.mockReturnValue(new Promise((resolve) => (finishResize = resolve)));
    await render(<Harness initialAvatarUrl={null} />);

    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "pick" }));
    });
    await waitFor(() => expect(mockPrepareAvatar).toHaveBeenCalled());
    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "cancel" }));
    });
    await act(async () => finishResize({ uri: "file:///small.jpg" }));

    expect(mockUploadAvatar).not.toHaveBeenCalled();
    expect(screen.getByTestId("state").props.children).toContain('"idle"');
  });

  // Once updateProfile has committed, the previous object is superseded even if the screen was cancelled.
  it("still deletes the previous object when cancelled while updateProfile is pending", async () => {
    mockPickAvatar.mockResolvedValue({ uri: "file:///fake.jpg" });
    mockUploadAvatar.mockResolvedValue("https://cdn.example/avatars/u1/avatar-new.jpg");
    let finishUpdate: () => void = () => {};
    mockUpdateProfile.mockReturnValue(new Promise<void>((resolve) => (finishUpdate = resolve)));
    await render(<Harness initialAvatarUrl="https://cdn.example/avatars/u1/avatar-old.jpg" />);

    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "pick" }));
    });
    await waitFor(() => expect(mockUpdateProfile).toHaveBeenCalled());
    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "cancel" }));
    });
    await act(async () => finishUpdate());

    expect(mockDeleteAvatarObject).toHaveBeenCalledWith(
      "u1",
      "https://cdn.example/avatars/u1/avatar-old.jpg",
    );
    expect(screen.getByTestId("state").props.children).toContain("avatar-old.jpg");
    expect(screen.getByTestId("state").props.children).toContain('"idle"');
  });

  it("opens the picker once when pickAndUpload is called twice in one render", async () => {
    mockPickAvatar.mockReturnValue(new Promise(() => {}));
    await render(<Harness initialAvatarUrl={null} />);

    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "pick-twice" }));
    });

    expect(mockPickAvatar).toHaveBeenCalledTimes(1);
  });

  it("deletes the landed object and does not save when unmounted mid-upload", async () => {
    mockPickAvatar.mockResolvedValue({ uri: "file:///fake.jpg" });
    let resolveUpload: (url: string) => void = () => {};
    mockUploadAvatar.mockReturnValue(new Promise<string>((resolve) => (resolveUpload = resolve)));
    const view = await render(<Harness initialAvatarUrl={null} />);

    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "pick" }));
    });
    await waitFor(() => expect(mockUploadAvatar).toHaveBeenCalled());
    await view.unmount();
    await act(async () => resolveUpload("https://cdn.example/avatars/u1/avatar-unmounted.jpg"));

    expect(mockUpdateProfile).not.toHaveBeenCalled();
    expect(mockDeleteAvatarObject).toHaveBeenCalledWith(
      "u1",
      "https://cdn.example/avatars/u1/avatar-unmounted.jpg",
    );
  });
});
