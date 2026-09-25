// TMDB `/movie/popular` result shape, trimmed to what the app uses.
// Full TMDB response has more fields (adult, genre_ids, video, etc.) — not
// typed here since nothing reads them yet; add as later Builds need them.
export type Movie = {
  id: number;
  title: string;
  poster_path: string | null;
  vote_average: number;
  release_date: string;
};

export type PopularMoviesResult = {
  results: Movie[];
  page: number;
  total_pages: number;
  /** Required TMDB attribution string — render verbatim wherever this data shows (DESIGN.md §6). */
  attribution: string;
};
