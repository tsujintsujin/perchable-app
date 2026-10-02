import { StyleSheet } from "react-native";
import { render, screen } from "@testing-library/react-native";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

import { Toast } from "@/ui/Toast";
import { spacing } from "@/ui/tokens";

describe("Toast layout", () => {
  it("keeps a 20 dp margin each side so a long message wraps inside the screen", async () => {
    await render(<Toast message="A long message" />);
    const wrap = StyleSheet.flatten(screen.getByRole("alert").props.style);
    expect(wrap.marginHorizontal).toBe(spacing[20]);
  });

  it("stops its text growing past font scale 1.3, so two lines still fit the deck's reserved lane", async () => {
    await render(<Toast message="A long message" />);
    expect(screen.getByText("A long message").props.maxFontSizeMultiplier).toBe(1.3);
  });
});
