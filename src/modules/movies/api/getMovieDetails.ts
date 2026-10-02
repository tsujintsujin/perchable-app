import { supabase } from "@/lib/supabase";
import { authReady, REQUEST_TIMEOUT_MS } from "@/lib/requestTimeout";
import { MovieApiError, toMovieApiError } from "./MovieApiError";
import { parseDetails } from "./parseDetails";
import type { MovieDetailsResult } from "../types";

/** Largest movie id the proxy accepts (a signed 32-bit integer). */
export const MAX_MOVIE_ID = 2147483647;

/** The numeric id for a route param made only of digits in 1..MAX_MOVIE_ID, else null. */
export function parseMovieIdParam(raw: string | undefined): number | null {
  if (raw === undefined || !/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return id >= 1 && id <= MAX_MOVIE_ID ? id : null;
}

/** Asks the `tmdb` Edge Function for one movie with its cast; throws MovieApiError on failure. */
export async function getMovieDetails(id: number, signal?: AbortSignal): Promise<MovieDetailsResult> {
  // The auth wait before the request is timed too; a timeout there is the usual movie timeout error.
  await authReady().catch(() => {
    throw new MovieApiError("timeout");
  });
  const { data, error } = await supabase.functions.invoke<unknown>(`tmdb?endpoint=details&id=${id}`, {
    method: "GET",
    timeout: REQUEST_TIMEOUT_MS,
    signal,
  });
  if (error) throw await toMovieApiError(error, signal);
  return parseDetails(data);
}
