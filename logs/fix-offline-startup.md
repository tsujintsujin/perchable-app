# Fix ticket — offline cold start shows a blank screen ~30 s (found by Queenie, Build 12b QA)

Status: OPEN — scheduled right after Build 12b closes, before Build 13.

## Diagnosis (Manager, from code, 2026-10-01)
- `src/app/_layout.tsx` keeps the splash / returns `null` until `useAuthSession().isLoading` is
  false, i.e. until supabase-js fires `INITIAL_SESSION`.
- On start-up auth-js runs `_recoverAndRefresh` (GoTrueClient.js ~4100): with an expired access
  token it calls `_refreshAccessToken`, which retries with 200·2^n ms back-off **until the
  30 s auto-refresh tick window** (`AUTO_REFRESH_TICK_DURATION_MS`) — offline every attempt fails
  instantly, so the whole window is spent. Only then does INITIAL_SESSION fire.
- Result: offline + expired token ⇒ ~30 s of nothing on screen. Online, or with a fresh token,
  start-up is fast — which is why it was never seen before.

## Done means (to be confirmed by Priya/Ruby before Bella builds)
1. An offline cold start shows the app (or a clear branded state) within ~3 s — never a blank
   screen; once auth settles the app shows the right signed-in / signed-out screen.
2. A stored session is never trusted for writes it can't refresh; data screens show their normal
   offline error states (Home's error + Retry, Profile's error + Retry).
3. A genuinely invalid / revoked refresh token still ends in the sign-in screen (no "ghost"
   signed-in UI) — including Build 10a's ban (refresh refused).
4. No regression of Build 8's latch / Build 2's AuthProvider ordering tests.
5. Tests for each; Queenie device check offline with an expired token (wait > 1 h, or force
   expiry), and online.
