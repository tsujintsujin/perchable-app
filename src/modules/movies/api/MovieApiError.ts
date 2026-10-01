import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from "@supabase/supabase-js";

export type MovieApiErrorKind = "timeout" | "network" | "http" | "shape";

/** A failed movie request, carrying only what retry and Sentry decisions read. */
export class MovieApiError extends Error {
  readonly kind: MovieApiErrorKind;
  /** HTTP status; only for `http`. */
  readonly status?: number;
  /** The proxy's own error code, when its body had one. */
  readonly code?: string;

  constructor(kind: MovieApiErrorKind, details: { status?: number; code?: string } = {}) {
    super(`Movie request failed: ${kind}${details.status ? ` ${details.status}` : ""}${details.code ? ` ${details.code}` : ""}`);
    this.name = "MovieApiError";
    this.kind = kind;
    this.status = details.status;
    this.code = details.code;
  }
}

// Reads the proxy's `code` from an error response body; undefined when there is none.
async function readCode(response: { json: () => Promise<unknown> }): Promise<string | undefined> {
  try {
    const body = await response.json();
    const code = (body as { code?: unknown } | null)?.code;
    return typeof code === "string" ? code : undefined;
  } catch {
    return undefined;
  }
}

/** Turns what `functions.invoke` returned as `error` into a MovieApiError; anything unrecognised is returned unchanged. */
export async function toMovieApiError(error: unknown, signal?: AbortSignal): Promise<Error> {
  if (error instanceof FunctionsHttpError) {
    return new MovieApiError("http", { status: error.context?.status, code: await readCode(error.context) });
  }
  if (error instanceof FunctionsRelayError) return new MovieApiError("http", { status: 502 });
  if (error instanceof FunctionsFetchError) {
    // An abort we did not ask for is the request timeout.
    const aborted = error.context?.name === "AbortError" && !signal?.aborted;
    return new MovieApiError(aborted ? "timeout" : "network");
  }
  return error instanceof Error ? error : new Error(String(error));
}

/** Retry once for a timeout, a network failure or a 5xx; never for a 4xx, a bad shape or anything unexpected. */
export function isRetryableMovieError(error: unknown): boolean {
  if (!(error instanceof MovieApiError)) return false;
  if (error.kind === "timeout" || error.kind === "network") return true;
  return error.kind === "http" && (error.status ?? 0) >= 500;
}

/** Only faults we must act on go to Sentry: a 5xx carrying a proxy code (other than a plain upstream network hiccup), a bad shape, anything unexpected. */
export function shouldReportMovieError(error: unknown): boolean {
  if (!(error instanceof MovieApiError)) return true;
  if (error.kind === "shape") return true;
  if (error.kind !== "http") return false;
  return (error.status ?? 0) >= 500 && !!error.code && error.code !== "upstream_network";
}
