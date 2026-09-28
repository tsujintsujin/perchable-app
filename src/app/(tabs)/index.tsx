import { Link, router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassBackdrop } from "@/ui/GlassBackdrop";
import { Avatar } from "@/ui/Avatar";
import { colors, type } from "@/ui/tokens";
import { useOwnProfile } from "@/modules/profile";

/**
 * (tabs)/index — Home ("Perch"). Build 5 scope: this placeholder shell.
 * Build 6 (DESIGN.md §7 "Home screen fix"): replaced Build 5's top-right
 * "Signed in ✓" text chip — which sat inside the reserved 64×64 dev-client
 * gear corner — with a small circular Avatar inset left of that zone,
 * tappable through to the Profile tab. Real Home content (roulette,
 * have-you-watched, friend activity — DESIGN.md §3) is still later Builds.
 *
 * Build 6 · Bug 1: reads the same `useOwnProfile` hook the Profile screen
 * uses, instead of reaching into `session.user.user_metadata` and
 * re-doing the Google-metadata key fallback inline — DESIGN.md §7 says a
 * route composes `ui/` + a module's exported hook, nothing more. The
 * `profiles` row (created by Build 6's trigger) already carries
 * `display_name`/`avatar_url` for this.
 */
export default function Home() {
  const profile = useOwnProfile();
  const loaded = profile.state === "loaded" ? profile.profile : undefined;
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <GlassBackdrop blobs={["purple", "gold"]} />
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Pressable
          onPress={() => router.push("/profile")}
          accessibilityRole="button"
          accessibilityLabel="Open My Profile"
        >
          <Avatar uri={loaded?.avatarUrl} name={loaded?.displayName} size="sm" />
        </Pressable>
      </View>

      <View style={styles.body}>
        <Text style={styles.placeholder}>Edit src/app/(tabs)/index.tsx to edit this screen.</Text>
        {__DEV__ && (
          <Link href="/debug" style={styles.link}>
            Debug: Supabase
          </Link>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    // Inset left of the reserved 64×64 dev-client gear corner (DESIGN.md
    // §7) — never flush against the edge. Overrides paddingHorizontal's
    // right value; Yoga always resolves the specific edge over the
    // shorthand regardless of key order.
    paddingRight: 84,
  },
  body: { flex: 1, alignItems: "center", justifyContent: "center" },
  placeholder: { color: colors.text.secondary, fontFamily: type.small.fontFamily },
  link: { marginTop: 16, color: colors.accent.gold },
});
