import { StyleSheet, Text, View } from "react-native";
import { GlassBackdrop } from "@/ui/GlassBackdrop";
import { colors } from "@/ui/tokens";

/**
 * Placeholder — the real edit screen (photo + usertag, DESIGN.md's "Build 7
 * — Edit profile screen") is Build 7's scope. This stub exists so Build 6's
 * "Edit profile" row and empty-usertag chip have somewhere real to push to,
 * instead of a disabled/dead tap target (Bella's call, per the Build 6
 * brief — logged here rather than in the row itself).
 */
export default function EditProfile() {
  return (
    <View style={styles.root}>
      <GlassBackdrop blobs={["purple"]} opacity={0.2} />
      <View style={styles.body}>
        <Text style={styles.title}>Coming soon</Text>
        <Text style={styles.bodyText}>Editing your photo and usertag lands in Build 7.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  body: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
  title: { fontFamily: "Poppins_700Bold", fontSize: 19, color: colors.text.primary },
  bodyText: {
    marginTop: 12,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: colors.text.secondary,
    textAlign: "center",
  },
});
