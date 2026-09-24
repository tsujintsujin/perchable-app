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
notes: `AGENTS.md`. Backend: not decided — Rose researches it in Stage A.

## Commands
```bash
npx expo start          # dev server (stop it when done; port 8081)
npx tsc --noEmit        # typecheck gate
npx expo lint
npx expo install <pkg>  # never plain npm install for Expo packages
```

## Lock
`.claude/hooks/gate.js` blocks app code until `PLAN.md` and `docs/DESIGN.md`
both contain a line starting "Approved by Justin:" — which only Justin types.

## Current Build
None. Phase 0 done; next is Stage A (Rose → research brief).
