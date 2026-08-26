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
