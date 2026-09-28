import {
  GoogleSignin,
  isCancelledResponse,
  isSuccessResponse,
} from "@react-native-google-signin/google-signin";
import { supabase } from "@/lib/supabase";

/** Thrown on a user-dismissed picker, not a real failure — skips the Sentry report. */
export class GoogleSignInCancelledError extends Error {
  constructor() {
    super("Google sign-in was cancelled");
    this.name = "GoogleSignInCancelledError";
  }
}

let configured = false;

/** Cheap and idempotent, but only needs to run once per app session. */
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

/** Runs the native Google picker, then exchanges its ID token for a Supabase session. */
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
