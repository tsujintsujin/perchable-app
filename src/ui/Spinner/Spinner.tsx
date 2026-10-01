import { useEffect, useState } from "react";
import { Animated, Easing } from "react-native";
import { colors, size } from "@/ui/tokens";

const SPIN_MS = 800;

type Props = {
  diameter?: number;
  /** Ring width. */
  stroke?: number;
  /** Colour of the turning arc. */
  arcColor?: string;
  /** Colour of the rest of the ring. */
  trackColor?: string;
};

/** Indeterminate ring with a turning arc; decorative, so callers label the row it sits in. */
export function Spinner({
  diameter = size.spinner,
  stroke = size.spinnerStroke,
  arcColor = colors.accent.gold,
  trackColor = colors.overlay.spinnerTrack,
}: Props) {
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
  return (
    <Animated.View
      style={{
        width: diameter,
        height: diameter,
        borderRadius: diameter / 2,
        borderWidth: stroke,
        borderColor: trackColor,
        borderTopColor: arcColor,
        transform: [{ rotate }],
      }}
    />
  );
}
