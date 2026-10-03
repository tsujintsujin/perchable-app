"""Share of the Home grid area that shows plain backdrop in a screenshot.

Only the three tile columns are measured. A block is "backdrop" when it matches the
backdrop colour of its own pixel row, read from the screen-edge margins and the two gutters
between columns (never covered by a tile), matching any one of them; a poster or the
poster-frame fill differs from it. The ~6% of area in the gaps between rows always counts
as backdrop, so a fully filled grid reads about 0.06. Usage: fling_blank.py <png> [<png> ...]
Prints one line per file: <name> <backdrop share 0..1>.
"""
import sys
from PIL import Image

TOP, BOTTOM = 0.30, 0.90   # grid area as a fraction of screen height (below header/title, above tab bar)
BLOCK = 8                  # px per classified block
# Reference columns (fractions of width): screen edges and the two gutters between tile columns.
REF_X = [6 / 720, 249 / 720, 471 / 720, 713 / 720]
# Tile columns (fractions of width) that are measured.
TILE_X = [(36 / 720, 239 / 720), (259 / 720, 462 / 720), (481 / 720, 684 / 720)]
TOL = 7                    # max per-channel difference still counted as backdrop


def backdrop_share(path):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    px = im.load()
    refs = [int(f * w) for f in REF_X]
    y0, y1 = int(h * TOP), int(h * BOTTOM)
    total = blank = 0
    for by in range(y0, y1 - BLOCK, BLOCK):
        yc = by + BLOCK // 2
        samples = [px[x, yc] for x in refs]
        for lo, hi in TILE_X:
            for bx in range(int(lo * w), int(hi * w) - BLOCK, BLOCK):
                xc = bx + BLOCK // 2
                c = px[xc, yc]
                total += 1
                if any(max(abs(c[i] - r[i]) for i in range(3)) <= TOL for r in samples):
                    blank += 1
    return blank / total


if __name__ == "__main__":
    for p in sys.argv[1:]:
        print(p, f"{backdrop_share(p):.3f}")
