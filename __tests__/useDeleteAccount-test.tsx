import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";

const mockCalls: string[] = [];
const mockSameFrameInFlight: boolean[] = [];
const mockDeleteAccount = jest.fn();
jest.mock("@/modules/auth/api/deleteAccount", () => {
  class DeleteAccountOfflineError extends Error {}
  return {
    deleteAccount: () => {
      mockCalls.push("request");
      return mockDeleteAccount();
    },
    DeleteAccountOfflineError,
  };
});

const mockSignOut = jest.fn();
jest.mock("@/modules/auth/api/signOut", () => ({ signOut: () => mockSignOut() }));

const mockClearSession = jest.fn();
jest.mock("@/modules/auth/AuthProvider", () => ({
  useAuthSession: () => ({ session: null, isLoading: false, clearSession: () => mockClearSession() }),
}));

const mockMark = jest.fn();
const mockClear = jest.fn();
jest.mock("@/modules/auth/accountDeletedNotice", () => ({
  markAccountDeleted: () => mockMark(),
  clearAccountDeleted: () => mockClear(),
}));

const mockCaptureException = jest.fn();
jest.mock("@/lib/sentry", () => ({
  Sentry: { captureException: (...args: unknown[]) => mockCaptureException(...args) },
}));

import { DeleteAccountOfflineError } from "@/modules/auth/api/deleteAccount";
import { useDeleteAccount } from "@/modules/auth/hooks/useDeleteAccount";

/** Shows the hook's flags and exposes its action as buttons; rejections are swallowed so a test can assert on them. */
function Harness() {
  const { deleteAccount, isDeleting, failed, isInFlight } = useDeleteAccount();
  return (
    <>
      <Text testID="deleting">{String(isDeleting)}</Text>
      <Text testID="failed">{String(failed)}</Text>
      <Pressable
        onPress={() => {
          void deleteAccount().catch(() => {});
          mockSameFrameInFlight.push(isInFlight());
        }}
        accessibilityRole="button"
        accessibilityLabel="go-check"
      />
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
    mockCalls.length = 0;
    mockDeleteAccount.mockReset();
    mockSignOut.mockReset().mockImplementation(async () => void mockCalls.push("signOut"));
    mockClearSession.mockReset().mockImplementation(() => void mockCalls.push("clearSession"));
    mockMark.mockReset().mockImplementation(() => void mockCalls.push("mark"));
    mockCaptureException.mockReset();
    mockClear.mockReset();
    mockSameFrameInFlight.length = 0;
  });

  it("on success marks the notice, signs out everywhere, then clears the session (in that order)", async () => {
    let finish: () => void = () => {};
    mockDeleteAccount.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    await render(<Harness />);

    await tap("go");
    expect(flag("deleting")).toBe("true");
    expect(mockClearSession).not.toHaveBeenCalled();

    await act(async () => finish());
    expect(mockCalls).toEqual(["mark", "request", "signOut", "clearSession"]);
    expect(mockClear).not.toHaveBeenCalled();
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
    // Marked before the request, so a failure must withdraw it.
    expect(mockMark).toHaveBeenCalledTimes(1);
    expect(mockClear).toHaveBeenCalledTimes(1);

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
    expect(mockClear).toHaveBeenCalledTimes(1);
  });

  it("marks the notice before the request is sent", async () => {
    mockDeleteAccount.mockResolvedValue(undefined);
    await render(<Harness />);
    await tap("go");
    expect(mockCalls.indexOf("mark")).toBeLessThan(mockCalls.indexOf("request"));
  });

  it("reports in flight in the same frame as the tap, before isDeleting re-renders", async () => {
    mockDeleteAccount.mockReturnValue(new Promise<void>(() => {}));
    await render(<Harness />);
    await tap("go-check");
    expect(mockSameFrameInFlight).toEqual([true]);
  });

  it("still clears the session when the sign-out step throws", async () => {
    mockDeleteAccount.mockResolvedValue(undefined);
    mockSignOut.mockRejectedValue(new Error("google"));
    await render(<Harness />);

    await tap("go");
    expect(mockClearSession).toHaveBeenCalledTimes(1);
  });

  // React 19 no longer warns about state updates after unmount, so record the setter calls instead.
  let stateSpy: jest.SpyInstance | undefined;
  afterEach(() => stateSpy?.mockRestore());

  const spyOnStateSetters = () => {
    const state = { unmounted: false, late: 0 };
    const original = React.useState;
    stateSpy = jest.spyOn(React, "useState");
    stateSpy.mockImplementation(((initial: unknown) => {
      const [value, set] = original(initial);
      return [
        value,
        (next: unknown) => {
          if (state.unmounted) state.late++;
          return (set as (v: unknown) => void)(next);
        },
      ];
    }) as typeof React.useState);
    return state;
  };

  it("sets no state when it unmounts mid-delete and the call then fails", async () => {
    const state = spyOnStateSetters();
    let fail: (e: Error) => void = () => {};
    mockDeleteAccount.mockReturnValue(new Promise<void>((_, reject) => (fail = reject)));
    const view = await render(<Harness />);

    await tap("go");
    await view.unmount();
    state.unmounted = true;
    await act(async () => fail(new DeleteAccountOfflineError()));

    expect(state.late).toBe(0);
    expect(mockClearSession).not.toHaveBeenCalled();
    expect(mockClear).toHaveBeenCalledTimes(1);
  });

  it("still marks, signs out and clears the session when it unmounts mid-delete and the call then succeeds", async () => {
    const state = spyOnStateSetters();
    let finish: () => void = () => {};
    mockDeleteAccount.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    const view = await render(<Harness />);

    await tap("go");
    await view.unmount();
    state.unmounted = true;
    await act(async () => finish());

    expect(mockCalls).toEqual(["mark", "request", "signOut", "clearSession"]);
    expect(state.late).toBe(0);
  });
});
