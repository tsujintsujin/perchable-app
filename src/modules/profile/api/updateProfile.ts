import { supabase } from "@/lib/supabase";
import { authReady } from "@/lib/requestTimeout";
import type { TablesUpdate } from "@/lib/database.types";

type Updates = { avatarUrl?: string; usertag?: string };

/** Updates the caller's own `profiles` row (RLS-limited columns and rows).
 * Throws the raw Postgrest error — callers check `error.code === "23505"`. */
export async function updateProfile(userId: string, updates: Updates): Promise<void> {
  const payload: TablesUpdate<"profiles"> = {};
  if (updates.avatarUrl !== undefined) payload.avatar_url = updates.avatarUrl;
  if (updates.usertag !== undefined) payload.usertag = updates.usertag;

  await authReady();
  const { error } = await supabase.from("profiles").update(payload).eq("id", userId);
  if (error) throw error;
}
