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
      edit.tsx                 Edit profile (Build 7)
      blocked-users.tsx        Blocked users list (Build 10b) — pushed from Settings
  movie/
    [id].tsx                   Movie details — pushed from Home/Search/Collection/deck
  quick-add.tsx                Quick Add swipe deck — pushed from Home, outside the tab bar (full-screen focus)
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
    social/       api/ components/ hooks/ types.ts index.ts   (follow, DM, comments — NOT block/report)
    moderation/   api/ components/ hooks/ types.ts index.ts   (OWNS all report, block and terms code: ReportSheet,
                                                               BlockUserSheet, BlockedUsersList, TermsScreen content,
                                                               useBlockUser, useBlockedUsers, useTermsGate,
                                                               OBJECTIONABLE_CATEGORIES; social/ never implements
                                                               these, it only imports them through moderation/index.ts
                                                               when a later Build needs a caller. Module README.md too)

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
    Home.

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
