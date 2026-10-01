import { useEffect, useState } from "react";
import { Keyboard, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { size, spacing } from "./tokens";

/** Bottom padding and max height for a bottom sheet inside a Modal that sits under a KeyboardAvoidingView. */
export function useSheetLayout() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Tracks the docked keyboard's height; Android's window does not resize in an edge-to-edge Modal.
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (e) => setKeyboardHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const keyboardVisible = keyboardHeight > 0;
  return {
    // The keyboard already covers the gesture-bar area, so the inset is only added when it is hidden.
    paddingBottom: (keyboardVisible ? 0 : insets.bottom) + spacing[24],
    // Capped by the share of the screen and by the room left under the status bar and above the keyboard.
    maxHeight: Math.min(height * size.sheetMaxHeightRatio, height - insets.top - keyboardHeight),
  };
}
