import { Pressable, StyleSheet, Text } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, iconButtonHitSlop, iconSize, radius, size, spacing } from "@/ui/tokens";

/** Leaves the details screen: back when there is history, otherwise (cold deep link) Home. */
export function goBackOrHome() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}

/** Floating back chip, top-left under the status bar; always above the scrolling content. */
export function BackChip() {
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      onPress={goBackOrHome}
      accessibilityRole="button"
      accessibilityLabel="Back"
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
