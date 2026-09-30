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
  `index.ts` still takes the uid only from the JWT and returns generic error bodies. **Not deployed.**
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
7. `verify_jwt`: `supabase/config.toml` has no entry for this function, so the platform default (on)
   applies. Worth confirming at deploy.
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
| 4 | Function: storage first then user, not-found = ok. Retry after the user is gone: the function itself returns 200 (see 401 fix). App: 401 is an error | emptyFolder-test subFromJwt/isUserGone; deleteAccount-test 401 rejects |
| 5 | `emptyFolder` loops until empty | emptyFolder-test (more than one page) |
| 6 | mark -> signOut (Supabase local + Google) -> clearSession; toast once on sign-in | useDeleteAccount-test order; sign-in-test toast once; accountDeletedNotice-test |
| 7 | `mountedRef` guards setState | useDeleteAccount-test unmount mid-delete |
| 8 | Fresh user/profile is server behaviour | UNTESTABLE in jest: Queenie on device |
| 9 | Function unchanged in auth: uid from `getUser(token)` only; generic errors; no client path takes a uid | review of index.ts |
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
