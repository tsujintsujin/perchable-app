import { supabase } from "@/lib/supabase";

type Updates = { avatarUrl?: string; usertag?: string };

/**
 * Updates the caller's own `profiles` row (RLS: update is column-limited to
 * display_name/avatar_url/usertag and restricted to `auth.uid() = id` —
 * Build 6's migration). Throws the raw Postgrest error on failure; the
 * caller checks `error.code === "23505"` (unique violation) to catch a
 * usertag race the live availability check missed — DESIGN.md Build 7:
 * "handle the unique-violation on save as the source of truth."
 */
export async function updateProfile(userId: string, updates: Updates): Promise<void> {
  const payload: Record<string, string> = {};
  if (updates.avatarUrl !== undefined) payload.avatar_url = updates.avatarUrl;
  if (updates.usertag !== undefined) payload.usertag = updates.usertag;

  const { error } = await supabase.from("profiles").update(payload).eq("id", userId);
  if (error) throw error;
}
