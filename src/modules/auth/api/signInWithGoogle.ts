import {
  GoogleSignin,
  isCancelledResponse,
  isSuccessResponse,
} from "@react-native-google-signin/google-signin";
import { supabase } from "@/lib/supabase";

/** Thrown when the user dismisses the Google picker themselves. Not a real
 * failure, so the sign-in screen tells this apart from other thrown errors
 * to skip the Sentry report. */
export class GoogleSignInCancelledError extends Error {
  constructor() {
    super("Google sign-in was cancelled");
    this.name = "GoogleSignInCancelledError";
  }
}

let configured = false;

/** `GoogleSignin.configure` is cheap and idempotent, but only needs to run
 * once — guarded so repeated sign-in attempts don't re-read env each time. */
function ensureConfigured() {
  if (configured) return;
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (!webClientId) {
    throw new Error("Missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID — check .env");
  }
  // webClientId is the GCP "Web client" ID, not the Android client — Supabase
  // verifies the ID token's audience against this one. offlineAccess isn't
  // needed: the app only exchanges the ID token with Supabase once.
  GoogleSignin.configure({ webClientId });
  configured = true;
}

/**
 * Runs the native Google account picker, then exchanges the returned ID
 * token for a Supabase session (`signInWithIdToken`). Throws on cancel,
 * missing Play Services, or a Supabase error alike — the sign-in screen
 * shows one generic error state for all of these, except a cancel throws
 * the typed `GoogleSignInCancelledError` so it can skip the Sentry report.
 */
export async function signInWithGoogle(): Promise<void> {
  ensureConfigured();
  await GoogleSignin.hasPlayServices();
  const response = await GoogleSignin.signIn();
  if (isCancelledResponse(response)) {
    throw new GoogleSignInCancelledError();
  }
  if (!isSuccessResponse(response) || !response.data.idToken) {
    throw new Error("Google sign-in did not return an ID token");
  }
  const { error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: response.data.idToken,
  });
  if (error) throw error;
}
