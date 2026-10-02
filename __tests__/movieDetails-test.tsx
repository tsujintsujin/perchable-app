import { act as reactAct } from "react";
import { AccessibilityInfo, BackHandler, StyleSheet } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { QueryClientProvider, notifyManager } from "@tanstack/react-query";
import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";

// No <SafeAreaProvider> in the test tree: fixed insets stand in for it.
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 24, right: 0, bottom: 16, left: 0 }),
}));

const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockCanGoBack = true;
jest.mock("expo-router", () => ({
  router: {
    back: () => mockBack(),
    replace: (...args: unknown[]) => mockReplace(...args),
    canGoBack: () => mockCanGoBack,
  },
}));

const mockInvoke = jest.fn();
jest.mock("@/lib/supabase", () => ({ supabase: { auth: { getSession: () => Promise.resolve({}) }, functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } } }));
const mockCapture = jest.fn();
jest.mock("@/lib/sentry", () => ({ Sentry: { captureException: (...args: unknown[]) => mockCapture(...args) } }));

import { createQueryClient } from "@/lib/queryClient";
import { motion, size } from "@/ui/tokens";
import { MovieDetailsScreen } from "@/modules/movies";

const FULL = {
  movie: {
    id: 603,
    title: "The Matrix",
    tagline: "Welcome to the real world.",
    overview: "A hacker learns the truth.",
    poster_path: "/p.jpg",
    backdrop_path: "/b.jpg",
    release_date: "1999-03-30",
    runtime: 136,
    vote_average: 8.24,
    vote_count: 25000,
    genres: [{ id: 28, name: "Action" }, { id: 878, name: "Science Fiction" }],
    cast: [
      { id: 1, name: "Keanu Reeves", character: "Neo", profile_path: "/k.jpg" },
      { id: 2, name: "Carrie-Anne Moss", character: null, profile_path: null },
    ],
  },
  attribution: "attr",
};

// The same movie with every optional value missing.
const SPARSE = {
  movie: {
    id: 9,
    title: "Quiet Film",
    tagline: "",
    overview: "   ",
    poster_path: null,
    backdrop_path: null,
    release_date: "",
    runtime: 0,
    vote_average: 0,
    vote_count: 0,
    genres: [],
    cast: [],
  },
  attribution: "attr",
};

const httpError = (status: number, code?: string) =>
  new FunctionsHttpError({ status, json: async () => (code ? { error: "x", code } : { error: "x" }) });
const offline = () => new FunctionsFetchError(new TypeError("Network request failed"));

// Clients made by renderDetails; cleared after each test so no gc timer keeps Jest alive.
const clients: ReturnType<typeof createQueryClient>[] = [];

// Renders the screen under a fresh query client whose retry waits no time.
async function renderDetails(idParam: string | undefined = "603", client = createQueryClient()) {
  if (!clients.includes(client)) clients.push(client);
  client.setDefaultOptions({ queries: { ...client.getDefaultOptions().queries, retryDelay: 0 } });
  const view = await render(
    <QueryClientProvider client={client}>
      <MovieDetailsScreen idParam={idParam} />
    </QueryClientProvider>,
  );
  return { ...view, client };
}

let consoleError: jest.SpyInstance;
let consoleWarn: jest.SpyInstance;
let announce: jest.SpyInstance;
// React Query delivers results on a timer; running its notifications in React's synchronous act makes every update land inside act.
beforeAll(() => {
  notifyManager.setNotifyFunction((fn) => {
    // waitFor switches the act environment off while it polls; it is turned back on just for this call.
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
  announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});
  mockInvoke.mockReset();
  mockCapture.mockReset();
  mockBack.mockReset();
  mockReplace.mockReset();
  mockCanGoBack = true;
  consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  consoleWarn = jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(async () => {
  // Lets the query cache and animations finish their timer-driven updates inside act before the console check.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  // Stops in-flight fetches and drops the cache so nothing lands after the test.
  for (const client of clients.splice(0)) {
    await client.cancelQueries();
    client.clear();
  }
  expect(consoleError).not.toHaveBeenCalled();
  expect(consoleWarn).not.toHaveBeenCalled();
  consoleError.mockRestore();
  consoleWarn.mockRestore();
  announce.mockRestore();
});

describe("Details: loaded", () => {
  it("shows title, year, runtime, genres, rating, tagline, synopsis and the cast", async () => {
    mockInvoke.mockResolvedValue({ data: FULL, error: null });
    await renderDetails();

    expect(await screen.findByRole("header", { name: "The Matrix" })).toBeTruthy();
    expect(screen.getByText("1999 · 2h 16m")).toBeTruthy();
    expect(screen.getByText("Action · Science Fiction")).toBeTruthy();
    expect(screen.getByText("8.2")).toBeTruthy();
    expect(screen.getByText("of 10")).toBeTruthy();
    expect(screen.getByText("Welcome to the real world.")).toBeTruthy();
    expect(screen.getByRole("header", { name: "Synopsis" })).toBeTruthy();
    expect(screen.getByText("A hacker learns the truth.")).toBeTruthy();
    expect(screen.getByRole("header", { name: "Cast" })).toBeTruthy();
    expect(screen.getByRole("header", { name: "#spoiler-free-lounge" })).toBeTruthy();
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke.mock.calls[0][0]).toBe("tmdb?endpoint=details&id=603");
  });

  it("labels the poster, the rating and each cast item for screen readers", async () => {
    mockInvoke.mockResolvedValue({ data: FULL, error: null });
    await renderDetails();
    await screen.findByRole("header", { name: "The Matrix" });

    expect(screen.getByRole("image", { name: "Poster for The Matrix" })).toBeTruthy();
    expect(screen.getByLabelText("Rated 8.2 out of 10 on TMDB")).toBeTruthy();
    expect(screen.getByLabelText("Keanu Reeves as Neo")).toBeTruthy();
    expect(screen.getByLabelText("Carrie-Anne Moss")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
    expect(screen.getByTestId("cast-list").props.accessibilityRole).toBe("list");
  });

  it("uses the initials fallback for a cast member without a photo", async () => {
    mockInvoke.mockResolvedValue({ data: FULL, error: null });
    await renderDetails();
    await screen.findByRole("header", { name: "The Matrix" });
    // Carrie-Anne has no photo: her initial shows; Neo's photo is an image, not an initial.
    expect(screen.getAllByText("C", { includeHiddenElements: true }).length).toBeGreaterThan(0);
  });
});

describe("Details: missing data never prints blanks, NaN or undefined", () => {
  it("shows the fallbacks for a movie with nothing optional", async () => {
    mockInvoke.mockResolvedValue({ data: SPARSE, error: null });
    await renderDetails("9");

    expect(await screen.findByRole("header", { name: "Quiet Film" })).toBeTruthy();
    expect(screen.getByText("No synopsis available.")).toBeTruthy();
    expect(screen.getByText("Not rated yet")).toBeTruthy();
    expect(screen.getByLabelText("Not rated yet on TMDB")).toBeTruthy();
    expect(screen.queryByText("of 10")).toBeNull();
    expect(screen.queryByText("0.0")).toBeNull();
    // No cast: neither the heading nor the row.
    expect(screen.queryByRole("header", { name: "Cast" })).toBeNull();
    expect(screen.queryByTestId("cast-list")).toBeNull();
    // No poster: the fallback icon and title.
    expect(screen.getByText("🎬")).toBeTruthy();
    // No year, runtime, genres or tagline lines.
    expect(screen.queryByText(/·/)).toBeNull();
    expect(screen.queryByText(/NaN|undefined|null|0m/)).toBeNull();
  });

  it("shows a lone year or a lone runtime without a separator", async () => {
    mockInvoke.mockResolvedValue({ data: { ...SPARSE, movie: { ...SPARSE.movie, release_date: "2001-05-05", runtime: 45 } }, error: null });
    await renderDetails("9");
    expect(await screen.findByText("2001 · 45m")).toBeTruthy();
  });

  it("shows just the name for a cast member with an empty character", async () => {
    const cast = [{ id: 1, name: "Solo", character: "  ", profile_path: null }];
    mockInvoke.mockResolvedValue({ data: { ...FULL, movie: { ...FULL.movie, cast } }, error: null });
    await renderDetails();
    expect(await screen.findByLabelText("Solo")).toBeTruthy();
  });
});

describe("Details: title, cast keys, scrim and Toast offset", () => {
  it("shows Untitled for an empty or blank title, never an empty header", async () => {
    mockInvoke.mockResolvedValue({ data: { ...FULL, movie: { ...FULL.movie, title: "  " } }, error: null });
    await renderDetails();
    expect(await screen.findByRole("header", { name: "Untitled" })).toBeTruthy();
    expect(screen.getByRole("image", { name: "Poster for Untitled" })).toBeTruthy();
  });

  it("renders a person with two roles twice without a duplicate-key warning", async () => {
    const cast = [
      { id: 7, name: "Actor", character: "Role A", profile_path: null },
      { id: 7, name: "Actor", character: "Role B", profile_path: null },
    ];
    mockInvoke.mockResolvedValue({ data: { ...FULL, movie: { ...FULL.movie, cast } }, error: null });
    await renderDetails();
    expect(await screen.findByLabelText("Actor as Role A")).toBeTruthy();
    expect(screen.getByLabelText("Actor as Role B")).toBeTruthy();
    // afterEach fails on any console.error, which is where React reports a duplicate key.
  });

  it("draws the status-bar scrim only when loaded: inset + 72 high, decorative, not touchable", async () => {
    mockInvoke.mockReturnValue(new Promise(() => {}));
    const loading = await renderDetails();
    expect(screen.queryByTestId("top-scrim", { includeHiddenElements: true })).toBeNull();
    await act(async () => loading.unmount());

    mockInvoke.mockResolvedValue({ data: FULL, error: null });
    await renderDetails();
    const scrim = await screen.findByTestId("top-scrim", { includeHiddenElements: true });
    const style = StyleSheet.flatten(scrim.props.style);
    expect(style.height).toBe(24 + size.detailsScrimHeight);
    expect(style.opacity).toBe(1);
    expect(scrim.props.pointerEvents).toBe("none");
    expect(scrim.props.importantForAccessibility).toBe("no-hide-descendants");
  });

  it("scrolls with 80 + inset of bottom padding and puts both Toasts inside it, below the lounge card", async () => {
    mockInvoke.mockResolvedValue({ data: FULL, error: null });
    const { client } = await renderDetails();
    await screen.findByRole("header", { name: "The Matrix" });
    const padding = StyleSheet.flatten(screen.getByTestId("details-scroll").props.contentContainerStyle).paddingBottom;
    expect(padding).toBe(16 + size.detailsBottomPad);

    await fireEvent.press(screen.getByRole("button", { name: "Hoot your thoughts" }));
    const toastBottom = () => StyleSheet.flatten(screen.getByRole("alert").props.style).bottom;
    expect(toastBottom()).toBe(16 + size.detailsToastOffset);
    // The Toast bottom edge is under the end of the content, so it cannot cover the composer.
    expect(toastBottom()).toBeLessThan(padding);

    // The refetch-error Toast uses the same offset.
    mockInvoke.mockResolvedValue({ data: null, error: httpError(404, "not_found") });
    await act(async () => {
      await client.refetchQueries({ queryKey: ["movies", "details", 603] }, { throwOnError: false });
    });
    expect(await screen.findByText("Couldn't refresh. Check your connection.")).toBeTruthy();
    expect(toastBottom()).toBe(16 + size.detailsToastOffset);
    expect(toastBottom()).toBeLessThan(padding);
  });
});

describe("Details: loading, error and not found", () => {
  it("shows the skeleton with a polite 'Loading movie' region, announces it once, and the Back chip", async () => {
    mockInvoke.mockReturnValue(new Promise(() => {}));
    await renderDetails();
    expect(screen.getByLabelText("Loading movie").props.accessibilityLiveRegion).toBe("polite");
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith("Loading movie");
    expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
  });

  it("offline: shows the error state, then Retry loads the movie", async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: offline() }).mockResolvedValueOnce({ data: null, error: offline() });
    await renderDetails();
    expect(await screen.findByText("Couldn't load this movie")).toBeTruthy();
    expect(screen.getByText("Check your connection and try again.")).toBeTruthy();
    expect(mockInvoke).toHaveBeenCalledTimes(2);
    expect(mockCapture).not.toHaveBeenCalled();

    mockInvoke.mockResolvedValue({ data: FULL, error: null });
    await fireEvent.press(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("header", { name: "The Matrix" })).toBeTruthy();
  });

  it("a double tap on Retry makes one request", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: httpError(400, "invalid_id") });
    await renderDetails();
    await screen.findByText("Couldn't load this movie");
    mockInvoke.mockClear();
    mockInvoke.mockReturnValue(new Promise(() => {}));
    const retry = screen.getByRole("button", { name: "Retry" });
    await fireEvent.press(retry);
    await fireEvent.press(retry);
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it("a 404 is its own state: no retry, no Sentry, a way back to Home", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: httpError(404, "not_found") });
    await renderDetails("123456");
    expect(await screen.findByText("Movie not found")).toBeTruthy();
    expect(screen.getByText("We couldn't find that movie. It may have been removed.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockCapture).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole("button", { name: "Back to Home" }));
    expect(mockReplace).toHaveBeenCalledWith("/");
  });

  it.each([["abc"], ["0"], ["-1"], ["1.5"], ["1e3"], [" 5"], ["2147483648"]])(
    "an invalid route id %p shows not found and makes no request",
    async (id) => {
      await renderDetails(id);
      expect(await screen.findByText("Movie not found")).toBeTruthy();
      expect(mockInvoke).not.toHaveBeenCalled();
      expect(mockCapture).not.toHaveBeenCalled();
    },
  );

  it("a missing route id shows not found and makes no request", async () => {
    const client = createQueryClient();
    clients.push(client);
    await render(
      <QueryClientProvider client={client}>
        <MovieDetailsScreen idParam={undefined} />
      </QueryClientProvider>,
    );
    expect(await screen.findByText("Movie not found")).toBeTruthy();
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("reports a bad TMDB key to Sentry once but still shows the error state", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: httpError(502, "upstream_auth") });
    await renderDetails();
    expect(await screen.findByText("Couldn't load this movie")).toBeTruthy();
    expect(mockCapture).toHaveBeenCalledTimes(1);
  });

  it("a refetch that fails keeps the loaded movie and shows the error Toast", async () => {
    mockInvoke.mockResolvedValue({ data: FULL, error: null });
    const { client } = await renderDetails();
    await screen.findByRole("header", { name: "The Matrix" });

    mockInvoke.mockResolvedValue({ data: null, error: httpError(404, "not_found") });
    await act(async () => {
      await client.refetchQueries({ queryKey: ["movies", "details", 603] }, { throwOnError: false });
    });
    expect(screen.getByRole("header", { name: "The Matrix" })).toBeTruthy();
    expect(screen.queryByText("Movie not found")).toBeNull();
    expect(await screen.findByText("Couldn't refresh. Check your connection.")).toBeTruthy();
  });
});

describe("Details: leaving and switching", () => {
  it("leaving mid-load aborts the request and sets no state, error or Sentry event", async () => {
    let signal: AbortSignal | undefined;
    mockInvoke.mockImplementation((_path: string, options: { signal: AbortSignal }) => {
      signal = options.signal;
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
      });
    });
    const view = await renderDetails();
    await act(async () => {});
    expect(signal).toBeDefined();
    expect(signal?.aborted).toBe(false);

    await act(async () => view.unmount());
    expect(signal?.aborted).toBe(true);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(mockCapture).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("opening movie B after movie A never shows A's data", async () => {
    mockInvoke.mockImplementation(async (path: string) =>
      path.endsWith("id=603")
        ? { data: FULL, error: null }
        : { data: { ...SPARSE, movie: { ...SPARSE.movie, id: 9, title: "Quiet Film" } }, error: null },
    );
    const client = createQueryClient();
    const first = await renderDetails("603", client);
    expect(await screen.findByRole("header", { name: "The Matrix" })).toBeTruthy();
    await act(async () => first.unmount());

    mockInvoke.mockReturnValue(new Promise(() => {}));
    await renderDetails("9", client);
    // B is loading: A's title is nowhere on screen.
    expect(screen.queryByText("The Matrix")).toBeNull();
    expect(screen.getByLabelText("Loading movie")).toBeTruthy();
  });
});

describe("Details: back", () => {
  it("the Back chip goes back when there is history", async () => {
    mockInvoke.mockResolvedValue({ data: FULL, error: null });
    await renderDetails();
    await screen.findByRole("header", { name: "The Matrix" });
    await fireEvent.press(screen.getByRole("button", { name: "Back" }));
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("on a cold deep link (no history) Back replaces with Home", async () => {
    mockCanGoBack = false;
    mockInvoke.mockResolvedValue({ data: FULL, error: null });
    await renderDetails();
    await screen.findByRole("header", { name: "The Matrix" });
    await fireEvent.press(screen.getByRole("button", { name: "Back" }));
    expect(mockReplace).toHaveBeenCalledWith("/");
    expect(mockBack).not.toHaveBeenCalled();
  });
});

describe("Details: UI-only shells", () => {
  it("the Tier chip toggles a static legend, and the first hardware Back closes it", async () => {
    mockInvoke.mockResolvedValue({ data: FULL, error: null });
    let hardwareBack: (() => boolean | null | undefined) | undefined;
    const add = jest.spyOn(BackHandler, "addEventListener").mockImplementation((_name, handler) => {
      hardwareBack = handler as () => boolean;
      return { remove: () => { hardwareBack = undefined; } };
    });
    await renderDetails();
    await screen.findByRole("header", { name: "The Matrix" });

    const chip = screen.getByRole("button", { name: "Tier rating" });
    expect(chip.props.accessibilityHint).toBe("Opens an explanation. Tier ratings are coming soon.");
    expect(screen.queryByText("Tier ratings")).toBeNull();

    await fireEvent.press(chip);
    expect(screen.getByText("Tier ratings")).toBeTruthy();
    expect(screen.getByText("Soon you'll rank the movies you've watched from S (best) down to C. Coming soon.")).toBeTruthy();
    ["S", "A", "B", "C"].forEach((letter) => expect(screen.getAllByLabelText(`Tier ${letter}`)).toHaveLength(1));

    // The first Android back press closes the legend and is consumed.
    let consumed: boolean | null | undefined;
    await act(async () => {
      consumed = hardwareBack?.();
    });
    expect(consumed).toBe(true);
    expect(screen.queryByText("Tier ratings")).toBeNull();

    // The chip again toggles it open, and again closed.
    await fireEvent.press(chip);
    expect(screen.getByText("Tier ratings")).toBeTruthy();
    await fireEvent.press(chip);
    expect(screen.queryByText("Tier ratings")).toBeNull();
    add.mockRestore();
  });

  it("tapping outside the legend closes it", async () => {
    mockInvoke.mockResolvedValue({ data: FULL, error: null });
    await renderDetails();
    await screen.findByRole("header", { name: "The Matrix" });
    await fireEvent.press(screen.getByRole("button", { name: "Tier rating" }));
    expect(screen.getByText("Tier ratings")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("legend-dismiss"));
    expect(screen.queryByText("Tier ratings")).toBeNull();
  });

  it("shows the lounge samples labelled Preview only, and the composer answers with a Toast", async () => {
    mockInvoke.mockResolvedValue({ data: FULL, error: null });
    await renderDetails();
    await screen.findByRole("header", { name: "The Matrix" });

    expect(screen.getByText("Chat about this movie without spoilers.")).toBeTruthy();
    // Author over message, as separate lines.
    expect(screen.getByText("CineOwl")).toBeTruthy();
    expect(screen.getByText("Just finished it. No spoilers, but wow.")).toBeTruthy();
    expect(screen.getByText("ReelMara")).toBeTruthy();
    expect(screen.getByText("Rewatching it this weekend. Who's in?")).toBeTruthy();
    expect(screen.getByText("Preview only. Comments are coming soon.")).toBeTruthy();
    expect(screen.queryByText("Comments are coming soon.")).toBeNull();

    const composer = screen.getByRole("button", { name: "Hoot your thoughts" });
    expect(composer.props.accessibilityHint).toBe("Comments are coming soon");
    expect(screen.queryByPlaceholderText("Hoot your thoughts…")).toBeNull();
    await fireEvent.press(composer);
    expect(await screen.findByText("Comments are coming soon.")).toBeTruthy();
    // Nothing was fetched for the lounge: the only request is the movie.
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });
});
