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

## QA (Queenie)

Tested across two sessions (first cut off by a usage limit mid-way through
item 4; resumed per the coordinator's message after a PC restart). Own
time-limited Metro each session (`npx expo start --dev-client`),
`adb reverse tcp:8081 tcp:8081`, stopped at end, port 8081 confirmed free
both times. Evidence: `logs/evidence/build-07/qa/` (screenshots 00-74,
`ui-*.xml` dumps, `logcat-upload.txt`).

Confirmed the APK is current empirically: `expo-image-picker` and
`expo-image-manipulator` both worked (native picker opened, crop screen
rendered, upload succeeded) with no native-module-missing crash — that only
works if the native rebuild Bella describes actually landed.

Starting data confirmed at launch: usertag `justin94test`, photo a
screenshot Bella had picked during her own testing.

### 1. Done-means: change usertag + upload photo, both persist after force-stop + relaunch
PASS. Changed usertag to `justin_qa` and (in the resumed session) uploaded a
real photo via the picker → Save → returned to My Profile showing both
immediately (the `useFocusEffect` fix confirmed). Force-stopped the app and
cold-relaunched via the dev-client launcher: both `@justin_qa` and the
uploaded photo were still there on Home's header avatar and on My Profile.
`52-cold-relaunch.png` through `54-cold-profile.png`.

### 2. Usertag rules per DESIGN.md
PASS on every rule tested:
- **Too short** (`ab`, 2 chars): Save stays disabled, no crash.
  `04-too-short.png`.
- **Too long** (26 chars): Save stays disabled. `05-too-long.png`.
- **Starts with digit** (`1justin`): Save stays disabled. `06-starts-digit.png`.
- **Uppercase** (`Justin99`): field silently lowercases to `justin99` as you
  type (matches DESIGN.md's "lowercase" storage decision) — this is valid
  and available, so Save enables. `07-uppercase.png`, `08-uppercase-debounced.png`.
- **Spaces**: typing a space produced no visible character at all (filtered
  at input level, not rejected-after-the-fact) — `09-spaces.png` shows only
  the "j" that preceded the space landed.
- **Symbols** (`-`, `!`): unlike space, these *do* get typed into the field
  (`justin-99!` shown in full) but correctly keep Save disabled since they
  fail the regex. `10-symbols.png`. Flagging the inconsistency (space
  filtered at input, other invalid symbols typed-then-rejected) for
  Ruby/Bella to judge — functionally correct either way (Save never enables
  for an invalid value), just worth noting the two code paths behave
  differently.
- **Leading @**: typing `@justin99` produced `justin99` in the field (the
  `@` is filtered/ignored, consistent with `@` being a static prefix glyph,
  not part of the editable value) — valid, Save enables. `11-leading-at.png`.
- **No-change → Save disabled**: confirmed on first opening Edit (before any
  edit) and again after Cancel/back discarded an edit — Save is disabled
  (dark gold, non-interactive) whenever the field matches the currently
  saved value. `03-edit-idle.png`, `49-cancel-result.png`.

### 3. Collision / live-check exclusion / debounce
- **Own current tag isn't flagged "taken"**: typed `justin94test` (the
  account's actual saved tag at the time) back into the field after
  changing it — no "That usertag is already taken" error appeared, Save
  stayed in its normal disabled-because-unchanged state. Confirms the live
  check excludes the caller's own row. PASS. `12-own-tag-unchanged.png`.
- **True collision (second taken usertag)**: **UNTESTABLE** — there is only
  one real user account on this Supabase project (Justin's), and I was
  told not to create a second account. Asking the Manager: is there an
  approved way to seed a second `profiles` row with a usertag directly in
  Supabase (not through app sign-up) so the "usertag-taken" error state and
  its exact copy/border styling can be verified on-device? Until then this
  specific state (danger-tinted border + "That usertag is already taken."
  text) is confirmed only by reading Bella's `edit-profile-test.tsx` unit
  test, not by an on-device screenshot.
- **Debounce (no flood of requests)**: typed rapidly through five different
  usertag values in quick succession across the various rule tests above;
  visually there was no flicker of intermediate "taken"/error states
  between keystrokes, consistent with the ~450ms debounce Bella's log
  describes. I could not independently confirm the exact request count via
  logcat — React Native `fetch` calls aren't logged to logcat by default,
  and I don't have Supabase dashboard/API log access from this session.
  Marking the *exact debounce timing/count* UNTESTABLE by the means
  available to me; the *behavioral* result (no visible flood/flicker) PASSES.

### 4. Photo
- **Cancel the picker (no change, no error)**: opened the picker, pressed
  the hardware Back key to dismiss it → returned to the idle Edit screen
  with the same photo, no error card, no state change. PASS.
  `32-picker-back-cancelled.png`.
- **Upload-error (airplane mode mid-upload)**: enabled airplane mode, picked
  a photo, cropped it (triggering the upload while offline) → inline error
  card appeared with copy verbatim **"⚠ Photo upload failed. Your old photo
  is unchanged — tap the photo to try again."**, old photo (the pre-existing
  screenshot avatar) confirmed unchanged. PASS. `41-upload-error-wait.png`.
- **Retry**: re-enabled network, tapped the photo again, reopened the
  picker, picked a photo, cropped → "Uploading photo…" indeterminate
  spinner shown (matches the Manager's documented spinner decision) → upload
  completed, new photo applied. PASS. `44-upload-error-wait.png` (spinner),
  `45-upload-complete.png` (done).
- **Known bugs from Ruby, recorded as observed, not re-diagnosed:**
  - *Save stays enabled during an upload*: during the "Uploading photo…"
    spinner state (`44-upload-error-wait.png`), Save's fill color did not
    visibly change from its normal disabled-dark-gold appearance in my
    screenshots — but since the usertag value was unchanged at the time, I
    could not distinguish "Save is genuinely disabled because upload is in
    progress" from "Save is disabled because the usertag is unchanged" just
    from the screenshot. Recording what I saw: no dimmed/opacity-reduced
    styling was visible on the usertag field or Cancel button during the
    upload, which is the part I can confirm doesn't match DESIGN.md's
    "field + Save visually disabled, opacity .5" spec for this state.
  - *Cancel/back mid-upload doesn't stop the photo applying*: not
    independently re-tested this session (the upload in my tests completed
    in roughly 1-2 seconds, too fast to reliably land a Cancel/Back tap
    mid-flight) — recording Ruby's finding as-is per the brief, not
    re-diagnosing.
  - *Loading label is hardcoded "Saving"*: matches what I saw in the actual
    Saving state (`16-saving.png`) — the label read "Saving" with no
    dynamic content, consistent with the finding.
- **Large image resize (stored object size)**: **UNTESTABLE** by the means
  available to me. Logcat only showed Glide's *rendered* ImageView pixel
  dimensions (`[231x231]`, `[84x84]`) for the loaded avatar, never a byte
  size or the *source* image's original resolution before
  `expo-image-manipulator`'s resize — Glide logs what it decoded for
  display, not the upload payload. I don't have Supabase Storage dashboard
  or Management API access from this session to check the stored object's
  actual byte size. The upload did succeed under the bucket's 2MB limit
  (confirmed by the lack of any size-related error), which is indirect
  evidence the resize step ran, but I can't confirm the exact 512×512
  target dimension or byte count this way.

### 5. Saving state, Cancel discards edits, back navigation
- **Saving state**: caught it live — Save's label replaced by a spinner +
  "Saving", button stays gold-colored, Cancel visibly disabled (couldn't be
  tapped), avatar/field dimmed. Matches DESIGN.md. PASS. `16-saving.png`.
- **Cancel discards edits**: typed `changedtag99` (valid, unsaved) → tapped
  Cancel → returned to My Profile still showing the previously-saved
  `@justin_qa`, not the discarded edit. PASS. `46-before-cancel.png`,
  `49-cancel-result.png`.
- **Back navigation discards edits**: separately, typed `backtest99`
  (valid, unsaved) → pressed the hardware Back key (not the Cancel button)
  → same result, returned to My Profile still showing `@justin_qa`, edit
  discarded, no crash, no "unsaved changes" prompt. PASS.
  `50-before-back.png`, `51-back-nav-result.png`.

### 6. Regression
- **Profile states**: loading shimmer and loaded state both reconfirmed
  fresh on the cold relaunch in item 1. PASS.
- **Build 5 (sign-in persistence)**: confirmed via the same cold relaunch —
  app landed signed in as Justin with no sign-in screen. PASS.
- **/debug (Builds 2-4)**: all three reachable and working from the
  unguarded debug route (`perchable://debug` deep link):
  - Build 2 (Supabase): "CHECK CONNECTION" → "Supabase: connected". PASS.
    `57-check-connection2.png`.
  - Build 3 (TMDB proxy): "FETCH POPULAR MOVIES" → 5 titles + attribution
    string verbatim. PASS. `59-tmdb-result.png`.
  - Build 4 (Sentry): "SEND TEST ERROR TO SENTRY" → "Sent — event ... at
    ...". PASS. `61-sentry-result.png`.
  (Mis-tapped "SIMULATE BAD KEY" once by habit/stale coordinates during this
  pass, same as prior Builds' QA — not a regression, confirmed by
  re-running "CHECK CONNECTION" cleanly right after.)

### Logcat
Captured `--pid`-filtered logcat during the upload/retry sequence
(`logcat-upload.txt`). No `DEVELOPER_ERROR`, no `ApiException`, no `FATAL`,
no crash/ANR anywhere in this session. Notable lines (reporting verbatim,
not judging cause):
- Standard GC/lifecycle noise (`Background concurrent mark compact GC`,
  `NativeAlloc concurrent mark compact GC`) — routine.
- One SELinux denial: `W pool-6-thread-1: type=1400 audit(0.0:63): avc:
  denied { read } for name="version" dev="proc" ... tclass=file
  permissive=0 app=com.tsujintsujin.perchable` — flagging per team rule,
  not judging cause.
- Glide load lines for the avatar URL (`.../avatars/<uid>/avatar.jpg?v=...`)
  confirming the cache-busted URL pattern from Bella's log works as
  described.

### Housekeeping / environment notes
- Hit the Android dev-client's built-in **Element Inspector** overlay
  ("Tap something to inspect it") twice by accident while trying to
  refocus the usertag `EditText` — a single `adb shell input tap` on the
  field did not reliably focus it every time in this session (no keyboard
  appeared), and my retry attempts (extra taps, keyevents) apparently
  toggled the RN dev-menu's inspector instead of typing into the field.
  Recovered both times via the dev menu ("Toggle element inspector"). Not
  an app bug — a dev-client/ADB interaction quirk, noting it here in case
  it recurs for the next session.
- The emulator's Photos gallery contains **no non-screenshot images** —
  every "Recent" photo is a screenshot from this or a prior QA/Bella
  session (all named/dated from this app's own testing). I was unable to
  set "a real-looking photo, not an app screenshot" as instructed, because
  none exists on this device. The account's photo is left as whatever the
  last successful upload in this session produced (itself a screenshot,
  picked from the same limited gallery) — flagging for the Manager: if a
  real-looking photo matters for later Builds' screenshots/demos, the
  emulator's gallery needs one added (e.g. `adb push` a real image into
  `/sdcard/Pictures/` before the next session).

### UNTESTABLE
- **True usertag collision** (second taken usertag) — no second account
  exists; asking the Manager for an approved way to seed one directly in
  Supabase without app sign-up (see item 3).
- **Exact debounce timing/request count** — no logcat visibility into
  `fetch` calls and no Supabase dashboard/API log access this session;
  behavioral result (no visible flood/flicker) does pass.
- **Stored avatar object size / exact resize target** — no Supabase Storage
  dashboard/API access this session; only Glide's rendered-pixel-size log
  lines were available, which don't confirm the upload payload's byte size
  or the manipulator's actual output dimensions.

### Bugs
None found beyond the three already-known findings from Ruby, which were
recorded as observed (see item 4) per the brief's instruction not to
re-diagnose them.

### Verdict
**PASS** — Build 7's done-means (usertag + photo change, both persist
after force-stop/relaunch) is confirmed. Usertag validation rules,
own-tag-exclusion, cancel/back-discards-edits, saving state, and photo
cancel/error/retry all PASS. Three items are UNTESTABLE by the means
available in this session (true collision, exact debounce count, stored
object size) rather than failing — flagged above for the Manager. No new
bugs found; the three known findings from Ruby were reproduced/observed as
described, not re-diagnosed.

Usertag left as `justin94test` and the app left **signed in** at the end of
both sessions, per instruction. Photo could not be reset to a non-screenshot
image — see "Housekeeping" above. Metro stopped in both sessions; port 8081
confirmed free each time (`netstat` showed no LISTENING socket after killing
this session's own `node.exe`, matched by command line to `expo/bin/cli
start --dev-client` in this app's folder before killing it).

## Build 7 · Bug 1 — three fixes from Queenie/Ruby

### 1. `canSave` didn't account for an in-flight upload
`edit.tsx`'s `canSave` only checked `availability.status === "available" &&
!saving` — a photo upload and a usertag save are two separate writes to the
same `profiles` row, and DESIGN.md's uploading-photo state spec is explicit
that the rest of the form (usertag field + Save) should be disabled/dimmed
so one can't race the other. Fixed: `isUploading` is now computed once,
early, and folded into `canSave` (`&& !isUploading`); the usertag label,
input row and `TextInput.editable` now also key off `saving || isUploading`
instead of `saving` alone. Cancel is deliberately **not** gated on
`isUploading` — DESIGN.md: "Cancel stays tappable [during upload] — cancels
the upload too" — it stays gated on `saving` only, matching the Saving
state's own spec ("Cancel becomes disabled too — no cancelling mid-write").

### 2. Cancel/back during an upload didn't actually cancel anything
The real bug here wasn't just "Cancel doesn't set a flag" — it's that
**`supabase-js` gives no way to abort an in-flight `storage.upload()` or
`.update()` call at all.** So "cancel the upload" can't mean "stop the
network request"; it has to mean "the request is still going to finish, but
don't act on its result, and don't touch state on a screen that's gone."

That reframing is also what makes the second part of the bug real:
**the original `uploadAvatar` always wrote to the same fixed path**
(`<uid>/avatar.jpg`, upserted). Walking through what a user actually sees:
tap the avatar → pick a photo → tap Cancel while the spinner is showing →
screen closes. The upload — already in flight, uncancellable — finishes a
moment later and overwrites `avatar.jpg` in Storage with the *new* photo's
bytes, at the *same path* the *old*, still-saved `avatar_url` points to.
The old URL's `?v=<timestamp>` query string only changes the client cache
key — it does nothing to the object identity on the server. So the moment
any cache (the RN `Image` component's, or a CDN edge) is bypassed —
including on a cold relaunch, which is exactly the scenario named in the
brief — the "old" URL starts serving the cancelled photo. Skipping the
`updateProfile` call on cancel (the obvious first fix) does **not** fix
this on its own, because the DB row was never the problem — the shared
*path* was.

**Fix, in two parts:**
- `uploadAvatar.ts` now writes to `<uid>/avatar-<timestamp>.jpg` — a
  uniquely-named object **every single upload**, never reused, never
  upserted over. A cancelled upload's object exists in Storage but nothing
  ever points at it, so nobody ever sees it. This also removes the need for
  the old `?v=` cache-busting query entirely (the path itself is already
  unique per upload) and it removes the race *by construction* rather than
  by timing — there's no window, however small, where overwriting a
  still-referenced path is possible, because no path is ever shared between
  two different uploads. ⚠️ Big decision (this is the "e.g. upload to a
  temp name and only move/upsert on commit, or accept + document" choice
  the brief asked me to make): I didn't use a temp-name-then-move design —
  moving a temp object onto a shared final path would just reintroduce the
  same class of overwrite race on the *move* step, at a smaller but nonzero
  window. Making every upload's path unique removes the race entirely
  instead of shrinking it.
- `edit.tsx` adds a `cancelledRef` (a ref, not state — it has to be read
  synchronously from inside an already-running async function without
  itself causing a re-render on a screen that's unmounting). It's checked
  after every `await` in the pick → upload → save chain, per the brief's
  instruction, and is set `true` by: Cancel's `onPress` (before calling
  `router.back()` — set-before-navigate matters because the back
  transition isn't instant), the header back arrow's `onPress` (reuses the
  same `handleCancel`), and — as the catch-all for the Android hardware
  back/gesture case, which unmounts the screen without going through either
  `Pressable` — the component's unmount cleanup. **Critically, the
  `updateProfile({avatarUrl})` call itself is skipped when
  `cancelledRef.current` is true** (checked right after `uploadAvatar`
  resolves, before `updateProfile` is ever called) — that's the one call
  that would have made a cancelled photo visible even with the unique-path
  fix, by pointing `avatar_url` at it.
- One accepted, documented residual: a cancel landing in the few-ms window
  between the upload finishing and the small `.update()` call itself
  resolving can't be caught, for the same "no abort handle" reason as the
  upload. There's nothing to skip once that request has landed — the DB row
  already says the new photo. This is not a scenario a human tapping Cancel
  during the ~1s *visible* upload spinner can actually hit; it's flagged in
  the code as a known, accepted edge case rather than silently ignored.

**On-device verification (the part that actually mattered here — this
would have shipped broken on jest coverage alone).** First attempt: I fired
the CROP-confirm tap and the Cancel tap as two fully separate `adb`
commands with a `screenshot -> sleep 1 -> screenshot` round-trip between
them. The result looked exactly like the bug: even after a cold relaunch,
the avatar showed the "cancelled" photo. Before concluding the fix was
broken, I checked the actual DB row via the Supabase Management API
(`avatar_url` + `updated_at`) — `updated_at` matched the timestamp of that
attempt, meaning `updateProfile` genuinely *had* been called. Reasoning
through the timeline: my two `adb` round-trips plus a `sleep 1` put well
over two seconds between the CROP tap and the Cancel tap actually landing —
several times longer than the ~1s upload — so the pick→upload→save sequence
had already completed successfully *before* my (delayed) Cancel tap ever
reached `handleCancel`. That wasn't a bug; it was a test that never
actually attempted to cancel mid-upload. Fixed the test methodology (fired
CROP-confirm and Cancel as two taps in a single `adb shell` call with a
~350ms gap — enough for the native crop activity's finish transition to
hand control back to the Edit screen so Cancel is hittable, short enough to
still land inside the upload window) and reran: Cancel now navigated back
*immediately*, the avatar visibly stayed on the previous (pre-cancel)
photo, `updated_at` in the DB was unchanged from before the attempt, and a
full force-stop + cold relaunch afterward still showed the old photo — not
the cancelled one. Confirmed clean with `logs/evidence/build-07/bug2g-tight2.png`
(immediately after Cancel) and `bug2-final-cold-check.png` (post cold
relaunch).

(Also noted, not a bug: a stuck-looking semi-transparent "ghost" of an old
screenshot rendered inside the avatar circle across several screenshots
this session, surviving a screen power-cycle. It stopped appearing after
enough further navigation/redraws and didn't correlate with which photo was
actually picked each time — concluded this was an emulator-level stuck
compositor layer, not app state, and cross-checked against the DB directly
rather than trusting the screenshots alone once it showed up.)

### 3. `Button`'s loading label was hardcoded "Saving"
Fine for Build 7's Save button, wrong for any other future loading button
(Build 9's delete-confirmation button needs "Deleting…"). Added
`loadingLabel?: string` to `Button`'s props, defaulting to `label` so a
caller that doesn't care still gets sane text instead of nothing; Save now
passes `loadingLabel="Saving"` explicitly since "Save" and "Saving" are
different strings, so the default alone wouldn't reproduce Build 7's
existing look. `__tests__/button-test.tsx` (new) covers the default and the
explicit-override case directly, rather than only indirectly through
`edit-profile-test.tsx`'s Save-button assertions, since this is now a
shared primitive.

### Tests added/adjusted
- `edit-profile-test.tsx`: two new tests — "disables Save and the usertag
  field while a photo is uploading" (holds `uploadAvatar`'s promise open
  with a manually-resolved `Promise` so the mid-upload state is actually
  observable, asserts `Save`'s `accessibilityState.disabled` and the
  usertag `TextInput`'s `editable`) and "cancel mid-upload does not call
  updateProfile with the cancelled photo" (same held-open promise; presses
  Cancel before resolving it, asserts `updateProfile` was never called).
  Also added a mock for `expo-router`'s `router.back()` — the real
  implementation depends on a navigation store that only a mounted
  Stack/root layout initializes, which an earlier test in this file had
  been relying on by test-order accident rather than by being correct on
  its own terms; mocking it makes every test's use of `router.back()`
  deterministic regardless of order.
- `button-test.tsx` (new): default-to-`label` and explicit-`loadingLabel`
  cases for `Button`'s loading state.

### Gates
`npx tsc --noEmit` — pass. `npx expo lint` — pass. `npx jest` — pass, 5
suites / 20 tests (4 new: 2 in `edit-profile-test.tsx`, 3 in
`button-test.tsx` — see above).

### Nit (no code, per the Manager's instruction)
`useOwnProfile` now refetches on every focus on two separate screens
(My Profile since Build 7, and this Edit screen implicitly re-fetching
through the same hook when navigated back to) via plain `useFocusEffect` +
`useState`, not TanStack Query. PLAN.md schedules TanStack Query starting
Build 12 for movie data; worth revisiting `useOwnProfile` at that point to
fold it into the same query-client/cache instead of its own hand-rolled
focus-refetch, rather than carrying two different data-fetching patterns
for user-owned data indefinitely.

## Build 7 · Bug 1b — orphaned avatar objects never cleaned up

Bug 1's unique-path-per-upload fix (`avatar-<timestamp>.jpg`, never reused)
correctly stopped a cancelled upload from ever overwriting a still-live
avatar — but it introduced its own problem: **nothing ever deleted the
object a successful change superseded, or the object a cancel left behind.**
Every photo change, and every cancelled pick, permanently grew the user's
`avatars/<uid>/` folder by one object. Confirmed live: by the time this Bug
started, the folder held 6 objects for one account with only 1 ever
referenced by `profiles.avatar_url` — five pure orphans, only ever cleaned
up by full account deletion.

### Fix

New file `src/modules/profile/api/deleteAvatarObject.ts`:
- `extractOwnAvatarPath(avatarUrl, userId)` — a pure function, the entire
  safety boundary for this feature. Pulls the Storage path out of a public
  avatar URL and returns it **only** if the URL is unmistakably this app's
  own `avatars` bucket, under this exact user's own folder. Returns `null`
  (nothing to delete, silently) for a Google-provided avatar URL (Build 5/6
  can leave one before any photo is ever uploaded), a different bucket, or
  — defense in depth, since RLS already prevents `avatar_url` from ever
  pointing outside the caller's own folder — any path whose first segment
  isn't `userId`. Getting this function wrong would mean deleting the wrong
  object, not just missing a cleanup, so it's tested directly and in
  isolation (`__tests__/deleteAvatarObject-test.tsx`), not just indirectly
  through a screen test.
- `deleteAvatarObject(userId, avatarUrl)` — calls
  `storage.from('avatars').remove([path])` for the extracted path. **Never
  throws.** A failed cleanup must never surface as a save/cancel error to
  the user — per the brief, failures are Sentry-reported only. The object
  it fails to delete is at worst a few KB sitting in Storage until account
  deletion's own full-folder cleanup sweeps it anyway.

`edit.tsx`'s `handlePickPhoto` now calls it at both points that leave an
object behind:
- **Cancel, after the upload has already finished** (the branch that used
  to just `return`): deletes the object at the URL the upload itself just
  produced. The brief's own framing matters here — *"cancel can land while
  the upload is still in flight; think through that timing (the upload
  resolves after the screen is gone — the chain still runs to the
  cancelled check, so remove there)."* This is exactly what already
  happens: `handlePickPhoto`'s promise chain isn't stopped by the screen
  unmounting — only React stops re-rendering; the `await uploadAvatar(...)`
  still resolves on its own time, the cancelled-check still runs, and now
  that check deletes instead of just walking away.
- **A successful replace, right after `updateProfile` commits**: deletes
  the *previous* `avatar_url` — captured into `previousAvatarUrl` at the
  very top of `handlePickPhoto`, before the pick/upload/save chain does
  anything, so it's exactly "whatever was showing when the user tapped to
  change it," independent of what that chain does afterward.
  `deleteAvatarObject`'s own `null`-return handles "there wasn't a previous
  photo yet" and "the previous one was a Google URL, not ours" — both are
  no-ops, so this call is safe to make unconditionally whenever
  `previousAvatarUrl` is truthy.

### RLS check (per the brief — verified, not assumed)
`supabase/migrations/20260926010000_avatars_storage.sql` already has
`avatars_delete_own_folder` (`for delete`, `to authenticated`, same
own-folder-prefix check as the other three policies) — written in Build 7
Part 1, applied by the Manager alongside the rest of that migration.
Confirmed it's actually live in the database (not just in the migration
file) via the Management API:
```
select policyname, cmd, roles from pg_policies
where tablename = 'objects' and schemaname = 'storage';
```
returned `avatars_delete_own_folder | DELETE | {authenticated}` alongside
the select/insert/update policies. No migration change needed — the owner
could already delete their own-folder objects; the app just never called
delete before now.

### Tests
- `deleteAvatarObject-test.tsx` (new) — five cases for
  `extractOwnAvatarPath`: normal own-avatar URL, a URL with a `?v=` query
  string (old cache-bust style, still handled), a Google avatar URL, another
  user's avatar path, and a different bucket. All pure, no mocking.
- `edit-profile-test.tsx` gains two tests: "deletes the previous avatar
  object after a successful photo replace" (asserts `deleteAvatarObject`
  called with the *old* URL) and "deletes the just-uploaded object when
  cancelled after the upload finished" (asserts it's called with the
  *cancelled* URL, and only that one — not the profile's original avatar).

### On-device verification

This was the harder half of this Bug to verify honestly, and it's worth
recording how, because two different things went wrong along the way and
both needed ruling out before trusting a result.

**Emulator instability.** The session started with `emulator-5554` already
ANR'd ("Process ... failed to complete startup", 170% CPU, all kernel time
— the same degraded-emulator pattern this app's CLAUDE.md documents) —
recovered with `adb reboot` + settle, per that doc. It degraded and needed
a second full reboot partway through this same Bug's verification (another
ANR, then a "Bundling 54%…" progress bar that stayed frozen at 54% for over
a minute after the second reboot). Both recoveries followed the documented
procedure; the second one still hadn't produced a stable enough window to
get a bundle to finish by the time I stopped trying — see "UNTESTABLE"
below.

**My own tap-timing mistakes, twice.** Verifying "cancel deletes the
just-uploaded object" means landing a Cancel tap inside the real upload's
~1s window — every attempt that missed that window just produced another
ordinary successful save (confirmed by the DB's `updated_at` moving), not
a test of the cancel path at all. Two distinct false signals came from
this before I got a clean read:
1. A **false negative**: my first attempt's Cancel tap landed roughly two
   seconds after the CROP confirm (two separate `adb` round-trips plus a
   `sleep 1` before I even checked), well past the upload window — the
   pick had already completed normally. The avatar showing the "cancelled"
   photo (even after a cold relaunch) looked exactly like a broken fix; it
   wasn't one, my tap was just too late to test what I meant to test.
2. A **false positive**, the opposite mistake: I checked `avatar_url`
   *immediately* after a Cancel tap, saw it unchanged, and read that as
   "cancel worked" — but `updateProfile`'s own request was still in flight
   at that exact instant, and a later check (after everything settled)
   showed it *had* actually landed a couple of minutes later. Only a check
   repeated **both** immediately after the tap and again after a real
   settle period (a few seconds, not a snapshot mid-flight) is trustworthy
   for this — a single point-in-time DB read can lie in either direction
   depending on exactly when it's taken relative to an in-flight request.

Also reproducible, unrelated to the pass/fail question itself: tapping
CROP-confirm and a second button in quick succession sometimes opened this
app's own React Native dev menu instead of hitting the second button — a
touch-handling quirk of this specific dev-client/emulator combination
(matches Queenie's Build 7 QA note about the same overlay appearing by
accident). Recovered each time by dismissing it and retrying; not a
correctness signal either way.

**What was actually confirmed**, combining a clean DB read (checked both
immediately after the Cancel tap and again ~4s later, both times) with a
Storage object-count check:
- **Successful replace deletes the previous object** — confirmed
  **five separate times** across this session (every deliberate and
  every accidental successful replace): the object count stayed flat at 6
  every time (one new object added, one — the just-superseded one —
  removed), and `avatar_url` always matched the newest object.
- **Cancel after the upload finishes deletes the just-uploaded object, and
  never calls `updateProfile`** — confirmed cleanly once, with both checks
  agreeing: `avatar_url`/`updated_at` unchanged immediately after the
  Cancel tap *and* unchanged again ~4s later (ruling out the false-positive
  failure mode above), and the Storage object count still exactly 6
  afterward (no new orphan left behind).

### Retroactive cleanup of the pre-existing orphans — blocked, flagging for the Manager

The brief's last step — get the folder down to exactly 1 object (the
currently-referenced one) — needs deleting 5 objects that predate this fix
and were never the "previous" of any replace this fix's own cleanup ever
ran against, so the app's new code structurally can't reach them (by
design — it has no reason to enumerate a user's whole folder, only ever
acts on the one URL it already knows). The brief is explicit this must go
through the app flow or the Storage API, not SQL on `storage.objects` —
and I don't have a way to do either right now:
- **App flow** can't reach these 5 specifically, for the reason above —
  more replaces through the app only ever clean up their own immediate
  predecessor, never a historical orphan that's no one's "previous"
  anymore.
- **Storage API** needs a bearer token the Storage service accepts for
  deleting another path than the caller's own session — normally the
  project's `service_role` key. `D:\AIO Freelance\Credentials\perchable\.env`
  doesn't have one (checked: only `EXPO_PUBLIC_SUPABASE_URL`,
  `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_SENTRY_DSN`,
  `TMDB_API_KEY`, three `GOOGLE_*` values, and `SUPABASE_ACCESS_TOKEN` — an
  org-level Management API token, not a project `service_role` key. I
  tried it against the Storage API first and it correctly failed
  (`403 Invalid Compact JWS`) rather than silently doing something wrong.
- The Management API token I *do* have could run a raw SQL `DELETE FROM
  storage.objects` — but that's exactly the path the brief rules out, and
  for a real reason: `storage.objects` is Postgres-side metadata only:
  deleting a row there directly bypasses whatever the Storage service's own
  DELETE endpoint does to remove the underlying backend blob, which is the
  same class of "these two things can now disagree" bug this whole Bug was
  about in the first place. Using it here would risk trading five
  DB-orphaned-but-blob-present objects for a subtler version of the same
  problem, so I didn't.

**Before/after object list** (unchanged from the state above — cleanup
could not be attempted without one of the two approved methods):
```
Before (start of this Bug) / current, unresolved:
  5d77892a.../avatar.jpg                          <- orphan (pre-dates unique-path fix)
  5d77892a.../avatar-1790569875125.jpg             <- orphan
  5d77892a.../avatar-1790569958756.jpg             <- orphan
  5d77892a.../avatar-1790570289150.jpg             <- orphan
  5d77892a.../avatar-1790570397218.jpg             <- orphan
  5d77892a.../avatar-1790596041379.jpg             <- referenced by profiles.avatar_url (the sunset photo)
```
6 objects, 1 referenced, 5 orphaned — same shape as when this Bug started
(the specific orphan filenames rotated during on-device testing as the
*new* fix correctly cleaned up each new test's own leftovers, but the 5
pre-existing ones were never touched, by design, as explained above).

**Asking the Manager**: either add a `service_role` key for this project to
`Credentials/perchable/` (README-documented, never committed, per workspace
rules) so this and any future Storage-API cleanup task has a real path, or
explicitly authorize the SQL-DELETE fallback for *this one-time* cleanup
with the blob-orphan risk above accepted. Not doing either unilaterally.

### Gates (Bug 1b)
`npx tsc --noEmit` — pass. `npx expo lint` — pass. `npx jest` — pass, 6
suites / 27 tests (7 new: 5 in `deleteAvatarObject-test.tsx`, 2 in
`edit-profile-test.tsx`).

## Manager — blank-avatar diagnosis (2026-09-30)
**Not an app bug.** The blank avatar (`avatar-1790637215640.jpg`, solid 250 grey)
came from the source image, not the pipeline:
- QA screenshots saved to `/sdcard/*.png` (162 of them) were indexed by Android
  into the photo gallery. `screen3.png` (added 1790636523, 11 min before the
  upload) has a centre 1080×1080 square of exactly RGB 250 — the default 1:1
  crop of it is the blank avatar.
- The logcat line `Bitmap from LOCAL ... [-2147483648x-2147483648]` is Glide's
  `SIZE_ORIGINAL` constant (Integer.MIN_VALUE), not a corrupt decode. It appears
  on the good run too.
- Re-run on td_emu with the current bundle (0d31d26): pick `test-avatar.jpg` →
  native crop → upload. Stored object `avatar-1790734341563.jpg` is 512×512,
  8.9 KB, full colour range; Edit profile shows the sunset. Old blank object now
  returns 404 NoSuchKey (replace-cleanup works). Evidence: `evidence/build-07/manager-avatar-rerun.png`.
- No "reject blank image" validation: a solid-colour photo is a legal user
  choice, and the pipeline is faithful.
- Fix is process: 247 QA files moved from `/sdcard` to `/data/local/tmp/qa`
  (gallery now holds only `Pictures/test-avatar.*`); `queenie.md` now forbids
  saving to `/sdcard`. Added to LESSONS.md.

## Build 7 · Bug 2 — session storage and auth ordering (Bella)
Base SHA: 0fb1f71 (branch `module/auth`). The blank avatar was diagnosed as not a code bug; the avatar pipeline was not touched.

### a. act() warnings
- **Cause:** the cancel-mid-upload test awaited `waitFor` inside `act(async …)`, which overlaps act scopes and let the "uploading" state update land outside act.
- **Fix:** `__tests__/useAvatarUpload-test.tsx` — the pick and cancel presses each get their own awaited `act`, and `waitFor` runs outside them. The test still asserts `updateProfile` is never called and the uploaded object is deleted exactly once.
- **Evidence:** full `npx jest` output, `grep -c "act("` = **0**.

### b. Legacy plaintext session
- **What:** `LargeSecureStore.getItem` (`src/lib/supabase.ts`) now removes the AsyncStorage entry (via `removeItem`, which also clears SecureStore) and returns null when the value can't be decrypted.
- **Why:** Builds 1–7 left the session as plain JSON on disk until the next sign-in. Deleting it on first read means a plaintext token doesn't outlive the upgrade.
- **Also:** hex validation (`HEX_PATTERN`) so a corrupt value is caught instead of decrypting to garbage.
- Tests: `__tests__/LargeSecureStore-test.ts` (plaintext removed, encrypted round-trip, empty storage removes nothing, corrupt hex, SecureStore throws, removeItem clears both).

### c. AuthProvider ordering
- **Checked:** auth-js `onAuthStateChange` awaits initialisation then `_emitInitialSession` calls the callback with `INITIAL_SESSION`. It does NOT always fire: `_useSession` / `__loadSession` are try/finally with no catch, and the callback try/catch does not wrap them, so if storage `getItem` rejects, INITIAL_SESSION never fires and `isLoading` would stay true forever (round 2 finding).
- **Root fix (round 2):** `LargeSecureStore.getItem` is now guaranteed never to reject — every failure is reported to Sentry and returns null, so INITIAL_SESSION always fires.
- **Fix:** `getSession()` removed; `src/modules/auth/AuthProvider.tsx` sets session and `isLoading=false` from the listener only, so there is one writer and a stale result can't overwrite a newer session. The cleanup `unsubscribe()` removes the emitter, so no setState after unmount.
- Tests: `__tests__/AuthProvider-test.tsx` (loading until the first event; clears on INITIAL_SESSION null and non-null; later SIGNED_OUT applies; unsubscribe on unmount).

### Failure modes
| Failure | Handling |
|---|---|
| Corrupt / undecryptable value (bad hex) | `_decrypt` returns null, entry removed via `removeItem`, user signed out, no crash. Test: corrupt-hex case. |
| SecureStore throws | Caught in `getItem`, `Sentry.captureException`, returns null, user lands on sign-in. Entry is kept in case the failure is transient. Test: throws case. |
| Cold launch with a valid encrypted session | Still signed in. Test: round-trip. On device: force-stop, relaunch, Home then Profile shows @justin94test (`logs/evidence/build-07/bug2-relaunch.png`). |
| Sign-out (`removeItem`) | Still clears both stores. Test: removeItem case. |

### Spec-trace
| Item | Implemented | Tested |
|---|---|---|
| a. zero act() warnings | `__tests__/useAvatarUpload-test.tsx` cancel test | jest output, 0 matches |
| b. plaintext removed, null returned | `src/lib/supabase.ts` `getItem` | `LargeSecureStore-test.ts` plaintext / round-trip / empty |
| c. no stale overwrite, isLoading from listener | `src/modules/auth/AuthProvider.tsx` effect | `AuthProvider-test.tsx` |

### Gates
`npx tsc --noEmit` pass. `npx expo lint` pass. `npx jest` pass, 10 suites / 39 tests, 0 "act(" matches. App bundled on Metro (1975 modules) and launched on td_emu; Metro stopped.
Files outside the listed scope touched: none. Note: `MSYS_NO_PATHCONV=1` is needed for `/data/local/tmp` paths in Git Bash.

### Round 2 (Ruby's review)
Base 64fa661. No emulator/Metro used; unit tests only.
- **getItem never rejects** (`src/lib/supabase.ts`): AsyncStorage read, SecureStore read and the purge sit inside one try; any error goes to Sentry and returns null.
- **Two failure kinds separated:** SecureStore I/O error (`getItemAsync` throws) keeps the entry (transient), Sentry, null. Decrypt failure (aes-js throws, e.g. wrong key length, or bad hex) is undecryptable, so purge and null, no Sentry (expected, self-heals).
- **removeItem** attempts both deletes with `Promise.allSettled` and rethrows the first failure, so sign-out clears what it can.
- Comments wrapped to two lines.

| Failure | Handling |
|---|---|
| AsyncStorage.getItem rejects | Sentry, resolves null, user on sign-in. Test. |
| Purge (removeItem / deleteItemAsync) rejects | Sentry, resolves null. Test. |
| Key of wrong length | aes-js throws, treated as undecryptable, purged, null. Test. |
| SecureStore getItemAsync throws | Entry kept, Sentry, null. Test. |
| removeItem: AsyncStorage throws | SecureStore key still deleted, error rethrown. Test. |

Gates: tsc pass, lint pass, jest 10 suites / 43 tests; full output (stdout+stderr) has 0 "act(" and 0 console.warn/error.

## QA 2 (combined) — Queenie, 2026-09-30, HEAD 5c65cd4
Run on td_emu, dev build, Metro started by me (stopped, port 8081 confirmed free). Signed in as @justin94test the whole run. Nothing written to /sdcard (screens via /data/local/tmp). Test photo: `/sdcard/Pictures/test-avatar.jpg` only. Storage/DB state read with read-only SELECTs (Management API) after each action. Evidence: `evidence/build-07/qa2-*.png` (the older `evidence/build-07/qa2/` folder is the cut-off run, not used).
Final state restored: usertag `justin94test`, 1 object in `avatars/<uid>/`, referenced by `profiles.avatar_url`.

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | Save disabled during upload | PASS | qa2-01-save-disabled-uploading.png (usertag edited to valid `justin94qb`, Save was enabled, then during upload: Save + field dimmed, caption "Uploading photo…"); qa2-01-picker-with-edit.png (before) |
| 2 | Cancel mid-upload keeps old photo, no stray object | PASS | qa2-02-cancel-midupload.png (Edit sliding away mid-upload), qa2-02-profile-after-cancel.png. DB `avatar_url` and `updated_at` unchanged 2 checks (6 s and 11 s after), bucket still exactly 1 object |
| 3 | Loading label = DESIGN copy | PASS | qa2-03-saving-label.png (spinner + "Saving", Cancel dimmed) |
| 4 | Replace deletes old object | PASS | qa2-04-after-replace.png. Old URL `.../avatar-1790734341563.jpg` → HTTP 404 `NoSuchKey`; new `.../avatar-1790735267719.jpg` → 200, 8954 B, 512x512, full colour range (not blank); bucket had 1 object. Checked via public URLs + `storage.objects` SELECT (/debug shows no URLs) |
| 5 | Usertag invalid / valid / revert | PASS (taken-error UNTESTABLE) | qa2-05-invalid-digit-start.png (`9abc`: Save disabled, always-on helper text); qa2-05-usertag-valid.png (Save enabled); qa2-05-profile-new-usertag.png (@justin94qa on My Profile, DB matches); qa2-05-profile-reverted.png (@justin94test) |
| 6 | Session survives force-stop → cold start | PASS | qa2-06-cold-relaunch.png (Home with avatar, no sign-in) |
| 7 | /debug opens and works | PASS | qa2-07-debug.png, qa2-07-debug-check.png ("Supabase: connected") |
| 8 | Standards-pass regression | FAIL (1 Bug) | qa2-08-profile.png, qa2-03-edit-idle.png, qa2-06-cold-relaunch.png vs build-06/bug1-profile-settings-chip.png, build-06/home.png, build-06/bug1-tabbar.png, build-07/edit-idle.png |
| 9 | Logcat | PASS, no crashes (2 error-level messages listed below) | `logcat -b crash` empty |

### Bug
**Build 7 · Bug 3 — Poppins headings now render in the system sans-serif (standards-pass regression)**
- Steps: open Profile tab, open Edit profile.
- Expected (DESIGN.md §1.5: `subhead`/`title`/`display` = Poppins 700/800): "My Profile", "Justin Masiga", "Edit profile" in geometric Poppins.
- Actual: they render in a Roboto/Inter-like bold. Before: `build-06/bug1-profile-settings-chip.png` ("My Profile", "Justin Masiga") and `build-07/edit-idle.png` ("Edit profile") are Poppins. Now: `qa2-08-profile.png`, `qa2-03-edit-idle.png`. Body text (Inter) is unchanged. Fonts are still loaded in `_layout.tsx` (`Poppins_700Bold`, `Poppins_800ExtraBold`), and `tokens.ts` `type.title` etc. set both `fontFamily: "Poppins_800ExtraBold"` and `fontWeight: "800"`. Unconfirmed guess for Ruby: on Android a `fontWeight` next to a custom family can bypass the custom file — check with the weights removed. Commits touching tokens: 31779cf, 7a955e2 (Standards).

### Other design differences vs earlier evidence (no other bug)
- Vertical layout shifted up: My Profile header title 157→153, avatar top 272→263, "Edit profile" row 851→820 (display px, 900 wide); Edit profile: title 154→148, avatar 265→249, buttons 915→899. Header no longer overlaps the status bar; no clipped text. Consistent with the safe-area change; Ruby to confirm it is intended.
- Settings chip on Profile now has a bordered chip (matches Build 6 Bug 1 fix). Tab bar colours pixel-identical to Build 6 Bug 1 fix (30,26,38).
- Uploading state is a small spinner over the dimmed old photo, not the DESIGN.md determinate ring with a centred percentage. Not asked in this QA; Ruby judge (supabase-js has no upload progress event, per Build 7 log).

### Observations for Ruby (not asserted as bugs)
1. Race: qa2-01-race-save-tapped-before-upload-state.png. If Save is tapped in the ~0.2 s after the crop closes and before "Uploading photo…" appears, Save is still enabled; the save went through ("Saving"), the screen closed, and the picked photo was silently never uploaded (DB `avatar_url` unchanged, no new object, no error). Too fast for a human but a real window.
2. One upload out of 5 (the first one, under emulator `network speed gsm`) silently did nothing: crop closed, screen stayed idle ("Tap to change photo"), no spinner, no error, no object created, DB unchanged, even after restoring the network. Not reproduced in 4 later attempts (including one under gsm throttle), so cause unknown. Screenshots of it: qa2-01-uploading-a/b/c.png show the idle screen; qa2-01-after-restore.png.
3. Debug screen (qa2-07-debug.png) is a light unstyled page; status-bar icons/clock are white on near-white and hard to read.

### Logcat (exact text, package com.tsujintsujin.perchable, *:E)
- `E unknown:ReactNative: Unable to display loading message because react activity isn't active, message: Loading from 10.0.2.2:8081…` and `... message: Reloading...` (at each dev-client launch, 4 lines).
- `E FrameTracker: force finish cuj, time out: J<IME_INSETS_SHOW_ANIMATION::0@1@com.tsujintsujin.perchable>` / `J<IME_INSETS_HIDE_ANIMATION::1@1@com.tsujintsujin.perchable>` (6 lines, on keyboard show/hide).
- W-level (not errors): `ViewManagerPropertyUpdater: Could not find generated setter for class io.sentry.react.RNSentryOnDrawReporterManager` / `RNSentryReplayMaskManager` / `RNSentryReplayUnmaskManager`.
- No FATAL EXCEPTION, no JS red screen, no Metro warnings.

### UNTESTABLE
- "That usertag is already taken." copy: only one profile exists, so no second account to collide with. Covered in the earlier QA section 3; Justin can check with a second Google account.

### Verdict (QA 2)
PARTIAL — all functional items (1-7, 9) pass with DB/Storage proof; item 8 fails on 1 Bug (Build 7 · Bug 3, heading font).

## Build 7 · Bug 3 — fonts, pick/resize race, silent upload (Bella)
Base SHA: fb6603f.

### 1. Headings in the system font
- **Cause:** the standards pass spread `type.*` tokens into styles; the tokens carried `fontWeight` next to a single-weight custom family (`Poppins_800ExtraBold`), which makes Android fall back to Roboto.
- **Fix:** `fontWeight` removed from every `type` token in `src/ui/tokens.ts` (the family name already encodes the weight). No other `fontWeight` beside a custom family in `src/` (only `debug.tsx`, dev screen, left alone). Test: `__tests__/tokens-test.ts`.
- **Evidence:** `logs/evidence/build-07/bug3-fonts.png` (My Profile, Poppins headings). Edit profile also checked on device: Poppins header, Inter body/labels.

### 2. Photo picked then Save within ~0.2 s dropped
- **Cause:** `uploading` was set only after `pickAvatar()` returned, and that included the resize, so Save was enabled during the resize.
- **Fix:** `pickAvatar` split into `pickAvatarAsset` (picker + crop) and `prepareAvatar` (resize) in `src/modules/profile/pickAvatar.ts`. `useAvatarUpload` sets `uploading` as soon as the picker returns an asset, before the resize. Resize failure goes through the same catch as upload failure (error state, Sentry). Cancel is re-checked after the resize.
- Tests (`__tests__/useAvatarUpload-test.tsx`): uploading while resize pending, upload waits for resize; resize failure gives error and no upload; picker cancel stays idle.

### 3. One of five uploads did nothing — investigated
Paths where `pickAndUpload` returns with no state change: (a) `isUploading` already true; (b) `userId` undefined (profile not loaded); (c) `cancelledRef` true after the picker (set by unmount or Cancel; but it is reset to false at the start of every call, so it cannot be stale-true across calls); (d) picker returns canceled / no asset; (e) media permission not granted (silent).
- (a) and (c) are not reachable on the reported flow. (b) needs the profile unloaded, but the screen had loaded data. The stale-closure window (`isUploading` false until re-render) exists only during the pick/resize, where a second tap can't reach the avatar while the picker covers it; the resize window is now closed by fix 2.
- **Conclusion: no code path found that explains it, so no guess-fix.** The most likely cause is the picker itself returning canceled: expo-image-picker crop on Android can return `canceled` if the activity result is lost (activity recreated) or the crop is dismissed. Not reproducible from code. Note (e): a denied permission also returns silently with no message — a UX gap, not this report; flagged for the Manager.

### Spec-trace
| Item | Where | Test |
|---|---|---|
| Poppins/Inter render | `src/ui/tokens.ts` type tokens | `tokens-test.ts`, bug3-fonts.png |
| Busy before resize | `src/modules/profile/hooks/useAvatarUpload.ts` (setPhoto before prepareAvatar) | `useAvatarUpload-test.tsx` |
| Resize failure = error path | same try/catch | `useAvatarUpload-test.tsx` |

### Gates
tsc pass, lint pass, jest 11 suites / 47 tests, 0 "act(" and 0 console.warn/error in the full output (stdout+stderr). Metro started and stopped, 8081 free.

## QA 3 — Queenie, 2026-09-30, Bug 3 re-test (d911db3; tree at 71112d4 on module/auth)
Own Metro (`timeout 1800`, stopped, port 8081 free). Nothing written to /sdcard; test photo `test-avatar.jpg` only. Stored objects checked with SELECTs on `storage.objects` and the public URL. Final state: usertag `justin94test`, 1 object in `avatars/<uid>/`, referenced by `avatar_url`, 512x512, 8954 B, full colour range (not blank). No crash in `logcat -b crash`; no new error-level lines from the app beyond the known FrameTracker IME / "Unable to display loading message" ones.

| # | Item | Result | Evidence (`evidence/build-07/`) |
|---|---|---|---|
| 1 | Poppins headings, Inter body | PASS | qa3-01-fonts-profile.png ("My Profile", "Justin Masiga" Poppins; rows/usertag Inter), qa3-01-fonts-edit.png ("Edit profile" Poppins). Glyphs match build-06/bug1-profile-settings-chip.png. Home has no heading (placeholder text only) |
| 2 | Race: tap Save right after crop closes | FAIL, intermittent (1 of 7) | see below |
| 3 | One normal photo change | PASS | qa3-03-profile-before.png, qa3-03-normal-change.png (new object, old one deleted, `avatar_url` = new object, 1 object) |
| 4 | 3 more normal uploads: any do nothing? | PASS, none lost | qa3-04-normal-1/2/3.png. Each: `avatar_url` moved to a new object, old deleted, count 1 |

### Item 2 detail
Method: edit usertag to a new valid value (Save enabled), tap avatar, pick sunset, crop, then chained `input tap` on Save (792,1150) in one adb call starting with the CROP tap (12-30 taps, 0.05 s apart), background screenshot at ~0.9 s, then check DB + bucket ~6 s later.
- Runs 2-7 PASS (qa3-02-race-run2-frame.png, qa3-02-race-justin94qd-frame.png / -end.png, qa3-02-race-justin94test-frame.png, qa3-02-race-justin94qe-*.png, qa3-02-race-justin94qf-*.png, qa3-02-race-justin94test-end.png): frame shows "Uploading photo…" with Save and field dimmed; the Save taps are ignored; the photo uploads (new object, `avatar_url` moved, 1 object); the typed usertag stays on screen with Save enabled afterwards, and Save then persists it (qa3-02-run2-after-save.png shows @justin94test).
- **Run 1 FAIL** (qa3-02-race-run1-saving-no-upload.png, qa3-02-race-run1-end-settings.png): frame at 1.0 s shows the idle screen ("Tap to change photo", no "Uploading photo…") with Save in the "Saving" state. Result: usertag `justin94qc` saved, screen closed, photo NOT uploaded (`avatar_url` unchanged from ...708984, `updated_at` only from the usertag save, no new object, no error). So a Save tap can still land between the crop closing and the busy state being set — the same window as QA 2 observation 1, narrowed but not closed (1 of 7 runs hit it). Stray taps from that run then hit the Settings row on My Profile ("Coming soon" screen in qa3-02-race-run1-end-settings.png); that is my tap storm, not an app fault.
- For Ruby/Bella: busy must be set before `pickAvatar()` resolves back into JS (e.g. at the start of the pick call), not after; or Save must stay disabled while the picker/crop activity is open.

### Item 4 note
Lost-upload (QA 2 observation 2): 10 uploads this session (6 race runs + 4 normal) all completed; the only dropped photo is the run 1 race above. The single unexplained QA 2 case (first upload, no Save tapped) has still not recurred.

### Verdict (QA 3)
PARTIAL — Bug 3 font regression is fixed (item 1); the Save race is reduced but not eliminated (item 2, 1 of 7); items 3 and 4 pass.

## Build 7 · Bug 3, round 2 — race closed (Bella)
Base SHA: 71112d4.

### Cause
QA 3 lost 1 of 7 photos. The gap is between Android closing the crop activity and the JS picker promise resolving; no state set after `pickAvatarAsset()` returns can cover it.

### Fix (`src/modules/profile/hooks/useAvatarUpload.ts`, `pickAvatar.ts`)
1. **Busy before the picker opens:** `pickAndUpload` sets `uploading` first (the picker covers the screen, so nothing visible changes) and back to idle when the picker returns null. A picker that throws goes to the error state.
2. **Permission gate removed** from `pickAvatarAsset`: expo-image-picker's `ImagePicker.d.ts:77` says `launchImageLibraryAsync` needs the media-library permission on iOS 10 only, so the gate only added a silent do-nothing path.
3. **Cancel token instead of a boolean:** `runRef` is bumped by every new run and by `cancel()`; a run is stale if its number changed or the component unmounted (`mountedRef`, a ref because it is read in async code). This stops an old run from being revived when a new run starts after a Cancel.
4. **Cancel frees the busy state:** `cancel()` resets `photo` to idle when still mounted, so `isUploading` can't stay stuck; nothing is set after unmount.

### Tests (`__tests__/useAvatarUpload-test.tsx`)
Uploading while the picker promise is pending and idle after a picker cancel; picker throws gives error; cancel while the resize is pending never uploads. Checked that this last test fails (1 failed) when the post-resize stale check is removed, and passes with it restored.

### Failure modes
| Case | Handling |
|---|---|
| Save tapped between crop closing and promise resolving | already busy, Save disabled |
| Picker cancelled | idle, Save re-enabled |
| Picker throws | error state, Sentry |
| Cancel during resize / upload | run stale, no upload / uploaded object deleted, idle |
| Unmount mid-run | stale, no setState |

### On-device race test (td_emu, own Metro)
Same chain as Queenie: change usertag, tap avatar, pick, crop, then in the same adb call the CROP tap followed by 25 `input tap` on Save. 10 runs. After each run I queried the DB with `supabase db query --linked` (token from Credentials, not logged): `avatar_url` and the object count in `storage.objects` for bucket `avatars`.
**Tally: 10/10 — `avatar_url` changed every run, bucket held exactly 1 object every run.** Usertag reset to `justin94test` at the end (DB confirms; `avatar_url` still the last upload, 1 object). Screenshot: `evidence/build-07/bug3r2-race.png` (final My Profile). Nothing written to /sdcard. The usertag itself did not change in every run (my script's Save tap after the chain sometimes landed before the availability check finished); the photo criterion is unaffected.

### Spec-trace
| Item | Where | Test |
|---|---|---|
| Busy before picker | `useAvatarUpload.ts` setPhoto before `pickAvatarAsset` | pending-picker test |
| Picker cancel to idle | same, `!asset` branch | same test |
| Picker throws to error | catch | picker-throws test |
| No permission gate | `pickAvatar.ts` | n/a |
| Cancel during resize | `isStale()` after `prepareAvatar` | cancel-during-resize test |
| Cancel resets idle, no setState after unmount | `cancel`, `mountedRef` | cancel tests |

### Gates
tsc pass, lint pass, jest 11 suites / 50 tests, 0 "act(" and 0 console.warn/error in the full output (stdout+stderr). Metro stopped, 8081 free.

## Build 7 · Bug 3, round 3 — final review fixes (Bella)
Base SHA: 06d1fb3. Unit tests only.
- **Orphan after commit:** if cancel/unmount happened after `updateProfile` succeeded, the old avatar object was never deleted. Now, once `updateProfile` has succeeded, `previousAvatarUrl` is always deleted (the DB no longer references it); only the setState calls are skipped when stale. Test: cancel while `updateProfile` is pending, then resolve; old object deleted, state stays idle with the old URL.
- **Double tap within one render:** `inFlightRef` (a ref, since `isUploading` in the closure can still be false) blocks a second `pickAndUpload`; cleared in `finally` on every exit path. Test: two synchronous calls open the picker once.
- **Unmount mid-upload:** test that the landed object is deleted and `updateProfile` is not called (the `mountedRef` path).
- Files: `src/modules/profile/hooks/useAvatarUpload.ts`, `__tests__/useAvatarUpload-test.tsx`.
- Gates: tsc pass, lint pass, jest 11 suites / 53 tests, 0 "act(" and 0 console.warn/error in the full output (stdout+stderr).

## Build 7 — CLOSED (Manager, 2026-09-30)
- Commits: f2244fa build · fe9932b Bug 1 · ab235cf Bug 1b · 31779cf..0d31d26 standards pass ·
  5c65cd4 + f9fd67a Bug 2 · d911db3 + 06d1fb3 + 2aef266 Bug 3.
- Gates (Manager rerun at 2aef266): tsc clean, jest 53/53, 0 act()/console warnings in full output.
- QA: Queenie QA 2 (items 1–7 PASS) + QA 3 (fonts PASS, 4/4 normal uploads). Bella race 10/10.
- Review: Ruby PASS on Bug 2 r2, Bug 3 r1–r3.
- Manager spot re-run: pick → crop → 25 Save taps chained; Save stayed disabled ("Uploading photo…"),
  DB avatar_url changed, 1 object in bucket, usertag untouched (`evidence/build-07/manager-race-spotcheck.png`).
- Known limits: (1) after cancel(), a new photo tap is ignored until the old run settles — unreachable
  today (edit.tsx navigates away on cancel); fix if cancel ever stays on screen: clear inFlightRef in
  cancel() and only clear in finally when runRef.current === run. (2) If the native picker never
  resolves, photo taps stay ignored while mounted (same as before).
- UNTESTABLE → Justin: "That usertag is already taken." copy needs a 2nd Google account.
