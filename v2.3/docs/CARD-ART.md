# CARD ART — the house rule, the twenty-eight, and what is still owed

All twenty-eight cards have their own painting. This is the record of how they
were made, so anything added later looks like it belongs to the same deck —
written down because the recipe lived only in a chat session, and a deck whose
art rule exists nowhere is a deck that drifts on its next card.

---

## The house rule

Every painting is composed **for the card frame**, not cropped into it. The card
is 104×164 (ratio 0.634); the source is generated at 3:4 and mapped so the whole
image height fits, with the sides cropped. The **top ~37% is all that survives
above the title** — everything below it is under the scrim.

So the rule, in the words the prompts actually use:

> Single figure held in the upper two thirds of a tall vertical frame; the lower
> third falls away into deep near-black shadow and drifting ash. Behind them a
> ruined grey city under a cold overcast sky. Heavily desaturated charcoal, bone
> and slate palette with ONE accent hue. Dramatic low-key rim light. Hand-painted
> digital brushwork with visible texture, cinematic. No text, no lettering, no
> card border or frame, no UI, no watermark.

The accent hue is the character's, not the card's: **Ash → violet, Elin → warm
gold, Mira → violet**, with two deliberate exceptions where the *effect* owns the
colour (Frost Bind is glacial blue; Cold Mercy is too).

Each painting shows **what the card DOES**, never just who owns it. That is the
entire point — the art the cards replaced could only say whose card it was.

### Generation settings

| | |
|---|---|
| model | `flux_2`, variant `pro`, resolution `1k` |
| aspect | requested `2:3`, served as `3:4` (closest supported) |
| reference | the owner's portrait, uploaded via `media_upload` → `media_confirm`, passed as `image_references` |
| cost | 1 credit per image |
| post | resize to 420×560, WebP quality 72, method 6 → 20–36 KB each |

Reference portraits are `art/kai.webp` (Ash), `art/elin.webp` (Elin),
`art/mira.webp` (Mira). Every prompt names the reference explicitly — "the
black-armoured swordsman from the reference image, same face, same ragged
black-and-violet plate" — because without that the model drifts off-model by the
third image in a batch.

**Those three portraits were repainted in Build 53** to match the bestiary's
rendering (see `HERO-ART.md`). The characters are the same and the accent hues
are unchanged, so the twenty-eight paintings still read as the same cast; but
they were generated against the OLD portraits, and a card set regenerated today
would sit a little closer to the new ones. That is a deliberate open question,
not an oversight — 28 credits to close it, and worth doing only if the gap
starts to show.

Output goes to `art/cards/<cardId>.webp`. `CARD_ART` in `game.js` is the switch:
an id listed there gets its painting, an id not listed falls back to the owner's
portrait framed as a bust. Adding art is two steps — drop the file in, add the
id. Nothing falls back today; the path is kept because it is what a card added
tomorrow lands on before anyone paints it.

---

## Done — the sixteen

`cleave` `guardcut` `cstance` `crosssever` `lastlight` · `lcascade` `mend`
`frostbind` `sgrace` `intercession` · `serrate` `qthrow` `twinfang` `backstab`
`execute` · `lightsteel`

That is the fifteen-card starting roster plus the Resonance card. `lightsteel`
is the one existing TWO-figure painting and the template for the batch below:
Ash and Elin together, her hand laid along the spine of his blade, gold running
up the violet steel.

---

## Done — the twelve bond cards

These are the cards the road actually gives you. **A bond card is about two
people**, so every one of these is a two-figure composition — which is what
makes them worth painting rather than just worth filling in.

**Painted, all twelve.** Both owners' portraits go in as `image_references`, the
way `lightsteel` did. One of the twelve hit a `429 rate_limit_reached` on
submission and was simply re-sent on its own; the batch tool reports per-item
failures rather than losing the whole call.

Two things were measured afterwards rather than eyeballed, and one of them
overturned what my eye had said:

- **They looked paler than the roster set.** They are not. Mean luminance of the
  visible band (the top 37%, which is all that survives above the title) is
  117.1 for the roster and 123.9 for the bonds — under 6% apart, inside both
  sets' own spread. What actually reads as "paler as a group" is the bond set
  having a higher FLOOR: no very dark cards to anchor it, where the roster has
  several. No correction applied, because none was warranted.
- **The figures sit lower in frame**, so cropping the dead bottom off and
  re-fitting looked like it would lift them into the band. It does the
  opposite: edge energy in the visible band drops 7–22% across all twelve,
  because enlarging pushes the subjects further DOWN and out. Idea discarded.

Each already carries a one-line description in `BOND_CARDS`, and that line is
the brief. The prompts below are those lines staged as compositions.

### Ash + Elin — the blade and the light (accent: violet meeting gold)

| card | the line | composition |
|---|---|---|
| `shieldsong` | Guard the whole line, and mend the worst of it. | Elin's arms opened wide with a dome of gold light spreading past Ash, who stands braced at its edge with his blade planted, taking the front |
| `lastvigil` | A blow struck from behind a raised shield. | Ash lunging out from behind a plate of gold light Elin holds up between them and the dark, his violet blade extended through it |
| `gravebloom` | What it takes from her, it gives to them. | Elin drawn inward and dimmed, gold light running OUT of her along the ground toward the others while Ash's blade drives down |
| `ashenoath` | Everything, at once, and nothing held back. | Both mid-strike on the same line — his greatsword overhead, her staff levelled — one violet arc and one gold one crossing at the point of impact |

### Ash + Mira — the vanguard and the shade (accent: violet)

| card | the line | composition |
|---|---|---|
| `shieldblade` | He stands in front. She works behind him. | Ash filling the foreground with his blade raised as a wall, Mira half-hidden at his shoulder with a dagger already reversed and moving |
| `twinshadow` | Neither of them guards. Neither of them needs to. | Both fully committed forward, no defence at all — his heavy cut and her low lunge landing on the same beat, cloaks streaming behind |
| `cutthecord` | Open it, and step out of reach. | Mira dragging a ragged cut open as she pushes off backwards into the dark, Ash covering the gap she left with his blade across |
| `bothblades` | The heavy one, then the quick one. | Ash's greatsword still buried in its follow-through while Mira's dagger flashes past it — two strokes, one arc, staggered in time |

### Elin + Mira — the oracle and the knife (accent: glacial blue and gold)

| card | the line | composition |
|---|---|---|
| `coldmercy` | Slow the song before it reaches anyone. | Elin's hand out with frost blooming in the air, Mira sliding a violet dagger through the frozen space it opens |
| `quietword` | Cover the one who needs it, and find the next answer. | The two of them close, heads inclined together, a small gold light between their hands and Mira's other hand already drawing a blade |
| `thornandlamp` | A little of everything, for everyone. | Elin holding a lamp of gold light high while Mira works low and fast beneath it, thorned violet trailing from her blade |
| `namethefear` | Say what it is out loud, and it staggers. | Both facing the same unseen thing head-on, Elin's mouth open mid-word with gold light on her breath, Mira steady beside her |

### What it cost

Twelve credits, 501.5 → 489.5. Total for the whole deck: 28 images, 28 credits.

---

## Also owed, and not costed

**Enemy animation.** Done for the idles, and it has its own record: see
`FOE-ANIM.md`. All five foes now carry painted frames cut out of generated clips,
and the Mourning Regent also has her wind-up and four acts. What is left there is
acts for the other four and reaction frames for everyone. That doc carries the
recipe, the prices, and — more useful — the two approaches that fail and why, so
nobody pays to learn it twice.

**Cutscene art.** The scenes carry the two heroes as small cut-out portraits
against a dark plate. They would take the same treatment as the cards.
