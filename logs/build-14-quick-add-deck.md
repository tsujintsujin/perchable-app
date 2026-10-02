# Build 14 — Quick Add swipe deck (Module 5: Quick-add swipe)

Base SHA: c0cc283 (Phase 1 start 2026-10-02, branch `module/quick-add-swipe`)
Plan: PLAN.md "Build 14" A1–A5, B1–B13 + Module 5 M1–M11 (final 6225236 after two Ruby rounds + Manager check).
Phase 0: Dianne, whole module (M11) — DESIGN.md "Build 14/15/16b" (a6edc26 + fixes); boards rendered by the
Manager in `logs/evidence/build-14/design/`. Needs from Justin: nothing (N1, N3–N6 are defaults).

## Failure-mode list (Manager, before Phase 1) — each is a Done-means line + a required test
PLAN.md's Build 14 "Failure modes to cover" apply in full. Manager additions / emphasis:
1. **A1 proof first, before any screen work.** Bella makes the throwaway worklet check (not committed): a
   shared value animating + a runOnJS callback, on td_emu, no Reanimated version-mismatch at start-up. She
   records "rebuild needed: yes/no" with a screenshot + logcat; the Manager verifies the evidence. If a rebuild
   IS needed, stop and report (Gradle recipe, no overlap with QA) — don't work around it.
2. **Mid-gesture states are the deliverable** (Rule Zero). Whatever the user sees DURING a drag — follow, tilt,
   stamp fade 15%→30%, the card behind scaling, spring-back, fly-off, the third slot refilling — must match the
   drag board. Jest drives what gesture-handler's test utils can; the log names every state only the emulator proves.
3. **One swipe per action.** Button double-tap, a swipe during the previous exit, ten swipes in < 3 s → each
   card leaves once, no card lost or shown twice, one page request in flight.
4. **Interrupted gestures leave no stuck state:** finger leaves the screen, a second finger, an app switch or
   system gesture mid-drag, Back mid-exit → the card returns centred, no leftover stamp/tilt, buttons enabled.
5. **Deck stays a pure function** (M2): visible cards = de-duplicated pages − skips − session set; Undo =
   un-exclude. No card ever appears twice; 12 all-excluded pages on first load still give a card with no Retry.
6. **Home is untouched:** `MAX_PAGES_PER_LOAD = 3`, Home's tests unchanged; the deck has its own query key and
   `DECK_MAX_PAGES_PER_LOAD = 15`, `retry: 0`, no refetch on reconnect/focus.
7. **Sign-out + per-user storage:** skips and the session set are per user, cleared on sign-out (not first
   render), never read across users; corrupt or failed storage never breaks the deck.
8. **Reduce motion** via AccessibilityInfo + listener → a shared value the worklets read; every animation sets
   `reduceMotion` explicitly; reduced path = 150 ms fade / 150 ms ease-back, no tilt/fly-off.
9. **Accessibility:** labelled card pressable with Skip / Add / Open details actions; buttons "Skip {title}",
   "Add {title} to collection", "Undo"; announcement + focus after each swipe and on "{title} is back";
   all targets ≥ 48 dp; the three control labels share one baseline (Manager board check).
10. **Network + Sentry:** offline cold start → error + Retry within ~20 s; offline mid-deck keeps swiping with
    fallbacks; M9 only (never timeout/offline/4xx/429/upstream_*), once per failed query.
11. **Shared changes ripple:** BackChip → `src/ui/BackChip`, `goBackOrHome` → `src/lib/navigation.ts`,
    Toast side margin + `maxFontSizeMultiplier`, the §4 cross-module index import rule: every existing caller
    still works (details, Home, settings Toasts) and its tests pass unchanged or are updated with a reason.
12. **Standards + emulator rules:** tokens only, flat fills, ≤ 3 cards mounted, `.get()/.set()` on shared
    values (React Compiler), 1–2 line comments; `scripts/emulator.sh ensure` before device work; never /sdcard;
    no sign-out; jest `--maxWorkers=50%`; React Query act pattern in tests (no act-env switching).
