# Perchable — Timeline

- 2026-09-24 — Phase 0: repo, empty Expo Router + TS template (SDK 57), lock hook, vision + inspo images moved into docs/. Next: Stage A — Rose research brief (run locally).
- 2026-09-24 — Stage A started on branch `stage-a/research`. Rose (local) writing docs/RESEARCH.md. ⚠️ Big decisions pending in her brief: movie data source (IMDb scraping vs licensed API) and backend.
- 2026-09-24 — RESEARCH.md checked: Jeff 4/4 claims confirmed; Ruby 5 findings + Manager 5 gaps → Rose round 1 fixed all 10; Manager re-confirmed TMDB commercial test + Supabase idle pause at source. ⚠️ Big decisions for Justin: TMDB API instead of IMDb scraping; Supabase instead of Cloudflare D1. Next: Justin reads/approves the brief → Priya.
- 2026-09-24 — Justin approved RESEARCH.md in chat. Merged stage-a/research (PR #1). Next: Priya → PLAN.md on stage-a/plan.
- 2026-09-24 — PLAN.md (Priya): 12 modules, 31 Builds. Ruby 6 findings (1 blocker: OAuth SHA-1 step before Build 1) + Manager 4 → Priya round 1 fixed all; Manager re-checked the file. Waiting: Justin types his approval line in PLAN.md (line 6).
- 2026-09-24 — Setup step 1 done by Manager in Chrome: Supabase project `perchable` (tsujin's workspace, Free, Asia-Pacific, auto-RLS on, auto-expose off); URL + publishable key in Credentials/perchable/.env. Steps 2 (TMDB) and 3 (Sentry) blocked: Justin not signed in to either — needs to log in (or sign up) once, then Manager continues.
- 2026-09-24 — Setup steps 2+3 done: Sentry project `perchable` (org tsujin-it-solutions) DSN and TMDB API key (free personal/non-commercial plan, tested 200) saved to Credentials/perchable/.env. Only step 4 (Google OAuth) left, after Build 1. Waiting: Justin's approval line in PLAN.md.
