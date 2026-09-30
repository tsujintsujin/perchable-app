import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { avatarSize, colors, type } from "@/ui/tokens";

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

/** Loaded photo, or a gradient-fill fallback-initials circle — never a
 * fabricated placeholder image. */
export function Avatar({ uri, size = "md", ringGradient = false, name }: Props) {
  const d = DIMENSIONS[size];
  const initial = name?.trim()?.[0]?.toUpperCase() ?? "?";

  const circle = uri ? (
    <Image
      source={{ uri }}
      style={{ width: d, height: d, borderRadius: d / 2 }}
      contentFit="cover"
    />
  ) : (
    <LinearGradient
      colors={[colors.brand.purple700, colors.brand.gold500]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.fallback, { width: d, height: d, borderRadius: d / 2 }]}
    >
      <Text style={[styles.initial, { fontSize: d * 0.42 }]}>{initial}</Text>
    </LinearGradient>
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
