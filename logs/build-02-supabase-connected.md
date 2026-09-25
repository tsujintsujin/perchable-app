# Build 2 — Supabase project connected (Module 1: Foundation)

- Base SHA: fa2f6b3
- Branch: module/foundation
- Done means (PLAN.md): app reads a Supabase env var and a debug screen shows "Supabase: connected" (a trivial ping succeeds) on device.

## Phase log
- Phase 0 — skipped (no UI design; debug screen only).
- Phase 1–2 — Bella: done.

## What was built
`src/lib/supabase.ts` — the app's one Supabase client (per DESIGN.md §4:
`lib/` holds cross-cutting singletons, `src/lib/supabase.ts` is the named
spot). It reads `EXPO_PUBLIC_SUPABASE_URL` and
`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from `process.env` (Expo inlines
`EXPO_PUBLIC_*` vars at build time from `.env`), throws immediately if either
is missing so a misconfigured env fails loudly at import time instead of
silently later, and exports both the `supabase` client and the two values
(so the debug screen can prove they were read without re-parsing
`process.env` itself).

`src/app/debug.tsx` — a dev-only route (`__DEV__`-gated; renders "Not
available in production builds." otherwise) with two buttons: "Check
connection" and "Simulate bad key (test)". Both call the same
`pingSupabase(url, apikey)` helper, a plain `fetch` to
`${SUPABASE_URL}/auth/v1/settings` with just an `apikey` header — Supabase's
auth-settings endpoint, not a database table. It shows "Supabase: connected"
on a 2xx response, or "Supabase: error — HTTP <status>: <body>" otherwise.
Linked from `src/app/index.tsx` via a `__DEV__`-gated `<Link href="/debug">`.

## Why this way
- **Ping target: `/auth/v1/settings`, not a table `select`.** There are no
  tables yet and RLS is on by default, so any `supabase.from(...)` call
  would either 404 (no table) or get blocked by RLS regardless of whether
  the URL/key are correct — a false negative either way. `/auth/v1/settings`
  is a GoTrue endpoint that exists on every Supabase project without setup,
  requires only a valid `apikey` header, and distinguishes exactly the two
  failure modes Done-means cares about: wrong URL (connection/DNS failure)
  vs. wrong key (401 `Invalid API key`). `supabase.auth.getSession()` was
  rejected — with no user signed in yet, it resolves from local storage
  without ever hitting the network, so it can't prove the round trip the
  brief asked for.
- **Session storage: `@react-native-async-storage/async-storage`, not
  `expo-secure-store`.** This is Supabase's own documented adapter for
  React Native/Expo. The reason isn't "SecureStore is worse" in general —
  it's a hard limit: SecureStore caps each stored value at 2048 bytes, and a
  Supabase session object (access token + refresh token + user metadata,
  each JWT itself often >1KB) routinely exceeds that, so a `persistSession`
  write can fail silently past that size. AsyncStorage has no such cap.
  Auth UI itself is Build 5 — this Build only had to get the client's
  `storage` option right so nothing has to be revisited then.
- **`react-native-url-polyfill/auto`** — supabase-js expects browser-style
  `URL`support that React Native's JS engine (Hermes) doesn't fully provide;
  Supabase's Expo quickstart requires this polyfill imported before
  `createClient` or requests fail with a `URL is not a constructor`-class
  error. Imported at the top of `src/lib/supabase.ts` so every caller gets
  it for free.
- ⚠️ **Big decision: `detectSessionInUrl: false`.** Only relevant on web —
  it makes the client look for an OAuth/magic-link session in the current
  page URL after a redirect. Native has no browser URL to parse, so leaving
  it on is a no-op at best and a wasted parse at worst. Set explicitly per
  the brief rather than left to default, so it's documented instead of
  silently correct.
- **Client construction doubles as the "env vars were read" proof.**
  `src/lib/supabase.ts` throws at import time if either env var is missing.
  `debug.tsx` imports `supabaseUrl`/`supabaseAnonKey` from that module
  (re-exported alongside the client) instead of re-reading
  `process.env` directly — getting past the import already proves the vars
  were read; re-reading `process.env` in two places would just be able to
  drift out of sync with what the client actually uses.
- **Test-only bad-key button instead of editing `.env`.** The brief asked
  for the failure path proven without permanently changing `.env`. A second
  button passes a hardcoded, obviously-fake key (`sb_publishable_invalid_...`)
  straight into `pingSupabase` for that one request only — `.env` and the
  real client are untouched, confirmed after the test by re-reading `.env`
  and by tapping "Check connection" again (see evidence).
- **`.gitignore` fix (out of the ping/client scope, but required for
  Done-means):** the existing `.env*` rule silently ignored
  `.env.example` too, so the committed example file the brief requires
  would never have made it into git. Added `!.env.example` right after that
  line to un-ignore just that one file.

## Concepts learned
- **`EXPO_PUBLIC_*` env vars are build-time, not runtime.** They're inlined
  into the JS bundle wherever `process.env.EXPO_PUBLIC_X` appears, by Metro,
  at bundle time — not read from the device's environment when the app
  runs. Changing `.env` requires a Metro/bundle restart to take effect, not
  just an app reload.
- **A Gradle CMake configure cache can go stale across a `GRADLE_USER_HOME`
  change.** Native modules configured with CMake (`react-native-screens`,
  etc.) cache absolute paths from `GRADLE_USER_HOME` under
  `node_modules/<pkg>/android/.cxx/`. Switching `GRADLE_USER_HOME` without
  clearing those `.cxx` folders leaves ninja pointed at paths from the old
  home, not the new one — deleting `.cxx` forces CMake to reconfigure
  against the current env. See ⚠️ below.
- **Windows' 260-character path limit is a real native-build constraint on
  this project.** `GRADLE_USER_HOME` nested under the long
  `D:\AIO Freelance\MobileDev\perchable_app\` path pushed a generated prefab
  header path past 260 chars and failed the build outright
  (`Filename longer than 260 characters`) — a short, drive-root path like
  `C:\g\perchable` avoids it.
- **`adb reverse tcp:8081 tcp:8081` beats a LAN IP for emulator↔Metro.** The
  dev client's auto-detected LAN address can go stale (the QA note in Build
  1 already flagged the "recently opened" server's stale online indicator);
  binding the device's own `localhost:8081` through `adb reverse` to the
  host's Metro is the same trick `adb` uses for real devices over USB, and
  it doesn't depend on the PC's current LAN IP at all.

## ⚠️ Big decision (environment, not app code): Gradle rebuild took three attempts
Adding `@react-native-async-storage/async-storage` (native code) required
rebuilding the dev-client APK (`npx expo run:android`). Three attempts, all
environment/process issues rather than app-code bugs:
1. Proactively set `GRADLE_USER_HOME` to a folder *under the project path*
   (per the old Build 1 workaround note) before confirming it was still
   needed — this pushed a generated native header path past Windows' 260-char
   limit and failed the build. The machine-wide `GRADLE_USER_HOME` that
   caused Build 1's problem was fixed by Justin on 2026-09-25 per this app's
   CLAUDE.md, but this shell still inherited the old value from before that
   fix, so an override was in fact still needed — just not one nested inside
   the long project path.
2. Retried with a short `GRADLE_USER_HOME` (`C:/g/perchable`) but started
   Gradle with a manual shell `&` inside a tool call whose process tree gets
   reaped when that call returns — the daemon "disappeared unexpectedly"
   mid-build. Fix: use the harness's own background-execution mode instead of
   a manual `&`, which keeps the process alive across calls.
3. Same short `GRADLE_USER_HOME`, correct backgrounding — but the first
   attempt's failed build had already written a `.cxx` CMake configure cache
   under `node_modules/react-native-screens/android/.cxx` (and others)
   referencing the old long path. Cleared all `.cxx` folders under
   `node_modules/` and `android/`, stopped the stale Gradle daemon holding
   file locks on the old `.gradle-home/`, then reran — **BUILD SUCCESSFUL in
   8m 3s**, fresh APK installed (`lastUpdateTime` confirmed via
   `dumpsys package`).

Flagging for the Manager: any future Build in this app (or another MobileDev
app on this PC) that needs a native rebuild should use a short,
drive-root `GRADLE_USER_HOME` (not nested under the project path) and the
harness's background-execution mode (not a manual `&`) from the start.

## Gates
- `npx tsc --noEmit` — clean.
- `npx expo lint` — clean.
- Tests — none exist yet (none planned until Module 7 per PLAN.md).
- App starts — `npx expo run:android --no-bundler` installed the rebuilt
  dev-client APK; `npx expo start --dev-client` (Metro) bundled
  `node_modules/expo-router/entry.js` (1459 modules) and the app loaded to
  the `index` screen with the "Debug: Supabase" link, on `td_emu`.

## Evidence
- `logs/evidence/build-02/connected.png` — debug screen after "Check
  connection" against the real Supabase project (`.env`'s actual URL/key):
  "Supabase: connected".
- `logs/evidence/build-02/error.png` — same screen after "Simulate bad key
  (test)": "Supabase: error — HTTP 401:
  {"hint":"Double check your API key.","message":"Invalid API key"}" — proves
  the failure path shows status + message, and that `.env` itself was never
  touched (re-tapped "Check connection" afterward and it returned to
  "connected", confirmed in-session; `.env` contents also diffed
  unchanged).

Metro stopped at end of session (`Stop-Process` on the Metro node PID);
`netstat` confirmed port 8081 no longer `LISTENING` (only `TIME_WAIT`
remnants). `adb reverse tcp:8081` removed. Emulator left running per team
rule.
