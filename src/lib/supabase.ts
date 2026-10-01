import "react-native-url-polyfill/auto";
import "react-native-get-random-values";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as aesjs from "aes-js";
import { createClient } from "@supabase/supabase-js";
import type { Session } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { Sentry } from "./sentry";

export const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
export const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY — check .env",
  );
}

// Encrypted values are stored as an even-length hex string.
const HEX_PATTERN = /^(?:[0-9a-f]{2})+$/i;

// Supabase's documented pattern for a session past SecureStore's ~2KB
// limit: the AES key lives in SecureStore, the encrypted session in AsyncStorage.
class LargeSecureStore {
  private async _encrypt(key: string, value: string) {
    const encryptionKey = crypto.getRandomValues(new Uint8Array(256 / 8));
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
    const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
    await SecureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKey));
    return aesjs.utils.hex.fromBytes(encryptedBytes);
  }

  // Decrypts with the stored AES key; null when the value or key is malformed.
  private _decrypt(encryptionKeyHex: string, value: string) {
    if (!HEX_PATTERN.test(value)) return null;
    try {
      const cipher = new aesjs.ModeOfOperation.ctr(
        aesjs.utils.hex.toBytes(encryptionKeyHex),
        new aesjs.Counter(1),
      );
      return aesjs.utils.utf8.fromBytes(cipher.decrypt(aesjs.utils.hex.toBytes(value)));
    } catch {
      return null;
    }
  }

  // Reads the session and never rejects: supabase-js hangs its startup if storage throws.
  // Undecryptable values are purged; storage I/O errors keep the entry, go to Sentry, sign out.
  async getItem(key: string) {
    try {
      const stored = await AsyncStorage.getItem(key);
      if (!stored) return null;
      const encryptionKeyHex = await SecureStore.getItemAsync(key);
      const decrypted = encryptionKeyHex ? this._decrypt(encryptionKeyHex, stored) : null;
      if (decrypted !== null) return decrypted;
      await this.removeItem(key);
      return null;
    } catch (error) {
      Sentry.captureException(error);
      return null;
    }
  }

  // Clears both stores even if one delete fails, then rethrows the first failure.
  async removeItem(key: string) {
    const results = await Promise.allSettled([
      AsyncStorage.removeItem(key),
      SecureStore.deleteItemAsync(key),
    ]);
    const failed = results.find((r) => r.status === "rejected");
    if (failed) throw failed.reason;
  }

  async setItem(key: string, value: string) {
    const encrypted = await this._encrypt(key, value);
    await AsyncStorage.setItem(key, encrypted);
  }
}

const authStorage = new LargeSecureStore();
// supabase-js's own default key, spelled out so the stored session can be read without the client.
const storageKey = `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: authStorage,
    storageKey,
    persistSession: true,
    autoRefreshToken: true,
    // No browser URL to parse a session out of on native.
    detectSessionInUrl: false,
  },
});

// Reads the persisted session straight from storage without waiting for auth-js start-up;
// null when none is stored or it is malformed. Never rejects (the adapter never does).
export async function readStoredSession(): Promise<Session | null> {
  const raw = await authStorage.getItem(storageKey);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    // Same shape check as auth-js's own session validation.
    const valid =
      typeof parsed?.access_token === "string" &&
      typeof parsed?.refresh_token === "string" &&
      typeof parsed?.expires_at === "number" &&
      typeof parsed?.user?.id === "string";
    return valid ? (parsed as Session) : null;
  } catch {
    return null;
  }
}

// `autoRefreshToken` only refreshes while something is polling for it;
// Supabase's guidance is to drive that polling from app foreground state on
// native, or a backgrounded session can go stale and miss its refresh.
AppState.addEventListener("change", (state) => {
  if (state === "active") {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
