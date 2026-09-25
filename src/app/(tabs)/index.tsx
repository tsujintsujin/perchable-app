import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { GlassBackdrop } from "@/ui/GlassBackdrop";
import { colors } from "@/ui/tokens";

/**
 * (tabs)/index — Home ("Perch"). Build 5 scope only: the signed-in landing
 * DESIGN.md's Build 5 section calls for (chip in the header) plus this
 * placeholder shell. Real Home content (roulette, have-you-watched, friend
 * activity — DESIGN.md §3) is later Builds; not built here on purpose.
 */
export default function Home() {
  return (
    <View style={styles.root}>
      <GlassBackdrop blobs={["purple", "gold"]} />
      <View style={styles.header}>
        <View style={styles.chip}>
          <LinearGradient
            colors={[colors.brand.purple700, colors.brand.gold500]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatar}
          />
          <Text style={styles.chipText}>Signed in ✓</Text>
        </View>
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
    paddingTop: 56,
    paddingHorizontal: 20,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(76,29,149,0.35)",
    borderWidth: 1,
    borderColor: colors.border.hairline,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 6,
  },
  avatar: { width: 18, height: 18, borderRadius: 9 },
  chipText: { fontFamily: "Inter_500Medium", fontSize: 12, color: colors.text.primary },
  body: { flex: 1, alignItems: "center", justifyContent: "center" },
  placeholder: { color: colors.text.secondary, fontFamily: "Inter_400Regular" },
  link: { marginTop: 16, color: colors.accent.gold },
});
