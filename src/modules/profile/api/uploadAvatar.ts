import { supabase } from "@/lib/supabase";

/**
 * Uploads a (already-resized/compressed) local image file to
 * `avatars/<userId>/avatar-<timestamp>.jpg` — a **uniquely-named** object
 * per upload, not a fixed/reused path. `fetch(uri).then(res =>
 * res.arrayBuffer())` is Supabase's own current recommended pattern for
 * turning an Expo/React Native local file URI into a Storage-uploadable
 * body (checked against Supabase's Expo example, not memory).
 *
 * Build 7 · Bug 1: this used to upsert a single fixed path
 * (`<uid>/avatar.jpg`) with a `?v=<timestamp>` query param on the returned
 * URL for cache-busting. That was broken for cancel-mid-upload: the
 * *upload itself* can't be aborted (supabase-js gives no cancel token for
 * `storage.upload`), so a user cancelling while the spinner was showing
 * still let the network call finish and overwrite the fixed path with the
 * new bytes — the query param only changes the client-side cache key, not
 * the object identity, so the OLD `avatar_url` (still pointing at the same
 * path, just an older `?v=`) would start serving the NEW, cancelled photo
 * the moment any cache (client or CDN) was bypassed, including after a
 * cold relaunch. A unique path per upload removes that failure mode
 * entirely: nothing ever gets overwritten. The tradeoff it introduces —
 * every photo change or cancelled pick leaves its now-unreferenced object
 * behind, forever, since nothing ever reuses a path to overwrite it — is
 * handled by `deleteAvatarObject` (Build 7 · Bug 1b), called from
 * `edit.tsx` right after a cancel and right after a successful replace.
 *
 * Returns the plain public URL — no `?v=` needed any more, the path itself
 * is already unique per upload, so there's nothing to cache-bust around.
 */
export async function uploadAvatar(userId: string, localUri: string): Promise<string> {
  const path = `${userId}/avatar-${Date.now()}.jpg`;
  const arraybuffer = await fetch(localUri).then((res) => res.arrayBuffer());

  const { error } = await supabase.storage.from("avatars").upload(path, arraybuffer, {
    contentType: "image/jpeg",
  });
  if (error) throw error;

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}
