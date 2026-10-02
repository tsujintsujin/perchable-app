import { StyleSheet, Text, View } from "react-native";
import { Button } from "@/ui/Button";
import { colors, glass, letterSpacing, lineHeight, radius, spacing, type } from "@/ui/tokens";

type Props = { onPress: () => void };

/** Perch Roulette hero card, a UI-only shell: the button's `onPress` tells the user it is coming soon. Flat fill, no blur. */
export function RouletteCard({ onPress }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>Perch Roulette</Text>
      <Text style={styles.title}>Can&apos;t decide tonight?</Text>
      <Button
        label="🎬 Surprise Me"
        accessibilityLabel="Surprise me"
        accessibilityHint="Smart picks are coming soon"
        onPress={onPress}
        style={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Flat hero surface: Android has no real blur behind a list header.
  card: {
    padding: spacing[20],
    borderRadius: radius.lg,
    backgroundColor: glass.hero.backgroundColor,
    borderColor: glass.hero.borderColor,
    borderWidth: glass.hero.borderWidth,
  },
  eyebrow: {
    ...type.caption,
    color: colors.brand.lavender200,
    textTransform: "uppercase",
    letterSpacing: letterSpacing.label,
  },
  title: {
    ...type.title,
    lineHeight: lineHeight.title,
    color: colors.text.primary,
    marginTop: spacing[6],
  },
  button: { marginTop: spacing[14] },
});
