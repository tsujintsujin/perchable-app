# CLAUDE.md — Perchable

Movie-tracking social app: browse movies, mark them watched, build a
collection with captions, follow other users, comment/DM about what they
watched, rankings. Google sign-in only. Android first, iOS later.
Portfolio piece headed for the Play Store; also the modular base for later apps.

Team rules: `D:\AIO Freelance\MobileDev\CLAUDE.md` (Manager playbook) and
`TEAM-FLOW.md`. Vision: `docs/VISION.md` (Justin's — agents never edit it).
Inspo images: `docs/inspo/`. Plan: `PLAN.md` (after Stage A).
State: `TIMELINE.md` and `logs/`.

## Stack
Expo SDK 57, Expo Router, TypeScript (empty template — no screens yet).
Routes live in `src/app/`; non-route code goes outside it. Expo's own agent
notes: `AGENTS.md`. Backend: Supabase (Auth, Postgres+RLS, Realtime, Storage, Edge Functions); TMDB via Edge Function proxy. Credentials: `D:\AIO Freelance\Credentials\perchable\.env`.

## Commands
```bash
npx expo start          # dev server (stop it when done; port 8081)
npx tsc --noEmit        # typecheck gate
npx expo lint
npx jest                # test gate (jest-expo preset) — required from Build 4 on
npx expo install <pkg>  # never plain npm install for Expo packages
```

## Native Android builds — Gradle gotcha (found in Build 1)
Until 2026-09-25 this PC had a machine-wide `GRADLE_USER_HOME` pointing at
Engagia's folder, whose init script broke Expo builds ("BuildType with name
'local' not found"). **Justin deleted that variable on 2026-09-25**, so fresh
shells build normally. Shells started before then may still carry it — if the
error comes back, override it for that one command with a **short** path
(a path inside the repo pushes native build paths past Windows' 260-char
limit — "Filename longer than 260 characters", found in Build 2):
```bash
GRADLE_USER_HOME="C:/g/perchable" timeout 1500 npx expo run:android --no-bundler
```
Run builds in the foreground (or the tool's own background mode) — a manual
shell `&` gets its Gradle daemon killed when the tool call returns.
`--no-bundler` makes the command exit after install; start Metro separately
with a time limit (`npx expo start --dev-client`).
Without `--no-bundler`, `npx expo run:android` leaves Metro running and never
exits; stop it when done. Debug keystore SHA-1 is in `logs/build-01-dev-build.md`.

## Emulator health (found in Build 4)
If a cold launch ANRs ("failed to complete startup") and logcat shows
`Verification of … took 100+ms` at tiny bytecodes/s rates, the emulator is
degraded (long uptime, stray `dex2oat64`), not the app: `adb reboot`, wait for
`sys.boot_completed=1` and for load to settle, then retest. Dismiss any
"System UI isn't responding" dialog with Wait.

## Supabase CLI — what may touch the live project
`supabase/config.toml` is the CLI's **local-dev** config (localhost site_url,
open signup, etc.). Never push it to the live project: only use
`npx supabase secrets set`, `npx supabase functions deploy <name>`, and
migrations reviewed per Build. Anything that syncs `[auth]` config would
overwrite the dashboard's Google sign-in setup (found in Build 3 review).
The CLI needs `SUPABASE_ACCESS_TOKEN` (from `Credentials/perchable/.env`).

## Lock
`.claude/hooks/gate.js` blocks app code until `PLAN.md` and `docs/DESIGN.md`
both contain a line starting "Approved by Justin:" — which only Justin types.

## Current Build
Build 1 — dev build boots (Module 1 Foundation, branch `module/foundation`). Stage A done 2026-09-24: RESEARCH.md, PLAN.md, DESIGN.md all signed. Stack decided: Supabase + TMDB proxy (see PLAN.md §2).
