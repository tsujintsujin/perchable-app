import { StyleSheet } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 24, left: 0 }),
}));

import { TabBar } from "@/ui/TabBar";
import { Toast } from "@/ui/Toast";
import { colors } from "@/ui/tokens";

const routes = [
  { key: "index-1", name: "index" },
  { key: "quick-add-1", name: "quick-add" },
  { key: "profile-1", name: "profile" },
];

describe("TabBar with Quick Add", () => {
  it("shows Perch, Quick Add and Profile in that order, with the card glyph on Quick Add", async () => {
    await render(<TabBar state={{ index: 0, routes }} navigation={{ navigate: jest.fn() }} />);
    expect(screen.getAllByRole("button").map((tab) => tab.props.accessibilityLabel)).toEqual(["Perch", "Quick Add", "Profile"]);
    expect(screen.getByText("🃏")).toBeTruthy();
  });

  it("marks only the active tab selected and gives it the gold label", async () => {
    await render(<TabBar state={{ index: 1, routes }} navigation={{ navigate: jest.fn() }} />);
    expect(screen.getByRole("button", { name: "Quick Add" }).props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
    expect(screen.getByRole("button", { name: "Perch" }).props.accessibilityState.selected).toBeUndefined();
    expect(StyleSheet.flatten(screen.getByText("Quick Add").props.style).color).toBe(colors.accent.gold);
    expect(StyleSheet.flatten(screen.getByText("Perch").props.style).color).toBe(colors.text.secondary);
  });

  it("pressing another tab navigates to it; pressing the active tab does nothing", async () => {
    const navigate = jest.fn();
    await render(<TabBar state={{ index: 0, routes }} navigation={{ navigate }} />);
    await fireEvent.press(screen.getByRole("button", { name: "Perch" }));
    expect(navigate).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole("button", { name: "Quick Add" }));
    expect(navigate).toHaveBeenCalledWith("quick-add");
  });
});

describe("Toast position", () => {
  it("defaults to the bottom (inset plus offset), and with position top sits the offset below the top", async () => {
    const view = await render(<Toast message="Hi" offset={40} />);
    let style = StyleSheet.flatten(screen.getByRole("alert").props.style);
    expect(style.bottom).toBe(24 + 40);
    expect(style.top).toBeUndefined();
    await view.rerender(<Toast message="Hi" offset={88} position="top" />);
    style = StyleSheet.flatten(screen.getByRole("alert").props.style);
    expect(style.top).toBe(88);
    expect(style.bottom).toBeUndefined();
  });
});
