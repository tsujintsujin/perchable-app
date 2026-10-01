// Pure TMDB proxy logic: no Deno globals and no imports, so Jest and a
// dedicated tsc target (supabase/functions/tsconfig.json) can check it.

export const TMDB_BASE = "https://api.themoviedb.org/3";

export const TMDB_ATTRIBUTION =
  "This application uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.";

/** TMDB serves at most this many pages of any list. */
export const MAX_PAGE = 500;

/** Lets anything upstream of the function cache a popular page briefly. */
export const POPULAR_CACHE_CONTROL = "public, max-age=300";

/** The slice of a fetch Response the proxy reads, so no DOM types are needed. */
export type UpstreamResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

export type ProxyResult = {
  status: number;
  body: unknown;
  /** Set only on success. */
  cacheControl?: string;
};

type ProxyDeps = {
  endpoint: string | null;
  /** Raw `page` query value; null when the parameter is absent. */
  page: string | null;
  apiKey: string | undefined;
  fetchUpstream: (url: string) => Promise<UpstreamResponse>;
  logError: (message: string) => void;
};

/** Fixed-text error body: never TMDB's message, the request URL or the key. */
function failure(status: number, code: string, error: string): ProxyResult {
  return { status, body: { error, code } };
}

/** Returns the page number for a digits-only value in 1..MAX_PAGE (absent means 1), else null. */
export function parsePage(raw: string | null): number | null {
  const value = raw ?? "1";
  if (!/^\d+$/.test(value)) return null;
  const page = Number(value);
  return page >= 1 && page <= MAX_PAGE ? page : null;
}

/** Maps a non-2xx TMDB status to the proxy's own status and code. */
export function mapUpstreamStatus(status: number): ProxyResult {
  if (status === 401 || status === 403) {
    return failure(502, "upstream_auth", "Movie service authentication failed");
  }
  if (status === 404) return failure(404, "not_found", "Not found");
  if (status === 429) return failure(429, "rate_limited", "Too many requests");
  return failure(502, "upstream_error", "Movie service error");
}

/** Replaces every occurrence of the key in a log line. */
export function redactKey(message: string, apiKey: string): string {
  return message.split(apiKey).join("***");
}

type RawMovie = {
  id?: unknown;
  title?: unknown;
  poster_path?: unknown;
  vote_average?: unknown;
  release_date?: unknown;
  adult?: unknown;
};

/** Drops adult titles and keeps only the fields the app reads. */
export function shapeMovies(results: RawMovie[]) {
  return results
    .filter((movie) => movie.adult !== true)
    .map(({ id, title, poster_path, vote_average, release_date }) => ({
      id,
      title,
      poster_path,
      vote_average,
      release_date,
    }));
}

/** Validates the request, calls TMDB `/movie/popular` and returns the status, body and cache header to send. */
export async function handlePopular(deps: ProxyDeps): Promise<ProxyResult> {
  if (deps.endpoint !== "popular") {
    return failure(400, "invalid_endpoint", "Unsupported endpoint");
  }
  const page = parsePage(deps.page);
  if (page === null) return failure(400, "invalid_page", "Invalid page");
  if (!deps.apiKey) {
    return failure(500, "misconfigured", "Server misconfiguration");
  }

  let res: UpstreamResponse;
  try {
    res = await deps.fetchUpstream(`${TMDB_BASE}/movie/popular?api_key=${deps.apiKey}&page=${page}`);
  } catch (err) {
    // Network errors can embed the request URL, key included: log it redacted, never return it.
    const message = err instanceof Error ? err.message : String(err);
    deps.logError(`TMDB fetch failed: ${redactKey(message, deps.apiKey)}`);
    return failure(502, "upstream_network", "Movie service unreachable");
  }

  if (!res.ok) return mapUpstreamStatus(res.status);

  const body = (await res.json().catch(() => null)) as {
    results?: unknown;
    page?: unknown;
    total_pages?: unknown;
  } | null;
  if (!body || !Array.isArray(body.results)) {
    return failure(502, "upstream_error", "Movie service error");
  }

  return {
    status: 200,
    cacheControl: POPULAR_CACHE_CONTROL,
    body: {
      results: shapeMovies(body.results as RawMovie[]),
      page: body.page,
      total_pages: body.total_pages,
      attribution: TMDB_ATTRIBUTION,
    },
  };
}
