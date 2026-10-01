/** Design tokens, DESIGN.md §1 as code — no component should hardcode a
 * color, blur, spacing or radius value that lives here. Dark-only for v1. */

export const colors = {
  brand: {
    purple900: "#2D0B59",
    purple700: "#4C1D95",
    gold500: "#B8860B",
    lavender200: "#D6C4E9",
    ink950: "#121016",
    tmdbBlue: "#01b4e4",
    tmdbNavy: "#0d253f",
  },
  bg: {
    base: "#121016",
    elevatedFlat: "#1E1A26",
  },
  text: {
    primary: "#F2EEF8",
    secondary: "#B3A9C4",
    onGold: "#121016",
    disabled: "#5C5666",
  },
  accent: {
    gold: "#B8860B",
    goldPress: "#D9A62A",
  },
  danger: "#FF8A8A",
  border: {
    hairline: "rgba(214,196,233,0.18)",
    hairlineStrong: "rgba(214,196,233,0.30)",
    danger: "rgba(255,138,138,0.35)",
    dangerStrong: "rgba(255,138,138,0.5)",
    gold: "#B8860B",
  },
  surface: {
    input: "rgba(76,29,149,0.28)",
    chip: "rgba(76,29,149,0.3)",
    dangerTint: "rgba(255,138,138,0.1)",
    goldTint: "rgba(184,134,11,0.16)",
  },
  overlay: {
    spinnerTrack: "rgba(255,255,255,0.3)",
    scrim: "rgba(18,16,22,0.6)",
  },
} as const;

/** DESIGN.md §1.4 — glass surface fills/borders. Real `BlurView` vs. flat
 * fallback is a per-call decision (§1.5's table), not part of the token. */
export const glass = {
  card: {
    backgroundColor: "rgba(76,29,149,0.32)",
    borderColor: colors.border.hairline,
    borderWidth: 1,
    blurAmount: 20,
  },
  hero: {
    backgroundColor: "rgba(76,29,149,0.35)",
    borderColor: colors.border.hairline,
    borderWidth: 1,
    blurAmount: 24,
  },
  nav: {
    backgroundColor: "rgba(30,26,38,0.55)",
    borderColor: colors.border.hairline,
    blurAmount: 30,
  },
  sheet: {
    backgroundColor: "rgba(30,26,38,0.65)",
    borderColor: colors.border.hairlineStrong,
    blurAmount: 34,
  },
  chip: {
    backgroundColor: "rgba(18,16,22,0.55)",
    blurAmount: 12,
  },
} as const;

export const spacing = {
  4: 4,
  6: 6,
  8: 8,
  10: 10,
  12: 12,
  16: 16,
  20: 20,
  24: 24,
  28: 28,
  32: 32,
  40: 40,
  48: 48,
  56: 56,
} as const;

export const radius = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

/** Icon glyph sizes — icons render as plain `Text`, so they need a size
 * scale separate from `type`'s text styles (no fontFamily to carry). */
export const iconSize = {
  sm: 13,
  md: 16,
  lg: 22,
  tab: 20,
  emoji: 32,
} as const;

/** Avatar circle diameters (DESIGN.md §2). */
export const avatarSize = { sm: 32, md: 48, lg: 88 } as const;

/** Square icon-button side (settings chip, back chip). */
export const size = {
  iconButton: 36,
  /** Minimum touch target side (dp). */
  minTouch: 48,
  /** Right inset that keeps a header chip clear of the dev-client gear corner. */
  headerTrailingInset: 44,
  /** Minimum height of the empty collection-grid container on My Profile. */
  collectionGridMin: 96,
  /** Bottom-sheet drag-handle bar. */
  dragHandle: { width: 40, height: 5 },
  /** Reason-row radio circle, its inner dot and its ring width. */
  radio: 22,
  radioDot: 10,
  radioRing: 2,
  /** Gold check badge on the "sent" / "blocked" sheet states. */
  badge: 56,
  /** Min height of the report "Something else" details box. */
  detailsInput: 96,
  /** Sheets never grow taller than this share of the screen; the body scrolls instead. */
  sheetMaxHeightRatio: 0.9,
} as const;

/** Extra touch area that grows an icon button to the minimum touch target. */
export const iconButtonHitSlop = (size.minTouch - size.iconButton) / 2;

/** Loading-skeleton bar sizes on My Profile (name line, usertag/count line). */
export const shimmerBar = {
  name: { width: 160, height: 22 },
  line: { width: 120, height: 16 },
  /** Blocked-users loading row: usertag line and Unblock button block. */
  tag: { width: 80, height: 12 },
  button: { width: 88, height: 48 },
} as const;

/** Loading-skeleton pulse: opacity range and the duration of each half-cycle (ms). */
export const shimmerPulse = { min: 0.4, max: 0.9, duration: 700 } as const;

/** Danger-tinted glow behind the delete-confirmation sheet (iOS shadow; Android draws none). */
export const dangerGlow = {
  shadowColor: colors.danger,
  shadowOpacity: 0.15,
  shadowRadius: 40,
  shadowOffset: { width: 0, height: 0 },
} as const;

/** TMDB logo chip on Settings > About, drawn as text: no logo asset is bundled. */
export const tmdbChip = {
  width: 22,
  height: 14,
  radius: 3,
  fontSize: 6,
  fontFamily: "Inter_600SemiBold",
} as const;

export const opacity = {
  disabled: 0.5,
} as const;

/** Letter spacing for uppercase section labels. */
export const letterSpacing = {
  label: 1,
  /** Spaced-out characters in the type-DELETE input. */
  input: 2,
} as const;

/** Line-height multipliers, applied to a type token's fontSize. */
export const leading = {
  relaxed: 1.5,
} as const;

export const elevation = {
  card: 4,
  raised: 8,
  modal: 12,
} as const;

/** DESIGN.md §1.6. `fontFamily` values match the keys `useFonts()` loads in
 * the root layout — see src/app/_layout.tsx. No `fontWeight`: on Android it makes a
 * single-weight custom family fall back to the system font. */
export const type = {
  micro: { fontSize: 11, fontFamily: "Inter_500Medium" },
  small: { fontSize: 12, fontFamily: "Inter_400Regular" },
  label: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  caption: { fontSize: 12, fontFamily: "Inter_500Medium" },
  body: { fontSize: 15, fontFamily: "Inter_400Regular" },
  bodyStrong: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  subhead: { fontSize: 19, fontFamily: "Poppins_700Bold" },
  title: { fontSize: 24, fontFamily: "Poppins_800ExtraBold" },
  display: { fontSize: 30, fontFamily: "Poppins_800ExtraBold" },
  hero: { fontSize: 38, fontFamily: "Poppins_800ExtraBold" },
  /** Dev-only harness text. */
  mono: { fontSize: 12, fontFamily: "monospace" },
} as const;
