# Build 13 — Movie details (Module 4: Movie browse/details)

Base SHA: 485320c (Phase 1 start 2026-10-02, branch `module/movie-browse`)
Plan: PLAN.md "Build 13" A1–A2, B1–B8, C1–C7 + Module 4 M1–M10 (final after two Ruby reviews).
Phase 0 done: DESIGN.md "Build 13" (Dianne), boards rendered in
`logs/evidence/build-12a/design/build-13-details-states.png` + `-variants.png`. Needs from Justin: nothing.

## Failure-mode list (Manager, before Phase 1) — each is a Done-means line + a test
PLAN.md's Build 13 failure modes apply in full. Manager additions / emphasis:
1. **Server first, own commit, never deployed by Bella** — `details` endpoint in
   `_shared/tmdb.ts`: id `/^\d+$/` + 1..2147483647; movie + credits in one TMDB call; trimmed
   (cast ≤ 15, rating, synopsis, header fields, attribution); same error mapping as popular
   (401/403 → 502 `upstream_auth`, missing key → 500 `misconfigured`, network → 502
   `upstream_network`, TMDB 404 → 404 `not_found`); adult titles → 404 (not shown); no key /
   URL / TMDB message in any body; `Cache-Control` like popular. Ruby reviews → Manager deploys →
   curl list (incl. `id=1e3`, `id=%205`, `id=0`, `id=2147483648`, unknown id, adult id).
2. **Request timeout** — `getMovieDetails` goes through `authReady()` (offline fix) and the 8 s
   timeout; error state within ~17 s offline; not-found is its own state (no retry, no Sentry).
3. **Navigation** — one details screen per double tap; back chip and hardware back return to
   Home with its pages + scroll intact; cold deep link → back lands on Home (anchor); signed-out
   deep link → sign-in, target dropped; invalid route id → not-found state, no request.
4. **Leave mid-load** — request aborted, no setState after unmount, no error flash, no Sentry.
5. **Missing data** — no "NaN", "undefined", empty headings or 0-minute runtimes; images fall
   back (poster, backdrop, cast avatars → initials).
6. **UI-only shells** (tier badge, spoiler lounge) — visible, feedback on tap (Toast), never a
   silent no-op; the lounge's sample messages are labelled "Preview only".
7. **Accessibility** — back chip "Back"; title is a header; cast items labelled; ≥ 48dp targets.
8. **Home unchanged** — PosterCard becomes pressable without breaking 12a/12b (paging,
   refresh, recyclingKey, retryToken).
9. **Standards + emulator rules** — tokens only, flat fills (no BlurView in lists), 1–2 line
   comments, logic in `src/modules/movies/`; `scripts/emulator.sh ensure` before device work;
   jest `--maxWorkers=50%`; never /sdcard.

## Server: the `details` endpoint (commit 1, not deployed)
`GET tmdb?endpoint=details&id=<n>` is added to `supabase/functions/_shared/tmdb.ts` (`handleDetails`,
`parseMovieId`, `handleTmdb` router); `tmdb/index.ts` only passes `id` and calls `handleTmdb`.
- **Flow:** validate endpoint, then `id` (`/^\d+$/` first, then 1..2147483647), then the key, then one TMDB call
  `/movie/{id}?append_to_response=credits`. The answer is rebuilt field by field (cast first 15, genres as
  `{id,name}`), so TMDB's budget, crew, `adult` and the rest never leave the function.
- **Errors reuse `mapUpstreamStatus`** (401/403 -> 502 `upstream_auth`, 404 -> 404, 429, others 502). A network failure
  is 502 `upstream_network` and the log line has the key redacted. An adult title is a 404 `not_found`, identical to a
  missing movie, so the app cannot tell them apart. A 200 whose body lacks a numeric `id` / string `title` is 502.
- **Refactor:** the fetch/redact/status-map block moved out of `handlePopular` into a private `callTmdb`, used by both
  handlers, instead of copying it. Popular behaviour is unchanged (its 36 existing tests pass untouched).
- **Cache-Control:** `DETAILS_CACHE_CONTROL` = the popular value (`public, max-age=300`), success only.
- **Why one router (`handleTmdb`):** `index.ts` must stay wiring-only; the endpoint whitelist stays in tested code.
- **Tests:** `__tests__/tmdbProxy-test.ts` (59 pass). Never deployed by Bella; the Manager deploys after Ruby.

## What was built (app, commit 2)
**Flow.** Home poster tap -> `useOpenMovie` pushes `/movie/[id]` -> the route file only reads the `id` param and renders the
module's `MovieDetailsScreen` -> `useMovieDetails(idParam)` turns the param into a number (`parseMovieIdParam`) and runs a React Query
`["movies","details", id]` -> `getMovieDetails` waits for auth (`authReady`), calls the `tmdb` function with the 8 s timeout and the
query's AbortSignal -> `parseDetails` checks and types the body -> the screen shows one of four states: loading skeleton, error + Retry,
not found, loaded. "Empty" does not apply to one movie (it exists or it is not found).
- **Not found** is one state for three causes: an invalid route id (the query is `enabled: false`, so no request is made), a TMDB 404 and
  an adult title (the server answers both 404). 404 is not retried (M5) and not sent to Sentry (M9, existing `shouldReportMovieError`).
- **A refetch that fails while data is on screen** keeps the movie and only shows the error Toast (`isRefetchError`), as DESIGN says.
- **Data flows one way:** the hook returns `{ state, movie, refetchErrorAt, retry }`; components never see React Query or Supabase.
- **PosterCard** gained `onPress` (button role, hint, pressed 0.98), `accessibilityLabel` and `emphasis` (stronger border for the details
  poster). Without `onPress` it is the same image tile as 12a/12b. `PosterGrid` takes `onOpenMovie`; the paging, refresh, `recyclingKey`
  and `retryToken` code is untouched. Home tests that looked tiles up by role "image" now use "button".
- **TierBadge** (`src/ui/TierBadge`) is the "Tier" chip or an S/A/B/C letter badge; `TierLegend` (movies module) is the static popover.
  **SpoilerLounge** is the static panel. Neither stores or fetches anything.
- **Navigation:** `movie/[id]` sits in the session-guarded `Stack.Protected` group, so a signed-out deep link goes to sign-in and the target
  is dropped. `unstable_settings = { anchor: "(tabs)" }` puts Home under a cold deep link; the back chip uses `router.canGoBack()`,
  else `router.replace("/")`. Details is a root-level push, so there is no tab bar (DESIGN).
- **New tokens** (from DESIGN 1.9): `size.details*`, `chipHeight`, `castItem/castGap`, `popoverWidth/Offset`, `composerHeight`,
  `colors.overlay.fadeStart`, `lineHeight.body`, `motion.barFade`, `type.tierLetter`, plus `backdropFade` and `detailsSkeleton`. The skeleton
  bar sizes the board shows but DESIGN does not number (text bars 16, name bar 64x12, role bar 44x10) are my choices; Queenie/Dianne to eyeball.

## Why this way
- **Double-tap guard is an 800 ms window in `useOpenMovie`, not a focus-based lock.** A lock reset by `useFocusEffect` is the "right" shape
  but needs a navigation container, so every test that renders Home would need one. The window is a ref read before React re-renders, which
  is what catches two taps in the same frame. Rejected: relying on `router.navigate` de-duplication (behaviour I could not prove in Jest).
  Ceiling: a user who really opens a second movie within 800 ms of the first is ignored once.
- **`parseMovieIdParam` lives next to `getMovieDetails`**; the server has its own `parseMovieId` (the Deno-pure file cannot import from
  `src/`). Same rule in two places on purpose; each has its own test.
- **`parseDetails` drops cast/genre entries lacking an id or name instead of throwing `shape`**: one odd cast row should not turn the whole
  screen into an error. The movie itself needs a numeric id, string title and array `cast`/`genres`, else `shape` (reported to Sentry).
- **Tap-outside for the legend is a full-size Pressable under the chip row** (zIndex 1 vs 2) rather than a RN `Modal`, so the chips stay
  tappable; Android back is one `BackHandler` listener that exists only while the legend is open.
- **No new dependency, no native module.** `expo-linear-gradient` and `expo-image` were already installed.
- **Not run on the device.** The details endpoint is not deployed, so a device run would only show the error state. Queenie runs the live
  flows after the Manager deploys.

**Concepts learned (RN / Expo):** typed routes (`expo start` regenerates `.expo/types/router.d.ts`; `router.push({ pathname: "/movie/[id]",
params })` needs it); `unstable_settings.anchor` for cold deep links; `Stack.Protected` guards; React Query `enabled`, `select`,
`isRefetchError`, and cancelling a query on unmount through the `signal` option; a Pressable's pressed style as a function; a ScrollView is not
"accessible", so role queries cannot find it (tests use a testID).

## Failure-mode map (Manager list items 1-9 -> tests)
| # | Item | Test (file: name) |
|---|---|---|
| 1 | Server endpoint, validation, trimming, error map, adult, cache | `tmdbProxy-test.ts`: parseMovieId, handleDetails (all), handleTmdb |
| 2 | authReady + 8 s timeout + error state; 404 own state | `movieDetailsApi-test.ts`: getMovieDetails (timeout, signal), details through the real query client; `movieDetails-test.tsx`: offline error + Retry, 404 state |
| 3 | One screen per double tap; back; deep-link anchor; invalid id | `homeOpenMovie-test.tsx`: double tap; `movieDetails-test.tsx`: Back chip back/replace, 7 invalid ids + a missing id make no request. Anchor and signed-out deep link have no Jest (expo-router runtime): Manager adb checks B3/B8 |
| 4 | Leave mid-load | `movieDetails-test.tsx`: "leaving mid-load aborts the request...", "opening movie B after A never shows A's data" |
| 5 | Missing data | `movieDetails-test.tsx`: "missing data never prints blanks..." (3 tests); `movieDetailsApi-test.ts`: parseDetails nulls, format helpers |
| 6 | UI-only shells | `movieDetails-test.tsx`: Tier legend toggle / hardware back / outside tap, lounge Toast + "Preview only" |
| 7 | Accessibility | `movieDetails-test.tsx`: labels on poster, rating, cast, Back, headers, list role; `PosterCard-test.tsx`: button + hint. 48 dp: chips are 36 + hitSlop 6, composer `minHeight` 48 |
| 8 | Home unchanged | `home-test.tsx`, `homePaging-test.tsx` (pre-existing assertions; tiles are now role button), `PosterCard-test.tsx`, `homeOpenMovie-test.tsx` (no extra popular request) |
| 9 | Standards | diff read for literals; gates below |

Mutation checks run (each made the named tests fail, then restored): double-tap guard removed (1 fail), `signal` not passed (2 fail),
404 -> not-found mapping removed (1 fail), route-id digit check removed (8 fail).

## Spec-trace (DESIGN.md "Build 13" -> implementation)
S = `src/modules/movies/components/MovieDetailsScreen.tsx`, T = `src/ui/tokens.ts`. Line numbers are as committed.
| Spec line | Where |
|---|---|
| Route `src/app/movie/[id].tsx`, root Stack, session-guarded, no tab bar, header off | `src/app/movie/[id].tsx`; `src/app/_layout.tsx` (`Stack.Protected`, `movie/[id]`) |
| Cold deep link anchor; back chip fallback | `src/app/_layout.tsx` `unstable_settings`; `BackChip.tsx:6-10` |
| Backdrop 220, w780, cover, fade 40%-100%, flat purple900 when none | S:64-76, styles 234-235; T `detailsBackdrop`, `backdropFade`, `fadeStart`; `tmdbImage.ts` `IMAGE_SIZE.backdrop` |
| Back chip 36, radius sm, elevatedFlat, hairlineStrong, lavender200 arrow, left 20, top inset+8, hitSlop 6, label "Back" | `BackChip.tsx:13-40` |
| Compact bar after 150, fade 150 ms, bg.base, inset+48, hairline, title left 76 / right 72 | S:150-162, 204, 211-220, styles 279-292; T `detailsBarShowAt`, `barFade`, `detailsBarTitleLeft`, `homeHeaderInset` |
| Header row at y=156, poster 120x180 w500 radius 12 hairlineStrong, gap 16, title column top 76 | S:78-95, styles 239-247; `PosterCard.tsx` `emphasis`; T `detailsPosterOverlap/Width/TitleOffset` |
| Title 24/30, 3 lines, header role; meta 15 secondary; genres caption, wraps | S:89-93, styles 247-249 |
| Meta omitted / lone part; runtime format; rating one decimal | `format.ts` (`metaLine`, `formatRuntime`, `formatRating`) |
| Chip row 20 under, gap 12, 36 high, pill, surface.input, hairline; tier chip gold border | S:98-118, styles 252-268; `TierBadge.tsx` chip style; T `chipHeight` |
| Rating chip "star n.n of 10" / "Not rated yet"; label "Rated n out of 10 on TMDB" | S:100-114 |
| Tagline 16 under, omitted when empty | S:121, style 272 |
| Synopsis heading 24/8, body 15/22, "No synopsis available." | S:122-125, styles 273-276; T `lineHeight.body`; `NO_SYNOPSIS` |
| Cast heading 24/12; horizontal list, padding 20, items 88, gap 12, Avatar lg, 2-line name and character, hidden when empty, not tappable | S:128-135; `CastRow.tsx`; T `castItem/castGap` |
| Lounge heading, subline, flat hero card (hairline, padding 16/16/4), two samples, "Preview only" line, 48 pill composer, Toast | `SpoilerLounge.tsx`; S `COMMENTS_COMING_SOON`, 207; T `composerHeight` |
| Bottom 32 + inset | S:205 |
| Tier popover 260 wide, left 90, radius md, padding 16, elevatedFlat, hairlineStrong, elevation card, title/body/S A B C; dismiss by chip / outside / back | `TierLegend.tsx`; `TierBadge.tsx` (`TIER_STYLES`, `type.tierLetter`); S:35-43 (back), 53-62 (outside), 115 (chip); T `popoverWidth/Offset` |
| Loading skeleton in the final layout, `usePulse`, polite "Loading movie" | `DetailsSkeleton.tsx`; T `detailsSkeleton` |
| Error (nothing cached): EmptyState with Retry, centred | S:187-193, style `centered` |
| Error on refetch with data: Toast "Couldn't refresh. Check your connection." | S:153-157; `useMovieDetails.ts` `refetchErrorAt` |
| Not found: "Back to Home" -> `router.replace('/')`; invalid id makes no request | S:179-185; `useMovieDetails.ts` (`enabled: id !== null`) |
| Missing-data table (11 rows) | S:45-49, 125, 128; `parseDetails.ts` (nulls); `CastRow.tsx` (character); PosterCard fallback; Avatar initials |
| Copy table (23 strings) | `SpoilerLounge.tsx`, `TierLegend.tsx`, `TierBadge.tsx`, S (verbatim inline) |
| A11y: back, headers, rating sentence, tier chip label + hint, poster label, decorative backdrop, cast labels + list role, composer label + hint, popover live region | `BackChip.tsx`, S:65, 84, 89, 102, 122, 130; `TierBadge.tsx`; `CastRow.tsx`; `SpoilerLounge.tsx`; `TierLegend.tsx` |
| `PosterCard` `onPress`, pressed 0.98, role button, hint "Opens movie details" | `PosterCard.tsx` (Pressable branch) |
| `TierBadge` in `src/ui/` | `src/ui/TierBadge/` |

## Gates (final)
tsc 0 errors, functions tsc 0 errors, expo lint clean, jest 40 suites / 481 tests twice with 0 failures, 0 "act(" and 0 console warn/error lines, Metro bundles the Android entry (HTTP 200). Device run against live data: pending the Manager deploy of the details endpoint.

## Manager — gates, server deploy + live checks (2026-10-02)
- Gates rerun by the Manager on 80709e7: tsc app + functions 0 errors; lint clean; `npx jest --maxWorkers=50%`
  twice: 481/481, 0 `act(`, 0 console warn/error. Commit audit: no .env/keys/credentials.
- Ruby server review of bd4a702: **PASS** (no security defects). 3 lows → Bug round with the app review:
  (a) adult test should assert the body equals a real TMDB-404 run; (b) app must treat tagline/overview/
  release_date/runtime etc. as optional (copied untyped from TMDB); (c) add `05`, `+5`, `1.0` to parseMovieId tests.
- **Deployed `tmdb`** (`supabase functions deploy tmdb`; ACTIVE, verify_jwt true). Anon JWT fetched in memory only.
- Live curl results:
  - `details&id=603` → 200, `Cache-Control: public, max-age=300`, cast 15, keys id,title,tagline,overview,
    poster_path,backdrop_path,release_date,runtime,vote_average,vote_count,genres,cast; exact attribution;
    no budget/crew/adult.
  - no Authorization → 401 (gateway).
  - `id=` abc, 0, -1, 1.5, 1e3, %205, 0x10, 1.0, empty, missing, 2147483648, 99999999999 → all 400 `invalid_id`.
  - `id=603&id=604` → 603 (first wins). `id=999999999` and `id=2147483647` → 404 `not_found`, no Cache-Control.
  - Adult ids 363226 and 754798 (TMDB `adult:true`) → 404; body byte-identical to the missing-id body.
  - `endpoint=search` and `endpoint=details%00` → 400 `invalid_endpoint`. `popular&page=1` → 200 unchanged.
  - No body contained the key, `api_key`, `status_message` or the TMDB URL.
- **Not checked:** function log search for the key — the Management API logs endpoint rejected the table
  names (`function_logs` "does not exist"). Covered by Ruby's code check: the only log line (network failure)
  redacts the key, and that path did not run.
