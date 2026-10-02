import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, iconSize, radius, size, spacing, type } from "@/ui/tokens";

type Props = {
  icon: string;
  title: string;
  body: string;
  action?: {
    label: string;
    onPress: () => void;
    /** Overrides the visible label for screen readers. */
    accessibilityLabel?: string;
  };
};

/** One component for every data screen's empty/error case (DESIGN.md §2). */
export function EmptyState({ icon, title, body, action }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {action && (
        <Pressable
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.accessibilityLabel}
          style={styles.button}
        >
          <Text style={styles.buttonLabel}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", padding: spacing[24] },
  icon: { fontSize: iconSize.emoji, marginBottom: spacing[12] },
  title: {
    ...type.subhead,
    color: colors.text.primary,
    textAlign: "center",
  },
  body: {
    ...type.body,
    color: colors.text.secondary,
    textAlign: "center",
    marginTop: spacing[8],
  },
  button: {
    marginTop: spacing[20],
    minHeight: size.minTouch,
    justifyContent: "center",
    paddingVertical: spacing[12],
    paddingHorizontal: spacing[24],
    borderRadius: radius.pill,
    backgroundColor: colors.accent.gold,
  },
  buttonLabel: {
    ...type.bodyStrong,
    color: colors.text.onGold,
  },
});
