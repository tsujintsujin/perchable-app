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
