# HANDOFF — Perchable Manager session (updated 2026-10-02, early morning)

Read this, then TIMELINE.md (last ~25 lines), then `logs/LESSONS.md`.
Branch: **`module/movie-browse`** (pushed; PR to main at the Module 4 milestone).

## Where things stand
- On main: Modules 1–2 (Builds 1–9), Profile rows change (PR #6), Moderation 10a + 10b (PR #7).
- **Plan order changed by Justin (2026-10-01):** movies first — Builds 12–16 — then
  Build 11 (terms) just before Build 20. Justin is away and said: continue, don't wait for
  him, park anything that needs him and work on something else.
- **Build 12a DONE** (Home poster grid; tmdb Edge Function **v3 deployed**).
- **Build 12b DONE** (infinite scroll + pull-to-refresh).
- **Fix: offline cold start DONE (2026-10-02)** (`logs/fix-offline-startup.md`, last commit
  16b0184 + Manager close). Requests bounded by 8 s via `src/lib/requestTimeout.ts`; home-test
  flake fixed at the cause (React Query notifications through act).
- **Watch item:** one native SIGSEGV (Fabric `MountingCoordinator::pullTransaction`) on the
  first app launch right after an emulator restart; relaunch fine, not reproduced. If it
  recurs, capture the full tombstone (`adb logcat -d`, F DEBUG lines).
- **Next: Build 13 — movie details** (PLAN.md Module 4 "Build 13", DESIGN.md "Build 13",
  boards rendered in `logs/evidence/build-12a/design/build-13-*.png`). Failure-mode list is
  already in `logs/build-13-movie-details.md` (a0f508d). First step: record the base SHA there,
  then brief Bella. Server work: new `details` endpoint in `supabase/functions/_shared/tmdb.ts`
  (own commit; Ruby reviews; the Manager deploys + curls; never Bella).
- Then Builds 14–16 (swipe deck → swipe-right adds to collection = first "add movie").

## Emulator — read CLAUDE.md "Emulator setup + health" first
- Run `scripts/emulator.sh ensure` before any device work (restarts only if unhealthy,
  waits to settle, recovers adb). Jest: `npx jest --maxWorkers=50%`. Never overlap a
  Queenie run with a full jest suite / Gradle build.
- td_emu: 720x1600 @ 280 dpi (1.75 px/dp), 3-button nav, animations off, 16 Google apps
  disabled, NVIDIA GPU (Justin set the Windows preference). Signed in as Justin's main
  account (43fae9b2, @tsujintsujin). A 2nd test account exists (b2400254,
  tsujin.giamas.p@gmail.com). Google sign-in on the emulator is Justin's step.

## Open items for Justin (none block work)
- NEEDS JUSTIN: suggestive-but-not-adult-flagged posters appear in TMDB Popular (Play
  content policy). Default: no extra filtering.
- Admin guide: run query (a) in `docs/ADMIN-MODERATION.md`; then the Manager deletes the
  4 QA test reports by SQL.
- TalkBack checks (error alerts, "Report sent", "Loading movies", Home heading).
- Module 4 NEEDS JUSTIN N1–N7 run on defaults (PLAN.md Module 4).
- Pre-launch list: persistent ban list; Email provider off; top-right icon inset; Google
  picker cancel copy; TMDB attribution wording ("This app" vs "This application" — Rose).
- Release APK only when Justin asks (two test APKs in `builds/`).

## Rules from this session (all in files)
- Sessions are never archived; app auto-archive-on-PR-close is OFF.
- Every new table starts with `revoke all … from anon, authenticated`.
- When the planned order makes the visible product lag, say so and offer the trade-off.
- `discord_modal.png` at the repo root is Justin's; leave it untracked.
