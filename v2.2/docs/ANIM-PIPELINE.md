# Animation sheet pipeline

How a painted character becomes an animated figure on the battlefield.

## 1. The runtime contract (already shipped)

`game.js` drives animated figures from **one painted sheet plus an atlas of
frame rects** — no slicing step, no per-frame files:

- `FOE_ANIM` — `{ id: 'sheet.webp' }`. Listing an id here does nothing until
  the file actually loads; the vector/plate stays and there is no 404 storm.
- `FOE_ANIM_SHEET` — the sheet's natural size, in pixels.
- `FOE_ANIM_ATLAS` — `state -> [[x, y, w, h], ...]` in sheet pixels.
- `FOE_ANIM_PLAY` — per state: frame `ms`, and `loop` / `hold` / `then`.

`foeAnimPaint` scales **every** frame by `boxH / 230` and anchors feet to the
bottom of the box. One scale for all frames is the whole trick: a wide attack
sweep and a narrow idle then read at the same character size, instead of the
creature ballooning on its calm frames.

States: `idle` `prep` `attack` `recovery` `hit` `heavy` `broken` `death`.

Heroes run the same machine off their own kit. `HERO_ANIM` / `HERO_ANIM_SHEET`
/ `HERO_ANIM_ATLAS` / `HERO_ANIM_PLAY` mirror the foe tables, and `ANIM_KITS`
pairs each sheet with its rects so one state machine and one ticker serve both
sides without either knowing the other's rects exist. A figure carries the kit
it was attached with, chosen by `data-anim-kit` on the layer.

A hero's `attack` carries its own wind-up, so the caller stays the single
`lungeFig` beat it always was.

## 1b. Poses belong to the archetype, not to the weapon

`HEROES[id]` carries `cls`, `archetype` and `identity`, and the poses have to
answer them. Ash is a **Ronin / Skirmisher** who "strikes and slips,
repositions as he attacks" -- the first pass gave him a generic greatsword
raised overhead and chopped down, which reads as a berserker and is simply the
wrong character. His frames are now a low coiled draw, a rising cut out of it,
a lateral pass at full extension, and a landing past with his head turned back
over his shoulder.

Read the hero's CARDS too, and give the states they ask for. Ash blocks
(Crossguard, Flowing Cut) and throws before he closes (Thrown Edge), so he has
`guard` and `throw` frames, and `heroPoseForCard` picks between them:

- `fx.step` -> `throw`
- `fx.guard` or `fx.counter` with no `fx.dmg` -> `guard`
- anything that deals damage -> nothing here, because `lungeFig` fires the
  swing at the moment the blow LANDS and the cut must stay married to the
  impact rather than playing early.

## 2. Composing a sheet

`tools/build-anim-sheet.py` turns a pile of single-pose images into a sheet
plus its atlas table:

```
python3 tools/build-anim-sheet.py ../art/hero-ash-anim.webp \
  idle:plate.webp@1.00 \
  prep:drawback.png@1.00 prep:overhead.png@1.10 \
  ... death:kneel.png@0.79
```

It keys out a flat background (no-op when the source already carries alpha),
alpha-trims each figure, scales it to the reference height it is declared to
occupy, sits every frame of a row on a shared baseline, and prints the
`SHEET`/`ATLAS` constants to paste into `game.js`. Sources may be local paths
or URLs.

Because the rects come out of the real alpha content, they never need the
hand-calibration the first boss sheet did.

### The height factor is the part that matters

`@0.79` is what the pose measures against the first frame's standing height.
Without it every frame is stretched to fill one cell, and a kneeling figure
stands as tall as a walking one while a raised blade shrinks the body holding
it. The generated frames turn out to carry their own answer: the model frames
each full-body pose consistently enough that the **trimmed alpha height of the
source**, divided by a standing frame's, is a good factor. Measure them, don't
guess:

```
python3 -c "from PIL import Image; im=Image.open('p.png'); print(im.getchannel('A').getbbox())"
```

Ash's set landed on 1.00 standing, 1.10-1.12 with the sword up, 0.79-0.87 for
the lunge and the kneels.

## 3. Generating poses

Poses come from an image model driven off the character's existing plate as a
reference, so identity carries: same face, same hair, same costume, same
weapon, flat neutral background, feet on a common ground line, one pose per
image.

**Note the character/file mismatch in `portraits.js`** — the filenames do not
match the character names. Ash's plate is `art/kai.webp`; `art/ash.webp` is
Hask. Use the plate the portrait map points at, not the one whose name looks
right.

### What went wrong, so it does not go wrong twice

**Ask for one pose per image.** A prompt for "four poses in a row on one
backdrop" produced four internally-consistent poses in a flat cel-shaded style
that had nothing to do with the painted plate. Single poses, each anchored to
the reference, held the brushwork and the palette. The consistency a strip buys
is not worth the style it costs.

**Anchor the style explicitly.** "The SAME richly painted, highly detailed
illustration style with the same brushwork, texture and dark muted palette as
the reference" is doing real work in the prompt. So is naming the costume piece
by piece rather than saying "same outfit".

**Expect the filter.** Prompts describing a figure knocked down or slumped come
back `nsfw` and cost a retry. Reword toward posture rather than harm --
"kneeling low, head bowed, hands resting on the crossguard" passes where
"slumped forward onto hands and knees" does not.

**Cut out with the real remover.** A border flood-fill handles most frames but
cannot reach background enclosed by an arm and a blade, and it leaves the soft
ground shadow behind. `remove_background` on every frame is cheap and uniform.
It still keeps a drawn ground line as its own island, which is what the
compositor's despeckle pass is for -- though a line actually TOUCHING a boot is
one component with the figure and survives both.

**Measure the body, not the bounding box.** A blade is a few pixels wide and
will happily count as "head": a guarding figure holding his sword upright
measured TALLER than the same figure standing, so the factor shrank him. Take
the first row that is torso-wide instead. With that, factor is simply the
source's trimmed height over the shared canvas height.

### Egress

Generated images live on the provider's CDN. The environment's network access
must reach `d8j0ntlcm91z4.cloudfront.net` (results) and
`d2ol7oe51mr4n9.cloudfront.net` (uploaded reference media); under **Trusted**
these are denied with a 403 on CONNECT and no frame can reach `/art`.
