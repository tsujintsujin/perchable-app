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


## Phase 3 — QA (Queenie)

Tested on commit `07c087d`, branch `module/foundation`, emulator `emulator-5554`
(`td_emu`, Android 15, Google APIs image). Dev client was already rebuilt with
`@sentry/react-native` per the brief — not rebuilt again. Metro started with
`npx expo start --android`, confirmed `packager-status:running` before any
device interaction, `adb reverse tcp:8081 tcp:8081` set.

### 1. `npx jest` — PASS
```
PASS __tests__/index-test.tsx (6.969 s)
  Home route
    √ renders the default index screen (41 ms)
Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
```
Full output: `logs/evidence/build-04/qa/jest-run.txt`.

### 2. Cold launch to index — **FAIL (Build 4 · Bug 1)**
Force-stopped the app, cleared logcat, `adb shell am start -n
com.tsujintsujin.perchable/.MainActivity`. Reproduced **3 times in a row**,
same result every time: the app shows the Expo dev-client splash screen
(blue background, white arrow logo) for roughly 25–30 seconds, then Android
kills it with an ANR ("failed to complete startup") and drops back to the
home screen. It never becomes interactive; no red-screen JS error, because
JS never gets a chance to run.

Exact logcat (saved at `logs/evidence/build-04/qa/07-anr-logcat-excerpt.txt`):
```
ActivityManager: ANR in com.tsujintsujin.perchable
ActivityManager: Reason: Process ProcessRecord{3461804 12206:com.tsujintsujin.perchable/u0a211} failed to complete startup
ActivityManager: Killing 12206:com.tsujintsujin.perchable/u0a211 (adj 0): bg anr
Zygote: Process 12206 exited due to signal 9 (Killed)
```
Metro's own log (`logs/evidence/build-04/qa/metro-log.txt`) never shows a
bundle request from the device across any of the 3 attempts — the process is
killed before it ever reaches out to Metro, i.e. before any JS (including the
root-layout Sentry.init() call) runs at all.

Screenshots:
- `01-cold-launch.png`, `02-cold-launch-loaded.png`, `03-cold-launch-final.png`,
  `04-index-screen.png` — all show the same stuck splash screen across
  multiple launches.
- `06-anr-back-to-home.png` — device kicked back to the Android home screen
  after the ANR kill.

Logcat around the failure shows a long run of `Verification of
io.sentry.android.core.*` and `AndroidOptionsInitializer` / kotlin-reflect
class-verification lines each taking 100–900ms, all happening synchronously
on the main thread before the ANR fires. I'm not the one to conclude that
Sentry's native init is the root cause — flagging exactly what's on screen
in logcat for Bella/Ruby to judge — but it is the most recent change in this
Build and the timing lines up with the main-thread work logged immediately
before every kill.

**Build 4 · Bug 1 — Cold launch ANRs and the app is killed before it becomes interactive**
- Steps: force-stop app → `adb shell am start -n com.tsujintsujin.perchable/.MainActivity` → wait ~30s.
- Expected: app reaches the index screen (or at minimum shows a JS red-screen if something in JS is broken).
- Actual: Android kills the process with "ANR ... failed to complete startup" every time (3/3), before Metro ever receives a bundle request. App returns to the home screen.
- Evidence: `logs/evidence/build-04/qa/01-cold-launch.png` … `06-anr-back-to-home.png`, `07-anr-logcat-excerpt.txt`.

### 3. Debug → "Send test error to Sentry" — **BLOCKED by Bug 1**
Could not reach the debug screen at all — the app never becomes interactive
on this device. Cannot test the button, cannot observe an event ID/timestamp
on screen. The Manager's separate confirmation that event `PERCHABLE-1`
reached the Sentry dashboard stands (server-side), but the **app-side**
half of this Build's done-means — the button working and showing an event ID
on screen — is unverified and currently unreachable.

### 4. Break it (offline) — **NOT RUN**, blocked by Bug 1 (nothing to break; app never opens).

### 5. Regression (Build 1 cold launch / Build 2 Supabase / Build 3 popular movies) — **FAIL, same root cause**
All three regression checks require the app to reach the index/debug screen.
Since cold launch never gets past the ANR (item 2), none of Builds 1–3's
features could be re-verified. This is a full regression failure, not a
partial one — the whole app is currently unusable on a cold start on this
emulator/build.

### 6. Logcat — errors reported as seen
- `ActivityManager: ANR in com.tsujintsujin.perchable` / `Reason: Process ... failed to complete startup` — see item 2, this is the blocking issue.
- `ziparchive: Unable to open '.../base.dm': No such file or directory` (×2 per launch) — seen on every launch attempt, exact text as shown, not evaluated for cause.
- `TapAndPay: java.lang.NullPointerException: NfcAdapter is null` — seen once during one launch attempt, exact text as shown; likely emulator-environment noise (no NFC hardware) but reporting per the "always report" rule rather than deciding myself.
- No Sentry-specific warning or error text appeared on screen or in logcat besides the `[@sentry/react-native/expo] Missing config for organization, project. Environment variables will be used as a fallback during the build.` line Metro printed once at startup (`logs/evidence/build-04/qa/metro-log.txt`) — reporting it verbatim since Sentry is this Build's subject, not deciding whether it matters.

### Design check — not applicable (no UI reached; Build 4 is testing/Sentry infra, no new screens per DESIGN.md).

### Cleanup
- Metro stopped, port 8081 confirmed free (`netstat -ano | grep 8081` → no output).
- `adb reverse --remove tcp:8081` run, confirmed rc=0.
- No app code edited, no commits made.

### Verdict: **FAIL** — Build 4 · Bug 1 blocks everything downstream of cold launch.

## Phase 4 — Review (Ruby)
PASS with 1 should-fix → Bug 1: no Sentry `environment` → fixed bb64087 (`__DEV__ ? "development" : "production"`). Confirmed: source-map upload task only exists for non-debug variants; `sendDefaultPii` unset (false); expo-router `renderRouter` doesn't await RNTL 14's async render (real version skew — route tests render components directly for now). Future work: Sentry auth token + org/project before the first release build.

## Phase 5 — Manager
- Queenie's FAIL (cold-launch ANR 3/3) diagnosed as **environment, not app**: logcat showed ART class verification at 40–175 bytecodes/s and 8–13 s gaps between trivial startup steps; emulator load avg 9–23, a leftover `dex2oat64` burning CPU for 9+ min, emulator up since the previous day (qemu ~45k CPU-s). Sentry native auto-init is off (`io.sentry.auto-init read: false`). After `adb reboot` of td_emu: app Displayed in 4.8 s, bundle served (1847 modules), no ANR.
- Spot re-run (Manager, after reboot): Send test error → "Sent — event c73004ff… at 2026-09-25T04:51:45Z" (arrived in Sentry, PERCHABLE-1 now 2 events); Supabase "connected"; TMDB 5 titles + exact attribution. Evidence `logs/evidence/build-04/manager-spot-check.png`.
- Gates re-run: tsc clean, jest 1/1 PASS.
- Build 4: DONE. Module 1 (Foundation) complete.
