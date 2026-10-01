import { StyleSheet } from "react-native";
import { render, screen } from "@testing-library/react-native";
import { PagingFooter } from "@/modules/movies/components/PagingFooter";
import { lineHeight, size, spacing } from "@/ui/tokens";

// Height the failed-load block needs: padding, one text line, the gap, the 48 dp Retry button and padding.
const ERROR_CONTENT_HEIGHT = spacing[8] + lineHeight.caption + spacing[8] + size.minTouch + spacing[8];

describe("PagingFooter layout", () => {
  it("the footer token holds the failed-load content, so the Retry button is never pushed under the tab bar", () => {
    expect(size.footerBlock).toBeGreaterThanOrEqual(ERROR_CONTENT_HEIGHT);
  });

  it("loading and failed-load footers have the same minimum height", async () => {
    await render(<PagingFooter footer="loading" onRetry={() => {}} />);
    const loading = StyleSheet.flatten(screen.getByLabelText("Loading more movies").props.style).minHeight;
    await screen.unmount();

    await render(<PagingFooter footer="error" onRetry={() => {}} />);
    const alert = screen.getByRole("alert");
    const errorBox = StyleSheet.flatten(alert.parent?.props.style).minHeight;
    expect(loading).toBe(size.footerBlock);
    expect(errorBox).toBe(size.footerBlock);
  });

  it("the end line stays a 56 dp row", async () => {
    await render(<PagingFooter footer="end" onRetry={() => {}} />);
    const row = screen.getByText("You've reached the end.").parent;
    expect(StyleSheet.flatten(row?.props.style).minHeight).toBe(size.footerRow);
  });
});
