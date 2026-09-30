import type { StyleProp, TextStyle, ViewStyle } from "react-native";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "@/ui/tokens";

type Props = {
  message: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

// Shared inline error card shell (glass surface + danger border); callers
// supply their own text size via textStyle and their own spacing via style.
export function ErrorCard({ message, style, textStyle }: Props) {
  return (
    <View
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.card, style]}
    >
      <Text style={[styles.text, textStyle]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing[16],
    borderRadius: radius.md,
    backgroundColor: colors.surface.input,
    borderWidth: 1,
    borderColor: colors.border.danger,
  },
  text: { color: colors.danger },
});
