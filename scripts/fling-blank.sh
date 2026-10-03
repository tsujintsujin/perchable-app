#!/bin/sh
# Blank-area measurement for Home's Popular grid on td_emu. Same run before and after a fix.
# Usage: scripts/fling-blank.sh [flings=10] [out_dir]
#   Prereq: scripts/emulator.sh ensure; dev build installed; Metro up (adb reverse tcp:8081 tcp:8081);
#           Home open with several pages already loaded (scroll to the bottom a few times first).
# Each fling: swipe up (120 ms, so it is a real finger-speed flick), then screenshots at three
# time points. Shots stay on-device in /data/local/tmp (never /sdcard) until pulled for analysis.
# Output: <out_dir>/fling<N>_<point>.png, results.csv (fling,point,device_ms_after_swipe,backdrop_share),
#         summary.txt (max/mean per point, fully-blank count) and dumpsys meminfo.
export MSYS_NO_PATHCONV=1
A="/c/Users/justi/AppData/Local/Android/Sdk/platform-tools/adb"
N="${1:-10}"
OUT="${2:-logs/evidence/fix-home-blank-scroll/run}"
PKG=com.tsujintsujin.perchable
DEV=/data/local/tmp/flingblank
HERE="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$OUT"
timeout 20 "$A" shell "rm -rf $DEV; mkdir -p $DEV"

# One on-device script per fling so adb round-trips do not add to the timing.
# Points: A right after the swipe returns, B +350 ms, C +750 ms (each screencap itself takes ~150-300 ms).
fling() {
  i=$1
  # Alternates the direction so the list stays inside the loaded pages: up x2 (down the list), then down x1.
  if [ $((i % 3)) -eq 0 ]; then Y1=400; Y2=1400; else Y1=1400; Y2=400; fi
  timeout 60 "$A" shell "
    input swipe 360 $Y1 360 $Y2 120
    t0=\$(date +%s%3N)
    screencap -p $DEV/f${i}_a.png; ta=\$(date +%s%3N)
    sleep 0.35; screencap -p $DEV/f${i}_b.png; tb=\$(date +%s%3N)
    sleep 0.4; screencap -p $DEV/f${i}_c.png; tc=\$(date +%s%3N)
    echo \$((ta-t0)) \$((tb-t0)) \$((tc-t0))" | tr -d '\r' > "$OUT/times_$i.txt"
  sleep 3   # let the list settle between flings
}

i=1
while [ "$i" -le "$N" ]; do fling "$i"; i=$((i + 1)); done
timeout 120 "$A" pull "$DEV/." "$OUT/" >/dev/null 2>&1
timeout 30 "$A" shell "rm -rf $DEV"
timeout 30 "$A" shell dumpsys meminfo $PKG | grep -E "TOTAL PSS|Java Heap|Native Heap|Graphics|TOTAL:" > "$OUT/meminfo.txt"

# Pixel analysis and summary.
python "$(cd "$HERE" && pwd -W 2>/dev/null || echo "$HERE")/fling_summary.py" "$OUT" "$N"
