# Lessons — checklist Bella reads before every Build, Ruby reviews against

Every item here was a real Bug (Build N · Bug M) that cost a fix round.
Handle each one up front; say in the Build log how (or "n/a").

## Spec compliance (5 bugs in Builds 5–7)
- [ ] Before committing, fill the **spec-trace table** in the Build log: every
      line of this Build's DESIGN.md section (each state, copy string,
      disabled/enabled rule, colour/token) → the file:line that implements it.
      A spec line with no row is not built. (B5 pressed style, B6 settings
      chip, B7 Save-during-upload, B7 Cancel-cancels-upload, B7 "Saving" label)
- [ ] Copy strings verbatim from DESIGN.md's copy table. Shared components
      never hardcode a caller's text (B7 Button).

## Failure paths (6 bugs)
- [ ] Every async action: what does the user see if it fails, is cancelled,
      is tapped twice, or the screen closes mid-flight? No setState after
      unmount; a cancel must stop the result being applied. (B7)
- [ ] Errors to Sentry: only unexpected ones. User cancels / validation
      failures are not exceptions. Always tag `environment`. (B4, B5)
- [ ] Server code: validate every input before forwarding it; error
      responses never echo keys, URLs with keys, or internals. (B3 ×2)
- [ ] Anything that creates a stored object/row: what deletes it when it is
      replaced, cancelled, or the account is deleted? No orphans. (B7 1b)
- [ ] Tests assert inside act() / use findBy — zero act() warnings. (B5)

## Platform (1 bug)
- [ ] Android: no real blur without `blurTarget` — use the flat-fallback
      tokens (`bg.elevatedFlat` base + tint). Check any visual effect on the
      emulator, not from docs. (B6)

## Environment (not app bugs, but cost hours)
- Short `GRADLE_USER_HOME`, tool background mode, clear `.cxx` after a
  long-path failure (B1, B2). Degraded emulator → `adb reboot` (B4).

## Coding standards (Manager review 2026-09-28, see logs/code-review-2026-09-28.md)
- [ ] Zero literal colors / font sizes / spacing in screens — tokens only;
      missing token → add one. Repeated UI → `src/ui/` component.
- [ ] Header top spacing from safe-area insets, never a fixed number.
- [ ] Shared state (auth) from one provider; data reset on sign-out.
- [ ] Session/tokens in secure storage, not plain AsyncStorage.
- [ ] Generated Supabase types for every query.
- [ ] Multi-step logic in a module hook, not the route file.
- [ ] 1–2 line purpose comment above every block; no Build/Bug history in code.
- (Ruby's checklist named tokens + secure-store and both were still missed
  across 7 Builds — Ruby now greps the diff for literals.)
- [ ] Gates mean zero warnings too: `npx jest` output must contain no
      "act(" warnings — pass count alone hid one (Standards pass, Manager missed it).
- [ ] Never commit a file you didn't write in this task under an unrelated
      message; new server code gets its own commit + log entry.

## Testing environment (Build 7 blank avatar — twice)
- [ ] QA never saves screenshots/dumps to `/sdcard` — the gallery indexes them
      and a screenshot gets picked as a "test photo". Use `/data/local/tmp`.
      Test photos only in `/sdcard/Pictures/`. Check a stored image's pixels
      before calling a pipeline broken.
- [ ] Removing a `.catch`/fallback (e.g. dropping `getSession()`): trace the
      library path that replaces it and prove it can't hang when *our* code
      throws. supabase-js never fires INITIAL_SESSION if storage rejects —
      storage adapters must never reject. (B7 Bug 2)
- [ ] Android custom fonts: text styles carry `fontFamily` only — a
      `fontWeight` next to a single-weight family (Poppins_800ExtraBold)
      silently falls back to Roboto. Check fonts on the emulator after any
      style refactor. (B7 Bug 3, standards pass)
- [ ] "Busy" state starts the moment the user's action is committed (picker
      returned), not after later async prep (resize) — any gap re-enables Save. (B7 Bug 3)
- [ ] DESIGN.md §7 "must render from Build N on" rules: the Build that first
      makes the screen reachable builds them — TMDB attribution on Settings was
      due from Build 3 and sat as a "Coming soon" placeholder through Build 7.
      Queenie checks §7 standing rules every Build, not only the Build's own items.
- [ ] Google sign-in on td_emu (account picker = OAuth grant) is done by Justin,
      or by an agent only with his explicit yes for that run. Builds 5 and 8
      did it without asking — Manager's miss. (2026-09-30)
- Release APK: always `GRADLE_USER_HOME="C:/g/perchable"`, limit ABIs with
  `-PreactNativeArchitectures=arm64-v8a,x86_64`, and run `./gradlew --stop` before
  restarting — a stopped shell leaves the Gradle daemon building, and two builds
  collide (ninja "Permission denied"). Don't run Metro/QA on td_emu during it (CPU). (2026-09-30)
- Release APKs are built only when Justin asks for one — never per change or per Build.
  (Manager built one unasked after the Profile rows change, 2026-09-30.)

## Moderation carry-forward (Module 3 → Builds 20, 24, 25, 27, 28; PLAN.md rules 1–5)
- [ ] Any migration adding a table other users can read (captions, comments,
      DM messages): INSERT policy calls `public.has_accepted_terms()`; the
      SQL test copies `supabase/tests/terms_gate_rls.sql` and shows the
      insert **rejected on the real table** while `terms_accepted_at` is
      null. No such test = FIX NEEDED.
- [ ] Comment / DM policies also call `public.is_blocked_between(...)`; tests
      prove both directions of a block. (Caption SELECT stays owner-only
      until a Build shows captions to others.)
- [ ] Every UGC surface opens `ReportSheet` with the right `target`
      (24 profile + `BlockUserSheet`; 25 comment + collection entry/caption;
      27 DM message). Ruby greps for the caller.
- [ ] Every composer calls `useTermsGate().requireTerms` before first submit
      (20 caption, 25 comment, 27 DM).
- [ ] The Build adds its "remove this content" query to
      `docs/ADMIN-MODERATION.md`, tested in a rolled-back transaction.
- [ ] New functions used by RLS: `security definer`, `set search_path = ''`,
      `revoke all ... from public, anon`, `grant execute ... to authenticated`.
- [ ] Every new table starts with `revoke all on public.<t> from anon, authenticated`
      before any grant: this project's default privileges hand both roles
      TRUNCATE/REFERENCES/TRIGGER (found on `profiles`, 10a Bug 2; RLS does not
      guard TRUNCATE). The SQL test asserts it with `has_table_privilege`.
- The emulator is one shared device: never run an agent on td_emu while Justin is using it, and
  tell him when it is in use. Queenie's run overloaded it while he was adding a Google account
  ("System UI isn't responding", 2026-09-30). Check load (`cat /proc/loadavg` < 3) before QA.
- Emulator: restart td_emu (quick boot, `-gpu host`) at the start of every session and before
  every QA run — its GPU path degrades with uptime (launcher 90th-pct frame 48 ms fresh vs 600 ms
  after a long session). Screenshots are now 720x1600 @ 280 dpi = **1.75 px/dp** (was 2.625).
  Full setup in CLAUDE.md "Emulator setup + health". (2026-10-01)
- Emulator lag kept recurring because every agent restarted td_emu by rule — each restart is
  minutes of boot-storm load. Use `scripts/emulator.sh ensure` (restart only when measured
  unhealthy, then wait to settle). Cap jest (`--maxWorkers=50%`) and never overlap a QA run with
  a full jest suite or Gradle build. (2026-10-01, Justin: "deal with that issue that's been
  recurring")
- A flaky test is fixed at its cause, never by switching off the check that fails. "Not wrapped in
  act" from React Query = its notifyManager timer firing outside act on a loaded machine: route
  notifications through act (`notifyManager.setNotifyFunction`), keep `IS_REACT_ACT_ENVIRONMENT`
  on. Prove a flake fix under load (busy processes alongside), not on an idle machine. (2026-10-02)
- On a quick-boot emulator the guest `/proc/uptime` comes back from the snapshot — measure
  emulator age from the host process, not from inside Android. (2026-10-02)
- Close the emulator (`scripts/emulator.sh stop`) as soon as device work is done and none is
  next. Left idle through reviews and builds, it ages toward the unhealthy limit and slows
  jest/Gradle, so the next test had to restart it anyway. (2026-10-02, Justin)
- An emoji and words in one `Text` inside a fixed-height chip can wrap: the words drop to a hidden
  second line and the chip shows only the emoji. Put the emoji in its own `Text`, and screenshot
  every chip on a device. (Build 13 · Bug 1)
- A shared component that adds an always-present layer (Avatar initials behind the photo) changes
  every caller: hide decorative layers from accessibility in the component itself, and list every
  caller in the brief. (Build 13 · round 2)
- Check a designer's numeric fix against their own board on a device before building on it: the
  first toast offset (inset + 96) covered other text that the board kept clear. (Build 13)
- `TaskStop` on a background `npx expo start` leaves the Metro node process holding 8081: after
  stopping, find the PID on 8081, confirm its command line is your Metro, and stop it. (2026-10-02)
- After a PC restart the dev build ANRs on cold start ("failed to complete startup") until
  `adb shell cmd package compile -m verify -f com.tsujintsujin.perchable` runs once. (2026-10-02)
