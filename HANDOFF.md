# HANDOFF — Perchable Manager session (written 2026-09-30)

A new Manager session starts here. Read this, then TIMELINE.md (last ~15
lines), then `logs/LESSONS.md`. Branch: `module/auth` (pushed to origin).

## Where things stand
- Module 2 (Auth + profile): Builds 5, 6 done. **Build 7 (Edit profile) is
  NOT closed**; Builds 8 (sign out) and 9 (delete account) not started.
- Build 7 commits: f2244fa build · fe9932b Bug 1 · ab235cf Bug 1b · then a
  **code standards pass** 31779cf..0d31d26 (tokens, safe-area insets, one
  AuthProvider, encrypted session storage, generated DB types,
  useAvatarUpload hook, 1–2 line comments). Manager-verified: tsc clean,
  jest 29/29, no literals, no secrets.
- Ruby re-review of f2244fa..0d31d26: her 3 original Build 7 findings are
  fixed. New findings are listed below.
- Queenie's combined QA (Build 7 Bug 1/1b + standards regression) was
  **cut off by a usage limit and did not write her QA section**. Partial
  evidence: logs/evidence/build-07/ (state-check*, zoom-check).

## Do these next, in order
1. **Diagnose the blank-avatar bug (new, confirmed by Manager).** The saved
   avatar is a solid grey 512×512 JPEG: every pixel is 250 (current object
   `avatars/5d77892a…/avatar-1790637215640.jpg`, 2.3 KB). Queenie's logcat
   showed `Bitmap from LOCAL ... size [-2147483648x-2147483648]` (corrupt
   decode) on two attempts with `Pictures/test-avatar.jpg`. That image is a
   1600×1600 PIL-made JPEG the Manager pushed to the emulator gallery on
   2026-09-28. Open question: is this the test image, or the pick → crop →
   `ImageManipulator` resize path (`src/modules/profile/pickAvatar.ts`) after
   the standards pass? Try a different real photo first. If the pipeline
   fails, it's a Bug. Either way the app must never save a blank image:
   consider validating the manipulated output before upload.
2. **Bella fix batch (Build 7 · Bug 2)**, all confirmed by the Manager in code:
   a. `__tests__/useAvatarUpload-test.tsx` cancel-mid-upload test prints
      "overlapping act()" / "not wrapped in act" warnings → zero warnings.
   b. `src/lib/supabase.ts` LargeSecureStore: the old plaintext session from
      Builds 1–7 stays in AsyncStorage until the next sign-in → delete it
      when `getItem` finds a value but no SecureStore key.
   c. `src/modules/auth/AuthProvider.tsx`: stop `getSession()` resolving
      late and overwriting a newer `onAuthStateChange` session
      (Ruby: SUSPECTED, cheap to guard).
   d. Plus item 1's fix if it's a code bug.
3. Queenie: redo the combined QA from her last brief (Bug 1/1b behaviour,
   standards regression vs builds 05–07 evidence, session survives relaunch
   with encrypted storage, /debug). She must **sign in with Google** first:
   the storage change signed the user out. One proof per item.
4. Ruby re-review of Bug 2. Manager spot re-run of one flow. Close Build 7
   (log + TIMELINE), then **Build 8**: its failure-mode list is already
   written in `logs/build-08-sign-out.md`.

## Rules set by Justin in this session (all saved to files)
- **Comments:** 1–2 line purpose comment above every block; no Build/Bug
  history in code (→ `~/.claude/agents/bella.md`).
- **No shortcuts / standard practice:** tokens only, real insets, one
  source of truth, typed DB, logic in modules (bella.md "Coding standards";
  ruby.md item 3b greps for literals).
- **Manager prevents bugs, doesn't just watch:** failure-mode list before
  every Phase 1, LESSONS.md checklist, spec-trace table
  (`../CLAUDE.md` "Running a Build"; memory `manager-prevents-bugs-upfront`).
- **Keep PLAN.md order and full checks.** Justin declined the shortcuts,
  but speed matters: he asked twice why progress is slow. Keep agent
  evidence lean; usage limits are the main bottleneck (cut-offs on
  09-26, 09-28 ×2, 09-29, 09-30).

## Housekeeping
- Emulator `td_emu`: the process exited, so boot it before the next run.
  Metro is not running (8081 free).
- `supabase/functions/delete-account/` is committed but **not deployed**
  (Build 9 prep). Deploy it when Build 9 starts.
- Old avatar orphans are gone: storage holds exactly 1 object (the blank
  one above). If the service key is needed again, fetch it in memory with
  the Management API (`/v1/projects/<ref>/api-keys?reveal=true`); never save it.
- `_template/` starter kit (MobileDev, not a git repo) was written this
  session: README.md, CLAUDE-TEMPLATE.md, starter/.
- `discord_modal.png` at the repo root is Justin's; leave it untracked.
