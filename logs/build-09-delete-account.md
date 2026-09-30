# Build 9 — Delete account (Module: Auth)

Base SHA: 5ac8786 (recorded 2026-09-30, Phase 1 start)
Phase 0: design done earlier (DESIGN.md "Build 9 — Settings screen", board v6).
QA account (Justin, 2026-09-30): delete the current test profile @justin94test.
Justin signs in on td_emu himself when QA is ready — agents don't complete Google sign-in.

## Failure-mode list (Manager, before Phase 1) — each is a Done-means line + a test
1. **Confirm gate** — Delete button disabled until the input is exactly `DELETE`
   (case-sensitive; "delete", " DELETE", "DELETE " stay disabled). Cancel dismisses, no call.
2. **Double tap Delete** — one Edge Function call; button shows "Deleting…", Cancel
   disabled, sheet can't be dismissed (drag/back) mid-delete.
3. **Offline / network error** — the sheet returns to its confirm state with an error the
   user can see (no copy in DESIGN.md → use the existing generic error pattern and flag it);
   nothing deleted client-side; retry works. Offline is expected → not sent to Sentry.
4. **Partial server failure** — function deletes storage first, then the auth user; a retry
   after a 500 must succeed. Retry after the user is already deleted returns 401 (token's
   user gone) → the app treats 401 **from this call** as done: clear locally, land on sign-in.
5. **Storage cleanup completeness** — `list()` returns at most 100 objects per call; the
   function must loop until the `avatars/<uid>/` folder is empty (orphans from cancelled or
   post-sign-out uploads included). Test with >1 object.
6. **After success** — local session cleared (reuse `clearSession` latch path), Google
   `signOut()` so the next sign-in shows the picker, profile data gone from every screen,
   post-delete toast "✓ Your account was deleted." shown once on the sign-in screen.
7. **Leave mid-delete** — app backgrounded/closed during the call: on return the app is
   either still signed in (delete failed) or signed out (delete done) — never a stuck
   "Deleting…" sheet or a crash from setState after unmount.
8. **Sign back in** — same Google account afterwards creates a **fresh** profile (new uid,
   no usertag/avatar) — PLAN.md Build 9 done-means.
9. **Security** — function derives uid only from the caller's JWT, never the body;
   `verify_jwt` on; error responses never echo internals; service-role key only in the
   function env. No client code path can delete another user.
10. **Sentry** — real failures reported with `environment`; user cancel / offline not reported.

Deploy (Manager, after Bella's function changes are reviewed): `npx supabase functions deploy
delete-account` only — never push config.toml.

Plus `logs/LESSONS.md` checklist and the spec-trace table (DESIGN.md "Build 9" — Danger
zone, delete-confirmation, deleting, post-delete landing, copy table) before commit.
