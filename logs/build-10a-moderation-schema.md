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

---
# QA (Queenie, Phase 3) — no UI, no emulator, no screenshots

Re-ran both SQL tests myself (rolled back, live DB unchanged; no ban/data touched, emulator untouched).
Evidence: `logs/evidence/build-10a/qa-moderation-rls.txt` (pass=66 fail=0, 66 rows identical to Bella's table,
checked by diff) and `qa-admin-doc-queries.txt` (8 rows, same shapes as Bella's). Secret scan of both files: no
`sbp_` / bearer / JWT strings (the only "token" hit is the row name `d_sessions_and_tokens_left`).

## Coverage: PLAN line / failure-mode item -> proving rows
| Line | Proving row(s) | Result |
|---|---|---|
| A1 columns, default uid, 500 max, cascade FKs | report_as_self_ok (default reporter_id), details_500_chars_ok, details_501_chars, delete_D_* | PASS |
| A1 `status` default open, `reviewed_at` null on fresh insert | no direct row; only indirect (partial_open_index, admin query (a) returns the report as open) | WEAK: no explicit row |
| A1 no FK on target_id | other_target_types_ok inserts random uuids for comment/dm_message/collection_item | PASS (indirect) |
| A2 CHECKs, other needs details | unknown_target_type, unknown_reason, unknown_status, other_without_details, other_blank_details, other_with_details_ok, other_target_types_ok | PASS |
| A3 self-report, profile id match, one per target | self_report, profile_target_id_mismatch, duplicate_report | PASS |
| A4 grants/RLS/anon | insert_status/reviewed_at/id/created_at, select_reports_denied, select_own_report_denied, update_status_denied, update_details_denied, delete_report_denied, report_spoofed_reporter_id(+_rls_policy_alone), anon_select/insert_reports | PASS |
| A5 PK, self-block | duplicate_block, self_block | PASS |
| A6 blocked_users grants/policies | update_block_denied, B_lists_blocked_users_rows, B_cannot_see_blocker_via_filter, C_reads_As_blocks, A_sees_own_block, A_can_unblock, block_survived_B_and_C_deletes, block_spoofed_blocker_id, anon_*_blocked_users | PASS |
| A7 indexes | partial_open_index, reported_user_index, blocked_id_index, rls_enabled_on_both_tables | PASS |
| A8 helper | helper_A_in_pair_AB/BA, _AC_no_block, _not_in_pair_BC, _B_in_pair_true, _C_not_in_pair_AB, _no_caller_false, security_definer, search_path_empty, body_names_are_schema_qualified, anon_has_no_execute, anon_execute_is_blocked_between, authenticated_has_execute, public_pseudo_role_has_no_execute | PASS |
| A9 cascade both sides, both tables | delete_D_reports/blocks_left (seed has D as reporter, reported, blocker, blocked), delete_D_unrelated_*_kept, delete_F_rows_left | PASS |
| A10 only two tables + helper, nothing else touched | profiles_policies_unchanged, avatars_policies_unchanged (policies only; file-level scope is Mgr's read of the migration, not re-checked by me) | PASS (partly Mgr) |
| B1 doc | see readability below | see below |
| B2 doc queries run | qa-admin-doc-queries.txt rows a..d | PASS |
| B3 ban on real sign-in | **UNTESTABLE — Justin to check** once second Google account exists | UNTESTABLE |
| FM2 spoofing | item-2 rows (6) | PASS |
| FM3 column limits | item-3 rows (10) | PASS |
| FM4 anon | item-4 rows (5) | PASS |
| FM5 data rules | item-5 rows (13) | PASS |
| FM6 block privacy | item-6 rows | PASS |
| FM7 cascade | item-7 rows (5) | PASS |
| FM8 hardening | item-8 rows (6) | PASS |
| FM9 existing behaviour | profiles_policies_unchanged, avatars_policies_unchanged. I did NOT re-run profiles_rls.sql / avatars_storage_rls.sql (not asked); Bella's log claims identical output | PASS on policy rows; regression suites unverified by me |

No plan line is fully without a row. One weak line (A1 default status / null reviewed_at).

## Admin doc readability (read as Justin)
Good: plain intro, every query has a "What it does" line, (b)/(c)/(d) name the choices, the "a report is a lead"
warning is at the top, and the Storage-delete step says up front it cannot be undone.

Findings:
1. **No "what you will see / how to tell it worked" for most queries.** (a) does not say "an empty result means no
   open reports". (b), (c) step 1 and (d) ban/unban are `update`/`delete` statements: the editor just says
   "Success. No rows returned" (or "N rows affected"), and the doc never says so or tells him to re-run (a) or the
   check query. Only the last query in (d) is a check, and it is placed after unban and never described
   ("banned_until shows infinity when banned, empty when not").
2. **Two placeholders differ and are not explained.** `'<report_id from query (a)>'` reads like a sentence; he may
   paste "from query (a)" literally or drop the quotes. `<user_id>` is never said to be the `reported_user_id` column
   from (a). The intro says "keep the quotes" but (c) step 2 is `'<user_id>/%'`: the `<user_id>` sits inside the
   quotes with `/%`, so "replace the placeholder" needs care. Quote: `name like '<user_id>/%'`.
3. **Wrong-id risk is not warned.** A typo or unquoted/missing where-id gives 0 rows changed silently; nothing says to
   check the "1 row affected" count. Nothing warns that deleting the `where` line changes every row.
4. **Warnings after the query, not before.** (d) "Make it bite right now" deletes sessions/tokens (cannot be undone,
   but harmless: user just signs in again) with no caution. (c) step 1 blanks `usertag` and display_name with no
   note that the old values are lost (no way to restore; he should copy them from (a) first). "The user can set them
   again later" is above the query, but not that the previous values are gone.
5. **`(c)` order:** step 1 (clear profile) then step 2 (list files) then step 3 (delete, cannot be undone) is OK, but
   step 3 is written as one dense paragraph; "select all, Delete" is easy to skim past. Suggest a bold "Cannot be
   undone" label as the first words.
6. **`'infinity'` fallback is a hidden branch.** The last paragraph of (d) says the ban may not work and to use
   `'2999-12-31'` instead, but this is unresolved until B3. Justin cannot tell whether to believe the ban works
   today. Quote: "If that check shows the ban does not stop sign-in, use a far date". He should be told plainly now
   that the ban is unproven on a real sign-in (or the doc should default to the far date, as Bella suggested).
7. **Jargon:** "RLS", "service role", "access token", "refresh tokens", "dm_message", "collection_item" are used
   without a gloss (RLS appears in the intro and in the limits list). "Storage" vs "storage.objects" both appear.
8. **Ban wording.** "a banned one cannot" sign up again is asserted from Build 9 reasoning, not proven (B3).
9. The doc says the SQL was run "against the real database schema" — true, but it does not mention that reports do
   not exist live until the Manager applies the migration; running (a) before that gives "relation does not exist".

## Verdict
**PARTIAL.** Database evidence is solid: 66/66 independently reproduced, byte-for-byte same rows, no secret leaks,
coverage complete except one weak line (A1 default status/reviewed_at, no explicit row). B3 UNTESTABLE — Justin to
check with the second Google account. Doc findings 1, 2, 4 and 6 are real usability gaps for a non-database reader
(recommend a small doc fix, not a Bug against the schema). Nothing was changed in the live database.

---
# Build 10a · Bug 1 (Bella) — from Ruby's review and Queenie's QA

Base: c1f1ae2. Migration logic unchanged; nothing applied live; no emulator.

## Cause and fix, per item
1. **Ban was several separate steps and overclaimed.** Cause: the doc gave the update and the session deletes as
   separate snippets, and said deleting sessions makes the ban bite immediately. Fix: (d) is now ONE block
   (update, `delete from auth.sessions`, `delete from auth.refresh_tokens`, final `select`). `auth.refresh_tokens.user_id`
   is `character varying` (checked in `information_schema`), `auth.sessions.user_id` and `session_id` are uuid, so the
   uuid is passed as a plain quoted literal for both (no `::uuid` cast on the refresh_tokens compare). The doc now
   says sessions stop *refresh* only; an issued access token works up to about an hour, in which a banned user could
   delete their own account and sign up again (erasing reports about them); run the block promptly, note the email first.
2. **Ban value**: `'infinity'` replaced by `now() + interval '100 years'` in the doc and `admin_doc_queries.sql`;
   fallback paragraph removed; doc states the ban is proven at SQL level only until B3. PLAN.md untouched.
3. **Doc usability**: what-you'll-see line for every query; concrete example uuid and exact source column;
   "replace the whole <...> including angle brackets"; row-count guidance implemented with `returning` on (b), (c)
   step 1 and unban, and a final `select` in the ban block (the editor only shows the last statement; a bare
   update says "Success. No rows returned", which cannot show a row count); warnings placed before (c) and (d);
   "one block at a time / highlighted text only"; 5-line glossary; Notes gained "no cap on blocks" and "user id
   existence via FK errors". Query (a) now also returns `reported_email` (join `auth.users`), because the brief
   says to note the email from (a) and (a) had no email.
4. **run-sql.mjs**: exits 1 on any FAIL row or `fail=` > 0; exits 2 with a message if `--migration` is given and the
   anchor is missing. The anchor is now strictly the `-- @@MIGRATION@@` marker; the `begin;` fallback used for the
   older profiles/avatars regression files is now an explicit `--after-begin` flag (so a forgotten marker cannot
   silently fall back). Checked: marker-less file with `--migration` -> exit 2; mutant -> exit 1; real -> exit 0.
5. **moderation_rls.sql**: 24 new privilege rows (28 new rows in total, 66 to 94) (`has_table_privilege` SELECT/UPDATE/DELETE/TRUNCATE/REFERENCES/
   TRIGGER on reports; UPDATE/TRUNCATE/REFERENCES/TRIGGER on blocked_users; `has_any_column_privilege` SELECT/UPDATE/
   REFERENCES on reports and UPDATE on blocked_users; all for both `anon` and `authenticated`), fresh-report default
   rows (`fresh_report_status_is_open`, `fresh_report_reviewed_at_is_null`), and a seeded B-to-C block so
   `helper_A_not_in_pair_BC` is meaningful (plus `helper_B_in_pair_BC_true`). Block-privacy rows were adjusted for the
   extra block (B now legitimately sees its own one row: `B_sees_only_own_block_row`), and two survival rows added.
6. **Mutation checks**: (a) dropping both `revoke all ... from anon, authenticated` gave `pass=80 fail=14`, all in
   the new privilege rows (TRUNCATE / REFERENCES / TRIGGER for both roles on both tables, plus the column-privilege
   rows for anon and authenticated). The table SELECT/UPDATE/DELETE rows stayed PASS in that mutant, i.e. this
   project's default privileges do not grant those, but they DO grant TRUNCATE/REFERENCES/TRIGGER: without the
   revoke a signed-in client could `TRUNCATE public.reports` (RLS does not apply to TRUNCATE). The new rows are what
   guards this. (b) removing the caller-in-pair clause from the helper gave `pass=92 fail=2`:
   `helper_A_not_in_pair_BC` and `helper_C_not_in_pair_AB` FAIL (before the B-to-C seed the first could not fail).
7. **Migration comments only**: header "Build 10a:" -> "Moderation base."; the two 3-line comment blocks cut to 2
   lines. Verified: `git diff -U0` of the migration shows no changed line that is not a `--` comment.

## Files touched outside the Build's original scope
None. All changes are the files Bug 1 names (doc, migration comments, run-sql.mjs, moderation_rls.sql,
admin_doc_queries.sql, this log). I did NOT stage this log file: it also carries Queenie's uncommitted QA section, which
is the Manager's to commit (the Manager can commit the log as is).

## Gates
tsc exit 0; lint exit 0; jest 19 suites / 132 tests, 0 `act(`, 0 console warnings (regression only).
Regression with the migration applied (`--after-begin`): profiles_rls.sql and avatars_storage_rls.sql same rows as
baseline, exit 0. Live DB unchanged (all runs rolled back).

## New SQL result table: `moderation_rls.sql` (pass=94 fail=0, exit 0)
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
3 | fresh_report_status_is_open | open | open | PASS
3 | fresh_report_reviewed_at_is_null | true | true | PASS
6 | A_sees_own_block | 1 | 1 | PASS
6 | helper_A_in_pair_AB | true | true | PASS
6 | helper_A_in_pair_BA_symmetric | true | true | PASS
6 | helper_A_pair_AC_no_block | false | false | PASS
6 | helper_A_not_in_pair_BC | false | false | PASS
6 | B_sees_only_own_block_row | 1 | 1 | PASS
6 | B_cannot_see_blocker_via_filter | 0 | 0 | PASS
6 | helper_B_in_pair_true | true | true | PASS
6 | helper_B_in_pair_BC_true | true | true | PASS
6 | C_reads_others_blocks | 0 | 0 | PASS
6 | helper_C_not_in_pair_AB | false | false | PASS
6 | B_block_survived_C_delete | 1 | 1 | PASS
6 | A_block_survived_B_and_C_deletes | 1 | 1 | PASS
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
4 | priv_reports_anon_no_table_SELECT | false | false | PASS
4 | priv_reports_anon_no_table_UPDATE | false | false | PASS
4 | priv_reports_anon_no_table_DELETE | false | false | PASS
4 | priv_reports_anon_no_table_TRUNCATE | false | false | PASS
4 | priv_reports_anon_no_table_REFERENCES | false | false | PASS
4 | priv_reports_anon_no_table_TRIGGER | false | false | PASS
4 | priv_reports_anon_no_column_select_update_references | false | false | PASS
4 | priv_blocked_users_anon_no_table_UPDATE | false | false | PASS
4 | priv_blocked_users_anon_no_table_TRUNCATE | false | false | PASS
4 | priv_blocked_users_anon_no_table_REFERENCES | false | false | PASS
4 | priv_blocked_users_anon_no_table_TRIGGER | false | false | PASS
4 | priv_blocked_users_anon_no_column_update | false | false | PASS
4 | priv_reports_authenticated_no_table_SELECT | false | false | PASS
4 | priv_reports_authenticated_no_table_UPDATE | false | false | PASS
4 | priv_reports_authenticated_no_table_DELETE | false | false | PASS
4 | priv_reports_authenticated_no_table_TRUNCATE | false | false | PASS
4 | priv_reports_authenticated_no_table_REFERENCES | false | false | PASS
4 | priv_reports_authenticated_no_table_TRIGGER | false | false | PASS
4 | priv_reports_authenticated_no_column_select_update_references | false | false | PASS
4 | priv_blocked_users_authenticated_no_table_UPDATE | false | false | PASS
4 | priv_blocked_users_authenticated_no_table_TRUNCATE | false | false | PASS
4 | priv_blocked_users_authenticated_no_table_REFERENCES | false | false | PASS
4 | priv_blocked_users_authenticated_no_table_TRIGGER | false | false | PASS
4 | priv_blocked_users_authenticated_no_column_update | false | false | PASS
pass=94 fail=0
```

## Admin doc queries, rolled back, new output (exit 0)
```
a_open_reports | [{"reason":"harassment","details":"abusive name","report_id":"99999999-0000-0000-0000-000000000009","target_id":"22222222-0000-0000-0000-000000000002","created_at":"2026-09-30T13:01:00.669596+00:00","target_type":"profile","reported_tag":"badactory","reporter_tag":"reporterx","reported_name":"Bad Actor Y","reporter_name":"Reporter X","reported_email":"y@example.test","reported_user_id":"22222222-0000-0000-0000-000000000002"}]
b_update_returning | {"id":"99999999-0000-0000-0000-000000000009","status":"actioned","reviewed_at":"2026-09-30T13:01:00.669596+00:00"}
b_wrong_id_rows_returned | 0
b_open_reports_left | 0
c_avatar_files | ["22222222-0000-0000-0000-000000000002/avatar.jpg"]
c_update_returning | {"id":"22222222-0000-0000-0000-000000000002","usertag":null,"avatar_url":null,"display_name":null}
d_ban_block_final_select | {"email":"y@example.test","banned_until":"2126-09-30T13:01:00.669596+00:00"}
d_wrong_id_final_select_rows | 0
d_sessions_and_tokens_left | {"sessions":0,"refresh_tokens":0}
d_unban_returning | {"email":"y@example.test","banned_until":null}
```

## Disagreements / notes
- None on substance. Note: the doc says the SQL editor shows only the last statement; that is the editor's documented behaviour, confirmed by the final-select design, but I did not open the Dashboard to see it.
- Query (a) now exposes the reported user's email to the admin; fine for the admin, flagged because it is personal data.

---
# Build 10a · Bug 2 (Bella): default privileges left on public.profiles

Base: 0953808. Nothing applied live; no emulator.

**Cause.** The Build 6 migration granted select and column-level update on `public.profiles` but never revoked the
project's default privileges, so `anon` and `authenticated` still hold TRUNCATE, REFERENCES and TRIGGER (found by
Bug 1's mutation check, verified live by the Manager). Not reachable through PostgREST, but it must not be there.

**Fix.** New migration `supabase/migrations/20260930010000_profiles_revoke_default_privileges.sql`:
`revoke truncate, references, trigger on public.profiles from anon, authenticated;` only. I did not `revoke all` and
re-grant: the test proves the end state is otherwise unchanged (authenticated select true, column update only on
display_name / avatar_url / usertag, no INSERT/DELETE for either role).

**Step 2: read-only listing of everything in `public` (live, before the migration).** Query used
`pg_class` + `has_table_privilege` / `has_sequence_privilege` for anon and authenticated:
```
kind | name     | anon privileges             | authenticated privileges
r    | profiles | TRUNCATE,REFERENCES,TRIGGER | SELECT,TRUNCATE,REFERENCES,TRIGGER
```
`public` holds exactly one table (`profiles`), no views, no materialised views, no sequences. So `profiles` is the only
residue and the migration covers it. (The moderation tables are not live yet; their revoke is already in that migration.)
Also listed (not changed, outside "tables/views/sequences"): functions in `public` with EXECUTE for anon / authenticated:
`rls_auto_enable()` true/true (a Supabase-created event-trigger function), `set_profiles_updated_at()` true/true
(trigger function, cannot be called directly), `handle_new_user()` false/false (revoked in Build 6). Flagging
`rls_auto_enable()` for the Manager to judge; I left it alone.

**Test.** New `supabase/tests/profiles_privileges.sql` (one transaction: migration at the marker, assertions, rollback;
run with `node supabase/tests/run-sql.mjs supabase/tests/profiles_privileges.sql --migration <the migration>`).
Rows: for anon and authenticated, table TRUNCATE/REFERENCES/TRIGGER/INSERT/DELETE false, column INSERT and REFERENCES
false; authenticated select true; anon select false (table and column level); anon no UPDATE; authenticated no
table-level UPDATE; authenticated column UPDATE true for display_name/avatar_url/usertag and false for
id/created_at/updated_at.
- With the migration: **pass=24 fail=0**, exit 0.
- Mutation (same file, run WITHOUT `--migration`): **pass=16 fail=8**, exit 1; the 8 FAIL rows are
  TRUNCATE/REFERENCES/TRIGGER table rows and the column-REFERENCES row, for both anon and authenticated.

**LESSONS.md** gained the line: every new table starts with `revoke all ... from anon, authenticated`, asserted with
`has_table_privilege`.

**Regression (with this migration applied inside the transaction).** `moderation_rls.sql` still **pass=94 fail=0**;
profiles_rls.sql and avatars_storage_rls.sql give the same rows as baseline. tsc 0, lint 0, jest 19 suites / 132 tests,
0 `act(`, 0 console warnings (regression only).

**Files outside the Build's original scope:** the new migration and test touch `public.profiles` (a Build 6 object);
that is exactly what this Bug is about. Nothing else.

## Build 10a — CLOSED (Manager, 2026-09-30)
- Commits: ee6bef4 migration + test · 3862fa6 admin doc · a54f646 Bug 1 · da437ad Bug 2.
- QA: Queenie independent re-run 66/0 (pre-Bug 1), coverage complete; doc usability → Bug 1.
- Review: Ruby FIX NEEDED (doc/runner/tests; migration sound) → PASS after Bug 1 + Bug 2.
- Manager reruns: `moderation_rls.sql` 94/0, `profiles_privileges.sql` 24/0.
- **Phase 5 — applied to the live project (Management API, one query each, in order):**
  `20260930000000_moderation.sql`, then `20260930010000_profiles_revoke_default_privileges.sql`.
  No `supabase_migrations.schema_migrations` table exists (earlier Builds were applied the same
  way) — never use `supabase db push` on this project without reconciling history first.
- Live verification after apply: both tables exist with RLS on; policies exactly
  reports_insert_own, blocked_users_{select,insert,delete}_own, profiles_{select_authenticated,
  update_own}; TRUNCATE/REFERENCES/TRIGGER for anon/authenticated on all three tables = 0;
  reports select/update/delete for authenticated = false; blocked_users select/delete true,
  update false; helper EXECUTE anon false / authenticated true; 0 rows in both tables;
  Justin's profile row identical before and after (43fae9b2 | tsujintsujin | updated_at unchanged);
  1 user, 0 banned. Storage: `storage.objects` RLS on, the four avatars_* policies present.
- `src/lib/database.types.ts` regenerated (`npx supabase gen types typescript --project-id …`):
  +58 lines (reports, blocked_users, is_blocked_between); tsc clean, lint clean, jest 132/132.
- Admin doc wording nit fixed by the Manager ("signs out on every device" → stops sign-in/refresh).
- B3 (ban refuses a real Google sign-in): UNTESTABLE until Justin's second Google account exists —
  carried to Build 10b Phase 3.
- Pre-launch decision for Justin: a banned user can still delete their account within ~1 h and
  re-register; a persistent ban list checked at sign-up would be a new feature.
- Needs from Justin: open `docs/ADMIN-MODERATION.md`, run query (a) in the Supabase SQL editor
  once (an empty result is correct — no reports yet).
