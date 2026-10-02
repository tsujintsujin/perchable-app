import { act as reactAct } from "react";
import { AccessibilityInfo } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { QueryClientProvider, notifyManager } from "@tanstack/react-query";

// No <SafeAreaProvider> in the test tree: fixed insets stand in for it.
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const mockPush = jest.fn();
let mockFocusCallbacks: (() => void)[] = [];
jest.mock("expo-router", () => {
  const { Text } = jest.requireActual("react-native");
  const { useEffect } = jest.requireActual("react");
  return {
    router: { push: (...args: unknown[]) => mockPush(...args) },
    // Runs the callback on mount and records it so a test can simulate regaining focus.
    useFocusEffect: (cb: () => void) => {
      useEffect(() => {
        mockFocusCallbacks.push(cb);
        cb();
      }, [cb]);
    },
    Link: ({ children }: { children: string }) => <Text>{children}</Text>,
  };
});

jest.mock("@/modules/profile", () => ({
  useOwnProfile: () => ({
    state: "loaded",
    refetch: jest.fn(),
    profile: { id: "u1", displayName: "Justin Masiga", avatarUrl: null, usertag: null, createdAt: "x", updatedAt: "x" },
  }),
}));

const mockInvoke = jest.fn();
jest.mock("@/lib/supabase", () => ({ supabase: { auth: { getSession: () => Promise.resolve({}) }, functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } } }));
jest.mock("@/lib/sentry", () => ({ Sentry: { captureException: jest.fn() } }));

import Home from "@/app/(tabs)/index";
import { createQueryClient } from "@/lib/queryClient";

const PAGE = {
  results: [
    { id: 1, title: "Dune", poster_path: "/dune.jpg", vote_average: 7, release_date: "2021-03-04" },
    { id: 2, title: "Nosferatu", poster_path: null, vote_average: 7, release_date: "1922-03-04" },
  ],
  page: 1,
  total_pages: 1,
};

const clients: ReturnType<typeof createQueryClient>[] = [];
let consoleError: jest.SpyInstance;
// Added to the monotonic clock the open-movie guard reads; a test advances it instead of waiting.
let skew = 0;
let perfNow: jest.SpyInstance;

// React Query delivers results on a timer; running its notifications in React's synchronous act makes every update land inside act.
beforeAll(() => {
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
beforeEach(() => {
  jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});
  mockInvoke.mockReset();
  mockPush.mockReset();
  mockFocusCallbacks = [];
  skew = 0;
  perfNow = jest.spyOn(performance, "now").mockImplementation(() => Date.now() + skew);
  mockInvoke.mockResolvedValue({ data: PAGE, error: null });
  consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
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
  consoleError.mockRestore();
  // React Native's jest setup makes performance.now a jest.fn; put it back to plain time instead of restoring it to undefined.
  perfNow.mockImplementation(() => Date.now());
});

// Renders Home under a fresh query client.
async function renderHome() {
  const client = createQueryClient();
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>
      <Home />
    </QueryClientProvider>,
  );
}

// Presses `name` twice with `gapMs` of (faked) monotonic time between them.
async function pressTwice(name: string, gapMs: number, between?: () => void) {
  const row = screen.getByRole("button", { name });
  await fireEvent.press(row);
  skew += gapMs;
  between?.();
  await fireEvent.press(row);
}

describe("Home: the Quick Add entry", () => {
  it("is a button with the design's label, hint, title and subline, below the Roulette card", async () => {
    await renderHome();
    await screen.findByRole("button", { name: "Dune, 2021" });
    const row = screen.getByRole("button", { name: "Quick Add" });
    expect(row.props.accessibilityHint).toBe("Swipe through movies to add them to your collection");
    expect(screen.getByText("Swipe right to add, left to skip")).toBeTruthy();
    expect(screen.getByText("🃏")).toBeTruthy();
    const order = screen.getAllByRole("button").map((node) => node.props.accessibilityLabel);
    expect(order.indexOf("Surprise me")).toBeLessThan(order.indexOf("Quick Add"));
  });

  it("stays when the Home list fails: it does not depend on the list", async () => {
    // A wrong-shaped body fails at once (a network error would wait out the one retry).
    mockInvoke.mockResolvedValue({ data: { nope: true }, error: null });
    await renderHome();
    await screen.findByText("Couldn't load movies");
    expect(screen.getByRole("button", { name: "Quick Add" })).toBeTruthy();
  });

  it("opens the deck with one push, and a double tap opens one deck", async () => {
    await renderHome();
    await screen.findByRole("button", { name: "Dune, 2021" });
    await pressTwice("Quick Add", 100);
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith("/quick-add");
  });

  it("coming back from the deck re-arms the entry, so the next tap opens it again", async () => {
    await renderHome();
    await screen.findByRole("button", { name: "Dune, 2021" });
    await pressTwice("Quick Add", 100, () => mockFocusCallbacks.forEach((cb) => cb()));
    expect(mockPush).toHaveBeenCalledTimes(2);
  });
});
