import { render, screen } from "@testing-library/react-native";

import Home from "@/app/(tabs)/index";

// Smoke test: renders the real (tabs) Home route with React Native Testing
// Library and checks the signed-in chip + placeholder text render.
describe("Home route", () => {
  it("renders the placeholder screen with the signed-in chip", async () => {
    await render(<Home />);

    expect(screen.getByText("Signed in ✓")).toBeTruthy();
    expect(
      screen.getByText("Edit src/app/(tabs)/index.tsx to edit this screen."),
    ).toBeTruthy();
  });
});
