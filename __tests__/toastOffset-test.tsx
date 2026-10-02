import { StyleSheet } from "react-native";
import { render, screen } from "@testing-library/react-native";
import { BottomTabBarHeightContext } from "expo-router/js-tabs";

const BOTTOM_INSET = 48;
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 48, left: 0 }),
}));

import { Toast } from "@/ui/Toast";
import { spacing } from "@/ui/tokens";

// Bottom offset of the rendered toast wrapper.
const bottomOf = () => StyleSheet.flatten(screen.getByRole("alert").props.style).bottom;

describe("Toast offset", () => {
  it("sits the bottom inset plus 24 above the screen bottom outside the tabs", async () => {
    await render(<Toast message="Hello" />);
    expect(bottomOf()).toBe(BOTTOM_INSET + spacing[24]);
  });

  it("sits 24 above the tab bar on a tab screen: the tab bar already absorbs the inset", async () => {
    await render(
      <BottomTabBarHeightContext.Provider value={72}>
        <Toast message="Hello" />
      </BottomTabBarHeightContext.Provider>,
    );
    expect(bottomOf()).toBe(spacing[24]);
  });
});
