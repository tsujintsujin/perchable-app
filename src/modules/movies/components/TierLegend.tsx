import { StyleSheet, Text, View } from "react-native";
import { TierBadge, TIERS } from "@/ui/TierBadge";
import { colors, elevation, lineHeight, radius, size, spacing, type } from "@/ui/tokens";

/** Static legend popover under the Tier chip: what S to C will mean. Nothing is stored or settable. */
export function TierLegend() {
  return (
    <View accessibilityLiveRegion="polite" style={styles.popover}>
      <Text style={styles.title}>Tier ratings</Text>
      <Text style={styles.body}>Soon you&apos;ll rank the movies you&apos;ve watched from S (best) down to C. Coming soon.</Text>
      <View style={styles.badges}>
        {TIERS.map((tier) => (
          <TierBadge key={tier} tier={tier} size="md" />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Floats under the chip row, its left edge offset from the content edge.
  popover: {
    position: "absolute",
    top: size.chipHeight + spacing[8],
    left: size.popoverOffset,
    width: size.popoverWidth,
    padding: spacing[16],
    borderRadius: radius.md,
    backgroundColor: colors.bg.elevatedFlat,
    borderWidth: 1,
    borderColor: colors.border.hairlineStrong,
    elevation: elevation.card,
  },
  title: { ...type.bodyStrong, color: colors.text.primary },
  body: { ...type.small, lineHeight: lineHeight.caption, color: colors.text.secondary, marginTop: spacing[4] },
  badges: { flexDirection: "row", gap: spacing[8], marginTop: spacing[12] },
});
