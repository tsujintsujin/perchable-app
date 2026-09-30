import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";

const mockSignOut = jest.fn();
jest.mock("@/modules/auth/api/signOut", () => ({ signOut: () => mockSignOut() }));

const mockClearSession = jest.fn();
jest.mock("@/modules/auth/AuthProvider", () => ({
  useAuthSession: () => ({ session: null, isLoading: false, clearSession: mockClearSession }),
}));

import { useSignOut } from "@/modules/auth/hooks/useSignOut";

/** Shows the hook's busy flag and exposes its action as a button (same harness pattern as the other hook tests). */
function Harness() {
  const { signOut, isSigningOut } = useSignOut();
  return (
    <>
      <Text testID="busy">{String(isSigningOut)}</Text>
      <Pressable onPress={signOut} accessibilityRole="button" accessibilityLabel="out" />
      <Pressable
        onPress={() => {
          void signOut();
          void signOut();
        }}
        accessibilityRole="button"
        accessibilityLabel="out-twice"
      />
    </>
  );
}

const busy = () => screen.getByTestId("busy").props.children;

describe("useSignOut", () => {
  beforeEach(() => {
    mockSignOut.mockReset();
    mockClearSession.mockReset();
  });

  it("is busy while signing out, then clears the in-app session and frees the button", async () => {
    let finish: () => void = () => {};
    mockSignOut.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    await render(<Harness />);

    await act(async () => {
      fireEvent.press(screen.getByLabelText("out"));
    });
    expect(busy()).toBe("true");
    expect(mockClearSession).not.toHaveBeenCalled();

    await act(async () => finish());
    expect(mockClearSession).toHaveBeenCalledTimes(1);
    expect(busy()).toBe("false");
  });

  it("runs exactly one sign-out for two taps in the same frame", async () => {
    mockSignOut.mockResolvedValue(undefined);
    await render(<Harness />);

    await act(async () => {
      fireEvent.press(screen.getByLabelText("out-twice"));
    });

    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it("does not set state when the screen unmounts mid-sign-out", async () => {
    let finish: () => void = () => {};
    mockSignOut.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    const view = await render(<Harness />);

    await act(async () => {
      fireEvent.press(screen.getByLabelText("out"));
    });
    await view.unmount();
    await act(async () => finish());

    expect(mockClearSession).toHaveBeenCalledTimes(1);
  });
});
