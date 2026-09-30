import { supabase } from "@/lib/supabase";

/** Uploads to a uniquely-named path per upload — never reused, since a
 * cancelled upload can't be aborted mid-flight. Returns the public URL. */
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
