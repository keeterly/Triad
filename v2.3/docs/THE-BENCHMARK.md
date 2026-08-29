# KIZUNA v2.3 — THE BENCHMARK

> *"Benchmark against Slay the Spire 2 — keep the premise (3-person party,
> combo-based combat, team attacks that develop over time) but make it as smooth
> and understandable as StS2. A JRPG version of StS2."*
>
> …and, later: *"mine should be even better than the other games that are
> similar to mine."*

This file is the honest scoreboard. It is kept in three parts: what the
competition is being criticised for **right now**, where this game already
answers that by design, and where this game is genuinely behind. The third
list is the one that matters.

Sources are dated, because a benchmark against a live early-access game goes
stale — anything here older than the last entry should be re-checked before it
is acted on.

---

## 1 · What the field looks like (August 2026)

**Slay the Spire 2** shipped into Steam Early Access on 5 March 2026 — a full
engine rewrite rather than an incremental sequel. Its headline additions:

- **Alternate acts.** Once unlocked, entering a new act randomly presents one
  of two possible acts, so the run's *shape* varies and not only its contents.
- **Five slayers**, each with their own card pool and mechanic; at least one
  more on the roadmap, plus three new game modes.
- **Every enemy redesigned** — none returns unchanged; new debuffs and attack
  patterns.
- A major update in April 2026 brought balance passes, revamped shop relic
  prices, **improved map generation**, a new Ironclad card, and a badges system.

**What players are actually complaining about**, which is the useful half:

1. **Act 1 map generation.** Widely described as having got worse — poor seeds
   where there is no reasonable path. Acts 2 and 3 are considered fine.
2. **Node clustering.** Shops crammed into one lane, or two shops back-to-back
   where a player wants them spread. (Some of this is recollection bias, and
   the community says so — but the perception is itself a design fact.)
3. **The elite power spike.** Elites got substantially more HP and damage while
   starting decks did not get a corresponding buff, which collapsed the
   campfire decision: in Acts 1 and 2 you are forced to **rest rather than
   upgrade**. A choice that is always answered the same way is not a choice.

That third one is the most instructive thing on this page.

---

## 2 · Where this game already answers it

Not by luck — three of these were deliberate calls made before the complaints
were public, and they are worth naming so they do not get "simplified" away.

| Their problem | What this game does instead |
|---|---|
| Act 1 seeds with no reasonable path | The road is **authored, not generated**. `PLAN` names the kinds each column MUST offer; the seed moves width, lane order, coin position and crossings. The pacing guarantees — one elite at column 3, two fires, an early memory, nothing but a fire or a memory on the Regent's doorstep — are **swept over 300 seeds** in `road.test.cjs`, not asserted on one. A bad seed is not a thing this road can produce. |
| Nodes clustering into one lane | A column holds two or three stops and a mystery can only ever be a third lane. Nothing can displace a `must`, so no kind can crowd out another. |
| Campfires collapsing into "always rest" | **The fire mends for free.** Resting is not on the menu, because it was never going to survive contact with an attrition curve. The only question at a fire is *which* memory — which is the question that was interesting in the first place. |
| Deck bloat diluting a build | The deck **never grows**: five slots a hero, always. A card won at a bond level goes into one of its two heroes' five and something leaves. Every other reward SHARPENS what is already there. |

The campfire one deserves a second sentence. StS2's fires broke because two
systems (elite damage and upgrade cost) were tuned independently and the player
was left holding the contradiction. Mending unconditionally means the road's
attrition and the tree's prices can be tuned separately without ever producing
that failure — and `run.sim.cjs` tunes the attrition on the assumption that a
fire mends, which is the same statement from the other end.

---

## 3 · Where this game is genuinely behind

### 3.1 A run develops — MEASURED, and fixed across Builds 62–63

`test/pace.sim.cjs`, 14 runs at each of three levels of player skill. It is a
**measurement, not a gate** — the moment it becomes a gate it stops being able
to tell us something we did not already believe.

StS's *win a fight → pick one of three cards* beat fires eight to ten times a
run and is most of why a run feels like it is going somewhere. This game
deliberately does not have it. The question was whether the substitutes fired
often enough, and the first answer was no — **about three things changed between
the trailhead and the Regent**, and the number went DOWN as skill went up.

```
  cards won per run          clumsy   ordinary   sharp
  Build 61  (as found)         0.93       0.50    0.29    ← backwards
  Build 62  (all-out pays)     0.50       1.00    1.36    ← the right way
  Build 63  (the reckoning)    1.43       1.07    2.21    ← and it fires

  reckonings per run           2.50       2.57    3.14
  all-outs per run             1.36       1.93    3.43   ← why skill is paid
  turns per run                18.3       18.4    18.4   ← flat, all three builds
```

A sharp run now changes about **six and a half** things about the party — two
nodes kindled, two cards swapped in, two marks placed, a tier opened — against
2.8 when the question was first asked. The `turns per run` row is what makes it
a fix rather than a coincidence: it has not moved across any of the three
builds, so nothing here was bought by making fights longer.

The remaining tree numbers are unchanged and still worth knowing:

```
  fires/run ~0.9 · at a fire: purse ~8, tier ~1.4, sealed ~5.7, open ~4, bought ~2
```

Two theories died on contact with the numbers, and they are worth recording
because both were plausible and both were wrong:

- *"Embers pile up unspent."* They appear to — 16.8 left at sharp play — but
  almost all of it is the **Regent's own payout**, earned in the last fight of
  the run. There is nothing to fix there; it is an end screen showing a number.
- *"The player is too poor at the fire to buy anything."* No: 3.5 of 4 open
  nodes are affordable and the greedy bot buys until it cannot. `broke at a
  fire` is 1 in 14.

What is actually true is narrower and more useful: **a route visits exactly one
campfire**, arrives at tier ~1.5, and finds five and a half of the ten nodes
still SEALED. The tree is gated three ways at once — one fire, an early purse,
and a tier lock that only memories open — and 1.9 nodes of 10 is the product of
the three. Across runs that is arguably healthy variety. Within one run it is
thin.

And there is no room to simply add a second fire: five stops before the boss,
already carrying two memories, an elite and the fights that pay for everything.

### 3.1b The social layer rewarded playing BADLY — FIXED, Build 62

```
  cards won per run     clumsy   ordinary   sharp
  before                  0.93       0.50    0.29     ← the wrong way
  after                   0.50       1.00    1.36     ← the right way
  all-outs per run        1.00       1.86    2.71     ← the mechanism
  turns per run           17.4       19.6    18.1     ← flat: it is not length
```

Bond points came from **stitches** (one hero acting straight after another,
once per pair per turn) and from **interceding**. Both are paid for by fight
LENGTH — and length is the one thing skill removes. A sharp player won in fewer
turns, banked fewer stitches, levelled fewer bonds, saw fewer bond scenes, and
so won fewer cards and placed fewer marks than a clumsy one. The game's whole
thesis, three people becoming more capable *together*, was starved by playing
well.

**The all-out now pays every living pair.** It is the one thing on this board
that skill makes MORE frequent — kizuna charges from turned strings, so a sharp
parry is what brings it round — and it is literally all three of them landing
at once. If any single moment in this game should deepen a bond, it is that one.

The `turns per run` column is what makes this a fix rather than a coincidence:
it is flat across all three bots, so the improvement is not "fights got longer",
it is "skill now buys the thing skill should buy".

### 3.1c The skill cliff is very steep — STILL OPEN, and now the worst thing here

7% / 43% / 93% win rate across the three bots, unmoved by Builds 62 and 63
(neither touched combat, which is the point of measuring them). A new player, parrying at
roughly 45%, wins about one run in seven — and a wipe costs them the tree, the
bonds and the memories all at once, because a run that ends at column 2 has
changed almost nothing. StS's Act 1 is far more forgiving than this, and it is
the first thing a new player meets.

### 3.2 There is no ember sink but the tree

Embers come from every fight and every parry and are spent in exactly one
place. StS has shops; this game has a purse that can sit full while the player
walks past two stops that would like to take money from them. The mystery stops
(Build 59) are the first thing that has ever competed for embers, and there are
at most two of them on a road.

### 3.3 One act, one boss, one region of content

Five foes, fifteen cards, six stops, one Regent. That is the honest size of a
vertical slice and it is not a defect — but "as good as StS2" cannot be claimed
on this axis and should not be. What the slice CAN claim is that every system
it has is finished: the road, the fire, the memories, the bonds, the marks, the
mysteries, and a combat layer with a parry that carries the whole fight.

### 3.4 The heroes do not animate

The five foes each have a sprite sheet — idles, wind-ups, one frame set per
act, reactions. The three heroes are still cut-out stills that slide. In a
fight where the party is the subject, that is the largest single presentation
gap left.

---

## 4 · The one thing to be better at

Not content volume — that is a budget question and the answer is years.

**The parry.** No competitor in this space has a real-time defensive skill
layer inside a deckbuilder's turn. StS2 is redesigning enemies to be more
legible; it is not making the player's hands matter. If this game is going to
be better than the thing it is benchmarked against, it will be because the
moment an attack lands is the best moment in the genre — and everything else
(the road, the fire, the bonds) exists to make you care who is being hit.

That is where effort should go when there is a choice.

---

## Log

- **2026-08-29** — Build 62 inverted the bond incentive; Build 63 added the
  reckoning, the post-fight beat this file had listed as the biggest hole. A
  sharp run went from 2.8 things changed to about 6.5. The skill cliff is now
  the largest open item.
- **2026-08-29** — first pass. Competitor research above; `soak.cjs` and
  `pace.sim.cjs` written as the two standing measurements. The soak found two
  reproducible bugs in its first twelve random runs: a card won and not yet
  placed was lost on reload (Build 60), and a bond fork could hand over a card
  the party already carried, putting a second copy in a fifteen-card deck
  (Build 61). Both now gated in `bond.test.cjs`.
