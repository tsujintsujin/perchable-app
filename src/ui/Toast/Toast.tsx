import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { BottomTabBarHeightContext } from "expo-router/js-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, spacing, type } from "@/ui/tokens";

export type ToastVariant = "info" | "error" | "coming-soon";

const TOAST_DURATION_MS = 2500;

type Props = {
  /** Null hides the toast. */
  message: string | null;
  variant?: ToastVariant;
};

/** Transient message pinned 24 dp above the screen's bottom edge (DESIGN.md §2); never intercepts touches. */
export function Toast({ message, variant = "info" }: Props) {
  const insets = useSafeAreaInsets();
  // On a tab screen the tab bar already sits on the system inset, so the screen ends above it; counting the inset again would float the toast too high.
  const insideTabs = useContext(BottomTabBarHeightContext) !== undefined;
  const bottomInset = insideTabs ? 0 : insets.bottom;
  if (message === null) return null;
  return (
    <View
      pointerEvents="none"
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.wrap, { bottom: bottomInset + spacing[24] }]}
    >
      <View style={[styles.toast, variant === "error" && styles.toastError]}>
        <Text style={[styles.text, variant === "error" && styles.textError]}>{message}</Text>
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
  wrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
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
