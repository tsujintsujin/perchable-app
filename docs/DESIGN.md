# Perchable — DESIGN.md (Build 0)

Designer: Dianne. Direction: **A — Night Owl Arcade, glassmorphism** (picked
2026-09-24 from `docs/design-proposals.md`).
Canvas: https://claude.ai/artifact/M5TbevikF4q3dyGEh2S7XH (v2), board
"A — Night Owl Arcade (Glass, Build 0)". Sources:
`design-src/Proposal-A-Night-Owl-Arcade.dc.html`, `design-src/canvas.json`.

Approved by Justin: 2026-09-24

Build 10b / 11 boards (2026-09-30) are NOT on the canvas above: that URL could
not be opened from Dianne's session ("artifact not found"), so nothing was
published or overwritten. The boards exist as source files in `design-src/`
(listed in the Build 10b and Build 11 sections) and in `design-src/canvas.json`
(orders 8-13), ready to publish once the canvas is reachable.

Build 12 / 13 boards (2026-10-01, Module 4) are also source-only in `design-src/` (see the Build 12 and Build 13
sections; `design-src/canvas.json` orders 14-18).

Module 5 boards (2026-10-02: Quick Add swipe, Builds 14, 15, 16b) are source-only too: `design-src/build-14-*`,
`build-15-*`, `build-16b-*` (`canvas.json` orders 19-28; listed in the Build 14 section). Revised the same day: Quick Add is a tab and the deck is full-bleed.

This is the rulebook. Bella builds from it. Ruby enforces it against every
Build. No one-off values outside `src/ui/tokens.ts` — if a value isn't in
section 1 or 4, it doesn't go in a component.

---

## 1. Tokens

### 1.1 Brand palette (source: `docs/inspo/pallete.jpg`)

| Name | Hex |
|---|---|
| `purple.900` | `#2D0B59` |
| `purple.700` | `#4C1D95` |
| `gold.500` | `#B8860B` |
| `lavender.200` | `#D6C4E9` |
| `ink.950` | `#121016` |

### 1.2 Semantic tokens — dark (v1 default and only shipped theme)

Perchable is a "night owl" app by design (Vision Part 3, inspo); v1 ships
dark-only. Light tokens are defined below for completeness and a future
theme toggle, but **not built in v1** — flagged as an open question at the
bottom of this doc.

| Token | Value | Use |
|---|---|---|
| `bg.base` | `#121016` | screen background |
| `bg.elevatedFlat` | `#1E1A26` | opaque no-blur fallback surface (see §1.4) |
| `text.primary` | `#F2EEF8` | headings, primary body |
| `text.secondary` | `#B3A9C4` | meta, captions, timestamps (AA-safe on glass, see §1.5) |
| `text.onGold` | `#121016` | text/icons on a gold fill |
| `text.disabled` | `#5C5666` | disabled composer/UI-only placeholders |
| `accent.gold` | `#B8860B` | primary CTA fill, active nav, watched badge |
| `accent.goldPress` | `#D9A62A` | pressed/hover state of gold CTA |
| `danger` | `#FF8A8A` | delete account, skip-swipe icon |
| `border.hairline` | `rgba(214,196,233,0.18)` | 1px border on every glass surface |
| `border.hairlineStrong` | `rgba(214,196,233,0.30)` | modal/sheet top border, drag handle |

### 1.3 Semantic tokens — light (defined, not built in v1)

| Token | Value |
|---|---|
| `bg.base` | `#F6F3FB` |
| `bg.elevatedFlat` | `#FFFFFF` |
| `text.primary` | `#1A1620` |
| `text.secondary` | `#5C5666` |
| `accent.gold` | `#8A5B0F` (darkened from `#B8860B` for AA-on-light) |
| `border.hairline` | `rgba(45,11,89,0.15)` |

### 1.4 Glass tokens (glassmorphism surface system)

Every elevated surface is one of two treatments — **never a bare flat fill**:

| Glass role | fill | blur (iOS/web/Android 12+) | border | glow / shadow |
|---|---|---|---|---|
| `glass.card` (poster overlays, small cards) | `rgba(76,29,149,0.28–0.35)` (`purple.700` @ 28–35%) | `blur(20px)` | `1px solid border.hairline` | none |
| `glass.hero` (Perch Roulette, spoiler-lounge panel) | `rgba(76,29,149,0.35)` | `blur(24px)` | `1px solid border.hairline` | `0 0 40px rgba(184,134,11,0.25)` gold halo |
| `glass.nav` (TabBar, sticky headers) | `rgba(30,26,38,0.55)` (`bg.elevatedFlat` @ 55%) | `blur(30px)` | `1px solid border.hairline` top edge only | none |
| `glass.sheet` (ProfileSheet, any bottom sheet/modal) | `rgba(30,26,38,0.65)` | `blur(34px)` | `1px solid border.hairlineStrong` top edge | `0 -10px 40px rgba(0,0,0,0.5), 0 0 40px rgba(76,29,149,0.3)` |
| `glass.chip` (pill badges: back button, tier badge) | `rgba(18,16,22,0.5–0.6)` | `blur(10–14px)` | none | none |
| `glow.gold` | — | — | — | `0 0 40px rgba(184,134,11,0.25)` — primary CTA / hero only |
| `glow.purple` | — | — | — | `0 0 30px rgba(76,29,149,0.35)` — sheets, active swipe card |

Background halo blobs (large blurred radial shapes behind the whole screen —
see the canvas board) use `purple.700`, `gold.500`, `purple.900` at
`filter: blur(120–130px)`, `opacity: 0.25–0.35`, positioned behind content,
`pointer-events: none`. They're `bg.base`-level decoration, not a
per-component token — one `<GlassBackdrop>` wrapper per screen, not
per-card.

### 1.5 Glass on Android — implementation and fallback

`expo-blur`'s `BlurView` is **stable on Android as of Expo SDK 55** (we're on
SDK 57 — confirmed against Expo's docs 2026-09-24), but real blur needs:
- The content behind the blur wrapped in a `BlurTargetView`, with its `ref`
  passed to `BlurView`'s `blurTarget` prop (Android-only requirement — iOS
  doesn't need this).
- `blurMethod="dimezisBlurViewSdk31Plus"` — blurs on Android 12+ (API 31+,
  where the native `RenderNode` API makes it cheap) and **automatically
  falls back to `'none'` (flat semi-transparent fill, no blur) below API
  31**, avoiding the expensive legacy `RenderScript` path Expo warns against.
  Never use plain `'dimezisBlurView'` (blurs on all versions) — it's the
  slow path pre-API-31.

**Fallback rule — where BlurView is used vs. where it's skipped:**

| Surface | Real `BlurView`? | Why |
|---|---|---|
| `TabBar` (`glass.nav`) | Yes | static, one instance per screen, cheap |
| `ProfileSheet` (`glass.sheet`) | Yes | static, one instance, opens rarely |
| Home hero card (Perch Roulette), spoiler-lounge panel | **Android: no, flat `glass.hero` fill + hairline** (iOS may use `BlurView` later) | the backdrop behind them is flat circles, so a blur has nothing to blur; the Roulette card is also a `FlashList` header (decided Build 12, 2026-10-01) |
| `PosterCard` inside `FlashList` (Collection grid, Home carousels) | **No** — flat `bg.elevatedFlat`-based `rgba` fill, no blur | `expo-blur`'s own known-issue note: blur doesn't update correctly ahead of dynamic list content, and re-blurring N list rows on every scroll frame is the actual Android perf risk, not blur-on-static-chrome |
| `SwipeDeck` top card | **No** — no `BlurView` (full-bleed poster, revised Build 14). The title/meta band is a flat `overlay.cardInfo` fill (`rgba(18,16,22,0.88)`) with a 40 dp `LinearGradient` fade above it; the header, picker and controls sit on fixed scrims of the same family (0.72 top, 0.88 dock). The 0.55 fill of the Build 0 mock gave about 3.6:1 under small text on a white poster; 0.88 gives about 8:1 | swipe gesture moves this view every frame during a drag; blur recompute per frame is the exact case to avoid |

So: exactly two glass tiers ship — real `BlurView` (nav, sheets, one-off hero
cards) and flat translucent fill using the same `rgba` tokens with zero blur
(anything inside a `FlashList` or a gesture-driven re-render). Same visual
language, different cost. `bg.elevatedFlat` is the flat-fallback base color
these translucent fills sit on so contrast doesn't collapse if a device
somehow renders neither blur nor the intended opacity.

**Contrast:** `text.primary` (`#F2EEF8`) on the darkest glass fill
(`rgba(76,29,149,0.35)` over `#121016` ≈ effective `#2b1c46`) is ~11:1 — AA
pass. `text.secondary` (`#B3A9C4`) on the same ≈ 6.8:1 — AA pass for body
text. Never put `text.secondary` on `glass.chip`'s lighter fill without
checking — recompute if a fill's opacity changes.

### 1.6 Type scale

Each step ≥1.25× the one below (flat-scale lint from 2026-09-24 applies).

| Role | Size | Weight | Family |
|---|---|---|---|
| `caption` | 12 | 500 | Inter |
| `body` | 15 | 400/600 | Inter |
| `subhead` | 19 | 700 | Poppins |
| `title` | 24 | 800 | Poppins |
| `display` | 30 | 800 | Poppins |
| `hero` | 38 | 800 | Poppins |

Ratios: 15/12=1.25, 19/15=1.267, 24/19=1.263, 30/24=1.25, 38/30=1.267 — all
pass.

**Loading fonts on Expo:** `@expo-google-fonts/poppins` (weights 700/800) and
`@expo-google-fonts/inter` (weights 400/500/600) via `expo-font`'s
`useFonts()` hook in the root layout; hold `expo-splash-screen` until fonts
resolve (`SplashScreen.preventAutoHideAsync()` in `src/app/_layout.tsx`, hide
after `useFonts` returns `true`). No system-font fallback screen — block on
load, it's two small variable-adjacent weight sets.

### 1.7 Spacing, radius, elevation

| Spacing | 4 · 8 · 12 · 14 · 16 · 20 · 24 · 32 · 40 · 48 (`spacing[14]` added in Build 12, used for the Roulette gap) |
|---|---|
| Radius | `sm 12` (chips) · `md 16` (cards) · `lg 20` (hero cards) · `xl 28` (sheets) · `pill 999` |
| Elevation (Android `elevation` prop, opaque components only — glass surfaces use §1.4's glow/border instead of native elevation, since translucency + Android shadow looks muddy) | `card 4` · `raised 8` · `modal 12` |

### 1.8 Tokens added for Build 10b / 11 (add to `src/ui/tokens.ts`; nothing else is new)

| Token | Value | Use |
|---|---|---|
| `colors.surface.goldTint` | `rgba(184,134,11,0.16)` | selected reason row fill; gate banner fill |
| `colors.border.gold` | `#B8860B` (= `accent.gold`) | selected reason row border; inline-confirm row border; gate banner border |
| `size.radio` / `size.radioDot` | 22 / 10 | reason-row radio circle and its inner dot (2px ring) |
| `size.badge` / `size.badgeSm` | 56 / 28 | gold check badge on "sent" / "blocked" (56), on "accepted" footer (28) |
| `size.detailsInput` | 96 | min height of the "Something else" details box |
| `size.sheetMaxHeightRatio` | 0.9 | sheet content area never taller than 90% of the screen; beyond that the body scrolls, buttons stay pinned |
| `size.termsFooter` | 112 | reserved footer height under the terms text (grows by the error card when shown) |

Everything else (`surface.input`, `border.hairline*`, `border.danger`, `overlay.scrim`, `bg.elevatedFlat`, type roles, spacing, radius) is existing.

### 1.9 Tokens added for Build 12 / 13 (add to `src/ui/tokens.ts`; nothing else is new)

| Token | Value | Use |
|---|---|---|
| `size.posterAspect` | `2 / 3` (width over height) | every poster: grid tile, details poster |
| `size.gridColumns` / `size.gridGap` | 3 / 10 | Home grid (sides use `spacing[20]`) |
| `size.homeHeaderInset` | 72 | right inset of the Home header: avatar slot's right edge from the screen edge (20 + `headerTrailingInset` 44 + 8) |
| `size.avatarSlot` | 48 | touch wrapper around the 32 Home avatar |
| `size.footerRow` | 56 | end-of-list footer row |
| `size.footerBlock` | 88 | loading-more and next-page-error footer blocks; both share this height so Retry cannot jump under the tab bar when the state flips (Manager decision, Ruby PASS, Build 12b) |
| `size.spinner` / `size.spinnerLg` | 20 / 32 | `ui/Spinner` diameters |
| `size.spinnerStroke` / `size.spinnerStrokeLg` | 2 / 3 | `ui/Spinner` ring widths |
| `spacing[14]` | 14 | Roulette gap (added to the spacing scale) |
| `size.detailsBackdrop` | 220 | details backdrop height |
| `size.detailsPosterWidth` / `size.detailsPosterOverlap` | 120 / 64 | details poster width (height = width x 1.5) and how far it overlaps the backdrop |
| `size.detailsTitleOffset` | 76 | top padding of the title column beside the poster |
| `size.detailsBarShowAt` | 150 | scroll offset where the compact top bar appears |
| `size.chipHeight` | 36 (= `size.iconButton`) | rating and tier chips |
| `size.castItem` / `size.castGap` | 88 (= `avatarSize.lg`) / 12 | cast row |
| `size.popoverWidth` | 260 | TierBadge legend popover |
| `colors.overlay.fadeStart` | `rgba(18,16,22,0)` | start of the backdrop fade to `bg.base` |
| `colors.overlay.shimmerWash` | `rgba(214,196,233,0.10)` | wash over a loading poster tile |
| `lineHeight` | `caption/small 16` / `body 22` / `subhead 24` / `title 30` | explicit line heights for the type roles used here |
| `motion.imageFade` | 200 (ms) | poster fade-in; the compact bar's fade is 150 |
| `colors.overlay.topScrimStart` / `size.detailsScrimHeight` / `size.detailsToastOffset` / `size.detailsBottomPad` | `rgba(18,16,22,0.72)` / 72 / 24 / 80 | details top scrim, and Toast offset above the composer (Build 13 QA amendments) |

#### Tokens added for Build 14 / 15 / 16b (Quick Add swipe; add to `src/ui/tokens.ts`; nothing else is new)

| Token | Value | Use |
|---|---|---|
| `colors.overlay.cardInfo` | `rgba(18,16,22,0.88)` | deck card title/meta band and the controls dock; the fade above the band runs `overlay.fadeStart` to this over `size.deckInfoFade`. Top scrim: reuses `overlay.topScrimStart` |
| `colors.overlay.deckDim` | `rgba(18,16,22,0.45)` | dim layer on the next card behind the top card |
| `colors.overlay.addTint` / `colors.overlay.skipTint` | `rgba(184,134,11,0.30)` / `rgba(255,138,138,0.24)` | whole-card tint while dragging right (add) / left (skip) |
| `size.deckInfoFade` | 40 | height of the gradient above the card's info band |
| `size.deckButton` / `size.deckButtonSm` | 56 / 48 (= `size.minTouch`) | Skip and Add circles / Undo circle |
| (no token) dock height | measured at run time (102 at the default font scale) | the bottom dock: `deckControlsPad` 16 + measured controls height + 8; the info band sits right above it. `size.deckControlsZone` was removed in Build 14 Bug round 1 (unused; the screen measures the dock). |
| `size.deckTopScrimFade` | 24 | fade length under the top scrim (header, or header + picker) |
| `deck.stackScale` | `[1, 0.94]` | scale of the top and the next card (the next poster behind a full-bleed top card) |
| `deck.tiltMaxDeg` / `deck.tiltFullFraction` | 6 / 0.5 | tilt about the bottom centre = clamp(dx / (0.5 x screen width), -1, 1) x 6 degrees |
| `deck.stampTop` | 224 | top of the ADD / SKIP stamp (below the picker and a 2-line Toast) |
| `size.deckControlsHeight` | 78 | one control column at font scale 1: circle 56, 6 gap, label 16 (`lineHeight.caption`); the layout measures the real height |
| `size.deckControlsGap` / `size.deckControlsPad` | 28 (= `spacing[28]`) / 16 (= `spacing[16]`) | gap between control columns / space under them (above the bottom inset) |
| `size.stampBorder` | 3 | SKIP / ADD stamp border |
| `iconSize.deckFallback` | 56 | the 🎬 on a deck card with no poster |
| `deck.stampStart` / `deck.stampFull` | 0.15 / 0.30 | stamp and tint opacity 0 at 15% of the screen width dragged, 1 at 30% (linear) |
| `deck.stampTiltDeg` | 14 | stamp rotation on the card: ADD -14, SKIP +14 |
| `deck.followY` / `deck.followYMax` | 0.3 / 40 | the card follows vertical finger movement at 30%, at most 40 dp |
| `deck.exitMargin` | 24 | the card flies to x = +/-(screen width + 24) from its resting position (it is full width) |
| `deck.returnScale` | 0.92 | a returning card scales from 0.92 to 1 |
| `motion.deckExit` / `motion.deckFade` | 200 / 150 (ms) | exit and return duration / reduced-motion fade and ease-back |
| `motion.deckSpring` | `{ damping: 20, stiffness: 260, mass: 1 }` | spring back (one overshoot of about 8%, rests in about 400 ms) |

Gesture behaviour numbers (not visual) live as named constants at the top of `quick-add/decideSwipe.ts`, the one file the
Manager tunes: `COMMIT_FRACTION` 0.35, `FLICK_VELOCITY` 800 (dp/s), `FLICK_MIN_DISTANCE` 40 (dp), `PAN_SLOP` 10 (dp),
`PAN_FAIL_Y` 20 (dp).

Existing and reused: `bg.elevatedFlat`, `surface.input`, `surface.goldTint`, `border.*`, `glass.hero`,
`colors.brand.purple900`, `overlay.spinnerTrack`, `shimmerPulse`, `iconSize.lg`, `avatarSize`, `size.minTouch`,
`iconButtonHitSlop`, type roles, spacing, radius, `elevation.card`.

---

## 2. Shared components

All live in `src/ui/` (see §4), each its own folder: `Component.tsx`,
`Component.styles.ts` (or inline `StyleSheet.create` in the same file for
small ones), `index.ts`.

| Component | Variants / props | States |
|---|---|---|
| `GlassBackdrop` | `blobs?: ('purple'\|'gold')[]` (decorative halo blur shapes) | static |
| `GlassCard` | `tier: 'card'\|'hero'\|'chip'`, `blur: boolean` (real BlurView vs. flat fallback — caller decides per §1.5 rule), `children` | default, pressed (scale 0.98) |
| `PosterCard` | `id` (movie id; the FlashList `recyclingKey`), `posterUrl: string \| null`, `title`, `year?`, `retryToken?` (a failed image retries once per pull-to-refresh) (Builds 12a/12b); no `onPress` in 12a/12b, Build 13 adds it; later `watched?`, `tier?`, `caption?` | loading (shimmer), loaded, error / no poster (🎬 icon + title). Pressed (scale 0.98) only once `onPress` exists (Build 13). Spec: Build 12 section |
| `Button` | `variant: 'primary-gold'\|'secondary-glass'\|'ghost'\|'destructive'`, `disabled?`, `loading?` | default, pressed, disabled, loading (spinner replaces label) |
| `TierBadge` | `tier?: 'S'\|'A'\|'B'\|'C'` (absent = the "🏆 Tier" chip on details), `size: 'sm'\|'md'`, `onPress?` | **UI shell, not functional in v1**: the details chip toggles a static legend popover (§5, Build 13); no rating is settable or stored |
| `TabBar` | **Revised Build 14.** Shows one tab per route that exists: **today Perch · Quick Add · Profile** (3 tabs; the old text "fixed 5 items" is retired). Search, Chat and Leaderboards add their own entries as their Builds land, so the full planned set would be Perch, Quick Add, Search, Chat, Leaderboards, Profile (6 tabs of about 65 dp at 390): **open question for Justin when the fourth tab arrives** (drop to 5 by moving Quick Add or Leaderboards elsewhere, or keep 6). Quick Add: glyph 🃏, label "Quick Add", middle position. `TAB_META` is the table of glyph and label per route | per-tab active (icon opacity 1, label `accent.gold`) / inactive (icon opacity 0.6, label `text.secondary`); **rendered on every tab screen** (`(tabs)/_layout.tsx`, not per-screen); pressing the active tab does nothing |
| `ProfileSheet` | `userId`, `isSelf: boolean` | loading, loaded, error, not-found |
| `SwipeDeckCard` | **Revised Build 14: presentational only, no module imports; full-bleed.** `posterUrl: string \| null`, `title`, `year?`, `rating?` (a number, drawn when above 0), `bottomInset` (the dock height; the info band sits above it), `dragX: SharedValue<number>` (the stamp and tint opacity derive from it), `dim: SharedValue<number>` (0 to 1, the `deckDim` layer for the next card). It fills its parent (the content area). The gesture, transforms (translate, tilt about the bottom centre, scale), the two-card stack and the exit live in `quick-add/components/SwipeDeck`. Spec: Build 14 | idle, dragging (stamp and tint from `dragX`), behind (dim), poster loading, no-poster fallback |
| `BackChip` | `onPress`, `label?` (default "Back"). **Moved to `src/ui/BackChip/` in Build 14** (it was `movies/components/BackChip`); `goBackOrHome` moves to `src/lib/navigation.ts`; details imports both. Look unchanged (Build 13). The Quick Add deck does **not** use it (tab screen, no back) | default, pressed (opacity 0.85) |
| `Avatar` | `uri?`, `size: 'sm'\|'md'\|'lg'`, `ringGradient?: boolean` (purple→gold ring for own profile) | loaded, fallback-initials |
| `EmptyState` | `icon`, `title`, `body`, `action?: {label, onPress}` | one component, used by every data screen's empty case; the action button is at least 48 high (`size.minTouch`, fixed in Build 12) |
| `Toast` | `message`, `variant: 'info'\|'error'\|'coming-soon'` | shown, dismissing. **Build 14 additions (all screens):** `marginHorizontal: spacing[20]` so a long message wraps inside the screen instead of running edge to edge, and `maxFontSizeMultiplier` 1.3 on its text; **`position?: 'bottom' \| 'top'`** (default 'bottom'; 'top' pins it `offset` below the top of the screen: only the Quick Add deck uses it). **Offset rule:** on tab screens it sits 24 dp above the tab bar (the system bottom inset is not added again inside the tabs). A Toast rendered inside a `Modal` must be given the bottom inset. |
| `Spinner` | `size?: 'default'\|'lg'` (`size.spinner` 20 / `size.spinnerLg` 32; ring `size.spinnerStroke` 2 / `size.spinnerStrokeLg` 3) | indeterminate; track `overlay.spinnerTrack`, arc `accent.gold`. One shared component, used by `Button` (loading), Edit profile and the paging footer. `GoogleSignInButton` keeps its own spinner, per Google's branding rules (Build 5). |

**Rule:** every data screen (Home feed, Search results, Collection,
Leaderboards, Chat list, Comments) implements all four of **loading / empty
/ error / filled** using `PosterCard`'s shimmer, `EmptyState`, an inline
error card + retry `Button`, and real content — no screen ships with only
the filled state.

---

## 3. Flow map — Expo Router route tree

```
src/app/
  _layout.tsx                 root Stack — auth gate, font load, Sentry init
  (auth)/
    sign-in.tsx                Google sign-in screen
  (tabs)/
    _layout.tsx                Tabs navigator — renders <TabBar> (5 items)
    index.tsx                  Home ("Perch") — Build 12: header, Roulette shell (UI-only), Popular poster grid (3 columns,
                                infinite scroll, pull-to-refresh). have-you-watched and friend activity wait for Builds 19 / 23
    quick-add.tsx              Quick Add swipe deck (Builds 14-16) — **a tab** (Perch · Quick Add · Profile), full-bleed, tab bar visible, no back chip,
                                header "Quick Add" floats over the poster. Deep link perchable://quick-add selects the tab. Opening a movie pushes `movie/[id]`;
                                Back returns to the same deck and top card. Tapping the active tab does nothing
    search.tsx                 Search / Add movie (module: movies)
    chat/
      index.tsx                DM conversation list
      [conversationId].tsx     one DM thread
    leaderboards.tsx           Rankings (module: rankings)
    profile/
      index.tsx                own profile + My Collection grid
      settings.tsx             Account + About (TMDB attribution) — Screen 6
      edit.tsx                 Edit profile (Build 7)
      blocked-users.tsx        Blocked users list (Build 10b) — pushed from Settings
  movie/
    [id].tsx                   Movie details (Build 13) — full-screen push, NO tab bar, own back chip; pushed from Home/Search/Collection/deck.
                                Deep link perchable://movie/<id>; id must be a positive integer, else the not-found state
  terms.tsx                    Terms & community rules (Build 11) — root-level push, outside the tabs so the
                                gate can open it from any screen; under the session guard in root _layout.
                                Param `gate=1` = gate mode; absent = view mode (from Settings)
  user/
    [id].tsx                   other user's profile popup — `presentation: 'formSheet'`
                                (RESEARCH.md §4: leaner than @gorhom/bottom-sheet on
                                Android since it's a fixed-height popover, not a
                                peek/snap-point sheet)
```

Comments live nested inside `movie/[id].tsx` (a panel, not a route) per
RESEARCH.md §4 — no separate comments screen. Perch Roulette and
spoiler-free-lounge have no route of their own; they're UI-only panels on
Home / movie details (§5).

Navigation: tab bar is the top-level chrome (`(tabs)/_layout.tsx`); `movie/`,
and `user/` are non-tab stack routes reachable from any tab and
push over it. **They are root-level siblings of `(tabs)`, so the `TabBar` is
covered, not visible, on `movie/[id]`, `terms`, `user/[id]`** (corrected
2026-10-01, Build 13: the old line said it stayed visible under `movie/`, which a
root-level route cannot do). `movie/[id]` draws its own back chip and the Android back
returns to where it was opened; Home stays mounted underneath, so its loaded pages
and scroll position survive.

---

## 4. Code structure

`tsconfig.json` maps `@/*` → `./src/*` (and `@/assets/*` → `./assets/*`), so
every folder below lives under `src/` — nothing reusable sits at repo root.

```
src/
  modules/                    reusable — PLAN.md §3, self-contained, no cross-module imports
    auth/         api/ components/ hooks/ types.ts index.ts   (Google sign-in, session, account deletion)
    profile/      api/ components/ hooks/ types.ts index.ts   (edit photo/usertag, ProfileSheet content)
    social/       api/ components/ hooks/ types.ts index.ts   (follow, DM, comments — NOT block/report)
    moderation/   api/ components/ hooks/ types.ts index.ts   (OWNS all report, block and terms code: ReportSheet,
                                                               BlockUserSheet, BlockedUsersList, TermsScreen content,
                                                               useBlockUser, useBlockedUsers, useTermsGate,
                                                               OBJECTIONABLE_CATEGORIES; social/ never implements
                                                               these, it only imports them through moderation/index.ts
                                                               when a later Build needs a caller. Module README.md too)

    movies/       api/ components/ hooks/ tmdbImage.ts types.ts index.ts   (Perchable-specific: TMDB browse/search/details.
                                                               OWNS everything TMDB: `api/` (getPopularMovies, getMovieDetails, the
                                                               only Supabase/proxy touchpoint), `hooks/` (usePopularMovies infinite
                                                               query, useMovieDetails), `components/` (PosterGrid + its footer,
                                                               MovieDetailsView, CastRow, RouletteCard, LoungePanel), `tmdbImage.ts`
                                                               (base URL + the w185 / w342 / w500 / w780 size constants). Imports
                                                               only `@/ui` and `@/lib`; routes use it through `index.ts`)
    quick-add/    components/ hooks/ skipMemory.ts decideSwipe.ts types.ts index.ts   (Perchable-specific; revised Build 14; no `api/`:
                                                               it has no Supabase touchpoint. `components/`: SwipeDeck (gesture, stack, exit),
                                                               SequencePicker (Build 15), the deck state views; the screen `QuickAddScreen` is rendered by the tab route;
                                                               `hooks/`: useQuickAddDeck(sequence), useReduceMotion (the one reduce-motion
                                                               source: RN AccessibilityInfo + its change listener); `skipMemory.ts`: AsyncStorage
                                                               store (skips, cursor, remembered order) + the sign-out clean-up hook;
                                                               `decideSwipe.ts`: the pure decision + the gesture constants. Imports `movies` and
                                                               `collection` only through their `index.ts`)
    collection/   api/ hooks/ types.ts index.ts README.md   (Perchable-specific; Build 16: addToCollection, removeFromCollection,
                                                               getCollectionMovieIds, useCollectionIds and the add/remove hooks. Imports nothing
                                                               from `quick-add` or `movies`. Captions and the grid come with Builds 19-20)
    rankings/     api/ components/ hooks/ types.ts index.ts   (Perchable-specific: leaderboard views)

  ui/                          shared design system — no business logic, no Supabase imports
    tokens.ts                  §1 as code: colors, glass, type scale, spacing, radius
    GlassBackdrop/ GlassCard/ PosterCard/ Button/ TierBadge/ TabBar/ ProfileSheet/   (PosterCard: Build 12a; TierBadge: Build 13)
    SwipeDeckCard/ Avatar/ EmptyState/ Toast/ BackChip/   (each: Component.tsx, index.ts; BackChip: Build 14)

  lib/                         cross-cutting singletons, not modules
    supabase.ts                Supabase client
    queryClient.ts              TanStack Query client (created in Build 12a; `REQUEST_TIMEOUT_MS` 8000 lives next to it)
    sentry.ts                   Sentry init

  app/                         routes ONLY — thin screens: compose ui/ + modules/, no fetching/business logic inline
                                (this is the §3 route tree — Expo Router's root)
```

Import as `@/modules/auth`, `@/ui/GlassCard`, `@/lib/supabase` — never a deep
relative path (`../../../modules/...`) out of `src/app/`.

**Cross-module imports (clarified Build 14):** the recyclable modules (`auth`, `profile`, `social`, `moderation`) import no other
module. A Perchable-specific module may import another module's `index.ts` (`quick-add` uses `movies` and `collection`), never
its inner files; `collection` imports no other module. Routes compose; they do not reach into a module's folders.

**Module contract:** a module's `api/` is its only Supabase touchpoint; other
modules and routes consume it through `index.ts`'s exported hooks/components
— never import another module's `api/` or internal files directly. This is
what lets `auth/`, `profile/`, `social/`, `moderation/` get copied wholesale
into the next app (Vision Part 0) while `movies/`, `quick-add/`,
`collection/`, `rankings/` stay behind.

---

## 5. UI-only features (v1) — what happens on tap

Vision/PLAN don't build these yet; they ship as visible, disabled UI so the
look is real from Build 1 on, per Justin's direction. Each carries a small
`UI shell · v1` chip in the mock (see canvas) — **that chip is a design
note for reviewers, not something that ships in the app**; the real app
signals "not wired" only via the disabled/toast behavior below.

| Feature | Where | Tap behavior in v1 |
|---|---|---|
| Perch Roulette | Home hero card | `Toast` (`variant: coming-soon`): "Smart picks are coming soon." The button is a real `Button primary-gold` at **full strength** (revised Build 12: a dimmed look reads as broken and TalkBack would say "disabled" for a control that answers). Not `accessibilityState.disabled`. Never a silent tap. |
| Tier badge (S/A/B/C) | Movie details, Collection `PosterCard` | Details (Build 13): the "🏆 Tier" chip toggles a static legend popover ("Tier ratings", S A B C badges, "coming soon"; exact layout and copy in the Build 13 section). No rating is settable or stored in v1. |
| `#spoiler-free-lounge` panel | Movie details | Panel renders with the mock's sample content (static, not from any comments table). The composer (`"Hoot your thoughts…"`) renders in `text.disabled`-styled, non-focusable state, and **tapping it shows a Toast** "Comments are coming soon."; a "Preview only. Comments are coming soon." line sits above it (Build 13); **becomes real once Module 9 (Comments) ships** — this exact panel's composer is what Bella wires then, not a new component. |

---

## 6. TMDB attribution — Settings/About screen spec

`(tabs)/profile/settings.tsx`, "About" section — required by
[TMDB's API Terms of Use](https://www.themoviedb.org/api-terms-of-use).

**Exact required text — copy verbatim, no paraphrase:**

> This application uses TMDB and the TMDB APIs but is not endorsed,
> certified, or otherwise approved by TMDB.

Layout inside the About `glass.card`:
- Perchable's own owl wordmark/logo is the section's dominant mark (already
  present in the app chrome — no extra rendering needed here beyond normal
  screen header).
- TMDB's logo renders **smaller and less visually weighted** than Perchable's
  branding on this screen: `size: 'sm'` treatment (the existing 28×18 chip
  size in the mock is correct — don't enlarge it to match Perchable's own
  logo size), `text.secondary` color for the "The Movie Database" label, no
  glow/emphasis token applied to this card.
- The required sentence above renders in `caption` size, `text.secondary`,
  directly under the TMDB logo — this is the only legally-required copy;
  nothing else on this screen substitutes for it.

---

## 7. Rules

- No one-off colors or blur/opacity values — everything comes from
  `src/ui/tokens.ts` (§1). A hardcoded hex or `rgba(...)` in a component file is
  a review finding.
- Every data screen ships all four states: loading / empty / error / filled
  (§2). A screen with only the filled state doesn't pass Phase 4 review.
- Glass tier choice is not a per-component judgment call — follow §1.5's
  table. Any surface inside a `FlashList` or a gesture-driven re-render uses
  the flat fallback fill, never `BlurView`, regardless of how it looks in
  the mock.
- UI-only features (§5) must be visibly present and must give feedback on
  tap (toast/popover) — never a silent no-op, never a fake success state.
- TMDB attribution (exact required text + logo, §6) lives on
  `(tabs)/profile/settings.tsx` and must render on every build that includes
  the TMDB proxy (Build 3 onward) — Queenie checks the string is verbatim
  and the logo isn't more prominent than Perchable's own branding, from
  Build 3 on, not just once at the end.
- Type scale steps stay ≥1.25× apart (§1.6) — no inserting a size between
  two existing steps without re-checking every ratio in the table.
- Routes (`src/app/**`) contain no Supabase calls and no business logic —
  if a screen file is doing more than composing `src/ui/` + a module's exported
  hook, that logic belongs in the module.
- **Dev-client gear zone — nothing important in the top-right 64×64px corner
  of any screen** (added Build 6 mockup round). Expo dev-client builds render
  their own dev-menu gear/status affordance there; anything Perchable puts in
  that exact corner gets covered or fought over on dev builds. This applies
  to every screen, not just Builds 6–9 — mocks from here on show the reserved
  zone as a dashed outline so Bella and Queenie can check against it. Nav
  icons, chips, or buttons that would naturally sit top-right (settings
  entry, signed-in indicator, etc.) get inset left of that zone or moved to a
  list-row/body position instead — see Build 6 and the Home fix below.
  - **Home screen fix:** Build 5's mock put a "Signed in ✓" text chip
    top-right on the signed-in landing, which sits inside this reserved zone
    (that mock predates this rule). Don't build it as drawn. Replace it with
    the small circular `Avatar` (same one `ui/Avatar` renders elsewhere, ~28–
    32px, `fallback-initials` or Google photo) inset left of the corner zone,
    tappable → Profile tab. This both signals "signed in" and gives a useful
    shortcut, in less space than a text chip, without touching the reserved
    corner. The existing "🏆 342 Watched" trophy chip stays where it is, just
    shifted to make room — exact positions get finalized when Home itself is
    mocked (it's UI-only content, out of scope through Build 9). No change to
    the Build 5 canvas board itself; this is a forward note for whoever mocks
    Home. **Done in Build 12** (below): avatar slot right edge 72 dp from the
    screen edge; the trophy chip waits for the collection (Build 19).

---

## Build 5 — Sign-in screen (Module 2: Auth)

Board: canvas https://claude.ai/artifact/M5TbevikF4q3dyGEh2S7XH, board
"Build 5 — Sign-in (Google)" (v5). Source: `design-src/build-05-sign-in.dc.html`.
4 states: idle, signing-in, error, signed-in landing.

**Route:** `src/app/(auth)/sign-in.tsx` (per §3's route tree — the group is
`(auth)`, not a bare `src/app/sign-in.tsx`). Root `_layout.tsx`'s auth gate
redirects here when there's no session, and away from here into `(tabs)`
once signed in.

**Component:** `src/modules/auth/components/GoogleSignInButton/` (`.tsx` +
`index.ts`) — the only new shared-looking component this Build adds, and it
stays inside `modules/auth/` (not `src/ui/`) because its exact look is fixed
by Google's brand rules, not by our token system; nothing else should copy
its styling. Screen composes it plus `ui/GlassBackdrop` and an inline error
card styled like `GlassCard` (§ Error state below).

### Layout (idle / signing-in / error — same shell)
- `GlassBackdrop` (existing component, `blobs: ['purple','gold']`, dimmer than
  Home's — the mock uses two small 260px/220px blurred circles at ~0.2–0.35
  opacity, not full-screen halos) on `bg.base` (`#121016`).
- Centered column, horizontal padding 28px.
- Wordmark: "🦉 perchable" — `hero` (38/800/Poppins), `accent.gold` (`#B8860B`).
- Tagline directly under, 12px gap: "Track what you watch.\nRate it your
  way." — `body` size but `text.secondary` color, centered, `line-height:1.4`.
- 56px gap, then the Google button (spec below).
- 16px gap under the button: a small status caption, `caption` size,
  `text.disabled` (`#5C5666`), centered — dev/QA-only text in the mock
  labelling the state; **not required in the shipped screen**, drop it in
  the real build.

### Google Sign-In button — exact spec (Google's official branding rules; this is a deliberate exception to §7's "no one-off colors" rule — do not pull these values from `tokens.ts`)
- Width: fill container. Height: `48px`. Radius: `12px` (`radius.sm` —
  Google permits any radius from square to full pill; we use our own `sm`
  token so it still reads as "this app" without touching Google's mandated
  colors/logo/text).
- Fill: `#131314` (Google's "dark" neutral theme background — do not
  substitute `ink.950`/`bg.base` even though they're close; use this exact
  hex, it's Google's asset color).
- Stroke: `#8E918F`, `1px`, **inside** the button's border-box (per Google's
  dark-theme spec — the dark button is filled *and* stroked, unlike a plain
  fill-only button).
- Logo: Google's official multicolor "G" mark, 18×18px, on a transparent/white
  ground, left-aligned with 10px gap to the label. Never recolor, outline, or
  simplify the logo.
- Label: "Sign in with Google" — **exact string**, no paraphrase ("Sign in",
  "Sign in via Google", etc. are not among Google's permitted labels; "Sign
  up with Google" and "Continue with Google" are also permitted strings for
  other flows, but this screen always uses "Sign in with Google").
  Color `#E3E3E3` (not pure white). **Google Sans Medium, 14px/20px
  line-height** — not Roboto, not Inter/Poppins; this is the one place in the
  app that doesn't use the type scale (§1.6), because Google's button-text
  spec requires Google Sans. Bella loads it as an `expo-font` asset from
  Google Fonts (`@expo-google-fonts/google-sans` if published, otherwise the
  static Google Sans `.ttf`/`.otf` from Google Fonts bundled under
  `assets/fonts/` and loaded via `useFonts()` alongside Poppins/Inter in
  §1.6). **Fallback:** if Google Sans can't be bundled for Android for some
  reason, fall back to the system default sans (Roboto on Android) rather
  than substituting Inter/Poppins — never brand this button with the app's
  own type family.
- States: idle (as above) · pressed (Google allows a subtle overlay —
  `rgba(255,255,255,.08)` on top of the fill) · loading (see below) ·
  disabled (`opacity: .5`, no interaction).
- No shadow, gradient, or glow on this button beyond the fill + stroke
  specified above — Google's guidelines prohibit added chrome (the stroke
  above is the one exception, it's part of Google's own dark-theme spec, not
  added chrome).

### Signing-in state
- Button: logo replaced by an 18px spinner (`border: 2px solid
  rgba(255,255,255,.3)`, top border `#fff`, animate `rotate`), label replaced
  by "Signing in…", whole button `opacity:.7`, disabled to taps.
- Rest of the screen: unchanged, `opacity:.85` (mirrors `ui/Button`'s
  `loading` convention — dim, don't hide).
- The Google account picker itself is native OS/Play-services UI — nothing
  to mock, it renders on top of this screen.

### Error state
- Inline error card above the button, 16px gap below tagline: `GlassCard`
  tier `card` (`rgba(76,29,149,.28)`, `blur(20px)`) but with
  `border: 1px solid rgba(255,138,138,.35)` (danger-tinted border — the one
  allowed variation on `glass.card`'s border color, since this is an error).
  Copy: **"⚠ Couldn't sign in. Check your connection and try again."**
  `text: danger (#FF8A8A)`, `body` weight 600, `line-height:1.4`.
  This copy string covers both cancel and network failure — don't branch UI
  text per error type in v1; log the real error to Sentry instead.
  16px gap, then the Google button again, still reading **"Sign in with
  Google"** — same idle state, same label, no "Try again" text on the button
  itself. Google's permitted button labels are "Sign in with Google",
  "Sign up with Google", "Continue with Google"; "Try again" isn't one of
  them, so the retry affordance lives entirely in the error card above ("...
  try again"), and re-tapping the unchanged Google button is the retry
  action. No new component/variant needed — it's the same
  `GoogleSignInButton` idle render.
- No `Toast` here — the error is persistent inline, not a transient toast,
  because sign-in failure needs a visible retry, not a message that
  disappears.

### Signed-in landing (minimal, Build 5 scope only — full Home is later Builds)
- Reuses the existing Home screen shell/header from the Build-0 mock
  (`(tabs)/index.tsx`) — don't build a separate screen for this.
- **Superseded:** the board still shows a "Signed in ✓" text chip top-right;
  don't build it as drawn — it sits inside the dev-client gear zone added
  after this board shipped. Follow §7's "Dev-client gear zone" rule instead:
  a small circular `Avatar` inset left of the reserved corner, tappable to
  Profile, replaces this chip.
- Everything else on this screen is placeholder/empty — Home's real content
  (roulette, have-you-watched, friend activity) is out of scope for Build 5;
  Bella should not build those sections now just because they're in the
  Build-0 mock.

### Copy strings (verbatim, for Bella and Queenie)
| Where | Text |
|---|---|
| Wordmark | 🦉 perchable |
| Tagline | Track what you watch.\nRate it your way. |
| Google button (idle/error) | Sign in with Google |
| Google button (loading) | Signing in… |
| Error message | ⚠ Couldn't sign in. Check your connection and try again. |
| Signed-in chip | Signed in ✓ |

### States checklist (§2's "every data screen ships all four states" rule)
Sign-in isn't a data-fetch screen but the same discipline applies: idle
(=filled equivalent), signing-in (=loading), error, done (=the signed-in
landing, standing in for "success" since there's no empty case here).

---

## Build 6 — My Profile screen (Module: Auth/Profile)

Board: canvas https://claude.ai/artifact/M5TbevikF4q3dyGEh2S7XH, board
"Build 6 — My Profile" (v6). Source: `design-src/build-06-my-profile.dc.html`.
3 states: loading, loaded, load-error.

**2026-09-30 revision (Justin, phone test): this text supersedes board v6 by
removing both entry rows (Edit profile, Settings). The board is updated the
next time it is touched.**

**Route:** `(tabs)/profile/index.tsx` (already in §3's route tree — no route
change this Build).

**Decision — default avatar:** use the Google account's photo when the
Google Sign-In SDK returns one; when it doesn't (declined/absent), fall back
to `ui/Avatar`'s existing `fallback-initials` state (first letter of the
Google display name, on the `linear-gradient(135deg, purple.700, gold.500)`
background already defined for `ringGradient`). **Not** a separate Perchable
placeholder image/asset. Reasoning: `Avatar` already has this exact
loaded/fallback-initials contract (§2) — reusing it means zero new asset
pipeline, zero new component state, and it reads better than a blank/generic
icon while never fabricating a photo the user didn't provide.

### Layout (loaded state)
- Header row: "My Profile" (`subhead`, `text.secondary`) left; **Settings
  entry** as a 36×36 `GlassCard`-chip icon button (`rgba(76,29,149,.3)`,
  `border.hairline`, `radius: sm`) inset with `margin-right: 44px` so it sits
  left of the reserved 64×64 dev-client gear corner (§7) — never a bare
  top-right icon. This chip is the **only** Settings entry on this screen;
  it pushes `(tabs)/profile/settings.tsx`.
- Centered avatar block: `Avatar size: lg` (88px in the mock — treat as the
  large end of `Avatar`'s `lg` size), `title` weight name below (Google
  display name, verbatim, no truncation logic beyond normal text overflow),
  then the usertag row.
- **Empty usertag state:** a `pill`-radius chip (`rgba(76,29,149,.28)`,
  `border.hairline`) reading "No usertag yet — **add a usertag**" — the bold
  part is a tap target that pushes `(tabs)/profile/edit.tsx` (Build 7) with
  the usertag field focused. Once a usertag exists, this chip is replaced by
  `@usertag` in the same visual slot (no separate component needed, same
  chip re-purposed). **The `@usertag` chip stays tappable** and pushes
  `(tabs)/profile/edit.tsx` (usertag field focused), exactly like the empty
  chip — one chip, one behavior in both states. Why: with the "Edit profile"
  row gone, this is the only on-screen path to editing besides Settings, it
  adds no new element, and tapping your own handle to edit it is the common
  pattern. Give it the same 44px-min tap height as the empty chip.
- **No entry rows.** The former "✏️ Edit profile" and "⚙ Settings" rows are
  removed (2026-09-30). Edit profile is reached from (a) the usertag chip
  above (either state) and (b) Settings → "Edit profile photo / usertag"
  (Build 9 section), which pushes `(tabs)/profile/edit.tsx`.
- **Vertical order and spacing (top to bottom):** header row → avatar block
  (`lg` avatar, name below, unchanged gaps) → usertag chip → **24px**
  (spacing scale 24, §1.7) → "`N` movies watched" row → **12px** (scale 12) →
  grid container. Nothing else sits between the chip and the count.
- "`N` movies watched" (`caption`, `text.secondary`) + the same
  3-column collection grid pattern as the Build-0 `My Collection` mock
  (reuses `PosterCard`/grid, not a new layout) — `N` is 0 at first sign-in
  per Build 6's actual scope (`profiles` row just created); the grid itself
  is empty at this Build (Collection module ships later) but the row count
  and grid container render now so the screen isn't bare.

### Loading state
- Shimmer placeholders in the exact shape of the loaded layout: circular
  avatar shimmer, two text-bar shimmers (name, usertag), then the "movies watched" text-bar
  shimmer at the same 24px gap (no row shimmers; the entry rows no longer
  exist).
  Same shimmer treatment `PosterCard` already uses for its `loading` state —
  no new shimmer component.

### Load-error state
- `EmptyState` component (§2), `icon: 🦉`, `title: "Couldn't load your
  profile"`, `body: "Check your connection and try again."`,
  `action: {label: "Retry", onPress: refetch}`.

### Copy strings (verbatim)
| Where | Text |
|---|---|
| Empty usertag chip | No usertag yet — add a usertag |
| Error title | Couldn't load your profile |
| Error body | Check your connection and try again. |
| Error action | Retry |

---

## Build 7 — Edit profile screen (Module: Profile)

Board: canvas https://claude.ai/artifact/M5TbevikF4q3dyGEh2S7XH, board
"Build 7 — Edit profile" (v6). Source:
`design-src/build-07-edit-profile.dc.html`. 5 states: idle, uploading photo,
upload-error, usertag-taken, saving.

**Route (new):** `(tabs)/profile/edit.tsx` — add this line to §3's route
tree under `profile/`, pushed from `profile/index.tsx`'s usertag chip (empty or `@usertag`) and from
Settings' "Edit profile photo / usertag" row (Build 9 section). The former
"Edit profile" row on My Profile was removed 2026-09-30. Not a `formSheet` — a normal pushed screen (back arrow
header), consistent with `movie/[id].tsx`'s pattern, since this is a
full-attention task, not a quick popover.

**Decision — usertag rules:** `3–20` characters, lowercase `a–z`, `0–9`,
underscore `_` only, **must start with a letter**. Stored lowercase, without
a leading `@`; displayed everywhere in the app with a leading `@` (view-only
formatting, never part of the stored value). Reasoning: lowercase-only
storage makes the uniqueness check (§ below) a trivial case-insensitive
comparison with no normalization step; letter-start avoids ambiguous
all-numeric tags; underscore-only (no hyphen/dot) keeps the allowed set
small and easy to validate client- and server-side with the same regex
(`^[a-z][a-z0-9_]{2,19}$`).

### Layout (idle state)
- Header: back arrow + "Edit profile" (`subhead`).
- Avatar (same `Avatar size: lg` as Build 6) with a small circular camera
  badge overlay, bottom-right of the avatar, 30px, `accent.gold` fill,
  `text.onGold` icon, `2px solid bg.base` ring so it reads as attached to
  the avatar. Tapping the avatar (not just the badge) opens the OS image
  picker — badge is a visual affordance, not a separate hit target.
  Caption below: "Tap to change photo" (`caption`, `text.secondary`).
- Usertag field: label "USERTAG" (`caption`, `text.secondary`, uppercase,
  letter-spacing), then a `GlassCard`-styled input row with a static `@`
  prefix (`accent.gold`) + the editable text (`text.primary`), 14px/`body`.
  Helper text under it, always visible (not just on error): "3–20
  characters · lowercase letters, numbers, underscore · must start with a
  letter" (`caption`, `text.disabled`).
- Save/Cancel: two `Button`s, `secondary-glass` (Cancel) + `primary-gold`
  (Save), side by side, equal width. **Save is disabled** until the usertag
  passes the regex above **and** differs from the currently-saved value (or
  a new photo was picked) — there's nothing to save otherwise.

### Uploading-photo state
- Avatar circle replaced by a determinate progress ring (`accent.gold`
  stroke over a `border.hairline`-opacity track, 6px stroke) driven by
  Supabase Storage's upload progress event, percentage centered in
  `caption`/`text.primary`. Caption changes to "Uploading photo…".
- The rest of the form (usertag field + both buttons) is disabled/dimmed
  (`opacity: .5` on the field, Save visually disabled) — a photo upload and
  a usertag save are two different network calls; don't let a usertag save
  race an in-flight upload. Cancel stays tappable (cancels the upload too).

### Upload-error state
- Photo reverts to its pre-upload state (old photo unchanged — Perchable
  never leaves a broken/blank avatar). Inline error card directly under the
  avatar block, same visual pattern as Build 5's error card (`GlassCard`
  tier `card` + `rgba(255,138,138,.35)` border): "⚠ Photo upload failed.
  Your old photo is unchanged — tap the photo to try again."
- **This never blocks the usertag half of the form** — Save stays available
  for a usertag-only change even while the photo upload has failed; photo
  and usertag are independent fields with independent save outcomes (a
  single Supabase update can still batch both when both succeed, but the UI
  contract is: photo failure alone doesn't disable usertag saving).

### Usertag-taken state
- Input row border turns `rgba(255,138,138,.5)` (danger-tinted, same pattern
  as Build 5/6's other error borders). Inline text under the field: "That
  usertag is already taken." (`caption`, `danger`). Save stays disabled.
- **Live check:** debounce the uniqueness query (≈400–500ms after the user
  stops typing) rather than checking on every keystroke or only on submit —
  Bella's call on the exact debounce constant, not a hard design value.

### Saving state
- Same convention as `ui/Button`'s `loading` state (§2): Save's label
  replaced by a spinner + "Saving", button stays `primary-gold`-colored but
  non-interactive; Cancel becomes disabled too (no cancelling mid-write).
  Avatar/usertag field both dim to `opacity: .5`.

### Copy strings (verbatim)
| Where | Text |
|---|---|
| Photo caption (idle) | Tap to change photo |
| Photo caption (uploading) | Uploading photo… |
| Usertag helper (always-on) | 3–20 characters · lowercase letters, numbers, underscore · must start with a letter |
| Upload error | ⚠ Photo upload failed. Your old photo is unchanged — tap the photo to try again. |
| Usertag-taken error | That usertag is already taken. |
| Save (saving state) | Saving |

---

## Build 9 — Settings screen: Sign out + Delete account (Module: Auth)

Board: canvas https://claude.ai/artifact/M5TbevikF4q3dyGEh2S7XH, board
"Build 9 — Settings (Sign out + Delete account)" (v6). Source:
`design-src/build-09-settings.dc.html`. 4 states: settings idle,
delete-confirmation, deleting, post-delete landing. **Also covers Build 8**
(Sign out) — Build 8 has no mockup phase of its own per PLAN.md, its one UI
element (the "Sign out" row) is drawn on this board instead.

**Route:** `(tabs)/profile/settings.tsx` (already in §3's route tree — no
route change).

2026-09-30 (Justin, phone test): this text records the existing "Edit profile
photo / usertag" row below, which the board doesn't show; the board is
updated the next time it is touched.

### Settings idle
- Same screen as the Build-0 Settings mock (§6, TMDB attribution — unchanged,
  still required), with three additions:
  - **Account section, "Edit profile photo / usertag" row** (already coded
    in `settings.tsx`; exact label, no emoji) — same
    `card` list-row style as the other Account rows, `text.primary`; pushes
    `(tabs)/profile/edit.tsx` (Build 7). This is now the Settings-side entry
    to Edit profile, since My Profile no longer has an Edit row.
  - **Account section** gets a third row: "🚪 Sign out" — same `card`
    list-row style as the existing rows, `text.primary`, no danger styling
    (signing out is reversible and low-stakes, doesn't need the danger
    treatment). Tapping it clears the Supabase session immediately (no
    confirmation dialog — Build 8's done-means only requires the session to
    clear and redirect to sign-in; a confirm step isn't specified and adds
    friction for a reversible action).
  - **New "Danger zone" section**, below About: "🗑 Delete my account" row,
    styled as `Button` variant `destructive` would be (§2) — fill
    `rgba(255,138,138,.1)`, `border: 1px solid rgba(255,138,138,.35)`, text
    `danger` (`#FF8A8A`), weight 700. Tapping it opens the delete
    confirmation sheet below — it does **not** delete anything itself.

### Delete-confirmation state
- `GlassCard` tier `sheet` bottom sheet (same glass/shadow spec as
  `ProfileSheet`, §1.4's `glass.sheet`), drag-handle bar, but with a
  danger-tinted glow (`0 0 40px rgba(255,138,138,.15)` in place of the
  purple glow) so it visually reads as the one dangerous sheet in the app.
- Title: "Delete your account?" (`title`-ish weight, `danger` color).
- **Explicit list of what's deleted** (required by this Build's brief) —
  render as a plain bulleted list, `body`/`text.primary`:
  "Your profile, photo and usertag" · "Your watched collection and
  captions" · "Your comments, DMs and follow graph" · "Your Google sign-in
  link to Perchable". Followed by: "This can't be undone. You'd need a
  fresh Google sign-up to use Perchable again." (`caption`,
  `text.secondary`).
- **Decision — confirmation mechanism: type "DELETE".** Not a second-tap.
  A text input, placeholder/label "Type DELETE to confirm:", and the red
  confirm button (`Button` variant `destructive`, label "Delete my account")
  stays disabled until the typed text is an **exact case-sensitive match**
  for `DELETE`. Reasoning: this is the one truly irreversible action in the
  app (cascades through every module's data, per PLAN.md Build 9's
  `ON DELETE CASCADE` design) — a second tap is too easy to fire by
  muscle-memory double-tap; typing a specific word is the standard
  high-friction pattern for destructive-irreversible actions and matches
  what the explicit list above is already asking the user to read
  carefully.
- Cancel (`secondary-glass`) dismisses the sheet, no state change.

### Deleting state
- Sheet content collapses to a short status line: "Deleting your data —
  this may take a moment." Confirm button becomes the same spinner+label
  loading convention used elsewhere ("Deleting…"), Cancel becomes disabled
  — once the delete call has actually started, there's nothing to safely
  cancel mid-cascade.

### Post-delete landing
- **Reuses Build 5's sign-in idle screen exactly** — same route
  (`(auth)/sign-in.tsx`), same component, no new screen. The only addition:
  a `Toast` (variant: `info`, per §2's existing `Toast` variants — no new
  variant needed) reading "✓ Your account was deleted.", shown once on
  arrival and auto-dismissing. This is the natural landing anyway, since
  deleting the Supabase Auth user invalidates the session and the root
  layout's auth gate (§3) redirects here regardless.

### Copy strings (verbatim)
| Where | Text |
|---|---|
| Edit profile row | Edit profile photo / usertag |
| Sign out row | 🚪 Sign out |
| Delete row | 🗑 Delete my account |
| Sheet title | Delete your account? |
| Deletion list intro | This permanently deletes: |
| Deletion list items | Your profile, photo and usertag / Your watched collection and captions / Your comments, DMs and follow graph / Your Google sign-in link to Perchable |
| Irreversibility note | This can't be undone. You'd need a fresh Google sign-up to use Perchable again. |
| Confirm-input prompt | Type DELETE to confirm: |
| Confirm button (idle) | Delete my account |
| Confirm button (deleting) | Deleting… |
| Deleting status line | Deleting your data — this may take a moment. |
| Post-delete toast | ✓ Your account was deleted. |

---

## Build 10b — Report / block UI (Module: Moderation)

Boards (source in `design-src/`): `build-10b-report-sheet.dc.html` (ReportSheet, 7 states),
`build-10b-block-sheet.dc.html` (BlockUserSheet, 4 states), `build-10b-blocked-users.dc.html`
(Blocked users, 7 states), `build-10b-11-settings-rows.dc.html` (Settings rows),
`build-10b-11-dev-harness.dc.html` (harness). All code lives in `src/modules/moderation/` (§4).

**Sheet rules (both sheets, follow `DeleteAccountSheet`):** an in-screen overlay, not a route.
Scrim `overlay.scrim` over the whole screen, tapping it = Cancel (except where stated). Sheet
surface is **flat `bg.elevatedFlat` `#1E1A26`, border `border.hairlineStrong` on top and sides, radius
`xl` 28 on the top corners, `elevation.modal`; no blur and no glow** (Android rule, LESSONS.md
Platform; unlike Delete's danger glow, these sheets have none). Drag-handle bar `size.dragHandle`,
16px below the top edge, 16px gap to the title. Padding 16 top / 20 sides / 24 bottom (plus the
bottom safe-area inset). Body scrolls if content exceeds `size.sheetMaxHeightRatio`; the
button row is pinned. Title `subhead` (Poppins 700, 19) `text.primary`; body `body` `text.secondary`.
Buttons are `ui/Button` (48 high, radius 12), pair side by side, equal width, 10px gap, Cancel
`secondary-glass` on the left.

### ReportSheet
Props (PLAN C1): `{ target: { type: ReportTargetType; id: string; ownerId: string }; onClose(); onReported?() }`.

Layout, top to bottom: title (varies by `target.type`, table below) → 4px → subhead line → 16px →
seven reason rows, 6px apart → (only when "Something else" is selected) 8px + details block →
(error state) 12px + `ErrorCard` → 16px → button row.
- **Reason row:** 48 high, radius `sm` 12, fill `surface.input`, 1px `border.hairline`; 16px side
  padding; radio (`size.radio`, 2px ring `text.secondary`) then 12px gap then label `body`
  `text.primary`. **Selected:** fill `surface.goldTint`, border `border.gold`, ring and 10px dot
  `accent.gold`. Single-select; tapping the selected row keeps it selected.
- **Details block ("Something else" only):** label `caption` uppercase `letterSpacing.label`
  `text.secondary`; input `size.detailsInput` (96) min height, radius `sm`, fill
  `bg.base` @ 50% (`glass.chip` fill family, no blur), 1px `border.hairline` (`hairlineStrong` when focused), `body`
  `text.primary`, placeholder `text.disabled`; multiline, `maxLength` 500; counter `caption`
  `text.disabled`, right-aligned, "n/500". The other six reasons show no details box (PLAN C1 clarification: "optional for other reasons" is a DB
  fact; the UI only offers the box for "Something else").
- **Send report** = `Button primary-gold`. Disabled (`opacity.disabled`) until a reason is chosen and, for
  "Something else", the details are non-blank after trim.
- **States:** (1) idle: nothing selected, Send disabled. (2) selected. (3) "Something else",
  details empty, Send disabled. (4) "Something else", typed. (5) submitting: list and input
  dimmed to `opacity.disabled` and non-interactive; Send shows the `Button` loading convention
  ("Sending…"); **Cancel and scrim stay active** (PLAN failure mode: dismissing mid-submit must be safe;
  the result is then ignored and nothing re-renders). (6) sent: sheet content is replaced by a 56px
  gold check badge, title, body, one full-width `Button` "Done". **Also shown for the
  already-reported case (23505)**: identical, so the user learns nothing about earlier reports.
  Sent does **not** auto-close (screen readers need time); `onReported` fires when the insert
  succeeds, `onClose` fires on Done. (7) error (offline/server): `ErrorCard` in place; reason and typed
  details kept; Send becomes "Try again" and resubmits.
- **Self-report:** the sheet renders nothing and calls `onClose` when `ownerId` is the signed-in user.

| Where | Text (verbatim) |
|---|---|
| Title, `profile` | Report this profile |
| Title, `comment` | Report this comment |
| Title, `dm_message` | Report this message |
| Title, `collection_item` | Report this caption |
| Subhead | Pick the closest reason. Reports are private. |
| Reason `spam` | Spam or scam |
| Reason `harassment` | Harassment or bullying |
| Reason `hate` | Hate speech |
| Reason `sexual` | Sexual content |
| Reason `violence` | Violence or threats |
| Reason `impersonation` | Pretending to be someone else |
| Reason `other` | Something else |
| Details label | Tell us more (required) |
| Details placeholder | What's the problem? |
| Details counter | 0/500 |
| Cancel | Cancel |
| Send (idle) | Send report |
| Send (loading) | Sending… |
| Send (after error) | Try again |
| Error card | ⚠ Couldn't send your report. Check your connection and try again. |
| Sent title | Report sent |
| Sent body | Thanks — we'll take a look. Your report is private: the person you reported won't be told it came from you. |
| Sent button | Done |

`OBJECTIONABLE_CATEGORIES` carries, per category, `key`, `label` (this table's reason label) and
`description` (Build 11's terms line). The reason list and the terms text both render from it.

### BlockUserSheet
Props (PLAN C3): `{ userId: string; displayName?: string; onClose(); onBlocked?() }`. `{name}` is
`displayName` or, when missing, "this user".

**Copy is written to stay true now and later.** Until Builds 24-28, a block is only a stored record:
nothing is hidden or enforced. So the sheet says what a block *is* ("tells Perchable you don't
want to interact"), that the person isn't told, and where to undo it. It never says what the
user will or won't see. When enforcement ships the same words still read right; no copy change
needed (Manager: if Justin wants a "hides their comments" line, add it at Build 25, not now).

- Layout: title (up to 2 lines) → 8px → two body paragraphs, 8px apart → (error) 16px `ErrorCard` → 24px → buttons.
- **Block** is `Button destructive` (solid `danger`, `text.onGold` label): the one consequential
  action, though undoable. Cancel `secondary-glass`.
- **States:** (1) confirm. (2) blocking: Block shows loading "Blocking…"; **Cancel is disabled and
  the scrim/back do nothing** (the write is in flight, so a "cancel" would mislead). (3) blocked: replaces content with 56px gold check
  badge, title, body, full-width "Done" (`primary-gold`); no auto-close; `onBlocked` fires on
  success, `onClose` on Done. Already blocked (23505) also lands here. (4) error: `ErrorCard`;
  Block becomes "Try again"; Cancel enabled.

| Where | Text (verbatim; `{name}` per above) |
|---|---|
| Title | Block {name}? |
| Body 1 | Blocking tells Perchable you don't want to interact with {name}. |
| Body 2 | We won't tell them. You can undo this any time in Settings › Blocked users. |
| Cancel | Cancel |
| Block (idle) | Block |
| Block (loading) | Blocking… |
| Block (after error) | Try again |
| Error card | ⚠ Couldn't block {name}. Check your connection and try again. |
| Blocked title | {name} is blocked |
| Blocked body | You can undo this any time in Settings › Blocked users. |
| Blocked button | Done |

### Settings rows (Account section)
Two new `ListRow`s, same look as their neighbours (plain text, no emoji, no chevron). New order:
Edit profile photo / usertag · Comments on my collection · **Blocked users** · **Terms & community
rules** · Sign out. Sign out stays last (it ends the session); the two moderation rows sit together
above it. Rows push `(tabs)/profile/blocked-users` and root `terms` (view mode). Nothing else on Settings changes. Board: `build-10b-11-settings-rows.dc.html`.

| Where | Text |
|---|---|
| Row | Blocked users |
| Row | Terms & community rules |

### Blocked users screen — `(tabs)/profile/blocked-users.tsx`
Pushed screen: back chip (36, as Edit profile) + "Blocked users" (`subhead`, `lavender.200`). Nothing sits in the top-right gear
zone. Under the header, a `body` `text.secondary` intro line (16px above the list). List: rows
12px apart in a scroll view (a `FlashList` is not needed; flat rows, no blur anyway).
- **Row:** `surface.input` card, radius `md` 16, 1px `border.hairline`, padding 12/16. `Avatar md` (48; initials fallback on
  null photo), then name (`bodyStrong`, one line, ellipsis) and `@usertag` (`caption`
  `text.secondary`; **line omitted when the usertag is null**), then `Button secondary-glass`
  "Unblock" (48 high, so the target is 48dp; do not shrink it). Null display name shows **"Perchable user"**.
- **Unblock needs a confirmation, inline, in the row** (no second sheet). Why: once enforcement ships,
  an accidental unblock puts a harasser back in reach, and the Unblock button sits in a busy list;
  a block itself needs a confirm, so its reverse should too. Tapping Unblock expands that row
  (border `border.gold`): "Unblock {first name}?" (`bodyStrong`), one line explaining, then Cancel
  (`secondary-glass`) and Unblock (`primary-gold`). Only one row is expanded at a time.
- **States:** (1) loading: three shimmer rows in the row's shape (`PosterCard` shimmer treatment). (2) empty: `EmptyState`
  icon 🚫. (3) filled. (4) confirm open. (5) unblocking: that row's content dims to
  `opacity.disabled`, its button shows loading "Unblocking…"; other rows stay usable. (6) unblock failed: the row
  goes back to normal and stays in the list; an `ErrorCard` appears above the list until the
  next action. (7) load error: `EmptyState` icon 🦉 with Retry (Build 6 pattern). Leaving the screen
  mid-unblock is safe (no state update after unmount).

| Where | Text (verbatim) |
|---|---|
| Header | Blocked users |
| Intro | People you've blocked appear here. Unblock anyone to undo a block. |
| Fallback name | Perchable user |
| Row button | Unblock |
| Confirm title | Unblock {first name}? (fallback: Unblock this user?) |
| Confirm body | This removes them from your blocked list. |
| Confirm buttons | Cancel / Unblock |
| Row loading | Unblocking… |
| Unblock error | ⚠ Couldn't unblock {first name}. Check your connection and try again. |
| Empty title | No blocked users |
| Empty body | People you block will show up here. |
| Load error title | Couldn't load blocked users |
| Load error body | Check your connection and try again. |
| Load error action | Retry |

### Dev harness — `ModerationDevHarness` (dev only, never ships)
Board: `build-10b-11-dev-harness.dc.html`. Plain, functional: a monospace section headed
**"Moderation dev harness"** (that exact string is the marker Ruby greps for in the `expo export` output;
it must be absent there) inside `src/app/debug.tsx` via the `__DEV__` `require`. It runs no query before the `__DEV__`
return. No polish, no tokens required beyond `bg.base`/`text.*`; every control ≥48 high. Contents,
top to bottom, and nothing else:
1. Readout "Terms accepted: no" or "yes, {date}".
2. **Pick a user**: radio list of other profiles ("Name @tag"), first pre-selected. Empty list: "No other profiles — sign in with a second account."
3. **Report** buttons, one per type: "Report profile" (target id = the picked user's id), "Report comment (random id)", "Report DM message (random id)", "Report caption (random id)". Each opens `ReportSheet` with `ownerId` = the picked user's id.
4. **Block user** → opens `BlockUserSheet` for the picked user.
5. **Simulate first comment** → `requireTerms(() => setResult('action ran'))`.
6. "Result: —" line showing the last outcome ("reported", "blocked", "action ran"); `accessibilityLabel` on each button equals its visible text so Queenie can find it.
Resetting acceptance for a re-test is done by the Manager in SQL (a client cannot un-accept).

### Accessibility (both sheets and the screen)
- Sheet container: `accessibilityViewIsModal`; focus moves to the title on open. Scrim: `accessibilityRole="button"`, label "Close" (not on the blocking state).
- Reason list wrapper `accessibilityRole="radiogroup"`; each row `accessibilityRole="radio"`, `accessibilityLabel` = reason label, `accessibilityState={{ selected }}`; **the whole 48px row is the target**.
- Details input: `accessibilityLabel="Tell us more"`, `accessibilityHint="Required"`.
- Buttons: `ui/Button` already sets role and label; all ≥48dp. Disabled Send exposes `disabled: true`.
- `ErrorCard` is the alert (`accessibilityRole="alert"`); the sent and blocked titles use `accessibilityLiveRegion="polite"`.
- Blocked-users row: Unblock `accessibilityLabel="Unblock {name}"`; avatar is decorative (`accessible={false}`). Back chip label "Back".
- Emoji in EmptyState icons are decorative. Nothing is conveyed by colour alone (selected = ring fill + border + `selected` state).

Dev-client gear zone (§7): nothing is placed in the top-right 64x64 in any of these boards; the sheets are bottom-anchored and the headers have no trailing controls.

---

## Build 11 — Terms & community rules (Module: Moderation)

Board: `build-11-terms.dc.html` (6 states). Route: root `src/app/terms.tsx` (§3). Content
component `TermsScreen` lives in `src/modules/moderation/components/`; the route only composes it.

**Two entry modes**, same screen: **view** (Settings → "Terms & community rules"; back arrow leaves;
shows "I agree" if not accepted, or the accepted date if accepted) and **gate** (route param `gate=1`,
opened by `requireTerms` when the user has not accepted; the callback itself lives in the module,
never in route params). Gate mode differs by: a banner at the top of the text, and a second button.

**Layout.** Header: back chip + "Terms & community rules" (`subhead`). Body scrolls: (gate only) banner
card (`surface.goldTint`, `border.gold`, `bodyStrong`, radius `md`) → intro `body` `text.secondary`
→ 24px → section labels (`caption` uppercase `letterSpacing.label` `text.secondary`, 8px above their text)
→ the seven categories in **one** `surface.input` card (radius `md`, 12px row padding, 1px `border.hairline`
dividers; label `bodyStrong` `text.primary`, description `body` `text.secondary`, both from
`OBJECTIONABLE_CATEGORIES`, never retyped) → three short plain sections. About 1.3 screens tall on a
phone; that is the deliberate ceiling, so keep future edits short. **Footer pinned** below the scroll
(`bg.elevatedFlat`, 1px `border.hairlineStrong` top, padding 16/20/24 plus safe area, `size.termsFooter`):
a `caption` line above the buttons.
- **View, not accepted:** one full-width `primary-gold` "I agree".
- **Gate, not accepted:** "Not now" (`secondary-glass`) and "I agree" (`primary-gold`), equal width. "Not now" closes the screen and returns the user to where they were; the callback never runs and nothing is posted. **This adds a decline control that PLAN B2 ruled out ("no decline control"); see PLAN PROBLEM in the report. If Justin declines it, delete "Not now" and the back arrow remains the way out.**
- **Accepting:** "I agree" shows loading "Saving…"; in gate mode "Not now" and back are disabled during the write.
- **Accepted (view mode only):** footer replaced by a 28px gold check badge and "Accepted on {date}" (`bodyStrong`); no button. In gate mode a successful accept runs the callback once and closes the screen immediately; the accepted look is never seen there.
- **Error:** `ErrorCard` at the top of the footer; the button becomes "Try again"; the screen stays open and the text stays scrolled where it was.
- **Loading the profile / read failed:** the text always renders. Footer behaves as "not accepted" (fails closed); if the read is loading, the date area is a shimmer bar in view mode and "I agree" is still tappable. Date format: `D MMM YYYY`, device locale month names (e.g. 30 Sep 2026).

| Where | Text (verbatim, for Justin to approve) |
|---|---|
| Header | Terms & community rules |
| Gate banner | Before you post, please read and accept these rules. |
| Intro | Perchable is a place to share the movies you watch. To keep it friendly for everyone, you agree to these rules before you post anything. |
| Section 1 label | What's not allowed |
| Spam or scam | Ads, repeated messages, fake links or anything meant to trick people. |
| Harassment or bullying | Insulting, targeting or repeatedly bothering someone. |
| Hate speech | Attacking people for their race, religion, gender, sexuality, disability or nationality. |
| Sexual content | Nudity or sexually explicit photos, captions or messages. |
| Violence or threats | Threatening or encouraging harm, or graphic violence shown for shock. |
| Pretending to be someone else | Using someone else's name, photo or identity to mislead people. |
| Something else | Anything else that is illegal or seriously harmful. |
| Section 2 label | Reporting and blocking |
| Section 2 text | You can report a profile, comment, message or caption, and block people you don't want to interact with. Your reports are private. You can see and undo your blocks in Settings › Blocked users. |
| Section 3 label | What we do about it |
| Section 3 text | We look at reports. Content that breaks these rules can be removed, and accounts that keep breaking them can be banned. |
| Section 4 label | Who runs Perchable |
| Section 4 text | Perchable is made and run by Justin. Questions about these rules: [Justin's contact email] |
| Footer caption | By tapping I agree, you accept these rules. |
| Agree (idle) | I agree |
| Agree (loading) | Saving… |
| Agree (after error) | Try again |
| Decline (gate only) | Not now |
| Error card | ⚠ Couldn't save your agreement. Check your connection and try again. |
| Accepted footer | Accepted on {date} |

Category labels/descriptions in the terms come from the same constant as the report reasons (labels match the ReportSheet table above).

**Notes for Justin / Manager (not shown in the app):**
- This is **not legal advice**: it is the Play-policy minimum (RESEARCH.md §6: defines objectionable content, says how to report/block, says content can be removed and accounts banned). Justin may want properly reviewed terms before store submission.
- Open item: "[Justin's contact email]" must be replaced with a real address before Phase 1 (or that sentence dropped). The Section 2 text describes report/block entry points that only exist from Builds 24-27; acceptable because the app is not released before then, but re-read it at Build 24.
- The terms name only what Perchable does today; they make no promise about response times.

Accessibility: header chip "Back"; body is a scrollable region; section labels `accessibilityRole="header"`; footer buttons ≥48dp via `Button`; error card as alert; accepted footer `accessibilityLiveRegion="polite"`. Gear zone: the header title stays left of the corner; nothing trailing.

---

## Build 12 — Home poster grid (Module 4: Movies; Builds 12a and 12b)

Boards (source in `design-src/`, drawn at 390 wide; the emulator is 411 dp wide, same layout):
`build-12a-home-states.dc.html` (loading / filled / empty / error),
`build-12a-home-parts.dc.html` (Roulette toast, PosterCard states, measurements),
`build-12b-home-paging.dc.html` (next page loading / end / next page failed / pull-to-refresh /
refresh failed). Canvas: not published (the old canvas is not reachable from this account);
`design-src/` and this text are the source. 12a builds the first two boards; 12b builds the third.

**Decisions (Dianne, Phase 0, 2026-10-01)**
- **N5: 3 columns, kept.** Tile 110 dp at 390 wide (117 at 411, 100 at 360). Two columns would make 175 dp
  tiles and show about two rows per screen instead of three, so a browse list would look sparse; 3
  columns also matches the My Collection grid, so a poster looks the same everywhere. A 100 dp tile is
  still readable because the poster art carries the title.
- **No title under the tile.** Posters carry their own title; the tile is poster-only (denser, matches the
  inspo). The title is shown only in the image-failed fallback, and always in the accessibility label.
- **Roulette card is flat on Android** (`glass.hero` fill + 1px `border.hairline`, no `BlurView`, no gold halo glow).
  Why: the backdrop behind it is flat circles (`GlassBackdrop`), so a blur has nothing to blur, and the
  card is a `FlashList` header, so the §1.5 list rule applies. iOS may use `BlurView` here later; it is not
  part of this Build. This overrides the "Home hero card: Yes" row in §1.5 (updated).
- **Roulette button is full-strength `primary-gold`, not the dimmed disabled look** that §5 first described.
  It is tappable and answers with a Toast, so it must look alive; a dimmed look reads as broken, and
  TalkBack would announce "disabled" for a control that does something. §5 is updated. It is not
  `accessibilityState.disabled`.
- **Header:** wordmark "🦉 perchable" (`subhead`, `accent.gold`) left, from the Build 0 Home mock. The 🏆 "N Watched"
  trophy chip is NOT built here (it needs the collection, Build 19; PLAN M1). Avatar: `ui/Avatar sm` (32)
  centred in a 48x48 touch wrapper, wrapper right edge **72 dp from the screen edge** (clear of the 64 dp
  gear zone; the placeholder used 84). Tap opens the Profile tab. The header is fixed, outside the list.
- **Tab bar stays** on Home (it is a tab). The boards draw the shipped two-tab bar (Perch, Profile); later
  tabs appear as their Builds land. Flat fill on Android, as shipped.

### Layout (top to bottom; all values dp)
1. Header (fixed): `paddingTop` = safe-area top inset; row 48 high; padding-left 20; avatar slot as above.
2. `FlashList` (`numColumns` 3), content padding top 0 / sides 20 / bottom 16.
   `ListHeaderComponent` = 12 top space, Roulette card, section title. It scrolls with the grid.
3. **Roulette card:** radius `lg` 20, padding 20, fill `glass.hero.backgroundColor`, 1px `border.hairline`. Eyebrow
   "Perch Roulette" (`caption`, uppercase, `letterSpacing.label`, `colors.brand.lavender200`); 6; title
   (`title` 24/30, `text.primary`); 14; `Button primary-gold` full width, 48 high. Tap shows `Toast`
   variant `coming-soon`; nothing else happens.
4. **Section title** "Popular right now": `subhead` (19/24), `colors.brand.lavender200`, 24 above, 12 below,
   `accessibilityRole="header"`.
5. **Grid:** 3 columns, gap 10 both ways, tile width = (screen width - 40 - 20) / 3, tile height = width x 3/2
   (`size.posterAspect`). Row pitch = tile height + 10.
6. **Footer** (12b): below.

### PosterCard (new, `src/ui/PosterCard/`; §2 updated)
Props: `id` (movie id, the `recyclingKey`), `posterUrl: string | null`, `title: string`, `year?: number | null`, `retryToken?` (a failed image retries once per pull-to-refresh, 12b). (`watched`, `tier`,
`caption` arrive with later Builds; there is no `onPress` in 12a/12b, Build 13 adds it.) Fills its parent's width, aspect 2:3,
radius `sm` 12, 1px `border.hairline`, `overflow: hidden`, flat fill, never `BlurView`.
- **Loading:** `bg.elevatedFlat` fill with the `usePulse` opacity (0.4 to 0.9) plus a
  `rgba(214,196,233,0.10)` wash (`colors.overlay.shimmerWash`). Not announced one by one.
- **Loaded:** `expo-image`, `contentFit="cover"`, `cachePolicy="memory-disk"`, `recyclingKey` = movie id,
  `motion.imageFade` (200 ms) fade-in over the loading fill. No overlay or text on the tile.
- **Failed / no `posterUrl`:** `bg.elevatedFlat`, centred column, padding 8: icon 🎬 (`iconSize.lg`, 22), 8,
  title (`caption`, `text.secondary`, centred, max 3 lines, ellipsis). Year not drawn. Emoji and RTL titles
  must not break it. A failed image (`onError`) switches to this state; a tile is never left blank.
- **Pressed:** none in 12a (posters are not tappable, PLAN M7). Build 13 adds scale 0.98 (same as
  `GlassCard`) and role button.
- **Accessibility:** `accessible`, `accessibilityRole="image"` in 12a, label "{title}, {year}" (title only
  when the year is unknown). Loading tiles are `importantForAccessibility="no-hide-descendants"`.

### Screen states (`(tabs)/index.tsx` composes `usePopularMovies` + `ui/` + the module's grid; no fetching in the route)
| State | What shows |
|---|---|
| Loading | Header, Roulette card, section title, 12 loading tiles (4 rows). One polite live region "Loading movies". |
| Filled | Header, Roulette card, title, grid of loaded tiles (a tile whose image failed shows the fallback). |
| Empty (zero usable results) | Header, Roulette card, `EmptyState` (icon 🎬) with Retry; section title hidden; 32 between card and `EmptyState`. |
| Error (first page failed) | Same shell, `EmptyState` (icon 🦉) with Retry. Retry reloads page 1; a double tap sends one request. |
| Roulette tapped | `Toast` coming-soon above the tab bar. Nothing else changes. |

`EmptyState` change (applies everywhere): the action button gets `minHeight: size.minTouch` (48). It was
about 44 high; PLAN B7 needs 48.

### 12b — paging and refresh
- **Next page loading:** footer block `size.footerBlock` (88) high (same as the error block below), centred: 20 dp `ui/Spinner` (2px ring
  `overlay.spinnerTrack`, top arc `accent.gold`), 10, "Loading more…" (`caption`, `text.secondary`). Polite
  live region "Loading more movies". Loaded posters stay.
- **End of list** (last page = min(total_pages, 500)): footer row `size.footerRow` (56) high, "You've reached the end."
  (`caption`, `text.secondary`, centred). No request after it.
- **Next page failed:** footer block `size.footerBlock` (88) high, content centred: "⚠ Couldn't load more movies." (`small`, `danger`, `accessibilityRole="alert"`), 8,
  then `Button secondary-glass` "Retry" (48 high, padding 0/24, `accessibilityLabel` "Retry loading more
  movies"). Posters stay; never the full-screen error, never an empty footer that looks like the end.
- **Pull to refresh:** `FlashList` `refreshControl`: `colors={[accent.gold]}`,
  `progressBackgroundColor={bg.elevatedFlat}`. Fetches page 1 only, drops later pages, returns to the top.
- **Refresh failed while posters show:** posters stay; `Toast` variant `error`; the screen never flips to
  the error state.
- `Toast` offset: 24 dp above the tab bar on tab screens (the system inset is not added again inside the tabs;
  the boards draw it 98 from the phone's bottom edge). Inside a `Modal` the Toast is given the bottom inset.

### Copy (verbatim, Build 12)
| Where | Text |
|---|---|
| Wordmark | 🦉 perchable |
| Avatar, `accessibilityLabel` (existing) | Open My Profile |
| Roulette eyebrow | Perch Roulette |
| Roulette title | Can't decide tonight? |
| Roulette button | 🎬 Surprise Me |
| Roulette button, `accessibilityLabel` | Surprise me |
| Roulette button, `accessibilityHint` | Smart picks are coming soon |
| Roulette Toast | Smart picks are coming soon. |
| Section title | Popular right now |
| Loading, live region | Loading movies |
| Empty title | No movies to show |
| Empty body | We couldn't find any movies right now. Try again in a moment. |
| Error title | Couldn't load movies |
| Error body | Check your connection and try again. |
| Retry (empty, error, footer) | Retry |
| Poster label | {title}, {year} (title only if no year) |
| Poster fallback icon | 🎬 |
| Loading more | Loading more… |
| Loading more, live region | Loading more movies |
| End of list | You've reached the end. |
| Next page failed | ⚠ Couldn't load more movies. |
| Next page Retry, `accessibilityLabel` | Retry loading more movies |
| Refresh failed Toast | Couldn't refresh. Check your connection. |

Year rule: the first four digits of `release_date` when it matches `^\d{4}`; otherwise omitted (never "NaN",
"0" or blank).

### Accessibility notes (Build 12)
The section title is a header. Every control is at least 48 dp: avatar slot 48, Roulette button 48, Retry 48
(EmptyState fix and footer). Posters are not interactive in 12a. Nothing depends on colour alone (the footer
error carries the ⚠ and words). Contrast: `text.secondary` on `bg.base` about 8:1, `danger` about 9:1,
`accent.gold` about 5.6:1 (used only for the wordmark and the spinner arc, never body text). Gear zone:
nothing in the top-right 64x64 (dashed on the boards).

---

## Build 13 — Movie details (Module 4: Movies)

Boards: `build-13-details-states.dc.html` (loading / loaded / error / not found) and
`build-13-details-variants.dc.html` (sparse data / long text / tier legend / scrolled with the top bar,
long cast names and the lounge Toast).

**Route and the tab-bar question (settled):** `src/app/movie/[id].tsx`, a root-level Stack route inside the
session-guarded group. It is a **full-screen push with no tab bar**, as Priya defaulted. Why: a root-level
sibling of `(tabs)` covers the bar anyway, and keeping it would mean nesting the route under every tab; the
screen is long and the 74 dp bar costs about 9% of a short phone; Edit profile and Terms already
work this way; and a deep link then needs no tab context. §3's "TabBar stays visible under `movie/`" is
corrected. Back = the back chip and the Android hardware back (same result). Cold-start deep link:
`router.canGoBack()` false means `router.replace('/')`. The navigator header is off (`headerShown: false`);
the screen draws its own chip.

### Layout (loaded; dp; drawn at 390 wide; one scrolling column)
- **Backdrop:** full width, `size.detailsBackdrop` 220 high, from y = 0 (under the status bar), `expo-image`
  `w780`, cover, scrolls with the content. Bottom fade: `LinearGradient` from `colors.overlay.fadeStart` to
  `bg.base`, 40% to 100%. Decorative. No backdrop: flat `colors.brand.purple900` with the same fade.
- **Back chip:** floating, 36x36, radius `sm`, fill `bg.elevatedFlat`, 1px `border.hairlineStrong`, "←" in
  lavender200; position left 20, top = inset + 8; `hitSlop` = `iconButtonHitSlop` (6) so it is 48; label
  "Back". Always visible (floats above the scroll).
- **Compact top bar:** once the scroll offset passes `size.detailsBarShowAt` (150), a solid bar fades in
  (150 ms) at the top: `bg.base`, height = inset + 48, 1px `border.hairline` bottom; the chip stays on it;
  the movie title (`subhead`, lavender200, one line, ellipsis) at left 76 / right 72, so it clears the gear
  zone. This stops text sliding under the chip.
- **Header row:** starts at y = 156 (`size.detailsBackdrop` minus `size.detailsPosterOverlap` 64). Poster
  `size.detailsPosterWidth` 120 x 180 (`PosterCard` states, radius 12, source `w500`, border
  `hairlineStrong`), gap 16, then a column with 76 top padding: title (`title` 24/30, `text.primary`, up to
  3 lines, ellipsis, `accessibilityRole="header"`); 8; meta line "{year} · {runtime}" (`body`,
  `text.secondary`; omitted when both are missing, a lone part shown alone); 6; genres joined by " · "
  (`caption`, `text.secondary`, wraps; omitted when empty).
- **Chip row** (20 under the header row, gap 12): rating chip and **TierBadge** chip, both 36 high, pill
  radius, fill `surface.input`, 1px `border.hairline` (the tier chip `border.gold`). Rating chip: "★"
  (`accent.gold`), "8.4" (`bodyStrong`), "of 10" (`small`, `text.secondary`); no votes: "Not rated yet"
  (`bodyStrong`, `text.secondary`, no star). Tier chip: "🏆 Tier" (`bodyStrong`, `accent.gold`), `hitSlop` 6.
- **Tagline** (16 under): `bodyStrong`, `text.secondary`, wraps; omitted when empty.
- **Synopsis:** heading "Synopsis" (`subhead`, lavender200, header, 24 above / 8 below), text `body`
  (15/22) `text.primary`.
- **Cast** (heading and row omitted when the list is empty): heading "Cast" (24 above, 12 below); a
  horizontal `FlatList` (`accessibilityRole="list"`), content padding-left 20 and padding-right 20, items 88
  wide, gap 12. Item: `ui/Avatar lg` (88; photo `w185`, initials fallback), 8, name (`caption`,
  `text.primary`, 2 lines, ellipsis), 2, character (`small`, `text.secondary`, 2 lines, ellipsis; omitted when
  empty). Not tappable. At most 15 (the server sends 15).
- **`#spoiler-free-lounge`** (UI shell): heading "#spoiler-free-lounge" (`subhead`, lavender200, 24 above / 4
  below), subline (`small`, `text.secondary`, 12 below), then one card: radius `md` 16, padding 16/16/4,
  fill `glass.hero.backgroundColor` (flat, as Roulette), 1px `border.hairline`. Inside: two static sample
  messages (`Avatar sm` + author `small` 600 `accent.gold` + text `small` `text.primary`, 12 apart), the line
  "Preview only. Comments are coming soon." (`small`, `text.secondary`, 12 below), then the composer: 48
  high, pill, fill `bg.base` at 50% (the `glass.chip` family), 1px `border.hairline`, padding 0/16,
  placeholder `body` `text.disabled`. The composer is **not focusable**; tapping it shows a `Toast`
  "Comments are coming soon." (never a silent tap). The sample messages are the only invented content and the
  "Preview only" line says so. Nothing is stored or fetched (Module 9 wires the panel).
- **Bottom:** `size.detailsBottomPad` 80 padding plus the bottom inset (QA amendment 2; it leaves room for the Toast).
- **TierBadge popover:** tapping the chip toggles a static popover under the chip row: 260 wide, left edge 90
  from the content left, radius `md` 16, padding 16, fill `bg.elevatedFlat`, 1px `border.hairlineStrong`,
  `elevation.card`. Title "Tier ratings" (`bodyStrong`), 4, body (`small`, `text.secondary`), 12, four
  36x36 letter badges S A B C (8 apart): S fill `accent.gold` with `text.onGold`; A `surface.goldTint` +
  `border.gold` with gold text; B `surface.input` + `border.hairlineStrong` with `text.primary`; C
  `surface.input` + `border.hairline` with `text.secondary`; letters Poppins 800 15 (`type.bodyStrong`
  size, `Poppins_800ExtraBold`). Dismiss: tap the chip again, tap outside, or Android back (the first back
  closes the popover). No rating is stored or settable.

### States
| State | What shows |
|---|---|
| Loading | Back chip; shimmers in the final layout: flat backdrop block, poster block, two title bars (100%, 70%, 24 high), a meta bar, a genre bar, two chip pills (110 and 90 x 36), a tagline bar, "Synopsis" heading bar (120 x 24) and four text bars, "Cast" bar (80 x 24) and four avatar circles each with two small bars. `usePulse`. One polite live region "Loading movie". |
| Loaded | The layout above. |
| Error (nothing cached) | Back chip; `EmptyState` (🦉) with Retry, vertically centred. |
| Error on refetch with data | Keeps showing the loaded data; `Toast` error "Couldn't refresh. Check your connection." Data is never replaced by the error screen. |
| Not found (404, adult title, invalid route id) | Back chip; `EmptyState` (🎬) with action "Back to Home" (`router.replace('/')`). An invalid id makes no proxy call. |
| Empty | Does not apply to a single movie (it exists or it is not found); the Build log says so. |

### Missing data
| Missing | Rule |
|---|---|
| `overview` blank | Synopsis text is "No synopsis available." (same style) |
| cast empty | Cast heading and row not rendered |
| `vote_count` 0 | Rating chip reads "Not rated yet" (never 0.0) |
| `poster_path` null or image fails | Poster uses the `PosterCard` fallback (🎬 and title) |
| `backdrop_path` null | Flat `purple900` backdrop |
| `release_date` empty or malformed | Year omitted |
| `runtime` 0 or null | Runtime omitted |
| genres empty | Genre line omitted |
| tagline empty | Tagline omitted |
| character empty | Character line omitted; name only |
| `profile_path` null | Avatar initials fallback |

Runtime format: under 60 min "45m"; exactly on the hour "2h"; otherwise "2h 28m". Rating: `vote_average` to one
decimal. Long text: the title clamps to 3 lines with an ellipsis; tagline, synopsis and genres wrap in full;
cast name and character clamp to 2 lines each.

### Copy (verbatim, Build 13)
| Where | Text |
|---|---|
| Back chip, `accessibilityLabel` | Back |
| Synopsis heading | Synopsis |
| Cast heading | Cast |
| Lounge heading | #spoiler-free-lounge |
| Lounge subline | Chat about this movie without spoilers. |
| Lounge sample 1 | CineOwl / Just finished it. No spoilers, but wow. |
| Lounge sample 2 | ReelMara / Rewatching it this weekend. Who's in? |
| Lounge preview line | Preview only. Comments are coming soon. |
| Composer placeholder | Hoot your thoughts… |
| Composer Toast | Comments are coming soon. |
| Tier chip | 🏆 Tier |
| Tier popover title | Tier ratings |
| Tier popover body | Soon you'll rank the movies you've watched from S (best) down to C. Coming soon. |
| Rating chip | ★ {n.n} of 10 |
| Rating, no votes | Not rated yet |
| No synopsis | No synopsis available. |
| Loading, live region | Loading movie |
| Error title | Couldn't load this movie |
| Error body | Check your connection and try again. |
| Error action | Retry |
| Refetch error Toast | Couldn't refresh. Check your connection. |
| Not found title | Movie not found |
| Not found body | We couldn't find that movie. It may have been removed. |
| Not found action | Back to Home |

### Accessibility notes (Build 13)
- Back chip: button, "Back", 36 + `hitSlop` 6 = 48. The title is a header; Synopsis, Cast and the lounge heading
  are headers. Reading order: back, title, meta, genres, rating, tier chip, tagline, synopsis, cast, lounge.
- Rating chip: one accessible element, label "Rated 8.4 out of 10 on TMDB" (no votes: "Not rated yet on
  TMDB"); the star glyph is not read separately.
- Tier chip: button, label "Tier rating", hint "Opens an explanation. Tier ratings are coming soon." The
  popover has `accessibilityLiveRegion="polite"`.
- Poster: label "Poster for {title}", role image. Backdrop: decorative
  (`importantForAccessibility="no-hide-descendants"`).
- Cast row: `accessibilityRole="list"`; each item is one element labelled "{name} as {character}" (name only
  with no character); avatars decorative.
- Composer: `accessibilityRole="button"`, label "Hoot your thoughts", hint "Comments are coming soon". Not
  `disabled` (it answers with a Toast).
- Every control is at least 48 dp (chips via `hitSlop`, composer 48, Retry 48). Gear zone (top-right 64x64):
  empty; the chip is top-left and the compact bar's title stops 72 from the right edge.
- Contrast: `text.primary` and `text.secondary` on `bg.base` as in §1.5; gold "Tier" text on `surface.input`
  about 4.7:1 (bold 15); the placeholder `text.disabled` sits on a not-focusable composer, and the preview
  line next to it uses `text.secondary`.

### Build 13 · QA amendments (Dianne, 2026-10-02)
Decisions from QA evidence (`logs/evidence/build-13/`). No board change is needed; these are exact values for Bella's Bug round.

**New tokens (add to §1.9):** `colors.overlay.topScrimStart` = `rgba(18,16,22,0.72)` (`bg.base` at 72%);
`size.detailsScrimHeight` = 72 (added to the top inset); `size.detailsToastOffset` = 24; `size.detailsBottomPad` = 80.

1. **Status bar over a bright backdrop (05p): top scrim, status bar stays light.** One fixed (non-scrolling)
   `LinearGradient`, absolute at the top of the screen, full width, height = top inset + `size.detailsScrimHeight`
   (72), from `colors.overlay.topScrimStart` at 0% to `colors.overlay.fadeStart` at 100% (top to bottom),
   `pointerEvents="none"`, decorative, drawn above the scroll content and below the Back chip. It covers the
   status bar, the Back chip (inset + 8 to inset + 44) and the 64x64 gear zone. Rendered only in the loaded state
   (the other states have no backdrop). It fades out in the same 150 ms as the compact bar fades in (opacity 1 at
   offsets under `size.detailsBarShowAt`, 0 after), since the solid bar then guards the status bar. Keep the
   light status-bar style; no dark-icon switch.
2. **Toast on details (09c): low, in empty space below the lounge card (revised after device check).** The toast
   never covers the composer, its "Preview only" line or the card. Two values, both measured from the bottom
   inset: the details scroll's bottom content padding is bottom inset + `size.detailsBottomPad` 80 (replaces the
   old 32 in Layout "Bottom"), and the Toast sits at bottom inset + `size.detailsToastOffset` 24 (the same 24 as
   on tab screens, no tab bar here). Scrolled to the end: the card's last 4 dp padding, then 80 of empty space
   under it (composer bottom = inset + 84 from the screen edge); the Toast (about 42 high: 12/16/12 padding +
   1px borders) spans inset + 24 to inset + 66, leaving 18 dp clear of the composer. One rule for both details
   Toasts (composer "coming soon" and refetch error); mid-scroll it simply floats over content, which is
   normal Toast behaviour.
3. **Lounge messages (ui-lounge, 05n/05p): the board is right; the code is wrong.** Stacked, not inline. Row =
   `Avatar sm` (32) at left, 10 gap, then a column: author on its own line (`small` 12/16, 600, `accent.gold`),
   then the message below it (12/18, `text.primary`, wraps). Rows align to the top (`alignItems: flex-start`),
   12 between rows. The initial-letter avatar (Avatar's `fallback-initials`) is correct for the sample authors;
   the board's gradient circle was only a stand-in.
4. **Skeleton bar heights (09b).** All bars radius 6, `bg.elevatedFlat`-based pulse as in Build 12. Title bars
   24 (gap 8); meta bar 14; genre bar 12; tagline bar 14; "Synopsis" and "Cast" heading bars 24; synopsis text
   bars 14 high with 8 between (last bar 60% wide); cast name bar 12 (72 wide) and role bar 12 (52 wide), 6
   apart, 8 under the avatar circle. Bella's 16 / 12 / 10 are replaced by 14 / 12 / 12; 12 and 14 were already
   the board's values.
5. **Cast avatar while the photo loads (02b).** The slot is never blank: `Avatar` always draws its
   `fallback-initials` look first (existing fallback fill plus initials) and the photo fades in over it
   (`motion.imageFade` 200 ms) when `onLoad` fires. If the photo fails or `profile_path` is null the initials stay.
   No new token or shimmer. This is a general `ui/Avatar` rule (Home avatar, Profile, Blocked users), so do it in
   the shared component, not in the cast row.

---

## Build 14 — Quick Add tab: full-bleed swipe deck (Module 5; also covers Builds 15, 16a, 16b)

One Phase 0 for the whole Module (PLAN M11). Builds 15 and 16 have no Phase 0 of their own; their sections follow
this one. 16a is database only.

**Revised 2026-10-02 after two decisions by Justin (PLAN N1):** Quick Add is a **tab in the bottom bar** (Perch ·
Quick Add · Profile), not a Home row, and the deck is **full screen** (the poster fills the content area). This text
replaces the first version (a Home row opening a full-screen route with a back chip and a card with side margins).

Boards (source in `design-src/`, drawn at 390 x 844 with a 28 top inset, 24 bottom inset and the 74 dp tab bar; the
numbers below come from the insets and the measured layout, not from the boards). Canvas: not published.
| File | Shows |
|---|---|
| `build-14-tab-bar` | Home (filled, error) with the three-tab bar; the tab states and measures |
| `build-14-deck-states` | deck loading, filled, error + offline, caught up |
| `build-14-deck-states-2` | loading with the progress line, keep-going, next page failed with no cards left, filled after a swipe (Undo ready) |
| `build-14-deck-drag` | DURING the drag: right 15% (no stamp), right 30% (ADD), left 30% (SKIP), the Add button 100 ms into the exit |
| `build-14-deck-parts` | cards with no poster and a long title, no year and no rating, rating only; the controls in every state |
| `build-14-deck-toasts` | the five Toasts in place (top of the screen) |
| `build-14-deck-motion` | frames: normal exit, reduced-motion exit, spring back, reduced ease-back, card returns |
| `build-15-picker`, `build-15-picker-states` | the order picker (3 selections, switching, caught up, spec) |
| `build-16b-profile-count` | Profile count: loading, one, many, failed |
(`build-14-home-entry` is retired: the Home row no longer exists. Home is back to Build 12's layout: Roulette card, then
the "Popular right now" title and grid; nothing from Build 12 changes.)

**Decisions (Dianne, 2026-10-02)**
- **Quick Add is a tab, the deck is a tab screen.** Route `(tabs)/quick-add.tsx`; the tab bar stays visible; **no back
  chip**; the header is a plain title, drawn over the poster (below).
- **The poster is the screen.** The top card is the whole content area, edge to edge, from the top of the screen
  (under the status bar) down to the tab bar: no side margin, no radius, no border, no stack peeking at the sides or
  below. The "next card" is the next poster revealed underneath while the top one moves.
- **Everything else floats over the poster on scrims:** header and picker on a top scrim, title/year/rating on the bottom
  band, Skip / Undo / Add on a bottom dock. The scrims are fixed; only the card moves.
- **Toasts go to the top** (just under the header or picker), because the bottom of the screen is the band, the
  controls and the tab bar, and a bottom Toast would cover one of them.
- **Undo stays reachable when the deck is empty** (caught up, keep-going, next page failed).
- Gesture numbers (commit 35%, flick, slop) are unchanged (PLAN M4), so the swipe feels the same as before; only the
  visuals around it changed.

### Tab bar and flow (§2 TabBar, §3)
Tab order: **Perch · Quick Add · Profile** (`build-14-tab-bar`). The bar is the shipped one (flat `bg.elevatedFlat` plus the
`glass.nav` tint on Android, 1px `border.hairline` on top; 8 top padding, icon line 26, gap 2, label 14, plus the real
bottom inset: 74 dp at a 24 dp inset). Three equal tabs; the whole tab is the touch target.
- **Quick Add tab:** route `quick-add` (file `(tabs)/quick-add.tsx`), glyph **🃏** at `iconSize.tab` 20, label **"Quick Add"**
  (`type.micro` 11, one line; about 48 dp wide, fits a 130 dp tab), accessibility label "Quick Add". `TAB_META` gains
  `"quick-add": { icon: "🃏", label: "Quick Add" }`.
- **States, like the other two tabs:** active = icon opacity 1, label `accent.gold`; inactive = icon opacity 0.6, label
  `text.secondary`; `accessibilityState.selected` on the active tab.
- **Tapping the Quick Add tab while already on it does nothing** (no scroll, no reset, no reload); the shipped `TabBar`
  already ignores a press on the focused tab. Switching away and back keeps the deck exactly as it was (the tab stays
  mounted): same top card, same order, same Undo history.
- Opening a movie from the deck pushes `movie/[id]` over the tabs (the tab bar is covered there, as on any push); Back
  returns to Quick Add and the same top card. Deep link `perchable://quick-add` selects the tab (no back history needed).
- Gear zone: the top-right 64 x 64 is empty on this screen (title right inset 72).

### Layout (dp; 390 x 844, insets 28 / 24; the content area is 390 x 770: `window height - tab bar`, measured)
Draw order, back to front: **cards** (the whole content area) · **top scrim** · **header** (and picker) · **dock** ·
**controls** · **Toast** (top).
1. **Card = the content area.** Width = screen width, height = content height (770 here), at (0, 0). No radius, no
   border. (The earlier size formula with `k`, the 24 dp side margin and the 20 dp stack reserve is removed.)
2. **Poster crop.** `expo-image` `w780` (780 x 1170, 2:3), `contentFit="cover"`, centred. At 390 x 770 the poster scales to
   770 high and 513 wide, so **61.7 dp (12%) is cut from each side, 24% of the width in all; the full height is kept and
   the centre stays**. In general, when `width / height` is below 2/3 the cut is `1 - (width / height) / (2/3)` of the
   poster width, split over both sides. Titles printed on posters are usually centred, so they survive; the bands below
   cover the bottom 15 to 25% anyway.
3. **Header (floating):** `paddingTop` = top inset; row 48. Title "Quick Add": `subhead` 19/24, `text.primary`, one line,
   left 20, right `size.homeHeaderInset` 72, top = inset + 12, `accessibilityRole="header"`. No chip. Header bottom = inset + 48 (76).
4. **Picker (Build 15 only):** left/right 20, top = header bottom + 8 (84), 50 high (floating bottom = 134).
5. **Top scrim:** one fixed `LinearGradient`, absolute at the top, full width, above the cards and below the header and
   picker, `pointerEvents="none"`, decorative. Height = floating bottom (header, or picker when present) +
   `size.deckTopScrimFade` 24. Colour `overlay.topScrimStart` (`rgba(18,16,22,0.72)`) held down to the floating bottom,
   then fading to `overlay.fadeStart` over the last 24. It covers the status bar, the title, the picker and the gear zone.
   (The Build 13 scrim fades from the very top; this one holds because the title and picker text need about 6:1 over a
   white poster.)
6. **Dock (fixed):** the measured dock height (`deckControlsPad` 16 + controls height + 8; 102 at default font scale) at the bottom of the content area, solid `overlay.cardInfo`
   (`rgba(18,16,22,0.88)`). Height = `deckControlsPad` 16 + controls height + 8 on top = **102** at font scale 1
   (measured). It holds the controls; it does not move with the card.
7. **Controls (fixed):** one row, centred, bottom = 16 above the tab bar. At 390 x 844: y 676 to 754. Spec below.
8. **Info band (part of the card):** bottom edge = the dock's top edge (y 668 here), so the title, year and rating never sit
   under the controls: a 40 dp `LinearGradient` (`overlay.fadeStart` to `overlay.cardInfo`, `size.deckInfoFade`) over a solid
   `overlay.cardInfo` block, padding 0 / 20 / 16 / 20. Title `title` 24/30 Poppins 800, `text.primary`, max 2 lines,
   ellipsis (emoji and right-to-left titles must not break it); 4; meta row 22 high, 12 between parts: **year**
   (`bodyStrong` 15/22, `text.secondary`) and **rating** ("★" `accent.gold`, then "8.2", `bodyStrong`, `text.primary`).
   Year rule as Build 12 (first four digits of `release_date`, else omitted). Rating is drawn when `vote_average` is above
   0, to one decimal. Both missing: the meta row is not drawn (never "NaN", "0" or blank); a lone part shows alone.
   The band moves with the card; the dock does not, and since the dock and the band are the same colour and edge, the
   bottom of the screen looks solid while a card moves.
9. **No poster / image failed:** fill `colors.brand.purple900`, 🎬 at `iconSize.deckFallback` 56 centred in the area above
   the band; title and meta stay. While the image loads: `PosterCard`'s loading fill (`bg.elevatedFlat`, `usePulse`,
   `overlay.shimmerWash`), then a `motion.imageFade` 200 ms fade-in. Never a blank card.
10. **Stamp and tint** (drag only; decorative, `importantForAccessibility="no"`):
   - ADD: left 20, **top `deck.stampTop` 224** (below the picker and a 2-line Toast), rotated -14 degrees; text "ADD" in
     `display` 30/36 Poppins 800, `letterSpacing.label`, `accent.gold`; box padding 4 / 14, `size.stampBorder` 3 border in
     `accent.gold`, radius `sm` 12, fill `overlay.scrim`.
   - SKIP: right 20, top 224, rotated +14, same box in `danger`.
   - Tint: a full-card layer, `overlay.addTint` for a right drag, `overlay.skipTint` for a left drag.
   - Opacity of stamp **and** tint: `s = clamp((|dx| / W - 0.15) / (0.30 - 0.15), 0, 1)`: 0 up to 15% of the screen width
     (58 dp at 390), 1 from 30% (117 dp), linear between. The commit threshold is 35% (136.5 dp), so the stamp is full
     before the card would commit.
11. **Pressed (tap):** scale `motion.pressScale` 0.98 on the card; the tap opens details.

### The drag, the stack and the exit (`build-14-deck-drag`, `build-14-deck-motion`)
All distances are fractions of the screen width W (390 in the boards); `dx` is the horizontal translation.
- **Stack = two full-screen posters.** The top card, and the next card directly behind it at **scale 0.94** with a
  `overlay.deckDim` layer (`deck.stackScale` `[1, 0.94]`). At rest the next card is completely hidden behind the top one.
  Not focusable for screen readers.
- **While dragging** the top card follows the finger: x = `dx`; y = 0.3 x vertical movement, at most 40 (`deck.followY`,
  `followYMax`); it **tilts about its bottom centre** (`transformOrigin: "50% 100%"`) by `clamp(dx / (0.5 W), -1, 1) x 6`
  degrees (`deck.tiltMaxDeg` 6: 1.8 degrees at 59 dp, 3.6 at 117, 6 from 195; a full-height card swings its top about 12
  dp per degree, so 6 is already a lot). Stamp and tint as above.
- **What the user sees during the drag:** the poster slides and tilts; the next poster shows in the space it leaves,
  growing from 0.94 to full size and brightening as the top card goes: with `p = min(|dx| / (0.35 W), 1)` the next card is
  `scale 0.94 + 0.06 p` with dim layer opacity `1 - p` (at 15%: p 0.43, dim 0.57; at 30%: p 0.86, dim 0.14). The header,
  scrim, controls and tab bar do not move. The ADD or SKIP stamp and the tint appear on the moving card from 15%.
- **Activation and commit (PLAN M4):** pan starts after 10 dp horizontal movement and fails on 20 dp vertical movement
  first; commit at 35% of W, or release speed at least 800 dp/s in the direction of the move **and** at least 40 dp moved;
  otherwise it springs back. Constants live in `decideSwipe.ts`.
- **Commit (swipe or button, same exit):** the card leaves in its own layer to x = +/-(W + `deck.exitMargin` 24) = +/-414 from
  its resting position, tilting to 6 degrees, **200 ms** (`motion.deckExit`), `Easing.out(Easing.quad)` (75% of the way at
  100 ms), the stamp fading to 1 over the same time (so a flick and a button press both show ADD or SKIP). A button
  starts from dx 0. At the same time the next card becomes the top (scale to 1, dim to 0) and **the new top card is
  interactive at once**; a new next card mounts behind it, hidden (no fade needed). Mounted: top, next, leaving = three at
  most. A new commit while a card is still leaving jumps that card to its end position first.
- **Below the threshold:** `withSpring` (`motion.deckSpring`: damping 20, stiffness 260, mass 1), one overshoot of about
  8% (10 dp from 117), at rest in about 400 ms; stamp and tint follow `dx` back to 0.
- **Held return:** a card that comes back (Undo, a failed add) while the user is dragging another is held and shown only
  after that drag ends. It appears on top over `motion.deckExit` 200 ms, opacity 0 to 1 and scale 0.92 to 1
  (`deck.returnScale`); instant under reduce motion.
- **Reduce motion** (`useReduceMotion`: RN `AccessibilityInfo.isReduceMotionEnabled` plus the change listener; every
  animation sets `reduceMotion: ReduceMotion.Never`): the card still follows the finger; **no tilt, no fly-off, no scale on
  the next poster** (it stays at 0.94, dimmed). A commit fades the leaving card out in place in **150 ms**
  (`motion.deckFade`) while the next card is already on top at full size. A release below the threshold eases back in
  **150 ms**, `Easing.out(Easing.quad)`, no overshoot. Stamp and tint are opacity, not motion, and stay. One swipe per
  action either way. A returning card appears at once.
- **No haptics** (PLAN N6).

### Controls (`build-14-deck-parts`)
One row on the dock: **Skip, Undo, Add**. Each is one pressable column, **56 wide x 78 high** at font scale 1 (touch target
56 x 78): the column's label (`caption` 12/16, `text.secondary`) is pinned to the bottom and the circle is centred in the
56 dp above it, so all three labels share one baseline and the circles one centre line.
| Control | Circle | Fill and border | Glyph | Label read by TalkBack |
|---|---|---|---|---|
| Skip | 56 | `bg.elevatedFlat`, 1px `border.danger` | "✕" `danger`, 22/24 Inter 600 | Skip {title} |
| Undo | 48 | `surface.input`, 1px `border.hairlineStrong` | "↶" `colors.brand.lavender200` | Undo |
| Add | 56 | `accent.gold`, 1px `accent.gold` | "✓" `text.onGold` | Add {title} to collection |
- Gap between columns `size.deckControlsGap` 28; bottom = `size.deckControlsPad` 16 above the tab bar.
- **Pressed:** opacity 0.85 (as `Button`). **Disabled:** `opacity.disabled` 0.5 and `accessibilityState.disabled`.
- **When enabled:** Skip and Add: there is a top card and no card is mid-exit (a double tap is one swipe). Undo: there is
  something to undo and the deck is filled, caught up or in the keep-going state; disabled while loading and on the error
  screen, and after one Undo until the next swipe. The row and the dock are always drawn (no jump between states).
- Glyphs are plain text like "←" and "★". If one shows as a box on the emulator, Queenie reports it and Bella swaps that
  glyph, not the layout.

### Deck states (`build-14-deck-states`, `build-14-deck-states-2`)
The header (and picker), scrims, dock, controls and tab bar are drawn in every state.
| State | What shows |
|---|---|
| Loading (first load, or a changed order) | A **full-bleed shimmer** over the content area (`bg.elevatedFlat`, `usePulse`, `overlay.shimmerWash`) with two shimmer bars where the title and meta go (24 high x 240 wide, 14 x 140, radius 6, `overlay.shimmerWash`, just above the dock). Controls disabled. One polite live region "Loading movies". |
| Loading + progress line | After 3 all-seen pages in one load: the same shimmer plus a centred `Spinner lg` and the line "Finding movies you haven't seen…" (`body` 15/22, `text.secondary`, centred, padding 24, centred in the area above the dock). The live region then reads the line. |
| Filled | Top card, next card behind, controls. |
| Error (first load failed) and **offline cold start** | Plain `bg.base` (with the usual backdrop). `EmptyState` 🦉 "Couldn't load movies" / "Check your connection and try again." / Retry, centred between the header (or picker) bottom + 8 and the dock top. A double tap on Retry sends one request. Controls disabled. This is also the offline state; there is no separate offline screen. |
| Keep-going (15 pages in a row all seen, more exist) | `EmptyState` 🔎 "Still looking" / "We skipped past a lot of movies you've already seen. There may be more." / "Keep looking". Tapping resumes where the loop stopped. Undo enabled. |
| Next page failed, no cards left | `EmptyState` 🦉 "Couldn't load more movies" / "Check your connection and try again." / Retry (resumes). Undo enabled. While cards remain a failed next page shows nothing and the user keeps swiping. |
| Caught up (no cards, no next page, after the retry from page 1) | `EmptyState` 🎉 "You're all caught up" / "You've been through this whole list. Start over to see the movies you skipped again." / "Start over" (clears the saved skips and reloads). Undo enabled. |
| Offline mid-deck | No visible change: loaded cards keep swiping, posters not cached show the no-poster fallback, a failed add shows its Toast (16b). |

### Toasts (`build-14-deck-toasts`)
The bottom of this screen is the info band, the dock and the tab bar, so a bottom Toast would cover text or a button. On
this screen the Toast is at the **top**: `Toast` gets a `position?: 'bottom' | 'top'` prop (default 'bottom', all other
screens unchanged); with `position="top"` it is pinned `offset` below the top of the screen, **offset = the floating
bottom + 12** (header bottom 76 + 12 = 88, or picker bottom 134 + 12 = 146; measured, so it follows large fonts). It never
covers the header, the picker, the controls, the dock or the tab bar; it may cover the top of the poster for 2.5 s, which
is the point of a toast. A 2-line Toast is 58 high (68 at the 1.3 font cap): it ends at 88 + 58 = 146 (156) without the picker and at
146 + 58 = 204 (214) with it, always above the stamps (top 224). The tab-screen rule "24 dp above the tab bar" does not apply
to this screen for that reason (24 above the tab bar is y 746, inside the controls).
- Side margins 20, text cap 1.3, 2.5 s, as everywhere (§2 Toast).
- **{title} in any Toast is wrapped in curly quotes** (“{title}”) and is at most 28 characters: a longer title is cut to 27
  characters plus "…" inside the quotes (“The Lord of the Rings: The…”), so a cut title never meets the sentence's full stop and
  the reason at the end is never cut off.

### Copy (verbatim, Builds 14, 15, 16b)
| Where | Text |
|---|---|
| Tab label / `accessibilityLabel` | Quick Add / Quick Add |
| Deck header title | Quick Add |
| Controls, labels | Skip / Undo / Add |
| Controls, `accessibilityLabel` | Skip {title} / Undo / Add {title} to collection |
| Stamps | ADD / SKIP |
| Loading, live region | Loading movies |
| Progress line (also the live region then) | Finding movies you haven't seen… |
| Error title / body / action | Couldn't load movies / Check your connection and try again. / Retry |
| Keep-going title / body / action | Still looking / We skipped past a lot of movies you've already seen. There may be more. / Keep looking |
| Keep-going action, `accessibilityLabel` | Keep looking for more movies |
| Next page failed title / body / action | Couldn't load more movies / Check your connection and try again. / Retry |
| Caught up title / body / action | You're all caught up / You've been through this whole list. Start over to see the movies you skipped again. / Start over |
| Caught up action, `accessibilityLabel` | Start over and show skipped movies again |
| Toast, Build 14 right swipe or Add (`coming-soon`) | Adding to your collection is coming soon. |
| Toast, 16b add failed, offline or timeout (`error`) | Couldn't add “{title}”. Check your connection. |
| Toast, 16b add failed, anything else (`error`) | Couldn't add “{title}”. Try again later. |
| Toast, 16b undo failed, offline or timeout (`error`) | Couldn't undo. Check your connection. |
| Toast, 16b undo failed, anything else (`error`) | Couldn't undo. Try again later. |
| Toast, a held card returns (`info`) | “{title}” is back |
| Announcement, left swipe or Skip | Skipped {title} |
| Announcement, right swipe or Add, 16b | Added {title} |
| Announcement, Undo | Undid skip for {title} / Undid add for {title} |
| Announcement, card returns after a failed add or a held return | {title} is back |
| Picker group, `accessibilityLabel` | Movie order |
| Picker options | Newest first / Oldest first / Random |
| Profile count | {n} movies watched / 1 movie watched / — movies watched (failed) |
| Profile count failed, `accessibilityLabel` | Movies watched, unavailable |

A held return from Undo shows the info Toast “{title}” is back; a rolled-back add shows its error Toast instead (the
reason is the news) and announces "{title} is back" for screen readers only.

### Accessibility (Build 14)
- **Card:** one accessible element, role button, label "{title}, {year}" (title only with no year), hint "Opens details".
  `accessibilityActions`: "Open details" (opens details), "Skip", "Add" (the screen reader's actions menu runs the same
  commit as the swipe or the button). The tap opens details through the double-tap-safe push.
- **Controls:** labels in the table above; every column 56 x 78. Reading order: title, [picker], card, Skip, Undo, Add
  (then the tab bar).
- **After any commit** the result is announced (copy table) and **screen-reader focus moves to the new top card**. In Build
  14 a right swipe or Add announces only the Toast text (the Toast is a polite live region; no second announcement). From
  16b it announces "Added {title}".
- **A returning card** takes screen-reader focus and announces "{title} is back".
- **The next card, scrims, dock background and stamps:** `importantForAccessibility="no-hide-descendants"` / `"no"`.
- **Nothing depends on colour alone:** stamps carry the words ADD and SKIP; controls carry labels; the picker's selected
  option has a border and brighter text.
- **Contrast:** header title `text.primary` on the top scrim over the worst-case white poster about 6:1; the picker is an
  opaque `bg.elevatedFlat` bar (`text.secondary` on it about 8:1); `text.primary` on `overlay.cardInfo` over a white poster
  about 8:1, `text.secondary` about 6:1; `danger` glyph on `bg.elevatedFlat` about 8:1; `text.onGold` on `accent.gold`
  about 5.6:1; gold "★" on the band about 5:1.
- **Font scale:** the card is full-bleed so it does not change; the title wraps (2 lines); the controls grow with their labels
  and the dock and band follow the measured height; the top scrim and the Toast offset follow the measured header and
  picker height.
- **Gear zone:** the top-right 64 x 64 is empty (title right inset 72; the picker starts at y = inset + 56).

---

## Build 15 — Selectable swipe sequence (Module 5)

Board: `build-15-picker` (Newest, Oldest, Random, switching) and `build-15-picker-states` (caught up with the picker, spec).
**Where it lives:** floating over the top of the poster, under the "Quick Add" title, on the top scrim; **never in the
top-right corner** (PLAN M1). It does not change the card (the card is always the whole content area); it only makes
the scrim, the empty-state area and the Toast offset 58 dp taller.

- **Picker (`quick-add/components/SequencePicker`):** a radio group, label "Movie order". Container: left 20, right 20,
  top = header bottom + 8, **50 high** (48 segments + 1px border each side), radius `pill`, **fill `bg.elevatedFlat`
  (opaque, so it reads over any poster)**, 1px `border.hairline`. Three equal segments (thirds), each **minimum 48 high**,
  radius `pill`, label `bodyStrong` 15/22, centred, wraps to 2 lines at large font sizes (the bar grows).
- **Options, in order:** "Newest first", "Oldest first", "Random". First use selects Newest first.
- **Selected:** fill `surface.goldTint`, 1px `border.gold`, label `text.primary`. **Unselected:** no fill, `text.secondary`.
  **Pressed:** opacity 0.85. Selecting the selected option does nothing.
- **Accessibility:** role radio group; each option role radio with `selected` and `aria-posinset` / `aria-setsize`. If
  TalkBack does not read the position, add ", 1 of 3" to the label (Bella tests it). Announcement on change: the new order's
  name selected.
- **Switching order:** the old order's cards leave at once and the deck shows the full-bleed loading state (the picker stays
  enabled, so a second tap is allowed; the controls are disabled). Then the new order's first card.
- **Caught up, error, keep-going:** the picker stays visible and usable in every state; the `EmptyState` is centred between the
  picker's bottom + 8 and the dock.
- Copy: in the Build 14 copy table. Remembered per user on the device (PLAN M3).

---

## Build 16b — Add to the collection (Module 5; 16a is database only)

Board: `build-16b-profile-count`, and the add feedback is on `build-14-deck-drag` (frame D) and `build-14-deck-toasts`.
- **Added state:** there is no separate "added" screen. A right swipe or the Add button runs the Build 14 commit (the
  ADD stamp and gold tint, the 200 ms exit) and **the card does not come back**; no success Toast (the card leaving is
  the feedback), announcement "Added {title}". The Build 14 coming-soon Toast and its copy are deleted.
- **Add failed (network or timeout):** the card returns on top (200 ms fade and scale-in, or held until the drag ends)
  with the error Toast "Couldn't add {title}. Check your connection." Non-network (42501, 5xx, bad shape): "Couldn't add
  {title}. Try again later." A duplicate (23505) is a silent success: no Toast, no card.
- **Undo after an add:** the card returns on top; if the delete fails the add stays and the Toast says "Couldn't undo.
  Check your connection." (or "Couldn't undo. Try again later." for a non-network failure). Undo stays enabled.
- **First-load gate:** the deck stays in its loading state until the collection ids have loaded; a failed ids query is the
  deck's error state (Retry retries both).
- **Profile count (PLAN N9):** replaces the hard-coded "0 movies watched" in `(tabs)/profile/index.tsx`. Same slot and
  style as Build 6 (`caption`, `text.secondary`, 24 under the usertag chip, 12 above the grid container).
  | State | What shows |
  |---|---|
  | Count loading (profile loaded, collection ids not) | A shimmer bar `shimmerBar.line` 120 x 16 in the text's place (`bg.elevatedFlat`, `usePulse`); no layout jump. |
  | Count 0 | "0 movies watched" (a true zero from a successful read). |
  | Count 1 | "1 movie watched" (singular). |
  | Count 2 or more | "{n} movies watched"; 1,000 and above with a thousands separator ("1,284 movies watched"). |
  | Count failed | "— movies watched" (an em dash, never a number, never a false 0); `accessibilityLabel` "Movies watched, unavailable". |
  **Count failed recovery (Manager decision):** the count refetches whenever the Profile tab gains focus; the dash stays
  as is, with no extra tap target.
  The grid container below stays the dashed empty box until Build 19 fills it. The whole-profile loading and error states
  (Build 6) are unchanged.

---

## 8. Decisions (Manager, Build 0 round 1)

- **Light theme — no light theme in v1.** §1.3's light tokens stay in this
  doc for completeness/future use, but they are explicitly **not built** —
  no toggle UI, no theme-switch logic anywhere in v1. Single dark theme only.
- **Changes, 2026-09-30 (Justin, from the release-APK phone test):** "edit
  profile also should not be here, just the movies watched." My Profile loses
  its "Edit profile" and "Settings" rows; Edit profile is reached from the
  usertag chip (both states) and a new Settings row "Edit profile photo /
  usertag" — Build 6, 7, 9. Text supersedes board v6; board updated next time
  it's touched.
- Top-right icon inset (dev-gear zone) kept during development at Justin's
  choice (2026-09-30); revisit before the Play Store release.
- **Tier badges — no plan change.** S/A/B/C tiers stay UI-only per Justin's
  direction (§5); this is a note for whoever eventually specs a real ratings
  feature, not a gap to fix now. No PLAN.md revision, no Priya round.
- **Build 12 / 13 (Dianne, 2026-10-01):** N5 = 3 columns kept; details = full-screen push, no tab bar;
  Roulette and lounge cards flat on Android; Roulette button full strength (§5 revised); `EmptyState` action
  at least 48 high. Reasons in the Build 12 and Build 13 sections.
- **Changes, 2026-10-01 (Dianne, housekeeping from Builds 12a/12b):** (1) loading-more and next-page-error
  footers share `size.footerBlock` 88 dp, end-of-list stays `size.footerRow` 56 (Manager decision, Ruby PASS);
  (2) `spacing[14]` added to the scale; (3) `PosterCard` props `id` and `retryToken` recorded, `onPress` is
  Build 13; (4) shared `ui/Spinner` with tokens `spinner`, `spinnerLg`, `spinnerStroke`, `spinnerStrokeLg`
  (`GoogleSignInButton` keeps its own); (5) Toast offset rule: 24 dp above the tab bar on tab screens, bottom
  inset added inside a `Modal`. Sections: 1.7, 1.9, 2, Build 12.
- **Build 14 / 15 / 16b (Dianne, 2026-10-02, Module 5; revised after Justin's decisions: Quick Add is a tab, the deck is full-bleed):** deck is a tab
  screen whose poster fills the content area, with header, picker, band and controls floating on scrims and Toasts at the top (§1.5 revised); `SwipeDeckCard` is presentational and the
  gesture lives in `quick-add`; `BackChip` moves to `ui/` and `goBackOrHome` to `lib/`; `Toast` gets side margins and a 1.3
  font cap; Perchable-specific modules may import another module's `index.ts` (§4). Sections: 1.5, 1.9, 2, 3, 4, Builds 14, 15, 16b.
