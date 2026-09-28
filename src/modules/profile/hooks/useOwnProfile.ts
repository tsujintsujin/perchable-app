import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router/react-navigation";
import { useAuthSession } from "@/modules/auth";
import { getOwnProfile } from "../api/getOwnProfile";
import type { Profile } from "../types";

type State =
  | { state: "loading" }
  | { state: "loaded"; profile: Profile }
  | { state: "error"; message: string };

/**
 * Own-profile fetch, following the same plain useState pattern as
 * `useAuthSession` rather than TanStack Query — not needed until movie
 * data lands. Exposes `refetch` for the load-error state's Retry button.
 * Refetches on every screen focus, not just mount, since Stack/Tabs keep a
 * previous screen mounted instead of remounting it on navigating back.
 */
export function useOwnProfile() {
  const { session } = useAuthSession();
  const userId = session?.user.id;
  const [state, setState] = useState<State>({ state: "loading" });

  // One fetch path for both the focus-triggered load and the manual
  // refetch, so both get the same cancelled-guard. Resets to "loading"
  // (dropping any previous user's data) when there's no signed-in user.
  const load = useCallback(() => {
    if (!userId) {
      setState({ state: "loading" });
      return () => {};
    }
    let cancelled = false;
    getOwnProfile(userId)
      .then((profile) => {
        if (!cancelled) setState({ state: "loaded", profile });
      })
      .catch((err) => {
        if (!cancelled) {
          setState({
            state: "error",
            message: err instanceof Error ? err.message : String(err),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useFocusEffect(useCallback(() => load(), [load]));

  const refetch = useCallback(() => {
    setState({ state: "loading" });
    load();
  }, [load]);

  return { ...state, refetch };
}
