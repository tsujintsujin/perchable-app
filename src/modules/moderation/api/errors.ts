import { Sentry } from "@/lib/sentry";

/** Postgres SQLSTATE for "unique violation": the row already exists. */
export const UNIQUE_VIOLATION = "23505";

/** The SQLSTATE on a Supabase error, or "" when there is none (a network failure). */
export function errorCode(err: unknown): string {
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : "";
}

/** Sends an unexpected failure to Sentry as a fresh error carrying only the action and SQLSTATE,
 * never the original message (it can echo the row, e.g. report details). No code = offline, not reported. */
export function reportUnexpected(action: string, err: unknown) {
  const code = errorCode(err);
  if (!code) return;
  Sentry.captureException(new Error(`${action} failed: ${code}`), { tags: { action, code } });
}
