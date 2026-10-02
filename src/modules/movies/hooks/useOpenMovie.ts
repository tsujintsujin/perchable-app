import { useCallback, useRef } from "react";
import { router } from "expo-router";

// A second tap within this window is the same tap (a double tap), not a second request to open.
const DOUBLE_TAP_MS = 800;

/** Returns `openMovie(id)`, which pushes the details screen once per tap burst. */
export function useOpenMovie() {
  // Ref, not state: the guard must see the first tap before React re-renders.
  const lastOpenRef = useRef(0);
  return useCallback((id: number) => {
    const now = Date.now();
    if (now - lastOpenRef.current < DOUBLE_TAP_MS) return;
    lastOpenRef.current = now;
    router.push({ pathname: "/movie/[id]", params: { id: String(id) } });
  }, []);
}
