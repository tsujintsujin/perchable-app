import { StyleSheet, Text, View } from "react-native";
import { Button } from "@/ui/Button";
import { ErrorCard } from "@/ui/ErrorCard";
import { colors, spacing, type } from "@/ui/tokens";
import { useBlockUser } from "../hooks/useBlockUser";
import { SheetShell } from "./SheetShell";
import { SheetSuccess } from "./SheetSuccess";

// DESIGN.md "Build 10b" BlockUserSheet copy table, verbatim; {name} is the display name or "this user".
const FALLBACK_NAME = "this user";
const COPY = {
  title: (name: string) => `Block ${name}?`,
  body1: (name: string) => `Blocking tells Perchable you don't want to interact with ${name}.`,
  body2: "We won't tell them. You can undo this any time in Settings › Blocked users.",
  cancel: "Cancel",
  block: "Block",
  blocking: "Blocking…",
  retry: "Try again",
  error: (name: string) => `⚠ Couldn't block ${name}. Check your connection and try again.`,
  blockedTitle: (name: string) => `${name} is blocked`,
  blockedBody: "You can undo this any time in Settings › Blocked users.",
};

type Props = {
  userId: string;
  displayName?: string;
  /** Closes the sheet: Cancel, scrim, Android back (never while blocking), or Done. */
  onClose: () => void;
  /** Fires once when the block is stored (or already was). */
  onBlocked?: () => void;
};

/** Confirmation sheet for blocking a user. Mount it to open it, unmount to close. */
export function BlockUserSheet({ userId, displayName, onClose, onBlocked }: Props) {
  const { status, block, isInFlight } = useBlockUser(userId, onBlocked);
  const name = displayName?.trim() || FALLBACK_NAME;
  const blocking = status === "blocking";

  // Scrim, back and Cancel end here; a running write can't be dismissed (isInFlight covers the tap-to-render frame).
  const dismiss = () => {
    if (!blocking && !isInFlight()) onClose();
  };

  if (status === "blocked") {
    return (
      <SheetShell testID="block-sheet" dismissable onDismiss={dismiss}>
        <SheetSuccess title={COPY.blockedTitle(name)} body={COPY.blockedBody} onDone={onClose} />
      </SheetShell>
    );
  }

  return (
    <SheetShell
      testID="block-sheet"
      dismissable={!blocking}
      onDismiss={dismiss}
      title={COPY.title(name)}
      titleLines={2}
      footer={
        <View style={styles.buttons}>
          <Button label={COPY.cancel} variant="secondary-glass" onPress={dismiss} disabled={blocking} style={styles.button} />
          <Button
            label={status === "error" ? COPY.retry : COPY.block}
            loadingLabel={COPY.blocking}
            variant="destructive"
            onPress={block}
            loading={blocking}
            style={styles.button}
          />
        </View>
      }
    >
      <Text style={styles.body}>{COPY.body1(name)}</Text>
      <Text style={styles.body}>{COPY.body2}</Text>
      {status === "error" && <ErrorCard message={COPY.error(name)} style={styles.error} textStyle={type.small} />}
    </SheetShell>
  );
}

const styles = StyleSheet.create({
  // Two body paragraphs and the failure card.
  body: { ...type.body, color: colors.text.secondary, marginTop: spacing[8] },
  error: { marginTop: spacing[16], padding: spacing[12] },

  // Pinned Cancel / Block row.
  buttons: { flexDirection: "row", gap: spacing[10], marginTop: spacing[24] },
  button: { flex: 1 },
});
