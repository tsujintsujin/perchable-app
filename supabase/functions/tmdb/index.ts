// Server-side TMDB proxy — the app never gets the real TMDB key. Only
// `/movie/popular` is proxied; anything else is rejected with 400 rather
// than passed through blind.

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
  const pageParam = url.searchParams.get("page") ?? "1";

  if (endpoint !== "popular") {
    return json({ error: "Unsupported endpoint. Only 'popular' is allowed." }, 400);
  }

  // TMDB caps pages at 500 — validate here so a bad/huge/non-numeric page
  // never reaches TMDB as an unclear upstream error.
  const page = Number(pageParam);
  if (!Number.isInteger(page) || page < 1 || page > 500) {
    return json({ error: "Invalid page" }, 400);
  }

  const apiKey = Deno.env.get("TMDB_API_KEY");
  if (!apiKey) {
    // Never echo the key itself — just that it's missing.
    return json({ error: "Server misconfiguration: TMDB_API_KEY not set." }, 500);
  }

  const tmdbUrl = `${TMDB_BASE}/movie/popular?api_key=${apiKey}&page=${page}`;

  let tmdbRes: Response;
  try {
    tmdbRes = await fetch(tmdbUrl);
  } catch (err) {
    // Network errors can embed the request URL (with api_key) in the
    // message — redact before logging, and never put it in the response.
    const message = err instanceof Error ? err.message : String(err);
    console.error("TMDB fetch failed:", message.replaceAll(apiKey, "***"));
    return json({ error: "TMDB request failed (network)" }, 502);
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
