import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { supabase } from "@/lib/supabase";
import { Sentry } from "@/lib/sentry";
import { ensureGoogleConfigured } from "./configureGoogle";

/** Ends the Supabase session (this device only) and the Google account choice; the two run independently, and failures go to Sentry instead of rejecting. */
export async function signOut(): Promise<void> {
  // 'local' revokes only this device's session; other devices stay signed in.
  const supabaseStep = supabase.auth.signOut({ scope: "local" }).then(({ error }) => {
    if (error) throw error;
  });
  // Clearing Google's cached account makes the next sign-in show the picker.
  const googleStep = (async () => {
    ensureGoogleConfigured();
    await GoogleSignin.signOut();
  })();

  const results = await Promise.allSettled([supabaseStep, googleStep]);
  for (const result of results) {
    if (result.status === "rejected") Sentry.captureException(result.reason);
  }
  Sentry.setUser(null);
}
