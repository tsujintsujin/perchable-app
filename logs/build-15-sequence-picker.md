# Build 15 — Selectable swipe sequence (Module 5, branch `module/quick-add-swipe`)

Plan: PLAN.md "Build 15 — Selectable swipe sequence" (A1–A3, B1–B6) and M2, M3, M6.
Design: Module 5 Phase 0 board (picker under the header; `logs/evidence/build-14/design/`), DESIGN.md
§ "Build 15 — Selectable swipe sequence" and the picker geometry (left/right 20, top = header bottom + 8, 50 high).
Phase 0: skipped (the Module's board already draws the picker).

Base SHA: _set at Phase 1 start (after the Home blank-scroll fix lands)._

## Manager — failure-mode list (before Phase 1)
Each line is a Done-means item; Bella's log maps each to a test (Jest) or a QA step, Queenie checks the
device ones, Ruby checks the rest.

| # | Failure mode | Done means | Proof |
|---|---|---|---|
| F1 | Offline when switching order | Error state with Retry in the card shape; the cards already in the old order are not lost if the user switches back; no crash | Jest + QA (airplane mode) |
| F2 | Request timeout / 5xx / 429 on a discover page | Same typed `MovieApiError` path as Popular; Retry works; 429 not retried in a tight loop | Jest |
| F3 | Wrong response shape | `shape` error, exactly one Sentry event (M9), deck shows the error state | Jest |
| F4 | Page empty after the adult filter / past TMDB's last page | Loop skips to the next page; Random on an exhausted pool shows "caught up"; Newest/Oldest at the 500-page cap shows "caught up" | Jest |
| F5 | `release_date` missing in Newest/Oldest | Card shows no year (never "NaN"); ordering still holds for dated cards | Jest + QA year list |
| F6 | Same movie in two orders | Swiped (skipped) in one order → never shown in another | Jest |
| F7 | Switch order twice quickly | One result; old in-flight request aborted, its late result ignored; no duplicate id, no stale cards | Jest (deferred stub) + QA |
| F8 | Switch mid-swipe (card in flight) | The swipe commits or cancels cleanly before the deck swaps; no ghost card, no double action | QA + Jest where reachable |
| F9 | Double-tap a picker option | One switch, no flicker of a second loading state | Jest |
| F10 | Leave and return (tab switch, details push, app restart) | Same order selected; per-user remembered value; corrupt stored value → default Newest | Jest + QA |
| F11 | Random re-entered | New seed → new order; a refetch of a page never reorders or duplicates (seeded PRNG, no `Math.random` in the query fn) | Jest |
| F12 | Sign-out / account switch | Cursor + remembered order removed for the departing user; next user starts at the default | Jest |
| F13 | Undo / rollback across the cursor | Cursor lowers to the returned card's page (B1b rollback test) | Jest |
| F14 | Security — server | `sort` whitelisted before TMDB is called; 400 bodies echo nothing; key never in body/log; `today` injected | Jest + Ruby + Manager curls |
| F15 | Security — client | Client sends only the three values; no TMDB key in the bundle (`expo export` grep) | Bella gate + Ruby |
| F16 | Accessibility | Picker options are radios (name, selected, position announced), ≥ 48 dp; loading state announced once | Jest + QA (TalkBack if available, else UNTESTABLE → Justin) |
| F17 | Dead code | Build 14's `["movies","deck","popular"]` source and fetch path deleted (grep proves it) | Ruby |
| F18 | Sentry | Only M9 events; cancels/aborts are not events | Jest |
| F19 | Cleanup | Nothing stored beyond M3 keys; both cleared on sign-out | Jest |

Brief for Bella also carries `logs/LESSONS.md` and the spec-trace table requirement.
