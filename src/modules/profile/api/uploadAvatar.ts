import { supabase } from "@/lib/supabase";

/**
 * Uploads a (already-resized/compressed) local image file to a uniquely
 * named `avatars/<userId>/avatar-<timestamp>.jpg` object — never a fixed,
 * reused path, since the upload itself can't be aborted mid-flight and a
 * reused path could let a cancelled upload overwrite the current photo.
 * `useAvatarUpload` cleans up each now-unreferenced object afterward via
 * `deleteAvatarObject`. Returns the plain public URL.
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
