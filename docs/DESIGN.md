# Perchable — DESIGN.md (Build 0)

Designer: Dianne. Direction: **A — Night Owl Arcade, glassmorphism** (picked
2026-09-24 from `docs/design-proposals.md`).
Canvas: https://claude.ai/artifact/M5TbevikF4q3dyGEh2S7XH (v2), board
"A — Night Owl Arcade (Glass, Build 0)". Sources:
`design-src/Proposal-A-Night-Owl-Arcade.dc.html`, `design-src/canvas.json`.

**Approval: pending — Justin adds his approval line here.**

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
| Home hero card (Perch Roulette) | Yes | static, one instance |
| `PosterCard` inside `FlashList` (Collection grid, Home carousels) | **No** — flat `bg.elevatedFlat`-based `rgba` fill, no blur | `expo-blur`'s own known-issue note: blur doesn't update correctly ahead of dynamic list content, and re-blurring N list rows on every scroll frame is the actual Android perf risk, not blur-on-static-chrome |
| `SwipeDeck` top card | **No** — flat `rgba(18,16,22,0.55)` fill behind title, per the mock | swipe gesture re-renders this view every frame during a drag; blur recompute per frame is the exact case to avoid |

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

| Spacing | 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 |
|---|---|
| Radius | `sm 12` (chips) · `md 16` (cards) · `lg 20` (hero cards) · `xl 28` (sheets) · `pill 999` |
| Elevation (Android `elevation` prop, opaque components only — glass surfaces use §1.4's glow/border instead of native elevation, since translucency + Android shadow looks muddy) | `card 4` · `raised 8` · `modal 12` |

---

## 2. Shared components

All live in `src/ui/` (see §4), each its own folder: `Component.tsx`,
`Component.styles.ts` (or inline `StyleSheet.create` in the same file for
small ones), `index.ts`.

| Component | Variants / props | States |
|---|---|---|
| `GlassBackdrop` | `blobs?: ('purple'\|'gold')[]` (decorative halo blur shapes) | static |
| `GlassCard` | `tier: 'card'\|'hero'\|'chip'`, `blur: boolean` (real BlurView vs. flat fallback — caller decides per §1.5 rule), `children` | default, pressed (scale 0.98) |
| `PosterCard` | `posterUrl`, `title`, `watched?: boolean`, `tier?: 'S'\|'A'\|'B'\|'C'`, `caption?: string`, `onPress` | loading (shimmer), loaded, error (fallback poster icon) |
| `Button` | `variant: 'primary-gold'\|'secondary-glass'\|'ghost'\|'destructive'`, `disabled?`, `loading?` | default, pressed, disabled, loading (spinner replaces label) |
| `TierBadge` | `tier: 'S'\|'A'\|'B'\|'C'`, `size: 'sm'\|'md'` | static — **UI shell, not functional in v1** (no tap handler; tapping opens a static legend popover only, see §5) |
| `TabBar` | fixed 5 items: Perch / Search / Chat / Leaderboards / Profile — `activeRoute` | per-tab active/inactive; **rendered on every tab screen** (`(tabs)/_layout.tsx`, not per-screen) |
| `ProfileSheet` | `userId`, `isSelf: boolean` | loading, loaded, error, not-found |
| `SwipeDeckCard` | `movie`, `onSwipeLeft`, `onSwipeRight` | idle, dragging, exiting-left, exiting-right |
| `Avatar` | `uri?`, `size: 'sm'\|'md'\|'lg'`, `ringGradient?: boolean` (purple→gold ring for own profile) | loaded, fallback-initials |
| `EmptyState` | `icon`, `title`, `body`, `action?: {label, onPress}` | one component, used by every data screen's empty case |
| `Toast` | `message`, `variant: 'info'\|'error'\|'coming-soon'` | shown, dismissing |

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
    index.tsx                  Home ("Perch") — roulette (UI-only), have-you-watched, friend activity
    search.tsx                 Search / Add movie (module: movies)
    chat/
      index.tsx                DM conversation list
      [conversationId].tsx     one DM thread
    leaderboards.tsx           Rankings (module: rankings)
    profile/
      index.tsx                own profile + My Collection grid
      settings.tsx             Account + About (TMDB attribution) — Screen 6
  movie/
    [id].tsx                   Movie details — pushed from Home/Search/Collection/deck
  quick-add.tsx                Quick Add swipe deck — pushed from Home, outside the tab bar (full-screen focus)
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
`quick-add`, and `user/` are non-tab stack routes reachable from any tab and
push over it — `TabBar` stays visible under `movie/` and `quick-add` (they're
plain pushed screens), but `user/[id]` as a `formSheet` covers it (matches
the mock: "feed dimmed behind modal").

---

## 4. Code structure

`tsconfig.json` maps `@/*` → `./src/*` (and `@/assets/*` → `./assets/*`), so
every folder below lives under `src/` — nothing reusable sits at repo root.

```
src/
  modules/                    reusable — PLAN.md §3, self-contained, no cross-module imports
    auth/         api/ components/ hooks/ types.ts index.ts   (Google sign-in, session, account deletion)
    profile/      api/ components/ hooks/ types.ts index.ts   (edit photo/usertag, ProfileSheet content)
    social/       api/ components/ hooks/ types.ts index.ts   (follow, DM, comments, block/report)
    moderation/   api/ components/ hooks/ types.ts index.ts   (report/block schema client, terms acceptance)

    movies/       api/ components/ hooks/ types.ts index.ts   (Perchable-specific: TMDB browse/search/details)
    quick-add/    api/ components/ hooks/ types.ts index.ts   (Perchable-specific: SwipeDeck logic/state)
    collection/   api/ components/ hooks/ types.ts index.ts   (Perchable-specific: captions, collection grid)
    rankings/     api/ components/ hooks/ types.ts index.ts   (Perchable-specific: leaderboard views)

  ui/                          shared design system — no business logic, no Supabase imports
    tokens.ts                  §1 as code: colors, glass, type scale, spacing, radius
    GlassBackdrop/ GlassCard/ PosterCard/ Button/ TierBadge/ TabBar/ ProfileSheet/
    SwipeDeckCard/ Avatar/ EmptyState/ Toast/   (each: Component.tsx, index.ts)

  lib/                         cross-cutting singletons, not modules
    supabase.ts                Supabase client
    queryClient.ts              TanStack Query client
    sentry.ts                   Sentry init

  app/                         routes ONLY — thin screens: compose ui/ + modules/, no fetching/business logic inline
                                (this is the §3 route tree — Expo Router's root)
```

Import as `@/modules/auth`, `@/ui/GlassCard`, `@/lib/supabase` — never a deep
relative path (`../../../modules/...`) out of `src/app/`.

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
| Perch Roulette | Home hero card | `Toast` (`variant: coming-soon`): "Smart picks are coming soon." Button is a real `Button` component in `disabled` visual state but still tappable (so the toast fires) — never a dead, unstyled tap target. |
| Tier badge (S/A/B/C) | Movie details, Collection `PosterCard` | Opens a small static legend popover (`GlassCard` chip: "S/A/B/C — Justin's rating tiers, coming soon") — no rating is settable or stored in v1. |
| `#spoiler-free-lounge` panel | Movie details | Panel renders with the mock's sample content (static, not from any comments table). The composer (`"Hoot your thoughts…"`) renders in `text.disabled`-styled, non-focusable state; **becomes real once Module 9 (Comments) ships** — this exact panel's composer is what Bella wires then, not a new component. |

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

---

## 8. Decisions (Manager, Build 0 round 1)

- **Light theme — no light theme in v1.** §1.3's light tokens stay in this
  doc for completeness/future use, but they are explicitly **not built** —
  no toggle UI, no theme-switch logic anywhere in v1. Single dark theme only.
- **Tier badges — no plan change.** S/A/B/C tiers stay UI-only per Justin's
  direction (§5); this is a note for whoever eventually specs a real ratings
  feature, not a gap to fix now. No PLAN.md revision, no Priya round.
