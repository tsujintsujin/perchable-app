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

---
# QA: Queenie, Build 14 (Quick Add tab, full-bleed deck), branch module/quick-add-swipe at f3a4104
Evidence: `logs/evidence/build-14/qa/` (PNG + uiautomator XML + `logcat-E.txt`). Dev build on td_emu, Metro started by me (8081, stopped, confirmed free).

Environment honesty: the emulator was loaded for much of the run (load 4 to 8, deck median frame 150 ms, Home median 97 ms per `dumpsys gfxinfo`).
`scripts/emulator.sh ensure` restarted it once (quick-boot restored the app process). Screenshots from `exec-out screencap` were often stale by
several seconds to a minute, so state was confirmed with uiautomator (card bounds, labels, enabled) and the skip store (`run-as ... RKStorage`, ids only).
Test input: `input motionevent` in ONE `adb shell` call holds a drag (separate adb calls cancel the touch; the logcat line "Got DOWN touch before receiving UP or CANCEL" is mine).
Metro's dev "Refreshing..." banner appeared several times (see Findings); I did not edit app code.

## Verdict: FAIL (2 Bugs + 2 minor). Core flows pass; the stuck "behind" pose after a fast double-tap (Bug 1) and dropped/tap-misread flicks (Bug 2) need Bella/Ruby.

| # | Item | Result | Evidence (qa/) |
|---|---|---|---|
| 1 | Tab bar Perch / Quick Add / Profile; Quick Add active gold; tap on active tab = no-op; leave and return = same card + Undo enabled; no Home row; gear corner has only the dev-client overlay | PASS (icon note Bug 4) | 02-home, 04-deck, 84-qa-after-tab-return, ui-t1/t3.xml |
| 2 | Full-bleed deck vs deck-states board (poster crop, top scrim, title band, dock, controls on one baseline); long title wraps to 2 lines ("Renegade Immortal: Battle of the Immortal Slayer", "Demon Slayer: Kimetsu no Yaiba Infinity Castle"); no rating = year only, no "NaN" ("Blaze of Love 1994"); uncached poster = fallback icon + title | PASS | 04-deck, 44-back, 56-ten-flicks-fresh, 85-off-montage |
| 3 | Mid-gesture ADD: 15% no stamp, card follows, slight tilt, next poster in the gap; 30% ADD stamp full, tilt about bottom centre, next poster growing; release below 35% springs back; 40% commits, next card on top, top Toast "Adding to your collection is coming soon." | PASS | 12, 13, 14, 15, 18, 19, 20 |
| 3 | Mid-gesture SKIP: 30% SKIP stamp (coral), tilt left, next poster; spring-back; 40% commits | PASS | 16, 17, 22, 23, 24 |
| 4 | Velocity: `input swipe` 400 ms and 800 ms 6/6 commit; 150 ms 1/3 on the loaded emulator, 5/6 later; skip store ids unique on every read (no card shown twice) | PARTIAL, see Bug 2 | 28-30, ui-f1..f6.xml |
| 5 | Left swipe persists: force-stop + relaunch, none of the 70+ skipped cards returns. Right swipe/Add stores nothing: Renegade (Added) is back on top after force-stop and the skip store did not change (102 to 102) | PASS | ui-50.xml, 50-relaunch-deck-top |
| 6 | Buttons = swipes. Double-tap Add: one card leaves, store unchanged; double-tap Skip: one card, +1 skip | PASS for count; leaves the stuck pose, Bug 1 | 66, 69, 70, ui-b1/b2 |
| 7 | Undo: card back on top; a skip's Undo removes its id from the store (103 to 102); disabled at start; disabled after one Undo; Undo after Add works | PASS (stuck pose after a double-tap, Bug 1) | 51-53, 71, 74-76 |
| 8 | Tap card = details (one push), Back = same card (Alien) | PASS | ui-t0, 80-82 |
| 9 | Loading (shimmer, buttons off) and progress line "Finding movies you haven't seen..."; offline cold start: loading ~12 s, error "Couldn't load movies / Check your connection and try again. / Retry" by 18 s; offline mid-deck keeps swiping, uncached poster = fallback; Retry after network back loads | PASS | 03, 88-montage, 88-offline-cold-error, 89, 85-off-montage, 46, 47 |
| 9 | Caught up / Start over, Keep looking | NOT REACHED (skip list too long; Jest covers) | |
| 10 | Reduced motion (scales 0, relaunched): drag follows flat (no tilt), release below threshold is back at centre within 250 ms, commit shows next card + Toast with no fly-off | PASS (150 ms fade not frame-provable) | 93-98 |
| 10 | INFO: scales changed to 1 WITHOUT relaunch: the very next drag already tilts and shows the stamp, so the change is followed at once | info | 99 |
| 11 | uiautomator: "Skip {title}", "Add {title} to collection", "Undo", card "{title}, {year}", tabs; button targets 98x137 px = 56x78 dp | PASS; tabs see Bug 3 | ui-t1.xml, 38-ui.xml |
| 11 | Card custom actions, announcement + focus after swipe, "{title} is back", TalkBack | UNTESTABLE here (TalkBack not enabled on the shared emulator): Justin | |
| 12 | Regression: Home grid + paging (3 pages), details from Home (Disclosure Day), Profile tab opens ("My Profile"), signed-in state kept across relaunches. Pull-to-refresh NOT cleanly proven (my 150 ms swipes opened details instead) | PARTIAL | 100, 101, 106, 109 |
| 13 | logcat: no app FATAL/ANR | see Logcat | logcat-E.txt |

## Bugs

**Build 14 · Bug 1: the new top card stays in the "behind" pose (about 94% size, dimmed, next card's edge showing) after a fast double-tap on Skip/Add**
Steps: Quick Add with cards; `adb shell "input tap 213 1305; input tap 213 1305"` (two quick taps on Skip).
Expected: one card leaves; the new top card is full-bleed and bright (bounds [0,0][720,1420]).
Actual, 3 of 3 runs: count is right (one swipe) but the new top card rests at [22,85][698,1420], dimmed, with a card edge at the right, until the next committed swipe (a drag that springs back does not clear it; 78 shows the card behind dark with a stray "L"). Single taps (20+) and flicks one per adb call never did this. The same pose was seen after an Undo that followed a double-tap (71) and several times in the first flick runs (28-swipe-t3, 35-ctl-montage).
Evidence: 77-dbltap-r1/r2/r3.png (r3 clearest), ui-x1/x2/x3.xml, 78-stuck-drag-hold.png, 79-stuck-after-release.png, 71-undo-tapped.png, ui-c1.xml.
Why it matters: Manager failure modes 3 and 4 (no stuck state); Jest cannot press faster than a render.

**Build 14 · Bug 2: back-to-back flicks are dropped, and a flick can be read as a tap that opens details (PARTIAL; may be partly emulator frame rate; real finger = Justin)**
Steps (fresh JS context, healthier emulator, load 1 to 2): `for i in 1..10: input motionevent DOWN 600 700; MOVE 450; MOVE 250; UP 120` (about 0.9 s apart).
Expected: 10 skips, never details. Actual: 2 to 4 skips, then details of the top card opened and the remaining flicks landed on the details screen (skip store 70 to 72, 47 to 49, 95 to 96).
Controls: one flick per adb call about 2.3 s apart: 14 of 14 commit, no details (59-montage). A pair `flick; sleep 0.5; flick`: both commit. `flick; flick` with no gap: one commits, the second ignored (fine, disabled during exit). `input swipe` 150 ms: 1/3 and 5/6; 400 and 800 ms: 6/6.
Counter-evidence: on Home (untouched code) 25 fast 150 ms swipes also opened a details screen, and the emulator drew a median frame in 97 to 150 ms. Treat as unproven on a device; Ruby to judge the cause. The Plan B3/B7 line "a drag is never a tap" is the one at stake.
Evidence: 40-after-ten-flicks, 43-ten-flicks-healthy, 59-montage, 61-montage, 63-montage, 64-sep*, 102-home-pull-refresh (Home opened details), ui-g*/ui-d*/ui-e*/ui-f*.xml.

**Build 14 · Bug 3 (minor): tab touch targets are 45.7 dp high, under the 48 dp rule**
uiautomator bounds for Perch / Quick Add / Profile are [0,1436][240,1516] = 240x80 px = 137x45.7 dp (1.75 px/dp). The bar draws from y=1420, so the first 16 px (9 dp) is not touchable. DESIGN: the whole tab is the target, 8 + 26 + 2 + 14 = 50 dp. Evidence: ui-t1.xml, 38-ui.xml.

**Build 14 · Bug 4 (minor, design): inactive Profile tab icon is full-strength blue; the board shows inactive icons at 0.6 opacity**
Perch and Quick Add inactive icons are dimmed; the Profile glyph looks the same vivid blue active or not (02-home, 109-profile). Board: build-14-tab-bar.png panel 3. Ruby to judge whether it is the emoji font.

## Findings that are not Bugs (exact text)
- **Note A.** "Couldn't load more movies / Check your connection and try again. / Retry" appeared once on an ONLINE emulator (ping OK) after about 58 skips in the flick loops; Retry brought cards back at once (46, 47). Cause unknown; Ruby to check the next-page path.
- Dev banner "Refreshing..." (blue bar) several times (23-left-exit-mid, 52-skip-button-after). Metro log: `Android Bundled 266ms / 115ms / 129ms / 119ms node_modules\expo-router\entry.js (1 module)` = something in the repo changed under Metro (the Manager committed LESSONS meanwhile); I did not edit app code. It remounts JS state, so some early odd frames may be from it; all Bug 1/2 repros above were repeated on a fresh launch.
- Poster text shows through the 0.88 alpha dock (ghost "THE ODYSSEY", "DEEP WATER", "OPPENHEIMER" behind the buttons). Bella listed it as designed; the board draws it solid.
- A thin pale sliver at the bottom edge of the dragged card while tilted (12, 14, 15 at y about 1240).
- Skip/Add looked disabled 1.5 s after a right swipe once (20-right-committed); enabled by 4.5 s (21). Screenshot lag may explain.
- Loading fill is darker than the board's (03-quickadd vs build-14-deck-states panel 1): shimmer phase probably.
- App process 35 to 60 % CPU idle on a card (`top`), 19 % on Home.
- Pre-existing, not Build 14: "Debug" label beside the avatar on Home; details content ("#spoiler-free-lounge") draws under the 3-button navigation bar (26-details-state).
- Android Back on the Quick Add tab goes to the Perch tab, then exits (as Bella noted).

## Logcat (`*:E`, whole session)
No app FATAL or ANR. The only "Fatal signal 6 (SIGABRT)" lines are `droid.bluetooth` (system). From the app: `unknown:ReactNative: Got DOWN touch before receiving UP or CANCEL from last gesture` (my split adb touches), `unknown:ReactNative: Tried to remove non-existent frame callback`, `unknown:ReactNative: Unable to display loading message because react activity isn't active, message: Refreshing...`, `ReactNativeJNI: FabricUIManagerBinding::reportMount: Surface with id 1 is not found`, `ReactNativeJNI: [LeakChecker] Surface with id: 1 has leaked 1297 components out of 1344` (after a reload). Metro: `WARN [Reanimated] Reduced motion setting is enabled on this device...` (scales 0 launches). Reported without judging cause.

## UNTESTABLE, Justin to check
TalkBack: card actions (Skip / Add / Open details), announcement + focus after a swipe, "{title} is back"; real-finger feel of fast flicks (Bug 2); gesture-navigation edge swipe; font scale 1.3; the 150 ms fade in reduced motion.
Restored: animation scales 0/0/0, Metro stopped, port 8081 free (only a stray client SYN_SENT to 8081 from another PID; no listener).

---
# Bella: Bug round 1 (Queenie FAIL, Ruby FIX NEEDED)

| Item | Cause | Fix | Test (mutation-checked) |
|---|---|---|---|
| **Bug 1** stuck "behind" pose after a fast double tap | The pose is exactly `position = rank - (settle + dragP) = 1` (scale 0.94, dim 1, bounds [22,85][698,1420]). That happens only if `base` advanced by 2 for one card. Two presses landed before React re-rendered; the second ran `runExit` again because the JS thread read the `exiting` shared value stale (the UI thread had not applied `set(true)` yet), so `onCommit` fired twice: `setBase(+1)` twice, `onSwipe` twice (announcement twice, `remainingRef` decremented twice, so the next page could be requested early). The skip store looked right because a skip is idempotent. | JS-side guard: `startedRef` in the card (buttons and screen-reader actions go through `commitFromJs`), the worklet guard stays only in the pan callbacks (one gesture cannot double); and `handleCommit` ignores a key it already committed. | quickAddScreen "a burst of presses ...": three actions in one tick give one announcement, one skip, no add, new top scale 1 and dim 0, no early page request, next swipe clean. Removing both guards fails it; either guard alone still passes (they are layered). |
| **Bug 2** dropped flicks, drag read as tap | **Not reproduced.** On a fresh, healthy emulator (load ~2.8) 8 of 8 back-to-back flicks 0.9 s apart committed; per-gesture logs show every flick got `start` then `end` (translation -189, success true) 75 to 100 ms later, ranks 5..12 advancing by exactly one, no press event. Consistent with emulator frame time (QA measured 97 to 150 ms median) and not a code path. Code-path hardening anyway: a touch that moved past the pan slop (10 dp) between press-in and press is never a tap (a swipe inside a full-bleed Pressable is otherwise a press, since the card never leaves its bounds); a screen-reader click carries no position and still opens details. A flick during the previous exit is committed, not dropped (the new top is interactive at once; test "swiping the next card during the previous card's exit"). Real finger: Justin. | `onPressIn` start point + distance check in `onPress` | "a touch that travelled past the pan slop ..." (fails without the check) |
| R2 | Mount cap: during an exit the next card was left unmounted | Stack is always top + next; the leaving card is extra (3 at most); comments updated | "mounts the top and the next poster, plus the leaving card" |
| R3 | Deck pages survived sign-out, so user B inherited A's page offset | `useClearQuickAddOnSignOut` also `removeQueries({queryKey: DECK_KEY})` (key moved to `deckKey.ts` to avoid an import cycle) | quickAddDeck "sign-out and the deck's pages" (A loads 2 pages, sign-out, B requests page 1 only) |
| R4 | Wiring test only banned `.value` on named variables | Bans `\b\w+\.value\b` across the deck files | quickAddWiring |
| R5 | Reduce-motion `springBack` did not reset `dragP` (it only stayed 0 if the setting was on from the start; switching it on mid-drag left the next poster scaled) | Ease `dragP` to 0 too | quickAddScreen "reduce motion switched on mid-drag ..." |
| R6 | Stale title "12 degrees" | Renamed to the 6 degree maximum | n/a |
| R7 | `size.deckControlsZone` unused; `circle`/`glyphStyle` typed `object` | Token removed (the dock is measured; the test derives 16 + 78 + 8 from tokens); typed `StyleProp<ViewStyle>`/`StyleProp<TextStyle>` | band test updated |
| **Bug 3** tab 45.7 dp | The 8 dp top padding was on the row, outside the Pressable | Padding moved inside each tab, `minHeight: size.minTouch`; device bounds are now 94 px = 53.7 dp ([0,1422][240,1516]) | tabBar "at least 48 dp" |
| **Bug 4** Profile icon not dimmed | Some emoji glyphs (the blue bust) ignore the opacity of their own `Text`; the others looked dimmed | The 0.6 (new `opacity.inactive`) is applied on a wrapper `View` around the glyph for every inactive tab; on device the Profile icon is now dimmed | tabBar "dims every inactive icon" |

Queenie's observations, no cause found, no action: "Couldn't load more movies" once online after about 58 skips (the next-page
path now has no early or duplicate request after the Bug 1 fix; a transient proxy or timeout error is the likely cause, Retry
worked); `[LeakChecker] Surface with id: 1 has leaked 1297 components` is the dev client's debug leak checker after a Metro
reload, not app code.
Device screenshot after a double tap: `logs/evidence/build-14/device/bug1-after-double-tap-fixed.png` (top card full-bleed,
uiautomator top bounds [0,0][720,1420] after 7 rapid pairs of taps).

---
# QA: Bug round 1 re-test (Queenie), commit 4b123c4
Evidence: `logs/evidence/build-14/qa/r1q-*` (13 files). Dev build, Metro started by me and stopped (PID 19364 killed, no listener on 8081). Scales set to 1 for the full-motion items, 0 for reduced motion, restored to 0/0/0. Emulator was healthy (load 0.1 to 2) so frames were not the problem this time.

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | Bug 1, double tap Skip x6 then Add x6 (two separate `input tap`, about 300 ms apart): top card always [0,0][720,1420]; the second bounds [22,85][698,1420] is the normal next card. Triple taps in parallel (`tap & tap & tap`) x6 Skip + x6 Add: exactly 1 swipe each (skip store delta 1 every time), top always [0,0][720,1420]. Note: in the two-tap run 2 of 6 skip pairs removed 2 cards (store 128 to 136); the taps were far enough apart (separate processes) to be two real presses, the triple-parallel run is the true double-tap and gave 1 each | PASS | r1q-01, r1q-02 |
| 1b | Announcement not doubled | UNTESTABLE by uiautomator (Jest-proven: one announcement per burst); with TalkBack = Justin | |
| 2 | Bug 2, 10 flicks (DOWN/MOVE/MOVE/UP, about 0.9 s spacing) x3 runs: 10, 10, 10 commits from the skip store, details never opened | PASS (30/30; the first round's 2 to 4 of 10 did not repeat) | uiautomator after each run |
| 2 | Drag past the slop and released back over the card x3 + a left wiggle: details never opened, same card stays; plain tap opens details; Back returns to the same card | PASS | r1q-04 |
| 3 | R2: drag right 0.3 s and 0.6 s after a Skip button exit: card follows with ADD stamp, a poster is already behind it (Pirates / Black Panther / Kingdom of the Planet of the Apes), no pop-in. A drag begun with NO gap after the tap (0.0 to 0.15 s) did not follow; logcat shows my injection overlapping (`E InputDispatcher: Error while processing MotionEvent ... action=DOWN` and `E unknown:ReactNative: Received an ACTION_CANCEL touch event for which we have no corresponding ACTION_DOWN`), so I treat that as a test artefact, not a finding | PASS | r1q-05 |
| 4 | R3 sign-out | Jest only (no sign-out per rules) | |
| 5 | R5 reduce motion (scales 0, relaunched): drag follows flat with the next poster beside it, release below threshold: top back to [0,0][720,1420] and next at [22,85][698,1420] (its rest pose) | PASS for the rest pose; the mid-drag switch of the setting is Jest-only | r1q-08, r1q-09 |
| 6 | Bug 3: tabs [0,1422][240,1516] = 94 px = 53.7 dp high, 137 dp wide, all three | PASS (fixed) | r1q-06, r1q-07 |
| 7 | Bug 4: inactive Profile icon vs active, max blue channel of the glyph 141 inactive vs 210 active (dimmed about 0.6 over the bar). The same 141 was in the pre-fix screenshot (f3a4104 `rework-tab-bar-home.png`), so it was dimmed then too: my Bug 4 was a misjudgement by eye on the saturated blue bust against the dark bar, NOT a code bug. Withdrawn | PASS / Bug 4 withdrawn by QA | r1q-06 (Quick Add tab), r1q-07 (Home) |
| 8 | Regression: right drag commits + top Toast "Adding to your collection is coming soon." (store unchanged); left drag commits (+1 skip); Undo returns the card and removes the id (delta 0); Home grid opens details from a poster; Profile tab "Justin Masiga", @tsujintsujin, signed in | PASS | r1q-10, r1q-11, r1q-12, r1q-13 |
| 9 | logcat `*:E` (`r1q-logcat-E.txt`): no app FATAL, no ANR. App lines: `unknown:ReactNative: Received an ACTION_CANCEL touch event for which we have no corresponding ACTION_DOWN`, `system_server: addTouchingPointers: ... already in name='... com.tsujintsujin.perchable/...MainActivity'` and `InputDispatcher: Error while processing MotionEvent ... action=DOWN` (both from my overlapping injected touches), `unknown:ReactNative: Unable to display loading message because react activity isn't active, message: Loading from 127.0.0.1:8081…` and `message: Reloading...` (dev-client launches) | no app crash | |

VERDICT: PASS. Bugs 1, 2, 3 re-tested fine; Bug 4 withdrawn. Bug 2 could not be reproduced this round (30/30 commits), so the real-finger check stays with Justin.
UNTESTABLE, Justin: TalkBack announcement count after a double tap and the card actions; real-finger flicks; gesture-navigation edge swipe.

---
# Bella: Bug round 2 (Ruby A and B, test flake)

| Item | Cause | Fix | Test (mutation-checked) |
|---|---|---|---|
| Ruby A: a pan release plus a button or screen-reader action on the same card in the next frame | `runExit` lost its own guard in round 1 and the pan path never marked the card as started, so `commitFromJs` could run a second exit and re-seat `settle` in the opposite direction | `commitFromJs` also checks `exiting.get()` (set at once by the pan on this thread) and a new `isCommitted()` prop (the deck's `committedRef`, true once the pan's commit message arrived). Marking the card from the worklet side through a ref was tried and rejected by the compiler lint (ref access during render), hence the prop | quickAddScreen "a pan release followed at once by a screen-reader action": pan commits right, Skip arrives in the same tick; the card keeps flying right (fake timers) and is recorded once as an add. Without the `exiting` check it fails |
| Ruby B: stale press start | `pressStartRef` was cleared only in `onPress`; a press the pan claimed ends with `onPressOut` and no `onPress` | `onPressOut` clears it in a microtask (Pressability runs onPressOut before onPress, so a direct clear would erase the start the press needs) | "a press the pan claimed leaves no start point behind". Fails without the clear |
| **Flake**: movieDetails-test, 22 act() warnings under `--maxWorkers=2` | **Cause (demonstrated, not the natural trigger):** the cast row was a `FlatList`. A virtualized list answers a layout or content-size event with `setTimeout(..., 50)` that calls `setState` later. A probe test fires those events on the old row and gets two 50 ms timers and "An update ... was not wrapped in act(...)"; the details suite only flushes with a 0 ms timeout, so on a loaded machine the update lands outside act (in the same or the next test, hence a cascade). The new row has no timer. I could not make the natural trigger fire in 25 runs under heavy load, so the mechanism is shown with synthetic events. | `CastRow` is a plain horizontal `ScrollView` (the proxy sends at most `CAST_LIMIT` = 15 people; no virtualization needed), same testID and list role, items a `size.castGap` apart | `castRow-test`: no timer of 50 ms or more and no console.error after layout events (fails on the FlatList, both tests fail on revert) |
| My own timing flakes found while proving | quickAddScreen tests that read mid-animation values with real timers (rm commit fade, returning-card fade-in, buttons disabled while flying, a returning card appears at once, reduce-motion release) could finish the 150/200 ms animation before the first read on a loaded machine | Fake timers stepped by hand for those; a `ready()` wait before Undo; both conditions inside one waitFor | all pass 4 of 4 file runs, then under load below |

**Proof under load** (6 busy node processes alongside throughout):
- movieDetails-test alone x10: 10 of 10 pass (31 tests each), 0 `act(`, 0 console warn/error.
- Full suite x5 at `--maxWorkers=2`: 5 of 5 pass (50 suites, 650 tests), 0 `act(`, 0 console warn/error, 0 failed suites.
- Full suite x2 at `--maxWorkers=50%`: 2 of 2 pass (50 suites, 650 tests), same.
Device: not started this round (code and Jest only).
