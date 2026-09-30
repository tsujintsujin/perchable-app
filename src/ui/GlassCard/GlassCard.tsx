import type { ReactNode } from "react";
import { Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { glass, opacity } from "@/ui/tokens";

type Tier = "card" | "hero" | "chip";

type Props = {
  tier?: Tier;
  /** Real BlurView vs. flat fallback fill — caller decides per DESIGN.md
   * §1.5's table (never inside a FlashList or gesture-driven re-render). */
  blur?: boolean;
  onPress?: () => void;
  /** Dims the card and ignores taps (e.g. while its action is running). */
  disabled?: boolean;
  /** Announced to screen readers as busy (a running action). */
  busy?: boolean;
  accessibilityLabel?: string;
  /** Extra touch area around the card, in dp. */
  hitSlop?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

export function GlassCard({ tier = "card", blur = false, onPress, disabled = false, busy = false, accessibilityLabel, hitSlop, style, children }: Props) {
  const t = glass[tier];
  // `glass.chip` has no borderColor in tokens.ts; every other tier does.
  // `in` narrows `t`'s union type directly, unlike a separate tier check.
  const borderColor = "borderColor" in t ? t.borderColor : undefined;

  const baseStyle: StyleProp<ViewStyle> = [
    styles.base,
    {
      backgroundColor: t.backgroundColor,
      borderColor,
      borderWidth: borderColor ? 1 : 0,
    },
    style,
  ];

  const content = (
    <>
      {blur && Platform.OS === "ios" && (
        // iOS only: without a BlurTargetView wired above this in the tree,
        // expo-blur's Android view paints `tint` as an opaque flat grey
        // instead of blurring — Android falls through to the flat fill.
        <BlurView intensity={t.blurAmount} tint="dark" style={styles.blurFill} />
      )}
      {children}
    </>
  );

  if (!onPress) {
    return <View style={baseStyle}>{content}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={hitSlop}
      accessibilityState={{ disabled, busy }}
      style={({ pressed }) => [
        baseStyle,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { overflow: "hidden" },
  blurFill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  pressed: { transform: [{ scale: 0.98 }] },
  disabled: { opacity: opacity.disabled },
});
