import { useEffect, useState } from "react";
import { Animated, BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmptyState } from "@/ui/EmptyState";
import { PosterCard } from "@/ui/PosterCard";
import { TierBadge } from "@/ui/TierBadge";
import { Toast, useToast } from "@/ui/Toast";
import { backdropFade, colors, lineHeight, motion, radius, size, spacing, type } from "@/ui/tokens";
import { displayTitle, formatRating, formatRuntime, metaLine } from "../format";
import { useMovieDetails } from "../hooks/useMovieDetails";
import { releaseYear } from "../releaseYear";
import { IMAGE_SIZE, tmdbImage } from "../tmdbImage";
import type { MovieDetails } from "../types";
import { BackChip } from "@/ui/BackChip";
import { goBackOrHome } from "@/lib/navigation";
import { CastRow } from "./CastRow";
import { DetailsSkeleton } from "./DetailsSkeleton";
import { SpoilerLounge } from "./SpoilerLounge";
import { TierLegend } from "./TierLegend";

// Shown when a refetch fails and the loaded movie stays on screen.
const REFRESH_FAILED_MESSAGE = "Couldn't refresh. Check your connection.";
// Answer to a tap on the not-yet-built comment composer.
const COMMENTS_COMING_SOON = "Comments are coming soon.";
const NO_SYNOPSIS = "No synopsis available.";

type ContentProps = { movie: MovieDetails; onComposerPress: () => void };

// The loaded layout: backdrop, poster and title, chips, tagline, synopsis, cast and the lounge shell.
function DetailsContent({ movie, onComposerPress }: ContentProps) {
  const [legendOpen, setLegendOpen] = useState(false);

  // The first Android back press closes the Tier legend instead of leaving the screen.
  useEffect(() => {
    if (!legendOpen) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      setLegendOpen(false);
      return true;
    });
    return () => subscription.remove();
  }, [legendOpen]);

  const backdropUrl = tmdbImage(movie.backdrop_path, IMAGE_SIZE.backdrop);
  const meta = metaLine(releaseYear(movie.release_date), formatRuntime(movie.runtime));
  const genres = movie.genres.map((genre) => genre.name).join(" · ");
  const rating = formatRating(movie.vote_average, movie.vote_count);
  const tagline = movie.tagline?.trim();
  const title = displayTitle(movie.title);

  return (
    <View>
      {/* Tapping anywhere outside the chips while the legend is open closes it. */}
      {legendOpen && (
        <Pressable
          testID="legend-dismiss"
          onPress={() => setLegendOpen(false)}
          accessible={false}
          importantForAccessibility="no"
          style={styles.dismiss}
        />
      )}

      {/* Decorative backdrop (flat purple when there is none) fading into the page. */}
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={styles.backdrop}>
        {backdropUrl ? (
          <Image source={{ uri: backdropUrl }} style={styles.fill} contentFit="cover" cachePolicy="memory-disk" transition={motion.imageFade} />
        ) : (
          <View style={[styles.fill, styles.noBackdrop]} />
        )}
        <LinearGradient
          colors={[colors.overlay.fadeStart, colors.bg.base]}
          locations={[backdropFade.start, 1]}
          style={styles.fill}
        />
      </View>

      <View style={styles.headerRow}>
        <View style={styles.poster}>
          <PosterCard
            id={movie.id}
            posterUrl={tmdbImage(movie.poster_path, IMAGE_SIZE.detailsPoster)}
            title={title}
            accessibilityLabel={`Poster for ${title}`}
            emphasis
          />
        </View>
        <View style={styles.titleColumn}>
          <Text accessibilityRole="header" numberOfLines={3} style={styles.title}>
            {title}
          </Text>
          {meta && <Text style={styles.meta}>{meta}</Text>}
          {genres !== "" && <Text style={styles.genres}>{genres}</Text>}
        </View>
      </View>

      {/* Chips sit above the dismiss layer so they stay tappable while the legend is open. */}
      <View style={styles.chipRow}>
        <View style={styles.chips}>
          <View
            accessible
            accessibilityLabel={rating ? `Rated ${rating} out of 10 on TMDB` : "Not rated yet on TMDB"}
            style={styles.ratingChip}
          >
            {rating ? (
              <>
                <Text style={styles.star}>★</Text>
                <Text style={styles.ratingValue}>{rating}</Text>
                <Text style={styles.ratingOf}>of 10</Text>
              </>
            ) : (
              <Text style={styles.notRated}>Not rated yet</Text>
            )}
          </View>
          <TierBadge onPress={() => setLegendOpen((open) => !open)} size="md" />
        </View>
        {legendOpen && <TierLegend />}
      </View>

      <View style={styles.body}>
        {tagline ? <Text style={styles.tagline}>{tagline}</Text> : null}
        <Text accessibilityRole="header" style={[styles.heading, styles.firstHeading]}>
          Synopsis
        </Text>
        <Text style={styles.synopsis}>{movie.overview?.trim() || NO_SYNOPSIS}</Text>
      </View>

      {movie.cast.length > 0 && (
        <>
          <Text accessibilityRole="header" style={[styles.heading, styles.castHeading]}>
            Cast
          </Text>
          <CastRow cast={movie.cast} />
        </>
      )}

      <View style={styles.body}>
        <SpoilerLounge onComposerPress={onComposerPress} />
      </View>
    </View>
  );
}

/** Movie details for a route `id` param: loading, error with Retry, not found, or the loaded movie; one screen, one hook. */
export function MovieDetailsScreen({ idParam }: { idParam: string | undefined }) {
  const details = useMovieDetails(idParam);
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { show } = toast;
  const [barVisible, setBarVisible] = useState(false);
  const [barOpacity] = useState(() => new Animated.Value(0));
  // The scrim is fully shown while the bar is hidden and the other way round.
  const [scrimOpacity] = useState(() => barOpacity.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }));

  // A failed refetch keeps the movie on screen and only says so.
  const { refetchErrorAt } = details;
  useEffect(() => {
    if (refetchErrorAt !== null) show(REFRESH_FAILED_MESSAGE, "error");
  }, [refetchErrorAt, show]);

  // Fades the compact top bar in and out as the scroll passes the trigger offset.
  useEffect(() => {
    Animated.timing(barOpacity, { toValue: barVisible ? 1 : 0, duration: motion.barFade, useNativeDriver: true }).start();
  }, [barVisible, barOpacity]);

  const { state, movie } = details;

  if (state === "loading") {
    return (
      <View style={styles.root}>
        <DetailsSkeleton />
        <BackChip onPress={goBackOrHome} />
      </View>
    );
  }

  if (state === "error" || state === "notFound" || !movie) {
    return (
      <View style={styles.root}>
        <View style={styles.centered}>
          {state === "notFound" ? (
            <EmptyState
              icon="🎬"
              title="Movie not found"
              body="We couldn't find that movie. It may have been removed."
              action={{ label: "Back to Home", onPress: () => router.replace("/") }}
            />
          ) : (
            <EmptyState
              icon="🦉"
              title="Couldn't load this movie"
              body="Check your connection and try again."
              action={{ label: "Retry", onPress: details.retry }}
            />
          )}
        </View>
        <BackChip onPress={goBackOrHome} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        testID="details-scroll"
        scrollEventThrottle={16}
        onScroll={(event) => setBarVisible(event.nativeEvent.contentOffset.y > size.detailsBarShowAt)}
        contentContainerStyle={{ paddingBottom: insets.bottom + size.detailsBottomPad }}
      >
        <DetailsContent movie={movie} onComposerPress={() => show(COMMENTS_COMING_SOON, "coming-soon")} />
      </ScrollView>

      {/* Status-bar scrim: keeps the light status icons readable over a bright backdrop; gives way to the solid bar. */}
      <Animated.View
        testID="top-scrim"
        pointerEvents="none"
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={[styles.scrim, { height: insets.top + size.detailsScrimHeight, opacity: scrimOpacity }]}
      >
        <LinearGradient colors={[colors.overlay.topScrimStart, colors.overlay.fadeStart]} style={styles.fill} />
      </Animated.View>

      {/* Compact bar: solid strip with the title once the header has scrolled away. */}
      <Animated.View
        pointerEvents="none"
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={[styles.bar, { height: insets.top + spacing[48], paddingTop: insets.top, opacity: barOpacity }]}
      >
        <Text numberOfLines={1} style={styles.barTitle}>
          {displayTitle(movie.title)}
        </Text>
      </Animated.View>
      <BackChip onPress={goBackOrHome} />
      <Toast message={toast.message} variant={toast.variant} offset={size.detailsToastOffset} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  // Error and not-found: the message centred in the screen.
  centered: { flex: 1, justifyContent: "center" },
  fill: { ...StyleSheet.absoluteFill },

  // Backdrop block at the top of the scroll, and the layer that catches taps while the legend is open.
  backdrop: { height: size.detailsBackdrop, width: "100%" },
  noBackdrop: { backgroundColor: colors.brand.purple900 },
  dismiss: { ...StyleSheet.absoluteFill, zIndex: 1 },

  // Poster overlapping the backdrop, title column beside it.
  headerRow: {
    flexDirection: "row",
    gap: spacing[16],
    paddingHorizontal: spacing[20],
    marginTop: -size.detailsPosterOverlap,
  },
  poster: { width: size.detailsPosterWidth },
  titleColumn: { flex: 1, paddingTop: size.detailsTitleOffset },
  title: { ...type.title, lineHeight: lineHeight.title, color: colors.text.primary },
  meta: { ...type.body, color: colors.text.secondary, marginTop: spacing[8] },
  genres: { ...type.caption, lineHeight: lineHeight.caption, color: colors.text.secondary, marginTop: spacing[6] },

  // Rating and Tier chips, with the legend anchored beneath them.
  chipRow: { marginTop: spacing[20], paddingHorizontal: spacing[20], zIndex: 2 },
  chips: { flexDirection: "row", gap: spacing[12] },
  ratingChip: {
    height: size.chipHeight,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[6],
    paddingHorizontal: spacing[14],
    borderRadius: radius.pill,
    backgroundColor: colors.surface.input,
    borderWidth: 1,
    borderColor: colors.border.hairline,
  },
  star: { ...type.bodyStrong, color: colors.accent.gold },
  ratingValue: { ...type.bodyStrong, color: colors.text.primary },
  ratingOf: { ...type.small, color: colors.text.secondary },
  notRated: { ...type.bodyStrong, color: colors.text.secondary },

  // Tagline, synopsis, headings and the lounge.
  body: { paddingHorizontal: spacing[20] },
  tagline: { ...type.bodyStrong, color: colors.text.secondary, marginTop: spacing[16] },
  heading: { ...type.subhead, lineHeight: lineHeight.subhead, color: colors.brand.lavender200 },
  firstHeading: { marginTop: spacing[24], marginBottom: spacing[8] },
  castHeading: { marginTop: spacing[24], marginBottom: spacing[12], paddingHorizontal: spacing[20] },
  synopsis: { ...type.body, lineHeight: lineHeight.body, color: colors.text.primary },

  // Top scrim: fixed above the scroll, below the back chip and the compact bar.
  scrim: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 1 },

  // Compact top bar: solid, hairline under it, title clear of the back chip and the gear corner.
  bar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    justifyContent: "center",
    backgroundColor: colors.bg.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.hairline,
    paddingLeft: size.detailsBarTitleLeft,
    paddingRight: size.homeHeaderInset,
  },
  barTitle: { ...type.subhead, color: colors.brand.lavender200 },
});
