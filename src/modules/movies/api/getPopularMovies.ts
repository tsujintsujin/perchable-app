import { supabase } from "@/lib/supabase";
import { REQUEST_TIMEOUT_MS } from "@/lib/requestTimeout";
import { toMovieApiError } from "./MovieApiError";
import { parsePopular } from "./parsePopular";
import type { PopularMoviesResult } from "../types";

/** Calls the `tmdb` Edge Function so the TMDB key never reaches the bundle; throws MovieApiError on failure. */
export async function getPopularMovies(page = 1, signal?: AbortSignal): Promise<PopularMoviesResult> {
  const { data, error } = await supabase.functions.invoke<unknown>(`tmdb?endpoint=popular&page=${page}`, {
    method: "GET",
    timeout: REQUEST_TIMEOUT_MS,
    signal,
  });
  if (error) throw await toMovieApiError(error, signal);
  return parsePopular(data);
}
