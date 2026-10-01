import { useEffect } from "react";
import type { RefObject } from "react";
import { AccessibilityInfo, findNodeHandle, type Text } from "react-native";

/** Moves screen-reader focus to the given text when its owner mounts. */
export function useFocusOnMount(ref: RefObject<Text | null>) {
  // Runs once on mount; a missing node (not yet laid out) is skipped.
  useEffect(() => {
    const node = ref.current ? findNodeHandle(ref.current) : null;
    if (node) AccessibilityInfo.setAccessibilityFocus(node);
  }, [ref]);
}
