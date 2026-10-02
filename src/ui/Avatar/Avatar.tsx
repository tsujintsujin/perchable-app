import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { avatarSize, colors, motion, type } from "@/ui/tokens";

type Size = "sm" | "md" | "lg";

// Diameters per size come from the avatarSize token.
const DIMENSIONS: Record<Size, number> = avatarSize;

type Props = {
  /** Google account photo, when there is one. */
  uri?: string | null;
  size?: Size;
  /** purple.700→gold.500 ring — own-profile screens only (DESIGN.md §2). */
  ringGradient?: boolean;
  /** First-letter fallback source when `uri` is absent (first letter of the
   * Google display name). */
  name?: string | null;
};

/** Gradient initials circle with the photo fading in over it; the initials stay when
 * there is no photo or it fails — never a fabricated placeholder image. */
export function Avatar({ uri, size = "md", ringGradient = false, name }: Props) {
  const d = DIMENSIONS[size];
  const initial = name?.trim()?.[0]?.toUpperCase() ?? "?";

  // The initials circle is always drawn; the photo fades in over it, so the slot is never blank and a failed photo leaves the initials.
  const circle = (
    <View style={{ width: d, height: d, borderRadius: d / 2, overflow: "hidden" }}>
      <LinearGradient
        colors={[colors.brand.purple700, colors.brand.gold500]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        // Decorative: the name next to the avatar says who it is, so a reader must not say "J" first.
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={[styles.fallback, StyleSheet.absoluteFill]}
      >
        <Text style={[styles.initial, { fontSize: d * 0.42 }]}>{initial}</Text>
      </LinearGradient>
      {uri ? <Image testID="avatar-photo" source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={motion.imageFade} /> : null}
    </View>
  );

  if (!ringGradient) return circle;

  const ringSize = d + 6;
  return (
    <LinearGradient
      colors={[colors.brand.purple700, colors.brand.gold500]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.ring, { width: ringSize, height: ringSize, borderRadius: ringSize / 2 }]}
    >
      <View style={styles.ringInner}>{circle}</View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: "center", justifyContent: "center" },
  initial: { color: colors.text.primary, fontFamily: type.subhead.fontFamily },
  ring: { alignItems: "center", justifyContent: "center" },
  ringInner: { alignItems: "center", justifyContent: "center" },
});
