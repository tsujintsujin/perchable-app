import { QueryCache, QueryClient } from "@tanstack/react-query";
import { Sentry } from "@/lib/sentry";
import { isRetryableMovieError, MovieApiError, shouldReportMovieError } from "@/modules/movies/api/MovieApiError";

const MINUTE_MS = 60 * 1000;
const RETRY_DELAY_MS = 1000;

/** Builds the app's QueryClient; a function so tests get an isolated one. */
export function createQueryClient() {
  const client = new QueryClient({
    // The one place query failures reach Sentry: once per failed query, unexpected ones only.
    queryCache: new QueryCache({
      onError: (error) => {
        if (!shouldReportMovieError(error)) return;
        const tags = error instanceof MovieApiError ? { kind: error.kind, status: error.status, code: error.code } : {};
        Sentry.captureException(error, { tags });
      },
    }),
    defaultOptions: {
      queries: {
        gcTime: 30 * MINUTE_MS,
        retry: (failureCount, error) => failureCount < 1 && isRetryableMovieError(error),
        retryDelay: RETRY_DELAY_MS,
        refetchOnWindowFocus: false,
      },
    },
  });
  // The Popular list is session-long: fresh for 5 minutes and only a pull refreshes it.
  client.setQueryDefaults(["movies", "popular"], { staleTime: 5 * MINUTE_MS, refetchOnMount: false });
  // The Quick Add deck keeps its pages 30 minutes; a failed page is retried by the user (a retry would restart the page loop), and a
  // reconnect or focus never reorders or reloads what the user is swiping through.
  client.setQueryDefaults(["movies", "deck"], {
    staleTime: 30 * MINUTE_MS,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    retry: 0,
  });
  // A movie's details change slowly: fresh for 30 minutes.
  client.setQueryDefaults(["movies", "details"], { staleTime: 30 * MINUTE_MS });
  return client;
}

/** The single client, provided once in the root layout. */
export const queryClient = createQueryClient();
