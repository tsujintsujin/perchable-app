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
