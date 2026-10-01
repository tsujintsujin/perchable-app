# Build 12a — Home poster grid, first page (Module 4: Movie browse/details)

Base SHA: 257330b (2026-10-01, branch `module/movie-browse` from main)
Plan: PLAN.md "Build 12a" A1–A7, B1–B9 + Module 4 decisions M1–M10 (Priya 5c5981c, revised
f7b0498 + 1f8af87 after two Ruby reviews). NEEDS JUSTIN N1–N7: defaults apply (Justin away,
asked that work continue). Phase 0: Dianne (DESIGN.md "Build 12").

## Failure-mode list (Manager, before Phase 1) — each is a Done-means line + a test
PLAN.md's 12a failure modes apply in full. Manager additions / emphasis:
1. **Server first, app second** — the hardened `popular` function (`_shared/tmdb.ts` + index.ts)
   is its own commit; Ruby reviews it; the **Manager deploys and curls** (no auth → 401; page
   `1e2`, `0`, `501`, `%205` → 400; valid page → 200 with `Cache-Control`; no key text in any
   error) before Queenie runs. Bella never deploys.
2. **Debug button unchanged** — `getPopularMovies(page = 1, signal?)` stays call-compatible;
   the Build-3 "FETCH POPULAR MOVIES" button still works (Queenie regression).
3. **No infinite spinner, ever** — every path ends in filled / empty / error within ~17 s;
   offline cold start shows loading then the error state with Retry.
4. **Sentry** — only `upstream_auth`, `misconfigured`, unexpected 5xx-with-code and `shape`;
   never offline / timeout / 4xx / unmapped relay 502. Environment tag on.
5. **Sign-out while loading** — no setState after unmount, no error flash on the sign-in screen.
6. **Images** — poster null → fallback; poster URL 404 → same fallback; `recyclingKey` set.
7. **Native rebuild check** — `npx expo install --check` + the installed packages' native
   folders: if any new native code appears, STOP and report — the Manager rebuilds the dev
   client before QA (Gradle recipe in LESSONS; one run at a time).
8. **Not tappable in 12a** — posters have no press state and no navigation (DESIGN §7: no
   silent no-op); taps do nothing visible because there's no affordance.
9. **Standards** — tokens only, no `fontWeight` with custom fonts, 1–2 line comments, logic in
   `src/modules/movies/`, route files compose only; fix the Ruby formatter nits from 10b
   (SheetShell.tsx:45-49 indentation) only if touched.
10. **Emulator** — restart td_emu before device work (CLAUDE.md "Emulator setup + health");
    screenshots are 1.75 px/dp.
