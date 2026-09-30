import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { GlassCard } from "@/ui/GlassCard";
import { colors, radius, spacing } from "@/ui/tokens";

type Props = {
  onPress: () => void;
  /** Shows a spinner and ignores taps while the row's action runs. */
  busy?: boolean;
  /** Danger tint for destructive actions (DESIGN.md "Danger zone"). */
  danger?: boolean;
  children: ReactNode;
};

/** Tappable glass list row (DESIGN.md "card list-row"): content on the left, spinner while busy; `danger` tints it. */
export function ListRow({ onPress, busy = false, danger = false, children }: Props) {
  return (
    <GlassCard tier="card" onPress={onPress} disabled={busy} busy={busy} style={[styles.row, danger && styles.danger]}>
      <View style={styles.content}>
        {children}
        {busy && <ActivityIndicator color={colors.text.secondary} />}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  row: { padding: spacing[16], borderRadius: radius.md },
  danger: { backgroundColor: colors.surface.dangerTint, borderColor: colors.border.danger },
  content: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
