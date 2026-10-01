import { useState } from "react";
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "@/ui/Button";
import { ErrorCard } from "@/ui/ErrorCard";
import { GlassCard } from "@/ui/GlassCard";
import {
  colors,
  dangerGlow,
  glass,
  leading,
  letterSpacing,
  radius,
  size,
  spacing,
  type,
} from "@/ui/tokens";
import { useSheetLayout } from "@/ui/useSheetLayout";
import { useDeleteAccount } from "../hooks/useDeleteAccount";

/** The exact text the user must type to enable the delete button (case-sensitive). */
export const DELETE_CONFIRM_WORD = "DELETE";

// DESIGN.md "Build 9" copy table, verbatim.
const COPY = {
  title: "Delete your account?",
  listIntro: "This permanently deletes:",
  listItems: [
    "Your profile, photo and usertag",
    "Your watched collection and captions",
    "Your comments, DMs and follow graph",
    "Your Google sign-in link to Perchable",
  ],
  irreversible: "This can't be undone. You'd need a fresh Google sign-up to use Perchable again.",
  prompt: `Type ${DELETE_CONFIRM_WORD} to confirm:`,
  confirm: "Delete my account",
  confirming: "Deleting…",
  status: "Deleting your data — this may take a moment.",
  cancel: "Cancel",
  // Not in DESIGN.md: modelled on the sign-in screen's failure message.
  error: "⚠ Couldn't delete your account. Check your connection and try again.",
};

type Props = {
  /** Closes the sheet; never called while a delete is running. */
  onClose: () => void;
};

/** Bottom sheet that confirms and runs account deletion. Mount it to open it, unmount to close. */
export function DeleteAccountSheet({ onClose }: Props) {
  const layout = useSheetLayout();
  const { deleteAccount, isDeleting, failed, isInFlight } = useDeleteAccount();
  const [typed, setTyped] = useState("");

  // Backdrop tap, Android back and Cancel all end here; a running delete can't be dismissed.
  // isInFlight covers the frame between the Delete tap and the re-render that sets isDeleting.
  const dismiss = () => {
    if (!isDeleting && !isInFlight()) onClose();
  };

  return (
    <Modal testID="delete-account-sheet" transparent animationType="slide" statusBarTranslucent onRequestClose={dismiss}>
      <KeyboardAvoidingView behavior="padding" style={styles.overlay}>
        <Pressable
          style={styles.scrim}
          onPress={dismiss}
          accessibilityLabel="Close"
          accessibilityRole="button"
          accessibilityState={{ disabled: isDeleting }}
        />
        <View style={styles.glow}>
          <GlassCard
            tier="sheet"
            testID="delete-account-sheet-sheet"
            style={[styles.sheet, layout]}
          >
            <View style={styles.handle} />
            {/* Title and body scroll when the sheet is capped; the buttons stay pinned. */}
            <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
              <Text accessibilityRole="header" style={styles.title}>
                {COPY.title}
              </Text>

              {isDeleting ? (
                <Text style={styles.status}>{COPY.status}</Text>
              ) : (
                <>
                  <Text style={styles.listIntro}>{COPY.listIntro}</Text>
                  {COPY.listItems.map((item) => (
                    <Text key={item} style={styles.listItem}>{`• ${item}`}</Text>
                  ))}
                  <Text style={styles.note}>{COPY.irreversible}</Text>
                  <Text importantForAccessibility="no" style={styles.prompt}>
                    {COPY.prompt}
                  </Text>
                  <TextInput
                    value={typed}
                    onChangeText={setTyped}
                    placeholder={DELETE_CONFIRM_WORD}
                    placeholderTextColor={colors.text.disabled}
                    accessibilityLabel={COPY.prompt}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    spellCheck={false}
                    style={styles.input}
                  />
                  {failed && <ErrorCard message={COPY.error} style={styles.error} textStyle={type.small} />}
                </>
              )}
            </ScrollView>

            <View style={styles.buttons}>
              <Button
                label={COPY.cancel}
                variant="secondary-glass"
                onPress={dismiss}
                disabled={isDeleting}
                style={styles.button}
              />
              <Button
                label={COPY.confirm}
                loadingLabel={COPY.confirming}
                variant="destructive"
                onPress={deleteAccount}
                disabled={typed !== DELETE_CONFIRM_WORD}
                loading={isDeleting}
                style={styles.button}
              />
            </View>
          </GlassCard>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Dimmed backdrop with the sheet pinned to the bottom.
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: colors.overlay.scrim },
  scrim: StyleSheet.absoluteFill,

  // Sheet surface: opaque on Android (no real blur), danger border and glow.
  glow: { ...dangerGlow, flexShrink: 1 },
  sheet: {
    flexShrink: 1,
    backgroundColor: colors.bg.elevatedFlat,
    borderColor: colors.border.danger,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing[24],
    paddingHorizontal: spacing[20],
  },
  body: { flexGrow: 0, flexShrink: 1 },
  handle: {
    alignSelf: "center",
    width: size.dragHandle.width,
    height: size.dragHandle.height,
    borderRadius: radius.pill,
    backgroundColor: glass.sheet.borderColor,
    marginBottom: spacing[16],
  },

  // Title, deletion list and irreversibility note.
  title: { ...type.subhead, color: colors.danger },
  status: { ...type.small, color: colors.text.secondary, marginTop: spacing[12] },
  listIntro: { ...type.small, color: colors.text.secondary, marginTop: spacing[12] },
  listItem: {
    ...type.small,
    lineHeight: type.small.fontSize * leading.relaxed,
    color: colors.text.primary,
    marginTop: spacing[4],
  },
  note: { ...type.micro, color: colors.text.secondary, marginTop: spacing[12] },

  // Type-to-confirm prompt, input and failure card.
  prompt: { ...type.small, color: colors.text.secondary, marginTop: spacing[20] },
  input: {
    ...type.label,
    height: size.minTouch,
    marginTop: spacing[8],
    paddingHorizontal: spacing[16],
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.danger,
    backgroundColor: glass.chip.backgroundColor,
    color: colors.text.primary,
    letterSpacing: letterSpacing.input,
  },
  error: { marginTop: spacing[12], padding: spacing[12] },

  // Cancel and confirm side by side.
  buttons: { flexDirection: "row", gap: spacing[12], marginTop: spacing[20] },
  button: { flex: 1 },
});
