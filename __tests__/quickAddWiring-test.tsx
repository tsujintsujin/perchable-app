import { render } from "@testing-library/react-native";

const mockSession = jest.fn();
jest.mock("@/modules/auth", () => ({ useAuthSession: () => mockSession() }));
const mockScreen = jest.fn();
jest.mock("@/modules/quick-add", () => ({
  QuickAddScreen: (props: { userId: string }) => {
    mockScreen(props);
    return null;
  },
}));

import QuickAddRoute from "@/app/(tabs)/quick-add";

// Node's fs and path, taken by name: the project carries no Node type package.
declare const __dirname: string;
type Entry = { name: string; isDirectory: () => boolean };
const { readFileSync, readdirSync } = jest.requireActual<{
  readFileSync: (path: string, encoding: string) => string;
  readdirSync: (path: string, options: { withFileTypes: true }) => Entry[];
}>("fs");
const { join } = jest.requireActual<{ join: (...parts: string[]) => string }>("path");

const root = join(__dirname, "..", "src");
const read = (path: string) => readFileSync(join(root, path), "utf8");
// Every source file under a folder, as [relative path, text].
function sources(dir: string): [string, string][] {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? sources(path) : [[path, read(path)] as [string, string]];
  });
}

describe("the Quick Add route", () => {
  beforeEach(() => mockScreen.mockReset());

  it("hands the signed-in user to the screen, and shows nothing without a session", async () => {
    mockSession.mockReturnValue({ session: { user: { id: "u1" } } });
    await render(<QuickAddRoute />);
    expect(mockScreen).toHaveBeenCalledWith({ userId: "u1" });
    mockScreen.mockReset();
    mockSession.mockReturnValue({ session: null });
    await render(<QuickAddRoute />);
    expect(mockScreen).not.toHaveBeenCalled();
  });

  it("composes only: no Supabase call and no fetching in the route file", () => {
    const route = read("app/(tabs)/quick-add.tsx");
    expect(route).not.toMatch(/supabase|useQuery|fetch\(|functions\.invoke/);
  });
});

describe("root layout wiring (A2)", () => {
  const layout = read("app/_layout.tsx");

  it("wraps the app in one GestureHandlerRootView, outermost, and adds no other root view", () => {
    expect(layout.match(/<GestureHandlerRootView/g)).toHaveLength(1);
    expect(layout.indexOf("<GestureHandlerRootView")).toBeLessThan(layout.indexOf("<QueryClientProvider"));
    for (const [path, text] of sources("")) {
      if (path !== join("app", "_layout.tsx")) expect({ path, root: /<GestureHandlerRootView/.test(text) }).toEqual({ path, root: false });
    }
  });

  it("clears the departing user's skips on sign-out from the root navigator", () => {
    expect(layout).toContain("useClearQuickAddOnSignOut(session?.user.id)");
  });
});

describe("Quick Add is a tab (rework)", () => {
  it("is a screen of the (tabs) navigator, between Perch and Profile, and has no root-level route", () => {
    const tabs = read("app/(tabs)/_layout.tsx");
    expect(tabs.indexOf('name="index"')).toBeLessThan(tabs.indexOf('name="quick-add"'));
    expect(tabs.indexOf('name="quick-add"')).toBeLessThan(tabs.indexOf('name="profile"'));
    expect(read("app/_layout.tsx")).not.toContain('name="quick-add"');
    expect(() => read("app/quick-add.tsx")).toThrow();
  });

  it("leaves no Home row, no Quick Add back chip and no row or open-helper code behind", () => {
    for (const [path, text] of sources("")) {
      expect({ path, row: /QuickAddRow|useOpenQuickAdd|deckLayout/.test(text) }).toEqual({ path, row: false });
    }
    expect(read("app/(tabs)/index.tsx")).not.toMatch(/quick-?add/i);
    for (const [path, text] of [...sources("modules/quick-add"), ...sources("ui/SwipeDeckCard")]) {
      expect({ path, chip: /BackChip|goBackOrHome/.test(text) }).toEqual({ path, chip: false });
    }
  });
});

describe("standards greps on the deck code (B12)", () => {
  const files = [...sources("modules/quick-add"), ...sources("ui/SwipeDeckCard")];

  it("has no BlurView, console.log, effect-based fetching or literal colours", () => {
    for (const [path, text] of files) {
      expect({ path, blur: /BlurView/.test(text) }).toEqual({ path, blur: false });
      expect({ path, log: /console\.log/.test(text) }).toEqual({ path, log: false });
      expect({ path, colour: /#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(text) }).toEqual({ path, colour: false });
    }
  });

  it("reads and writes shared values with get and set: no `.value` on anything in the deck code", () => {
    for (const [path, text] of files) expect({ path, value: /\b\w+\.value\b/.test(text) }).toEqual({ path, value: false });
  });

  it("sets reduceMotion explicitly on every animation (inline, or in the named config it passes)", () => {
    const deckSource = read("modules/quick-add/components/SwipeDeck.tsx");
    const calls = [...deckSource.matchAll(/with(?:Timing|Spring)\(\s*[^,]+,\s*(\{[^}]*\}|\w+)/g)];
    expect(calls.length).toBeGreaterThan(8);
    for (const [, config] of calls) {
      const body = config.startsWith("{") ? config : (deckSource.match(new RegExp(`const ${config} = (\{[^}]*\})`))?.[1] ?? "");
      expect({ config, explicit: body.includes("reduceMotion: ReduceMotion.Never") }).toEqual({ config, explicit: true });
    }
    expect(deckSource).not.toMatch(/useReducedMotion/);
  });

  it("keeps Home's page limit at 3 and the deck's own at 15", () => {
    expect(read("modules/movies/api/getPopularMovies.ts")).toContain("export const MAX_PAGES_PER_LOAD = 3;");
    expect(read("modules/quick-add/readDeckPage.ts")).toContain("export const DECK_MAX_PAGES_PER_LOAD = 15;");
  });
});
