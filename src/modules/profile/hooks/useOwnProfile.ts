import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router/react-navigation";
import { useAuthSession } from "@/modules/auth";
import { getOwnProfile } from "../api/getOwnProfile";
import type { Profile } from "../types";

type State =
  | { state: "loading" }
  | { state: "loaded"; profile: Profile }
  | { state: "error"; message: string };

const LOADING: State = { state: "loading" };

/** Own-profile fetch with a Retry-button `refetch`. Reloads on every screen
 * focus, not just mount, since Stack/Tabs keep a screen mounted instead of remounting it. */
export function useOwnProfile() {
  const { session } = useAuthSession();
  const userId = session?.user.id;
  // Each result remembers whose it is, so another user (or nobody) never sees it.
  const [entry, setEntry] = useState<{ ownerId: string | undefined; result: State }>({
    ownerId: undefined,
    result: LOADING,
  });
  // Ref, not state: stops the newest fetch (focus or Retry) from applying after unmount or sign-out.
  const cancelRef = useRef<() => void>(() => {});

  // One fetch path for the focus load and the manual refetch; a newer fetch cancels the older one.
  const load = useCallback(() => {
    cancelRef.current();
    if (!userId) return;
    let cancelled = false;
    cancelRef.current = () => {
      cancelled = true;
    };
    getOwnProfile(userId)
      .then((profile) => {
        if (!cancelled) setEntry({ ownerId: userId, result: { state: "loaded", profile } });
      })
      .catch((err) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : String(err);
          setEntry({ ownerId: userId, result: { state: "error", message } });
        }
      });
  }, [userId]);

  // Reloads when the screen gains focus or the user changes; cleanup cancels whichever fetch is newest.
  useFocusEffect(
    useCallback(() => {
      load();
      return () => cancelRef.current();
    }, [load]),
  );

  // Retry button: shows the loading state, then fetches again.
  const refetch = useCallback(() => {
    setEntry({ ownerId: userId, result: LOADING });
    load();
  }, [load, userId]);

  return { ...(entry.ownerId === userId ? entry.result : LOADING), refetch };
}
