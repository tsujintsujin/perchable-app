import { useState } from "react";
import { Animated, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { EmptyState } from "@/ui/EmptyState";
import { ErrorCard } from "@/ui/ErrorCard";
import { GlassBackdrop } from "@/ui/GlassBackdrop";
import { GlassCard } from "@/ui/GlassCard";
import { usePulse } from "@/ui/Shimmer";
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
import { useBlockedUsers } from "../hooks/useBlockedUsers";
import { BlockedUserRow, firstName } from "./BlockedUserRow";

// DESIGN.md "Build 10b" Blocked users copy table, verbatim.
const COPY = {
  header: "Blocked users",
  intro: "People you've blocked appear here. Unblock anyone to undo a block.",
  emptyTitle: "No blocked users",
  emptyBody: "People you block will show up here.",
  loadErrorTitle: "Couldn't load blocked users",
  loadErrorBody: "Check your connection and try again.",
  retry: "Retry",
  unblockError: (first: string | null) =>
    `⚠ Couldn't unblock ${first ?? "this user"}. Check your connection and try again.`,
};

/** Number of shimmer rows shown while the list loads. */
const SHIMMER_ROWS = 3;

/** Blocked users screen: the caller's blocks with an inline two-tap Unblock. The route file only renders this. */
export function BlockedUsersScreen() {
  const insets = useSafeAreaInsets();
  const blocked = useBlockedUsers();
  // Only one row shows its confirmation at a time.
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const users = blocked.state === "loaded" ? blocked.users : [];
  const failedUser = users.find((u) => u.id === blocked.failedId);

  // Opens one row's confirmation (closing any other) and hides an old failure card.
  const askUnblock = (id: string) => {
    blocked.clearFailure();
    setConfirmId(id);
  };

  // Confirms the unblock: the confirmation closes and the row shows its own busy state.
  const confirmUnblock = (id: string) => {
    setConfirmId(null);
    blocked.unblock(id);
  };

  return (
    <View style={styles.root}>
      <GlassBackdrop blobs={["purple", "gold"]} />
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <GlassCard
          tier="chip"
          onPress={() => router.back()}
          accessibilityLabel="Back"
          hitSlop={iconButtonHitSlop}
          style={styles.backChip}
        >
          <Text style={styles.backIcon}>←</Text>
        </GlassCard>
        <Text accessibilityRole="header" style={styles.headerTitle}>
          {COPY.header}
        </Text>
      </View>

      {blocked.state === "error" ? (
        <View style={styles.center}>
          <EmptyState
            icon="🦉"
            title={COPY.loadErrorTitle}
            body={COPY.loadErrorBody}
            action={{ label: COPY.retry, onPress: blocked.refetch }}
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing[24] }]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.intro}>{COPY.intro}</Text>

          {blocked.state === "loading" && (
            <View style={styles.list}>
              <ShimmerRows />
            </View>
          )}

          {blocked.state === "loaded" && users.length === 0 && (
            <EmptyState icon="🚫" title={COPY.emptyTitle} body={COPY.emptyBody} />
          )}

          {blocked.state === "loaded" && users.length > 0 && (
            <View style={styles.list}>
              {failedUser && (
                <ErrorCard message={COPY.unblockError(firstName(failedUser.displayName))} textStyle={type.small} />
              )}
              {users.map((user) => (
                <BlockedUserRow
                  key={user.id}
                  user={user}
                  confirming={confirmId === user.id}
                  busy={blocked.busyIds.includes(user.id)}
                  onAskUnblock={() => askUnblock(user.id)}
                  onCancel={() => setConfirmId(null)}
                  onConfirm={() => confirmUnblock(user.id)}
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

/** Pulsing placeholder rows in the shape of a blocked-user row. */
function ShimmerRows() {
  const pulse = usePulse();

  return (
    <>
      {Array.from({ length: SHIMMER_ROWS }, (_, i) => (
        <Animated.View key={i} testID="shimmer-row" style={[styles.shimmerRow, { opacity: pulse }]}>
          <View style={styles.shimmerAvatar} />
          <View style={styles.shimmerNames}>
            <View style={[styles.shimmerBar, shimmerBar.line]} />
            <View style={[styles.shimmerBar, shimmerBar.tag]} />
          </View>
          <View style={[styles.shimmerBar, shimmerBar.button]} />
        </Animated.View>
      ))}
    </>
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

  // Intro line, list and the load-error centring.
  content: { paddingHorizontal: spacing[20] },
  intro: { ...type.body, color: colors.text.secondary, marginTop: spacing[16], marginBottom: spacing[16] },
  list: { gap: spacing[12] },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  // Loading placeholder row.
  shimmerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[12],
    paddingVertical: spacing[12],
    paddingHorizontal: spacing[16],
    borderRadius: radius.md,
    backgroundColor: colors.surface.input,
    borderWidth: 1,
    borderColor: colors.border.hairline,
  },
  shimmerAvatar: {
    width: avatarSize.md,
    height: avatarSize.md,
    borderRadius: avatarSize.md / 2,
    backgroundColor: colors.bg.elevatedFlat,
  },
  shimmerNames: { flex: 1, gap: spacing[8] },
  shimmerBar: { borderRadius: radius.sm, backgroundColor: colors.bg.elevatedFlat },
});
