import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, iconButtonHitSlop, iconSize, radius, size, spacing, type } from "@/ui/tokens";

export type Tier = "S" | "A" | "B" | "C";

/** The four tiers, best first. */
export const TIERS: readonly Tier[] = ["S", "A", "B", "C"];

type Props = {
  /** Absent renders the "Tier" chip used on movie details. */
  tier?: Tier;
  size?: "sm" | "md";
  onPress?: () => void;
};

// Fill, border and letter colour for each tier's letter badge.
const TIER_STYLES = {
  S: { backgroundColor: colors.accent.gold, borderColor: colors.accent.gold, color: colors.text.onGold },
  A: { backgroundColor: colors.surface.goldTint, borderColor: colors.border.gold, color: colors.accent.gold },
  B: { backgroundColor: colors.surface.input, borderColor: colors.border.hairlineStrong, color: colors.text.primary },
  C: { backgroundColor: colors.surface.input, borderColor: colors.border.hairline, color: colors.text.secondary },
} as const;

/** UI shell: a tier letter badge, or (no tier) the "Tier" chip that opens the legend. No rating is stored or settable. */
export function TierBadge({ tier, size: badgeSize = "md", onPress }: Props) {
  if (!tier) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Tier rating"
        accessibilityHint="Opens an explanation. Tier ratings are coming soon."
        hitSlop={iconButtonHitSlop}
        style={styles.chip}
      >
        {/* Own Text for the emoji: in one Text the chip lays out as two lines (emoji, then "Tier") and the second is clipped. */}
        <Text style={styles.chipIcon}>🏆</Text>
        <Text style={styles.chipLabel}>Tier</Text>
      </Pressable>
    );
  }
  const look = TIER_STYLES[tier];
  const dimension = badgeSize === "md" ? size.chipHeight : spacing[24];
  return (
    <View
      accessible
      accessibilityLabel={`Tier ${tier}`}
      style={[styles.badge, { width: dimension, height: dimension, backgroundColor: look.backgroundColor, borderColor: look.borderColor }]}
    >
      <Text style={[styles.letter, { color: look.color }]}>{tier}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Gold-outlined pill, 36 high; the hit slop makes it 48.
  chip: {
    height: size.chipHeight,
    flexDirection: "row",
    gap: spacing[6],
    paddingHorizontal: spacing[14],
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface.input,
    borderWidth: 1,
    borderColor: colors.border.gold,
  },
  chipIcon: { fontSize: iconSize.md },
  chipLabel: { ...type.bodyStrong, color: colors.accent.gold },
  badge: { borderRadius: radius.sm, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  letter: type.tierLetter,
});
