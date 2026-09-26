import { useCallback, useEffect, useState } from "react";
import { useAuthSession } from "@/modules/auth";
import { getOwnProfile } from "../api/getOwnProfile";
import type { Profile } from "../types";

type State =
  | { state: "loading" }
  | { state: "loaded"; profile: Profile }
  | { state: "error"; message: string };

/**
 * Own-profile fetch, following the same plain useState/useEffect pattern as
 * `useAuthSession` rather than TanStack Query — PLAN.md only requires
 * TanStack Query starting with Build 12's movie data; wiring the query
 * client now would be new infra this Build doesn't need. Exposes `refetch`
 * for the load-error state's Retry button (DESIGN.md Build 6).
 */
export function useOwnProfile() {
  const { session } = useAuthSession();
  const userId = session?.user.id;
  const [state, setState] = useState<State>({ state: "loading" });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!userId) return;
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
  }, [userId, reloadToken]);

  // setState here runs from the event handler (Retry button press), not
  // synchronously inside the effect body — the effect itself only ever
  // sets state from its async .then/.catch, which satisfies the
  // react-hooks/set-state-in-effect rule (no cascading-render risk from a
  // handler, unlike an unconditional setState at the top of an effect).
  const refetch = useCallback(() => {
    setState({ state: "loading" });
    setReloadToken((t) => t + 1);
  }, []);

  return { ...state, refetch };
}
