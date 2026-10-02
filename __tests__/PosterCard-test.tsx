import { StyleSheet } from "react-native";
import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native";
import { colors } from "@/ui/tokens";
import { PosterCard, PosterCardSkeleton } from "@/ui/PosterCard";

const URL_A = "https://image.tmdb.org/t/p/w342/a.jpg";

// Finds the expo-image element inside the tile.
const image = () => screen.getByTestId("poster-image");

describe("PosterCard", () => {
  it("loaded: renders the image with cache and recycling props, labelled as an image", async () => {
    await render(<PosterCard id={7} posterUrl={URL_A} title="Dune" year={2021} />);
    const props = image().props;
    expect(props.source).toEqual([{ uri: URL_A }]);
    expect(props.cachePolicy).toBe("memory-disk");
    expect(props.recyclingKey).toBe("7");
    expect(props.contentFit).toBe("cover");
    expect(screen.getByRole("image", { name: "Dune, 2021" })).toBeTruthy();
    expect(screen.queryByText("🎬")).toBeNull();
  });

  it("keeps a flat loading fill on the tile so the image fade-in never shows the backdrop", async () => {
    await render(<PosterCard id={1} posterUrl={URL_A} title="Dune" />);
    const tile = screen.getByRole("image", { name: "Dune" });
    expect(StyleSheet.flatten(tile.props.style).backgroundColor).toBe(colors.bg.elevatedFlat);
    await act(async () => image().props.onLoad({ nativeEvent: { source: {} } }));
    expect(StyleSheet.flatten(screen.getByRole("image", { name: "Dune" }).props.style).backgroundColor).toBe(colors.bg.elevatedFlat);
  });

  it("labels with the title alone when the year is unknown", async () => {
    await render(<PosterCard id={1} posterUrl={URL_A} title="Dune" year={null} />);
    expect(screen.getByRole("image", { name: "Dune" })).toBeTruthy();
  });

  it("no poster: shows the fallback icon and title, no image", async () => {
    await render(<PosterCard id={1} posterUrl={null} title="Nosferatu" year={1922} />);
    expect(screen.getByText("🎬")).toBeTruthy();
    expect(screen.getByText("Nosferatu").props.numberOfLines).toBe(3);
    expect(screen.queryByText("1922")).toBeNull();
    expect(screen.queryByTestId("poster-image")).toBeNull();
  });

  it("a failed image switches to the fallback instead of a blank tile", async () => {
    await render(<PosterCard id={1} posterUrl={URL_A} title="Dune" />);
    await act(async () => image().props.onError({ nativeEvent: { error: "404" } }));
    expect(screen.getByText("🎬")).toBeTruthy();
    expect(screen.getByText("Dune")).toBeTruthy();
    expect(screen.queryByTestId("poster-image")).toBeNull();
  });

  it("a recycled tile with a new poster URL does not keep the old failure", async () => {
    const { rerender } = await render(<PosterCard id={1} posterUrl={URL_A} title="Dune" />);
    await act(async () => image().props.onError({ nativeEvent: { error: "404" } }));
    await rerender(<PosterCard id={2} posterUrl="https://image.tmdb.org/t/p/w342/b.jpg" title="Heat" />);
    expect(image().props.recyclingKey).toBe("2");
  });

  it("a failed image tries again when the retry token changes, and not otherwise (no loop)", async () => {
    const { rerender } = await render(<PosterCard id={1} posterUrl={URL_A} title="Dune" retryToken={0} />);
    await act(async () => image().props.onError({ nativeEvent: { error: "offline" } }));
    expect(screen.queryByTestId("poster-image")).toBeNull();

    await rerender(<PosterCard id={1} posterUrl={URL_A} title="Dune" retryToken={0} />);
    expect(screen.queryByTestId("poster-image")).toBeNull();

    await rerender(<PosterCard id={1} posterUrl={URL_A} title="Dune" retryToken={1} />);
    expect(image().props.source).toEqual([{ uri: URL_A }]);

    await act(async () => image().props.onError({ nativeEvent: { error: "still offline" } }));
    expect(screen.queryByTestId("poster-image")).toBeNull();
  });

  it("copes with emoji and right-to-left titles", async () => {
    await render(<PosterCard id={1} posterUrl={null} title="🎃 Halloween مرحبا" />);
    expect(screen.getByText("🎃 Halloween مرحبا")).toBeTruthy();
  });

  it("has no press behaviour and no button role in 12a", async () => {
    await render(<PosterCard id={1} posterUrl={URL_A} title="Dune" />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("PosterCard with onPress", () => {
  it("is a button with the open-details hint, calls onPress, and keeps the image and its props", async () => {
    const onPress = jest.fn();
    await render(<PosterCard id={7} posterUrl={URL_A} title="Dune" year={2021} onPress={onPress} />);
    const tile = screen.getByRole("button", { name: "Dune, 2021" });
    expect(tile.props.accessibilityHint).toBe("Opens movie details");
    expect(screen.queryByRole("image")).toBeNull();
    expect(image().props.recyclingKey).toBe("7");
    await fireEvent.press(tile);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("scales to 0.98 while pressed and not otherwise", async () => {
    await render(<PosterCard id={1} posterUrl={URL_A} title="Dune" onPress={() => {}} />);
    const tile = () => screen.getByRole("button", { name: "Dune" });
    expect(StyleSheet.flatten(tile().props.style).transform).toBeUndefined();
    // Holds the press for 400 ms; the tile is read part-way through.
    const hold = userEvent.setup().longPress(tile(), { duration: 400 });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
    });
    expect(StyleSheet.flatten(tile().props.style).transform).toEqual([{ scale: 0.98 }]);
    await hold;
    expect(StyleSheet.flatten(tile().props.style).transform).toBeUndefined();
  });

  it("still shows the fallback title when there is no poster, and an overriding label wins", async () => {
    await render(<PosterCard id={1} posterUrl={null} title="Nosferatu" onPress={() => {}} accessibilityLabel="Poster for Nosferatu" />);
    expect(screen.getByRole("button", { name: "Poster for Nosferatu" })).toBeTruthy();
    expect(screen.getByText("Nosferatu")).toBeTruthy();
  });
});

describe("PosterCardSkeleton", () => {
  it("is hidden from screen readers", async () => {
    await render(<PosterCardSkeleton />);
    expect(screen.queryByRole("image")).toBeNull();
    expect(screen.toJSON()).toMatchObject({ props: { importantForAccessibility: "no-hide-descendants" } });
  });
});
