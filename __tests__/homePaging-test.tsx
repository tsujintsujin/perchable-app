import { AccessibilityInfo, StyleSheet } from "react-native";
import { act as rawAct, fireEvent, render, screen } from "@testing-library/react-native";
import { QueryClientProvider } from "@tanstack/react-query";
import { FunctionsHttpError } from "@supabase/supabase-js";

// No <SafeAreaProvider> in the test tree — fixed insets stand in for it.
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock("@/modules/profile", () => ({
  useOwnProfile: () => ({ state: "loaded", refetch: jest.fn(), profile: { id: "u1", displayName: "Justin", avatarUrl: null } }),
}));

const mockInvoke = jest.fn();
jest.mock("@/lib/supabase", () => ({ supabase: { auth: { getSession: () => Promise.resolve({}) }, functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } } }));
jest.mock("@/lib/sentry", () => ({ Sentry: { captureException: jest.fn() } }));

import Home from "@/app/(tabs)/index";
import { createQueryClient } from "@/lib/queryClient";

// act() that also waits one timer tick: the query cache notifies observers from a timer, which must land inside act.
const act = (fn: () => void | Promise<void>) =>
  rawAct(async () => {
    await fn();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

const movie = (id: number) => ({ id, title: `Movie ${id}`, poster_path: null, vote_average: 7, release_date: "2021-01-01" });
const page = (n: number, total: number) => ({ results: [movie(n * 10 + 1), movie(n * 10 + 2)], page: n, total_pages: total });
const pageOf = (url: string) => Number(/page=(\d+)/.exec(url)?.[1]);
// Answers every popular request with the page it asks for (3 pages in all, 2 movies each).
const servePages = () =>
  mockInvoke.mockImplementation(async (url: string) => ({ data: page(pageOf(url), 3), error: null }));
const httpError = (status: number) => new FunctionsHttpError({ status, json: async () => ({ error: "x" }) });

const clients: ReturnType<typeof createQueryClient>[] = [];
let consoleError: jest.SpyInstance;
let consoleWarn: jest.SpyInstance;
let announce: jest.SpyInstance;

beforeEach(() => {
  announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});
  mockInvoke.mockReset();
  consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  consoleWarn = jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(async () => {
  await rawAct(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  clients.splice(0).forEach((client) => client.clear());
  expect(consoleError).not.toHaveBeenCalled();
  expect(consoleWarn).not.toHaveBeenCalled();
  consoleError.mockRestore();
  consoleWarn.mockRestore();
  announce.mockRestore();
});

// Renders Home under the given (or a fresh) client whose retry waits no time.
async function renderHome(client = createQueryClient()) {
  clients.push(client);
  client.setDefaultOptions({ queries: { ...client.getDefaultOptions().queries, retryDelay: 0 } });
  const view = await render(
    <QueryClientProvider client={client}>
      <Home />
    </QueryClientProvider>,
  );
  return { view, client };
}

// The props of the list's refresh control (the scroll view receives the element as a prop).
const refreshControl = () => screen.getByTestId("popular-list").props.refreshControl.props;

// Fires the list's end-reached callback, as a scroll to the bottom would.
const reachEnd = () => act(() => fireEvent(screen.getByTestId("popular-list"), "endReached"));

describe("Home footer states (DESIGN Build 12b)", () => {
  it("shows 'Loading more…' with a spinner row while page 2 loads, and keeps the posters", async () => {
    mockInvoke.mockImplementation(async (url: string) =>
      pageOf(url) === 1 ? { data: page(1, 3), error: null } : new Promise(() => {}),
    );
    await renderHome();
    await screen.findByRole("button", { name: "Movie 11, 2021" });

    await reachEnd();
    expect(screen.getByText("Loading more…")).toBeTruthy();
    expect(announce).toHaveBeenCalledWith("Loading more movies");
    expect(screen.getByRole("button", { name: "Movie 11, 2021" })).toBeTruthy();
  });

  it("shows 'You've reached the end.' after the last page and makes no further request", async () => {
    mockInvoke.mockResolvedValue({ data: page(1, 1), error: null });
    await renderHome();
    expect(await screen.findByText("You've reached the end.")).toBeTruthy();
    await reachEnd();
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it("shows the inline error with a 48 dp Retry; Retry requests only that page and the posters stay", async () => {
    mockInvoke.mockImplementation(async (url: string) =>
      pageOf(url) === 1 ? { data: page(1, 3), error: null } : { data: null, error: httpError(400) },
    );
    await renderHome();
    await screen.findByRole("button", { name: "Movie 11, 2021" });
    await reachEnd();

    expect(await screen.findByText("⚠ Couldn't load more movies.")).toBeTruthy();
    expect(screen.queryByText("Couldn't load movies")).toBeNull();
    expect(screen.getByRole("button", { name: "Movie 11, 2021" })).toBeTruthy();
    const retry = screen.getByRole("button", { name: "Retry loading more movies" });
    expect(StyleSheet.flatten(retry.props.style).height).toBeGreaterThanOrEqual(48);

    mockInvoke.mockClear();
    servePages();
    await act(() => fireEvent.press(retry));
    // Only page 2 (and whatever the short list then asks for after it) is requested; page 1 is never refetched.
    expect(mockInvoke.mock.calls[0][0]).toContain("page=2");
    expect(mockInvoke.mock.calls.some(([url]) => pageOf(url) === 1)).toBe(false);
    expect(await screen.findByRole("button", { name: "Movie 21, 2021" })).toBeTruthy();
  });
});

describe("Home pull-to-refresh (DESIGN Build 12b)", () => {
  it("tints the refresh control from tokens", async () => {
    servePages();
    await renderHome();
    // The short test list pages itself to the end; wait for that so no load lands after the test body.
    await screen.findByText("You've reached the end.");
    const control = refreshControl();
    expect(control.colors).toEqual(["#B8860B"]);
    expect(control.progressBackgroundColor).toBeTruthy();
  });

  it("a failed refresh keeps the posters and shows the error Toast, never the error screen", async () => {
    servePages();
    await renderHome();
    // The short test list pages itself to the end; wait for that so no load lands after the test body.
    await screen.findByText("You've reached the end.");

    mockInvoke.mockResolvedValue({ data: null, error: httpError(400) });
    await act(() => refreshControl().onRefresh());

    expect(await screen.findByText("Couldn't refresh. Check your connection.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Movie 11, 2021" })).toBeTruthy();
    expect(screen.queryByText("Couldn't load movies")).toBeNull();
  });
});

describe("Home remount (C6)", () => {
  it("returning to Home shows the same list with no new request", async () => {
    servePages();
    const { view, client } = await renderHome();
    // The short test list pages itself to the end; wait for that, then count.
    await screen.findByText("You've reached the end.");
    const before = mockInvoke.mock.calls.length;
    await view.unmount();

    await renderHome(client);
    expect(await screen.findByRole("button", { name: "Movie 11, 2021" })).toBeTruthy();
    expect(mockInvoke).toHaveBeenCalledTimes(before);
  });
});
