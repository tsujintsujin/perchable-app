import { useCallback, useRef } from "react";
import { useFocusEffect } from "expo-router";

// A second tap within this window is the same tap (a double tap), not a second request to open.
const DOUBLE_TAP_MS = 800;

/** Wraps an open action so it runs once per tap burst; coming back to the screen re-arms it. */
export function useTapGuard<Args extends unknown[]>(action: (...args: Args) => void) {
  // Ref, not state: the guard must see the first tap before React re-renders. Monotonic clock: wall time can jump.
  const lastOpenRef = useRef(-Infinity);

  // Back from the opened screen lands here again: the next tap must open, however soon it comes.
  useFocusEffect(
    useCallback(() => {
      lastOpenRef.current = -Infinity;
    }, []),
  );

  return useCallback(
    (...args: Args) => {
      const now = performance.now();
      if (now - lastOpenRef.current < DOUBLE_TAP_MS) return;
      lastOpenRef.current = now;
      action(...args);
    },
    [action],
  );
}
