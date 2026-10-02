import { Pressable, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, iconButtonHitSlop, iconSize, radius, size, spacing } from "@/ui/tokens";

type Props = {
  onPress: () => void;
  /** What a screen reader announces; the chip itself shows only the arrow. */
  label?: string;
};

/** Floating back chip, top-left under the status bar; always above the scrolling content. */
export function BackChip({ onPress, label = "Back" }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={iconButtonHitSlop}
      style={[styles.chip, { top: insets.top + spacing[8] }]}
    >
      <Text style={styles.icon}>←</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // 36 dp flat chip pinned at the left edge; the hit slop grows it to 48.
  chip: {
    position: "absolute",
    left: spacing[20],
    zIndex: 3,
    width: size.iconButton,
    height: size.iconButton,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg.elevatedFlat,
    borderWidth: 1,
    borderColor: colors.border.hairlineStrong,
  },
  icon: { fontSize: iconSize.md, color: colors.brand.lavender200 },
});
