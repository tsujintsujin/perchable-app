import { render, screen } from "@testing-library/react-native";
import { Button } from "@/ui/Button";

/**
 * Build 7 · Bug 1: `Button`'s loading branch used to hardcode the text
 * "Saving" regardless of which button was loading — fine for Save (Build
 * 7), wrong for any other caller (Build 9's delete-account button needs
 * "Deleting…"). `loadingLabel` fixes that; these tests cover both the
 * explicit-override case Build 9 needs and the default-to-`label` case for
 * a caller that doesn't pass one at all.
 */
describe("Button", () => {
  it("shows the plain label when not loading", async () => {
    await render(<Button label="Save" onPress={() => {}} />);
    expect(screen.getByText("Save")).toBeTruthy();
  });

  it("shows loadingLabel instead of label while loading", async () => {
    await render(
      <Button label="Delete my account" loadingLabel="Deleting…" onPress={() => {}} loading />,
    );
    expect(screen.getByText("Deleting…")).toBeTruthy();
    expect(screen.queryByText("Delete my account")).toBeNull();
  });

  it("falls back to label while loading when loadingLabel isn't passed", async () => {
    await render(<Button label="Continue" onPress={() => {}} loading />);
    expect(screen.getByText("Continue")).toBeTruthy();
  });
});
