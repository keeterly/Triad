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

## 2. Composing a sheet

`tools/build-anim-sheet.py` turns a pile of single-pose images into a sheet
plus its atlas table:

```
python3 tools/build-anim-sheet.py ../art/hero-ash-anim.webp \
  idle:pose01.png idle:pose02.png idle:pose03.png \
  prep:pose04.png ... death:pose19.png
```

It keys out a flat background (no-op when the source already carries alpha),
alpha-trims each figure, normalises every frame to the 230px reference height
the paint math expects, packs them on a common baseline, and prints the
`SHEET`/`ATLAS` constants to paste into `game.js`. Sources may be local paths
or URLs.

Because the rects come out of the real alpha content, they never need the
hand-calibration the first boss sheet did.

## 3. Generating poses

Poses come from an image model driven off the character's existing plate as a
reference, so identity carries: same face, same hair, same costume, same
weapon, flat neutral background, feet on a common ground line, one pose per
image.

**Note the character/file mismatch in `portraits.js`** — the filenames do not
match the character names. Ash's plate is `art/kai.webp`; `art/ash.webp` is
Hask. Use the plate the portrait map points at, not the one whose name looks
right.

### Egress

Generated images live on the provider's CDN. This session's egress policy
denies `d8j0ntlcm91z4.cloudfront.net` and `d2ol7oe51mr4n9.cloudfront.net`
(403 on CONNECT), so `build-anim-sheet.py` cannot fetch result URLs directly
and the frames cannot reach `/art`. Allowlisting those two hosts for the
environment makes the pipeline a single command end to end.
