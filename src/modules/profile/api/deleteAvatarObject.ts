import { supabase } from "@/lib/supabase";
import { Sentry } from "@/lib/sentry";

const AVATARS_PUBLIC_PATH = "/storage/v1/object/public/avatars/";

/**
 * Pulls the Storage object path (e.g. `<uid>/avatar-123.jpg`) out of one of
 * our own avatar public URLs — and only that. Returns `null` (nothing to
 * delete) for anything that isn't clearly our own `avatars` bucket object
 * under the given user's own folder: a Google-provided avatar URL (Build
 * 5/6 can fall back to one before a photo is ever uploaded), a URL from a
 * different bucket, or — as defense in depth, since RLS already prevents a
 * user's own `avatar_url` from ever pointing outside their folder — a path
 * whose first segment isn't `userId`. Exported for its own unit tests.
 */
export function extractOwnAvatarPath(avatarUrl: string, userId: string): string | null {
  const idx = avatarUrl.indexOf(AVATARS_PUBLIC_PATH);
  if (idx === -1) return null;
  const path = avatarUrl.slice(idx + AVATARS_PUBLIC_PATH.length).split("?")[0];
  if (!path.startsWith(`${userId}/`)) return null;
  return path;
}

/**
 * Best-effort delete of one avatar object, by its full public URL. Never
 * throws — a failed cleanup must never surface as a save/cancel error to
 * the user (Build 7 · Bug 1b): the object is at worst a few KB of orphaned
 * Storage that account deletion's own full-folder cleanup sweeps up
 * regardless. Failures are reported to Sentry so they're visible without
 * being user-facing.
 */
export async function deleteAvatarObject(userId: string, avatarUrl: string): Promise<void> {
  const path = extractOwnAvatarPath(avatarUrl, userId);
  if (!path) return;

  try {
    const { error } = await supabase.storage.from("avatars").remove([path]);
    if (error) throw error;
  } catch (err) {
    Sentry.captureException(err);
  }
}
