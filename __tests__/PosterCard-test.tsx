import { StyleSheet } from "react-native";
import { act, render, screen } from "@testing-library/react-native";
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

  it("copes with emoji and right-to-left titles", async () => {
    await render(<PosterCard id={1} posterUrl={null} title="🎃 Halloween مرحبا" />);
    expect(screen.getByText("🎃 Halloween مرحبا")).toBeTruthy();
  });

  it("has no press behaviour and no button role in 12a", async () => {
    await render(<PosterCard id={1} posterUrl={URL_A} title="Dune" />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("PosterCardSkeleton", () => {
  it("is hidden from screen readers", async () => {
    await render(<PosterCardSkeleton />);
    expect(screen.queryByRole("image")).toBeNull();
    expect(screen.toJSON()).toMatchObject({ props: { importantForAccessibility: "no-hide-descendants" } });
  });
});
