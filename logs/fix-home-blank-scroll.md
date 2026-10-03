# Fix: Home scrolls into a large blank area (reported by Justin, 2026-10-02)

## Report
Justin, scrolling Home's Popular grid: the list can be scrolled "waaaay down" into a big empty area with
only one row of posters at the top (`logs/evidence/fix-home-blank-scroll/justin-01-blank.png`). Expected: the
list ends at the last loaded row with the "Loading more..." footer under it (`justin-02-expected.png`).

## Manager first read (code only, not yet reproduced)
`PosterGrid` (FlashList 2.0.2, 3 columns) has no extra spacer: content = header + loaded rows + PagingFooter.
So the blank is most likely one of:
(a) FlashList blank cells during a fast fling (rows not drawn yet on a slow device) — they fill in after a moment;
(b) FlashList's estimated content height for unmeasured rows being too large after many pages, so the
    scrollable height runs past the real last row;
(c) something else that keeps a large height (footer state, header remeasure).
Next: reproduce on td_emu after Build 14's device work (don't overlap), record whether the blank fills in or
stays, measure content height vs rows × row height, then brief Bella. Done means: at any scroll speed the list
never shows more than a brief partial row of blank, and never scrolls past the last row + footer; a test pins
the cause.

## Justin's answer (2026-10-02)
The blank fills in with posters after a few seconds; it stays blank while the user keeps flinging ("definitely
looks not friendly"). So it is cause (a): FlashList cells not mounted/drawn fast enough during a fling — not
extra scroll height.
Fix direction (to measure, not guess): FlashList's blank-area measurement before/after on td_emu (and note the
emulator is slower than a phone); raise `drawDistance`; make cells cheap to mount (no per-cell shimmer animation
while flinging, exact fixed cell size so no re-measure); while a poster image is still loading the cell shows its
poster-frame fill, never nothing. Done means: on td_emu a 10-fling run shows no fully blank screen and only brief
partial blank rows, measured and compared with the baseline; Home's paging/refresh tests unchanged.

## Manager — before Phase 1 (2026-10-03)
Base SHA: c7884a7 (branch `module/quick-add-swipe`).

Code read: `PosterGrid` (FlashList 2.0.2, no `drawDistance` set → default), each `PosterCard` mounts a
`ShimmerFill` whose `usePulse` starts its own `Animated.loop` on mount, and a recycled cell resets to the shimmer
until its new image fires `onLoad`. Cell size comes from `width: 100%` + `aspectRatio`, so FlashList measures
every new cell. FlashList 2's `useBenchmark` only reports JS FPS — **no built-in blank-area number**, so the
blank area has to be measured from the screen.

Measurement method (same before and after, on td_emu after `scripts/emulator.sh ensure`, Home scrolled
from the top, several pages already loaded so paging isn't what's measured):
10 flings with `adb shell input swipe` at a realistic speed (≥ 80 ms duration — a 1 ms swipe is an adb
artifact, Build 13 Bug 2); after each fling, screenshots at ~150 ms, ~500 ms and ~1 s; for each shot, the
share of the grid area that is plain backdrop (no poster, no poster-frame fill). Report max and mean per
time point, and how many shots are "fully blank" (grid area > 90 % backdrop). Keep the script in
`scripts/` so the after-run is identical.

### Failure-mode list (each → a Done-means line + a test or a measured check)
1. **Fast fling** — no fully blank screen in a 10-fling run; partial blank rows only, and they clear
   within ~1 s of the fling ending. Measured before/after (device).
2. **Image still loading** — a cell whose image hasn't loaded shows the poster-frame fill (flat
   `bg.elevatedFlat` + wash), never the backdrop. Test: a cell before `onLoad` renders the fill.
3. **Recycled cell** — a recycled cell never shows the previous movie's poster or failure state (existing
   PosterCard tests must still pass unchanged).
4. **Cheap mount** — no per-cell `Animated.loop` started while flinging (one shared pulse, or a static
   fill in grid cells — Bella proposes, Dianne's §1.9 shimmer rule decides what's allowed). Test pins it.
5. **Paging + refresh** — infinite scroll, de-dup, pull-to-refresh and Retry footer behave exactly as
   before: Home/paging tests unchanged and passing.
6. **Memory** — a larger `drawDistance` must not blow memory: note the app's memory (`dumpsys meminfo`)
   after the 10-fling run, before vs after.
7. **Accessibility** — loading placeholders stay hidden from TalkBack; poster labels unchanged.
8. **Sentry** — nothing new sent (image load failures stay non-events).
9. **Other callers** — `PosterCard` is also used on movie details (and the skeleton on Home loading);
   any change to the shared component is checked on those screens too.

## State at shutdown (Manager, 2026-10-03 — Justin went to sleep; Bella stopped mid-task)
Scripts: `scripts/fling-blank.sh`, `scripts/fling_blank.py`, `scripts/fling_summary.py` (10 flings × 3 shots;
a = ~0.2 s, b = ~0.6 s, c = ~1.1 s after the swipe; value = share of grid area that is backdrop).

| run | a max / mean | b max / mean | c max / mean | fully blank (>90 %) |
|---|---|---|---|---|
| baseline | 0.994 / 0.908 | 0.994 / 0.635 | 0.304 / 0.133 | **11 / 30** |
| after | 0.131 / 0.104 | 0.902 / 0.203 | 0.128 / 0.102 | 1 / 30 |
| after2 | 0.365 / 0.131 | 0.994 / 0.385 | 0.246 / 0.107 | 1 / 30 |
| after3 | 0.186 / 0.110 | 0.994 / 0.252 | 0.312 / 0.118 | 1 / 30 |
| after4 | 0.115 / 0.095 | 0.317 / 0.172 | 0.115 / 0.093 | 0 / 30 |
| after5 | 0.328 / 0.119 | 0.994 / 0.236 | 0.108 / 0.093 | 1 / 30 |
(summaries + csv + meminfo in `logs/evidence/fix-home-blank-scroll/<run>/`; `keep/` = screenshots, untracked.)
Note: ~0.10 is the floor (margins/gaps count as backdrop), so "after" is near-clean except one ~0.6 s shot per run.

**Uncommitted src changes (left in the working tree, NOT gated):**
- `PosterGrid.tsx`: `drawDistance={DRAW_DISTANCE}` = 2500 dp.
- `usePulse.ts`: one module-level shared `Animated.Value` + ref-counted loop (starts with the first placeholder,
  stops with the last) instead of one loop per tile.
Not done: the remaining single fully-blank shot at ~0.6 s (Done = 0/30); which after-run matches which code
(Bella didn't record per-run changes); meminfo before/after comparison; tests for items 2 and 4 (shared pulse
must be tested: two mounts → one loop, last unmount stops it); gates; Ruby; Queenie; device check of details +
Home loading skeleton. Next session: Bella resumes from here.
