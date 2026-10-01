import { StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { colors, opacity, radius, spacing, type } from "@/ui/tokens";
import type { BlockedUser } from "../types";

// DESIGN.md "Build 10b" Blocked users copy table, verbatim.
const FALLBACK_NAME = "Perchable user";
const COPY = {
  unblock: "Unblock",
  unblocking: "Unblocking…",
  cancel: "Cancel",
  confirmTitle: (first: string | null) => (first ? `Unblock ${first}?` : "Unblock this user?"),
  confirmBody: "This removes them from your blocked list.",
};

/** First word of a display name, or null when there is none. */
export function firstName(displayName: string | null): string | null {
  return displayName?.trim().split(/\s+/)[0] || null;
}

type Props = {
  user: BlockedUser;
  /** True while this row shows its inline "Unblock {name}?" confirmation. */
  confirming: boolean;
  /** True while this row's unblock request is running. */
  busy: boolean;
  onAskUnblock: () => void;
  onCancel: () => void;
  onConfirm: () => void;
};

/** One blocked user: avatar, name, usertag and an Unblock button that expands into a two-tap confirmation. */
export function BlockedUserRow({ user, confirming, busy, onAskUnblock, onCancel, onConfirm }: Props) {
  const name = user.displayName?.trim() || FALLBACK_NAME;

  return (
    <View style={[styles.card, confirming && styles.cardConfirming]}>
      <View style={styles.top}>
        <View style={[styles.identity, busy && styles.dimmed]}>
          <View accessible={false}>
            <Avatar uri={user.avatarUrl} name={user.displayName} size="md" />
          </View>
          <View style={styles.names}>
            <Text numberOfLines={1} style={styles.name}>
              {name}
            </Text>
            {user.usertag ? <Text style={styles.tag}>@{user.usertag}</Text> : null}
          </View>
        </View>
        {!confirming && (
          <Button
            label={COPY.unblock}
            accessibilityLabel={`Unblock ${name}`}
            loadingLabel={COPY.unblocking}
            variant="secondary-glass"
            onPress={onAskUnblock}
            loading={busy}
          />
        )}
      </View>

      {confirming && (
        <View>
          <Text style={styles.confirmTitle}>{COPY.confirmTitle(firstName(user.displayName))}</Text>
          <Text style={styles.confirmBody}>{COPY.confirmBody}</Text>
          <View style={styles.buttons}>
            <Button label={COPY.cancel} variant="secondary-glass" onPress={onCancel} style={styles.button} />
            <Button label={COPY.unblock} onPress={onConfirm} style={styles.button} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Row card and its expanded (confirming) border.
  card: {
    paddingVertical: spacing[12],
    paddingHorizontal: spacing[16],
    borderRadius: radius.md,
    backgroundColor: colors.surface.input,
    borderWidth: 1,
    borderColor: colors.border.hairline,
  },
  cardConfirming: { borderColor: colors.border.gold },
  top: { flexDirection: "row", alignItems: "center", gap: spacing[12] },
  identity: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing[12] },
  dimmed: { opacity: opacity.disabled },
  names: { flex: 1 },
  name: { ...type.bodyStrong, color: colors.text.primary },
  tag: { ...type.caption, color: colors.text.secondary },

  // Inline confirmation text and its Cancel / Unblock pair.
  confirmTitle: { ...type.bodyStrong, color: colors.text.primary, marginTop: spacing[12] },
  confirmBody: { ...type.body, color: colors.text.secondary, marginTop: spacing[4] },
  buttons: { flexDirection: "row", gap: spacing[10], marginTop: spacing[12] },
  button: { flex: 1 },
});
