# Perchable — PLAN.md

Planner: Priya. Date: 2026-09-24 (Round 1 revision — Ruby + Manager).
Based on `docs/VISION.md` and the approved `docs/RESEARCH.md`.

Approved by Justin: 2026-09-24

---

## 1. Goal & v1 definition of done

Movie-tracking social app: browse/search movies (via TMDB), mark watched,
build a captioned collection, follow other users, comment/DM about watched
movies, see rankings. Google sign-in only. Android first (Vision Part 1–2).

**v1 "done" (Vision Part 5): every module below works end-to-end on the local
emulator (`td_emu`) — not shipped, not on the Play Store yet.** Store
submission, iOS, and ads are explicitly out of scope for v1 (section 8).

This build also doubles as the **reusable base for later apps** (Vision Part
0) — see section 3 for which modules are meant to be lifted wholesale.

---

## 2. Backend decision

**Default stack, per RESEARCH.md — no deviation, case made in Stage A,
restated here for continuity:** Supabase (Postgres + Auth w/ Google +
Realtime + Storage + Edge Functions), TMDB API via a server-side proxy (Edge
Function), Expo SDK 57 + Expo Router + TypeScript, dev build (not Expo Go),
TanStack Query, expo-image, FlashList, gesture-handler + reanimated, Jest +
RNTL + Maestro, Sentry.

D1 was ruled out during Stage A research (RESEARCH.md §2, "Against the
vision"): no built-in auth or realtime, and this app needs both on day one
(Google sign-in, DMs). Ruby and the Manager already checked this reasoning
during Stage A; carrying it forward here rather than re-litigating.

Two flagged risks to track on TIMELINE.md, not blockers now:
- Supabase free tier pauses after 7 days idle (RESEARCH.md §13.1).
- TMDB's free non-commercial license ends the day ads ship (§13.2) — email
  TMDB sales before that Build, not after.

---

## 3. Modularity — what's reusable in later apps

Vision Part 0: this app is a test base for later apps, so folder/module
boundaries matter beyond Perchable itself. High level only — Dianne owns
actual code structure in DESIGN.md.

| Reusable as-is in a later app | Perchable-specific, not reusable |
|---|---|
| **Auth** (Google sign-in via Supabase, dev-build setup, account deletion) | Movie browse/details (TMDB-specific) |
| **Profile** (edit photo/usertag) | Quick-add swipe deck |
| **Social** (follow, DM, comments, block/report) | Rankings (movie-specific aggregates) |
| **Moderation** (report/block tables + RLS pattern, UGC terms acceptance) | TMDB proxy Edge Function |

Build these four as self-contained modules with their own Supabase tables and
their own screens/components, not entangled with movie-specific logic — a
later app should be able to copy the folder and swap out only the
movie-domain modules.

---

## 4. Modules (dependency order)

| # | Module | Why here |
|---|---|---|
| 1 | Foundation — dev build + Supabase project + testing/Sentry | everything needs a working dev build, a DB, and a test/crash-reporting gate before any screen exists |
| 2 | Auth + profile (+ minimal account deletion) | Google sign-in gates every other screen; deletion built alongside auth per RESEARCH.md §6, not as a late add-on |
| 3 | Moderation base (report/block schema + UGC terms acceptance) | RESEARCH.md §13.3: must not be a late add-on — built here so every later module's RLS references it from the start |
| 4 | Movie browse/details (TMDB proxy) | needed before collection or quick-add can point at a real movie |
| 5 | Quick-add swipe | Vision Part 2's headline interaction; depends on browse data |
| 6 | Search/add | second path to add a movie; depends on TMDB proxy |
| 7 | Collection + captions | depends on a movie being addable (5 or 6); also where the Maestro smoke test lands once Modules 4–7 all exist |
| 8 | Social: follow + profile modal | depends on profile (2) and moderation (3) existing |
| 9 | Comments (+ on/off toggle) | depends on collection (7, what's commented on) and moderation (3) |
| 10 | DMs | depends on follow/profile (8) and moderation (3) for block enforcement |
| 11 | Rankings | depends on collection, comments, follows all producing real activity to aggregate |
| 12 | Account deletion completion (web page + final check) | the in-app deletion button ships in Module 2; this module only adds the web-URL deletion path and a final end-to-end check that every table added since Module 2 actually cascades |

Every module from 2 onward that adds a user-owned table carries a
Done-means bullet: "deleting the account removes this module's rows
(`ON DELETE CASCADE`)" — see each Build below. Modules 1–2 are detailed in
full (first two, per batching rule); 3–12 are one-line-rough until the team
reaches them, but are still Build-numbered here so milestones and manual
steps stay unambiguous.

---

## 5. Builds

### Module 1 — Foundation (dev build + Supabase + testing/Sentry)

```
Build 1 — Expo dev build boots          Module: Foundation
Done means: `npx expo run:android` installs a custom dev-client APK on td_emu
  and launches to the default Expo Router screen (not Expo Go).
Test on: emulator
Needs: nothing (uses existing Android SDK/emulator per app CLAUDE.md)
Phases: 0 skip (no UI) · 1 Bella build · 2 Bella gates (tsc, expo lint) ·
        3 Queenie QA · 4 Ruby review · 5 Manager ships
```

```
Build 2 — Supabase project connected     Module: Foundation
Done means: app reads a Supabase env var and a debug screen shows
  "Supabase: connected" (a trivial `select 1`-style ping succeeds) on device.
Test on: emulator
Needs (Manager sets up, section 6): Supabase project URL and
  anon key (setup step #1, see section 6)
Phases: 0 skip · 1 Bella build · 2 Bella gates · 3 Queenie QA · 4 Ruby review ·
        5 Manager ships
```

```
Build 3 — TMDB proxy Edge Function        Module: Foundation
Done means: a Supabase Edge Function calls TMDB `/movie/popular` server-side
  and returns JSON to the app; TMDB key never appears in the app bundle
  (Queenie/Ruby check the bundle/network tab for it); response includes the
  required TMDB attribution string.
Test on: emulator (network call), Ruby checks the bundle for the leaked key
Needs (Manager sets up, section 6): TMDB API key (setup step #2)
Phases: 0 skip · 1 Bella build · 2 Bella gates · 3 Queenie QA · 4 Ruby review ·
        5 Manager ships
```

```
Build 4 — Testing + Sentry setup          Module: Foundation
Done means: `npx jest` runs with the `jest-expo` preset and one passing
  smoke test; `npx jest` becomes a required gate for every Build from here
  on (added to Bella's Phase 2 checklist); Sentry SDK is wired and a
  deliberately-thrown test error appears in the Sentry dashboard.
Test on: emulator (Sentry event) + unit test run
Needs (Manager sets up, section 6): Sentry account + project DSN (setup step #3)
Phases: 0 skip · 1 Bella build · 2 Bella gates (tsc, lint, jest) ·
        3 Queenie QA · 4 Ruby review · 5 Manager ships
```

### Module 2 — Auth + profile (+ minimal account deletion)

```
Build 5 — Google sign-in                Module: Auth
Done means: user taps "Sign in with Google," completes the Google account
  picker on-device, lands back in the app signed in; closing and reopening
  the app keeps them signed in (session persists).
Test on: emulator — Google APIs image; UNTESTABLE if Google sign-in requires
  Play Services beyond what the current `td_emu` image provides (flag to
  Justin immediately if the sign-in screen fails to load Google's picker —
  see setup step #6, may need a Google Play image swap)
Needs (Manager sets up, section 6): Google Cloud OAuth client IDs — Android client (SHA-1 of
  the Build-1 dev build's debug keystore, via `keytool`/`gradlew
  signingReport`) + Web client (for Supabase Auth) (setup step #4)
Phases: 0 Dianne mockup · 1 Bella build · 2 Bella gates · 3 Queenie QA ·
        4 Ruby review · 5 Manager ships
```

```
Build 6 — Profile created on first sign-in   Module: Auth/Profile
Done means: first sign-in auto-creates a `profiles` row (id, google name,
  default avatar, empty usertag); visiting "My Profile" shows that data.
Test on: emulator
Needs: nothing
Phases: 0 Dianne mockup · 1 Bella build · 2 Bella gates · 3 Queenie QA ·
        4 Ruby review · 5 Manager ships
```

```
Build 7 — Edit profile (photo + usertag)   Module: Profile
Done means: user changes usertag text and uploads a photo (Supabase Storage);
  both persist after app restart; usertag uniqueness enforced (no two users
  same tag) with a visible error on collision.
Test on: emulator
Needs: nothing
Phases: 0 Dianne mockup · 1 Bella build · 2 Bella gates · 3 Queenie QA ·
        4 Ruby review · 5 Manager ships
```

```
Build 8 — Sign out                       Module: Auth
Done means: "Sign out" clears the session and returns to the sign-in screen;
  a signed-out app never shows profile/collection data (regression check on
  Builds 5–7).
Test on: emulator
Needs: nothing
Phases: 0 skip · 1 Bella build · 2 Bella gates · 3 Queenie QA · 4 Ruby review ·
        5 Manager ships
```

```
Build 9 — Minimal account deletion        Module: Auth (per RESEARCH.md §6:
                                           built alongside auth, not late)
Done means: "Delete my account" button in-app deletes the `profiles` row and
  the Supabase Auth user, with `ON DELETE CASCADE` wired on the auth-user
  foreign key so this stays correct as later modules add tables; after
  deletion the user is signed out and cannot sign back in as the same
  account without a fresh Google sign-up.
Test on: emulator
Needs: nothing
Phases: 0 Dianne mockup · 1 Bella build · 2 Bella gates · 3 Queenie QA ·
        4 Ruby review · 5 Manager ships
```

### Modules 3–12 — rough (one line each, detailed when the team reaches them)

```
Build 10 — Moderation schema + UI         Module: Moderation base
Done means: `reports` (reporter_id, target_type, target_id, reason) and
  `blocked_users` (blocker_id, blocked_id) tables exist with RLS; generic
  report-content UI reachable from every future UGC surface; block-a-user
  UI; deleting the account removes this module's rows (ON DELETE CASCADE);
  Justin (as admin) can remove content or ban a user via a direct Supabase
  query — documented as the admin action path, no admin panel needed for v1.
Test on: emulator
Needs: nothing
```

```
Build 11 — UGC terms acceptance           Module: Moderation base
Done means: a terms screen (defines objectionable content) must be accepted
  before a user's first comment/DM; `profiles.terms_accepted_at` is set on
  acceptance; RLS on comments/DMs INSERT rejects rows where
  terms_accepted_at is null.
Test on: emulator
Needs: nothing
```

```
Build 12 — Home poster grid               Module: Movie browse/details
Done means: FlashList + expo-image poster grid, data fetched via TanStack
  Query against the Build-3 TMDB proxy (not raw useEffect).
Test on: emulator
```

```
Build 13 — Movie details screen           Module: Movie browse/details
Done means: tapping a poster opens a details screen (cast/rating/synopsis)
  fetched via TanStack Query against the TMDB proxy.
Test on: emulator
```

```
Build 14 — Swipe deck                     Module: Quick-add swipe
Done means: gesture-handler + reanimated swipe left/right on a movie card.
Test on: emulator
```

```
Build 15 — Selectable swipe sequence      Module: Quick-add swipe
Done means: user picks recent / older / random ordering for the deck.
Test on: emulator
```

```
Build 16 — Swipe-right adds to collection Module: Quick-add swipe
Done means: swiping right adds the movie to the signed-in user's collection.
Test on: emulator
```

```
Build 17 — Search by title                Module: Search/add
Done means: search screen queries the TMDB proxy via TanStack Query and
  lists matching titles.
Test on: emulator
```

```
Build 18 — Add from search result         Module: Search/add
Done means: tapping a search result adds it to the collection.
Test on: emulator
```

```
Build 19 — My Collection list             Module: Collection + captions
Done means: collection screen lists a user's added movies; deleting the
  account removes this module's rows (ON DELETE CASCADE).
Test on: emulator
```

```
Build 20 — Add caption                    Module: Collection + captions
Done means: user attaches/edits a text caption per collection movie.
Test on: emulator
```

```
Build 21 — Remove from collection         Module: Collection + captions
Done means: user removes a movie from their collection.
Test on: emulator
```

```
Build 22 — Maestro smoke test             Module: Collection + captions
Done means: one Maestro YAML flow — sign in with Google → swipe to add a
  movie → see it in collection — runs green once Modules 4–7 all exist,
  becomes a required regression check from here on.
Test on: emulator (Maestro)
```

```
Build 23 — Follow/unfollow                Module: Social — follow + profile modal
Done means: follow button toggles state, visible on the target profile;
  deleting the account removes this module's rows — both directions of the
  follow graph (ON DELETE CASCADE).
Test on: emulator
```

```
Build 24 — Discord-style profile modal    Module: Social — follow + profile modal
Done means: tapping another user opens the formSheet modal (RESEARCH.md §4)
  showing name, join date, watched count, followers.
Test on: emulator
```

```
Build 25 — Comment on a watched movie     Module: Comments
Done means: user comments on another user's collection entry (requires
  terms acceptance, Build 11); deleting the account removes this module's
  rows (ON DELETE CASCADE).
Test on: emulator
```

```
Build 26 — Comment on/off toggle          Module: Comments
Done means: profile owner toggles commenting off; RLS blocks new inserts
  per the answer to open decision #1 (section 7).
Test on: emulator
```

```
Build 27 — DM conversation                Module: DMs
Done means: two users exchange messages live via Supabase Realtime;
  deleting the account removes this module's rows (ON DELETE CASCADE).
Test on: emulator
```

```
Build 28 — DM block enforcement           Module: DMs
Done means: a blocked user cannot open/send in a DM thread with the
  blocker, enforced in RLS (not just hidden in the UI).
Test on: emulator
```

```
Build 29 — Leaderboard views              Module: Rankings
Done means: most-added, most-discussed, most-watched, most-active views
  return correct aggregates from a plain Postgres view (materialize only if
  a real slow-query bottleneck shows up).
Test on: emulator
```

```
Build 30 — Web account-deletion page      Module: Account deletion completion
Done means: a static page (justin94.space or a Supabase Edge Function form)
  accepts a deletion request by email/account ID for a user without the app
  installed.
Test on: emulator/browser
```

```
Build 31 — End-to-end deletion check      Module: Account deletion completion
Done means: deleting an account with data in every module (profile,
  collection, comments, DMs, follows, reports/blocks) leaves zero rows
  behind across all tables — verified directly in the Supabase table
  editor, not just "no error shown."
Test on: emulator + Supabase dashboard check
```

---

## 6. Service setup — the Manager does it, in Justin's Chrome

The Manager does every setup step below in real Chrome, using Justin's
logged-in sessions: creating projects, API keys, OAuth clients, and saving
each value to `D:\AIO Freelance\Credentials\perchable\` plus a README line
(name only). Credentials never go in the repo. Checked against
`Credentials/README.md` (2026-09-24): nothing exists yet for this app.

Justin only steps in where team rules forbid an agent: **signing up for a
brand-new account, typing a password, accepting terms/consent screens,
payment, or UAC.** The Manager stops at that exact screen and tells him.

| # | Step (Manager, in Chrome) | Needed for Build | When | Justin only if… |
|---|---|---|---|---|
| 1 | Supabase: create project, save URL + anon key | Build 2 | Before Module 1 | no Supabase account yet |
| 2 | TMDB: request API key, save it | Build 3 | Before Module 1 | no TMDB account yet; API terms acceptance |
| 3 | Sentry: create project, save DSN | Build 4 | Before Module 1 | no Sentry account yet |
| 4 | Google Cloud: OAuth consent screen + Android client (Build-1 debug keystore SHA-1) + Web client for Supabase Auth; enter them in Supabase's Google provider | Build 5 | **After Build 1** (SHA-1 only exists then), before Build 5 | consent-screen terms |
| 5 | `eas login` | first EAS build | when it lands | password prompt |
| 6 | Swap `td_emu` to a Google Play image if Google sign-in fails on the Google APIs image | Build 5 | only if Build 5 QA fails | — (Justin's OK first, per MobileDev rules) |
| 7 | Email TMDB sales before any ads Build | future ads Build | not v1 | Justin decides |
| 8 | Supabase Pro ($25/mo) vs manual un-pause | pre-launch | not v1 | Justin decides (payment) |

Steps 1–3 happen together before Module 1. Step 4 waits for Build 1's
debug keystore.

---

## 7. Open decisions Justin must answer

| # | Decision | Blocks | From RESEARCH.md |
|---|---|---|---|
| 1 | Does disabling comments on a collection hide already-posted comments, or only block new ones? | Build 26 (comment toggle) — changes the RLS design | §13.4 |
| 2 | Bottom sheet (`@gorhom/bottom-sheet`) vs Expo Router `formSheet` for the Discord-style profile popup — Priya/Rose recommend `formSheet` for Android-first v1 (leaner, no half-open peek) | Build 24 (profile modal) | §13.5 |

Both can be answered any time before their Build starts — not needed to
approve this plan.

---

## 8. Out of scope for v1

- Ads / any monetization (Vision Part 4 — explicitly "in the future")
- iOS build (Android first per Vision Part 4)
- Play Store production submission / closed testing (Vision Part 5: "not
  shipped yet")
- Recommendation engine (RESEARCH.md §8 — flagged as a category weakness,
  not a v1 feature)
- TV/multi-media tracking (movie-only per Vision Part 1)

---

## 9. Milestones

| Milestone | Completed by |
|---|---|
| Foundation (dev build, Supabase, TMDB proxy, testing + Sentry) working | Build 4 |
| Auth + profile + minimal account deletion working | Build 9 |
| Moderation base + UGC terms in place | Build 11 |
| Movie browse/details working | Build 13 |
| Quick-add swipe working | Build 16 |
| Search/add working | Build 18 |
| Collection + captions working, Maestro smoke test green | Build 22 |
| Follow + profile modal working | Build 24 |
| Comments working | Build 26 |
| DMs working | Build 28 |
| Rankings working | Build 29 |
| Account deletion completion (web page + verified cascade) | Build 31 — **v1 "done" per Vision Part 5** |

---

## 10. Risks

- **Supabase 7-day idle pause** could make a Build look broken when it's
  actually just asleep — Manager should un-pause before QA if a session has
  gone a week without touching the DB (RESEARCH.md §13.1).
- **Google sign-in on `td_emu`'s Google-APIs-only image** is unverified —
  Build 5 is the first real test; if it fails, emulator swap needs Justin's
  OK before Module 2 can finish (setup step #6).
- **Moderation (Module 3) touches nearly every later table's RLS** — if it's
  skipped or rushed, Modules 9–10 (comments, DMs) need rework. This plan
  schedules it third specifically to avoid that (RESEARCH.md §13.3).
- **Account deletion cascades are only as good as each module remembering
  to wire ON DELETE CASCADE** — every Build that adds a user-owned table
  now carries an explicit Done-means bullet for this; Build 31 is the final
  check that catches anything missed.
- **TMDB key leaking client-side** if the proxy pattern isn't followed
  exactly — Build 3's Done-means explicitly requires Ruby to check the
  bundle/network traffic, not just that the feature works.
- **Loop cap (2 rounds)** on Bug fixes — moderation and auth Builds are
  higher-risk for hitting this given RLS complexity; Manager should watch
  those loops closely.
- **Scope creep risk on "user details will keep on going on further
  updates"** (Vision Part 2) — this plan holds Module boundaries firm for
  v1; any addition beyond what's listed here is a feature change and needs
  Justin's approval (NEEDS JUSTIN), not silent inclusion.

---

## Changes

**2026-09-24 — Round 1 fixes (Ruby + Manager, flagged to Priya):**
1. Split manual step 3 (Google OAuth) into two: Supabase/TMDB/Sentry account
   steps before Build 1, Google OAuth client IDs (needs the Build-1 debug
   keystore SHA-1) moved to after Build 1, before Build 5 (Google sign-in).
2. Moved minimal account deletion from a late Module 12 into Module 2
   (new Build 9), per RESEARCH.md §6 ("alongside auth, not a late
   add-on"). Every later Build that adds a user-owned table now carries a
   "deleting the account removes this module's rows (ON DELETE CASCADE)"
   Done-means bullet. Last module renamed "Account deletion completion" —
   now only the companion web deletion page and a final end-to-end cascade
   check (Builds 30–31).
3. Confirmed the cascade bullet is present on Module 3 (Build 10, reports/
   blocked_users) and Module 8 (Build 23, follow graph) specifically, per
   RESEARCH.md §6 listing the follow graph explicitly.
4. Added Build 4 (Jest + RNTL/jest-expo with one passing test, `npx jest`
   made a required gate from then on, plus Sentry SDK wiring) to Module 1.
   Added Build 22 (Maestro smoke test: sign in → swipe-add → see in
   collection) once Modules 4–7 exist. Sentry DSN manual step moved
   earlier (now step 3, before Module 1 starts).
5. Added Build 11 (UGC terms acceptance screen + `terms_accepted_at` +
   RLS enforcement before any comment/DM insert) to Module 3, and added the
   admin action path (Justin removes content/bans a user via a direct
   Supabase query) as a Done-means bullet on Build 10.
6. Added explicit TanStack Query mentions to Build 12/13 (browse/details)
   and Build 17 (search) Done-means text.
7. Reworded section 2's backend-decision framing ("case made in Stage A,
   restated for continuity" instead of "no written case needed") and
   dropped the TheJobStash stack comparison as irrelevant to this app.

Build numbering, the milestones table, and the manual-steps table were all
updated to match. No feature was added or removed — every item above is a
sequencing/process fix inside the already-approved feature set, so none of
this is marked NEEDS JUSTIN.
- 2026-09-24 (Manager): section 6 reframed at Justin's request — service setup is done by the Manager in Justin's Chrome; Justin only for new-account signup, passwords, terms acceptance, payment.
- 2026-09-24 (Manager, Justin's decision in chat): design direction = Proposal A "Night Owl Arcade" with glassmorphism surfaces. Three inspo features added as **UI shells only** in v1 (visible, not functional): Perch Roulette (Home), S/A/B tier badges (details/collection), #spoiler-free-lounge (details). They ride inside the existing screen Builds (Home grid, details, collection) — no new Builds; wiring them is post-v1.
