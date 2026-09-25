# Build 5 — Google sign-in (Module 2: Auth)

- Base SHA: c20c0f0
- Branch: module/auth
- Done means (PLAN.md): user taps "Sign in with Google," completes the Google
  account picker on-device, lands back in the app signed in; closing and
  reopening the app keeps them signed in (session persists). Route guard:
  signed-out users land on the sign-in screen, signed-in users skip it.

## Phase log
- Phase 0 — Dianne mockup, done before this session (`build-05-sign-in.dc.html`,
  DESIGN.md "Build 5 — Sign-in screen").
- Phase 1–2 — Bella: done, see below.

## What was built

**Routing (Module 2 needed this app's first real route groups):** the repo
only had a single placeholder `src/app/index.tsx` before this Build. Per
DESIGN.md §3, added `(auth)/` and `(tabs)/` groups and moved the root layout
to a session-based guard:

- `src/modules/auth/hooks/useAuthSession.ts` — reads Supabase's persisted
  session once (`getSession()`) and then tracks it live via
  `onAuthStateChange`. `isLoading` covers only that first read.
- `src/app/_layout.tsx` — holds the splash screen (`expo-splash-screen`)
  until both fonts and the initial session read finish, then renders
  `<Stack.Protected guard={!!session}>` for `(tabs)` and
  `<Stack.Protected guard={!session}>` for `(auth)` (Expo Router's current
  Protected Routes API — replaces the older manual-`Redirect` pattern).
  `debug` stays an unguarded top-level route, same as before.
- `src/app/(auth)/sign-in.tsx` — the screen itself: idle/signing-in/error
  states exactly per DESIGN.md's Build 5 spec (wordmark, tagline, Google
  button, inline error card). No manual navigation on success — the
  `onAuthStateChange` listener updates `session`, and the root guard swaps to
  `(tabs)` on its own.
- `src/app/(tabs)/index.tsx` — replaces the old placeholder Home. Build 5
  scope only: signed-in chip (avatar-gradient placeholder + "Signed in ✓")
  plus the same dev-only Supabase debug link the old screen had. Real Home
  content (roulette, friend activity, etc.) is later Builds, not built here.
- `src/app/(tabs)/_layout.tsx` — a bare `Tabs` navigator with its tab bar
  hidden, since `index` is the only tab screen that exists yet.

**Auth module (`src/modules/auth/`, DESIGN.md §4 — reusable in later apps):**
- `api/signInWithGoogle.ts` — configures `@react-native-google-signin/google-signin`
  once (lazily, on first call) with the GCP **Web** client ID, runs
  `hasPlayServices()` → `signIn()`, then exchanges the returned ID token via
  `supabase.auth.signInWithIdToken({ provider: 'google', token })`. Throws on
  any failure (cancel, missing Play Services, bad token, Supabase error) —
  the screen shows one generic error state for all of them (DESIGN.md: "don't
  branch UI text per error type") and logs the real error to Sentry.
- `components/GoogleSignInButton/` — the exact-spec dark-theme Google button
  (fill `#131314`, stroke `#8E918F`, official multicolor "G" logo, Google
  Sans Medium label, idle/loading/pressed/disabled states). Deliberately
  outside `src/ui/` per DESIGN.md ("its exact look is fixed by Google's brand
  rules, not our token system").

**`src/ui/tokens.ts` and `src/ui/GlassBackdrop/`:** neither existed yet (no
screen had been built before this one) — created now since DESIGN.md §1/§7
require every component to source values from `tokens.ts`, and the sign-in
screen needs the backdrop. Transcribed directly from DESIGN.md §1's tables
(colors, glass, spacing, radius, elevation, type scale) — nothing added
beyond what's already specified there.

**Fonts:** `@expo-google-fonts/{inter,poppins,google-sans}` installed and
loaded via `useFonts()` in the root layout (DESIGN.md §1.6), gated behind
the same splash-hold as the session read.

**`src/lib/supabase.ts`:** added the `AppState`-driven
`startAutoRefresh()`/`stopAutoRefresh()` toggle (PLAN.md's Build 5 Changes
note, 2026-09-25) — without it, `autoRefreshToken` has nothing polling it
while the app is backgrounded on native.

**Config:** `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` added to `.env` (value copied
from `Credentials/perchable/.env`, already created by the Manager) and
`.env.example`. `@react-native-google-signin/google-signin` added itself to
`app.json`'s plugin list via `npx expo install` (no `iosUrlScheme` — iOS is
out of scope until later, per CLAUDE.md).

## Why this way

**Native ID-token flow, not a WebView OAuth redirect:** this is what the task
brief and Supabase's own current React Native guide both specify — the
native picker returns an ID token directly, no browser round-trip, no deep
link to configure yet (that only matters for magic links/OAuth-redirect
providers, not this flow).

**`Stack.Protected`, not a manual `<Redirect>` in each screen:** Expo Router's
current docs (fetched this session, not memory — SDK 57) present this as the
replacement for the older SDK-52-era redirect pattern; it's also strictly
less code than wiring a `Redirect` into every protected screen.

⚠️ Big decision: **`(tabs)/_layout.tsx` ships with its tab bar hidden and only
one route**, instead of building DESIGN.md §2's full 5-item `TabBar`
component now. The other four tab screens (Search, Chat, Leaderboards, and
Profile's own content) don't exist until Builds 12, 17, 27 and later —
building a 5-item nav bar against four routes that don't exist would be
speculative UI with nothing behind it. `TabBar` gets built when the second
real tab screen lands. Flagging this since it's a visible deviation from the
DESIGN.md route tree's literal `<TabBar>` mention, even though DESIGN.md's
own Build 5 section says not to build Home's real content yet.

⚠️ Big decision: **background halo blobs (`GlassBackdrop`) are flat translucent
circles, not real Gaussian blur.** React Native has no CSS-style
`filter: blur()`; DESIGN.md §1.4's "blur(120–130px)" halo can only be
produced natively via something like react-native-skia. Approximated with a
large low-opacity radial fill instead — visually close (soft glow behind
content) but harder-edged than the mock. Marked with a `ponytail:`-style
comment in `GlassBackdrop.tsx` naming the upgrade path. Not a blocker for
Build 5's actual done-means (sign-in flow), and no other screen depends on
the blur being literal yet.

**Google's official G-logo asset, not an icon font:** no SVG/icon library is
installed and adding one for a single fixed brand asset would be the
speculative-dependency the team avoids. Downloaded Google's own hosted PNG
(`developers.google.com/identity/images/g-logo.png` — the asset Google's own
Identity docs point developers to) instead of drawing/approximating it.

**`expo-linear-gradient` added for the signed-in chip's avatar-ring gradient:**
DESIGN.md's `Avatar` component spec (§2) already calls for a
`purple.700→gold.500` gradient ring, and React Native has no native gradient
primitive. This is the standard, single-purpose Expo module for exactly that
need (not a general "add a UI library" decision) — it'll be reused by the
real `ui/Avatar` component when that's built.

**`expo-secure-store` installed then removed:** the top-level team CLAUDE.md
says "tokens go in expo-secure-store," but Supabase's session already
persists via AsyncStorage (Build 2's decision, matches Supabase's own Expo
guide). Adding secure-store now would mean a second, competing storage
mechanism for the same session with no Build asking for it — reverted rather
than carrying dead scope.

## Gates
- `npx tsc --noEmit` — pass.
- `npx expo lint` — pass.
- `npx jest` — pass, 2 suites / 4 tests:
  - `__tests__/home-test.tsx` — smoke test on the real `(tabs)/index` route
    (signed-in chip + placeholder text).
  - `__tests__/sign-in-test.tsx` — real `(auth)/sign-in` route +
    `GoogleSignInButton`, with `@react-native-google-signin/google-signin`
    mocked (native module, can't run in Jest) and `@/lib/supabase` mocked
    (avoids a real network call). Covers idle render, the loading label
    while sign-in is in flight, and the generic error card on failure.
- App starts / installs: `npx expo run:android` (native rebuild, package
  added native code) — `BUILD SUCCESSFUL`, installed on `emulator-5554`.
  Metro started separately (`--dev-client`), stopped after verification;
  confirmed port 8081 free afterward (checked the process was this session's
  own `expo start`, not another project's, before killing it).

## What was verified vs. not

**Verified on-device (screenshots in `logs/evidence/build-05/`):**
- Sign-in screen renders idle state correctly: wordmark, tagline, backdrop,
  and the Google button matching the spec (dark fill, stroke, official G
  logo, correct label) — `sign-in-idle.png`.
- Tapping the button drives the button into its loading state
  ("Signing in…" + spinner) — `after-tap.png`.
- The tap goes on to open the **real native** Google flow (Play Services'
  `MinuteMaidActivity`/account-add flow — confirmed via logcat component
  names, not a mock) without any crash, `DEVELOPER_ERROR`, or `ApiException`
  — `google-add-account-flow.png`.

**Not verified — expected per the task brief:** `td_emu` has no Google
account signed in yet, so the flow lands on Google's own "Sign in / Create
account" form rather than an account picker, and can't be completed from
here. This matches PLAN.md's flagged risk (§ risks, "Google sign-in on
`td_emu`'s Google-APIs-only image is unverified") — but the flow itself
**did** load correctly on this Google-APIs image, so the risk item can likely
be downgraded: no emulator/Google-Play-image swap looks necessary once an
account exists. Recommend Justin add a Google account to `td_emu` (Settings →
Accounts) so Queenie can complete a real sign-in and confirm session
persistence across app restarts (the other half of Build 5's done-means,
which needs a completed sign-in to test).

## Plan problem
None.

## Dashboard setting
None needed. (Corrected: my Phase 1-2 session couldn't complete a real sign-in
— td_emu had no Google account yet — so my earlier note here only said the
ID-token *request* went through cleanly, not that a session was actually
created. Queenie's QA session completed a real sign-in once Justin added a
Google account, and the Manager confirmed a `google`-provider user exists in
the Supabase Auth table. That — not this session — is what actually confirms
no dashboard setting, like "skip nonce check," was needed.)

## Build 5 · Bug 1 (Ruby review, fixed by Bella)

Three findings, each confirmed in the code before coming back as a Bug:

1. **Cancelled sign-in reported to Sentry as an exception.** `signInWithGoogle`
   only checked `isSuccessResponse`, so a `CancelledResponse` (user backs out
   of the Google picker) fell into the same generic-error throw as a real
   failure, and the screen's `catch` sent every error — including this one —
   to `Sentry.captureException`. Fix: check `isCancelledResponse(response)`
   first and throw a dedicated `GoogleSignInCancelledError`
   (`src/modules/auth/api/signInWithGoogle.ts`); the screen
   (`src/app/(auth)/sign-in.tsx`) still shows the same generic error card for
   it (DESIGN.md doesn't branch copy per error type) but skips the Sentry
   report specifically for that error class. Added a test asserting a
   cancelled response shows the error card and does **not** call
   `mockCaptureException`, alongside a same-shaped test proving a real
   failure still does.
2. **Button pressed state used `opacity: 0.92` on the whole button**, not
   DESIGN.md's `rgba(255,255,255,.08)` overlay on the `#131314` fill. Fixed
   by rendering a translucent absolute-fill `View` on top of the button's
   content only while `pressed` (Pressable's function-as-children form),
   instead of dimming the whole thing. Also moved the corner radius from a
   literal `12` to `radius.sm` from `src/ui/tokens.ts` — this one value isn't
   part of Google's brand lock (DESIGN.md: "Google permits any radius"), so
   it belongs in the token system like every other component's radius.
3. **`act()` warning in `sign-in-test.tsx`.** The two failure-path tests fired
   `fireEvent.press` then asserted with `waitFor`/`findByText`, but the state
   update inside `handlePress`'s `catch` (after `await signInWithGoogle()`
   rejects) landed outside any `act()` scope by the time React committed it,
   so it warned even though the assertion itself was already correctly
   awaited. Fixed by wrapping the press *and* a microtask flush in
   `act(async () => { ...; await flushMicrotasks(); })` before asserting, so
   the update this Bug's own new cancel-path test triggers is captured
   inside `act` too. `npx jest` now runs with zero console warnings.

Verified on-device after the fix (JS-only change, no native rebuild): reran
`npx expo run:android`'s existing install, started Metro, reloaded — sign-in
screen renders correctly (idle state, button fill/stroke/radius unchanged
visually since `radius.sm` is still `12`). Emulator ANR'd once mid-session on
a cold relaunch (`logs/evidence/build-05/bug1-check.png`) — matched this app's
documented "degraded emulator" symptom (CLAUDE.md's Emulator health section),
not a code issue; `adb reboot` + settle resolved it, and the reloaded app then
showed the still-persisted signed-in session from Queenie's QA pass
(`logs/evidence/build-05/bug1-idle3.png`), confirming session persistence
again. Cleared app data afterward to re-check the sign-in screen itself
(`logs/evidence/build-05/bug1-signin-idle.png`).

Files touched, all inside Bug 1's own scope: `src/modules/auth/api/signInWithGoogle.ts`,
`src/modules/auth/index.ts`, `src/app/(auth)/sign-in.tsx`,
`src/modules/auth/components/GoogleSignInButton/GoogleSignInButton.tsx`,
`__tests__/sign-in-test.tsx`, this log. No files outside Bug 1's scope.

## QA (Queenie)

Tested on `emulator-5554` (td_emu), dev-client APK already installed (Bella's
build), Metro started fresh for this session (`npx expo start --dev-client`).
Evidence folder: `logs/evidence/build-05/qa/` (screenshots numbered 01-39,
plus uiautomator dumps `ui-*.xml` and `logcat-app-full.txt` /
`logcat-errors.txt`).

**Note on the KNOWN LIMIT in my brief:** I was told the emulator has no
Google account and that completing the picker / session persistence would be
UNTESTABLE. That was true as of Bella's Phase 1-2 session, but a Google
account (justin.masiga.94@gmail.com) has since been added to `td_emu`
(Bella's log recommended this). So I was able to test the full flow,
including the two items flagged untestable — see below, now both PASS.

### 1. Cold launch signed-out → sign-in screen (route guard)
PASS. Cleared app data (`pm clear`), cold-launched: dev-client launcher →
tapped dev server → dev-menu overlay (dismissed with Continue) → sign-in
screen rendered. No crash, no ANR. `15-signin-idle-final.png`.

### 2. Screen vs DESIGN.md exact values
PASS. `04-signin-idle.png` / `15-signin-idle-final.png` + `ui-signin-idle.xml`.
- Button height: uiautomator bounds `[74,1406][1007,1532]` — 126px / 2.625
  (420dpi divided by 160) = 48.0dp exactly, matches spec.
- Button width: 933px / 2.625 = 355.4dp = screen width (411.4dp) minus 2x28px
  padding — matches "fill container, 28px horizontal padding" exactly.
- Fill/stroke/label read as spec'd (dark fill, thin grey stroke, official
  multicolor G logo, "Sign in with Google" in light grey, left-aligned logo
  with gap to label).
- Wordmark "owl emoji perchable" gold, tagline "Track what you watch. / Rate
  it your way." in secondary grey, both verbatim.
- Backdrop: two blurred-halo blobs (purple top-left, gold bottom-right),
  dimmer than Home's per spec.
- TMDB attribution string (via debug screen, Build 3 regression, see below)
  reads verbatim: "This application uses TMDB and the TMDB APIs but is not
  endorsed, certified, or otherwise approved by TMDB." — `10-fetch-tmdb-result.png`.

### 3. Tap - loading - native flow - back/cancel - error state - retry
PASS, full chain including the two previously-UNTESTABLE items.
- Tap to loading state: G logo replaced by spinner, label becomes
  "Signing in...", screen dimmed. `17-tap-loading-correct.png`.
- Native flow: Google's real "Choose an account" picker opened (not the
  create-account form Bella saw — an account now exists).
  `18-native-google-flow.png`.
- Selected the existing account (no password typed, no account added) then
  landed signed-in with "Signed in check" chip. `20-after-account-select.png`.
  This completes Build 5's full done-means, previously marked untestable.
- Session persistence: force-stopped the app, relaunched (through the
  dev-client launcher and dev-menu dismiss) and landed straight on the
  signed-in screen, no sign-in screen shown. `23-persist-final.png`. Second
  previously-untestable item, now PASS.
- Error state: cleared data, went offline (airplane-mode enable), tapped
  sign-in — device-local picker still opened (on-device, no network needed)
  — selected account — Supabase's signInWithIdToken call failed offline —
  inline error card rendered, copy verbatim "Couldn't sign in. Check your
  connection and try again." (with the leading warning-triangle glyph),
  button reverted to idle "Sign in with Google" (no "Try again" variant).
  `29-offline-error-result.png`.
- Retry: re-enabled network, tapped the same button again — succeeded,
  landed signed-in. `31-retry-loading.png`. Retry works.
- Back/cancel: separately, triggered the native picker and pressed the
  hardware Back key mid-flow — app returned cleanly to the sign-in screen in
  the same error state (verbatim copy, button reset), no crash.
  `35-back-cancel-error.png`.

### 4. Breaking it
- Rapid triple-tap on the idle button: only one native flow opened (the
  button visibly disables once tapped) — no duplicate/stacked pickers.
  `34-rapid-tap.png`.
- Background/foreground during the native flow: pressed Home while the
  picker was open, then relaunched the app — recovered cleanly to the error
  state (the cancelled native flow surfaces as a normal "couldn't sign in"
  error), no crash, no stuck spinner. `36-backgrounded.png`,
  `37-foregrounded.png`.
- Airplane mode: see item 3 above — handled correctly, verbatim error copy.
- Rotation: forced `user_rotation` to landscape — screen did not rotate (app
  is portrait-locked), no layout break. `38-rotated.png`.
- Forced system dark mode (`cmd uimode night yes/no`): no visible change
  either way — app is dark-only per DESIGN.md, correct. `39-darkmode-forced.png`.

### 5. Regression - Builds 2-4 (via the unguarded /debug route)
All three checked from the signed-in Home screen's "Debug: Supabase" link.
- Build 2 (Supabase connected): "CHECK CONNECTION" gives "Supabase:
  connected" (green). PASS. `08-check-connection.png`.
  Note: I initially mis-tapped "SIMULATE BAD KEY (TEST)" by mistake (layout
  shifts after each debug action, coordinates from an earlier dump go stale)
  and saw "Supabase: error - HTTP 401: Invalid API key" - this is that debug
  button working as intended, not a regression, confirmed by re-running
  "CHECK CONNECTION" cleanly right after.
- Build 3 (TMDB proxy): "FETCH POPULAR MOVIES" returns 5 titles plus the
  attribution string rendered verbatim. PASS. `10-fetch-tmdb-result.png`.
- Build 4 (Sentry): "SEND TEST ERROR TO SENTRY" gives "Sent - event <id> at
  <timestamp>". PASS. `12-sentry-result.png`.
- Build 1 (dev build boots): implicitly covered - every launch in this
  session boots the dev-client APK into the router without crash.

### 6. Logcat
Captured `logcat -d *:E` (full session, system-wide) and a `--pid`-filtered
dump for just `com.tsujintsujin.perchable` covering this session's app
process. Reporting exactly what appeared, per team rule (not filtering by my
own judgment of "dev-only"):
- `E unknown:ReactHost: Unhandled SoftException` with
  `com.facebook.react.bridge.ReactNoCrashSoftException:
  raiseSoftException(onWindowFocusChange(hasFocus = "true")): Tried to access
  onWindowFocusChange while context is not ready` - logged once, about 4s
  after app start (21:10:23.593).
- `W HWUI: Failed to initialize 101010-2 format, error = EGL_SUCCESS` -
  logged twice.
- `W BridgelessReactContext: [WARNING] Bridgeless doesn't support
  CatalystInstance. Accessing an API that's not part of the new architecture
  is not encouraged usage.`
- No `DEVELOPER_ERROR`, no `ApiException`, no `FATAL`, no app crash/ANR in
  either capture. Full files: `logcat-app-full.txt`, `logcat-errors.txt`.

Flagging the `ReactHost` SoftException and the two warnings for Ruby/Bella to
judge cause - they did not visibly affect any screen or flow in this
session, but per team rule I'm not deciding that myself.

### UNTESTABLE
None remaining for this Build - both items originally flagged (completing
the picker, session persistence) were testable once Justin added a Google
account to `td_emu`, and both PASS.

### Bugs
None found. The one earlier-looking failure (HTTP 401 on Supabase debug) was
my own mis-tap of the adjacent "Simulate Bad Key" test button, not a product
bug - confirmed by immediately re-running the real check successfully.

### Verdict
PASS - Build 5 done-means fully met, including the two previously-untestable
items (native picker completion, session persistence). Design matches
DESIGN.md's Build 5 spec (measured button dimensions, colors, copy all
verbatim). No regressions in Builds 1-4. Logged warnings/SoftException above
are flagged for Ruby to judge cause, not treated as blocking.

Metro stopped at end of session; confirmed port 8081 free (verified via
`netstat`, killed only this session's own `node.exe` PID 23344, matched by
command line to `expo/bin/cli start --dev-client` in this app's folder).
