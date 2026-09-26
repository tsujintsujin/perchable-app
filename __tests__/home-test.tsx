import { render, screen } from "@testing-library/react-native";

// Home reads the signed-in Avatar from useOwnProfile (Build 6 · Bug 1 —
// previously read session.user_metadata directly) — mock it so this test
// doesn't need a real Supabase session or profiles row.
jest.mock("@/modules/profile", () => ({
  useOwnProfile: () => ({
    state: "loaded",
    refetch: jest.fn(),
    profile: {
      id: "u1",
      displayName: "Justin Masiga",
      avatarUrl: null,
      usertag: null,
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    },
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
