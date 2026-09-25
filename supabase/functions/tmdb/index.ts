// Supabase Edge Function: server-side TMDB proxy.
//
// Why this exists (RESEARCH.md §1, PLAN.md Build 3): TMDB's API key must
// never ship in the app bundle. The app calls this function instead of
// TMDB directly; this function holds the real key (`TMDB_API_KEY`, set via
// `supabase secrets set` in production, or `supabase/functions/.env`
// locally — gitignored) and forwards only what's needed.
//
// Endpoint whitelist: only `/movie/popular` for now (all PLAN.md Build 3
// needs). Any other `endpoint` value is rejected with 400 rather than
// proxied blind — this function is not a general TMDB passthrough.
//
// Auth: Supabase verifies the caller's JWT/apikey before this code runs
// (`verify_jwt` defaults to true, left at default in supabase/config.toml
// — no per-function override). The app sends its Supabase anon key via
// `supabase.functions.invoke()`, which attaches it automatically.

const TMDB_BASE = "https://api.themoviedb.org/3";

const TMDB_ATTRIBUTION =
  "This application uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const url = new URL(req.url);
  const endpoint = url.searchParams.get("endpoint");
  const page = url.searchParams.get("page") ?? "1";

  if (endpoint !== "popular") {
    return json({ error: "Unsupported endpoint. Only 'popular' is allowed." }, 400);
  }

  const apiKey = Deno.env.get("TMDB_API_KEY");
  if (!apiKey) {
    // Never echo the key itself — just that it's missing.
    return json({ error: "Server misconfiguration: TMDB_API_KEY not set." }, 500);
  }

  const tmdbUrl = `${TMDB_BASE}/movie/popular?api_key=${apiKey}&page=${encodeURIComponent(page)}`;

  let tmdbRes: Response;
  try {
    tmdbRes = await fetch(tmdbUrl);
  } catch (err) {
    return json({ error: `TMDB request failed: ${err instanceof Error ? err.message : String(err)}` }, 502);
  }

  const body = await tmdbRes.json().catch(() => null);

  if (!tmdbRes.ok || !body) {
    // TMDB error bodies are `{status_code, status_message}` — pass the
    // message through, never the request URL (which contains the key).
    return json(
      { error: body?.status_message ?? `TMDB request failed with status ${tmdbRes.status}` },
      tmdbRes.status || 502,
    );
  }

  return json({
    results: body.results,
    page: body.page,
    total_pages: body.total_pages,
    attribution: TMDB_ATTRIBUTION,
  });
});
