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

---
# QA (Queenie) — 2026-09-30, HEAD ca1e96f, td_emu, dev build, Justin's real profile (nothing saved/changed)

Evidence: `logs/evidence/change-2026-09-30/qa-*`. Metro started by me (PID 24956), stopped, 8081 confirmed free.

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | Layout vs DESIGN Build 6 | PASS | qa-01-profile-layout.png, qa-01-ui.xml |
| 2 | Chip opens Edit; usertag field focused + keyboard | FAIL (opens, NOT focused, no keyboard) | qa-02-chip-opens-edit.png, qa-02b-back-to-profile.png |
| 3 | Settings chip -> Settings -> Edit; back x2 | PASS | qa-03a..03d |
| 4 | Double tap (4 chained taps) chip and Settings chip | PASS | qa-04a..04d |
| 5 | Accessibility of usertag chip | PASS (see note on Settings chip label) | qa-01-ui.xml |
| 6 | Loading state | PASS (frame captured) | qa-06-loading.png |
| 7 | Load-error + Retry | PASS | qa-07a..07d |
| 8 | Regression Settings / Edit / tab bar | PASS | qa-03a, qa-03b vs build-08/qa-02, build-09/qa-01 |
| 9 | Logcat | PASS, nothing from Perchable JS | qa-09-logcat-errors.txt |

## Details
1. No "Edit profile" row, no "Settings" row. Order: header, avatar, name, chip, "0 movies watched", dashed grid container. UI dump (2.625 px/dp): chip bounds y 745-871 (126 px = 48 dp); "movies watched" text top y 934 -> gap chip-to-row = 63 px = **24.0 dp**. Grid container is not in the a11y tree; from the screenshot, count text bottom y 981 -> dashed grid top y ~1014 = ~33 px = **~12.6 dp** (within measuring error of 12; the text line box adds a couple px). Screenshot matches the spec's order.
2. Tap on `@tsujintsujin` chip opens "Edit profile" (once). Usertag field is **not focused and no keyboard**: `dumpsys input_method` `mInputShown=false`; screenshot shows no caret/keyboard. DESIGN.md Build 6 says "(usertag field focused)" for both chips. Bella disclosed this in her log (needs a route param + autoFocus in edit.tsx). It is a spec gap, not a regression: the empty chip never focused either. **Build N · Bug 1 — Chip opens Edit without focusing the usertag field** (Manager/Priya decision: implement, or amend DESIGN.md). Back returned to Profile, nothing saved.
3. Settings chip -> Settings; "Edit profile photo / usertag" -> Edit; Back -> Settings; Back -> Profile. All screenshots read.
4. 4 chained `input tap` on chip in one adb call: one Back returned to Profile (qa-04b). Same for Settings chip: one Back returned to Profile (qa-04d). No stacked screens.
5. Chip: `clickable=true`, content-desc "Edit usertag, currently @tsujintsujin", bounds 330x126 px = 125.7 x 48 dp (>= 44). **Observation (not caused by this change, for Ruby to judge):** the header Settings chip's content-desc is the literal glyph "⚙" (bounds 818,136-912,231 = 36 dp wide), i.e. a screen reader reads a symbol, not "Settings"; and it is 36x36 dp, below 44 dp (DESIGN specifies 36x36 for this chip). Not tested against history.
6. Cold launch, tapped Profile tab, burst screencaps: one frame caught the skeleton: avatar circle, name bar, usertag bar, then one "movies watched" bar; no row shimmers. Gap usertag bar to count bar ~106 px = ~40 dp (the usertag shimmer sits in a 48 dp min-height slot, as Bella wrote); fine.
7. With wifi+data off, Profile already open showed cached data (no error). Force-stop + relaunch offline (Metro via `adb reverse` + localhost, since 10.0.2.2 is unreachable offline): skeleton for ~60 s, then "Couldn't load your profile / Check your connection and try again. / Retry" with the owl icon, copy verbatim (qa-07c). Network on, Retry tapped: profile loaded (qa-07d). Note: error took about a minute to appear after skeletons (long request timeout) — not from this change, mention to Ruby if it matters.
8. Settings screen identical to build-09/qa-01-settings-danger.png (all rows, Danger Zone, version). Edit profile screen renders normally (avatar + camera badge, USERTAG field, hint, Cancel/Save disabled). Tab bar fine on every screen. After-Save refresh not tested (would write Justin's usertag; not allowed).
9. `logcat *:E` (295 lines): nothing from app JS. Seen, all known harmless / environment: `ReactHost: ReactNoCrashSoftException ... Tried to access onWindowFocusChange while context is not ready` (dev-client startup), `ReactNative: Unable to display loading message because react activity isn't active` x2 (dev-client reload), `ReconnectingWebSocket: Software caused connection abort / Websocket exception` x3 (Metro socket while I toggled wifi), plus emulator audio/wifi/netd/TaskPersister/GCM noise. Reported verbatim per rule; judgement is Ruby's.
No on-screen warnings/banners seen in any screenshot.

Bug list: **Build N · Bug 1** (item 2 above). No other failures.
Untestable here: empty-usertag chip state on device (Justin's profile has a usertag; jest-only), Save-then-Profile refresh.
