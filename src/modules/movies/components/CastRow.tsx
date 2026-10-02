import { FlatList, StyleSheet, Text, View } from "react-native";
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

// Space between two cast items.
function Gap() {
  return <View style={styles.gap} />;
}

/** Horizontal row of cast members (not tappable). */
export function CastRow({ cast }: { cast: CastMember[] }) {
  return (
    <FlatList
      horizontal
      testID="cast-list"
      accessibilityRole="list"
      showsHorizontalScrollIndicator={false}
      data={cast}
      keyExtractor={(person) => String(person.id)}
      renderItem={({ item }) => <CastItem person={item} />}
      contentContainerStyle={styles.content}
      ItemSeparatorComponent={Gap}
    />
  );
}

const styles = StyleSheet.create({
  // Row padding matches the screen edge.
  content: { paddingHorizontal: spacing[20] },
  gap: { width: size.castGap },
  item: { width: size.castItem },
  name: { ...type.caption, lineHeight: lineHeight.caption, color: colors.text.primary, marginTop: spacing[8] },
  character: { ...type.small, lineHeight: lineHeight.caption, color: colors.text.secondary, marginTop: spacing[4] },
});
