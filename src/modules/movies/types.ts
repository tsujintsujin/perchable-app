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

export type Genre = { id: number; name: string };

export type CastMember = {
  id: number;
  name: string;
  character: string | null;
  profile_path: string | null;
};

/** TMDB movie details, trimmed by the proxy; every optional field is null when TMDB has no value. */
export type MovieDetails = {
  id: number;
  title: string;
  tagline: string | null;
  overview: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string | null;
  runtime: number | null;
  vote_average: number | null;
  vote_count: number | null;
  genres: Genre[];
  cast: CastMember[];
};

export type MovieDetailsResult = {
  movie: MovieDetails;
  /** Required TMDB attribution string. */
  attribution: string;
};
