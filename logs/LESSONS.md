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
