import { useEffect } from "react";
import { AccessibilityInfo } from "react-native";
import { useSharedValue, type SharedValue } from "react-native-reanimated";

/** The system "reduce motion" setting as a shared value the gesture worklets read; it follows changes while the app runs. */
export function useReduceMotion(): SharedValue<boolean> {
  const reduceMotion = useSharedValue(false);

  // Reads the setting once, then follows its change event (Reanimated's own hook reads it only at start-up).
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (active) reduceMotion.set(enabled);
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => reduceMotion.set(enabled));
    return () => {
      active = false;
      subscription.remove();
    };
  }, [reduceMotion]);

  return reduceMotion;
}
