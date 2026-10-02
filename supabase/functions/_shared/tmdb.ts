// Pure TMDB proxy logic: no Deno globals and no imports, so Jest and a
// dedicated tsc target (supabase/functions/tsconfig.json) can check it.

export const TMDB_BASE = "https://api.themoviedb.org/3";

export const TMDB_ATTRIBUTION =
  "This application uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.";

/** TMDB serves at most this many pages of any list. */
export const MAX_PAGE = 500;

/** Lets anything upstream of the function cache a popular page briefly. */
export const POPULAR_CACHE_CONTROL = "public, max-age=300";

/** Same short cache for a movie's details. */
export const DETAILS_CACHE_CONTROL = POPULAR_CACHE_CONTROL;

/** Largest id the app accepts (a signed 32-bit integer). */
export const MAX_MOVIE_ID = 2147483647;

/** The details answer carries at most this many cast members, in TMDB's order. */
export const CAST_LIMIT = 15;

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
  /** Raw `id` query value (details); null or omitted when the parameter is absent. */
  id?: string | null;
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

/** Returns the movie id for a digits-only value in 1..MAX_MOVIE_ID, else null (an absent id is invalid). */
export function parseMovieId(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined || !/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return id >= 1 && id <= MAX_MOVIE_ID ? id : null;
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

/** Drops non-object items and adult titles, and keeps only the fields the app reads. */
export function shapeMovies(results: unknown[]) {
  return (results.filter((movie) => typeof movie === "object" && movie !== null) as RawMovie[])
    .filter((movie) => movie.adult !== true)
    .map(({ id, title, poster_path, vote_average, release_date }) => ({
      id,
      title,
      poster_path,
      vote_average,
      release_date,
    }));
}

type UpstreamOutcome = { body: unknown; failed?: undefined } | { failed: ProxyResult };

/** Calls TMDB and returns its parsed JSON body, or the proxy failure to send instead (network, non-2xx, unreadable). */
async function callTmdb(deps: ProxyDeps, apiKey: string, path: string): Promise<UpstreamOutcome> {
  let res: UpstreamResponse;
  try {
    res = await deps.fetchUpstream(`${TMDB_BASE}${path}${path.includes("?") ? "&" : "?"}api_key=${apiKey}`);
  } catch (err) {
    // Network errors can embed the request URL, key included: log it redacted, never return it.
    const message = err instanceof Error ? err.message : String(err);
    deps.logError(`TMDB fetch failed: ${redactKey(message, apiKey)}`);
    return { failed: failure(502, "upstream_network", "Movie service unreachable") };
  }
  if (!res.ok) return { failed: mapUpstreamStatus(res.status) };
  const body = await res.json().catch(() => null);
  if (typeof body !== "object" || body === null) {
    return { failed: failure(502, "upstream_error", "Movie service error") };
  }
  return { body };
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

  const outcome = await callTmdb(deps, deps.apiKey, `/movie/popular?page=${page}`);
  if (outcome.failed) return outcome.failed;
  const body = outcome.body as { results?: unknown; page?: unknown; total_pages?: unknown };
  if (!Array.isArray(body.results)) return failure(502, "upstream_error", "Movie service error");

  return {
    status: 200,
    cacheControl: POPULAR_CACHE_CONTROL,
    body: {
      results: shapeMovies(body.results),
      page: body.page,
      total_pages: body.total_pages,
      attribution: TMDB_ATTRIBUTION,
    },
  };
}

// Keeps the items that are plain objects.
const objectsOnly = (items: unknown): Record<string, unknown>[] =>
  Array.isArray(items)
    ? (items.filter((item) => typeof item === "object" && item !== null) as Record<string, unknown>[])
    : [];

/** Validates the id, asks TMDB for the movie with its credits in one call and returns the trimmed details; adult titles answer 404. */
export async function handleDetails(deps: ProxyDeps): Promise<ProxyResult> {
  if (deps.endpoint !== "details") {
    return failure(400, "invalid_endpoint", "Unsupported endpoint");
  }
  const id = parseMovieId(deps.id);
  if (id === null) return failure(400, "invalid_id", "Invalid id");
  if (!deps.apiKey) {
    return failure(500, "misconfigured", "Server misconfiguration");
  }

  const outcome = await callTmdb(deps, deps.apiKey, `/movie/${id}?append_to_response=credits`);
  if (outcome.failed) return outcome.failed;
  const movie = outcome.body as Record<string, unknown>;
  if (typeof movie.id !== "number" || typeof movie.title !== "string") {
    return failure(502, "upstream_error", "Movie service error");
  }
  if (movie.adult === true) return failure(404, "not_found", "Not found");

  const credits = movie.credits as { cast?: unknown } | null | undefined;
  return {
    status: 200,
    cacheControl: DETAILS_CACHE_CONTROL,
    body: {
      movie: {
        id: movie.id,
        title: movie.title,
        tagline: movie.tagline,
        overview: movie.overview,
        poster_path: movie.poster_path,
        backdrop_path: movie.backdrop_path,
        release_date: movie.release_date,
        runtime: movie.runtime,
        vote_average: movie.vote_average,
        vote_count: movie.vote_count,
        genres: objectsOnly(movie.genres).map(({ id: genreId, name }) => ({ id: genreId, name })),
        cast: objectsOnly(credits?.cast)
          .slice(0, CAST_LIMIT)
          .map(({ id: personId, name, character, profile_path }) => ({ id: personId, name, character, profile_path })),
      },
      attribution: TMDB_ATTRIBUTION,
    },
  };
}

/** Sends a request to the handler for its endpoint; an unknown endpoint is a 400. */
export function handleTmdb(deps: ProxyDeps): Promise<ProxyResult> {
  return deps.endpoint === "details" ? handleDetails(deps) : handlePopular(deps);
}
