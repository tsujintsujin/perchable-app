# Build 1 — Expo dev build boots (Module 1: Foundation)

- Base SHA: b4fad5e (main after Stage A merge)
- Branch: module/foundation
- Done means (PLAN.md): `npx expo run:android` installs a custom dev-client APK on td_emu and launches to the default Expo Router screen (not Expo Go).

## Phase log
- Phase 0 — skipped (no UI).
- Phase 1–2 — Bella: done.

## What was built
Added `expo-dev-client` to the project and generated the native `android/`
folder with `npx expo run:android` (Continuous Native Generation — CNG — kept:
`android/` stays gitignored, all native config lives in `app.json`, and any
future native tweak goes through a config plugin, not hand-edited Java/Kotlin).
Set `android.package` to `com.tsujintsujin.perchable` in `app.json` (the
`scheme` was already `perchable` from Phase 0 scaffolding). Expo's prebuild
step read `app.json` and generated the Gradle project, AndroidManifest, and
Java/Kotlin scaffolding for that package id and scheme — none of it is
committed since CNG treats `app.json` as the single source of truth and
regenerates `android/` on demand.

`npx expo run:android` then built a debug APK (Gradle `assembleDebug`),
installed it on the running `td_emu` emulator, and launched it. Because
`expo-dev-client` is linked in, the installed app is a standalone native
binary bundling its own JS engine and a dev-menu overlay (the gear icon,
visible in the launch screenshot) — it is not the Expo Go app, and it only
talks to Metro because Metro is running, not because it's sandboxed inside
Expo Go's own binary.

## Why this way
- **CNG over a committed `android/` folder** — this is Expo's own
  recommendation for SDK 57 (see `expo-project-structure` skill) and the app
  CLAUDE.md already had `/android` gitignored from Phase 0 scaffolding, so no
  reason to deviate. Native config plugins (e.g. Supabase, Google Sign-In)
  land in `app.json`/plugins in later Builds instead of hand-edited native
  files, keeping the native folder fully regenerable.
- **`expo-dev-client` via `npx expo install`, not plain `npm install`** —
  Expo's installer pins the version compatible with SDK 57, per team rule.
- ⚠️ **Big decision (environment, not app code):** the build initially failed
  with `BuildType with name 'local' not found`. Root cause: this PC has a
  machine-wide `GRADLE_USER_HOME` env var pointing at
  `C:\Users\justi\AppData\Local\EngagiaLocal\gradle`, which carries a global
  Gradle init script (`init.d/engagia-local.gradle`) for an unrelated tool
  (Engagia) that unconditionally tries to configure a `local` Android build
  type on every Gradle build on this machine. Perchable has no `local` build
  type, so every native build fails until this is worked around. Fix used:
  override `GRADLE_USER_HOME` to a project-local `.gradle-home/` folder for
  every `expo run:android` / Gradle invocation, so this project's builds
  never see that script. `.gradle-home/` is gitignored, never committed.
  **Flagging for the Manager: this is a machine-wide setting, not something
  in Perchable's control — every future native Android build (this app and
  any other MobileDev app) needs the same `GRADLE_USER_HOME` override, or
  Justin needs to know the Engagia init script is intercepting all Android
  Gradle builds on this PC.** Not fixed at the system level since changing
  machine env vars is out of scope for a Build.

## Concepts learned
- **CNG (Continuous Native Generation):** `android/`/`ios/` are build
  artifacts regenerated from `app.json` + installed packages, not
  hand-maintained source. `npx expo prebuild` (run implicitly by
  `expo run:android`) is the regeneration step.
- **Dev client vs. Expo Go:** Expo Go is a pre-built generic native shell
  Metro-loads JS into; a dev client is a project-specific native binary
  (built here via Gradle) that bundles whatever native modules the app
  declares, which Expo Go can't. Confirmed via package id
  (`com.tsujintsujin.perchable`, not `host.exp.exponent`) and the dev-menu
  gear overlay only a dev client shows.
- **Gradle daemon + `GRADLE_USER_HOME`:** Gradle caches its dependencies,
  daemons and init scripts under `GRADLE_USER_HOME` (default `~/.gradle`);
  overriding it per-invocation is a clean way to sandbox a build away from a
  machine-wide config without touching that config.
- **Debug keystore SHA-1:** every local debug build is signed with a
  per-machine auto-generated `android/app/debug.keystore` (password
  `android`). Its SHA-1 fingerprint is what Google Cloud Console needs to
  authorize this dev client for Google Sign-In (Module 2) — not a secret,
  just an identifier, safe to log.

## Evidence
- `logs/evidence/build-01/launch.png` — app running on td_emu, default Expo
  Router screen with the gear (dev-client) button top-right.
- `logs/evidence/build-01/package-proof.txt` — `dumpsys package
  com.tsujintsujin.perchable` (versionName 1.0.0, `DEBUGGABLE` flag — this is
  a local debug build, not Expo Go) and `dumpsys activity activities`
  confirming `com.tsujintsujin.perchable/.MainActivity` as the resumed
  activity.

## Debug keystore SHA-1 (for Google OAuth Android client, Module 2)
```
SHA1:   5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
SHA256: FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C
```

## Gates
- `npx tsc --noEmit` — clean.
- `npx expo lint` — no ESLint config existed yet; `expo lint` auto-installed
  and configured `eslint` + `eslint-config-expo` (first run of this gate ever
  in the project) — clean on the rerun.
- Tests — none exist yet (none planned until Module 7 per PLAN.md).
- App starts / installs — `npx expo run:android` succeeded: APK built,
  installed as `com.tsujintsujin.perchable`, launched to the default Expo
  Router screen on `td_emu` (see evidence).

## Phase 3 — QA (Queenie)

Environment: emulator-5554 (td_emu), Metro started with `npx expo start --dev-client`
(logs: `logs/evidence/build-01/qa/` — screenshots, package proof, ui dump, logcat
excerpts). `adb devices` healthy at start, no stuck-server issue this session.

### 1. Happy path — force-stop, cold launch
- `adb shell am force-stop com.tsujintsujin.perchable` then `monkey -p ... 1`.
- Splash (blue background, white chevron logo) → Expo Router default screen:
  title bar "index", body "Edit src/app/index.tsx to edit this screen.", gear
  icon top-right (dev-menu), "Tools" pill.
- Screenshots: `01-cold-launch.png` (splash), `02-after-wait.png` (loaded).
- **PASS.**

### 2. Proof it's the custom dev-client APK, not Expo Go
- `dumpsys window | grep mCurrentFocus` →
  `Window{... com.tsujintsujin.perchable/com.tsujintsujin.perchable.MainActivity}`.
- `pm list packages` shows both `com.tsujintsujin.perchable` (ours) and
  `host.exp.exponent` (Expo Go — present on the image but not what launched).
- `adb shell ps | grep exponent` → empty, Expo Go is not running.
- `cmd package resolve-activity --brief com.tsujintsujin.perchable` →
  `com.tsujintsujin.perchable/.MainActivity`.
- `dumpsys package ... | grep versionName` → `versionName=1.0.0`.
- Dev-launcher screen (see test 3) independently shows app label
  **"Perchable" / "Development Build"** — confirms custom branding, not the
  generic Expo Go shell.
- Evidence: `package-proof.txt`.
- **PASS.**

### 3. Break it
**a) Launch with Metro stopped** (killed the Metro node process, confirmed
port 8081 freed before relaunch): force-stopped app, `am start`. App did not
crash or hang — it showed the expo-dev-client **DevLauncherActivity** launcher
screen ("Perchable / Development Build", "Start a local development server
with: npx expo start", a URL input + Connect button, and a "Recently Opened"
list with the last server). This is correct dev-client behavior, not a
failure. One thing to flag: the "Recently Opened" server entry kept showing a
**green "online" dot** even while Metro was confirmed stopped (port 8081
free) — a stale status indicator, cosmetic, not a functional bug since tapping
it just re-attempts the connection.
Screenshots: `13-metro-stopped.png`, `14-metro-stopped-wait.png`.

**b) Rotate** — `settings put system user_rotation 1` (landscape). Screen
content did not rotate; app stayed pinned in portrait layout
(`04-rotated-landscape.png`). Consistent with the Expo Router default
template having no orientation config yet — **not a bug**, just noting for
later Builds where an orientation choice should be deliberate.

**c) Background / foreground** — `KEYCODE_HOME` then `am start` again. App
resumed correctly to the same index screen, no state loss, no stuck screen
(`06-foregrounded.png`). **PASS.**

**d) Clear app data, then relaunch** — `pm clear com.tsujintsujin.perchable`
then `am start`. App correctly forgot its last dev-server URL and opened the
DevLauncherActivity picker with the auto-detected LAN server
(`Perchable — http://192.168.254.102:8081`, green dot, correct this time since
Metro really was running for this test). Tapping it reconnected, showed the
dev-menu overlay ("Runtime version: exposdk:57.0.0" — confirms dev client, Expo
Go never shows a project-specific runtime version this way), dismissed with
Continue/X, landed back on the index screen. Screenshots: `07`–`12`. **PASS.**

### 4. Logcat
- Captured `adb logcat -d *:E` across the whole session → `logcat-all-errors.txt`
  (2345 lines total).
- Grep for the app's package name / pid found **no entries** in the raw
  error buffer tagged with the app's process at all by package name — but
  grepping by tag turned up real app-process errors not tagged with the
  package name (logcat tags don't always include it), see below.
- **`unknown:ReactHost: Unhandled SoftException`** — exact text:
  `com.facebook.react.bridge.ReactNoCrashSoftException: raiseSoftException(onWindowFocusChange(hasFocus = "true")): Tried to access onWindowFocusChange while context is not ready`,
  full Kotlin/Java stack in `softexception-excerpt.txt`. Occurred **3 times**,
  once per app process/launch (pids 3872, 4582, 4887 — confirmed 4582 was this
  session's cold-launch pid), each time around a window-focus change (matches
  the background/foreground and relaunch steps). It is a caught "soft"
  exception (framework's own no-crash wrapper — app did not crash, no FATAL
  or crash-buffer entry for any pid this session) but it is logged as an
  **E-level error every time**, reproducibly, tied to window focus timing.
  Reporting verbatim per team rule — not deciding myself that it's dev-only.
- **`unknown:ReconnectingWebSocket: Error occurred, shutting down websocket
  connection: Websocket exception` / `java.net.SocketException: Connection
  reset`** — occurred at the moment Metro was killed for test 3a. Expected
  given Metro was intentionally stopped; noting the exact text per the rule
  anyway.
- No `FATAL` lines, no `adb logcat -d -b crash` entries for the package —
  app never crashed this session.
- Rest of the E-level buffer (`kvm_intel`, `erofs`, `PhenotypeFlagCommitter`,
  `APM_AudioPolicyManager`, `cr_CronetUrlRequestContext`, etc.) is
  emulator/AOSP/Google-Play-services boot noise unrelated to any pid this app
  used — not our app.

### 5. Regression
Build 1 is the first Build — no earlier Build to regress. N/A.

### 6. Design check
No screens/UI built yet (default Expo Router template only) — nothing to
compare against `docs/DESIGN.md` yet. N/A for this Build.

### Bugs
None that block Done-means. One non-blocking observation (not filed as a
Bug, flagging for Ruby/Bella's judgment):
- **Build 1 · Observation 1 — Recurring `ReactHost Unhandled SoftException`
  on window-focus change.** Steps: cold-launch, then background/foreground or
  relaunch the app; check `adb logcat -d *:E`. Expected: no E-level app
  errors on a normal focus change. Actual: `ReactNoCrashSoftException:
  raiseSoftException(onWindowFocusChange(hasFocus = "true")): Tried to access
  onWindowFocusChange while context is not ready`, every time, 3/3 launches
  this session. App does not crash or visibly misbehave. Evidence:
  `logcat-all-errors.txt`, `softexception-excerpt.txt`.
- **Build 1 · Observation 2 — Stale "online" indicator on dev-launcher
  "Recently Opened" server row.** With Metro confirmed stopped (port 8081
  free), the dev-client launcher's last-used server entry still showed a
  green dot. Cosmetic (Expo's own dev-launcher UI, not app code), not
  functionally blocking — tapping it just retries.

### UNTESTABLE
None for this Build — everything in Done-means and the break-it checklist
was reachable on this Google-APIs (no Play Store) emulator image.

### Evidence
`logs/evidence/build-01/qa/` (14 PNG screenshots, `ui-devlauncher.xml`,
`package-proof.txt`, `logcat-all-errors.txt`, `softexception-excerpt.txt`).

### Verdict
**PASS** — all three Done-means checks (installed as custom dev-client,
package `com.tsujintsujin.perchable`, launches to default Expo Router screen,
confirmed not Expo Go) hold up under happy path and the break-it battery.
Two non-blocking observations logged above for Ruby to judge.

Metro stopped at end of session; confirmed port 8081 free.

## Phase 4 — Review (Ruby)
PASS with 1 should-fix: the Gradle workaround note in app CLAUDE.md was uncommitted → committed in Phase 5. Nit: stray `discord_modal.png` at repo root (Justin's, untracked — not committed). Ruby judged the recurring `ReactNoCrashSoftException(onWindowFocusChange)` a known non-fatal RN dev-mode warning, not app code.

## Phase 5 — Manager
- Gates re-run: `npx tsc --noEmit` clean. Commit 3526c6a audited: no secrets, keystores or build outputs; `android/`, `.gradle-home/`, `.env*` ignored.
- Spot re-run (Manager): started Metro, cold-launched the dev client, opened the project → bundled (1401 modules) and loaded the Expo Router `index` screen, runtime exposdk:57.0.0. First attempt showed "problem loading the project / unexpected end of stream" because the app was launched before Metro finished starting — Manager timing, not a bug. Evidence: `logs/evidence/build-01/manager-spot-check.png`. Metro stopped (time-limited), port 8081 free.
- Setup step 4 done in the same session: Google Cloud project `perchable`, Android + Web OAuth clients (SHA-1 above), test user added, Supabase Google provider enabled with both client IDs. Client secret paste pending Justin.
- Build 1: DONE.
