import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { AppState, Pressable, Text } from "react-native";
import type { Session } from "@supabase/supabase-js";

let mockEmit: (event: string, session: Session | null) => void = () => {};
const mockUnsubscribe = jest.fn();
const mockStopAutoRefresh = jest.fn();
const mockStartAutoRefresh = jest.fn();
const mockReadStored = jest.fn<Promise<Session | null>, []>();
jest.mock("@/lib/supabase", () => ({
  readStoredSession: () => mockReadStored(),
  supabase: {
    auth: {
      stopAutoRefresh: () => mockStopAutoRefresh(),
      startAutoRefresh: () => mockStartAutoRefresh(),
      onAuthStateChange: (cb: typeof mockEmit) => {
        mockEmit = cb;
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
      },
    },
  },
}));

import { AuthProvider, OPTIMISTIC_START_MS, useAuthSession } from "@/modules/auth/AuthProvider";

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
  const originalAppState = AppState.currentState;
  afterEach(() => {
    Object.defineProperty(AppState, "currentState", { value: originalAppState, configurable: true, writable: true });
  });

  beforeEach(() => {
    mockUnsubscribe.mockReset();
    mockStopAutoRefresh.mockReset();
    mockStartAutoRefresh.mockReset();
    mockReadStored.mockReset();
    mockReadStored.mockResolvedValue(null);
  });

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

  it("stops auto-refresh and ignores a later TOKEN_REFRESHED after clearSession", async () => {
    await render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await act(async () => mockEmit("INITIAL_SESSION", sessionB));
    await act(async () => {
      fireEvent.press(screen.getByLabelText("clear"));
    });
    expect(mockStopAutoRefresh).toHaveBeenCalledTimes(1);

    await act(async () => mockEmit("TOKEN_REFRESHED", sessionB));
    expect(state()).toBe('{"token":null,"isLoading":false}');
  });

  it("accepts a real SIGNED_IN after clearSession, and events flow again afterwards", async () => {
    const sessionC = { access_token: "C" } as Session;
    await render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await act(async () => mockEmit("INITIAL_SESSION", sessionB));
    await act(async () => {
      fireEvent.press(screen.getByLabelText("clear"));
    });
    await act(async () => mockEmit("SIGNED_IN", sessionB));
    expect(state()).toBe('{"token":"B","isLoading":false}');

    await act(async () => mockEmit("TOKEN_REFRESHED", sessionC));
    expect(state()).toBe('{"token":"C","isLoading":false}');
  });

  /** Clears the session, then signs in again, with AppState reporting `appState`. */
  async function clearThenSignIn(appState: "active" | "background") {
    Object.defineProperty(AppState, "currentState", { value: appState, configurable: true, writable: true });
    await render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await act(async () => mockEmit("INITIAL_SESSION", sessionB));
    await act(async () => {
      fireEvent.press(screen.getByLabelText("clear"));
    });
    await act(async () => mockEmit("SIGNED_IN", sessionB));
  }

  it("restarts auto-refresh when SIGNED_IN lifts the latch while the app is active", async () => {
    await clearThenSignIn("active");
    expect(mockStartAutoRefresh).toHaveBeenCalledTimes(1);
  });

  it("does not restart auto-refresh when the app is not active", async () => {
    await clearThenSignIn("background");
    expect(mockStartAutoRefresh).not.toHaveBeenCalled();
  });

  describe("offline start-up (auth-js has not fired INITIAL_SESSION)", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    /** Renders the provider and lets OPTIMISTIC_START_MS pass with no auth event. */
    async function startStuck() {
      await render(
        <AuthProvider>
          <Probe />
        </AuthProvider>,
      );
      expect(state()).toBe('{"token":null,"isLoading":true}');
      await act(async () => {
        jest.advanceTimersByTime(OPTIMISTIC_START_MS);
      });
    }

    it("shows the stored session after the timeout while INITIAL_SESSION is still pending", async () => {
      mockReadStored.mockResolvedValue(sessionB);
      await startStuck();
      expect(state()).toBe('{"token":"B","isLoading":false}');
    });

    it("shows the signed-out state after the timeout when nothing is stored", async () => {
      await startStuck();
      expect(state()).toBe('{"token":null,"isLoading":false}');
    });

    it("ends signed out when the refresh is refused after the optimistic render", async () => {
      mockReadStored.mockResolvedValue(sessionB);
      await startStuck();
      expect(state()).toBe('{"token":"B","isLoading":false}');
      mockReadStored.mockResolvedValue(null);
      await act(async () => mockEmit("SIGNED_OUT", null));
      expect(state()).toBe('{"token":null,"isLoading":false}');
    });

    it("ends signed out when a null INITIAL_SESSION follows a refused refresh (storage emptied)", async () => {
      mockReadStored.mockResolvedValue(sessionB);
      await startStuck();
      expect(state()).toBe('{"token":"B","isLoading":false}');
      mockReadStored.mockResolvedValue(null);
      await act(async () => mockEmit("INITIAL_SESSION", null));
      expect(state()).toBe('{"token":null,"isLoading":false}');
    });

    it("stays signed in when a null INITIAL_SESSION follows a network-failed refresh (session kept)", async () => {
      mockReadStored.mockResolvedValue(sessionB);
      await startStuck();
      await act(async () => mockEmit("INITIAL_SESSION", null));
      expect(state()).toBe('{"token":"B","isLoading":false}');
    });

    it("keeps the stored session on a null INITIAL_SESSION even with no earlier timeout", async () => {
      mockReadStored.mockResolvedValue(sessionB);
      await render(
        <AuthProvider>
          <Probe />
        </AuthProvider>,
      );
      await act(async () => mockEmit("INITIAL_SESSION", null));
      expect(state()).toBe('{"token":"B","isLoading":false}');
    });

    it("does not touch storage once an auth event has already arrived", async () => {
      await render(
        <AuthProvider>
          <Probe />
        </AuthProvider>,
      );
      await act(async () => mockEmit("INITIAL_SESSION", sessionB));
      await act(async () => {
        jest.advanceTimersByTime(OPTIMISTIC_START_MS * 2);
      });
      expect(mockReadStored).not.toHaveBeenCalled();
      expect(state()).toBe('{"token":"B","isLoading":false}');
    });

    it("drops a slow storage read when a newer auth event arrived meanwhile", async () => {
      let resolveRead: (s: Session | null) => void = () => {};
      mockReadStored.mockReturnValue(new Promise((resolve) => (resolveRead = resolve)));
      await startStuck();
      await act(async () => mockEmit("SIGNED_IN", sessionB));
      await act(async () => resolveRead(null));
      expect(state()).toBe('{"token":"B","isLoading":false}');
    });

    it("does not apply the stored session after clearSession", async () => {
      mockReadStored.mockResolvedValue(sessionB);
      await render(
        <AuthProvider>
          <Probe />
        </AuthProvider>,
      );
      await act(async () => {
        fireEvent.press(screen.getByLabelText("clear"));
      });
      await act(async () => {
        jest.advanceTimersByTime(OPTIMISTIC_START_MS);
      });
      expect(state()).toBe('{"token":null,"isLoading":true}');
    });
  });
});
