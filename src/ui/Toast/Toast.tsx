import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { BottomTabBarHeightContext } from "expo-router/js-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, spacing, type } from "@/ui/tokens";

export type ToastVariant = "info" | "error" | "coming-soon";

const TOAST_DURATION_MS = 2500;

// Largest font scale the text follows, so a two-line message still fits the deck's reserved lane.
const TOAST_MAX_FONT_SCALE = 1.3;

type Props = {
  /** Null hides the toast. */
  message: string | null;
  variant?: ToastVariant;
  /** Distance above the bottom edge (plus the inset outside tabs); defaults to 24. */
  offset?: number;
};

/** Transient message pinned `offset` (24 dp by default) above the screen's bottom edge (DESIGN.md §2); never intercepts touches. */
export function Toast({ message, variant = "info", offset = spacing[24] }: Props) {
  const insets = useSafeAreaInsets();
  // On a tab screen the tab bar already sits on the system inset, so it is not added again.
  // A Toast inside a Modal still sees the tab context but covers the tab bar: it must be given the bottom inset.
  const insideTabs = useContext(BottomTabBarHeightContext) !== undefined;
  const bottomInset = insideTabs ? 0 : insets.bottom;
  if (message === null) return null;
  return (
    <View
      pointerEvents="none"
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.wrap, { bottom: bottomInset + offset }]}
    >
      <View style={[styles.toast, variant === "error" && styles.toastError]}>
        <Text maxFontSizeMultiplier={TOAST_MAX_FONT_SCALE} style={[styles.text, variant === "error" && styles.textError]}>{message}</Text>
      </View>
    </View>
  );
}

/** Holds the current toast message and variant and clears them after a short delay; a new `show` restarts the timer. */
export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const [variant, setVariant] = useState<ToastVariant>("info");
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Stops a pending dismiss from firing after the screen is gone.
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const show = useCallback((next: string, nextVariant: ToastVariant = "info") => {
    clearTimeout(timerRef.current);
    setMessage(next);
    setVariant(nextVariant);
    timerRef.current = setTimeout(() => setMessage(null), TOAST_DURATION_MS);
  }, []);

  return { message, variant, show };
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, marginHorizontal: spacing[20], alignItems: "center" },
  toast: {
    paddingVertical: spacing[12],
    paddingHorizontal: spacing[16],
    borderRadius: radius.sm,
    backgroundColor: colors.bg.elevatedFlat,
    borderWidth: 1,
    borderColor: colors.border.hairlineStrong,
  },
  toastError: { borderColor: colors.border.danger },
  text: { ...type.small, color: colors.text.secondary },
  textError: { color: colors.danger },
});
