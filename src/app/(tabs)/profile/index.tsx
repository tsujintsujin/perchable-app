import { useEffect, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { GlassBackdrop } from "@/ui/GlassBackdrop";
import { GlassCard } from "@/ui/GlassCard";
import { Avatar } from "@/ui/Avatar";
import { EmptyState } from "@/ui/EmptyState";
import { colors, radius, spacing } from "@/ui/tokens";
import { useOwnProfile } from "@/modules/profile";

/**
 * (tabs)/profile/index — DESIGN.md "Build 6 — My Profile screen". Collection
 * grid content (movies watched) is Module 3+ scope — this Build only renders
 * the row/container shell per the spec's Build 6 scope note.
 */
export default function MyProfile() {
  const profile = useOwnProfile();

  return (
    <View style={styles.root}>
      <GlassBackdrop blobs={["purple", "gold"]} />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Profile</Text>
        {/* 36×36 chip, inset left of the reserved 64×64 dev-client gear
         * corner (DESIGN.md §7) — never a bare top-right icon. DESIGN.md's
         * Build 6 layout spec gives this an explicit
         * rgba(76,29,149,.3)/border.hairline look, not `glass.chip`'s own
         * (darker, borderless) token values — override via `style` rather
         * than adding a variant tier just for this one button
         * (Build 6 · Bug 1). */}
        <GlassCard
          tier="chip"
          onPress={() => router.push("/profile/settings")}
          style={styles.settingsChip}
        >
          <Text style={styles.settingsIcon}>⚙</Text>
        </GlassCard>
      </View>

      {profile.state === "loading" && <LoadingBody />}
      {profile.state === "error" && (
        <View style={styles.centerBody}>
          <EmptyState
            icon="🦉"
            title="Couldn't load your profile"
            body="Check your connection and try again."
            action={{ label: "Retry", onPress: profile.refetch }}
          />
        </View>
      )}
      {profile.state === "loaded" && (
        <View style={styles.body}>
          <Avatar
            uri={profile.profile.avatarUrl}
            name={profile.profile.displayName}
            size="lg"
            ringGradient
          />
          <Text style={styles.name}>{profile.profile.displayName ?? "Unnamed"}</Text>

          {profile.profile.usertag ? (
            <View style={styles.usertagChip}>
              <Text style={styles.usertagText}>@{profile.profile.usertag}</Text>
            </View>
          ) : (
            <Pressable
              style={styles.usertagChip}
              onPress={() => router.push("/profile/edit")}
            >
              <Text style={styles.usertagText}>
                No usertag yet — <Text style={styles.usertagBold}>add a usertag</Text>
              </Text>
            </Pressable>
          )}

          <View style={styles.rows}>
            <GlassCard tier="card" onPress={() => router.push("/profile/edit")} style={styles.row}>
              <Text style={styles.rowLabel}>✏️ Edit profile</Text>
            </GlassCard>
            <GlassCard
              tier="card"
              onPress={() => router.push("/profile/settings")}
              style={styles.row}
            >
              <Text style={styles.rowLabel}>⚙ Settings</Text>
            </GlassCard>
          </View>

          <Text style={styles.moviesCount}>0 movies watched</Text>
          <View style={styles.moviesGrid} />
        </View>
      )}
    </View>
  );
}

/** Shimmer placeholders in the loaded layout's shape (DESIGN.md Build 6).
 * No shared shimmer component exists yet (PosterCard, which the spec says
 * to reuse, is Build 12) — a small local pulse animation stands in until
 * then. */
function LoadingBody() {
  const [pulse] = useState(() => new Animated.Value(0.4));

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.9, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <View style={styles.body}>
      <Animated.View style={[styles.shimmerCircle, { opacity: pulse }]} />
      <Animated.View style={[styles.shimmerBar, styles.shimmerName, { opacity: pulse }]} />
      <Animated.View style={[styles.shimmerBar, styles.shimmerTag, { opacity: pulse }]} />
      <View style={styles.rows}>
        <Animated.View style={[styles.shimmerRow, { opacity: pulse }]} />
        <Animated.View style={[styles.shimmerRow, { opacity: pulse }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 56,
    paddingHorizontal: spacing[20],
  },
  headerTitle: { fontFamily: "Poppins_700Bold", fontSize: 19, color: colors.text.secondary },
  settingsChip: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 44,
    // Exact DESIGN.md Build 6 values — not glass.chip's own token.
    backgroundColor: "rgba(76,29,149,0.3)",
    borderWidth: 1,
    borderColor: colors.border.hairline,
  },
  settingsIcon: { fontSize: 16, color: colors.text.primary },
  centerBody: { flex: 1, alignItems: "center", justifyContent: "center" },
  body: { flex: 1, alignItems: "center", paddingTop: spacing[32], paddingHorizontal: spacing[20] },
  name: {
    marginTop: spacing[16],
    fontFamily: "Poppins_800ExtraBold",
    fontSize: 24,
    color: colors.text.primary,
  },
  usertagChip: {
    marginTop: spacing[12],
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[16],
    borderRadius: radius.pill,
    backgroundColor: "rgba(76,29,149,0.28)",
    borderWidth: 1,
    borderColor: colors.border.hairline,
  },
  usertagText: { fontFamily: "Inter_400Regular", fontSize: 15, color: colors.text.secondary },
  usertagBold: { fontFamily: "Inter_600SemiBold", color: colors.text.primary },
  rows: { width: "100%", marginTop: spacing[32], gap: spacing[12] },
  row: { padding: spacing[16], borderRadius: radius.md },
  rowLabel: { fontFamily: "Inter_400Regular", fontSize: 15, color: colors.text.primary },
  moviesCount: {
    marginTop: spacing[32],
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: colors.text.secondary,
    alignSelf: "flex-start",
  },
  moviesGrid: {
    width: "100%",
    minHeight: 96,
    marginTop: spacing[8],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.hairline,
    borderStyle: "dashed",
  },
  shimmerCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.bg.elevatedFlat,
  },
  shimmerBar: { borderRadius: radius.sm, backgroundColor: colors.bg.elevatedFlat },
  shimmerName: { width: 160, height: 22, marginTop: spacing[16] },
  shimmerTag: { width: 120, height: 16, marginTop: spacing[12] },
  shimmerRow: {
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.bg.elevatedFlat,
  },
});
