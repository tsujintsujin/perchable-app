# Manager code review — Builds 1–7 (2026-09-28)

Justin asked: is Bella's code standard practice, no shortcuts like static
values? Manager read all of `src/` (~2,800 lines) plus the functions.

**Verdict: the logic is careful and well-tested, but it takes real
shortcuts in five places and the comments are the wrong shape.** Fixed in
one "code standards pass" before Build 8 (details at the end).

## What is good (keep doing it)
- Async safety: cancelled flags, no setState after unmount, debounced check
  guarded twice against stale responses (`useUsertagAvailability.ts`).
- Server side: user id always from the JWT, never the body; RLS tight;
  TMDB key never in the bundle; inputs validated (`supabase/functions/*`).
- Errors: user cancels not sent to Sentry; unique-violation (23505) as the
  source of truth; typed error states.
- Tests exist for the risky paths (27 passing).

## Findings — shortcuts

### 1. Hardcoded values instead of the design tokens (the "static" shortcut)
`src/ui/tokens.ts` has `type`, `glass`, `colors`, `spacing`, `radius` and
says no component should hardcode them. The screens hardcode anyway:
- Font sizes/families as literals (`fontSize: 12/15/19/22/24/38`,
  `"Poppins_700Bold"`) — `type.caption/body/subhead/title/hero` exist.
  `edit.tsx` 321–426, `profile/index.tsx` 137–176, `sign-in.tsx` 74–99,
  `settings.tsx` 35–40.
- Colors as literals: `"rgba(76,29,149,0.28)"` ×4, `"rgba(255,138,138,0.35)"`
  ×2, `"rgba(255,138,138,0.5)"`, `"rgba(76,29,149,0.3)"` — in `edit.tsx`,
  `profile/index.tsx`, `sign-in.tsx`. Need named tokens (e.g.
  `surface.input`, `danger.border`).
- The same error card is copy-pasted in `sign-in.tsx` and `edit.tsx` →
  one `src/ui/ErrorCard`.
- Raw spacing (`paddingHorizontal: 28`, `marginTop: 12/56`, `padding: 16`,
  `marginRight: 4`) where `spacing[…]` exists.

### 2. Fixed status-bar spacing: `paddingTop: 56`
`(tabs)/index.tsx:57`, `profile/index.tsx:134`, `profile/edit.tsx:318`.
56 happens to fit td_emu. On a phone with a taller notch or a different
status bar the header will sit under it or float too low. Use
`useSafeAreaInsets()` (already installed; sign-in does it right with
`SafeAreaView`). Also `paddingRight: 84` / `marginRight: 44` exist only to
dodge the dev-client gear — dev-only UI must not shape production layout.

### 3. Auth session: one subscription per caller, and data not reset
- `useAuthSession()` (`modules/auth/hooks/useAuthSession.ts`) starts its own
  `getSession()` + `onAuthStateChange` listener in every component that calls
  it — root layout, plus every screen using `useOwnProfile`. Standard
  practice: one `AuthProvider` (context) at the root, everyone reads it.
  `getSession()` also has no `.catch`.
- `useOwnProfile` keeps the last `loaded` profile when `userId` becomes
  undefined (sign-out) — a previous user's data can stay on screen.
  `refetch` copy-pastes the fetch without the cancelled guard.

### 4. Session stored in plain AsyncStorage
`src/lib/supabase.ts` stores the Supabase session (incl. refresh token =
account access) in AsyncStorage. Bella's own rules say tokens go in
`expo-secure-store`, and Ruby's checklist checks exactly this — both missed
it. SecureStore has a ~2 KB value limit, so use Supabase's documented
`LargeSecureStore` pattern (AES key in SecureStore, encrypted session in
AsyncStorage).

### 5. Untyped database access
No generated types: `data.display_name` etc. are unchecked;
`updateProfile.ts` builds a `Record<string, string>`. Generate
`src/lib/database.types.ts` with `npx supabase gen types typescript
--project-id <ref>` and pass it to `createClient<Database>()`.

### 6. Business logic in a route file
`profile/edit.tsx` (436 lines) holds the whole pick → upload → save →
cleanup flow. DESIGN.md §7: routes compose `ui/` + module hooks. Move it to
`modules/profile/hooks/useAvatarUpload.ts`; the screen calls it.
Also `edit.tsx` checks `if (cancelledRef.current) return;` twice in a row
(~lines 107–109).

### 7. Comments — wrong shape for Justin's rule
Comments are long essays full of history ("Build 6 · Bug 1:", "Manager's
decision", 15-line paragraphs), and many blocks have none. New rule (in
bella.md): every block gets a 1–2 line comment saying what it is for;
history goes in the Build log, not the code.

## Also noted (no change now)
- Home still shows Expo's template text — Home content is a later Build;
  update the smoke test when it changes.
- avatar_url stores a full URL, then parses the path back out
  (`deleteAvatarObject.ts`). Storing the storage path would be cleaner;
  revisit only if it causes a bug.

## The fix: "code standards pass" (before Build 8)
Bella, one commit per item group, gates after each, behaviour unchanged:
1. Tokens: add missing named tokens; replace every literal in screens;
   `ui/ErrorCard`. 2. Safe-area insets on every screen header.
3. `AuthProvider` + profile state reset on sign-out. 4. `LargeSecureStore`.
5. Generated DB types. 6. `useAvatarUpload` hook. 7. Rewrite comments in all
of `src/` + functions to the 1–2 line rule.
Then Queenie: pixel/regression check that every screen looks and behaves
exactly as before (sign-in, Home, Profile, Edit, debug), plus the session
survives relaunch after the storage change.

## Standards pass (2026-09-29) — reasoning moved out of code comments

Item 7 trimmed several long in-code essays to 1–2 line purpose comments.
Reasoning worth keeping, moved here instead of left in the code:

- **PLAN PROBLEM, still open**: `settings.tsx`'s doc comment used to flag
  that DESIGN.md §7's rule ("TMDB attribution must render on every build
  with the TMDB proxy, Build 3 onward") can't be satisfied yet, because the
  screen that attribution lives on (§6 Settings) isn't built until Build 9.
  That gap has existed since Build 3 and is still unresolved — flagging for
  the Manager/Priya, not something this pass fixes.
- ⚠️ Big decision (`edit.tsx`, unchanged from Build 7): a picked photo
  uploads and saves to `profiles.avatar_url` immediately on pick, not gated
  behind Save — DESIGN.md already describes the photo and usertag as
  independent fields with independent save outcomes, and this avoids a
  confusing dual-purpose Save button.
- `uploadAvatar.ts` used to upsert one fixed path with a `?v=` cache-buster;
  that let an unabortable, cancelled upload still overwrite the current
  photo once any cache was bypassed. Fixed by giving every upload a unique
  path, with `deleteAvatarObject` cleaning up the now-orphaned object after
  a cancel or a successful replace — the tradeoff (every change leaves one
  object to clean up) is handled entirely by that cleanup.
- `TabBar`/`GlassCard`'s Android blur notes: without a `BlurTargetView`,
  `expo-blur` paints its `tint` as an opaque flat grey instead of blurring,
  confirmed by on-device pixel sample — both components fall back to a flat
  fill on Android and use the real `BlurView` on iOS only.

### Second pass (2026-09-29) — Manager review found 32 blocks still over 2 lines
Squeezed further to the letter of the rule (every `//`/`/** */` run ≤ 3
raw lines). Additional reasoning moved here:
- `supabase/functions/tmdb/index.ts` and `delete-account/index.ts`: both
  rely on Supabase's project-default `verify_jwt: true` (no per-function
  override in `config.toml`) to prove the caller carries a validly-signed
  JWT, then call `auth.getUser(token)` themselves to prove it's a real
  signed-in user (the anon key is also a validly-signed JWT, so
  `verify_jwt` alone doesn't prove that). `delete-account` additionally
  uses one `createClient` instance for both `auth.getUser(token)`
  (validates that specific token) and the service-role admin/storage calls.
- `TabBar`: the skipped `tabPress`/`canPreventDefault` dance and the
  Android `BlurTargetView` gap both trace to the same root cause — this is
  a custom `tabBar` render prop, not the default bottom-tab-bar, so neither
  hook is reachable without forking the navigator's own layout.
- Also fixed per Manager review: `settings.tsx`'s and `debug.tsx`'s
  user-visible "Build 9"/"Build 4" strings (no reason for a shipped screen
  or a Sentry test message to leak internal Build numbers), and
  `useAvatarUpload.ts`'s duplicate back-to-back `if (cancelledRef.current)
  return;` (the second was redundant — no `await` between the two checks).

### On-device check (2026-09-29)
Native rebuild for `expo-secure-store`/`aes-js`/`react-native-get-random-values`
succeeded; app bundled and opened to the sign-in screen with no visual
regression. As expected from the `LargeSecureStore` migration, the
previously-signed-in session did not carry over (the old plain-AsyncStorage
session isn't readable by the new storage) — one re-sign-in is required.
Couldn't complete a real Google sign-in myself; Queenie/Justin should sign
in once and confirm Home/Profile/Edit/Settings each open.

## Manager correction after Ruby's re-review (2026-09-29)
- `supabase/functions/delete-account/index.ts` first entered git in eafbfe8
  ("comments" commit). It was written by Bella on 2026-09-26 at the Manager's
  request as Build 9 prep, left untracked by the Manager, then swept into the
  comment pass. It is **not deployed and not wired to any UI**. Ruby's
  2026-09-29 review is its first logic review (sound: uid from the caller's
  JWT only, storage cleanup before deleteUser, "not found" retry = success).
  It gets a full review again when Build 9 wires it up.
- Correction to "Second pass": only `delete-account` calls `auth.getUser(token)`.
  `tmdb` relies on the platform `verify_jwt` gate alone, which is enough —
  it serves no user-scoped data.
