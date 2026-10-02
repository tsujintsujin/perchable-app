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
