# HERO ART — the restyle, and the three ways it went wrong first

The three heroes were the last thing in the game drawn in a different hand from
everything around them. The foes and the twenty-eight card paintings already
shared one; the party did not.

This took four attempts. The failures are the useful part of the record, because
each one is a plausible instruction that produces a specific, recognisable
wreck.

## What is actually different, measured against the foes

Not the designs, and not the rendering *quality* — that was the first wrong
guess. At high zoom the Wraith is **crisply rendered**: clean silhouette edges,
smooth controlled gradients inside every ribbon. The original heroes are
rendered to the same standard. They were never the sketchier set.

What differs is four things, and the brief has to name all four:

| | the old portraits | the foes |
|---|---|---|
| light | flat and ambient, the whole figure evenly surveyed | one hard side light, bright rim, far side into near-black |
| silhouette | frontal, symmetrical, closed and tidy | three-quarter, weight on one leg, hems breaking into long tapering ribbons |
| tone | denser colour, violet and gold through the costume | near-monochrome bone and charcoal, the accent hue reduced to sparse notes |
| density | busy edge to edge | big quiet areas, detail concentrated at face and weapon |

## The three failures

- **"Loose ink-and-wash, dry-brush edges that dissolve into nothing."** This is
  the wrong description of the target and the model obeys it exactly: soft,
  blocky, smeared work, visibly *worse finished* than the originals it replaced.
  The foes are not loose. **Never ask for looseness here.** Ask for the finish to
  be held: *crisp, finely detailed, smooth controlled gradients, sharp edges,
  exactly as polished as the reference.*
- **"Lift the whole image into a HIGH KEY."** Read as an instruction to recolour
  the CHARACTERS. Ash and Mira came back blond in cream costumes; Elin went dark.
  A global image property gets applied to the costume. **Lock the colours by
  name** — "his hair stays BLACK, his coat stays BLACK, never blond, never a
  cream costume" — and phrase tone as draining saturation, not as lifting key.
- **Generating at 2k.** Both 2k rounds returned grey backdrop panels and cast
  shadows under the feet; both 1k rounds returned clean empty white. The output
  is used at 720px tall, so 2k buys nothing and costs the cutout. **Generate at
  1k.**

A fourth, smaller one: Elin drifted to black robes twice, because "deep charcoal
shadow pooling through the lower robes" reads as *black fabric*. For a pale
character the contrast has to be stated as coming from light — the shadow side of
the same white robes dropping to cool grey — plus an explicit "never a black or
dark garment". She is the light figure of a party of three; that contrast is how
the eye finds the healer in the stack.

## The brief that worked

Bookend the locks, then name the four changes as a numbered list:

> The same character as the reference. LOCKED, do not change: the face, the
> costume design, and the colours BY NAME. LOCKED, do not change: the rendering
> finish — crisp, finely detailed, cleanly rendered, smooth controlled gradients,
> sharp edges, exactly as polished as the reference. Never sketchy, never loose,
> no dry brush, no smudging.
> WHAT TO CHANGE, four things. (1) LIGHT: one hard light from a single side, a
> bright rim down that edge, the far side into near-black, mid-tones squeezed
> out. (2) SILHOUETTE: dynamic three-quarter, weight on one leg, hems breaking
> into long clean tapering ribbons trailing into empty space. (3) TONE: drain
> toward bone, ash and charcoal, the accent hue surviving as sparse notes only.
> (4) DENSITY: big quiet areas, detail at the face and the weapon, thinning
> outward.
> BACKGROUND: plain flat pure white, completely empty — no cast shadow, no grey
> panel, no floor, no vignette.

`flux_2`, variant `pro`, resolution **1k**, aspect `3:4`, the character's own
portrait as the single `image_references` input. Two variants each; expect to
discard about half.

### Framing the layout requires

`.k-hero img` is anchored `height: 100%` with the feet at the bottom, and the HUD
busts crop `object-fit: cover; object-position: top`. So **both feet stay planted
at the very bottom edge and the head stays near the top**, in a tall frame. A
leaping pose would float the figure off the ground line and behead the bust.

## Cutting them out — `tools/cutout.py`

Deliberately not a threshold. "Everything brighter than X is backdrop" works on a
charcoal foe and destroys a white-robed oracle: her robe highlights measure the
*same value* as the backdrop she stands on (3119 interior samples at min-channel
≥250, on a 253 field), so a global key punches holes through her.

What separates figure from field is not brightness but **connection**. The
backdrop touches the frame edge; her robes do not. The fill starts at the border
and spreads only through pixels that are both bright and reachable from outside,
so anything enclosed by the figure survives however white it is. The soft edge is
applied only in a narrow band along the boundary the fill found — a brightness
ramp applied everywhere fades the robes back out.

### …and the connected fill leaves the pockets

That is only half of it, and the half that shipped broken once. Backdrop showing
through the holes in a filigree staff head, between a cloak and a body, around a
raised blade, is **never reachable from the border** — so it survives as solid
opaque white. Six to eight THOUSAND pixels of it per hero, in patches large
enough to see immediately on a dark battlefield.

Those pockets are identifiable without any appeal to size or position: the
backdrop is FLAT and paint is not. Every enclosed pocket measured here came in at
mean 250–254 with a standard deviation under 2.6, where painted highlights vary
far more. So after the border fill, any enclosed bright component that is also
uniform is backdrop too. That took Ash from 5881 stray white pixels to 39 and
Mira from 5822 to 27. (Elin keeps ~2000, and should: hers are her actual robes.)

### And a feathered edge keeps the white

A boundary pixel is a blend of the figure over a white page. Give it partial
alpha and leave its colour alone and the white is still in there — over a dark
background the whole silhouette wears a pale halo. The backdrop colour is known,
so the true colour comes back exactly: `F = (C - (1-a)·bg) / a`. Un-premultiply
every partially transparent pixel.

A final bounded grow takes the anti-aliasing the strict threshold leaves at
240–247. It is **bounded on purpose**: simply lowering the strict threshold would
reintroduce the original hazard, since the oracle's robes reach those values and
a free-running fill could enter at the silhouette and keep going. Seeded from a
mask already known good and limited to two steps, the worst case is a two-pixel
bite out of an edge rather than a hole through a garment.

### How to check it

**Look at the alpha, not the histogram.** The first attempt's aggregate alpha
statistics matched the hand-made originals almost exactly — 47.7% transparent
against 52.2% — and the cutouts were still visibly wrong. The number cannot see
*where* the opacity is. Composite on magenta, and map every pixel that is both
near-white and not transparent; the pockets show up as solid patches and the
halo as a dotted outline tracing the whole figure.

## Open

- **Elin gained a dark cape** she does not have in the original. It buys her the
  contrast the brief asks for and she still reads as the pale one, but it is a
  design addition rather than a restyle.
- **The card paintings** were all generated against the OLD portraits. Same cast,
  same accent hues, so nothing clashes; a set regenerated today would sit closer.
  28 credits to close, worth doing only if the gap starts to show.
- **The heroes do not animate.** The five foes carry painted frames now; the
  party is still three stills with a CSS breathe.

---

## Cutting a replacement plate in (Build 103)

`v2.3/docs/art-export.py <src-dir>` takes three matted PNGs and produces the six
files the game reads. Run the uploads through a real matting model first —
**not** a flood fill from the edge, which cannot reach a gap enclosed by hair and
leaves a halo on every strand besides. Build 102 shipped that and the screen
showed it.

Then one step that is easy to miss: a matting model returns the plate
**composited over white**, so every soft pixel still carries a share of the
backdrop. Over a dark battlefield that is a pale haze along every strand — the
"white background in the hair" a player will describe without being able to point
at a single white pixel. Undo the composite, `C = a·F + (1−a)·255` solved for F,
clamped, for every pixel with `0 < a < 255`. It roughly halves the haze:
measured over the head band, **4.5 / 6.2 / 5.9%** before and **2.6 / 2.4 / 1.3%**
after.

The script asserts four things, and every one of them is a fault that reached the
board once:

| assert | what it caught |
|---|---|
| 15–72% of the bounding box opaque | Mira shipped as a rectangle of checkerboard |
| stance centred within 6% of the width | the padding was on the wrong side; Ash ended at 872 of 1142 |
| pale **soft** pixels in the head band under 3.5% | the backdrop in the hair. Opaque pale pixels are excluded, or Elin's cream habit fails and nobody else does |
| head found up the stance column | Elin's staff reaches higher than she does |
