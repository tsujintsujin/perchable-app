import { render, screen } from "@testing-library/react-native";

import Index from "@/app/index";

// Smoke test: renders the real Home route component (not a mock) with React
// Native Testing Library and checks the actual on-screen text.
describe("Home route", () => {
  it("renders the default index screen", async () => {
    await render(<Index />);

    expect(
      screen.getByText("Edit src/app/index.tsx to edit this screen."),
    ).toBeTruthy();
  });
});
