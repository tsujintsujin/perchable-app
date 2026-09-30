# HANDOFF — Perchable Manager session (written 2026-09-30, PAUSED)

**Paused by Justin after Build 8.** Do not start Build 9 until Justin says so.
A new Manager session starts here: read this, then TIMELINE.md (last ~15
lines), then `logs/LESSONS.md`. Branch: `module/auth` (pushed to origin).

## Where things stand
- Module 2 (Auth + profile): Builds 5, 6, 7, 8 **done**. Build 9 (Delete
  account) not started. Module 2 milestone (PR → main) comes after Build 9.
- Build 7 closed at 2aef266, Build 8 closed at 008cccf. Gates at HEAD:
  tsc clean, jest 77/77, 0 act()/console warnings, lint clean.
- Details and known limits: `logs/build-07-edit-profile.md` and
  `logs/build-08-sign-out.md` ("CLOSED" sections at the end).

## Next, when Justin resumes: Build 9 (Delete account)
1. Manager writes the failure-mode list into `logs/build-09-*.md` before
   Phase 1 (per playbook): network loss mid-delete, double-tap confirm,
   Edge Function partial failure, avatar folder deletion (Storage API — no
   cascade into storage, incl. orphans from uploads finishing after sign-out),
   retry after user already deleted returns 401 → treat as done, Google
   sign-out after delete, post-delete toast, Sentry.
2. Deploy `supabase/functions/delete-account/` (committed, **not deployed**)
   with `npx supabase functions deploy delete-account` — never push config.toml.
3. Design: DESIGN.md "Build 9 — Settings screen" (Danger zone, type-DELETE
   sheet, deleting state, post-delete toast). Copy table is verbatim.
4. Queenie will need a signed-in account to delete. **Do NOT delete Justin's
   real account** — ask Justin for a throwaway Google account on td_emu first.

## Open items for Justin
- **The app on td_emu is signed out.** Sign in once yourself (Google picker)
  before the next QA run; agents don't complete an outside sign-in.
- UNTESTABLE: "That usertag is already taken." copy needs a 2nd Google account.
- Design question: backing out of the Google picker shows "Couldn't sign in.
  Check your connection and try again." (DESIGN.md:437 — one copy for cancel
  and network). Keep, or make cancel silent?
- Pre-launch: Supabase Email provider is still on (app is Google-only).

## Housekeeping
- Emulator `td_emu` is running; Metro stopped (8081 free). No agents running.
- QA screenshots go to `/data/local/tmp`, never `/sdcard` (gallery pollution
  caused the blank-avatar scare — see LESSONS.md).
- `discord_modal.png` at the repo root is Justin's; leave it untracked.
