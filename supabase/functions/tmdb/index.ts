// Server-side TMDB proxy: the app never gets the real TMDB key. Only
// `/movie/popular` and `/movie/{id}` are proxied; the logic lives in ../_shared/tmdb.ts.
import { handleTmdb } from "../_shared/tmdb.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

// Answers CORS preflight, otherwise runs the proxy and sends its result as JSON.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  const params = new URL(req.url).searchParams;
  const result = await handleTmdb({
    endpoint: params.get("endpoint"),
    page: params.get("page"),
    id: params.get("id"),
    apiKey: Deno.env.get("TMDB_API_KEY"),
    fetchUpstream: (url) => fetch(url),
    logError: (message) => console.error(message),
  });

  const headers: Record<string, string> = { "Content-Type": "application/json", ...CORS_HEADERS };
  if (result.cacheControl) headers["Cache-Control"] = result.cacheControl;
  return new Response(JSON.stringify(result.body), { status: result.status, headers });
});
