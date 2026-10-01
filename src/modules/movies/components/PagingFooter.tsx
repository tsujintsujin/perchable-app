import { useEffect } from "react";
import { AccessibilityInfo, StyleSheet, Text, View } from "react-native";
import { Button } from "@/ui/Button";
import { Spinner } from "@/ui/Spinner";
import { colors, size, spacing, type } from "@/ui/tokens";
import type { PopularFooter } from "../hooks/usePopularMovies";

type Props = {
  footer: PopularFooter;
  onRetry: () => void;
};

// Spinner and "Loading more…" row; speaks once when it appears (a live region present at first render is silent on Android).
function LoadingRow() {
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility("Loading more movies");
  }, []);
  return (
    <View style={styles.row} accessible accessibilityLiveRegion="polite" accessibilityLabel="Loading more movies">
      <Spinner />
      <Text style={styles.caption}>Loading more…</Text>
    </View>
  );
}

/** Bottom of the Popular grid: loading more, end of list, or a failed load with an inline Retry. */
export function PagingFooter({ footer, onRetry }: Props) {
  if (footer === "loading") return <LoadingRow />;
  if (footer === "end") {
    return (
      <View style={styles.row}>
        <Text style={styles.caption}>You&apos;ve reached the end.</Text>
      </View>
    );
  }
  if (footer === "error") {
    return (
      <View style={styles.errorBox}>
        <Text accessibilityRole="alert" style={styles.errorText}>
          ⚠ Couldn&apos;t load more movies.
        </Text>
        <Button
          label="Retry"
          accessibilityLabel="Retry loading more movies"
          variant="secondary-glass"
          onPress={onRetry}
          style={styles.retry}
        />
      </View>
    );
  }
  return null;
}

// Footer rows: centred, one fixed-height line for loading and end; the error box grows to fit text and button.
const styles = StyleSheet.create({
  row: {
    minHeight: size.footerRow,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[10],
  },
  caption: { ...type.caption, color: colors.text.secondary },
  errorBox: { alignItems: "center", paddingVertical: spacing[8] },
  errorText: { ...type.small, color: colors.danger, marginBottom: spacing[8] },
  retry: { paddingHorizontal: spacing[24] },
});
