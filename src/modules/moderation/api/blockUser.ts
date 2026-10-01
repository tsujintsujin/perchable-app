import { supabase } from "@/lib/supabase";

/** Records that `blockerId` blocked `blockedId`; throws the Supabase error on failure (23505 = already blocked). */
export async function blockUser(blockerId: string, blockedId: string) {
  const { error } = await supabase.from("blocked_users").insert({ blocker_id: blockerId, blocked_id: blockedId });
  if (error) throw error;
}

/** Removes the caller's block on `blockedId`; throws the Supabase error on failure. */
export async function unblockUser(blockerId: string, blockedId: string) {
  const { error } = await supabase
    .from("blocked_users")
    .delete()
    .eq("blocker_id", blockerId)
    .eq("blocked_id", blockedId);
  if (error) throw error;
}
