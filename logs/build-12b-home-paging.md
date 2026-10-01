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
