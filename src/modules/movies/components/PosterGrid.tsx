import { useEffect, type ReactElement } from "react";
import { AccessibilityInfo, StyleSheet, Text, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { EmptyState } from "@/ui/EmptyState";
import { PosterCard, PosterCardSkeleton } from "@/ui/PosterCard";
import { colors, lineHeight, size, spacing, type } from "@/ui/tokens";
import { IMAGE_SIZE, tmdbImage } from "../tmdbImage";
import { releaseYear } from "../releaseYear";
import type { PopularState } from "../hooks/usePopularMovies";
import type { Movie } from "../types";

const SKELETON_COUNT = 12;
// Placeholder rows for the loading state: null renders a skeleton tile.
const SKELETONS: null[] = Array.from({ length: SKELETON_COUNT }, () => null);

type Props = {
  state: PopularState;
  movies: Movie[];
  onRetry: () => void;
  /** Scrolls with the grid, above the section title (Home passes the Roulette card). */
  header: ReactElement;
};

// One grid cell: half the gap on each side and a full gap below, so tiles sit `gridGap` apart.
function Cell({ item }: { item: Movie | null }) {
  return (
    <View style={styles.cell}>
      {item ? (
        <PosterCard
          id={item.id}
          posterUrl={tmdbImage(item.poster_path, IMAGE_SIZE.poster)}
          title={item.title}
          year={releaseYear(item.release_date)}
        />
      ) : (
        <PosterCardSkeleton />
      )}
    </View>
  );
}

/** Popular posters in a 3-column grid under `header`; also draws the loading, empty and error states. */
export function PosterGrid({ state, movies, onRetry, header }: Props) {
  // A live region present at first render is not announced on Android, so speak "Loading movies" when loading starts.
  useEffect(() => {
    if (state === "loading") AccessibilityInfo.announceForAccessibility("Loading movies");
  }, [state]);

  const showTitle = state === "loading" || state === "filled";
  const data: (Movie | null)[] = state === "loading" ? SKELETONS : movies;

  // Empty and error share one shell: the same list with an EmptyState instead of tiles.
  const empty =
    state === "empty" ? (
      <EmptyState
        icon="🎬"
        title="No movies to show"
        body="We couldn't find any movies right now. Try again in a moment."
        action={{ label: "Retry", onPress: onRetry }}
      />
    ) : state === "error" ? (
      <EmptyState
        icon="🦉"
        title="Couldn't load movies"
        body="Check your connection and try again."
        action={{ label: "Retry", onPress: onRetry }}
      />
    ) : null;

  return (
    <FlashList
      data={data}
      numColumns={size.gridColumns}
      keyExtractor={(item, index) => (item ? String(item.id) : `skeleton-${index}`)}
      renderItem={({ item }) => <Cell item={item} />}
      contentContainerStyle={styles.content}
      ListHeaderComponent={
        <View style={styles.header}>
          {header}
          {showTitle && (
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Popular right now
            </Text>
          )}
        </View>
      }
      ListEmptyComponent={empty ? <View style={styles.empty}>{empty}</View> : null}
    />
  );
}

// Cells carry half a gap each side, so the list edge and the header give back that half.
const HALF_GAP = size.gridGap / 2;

const styles = StyleSheet.create({
  // List padding: screen edge minus the cell's half gap; the last row's gap counts toward the bottom padding.
  content: {
    paddingHorizontal: spacing[20] - HALF_GAP,
    paddingBottom: spacing[16] - size.gridGap,
  },
  // Header block: 12 under the app header, aligned to the 20 dp screen edge.
  header: { paddingTop: spacing[12], paddingHorizontal: HALF_GAP },
  sectionTitle: {
    ...type.subhead,
    lineHeight: lineHeight.subhead,
    color: colors.brand.lavender200,
    marginTop: spacing[24],
    marginBottom: spacing[12],
  },
  cell: { paddingHorizontal: HALF_GAP, paddingBottom: size.gridGap },
  // 32 between the Roulette card and the EmptyState.
  empty: { paddingTop: spacing[32] },
});
