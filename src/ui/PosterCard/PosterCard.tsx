import { useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { usePulse } from "@/ui/Shimmer";
import { colors, iconSize, lineHeight, motion, radius, size, spacing, type } from "@/ui/tokens";

type Props = {
  /** Movie id; keeps a recycled list cell from showing the previous movie's image. */
  id: number;
  posterUrl: string | null;
  title: string;
  year?: number | null;
  /** Changing this lets a poster whose image failed try its image again (the list bumps it on a pull-to-refresh). */
  retryToken?: number;
  /** Makes the tile a button (pressed scale 0.98); absent, it is a plain image. */
  onPress?: () => void;
  /** Overrides the default "{title}, {year}" label. */
  accessibilityLabel?: string;
  /** Stronger hairline border, for the large poster on movie details. */
  emphasis?: boolean;
};

// Pulsing placeholder fill with the lavender wash; fills its parent.
function ShimmerFill() {
  const pulse = usePulse();
  return (
    <>
      <Animated.View style={[styles.fill, styles.shimmer, { opacity: pulse }]} />
      <View style={[styles.fill, styles.wash]} />
    </>
  );
}

/** Loading tile for a poster grid; hidden from screen readers (the list announces loading once). */
export function PosterCardSkeleton() {
  return (
    <View style={styles.tile} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <ShimmerFill />
    </View>
  );
}

/** 2:3 poster tile: shimmer until the image loads, then the image; no poster or a failed image shows the title. */
export function PosterCard({ id, posterUrl, title, year, retryToken = 0, onPress, accessibilityLabel, emphasis = false }: Props) {
  // Keyed by URL and token, not a boolean: a recycled cell must not inherit the previous movie's failure, and a new token retries.
  const [failed, setFailed] = useState<{ url: string; token: number } | null>(null);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const showImage = posterUrl !== null && !(failed?.url === posterUrl && failed.token === retryToken);

  const label = accessibilityLabel ?? (year ? `${title}, ${year}` : title);
  const content = showImage ? (
    <>
      {loadedUrl !== posterUrl && <ShimmerFill />}
      <Image
        testID="poster-image"
        source={{ uri: posterUrl }}
        style={styles.fill}
        contentFit="cover"
        cachePolicy="memory-disk"
        recyclingKey={String(id)}
        transition={motion.imageFade}
        onLoad={() => setLoadedUrl(posterUrl)}
        onError={() => setFailed({ url: posterUrl, token: retryToken })}
      />
    </>
  ) : (
    <View style={styles.fallback}>
      <Text style={styles.fallbackIcon}>🎬</Text>
      <Text style={styles.fallbackTitle} numberOfLines={3}>
        {title}
      </Text>
    </View>
  );

  if (!onPress) {
    return (
      <View accessible accessibilityRole="image" accessibilityLabel={label} style={[styles.tile, showImage && styles.imageTile, emphasis && styles.emphasis]}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Opens movie details"
      style={({ pressed }) => [styles.tile, showImage && styles.imageTile, emphasis && styles.emphasis, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Tile frame: fills the parent's width at 2:3, flat fill, hairline border.
  tile: {
    width: "100%",
    aspectRatio: size.posterAspect,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.hairline,
    overflow: "hidden",
  },
  // Flat fill behind the image so its fade-in runs over the loading colour, not the backdrop.
  imageTile: { backgroundColor: colors.bg.elevatedFlat },
  emphasis: { borderColor: colors.border.hairlineStrong },
  pressed: { transform: [{ scale: motion.pressScale }] },
  fill: { ...StyleSheet.absoluteFill },
  // Loading placeholder layers.
  shimmer: { backgroundColor: colors.bg.elevatedFlat },
  wash: { backgroundColor: colors.overlay.shimmerWash },
  // No-poster / failed-image state.
  fallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing[8],
    backgroundColor: colors.bg.elevatedFlat,
  },
  fallbackIcon: { fontSize: iconSize.lg, marginBottom: spacing[8] },
  fallbackTitle: {
    ...type.caption,
    lineHeight: lineHeight.caption,
    color: colors.text.secondary,
    textAlign: "center",
  },
});
