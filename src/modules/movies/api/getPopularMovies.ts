import { supabase } from "@/lib/supabase";
import { authReady, REQUEST_TIMEOUT_MS } from "@/lib/requestTimeout";
import { MovieApiError, toMovieApiError } from "./MovieApiError";
import { parsePopular } from "./parsePopular";
import type { PopularMoviesResult } from "../types";

/** TMDB serves at most this many pages of a list. */
export const TMDB_MAX_PAGE = 500;

/** How many consecutive TMDB pages one load may read when the proxy's adult filter empties them. */
export const MAX_PAGES_PER_LOAD = 3;

/** Calls the `tmdb` Edge Function so the TMDB key never reaches the bundle; throws MovieApiError on failure. */
export async function getPopularMovies(page = 1, signal?: AbortSignal): Promise<PopularMoviesResult> {
  // The auth wait before the request is timed too; a timeout there is the usual movie timeout error.
  await authReady().catch(() => {
    throw new MovieApiError("timeout");
  });
  const { data, error } = await supabase.functions.invoke<unknown>(`tmdb?endpoint=popular&page=${page}`, {
    method: "GET",
    timeout: REQUEST_TIMEOUT_MS,
    signal,
  });
  if (error) throw await toMovieApiError(error, signal);
  return parsePopular(data);
}

/** True when TMDB has a page after this one. */
export function hasMorePages(result: PopularMoviesResult): boolean {
  return result.page < Math.min(result.total_pages, TMDB_MAX_PAGE);
}

/** Reads from `startPage` until a page has movies (at most MAX_PAGES_PER_LOAD pages); `page` on the result is the last one read. */
export async function getPopularPage(startPage: number, signal?: AbortSignal): Promise<PopularMoviesResult> {
  let next = startPage;
  for (let read = 1; ; read++) {
    const result = await getPopularMovies(next, signal);
    if (result.results.length > 0 || read >= MAX_PAGES_PER_LOAD || !hasMorePages(result)) return result;
    next = result.page + 1;
  }
}
