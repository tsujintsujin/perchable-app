import { type } from "@/ui/tokens";

// fontWeight beside a single-weight custom family makes Android fall back to the system font.
describe("type tokens", () => {
  it("carry no fontWeight", () => {
    for (const token of Object.values(type)) {
      expect(token).not.toHaveProperty("fontWeight");
    }
  });
});
