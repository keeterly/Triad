# FOE ANIMATION — what works, what does not, and what it cost

All five foes are fully animated: a painted idle, a wind-up, every act their
intent list can ask for, and struck and broken frames. This is the record of how
they were made and what was ruled out getting there — written down because two
plausible approaches fail for reasons that are not obvious until you have paid
for them.

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
| model | `kling3_0`, `mode: pro`, `sound: off`, `16:9` |
| duration | **3s — not 5s.** See the camera note below; this is the whole trick. |
| cost | **5.25 credits** per 3s clip, 8.75 at 5s (`seedance_2_5` is 32.5) |
| input | the foe's own plate, composited on white and padded to 16:9 at 1280×720 |
| output | 1920×1080, ~5 MB mp4 |

The prompt has to fight for three things:

- **A flat pure-white void.** Works, and it is what makes the frames
  compositable — white keys cleanly off charcoal and bone, and the bone-white
  robe ribbons sit far enough below the void's value to survive. The ONE thing
  it cannot survive is a bright conjured flare: the Choir's spell blooms to a
  wide soft white, and white light on a white void cannot be told from the
  backdrop, so the key cut it into a hard-edged disc that read as a bug rather
  than a spell. Its idle frames come from the first second, before the bloom.
  The same trap caught both RAIN acts, differently: a downpour washes the whole
  field pale, and the key returns a translucent rectangle the exact size of the
  video frame. Saying "keep all conjured light deep violet and never white" in
  the prompt helps, and taking the frames before the wash arrives (~1.8s) is
  what actually settles it. **Watch for it in any act that fills the screen
  with light.**
- **A locked-off camera. THIS IS WHAT THE DURATION IS FOR.** At 5s the camera
  dollies back however the prompt is phrased — every "no zoom, no dolly, no pan"
  was ignored — and the figure shrinks to a third of its size across the back two
  thirds of the clip. At **3s it does not happen at all**: the figure holds its
  size end to end and the whole clip is usable. Chasing this with prompt wording
  is wasted effort; shorten the clip instead.
- **The character's design held.** Works — every frame is unmistakably the same
  creature, which is the whole reason this route beats the still one.

---

## The pipeline

```
tools/pull-frames.py clip.mp4 --strip strip.png          # look, choose times
tools/pull-frames.py clip.mp4 \
    --clip toll=act-toll.mp4 --clip sweep=act-sweep.mp4 \
    --sheet art/foe-<id>-anim.webp --cell 380 --cols 6 \
    --at idle:0.05 idle:0.20 toll:toll:1.65 sweep:sweep:1.39 ...
```

`--strip` writes a labelled contact sheet so states are picked by eye against the
real frames. `--sheet` keys them and packs a **uniform grid**, printing the
descriptor to paste into `FOE_SHEETS` in `game.js`. `--clip KEY=PATH` adds
another source: a foe's states do not come from one recording — the idle is its
own clip and every act is another — and they have to land in ONE sheet, because
the shared crop that keeps the creature at a constant size across states can only
be computed over all of them together.

Four details in there are load-bearing:

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
- **The alpha channel is the file, not the painting.** Dropping WebP `quality`
  from 82 to 66 saves 12%, because most of the bytes are the cutout mask.
  `alpha_quality` is the lever that matters: at 60 it takes 30% off for a mean
  error of 1.9/255 along the soft edge where the hair and ribbons live (max 10)
  — measured, because that fringe is the one place a cutout visibly breaks.
- **The sheet reports `figH`, and the runtime sizes by it.** A cell carries
  margin the painted plate does not — the Regent's acts reach further than her
  idle, and each foe's clip framed it a little differently — so a layer stretched
  to the box would swap the plate for a visibly smaller creature, by a different
  amount for each foe. `figH` is the median figure height inside a cell, and the
  runtime blows the cell up until the figure stands exactly as tall as the plate
  it replaces. Median, not max, so one frame with the staff flung out of frame
  cannot shrink every other frame to accommodate it.

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

A state is NAMED AFTER the pose class it accompanies — `k-foe-toll` drives the
`toll` frames — so `FOE_ACT` stays the only mapping, and adding an intent can
never leave the frames pointing somewhere else. A foe whose sheet has no such
state simply keeps what it is showing, and the CSS pose above still plays, which
is what lets frames land one state and one foe at a time.

Two real bugs came out of the checks and are worth not reintroducing:

- **Two fights started in the same frame arm two probes**, a cached sheet
  resolves both, and each mounted its own layer while the teardown retired only
  the first (`querySelector` is singular). The orphan was invisible — the class
  was off — but it held its own interval and was one class away from a doubled
  Regent. Arming is idempotent now.
- **A client rect is not a size here.** The check on the sizing maths first
  compared the layer's `getBoundingClientRect` against the plate's, and failed
  by 5% while the maths was exactly right. The Regent stands inside the field's
  perspective volume, so every rect is a PROJECTED rect — and not uniformly: at
  that position the box measures 0.996× across and 1.024× down, while the layer,
  sitting lower in the frustum, measures 0.990× and 1.041×. Two projected numbers
  taken at different heights say nothing about whether they are the same size.
  Anything measuring the board's geometry has to use layout values.

---

## What is in, and what is owed

Every foe carries exactly the acts its intent list can ask for, and nothing it
cannot throw — the Husk has no rain, the Wraith no toll.

| foe | states | frames | weight |
|---|---|---|---|
| The Mourning Regent | idle, wind, toll, sweep, rain, gather, hit, broken | 24 | 448 KB |
| The Hollow Husk | idle, wind, toll, sweep, hit, broken | 18 | 291 KB |
| The Choir of One | idle, wind, toll, rain, gather, hit, broken | 21 | 346 KB |
| The Grief-Wraith | idle, wind, sweep, rain, hit, broken | 18 | 316 KB |
| The Kneeling Revenant | idle, wind, toll, sweep, gather, hit, broken | 21 | 297 KB |

1.7 MB for 102 frames. Set against 644 KB of card art and 22 MB of music, it is
not the thing to optimise next.

### Reactions give the state back

A hit does not change what a foe is DOING: it was coiled to strike before the
blow landed and it is still coiled after. So `foeAnimReact(name, ms)` remembers
the pose it interrupted and returns to it, rather than dumping the creature onto
its idle in the middle of its own volley — which would erase the telegraph at
the moment the telegraph matters most. It times out against the same window the
CSS shake runs for (340ms for `k-recoil`, 700ms for `k-broken`), so the frames
and the shudder end together. Struck twice while already reeling, it replays and
extends rather than making `hit` the thing it returns to.

Still owed:

- **Nothing, for the foes.** All five are complete. What is left is the party:
  the three heroes are still portraits, and v2.2's `hero-ash-anim.webp` shows
  what one looks like animated.

### Two prompt traps, both paid for

- **A characterful line gets ACTED ON, not merely styled.** Told the Husk was
  "dead weight barely holding itself up", the model collapsed the beast flat to
  the ground after 1.5s. Its idle frames come from before that, and every later
  prompt carries an explicit "it stays upright and never lies down".
- **A reaction has to stop short of a death.** The same risk applies to the
  broken frames, which want a creature reeling rather than finished, so all five
  reaction prompts say "still on its feet — it never falls to the ground".

### What it has cost

| | |
|---|---|
| stills that did not work | 16 credits |
| the Regent's idle clip (5s) | 8.75 |
| four act clips + four foe idles (3s) | 42 |
| ten act clips + five reaction clips (3s) | 78.75 |
| **total** | **~145 credits** for the whole bestiary, 489.5 → ~348 |

Three submissions across the run came back as a preset recommendation instead of
a job (`submission_failed`, carrying a `preset_id`) — it seems to fire on prompts
heavy with camera language. Re-sending the identical request with
`declined_preset_id` set to that id goes straight through every time.
