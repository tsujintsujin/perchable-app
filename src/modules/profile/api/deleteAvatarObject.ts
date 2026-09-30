import { supabase } from "@/lib/supabase";
import { Sentry } from "@/lib/sentry";

const AVATARS_PUBLIC_PATH = "/storage/v1/object/public/avatars/";

/** Pulls the Storage path out of one of our own avatar public URLs, or
 * `null` if it isn't clearly this user's own object. Exported for tests. */
export function extractOwnAvatarPath(avatarUrl: string, userId: string): string | null {
  const idx = avatarUrl.indexOf(AVATARS_PUBLIC_PATH);
  if (idx === -1) return null;
  const path = avatarUrl.slice(idx + AVATARS_PUBLIC_PATH.length).split("?")[0];
  if (!path.startsWith(`${userId}/`)) return null;
  return path;
}

/** Best-effort delete of one avatar object. Never throws — failures go to
 * Sentry instead of surfacing as a user-facing save/cancel error. */
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
