"""Summarises a fling-blank.sh run: results.csv and summary.txt in the run folder.
Usage: fling_summary.py <run_dir> <flings>"""
import os
import statistics
import sys

from fling_blank import backdrop_share

out, n = sys.argv[1], int(sys.argv[2])
rows, by = [], {"a": [], "b": [], "c": []}
for i in range(1, n + 1):
    ts = open(os.path.join(out, f"times_{i}.txt")).read().split()
    for k, p in enumerate("abc"):
        s = backdrop_share(os.path.join(out, f"f{i}_{p}.png"))
        by[p].append(s)
        rows.append((i, p, ts[k] if k < len(ts) else "?", s))
with open(os.path.join(out, "results.csv"), "w") as f:
    f.write("fling,point,device_ms_after_swipe,backdrop_share\n")
    for r in rows:
        f.write(f"{r[0]},{r[1]},{r[2]},{r[3]:.3f}\n")
blank = sum(1 for r in rows if r[3] > 0.9)
with open(os.path.join(out, "summary.txt"), "w") as f:
    for p in "abc":
        f.write(f"point {p}: max {max(by[p]):.3f} mean {statistics.mean(by[p]):.3f}\n")
    f.write(f"fully blank shots (>90%): {blank} of {len(rows)}\n")
print(open(os.path.join(out, "summary.txt")).read())
