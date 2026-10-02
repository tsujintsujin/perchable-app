import { Animated, StyleSheet, Text, View } from "react-native";
import { Spinner } from "@/ui/Spinner";
import { usePulse } from "@/ui/Shimmer";
import { colors, deck, detailsSkeleton, lineHeight, radius, size, spacing, type } from "@/ui/tokens";

type Props = {
  width: number;
  height: number;
  /** True after several pages in a row held nothing new: shows what the deck is doing. */
  finding: boolean;
};

/** Card-shaped loading placeholder with two shimmer cards behind it; one polite live region says what is loading. */
export function DeckSkeleton({ width, height, finding }: Props) {
  const pulse = usePulse();
  const label = finding ? "Finding movies you haven't seen…" : "Loading movies";
  return (
    <View accessible accessibilityLiveRegion="polite" accessibilityLabel={label} style={[styles.stack, { width, height }]}>
      {[2, 1, 0].map((index) => (
        <Animated.View
          key={index}
          style={[
            styles.card,
            { opacity: index === 0 ? pulse : deck.skeletonBehindOpacity[index - 1], transform: [{ translateY: deck.stackLift[index] }, { scale: deck.stackScale[index] }] },
          ]}
        >
          {index === 0 && (
            <>
              <View style={[styles.bar, styles.titleBar]} />
              <View style={[styles.bar, styles.metaBar]} />
            </>
          )}
        </Animated.View>
      ))}
      {finding && (
        <View style={styles.progress}>
          <Spinner diameter={size.spinnerLg} stroke={size.spinnerStrokeLg} />
          <Text style={styles.progressText}>{label}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { alignSelf: "center" },
  // Flat shimmer card, the same frame as a real card.
  card: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.hairlineStrong,
    backgroundColor: colors.bg.elevatedFlat,
  },
  bar: { position: "absolute", left: spacing[16], borderRadius: detailsSkeleton.barRadius, backgroundColor: colors.overlay.shimmerWash },
  titleBar: { bottom: spacing[16] + detailsSkeleton.metaBar + spacing[12], width: deck.skeletonTitleWidth, height: detailsSkeleton.titleBar },
  metaBar: { bottom: spacing[16], width: deck.skeletonMetaWidth, height: detailsSkeleton.metaBar },
  // Spinner and line centred over the placeholder.
  progress: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", padding: spacing[24], gap: spacing[12] },
  progressText: { ...type.body, lineHeight: lineHeight.body, color: colors.text.secondary, textAlign: "center" },
});
