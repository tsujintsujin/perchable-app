import { StyleSheet, Text, View } from "react-native";
import { GlassBackdrop } from "@/ui/GlassBackdrop";
import { colors, spacing, type } from "@/ui/tokens";

/** Placeholder — real Settings content lands later; gives the nav row somewhere to push to. */
export default function ProfileSettings() {
  return (
    <View style={styles.root}>
      <GlassBackdrop blobs={["gold"]} opacity={0.2} />
      <View style={styles.body}>
        <Text style={styles.title}>Coming soon</Text>
        <Text style={styles.bodyText}>
          Sign out, delete account, and app info are coming soon.
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
