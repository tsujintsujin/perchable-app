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
