import { fireEvent, render, screen } from "@testing-library/react-native";
import { CastRow } from "@/modules/movies/components/CastRow";

const cast = Array.from({ length: 15 }, (_, i) => ({ id: i, name: `Person ${i}`, character: i % 2 ? "Role" : null, profile_path: null }));

describe("CastRow", () => {
  // A virtualized list answers a layout or content-size event with a 50 ms timer that sets state later, outside any act: that
  // landed in the next test of the details suite on a loaded machine. The row is a plain scroll view (15 people at most).
  it("starts no timer and updates no state after layout events, so nothing lands outside a test's act", async () => {
    const delays: number[] = [];
    const realSetTimeout = globalThis.setTimeout;
    const timers = jest.spyOn(globalThis, "setTimeout").mockImplementation(((fn: () => void, ms?: number, ...rest: unknown[]) => {
      delays.push(ms ?? 0);
      return realSetTimeout(fn, ms, ...rest);
    }) as never);
    const errors = jest.spyOn(console, "error").mockImplementation(() => {});
    await render(<CastRow cast={cast} />);
    const list = screen.getByTestId("cast-list");
    await fireEvent(list, "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 150 } } });
    await fireEvent(list, "contentSizeChange", 1800, 150);
    await new Promise((resolve) => realSetTimeout(resolve, 120));
    expect(delays.filter((ms) => ms >= 50)).toEqual([]);
    expect(errors).not.toHaveBeenCalled();
    timers.mockRestore();
    errors.mockRestore();
  });

  it("shows every person, labelled as one element, in a list", async () => {
    await render(<CastRow cast={cast} />);
    expect(screen.getByTestId("cast-list").props.accessibilityRole).toBe("list");
    expect(screen.getByLabelText("Person 1 as Role")).toBeTruthy();
    expect(screen.getByLabelText("Person 0")).toBeTruthy();
    expect(screen.getByLabelText("Person 14")).toBeTruthy();
  });
});
