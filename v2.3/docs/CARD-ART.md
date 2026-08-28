# CARD ART — the house rule, what exists, and what is still owed

Sixteen cards have their own painting. Twelve do not. This is the record of how
the sixteen were made so the twelve match them, written down because the recipe
lived only in a chat session and the next batch has to look like it belongs to
the same deck.

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

Output goes to `art/cards/<cardId>.webp`. `CARD_ART` in `game.js` is the switch:
an id listed there gets its painting, an id not listed falls back to the owner's
portrait framed as a bust. Adding art is two steps — drop the file in, add the id.

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

## Owed — the twelve bond cards

These are the cards the road actually gives you, and they are the ones still
falling back to a portrait. **A bond card is about two people**, so every one of
these is a two-figure composition — which is what makes them worth painting
rather than just worth filling in.

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

### Running the batch

Twelve images, twelve credits at the settings above. The batch tool caps at
twelve per call, so it is one `generate_image_batch` → `jobs_wait` → download →
resize → drop into `art/cards/` → add the twelve ids to `CARD_ART`.

Two-figure prompts need **both** reference portraits passed as
`image_references`, the way `lightsteel` did.

---

## Also owed, and not costed

**Enemy animation.** The five foes act now — a pose per intent, a swing per note
kind — but every one of them is a still painting being moved. Real animation is
video generation, priced well above stills, and it should be preflighted with
`get_cost` on one foe before anything is committed.

**Cutscene art.** The scenes carry the two heroes as small cut-out portraits
against a dark plate. They would take the same treatment as the cards.
