import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type AuthContextValue = {
  session: Session | null;
  isLoading: boolean;
  /** Drops the in-app session immediately, for when the storage clear during sign-out failed. */
  clearSession: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Single Supabase auth listener for the whole app; every screen reads the
// result via useAuthSession() instead of opening its own subscription.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Follows the auth listener only; its INITIAL_SESSION event (null when signed out) ends loading.
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setIsLoading(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // Sets the session to null without waiting for a SIGNED_OUT event.
  const clearSession = useCallback(() => setSession(null), []);

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
