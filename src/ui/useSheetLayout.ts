import { useEffect, useState } from "react";
import { Keyboard, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { size, spacing } from "./tokens";

/** Styles for a bottom sheet inside a Modal under a KeyboardAvoidingView: `overlay` goes on the
 * KeyboardAvoidingView, `sheet` on the sheet. The overlay's top padding keeps the sheet under the
 * status bar whatever space the keyboard takes, so no keyboard height enters the cap. */
export function useSheetLayout() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Tracks the docked keyboard's height; Android's window does not resize in an edge-to-edge Modal.
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (e) =>
      setKeyboardHeight(e.endCoordinates.height),
    );
    const hide = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboardHeight(0),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const keyboardVisible = keyboardHeight > 0;
  return {
    overlay: { paddingTop: insets.top },
    sheet: {
      // The keyboard already covers the gesture-bar area, so the inset is only added when it is hidden.
      paddingBottom: (keyboardVisible ? 0 : insets.bottom) + spacing[24],
      // Share of the screen; the room under the status bar and above the keyboard is the overlay's flex space.
      maxHeight: height * size.sheetMaxHeightRatio,
    },
  };
}
