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
npx expo install <pkg>  # never plain npm install for Expo packages
```

## Native Android builds — Gradle gotcha (found in Build 1)
Until 2026-09-25 this PC had a machine-wide `GRADLE_USER_HOME` pointing at
Engagia's folder, whose init script broke Expo builds ("BuildType with name
'local' not found"). **Justin deleted that variable on 2026-09-25**, so fresh
shells build normally. Shells started before then may still carry it — if the
error comes back, override for that one command (gitignored `.gradle-home/`):
```bash
GRADLE_USER_HOME="$PWD/.gradle-home" npx expo run:android
```
`npx expo run:android` leaves Metro running after install — it never exits on
its own; stop it when done. Debug keystore SHA-1 is in `logs/build-01-dev-build.md`.

## Lock
`.claude/hooks/gate.js` blocks app code until `PLAN.md` and `docs/DESIGN.md`
both contain a line starting "Approved by Justin:" — which only Justin types.

## Current Build
Build 1 — dev build boots (Module 1 Foundation, branch `module/foundation`). Stage A done 2026-09-24: RESEARCH.md, PLAN.md, DESIGN.md all signed. Stack decided: Supabase + TMDB proxy (see PLAN.md §2).
