# Build 7 — Edit profile (photo + usertag) (Module: Profile)

- Base SHA: 3b48793
- Branch: module/auth
- Done means (PLAN.md): user changes usertag text and uploads a photo
  (Supabase Storage); both persist after app restart; usertag uniqueness
  enforced (no two users same tag) with a visible error on collision.

## Phase log
- Phase 0 — Dianne mockup, done before this session (board "Build 7 — Edit
  profile", `design-src/build-07-edit-profile.dc.html`).
- Phase 1 (migration) — done first, held for Manager review per the Build 7
  brief's sequencing (Queenie was re-testing Build 6 on the working tree).
- Phase 1 (app code) + Phase 2 (gates) — done after Queenie finished; see
  below.

## Storage migration — supabase/migrations/20260926010000_avatars_storage.sql

Written by Bella, **not applied**. The Manager reviewed and applied it with
one change (also included in this commit, per the Manager's instruction):
the public `select` policy was replaced with an own-folder `select` for
`authenticated` — a public bucket already serves image URLs without any
select policy, so a public one would only have done one thing: let anyone
`LIST` every user's files. Own-folder select is still needed because
upsert (replacing your avatar at the same path) requires select + insert +
update together.

`avatars` bucket: `public = true` (justified in the migration — profile
photos are already public within the app per Build 6's profile-select RLS),
`file_size_limit = 2097152` (2MiB, confirmed this column is bytes not
kilobytes against Storage's own migration history), `allowed_mime_types =
{image/jpeg, image/png, image/webp}`. `storage.objects` RLS: own-folder
select/insert/update/delete, keyed off `(storage.foldername(name))[1] =
auth.uid()::text` — a user can only ever read/write inside `<their-uid>/`.

The Manager also tested this in a rolled-back transaction —
`supabase/tests/avatars_storage_rls.sql` (not written by Bella, included in
this commit per instruction): own insert ok, another user's folder and a
root-level (no-folder) insert both rejected, only your own files visible
under the authenticated-select policy, anon sees 0 rows. Delete isn't
testable in plain SQL (`storage.protect_delete` blocks direct deletes) —
covered on-device instead (see below).

**Usertag uniqueness — no extra migration needed.** Confirmed with the
Manager before starting Build 7: Build 6's `usertag text unique` + `CHECK
(usertag ~ '^[a-z][a-z0-9_]{2,19}$')` is already case-insensitive in effect,
since the CHECK forces lowercase-only storage. No `citext`, no
`lower(usertag)` index. The app-side responsibility is lowercasing input
before every uniqueness query/save — done in `useUsertagAvailability` and
`edit.tsx`'s `handleUsertagChange`.

## What was built

**`src/modules/profile/` additions:**
- `pickAvatar.ts` — `expo-image-picker` (native 1:1 crop) → `expo-image-manipulator`
  (resize to 512×512, JPEG re-encode at 0.8 compression). Resizing isn't
  redundant with `image-picker`'s own `quality` option: quality only
  compresses, it can't cap pixel dimensions, so a crop from a
  high-megapixel camera photo could still blow past the bucket's 2MB limit
  even at low quality. Returns `null` on cancel/denied-permission — not an
  error case.
- `api/uploadAvatar.ts` — `fetch(uri).then(res => res.arrayBuffer())` then
  `storage.from('avatars').upload(path, arraybuffer, { upsert: true })` —
  confirmed this is Supabase's own current recommended React Native upload
  pattern (checked their Expo user-management example, not memory).
  Returns a `?v=<timestamp>`-suffixed public URL so a re-uploaded photo at
  the same path shows immediately instead of serving a cached copy of the
  old bytes.
- `api/updateProfile.ts` — updates `avatar_url`/`usertag` on the caller's
  own row; throws the raw Postgrest error so the screen can check
  `error.code === "23505"`.
- `api/checkUsertagAvailable.ts` + `hooks/useUsertagAvailability.ts` —
  debounced (450ms) live uniqueness check, excluding the caller's own row.
  "unchanged"/"invalid" are derived at render time (pure functions of the
  two inputs), not via state+effect — only the actual network check's
  result goes through `setState`, and only from inside its `.then`/`.catch`
  (see Gates below for why this distinction mattered).

**`src/app/(tabs)/profile/edit.tsx`** — the real screen, replacing Build 6's
stub. States per DESIGN.md: idle, uploading-photo (indeterminate spinner —
see the Manager's decision below), upload-error, usertag-taken, saving.
Header back arrow (`router.back()`), `Avatar size="lg"` with a 30px gold
camera badge, usertag input row with a static "@" prefix, always-visible
helper text, Cancel/Save button row (new `ui/Button` component, built for
this — DESIGN.md's spec existed but nothing had built it yet).

**`ui/Button`** — `primary-gold`/`secondary-glass`/`ghost`/`destructive`
variants, `disabled`/`loading` states (spinner replaces the label). First
built this Build; Cancel uses `secondary-glass`, Save uses `primary-gold`.

## Why this way

⚠️ Big decision: **a picked photo uploads and saves immediately on pick,
not gated behind the Save button.** DESIGN.md's states already frame photo
and usertag as "independent fields with independent save outcomes" — I
read that as licensing this, rather than Save being a single action that
writes both. The alternative (Save writes both, staging the photo locally
until then) would mean re-defining what "Save" does once a photo already
finished uploading before the button is pressed, and DESIGN.md doesn't
actually spec that staging behavior anywhere. Save/Cancel below govern the
usertag field only.

⚠️ Big decision (Manager's, not mine — recorded here since it's a real
DESIGN.md deviation): **the uploading-photo state shows an indeterminate
spinner, not DESIGN.md's literal "determinate progress ring driven by
Supabase Storage's upload progress event."** I'd flagged in the Build 7
Part 1 plan that `supabase-js`'s `storage.upload()` has no progress-event
support at all (confirmed against `storage-js`'s own source, not memory) —
the only way to get a real percentage would be bypassing it with a manual
`XMLHttpRequest` PUT to the Storage REST endpoint. The Manager's call: skip
that — the upload is a ≤512px JPEG that finishes in about a second, not
worth the extra code path. `edit.tsx`'s `Spinner` component is the same
rotating-ring visual DESIGN.md describes, just not wired to a real
percentage.

**No separate loading/error state for the screen itself:** DESIGN.md's
Build 7 section doesn't spec one (unlike Build 6's My Profile screen) —
this screen is only ever reached by pushing from the already-loaded
Profile screen, so `profile.state !== "loaded"` is a defensive fallback,
not a designed state.

## Gates
- `npx tsc --noEmit` — pass.
- `npx expo lint` — pass. Two real findings fixed, both
  `react-hooks/set-state-in-effect` (same class of issue as Build 6's
  `useOwnProfile` fix):
  - `edit.tsx` was seeding local `avatarUrl`/`usertagInput` state from the
    loaded profile via a `useEffect` that called `setState` synchronously.
    Replaced with derived values (`override !== undefined ? override :
    loaded.value`) — no effect needed at all once "not yet touched by the
    user" is representable as `undefined`.
  - `useUsertagAvailability` called `setState` synchronously at the top of
    its effect for the "unchanged"/"invalid" cases. Rewrote so those two
    are computed at render time (pure functions of the inputs) and the
    effect only ever calls `setState` from inside its async
    `.then`/`.catch` — see the full comment in the file.
- `npx jest` — pass, 4 suites / 15 tests, zero warnings. New:
  `edit-profile-test.tsx` (6 tests: idle/no-change, invalid keeps Save
  disabled, taken-state shows the error and keeps Save disabled, save
  succeeds and calls `router.back()`, upload-error shows the card, a
  successful pick uploads+saves independently of Save). Two tests needed
  the same `act()` + microtask-flush pattern Build 5 · Bug 1 established,
  for the same reason (an async handler's state update landing after
  `act`'s scope otherwise triggers "not wrapped in act(...)").

## Native rebuild
Both `expo-image-picker` and `expo-image-manipulator` are native modules —
required `GRADLE_USER_HOME="C:/g/perchable" SENTRY_DISABLE_AUTO_UPLOAD=true
npx expo run:android --no-bundler` per CLAUDE.md.

## Bug found on-device: stale Profile screen after Save

Not caught by code review — only showed up by actually using the app.
Sequence: change usertag on Edit profile → Save → `router.back()` → the My
Profile screen still showed the old usertag until a manual pull-to-refresh
(there isn't one) or a full app restart.

**Cause:** Expo Router's `Stack` (and `Tabs`) keep a screen mounted when you
navigate away from it rather than unmounting it — so `useOwnProfile`'s
original `useEffect(() => { fetch... }, [userId])` only ran once, on first
mount, and never again when the user came back to an already-mounted Profile
screen.

**Fix:** `src/modules/profile/hooks/useOwnProfile.ts` now fetches on every
screen *focus* (`useFocusEffect` from `expo-router/react-navigation`) instead
of only on mount. Confirmed the fix on-device: after this change, returning
from Edit's Save immediately showed the updated usertag, and later the
updated avatar too, with no manual refresh.

**Concept learned:** in a stack/tab navigator, "screen mounted" and "screen
currently visible" are different lifecycles — anything that needs fresh data
whenever a user re-visits a screen belongs in a focus effect, not a mount
effect. This is the same category of bug as Build 6's `useOwnProfile` — that
one was about the *first* load; this one is about every load after it.

## On-device check (this session, after resuming from a rate-limit cutoff)

Emulator was in a degraded state at the start of this resume (documented
pattern in this app's CLAUDE.md: props respond but `screencap`/`uiautomator`
hang) — recovered with `adb reboot` + wait for `sys.boot_completed=1` +
settle, then restarted Metro (killed by its own earlier `timeout` wrapper)
and reconnected via the dev-client's "Recently opened" `localhost:8081`
entry.

Checked, on Justin's real test account (`@justin94test` / Justin Masiga —
explicitly his own account per the brief):
- Changed the usertag → Save → returned to My Profile → new tag shown
  immediately (the `useFocusEffect` fix above, confirmed working here).
- Picked a photo from the emulator's Photos picker, cropped it, confirmed
  the upload completes with no visible spinner delay (upload is fast enough
  that the indeterminate spinner never actually became observable in this
  test — consistent with the ~1s estimate in the Manager's decision above).
  The new avatar rendered correctly, non-blank, both on the Edit screen and
  back on My Profile.
- **Force-stopped the app and relaunched from a cold process** (stronger
  than a simple reload — the dev-client wrapper reopens, reconnects to
  Metro, and the whole JS bundle re-runs from scratch): both the usertag and
  the new avatar photo persisted correctly. Evidence:
  `logs/evidence/build-07/probe19.png` (Perch tab, cold boot, avatar visible
  in header), `probe20.png` (My Profile, tag + avatar both correct).
- Left the app signed in per the brief.

One earlier attempt in this same session (screenshots `probe1`–`probe14` in
`logs/evidence/build-07/`) picked a genuinely blank/white source image by
accident — a tap-coordinate mistake on my part (screenshots return at a
scaled/displayed resolution, not the device's real 1080×2400, and I used the
displayed coordinates unscaled once), not an app bug. Verified this was a
test-methodology error, not a pipeline bug, via the Supabase Management API
directly: the "blank" upload's row and object were both written correctly
(right path, right content-type, right cache-busted URL) — the *pixels* were
just white because the source photo was white. Redid the pick with a
correctly-scaled tap on a real photo and got the clean result described
above.

## Evidence
`logs/evidence/build-07/` — screenshots from the on-device check
(`probe*.png`, `state-check*.png`) and two `uiautomator` dumps used to get
exact tap coordinates once screenshot-coordinate scaling became unreliable
(`dumpedit2.xml`, `dumpcrop2.xml`, `dumptab.xml`).
