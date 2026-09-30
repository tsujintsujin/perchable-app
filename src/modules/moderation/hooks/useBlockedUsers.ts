import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router/react-navigation";
import { useAuthSession } from "@/modules/auth";
import { unblockUser } from "../api/blockUser";
import { reportUnexpected } from "../api/errors";
import { getBlockedUsers } from "../api/getBlockedUsers";
import type { BlockedUser } from "../types";

type Result = { state: "loading" } | { state: "loaded"; users: BlockedUser[] } | { state: "error" };

/** Everything the hook holds, tagged with the user it belongs to. */
type Entry = { ownerId: string | undefined; result: Result; busyIds: string[]; failedId: string | null };

const LOADING: Result = { state: "loading" };
const EMPTY: Entry = { ownerId: undefined, result: LOADING, busyIds: [], failedId: null };

/** The signed-in user's block list with `unblock`. Reloads on focus; a list, busy flag or failure
 * belonging to another user (or nobody) is never returned, so sign-out and account switches show nothing stale. */
export function useBlockedUsers() {
  const { session } = useAuthSession();
  const userId = session?.user.id;
  const [entry, setEntry] = useState<Entry>(EMPTY);
  // Ref, not state: stops the newest fetch from applying after unmount or a user change.
  const cancelRef = useRef<() => void>(() => {});
  // Ref, not state: one unblock per user id at a time, checked before any re-render.
  const inFlightRef = useRef(new Set<string>());
  const mountedRef = useRef(true);
  // Ref, not state: the signed-in user as async code sees it, so a late result for a previous user is dropped.
  const userRef = useRef(userId);

  useEffect(() => {
    mountedRef.current = true;
    userRef.current = userId;
    return () => {
      mountedRef.current = false;
    };
  }, [userId]);

  // Applies a change for `owner` only while they are still signed in; the first change for a new owner starts fresh.
  const update = useCallback((owner: string, change: (prev: Entry) => Entry) => {
    if (!mountedRef.current || userRef.current !== owner) return;
    setEntry((prev) => change(prev.ownerId === owner ? prev : { ...EMPTY, ownerId: owner }));
  }, []);

  // One fetch path for the focus load and Retry; a newer fetch cancels the older one.
  const load = useCallback(() => {
    cancelRef.current();
    if (!userId) return;
    let cancelled = false;
    cancelRef.current = () => {
      cancelled = true;
    };
    getBlockedUsers(userId)
      .then((users) => {
        if (!cancelled) update(userId, (prev) => ({ ...prev, result: { state: "loaded", users } }));
      })
      .catch((err) => {
        if (cancelled) return;
        reportUnexpected("getBlockedUsers", err);
        update(userId, (prev) => ({ ...prev, result: { state: "error" } }));
      });
  }, [userId, update]);

  // Reloads when the screen gains focus or the user changes; cleanup cancels the newest fetch.
  useFocusEffect(
    useCallback(() => {
      load();
      return () => cancelRef.current();
    }, [load]),
  );

  // Retry button: shows loading, then fetches again.
  const refetch = useCallback(() => {
    if (userId) update(userId, (prev) => ({ ...prev, result: LOADING }));
    load();
  }, [userId, update, load]);

  // Removes one block; the row leaves the list on success and stays (with failedId set) on failure.
  const unblock = useCallback(
    async (blockedId: string) => {
      if (!userId) return;
      const key = `${userId}:${blockedId}`;
      if (inFlightRef.current.has(key)) return;
      inFlightRef.current.add(key);
      update(userId, (prev) => ({ ...prev, failedId: null, busyIds: [...prev.busyIds, blockedId] }));
      let failed = false;
      try {
        await unblockUser(userId, blockedId);
      } catch (err) {
        failed = true;
        reportUnexpected("unblockUser", err);
      }
      inFlightRef.current.delete(key);
      update(userId, (prev) => ({
        ...prev,
        busyIds: prev.busyIds.filter((id) => id !== blockedId),
        failedId: failed ? blockedId : prev.failedId,
        result:
          !failed && prev.result.state === "loaded"
            ? { state: "loaded", users: prev.result.users.filter((u) => u.id !== blockedId) }
            : prev.result,
      }));
    },
    [userId, update],
  );

  // Hides the "couldn't unblock" card, for when the user starts another action.
  const clearFailure = useCallback(() => {
    if (userId) update(userId, (prev) => ({ ...prev, failedId: null }));
  }, [userId, update]);

  const mine = entry.ownerId === userId ? entry : EMPTY;
  return { ...mine.result, busyIds: mine.busyIds, failedId: mine.failedId, refetch, unblock, clearFailure };
}
