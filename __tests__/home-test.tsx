import { render, screen } from "@testing-library/react-native";

// Home reads the signed-in Avatar from useAuthSession's session — mock it
// so this test doesn't need a real Supabase session (or env vars).
jest.mock("@/modules/auth", () => ({
  useAuthSession: () => ({
    session: {
      user: { user_metadata: { full_name: "Justin Masiga", avatar_url: null } },
    },
    isLoading: false,
  }),
}));

import Home from "@/app/(tabs)/index";

// Smoke test: renders the real (tabs) Home route with React Native Testing
// Library and checks the placeholder text renders alongside the signed-in
// avatar (Build 6: replaced Build 5's "Signed in ✓" text chip — DESIGN.md
// §7's dev-client gear-zone fix).
describe("Home route", () => {
  it("renders the placeholder screen with the signed-in avatar", async () => {
    await render(<Home />);

    expect(screen.getByRole("button", { name: "Open My Profile" })).toBeTruthy();
    expect(
      screen.getByText("Edit src/app/(tabs)/index.tsx to edit this screen."),
    ).toBeTruthy();
  });
});
