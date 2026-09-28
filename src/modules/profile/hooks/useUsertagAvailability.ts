import { useEffect, useState } from "react";
import { checkUsertagAvailable } from "../api/checkUsertagAvailable";

const USERTAG_REGEX = /^[a-z][a-z0-9_]{2,19}$/;
// DESIGN.md: debounce roughly 400-500ms after the user stops typing.
const DEBOUNCE_MS = 450;

export type UsertagAvailability =
  | { status: "unchanged" } // equals the currently-saved value — nothing to check or save
  | { status: "invalid" }
  | { status: "checking" }
  | { status: "available" }
  | { status: "taken" };

type AsyncResult = { forUsertag: string; available: boolean } | null;

/**
 * Debounced live uniqueness check for the edit-profile usertag field.
 * "unchanged"/"invalid" are computed at render time, not via state+effect —
 * they're pure functions of the two inputs, so there's nothing to
 * synchronize with an external system for those cases. The effect only
 * ever calls `setState` from inside its async `.then`/`.catch`, never
 * synchronously in the effect body, which is what `react-hooks/
 * set-state-in-effect` actually flags.
 */
export function useUsertagAvailability(
  usertag: string,
  currentUsertag: string | null,
  userId: string | undefined,
): UsertagAvailability {
  const [asyncResult, setAsyncResult] = useState<AsyncResult>(null);

  useEffect(() => {
    if (usertag === (currentUsertag ?? "")) return;
    if (!USERTAG_REGEX.test(usertag)) return;
    if (!userId) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      checkUsertagAvailable(usertag, userId)
        .then((available) => {
          if (!cancelled) setAsyncResult({ forUsertag: usertag, available });
        })
        .catch(() => {
          // A failed check isn't a format error — let it through as
          // "available" and let the real save's unique-violation (23505)
          // be the actual source of truth, per DESIGN.md.
          if (!cancelled) setAsyncResult({ forUsertag: usertag, available: true });
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [usertag, currentUsertag, userId]);

  if (usertag === (currentUsertag ?? "")) return { status: "unchanged" };
  if (!USERTAG_REGEX.test(usertag)) return { status: "invalid" };
  if (asyncResult && asyncResult.forUsertag === usertag) {
    return { status: asyncResult.available ? "available" : "taken" };
  }
  return { status: "checking" };
}
