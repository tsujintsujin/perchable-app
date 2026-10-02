import { act as reactAct } from "react";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { QueryClientProvider, notifyManager } from "@tanstack/react-query";
import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ReactNode } from "react";

const mockInvoke = jest.fn();
jest.mock("@/lib/supabase", () => ({ supabase: { auth: { getSession: () => Promise.resolve({}) }, functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } } }));
const mockCapture = jest.fn();
jest.mock("@/lib/sentry", () => ({ Sentry: { captureException: (...args: unknown[]) => mockCapture(...args) } }));

import { createQueryClient } from "@/lib/queryClient";
import { MAX_PAGES_PER_LOAD } from "@/modules/movies/api/getPopularMovies";
import { DECK_KEY, FINDING_AFTER_PAGES, REQUEST_MORE_AT, useQuickAddDeck } from "@/modules/quick-add/hooks/useQuickAddDeck";
import { DECK_MAX_PAGES_PER_LOAD } from "@/modules/quick-add/readDeckPage";
import { clearQuickAddData, getSessionAdds, loadSkips, saveSkips, setSessionAdds } from "@/modules/quick-add/skipMemory";

type Reply = { data: unknown; error: unknown };
const movie = (id: number) => ({ id, title: `Movie ${id}`, poster_path: null, vote_average: 7, release_date: "2021-01-01" });
const page = (n: number, ids: number[], total = 99) => ({ results: ids.map(movie), page: n, total_pages: total });
const ok = (data: unknown): Reply => ({ data, error: null });
const httpError = (status: number, code?: string): Reply => ({
  data: null,
  error: new FunctionsHttpError({ status, json: async () => (code ? { error: "x", code } : { error: "x" }) }),
});
const offline = (): Reply => ({ data: null, error: new FunctionsFetchError(new TypeError("Network request failed")) });

// Ids 10n+1..10n+3 for page n, so pages never share an id unless a test wants them to.
const idsFor = (n: number) => [n * 10 + 1, n * 10 + 2, n * 10 + 3];
// Pages the stub has been asked for, in order; replies per page (a function reply runs on each request).
let requested: number[] = [];
let replies: Record<number, Reply | (() => Reply | Promise<Reply>)> = {};
const pageOf = (url: string) => Number(/page=(\d+)/.exec(url)?.[1]);

const clients: ReturnType<typeof createQueryClient>[] = [];
let consoleError: jest.SpyInstance;
let consoleWarn: jest.SpyInstance;

// React Query delivers results on a timer; running its notifications in React's synchronous act keeps every update inside act.
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

beforeEach(async () => {
  requested = [];
  replies = {};
  mockCapture.mockReset();
  mockInvoke.mockReset();
  mockInvoke.mockImplementation(async (url: string) => {
    const n = pageOf(url);
    requested.push(n);
    const reply = replies[n] ?? ok(page(n, idsFor(n)));
    return typeof reply === "function" ? reply() : reply;
  });
  await AsyncStorage.clear();
  for (const id of ["u1", "u2"]) await clearQuickAddData(id);
  consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  consoleWarn = jest.spyOn(console, "warn").mockImplementation(() => {});
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
});

// Renders the hook for a user under a fresh client (shared with a second hook when `client` is given).
function setup(userId = "u1", client = createQueryClient()) {
  clients.push(client);
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return renderHook(() => useQuickAddDeck(userId), { wrapper });
}
type View = Awaited<ReturnType<typeof setup>>;

// Renders and waits for the first cards.
async function setupFilled(userId = "u1") {
  const view = await setup(userId);
  await waitFor(() => expect(view.result.current.state).toBe("filled"));
  return view;
}

const ids = (view: View) => view.result.current.cards.map((card) => card.id);

// A promise settled by hand, to hold a request in flight.
function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("deck data (A4)", () => {
  // One page only, so a swipe never triggers a next-page request that adds cards to the expectations.
  beforeEach(() => {
    replies[1] = ok(page(1, idsFor(1), 1));
  });

  it("uses its own limit, separate from Home's 3, and its own query key", () => {
    expect(DECK_MAX_PAGES_PER_LOAD).toBe(15);
    expect(MAX_PAGES_PER_LOAD).toBe(3);
    expect(DECK_KEY).toEqual(["movies", "deck", "popular"]);
  });

  it("shows the loading state until the first page, then the cards in page order", async () => {
    const view = await setup();
    expect(view.result.current.state).toBe("loading");
    await waitFor(() => expect(view.result.current.state).toBe("filled"));
    expect(ids(view)).toEqual([11, 12, 13]);
  });

  it("shows a movie that is on two pages once", async () => {
    replies[1] = ok(page(1, [1, 2, 3]));
    replies[2] = ok(page(2, [3, 4, 5]));
    const view = await setupFilled();
    await act(async () => view.result.current.keepLooking());
    await waitFor(() => expect(ids(view)).toEqual([1, 2, 3, 4, 5]));
  });

  it("leaves out saved skips and this session's right swipes, and the top card is the first usable one", async () => {
    await saveSkips("u1", [11]);
    setSessionAdds("u1", [12]);
    const view = await setupFilled();
    expect(ids(view)).toEqual([13]);
  });

  it("never applies another user's skips", async () => {
    await saveSkips("u2", [11, 12, 13]);
    const view = await setupFilled("u1");
    expect(ids(view)).toEqual([11, 12, 13]);
  });

  it("a left swipe removes the card, saves it on this device, and keeps the others in order", async () => {
    const view = await setupFilled();
    await act(async () => view.result.current.swipe(view.result.current.cards[0], "left"));
    expect(ids(view)).toEqual([12, 13]);
    expect(await loadSkips("u1")).toEqual([11]);
  });

  it("a right swipe removes the card for this session only: nothing is stored on the device", async () => {
    const view = await setupFilled();
    await act(async () => view.result.current.swipe(view.result.current.cards[0], "right"));
    expect(ids(view)).toEqual([12, 13]);
    expect(getSessionAdds("u1")).toEqual([11]);
    expect(await loadSkips("u1")).toEqual([]);
    expect(await AsyncStorage.getItem("quickAdd:skips:u1")).toBeNull();
  });

  it("Undo puts the card back in its original place, and for a skip removes it from the saved skips", async () => {
    const view = await setupFilled();
    expect(view.result.current.canUndo).toBe(false);
    await act(async () => view.result.current.swipe(view.result.current.cards[0], "left"));
    expect(view.result.current.canUndo).toBe(true);
    await act(async () => view.result.current.undo());
    expect(ids(view)).toEqual([11, 12, 13]);
    expect(await loadSkips("u1")).toEqual([]);
    expect(view.result.current.returned).toMatchObject({ action: "skip", held: false });
    expect(view.result.current.returned?.movie.id).toBe(11);
  });

  it("Undo is one step: disabled after one Undo until the next swipe, and a no-op with an empty history", async () => {
    const view = await setupFilled();
    await act(async () => view.result.current.undo());
    expect(view.result.current.returned).toBeNull();
    await act(async () => view.result.current.swipe(view.result.current.cards[0], "right"));
    await act(async () => view.result.current.undo());
    expect(view.result.current.canUndo).toBe(false);
    expect(ids(view)).toEqual([11, 12, 13]);
    expect(view.result.current.returned?.action).toBe("add");
    await act(async () => view.result.current.undo());
    expect(view.result.current.returned?.seq).toBe(1);
  });

  it("holds a returned card while a drag is active and brings it back when the drag ends", async () => {
    const view = await setupFilled();
    await act(async () => view.result.current.swipe(view.result.current.cards[0], "left"));
    await act(async () => view.result.current.setDragging(true));
    await act(async () => view.result.current.undo());
    expect(ids(view)).toEqual([12, 13]);
    expect(view.result.current.canUndo).toBe(false);
    expect(view.result.current.returned).toBeNull();
    await act(async () => view.result.current.setDragging(false));
    expect(ids(view)).toEqual([11, 12, 13]);
    expect(view.result.current.returned).toMatchObject({ held: true, action: "skip" });
  });

  it("two rapid swipes before a re-render both count and are both saved", async () => {
    const view = await setupFilled();
    const [first, second] = view.result.current.cards;
    await act(async () => {
      view.result.current.swipe(first, "left");
      view.result.current.swipe(second, "left");
    });
    expect(await loadSkips("u1")).toEqual([11, 12]);
    expect(ids(view)).toEqual([13]);
  });

  it("a corrupt or failing store never breaks the deck", async () => {
    await AsyncStorage.setItem("quickAdd:skips:u1", "{not json");
    const view = await setupFilled();
    expect(ids(view)).toEqual([11, 12, 13]);
    const setItem = jest.spyOn(AsyncStorage, "setItem").mockRejectedValue(new Error("full"));
    await act(async () => view.result.current.swipe(view.result.current.cards[0], "left"));
    expect(ids(view)).toEqual([12, 13]);
    setItem.mockRestore();
  });

  it("a failed storage read still opens the deck", async () => {
    const getItem = jest.spyOn(AsyncStorage, "getItem").mockRejectedValue(new Error("disk"));
    const view = await setupFilled();
    expect(ids(view)).toEqual([11, 12, 13]);
    getItem.mockRestore();
  });
});

describe("paging from the swipe handler", () => {
  // Pages of 8 so a first load holds more than REQUEST_MORE_AT cards.
  const bigPages = () => {
    for (const n of [1, 2, 3]) replies[n] = ok(page(n, Array.from({ length: 8 }, (_, i) => n * 100 + i), 3));
  };

  it("asks for the next page only once REQUEST_MORE_AT or fewer cards remain", async () => {
    bigPages();
    const view = await setupFilled();
    expect(ids(view)).toHaveLength(8);
    // 8 cards: swiping three leaves 5.
    for (let i = 0; i < 3; i++) await act(async () => view.result.current.swipe(view.result.current.cards[0], "left"));
    await waitFor(() => expect(requested).toEqual([1, 2]));
    expect(REQUEST_MORE_AT).toBe(5);
  });

  it("does not ask while more than five usable cards remain", async () => {
    bigPages();
    const view = await setupFilled();
    await act(async () => view.result.current.swipe(view.result.current.cards[0], "left"));
    await act(async () => view.result.current.swipe(view.result.current.cards[0], "left"));
    expect(requested).toEqual([1]);
  });

  it("ten rapid swipes make one page request", async () => {
    bigPages();
    const gate = deferred<Reply>();
    replies[2] = () => gate.promise;
    const view = await setupFilled();
    await act(async () => {
      for (const card of view.result.current.cards.slice(0, 8)) view.result.current.swipe(card, "left");
    });
    await waitFor(() => expect(requested).toEqual([1, 2]));
    expect(requested.filter((n) => n === 2)).toHaveLength(1);
    await act(async () => gate.resolve(ok(page(2, [201, 202], 3))));
    await waitFor(() => expect(ids(view)).toEqual([201, 202]));
  });

  it("asks for nothing past the last page", async () => {
    replies[1] = ok(page(1, [1, 2, 3], 1));
    const view = await setupFilled();
    await act(async () => view.result.current.swipe(view.result.current.cards[0], "left"));
    expect(requested).toEqual([1]);
  });

  it("a failed next page keeps the cards, shows nothing, and is not retried by further swipes", async () => {
    replies[2] = offline();
    const view = await setupFilled();
    await act(async () => view.result.current.swipe(view.result.current.cards[0], "left"));
    await waitFor(() => expect(requested).toEqual([1, 2]));
    await waitFor(() => expect(view.result.current.state).toBe("filled"));
    expect(ids(view)).toEqual([12, 13]);
    await act(async () => view.result.current.swipe(view.result.current.cards[0], "left"));
    expect(requested).toEqual([1, 2]);
  });

  it("when none are left after a failed next page the state is nextFailed, and Retry loads it", async () => {
    replies[2] = offline();
    const view = await setupFilled();
    await act(async () => {
      for (const card of view.result.current.cards) view.result.current.swipe(card, "left");
    });
    await waitFor(() => expect(view.result.current.state).toBe("nextFailed"));
    replies[2] = ok(page(2, [21, 22], 9));
    await act(async () => view.result.current.retry());
    await waitFor(() => expect(view.result.current.state).toBe("filled"));
    expect(ids(view)).toEqual([21, 22]);
  });
});

describe("the page loop", () => {
  it("reads past 12 all-excluded pages on first load and returns a usable card, with no Retry", async () => {
    const skipped: number[] = [];
    for (let n = 1; n <= 12; n++) skipped.push(...idsFor(n));
    await saveSkips("u1", skipped);
    const view = await setupFilled();
    expect(requested).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    expect(ids(view)).toEqual(idsFor(13));
  });

  it("says what it is doing after three all-seen pages, and stops saying it when the load ends", async () => {
    const skipped: number[] = [];
    for (let n = 1; n <= 3; n++) skipped.push(...idsFor(n));
    await saveSkips("u1", skipped);
    const gate = deferred<Reply>();
    replies[4] = () => gate.promise;
    const view = await setup();
    expect(FINDING_AFTER_PAGES).toBe(3);
    await waitFor(() => expect(view.result.current.finding).toBe(true));
    expect(view.result.current.state).toBe("loading");
    await act(async () => gate.resolve(ok(page(4, idsFor(4)))));
    await waitFor(() => expect(view.result.current.state).toBe("filled"));
    expect(view.result.current.finding).toBe(false);
  });

  it("does not say it for a load that needed fewer than three pages", async () => {
    await saveSkips("u1", idsFor(1));
    const view = await setupFilled();
    expect(view.result.current.finding).toBe(false);
  });

  it("15 all-excluded pages with more to come end in keepGoing, and Keep looking reads on from page 16", async () => {
    const skipped: number[] = [];
    for (let n = 1; n <= 15; n++) skipped.push(...idsFor(n));
    await saveSkips("u1", skipped);
    const view = await setup();
    await waitFor(() => expect(view.result.current.state).toBe("keepGoing"));
    expect(requested).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
    expect(ids(view)).toEqual([]);
    await act(async () => view.result.current.keepLooking());
    await waitFor(() => expect(view.result.current.state).toBe("filled"));
    expect(requested.slice(15)).toEqual([16]);
    expect(ids(view)).toEqual(idsFor(16));
  });

  it("does not retry by itself: one failed request is one request, and the first load ends in error", async () => {
    replies[1] = httpError(503, "upstream_error");
    const view = await setup();
    await waitFor(() => expect(view.result.current.state).toBe("error"));
    expect(requested).toEqual([1]);
  });

  it("Retry resumes after the pages the loop already passed instead of starting at page 1", async () => {
    await saveSkips("u1", [...idsFor(1), ...idsFor(2)]);
    let attempt = 0;
    replies[3] = () => (++attempt === 1 ? offline() : ok(page(3, idsFor(3))));
    const view = await setup();
    await waitFor(() => expect(view.result.current.state).toBe("error"));
    expect(requested).toEqual([1, 2, 3]);
    await act(async () => view.result.current.retry());
    await waitFor(() => expect(view.result.current.state).toBe("filled"));
    expect(requested).toEqual([1, 2, 3, 3]);
  });

  it("a double tap on Retry sends one request", async () => {
    replies[1] = offline();
    const view = await setup();
    await waitFor(() => expect(view.result.current.state).toBe("error"));
    const gate = deferred<Reply>();
    replies[1] = () => gate.promise;
    await act(async () => {
      view.result.current.retry();
      view.result.current.retry();
    });
    expect(requested).toEqual([1, 1]);
    await act(async () => gate.resolve(ok(page(1, [1, 2]))));
    await waitFor(() => expect(view.result.current.state).toBe("filled"));
  });

  it("an empty first page with no more pages is caught up, with no Retry state", async () => {
    replies[1] = ok(page(1, [], 1));
    const view = await setup();
    await waitFor(() => expect(view.result.current.state).toBe("caughtUp"));
  });

  it("caught up appears only when there is no next page, and Undo still works from it", async () => {
    replies[1] = ok(page(1, [1, 2], 1));
    const view = await setupFilled();
    await act(async () => {
      for (const card of view.result.current.cards) view.result.current.swipe(card, "left");
    });
    expect(view.result.current.state).toBe("caughtUp");
    expect(view.result.current.canUndo).toBe(true);
    await act(async () => view.result.current.undo());
    expect(view.result.current.state).toBe("filled");
  });

  it("Start over clears the saved skips and reloads from page 1", async () => {
    replies[1] = ok(page(1, [1, 2], 1));
    const view = await setupFilled();
    await act(async () => {
      for (const card of view.result.current.cards) view.result.current.swipe(card, "left");
    });
    expect(view.result.current.state).toBe("caughtUp");
    await act(async () => view.result.current.startOver());
    await waitFor(() => expect(view.result.current.state).toBe("filled"));
    expect(ids(view)).toEqual([1, 2]);
    expect(requested).toEqual([1, 1]);
    expect(await loadSkips("u1")).toEqual([]);
    expect(view.result.current.canUndo).toBe(false);
  });
});

describe("errors and Sentry (M9)", () => {
  it("reports a wrong-shaped body once", async () => {
    replies[1] = ok({ nope: true });
    const view = await setup();
    await waitFor(() => expect(view.result.current.state).toBe("error"));
    expect(mockCapture).toHaveBeenCalledTimes(1);
  });

  it("reports a misconfigured proxy once", async () => {
    replies[1] = httpError(500, "misconfigured");
    const view = await setup();
    await waitFor(() => expect(view.result.current.state).toBe("error"));
    expect(mockCapture).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["offline", offline],
    ["429", () => httpError(429)],
    ["404", () => httpError(404)],
    ["502 upstream_network", () => httpError(502, "upstream_network")],
  ])("does not report %s", async (_name, make) => {
    replies[1] = make();
    const view = await setup();
    await waitFor(() => expect(view.result.current.state).toBe("error"));
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it("sign-out while loading: unmounting aborts quietly with no error, no Sentry and no state update", async () => {
    const gate = deferred<Reply>();
    replies[1] = () => gate.promise;
    const view = await setup();
    await waitFor(() => expect(requested).toEqual([1]));
    await view.unmount();
    await act(async () => gate.resolve(ok(page(1, [1, 2]))));
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it("does not reload on reconnect or focus, so loaded pages keep their order", async () => {
    const client = createQueryClient();
    const view = await setup("u1", client);
    await waitFor(() => expect(view.result.current.state).toBe("filled"));
    expect(client.getQueryDefaults(DECK_KEY)).toMatchObject({ refetchOnReconnect: false, refetchOnWindowFocus: false, retry: 0 });
  });
});
