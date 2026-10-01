import { useEffect, useState } from "react";
import { Animated } from "react-native";
import { shimmerPulse } from "@/ui/tokens";

/** Looping opacity value for loading placeholders; apply it as `opacity` on an Animated.View. */
export function usePulse() {
  const [pulse] = useState(() => new Animated.Value(shimmerPulse.min));

  // Loops the pulse while the placeholders are on screen.
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: shimmerPulse.max, duration: shimmerPulse.duration, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: shimmerPulse.min, duration: shimmerPulse.duration, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return pulse;
}
