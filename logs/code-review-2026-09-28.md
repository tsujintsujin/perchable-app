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
