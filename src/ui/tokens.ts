/**
 * Design tokens — DESIGN.md §1, transcribed as code. No component should
 * hardcode a color, blur, spacing or radius value that lives here; use the
 * token instead (DESIGN.md §7 rule, Ruby checks this).
 *
 * v1 ships dark-only (DESIGN.md §1.2) — `colors` below IS the dark palette.
 * Light tokens (§1.3) aren't built; no toggle exists to select them.
 */

export const colors = {
  brand: {
    purple900: "#2D0B59",
    purple700: "#4C1D95",
    gold500: "#B8860B",
    lavender200: "#D6C4E9",
    ink950: "#121016",
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
  },
  surface: {
    input: "rgba(76,29,149,0.28)",
    chip: "rgba(76,29,149,0.3)",
  },
  overlay: {
    spinnerTrack: "rgba(255,255,255,0.3)",
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
  8: 8,
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

export const elevation = {
  card: 4,
  raised: 8,
  modal: 12,
} as const;

/** DESIGN.md §1.6. `fontFamily` values match the keys `useFonts()` loads in
 * the root layout — see src/app/_layout.tsx. */
export const type = {
  micro: { fontSize: 11, fontWeight: "500", fontFamily: "Inter_500Medium" },
  small: { fontSize: 12, fontWeight: "400", fontFamily: "Inter_400Regular" },
  label: { fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  caption: { fontSize: 12, fontWeight: "500", fontFamily: "Inter_500Medium" },
  body: { fontSize: 15, fontWeight: "400", fontFamily: "Inter_400Regular" },
  bodyStrong: { fontSize: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  subhead: { fontSize: 19, fontWeight: "700", fontFamily: "Poppins_700Bold" },
  title: { fontSize: 24, fontWeight: "800", fontFamily: "Poppins_800ExtraBold" },
  display: { fontSize: 30, fontWeight: "800", fontFamily: "Poppins_800ExtraBold" },
  hero: { fontSize: 38, fontWeight: "800", fontFamily: "Poppins_800ExtraBold" },
} as const;
