import { supabase } from "@/lib/supabase";

/**
 * Live availability check for the edit-profile usertag field. Excludes the
 * caller's own row so re-saving your current usertag unchanged never flags
 * itself as taken. `usertag` must already be lowercased by the caller — the
 * DB's CHECK constraint requires stored values to already be lowercase, so
 * a mixed-case query would silently report "available" when it shouldn't.
 */
export async function checkUsertagAvailable(usertag: string, ownUserId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("usertag", usertag)
    .neq("id", ownUserId)
    .maybeSingle();

  if (error) throw error;
  return data === null;
}
