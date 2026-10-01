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
