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
None needed — the ID-token flow worked against Supabase's default Google
provider config (no "skip nonce check" or similar toggle required).
