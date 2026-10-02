import { useCallback, useRef } from "react";
import { router, useFocusEffect } from "expo-router";

// A second tap within this window is the same tap (a double tap), not a second request to open.
const DOUBLE_TAP_MS = 800;

/** Returns `openMovie(id)`, which pushes the details screen once per tap burst; coming back to the screen re-arms it. */
export function useOpenMovie() {
  // Ref, not state: the guard must see the first tap before React re-renders. Monotonic clock: wall time can jump.
  const lastOpenRef = useRef(-Infinity);

  // Back from details lands here again: the next tap must open, however soon it comes.
  useFocusEffect(
    useCallback(() => {
      lastOpenRef.current = -Infinity;
    }, []),
  );

  return useCallback((id: number) => {
    const now = performance.now();
    if (now - lastOpenRef.current < DOUBLE_TAP_MS) return;
    lastOpenRef.current = now;
    router.push({ pathname: "/movie/[id]", params: { id: String(id) } });
  }, []);
}
