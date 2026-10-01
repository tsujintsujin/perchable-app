import { Pressable, StyleSheet, Text, View } from "react-native";
import { Spinner } from "@/ui/Spinner";
import { colors, iconSize, radius, spacing, type } from "@/ui/tokens";

type Variant = "primary-gold" | "secondary-glass" | "ghost" | "destructive";

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  /** Text shown in the loading state instead of `label` — e.g. Save shows
   * "Save" idle but "Saving" while loading. Defaults to `label` for callers
   * that don't need the wording to change. */
  loadingLabel?: string;
  /** Screen-reader name when it should say more than the visible label. Defaults to `label`. */
  accessibilityLabel?: string;
  /** Extra spoken context for a control whose result is not obvious from its label. */
  accessibilityHint?: string;
  style?: object;
};

/** DESIGN.md §2: default/pressed/disabled/loading states, 4 variants. */
export function Button({
  label,
  onPress,
  variant = "primary-gold",
  disabled = false,
  loading = false,
  loadingLabel = label,
  accessibilityLabel = label,
  accessibilityHint,
  style,
}: Props) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant].container,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <View style={styles.loadingRow}>
          <Spinner diameter={iconSize.md} arcColor={colors.text.onGold} />
          <Text style={[styles.label, variantStyles[variant].label]}>{loadingLabel}</Text>
        </View>
      ) : (
        <Text style={[styles.label, variantStyles[variant].label]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 48,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[20],
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
  label: { ...type.bodyStrong },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: spacing[8] },
});

const variantStyles: Record<Variant, { container: object; label: object }> = {
  "primary-gold": {
    container: { backgroundColor: colors.accent.gold },
    label: { color: colors.text.onGold },
  },
  "secondary-glass": {
    container: {
      backgroundColor: colors.surface.input,
      borderWidth: 1,
      borderColor: colors.border.hairline,
    },
    label: { color: colors.text.primary },
  },
  ghost: {
    container: { backgroundColor: "transparent" },
    label: { color: colors.text.secondary },
  },
  destructive: {
    container: { backgroundColor: colors.danger },
    label: { color: colors.text.onGold },
  },
};
