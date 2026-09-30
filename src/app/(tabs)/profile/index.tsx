import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect, type Href } from "expo-router";
import { GlassBackdrop } from "@/ui/GlassBackdrop";
import { GlassCard } from "@/ui/GlassCard";
import { Avatar } from "@/ui/Avatar";
import { EmptyState } from "@/ui/EmptyState";
import {
  avatarSize,
  colors,
  iconButtonHitSlop,
  iconSize,
  radius,
  shimmerBar,
  size,
  spacing,
  type,
} from "@/ui/tokens";
import { useOwnProfile } from "@/modules/profile";

/** My Profile screen — collection grid (movies watched) is a later module. */
export default function MyProfile() {
  const profile = useOwnProfile();
  const insets = useSafeAreaInsets();
  const pushedRef = useRef(false);

  // Re-arms navigation each time this screen regains focus.
  useFocusEffect(
    useCallback(() => {
      pushedRef.current = false;
    }, []),
  );

  // Pushes a route once per focus, so a double tap can't stack two screens.
  // A failed push re-arms the guard so the chips don't stay dead.
  const go = (target: Href) => {
    if (pushedRef.current) return;
    pushedRef.current = true;
    try {
      router.push(target);
    } catch (err) {
      pushedRef.current = false;
      throw err;
    }
  };

  return (
    <View style={styles.root}>
      <GlassBackdrop blobs={["purple", "gold"]} />
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Text style={styles.headerTitle}>My Profile</Text>
        {/* Settings chip: DESIGN.md gives this its own color/border, not
         * glass.chip's own, applied via a style override. */}
        <GlassCard
          tier="chip"
          onPress={() => go("/profile/settings")}
          accessibilityLabel="Settings"
          hitSlop={iconButtonHitSlop}
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

          {/* One chip in both states: tapping it opens Edit profile. */}
          <Pressable
            style={styles.usertagChip}
            onPress={() => go({ pathname: "/profile/edit", params: { focus: "usertag" } })}
            accessibilityRole="button"
            accessibilityLabel={
              profile.profile.usertag
                ? `Edit usertag, currently @${profile.profile.usertag}`
                : "Add a usertag"
            }
          >
            {profile.profile.usertag ? (
              <Text style={styles.usertagText}>@{profile.profile.usertag}</Text>
            ) : (
              <Text style={styles.usertagText}>
                No usertag yet — <Text style={styles.usertagBold}>add a usertag</Text>
              </Text>
            )}
          </Pressable>

          <Text style={styles.moviesCount}>0 movies watched</Text>
          <View style={styles.moviesGrid} />
        </View>
      )}
    </View>
  );
}

/** Shimmer placeholders matching the loaded layout's shape. No shared
 * shimmer component exists yet, so a local pulse animation stands in. */
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
      <Animated.View testID="shimmer-avatar" style={[styles.shimmerCircle, { opacity: pulse }]} />
      <Animated.View testID="shimmer-name" style={[styles.shimmerBar, styles.shimmerName, { opacity: pulse }]} />
      <View style={styles.shimmerTagSlot}>
        <Animated.View testID="shimmer-usertag" style={[styles.shimmerBar, styles.shimmerTag, { opacity: pulse }]} />
      </View>
      <Animated.View
        testID="shimmer-count"
        style={[styles.shimmerBar, styles.shimmerTag, styles.shimmerCount, { opacity: pulse }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[20],
  },
  headerTitle: { ...type.subhead, color: colors.text.secondary },
  settingsChip: {
    width: size.iconButton,
    height: size.iconButton,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginRight: size.headerTrailingInset,
    // Distinct from glass.chip's own token values, per DESIGN.md.
    backgroundColor: colors.surface.chip,
    borderWidth: 1,
    borderColor: colors.border.hairline,
  },
  settingsIcon: { fontSize: iconSize.md, color: colors.text.primary },
  centerBody: { flex: 1, alignItems: "center", justifyContent: "center" },
  body: { flex: 1, alignItems: "center", paddingTop: spacing[32], paddingHorizontal: spacing[20] },
  name: {
    marginTop: spacing[16],
    ...type.title,
    color: colors.text.primary,
  },
  usertagChip: {
    marginTop: spacing[12],
    minHeight: size.minTouch,
    justifyContent: "center",
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[16],
    borderRadius: radius.pill,
    backgroundColor: colors.surface.input,
    borderWidth: 1,
    borderColor: colors.border.hairline,
  },
  usertagText: { ...type.body, color: colors.text.secondary },
  usertagBold: { fontFamily: type.bodyStrong.fontFamily, color: colors.text.primary },
  moviesCount: {
    marginTop: spacing[24],
    ...type.caption,
    color: colors.text.secondary,
    alignSelf: "flex-start",
  },
  moviesGrid: {
    width: "100%",
    minHeight: size.collectionGridMin,
    marginTop: spacing[12],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.hairline,
    borderStyle: "dashed",
  },
  shimmerCircle: {
    width: avatarSize.lg,
    height: avatarSize.lg,
    borderRadius: avatarSize.lg / 2,
    backgroundColor: colors.bg.elevatedFlat,
  },
  shimmerBar: { borderRadius: radius.sm, backgroundColor: colors.bg.elevatedFlat },
  shimmerName: { ...shimmerBar.name, marginTop: spacing[16] },
  shimmerTag: { ...shimmerBar.line },
  shimmerTagSlot: { marginTop: spacing[12], minHeight: size.minTouch, justifyContent: "center" },
  shimmerCount: { marginTop: spacing[24], alignSelf: "flex-start" },
});
