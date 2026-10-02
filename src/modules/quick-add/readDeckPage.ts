import { getPopularMovies, hasMorePages, type PopularMoviesResult } from "@/modules/movies";

/** How many consecutive pages one load may read when every movie on them was already seen (Home's own limit is 3). */
export const DECK_MAX_PAGES_PER_LOAD = 15;

type Options = {
  startPage: number;
  signal?: AbortSignal;
  /** True when the movie is not excluded and not already loaded on an earlier page. */
  isFresh: (movieId: number) => boolean;
  /** Called with each page that held nothing new, so a retry can resume after it. */
  onSeenPage: (page: number) => void;
  fetchPage?: (page: number, signal?: AbortSignal) => Promise<PopularMoviesResult>;
};

/** Reads pages from `startPage` until one has a movie the user has not seen; stops after DECK_MAX_PAGES_PER_LOAD or at the last page. `page` on the result is the last one read. */
export async function readDeckPage({ startPage, signal, isFresh, onSeenPage, fetchPage = getPopularMovies }: Options): Promise<PopularMoviesResult> {
  let next = startPage;
  for (let read = 1; ; read++) {
    const result = await fetchPage(next, signal);
    if (result.results.some((movie) => isFresh(movie.id))) return result;
    onSeenPage(result.page);
    if (read >= DECK_MAX_PAGES_PER_LOAD || !hasMorePages(result)) return result;
    next = result.page + 1;
  }
}
