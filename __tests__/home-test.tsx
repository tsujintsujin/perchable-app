import { AccessibilityInfo, StyleSheet } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { QueryClientProvider } from "@tanstack/react-query";
import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";

// No <SafeAreaProvider> in the test tree — fixed insets stand in for it.
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

// Home reads the signed-in Avatar from useOwnProfile — mocked so no Supabase session or profiles row is needed.
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

const mockInvoke = jest.fn();
jest.mock("@/lib/supabase", () => ({ supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } } }));
const mockCapture = jest.fn();
jest.mock("@/lib/sentry", () => ({ Sentry: { captureException: (...args: unknown[]) => mockCapture(...args) } }));

import Home from "@/app/(tabs)/index";
import { createQueryClient } from "@/lib/queryClient";

const movie = (id: number, title: string, poster: string | null, date = "2021-03-04") => ({
  id,
  title,
  poster_path: poster,
  vote_average: 7,
  release_date: date,
});

const PAGE = {
  results: [
    movie(1, "Dune", "/dune.jpg"),
    movie(2, "Nosferatu", null, "1922-03-04"),
    movie(3, "Untitled Year Unknown", "/u.jpg", ""),
  ],
  page: 1,
  total_pages: 5,
};

const httpError = (status: number) => new FunctionsHttpError({ status, json: async () => ({ error: "x" }) });
const offline = () => new FunctionsFetchError(new TypeError("Network request failed"));

// Clients made by renderHome; cleared after each test so no 30-minute gc timer keeps Jest alive.
const clients: ReturnType<typeof createQueryClient>[] = [];

// Renders Home under a fresh query client whose retry waits no time.
async function renderHome() {
  const client = createQueryClient();
  clients.push(client);
  client.setDefaultOptions({ queries: { ...client.getDefaultOptions().queries, retryDelay: 0 } });
  return render(
    <QueryClientProvider client={client}>
      <Home />
    </QueryClientProvider>,
  );
}

let consoleError: jest.SpyInstance;
let announce: jest.SpyInstance;
beforeEach(() => {
  announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});
  mockInvoke.mockReset();
  mockCapture.mockReset();
  consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(async () => {
  // Lets the query cache and FlashList finish their timer-driven updates inside act before the console check.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  clients.splice(0).forEach((client) => client.clear());
  expect(consoleError).not.toHaveBeenCalled();
  consoleError.mockRestore();
  announce.mockRestore();
});

describe("Home: filled", () => {
  it("shows the header, Roulette card, section title and one labelled tile per movie", async () => {
    mockInvoke.mockResolvedValue({ data: PAGE, error: null });
    await renderHome();

    expect(await screen.findByRole("image", { name: "Dune, 2021" })).toBeTruthy();
    expect(screen.getByRole("image", { name: "Nosferatu, 1922" })).toBeTruthy();
    expect(screen.getByRole("image", { name: "Untitled Year Unknown" })).toBeTruthy();
    expect(screen.getByText("🦉 perchable")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open My Profile" })).toBeTruthy();
    expect(screen.getByText("Perch Roulette")).toBeTruthy();
    expect(screen.getByText("Can't decide tonight?")).toBeTruthy();
    expect(screen.getByRole("header", { name: "Popular right now" })).toBeTruthy();
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it("shows the fallback icon and title for a movie with no poster", async () => {
    mockInvoke.mockResolvedValue({ data: PAGE, error: null });
    await renderHome();
    await screen.findByRole("image", { name: "Dune, 2021" });
    expect(screen.getByText("🎬")).toBeTruthy();
    expect(screen.getByText("Nosferatu")).toBeTruthy();
  });

  it("is not tappable: no poster is a button", async () => {
    mockInvoke.mockResolvedValue({ data: PAGE, error: null });
    await renderHome();
    await screen.findByRole("image", { name: "Dune, 2021" });
    expect(screen.queryByRole("button", { name: /Dune/ })).toBeNull();
  });
});

describe("Home: loading", () => {
  it("shows the shell and the title, announces 'Loading movies' once, and has no poster labels", async () => {
    mockInvoke.mockReturnValue(new Promise(() => {}));
    await renderHome();

    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith("Loading movies");
    expect(screen.getByRole("header", { name: "Popular right now" })).toBeTruthy();
    expect(screen.getByText("Perch Roulette")).toBeTruthy();
    expect(screen.queryByRole("image")).toBeNull();
  });
});

describe("Home: empty", () => {
  it("shows the empty state with Retry and hides the section title", async () => {
    mockInvoke.mockResolvedValue({ data: { results: [], page: 1, total_pages: 1 }, error: null });
    await renderHome();

    expect(await screen.findByText("No movies to show")).toBeTruthy();
    expect(screen.getByText("We couldn't find any movies right now. Try again in a moment.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
    expect(screen.queryByText("Popular right now")).toBeNull();
    expect(screen.getByText("Perch Roulette")).toBeTruthy();
  });
});

describe("Home: error", () => {
  it("shows the error state; Retry reloads page 1 and loads the grid", async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: httpError(400) });
    mockInvoke.mockResolvedValue({ data: PAGE, error: null });
    await renderHome();

    expect(await screen.findByText("Couldn't load movies")).toBeTruthy();
    expect(screen.getByText("Check your connection and try again.")).toBeTruthy();
    expect(screen.queryByText("Popular right now")).toBeNull();
    // A 4xx is not retried.
    expect(mockInvoke).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("image", { name: "Dune, 2021" })).toBeTruthy();
    expect(mockInvoke).toHaveBeenCalledTimes(2);
    expect(mockInvoke.mock.calls[1][0]).toBe("tmdb?endpoint=popular&page=1");
  });

  it("a double tap on Retry sends one request", async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: httpError(400) });
    mockInvoke.mockReturnValue(new Promise(() => {}));
    await renderHome();

    const retry = await screen.findByRole("button", { name: "Retry" });
    await fireEvent.press(retry);
    await fireEvent.press(retry);
    expect(mockInvoke).toHaveBeenCalledTimes(2);
  });

  it("offline cold start: loading, then the error state (after the one retry), then Retry loads the grid", async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: offline() });
    mockInvoke.mockResolvedValueOnce({ data: null, error: offline() });
    mockInvoke.mockResolvedValue({ data: PAGE, error: null });
    await renderHome();

    expect(announce).toHaveBeenCalledWith("Loading movies");
    expect(await screen.findByText("Couldn't load movies")).toBeTruthy();
    expect(mockInvoke).toHaveBeenCalledTimes(2);
    // Offline is not reported.
    expect(mockCapture).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("image", { name: "Dune, 2021" })).toBeTruthy();
  });

  it("a wrong-shaped response ends in the error state and is reported once", async () => {
    mockInvoke.mockResolvedValue({ data: { results: [{ nope: 1 }], page: 1, total_pages: 1 }, error: null });
    await renderHome();

    expect(await screen.findByText("Couldn't load movies")).toBeTruthy();
    expect(mockCapture).toHaveBeenCalledTimes(1);
  });

  it("Retry is at least 48 dp tall", async () => {
    mockInvoke.mockResolvedValue({ data: { results: [], page: 1, total_pages: 1 }, error: null });
    await renderHome();
    const retry = await screen.findByRole("button", { name: "Retry" });
    expect(StyleSheet.flatten(retry.props.style).minHeight).toBeGreaterThanOrEqual(48);
  });
});

describe("Home: Roulette", () => {
  it("is a full-strength button whose tap shows the coming-soon toast and changes nothing else", async () => {
    mockInvoke.mockResolvedValue({ data: PAGE, error: null });
    await renderHome();
    await screen.findByRole("image", { name: "Dune, 2021" });

    const button = screen.getByRole("button", { name: "Surprise me" });
    expect(button.props.accessibilityHint).toBe("Smart picks are coming soon");
    expect(button.props.accessibilityState).toMatchObject({ disabled: false });
    expect(screen.queryByText("Smart picks are coming soon.")).toBeNull();

    await fireEvent.press(button);
    expect(screen.getByText("Smart picks are coming soon.")).toBeTruthy();
    expect(screen.getByRole("image", { name: "Dune, 2021" })).toBeTruthy();
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });
});

describe("Home: sign-out while loading", () => {
  it("aborts the request on unmount and a late 401 reports nothing and logs nothing", async () => {
    let options: { signal?: AbortSignal } = {};
    let finish: (value: unknown) => void = () => {};
    mockInvoke.mockImplementation((_name: string, opts: { signal?: AbortSignal }) => {
      options = opts;
      return new Promise((resolve) => {
        finish = resolve;
      });
    });
    const view = await renderHome();
    expect(options.signal?.aborted).toBe(false);

    await view.unmount();
    expect(options.signal?.aborted).toBe(true);

    await act(async () => finish({ data: null, error: httpError(401) }));
    expect(mockCapture).not.toHaveBeenCalled();
  });
});
