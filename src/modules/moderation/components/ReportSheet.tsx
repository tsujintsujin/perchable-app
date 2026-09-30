import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "@/ui/Button";
import { ErrorCard } from "@/ui/ErrorCard";
import { useAuthSession } from "@/modules/auth";
import { colors, glass, letterSpacing, opacity, radius, size, spacing, type } from "@/ui/tokens";
import { useReportContent } from "../hooks/useReportContent";
import { OBJECTIONABLE_CATEGORIES, REPORT_DETAILS_MAX, type ReportReason } from "../objectionableCategories";
import type { ReportTarget, ReportTargetType } from "../types";
import { SheetShell } from "./SheetShell";
import { SheetSuccess } from "./SheetSuccess";

// DESIGN.md "Build 10b" ReportSheet copy table, verbatim.
const TITLES: Record<ReportTargetType, string> = {
  profile: "Report this profile",
  comment: "Report this comment",
  dm_message: "Report this message",
  collection_item: "Report this caption",
};
const COPY = {
  subhead: "Pick the closest reason. Reports are private.",
  detailsLabel: "Tell us more (required)",
  detailsPlaceholder: "What's the problem?",
  cancel: "Cancel",
  send: "Send report",
  sending: "Sending…",
  retry: "Try again",
  error: "⚠ Couldn't send your report. Check your connection and try again.",
  sentTitle: "Report sent",
  sentBody:
    "Thanks — we'll take a look. Your report is private: the person you reported won't be told it came from you.",
};

type Props = {
  target: ReportTarget;
  /** Closes the sheet: Cancel, scrim, Android back, or Done after sending. */
  onClose: () => void;
  /** Fires once when the report is stored (or was already stored). */
  onReported?: () => void;
};

/** Bottom sheet for reporting a profile, comment, message or caption. Mount it to open it, unmount to close.
 * Renders nothing (and closes) when the target belongs to the signed-in user. */
export function ReportSheet({ target, onClose, onReported }: Props) {
  const { session } = useAuthSession();
  const { status, submit, cancel } = useReportContent(target, onReported);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [focused, setFocused] = useState(false);
  const isOwn = session?.user.id === target.ownerId;

  // A sheet opened on your own content closes itself.
  useEffect(() => {
    if (isOwn) onClose();
  }, [isOwn, onClose]);

  if (isOwn) return null;

  const submitting = status === "submitting";
  const needsDetails = reason === "other";
  const canSend = reason !== null && (!needsDetails || details.trim().length > 0);

  // Every way out; a request still running has its result ignored.
  const dismiss = () => {
    cancel();
    onClose();
  };

  if (status === "sent") {
    return (
      <SheetShell testID="report-sheet" dismissable onDismiss={dismiss}>
        <SheetSuccess title={COPY.sentTitle} body={COPY.sentBody} onDone={dismiss} />
      </SheetShell>
    );
  }

  return (
    <SheetShell
      testID="report-sheet"
      dismissable
      onDismiss={dismiss}
      title={TITLES[target.type]}
      footer={
        <View style={styles.buttons}>
          <Button label={COPY.cancel} variant="secondary-glass" onPress={dismiss} style={styles.button} />
          <Button
            label={status === "error" ? COPY.retry : COPY.send}
            loadingLabel={COPY.sending}
            onPress={() => reason && submit(reason, details)}
            disabled={!canSend}
            loading={submitting}
            style={styles.button}
          />
        </View>
      }
    >
      <Text style={styles.subhead}>{COPY.subhead}</Text>

      <View accessibilityRole="radiogroup" style={[styles.list, submitting && styles.dimmed]}>
        {OBJECTIONABLE_CATEGORIES.map((category) => {
          const selected = reason === category.key;
          return (
            <Pressable
              key={category.key}
              accessibilityRole="radio"
              accessibilityLabel={category.label}
              accessibilityState={{ selected, disabled: submitting }}
              disabled={submitting}
              onPress={() => setReason(category.key)}
              style={[styles.row, selected && styles.rowSelected]}
            >
              <View style={[styles.radio, selected && styles.radioSelected]}>
                {selected && <View style={styles.radioDot} />}
              </View>
              <Text style={styles.rowLabel}>{category.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {needsDetails && (
        <View style={[styles.detailsBlock, submitting && styles.dimmed]}>
          <Text style={styles.detailsLabel}>{COPY.detailsLabel}</Text>
          <TextInput
            value={details}
            onChangeText={setDetails}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            editable={!submitting}
            multiline
            maxLength={REPORT_DETAILS_MAX}
            placeholder={COPY.detailsPlaceholder}
            placeholderTextColor={colors.text.disabled}
            accessibilityLabel="Tell us more"
            accessibilityHint="Required"
            textAlignVertical="top"
            style={[styles.input, focused && styles.inputFocused]}
          />
          <Text style={styles.counter}>{`${details.length}/${REPORT_DETAILS_MAX}`}</Text>
        </View>
      )}

      {status === "error" && <ErrorCard message={COPY.error} style={styles.error} textStyle={type.small} />}
    </SheetShell>
  );
}

const styles = StyleSheet.create({
  // Subhead and the reason list; dimmed while a request is running.
  subhead: { ...type.body, color: colors.text.secondary, marginTop: spacing[4], marginBottom: spacing[16] },
  list: { gap: spacing[6] },
  dimmed: { opacity: opacity.disabled },

  // One reason row, its selected look, and the radio inside it.
  row: {
    minHeight: size.minTouch,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[12],
    paddingHorizontal: spacing[16],
    borderRadius: radius.sm,
    backgroundColor: colors.surface.input,
    borderWidth: 1,
    borderColor: colors.border.hairline,
  },
  rowSelected: { backgroundColor: colors.surface.goldTint, borderColor: colors.border.gold },
  rowLabel: { ...type.body, color: colors.text.primary, flexShrink: 1 },
  radio: {
    width: size.radio,
    height: size.radio,
    borderRadius: radius.pill,
    borderWidth: size.radioRing,
    borderColor: colors.text.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: { borderColor: colors.accent.gold },
  radioDot: {
    width: size.radioDot,
    height: size.radioDot,
    borderRadius: radius.pill,
    backgroundColor: colors.accent.gold,
  },

  // "Something else" details box with its label and counter.
  detailsBlock: { marginTop: spacing[8] },
  detailsLabel: {
    ...type.caption,
    color: colors.text.secondary,
    textTransform: "uppercase",
    letterSpacing: letterSpacing.label,
    marginBottom: spacing[8],
  },
  input: {
    ...type.body,
    minHeight: size.detailsInput,
    padding: spacing[12],
    borderRadius: radius.sm,
    backgroundColor: glass.chip.backgroundColor,
    borderWidth: 1,
    borderColor: colors.border.hairline,
    color: colors.text.primary,
  },
  inputFocused: { borderColor: colors.border.hairlineStrong },
  counter: { ...type.caption, color: colors.text.disabled, textAlign: "right", marginTop: spacing[4] },

  // Failure card and the pinned Cancel / Send row.
  error: { marginTop: spacing[12], padding: spacing[12] },
  buttons: { flexDirection: "row", gap: spacing[10], marginTop: spacing[16] },
  button: { flex: 1 },
});
