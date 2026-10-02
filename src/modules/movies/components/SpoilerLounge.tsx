import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/ui/Avatar";
import { colors, glass, lineHeight, radius, size, spacing, type } from "@/ui/tokens";

// Invented sample messages, labelled "Preview only" on screen; nothing is fetched or stored.
const SAMPLES = [
  { author: "CineOwl", text: "Just finished it. No spoilers, but wow." },
  { author: "ReelMara", text: "Rewatching it this weekend. Who's in?" },
] as const;

type Props = {
  /** Called when the composer is tapped; the screen answers with a Toast. */
  onComposerPress: () => void;
};

/** `#spoiler-free-lounge` panel, a UI-only shell until the comments module exists: static samples and a composer that only answers "coming soon". */
export function SpoilerLounge({ onComposerPress }: Props) {
  return (
    <View>
      <Text accessibilityRole="header" style={styles.heading}>
        #spoiler-free-lounge
      </Text>
      <Text style={styles.subline}>Chat about this movie without spoilers.</Text>
      <View style={styles.card}>
        {SAMPLES.map((sample) => (
          <View key={sample.author} style={styles.message}>
            <Avatar name={sample.author} size="sm" />
            <View style={styles.messageColumn}>
              <Text style={styles.author}>{sample.author}</Text>
              <Text style={styles.messageText}>{sample.text}</Text>
            </View>
          </View>
        ))}
        <Text style={styles.preview}>Preview only. Comments are coming soon.</Text>
        <Pressable
          onPress={onComposerPress}
          accessibilityRole="button"
          accessibilityLabel="Hoot your thoughts"
          accessibilityHint="Comments are coming soon"
          style={styles.composer}
        >
          <Text style={styles.placeholder}>Hoot your thoughts…</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    ...type.subhead,
    lineHeight: lineHeight.subhead,
    color: colors.brand.lavender200,
    marginTop: spacing[24],
    marginBottom: spacing[4],
  },
  subline: { ...type.small, color: colors.text.secondary, marginBottom: spacing[12] },
  // Flat hero fill (no blur on Android), padded 16 with 4 less at the bottom.
  card: {
    paddingHorizontal: spacing[16],
    paddingTop: spacing[16],
    paddingBottom: spacing[4],
    borderRadius: radius.md,
    backgroundColor: glass.hero.backgroundColor,
    borderWidth: glass.hero.borderWidth,
    borderColor: colors.border.hairline,
  },
  // Avatar at the left, author over message in a column; rows top-aligned and 12 apart.
  message: { flexDirection: "row", alignItems: "flex-start", gap: spacing[10], marginBottom: spacing[12] },
  messageColumn: { flex: 1 },
  author: { ...type.small, fontFamily: type.label.fontFamily, lineHeight: lineHeight.caption, color: colors.accent.gold },
  messageText: { ...type.small, lineHeight: lineHeight.bubble, color: colors.text.primary },
  preview: { ...type.small, color: colors.text.secondary, marginBottom: spacing[12] },
  // Input-height pill; not focusable, it only answers with a Toast.
  composer: {
    minHeight: size.composerHeight,
    justifyContent: "center",
    paddingHorizontal: spacing[16],
    borderRadius: radius.pill,
    backgroundColor: glass.chip.backgroundColor,
    borderWidth: 1,
    borderColor: colors.border.hairline,
    marginBottom: spacing[12],
  },
  placeholder: { ...type.body, color: colors.text.disabled },
});
