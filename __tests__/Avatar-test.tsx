import { StyleSheet } from "react-native";
import { act, render, screen, userEvent } from "@testing-library/react-native";
import { Avatar } from "@/ui/Avatar";
import { GlassCard } from "@/ui/GlassCard";
import { motion } from "@/ui/tokens";

const PHOTO = "https://example.com/me.jpg";

describe("Avatar", () => {
  it("draws the initials first and the photo over them, fading in over 200 ms", async () => {
    await render(<Avatar uri={PHOTO} name="Justin Masiga" size="lg" />);
    // The initials are in the tree while the photo loads (and stay if it fails).
    expect(screen.getByText("J")).toBeTruthy();
    const photo = screen.getByTestId("avatar-photo");
    expect(photo.props.source).toEqual([{ uri: PHOTO }]);
    expect(photo.props.transition).toEqual({ duration: motion.imageFade });
    expect(motion.imageFade).toBe(200);
  });

  it("with no photo shows the initials only, and ? when there is no name", async () => {
    await render(<Avatar uri={null} name="  ada" />);
    expect(screen.getByText("A")).toBeTruthy();
    expect(screen.queryByTestId("avatar-photo")).toBeNull();
    await render(<Avatar />);
    expect(screen.getByText("?")).toBeTruthy();
  });

  it("keeps the initials when the photo fails to load", async () => {
    await render(<Avatar uri={PHOTO} name="Mara" />);
    await act(async () => screen.getByTestId("avatar-photo").props.onError?.({ error: "404" }));
    expect(screen.getByText("M")).toBeTruthy();
  });

  it("works inside the own-profile gradient ring", async () => {
    await render(<Avatar uri={PHOTO} name="Mara" ringGradient size="lg" />);
    expect(screen.getByText("M")).toBeTruthy();
    expect(screen.getByTestId("avatar-photo")).toBeTruthy();
  });
});

describe("press scale token", () => {
  it("is 0.98 and GlassCard presses to it", async () => {
    expect(motion.pressScale).toBe(0.98);
    await render(<GlassCard onPress={() => {}} accessibilityLabel="Card"><></></GlassCard>);
    const card = () => screen.getByRole("button", { name: "Card" });
    expect(StyleSheet.flatten(card().props.style).transform).toBeUndefined();
    const hold = userEvent.setup().longPress(card(), { duration: 400 });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
    });
    expect(StyleSheet.flatten(card().props.style).transform).toEqual([{ scale: motion.pressScale }]);
    await hold;
  });
});
