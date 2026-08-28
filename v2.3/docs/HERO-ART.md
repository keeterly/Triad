# HERO ART — why the party was repainted, and the rule it follows

The three heroes were the last thing in the game still drawn in a different
language from everything around them. The foes and the twenty-eight card
paintings already shared one; the party portraits did not, and on a battlefield
that put them together the difference read as three characters pasted in from
another game.

## What was actually wrong

Not the designs, and not the palettes. The **rendering**:

| | the old portraits | the foes and the cards |
|---|---|---|
| pose | frontal, symmetrical, feet square — a turnaround sheet | three-quarter, weight on one leg, cloth caught mid-motion |
| light | flat and ambient, lighting the whole figure evenly | one hard rim light down an edge, deep shadow taking the rest |
| value | an even field of mid-tones | large near-black masses against bone highlights |
| detail | uniform, dense, everywhere at once | concentrated at the face and the weapon, falling away outward |
| edges | closed, tidy, every hem finished | torn cloth tapering into long calligraphic ribbons that dissolve |

## The rule

> Same character, same design, same accent hue. Loose ink-and-wash painterly
> brushwork; the figure built from a few large masses that read as ONE
> silhouette; a single hard rim light down one edge with deep shadow swallowing
> the rest; torn fabric tapering away into long calligraphic ribbons with
> dry-brush edges; detail concentrated at the face and the weapon and falling
> away toward the extremities. High value contrast, generous empty space.

Each character's own portrait goes in as the `image_references` input — that is
what holds the face, the design and the palette — and **the style is carried
entirely by words**. That is not a preference: pointing the model at a foe as a
style reference makes it copy the foe's POSE and eventually its costume, which
is the same failure documented in `FOE-ANIM.md`. The card set proves words are
enough, because those twenty-eight paintings reached this style the same way.

### Two constraints the framing cannot break

The battlefield anchors `.k-hero img` at `height: 100%` with the feet at the
bottom, and the HUD busts crop with `object-fit: cover; object-position: top`.
So however dynamic the pose gets, **both feet stay planted at the very bottom
edge and the head stays near the top**, in a tall portrait frame. A leaping pose
would float the figure off the ground line and behead the bust.

### What the accent hue is for

Ash and Mira are the dark pair, violet; Elin is the pale one, warm gold. That
contrast is load-bearing — she is how the eye finds the healer in a party stack
of three — so the light-versus-dark split survives the restyle intact.

**This is the trap Elin's pass fell into.** Asking for "deep charcoal shadow
pooling through the lower robes" was read as *black fabric*, and two attempts
came back with the oracle in a black gown: correct style, wrong character, and a
party of three dark figures. For a pale character the contrast has to be stated
as coming from LIGHT — "the shadow side of the same white robes dropping to deep
cool grey, the cloth itself staying white" — with an explicit "her robes are
never black". Four variants to land it against two apiece for the others.

## Cutting them out

`tools/cutout.py`, and it is deliberately not a threshold. The obvious key —
everything brighter than X is backdrop — works on a charcoal foe and destroys a
white-robed oracle: her robe highlights measure the *same value* as the backdrop
she stands on (3119 interior samples at min-channel ≥250, on a 253 field), so a
global threshold punches holes straight through her.

What separates figure from field is not brightness but **connection**. The
backdrop touches the frame edge; her robes do not. So the fill starts at the
border and spreads only through pixels that are both bright and reachable from
outside, and anything enclosed by the figure survives however white it is. The
soft edge is then applied only in a narrow band along the boundary the fill
found — a brightness ramp applied everywhere would fade the robes back out.

Output is 720px tall to match what the party plates have always been.

## What this leaves open

- **The card paintings.** All twenty-eight were generated against the OLD
  portraits. Same cast, same accent hues, so nothing clashes; but a set
  regenerated today would sit closer to the new party. 28 credits to close, and
  worth doing only if the gap starts to show.
- **The heroes do not animate.** The five foes carry painted frames now; the
  party is still three still images with a CSS breathe. v2.2's
  `art/hero-ash-anim.webp` is what one looked like when it did.
