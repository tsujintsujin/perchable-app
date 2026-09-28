import { StyleSheet, Text, View } from "react-native";
import { GlassBackdrop } from "@/ui/GlassBackdrop";
import { colors, spacing, type } from "@/ui/tokens";

/**
 * Placeholder — the real Settings screen (sign out, delete account, TMDB
 * attribution per DESIGN.md §6) is Build 9's scope ("Build 9 — Settings
 * screen: Sign out + Delete account"). This stub exists so Build 6's header
 * icon and "Settings" row have somewhere real to push to (Bella's call, per
 * the Build 6 brief — logged here, not built out further).
 *
 * PLAN PROBLEM flagged, not fixed here: DESIGN.md §7's rules list says TMDB
 * attribution "must render on every build that includes the TMDB proxy
 * (Build 3 onward)", but the Settings screen it lives on (§6) is scoped to
 * Build 9 by PLAN.md. That gap has existed since Build 3; this Build didn't
 * create it and a stub isn't the place to resolve it — flagging for the
 * Manager/Priya rather than unilaterally pulling Build 9 content forward.
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
