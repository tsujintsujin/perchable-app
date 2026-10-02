import { Animated, StyleSheet, Text, View } from "react-native";
import { Spinner } from "@/ui/Spinner";
import { usePulse } from "@/ui/Shimmer";
import { colors, deck, detailsSkeleton, lineHeight, size, spacing, type } from "@/ui/tokens";

type Props = {
  /** Height of the controls dock; the placeholder bars sit just above it and the progress line centres in the area above it. */
  bottomInset: number;
  /** True after several pages in a row held nothing new: shows what the deck is doing. */
  finding: boolean;
};

/** Full-bleed loading placeholder with title and meta bars; one polite live region says what is loading. */
export function DeckSkeleton({ bottomInset, finding }: Props) {
  const pulse = usePulse();
  const label = finding ? "Finding movies you haven't seen…" : "Loading movies";
  return (
    <View accessible accessibilityLiveRegion="polite" accessibilityLabel={label} style={styles.fill}>
      <Animated.View style={[styles.fill, styles.shimmer, { opacity: pulse }]} />
      <View style={[styles.bar, styles.titleBar, { bottom: bottomInset + spacing[16] + deck.skeletonMetaBar.height + spacing[12] }]} />
      <View style={[styles.bar, styles.metaBar, { bottom: bottomInset + spacing[16] }]} />
      {finding && (
        <View style={[styles.progress, { bottom: bottomInset }]}>
          <Spinner diameter={size.spinnerLg} stroke={size.spinnerStrokeLg} />
          <Text style={styles.progressText}>{label}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill },
  // Flat shimmer fill over the whole content area.
  shimmer: { backgroundColor: colors.bg.elevatedFlat },
  bar: { position: "absolute", left: spacing[20], borderRadius: detailsSkeleton.barRadius, backgroundColor: colors.overlay.shimmerWash },
  titleBar: { width: deck.skeletonTitleBar.width, height: deck.skeletonTitleBar.height },
  metaBar: { width: deck.skeletonMetaBar.width, height: deck.skeletonMetaBar.height },
  // Spinner and line centred in the area above the dock.
  progress: { position: "absolute", top: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center", padding: spacing[24], gap: spacing[12] },
  progressText: { ...type.body, lineHeight: lineHeight.body, color: colors.text.secondary, textAlign: "center" },
});
