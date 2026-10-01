# Build 10b — Report/block UI (Module: Moderation base)

Base SHA: d4570c8 (recorded 2026-09-30, Phase 1 start). Phase 0 done: DESIGN.md "Build 10b",
boards rendered by the Manager (`logs/evidence/build-10b/design/`).
Plan: PLAN.md "Build 10b" C1–C9. Schema is live (Build 10a); types are regenerated.

## Manager decisions where DESIGN.md and PLAN.md differ (DESIGN wins; both noted)
- Sent/blocked states stay open until the user taps **Done** (PLAN said "then closes") — gives
  screen readers time; `onReported`/`onBlocked` fire on success, `onClose` on Done.
- The details box appears **only for "Something else"** (PLAN allowed optional details for every
  reason). The DB still accepts null details.
- Unblock uses the inline two-tap confirm in the row (DESIGN).

## Failure-mode list (Manager, before Phase 1) — each is a Done-means line + a test
PLAN.md's "Failure modes to cover" for 10b apply in full (report, block, signed-out/account
switch, Sentry, security, cleanup). In addition:
1. **Insert shape** — `reports` and `blocked_users` inserts never chain `.select()` and never
   use `.upsert()` (42501 on reports). Jest asserts the exact call.
2. **23505** — repeat report → "sent"; repeat block → "blocked"; neither goes to Sentry.
3. **23503** (user no longer exists) and **42501** → error state, no crash; reported to Sentry
   without the details text.
4. **Empty world** — the live project has ONE user today. Harness with no other profiles shows a
   clear "no other profiles yet" state, no query errors; Blocked users shows the empty state.
5. **Busy states** — every async control has a ref guard (double tap = one request) and no
   setState after unmount; a cancelled/unmounted submit never applies its result.
6. **Back / scrim / Cancel** — dismissable when idle; ReportSheet cancel works mid-submit;
   BlockUserSheet is not dismissable while blocking (DESIGN).
7. **Details input** — 500-char cap enforced in the UI with the counter; whitespace-only counts
   as empty; keyboard does not cover the input or the buttons (check on device).
8. **Owner-tagged cache** — blocked list under user A is never shown to user B; cleared on sign-out.
9. **Harness isolation** — assigned at module scope `const Harness = __DEV__ ? require(...).X : null`;
   no query before the `__DEV__` return; bundle check has a control: marker string present in a
   dev export, absent from `npx expo export --platform android`.
10. **Nothing wired to product surfaces** except the Settings "Blocked users" row.
11. **Accessibility** — sheet controls have roles/labels, radios announce selected state, error
    cards are alerts, targets ≥ 48dp (DESIGN "Build 10b" accessibility notes).
12. **Settings regression** — row order per DESIGN (Edit profile · Comments · Blocked users ·
    Sign out; the Terms row is Build 11 — do NOT add it now); Sign out and Delete still work.

On-device report/block/unblock against another user is UNTESTABLE until Justin's second Google
account exists (also unblocks 10a's B3 ban proof).

---
# Phase 1-2 — Bella (build + gates)

Base SHA e6a7800, branch `module/moderation`. All code in `src/modules/moderation/`.

## What was built
- **Report**: `ReportSheet` opens as an in-screen overlay (`SheetShell`, copied from the Delete sheet's
  pattern: Modal + scrim + flat surface). The user picks one of seven reasons (from
  `OBJECTIONABLE_CATEGORIES`, the single list Build 11 will reuse). "Something else" reveals a required
  details box. Send calls `useReportContent`, which does one bare `insert` into `reports` and maps the result:
  success and 23505 both go to "sent"; anything else goes to the error card. The hook keeps a ref guard
  (double tap = one request), a run counter (Cancel mid-submit makes the late result be ignored) and a mounted ref.
- **Block**: `BlockUserSheet` + `useBlockUser` follow the same shape; 23505 counts as blocked; blocking yourself is
  refused in the hook before any request. Dismissal is inert while the write runs.
- **Blocked users**: `useBlockedUsers` loads the caller's blocks, then reads `profiles` by id (the FK points at
  auth.users, so nothing to embed). Its state is tagged with the owner id, and a `userRef` drops any result that
  arrives for a user who is no longer signed in, so nothing crosses accounts or survives sign-out. `unblock` is
  per-row (a busy list, a failed id). `BlockedUsersScreen` shows loading / empty / filled / confirm / unblocking /
  unblock failed / load error; the confirm is inline and only one row is open at a time. The route file only renders it.
- **Settings**: one new row, "Blocked users", between Comments and Sign out. No Terms row.
- **Dev harness**: `ModerationDevHarness`, required in `debug.tsx` at module scope behind `__DEV__`, not exported
  from the module index. It runs no query before the `__DEV__` return (the query lives inside the harness, which
  only mounts after it).

## Why this way
- Shared `SheetShell` / `SheetSuccess` instead of two copies of the overlay: the sheets differ only in body and buttons.
- Sentry gets a *new* `Error("<action> failed: <SQLSTATE>")`, never the Supabase error: a check-constraint
  error echoes the failing row, which includes the report details. No SQLSTATE = offline = not reported.
- Refs for guards (not state), same as `useDeleteAccount`.
- No new dependency. The harness's random uuid is 6 lines on `crypto.getRandomValues` (already polyfilled).

## Concepts learned
Modal overlays and `KeyboardAvoidingView` on Android; owner-tagged async state plus a "who is signed in now" ref;
why `.insert()` without `.select()` matters when a table has INSERT but not SELECT; how `__DEV__` + `require`
lets Metro drop a module from the release bundle; RNTL quirk: `fireEvent` returns the handler's promise, so an
`act(async () => fireEvent.press(...))` around a pending request never resolves (use `void`).

## Manager decisions honoured
Sent/blocked stay open until Done; details box only for "Something else"; inline two-tap unblock.

## Spec-trace (DESIGN.md "Build 10b" -> file:line)
| Spec line | Where |
|---|---|
| Sheet: overlay, scrim tap = Cancel | SheetShell.tsx:50-58 |
| Flat `bg.elevatedFlat`, hairlineStrong border top/sides, radius xl, elevation.modal, no blur | SheetShell.tsx:89-99 |
| Drag handle, 16 below top, 16 gap; padding 16/20/24 + inset | SheetShell.tsx:64, 89-108 |
| Body scrolls above `sheetMaxHeightRatio`, buttons pinned | SheetShell.tsx:62-64, 73-76 |
| Title `subhead`, body text roles | SheetShell.tsx (title style), ReportSheet.tsx:150 |
| Buttons equal width, 10px gap, Cancel left | ReportSheet.tsx (`buttons` style), BlockUserSheet.tsx (`buttons` style) |
| Report title per type (4 rows) | ReportSheet.tsx:14-19 |
| Subhead / Cancel / Send / Sending / Try again / error / sent copy | ReportSheet.tsx:20-32 |
| Reason row: 48, radius sm, input fill, hairline, radio 22 + ring 2, gap 12, selected gold tint/border/dot | ReportSheet.tsx:157-183 |
| Single select, tap keeps selection | ReportSheet.tsx:110 |
| Details only for "Something else": label, 96 input, 500 cap, counter, focus border | ReportSheet.tsx:121-140, 190-205 |
| Send disabled until reason (+ non-blank details for other) | ReportSheet.tsx:61, 90 |
| Submitting: list+input dimmed and inert, "Sending…", Cancel/scrim active | ReportSheet.tsx:99-100, 109, 126, 88-89, 65-68 |
| Sent (also 23505), Done, no auto-close, onReported on success | ReportSheet.tsx:70-74; useReportContent.ts:40-53 |
| Error: ErrorCard, choices kept, "Try again" | ReportSheet.tsx:87, 143 |
| Self-report renders nothing + onClose | ReportSheet.tsx:50-57 |
| Block copy (title, 2 bodies, buttons, error, blocked title/body) | BlockUserSheet.tsx:10-22 |
| Block = destructive; blocking: Cancel disabled, scrim/back inert | BlockUserSheet.tsx:37-41, 55-67 |
| Blocked state, Done, 23505 also | BlockUserSheet.tsx:45-49; useBlockUser.ts:38-46 |
| Settings row order | settings.tsx:64-70 |
| Blocked users: header, back chip 36, intro, rows 12 apart | BlockedUsersScreen.tsx:61-77, 93, 186-197 |
| Row: card, avatar md, name 1 line, tag line omitted when null, "Perchable user", 48dp Unblock | BlockedUserRow.tsx:35-58 |
| Inline confirm, gold border, one open at a time, copy | BlockedUserRow.tsx:38, 63-72; BlockedUsersScreen.tsx:50-58 |
| States: shimmer x3 / empty / load error + Retry / unblocking / unblock failed card | BlockedUsersScreen.tsx:79-121, 141-160 |
| Harness: marker, picker, 4 report buttons, block, result, no-profiles state | ModerationDevHarness.tsx:71-114 |
| Harness loaded at module scope behind `__DEV__` | debug.tsx:14-16, 144 |
| A11y: modal container, title focus, scrim "Close", radiogroup/radio/selected, details label+hint, alert cards, live regions | SheetShell.tsx:43,56,61; ReportSheet.tsx:99-110, 134-135; SheetSuccess.tsx:18; ErrorCard |
| §1.8 tokens | tokens.ts (goldTint, border.gold, size.radio/radioDot/radioRing/badge/detailsInput/sheetMaxHeightRatio) |

## PLAN C1-C8 -> file:line + test
| Item | Code | Test |
|---|---|---|
| C1 ReportSheet contract | ReportSheet.tsx:38-58 | ReportSheet-test (all) |
| C2 states + insert without .select(), 23505 = sent | reportContent.ts, useReportContent.ts | reportContent-test, ReportSheet-test "23505", "failed send" |
| C3 useBlockUser + BlockUserSheet | useBlockUser.ts, BlockUserSheet.tsx | BlockUserSheet-test |
| C4 useBlockedUsers + profiles-by-id | useBlockedUsers.ts, getBlockedUsers.ts | getBlockedUsers-test, BlockedUsersScreen-test |
| C5 Blocked users screen + Settings row | BlockedUsersScreen.tsx, settings.tsx:68 | BlockedUsersScreen-test, settings-test; device: settings-row + empty screenshots |
| C6 harness | ModerationDevHarness.tsx, debug.tsx | ModerationDevHarness-test; bundle check below |
| C7 nothing else wired; README | grep below; README.md | n/a |
| C8 owner-tagged, cleared on sign-out | useBlockedUsers.ts:34-49 | BlockedUsersScreen-test "owner-tagged", "late result" |

## Failure-mode list -> handling + test
| # | Handling | Test |
|---|---|---|
| 1 Insert shape | bare insert in reportContent.ts, blockUser.ts | reportContent-test (mock table has `insert` only) |
| 2 23505 -> sent/blocked, no Sentry | errors.ts, both hooks | ReportSheet-test, BlockUserSheet-test |
| 3 23503/42501 -> error card, Sentry without details | errors.ts:15-19 | ReportSheet-test `it.each`, BlockUserSheet-test |
| 4 Empty world | harness "No other profiles yet"; empty state | ModerationDevHarness-test; device screenshots |
| 5 Busy: ref guards, unmount, cancel | hooks (inFlightRef, runRef, mountedRef) | "second tap one request", "Cancel mid-submit", "unmounting mid-..." (3 files) |
| 6 Back/scrim/Cancel | SheetShell `dismissable`; BlockUserSheet dismiss | "scrim and Android back", "while blocking" |
| 7 Details: 500 cap, counter, whitespace = empty, keyboard | ReportSheet.tsx:61,131,139 | "Something else reveals..."; device keyboard screenshot (input and buttons stay visible) |
| 8 Owner-tagged cache | useBlockedUsers.ts | "owner-tagged", "late result" |
| 9 Harness isolation | debug.tsx:16, index.ts omits it | bundle check |
| 10 Nothing wired | grep: callers are only ModerationDevHarness.tsx and tests | n/a |
| 11 Accessibility | SheetShell, ReportSheet, BlockedUserRow | roles/labels asserted in the component tests |
| 12 Settings regression | settings.tsx | settings-test (order, no Terms row; existing Sign out/Delete tests unchanged) |

## LESSONS checklist
- Spec-trace, verbatim copy, shared components hardcode no caller text: done above; `Button` gained an optional `accessibilityLabel` prop only.
- Failure paths: covered per item above. Sentry only for unexpected errors; `environment` is set globally in `initSentry`.
- Server code / stored objects / orphans: n/a (no server code; rows cascade per 10a).
- act() warnings: 0. Android flat surface: yes, no blur, checked on the emulator.
- Tokens only: yes; new tokens listed under Flags. No `fontWeight`. Header inset from `useSafeAreaInsets`.
- Shared auth state from `useAuthSession`; data reset on user change; generated types used (`supabase.from` is typed).
- Multi-step logic in hooks, route files only compose. Purpose comments, no history.
- Testing environment: screenshots via `adb exec-out screencap` straight to the host, nothing written to /sdcard.
- Removing fallbacks / storage adapters: n/a. Google sign-in on td_emu: not touched (already signed in).
- Moderation carry-forward: n/a for this Build (no new table, no RLS, no composer, no UGC surface). The README states the duties for 20/24/25/27. New privileges: no migration in this Build.
- Release APK: not built.

## Flags
- **Tokens added beyond the §1.8 table**: `spacing[6]`, `spacing[10]` (DESIGN gives a 6px reason-row gap and a 10px button gap, neither was on the scale), `size.radioRing` (2), `shimmerBar.tag/.button`, `type.mono` (harness). `size.termsFooter` not added: Build 11's.
- **Harness spec trim**: DESIGN items 1 ("Terms accepted") and 5 ("Simulate first comment" via `requireTerms`) need Build 11's `useTermsGate`, which does not exist. Omitted; Build 11 adds them. With no other profile the harness uses a made-up user id so the sheets still open (submitting would fail 23503; not submitted on device).
- Blocked users intro line, when it wraps, ends about 2px left of the dev-client gear corner on the emulator (`bella-blocked-empty.png`). It is a dev-only element and readable, but DESIGN says nothing sits in that zone; Manager may want a right padding.
- Unblock error copy for a null display name reads "Couldn't unblock this user." (DESIGN gives only the first-name form).
- The emulator keyboard was the floating one, so the sheet lifted and both input and buttons stayed visible; the floating keyboard widget overlaps the sheet's left edge (emulator, not app).
- `typedRoutes`: `/profile/blocked-users` only type-checks after Metro has regenerated `.expo/types`; a fresh clone needs one `npx expo start` before `tsc`.
- The sheet scrim is `accessibilityRole="button"` inside an `accessibilityViewIsModal` container, as DESIGN says; RNTL treats the scrim as hidden, so tests use `includeHiddenElements`. iOS VoiceOver hides it (intended); Android TalkBack ignores the flag.
- On-device report/block/unblock against another user: UNTESTABLE until the second Google account exists.

## Gates
```
tsc --noEmit : exit 0
expo lint    : exit 0, 0 warnings
jest         : 25 suites, 190 tests passed; "act(" = 0, console/Warning lines = 0
Metro        : started on 8081 with a time limit, bundled (2019 modules), killed by PID (checked its command line); 8081 free
```

## Bundle check (harness absent from release)
Method: `npx expo export --platform android --output-dir <temp>` (release: Hermes bytecode `.hbc`) and
`npx expo export --platform android --dev --output-dir <temp>` (plain JS). Both searched with `grep -a -c` (Hermes
keeps string literals as plain bytes, so a byte search sees them). Export folders were in the temp dir and are deleted.

| String | release `.hbc` | dev `.js` (control) |
|---|---|---|
| `Moderation dev harness` | **0** | 1 |
| `ModerationDevHarness` | 0 | 7 |
| `No other profiles yet` | 0 | present |
| `Supabase debug` (rest of debug screen) | 0 | 1 |
| `Report this comment` (module code that does ship; proves the method reads the .hbc) | 1 | 1 |

Metro's dev entry bundle served to the device does NOT contain the harness (expo-router loads route files lazily),
so the control is `expo export --dev`, not a fetch of the entry bundle.

## On device (td_emu, signed in as @tsujintsujin; nothing saved, no sign-out)
- `bella-settings-row.png`: Account rows Edit profile, Comments, Blocked users, Sign out.
- `bella-blocked-empty.png`: Blocked users screen, empty state.
- `bella-harness.png`: harness on the debug screen, "No other profiles yet".
- `bella-report-sheet.png`: report sheet, "Something else" selected, details typed, keyboard up: input and both buttons visible. Cancelled; no report submitted.

## Manager — state at pause (2026-09-30)
- Gates rerun at dfc1ccf: tsc clean, lint clean, jest 190/190, 0 act()/console warnings.
- Ruby review: FIX NEEDED — 0 must-fix; should-fix: (1) keyboard proof invalid (floating emulator
  keyboard) → retest docked; (2) shimmer pulse duplicated → extract; (3) `isInFlight()` guard in
  BlockUserSheet not exercised by a test. Nits: README callback wording, radios `checked`, focus on
  sent state (SUSPECTED), harness query error, tokens + null-name copy into DESIGN.md. No security
  or privacy defect; copy verbatim; harness absent from the release export.
- Queenie QA part 1: **stopped by the Manager before any result** (she was driving td_emu while
  Justin tried to add a Google account; emulator overloaded). Only `qa-00-launch.png` exists. Redo.
- Bug 1 not yet sent to Bella. See HANDOFF.md for the ordered next steps.

## Bug 1 — Ruby's review findings (Bella, 2026-10-01)
Base 2c93199. Unit tests only; no emulator, no Metro.

| # | Finding | Fix (file:line) | Test |
|---|---|---|---|
| 1 | Shimmer pulse duplicated | New `src/ui/Shimmer/usePulse.ts:6` (hook returns the looping Animated.Value); values are the `shimmerPulse` token (`src/ui/tokens.ts`, min 0.4 / max 0.9 / 700 ms). Used at `src/app/(tabs)/profile/index.tsx:118` and `BlockedUsersScreen.tsx:132`. Same values, same one-value-per-screen sharing, so look and timing are unchanged. | Existing shimmer testID tests in `profile-test` / `BlockedUsersScreen-test` unchanged and green |
| 2 | `isInFlight()` guard untested | Guard is reachable (the Block press and a dismiss can land before the re-render). Kept at `BlockUserSheet.tsx:41`. | `BlockUserSheet-test` "a dismiss fired in the same act as the Block press...". Fails with the guard removed (checked), restored |
| 3 | README wording | `README.md:12,19-20,30-31`; the two `onReported`/`onBlocked` prop doc comments match | n/a |
| 4 | Radio state + focus | `ReportSheet.tsx:107` adds `checked`. New `hooks/useFocusOnMount.ts` is used by `SheetShell.tsx:39` (replaces its inline effect) and `SheetSuccess.tsx:16` (success title) | `ReportSheet-test` "radios expose selected and checked...", and "moves screen-reader focus..." in both sheet tests; each fails when its line is removed (checked) |
| 5 | Harness ignored query error | `ModerationDevHarness.tsx:41,58,79` shows "Couldn't load profiles: <message>" and stops saying "Loading" | `ModerationDevHarness-test` "a failed profiles query..." |
| 6 | Self-guards untested | n/a (tests only for `useReportContent.ts:34`, `useBlockUser.ts:29`) | new `__tests__/moderationHooks-test.tsx`, one test each |

Focus tests mock `findNodeHandle` (host nodes have no native handle under the test renderer) so the `setAccessibilityFocus(42)` call can be seen.

Out of scope touched: `src/app/(tabs)/profile/index.tsx` (Build 4 file) only to swap its local pulse for `usePulse` (finding 1).

Gates: tsc clean, lint clean, jest 26 suites / 197 tests pass, 0 `act(` and 0 console warnings in the output.
Note: the first full run had two first-test 5 s timeouts (ModerationDevHarness, ReportSheet) while the PC was busy; both passed alone and on the full rerun.
Bundle check: `expo export --platform android` has 0 hits for "Moderation dev harness"; the `--dev` export has 1. Both temp folders deleted.

---
# QA — Queenie (Phase 3, 2026-10-01, HEAD b308e03, two accounts)

td_emu signed in as the TEST account; targets = main profile "Justin Masiga" @tsujintsujin. Nothing saved on either
account, no sign-out, no Google picker. Load before start 0.50. Animations off (left off). Evidence:
`logs/evidence/build-10b/qa-*.png` (host clock below = device UTC + 8 h; device shows 02:xx).
Rows this run created on the live project: 5 `reports` (profile x2 "Spam or scam"; comment "Something else" + details
"QA test details Build10b"; dm_message "Spam or scam"; collection_item "Harassment or bullying") and 2 `blocked_users`
(both removed through the UI; the Blocked users list is empty at the end, `qa-17-final-blocked-empty.png`).

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | Settings rows: Edit profile photo / usertag, Comments, **Blocked users**, Sign out; no Terms row; Danger zone + Delete present | PASS | qa-01-settings.png |
| 2 | Blocked users, empty: header, intro, no-entry icon, "No blocked users", "People you block will show up here." all verbatim | PASS | qa-02-blocked-empty.png |
| 3 | Harness lists "Justin Masiga @tsujintsujin", pre-selected (test account itself not listed) | PASS | qa-03-harness.png |
| 4 | ReportSheet form: titles comment/profile/message/caption verbatim; subhead; 7 labels verbatim; Send disabled until a reason; "Something else" reveals "TELL US MORE (REQUIRED)" + "What's the problem?"; Send stays disabled for empty and for 3 spaces ("3/500"); "hi" enables Send; counter live; typing past 500 and pasting (2 x 300) both stop at 500/500; Cancel, scrim tap, Android back each close it | PASS | qa-04a..04f |
| 5 | Report profile + Spam -> "Report sent" + body verbatim; Done closes; harness shows "Result: reported" | PASS | qa-05a, qa-05b |
| 6 | Same profile again -> identical "Report sent", no error | PASS | qa-06-repeat-sent.png |
| 7 | Comment + "Something else" + details -> sent | PASS | qa-07-details-sent.png |
| 8 | dm_message: 4 taps on Send in one adb call (~0.5 s) -> one sent state, sheet still open | PASS (row count = Manager's SQL) | qa-08-double-tap.png |
| 9 | Offline (wifi+data off) caption report -> error card "Couldn't send your report. Check your connection and try again."; reason kept; button "Try again"; network on -> Try again -> sent | PASS | qa-09a-offline-error.png, qa-09b-retry-sent.png |
| 10 | BlockUserSheet: confirm copy verbatim ("Block Justin Masiga?", both bodies, Cancel/Block); Cancel closes and nothing stored (list empty afterwards); Block -> blocked state "Justin Masiga is blocked" + body verbatim, Done closes, "Result: blocked". **The "Blocking..." state was too brief to screenshot** (request under 1 s); Back pressed in the same adb call did not dismiss, but that is weak proof | PASS, PARTIAL on the blocking-state view | qa-10a, qa-10b-blocking-back, qa-10c-blocked |
| 11 | Blocked users filled: avatar (photo), "Justin Masiga", "@tsujintsujin", Unblock (126 px = 48dp high). Inline confirm "Unblock Justin?" / "This removes them from your blocked list." / Cancel + Unblock, gold border; Cancel keeps row; Unblock -> row gone -> empty state | PASS | qa-11a..11d |
| 12 | Re-blocked; network off -> Unblock -> confirm -> error card "Couldn't unblock Justin. Check your connection and try again." above the list, row stays; network on -> retry (card cleared on the next action) -> row goes, empty state | PASS | qa-12a-unblock-failed.png, qa-12b-retry-gone.png |
| 13 | Docked keyboard (see note) on ReportSheet and Delete sheet: input, Cancel and Send/Delete all visible and reachable; sheet lifts above the keyboard. **Extra gap above the keyboard, see Bug 2** | PASS functionally, FAIL on gap (Bug 2) | qa-13-report-docked-keyboard.png, qa-13b-delete-docked-keyboard.png, qa-13b-delete-typed-DEL.png |
| 14 | Accessibility from dumps | PARTIAL (live region UNTESTABLE by dump) | qa-09-ui-error.xml, qa-13-ui-report-docked.xml |
| 15 | Design match | see below | |
| 16 | Regression: Profile has no Edit/Settings rows (only the gear button and the usertag chip); Edit profile opens (photo, USERTAG, Cancel, Save disabled), Back leaves without saving; Delete my account sheet opens, `DEL` keeps "Delete my account" disabled, Cancel closes | PASS | qa-16a-profile, qa-16c-edit-profile, qa-16b-delete-cancelled |
| 17 | Logcat + ANR | `am_anr` = **0** at the end; no "System UI isn't responding" dialog (0 times). Red lines below | |

## Times of items 5-9 (host clock; send tap -> result on screen)
- 5: 10:24:24 -> 10:24:27 (profile, Spam or scam)
- 6: 10:24:53 -> 10:24:56 (profile, Spam or scam, repeat)
- 7: 10:26:16 -> 10:26:19 (comment, Something else + details)
- 8: 4 taps 10:26:42.47 -> 10:26:42.94, sent state on screen by 10:26:46 (dm_message, Spam or scam)
- 9: offline send 10:27:08 -> error 10:27:14 (no row expected); Try again 10:27:35 -> sent 10:27:39 (collection_item, Harassment or bullying)
- Blocks: first 10:29:08-10:29:12 (blocked about 10:29:09), unblocked about 10:30; second about 10:31, unblocked about 10:32 after the failed attempt at about 10:31.

## Item 13 note: how the keyboard was docked
`show_ime_with_hard_keyboard` was `0`; set to `1`, **restored to `0`**. Setting it to 1 alone did NOT dock the keyboard: Gboard still showed its
floating widget (and a floating full keyboard after "Show on-screen keyboard"; Resize > Reset did nothing). What worked: `pm clear
com.google.android.inputmethod.latin` (Gboard's own data only, not the app, not any account), then `ime set` Gboard. Consequences: Gboard's
saved layout is back to its default docked layout, and its first-run "Try out your stylus" dialog appeared once (cancelled). Tapping the
widget's "Show on-screen keyboard" brings floating mode back, so I cleared again before the Delete test. Docking is a Gboard setting, not an app setting.

## Item 14 detail (UI dumps)
- Selected radio ("Something else"): `class=android.widget.RadioButton`, `checked=true`, `selected=true`, `clickable=true`,
  `content-desc="Something else"`. Unselected radios: `checked=false`, `selected=false`. (The inner text node is also `selected=true`.)
- Buttons: Cancel / Send report / Try again / Done / Block / Unblock have `content-desc` (= label); the row button is
  "Unblock Justin Masiga". Disabled Send exposes `enabled=false`. The scrim is a full-screen button with `content-desc="Close"`.
- Details input: `class=EditText`, `content-desc="Tell us more"`. The hint "Required" is not visible in uiautomator dumps.
- Target sizes (2.625 px/dp): reason rows 126 px = 48dp; Cancel/Send/Done/Block/Try again 126 px = 48dp; row Unblock 126 px = 48dp; details input 252 px.
  **Below 48dp:** Blocked users back chip 94x95 px = 36x36dp (DESIGN says "back chip 36", so as designed; the Edit profile back arrow, 58x79 px, is Build 7).
- Error card (offline report): a focusable `android.view.View` with `content-desc` = the text. **UNTESTABLE from a dump:** uiautomator does not export
  role=alert or `accessibilityLiveRegion`, so "exposed as an alert / live region" cannot be proven here. Justin to check with TalkBack.

## Item 15 design match (vs `logs/evidence/build-10b/design/*.png`)
Matches: sheet surface/radius/handle; reason rows (48 high, gold tint + ring + dot when selected); details label/box/counter; disabled Send; sent
state (56dp gold check badge, title, body, full-width Done); error card + Try again; Block button in the danger colour; blocked state; Blocked users header,
back chip, intro, rows, inline confirm (gold border, Cancel + gold Unblock), unblock-failed card above the list, empty state.
Differences:
1. **Bug 2**: with a docked keyboard there is a ~48dp gap between the button row and the keyboard (design padding is 24dp; the bottom safe-area inset is still added although the keyboard covers it). `qa-13-report-docked-keyboard.png`, `qa-13b-delete-docked-keyboard.png`. The Delete sheet (earlier Build) has the same gap, so it is the shared sheet pattern.
2. With the keyboard up the Report sheet grows to the full screen height: the drag handle sits in the status-bar row and the first two reasons scroll out of view under the title. Acceptable, noted only.
3. Blocked users intro text ends at x=749 of 900 (display px) and the dev gear starts at x=752: about 3 px apart (`qa-02-blocked-empty.png`, `qa-11a`). Bella flagged this; dev-client gear only.
4. The warning sign in error cards renders as a filled red triangle (emoji font); the board shows an outline glyph. Cosmetic.
5. Dev harness: board not compared (dev-only). It has no "Terms accepted" readout and no "Simulate first comment" (Bella's documented trim for Build 11).

## Seen on screen / in logcat (exact text; cause for Ruby to judge)
- First load (my Metro had only just started): dev client error screen "There was a problem loading the project." ... "java.io.IOException: unexpected end of stream on http://localho..." (`qa-01a-launch.png`). Reload after Metro finished bundling worked; I believe it was my timing, not the app.
- A blue bar "Refreshing..." over the top of the debug screen in the first harness screenshot (`qa-03-harness.png`), gone a second later.
- Logcat `*:E` from the app process, whole run: `E unknown:ReactNative: Unable to display loading message because react activity isn't active, message: Loading from 127.0.0.1:8081...` and `Reloading...` (01:51, before my run); `E unknown:ReactNative: Tried to remove non-existent frame callback` (02:19:43, 02:19:44, at launch); `E unknown:ReactHost: Unhandled SoftException` / `ReactNoCrashSoftException: raiseSoftException(onWindowFocusChange(hasFocus = "true")): Tried to access onWindowFocusChange while context is not ready` (02:20:32, at launch); `E FrameTracker: force finish cuj, time out: J<IME_INSETS_SHOW_ANIMATION::0@0@com.tsujintsujin.perchable>` / `J<IME_INSETS_HIDE_ANIMATION::1@0@com.tsujintsujin.perchable>` (13 times, each time the keyboard opened or closed). No AndroidRuntime or ReactNativeJS errors.

## Bugs
- **Build 10b · Bug 2 — Extra bottom gap (~48dp) above a docked keyboard on the Report sheet (and the Delete sheet).**
  Steps: Home > Debug: Supabase > "Report comment (random id)" > "Something else" > tap "Tell us more", with the docked Gboard.
  Expected: 24dp between the button row and the keyboard (DESIGN: padding 16/20/24 plus the bottom inset only where nothing covers it).
  Actual: gap about 125 px = about 48dp. Minor: the input and both buttons are fully visible and reachable.
  (Bug 1 was Ruby's review round.)

## UNTESTABLE - Justin to check
- TalkBack: error card read as an alert; "Report sent" / "{name} is blocked" announced; focus moves to the sheet title; radio announces "selected".
- The "Blocking..." state (Cancel disabled, back and scrim inert) on a slow network: I could not hold it long enough on this emulator.
- Row counts for `reports` / `blocked_users` against the list above (Manager's SQL).

## State left behind
Test account still signed in; Blocked users empty; `show_ime_with_hard_keyboard` = 0 (original); Gboard data cleared (now docked default, see note);
Metro (PID 17460, started by me) killed, 8081 free; `adb reverse --remove-all` done; nothing written to /sdcard.

## Manager — QA check + ban proof in progress (2026-10-01)
- DB after Queenie's run: **4** reports (not 5 — the repeat profile report was absorbed by the
  unique constraint and shown as "sent", as designed); the 4-tap double-tap made exactly 1
  `dm_message` row; the offline attempt stored nothing until "Try again"; 0 blocks left.
- 0 `am_anr`, 0 "System UI isn't responding" during the run (emulator now on the NVIDIA GPU).
- Confirmed Bug 2 from `qa-13-report-docked-keyboard.png`: with a docked keyboard the sheet keeps an
  extra ~48dp band under the buttons (bottom safe-area inset added on top of the keyboard), and the
  full-height sheet runs up under the status bar (handle in the status-bar row). Same pattern in
  Build 9's DeleteAccountSheet (`qa-13b-delete-docked-keyboard.png`).
- 10a B3 ban proof started: the test account (b2400254) was banned with the exact admin-doc block
  (banned_until 2126-10-01; sessions/refresh tokens 0; main account untouched). **Waiting on Justin**
  to try signing in with it on td_emu. The ban is still active on the TEST account until then.
