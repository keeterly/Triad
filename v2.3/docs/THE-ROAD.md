# KIZUNA v2.3 — THE ROAD

*The meta layer: node travel, the run, the bestiary, and the seams between the
map and a fight. Combat's own record lives in `RESONANCE-DECK.md`.*

---

## Build 26 — node travel that reads at a glance

**The gauntlet item.** *"Perfected node-based travel … benchmarked against Slay
the Spire 2 … as smooth and understandable as StS2."*

### What StS's map actually gets right

Not the graph. The graph is trivial — columns, edges, a boss at the end. What
StS gets right is that the map answers three questions **without being read**:

| Question | How StS answers it | How the road answers it |
|---|---|---|
| Where am I? | the token sits on your node | a pinned marker plus a standing white ring |
| Where may I go? | only legal edges glow | reachable stops are at full opacity with a gold pulse; everything else drops to 32–50% and desaturates |
| What is there? | a distinct icon per room type | a distinct **silhouette** per kind, with colour as a second, independent channel |

That third row is the one that is easy to get wrong. A map that separates its
node types by colour alone fails the moment it is small, dim, or looked at
sideways — which is every moment on a phone. So the suite asserts that the five
kinds have five **different icon paths** *and* five different tones, and would
fail a build that let one carry the other.

### The shape of the road

Six stops. Five columns of two, then the Regent.

```
   0        1        2        3        4        5
 fight    fight     camp     elite    camp
   ×        ×         ×        ×        ×     Regent
 fight    memory    fight    fight    memory
```

Authored, not procedural. A six-stop road is short enough that authored pacing
beats generated pacing every time, and it means "what shape is a run" is a
question that can be answered and tested rather than sampled. What *is* seeded
is the crossings between columns and which foe stands at each battle.

**One rule is load-bearing:** every column must have at least one crossing.
Without it the road degenerates into two parallel corridors and the only
decision in the entire run is the first one — the exact failure StS's own
generator guards against with the same rule. `road.test.cjs` measures it.

**Nothing to fight on the Regent's doorstep.** Column 4 is campfire-or-memory:
a rest before the boss, or the tier. That is deliberate, and the run sim below
shows why.

### One tap asks, the second commits

A phone map that travels on the first tap is a map that walks you into an elite
by accident. The first tap raises a card at the foot of the screen naming the
stop, what waits there, and **what it pays** — `+3 embers · 84 hp`, or
`REST — mend + spend`. The second tap, or the TRAVEL button, goes. A choice
between two stops is only a choice if both prices are on screen at the same
time as the decision.

### The bestiary

The Regent is the last thing you meet, not the only thing. Five foes, all
drawing from the **same intent vocabulary** but each handed a different subset,
so a foe's handwriting is legible after one turn.

| Foe | HP | dmg× | dirge | phases | intents | embers |
|---|---|---|---|---|---|---|
| The Hollow Husk | 62 | 0.70 | 2 | 1 | hymn, scythe | 2 |
| The Choir of One | 76 | 0.80 | 2 | 1 | hymn, benediction, rain | 2 |
| The Grief-Wraith | 84 | 0.86 | 3 | 1 | scythe, rain, hymn | 3 |
| The Kneeling Revenant | 98 | 0.88 | 2 | 2 | all four | 5 |
| The Mourning Regent | 168 | 1.00 | 4 | 2 | all four | 8 |

The ladder is one multiplier and one HP number per foe rather than four tables
to keep in sync, and the suite asserts it is monotone in both.

### The seam

Combat still knows nothing about runs, maps or embers. It knows two things:

```js
startCombat({ foe, partyHp, onEnd })     // going in
combatSummary()  →  { outcome, foe, turns, partyHp, turned, flawless, cleanliness }
```

`setPhase` fires `onEnd` when it reaches VICTORY or DEFEAT, and that is the
entire interface. The 106-check combat suite still boots straight onto the
board (`?test=1`), because putting a map in front of it would have rewritten
every one of those checks to say the same thing one click later.

### Embers are paid for the fight AND for the parry

```
embers = foe.embers + (cleanliness ≥ 0.92 ? 2 : cleanliness ≥ 0.70 ? 1 : 0)
```

The base is what the foe was worth; the bonus is what the parry earned. The
best thing in the game is also the thing that funds the tree.

---

## The run simulator — a new gate, because winrate was the wrong question

`balance.sim.cjs` answers *"is one fight tuned?"*. That is the wrong question
for fodder: you should almost always beat the Husk, so its winrate says
nothing. The question a road asks is **what the fight COSTS**, because the wound
is carried to the next stop and the run is decided by attrition.

`run.sim.cjs` walks the whole road — same bot, same page, same rules — carrying
HP between stops, and reports completion rate, where runs die, and the
attrition trace per stop (`SIM_TRACE=1`).

The bot itself moved to `bot.cjs` and is now shared by both sims. Two bots that
drift apart quietly produce two balance answers, and the one you did not run is
always the one that was right.

### What the first trace found

At `revenant = 116 HP / 0.96× / dirge 3` and a campfire worth 35%:

```
~HALF PARRIES   runs completed 5.6%
  stop 0  husk/cultist   91/112     stop 3  wraith/revenant   17/112   ← 72 HP
  stop 1  fight/memory   81/112     stop 4  camp              67/112
  stop 2  camp          104/112     stop 5  mourner            0/112
```

**The elite was doing the boss's job.** It cost a competent party 72 of their
112 health — more than the Regent herself — so the road was decided at stop 3
and the last two stops were a formality. And the pre-boss campfire only
restored to 60%, which turns a 33% encounter into a 10% one.

Two fixes, both aimed at the diagnosis rather than at the symptom:

1. **The elite comes down** to `98 HP / 0.88× / dirge 2`. It keeps both phases
   and its full intent hand — that is what makes it feel like an elite. What it
   loses is the attrition that made it the end of the run.
2. **The campfire mends 55%**, not 35%. The last campfire sits one stop from the
   Regent and it exists so that fight is a *fight* rather than the final
   instalment of an attrition sum.

### After

At 120 roads per tier — the shipping count, not the 24-road sighting shot that
first flagged the elite:

```
✓ NO PARRY        runs completed   0.0%   died at stop {1:92, 2:1, 3:27}   purse 2
✓ ~HALF PARRIES   runs completed  18.3%   died at stop {3:27, 5:71}        purse 9
✓ EXCELLENT       runs completed  95.0%   died at stop {5:6}               purse 17
✓ TRAILHEAD       0.0% wipe on the first stop at ~half parries (gate ≤8%)
✓ MONOTONE        every step up in parry skill is a longer road survived
```

Half-parry attrition now reads `88 → 80 → 97 → 37 → 99 → boss`: the elite is a
real dent, the campfire answers it, and the Regent is met near-whole. Of the
runs that end, 22% end at the elite and 59% at the Regent — the road's two
hard moments are the two it is shaped around.

The parry remains the axis the whole run turns on. **0% / 18% / 95%** across
the three tiers is a far steeper skill curve than the single encounter's
0% / 33% / 100%, because a road compounds it: six stops multiply a per-fight
edge instead of averaging it. That is the strongest argument in the build for
the parry being the thing worth mastering.

*(The 24-road pass read 25.0%; 120 roads read 18.3%. Same rule as the deck's
own tuning — never ship a number from a sample under 100, rank candidates
cheaply and measure the winner at the full count.)*

---

## Known gaps at Build 26

- **The campfire only mends.** Spending embers on skill nodes lands in Build 27.
  Until then embers accumulate and buy nothing.
- **The memory stop is mechanical, not narrative.** It raises `RUN.tier` and
  pays an ember; the scene itself lands in Build 28.
- **Because of both of the above, the column-4 choice is not yet a real one** —
  a memory is strictly worse than a campfire while tiers gate nothing. That is
  the first thing Build 27 has to fix, and it is the reason the tier is already
  wired: the road has the shape it will keep, and only the payload is missing.

---

## Build 27 — the fire, and the tree it opens

**The gauntlet item.** *"A campfire and cutscene system that develops and
unlocks skill nodes."* This is the first half. The second — the scene itself —
is Build 28.

### The campfire mends *and* opens the tree

Slay the Spire's rest site makes you choose: rest **or** smith. That is right
for StS, whose attrition is tuned on the assumption you sometimes don't rest.
It is wrong here, and the reason is in Build 26's own numbers: `run.sim.cjs`
tuned the whole six-stop arc *around* a campfire that mends, and the pre-boss
fire exists specifically so the Regent is a fight rather than the last
instalment of a subtraction. Making the mend optional would have re-opened a
question the road had already answered.

So the fire always mends. The decision it poses is **which nodes** — and, one
column earlier, **whether to take the fire at all** or take the memory that
opens the nodes you cannot otherwise reach.

### Ten nodes, three tiers, one lock

| Tier | Ash | Elin | Mira | Shared | Cost |
|---|---|---|---|---|---|
| 1 | Cleave+ | Mend+ | Twin Fang+ | — | 3 |
| 2 | Cross Sever+ | Shared Grace+ | Backstab+ | — | 4 |
| 3 | Last Light+ | Lumen Cascade+ | Execute+ | **Crescendo** | 5 / 6 |

**Embers alone cannot reach tier 2.** No purse, however large, opens it — only
a memory does. That is the whole point of the memory stop, and it is why the
tier was wired into the road at Build 26 before there was anything for it to
gate: the column-4 fork (campfire or memory) is only a real question if the
memory buys something a campfire cannot.

`Crescendo` is the premise's "team attacks that develop over time" made
mechanical: the KIZUNA all-out goes from 26 damage / 4 Break to 34 / 6. One
node, shared by all three, and the most expensive thing on the board.

### The deck gets better without getting bigger

Every upgrade is a **whole card definition, authored by hand** — the same thing
StS does, and for the same reason. A delta (`+3 damage`) has to be re-derived
every time it is read and quietly breaks the moment a card has two damage
atoms; a written-out face is the thing the player will actually see, and it can
be read straight off the table by anyone tuning the deck.

And the count stays at fifteen. Build 25 spent itself reducing the reading load
of those fifteen cards; answering a progression system by handing the player
eighteen would have undone it.

**One accessor, no exceptions.** `cardDef(id)` replaced every read of
`CARD_DEFS[...]` in the game — fourteen sites. A single site that forgets is a
card that lies about itself, which is the one thing Build 23 established the
deck may never do. The suite checks the hand renders `Cleave+`, not `Cleave`.

### How a node says what it does

It doesn't. It shows the two faces and lets you read the difference:

```
Cleave+                    3
7 damage. → 10 damage.
```

Both halves are read off the card tables at render time, so a node can never
describe an effect the card no longer has. A tree that writes its own effects
in prose goes stale the first time a card is retuned.

Three states, each saying *why*: **kindled** is settled and quiet, **sealed**
says `A MEMORY OPENS THIS` (the only thing that does), and **too poor** greys
the *price* rather than the face — so you can still read what you are saving
for. That last one is the same rule the hand already follows.

> *Superseded at Build 29.* Greying the price alone turned out not to survive
> a screenshot: at 2 embers every node still read as buyable, because only a
> 1px border and one small numeral's hue had changed. Unaffordable nodes now
> dim the whole card. The text stays legible enough to read what you are
> saving for, but the claim as written above is no longer what the code does.
> Left in place rather than edited, because a design record that quietly
> rewrites its own history is worth less than one that shows where it turned.

### What the tree is worth

The run sim now spends it. A bot that hoards its embers measures a party nobody
plays and reports the road as harder than it is — the same error the KIZUNA
ladder note warns about. The buyer is deliberately unclever (greedy,
cheapest-first), so the figure is a **floor** on what the tree is worth:

| | no tree (Build 26) | with the tree |
|---|---|---|
| ~half parries, runs completed | 18.3% | **25.8%** |
| ~half parries, deaths at the Regent | 71 of 120 | **62 of 120** |
| median nodes kindled | — | 3 |

Seven and a half points of run completion, at 120 roads per tier. (A 24-road
pass read 33.3%; the same rule applies here as everywhere else in this project
— never ship a number from a sample under 100.)

**Where the tree shows up is worth naming, because it is not where you would
guess.** The half-parry attrition trace is *unchanged* — 88 → 80 → 97 → 37 →
99 → boss, the same as Build 26 to the point. Campfires sit at columns 2 and 4,
so the median run has kindled at most one node by the time it reaches the
elite. The tree's whole effect lands in the tail: nine fewer runs out of 120
die to the Regent. That is what a progression system bought late in a short
road actually does, and a summary that only quoted the median HP would have
reported it as doing nothing.

**And an unexpected tension, which is a good sign for the column-4 fork.** The
EXCELLENT tier kindles *fewer* nodes than the half-parry tier (median 2 vs 3),
because a healthy party takes memories over campfires — and memories raise the
tier without giving you anywhere to spend. Skill buys you access to the deep
nodes and simultaneously costs you the fires at which to buy them. Nobody
designed that; it fell out of the road's shape, and it is exactly the kind of
question a map is supposed to pose.

### Coverage

`test/camp.test.cjs` — **23/23, zero page errors.** Most of its checks end
*inside combat*, because a tree that shows nodes but does not change the fight
is decoration: the bought card must be the dealt card, the deck must still be
fifteen, the all-out must rise and must not leak into the next run.

The twenty-third check is a fit test, and it earned its place immediately: ten
nodes on a 932×430 landscape phone is the entire risk of this screen, and the
check caught the shared node sitting 20px under the leave button at 32px tall
— a layout I had written without being able to look at it.

---

## Build 28 — the memory, and what a cutscene has to earn

**The gauntlet item, completed.** *"A campfire and cutscene system that develops
and unlocks skill nodes."* Build 27 built the fire and the tree; this is the
scene that opens it.

### A cutscene earns its interruption or it does not get one

That is the whole design constraint. In a run-based game a cutscene is a thing
that stops the game, and a player who has been stopped for nothing learns to
stop watching. These earn it twice over:

1. **A memory is the only thing that opens a tier.** No purse, however large,
   reaches tier 2. That was wired at Build 26 and locked at Build 27 —
   deliberately, in that order, so the scene arrived into a slot the systems
   had already made load-bearing.
2. **Each scene is about the three of them becoming more capable together**,
   which is the mechanical thing the tier then sells you. The first ends with
   them agreeing on what they are walking toward; the second ends with Mira
   stepping up into the line and nobody moving her back. The tier that opens
   afterward is that, priced.

### Authored in order, not shuffled

Two memories fit on a road, and they are one conversation with a first half and
a second half. Shuffling them would trade a small amount of variety for the
only narrative continuity a six-stop slice has. Three scenes exist; the third
is a spare for a road that somehow serves a third memory.

`who: null` is the road talking rather than a person, and renders in italic at
a smaller size — the one typographic distinction the plate makes, because it is
the only one it needs.

### The frame

Letterboxed, because two black bars are the cheapest way to tell a player the
rules have paused. **All three heroes stay on screen for the whole scene** —
a three-hander reads as a three-hander only while all three are in the shot —
and the speaker is the one lit and standing forward while the other two dim
and drop back rather than disappearing.

**Tap anywhere advances.** A scene you can only advance from one 60px button is
a scene read with the thumb hunting instead of with the eyes.

**SKIP goes to the payout, never past it.** Skipping a scene must never skip
its reward — the player who has read it before is skipping the words, not
declining the tier. The suite asserts exactly that: after SKIP, the scene is
still on screen, showing `TIER 2 OPENS`, and the tier has not yet moved.

### Two test bugs worth recording

Both were in checks I wrote, and both would have passed silently forever:

- The scene's fit check measured the plate **after the scene had closed**. A
  hidden element's bounding rects are all zero, so `plate.bottom <= stage.bottom`
  was trivially true and the check tested nothing. It now runs while the scene
  is on screen and asserts real numbers — a 92px plate, a 224px cast band, a
  17px line, clear of both the letterbox and the SKIP button.
- The road's payout check compared the flash text against `/TIER 2/` while the
  flash reads `Tier 2`. It failed loudly, which is the good case; the first one
  is the cautionary one.

### Coverage

`test/camp.test.cjs` — **32/32**, of which ten are the memory. Plus
`road.test.cjs` 32/32 and `flow.test.cjs` 106/106, all with zero page errors.
The road suite's own memory check was rewritten: a memory stop now has to open
a scene and *hold the road* until it is heard, with what happens inside the
scene owned by the camp suite.

---

## Where the vertical slice stands

| Gauntlet item | State |
|---|---|
| Perfected combat | 106 checks, 3/3 balance gates at 220 runs/tier |
| A refined parry that is the best thing in the game | 0% / 33% / 100% per fight; **0% / 26% / 95% per run** — a road compounds skill instead of averaging it |
| Node-based travel that reads at a glance | Build 26, 32 checks |
| A campfire that develops and unlocks skill nodes | Build 27, ten nodes on three tiers |
| A cutscene system that unlocks them | Build 28, the only key to tiers 2 and 3 |

**The honest remaining gap** is the same one named at Build 24 and it has
narrowed rather than closed: StS's hour-to-hour fun is in the *run* — card
acquisition, card removal, relics, path risk across multiple acts. v2.3 now has
a run, a road, attrition, a purse and a tree, which is most of that skeleton.
What it does not have is **acquisition** — you sharpen the fifteen cards you
started with and never gain or drop one — and it is one act, not three. Those
are the next two things worth building, in that order.

---

## Build 29 — what four screenshots and two reviewers found

Builds 26–28 added three screens. I had never looked at any of them. This build
is what happened when three reviewers did: one that photographed every screen
and read the images, one that hunted state bugs across the seams, and one that
hunted checks in my own suites that pass without testing anything.

They found **four real bugs and eleven visual defects.** The bugs were worse
than the pixels.

### The four bugs

**1. A third of all roads had no fork in them.**

The forced-crossing fallback in `buildMap` picked a source lane and a
destination lane *independently*:

```js
if (!crossed) (rr() < 0.5 ? a[0] : a[1]).to.push(rr() < 0.5 ? b[1].id : b[0].id);
```

Two of its four outcomes are the straight-ahead edge the base connection had
already added, silently absorbed by the `Set`. So the *forced* crossing only
crossed half the time it fired. Swept over 20,000 seeds: **9.9% of columns came
out bare, and 34% of seeds failed the invariant** — the exact "two parallel
corridors" failure that Build 26's own documentation says the rule exists to
prevent, and which its own test claimed to measure.

The test measured seed 11. Seed 11 crosses in every column. It passed on luck.

> **A generator's invariant has to be swept, not sampled.** The check now
> builds 400 roads and asserts every column of every one of them. It is the
> sweep that found the bug; nothing else could have.

**2 and 3. An interrupted stop was destroyed or stranded the run.**

`travel()` commits `at` and `path` and saves immediately — it has to, the map
redraws from them — but the encounter only begins 260ms later and then runs for
as long as the player takes. Close the tab in that window and the stop was
marked spent with nothing gained:

- at a **memory**, the tier and the ember were never awarded, and the stop
  could never be revisited — silently destroying the *only* key to tiers 2
  and 3 for that run;
- at the **boss**, `over` was never set and the boss node has no outgoing
  edges, so `reachable()` returned `[]` on a map whose card only offers NEW
  RUN when the run is over. No reachable stop, no button, no way out.

A stop is now `pending` until it resolves, and `boot()` re-enters a pending
stop instead of dumping the player onto a dead map. A fight resumed that way
starts over against the same foe with the party's carried wounds — combat is
not serialisable, and that is the honest behaviour. The campfire records
`campDone` so re-entering it shows the tree again without paying the mend
twice, which would otherwise have been an infinite healing loop.

*(This does mean a reload can restart a fight that was going badly. That
save-scum exists in every browser game without server state, and it is a much
smaller problem than the two it replaces.)*

**4. A riposte that killed the Regent didn't stop the volley it killed her in.**

The bleed tick guarded for mid-resolution victory; the FLAWLESS riposte did
not. So the rest of the barrage — and the unparryable dirge after it — kept
landing on the party after `VICTORY` was already locked. You could watch your
own heroes fall to something the game had declared dead, and `endTurn` returned
`'defeat'` for a fight it had won.

### The eleven visual defects — and the one that mattered

Most were small. One was not:

**The card art zone held the hero's portrait a second time.** `.k-cart`
rendered `ownerArt` — the same image as the emblem in the corner — blown up to
60px. So all five of a hero's cards were the *identical picture*, and against
dark character art at 108px wide the zone collapsed to a black smear. Three
cards in a hand were distinguishable only by reading their titles.

That is the exact opposite of what a hand is for, and it was the last thing
standing between this combat and StS2's readability.

The zone now carries **up to two glyphs derived from what the card does** —
blade, shield, cross, shard, drop, flake, cards, step — on a plate that is warm
if the card reaches the enemy and cool if it helps the party. Derived, not
authored, so a card can never advertise an effect it no longer has and an
upgrade cannot make it lie. The hand sorts itself into *attack* and *answer*
before a single word is read:

```
CLEAVE        blade                  GUARDING CUT   blade + shield
MEND          cross, cool plate      FROST BIND     blade + flake
BACKSTAB      blade + step
```

The others, briefly:

| | was | now |
|---|---|---|
| Elite map icon | a smiling face in a party hat, sharing the Regent's crown | a crown over crossed blades — the BATTLE glyph with weight on it |
| Ember currency | a teardrop, identical to the campfire and reading as water | a spark |
| Campfire icon | the same teardrop | a real asymmetric flame over logs |
| "You are here" | a pale ring, near-identical to a reachable stop | a filled disc |
| Unaffordable node | 1px border and one small numeral's hue | the whole card dims |
| Non-speakers in a scene | near-pure black on black — two thirds of the frame read as empty | lifted to 62% |
| Intent target badge | a 17px circle breaking a 23px pill's corner | smaller, with room on that side |
| Sealed-node line | 7px grey | 9.5px violet — it carries the one thing you need to know |
| Party portraits | Ash and Mira both collapsed to the same dark blob | lifted off a radial ground |
| Lane labels | 8px dark grey on scene art, FRONT invisible | shadowed and lifted |
| SKIP on the payout beat | still offered with nothing left to skip | hidden |

### And the vacuous-check hunt

Clean, apart from the one already found and fixed. Two hardening items taken:
a lookup with no `else` arm that would have silently dropped a check rather
than failing it, and a check whose name promised a clamp it never exercised —
which I then briefly "fixed" by asserting `Math.max(1, 0) === 1`, a test of
JavaScript rather than of this deck. It now pushes a zero through both paths
into `currentCost` via the per-fight card overlay.

### The vertical-slice gate

New: `test/slice.test.cjs`. Every other suite tests a part — one stop, one
fire it teleported to, one board it never leaves — and all of them can be green
while the thing they are parts of is broken. This one plays a whole run through
the real screens with the real engine, asserting at every step: exactly one
screen visible, no negative embers, no hero over max, no stop taken twice, and
the deck still fifteen cards. The route is *searched* rather than chosen
greedily, because the first version reached the Regent having never seen a
memory — a greedy picker cannot reach a kind the column's one crossing does not
lead to.

```
stop 0: fight, won in 5 rounds     stop 3: elite, won in 6 rounds
stop 1: memory, 9 taps             stop 4: campfire, kindled 4
stop 2: fight, won in 4 rounds     stop 5: boss, won in 8 rounds
```

**21/21, and it caught nothing on its first run** — because the three reviewers
had already caught it all. That is the correct order to do this in, and I did
it backwards: three builds shipped before anyone looked at them.

### Build 29 measured

```
run.sim.cjs    3/3 gates, 120 roads/tier   0.0% / 28.3% / 90.8%
balance.sim    3/3 gates, 220 runs/tier    0.0% / 34.1% / 100%
flow 106/106 · road 32/32 · camp 32/32 · slice 21/21 · 0 page errors
```

Two movements worth naming rather than waving at:

**The middle band of the fight sim rose 33.2% → 34.1%.** The boss encounter did
not change, so that is the riposte fix showing up in the numbers: when a
FLAWLESS riposte killed the Regent mid-volley, the dirge that followed could
still wipe the party, and `endTurn` returned `'defeat'`. The bot believed it.
About two fights in 220 were being scored as losses that were wins.

**The run sim's top tier fell 95.0% → 90.8% and the middle rose 25.8% → 28.3%.**
Both are inside seed noise at 120 roads, but the crossing fix genuinely changed
the topology of a third of all roads — the routes a run can take are not the
same routes they were — so these are not strictly comparable to Build 28's.
They are a new baseline, not a regression.

---

## Build 34 — the bond travels

The last item on the playthrough's "named, not fixed" list that sits on a
pillar the brief actually names: *"team attacks that develop over time."*

**It wasn't developing, because it barely happened.** KIZUNA reset to zero at
every stop, and a four-round fodder fight cannot fill the bar from nothing. So
the all-out existed only against the elite and the Regent — which made
**Crescendo**, the most expensive node in the tree, an upgrade to a button
pressed twice a run.

**Half the bond now survives a fight.** Not all of it: a full carry turns the
ladder into a bank you fill on fodder and empty on the Regent, which is one
decision made once rather than a resource you feel. Half means the all-out
starts appearing in mid-road fights, while the Regent still has to be earned
inside her own fight. And the road draws what you carry, because a resource the
player only meets mid-fight is not a run resource.

### Measured against its own absence

`SIM_KZCARRY` overrides the game's constant so the change could be measured
against zero rather than against a remembered number — same seeds, same count:

| all-outs per run | no carry | half carry |
|---|---|---|
| ~half parries | 0.21 | **0.71** |
| excellent | 1.17 | **2.13** |

Three and a half times as often at the middle tier. It went from *"fires once
in five runs"* to *"fires most runs"*, and from about one to about two per run
at high skill. Run completion moved 29.2% → 33.3% and 95.8% → 91.7%, both
inside seed noise at 24 roads; the full-count figures are below.

The sim's bot spends the ladder the moment it fills, so these are a **floor**.
A player who banks it for the Regent gets more out of the carry than this
measures — and that banking decision is itself new, and is the kind of question
a road is supposed to ask.

### At the full count

```
balance.sim   3/3 gates, 220 runs/tier   0.0% / 34.1% / 100%   (unchanged —
              a single fight still opens at zero, which is correct)
run.sim       3/3 gates, 120 roads/tier  0.0% / 39.2% / 90.8%
              all-outs per run           0.00 / 0.78 / 2.09
```

**The middle tier moved 28.3% → 39.2%**, which is the largest single jump any
change has produced in this project and is worth being plain about: the carry
does not merely make the all-out *appear*, it makes mid-road fights winnable
that were not. It is still inside the 8–45% gate, but it is now near the top of
it rather than the middle. If a future change pushes that band out, the carry
fraction is the first dial to turn — `KIZUNA_CARRY`, one constant, and
`SIM_KZCARRY` measures any value of it against zero.

---

## Build 35 — the bonds

Card acquisition, built as a social system rather than a shop. Three decisions
set the shape, and all three came from the brief:

> **The deck does not grow.** New cards expand possibility, but a card has to be
> swapped out. **Each character contributes 5 card slots.**
> **Unlocks persist.**

### What was already there

`playCard` was computing a **`pairKey` for every Follow-Up** —
`[prev.ownerId, owner].sort().join('|')` — and then throwing two thirds of it
away, because one line gated it to `RESONANCE_PAIR`. And `owner: 'bond'` was
already a card class the renderer, the play-gate and the inspect panel all
understood.

So the social layer is that gate being opened. It is not a system bolted onto
the combat; it is the combat's own combo mechanic, read.

### A bond is earned by what two of them do for each other

| | |
|---|---|
| **+2** | one acting straight after the other — the stitch the deck already ran on |
| **+3** | Elin stepping into a blow meant for someone else |

Nothing accrues from merely being near each other. Levels at **12** and **30**
points, and they reset with the run, because they are earned in the fighting.

**Combat itself is unchanged.** The in-fight Resonance is still the authored
Ash + Elin climax alone; the bond points only leave the fight in its summary.
That is deliberate — it means every balance number this project has measured
still describes the fight it describes.

### The fire hears them, and the fork is the card

A pair that crossed a level gets their scene at the next campfire, **before**
the tree. It is a two-hander: only the pair is in the shot, which is the whole
reason the conversation is happening.

Every scene ends in a fork of two replies, and **each reply is a different
card** — a choice that only changed a line of dialogue would be a choice in
name only, so the card the reply wins is printed on the reply.

Six scenes: three pairs, two levels. Twelve cards.

### They are not upgrades

A bond card is a **sidegrade with a different shape**, costed against what it
replaces rather than above it. A card that is simply better makes every run
converge on the same deck, and the point of a fork is that both roads stay
worth walking.

```
"Cover me, then. Properly."   → Shield the Blade   5 damage. 5 Guard to an ally.
"Don't wait for me."          → Twin Shadow        5 damage ×2.
```

The cost is not power anyway. It is the slot.

### Five slots a hero, always

The deck used to be a constant. It is a **roster** now — three lists of five —
and `rosterValid` refuses anything else. A pair card goes into one of its two
heroes' five, and **whatever was there leaves**. Which of the two pays is the
player's decision, made on a screen showing both their hands side by side with
the card that is leaving struck through in red.

The slice gate asserts 5/5/5 and fifteen unique cards **continuously**, at
every step of a whole run, not at the end.

A pair card also needs **both voices**: one of its owners on the ground and it
cannot be played at all. That is the standing cost of a card two people own.

### What survives a death

A separate `kizuna23.profile` holds **which scenes you have heard and which
cards you have won**. Bond levels reset with the run; the profile does not.
That is the progression that outlives a death — and on a second run the fork
you did not take is still there, offering the half you have not heard.

### Found by building it

- The **slice gate caught the integration**: by stop 4 a party has usually
  earned enough bond that the fire opens a scene instead of the tree. That is
  correct behaviour, and the gate now walks the whole path — scene, fork,
  trade, tree — which is the one place the social layer, the deck and the road
  all touch at once.
- The **bot did not know about pair-owned cards** and looked up
  `heroes['ash|mira']`, which is undefined. Both simulators would have crashed
  the same way; it uses `ownerHeroes()` now.
- The trade screen's offered card **spilled off the right edge**, because
  `swapCardHTML` returns three sibling spans and `#k-swap-new > span` matched
  all three — so the cost, the body and the owner line each got the whole
  card's styling.
- The **cache-buster had drifted to `?v=32`** and sat there for three builds:
  two earlier `sed` passes matched nothing and failed silently. Now 35.

### Coverage

`test/bond.test.cjs` — **20/20**. Plus flow 126, road 34, camp 32, slice 22
(the slice grew two checks, one per bond trade it now walks). Zero page errors.

### The social layer, measured against its own absence

`SIM_NOBONDS` walks the same seeds without it. 120 roads per tier:

| | with bonds | without |
|---|---|---|
| ~half parries, runs completed | **32.5%** | 39.2% |
| excellent | 90.8% | 90.8% |
| bond cards traded per run | 1.15 | 0 |
| roads ending on 5/5/5, fifteen unique | **360 of 360** | — |

**A careless trade costs you about seven points of completion.** That is the
result, and it is the one the design asked for: bond cards are sidegrades, so
a swap made badly is a downgrade. The simulator's trader is deliberately
unclever — it gives up whatever scores lowest on a crude value-per-AP metric,
which means it hands over **Cleave**, the deck's best plain hit, because two
small effects out-score one large one on that metric.

So this figure is a **floor**, not a verdict: it is what the social layer is
worth to someone choosing badly. A player who reads the fork gains; a player
who does not, loses. Which is what a real choice is supposed to do — and it is
the opposite of the failure mode a card reward usually has, where every gain
is free and the only question is how fast you get it.

What can be said flatly: the gates hold either way, and **the 5/5/5 rule held
across every one of 360 simulated roads** — checked against the simulator's own
trades, not only against the interface's.


---

## Build 37 — the awakening

Slay the Spire opens every run with a choice made before you know anything.
It costs nothing, it cannot be optimised, and it is the first thing that makes
this run different from the last one. That job needed doing here too — but the
shape had to be ours, because a boon that is a stat bolted onto a character is
exactly the thing this game has spent thirty builds not being.

So it is a **memory**. The three of them wake at the trailhead and one of them
reaches back for something, and the thing it gives is the thing that memory is
about. Ash's mother's hands twisting dry grass gives you a fire to light. The
chord the three of them held at the end of something gives you the bond,
already ringing. The night nobody woke them gives you the health they got from
sleeping through it.

### What it is allowed to give

Nothing new. Every boon spends a currency that already exists — embers, the
KIZUNA ladder, health, a pair's closeness, a card won on an earlier road — so
the awakening adds a decision without adding a system. In particular **the deck
still does not grow**: `AN OLD HABIT` hands you a card you won on a previous
run and then sends you straight into the same swap screen every other card in
the game goes through, because five slots a hero is the rule the whole social
layer turns on and a run's first screen is not an exception to it.

| id | kind | gives | costs |
|---|---|---|---|
| `kindling` | plain | +4 embers | — |
| `lastnote` | plain | the bond begins at 45 | — |
| `rest` | plain | +6 health, all three | — |
| `close` | plain | a named pair begins at 10 (level 1 is 12) | — |
| `habit` | card | a card won on an earlier road | a slot, like every card |
| `borrowed` | trade | +8 embers | they set out already hurt |
| `debt` | trade | the bond begins at 70 | the Regent wakes with 14 more |

### Three are offered, and the composition is fixed

The contents vary; the shape does not. **Exactly one of the three is a trade**,
so the choice is never three flavours of free — and when an earlier run has won
a card, one slot is always that card. That second rule is the point of the
persistent profile. Before this, a card won on an earlier road did nothing
until the run happened to reach a campfire with the right pair at the right
level; the profile persisted and then sat there. Now it is on the first screen.

The offer is drawn from the run's own seed on its own cursor, so a seed still
names a run — the awakening cannot be the one thing about a run that is not
reproducible.

### Two new seams, and no more than two

`startCombat` gained `vigor` (max HP the party woke up with) and `foeBonus`
(HP *this* foe woke up with). Both default to nothing. The debt is settled with
the Regent and not with every wraith on the way to her, because borrowing
against the whole road would just be a difficulty setting.

### What it cost the road, measured

The run simulator now takes a boon through the real run layer and reads the
result back rather than re-implementing it, and rotates the pick by seed so a
tier walks all six rather than sampling one 120 times. Across 120 roads a tier:

| tier | before (Build 36) | with the awakening |
|---|---|---|
| no parry | 0.0% | 0.0% |
| ~half parries | 32.5% | **39.2%** |
| excellent | 90.8% | **94.2%** |

Median purse at half parries went 6 → 8. **A free boon at the trailhead is
worth about seven points of completion**, which is a real leg-up and is meant
to be one; every gate still holds, and the ordering by skill is untouched.

One road in 120 at the *no-parry* tier now dies at the first stop, which it
never did before — that is `BORROWED FIRE` starting the party at about 81%
health in the hands of someone who cannot defend at all. The trailhead gate is
measured at half parries, where it is still 0.0%. A trade that only has teeth
for a player who cannot parry is a trade behaving correctly.

### A softness this build did not introduce but did notice

The slice suite's **check count varies between runs** — 30 to 33 — because the
bond-trade check fires once per pending bond scene and bond points accrue from
fights played in real time. Every check passes; the number of them is not
deterministic. Verified against Build 36, which varies the same way (24/23/23),
so this is a pre-existing softness in the harness rather than anything the
awakening did. Worth closing, and not by pretending the count is fixed.


---

## Build 39 — the mark

A bond level used to pay once: a card, chosen at the fork, traded into the
five slots of one of the pair. It pays twice now. The second half is a
**sigil** — a mark on a card the party *already carries* — and the reason it
exists is the note that prompted it: cards are difficult to connect.

The combat record holds the vocabulary and the measurement. What belongs here
is the shape of the seam:

- `RUN.sigils` maps a card id to its mark; `RUN.pendingSigil` and
  `RUN.markPair` hold a grant that has been earned and not yet placed.
- The bond decides WHAT (`SIGIL_BY_PAIR`, fixed per pair and level, so a pair's
  level-up feels like *theirs* rather than a menu); the player decides WHICH.
- The flow is scene → fork → swap → **mark** → the fire. `confirmSwap` knows
  where it came from and routes accordingly, which is the same mechanism the
  awakening's card already used to avoid landing on a campfire screen with no
  campfire behind it.
- A grant left unplaced is **re-asked on boot**, exactly like an unanswered
  awakening. Closing the tab was otherwise the one way to lose a reward the
  road had already paid for.

### One screen, and no dead end

The marking screen shows the pair's ten cards, each drawn as a card wearing the
mark it would receive. There is no skip: a grant is a reward, and a screen you
can leave empty-handed is a screen that will eventually be left empty-handed by
accident.

That makes "every card already marked" a potential dead end. It cannot happen
today — a road grants at most six marks and a pair owns ten cards — but a
screen whose only exit is a button that might all be disabled is one roster
change away from trapping the run, so it falls through to the fire instead.

### What the simulator had to learn

The run sim models the bond trade locally rather than driving the screens, so
it would have kept measuring a bond level that pays once. It now places a mark
per level through the same `SIGIL_BY_PAIR` table the game uses and hands the
result to the bot, and a new **THE MARK** gate fails if a tier trades cards and
marks none — the failure mode Build 35 already recorded once, where a sim
reported three green tiers while trading zero cards.

`SIM_BAND` was added at the same time, for a reason worth writing down: the run
gate runs 120 roads per tier because three tiers at that depth is what a gate
can afford, and it is *convenient* to then quote those 120-road numbers as
measurements. They are not deep enough to be. `SIM_BAND=HALF SIM_RUNS=400`
measures one tier properly, and the first thing it did was overturn a finding
this build had already written down.


---

## Build 48 — the screens about cards start showing cards

"A lot of the memory and upgrade parts need visuals. Cards would be much easier
to understand the changes being made or added."

Two screens whose entire subject is a card were describing that card in prose
while the game had a painting for it sitting in `/art/cards/`.

### The fire wears the cards it upgrades

Nine tree nodes read "Cleave+ / 7 damage. → 10 damage." and nothing else: text
about a card you could not see, on the one screen whose whole purpose is
deciding which card to make better.

Every tree node names a real card and every one of those has a painting, so the
tile now wears it — the same grammar as the card face, with the picture bled
through the plate and a scrim taking it down so the words never fight it. The
art sits further back than it does in the hand, because a tile is a decision
ABOUT a card rather than a card, and the text stays the loudest thing on it. A
node already kindled or still sealed keeps its picture and loses its colour,
which is the same read the poor and dead cards get in the hand.

### The trade shows both cards

The swap screen asks the most consequential question on the road — which of
these fifteen leaves forever — and answered it with the arriving card as a
one-line chip in the top corner and the departing one as a text row in a list of
ten. **Neither card was ever seen.**

There is a third column now: LEAVES on the left, JOINS on the right, both as the
faces they will be in the hand — same painting, same rules, same 104×164. Until
a card is picked the left slot is a dashed frame that says CHOOSE A CARD, so the
panel reads as a trade waiting to be made rather than a picture of the prize.
The lists keep their compact rows, because ten cards have to be scannable and
ten faces would be a wall; the panel is where the two that matter get looked at.

The old header chip is gone. Nothing on this screen needs to say it twice.

An earlier note in the code said a full face was tried here and "hung off the
top of the screen — the header has 90px". That was true when a card was 186px
tall and the panel was imagined inside the header. At 164px, in a column of its
own, two of them fit with room to spare.

### The portrait fallback had drifted

The twelve bond cards have no painting yet and fall back to the owner's
portrait, framed as a bust. That anchor was tuned at `-20%` against the **186px**
card; on the 164px card the same percentage lifts the head clean out of frame,
so every bond card was showing a chest and a fistful of fabric. Swept against
all three portraits at the current size and set at `-2%`, where the faces
actually are.

That is a patch on a gap, not a fix for it. The twelve bond cards want their own
paintings the way the sixteen roster cards got theirs.

---

## Build 57 — the fire becomes a place

> *"The memory screen feels more like a spreadsheet grid than rpg, let's fix
> this to make it into a moment."*

The mechanics of the fire were right from Build 27 and none of them changed
here. What changed is that the screen stopped presenting them as a table.

### What was actually wrong

Ten rectangles of identical size in a 3×3-and-one grid, each carrying its own
`7 damage. → 10 damage.` — that is a changelog, laid out as a changelog, and it
read as one. Three specific things made it a table rather than a place:

1. **Nobody was there.** The party appeared as three 22px avatars in a stat bar
   at the top — row labels for the columns beneath them. The screen was called
   THE FIRE and contained neither a fire nor anybody sitting at one.
2. **Every node argued its own case simultaneously.** Ten before/after
   sentences on screen at once is ten sentences nobody reads. The information
   was all present and none of it was legible.
3. **Nothing happened.** Arriving, choosing and buying were all the same
   silent instant re-render.

### What it is now

**The party is present.** Each of the three stands at full figure, 118px, over
their own memories, lit from below by a fire that is just off the bottom of the
frame — three warm pools on their feet, two glow plates on offset flicker
tracks, and seven embers climbing the screen on staggered periods. The hero
header is the hero. The fourth column belongs to nobody, so a coal stands where
the person would.

**The memories are objects.** Each node is a card-shaped plate (79×134, close
enough to the hand's 0.634) wearing the painting of the card it sharpens, with
one ember badge for its price and its name on a scrim at the foot. Owned takes a
green tick, sealed goes violet and says the one thing it can act on, and a price
you cannot meet reddens the badge and takes the light off the picture — never
the picture itself, because the whole point of a price you cannot meet is that
you can still see what it buys.

**One place to read.** The before/after belongs to whichever memory you have
picked up, set once, in a strip along the floor at 11.5px instead of ten times
at 7.5px. Everything a node does is said there, at a size a phone can read.

**Picking one up is the first tap; kindling it is the second.** That is the
road's own grammar — one tap asks, the second commits — and it is what turns a
purchase into a decision you watched yourself make. A mouse gets it for free:
hover picks up, so one click still buys.

**Arriving is an event.** The memories deal in off the fire, left to right, and
the party rises into the light — once per campfire and never again for that
visit. A screen that re-deals its whole row every time three embers change hands
is a screen that flickers at you for using it, so `sitDown()` owns the arrival
and `renderCamp()` owns everything after it.

### Two checks whose rules moved, and one that was hollow

- *"every upgrade node wears the card it upgrades, **under the words**"* asserted
  the painting was dimmed below 0.8 so the prose on top could win. That rule is
  gone — the picture is the point now. Rewritten to the new contract: painting
  present and **lit**, name above it on its own backing, card-shaped by ratio.
  It had also started passing for the wrong reason: it read the first carded
  node, which by that point in the suite was an *owned* one, so it was asserting
  that a bought node is dim.
- *"what you cannot afford greys its PRICE, not its face"* kept its rule and
  gained the strip: the check now also requires the strip to name the memory and
  say what it would cost.
- New: the fire burns and the party is at it; the strip carries the diff and no
  plate restates it; two taps to spend; a sealed memory still explains itself;
  the row deals in on arrival and stays put on a purchase.

### Two bugs the rebuild surfaced

**A fresh fight could open on the previous fight's camera.** `startCombat`
cleared `_camPoseCur` but never released a *held* camera or a pending punch-out,
and `camReset` settles to whatever pose is current. A fight begun while a
punch-in was still held kept that shot, and the whole cast sat several pixels
left of where the layout puts it. `camHome()` now snaps to the player pose from
any state.

**A hero measured mid-glide is measured in the wrong lane.** The KIZUNA-overlap
check in the flow suite was intermittently failing with Elin's box 33px left of
where it settles. A fresh fight puts everyone back in their opening lane but
they *walk* there, and a lane is a depth — so the projected box is both wider
and further left while the walk is in flight. Same class of error as measuring
the campfire's deal animation. The rule is unchanged; the measurement waits for
the board to stand still, and `kzClear` now reports which clause broke and which
element it hit, because a bare `false` on a state-dependent collision cannot be
reproduced from the log.

---

## Build 58 — the road becomes a chart

> *"The world map needs work. In v2.2 the backdrop helped and the variety of
> paths helped. The UX and UI doesn't read JRPG roguelite."*

Three separate things were true at once, and each has its own fix.

### 1. It was a road on black

v2.2's world map was a PAINTING with a road across it. v2.3's was a flowchart:
`bg-descent.webp` at `brightness(0.42)` under a veil that reached 0.78 in the
middle, which is a black rectangle with eleven coins on it. The painting was
technically present and doing nothing.

The six charts come back — `map-lament`, `map-silence`, `map-stillness`,
`map-rust`, `map-cinders`, `map-deep`, already painted, already in the same
language as the bestiary — and one is chosen per run from the seed. The land is
lit now (`brightness(0.6)`), and the scrims moved to the EDGES where the header,
the legend and the card actually sit, so the band the road runs through keeps
its picture.

A region is a **name and a painting and nothing else**. No bias, no modifier, no
extra rule: the slice's job here is atmosphere and run identity, and a region
that also changed the maths would be a second system smuggled in behind a
backdrop. The header names it, and one line under the title says what it is.

That alone is what makes two runs feel like two descents rather than the same
descent twice.

### 2. Every road was the same road

The plan named two kinds per column and put them in the same lane every time.
Every generated road in the game was the same eleven coins in the same eleven
places; the only thing a seed moved was which diagonal joined them.

Four things move now:

- **Width.** A column names the kinds it MUST offer plus one it MAY, and takes
  the third about half the time. A fork can be two stops wide or three.
- **Lane order.** Which kind falls in which lane is shuffled, so the memory is
  not always on the bottom rail.
- **Position.** Each coin is jittered ±14px across and ±8px down off the grid,
  so the road wanders instead of running on two straight rails. The Regent does
  not drift — she is the thing the chart is pointing at.
- **Crossings.** "Straight ahead" is a RATIO now, not `min(i, len-1)`; a node
  forks at most once (two roads out is the most a glance holds); and a new
  orphan pass catches the one failure a wider column can introduce that a
  two-lane column never could — a third lane nobody's road reaches.

The authored pacing is untouched. The `must` lists ARE the old plan, and the
guarantees are now swept over 300 seeds rather than asserted on one: exactly one
elite, at column 3; two fires; an early memory on every road; nothing but a fire
or a memory on the Regent's doorstep.

### 3. It didn't read as a place

- **A stop has a name.** `BATTLE · BATTLE · BATTLE` down a chart is a difficulty
  list. Names are dealt without replacement per run, so no chart repeats one,
  and the name is the confirmation card's title — the kind becomes a chip beside
  it and the foe is named there too, where what you are being told is what it
  costs and pays.
- **The chart stays quiet.** Words surface only on the stops you can take, where
  you are, and the Regent — v2.2's rule. Eleven labels competing with a painting
  is most of what made this read as a list.
- **A legend**, bottom right, naming the five marks once so the chart doesn't
  have to. Bottom RIGHT because the first column's coins reach y≈332 at x≈108,
  and once they jitter that is the corner the legend was in.
- **The party walks the road.** `YOU ARE HERE` on a white tag is gone. The three
  of them stand on the stop they are standing on, and because the token is a
  persistent element rather than part of the nodes' innerHTML, its `left`/`top`
  transition — it walks to the next stop instead of blinking there. A downed
  hero greys out in the token.
- **A coin, not a ring.** On black a 1.6px ring over a flat fill was enough; on
  a painting it was a hole you could see the land through. The disc is lit from
  its own top edge and sits in a pool of shadow, so it separates from bright
  rubble and from black sky alike. The roads carry their own drop shadow for the
  same reason.

### The header had run out of room

Adding a region name and a KIZUNA carry to a header that already held a title,
a party, an ember count and a mute button overflowed a 932px phone: the title
wrapped onto the flavour line and the mute button walked off the right edge.
The party was the thing with slack in it — three heroes laid out as
portrait·number·bar was 468px — so the roster stacks its number over its bar
beside the portrait. That is ~200px back, and it reads as a JRPG party strip
besides.

### Checks whose rules moved, and one that had gone wrong

- *"every stop but the last is a choice of two"* → **of two or three**. What has
  not moved is that every stop but the last is a CHOICE, which is what the check
  was always about.
- *"the two lanes cross in EVERY column"* — the sweep's own definition of
  "straight ahead" was `min(i, len-1)`, which with three lanes feeding two
  counts lanes 1 and 2 as crossings. A genuinely bare column could have passed
  it. Now a ratio, matching the generator.
- *"only the stops you may take are bright"* — the Regent is deliberately
  visible from the trailhead (there is a check that says so), so she is now
  NAMED as the exception rather than allowed to quietly break the rule.
- *"no stop hides behind the card"* tested one seed's layout. The coins jitter
  now, so it is swept over 240 roads — exactly, without rendering 240 maps, by
  measuring one node's real extent around its centre and applying that envelope
  to every seed's stored x/y. The furniture it must clear includes the legend.
- New: the chart is a real region's painting at a brightness that leaves it a
  picture; the header names the same place the picture is of; all six charts
  turn up across 200 seeds; every stop has a name and no chart repeats one; the
  legend covers every mark on the road and the rest of the chart stays quiet;
  width, lane order, coin positions and crossings all move between seeds.

### Still open

The road's vocabulary is still five kinds. v2.2 had events and recruits as
well, and a MYSTERY stop is the obvious next one — but that is content, not
presentation, so it is not in this build.

---

## Build 59 — the MYSTERY stop

The road's vocabulary was five kinds and every one of them was an encounter:
fight, fight harder, rest, remember, die. A run had exactly one shape of turn on
it. The sixth kind is the stop that is a **decision** instead — the one place
the run's other currencies get spent.

### No coin flips

v2.2's events had real gambles in them, and that is the first thing this build
threw away. On a six-stop road a coin that eats six embers is not tension; it is
a stop that sometimes does nothing, and a player who reloads is a player who has
correctly identified that the stop was never a decision. Every mystery here is a
**trade with both sides written on it**.

That is also the only version of this a check can hold to account. The effects
are **data, never functions**:

```
embers  ± the purse          hurt    each hero bleeds (never below 1)
heal    each hero mends      bond    the WEAKEST pair deepens
kizuna  the carried %        regent  the Regent wakes with more HP
```

`regent` is the one that FEELS like a gamble — A SLEEPING ECHO pays ten embers
now and wakes the Regent with sixteen more HP at the bottom of the road — but it
pays its cost in daylight instead of hiding it behind a die.

Seven crossroads, dealt without replacement per run, so no chart hands you the
same one twice. Each names its own kind of question in an eyebrow: A CROSSROADS,
A BLOOD PRICE, A DEBT.

### The words come from the effect

Each pick's chips are **generated from the same object that applies the trade**,
split into gains and costs and coloured as what they are. A pick cannot
advertise a price it does not charge, because there is no second copy of the
price to drift. The road suite asserts exactly that: one chip per effect key,
every chip classified, and after the click nothing moved that the button did not
mention.

### The screen it borrowed

A mystery IS a small scene — two lines and then a question — so it takes the
memory's letterboxed stage rather than inventing a second one. Three kinds of
scene now share it, and two of them (a bond and a mystery) **end on their fork
and wait there**: the choice is the exit, and no amount of tapping resolves it
for you.

The mystery keeps the title in its own mist tone, dims the cast (the place is
the subject here, not the three of them), and takes a flat scrim under the ask —
the bond fork's radial one fades out before it reaches the question, and with
taller options "A BLOOD PRICE" printed straight across three pairs of legs.

### Where it can stand

A mystery is a **third-lane stop only**. It never displaces a `must`, so it can
never cost you the elite, a fire, or a memory — and `may` became a pool rather
than a single kind, so the third lane offers a crossroads *or* a fight depending
on the seed. Swept over 250 roads: every mystery wired to a written crossroads,
never repeated, never in a must-lane. About 60% of roads grow one.

### A crossroads cannot kill you

A stop with no fight in it that can end the run reads as a trap, and the road
already has an elite for that. Every blood price leaves 1 — swept across every
bleed in the table, from 1 HP.

### Two bugs found on the way

**Vigor was a lie on two screens.** `vigor` is max HP the party woke up with,
and the engine has always honoured it — but the road's roster and the campfire
each carried their own hard-coded 42/36/34. A party that woke with +6 was shown
the wrong denominator everywhere *and mended to six below its real ceiling at
every fire*. There is one `MAXHP` now and it knows about vigor. The mysteries
trade in health, which is what made three copies of that table untenable.

**The fork guard swallowed the memory's exit.** The new "scenes that wait on a
fork" rule was written as `kind !== 'story'`, and a memory scene arrived with no
`kind` at all — so `sceneNext` returned early forever, the memory never closed,
and the tier it promised was never paid. Every check still passed. The only
thing that noticed was the slice's own log line going from `memory, 9 taps` to
`memory, 40 taps` — the loop guard, not the scene.

Two fixes: the scene is tagged `kind: 'story'` at the source, the guard names
the forking kinds positively (an unrecognised kind falls through to the payout
rather than getting stuck in front of a fork that is not there), and the slice
now **asserts the memory closes itself and pays its tier** instead of counting
taps and moving on.

### Coverage

The slice's walk covers all six kinds now, on a seed whose best route touches
every one — a gate that only proves the road can fight and rest is a gate that
would not have noticed the mystery arriving broken. The camp block also stopped
inheriting wherever the section above happened to leave the party, and stands
itself one column short of a fire: a check that silently stops running is worse
than one that fails.

---

## Build 67 — the feedback and timing pass, and the blind spot that hid it

The note was three clauses. Build 66 answered the first two — more room between
the kill and the conversation, and the conversation held on the battlefield.
This is the third: *"we need to improve feedback and timing altogether."*

### The instrument, and the first thing it got wrong

Timing cannot be audited by reading constants. A 620ms flight that starts 300ms
after the press is a 920ms wait, and no amount of staring at `setTimeout` calls
will say so. So the pass began with `test/beat.sim.cjs` — a recorder that samples
the readable screen every animation frame (hand size, AP, health, damage numbers,
hit flashes, the parry bar, the husk, the reckoning) and logs the moment anything
changes. Then it drives the game with **real pointer input**, because the hand is
played by dragging and `.click()` exercises a code path no player has ever used.

Its first report was damning and almost entirely false:

```
play a card · press      306ms   the click feels dropped
end the turn           2381ms   dead air, worst 5166ms
the enemy's four hits land in   79ms
```

All three were artifacts. `sleep()` caps every wait at 24ms under `?test=1`, so
the instrument had been pointed at a build with its animation timing deliberately
removed. The "five seconds of dead air" was the parry bar — the best thing in the
game — running normally, invisible to a probe that watched `.k-note` when the
rings on screen are `.k-pring`.

**Every suite in this repo is blind to timing by construction.** That is correct
for a gate on rules and it is exactly why two real timing defects had survived
this long with 400+ checks green.

`?realtime=1` is the fix: test mode's determinism — fixed seed, fresh run,
silence — with the real durations put back. Measured against the shipping build,
the card answers the finger in **26ms**, the drop resolves in **28ms**, the
discard sweeps one card per 100ms and the volley spaces its four hits 330ms
apart. The game was already good. Two things were not.

### The dirge arrived as a lump

The volley gives every hit its own beat. Then the dirge — the party-wide tax that
actually decides runs — applied all three shares inside one synchronous block and
popped three numbers into a single frame, on top of the volley's numbers that had
not finished clearing. Six figures on screen at once, and the one the player most
needs to read was the one they could not.

It sweeps now. The stage darkens first (the hymn is heard before it is felt),
then it takes the party one at a time, front to back, with each hero's health
draining *with* their own number rather than three bars dropping behind the first
figure. Measured: three heroes hurt 0ms apart → **251ms and 235ms apart**; peak
simultaneous numbers **6 → 4**.

A hero whose Guard ate the whole hymn used to print `0`. Banking Guard against
the dirge is the counterplay the tax exists to teach, so the turn it works now
looks like it worked.

### The body fell inside the killing blow

`fxFoeDown` fired in the same frame the health hit zero — **13ms** after the
killing hit, while that hit's own flash was still on screen. Impact and collapse
arrived as one smear and the death had no moment of its own.

It is held 420ms now: the blow connects, the figure stands a beat too long, then
it goes down. It costs the player nothing — the road already waits 1750ms before
taking the board back, so this spends silence that was there anyway. Measured:
blow → fall **13ms → 436ms**; fall → reckoning **1754ms → 1333ms**.

### The gate

`test/beat.test.cjs` is the first suite that boots `?realtime=1`. It is slow on
purpose and it enforces **order and spacing, never exact durations** — a check
pinned to the millisecond breaks on every deliberate retune and teaches nobody
anything. The rule it holds is: *two things the player must read separately do
not arrive in the same frame.*

Run against the pre-fix build it goes red on both defects (`peak: 6`,
`holdMs: 19`) and green after — which is the only evidence that a new gate is
worth its runtime.

**One of its checks was hollow and had to be caught twice.** The first version of
"no two heroes lose health in the same frame" only timed the *gaps* between health
changes, so the old lumped dirge showed up as a single well-spaced event and
sailed through the exact defect the check was written for. It reads *what*
changed now, not just when: a frame that moves two heroes at once is the lump,
however well spaced it is from its neighbours. Verified red on the old code
(`lumpedFrames: 1`) where the timing-only version passed.

### What the instrument cleared

Worth recording, because three plausible fixes died here:

- the card press is not slow — 26ms to lift, with the aim beam up in the same frame
- the enemy turn is not dead air — the parry bar holds it open for ~5s
- the discard sweep does stagger — one card per 100ms

Measure, then act. Two of the three "obvious" fixes this pass started with would
have made the game worse.

---

## Build 68 — a pair card is not a person

The 16-run soak (eight had been the habit) turned up a crash the whole suite had
been walking past:

```
onEnd failed TypeError: Cannot read properties of undefined (reading 'n')
  at openReckoning (run.js:1337)
```

**What it was.** Pair cards carry owner ids like `ash|elin`, and `dealToBoss`
wrote whatever it was handed straight into the deeds ledger as the finisher. So
when a pair card landed the killing blow, THE LAST BLOW built a cast naming
somebody who does not exist, `openReckoning` read `.n` off nothing, and the
hand-off died inside its own try/catch: the fight over, the conversation never
opening, the road left holding a board with no way out of it.

It needed a pair card to land the kill **and** a hero on the brink, which is why
eight runs never saw it and sixteen saw it twice.

**Two layers, as usual.** At the source, the ledger records a person or nobody —
when the two of them ended it together, `finishPair` says so and `finisher` stays
null. At the gate, `pickReckoning` checked the *shape* of a cast (two entries,
not the same one twice) and never that either entry was somebody; it now requires
both to be real, and warns with the reckoning id and the offending cast when it
throws one out, because a guard that silently drops a malformed cast fixes the
crash and hides whatever built it.

**The check that nearly shipped hollow.** The reproduction marked Elin at the
brink — on a hero at full health, where `markBrink` correctly does nothing. THE
LAST BLOW therefore had no second name, was never selected, and the reckoning half
of the check passed without ever building the malformed cast it exists to catch.
Hurt her first, then mark it. Against the old code both checks now go red on
exactly the right value: `cast: ["ash|elin", "elin"]`.

`pickReckoning` also stopped throwing when asked outside a run. It is a pure read
of the ledger; a check or a sim should be able to ask it the question.

### The soak's own cap

While chasing that, the soak reported `camp did not open the fire` on a seed that
had queued five bond scenes in front of a campfire. That was the harness: it
drained at most four before calling the fire stuck. There are only three pairs, so
four looked like plenty — but a pair whose bond crosses two thresholds queues
twice, and after four straight wins each paying a reckoning, five deep is an
ordinary Tuesday. It drains until the fire opens now, and prints the deepest queue
it saw, because *how many conversations stand between the player and the fire* is
a pacing fact worth watching rather than a number to bound and forget.

---

## Build 69 — a longer road, and the upgrades spread out along it

Six notes came in at once. Four of them are one change with four faces.

### The road is eleven stops, not six

A six-stop road had nowhere to put anything. Every upgrade the game owns — two
or three bond conversations, the mark that puts a state on a card, the whole
ember tree — could only land at a campfire, because campfires were the only
stops that could carry them. So a fire was four systems stacked on one screen,
three times a run, and nothing happened on the other three stops.

Eleven columns, with fires at 3, 6 and 9 — a third of the road apart — so the
run has a rhythm of press-forward / sit-down instead of one long grind and a
rest at the end. Two elites instead of one. Nothing but rest and memory on the
Regent's doorstep, which was already the rule and now has room to be true.

The coins shrank to match: 34px instead of 52, the wander halved from ±14 to ±7
(centres are 73px apart now, not 146), and the name bags roughly doubled,
because names are dealt without replacement and an eleven-column chart was
emptying them and falling back to BATTLE, BATTLE, BATTLE.

### The campfire is the fire again

Bond scenes used to WAIT for a campfire and arrive all at once when they got
there. They fire where they are earned now — on arrival at the next stop, before
that stop's own business, **at most one**. Eleven stops carry the developing half
of the game between them instead of three.

The chain (scene → fork → swap → mark) remembers which stop it interrupted on
`RUN`, not in a closure, because it spans three screens and the tab can close in
the middle of it.

### What that measured

The pace sim, same seeds, same bot:

```
                 cards swapped in    nodes kindled    won
  before  ordinary        1.07             1.29       6/14
  after   ordinary        3.92             2.58       8/12
  before  sharp           2.21             2.07      13/14
  after   sharp           4.67             3.92      12/12
```

`docs/THE-BENCHMARK.md` set the bar itself: *a run that changes fewer than ~4
things about the party between the trailhead and the Regent is survivable and
static.* An ordinary run changed about 2.4 things. It changes about 6.5 now —
the road clears its own bar for the first time. Deaths also spread across
columns 2, 4, 6, 7, 8 and 10 rather than piling up at a single cliff.

**Three harnesses were walking six stops of an eleven-stop road** and reporting
the truncation as a difficulty spike — the pace sim came back 0/12 at every
skill level with four deaths, which is the harness giving up, not the game
getting hard. Every one of them reads `R.STOPS` now, along with nine road checks
that had the number 6, `col(4)` or `/^5:/` written into them. A check has no
business restating a constant it does not own.

### Readiness that reads

**The all-out bar** pulsed a box-shadow and nothing else — a soft halo on a 15px
strip, next to three health bars and a damage number, is not a thing that says
press me. The whole control swells now, the label brightens on the same beat,
and the fill catches a travelling highlight. Measured: scale 1.009 → 1.035.

**A live combo** breathed gold; it now runs a wisp of light around its border,
brightest and fastest for AFTER AN ALLY — the combo the player is being taught
to watch for, which exists only because of the card somebody else just played
and stops existing the moment anyone else acts. A still glow says "this card is
special"; something moving says "right now". Measured: the wisp angle advances
187° → 245° → 302° → 359° → 57°.

The wisp is its own element, not a pseudo: `.k-card::before` is the face's inner
texture and `.k-card-poor::after` is the unaffordable scrim, and a card can be
armed *and* unaffordable — both slots were spoken for, and taking either would
have silently deleted something.

### The reckoning says what it pays

The prize was a hairline chip of 9.5px text under two lines of dialogue, which
made the loudest thing on a reward screen the wording of the answer and the
quietest thing the reward. It is a band across the foot of the option now, and a
bond carries the **faces of the pair it deepens** — whose bond and by how much,
with no reading. The two prizes are not the same kind of thing, so they are not
the same colour: a bond is warm and belongs to two people, momentum is cold and
belongs to the road.

The title also names the fight it ends — `THE CHOIR OF ONE · FALLEN` over
`NOT ONE MARK` — because four words in a corner with nothing attached is a
caption for a scene the player has to reconstruct.

### A title

The game opened straight onto the awakening: a three-way fork over cards, before
anything had said what this is or who these people are. There is a title now —
the name, the premise in one line, the three of them in silhouette along the
bottom, and one door.

It is on the **real boot path**, not skipped in test mode: the harness presses
the button a player presses, so every check in every suite is running against a
game that was actually started. A reload lands there too, and offers the stored
run as CONTINUE rather than silently resuming it — which is most of what a title
is for, and means the run coming back is something the player asks for. BEGIN
AGAIN throws the stored road away, because leaving it beside a second run is how
somebody ends up with two and no way to tell which one they are in.

---

## Build 70 — four playtest agents, an 87-frame filmstrip, and what survived verification

`test/filmstrip.cjs` walks one seed end to end in realtime and photographs every
state it passes through. Four agents then reviewed those frames against the
source — combat screen, road/camp/tree, narrative screens, mechanics-vs-StS2 —
with the browser driven centrally so only one Chromium ever ran.

They returned about thirty findings. This build ships the ones that survived
verification. **Everything below was measured or read out of the source before
it was touched**, because the last three passes have each killed a plausible fix
that turned out to be a harness artifact.

### The road was a corridor, and it was measurable

The lead finding, and the one worth the whole exercise. `buildMap` gave every
node its straight-ahead edge unconditionally and a *second* exit only 55% of the
time; the fallback below it repaired the **column** — it guaranteed a crossing
existed somewhere — and never the **node**. So arriving at a stop that lost its
coin flip raised `CHOOSE THE NEXT STOP` over a board with one lit coin on it.

Swept over 400 roads: **43% of stops were single-exit, and 31% of arrivals
offered no choice at all.** Six stops hid that. Eleven made the road read as a
corridor — which is exactly the failure the forced-crossing rule was written to
prevent, arriving through the door it left open.

The roll now decides *which* second road, never *whether* there is one. After:
**8.2% single-exit and 0% dead arrivals** — and every one of those 8.2% is
column 9, the run-in to the Regent, where a single exit is correct by design.
Gated over 300 roads.

### The stitch cap was enforced for one pair out of three

`C.turnState.stitchedPairs.push(pairKey)` lived **inside** the Resonance branch,
so the cap held for exactly one case: `ash|elin`, before Light Through Steel had
been generated. `ash|mira` and `elin|mira` were never recorded and were paid on
every adjacency in a turn; `ash|elin` went uncapped for the rest of the fight the
moment the Resonance card appeared.

Measured: `elin|mira` **2 → 4** across two adjacencies in one turn, `ash|elin`
**2 → 6** across four. That is Build 62's defect back in the building — a bond
paid by fight *length* — and it inverted the deck's own incentive, since
ping-ponging two heroes out-earned spreading across three, the opposite of what
FINALE asks for.

**The check that guarded it was hollow.** It asserted `bond.stitches` — the
Resonance counter, which is the one thing correctly capped — and never touched
`pairBond`, the currency at risk. It also happened to drive the single
pre-generation `ash|elin` case that worked. It reads points now, and a second
check covers the two pairs that have no counter to hide behind.

### Two features had the same class name

`.k-mk-row` was the map legend's row *and* the mark screen's row of cards. The
legend's child rules — `b { font-size: 7.5px }` and `i svg { width: 13px }` —
were therefore applied to every card face on the mark screen: DAMAGE rendered as
"MAGE", GUARD as "UARD", HEAL as "IEAL", and the combo strips ran outside the
card border. Ten unreadable cards on the one screen that sells the game's
signature idea — a bond putting a permanent state on a card you already carry.

Renamed the legend's to `.k-key-row`. Every rules line reads now, measured at a
uniform 73px with zero overflow.

### Who is about to be hit

The entire answer lived in a chip row at top-right, and the "to whom" was a
**17px circular crop of character art** — three dark-haired figures on dark
armour. `cardFaceHTML` had already reached this exact conclusion for the card
corner ("at a size where Ash and Mira are one silhouette") and swapped the disc
for a name; the telegraph kept the disc.

The chip names the hero now — and the same number appears **beside the health bar
it will empty**, so reading "who takes 13 twice" and "who is at 4 health" is one
glance instead of two journeys across the screen. A blow that kills marks itself
differently from a blow that hurts, because that is the difference between a
turn where you Guard and a turn where you do not.

### Smaller things that were simply wrong

- **The dirge wore the Break glyph.** `INTENT_ICON.dirge = 'brk'` — the same
  split-apart mark the player's own cards use for "2 Break" — so one screen
  carried it meaning both "strip the Regent's poise" and "2 unblockable to all
  three of you". It has its own glyph now.
- **The crossroads named the wrong pair.** The chip read `closest pair +N`;
  `takeEvent` applies it through `weakestPair()`, the pair *furthest behind*. It
  advertised the opposite pair from the one it charges — the single failure the
  `fxWords` function exists to make impossible. It names them outright now.
- **Ash was "her" on the second screen of the game** and "he" in every bond
  scene. And a reckoning whose cast is chosen at runtime asked "what does *she*
  say to that?" for a pair that is two-thirds of the time not she.
- **"The bond begins at 45"** set `r.kizuna`. Bond and kizuna are two different
  currencies with two different readouts, and the awakening taught the wrong word
  for one of them before the game had taught either.
- **The campfire's loudest button was the one that leaves it** — same gradient,
  border and weight as the road's TRAVEL button, i.e. the styling that means
  "commit", while the fire's actual commit is 8.5px grey-gold text inside a
  strip. A first-timer with embers in hand could press it believing they were
  proceeding. It is a ghost button now.
- **The held beat read as a form field** — one italic line pinned to the top-left
  of a 92px plate with sixty pixels of void under it. Centred, in both the scene
  and the reckoning.
- **The third hero vanished at the reckoning.** At `brightness(0.4)` on sprites
  already near-black, against a pale flooded street, a reviewer mistook Mira for
  the fallen enemy. On a screen whose premise is that there are three of these
  people, one of them cannot disappear.

### What was deliberately NOT acted on

The mechanics audit reported a skill-cliff regression at 8% / 42% / 100%. My own
measurement of the same build, the same afternoon, gave **17% / 67% / 100%**.
Both are n=12 with a bot that routes on `Math.random()`. Two samples that far
apart do not settle a balance number, and the standing task in this repo has said
so since Build 64: *a bigger sweep before touching another number.* A 40-run
sweep is running; the elite stays as it is until it lands.

---

## Build 71 — the sweep answers, and the bond gets a face

### What n=40 said

The Build 70 audit's headline was a skill-cliff regression to 8% / 42% / 100%,
with the second elite named as the cause and a nerf recommended. It was not
acted on, because a measurement of the same build the same afternoon gave
17% / 67% / 100% and both were n=12 with a bot routing on `Math.random()`.

Forty runs a skill:

```
  clumsy    7/40   17.5%
  ordinary 21/40   52.5%
  sharp    39/40   97.5%
```

The §3.1c line (21/57/100) within the noise. **Not a regression.** And the
elite, specifically — ordinary deaths at n=40:

```
  wraith    8   42%
  mourner   7   37%
  revenant  2   11%   ← the encounter the audit wanted nerfed
  cultist   2   11%
```

Exactly backwards from the n=12 claim that it kills twice as often as the
Regent. Deaths land at columns 4, 5, 7, 8 and 10 across five different foes —
a distributed curve, which is what Builds 58 and 69 were reaching for.

Two credible reports, one with a file:line for every claim, both built on twelve
runs. The standing rule since Build 64 — *a bigger sweep before touching another
number* — is the only reason a working encounter did not get tuned away.
Recorded as THE-BENCHMARK §3.1d.

### What n=40 confirmed instead

The bond is the run's largest mover — **2.83 / 4.13 / 4.65** cards swapped in,
each also paying a mark, against **1.48 / 2.38 / 3.90** tree nodes of ten — and
it had no readout anywhere in the game. The tree has a screen, a tier badge,
prices and a strip naming every node. The system that changes *more* about the
party had nothing, so "play Elin straight after Ash to deepen Elin+Ash" was a
rule you could only learn by reading the source, and the reckoning's fork was
unpriceable: you cannot weigh BOND +6 against a threshold you have never seen.

Three pair bars now sit in the road header — two faces, a fill, and the number.
`7/12` says both how far and how much further, which a bare bar cannot. The fill
measures progress *within the current level*, so crossing one resets it rather
than creeping toward a far end; a pair with nothing left to give shows the sigil
instead of a fraction, so a full bar never reads as a bar that is stuck.

### The header could not hold it, and nothing would have said so

Adding those three bars measured the **embers counter out to x=1049 and the mute
button to x=1090** — both entirely off a fixed 932px header that does not
scroll. The run's own currency and one of its two controls, gone, with
everything still on screen looking perfectly fine. That is the failure mode a
visual review cannot catch, because what remains is not wrong.

The bars were compacted, the party's HP bars gave back 14px each, the all-out
meter dropped its word for a mark (it is the fourth in a family of bond meters
now, not a lone gauge that has to introduce itself), and the header's gap went
14px → 9px. Every piece of it is measured against the board now, and the check
asserts the board reported a real width first — **the first version of it
measured while the map was not the screen that was up, got zero for every rect,
and passed "nothing is off a 0px board" green.**

---

## Build 72 — what the screen tells you, and the fix that told you twice

Six findings the last two audits left verified but unbuilt, each measured before
it was touched — and then re-reviewed by a fresh agent, which found that one of
the fixes had introduced a worse problem than the one it solved.

### The five that were simply wrong

- **The AP pips were captioned DECK.** Measured: the pip row ends at bottom 330,
  the deck pile's caption starts at 335 — five pixels apart and overlapping
  horizontally, so three diamonds and the word DECK read as one labelled
  control, and the pips, which have no caption of their own, borrowed the wrong
  one. Lifted clear: the gap is 27px.
- **The Poise gauge counted down, unnumbered.** Twelve lit pips meant "furthest
  from Staggered" — backwards from every stagger bar a player has met — and with
  no number, three turns of chipping looked identical to none. The pool is POISE
  and what your cards deal is BREAK, which is the grammar the card faces already
  use; a full bar now honestly means intact, and it reads `12/12`.
- **The dirge denied it had an answer.** The chip said `all · no parry`, which is
  true and is not the whole truth: Guard absorbs it, and STAGGERING her cancels
  the entire action, hymn included. On the single largest source of damage in
  the fight, half a truth reads as "there is nothing to be done".
- **The telegraph overflowed the board.** Centred on a fixed x, it grew outward
  in both directions — 4 of 17 intents ended at x=943 on a 932px board, and
  naming the targets made it worse because a name is wider than the 17px
  portrait crop it replaced. Right-anchored, it cannot: 0 of 17 overflow, with
  249px of headroom. A centred readout of variable width will always find a case
  that does not fit.
- **The game had no rules text.** `COND_RULE` explained a card's condition and
  that was the whole rulebook — Break, Guard, Bleed, Chill and the dirge were
  bolded numbers with no definition anywhere in the build. The keywords a card
  uses are spelled out beside it in the inspect panel now, at the moment the
  player is looking at that card and asking what it does.

### The fix that told you twice

The incoming-damage badge — added at Build 70 so the threat sits beside the
health bar it will empty — folded the dirge into a single total. So Ash's row
read a flat `✦12` while the telegraph beside it read `9 ASH` and `3 all`.

**Two authoritative numbers for one event, which is worse than the
seven-hundred-pixel journey the badge was added to remove.** The code comment
said the two "can never disagree", and that was true of the data and false of
the display. It prints the sum as its parts now — `✦18+3` — the same two figures
the chip row shows, in the same order.

The same mistake had a second face: `.k-pt-aimed` was keyed on total incoming,
and every foe in the bestiary carries a dirge that reaches everyone, so all
three rows wore the aimed outline on every turn of every fight. A highlight
that is always on is chrome, and it drowned the turn where somebody genuinely
is the target. It means aimed now — measured on the Hymn, which strikes Ash
twice and Elin once and leaves Mira alone: two rows outlined, not three.

### And bigger was not enough

The lane word is the cue for the biggest defensive lever in the game — standing
back cuts a sweep by 70% for 1 of 3 AP — and it was 7px of the dimmest grey on
the board. Making it 9.5px and brighter did not achieve the stated goal, because
at `bottom: -16px` the label hangs under the figure's feet and **the two heroes
nearest the camera have their feet inside the hand**: MID at y256 and FRONT at
y278, against a hand that begins at y253. Two of the three were painted behind
the cards, and the only one a player ever saw was whoever stood in the back —
which reads as a note about that one hero rather than as evidence that a lane
system exists at all. The label sits on the figure now. All three clear the hand.

That one is worth keeping in mind: the fix was applied, the measurement of the
thing changed confirmed it, and the goal was still not met, because the property
that mattered was one nobody had measured.

---

## Build 73 — the lane becomes a priced read, and two instruments stop lying

The row system was the last verified-but-unbuilt finding: three named positions
that a player could finish several fights without discovering. Going at it turned
up two measurement bugs first, which is the more useful half of this build.

### The bot could not see where anybody was standing

`test/bot.cjs` forecast damage with `hit.backFactor` — a field the engine
renamed to `sweep` + `ROW_SHELTER`, and said so in a comment. The line was never
updated, so `hit.backFactor` has been `undefined` on every hit since. **Every
balance number this repo has produced was measured by a party that could not
tell the difference between standing in front of a sweeping blade and standing
behind it.**

Its one positional rule was keyed on `it.frontOnly`, which appears exactly once
in the whole engine — its own definition — and it only ever considered heroes
already under 20 health, which is after the choice stops being worth anything.
It now moves whoever a sweep is aimed at, when the forecast says the step
measurably blunts what is coming and the AP is spare.

### `forceIntent` selected something else, on 11 of 17 calls

Worse, and older. The hook found the intent's index in `REGENT_INTENTS` — the
full table of eight — and assigned it to `C.boss.intentIx`, which
`currentIntent()` reads against `C.intents`, **the foe's filtered subset**. The
two lists only agree for a foe that draws every intent.

```
  husk:    asked toll        → got scythe
  cultist: asked benediction → got rain
  wraith:  asked scythe      → got rain
```

Eleven of seventeen. Every check in the suite that names an intent on a
non-Regent foe has been asserting against a different intent and passing — and
it is why my first attempt to verify the sweep mark reported no sweep at all on
a foe whose scythe carries two of them.

Both instruments are gated now: a check drives `forceIntent` across the whole
bestiary and asserts it returns what it was asked for.

### And then the lane

On paper the shelter is enormous — `ROW_SHELTER` is 1 / 0.62 / 0.3, so the
Scything Advance is 26–34 at the front and 8–12 at the back. **One AP, twenty-two
damage: the best single AP a player can spend anywhere in the game.** The
telegraph showed it as an ordinary number, so the lane was a decision nobody
knew they were being offered.

A sweep now says so, and says what stepping back would cost — as a number, not a
percentage, because this deck's rule is that the screen shows the number that
will actually land. `7 MIRA ⤳4 · 11 ASH ⤳7`. The mark is computed by the same
function that will land the blow, so the promise and the outcome cannot drift,
and a check takes the offer and asserts the number it was promised is the number
that arrives.

A first draft of that mark printed `→38%` off the ratio while the engine
actually dealt a 36% cut. Small, and exactly the kind of small that the rule
about showing real numbers exists to prevent.

### The flake, finally

`kzClear` has been intermittently reporting the all-out bar colliding with Elin
since Build 57, and has been re-rolled past several times. The heroes glide
between lanes on a 620ms transition, and a rect read mid-glide reports a hero
33px left of where they stop, in a wider box. A fixed sleep only moves the odds.
It polls until two consecutive frames agree about where everybody is, then
measures. Three consecutive full runs of flow: 222/222.

## Build 74 — the screen stops saying things twice

Fourteen of the fifteen notes from the last playtest, plus one instrument fixed.

**The road.** The region name is the title now (`THE STILLNESS`, not `THE DESCENT`
over it). The three bond meters were six 16px portraits of the same three people
already standing at 33px beside them — they are two-letter chips now, dim when a
pair has never spoken. The edges dropped from 2.2/3/2.6 to 1.2/1.7/1.5 and the
coins from 34px to 27px, so the chart stopped reading as a diagram of string.

**One tap travels, and the coin carries the price.** The confirmation card was
added when the road was six big coins and a misfire cost a run; at eleven it was
a toll on every move. It could only be removed once the numbers it carried moved
somewhere the player can read them BEFORE committing, so every reachable stop now
prints its own `+3✦ · 46hp` under its mark, and the 900px `CHOOSE THE NEXT STOP`
banner is gone. Three checks that asserted the old two-tap rule were rewritten
against the new one; two more (fire, memory) asserted a receipt on the map for
something the player had just watched happen and now assert the state instead.

**Blue means a team play.** Gold was marking two unrelated things on one card
face: *this belongs to a pair* (permanent) and *this combo is live right now*
(one action). A hand with three gold cards in it said nothing. Duo cards and
Finale cards are cool-lit now — frame, wisp and armed breath — and gold is left
to mean only ARMED. A blue card wearing a gold rim is exactly what it looks like.

**AP left the corner.** A 66px ring with a numeral in it, stacked over three
diamonds saying what it was out of, in the one corner of the board a player
reading their hand never looks at. It is a row of marks under the hand.

**The telegraph got a plate.** Every other readout on this board sits on
something; the most important line in the turn was asked to survive on
text-shadow over a painted sky. It has a hairline box and a `NEXT` caption.

**A corpse does not breathe.** `broken` is a two-frame *bouncing* loop — authored
as a stagger, which is a thing that happens to a foe that is still alive — and
death borrowed it wholesale, so a dead enemy lay on the ground ping-ponging
forever. `foeAnimKill` walks the frames to the last one of the broken run and
freezes them, and nothing can revive it; the CSS kills the breathing loop and the
reflection on the plate-only foes.

**The fire's tiles show their paintings.** Measured: an 80×134 tile with
`inset: 0` and `cover` over a 420×560 painting threw a fifth of every picture
away sideways, and then brightness 0.78 under an opaque lift took most of the
rest — the sealed tiles were rendering 42% opacity of a 0.34-brightness image,
which is why half the tree looked like it had no art. The plate is a true 3:4
window at the top of the tile now, with the words in the band beneath it.

### The instrument: three parry checks were racing, not failing

While measuring the above, LENS failed three runs in a row and looked like a
regression from the blue cards. It was not. Bisected to a class name, then to a
class name **with no CSS attached** — at which point a *different* parry check
failed instead, and then a third. All five fragile checks shared one shape:
`endTurn()`, then a flat `setTimeout(620)` "past the lead-in", then a query for
`.k-pring`. Under any load the lead-in and that constant drift apart and the
probe reports the parry bar missing when it is merely late. They poll for the
ring now. Flow went from ~1-in-1 wandering red to ~1-in-3, and the one that is
left (MASH, `.k-pring-burst`) is a different probe with the same disease.

The lesson is the one this repo keeps relearning: a reproducible-looking failure
is not a caused failure, and the way to tell them apart is to bisect until the
change that "causes" it is provably inert.

## Build 75 — the mark stops being a settings panel

**The wording.** Five sigil lines in three different voices: `held` described
the card ("Stays in hand"), `opening` described its own rules text ("Its combo
counts if…"), `kindled` addressed nobody. They read as errata. They are written
to the player now, they lead with what the mark BUYS, and the two that cost
something say so in a second sentence where a cost can be read rather than in an
em-dash apology hanging off the end of the promise.

**The banner is a tab.** A mark used to print a full-width gold ribbon across the
middle of the painting — the loudest object on the card, wider than the card's
own name, reading as a sticker slapped over the art rather than as something the
card had earned. It runs down the LEFT EDGE now: a 13px strip in the mark's own
colour, the mark's glyph struck into the head of it, the name set vertically
beneath, on the one edge of a 104px face nothing else uses.

Two things that cost measurement. Padding the whole face by the tab's width cost
Light Through Steel a line — 10px of vertical overflow the unmarked card did not
have — and narrowing the tab to 9px did not clear it, so width was never the
problem: the reflow was. Only the name block takes the inset. And a name that
needed the whole line before losing 13px of it now steps down a size instead of
ellipsing: LUMEN CASCADE read as LUMEN CASCA… the moment it was marked, which is
the exact failure `.k-cname-vlong` exists to prevent.

**The mark is a scene.** It was a title, a rules line and two rows of cards on a
flat void with 170px of nothing between them — a settings panel wearing a serif.
What is actually happening is that two people who have been through something
together are teaching each other a trick, so that is what is drawn now: the road
they are standing on dropped almost to black, the two of them facing each other,
the mark burning in a medallion between them, and one line saying what passed.
The cards are the answer to a question the scene asks. One line per mark rather
than fifteen, with the names substituted — the pair is already standing there
saying who taught it — and written so either half of a pair can be A.

**The icon set.** Laid out at 11/13/18/34px, four of thirteen did not survive
their own size: `atk` was a hollow blade outline stroked at 1.9 on a 16-unit box,
so at 11px the outline closed on itself and the most-used mark in the game read
as an ankh; `draw` was a card outline with an arrow INSIDE it, which is a filled
rectangle with a smudge; `broken` was a bolt thin enough to read as a stray tick;
`heal` was a two-stroke cross with no mass. Rule that came out of it: a glyph
that must read at 11px is FILLED — stroke is only for marks whose whole meaning
is a line, and four of thirteen still are. The first filled sword stood upright
with a wide crossguard and was a PLUS SIGN at 11px, indistinguishable from the
one mark it must never be confused with; it is on the diagonal now.

**And `drawDiscard` was two things in one row.** Inside a 73px face it wrapped at
the comma and printed "Draw 1" over ", discard 1", which reads as a rendering
fault rather than as a rule. A row is one clause.

## Build 76 — the third try at the mark, and telling two black coats apart

**The mark chip.** Two treatments failed before this one. The ribbon was a
full-width gold bar struck across the painting — louder than the card's own
name. The spine that replaced it fixed the loudness and introduced a worse
fault: the word ran vertically, and a seven-letter word at 7px turned ninety
degrees is decoded, not read. Nothing else in this game asks the player to tilt
their head. It is a small horizontal chip under the cost orb now — glyph, then
name, on one line, on the dark end of the painting where the art has nothing to
lose. It floats over the art rather than taking width from the face, so the two
compensations the spine needed (a 13px inset on the name block, and a whole set
of step-down name sizes for marked cards) are both gone, and no card name trims.

**Telling Ash and Mira apart.** Measured off the source paintings at 120px, mean
over every pixel with alpha:

| | mean RGB | luma | saturation |
|---|---|---|---|
| Ash | 38,35,35 | 35.8 | 0.236 |
| Mira | 51,48,50 | 49.1 | 0.141 |
| Elin | 97,95,92 | 95.8 | 0.092 |

Two of the three are near-neutral blacks **thirteen luma points apart out of
255** — a five percent difference. At the 33px they are drawn at on the road and
in the reckoning they are the same object, and only Elin is identifiable, purely
by being twice as bright. The party already had a colour language — the cards
tint each owner's frame violet, gold and copper — and the figures were the one
place it had never been applied.

Grading alone cannot fix it, because there is no hue in a neutral black to push:
the first attempt bought separation by *darkening* Ash (35.8 → 27.2 luma), which
trades one problem for another, since contrast() pivots at mid-grey and only
pushes a dark painting further into the ground. The lever that works is the one
a painter would reach for — a **coloured rim**, two passes per hero in their own
colour. With grading and rim together: Ash↔Mira RGB distance **24 → 47**, luma
gap **13.3 → 25.7**.

This is a mitigation and should be recorded as one. The paintings themselves
still want a value separation no filter can invent.

**The step cue teaches once.** Three gold arrows stood permanently in the middle
of the battlefield saying a thing that is true on every turn of every fight, and
the middle of the battlefield is the one part of that screen meant to be a
picture. The cue shows on turn one, on the figure the finger is on, and while a
move is in the air. The check that gates this was verified red against the old
always-on rule before being kept.

## Build 77 — the telegraph names a place, not a person

The chip named the hero each blow was aimed at — nine letters of ASH/ELIN/MIRA
per blow — and with three blows plus a dirge the readout ran 425px of sky. The
name was also the wrong axis. Rows are EXCLUSIVE in this game: `moveHero` trades
places, one hero per row, always. So a row letter identifies the target exactly
as precisely, in one character instead of nine, **and** it names the thing the
player can actually act on. Where a name tells you who is about to be hurt, a
row tells you what stepping would do about it.

`F / M / B`, not the `F / C / B` the first sketch used: the floor of the
battlefield already has FRONT, MID and BACK painted on it, and a legend that
disagrees with the board is worse than no legend.

**Repeats are spelled out.** `9 ×2` was a compression bought at name-width, where
a second chip was unaffordable. At three characters two chips fit, and two marks
in a row is how a player counts blows without doing arithmetic. The Hymn reads
`⚔9 F  ⚔9 F  ⚔9 B` — which is exactly the "Sword F Sword F" shape.

**One symbol per kind of blow**, and this deck has exactly two reachable kinds
plus the hymn: an ordinary strike, and a SWEEP — the one that standing further
back blunts. That distinction is already in the rules and the player already has
to act on it, so it is the one the marks carry. Inventing Magic/Special
categories the engine does not have would have put a lie on the most important
line of the turn.

Swept every intent in the bestiary at both phases: widest readout 410px, none
off the 932 board. The middle dots went with the names — every reading now ends
in a boxed letter, which is its own seam.

### The probe that measured its own concatenation

`noWords` read the whole container's `textContent` and matched `[A-Za-z]+`. The
row plate and the counterplay hint are adjacent spans with no whitespace between
them, so it glued `ALL` to `Guard` and reported a word nobody had written. It
reads element by element now. Three of the four new telegraph checks were
verified red against the old naming rule before being kept.

## Build 78 — the corner fold, and the type line it needed

**Four treatments, and only the fourth is on the frame.** A full-width ribbon
across the painting (too loud). A spine down the left edge with the word set
vertically (a seven-letter word at 7px turned ninety degrees is decoded, not
read). A chip on the art (readable, but sitting on the one thing the face has
that nothing else does). The fold takes the single square of a card that is
frame rather than image.

**And the fold could not have the corner, because the verb marks were in it.**
Arena's answer to exactly this is the TYPE LINE: a band between art and rules
carrying what the card *is* on the left and the set symbol on the right. The
owner line already was that band and its right half was empty. So the verbs moved
down into it, the art got a hairline floor, and the name and owner went flush
left — which is also where an ellipsis belongs, and is why LIGHT THROUGH STEEL
now sets on one line where centring it needed two.

The fold is glyph and colour only. A symbol cannot state a rule, so the mark's
NAME and its sentence moved to the inspect panel — which is again what Arena
does: symbol on the card, reminder text on the detail view. Without that step
the fold would have been a colour the player had no way to look up. The detail
panel is sixteen pixels wider to carry it, and its hint lost half its words.

**The telegraph loses its plate.** Build 74 gave it a box and a NEXT caption
because the marks were bare glyphs on a painted sky and would not hold. That was
solving the wrong half. What could not hold was the CONTENT — three nine-letter
hero names and a collapsed ×2 spread over 425px — and once Build 77 turned each
reading into a mark, a number and one boxed letter, the box was furniture built
to carry furniture. The readings are dense enough to be their own object; the
sky goes back to being sky.

## Build 79 — density on the telegraph, tiers on the card, and the parry flake caught

**The telegraph, 425px → 311px.** Mocked at three densities against the actual
sky rather than guessed. What shipped is the number leading at 18px, the mark
dropping to footnote size (it is the least surprising of the three readings),
the row plate second, and two changes that were pure width:

- the sweep rider was a curved arrow the eye had to decode; a plain arrow beside
  a row letter reads as *step, and it becomes this* without a legend
- `Guard or Break` was eighty-five pixels of prose sitting at the end of a line
  of marks — the only sentence on the readout and the widest thing on it. The
  shield and the split are the same two glyphs the player's own cards use for
  exactly those two things. The words survive in an `.k-sr` span for anyone
  reading the screen rather than looking at it.

**The card's tiers separate by value, not by size.** Measured on Counterstance:
name 8.8px, rules label 7.3px, type line 7px — three tiers inside 1.8px, which
is one tier. The obvious fix is to raise the name, and it was mocked: at 11.4px
COUNTERSTANCE reads COUNTERSTAN… and LIGHT THROUGH STEEL reads LIGHT THROUGH
ST…, the exact failure the long-name sizes exist to prevent. **The name cannot
grow.** So the other two tiers step back instead — the type line goes small, dim
and widely tracked, the name takes the brightest value on the face, the rules
labels give some up — and the tightened band pays for seven more pixels of
painting. The combo tag was left alone: the rule two hundred lines below it says
it is what a player scans a fan for, and a tier pass that quietly undoes a
considered decision is a regression wearing a tidy-up's clothes.

Swept all 28 cards in all six mark states. Two things fell out that would
otherwise have shipped: ELIN + MIRA trimmed by one pixel on the type line, and
Cross Sever with an OPENING mark overflowed by two — only when its combo was
live, because `opening` arms a FOLLOW_UP at the top of a turn and the `ON` badge
appears. `flex-wrap` was the wrong lever there: the items were never wrapping to
a second line — the label is a bare text node, so squeezing the row made that
one item shrink and its own text wrap inside itself.

### The parry flake was a probe reading the previous check's bar

Three parry checks had been taking turns going red for months. The LENS check
forced an intent and ended a turn **on whatever fight happened to be live** — and
`endTurn` is a no-op unless the phase is PLAYER_READY, so when the block before
it left the game mid-enemy-phase the call did nothing, the `.k-pring` on screen
belonged to the *last* bar, and the sampler measured a camera still in the player
pose. Reproduced directly: start a bar, wait 900ms, start another, and the first
samples come back ring-up at dz 26 / yaw 3.4 before the new composition lands at
t≈50 — which is exactly the failing signature, `leanedIn: false, worstPivot: 3.4`.

Waiting for one quiet instant was not enough either, because `startCombat` does
not cancel an in-flight `runVolleyRhythm`: the old bar goes on posting rings onto
the new fight's stage and driving the lens home between them. The check waits for
twenty consecutive ring-free samples before starting its own fight. Four
consecutive 223/223 runs.

## Build 80 — the keyword and the rule part company, and the trace

**Card bloat: the face keeps the keyword, the pickup panel takes the sentence.**
Measured across the deck first. The longest line on any card was
`Leaves the fight when played.` at twenty-nine characters — a full sentence
restating the keyword EXHAUST directly above it. Next was
`5 Guard to the lowest ally` at twenty-six, then `Take their parry window` at
twenty-three for a rule that reads the same every time it appears, which is the
exact shape of a keyword.

- EXHAUST stands alone; its sentence moved to the panel
- `Take their parry window` → **Intercede**, a new keyword with its rule in the panel
- `5 Guard to the lowest ally` → `5 Guard · lowest`
- `Next parry +2 Break` → `Parry +2 Break`
- `Step to the front` → `Step front`

Longest face line: **29 → 19 characters.** And the panel gained the thing it had
never carried — what the combo actually *pays*, which is the question a player
opens it to ask.

**The mark moves to the border.** Arena marks a treated card on its outline, and
mocked side by side that is the half a corner cannot do: an outline is findable
in a fan without the eye landing on any particular part of the card. Dropping the
fold and keeping only the border was mocked too and loses the identity — every
mark becomes the same card in a different hue. So both, each doing its own job.

**The trace — press, walk the figure, release.** The other six notes are all one
decision: when to touch, or which way to shove. This is the first that asks the
hand to do something with a *shape* in it. Three figures — an arc, an angle and
a long line — drawn as waypoints on `[-1,1]` scaled into the ring, each lighting
as the finger reaches it, in order. No path-similarity metric and no curvature
score, because a player cannot see either of those, and a grade they cannot see
coming is a grade they will call unfair.

It grades on the release like a hold, it gets the most runway in the vocabulary
(2.3 beats — it is the only note whose answer takes time to *perform* rather than
to decide), and a figure walked to its last waypoint but never released pays one
grade rather than missing outright.

**It REPLACES a slide in both intents it appears in** — the Regent's Rising Dirge
and the revenant's Grief in Threes — rather than joining them. A new note kind is
a change to how hard a fight is to play, and adding one to the deepest intent in
the bestiary would have moved the ladder as well as the vocabulary. Same count,
same beats, one harder gesture.

One thing to be honest about: the bot grades every note by a flat per-note skill
number regardless of kind, so no sim in this repo can tell you whether a trace is
harder for a *hand* than the slide it replaced. That needs a human.

## Build 81 — the ring is the handle

Build 80 got the trace wrong. It drew four small waypoints around the ring and
asked the finger to touch them in order, which turned one gesture into four
little ones and left the ring itself — the object the entire parry language is
built on — sitting still in the middle doing nothing.

**The ring travels now.** Press it, carry it along the rail the note has drawn,
let go at the mouth. One press, one continuous movement, one release, and the
thing under the finger is the same circle every other note has taught.

- the rail is a cubic sampled into points, in stage px, offset from where the
  ring spawns; the finger is *projected* onto it, so the ring cannot leave the
  rail however wide the hand wanders — the skill is walking it on the beat, not
  drawing neatly
- `t` only ever goes forward (with a little give), or a hand could scrub back
  and forth over the mouth fishing for the beat and the note would stop being a
  journey
- the press has to land ON the ring. A stab at the far end is not a grip, it is
  a guess, and a check now proves reaching for where the ring is *going* does
  nothing
- the whole journey is drawn from the frame the note spawns — bed, run and
  mouth — because a gesture note is only fair if you are never asked to guess
  where it wants you to go
- travel is a TRANSFORM, not `left`/`top`: the re-anchor loop rewrites those
  every frame so a camera move cannot leave a ring behind, and the two would
  have fought each other sixty times a second

**And the first rail ran off the top of the board.** It swept upward by
1.06 × RAIL from a head that sits around y=135 on a 430px stage — the screenshot
showed the ring cut in half by the sky. The sweep is mostly *sideways* now,
because sideways is where this board has room: 466px either side of centre
against 135 above a hero's head. Swept every hero × every row × every shape ×
both sweep directions: **zero rails leave the board.** The mouth was also drawn
at r=17 against a 58px ring, which read as a dot the ring would swallow rather
than a berth it has to be parked in.

## Build 82 — the rail is the ring's own silhouette

A dotted line said *a path goes here*. It did not say what was going to travel
it, or how much room that would take. What the note is actually describing is
the shape the ring **sweeps out** on its way to the mouth — a tube the width of
the ring with a round cap at each end, which is the ring at the start and the
ring parked at the finish, joined by everything in between.

SVG has no "outline of a thick stroke", so the outline is a mask: the path
stroked at the ring's full width in white, the same path stroked three pixels
narrower in black, and a rect painted through the hole that leaves. What
survives is exactly the two edges and the two caps. The tube body sits behind it
in near-black so the silhouette reads over a painted board, and the run fills
that tube in behind the ring as it travels.

Two things fell out of drawing it:

- **it had to go UNDER the ring.** The tube's start cap sits exactly where the
  ring is — that is the point, the ring is the thing that swept it — but painted
  on top the two outlines crossed and the pair read as a knot rather than as a
  circle about to set off. The rail is beneath now, and the ring gained a dark
  hub so the tube's lines do not show through its middle.
- **the mouth stopped being a separate circle.** It was drawn at r=17 against a
  58px ring, which read as a dot the ring would swallow. The tube's own end cap
  *is* the berth; all it needed was a pip at its centre to aim at.

### And the trace check had the LENS disease

It came back `{}` on every field — which is what `JSON.stringify` prints when a
probe returned `{found:false}` and the detail line asks for fields that were
never set. Same cause as Build 79's parry flake: `endTurn` is a no-op unless the
phase is PLAYER_READY, and `startCombat` does not cancel an in-flight volley, so
a block that opens while the previous bar is still unwinding never spawns a ring
of its own and then measures whatever is on screen. Twenty consecutive ring-free
samples before it starts, the same fix, and two clean 227/227 runs.

## Build 83 — the ring goes where the finger goes, and nothing else takes the finger

Two faults, and the first one was not the trace's at all.

**Pressing a note was grabbing the hero under it.** The rings sit over the
figures, and `.k-hero` carries its own drag handler — so a press on a ring also
fired the hero's `pointerdown`: the rows lifted out of the ground, the move hint
came up, and `setPointerCapture` took the pointer. Touching a note made the whole
board move. It is gated now, and the gate is **the phase and the DOM, not
`_live`** — the first guard read `_live.length`, and that is a running array a
note removes itself from, so one leaked entry would kill hero movement for the
rest of the fight. That is a worse bug than the one being fixed. A hero can only
be moved on your own turn anyway (`moveReason` has always said so), and a ring
in the document is a fact that cannot go stale.

**And the ring was rubber-banding to the curve.** The first pass projected the
finger onto the rail and snapped the ring to the nearest point on it, so the
circle slid out from under the fingertip on every cut corner — the thing you
were holding was not where you were holding it. It follows the hand one to one
now, capped so it cannot be carried somewhere the note never asked for, and the
rail decides separately whether the journey *counted*: progress only advances
while the finger is inside the tube. So the arc still has to be walked, the
circle is never anywhere except under the hand carrying it, and a hand that has
wandered out of the tube is told so rather than silently given nothing.

Measured after: `followDrift 0` off the rail, `endDrift 0` at the mouth, progress
`0` while astray and `1` after walking it, `boardMoved false`, `heroDragging
false`. Three new checks hold all of it.

## Build 84 — a door onto the deck, and a header that is where you are, not what you own

**The header.** Three bond chips reading `0/12` sat across the top of the chart
— permanent furniture for a number that moves once, at a fight's end. The
reading has to exist (a fork that offers BOND +6 is unpriceable against a
threshold you have never seen) but not there: it lives beside the two people it
is between, on the deck screen. Embers moved to the left with the region and the
stop count, because where you are and what you carry are the same kind of fact.
What is on the right is two doors: **the deck**, drawn as a fan of cards because
Spire taught every player of this genre what that icon means, and **a menu**,
which is where the mute went and where the next setting will go.

**The deck screen.** Three heroes down the left, the five cards each carries to
the right. Fifteen slots is the run's actual shape and there was nowhere in the
game to look at it — the only view of a card outside a fight was whichever one a
scene happened to be offering. Tapping a slot opens what that hero has set down,
and picking one trades the two.

The bench sits on the **right**, not along the bottom: a bottom sheet would have
printed over Mira's row, the third of three and as likely to be the one being
reconsidered as either of the others. The rows only use the left 57% of the
board, so it opens into space that was already empty.

### The rules change this required, stated plainly

A swapped-out card used to be **written over and gone** — `list[ix] = newCard`,
and the old name never appeared again. That made every trade permanent, and it
made "another one they own" a set that did not exist. There is a bench now: five
slots per hero is untouched, but the card that steps out is put down rather than
destroyed.

**This softens a cost the swap screen was built around.** Its own copy asks
"which of these fifteen leaves forever?" — and the answer is now "none of them,
it goes on the shelf". That is a deliberate consequence of being able to swap
freely from a deck view, not an oversight, and it is the one thing in this build
worth a second opinion: if trades should stay one-way, the deck screen becomes
read-only and the bench holds only what a scene displaced.

---

## Build 85 — the bench is kept, and the copy stops charging for it

The second opinion came back: **keep the bench.** So this build does the
follow-through that the answer implies, which is almost entirely a copy problem.

The swap screen still asked `FIVE SLOTS EACH — WHAT LEAVES?`, and the receipt
after a trade still read `ASH gives up Cleave` over the line `the deck never
grows`. All three describe a cost the game no longer charges. Copy that
describes a rule that is not there is worse than no copy at all: a player who
believes it plays around it — hoarding a slot, refusing a trade — and the game
never corrects them, because from the inside a rule you are obeying and a rule
that exists look identical. So: `WHO STEPS OUT?`, `ASH sets down Cleave`, and
`five slots, and a bench`.

### The reload bug that was not one

The probe written to prove the bench survives a reload reported this:

```
before reload {"roster":["guardcut",...],"bench":["cleave"]}
after  reload {"roster":["cleave","guardcut",...],"bench":[]}
```

Read at face value that is a lost bench and a reverted swap. It is neither. The
suite boots `fresh: testMode() && !resume` — `?test=1` **wipes the stored run on
purpose**, so every suite starts clean, and the probe reloaded without
`&resume=1`. It was measuring the wipe. Booting the way a player's reload boots
returns the swap and the bench intact.

The lesson is the one this project keeps relearning from the other direction:
an instrument that boots differently from the thing it is measuring reports on
itself. `?test=1` caps every sleep at 24ms and it also throws the save away;
both are right for a suite and both make a specific class of question
unanswerable unless you opt out of them.

There is now a check that asks the question properly — `DECK: the swap and the
bench are still there after a reload` — and it re-navigates to `&resume=1`
rather than trusting the boot it inherited. Gated red by removing the `save()`
from `deckSwap`, where it printed *byte for byte* the output above. That is the
proof the check is not hollow, and it is also the proof that the original
"bug" was the probe: the same wrong answer, from a genuinely broken save and
from a correct save read through the wrong door.

### Noted while hunting for the rest of that copy

`RUN.flash` — the post-stop receipt — is **written in six places and read in
one, and that one is behind `if (false && ...)`.** The receipt was deliberately
removed from the map card in an earlier build (its comment says so: it announced
what had happened on the screen the player had just left, and took the widest
band at the foot of the chart to do it), but the six writers were left in place.

So the `sets down` / `five slots, and a bench` correction above is, today,
correcting text nothing displays. It is still the right correction — a fossil
that says the wrong thing is worse than one that says the right thing, and the
receipt may well come back somewhere narrower — but it is worth recording that
the swap screen's `k-swap-ask`, which a player *does* read, was the only one of
the three that was live. Ripping out the flash system or reviving it is a scope
decision, not a copy fix, so it is flagged here rather than done.

---

## Build 86 — the deck screen stops being mostly empty

Playtested the deck screen against the report that "the card selection is weird
— a lot of wasted space when nothing is selected". Both halves measured true,
and they are the same mistake twice:

| | before |
|---|---|
| board the rows use | **537 of 932px** — 395 x 374px holding nothing |
| the drawer, once a card was tapped | **352 x 374px, 8% full** |

Tapping a card with nothing benched produced a 131,648px² panel containing one
sentence. That is the screenshot the report came with.

### What the mock killed first

The obvious fix — centre the rows so the board is balanced — was rendered and
thrown away: it moves the void from the right to the left, and leaves the
left-anchored title stranded 400px from the content it titles. The rows cannot
grow into the space either; three rows of cards on a 430px board is already the
largest they fit, so the width is not theirs to take.

**The space needed CONTENT, not a re-balance.** And the content a player wants
beside a card shrunk to 0.72 is that card, read properly.

### The panel

The right 352px is now the selected card's own reading — `staticInspectHTML`,
**the same panel combat draws on a press-and-hold** — with the swap offer as a
strip beneath it. Two jobs in one panel, because they are the same question
asked twice: a player looking at a slot wants to know what is in it and what
else could be. It used to answer only the second, and only after a tap.

**There is no unselected state any more.** Opening the screen reads Ash's first
card; a tap moves the reading; tapping the card already being read is a no-op
rather than a way back to a blank board. Fill went **8% → 53%** on open and
**83%** with alternates, nothing overflowing.

Two things the first render got wrong and the screenshot caught:

- **Guard's rule was cut mid-word** — "it is spent at th". It scrolls now, and
  the fade cue is set from a measurement (`scrollHeight > clientHeight`) rather
  than guessed per card, because whether it overflows depends on the mark and
  the keywords too. A cut sentence with no sign there is more reads as a fault.
- **Every condition said "NOT YET"** — the static evaluation has `condActive:
  false`, so on a screen with no turn in progress the panel made a false claim
  about a fight that is not happening. `condLive: false` states the rule and
  stops.

### Press and hold

The same blow-up combat opens, on the same 420ms, built from the same function.
A gesture that works in a fight and does nothing on the next screen is worse
than no gesture, because the player stops trusting the first one. The scrim is
darker here than in combat (0.22 vs 0.42) — combat dims a painted board, this
dims a lit panel already showing the same card's rules, and at combat's value
the two readings printed over each other as a double image.

`openInspect` and the deck screen now share one builder. Two rules panels would
drift; one cannot. The footer text is the caller's — "drag to play" is a lie on
a screen with no board.

### Checks, and why three of them drive the mouse

Ten new checks. Three of them move a real mouse rather than calling `.click()`,
because **`element.click()` fires no pointerdown at all** — a hold that also
fired the tap underneath it would pass every synthetic check and still be
broken in the hand. That is exactly the shape of the "the entire frame moves"
bug from Build 83. They assert: a quick tap moves the reading and opens nothing;
a hold opens that card's blow-up and the release does **not** also select it;
holding a bench card reads it while tapping it trades it.

Gated red by removing the swallow — and the first attempt at that gate *crashed*
rather than failing, because once the hold traded the card away the locator had
nothing to find. A check that aborts the suite instead of reporting is not a
check, so `at()` returns null now and the failure says "the bench emptied — the
hold traded it".

One check was rewritten rather than kept: `DECK: the bench stays shut until a
slot is tapped` asserted the old design and was right to at the time. What it
protected against — clutter with nothing to say — is what its replacement
measures.

---

## Build 87 — a gold card, and motion that arrives

Two notes: the deck selection should highlight the card in gold rather than
paint a yellow bar beside it, and the game's animations "just snap with no ease
in and out".

### The bar, and why the snap was structural

The marker was a 3px bar in `::after` — a cursor BESIDE the card rather than a
state OF it, which is what a list has and a board does not. The card is what
was chosen, so the card is what changes now: a gold rim, a warm bloom off the
face, and 5px of lift. Four treatments were mocked; the one that also dimmed
the other fourteen was thrown away, because a deck screen exists to be read
across.

The easing half turned out not to be a curve problem at all. Measured:

```
survives: false          ← every tap rebuilt all fifteen cards
cardTransition: " / "    ← and the card declared no transition anyway
```

`tapSlot` called `renderDeck()`, which rewrote the whole row. **A CSS
transition needs the same node to still be there when the class changes**, so
every transition on the selection was dead on arrival — no easing curve could
have fixed it, because none of them ever ran. A tap toggles a class now and
repaints only the panel; the rows are rebuilt when the *roster* changes, which
is when they actually differ. The lift then interpolates across 14 frames.

### The motion pass

50 transitions and 120 animations across a dozen hand-written curves, **36 of
them on the bare `ease` keyword** — `cubic-bezier(.25,.1,.25,1)`, which leaves
fast and arrives fast, so a 120ms one reads as a cut. Three tokens now:

```
--ease-out: cubic-bezier(.2,.8,.3,1)      arriving
--ease-in-out: cubic-bezier(.4,0,.2,1)    moving between two states
--ease-soft: cubic-bezier(.25,.6,.3,1)    long, quiet fades
```

Every transition takes `--ease-out`; one-shot animations take it too; infinite
pulses take `ease-in-out`, because an asymmetric curve shows a seam at the loop.
Screens no longer cut — `screen()` toggles `display:none`, which nothing can
fade, so the arriving screen plays a 260ms entry instead (the title and the
stage are excluded; both already have an entrance).

**What is deliberately NOT eased.** The parry ring's close, the hold drain and
the beat pulse are CLOCKS — the player reads them to time an input, and easing
a clock makes it lie about how much time is left. Those stay linear, and so do
the infinite shimmers. There is a check that says so.

### The check that caught its own silence

The first motion check walked `document.styleSheets` and reported a clean
sweep. Its companion integrity check reported this:

```
{"rules":237,"withTransition":0,"withAnimation":0}
```

237 rules read, **zero transitions found** — in a file with 51. A declaration
written as `transition: filter 220ms var(--ease-out)` is *pending
substitution*: the CSSOM returns EMPTY STRING for every longhand of it. So the
scan saw nothing and called it clean. It reads the shipped file over HTTP now.

That is the whole argument for pairing a finding with a proof that the
instrument was looking: **an empty scan and a clean one produce identical
output.**

Two of the new checks were also too weak to survive their own gate:

- The gold check matched the colour `240, 212, 136` — which the RESTING state
  also declares, at zero alpha, so the gold has something to interpolate from.
  It passed on a card whose gold had been deleted. It requires opaque gold now.
- "Arrives on a curve" read the transition *declaration*, so it stayed green
  through the gate that restored the rebuild. It samples the lift across real
  frames instead: `steps: 1` is a snap, `steps: 14` is a curve.

### One flake, root-caused rather than re-run

`PARRY: pressing way early nudges` went red once under load and clean three
times alone. Not a regression — a keyframe curve cannot decide whether a press
is early — but a real race worth closing. "Way early" means more than 260ms
before the note lands, and the check polled in 10ms steps and then slept a
further 60ms before pressing, into a lead not much longer than the window
itself. Under load the press landed INSIDE the window, graded normally, and the
check reported a missing nudge for a feature that works. It presses on the next
frame now and reports the margin it achieved: **7ms after the ring, down from
~70+**.

---

## Build 88 — a memory arrives as a frame

A MEMORY stop opened on `bg-descent.webp` — the same crushed plate every scene
in the game shares — so three different memories arrived looking identical, and
the screen announced *a cutscene is happening* rather than *THIS is happening*.

Each memory now names its own still, and the stop opens on it: full bleed, held
for 2.2s as a title card with the memory's name over it, the letterbox bars
closing over the shot, a slow 4.5% push-in. Then it dissolves down into the
backdrop it was always going to become — **the same frame**, crushed to
atmosphere. Dissolving into a different picture would be a cut, and would throw
away the one thing the splash just established.

### The splash is an overlay, not a phase

The obvious build is `_beat = -1` with the scene held shut behind the splash.
That is the version that breaks things: every check and the soak's random walk
drive scenes by beat, and a stop that opens on a beat no caller expects is a
stop the walk can sit inside forever. So beat semantics are untouched — the
scene is live and advanceable from the first frame — and the splash plays over
the top and gets out of the way. A tap dismisses it *and* advances, because a
player who taps wants the scene, not an argument about which layer they hit.
There is a check that presses on exactly this: **the title card is not a gate.**

### The art is not rendered yet, and that is visible in the code

**Higgsfield was not reachable in this session** — its MCP server was
disconnected (all 79 tools gone; `ToolSearch` found none), so the three frames
could not be generated. The render path ships complete; the images are pending.

`docs/SCENE-ART.md` holds the brief: house style, frame size, negative prompt,
and a written shot per memory — *the party stopping to listen* for the lullaby,
*the third one stepping into the line* for the careful one, *scale and the
absence of a bottom* for the stair. It exists so the set can be re-rendered
without re-deciding what is in the shot.

Until they land, a memory opens on **the run's own region painting** rather than
the generic descent plate. Worse than a bespoke frame; still this run's place.

### The manifest, and the 404 that would have failed every suite

The first version simply pointed at `scene-<id>.webp` and let `onerror` fall
back. It works, and it cost a 404 — and **every suite here counts a console
error as a failure.** `road` went to `pageErrors: 1` the moment the art slots
landed. So the game asks for a frame only when the frame is here:

```js
const SCENE_ART = {
  // 'lullaby': 1, 'careful': 1, 'floor': 1,
};
```

Empty on purpose. A check walks that manifest and HEADs each file, so an id
left behind after a rename fails by name (`{"missing":["lullaby:404"]}`)
instead of quietly turning a title card into a black rectangle — which is
exactly what the gate produced when one was added.

### Two the first render got wrong

- **The title printed through the dialogue plate.** At `bottom: 62px` it landed
  exactly where the plate sits. A title card puts the title in the frame:
  centred now, with the plate, the cast, the corner title and SKIP all out
  while it plays.
- **The plate faded out over 380ms.** Motion nobody sees — the splash already
  covers it — whose only actual effect was a ghost of the dialogue box under
  the title card's entrance. It leaves instantly and returns softly.

One check was reading at 2400ms and calling a working hand-off broken: the full
sequence is 2200 held + 320 dissolve + 380 fade back.

### The soak found a soft-lock I had just built

The first version hid the plate, the cast, the corner title **and SKIP**, and
took their pointer events away for the whole 2.2s hold. Every suite passed. The
soak did not:

```
seed 1000 · entered story: nothing to click on k-scene — soft-lock
seed 1000 · entered camp:  nothing to click on k-scene — soft-lock
   …six stops of one seed
```

`#k-scene-skip` was the *only* control on that screen, so hiding it left the
game waiting for a player it had stopped offering anything to. The rule the
soak encodes — **the moment the game is waiting for a player it owes them a
control** — is a good one, and a 2.2s window is exactly the size of bug that
passes a hundred deterministic checks and gets found by a random walk.

SKIP is live throughout now, dimmed and lifted above the splash: a player who
has already heard this memory should be able to leave *during* the title card,
not after it. The road suite asserts it too, where it fails in one second
rather than in a ten-run walk.

### Two suite fixes this build forced, both of them real

- **`FITS` mis-modelled `aria-hidden`.** It carved out decoration that may sit
  past the stage edge, but asked only the element itself — so the splash's
  deliberately overscanned still, which its own container clips, was reported
  as spilling. `aria-hidden` is inherited; the check asks the subtree now.
- **`PARRY: pressing way early` was reading a stale ring.** Build 87 shortened
  the press to 7ms after the ring and called it fixed. It flaked again at 24ms
  — so I measured the lead instead of guessing: **~500ms**, which makes a press
  a few ms in ~476ms early and unable to fail. The failures were never the
  margin. `startCombat` does not cancel an in-flight volley, so a ring from the
  *previous* check's bar was still up, the poll returned it instantly, and the
  press went into a note already 400ms through its life. Twenty ring-free
  samples before starting — the same remedy LENS and TRACE needed. Third time
  this suite has caught this one disease; the check now reports `ringWaitMs` so
  a fourth is diagnosable at a glance (`~550` means the board really was quiet).

---

## Build 89 — the three frames, rendered

Higgsfield came back, so the frames Build 88 left pending exist now:
`soul_location`, 21:9, all three in one batch.

### One of them was a technically excellent image of the wrong story

`careful` came back as **a romantic embrace** — a swordsman holding a
pale-robed woman in a lovers' pose, large and specific in the foreground, in a
bright green-grey garden. It is a lovely painting. It is also a frame that
rewrites the party: that scene is Mira asking two people how long they have
moved like one animal, and them saying the practice *ended*. Comradeship and a
grief they will not name. Not romance.

The brief did it. It said the pair "stand close, shoulders almost touching, the
easy geometry of long practice" — and **"almost touching" is an instruction to
touch.** The reroll says the opposite in as many ways as it can (`NOT touching,
NOT embracing, no physical contact of any kind — three separate comrades`) and
puts the failure in the negative prompt. The spec keeps both, because the
failure is the more useful half: a brief that produced the wrong relationship
once will produce it again.

The check that matters here is not automatable — **does the frame say what the
scene says?** Two of the three passed on the first pass and one did not, and no
amount of measuring the lower third would have caught it.

### The exposure spread nothing would have caught either

The three came back at mean luma **22 / 30 / 78** — nearly a stop and a half
apart. That is invisible on the title card, where each is shown at full
strength on its own, and fatal afterwards, where all three go through one
backdrop filter: at the inherited `brightness(0.24)` the lullaby read fine and
the careful one was **solid black**, two seconds of establishing a place
followed by the place not being there.

Fixed in the art rather than the CSS: each frame is scaled to mean luma ~30 at
export, so one rule serves all three and the set holds together as a set.

Then the rule itself was wrong. `brightness(0.24)` was tuned against
`bg-descent`, whose mean luma is **12** — the old backdrop was near-black by
construction, which is right for a mood plate and wrong for a frame the splash
just spent two seconds establishing. Bespoke stills get `.k-sc-own` and
`brightness(0.5)`, landing around 15: present, readable as a place, well under
the text. The region fallback keeps the old rule — those are map paintings at
mean ~44 and would glare.

Also recorded in the export step: the renders are 21:9 (2.388) and the stage is
2.167, so the export centre-crops rather than leaving `object-fit: cover` to
trim it. A crop decided at export is a crop you can look at.

---

## Build 90 — the gesture is the attack, mirrored

Two notes: the telegraph callouts don't clearly match what the enemy actually
does, and press-and-slide still doesn't work.

### The mismatch, measured

A hit named a **note** — a rhythm token picked for variety — and the foe's body
was then made to agree with the note (`FOE_SWING` mapped note → animation,
which is backwards). Tabulated:

```
intent        the foe visibly does   the hand was asked for
hymn          toll                   tap,tap / feint,tap / tap,hold
scythe        sweep                  slide:R,tap / slide:L,hold,tap
flurry        sweep                  tap,tap,tap / tap,trace:angle / burst
crescendo     rain                   tap,tap / trace:arc,tap,tap / feint,hold
```

Three of seven intents had gestures that agreed with what the foe appeared to
do. The Hymn is a bell being struck and asked for two taps. Grief in Threes
wore the SWEEP pose and asked for three taps and a traced angle.

And worse: **the pose was chosen per INTENT**, so a three-blow bar held one
posture throughout — the foe struck three different ways and looked identical
every time.

### Acts

A hit now names **acts**, and the act is the single source of three things that
were drifting apart: what the foe's body does (per BLOW), what the hand is
asked for (derived, never authored), and what the telegraph calls it.

| act | what you see | what you do |
|---|---|---|
| `toll` | a bell struck, a weight coming down | brace — hold |
| `claw` / `slash` | a rake or a stroke on a line | wipe the same way |
| `thrust` | a straight stab | one tap |
| `sigil` | a figure drawn in the air | **draw it back** |
| `rain` | many small impacts | mash |
| `feint` / `lure` | a twitch, an opening that is bait | wait / don't |

The ring names the **attack**, not the input: `CLAW →` rather than `SLIDE →`.
The chip carries the act's own mark, so a bar of claw-then-bell-then-stab is
three different chips instead of three identical ones. And a check asserts the
whole rule rather than any one case: every blow is an act, its note is derived,
and a bar of different blows cannot play one animation throughout.

### The draw replaces the trace

The trace asked the finger to **ride a rail**: the press had to land on the
ring itself ("a stab at the far end is not a grip, it is a guess"), progress
advanced only inside a 62px tube, and the ring had to be carried 93% of the way
before a release counted. Three ways to be told "no" mid-gesture, on a phone,
inside half a second. It had already been rebuilt twice — waypoints, then a
rail, then finger-follow — which is the signal that the thing being iterated on
was the wrong thing.

**A draw is a shape to make, not a path to follow.** Press anywhere, draw the
figure at any size in either direction, release on the beat. The judge asks the
stroke three questions about its gross form and none about where it happened:
is it big enough to be deliberate, does it turn the right amount (a circle
turns ~360°, a line ~0), and does it end where a shape like that ends. Measured
in isolation: a circle scores **0.94** either way round, a straight line and a
twitch both score **0**, against a threshold of 0.6.

Tapping anywhere was already true, incidentally — `claimsPress` has always
claimed a press by *time*, handing it to whichever live note it is nearest to,
never by position.

### What the rewrite carried away

Removing the trace block took `DIR_ARROW`, `SKULL_SVG` and `liveLabel` with it
— three things lodged in the middle of what was being replaced, all of which
crashed the suite one at a time. After the second one I stopped fixing them
individually and diffed the declarations against HEAD instead, which named all
of them at once. **A rewrite of a region carries away whatever was living in
it; enumerate that before the third crash, not after.**

### One check was right to fail

`FOE ANIM` deliberately restates the intent → sheet-state map rather than
reading it from the code, so it pins the design decision as well as the lookup.
It caught the crescendo entry — the Rising Dirge now opens in the *toll* shape
because its first blow is a thrust, not the *rain* shape a per-intent label gave
it. My first instinct was to make the check read the mapping from the code; that
would have deleted the only thing standing between "the foe opens in a posture
it is about to throw" and nobody noticing when it stops being true.

---

## Build 91 — the marks become keywords

The five marks were **Held · Echo · Opening · Kindled · Bright** — plain
adjectives that described a *feeling* rather than a rule. A player meeting
"Bright" mid-fight has to remember what it does; a player meeting "Pyre" can
guess. They are keywords now:

| was | is | the rule |
|---|---|---|
| Held | **RETAIN** | Keep it when the turn ends. You draw one fewer to make room. |
| Echo | **RELAY** | Whatever you play next lands as though an ally moved first. |
| Opening | **LEAD** | Lead the turn with it and its combo is already live. |
| Kindled | **TITHE** | They feel it every time it is played. The bond grows by 6. |
| Bright | **PYRE** | Half again as strong. It burns out and leaves the fight. |

Chosen from three drafted registers — liturgical (VIGIL/ANTIPHON/PRELUDE),
bond-flavoured (RELIC/ACCORD/VOW), and plain deckbuilder keyword. The third
won: these are going to grow into a tag vocabulary, and a vocabulary that
scans on first read beats one that reads beautifully and has to be learned.

### It was a rename with three traps in it

`held` had 27 hits in `game.js` and most were **not the mark** — the parry
ring's own `held` local and its `.k-pr-held` class. `opening` collided with a
*reckoning* id (`run.js:629`) and `kindled` with the campfire's "already
kindled" tree node. A blind `sed` would have broken the parry, the reckoning
table and the fire in one pass. Renamed by enumerating the id's actual
occurrences instead — string literals, object keys, and the `k-sig-` /
`k-csig-` / `k-mk-sig-` class suffixes.

One good side effect: **`kindled` now means exactly one thing.** It used to be
both a mark and a lit tree node; it is only the node now.

### And it exposed a hole in `settle()`

Two checks went red. `MARK` was a plain rename miss. `DILATION` was not: it
reported `saturate(0.10)` and `(0.15)` against a `0.05` target, twice, having
passed at Build 90.

`settle()` waited for the beat bar and the ring and called that quiet — but
**`k-slowmo` outlives both.** It comes off in `finish()` and its filter then
transitions back over 130ms, so a check that starts right after a settle can
catch the *previous* bar's drain on its way OUT and read a half-returned
filter as a half-arrived one. The drain works; it was being measured backwards.

The new ACTS check is what made it reachable — it ends nearer to a live bar
than the block that used to sit there. `settle()` now waits for anything still
wearing the parry's clothes, which closes the same hole for every check that
follows one.

---

## Build 92 — CHAIN reads backward, and two names stop hiding their rules

Three of the five keywords came back wrong on a read-through, and one of them
was not a naming problem at all.

| was | is | why |
|---|---|---|
| Relay | **CHAIN** | the effect pointed the wrong way — see below |
| Tithe | **RALLY** | a tithe is something you *pay*; this one *gains* you bond |
| Pyre | **SURGE** | had to carry "stronger" and "one use only" in one word, carried neither |

**SURGE only names the half the mark owns.** The card face already prints
EXHAUST, so `SURGE · EXHAUST` reads correctly side by side — the mark says what
it adds and the existing keyword says what it costs.

### RELAY's problem was the mechanic

RELAY set a flag for the card played **after** it. So the card wearing the mark
did nothing for itself, and the player had to carry *"the next thing I play gets
this"* across a decision. The benefit belongs on the card that carries the mark.

CHAIN opens the condition of the card it is **on**, when an ally has already
acted — the exact mirror of LEAD, in the same sentence shape:

- **LEAD** — *Play it first in the turn and its combo is already live.*
- **CHAIN** — *Play it after an ally and its combo is already live.*

### The interesting consequence: there is a wrong place to put it

CHAIN is **worthless on a FOLLOW_UP card** — an ally acting already satisfies
that natively — and valuable on a combo you cannot otherwise reach. Last Light
is Ash's FINALE: it wants all three to have acted, and one ally is not three.
Measured: bare it resolves 1 effect after an ally moves, marked it resolves 3.
On Cross Sever (FOLLOW_UP) the mark changes nothing, and a check asserts that
too — **a tag that helps every card equally is not a decision.**

### What was ruled out, and by a comment

The first draft of CHAIN was "costs 1 less when played after an ally". The
evaluator already answers that:

> *Costs never fall below 1 (deck §3), which is why no sigil touches cost:
> almost every card in the deck costs 1, so a discount sigil would be dead on
> arrival against that floor.*

Reading it first saved shipping a mark that does nothing on fifteen of sixteen
cards.

### And a note on how the rename went

Splicing the new check by searching for the next `}` ate the *following*
block's opening lines and left an orphan brace — the file no longer parsed.
Restored from git and re-spliced against the exact end of the block being
replaced. Cheap here because it failed loudly at `node -c`; the version of this
mistake that removes a line and still parses is the expensive one.

## Build 93 — the instrument for game feel

No game code changed here. What shipped is a **measurement the project did not
have**: `test/feel.playtest.cjs`, which walks one map end to end at *player
speed* and records what a turn is actually made of.

Every other harness boots `?test=1`, which caps every sleep at 24ms so two
hundred fights fit in a minute. That is exactly right for a suite and useless
for this question. A parry bar that takes 79ms under test takes **eight and a
half seconds in a hand**, and no assertion in 500-odd checks would ever have
noticed, because none of them are allowed to care how long anything takes. So
this one boots `?realtime=1` and pays the wall-clock.

Per turn it records: cards legal, cards played, combos live, screen elements to
parse, hand size, AP, decide-ms, watch-ms, and the parry vocabulary of the
enemy turn that followed.

### What one map said

Region STILLNESS, seed 7 — 23 stops, 11 walked, 5 fights, 31 turns.

```
THE SPLIT      deciding    162ms/turn    6%
               watching   2523ms/turn   94%
DECISION       playable 4.71 · played 3.55 · turns with ONE legal play  0
THE READ       23.3 things on screen per turn
PARRY LOAD     1.42 notes per enemy turn
```

A direct timing of a single enemy turn: **8752 ms**. That is the headline, and
it is the number the artifact is named for. StS spends ~85% of a turn with the
player acting; this spends 6%.

### The finding I nearly reported backwards

The same run said combos land **0.26 times per turn** and that 74% of turns
light none — which reads as a dormant system and would have sent the next build
at FOLLOW_UP.

It was the bot. It spent AP greedily in hand order, and FOLLOW_UP wants a
*different hero* to have acted. A control probe over 24 opening hands, playing
the identical hands with deliberate hero alternation:

```
greedy      0.33 combos lit per turn
deliberate  0.92
```

2.13 of 5 cards in hand carry a combo; all 3 heroes are present. **The system
works; the instrument was playing badly.** Third time this session a
measurement was about to be filed as a game fault when it was a harness fault
— after the "reload wipes the bench" bug that was my own `?test=1` boot, and
the DILATION drain read on a previous bar's way out. The counter-discipline is
the same each time: before believing a number, prove the instrument was
looking.

### One real defect it did find

The note curve is **inverted at the top**. Grief-Wraith (84hp) averages 5.0
notes per bar and never opens under 4; the Mourning Regent (98hp) averages 4.8
and can open on 2. The boss is the easier bar.

### `feel.txt` is output, not source

The run dumps its per-turn JSON next to itself. That is a report, and it is in
`.gitignore` — committing it would make every run a diff.
