# The memory frames — render spec

Every MEMORY stop opens on a **still of the moment itself**, held for 2.2s as a
title card before it settles back into being the scene's backdrop.

This file is the brief for those stills. It exists so the set can be
**re-rendered without re-deciding what is in the shot** — a second pass, a
different model, a different hand, all start from the same frame description.

## Status

**All three frames are rendered and shipped** (Higgsfield `soul_location`,
21:9, one batch). `SCENE_ART` in `run.js` is the manifest of which stills
exist, and all three ids are on:

```js
const SCENE_ART = { lullaby: 1, careful: 1, floor: 1 };
```

**It is a manifest and not a guess, and that is load-bearing.** Naming a file
that is not there is not a harmless fallback — the browser fetches it, logs a
404, and every suite in this project counts a console error as a failure. It
did: `road` went to `pageErrors: 1` the moment the art slots landed and before
the manifest existed. A check HEADs every file the manifest claims, so an id
left behind after a rename fails by name rather than quietly turning a title
card into a black rectangle.

**To replace or add a frame:** render it, run it through the export below, save
as `art/scene-<id>.webp`, make sure its id is in `SCENE_ART`, and run
`node test/road.test.cjs`.

### The export is not just a format change

Two steps that are easy to skip and both matter:

1. **Crop to the game's frame.** Renders come back 21:9 (2.388); the stage is
   932x430 (2.167). Centre-crop to 2.167 and resize to **1864x860** rather than
   leaving `object-fit: cover` to trim it — a crop decided at export is a crop
   you can look at.
2. **Normalise the exposure.** The three came back at mean luma **22 / 30 / 78**
   — nearly a stop and a half apart — and no single backdrop filter can serve
   that spread: at the old `brightness(0.24)` the lullaby read and the careful
   one was solid black. Scale each to **mean luma ~30**. The CSS then stays one
   rule (`.k-sc-own`, `brightness(0.5)`, landing them ~15), and the set holds
   together as a set.

```python
from PIL import Image, ImageEnhance
TARGET, TR = 30.0, 932/430
def mean_luma(im):
    g = im.convert('L').resize((160, 74)); px = list(g.getdata()); return sum(px)/len(px)
im = Image.open(src).convert('RGB'); w, h = im.size
nw = int(round(h*TR)); im = im.crop(((w-nw)//2, 0, (w-nw)//2+nw, h)).resize((1864, 860), Image.LANCZOS)
im = ImageEnhance.Brightness(im).enhance(TARGET/mean_luma(im))
im.save(dst, 'WEBP', quality=82, method=6)
```

## House style — applies to all three

The game is **ink-wash, parchment, black, sparse gold**. Match `map-lament`,
`map-silence` and the other five region plates already in `../art/`: painted
rather than rendered, heavy atmospheric perspective, most of the frame in the
dark, one cold light source doing the work.

```
Painterly digital matte, ink-wash and charcoal over parchment. Desaturated to
near-monochrome — cold greys, bone white, a single warmer accent. Heavy aerial
perspective; the far plane dissolves into haze. No lens flare, no chromatic
aberration, no photographic bokeh: this is a painting, not a render. Loose
visible brushwork at the edges, tight only where the eye should land.
Composition leaves the centre readable and the lower third quiet.
```

**Frame:** 932 x 430 (2.17:1). Render at 2x — **1864 x 860** — then convert to
`.webp` at ~82 quality. The lower third is covered by the dialogue plate once
the splash dissolves, so **nothing that has to be read may sit there**.

**Negative:** `text, letters, watermark, signature, modern clothing, bright
saturated colour, anime cel shading, photoreal skin, lens flare, HUD, UI`.

**The three of them,** for consistency across frames — they are small in every
shot, silhouettes at most, never portraits:

- **ASH** — sword, dark cloak, front of the group, the one who moves first.
- **ELIN** — pale robes, a held light, the one who has stopped to listen.
- **MIRA** — dark leathers, knives, apart from the other two.

## `scene-lullaby` — WHAT THE SONG IS FOR

> *The road bends. The singing does not.* … *It's a lullaby. She's still trying
> to put something to sleep, and it won't go.*

The beat to paint is **the party stopping to listen** — not the singer. The
Regent is never in this frame; the whole point is that they hear her from far
off and understand her before they meet her.

```
A high stone road bending left along a cliff of ruined city. Three small
figures halted mid-stride at the bend, facing away from camera into a vast
drop. Far below and far ahead, a single warm light in an enormous dark
cathedral shell — small, unreachable, the source of a sound we cannot see.
The pale-robed figure has turned her head toward it; the swordsman has stopped
because she did; the third stands apart, still facing the way they came.
Cold blue-grey dusk, one warm ember of light at the vanishing point. Painterly
digital matte, ink-wash and charcoal over parchment, desaturated near-
monochrome, heavy aerial perspective, loose brushwork. Wide 2.17:1.
```

**Focal point:** the far warm light, upper-right third. **Empty:** lower third.

## `scene-careful` — THE THING NOBODY SAYS

> *You two move like one animal. You don't even look. How long have you had
> that?* … *Don't be careful with me. Be fast.*

The beat is **the third one stepping into the line before it is offered.**

### This one took two passes, and the first failure is worth keeping

The original brief said the pair "stand close, shoulders almost touching, the
easy geometry of long practice". The model painted **a romantic embrace** — a
swordsman holding a woman in a lovers' pose, both large and specific in the
foreground, in a bright green-grey garden. Beautiful, and wrong: this scene is
about comradeship and a grief they will not name, and a frame that says
"lovers" rewrites the whole party. It also broke the house rules — the figures
were close enough to have faces, and the palette was nowhere near the game's.

**"Almost touching" is an instruction to touch.** The reroll says the opposite
in as many ways as it can, and puts the failure modes in the negative prompt:

```
Wide environment shot of a drowned garden at dusk. A narrow stone causeway
crosses still black water; dead trees hold up broken masonry behind it. THREE
SMALL DISTANT FIGURES seen from BEHIND, backs to camera, tiny in the frame —
silhouettes, no faces, no detail. Two of them stand side by side several paces
apart from the third, both facing away across the water in the same direction;
one carries a small cold lantern. The third stands alone off to the right,
half-turned, mid-step toward them. NOT touching, NOT embracing, no physical
contact of any kind — three separate comrades at rest on a road. Their
reflections in the still water below merge into one dark shape. Cold grey-green
half-light, one small pale lantern. Painterly digital matte, ink-wash and
charcoal over parchment. Desaturated to near-monochrome, very dark overall,
deep shadow across most of the frame. Heavy aerial perspective, far plane
dissolving into haze. A painting, not a render — loose visible brushwork, no
photographic detail. The lower third of the frame is quiet dark water.
Ultra-wide cinematic.
```

**Extra negative for this frame:** `romance, embrace, couple, lovers, holding,
close-up, portrait, faces, large figures, foreground characters, green cast`.

**Focal point:** the three on the causeway, lower right. **Empty:** the water.

## `scene-floor` — ONE MORE FLOOR

> *The stair keeps going down. It should have run out three turns ago.* …
> *That's the trouble with grief — it hasn't got a floor.*

The beat is **scale, and the absence of a bottom.** No faces. The stair is the
subject and the three of them are almost too small to find, which is the line.

```
An impossible spiral stair in a vertical shaft of black stone, seen from above
and slightly to one side, winding down past ruined landings into darkness with
no floor visible. Cold pale light seeps from the stone itself and picks out the
edge of each turn. Three tiny figures on one landing perhaps a third of the way
down — barely more than marks, one of them carrying a small light. The shaft
continues below them past the bottom of the frame. Vertiginous scale, oppressive
depth. Painterly digital matte, ink-wash and charcoal over parchment,
desaturated near-monochrome, heavy aerial perspective. Wide 2.17:1.
```

**Focal point:** the tiny lit landing, upper-centre-left. **Empty:** lower third
— it is darkness, which is the point.

## Rendering these with Higgsfield

What was actually used, so a re-render starts from a known-good setup:

- **Model `soul_location`** (`models_explore action:'recommend'` ranked it top
  for "painterly matte, ink-wash, desaturated fantasy environment"). It is the
  environment model, which is right — these are places, not characters.
- **`aspect_ratio: "21:9"`** — its widest, 2.388 against the stage's 2.167. It
  has no 2.17 option, so the export crops the sides (see above).
- **`generate_image_batch`** with all three in ONE call, then `jobs_wait`. A
  set rendered in one pass holds its palette together far better than three
  rendered on different days — which is also why the `careful` reroll had to
  fight harder to match the other two.
- No free allowance was available (`unlim.available: false`), so this spends
  credits. Three frames, plus one reroll.

**Look at every frame against the brief before shipping it.** Specifically: is
the lower third quiet, is it a painting rather than a render, and — the one
that actually caught a failure — **does it say what the scene says?** The first
`careful` was a technically excellent image of the wrong relationship. A frame
that fails any of those is worse than the region fallback, because the fallback
at least belongs to this run's own place and makes no claim about the story.
