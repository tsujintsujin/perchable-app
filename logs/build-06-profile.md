# Build 6 — Profile created on first sign-in (Module: Auth/Profile)

- Base SHA: 66973ae (Manager's brief) — HEAD had moved to e45606d (Build 5
  QA close) by the time Bella started Build 6; no Build-6 work landed
  between those two commits.
- Branch: module/auth
- Done means (PLAN.md): first sign-in auto-creates a `profiles` row (id,
  google name, default avatar, empty usertag); visiting "My Profile" shows
  that data.

## Phase log
- Phase 0 — Dianne mockup, done before this session (board "Build 6 — My
  Profile", `design-src/build-06-my-profile.dc.html`).
- Phase 1 (migration) — done first, held for Manager review per the Build 6
  brief's sequencing (Queenie was using the working tree/emulator).
- Phase 1 (app code) + Phase 2 (gates) — done after Queenie finished; see
  below.

## Migration — supabase/migrations/20260926000000_profiles.sql

Written by Bella, **not applied**. The Manager reviewed and applied it with
3 edits (also included in this commit, per the Manager's instruction):
1. The `update` grant is column-limited to `display_name, avatar_url,
   usertag` — `id`/`created_at`/`updated_at` are never client-writable, even
   on the user's own row (Bella's original just granted `update` on the
   whole row).
2. `set_profiles_updated_at` is no longer `security definer` (Bella's
   original had it as one; the Manager judged it didn't need elevated
   privileges since it only writes the row already being updated under the
   caller's own RLS-checked UPDATE).
3. `execute` on `handle_new_user()` is explicitly revoked from
   `public, anon, authenticated` — it's a trigger-only function, never meant
   to be callable directly by API roles.

`public.profiles`: `id uuid PK references auth.users(id) ON DELETE CASCADE`
(Build 9's cascade requirement), `display_name`, `avatar_url`, `usertag text
unique` nullable with a `CHECK` (`^[a-z][a-z0-9_]{2,19}$`), `created_at`,
`updated_at`. RLS: any authenticated user can `select` (profiles are public
within the app — later modules show one user's profile to another); a user
can only `update` their own row; no insert/delete policy for any client role
(creation is the trigger's job, deletion is the `ON DELETE CASCADE`). A
`before update` trigger keeps `updated_at` current. An `after insert on
auth.users` trigger (`security definer`, `set search_path = ''`) creates the
profile row from `raw_user_meta_data`, checking both `full_name`/`name` and
`avatar_url`/`picture` since Google's metadata keys differ by sign-in flow;
`usertag` is left null. A backfill `insert...select...where p.id is null`
covers any `auth.users` row that predates the migration (Justin's account,
created during Build 5 QA).

The Manager also tested trigger + RLS + cascade in a rolled-back transaction
— script at `supabase/tests/profiles_rls.sql` (not written by Bella, included
in this commit per the Manager's instruction). All 12 checks passed as
intended: trigger creates rows with correctly-mapped metadata; any
authenticated user can read any profile; a user can update only their own
row; the usertag format CHECK rejects a bad value; `created_at` is not
client-writable; direct client `insert`/`delete` are both rejected; `anon`
can't select; a duplicate usertag is rejected; deleting the `auth.users` row
cascades to `profiles`.

## What was built

**`src/modules/profile/`** (reusable module per DESIGN.md §4): `api/getOwnProfile.ts`
reads the signed-in user's row (`select id, display_name, avatar_url,
usertag, created_at, updated_at ... eq('id', userId).single()`, camelCased on
the way out). `hooks/useOwnProfile.ts` is a plain `useState`/`useEffect` hook
— same shape as `useAuthSession` — exposing `{ state: 'loading'|'loaded'|'error',
..., refetch }`. `index.ts` exports both plus the `Profile` type.

**`src/app/(tabs)/profile/index.tsx`** — the My Profile screen, all three
states from DESIGN.md's Build 6 spec:
- Loading: a local shimmer (circle + 2 bars + 2 rows, opacity pulse via
  `Animated`) in the loaded layout's exact shape.
- Loaded: header ("My Profile" + inset Settings icon chip), `Avatar size="lg"
  ringGradient`, display name, usertag chip (either `@usertag` or the
  tappable "No usertag yet — **add a usertag**" empty state, both pushing
  `/profile/edit`), two `GlassCard` rows ("✏️ Edit profile" / "⚙ Settings"),
  and the `0 movies watched` caption + an empty placeholder container — no
  real grid (Collection module is Module 3+, out of scope here; the
  container just keeps the screen from looking bare per the spec).
- Load-error: `EmptyState` with the exact copy + a Retry button wired to
  `refetch`.

**`src/app/(tabs)/profile/edit.tsx`** and **`settings.tsx`** — simple
"Coming soon" placeholder screens, not disabled taps. Bella's call per the
Build 6 brief ("your call, log it"): a real destination beats a disabled
row, since DESIGN.md §7's rules explicitly say UI-only elements must never
be a silent no-op — a placeholder screen with a plain-English "which Build
this lands in" note reads better than a dead tap or a toast for something
that's clearly coming (not a deferred feature decision like Perch Roulette).

**Shared components built for this Build** (none existed yet — Build 6 is
the first screen to need them): `ui/Avatar` (loaded photo or
gradient-fill fallback-initials, `sm`/`md`/`lg`, optional `ringGradient`),
`ui/GlassCard` (`card`/`hero`/`chip` tiers, optional real `BlurView`, press
scale), `ui/EmptyState` (icon/title/body/optional action — used here for
Build 6's error state), `ui/TabBar` (see below).

**`(tabs)/_layout.tsx` — `TabBar` lands**: replaced the bare `<Tabs>` with a
custom `tabBar` render prop using the new `ui/TabBar`. DESIGN.md §2 specs a
fixed 5-item bar (Perch/Search/Chat/Leaderboards/Profile); only 2 routes
exist as of this Build, so only those 2 render — Build 5's log already
flagged this as the deferred decision, and Build 6 (second tab, Profile) is
where it lands. `TabBar`'s icon/label map gets one more entry each time a
later Build adds a tab.

**Home chip moved (DESIGN.md §7 "Home screen fix")**: Build 5's "Signed in
✓" text chip sat inside the reserved 64×64 dev-client gear corner. Replaced
with a small (`sm`, ~32px) `Avatar` — Google photo or fallback-initials from
the session's own `user_metadata` (no extra Supabase call; the profile
fetch is per-screen, not global) — inset left of the corner, tappable
through to the Profile tab.

**`expo-blur` installed** — referenced throughout DESIGN.md §1.4/§1.5 but
never actually added as a dependency before now; Build 6 is the first Build
to use real `BlurView` (`GlassCard`, `TabBar`). Required a native rebuild
(new native module) even though the rest of this Build is JS-only.

## Why this way

**Plain hook, not TanStack Query, for `useOwnProfile`:** PLAN.md's stack
decision names TanStack Query, but only requires it starting at Build 12
("fetched via TanStack Query ... not raw `useEffect`"). Wiring the query
client now (provider, cache config) is new infra this Build doesn't need —
matches the existing `useAuthSession` precedent exactly. Revisit at Build 12
if profile fetching should move onto the same client then.

⚠️ Big decision: **Android blur isn't actually wired to real content yet.**
`expo-blur`'s Android support needs a `BlurTargetView` wrapped around
whatever's behind the `BlurView`, with its ref passed to `blurTarget`
(confirmed against Expo's current docs, not memory — this is new in
SDK 55+). `ui/TabBar` blurs the active tab screen's content, which isn't
reachable from a custom `tabBar` render prop without forking the
navigator's internal layout — out of scope for what "one component" can
fix. Set `blurMethod="dimezisBlurViewSdk31Plus"` on both `GlassCard` and
`TabBar` regardless (matches DESIGN.md §1.5 exactly) and left a
`blurTarget`-shaped gap: Android currently renders `glass.nav`'s flat
`rgba` fill behind the bar (visually correct per §1.5's own flat-fallback
palette, just not blurred), iOS gets the real blur. No Build 6 screen
passes `GlassCard`'s `blur` prop as `true` (the profile screen's rows/chip
use flat fills per the spec's literal `rgba(...)` values, not blur), so
this only affects `TabBar` right now. Flagged with a `ponytail:`-style
comment in both files naming the upgrade path (a screen-level
`BlurTargetView` wired through `(tabs)/_layout.tsx`).

**Stub `edit.tsx`/`settings.tsx` over disabled rows:** see "What was built"
above — matches DESIGN.md §7's "never a silent no-op" rule more literally
than a disabled tap would.

## PLAN PROBLEM (flagged, not fixed)

DESIGN.md §7's rules list says TMDB attribution "must render on every build
that includes the TMDB proxy (Build 3 onward)" and names
`(tabs)/profile/settings.tsx` as where it lives. But PLAN.md scopes the real
Settings screen (and therefore the attribution) to Build 9. That gap has
existed since Build 3 — this Build didn't create it, and building out real
Settings content inside what the Build 6 brief scoped as a stub isn't Bella's
call to make unilaterally. Flagging for the Manager/Priya: either move the
attribution requirement earlier (its own tiny Build, or folded into this
stub) or correct §7's "Build 3 onward" wording to say "Build 9 onward."

## Gates
- `npx tsc --noEmit` — pass (after regenerating `.expo/types/router.d.ts` by
  starting Metro briefly — typed routes for the new `/profile`,
  `/profile/edit`, `/profile/settings` paths didn't exist until Metro had
  run once against the new route files).
- `npx expo lint` — pass (one real finding fixed: `useOwnProfile` was
  calling `setState` synchronously at the top of its effect —
  `react-hooks/set-state-in-effect` — moved the "reset to loading" call into
  `refetch`'s event-handler body instead, where it's not a cascading-render
  risk).
- `npx jest` — pass, 3 suites / 9 tests, zero warnings:
  - `home-test.tsx` (updated): mocks `useAuthSession`, checks the Avatar
    (not the old text chip) + placeholder render.
  - `profile-test.tsx` (new): mocks `useOwnProfile` directly, covers
    loading/loaded (with and without a usertag)/error states, and that
    Retry calls `refetch`.
  - `sign-in-test.tsx`: unchanged, still passing.

## package.json changes
- `expo-blur` (new, native module — see below).
- `expo-linear-gradient` was already added in Build 5 for the (removed)
  Home chip's avatar-ring gradient; `ui/Avatar`'s `ringGradient` now uses it
  too — no new dependency there.
No other dependency changes this Build.

## On-device check
**Native rebuild required**: `expo-blur` is a native module, not JS-only,
so the APK from Build 5 didn't have it. Ran
`GRADLE_USER_HOME="C:/g/perchable" SENTRY_DISABLE_AUTO_UPLOAD=true npx expo
run:android --no-bundler` — `BUILD SUCCESSFUL`, installed on `emulator-5554`
— then started Metro (`--dev-client`) separately.

App was already signed in as Justin — did **not** clear app data or sign
out at any point. Host machine's Wi-Fi IP had changed since Build 5's
session (`.102` → `.100`, DHCP renewal) — cost some time chasing a stale
`ConnectException` on the old cached dev-client URL before catching it;
recorded here in case it recurs.

**Real bug found and fixed on-device, not just by reading code:** the first
reload showed **4 flat top-level tabs** ("Perch", "profile/index",
"profile/edit", "profile/settings") on React Navigation's **default** tab
bar — not `ui/TabBar`, and not one nested "Profile" tab. Expo Router's
`<Tabs>` treats every file directly under a folder as its own flat tab
unless that folder has its own `_layout.tsx`; `profile/` didn't have one.
Added `src/app/(tabs)/profile/_layout.tsx` (a plain `<Stack>`, same pattern
as `(auth)/_layout.tsx`) — reran all three gates (still green) and reloaded:
now exactly 2 tabs ("Perch", "Profile") on the real custom `ui/TabBar`, gold
active-state on the current tab.

**Verified against Justin's real data** (`logs/evidence/build-06/`):
- `home.png` — signed-in Avatar (Justin's actual Google photo) correctly
  inset left of the reserved gear corner, not overlapping the dev-client
  gear icon; only 2 tabs in the bar.
- `profile-loaded.png` — My Profile loaded state with Justin's real
  `profiles` row: his Google photo (ring gradient), "Justin Masiga", the
  empty-usertag chip ("No usertag yet — **add a usertag**"), both rows,
  "0 movies watched" + the empty grid placeholder. Confirms the migration's
  trigger/backfill + RLS select policy work end-to-end, not just in the
  Manager's rolled-back SQL test.
- `edit-stub.png` — tapping "Edit profile" pushes the stub screen; `TabBar`
  stays visible and "Profile" stays highlighted (the push is inside the
  nested Stack, confirming the `_layout.tsx` fix nests correctly, not just
  that it compiles). Back navigation returned cleanly to the loaded profile
  screen. The Settings row uses the identical `GlassCard`/`router.push`
  pattern to its own stub — not separately screenshotted, since a second
  identical code path adds no new evidence.
- Confirmed the documented Android blur-fallback gap (Build 6's "Why this
  way" section) live, not just in theory: logcat showed
  `WARN You have selected the "dimezisBlurViewSdk31Plus" blur method, but
  the blurTarget prop has not been configured. The blur view will fallback
  to "none"` for both `GlassCard` and `TabBar` — exactly the documented
  behavior, no crash.

Metro stopped after (its own 600s safety timeout had already ended it by
the time I went to stop it manually); port 8081 confirmed free both via
`Get-NetTCPConnection` (nothing listening) and a raw TCP connect attempt.
