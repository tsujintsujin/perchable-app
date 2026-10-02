import { useQuery } from "@tanstack/react-query";
import { getMovieDetails, parseMovieIdParam } from "../api/getMovieDetails";
import { MovieApiError } from "../api/MovieApiError";
import type { MovieDetails } from "../types";

export type DetailsState = "loading" | "loaded" | "error" | "notFound";

type Details = {
  state: DetailsState;
  movie: MovieDetails | undefined;
  /** Changes each time a refetch fails while a movie is already on screen; null otherwise. */
  refetchErrorAt: number | null;
  retry: () => void;
};

/** One movie's details for the route's `id` param: the screen state, the data, and Retry. An invalid id is "notFound" and makes no request. */
export function useMovieDetails(idParam: string | undefined): Details {
  const id = parseMovieIdParam(idParam);
  const query = useQuery({
    // Keyed by the numeric id, so a different movie never shows another's data.
    queryKey: ["movies", "details", id],
    queryFn: ({ signal }) => getMovieDetails(id as number, signal),
    enabled: id !== null,
    select: (result) => result.movie,
  });

  let state: DetailsState = "loading";
  if (id === null) state = "notFound";
  else if (query.data) state = "loaded";
  else if (query.status === "error") {
    const missing = query.error instanceof MovieApiError && query.error.kind === "http" && query.error.status === 404;
    state = missing ? "notFound" : "error";
  }

  return {
    state,
    movie: query.data,
    // Data stays on screen when a refetch fails; the screen only tells the user.
    refetchErrorAt: query.data && query.isRefetchError ? query.errorUpdatedAt : null,
    retry: () => void query.refetch({ cancelRefetch: false }),
  };
}
