# HANDOFF — Perchable Manager session (written 2026-09-30, PAUSED by Justin)

**Justin paused the work and shut the PC down; continue tomorrow.** A new
Manager session starts here: read this, then TIMELINE.md (last ~15 lines),
then `logs/LESSONS.md`. Branch: `module/moderation` (pushed).

## Where things stand
- Modules 1–2 done and on `main` (Builds 1–9), plus the Profile rows change
  (PR #6). Module 3 (Moderation) in progress on `module/moderation`.
- **Build 10a DONE** — reports + blocked_users schema and `docs/ADMIN-MODERATION.md`;
  both migrations are **applied to the live project** and verified.
- **Build 10b (report/block UI) — built, NOT closed.** Bella dfc1ccf. Manager
  gates: tsc, lint, jest 190/190, 0 warnings. Ruby reviewed: FIX NEEDED, 0
  must-fix, 3 should-fix (below). **Queenie's QA part 1 was stopped before she
  wrote anything** (only `qa-00-launch.png`) — she collided with Justin using
  the emulator. Redo it from her brief.
- **Build 11 (terms)** — designed (DESIGN.md "Build 11", boards in
  `logs/evidence/build-10b/design/`), not started. Waits on Justin (below).

## Do these next, in order
1. **Emulator first.** td_emu was overloaded (load 9–15, "System UI isn't
   responding"). Cold-boot it, wait for `sys.boot_completed=1` and load < 3
   before any work. **Never run an agent on the emulator while Justin is
   using it** — tell him when it is in use (new LESSONS line).
2. **Queenie — Build 10b QA part 1 (single user)**, from the brief in this
   session: items 1–12 plus 13–15 (docked keyboard via
   `adb shell settings put secure show_ime_with_hard_keyboard 1`, restore to
   0 after; TalkBack attributes). Her rules: nothing saved on Justin's
   profile, no sign-out/delete/Google sign-in, no report/block against his id.
3. **Bella — Build 10b · Bug 1** (batch Ruby's findings + Queenie's):
   a. extract the shimmer pulse (duplicated in `BlockedUsersScreen.tsx:129-159`
      and `profile/index.tsx:118-129`) into `src/ui` + tokens;
   b. a test that actually exercises `isInFlight()` in `BlockUserSheet.tsx:41`
      (dismiss in the same act as the Block press) — or drop the guard;
   c. README: `onReported`/`onBlocked` fire "on success while the sheet is
      still mounted";
   d. radios: add `checked: selected`; re-place focus when the sheet flips to
      the sent state (Ruby SUSPECTED — confirm with Queenie's item 15);
   e. harness: handle the profiles query `error`;
   f. keyboard fix if Queenie's item 13 shows the docked keyboard covers
      anything.
   Then Ruby re-review, Manager spot re-run.
4. **Dianne (small):** add the new tokens (`spacing[6]`, `spacing[10]`,
   `size.radioRing`, `shimmerBar.tag/button`, `type.mono`) and the null-name
   unblock error row to DESIGN.md §1.8 / Build 10b copy table.
5. **QA part 2 (needs Justin's 2nd Google account on td_emu):** report
   success, repeat report, block, blocked list filled, unblock (+ failure),
   and 10a's B3 ban proof (Manager sets `banned_until` by SQL on the 2nd
   account, Justin tries to sign in, Manager unbans). Manager removes the QA
   reports/blocks by SQL afterwards. Without the account: mark UNTESTABLE and
   close 10b on DB + Jest evidence.
6. **Build 11** once Justin answers; carry the two deferred harness items
   (Terms readout, "Simulate first comment") into its Done-means.

## Open items for Justin
- **2nd Google account on td_emu** — his attempt on 2026-09-30 failed
  because the emulator was overloaded by our QA run. Retry after step 1;
  the Manager must keep the emulator idle while he does it.
- Build 11: approve the terms wording; a contact email for the terms (or drop
  the line); keep the "Not now" button in gate mode?
- Design canvas `M5Tbev…` is "not found" under this account — where does it
  live, or start a new one?
- Run query (a) from `docs/ADMIN-MODERATION.md` once in the Supabase SQL editor.
- Manager defaults he may overturn: both new Settings rows; Build 10 split;
  terms gate also covers captions.
- Pre-launch: persistent ban list (a banned user can delete + re-register
  within ~1 h); Supabase Email provider still on; top-right icon inset;
  Google-picker cancel message; offline Profile shows skeleton ~60 s.
- "Adding movies" arrives at Build 16; he asked — reordering movies before
  moderation was offered again, not decided.

## Rules added this session (all in files)
- APK only when Justin asks (memory + LESSONS). Two test APKs are in `builds/`.
- Sessions are never archived; app auto-archive-on-PR-close is OFF.
- Google sign-in on the emulator is Justin's, or per-run explicit yes.
- Every new table starts with `revoke all … from anon, authenticated`.

## Housekeeping at pause
- Metro stopped (8081 free), no Gradle daemon, no agents running, emulator
  closed, PC shut down by the Manager at Justin's request.
- `/data/local/tmp` on the emulator holds ~113 old QA files — clear them.
- `discord_modal.png` at the repo root is Justin's; leave it untracked.
