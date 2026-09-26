import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "@/ui/tokens";

type Props = {
  icon: string;
  title: string;
  body: string;
  action?: { label: string; onPress: () => void };
};

/** One component for every data screen's empty/error case (DESIGN.md §2). */
export function EmptyState({ icon, title, body, action }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {action && (
        <Pressable onPress={action.onPress} style={styles.button}>
          <Text style={styles.buttonLabel}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", padding: spacing[24] },
  icon: { fontSize: 32, marginBottom: spacing[12] },
  title: {
    fontFamily: "Poppins_700Bold",
    fontSize: 19,
    color: colors.text.primary,
    textAlign: "center",
  },
  body: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: colors.text.secondary,
    textAlign: "center",
    marginTop: spacing[8],
  },
  button: {
    marginTop: spacing[20],
    paddingVertical: spacing[12],
    paddingHorizontal: spacing[24],
    borderRadius: radius.pill,
    backgroundColor: colors.accent.gold,
  },
  buttonLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: colors.text.onGold,
  },
});
