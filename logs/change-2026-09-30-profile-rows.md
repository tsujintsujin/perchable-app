# Change — My Profile: remove Edit profile + Settings rows (Justin, phone test 2026-09-30)

Base SHA: cbbc3b6 · branch `fix/profile-header`
Justin: "settings button is already at the top right, no need to show a button on the profile
page. edit profile also should not be here, just the movies watched." Top-right icon position:
unchanged at his choice ("if it's convenient in development phase, I won't push you to change it").
Spec: DESIGN.md Build 6 (layout, loading state, copy table), Build 7 route note, Build 9 first
Account row, §8 Changes line.

## Failure-mode list (Manager, before Phase 1) — each is a Done-means line + a test
1. **Edit stays reachable** — usertag chip pushes `/profile/edit` in BOTH states (empty
   "add a usertag" and `@usertag`); Settings → "Edit profile photo / usertag" still pushes it.
2. **Settings stays reachable** — header Settings chip still opens Settings (only entry now).
3. **Double tap** on the usertag chip or Settings chip pushes one screen, not two.
4. **Loading state** matches the new layout (no row shimmers; "movies watched" bar shimmer).
5. **Accessibility** — `@usertag` chip has role button, a label that says what it does, and a
   ≥44dp tap height; nothing else lost its label.
6. **No leftovers** — removed rows' styles, imports, copy strings and tests are gone; no
   dead code; spacing uses tokens (24 / 12 from the scale).
7. **Regression** — load-error state and Retry unchanged; Edit profile and Settings screens
   unchanged; after Save in Edit, Profile shows the new usertag/photo.
