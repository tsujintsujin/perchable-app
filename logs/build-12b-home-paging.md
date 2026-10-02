# Build 12b — Home infinite scroll + pull-to-refresh (Module 4)

Base SHA: d926766 (2026-10-01, branch `module/movie-browse`). Phase 0 shared with 12a (board
`design-src/build-12b-home-paging.dc.html`, render `logs/evidence/build-12a/design/build-12b-home-paging.png`).
Plan: PLAN.md "Build 12b" C1–C6 incl. C4b, C5b, C5c (final after two Ruby reviews).

## Failure-mode list (Manager, before Phase 1) — each is a Done-means line + a test
PLAN.md's 12b failure modes apply in full. Manager additions / emphasis:
1. **No duplicates** — de-dup by movie id across pages (TMDB popular shifts between requests).
2. **Empty filtered page** — the page loop lives inside the `queryFn` (max 3 consecutive pages);
   the list never stalls without a footer state.
3. **Pull-to-refresh** — cancelQueries → snapshot → trim to page 1 → refetch; on failure restore
   the snapshot (all posters + page count + scroll) and show the Toast; never lose posters.
4. **Races** — pull while a next page is in flight (C5b) and end-reached while refreshing (C5c):
   one consistent list, no duplicate rows, no stale page appended after a refresh.
5. **End of list** — after the last page no further request; the end footer copy verbatim.
6. **Next-page failure** — posters stay; inline error + Retry; Retry fetches only that page.
7. **Carried from 12a:** Toast offset (~73dp above the tab bar vs ~24dp on the board) — fix if the
   Toast is in this Build's scope (pull-refresh failure uses it); B6 wording about the 5-min HTTP
   cache — Priya/Manager note, no code.
8. **Performance** — FlashList stays smooth past 100 posters (Queenie measures jank on the
   emulator after a fresh restart); images keep `recyclingKey`; no re-render of the whole list
   per page.
9. **No Sentry noise** — a failed next page/refresh follows M9 (offline/timeout never reported).
10. Standards + emulator rules as 12a (restart before device work; 1.75 px/dp; never /sdcard).

---

# Phase 1–2 — Bella (2026-10-01)

Base SHA: 8f46349. Branch `module/movie-browse`. No server change.

## What was built (concept / flow / data)
- **Data flow.** `usePopularMovies` is one infinite query (`["movies","popular"]`). Its `queryFn` calls
  `getPopularPage(pageParam)`, which reads TMDB pages from `pageParam` until one has movies (max 3 pages) and
  returns that page with its **real** page number. `getNextPageParam` is `last.page + 1` while
  `hasMorePages` (`page < min(total_pages, 500)`). The hook flattens pages into one list and drops repeated ids.
  The hook also derives a `footer` state (`none | loading | end | error`), so the grid only draws it.
- **Footer.** `PagingFooter` (module component) draws spinner row / end line / inline error + `Button` Retry.
  New shared `ui/Spinner` (the same ring already exists in Button, edit.tsx and the Google button; I did not
  refactor those, out of scope).
- **Pull-to-refresh.** `refresh()` in the hook: guard against a second pull (ref), then `cancelQueries`, snapshot,
  `setQueryData` trimmed to page 1, `refetchQueries` (exact key). If the query ended in `error`, `setQueryData(snapshot)`
  puts every page back (this also clears the error status, so the screen never flips to the error state) and calls
  `onRefreshError` (Home shows the error Toast). On success the grid scrolls to the top.
- **Races.** `loadMore` and `retryMore` return early while `refreshingRef` is true (C5c). `cancelQueries` aborts an in-flight
  next page and TanStack ignores its late result (C5b). `loadMore` uses `fetchNextPage({cancelRefetch:false})`, so repeated
  end-reached calls join one request (C3). After a failed next page `loadMore` stays idle until the user taps Retry
  (otherwise a failing page would be retried in a loop).
- **Toast offset (carried from 12a).** Cause: `Toast` pinned itself at `insets.bottom + 24`, but on a tab screen the
  tab bar already sits on the system inset, so the screen ends above it and the inset was counted twice (emulator
  3-button nav = 48 dp: 48 + 24 = 72 dp, matching Queenie's ~73). Fix in the shared `Toast`: inside the tab
  navigator (`BottomTabBarHeightContext` present) the inset is not added again; outside tabs (sign-in) it is. Device pixel
  check after the fix: toast bottom edge 44 px (25 dp) above the tab bar top, on Home and on Settings
  (`evidence/build-12b/bella-toast.png`, `bella-toast-settings.png`). `useToast.show(message, variant)` now carries the
  variant so Home can show the coming-soon and the error toast from one hook.
- **Auto-paging of short lists.** Home asks for the next page whenever the content is short (always so in Jest's unmeasured layout). The 12a `home-test` answered every request with
  the same `{page:1, total_pages:5}`, which is a list with no end once paging exists (page 1's next page is always 2). `PAGE` therefore has `total_pages: 1`: those tests
  describe a single-page list. A stub contract, not a FlashList defect.

Big decision: refresh uses `queryClient.refetchQueries({exact})`, not the observer's `refetch()`, so the callback does not
depend on the per-render query object. Same behaviour (PLAN C5 text says `refetch()`).

## Concepts learned
Infinite query data shape (`pages` + `pageParams`) and why the page loop lives in the `queryFn`; `cancelQueries` + `setQueryData`
as snapshot / trim / restore; refs for guards that must change before a re-render; the query cache notifies observers from a
timer, so tests need act() that also waits one tick; a context (`BottomTabBarHeightContext`) as the way a shared component
learns where it sits; FlashList pages itself when content is short.

## Spec trace: DESIGN.md Build 12 (12b) to code
| Spec line | Where |
|---|---|
| Next page loading: row `size.footerRow`, 20 dp spinner (track `overlay.spinnerTrack`, arc `accent.gold`), 10 gap, "Loading more…" caption/secondary, polite live region "Loading more movies" | `PagingFooter.tsx` LoadingRow + styles; `ui/Spinner/Spinner.tsx`; tokens `size.footerRow`, `size.spinner`; `homePaging-test` |
| Loaded posters stay while loading | `PosterGrid.tsx` (footer is a list footer, data untouched); same test |
| End of list "You've reached the end." caption/secondary; no request after | `PagingFooter.tsx` end row; hook `footer = "end"`, `loadMore` guard; `homePaging-test` end; `popularPaging-test` C1 |
| Next page failed: warning line small/danger, role alert, 8 gap, Button secondary-glass "Retry" 48 high, padding 24, label "Retry loading more movies" | `PagingFooter.tsx` error box; `homePaging-test` error (height at least 48) |
| Never full-screen error / empty footer | hook `state` stays `filled`; `stalled` gives `footer="error"`; `homePaging-test` error |
| Pull to refresh: `colors=[accent.gold]`, `progressBackgroundColor=bg.elevatedFlat`; page 1 only; back to top | `PosterGrid.tsx` RefreshControl + `handleRefresh`; `homePaging-test` tint; `popularPaging-test` C5 |
| Refresh failed: posters stay, Toast `error`, no error screen | hook `refresh` restore; `index.tsx` `onRefreshError`; `homePaging-test` + `popularPaging-test` |
| Toast pins at bottom inset + 24, above the tab bar | `Toast.tsx` `insideTabs`; `toastOffset-test`; device screenshots |
| Copy table rows for 12b (loading more, live region, end, failed, Retry label, refresh toast) | `PagingFooter.tsx`, `index.tsx` `REFRESH_FAILED_MESSAGE`; asserted verbatim in tests |

## Spec trace: PLAN Build 12b to code + test
| Line | Code | Test (`popularPaging-test` unless noted) |
|---|---|---|
| C1 next page appends, stops at min(total_pages,500) | hook `getNextPageParam`; `hasMorePages` | "loads page 2 below page 1…", "stops at min(total_pages, 500)" |
| C2 de-dup by id | hook `flattenPages` | "renders a movie id that appears on two pages once" |
| C3 one request in flight; none after last page | `loadMore` guard + `cancelRefetch:false` | "makes one request when loadMore fires repeatedly…", end case |
| C4 next-page failure, Retry only that page | `stalled`, `retryMore`, `PagingFooter` | "keeps the posters… Retry loads only that page", "page 2 failing then page 3 failing…"; `homePaging-test` error |
| C4b empty-page loop in the queryFn, real page bookkeeping, 3 empties gives Retry row | `getPopularPage` | "reads on past an empty page…", "returns the empty page after three empties…", "stops reading at the last page…", "reads on when the first page is empty", "…every page read is empty" |
| C5 pull-to-refresh: one request with five pages, snapshot restore on failure, toast | hook `refresh`; `index.tsx` | "fetches page 1 only…", "puts all five pages back…", "a failed refresh keeps the page count…" |
| C5b pull during next page | `cancelQueries` | "a pull while page 2 is in flight ignores page 2's late result" |
| C5c end-reached during refresh | `refreshingRef` | "end-reached while a refresh runs makes no request until it ends" |
| C6 leave and return, no request | `queryClient` default `refetchOnMount:false` (12a) | `homePaging-test` "returning to Home shows the same list…" |
| C7 ~100 posters | `recyclingKey` kept in `PosterCard`; footer is its own component; list array memoised | device scroll (below); Queenie measures jank |
| C8 standards | tokens only; Spinner/PagingFooter/Button/Toast reused | no colour/size literals in the new files |

## Failure items (Manager list): handling + test
1 no duplicates: `flattenPages`, de-dup test. 2 empty filtered page: `getPopularPage`, C4b tests. 3 pull-to-refresh:
`refresh`, C5 tests. 4 races: C5b, C5c, double pull ("two pulls in a row make one set of requests"). 5 end of list: end
footer, no request (C1, `homePaging` end). 6 next-page failure: C4 tests. 7 Toast offset fixed (above); the B6 HTTP-cache wording is for Priya/Manager,
no code. 8 performance: `recyclingKey` unchanged, list array memoised, footer is a separate component; Queenie measures. 9 Sentry: offline and timeout not reported;
502 `upstream_auth` reported once per failed query, including a failed refresh ("never reports offline…", "reports a failed refresh to Sentry once").
Also: leaving mid-refresh sets no state and shows no toast ("sets no state and shows no toast when the screen is left mid-refresh").
10 standards and emulator rules: followed (td_emu restarted first, 1.75 px/dp, nothing on /sdcard).

## LESSONS checklist
Spec-trace: above. Verbatim copy: yes. Failure paths: every async action covered (fail, cancel, double tap, leave
mid-flight). Sentry: M9 only, via the QueryCache. Server code, DB rows, orphans, RLS, moderation items: n/a (no server or
DB change). act(): 0 warnings. Android flat fallback: the footer has no blur; Toast already flat. Fonts: `type.*` roles
only, no `fontWeight`. Tokens: `footerRow`, `spinner` added; no literals. Insets: Toast now accounts for the tab bar.
Shared state: none new. Multi-step logic in a module hook: yes. Comments: one purpose line per block, no history.

## Device (td_emu restarted first; Justin's signed-in account untouched; own Metro stopped, port 8081 verified free)
- `evidence/build-12b/bella-paging.png`: after about 27 swipes (well past page 3, 100+ posters) the list shows the "Loading more…" footer.
- `evidence/build-12b/bella-refresh.png`: a pull from the top shows the gold-on-dark refresh spinner.
- `evidence/build-12b/bella-toast.png`, `bella-toast-settings.png`: Toast bottom 44 px (25 dp) above the tab bar top on Home and on Settings.
- Not checked on device: end-of-list footer (needs page 500), failed-page footer and failed refresh (need offline); covered by Jest. Queenie to do the offline checks.

## Gates
tsc app OK; tsc `supabase/functions/tsconfig.json` OK; `npx expo lint` OK (0 problems); `npx jest` run twice: 35 suites, 332 tests passed both
times, 0 `act(` warnings, 0 console warnings (output files deleted); starts OK (bundled and ran on the emulator).
New tests: `popularPaging-test` (21), `homePaging-test` (6), `toastOffset-test` (2); `home-test` PAGE changed to `total_pages: 1`.

## Out of scope touched
`ui/Toast` (the carried Toast offset fix, assigned) and `__tests__/home-test.tsx` (stub `total_pages: 1`, see the Auto-paging bullet). `tokens.ts` gained two tokens.

---

# QA — Queenie (Phase 3, 2026-10-01)

HEAD c8f80e1 (later commits touch logs only). td_emu restarted first (adb was hung; killed adb + qemu, relaunched, waited for loadavg < 3),
720x1600 @ 280 dpi = 1.75 px/dp, signed in as Justin's main account (no sign-out, delete or Google sign-in). Own Metro (stopped, port 8081 free,
`adb reverse --remove-all` done). Evidence: `logs/evidence/build-12b/qa-*`. Nothing written to /sdcard.
Counts come from uiautomator dumps after each 900 px swipe (FlashList keeps only visible rows, so "labels" = distinct poster
content-descriptions seen over a walk; `qa-*-labels.txt`).

## Result table
| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | Infinite scroll | PASS | `qa-01-loading-more.png` ("Loading more…", gold 20 dp ring, verbatim); `qa-01-dup-check.txt` (99 distinct labels over 10 steps, 0 repeats; an earlier 12-step walk reached 117, 0 repeats) |
| 2 | Smoothness | PASS (numbers below) | gfxinfo, no screenshot |
| 3 | Next-page failure | PASS (+ Bug 2, minor) | `qa-03a`, `qa-03b-*`, `qa-03c-*` |
| 4 | Pull-to-refresh | **FAIL (Bug 1)** | `qa-04-pull-spinner.png`, `qa-bug1-*` |
| 5 | Refresh failure | PASS | `qa-05d-*` |
| 6 | Toast position | PASS | `qa-06-toast-home.png`, `qa-06-toast-settings.png` |
| 7 | End of list | UNTESTABLE on device (page 500); Jest covers | none |
| 8 | Regression | PASS, with observations below | `qa-08-*` |
| 9 | Logcat / ANR | `am_anr` = 0; red lines listed below | none |

## Item 2 — jank (fresh restart, dev build on td_emu; `gfxinfo reset`, then 20 swipes in 11.7 s while pages loaded)
Total frames 677. **Janky frames 12 (1.77 %)**. 50th pct 25 ms, 90th 31 ms, 95th 32 ms, 99th 40 ms. Missed Vsync 1, slow UI thread 4,
slow bitmap uploads 0. GPU 50th/90th/95th 18/21/23 ms (GPU 99th 4950 ms is one outlier frame). "Janky (legacy)" 84.79 % uses the old
16.6 ms budget; the emulator's frames sit at 22-30 ms, so that figure describes the emulator, not the list.

## Item 3 — next-page failure (offline = wifi + data off, after about 100 posters were loaded)
- Footer: `⚠ Couldn't load more movies.` (red, centred) + `Retry` button, label "Retry loading more movies"; Retry bounds 84 px = **48 dp**.
  Loaded posters stay (offline their images show the 🎬 + title fallback; they had not been loaded before the cut). `qa-03a-next-page-error.png`
- Retry while offline: spinner row ("Loading more…"), then the same error again; no crash. `qa-03b-retry-spinner.png`, `qa-03b-after-retry.png`.
  **No automatic retries:** after the tap, `gfxinfo reset` + 20 idle seconds = **0 frames rendered**; 9 dumps over 29 s show the same footer.
- Network on + Retry: the page appends (Incredibles 2, 28 Days Later, The Lion King, ...). `qa-03c-retry-appended.png`
- Posters whose image failed while offline stay on the 🎬 fallback after the network returns. Observation, not filed.

## Item 4 — pull-to-refresh
Spinner: gold ring on a dark disc over the Roulette card (`qa-04-pull-spinner.png`); page 1 comes back at the top (`qa-04-pull-spinner-b.png`).
But the list is broken afterwards: Bug 1.

## Item 5 — refresh failure (page 1 last loaded more than 5 min earlier, so the 5-min HTTP cache could not answer)
Before: 90 distinct labels over 9 steps (`qa-05d-before-labels.txt`). Offline, one pull from the top: spinner (`qa-05d-spinner-offline.png`), then the Toast
**"Couldn't refresh. Check your connection."** verbatim (`qa-05d-refresh-failed-toast.png`); list intact at the top; never an empty or error screen.
After: 87 distinct labels over the same 9 steps (`qa-05d-after-labels.txt`; the difference is the start offset) and the list continues into the later pages.
Note for Priya/Manager (B6 wording): an offline pull **within 5 min** of page 1's last load *succeeds from the HTTP cache*: no Toast, and the list is trimmed to page 1
(my first three attempts hit this). That is the cache rule working; the trimmed list is then Bug 1.

## Item 6 — Toast position (UI-dump bounds)
Home, Roulette tap: toast [0,1301][720,1378]; tab bar top 1420, so **42 px = 24 dp** above the tab bar. `qa-06-toast-home.png`
Settings, "Comments on my collection" (toast "Comment settings are coming soon."): [0,1302][720,1378], **42 px = 24 dp**. `qa-06-toast-settings.png`
Both match the board (24 dp).

## Item 8 — regression
Roulette: button `Surprise me`, 84 px = 48 dp, full-strength gold; toast "Smart picks are coming soon."; poster labels "{title}, {year}" in every dump.
Profile; Settings (TMDB attribution text and "Blocked users" row present); Blocked users (empty state "No blocked users"); Edit profile (opened, Cancel returns to Settings, nothing saved);
Debug "FETCH POPULAR MOVIES" (5 titles + attribution); Debug harness "Report profile" (sheet opens, 7 reasons, Send report dimmed, no Toast; Cancel closes it, nothing submitted).
`qa-08-profile / settings / blocked-users / edit-profile / after-cancel / debug / debug-fetch-popular / report-sheet.png`.
Not re-verified on device: the 12a empty and error states (Observation 1) and the loading skeleton (not caught in 40 s of frames); Jest covers them.

## Item 9 — logcat
`am_anr`: 0 (events buffer cleared at the start, not again). Red lines from the app, exact text:
- `E unknown:ReactHost: Unhandled SoftException` then `com.facebook.react.bridge.ReactNoCrashSoftException: raiseSoftException(onWindowFocusChange(hasFocus = "true")): Tried to access onWindowFocusChange while context is not ready` (once, at the first cold launch, 07:44:25).
- `E ExpoImage: Failed to load resource` then `java.net.UnknownHostException(Unable to resolve host "image.tmdb.org": No address associated with hostname)`: 8 pairs while I was offline (my offline tests).
- On screen: a blue banner **"Refreshing..."** across the top during one pull (`qa-04-pull-spinner.png`); Metro printed two `Android Bundled ...ms node_modules\expo-router\entry.js (1 module)` rebuilds although no file under `src/` had changed (mtimes checked).
No red or yellow warning box on screen.

## Bugs

### Build 12b · Bug 1 — After a pull-to-refresh the list stops paging: page 1 only, no footer, never loads page 2 (blocks C5)
Steps: open Home, scroll to page 3 or further, scroll back to the top, pull down once (network on; page 1 reloads). Scroll to the bottom.
Expected: the ~17 posters of page 1 are followed by page 2 near the bottom (footer "Loading more…"), as before the pull.
Actual: the list ends after the last page-1 poster (17 distinct labels, `qa-bug1-after-online-pull-labels.txt`); **no footer of any kind** (no spinner, error or end line), no request,
nothing changes however often you scroll; leaving Home and coming back does not help. Only killing the app does. Reproduced 4 times. `qa-bug1-stall-bottom.png`, `qa-bug1-stall-after-refresh.png`, `qa-bug1-stall-no-footer.png`.
My reading (Ruby/Bella to confirm in code): the footer is "none" exactly when `refreshing` is false, nothing is fetching, not stalled and `hasNextPage` is true, so the data layer thinks "idle, more to load" while
`loadMore` never fires (FlashList's end-reached not re-firing after the data shrank, or a guard such as `refreshingRef` staying set). Jest cannot see this.
The same state follows when an offline pull is answered by the HTTP cache (Item 5 note).

### Build 12b · Bug 2 — After a failed Retry the Retry button sits under the tab bar (minor)
Steps: offline at the end of the list, the error footer shows with Retry fully visible (`qa-03a-next-page-error.png`); tap Retry (still offline).
Expected: the footer returns to the same place. Actual: it returns about 59 px lower and the Retry button is clipped by the tab bar (about 28 dp visible, `qa-03b-after-retry.png`); the user must scroll to reach it again.
Likely cause (not verified): the spinner row is shorter than the error block, the scroll offset is clamped while it shows and not restored when the taller error block returns.

## Observations (no verdict; for Ruby / Manager)
1. Cold launch with the network OFF shows a **blank white screen with only the dev "Tools" button for 30+ s** (`qa-08-cold-launch-offline-blank.png`); it came up by itself when the network returned (`qa-08-cold-launch-offline-after-online.png`).
   Even on a throttled network the first frames were white. So the first-page error state cannot be reached from a cold start on this build; probably start-up/session from an earlier Build, not 12b.
2. FlashList showed a **fully blank list body** for a moment during a very fast fling (header and tab bar drawn, no Roulette card, no posters): `qa-04-pull-spinner-slownet.png`. Seen once; it filled in by itself.
3. A poster in the real popular feed is a lingerie photo ("On the Beach, 1985"), shown unblurred on Home. The server's adult filter did not catch it. A content-policy question for Justin (Play Store rules), not a 12b code issue.
4. "The Accountant²" reads "The Accountant�" in the uiautomator dump only; the screen renders it correctly.

## Design check (board `build-12b-home-paging.png`)
Loading footer: 56 dp row, 20 dp gold ring on a dim track, "Loading more…" caption in secondary colour, centred: matches panel 1.
Error footer: ⚠ line in danger red, 8 dp gap, glass-secondary Retry 48 dp high: matches panel 3 (apart from Bug 2).
Toast: 24 dp above the tab bar, dark elevated fill, hairline border, copy as panel 5: matches. Pull spinner: gold on the dark disc: matches panel 4.
End-of-list footer: UNTESTABLE on device.

## Verdict
**FAIL (2 Bugs).** Bug 1 blocks C5 ("returns to the top, list stays usable"); Bug 2 is minor. Items 1, 2, 3, 5, 6 and the regression pass.

---

# Build 12b · Bug 1 — Bella (2026-10-01)

Fixes Queenie's Bug 1 and Bug 2 and Ruby's findings (C5b, C5c, spinners, Toast comment, S3) plus Queenie's observation 5.

## Bug 1 — root cause (found on the device, not guessed)
FlashList reports "end reached" **once**: it fires when the scroll position enters the near-end zone, and it re-arms only when
the list `data` array changes (its `useBoundDetection` resets `pendingEndReached` in a `useMemo` on `data`) or the user leaves the zone.
A pull-to-refresh trims the list to page 1. Page 1 alone is short enough that the whole list is "near the end", so FlashList reports
end-reached **at once, while the refresh is running**, and `loadMore` correctly refuses (`refreshingRef` is set, a fetch is running).
That report is spent. When the refetch finishes it returns the same page 1, TanStack's structural sharing keeps the same `data`
object, `movies` keeps the same array, FlashList sees no data change and never reports again. State at that moment: `hasNextPage` true, not
fetching, not stalled, so the footer is "none" and nothing asks for page 2: the stuck list Queenie saw. Leaving Home does not help
because the tab screen stays mounted; killing the app resets FlashList.
Proof on td_emu with temporary logging (removed): 160 posters loaded, pull, trimmed to 20, one `loadMore` call
`{isFetching:true, ref:true}` (refused), refresh ends with 20 posters, then 8 scroll-down swipes produced **no** further `loadMore` call.
Candidates ruled out by that log: `refreshingRef` stuck (it was false after the refresh), `pageParams` not trimmed (`hasNextPage` was true),
a stuck `isFetchNextPageError` (`stalled` false).
Why Jest never saw it: the query cache notifies observers from a timer, so in Jest the trim and the refetch result arrive in one render and
nothing reports in between (a Home-level Jest test with the real FlashList also passed on the old code).

**Fix** (`usePopularMovies.ts`): the flattened `movies` array is memoised on `data` **and** `dataUpdatedAt`, so a refetch that returns identical
pages still hands the list a new array. FlashList re-arms and reports again once the refresh is over, when `loadMore` is allowed.
**Test** (`popularPaging-test` "keeps paging after a successful refresh…"): the hook is driven like FlashList (end-reached once per new
`movies` array); page 1 is held in flight so the trimmed list renders and its report is refused, then page 1 resolves; page 2 must be requested
and appended. It **fails on the previous code** (checked by stashing the fix) and passes with it.
Device after the fix: scroll to ~160 posters, 24 stray pulls plus one explicit pull, then scroll: the list continues past page 1
(`evidence/build-12b/bug1-paging-after-refresh.png`).

## Bug 2 — Retry under the tab bar after a failed Retry
Cause (as Queenie guessed): the loading row was 56 dp and the failed-load block about 88 dp; at the bottom of the list the shorter row clamps the scroll offset
and the taller block returns lower, under the tab bar. Fix: loading and failed-load footers share one height token `size.footerBlock` (88 = the failed block's
content: 8 + 16 line + 8 + 48 Retry + 8; the error line now has an explicit `lineHeight`). The end line stays 56.
**Design deviation to confirm (Manager/Dianne):** DESIGN says the loading row is 56 high; it is now 88 (spinner centred in the taller block).
Tests: `pagingFooter-test` (token holds the failed-block content; loading and error use the same height; end stays 56).
Device: Retry tapped offline, loading block shown (`bug1-retry-loading-block.png`), error returns with the button at the same place, fully above the tab bar
(`bug1-retry-visible.png`).

## Ruby findings
- **C5b** (medium): new test holds page **4** with pages 1-3 loaded, pulls, and asserts only page 1 is requested and the list is the fresh page 1 with no footer.
  Revert-tested: with `cancelQueries` deleted the test fails. For that to be true the refetch now passes `cancelRefetch: false`; before, `refetchQueries`
  cancelled the in-flight page by itself, which made `cancelQueries` redundant for the outcome.
- **C5c** (medium): new test calls `loadMore` and `retryMore` in the same tick as `refresh()` (before any await). Revert-tested: with the `refreshingRef` guards deleted it fails.
- **Spinners** (low): `ui/Spinner` takes `diameter`, `stroke`, `arcColor`, `trackColor`; `Button` (16 dp, on-gold arc) and `profile/edit.tsx` (32 dp, 3 dp ring, hairline track)
  use it with the same look. `GoogleSignInButton` untouched (Google branding). Tokens: `size.spinnerLg`, `spinnerStroke`, `spinnerStrokeLg`.
- **Toast comment** (low): `Toast.tsx` says a Toast inside a Modal must be given the bottom inset.
- **S3 log rationale** (the `home-test` change): the earlier text blamed FlashList. The real reason: the 12a test answered **every** request with the same
  `{page:1, total_pages:5}`; Home now asks for the next page whenever content is short (always, in Jest's unmeasured layout), and a stub that returns page 1 for any page number
  is a list with no end. `PAGE` therefore has `total_pages: 1`, i.e. the 12a tests describe a single-page list. A stub contract, not a FlashList defect. (Corrected in the Phase 1-2 text above.)

## Queenie observation 5 — failed posters retry
`PosterCard` takes `retryToken`; its failed state is keyed by URL **and** token, so a new token makes it try the image again and the same token never does (no loop).
The hook's `refreshCount` goes up once per pull and `PosterGrid` hands it to every tile (plus `extraData`). Tests: `PosterCard-test` (fails, same token stays on the fallback,
new token retries, fails again stays), `popularPaging-test` (counter goes up once per pull). Not checked on the device (needs a failed image then network back).

## Gates
tsc app OK, tsc functions OK, `npx expo lint` OK, `npx jest` twice: 36 suites / 338 tests passed both times, 0 `act(` and 0 console warnings (output files deleted).
New or changed tests: `popularPaging-test` 24 (Bug 1, C5b, C5c, token), `pagingFooter-test` 3, `PosterCard-test` +1, `homePaging-test` 5.
Emulator restarted first; own Metro stopped (port 8081 free); Justin's account not signed out; wifi and data switched off for the offline check and switched back on.

## Out of scope touched
`ui/Button/Button.tsx` and `app/(tabs)/profile/edit.tsx` (spinner migration, Ruby low), `ui/PosterCard` (observation 5), `ui/tokens.ts` (spinner and footer tokens), `ui/Toast/Toast.tsx` (comment).


---

# QA 2 — Queenie, re-test of Bug 1 / Bug 2 at 219a462 (2026-10-01)

td_emu restarted first (adb was hung again: killed adb + qemu, relaunched, waited for loadavg < 3); events buffer cleared once at the start.
Own Metro (stopped, port 8081 free, `adb reverse --remove-all`, wifi/data on, network speed/delay restored). Justin's main account, no sign-out, nothing saved, nothing on /sdcard.
Evidence: `logs/evidence/build-12b/qa2-*`.

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | Bug 1: pull, then scroll, three cycles | **PASS.** Each cycle: 80+ posters loaded, scroll to top, pull (network on), walk 9 steps: 90 distinct labels, 0 repeats (was stuck at 17 with no footer before the fix). | `qa2-01-cycles.txt`, `qa2-01-paging-after-pull.png` |
| 1b | Pull, leave Home (Profile tab), return, scroll | **PASS.** 90 distinct labels, 0 repeats; paging continues. | `qa2-01-cycles.txt` (leave-return), `qa2-01-after-leave-return.png` |
| 2 | Bug 2: offline error footer, Retry offline (fails), Retry position | **PASS.** Retry bounds [281,1311][439,1395] before and after the failed Retry (identical, 84 px = 48 dp), bottom 25 px above the tab bar top (1420). Error footer text and Retry verbatim. | `qa2-02-error-footer.png`, `qa2-02-after-failed-retry.png` |
| 2b | Network on, Retry | **PASS.** Next page appends (new row at y=1256). | `qa2-02-retry-appended.png` |
| 3 | Footer heights, nothing clipped | **PASS.** Error block and loading block both [26,1255][694,1409] = 154 px = **88 dp**; both end 11 px above the tab bar (1420), nothing clipped. Loading block caught while retrying on a slowed network; no jump between loading and error (Retry stays put). End line (56 dp): **UNTESTABLE on device** (page 500), Jest covers. | `qa2-03-retry-loading-block.png`, dumps as above |
| 4 | Failed posters retry on pull | **PASS.** Cleared the app's image caches (`run-as … rm cache/image_manager_disk_cache/*`, cache only), went offline, scrolled away and back: page-1 tiles showed the 🎬 fallback (The Odyssey, The End of Oak Street, The Love Hypothesis, The Fix, After Impact, The Mongoose). Network on, one pull: every one of those tiles shows its poster. | `qa2-04-failed-tiles-offline.png`, `qa2-04-after-pull-online.png` |
| 5a | Edit profile: type in usertag, Cancel, no save | **PASS.** Typed "zz" (field read `tsujintsujinzz`), Cancel returned to Settings, then Profile still shows `@tsujintsujin`. Save spinner: **UNTESTABLE without saving** (it only shows on Save; not done). | `qa2-05-edit-usertag-typed.png`, `qa2-05-profile-after-cancel.png` |
| 5b | Roulette toast | **PASS.** "Smart picks are coming soon." | `qa2-05-roulette-toast.png` |
| 5c | Settings | **PASS.** Rows, TMDB attribution, Blocked users, Delete, version all present. | `qa2-05-settings.png` |
| 6 | `am_anr` | **0** | none |

Logcat red lines from the app, exact text: the same one-off at the first cold launch,
`E unknown:ReactHost: Unhandled SoftException` / `ReactNoCrashSoftException: raiseSoftException(onWindowFocusChange(hasFocus = "true")): Tried to access onWindowFocusChange while context is not ready` (09:03:54);
`ExpoImage … UnknownHostException image.tmdb.org` lines from my offline steps. No red or yellow box on screen.
Setup note: my first launch hit "There was a problem loading the project … java.io.IOException: unexpected end of stream on http://localhost:8…" because Metro was still starting; Reload after Metro was up fixed it (my timing, not the app).

## Verdict
**PASS.** Bug 1 and Bug 2 are fixed on device; the 88 dp footers do not clip; the failed-poster retry works. Untestable: end-line 56 dp (page 500) and the Edit profile Save spinner (needs a real save).

## Build 12b — CLOSED (Manager, 2026-10-01)
- Commits: c8f80e1 build · 219a462 Bug 1 (re-arm end-reached after refresh; steady 88dp footer;
  C5b/C5c revert-tested; spinner migration; PosterCard retryToken) · DESIGN b9e7b1e (Dianne).
- Gates (Manager rerun at 219a462): tsc app + functions, lint, jest 338/338 ×2, 0 warnings.
- QA: Queenie QA FAIL (2 bugs) → QA 2 PASS (3 pull→scroll cycles, leave/return, Retry position,
  failed posters reload after a pull, regression, 0 ANRs).
- Review: Ruby FIX NEEDED → PASS (3 low notes: footer lineHeight override, one eslint-disable with
  a reason, DESIGN 88dp — landed in b9e7b1e).
- Manager spot re-run: 111 distinct posters before the pull, 144 after scrolling post-refresh,
  0 duplicates on screen, 0 ANRs (`manager-spot-after-refresh.png`).
- UNTESTABLE → Justin: end-of-list line (page 500); Save spinner in Edit profile (needs a real save).
- NEEDS JUSTIN (content policy): suggestive but non-adult-flagged posters appear in TMDB Popular
  (seen twice). Default: no extra filtering until he decides.
