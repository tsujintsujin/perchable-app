# HANDOFF — Perchable Manager session (updated 2026-10-03, night, before shutdown)

Read this, then TIMELINE.md (last ~25 lines), then `logs/LESSONS.md`.
Branch: **`module/quick-add-swipe`** (pushed). Module 5 = Builds 14, 15, 16a, 16b, 16c; milestone PR after 16c.

## Where things stand
- On main: Modules 1–2, Profile rows change, Moderation 10a+10b, **Module 4** (12a, 12b, 13 + offline fix; PR #8).
- **Build 14 DONE** (Quick Add swipe deck): a bottom tab (Perch · Quick Add · Profile), full-bleed poster,
  Skip/Undo/Add, right swipe = "coming soon" Toast (nothing stored until 16b). Log: `logs/build-14-quick-add-deck.md`.
- **Next 1: Fix — Home blank on fast fling — IN PROGRESS, resume it.** Read the "State at shutdown" section of
  `logs/fix-home-blank-scroll.md`. Baseline 11/30 fully-blank shots → 0–1/30 with two **uncommitted, ungated**
  src changes (`PosterGrid.tsx` drawDistance 2500; `usePulse.ts` shared ref-counted pulse). Left: the last blank
  shot at ~0.6 s, tests for items 2 + 4, gates, Ruby, Queenie, Manager spot re-run. Scripts in `scripts/fling*`.
- Release APK built for Justin 2026-10-03 (`builds/perchable-test-2026-10-03.apk`, Build 14 state); he is
  checking it on his phone — ask for his findings.
- **Next 2: Build 15** (order picker Newest/Oldest/Random + `discover` endpoint: Bella server commit → Ruby →
  Manager deploys + curls + sets `RANDOM_POOL_PAGES` = min(100, total_pages) in a one-line commit before QA).
  Dianne's Phase 0 for the whole module is done (boards in `logs/evidence/build-14/design/`). Failure-mode list
  F1–F19 is written in `logs/build-15-sequence-picker.md`; set its base SHA when Phase 1 starts.
- Then 16a (collection_items table + RLS, Manager applies via Management API after Ruby), 16b (swipe right adds,
  Profile count), **16c (Justin's "Watched" button on details, top right next to the gear zone)**. 16c still needs
  Dianne's design (Watched states + Toast action variant).

## Justin's decisions this session (in PLAN.md)
- N1: Quick Add is a bottom tab (not a Home row). Full-bleed poster deck.
- 16c: "Watched" button on details (defaults N13–N16: toggle with Undo, placement left of the gear zone).

## Emulator — read CLAUDE.md "Emulator setup + health" first
- `scripts/emulator.sh ensure` before device work; `scripts/emulator.sh stop` when no device work is next.
- After a fresh start: `adb shell cmd package compile -m verify -f com.tsujintsujin.perchable` (cold-start ANR).
- td_emu reports reduce motion ON (animation scales 0); QA sets scales to 1 + relaunch for full motion, restores 0.
- After `TaskStop` on Metro the node process stays on 8081: check its command line, stop it.
- Keep QA evidence small: commit only files the log names (Build 14 QA produced 170 MB; extras were moved out).

## Agent limits
- On a usage/session limit: read the reset time, resume the agent then (memory `resume-agents-after-limits`).
  If Justin said "shut down when the Build is done" and a limit hits first: save state and shut down.

## Open items for Justin (none block work)
- Content policy: suggestive-but-not-adult posters (e.g. "Zero Woman 2", now full-screen in Quick Add). Default: no filter.
- By hand: Build 13 (fast fling on Home, cold + signed-out deep link `perchable://movie/603`, TalkBack heading);
  Build 14 (real-finger flicks, gesture-nav edge swipe, TalkBack card actions/announcements, font scale 1.3).
- Admin guide query (a) in `docs/ADMIN-MODERATION.md`, then the Manager deletes 4 QA test reports by SQL.
- Pre-launch: persistent ban list; Email provider off; top-right icon inset (and Watched into the corner);
  Google picker cancel copy; TMDB attribution wording; a 4th+ tab will crowd the bar (DESIGN §2).
- Release APK only when Justin asks.

## Rules (all in files)
- Sessions are never archived; auto-archive-on-PR-close is OFF (checked 2026-10-02).
- Every new table starts with `revoke all … from anon, authenticated`.
- Before any Manager commit: `git diff --cached --name-only` (agents may have staged files).
- `discord_modal.png` at the repo root is Justin's; leave it untracked.
