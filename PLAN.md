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
(`ON DELETE CASCADE`)" — see each Build below. Modules 1–3 are detailed in
full; 4–12 are one-line-rough until the team
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

Detailed 2026-09-30 (Priya, at the Manager's request). Applies RESEARCH.md §6
(Play UGC policy: report on every UGC surface, in-app block, terms that
define objectionable content, moderation that is *active*).

**The problem this module has to solve.** No UGC surface exists yet —
comments, DMs, other users' profiles and captions arrive in Builds 20–27.
So Module 3 builds the *base*: tables, RLS, SQL helpers, and reusable
components/hooks with a fixed contract. The later surfaces plug into it
(see "Carry-forward rules" below). Nothing fake ships to users: every
harness below is `__DEV__`-only and is compiled out of the release APK.

**Where things live.** All client code in `src/modules/moderation/`
(`api/`, `components/`, `hooks/`, `types.ts`, `index.ts` — DESIGN.md §4;
routes stay thin, DESIGN.md §7). Reusable overlay sheets follow the
existing `DeleteAccountSheet` pattern (an in-screen overlay component, not
a route), so they also work over the future `user/[id]` formSheet.
`src/modules/moderation/README.md` is the module's how-to (started in
Build 10, extended in Build 11).

**Shared vocabulary (single source of truth).** One constant in the module,
`OBJECTIONABLE_CATEGORIES`, feeds both the Build 10 report-reason list and
the Build 11 terms text, so what the terms define and what users can report
never drift apart. Categories (Priya's derivation — RESEARCH.md §6 requires
the terms to "define what counts as objectionable content" but does not
enumerate them; Justin approves the wording at Build 11): `spam`,
`harassment` (harassment or bullying), `hate` (hate speech), `sexual`
(sexual content), `violence` (violence or threats), `impersonation`,
`other`.

```
Build 10 — Moderation schema + report/block UI   Module: Moderation base
Done means (checkable). Part A is the database, Part B the admin path,
  Part C the reusable UI; the seam between A+B and C is where this Build
  can be split if the Manager wants (see PLAN PROBLEM in the Manager
  report — this Build is over the "and more than twice" size rule).

  A. Database (migration reviewed + applied by the Manager; RLS proven in
     a rolled-back transaction — `supabase/tests/moderation_rls.sql`,
     pattern of `supabase/tests/profiles_rls.sql`)
  A1. `public.reports` exists: id (uuid pk), reporter_id (default
      auth.uid(), FK auth.users ON DELETE CASCADE), reported_user_id (the
      author/owner of the reported thing; FK auth.users ON DELETE CASCADE),
      target_type, target_id (uuid, no FK — polymorphic, and a report must
      outlive removal of the content it points at), reason, details
      (optional, max 500 chars), status, created_at, reviewed_at (null
      until reviewed).
  A2. target_type is text with a CHECK of: `profile`, `comment`,
      `dm_message`, `collection_item` (a caption lives on a collection
      entry). Text + CHECK, not a Postgres enum, so a later surface adds a
      value with one constraint change. reason is a CHECK of the seven
      categories above. `other` requires non-blank details (CHECK).
      status is a CHECK of `open` (default), `reviewed`, `actioned`,
      `dismissed`.
  A3. Enforced by the database, not the UI: no self-report (reporter_id <>
      reported_user_id); for target_type `profile`, target_id must equal
      reported_user_id; one report per reporter per target (UNIQUE
      reporter_id, target_type, target_id).
  A4. `reports` RLS: an authenticated user may INSERT only with reporter_id
      = their own uid, through column-limited grants (they cannot set
      status, reviewed_at or id). No client SELECT, UPDATE or DELETE at
      all — a reporter never sees any report, not even their own; only the
      SQL editor / service role reads or changes them. `anon` has no
      access. The tests prove each denial (spoofed reporter_id rejected,
      client SELECT denied, client UPDATE of status denied, anon denied).
  A5. `public.blocked_users` exists: blocker_id and blocked_id (both FK
      auth.users ON DELETE CASCADE), created_at; primary key
      (blocker_id, blocked_id), so a repeat block cannot duplicate; CHECK
      blocker_id <> blocked_id (no self-block).
  A6. `blocked_users` RLS: authenticated INSERT only with blocker_id = own
      uid; SELECT and DELETE only rows where blocker_id = own uid; no
      UPDATE. A blocked user therefore cannot list who blocked them, and
      one user cannot read another's block list. `anon` has no access.
  A7. Indexes: partial index on reports (created_at) WHERE status = 'open'
      (the admin queue); index on reports (reported_user_id); index on
      blocked_users (blocked_id) (reverse lookup for "blocked either way"
      and for the cascade). The unique constraints cover the rest.
  A8. SQL helper `public.is_blocked_between(a uuid, b uuid)` — true when
      either has blocked the other. SECURITY DEFINER with an empty
      search_path (as `handle_new_user`), EXECUTE for `authenticated` only,
      and it answers only when auth.uid() is one of the two arguments
      (otherwise false), so it cannot be used to probe other people's
      blocks. Later RLS policies call this instead of re-writing the
      subquery (RESEARCH.md §6).
  A9. Deleting an auth user removes every reports row they filed or that is
      about them, and every blocked_users row where they are either side
      (proven in the rolled-back test with a real `delete from auth.users`).
      No change to the `delete-account` Edge Function is needed.

  B. Admin path (Justin is the admin — RESEARCH.md §6: "a Supabase admin
     query is enough at this scale; no dedicated admin panel needed for v1")
  B1. `docs/ADMIN-MODERATION.md` exists, written for Justin, run in the
      Supabase SQL editor (which bypasses RLS). It contains, each as a
      copy-paste query with a one-line "what this does":
      (a) list open reports, oldest first, with the reporter's and the
          reported user's usertag/display name and the reason;
      (b) mark a report reviewed / actioned / dismissed (sets status and
          reviewed_at);
      (c) remove a user's profile content (clear avatar_url and usertag on
          `profiles`, and delete their `avatars/<uid>/` objects in
          Storage) — the only content type that exists in Build 10;
      (d) ban a user: set `auth.users.banned_until = 'infinity'` (a
          deleted user can simply sign up again with Google, as Build 9
          showed, so a ban must be a ban, not a delete), plus the matching
          unban; noting that an already-issued access token works until it
          expires (up to an hour);
      (e) a "remove reported content" section with a placeholder heading
          per future content type — comment, DM message, caption — each
          marked "query added by Build 25 / 27 / 20" (Carry-forward rule 5).
  B2. Bella runs (a)-(d) against the live project inside rolled-back
      transactions in Phase 2, so the doc holds no untested SQL; the
      Manager repeats (a) and (d) once. The ban is proven live through the
      backend only: the Manager creates a throwaway email-provider user via
      the Admin API (the Email provider is still on), bans it, confirms
      sign-in and token refresh are refused, unbans, and deletes it. No
      second Google account is needed.

  C. Reusable report/block UI (module exports; contract fixed here)
  C1. `ReportSheet` — bottom-sheet overlay, props:
      `{ target: { type: ReportTargetType; id: string; ownerId: string };
      onClose(): void; onReported?(): void }`. Shows the seven reasons as a
      single-select list; picking `other` reveals a details box (max 500
      chars; optional for the other reasons); Submit is disabled until a
      reason is chosen (and details are non-blank for `other`). On success
      it shows the sent confirmation, then closes. It refuses to open or
      submit when `ownerId` is the signed-in user (defence in depth; the DB
      also rejects it).
  C2. States, per DESIGN.md §2/§7: idle, submitting (Submit uses the
      `Button` loading convention, list disabled), sent, error (inline
      `ErrorCard` with retry; chosen reason and typed details are kept).
      Filing a report the user already filed for the same target (unique
      violation) shows the same sent confirmation — not an error, and the
      user learns nothing about existing reports.
  C3. `useBlockUser(userId)` + `BlockUserSheet` confirm overlay, props
      `{ userId: string; displayName?: string; onClose(): void;
      onBlocked?(): void }`. Confirm inserts the block; blocking someone
      already blocked is a silent success (idempotent); cancel and
      double-tap are safe; self-block is refused in the hook and by the DB.
  C4. `useBlockedUsers()` returns the caller's block list with each blocked
      user's display name, usertag and photo (a second read of `profiles`
      by id — the FK points at auth.users, so there is no embed), and
      `unblock(userId)`.
  C5. Blocked users screen, reachable from a new Settings row "Blocked
      users" (Account section): lists blocked users with an Unblock button
      each; all four DESIGN.md §2 states (loading, empty, error + retry,
      filled); unblock shows a row-level busy state and, on failure, keeps
      the row and shows an error. Route added to DESIGN.md §3 by Dianne in
      Phase 0 (as Build 7 added `edit.tsx`). **NEEDS JUSTIN
      (interpretation):** Settings has no such row today. It is the only
      way to undo a block and the only place a block can be checked
      on-device before Build 24; I read it as part of "block-a-user UI"
      (this Build's original text; RESEARCH.md §6 "in-app user blocking")
      rather than a new feature. If it is read as a feature add, the
      fallback is unblock in the dev harness only — which would ship a
      block with no way back, so I do not recommend it.
  C6. Dev harness — the only way to exercise C1-C4 on the emulator before
      Builds 24-27 create real surfaces. A `ModerationDevHarness` component
      in the module, rendered from `src/app/debug.tsx` (already reachable
      only through the `__DEV__`-gated link on Home) and returning null
      when `__DEV__` is false. It lists other profiles (readable under the
      existing profiles RLS), lets QA pick one, then buttons open
      `ReportSheet` for each target_type (a random uuid stands in for a
      comment/DM/caption id, since target_id has no FK) and
      `BlockUserSheet` for the picked user. It is not part of the product:
      Queenie tests on the dev build (Metro), and Ruby/Manager grep the
      release bundle for the harness's marker string and find nothing.
  C7. Nothing is wired to a product surface in this Build. The exported
      contract is what Builds 24 (profile), 25 (comments), 27 (DMs) and the
      future collection-entry view call. The module `README.md` documents
      the props, the reason list, the helper functions and the doc-update
      duty.
  C8. Deleting the account needs no client cleanup (A9). Sign-out clears
      the blocked-users cache (query keys tagged with the owner, as
      `useOwnProfile` does).

What Build 10 enforces now vs later. **Now:** the tables and their RLS; the
`is_blocked_between` helper; that nobody can read reports; that a block is
private to the blocker; no self-report or self-block; cascades. **Not now:**
anything that hides or rejects content because of a block — no comment, DM
or other-user surface exists to hide or reject. Deferred, by Build: 24 wires
Report/Block into the profile modal; 25 comments — hide a blocked user's
comments from the blocker and reject inserts when `is_blocked_between` is
true; 27 DMs — the same on messages and conversation lists; 28 DM block
enforcement as already planned (a blocked user cannot open or send in a
thread, in RLS). Build 23 (follow): whether blocking removes a follow is not
specified anywhere — flagged to the Manager, not decided here.

Test on: emulator (dev build; harness + Settings > Blocked users) plus
  `moderation_rls.sql` and Jest for the components/hooks
Needs from Justin: (1) once, open `docs/ADMIN-MODERATION.md`, confirm you
  can open the Supabase SQL editor for the project and run query (a)
  (Build 10, before Phase 4). (2) Nothing else — the Manager applies the
  migration; no new credentials (Credentials/perchable already holds the
  Supabase access token); QA needs two other profiles, which the Manager
  seeds via the Admin API (throwaway email-provider users, deleted after).
Failure modes to cover (Manager expands into the Build log):
  - Report: dismiss mid-submit (no state update after unmount, result not
    applied, no double row); offline / server error (sheet stays open,
    choices kept, retry works); double-tap Submit (one row); repeat report
    of the same target (shows sent, no error); `other` without details
    (blocked in UI and by the CHECK); 501-char details; report against
    self (refused in UI, rejected by DB).
  - Block: cancel; double-tap Confirm; already blocked (silent success);
    self-block; nonexistent user id (FK error -> error state, not a
    crash); leave the screen mid-unblock; unblock fails offline (row
    stays); blocked user has null name/photo (fallback initials + fallback
    name copy from DESIGN.md).
  - Signed-out / account switch: caches cleared; anon cannot read either
    table.
  - Sentry: unexpected failures only (not duplicates, validation, or user
    cancel); never send the details text as event data; environment tag.
  - Security: spoofed reporter_id / blocker_id rejected; `reports` and other
    users' blocks unreadable; helper returns false for pairs not involving
    the caller; migration touches only the new tables and functions (no
    `config.toml` push — app CLAUDE.md).
  - Cleanup: cascade proven live for both columns of each table.
  - Release build contains no harness code.
Phases: 0 Dianne mockup (ReportSheet all states; BlockUserSheet; Blocked
        users screen 4 states; the Settings row; "sent" copy) ·
        1 Bella build · 2 Bella gates (tsc, lint, jest, SQL tests,
        admin-doc queries) · 3 Queenie QA · 4 Ruby review · 5 Manager ships
```

```
Build 11 — UGC terms acceptance           Module: Moderation base
Done means (checkable):
  A. Database (migration reviewed + applied by the Manager;
     `supabase/tests/terms_gate_rls.sql`, rolled back)
  A1. `profiles.terms_accepted_at timestamptz` exists, null for every
      existing and new profile (Justin's and the emulator's included —
      everyone accepts once).
  A2. It is not client-writable. The existing column-limited update grant
      (display_name, avatar_url, usertag — Build 6) is left as is, and a
      test proves `update profiles set terms_accepted_at = now()` as an
      authenticated user is denied. Acceptance goes only through
      `public.accept_terms()`: SECURITY DEFINER, empty search_path, EXECUTE
      for `authenticated` only, sets the caller's own timestamp to now()
      only if it is currently null (a second call keeps the first
      timestamp), returns the timestamp.
  A3. `public.has_accepted_terms()` (SECURITY DEFINER, STABLE, empty
      search_path, `authenticated` only) is true when the caller's
      terms_accepted_at is not null. Every UGC INSERT policy calls it.
  A4. **The rule "INSERT rejected while terms_accepted_at is null" is
      proven now, on a stand-in.** The rolled-back test creates a temporary
      table carrying the exact policy shape later Builds must use
      (`WITH CHECK (public.has_accepted_terms() AND author_id = auth.uid()
      AND NOT public.is_blocked_between(...))`) and shows: insert rejected
      while null, allowed after `accept_terms()`, another user's acceptance
      does not count, and a null-terms user can still SELECT. Builds
      20/25/27 reuse this file as their template (Carry-forward rules).

  B. Terms screen and gate (client, `src/modules/moderation/`)
  B1. A terms screen with: a plain-language definition of objectionable
      content built from `OBJECTIONABLE_CATEGORIES` (same seven categories
      as the report reasons, rendered from the constant, not retyped); how
      to report and block; that reported content can be removed and
      accounts banned; who operates the app (Justin). Copy is written by
      Dianne in DESIGN.md (verbatim table) and **approved by Justin**
      (Needs from Justin). It is not legal advice; it is the Play-policy
      minimum (RESEARCH.md §6), and Justin may want a proper terms text
      before store submission.
  B2. States: not accepted (shows "I agree"), accepting (loading), accepted
      (no button; "Accepted on <date>"), error (inline error + retry;
      screen stays open). No "decline" control: leaving the screen means
      not accepted.
  B3. `useTermsGate()` exported from the module's `index.ts`:
      `{ accepted: boolean; isLoading: boolean; requireTerms(onAccepted):
      void }`. If accepted, `requireTerms` runs the callback immediately.
      If not, it opens the terms screen and runs the callback exactly once
      after a successful acceptance; if the user backs out, nothing runs.
      While the profile read is loading or has failed it fails closed
      (treated as not accepted, never as accepted).
  B4. Reachable now, for QA and for users: a Settings row "Terms &
      community rules" (Account section) opens the screen in view mode
      (accept button if not yet accepted, accepted date if accepted).
      **NEEDS JUSTIN (interpretation):** a row Justin did not list; needed
      because the objectionable-content definition must be readable at any
      time (RESEARCH.md §6) and it is the only non-fake place to reach the
      screen before Build 25. The `terms` route sits under the session
      guard in the root layout; Dianne adds it to DESIGN.md §3 in Phase 0.
  B5. The dev harness (Build 10, `__DEV__` only) gains a "Simulate first
      comment" button that calls `requireTerms`: with terms not accepted it
      opens the screen and, after acceptance, shows "action ran"; with
      terms accepted it runs at once. This proves the gate on the emulator
      before a real comment box exists.
  B6. After acceptance the timestamp is visible in `profiles` (Manager
      checks the row) and survives app restart; sign-out and a different
      account see their own state (query keys owner-tagged).

Test on: emulator (Settings row, terms screen, harness gate) plus
  `terms_gate_rls.sql` and Jest for the hook and screen
Needs from Justin: read the terms copy in Dianne's Phase 0 mockup and say
  OK or give changes (Build 11, before Phase 1). Nothing else.
Failure modes to cover (Manager expands):
  - Accept: offline / server error (screen stays, retry); double-tap "I
    agree" (one write; timestamp unchanged by a second call); leave the
    screen mid-accept (callback never runs twice; no state update after
    unmount); accept succeeds but the profile refetch fails (gate must not
    stay stuck, nor treat a failed read as accepted).
  - Gate: backing out runs nothing; called twice quickly; called while
    loading; profile row missing.
  - Security: client cannot set terms_accepted_at; another user's
    acceptance never counts; anon cannot call either function; the
    functions take no user-id argument (they always act on auth.uid()).
  - Sentry: only unexpected accept failures, environment tag, no user text.
  - Cleanup: none (column on `profiles`; cascade unchanged).
  - Carry-forward: the README checklist and the Build 20/25/27 pointers
    below exist before this Build is closed.
Phases: 0 Dianne mockup (terms screen 4 states + Settings row + copy) ·
        1 Bella build · 2 Bella gates (tsc, lint, jest, SQL test) ·
        3 Queenie QA · 4 Ruby review · 5 Manager ships
```

**Carry-forward rules for later Builds (so nothing in Module 3 can be
forgotten).** These are rules for Builds 20, 24, 25, 27, 28; the Manager
copies them into those Builds' failure lists and briefs. They add no
features.
1. Every table holding content another user can read (captions, comments,
   DM messages) gets an INSERT policy that calls
   `public.has_accepted_terms()`, and its Build's SQL test copies
   `terms_gate_rls.sql` and asserts the insert is rejected on the *real*
   table while `terms_accepted_at` is null. A migration without that test
   is a Ruby FIX NEEDED.
2. Comment and DM policies also call `public.is_blocked_between(...)`
   (Build 25 comments; Builds 27-28 DMs); their tests prove both
   directions of a block.
3. Every UGC surface exposes a report entry point that opens `ReportSheet`
   with the right `target` (24 profile; 25 comment; 27 DM message;
   collection entry/caption wherever another user's collection is shown),
   and Build 24 also wires the block action (`BlockUserSheet`).
4. Every UGC composer calls `useTermsGate().requireTerms` before its first
   submit.
5. Each such Build adds its own "remove this content" query to
   `docs/ADMIN-MODERATION.md`, tested in a rolled-back transaction.

### Modules 4–12 — rough (one line each, detailed when the team reaches them)

```
Build 12 — Home poster grid               Module: Movie browse/details
Done means: FlashList + expo-image poster grid, data fetched via TanStack
  Query against the Build-3 TMDB proxy (not raw useEffect).
Test on: emulator
```

```
Build 13 — Movie details screen           Module: Movie browse/details
Done means: tapping a poster opens a details screen (cast/rating/synopsis)
  fetched via TanStack Query against the TMDB proxy.
Test on: emulator
```

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
```

```
Build 25 — Comment on a watched movie     Module: Comments
Done means: user comments on another user's collection entry (requires
  terms acceptance, Build 11); deleting the account removes this module's
  rows (ON DELETE CASCADE).
Test on: emulator
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
```

```
Build 28 — DM block enforcement           Module: DMs
Done means: a blocked user cannot open/send in a DM thread with the
  blocker, enforced in RLS (not just hidden in the UI).
Test on: emulator
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
