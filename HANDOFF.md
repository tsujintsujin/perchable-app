# HANDOFF — Perchable Manager session (updated 2026-10-02, afternoon)

Read this, then TIMELINE.md (last ~25 lines), then `logs/LESSONS.md`.
Branch for the next work: **`module/quick-add-swipe`** (create from `main` at Build 14 start).

## Where things stand
- On main: Modules 1–2 (Builds 1–9), Profile rows change (PR #6), Moderation 10a + 10b (PR #7),
  **Module 4 — movie browse/details** (Builds 12a, 12b, 13 + offline-start fix; milestone PR, 2026-10-02).
- **Plan order changed by Justin (2026-10-01):** movies first — Builds 12–16 — then
  Build 11 (terms) just before Build 20. Justin said: continue, don't wait for him, park
  anything that needs him and work on something else.
- tmdb Edge Function live with `popular` + `details` (verify_jwt on). Build 13 log has the curl list.
- **Next: Build 14 — swipe deck** (PLAN.md "Build 14", Module 5 quick-add swipe). Then 15
  (selectable swipe sequence), 16 (swipe-right adds to collection = the first "add movie").
  Steps: Dianne Phase 0 mockup if DESIGN has no Build 14 section → Manager failure-mode list
  + base SHA in `logs/build-14-*.md` → Bella. Build 14 adds gesture-handler + reanimated:
  check whether they are already installed; a new native module means a dev-build rebuild
  (Gradle recipe in CLAUDE.md / LESSONS) — schedule it so it doesn't overlap QA.
- **Watch item:** one native SIGSEGV (Fabric `MountingCoordinator::pullTransaction`) on a
  first app launch right after an emulator restart (2026-10-02); not reproduced since.
- **Emulator degrades fast:** launcher 90th-pct frames hit 300–400 ms within 9–13 min of a
  restart (twice on 2026-10-02). `ensure` catches it and restarts; worth diagnosing if it keeps
  happening (GPU path? the health swipe itself?).

## Emulator — read CLAUDE.md "Emulator setup + health" first
- `scripts/emulator.sh ensure` before device work; `scripts/emulator.sh stop` when no device
  work is next (Justin, 2026-10-02). After a PC restart run
  `adb shell cmd package compile -m verify -f com.tsujintsujin.perchable` once (cold-start ANR).
- After `TaskStop` on Metro, kill the node process still on 8081 (check its command line).
- td_emu: 720x1600 @ 280 dpi (1.75 px/dp), 3-button nav, animations off, NVIDIA GPU. Signed in
  as Justin's main account (@tsujintsujin); 2nd test account b2400254. Google sign-in is Justin's.

## Open items for Justin (none block work)
- Build 13 by hand: real-finger fast fling on Home never opens a poster; cold deep link
  `perchable://movie/603` (app killed) → The Matrix, Back → Home; signed-out deep link →
  sign-in; TalkBack: details title is a heading.
- Content policy: suggestive-but-not-adult-flagged posters in TMDB Popular. Default: no filter.
- Admin guide: run query (a) in `docs/ADMIN-MODERATION.md`; then the Manager deletes the
  4 QA test reports by SQL.
- TalkBack checks (error alerts, "Report sent", "Loading movies", Home heading).
- Module 4 NEEDS JUSTIN N1–N7 ran on defaults (PLAN.md Module 4).
- Pre-launch list: persistent ban list; Email provider off; top-right icon inset; Google
  picker cancel copy; TMDB attribution wording ("This app" vs "This application" — Rose).
- Release APK only when Justin asks (two older test APKs in `builds/`).

## Rules from this session (all in files)
- Sessions are never archived; app auto-archive-on-PR-close is OFF.
- Every new table starts with `revoke all … from anon, authenticated`.
- When the planned order makes the visible product lag, say so and offer the trade-off.
- An agent "rate limit" error is often transient: check usage, then just resume the agent.
- `discord_modal.png` at the repo root is Justin's; leave it untracked.
