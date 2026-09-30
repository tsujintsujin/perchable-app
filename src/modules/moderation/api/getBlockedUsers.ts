import { supabase } from "@/lib/supabase";
import type { BlockedUser } from "../types";

/** Reads the caller's blocks (newest first), then the blocked users' profiles by id in a second query:
 * `blocked_users` points at auth.users, so there is nothing to embed. A missing profile falls back to nulls. */
export async function getBlockedUsers(userId: string): Promise<BlockedUser[]> {
  const blocks = await supabase
    .from("blocked_users")
    .select("blocked_id")
    .eq("blocker_id", userId)
    .order("created_at", { ascending: false });
  if (blocks.error) throw blocks.error;
  const ids = blocks.data.map((row) => row.blocked_id);
  if (ids.length === 0) return [];

  const profiles = await supabase.from("profiles").select("id, display_name, avatar_url, usertag").in("id", ids);
  if (profiles.error) throw profiles.error;
  const byId = new Map(profiles.data.map((p) => [p.id, p]));
  return ids.map((id) => {
    const p = byId.get(id);
    return { id, displayName: p?.display_name ?? null, avatarUrl: p?.avatar_url ?? null, usertag: p?.usertag ?? null };
  });
}
