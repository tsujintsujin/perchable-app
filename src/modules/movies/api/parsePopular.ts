import { MovieApiError } from "./MovieApiError";
import type { PopularMoviesResult } from "../types";

// True for a plain (non-array) object.
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Checks the proxy's popular page has the shape the app reads; throws a `shape` error when it does not. */
export function parsePopular(data: unknown): PopularMoviesResult {
  if (!isObject(data) || !Array.isArray(data.results)) throw new MovieApiError("shape");
  const valid = data.results.every(
    (movie) => isObject(movie) && typeof movie.id === "number" && typeof movie.title === "string",
  );
  if (!valid || typeof data.page !== "number" || typeof data.total_pages !== "number") {
    throw new MovieApiError("shape");
  }
  return data as PopularMoviesResult;
}
