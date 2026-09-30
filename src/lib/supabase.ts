import "react-native-url-polyfill/auto";
import "react-native-get-random-values";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as aesjs from "aes-js";
import { createClient } from "@supabase/supabase-js";
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

  // Returns null when the stored value cannot be decrypted (no key, malformed hex).
  private async _decrypt(key: string, value: string) {
    const encryptionKeyHex = await SecureStore.getItemAsync(key);
    if (!encryptionKeyHex || !HEX_PATTERN.test(value)) return null;
    const cipher = new aesjs.ModeOfOperation.ctr(
      aesjs.utils.hex.toBytes(encryptionKeyHex),
      new aesjs.Counter(1),
    );
    const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(value));
    return aesjs.utils.utf8.fromBytes(decryptedBytes);
  }

  // Reads the session; a value that cannot be decrypted (legacy plaintext, corrupt) is removed and treated as signed out.
  async getItem(key: string) {
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) return null;
    try {
      const decrypted = await this._decrypt(key, encrypted);
      if (decrypted !== null) return decrypted;
    } catch (error) {
      // Unexpected SecureStore failure: keep the entry (may be transient) and sign the user out for this launch.
      Sentry.captureException(error);
      return null;
    }
    await this.removeItem(key);
    return null;
  }

  async removeItem(key: string) {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key);
  }

  async setItem(key: string, value: string) {
    const encrypted = await this._encrypt(key, value);
    await AsyncStorage.setItem(key, encrypted);
  }
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: new LargeSecureStore(),
    persistSession: true,
    autoRefreshToken: true,
    // No browser URL to parse a session out of on native.
    detectSessionInUrl: false,
  },
});

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
