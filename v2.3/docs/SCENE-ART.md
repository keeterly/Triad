# The memory frames — render spec

Every MEMORY stop opens on a **still of the moment itself**, held for 2.2s as a
title card before it settles back into being the scene's backdrop.

This file is the brief for those stills. It exists so the set can be
**re-rendered without re-deciding what is in the shot** — a second pass, a
different model, a different hand, all start from the same frame description.

## Status

**The three frames are not rendered yet.** The Higgsfield MCP server was not
reachable in the session that built this system (its tools were disconnected;
`ToolSearch` found none), so the code ships with the render path complete and
the images pending.

`SCENE_ART` in `run.js` is the manifest of which stills actually exist:

```js
const SCENE_ART = {
  // 'lullaby': 1, 'careful': 1, 'floor': 1,
};
```

**It is empty on purpose, and that is load-bearing.** Naming a file that is not
there is not a harmless fallback — the browser fetches it, logs a 404, and every
suite in this project counts a console error as a failure. It did: `road` went
to `pageErrors: 1` the moment the art slots landed and before the manifest
existed. Until an id is in that object, the scene asks for the run's region
painting instead and nothing 404s.

**To ship a frame:** render it, save it as `v2.3/../art/scene-<id>.webp`,
uncomment its line in `SCENE_ART`, and run `node test/road.test.cjs` — the
`MEMORY` checks assert the splash opens with a loaded image and no page errors,
so a bad path or a missing file fails loudly rather than degrading quietly.

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

The beat is **the third one stepping into the line before it is offered.** This
is the only frame of the three where the figures are close enough to read as
people. It is a conversation, so it is staged like one: two, then one.

```
A narrow ledge in a drowned garden, water to the ankles, dead trees holding up
broken masonry. Two figures in the middle distance stand close, shoulders
almost touching, the easy geometry of long practice — a swordsman and a
pale-robed woman with a held light. A third figure in dark leathers stands two
paces off to the right, half-turned, in the act of stepping toward them. The
reflection in the still water joins the three of them into one shape before
they are one. Cold green-grey, one small held light. Painterly digital matte,
ink-wash and charcoal over parchment, desaturated near-monochrome, loose
brushwork. Wide 2.17:1.
```

**Focal point:** the gap between the pair and the third, centre-right.
**Empty:** lower third — the reflection reads as texture there, not subject.

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

When the connector is reachable, the flow is:

1. `models_explore(action: 'recommend')` — pick a painterly/matte image model
   rather than a photoreal one; the house style above is a painting.
2. `generate_image_batch` with the three prompts, one job each, the shared
   negative, and a **2.17:1 / 1864x860** aspect.
3. `jobs_wait`, then one `show_generation_by_ids` to collect the results.
4. Download, convert to `.webp`, save as `../art/scene-<id>.webp`.
5. Uncomment the three ids in `SCENE_ART` and run the suites.

Batch all three in one call rather than three separate ones — they are a set,
and a set rendered in one pass holds its palette together far better than three
rendered on different days.

**Check them against the brief before shipping them,** specifically: is the
lower third quiet, is the frame 2.17:1, and is it a painting rather than a
render. A frame that fails any of the three is worse than the region fallback,
because the fallback at least belongs to this run's own place.
