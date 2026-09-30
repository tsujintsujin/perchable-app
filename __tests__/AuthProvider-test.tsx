import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";
import type { Session } from "@supabase/supabase-js";

let mockEmit: (event: string, session: Session | null) => void = () => {};
const mockUnsubscribe = jest.fn();
jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      onAuthStateChange: (cb: typeof mockEmit) => {
        mockEmit = cb;
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
      },
    },
  },
}));

import { AuthProvider, useAuthSession } from "@/modules/auth/AuthProvider";

const sessionB = { access_token: "B" } as Session;

/** Prints the provider's state as plain text. */
function Probe() {
  const { session, isLoading, clearSession } = useAuthSession();
  return (
    <>
      <Text testID="state">{JSON.stringify({ token: session?.access_token ?? null, isLoading })}</Text>
      <Pressable onPress={clearSession} accessibilityRole="button" accessibilityLabel="clear" />
    </>
  );
}

const state = () => screen.getByTestId("state").props.children;

describe("AuthProvider", () => {
  beforeEach(() => mockUnsubscribe.mockReset());

  it("is loading until the listener fires", async () => {
    await render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    expect(state()).toBe('{"token":null,"isLoading":true}');
  });

  it("stops loading on INITIAL_SESSION with no session", async () => {
    await render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await act(async () => mockEmit("INITIAL_SESSION", null));
    expect(state()).toBe('{"token":null,"isLoading":false}');
  });

  it("stops loading on INITIAL_SESSION with a session, and keeps later updates", async () => {
    await render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await act(async () => mockEmit("INITIAL_SESSION", sessionB));
    expect(state()).toBe('{"token":"B","isLoading":false}');
    await act(async () => mockEmit("SIGNED_OUT", null));
    expect(state()).toBe('{"token":null,"isLoading":false}');
  });

  it("unsubscribes on unmount so nothing updates afterwards", async () => {
    const view = await render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await view.unmount();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it("clearSession drops the session without waiting for a SIGNED_OUT event", async () => {
    await render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await act(async () => mockEmit("INITIAL_SESSION", sessionB));
    await act(async () => {
      fireEvent.press(screen.getByLabelText("clear"));
    });
    expect(state()).toBe('{"token":null,"isLoading":false}');
  });
});
