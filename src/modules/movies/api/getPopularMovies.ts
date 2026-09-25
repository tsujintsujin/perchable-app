import { supabase } from "@/lib/supabase";
import type { PopularMoviesResult } from "../types";

/** Calls the `tmdb` Edge Function (server-side TMDB proxy — the app never
 * talks to TMDB directly, so the TMDB key never reaches the bundle).
 * `endpoint`/`page` are query params on the function path, since the
 * function reads them from the request URL, not a POST body. */
export async function getPopularMovies(page = 1): Promise<PopularMoviesResult> {
  const { data, error } = await supabase.functions.invoke<PopularMoviesResult>(
    `tmdb?endpoint=popular&page=${page}`,
    { method: "GET" },
  );

  if (error || !data) {
    throw new Error(error?.message ?? "TMDB proxy request failed");
  }
  return data;
}
