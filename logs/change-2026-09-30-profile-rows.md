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

---
# Bella — build (base e22e0b0)

## What was built
My Profile no longer has the "Edit profile" and "Settings" rows. The usertag chip is now the one
edit entry: a single `Pressable` in both states (empty "add a usertag" / `@usertag`) that pushes
`/profile/edit`. The header Settings chip is unchanged and is the only Settings entry. Spacing
follows DESIGN.md: chip, 24, "N movies watched", 12, grid. The loading skeleton lost its two row
shimmers and gained a "movies watched" bar at the same 24 gap. Settings' "Edit profile photo /
usertag" row was verified, not changed (still `router.push("/profile/edit")`, existing test).

## Why this way
- One chip, one behaviour: the two states differ only in the text inside, so one `Pressable` with
  one `onPress` cannot drift between states.
- Double tap: `router.push` from a fast double tap stacks two screens. A ref flag set on the first
  push and cleared by `useFocusEffect` when the screen regains focus lets one push through per
  focus. A ref (not state) because the second tap arrives before a re-render. Covers both chips.
- Tap height: existing token `size.minTouch` (48dp, above the 44 spec); no new token.
- Top-right icons untouched (Justin's choice). No `__DEV__` switch.
- Loading: the usertag shimmer sits in a `minHeight: size.minTouch` slot so the layout does not
  jump when the 48dp chip replaces it.

Concepts used: `useFocusEffect` (runs when a screen regains focus, unlike `useEffect`, which runs
on mount), `Pressable` + `accessibilityRole/Label`, refs for values read inside handlers.

Note: DESIGN says Edit opens "with the usertag field focused". The empty chip never did this
(plain `push("/profile/edit")`, and `edit.tsx` has no focus param), so `@usertag` does the same.
On device Edit opened with no keyboard. Not built here (out of scope): needs a route param plus
`autoFocus` in `edit.tsx`, a Manager/Priya call.

## Spec-trace (DESIGN.md line -> code)
| DESIGN.md line | Implemented at |
|---|---|
| No entry rows (Build 6; §8 Changes) | removed rows block; `src/app/(tabs)/profile/index.tsx:87-89` chip then count |
| Settings chip is the only Settings entry | `index.tsx:44-51` (unchanged) |
| Chip tappable, both states, pushes edit | `index.tsx:70-87` |
| Same 44px-min tap height | `index.tsx:156` (`size.minTouch`) |
| Empty copy "No usertag yet — add a usertag" | `index.tsx:83-85` |
| 24px chip -> count | `index.tsx:168` |
| 12px count -> grid | `index.tsx:176` |
| Loading: avatar, name, usertag bars, count bar at 24, no rows | `index.tsx:113-121`, styles `190-192` |
| Load-error state unchanged | `index.tsx:53-58` (unchanged) |
| Build 7 route note / Build 9 Settings row | `settings.tsx:62` (verified, unchanged) |

## Failure-mode items -> handling and test (`__tests__/profile-test.tsx`)
1. Edit reachable: chip pushes `/profile/edit` in both states. Tests "empty-usertag chip pushes...", "@usertag chip pushes..."; Settings row: existing `settings-test.tsx` "opens Edit profile from the first row".
2. Settings reachable: test "the header Settings chip is the only Settings entry and opens Settings".
3. Double tap: `pushedRef` + `useFocusEffect`. Test "a double tap pushes once, and tapping works again after focus returns" (two chip taps + Settings tap = 1 push; after focus, works again).
4. Loading: no rows / no loaded content; test "loading state shows no entry rows...". Shimmer bar shape checked on code, not pixel-tested.
5. Accessibility: role button + labels "Add a usertag" / "Edit usertag, currently @x" (found via `getByRole` name in tests), `minHeight >= 44` asserted.
6. Leftovers: `rows`, `row`, `rowLabel`, `shimmerRow` styles and the two row texts removed; the old test assertions now assert the rows are absent. Spacing tokens only.
7. Regression: load-error + Retry test untouched and passing; Edit/Settings files untouched. Save-then-profile-shows-new-tag not re-run on device (would write a usertag; told not to).

## LESSONS checklist
Spec-trace: done. Copy verbatim: yes. Async/failure paths: navigation only; double tap handled, no setState after unmount. Sentry: n/a. Server/orphans: n/a. act() warnings: 0 (`grep -c "act("` on jest output = 0), console output 0. Android blur: n/a. Tokens: no new literals (existing shimmer/settings-chip literals from before were left, out of scope). Insets: unchanged. `fontWeight`: none. Comments: purpose-only. Testing env: screenshots to `logs/evidence/`, none to /sdcard.

## Gates
tsc exit 0 · `npx expo lint` exit 0, no output · `npx jest`: 19 suites, 128 tests passed, 0 failed, 0 "act(", 0 console.

## Device (td_emu, dev build, signed in, Metro started by me and stopped; 8081 free)
Profile shows no rows: `logs/evidence/change-2026-09-30/bella-profile.png`. Chip tap opens Edit; back; header
Settings chip -> Settings -> "Edit profile photo / usertag" -> Edit:
`logs/evidence/change-2026-09-30/bella-settings-to-edit.png`. The profile already had usertag
`@tsujintsujin` (brief said none), so the on-device chip test was the `@usertag` state; the empty
state is covered by jest only. Nothing saved.
