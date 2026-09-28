import { StyleSheet, Text, View } from "react-native";
import { GlassBackdrop } from "@/ui/GlassBackdrop";
import { colors, spacing, type } from "@/ui/tokens";

/**
 * Placeholder — sign out, delete account and TMDB attribution land in a
 * later Build. This stub exists so the header icon and "Settings" row have
 * somewhere real to push to.
 */
export default function ProfileSettings() {
  return (
    <View style={styles.root}>
      <GlassBackdrop blobs={["gold"]} opacity={0.2} />
      <View style={styles.body}>
        <Text style={styles.title}>Coming soon</Text>
        <Text style={styles.bodyText}>
          Sign out, delete account, and app info land in Build 9.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  body: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing[28] },
  title: { ...type.subhead, color: colors.text.primary },
  bodyText: {
    marginTop: spacing[12],
    ...type.body,
    color: colors.text.secondary,
    textAlign: "center",
  },
});
