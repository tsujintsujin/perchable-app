import { useEffect, useRef, useState } from "react";
import { Sentry } from "@/lib/sentry";
import { deleteAccount, DeleteAccountOfflineError } from "../api/deleteAccount";
import { signOut } from "../api/signOut";
import { clearAccountDeleted, markAccountDeleted } from "../accountDeletedNotice";
import { useAuthSession } from "../AuthProvider";

/** Delete-account action for the confirmation sheet: one run at a time.
 * Success signs out everywhere and leaves the auth gate to show sign-in; failure returns to confirm. */
export function useDeleteAccount() {
  const { clearSession } = useAuthSession();
  const [isDeleting, setIsDeleting] = useState(false);
  const [failed, setFailed] = useState(false);
  // Ref, not state: blocks a second tap before React re-renders with isDeleting.
  const inFlightRef = useRef(false);
  // Ref, not state: read inside async code, the sheet unmounts if the screen closes mid-delete.
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Deletes the account; on failure returns to the confirm state, on success ends the local session.
  const run = async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setFailed(false);
    setIsDeleting(true);
    // Marked before the request: a sign-out from a background refresh can mount sign-in mid-delete.
    markAccountDeleted();
    try {
      await deleteAccount();
    } catch (err) {
      clearAccountDeleted();
      // Offline is expected and nothing was deleted, so only other failures are reported.
      if (!(err instanceof DeleteAccountOfflineError)) Sentry.captureException(err);
      inFlightRef.current = false;
      if (mountedRef.current) {
        setIsDeleting(false);
        setFailed(true);
      }
      return;
    }
    // The account is gone: clear Supabase + Google and the in-app session.
    try {
      await signOut();
    } finally {
      clearSession();
    }
  };

  // Reads the ref, so it is true from the tap itself, before isDeleting re-renders.
  const isInFlight = () => inFlightRef.current;

  return { deleteAccount: run, isDeleting, failed, isInFlight };
}
