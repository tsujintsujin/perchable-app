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
