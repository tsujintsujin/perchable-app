import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import Constants from "expo-constants";
import { GlassBackdrop } from "@/ui/GlassBackdrop";
import { GlassCard } from "@/ui/GlassCard";
import { ListRow } from "@/ui/ListRow";
import { Toast, useToast } from "@/ui/Toast";
import {
  colors,
  glass,
  iconSize,
  leading,
  letterSpacing,
  radius,
  size,
  spacing,
  tmdbChip,
  type,
} from "@/ui/tokens";
import { useSignOut } from "@/modules/auth";

// DESIGN.md §6: required TMDB attribution, verbatim.
const TMDB_ATTRIBUTION =
  "This application uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.";

// Grows the back chip's touch area to the minimum target size.
const backHitSlop = (size.minTouch - size.iconButton) / 2;

// Shown when the not-yet-built comments setting is tapped (DESIGN.md §5 pattern).
const COMMENTS_COMING_SOON = "Comment settings are coming soon.";

/** Settings screen: Account (edit profile, comments setting, sign out) and About (TMDB attribution). */
export default function ProfileSettings() {
  const insets = useSafeAreaInsets();
  const { signOut, isSigningOut } = useSignOut();
  const toast = useToast();

  return (
    <View style={styles.root}>
      <GlassBackdrop blobs={["purple", "gold"]} />
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <GlassCard
          tier="chip"
          onPress={() => router.back()}
          accessibilityLabel="Back"
          hitSlop={backHitSlop}
          style={styles.backChip}
        >
          <Text style={styles.backIcon}>←</Text>
        </GlassCard>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing[24] }]}
      >
        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.rows}>
          <ListRow onPress={() => router.push("/profile/edit")}>
            <Text style={styles.rowLabel}>Edit profile photo / usertag</Text>
          </ListRow>
          <ListRow onPress={() => toast.show(COMMENTS_COMING_SOON)}>
            <Text style={styles.rowLabel}>
              Comments on my collection: <Text style={styles.rowValue}>On</Text>
            </Text>
          </ListRow>
          <ListRow onPress={signOut} busy={isSigningOut}>
            <Text style={styles.rowLabel}>🚪 Sign out</Text>
          </ListRow>
        </View>

        <Text style={styles.sectionLabel}>About</Text>
        <View style={styles.aboutCard}>
          <View style={styles.tmdbRow}>
            <View style={styles.tmdbChip}>
              <Text style={styles.tmdbChipText}>TMDB</Text>
            </View>
            <Text style={styles.tmdbName}>The Movie Database</Text>
          </View>
          <Text style={styles.attribution}>{TMDB_ATTRIBUTION}</Text>
        </View>

        {Constants.expoConfig?.version ? (
          <Text style={styles.version}>Perchable v{Constants.expoConfig.version}</Text>
        ) : null}
      </ScrollView>

      <Toast message={toast.message} variant="coming-soon" />
    </View>
  );
}

const styles = StyleSheet.create({
  // Screen shell and header (title left, nothing in the top-right dev-client corner).
  root: { flex: 1, backgroundColor: colors.bg.base },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[12],
    paddingHorizontal: spacing[20],
  },
  backChip: {
    width: size.iconButton,
    height: size.iconButton,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface.chip,
  },
  backIcon: { fontSize: iconSize.md, color: colors.brand.lavender200 },
  headerTitle: { ...type.subhead, color: colors.brand.lavender200 },

  // Section labels and Account rows.
  content: { paddingHorizontal: spacing[20] },
  sectionLabel: {
    ...type.micro,
    color: colors.text.secondary,
    textTransform: "uppercase",
    letterSpacing: letterSpacing.label,
    marginTop: spacing[24],
    marginBottom: spacing[12],
  },
  rows: { gap: spacing[12] },
  rowLabel: { ...type.body, color: colors.text.primary },
  rowValue: { fontFamily: type.bodyStrong.fontFamily, color: colors.accent.gold },

  // About card with the TMDB chip and the required attribution sentence.
  aboutCard: {
    padding: spacing[16],
    borderRadius: radius.md,
    backgroundColor: glass.nav.backgroundColor,
    borderWidth: 1,
    borderColor: glass.card.borderColor,
  },
  tmdbRow: { flexDirection: "row", alignItems: "center", gap: spacing[8] },
  tmdbChip: {
    width: tmdbChip.width,
    height: tmdbChip.height,
    borderRadius: tmdbChip.radius,
    backgroundColor: colors.brand.tmdbBlue,
    alignItems: "center",
    justifyContent: "center",
  },
  tmdbChipText: {
    fontSize: tmdbChip.fontSize,
    fontFamily: tmdbChip.fontFamily,
    color: colors.brand.tmdbNavy,
  },
  tmdbName: { ...type.micro, color: colors.text.secondary },
  attribution: {
    ...type.caption,
    lineHeight: type.caption.fontSize * leading.relaxed,
    color: colors.text.secondary,
    marginTop: spacing[12],
  },
  version: { ...type.micro, color: colors.text.disabled, marginTop: spacing[16] },
});
