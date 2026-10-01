import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AppState } from "react-native";
import type { Session } from "@supabase/supabase-js";
import { readStoredSession, supabase } from "@/lib/supabase";

type AuthContextValue = {
  session: Session | null;
  isLoading: boolean;
  /** Drops the in-app session immediately, for when the storage clear during sign-out failed. */
  clearSession: () => void;
};

// How long to wait for auth-js's INITIAL_SESSION before showing the stored session instead.
export const OPTIMISTIC_START_MS = 2000;

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Single Supabase auth listener for the whole app; every screen reads the
// result via useAuthSession() instead of opening its own subscription.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Ref, not state: read inside the auth listener. Set by clearSession; only SIGNED_IN lifts it.
  const clearedRef = useRef(false);
  // Ref, not state: counts auth events so a slow storage read can't overwrite a newer one.
  const eventSeqRef = useRef(0);

  // Follows the auth listener. Its INITIAL_SESSION ends loading; if auth-js is stuck retrying an
  // offline token refresh, the stored session is shown after OPTIMISTIC_START_MS and reconciled later.
  useEffect(() => {
    let cancelled = false;

    // Shows the persisted session (or none) unless an auth event or a clear arrived while it was read.
    const settleFromStorage = async () => {
      const seq = eventSeqRef.current;
      const stored = await readStoredSession();
      if (cancelled || seq !== eventSeqRef.current || clearedRef.current) return;
      setSession(stored);
      setIsLoading(false);
    };

    const timer = setTimeout(settleFromStorage, OPTIMISTIC_START_MS);

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      eventSeqRef.current += 1;
      clearTimeout(timer);
      // After a forced clear, a background token refresh must not sign the user back in.
      if (clearedRef.current) {
        if (event !== "SIGNED_IN") return;
        clearedRef.current = false;
        // clearSession stopped refresh; restart it here (same foreground rule as src/lib/supabase.ts).
        if (AppState.currentState === "active") supabase.auth.startAutoRefresh();
      }
      // A null start-up session with a session still in storage means the refresh failed on the
      // network (a refused one empties storage), so the user stays signed in.
      if (event === "INITIAL_SESSION" && !newSession) {
        void settleFromStorage();
        return;
      }
      setSession(newSession);
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
      clearTimeout(timer);
      listener.subscription.unsubscribe();
    };
  }, []);

  // Sets the session to null now, stops token refresh, and ignores auth events until a real sign-in.
  const clearSession = useCallback(() => {
    clearedRef.current = true;
    supabase.auth.stopAutoRefresh();
    setSession(null);
  }, []);

  return (
    <AuthContext.Provider value={{ session, isLoading, clearSession }}>
      {children}
    </AuthContext.Provider>
  );
}

// Reads the shared session from AuthProvider — must be rendered under one.
export function useAuthSession(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthSession must be used within an AuthProvider");
  return ctx;
}
