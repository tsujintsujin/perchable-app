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

---

# Phase 1-2 - Bella

Base SHA 0f66e82. Function commit `5f4893e`; app commit in the report.

## What was built and why
- **Edge Function** (`supabase/functions/delete-account/`): the storage cleanup moved to
  `cleanup.ts` (`emptyFolder(bucket, folder)`), free of Deno APIs so Jest can import it.
  It lists with an explicit `limit: 100, offset: 0`, removes what it got, and repeats until a
  listing comes back empty. Offset stays 0 because removed objects drop out of the next page.
  A 100-round cap throws instead of looping forever if removal silently does nothing.
  `index.ts` still takes the uid only from the JWT and returns generic error bodies. **Deployed by the Manager (v1, verify_jwt on)** - after Bug 1 it needs a redeploy.
- **App**: `api/deleteAccount.ts` (invoke; any HTTP error is a real error - see the 401 fix below; network failure =
  `DeleteAccountOfflineError`; anything else rethrown), `hooks/useDeleteAccount.ts` (one run at a
  time, then the sign-out path), `components/DeleteAccountSheet.tsx` (the sheet), and
  `accountDeletedNotice.ts` (the toast signal). The route only composes: a "Danger zone" row
  and `{open && <DeleteAccountSheet/>}`.
- **Success path**: `markAccountDeleted()`, then the existing `signOut()` (Supabase local scope + Google
  `signOut`, so the next sign-in shows the picker), then `clearSession()` (the Build 8 latch path).
  Local-scope Supabase sign-out tolerates the user being gone (the library ignores 401/403/404 there).
- **Toast signal: a module-level flag**, not a route param. The auth gate moves the user to
  sign-in by itself (no router call exists to carry a param). Sign-in consumes it in a mount
  effect, so it shows once.
- **Sheet mount = open**: Settings mounts the sheet to open it and unmounts to close, so typed text and
  the error reset every time. Cost: no slide-out animation on close.
- **Shared UI changes**: `GlassCard` gets `tier="sheet"` (token already existed); `ListRow` gets a
  `danger` prop; `Button` `destructive` is now a solid danger fill with dark text (the board's
  confirm button; nothing used the old outlined one); new tokens: `surface.dangerTint`,
  `overlay.scrim`, `size.dragHandle`, `dangerGlow`, `letterSpacing.input`.

## Flagged for the Manager
1. **Error copy (not in DESIGN.md):** "⚠ Couldn't delete your account. Check your connection and try again."
   modelled on the sign-in failure card. Used for offline and server errors alike.
2. **401 caveat:** a 401 also occurs if the caller's access token is expired/invalid while the
   account still exists (e.g. refresh failed). Per the brief the app then treats it as done: local
   sign-out, "deleted" toast, account not actually deleted. Worth a decision.
3. **Drag-to-dismiss** is not implemented; the handle bar is decorative. Dismiss = backdrop tap,
   Android back, Cancel (all blocked while deleting).
4. **Android glow:** RN draws no coloured shadow on Android, so the glow shows on iOS only; the sheet
   border uses `border.danger` so it still reads as dangerous. Sheet fill is opaque `bg.elevatedFlat`
   (no real blur on Android, per LESSONS).
5. **Keyboard:** `KeyboardAvoidingView behavior="padding"` inside the Modal. Unverified on device
   (Settings unreachable while signed out).
6. Row/confirm text uses `type.bodyStrong` (Inter 600) for "weight 700"; the title uses `type.subhead`
   (Poppins 700) for the board's 800 at 18px: nearest tokens, no fontWeight.
7. `verify_jwt`: now explicit in `supabase/config.toml`; the Manager deployed the function with it on.
8. Sentry `environment` is set once in `initSentry`, so every captured error carries it.

## Manager: how to verify the function
`npx jest __tests__/emptyFolder-test.ts` covers the loop (0, 1, 205 objects, list/remove errors, stuck
folder). After deploy: upload more than 100 objects under `avatars/<test uid>/`, call the function with
that user's JWT, confirm the folder is empty and a second call returns 401.

## Failure-mode items -> handling -> test
| # | Handling | Test |
|---|---|---|
| 1 | Confirm disabled unless `typed === "DELETE"`; Cancel closes, no call | DeleteAccountSheet-test (6 wrong inputs, exact, disabled tap, Cancel/backdrop/back) |
| 2 | `inFlightRef` in hook; Button loading; Cancel disabled; backdrop and `onRequestClose` blocked while deleting | useDeleteAccount-test "two taps"; Sheet-test "while deleting" |
| 3 | Offline -> `failed` -> ErrorCard, retry works, no Sentry, nothing cleared | useDeleteAccount-test offline+retry; deleteAccount-test offline; Sheet-test failure card |
| 4 | Function: storage first then user, not-found = ok. Retry after the user is gone: the function should return 200 (see 401 fix); that decision is covered only by the pure-function tests (subFromJwt/isUserGone), **the live check is pending in QA**. App: a 401 is an error | emptyFolder-test subFromJwt/isUserGone; deleteAccount-test 401 rejects |
| 5 | `emptyFolder` loops until empty | emptyFolder-test (more than one page) |
| 6 | mark -> signOut (Supabase local + Google) -> clearSession; toast once on sign-in | useDeleteAccount-test order; sign-in-test toast once; accountDeletedNotice-test |
| 7 | `mountedRef` guards setState | useDeleteAccount-test unmount mid-delete |
| 8 | Fresh user/profile is server behaviour | UNTESTABLE in jest: Queenie on device |
| 9 | uid never comes from the body. Normally it is `getUser(token).id`; if that fails, it is the JWT `sub` (decoded by `subFromJwt`, UUID-checked), trusted only because verify_jwt (explicit in config.toml) has already verified signature and expiry, and only used to continue when `getUserById` proves the user is gone; otherwise 401. Generic error bodies; no client path takes a uid | review of index.ts; subFromJwt/isUserGone tests |
| 10 | Unexpected errors -> `Sentry.captureException`; offline not | useDeleteAccount-test Sentry / offline |

## LESSONS checklist
- Spec-trace: below. Copy verbatim: `COPY` table in the sheet; Button text via `label`/`loadingLabel`.
- Async failure/cancel/double-tap/unmount: items 2, 3, 7. Sentry only unexpected: item 10.
- Server input validation / generic errors: function reads no body. Orphans: item 5.
- act(): 0 in jest output. Android blur: flat opaque fill. Tokens only: new tokens added, no literals in screens.
- Safe area: sheet bottom padding from `useSafeAreaInsets`. Shared state: `useAuthSession`. Types: n/a (no table query).
- Comments 1-2 lines, no history. Other people's files: `discord_modal.png` left untracked.
- Fonts: no `fontWeight`. Busy state starts at the tap (`setIsDeleting` before the await). Storage adapter: untouched.
- Section 7 standing rules: TMDB attribution still on Settings (settings-test). Dev-client corner: sheet is a modal, header unchanged.

## Spec-trace (DESIGN.md "Build 9")
| Spec line | Where |
|---|---|
| Sign out row (Build 8) | settings.tsx ListRow "🚪 Sign out" |
| Danger zone section below About | settings.tsx:86 |
| "🗑 Delete my account" row, tint fill/border, danger text | settings.tsx:87-89, 135; ListRow.tsx `danger`; tokens `surface.dangerTint`, `border.danger` |
| Row opens sheet, deletes nothing | settings.tsx `setDeleteOpen(true)` |
| Sheet tier `sheet` GlassCard, drag handle | DeleteAccountSheet.tsx:71-75, styles.handle |
| Danger glow | DeleteAccountSheet.tsx:69 styles.glow, `dangerGlow` token |
| Title "Delete your account?" danger colour | COPY.title (:25), styles.title (:154) |
| Intro "This permanently deletes:" | COPY.listIntro, :83 |
| Four bullet items, body/primary | COPY.listItems, :84 |
| Irreversibility note, secondary | COPY.irreversible, :87 |
| Prompt "Type DELETE to confirm:" | COPY.prompt, :88 |
| Exact case-sensitive gate | :117 `typed !== DELETE_CONFIRM_WORD` |
| Confirm "Delete my account", destructive | COPY.confirm, :113 |
| Cancel secondary-glass dismisses | COPY.cancel, :106-110 |
| Deleting status line | COPY.status, :80 |
| Confirm "Deleting…" spinner, Cancel disabled | COPY.confirming :114, `loading` :118, Cancel `disabled` :109 |
| Not dismissable while deleting | `dismiss` :55, Modal `onRequestClose` :60 |
| Post-delete: sign-in idle + info Toast, once, auto-dismiss | sign-in.tsx:17, 26-29, 67 |
| Toast "✓ Your account was deleted." | sign-in.tsx:17 |

## Gates
- `npx tsc --noEmit`: clean. `npx expo lint`: clean.
- `npx jest > out.txt 2>&1`: 19 suites, 110 tests passed (77 before, 33 new); 0 "act(", 0 console warnings.
- Device (td_emu): own Metro started and stopped; app bundled (2002 modules) and launched to the
  sign-in screen, no red screen; 8081 confirmed free. Settings and the sheet are not reachable while signed out.

## Pre-QA fix: a 401 no longer means "deleted" (Manager, from flag 2)
- **Cause:** the app treated any 401 as done, so an invalid token showed "Your account was deleted" with nothing deleted.
- **Function (own commit):** when `getUser(token)` fails, the function decodes the token's `sub`
  (`subFromJwt` in `cleanup.ts`: base64url, must be a UUID; safe to trust only because verify_jwt has
  already checked signature and expiry) and asks `admin.auth.admin.getUserById(sub)`. `isUserGone` is
  true only for a not-found result. Gone: fall through to the idempotent `emptyFolder` + `deleteUser`
  (not-found already counts as success) and return 200. User exists, other lookup error, or no sub: 401.
- **config.toml:** appended only `[functions.delete-account] verify_jwt = true`.
- **App:** removed the 401 branch from `deleteAccount.ts`; the 401 test now expects a rejection.
  A 401 goes through the hook's failure path: error card and Sentry.
- Flag 2 resolved. Flag 7 (verify_jwt) resolved by the explicit config entry.
- Tests: emptyFolder-test now has 6 loop tests + 3 subFromJwt + 3 isUserGone.
- Gates: tsc clean, lint clean, jest 19 suites / 116 tests, 0 "act(", 0 console warnings.

## Bug 1 (Ruby's review, Manager agreed)
1. **Nested folders (function):** Storage RLS allows `<uid>/sub/x.jpg`, so `list(uid)` can return a folder
   entry (`id === null`) that `remove()` silently ignores; the loop spun to its cap and every attempt
   returned 500. `emptyFolder` now removes only real objects (`id !== null`) and recurses into folder
   entries, with the 100-round cap shared across the whole tree. Tests: nested tree with a
   `.emptyFolderPlaceholder` and a deeper level ends empty (other users' files untouched); an
   unremovable folder entry fails at the cap instead of spinning. **Needs a redeploy (Manager).**
2. **Unmount test was fake:** React 19 no longer warns on state updates after unmount, so the old
   assertion could not fail. The test now wraps `useState` setters and counts calls after unmount
   (verified: it fails with the `mountedRef` guard removed). Added: unmount mid-delete, then the call
   succeeds -> mark, signOut and clearSession still run, no late setState.
3. **Toast could be missed:** a background-refresh `SIGNED_OUT` mid-delete could mount sign-in before
   the mark. The hook now marks before the request and calls `clearAccountDeleted()` on any failure, so a
   failed delete never shows the toast. Tests: mark precedes the request; success does not clear;
   offline and server failures clear.
4. **Accessibility:** `ErrorCard` is `accessible` with `accessibilityRole="alert"` and a polite live
   region (sign-in tests unchanged and green). The input keeps its `accessibilityLabel` (RN has no
   portable way to tie a visible `Text` to an input); the visible prompt is marked
   `importantForAccessibility="no"` so it is not read twice.
5. **Same-frame Cancel:** the hook returns `isInFlight()` (reads the ref, true from the tap itself);
   the sheet's `dismiss` (Cancel, scrim, Android back) is blocked while it is true. Tests: hook reports
   in flight in the same frame; sheet ignores all three dismissals with `isDeleting` still false.
6. Log corrections above (items 4 and 9, deployment state, flag 7).
- Not done, per the Manager: error copy unchanged; StrictMode double-run toast timer is dev-only.
- Gates: tsc clean, lint clean, jest 19 suites / 123 tests, 0 "act(", 0 console warnings.

---

# QA - Queenie (Phase 3), 2026-09-30, HEAD 08fe19d
td_emu, signed in as @justin94test (Justin), own Metro (started, stopped, 8081 confirmed free). Evidence: `logs/evidence/build-09/qa-*.png`, `qa-logcat-errors-delete.txt`. Nothing written to /sdcard. Did not sign back in; the emulator is left on the sign-in screen.

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | Danger zone row: "DANGER ZONE" header below About, "🗑 Delete my account", tinted fill/border, red text; only the dev-client gear is in the top-right 64x64 (Settings header has nothing there). TMDB attribution verbatim (§7) | PASS | qa-01-settings-danger.png |
| 2 | Sheet: title, intro, 4 bullets, note, prompt, Cancel / "Delete my account" all verbatim; Delete visibly dimmed and its node `enabled=false` | PASS | qa-02-sheet.png |
| 3 | Gate by UI dump: empty, `delete`, ` DELETE`, `DELETE ` all `enabled=false`; exact `DELETE` `enabled=true`. Keyboard: sheet lifts, input and both buttons stay visible | PASS (gate). Keyboard part PARTIAL, see note 1 | qa-03-gate-keyboard.png |
| 4 | Cancel, backdrop tap, Android back each close the sheet (dump: sheet absent); reopened sheet has empty input; Profile still @justin94test | PASS | qa-04-dismissed-profile.png |
| 5 | Wifi+data off, typed DELETE, tapped Delete: error card "⚠ Couldn't delete your account. Check your connection and try again." shown, sheet back in confirm state with Delete enabled. Network back on: Profile still @justin94test | PASS | qa-05-offline-error.png, qa-05b-after-offline-account-exists.png |
| 6 | 5 taps chained in one shell call. Deleting frame: status line "Deleting your data — this may take a moment.", button "Deleting…" with spinner, Cancel dimmed. Android back during it did not dismiss (see note 2). Landed on sign-in with toast "✓ Your account was deleted." | PASS | qa-06a-before-delete.png, qa-06b-deleting-frame1.png, qa-06c-deleting-after-back.png, qa-06d-after-delete.png |
| 7 | Force-stop and relaunch: opens on sign-in, no toast | PASS | qa-07-relaunch.png |
| 8 | Logcat | see below | qa-logcat-errors-delete.txt |

Delete completion time: last "Deleting…" frame 13:47:59 local (05:47:59 device UTC); sign-in with toast seen by 13:48:10 local (05:48:10 UTC). Device clock is UTC, host is UTC+8. So the server-side delete finished between 05:47:59 and 05:48:10 UTC on 2026-09-30.

Double-tap: 5 taps landed, UI showed a single Deleting state and one sign-out. I did not count server calls (no access to function logs); the Manager can confirm one invocation server-side.

Note 1 (keyboard, flag 5): Gboard on td_emu runs in hardware-keyboard mode, so only a floating toolbar shows, not the full-height keyboard. Layout did lift the sheet ~50px and input and buttons stayed visible, but a real full-height keyboard is UNTESTABLE on this emulator. Justin to check on a phone that the input and both buttons stay visible with the keyboard up.

Note 2 (back during deleting): the frame after back shows the sheet dropped ~50px, so that back press may have gone to hiding the IME first, not to the app. The sheet stayed. Weak proof for the back block; the unit test covers it. Same-frame Cancel/scrim were not tapped during deleting.

Logcat (cleared just before item 6; the offline phase is not in it). Red lines from the app process (pid 31540), exact text:
- `E/unknown:ReconnectingWebSocket: Error occurred, shutting down websocket connection: Websocket exception` with `java.net.SocketException: Software caused connection abort` (3 times, 05:47:58.313-.321, i.e. during the delete/sign-out). NOT on the known-harmless list. Native okhttp websocket, most likely the dev-client Metro connection, but I did not prove that. Ruby to judge.
- `E/ImeBackDispatcher: Ime callback not found. Ignoring unregisterReceivedCallback.` (known)
- `E/FrameTracker: force finish cuj, time out: J<IME_INSETS_SHOW_ANIMATION / IME_INSETS_HIDE_ANIMATION ...>` (known)
No FATAL, AndroidRuntime, ANR or app crash. Non-app red lines: emulator audio HAL `pcmOpen ... failed`, Gboard `InputConnectionWrapper ... TimeoutException`, `TaskPersister`, `IPCThreadState Binder transaction failure`, `chromium variations_seed_loader`, `audit rate limit exceeded`.
No warning or error banners on screen at any point.

Design check: sheet matches the Manager decisions (danger border, flat fill, no glow, handle decorative). Title is red Poppins, list/note/prompt in the spec hierarchy. Not measured to the pixel against the board.

Not tested (Manager to set up): item 8 sign back in creating a fresh profile; server side that auth user, profile rows and avatars folder are gone; a 401-with-account-still-existing path.

Bugs: none.

## Build 9 — CLOSED (Manager, 2026-09-30)
- Commits: 5f4893e + 878bde9 + 8f171c2 function · a337c1e + 786094f + 08fe19d app.
  Function deployed by Manager: v2, verify_jwt on.
- Gates (Manager rerun at 08fe19d): tsc clean, jest 123/123, 0 act()/console warnings, no secrets.
- QA: Queenie PASS 8/8 (gate, dismissal, offline, 5-tap delete, toast once, relaunch).
- Review: Ruby FIX NEEDED → PASS after Bug 1.
- Manager live checks:
  - no auth / malformed JWT / GET → 401 from the platform.
  - Seeded 150 objects + `nested/seed-deep.jpg` under the test uid before the on-device delete;
    after it: auth user 0, profile 0, storage objects 0 (multi-page + nested cleanup proven).
  - Item 8: Justin signed in again → new uid 43fae9b2… (old 5d77892a…), usertag null, Google
    photo, 0 storage objects. Screen: `evidence/build-09/manager-fresh-profile-release.png`.
- Not proven live: single server invocation on 5 taps (logs API query failed — unit test +
  one "Deleting…" state only); deleted-user-token → 200 path (pure-function tests only).
- UNTESTABLE → Justin: full-height soft keyboard on a real phone keeps input + buttons visible.
- Release APK (Justin asked): `builds/perchable-test-2026-09-30.apk` (gitignored), arm64-v8a +
  x86_64, debug-keystore signed. Installed on td_emu with no Metro: launches, signed in, Profile +
  Settings render, no crash. Dev build reinstalled afterwards.
  Build command that works (one at a time — two Gradle runs collide):
  `GRADLE_USER_HOME="C:/g/perchable" SENTRY_DISABLE_AUTO_UPLOAD=true ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,x86_64` (~29 min).
