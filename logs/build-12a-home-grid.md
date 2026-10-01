# Build 12a — Home poster grid, first page (Module 4: Movie browse/details)

Base SHA: 257330b (2026-10-01, branch `module/movie-browse` from main)
Plan: PLAN.md "Build 12a" A1–A7, B1–B9 + Module 4 decisions M1–M10 (Priya 5c5981c, revised
f7b0498 + 1f8af87 after two Ruby reviews). NEEDS JUSTIN N1–N7: defaults apply (Justin away,
asked that work continue). Phase 0: Dianne (DESIGN.md "Build 12").

## Failure-mode list (Manager, before Phase 1) — each is a Done-means line + a test
PLAN.md's 12a failure modes apply in full. Manager additions / emphasis:
1. **Server first, app second** — the hardened `popular` function (`_shared/tmdb.ts` + index.ts)
   is its own commit; Ruby reviews it; the **Manager deploys and curls** (no auth → 401; page
   `1e2`, `0`, `501`, `%205` → 400; valid page → 200 with `Cache-Control`; no key text in any
   error) before Queenie runs. Bella never deploys.
2. **Debug button unchanged** — `getPopularMovies(page = 1, signal?)` stays call-compatible;
   the Build-3 "FETCH POPULAR MOVIES" button still works (Queenie regression).
3. **No infinite spinner, ever** — every path ends in filled / empty / error within ~17 s;
   offline cold start shows loading then the error state with Retry.
4. **Sentry** — only `upstream_auth`, `misconfigured`, unexpected 5xx-with-code and `shape`;
   never offline / timeout / 4xx / unmapped relay 502. Environment tag on.
5. **Sign-out while loading** — no setState after unmount, no error flash on the sign-in screen.
6. **Images** — poster null → fallback; poster URL 404 → same fallback; `recyclingKey` set.
7. **Native rebuild check** — `npx expo install --check` + the installed packages' native
   folders: if any new native code appears, STOP and report — the Manager rebuilds the dev
   client before QA (Gradle recipe in LESSONS; one run at a time).
8. **Not tappable in 12a** — posters have no press state and no navigation (DESIGN §7: no
   silent no-op); taps do nothing visible because there's no affordance.
9. **Standards** — tokens only, no `fontWeight` with custom fonts, 1–2 line comments, logic in
   `src/modules/movies/`, route files compose only; fix the Ruby formatter nits from 10b
   (SheetShell.tsx:45-49 indentation) only if touched.
10. **Emulator** — restart td_emu before device work (CLAUDE.md "Emulator setup + health");
    screenshots are 1.75 px/dp.

---

# Bella — Phase 1–2 (2026-10-01)

Commits on `module/movie-browse`: server `2dc6fe9` (own commit); app commit follows (`Build 12a: Home poster grid`, see `git log`).
Not deployed (the Manager deploys after Ruby). **The device check ran against the function version already deployed
(Build 3's `popular`: untrimmed results, no `code` field).** The new app code only needs `results`/`page`/`total_pages`, which that version returns.

## What was built (concept / flow)
**Server.** `supabase/functions/_shared/tmdb.ts` is a pure file (no `Deno`, no imports). It validates `endpoint` and `page`
(`/^\d+$/`, then 1–500), checks the key, calls TMDB through an injected `fetchUpstream`, and maps failures to a fixed `{error, code}` body
(TMDB 401/403 → 502 `upstream_auth`, missing key → 500 `misconfigured`, network → 502 `upstream_network`, 404 → 404, 429 → 429,
anything else → 502 `upstream_error`). It drops `adult:true` titles, trims each movie to the five fields the app reads, and sets
`Cache-Control: public, max-age=300` on success only. `tmdb/index.ts` is now only `Deno.serve`, CORS and wiring.
Because the flow takes `fetchUpstream` and `logError` as arguments, Jest runs every branch, including the missing key and the log redaction.

**App flow.** Home (`(tabs)/index.tsx`) calls `usePopularMovies()` (an infinite query keyed `["movies","popular"]`, page 1 only for now) and
hands `state`/`movies`/`retry` to the module's `PosterGrid`. `getPopularMovies(page, signal)` calls the proxy with `timeout: 8000`
and the query's abort signal, turns any functions-js error into a `MovieApiError` (`kind`, `status`, `code`), and checks the body with `parsePopular`.
The QueryClient (`src/lib/queryClient.ts`, provided once in the root layout, outside `AuthProvider`) retries once after 1 s for timeout, network
and 5xx only; its `QueryCache.onError` is the single Sentry hook. The hook maps the query to loading / filled / empty / error. `PosterGrid` is a
3-column `FlashList` whose header (the Roulette card, passed in by the route, plus the "Popular right now" title) scrolls with the grid; empty and error
use the same list with an `EmptyState` instead of tiles. `PosterCard` shows a shimmer until the image loads, then the image, and a 🎬 + title
fallback when there is no poster or the image fails.

## Why this way (decisions, alternatives rejected)
- **The whole request flow is in the pure file, not just helpers.** Injecting `fetchUpstream`/`logError` makes the missing-key and network branches testable; `index.ts` stays about ten lines. Helpers-only would leave the error mapping unrun by any gate.
- **Fixed error bodies.** TMDB's `status_message` is no longer passed through (Build 3 did); the app only needs `code`.
- **Response trimmed to five fields.** Smaller payload, nothing of TMDB's internals reaches the client. Details (Build 13) gets its own endpoint.
- **`useInfiniteQuery` already in 12a.** M4 fixes the key; 12b then only adds `fetchNextPage`. Starting with `useQuery` would change the cached data shape later.
- **Retry uses `refetch({cancelRefetch:false})`.** The default cancels and restarts on a second tap; this joins the running request, so a double tap sends one.
- **`PosterCard` keeps `failedUrl`/`loadedUrl`, not booleans.** FlashList recycles components; a boolean would carry one movie's failed image into the next movie shown in that cell.
- **Retry and Sentry rules live in `MovieApiError.ts`,** next to the type they read, and `queryClient.ts` imports only that file (no loop through the module index).
- **Debug link kept** in the Home header, `__DEV__` only, so the Build-3 "FETCH POPULAR MOVIES" button stays reachable. DESIGN does not list it; it is absent from release builds and sits left of the avatar, outside the gear zone.
- **⚠️ Big decision: own `jest.setup.js` instead of FlashList's `jestSetup`.** FlashList 2.0.2's shipped `jestSetup.js` swaps `FlashList` for `RecyclerView`, which that version does not export, so `FlashList` becomes `undefined` and any screen using it fails to render in Jest. `jest.setup.js` keeps the real list and stubs only layout measuring (fixed 400x900). Delete it if a later FlashList fixes its own setup.

### Concepts learned
- **TanStack Query**: a cache of async results keyed by an array. `staleTime` (fresh), `gcTime` (kept after unmount), `retry`/`retryDelay`, `QueryCache.onError` (one global failure hook), `setQueryDefaults` (per-key options kept on the client), infinite queries (a `pages` array and `getNextPageParam`).
- **AbortSignal**: React Query hands every `queryFn` a `signal`. When the screen unmounts with no other observers it aborts; passing the signal to the request stops it. That is what makes sign-out-while-loading quiet.
- **FlashList recycling**: cells are reused for other rows, so per-cell state must be keyed by the row's data, and `recyclingKey` tells `expo-image` to drop the old image.
- **Testing an Edge Function without Deno**: keep logic pure and inject the platform pieces (fetch, logger); then it is an ordinary TypeScript file Jest and `tsc` can check.
- **Safe-area header**: `paddingTop = insets.top`, with a fixed row height below it.

## Native check (failure-mode 7) — verdict: NO native code, no rebuild needed
`npx expo install @tanstack/react-query @shopify/flash-list` installed `@shopify/flash-list@2.0.2` and `@tanstack/react-query@5.104.0`.
Neither package contains `android/`, `ios/`, a `.podspec`, `expo-module.config.json`, `react-native.config.js` or a codegen config; both are JavaScript-only
(`flash-list` depends only on `tslib`, `react-query` only on `@tanstack/query-core`). The existing dev client ran the new code with no rebuild.
`npx expo install --check` still lists three **pre-existing** mismatches that this Build did not cause: `expo-glass-effect 57.0.3` (wants ~57.0.4),
`expo-linking 57.0.10` (~57.0.11), `expo-router 57.0.22` (~57.0.24). Not upgraded: they are native-bearing and an upgrade would force a dev-client rebuild. Left for the Manager.

## Failure-mode list → handling → test
| # | Item | Handling | Test |
|---|---|---|---|
| 1 | Server first, no deploy | own commit `2dc6fe9`, not deployed | `tmdbProxy-test.ts` (25) |
| 2 | Debug button unchanged | `getPopularMovies(page = 1, signal?)` same call shape and return; `__DEV__` Debug link kept | `movieApi-test.ts` (default page, options). **Not exercised on device by Bella**: Queenie's regression |
| 3 | No infinite spinner | 8 s timeout + one retry + error state with Retry | `home-test.tsx` offline cold start (loading → error after the retry → Retry loads); `queryClient-test.ts` retry table |
| 4 | Sentry rules | `shouldReportMovieError` + `QueryCache.onError`, once per failed query | `queryClient-test.ts`: 500 misconfigured, 502 upstream_auth and shape captured once each (5xx is retried, still once); offline, timeout, 400/401/404/429, 502 upstream_network and relay 502 not captured. `home-test.tsx` shape + offline |
| 5 | Sign-out while loading | unmount aborts the request (signal); a late 401 is a 4xx so unreported; the session guard unmounts Home | `home-test.tsx` "aborts the request on unmount" (signal aborted, 0 Sentry, 0 console.error) |
| 6 | Images | null poster → fallback; `onError` → fallback; `recyclingKey` = id; state keyed by URL | `PosterCard-test.tsx` (8) |
| 7 | Native rebuild check | verdict above | manual |
| 8 | Not tappable | no `onPress`, no button role | `PosterCard-test.tsx`, `home-test.tsx` "not tappable" |
| 9 | Standards | tokens only (new: `size.posterAspect/gridColumns/gridGap/homeHeaderInset/avatarSlot`, `spacing[14]`, `overlay.shimmerWash`, `lineHeight`, `motion.imageFade`), no fontWeight, route composes only; SheetShell.tsx not touched | greps below |
| 10 | Emulator | restarted per CLAUDE.md before device work | n/a |

## Spec-trace — DESIGN.md "Build 12" (12a parts) → file:line
| Spec line | Where |
|---|---|
| Header: safe-area top inset, 48 row, left 20, avatar slot right edge 72 | `(tabs)/index.tsx:22` (inset), `:52-58` (row, paddingLeft, `homeHeaderInset`), `:61-66` (slot 48) |
| Wordmark "🦉 perchable", `subhead`, `accent.gold` | `(tabs)/index.tsx:24`, style `:59` |
| Avatar sm centred, tap → Profile, label "Open My Profile" | `(tabs)/index.tsx:27-35` |
| Header fixed, outside the list; gear zone empty | header is a sibling of `PosterGrid` (`index.tsx:22` vs `:39`); device dump shows nothing in the top-right 64x64 but the dev gear |
| FlashList 3 columns, content padding sides 20 / bottom 16 | `PosterGrid.tsx:68` (numColumns), `:93-98` (20 − half gap; 16 − gap) |
| List header: 12 top, Roulette card, section title (24 above, 12 below, subhead, lavender200, role header) | `PosterGrid.tsx:74-80`, styles `:100-107` |
| Roulette card: lg radius, padding 20, `glass.hero` fill + hairline, flat, no BlurView | `RouletteCard.tsx:26-33` |
| Roulette eyebrow caption uppercase, letterSpacing label, lavender200; 6; title 24/30; 14; gold Button full width, 48 | `RouletteCard.tsx:34-48` (`spacing[6]`, `lineHeight.title`, `spacing[14]`; Button is 48 high) |
| Roulette button full strength, label / accessibilityLabel / Hint | `RouletteCard.tsx:12-18`; `Button.tsx` gained optional `accessibilityHint` |
| Roulette Toast "Smart picks are coming soon.", coming-soon variant, nothing else | `(tabs)/index.tsx:43,45` |
| Grid gap 10, tile = (W−40−20)/3, tile 2:3 | `PosterGrid.tsx:15-33` (cell half gaps), `PosterCard.tsx:78-84` (`size.posterAspect`); device: tile 117 dp at 411 dp |
| PosterCard: radius sm, 1px hairline, overflow hidden, flat, no BlurView | `PosterCard.tsx:77-84` |
| Loading tile: elevatedFlat + usePulse + shimmerWash | `PosterCard.tsx:15-23`, styles `:87-88` |
| Loaded: expo-image cover, memory-disk, recyclingKey id, 200 ms fade | `PosterCard.tsx:52-63` |
| Failed / no poster: 🎬 22, 8, title caption secondary centred max 3 lines | `PosterCard.tsx:64-71`, styles `:91-105`; `onError` `:61` |
| Poster a11y: image role, "{title}, {year}"; loading tiles hidden | `PosterCard.tsx:42-47`, `:27-31` |
| Year rule `^\d{4}` | `releaseYear.ts` |
| Loading: 12 tiles, one polite "Loading movies" | `PosterGrid.tsx:12-14,81` |
| Empty: 🎬 EmptyState + Retry, title hidden, 32 gap | `PosterGrid.tsx:49-56,112`; `showTitle` `:44` |
| Error: 🦉 EmptyState + Retry, title hidden | `PosterGrid.tsx:57-63` |
| EmptyState action ≥ 48 | `EmptyState.tsx:43` (`size.minTouch`); role button `:19` |
| Copy table (12a rows) | Roulette strings `RouletteCard.tsx:11-16`; title and live region `PosterGrid.tsx:77,81`; empty/error `:51-60`; Toast `index.tsx:43` |
| Tokens §1.9 used by 12a | `tokens.ts` (added); `footerRow` and the details tokens are 12b/13 and not added |
| Tab bar stays on Home | untouched (`(tabs)/_layout.tsx`) |
| Footer / paging / refresh | 12b, not built |

## Spec-trace — PLAN 12a → file:line + test
| Item | Where | Test |
|---|---|---|
| A1 client defaults, provided once | `queryClient.ts:9-34`; `_layout.tsx:22` | `queryClient-test.ts` defaults |
| A2 timeout + signal | `getPopularMovies.ts:8-14` | `movieApi-test.ts` options. **Manager's one-off abort proof still to run** |
| A3 typed error + retry from real classes | `MovieApiError.ts:6-52` | `movieApi-test.ts` mapping; `queryClient-test.ts` once/twice table |
| A4 validators + Sentry | `parsePopular.ts`; `queryClient.ts:12-17`; `MovieApiError.ts:55-60` | `movieApi-test.ts` parsePopular (8 bad shapes, 2 good); `queryClient-test.ts` Sentry |
| A5 server hardened | `_shared/tmdb.ts` | `tmdbProxy-test.ts`. **Manager's curl after deploy pending** |
| A6 `tmdbImage` | `tmdbImage.ts` | `tmdbImage-test.ts` |
| A7 install, check, FlashList Jest setup, tsc target | `package.json`, `jest.setup.js`, `supabase/functions/tsconfig.json` | gates below; native verdict above |
| B1 Home layout live | `index.tsx`, `PosterGrid.tsx` | `home-test.tsx` filled; device `logs/evidence/build-12a/bella-home-filled.png` (20 posters, last row 2) |
| B2 Roulette Toast | `index.tsx:43-45` | `home-test.tsx` Roulette; `bella-roulette-toast.png` |
| B3 four states | `PosterGrid.tsx` | `home-test.tsx` loading / empty / error / filled |
| B4 PosterCard | `src/ui/PosterCard/` | `PosterCard-test.tsx` |
| B5 fallbacks | `PosterCard.tsx` | `PosterCard-test.tsx`; QA does the cut-network device case |
| B6 offline cold start | retry policy + error state | `home-test.tsx` (logic); timing on device is Queenie's |
| B7 a11y | labels, Retry 48 | `home-test.tsx`; device dump: "Spider-Man: Brand New Day, 2026", "Surprise me", 84 px (48 dp) avatar slot |
| B8 Ruby greps | greps below | n/a |
| B9 DESIGN §3/§4 | done by Dianne in Phase 0 | n/a |

## LESSONS checklist
- Spec-trace filled (above); copy verbatim from the table; shared components never hardcode a caller's text (EmptyState and Button take props).
- Failure paths: fail, cancel (signal), double tap (`cancelRefetch:false`) and unmount abort are covered above. Sentry unexpected-only; the `environment` tag is set globally by `initSentry`, and the capture adds `kind/status/code` tags.
- Server validation: `parsePage` and the endpoint whitelist; error bodies are fixed text, never key or URL (`tmdbProxy-test` asserts the key is absent from every error body and log).
- Stored objects/rows: n/a (no storage, no rows; the TanStack cache is memory only).
- act(): zero. The full run has 0 "act(" and 0 console warnings.
- Android blur: none used (flat `glass.hero` fill, flat tiles); looked at on the emulator.
- Tokens only, safe-area header, shared state, secure storage, generated types: a token was added for every new value; the header uses `useSafeAreaInsets`; no new shared state; no new DB access; the route composes only.
- Comments are 1–2 lines with no history. No `fontWeight` (`tokens-test` passes).
- Moderation carry-forward (new tables, ReportSheet, composers, admin doc, RLS functions): n/a, no table or UGC surface in this Build.
- Testing environment: screenshots pulled with `exec-out` (nothing written to `/sdcard`); `uiautomator dump` to `/data/local/tmp`. No Google sign-in touched. No release APK built.
- Emulator restarted before work; load 1.4–1.7 (<3).

## Gate outputs
- `npx tsc --noEmit`: clean. `npx tsc --noEmit -p supabase/functions/tsconfig.json`: clean. `npx expo lint`: clean.
- `npx jest > out.txt`: **32 suites, 296 tests passed.** This Build added `tmdbProxy` 25, `movieApi` 19, `queryClient` 21, `tmdbImage` 10, `PosterCard` 8 and rewrote `home` (12 tests, was 1). `grep -c "act("` = 0; no console warning or error lines. `out.txt` deleted, not committed.
- Starts: Metro bundled the app (2087 modules) and the dev client rendered Home on td_emu with live TMDB posters; Metro stopped, port 8081 free (0 listeners).
- Greps on the diff: no hex or rgba literals, no `fontWeight`; remaining numerals are `"100%"`, the named `SKELETON_COUNT = 12`, and counts in comments.

## Flags for the Manager
- Pre-existing: `expo install --check` lists expo-glass-effect, expo-linking and expo-router one patch behind (native; untouched).
- `EmptyState` got `accessibilityRole="button"` on its action (so TalkBack and Jest see Retry as a button) besides the 48 dp fix; `Button` got an optional `accessibilityHint`. Both are shared; other callers are unaffected.
- New `spacing[14]` token (the Roulette card's 14 gap, which DESIGN gives and the scale lacked).
- Home keeps a `__DEV__`-only "Debug" link (see decisions).
- Not exercised on device by me: offline cold-start timing (B6), poster 404, the debug-button regression, TalkBack. All Queenie's.
- The emulator ran on a restarted td_emu; it is still running, signed in.

## Manager — server deploy + live checks (2026-10-01)
- Ruby: server PASS ("safe to deploy as-is"); app FIX NEEDED (1 medium: Sentry over-reports TMDB
  5xx; 5 low). → Bug 1 to Bella.
- **Deployed `tmdb` v2** (`supabase functions deploy tmdb`; `_shared/tmdb.ts` bundled; verify_jwt on).
- Live curl (anon JWT fetched in memory, never stored): popular p1 → 200, 20 results × 5 fields, no
  `adult`, `Cache-Control: public, max-age=300`; no auth right after → **401** (no CDN leak of the
  cached 200); page `0`/`501`/`1e2`/`%205`/`abc`/`1.5`/empty → 400 `invalid_page`, no cache header;
  `endpoint=foo` / missing → 400 `invalid_endpoint`; page 500 → 200; page omitted → page 1;
  OPTIONS → 200 with 3 allow headers; error bodies contain no api_key / themoviedb /
  status_message / key prefix (0 hits). Function logs not checked (logs API unavailable).
- **M9 final (Manager decision):** report `misconfigured`, `upstream_auth`, `shape`, and a codeless
  5xx that is not a relay error; never `upstream_error` (TMDB outage), `upstream_network`, relay 502,
  4xx/429, timeout, offline.

---

# Build 12a · Bug 1 (Ruby's review; server passed and is deployed as tmdb v2)

Server item 5 is its own commit (`d18ca82`); the app items are one commit (SHA in the Manager's report). Nothing deployed.

| # | Cause | Fix | Test |
|---|---|---|---|
| 1 Sentry over-reported TMDB outages | the rule reported any 5xx with a code other than `upstream_network`, so `upstream_error` (a TMDB 500/503) sent an event per user per open | `shouldReportMovieError` now reports only `misconfigured`, `upstream_auth`, `shape`, a codeless 5xx and non-`MovieApiError` errors (`MovieApiError.ts`) | `movieApi-test.ts` (report / do-not-report tables) and `queryClient-test.ts`: codeless 500 captured once; `upstream_error` as 500, 502, 503, `upstream_network`, relay, 4xx, 429, timeout and offline not captured |
| 2 Relay vs crash indistinguishable | a relay 502 had no `code`, same as a function crash | `FunctionsRelayError` now maps to http 502 with `code: "relay"` (`RELAY_CODE`), so it is retried but not reported, while any other codeless 5xx is reported | `movieApi-test.ts` mapping; `queryClient-test.ts` relay not captured, codeless 500 captured |
| 3 Fade over the backdrop | `ShimmerFill` unmounts on `onLoad`, so the 200 ms fade ran over an unbackgrounded tile | tile with an image gets `bg.elevatedFlat` as its own background (`imageTile` in `PosterCard.tsx`); the skeleton does not (its pulse is that colour over transparent, a fill would hide the pulse) | `PosterCard-test.tsx` asserts the fill before and after `onLoad`. **No emulator screenshot**: a 200 ms fade is not catchable by adb screencap; effect is that the image now fades in over the same flat colour the shimmer showed |
| 4 TalkBack live region | a 1 px live-region View present at first render is not announced on Android | removed it; `PosterGrid` calls `AccessibilityInfo.announceForAccessibility("Loading movies")` in an effect each time `state` becomes `loading` (also on Retry) | `home-test.tsx`: announced once on first load and again on the offline cold start path |
| 5 `results: [null]` could throw | `movie.adult` read on a non-object | `shapeMovies` keeps objects only, then filters adult | `tmdbProxy-test.ts` (26 now) |
| 6 | accepted: `queryClient.ts` imports `MovieApiError.ts` directly | none | none |

Files touched outside the Build's own scope: none.

**Test flake found and fixed.** After removing the live-region View, the full Jest run failed about half the time with `act()` warnings in `home-test.tsx` (react-query and FlashList timer-driven updates landing after a test body). Fix: `afterEach` flushes one timer inside `act` before the console check. Five consecutive full runs afterwards were clean (0 `act(`); the first two runs of the new test count had one pass and one fail before the fix.

Gates: tsc app and `supabase/functions/tsconfig.json` clean; lint clean; `npx jest`: 32 suites, **303 tests** passed (302 plus the new PosterCard fill test), 0 `act(`, 0 console warnings; out.txt deleted.
