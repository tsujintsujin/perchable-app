import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, glass, iconSize, lineHeight, motion, radius, size, spacing, type } from "@/ui/tokens";

type Props = { onPress: () => void };

/** Home's Quick Add entry: a button-like row (flat fill, since it sits in a list header) that opens the deck. */
export function QuickAddRow({ onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Quick Add"
      accessibilityHint="Swipe through movies to add them to your collection"
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.icon}>
        <Text style={styles.iconGlyph}>🃏</Text>
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>Quick Add</Text>
        <Text style={styles.subline}>Swipe right to add, left to skip</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Row: icon tile, text column, chevron; grows with the font scale.
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: size.quickAddRow,
    paddingLeft: spacing[12],
    paddingRight: spacing[16],
    borderRadius: radius.md,
    backgroundColor: glass.card.backgroundColor,
    borderColor: glass.card.borderColor,
    borderWidth: glass.card.borderWidth,
  },
  pressed: { transform: [{ scale: motion.pressScale }] },
  icon: {
    width: size.quickAddIcon,
    height: size.quickAddIcon,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface.goldTint,
    borderWidth: 1,
    borderColor: colors.border.gold,
  },
  iconGlyph: { fontSize: iconSize.emoji },
  text: { flex: 1, marginLeft: spacing[12], marginRight: spacing[8] },
  title: { ...type.subhead, lineHeight: lineHeight.subhead, color: colors.text.primary },
  subline: { ...type.caption, lineHeight: lineHeight.caption, color: colors.text.secondary, marginTop: spacing[2] },
  chevron: { ...type.label, fontSize: iconSize.chevron, lineHeight: lineHeight.title, color: colors.text.secondary },
});
