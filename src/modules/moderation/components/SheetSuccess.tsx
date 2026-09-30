import { StyleSheet, Text, View } from "react-native";
import { Button } from "@/ui/Button";
import { colors, iconSize, radius, size, spacing, type } from "@/ui/tokens";

type Props = {
  title: string;
  body: string;
  onDone: () => void;
};

/** Confirmation content shared by the report and block sheets: gold check badge, title, body and a Done button. */
export function SheetSuccess({ title, body, onDone }: Props) {
  return (
    <View style={styles.wrap}>
      <View accessible={false} importantForAccessibility="no-hide-descendants" style={styles.badge}>
        <Text style={styles.check}>✓</Text>
      </View>
      <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={styles.title}>
        {title}
      </Text>
      <Text style={styles.body}>{body}</Text>
      <Button label="Done" onPress={onDone} style={styles.done} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Centred confirmation stack.
  wrap: { alignItems: "center", paddingTop: spacing[8] },
  badge: {
    width: size.badge,
    height: size.badge,
    borderRadius: radius.pill,
    backgroundColor: colors.accent.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  check: { ...type.title, fontSize: iconSize.lg, color: colors.text.onGold },
  title: { ...type.subhead, color: colors.text.primary, marginTop: spacing[16], textAlign: "center" },
  body: { ...type.body, color: colors.text.secondary, marginTop: spacing[8], textAlign: "center" },
  done: { alignSelf: "stretch", marginTop: spacing[24] },
});
