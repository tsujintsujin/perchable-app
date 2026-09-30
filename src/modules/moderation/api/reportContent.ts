import { supabase } from "@/lib/supabase";
import type { ReportReason } from "../objectionableCategories";
import type { ReportTarget } from "../types";

/** Files a report as the signed-in user; throws the Supabase error on failure.
 * Never chain `.select()` or use `.upsert()`: the client has INSERT only on `reports`, so either is refused (42501). */
export async function reportContent(target: ReportTarget, reason: ReportReason, details: string | null) {
  const { error } = await supabase.from("reports").insert({
    target_type: target.type,
    target_id: target.id,
    reported_user_id: target.ownerId,
    reason,
    details,
  });
  if (error) throw error;
}
