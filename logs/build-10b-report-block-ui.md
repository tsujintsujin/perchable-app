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
