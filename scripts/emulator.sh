#!/bin/sh
# Shared td_emu control for every agent. Restart only when the emulator is unhealthy.
# Usage: scripts/emulator.sh health | ensure | restart | stop
#   health  - print uptime, load and launcher jank; exit 1 if unhealthy (read-only)
#   ensure  - run health; restart only if unhealthy or not running; then wait until settled
#   restart - force a quick-boot restart and wait until settled
#   stop    - close the emulator when no device work is next (it ages and eats CPU while idle)
export MSYS_NO_PATHCONV=1
SDK="/c/Users/justi/AppData/Local/Android/Sdk"
A="$SDK/platform-tools/adb"
EMU_WIN='C:\Users\justi\AppData\Local\Android\Sdk\emulator\emulator.exe'
JANK90_MAX_MS=100   # launcher 90th-percentile frame time above this = degraded GPU path
UPTIME_MAX_MIN=180  # restart after 3 h even if it still measures fine

adb_ok() { timeout 10 "$A" devices 2>/dev/null | grep -q "emulator-5554[[:space:]]*device"; }

# Recover a hung or "offline" adb by restarting the adb server (known issue on this PC).
fix_adb() {
  adb_ok && return 0
  powershell.exe -NoProfile -Command "Stop-Process -Name adb -Force -ErrorAction SilentlyContinue" >/dev/null 2>&1
  timeout 20 "$A" start-server >/dev/null 2>&1
  for i in $(seq 1 30); do adb_ok && return 0; sleep 2; done
  return 1
}

load1() { timeout 10 "$A" shell cat /proc/loadavg 2>/dev/null | cut -d' ' -f1; }

# Waits for boot, then for the post-boot storm to pass (load < 3, up to 4 min).
wait_settled() {
  timeout 180 "$A" wait-for-device || return 1
  for i in $(seq 1 90); do [ "$(timeout 5 "$A" shell getprop sys.boot_completed | tr -d '\r')" = "1" ] && break; sleep 2; done
  for i in $(seq 1 48); do L=$(load1); [ "${L%.*}" -lt 3 ] 2>/dev/null && { echo "settled: load $L"; return 0; }; sleep 5; done
  echo "warning: load still $L after 4 min"; return 0
}

# Launcher 90th-percentile frame time over 4 swipes (ms), or empty on failure.
jank90() {
  timeout 10 "$A" shell input keyevent 3 >/dev/null 2>&1; sleep 2
  timeout 10 "$A" shell "dumpsys gfxinfo com.google.android.apps.nexuslauncher reset >/dev/null"
  for k in 1 2 3 4; do timeout 10 "$A" shell input swipe 360 1300 360 300 250; sleep 1; timeout 10 "$A" shell input keyevent 3; sleep 1; done
  # The line reads "90th percentile: NNNms"; take the number after the colon, not the "90".
  timeout 20 "$A" shell "dumpsys gfxinfo com.google.android.apps.nexuslauncher" | grep -m1 '^90th percentile' | sed -E 's/.*: *([0-9]+)ms.*/\1/'
}

health() {
  if ! pgrep -f qemu-system >/dev/null 2>&1 && ! powershell.exe -NoProfile -Command "if (Get-Process qemu-system* -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }" >/dev/null 2>&1; then
    echo "health: emulator not running"; return 1; fi
  fix_adb || { echo "health: adb unreachable"; return 1; }
  # Age of the emulator process on Windows. The guest's /proc/uptime survives quick-boot
  # snapshots, so it never resets on restart and would force a restart every time.
  UPM=$(powershell.exe -NoProfile -Command "[int]((Get-Date) - (Get-Process qemu-system* | Select-Object -First 1).StartTime).TotalMinutes" | tr -d '\r')
  L=$(load1); J=$(jank90)
  echo "health: uptime ${UPM} min, load $L, launcher 90th ${J:-?} ms"
  [ -n "$J" ] && [ "$J" -le "$JANK90_MAX_MS" ] && [ "$UPM" -le "$UPTIME_MAX_MIN" ] && [ "${L%.*}" -lt 6 ]
}

# Close the emulator (quick-boot snapshot is saved) and wait until the process is gone.
stop() {
  timeout 30 "$A" emu kill >/dev/null 2>&1
  for i in $(seq 1 30); do powershell.exe -NoProfile -Command "if (Get-Process qemu-system* -ErrorAction SilentlyContinue) { exit 1 } else { exit 0 }" >/dev/null 2>&1 && { echo "stop: emulator closed"; return 0; }; sleep 2; done
  echo "stop: emulator still running after 60 s"; return 1
}

restart() {
  stop >/dev/null
  # Detached start: a Bash background job would be killed when the tool call returns.
  powershell.exe -NoProfile -Command "Start-Process -FilePath '$EMU_WIN' -ArgumentList '-avd','td_emu','-gpu','host' -WindowStyle Normal" >/dev/null 2>&1
  sleep 10; fix_adb || { echo "restart: adb never came up"; return 1; }
  wait_settled
}

case "$1" in
  health) health ;;
  ensure) if health; then echo "ensure: healthy, no restart"; else echo "ensure: restarting"; restart && health; fi ;;
  restart) restart && health ;;
  stop) stop ;;
  *) echo "usage: scripts/emulator.sh health|ensure|restart|stop"; exit 2 ;;
esac
