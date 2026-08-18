# Skill-Sheet Art Prompts — the batch template

The cast-animation pipeline (Build 7, `HERO_CASTS` in game.js) ingests
8-frame sprite sheets in a strict 4×2 grid with transparency. This template
generates compatible sheets in ChatGPT (or any image model). Engineered
backwards from what the importer needs:

- 4 columns × 2 rows, uniform cells, nothing crossing cell edges
- transparent background, no floor/borders/text
- body anchored: same position/scale every cell, feet on one baseline,
  facing RIGHT, body in the LEFT half of the cell, fx projecting RIGHT
- frame 6 is the RELEASE (the engine lands the impact bundle on it)
- frame 8 is the WIND-DOWN (the engine HOLDS it until the finisher — it
  must read as a composed stance, not mid-motion)

## Setup message (once per character, with their portrait/sheet attached)

> You are generating game-ready skill animation sprite sheets for a
> dark-fantasy mobile JRPG. Match the attached reference character EXACTLY —
> same face, hair, outfit, armor details, proportions, and painterly
> dark-fantasy style (ornate, muted palette, glowing spell effects). I will
> request one skill per message. Every sheet must follow these rules:
>
> 1. Layout: exactly 8 frames in a strict 4-column × 2-row grid. Uniform
>    cell sizes, generous spacing, nothing crossing cell boundaries.
>    Landscape 1536×1024.
> 2. Background: fully transparent (PNG alpha). No floor, no shadows, no
>    frame borders, no text or numbers.
> 3. Anchoring: the character stands at the SAME position and scale in every
>    cell — feet on one consistent baseline, body in the left half of the
>    cell, always facing RIGHT in three-quarter profile. Spell effects
>    extend to the RIGHT of the body, never behind it.
> 4. The 8 frames, in reading order (top row 1–4, bottom row 5–8):
>    1 Idle — relaxed combat stance, no effects.
>    2 Charge — the skill's energy ignites at one hand, small.
>    3 Build — the energy grows; a glyph or sigil may appear.
>    4 Swirl — energy wraps the body at full charge.
>    5 Aim — the body coils/extends toward the right, ready to release.
>    6 RELEASE — the payoff frame: the skill fires right at full extension.
>      Biggest effect of the sheet.
>    7 Linger — the effect dissipating mid-air, body still extended.
>    8 Wind-down — a calm stance with faint residual traces. (HELD on
>      screen for seconds in-game — composed, not mid-motion.)
> 5. Consistency across frames matters more than any single frame being
>    beautiful.

## Per-skill message

> Skill: **[NAME]** — [element/effect description: colors, shapes, what
> frame 6's release looks like].

## The six alternate openers (Build 11), ready to paste

- **Ash · Feint Cut** — a deceptive sword feint. Steel-grey blade arcs with
  faint crimson trailing light; frame 6 releases a crossing slash that
  leaves a hovering red target-sigil (an exposure mark) on the air.
- **Elin · Stillness** — a ward, not an attack. Soft white-gold holy light;
  frame 6 releases a translucent dome of golden light projected right;
  7–8 keep faint golden motes drifting.
- **Mira · Marked Knife** — a thrown dagger that brands. Violet-black
  shadow coiling along a dagger; frame 6 releases the thrown blade with a
  violet marking-glyph blooming at the right edge.
- **Cassia · Iron Stand** — a rooting stance. Bronze-amber light along her
  shield; frame 6 bursts amber bulwark-light around the planted shield;
  7–8 hold the braced wall.
- **Branwen · Pinning Shot** — a pinning arrow. Pale green-white wind on a
  drawn longbow; frame 6 releases the arrow streaking right with a spiral
  of wind and a small green mark-sigil.
- **Hask · Cinder Snap** — fire, the ember mirror of his frost (match his
  Ember Veil sheet's fire treatment). Frames 2–5 build a snapping ring of
  embers at his hand; frame 6 releases a sharp fire burst; 7–8 hold with
  cinders swirling.

## Batching workflow

One chat per character: setup message first (reference attached), then one
skill message at a time — the chat context is what keeps the face and
outfit consistent across sheets. On drift, reply "regenerate — rule N
violated." Upload finished sheets to the dev session with an ordered list
of skill names; the importer (slice → 300px-cell webp → HERO_CASTS entry)
does the rest, and hold-frame/contact timing is automatic.
