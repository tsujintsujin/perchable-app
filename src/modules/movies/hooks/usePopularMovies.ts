import { useInfiniteQuery } from "@tanstack/react-query";
import { getPopularMovies } from "../api/getPopularMovies";
import type { Movie } from "../types";

/** TMDB serves at most this many pages of a list. */
export const TMDB_MAX_PAGE = 500;

/** Query key of the Popular list; public data, so not owner-tagged. */
export const POPULAR_KEY = ["movies", "popular"] as const;

export type PopularState = "loading" | "filled" | "empty" | "error";

/** Popular movies for Home: the loaded movies, which of the four screen states applies, and a deduped Retry. */
export function usePopularMovies(): { state: PopularState; movies: Movie[]; retry: () => void } {
  const query = useInfiniteQuery({
    queryKey: POPULAR_KEY,
    queryFn: ({ pageParam, signal }) => getPopularMovies(pageParam, signal),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < Math.min(last.total_pages, TMDB_MAX_PAGE) ? last.page + 1 : undefined),
  });

  const movies = query.data?.pages.flatMap((page) => page.results) ?? [];
  let state: PopularState = "loading";
  if (movies.length > 0) state = "filled";
  else if (query.status === "success") state = "empty";
  else if (query.status === "error") state = "error";

  // A second tap while a request is running joins it instead of starting another.
  const retry = () => void query.refetch({ cancelRefetch: false });

  return { state, movies, retry };
}
