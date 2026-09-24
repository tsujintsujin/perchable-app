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
