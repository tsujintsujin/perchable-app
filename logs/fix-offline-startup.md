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

---

# Fix — implementation (Bella, 2026-10-01)

## Verified in the auth-js source (node_modules/@supabase/auth-js)
- `_refreshAccessToken` retries a retryable fetch error (offline = status 0) with back-off until
  `AUTO_REFRESH_TICK_DURATION_MS` (30 s). Only then does `_recoverAndRefresh` return and
  `initializePromise` resolve, so INITIAL_SESSION waits for it.
- `_callRefreshToken` removes the session (and emits SIGNED_OUT) only for a non-retryable error
  with an expired access token. A retryable error leaves the session in storage untouched. It
  caches the failure for `REFRESH_FAILURE_COOLDOWN_MS` (60 s), so the second refresh inside
  `__loadSession` fails at once.
- `_emitInitialSession` then sees an expired stored session + failed refresh and emits
  `INITIAL_SESSION` with null even though the session is still in storage. So the baseline was
  worse than a blank screen: after 30 s an offline user with a valid refresh token landed on the
  sign-in screen. Constraint 2 ("network failure keeps the user signed in") was not met before this fix.
- `supabase.auth.getSession()` also waits on `initializePromise`, so no auth-js call can be used to
  get the session early. Reading storage directly is the only public route.

## Approach chosen: optimistic render from the stored session, then reconcile from storage
1. `readStoredSession()` (src/lib/supabase.ts) reads the persisted session through the same storage
   adapter the client uses (the adapter never rejects) and shape-checks it. The storage key is now
   passed explicitly (same value supabase-js derives, so nobody is signed out by this change; the
   device stayed signed in).
2. AuthProvider starts a 2 s timer (`OPTIMISTIC_START_MS`). If no auth event has arrived, it shows
   the stored session (or signed-out when nothing is stored) and ends `isLoading`. Any auth event
   clears the timer.
3. When auth-js finally emits `INITIAL_SESSION` with null, the provider re-reads storage instead of
   trusting the null: a session still in storage means the refresh failed on the network, so the
   user stays signed in; empty storage means it was refused (or never existed), so signed out.
4. A per-event counter drops a storage read that finished after a newer event, and the existing
   `clearSession` latch also blocks a late read.

### Why this one (alternatives rejected)
- "Connecting..." state that resolves to sign-in vs app: satisfies "not blank" but the user still
  waits ~30 s for the real screen, and it adds a new screen.
- `autoRefreshToken: false` at start-up and refreshing ourselves with a short timeout: works, but
  re-implements auth-js's refresh/cooldown/lock logic (against "work through the public API").
- Patching or forking auth-js constants: forbidden.
- Optimistic stored session (chosen): smallest change, one provider. Constraint 2 is met by the
  storage re-read, a signal auth-js itself provides (it empties storage on refusal before emitting).
- Ghost-UI risk on a refused refresh: online, a refusal returns well inside the 2 s timer, so the
  optimistic screen is never shown; offline nothing can be refused. A refusal arriving after an
  optimistic render ends in SIGNED_OUT or an empty-storage INITIAL_SESSION, both set signed-out and
  the route guard returns to sign-in.
- The optimistic session is never used for requests: supabase-js reads its own auth state, not ours,
  so a stored-but-expired token is never sent (Done-means 2). Known limit: a data request made in
  the first 30 s waits on auth-js's `initializePromise`, so Home/Profile show their skeleton for up
  to ~30 s before their normal error + Retry (see Follow-up).

## Done means -> handling -> test
| # | Handling | Test |
|---|---|---|
| 1 app within ~3 s offline | 2 s timer renders stored session / signed-out | "shows the stored session after the timeout while INITIAL_SESSION is still pending"; "shows the signed-out state after the timeout when nothing is stored" |
| 2 data screens normal offline | optimistic session not used for requests; screens untouched | device: Home "Couldn't load movies" + Retry and Profile "Couldn't load your profile" + Retry after the 30 s window |
| 3 refused refresh -> sign-in | SIGNED_OUT or empty-storage INITIAL_SESSION sets null | "ends signed out when the refresh is refused after the optimistic render"; "...null INITIAL_SESSION follows a refused refresh (storage emptied)" |
| 2b network failure keeps user in | null INITIAL_SESSION re-reads storage | "stays signed in when a null INITIAL_SESSION follows a network-failed refresh"; "keeps the stored session on a null INITIAL_SESSION even with no earlier timeout" |
| 4 latch / ordering | `clearedRef` checked before applying the read; the 9 existing tests untouched | "does not apply the stored session after clearSession"; existing latch tests pass |
| races | event counter | "does not touch storage once an auth event has already arrived"; "drops a slow storage read when a newer auth event arrived meanwhile" |
| storage read | `readStoredSession` | LargeSecureStore-test: returns session; null for absent / bad JSON / missing fields |

Revert check: with AuthProvider reverted, 5 of the 9 new AuthProvider tests fail. The other 4 are
guard tests; each was proven by mutation (removing the event-counter check, the latch check, or the
timer clear makes exactly its guard test fail).

## Gates
- `npx tsc --noEmit` app 0 errors, `-p supabase/functions/tsconfig.json` 0 errors; `npx expo lint` clean.
- `npx jest` twice: 36 suites, 349 tests passed both runs (was 338; +11); 0 `act(` and 0 console
  warn/error in either output; out files deleted.

## On device (td_emu, rebooted first; own Metro, stopped, port 8081 free; Justin's account, no sign-out)
Expired token forced by setting the emulator clock +3.5 h (`adb root`, `auto_time 0`, wifi+data off).
Confirmed real: auth-js logged `AuthRetryableFetchError ... UnknownHostException` ~31 s after JS start.
Times are from `am start`. The emulator is slow, so dev-client launch + bundle load add ~17-26 s before
"Running main" in every run; the useful number is the delta after JS start.

| Run | "Running main" | App content first seen | Delta after JS start |
|---|---|---|---|
| Before fix, offline + expired | +20.4 s | +52.5 s (blank until then, before-blank.png) | ~32 s |
| After fix, offline + expired | +17.5 s | +24.9 s (fix-offline-start.png) | ~7.4 s |
| After fix, online + fresh token (harness baseline) | +26.7 s | +36.5 s | ~9.8 s |

The offline start now lands in the same range as an online start in this harness (the 2 s timer is
inside the noise). After the 30 s window the user was still signed in (after-30s-home-error.png), Home
showed "Couldn't load movies" + Retry, and Profile showed "Couldn't load your profile" + Retry
(offline-profile.png). Not tested on device: a refused refresh (needs a revoked token); covered by unit
tests only. Clock restored (auto_time on, host time), wifi/data re-enabled, nothing written to /sdcard.
Evidence: logs/evidence/fix-offline-startup/.

## Follow-up (not done, outside this fix)
Data requests made in the first 30 s offline still wait on auth-js start-up before failing, so Home
shows its skeleton ~30 s before the error + Retry. Fixing that needs an auth-js change or moving the
movie calls off the client's auth wait; raise with the Manager if it matters.

## Concepts learned
Optimistic UI + reconcile; a library's ready signal can be gated on retries you don't control; read the
persisted store directly when the library's own accessor is gated on that same signal; guarding async
reads with a monotonically increasing event counter; faking device time to expire a token.

---

# QA (Queenie, 2026-10-01) — commit 0ed5adb, td_emu restarted first, Justin's account (no sign-out/edits)

Method: own Metro via `adb reverse` + `localhost:8081`; expired token forced with `adb root`, `auto_time 0`,
`date 100115192026.00` (+3.5 h) and wifi+data off. Launching via the deep link only opens the dev launcher on
this build, so each run = force-stop, open launcher, **tap the localhost entry, time from the tap** (poll
`screencap`, ~1 s granularity, +/- 1 s). "JS start" = logcat `Running "main"`. Evidence: `logs/evidence/fix-offline-startup/qa-*.png`.

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | Offline + expired token, first app screen | **PASS.** Real expiry confirmed: `AuthRetryableFetchError ... UnknownHostException` logged 15:20:26.6, 29.8 s after JS start. App shell (Home, skeleton cards) first seen ~20.5 s after tap = **~8-9 s after JS start**; no blank after JS start | qa-01-first-screen.png (qa-01a = blank frame just before) |
| 2 | Wait 40 s: still signed in; Home error; Profile error | **PASS, with the known slow part.** Signed in at 40 s+ (tab bar, owner avatar placeholder "?", not sign-in). Home showed "Couldn't load movies" + Retry at 15:21:01 (it was the skeleton at 15:20:26; error seen by 56 s after JS start). Profile opened at 15:21:03 stayed on skeleton for **1.5-2.5 min** (error first seen 15:24:02, still skeleton at 15:22:52), then "Couldn't load your profile" + Retry | qa-02, qa-02b (skeleton), qa-02c (error) |
| 3 | Network on, clock still +3.5 h, Home Retry | **PASS.** Movies load within 8 s, avatar returns, still signed in | qa-03 |
| 4 | Online + fresh token (clock auto, ~11:56) | **PASS.** Signed in, Home filled with posters | qa-04, qa-04b |
| 5 | Offline + fresh token | **PASS.** Signed in, Home posters shown from cache, avatar "?" | qa-05, qa-05b |
| 6 | Regression | **PASS.** Profile loads (Justin Masiga, @tsujintsujin); Settings shows Blocked users + "The Movie Database" TMDB attribution; Blocked users opens ("No blocked users"); Roulette "Surprise Me" toast "Smart picks are coming soon." | qa-06a/b/c/d |
| 7 | am_anr / logcat | **0 ANRs from the app.** 1 `am_anr` in the whole buffer: `com.android.systemui ... executing service KeyguardService, waited 20711ms` at 11:31:51, i.e. at emulator snapshot restore, before any app launch. 0 red (`*:E`) lines from the app/ReactNativeJS/AndroidRuntime. Only warnings: the `AuthRetryableFetchError ... UnknownHostException` (exact text above, logged twice at 15:20:26.574/.607, expected offline) | logcat |

## Timings (ms after tap on the dev-launcher entry; JS start from logcat)

| Run | JS start ("Running main") | First app screen | First screen after JS start | Home filled |
|---|---|---|---|---|
| 1 Offline + expired | ~+12 s | ~+20.5 s | **~8-9 s** | n/a (skeleton, then error ~+57 s after JS start) |
| 4 Online + fresh | +16.7 s | ~+28.5 s | ~12 s | ~+34.5 s (~18 s after JS start) |
| 5 Offline + fresh | +14.3 s | ~+27.5 s | ~13 s | ~+30.5 s (~16 s after JS start) |

Before the fix (Bella): ~32 s after JS start offline+expired; now ~8-9 s, so no long blank. Online/fresh runs
were slower than offline/expired in this session (emulator noise, +/- 1 s sampling): the fix is not what
slows them; the 2 s timer is inside the noise.

## Observations to judge (not failures of this fix)
- Profile offline skeleton lasts 1.5-2.5 min before its error + Retry (Home ~30 s). Done-means 2 asks for the error state; it does arrive but late. Likely react-query retry back-off on top of the auth-js wait; Ruby to judge the cause.
- Home avatar showed "?" right after the network came back until Profile data loaded (qa-06c); resolves on its own.
- Not tested (as agreed): refused/revoked refresh token on device. Unit tests only.

## Cleanup
Clock back to automatic (`auto_time 1`, device date 12:00 = host UTC), wifi + data on, my Metro (pid 22176, checked command line) stopped, 8081 free, `adb reverse --remove-all`, nothing written to /sdcard. Bella's earlier evidence files left untouched.
