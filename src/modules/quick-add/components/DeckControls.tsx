import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { colors, iconSize, lineHeight, opacity, size, spacing, type } from "@/ui/tokens";

type Props = {
  /** Title of the top card, read out by Skip and Add; absent while there is no card. */
  title?: string;
  canSwipe: boolean;
  canUndo: boolean;
  onSkip: () => void;
  onUndo: () => void;
  onAdd: () => void;
  /** Reports the row's real height (it grows with the font scale). */
  onHeight: (height: number) => void;
};

// One control: a pressable column with the circle on top and its label pinned to the bottom, so all three labels share a baseline.
function Control({
  label,
  accessibilityLabel,
  glyph,
  disabled,
  onPress,
  circle,
  glyphStyle,
  small = false,
}: {
  label: string;
  accessibilityLabel: string;
  glyph: string;
  disabled: boolean;
  onPress: () => void;
  circle: StyleProp<ViewStyle>;
  glyphStyle: StyleProp<TextStyle>;
  small?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.column, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <View style={styles.circleSlot}>
        <View style={[styles.circle, small && styles.circleSmall, circle]}>
          <Text style={[styles.glyph, glyphStyle]}>{glyph}</Text>
        </View>
      </View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

/** The Skip, Undo and Add row under the deck. Always drawn; disabled while there is nothing to act on. */
export function DeckControls({ title, canSwipe, canUndo, onSkip, onUndo, onAdd, onHeight }: Props) {
  return (
    <View style={styles.row} onLayout={(event: LayoutChangeEvent) => onHeight(event.nativeEvent.layout.height)}>
      <Control
        label="Skip"
        accessibilityLabel={title ? `Skip ${title}` : "Skip"}
        glyph="✕"
        disabled={!canSwipe}
        onPress={onSkip}
        circle={styles.skipCircle}
        glyphStyle={styles.skipGlyph}
      />
      <Control label="Undo" accessibilityLabel="Undo" glyph="↶" disabled={!canUndo} onPress={onUndo} circle={styles.undoCircle} glyphStyle={styles.undoGlyph} small />
      <Control
        label="Add"
        accessibilityLabel={title ? `Add ${title} to collection` : "Add to collection"}
        glyph="✓"
        disabled={!canSwipe}
        onPress={onAdd}
        circle={styles.addCircle}
        glyphStyle={styles.addGlyph}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Three columns centred in a row, 28 apart.
  row: { flexDirection: "row", justifyContent: "center", alignItems: "flex-end", gap: size.deckControlsGap },
  // 56 wide and 78 high at font scale 1: circle slot 56, 6 gap, label 16; it grows with the label at larger font sizes.
  column: { width: size.deckButton, minHeight: size.deckControlsHeight, justifyContent: "flex-end", alignItems: "center" },
  pressed: { opacity: opacity.pressed },
  disabled: { opacity: opacity.disabled },
  // The circle is centred in a 56 slot, so the 48 Undo circle shares the 56 circles' centre line.
  circleSlot: { height: size.deckButton, width: size.deckButton, alignItems: "center", justifyContent: "center", marginBottom: spacing[6] },
  circle: { width: size.deckButton, height: size.deckButton, borderRadius: size.deckButton / 2, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  circleSmall: { width: size.deckButtonSm, height: size.deckButtonSm, borderRadius: size.deckButtonSm / 2 },
  glyph: { ...type.label, fontSize: iconSize.lg, lineHeight: lineHeight.subhead },
  skipCircle: { backgroundColor: colors.bg.elevatedFlat, borderColor: colors.border.danger },
  skipGlyph: { color: colors.danger },
  addCircle: { backgroundColor: colors.accent.gold, borderColor: colors.accent.gold },
  addGlyph: { color: colors.text.onGold },
  undoCircle: { backgroundColor: colors.surface.input, borderColor: colors.border.hairlineStrong },
  undoGlyph: { color: colors.brand.lavender200 },
  label: { ...type.caption, lineHeight: lineHeight.caption, color: colors.text.secondary },
});
