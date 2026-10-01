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
  return client;
}

/** The single client, provided once in the root layout. */
export const queryClient = createQueryClient();
