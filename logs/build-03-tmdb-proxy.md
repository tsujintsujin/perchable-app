# Build 3 — TMDB proxy Edge Function (Module 1: Foundation)

- Base SHA: a6d1353
- Branch: module/foundation
- Done means (PLAN.md): a Supabase Edge Function calls TMDB `/movie/popular` server-side and returns JSON to the app; the TMDB key never appears in the app bundle; the response includes the required TMDB attribution string.

## Phase log
- Phase 0 — skipped (no UI design; debug screen only).
- Phase 1–2 — Bella: done.
- Manager review round 1 — Bug 1 (key leak) found and fixed (see below).
- Ruby review, confirmed by Manager — Bug 2 (unvalidated page param) found and fixed (see below).
- Deploy blocker (Manager, 2026-09-25): Supabase CLI has no access token; creating one via the dashboard was blocked by the permission system → waiting on Justin. Everything below is built and locally verified; nothing is deployed.

## Build 3 · Bug 1 — network-error catch could leak the TMDB key

**Cause:** the `catch (err)` around `fetch(tmdbUrl)` in
`supabase/functions/tmdb/index.ts` returned
`` `TMDB request failed: ${err.message}` `` straight to the client. Deno's
fetch throws network errors (DNS/TLS/connection failures) whose `message`
commonly embeds the full failed request URL — e.g. `error sending request
for url (https://api.themoviedb.org/3/movie/popular?api_key=XXXX&page=1)`
— and that URL contains `api_key`. A DNS/TLS/network hiccup (not a bad key,
just a bad connection) would have sent the real TMDB key straight to
whoever made the request.

**Fix:** the catch block now returns a fixed, keyless message
(`"TMDB request failed (network)"`, still 502) to the caller, and
`console.error`s a redacted version instead
(`message.replaceAll(apiKey, "***")`) so the actual failure detail only
ever lands in the function's own logs, never the HTTP response. Checked the
other two error paths in the same file for the same pattern: the
misconfiguration branch (`!apiKey`) never touches the key at all, and the
TMDB-non-2xx branch only forwards `body.status_message` (TMDB's own error
text, confirmed in Verification not to echo request URLs) — neither needed
a change.

**Files touched outside scope:** none — the fix is entirely inside
`supabase/functions/tmdb/index.ts`, the file this Bug was reported against.

**Reverified:** replayed the fixed catch block in a throwaway Node script
(scratchpad, deleted after) against a simulated Deno network-error message
containing the real key (read from `.env`, never printed):
```
client-facing response: {"error":"TMDB request failed (network)"}
response contains key: CLEAN
redacted log line: error sending request for url (https://api.themoviedb.org/3/movie/popular?api_key=***&page=1)
redacted log contains key: CLEAN
```
`npx tsc --noEmit` and `npx expo lint` rerun clean after the fix.

## Build 3 · Bug 2 — `page` forwarded to TMDB unvalidated

**Cause:** `supabase/functions/tmdb/index.ts` read `page` straight off the
query string and interpolated it into the TMDB URL with no checks —
`page=abc`, `page=-1`, or a huge page number all reached TMDB as-is, coming
back as whatever unclear error TMDB happened to return for that input
rather than a clean 400 from this function.

**Fix:** `page` is now parsed with `Number(...)` and validated as an
integer in `[1, 500]` before being used; anything outside that returns this
function's own `400 { error: "Invalid page" }` without ever calling TMDB.
Absent `page` still defaults to `1` (unchanged — the default is applied via
`?? "1"` before validation runs, so it passes through as a valid case, not
a special-cased skip).

**Upper bound confirmed against the live TMDB API, not assumed:** called
`/movie/popular` directly with the real key at `page=500` (200 OK, 20
results) and `page=501` (TMDB's own 400: `"Invalid page: Pages start at 1
and max at 500. They are expected to be an integer."`) — 500 is genuinely
TMDB's cap for this endpoint, confirmed empirically rather than from a
half-remembered docs figure.

**Files touched outside scope:** none — contained to
`supabase/functions/tmdb/index.ts`, the file this Bug was reported against.

**Reverified:** replayed the exact validation branch in a throwaway Node
script (scratchpad, deleted after) against `"abc"`, `"-1"`, `"0"`, `"501"`,
`"1.5"`, `""`, `"1"`, `"500"`, `"50"`, and the absent-defaults-to-`"1"`
case — every out-of-range/non-integer input returned the 400 `Invalid
page` shape, every valid input passed through unchanged. `npx tsc --noEmit`
and `npx expo lint` rerun clean after the fix.

## What was built

**`supabase/`** — ran `npx supabase init` (non-interactive, default flags) to
scaffold the project: `supabase/config.toml` (default local-dev config,
untouched — `[functions]`/`verify_jwt` left at its default `true`, so no
`[functions.tmdb]` override block exists) and `supabase/.gitignore`.

**`supabase/functions/tmdb/index.ts`** — the proxy itself (Deno, one file).
Reads `TMDB_API_KEY` from `Deno.env`, whitelists exactly one operation
(`?endpoint=popular`, `page` passthrough) and rejects anything else with
400 before it ever reaches TMDB. Calls
`https://api.themoviedb.org/3/movie/popular?api_key=...&page=...` and
reshapes the response to `{ results, page, total_pages, attribution }` —
`attribution` is the exact TMDB-required sentence (DESIGN.md §6), attached
server-side so every caller gets it for free instead of each screen having
to remember to render it correctly. TMDB error responses are passed through
by status + `status_message` only — never the request URL, which is the one
place the key could otherwise leak into a log or error body. CORS headers
are open (`*`) since this is a public-ish read endpoint behind Supabase's
own JWT/apikey gate, not a second auth layer.

**Auth the app sends:** nothing extra — `supabase.functions.invoke()` (used
by the app-side call below) automatically attaches the client's `apikey`
header from `createClient()`. `verify_jwt` defaults to `true` in
`supabase/config.toml` (no override added), so Supabase rejects the request
before this function's code even runs if that header is missing/invalid.

**`src/modules/movies/`** — the movie-domain module (DESIGN.md §4):
- `types.ts` — `Movie` (trimmed TMDB fields; only what's used so far) and
  `PopularMoviesResult`.
- `api/getPopularMovies.ts` — the module's only Supabase touchpoint, per the
  module contract. Calls `supabase.functions.invoke('tmdb?endpoint=popular&page=N', { method: 'GET' })`
  and returns the typed result.
- `index.ts` — re-exports `getPopularMovies` + types. No `hooks/` or
  `components/` folders yet — nothing to put in them this Build (see
  decisions below).

**`src/app/debug.tsx`** — added a second section below the existing
Supabase ping UI: a "Fetch popular movies" button, loading spinner, error
text, and on success the first 5 titles plus the attribution string
rendered underneath — proving the whole round trip (app → Edge Function →
TMDB → back) without needing a real screen yet (Build 4+ onward is where
movie browsing gets a real UI; this is scaffolding-free verification only).

**`tsconfig.json`** — added `"exclude": ["node_modules", "supabase/functions"]`.

## Why this way

- **No TanStack Query hook this Build.** The brief said "only if cheap to
  add now." `@tanstack/react-query` isn't in `package.json` yet — PLAN.md
  Build 12 ("Account deletion completion") isn't where it's introduced
  either; RESEARCH.md/DESIGN.md name TanStack Query as the eventual data
  layer but no earlier Build has installed it. Adding a new dependency for
  one debug-screen fetch isn't cheap, it's the first instance of a pattern
  every later movies/collection/social Build will also need — better
  decided once, deliberately, when the first real data screen is built
  (quick-add/search, Module 5–6), not smuggled in here. `getPopularMovies`
  is called directly with plain `useState`/`try-catch` in `debug.tsx` for
  now, same shape Build 2's Supabase ping already used.
- **`endpoint`/`page` as query params on the invoke path, not a POST body.**
  `supabase-js`'s `functions.invoke(name, options)` builds the request URL
  as `${functionsUrl}/${name}` — passing `` `tmdb?endpoint=popular&page=${page}` ``
  as `name` puts the query string on that URL intact (confirmed by reading
  `@supabase/functions-js`'s `FunctionsClient.invoke` source in
  `node_modules`). The function then reads `req.url`'s `searchParams`
  exactly like any other HTTP handler — no special-casing needed, and GET
  matches the read-only, cacheable nature of the call (`method: 'GET'`
  passed explicitly since `invoke` defaults to POST).
- ⚠️ **Big decision: whitelist by `endpoint` param, not open passthrough.**
  RESEARCH.md's "call TMDB through your own backend" reasoning is about
  keeping the key server-side, but a proxy that blindly forwards any TMDB
  path is still a bigger attack surface than this Build needs (someone
  could hammer arbitrary TMDB endpoints through your quota using your
  Supabase project as a free relay). `popular` is the only endpoint any
  current PLAN.md Build needs; adding `search`/`details` later (Module 4/6)
  means adding another `if` branch here, not redesigning the function.
- **Attribution built into the function's response, not left to the
  client to construct.** DESIGN.md §6 requires the exact sentence,
  verbatim. Returning it as a field means every screen that renders TMDB
  data gets the correct string by just reading `result.attribution` —
  no route can typo or paraphrase it, and Ruby/Queenie can verify it from
  one place (this file) instead of every screen that calls TMDB data.
- **`tsconfig.json` excludes `supabase/functions/`.** Deno edge functions
  run in Deno's runtime (`Deno.serve`, `Deno.env` — no such globals in
  Node/Metro's TypeScript project), and Supabase's own tooling type-checks
  them separately (via the Deno LSP/`deno check`, not this project's `tsc`).
  Including them in the main `tsconfig.json` would require adding
  `@types/deno` or similar to the whole app just to satisfy one folder that
  isn't part of the app bundle at all — excluding it is the correct
  boundary, not a workaround. Deno syntax was still verified by direct
  logic-replay (see Verification below), so correctness isn't just assumed.

## Concepts learned
- **A Supabase Edge Function is a per-request Deno process, not a
  long-running server.** `Deno.serve(async (req) => ...)` is the entire
  contract — no app framework, no persistent state between requests (any
  caching would need an external store, not a module-level variable).
- **`EXPO_PUBLIC_*` vs. plain env vars is the same client/server boundary
  Build 2 already used, just on the other side.** The app's Supabase URL/key
  are `EXPO_PUBLIC_*` (meant to be public, inlined into the bundle); TMDB's
  key is deliberately *not* prefixed and lives only in
  `supabase/functions/.env` / Supabase's function secrets — it never
  crosses into Metro's bundling step at all, which is why the bundle-grep
  check below is a formality, not a real risk in this design, but worth
  proving anyway since Queenie/Ruby check it.
- **`supabase.functions.invoke()` builds its request URL from
  `functionName` verbatim**, including any query string appended to it —
  worth knowing before reaching for a `params` option that doesn't exist
  on this client.

## Verification (no deploy — CLI has no access token, see blocker above)

Tried in the preferred order from the brief:
- **(a) `npx supabase functions serve`** — requires Docker; `docker info`
  confirmed the Docker daemon is not running (Docker Desktop was not
  started, per the rule against starting it myself). Not usable.
- **(b) Deno directly** — `deno --version` → not installed on this machine.
  Not usable.
- **(c) Used — logic replay via a Node script.** Wrote a temporary script
  (scratchpad, deleted after) that reads the real key from
  `supabase/functions/.env`, then runs the exact same three code paths the
  Edge Function runs: the endpoint whitelist check, the real
  `/movie/popular` call reshaped into `{results, page, total_pages,
  attribution}`, and a deliberately-bad-key call to confirm the error path
  surfaces TMDB's message without leaking the URL/key. This exercises the
  same TMDB HTTP call and response-shaping logic the Deno function contains
  — the only thing not exercised is Deno's own `Deno.serve` HTTP
  plumbing/CORS layer, which is framework boilerplate, not app logic.

**Actual output (real TMDB call, page 1):**
```
TEST 1 (endpoint whitelist): PASS -> would return 400 Unsupported endpoint.
TEST 2 (popular call + reshape): PASS
page: 1 total_pages: 1001 results_count: 20
attribution: This application uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.
first 5 titles:
 - Spider-Man: Brand New Day
 - Resident Evil
 - The End of Oak Street
 - Coyote vs. Acme
 - The Odyssey
TEST 3 (bad key): status 401 message: Invalid API key: You must be granted a valid key.
```
Confirms: real popular data returns, attribution string is exact, and a bad
key produces TMDB's own 401 message with no key/URL echoed back.

**PENDING DEPLOY** — the app-on-emulator check (tapping "Fetch popular
movies" in `debug.tsx` against the *deployed* function) cannot run until
the function is deployed, which needs the Supabase access token Justin is
providing. The `debug.tsx` UI itself is built and would work identically
once the function exists at the project's `/functions/v1/tmdb` URL — only
the deploy step is missing, not app code.

## Bundle grep — TMDB key absence proof

Ran `npx expo export --platform android --output-dir <scratchpad>/bundle-check`
(exports the Hermes bytecode bundle + assets, same output shape a real APK
ships). Grepped the entire export tree for the literal TMDB key value (read
from `supabase/functions/.env`, never printed) and separately for the
literal string `TMDB_API_KEY`:
```
KEY_NOT_FOUND_CLEAN
(0 matches for "TMDB_API_KEY" across every exported file, including the .hbc bundle)
```
Zero hits either way — the key was never referenced anywhere in app code
(`EXPO_PUBLIC_*` is the only mechanism that reaches the bundle, and this key
deliberately isn't prefixed that way), so this is a real absence, not a
lucky grep. Deleted `<scratchpad>/bundle-check` after the check — nothing
from it is committed.

## Gates
- `npx tsc --noEmit` — clean (`supabase/functions` excluded from
  `tsconfig.json`, see Why-this-way above; the Deno file's logic was
  separately verified, see Verification).
- `npx expo lint` — clean.
- Tests — none exist yet (none planned until Module 7 per PLAN.md).
- App starts — not rebuilt for this Build (no native deps added); `npx expo
  export --platform android` (used for the bundle-grep check) bundled 1297
  modules with no errors, which is the same Metro bundling step `expo
  start`/`expo run:android` depend on — sufficient proof the app still
  bundles cleanly with the new module.

## Out of scope touched
None beyond `tsconfig.json` (required for the gate to run at all with a
Deno file in the repo — see Why-this-way).

## Manager: deploy + secret commands to run once the access token exists

```
npx supabase login                          # once, with the token from Justin
npx supabase link --project-ref vpcuornksvqziqzzpiwq
npx supabase secrets set --env-file supabase/functions/.env
npx supabase functions deploy tmdb
```
After deploy, re-run the `debug.tsx` "Fetch popular movies" check on the
emulator against the real deployed function to close out the PENDING DEPLOY
item above.

## Deploy (Manager, 2026-09-25)
- Supabase CLI via `SUPABASE_ACCESS_TOKEN` (Justin created it; stored in Credentials). No `link` (avoids the DB-password prompt): `--project-ref vpcuornksvqziqzzpiwq` on each command.
- `supabase secrets set --env-file supabase/functions/.env` → secret `TMDB_API_KEY` present (name only listed).
- `supabase functions deploy tmdb --use-api` → deployed (commit 94c07e4 code).
- Live smoke test (curl, publishable key as apikey + Bearer): popular → page 1/1001, 20 results, exact attribution; `page=abc` → 400 "Invalid page"; `endpoint=search` → 400; no auth header → 401 UNAUTHORIZED_NO_AUTH_HEADER.
