import { act as reactAct } from "react";
import { AccessibilityInfo, Dimensions, StyleSheet } from "react-native";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { QueryClientProvider, notifyManager } from "@tanstack/react-query";
import { FunctionsFetchError } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { fireGestureHandler, getByGestureTestId } from "react-native-gesture-handler/jest-utils";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 28, right: 0, bottom: 24, left: 0 }),
}));
const mockPush = jest.fn();
jest.mock("expo-router", () => {
  const { useEffect } = jest.requireActual("react");
  return {
    router: {
      push: (...args: unknown[]) => mockPush(...args),
      canGoBack: () => true,
      back: jest.fn(),
      replace: jest.fn(),
    },
    // Runs the callback on mount, like the real hook does when the screen is focused.
    useFocusEffect: (cb: () => void) => {
      useEffect(() => {
        cb();
      }, [cb]);
    },
  };
});
const mockInvoke = jest.fn();
jest.mock("@/lib/supabase", () => ({ supabase: { auth: { getSession: () => Promise.resolve({}) }, functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } } }));
jest.mock("@/lib/sentry", () => ({ Sentry: { captureException: jest.fn() } }));

import { createQueryClient } from "@/lib/queryClient";
import { QuickAddScreen } from "@/modules/quick-add";
import { clearQuickAddData, getSessionAdds, loadSkips, saveSkips } from "@/modules/quick-add/skipMemory";
import { colors, deck, size } from "@/ui/tokens";

type Reply = { data: unknown; error: unknown };
const movie = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  title: `Movie ${id}`,
  poster_path: null,
  vote_average: 7.04,
  release_date: "2021-01-01",
  ...extra,
});
const ok = (data: unknown): Reply => ({ data, error: null });
// A page of `count` movies numbered from `first`.
const pageOf = (n: number, first: number, count: number, total = 1, extra: Record<string, unknown> = {}) => ({
  results: Array.from({ length: count }, (_, i) => movie(first + i, extra)),
  page: n,
  total_pages: total,
});

// The screen is drawn at the design's 390 x 844 with insets 28 / 24 and a 74 dp tab bar: the content area is 390 x 770.
const SCREEN_WIDTH = 390;
const AREA_HEIGHT = 770;

let requested: number[] = [];
let replies: Record<number, Reply | (() => Reply | Promise<Reply>)> = {};
const clients: ReturnType<typeof createQueryClient>[] = [];
let consoleError: jest.SpyInstance;
let consoleWarn: jest.SpyInstance;
let announce: jest.SpyInstance;
let focusEvents: jest.SpyInstance;
let reduceMotionListener: ((enabled: boolean) => void) | undefined;
let reduceMotionStart = false;
// Added to the monotonic clock the tap guard reads; a test advances it instead of waiting.
let skew = 0;
let perfNow: jest.SpyInstance;

beforeAll(() => {
  Dimensions.set({
    window: { width: SCREEN_WIDTH, height: 844, scale: 1, fontScale: 1 },
    screen: { width: SCREEN_WIDTH, height: 844, scale: 1, fontScale: 1 },
  });
  notifyManager.setNotifyFunction((fn) => {
    const env = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
    const previous = env.IS_REACT_ACT_ENVIRONMENT;
    env.IS_REACT_ACT_ENVIRONMENT = true;
    try {
      reactAct(fn);
    } finally {
      env.IS_REACT_ACT_ENVIRONMENT = previous;
    }
  });
});
afterAll(() => {
  notifyManager.setNotifyFunction((fn) => fn());
});

beforeEach(async () => {
  requested = [];
  replies = {};
  skew = 0;
  reduceMotionStart = false;
  reduceMotionListener = undefined;
  mockPush.mockReset();
  mockInvoke.mockReset();
  mockInvoke.mockImplementation(async (url: string) => {
    const n = Number(/page=(\d+)/.exec(url)?.[1]);
    requested.push(n);
    const reply = replies[n] ?? ok(pageOf(n, n * 100, 30, 1));
    return typeof reply === "function" ? reply() : reply;
  });
  await AsyncStorage.clear();
  await clearQuickAddData("u1");
  consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  consoleWarn = jest.spyOn(console, "warn").mockImplementation(() => {});
  announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});
  focusEvents = jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent").mockImplementation(() => {});
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockImplementation(async () => reduceMotionStart);
  jest.spyOn(AccessibilityInfo, "addEventListener").mockImplementation(((event: string, handler: (enabled: boolean) => void) => {
    if (event === "reduceMotionChanged") reduceMotionListener = handler;
    return { remove: () => {} };
  }) as never);
  perfNow = jest.spyOn(performance, "now").mockImplementation(() => Date.now() + skew);
});
afterEach(async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  for (const client of clients.splice(0)) {
    await client.cancelQueries();
    client.clear();
  }
  expect(consoleError).not.toHaveBeenCalled();
  expect(consoleWarn).not.toHaveBeenCalled();
  consoleError.mockRestore();
  consoleWarn.mockRestore();
  announce.mockRestore();
  focusEvents.mockRestore();
  perfNow.mockImplementation(() => Date.now());
});

// Renders the screen and gives the deck area the design's measured size.
async function renderScreen(userId = "u1") {
  const client = createQueryClient();
  clients.push(client);
  const view = await render(
    <QueryClientProvider client={client}>
      <QuickAddScreen key={userId} userId={userId} />
    </QueryClientProvider>,
  );
  await act(async () => {
    await fireEvent(screen.getByTestId("deck-area"), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: SCREEN_WIDTH, height: AREA_HEIGHT } } });
  });
  return view;
}
async function renderFilled() {
  const view = await renderScreen();
  await screen.findByLabelText("Movie 100, 2021");
  return view;
}

// Ids of the cards mounted right now, top first by their order in the tree.
const mountedCards = () => screen.queryAllByTestId(/^deck-card-/, { includeHiddenElements: true }).map((node) => Number(String(node.props.testID).slice(10)));
const card = (id: number) => screen.getByTestId(`deck-card-${id}`, { includeHiddenElements: true });
// The animated style the card is drawn with right now.
const styleOf = (id: number) => card(id).props.jestAnimatedStyle.value as { opacity: number; transform: Record<string, number | string>[] };
const transformOf = (id: number, key: string) => styleOf(id).transform.find((t) => key in t)?.[key];
// The tilt in degrees.
const deg = (id: number) => parseFloat(String(transformOf(id, "rotate")));
const stampOpacity = (id: number, which: "add" | "skip") =>
  within(card(id)).getByTestId(`stamp-${which}`, { includeHiddenElements: true }).props.jestAnimatedStyle.value.opacity as number;
const tintOpacity = (id: number, which: "add" | "skip") =>
  within(card(id)).getByTestId(`tint-${which}`, { includeHiddenElements: true }).props.jestAnimatedStyle.value.opacity as number;
const dimOpacity = (id: number) => within(card(id)).getByTestId("dim", { includeHiddenElements: true }).props.jestAnimatedStyle.value.opacity as number;

type PanEvent = { translationX: number; translationY?: number; velocityX?: number };
type PanHandlers = { onStart: () => void; onUpdate: (e: PanEvent) => void; onEnd: (e: PanEvent, success: boolean) => void; onFinalize: () => void };
// The pan's own callbacks, to hold a drag mid-way (fireGestureHandler always plays a drag to its end).
const pan = (id: number) => (getByGestureTestId(`deck-pan-${id}`) as unknown as { handlers: PanHandlers }).handlers;
// Plays a whole drag through the gesture-handler test utilities.
const drag = (id: number, translationX: number, velocityX = 0) =>
  act(async () => {
    fireGestureHandler(getByGestureTestId(`deck-pan-${id}`), [{ translationX: Math.sign(translationX) * 12 }, { translationX, velocityX }]);
  });
const press = (name: RegExp | string) => fireEvent.press(screen.getByRole("button", { name }));
// Waits for the leaving card to finish its exit and be removed.
// Waits until the buttons can act again (the exit has finished and the screen has re-enabled them).
const ready = () => waitFor(() => expect(screen.getByRole("button", { name: /^Skip/ }).props.accessibilityState.disabled).toBe(false));
const exitDone = (id: number) => waitFor(() => expect(screen.queryByTestId(`deck-card-${id}`, { includeHiddenElements: true })).toBeNull());

describe("states (B8, copy from DESIGN)", () => {
  it("loading: a card-shaped placeholder, one polite live region, announced once, controls disabled", async () => {
    const gate: { resolve: (r: Reply) => void } = { resolve: () => {} };
    replies[1] = () => new Promise<Reply>((resolve) => (gate.resolve = resolve));
    await renderScreen();
    const region = screen.getByLabelText("Loading movies");
    expect(region.props.accessibilityLiveRegion).toBe("polite");
    expect(announce).toHaveBeenCalledWith("Loading movies");
    expect(announce).toHaveBeenCalledTimes(1);
    for (const name of ["Skip", "Undo", "Add to collection"]) {
      expect(screen.getByRole("button", { name }).props.accessibilityState.disabled).toBe(true);
    }
    await act(async () => gate.resolve(ok(pageOf(1, 100, 5))));
    await screen.findByLabelText("Movie 100, 2021");
  });

  it("error and offline cold start: Couldn't load movies with Retry, controls drawn but disabled", async () => {
    replies[1] = ok(null);
    replies[1] = { data: null, error: new FunctionsFetchError(new TypeError("offline")) };
    await renderScreen();
    expect(await screen.findByText("Couldn't load movies")).toBeTruthy();
    expect(screen.getByText("Check your connection and try again.")).toBeTruthy();
    expect(screen.getByText("🦉")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Skip" }).props.accessibilityState.disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Undo" }).props.accessibilityState.disabled).toBe(true);
  });

  it("a double tap on Retry sends one request", async () => {
    replies[1] = { data: null, error: new FunctionsFetchError(new TypeError("offline")) };
    await renderScreen();
    await screen.findByText("Couldn't load movies");
    const gate: { resolve: (r: Reply) => void } = { resolve: () => {} };
    replies[1] = () => new Promise<Reply>((resolve) => (gate.resolve = resolve));
    await act(async () => {
      await fireEvent.press(screen.getByRole("button", { name: "Retry" }));
      await fireEvent.press(screen.getByRole("button", { name: "Retry" }));
    });
    expect(requested).toEqual([1, 1]);
    await act(async () => gate.resolve(ok(pageOf(1, 100, 5))));
    await screen.findByLabelText("Movie 100, 2021");
  });

  it("caught up: copy and Start over (which clears the saved skips and reloads); Undo still works there", async () => {
    replies[1] = ok(pageOf(1, 100, 1));
    await saveSkips("u1", []);
    await renderFilled();
    await drag(100, -300);
    await screen.findByText("You're all caught up");
    expect(screen.getByText("You've been through this whole list. Start over to see the movies you skipped again.")).toBeTruthy();
    expect(screen.getByText("🎉")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Undo" }).props.accessibilityState.disabled).toBe(false);
    expect(await loadSkips("u1")).toEqual([100]);
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Start over and show skipped movies again" })));
    await screen.findByLabelText("Movie 100, 2021");
    expect(await loadSkips("u1")).toEqual([]);
  });

  it("keep-going: copy, and Keep looking reads on", async () => {
    const skipped = Array.from({ length: 15 * 3 }, (_, i) => i + 1);
    for (let n = 1; n <= 15; n++) replies[n] = ok(pageOf(n, (n - 1) * 3 + 1, 3, 40));
    replies[16] = ok(pageOf(16, 900, 3, 40));
    await saveSkips("u1", skipped);
    await renderScreen();
    expect(await screen.findByText("Still looking")).toBeTruthy();
    expect(screen.getByText("We skipped past a lot of movies you've already seen. There may be more.")).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Keep looking for more movies" })));
    await screen.findByLabelText("Movie 900, 2021");
  });

  it("next page failed with no cards left: Couldn't load more movies and Retry", async () => {
    replies[1] = ok(pageOf(1, 100, 1, 9));
    replies[2] = { data: null, error: new FunctionsFetchError(new TypeError("offline")) };
    await renderFilled();
    await drag(100, 300);
    expect(await screen.findByText("Couldn't load more movies")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("after several all-seen pages the loading state says what it is doing", async () => {
    await saveSkips("u1", Array.from({ length: 9 }, (_, i) => i + 1));
    for (let n = 1; n <= 3; n++) replies[n] = ok(pageOf(n, (n - 1) * 3 + 1, 3, 40));
    const gate: { resolve: (r: Reply) => void } = { resolve: () => {} };
    replies[4] = () => new Promise<Reply>((resolve) => (gate.resolve = resolve));
    await renderScreen();
    expect(await screen.findByText("Finding movies you haven't seen…")).toBeTruthy();
    expect(screen.getByLabelText("Finding movies you haven't seen…").props.accessibilityLiveRegion).toBe("polite");
    await act(async () => gate.resolve(ok(pageOf(4, 900, 3, 40))));
    await screen.findByLabelText("Movie 900, 2021");
  });
});

describe("the filled screen (B2, layout)", () => {
  it("fills the whole content area with the top card and mounts one more poster behind it, nothing else", async () => {
    await renderFilled();
    expect(mountedCards().sort()).toEqual([100, 101]);
    const frame = StyleSheet.flatten(card(100).props.style);
    expect([frame.width, frame.height]).toEqual([SCREEN_WIDTH, AREA_HEIGHT]);
    expect(screen.getByText("Movie 100")).toBeTruthy();
    expect(screen.getByText("2021")).toBeTruthy();
    expect(screen.getByText(/7\.0/)).toBeTruthy();
  });

  it("has the floating title (no Back chip: it is a tab), an empty top-right, and the three controls", async () => {
    await renderFilled();
    const title = screen.getByRole("header", { name: "Quick Add" });
    const style = StyleSheet.flatten(title.props.style);
    expect(style.left).toBe(20);
    expect(style.right).toBe(size.homeHeaderInset);
    expect(style.top).toBe(28 + 12);
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
    expect(screen.getByRole("button", { name: "Skip Movie 100" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add Movie 100 to collection" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Undo" }).props.accessibilityState.disabled).toBe(true);
  });

  it("keeps the card stack as a real native box, so the cards' zIndex cannot leak over the dock and header", async () => {
    await renderFilled();
    expect(card(100).parent?.props.collapsable).toBe(false);
  });

  it("the title band ends right above the dock (102 dp: 16 pad + 78 controls + 8), and the card tilts about its bottom centre", async () => {
    await renderFilled();
    expect(StyleSheet.flatten(within(card(100)).getByTestId("band", { includeHiddenElements: true }).props.style).bottom).toBe(size.deckControlsZone);
    expect(StyleSheet.flatten(card(100).props.style).transformOrigin).toBe("50% 100%");
  });

  it("every control is at least 48 dp and the three share one label baseline and circle centre line", async () => {
    await renderFilled();
    const columns = ["Skip Movie 100", "Undo", "Add Movie 100 to collection"].map((name) => StyleSheet.flatten(screen.getByRole("button", { name }).props.style));
    for (const column of columns) {
      expect(column.width).toBeGreaterThanOrEqual(size.minTouch);
      expect(column.minHeight).toBeGreaterThanOrEqual(size.minTouch);
      expect(column.justifyContent).toBe("flex-end");
    }
    expect(new Set(columns.map((c) => c.minHeight))).toEqual(new Set([size.deckControlsHeight]));
    expect(new Set(columns.map((c) => c.width))).toEqual(new Set([size.deckButton]));
  });

  it("a poster with no path shows the clapperboard fallback with the title and stays swipeable", async () => {
    await renderFilled();
    expect(within(card(100)).getByText("🎬")).toBeTruthy();
    await drag(100, -300);
    await exitDone(100);
    expect(mountedCards()).not.toContain(100);
  });

  it("a movie with no year and no rating draws no meta row, never NaN or 0", async () => {
    replies[1] = ok({ results: [movie(100, { release_date: "", vote_average: 0 })], page: 1, total_pages: 1 });
    await renderScreen();
    await screen.findByLabelText("Movie 100");
    expect(screen.queryByText(/0\.0/)).toBeNull();
    expect(screen.queryByText(/NaN/)).toBeNull();
  });

  it("fetches the posters two past the mounted cards ahead of time", async () => {
    const prefetch = jest.spyOn(Image, "prefetch").mockResolvedValue(true);
    replies[1] = ok({ results: Array.from({ length: 8 }, (_, i) => movie(100 + i, { poster_path: `/p${i}.jpg` })), page: 1, total_pages: 1 });
    await renderScreen();
    await screen.findByLabelText("Movie 100, 2021");
    await waitFor(() => expect(prefetch).toHaveBeenCalledWith(["https://image.tmdb.org/t/p/w780/p2.jpg", "https://image.tmdb.org/t/p/w780/p3.jpg"], "memory-disk"));
    prefetch.mockRestore();
  });
});

describe("the drag, mid-gesture (B3, M4)", () => {
  // Screen width 390: stamp 0 at 58.5 dp, 1 at 117 dp; commit at 136.5 dp.
  const W = SCREEN_WIDTH;

  it("follows the finger and tilts by distance; no stamp at 15%", async () => {
    await renderFilled();
    await act(async () => {
      pan(100).onStart();
      pan(100).onUpdate({ translationX: 0.15 * W, translationY: 10 });
    });
    expect(transformOf(100, "translateX")).toBeCloseTo(0.15 * W);
    expect(stampOpacity(100, "add")).toBeCloseTo(0);
    expect(tintOpacity(100, "add")).toBeCloseTo(0);
    // 58.5 dp of a 0.5 x 390 full-tilt distance: 3.6 degrees.
    expect(deg(100)).toBeCloseTo(((0.15 * W) / (0.5 * W)) * deck.tiltMaxDeg);
    // The vertical movement is followed at 30%.
    expect(transformOf(100, "translateY")).toBeCloseTo(3);
  });

  it("at 30% the ADD stamp and tint are full, the SKIP ones off, the card tilts 3.6 degrees", async () => {
    await renderFilled();
    await act(async () => {
      pan(100).onStart();
      pan(100).onUpdate({ translationX: 0.3 * W });
    });
    expect(stampOpacity(100, "add")).toBeCloseTo(1);
    expect(tintOpacity(100, "add")).toBeCloseTo(1);
    expect(stampOpacity(100, "skip")).toBe(0);
    expect(deg(100)).toBeCloseTo(3.6);
  });

  it("dragging left shows the SKIP stamp and tint instead", async () => {
    await renderFilled();
    await act(async () => {
      pan(100).onStart();
      pan(100).onUpdate({ translationX: -0.3 * W });
    });
    expect(stampOpacity(100, "skip")).toBeCloseTo(1);
    expect(tintOpacity(100, "skip")).toBeCloseTo(1);
    expect(stampOpacity(100, "add")).toBe(0);
    expect(deg(100)).toBeCloseTo(-3.6);
  });

  it("the stamp is half strength halfway between 15% and 30%", async () => {
    await renderFilled();
    await act(async () => {
      pan(100).onStart();
      pan(100).onUpdate({ translationX: 0.225 * W });
    });
    expect(stampOpacity(100, "add")).toBeCloseTo(0.5);
  });

  it("the tilt stops at 12 degrees", async () => {
    await renderFilled();
    await act(async () => {
      pan(100).onStart();
      pan(100).onUpdate({ translationX: W });
    });
    expect(deg(100)).toBeCloseTo(deck.tiltMaxDeg);
  });

  it("the next poster underneath grows 0.94 to 1 and loses its dim as the top card goes", async () => {
    await renderFilled();
    expect(transformOf(101, "scale")).toBeCloseTo(0.94);
    expect(dimOpacity(101)).toBeCloseTo(1);
    // p = 1 at the commit distance; at 0.175 W, p = 0.5.
    await act(async () => {
      pan(100).onStart();
      pan(100).onUpdate({ translationX: 0.175 * W });
    });
    expect(transformOf(101, "scale")).toBeCloseTo(0.97);
    expect(dimOpacity(101)).toBeCloseTo(0.5);
    expect(dimOpacity(100)).toBe(0);
    // The next card never lifts or tilts.
    expect(transformOf(101, "translateY")).toBe(0);
    expect(deg(101)).toBe(0);
  });

  it("the stamp sits at the design's top offset", async () => {
    await renderFilled();
    const stamp = within(card(100)).getByTestId("stamp-add", { includeHiddenElements: true });
    expect(StyleSheet.flatten(stamp.props.style).top).toBe(deck.stampTop);
  });

  it("releasing below the threshold springs back to the centre with no stamp or tilt left", async () => {
    await renderFilled();
    await act(async () => {
      pan(100).onStart();
      pan(100).onUpdate({ translationX: 0.3 * W });
    });
    await act(async () => {
      pan(100).onEnd({ translationX: 0.3 * W, velocityX: 0 }, true);
      pan(100).onFinalize();
    });
    await waitFor(() => expect(transformOf(100, "translateX")).toBeCloseTo(0, 0));
    expect(stampOpacity(100, "add")).toBeCloseTo(0, 1);
    expect(transformOf(100, "scale")).toBeCloseTo(1);
    expect(mountedCards().sort()).toEqual([100, 101]);
    expect(await loadSkips("u1")).toEqual([]);
  });

  it("an interrupted drag (second finger, app switch, system gesture) returns the card centred and leaves nothing stuck", async () => {
    await renderFilled();
    await act(async () => {
      pan(100).onStart();
      pan(100).onUpdate({ translationX: 0.3 * W });
    });
    // The handler ends with success false when it is cancelled.
    await act(async () => {
      pan(100).onEnd({ translationX: 0.3 * W, velocityX: 3000 }, false);
      pan(100).onFinalize();
    });
    await waitFor(() => expect(transformOf(100, "translateX")).toBeCloseTo(0, 0));
    expect(stampOpacity(100, "add")).toBeCloseTo(0, 1);
    expect(mountedCards().sort()).toEqual([100, 101]);
    expect(screen.getByRole("button", { name: "Skip Movie 100" }).props.accessibilityState.disabled).toBe(false);
    expect(await loadSkips("u1")).toEqual([]);
  });

  it("a release past 35% commits and the new top card is interactive at once", async () => {
    await renderFilled();
    await drag(100, 0.4 * W);
    expect(mountedCards()).toContain(101);
    expect(getByGestureTestId("deck-pan-101")).toBeTruthy();
    await exitDone(100);
    expect(mountedCards().sort()).toEqual([101, 102]);
  });

  it("a short fast flick commits; a fast twitch does not", async () => {
    await renderFilled();
    await drag(100, 25, 2000);
    expect(await loadSkips("u1")).toEqual([]);
    expect(mountedCards()).toContain(100);
    await drag(100, 60, 2000);
    await exitDone(100);
    expect(getSessionAdds("u1")).toEqual([100]);
  });
});

describe("one swipe per action (failure mode 3)", () => {
  it("a left swipe: the card is gone, never comes back this session, and is saved on the device", async () => {
    await renderFilled();
    await drag(100, -300);
    await exitDone(100);
    expect(await loadSkips("u1")).toEqual([100]);
    expect(screen.queryByLabelText("Movie 100, 2021")).toBeNull();
    expect(announce).toHaveBeenCalledWith("Skipped Movie 100");
    expect(screen.queryByText("Adding to your collection is coming soon.")).toBeNull();
  });

  it("a right swipe: the card is gone, the coming-soon Toast shows, and nothing is stored", async () => {
    await renderFilled();
    await drag(100, 300);
    await exitDone(100);
    expect(screen.getByText("Adding to your collection is coming soon.")).toBeTruthy();
    expect(await loadSkips("u1")).toEqual([]);
    expect(await AsyncStorage.getItem("quickAdd:skips:u1")).toBeNull();
    expect(getSessionAdds("u1")).toEqual([100]);
  });

  it("the Skip and Add buttons give the same result as the swipes", async () => {
    await renderFilled();
    await act(async () => press("Skip Movie 100"));
    await exitDone(100);
    await ready();
    expect(await loadSkips("u1")).toEqual([100]);
    await act(async () => press("Add Movie 101 to collection"));
    await exitDone(101);
    expect(getSessionAdds("u1")).toEqual([101]);
    expect(screen.getByText("Adding to your collection is coming soon.")).toBeTruthy();
  });

  it("tapping a button ten times at once is one swipe", async () => {
    await renderFilled();
    await act(async () => {
      for (let i = 0; i < 10; i++) await press("Skip Movie 100");
    });
    await exitDone(100);
    expect(await loadSkips("u1")).toEqual([100]);
    expect(mountedCards()).toContain(101);
  });

  it("the buttons are disabled while a card is flying off and enabled again after", async () => {
    await renderFilled();
    await act(async () => press("Skip Movie 100"));
    expect(screen.getByRole("button", { name: "Skip Movie 101" }).props.accessibilityState.disabled).toBe(true);
    await exitDone(100);
    await waitFor(() => expect(screen.getByRole("button", { name: "Skip Movie 101" }).props.accessibilityState.disabled).toBe(false));
  });

  it("swiping the next card during the previous card's exit works, and each card leaves once", async () => {
    await renderFilled();
    await drag(100, -300);
    // The new top card is interactive at once, before the first exit has finished.
    await drag(101, -300);
    await waitFor(() => expect(mountedCards().sort()).toEqual([102, 103]));
    expect(await loadSkips("u1")).toEqual([100, 101]);
  });

  it("ten swipes in a row: every card leaves once, none is lost or shown twice, and one page is requested", async () => {
    replies[1] = ok(pageOf(1, 100, 14, 3));
    replies[2] = ok(pageOf(2, 200, 14, 3));
    await renderFilled();
    for (let id = 100; id < 110; id++) await drag(id, id % 2 === 0 ? -300 : 300);
    await waitFor(() => expect(mountedCards().sort((a, b) => a - b)).toEqual([110, 111]));
    const saved = await loadSkips("u1");
    expect(saved).toEqual([100, 102, 104, 106, 108]);
    expect(getSessionAdds("u1")).toEqual([101, 103, 105, 107, 109]);
    expect(requested.filter((n) => n === 2)).toHaveLength(1);
    expect(new Set(mountedCards()).size).toBe(mountedCards().length);
  });

  it("never mounts more than two cards and a leaving one, and only two at rest", async () => {
    await renderFilled();
    await act(async () => press("Skip Movie 100"));
    expect(mountedCards().length).toBeLessThanOrEqual(3);
    await exitDone(100);
    expect(mountedCards().length).toBe(2);
  });

  it("a card leaves with the design's motion: 75% of the way at 100 ms, tilted, past the screen edge at 200 ms", async () => {
    await renderFilled();
    jest.useFakeTimers();
    try {
      const exitX = SCREEN_WIDTH + deck.exitMargin;
      await drag(100, 0.4 * SCREEN_WIDTH);
      await act(async () => {
        jest.advanceTimersByTime(100);
      });
      // Easing.out(quad): 75% of the distance in half the time, from where the finger let go.
      const mid = (transformOf(100, "translateX") as number) - 0.4 * SCREEN_WIDTH;
      expect(mid / (exitX - 0.4 * SCREEN_WIDTH)).toBeGreaterThan(0.6);
      expect(mid / (exitX - 0.4 * SCREEN_WIDTH)).toBeLessThan(0.9);
      expect(stampOpacity(100, "add")).toBe(1);
      await act(async () => {
        jest.advanceTimersByTime(90);
      });
      expect(transformOf(100, "translateX")).toBeGreaterThan(exitX - 5);
      expect(deg(100)).toBeCloseTo(deck.tiltMaxDeg);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("Toast position (rework)", () => {
  it("the coming-soon Toast is at the top, 12 dp under the header, never at the bottom over the controls", async () => {
    await renderFilled();
    await drag(100, 300);
    await exitDone(100);
    const toast = StyleSheet.flatten(screen.getByRole("alert").props.style);
    expect(toast.top).toBe(28 + 48 + 12);
    expect(toast.bottom).toBeUndefined();
  });
});

describe("Undo (B6)", () => {
  it("brings the swiped card back on top and, for a skip, removes it from the saved skips", async () => {
    await renderFilled();
    await drag(100, -300);
    await exitDone(100);
    await act(async () => press("Undo"));
    await screen.findByLabelText("Movie 100, 2021");
    expect(mountedCards().sort()).toEqual([100, 101]);
    expect(await loadSkips("u1")).toEqual([]);
    expect(announce).toHaveBeenCalledWith("Undid skip for Movie 100");
    expect(screen.getByRole("button", { name: "Undo" }).props.accessibilityState.disabled).toBe(true);
  });

  it("the returning card fades and scales in over 200 ms from 0.92", async () => {
    await renderFilled();
    await drag(100, -300);
    await exitDone(100);
    await act(async () => press("Undo"));
    await screen.findByLabelText("Movie 100, 2021");
    expect(transformOf(100, "scale")).toBeCloseTo(deck.returnScale, 1);
    await waitFor(() => expect(styleOf(100).opacity).toBe(1));
    expect(transformOf(100, "scale")).toBeCloseTo(1);
    expect(focusEvents).toHaveBeenCalledWith(expect.anything(), "focus");
  });

  it("is enabled in the caught-up state and disabled after one Undo until the next swipe", async () => {
    await renderFilled();
    expect(screen.getByRole("button", { name: "Undo" }).props.accessibilityState.disabled).toBe(true);
    await drag(100, 300);
    await exitDone(100);
    expect(screen.getByRole("button", { name: "Undo" }).props.accessibilityState.disabled).toBe(false);
  });

  it("a card returned while another is being dragged is held until the release, then appears on top with the Toast and announcement", async () => {
    await renderFilled();
    await drag(100, -300);
    await exitDone(100);
    // A second finger holds the new top card mid-drag while Undo is pressed.
    await act(async () => pan(101).onStart());
    await act(async () => press("Undo"));
    expect(screen.queryByLabelText("Movie 100, 2021")).toBeNull();
    expect(mountedCards().sort()).toEqual([101, 102]);
    await act(async () => {
      pan(101).onEnd({ translationX: 10, velocityX: 0 }, true);
      pan(101).onFinalize();
    });
    await screen.findByLabelText("Movie 100, 2021");
    expect(screen.getByText("“Movie 100” is back")).toBeTruthy();
    expect(announce).toHaveBeenCalledWith("Movie 100 is back");
    expect(await loadSkips("u1")).toEqual([]);
  });

  it("Undo pressed during the card's own exit never shows it twice", async () => {
    await renderFilled();
    await act(async () => press("Skip Movie 100"));
    await act(async () => press("Undo"));
    await screen.findByLabelText("Movie 100, 2021");
    await waitFor(() => expect(screen.queryAllByLabelText("Movie 100, 2021", { includeHiddenElements: true })).toHaveLength(1));
    expect(mountedCards().length).toBeLessThanOrEqual(3);
  });
});

describe("tap, details and accessibility (B7, B9)", () => {
  it("a tap on the card opens details once, even on a double tap", async () => {
    await renderFilled();
    await fireEvent.press(screen.getByLabelText("Movie 100, 2021"));
    await fireEvent.press(screen.getByLabelText("Movie 100, 2021"));
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith({ pathname: "/movie/[id]", params: { id: "100" } });
  });

  it("the card is a labelled button with a hint and exactly the three custom actions", async () => {
    await renderFilled();
    const top = screen.getByLabelText("Movie 100, 2021");
    expect(top.props.accessibilityRole).toBe("button");
    expect(top.props.accessibilityHint).toBe("Opens details");
    expect(top.props.accessibilityActions).toEqual([
      { name: "openDetails", label: "Open details" },
      { name: "skip", label: "Skip" },
      { name: "add", label: "Add" },
    ]);
  });

  it("the Skip, Add and Open details actions run the same commit as a swipe or a button", async () => {
    await renderFilled();
    await act(async () => fireEvent(screen.getByLabelText("Movie 100, 2021"), "accessibilityAction", { nativeEvent: { actionName: "skip" } }));
    await exitDone(100);
    expect(await loadSkips("u1")).toEqual([100]);
    await act(async () => fireEvent(screen.getByLabelText("Movie 101, 2021"), "accessibilityAction", { nativeEvent: { actionName: "add" } }));
    await exitDone(101);
    expect(getSessionAdds("u1")).toEqual([101]);
    await fireEvent(screen.getByLabelText("Movie 102, 2021"), "accessibilityAction", { nativeEvent: { actionName: "openDetails" } });
    expect(mockPush).toHaveBeenCalledWith({ pathname: "/movie/[id]", params: { id: "102" } });
  });

  it("the cards behind are hidden from screen readers and the stamps carry no accessibility", async () => {
    await renderFilled();
    expect(card(101).props.importantForAccessibility).toBe("no-hide-descendants");
    expect(card(101).props.accessibilityElementsHidden).toBe(true);
    expect(card(100).props.importantForAccessibility).toBe("auto");
    expect(within(card(100)).getByTestId("stamp-add", { includeHiddenElements: true }).props.importantForAccessibility).toBe("no");
  });

  it("after a swipe the new top card takes screen-reader focus", async () => {
    await renderFilled();
    expect(focusEvents).not.toHaveBeenCalled();
    await drag(100, -300);
    await waitFor(() => expect(focusEvents).toHaveBeenCalledWith(expect.anything(), "focus"));
  });
});

describe("reduce motion (B10, M4)", () => {
  it("reads the setting at start: no tilt, and the cards behind do not scale or lift with the drag", async () => {
    reduceMotionStart = true;
    await renderFilled();
    await waitFor(() => expect(reduceMotionListener).toBeDefined());
    await act(async () => {
      pan(100).onStart();
      pan(100).onUpdate({ translationX: 0.3 * SCREEN_WIDTH });
    });
    expect(transformOf(100, "translateX")).toBeCloseTo(0.3 * SCREEN_WIDTH);
    expect(deg(100)).toBe(0);
    expect(transformOf(101, "scale")).toBeCloseTo(0.94);
    // The stamp is opacity, not motion: it stays.
    expect(stampOpacity(100, "add")).toBeCloseTo(1);
  });

  it("a commit fades the card out in place instead of flying it off, still one swipe", async () => {
    reduceMotionStart = true;
    await renderFilled();
    await waitFor(() => expect(reduceMotionListener).toBeDefined());
    await act(async () => press("Skip Movie 100"));
    expect(transformOf(100, "translateX")).toBe(0);
    expect(stampOpacity(100, "skip")).toBe(1);
    await exitDone(100);
    expect(await loadSkips("u1")).toEqual([100]);
    // The next card is on top at full size straight away.
    expect(transformOf(101, "scale")).toBeCloseTo(1);
  });

  it("flipping the setting while the app runs changes the very next release (a shared value, not a stale closure)", async () => {
    await renderFilled();
    await waitFor(() => expect(reduceMotionListener).toBeDefined());
    // Off at first: a drag tilts.
    await act(async () => {
      pan(100).onStart();
      pan(100).onUpdate({ translationX: 0.3 * SCREEN_WIDTH });
    });
    expect(deg(100)).toBeCloseTo(3.6);
    await act(async () => {
      pan(100).onEnd({ translationX: 0.3 * SCREEN_WIDTH, velocityX: 0 }, true);
      pan(100).onFinalize();
    });
    await waitFor(() => expect(transformOf(100, "translateX")).toBeCloseTo(0, 0));
    // Switched on at run time: the same drag no longer tilts, and the release eases back instead of springing.
    await act(async () => reduceMotionListener?.(true));
    await act(async () => {
      pan(100).onStart();
      pan(100).onUpdate({ translationX: 0.3 * SCREEN_WIDTH });
    });
    expect(deg(100)).toBe(0);
    await act(async () => {
      pan(100).onEnd({ translationX: 0.3 * SCREEN_WIDTH, velocityX: 0 }, true);
      pan(100).onFinalize();
    });
    await waitFor(() => expect(transformOf(100, "translateX")).toBeCloseTo(0, 0));
    // And back off: the next commit flies the card out again.
    await act(async () => reduceMotionListener?.(false));
    await drag(100, 300);
    await waitFor(() => expect(transformOf(100, "translateX")).toBeGreaterThan(300));
  });

  it("a returning card appears at once", async () => {
    reduceMotionStart = true;
    await renderFilled();
    await waitFor(() => expect(reduceMotionListener).toBeDefined());
    await act(async () => press("Skip Movie 100"));
    await exitDone(100);
    await act(async () => press("Undo"));
    await screen.findByLabelText("Movie 100, 2021");
    expect(styleOf(100).opacity).toBe(1);
    expect(transformOf(100, "scale")).toBeCloseTo(1);
  });
});

describe("data edge cases (failure mode: data)", () => {
  it("a very long title is limited to two lines, and an emoji or right-to-left title still renders", async () => {
    replies[1] = ok({
      results: [movie(100, { title: "The Lord of the Rings: The Fellowship of the Ring and a lot more words to make it long" }), movie(101, { title: "🎬 فيلم" })],
      page: 1,
      total_pages: 1,
    });
    await renderScreen();
    expect(await screen.findByText(/The Lord of the Rings/)).toHaveProp("numberOfLines", 2);
    expect(screen.getByText("🎬 فيلم", { includeHiddenElements: true })).toBeTruthy();
  });

  it("an untitled movie reads as Untitled, never empty", async () => {
    replies[1] = ok({ results: [movie(100, { title: "  " })], page: 1, total_pages: 1 });
    await renderScreen();
    expect(await screen.findByLabelText("Untitled, 2021")).toBeTruthy();
  });

  it("the deck colours come from tokens: the add tint is the gold token, the skip tint the danger one", async () => {
    await renderFilled();
    const add = within(card(100)).getByTestId("tint-add", { includeHiddenElements: true });
    const skip = within(card(100)).getByTestId("tint-skip", { includeHiddenElements: true });
    expect(StyleSheet.flatten(add.props.style).backgroundColor).toBe(colors.overlay.addTint);
    expect(StyleSheet.flatten(skip.props.style).backgroundColor).toBe(colors.overlay.skipTint);
  });
});
