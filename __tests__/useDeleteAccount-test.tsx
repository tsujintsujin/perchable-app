import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";

const mockDeleteAccount = jest.fn();
jest.mock("@/modules/auth/api/deleteAccount", () => {
  class DeleteAccountOfflineError extends Error {}
  return { deleteAccount: () => mockDeleteAccount(), DeleteAccountOfflineError };
});

const calls: string[] = [];
const mockSignOut = jest.fn();
jest.mock("@/modules/auth/api/signOut", () => ({ signOut: () => mockSignOut() }));

const mockClearSession = jest.fn();
jest.mock("@/modules/auth/AuthProvider", () => ({
  useAuthSession: () => ({ session: null, isLoading: false, clearSession: () => mockClearSession() }),
}));

const mockMark = jest.fn();
jest.mock("@/modules/auth/accountDeletedNotice", () => ({ markAccountDeleted: () => mockMark() }));

const mockCaptureException = jest.fn();
jest.mock("@/lib/sentry", () => ({
  Sentry: { captureException: (...args: unknown[]) => mockCaptureException(...args) },
}));

import { DeleteAccountOfflineError } from "@/modules/auth/api/deleteAccount";
import { useDeleteAccount } from "@/modules/auth/hooks/useDeleteAccount";

/** Shows the hook's flags and exposes its action as buttons; rejections are swallowed so a test can assert on them. */
function Harness() {
  const { deleteAccount, isDeleting, failed } = useDeleteAccount();
  return (
    <>
      <Text testID="deleting">{String(isDeleting)}</Text>
      <Text testID="failed">{String(failed)}</Text>
      <Pressable
        onPress={() => void deleteAccount().catch(() => {})}
        accessibilityRole="button"
        accessibilityLabel="go"
      />
      <Pressable
        onPress={() => {
          void deleteAccount().catch(() => {});
          void deleteAccount().catch(() => {});
        }}
        accessibilityRole="button"
        accessibilityLabel="go-twice"
      />
    </>
  );
}

const flag = (id: string) => screen.getByTestId(id).props.children;
const tap = (label: string) =>
  act(async () => {
    fireEvent.press(screen.getByLabelText(label));
  });

describe("useDeleteAccount", () => {
  beforeEach(() => {
    calls.length = 0;
    mockDeleteAccount.mockReset();
    mockSignOut.mockReset().mockImplementation(async () => void calls.push("signOut"));
    mockClearSession.mockReset().mockImplementation(() => void calls.push("clearSession"));
    mockMark.mockReset().mockImplementation(() => void calls.push("mark"));
    mockCaptureException.mockReset();
  });

  it("on success marks the notice, signs out everywhere, then clears the session (in that order)", async () => {
    let finish: () => void = () => {};
    mockDeleteAccount.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    await render(<Harness />);

    await tap("go");
    expect(flag("deleting")).toBe("true");
    expect(mockClearSession).not.toHaveBeenCalled();

    await act(async () => finish());
    expect(calls).toEqual(["mark", "signOut", "clearSession"]);
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it("makes one server call for two taps in the same frame", async () => {
    mockDeleteAccount.mockResolvedValue(undefined);
    await render(<Harness />);
    await tap("go-twice");
    expect(mockDeleteAccount).toHaveBeenCalledTimes(1);
  });

  it("returns to the confirm state on an offline failure without reporting it, and a retry works", async () => {
    mockDeleteAccount.mockRejectedValueOnce(new DeleteAccountOfflineError());
    await render(<Harness />);

    await tap("go");
    expect(flag("deleting")).toBe("false");
    expect(flag("failed")).toBe("true");
    expect(mockCaptureException).not.toHaveBeenCalled();
    expect(mockClearSession).not.toHaveBeenCalled();
    expect(mockMark).not.toHaveBeenCalled();

    mockDeleteAccount.mockResolvedValueOnce(undefined);
    await tap("go");
    expect(flag("failed")).toBe("false");
    expect(mockDeleteAccount).toHaveBeenCalledTimes(2);
    expect(mockClearSession).toHaveBeenCalledTimes(1);
  });

  it("reports an unexpected failure to Sentry and stays signed in", async () => {
    const serverError = new Error("500");
    mockDeleteAccount.mockRejectedValue(serverError);
    await render(<Harness />);

    await tap("go");
    expect(mockCaptureException).toHaveBeenCalledWith(serverError);
    expect(flag("failed")).toBe("true");
    expect(mockClearSession).not.toHaveBeenCalled();
  });

  it("still clears the session when the sign-out step throws", async () => {
    mockDeleteAccount.mockResolvedValue(undefined);
    mockSignOut.mockRejectedValue(new Error("google"));
    await render(<Harness />);

    await tap("go");
    expect(mockClearSession).toHaveBeenCalledTimes(1);
  });

  it("sets no state when it unmounts mid-delete and the call then fails", async () => {
    let fail: (e: Error) => void = () => {};
    mockDeleteAccount.mockReturnValue(new Promise<void>((_, reject) => (fail = reject)));
    const view = await render(<Harness />);

    await tap("go");
    await view.unmount();
    await act(async () => fail(new DeleteAccountOfflineError()));

    expect(mockClearSession).not.toHaveBeenCalled();
  });
});
