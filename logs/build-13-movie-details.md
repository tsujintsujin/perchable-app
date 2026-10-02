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
| 2 | authReady + 8 s timeout + error state; 404 own state | `movieDetailsApi-test.ts`: getMovieDetails (8000 timeout option, signal; the authReady rejection test was added in Bug round 1, R1), details through the real query client; `movieDetails-test.tsx`: offline error + Retry, 404 state |
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

## QA — Queenie (2026-10-02, branch module/movie-browse at a1a5075, live `tmdb` details endpoint)
Evidence: `logs/evidence/build-13/` (screenshots `.jpg`/`.png`, `ui-*.xml` dumps, `logcat-E.txt`, `metro.log`). Device td_emu 720x1600 @ 280 dpi (1.75 px/dp).
Method notes: screencap frames lag the UI by 1–3 s on this emulator, so I waited 3–10 s before judging; screenshots are `.jpg` where a raw PNG was rejected by the viewer.
Metro was started with `timeout 1800` and expired by itself after about 30 min; port 8081 has no listener now.

**Verdict: FAIL (3 Bugs).** Every item in the failure-mode list that can be run on a dev client passed except the three Bugs below; two items are UNTESTABLE here.

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | Happy path (Home poster -> details) | PASS with Bug 1 and Bug 3 | `02a`..`02i`, `02d-chip-zoom.png`, `ui-details.xml` |
| 2 | Back chip + hardware back, scroll kept | PASS (about 20 rows deep; identical frame before and after) | `03a` -> `03d` (hardware back), `03f` (chip) |
| 3 | Double tap = one screen | PASS (one back -> Home) | `04a`..`04c` (`04b` is a stale frame, `04c` is Home after one back) |
| 4 | Cold deep link + anchor | UNTESTABLE on a dev client (see below); warm link PASS | `05n` Matrix loads, `05o` back -> Home |
| 5 | Invalid links `abc`, `0`, `999999999` | PASS: "Movie not found" state, no crash, no error toast. Whether a request was sent is not observable from the device; the t2 frames were stale so a skeleton flash can't be ruled out | `06-abc-t10`, `06-0-t10`, `06-999999999-t10` |
| 6 | Offline -> error -> Retry offline -> online Retry | PASS: error state already at 4 s (offline fails fast; the 8 s timeout path was not exercised); Retry offline stays error; Retry online loads | `08a`..`08g` |
| 7 | Leave mid-load x3 (+1) | PASS: Home each time, no toast, no crash, no `E` lines from the app | `09-leave-midload-after3`, `09b`, `09c` |
| 8 | Missing data | PASS: id 1250000 (no tagline, no runtime, no cast, no synopsis -> "No synopsis available."), id 1750000 (no backdrop, poster fallback, no genres, cast without character -> name only, "Not rated yet"), id 1400000 ("Not rated yet", tagline). No NaN / undefined / "0 min" / empty headings | `10-sparse-1250000`, `10-sparse-1750000`, `ui-id1400000.xml` |
| 9 | UI-only shells | PASS: Tier chip toggles the legend (left edge at 90 dp as specified), first hardware back closes it; composer shows Toast "Comments are coming soon."; lounge shows "Preview only. Comments are coming soon." | `09a-tier-legend`, `09b-after-back-from-legend`, `09c-composer-toast` |
| 10 | Accessibility | PARTIAL, see below | `ui-details.xml`, `ui-lounge.xml`, `10a`, `11b` |
| 11 | Regression: Home | PASS: pull-to-refresh spinner shows, infinite scroll still pages after visiting details, Profile loads | `12h-ptr-mid`, `12e`, `13b-profile` |
| 12 | logcat | PASS for the app, see below | `logcat-E.txt` |

### Bugs
**Build 13 · Bug 1 — "Tier" word is invisible in the Tier chip (every movie)**
Steps: open any movie. Expected (DESIGN "Chip row", copy table): "🏆 Tier" in gold `bodyStrong`. Actual: only the trophy shows; the pill has a gap where "Tier" should be. uiautomator reports the TextView text as `🏆 Tier` (bounds [272,651][364,690]), so the string exists but is not drawn. The legend title "Tier ratings" draws fine. Evidence: `02d-chip-zoom.png` (zoom), `02c-loaded.png`, `09a-tier-legend.png`, `10-sparse-*.jpg`.

**Build 13 · Bug 2 — a poster opened during fast scrolling on Home (intermittent)**
Steps: on Home, inject many quick swipes (`adb shell input swipe 360 1300 360 300 250` x28 at 0.7 s spacing; also `swipe 360 400 360 1400 150` x25 at 0.4 s). Expected: only scrolling. Actual: twice the sequence ended on a details screen nobody tapped ("Facing El Chapo", then "Don't Look Down"). Not reproduced in 9 slower controlled swipes (2–3 s apart) or at the end of the list. It may be an adb-injector artefact (a touch-down on a fling counted as a press), so Ruby/Justin should judge; a real-finger fling on a phone is the check. Evidence: `12c-infinite-scroll.jpg`, `12f-ptr-mid.jpg` (both show a details screen after a scroll-only gesture).

**Build 13 · Bug 3 — cast avatars are blank (no placeholder) while photos load**
Steps: open a movie on a cold image cache (Matrix via `perchable://movie/603`, or Joker). Expected: an Avatar `lg` circle (initials fallback or filled placeholder) in each slot. Actual: while photos load, the row between the "Cast" heading and the names is empty dark space for several seconds, with names and characters showing under nothing. Evidence: `02b-loaded.png`, `03c-after-chip-back.png`, `05n-warm-matrix.png`. (Poster and backdrop show a grey block / flat colour while loading, so only the cast row looks broken.)

### Seen, needs a decision (not filed as Bugs; exact text where there is text)
- Metro terminal printed `"shadow*" style props are deprecated. Use "boxShadow".` three times, each with a `Web Bundled ...` line, i.e. when Metro renders the web bundle. I caused that by opening a malformed dev-client URL (`.../--/movie/603`) and `curl localhost:8081/reload`, so it may be web-only, but it names a style prop in app code: Ruby to check whether any component uses `shadowColor`/`shadowOffset` instead of `boxShadow`.
- A blue banner `Refreshing...` appeared over the top of the screen several times, 5–10 s after navigating (`02-back-hw.png`, `03c`, `03e`). My evidence files are written inside the folder Metro watches, so this is most likely the dev fast-refresh indicator caused by my own writes. Not confirmed.
- Home footer showed `Couldn't load more movies.` + Retry after the ~28-swipe scroll (`12d-after-6-swipes.jpg`); Retry loaded the next page (`12e`). No `ReactNativeJS` error line. Worth a look at the 12b next-page error path under rapid paging.
- Cold start of the dev build ANR'd 4 times in a row (`ANR in com.tsujintsujin.perchable`, `Reason: Process ... failed to complete startup`; logcat `Verification of ... took 161.404ms (2986.29 bytecodes/s)`), also from the launcher icon, so not deep-link specific. `scripts/emulator.sh health` reported launcher 90th = 300 ms 13 min after the restart. Cleared by `adb shell cmd package compile -m verify -f com.tsujintsujin.perchable` (74 s); cold starts worked after that. Known degraded-emulator pattern, but the ANRs are in this run's logcat.
- Status bar: on a bright backdrop (The Matrix) the clock and icons are unreadable (white on near-white, `05p-after-reload.png`). The spec has no top scrim; Dianne to decide.
- The composer Toast sits on top of the composer's lower half (`09c`); the board shows it below the composer.
- Lounge samples differ from the board: the app prints "CineOwl Just finished it..." inline with an initial-letter avatar; the board shows the author on its own line above the text and a plain gradient avatar.
- Slow loads: first open of a movie showed the skeleton for more than 6 s (Scavenger, Joker) and images 5–12 s. Emulator plus network; not measured on a phone.

### Design check (px / 1.75 = dp)
Matches DESIGN: poster 35..245 px = 120 dp wide at x 20 dp, top 156 dp; title column left 156 dp, top 232 dp (156+76); chips 36 dp high; rating label "Rated 7.9 out of 10 on TMDB"; popover left edge 90 dp; composer 48 dp; compact bar title ("Spider-Man: Brand New ...") after scrolling, with hairline; backdrop 220 dp with fade; flat purple900 when no backdrop (`10-sparse-*`).
Skeleton (`09b-leave-midload-t3.jpg`): backdrop 220 dp, poster 120x180, title bars 100% / 70%, chips 110 and 90 x 36, heading bar 120x24, "Cast" bar 80x24, avatar circles 88, name bar 64x12, role bar 44x10 all measure as specified. Bella's text-bar height of 16 dp reads slightly thicker than the board's text bars (about 12–14); name 12 and role 10 look right. Eyeball only, no Bug.
Differences: Bug 1, lounge sample layout, Toast position (above). TMDB attribution is not on the details screen; DESIGN section 6 puts it in Settings/About, so that is as designed (I did not open Settings).

### Accessibility (item 10, uiautomator)
Back chip `content-desc="Back"`, clickable. Tier chip `content-desc="Tier rating"`, button. Rating `Rated 7.9 out of 10 on TMDB` / `Not rated yet on TMDB`. Poster `Poster for <title>`. Cast items `Tom Holland as Peter Parker / Spider-Man`, `Zendaya as MJ`, and name only `Memo Oba`. Composer `Hoot your thoughts`, button, 84 px = 48 dp. Chip bounds are 63 px = 36 dp; hitSlop confirmed by behaviour: a tap 5 dp below the Tier chip opened the legend (`10a`), a tap 5 dp below the Back chip went back (`11b`). **Heading semantics UNVERIFIED**: uiautomator does not expose the heading flag (title, Synopsis and Cast render as `android.view.View`); Justin to check with TalkBack headings navigation.

### UNTESTABLE — Justin to check
1. **Cold deep link + anchor (B4)**: the dev client's launcher swallows the launch URL (`am start -d perchable://movie/603` on a stopped app shows the "Development Build" launcher; after picking localhost:8081 it lands on Home). Tried: plain link, link after force-stop, `perchable://expo-development-client/?url=...%2F--%2Fmovie%2F603` (Metro answered with a web render and the launcher showed "Failed to open app"), JS reload. The warm link works (`05n`, `05o`). Justin, with the release APK: kill the app, run `adb shell am start -a android.intent.action.VIEW -d perchable://movie/603`, expect The Matrix, then Back -> Home.
2. **Signed-out deep link (B8)**: needs a sign-out, which I must not do.
3. **TalkBack heading navigation** (above), and a **real-finger fast fling on Home** for Bug 2.

### logcat (item 12)
`logcat-E.txt` (`*:E`, taken at the end; the buffer was cleared at 01:36 and 02:06). Lines from the app, ReactNativeJS or AndroidRuntime: **0**. No `Fatal signal` in the app and no `MountingCoordinator::pullTransaction` crash. The `E` lines are the emulator audio HAL (`pcmOpen:181 pcm_prepare failed for nChannels=2 sampleRateHz=48000 period_count=4 period_size=544 isOut=1 with cannot prepare channel: I/O error (-1)`), `NetlinkEvent: Parameter 'STATE' not found`, `WifiStaIfaceAidlImpl: stopRssiMonitoring failed`, and Google Play services (`DomainFilterImpl ... Unable to read Finsky Content Filter settings`, `WakeLock: GCM_HB_ALARM release without a matched acquire!`). Tombstone `tombstone_23` (01:28 today) is `com.google.android.bluetooth` SIGABRT, not the app. The 4 cold-start ANRs above are the only app-process failure.

## Bug round 1 (Bella, 2026-10-02)
Server tests: commit 4e1d81c (test-only; `_shared/tmdb.ts` unchanged, so nothing to redeploy). App: one commit after it.

| Item | Cause | Fix | Proof |
|---|---|---|---|
| S1 | The adult test only checked the code, so a different body or header would have passed. | Adult run is compared `toEqual` to a real TMDB-404 run (status, body, `cacheControl`). | Mutation: changing the adult message to "Hidden" fails it. |
| S2 | Edge ids untested. | `1.0`, `+5` rejected; `05` added to the accepted list: it is digits-only, so it is id 5 (same rule as `page`). If the Manager wants leading zeros rejected, that is a one-line change in `parseMovieId` and `parseMovieIdParam`. | tmdbProxy-test 61 pass. |
| B1 | **The chip text wrapped to two lines.** One `Text` "🏆 Tier" in Inter on a shrink-to-content pill: `onTextLayout` on the device reported `[["🏆 ",23,21],["Tier",30,20]]`, i.e. the emoji on line 1 and "Tier" on line 2, below the 36 dp pill. It is not colour (white text did not show it either), and the same string without the emoji draws; with the default font it fits on one line. The Roulette Button has the same style but a full-width container, so it never wraps. | Emoji and word are separate `Text` elements in a row (gap 6). | `logs/evidence/build-13/r1-b1-tier-chip-before.png` / `-after.png` (zoom), device screenshot r1-b4 shows "🏆 Tier". |
| B2 | **Not an app bug: an `adb input swipe` artefact.** With touch logging on every poster: 45 swipes of 250 ms/0.7 s, 150 swipes of 150/120 ms at 0.3-0.4 s, and 45 more of 250 ms while a full jest run loaded the host, all gave `touchCancel` (RN's ScrollView took the gesture), no open. A swipe of **1 ms** gives DOWN then UP with no MOVE in between: `touchEnd moves=0 dy=-571` and the poster opened. RN's Pressable fires `onPress` on release when it never saw a move (it checks the press rectangle on moves only), so a DOWN/UP pair with no MOVE is, to RN and to Android, a tap. A finger cannot produce that: it always reports moves, and the first move past the slop makes the native ScrollView cancel the touch. A loaded `input swipe` process can emit that degenerate stream (what Queenie saw twice in ~50). I did not reproduce it with a 150/250 ms duration, so the load explanation is likely, not proven. | None, as instructed: no workaround added. Real-finger fling check stays with Justin. | Instrumented run (temporary logging, reverted; `git grep DBG` is empty). |
| B3 | `Avatar` drew a photo OR the initials, so while a photo loaded the slot was blank. | Initials circle always drawn; the photo is an `expo-image` absolutely over it with `transition` 200 ms (`motion.imageFade`). No photo or a failed one leaves the initials. Same component for Home, Profile, Blocked users, cast. | `Avatar-test.tsx` (5); profile, blocked-users, edit-profile, home tests still pass; `r1-b3-avatar-initials-while-loading.png` (cast circles show T M B W while photos load). |
| B4 | Status icons unreadable over a bright backdrop. | Fixed `LinearGradient` scrim (`topScrimStart` -> `fadeStart`), height inset + `size.detailsScrimHeight`, loaded state only, decorative, below the chip, opacity = inverse of the compact bar's. | `movieDetails-test`: only when loaded, height, not touchable; `r1-b4-top-scrim.png`. The fade itself cannot be asserted in Jest (native driver does not update props): checked on the device by scrolling (scrim gone, bar shown, see r1-b6 screenshot). |
| B5 | Toast sat at 24 above the inset, over the composer. | `Toast` takes `offset` (default 24); details passes `size.detailsToastOffset` 96. Both Toasts use the one prop. | `movieDetails-test`: composer Toast and refetch Toast both at inset + 96. Seen on the device. |
| B6 | Author and text were one inline `Text`. | Row: avatar, 10 gap, column (author `small` 600 gold, line 16; message 12/18, new `lineHeight.bubble`), top-aligned, 12 apart. | Test asserts separate lines; `r1-b6-lounge-stacked.png`. |
| B7 | Skeleton heights were my guesses. | Tokens now: bars radius 6; title 24 (gap 8); meta 14 (50%); genre 12 (80%); tagline 14; headings 24; synopsis 14 with 8 between, last 60%; cast name 72x12, role 52x12, 6 apart, 8 under the avatar. | By token; not asserted (pure layout). Seen briefly on the device. |
| R1 | The authReady rejection path had no test (my map row 2 claimed it). | Test: `getSession` never resolves, fake timers: nothing sent at 7999 ms, rejects `kind: "timeout"` at 8000, no `invoke`, no Sentry. | Mutation: removing the `authReady` call fails it. **Row 2 of the failure-mode map is corrected below.** |
| R2 | An empty/whitespace title made an empty header. | `displayTitle()` ("Untitled") used for the header, poster label/fallback and compact bar. Note: **Home does not do this today** (it passes the raw title), so Home still shows an empty tile label for such a movie; out of scope, flagged. | `movieDetails-test`, `movieDetailsApi-test`; mutation: returning the raw title fails both. |
| R3 | `keyExtractor` used the person id; one actor with two roles duplicates the key (React warns, rows can mix). | Key `${id}-${index}`; `parseDetails` keeps both entries. | Test renders two entries with id 7 (the afterEach console check catches the key warning); mutation fails 24 tests through that check. |
| R4 | `Date.now()` can jump; tap A, Back, tap B within 800 ms was swallowed. | `performance.now()`; `useFocusEffect` re-arms the guard when Home regains focus. Home tests that render Home mock `useFocusEffect` (3 files, one 8-line mock) so they need no navigation container. | `homeOpenMovie-test`: re-arm test (mutation fails it) and a check that the guard reads `performance.now`. |
| R5 | 0.98 written twice. | `motion.pressScale` used by `PosterCard` and `GlassCard`. | `Avatar-test` (GlassCard pressed) and `PosterCard-test`; mutation to 0.9 fails both. |
| L1 | `dangerGlow` in tokens.ts uses `shadow*`. | **Left as is.** It is an iOS glow that Android draws as nothing (token comment, DESIGN); `boxShadow` would start drawing a glow on Android 9+, so it would not render the same. The warning is only on web bundles, which this app does not ship. | n/a |

Emulator: cold-start verify compile run (`cmd package compile -m verify -f ...`) as Queenie advised; no ANR. Left running. Metro stopped, 8081 free.

Failure-mode map row 2 (replaces the earlier text): "Item 2, authReady + 8 s timeout: `movieDetailsApi-test.ts` 'when auth never answers, rejects with a timeout after 8 s...' (fake timers, no Sentry, nothing sent); `getMovieDetails` passes `timeout: 8000` and the signal (unit); offline error state: `movieDetails-test.tsx`. The 8 s abort of an in-flight request is functions-js's and is not tested in Jest."

## QA — Bug round 1 re-test (Queenie, 2026-10-02, commit 219fd90)
Setup: `emulator.sh ensure` restarted the emulator (uptime was 15 min but launcher 90th pct 500 ms). Cold start: ran `cmd package compile -m verify -f com.tsujintsujin.perchable` first; first dev-client load showed "There was a problem loading the project ... java.io.IOException: unexpected end of stream on http://localhost:8..." (Metro was still starting; `r1q-01-launch.png`); tapping Reload loaded Home. Evidence prefix `r1q-` in `logs/evidence/build-13/`.

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | Bug 1 Tier chip one line | PASS on 4 movies incl. long title ("The End of Oak Street", 2-line title) | r1q-04-loaded (Coyote), r1q-05-t6 (End of Oak Street), r1q-12-matrix-top, r1q-08 (Resident Evil) |
| 2 | Bug 2 fast fling | PASS: 26 swipes, durations 150/180/200/220/240/250/280/300 ms (14 up, 12 down), no poster opened, still on Home. No 1 ms swipes used. | r1q-03, r1q-03b |
| 3 | Bug 3 cast initials then photos | PASS: Resident Evil (not opened before), screenrecord frames: A P K Z gradient initials, then photos replace them (2 mixed, then all 4). No ghosting. Profile avatar and Home header avatar look right. | r1q-06a-cast-initials, r1q-06b-cast-mixed, r1q-06-open.mp4, r1q-20-profile, r1q-15-home |
| 4 | Status-bar scrim | PASS: Matrix at top, clock/icons readable over bright backdrop; after scroll, scrim gone, compact bar "The Matrix" shown; Back chip at top returned to previous screen | r1q-12, r1q-13, r1q-14 |
| 5 | Toasts | PASS with a note, see Note A. Composer Toast sits above the composer (does not cover it). Tier opens a popover (not a Toast), no overlap with composer. | r1q-10, r1q-11 |
| 6 | Lounge stacked | PASS: avatar, gold author on its own line, message under it. Matches the board's structure. | r1q-09-end |
| 7 | Skeleton | PASS (visual): synopsis bars thin and even, cast name and role bars short. Bar heights not measured in dp (pixel read only). | r1q-04-t3, r1q-06-open.mp4 |
| 8 | Double-tap guard | PASS: poster A tap, Back, poster B tap in one adb shell call (< 1 s): Coyote (B) opened. Then Back returned straight to Home (A not stacked). Fast double tap on one poster: one Back returned to Home (one screen only). | r1q-16, r1q-17, r1q-18 |
| 9 | Regression | PASS: paging loaded more rows (14 flings), Profile tab shows name/handle/avatar, back to Home kept scroll position (identical to before). Pull-to-refresh: swipe-down returned to a loaded Home, but the spinner was not caught in a frame (`r1q-22`, `r1q-23`), so refresh is not proven by a screenshot. | r1q-19, r1q-20, r1q-21, r1q-22, r1q-23 |
| 10 | logcat | See below | r1q-logcat-E.txt |

Note A (design, for Ruby to judge): the composer Toast "Comments are coming soon." sits at inset + 96 dp, which on this short page lands over the "Preview only. Comments are coming soon." line (it hides "...only. Comments are" partly), just above the composer. The board (variant 8) shows the Toast in empty space near the screen bottom, below the composer. Not over the composer itself, so the brief's wording is met.

logcat `*:E` (299 lines, all-process). From the app (pid 5584):
- `E SwipeRefreshLayout: Got ACTION_MOVE event but don't have an active pointer id.` x21 (during my fast swipes)
- `E unknown:ReactNative: Tried to remove non-existent frame callback` x2 (04:34, around launch/reload)
Not from the app: `F libc: Fatal signal 6 (SIGABRT) ... pid 6581 (droid.bluetooth)` tid bt_stack_manage (system Bluetooth service crash, uid 1002, at 04:36:19), audio HAL `pcmOpen failure`, Bluetooth/rfkill errors. No `FATAL EXCEPTION` for the app, no ANR. No Metro warnings.

Bugs: none. Open question for Ruby: the two app-side error lines above.

## Bug round 2 (Bella, 2026-10-02)
| Item | Cause | Fix | Proof |
|---|---|---|---|
| 1 Toast | The 96 offset put the Toast over the lounge card; DESIGN amendment moved the Toast low and gave the scroll more bottom room. | `size.detailsToastOffset` 24 and new `size.detailsBottomPad` 80 (scroll padding = inset + 80, was 32). Toast bottom (24 + inset) is inside that padding, below the card. Both Toasts use the one offset. | `movieDetails-test`: padding = inset + 80, composer and refetch Toasts at inset + 24 and less than the padding. Mutations (old padding, offset 96) each fail 1. Screenshot `logs/evidence/build-13/r2-toast-scrolled-to-end.png`. |
| 2 Avatar a11y | Round 1 made the initials always present, so a screen reader read "J" before the name where Avatar has no accessible wrapper. | Gradient wrapper gets `importantForAccessibility="no-hide-descendants"` and `accessibilityElementsHidden`. | `Avatar-test`: the initial is not found by default and is found with `includeHiddenElements`; mutation (props removed) fails 1. Other tests that look for initials now pass `includeHiddenElements`. |
| 3 Home title | `PosterGrid` passed the raw title, so an empty title gave an empty or ", 2021" label. | `displayTitle(item.title)`, same as details (this also gives Home the "Untitled" the round 1 note said it lacked). | `home-test`: "Untitled, 2021" and "Untitled" labels and fallback text; mutation (raw title) fails 1. |

## Manager close (2026-10-02)
- Bug round 1 (219fd90 app, 4e1d81c server tests): Ruby FIX NEEDED (2 lows) → round 2; Queenie re-test PASS.
  The Toast offset in Dianne's first amendment covered the "Preview only" line; she corrected it to match her
  board (5913e51: toast offset 24, details bottom pad 80).
- Bug round 2 (027ae3f): Avatar initials hidden from accessibility; Home shows "Untitled"; new toast/bottom pad.
  Ruby PASS. Device screenshot r2-toast-scrolled-to-end.png matches the board.
- Manager gates on 027ae3f: tsc app + functions 0; lint clean; jest ×2 498/498, 0 `act(`, 0 console warn/error.
- Manager spot re-run (td_emu after `ensure`): Home → The Odyssey (not opened before) → details complete
  (backdrop, poster, meta, genres, rating, "🏆 Tier" on one line, tagline, synopsis, cast photos + roles)
  `mgr-01-odyssey-details.png`; hardware back → Home intact `mgr-02-back-home.png`. logcat: no Fatal signal,
  FATAL EXCEPTION, ANR or app error lines. PASS. Emulator closed; Metro stopped, 8081 free.
- Server: tmdb details deployed in Phase 2 (bd4a702); later server commits are tests only, nothing to redeploy.
- **NEEDS JUSTIN (by hand, not blocking):** (a) real-finger fast fling on Home never opens a poster (adb can't
  send real touch streams); (b) cold deep link `perchable://movie/603` with the app killed → The Matrix, Back →
  Home (dev client drops launch URLs; check on a release build); (c) signed-out deep link → sign-in, target
  dropped; (d) TalkBack: details title is announced as a heading.
- Open, no action: `05` accepted as id 5 (digits-only rule, same as `page`); `dangerGlow` iOS-only shadow kept.
- **Build 13 DONE.**
