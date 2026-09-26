import { supabase } from "@/lib/supabase";

/**
 * Uploads a (already-resized/compressed) local image file to
 * `avatars/<userId>/avatar.jpg`, upserting the same path every time — one
 * avatar per user, no orphaned old files to clean up. `fetch(uri).then(res
 * => res.arrayBuffer())` is Supabase's own current recommended pattern for
 * turning an Expo/React Native local file URI into a Storage-uploadable
 * body (checked against Supabase's Expo example, not memory).
 *
 * Returns a cache-busted public URL — the storage path never changes
 * between uploads (upsert overwrites the same file), so without a query
 * param the `Image` component and any HTTP cache would keep showing the
 * previous photo's bytes at that same URL.
 */
export async function uploadAvatar(userId: string, localUri: string): Promise<string> {
  const path = `${userId}/avatar.jpg`;
  const arraybuffer = await fetch(localUri).then((res) => res.arrayBuffer());

  const { error } = await supabase.storage.from("avatars").upload(path, arraybuffer, {
    contentType: "image/jpeg",
    upsert: true,
  });
  if (error) throw error;

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}
