# Build 10b — Report/block UI (Module: Moderation base)

Base SHA: d4570c8 (recorded 2026-09-30, Phase 1 start). Phase 0 done: DESIGN.md "Build 10b",
boards rendered by the Manager (`logs/evidence/build-10b/design/`).
Plan: PLAN.md "Build 10b" C1–C9. Schema is live (Build 10a); types are regenerated.

## Manager decisions where DESIGN.md and PLAN.md differ (DESIGN wins; both noted)
- Sent/blocked states stay open until the user taps **Done** (PLAN said "then closes") — gives
  screen readers time; `onReported`/`onBlocked` fire on success, `onClose` on Done.
- The details box appears **only for "Something else"** (PLAN allowed optional details for every
  reason). The DB still accepts null details.
- Unblock uses the inline two-tap confirm in the row (DESIGN).

## Failure-mode list (Manager, before Phase 1) — each is a Done-means line + a test
PLAN.md's "Failure modes to cover" for 10b apply in full (report, block, signed-out/account
switch, Sentry, security, cleanup). In addition:
1. **Insert shape** — `reports` and `blocked_users` inserts never chain `.select()` and never
   use `.upsert()` (42501 on reports). Jest asserts the exact call.
2. **23505** — repeat report → "sent"; repeat block → "blocked"; neither goes to Sentry.
3. **23503** (user no longer exists) and **42501** → error state, no crash; reported to Sentry
   without the details text.
4. **Empty world** — the live project has ONE user today. Harness with no other profiles shows a
   clear "no other profiles yet" state, no query errors; Blocked users shows the empty state.
5. **Busy states** — every async control has a ref guard (double tap = one request) and no
   setState after unmount; a cancelled/unmounted submit never applies its result.
6. **Back / scrim / Cancel** — dismissable when idle; ReportSheet cancel works mid-submit;
   BlockUserSheet is not dismissable while blocking (DESIGN).
7. **Details input** — 500-char cap enforced in the UI with the counter; whitespace-only counts
   as empty; keyboard does not cover the input or the buttons (check on device).
8. **Owner-tagged cache** — blocked list under user A is never shown to user B; cleared on sign-out.
9. **Harness isolation** — assigned at module scope `const Harness = __DEV__ ? require(...).X : null`;
   no query before the `__DEV__` return; bundle check has a control: marker string present in a
   dev export, absent from `npx expo export --platform android`.
10. **Nothing wired to product surfaces** except the Settings "Blocked users" row.
11. **Accessibility** — sheet controls have roles/labels, radios announce selected state, error
    cards are alerts, targets ≥ 48dp (DESIGN "Build 10b" accessibility notes).
12. **Settings regression** — row order per DESIGN (Edit profile · Comments · Blocked users ·
    Sign out; the Terms row is Build 11 — do NOT add it now); Sign out and Delete still work.

On-device report/block/unblock against another user is UNTESTABLE until Justin's second Google
account exists (also unblocks 10a's B3 ban proof).
