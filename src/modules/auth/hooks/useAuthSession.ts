import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

/**
 * Live Supabase auth session — `isLoading` is true only until the persisted
 * session (AsyncStorage, see src/lib/supabase.ts) has been read once; after
 * that, `session` tracks sign-in/sign-out in real time via Supabase's own
 * listener. The root layout's route guard reads this to decide (auth) vs
 * (tabs).
 */
export function useAuthSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  return { session, isLoading };
}
