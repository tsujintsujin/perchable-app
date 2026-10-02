import { act as reactAct } from "react";
import { AccessibilityInfo } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { QueryClientProvider, notifyManager } from "@tanstack/react-query";

// No <SafeAreaProvider> in the test tree: fixed insets stand in for it.
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const mockPush = jest.fn();
jest.mock("expo-router", () => {
  const { Text } = jest.requireActual("react-native");
  return {
    router: { push: (...args: unknown[]) => mockPush(...args) },
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

// Presses `name` twice, `gapMs` apart by the clock the guard reads (the clock is faked only around the presses).
async function pressTwice(name: string, gapMs: number) {
  let clock = Date.now() + 10_000;
  const now = jest.spyOn(Date, "now").mockImplementation(() => clock);
  try {
    const tile = screen.getByRole("button", { name });
    await fireEvent.press(tile);
    clock += gapMs;
    await fireEvent.press(tile);
  } finally {
    now.mockRestore();
  }
}

describe("Home: opening a movie", () => {
  it("a poster tap pushes the details route for that movie, with and without a poster image", async () => {
    await renderHome();
    await screen.findByRole("button", { name: "Dune, 2021" });
    await fireEvent.press(screen.getByRole("button", { name: "Dune, 2021" }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: "/movie/[id]", params: { id: "1" } });

    // A tap well after the first is a new request to open.
    await pressTwice("Nosferatu, 1922", 5000);
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: "/movie/[id]", params: { id: "2" } });
    expect(mockPush).toHaveBeenCalledTimes(3);
  });

  it("a double tap opens one details screen, not two", async () => {
    await renderHome();
    await screen.findByRole("button", { name: "Dune, 2021" });
    await pressTwice("Dune, 2021", 100);
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it("opening a poster makes no new popular request", async () => {
    await renderHome();
    await fireEvent.press(await screen.findByRole("button", { name: "Dune, 2021" }));
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });
});
