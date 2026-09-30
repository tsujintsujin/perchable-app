import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import {
  AccessibilityInfo,
  findNodeHandle,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, elevation, glass, radius, size, spacing, type } from "@/ui/tokens";

type Props = {
  testID: string;
  /** Scrim tap and Android back; the sheet decides what dismissing means. */
  onDismiss: () => void;
  /** False while a write is in flight: the scrim stops being a button and back does nothing. */
  dismissable: boolean;
  /** Sheet title, focused for screen readers on open. Omit when the body brings its own (success states). */
  title?: string;
  titleLines?: number;
  /** Scrolling content under the title. */
  children: ReactNode;
  /** Pinned button row under the body; omit when the body has its own buttons. */
  footer?: ReactNode;
};

/** Bottom-sheet overlay shared by the report and block sheets: flat surface (no blur on Android),
 * scrim, drag handle, title, scrolling body and a pinned footer. Mount it to open it. */
export function SheetShell({ testID, onDismiss, dismissable, title, titleLines, children, footer }: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const titleRef = useRef<Text>(null);

  // Moves screen-reader focus to the title when the sheet opens.
  useEffect(() => {
    const node = titleRef.current ? findNodeHandle(titleRef.current) : null;
    if (node) AccessibilityInfo.setAccessibilityFocus(node);
  }, []);

  const dismiss = () => {
    if (dismissable) onDismiss();
  };

  return (
    <Modal testID={testID} transparent animationType="slide" statusBarTranslucent onRequestClose={dismiss}>
      <KeyboardAvoidingView behavior="padding" style={styles.overlay}>
        <Pressable
          style={styles.scrim}
          onPress={dismiss}
          accessibilityLabel={dismissable ? "Close" : undefined}
          accessibilityRole={dismissable ? "button" : undefined}
          accessible={dismissable}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            { maxHeight: height * size.sheetMaxHeightRatio, paddingBottom: insets.bottom + spacing[24] },
          ]}
        >
          <View style={styles.handle} />
          {title !== undefined && (
            <Text ref={titleRef} accessibilityRole="header" numberOfLines={titleLines} style={styles.title}>
              {title}
            </Text>
          )}
          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Dimmed backdrop with the sheet pinned to the bottom.
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: colors.overlay.scrim },
  scrim: StyleSheet.absoluteFill,

  // Flat opaque sheet surface with a hairline border on the top and sides.
  sheet: {
    flexShrink: 1,
    backgroundColor: colors.bg.elevatedFlat,
    borderColor: glass.sheet.borderColor,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    elevation: elevation.modal,
    paddingTop: spacing[16],
    paddingHorizontal: spacing[20],
  },
  handle: {
    alignSelf: "center",
    width: size.dragHandle.width,
    height: size.dragHandle.height,
    borderRadius: radius.pill,
    backgroundColor: glass.sheet.borderColor,
    marginBottom: spacing[16],
  },
  title: { ...type.subhead, color: colors.text.primary },
  body: { flexGrow: 0, flexShrink: 1 },
});
