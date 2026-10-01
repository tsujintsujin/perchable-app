import { AccessibilityInfo } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

// Host nodes have no native handle under the test renderer; a fixed one lets the focus call be observed.
jest.mock("react-native/Libraries/ReactNative/RendererProxy", () => ({
  ...jest.requireActual("react-native/Libraries/ReactNative/RendererProxy"),
  findNodeHandle: () => 42,
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

let mockSession: { user: { id: string } } | null = { user: { id: "me" } };
jest.mock("@/modules/auth", () => ({ useAuthSession: () => ({ session: mockSession }) }));

const mockBlock = jest.fn();
jest.mock("@/modules/moderation/api/blockUser", () => ({
  blockUser: (...args: unknown[]) => mockBlock(...args),
}));

const mockCapture = jest.fn();
jest.mock("@/lib/sentry", () => ({ Sentry: { captureException: (...args: unknown[]) => mockCapture(...args) } }));

import { BlockUserSheet } from "@/modules/moderation/components/BlockUserSheet";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const blockButton = () => screen.getByRole("button", { name: /^(Block|Try again)$/ });

describe("BlockUserSheet", () => {
  const onClose = jest.fn();
  const onBlocked = jest.fn();
  const show = (props: { userId?: string; displayName?: string } = {}) =>
    render(<BlockUserSheet userId="u2" displayName="Maya Lim" onClose={onClose} onBlocked={onBlocked} {...props} />);

  beforeEach(() => {
    onClose.mockReset();
    onBlocked.mockReset();
    mockBlock.mockReset().mockResolvedValue(undefined);
    mockCapture.mockReset();
    mockSession = { user: { id: "me" } };
  });

  it("shows the verbatim confirm copy with the display name", async () => {
    await show();
    expect(screen.getByText("Block Maya Lim?")).toBeTruthy();
    expect(screen.getByText("Blocking tells Perchable you don't want to interact with Maya Lim.")).toBeTruthy();
    expect(screen.getByText("We won't tell them. You can undo this any time in Settings › Blocked users.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
    expect(blockButton()).toBeEnabled();
  });

  it("falls back to 'this user' when there is no display name", async () => {
    await show({ displayName: undefined });
    expect(screen.getByText("Block this user?")).toBeTruthy();
    expect(screen.getByText("Blocking tells Perchable you don't want to interact with this user.")).toBeTruthy();
  });

  it("Block writes the block as the signed-in user and lands on the blocked state; Done closes", async () => {
    await show();
    await act(async () => void fireEvent.press(blockButton()));
    expect(mockBlock).toHaveBeenCalledWith("me", "u2");
    expect(screen.getByText("Maya Lim is blocked")).toBeTruthy();
    expect(screen.getByText("You can undo this any time in Settings › Blocked users.")).toBeTruthy();
    expect(onBlocked).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => void fireEvent.press(screen.getByRole("button", { name: "Done" })));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("an already-blocked user (23505) lands on the blocked state without Sentry", async () => {
    mockBlock.mockRejectedValue({ code: "23505", message: "duplicate" });
    await show();
    await act(async () => void fireEvent.press(blockButton()));
    expect(screen.getByText("Maya Lim is blocked")).toBeTruthy();
    expect(onBlocked).toHaveBeenCalledTimes(1);
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it("while blocking: Blocking…, Cancel disabled, scrim and back do nothing, double tap sends one request", async () => {
    const pending = deferred();
    mockBlock.mockReturnValue(pending.promise);
    await show();
    await act(async () => void fireEvent.press(blockButton()));

    expect(screen.getByText("Blocking…")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.queryByLabelText("Close", { includeHiddenElements: true })).toBeNull();
    await act(async () => void screen.getByTestId("block-sheet").props.onRequestClose());
    await act(async () => void fireEvent.press(screen.getByText("Blocking…")));
    expect(onClose).not.toHaveBeenCalled();
    expect(mockBlock).toHaveBeenCalledTimes(1);

    await act(async () => void pending.resolve());
    expect(screen.getByText("Maya Lim is blocked")).toBeTruthy();
  });

  it("a dismiss fired in the same act as the Block press (before any re-render) does not close the sheet", async () => {
    const pending = deferred();
    mockBlock.mockReturnValue(pending.promise);
    await show();
    const requestClose = screen.getByTestId("block-sheet").props.onRequestClose;
    await act(async () => {
      fireEvent.press(blockButton());
      requestClose();
    });
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => void pending.resolve());
  });

  it("moves screen-reader focus to the success title when the sheet flips to blocked", async () => {
    const focus = jest.spyOn(AccessibilityInfo, "setAccessibilityFocus").mockImplementation(() => {});
    await show();
    focus.mockClear();
    await act(async () => void fireEvent.press(blockButton()));
    expect(screen.getByText("Maya Lim is blocked")).toBeTruthy();
    expect(focus).toHaveBeenCalledWith(42);
    focus.mockRestore();
  });

  it("a failure shows the error card, Try again and an enabled Cancel; retry succeeds", async () => {
    mockBlock.mockRejectedValueOnce({ code: "42501", message: "denied" });
    await show();
    await act(async () => void fireEvent.press(blockButton()));

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("⚠ Couldn't block Maya Lim. Check your connection and try again.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
    expect(mockCapture).toHaveBeenCalledTimes(1);
    expect(mockCapture.mock.calls[0][0].message).toBe("blockUser failed: 42501");

    await act(async () => void fireEvent.press(blockButton()));
    expect(screen.getByText("Maya Lim is blocked")).toBeTruthy();
  });

  it("23503 (user no longer exists) is an error state, not a crash", async () => {
    mockBlock.mockRejectedValue({ code: "23503", message: "fk" });
    await show();
    await act(async () => void fireEvent.press(blockButton()));
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(mockCapture).toHaveBeenCalledTimes(1);
  });

  it("an offline failure shows the error card without Sentry", async () => {
    mockBlock.mockRejectedValue(new TypeError("Network request failed"));
    await show();
    await act(async () => void fireEvent.press(blockButton()));
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it("refuses to block yourself: no request, error card", async () => {
    await show({ userId: "me" });
    await act(async () => void fireEvent.press(blockButton()));
    expect(mockBlock).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it("Cancel, scrim and back close the sheet when idle", async () => {
    await show();
    await act(async () => void fireEvent.press(screen.getByRole("button", { name: "Cancel" })));
    await act(async () => void fireEvent.press(screen.getByLabelText("Close", { includeHiddenElements: true })));
    await act(async () => void screen.getByTestId("block-sheet").props.onRequestClose());
    expect(onClose).toHaveBeenCalledTimes(3);
    expect(mockBlock).not.toHaveBeenCalled();
  });

  it("unmounting mid-request applies nothing and never calls onBlocked", async () => {
    const pending = deferred();
    mockBlock.mockReturnValue(pending.promise);
    const view = await show();
    await act(async () => void fireEvent.press(blockButton()));
    await view.unmount();
    await act(async () => void pending.resolve());
    expect(onBlocked).not.toHaveBeenCalled();
  });
});
