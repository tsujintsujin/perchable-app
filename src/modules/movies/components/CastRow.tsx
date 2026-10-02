import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/ui/Avatar";
import { colors, lineHeight, size, spacing, type } from "@/ui/tokens";
import { IMAGE_SIZE, tmdbImage } from "../tmdbImage";
import type { CastMember } from "../types";

// One cast item: photo (initials when none), name and character; read as one element.
function CastItem({ person }: { person: CastMember }) {
  const character = person.character?.trim() || null;
  return (
    <View accessible accessibilityLabel={character ? `${person.name} as ${character}` : person.name} style={styles.item}>
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Avatar uri={tmdbImage(person.profile_path, IMAGE_SIZE.cast)} name={person.name} size="lg" />
      </View>
      <Text style={styles.name} numberOfLines={2}>
        {person.name}
      </Text>
      {character && (
        <Text style={styles.character} numberOfLines={2}>
          {character}
        </Text>
      )}
    </View>
  );
}

/** Horizontal row of cast members (not tappable). A plain scroll view, not a virtualized list: the proxy sends at most 15 people,
 * and a list's own 50 ms batching timer updated state outside any test's act. */
export function CastRow({ cast }: { cast: CastMember[] }) {
  return (
    <ScrollView horizontal testID="cast-list" accessibilityRole="list" showsHorizontalScrollIndicator={false} contentContainerStyle={styles.content}>
      {cast.map((person, index) => (
        // The same person can appear twice (two roles), so the id alone is not unique.
        <CastItem key={`${person.id}-${index}`} person={person} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Row padding matches the screen edge; the items sit a gap apart.
  content: { paddingHorizontal: spacing[20], gap: size.castGap },
  item: { width: size.castItem },
  name: { ...type.caption, lineHeight: lineHeight.caption, color: colors.text.primary, marginTop: spacing[8] },
  character: { ...type.small, lineHeight: lineHeight.caption, color: colors.text.secondary, marginTop: spacing[4] },
});
