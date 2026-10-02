import { useState } from "react";
import { Animated as RNAnimated, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { usePulse } from "@/ui/Shimmer";
import { colors, deck, iconSize, letterSpacing, lineHeight, motion, radius, size, spacing, type } from "@/ui/tokens";

type Props = {
  posterUrl: string | null;
  title: string;
  year?: number | null;
  /** Drawn when above 0, to one decimal. */
  rating?: number | null;
  /** Height of the controls dock the card sits behind: the title band ends right above it. */
  bottomInset: number;
  /** Horizontal drag of the card in dp; the stamp and tint opacity follow it. */
  dragX: SharedValue<number>;
  /** 0 to 1: how much of the dim layer covers a card behind the top one. */
  dim: SharedValue<number>;
  /** Signed -1 (SKIP) to 1 (ADD): the stamp of a card that is leaving, which the drag alone cannot show (a button press has no drag). */
  exitStamp?: SharedValue<number>;
};

// Stamp and tint strength for a drag of `dx`: 0 up to 15% of the screen width, 1 from 30%, linear between.
function stampStrength(dx: number, screenWidth: number): number {
  "worklet";
  const fraction = screenWidth > 0 ? Math.abs(dx) / screenWidth : 0;
  const s = (fraction - deck.stampStart) / (deck.stampFull - deck.stampStart);
  return Math.min(Math.max(s, 0), 1);
}

// Pulsing placeholder fill with the lavender wash; fills the card until the poster loads.
function PosterShimmer() {
  const pulse = usePulse();
  return (
    <>
      <RNAnimated.View style={[styles.fill, styles.shimmer, { opacity: pulse }]} />
      <View style={[styles.fill, styles.wash]} />
    </>
  );
}

/** One full-bleed swipe-deck card: poster filling its parent, a title band, and the ADD / SKIP stamp and tint while dragged. Presentational: the deck moves it. */
export function SwipeDeckCard({ posterUrl, title, year, rating, bottomInset, dragX, dim, exitStamp }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  // Keyed by URL so a card reused for another movie never shows the previous one's failure.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const showImage = posterUrl !== null && failedUrl !== posterUrl;
  const ratingText = typeof rating === "number" && rating > 0 ? rating.toFixed(1) : null;
  const hasMeta = !!year || ratingText !== null;

  // Stamps and tints show their direction by the sign of the drag, or of the exit stamp when the card leaves by a button.
  // Each view gets its own animated style: one style object is never shared between views.
  const addOpacity = () => {
    "worklet";
    const drag = dragX.get() > 0 ? stampStrength(dragX.get(), screenWidth) : 0;
    const exit = exitStamp ? Math.max(exitStamp.get(), 0) : 0;
    return { opacity: Math.max(drag, exit) };
  };
  const skipOpacity = () => {
    "worklet";
    const drag = dragX.get() < 0 ? stampStrength(dragX.get(), screenWidth) : 0;
    const exit = exitStamp ? Math.max(-exitStamp.get(), 0) : 0;
    return { opacity: Math.max(drag, exit) };
  };
  const addStyle = useAnimatedStyle(addOpacity);
  const addTintStyle = useAnimatedStyle(addOpacity);
  const skipStyle = useAnimatedStyle(skipOpacity);
  const skipTintStyle = useAnimatedStyle(skipOpacity);
  const dimStyle = useAnimatedStyle(() => ({ opacity: dim.get() }));

  return (
    <View style={styles.card}>
      {showImage ? (
        <>
          {loadedUrl !== posterUrl && <PosterShimmer />}
          <Image
            testID="deck-poster"
            source={{ uri: posterUrl }}
            style={styles.fill}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={motion.imageFade}
            onLoad={() => setLoadedUrl(posterUrl)}
            onError={() => setFailedUrl(posterUrl)}
          />
        </>
      ) : (
        <View style={[styles.fill, styles.fallback, { bottom: bottomInset }]}>
          <Text style={styles.fallbackIcon}>🎬</Text>
        </View>
      )}

      <View testID="band" style={[styles.band, { bottom: bottomInset }]}>
        <LinearGradient colors={[colors.overlay.fadeStart, colors.overlay.cardInfo]} style={styles.bandFade} />
        <View style={styles.bandBody}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          {hasMeta && (
            <View style={styles.meta}>
              {!!year && <Text style={styles.year}>{year}</Text>}
              {ratingText !== null && (
                <Text style={styles.rating}>
                  <Text style={styles.star}>★</Text> {ratingText}
                </Text>
              )}
            </View>
          )}
        </View>
      </View>

      <Animated.View testID="tint-add" pointerEvents="none" style={[styles.fill, styles.addTint, addTintStyle]} importantForAccessibility="no" />
      <Animated.View testID="tint-skip" pointerEvents="none" style={[styles.fill, styles.skipTint, skipTintStyle]} importantForAccessibility="no" />
      <Animated.View testID="stamp-add" pointerEvents="none" style={[styles.stamp, styles.addStamp, addStyle]} importantForAccessibility="no">
        <Text style={[styles.stampText, styles.addStampText]}>ADD</Text>
      </Animated.View>
      <Animated.View testID="stamp-skip" pointerEvents="none" style={[styles.stamp, styles.skipStamp, skipStyle]} importantForAccessibility="no">
        <Text style={[styles.stampText, styles.skipStampText]}>SKIP</Text>
      </Animated.View>
      <Animated.View testID="dim" pointerEvents="none" style={[styles.fill, styles.dim, dimStyle]} importantForAccessibility="no" />
    </View>
  );
}

const styles = StyleSheet.create({
  // Flat full-bleed card: no blur, since it re-renders every drag frame.
  card: { flex: 1, backgroundColor: colors.bg.elevatedFlat, overflow: "hidden" },
  fill: { ...StyleSheet.absoluteFill },
  // Loading placeholder layers.
  shimmer: { backgroundColor: colors.bg.elevatedFlat },
  wash: { backgroundColor: colors.overlay.shimmerWash },
  // No poster or a failed image: purple fill with the clapperboard centred in the poster area.
  fallback: { alignItems: "center", justifyContent: "center", backgroundColor: colors.brand.purple900 },
  fallbackIcon: { fontSize: iconSize.deckFallback },
  // Info band pinned to the bottom: a fade, then the solid block with the title and meta.
  band: { position: "absolute", left: 0, right: 0 },
  bandFade: { height: size.deckInfoFade },
  bandBody: { paddingHorizontal: spacing[20], paddingBottom: spacing[16], backgroundColor: colors.overlay.cardInfo },
  title: { ...type.title, lineHeight: lineHeight.title, color: colors.text.primary },
  // Year and rating, 12 apart; the row is 22 high.
  meta: { flexDirection: "row", alignItems: "center", gap: spacing[12], marginTop: spacing[4], height: lineHeight.body },
  year: { ...type.bodyStrong, lineHeight: lineHeight.body, color: colors.text.secondary },
  rating: { ...type.bodyStrong, lineHeight: lineHeight.body, color: colors.text.primary },
  star: { color: colors.accent.gold },
  // Whole-card tints for the drag direction.
  addTint: { backgroundColor: colors.overlay.addTint },
  skipTint: { backgroundColor: colors.overlay.skipTint },
  // Stamps: a tilted outlined word near the top corner the card is dragged toward.
  stamp: {
    position: "absolute",
    top: deck.stampTop,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[14],
    borderWidth: size.stampBorder,
    borderRadius: radius.sm,
    backgroundColor: colors.overlay.scrim,
  },
  addStamp: { left: spacing[20], borderColor: colors.accent.gold, transform: [{ rotate: `-${deck.stampTiltDeg}deg` }] },
  skipStamp: { right: spacing[20], borderColor: colors.danger, transform: [{ rotate: `${deck.stampTiltDeg}deg` }] },
  stampText: { ...type.display, lineHeight: lineHeight.display, letterSpacing: letterSpacing.label },
  addStampText: { color: colors.accent.gold },
  skipStampText: { color: colors.danger },
  // Darkens a card behind the top one.
  dim: { backgroundColor: colors.overlay.deckDim },
});
