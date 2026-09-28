import { Link, router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassBackdrop } from "@/ui/GlassBackdrop";
import { Avatar } from "@/ui/Avatar";
import { colors, type } from "@/ui/tokens";
import { useOwnProfile } from "@/modules/profile";

/** Home ("Perch") placeholder shell — avatar links to Profile; real content lands later. */
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
    // Reserves the 64x64 dev-client gear corner. The specific edge wins
    // over paddingHorizontal's shorthand regardless of key order.
    paddingRight: 84,
  },
  body: { flex: 1, alignItems: "center", justifyContent: "center" },
  placeholder: { color: colors.text.secondary, fontFamily: type.small.fontFamily },
  link: { marginTop: 16, color: colors.accent.gold },
});
