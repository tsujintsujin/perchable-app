import { useEffect, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius } from "@/ui/tokens";

type Variant = "primary-gold" | "secondary-glass" | "ghost" | "destructive";

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: object;
};

/** DESIGN.md §2: default/pressed/disabled/loading states, 4 variants. First
 * built for Build 7's Save/Cancel row. */
export function Button({
  label,
  onPress,
  variant = "primary-gold",
  disabled = false,
  loading = false,
  style,
}: Props) {
  const [spin] = useState(() => new Animated.Value(0));
  const isDisabled = disabled || loading;

  useEffect(() => {
    if (!loading) return;
    const animation = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 800, easing: Easing.linear, useNativeDriver: true }),
    );
    animation.start();
    return () => animation.stop();
  }, [loading, spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
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
          <Animated.View style={[styles.spinner, { transform: [{ rotate }] }]} />
          <Text style={[styles.label, variantStyles[variant].label]}>Saving</Text>
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
    paddingHorizontal: 20,
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
  label: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  spinner: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
    borderTopColor: colors.text.onGold,
  },
});

const variantStyles: Record<Variant, { container: object; label: object }> = {
  "primary-gold": {
    container: { backgroundColor: colors.accent.gold },
    label: { color: colors.text.onGold },
  },
  "secondary-glass": {
    container: {
      backgroundColor: "rgba(76,29,149,0.28)",
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
    container: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.danger },
    label: { color: colors.danger },
  },
};
