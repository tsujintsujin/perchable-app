# Perchable — PLAN.md

Planner: Priya. Date: 2026-09-24 (Round 1 revision — Ruby + Manager).
Based on `docs/VISION.md` and the approved `docs/RESEARCH.md`.

Approved by Justin: 2026-09-24

---

## 1. Goal & v1 definition of done

Movie-tracking social app: browse/search movies (via TMDB), mark watched,
build a captioned collection, follow other users, comment/DM about watched
movies, see rankings. Google sign-in only. Android first (Vision Part 1–2).

**v1 "done" (Vision Part 5): every module below works end-to-end on the local
emulator (`td_emu`) — not shipped, not on the Play Store yet.** Store
submission, iOS, and ads are explicitly out of scope for v1 (section 8).

This build also doubles as the **reusable base for later apps** (Vision Part
0) — see section 3 for which modules are meant to be lifted wholesale.

---

## 2. Backend decision

**Default stack, per RESEARCH.md — no deviation, case made in Stage A,
restated here for continuity:** Supabase (Postgres + Auth w/ Google +
Realtime + Storage + Edge Functions), TMDB API via a server-side proxy (Edge
Function), Expo SDK 57 + Expo Router + TypeScript, dev build (not Expo Go),
TanStack Query, expo-image, FlashList, gesture-handler + reanimated, Jest +
RNTL + Maestro, Sentry.

D1 was ruled out during Stage A research (RESEARCH.md §2, "Against the
vision"): no built-in auth or realtime, and this app needs both on day one
(Google sign-in, DMs). Ruby and the Manager already checked this reasoning
during Stage A; carrying it forward here rather than re-litigating.

Two flagged risks to track on TIMELINE.md, not blockers now:
- Supabase free tier pauses after 7 days idle (RESEARCH.md §13.1).
- TMDB's free non-commercial license ends the day ads ship (§13.2) — email
  TMDB sales before that Build, not after.

---

## 3. Modularity — what's reusable in later apps

Vision Part 0: this app is a test base for later apps, so folder/module
boundaries matter beyond Perchable itself. High level only — Dianne owns
actual code structure in DESIGN.md.

| Reusable as-is in a later app | Perchable-specific, not reusable |
|---|---|
| **Auth** (Google sign-in via Supabase, dev-build setup, account deletion) | Movie browse/details (TMDB-specific) |
| **Profile** (edit photo/usertag) | Quick-add swipe deck |
| **Social** (follow, DM, comments, block/report) | Rankings (movie-specific aggregates) |
| **Moderation** (report/block tables + RLS pattern, UGC terms acceptance) | TMDB proxy Edge Function |

Build these four as self-contained modules with their own Supabase tables and
their own screens/components, not entangled with movie-specific logic — a
later app should be able to copy the folder and swap out only the
movie-domain modules.

---

## 4. Modules (dependency order)

| # | Module | Why here |
|---|---|---|
| 1 | Foundation — dev build + Supabase project + testing/Sentry | everything needs a working dev build, a DB, and a test/crash-reporting gate before any screen exists |
| 2 | Auth + profile (+ minimal account deletion) | Google sign-in gates every other screen; deletion built alongside auth per RESEARCH.md §6, not as a late add-on |
| 3 | Moderation base (report/block schema + UGC terms acceptance) | RESEARCH.md §13.3: must not be a late add-on — built here so every later module's RLS references it from the start |
| 4 | Movie browse/details (TMDB proxy) | needed before collection or quick-add can point at a real movie |
| 5 | Quick-add swipe | Vision Part 2's headline interaction; depends on browse data |
| 6 | Search/add | second path to add a movie; depends on TMDB proxy |
| 7 | Collection + captions | depends on a movie being addable (5 or 6); also where the Maestro smoke test lands once Modules 4–7 all exist |
| 8 | Social: follow + profile modal | depends on profile (2) and moderation (3) existing |
| 9 | Comments (+ on/off toggle) | depends on collection (7, what's commented on) and moderation (3) |
| 10 | DMs | depends on follow/profile (8) and moderation (3) for block enforcement |
| 11 | Rankings | depends on collection, comments, follows all producing real activity to aggregate |
| 12 | Account deletion completion (web page + final check) | the in-app deletion button ships in Module 2; this module only adds the web-URL deletion path and a final end-to-end check that every table added since Module 2 actually cascades |

Every module from 2 onward that adds a user-owned table carries a
Done-means bullet: "deleting the account removes this module's rows
(`ON DELETE CASCADE`)" — see each Build below. Modules 1–4 are detailed in
full (Module 4 on 2026-10-01); 5–12 are one-line-rough until the team
reaches them, but are still Build-numbered here so milestones and manual
steps stay unambiguous.

---

## 5. Builds

### Module 1 — Foundation (dev build + Supabase + testing/Sentry)

```
Build 1 — Expo dev build boots          Module: Foundation
Done means: `npx expo run:android` installs a custom dev-client APK on td_emu
  and launches to the default Expo Router screen (not Expo Go).
Test on: emulator
Needs: nothing (uses existing Android SDK/emulator per app CLAUDE.md)
Phases: 0 skip (no UI) · 1 Bella build · 2 Bella gates (tsc, expo lint) ·
        3 Queenie QA · 4 Ruby review · 5 Manager ships
```

```
Build 2 — Supabase project connected     Module: Foundation
Done means: app reads a Supabase env var and a debug screen shows
  "Supabase: connected" (a trivial `select 1`-style ping succeeds) on device.
Test on: emulator
Needs (Manager sets up, section 6): Supabase project URL and
  anon key (setup step #1, see section 6)
Phases: 0 skip · 1 Bella build · 2 Bella gates · 3 Queenie QA · 4 Ruby review ·
        5 Manager ships
```

```
Build 3 — TMDB proxy Edge Function        Module: Foundation
Done means: a Supabase Edge Function calls TMDB `/movie/popular` server-side
  and returns JSON to the app; TMDB key never appears in the app bundle
  (Queenie/Ruby check the bundle/network tab for it); response includes the
  required TMDB attribution string.
Test on: emulator (network call), Ruby checks the bundle for the leaked key
Needs (Manager sets up, section 6): TMDB API key (setup step #2)
Phases: 0 skip · 1 Bella build · 2 Bella gates · 3 Queenie QA · 4 Ruby review ·
        5 Manager ships
```

```
Build 4 — Testing + Sentry setup          Module: Foundation
Done means: `npx jest` runs with the `jest-expo` preset and one passing
  smoke test; `npx jest` becomes a required gate for every Build from here
  on (added to Bella's Phase 2 checklist); Sentry SDK is wired and a
  deliberately-thrown test error appears in the Sentry dashboard.
Test on: emulator (Sentry event) + unit test run
Needs (Manager sets up, section 6): Sentry account + project DSN (setup step #3)
Phases: 0 skip · 1 Bella build · 2 Bella gates (tsc, lint, jest) ·
        3 Queenie QA · 4 Ruby review · 5 Manager ships
```

### Module 2 — Auth + profile (+ minimal account deletion)

```
Build 5 — Google sign-in                Module: Auth
Done means: user taps "Sign in with Google," completes the Google account
  picker on-device, lands back in the app signed in; closing and reopening
  the app keeps them signed in (session persists).
Test on: emulator — Google APIs image; UNTESTABLE if Google sign-in requires
  Play Services beyond what the current `td_emu` image provides (flag to
  Justin immediately if the sign-in screen fails to load Google's picker —
  see setup step #6, may need a Google Play image swap)
Needs (Manager sets up, section 6): Google Cloud OAuth client IDs — Android client (SHA-1 of
  the Build-1 dev build's debug keystore, via `keytool`/`gradlew
  signingReport`) + Web client (for Supabase Auth) (setup step #4)
Phases: 0 Dianne mockup · 1 Bella build · 2 Bella gates · 3 Queenie QA ·
        4 Ruby review · 5 Manager ships
```

```
Build 6 — Profile created on first sign-in   Module: Auth/Profile
Done means: first sign-in auto-creates a `profiles` row (id, google name,
  default avatar, empty usertag); visiting "My Profile" shows that data.
Test on: emulator
Needs: nothing
Phases: 0 Dianne mockup · 1 Bella build · 2 Bella gates · 3 Queenie QA ·
        4 Ruby review · 5 Manager ships
```

```
Build 7 — Edit profile (photo + usertag)   Module: Profile
Done means: user changes usertag text and uploads a photo (Supabase Storage);
  both persist after app restart; usertag uniqueness enforced (no two users
  same tag) with a visible error on collision.
Test on: emulator
Needs: nothing
Phases: 0 Dianne mockup · 1 Bella build · 2 Bella gates · 3 Queenie QA ·
        4 Ruby review · 5 Manager ships
```

```
Build 8 — Sign out                       Module: Auth
Done means: "Sign out" clears the session and returns to the sign-in screen;
  a signed-out app never shows profile/collection data (regression check on
  Builds 5–7).
Test on: emulator
Needs: nothing
Phases: 0 skip · 1 Bella build · 2 Bella gates · 3 Queenie QA · 4 Ruby review ·
        5 Manager ships
```

```
Build 9 — Minimal account deletion        Module: Auth (per RESEARCH.md §6:
                                           built alongside auth, not late)
Done means: "Delete my account" button in-app deletes the `profiles` row and
  the Supabase Auth user, with `ON DELETE CASCADE` wired on the auth-user
  foreign key so this stays correct as later modules add tables; after
  deletion the user is signed out and cannot sign back in as the same
  account without a fresh Google sign-up.
Test on: emulator
Needs: nothing
Phases: 0 Dianne mockup · 1 Bella build · 2 Bella gates · 3 Queenie QA ·
        4 Ruby review · 5 Manager ships
```

### Module 3 — Moderation base (report/block schema + UGC terms)

Detailed 2026-09-30 (Priya), revised 2026-09-30 after Ruby's review and the
Manager's defaults. Applies RESEARCH.md §6 (Play UGC policy: report on every
UGC surface, in-app block, terms that define objectionable content,
moderation that is *active*).

**Manager defaults (Justin said "continue" without answering; each may be
overturned).** Every item marked "Manager default 2026-09-30 — Justin may
overturn" below is one of: (D1) the two new Settings rows are in; (D2) Build
10 runs as sub-steps 10a and 10b; (D3) the terms gate covers comments, DMs
and captions; (D4) on-device two-user QA uses Justin's second Google account.

**The problem this module has to solve.** No UGC surface exists yet —
comments, DMs, other users' profiles and captions arrive in Builds 20–27.
So Module 3 builds the *base*: tables, RLS, SQL helpers, and reusable
components/hooks with a fixed contract. Later surfaces plug into it (see
"Carry-forward rules"). Nothing fake ships to users: the dev harness is
`__DEV__`-only and is dropped from the release JS bundle (Build 10b C6).

**Where things live.** Client code in `src/modules/moderation/` (`api/`,
`components/`, `hooks/`, `types.ts`, `index.ts` — DESIGN.md §4); routes stay
thin (DESIGN.md §7). Overlay sheets follow the existing `DeleteAccountSheet`
pattern (an in-screen overlay, not a route), so they also work over the
future `user/[id]` formSheet. `src/modules/moderation/README.md` is the
module how-to (started in 10b, extended in Build 11).

**Shared vocabulary.** One constant, `OBJECTIONABLE_CATEGORIES`, feeds both
the report-reason list (10b) and the terms text (Build 11), so they never
drift. Categories (Priya's derivation — RESEARCH.md §6 requires the terms to
"define what counts as objectionable content" but gives no list; Justin
approves the wording at Build 11): `spam`, `harassment` (harassment or
bullying), `hate` (hate speech), `sexual` (sexual content), `violence`
(violence or threats), `impersonation`, `other`.

**Who proves each line (owner tags used below):** [SQL] Bella's rolled-back
SQL test file, re-run by the Manager · [Jest] Bella's Jest tests ·
[QA] Queenie on the emulator · [Mgr] the Manager reads or runs it ·
[Ruby] Ruby greps or reads the code.

**Two-user QA (Manager default 2026-09-30 — Justin may overturn, D4).**
Agents never create accounts and the plan does not rely on the Email
provider (it is due to be switched off before launch). The second user for
on-device report/block/unblock is **Justin's second Google account** added
to `td_emu` and signed into Perchable once (this creates its profile). One
extra account is enough for every state that matters on device: it fills the
harness picker, gives one report/block target, and makes the Blocked users
list show one row; a list of many rows is covered by Jest. If Justin has no
second account, on-device report/block/unblock is marked **UNTESTABLE** and
the DB tests plus Jest carry it — that is said plainly in the Build log, not
papered over.

```
Build 10a — Moderation schema + admin path   Module: Moderation base
   (sub-step of Build 10; Manager default 2026-09-30 — Justin may overturn.
   Number 10 unchanged; own log, own Phases 1-5, no UI, no Phase 0.)
Done means (checkable; migration reviewed + applied by the Manager, RLS
  proven in rolled-back transactions — `supabase/tests/moderation_rls.sql`,
  pattern of `supabase/tests/profiles_rls.sql`):

  A. Database
  A1. [SQL] `public.reports` exists: id (uuid pk), reporter_id (default
      auth.uid(), FK auth.users ON DELETE CASCADE), reported_user_id (the
      author/owner of the reported thing; FK auth.users ON DELETE CASCADE),
      target_type, target_id (uuid, no FK — polymorphic, and a report must
      outlive removal of the content it points at), reason, details
      (optional, max 500 chars), status, created_at, reviewed_at (null until
      reviewed). `reported_user_id` is client-supplied and therefore
      untrusted (see B1).
  A2. [SQL] target_type is text with a CHECK of `profile`, `comment`,
      `dm_message`, `collection_item` (a caption lives on a collection
      entry) — text + CHECK, not an enum, so a later surface adds a value
      with one constraint change. reason is a CHECK of the seven categories.
      `other` requires non-blank details (CHECK). status is a CHECK of
      `open` (default), `reviewed`, `actioned`, `dismissed`.
  A3. [SQL] Enforced by the database, not the UI: no self-report
      (reporter_id <> reported_user_id); for target_type `profile`,
      target_id must equal reported_user_id; one report per reporter per
      target (UNIQUE reporter_id, target_type, target_id).
  A4. [SQL] Grants and RLS on `reports` (explicit, not relying on Supabase
      defaults): `revoke all` from `anon` and `authenticated` first, then
      grant `authenticated` INSERT on only the client-settable columns
      (target_type, target_id, reported_user_id, reason, details;
      reporter_id fills from its default and RLS pins it to the caller). RLS
      INSERT policy: reporter_id = auth.uid(). No client SELECT, UPDATE or
      DELETE — a reporter never sees any report, not even their own; only
      the SQL editor / service role reads or changes them. Tests assert:
      spoofed reporter_id rejected; client SELECT denied; client UPDATE of
      `status` (and of any non-granted column) denied; client cannot insert
      `status`/`reviewed_at`/`id`; `anon` denied.
  A5. [SQL] `public.blocked_users`: blocker_id and blocked_id (both FK
      auth.users ON DELETE CASCADE), created_at; primary key
      (blocker_id, blocked_id), so a repeat block cannot duplicate; CHECK
      blocker_id <> blocked_id.
  A6. [SQL] Grants and RLS on `blocked_users`: `revoke all` from `anon` and
      `authenticated`, then grant `authenticated` SELECT, INSERT (blocker_id,
      blocked_id) and DELETE. Policies: INSERT only with blocker_id = own
      uid; SELECT and DELETE only rows where blocker_id = own uid; no
      UPDATE. What is protected: a user can never *list* who has blocked
      them, and one user cannot read another's block list, through the
      table. (See A8 for what the helper deliberately still reveals.)
  A7. [Mgr] reads the migration: partial index on reports (created_at)
      WHERE status = 'open' (admin queue); index on reports
      (reported_user_id); index on blocked_users (blocked_id) (reverse
      lookup and cascade). The unique constraints cover the rest.
  A8. [SQL] Helper `public.is_blocked_between(a uuid, b uuid)`: a symmetric
      boolean (no direction) — true when either has blocked the other, and
      it returns true/false only when auth.uid() is one of the two
      arguments (otherwise false). SECURITY DEFINER, `set search_path = ''`
      (as `handle_new_user`). Grants: `revoke all on function ... from
      public, anon`, then `grant execute ... to authenticated`. EXECUTE
      cannot be withheld from `authenticated`, because RLS policy
      expressions run with the caller's privileges, so a policy calling it
      needs the grant. **Accepted consequence (decision, Ruby M1):** a user
      can learn that a block exists between themselves and one named other
      user, and not who initiated it — enforcement in Builds 25/27/28
      reveals that anyway (their insert is rejected). The test asserts
      exactly this: caller in the pair -> correct symmetric answer; caller
      not in the pair -> false; anon EXECUTE denied.
  A9. [SQL] Deleting an auth user (a real `delete from auth.users` in the
      test) removes every `reports` row they filed or that is about them,
      and every `blocked_users` row where they are either side. No change
      to the `delete-account` Edge Function.
  A10. [Mgr] The migration touches only these two tables and the helper (no
      `config.toml` push — app CLAUDE.md).

  B. Admin path (Justin is the admin — RESEARCH.md §6: "a Supabase admin
     query is enough at this scale; no dedicated admin panel needed for v1")
  B1. [SQL] `docs/ADMIN-MODERATION.md` exists, written for Justin, run in
      the Supabase SQL editor (which bypasses RLS). Copy-paste queries, each
      with a one-line "what this does":
      (a) list open reports, oldest first, with reporter and reported user
          names/usertags, reason, details, **and target_type + target_id
          so Justin verifies the target against the real content**
          (`reported_user_id` is client-supplied, so a report is a lead,
          not proof);
      (b) mark a report reviewed / actioned / dismissed (status +
          reviewed_at);
      (c) remove a user's profile content: clear avatar_url, usertag **and
          display_name** on `profiles`, and delete their `avatars/<uid>/`
          Storage objects — the only content type that exists in 10a;
      (d) ban and unban: set `auth.users.banned_until = now() + interval '100 years'` (a far date, not `'infinity'` — unproven against the sign-in service; Ruby, Build 10a review) (a
          deleted user can just sign up again with Google, as Build 9
          showed, so a ban must be a ban, not a delete) and back to null;
          plus how to make it bite immediately: an already-issued access
          token works up to about an hour unless the user's rows in
          `auth.sessions` / `auth.refresh_tokens` are deleted;
      (e) placeholder headings for removing a comment, DM message, caption
          — each "query added by Build 25 / 27 / 20" (Carry-forward rule 5).
      Notes section, stated plainly: there is **no rate limit on reports in
      v1** (accepted); a reporter deleting their account removes their own
      open reports (`reporter_id` cascades — kept so the account deletion
      promise and Build 31's "zero rows behind" check hold); banning by
      deleting an account erases the reports *about* them, another reason
      to ban with `banned_until`.
  B2. [SQL] Bella runs (a)-(d) against the live project in rolled-back
      transactions in Phase 2, so the doc holds no untested SQL; [Mgr]
      repeats (a) and (d) once.
  B3. Ban proof on a real sign-in (Manager default 2026-09-30 — Justin may
      overturn, D4): the Manager sets `banned_until` on Justin's **second
      Google account** by SQL, Justin tries to sign in with it (refused),
      the Manager unbans and removes the sessions. Until that second account
      exists the ban query is proven at SQL level only and this device
      check is **UNTESTABLE until the 2nd account exists**. No Email
      provider, no Admin-API account creation.

Test on: SQL tests (live project, rolled back); no emulator flow in 10a
  except B3 when the second account exists
Needs from Justin: (1) once, open `docs/ADMIN-MODERATION.md`, confirm you can
  open the Supabase SQL editor and run query (a) (before Phase 4). (2) B3 only:
  a second Google account signed into Perchable once (can be done during
  10b Phase 3 — the same account serves both). No new credentials
  (Credentials/perchable already holds the Supabase access token).
Failure modes to cover (Manager expands into the log):
  - Security: spoofed reporter_id / blocker_id; client SELECT/UPDATE of
    reports; anon on both tables and both helpers; helper for a pair not
    involving the caller; grants revoked before column grants.
  - Data: `other` without details, 501-char details, self-report, self-block,
    duplicate report, duplicate block, `profile` target with mismatched id
    — all run **in SQL only, never against live rows** (rolled back).
  - Cleanup: cascade for both columns of each table; after any live check
    (B3) reports/blocks against the second account are removed by SQL by
    the Manager.
  - Admin doc: every query tested; wording states its limits (no rate
    limit, client-supplied reported_user_id, token lifetime).
Phases: 1 Bella build (migration + tests + doc; Phase 0 skipped — no UI) ·
        2 Bella gates (tsc, lint, jest, SQL tests, admin-doc queries) ·
        3 Queenie QA (SQL results reviewed; B3 if possible) · 4 Ruby review ·
        5 Manager ships (applies migration)
```

```
Build 10b — Report/block UI                  Module: Moderation base
   (sub-step of Build 10, after 10a; Manager default 2026-09-30 — Justin may
   overturn. Own log, own Phases 0-5.)
Done means (checkable):

  C. Reusable report/block UI (module exports; contract fixed here)
  C1. [Jest] `ReportSheet` bottom-sheet overlay, props
      `{ target: { type: ReportTargetType; id: string; ownerId: string };
      onClose(): void; onReported?(): void }`. Seven reasons as a
      single-select list; `other` reveals a details box (max 500 chars,
      optional for other reasons); Submit disabled until a reason is chosen
      (and details non-blank for `other`); on success shows the sent
      confirmation, then closes. Refuses to open or submit when `ownerId` is
      the signed-in user (defence in depth; the DB also rejects it).
  C2. [Jest] States per DESIGN.md §2/§7: idle, submitting (`Button` loading
      convention, list disabled), sent, error (inline `ErrorCard` + retry;
      reason and typed details kept). The insert into `reports` is made
      **without `.select()`** (the client has no SELECT on `reports`).
      SQLSTATE 23505 (already reported this target) is mapped to the same
      "sent" state — not an error, and the user learns nothing about
      existing reports. A Jest test proves the 23505 mapping.
  C3. [Jest] `useBlockUser(userId)` + `BlockUserSheet` confirm overlay,
      props `{ userId: string; displayName?: string; onClose(): void;
      onBlocked?(): void }`. Confirm inserts the block (without `.select()`
      where not needed); blocking someone already blocked (23505) is a
      silent success; cancel and double-tap are safe; self-block refused in
      the hook and by the DB.
  C4. [Jest] `useBlockedUsers()` returns the caller's block list with each
      blocked user's display name, usertag and photo (a second read of
      `profiles` by id — the FK points at auth.users, so there is no embed),
      and `unblock(userId)`.
  C5. [QA] Blocked users screen, reachable from a new Settings row "Blocked
      users" (Account section): Unblock per row; all four DESIGN.md §2
      states (loading, empty, error + retry, filled); row-level busy state
      on unblock; on failure the row stays and an error shows.
      **Manager default 2026-09-30 — Justin may overturn (D1):** Settings
      has no such row today; it is the only way to undo a block and the only
      place a block is checkable on device before Build 24; read as part of
      "block-a-user UI" (this Build's original text; RESEARCH.md §6 "in-app
      user blocking"), not a new feature. Rendering many rows: Jest. On
      device the filled state needs the second Google account (one row is
      enough to show it); without it, "filled" is **UNTESTABLE on device**
      and Jest carries it.
  C6. [Ruby] + [Mgr] Dev harness — the only way to exercise C1-C4 on the
      emulator before Builds 24-27 create real surfaces. A
      `ModerationDevHarness` in the module, loaded from `src/app/debug.tsx`
      as `if (__DEV__) { const { ModerationDevHarness } = require(...) }` so
      Metro drops it from the release bundle; it runs **no query before the
      `__DEV__` return**. It lists other profiles (existing profiles RLS),
      lets QA pick one, then buttons open `ReportSheet` per target_type (a
      random uuid stands in for a comment/DM/caption id — target_id has no
      FK) and `BlockUserSheet` for the picked user. Verification is
      `npx expo export --platform android` and a grep of the JS output for
      the harness's marker string (must be absent) — not a release APK
      build. `perchable://debug` stays reachable in release and shows only
      "Not available in production builds." (existing behaviour; the harness
      is not in it). Not part of the product.
  C7. [Ruby] Nothing is wired to a product surface in this Build: grep
      shows `ReportSheet`/`BlockUserSheet` have no caller outside the
      harness and tests. The exported contract is what Builds 24, 25, 27
      call. The module `README.md` documents props, reasons, helpers and the
      doc-update duty.
  C8. [Jest] Sign-out clears the blocked-users cache: the hook run under
      user A then user B never shows A's list (query keys owner-tagged, as
      `useOwnProfile`).
  C9. [Mgr] Phase 0 (Dianne) also updates DESIGN.md §3 (routes for the
      Blocked users screen) and §4 (removes the overlap where block/report
      appear under both `social/` and `moderation/` — they belong to
      `moderation/`).

What Build 10 (a+b) enforces now vs later. **Now:** the tables and RLS; the
`is_blocked_between` helper; no one can read reports; no one can list who
blocked them; no self-report or self-block; cascades. **Not now:** anything
that hides or rejects content because of a block — no comment, DM or
other-user surface exists yet. Deferred: Build 24 wires Report/Block into the
profile modal; 25 comments — hide a blocked user's comments from the blocker
and reject inserts when `is_blocked_between` is true; 27 DMs — the same on
messages and conversation lists; 28 DM block enforcement as planned (RLS).
Build 23: whether blocking removes a follow is **left open for Justin at
Build 23** — not decided here.

Test on: emulator, dev build (harness + Settings > Blocked users) with
  Justin's second Google account; Jest for components/hooks. Without the
  second account, on-device report/block/unblock is UNTESTABLE and DB +
  Jest carry it.
Needs from Justin (Build 10b, before Phase 3): add a second Google account
  to `td_emu` and sign into Perchable once with it (Manager default
  2026-09-30 — Justin may overturn). Sign-in on the emulator is Justin's own
  step (LESSONS.md, 2026-09-30).
Failure modes to cover (Manager expands into the log):
  - Report: dismiss mid-submit (no state update after unmount, result not
    applied, no double row); offline / server error (sheet stays open,
    choices kept, retry works); double-tap Submit (one row); repeat report
    (sent, no error); `other` without details and 501-char details (UI
    blocks them; the DB negatives are in 10a's SQL, not on live rows);
    self-report (refused in UI).
  - Block: cancel; double-tap Confirm; already blocked (silent success);
    self-block; nonexistent user id (FK error -> error state, no crash);
    leave the screen mid-unblock; unblock fails offline (row stays); blocked
    user has null name/photo (fallback initials + fallback name from
    DESIGN.md).
  - Signed-out / account switch: caches cleared (Jest); the device check of
    "a different account sees its own state" is UNTESTABLE by an agent
    unless Justin signs in with the other account.
  - Sentry: unexpected failures only (not duplicates, validation or
    cancel); never send the details text as event data; environment tag.
  - Security: no `.select()` on `reports`; harness absent from the release
    bundle; no query in the harness before the `__DEV__` return.
  - Cleanup: reports/blocks made against the second account during QA are
    removed by SQL by the Manager after QA; the live negatives are never
    run against live rows.
Phases: 0 Dianne mockup (ReportSheet all states; BlockUserSheet; Blocked
        users screen 4 states; Settings row; "sent" copy; updates DESIGN.md
        §3/§4) · 1 Bella build · 2 Bella gates (tsc, lint, jest,
        `expo export` bundle grep) · 3 Queenie QA · 4 Ruby review ·
        5 Manager ships
```

```
Build 11 — UGC terms acceptance           Module: Moderation base
   **ORDER CHANGED 2026-10-01 (Justin): Build 11 runs just before Build 20** (the first
   Build where users post content others see). After Build 10b the team goes straight to
   Builds 12-16 (movie browse, details, swipe-to-add). Content below is unchanged.
Done means (checkable):
  A. Database (migration reviewed + applied by the Manager;
     `supabase/tests/terms_gate_rls.sql`, rolled back)
  A1. [SQL] `profiles.terms_accepted_at timestamptz` exists, null for every
      existing and new profile (everyone accepts once).
  A2. [SQL] It is not client-writable. The existing column-limited update
      grant (display_name, avatar_url, usertag — Build 6) is left as is; a
      test proves a client `update profiles set terms_accepted_at = now()`
      is denied. Acceptance goes only through `public.accept_terms()`:
      SECURITY DEFINER, `set search_path = ''`, `revoke all ... from public,
      anon` then `grant execute ... to authenticated`, sets the caller's own
      timestamp to now() only if currently null (a second call keeps the
      first timestamp), returns it. Test: anon EXECUTE denied.
  A3. [SQL] `public.has_accepted_terms()` (SECURITY DEFINER, STABLE,
      `set search_path = ''`, `revoke all ... from public, anon`, `grant
      execute ... to authenticated` — required, since RLS policies call it
      as the caller) is true when the caller's terms_accepted_at is not
      null. It takes no argument and always reads auth.uid().
  A4. [SQL] **"INSERT rejected while terms_accepted_at is null" is proven
      now, on a stand-in.** The rolled-back test creates a temporary table
      carrying the exact policy shape later Builds must use (`WITH CHECK
      (public.has_accepted_terms() AND author_id = auth.uid() AND NOT
      public.is_blocked_between(...))`) and shows: insert rejected while
      null, allowed after `accept_terms()`, another user's acceptance does
      not count, and a null-terms user can still SELECT. Builds 20/25/27
      reuse this file as their template.
  A5. Documented and accepted: `terms_accepted_at` is readable by every
      signed-in user (profiles SELECT is `using (true)` with a table-level
      grant). It is low-sensitivity (a date), so no separate table. Stated
      in the migration comment and the module README. [Ruby] confirms the
      statement is there.

  B. Terms screen and gate (client, `src/modules/moderation/`)
  B1. [QA] A terms screen: a plain-language definition of objectionable
      content built from `OBJECTIONABLE_CATEGORIES` (rendered from the
      constant, not retyped); how to report and block; that reported
      content can be removed and accounts banned; who operates the app
      (Justin). Copy written by Dianne in DESIGN.md (verbatim table) and
      **approved by Justin** (Needs from Justin). Not legal advice; it is
      the Play-policy minimum (RESEARCH.md §6) and Justin may want proper
      terms text before store submission.
  B2. [Jest] + [QA] States: not accepted (shows "I agree"), accepting
      (loading), accepted (no button; "Accepted on <date>"), error (inline
      error + retry; screen stays open). No "decline" control: leaving the
      screen means not accepted.
  B3. [Jest] `useTermsGate()` exported from `index.ts`:
      `{ accepted: boolean; isLoading: boolean; requireTerms(onAccepted):
      void }`. If accepted, runs the callback immediately. If not, opens the
      terms screen and runs the callback exactly once after a successful
      acceptance; backing out runs nothing. While the profile read is
      loading or has failed it fails closed (not accepted, never accepted).
  B4. [QA] A Settings row "Terms & community rules" (Account section) opens
      the screen in view mode (accept button if not yet accepted, accepted
      date if accepted). **Manager default 2026-09-30 — Justin may overturn
      (D1):** a row Justin did not list; needed because the definition must
      be readable at any time (RESEARCH.md §6) and it is the only non-fake
      way to reach the screen before Build 25. The `terms` route sits under
      the session guard in the root layout.
  B5. [QA] Dev harness (from 10b, same `__DEV__`/`require` rule) gains a
      "Simulate first comment" button calling `requireTerms`: not accepted
      -> opens the screen and, after acceptance, shows "action ran";
      accepted -> runs at once. Proves the gate on the emulator before a
      real comment box exists. [Ruby] + [Mgr]: harness still absent from
      the `expo export` bundle.
  B6. [Mgr] After acceptance the timestamp is visible in `profiles` and
      survives an app restart. [Jest] sign-out / a different user sees their
      own state (query keys owner-tagged). The on-device account-switch
      check is UNTESTABLE by an agent unless Justin signs in with his second
      account.
  B7. **Gate scope — Manager default 2026-09-30 — Justin may overturn
      (D3):** the terms gate covers comments, DMs **and captions**
      (RESEARCH.md §6: "comment, DM, set a profile caption"). Build 20
      calls `requireTerms` before the first caption. Profile name, photo
      and usertag (Build 7) are **not** gated. **Open policy question for
      Justin before launch:** Google Play may treat those as UGC too.
  B8. [Ruby] Carry-forward enforcement exists before this Build closes:
      `logs/LESSONS.md` has a "Moderation carry-forward" checklist section
      (written now, alongside this plan) and the README lists the rules;
      the rough blocks of Builds 20, 24, 25, 27, 28 carry a pointer to
      "Module 3 carry-forward rules 1-5".
  B9. [Mgr] Phase 0 (Dianne) also updates DESIGN.md §3 (`terms` route) and
      §4 (block/report and terms belong to `moderation/`, not `social/`).

Test on: emulator (Settings row, terms screen, harness gate) plus
  `terms_gate_rls.sql` and Jest for the hook and screen
Needs from Justin: read the terms copy in Dianne's Phase 0 mockup and say OK
  or give changes (before Phase 1). Nothing else.
Failure modes to cover (Manager expands):
  - Accept: offline / server error (screen stays, retry); double-tap "I
    agree" (one write; a second call keeps the timestamp); leave the screen
    mid-accept (callback never runs twice; no state update after unmount);
    accept succeeds but the profile refetch fails (gate neither stuck nor
    treats a failed read as accepted).
  - Gate: backing out runs nothing; called twice quickly; called while
    loading; profile row missing.
  - Security: client cannot set terms_accepted_at; another user's
    acceptance never counts; anon cannot execute either function; the
    functions take no user-id argument.
  - Sentry: only unexpected accept failures, environment tag, no user text.
  - Cleanup: none (a column on `profiles`; cascade unchanged).
Phases: 0 Dianne mockup (terms screen 4 states + Settings row + copy;
        updates DESIGN.md §3/§4) · 1 Bella build · 2 Bella gates (tsc, lint,
        jest, SQL test, `expo export` grep) · 3 Queenie QA · 4 Ruby review ·
        5 Manager ships
```

**Carry-forward rules for later Builds (so nothing in Module 3 can be
forgotten).** The Manager copies these into those Builds' failure lists and
briefs. They add no features. Enforced by the checklist in `logs/LESSONS.md`
and by a pointer line in each affected Build's block.
1. Every table holding content another user can read (captions, comments,
   DM messages) gets an INSERT policy that calls
   `public.has_accepted_terms()`, and its Build's SQL test copies
   `terms_gate_rls.sql` and asserts the insert is rejected on the *real*
   table while `terms_accepted_at` is null. A migration without that test
   is a Ruby FIX NEEDED. **Build 20** (captions) applies it; the caption
   SELECT policy stays owner-only until a Build shows captions to others.
2. Comment and DM policies also call `public.is_blocked_between(...)`
   (Build 25 comments; Builds 27-28 DMs); their tests prove both directions
   of a block.
3. Every UGC surface exposes a report entry point that opens `ReportSheet`
   with the right target: **Build 24** profile (and wires `BlockUserSheet`),
   **Build 25** comment **and the collection entry/caption** (the first
   Build where another user's entry is visible), **Build 27** DM message.
4. Every UGC composer calls `useTermsGate().requireTerms` before its first
   submit (**Build 20** caption, **Build 25** comment, **Build 27** DM).
5. Each such Build adds its own "remove this content" query to
   `docs/ADMIN-MODERATION.md`, tested in a rolled-back transaction.

### Module 4 — Movie browse/details (Builds 12–13)

Detailed 2026-10-01 (Priya, at the Manager's request). Justin moved the movies
ahead of Build 11 (terms): after Build 10b the team goes straight to Builds
12–16. Justin is away, so nothing here waits on him: every decision he might
want to change is a **NEEDS JUSTIN** item with the default that applies now
(list below). Defaults marked "Manager default" are process choices, not
features.

**Owner tags used below (as Module 3):** [Jest] Bella's Jest tests · [QA]
Queenie on the emulator · [Mgr] the Manager reads or runs it · [Ruby] Ruby
greps or reads the code.

**What exists today (checked in the repo 2026-10-01).** The `tmdb` Edge
Function is deployed and answers only `?endpoint=popular&page=N` (Build 3;
`verify_jwt` on, key server-side, page validated 1–500, response
`{ results, page, total_pages, attribution }`). `src/modules/movies/` has
`getPopularMovies(page)` and the trimmed `Movie` type, no hooks or
components. `expo-image` is already installed and used by `ui/Avatar`, so it
is already inside the dev build. `src/ui/` has `Shimmer`, `EmptyState`,
`ErrorCard`, `Avatar`, `Button`, `Toast`, `GlassCard`, `TabBar` but **no
`PosterCard`** (DESIGN §2 specifies it; Build 12 creates it).
`src/lib/queryClient.ts` does not exist (DESIGN §4 lists it); TanStack Query
and FlashList are not installed. The app scheme `perchable` is already set.
Home (`(tabs)/index.tsx`) is a placeholder shell with the avatar chip.

#### Module-wide decisions (M1–M10)

- **M1 Home shows one list: TMDB Popular, as a 3-column poster grid with
  infinite scroll.** Source: Vision Part 2 ("generic home with movie poster
  showcase"), Build 12's own text ("poster grid"), and Build 3's `popular`
  endpoint, which is the only list the proxy serves. No Trending or Now
  Playing sections in v1. The inspo Home also shows "Have You Watched This?"
  and "Friend Activity"; both need a collection and a follow graph that do
  not exist until Modules 7–8, so they are **not** on Home in Build 12
  (Build 5's landing rule already says not to build Home sections early).
  Perch Roulette rides on Home as a UI-only shell (DESIGN §5; PLAN Changes
  2026-09-24). **Flagged as N1.** Paging: 20 per page (TMDB's fixed size),
  `onEndReached` loads the next page, last page is `min(total_pages, 500)`
  (the proxy already rejects page > 500).
- **M2 The proxy grows by one endpoint, and that Edge Function work is part
  of the Builds that need it.** Build 12a hardens `popular`; Build 13 adds
  `details` (below). Rules from LESSONS.md (server code): whitelist by
  `endpoint` (anything else stays 400), validate every input before it
  reaches TMDB, error bodies never echo the key, the request URL, or TMDB
  internals, network errors redacted in logs (Build 3 Bug 1 pattern). No
  `search` endpoint yet (Build 17). New server code gets **its own commit and
  its own log entry** (LESSONS). Deno and Docker are not available on this PC
  (Build 3 log) and `tsconfig.json` excludes `supabase/functions`, so the
  Deno file is neither type-checked nor run by any gate. **Decision: all
  logic goes in a pure file, `supabase/functions/_shared/tmdb.ts`, with no
  `Deno` globals** (Supabase's own shared-code folder, so the deploy bundles
  it), **checked by a dedicated tsc target, `supabase/functions/tsconfig.json`**
  (`include` only `_shared/`; new Phase 2 gate `npx tsc --noEmit -p
  supabase/functions/tsconfig.json`) and by Jest tests that import it by
  relative path **without the `.ts` suffix** (the main `tsc` follows the
  import even though `supabase/functions` is excluded and would raise TS5097
  on `./tmdb.ts`). `supabase/functions/tsconfig.json`: if it extends the app
  base it drops `"types": ["jest"]` (the pure file needs no test globals; the
  Jest files are checked by the main tsc), and sets `lib: ["ESNext"]` with no
  DOM so a stray `window` or `document` in the pure file fails the gate.
  The pure file holds: parameter validation (`/^\d+$/` first,
  then the range, for `id` and `page` — `Number()` alone accepts `1e2`, `0x10`
  and padded spaces), the config check (missing key: 500, fixed message),
  upstream-status mapping, response shaping, adult filtering and log
  redaction. `index.ts` keeps only `Deno.serve`, `Deno.env.get`, `fetch`,
  `console.error` and the CORS headers (about ten lines): **review-only** for
  Ruby, exercised by the Manager's curl. **A broken TMDB key must not be
  silent.** Today the proxy forwards TMDB's status, so a revoked key becomes
  TMDB 401, then app 401: never retried, never reported. Mapping (a Jest case
  each): TMDB 401/403 -> **502** `code: upstream_auth`; missing key -> 500
  `code: misconfigured`; network failure -> 502 `code: upstream_network`; TMDB
  404 -> 404; 429 -> 429; other TMDB 5xx or 4xx -> 502. Every error body is
  `{ error, code }` with fixed text and never TMDB's `status_message` (this
  replaces Build 3's pass-through). `popular` responses also carry
  `Cache-Control: public, max-age=300` (rate-limit mitigation; the app's own
  HTTP client does not cache it, so it only helps if something upstream
  does). The Manager deploys
  with `npx supabase functions deploy tmdb --use-api --project-ref
  <ref>` (the only CLI action allowed on the live project besides secrets,
  app CLAUDE.md) and smoke-tests it live with curl as in Build 3, before QA.
  Ruby reviews the function file before deploy, as in Build 3. Adult
  titles: results with `adult: true` are dropped by the proxy (a Play Store
  app must not show them); a details request for an adult title answers 404.
- **M3 Dependencies.** `@tanstack/react-query` and `@shopify/flash-list`,
  both through `npx expo install` (never plain `npm install`). Expo SDK 57
  pins FlashList at **2.0.2**, which is JavaScript-only, and TanStack Query
  is JavaScript-only, so **no native dev-build rebuild is expected**.
  `expo-image` is already native-built (Avatar uses it). Bella confirms
  after installing: `npx expo install --check` is clean and no new native
  module appears; if one does, the Manager rebuilds the dev client (short
  `GRADLE_USER_HOME`, app CLAUDE.md) before QA and says so in the log.
  FlashList needs its Jest setup file in the Jest config (per FlashList's
  Jest docs; Bella verifies). **Not added:** `@react-native-community/netinfo`
  and `expo-network` — both native, both would force a rebuild, and M5 solves
  the offline case without them.
  The "JavaScript-only" claim is unverified until the packages are installed
  (neither is in `package.json` yet): after installing, Bella checks that
  neither package ships `android/` or `ios/` native source, and the
  `expo install --check` guard stays in A7.
- **M4 QueryClient: created once in `src/lib/queryClient.ts`, provided once
  in the root `src/app/_layout.tsx`** (outside `AuthProvider`, so every
  screen and test shares it). Defaults: the Popular list has `staleTime` 5 min
  **and `refetchOnMount: false`** (it is a session-long list; only a pull
  refreshes it, 12b C6), details `staleTime` 30 min (movie data changes slowly; TMDB's own terms
  cap cached data at six months, RESEARCH.md §1, and nothing here is kept
  past app close); `gcTime` 30 min; `retry` and timeout per M5; no
  `refetchOnWindowFocus` wiring (an infinite query refetches every loaded
  page, and a browse list gains nothing from it; pull-to-refresh is the
  refresh). **No on-disk persistence of API data in v1** (see N4). Query keys
  for TMDB data are public and **not owner-tagged** (`["movies","popular"]`,
  `["movies","details", id]` with `id` a **number**, parsed once from the route param): they hold no user data, so sign-out does not
  need to clear them. Any later query that mixes user state (watched flags,
  collection) must be owner-tagged as `useOwnProfile` is. Hooks live in
  `src/modules/movies/hooks/`; the `api/` folder stays the only Supabase
  touchpoint (DESIGN §4 module contract).
- **M5 Request timeout, retry and offline rule (answers Queenie's ~60 s
  offline Profile skeleton).** Every proxy call passes `timeout:
  REQUEST_TIMEOUT_MS` (**8000**, one constant in `src/lib/`) and the query's
  `AbortSignal` (both are options of `supabase.functions.invoke`, confirmed in
  the installed `@supabase/functions-js` types). Retry: **once**, after 1 s,
  for a timeout, a network failure or a 5xx; **never** for a 4xx (400
  invalid input, 404 not found, 429 rate-limited). So the worst case to an
  error state is about 17 s, and a plain offline failure (instant, as Build 3's
  QA saw) shows the error within about 2 s. **An offline cold start shows the
  four-state screen's loading state, then the error state with Retry.** It
  never hangs. Data already loaded in this session stays on screen while
  offline. The same constant is the rule for every later TMDB call. The
  existing Profile skeleton problem is a separate pre-existing bug; the
  Manager may apply the same constant there (not part of these Builds).
  **What is proven where:** the first attempt aborts at 8 s and the error
  state appears at about 17 s (two attempts plus the 1 s delay). Jest proves
  the option is passed and the error mapping; the abort itself is
  functions-js's (A2 gives the Manager's one-off proof).
  **The retry rule needs the status, so the api layer throws a typed error.**
  Today `getPopularMovies` throws `new Error(message)` and loses it. New
  `MovieApiError` with `kind` = `timeout` | `network` | `http` | `shape`,
  `status` (http only) and `code` (the proxy's `code`, read from the response
  body, when there is one): `FunctionsHttpError` (status from
  `error.context.status`) -> `http`; `FunctionsFetchError` (no status) ->
  `network`, or `timeout` when it is an abort we did not request;
  `FunctionsRelayError` -> `http` 502; a body that fails the validator ->
  `shape`. Retry and Sentry decisions read only `kind`, `status` and `code`.
  A `FunctionsRelayError` is therefore http 502 **with no `code`**: retried
  once, **not** reported (an unmapped 502 is transient infrastructure, not a
  known fault). `upstream_auth` (also 502) is likewise retried once under the
  generic 5xx rule; harmless, since Sentry fires once per query, not per
  attempt.
  **Response validators** (`parsePopular`, `parseDetails`): `results` is an
  array and every movie has a numeric `id` and a string `title` (details: a
  `movie` object with the same, `cast` an array); anything else throws
  `shape`. `getPopularMovies(page = 1, signal?)` stays call-compatible, so the
  Build-3 debug button is unchanged.
- **M6 Images.** `expo-image` everywhere (RESEARCH.md §5), `cachePolicy`
  `memory-disk`, `recyclingKey` inside FlashList, short fade-in. The URL base
  `https://image.tmdb.org/t/p/` and the sizes are **constants in
  `src/modules/movies/`, not fetched from TMDB's `/configuration`** (one less
  endpoint and round trip; the base is long-stable): grid poster `w342`,
  details poster `w500`, cast photo `w185`. Image URLs hold no key. Poster
  aspect ratio **2:3** everywhere (TMDB's posters are 2:3). TMDB gives no
  blurhash, so the loading placeholder is the `Shimmer` treatment on the
  `bg.elevatedFlat` flat fill; a missing `poster_path` or a failed image shows
  the **fallback poster icon plus the title**, so the tile is still
  identifiable (DESIGN §2 `PosterCard` error state). Inside FlashList the
  card is the flat fill, never `BlurView` (DESIGN §1.5/§7).
- **M7 Navigation.** Poster tap pushes `movie/[id]` (DESIGN §3), a root-level
  Stack route placed **inside the session-guarded group** of the root
  `_layout.tsx` (Build 13). Header back chip (36 chip as Edit profile,
  label "Back") and the Android hardware back both return to Home, which
  stays mounted, so the loaded pages and scroll position survive. A cold
  start from a deep link has no history: back then goes to Home
  Without an anchor, Android hardware back on a cold deep link **exits the
  app**, so the root `_layout.tsx` exports `unstable_settings = { anchor:
  "(tabs)" }` (Bella confirms the exact name against the installed Expo
  Router docs; the back chip's fallback is `router.canGoBack()` false ->
  `router.replace('/')`). **Deep link is
  free** (the `perchable` scheme exists; Expo Router maps the route):
  `perchable://movie/<id>`. Signed out, the guard sends it to sign-in and the
  target is dropped after sign-in (accepted; preserving it is a later
  feature). In Build 12 posters are **not tappable** (no pressed state, no
  button role): a poster that did nothing would be the silent no-op DESIGN §7
  forbids, so Build 13 turns `onPress` on.
- **M8 TMDB attribution.** The exact sentence and logo stay on Settings,
  About (DESIGN §6/§7), and Queenie re-checks it verbatim in both Builds as
  a standing §7 item. RESEARCH.md §1 states the requirement as the logo plus
  the notice, less prominent than the app's own branding, and names no
  page-level requirement; so **nothing extra is required on Home or the
  details screen** (Manager default; Rose can re-check the terms page if
  Justin wants it certain). The proxy still returns `attribution` in every
  response (Build 3). **Open check (Rose, before ship):** RESEARCH.md §1
  quotes "This app uses TMDB..." while DESIGN §6, Settings and the proxy use
  "This application uses TMDB..."; Rose confirms TMDB's official wording and
  the Manager corrects whichever is wrong. Nothing changes now.
- **M9 Sentry (LESSONS: unexpected errors only, always the `environment`
  tag).** One place: the QueryClient's `QueryCache` `onError`. Reported:
  proxy 500 (`misconfigured`), **502 `upstream_auth` (a revoked or wrong
  TMDB key; otherwise silent)**, a `shape` error, anything unexpected.
  **Not** reported: offline, timeout, 502 `upstream_network` (a TMDB hiccup), a 502 with no `code` (relay error),
  any 4xx, 404 (a movie that
  does not exist is data, not a bug), 429. Once per failed query, never per
  render or per retry. Never a user-typed value (none exist here).
- **M10 Where code lives (DESIGN §4).** `src/modules/movies/`: `api/`
  (`getPopularMovies`, `getMovieDetails`), `hooks/` (`usePopularMovies`
  infinite query, `useMovieDetails`), `components/` (poster grid, details
  sections), `tmdbImage.ts`, `types.ts`, `index.ts`. `src/ui/` gets
  `PosterCard` (12a) and `TierBadge` (13). Routes stay thin: `(tabs)/index.tsx`
  and `movie/[id].tsx` compose `ui/` plus the module's exported hook and
  components, with no Supabase call and no fetching logic in the route file.

#### NEEDS JUSTIN (none blocks; each default applies until he answers)

- **N1 Home content.** Default: one Popular grid; no Trending / Now Playing
  sections; "Have You Watched This?" and "Friend Activity" (inspo) wait for
  the collection and follow Builds (19, 23). Adding a section is a feature
  addition and comes back to him.
- **N2 Build 12 split.** Default: two Builds, **12a** (data layer + first
  page of posters on Home) and **12b** (infinite scroll + pull-to-refresh).
  Number 12 unchanged; own log and Phases each. Manager default 2026-10-01 —
  Justin may overturn; process only, no feature change.
- **N3 Details content.** Default: title, year, runtime, genres, tagline,
  synopsis, TMDB rating, top 15 cast (photo, name, character), the S/A/B/C
  tier-badge shell and the `#spoiler-free-lounge` panel shell (both UI-only,
  DESIGN §5). **Not** included (each would be a feature add): trailer,
  director and crew, where-to-watch, similar movies, a "watched" button (that
  is Builds 16 and 18), cast-member pages.
- **N4 Offline cold start.** Default: no stored cache; the app shows loading,
  then the error state with Retry (M5). Showing last session's list offline
  would need persisted query data (a small JavaScript add, no native
  change); Priya's view is it is not worth it for v1. He can ask for it.
- **N5 Home layout detail.** Default: 3 columns (matches the My Collection
  grid in DESIGN Build 6 and fits 104 dp posters on a 360 dp phone); Dianne
  may propose 2 columns with her mockup, and the Manager decides unless it
  changes the look Justin approved.

- **N6 Deep link.** Default: `perchable://movie/<id>` works (free from the
  existing scheme and the details route). Small addition beyond Vision Part
  2; he can ask to drop it.
- **N7 Adult titles hidden.** Default: the proxy drops `adult:true` results
  and a details request for one answers 404 (Play Store content safety). A
  small addition beyond Vision Part 2; he can ask to drop it.

Dianne's Phase 0 settles (not Justin): grid gap and padding, the Roulette
card's blur-or-flat choice (the real `BlurView` is allowed on this one static
card only if it renders correctly in a FlashList header on the emulator,
otherwise the flat fallback, LESSONS Platform), section title copy, the
loading skeleton count, footer and refresh copy, and a **DESIGN §3
inconsistency to resolve**: §3 says the tab bar stays visible under `movie/`,
but a root-level Stack route (a sibling of `(tabs)`) covers it. Manager
default: details is a full-screen push with a back chip and no tab bar, like
Edit profile.

```
Build 12a — Home poster grid, first page        Module: Movie browse/details
   (first half of Build 12; Manager default 2026-10-01 — Justin may overturn,
   N2. Number 12 unchanged; own log, own Phases 1-5. Phase 0 is done once
   for 12a and 12b together.)
Done means (checkable):

  A. Data layer (mostly invisible; proven by tests)
  A1. [Jest] `src/lib/queryClient.ts` exports one QueryClient with the M4
      defaults (including `refetchOnMount: false` on the Popular list).
      [Ruby] greps that the root `_layout.tsx` provides it once and no screen
      creates its own client.
  A2. [Jest] Timeout option: every proxy call sets `timeout:
      REQUEST_TIMEOUT_MS` (8000) and passes the query's signal (a stub
      `invoke` records the options). The abort itself is functions-js's, so
      [Mgr] proves it once with a throwaway Node script (not committed) that
      calls the real `supabase.functions.invoke` with a short timeout against
      a local server that accepts the connection and never answers, and prints
      the mapped error `kind: timeout`. The 8 s / ~17 s timing is read from
      QA's offline run (B6), not asserted in Jest; fake timers over a stub
      that never resolves would only test the stub.
  A3. [Jest] Typed error and retry: the api layer throws `MovieApiError`
      (M5) built from **real** `FunctionsHttpError`, `FunctionsFetchError` and
      `FunctionsRelayError` instances (the tests construct the classes from
      `@supabase/functions-js`, so the mapping that ships is the one tested).
      The retry policy runs through it: one retry for `timeout`, `network` and
      http 5xx; none for http 400/404/429 and none for `shape`.
  A4. [Jest] Validators: `parsePopular` rejects a non-object body, `results`
      not an array, and a movie without a numeric `id` or a string `title`
      (each throws `shape`); it accepts a normal page and a page with zero
      results. [Jest] Sentry from the `QueryCache` only (M9): 500, 502
      `upstream_auth` and `shape` are captured once with the `environment`
      tag; offline, timeout, 4xx and 502 `upstream_network` are not.
  A5. [Jest] + [Mgr] Edge Function `popular` hardened, logic in
      `_shared/tmdb.ts` (M2): `adult:true` results removed (a page can come
      back with fewer than 20, even none); `endpoint` outside the whitelist
      400; `page` must match `/^\d+$/` then 1-500 (`abc`, `-1`, `0`, `501`,
      `1.5`, `1e2`, `0x10`, ` 5`, empty -> 400; absent -> 1); a missing key
      500 `misconfigured` without naming it (this branch is in the pure file,
      so it is tested); the status mapping of M2 (TMDB 401 and 403 -> 502
      `upstream_auth`, 404, 429, 5xx, network); log redaction removes the key.
      The wrong-key mapping is Jest-only (the live secret is not touched).
      [Mgr] after deploy, curl: `popular` 200 with at most 20 results, the
      exact attribution and `Cache-Control: public, max-age=300`;
      `endpoint=foo`, `page=abc`, `page=1e2`, `page=%205` all 400; no auth
      header 401; no `api_key` in any body or header.
  A6. [Jest] `tmdbImage(path, size)` returns base + size + path and null for
      a null/empty path; the sizes are the M6 constants.
  A7. [Mgr] `@tanstack/react-query` and `@shopify/flash-list` (2.0.2) are
      installed with `npx expo install`; `npx expo install --check` is clean;
      the no-native-code check of M3 is done; FlashList's Jest setup is in
      the config; the new gate `npx tsc --noEmit -p
      supabase/functions/tsconfig.json` exists and passes; the Build log says
      whether a native rebuild was needed (expected: no).

  B. Home screen (`(tabs)/index.tsx` composes; no fetching in the route)
  B1. [QA] A signed-in user opens Home and sees, top to bottom: the existing
      avatar chip (still tappable to Profile), the Perch Roulette card, a
      section title, then a 3-column grid of 2:3 posters with their images
      loaded, from live TMDB Popular page 1 (up to 20 posters; fewer when the adult
      filter removed some).
  B2. [QA] Roulette is a UI shell: tapping it shows the `Toast` (variant
      coming-soon) "Smart picks are coming soon." and nothing else happens;
      no fake success (DESIGN §5/§7).
  B3. [Jest] + [QA] All four states (DESIGN §2/§7). Loading: 12 poster
      shimmers in the grid's shape, one polite live-region label "Loading
      movies"; empty (zero usable results): `EmptyState` with Retry; error:
      `EmptyState` (icon 🦉, "Couldn't load movies", Retry, the Build 6
      pattern) and Retry reloads; filled. Copy comes verbatim from Dianne's
      DESIGN.md table.
  B4. [Jest] `PosterCard` (new, `src/ui/PosterCard/`): loading, loaded and
      error (fallback icon + title) states; flat fill, no `BlurView`; in this
      Build it has no `onPress`, no pressed state and no button role. Only
      the props this Build uses are built (`posterUrl`, `title`, optional
      year); `watched`, `tier`, `caption` arrive with the Builds that use them.
  B5. [QA] A movie with no poster shows the fallback icon plus its title; with
      the network cut after the list loaded, posters not yet cached show the
      fallback, not a blank tile.
  B6. [QA] Offline cold start (wifi and data off, force-stop, relaunch): the
      loading state, then the error state with Retry within about 20 s
      (M5); network back on, Retry loads the grid. Evidence includes the time
      to the error state.
  B7. [QA] Accessibility: each poster's label is "{title}, {year}" (title only
      when the year is unknown), role image; the shimmers are not announced one
      by one; Retry is at least 48 dp.
  B8. [Ruby] Standards greps on the diff: no literal colors, sizes or spacing
      (tokens only), no `BlurView` under a FlashList item, no Supabase call or
      business logic in the route files, no `useEffect`-based fetching, header
      top spacing from safe-area insets, the dev-client gear corner (top-right
      64x64) empty, 1-2 line purpose comment on each block. The TMDB key is
      absent from the `expo export --platform android` output (same grep as
      Build 3).
  B9. [Mgr] Phase 0 (Dianne) also updates DESIGN §3 (Home line: grid, roulette
      shell; the tab-bar-under-`movie/` question above) and §4 (`PosterCard`
      added to `ui/`).

Test on: emulator (`td_emu`, restarted before QA per LESSONS; signed-in
  session already on the device, or Justin signs in if it was lost). Edge
  Function proven by Jest plus the Manager's live curl.
Needs from Justin: nothing. (N1, N2, N3, N5 are defaults he may overturn.)
Failure modes to cover (Manager expands into the log):
  - Network: offline cold start; offline mid-session (loaded list stays);
    timeout (hung request); server 5xx; 429; response with `results` empty;
    response missing a field or the wrong shape (error state, one Sentry
    event); **sign-out while loading** (the session ends mid-request: a 401 or
    the unmount under the session guard shows no error, sends no Sentry event
    and sets no state after unmount; a Jest test).
  - Data: `poster_path` null; a poster URL that 404s with a non-null
    `poster_path` (fallback icon + title); very long titles (two lines, ellipsis); title
    with emoji or right-to-left text; `release_date` empty or malformed
    (year omitted, no "NaN"); `vote_average` not used in this Build.
  - Interaction: double-tap Retry (one request); leave Home mid-load and
    return (no state update after unmount, no duplicate request); large
    font scale (the app is portrait-only per app.json; grid still 3 columns, no overflow, no horizontal
    scroll).
  - Security: no key in the bundle, logcat or any error text; the proxy
    answers only the whitelisted endpoint; the 400 body contains no echo of
    the input.
  - Cleanup: none (no stored rows; image cache is expo-image's).
  - Sentry: unexpected failures only (M9), once each, with `environment`.
Phases: 0 Dianne mockup (Home: header, Roulette shell, section title, grid;
        states loading / empty / error / filled; image fallback; the 12b
        footer, refresh and next-page-error states in the same board; copy
        table; updates DESIGN §3/§4) · 1 Bella build (Edge Function change in
        its own commit + log entry) · 2 Bella gates (tsc, lint, jest,
        `expo export` key grep) · [Ruby pre-deploy check of the function file,
        then Manager deploys `tmdb` and curls it] · 3 Queenie QA · 4 Ruby
        review · 5 Manager ships
```

```
Build 12b — Infinite scroll and pull-to-refresh   Module: Movie browse/details
   (second half of Build 12; Manager default 2026-10-01 — Justin may
   overturn, N2. Own log, own Phases 1-5; Phase 0 is covered by 12a's board.)
Done means (checkable):
  C1. [Jest] + [QA] Scrolling near the bottom loads the next page (page 2,
      20 more posters append below the first 20; a small spinner row is shown
      while it loads). `getNextPageParam` stops at `min(total_pages, 500)`;
      no request is made after the last page.
  C2. [Jest] The same movie id appearing on two pages (TMDB's order shifts
      between requests) renders once: the flattened list is de-duplicated by
      id, so FlashList never sees a duplicate key. (Found the hard way in
      another project: the same item printed twice on a list.)
  C3. [Jest] One request in flight at a time: `onEndReached` firing
      repeatedly while a page loads, or while there is no next page, makes no
      extra request.
  C4. [Jest] + [QA] Next-page failure (offline or error on page 2+): the
      loaded posters stay; the list footer shows an inline "couldn't load
      more" row with Retry (at least 48 dp); Retry loads the page. It never
      replaces the whole screen with the error state, and never shows an empty
      footer that looks like the end of the list.
  C4b. [Jest] An adult-filtered page that comes back empty never stalls the
      list. The loop lives **inside the `queryFn`** (no effect calling
      `fetchNextPage`, which the standards check bans): it fetches up to 3
      consecutive TMDB pages and returns the first non-empty one;
      `getNextPageParam` uses the real last page number fetched (not
      `pages.length + 1`), so no TMDB page is skipped or repeated. Retry and
      Sentry stay once per query, not per inner page. If all 3 are empty and
      more pages exist, the query returns the empty page and the footer shows
      C4's Retry row ("load more"), so there is always a footer state; after
      the last page there is no spinner. Tests: first page empty then a full
      one; three empties; the page-number bookkeeping.
  C5. [Jest] + [QA] Pull-to-refresh (FlashList's refresh control, tinted from
      tokens) fetches **page 1 only** and drops later pages. Mechanism
      (TanStack Query v5 has no `refetchPage`): on pull, `await
      queryClient.cancelQueries({ queryKey })`, then `queryClient.setQueryData(
      key, d => d && { pages: d.pages.slice(0, 1), pageParams:
      d.pageParams.slice(0, 1) })`, then `refetch()`. `maxPages` is not used
      (it bounds memory, not the refetch count). A Jest test counts exactly
      one request with five pages loaded; the list returns to the top. **Failed refresh:** the
      trim must not lose the list. Before trimming, snapshot the
      infinite-query data; if the refetch errors, `setQueryData(key,
      snapshot)` restores it (all loaded posters and the page count as they
      were, scroll position kept) and an error `Toast` says so ("Couldn't
      refresh. Check your connection."); the screen does not flip to the
      error state. A Jest case for the failure: five pages loaded, the page-1
      refetch rejects, and the list is still five pages with the same ids,
      and the toast shows. (If the user scrolled during the pull, the restore
      still applies; C5c keeps next-page requests out until the refresh ends.)
  C5b. [Jest] A pull **while a next-page request is in flight**: the
      `cancelQueries` aborts it and its late result is ignored. Test with a
      deferred stub for page 2: pull, then resolve page 2; the list is the
      fresh page 1 only, the footer spinner is gone, no duplicate id.
  C5c. [Jest] The reverse order: `onEndReached` firing while a refresh is
      running makes no next-page request until the refresh completes (guarded
      by the refetching flag), so a stale `pageParam` is never appended.
  C6. [QA] Leaving Home (Profile tab) and returning, at any time, shows the
      same list and position with no new request (`refetchOnMount: false`,
      M4); only a pull or an app restart refreshes it.
  C7. [QA] Scrolling about 100 posters (5 pages) on the emulator shows no
      blank tiles after a pause and no crash. The log records `gfxinfo` janky
      frames. **No pass threshold on the emulator** (it is slow, LESSONS
      2026-10-01); a feel check on a real phone happens only with an APK
      Justin asks for.
  C8. [Ruby] Standards as 12a B8 for the new code; the footer and refresh
      states use tokens and existing `ui/` pieces (`Toast`, `ErrorCard` or
      the Build 6 pattern, `Shimmer`).
Test on: emulator.
Needs from Justin: nothing.
Failure modes to cover (Manager expands into the log):
  - Paging: fast fling to the bottom; end of list; page 2 fails then page 3;
    a pull-to-refresh while a next-page request is in flight (the in-flight
    page must not be appended after the reset); a refresh at page 1 only;
    duplicate ids across pages.
  - Network: offline mid-scroll; timeout on a page; 429; app backgrounded
    during a load and resumed.
  - Interaction: double pull; pull then immediately scroll; leave the screen
    mid-refresh (no state update after unmount).
  - Sentry: as M9, once per failed page, not once per retry.
  - Cleanup: none.
Phases: 0 skip (12a's Phase 0 board already draws the footer, refresh and
        next-page-error states) · 1 Bella build · 2 Bella gates (tsc, lint,
        jest) · 3 Queenie QA · 4 Ruby review · 5 Manager ships
```

```
Build 13 — Movie details screen            Module: Movie browse/details
Done means (checkable):

  A. Server and data layer
  A1. [Jest] + [Mgr] Edge Function gains `endpoint=details&id=<n>`:
      `id` must match `/^\d+$/` and then be 1 to 2147483647, or the answer is
      400 (before TMDB is called; logic in `_shared/tmdb.ts`, M2); the function asks TMDB for the movie with
      credits in one call and returns **only** a trimmed
      `{ movie: { id, title, tagline, overview, poster_path, backdrop_path,
      release_date, runtime, vote_average, vote_count, genres:[{id,name}],
      cast:[{id,name,character,profile_path}] (first 15 by TMDB order) },
      attribution }`, never TMDB's raw body; TMDB 404 answers 404 with a fixed
      message; an adult title answers 404; other TMDB failures use the M2 mapping
      (401/403 -> 502 `upstream_auth`, a Jest case for details too; no
      `status_message` pass-through); unknown endpoint still 400. New server code, own commit + log entry. [Mgr] after
      deploy, curl: a real id 200 with the exact attribution and at most 15
      cast; `id=abc`, `id=0`, `id=99999999999`, `id=1e3`, `id=%205` all 400; a nonexistent id 404; no
      auth 401; no `api_key` in any body.
  A2. [Jest] `getMovieDetails(id, signal)` and `useMovieDetails(id)` (`id` a
      number): M4/M5 defaults (stale 30 min, one retry, 8 s timeout); errors
      are `MovieApiError` (M5) and `parseDetails` rejects a bad body as
      `shape` (a test); an http 404 becomes the not-found state (no retry, not
      sent to Sentry), everything else an error; the movie type is added to
      `types.ts`.

  B. Navigation (M7)
  B1. [QA] Tapping a poster on Home opens the details screen for that movie;
      the header back chip and the Android hardware back both return to Home
      with the same loaded pages and scroll position, and no new request
      while fresh.
  B2. [Jest] + [QA] Double-tap on a poster opens **one** details screen (one
      back press returns to Home), not two stacked copies.
  B3. [Mgr] Deep link: with the app signed in, `adb shell am start -a
      android.intent.action.VIEW -d "perchable://movie/<id>"` opens that
      movie's details; back goes to Home; the same link while signed out
      lands on sign-in. Cold start from the link works.
  B4. [Jest] A route id that is not a positive integer (`abc`, `0`, `-1`,
      `1.5`, `1e3`, ` 5`) shows the not-found state and makes **no** proxy call.
  B5. [Ruby] `movie/[id]` is inside the session-guarded group of the root
      layout; the route file only composes the module's hook and components.
  B6. [QA] The `PosterCard` on Home is now a button (role button, hint "Opens
      movie details", pressed state per DESIGN §2); the 12a/12b behaviour is
      otherwise unchanged (regression of Builds 12a-12b).
  B7. [Jest] Leaving the screen mid-load **aborts the request** (the signal
      is aborted), sets no state after unmount and sends no Sentry event.
      Opening movie B right after backing out of movie A never shows A's data
      (queries are keyed by the numeric id).
  B8. [Mgr] Cold deep link and hardware back: with the `anchor` of M7, back
      from a deep-linked details screen lands on Home and does not exit the
      app.

  C. Screen content
  C1. [QA] For at least two real movies (one from Home, one chosen by deep
      link for sparse data) the screen shows: poster, title, year, runtime,
      genres, tagline when present, TMDB rating (one decimal, "of 10"),
      synopsis, and a horizontal cast row (photo, name, character) from the
      live proxy. Cast rows use the existing `ui/Avatar` (initials fallback
      when `profile_path` is null). Cast members are not tappable (N3).
  C2. [Jest] Missing data never prints a blank or "NaN": no overview shows
      "No synopsis available."; no cast hides the Cast section; zero votes
      shows "Not rated yet" instead of 0.0; no poster shows the fallback;
      no release date omits the year; runtime 0 or null omits the runtime;
      empty genres omit the line. Exact strings come from Dianne's copy table.
  C3. [QA] States: loading (shimmers in the final layout), error (Retry,
      Build 6 pattern; loaded data is not lost on a refetch error), not found
      (404 or invalid id: message and a way back), loaded. "Empty" does not
      apply to a single movie; the screen says so in the log.
  C4. [QA] UI shells (DESIGN §5), visible and giving feedback on tap, never a
      silent no-op or fake success: the `TierBadge` opens the static legend
      popover; the `#spoiler-free-lounge` panel shows its static sample
      content with the composer in the disabled, non-focusable style. [Ruby]
      confirms no rating or comment is stored or fetched from anywhere, and the
      panel is not wired to a table (Module 9 wires it later).
  C5. [QA] Accessibility: back chip "Back"; the title is a header; each cast
      item reads "{name} as {character}" (or just the name); rating reads as
      a sentence ("Rated 7.8 out of 10 on TMDB"); every control at least 48
      dp; the gear corner (top-right 64x64) stays empty.
  C6. [Ruby] Standards as 12a B8 for the new code (tokens only, no BlurView
      in lists, no Supabase in routes, comments on blocks), and TMDB
      attribution on Settings is still verbatim with the TMDB logo less
      prominent than Perchable's (DESIGN §7 standing check; nothing is
      required on this page, M8).
  C7. [Mgr] Phase 0 (Dianne) also updates DESIGN §3 (the `movie/[id]` line,
      tab-bar visibility settled) and §4 (`TierBadge` added to `ui/`).

Test on: emulator (deep link through `adb`, Build 12 regression on the way).
Needs from Justin: nothing.
Failure modes to cover (Manager expands into the log):
  - Network: offline when opening (error state, Retry); offline after a
    previous visit within 30 min (cached details show); timeout; 5xx; 429;
    the movie opens while the list refreshes behind it; **sign-out while
    loading** (401 mid-flight or unmount under the session guard: no error
    screen, no Sentry event, no state after unmount; a Jest test).
  - Data: id that does not exist (404, no Sentry); adult title (404); missing
    overview, cast, poster, release date, runtime, tagline, genres; 15+ cast
    (capped); very long title, tagline and character names (wrap, no
    overflow); a cast member with no photo.
  - Interaction: double-tap on a poster; back mid-load (no state update after
    unmount, request aborted); rapid open-back-open of different movies (each
    screen shows its own movie, never a previous one's data); hardware back
    on a deep-link cold start.
  - Security: no key in the bundle, logcat or errors; `id` validated on the
    server and again on the client; the 400/404 bodies echo nothing.
  - Sentry: M9 only; a 404 is not an event.
  - Cleanup: none (no rows; cached details live 30 min in memory).
Phases: 0 Dianne mockup (details: loading / error / not-found / loaded,
        sparse-data variant, cast row, tier-badge legend, spoiler-lounge
        shell, long-text case; updates DESIGN §3/§4) · 1 Bella build (Edge
        Function change in its own commit + log entry) · 2 Bella gates (tsc,
        lint, jest, `expo export` key grep) · [Ruby pre-deploy check of the
        function file, then Manager deploys `tmdb` and curls it] ·
        3 Queenie QA · 4 Ruby review · 5 Manager ships
```

### Modules 5–12 — rough (one line each, detailed when the team reaches them)

```
Build 14 — Swipe deck                     Module: Quick-add swipe
Done means: gesture-handler + reanimated swipe left/right on a movie card.
Test on: emulator
```

```
Build 15 — Selectable swipe sequence      Module: Quick-add swipe
Done means: user picks recent / older / random ordering for the deck.
Test on: emulator
```

```
Build 16 — Swipe-right adds to collection Module: Quick-add swipe
Done means: swiping right adds the movie to the signed-in user's collection.
Test on: emulator
```

```
Build 17 — Search by title                Module: Search/add
Done means: search screen queries the TMDB proxy via TanStack Query and
  lists matching titles.
Test on: emulator
```

```
Build 18 — Add from search result         Module: Search/add
Done means: tapping a search result adds it to the collection.
Test on: emulator
```

```
Build 19 — My Collection list             Module: Collection + captions
Done means: collection screen lists a user's added movies; deleting the
  account removes this module's rows (ON DELETE CASCADE).
Test on: emulator
```

```
Build 20 — Add caption                    Module: Collection + captions
Done means: user attaches/edits a text caption per collection movie.
Test on: emulator
Carry-forward: see Module 3 carry-forward rules 1–5 (section 5, before Build 12).
```

```
Build 21 — Remove from collection         Module: Collection + captions
Done means: user removes a movie from their collection.
Test on: emulator
```

```
Build 22 — Maestro smoke test             Module: Collection + captions
Done means: one Maestro YAML flow — sign in with Google → swipe to add a
  movie → see it in collection — runs green once Modules 4–7 all exist,
  becomes a required regression check from here on.
Test on: emulator (Maestro)
```

```
Build 23 — Follow/unfollow                Module: Social — follow + profile modal
Done means: follow button toggles state, visible on the target profile;
  deleting the account removes this module's rows — both directions of the
  follow graph (ON DELETE CASCADE).
Test on: emulator
```

```
Build 24 — Discord-style profile modal    Module: Social — follow + profile modal
Done means: tapping another user opens the formSheet modal (RESEARCH.md §4)
  showing name, join date, watched count, followers.
Test on: emulator
Carry-forward: see Module 3 carry-forward rules 1–5 (section 5, before Build 12).
```

```
Build 25 — Comment on a watched movie     Module: Comments
Done means: user comments on another user's collection entry (requires
  terms acceptance, Build 11); deleting the account removes this module's
  rows (ON DELETE CASCADE).
Test on: emulator
Carry-forward: see Module 3 carry-forward rules 1–5 (section 5, before Build 12).
```

```
Build 26 — Comment on/off toggle          Module: Comments
Done means: profile owner toggles commenting off; RLS blocks new inserts
  per the answer to open decision #1 (section 7).
Test on: emulator
```

```
Build 27 — DM conversation                Module: DMs
Done means: two users exchange messages live via Supabase Realtime;
  deleting the account removes this module's rows (ON DELETE CASCADE).
Test on: emulator
Carry-forward: see Module 3 carry-forward rules 1–5 (section 5, before Build 12).
```

```
Build 28 — DM block enforcement           Module: DMs
Done means: a blocked user cannot open/send in a DM thread with the
  blocker, enforced in RLS (not just hidden in the UI).
Test on: emulator
Carry-forward: see Module 3 carry-forward rules 1–5 (section 5, before Build 12).
```

```
Build 29 — Leaderboard views              Module: Rankings
Done means: most-added, most-discussed, most-watched, most-active views
  return correct aggregates from a plain Postgres view (materialize only if
  a real slow-query bottleneck shows up).
Test on: emulator
```

```
Build 30 — Web account-deletion page      Module: Account deletion completion
Done means: a static page (justin94.space or a Supabase Edge Function form)
  accepts a deletion request by email/account ID for a user without the app
  installed.
Test on: emulator/browser
```

```
Build 31 — End-to-end deletion check      Module: Account deletion completion
Done means: deleting an account with data in every module (profile,
  collection, comments, DMs, follows, reports/blocks) leaves zero rows
  behind across all tables — verified directly in the Supabase table
  editor, not just "no error shown."
Test on: emulator + Supabase dashboard check
```

---

## 6. Service setup — the Manager does it, in Justin's Chrome

The Manager does every setup step below in real Chrome, using Justin's
logged-in sessions: creating projects, API keys, OAuth clients, and saving
each value to `D:\AIO Freelance\Credentials\perchable\` plus a README line
(name only). Credentials never go in the repo. Checked against
`Credentials/README.md` (2026-09-24): nothing exists yet for this app.

Justin only steps in where team rules forbid an agent: **signing up for a
brand-new account, typing a password, accepting terms/consent screens,
payment, or UAC.** The Manager stops at that exact screen and tells him.

| # | Step (Manager, in Chrome) | Needed for Build | When | Justin only if… |
|---|---|---|---|---|
| 1 | Supabase: create project, save URL + anon key | Build 2 | Before Module 1 | no Supabase account yet |
| 2 | TMDB: request API key, save it | Build 3 | Before Module 1 | no TMDB account yet; API terms acceptance |
| 3 | Sentry: create project, save DSN | Build 4 | Before Module 1 | no Sentry account yet |
| 4 | Google Cloud: OAuth consent screen + Android client (Build-1 debug keystore SHA-1) + Web client for Supabase Auth; enter them in Supabase's Google provider | Build 5 | **After Build 1** (SHA-1 only exists then), before Build 5 | consent-screen terms |
| 5 | `eas login` | first EAS build | when it lands | password prompt |
| 6 | Swap `td_emu` to a Google Play image if Google sign-in fails on the Google APIs image | Build 5 | only if Build 5 QA fails | — (Justin's OK first, per MobileDev rules) |
| 7 | Email TMDB sales before any ads Build | future ads Build | not v1 | Justin decides |
| 8 | Supabase Pro ($25/mo) vs manual un-pause | pre-launch | not v1 | Justin decides (payment) |

Steps 1–3 happen together before Module 1. Step 4 waits for Build 1's
debug keystore.

---

## 7. Open decisions Justin must answer

| # | Decision | Blocks | From RESEARCH.md |
|---|---|---|---|
| 1 | Does disabling comments on a collection hide already-posted comments, or only block new ones? | Build 26 (comment toggle) — changes the RLS design | §13.4 |
| 2 | Bottom sheet (`@gorhom/bottom-sheet`) vs Expo Router `formSheet` for the Discord-style profile popup — Priya/Rose recommend `formSheet` for Android-first v1 (leaner, no half-open peek) | Build 24 (profile modal) | §13.5 |

Both can be answered any time before their Build starts — not needed to
approve this plan.

---

## 8. Out of scope for v1

- Ads / any monetization (Vision Part 4 — explicitly "in the future")
- iOS build (Android first per Vision Part 4)
- Play Store production submission / closed testing (Vision Part 5: "not
  shipped yet")
- Recommendation engine (RESEARCH.md §8 — flagged as a category weakness,
  not a v1 feature)
- TV/multi-media tracking (movie-only per Vision Part 1)

---

## 9. Milestones

| Milestone | Completed by |
|---|---|
| Foundation (dev build, Supabase, TMDB proxy, testing + Sentry) working | Build 4 |
| Auth + profile + minimal account deletion working | Build 9 |
| Moderation base + UGC terms in place | Build 11 |
| Movie browse/details working | Build 13 |
| Quick-add swipe working | Build 16 |
| Search/add working | Build 18 |
| Collection + captions working, Maestro smoke test green | Build 22 |
| Follow + profile modal working | Build 24 |
| Comments working | Build 26 |
| DMs working | Build 28 |
| Rankings working | Build 29 |
| Account deletion completion (web page + verified cascade) | Build 31 — **v1 "done" per Vision Part 5** |

---

## 10. Risks

- **Supabase 7-day idle pause** could make a Build look broken when it's
  actually just asleep — Manager should un-pause before QA if a session has
  gone a week without touching the DB (RESEARCH.md §13.1).
- **Google sign-in on `td_emu`'s Google-APIs-only image** is unverified —
  Build 5 is the first real test; if it fails, emulator swap needs Justin's
  OK before Module 2 can finish (setup step #6).
- **Moderation (Module 3) touches nearly every later table's RLS** — if it's
  skipped or rushed, Modules 9–10 (comments, DMs) need rework. This plan
  schedules it third specifically to avoid that (RESEARCH.md §13.3).
- **Account deletion cascades are only as good as each module remembering
  to wire ON DELETE CASCADE** — every Build that adds a user-owned table
  now carries an explicit Done-means bullet for this; Build 31 is the final
  check that catches anything missed.
- **TMDB key leaking client-side** if the proxy pattern isn't followed
  exactly — Build 3's Done-means explicitly requires Ruby to check the
  bundle/network traffic, not just that the feature works.
- **Loop cap (2 rounds)** on Bug fixes — moderation and auth Builds are
  higher-risk for hitting this given RLS complexity; Manager should watch
  those loops closely.
- **Scope creep risk on "user details will keep on going on further
  updates"** (Vision Part 2) — this plan holds Module boundaries firm for
  v1; any addition beyond what's listed here is a feature change and needs
  Justin's approval (NEEDS JUSTIN), not silent inclusion.

---

## Changes

**2026-09-24 — Round 1 fixes (Ruby + Manager, flagged to Priya):**
1. Split manual step 3 (Google OAuth) into two: Supabase/TMDB/Sentry account
   steps before Build 1, Google OAuth client IDs (needs the Build-1 debug
   keystore SHA-1) moved to after Build 1, before Build 5 (Google sign-in).
2. Moved minimal account deletion from a late Module 12 into Module 2
   (new Build 9), per RESEARCH.md §6 ("alongside auth, not a late
   add-on"). Every later Build that adds a user-owned table now carries a
   "deleting the account removes this module's rows (ON DELETE CASCADE)"
   Done-means bullet. Last module renamed "Account deletion completion" —
   now only the companion web deletion page and a final end-to-end cascade
   check (Builds 30–31).
3. Confirmed the cascade bullet is present on Module 3 (Build 10, reports/
   blocked_users) and Module 8 (Build 23, follow graph) specifically, per
   RESEARCH.md §6 listing the follow graph explicitly.
4. Added Build 4 (Jest + RNTL/jest-expo with one passing test, `npx jest`
   made a required gate from then on, plus Sentry SDK wiring) to Module 1.
   Added Build 22 (Maestro smoke test: sign in → swipe-add → see in
   collection) once Modules 4–7 exist. Sentry DSN manual step moved
   earlier (now step 3, before Module 1 starts).
5. Added Build 11 (UGC terms acceptance screen + `terms_accepted_at` +
   RLS enforcement before any comment/DM insert) to Module 3, and added the
   admin action path (Justin removes content/bans a user via a direct
   Supabase query) as a Done-means bullet on Build 10.
6. Added explicit TanStack Query mentions to Build 12/13 (browse/details)
   and Build 17 (search) Done-means text.
7. Reworded section 2's backend-decision framing ("case made in Stage A,
   restated for continuity" instead of "no written case needed") and
   dropped the TheJobStash stack comparison as irrelevant to this app.

Build numbering, the milestones table, and the manual-steps table were all
updated to match. No feature was added or removed — every item above is a
sequencing/process fix inside the already-approved feature set, so none of
this is marked NEEDS JUSTIN.
- 2026-09-24 (Manager): section 6 reframed at Justin's request — service setup is done by the Manager in Justin's Chrome; Justin only for new-account signup, passwords, terms acceptance, payment.
- 2026-09-24 (Manager, Justin's decision in chat): design direction = Proposal A "Night Owl Arcade" with glassmorphism surfaces. Three inspo features added as **UI shells only** in v1 (visible, not functional): Perch Roulette (Home), S/A/B tier badges (details/collection), #spoiler-free-lounge (details). They ride inside the existing screen Builds (Home grid, details, collection) — no new Builds; wiring them is post-v1.
- 2026-09-25 (Manager, from Build 2 review): Build 5 Done-means also includes Supabase's AppState auto-refresh listener (`supabase.auth.startAutoRefresh()` on foreground / `stopAutoRefresh()` on background) so sessions refresh correctly on Android.
- 2026-09-30 (Priya, at the Manager's request): detailed Builds 10-11 (Module 3) in section 5; rough one-liners replaced. No Build number, order or feature removed. **NEEDS JUSTIN (interpretation, not silently applied):** two Settings rows the Done-means implies but never named - "Blocked users" (Build 10: list + unblock) and "Terms & community rules" (Build 11: read/accept). Added, as infrastructure not features: `docs/ADMIN-MODERATION.md`, the SQL helper functions, the dev-only harness, and five Module 3 carry-forward rules for Builds 20/24/25/27/28.
- 2026-09-30 (Priya, revision 2 after Ruby FIX NEEDED, 4 must-fix; Manager defaults apply, Justin may overturn): Build 10 split into 10a (database + admin doc) and 10b (UI), number unchanged; Settings rows "Blocked users" and "Terms & community rules" kept; terms gate now also covers captions (Build 20); second-user QA = Justin's 2nd Google account (no Email provider, no agent-created accounts); `is_blocked_between` grants/claims corrected (M1); explicit revoke/grant for all tables and functions (M2); harness loaded via `require` under `__DEV__` and checked with `expo export` (M3); collection-entry report point owned by Build 25, caption terms gate by Build 20 (M4); owner tags per Done-means line; carry-forward pointers added to Builds 20/24/25/27/28. Build 23 follow-on-block question left open for Justin at Build 23.
- 2026-10-01 (Priya, at the Manager's request; Justin reordered: movies, Builds 12-16, come right after Build 10b, Build 11 moves to just before Build 20): detailed Module 4 — Builds 12 and 13 — in section 5, replacing the two rough one-liners. Build 12 is split into **12a** (data layer + first page of posters on Home + Roulette shell) and **12b** (infinite scroll + pull-to-refresh), number unchanged (Manager default, N2). New module-wide decisions M1-M10 (TMDB Popular grid; proxy hardening in 12a and a `details` endpoint in 13, with Edge Function work inside those Builds; `@tanstack/react-query` + `@shopify/flash-list` via `npx expo install`, no native rebuild expected; one QueryClient at the root; 8 s timeout, one retry, offline cold start ends in an error state; image sizes and 2:3 posters; navigation and a free `perchable://movie/<id>` deep link; attribution stays on Settings; Sentry from the QueryCache only). The UI-only shells already approved (Perch Roulette on Home, tier badge and `#spoiler-free-lounge` panel on details, DESIGN §5) ride inside 12a and 13 as before. **NEEDS JUSTIN (none blocks; defaults apply):** N1 Home shows one Popular grid, no Trending/Now Playing, no "Have You Watched This?"/"Friend Activity" until Builds 19/23; N2 the 12a/12b split; N3 the details content set (and what it leaves out); N4 no stored cache, offline cold start shows an error state; N5 3-column grid. Two small additions beyond Vision Part 2 are flagged as N6 (deep link) and N7 (adult titles hidden), defaults applying; no other feature added or removed. DESIGN question for Dianne (not a plan problem): §3 says the tab bar stays visible under `movie/`, but a root-level Stack route covers it.
- 2026-10-01 (Priya, Round 1 revision after Ruby FIX NEEDED on Module 4; no Build number or feature changed): (1) the api layer throws a typed `MovieApiError` (`kind`, `status`, `code`) so the retry tests run through the real mapping; (2) the proxy maps TMDB 401/403 to 502 `upstream_auth`, and M9 reports it (also for the details endpoint); (3) proxy logic moves to `supabase/functions/_shared/tmdb.ts`, covered by a dedicated tsc target (`supabase/functions/tsconfig.json`) and Jest, and the missing-key branch moved into it, so only the `Deno.serve`/fetch wiring is review-only; (4) pull-to-refresh mechanism named (`cancelQueries`, trim to page 1, `refetch`), `refetchOnMount: false` on Home, new lines C5b/C5c for pull during a next-page load and scroll during a refresh; (5) A2 reworded to what Jest can prove, with a Manager one-off abort proof; (6) `unstable_settings anchor "(tabs)"` for cold deep links; (7) `/^\d+$/` validation for `id` and `page`; (8) response validators with tests; (9) adult-filtered empty page cannot stall the list (C4b), 12a B1 reads "up to 20"; (10) failure lists: sign-out while loading, poster 404 with a set path, rotate dropped, back-mid-load abort and other-movie-data lines made owned Done-means (13 B7, B8); nits: native-code guard kept, attribution wording flagged for Rose, `Cache-Control` on `popular`, numeric details key, `getPopularMovies(page = 1, signal?)` stays call-compatible.
- 2026-10-01 (Priya, Round 2 touch-ups after Ruby's recheck of f7b0498; no Build or feature changed): 12b C5 snapshots and restores the list when a pull-refresh fails, with a Jest case; C4b's empty-page loop moves inside the `queryFn` (up to 3 TMDB pages, `getNextPageParam` from the real last page number); M5/M9 say a relay-error 502 without `code` is retried once and not reported, and that `upstream_auth` is also retried once; M2 specifies the functions tsc target (no `types: jest` if extended, `lib: ["ESNext"]`, tests import `_shared/tmdb` without `.ts`).
