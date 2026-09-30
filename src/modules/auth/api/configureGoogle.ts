import { GoogleSignin } from "@react-native-google-signin/google-signin";

let configured = false;

/** Cheap and idempotent, but only needs to run once per app session; sign-in and sign-out both need it. */
export function ensureGoogleConfigured() {
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
