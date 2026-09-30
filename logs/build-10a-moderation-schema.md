# Build 10a — Moderation schema + admin path (Module: Moderation base)

Base SHA: 0ca5fd5 (recorded 2026-09-30, Phase 1 start). No UI, no Phase 0.
Plan: PLAN.md "Build 10a" (A1–A10, B1–B3). Manager defaults D1–D4 apply (Justin may overturn).

## Failure-mode list (Manager, before Phase 1) — each is a Done-means line + a test
1. **Nothing persists before review** — the migration is NOT applied to the live project by
   Bella. `supabase/tests/moderation_rls.sql` runs as ONE transaction: apply the migration,
   run every assertion, `rollback`. The Manager applies the migration after Ruby's review.
2. **Spoofing** — insert with someone else's `reporter_id` / `blocker_id` is rejected.
3. **Column limits** — a client cannot set `status`, `reviewed_at`, `id`, `created_at` on
   insert; cannot UPDATE or DELETE a report; cannot SELECT any report (not even own).
4. **anon** — denied on both tables and on EXECUTE of the helper.
5. **Data rules (SQL only, never live rows)** — `other` without details; 501-char details;
   self-report; self-block; duplicate report (23505); duplicate block; `profile` target with
   a mismatched id; unknown target_type / reason / status.
6. **Block privacy** — a blocked user cannot list who blocked them; user C cannot read A's
   blocks; `is_blocked_between` answers symmetric true/false only when the caller is in the
   pair, false otherwise.
7. **Cascade** — deleting an auth user removes reports they filed, reports about them, and
   blocks on either side (real `delete from auth.users` inside the rolled-back test).
8. **Function hardening** — `security definer`, `set search_path = ''`, schema-qualified
   names inside, explicit revoke from public/anon then grant to authenticated.
9. **Existing behaviour untouched** — profiles/avatars policies and the `delete-account`
   function unchanged; `supabase/tests/profiles_rls.sql` and `avatars_storage_rls.sql` still pass.
10. **Admin doc** — every query in `docs/ADMIN-MODERATION.md` was run (rolled back) and its
    output shape pasted in the log; the Storage-object removal in (c) cannot be rolled back, so
    it is documented as a step and NOT executed; limits stated (no rate limit, client-supplied
    `reported_user_id`, token lifetime, reporter cascade).
11. **Types** — `src/lib/database.types.ts` regenerated/updated for the new tables only after
    the Manager applies the migration (10b needs them); say how in the log.
12. **Secrets** — the Supabase access token is read from Credentials at run time, never
    written to the repo, logs, or the report.

B3 (ban proof on a real sign-in) is UNTESTABLE until Justin's second Google account exists.
