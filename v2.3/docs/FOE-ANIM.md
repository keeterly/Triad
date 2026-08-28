# FOE ANIMATION — what works, what does not, and what one foe cost

The Mourning Regent is the pilot. She is the only foe with real animation, and
this is the record of how it was made and what was ruled out getting there —
written down because two plausible approaches fail for reasons that are not
obvious until you have paid for them.

---

## The three routes, and which one survived

### `autosprite` — unavailable, not merely unsuitable

Higgsfield lists a model called `autosprite` that takes one character image and
returns a game-ready sprite sheet with the background already removed. It is
exactly the right shape for this job. It is also **not dispatchable**: it is an
image model, so `generate_video` refuses it; `generate_image` accepts it and the
backend answers `Job set type not supported: autosprite`; `get_cost` errors on it
either way, with or without media attached; and there is no marketplace app
exposing it. Nothing was spent. If it ever starts working it is the first thing
to try again.

### Pose-by-pose stills — FAILS, and the failure is structural

The obvious route: generate each frame as its own image with `flux_2`, holding
the character with her own plate as an `image_references` input, then compose.
Twelve poses were generated. It does not work, in two ways that between them
close the door:

1. **With the reference strong enough to hold the character, the model
   reproduces the reference's POSE.** The wind-up, the toll, the first sweep and
   both reaction frames all came back as the idle with the robes rearranged.
   Only two of twelve — the benediction and one sweep — were genuinely different
   bodies.
2. **Loosen the reference enough to break that, and it stops being the same
   creature.** The four re-prompts written to clear the safety filter (the plate
   is bare-shouldered; four of the first twelve were flagged) described full
   armour coverage, and came back as a *different* character: bulkier plate, a
   different crown, a different silhouette.

Identity and motion pull against each other, and a still model can hold one of
them at a time. An animation sheet needs both at once. Two further defects came
free with the attempt: a duplicated staff on two frames (reference bleed keeps
the original arm *and* adds the new one), and effects — the sweep's arc of cut
air, the rain — that blow past the frame and wreck any scale normalisation done
off a bounding box.

**Cost of learning this: 16 credits.** The frames are kept in the scratch set;
none of them shipped.

### A generated clip, keyed and cut — WORKS

One clip holds identity and motion together by construction: it is one figure,
painted once, moving. So the sheet is cut out of a clip.

| | |
|---|---|
| model | `kling3_0`, `mode: pro`, `sound: off`, `16:9`, 5s |
| cost | **8.75 credits per clip** (`seedance_2_5` is 32.5 for the same thing) |
| input | the foe's own plate, composited on white and padded to 16:9 at 1280×720 |
| output | 1920×1080, ~6 MB mp4 |

The prompt has to fight for three things, and gets two of them:

- **A flat pure-white void.** Works, and it is what makes the frames
  compositable — white keys cleanly off charcoal and bone, and the Regent's
  bone-white robe ribbons sit far enough below the void's value to survive.
- **A locked-off camera.** Works for roughly the first 1.5 seconds and then
  fails: the camera dollies back and the figure shrinks to a third of its size
  for the rest of the clip. Every "no zoom, no dolly, no pan" phrasing in the
  prompt was ignored. **Only the opening window is usable**, which is the single
  most important thing to know before generating more of these.
- **The character's design held.** Works — every frame is unmistakably her.

---

## The pipeline

```
tools/pull-frames.py clip.mp4 --strip strip.png          # look, choose times
tools/pull-frames.py clip.mp4 --sheet art/foe-<id>-anim.webp \
    --cell 440 --cols 6 --at idle:0.05 idle:0.20 idle:0.35 ...
```

`--strip` writes a labelled contact sheet so states are picked by eye against the
real frames. `--sheet` keys them and packs a **uniform grid**, printing the
descriptor to paste into `FOE_SHEETS` in `game.js`.

Two details in there are load-bearing:

- **The key is a ramp with a floor, not a threshold.** A codec's white is not
  255 everywhere — it rings around dark edges and bands faintly across a flat
  field. A hard threshold leaves grey haloes; a ramp alone leaves banding at
  alpha 14, invisible to the eye but *not* to a bounding box, so every frame
  measured as full-frame and the scale normaliser saw a figure that never
  changed size. Anything under the floor is void.
- **One crop for the whole set, not one per frame.** `v2.2/tools/build-anim-sheet.py`
  trims each frame to its own box and re-seats it on a baseline, which is right
  for poses generated one at a time in arbitrary framing. It is wrong here: on a
  locked camera the figure's drift *within* the frame is the animation, and
  trimming each frame separately subtracts exactly the motion the clip was
  generated for. That tool is still in `tools/` for the pose case; it was not
  used for this.

## The game side

`FOE_SHEETS` in `game.js` is the switch, and it carries the same degradation
contract v2.2 used: **naming a foe there does nothing at all until its sheet
really loads.** The four foes without one keep their painted plate, a missing or
broken file leaves the plate up rather than an empty box, and there is one probe
rather than a 404 storm. Adding a foe is two steps — drop the sheet in `art/`,
add the entry.

The layer is a sibling of the plate and **not** a child of `.k-fig`, deliberately:

| property | element | what it carries |
|---|---|---|
| `translate` + `scale` | `#k-boss-art` | the POSE — what the foe is doing |
| `transform` | `#k-boss-art` | the BLOW — each note it throws |
| `animation` | `.k-fig` | the IDLE — what it does at rest |

The sheet inherits the first two from the parent, so every act built in Build 45
still plays over it. It must *not* inherit the third, because the sheet **is**
the idle — so `.k-fig`'s animation is switched off when a sheet is on. That
override needs the extra `[data-foe]` to win: the five per-foe idles are declared
several hundred lines further down at equal specificity, and source order
otherwise hands them the fight, leaving the Regent breathing twice.

The idle **bounces** rather than wraps. Six frames of drift do not close into a
ring — frame 5 is the far end of the sway, not the way back to frame 0 — so a
wrap snaps the robes across the whole excursion once a second.

One real bug came out of the checks and is worth not reintroducing: two fights
started in the same frame arm two probes, a cached sheet resolves both, and each
mounted its own layer while the teardown retired only the first (`querySelector`
is singular). The orphan was invisible — the class was off — but it held its own
interval and was one class away from a doubled Regent. Arming is idempotent now,
and `FOE ANIM: two fights in one frame…` is the check that holds it.

---

## What is owed

- **Her acts.** The wind-up, the toll, the sweep and the benediction are still
  CSS moving a sheet rather than painted frames. They need clips of their own,
  cut from the opening window before the camera pulls back — so **short clips,
  one act each**, not one long clip covering everything.
- **The other four foes.** The Husk, the Choir, the Wraith and the Revenant have
  no sheet. At 8.75 credits a clip an idle apiece is ~35 credits.
- **Weight.** The Regent's six-frame idle is 296 KB. Five foes with idles and
  acts would run to several MB; if it gets there, drop `--cell` from 440 and
  lower the WebP quality before dropping frames.

### What it has cost so far

16 credits on the stills that did not work, 8.75 on the clip that did.
489.5 → ~464.75.
