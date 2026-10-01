import {
  Dimensions,
  Keyboard,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { act, render, renderHook, screen } from "@testing-library/react-native";
import { size, spacing } from "@/ui/tokens";

// No <SafeAreaProvider> in the test tree: fixed insets (status bar 30, gesture bar 20) stand in for it.
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 30, right: 0, bottom: 20, left: 0 }),
}));
jest.mock("@/modules/auth/hooks/useDeleteAccount", () => ({
  useDeleteAccount: () => ({
    deleteAccount: jest.fn(),
    isInFlight: () => false,
    isDeleting: false,
    failed: false,
  }),
}));

import { SheetShell } from "@/modules/moderation/components/SheetShell";
import { DeleteAccountSheet } from "@/modules/auth/components/DeleteAccountSheet";
import { useSheetLayout } from "@/ui/useSheetLayout";

const KEYBOARD_HEIGHT = 300;
type Handler = (e: { endCoordinates: { height: number } }) => void;
const handlers: Record<string, Handler> = {};

// Captures the Keyboard listeners so a test can fire the show and hide events.
beforeEach(() => {
  jest.spyOn(Keyboard, "addListener").mockImplementation(((
    name: string,
    fn: Handler,
  ) => {
    handlers[name] = fn;
    return { remove: jest.fn() };
  }) as never);
});
afterEach(() => jest.restoreAllMocks());

const showKeyboard = () =>
  act(async () =>
    handlers.keyboardDidShow({ endCoordinates: { height: KEYBOARD_HEIGHT } }),
  );
const hideKeyboard = () =>
  act(async () => handlers.keyboardDidHide({ endCoordinates: { height: 0 } }));

describe("useSheetLayout", () => {
  it("adds the bottom inset while the keyboard is hidden", async () => {
    const { result } = await renderHook(() => useSheetLayout());
    expect(result.current.sheet.paddingBottom).toBe(20 + spacing[24]);
  });

  it("drops the bottom inset while the keyboard is showing and restores it after", async () => {
    const { result } = await renderHook(() => useSheetLayout());
    await showKeyboard();
    expect(result.current.sheet.paddingBottom).toBe(spacing[24]);
    await hideKeyboard();
    expect(result.current.sheet.paddingBottom).toBe(20 + spacing[24]);
  });

  // Android reports the keyboard height without the nav bar, but KeyboardAvoidingView pads by
  // the full gap, so a cap built from that height overshoots the room by (nav bar - status bar).
  it("keeps the status-bar clearance on the overlay and out of the keyboard height", async () => {
    const { result } = await renderHook(() => ({
      layout: useSheetLayout(),
      dims: useWindowDimensions(),
    }));
    const ratioCap = result.current.dims.height * size.sheetMaxHeightRatio;
    expect(result.current.layout.overlay.paddingTop).toBe(30);
    expect(result.current.layout.sheet.maxHeight).toBe(ratioCap);
    await showKeyboard();
    expect(result.current.layout.overlay.paddingTop).toBe(30);
    expect(result.current.layout.sheet.maxHeight).toBe(ratioCap);
  });
});

describe("sheets use the shared layout", () => {
  it("SheetShell applies the keyboard-aware padding and max height", async () => {
    await render(
      <SheetShell testID="s" onDismiss={jest.fn()} dismissable title="T">
        {null}
      </SheetShell>,
    );
    expect(
      StyleSheet.flatten(screen.getByTestId("s-sheet").props.style)
        .paddingBottom,
    ).toBe(20 + spacing[24]);
    await showKeyboard();
    const style = StyleSheet.flatten(screen.getByTestId("s-sheet").props.style);
    expect(style.paddingBottom).toBe(spacing[24]);
    expect(style.maxHeight).toBe(
      Dimensions.get("window").height * size.sheetMaxHeightRatio,
    );
    expect(
      StyleSheet.flatten(screen.getByTestId("s-overlay").props.style)
        .paddingTop,
    ).toBe(30);
  });

  it("DeleteAccountSheet applies the keyboard-aware padding and max height", async () => {
    await render(<DeleteAccountSheet onClose={jest.fn()} />);
    expect(
      StyleSheet.flatten(
        screen.getByTestId("delete-account-sheet-sheet").props.style,
      ).paddingBottom,
    ).toBe(20 + spacing[24]);
    await showKeyboard();
    const style = StyleSheet.flatten(
      screen.getByTestId("delete-account-sheet-sheet").props.style,
    );
    expect(style.paddingBottom).toBe(spacing[24]);
    expect(style.maxHeight).toBe(
      Dimensions.get("window").height * size.sheetMaxHeightRatio,
    );
    expect(
      StyleSheet.flatten(
        screen.getByTestId("delete-account-sheet-overlay").props.style,
      ).paddingTop,
    ).toBe(30);
  });
});
