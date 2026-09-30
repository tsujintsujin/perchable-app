# HANDOFF — Perchable Manager session (written 2026-09-30)

**Module 2 (Auth + profile) is complete and merged to `main`.** Next is
Module 3 (Moderation base), Build 10 — not started. A new Manager session
starts here: read this, then TIMELINE.md (last ~15 lines), then
`logs/LESSONS.md`.

## Where things stand
- Modules 1–2 done: Builds 1–9. Gates at the merge: tsc clean, jest 123/123,
  0 act()/console warnings.
- Build logs with "CLOSED" sections: `logs/build-07-edit-profile.md`,
  `logs/build-08-sign-out.md`, `logs/build-09-delete-account.md`.
- `delete-account` Edge Function is deployed (v2, verify_jwt on).
- Test APK for Justin: `builds/perchable-test-2026-09-30.apk` (gitignored).

## Next: Module 3 — Build 10 (Moderation schema + UI)
1. New branch `module/moderation` from `main`.
2. PLAN.md Modules 3–12 are one-liners: bring `priya` in to detail Module 3
   (Builds 10–11) before anything else; `ruby` reviews; Manager checks.
3. Phase 0: `dianne` mockup for the report/block UI (none exists yet).
4. Manager writes the failure-mode list into `logs/build-10-*.md` before
   Phase 1; brief Bella with it + LESSONS.md.
5. The `reports` / `blocked_users` migration is reviewed by the Manager
   before it is applied to the live project; RLS tested in a rolled-back
   transaction (pattern: `supabase/tests/`).

## Open items for Justin
- td_emu is signed in with a **fresh** profile (no usertag) — the old
  @justin94test was deleted in Build 9 QA, as agreed.
- Google sign-in on the emulator: Justin does it, or says yes per test run.
- Check on a real phone: with the full keyboard open, the delete-confirm
  input and buttons stay visible.
- "That usertag is already taken." copy needs a 2nd Google account to test.
- Design question: backing out of the Google picker shows "Couldn't sign in.
  Check your connection and try again." (DESIGN.md:437). Keep, or silent?
- Pre-launch: Supabase Email provider is still on (app is Google-only).

## Housekeeping
- Emulator `td_emu` running with the dev build; Metro stopped (8081 free);
  no agents or Gradle daemons running.
- QA screenshots → `/data/local/tmp`, never `/sdcard`.
- Release APK: see the last line of LESSONS.md (one Gradle run at a time).
- `discord_modal.png` at the repo root is Justin's; leave it untracked.
