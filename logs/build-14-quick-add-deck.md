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

## Design change by Justin (2026-10-02, after a629a2c) — rework round
- Justin: "quick add should be a button below, along with Perch and Profile" → Quick Add is a bottom tab
  (Perch · Quick Add · Profile), no Home row, no back chip (PLAN N1 9ed71b4; Priya 00c1348).
- Justin: "the movie should be full screen layout" → full-bleed poster deck inside the tab (Dianne 317ea0e).
- Justin noticed right swipe / Add doesn't add: expected until Build 16b (N4); the "Watched" button on details
  he asked for is planned as Build 16c (Priya 00c1348).
- Boards re-rendered by the Manager (`logs/evidence/build-14/design/`, home-entry replaced by tab-bar): no clipping
  or overlap; motion frames are card-only by design.

---
# Bella: Phase 1-2 report (a629a2c deck, rework below)

## A1 (worklet check), done first, throwaway, not committed
Shared value animated 0 to 200 over 600 ms with `reduceMotion: Never` and a `scheduleOnRN` callback: the box ended at
x = 350 px (200 dp at 1.75 px/dp) and the JS log printed `A1 callback reached JS, finished=true`. No Reanimated/Worklets
version mismatch in logcat (only a benign `ViewManagerPropertyUpdater ... REASharedTransitionBoundaryManager` warning).
**Rebuild needed: no.** The Expo preset applies the worklets plugin (no `babel.config.js`). Evidence:
`logs/evidence/build-14/device/a1-worklet-check.png`, `a1-logcat.txt`.
Found on td_emu: Android reports **reduce motion = ON** (animation scales 0, Reanimated warns at start-up), so the hook
returns true there; QA must set the three scales to 1 and force-stop for the full-motion pass. Gesture units measured:
translation and velocity are **dp and dp/s** (100 px in 400 ms reported 142.9 = 250 px/s / 1.75), and translation counts from
where the pan activated (after the 10 dp slop).

## What was built and why (concept level)
- **Data = a pure function.** `useQuickAddDeck` keeps the loaded pages (React Query infinite query, key
  `["movies","deck","popular"]`, defaults in `queryClient.ts`: retry 0, no refetch on reconnect/focus/mount) and an exclusion
  set (saved skips + this session's right swipes). `cards = dedupe(pages).filter(not excluded)`. Undo just leaves the set, so the
  card returns to its original place; nothing is an index. The page loop (`readDeckPage`) reads up to 15 pages that hold nothing
  new (Home keeps 3) and remembers where it stopped so Retry resumes. The next page is requested from the swipe handler (an
  event), joined if one is in flight.
- **Skip memory.** AsyncStorage, one key per user, ids only, cap 5,000, per-user write chain (last write wins), every failure
  swallowed. Cleared by a hook in the root navigator when the session goes from a user to none or to another user.
- **Gesture.** Each card owns its drag values and its own exit animation, so the card that was on top keeps animating in its
  own layer while the new top is draggable at once. A shared `settle + dragP` coordinate positions the card behind
  (`position = rank - (settle + dragP)`), where rank survives list shifts. Reduce motion is a shared value set from
  `AccessibilityInfo` and its listener; worklets read it, so a mid-session change applies to the very next release.
- **Why not** a pager/carousel library or Reanimated layout animations: the stack is two views and the exit must interleave with
  data changes; no new dependency.
- **Decisions flagged:** the Jest resolver `react-native-worklets/jest/resolver` (config only) lets real Reanimated run in Jest, so
  animations are driven with fake timers instead of mocked away. AsyncStorage gets an in-memory stand-in in `jest.setup.js`.

## Concepts learned
Shared values and `.get()/.set()` under React Compiler; `scheduleOnRN` (worklets 0.10) replacing `runOnJS`; gesture-handler
`Pan` activation/fail offsets and `onEnd(success)` for cancels; keyed instances keep their running animation when their role changes
(one list, not two arrays); Android view flattening hands a child's `zIndex` to the grandparent unless `collapsable={false}`.

## Failure-mode list (1-12) to tests
| # | Handling | Test |
|---|---|---|
| 1 | A1 | device evidence above |
| 2 | mid-gesture states | quickAddScreen-test "the drag, mid-gesture", "a card leaves with the design's motion" (fake timers) |
| 3 | one swipe per action | "one swipe per action" (ten swipes, swipe during exit, ten button presses, disabled while exiting) |
| 4 | interrupted gestures | "an interrupted drag ...", "releasing below the threshold ..." |
| 5 | pure function | quickAddDeck-test "deck data (A4)", "the page loop" |
| 6 | Home untouched | quickAddDeck-test constants; quickAddWiring "keeps Home's page limit at 3"; queryClient-test; Home tests unchanged |
| 7 | sign-out + per-user | skipMemory-test (hook, per-user keys, not at first render, corrupt/failing storage) |
| 8 | reduce motion | quickAddScreen-test "reduce motion", wiring grep "reduceMotion explicitly" |
| 9 | accessibility | "tap, details and accessibility", Undo held return, controls test |
| 10 | network + Sentry | quickAddDeck-test "errors and Sentry (M9)", offline/keep-going/next-failed screens |
| 11 | shared changes | backChip-test, toastLayout-test, tabBar-test; Home and details tests unchanged and green |
| 12 | standards | quickAddWiring "standards greps"; tsc, lint |

**Only the emulator proves:** real finger feel and the edge-swipe with gesture navigation; a drag past the slop never becoming a
tap (the gesture root cancels the Pressable); the cold-start offline ~20 s; TalkBack focus and announcements; font scale 1.3
layout; Android view flattening and zIndex (found on device, see rework); the `exiting` shared-value guard against a double tap
faster than one React render (Jest cannot press faster than a render; the disabled state is what the test proves).

## Rework: tab + full-bleed (after Justin's change; DESIGN 317ea0e)
Done: Quick Add is the middle tab (`(tabs)/quick-add.tsx`, `TAB_META`), no Home row, no back chip, no root `quick-add` route;
the poster fills the content area; header on a top scrim; fixed bottom dock with the controls; band above the dock; Toast at the
top (`Toast position`); tilt 6 degrees about the bottom centre; the top poster, the next one and the leaving one mounted.
Removed: the size formula (`deckLayout.ts`), `QuickAddRow`, `useOpenQuickAdd`, tokens `deckSideMargin`, `deckStackReserve`,
`deckToastLane`, `quickAdd*`, `chevron`, `stackLift`. Kept: A1, decideSwipe, the hook, skip memory, reduce motion, a11y, and
`BackChip` (details only).
Found on device and fixed: the card stack box was flattened by Android, so the cards' zIndex drew them over the dock, header
and scrim; `collapsable={false}` on the stack (test "native box"). Not visible in Jest.

| Spec line (DESIGN Build 14, reworked) | file:line |
|---|---|
| Quick Add is the middle tab, glyph, label | `ui/TabBar/TabBar.tsx:10`, `app/(tabs)/_layout.tsx:12` |
| No back chip; floating title left 20, right 72, top inset+12 | `QuickAddScreen.tsx` `styles.title`; test "floating title" |
| Card = whole content area, no radius or border | `QuickAddScreen.tsx` (`cardSize={area}`), `SwipeDeckCard.tsx` card style |
| Top scrim held to the header bottom, fade 24 | `QuickAddScreen.tsx:129-135`, `tokens.ts:196` |
| Dock 102 (16 + controls + 8), controls fixed | `QuickAddScreen.tsx:42`, `styles.dock`, `tokens.ts:195` |
| Band ends at the dock, padding 20 / 16 | `SwipeDeckCard.tsx:96`, `:141` |
| Stamp top 224, left and right 20 | `SwipeDeckCard.tsx:154,161-162`, `tokens.ts:327` |
| Tilt about the bottom centre, max 6 | `SwipeDeck.tsx:378`, `tokens.ts:319` |
| Next poster 0.94 to 1 with dim (no lift); two mounted plus leaving | `SwipeDeck.tsx:25,190` |
| Exit to +/-(W + 24), tilting to 6 | `SwipeDeck.tsx:89` |
| Toast at the top, header bottom + 12 | `Toast.tsx:38`, `QuickAddScreen.tsx:152` |
| Loading: full-bleed shimmer, bars 24x240 and 14x140, progress above the dock | `DeckSkeleton.tsx`, `tokens.ts:336` |
| Error and empty states centred between header+8 and the dock | `QuickAddScreen.tsx:103` |
| Card stack kept a native box (zIndex) | `SwipeDeck.tsx:346` |

**Hard or impossible under the new design:** (1) the top-right 64 dp gear zone sits under the scrim (and, on a dev build, under
the dev-client gear overlay); nothing is drawn there. (2) A tab screen has no back: Android Back from the deck behaves as on any
tab. (3) The poster crop cuts about 12% per side at 390x770 (designed). (4) The tilt origin is the bottom centre for the whole
transform, so the next poster also scales about its bottom centre (hidden behind the top card at rest; not shown in the boards).
(5) The dock is 0.88 alpha over the poster as specified, so the poster shows faintly through it on the device; the board draws it
solid.
Device screenshots in `logs/evidence/build-14/device/`: `rework-tab-bar-home.png`, `rework-deck-filled-full-bleed.png`,
`rework-mid-drag-add-stamp.png`, `rework-top-toast.png` (first-version frames kept as history).
