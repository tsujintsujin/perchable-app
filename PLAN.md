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
(`ON DELETE CASCADE`)" — see each Build below. Modules 1–5 are detailed in
full (Module 4 on 2026-10-01, Module 5 on 2026-10-02); 6–12 are one-line-rough until the team
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

### Module 5 — Quick-add swipe (Builds 14, 15, 16a, 16b)

Detailed 2026-10-02 (Priya, at the Manager's request, after the Module 4
milestone, PR #8). Justin is away and said not to wait: every product choice he
might want to change is a **NEEDS JUSTIN** item with the default that applies
now (list below). Defaults marked "Manager default" are process or architecture
choices, not features.

**Owner tags (as Modules 3 and 4):** [Jest] Bella's Jest tests · [SQL] Bella's
rolled-back SQL test file, re-run by the Manager · [QA] Queenie on the emulator ·
[Mgr] the Manager reads or runs it · [Ruby] Ruby greps or reads the code.

**What Vision says (Part 2).** A "Quick add" area where the user swipes left or
right to add to their collection; the sequence is selectable, from most recent
to older or random; clicking the poster opens the movie's details page. The
collection is where a user later puts a caption on each watched movie (Module 7).
Read as: **swipe right adds to the collection, swipe left does not**; the
approved rough plan named three orders (recent, older, random).

**What exists today (checked in the repo 2026-10-02).**
- *Libraries.* `react-native-gesture-handler` ~2.32.0, `react-native-reanimated`
  4.5.1 and `react-native-worklets` 0.10.1 are in `package.json` since the
  Phase 0 template (git: commit 2cf9624, never changed), which is **before** the
  Build 1 dev build. The generated native package list of the installed dev
  client (`android/app/build/generated/autolinking/.../PackageList.java`) already
  contains `RNGestureHandlerPackage`, `ReanimatedPackage` and `WorkletsPackage`.
  **So no native rebuild is expected** (M5). But nothing in `src/`, `__tests__/`
  or `jest.setup.js` uses any of the three yet, there is **no
  `GestureHandlerRootView`** anywhere, and there is no `babel.config.js` (the
  Expo preset is expected to apply the worklets plugin; unproven until a worklet
  runs, Build 14 A1). `expo-haptics` is **not** installed. `@react-native-async-storage/async-storage`
  is installed and natively linked.
- *Proxy.* The `tmdb` Edge Function answers `popular` and `details` only
  (`supabase/functions/_shared/tmdb.ts`: pure logic, adult filter, error codes;
  `index.ts` is the thin Deno wrapper). No `discover` endpoint.
- *Movies module.* `getPopularMovies`, `getPopularPage` (the in-queryFn loop over
  adult-emptied pages), `getMovieDetails`, `usePopularMovies`, `useOpenMovie`
  (double-tap-safe push to `movie/[id]`), `tmdbImage` (sizes w342/w500/w780/w185),
  `MovieApiError` + typed retry/Sentry rules, `Movie` type
  (`id, title, poster_path, vote_average, release_date`; no overview).
- *Design.* DESIGN §3 already routes a root-level `quick-add.tsx` "pushed from
  Home, outside the tab bar (full-screen focus)"; §2 lists `SwipeDeckCard`
  (`movie`, `onSwipeLeft`, `onSwipeRight`; idle / dragging / exiting-left /
  exiting-right) and §1.5 says the top card is a flat fill (no `BlurView`, it
  re-renders every drag frame); §1 has a `danger` colour "skip-swipe icon" and
  `glow.purple` "active swipe card". §4 reserves `src/modules/quick-add/` (deck
  logic and state) and `src/modules/collection/` (collection api). **There is no
  Build 14 section in DESIGN yet and Home has no Quick Add entry** (Dianne's
  Phase 0 below).
- *Database.* Four migrations exist (profiles, avatars storage, moderation,
  profiles privileges). **No collection table.** `reports.target_type` already
  allows `collection_item`, and `reports.target_id` is a **uuid**, so a collection
  entry needs a uuid `id` of its own. There is no `has_accepted_terms()` yet
  (Build 11 runs just before Build 20). Migrations are applied by the Manager
  through the Management API after review; there is no migration history table.
- *Profile.* "0 movies watched" is a hard-coded string
  (`src/app/(tabs)/profile/index.tsx`).
- *Emulator.* td_emu has window/transition animations **off** (CLAUDE.md). That is
  very likely what Android reports as "reduce motion" (M4).

#### Module-wide decisions (M1–M11)

- **M1 Where the deck lives.** A root-level route `src/app/quick-add.tsx`, inside
  the **session-guarded group** of the root `_layout.tsx` (like `movie/[id]`),
  full-screen with **no tab bar** (DESIGN §3 already says so). Entry: a **Quick
  Add** row on Home between the Perch Roulette card and the section title, drawn
  by Dianne (a button-like card, not a new tab: the tab bar is fixed at five items
  by DESIGN §2). Perch Roulette stays a UI-only shell, unrelated to the deck.
  The route is a thin composition of the module's exports; no Supabase call and
  no fetching logic in the file. Header: back chip "Back" on the left (as
  details), title "Quick Add"; the **top-right 64x64 gear corner stays empty**
  (DESIGN §7), so the sequence picker (Build 15) goes below the header. The route
  opens through a double-tap-safe helper like `useOpenMovie`. Deep link
  `perchable://quick-add` is free from the scheme. **Flagged N1, N11.**
- **M2 Deck data source, paging, de-dup (answers "which list feeds it").**
  The deck reads **TMDB lists through the proxy, never anything else**, one
  infinite query per ordering, 20 movies a page, all through `getXPage` loops
  like Build 12b C4b.
  - Build 14: **Popular** (the existing `popular` endpoint) is the only source,
    because the ordering choice does not exist yet.
  - Build 15 adds **one** proxy endpoint, `endpoint=discover&sort=<s>&page=<n>`
    (TMDB `/discover/movie`), with a **whitelist** of `s`:
    `newest` (`sort_by=primary_release_date.desc`, `primary_release_date.lte=<today
    UTC>`, so unreleased titles never show), `oldest`
    (`primary_release_date.asc`), `popular` (`popularity.desc`, the pool for
    Random). All three add `include_adult=false` and `vote_count.gte=200`
    (otherwise a date sort starts with zero-vote obscurities, N10); the minimum
    is one named constant and the Manager looks at the first three live pages of
    each order before deploy and tunes it.
  - **Recent / older / random, concretely.** *Newest first* = release date
    descending from today, *Oldest first* = release date ascending, both paged
    1, 2, 3 up to TMDB's 500-page cap. *Random* has no TMDB endpoint, so it is
    made on the device: the pool is the `popular` order pages **1 to
    `RANDOM_POOL_PAGES`**, a constant = `min(100, total_pages)` where `total_pages`
    is the value the Manager **records per sort at the Build 15 live curl (A2)**
    (about 100 pages = the top 2,000 titles with 200+ votes). **Both shuffles are
    deterministic from the seed:** the page visiting order is a Fisher-Yates over
    the pool and each fetched page's 20 results are shuffled again, **both driven by
    a small seeded PRNG (mulberry32) fed with `(seed)` and `(seed, page)`**, never
    `Math.random()` inside the query function. A refetch of a page therefore returns
    the same order, so cached pages are never reordered or duplicated; a new
    session (new seed) gives a new order. A page past TMDB's last page that comes
    back empty is skipped by the loop.
  - **Paging and prefetch.** The raw pages are public TMDB data, so the query
    keys are not owner-tagged: `["movies","deck","newest"|"oldest"]` and
    `["movies","deck","random", seed]` (the seed is a number made when Random is
    chosen); defaults added to `queryClient.ts`: `staleTime` 30 min,
    `refetchOnMount: false`, **`refetchOnReconnect: false` and `refetchOnWindowFocus:
    false`** (TanStack's default for reconnect is true and `queryClient.ts` does not
    set it; a reconnect refetch of every loaded deck page is waste and, for Random,
    a reorder risk), no pull-to-refresh. The deck is a **pure function of
    (loaded pages, excluded ids)**, not an array with an index: `cards =
    flatten(pages, de-duplicated by id).filter(not excluded)`; the top card is
    `cards[0]`. So **undo and a rolled-back add put the card back on top by just
    leaving the excluded set**, in its original place. The next page is requested
    from the **swipe handler** (an event, never an effect: the standards check
    bans effect-based fetching) when 5 or fewer usable cards remain, one request
    in flight at a time. **A returning user must not be walled by pages
    they already swiped** (Newest/Oldest start at page 1; after 300 swipes the
    first 15 pages are all excluded). **Decision: a per-order "furthest page
    reached" cursor, stored next to the skips and reset with them (M3)**, *plus* a
    loop bound of **15 consecutive pages**, a **separate constant
    `DECK_MAX_PAGES_PER_LOAD = 15`; Home's shared `MAX_PAGES_PER_LOAD = 3` stays
    unchanged** (its tests are not touched; Build 14 checks that). Why both,
    and why the cursor is the pick: the cursor makes the common case (the same
    user, same device) start where they left off, in one request; the raised
    bound means the cursor is never a correctness dependency (reinstall, another
    device, Random, collection rows from elsewhere, a movie removed later), and
    15 sequential pages is a bounded wait (each call keeps the 8 s timeout).
    **Deck queries set `retry: 0`**: a TanStack retry would restart the whole loop
    from the first page. The error state's Retry (and the keep-going row) instead
    **resumes where the loop stopped**: as the loop passes an all-excluded page it
    advances the cursor to it (Newest/Oldest) or the Random shuffled-index ref, so
    the next attempt starts there. A
    bound alone was rejected: 5,000 skips could mean 250 pages of reading.
    The cursor for an order is the highest TMDB page of any card swiped in that
    order (updated from the swipe handler); Newest/Oldest start at
    **`max(1, cursor - 1)`** (one page back, because TMDB removals shift cards to an
    earlier page and that page still shows its unswiped cards). **A card that
    returns on a page before the cursor (a rolled-back add, Undo) lowers the cursor
    to that page**, so it can never be lost next session. **If the start page
    comes back empty and there is no next page, the deck retries once from page 1
    before it says "caught up".** Random keeps no cursor. After 3 all-excluded pages in one load the loading state shows a
    progress line, "Finding movies you haven't seen..." (Dianne's copy). The
    `queryFn` loop returns the first page with at least one id not excluded
    (reading the exclusions through a ref); 15 all-excluded pages with more to
    come end in the keep-going Retry row rather than a false end. **The first
    load shows the loading state until the first page, the saved skips and
    cursor (M3) and, from Build 16b, the collection ids are all ready**, so a
    skipped or collected movie never flashes; **if the collection-ids query
    fails the deck shows the error state with Retry (which retries both
    queries), never a deck that contains collected movies.**
  - **Excluded ids** = saved skips (M3) ∪ the user's collection (Build 16b) ∪ ids
    swiped right this session (Build 14 only: they are not stored yet, and the set
    is removed in 16b). **The session set lives in a module-level store in
    `quick-add` keyed by user id, so it outlives the screen** (leaving the deck and
    returning keeps those cards gone) and is **emptied by the same sign-out
    clean-up as M3** (LESSONS: state not reset on sign-out; tested in Build 14 A5).
  - Next two posters are prefetched with `expo-image`'s `prefetch` (w780, the new
    deck size constant) so a swipe never shows a blank card.
  - New TMDB endpoints are **server work: Bella writes the pure file change in
    its own commit and log entry, Ruby reviews it, the Manager deploys it and
    curls it; never Bella** (M6).
- **M3 What swipe-left means, and where that state lives (answers "skip forever
  or this session").** **Default: skip is remembered on this device, not on the
  server.** A skipped movie is not shown again by any ordering until the user
  taps **"Start over"** on the caught-up screen (clears the list). State lives in
  `src/modules/quick-add/` as a small store over AsyncStorage: one key per signed-in
  user (`quickAdd:skips:<userId>`), a JSON array of movie ids **capped at 5,000**
  (oldest dropped), plus the last chosen ordering (Build 15) in a second key. It
  holds nothing secret. **It never throws:** a read that fails or holds corrupt
  JSON is treated as empty, a write that fails is swallowed and the deck carries
  on in memory (LESSONS: storage adapters must never reject; a full device disk
  is not a bug to report). The stored cursor (M2) sits under a third per-user key. Cleanup, decided
  honestly: **every sign-out clears the skips, the cursor, the remembered order and
  the session set** (a small hook mounted in the root navigator, exported by the
  module, removes the departing user's keys when the session goes from a user to
  none; account deletion also ends there). Why this default: it leaves no orphan
  keys after an account is deleted (LESSONS "no orphans"), needs no coupling to the
  auth module to tell sign-out from deletion, and a shared phone keeps no taste
  data behind. The cost is that signing out starts the deck fresh; keying cleanup
  to deletion only was rejected because it cannot be done without that coupling.
  Keys are also per user, so another account never reads them. A server table was rejected for
  v1: more schema, RLS, cascade and a sync story for a state that only improves
  the browsing order. **Flagged N3.**
- **M4 Gesture contract (answers the numbers, buttons, haptics, reduce motion).**
  Built with `Gesture.Pan()` (gesture-handler) driving reanimated shared values,
  with the decision in a **pure function** `decideSwipe(translationX, velocityX,
  width)` (Jest). Starting values (Bella states the units gesture-handler reports in
  the log; Queenie judges feel, Manager may tune the constants, they are one file):
  - Pan activates after **10 dp** horizontal movement and **fails** on 20 dp
    vertical movement first, one pointer only, so a second finger or a vertical
    move never moves the card.
  - **Commit** when the card passed **35% of the screen width**, **or** the
    release speed is at least **800 dp/s in the direction of the translation**
    and the card moved at least **40 dp** (a short flick works; a tap with a
    twitch, or a finger reversing, does not). Otherwise a spring returns it.
  - While dragging: the card follows the finger, tilts up to 12 degrees by
    distance, and a "SKIP" (left, `danger`) or "ADD" (right, gold) stamp fades in
    with the distance; the card behind scales up from 0.95. Only **three** cards
    are mounted (top, next, one behind). On commit the card flies off in about
    200 ms and the next card moves up; the new top card is **interactive at once**,
    the leaving card animates in its own layer, and the same exit runs when a button
    is used.
  - **Tap on the card** (movement under the pan slop) opens details through the
    double-tap-safe push (Vision: clicking the poster opens details).
  - **Buttons, the accessible way** (TalkBack cannot swipe a custom pan): round
    Skip and Add buttons (56 dp) and an Undo button under the card, labelled
    "Skip {title}", "Add {title} to collection", "Undo"; the card also exposes
    **three** `accessibilityActions` (Skip, Add, "Open details") and is itself a
    labelled pressable ("{title}, {year}"), so details are reachable without a
    tap-vs-drag guess. After any swipe the result is announced
    ("Skipped {title}", "Added {title}") and screen-reader focus moves to the new
    top card. Buttons are disabled while a card is mid-exit, so a double-tap is one
    swipe. **A card that comes back while the user is dragging another** (Undo, a
    failed add rolling back) **is held and shown only on release**, after the drag
    commits or springs back (a ref mirrors the pan's active state; the held ids leave
    the excluded set then). It returns **on top** (it is earlier in the order, M2),
    appearing with a 200 ms fade and scale-in (instant with reduce motion);
    screen-reader focus moves to it and "{title} is back" is announced (Undo:
    "Undid {action} for {title}").
  - **Reduce motion.** The source is **React Native's
    `AccessibilityInfo.isReduceMotionEnabled()` plus its `reduceMotionChanged`
    listener**, in one module hook, **not** Reanimated's `useReducedMotion()`: that
    returns a constant read once at start-up (`useReducedMotion.ts`), so a setting
    changed while the app runs would be missed. Every animation passes
    `reduceMotion: ReduceMotion.Never` explicitly so Reanimated's own system rule
    does not second-guess the hook. The card still follows the finger (direct
    manipulation); with reduce motion on, no tilt, no fly-off, no scale on the card
    behind: the card fades out in 150 ms and the next appears; **a below-threshold release
    eases back in 150 ms (no spring overshoot)**. **The flag reaches the gesture worklets as a
    shared value** set from the hook's listener (never a closure over a render value, which
    would go stale mid-session); Bella's log says how. td_emu runs with
    animations off, which Android probably reports as reduce motion (Bella records
    what the hook returns there), so **QA tests both modes deliberately**: after
    **every** change of the animation scales QA **force-stops and relaunches the
    app** (so the start-up state matches what is being tested), sets them to 1 for
    the full-motion pass and restores them after (they are part of the emulator
    tuning).
  - **Haptics: none.** `expo-haptics` is not installed and would be a new native
    module (rebuild). **Flagged N6.**
  - Real-phone-only risk, said plainly in the log: with the phone's **gesture
    navigation**, a drag that starts at the very screen edge can trigger system Back
    (td_emu uses 3-button navigation). The card keeps a 24 dp side margin so normal
    drags start inside; only Justin can confirm on a phone (APK only when he asks).
- **M5 Libraries and native (answers "wired? rebuild?").** No new dependency.
  Gesture-handler, reanimated and worklets are linked in the installed dev client
  (see above), package versions unchanged since before Build 1, so **no rebuild
  is expected**. To prove it, Build 14 A1 runs a worklet round trip on the device
  (a shared value animated, the callback reaching JS); Reanimated also fails loudly
  on a JS/native version mismatch at startup. If the Expo preset does not apply the
  worklets plugin, the fix is JS-only: a `babel.config.js` with `babel-preset-expo`
  and the worklets plugin last, plus a Metro cache clear. **If a rebuild does turn
  out to be needed the Manager does it (short `GRADLE_USER_HOME`, app CLAUDE.md)
  and not while Queenie is on the emulator.** `GestureHandlerRootView` (flex 1) is
  added once in the root `_layout.tsx`, outermost, a JS-only change. The app runs
  with **React Compiler on** (`app.json`): shared values are read and written with
  `.get()` / `.set()` as Reanimated's React Compiler notes require (Bella checks the
  installed docs), and the callback to JS uses whichever of `runOnJS` /
  `scheduleOnRN` the installed worklets version provides.
- **M6 The proxy grows by one endpoint, `discover`, in Build 15 (rules as Module 4
  M2).** Logic in `_shared/tmdb.ts` (pure, no Deno globals, checked by
  `npx tsc --noEmit -p supabase/functions/tsconfig.json` and Jest importing it
  without the `.ts` suffix); today's date is an input (`today`) so Jest is
  deterministic, and `index.ts` supplies `new Date().toISOString().slice(0,10)`.
  `sort` is validated against the whitelist **before** TMDB is called (anything
  else, or absent: 400 `invalid_sort`), then `page` as today; adult results dropped;
  fixed-text `{ error, code }` bodies, the M2 status mapping (TMDB 401/403 to 502
  `upstream_auth`, etc.), no key, URL or `status_message` in any body or log;
  `Cache-Control: public, max-age=300`. Response shape identical to `popular`
  (so one validator, `parseMovieList`, serves both). The Manager deploys with
  `npx supabase functions deploy tmdb --use-api --project-ref <ref>` and nothing
  else touches the live project (app CLAUDE.md).
- **M7 The collection table (Build 16a).** `public.collection_items`:
  `id uuid primary key default gen_random_uuid()` (the uuid a report's `target_id`
  will point at when Build 25 reports a caption), `user_id uuid not null default
  auth.uid() references auth.users(id) on delete cascade`, `movie_id integer not
  null check (movie_id between 1 and 2147483647)` (same range as the proxy),
  `caption text null check (caption is null or char_length(caption) <= 500)`
  (**the column exists now so Build 20 needs no schema change to the table shape;
  nothing can write it yet**), `added_at timestamptz not null default now()`,
  **`unique (user_id, movie_id)`** (no duplicate adds, enforced by the database),
  index `(user_id, added_at desc)` (Build 19's list). **No title, poster or date is
  stored** (N8): a client-supplied title would be text other users later see with
  no terms gate; the movie data always comes from TMDB through the proxy.
  Build 19 owns how titles are loaded for a list (a batch proxy endpoint or
  per-id details). Grants and RLS: `revoke all on public.collection_items from
  anon, authenticated` first (LESSONS: this project's default privileges hand
  both roles TRUNCATE/REFERENCES/TRIGGER), then `grant select, delete` and `grant
  insert (movie_id)` to `authenticated` **only**: `user_id`, `id`, `added_at`
  fill from defaults, **`caption` is not insertable and there is no UPDATE grant
  at all**, so no content path exists that could bypass the terms gate. Policies:
  SELECT `user_id = auth.uid()`; INSERT `with check (user_id = auth.uid())`;
  DELETE `using (user_id = auth.uid())`. **Reads are own-only in this Module.**
  *Carry-forward (written into the migration comment and checked by Ruby):* when
  Builds 19/24/25 let other users read a collection, the SELECT policy must also
  call `public.is_blocked_between(...)` and respect the comments/visibility
  decision; when Build 20 adds caption writing, it adds a column-level `UPDATE
  (caption)` grant and a policy that calls `public.has_accepted_terms()` (Module 3
  rules 1–5; the SQL test copies `supabase/tests/terms_gate_rls.sql`). Adding a
  movie is not user-generated content, so **Build 16 needs no terms gate**.
  Account deletion: `on delete cascade` from `auth.users`; the `delete-account`
  Edge Function is unchanged (it already deletes the auth user), as Build 10a did.
  Moderation: nothing in this table is UGC until Build 20, so `docs/ADMIN-MODERATION.md`
  is unchanged (Build 20 adds the caption-removal query, rule 5).
- **M8 Add semantics (Build 16b).** Swipe right (or the Add button) **inserts one
  row with `movie_id` only** through `src/modules/collection/`, **optimistically**:
  the card leaves at once and its id enters the collection-ids cache; on failure the
  id leaves it again (the card returns on top, M2) with an error `Toast` ("Couldn't
  add {title}. Check your connection."). The call passes through `authReady()` and
  uses an abort at `REQUEST_TIMEOUT_MS` (8 s); there is **no retry** (the user can
  swipe again; a blind retry could duplicate a tap). A duplicate (Postgres 23505,
  e.g. the same movie added on another device) is a **silent success**, like the
  report sheet's 23505 rule. **Undo** (one step, session only) returns the last
  swiped card: for a skip it removes the id from the saved skips; for an add it
  **deletes the row** (`delete ... where movie_id = $1`, RLS scopes it to the
  caller) and, if that fails, the add stays and an error `Toast` says "Couldn't undo.
  Check your connection." (Undo stays available). **Per-movie operations are
  serialised:** an Undo pressed while that movie's add is still in flight waits for
  it to settle, then deletes; if the add failed there is nothing to delete and the
  card simply returns. **Offline swipe-right is not queued** (a persistent
  offline write queue is new infrastructure); it fails as above (N7). The deck's
  exclusion list and the Profile count come from one query, `getCollectionMovieIds`,
  **paged in 1,000-row ranges until a short page, with an explicit stable order,
  `order by added_at desc, id`** (`id` is unique, so ties on `added_at` cannot
  reorder between requests; without an ORDER BY a `range()` read can skip or repeat
  rows). The Supabase API returns at most 1,000 rows per request by default; a single
  call would silently truncate and show collected movies again. Query key owner-tagged `["collection","ids",
  userId]` (user state, as `useOwnProfile`).
- **M9 Sentry (Module 4's M9 rule, applied to the new calls).** TMDB `discover`
  failures go through the same QueryCache `onError` rule (reported: 500
  `misconfigured`, 502 `upstream_auth`, `shape`, anything unexpected; not reported:
  offline, timeout, 502 `upstream_network`, a relay 502 with no code, 4xx, 429).
  Collection calls are mutations, so the hook reports (once per failed call,
  `environment` tag, never a user-typed value; none exist here): an RLS or grant
  denial (42501), an unexpected 4xx/5xx from the API, an unexpected body shape.
  **Not reported:** offline, timeout, `RequestTimeoutError`, 23505, the session
  ending mid-request (sign-out while saving: no error, no state after unmount).
  Storage failures in the skip store are not reported (M3).
- **M10 Where code lives (DESIGN §4).** `src/modules/quick-add/` (Perchable-specific):
  `hooks/` (`useQuickAddDeck(sequence)`), `components/` (`SwipeDeck`, picker, states),
  `skipMemory.ts` (M3 store + the sign-out clean-up hook), `decideSwipe.ts`,
  `index.ts`. `src/ui/SwipeDeckCard/` (the card, DESIGN §2). `src/modules/movies/`
  gains `getDiscoverMovies`, `parseMovieList`, `IMAGE_SIZE.deck` (`w780`).
  `src/modules/collection/` (new): `api/` (`addToCollection`, `removeFromCollection`,
  `getCollectionMovieIds`), `hooks/` (`useCollectionIds`, `useAddToCollection`,
  `useRemoveFromCollection`), `types.ts`, `index.ts`, `README.md`. `quick-add` uses
  `movies` and `collection` **only through their `index.ts`**; `collection` knows
  nothing about swiping. `src/lib/database.types.ts` is regenerated by the Manager
  after 16a is applied. New api functions are added to the `authReady()` gate list in
  `__tests__/requestTimeout-test.ts` (the parameterised test).
  Dianne updates **DESIGN §4's `quick-add/` folder line** (it lists only `api/
  components/ hooks/ types.ts index.ts`; this plan adds `skipMemory.ts`,
  `decideSwipe.ts`, the cursor and the sign-out hook) in her Phase 0.
- **M11 Dianne's one Phase 0 for the whole Module** (done once before Build 14;
  Builds 15, 16a, 16b skip Phase 0): the Home **Quick Add entry**, the deck screen
  (header, card, stack depth, buttons, Undo), the **mid-drag states** (stamps,
  tilt, the card behind), exit, loading, error, caught-up with "Start over", the
  sequence picker (Build 15), the **Toast copy** (right-swipe coming-soon in 14;
  add-failed in **two variants**: network/timeout "Couldn't add {title}. Check your
  connection." and non-network (42501, 5xx, bad shape) "Couldn't add {title}. Try
  again later."; undo-failed likewise; "Finding movies you haven't seen...";
  "{title} is back"), a **Toast offset that does not cover the buttons**
  (Build 13's lesson: a first offset hid other text), the **Profile "N movies
  watched" states** (Build 16b), the reduce-motion variant, and the copy table. She
  updates DESIGN §3 (Home entry line, quick-add route detail) and §4 (`SwipeDeckCard`
  props) and the Dev-client gear-zone check. The Manager renders and looks (CLAUDE.md
  Rendering) before Bella starts.

#### NEEDS JUSTIN (none blocks; each default applies until he answers)

- **N1 Where Quick Add lives.** Default: a **Quick Add row on Home** opening a
  full-screen deck (no tab bar); not a new tab (the tab bar stays at five items).
  Vision says only "a Quick add area".
- **N2 The three orders.** Default: **Newest first**, **Oldest first**, **Random**
  (the approved rough plan's "recent / older / random"). Vision's wording ("from most
  recent to older or random") could mean only two; "Oldest first" is the one that
  can be dropped. First-time default order: Newest first. The last choice is
  remembered on this device (M3).
- **N3 What swipe-left does.** Default: the movie is **skipped and not shown again**
  by any order until "Start over" on the caught-up screen; remembered **on this
  device only** (not synced; a reinstall starts fresh), **cleared on every sign-out**
  and capped at 5,000 (oldest dropped). Alternatives: clear only on account deletion
  (needs coupling to the auth module), or skip only for this session (the same
  movies come back every visit).
- **N4 Swipe-right before the collection exists (Build 14 only).** Default: the card
  leaves and a "coming soon" Toast says nothing was saved, then Build 16b makes it
  real. Honest placeholder, same pattern as Perch Roulette; Build 14 is not shown as
  a finished feature, the Module's milestone is Build 16b.
- **N5 What a card shows and the controls.** Default: poster, title, year, TMDB
  rating; no synopsis or genres on the card (the proxy's list shape has no
  overview); tapping opens details. Controls: Skip, Add, and a **one-step Undo**
  button (covers a mis-swipe, both directions). Undo is not in Vision.
- **N6 Haptics.** Default: **none.** `expo-haptics` is a new native module; adding
  it means a dev-build rebuild and a new dependency.
- **N7 Offline swipe-right.** Default: it **does not queue**; the card returns with
  an error Toast. A persistent offline write queue is a feature of its own.
- **N8 What a collection row stores.** Manager default (architecture): movie id,
  who, when, and the caption column only; **no title/poster snapshot** (it would be
  untrusted text other users later see). Cost: Build 19 must load titles from TMDB
  for the list (a batch endpoint); rankings count ids.
- **N9 Profile count becomes real.** Default: in 16b the Profile's hard-coded "0
  movies watched" becomes the real count (otherwise a profile saying 0 after adds
  looks broken). It is the on-screen proof that an add stuck, before Build 19's list
  exists. Number comes from the collection ids query (M8).
- **N10 Deck quality filter.** Default: adult titles excluded (as Module 4 N7) and
  **200+ TMDB votes** so a date-sorted deck does not open on unknown titles; no
  further content filtering (the open item from Module 4 about suggestive but
  not adult-flagged posters stays as it was).
- **N11 Deep link.** Default: `perchable://quick-add` works (free from the scheme).
  Small addition beyond Vision; he can ask to drop it.
- **N12 Build 16 split.** Manager default (process): **16a** database only (no UI,
  like 10a) and **16b** the app wiring. Number 16 unchanged; the milestone is 16b.

```
Build 14 — Swipe deck                         Module: Quick-add swipe
   (Popular is the only source here; no server work, no database, no native
   rebuild expected. Right swipe is a labelled placeholder until 16b, N4.)
Done means (checkable):

  A. Wiring and data (mostly invisible; proven by tests and one device check)
  A1. [Mgr] Libraries are alive in the installed dev client: `npx expo install
      --check` is clean; on td_emu a throwaway worklet check (not committed) shows a
      shared value animating and a callback reaching JS, with no Reanimated
      version-mismatch error at start-up. Result recorded in the Build log, with
      "rebuild needed: yes/no" (expected no, M5). If the worklets plugin is missing,
      the JS-only `babel.config.js` fix of M5 applies.
  A2. [Ruby] `GestureHandlerRootView` (flex 1) wraps the app once, outermost, in
      the root `_layout.tsx`; `quick-add` is inside the session-guarded group; no
      other root view is added.
  A3. [Jest] `decideSwipe`: below 35% of the width and slow -> none; just above
      35% -> left/right by sign; short fast flick (>= 40 dp and >= 800 dp/s in the
      direction of the move) -> commits; a fast twitch under 40 dp -> none; velocity
      opposite to the translation -> none; exactly on each boundary; zero width does
      not divide by zero.
  A4. [Jest] Deck hook (**Popular only in this Build, so no cursor and no remembered order:
      both arrive in Build 15**; separate query key
      `["movies","deck","popular"]` so Home's pull-to-refresh never touches it; the deck keys have
      `refetchOnReconnect: false` and `refetchOnWindowFocus: false`, asserted): the
      deck is the de-duplicated flatten minus excluded ids; the top card is the first
      usable one; excluding an id and then un-excluding it brings the card back in its
      original place (this is how Undo works); the next page is requested from the
      swipe handler when 5 or fewer usable cards remain, one request in flight at a
      time (rapid swipes make one request); the in-queryFn loop, when a page is entirely excluded, keeps reading
      (`DECK_MAX_PAGES_PER_LOAD = 15`; **12 consecutive all-excluded pages on first load return a
      usable card with no Retry**, the progress line shows after 3; the deck queries have
      `retry: 0`, and a Retry resumes where the loop stopped; **Home's `MAX_PAGES_PER_LOAD = 3`
      and its tests are unchanged**, a [Ruby] grep and the untouched Home tests show it);
      "caught up" appears only when there is no next page; a failed next page keeps the cards and shows the keep-going Retry only
      when none are left.
  A5. [Jest] Skip memory (M3): writes per-user keys; the cap drops the oldest at 5,000;
      a read failure and corrupt JSON both give an empty list and never throw; a write
      failure is swallowed (deck still works); the sign-out hook
      removes the departing user's skips **and session-swiped set** (Build 15 adds the cursor and
      remembered order to the same clean-up and its test) when the session goes from a user to none, and not at first render; another
      user's key is never read; the session set survives leaving and re-entering the screen.

  B. Screen and gesture
  B1. [QA] Home shows the Quick Add entry (Dianne's board); tapping it opens the deck
      full-screen with the back chip and no tab bar; double-tap opens one deck (one
      Back returns to Home, Home's list and position unchanged); the gear corner is
      empty.
  B2. [QA] The deck shows the top card (poster, title, year, rating) with the next card
      peeking behind it, Skip and Add buttons and Undo, all at least 48 dp.
  B3. [QA] **Mid-gesture, not just end state** (Rule Zero): Queenie holds a drag with
      `adb shell input motionevent DOWN/MOVE` (Android 12+; td_emu is Android 15) and
      screenshots at about 15% (no stamp yet, card follows), about 40% (tilted card, the
      "SKIP" or "ADD" stamp visible, the card behind larger), then releases: below the
      threshold the card springs back to the centre (screenshot after), above it flies
      off and the next card is on top. A fast `input swipe` with at least 150 ms duration
      commits by velocity. (A 1 ms injected swipe is an adb artifact, Build 13 Bug 2; it
      is noted, not a finding.)
  B4. [QA] Left swipe: the card is gone and **the same movie does not come back** in
      this session; after force-stopping and reopening the app it is still not in the
      deck (device memory, M3). Right swipe: the card is gone, the coming-soon Toast
      "Adding to your collection is coming soon." (N4) shows, nothing is stored.
  B5. [QA] The Skip and Add buttons give the same result and the same exit as the
      swipes; tapping a button twice quickly is one swipe (disabled during the exit).
  B6. [QA] Undo: after a swipe, Undo returns that card on top (and for a skip removes
      it from the saved skips: force-stop and reopen shows it again); Undo is disabled
      when there is nothing to undo, and after one Undo it is disabled until the next
      swipe.
  B7. [Jest] + [QA] Tap vs drag: a tap on the card opens details (one push, double-tap
      safe); a drag past the slop is never a tap; Back from details returns to the same
      card.
  B8. [Jest] + [QA] Four states (DESIGN §2/§7), copy verbatim from Dianne's table:
      loading (card-shaped shimmer, buttons disabled, one polite live-region label),
      error (`EmptyState` with Retry; Retry is one request on a double-tap), caught up
      (`EmptyState` with "Start over", which clears the saved skips and reloads), filled.
  B9. [Jest] + [Mgr] Accessibility: the buttons' labels are "Skip {title}", "Add {title}
      to collection", "Undo"; the card exposes the same two custom actions **plus "Open details"** and is a labelled
      pressable; after a swipe the announcement fires and focus moves to the new top card;
      **a card returned by Undo while another is being dragged is held until release, then
      appears on top with "{title} is back" announced and focus on it (a Jest case with a
      held drag)**; every control at least 48 dp. [QA] tries TalkBack on td_emu; if the screen reader cannot be enabled there,
      the line is **UNTESTABLE on device** and Justin checks by hand (listed in his
      hand-check list, as Build 13's heading check).
  B10. [Jest] + [QA] Reduce motion read from `AccessibilityInfo.isReduceMotionEnabled` and its
       change listener (a Jest case flips it at run time and the next swipe follows it; not
       Reanimated's start-up constant); every animation sets `reduceMotion` explicitly. On: no
       tilt, no fly-off, no scale, a 150 ms fade, a 150 ms ease-back on a below-threshold release,
       still one swipe per action; off: full motion. **Jest: flipping the flag at run time changes
       the next release (the shared value, not a stale closure).** QA tests both, **force-stopping
       and relaunching after each animation-scale change**, and restores the scales after; **once,
       QA also changes the scale without relaunching and records whether the
       `reduceMotionChanged` event fires and whether the next swipe follows it** (information for the
       log, not a pass/fail).
  B11. [QA] The next two posters are prefetched (a fast five-swipe run shows no blank card);
       a poster with no path or that fails to load shows the fallback icon plus the title on
       the card, and the card is still swipeable.
  B12. [Ruby] Standards greps on the diff: tokens only (no literal colours, sizes, spacing),
       no `BlurView` in the card (flat fill, DESIGN §1.5), at most three cards mounted, no
       Supabase call or fetching logic in the route, no effect-based fetching, shared values
       through `.get()` / `.set()`, header top spacing from insets, gear corner empty,
       1–2 line purpose comment per block, no `console.log`.
  B13. [Mgr] After Dianne's Phase 0: DESIGN §3 and §4 updated (M11); Jest also covers the
       stamp, tilt and stack states by driving the gesture with gesture-handler's Jest
       utilities where they can, and says plainly in the log which states only the emulator
       proves.

Test on: emulator (`td_emu`; `scripts/emulator.sh ensure` first, closed after, per CLAUDE.md;
  no jest or Gradle run overlaps Queenie).
Needs from Justin: nothing. (N1, N3-N6 are defaults he may overturn.) By hand, when he asks
  for a build on a phone: the real-finger feel and the edge-swipe/gesture-navigation check (M4).
Failure modes to cover (Manager expands into the log):
  - Gesture: a drag started on the card then the finger leaves the screen; a second finger
    mid-drag; a vertical move; an app switch or a system gesture mid-drag (the card returns,
    no stuck stamp); a swipe during the previous card's exit; ten swipes in under three
    seconds; rotation is locked (portrait-only, `app.json`); font scale at maximum (card text
    wraps, buttons stay on screen).
  - Network: offline cold start (loading, then error with Retry, within about 20 s per
    Module 4's M5); offline mid-deck (cards already loaded keep swiping, posters not cached
    show the fallback); timeout; 5xx; 429; empty first page; wrong body shape (error state,
    one Sentry event); sign-out while loading (no error, no Sentry, no state after unmount).
  - Data: movie without `poster_path` or `release_date` (no "NaN", year omitted); very long
    title (two lines, ellipsis); emoji or right-to-left title; the same movie on two pages
    (shown once); every card on a page already skipped (loop reads on); the 5,000 cap.
  - Interaction: double-tap Home entry; Back mid-exit; leave the deck and return (cards
    already swiped stay gone); Undo with an empty history; Retry double-tap.
  - Security: the key never appears (bundle, logcat, errors); nothing is stored on the
    server; the per-user storage key holds only movie ids.
  - Cleanup: the saved skips are per user, removed on sign-out and account deletion (A5);
    the image cache is expo-image's.
  - Sentry: M9 only, once per failed query, `environment` tag.
Phases: 0 Dianne mockup (the whole Module's boards, M11) · 1 Bella build · 2 Bella gates
        (tsc, lint, jest, `npx tsc --noEmit -p supabase/functions/tsconfig.json` unchanged) ·
        3 Queenie QA · 4 Ruby review · 5 Manager ships
```

```
Build 15 — Selectable swipe sequence          Module: Quick-add swipe
Done means (checkable):

  A. Server and data layer (own commit and log entry; Bella writes it, Ruby reviews it
     before deploy, **the Manager deploys it**)
  A1. [Jest] + [Mgr] The proxy gains `endpoint=discover&sort=<newest|oldest|popular>&page=<n>`
      exactly as M6/M2: `sort` outside the whitelist or absent -> 400 `invalid_sort` before
      TMDB is called; `page` digits-only 1-500 as today; the three TMDB calls carry
      `include_adult=false`, `vote_count.gte=200` and the sort/date parameters of M2
      (`newest` has `primary_release_date.lte=<today>`, with `today` an input so Jest is
      deterministic); adult results dropped; the same response shape and attribution as
      `popular`; `Cache-Control: public, max-age=300`; the M2 status mapping with a case each
      (401/403 -> 502 `upstream_auth`, 404, 429, 5xx, network, missing key -> 500
      `misconfigured`); log redaction removes the key; unknown `endpoint` still 400; `popular`
      and `details` unchanged (their tests still pass).
  A2. [Mgr] After Ruby's pre-deploy review the Manager deploys `tmdb` and curls it live:
      each sort returns at most 20 results with the exact attribution and the cache header;
      `newest` page 1 has release dates at or before today and non-increasing across pages 1
      and 2; `oldest` is non-decreasing; `popular` is plausible; `sort=foo`, no sort,
      `page=abc`, `page=1e2`, `page=501` all 400; no auth header 401; no `api_key` anywhere.
      The Manager records each sort's `total_pages` in the log; **Bella's default is
      `RANDOM_POOL_PAGES = 100`, and the Manager sets it to `min(100, popular total_pages)` in a
      one-line commit after the live curl, before QA**. The Manager also reads the first three pages
      of each order and, if junk dominates, tunes the vote minimum (one constant) and
      redeploys before QA.
  A3. [Jest] `getDiscoverMovies(sort, page, signal)` and `parseMovieList` (the shared
      validator; `parsePopular` keeps its name and behaviour): `timeout: REQUEST_TIMEOUT_MS`,
      the query's signal, typed `MovieApiError`, `shape` on a bad body; added to the
      `authReady()` gate list in `requestTimeout-test.ts`.

  B. Deck sequences (the same deck hook with a sequence parameter, no second deck)
  B1. [Jest] Page order: `newest` and `oldest` read pages 1, 2, 3...; `random` reads the
      shuffled order of pages 1-100 (shuffle injectable for the test) with each page's
      results shuffled, **both from a seeded PRNG of `(seed)` and `(seed, page)`** (the same
      seed and page always give the same order, so a refetch never reorders or duplicates, and
      a different seed gives a different order; `Math.random` is not called in the query
      function); no page repeats; a page past TMDB's last page that is empty is skipped by the
      loop; the Random seed is in the query key.
  B1b. [Jest] **Cursor and remembered order (moved here from Build 14; M2/M3):** the per-order
      cursor is the highest page of any swiped card, stored per user and capped per order; Newest/
      Oldest start at `max(1, cursor - 1)`; a card returned by Undo (or a rolled-back add in 16b)
      on a page before the cursor **lowers the cursor to that page** (a rollback test: swipe a
      page-3 card, advance to page 5, roll the add back, reopen: the deck starts at page 3 and the
      card is there); an empty start page with no next page retries once from page 1 before
      "caught up"; the remembered order is stored per user, a corrupt value gives the default,
      and the sign-out hook removes the cursor and the remembered order too.
  B2. [Jest] Switching order: the old order's cards leave the deck, saved skips and the
      collection still apply in every order, an in-flight request of the old order is aborted
      and its late result ignored (a deferred stub: switch, then resolve the old page; the deck
      shows only the new order, no duplicate id).
  B3. [QA] A picker under the header (Dianne's board, **not** in the top-right corner): three
      options "Newest first", "Oldest first", "Random", single-select, selected state visible
      and announced as a radio (name, selected, position), at least 48 dp; first use selects
      Newest first; the last choice is remembered on this device per user (M3; a corrupt value
      falls back to the default).
  B4. [QA] Newest: over at least 20 cards the visible years are never increasing (evidence:
      the year list); Oldest: never decreasing; Random: two separate openings of Random give
      different first ten titles, and over at least 40 swipes no title repeats. Evidence is the
      lists, not an end-state count.
  B5. [QA] Crossing a page boundary (the 21st to 30th card) shows no blank gap and no repeat;
      switching orders mid-deck shows the loading state of the card shape, then the new order;
      Random on an exhausted pool shows caught up.
  B6. [Ruby] The server diff: whitelist before use, no echo, `today` injected, no Deno global in
      the pure file, the functions tsc target passes; the app diff: standards as Build 14 B12; the
      sequence is a parameter of the one hook, not a copy of it, and **Build 14's
      `["movies","deck","popular"]` source is deleted** (grep: no reference to the old key or
      its fetch path remains; no dead code).

Test on: emulator.
Needs from Justin: nothing. (N2 and N10 are defaults he may overturn.)
Failure modes to cover (Manager expands into the log):
  - Network: offline when switching order (error state with Retry, the current cards are not
    lost); timeout; 5xx; 429; empty page; wrong shape (one Sentry event).
  - Data: a page that comes back empty after the adult filter; `release_date` missing on a
    card in Newest (no "NaN"); the same id in two orders (excluded once swiped in either);
    TMDB's 500-page cap reached.
  - Interaction: switch order twice quickly (one result, no stale cards); switch mid-swipe;
    leave and return (same order remembered); Random re-entered gives a new shuffle.
  - Security: `sort` validated server-side and the client sends only the three values; no key in
    the bundle (the `expo export` key grep as Build 12a B8); 400/404 bodies echo nothing.
  - Cleanup: none beyond M3.
  - Sentry: M9 only.
Phases: 0 skip (the Module's Phase 0 board already draws the picker) · 1 Bella build (Edge Function
        change in its own commit + log entry) · 2 Bella gates (tsc, lint, jest, the functions tsc
        target, `expo export` key grep) · [Ruby pre-deploy check of the function file, then Manager
        deploys `tmdb` and curls it] · 3 Queenie QA · 4 Ruby review · 5 Manager ships
```

```
Build 16a — Collection table (database only)  Module: Quick-add swipe
   (first half of Build 16; Manager default, N12. Number 16 unchanged; own log, own
   Phases; no UI, no Phase 0, no emulator flow. Pattern: Build 10a.)
Done means (checkable; migration reviewed and applied by the Manager through the
  Management API, RLS proven in rolled-back transactions in
  `supabase/tests/collection_rls.sql`, run with `supabase/tests/run-sql.mjs`):

  A. Database (M7)
  A1. [SQL] `public.collection_items` exists with the columns and checks of M7: uuid `id`,
      `user_id` (default `auth.uid()`, FK `auth.users` ON DELETE CASCADE), `movie_id` integer
      CHECK 1..2147483647, nullable `caption` CHECK <= 500 characters, `added_at` default now().
  A2. [SQL] **No duplicate adds, enforced by the database:** `unique (user_id, movie_id)`; a
      second insert of the same movie by the same user fails with 23505; **two different users
      may add the same movie**; the same user may re-add after deleting.
  A3. [SQL] Grants asserted with `has_table_privilege` / column privileges, not assumed:
      `anon` has none; `authenticated` has SELECT and DELETE, INSERT **only on `movie_id`**,
      **no UPDATE, no TRUNCATE, no REFERENCES, no TRIGGER**; `caption`, `user_id`, `id` and
      `added_at` are not insertable (a client insert that names them is denied).
  A4. [SQL] RLS: a user sees and deletes only their own rows; an insert with another user's
      `user_id` is rejected; a user cannot read, count or delete another user's rows; `anon`
      is denied; a client `update` of any column is denied (no UPDATE grant), so no content path
      reaches `caption` before Build 20.
  A5. [SQL] Out-of-range or non-integer ids fail the CHECK (0, -1, 2147483648); a 501-character
      caption would fail the CHECK (proved with a privileged insert in the rolled-back test).
  A6. [SQL] Deleting an auth user (a real `delete from auth.users` in the test) removes every
      `collection_items` row of theirs and none of anyone else's. No change to the
      `delete-account` Edge Function.
  A7. [Mgr] reads the migration: one new table, its index `(user_id, added_at desc)`, the grants,
      policies and the carry-forward comment of M7 (own-only reads; Build 19/24/25 must add
      `is_blocked_between`; Build 20 adds the `UPDATE (caption)` grant plus
      `has_accepted_terms()`); it touches nothing else and does not push `config.toml` (app
      CLAUDE.md). [Ruby] confirms the comment is there.
  A8. [Mgr] After applying: the table, RLS flag and privileges are read back from the live
      project; `src/lib/database.types.ts` is regenerated and typechecks; Justin's profile row
      and every earlier table are unchanged. File name follows the existing pattern
      (`20261002000000_collection_items.sql`).

Test on: SQL tests against the live project, rolled back; nothing on the emulator.
Needs from Justin: nothing.
Failure modes to cover (Manager expands into the log):
  - Security: spoofed `user_id`; client SELECT/UPDATE/DELETE of another user's rows; anon;
    insert naming `caption` or `added_at`; default TRUNCATE/REFERENCES/TRIGGER privileges (revoked
    first, 10a Bug 2); a grant to `authenticated` wider than M7.
  - Data: duplicate add; out-of-range id; the cascade on user deletion for this table only.
  - Cleanup: every test runs inside a transaction that is rolled back; nothing is left in the live
    table.
  - Carry-forward: no SELECT-by-others policy exists yet (asserted: a second user sees zero rows).
Phases: 1 Bella build (migration + tests; Phase 0 skipped, no UI) · 2 Bella gates (tsc, lint, jest,
        SQL tests) · 3 Queenie QA (SQL results reviewed; nothing on device) · 4 Ruby review ·
        5 Manager ships (applies the migration, regenerates types)
```

```
Build 16b — Swipe-right adds to the collection  Module: Quick-add swipe
   (second half of Build 16; after 16a is applied. Replaces Build 14's placeholder toast.
   Own log, own Phases 1-5; Phase 0 is covered by the Module's board.)
Done means (checkable):

  A. Collection client (`src/modules/collection/`, M8/M10)
  A1. [Jest] `addToCollection(movieId, signal?)` inserts one row with `movie_id` only, **without**
      `.select()`; `authReady()` first; abort at 8 s; Postgres 23505 resolves as a silent
      "already there" success; other failures throw a typed `CollectionApiError` (`kind`:
      `timeout`, `network`, `http` with `code`, `shape`); no retry. `removeFromCollection(movieId)`
      deletes by `movie_id` (RLS scopes it to the caller); same error rules.
  A2. [Jest] `getCollectionMovieIds()` reads in 1,000-row ranges until a short page, **passing `order by added_at desc, id`
      on every request (the test asserts both order calls and the range bounds)**: a stub with
      2,500 rows returns all 2,500 ids and makes three requests; a failed page rejects (never a
      half list that looks complete); an empty collection returns an empty list.
  A3. [Jest] `useCollectionIds` is owner-tagged (`["collection","ids",userId]`): signing out and in as
      another user never shows the first user's ids; the add hook updates the cache **optimistically**,
      restores the previous list on failure, and a late result after sign-out sets no state.
  A4. [Jest] Sentry per M9: 42501, an unexpected 5xx/4xx and a `shape` error are reported once with the
      `environment` tag; offline, timeout, 23505 and a sign-out in flight are not.

  B. Deck wiring (the one deck hook gains the collection as an exclusion source)
  B1. [QA] Swipe right and the Add button: the card leaves at once, and the **movie is in the
      collection**: the Manager reads the row back by SQL for the signed-in account (movie id matches
      the card's) and the Profile count (C1) went up by one.
  B2. [QA] A movie that was added never appears again in Newest, Oldest or Random, on this and on a
      later session (force-stop and reopen), because the exclusion set contains it.
  B3. [Jest] Swipe right twice on the same movie (a double commit) makes **one** request; two
      different movies in quick succession make two; the second never waits on the first.
  B4. [Jest] + [QA] Offline or a failed add: the card **returns to the top of the deck** (it leaves the
      excluded set, M2) with the error Toast ("Couldn't add {title}. Check your connection." for offline/timeout,
      "Couldn't add {title}. Try again later." for 42501, 5xx or a bad shape: Jest tests both
      variants); **if the user is mid-drag on another card the returned card is held until
      release (Build 14 B9 rule), appears on top, "{title} is back" is announced and focus
      moves to it (a Jest case)**; no row
      exists; swiping it again after the network is back adds it. Several quick swipes where only
      the first fails: only that card returns, in its place in the order. (Offline is shown by
      turning the emulator's wifi and data off; no app code detects it, the request fails.)
  B5. [Jest] + [QA] Undo after an add **deletes the row** and returns the card; Undo while that add is
      still in flight waits for it, then deletes; if the add failed there is nothing to delete and the
      card simply returns; if the delete fails the add stays, the error Toast "Couldn't undo. Check your
      connection." shows and Undo remains available. After a skip, Undo behaves as in Build 14.
  B6. [QA] The same movie already in the collection (added earlier or on another device, Postgres
      23505) is not shown by the deck, and if it is added anyway (stale deck) it is a silent success with
      no error Toast.
  B7. [QA] Sign-out while an add is in flight: no error screen, no Toast, no Sentry event, and nothing
      remains for the next user (Jest: no state after unmount; owner-tagged keys).
  B8. [Jest] + [QA] **First-load gate:** the deck stays in its loading state until the collection ids
      have loaded; if that query fails (offline or error) the deck shows the error state with Retry
      (retrying both queries) and **never a deck containing collected movies** (a Jest case with a
      deferred and a rejecting ids stub; QA: wifi off, cold start, then back on and Retry).

  C. Visible proof and the rest
  C1. [Jest] + [QA] The Profile "N movies watched" shows the **real count** (the length of the ids
      list, N9) with its own loading and error handling per Dianne's amendment: while loading the
      count text is a shimmer bar, on error it shows a dash and no number, never a false 0; the
      existing profile states are otherwise unchanged (regression of Builds 6-9).
  C2. [Ruby] Standards as Build 14 B12; `collection` has no import from `quick-add` or `movies`; the
      Build 14 right-swipe placeholder and its Toast copy are removed (grep); no `.select()` on the
      insert; no table other than `collection_items` is touched; the Build 31 end-to-end checklist
      gets a line "collection_items rows, plus device-local `quickAdd:*` keys".
  C3. [Mgr] After QA the Manager deletes by SQL the collection rows QA created (ids recorded in the
      log) so Justin's real collection starts empty; the Module's milestone is checked: add on a
      device, row in the database, count on Profile.

Test on: emulator (offline checks by turning wifi/data off; the 2,500-row case is Jest-only).
Needs from Justin: nothing. (N7, N8, N9 are defaults he may overturn.) By hand when he has a phone
  build: edge-swipe/gesture navigation (M4).
Failure modes to cover (Manager expands into the log):
  - Network: offline; timeout (8 s, no retry); 5xx; 429; response of an unexpected shape; the app
    backgrounded mid-request; sign-out while saving.
  - Data: id outside 1..2147483647 never sent; movie already in the collection (23505); 1,000+ items
    (paged read); the same movie added from the deck and from a later Build (excluded everywhere).
  - Interaction: double-tap Add; swipe then Undo at once (serialised); Undo twice (second is
    disabled); leave the deck mid-add (the add completes, no state after unmount).
  - Security: a client cannot write `user_id` or `caption` (16a tests); the insert names `movie_id`
    only; no title text is stored or sent; RLS denial reported, not swallowed.
  - Cleanup: rows cascade on account deletion (16a A6); QA's rows removed (C3); the deck's device keys
    removed on sign-out (Build 14 A5).
  - Sentry: M9 only; once per failed call, `environment` tag.
  - Moderation: none yet (own-only data, no UGC); the carry-forward of M7 is the guard for Builds 19,
    20, 24 and 25.
Phases: 0 skip (the Module's Phase 0 board covers the add feedback and Profile count states) ·
        1 Bella build · 2 Bella gates (tsc, lint, jest) · 3 Queenie QA · 4 Ruby review ·
        5 Manager ships (closes the Module: PR, merge, pull `main`)
```

**Server and database work in this Module, in order:** (1) Build 15: the `discover`
endpoint in `_shared/tmdb.ts` (own commit) -> Ruby pre-deploy review -> Manager deploys
`tmdb` and curls it -> QA. (2) Build 16a: the `collection_items` migration + SQL tests ->
Ruby review -> Manager applies it through the Management API -> types regenerated ->
16b starts. Build 14 and 16b have none. **No native rebuild is expected** (M5).

**Module 5 risks.** (a) Real-phone gesture feel and edge-swipe/Back conflicts cannot be
judged on td_emu; they are Justin's hand checks when he asks for an APK. (b) The
emulator's animations are off, so reduce motion is probably "on" by default there; both
modes need a deliberate test. (c) Reanimated with React Compiler on: shared-value reads in
render are a known trap (M5). (d) TMDB `discover` quality (obscure or odd titles in a date
sort): the vote minimum is one constant and the Manager looks live before deploy. (e) A
junk-id flood by a hostile client in `collection_items` would distort Build 29's "most
added" and, **once Build 24 shows the public "movies watched" count, inflate that number**,
until it filters or caps; there is no per-user cap or movie-exists check in v1 (accepted
risk, own-only data until then).
(f) Build 14 on its own ships a placeholder right swipe; nothing merges to `main`
before the Module milestone (16b), so users never see it.

### Modules 6–12 — rough (one line each, detailed when the team reaches them)

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
- 2026-10-02 (Priya, at the Manager's request; Justin away, nothing waits on him): detailed Module 5 — Quick-add swipe — in section 5, replacing the three rough one-liners for Builds 14-16. Build numbers and order unchanged; **Build 16 is split into 16a (database only: `collection_items`) and 16b (app wiring)**, Manager default N12, milestone stays Build 16 (now 16b). Build 14 = deck, gestures, buttons, Undo, skip memory (Popular source, no server or database work); Build 15 = selectable order, with one new proxy endpoint `discover` (Manager deploys); right swipe in Build 14 is an honest coming-soon placeholder until 16b. Checked in the repo: gesture-handler, reanimated and worklets are already linked in the installed dev client (installed before Build 1), so **no native rebuild is expected**; what is missing is `GestureHandlerRootView` (added in Build 14) and a worklet-runs proof (A1). **NEEDS JUSTIN (none blocks; defaults apply):** N1 Quick Add is a Home row opening a full-screen deck, not a new tab; N2 three orders (Newest/Oldest/Random; "Oldest" is the droppable one); N3 swipe-left = skipped for good on this device until "Start over"; N4 interim right-swipe placeholder; N5 card content + one-step Undo (Undo is beyond Vision); N6 no haptics (new native module); N7 no offline queue for adds; N8 collection rows store movie id only (architecture default); N9 Profile count becomes real in 16b; N10 200+ votes and no adult titles in the deck; N11 deep link `perchable://quick-add`; N12 the 16a/16b split. Added Dianne's single Phase 0 for the whole Module (M11). No feature removed.
- 2026-10-02 (Priya, round 2 after Ruby's 11 findings on Module 5, confirmed by the Manager; no Build or feature changed): (1) returning-user wall: per-order furthest-page cursor stored with the skips plus a loop bound of 15 (Jest: 12 all-excluded pages, no Retry); (2) `getCollectionMovieIds` uses `order by added_at desc, id`; (3) the deck waits for the collection ids and shows the error state on their failure; (4) cards returning mid-drag are held until release, return on top with an announcement and focus; (5) reduce motion from `AccessibilityInfo` + listener, explicit `reduceMotion`, relaunch after scale changes; (6) deck keys set `refetchOnReconnect: false`, Random shuffles seeded by (seed, page); (7) session-swiped set is a module-level store, cleared on sign-out and tested; (8) N3/M3 say plainly: cleared on every sign-out, capped at 5,000; (9) Random pool = min(100, recorded total_pages), Build 15 deletes the Build 14 popular source; (10) "Open details" accessibility action; (11) Dianne updates DESIGN §4 and the two failed-add Toast variants; junk-id count inflation named as accepted risk.
- 2026-10-02 (Priya, round 3 after Ruby's re-review, 5 small gaps; no Build or feature changed): (1) cursor starts at `max(1, cursor - 1)`, is lowered when a card returns on an earlier page, and an empty start page retries once from page 1 before "caught up" (rollback test in Build 15 B1b); (2) Build 14 has Popular only: cursor and remembered-order tests moved to Build 15, A4's loop sentence fixed; (3) `DECK_MAX_PAGES_PER_LOAD = 15` is separate from Home's `MAX_PAGES_PER_LOAD = 3` (unchanged), deck queries `retry: 0` and Retry resumes where the loop stopped; (4) `RANDOM_POOL_PAGES` defaults to 100, the Manager sets it after the live curl in a one-line commit; (5) reduce-motion spring-back becomes a 150 ms ease, the flag reaches worklets as a shared value (Jest), QA records whether `reduceMotionChanged` fires without a relaunch.
