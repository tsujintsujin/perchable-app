import { useEffect, useRef, useState } from "react";
import { signOut } from "../api/signOut";
import { useAuthSession } from "../AuthProvider";

/** Sign-out action for a screen: one run at a time.
 * The app ends up signed out even if the session store can't be cleared. */
export function useSignOut() {
  const { clearSession } = useAuthSession();
  const [isSigningOut, setIsSigningOut] = useState(false);
  // Ref, not state: blocks a second tap before React re-renders with isSigningOut.
  const inFlightRef = useRef(false);
  // Ref, not state: read inside async code, the screen unmounts once the auth gate redirects.
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Runs the sign-out, then forces the in-app session to null so the auth gate redirects regardless.
  const run = async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsSigningOut(true);
    try {
      await signOut();
    } finally {
      clearSession();
      inFlightRef.current = false;
      if (mountedRef.current) setIsSigningOut(false);
    }
  };

  return { signOut: run, isSigningOut };
}
