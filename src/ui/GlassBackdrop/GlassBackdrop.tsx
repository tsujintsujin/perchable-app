import { StyleSheet, View } from "react-native";
import { colors } from "@/ui/tokens";

type Blob = "purple" | "gold";

type Props = {
  /** Which decorative halo blobs to render, in render order. */
  blobs?: Blob[];
  /** Mock opacity range is 0.2–0.35; sign-in uses the dimmer end (0.22),
   * Home-scale screens the fuller end. Defaults to the mock's Home value. */
  opacity?: number;
};

const BLOB_COLOR: Record<Blob, string> = {
  purple: colors.brand.purple700,
  gold: colors.brand.gold500,
};

/**
 * Full-bleed dark backdrop with large soft-edge color blobs behind content —
 * DESIGN.md §1.4 "background halo blobs". One instance per screen, never
 * per-card. `pointer-events: none` so it never intercepts taps.
 *
 * ponytail: React Native has no CSS-style `filter: blur()`, so the "blurred
 * 120–130px" glow in the mock is approximated with a large, low-opacity
 * radial fill (huge borderRadius) instead of a true Gaussian blur. Upgrade
 * path if exact fidelity ever matters: render via react-native-skia's blur
 * filter.
 */
export function GlassBackdrop({ blobs = ["purple", "gold"], opacity = 0.3 }: Props) {
  return (
    <View style={styles.container} pointerEvents="none">
      {blobs.map((blob, i) => (
        <View
          key={blob}
          style={[
            styles.blob,
            {
              backgroundColor: BLOB_COLOR[blob],
              opacity,
              top: i === 0 ? "-8%" : undefined,
              bottom: i === 1 ? "-10%" : undefined,
              left: i % 2 === 0 ? "-20%" : undefined,
              right: i % 2 === 1 ? "-20%" : undefined,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg.base,
    overflow: "hidden",
  },
  blob: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 320,
  },
});
