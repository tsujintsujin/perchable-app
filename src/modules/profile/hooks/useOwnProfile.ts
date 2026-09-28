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
 * `useAuthSession` rather than TanStack Query — PLAN.md only requires
 * TanStack Query starting with Build 12's movie data; wiring the query
 * client now would be new infra this Build doesn't need. Exposes `refetch`
 * for the load-error state's Retry button (DESIGN.md Build 6).
 *
 * Build 7 fix (found on-device, not by reading code): refetches on every
 * screen focus, not just mount. Without this, saving a usertag/photo on
 * the Edit screen and navigating back showed stale data on the Profile
 * screen — Stack/Tabs both keep the previous screen mounted rather than
 * remounting it, so a mount-only fetch never re-ran after the save.
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
