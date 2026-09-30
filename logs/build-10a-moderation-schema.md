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

## Ruby plan recheck (0ca5fd5): PASS — notes carried into the briefs
- 10a: every function body schema-qualifies all objects (`public.…`, `auth.uid()`), since
  `search_path = ''` breaks unqualified names silently. tsc/lint/jest are trivially green in 10a
  (no client code) — they are regression gates only, NOT evidence; the SQL test is the evidence.
- 10b: the dev harness is assigned at module scope (`const Harness = __DEV__ ? require(...).X : null`);
  the bundle check has a control — the dev bundle must contain the marker, the release export must not.

---
# Phase 1-2 report (Bella)

Base SHA for this Build's work: adced78 (branch `module/moderation`).

## What was built (concept level)
Two tables and one helper function, all in `supabase/migrations/20260930000000_moderation.sql`, plus
an admin cheat sheet. No client code, no UI, nothing applied to the live project.

- **`reports`**: a user files a report about a profile (later comment / DM / caption). The app can only
  *insert*: it can never read reports back (not even its own), change them, or delete them. Justin reads and
  closes them in the SQL editor, which bypasses RLS. `status`, `reviewed_at`, `id`, `created_at` are not in the
  INSERT grant, so a client cannot set them; `reporter_id` fills from `auth.uid()` and the RLS policy pins it.
- **`blocked_users`**: who blocked whom. A user can read, add and remove **only their own** blocks, so nobody
  can list who has blocked them.
- **`is_blocked_between(a, b)`**: a yes/no helper for later policies (comments, DMs). It must be
  `security definer` because the caller cannot read the other side's block row. It answers only when the caller
  is one of the two users, and only "is there a block either way", never who did it.
- **`docs/ADMIN-MODERATION.md`**: copy-paste SQL for Justin. Every query was run once on seeded data in a
  rolled-back transaction (`supabase/tests/admin_doc_queries.sql`).

How the test works: `supabase/tests/moderation_rls.sql` is one transaction: begin, migration text (pasted in by
`supabase/tests/run-sql.mjs` at the marker), assertions, rollback. The runner sends it to the Supabase
Management API `database/query` endpoint. It reads `SUPABASE_ACCESS_TOKEN` from
`D:\AIO Freelance\Credentials\perchable\.env` at run time; the token is never written or printed.
Command: `node supabase/tests/run-sql.mjs supabase/tests/moderation_rls.sql --migration supabase/migrations/20260930000000_moderation.sql`.
After the runs the live database has no `reports` / `blocked_users` / function (checked, see below).

## Why this way
- **Column-level INSERT grant + RLS policy, both.** The grant blocks the columns a client must never set; the
  policy blocks spoofing `reporter_id`. Test `report_spoofed_reporter_id_rls_policy_alone` temporarily grants
  the column inside the transaction to prove the policy holds by itself.
- **text + CHECK, not enums** (PLAN A2): a later surface adds a target type with one constraint change.
- **No FK on `target_id`**: polymorphic, and a report must outlive its content.
- **Helper visibility trade-off (Ruby M1, accepted in PLAN):** a caller can learn a block exists between
  themselves and one other named user, not who started it.
- **`revoke all` before every grant**, because Supabase's default privileges hand `anon`/`authenticated`
  broad access on new tables and functions.
- Alternatives rejected: a report-status enum (harder to extend); a SELECT policy letting reporters see their
  own reports (PLAN says never); one `for all` policy on blocked_users (blurs the no-UPDATE rule).
- Small runner script instead of copy-pasting the migration into the test: the test can never drift from the
  real migration.

## Concepts learned (RN / Expo / Supabase)
- Postgres column-level privileges (`grant insert (cols)`) vs RLS: privileges are checked first (SQLSTATE 42501
  "permission denied"), then RLS `with check` (also 42501), then CHECK / UNIQUE constraints (23514 / 23505).
- `security definer` + `set search_path = ''` means every object in the body must be schema-qualified
  (`public.blocked_users`, `auth.uid()`), otherwise it silently fails to resolve.
- `on delete cascade` on `auth.users` FKs is what makes account deletion leave no rows behind.
- Testing SQL policies: `set local role authenticated` + `set_config('request.jwt.claims', ...)` impersonates a
  user inside one rolled-back transaction.

## Spec-trace table
| PLAN line | Where |
|---|---|
| A1 reports columns, FKs cascade, default `auth.uid()`, details max 500, reviewed_at null | migration `create table public.reports`; tests `details_500_chars_ok`, `details_501_chars` |
| A2 target_type / reason / status CHECKs, `other` needs details | migration `reports_target_type_check` .. `reports_other_needs_details`; tests `unknown_target_type`, `unknown_reason`, `unknown_status`, `other_without_details`, `other_blank_details`, `other_target_types_ok` |
| A3 no self-report, profile target = reported user, one report per target | migration `reports_no_self_report`, `reports_profile_target_matches`, `reports_one_per_target`; tests `self_report`, `profile_target_id_mismatch`, `duplicate_report` |
| A4 revoke, column grant, insert-only RLS, anon denied | migration `revoke all` + `grant insert (...)` + `reports_insert_own`; tests items 2, 3, 4 (`insert_status/reviewed_at/id/created_at`, `select_*`, `update_*`, `delete_report_denied`, `anon_*`) |
| A5 blocked_users PK, cascade FKs, no self-block | migration `create table public.blocked_users`; tests `duplicate_block`, `self_block` |
| A6 blocked_users grants and policies, no UPDATE, no listing of blockers | migration `grant select, delete` / `grant insert (...)` / three policies; tests `update_block_denied`, `B_lists_blocked_users_rows`, `B_cannot_see_blocker_via_filter`, `C_reads_As_blocks`, `A_can_unblock`, `block_spoofed_blocker_id` |
| A7 indexes | migration (3 indexes); tests `partial_open_index`, `reported_user_index`, `blocked_id_index`, `rls_enabled_on_both_tables` |
| A8 helper symmetric, caller-in-pair only, definer, search_path, grants | migration `is_blocked_between` + revoke/grant; tests `helper_*`, item 8 rows, `anon_execute_is_blocked_between` |
| A9 cascade both sides of both tables | tests `delete_D_*`, `delete_F_rows_left_involving_F` (real `delete from auth.users`) |
| A10 only two tables + helper | migration touches nothing else (`git show --stat`); tests `profiles_policies_unchanged`, `avatars_policies_unchanged` |
| B1 (a)-(e) + Notes | `docs/ADMIN-MODERATION.md` sections (a)-(e), "Limits you should know about" |
| B2 run (a)-(d) rolled back | `supabase/tests/admin_doc_queries.sql`, output below |
| B3 ban proof on real sign-in | **UNTESTABLE until Justin's second Google account exists.** The ban SQL is proven at SQL level only. |

## Failure-mode item -> handling -> test rows
| # | Handling | Named test rows |
|---|---|---|
| 1 | Migration not applied live; test = migrate + assert + rollback in one transaction. After the runs the live DB was checked: `to_regclass('public.reports')`, `blocked_users`, `is_blocked_between` all null. | live check below |
| 2 | column grant excludes `reporter_id`; RLS `with check`; blocker policy | item 2 rows (6) |
| 3 | INSERT grant lists 5 columns; no SELECT/UPDATE/DELETE grant on reports | item 3 rows (10) |
| 4 | `revoke all ... from anon`; function revoke from public, anon | item 4 rows (5) |
| 5 | CHECK / UNIQUE / PK constraints | item 5 rows |
| 6 | SELECT policy = own blocks only; helper gated on caller in pair | item 6 rows |
| 7 | `on delete cascade` on all four FKs | item 7 rows (5) |
| 8 | `security definer`, `search_path = ''`, qualified names, revoke then grant | item 8 rows (6) |
| 9 | migration touches only new objects; profiles + avatars tests re-run | item 9 rows, regression output below |
| 10 | Admin doc queries run rolled back, output below; Storage-object removal documented as a Dashboard step and **not executed**; limits section written | admin output below |
| 11 | Types not updated (migration not applied). After the Manager applies it, run: `SUPABASE_ACCESS_TOKEN=<from Credentials/perchable/.env> npx supabase gen types typescript --project-id vpcuornksvqziqzzpiwq > src/lib/database.types.ts`, then re-run tsc. 10b needs the two tables and the function. | n/a |
| 12 | Token read at run time by `run-sql.mjs`, never printed or stored; staged files checked for `.env` / token strings before commit | n/a |

Mutation check (the test can fail): a mutant migration without the function `revoke`, with `with check (true)`
on the reports policy and `using (true)` on the blocked_users select policy gave `pass=59 fail=7`
(caught: `report_spoofed_reporter_id_rls_policy_alone`, `B_lists_blocked_users_rows`,
`B_cannot_see_blocker_via_filter`, `block_survived_B_and_C_deletes`, `anon_execute_is_blocked_between`,
`anon_has_no_execute`, `public_pseudo_role_has_no_execute`). The real migration gives fail=0.

## LESSONS checklist
- Spec compliance / copy strings / pressed states: n/a (no UI). Spec-trace table above.
- Failure paths: every DB rule has a rejecting test row; Sentry / async / unmount: n/a (no client code).
- Server code validating input: DB CHECK constraints validate every inserted field.
- Orphans: reports and blocks cascade on account deletion (item 7). Reports deliberately outlive their content
  (no FK on `target_id`).
- act() warnings: `npx jest` output has 0 `act(` and 0 console warnings.
- Android / fonts / emulator / QA-testing-environment items: n/a (no UI, no emulator).
- Coding standards (tokens, safe-area, provider, secure-store, typed rows): n/a (no client code). Purpose
  comment above every SQL block: done. No Build/Bug history in code comments: done.
- Never commit a file not written in this task: staged by name. `discord_modal.png` (pre-existing untracked) and
  Dianne's `docs/DESIGN.md` edit are not committed.
- Moderation carry-forward 1-5 (terms gate on UGC INSERT, `is_blocked_between` in comment/DM policies, ReportSheet
  callers, `requireTerms`, admin-doc removal queries): n/a in 10a, they bind Builds 20, 24, 25, 27, 28; (e) holds the
  placeholder headings. Rule 6 (function hardening): done and tested.

## Gate output
- `npx tsc --noEmit`: exit 0. `npx expo lint`: exit 0, no warnings. `npx jest > out.txt 2>&1`: 19 suites /
  132 tests passed; `grep -c "act("` = 0; console warn/error lines = 0. `out.txt` deleted after reading.
- "App starts": n/a this Build (no client code changed; diff is only supabase/, docs/, logs/).
- Regression, with the migration applied inside the same transaction (`--migration`): `profiles_rls.sql` and
  `avatars_storage_rls.sql` gave exactly the same rows as their baseline run without the migration
  (trigger_rows 2, mapped, auth_can_select_all 3, update_other_affected 0, update_own cineowl, bad_tag 23514,
  created_at_write 42501, client_insert 42501, client_delete 42501, anon_select 42501, dup_tag 23505,
  cascade_rows_left 0; insert_own ok, insert_other 42501, insert_root 42501, select_visible 1, anon_list 0).
- Live DB after all runs: `reports`, `blocked_users`, `is_blocked_between` all `null` (nothing persisted).

## SQL result table: `moderation_rls.sql` (pass=66 fail=0)
Columns: item | check | expected | actual | result
```
2 | report_as_self_ok | ok | ok | PASS
2 | report_spoofed_reporter_id | 42501 | 42501 | PASS
2 | block_as_self_ok | ok | ok | PASS
2 | block_spoofed_blocker_id | 42501 | 42501 | PASS
2 | report_spoofed_reporter_id_rls_policy_alone | 42501 | 42501 | PASS
2 | report_own_reporter_id_rls_passes | ok | ok | PASS
3 | insert_status | 42501 | 42501 | PASS
3 | insert_reviewed_at | 42501 | 42501 | PASS
3 | insert_id | 42501 | 42501 | PASS
3 | insert_created_at | 42501 | 42501 | PASS
3 | select_reports_denied | 42501 | 42501 | PASS
3 | select_own_report_denied | 42501 | 42501 | PASS
3 | update_status_denied | 42501 | 42501 | PASS
3 | update_details_denied | 42501 | 42501 | PASS
3 | delete_report_denied | 42501 | 42501 | PASS
3 | update_block_denied | 42501 | 42501 | PASS
5 | other_without_details | 23514 | 23514 | PASS
5 | other_blank_details | 23514 | 23514 | PASS
5 | other_with_details_ok | ok | ok | PASS
5 | details_500_chars_ok | ok | ok | PASS
5 | details_501_chars | 23514 | 23514 | PASS
5 | self_report | 23514 | 23514 | PASS
5 | duplicate_report | 23505 | 23505 | PASS
5 | profile_target_id_mismatch | 23514 | 23514 | PASS
5 | unknown_target_type | 23514 | 23514 | PASS
5 | unknown_reason | 23514 | 23514 | PASS
5 | other_target_types_ok | ok | ok | PASS
5 | self_block | 23514 | 23514 | PASS
5 | duplicate_block | 23505 | 23505 | PASS
6 | A_sees_own_block | 1 | 1 | PASS
6 | helper_A_in_pair_AB | true | true | PASS
6 | helper_A_in_pair_BA_symmetric | true | true | PASS
6 | helper_A_pair_AC_no_block | false | false | PASS
6 | helper_A_not_in_pair_BC | false | false | PASS
6 | B_lists_blocked_users_rows | 0 | 0 | PASS
6 | B_cannot_see_blocker_via_filter | 0 | 0 | PASS
6 | helper_B_in_pair_true | true | true | PASS
6 | C_reads_As_blocks | 0 | 0 | PASS
6 | helper_C_not_in_pair_AB | false | false | PASS
6 | block_survived_B_and_C_deletes | 1 | 1 | PASS
6 | A_can_unblock | 0 | 0 | PASS
4 | anon_select_reports | 42501 | 42501 | PASS
4 | anon_insert_reports | 42501 | 42501 | PASS
4 | anon_select_blocked_users | 42501 | 42501 | PASS
4 | anon_insert_blocked_users | 42501 | 42501 | PASS
4 | anon_execute_is_blocked_between | 42501 | 42501 | PASS
5 | unknown_status | 23514 | 23514 | PASS
5 | status_reviewed_ok_via_admin | ok | ok | PASS
6 | helper_no_caller_false | false | false | PASS
7 | delete_D_reports_left_involving_D | 0 | 0 | PASS
7 | delete_D_blocks_left_involving_D | 0 | 0 | PASS
7 | delete_D_unrelated_report_kept | 1 | 1 | PASS
7 | delete_D_unrelated_block_kept | 1 | 1 | PASS
7 | delete_F_rows_left_involving_F | 0 | 0 | PASS
8 | security_definer | true | true | PASS
8 | search_path_empty | true | true | PASS
8 | anon_has_no_execute | false | false | PASS
8 | authenticated_has_execute | true | true | PASS
8 | public_pseudo_role_has_no_execute | 0 | 0 | PASS
8 | body_names_are_schema_qualified | true | true | PASS
A7 | rls_enabled_on_both_tables | 2 | 2 | PASS
A7 | partial_open_index | true | true | PASS
A7 | reported_user_index | 1 | 1 | PASS
A7 | blocked_id_index | 1 | 1 | PASS
9 | profiles_policies_unchanged | profiles_select_authenticated,profiles_update_own | profiles_select_authenticated,profiles_update_own | PASS
9 | avatars_policies_unchanged | 4 | 4 | PASS
pass=66 fail=0
```

## Admin doc queries, rolled back (`admin_doc_queries.sql`): output shapes
```
a_open_reports | [{"reason":"harassment","details":"abusive name","report_id":"99999999-0000-0000-0000-000000000009","target_id":"22222222-0000-0000-0000-000000000002","created_at":"2026-09-30T12:51:41.099683+00:00","target_type":"profile","reported_tag":"badactory","reporter_tag":"reporterx","reported_name":"Bad Actor Y","reporter_name":"Reporter X","reported_user_id":"22222222-0000-0000-0000-000000000002"}]
b_after_mark_actioned | {"id":"99999999-0000-0000-0000-000000000009","status":"actioned","has_reviewed_at":true}
b_open_reports_left | 0
c_avatar_files | ["22222222-0000-0000-0000-000000000002/avatar.jpg"]
c_profile_after_clear | {"usertag":null,"avatar_url":null,"display_name":null}
d_after_ban | {"email":"y@example.test","banned_until":"infinity"}
d_sessions_and_tokens_left | {"sessions":0,"refresh_tokens":0}
d_after_unban | {"email":"y@example.test","banned_until":null}
```
Storage-object removal (c step 3) is a Dashboard action: documented, **not executed**. No `banned_until` was set
on any real user (the ban ran on a seeded user inside the rolled-back transaction).

## PLAN problems / ambiguities
- **A2 "the seven categories"** is defined only in PLAN's "Shared vocabulary" paragraph (spam, harassment, hate,
  sexual, violence, impersonation, other); used verbatim in `reports_reason_check`. A2 should point at it.
- **B1(d) `banned_until = 'infinity'`**: Postgres accepts it (proved), but whether GoTrue refuses sign-in for
  `infinity` is only provable at B3 (UNTESTABLE for now). The doc names `'2999-12-31'` as the fallback; the Manager
  may prefer to switch the doc to the far date up front.
- **B1(a)** uses `left join` on profiles so a missing profile row can never hide a report.
- Test-file shape: the file holds a marker and `run-sql.mjs` pastes the migration in, so it is not runnable
  as-is in the SQL editor (paste the migration at the marker).
