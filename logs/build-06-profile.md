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

## QA (Queenie)

Tested on emulator-5554 (td_emu). APK confirmed current: lastUpdateTime
(2026-09-25 22:03:58 GMT, device clock) predates commit 79c761e's timestamp,
but that is expected and not a staleness signal - the native rebuild
(expo-blur) happened once during Bella's session and JS since then is served
live by Metro (dev-client, JS not embedded), so only the native module
addition needed reinstalling. Confirmed expo-blur is actually present and
working empirically rather than trusting the log: BlurView renders without
any native-module crash, and logcat shows expo-blur's own runtime warning
(blurTarget not configured -> falls back to "none"), which only fires from
inside expo-blur's own code - proof the native module loaded correctly.
Evidence: logs/evidence/build-06/qa/ (screenshots 00-31, ui-*.xml dumps,
logcat-app-full.txt).

Own Metro started fresh (npx expo start --dev-client), stopped at end;
confirmed port 8081 free (killed only this session's own node.exe PID 7196,
verified via Get-CimInstance CommandLine match before killing). Did not clear
app data at any point in the final state - app is left signed in as Justin,
on the Profile tab, per instruction.

### 1. Profile tab shows Justin's Google name + photo + "No usertag yet" state
PASS. `00-launch.png`, `31-final-profile.png`. Real Google photo (not
fallback-initials - Google returned a photo), "Justin Masiga" verbatim,
"No usertag yet — add a usertag" chip verbatim with the bold "add a usertag"
part as its own tap target (confirmed separately, see item 3).

### 2. Loading state + load-error state (airplane mode) + Retry
PASS, all three sub-states confirmed on-device:
- Loading shimmer: forced a fresh mount after Retry (airplane mode had just
  been disabled) and caught the shimmer mid-transition - circle + 2 bars +
  2 row placeholders, exact shape of the loaded layout. `15-retry-result.png`.
- Load-error: force-stopped + relaunched the app while offline (airplane
  mode) to force a genuinely fresh Profile mount (tab screens stay mounted
  across tab switches, so simply switching tabs while offline does not
  reproduce this - confirmed via `ui-home2.xml` dump). Error state rendered
  correctly: owl icon, "Couldn't load your profile", "Check your connection
  and try again.", gold "Retry" button - copy verbatim per DESIGN.md.
  `14-profile-error-state.png`.
- Retry: re-enabled network, tapped Retry -> shimmer -> loaded state with
  Justin's real data. `16-retry-loaded.png`.

### 3. Edit profile / Settings stub navigation + back
PASS, all four entry points tested:
- "Edit profile" row -> stub "Coming soon / Editing your photo and
  usertag lands in Build 7." Back returns cleanly to loaded profile.
  `17-edit-stub.png`, `18-back-from-edit.png`.
- "No usertag yet — add a usertag" bold tap target -> same Edit stub.
  `23-usertag-tap.png`.
- "Settings" row -> distinct stub "Coming soon / Sign out, delete account,
  and app info land in Build 9." `20-settings-stub-correct.png`.
- Header gear icon (top-right, inset) -> same Settings stub, confirming the
  "two entry points, same screen" spec. `21-header-gear-tap.png`. Back
  returns cleanly. `22-back-to-profile.png`.
- Note: I initially mis-tapped the Edit profile row when aiming for Settings
  (stale coordinates from an earlier UI dump, layout differs by pixel offset)
  and briefly thought both rows led to the same stub - re-verified with a
  fresh uiautomator dump and confirmed they are in fact two distinct stub
  screens with distinct copy. Not a bug, my own mis-tap.

### 4. Tab bar - 2 tabs, active colors, vs. DESIGN.md spec
BUG. 2 tabs confirmed (Perch, Profile), active tab gold label vs inactive
grey - that part matches spec. But the tab bar's own background is wrong:
measured by pixel sampling (PIL) at four points across the bar on both Home
and Profile screens: rgb(105,103,108) consistently - a flat, fairly light
neutral grey. DESIGN.md/tokens.ts specify glass.nav.backgroundColor =
rgba(30,26,38,0.55) over bg.base (#121016), which computes to
rgb(25,22,31) - a dark purple-grey, nowhere near what's rendering. This
matches what the Manager described from Bella's screenshot ("flat LIGHT
GREY bar").

For comparison, I pixel-sampled two other glass-token surfaces on the same
screen that came out exact:
- GlassCard rows ("Edit profile"/"Settings"): measured rgb(36,20,63) vs.
  computed rgba(76,29,149,.32) over bg.base = rgb(36.5,20.2,62.7) - matches
  to the pixel.
- Usertag chip: measured rgb(34,20,57) vs. computed rgba(76,29,149,.28)
  over bg.base = rgb(34.3,19.6,57.5) - matches to the pixel.

So the token system and flat-fill GlassCard usage are correct; the bug is
isolated to TabBar's own rendering. Logcat shows expo-blur's own runtime
warning: "You have selected the 'dimezisBlurViewSdk31Plus' blur method, but
the blurTarget prop has not been configured. The blur view will fallback
to 'none' blur method to avoid errors." - per Bella's own build log this
fallback is supposed to leave glass.nav's flat rgba fill visible (the
wrapper View's backgroundColor), but the measured color doesn't match that
fill either. I'm reporting the pixel evidence and the logcat warning, not
asserting root cause - flagging for Ruby/Bella to trace whether BlurView's
"none"-method fallback is painting an opaque default tint on top of
wrapper, overriding the correct color underneath.
Evidence: `01-home.png`, `12-app-final.png`, `31-final-profile.png`
(pixel-sampled in `logs/evidence/build-06/qa/` via a py -3/PIL check, raw
values quoted above).

### 5. Gear-zone (top-right 64x64) empty on Home and Profile; Home avatar placement
PASS on the "nothing important in the reserved corner" rule, but BUG found
on the Settings icon itself (related to but distinct from item 4):
- Home: signed-in Avatar (Justin's real photo) sits correctly inset left of
  the dev-client gear icon, no overlap, tappable. `01-home.png`.
- Profile: Settings header icon sits at bounds [818,147][912,242] -
  94x95px / 2.625 ≈ 36x36dp, exactly the spec'd 36x36 size - correctly left
  of the reserved zone (dev gear icon at [896,194][1022,320], no overlap).
  Size and position are both correct.
- BUG: the icon has no visible chip background at all. Pixel-sampled an
  8x8 grid of points immediately around the gear glyph
  (`00-launch-gearzone-crop.png` for the visual, raw sampling against
  `00-launch.png`): every point reads exactly rgb(18,16,22) = bg.base,
  zero purple tint. Spec calls for a 36x36 GlassCard-chip:
  rgba(76,29,149,.3) fill + border.hairline border + radius: sm
  (DESIGN.md Build 6, Layout section). Computed expected fill:
  rgba(76,29,149,.3) over bg.base ≈ rgb(35,20,60) - clearly purple, not
  what's rendering. The gear glyph itself renders (white gear character,
  correct size/position), but with no pill/chip surface underneath - reads
  as a bare icon floating on the background, not a button.

### 6. "0 movies watched" empty box — what's actually there
As instructed, reporting exactly what renders, not judging against the
Manager's verbal note to Bella: "0 movies watched" caption (text.secondary)
directly above an empty dashed-border rectangular placeholder box
(no grid cells, no PosterCard shimmer/content inside - just an empty
outlined container). No 3-column collection grid is visible; the box is a
single empty rectangle. This matches DESIGN.md's literal Build 6 spec text
("the grid itself is empty at this Build... the row count and grid container
render now") more closely than a fully-removed strip would, but I'm not
certain this is what "leave the movies strip out" meant - flagging both
readings for the Manager/Ruby to reconcile, since I can only report what's
on screen, not which instruction it was supposed to follow.
`00-launch.png`, `31-final-profile.png`.

### 7. Regression
- Build 5 (sign-in persistence): PASS, confirmed multiple times this
  session - the app started already signed in as Justin and stayed signed in
  through two Metro-URL reconnect cycles, a force-stop, and an airplane-mode
  round trip; never needed to sign in again.
- Build 2 (Supabase): PASS - "CHECK CONNECTION" -> "Supabase: connected".
  `25-check-connection.png`.
- Build 3 (TMDB proxy): PASS - 5 titles + attribution string verbatim.
  `27-tmdb-result.png`.
- Build 4 (Sentry): PASS - "Sent — event ... at ...". `29-sentry-result2.png`.
  (Note: hit "SIMULATE BAD KEY" by mistake once first, same stale-coordinate
  mistake as previous Builds' debug screen - not a regression, confirmed by
  re-running the real checks cleanly right after.)

### Logcat
--pid-filtered dump for the whole session (`logcat-app-full.txt`, 857
lines). Reporting exactly what appeared:
- Same recurring E unknown:ReactHost: Unhandled SoftException /
  ReactNoCrashSoftException: raiseSoftException(onWindowFocusChange(hasFocus
  = "true")): Tried to access onWindowFocusChange while context is not
  ready seen in Build 5's QA and its Bug 1 re-test - still present in Build
  6, same signature, still no visible effect on any screen.
- W HWUI: Failed to initialize 101010-2 format, error = EGL_SUCCESS.
- E chromium: [...] Seed missing signature. (Play Services internal
  component, not app code).
- W BridgelessReactContext: [WARNING] Bridgeless doesn't support
  CatalystInstance...
- W ReactNativeJS: You have selected the "dimezisBlurViewSdk31Plus" blur
  method, but the blurTarget prop has not been configured. The blur view
  will fallback to "none" blur method to avoid errors. - see item 4/5 above,
  directly relevant to both bugs found.
- W ReactNativeJS: Error: undefined - fired once, coincided with a Metro
  reconnect/URL-switch during my testing, not a runtime crash.
- No DEVELOPER_ERROR, no ApiException, no FATAL, no crash/ANR.

### UNTESTABLE
None.

### Bugs
- Build 6 · Bug candidate 1 — TabBar background renders flat grey, not
  DESIGN.md's glass.nav purple-tinted translucent fill. Repro: open any
  tab screen (Home or Profile), look at/pixel-sample the bottom tab bar.
  Expected: rgba(30,26,38,0.55) over bg.base ≈ rgb(25,22,31) (dark
  purple-grey). Actual: flat rgb(105,103,108) (light-medium neutral grey),
  consistent across screens. See item 4 for full pixel evidence and the
  related logcat warning.
- Build 6 · Bug candidate 2 — Settings header icon has no chip background.
  Repro: open Profile screen, look at the top-right settings gear icon (inset
  left of the dev-client corner). Expected: 36x36 GlassCard-chip,
  rgba(76,29,149,.3) fill + border.hairline border + radius: sm.
  Actual: bare gear glyph on the plain background, rgb(18,16,22) (bg.base,
  zero purple tint) confirmed by pixel sampling around the icon. Size and
  position are correct, just no visible chip surface. See item 5.

Both bugs are visual/design-match failures, not functional breaks - every
tap target still works, nothing crashes. Reporting as Bugs per the "no
one-off colors" / exact-values DESIGN.md rule (§7), for Ruby to confirm in
code and route to Bella.

### Verdict
FAIL (2 bug candidates) — functionally everything works (data, loading/
error/retry, navigation, regression), but two DESIGN.md Build 6 value
mismatches confirmed by pixel evidence: the TabBar's glass.nav fill and
the Settings header icon's missing chip background. Recommend both go back
to Bella as Build 6 Bugs before Ruby's review closes this Build.

## Build 6 · Bug 1 (Queenie pixel-sampled, Ruby traced, Manager confirmed)

Three findings:

1. **TabBar rendered flat grey instead of `glass.nav`.** Ruby traced the
   cause to `expo-blur`'s `ExpoBlurView.kt`: with no `blurTarget` wired,
   Android skips the blur setup but still paints `tint` as the native
   view's own opaque background — a flat mid-grey (`rgb(105,103,108)`),
   unrelated to `glass.nav.backgroundColor` underneath. Fix:
   `src/ui/TabBar/TabBar.tsx` only renders `BlurView` on
   `Platform.OS === "ios"` now; Android renders two stacked flat `View`s
   instead. **Re-checking this on-device (re-sampling, not just applying
   the described fix) turned up a second, different bug the report didn't
   catch**: with `BlurView` removed, the lone translucent
   `glass.nav.backgroundColor` fill composited against nothing (the tab
   bar sits in a reserved layout area outside the screen's own content,
   not stacked visually over `bg.base`), landing on a *different* wrong
   grey (`rgb(125,123,130)`, from blending against a white/undefined
   backdrop). Added an opaque `bg.elevatedFlat` base layer underneath the
   translucent tint (`styles.opaqueBase` + `styles.tintOverlay`), matching
   tokens.ts's own note that `bg.elevatedFlat` is "the flat-fallback base
   color these translucent fills sit on". Re-sampled after: `rgb(30,26,38)`
   — exactly `glass.nav.backgroundColor`'s own RGB (its alpha-blend with
   `bg.elevatedFlat` is a no-op since both tokens share the same base hue,
   which is why the flat-fallback pattern works at all). Retracting my
   Build 6 log's "visually correct" claim about this fill — it wasn't,
   until this fix. Applied the same `Platform.OS === "ios"` guard to
   `GlassCard`'s `blur` path for consistency, though no Build 6 caller
   passes `blur` yet so it wasn't independently visible.
2. **Settings header icon had no visible chip.** `src/app/(tabs)/profile/index.tsx`'s
   `settingsChip` style only set size/radius/position — `GlassCard`'s
   `tier="chip"` token (`rgba(18,16,22,.55)`, no border) reads as
   near-invisible against `bg.base`, and DESIGN.md's Build 6 layout spec
   wants explicit `rgba(76,29,149,.3)` + `border.hairline` for this one
   button anyway (not `glass.chip`'s own values). Added those directly to
   `settingsChip`'s style (which overrides `GlassCard`'s tier defaults,
   since `style` is layered last). Pixel-sampled after:
   `rgb(36,20,60)` — matches the computed `rgba(76,29,149,.3)` over
   `bg.base` (≈`rgb(35,20,60)`) almost exactly.
3. **(nit) Home read `session.user.user_metadata` inline.** DESIGN.md §7
   says a route composes `ui/` + a module's exported hook only.
   `src/app/(tabs)/index.tsx` now uses `useOwnProfile` (same hook the
   Profile screen uses) instead of re-deriving the Google-metadata key
   fallback itself; updated `__tests__/home-test.tsx` to mock
   `@/modules/profile` instead of `@/modules/auth`.

**Not a bug** (per the Manager's note): the "0 movies watched" row stays —
DESIGN.md specifies it; my own earlier instruction to drop it in the
original brief was wrong.

Gates: `npx tsc --noEmit` / `npx expo lint` / `npx jest` all pass (3 suites
/ 9 tests, zero warnings) after all three fixes.

On-device: reloaded (no native rebuild needed — JS-only), left Justin's
session signed in throughout (no data clear, no sign-out). Both fixes
verified by pixel sample, not just visual inspection:
`logs/evidence/build-06/bug1-tabbar.png` (`rgb(30,26,38)` at the tab bar),
`logs/evidence/build-06/bug1-profile-settings-chip.png`
(`rgb(36,20,60)` at the settings chip), `dump-profile.xml` (uiautomator
bounds used to pick exact sample coordinates rather than eyeballing them).
Metro stopped after, port 8081 confirmed free.

Files touched, all inside Bug 1's own scope: `src/ui/TabBar/TabBar.tsx`,
`src/ui/GlassCard/GlassCard.tsx`, `src/app/(tabs)/profile/index.tsx`,
`src/app/(tabs)/index.tsx`, `__tests__/home-test.tsx`, this log. No files
outside Bug 1's scope.

## Bug 1 re-test (Queenie)

Re-tested commit 5d885f0 (JS-only fix). Own time-limited Metro
(`timeout 1800 npx expo start --dev-client`), stopped at end, port 8081
confirmed free. App left signed in as Justin throughout (no `pm clear`, no
sign-out). Evidence: `logs/evidence/build-06/qa/bug1/` (screenshots 00-44,
`ui-*.xml` dumps, `logcat-home-offline.txt`).

Note on environment: this session needed unusually persistent retries to get
a genuinely fresh JS mount while offline (airplane mode) for item 3 below,
because the dev-client's cached "last used" server is a WiFi IP
(`192.168.254.x:8081`), and both bundle loading AND reload attempts over that
route fail under airplane mode the same way a real network outage would.
Worked around it by manually connecting to `http://localhost:8081` (routed
through `adb reverse`, which tunnels over the ADB/USB bridge rather than the
emulator's simulated WiFi radio) — that connection succeeded even with
airplane mode on, giving a true "JS loads, but Supabase/API calls fail"
scenario instead of "nothing loads at all."

### Item 1 — Tab bar background: pixel-sample ≈ rgb(25-30,22-26,31-38)
PASS. Sampled 4 points across the tab bar (Home and Profile) with PIL:
all four points read exactly `rgb(30,26,38)` — the upper bound of the
expected range, and an exact match for `bg.elevatedFlat` (`#1E1A26`).
This is `glass.nav`'s translucent tint composited over the new opaque
`bg.elevatedFlat` base layer Bella added — since both colors are
numerically identical, the composite is stable at exactly `(30,26,38)`
regardless of the fill's alpha. Confirms the fix: no more flat unrelated
grey (previously measured `rgb(105,103,108)`).
`00-launch.png`, `01-home.png`.

### Item 2 — Settings header chip: rgba(76,29,149,.3) + hairline border
PASS. Chip bounds (uiautomator) `[818,147][912,242]` = 94x95px / 2.625
≈ 36x36dp, matching spec size. Pixel-sampled 6 points inside the chip fill
(avoiding the rounded corners and the gear glyph itself): all 6 read exactly
`rgb(36,20,60)`, matching the computed `rgba(76,29,149,.3)` over `bg.base`
(`≈ rgb(35,20,60)`) almost exactly — same as Bella's own log entry. Confirms
the fix: the chip now has a real visible purple pill background, not a bare
floating glyph. `00-launch.png` (crop reference from original QA still
applies visually; re-confirmed numerically this session).

### Item 3 — Home avatar via useOwnProfile + airplane-mode error path
PASS, both halves:
- **Avatar still shows Justin's photo (online):** confirmed on every normal
  launch this session — Home's avatar briefly shows the fallback-initials
  "?" gradient circle for roughly 1-3 seconds while `useOwnProfile` fetches,
  then resolves to Justin's real Google photo. `10-home-resolved.png`,
  `44-persist-loaded.png`.
- **Load-error path doesn't crash (airplane mode):** forced a genuinely
  fresh JS mount while offline (via the `localhost:8081`/`adb reverse`
  route described above, airplane mode on). Home rendered normally —
  backdrop, "Debug: Supabase" link, tab bar — with the avatar staying on
  the fallback-initials "?" gradient circle (the same placeholder used
  while loading) instead of ever showing a photo, since the fetch never
  resolved. No crash, no error banner, no broken layout; every other part
  of the screen (nav, debug link) stayed fully interactive.
  `36-loaded-localhost.png`, `37-home-error-avatar.png`.
- Logcat captured for this whole offline window (`logcat-home-offline.txt`):
  same recurring `ReactHost: Unhandled SoftException` seen in every prior
  Build 5/6 session (not new, not tied to this fix), one `HWUI` warning, one
  Chromium "Seed missing signature" (Play Services internal). No
  `DEVELOPER_ERROR`, no `FATAL`, no crash/ANR.

### Quick regression
- **Profile states:** loading shimmer (circle + bars + rows) → loaded state
  with Justin's real data (photo, name, empty-usertag chip, both rows,
  "0 movies watched" placeholder) — both confirmed this session on a fresh
  mount. `38-profile-check.png` (shimmer), `39-profile-loaded.png` (loaded).
  PASS.
- **Build 5 (sign-in persistence):** force-stopped the app and relaunched via
  the dev-client launcher → landed straight on Home signed in as Justin, no
  sign-in screen shown, real photo loaded. PASS. `44-persist-loaded.png`.

### Verdict
**PASS** — both Bug 1 fixes confirmed by pixel sampling (not eyeballing):
tab bar now `rgb(30,26,38)` matching `glass.nav`/`bg.elevatedFlat` exactly,
Settings chip now `rgb(36,20,60)` matching `rgba(76,29,149,.3)` over
`bg.base`. Home's `useOwnProfile` switch verified both online (real photo
loads) and under a genuine offline fresh-mount (graceful fallback-initials
avatar, no crash). Profile states and Build 5 persistence regression both
still PASS.

App left signed in as Justin at the end of this session, on Home, per
instruction. Metro stopped; port 8081 confirmed free (`netstat` showed no
LISTENING socket after killing this session's own `node.exe` PID 14420,
matched by command line to `expo/bin/cli start --dev-client` in this app's
folder before killing it).

## Phase 5 — Manager close (2026-09-26)
- Manager: applied + tested the migration (supabase/tests/profiles_rls.sql, 12/12, rolled back); reran tsc/jest (9/9); secret scan clean; own spot re-run on device — Profile tab pixel-sampled tab bar rgb(30,26,38), settings chip rgb(36,20,60) (`manager-spot-profile.png`).
- Ruby re-review PASS; Queenie Bug 1 re-test PASS.
- Carry-forward (Ruby): Home and Profile each fetch the profile (no shared cache) — revisit when Build 12 adds TanStack Query.
- BUILD 6 DONE.
