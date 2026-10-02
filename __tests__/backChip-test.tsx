import { fireEvent, render, screen } from "@testing-library/react-native";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 28, right: 0, bottom: 0, left: 0 }),
}));
const mockRouter = { canGoBack: jest.fn(), back: jest.fn(), replace: jest.fn() };
// Calls go through arrow functions so the mock objects (declared after the hoisted factory) are read lazily.
jest.mock("expo-router", () => ({
  router: {
    canGoBack: () => mockRouter.canGoBack(),
    back: () => mockRouter.back(),
    replace: (path: string) => mockRouter.replace(path),
  },
}));

import { goBackOrHome } from "@/lib/navigation";
import { BackChip } from "@/ui/BackChip";

beforeEach(() => {
  mockRouter.canGoBack.mockReset();
  mockRouter.back.mockReset();
  mockRouter.replace.mockReset();
});

describe("BackChip", () => {
  it("is a button labelled Back by default, sits 8 under the top inset, and calls onPress", async () => {
    const onPress = jest.fn();
    await render(<BackChip onPress={onPress} />);
    const chip = screen.getByRole("button", { name: "Back" });
    expect(chip.props.style).toEqual(expect.arrayContaining([expect.objectContaining({ top: 36 })]));
    await fireEvent.press(chip);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("takes a custom screen-reader label", async () => {
    await render(<BackChip onPress={jest.fn()} label="Close" />);
    expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
  });
});

describe("goBackOrHome", () => {
  it("goes back when there is history", () => {
    mockRouter.canGoBack.mockReturnValue(true);
    goBackOrHome();
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it("replaces with Home on a cold deep link with no history", () => {
    mockRouter.canGoBack.mockReturnValue(false);
    goBackOrHome();
    expect(mockRouter.replace).toHaveBeenCalledWith("/");
    expect(mockRouter.back).not.toHaveBeenCalled();
  });
});
