import { MovieApiError } from "./MovieApiError";
import type { CastMember, Genre, MovieDetailsResult } from "../types";

// True for a plain (non-array) object.
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// A string, or null when the value is not one.
const text = (value: unknown): string | null => (typeof value === "string" ? value : null);

// A finite number, or null when the value is not one.
const num = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);

/** Checks the proxy's details body and turns it into typed data (absent fields become null); throws a `shape` error when the movie or its lists are unusable. */
export function parseDetails(data: unknown): MovieDetailsResult {
  const movie = isObject(data) ? data.movie : undefined;
  if (!isObject(movie) || typeof movie.id !== "number" || typeof movie.title !== "string") {
    throw new MovieApiError("shape");
  }
  if (!Array.isArray(movie.cast) || !Array.isArray(movie.genres)) throw new MovieApiError("shape");

  // Entries without an id and a name cannot be shown, so they are dropped rather than failing the whole screen.
  const genres: Genre[] = [];
  for (const genre of movie.genres) {
    if (isObject(genre) && typeof genre.id === "number" && typeof genre.name === "string") {
      genres.push({ id: genre.id, name: genre.name });
    }
  }
  const cast: CastMember[] = [];
  for (const person of movie.cast) {
    if (isObject(person) && typeof person.id === "number" && typeof person.name === "string") {
      cast.push({ id: person.id, name: person.name, character: text(person.character), profile_path: text(person.profile_path) });
    }
  }

  return {
    movie: {
      id: movie.id,
      title: movie.title,
      tagline: text(movie.tagline),
      overview: text(movie.overview),
      poster_path: text(movie.poster_path),
      backdrop_path: text(movie.backdrop_path),
      release_date: text(movie.release_date),
      runtime: num(movie.runtime),
      vote_average: num(movie.vote_average),
      vote_count: num(movie.vote_count),
      genres,
      cast,
    },
    attribution: text((data as Record<string, unknown>).attribution) ?? "",
  };
}
