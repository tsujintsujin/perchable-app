import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { getPopularPage, hasMorePages } from "../api/getPopularMovies";
import type { Movie, PopularMoviesResult } from "../types";

/** Query key of the Popular list; public data, so not owner-tagged. */
export const POPULAR_KEY = ["movies", "popular"] as const;

export type PopularState = "loading" | "filled" | "empty" | "error";

/** What the list footer shows: nothing, a spinner, the end-of-list line, or a failed-load Retry row. */
export type PopularFooter = "none" | "loading" | "end" | "error";

type PopularData = InfiniteData<PopularMoviesResult, number>;

type Options = {
  /** Called once when a pull-to-refresh fails and the earlier list was put back. */
  onRefreshError?: () => void;
};

type Popular = {
  state: PopularState;
  movies: Movie[];
  footer: PopularFooter;
  refreshing: boolean;
  /** Goes up on every pull-to-refresh; posters that failed to load use it to try their image again. */
  refreshCount: number;
  retry: () => void;
  loadMore: () => void;
  retryMore: () => void;
  /** Resolves true when page 1 reloaded, false when it failed or was skipped. */
  refresh: () => Promise<boolean>;
};

// Flattens the loaded pages into one list; a movie id seen on an earlier page is dropped.
function flattenPages(data: { pages: PopularMoviesResult[] } | undefined): Movie[] {
  const seen = new Set<number>();
  const movies: Movie[] = [];
  for (const page of data?.pages ?? []) {
    for (const movie of page.results) {
      if (seen.has(movie.id)) continue;
      seen.add(movie.id);
      movies.push(movie);
    }
  }
  return movies;
}

/** Popular movies for Home: the deduped list, the screen state, the footer state, paging and pull-to-refresh. */
export function usePopularMovies({ onRefreshError }: Options = {}): Popular {
  const queryClient = useQueryClient();
  const query = useInfiniteQuery({
    queryKey: POPULAR_KEY,
    queryFn: ({ pageParam, signal }) => getPopularPage(pageParam, signal),
    initialPageParam: 1,
    getNextPageParam: (last) => (hasMorePages(last) ? last.page + 1 : undefined),
  });

  const [refreshing, setRefreshing] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);
  // Refs, not state: read inside async code and guards that must see the change before a re-render.
  const refreshingRef = useRef(false);
  const mountedRef = useRef(true);

  // Marks the hook unmounted so a late refresh result sets no state.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // `dataUpdatedAt` makes a refetch that returns identical pages still hand the list a new array: FlashList reports
  // "end reached" once per data change, and a report swallowed during a refresh must be re-armed when it ends.
  const { data, dataUpdatedAt } = query;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const movies = useMemo(() => flattenPages(data), [data, dataUpdatedAt]);
  const pages = query.data?.pages;
  const lastPage = pages?.[pages.length - 1];

  let state: PopularState = "loading";
  if (movies.length > 0) state = "filled";
  else if (query.status === "success") state = "empty";
  else if (query.status === "error") state = "error";

  // A failed next page, or a load that read several empty pages and still has more, waits for a tap on Retry.
  const stalled =
    query.isFetchNextPageError || (!!lastPage && lastPage.results.length === 0 && query.hasNextPage && !query.isFetching);
  let footer: PopularFooter = "none";
  if (state === "filled" && !refreshing) {
    if (query.isFetchingNextPage) footer = "loading";
    else if (stalled) footer = "error";
    else if (!query.hasNextPage && !query.isFetching) footer = "end";
  }

  // A second tap while a request is running joins it instead of starting another.
  const retry = () => void query.refetch({ cancelRefetch: false });

  // Fetches the next page unless one is loading, a refresh is running, there is none, or the footer waits for Retry.
  const { hasNextPage, isFetching, fetchNextPage } = query;
  const loadMore = useCallback(() => {
    if (!hasNextPage || isFetching || refreshingRef.current || stalled) return;
    void fetchNextPage({ cancelRefetch: false });
  }, [hasNextPage, isFetching, fetchNextPage, stalled]);

  // The footer's Retry loads only the next page; the loaded pages are not refetched.
  const retryMore = useCallback(() => {
    if (refreshingRef.current) return;
    void fetchNextPage({ cancelRefetch: false });
  }, [fetchNextPage]);

  // Pull-to-refresh: cancel in-flight pages, keep a snapshot, trim to page 1, refetch it; on failure put the snapshot back.
  const refresh = useCallback(async () => {
    if (refreshingRef.current) return false;
    refreshingRef.current = true;
    setRefreshing(true);
    setRefreshCount((count) => count + 1);
    try {
      await queryClient.cancelQueries({ queryKey: POPULAR_KEY });
      const snapshot = queryClient.getQueryData<PopularData>(POPULAR_KEY);
      if (snapshot) {
        queryClient.setQueryData<PopularData>(POPULAR_KEY, {
          pages: snapshot.pages.slice(0, 1),
          pageParams: snapshot.pageParams.slice(0, 1),
        });
      }
      // cancelRefetch false: cancelQueries above is the only thing that ends an in-flight page, so a refetch never joins one.
      await queryClient.refetchQueries({ queryKey: POPULAR_KEY, exact: true }, { throwOnError: false, cancelRefetch: false });
      if (queryClient.getQueryState(POPULAR_KEY)?.status !== "error") return true;
      // Putting the snapshot back also clears the error status, so the posters stay on screen.
      if (snapshot) {
        queryClient.setQueryData<PopularData>(POPULAR_KEY, snapshot);
        if (mountedRef.current) onRefreshError?.();
      }
      return false;
    } finally {
      refreshingRef.current = false;
      if (mountedRef.current) setRefreshing(false);
    }
  }, [queryClient, onRefreshError]);

  return { state, movies, footer, refreshing, refreshCount, retry, loadMore, retryMore, refresh };
}
