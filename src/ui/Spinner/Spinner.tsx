import { useEffect, useState } from "react";
import { Animated, Easing, StyleSheet } from "react-native";
import { colors, size } from "@/ui/tokens";

const SPIN_MS = 800;

/** Indeterminate gold-arc ring; decorative, so callers label the row it sits in. */
export function Spinner() {
  const [spin] = useState(() => new Animated.Value(0));

  // Loops the rotation while mounted.
  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: SPIN_MS, easing: Easing.linear, useNativeDriver: true }),
    );
    animation.start();
    return () => animation.stop();
  }, [spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  return <Animated.View style={[styles.ring, { transform: [{ rotate }] }]} />;
}

// The ring: a faint full circle with a gold top arc.
const styles = StyleSheet.create({
  ring: {
    width: size.spinner,
    height: size.spinner,
    borderRadius: size.spinner / 2,
    borderWidth: 2,
    borderColor: colors.overlay.spinnerTrack,
    borderTopColor: colors.accent.gold,
  },
});
