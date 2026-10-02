import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { hasMorePages, type Movie, type PopularMoviesResult } from "@/modules/movies";
import type { SwipeDirection } from "../decideSwipe";
import { DECK_KEY } from "../deckKey";
import { readDeckPage } from "../readDeckPage";
import { capSkips, getSessionAdds, loadSkips, saveSkips, setSessionAdds } from "../skipMemory";

export { DECK_KEY };

/** The next page is requested once this many usable cards or fewer remain. */
export const REQUEST_MORE_AT = 5;

/** Pages with nothing new in one load before the loading state says what it is doing. */
export const FINDING_AFTER_PAGES = 3;

export type DeckState = "loading" | "filled" | "error" | "keepGoing" | "nextFailed" | "caughtUp";

export type UndoEntry = { movie: Movie; direction: SwipeDirection };

/** A card that came back on top after Undo; `held` when it waited for a drag to end first. */
export type ReturnedCard = { movie: Movie; seq: number; action: "skip" | "add"; held: boolean };

// Flattens the loaded pages into one list; a movie id seen on an earlier page is dropped.
function flattenPages(pages: PopularMoviesResult[] | undefined): Movie[] {
  const seen = new Set<number>();
  const movies: Movie[] = [];
  for (const page of pages ?? []) {
    for (const movie of page.results) {
      if (seen.has(movie.id)) continue;
      seen.add(movie.id);
      movies.push(movie);
    }
  }
  return movies;
}

/** The deck's data and rules for one signed-in user: the usable cards, the screen state, swipe, undo and paging. Mount it keyed by user id. */
export function useQuickAddDeck(userId: string) {
  const queryClient = useQueryClient();
  // Refs, not state: handlers must see the newest lists before React re-renders (rapid swipes).
  const listsRef = useRef<{ skips: number[]; added: number[] }>({ skips: [], added: getSessionAdds(userId) });
  const [skips, setSkips] = useState<number[] | null>(null);
  const [added, setAdded] = useState<number[]>(() => getSessionAdds(userId));
  const [last, setLast] = useState<UndoEntry | null>(null);
  const [returned, setReturned] = useState<ReturnedCard | null>(null);
  const [finding, setFinding] = useState(false);
  const lastRef = useRef<UndoEntry | null>(null);
  const draggingRef = useRef(false);
  const heldRef = useRef<UndoEntry | null>(null);
  const returnSeqRef = useRef(0);
  const mountedRef = useRef(true);
  // Where a failed or stopped page load left off, so Retry resumes there instead of at the first page.
  const resumeRef = useRef<{ param: number; page: number } | null>(null);
  const excludedRef = useRef<Set<number>>(new Set());
  const loadedRef = useRef<Set<number>>(new Set());
  const remainingRef = useRef(0);

  // Marks the hook unmounted so a late page load or storage read sets no state.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Reads the saved skips; the first page waits for them so a skipped movie never flashes.
  useEffect(() => {
    let active = true;
    void loadSkips(userId).then((saved) => {
      if (!active) return;
      listsRef.current.skips = saved;
      setSkips(saved);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  const excluded = useMemo(() => new Set([...(skips ?? []), ...added]), [skips, added]);
  // The page loop reads the newest exclusions and loaded ids through refs, not through a stale closure.
  useEffect(() => {
    excludedRef.current = excluded;
  }, [excluded]);

  const query = useInfiniteQuery({
    queryKey: DECK_KEY,
    enabled: skips !== null,
    initialPageParam: 1,
    queryFn: async ({ pageParam, signal }) => {
      const resume = resumeRef.current;
      let seenPages = 0;
      try {
        const result = await readDeckPage({
          startPage: resume?.param === pageParam ? resume.page : pageParam,
          signal,
          isFresh: (id) => !excludedRef.current.has(id) && !loadedRef.current.has(id),
          onSeenPage: (page) => {
            resumeRef.current = { param: pageParam, page: page + 1 };
            seenPages += 1;
            if (seenPages === FINDING_AFTER_PAGES && mountedRef.current) setFinding(true);
          },
        });
        resumeRef.current = null;
        return result;
      } finally {
        if (seenPages >= FINDING_AFTER_PAGES && mountedRef.current) setFinding(false);
      }
    },
    getNextPageParam: (lastPage) => (hasMorePages(lastPage) ? lastPage.page + 1 : undefined),
  });

  const loaded = useMemo(() => flattenPages(query.data?.pages), [query.data]);
  const cards = useMemo(() => loaded.filter((movie) => !excluded.has(movie.id)), [loaded, excluded]);
  // Keeps the loaded-ids ref and the remaining-cards count in step with what was rendered.
  useEffect(() => {
    loadedRef.current = new Set(loaded.map((movie) => movie.id));
    remainingRef.current = cards.length;
  }, [loaded, cards]);

  const { hasNextPage, isFetching, isError, isFetchNextPageError, isPending, fetchNextPage, refetch } = query;
  const hasData = query.data !== undefined;

  let state: DeckState;
  if (skips === null) state = "loading";
  else if (cards.length > 0) state = "filled";
  else if (isFetching) state = "loading";
  else if (isError) state = hasData ? "nextFailed" : "error";
  else if (isPending) state = "loading";
  else if (hasNextPage) state = "keepGoing";
  else state = "caughtUp";

  // A second request while one runs joins it, so rapid swipes make one page request.
  const requestMore = useCallback(() => {
    if (!hasNextPage || isFetchNextPageError) return;
    void fetchNextPage({ cancelRefetch: false });
  }, [hasNextPage, isFetchNextPageError, fetchNextPage]);

  // Records a swipe: left saves a skip for this device, right joins this session's list; asks for more cards when few remain.
  const swipe = useCallback(
    (movie: Movie, direction: SwipeDirection) => {
      const lists = listsRef.current;
      if (direction === "left") {
        lists.skips = capSkips([...lists.skips.filter((id) => id !== movie.id), movie.id]);
        setSkips(lists.skips);
        void saveSkips(userId, lists.skips);
      } else {
        lists.added = [...lists.added.filter((id) => id !== movie.id), movie.id];
        setAdded(lists.added);
        setSessionAdds(userId, lists.added);
      }
      lastRef.current = { movie, direction };
      setLast(lastRef.current);
      remainingRef.current -= 1;
      if (remainingRef.current <= REQUEST_MORE_AT) requestMore();
    },
    [userId, requestMore],
  );

  // Takes the movie back out of the skips or the session list so its card returns to its place in the order.
  const release = useCallback(
    (entry: UndoEntry, held: boolean) => {
      const lists = listsRef.current;
      if (entry.direction === "left") {
        lists.skips = lists.skips.filter((id) => id !== entry.movie.id);
        setSkips(lists.skips);
        void saveSkips(userId, lists.skips);
      } else {
        lists.added = lists.added.filter((id) => id !== entry.movie.id);
        setAdded(lists.added);
        setSessionAdds(userId, lists.added);
      }
      returnSeqRef.current += 1;
      setReturned({ movie: entry.movie, seq: returnSeqRef.current, action: entry.direction === "left" ? "skip" : "add", held });
    },
    [userId],
  );

  // One-step undo of the last swipe; during a drag the card is held and comes back when the drag ends.
  const undo = useCallback(() => {
    const entry = lastRef.current;
    if (!entry) return;
    lastRef.current = null;
    setLast(null);
    if (draggingRef.current) heldRef.current = entry;
    else release(entry, false);
  }, [release]);

  // Tells the deck a drag started or ended; a held card returns the moment the drag ends.
  const setDragging = useCallback(
    (active: boolean) => {
      draggingRef.current = active;
      const held = heldRef.current;
      if (active || !held) return;
      heldRef.current = null;
      release(held, true);
    },
    [release],
  );

  // Retry on the error and next-page-failed screens: the first load starts over (resuming), a next page loads on.
  const retry = useCallback(() => {
    if (hasData) void fetchNextPage({ cancelRefetch: false });
    else void refetch({ cancelRefetch: false });
  }, [hasData, fetchNextPage, refetch]);

  // "Keep looking": reads on from where the last load stopped.
  const keepLooking = useCallback(() => {
    void fetchNextPage({ cancelRefetch: false });
  }, [fetchNextPage]);

  // "Start over": forgets the saved skips and reloads the list from the first page.
  const startOver = useCallback(() => {
    const lists = listsRef.current;
    lists.skips = [];
    setSkips([]);
    void saveSkips(userId, []);
    lastRef.current = null;
    setLast(null);
    resumeRef.current = null;
    // The reload must not treat the old pages as already loaded or the cleared skips as still excluded.
    loadedRef.current = new Set();
    excludedRef.current = new Set(lists.added);
    void queryClient.resetQueries({ queryKey: DECK_KEY });
  }, [userId, queryClient]);

  return { state, cards, finding, canUndo: last !== null, returned, swipe, undo, setDragging, retry, keepLooking, startOver };
}
