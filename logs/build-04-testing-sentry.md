# Build 4 — Testing + Sentry setup (Module 1: Foundation)

- Base SHA: 83b5b6c
- Branch: module/foundation
- Done means (PLAN.md): `npx jest` runs with the `jest-expo` preset and one passing smoke test; `npx jest` becomes a required gate for every Build from here on; Sentry SDK is wired and a deliberately-thrown test error appears in the Sentry dashboard.

## Phase log
- Phase 0 — skipped (no UI).
- Phase 1–2 — Bella: done, see below.

## What was built

**Jest (jest-expo preset + RNTL):**
`jest-expo`, `jest`, `@types/jest`, `@testing-library/react-native` added as
dev deps (`npx expo install ... --dev`, so versions stay SDK-57-compatible).
`package.json` gained a `"test": "jest"` script and a `jest` block (preset
`jest-expo`, plus the `transformIgnorePatterns` Expo's own docs give for
`jest-expo` — extended with `standard-navigation`, a nested dependency of
`expo-router` that ships untranspiled ESM and otherwise breaks any test that
imports a route file). `tsconfig.json` gained `"types": ["jest"]` so
`describe`/`it`/`expect` type-check.

The smoke test (`__tests__/index-test.tsx`) renders the **real** Home route
component (`src/app/index.tsx`, unmodified) with React Native Testing
Library and asserts the actual on-screen text is present — not a mock, not
`expect(1).toBe(1)`.

**Sentry:**
`@sentry/react-native` added via `npx expo install` (adds itself as an Expo
config plugin — `npx expo install` wrote `"@sentry/react-native"` into
`app.json`'s `plugins` array automatically, no manual edit needed). Init
lives in `src/lib/sentry.ts` per DESIGN.md §4, called once from
`src/app/_layout.tsx` (root Stack) before anything renders. DSN comes from
`EXPO_PUBLIC_SENTRY_DSN` in `.env` (Manager already added the value; name
added to `.env.example`).

A "Send test error to Sentry" button was added to the existing `__DEV__`
debug screen (`src/app/debug.tsx`, next to the Supabase/TMDB debug
sections already there). It throws a real `Error`, catches it, calls
`Sentry.captureException`, and shows the returned event ID + timestamp on
screen so it can be screenshotted and cross-checked against the dashboard.

## Why this way

**Jest config extension, not a rewrite:** Expo's own `develop/unit-testing`
doc gives the exact `transformIgnorePatterns` regex to use with `jest-expo`
— used it verbatim and only added the one extra package that broke on a
real import. No custom Jest config, no Babel overrides.

⚠️ Big decision (version skew, not a design choice): `@testing-library/react-native`
14.x requires `render()` (and anything that calls `render()` internally,
like `expo-router/testing-library`'s `renderRouter`) to be **awaited** —
React 19's test renderer made `act()` async. The version installed by
`npx expo install` for SDK 57 is the current one; RNTL's own docs already
show `await render(...)`. First attempt used `expo-router/testing-library`'s
`renderRouter()` (renders through the actual file-based router, closer to
"a real route") — that call doesn't await its internal `render()`, so
`screen` was never registered and every query threw "render function has
not been called" with no other error surfaced. That's a version-skew bug in
`expo-router`'s testing harness against the newer RNTL, not something to
work around with a compat shim for a single smoke test. Rendering the route
component directly (`import Index from "@/app/index"`, `await render(<Index />)`)
sidesteps the harness entirely, is what Expo's own current docs example
does, and still satisfies "renders a real component/route" — so that's what
shipped. If the team wants router-harness tests later (deep-link
assertions, multi-route flows), re-check `expo-router/testing-library`
against the RNTL version at that time first.

**Sentry init values:**
- `tracesSampleRate: 0` — no user flow exists yet in Module 1 (Foundation
  only), nothing worth tracing, and the app must never send PII. Revisit
  when Module 2+ adds real screens.
- `enabled: true` (sends in dev too) — Build 4's done-means is a dev-only
  test button whose event must actually reach the dashboard, and there's no
  separate prod build to distinguish from yet.
- No `SENTRY_AUTH_TOKEN` exists (Manager hasn't created one, and creating
  one wasn't in scope for this Build), so source-map upload is skipped via
  `SENTRY_DISABLE_AUTO_UPLOAD=true` set on the native rebuild command.
  Reading `node_modules/@sentry/react-native/sentry.gradle` confirmed this
  env var is exactly what the Sentry Android Gradle plugin checks
  (`shouldSentryAutoUploadGeneral`), and separately that the whole upload
  task only registers for **non-debug** variants
  (`if (!v.name.toLowerCase().contains("debug"))`) — so for the dev-client
  debug build this Build produces, the upload step never runs at all; the
  env var is set anyway as documented belt-and-braces for when a release
  build happens.
- No Sentry wizard (`npx @sentry/wizard`) run — it requires logging in to a
  Sentry account from the CLI, which is out of scope (never log in on
  Justin's behalf). Manual install + manual `Sentry.init()` instead; both
  are officially supported per Expo's "Using Sentry" guide, the wizard is
  just a convenience layer.

**Native rebuild:** Sentry ships a native Android module + config plugin
(modifies `android/build.gradle` and `android/app/build.gradle`), so the JS
bundle alone can't pick it up — reran
`GRADLE_USER_HOME="C:/g/perchable" npx expo run:android --no-bundler` per
app CLAUDE.md, same short `GRADLE_USER_HOME` override as Build 1/2 (avoids
the 260-char Windows path issue) with `SENTRY_DISABLE_AUTO_UPLOAD=true` in
the shell env for that command.

## Concepts learned
- **Expo config plugins**: `npx expo install @sentry/react-native` doesn't
  just add a JS dependency — for packages with native code, it can also
  register itself as a config plugin in `app.json`, which then edits the
  generated `android/`/`ios/` projects at prebuild time (here: Gradle files
  for the Sentry Android Gradle Plugin). This is why installing a
  Sentry-like package always means a native rebuild, not just a Metro
  reload.
- **`jest-expo` preset**: a single preset that mocks the native half of the
  Expo SDK so component tests can run in plain Node/Jest without a device
  or simulator — no manual per-module mocking needed for things like
  `expo-font` or `expo-constants`.
- **React 19's async `act()`**: testing libraries built around React's
  reconciler had to make their `render()` helpers async because React 19
  itself made `act()` return a promise (concurrent-safe scheduling); any
  RNTL 14 test must `await render(...)` or the render silently never
  completes.
- **Sentry event flow**: `Sentry.captureException(error)` returns the event
  ID synchronously (the SDK queues the network send itself) — useful for
  correlating what was tapped on-device with what shows up in the
  dashboard, which is why the debug screen surfaces it instead of just
  showing "sent".

## Gates
- `npx tsc --noEmit` — clean.
- `npx expo lint` — clean.
- `npx jest` — 1 suite, 1 test, PASS. Output: `logs/evidence/build-04/jest-output.txt`.
- `npx expo start` bundling / native rebuild — see native rebuild note above
  (this Build's native change needs `expo run:android`, not just
  `expo start`; the dev client boots and serves via Metro like Builds 1–3).

## Build 4 · Bug 1 (Ruby, confirmed by Manager)

**Cause:** `Sentry.init()` had `enabled: true` but no `environment` — dev
errors (from the debug-screen test button, and any future local testing)
and real production crashes would land in the same undifferentiated
Sentry stream, with no way to filter one from the other on the dashboard.

**Fix:** `src/lib/sentry.ts` — added `environment: __DEV__ ? "development" : "production"`
to the `Sentry.init()` call. `__DEV__` is the same Metro dev/release flag
`debug.tsx` already uses to hide itself in production; no new source of
truth introduced. `enabled: true` and `tracesSampleRate: 0` unchanged.

**Files touched outside scope:** none — the fix is entirely inside the
Build 4 file it was reported against.

**Gates rerun:** `npx tsc --noEmit` clean · `npx expo lint` clean ·
`npx jest` 1/1 PASS (`logs/evidence/build-04/jest-output-bug1.txt`).
JS-only change — no native rebuild, emulator untouched (Queenie was using
it).

