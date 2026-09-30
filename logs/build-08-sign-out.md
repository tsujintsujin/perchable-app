# Build 8 — Sign out (Module: Auth)

Base SHA: fd74252 (recorded 2026-09-30, Phase 1 start)

## Failure-mode list (Manager, before Phase 1) — each is a Done-means line + a test
1. **Offline when tapping Sign out** — `supabase.auth.signOut()` can fail on
   the network. The user must still end up signed out on this device (use
   `scope: 'local'` or clear locally on error), never stuck half-signed-in.
2. **Google side** — `GoogleSignin.signOut()` also runs, so the next sign-in
   shows the account picker instead of silently reusing the last account.
   If it fails, Supabase sign-out still completes (and vice versa).
3. **Double tap** — button disabled/loading after the first tap; one sign-out.
4. **No data left on screen** — after sign-out, no screen shows the previous
   user's profile/avatar/usertag, including screens still mounted in the tab
   stack (useOwnProfile holds state — it must clear, not just refetch).
5. **Cold relaunch after sign-out** — opens on the sign-in screen (session
   gone from AsyncStorage), not the tabs.
6. **Sign back in** — same account signs back in, profile intact (sign-out
   is not deletion).
7. **Sentry** — sign-out failures are reported, a normal sign-out is not; if
   a Sentry user is ever set, it is cleared.
8. **Local clear fails** — `LargeSecureStore.removeItem` rethrows if either
   store's delete fails (Build 7 Bug 2). `signOut` then rejects: the user must
   still land on sign-in, the error goes to Sentry, no stuck loading button.
9. **In-flight requests** — a profile fetch/upload finishing after sign-out
   must not write state or show an error screen.

Plus `logs/LESSONS.md` checklist and the spec-trace table (DESIGN.md
"Build 9 — Settings screen", sign-out row) before commit.

---

# Phase 1-2 - Bella

## What was built
- **Settings idle screen** (`src/app/(tabs)/profile/settings.tsx`) replaces the placeholder: header with back chip, Account section (Edit profile photo / usertag, Comments on my collection: On, Sign out), About section with the TMDB chip and the required sentence, version footer. No Danger zone and no stub for it (Build 9).
- **Sign-out logic in the auth module**: `api/signOut.ts` (Supabase + Google, independent), `hooks/useSignOut.ts` (busy state, one run at a time), `api/configureGoogle.ts` (Google config shared by sign-in and sign-out). The route only calls `useSignOut()`.
- **AuthProvider** exposes `clearSession()` so the app can drop the session locally when storage cannot be cleared.
- **useOwnProfile** tags each result with the user it belongs to and cancels the newest fetch (focus or Retry) on sign-out/unmount.
- New shared UI: `ListRow`, `Toast` + `useToast` (DESIGN.md section 2 Toast, variants info/error/coming-soon), `GlassCard` gained `disabled`, and new tokens (`size`, `tmdbChip`, `opacity`, `letterSpacing`, `leading`, TMDB brand colors).

## Why this way
- **Data flow:** tap -> `useSignOut` sets busy -> `signOut()` runs Supabase `signOut({scope:'local'})` and `GoogleSignin.signOut()` in parallel (`Promise.allSettled`), reports failures to Sentry -> the hook calls `clearSession()` -> the root `Stack.Protected` gate sees `session === null` and shows sign-in. Normally the Supabase SIGNED_OUT event does this first; `clearSession` is the safety net.
- **Scope local, not global (failure 1):** global would also log the user out of other devices; local revokes only this device's refresh token. auth-js removes the local session even if the server call fails (offline), then returns the error, so offline still ends signed out.
- **Why `clearSession` exists (failure 8):** auth-js `_removeSession` awaits `removeItem` BEFORE notifying SIGNED_OUT. If `LargeSecureStore.removeItem` rejects, no event fires and the AuthProvider would keep the session, leaving the user on Settings. `clearSession` in the hook's `finally` fixes that. Residual risk (not fixed, flagged): if storage really cannot be cleared, the stored session survives a relaunch and a later token refresh could set it again; the Sentry report is how that would be noticed.
- **Big decision:** `signOut()` never rejects (it reports to Sentry instead), so callers cannot leave a button stuck.
- **Profile data (failure 4):** the hook returns loading unless the stored result's owner equals the current user id, so the previous user's data is never rendered, not even for one frame. The tabs also unmount via the auth gate.
- Alternatives rejected: a confirm dialog (DESIGN.md says none); a global store for sign-out state (one hook is enough); downloading a TMDB logo (told not to; text chip instead).

## Concepts learned
Promise.allSettled for independent cleanup steps; auth-js event ordering (storage delete precedes SIGNED_OUT); derived state keyed by owner instead of effect-based resets; ref guards for double tap and unmount; Stack.Protected as the auth gate.

## Failure-mode items -> handling -> test
| # | Handling | Test |
|---|---|---|
| 1 offline | scope local; error reported, session removed by auth-js; hook clears anyway | signOut-test "still signs out of Google when Supabase fails on the network" |
| 2 Google side | `GoogleSignin.signOut()` runs after `ensureGoogleConfigured()`; each step independent | signOut-test (Google fails; Supabase fails) |
| 3 double tap | `inFlightRef` + busy row (disabled + spinner) | useSignOut-test "one sign-out for two taps"; settings-test "ignores taps while running" |
| 4 no data left | owner-tagged result in useOwnProfile; auth gate unmounts tabs | useOwnProfile-test (drops previous user's data) |
| 5 cold relaunch | session removed from storage by auth-js | device: bella-03-relaunch.png |
| 6 sign back in | not touched (Queenie, needs account picker) | not tested by Bella |
| 7 Sentry | failures captured, success not; `Sentry.setUser(null)` | signOut-test (no capture on success; setUser(null)) |
| 8 local clear fails | signOut resolves + reports; hook `clearSession` in finally | signOut-test "store rejects"; useSignOut-test (clearSession called) |
| 9 in-flight | cancel on user change/unmount incl. Retry fetch; hook skips setState after unmount | useOwnProfile-test (3 late-result cases); useSignOut-test unmount |

Note on 9: an avatar upload finishing after sign-out is already stale-guarded in useAvatarUpload (no state, no error); its cleanup delete needs a session and will fail silently, so that object could be orphaned. Rare; left for Build 9's account cleanup.

## LESSONS checklist
- Spec-trace: below. Copy verbatim: yes; shared components take text from callers.
- Async failure paths: fail/cancel/double-tap/unmount covered above. Sentry only unexpected errors. Server code: none. Orphans: n/a (nothing stored).
- act(): 0 in jest output. Android blur: no BlurView (flat fills). Literals: none; fonts carry fontFamily only (checked on device).
- Header inset from `useSafeAreaInsets`; shared session from AuthProvider; logic in module; comments 1-2 lines, no history.
- Storage adapters never reject: untouched (`removeItem` still rethrows by design; handled by clearSession).
- /sdcard not used; screenshots via /data/local/tmp.

## Spec-trace (DESIGN.md "Build 9 - Settings" idle minus Danger zone, sign-out row, section 6, and the board)
| Spec line | Implemented at |
|---|---|
| Route `(tabs)/profile/settings.tsx` | settings.tsx |
| Header: back chip + "Settings" title, lavender200, nothing in the top-right 64x64 | settings.tsx:39-43, styles 94-103 |
| Section label "Account" (uppercase, micro, secondary) | settings.tsx:49, styles 107-115 |
| Row "Edit profile photo / usertag" | settings.tsx:51-53 (pushes /profile/edit) |
| Row "Comments on my collection: On" (On gold bold) | settings.tsx:54-58, style 117; UI-only tap -> Toast, :28 |
| Row "Sign out": card list-row, text.primary, no danger style, immediate (no confirm) | settings.tsx:59-61; ListRow.tsx |
| Sign out clears session, redirects to sign-in | useSignOut.ts, signOut.ts, root gate _layout.tsx |
| Section label "About" | settings.tsx:64 |
| About card, no glow | settings.tsx:65, styles 120-126 |
| TMDB chip, text-only | settings.tsx:67-69, styles 128-140, tokens `tmdbChip`, `brand.tmdb*` |
| "The Movie Database" label, text.secondary | settings.tsx:70, style 141 |
| Required sentence verbatim, caption, text.secondary, under logo | settings.tsx:23-26, 72, style 142 |
| Version footer text.disabled | settings.tsx:75-77 |
| Dev-client gear zone respected | header has no right-side element |
| UI-only rows give feedback (section 7) | settings.tsx:54, Toast.tsx |
| Danger zone / Delete row | intentionally NOT built (Build 9) |

## Flags for the Manager
- **TMDB logo:** no logo file; built a text-only chip per the board (22x14). DESIGN.md section 6 says the mock chip is 28x18 while board v6 draws 22x14; I followed the board. The official mark still needs an asset if Justin wants it.
- **About card fill:** section 6 says `glass.card`; the board draws rgba(30,26,38,.55), equal to `glass.nav.backgroundColor`; I followed the board.
- **Board sizes not on the type scale** (13px rows, 10px labels, 6px chip) mapped to nearest tokens (body 15, micro 11, caption 12).
- **UI-only row:** "Comments on my collection: On" toasts "Comment settings are coming soon." - this copy is NOT in DESIGN.md's table (Roulette pattern copied). The Toast component did not exist; built the minimal version (no fade, 2.5 s auto-dismiss).
- **Version footer** reads app.json version ("v1.0.0"); the board says "v0.1".
- Edit profile row is wired to the real edit screen.
- Touched outside strict scope: `GlassCard` (added `disabled` + button a11y role), `tokens.ts`, `useOwnProfile.ts`, `AuthProvider.tsx`, `signInWithGoogle.ts` (config moved to `configureGoogle.ts`). Each needed for failure modes 3/4/8/9 or the board.

## Gates
- `npx tsc --noEmit`: no errors. `npx expo lint`: no errors.
- `npx jest`: 14 suites, 70 tests passed; output has 0 "act(" and 0 console warnings.
- Metro bundled and ran on the emulator; stopped, port 8081 confirmed free.

## Device evidence (`logs/evidence/build-08/`)
bella-01-settings.png (Settings), bella-01b-toast.png (comments toast), bella-02-signed-out.png (after Sign out: sign-in screen), bella-03-relaunch.png (force-stop + relaunch: still sign-in). Did not sign back in.

## Manager — Phase 1–2 check + decisions (2026-09-30)
- Rerun at 83ff714: tsc clean, jest 70/70, 0 act()/console warnings (full output), lint clean,
  no secret files in the commit. `bella-01-settings.png` read: Sign out row, verbatim TMDB
  sentence, no Danger zone, gear zone clear.
- Decisions on Bella's flags: TMDB chip 22×14 per board v6 (board newer than §6 prose);
  About card fill per board; version footer reads app.json (board "v0.1" was placeholder);
  Comments-row toast copy "Comment settings are coming soon." accepted.
- For Build 9: an avatar upload finishing after sign-out can't delete its object (no
  session) → possible orphan; Build 9's account deletion removes the whole avatars/<uid>/ folder.
