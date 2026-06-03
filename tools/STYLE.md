# Triad / Kizuna — Sprite Art Direction (locked style)

This is the **single source of truth** for the look of every character sprite.
Every prompt the generator (`tools/sprite-forge.html`) builds pins to this spec so
the whole cast reads as one set. Don't paraphrase it per-character — only the
*subject* block changes between characters; the *style* block below stays byte-identical.

Reference: the 10-class anime fantasy class-select grid (Swordmaster / Cleric /
Rogue / Ranger / Mage / Berserker / Shadow / Warlock / Guardian / Bard).

---

## Style anchor (paste verbatim into every prompt)

> anime fantasy key-art illustration, dark-fantasy RPG character class portrait,
> full-body single character, painterly cel rendering with clean fine linework,
> high detail, weathered ornate gear, tattered layered cloaks and capes with
> frayed edges, tarnished gold and bronze filigree, muted earthen palette of
> deep blacks, charcoal, aged leather brown and bone white, one keyed accent
> glow per character, soft top-left key light with gentle rim light, cinematic
> but flat illustration (not 3D render, not photo), readable silhouette,
> centered standing pose, aged parchment off-white textured background with soft
> vignette, subtle grounded contact shadow under the feet

## Negative / avoid (paste into the negative field, or append "no …")

> text, letters, watermark, signature, logo, UI, frame, border, multiple
> characters, cropped limbs, extra limbs, extra fingers, chibi, super-deformed,
> 3D render, photorealism, harsh studio photo, modern clothing, sci-fi tech,
> bright saturated cartoon, busy background, scenery, landscape

---

## Locked parameters

| Knob | Value | Why |
|---|---|---|
| **Aspect — full sheet** | `2:3` (portrait) | matches the reference grid cells |
| **Aspect — in-game crop** | `10:13` (≈ the SVG `viewBox 0 0 100 130`) | drops into the card slot 1:1 |
| **Background** | aged parchment, off-white, soft vignette | the reference's shared canvas |
| **Lighting** | soft top-left key + rim | consistent across the cast |
| **Seed discipline** | reuse **one fixed seed** for the whole batch | biggest single lever for consistency |

### Consistency rules (the part people skip)

1. **Same seed for everyone.** Pick one seed number, lock it, generate all four
   with it. Different seeds = different worlds.
2. **Style block is immutable.** Copy it character-to-character without edits.
   Only swap the subject sentence.
3. **One accent per character**, keyed to their combat *school* (see table) — so
   the team still color-codes the way the game does.
4. **Full-body first, crop second.** Generate the `2:3` full sheet, then crop the
   bust to `10:13` for the in-game portrait so the card and the roster art match.

### School → accent glow

| School | Accent | Hero |
|---|---|---|
| physical | steel-blue + crimson | Cassia |
| holy | warm gold / candle | Elin |
| ranged | mossy green / amber | Branwen |
| stealth | violet-black smoke | Veyr |
| arcane | deep violet | (future) |

---

## Roster subject seeds

Each hero's subject sentence, derived from their in-game `title`, `school`, weapon,
and the closest class in the reference grid. The generator stores these; this file
is the human-readable copy.

- **Cassia — "Disgraced Knight"** (physical, Front tank, greatsword)
  *Closest class: Swordmaster / Guardian.*
  > a fallen-from-grace human knight, battered ornate full plate over a torn
  > tabard, a long heavy greatsword held point-down, tattered crimson cape,
  > tarnished gold trim, weary resolute expression, steel-blue and crimson accent

- **Elin — "Sister of the Veil"** (holy healer, Mid)
  *Closest class: Cleric / Shadow.*
  > a veiled cleric-sister in pale layered robes and a deep hood, faint golden
  > halo motif behind her, holding a simple holy emblem, serene downcast eyes,
  > warm gold candle-light accent with a faint violet undertone

- **Branwen — "Outlaw Archer"** (ranged, Back)
  *Closest class: Ranger.*
  > a hooded outlaw archer, weathered green and brown leather and a frayed
  > traveling cloak, a recurved longbow and a back quiver of arrows, sharp wary
  > gaze, mossy green and amber accent

- **Veyr — "The Last Witness"** (stealth, Back, frail)
  *Closest class: Shadow.*
  > a gaunt veiled wraith-like figure wrapped in dark tattered layered shrouds,
  > face mostly hidden, hollow pale glowing eyes, thin curved dagger, wisps of
  > violet-black smoke rising from the hem, haunted stillness, violet-black accent

---

## Workflow

1. Open `tools/sprite-forge.html` (double-click, or it's live on Pages at
   `…/Triad/tools/sprite-forge.html`).
2. Lock a seed, pick framing, copy each character's prompt (or "Copy all").
3. Generate in your image model of choice.
4. Save finished art as `assets/sprites/<id>.png` (`cassia`, `elin`, `branwen`, `veyr`).
5. In `game.js`, uncomment the matching line in the `SPRITES = { … }` block.
6. Reload — the raster replaces that hero's SVG everywhere. Commit + push.
