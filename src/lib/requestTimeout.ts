import { supabase } from "@/lib/supabase";

/** How long any TMDB proxy call may run before it is aborted (ms). */
export const REQUEST_TIMEOUT_MS = 8000;

/** Thrown when auth-js is still starting up or refreshing a token after REQUEST_TIMEOUT_MS; nothing was sent. */
export class RequestTimeoutError extends Error {
  constructor() {
    super("Request timed out waiting for auth");
    this.name = "RequestTimeoutError";
  }
}

/** Resolves once auth-js has a session answer (the wait every supabase-js request makes before it is sent),
 * or rejects with RequestTimeoutError after REQUEST_TIMEOUT_MS. Call it first in any Supabase-backed API function. */
export function authReady(): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new RequestTimeoutError()), REQUEST_TIMEOUT_MS);
    // A getSession failure is not ours to report: the request itself will surface it.
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    supabase.auth.getSession().then(done, done);
  });
}
