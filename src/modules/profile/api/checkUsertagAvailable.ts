import { supabase } from "@/lib/supabase";

/** Live usertag check, excluding the caller's own row. `usertag` must already
 * be lowercased — the DB's CHECK constraint requires it. */
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
