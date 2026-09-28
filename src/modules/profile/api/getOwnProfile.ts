import { supabase } from "@/lib/supabase";
import type { Profile } from "../types";

/** Reads the signed-in user's own `profiles` row. The row always exists by
 * the time this is called — the `on_auth_user_created` DB trigger creates
 * it at sign-up, before the app ever gets a session. */
export async function getOwnProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, usertag, created_at, updated_at")
    .eq("id", userId)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Profile not found");
  }

  return {
    id: data.id,
    displayName: data.display_name,
    avatarUrl: data.avatar_url,
    usertag: data.usertag,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}
