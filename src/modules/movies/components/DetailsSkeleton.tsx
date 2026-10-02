import { useEffect } from "react";
import { AccessibilityInfo, Animated, StyleSheet, View, type DimensionValue } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePulse } from "@/ui/Shimmer";
import { colors, detailsSkeleton, size, spacing } from "@/ui/tokens";

type BlockProps = { width: DimensionValue; height: number; round?: boolean; pulse: Animated.Value };

// One pulsing placeholder block.
function Block({ width, height, round, pulse }: BlockProps) {
  return <Animated.View style={[styles.block, { width, height, opacity: pulse }, round && { borderRadius: height / 2 }]} />;
}

/** Loading state in the final layout: backdrop, poster, title, chips, synopsis and cast placeholders. */
export function DetailsSkeleton() {
  const pulse = usePulse();
  const insets = useSafeAreaInsets();

  // A live region present at first render is silent on Android, so speak "Loading movie" once.
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility("Loading movie");
  }, []);

  return (
    <View accessible accessibilityLiveRegion="polite" accessibilityLabel="Loading movie" style={styles.root}>
      <Block width="100%" height={size.detailsBackdrop} pulse={pulse} />
      <View style={styles.headerRow}>
        <View style={styles.poster}>
          <Block width="100%" height={size.detailsPosterWidth / size.posterAspect} pulse={pulse} />
        </View>
        <View style={styles.titleColumn}>
          <Block width={detailsSkeleton.titleLong} height={detailsSkeleton.titleBar} pulse={pulse} />
          <Block width={detailsSkeleton.titleShort} height={detailsSkeleton.titleBar} pulse={pulse} />
          <Block width={detailsSkeleton.metaWidth} height={detailsSkeleton.metaBar} pulse={pulse} />
          <Block width={detailsSkeleton.genreWidth} height={detailsSkeleton.genreBar} pulse={pulse} />
        </View>
      </View>
      <View style={styles.row}>
        <Block width={detailsSkeleton.chipLong} height={size.chipHeight} round pulse={pulse} />
        <Block width={detailsSkeleton.chipShort} height={size.chipHeight} round pulse={pulse} />
      </View>
      <View style={styles.section}>
        <Block width={detailsSkeleton.titleLong} height={detailsSkeleton.taglineBar} pulse={pulse} />
        <View style={styles.heading}>
          <Block width={detailsSkeleton.synopsisHeading.width} height={detailsSkeleton.synopsisHeading.height} pulse={pulse} />
        </View>
        <View style={styles.lines}>
          {[0, 1, 2].map((line) => (
            <Block key={line} width={detailsSkeleton.titleLong} height={detailsSkeleton.textBar} pulse={pulse} />
          ))}
          <Block width={detailsSkeleton.lastLineWidth} height={detailsSkeleton.textBar} pulse={pulse} />
        </View>
        <View style={styles.castHeading}>
          <Block width={detailsSkeleton.castHeading.width} height={detailsSkeleton.castHeading.height} pulse={pulse} />
        </View>
        <View style={styles.castRow}>
          {[0, 1, 2, 3].map((item) => (
            <View key={item} style={styles.castItem}>
              <Block width={size.castItem} height={size.castItem} round pulse={pulse} />
              <View style={styles.castBars}>
                <Block width={detailsSkeleton.castNameBar.width} height={detailsSkeleton.castNameBar.height} pulse={pulse} />
                <Block width={detailsSkeleton.castRoleBar.width} height={detailsSkeleton.castRoleBar.height} pulse={pulse} />
              </View>
            </View>
          ))}
        </View>
      </View>
      <View style={{ height: insets.bottom }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // Placeholder fill: the flat elevated colour, pulsing.
  block: { backgroundColor: colors.bg.elevatedFlat, borderRadius: detailsSkeleton.barRadius },
  // The poster overlaps the backdrop; the title column sits beside it.
  headerRow: {
    flexDirection: "row",
    gap: spacing[16],
    paddingHorizontal: spacing[20],
    marginTop: -size.detailsPosterOverlap,
  },
  poster: { width: size.detailsPosterWidth },
  titleColumn: { flex: 1, paddingTop: size.detailsTitleOffset, gap: spacing[8] },
  row: { flexDirection: "row", gap: spacing[12], paddingHorizontal: spacing[20], marginTop: spacing[20] },
  // Tagline bar 16 under the chips; headings, synopsis lines (8 apart) and cast spaced as the loaded layout.
  section: { paddingHorizontal: spacing[20], marginTop: spacing[16] },
  heading: { marginTop: spacing[24], marginBottom: spacing[8] },
  lines: { gap: spacing[8] },
  castHeading: { marginTop: spacing[24], marginBottom: spacing[12] },
  castRow: { flexDirection: "row", gap: size.castGap },
  castItem: { width: size.castItem },
  castBars: { marginTop: spacing[8], gap: spacing[6] },
});
