import { useEffect, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import { DECK_KEY } from "./deckKey";

/** Skipped movie ids kept per user; the oldest are dropped past this. */
export const MAX_SKIPS = 5000;

// One storage key per user: the list holds only movie ids, nothing secret.
const skipsKey = (userId: string) => `quickAdd:skips:${userId}`;

// Writes per user run one after another, so a rapid swipe never lets an older write land last.
const writeChains = new Map<string, Promise<void>>();

// Queues a storage task after the user's earlier ones; a failure is swallowed (a full disk is not a bug to report).
function enqueue(userId: string, task: () => Promise<void>): Promise<void> {
  const next = (writeChains.get(userId) ?? Promise.resolve()).then(task).catch(() => {});
  writeChains.set(userId, next);
  return next;
}

/** Keeps the newest MAX_SKIPS ids. */
export function capSkips(ids: number[]): number[] {
  return ids.length > MAX_SKIPS ? ids.slice(ids.length - MAX_SKIPS) : ids;
}

/** The user's saved skips, oldest first; a failed read or corrupt content gives an empty list and never throws. */
export async function loadSkips(userId: string): Promise<number[]> {
  await (writeChains.get(userId) ?? Promise.resolve());
  try {
    const raw = await AsyncStorage.getItem(skipsKey(userId));
    const parsed: unknown = raw === null ? [] : JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return capSkips(parsed.filter((id): id is number => Number.isInteger(id)));
  } catch {
    return [];
  }
}

/** Saves the user's skips (the newest MAX_SKIPS); never rejects. */
export function saveSkips(userId: string, ids: number[]): Promise<void> {
  return enqueue(userId, () => AsyncStorage.setItem(skipsKey(userId), JSON.stringify(capSkips(ids))));
}

// Ids swiped right this session, per user. Module-level so it outlives the screen; Build 16b replaces it with the collection.
const sessionAdds = new Map<string, number[]>();

/** Movies this user swiped right since the app started (or since sign-out), oldest first. */
export function getSessionAdds(userId: string): number[] {
  return sessionAdds.get(userId) ?? [];
}

/** Replaces the user's session list. */
export function setSessionAdds(userId: string, ids: number[]): void {
  sessionAdds.set(userId, ids);
}

/** Removes everything Quick Add keeps for a user: their saved skips and their session list. */
export function clearQuickAddData(userId: string): Promise<void> {
  sessionAdds.delete(userId);
  return enqueue(userId, () => AsyncStorage.removeItem(skipsKey(userId)));
}

/** Clears the departing user's Quick Add data (and the deck's loaded pages, so the next user starts at page 1) when the signed-in user changes to someone else or to nobody; not at first render. */
export function useClearQuickAddOnSignOut(userId: string | undefined): void {
  const queryClient = useQueryClient();
  // Ref, not state: compared inside the effect, never rendered.
  const previousRef = useRef(userId);

  // Runs after each change of user and clears the one who left.
  useEffect(() => {
    const previous = previousRef.current;
    previousRef.current = userId;
    if (previous !== undefined && previous !== userId) {
      void clearQuickAddData(previous);
      queryClient.removeQueries({ queryKey: DECK_KEY });
    }
  }, [userId, queryClient]);
}
