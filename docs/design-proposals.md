# Perchable — 3 design proposals (Stage A)

Canvas: https://claude.ai/artifact/M5TbevikF4q3dyGEh2S7XH (v1)
Boards: "A — Night Owl Arcade", "B — Cinema Ledger", "C — Perch Social"
Sources: `design-src/Proposal-A-Night-Owl-Arcade.dc.html`, `design-src/Proposal-B-Cinema-Ledger.dc.html`,
`design-src/Proposal-C-Perch-Social.dc.html`, `design-src/canvas.json`.

Each board mocks 5 phone screens (390×844): Home, Quick Add swipe deck, Movie
details, My Collection (captions), and another user's profile popup
(Discord-style, per `docs/inspo/discord_modal.png`), plus the bottom/nav
pattern. Palette source: `docs/inspo/pallete.jpg` — `#2D0B59` (deep purple),
`#4C1D95` (purple), `#B8860B` (gold), `#D6C4E9` (lavender), `#121016`
(near-black).

---

## A — Night Owl Arcade

Closest to `docs/inspo/design inspo.jpg` and `home inspo.jpg` as shot: a
playful, game-like dark app. Near-black `#121016` ground, cards filled with a
`#2D0B59 → #4C1D95` purple gradient, gold `#B8860B` for every actionable
element (CTA buttons, watched badges, active tab). Big rounded "Perch
Roulette" hero card on Home. Bottom tab bar (owl icon lit gold when active).
Rounded, bold display type (Poppins-style) throughout.

- **Palette:** bg `#121016`, card `linear-gradient(#2D0B59,#4C1D95)`, accent
  `#B8860B`, text-on-dark `#D6C4E9`/`#ffffff`.
- **Type:** display "Poppins" (bold, rounded) / body "Inter", both sans.
- **Nav:** fixed bottom tab bar, 5 icons, active tab gold.
- **Dark/light:** dark-only by design — matches the vision's "night owl"
  branding; no light variant (owl app, watching-at-night framing).
- **Pros:** most literally matches Justin's inspo shots; highest "fun/social"
  energy; gold-on-purple reads instantly as the brand.
- **Cons:** gradient cards + bold rounded type can get visually noisy once
  real content (posters, avatars, comment threads) is added; needs discipline
  to not overuse the gradient everywhere.

## B — Cinema Ledger

An editorial, magazine-style direction: same dark ground, but restrained —
thin gold (`#B8860B` at ~30% opacity) hairline rules instead of filled cards,
serif display type for movie titles (a "film ledger" feel), list rows instead
of card stacks, top/underline tab pattern instead of a filled bottom bar.
Purple and lavender are used sparingly as accents (underlines, borders), not
as large fills.

- **Palette:** bg `#121016`, hairlines `#B8860B` @ 30%, text `#D6C4E9`/`#fff`,
  posters as flat `#2D0B59`/`#4C1D95` blocks (no gradients).
- **Type:** display "Georgia"/serif (movie titles, headings) / body "Inter"
  sans for meta and UI chrome — deliberate serif/sans contrast.
- **Nav:** thin-border bottom bar, uppercase letter-spaced labels, no fills;
  active item is gold text only.
- **Dark/light:** dark-first; a light variant would swap ground to `#D6C4E9`
  with `#2D0B59` serif headings and the same gold hairlines — not built here,
  noted for Build 0 if Justin wants both.
- **Pros:** feels more premium/adult (less "gamified"), scales better to
  dense content (comments, DM threads, rankings) without visual clutter;
  distinct from most movie-tracker apps in the RESEARCH.md comp set.
- **Cons:** further from the literal inspo shots; serif type needs a real
  Google Font (`Playfair Display` or similar) to look intentional rather than
  like a Georgia fallback; less "fun" for a casual swipe-to-add moment.

## C — Perch Social

Leans into the social/follow features (Vision Part 2): friend activity and
avatars are the first thing on Home, not the movie roulette. Cards use the
lavender `#D6C4E9` as a light fill on the dark ground (a "sticky note" feel)
rather than purple gradients, so social content visually pops against the
movie-poster blocks. Collection is a 2-column poster grid (Letterboxd-style)
instead of a list or 3-across strip. Nav is a floating pill bar, rounded
avatars everywhere, gold reserved for the watched checkmark and CTA.

- **Palette:** bg `#121016`, social cards `#D6C4E9` fill w/ `#2D0B59` text,
  movie blocks `#2D0B59`/`#4C1D95`, accent `#B8860B` (checkmarks + primary
  CTA only).
- **Type:** rounded friendly sans ("Nunito"-style) for everything — one
  family, weight does the hierarchy work.
- **Nav:** floating rounded-pill bottom bar, active icon on a solid gold
  circle.
- **Dark/light:** dark-only; the lavender cards already act as the "light"
  surface within the dark shell, so a full light theme isn't needed for v1.
- **Pros:** best fit for the social features Vision Part 2 leans on heavily
  (follow, DM, comments, profile popup) — puts people, not just posters,
  first; poster grid is the most scannable Collection layout of the three.
- **Cons:** lavender cards next to purple poster blocks risk feeling like two
  different apps if spacing/hierarchy isn't kept tight; floating pill nav
  needs extra safe-area care on short Android devices.

---

## Recommendation

**A — Night Owl Arcade.** It's the direction Justin's own inspo images (shot
as "perchable" mockups, not generic references) already committed to, it
reads as fun/casual which matches "for people who keep asking what to
watch," and it needs the least reinterpretation for Bella to build against —
lower risk for a first mobile app that's also meant to teach "proper mobile
development." B and C are both viable if Justin wants something more
editorial or more social-first, respectively — worth mentioning as a
mid-ground: **B's serif/hairline treatment could be grafted onto A's
gold-forward palette later** without a rebuild, if the gradient cards feel
too busy once real content is in.
