import { useCallback } from "react";
import { Link, router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassBackdrop } from "@/ui/GlassBackdrop";
import { Avatar } from "@/ui/Avatar";
import { Toast, useToast } from "@/ui/Toast";
import { colors, size, spacing, type } from "@/ui/tokens";
import { PosterGrid, RouletteCard, usePopularMovies } from "@/modules/movies";
import { useOwnProfile } from "@/modules/profile";

// Shown when pull-to-refresh fails and the earlier posters stay.
const REFRESH_FAILED_MESSAGE = "Couldn't refresh. Check your connection.";

/** Home ("Perch"): wordmark and avatar header, the Roulette shell, and the Popular poster grid. */
export default function Home() {
  const profile = useOwnProfile();
  const loaded = profile.state === "loaded" ? profile.profile : undefined;
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { show } = toast;
  // Stable so the hook's refresh callback is not rebuilt every render.
  const onRefreshError = useCallback(() => show(REFRESH_FAILED_MESSAGE, "error"), [show]);
  const popular = usePopularMovies({ onRefreshError });

  return (
    <View style={styles.root}>
      <GlassBackdrop blobs={["purple", "gold"]} />
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Text style={styles.wordmark}>🦉 perchable</Text>
        {__DEV__ && (
          <Link href="/debug" style={styles.debugLink}>
            Debug
          </Link>
        )}
        <Pressable
          onPress={() => router.push("/profile")}
          accessibilityRole="button"
          accessibilityLabel="Open My Profile"
          style={styles.avatarSlot}
        >
          <Avatar uri={loaded?.avatarUrl} name={loaded?.displayName} size="sm" />
        </Pressable>
      </View>

      <PosterGrid
        state={popular.state}
        movies={popular.movies}
        onRetry={popular.retry}
        footer={popular.footer}
        onEndReached={popular.loadMore}
        onRetryMore={popular.retryMore}
        refreshing={popular.refreshing}
        retryToken={popular.refreshCount}
        onRefresh={popular.refresh}
        header={<RouletteCard onPress={() => toast.show("Smart picks are coming soon.", "coming-soon")} />}
      />
      <Toast message={toast.message} variant={toast.variant} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  // Fixed header row; the right inset keeps the avatar clear of the dev-client gear corner.
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: spacing[20],
    paddingRight: size.homeHeaderInset,
  },
  wordmark: { ...type.subhead, color: colors.accent.gold, flex: 1 },
  debugLink: { ...type.small, color: colors.text.secondary, marginRight: spacing[8] },
  // Touch wrapper that centres the 32 dp avatar in a 48 dp target.
  avatarSlot: {
    width: size.avatarSlot,
    height: size.avatarSlot,
    alignItems: "center",
    justifyContent: "center",
  },
});
