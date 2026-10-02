import { useEffect } from "react";
import { act as rawAct, renderHook, waitFor } from "@testing-library/react-native";
import { QueryClientProvider } from "@tanstack/react-query";
import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";
import type { ReactNode } from "react";

const mockInvoke = jest.fn();
jest.mock("@/lib/supabase", () => ({ supabase: { auth: { getSession: () => Promise.resolve({}) }, functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } } }));
const mockCapture = jest.fn();
jest.mock("@/lib/sentry", () => ({ Sentry: { captureException: (...args: unknown[]) => mockCapture(...args) } }));

import { createQueryClient } from "@/lib/queryClient";
import { hasMorePages } from "@/modules/movies/api/getPopularMovies";
import { usePopularMovies } from "@/modules/movies/hooks/usePopularMovies";

// act() that also waits one timer tick: the query cache notifies observers from a timer, which must land inside act.
const act = (fn: () => void | Promise<void>) =>
  rawAct(async () => {
    await fn();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

type Reply = { data: unknown; error: unknown };

const movie = (id: number) => ({ id, title: `Movie ${id}`, poster_path: null, vote_average: 7, release_date: "2021-01-01" });
// A popular page whose movies are the given ids.
const page = (n: number, ids: number[], total = 9) => ({ results: ids.map(movie), page: n, total_pages: total });
const ok = (data: unknown): Reply => ({ data, error: null });
const httpError = (status: number, code?: string): Reply => ({
  data: null,
  error: new FunctionsHttpError({ status, json: async () => (code ? { error: "x", code } : { error: "x" }) }),
});
const offline = (): Reply => ({ data: null, error: new FunctionsFetchError(new TypeError("Network request failed")) });

// Ids 10n+1..10n+3 for page n, so pages never share an id unless a test wants them to.
const idsFor = (n: number) => [n * 10 + 1, n * 10 + 2, n * 10 + 3];

// Pages the stub has been asked for, in order.
let requested: number[] = [];
// Replies per page number; a function reply is called each time (so it can differ per attempt).
let replies: Record<number, Reply | (() => Reply | Promise<Reply>)> = {};
const pageOf = (url: string) => Number(/page=(\d+)/.exec(url)?.[1]);

const clients: ReturnType<typeof createQueryClient>[] = [];
let consoleError: jest.SpyInstance;
let consoleWarn: jest.SpyInstance;

beforeEach(() => {
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
  consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  consoleWarn = jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  clients.splice(0).forEach((client) => client.clear());
  expect(consoleError).not.toHaveBeenCalled();
  expect(consoleWarn).not.toHaveBeenCalled();
  consoleError.mockRestore();
  consoleWarn.mockRestore();
});

// Renders the hook under a fresh client whose retry waits no time.
// With `endReachedOnDataChange`, the hook is driven like FlashList: end-reached fires once each time the list data changes.
async function setup(onRefreshError?: () => void, endReachedOnDataChange = false) {
  const client = createQueryClient();
  clients.push(client);
  client.setDefaultOptions({ queries: { ...client.getDefaultOptions().queries, retryDelay: 0 } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return await renderHook(
    () => {
      const popular = usePopularMovies({ onRefreshError });
      // Once per new `movies` array, like FlashList's one-shot end-reached report.
      useEffect(() => {
        if (endReachedOnDataChange) popular.loadMore();
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [popular.movies]);
      return popular;
    },
    { wrapper },
  );
}

// Renders and waits for page 1.
async function setupLoaded(onRefreshError?: () => void) {
  const view = await setup(onRefreshError);
  await waitFor(() => expect(view.result.current.state).toBe("filled"));
  return view;
}

// Calls loadMore and waits until `count` movies are loaded.
async function loadMoreUntil(view: Awaited<ReturnType<typeof setupLoaded>>, count: number) {
  await act(async () => view.result.current.loadMore());
  await waitFor(() => expect(view.result.current.movies).toHaveLength(count));
}

// A promise settled by hand, to hold a request in flight.
function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("paging (C1, C3)", () => {
  it("loads page 2 below page 1 and shows the end footer after the last page", async () => {
    replies[1] = ok(page(1, idsFor(1), 2));
    replies[2] = ok(page(2, idsFor(2), 2));
    const view = await setupLoaded();
    expect(view.result.current.footer).toBe("none");

    await loadMoreUntil(view, 6);
    expect(view.result.current.movies.map((m) => m.id)).toEqual([...idsFor(1), ...idsFor(2)]);
    await waitFor(() => expect(view.result.current.footer).toBe("end"));

    await act(async () => view.result.current.loadMore());
    expect(requested).toEqual([1, 2]);
  });

  it("stops at min(total_pages, 500)", () => {
    expect(hasMorePages({ ...page(499, [1], 900), attribution: "" })).toBe(true);
    expect(hasMorePages({ ...page(500, [1], 900), attribution: "" })).toBe(false);
    expect(hasMorePages({ ...page(3, [1], 3), attribution: "" })).toBe(false);
  });

  it("makes one request when loadMore fires repeatedly while a page loads", async () => {
    const page2 = deferred<Reply>();
    replies[2] = () => page2.promise;
    const view = await setupLoaded();

    await act(async () => {
      view.result.current.loadMore();
      view.result.current.loadMore();
      view.result.current.loadMore();
    });
    expect(view.result.current.footer).toBe("loading");
    await act(async () => view.result.current.loadMore());
    expect(requested).toEqual([1, 2]);

    await act(async () => page2.resolve(ok(page(2, idsFor(2)))));
    await waitFor(() => expect(view.result.current.movies).toHaveLength(6));
  });
});

describe("de-duplication (C2)", () => {
  it("renders a movie id that appears on two pages once", async () => {
    replies[2] = ok(page(2, [13, 21, 22]));
    const view = await setupLoaded();
    await loadMoreUntil(view, 5);
    expect(view.result.current.movies.map((m) => m.id)).toEqual([11, 12, 13, 21, 22]);
  });
});

describe("next page failure (C4)", () => {
  it("keeps the posters, shows the error footer, does not retry on its own, and Retry loads only that page", async () => {
    replies[2] = httpError(400);
    const view = await setupLoaded();

    await act(async () => view.result.current.loadMore());
    await waitFor(() => expect(view.result.current.footer).toBe("error"));
    expect(view.result.current.state).toBe("filled");
    expect(view.result.current.movies).toHaveLength(3);

    await act(async () => view.result.current.loadMore());
    expect(requested).toEqual([1, 2]);

    replies[2] = ok(page(2, idsFor(2)));
    await act(async () => view.result.current.retryMore());
    await waitFor(() => expect(view.result.current.movies).toHaveLength(6));
    expect(requested).toEqual([1, 2, 2]);
    expect(view.result.current.footer).toBe("none");
  });

  it("page 2 failing then page 3 failing keeps the first page and the error footer", async () => {
    replies[2] = httpError(400);
    const view = await setupLoaded();
    await act(async () => view.result.current.loadMore());
    await waitFor(() => expect(view.result.current.footer).toBe("error"));
    replies[2] = ok(page(2, idsFor(2)));
    replies[3] = httpError(400);
    await act(async () => view.result.current.retryMore());
    await waitFor(() => expect(view.result.current.movies).toHaveLength(6));
    await act(async () => view.result.current.loadMore());
    await waitFor(() => expect(view.result.current.footer).toBe("error"));
    expect(view.result.current.movies).toHaveLength(6);
  });

  it("never reports offline or a timeout to Sentry, and reports a failed page once", async () => {
    replies[2] = () => offline();
    const view = await setupLoaded();
    await act(async () => view.result.current.loadMore());
    await waitFor(() => expect(view.result.current.footer).toBe("error"));
    expect(requested).toEqual([1, 2, 2]);
    expect(mockCapture).not.toHaveBeenCalled();

    replies[2] = httpError(400, "misconfigured");
    await act(async () => view.result.current.retryMore());
    await waitFor(() => expect(mockCapture).toHaveBeenCalledTimes(1));
  });
});

describe("empty filtered pages (C4b)", () => {
  it("reads on past an empty page in one load and continues from the real last page", async () => {
    replies[2] = ok(page(2, []));
    replies[3] = ok(page(3, idsFor(3)));
    const view = await setupLoaded();
    await loadMoreUntil(view, 6);
    expect(requested).toEqual([1, 2, 3]);
    expect(view.result.current.movies.map((m) => m.id)).toEqual([...idsFor(1), ...idsFor(3)]);

    await loadMoreUntil(view, 9);
    expect(requested).toEqual([1, 2, 3, 4]);
  });

  it("returns the empty page after three empties, shows the Retry footer, and Retry continues at the next page", async () => {
    replies[2] = ok(page(2, []));
    replies[3] = ok(page(3, []));
    replies[4] = ok(page(4, []));
    const view = await setupLoaded();

    await act(async () => view.result.current.loadMore());
    await waitFor(() => expect(view.result.current.footer).toBe("error"));
    expect(requested).toEqual([1, 2, 3, 4]);
    expect(view.result.current.movies).toHaveLength(3);

    await act(async () => view.result.current.loadMore());
    expect(requested).toEqual([1, 2, 3, 4]);

    await act(async () => view.result.current.retryMore());
    await waitFor(() => expect(view.result.current.movies).toHaveLength(6));
    expect(requested).toEqual([1, 2, 3, 4, 5]);
  });

  it("stops reading at the last page and shows the end footer, with no spinner", async () => {
    replies[1] = ok(page(1, idsFor(1), 3));
    replies[2] = ok(page(2, [], 3));
    replies[3] = ok(page(3, [], 3));
    const view = await setupLoaded();
    await act(async () => view.result.current.loadMore());
    await waitFor(() => expect(view.result.current.footer).toBe("end"));
    expect(requested).toEqual([1, 2, 3]);
  });

  it("reads on when the first page is empty", async () => {
    replies[1] = ok(page(1, []));
    replies[2] = ok(page(2, idsFor(2)));
    const view = await setup();
    await waitFor(() => expect(view.result.current.state).toBe("filled"));
    expect(requested).toEqual([1, 2]);
  });

  it("goes to the empty state when every page read is empty", async () => {
    replies[1] = ok(page(1, [], 1));
    const view = await setup();
    await waitFor(() => expect(view.result.current.state).toBe("empty"));
  });
});

describe("pull-to-refresh (C5)", () => {
  // Loads pages 1-5 so a refresh has something to drop.
  async function loadFive(onRefreshError?: () => void) {
    const view = await setupLoaded(onRefreshError);
    for (let n = 2; n <= 5; n++) await loadMoreUntil(view, n * 3);
    requested = [];
    return view;
  }

  it("fetches page 1 only, drops the later pages, and resolves true", async () => {
    replies[1] = ok(page(1, [91, 92, 93]));
    const view = await loadFive();

    let result = false;
    await act(async () => {
      result = await view.result.current.refresh();
    });
    expect(result).toBe(true);
    expect(requested).toEqual([1]);
    expect(view.result.current.movies.map((m) => m.id)).toEqual([91, 92, 93]);
    expect(view.result.current.refreshing).toBe(false);
  });

  it("keeps paging after a successful refresh: the list is re-armed and page 2 loads again (Bug 1)", async () => {
    for (const n of [1, 2, 3]) replies[n] = ok(page(n, idsFor(n), 3));
    const view = await setup(undefined, true);
    await waitFor(() => expect(view.result.current.footer).toBe("end"));
    expect(view.result.current.movies).toHaveLength(9);
    requested = [];

    // Hold page 1 so the trimmed list renders (and reports end-reached, which is refused) while the refresh runs.
    const slow = deferred<Reply>();
    replies[1] = () => slow.promise;
    let pending: Promise<boolean> = Promise.resolve(true);
    await act(async () => {
      pending = view.result.current.refresh();
    });
    await waitFor(() => expect(view.result.current.movies).toHaveLength(3));
    expect(requested).toEqual([1]);

    await act(async () => {
      slow.resolve(ok(page(1, idsFor(1), 3)));
      await pending;
    });
    // The report made while trimmed was refused, so the list must report again once the refresh ends.
    await waitFor(() => expect(view.result.current.movies.length).toBeGreaterThan(3));
    expect(requested.slice(0, 2)).toEqual([1, 2]);
  });

  it("puts all five pages back and calls onRefreshError once when the refetch fails; the screen stays filled", async () => {
    const onRefreshError = jest.fn();
    const second = await loadFive(onRefreshError);
    const before = second.result.current.movies.map((m) => m.id);

    replies[1] = httpError(400);
    let result = true;
    await act(async () => {
      result = await second.result.current.refresh();
    });
    expect(result).toBe(false);
    expect(onRefreshError).toHaveBeenCalledTimes(1);
    expect(second.result.current.state).toBe("filled");
    expect(second.result.current.movies.map((m) => m.id)).toEqual(before);
    expect(second.result.current.movies).toHaveLength(15);
    expect(second.result.current.footer).toBe("none");
  });

  it("a failed refresh keeps the page count: the next load continues at page 6", async () => {
    const view = await loadFive();
    replies[1] = () => offline();
    await act(async () => {
      await view.result.current.refresh();
    });
    expect(mockCapture).not.toHaveBeenCalled();
    replies[1] = ok(page(1, idsFor(1)));
    requested = [];
    await loadMoreUntil(view, 18);
    expect(requested).toEqual([6]);
  });

  it("reports a failed refresh to Sentry once, per M9", async () => {
    const view = await loadFive();
    replies[1] = httpError(502, "upstream_auth");
    await act(async () => {
      await view.result.current.refresh();
    });
    expect(mockCapture).toHaveBeenCalledTimes(1);
  });

  it("two pulls in a row make one set of requests", async () => {
    const view = await loadFive();
    await act(async () => {
      await Promise.all([view.result.current.refresh(), view.result.current.refresh()]);
    });
    expect(requested).toEqual([1]);
  });

  it("a pull from the error state (no posters) refetches without a toast", async () => {
    const onRefreshError = jest.fn();
    replies[1] = httpError(400);
    const view = await setup(onRefreshError);
    await waitFor(() => expect(view.result.current.state).toBe("error"));
    replies[1] = httpError(400);
    await act(async () => {
      await view.result.current.refresh();
    });
    expect(onRefreshError).not.toHaveBeenCalled();
    expect(view.result.current.state).toBe("error");
  });

  it("sets no state and shows no toast when the screen is left mid-refresh", async () => {
    const onRefreshError = jest.fn();
    const view = await setupLoaded(onRefreshError);
    const slow = deferred<Reply>();
    replies[1] = () => slow.promise;
    let pending: Promise<boolean> = Promise.resolve(true);
    await act(async () => {
      pending = view.result.current.refresh();
    });
    await view.unmount();
    await act(async () => {
      slow.resolve(httpError(400));
      await pending;
    });
    expect(onRefreshError).not.toHaveBeenCalled();
  });
});

describe("refresh races (C5b, C5c)", () => {
  it("a pull while page 4 is in flight cancels it: only page 1 is requested and page 4 never joins the list", async () => {
    const page4 = deferred<Reply>();
    replies[4] = () => page4.promise;
    const view = await setupLoaded();
    await loadMoreUntil(view, 6);
    await loadMoreUntil(view, 9);
    await act(async () => view.result.current.loadMore());
    expect(view.result.current.footer).toBe("loading");
    requested = [];

    replies[1] = ok(page(1, [91, 92, 93]));
    let pending: Promise<boolean> = Promise.resolve(true);
    await act(async () => {
      pending = view.result.current.refresh();
    });
    // Page 1 is requested without waiting for page 4 (a refetch that joined page 4's request would hang here).
    await waitFor(() => expect(requested).toEqual([1]));
    await act(async () => {
      page4.resolve(ok(page(4, idsFor(4))));
      await pending;
    });

    expect(view.result.current.movies.map((m) => m.id)).toEqual([91, 92, 93]);
    expect(view.result.current.footer).toBe("none");
  });

  it("end-reached and Retry right after a pull starts, before any await, make no request until it ends", async () => {
    const view = await setupLoaded();
    const slow = deferred<Reply>();
    replies[1] = () => slow.promise;
    requested = [];

    let pending: Promise<boolean> = Promise.resolve(true);
    await act(async () => {
      pending = view.result.current.refresh();
      // Same tick as the pull: only the refreshing ref knows a refresh has begun.
      view.result.current.loadMore();
      view.result.current.retryMore();
    });
    expect(requested).toEqual([1]);

    await act(async () => {
      slow.resolve(ok(page(1, [91, 92, 93])));
      await pending;
    });
    expect(requested).toEqual([1]);
    expect(view.result.current.movies.map((m) => m.id)).toEqual([91, 92, 93]);
  });
});

describe("image retry token", () => {
  it("goes up once per pull, success or failure", async () => {
    const view = await setupLoaded();
    expect(view.result.current.refreshCount).toBe(0);
    await act(async () => {
      await view.result.current.refresh();
    });
    replies[1] = httpError(400);
    await act(async () => {
      await view.result.current.refresh();
    });
    expect(view.result.current.refreshCount).toBe(2);
  });
});
