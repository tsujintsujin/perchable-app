import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { GlassCard } from "@/ui/GlassCard";
import { colors, radius, spacing } from "@/ui/tokens";

type Props = {
  onPress: () => void;
  /** Shows a spinner and ignores taps while the row's action runs. */
  busy?: boolean;
  children: ReactNode;
};

/** Tappable glass list row (DESIGN.md "card list-row"): content on the left, spinner while busy. */
export function ListRow({ onPress, busy = false, children }: Props) {
  return (
    <GlassCard tier="card" onPress={onPress} disabled={busy} style={styles.row}>
      <View style={styles.content}>
        {children}
        {busy && <ActivityIndicator color={colors.text.secondary} />}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  row: { padding: spacing[16], borderRadius: radius.md },
  content: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
