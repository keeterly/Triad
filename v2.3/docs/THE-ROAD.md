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

## Build 94 — the enemy turn stops charging for things you cannot play, and AP learns three clocks

Three moves the Build 93 playtest prescribed, plus the question they raise: if
Slay the Spire modulates energy with relics and cards, and FF7 Rebirth builds
its action economy out of what the party does together, what is **our** version?

### First, a better instrument — `test/turnbudget.cjs`

Build 93 measured the symptom (94% of a turn is watching; one enemy turn timed
at 8752ms) and could not say WHICH 8752ms. "The bar is too long" is a guess
until something says how much of it is notes and how much is air. This samples
the live phase at 16ms through a real enemy turn and buckets the wall-clock.

**And it corrected my own arithmetic.** The first version double-counted: it
called everything after the first ring "air", which silently included the tail.
Reading the rows straight — crescendo, 10.29s total = 1.30 runway + 6.00 rings
+ 3.01 tail — leaves **zero** dead air *between* rings. The rings' runways are
long enough that no frame of a bar is ever empty. The waste is all at the ends,
which is a completely different fix from the one "89% air" implied.

```
                       BEFORE     AFTER
  mean bar              7.95s     6.04s      -24%
  runway before note 1  1.39s     0.47s
  a ring on screen      3.69s     3.24s      (rings overlap more; the notes are unchanged)
  gaps between rings    ~0        0.03s      there were never any
  tail after the last   2.77s     2.32s
  nothing to play        54%       47%
```

### Move 1 — where the 2.2s came from

- **The hand sweep is no longer awaited.** Nothing in the enemy phase reads the
  hand, so it plays under the foe drawing breath. −0.78s.
- **The draw stagger, 230ms → 130ms.** The flight is 420ms and overlaps freely;
  this is only the gap between one card leaving the pile and the next.
- **One rule for the gap between hits.** The scheduler closed each hit with a
  flat `+1` and opened the next with a flat `+1`; the two stacked into a full
  second between every pair of hits regardless of what had just been asked. Now
  the gap after a hit is the same `MIN_GAP_AFTER` floor that governs two notes
  *inside* a hit, never less than one beat.
- **The runway is the opening note's, not a constant.** `BEAT_LEADIN` drops 2 →
  1.5 and `gridStart` takes the larger of it and the first note's own lead — so
  a bar opening on a DRAW gets its full 2.3 beats, which under the old constant
  it never did.
- **A blow turned aside gets a shorter beat than one that landed** (170ms vs
  330ms). It has already said everything it is going to say. Which means the
  whole enemy turn is shorter the better the bar is answered — the right way
  round, in a game where skill is supposed to buy tempo.

### …and the length now means something, as a property of who you are fighting

The per-bar spread barely moved (1.83× → 1.68×) because cutting fixed overhead
helps the heavy intents most. What moved is the **ladder**:

```
                notes      bar
  husk          2 – 3      4.20 – 4.76s
  cultist       2 – 5      4.19 – 7.05s
  wraith        5 – 6      6.26 – 7.06s
  revenant      5 – 6      5.75 – 6.61s
  mourner       5 – 7      5.75 – 7.11s
```

Before, the Grief-Wraith (84 HP, a third fight) had a floor of **4** notes and
the Mourning Regent (98 HP, the boss) could open on **2** — the first thing a
player meets and the last could ask the same amount. The floor is the statistic
that matters: a mean is something nobody experiences. Two new intents make the
bottom and top rungs real — `lash` for the Husk, `keening` for the Choir, and
`dirgesong`, the Regent's own heal, written at the weight of the thing singing
it. A check asserts both floor and ceiling non-decreasing.

**The bar-length ranges still overlap, and the note counts are the honest
claim.** The Ashen Rain is five notes and is dealt to the Choir, the Wraith and
the Regent alike, so a fodder foe can occasionally throw a seven-second bar. The
ladder lives in what a foe can open on, not in a range that never touches
another's.

**The Wraith and the Revenant share a rung, and that is honest rather than
unfinished.** What separates an elite from a third fight here is not how many
notes it throws but how fast: the Revenant has two phases, and phase 2 shortens
the beat under everything it plays.

### Move 2 — more cards carry a combo, and the suite decided how many

Measured with a new probe, `test/handshape.cjs`, over 60 opening hands:

```
                              BEFORE   AFTER
  cards in the pool with a clause   6/15    8/15
  clauses to read per hand         1.88    2.48
  combos lit, greedy in hand order 0.27    0.50
  combos lit, playing deliberately 0.87    1.88
  the reward for playing well      x3.25   x3.77
```

Deliberate play lights **more than twice** the combos it used to.

The path there was not the one I planned, and the suite chose it twice.

**Four cards became three.** The first pass gave Twin Fang a clause too, and
`solo()` — a helper picking cards with nothing to read — crashed the whole
suite, because Mira had exactly one such card left. That is the deck telling
you a hero has run out of plain cards.

**And a fifth keyword became none.** `SAME_HERO` — "this hero has already acted,
hit again with them" — is the one condition in the vocabulary that cannot be
true at the same time as FOLLOW_UP or FINALE, so a hand holding both would have
a genuine fork in it. The `LOAD` check said no: this deck is budgeted at four
distinct keywords, and that budget is not a guess — Build 25 measured nine
conditional cards out of fifteen and walked it back to six because every turn
had become a reading exercise.

Both findings are real and they are about **different costs**. A new keyword is
vocabulary: paid once by every player, forever. A second card wearing a keyword
the deck already teaches costs a glance. So the two cards added here both wear
FOLLOW_UP, the keyword count is untouched at four, and the budget moved 6 → 8
with that reasoning written into the check. SAME_HERO is designed and recorded
in `evalCondition`, to be taken up on its own, against its own measurement of
what it costs to read.

### The AP ladder — one resource, three clocks

The question was: what is our version of a relic that gives +1 energy? The
answer this game already had the shape for is that AP should move on the three
timescales everything else moves on, each paid for by a different thing the
party is good at.

- **THE TURN — the combo pays its own AP back.** A third `cond.reward`,
  `'ap'`, beside `'cost'` and `'output'`. It exists because of the cost floor:
  costs never fall below 1, so for most of the deck a discount is unreachable
  and the only payoff available was a bigger number. Bigger numbers do not
  change what a turn IS. **Lumen Cascade** is the point of it — a FINALE costs
  the whole turn, so the finisher was always the last thing that could happen;
  one refund in the *middle* of the line pays for a fourth card. **Quick
  Throw** is the other: the card that finds the combo no longer competes with
  the combo.

- **THE FIGHT — the all-out finds them another gear.** +1 `apMax` for the rest
  of the fight, capped. This is the one the premise was missing. The all-out
  was a firework: the bar filled, three of them hit at once, the bar emptied,
  and the party was in exactly the state it had been in a second earlier — for
  a game about team attacks that DEVELOP. It is earned by skill (kizuna charges
  from turned strings, so a clean bar buys a bigger turn — before this, a
  perfect parry bought only survival), and it **compounds**: more AP is more
  cards is more damage is more kizuna, so the second all-out arrives sooner
  than the first.

- **THE ROAD — RESOLVE.** A campfire node, +1 base AP for the rest of the run.
  Nine of the tree's ten nodes were one hero's card traded for a bigger version
  of that card — a number going up in three places rather than a decision. This
  is the one node that changes how a turn is played, and it costs five embers
  at tier 2, which is what the *deepest* card node costs two tiers later.

**The ceiling is the ceiling, however you reach it.** A party carrying RESOLVE
opens at 4, so their first all-out takes them to 5 and their second gears them
not at all. Two routes to the same place rather than two things that stack into
a turn nobody balanced.

### Move 3 — the budget stops being the smallest thing on the board

The AP row was 41×9px — 369 square pixels, 0.09% of the board — in the last row
of pixels on the stage, which on a phone is the home-indicator strip.

A padded pill was tried first: 77×21, four times the area. A probe put its top
edge at y=400 against the centre card's bottom at y=411, and **the fan arcs up
in the middle**, so the tallest card in the hand is the one directly above these
marks. There is no arrangement where a bigger row both clears that card and
stays off the screen edge — the old 9px marks were sized precisely to the 13px
of floor left under the fan, which is *why* the most important number on the
board was the smallest thing on it.

So the fan gave up seven pixels it was not using, the backdrop became a soft
shadow that occupies no layout at all, and the marks went to 12px: **648px²,
1.75×**, clear of all five cards, off the edge. (And the lane words rose seven
pixels with it — FRONT went straight back behind the cards otherwise, which is
the exact defect their offset was written to fix.)

**But the size was never the real fix.** The question a hand asks is not "how
much do I have" — the marks already said that — but *"if I play THIS, what is
left for the rest of the turn"*, and that was arithmetic done in the player's
head on every card. The marks a held card would consume now light as ABOUT TO
GO the moment it is picked up, and the ones that would survive stay as they
are. The answer is read rather than computed.

### One real bug, found by a fixed seed

Not awaiting the sweep turned an animation into something that can **outlive its
own combat**: `fxSweepHand` reads the global `C`, so a sweep still in flight
when the next `startCombat` lands was splicing the NEXT fight's hand into the
next fight's discard. The determinism check caught it inside one build — two
runs of the same seed diverged on the fourth intent. A fight has an `id` now and
the sweep checks it is still in the fight it started in. Unfindable by hand;
trivial with a fixed seed.

### Four checks were stale rather than wrong, and one was silently lying

Re-dealing the bestiary broke checks that had **restated** a rule instead of
asking for it:

- The FOE ANIM check carried a hand-written table of intents to poses — a copy
  of what `fxFoeAct` does. It derives the mapping from `ACTS` now, so a new
  intent is covered the day it is authored.
- The SWEEP check sampled while `phase === 'HAND_DISCARDING'`, a phase that now
  lasts one frame. It watches the ghosts, which is the invariant it was really
  asserting.
- The BOTTOM BAR check compared the AP row against the hand CONTAINER's box
  rather than the cards in it, so any row taller than a hairline failed a test
  it was not actually failing.
- **`forceIntent` was the silent one.** Every caller ignores its return value,
  so fourteen checks went on asking the Mourning Regent for a Benediction she no
  longer knows and quietly graded whatever intent happened to be current — six
  failed with baffling messages about the wrong note kind, and the rest passed
  while testing something else. It logs a console error now, which the harness
  counts as a suite failure, so a stale name is loud at the line that used it.

### And one design decision reversed by measurement

Taking `rain` off the Regent to protect her floor took the only BURST in the
bestiary out of the last fight in the game — four checks went red naming a
vocabulary they could no longer find. A boss that cannot throw a flurry is a
worse boss than a boss with a slightly soft floor. The downpour got the fifth
note it was always short of instead, and went back in her hand.

### The balance measurement inverted the argument

The AP ladder is the largest power change this deck has taken, so it went to
the sim before it went anywhere else — and the sim said the opposite of what
built it. Four arms of the ~half-parry band, 100 runs each, 168 HP:

```
  Build 93 (neither)     59.0%   median win in 8 rounds
  refunds only           75.0%   median win in 8 rounds
  gear only              60.0%   median win in 8 rounds
  Build 94 (both)        76.0%   median win in 8 rounds
```

**The all-out's gear — the rung this build argues hardest for — is worth one
point of winrate. The two quiet combo refunds are worth sixteen.**

The reason is legible in hindsight: a bot rarely fills the KIZUNA bar twice, so
the gear arrives late in an eight-round fight and buys two or three extra cards
total. A refund fires on almost every turn from turn one. I had been about to
cap `AP_CEILING` to blunt the gear, which would have cost the build its best
idea and fixed nothing.

The first response was a cap: **one refund a turn**. It is a good rule — two
refund cards in one hand was two free cards, so the ceiling on a good turn was
five cards rather than four, and "the first one comes back" is a sentence where
"sometimes you get two" is a spreadsheet.

**It changed the winrate by nothing at all.** Re-measured, all four arms came
back identical to the decimal, which looked like the cap not being live until a
probe confirmed it was — and then said why: only **9.3%** of opening hands hold
both refund cards. The sixteen points come from a refund firing on nearly every
turn with ONE card, not from stacking two. The cap is a design bound. It was
never the balance lever, and keeping it in as though it were would have been
the tidier and less true story.

So the lever had to be the world. Swept at the ~half-parry band, 90 runs a
point:

```
  dmgScale   1.00  77.8%   ·  1.08  68.9%  ·  1.16  58.9%  ·  1.24  53.3%
  median winning fight: 8 rounds at every point on that sweep
```

`dmgScale` is 1.16 now. That is exactly where Build 93 measured on the same bot
and seeds — **this build is balance-neutral**. `bossHp` would have bought the
same winrate by making fights longer, and the deck's target is 7–9 rounds; this
knob costs nothing in length.

1.24 was right there, lands inside the shipped 25–55% gate, and was deliberately
not taken. **The band has been adrift since before the AP ladder existed** —
Build 93 measures 59% against a 55% ceiling — and closing that wants a full
three-band sweep, not a number picked off a one-band probe. A build absorbs its
own delta and no more.

Confirmed on the full sim afterwards: ~half 62.5%, and NO PARRY (0%), EXCELLENT
(100%) and MONOTONE unmoved from before the AP ladder.

`alloutAp` moved into `TUNE` while this was being measured, because a number
that can move a gate that far has to be drivable from the sim that watches it.

## Build 95 — a card you can see arrive, a fire that asks one question, and a room to ask it in

### The mid-turn draw was invisible, and it was measured that way

Quick Throw draws one and then asks for a discard. Sampled at 16ms through a
real play:

```
                                    BEFORE   AFTER
  the drawn card wears an arrival      0ms    305ms
  the prompt and the pulse appear     76ms    791ms
  cards pulsing / marked as new       5 / 0    5 / 1
```

**Zero.** `drawOne()` pushed the card into the hand and the next render painted
it there — the 416ms of flight on screen belonged to the card being *played*, on
its way out. And because Quick Throw plays one and draws one, the hand never
changed size either: there was no signal of any kind that a draw had happened.
Then the prompt and the red pick-pulse arrived at 76ms — while the played card
was still 340ms from landing — and all five cards pulsed identically, so the one
you had just drawn was indistinguishable from the four you already held. The
question arrived on top of its own setup.

Now every mid-turn draw flies in off the deck pile on the same 420ms arc as a
card at the top of a turn (`fxDrawInto`, shared by Quick Throw, Counterstance's
draw, A Quiet Word's, and the free cycle — **all** of which measured 0ms). It
lands wearing a gold rim that says which one is new. And the two halves are
separated: `pendingDiscard` is the effect resolving, `discardArmed` is the
question being asked, and only the second one lights the prompt.

**One real fragility fell out of it.** Arming the question called `renderHand()`,
which rebuilds every card — and the card that had just landed was still wearing
the 300ms pop at the end of its flight. The question destroyed the arrival it
was asking about. Arming touches only the two things the question *is* now.

### The fire asks one question

Sitting down put all eleven nodes on screen at once: four columns, each arguing
its own case. Slay the Spire's fire asks one question with two answers and puts
everything else behind whichever you pick.

The mend cannot be one of the answers here — the road's attrition is tuned on
the assumption that a fire mends, so making it optional would be a difficulty
change wearing a UI change. What *is* a choice is whose memory to spend on. So:
**four doors** — three people and the fire itself — and the memories live inside
them, at full size, with the before/after strip that used to have to serve
eleven plates at once.

A door says what is behind it *before* it is opened ("2 within reach", "sealed —
a memory opens these"), so nobody spends a tap to learn a branch is shut. BACK
closes the door; at the doors, BACK leaves the fire — one control, and it always
closes the thing you are looking at.

### …in a room painted for it

The fire screen used `bg-descent`, the generic plate the whole game falls back
to. `art/bg-camp.webp` is a ruined hall rendered for this screen (Higgsfield
`soul_location`, same house style and export recipe as the memory frames), with
its painted fire on the same centre line as the CSS glow plates and its middle
band left quiet for the doors.

**Dropping it in was a lighting change, not a file swap.** The glow plates were
tuned against a backdrop at mean luma 5; the new plate arrives at 15 with its
own fire painted in, and the same plates washed the lower half of the screen
orange and hid the picture. Halved, and the veil pulled back, so what they do
now is make the painted fire breathe.

### The soak had been buying nothing, and passing

This is the one worth keeping. The soak spends randomly at every fire — it
queried `.k-tnode` on the camp screen, and after the restructure there are none
there. It found nothing, bought nothing, and reported clean, because **"there is
nothing to buy" and "there is nothing affordable" produce the same zero.** Every
campfire in every soak run was a no-op.

It walks through a door now, and a run-level check refuses a walk that kindles
nothing at all. The effect on the numbers is its own evidence: 35 memories
kindled across ten runs, and 10/10 reaching the Regent instead of 7/10 — the
previous runs had been walking the road with an un-upgraded deck.

Third harness-fault-mistaken-for-a-game-fault in three builds, and the same
shape every time: a probe that stopped looking and reported the silence as a
result. The counter is the same too — make the instrument assert that it saw
something, not just that it found nothing wrong.

## Build 96 — a sharpened card is a different card, the painting keeps its shape, and the page can tell it is stale

Three things from a play session, and one of them was "your work didn't ship".

### The page that cache-busts everything else could not bust itself

Build 95 was on main, the campfire restructure was in it, and the screen still
showed Build 94's four columns. Nothing was wrong with the build.

Every script and stylesheet in `v2.3/index.html` carries `?v=<build>` — which is
exactly why a stale copy of *that file* is invisible: it happily loads
`run.js?v=94` forever and the game looks like the build it was cached at. The
root v1 page has polled for this since it shipped. v2.3 never got one, so it had
no way to notice.

Same poll now, reading this version's own key: `game.js` exports `BUILD`, the
page fetches the manifest with `no-store` (which routes around the HTML cache),
and if the server is ahead it puts a tap-to-reload chip on screen.

### The paintings were being cut, and it was the reading view that lost most

Measured, per surface, as a share of the source:

```
                        frame    source   cut
  hand card             0.68     0.75     10% off the sides
  inspect (press-hold)  0.63     0.75     16% off the sides
```

The paintings are 420×560 and the card faces have drifted narrower, so
`object-fit: cover` at `height: 100%` was cutting eight per cent off each edge.
On Quick Throw that is the raised dagger in the top right and the trailing cloak
on the left — the two things the picture is composed around, gone from the one
view you open specifically to look at it.

`width: 100%; height: auto`, anchored to the top: the painting keeps its ratio
and nothing is cut on either axis. It is what `.k-tn-bg` has always done for the
campfire plates, which is why those never showed it.

**Both times I measured this, the fan lied to me.** `getBoundingClientRect`
returns the axis-aligned box *around* a rotated element, and every card in the
hand carries a rotate and a 3D lean — so a 0.75 painting reads as 0.85 and looks
like it is cropping something it is not. The check uses `offsetWidth`.

### A sharpened card is a different card, not a bigger one

All nine upgrades were the same card with a bigger number — Cleave 7→10, Mend 6→9,
Twin Fang 4×2→6×2. That is the least interesting thing a deckbuilder can do with
progression, and it made the campfire's most expensive nodes the least
interesting choice on it.

Each one changes the card's **role** now:

```
  Cleave+          7 damage, 3 POISE          the plain hit becomes the stagger
  Cross Sever+     after an ally: FREE        its 2 AP comes back, not down to 1
  Last Light+      finale also guards all     the closing blow covers the retreat
  Mend+            heal 6, DRAW 1             Elin becomes the engine
  Shared Grace+    …and Chill 4               one card answers both halves of a turn
  Lumen Cascade+   …and Draw 1                the line it pays for also refills
  Twin Fang+       BROKEN: +6                 Ash's stagger gets its payoff
  Backstab+        bonus is Bleed, not damage pays again a turn later
  Execute+         4 cold / 19 live           a card you hold, not one you play
```

Cleave+ and Twin Fang+ are the point of the exercise: neither is stronger on its
own, and together they are a loop the starting deck could not build.

Measured over 60 opening hands, starting deck vs fully sharpened:

```
  cards that carry a clause   8/15  →  9/15
  clauses to read per hand    2.48  →  2.87
  combos lit, deliberate      1.88  →  2.03
  playing well is worth       x3.77 →  x4.21
```

**And the honest half of that.** Tools across the whole deck: **15 → 15**. An
upgrade cannot invent an effect, so "expands the toolkit" was never going to show
up as a bigger vocabulary. What moves is *who* can reach a tool and at what
price — Ash gains `guardAll` and gets Poise at 1 AP instead of 2, Elin gains
`draw` — and **Mira gains no new tool at all**: her three are role changes only.
That is a real result and it is smaller than the pitch.

Two checks hold the line: every sharpened card must change its atoms, its
condition, or its kind of reward — *or* give something up (Execute+ is the one
whose change is purely numeric, and it is worse cold, which is the trade). And a
fully sharpened deck must still teach **four** keywords and no more. That second
one closed a real gap: `LOAD` measures the cards a run STARTS with, so for eleven
builds the sharpened faces were outside the reading-load budget entirely.

### Three checks were restating tables instead of reading them

The same failure shape as last build, three more times. `DEALT` asserted
`up.dmg === 10` — a test of two constants. `nodeFace` built the campfire's
before/after from `.base` alone, so Twin Fang+ (identical base, new clause) would
have shown "4 damage ×2 → 4 damage ×2" and asked five embers for it. And the
painting check asserted the image box *equals* the plate box, which is the bug
rather than the contract.

## Build 97 — cards that do a thing instead of a number, and three cards that were lying

The ask: cards that do not deal damage or heal at all, and payoffs that watch
what has just been *done* rather than what has just been *played*.

### The deck had no way to build that, and the reason is worth naming

Every condition in the deck asked about the HAND — who played last, whether all
three have acted, what row somebody is standing in. None asked what had been
DONE to a hero. So a card could not be built to notice a thing another card had
just set up, and every "combo" was really an ordering puzzle.

Two facts are tracked per turn now, both per-hero, both resetting with the turn
so a setup and its payoff have to happen in one breath:

```
  movedBy   heroes standing somewhere they were not
  wardedBy  heroes who have gained Guard, from any source
```

and two conditions read them: **JUST MOVED** and **BEHIND A GUARD**.

### Two pairs where neither card is worth much alone

Ten of the twelve bond cards were damage plus a little of something — a sidegrade
in cost and a same-grade in shape. These four are the first in the deck where
the interesting play is the *pair*:

```
  Shieldsong      6 Guard to all. No damage at all.        the setup
  Last Vigil      6 damage. BEHIND A GUARD: AP comes back.  → free after it

  Cut the Cord    Bleed 5. Step back. A free step for anyone.  the setup
  Twin Shadow     5 damage. JUST MOVED: +8.                     → 13 after it
```

Measured, played both ways round: Shieldsong wards all three for zero damage and
Last Vigil then costs **0 AP**; Cut the Cord steps Mira back and banks a step,
and Twin Shadow goes **5 → 13**, with the banked step costing **0 AP**.

**A displaced hero counts as having moved.** A step that trades places moves two
people, and a payoff asking "are you standing somewhere new" has to be true for
the one who was pushed. Measured: Cut the Cord marks Mira *and* Elin.

### `freeMove` — the rows finally cost something a plan can pay

Three rows have been a lever nobody pulls, and the reason is arithmetic: a step
costs 1 AP of 3 and the card you would rather have played, and it is capped at
one a turn. `freeMove` banks a step that costs neither. It is the first atom in
the deck that changes what the *board* can do rather than what a number is.

### Two new keywords, and the argument for spending them

Build 94 designed a fifth keyword and **cut it**, because the `LOAD` check
budgets this deck at four and Build 25 measured nine conditional cards as too
much to read. Build 97 spends two. The case is entirely about where they live:

- The starting fifteen still teach **four**. A new player is taught exactly what
  they were taught before.
- JUST MOVED and BEHIND A GUARD arrive only on **bond cards** — earned one at a
  time, each inside a scene that has stopped the game to explain it, and each
  arriving next to the card that sets it up.

That is the difference between a fifth keyword in the opening hand and a fifth
keyword on a card you chose. The two ceilings are asserted separately so the
distinction cannot rot: the starting deck may never drift past four.

### Three cards were lying about themselves

Chasing the feature turned up a family of shipped bugs — an atom that needs a
PERSON, with no person handed to it:

- **Cut the Cord**'s "step out of reach" moved nobody. `moveSelf` resolved
  against `card.owner`, which for a bond card is the string `'ash|mira'`, and
  `C.heroes['ash|mira']` is undefined.
- **Last Vigil**'s "from behind a raised shield" gave **zero Guard**, same cause.
- **Shield the Blade**'s "5 Guard · ally" guarded **nobody**: an ally was only
  resolved for cards whose *target* is an ally, and it targets the enemy.

The oldest rule in this deck is that a card may not lie about itself, and three
were. Fixed at the family rather than the instance: a card carries a `selfHero`
(so Cut the Cord can say the step is Mira's, not the primary owner's), and an
ally is resolved whenever a card *needs* one, whatever it is aimed at. `BACK_ROW`
was reading the owner string too — it works today only because the one card
carrying it is solo.

### And one thing this build did NOT fix

The soak found a soft-lock once in roughly thirty runs — the map on screen with
nothing clickable, after an elite's reckoning. It did not reproduce across the
next twenty, and the walk picks its forks with `Math.random()`, so the run that
found it cannot be replayed. **I do not know whether it is Build 97's.**

What changed is that the next occurrence carries its own post-mortem: the failure
now dumps the run's `pending`, `over`, `reachable`, which screens are shown, how
many map nodes are in the DOM and what phase combat thinks it is in. It also
looks a second time before failing — a screen one frame from being painted and a
screen that will never be painted are the same DOM, and the second look separates
them (a slow paint is noted in the trail rather than silently absorbed). If the
original hit was a paint race, that is now labelled; if it is a real lock, it is
now diagnosable. Neither is a fix and it is not being recorded as one.

---

## Build 98 — the road remembers

**The gap.** The game had exactly one developing half — the bond scenes — and
exactly one thing that could open one: two heroes fighting well together often
enough to cross a threshold. So a party could travel to the bottom of the
Cinders, put down a thing it had never met, watch somebody nearly go, and
answer a crossroads at a real cost, and develop **nothing**. Everything that
happened *on* the road was scenery with a fight in it.

A recall is that beat in a different key. The road sets it off, **one** person
remembers, and the fork is a card the same way a bond's fork is a card.

### The journey ledger

Four facts, written by four transitions, and the memories read nothing else:

| field | written by | what it is |
| --- | --- | --- |
| `deepest` | `enterStop` | how far into the region they have walked — a high water, not a position |
| `felled` | `onFightEnd` | what they have put down, once each |
| `brink` | `onFightEnd` | who dropped to a quarter or less, ever |
| `chose` | `takeEvent` | which crossroads, answered which way (`toll:PAY THE BOWL`) |
| `flawless` | `onFightEnd` | fights nobody was touched in |

`when` is a pure function of that ledger, which is what lets a check drive every
memory without walking a road — and what lets the checks assert *both* ways:
an empty record sets off nothing, a record that did everything sets off all of
them, and knocking each field back to empty must turn at least one memory off.
A `when` that returned a constant would pass every other check in the file.

### The four

| memory | who | what sets it off | the fork |
| --- | --- | --- | --- |
| HOW FAR IN | Ash | four columns deep | plant himself (Last Vigil) / stop counting (Gravebloom) |
| SHE KNEW THAT ONE | Mira | a wraith felled | come apart on purpose (Cut the Cord) / not be where it lands (Cold Mercy) |
| THE COUNT | Elin | anyone on the brink | keep everyone standing (Shieldsong) / find the worst one (A Quiet Word) |
| WHAT IT COST | Ash | a crossroads answered | pay up front (Ashen Oath) / cover the one who did not choose (Shield the Blade) |

Every card a memory offers is owned by a pair the rememberer is **in** —
otherwise Ash remembers something and the other two quietly get better at it.

### A second door into a room that was already built

Everything past the fork is the bond machinery: the scene, the card faces, the
swap that makes room, the profile that outlives the run. What is genuinely new
is 90 lines. The two real differences are asserted rather than assumed:

- **A bond pays twice, a recall pays once.** A bond level hands over a card
  *and* a mark. A recall hands over a card. The slice's walk answers whichever
  it meets and checks that each paid exactly its own price.
- **A recall with empty hands does not fire.** A bond scene still plays when the
  party already carries both its cards, because the level is the payout and the
  scene is the story beat. A recall's only payout is the card, so it holds its
  tongue and stays available in case a later swap frees one.

A bond still goes first when both are waiting: a bond is a threshold the player
watched fill and is waiting on, a recall is the road paying out on its own.

### The bug the campfire suite found

The depth was written in `travel()`, on departure. So arriving at the column
that crossed a memory's threshold recorded it and then tested the ledger against
it **in the same breath** — the memory opened *instead* of the stop, and the
fight the player had just chosen never started. The camp suite caught it as
"the next fight opens with the deck the fire built", failing with a card face
from the fight before.

The write moved into `enterStop`, which is the one funnel every stop passes
through, chain or no chain. Now there is a single seam: **a stop writes what it
did as its business begins, and whatever that unlocks arrives at the next
arrival** — exactly where a bond level already lands. That ordering is now a
check of its own, derived from the table: it finds whichever memory a depth can
set off, walks to the column that sets it off, and asserts the stop still
happens.

### What it looks like on a road

A seed-11 walk, start to Regent: bonds at stops 2, 5, 6 and 7; recalls at 3 and
8. **Nine of eleven stops now carry a developing beat**, against four before.
The other two memories did not fire — no wraith was met and nobody hit the
brink — which is the point of a conditional trigger rather than a schedule.

### A migration that was written and never called

`withJourney` existed from the first commit of this build — every trigger reads
straight into `RUN.journey`, so a Build-97 save with no ledger would have thrown
on the first fight it finished. It was defined and then **never wired to
`load()`**. A check that stores a legacy run and boots it found it in one line.

`load()` is the single door onto a stored run, which is the only reason a
one-line migration is enough — and the reason the miss was invisible until
something asked.

### Where it stands

| suite | |
| --- | --- |
| flow | 250/250 |
| road | 94/94 (+8) |
| bond | 62/62 (+15) |
| slice | 59/59 (+4) |
| camp | 45/45 |
| music | 22/22 · beat 10/10 |
| soak | **10 runs, 5/5, 0 page errors** — 7 reached the Regent, 42 bond scenes, **24 recalls**, 21 memories kindled |

The soak's new gate is the one that matters: *a walk with no recall is a broken
walk*. Every trigger is a fact a walk to the Regent produces on its own, so a
full soak that never opened a memory is not bad luck — it is a feature that has
quietly stopped firing, and that is exactly the failure this project keeps
finding a build too late.

The intermittent soft-lock from Build 97 did not appear in these ten runs. That
is not evidence it is fixed; it was one in roughly thirty before.

---

## Build 99 — the line

Every fight in this game had been three people against **one** thing, and the
state said so: a single `C.boss`, one health bar, one Poise gauge, one intent.
Fifty-six places read it.

### The rule that made it legible

The obvious way to give a party three opponents is to let each take a turn, and
it is the way that kills this game in particular: the enemy phase here is a
**rhythm bar**, held on one camera move. Three of them back to back is a rhythm
game with a card game attached — ten seconds of enemy turn becomes thirty, and
the player decides nothing in any of it.

So the enemy phase stays **one bar**, and the line composes it together. Two
rules govern what goes in it:

1. **One voice per position.** There are three places on this board and one hero
   in each, so a bar holds at most three strings and **no hero is ever asked to
   answer two creatures at once**. A small thing swings at a PLACE and takes
   whichever free place is nearest the one it wants; a thing that finds nothing
   free **holds**, and is drawn winding up.
2. **Never more than the Regent throws.** Measured across the bestiary, the
   heaviest bar in the game is her Crescendo at seven notes. No ordinary fight
   may out-throw the final boss, so seven is a backstop under rule 1.

And because the phrase is the sum of what is still alive, **it shortens the
moment something dies**. That is the whole reason to want more than one
opponent: killing the small one is not an abstract step toward winning, it is
the next bar being visibly easier to play. A measured three-Husk fight goes
**3 voices → 2 → 1** across three turns, and the party takes 27, then 22, then
13.

### A small thing aims at a place; a boss reaches for a person

| | small (`fight` tier) | elite / boss |
| --- | --- | --- |
| aims at | a **row** — front, mid, back | a **person** |
| positions per action | exactly one | as many as the intent names |
| may swing several times | yes, all on the same hero | yes |
| rationed by the place rule | yes | no — reach is what a boss *is* |

Rows are exclusive here, so a place identifies exactly one hero — and **which**
hero is the player's answer rather than the table's. Three creatures pointing at
three rows is a fight you re-shape by standing somewhere else.

Six of the fodder intents were rewritten and four are new. The Grief-Wraith had
been sharing `scythe`, `rain` and `flurry` with the elite and the Regent, so the
third fight of a run and the last one threw identical bars; it has its own three
now (`reap`, `wail`, `clutch`), each a different shape on a different row.

### A pack is one encounter, not three fights

Three Husks at full strength is 186 health and three voices a turn — the first
probe wiped a party that had killed one and a half of them. A line divides one
foe's worth of health and Poise between its bodies, with a floor of 4 Poise so
every one of them stays breakable. Three Husks: **21 health each, 63 total**,
against a lone Husk's 62.

### What made the refactor survivable

`C.foes` is the truth and `C.boss` is a **view** onto it — the foe you are aimed
at — so `C.boss.hp -= n` still means exactly what it meant, it just means it
about whichever one you are hitting. `C.foe` and `C.intents` are the same. That
is why 56 call sites did not have to be rewritten, and why a fight against one
thing is still bit-for-bit what it was: **a single foe is a line of one**, and
nothing below the model has a special case for it.

The views are deliberately *enumerable*: a hidden getter would vanish from
`JSON.parse(JSON.stringify(state()))`, which is how a dozen checks and the bot
read a fight, and they would have seen `boss: undefined` and reported the engine
broken.

### Three things the checks found

- **A boss strikes the same hero twice.** The first cut applied the place rule to
  every hit in the game, so the Ruinous Hymn's second blow on Ash found the front
  already claimed and the Regent stood there winding up forever. Twelve flow
  checks went down at once. The rule is about *aiming*, not about how many blows
  land: a hit that names a person goes through untouched.
- **A heal is not instead of swinging.** The Mourning Dirge and the Hollow
  Benediction both mend AND strike — that is the whole tension of them. Skipping
  their hits took down every check that needed a drawn figure or a bait, because
  those notes live only on the two healing intents.
- **A sweep aimed at a place cannot be stepped away from.** Distance is what a
  sweep IS — the same swing lands for a third at the rear — and that only means
  something when the blow follows a person. Stepping out of the front row does
  not dodge the Reaping, it hands it to whoever trades in, so a mark promising
  "one row back and it lands for 9" was a promise nobody could collect. Distance
  stays the boss's axis; the small things trade places instead.

### Where it stands

flow 250/250 · **line 21/21 (new)** · beat 10/10. The line suite asserts the
rule rather than restating the table: every attack a `fight`-tier foe can throw
names one place, an elite or boss still crosses the party, no hero answers two
creatures in one bar, the composed bar never out-throws the hardest single bar
in the game, a pack shares one encounter's health, and the bar gets shorter as
the line does.

---

## Build 100 — one node, one event

Three complaints, and they turned out to be the same complaint three times: the
road was cramming several decisions onto one stop, and none of them had room to
explain itself.

### The trade was a toll

A card won at a fork had exactly one way into the run: push one of somebody's
five out. But a displaced card has gone to the **bench** since Build 69 and the
deck screen can bring it back — the mechanic to say *"I'll take it, just not
yet"* has existed for thirty builds and this screen never learned about it. So
a player who liked their five was made to break it to accept a card they might
not want for another three stops. That is not a decision, it is a toll.

The screen has two doors now. **TRADE** is the loud one and still asks who steps
out; **SET IT DOWN FOR NOW** is beside it and is always available, because
benching a card is never wrong and taking a slot from somebody is the choice
worth pausing over. The card is won either way — it goes into the profile and
onto the bench the moment the fork is answered.

The header stopped demanding, too: *"FIVE SLOTS EACH — WHO STEPS OUT?"* was the
only question the screen could ask while the trade was the only way out of it.

### SURGE never said what it was

The marking screen opened on a mark's **name** and a sentence about what that
mark does — which tells a player the rule and nothing at all about what is
happening to them. Is this a card? A buff for this fight? Something they can
undo? Three fixes:

- **An eyebrow above the name**, the same on every mark because it is true of
  every mark: *A MARK — IT STAYS ON THAT CARD FOR THE REST OF THE RUN.*
- **Every card says what it becomes.** Ten faces already wearing the mark and
  none showing the old number is a question with nothing to compare, so the
  choice was a shrug. The campfire has printed before → after on everything it
  sells since Build 95; this is the same decision and gets the same sentence.
- **`already RETAIN` became `already carries RETAIN`** — a label that read as a
  bug.

The first cut of the before/after over-corrected and printed the mark's rule
under all ten cards, which puts the header's own sentence on screen ten times.
A line is only worth its space when it distinguishes **this** card from the one
beside it:

| mark | what each card says |
| --- | --- |
| SURGE | `7 damage. → 11 damage.` — real, and different on every card |
| CHAIN / LEAD | `its combo is already live` — or **`no combo — nothing to arm`** |
| RETAIN / RALLY | nothing; they do the same thing to all ten, and the eyebrow said it once |

Chain and Lead arm a **combo**, and five of a pair's ten cards have no combo at
all — so those marks do *nothing* on half the cards they were being offered
against, and the screen had never mentioned it. That is now the loudest thing on
it.

All of it reads through `effectsWithSigil`, one door that the screen offering a
mark and the evaluator resolving one both go through, so the promise cannot
drift from the outcome.

### And three screens on one node

The scene, the fork, the swap and the marking screen all arrived **back to
back** — four screens deep before the stop the player had actually chosen began.
The road's own rule is that a node is one event.

A bond level still pays twice, but the two halves are now **two stops apart**.
The mark is left *owed* rather than opened, and `enter` pays it on arrival at
the next stop, before that stop's business — exactly where a bond scene fires.
`RUN.pendingSigil` and `RUN.markPair` have survived a closed tab since Build 63,
so owing it costs nothing new.

A stop now interrupts for **at most one thing**, in this order:

1. a **debt** — a mark earned at the last stop
2. a **bond** — a threshold the player watched fill
3. a **recall** — the road paying out on its own

Which also spreads the developing beats further along the road rather than
stacking them at whichever stop happened to cross a threshold.

### Where it stands

bond **69/69** (was 62 — the mark section rewritten, five new bench checks) ·
flow 250/250 · line 21/21 · camp 45/45 · road 94/94 · slice 59/59 ·
music 22/22 · beat 10/10.

---

## Build 101 — three places on their side too

The party has stood in FRONT / MID / BACK since Build 20. The things it fought
had nowhere at all — a picture at a fixed point on the right.

Build 99 gave a small foe a lane to **swing at**, decided by an allocation rule
that walked the line handing out free rows. The effect was right and the cause
was invisible: two Husks both wanting the front meant the second was silently
reassigned to the middle, and *"why is this one hitting Mira?"* had no answer
anywhere on the screen.

Build 101 gives it a lane to **stand in**, and the swing follows from where it
is. A creature in the middle lane hits the middle lane because it is standing
there.

### What that buys

- **Three places, so at most three things.** A fourth body would have nowhere to
  stand and would have to share a lane — the exact ambiguity slots exist to
  remove — so the line is capped at the number of places.
- **Moving a hero trades who answers which of them.** Measured: with three foes
  the incoming reads `ash:9 mira:9 elin:12`; step Ash back and it becomes
  `elin:9 mira:9 ash:12`. The board decision this game already asks every turn
  now decides the matchups, and it does so *visibly*.
- **One voice per position falls out for free.** One foe to a lane means no hero
  is ever asked to answer two creatures at once — Build 99's rule, now a
  consequence of the geometry rather than a rule enforced on top of it.
- A foe whose lane has no one alive in it reaches the nearest place that does.
  A creature does not stop swinging because the person opposite it fell.

### One floor, not two drawings

The first pass spaced the line by eye and put the back body's centre at x=912 on
a 932px stage — half of it off the edge. The fix was to measure the party and
copy its ladder: their projected centres and ground line come out at 240/234,
352/253, 474/276 — about 115px of x per rank and 21px of lift. The line runs the
same ladder the other way, so the two sides read as one floor:

| | party | line |
| --- | --- | --- |
| front | 474 / 279 | 670 / 289 |
| mid | 352 / 254 | 759 / 264 |
| back | 240 / 233 | 837 / 242 |

Each body wears the rank's own air-and-warmth filter, the same one the hero
ranks have worn since Build 21, and carries the floor's own word for its lane.

### The readout stopped saying everything twice

With a line on the floor the big foe plate was printing the aimed creature's
name and health directly above a strip printing the same name and the same
health — and sitting across the telegraph, so the two most important things in
that corner fought for the same pixels. A line of one keeps the plate it has
always had; a line **replaces** it.

Three more readability faults, all caught by looking at it:

- Every name truncated (`The Hollow Hu…`). Every creature in the bestiary is
  called "The Something", so the article was three characters of nothing
  repeated down the column. Dropped.
- The lane column read `Fro / Mid / Bac`. The telegraph has printed **F / M / B**
  for a hero's rank since Build 96; a readout inventing a second spelling beside
  it was both wrong and eating the width the names needed.
- The front body's lane label hung below its box and fell behind the card fan —
  the one lane the player most needs to read was the one the hand covered.

### Where it stands

**line 28/28** (+7). The slot checks assert the rule rather than the layout:
one body to a place, a blow comes down its thrower's lane, every body carries
its own health, a line never holds more than there are places, trading places
trades who answers what, and the line recedes on the party's own ladder and
stays on the stage.

Everything else held with the slots in: flow 250/250 · road 94/94 · bond 69/69 ·
slice 59/59 · camp 45/45 · music 22/22 · beat 10/10 — **587 checks, no page
errors**.

---

## Build 102 — new faces

Three replacement character plates, cut in and framed.

### They arrived opaque

The uploads were fully opaque with a studio-white backdrop; the game composites
these over a painted battlefield, so they had to be matted first. A brightness
threshold was never an option — Ash's scarf and tunic and the whole of Elin's
habit are the same near-white as the backdrop, and "every pale pixel is
background" would have cut the clothes off both of them. A **flood fill from the
edge** only reaches what is connected to the outside, so the enclosed whites are
safe by construction.

Two things the screen caught that the code did not:

- **Mira shipped as a rectangle of checkerboard.** Her backdrop had the
  transparency checker painted in as real pixels, two tones 16 apart — and PIL's
  flood `thresh` compares the *sum* across channels, so 16 is a difference of 48
  and my threshold of 42 stopped dead at the first dark square. The pass now
  measures its own result: a standing figure covers a third to a half of its own
  bounding box, so a cutout outside 15–72% opaque fails the export rather than
  reaching the board.
- **The stance padding was backwards.** These three all trail cloth or a staff
  off to one side, and `anchorFor()` puts the parry ring at the *centre of a
  hero's element* — so an off-centre figure would take its ring in mid-air
  beside it. The fix pads the short side so the FEET land in the middle… except
  the first cut padded left when the stance sat right of centre, which pushes it
  further out. Ash ended at 872 of 1142. Both the centring and the head-finding
  now assert what they produced.

### A face is not a figure

A full-body plate squeezed into a 36px circle is a silhouette — three dark
shapes that cannot be told apart, which is the roster's only job. Each hero now
carries a **face plate** beside their figure, used by all three coin-sized
portraits: the party stack, the road's roster, and the swap screen's column
headers.

The head is found by looking **up the stance column** rather than for the topmost
opaque pixel — Elin's staff reaches higher than she does, and the first version
put her face on its crossguard.

### Where it stands

Every screen that draws a hero — the board, the scene cast, the marking screen,
the campfire doors, the deck and swap columns, the road's roster — reads the same
three files, so the swap is one export rather than a hunt.

### And a check that was measuring the wrong thing

The line suite's ladder check went red on the new art, and the layout was not
the problem. It asserted that each foe's ground line lands **within 12px of the
hero standing opposite** — which passed until three replacement plates with
different aspect ratios nudged the party's measured baselines by a few pixels.

A check that a change of *artwork* can break was never measuring the geometry it
claimed to. What the design says is that the two ladders are **parallel**, not
coincident: the party rises 28 then 24 between its ranks and the line rises 24
then 22. That is the floor, and it survives a global nudge the way a real one
would.

flow 250/250 · road 94/94 · bond 69/69 · slice 58/58 · line 28/28 ·
camp 45/45 · music 22/22 · beat 10/10 — **586 checks, no page errors**. Six of
the seven suites took three replacement character plates without a word, which
is the point of having the whole cast read one export.

---

## Build 103 — five complaints, and what each of them was actually about

A playtest note listing five things. Four were the same fault wearing different
clothes: **a screen that knows something and does not say it.**

### The white in the hair

The Build 102 export flood-filled from the edge, which cannot reach a gap
*enclosed* by hair — and every strand kept a halo besides. The matte is a real
one now (Higgsfield `remove_background`, alpha extrema 0–255 rather than 0/255),
but that alone was not enough: the model returns the plate **composited over
white**, so every soft pixel still carries a share of the backdrop. On a dark
stage that is a pale haze along every strand. Undoing the composite —
`C = a·F + (1−a)·255`, solved for F — gives the strand its own colour back.

Measured over the head band, pale-and-soft pixels: **4.5 / 6.2 / 5.9%** before,
**2.6 / 2.4 / 1.3%** after. The export fails now above 3.5%.

The check had to exclude *opaque* pale pixels or Elin's cream habit fails it and
nobody else does — the thing being measured is backdrop left in the cutout, and
backdrop left in a cutout is soft by definition.

### "What is the red box on character health?"

It was the incoming-damage badge, and it wore **✦** — a sparkle, the glyph every
game in the genre uses for something you *want*. A red box reading `✦7+2` beside
a health bar is a riddle, not a warning.

It is **▾** now, an arrow pointing down into the bar it is about to empty, and
**☠** when the emptying is fatal. The badge is shorthand; hovering it prints the
sentence — *"Incoming this turn — 9 aimed at Ash · 3 from the dirge, on
everyone"* — which also names the two sources separately, the same split the
telegraph shows.

### "I don't like getting an upgrade prompt before a fight"

Build 100 moved the mark a bond level pays off the stop that earned it and onto
**arrival at the next stop**, which fixed one-node-one-event and created this:
the last screen between choosing a fight and fighting it was a quiet,
deliberative card-upgrade prompt, wedged into the one beat of the loop where the
player is leaning forward.

The debt is settled in `toMap` now — back on the chart, road ahead, nothing yet
committed to. Same debt, same rule, but on the beat that is already for
thinking rather than the beat that is for fighting. No loop is possible: the
marking screen's two exits both clear `pendingSigil` before `endBondChain` comes
back through, and `bondResume` is cleared so that it comes back to the road
rather than into a stop.

### The marking screen printed its own notes across the cards

Both `k-mk-delta` and `k-mk-note` were absolutely positioned *inside* the card
button, so all ten cards wore two or three lines of small type across their own
effect text — the exact numbers the note existed to help compare. And the scene
above them owned 250 of 430px, which pushed the row seven pixels off the bottom
edge of a container with `overflow: hidden`.

The note sits **under** the card now, in flow; the cinematic is compressed
(figures 178→124, the seal 54→46) and the ten faces get 169px of their own. The
surge delta is a chip rather than a sentence — `7 → 10`, the one number that
moved, because the card face already shows the new ones.

### "What they learned"

The largest single shape on the screen was a 104×164 **dashed empty rectangle**
labelled LEAVES with two words floating in it — the first thing the eye landed
on, saying nothing. It is a **card back** now: same frame, same weight, same
corner radius as the card opposite it, so the panel reads as two cards one of
which has not been turned over.

Three smaller things: the disabled trade button was a filled slab dimmed to 40%,
so the screen offered two controls of equal weight one of which does nothing
(it is a hint now, not a plate); both button labels named cards that are drawn
full size two hundred pixels away, and wrapped to two lines doing it (`MAKE THE
TRADE`, `SET IT DOWN FOR NOW`); and the fifth row of each five ran into the
controls at the bottom edge, which is what made a page with room to spare read
as crowded.

### The campfire

Two faults, both the same one. A plate given a whole branch to itself is
190×290 and it was spending all of that on a painting under a **7.5px** whisper
— an enormous object saying almost nothing, which is how a shop reads as a
poster gallery. It prints what it becomes at 9.5px now, over what it was, struck
through.

And the price was a *sentence*: "TAP AGAIN TO KINDLE — 3 EMBERS", an instruction
for operating a control that was not on the screen. It is a button with the
number on it. The second tap on a plate still works for anyone who found that
first.

### The checks that moved, and why

Six checks changed, and each because the claim under it changed rather than
because it went red:

- `MARK: the debt is paid on arrival at the next stop` → **settled back on the
  road**, plus a new one asserting that the stop the player then travels to is
  the only thing waiting at the end of the walk.
- `FIRE: …not restated on all ten plates` → **a plate says what it becomes, in
  type a person can read**. A branch shows three plates, not ten; the thing
  worth asserting is legibility, not silence.
- `FIRE: the strip … says what taking it would cost` → **the price is a button
  with the number on it, not an instruction to tap again**.
- The slice walk answers a debt **before** it travels now, and asserts that
  paying it hands the road back with the stop still unentered.

`window.R.toMap` is exported for the same reason `travel` is: the road is a
destination, and a suite driving the walk has to be able to name it.

Three checks were added rather than changed: the badge's glyph and its hover
sentence; that nothing on the marking screen prints across the card it describes
or falls off the bottom of it; and that a campfire plate's after-line is legible
(≥9px) rather than merely present.

flow 251/251 · road 94/94 · bond 71/71 · slice 69/69 · line 28/28 ·
camp 46/46 · music 22/22 · beat 10/10 — **591 checks, no page errors**.

---

## Build 104 — the marking screen becomes two beats

The Build 103 pass made the marking screen *fit*. It did not make it
**readable**, and a playtester said so: crammed, and you can't read any of the
cards.

### One screen was doing two jobs

430 pixels were carrying a cinematic — the two of them, the mark burning between
them, the line that passed between them — **and** a ten-card decision. The scene
won. It took two thirds of the board, and the ten cards it was asking about got
the rest: scaled to 62% and stacked five to a half-width column, with their
before/after notes printed across their own effect text.

Making the scene smaller only made the cinematic worse. They are two different
things and they get two beats.

**Beat one is the moment.** The whole board: both figures at 196px, the seal
burning between them at 62px, the mark's name at 26px, the line under it, and
the prose. One door out, and it names the next question rather than being an
arrow: `WHICH CARD LEARNS IT?`

**Beat two is the decision**, and it is built the way every other trade in this
game is built, because it is the same question: **ten cards have to be scannable
and one has to be readable.** Two columns of five compact rows — cost, name, what
it does, who owns it, the same anatomy as the swap screen's rows — and a panel on
the right that draws the card you are holding **twice**, at full size: as it is,
and as it would be wearing the mark. The one number that moves is named under
them.

Rows are 47px with 11.5px names. The old faces were 82px wide.

### The campfire's grammar, because it is the campfire's decision

First tap picks the card up and the panel reads out what the mark would do to
it; second tap on the same card places it — and there is an explicit
`MARK IT — CHAIN` button beside it for anyone who wants one. A mark lasts the
rest of the run; one stray thumb must never spend it.

The scene does **not** stay behind the decision. Kept at 30% opacity it sat
directly under the two columns — a figure the height of five rows, printed
through them. The moment has happened; what it handed over is in the title, in
the colour running through the whole screen, and drawn on the card face in the
panel.

### What the soak caught that the suites did not

Build 103 moved the mark debt onto the road and every suite went green — but the
**soak** was never run, and it had an invariant that said *a stop hands the road
back*. Settling a debt on arrival at the chart is the road, not a stop that
failed to end, and six of ten seeds duly reported a breach. The soak answers a
debt at that seam now and checks the hand-back against what is left afterwards.

Ten random runs, six to the Regent, no invariant breached, no page errors, and
the deepest queue of conversations at one stop is still 1.

### The checks

Three changed and two were added, all in the same direction — from *is it
present* to *can it be read*:

- `every card it may land on is DRAWN wearing it` → **all ten are offered as
  rows that say what they do**, with nothing drawn as a face until one is picked
  up.
- new: **the screen opens on the moment** — two figures, no cards, one way
  forward.
- new: **the first tap picks a card up and draws it twice**, as it is and as it
  would be, and does not spend the mark.
- `nothing prints over the card it describes` → **every row is legible (≥11px)
  and nothing hangs off the screen**.
- The slice walk and the four non-gating harnesses (soak, pace, filmstrip, feel)
  all learned the three-step grammar.

flow 251/251 · road 94/94 · bond 73/73 · slice 65/65 · line 28/28 ·
camp 46/46 · music 22/22 · beat 10/10 · soak 5/5 — no page errors.

---

## Build 105 — the marks pay AP, and a mark is a keyword

Three notes from a playtest, and they turn out to be one design.

### A reward two fifths of the deck could not receive

CHAIN and LEAD **opened the card's own combo** — CHAIN when an ally had gone
first, LEAD on the turn's opening play. That is worth a great deal on the ten
cards that carry a combo and **exactly nothing** on the eighteen that do not,
and the marking screen said so out loud: it printed *"no combo to arm"* under
four of the ten cards it offered. A reward most of the deck cannot receive is
not a reward, it is a filter the player has to apply for themselves.

They pay **AP** now, which every card in the deck can receive:

- **CHAIN** — play it after an ally, and 1 AP comes back.
- **COMBO** — play it after the same hand, and 1 AP comes back.

They read the same fact — who acted immediately before this card — and split it
in two. Between them they cover every board in which anything has been played at
all, and neither pays the turn's first card, because there is nothing to follow.
LEAD is retired; `elin|mira` grants COMBO in its place.

### Why a refund and not a discount

The note asked for "−1 AP", and that is what this is, by the only route that
works. **Costs never fall below 1** (deck §3) and **25 of the 28 cards cost
exactly 1** — measured, not assumed — so a literal cost reduction would be dead
on nearly the whole deck. That is the reason the evaluator has carried a comment
since Build 90 saying no sigil touches cost.

A refund is the discount that survives the floor: you pay, and the point comes
back. It is also the lever the pace sim has already measured — the two combo
refunds were worth **sixteen** points of winrate against **one** for the
all-out's gear — so this is the mark landing on the part of the game that
decides how long a turn is.

It is capped at **one refund a turn, shared with the combos**. Mark a card that
already refunds and you have not doubled anything; you have made it pay in a
second order as well as the first.

### A keyword lives in the rules box

The mark was a chip floated on the ART, under the cost orb. Three treatments
have now failed there — a full-width gold ribbon, a vertical spine down the left
edge, and that chip — and the third was legible and still wrong, because it put
a rule somewhere no other rule on the card is written. Every deckbuilder this
game's player has already played puts EXHAUST and RETAIN **in the text box**.

It is a band under the combo strip now, same shape, one line, the keyword by
name — and the two order marks light **ON** exactly when a combo would. The
marking screen's before/after panel is what this was for: `NOW` is the plain
card, and beside it the same card with `→ COMBO` added to its rules. Gaining a
mark now looks like gaining a keyword, because it is one.

The band costs the text block room the way the combo strip does, so it is
**counted into the card's own row-density tier** — a denser card tightens
instead of clipping. Swept across all 28 cards in all five mark states: Last
Light and Last Vigil needed it at three rows, Quick Throw at five.

### The checks that moved

- `CHAIN: an unreachable combo opens when an ally has gone first` → **after an
  ALLY the AP comes back, and after the same hand it does not**, plus its mirror
  for COMBO, plus one asserting both pay a card with **no combo at all** — the
  eighteen the old pair could not reach.
- `OPENING: the turn's first card has nobody to follow` → **neither mark pays
  the turn's first card**. Same fact, opposite conclusion: LEAD existed to make
  that case pay, and a mark that paid it now would be a flat discount wearing a
  condition.
- new: **one refund a turn, shared with the combos**.
- `MARK: the band costs art, not text` → **no card clips its own face in any
  mark state**, all 28 × all 5. The old claim was true by construction while the
  mark floated on the art; it cannot be true of something in the text box, and
  the claim that actually matters is that nothing clips.
- new: **the keyword is printed in the rules box, by name — not as a chip on
  the art**.

flow 253/253 · road 94/94 · bond 73/73 · slice 69/69 · line 28/28 ·
camp 46/46 · music 22/22 · beat 10/10 · soak 5/5 — no page errors. Ten
randomised runs, six to the Regent, no invariant breached.

---

## Build 106 — the road talks, the node fights

Four notes, and two of them are the same one I only half-fixed at Build 103.

### "I'm still getting upgrades before a fight on the same node"

Build 103 moved the **mark debt** off the arrival seam and onto the road. It
left the two **conversations** — a bond level and a recall — exactly where they
were: opening on arrival at whatever stop the player had just chosen. So the
doorway still had an upgrade prompt in it, a smaller one, on the same node: pick
a fight, get a scene, a fork, and a card-swap screen, and only then the fight.

`enter(n)` is one line now — `enterStop(n)` — and everything the road wants to
say happens on the road, in `toMap`. **A node is its stop and nothing else.**

Two rules keep that from becoming a queue in a new place:

- **One leg of the road, one conversation.** `_roadSpent` is set when the road
  opens something and cleared when a stop is entered, so each walk between two
  nodes carries at most one.
- **A mark debt is not a second conversation.** It is the second half of the
  payout that leg has already made, so it does not spend the budget: a bond
  level runs scene, fork, trade and mark on the leg it was crossed.

That second rule is not a nicety. With the debt spending a leg, six bond levels
each owing a mark is twelve legs on a road that has ten — and the soak measured
**0 recalls across ten runs** where it had been measuring 21. The road had no
room left to remember anything.

### "I haven't seen any multiple enemy fights yet"

Measured, and the note is exactly right. 19% of fight nodes carried a pack — but
a run walks eleven stops of which **2.95** are ordinary fights past column one,
so a random walk met **0.94 packs per run**, and one run in six met none at all.
A player could finish a whole road without ever seeing the thing the positional
line was built for.

From column two on, three of every four draws is a line now — **~2 a run, and
90% of runs see at least one**. The first two columns still stand one foe up
(the fight has to teach itself before it teaches the line) and an elite and the
Regent stand alone by rule, because what makes them what they are is reach. The
ceiling here is the road, not the table: pushing the draw further buys tenths.

### "After an Ally should be replaced with Chain"

`FOLLOW_UP`'s label was **After an Ally** while the mark that reads the same
fact was called **Chain** — two phrases for one rule, printed on the same card.
One word: the combo tag says CHAIN, and the sentence lives in the detail view
where a sentence fits.

Which exposed a second thing. A card whose combo is CHAIN, wearing the CHAIN
mark, was printing the word twice — its own condition, and the keyword beneath
it. **One trigger, one band**: the mark's payoff joins the band that already
carries the trigger (`costs 1 AP. +1 AP back.`), and joins it only when it adds
something — the refund is capped at one a turn, so a FOLLOW_UP card that already
hands the AP back gains *nothing* from CHAIN. The band says so by staying quiet,
and the marking screen says it out loud: *"it already pays this."*

### "Combo is on the same character that previously performed"

It was comparing owner STRINGS — the same thing FOLLOW_UP compares — so on a
pair card it meant "the same pair played again". Ash following his own Cross
Sever with Shield the Blade is plainly the same hand at work, and a string
compare said it was not. Both marks read the two owner **sets** now and ask
whether they overlap: COMBO wants a shared character, CHAIN wants none.

### What the harnesses had to learn

The bond suite's walk went through `_set` + `travel`, which paints the map
directly and skips the seam that asks whether anything is owed — so it would
never have met a conversation at all. It goes through `toMap` now. The slice
walk answers the road's one conversation *before* it travels, and asserts that
each stop opens on its own business. And the soak's story handler waited for
`scene()` to go null, which since this build can mean "a bond opened behind the
memory" — it watches the memory's own identity now, not emptiness.

flow 253/253 · road 94/94 · bond 74/74 · slice 88/88 · line 28/28 ·
camp 46/46 · music 22/22 · beat 10/10 · soak 5/5 — no page errors. Ten
randomised runs, eight to the Regent, 36 bond scenes, 27 recalls, and the
deepest queue of conversations at one stop is still 1.

---

## Build 107 — the card names what it hits

"I should be able to target different enemies." The aim system was there — tap a
body, or a row in the readout, and the reticle moves. The gesture that plays a
card could not reach it.

### One arc, to the first creature, always

`pickTargets` for an enemy card returned exactly one node, `#k-boss-art`, under
a comment that said *"enemy — one answer, the foe"*. That was true when there
was one foe and has been false since the line shipped: an attack drew a single
arc to the first creature no matter how many were standing, and the blow landed
on whatever `C.aim` happened to be.

`dropTargetAt` had the same hole from the other side — only `#k-boss-art` was an
enemy drop zone, so dragging an attack at the second or third creature snapped
back to the first. The card went where the aim already was, and the drag said
otherwise the whole way down.

So the only way to choose a target was to tap a body *before* picking up a card
— an affordance nothing on the screen announces, and a rule nobody should have
to learn while holding a card and pointing at things.

Both paths offer every living creature now. The tap path draws an arc to each
and the one you press is the one that takes the blow; the drag path makes every
body a drop zone and snaps to the nearest. `commitCard` and `dropCommit` move
the aim **before** the card resolves, so every downstream reader of `C.aim` —
the evaluator, the camera, the damage popup, the death check — sees the creature
the player pointed at rather than the one that happened to be aimed at.

A fight against one thing is unchanged: one arc, one zone, and no decision the
player did not have before. That is its own check.

flow 253/253 · road 94/94 · bond 74/74 · slice 85/85 · line 32/32 ·
camp 46/46 · music 22/22 · beat 10/10 · soak 5/5 — no page errors.

---

## Build 108 — the opening fifteen: three of one card, a modifier, a special

Slay the Spire opens on Strike, Strike, Defend, Strike, Defend. Three distinct
cards, two of them the same idea. This game opened on fifteen cards nobody had
ever seen — and the measurement was worse than "all different":

| | Build 107 | Build 108 |
|---|---|---|
| Cards | 15 | 15 |
| Distinct **faces** | **15** | **9** |
| Distinct verbs | 13 | **8** |
| Combo **conditions** | 4 | **1** — Chain |
| Cards carrying a combo | 8 of 15 | **3 of 15** |
| Distinct faces per 5-card hand | 5.00 | **4.28** |
| Conditional cards per hand | 2.6 | **0.98** |
| Hands with 3+ conditions | **54%** | **2.5%** |
| Hands with 2+ unreachable combos | 7.2% | **0%** |

Nothing was mechanically broken — across 600 deals there was never a hand
without damage and never a single-hero hand, before or after. The whole problem
was teaching, and more than half the time a player's hand was a majority of
rules they had to hold in their head at once.

### Three of one card, and the card is the hero

Each hero carries **three copies of one BASIC, one MODIFIER, one SPECIAL** — and
the three basics share one pattern: *a hit, plus what this hero is for.* Ash's
colour is force, so his is simply the bigger hit; Elin's is the ward; Mira's is
the wound that keeps arriving. One rule with three accents, not three rules.

The **special is the only card in the opening deck with a combo on it**, and all
three trigger on CHAIN. One word to learn, then read what each pays: Ash's is
the discount (his is the only 2-cost card, so a discount can mean something),
Elin's is the **refund**, Mira's is damage.

Elin holds the refund on purpose. The first cut of this deck lost it entirely —
both `reward: 'ap'` cards were modifiers, the modifiers lost their combos, and
the base fifteen went from two refunds to none. The AP ladder's own measurement
is that the refunds are worth **sixteen points of winrate** against one for the
all-out's gear. Not a rung to drop by accident.

### A copy is an ID, not a count

The whole hand layer keys off `data-card` — selection, drag, the flight
animations, hold-to-inspect, eight `querySelector` calls — so two cards in one
hand sharing an id would collide on every one of them. Giving the deck real
instance identity is a deep change touching every `cardDef`/`sigilOf`/upgrade
lookup.

Three ids wearing one face costs **six table rows and changes no machinery**.
`rosterValid`'s fifteen-unique rule and the no-second-copy rule at every swap
door both keep working untouched. `sameAs` is the only thing in the engine that
knows a copy is a copy, and it does two jobs: the copies share a painting, and
**sharpening a basic sharpens all three of them** — otherwise the deck would
carry two Cleave and one Cleave+ with no way to tell which you drew.

### The tree got better by accident, then on purpose

Nine tree nodes sharpen nine cards, so the deck's nine faces should be exactly
those nine — and **tier one is now the basic**, which means the first three
embers a player spends change three of their fifteen cards. Nothing else on the
tree is worth its price by as clear a margin, and nothing teaches what buying a
node *does* as quickly. Tier two is the modifier, tier three the special.

Guarding Cut, Serrate and Quick Throw had no upgrade at all — the fire could not
touch three of the deck's nine faces — so they have one now.

Counterstance, Last Light, Frost Bind, Intercession, Backstab and Execute leave
the opening deck. Their definitions, paintings and upgrades stay in the game;
they are the natural pool for a "learn a new card" node, which is the next piece
of work rather than part of this one.

### Four checks that were measuring the wrong thing

- `camp`: two checks named a tree node by id (`elin.mend`, `ash.lastlight`) and
  a price by literal (`3`). A node id and a price are facts about the tree's
  *shape*, and the shape moved. They ask the tree now — which node is sealed,
  what this one costs, what this tier can afford. One of them had been failing
  **silently**: `kindle` refused a purchase that was no longer in tier, the deal
  class was never cleared, and the check reported the screen re-dealing when
  nothing had been bought at all.
- `flow`: the painting check asserted one painting per id, which cannot be true
  of a copy. It asserts one painting per FACE now, plus that a copy wears its
  original's.
- `flow`: the two-finales fork buys Mend+ first, because All Three is an upgrade
  now rather than something a first fight teaches.

And three new ones hold the shape: fifteen cards / nine faces / 3-1-1 per hero,
one condition on three cards, and eight verbs or fewer.

flow 256/256 · road 94/94 · bond 74/74 · slice 85/85 · line 32/32 ·
camp 46/46 · music 22/22 · beat 10/10 · soak 5/5 — no page errors.

### …and the pace sim, once it was measuring a run that develops

Build 106 moved the conversations onto the road and only the MARK was taught to
`pace.sim`, so it walked ten roads taking no cards and no marks and duly
reported that a run does not develop. The harness was the thing that had stopped
developing. Its "cards swapped in" column was also reading `bonds` — the number
of conversations HEARD, which is not the same number, because a fork can hand
over nothing when the party already carries both of its picks.

Fixed, ten runs per skill level, against the new deck:

| skill | won | nodes kindled | cards swapped in | marks | embers left | short at a fire |
|---|---|---|---|---|---|---|
| clumsy | **5/10** | 2.5 | 5.5 | 2.7 | 11.7 | 0/12 |
| ordinary | **7/10** | 3.3 | 5.3 | 2.4 | 12.5 | 2/14 |
| sharp | **9/10** | 4.8 | 6.7 | 3.8 | 17.3 | 0/12 |

A clean monotonic skill curve — 50 / 70 / 90 — and a run that changes eight to
fifteen things about the party between the trailhead and the Regent, against the
sim's own floor of four.

**And it names the tree's real problem, which is not the price.** Nobody is ever
short: 5.4 to 8.2 of the ~8 open nodes are affordable at every fire, and a run
ends holding 12 to 17 unspent embers. The constraint is **fires** — 1.2 to 1.4 a
run. The tree does not go unspent because the player cannot pay; it goes unspent
because they are almost never standing in front of it.

---

## Build 109 — a number orphaned from its words

Playtested the new deck, and the first hand caught something no check had ever
asked about: **Lumen Cascade's second row wrapped**, printing `4` on one line
and `GUARD · LOWEST` under it. Which reads as a broken card rather than a long
one — and it is now a card the player draws three times as often as anything
else Elin owns.

Four cards were doing it: Lumen Cascade, Shieldsong, Cut the Cord and A Quiet
Word. Nothing caught it because **the suite measured overflow PAST the card**,
and a wrapped row does not overflow — it costs a LINE, which the row-density
tiers quietly absorb. The card fits. It just looks wrong.

`Guard to all` → `Guard · all` and `Guard · lowest` → `Guard · low`, which also
makes the three members of that family parallel: one verb, three targets, one
grammar. `A free step for anyone` → `A free step`, because the icon and the
absence of a name already say the rest.

### …and the combo's payoff is counted the same way the clauses are

Shared Grace then clipped by 4px, and the cause was next to the last one: the
row counter measures every clause on the card by its length and then assumed
**the combo's payoff was one line**. It is not — `the AP comes back.` is
eighteen characters against a fifteen-character line — so the one card that
gained a combo this build was the one card that hung past its own box. The
exception is gone; the payoff is counted like everything else.

New check: **no clause wraps inside its own row**, swept across every card. It
is the third distinct way a card face can fail to read — past the bottom, off
the side, and now inside — and it is the one that had never been asked.

flow 257/257 · road 94/94 · bond 74/74 · slice 80/80 · line 32/32 ·
camp 46/46 · music 22/22 · beat 10/10 — no page errors.

---

## Build 110 — which mark, and whose memory

Two questions about progression, and the map of what a run can gain answers
both. Every door, measured:

| Door | Gives | Per run |
|---|---|---|
| Bond scene (3 pairs × 2 levels) | a card, and a mark | up to 6 |
| Recall (4 in the table) | a card | up to 4 |
| Campfire tree (11 nodes) | sharpens a card, +1 AP, a better all-out | 2.5–4.8 bought |
| Awakening | a memory | 1 |
| Crossroads | health, embers, bond | ~1.5 |

Actuals from the pace sim: **5–7 cards swapped in, 2.4–3.8 marks, 2.5–4.8 nodes
a run.** Plenty of gaining. Almost none of it a *choice about what kind of run
this is*, and the map says exactly why.

### The mark was a delivery schedule

`SIGIL_BY_PAIR` gave each pair one mark per level. The player chose which card
wore it and **never which mark it was** — which made the most build-defining
system in the game (five marks, six placements, every one permanent) into a
rota. A run that stacks Surge and a run that stacks Chain play completely
differently, and nothing let a player aim at either.

Each level is a **fork of two** now. The first is the pair's own — what these
two are for — and the second is the branch, so a player can lean into the pair's
character or steer the run somewhere else. Deterministic from pair and level, so
a seed still deals the same road.

The moment ends on that fork: two marks side by side under the figures, each
with its glyph, its name and its rule, in its own colour — the same shape every
other conversation on this road ends on. The header holds its tongue while the
fork is open (`WHAT THEY LEARNED — Two things came out of it. One of them
stays.`), because printing one of the two at the top would be the screen
choosing for the player.

### Both card-doors were the same door

All twelve cards the road could hand over were **bond cards** — pair cards, two
owners each — and both doors drew from that one pool. So "one person remembering
their own trick" handed over something owned by two people, and the road's
entire card supply had one flavour.

Meanwhile the six cards the 3/1/1 deck displaced — Counterstance, Last Light,
Frost Bind, Intercession, Backstab, Execute — were painted, defined, *upgraded*
and completely unreachable.

The two doors mean different things now. **A bond scene gives what two of them
learn together; a recall gives what one of them already knew.** Each memory
offers two of its own hero's solo cards, and between the four of them every
displaced card is reachable again. That is a check: nothing the opening fifteen
put down is stranded.

### A memory with nothing left to give

Ash has two recalls and two cards to remember, so taking both at the first one
left the second with an **empty fork** — a scene with no way out of it. The bond
scenes have had that fallback since Build 97; the recalls never did, and nothing
found it because they used to draw from a pool of eight rather than a hero's own
two. Widening the door found the hole in it.

flow 257/257 · road 94/94 · bond 76/76 · slice 85/85 · line 32/32 ·
camp 46/46 · music 22/22 · beat 10/10 · soak 5/5 — no page errors. Ten runs,
eight to the Regent, 31 recalls.

## Build 111 — the learn node

The fire sold eleven nodes and nine of them did the same thing: a card you
already own becomes a better version of itself. That is vertical. Your deck
gets *stronger* over a run and never gets *different*, so the run's shape was
settled by the road's two card doors and its marks, with the campfire only
turning the volume up.

A **LEARN** node is the first thing on this tree that changes what a deck *is*.
It trades one copy of a hero's basic for a **second copy of the card that
carries their combo**:

| Node | Takes | Drops |
|---|---|---|
| ASH · learn | a second Cross Sever | one Cleave |
| ELIN · learn | a second Shared Grace | one Lumen Cascade |
| MIRA · learn | a second Twin Fang | one Serrate |

The deck stays fifteen. It becomes **less consistent** — two of the reliable
thing instead of three — and far more pointed, because the run's one condition
now turns up twice as often. It is the move a deckbuilder's player already
knows: you found the thing that works, so you take another one.

### Priced against the measurement, not against the other nodes

The obvious price was 5 or 6 — dearest on the tree, done. The pace sim says
that would have been a gift. Embers are **not** the scarce currency: five to
eight of the ~8 open nodes are affordable at every fire and a run ends holding
twelve to seventeen spare. **Fires** are scarce — 1.2 to 1.4 a run. So a cheap
learn node is not a fork, it is one more thing swept up on the way past.

At **seven** it is the most expensive object at the campfire, and a fire reads
as *sharpen two, or learn one* — a fork at the fire the player is standing at,
rather than a fork at fires they never reach.

### A second copy is an alias, not a duplicate

`crosssever2`, `sgrace2` and `twinfang2` carry `sameAs` pointing at the card
they copy, which is the same machinery the opening fifteen's repeated basics
use (Build 108). One id per copy, because the hand layer selects, drags, flies
and inspects by `data-card` and two identical ids in one hand would collide on
all four. One *face*, because `buildCards` resolves upgrades through `sameAs`
and `cardArt` resolves paintings through the art alias — so buying ASH's tier-3
sharpening upgrades **both** Cross Severs, and both wear the same painting.

That last part broke the camp suite honestly: twelve card-shaped plates now
wear nine paintings, and the check asserted `carded === 9 && distinct === 9`.
Those were two coincidences dressed as a claim. Both are read off `TREE` now —
every node that sells a card wears that card's painting, however many nodes
share a face. Third de-literalised check this week; the pattern is worth
naming, because a literal in a check is a fact about the build you wrote it on
and nothing else.

### The fan had room for three

The learn node is a fourth plate in a branch sized for three, and it went
straight off the right edge — invisible to eight green suites and obvious in
the first screenshot. `renderCampBranch` counts its own plates onto the fan now
(`data-n`) and the CSS shortens them at four and five, so the branch fits
whatever the tree grows.

### The sim said the learn node is bought 0% of the time

It is not. The pace sim's fire bot buys **strictly cheapest-first in tree
order**, and at three to five embers a sharpening node it hoovers the purse
empty long before it reaches a seven. "Took one at 0% of 99 fires" was a fact
about the bot, and I nearly wrote it down as a fact about the price.

Two changes make the instrument answer the question. The fork is now measured
**arithmetically**, independent of what any bot prefers: count what the purse
buys cheapest-first, count again with seven taken off the top, and the gap is
what a learn node costs *in other nodes*. And there is a fourth arm — not a
skill, a **preference**: an ordinary player (0.7) who takes the learn node
whenever they can pay for it, against the ordinary player who never does.

| | affordable at | took one | …and still bought more | cost in sharpenings |
|---|---|---|---|---|
| clumsy | 52% of fires | — | — | 2.15 |
| ordinary | 46% | — | — | 1.92 |
| sharp | 60% | — | — | 1.72 |
| **learner** | 45% | **45%** | **40%** | 1.56 |

So: payable at about half the fires a run reaches, and it costs **1.6 to 2.2
sharpenings** — "sharpen two, or learn one", measured rather than asserted. A
learner who takes it still buys something else at 40% of fires, so it is a
spend and not a lockout.

**Won 14/24 against ordinary's 16/24 at the same skill.** That gap is inside
the noise at twenty-four runs, and the two arms did not walk the same roads
(0.83 fires a run against 1.17), so the honest reading is *not a trap and not a
must-buy* and nothing finer than that. Which is what a fork is supposed to look
like — if a learner had won 21 or won 8, the price would be wrong.

flow 257/257 · road 94/94 · bond 76/76 · slice 85/85 · line 32/32 ·
camp 48/48 · music 22/22 · beat 10/10 · soak 5/5 — no page errors. Ten runs,
eight to the Regent, 28 recalls, 19 nodes kindled.

## Build 112 — the cast in three dimensions

A painted sprite can only face one way. Every hero on this stage has been a
single `.webp` since Build 4, which is why they turn to face the camera when
they cross the board, why a strike is a CSS nudge rather than a swing, and why
the all-out is four flat plates sliding at a fifth. The figures were the one
part of the fight that could not act.

`?cast=3d` puts a rigged, animated figure in each hero's place. It is **opt-in,
and the proof that it is opt-in is that 624 checks in nine other suites never
see it.**

### The layer does not replace the stage

This is the whole design. The DOM keeps every job it already does — `.k-hero`
holds the box, the row, the drag, the aim target, the popups, the shadow, the
drop zones. The layer draws **one canvas** across `#k-cast`, reads where the DOM
has put each hero *this frame*, and paints a figure into that box through a
scissored viewport. The `img` inside `.k-fig` is simply hidden.

It follows that a walk between rows, a drag, or the forward lean on a play moves
the 3D figure too — for free, and in perfect sync — because the figure's
position **is** the element's box, read fresh every frame. There is no second
copy of the layout to keep true. The suite checks exactly that: move the
element, and the ink lands at the new box.

Two things the swap would have quietly deleted, both put back:

- **The row ladder.** FRONT/MID/BACK was sold by a CSS filter on the hero's
  `img` — saturate and brighten at the front, wash out at the back. Hiding that
  img would have removed the strongest depth cue on the board, so the ladder is
  a shader uniform now, read off the same row class.
- **The contact shadow**, which stays 2D and stays welcome: a real projected
  shadow costs a second render pass per hero for something the painted ellipse
  already sells.

### The model arrived with no animation

Its one clip is 0.3 s long and holds a *single keyframe per channel* — a bind
pose wearing an animation's name. What it does have is a 24-bone skeleton with
**Mixamo names**, which means poses can be written against it by hand and, later,
that Mixamo's library retargets onto it without a rename.

So the clips are **data, not baked curves**: a bone name and a few keys of euler
rotation in degrees. Thirty lines instead of a megabyte, timing tuned to the
combat beats rather than the other way round, and — because `actionKind()` has
returned `heal / cast / slash / ward` since Build 36 — wiring that is a lookup
by a name the fight already uses rather than a second table that drifts.

Eight clips: `idle`, `slash`, `cast`, `ward`, `heal`, `hurt`, `parry`, `down`.

**Idle is the one that matters.** A turn-based fight spends almost all of its
time with nobody acting, and a still 3D figure reads as a *broken* 3D figure
where a still painting reads as a painting. So: breathing, a slow weight shift,
arm drift — on long unequal periods, with a randomised starting phase, so three
figures never fall into lockstep. That is a check too.

### The bind pose is a T-pose

Every clip is written as an offset from rest, so without a correction the party
stood on the battlefield with their arms straight out for the entire fight,
gently breathing. A **stance** is folded into rest once at load — arms down,
elbows soft, weight settled — and it is applied to every bone immediately, not
only to the ones some clip happens to mention.

### Four bugs that all looked like art problems

Worth naming together, because they share a shape: the figure was wrong on
screen and nothing in the code was obviously wrong.

1. **A raw `ShaderMaterial` silently dropped skinning.** The model rendered its
   bind pose. Patching the *stock* material instead keeps the skinning chunks.
2. **`Object3D.clone()` hands every copy the original's skeleton**, so three
   figures shared one pose. `SkeletonUtils.clone` is the one that rebinds.
3. **A view-space normal dotted against a world-space eye vector** turned the
   whole figure black. Both vectors come from three in view space; use those.
4. **`setViewport` applies the pixel ratio itself.** Pre-multiplying scaled every
   offset twice and rendered the party off the top-right corner of the canvas —
   indistinguishable from "the layer draws nothing" without a pixel dump.

And a fifth that was mine and in the instrument: **a WebGL canvas is empty by
the time anyone else looks at it.** Reading it cold reported that a layer which
was painting fine painted nothing. `preserveDrawingBuffer` costs real
performance on a phone and is not worth paying for a test, so the layer hands
out a snapshot taken *inside* the frame that drew it.

### One measurement that changed the shipping code

The suite's first attempt slept a fixed 900 ms and asked whether a 0.46 s clip
had finished. It had not — and the reason was not the clip. Headless advances
animation at about **a third of real time**, and the frame delta was clamped at
0.05 s, which *drops* the excess rather than deferring it. That clamp exists to
stop a restored background tab teleporting the party; at 0.05 it also ate time
on any device running below 20 fps, so clips would play in slow motion and, far
worse, drift out of step with the combat beats they exist to match. It is 0.25 s
now. The check waits for the clip to end instead of guessing how long that takes.

### What it costs

| | |
|---|---|
| Model | 7.0 MB → **678 KB** — 58,848 → 12,946 tris, 2048² PNG → 1024² webp |
| Library | three.js r160 minified + GLTFLoader, vendored |
| Runtime decoder | **none** — quantisation only, so nothing to load and run |

The decimated model is indistinguishable from the original at the size a hero
actually gets. No GPU timing is claimed here: this container renders in
software, and an fps number measured on SwiftShader would be fiction.

### What it does not do yet

The foes are still painted plates — only the party is dimensional, so a fight
is currently half one thing and half the other. Faces are voids and hands are
hidden in sleeves, which is what AI-generated 3D is good and bad at; portraits
and cutscenes should stay 2D. And all three heroes wear one model, told apart by
palette, height and standing angle — which is the experiment, not a shrug: if
the watercolour treatment can make three copies of one figure read as three
people, it can carry three different figures into one party.

flow 257/257 · road 94/94 · bond 76/76 · slice 85/85 · line 32/32 ·
camp 48/48 · music 22/22 · beat 10/10 · **cast 20/20** · soak 5/5 across ten runs — no page errors.

## Build 113 — tune the party, and hand over the dials

Build 112 shipped the cast layer with a look I had chosen by editing constants
and comparing screenshots taken a minute apart. That is a look chosen by
argument. Two changes make it a look chosen by looking.

### The original texture, back

The pipeline downsized the map to 1024² on the way in. At the size a hero gets
that is nearly invisible — but "nearly" is doing work, and the party read as
flat colour silhouettes, so the resolution was worth ruling out rather than
assuming about. **2048², webp at q95: the model goes 678 KB → 1.6 MB.**

It was not the resolution. The flattening was the wash: three bands quantising
luminance with nothing mixed back, so a robe painted with a hundred folds
arrived as three flat shapes. The wash is a **dial** now — `wash` decides how
much of the real painting survives the brush — and at 0.55 with five bands the
folds, the belt, the sash and the hem tatters all come back. The full-resolution
map is the right call anyway now that there is detail to resolve.

### Six dials, and a panel to move them

`?cast=3d&tune=1` puts the look on screen: **washes** (how many flat tones),
**flatten** (how much painting the wash eats), **paper** (how far blacks lift —
watercolour has no true black), **pooling** (pigment gathering at the
silhouette, the signature move), **tooth** (paper grain), **distance** (how hard
the back ranks wash out). Plus a button per clip, and a line of JSON to copy
back.

It starts as a tab, not a panel. Two hundred pixels of debug furniture parked
over the party HUD would make the build it ships in unplayable, which defeats
the point of putting it in a build you are meant to play.

The defaults moved with it: 5 washes, flatten 0.55, paper 0.36, pooling 0.78,
tooth 0.16, distance 0.78.

### Playable

`https://keeterly.github.io/Triad/v2.3/index.html?cast=3d` — and `&tune=1` for
the dials. Pages deploys from `main` on push, so it is the same build this
entry describes.

flow 257/257 · road 94/94 · bond 76/76 · slice 85/85 · line 32/32 ·
camp 48/48 · music 22/22 · beat 10/10 · **cast 23/23** — no page errors.

(slice reports 80–85 depending on the run: which stop each conversation lands
on moves with the fight outcomes, so the loop that walks them runs a different
number of times. Same checks, same kinds, no failure — logged, not chased.)

## Build 114 — the party are themselves now

Build 112 put one generated robed figure on the stage three times, told apart by
palette, and asked whether the watercolour treatment could hold three
separately-generated models together. It could. So this replaces the stand-in:
**Ash, Elin and Mira are their own models, generated from the concept art that
has been on their cards since Build 4**, and they move with real motion instead
of eight hand-written poses.

Ash keeps his longsword. Elin keeps her cross-topped staff. Both survived into
the mesh, which matters more than it sounds — the weapon is most of the
silhouette at 145 pixels tall.

### One rig, one library, three characters

The thing that made the animation affordable is that **Meshy's humanoid
auto-rig is standardised**. All three characters came back with the same 24
joints, in the same order, under the same names — so a clip authored against
one of them drives all three, and the library is generated **once** instead of
three times. An `AnimationClip` addresses its tracks by node name, so
retargeting here is not a step at all; it is simply what happens.

Ten clips, chosen against the verbs the fight already speaks:

| verb | clip | who |
|---|---|---|
| idle | `Combat_Stance` | everyone |
| slash | `Sword_Judgment` · `Attack` · `Double_Combo_Attack` | Ash · Elin · Mira |
| cast | `Charged_Spell_Cast` | everyone |
| heal | `mage_soell_cast` | everyone |
| ward | `Block1` | everyone |
| parry | `Sword_Parry` | everyone |
| hurt | `Hit_Reaction` | everyone |
| down | `Knock_Down` | everyone |

`slash` is the one that forks, because a longsword, a staff and a pair of
daggers are three different fights. Everything else is shared, which is exactly
what makes one library enough.

### The clip mill

Meshy returns an animation the only way it can: as a whole character. Ten clips
arrived as ten ~6 MB GLBs, each carrying the same mesh and the same 5 MB texture
around the curves we actually wanted — 62 MB to ship a few hundred kilobytes of
motion. `v2.3/tools/clips.cjs` loads each one in the same headless Chromium the
suites use, takes the `AnimationClip` out, throws the mesh and the texture away,
drops the scale tracks a rig nothing scales does not need, rounds to four
decimals, and writes **one 685 KB JSON file**. It also renames each clip to the
verb the fight speaks, so the game never has to know a parry arrived as
`Armature|Sword_Parry|baselayer`.

### Two things real clips broke that hand-written poses never could

**The clips travel.** A sword judgment steps into the blow; a knock-down falls
over backwards. Right in a vacuum, wrong in a box — the camera here is nailed to
the origin, so a figure that walks forward walks out of frame. The hips are
pinned in the horizontal plane now and left free in the vertical, which keeps
the crouch and the fall and throws away the travel.

**Every model comes back a different size.** And the frame for each one had to
be found by LOOKING, after two attempts at computing it failed in different
ways. `Box3.setFromObject` on a SkinnedMesh reports the authored geometry box —
it made Elin 0.75 m tall standing next to a head bone at 1.35, and zoomed the
camera into everybody's ribs. Measuring bone-to-bone then needs fudge factors
for the sole below the toe bone and the hood above the crown, and they are
different per character. So each figure is rendered once at load into a small
offscreen target, its silhouette read out of the alpha channel, and the camera
solved from that. One frame at startup, no constant tuned per model, and it will
keep working for whatever the generator hands over next.

### What it cost

**212 of 267 Higgsfield credits.** Three rigged, textured characters at 44 each
(132), and ten animation clips at 8 each (80) generated once on one rig. Doing
the clips per character would have been 192 and would not have fitted.

The gate was deliberate: Ash alone first, at 44 credits, so a bad rig or a lost
sword cost one character rather than three.

| | |
|---|---|
| Characters | 31k → 17.6k tris each, 2048² webp · **2.2 / 2.4 / 1.8 MB** |
| Clip library | 685 KB of JSON, shared by all three |
| three.js | vendored, unchanged |

That is ~7 MB of cast on a first load, and it is the one number here worth
arguing about: 1024² textures would halve it and, measured at 145 px tall in
Build 113, looked identical. The 2048s are in because they were asked for.

flow 257/257 · road 94/94 · bond 76/76 · line 32/32 · camp 48/48 ·
music 22/22 · beat 10/10 · slice 85/85 · **cast 25/25** — no page errors.

## Build 115 — facing the right way, in their own colours

Two notes from the first play of Build 114, and both were right.

### They were fighting with their backs turned

The foe stands on the right of this stage and always has. The party arrived from
the generator facing the camera, and the `turn` values were carried over from a
stand-in model with a different base orientation — so three characters stood on
a battlefield showing the Revenant their shoulder blades.

Which way is "toward the enemy" depends entirely on which way the generator
happened to point the model, so the angle was found by rotating one of them
through a full circle and looking at the frames, not by reasoning about sign
conventions. **About −68°** puts the sword out toward the foe and still leaves
enough of the face turned to camera to read as a person rather than a shoulder.
The three differ a little so the line does not look stamped.

There is a check for it now. Nothing would have caught this: every other thing
about those figures was correct.

### The watercolour is off

The treatment was built in Build 112 for a stand-in whose texture was a grey
photogrammetry mush that needed the help. These three are painted from the
concept art, and **their own colour is the thing worth showing** — Ash's
blue-grey cloak over the red sash, Elin's bone-white, Mira's violet under black.
A wash over that is a filter on top of art that already works.

So `paint` is a dial, and it is **0**. Every line of the shader is still there
and still reachable from the panel, because it is thirty lines and it may earn
its place in a memory or a reckoning, where the stage should look remembered
rather than lived in.

Two things did not move with it. **The row ladder is not part of the
treatment** — back ranks lose saturation and sit down in value whatever the
paint is doing, because FRONT/MID/BACK is something the player has to read, not
a mood. And **the light came back up**: Build 112 flattened it because a paper
doll is lit like paper, and that same flat ambient turns a painted cloak into a
sticker once the wash is gone. A key from the front-right and a cool rim from
behind put the folds back.

flow 257/257 · road 94/94 · bond 76/76 · slice 85/85 · line 32/32 ·
camp 48/48 · music 22/22 · beat 10/10 · **cast 26/26** — no page errors.

## Build 116 — the facing is computed, not chosen

Build 115 claimed to have turned the party toward the enemy. It had not. They
were still fighting with their backs to the Revenant, and the check I wrote to
prevent exactly that **passed**, because it asserted the number in the table
rather than the direction of the body.

Both mistakes have the same root, and it is worth naming.

### An angle set against the bind pose cannot control facing

A generated model faces wherever the generator pointed it, which is already
unknowable in advance. But on top of that, **the idle clip carries its own
rotation** — `Combat_Stance` turns the body about fifty degrees all by itself.
So a static `turn` applied at load is overwritten by the animation a frame
later. Every value I picked by eye was measuring a body the clip had already
moved.

So the layer **measures** now. The line from the left shoulder to the right one
is the lateral axis; crossing it with up gives the direction the chest points.
Take that reading *after the mixer has posed the figure* — the only moment it
means anything — and turning to face the foe is arithmetic:

```
d = wanted − measured;  root.rotation.y += d
```

`turn` survives as a fine adjustment on top: how far back toward the camera each
of them is pulled from square-on, so they read as people rather than shoulders.
Acting clips still turn the body, and that is wanted — a swing should wind up
and follow through. Only the resting heading is pinned.

### The check read the dial, so the dial is what it protected

`FACING: every one of them is turned toward the foe's side of the board` asserted
`turn` was between −35 and −110. The value was −68. The check passed. The party
fought backwards for a build.

It reads `_facing()` now — the live forward vector off the posed skeleton — and
asserts two things a number in a table cannot fake: the chest points at the +X
side of the stage where every foe in this game has stood since Build 4, and it
is not square-on, so the party still reads at three-quarters rather than as
three cut-outs in profile.

Measured: Ash 64°, Elin 56°, Mira 68°, where 0 looks at the camera and 90 looks
straight at the foe.

flow 257/257 · road 94/94 · bond 76/76 · slice 85/85 · line 32/32 ·
camp 48/48 · music 22/22 · beat 10/10 · **cast 27/27** — no page errors.

## Build 117 — the clips were wearing somebody else's skeleton

The party looked disfigured: heads folded into shoulders, Elin a shapeless bag
of cloth, arms stretched to proportions nobody drew. The first guess — bad
auto-rigging — was wrong, and the test that settled it was cheap: **stop every
mixer and look at the bind pose.** All three are perfect there. Elin's hood and
staff, Mira's cloak, Ash's sword. The models are good. The animation was
breaking them.

### Nothing is canonical

Every Meshy generation lands on **its own bind pose**. Not the same skeleton in
a different pose — genuinely different rest orientations, same 24 names, same
hierarchy. Ash, Elin and Mira differ from each other by more than a radian at
the wrist, and all three differ from the rig the clips were recorded on, because
`meshy_rigging` re-rigs whatever you hand it.

Three things had to be fixed, and each looked identical on screen.

**1 · The retarget has to happen in model space.** A first attempt did it per
bone in local space — `rest_t · rest_s⁻¹ · q` — which is only exact when the two
rigs' *parents* already agree. It fixed Ash and Mira most of the way and left
Elin collapsed. What is actually invariant between two skeletons is where a bone
points **in the world** relative to where it rested:

```
D(b)   = A_s(b) · G_s(b)⁻¹        the source bone's global departure from rest
A_t(b) = D(b) · G_t(b)            the same departure, on the target
q_t(b) = A_t(parent)⁻¹ · A_t(b)   back to a local rotation
```

That needs the whole pose at once rather than one track at a time, so each clip
is resampled onto a common timeline first, and the library ships the source rig's
rest pose *and* its parent map.

**2 · Only the root may translate.** A clip carries a position track for every
joint, and each one writes the source rig's bone offsets onto the target —
overwriting each character's own **bone lengths**, sixty times a second, with
somebody else's. That was most of what "disfigured" looked like. A humanoid clip
translates the hips; every other joint keeps the length the model was built with.

**3 · Normalise after every composition.** A quaternion that drifts off the unit
sphere is a rotation with a scale baked into it, and this walks a chain of them
twelve deep, twice, per frame per clip.

### And the check that found it was wrong twice

The new check asserts bone lengths hold through every verb — the one invariant a
bad retarget cannot satisfy. Its first version **guessed the pairs**
(`Hips→Spine`, `neck→Head`) and several of those are two or three joints apart in
this rig, where the distance legitimately changes the moment anything between
them bends. It reported 7% "stretch" on correct animation. A bone's length is the
distance to *its own parent*, read off the real hierarchy, and that is the only
distance a rotation cannot alter. **Now: 23 bones per character, 0.00% drift.**

The facing check had the same disease in miniature: it read the body mid-fade out
of a knock-down and reported Mira at 124°. Facing is a property of the resting
stance — acting clips turn the body on purpose — so it settles first now.

flow 257/257 · road 94/94 · bond 76/76 · slice 85/85 · line 32/32 ·
camp 48/48 · music 22/22 · beat 10/10 · **cast 28/28** — no page errors.

## Build 129 — a blow being aimed is a blow half-thrown

"Holding a card while choosing a target should have the character ready their
attack, with letting go finishing out the action."

### The ready pose is not a separate animation

That is the whole design, and everything good about it follows from that one
decision. It is **the first third of the swing, stopped.**

The obvious build is a `ready` clip and a `strike` clip: wind up into one, hold
it, then cross-fade into the other when the player lets go. That needs a blend
at exactly the worst moment — the release, the thing the player is waiting for —
and Build 125 spent a whole build establishing that blending a held pose against
a moving one is where this rig throws the hips eighty degrees in a 240th of a
second.

Holding one clip halfway through has no blend in it at all. The hold and the
follow-through are the same animation played in two halves, so a release cannot
pop no matter how long the player deliberated over it.

### It has to breathe

A wind-up perfectly still for four seconds while somebody thinks reads as a
crash, not as tension. The obvious fix — put the idle back underneath at a
whisper — is exactly the near-antipodal blend Build 125 removed.

So the tension comes from **inside the same clip**: the action's own time
strains a few hundredths of a second either side of the mark. Measured, that is
about 15 mm of travel at the wrist over half a second — a body straining against
a held pose — and it cannot pop, because there is still only ever one clip
posing the figure.

### Nothing at the call site changed

The fight has said `castPlay(hero, 'slash')` when a card resolves since Build 36,
and it still does. If that hero happens to be standing there holding the first
third of exactly that swing, `play` continues it instead of starting a second
one.

The alternative was to teach the resolve path about aiming, which puts the
ready/release pairing in two places that have to agree — the kind of thing that
is correct on the day and wrong three builds later.

### Every way a drag can end

A hero left standing at the top of a backswing for the rest of the turn is worse
than no feature. There are more ways out of a drag than there look to be: dropped
on the hand, dropped on nothing, dropped on something it cannot legally hit,
refused for AP, the card detached by a re-render mid-gesture, a pointercancel
from the browser. `dropCommit` returning false covers most of them and `abandon`
covers the rest.

And then the hold unwinds by itself after eight seconds anyway, because "every
path calls unready" is precisely the kind of promise that holds until somebody
adds a ninth path.

### A restart is a trip to zero, not a wobble

The check for "dragging across a second target must not restart the wind-up"
failed a working hold, and the reason is the feature above. Comparing two samples
of a **breathing** hold cannot detect a restart: the tension moves the clip's
time by ±42 ms, so any threshold small enough to catch a restart is smaller than
the breath. `play` resets to zero, so that is what to look for.

flow 257/257 · road 94/94 · slice 80/80 · bond 76/76 · **cast 76/76** ·
camp 48/48 · line 32/32 · music 22/22 · beat 10/10 — no page errors.

---

## Build 128 — a creature burns away, and the instrument keeps lying

"When a monster dies, it should disperse by first burning away and its body
crumbling into ash and then flying off into the air."

The body keeps animating the whole way through, which is the point: a figure
that freezes and then dissolves is a sprite being switched off, and one that is
still falling as it comes apart is dying. The `down` clip goes on playing under
the tear.

### The front is a height plus noise, not an alpha ramp

A ramp dissolves a figure like a cross-fade — every part of it going at once,
which reads as a texture problem rather than as a death. Threshold a noise field
against a rising line and the body **tears** instead: thin extremities go first,
the mass of the torso holds on, and the edge is different every time because the
noise is sampled in the model's own space. The band immediately ahead of the
front burns white before it goes, and ash comes off that same band — a thin
strip at the height the shader is actually discarding, so what leaves the body
leaves from where the body is coming apart.

Everything else in the effects file falls. Sparks off a blade have weight, embers
settle, the floor stops them. Ash does not: it is what is left when the weight
has burned out of something, so it drifts with a small negative gravity and keeps
going.

### Two guesses about a number no model agrees on

The front travels up the figure, so it needs to know where the figure starts and
how tall it is **in the model's own units**. Both were guessed, and both were
wrong:

- **A constant 1.85.** Meshy returns whatever scale it feels like and every
  figure is rescaled at the root afterwards. The Regent's local height is 2.0.
- **Feet at zero.** Some of these models are built around the hips, so
  `transformed.y` runs *negative* through the legs. Clamped to zero, the entire
  lower body discarded the instant the front left the floor and the rest went
  with it — the whole Regent gone at a quarter of the burn.

Measured off the geometry's own bounding box: `foot = -1`, `tall = 2`. That box
is famously the wrong tool for asking how tall a character stands in the world —
Build 119 learned that the hard way — and exactly the right tool for asking what
range `transformed` covers, because that is literally what it is a box around.

### Weighing a picture is not counting a body

The first instrument screenshotted the creature's rectangle and compared PNG
sizes. It lied in both directions:

- A burning body adds a white-hot tear that costs **more** bytes than the body
  it is eating. At burn 0.25 it reported 224% of a whole Regent.
- A solid body hides an arcade, sixty pieces of rubble and their reflections, so
  a whole Regent can compress **smaller** than the empty plaza behind her.

The proxy was not even monotonic. `_cover` renders the figure alone into a small
target and counts the pixels it covers — what `fit` has done since Build 112 —
and the profile came out **100 → 98 → 64 → 31 → 3 → 0%**.

Its first control was broken too: hiding the body with `root.visible = false`
lasts exactly one frame, because the loop decides visibility fresh every tick
from who is on screen.

### The list of things that are not bodies

Two places render one figure alone and read the pixels back, and both are only
correct if nothing else in the scene is drawing. **That list has now been got
wrong three times in three builds.** Build 122 added an arcade, rubble and mist,
and moved the Regent a quarter of a metre. Build 127 added a spark pool, a ribbon
per figure and five shock rings — and a ring fired at the Regent a moment earlier
put 73 pixels of "body" back into a finished burn.

The pattern is not carelessness. The list lived inside the function that used it,
so adding scenery anywhere else could not remind anybody. It is derived from the
scene now, in one place, and both readers ask for it.

### And a figure that was measured badly said nothing about it

The Ashen Cultist stood **0.72 m above the floor** in one suite run and 0.06 in
the next, from the same model on the same seed. `fit` recovers from a frame that
came back empty by doubling its guess and trying again — sensible, except that it
then returned whatever it last had whether or not that converged, so a
measurement that failed was indistinguishable from one that succeeded and the
figure was scaled and dropped by it regardless.

It checks now, retries once from a clean guess, and reports `unfit` in the state
if it still could not settle. A floating body is worth a loud number.

flow 257/257 · road 94/94 · slice 85/85 · bond 76/76 · **cast 71/71** ·
camp 48/48 · line 32/32 · music 22/22 · beat 10/10.

`beat` came back 6/10 on the back-to-back run of all eight and 10/10 three times
running on its own. It is the timing suite — it measures how many milliseconds a
card takes to answer a finger — and it was the eighth browser launched in a row.
The argument that settles it is not the re-runs: **`beat` boots `?cast=2d`, where
not one line of this build executes.** No burn shader, no particles, no effects
layer. A suite that cannot reach the code cannot be regressed by it.

---

## Build 127 — the effects move into the world

"Right now it's just a circle punch and lame slash."

Both descriptions were literal. `shockRing` built a `<div>`, gave it a CSS class
and grew its width; a swing was a keyframe animation on the sprite. Neither was
badly made — they were made for a game that was a painting, and they stopped
being right the moment there was a world underneath them.

### What was actually wrong with a div

Not that it looked cheap. That it was **on the wrong layer**, and every symptom
followed from that one fact:

- It could not be occluded by the body it happened to, because it was drawn
  after everything.
- It did not move when the camera did — and as of Build 126 the camera moves
  through the whole beat.
- It was the same size whether the hit landed two metres away or nine, because
  a CSS pixel does not know about distance.
- It never touched the water. The plaza has been flooded since Build 122 and the
  reflection pass renders **the scene**; an effect outside the scene simply is
  not in the reflection.

So the effects move into the scene. Same camera, same depth buffer, same mirror
pass — a spark thrown behind the Regent goes behind the Regent, and the floor
picks all of it up for nothing.

### Nothing is fetched

Three textures, drawn on a canvas at load, the way the floor has been since
Build 122: a **mote** (soft, and bitten at the edge with a dozen erase-arcs so a
hundred of them don't read as a hundred identical circles), a **streak**, and the
**slash edge** — a horizontal heat ramp times a vertical falloff, chewed with a
couple of octaves of cheap value noise. That last one is the whole job: a weapon
trail with a clean gradient reads as a plastic swoosh, and what makes it a slash
is that the edge is *torn*.

The palette is the game's own — bone white at the core, through the gold the
KIZUNA bar and every combo already use, out to the ash grey the bestiary is
painted in. A sword in this world throws embers and ink, not neon.

### The slash is the path the weapon actually took

This is the part that cannot be faked with a sprite. A slash is not a picture of
an arc, it is the surface a blade swept through the air — so the trail is built
from the hand bone's **real world position**, sampled every frame while the
swing plays, and the mesh is the ruled surface between the wrist and a point out
along the forearm.

It costs nothing extra to be correct: the bone is already being posed sixty times
a second by an animation the fight chose, so the arc is automatically the arc
*that character* makes with *that weapon*. Ash's longsword and Mira's daggers
need no separate art; they have separate arms.

Measured at a fixed 60 Hz — because a trail's length is a function of frame rate
and this harness rasterises in software at about two frames a second, so watching
the real loop would have measured Chromium — the blade tip sweeps **5.6 metres of
world** across a swing, over 22 samples.

### Sparks are one pool and one draw call

900 points in a geometry allocated once and never grown; a burst finds dead slots
and refills them. Size falls off with distance the way a lens does, so a spark
thrown toward the camera **grows**. Colour rides hot → gold → ash across a
particle's life, because an ember *cools* rather than just fading, and it flickers
because a tumbling ember does. Additive with depth-write off: sparks must be
occluded by bodies and must never occlude each other, or a burst becomes a mosaic
of squares.

### Three bugs, and the third was not in this build

**The arc started a frame late, every time.** The ribbon was looked up at the top
of the trail function — before the code that creates it — so on the first frame
of a swing the sample just taken was never stepped into the mesh.

**A slow machine drew no arc at all.** The mesh required three samples before it
would show. Any frame rate low enough to take fewer than three during a swing got
nothing — and the machines that draw slowest are exactly the ones already
struggling to sell the hit. Two samples is a quad, and a quad is a slash.

**And `enable()` was rebuilding the world.** `disable()` stops the loop and hides
the canvas; it does not throw anything away. `enable()` did not know that, so
every re-enable built a second canvas, a second renderer, a second scene and
reloaded every model, while the first was still in the DOM. Nothing looked wrong
— the new world is identical — so it has been happening quietly since Build 125,
when the smoothness check first started toggling the layer.

What found it was an effect. A check fired an impact immediately after a
re-enable and measured **zero** sparks, because the sparks went into the scene it
had just replaced. A bug that produces an identical picture is invisible until
something has to persist across it.

### And the 2D ring stays

`?cast=2d` still gets its circle. It was never wrong for a painting, and it is
still the right answer on a machine that cannot draw the other thing.

flow 257/257 · road 94/94 · slice 80/80 · bond 76/76 · **cast 69/69** ·
camp 48/48 · line 32/32 · music 22/22 · beat 10/10 — no page errors.

The eight logic suites boot `?cast=2d`, so a green run there is also the check
that the painted stage still gets its circle.

---

## Build 126 — a shot becomes a move

A screenshot of a parry in progress: three figures the same size, in profile,
evenly spaced, level with the lens, all standing still on a dimmed board. It
reads as a lineup rather than a clash — and the source said so itself, in a
comment at the call site that had been sitting there since Build 22:

    camParryOpen();      // one composition, held for the whole bar

### Every shot was a destination

`SHOTS` gave the camera five numbers — azimuth, distance, height, aim height,
and what to point at — and the tripod eased toward them and **stopped**. On a
phase that is correct: the board is a thing to be read, and a camera drifting
under a hand of cards is a camera in the way.

On the parry it is exactly wrong. The parry is the one screen where the player
has to *act*, and the frame had finished moving before the bar even started.

So a shot may now carry `to` — a second pose — and `over`, the milliseconds it
takes to travel there. The tripod no longer chases a fixed mark but a point
sliding between two of them, which means the camera is still moving when the
beat lands rather than parked and waiting for it. The travel is smoothstepped:
a camera that starts at full speed reads as a glitch.

Two fields came with it, both of which an operator would call basic and this rig
simply did not have:

- **`roll`** — the cant. It existed only as a CSS handheld offset, so a *shot*
  could not be composed with one. Every shot in the game had a level horizon,
  and a level horizon is a calm one.
- **`fov`** — the lens. `toScreen` reads the live projection matrix, so the DOM
  followers track a lens change for free and nothing has to be told. This is the
  one that fixes the screenshot: a wide lens up close is the whole difference
  between three people standing at different distances and three people at
  different **sizes**, which is what depth actually reads as.

### The parry, specifically

It was `az -13, dist 5.10, height 1.42` — thirteen degrees off dead centre and
twenty-eight centimetres below eye line. The home shot with a nudge.

It now opens at **az -36, dist 4.40, height 0.98, roll -6°, 58° lens**: wide of
the line and low enough that the party's shoulders are above the lens, so
whatever is swinging at them comes *down* into frame. Over the next 3.2 seconds
it arcs back toward the axis, rises, pushes in to 3.85 m, and unwinds the cant to
nearly level — so the frame settles exactly as the player has to read it.

What it deliberately does **not** do is whip. This is a rhythm defence. Dynamism
here means the frame is alive, not that it is hard to read.

`strike`, `fell`, `snap`, `allout` and `reckoning` got the same treatment —
`fell` arcs round the creature for nearly two seconds as it goes down, and
`reckoning` is a four-second crane rather than a cut to a wide. `home` stays
dead still, on purpose.

### Measuring "dynamic"

The property is not *the camera is somewhere different*. It is that the camera
is **still travelling while the beat is happening** — so the suite samples the
eye against a real clock and asks for metres per second.

The first version of the check failed a working camera, and the reason is worth
keeping. It compared the parry against `home` over the same wall-clock window,
but `home` was issued straight after the parry, so its "window" was mostly the
journey *back* from the parry's mark: 0.26 m/s of travel that says nothing about
whether a stance moves once it is standing. **The control has to be the same
state, not the same stopwatch.** Each shot now gets 1500 ms to walk to its mark
and is only then timed.

| | m/s once standing on the mark |
|---|---|
| parry | **0.665** |
| home | 0.005 |

Timestamps matter more than they look here too: a round trip through `evaluate`
in a software-rendered page takes far longer than a sleep asks for, and counting
samples as though they were milliseconds put "after the move" inside the window
and reported a live camera as parked.

flow 257/257 · road 94/94 · **cast 66/66** · bond 76/76 · slice 75/75 ·
camp 48/48 · line 32/32 · music 22/22 · beat 10/10.

Two honest notes on that line. `bond` reported one page error on the back-to-back
run and none on its own — the image-decode-under-load flake this suite has thrown
since Build 58, not a regression. And `slice` has now reported 75, 80 and 85
checks on three runs of a fixed seed, which is open item #78 and still nobody's
finest hour: a suite whose check COUNT moves is a suite that could drop a failing
check without saying so.

---

## Build 125 — the jitter was three snaps, and none of them were in the animation

"Animations need to be smoother and actually read well. They are sloppy and
jittery right now."

The tempting reading is that the clips are undersampled — they are baked at 30
keys a second and a sword swing is fast. Raising `RESAMPLE_FPS` is a one-line
change and it would have felt like a fix. It does nothing, and the measurement
says so twice.

### Measuring motion without measuring the frame rate

"Jittery" is a claim about the clip. Watching the animation run in a harness
that rasterises in software at two frames a second measures the harness, and
reading the keyframes measures the data rather than what the mixer does with it.

So: switch the layer off so nothing else touches the mixer, drive one figure's
mixer **by hand at a fixed 240 Hz**, and read a bone's angular acceleration. The
timestep is constant by construction, so nothing in the number comes from how
fast the page draws. Smooth motion accelerates smoothly; a pose that snaps shows
up as one spike two samples wide, hundreds of times the surrounding values.

Six acting verbs, six spikes, **peaks of 145 to 592 rad/s²** — and every one of
them landed on the clip's own beat:

| verb | spike at | the clip's beat |
|---|---|---|
| parry | 0.650 s | 0.66 |
| hurt | 0.650 s | 0.66 |
| ward | 1.042 s | 1.05 |
| heal | 1.092 s | 1.10 |
| slash | 1.142 s | 1.15 |
| cast | 1.192 s | 1.20 |

Six for six. **Nothing was wrong in the middle of any animation.** The jitter was
the animation *ending*.

### Three snaps, peeled one at a time

**One — the action stopped contributing the instant it finished.** A LoopOnce
action without `clampWhenFinished` is disabled by three.js the moment it reaches
its end: full contribution to none between two frames. `clear()` calls
`fadeOut(0.22)` a beat later, which reads like a crossfade in the source and is
not one, because by the time it runs there is nothing left to fade. Clamping
holds the final pose so the fade has something to blend out of. Peaks fell 4–5×.

**Two — the idle's weight was a step, not a ramp.** With the pose held, the idle
underneath still went from a whisper to full strength in a single frame — a
two-and-a-half-fold jump in what the body is being blended toward. Fading the
action out over 0.22 s while snapping the idle in is not a crossfade, it is two
cuts that happen to overlap. The idle's weight is now walked by `step()` at the
speed of the fade it is answering. Five of the six verbs went clean: cast 592 →
15, ward 478 → 12, parry 290 → 7.

**Three — and the survivor was the most interesting.** One spike remained, on the
sword, and it was not at the end of the clip. The probe named the joint: the
Hips, moving **80° in a 240th of a second** at clip time 0.74, with every weight
in the mixer steady.

The keyframes were innocent. Baked at 30 Hz the worst step between adjacent keys
was 31.7°; baked at 120 Hz it was 8.3° — exactly a quarter, which is what a
faithful resampling of a smooth curve looks like. The data was fine at every
rate, and the spike did not move.

So the experiment was to take the idle out from underneath and play the sword
alone. The same instant is smooth. **The clip was never the problem — the blend
was.** A standing idle under a lunging swing puts the two Hips rotations
near-antipodal, and a weighted blend between near-antipodal quaternions is
unstable: the shortest arc between them flips as they pass 180°, and the result
jumps to a rotation eighty degrees away.

The fix is the same one the brief asked for in different words. **The idle now
gets out of the way entirely while an action plays.** It was there at a quarter
weight to keep held poses breathing; it cost more than it bought twice over,
because a quarter of a standing pose smeared over every swing is exactly what
"the actions don't read" is made of. An action is a statement, and averaging it
with someone standing still softens the one thing it was for.

| verb | Build 124 | Build 125 |
|---|---|---|
| slash | 362.0 | 10.3 |
| cast | 592.3 | 14.2 |
| ward | 478.1 | 12.8 |
| heal | 145.4 | 7.3 |
| parry | 290.4 | 7.1 |
| hurt | 320.3 | 6.1 |

### And the sample rate, measured twice, stays where it was

The first A/B said 30, 60 and 120 Hz were indistinguishable — but that ran while
the blend flip dominated everything, so it could not have seen a sampling
effect. Re-run with the flip gone, higher rates are **slightly worse** (slash 47
→ 58) and 60 is identical to 120: a finer sampler resolves the true peak of a
fast swing more sharply rather than smoothing anything. The remaining
acceleration is authored motion.

`RESAMPLE_FPS` stays at 30, and quadrupling every baked track for nothing is the
change that did not ship.

flow 257/257 · road 94/94 · slice 85/85 · bond 76/76 · **cast 64/64** ·
camp 48/48 · line 32/32 · music 22/22 · beat 10/10 — no page errors.

---

## Build 124 — the 3D stage is the game

Twelve builds behind `?cast=3d` was the right way to grow a renderer. The
painted stage kept working the whole time, every step could be measured against
it, and nothing that went wrong in the world could break a run. But **a flag
nobody sets is a feature nobody has**, and as of Build 123 there is no longer a
reason to prefer the plates: every creature in the bestiary has a body, the
world has a floor and a horizon, the camera answers the fight, and the party
costs 6.1 MB rather than 16.6.

So the test inverts. `wanted()` is true unless you ask for `?cast=2d`.

### The way back has to be a real route

A default that cannot be turned off is not a default, it is the only option —
and this one has two callers who genuinely need the painting:

- **A machine that cannot draw this.** No WebGL, no GPU, a browser that refuses
  the context.
- **Eight of the nine suites.** flow, road, slice, bond, camp, line, music and
  beat measure *rules* — card costs, road topology, parry windows — and the
  rules cannot tell which stage they are standing on. Booting them into a
  software rasteriser drawing a flooded plaza sixty times a second would buy
  nothing and cost the better part of an hour.

So the harness gives a suite the painted stage unless it asks otherwise, and
`cast.test.cjs` asks. Which leaves a hole exactly where it matters — **the
default path is now the one path nothing exercised** — so the cast suite ends by
opening two more pages in the same browser: one with no cast parameter at all,
one with `?cast=2d`, checking that the first is in the world and the second is
on the paintings. A default nobody tests is how "default" quietly becomes
"only".

### An empty plaza is worse than a painting

This is the change that had to land *before* the flag flipped, and it is the
whole reason the flip is safe.

`enable()` has always returned false on a WebGL failure and left the paintings
alone. What it did not check was whether anybody actually stood up. The world is
**opaque** — floor, horizon, fog, the whole frame — so a page where the models
404 or the network dies mid-load would have built the plaza, taken the stage,
and drawn an empty street where the fight should be. Strictly worse than the 2D
board, and silent.

Behind a flag that is a debugging annoyance. On the default path it is the
difference between a bad network and a broken game.

So the party is now a precondition: if any of the three heroes failed to load,
the whole stage goes back to the paintings, which are coherent on their own. **A
creature is deliberately not covered by this** — it arrives late by design, and
the plate rule has covered that gap by name since Build 118. The asymmetry is
the point: a missing creature is an expected state with a defined appearance, a
missing hero is a broken one.

flow 257/257 · road 94/94 · slice 80/80 · bond 76/76 · **cast 63/63** ·
camp 48/48 · line 32/32 · music 22/22 · beat 10/10 — no page errors.

---

## Build 123 — every creature is a body now, and the party stops waiting for them

Build 118 gave the Mourning Regent a model. Everything since has been about the
world around her. This one finishes the cast: the Hollow Husk, the Ashen
Cultist, the Silent Wraith and the Kneeling Revenant all stand up, on the same
24-joint rig, driven by the same clip library the party has been using since
Build 112. **A creature costs a model and no animation at all** — which was the
whole point of doing the retargeting properly, and this is the build that
collects on it.

### The auto-rigger is not random, it is looking for legs

Four creatures went in with identical parameters and one came back rigged.
The other three had `skins: 0`, `joints: 0`, `nodes: 1` — a single mesh with no
skeleton in it at all, which is a mesh you cannot animate.

The obvious reading is that the auto-rigger is flaky, and the obvious response
is to run it again. Setting `pose_mode: 'a-pose'` and re-rolling recovered the
Kneeling Revenant — a *kneeling* figure, whose legs are in the painting but
folded under it. It did nothing at all for the other two, twice.

So it is worth looking at what was actually being sent:

| | what the painting shows | rigged |
|---|---|---|
| Hollow Husk | upright, two legs, arms clear of the body | ✅ first try |
| Kneeling Revenant | kneeling — legs present, folded | ✅ with `a-pose` |
| Mourning Regent | upright, standing | ✅ (Build 118) |
| **Ashen Cultist** | a hooded robe to the floor with **no legs at all**, arms swallowed by drapery, a staff crossing the entire silhouette | ❌ ×2 |
| **Silent Wraith** | a hunched near-quadruped lunge, trailing a banner of cloth **wider than the body** | ❌ ×2 |

That is not a coin flip. An auto-rigger fits a humanoid skeleton to a
silhouette, and neither of those two silhouettes contains a humanoid: one has no
lower limbs to find, the other is a horizontal shape whose largest feature is a
flag. `a-pose` asks the rigger to *retarget* the skeleton it found. It cannot
invent one.

Which makes the fix an art fix rather than a parameter fix. The tool's own
documentation says so plainly — *"the mesh reproduces only what is in the source
image"* — so each of the two was redrawn as a **rigging reference**: same
character, same palette, same ink-wash rendering, same ornaments, but standing
square to camera with the ankles apart and a gap of background between each arm
and the torso. The Cultist's robe comes up to mid-shin and its staff stands
vertical at its side instead of crossing the frame; the Wraith stands erect and
its banner becomes a cape that hangs straight down. Both rigged first try, 24
joints, same order, same names.

**The painted plates in the game are untouched.** These references exist to be
looked at by a rigger, not by a player.

### The whole cast before the first frame

Five creatures and three heroes was 16.6 MB at the sizes they arrived in,
and Build 122's loader waited on every model in one `Promise.all` before the
layer would admit to being ready. The result was a blank battlefield on a phone
and, in the harness, an eight-second timeout on `__ready` — which is the sort of
failure that reads as a broken layer rather than as arithmetic.

The party is on screen from the first frame of every run. **A creature is on
screen when the fight puts it there** — which is never at load, and for most of
the bestiary never at all, since a run meets two or three of the five. So the
dependency is split:

- `load()` fetches the clip library and the three heroes, and says ready.
- Each creature is fetched by `want(id)` — idempotent, safe to call every frame,
  with in-flight de-duplication.
- `frame()` calls it the moment a DOM element claims a foe id and there is no
  model standing on it. That list empties as models land, so the steady state
  costs an empty loop.
- A warm queue asks for the rest quietly, one at a time, behind the party — so
  in practice the model arrived minutes before the creature did.

It is the same `mount()` either way. **A creature that arrives on frame 4000 is
indistinguishable from one that arrived on frame 1.** That is the property worth
having, and it is what makes the split safe rather than merely faster.

### The bug that only exists once loading is lazy

`fit()` — the pass that measures a figure by rendering it alone and reading the
alpha channel — sets a 192×288 viewport and never put it back. That was
harmless for eleven builds because it ran once, at load, before the first frame,
and `setSize` sets the viewport, so the next frame restored it by accident.

A creature arriving at frame 4000 arrives *between* two frames that both think
the canvas size is unchanged. Nothing calls `setSize`. The entire world would
have drawn into a thumbnail in the bottom-left corner of the screen until the
player resized the window.

It was found by reading the function rather than by watching it happen, which is
the only reason it is not in the shipped build: the warm queue makes the failure
rare and non-deterministic — it needs a model to land on a frame where nothing
else resizes — and a bug that appears in one run in fifty is a bug that ships.

### Textures at four times the size anyone can see

The creatures came back with 2048×2048 albedo maps. A figure is about 150 pixels
tall on a 932-pixel stage, and even at the closest cinematic push-in there is
nothing in a watercolour wash that repays four megatexels. `tools/shrink.cjs`
re-encodes to 1024 WebP:

| creature | raw | shipped |
|---|---|---|
| Hollow Husk | 8.0 MB | 2.90 MB |
| Ashen Cultist | 7.80 MB | 2.52 MB |
| Silent Wraith | 7.35 MB | 2.51 MB |
| Kneeling Revenant | 7.98 MB | 2.60 MB |
| Mourning Regent | — | 2.63 MB |

The cast is 19.2 MB on disk and **6.1 MB before the first frame** — the three
heroes and nothing else. The remaining bulk is geometry, 30,000 triangles
apiece, which is the honest next cut and not one to make by eye.

### What the suite had to stop assuming

Four checks failed on this build, and none of them for anything wrong with the
game.

- **The census** counted the whole cast at `ready`, which is no longer a moment
  when the whole cast exists. It waits on `Cast3D.warm()` now — a promise over
  the real loads, not a sleep — so it still fails honestly if a model never
  arrives, and it fails for that reason rather than for being early. A new
  check states the claim the split actually makes: *ready means the party is
  standing*. That is assertable; "no creature has arrived yet" is a race the
  warm queue would win half the time.
- **Facing** read the foe roster from a snapshot taken fifty checks earlier,
  which classified the two creatures that landed mid-run as heroes and then
  failed them for facing the way a creature faces. It asks who is a foe at the
  moment it measures now.
- **Two plate checks** used `revenant` as their example of *a creature there is
  no model of*, and every creature has one now — so they were asserting that a
  body which exists is not drawn. But the property was never "some creatures
  are unmodelled"; it is that an element gives up its painting **only** to the
  model that belongs on it. They use a name no model answers to, which tests
  exactly that and goes on testing it however much of the bestiary gets built.

flow 257/257 · road 94/94 · slice 80/80 · bond 76/76 · **cast 61/61** ·
camp 48/48 · line 32/32 · music 22/22 · beat 10/10 — no page errors.

---

## Build 122 — the plaza is flooded, and the camera answers the action

**The ask.** *"Refine the battle ground to feel more like my actual world but in
3d"* and *"have cinematic camera respond to specific actions."*

### It read as a stage because two things were missing

Build 120 put the painting where it belonged — the half above the horizon on a
curved panel, the half below it on the ground. What it left was a floor, a
horizon, and **nothing at all between them**, on a plaza that in the painting is
under water.

**The plaza is flooded, and that is the whole look.** Look at
`bg23-plaza-pano` for two seconds and what you are looking at is water: half
the pixels below the horizon are a reflection of the half above it — the arcade,
the lit doorway, the sky. That is exactly why un-projecting that floor into a
texture failed in Build 120, and the same fact says what to do instead. A
reflection is not a texture, so it is not made of one: it is **a second render
of the world from a camera mirrored through the floor plane**, sampled by the
floor at the reflected fragment's own screen position — which is what makes a
reflection follow the eye the way a reflection does.

Three details separate a drowned plaza from a hotel lobby, and all three are one
line each:

- **The water is darker than what it reflects.** It is a puddle on a black
  street, not a looking glass.
- **A perfect mirror is an ice rink.** The lookup is stirred by the floor's own
  texture, read at a different scale so it does not correlate with what is
  under it.
- **Water pools in the low places, and the low places are already painted.** The
  darker the floor's own texture, the more it reflects — so one piece of art
  drives the colour and the wetness, and there is no second map to keep in step.
  At a grazing angle everything is a mirror, which is why a wet street goes
  bright toward the horizon and stays dark at your feet.

**The middle distance.** Every parallax cue in the world was either underfoot or
forty-five metres away; a camera that swings needs something at ten metres to
swing *past*. So the painting's own colonnade is there with depth, its ruined
twin is stumps on the far side, and there is the rubble a collapsed city leaves
in its own square — 83 pieces, seeded so the plaza is the same plaza every time
it loads. None of it is modelled: at ten metres through this much fog a broken
column is a silhouette, and a silhouette is a box. The budget went on there
being enough of them, in the right places.

Two corrections along the way, both worth keeping:

- **The exclusion zone is a corridor, not a footprint.** The first pass kept
  props out of the party's own square and put a two-metre slab four metres
  behind it, where the lens turns it into a shipping container parked between
  Mira and the Regent. It runs the whole depth the camera looks down now, and
  widens with distance the way the frame does.
- **`fit()` was measuring the scenery.** It finds each figure's silhouette by
  rendering it alone and reading the alpha, and it hides the world to do that —
  by a *list of the pieces the world had when it was written*. An arcade, sixty
  pieces of rubble and three sheets of mist all landed inside the silhouette,
  which moved the Regent a quarter of a metre and lifted her twenty pixels from
  nothing but new scenery being in shot.

### A moment may take the camera, but it may not keep it

A phase lasts until the phase changes; an action lasts about a second. Build 120
wired shots to phases, which is the right grain for a stance and much too coarse
for a moment — every card played got the same frame, whether it was a sword
going in or a wound closing.

So a shot asked for with `{ for: ms }` is **transient**: it plays, and when its
time is up the camera returns to whatever the phase had it doing. The stance is
*remembered* rather than re-sent, so an action never has to know what it
interrupted — measured: home → strike is 1.8 m of travel, and the return lands
0.00 m from where it started with the phase's own shot untouched.

| moment | shot | what it does |
|---|---|---|
| a blow lands | `strike` | steps in off the axis so the swing crosses the frame |
| a heal, a ward | `grace` | further back, higher, on the party — a heal is not an impact |
| the killing blow | `fell` | low, close, swung 48° off the line, held while the body falls |
| a clean deflection | `snap` | nearly a cut: in hard, gone before the next note |

A combo takes longer and swings further, because a combo is the thing the deck
is named for. And `snap` fires only on a string read *clean* — a camera that
lunges at every partial parry is a camera that lunges constantly, and the moment
stops meaning anything.

### One silent no-op, two failures

Worth writing down because it is a shape that will recur: a text replacement
without an assertion **silently does nothing** when it does not match. `wet` was
added to the dial list and never to `LOOK`, because the pattern for the second
edit carried values from a build earlier. The consequences did not look related:
the panel reported ten dials against nine settings, and the reflection
contributed nothing at all — because the shader's uniform was `undefined`. Every
splice in this file asserts its match count now.

### What is measured

- **WATER** switches the reflection off and compares the floor. A reflection
  target can exist, be bound, and contribute nothing; the only honest question
  is causal.
- **MIDDLE** counts masonry between six and thirty metres out, and asserts that
  none of it stands in the fight's corridor.
- **MOMENT** is three checks, because there are three ways for a borrowed camera
  to be wrong: it never moves, it never comes back, or it quietly overwrites the
  stance it borrowed from.

**Suites:** flow 257, road 94, bond 76, slice 75, line 32, camp 48, music 22,
beat 10, cast 60 — 674 checks, all green.

**Cost, measured rather than assumed.** Three guesses were wrong before the
numbers were taken. The reflection pass is 24% (1.70 fps to 1.40); the eighty-
three props are free; the mist is 2%. What actually halved the frame rate was
none of them — it was the floor's fragment shader gaining three texture reads
across half the frame, which runs whether the water is on or off. On a phone
GPU that is nothing; the software rasteriser the suites run on feels all of it.

The fix belonged in the harness's appetite, not in the game. The idle sampler
watched eighty frames of a 1.7-second loop — and because the mixer advances by
REAL elapsed time and the harness runs at under two frames a second, each frame
carries up to the dt clamp: a quarter-second of animation. Eighty frames was
fifty seconds of wall clock to watch six cycles' worth of a loop that needs one.
Twenty-four does the same job, and the suite came back from over twenty minutes
to eight.

One more real bug fell out of writing the check: `uWet` was written INSIDE the
block that `wet` gates, so turning the water down to zero skipped the write and
the floor went on reflecting a texture nobody was updating. The setting is
pushed first now; only the expensive half is gated. The check that found it is
the one that switches the water off and compares the floor — 8.32 mean tone
change across 120,000 samples, against 0.03 when the dial did nothing.

---

## Build 121 — the enemy behind the wall, and the pace nobody measured

**The ask.** *"enemies are invisible at the moment"* and *"animation looping and
pace is not natural thought. fix that."* Both were real, both had a number
behind them, and neither had a check.

### The enemy was painted, correctly, behind a wall

Every foe there is no model for went invisible in Build 120. The plate reported
everything a check would ask it:

```
imgOpacity   "1"          plateZ    auto
imgVisible   "visible"    canvasZ   1
plateRect    640, 30, 250×264
```

All true. All beside the point. The canvas has carried `z-index: 1` since Build
112, which was fine for as long as it was **transparent** — the scissored
figures painted where the figures were and the DOM showed through everywhere
else. Build 120 made it opaque, floor to horizon, and a solo foe plate carries
`z-index: auto`. The enemy was behind it.

Zero puts the canvas under everything in that stacking context and changes no
other relationship — the row markers, the nameplates and the foes' own 1/2/3
depth ordering all keep the order they have always had. (The floor marks were
behind the same wall, which is why FRONT / MID / BACK came back at the same
time.)

**And the check that should have caught it read CSS.** `PLATE: a creature there
is no model of keeps its own painting` asserted `opacity === '1'` and passed for
a whole build while the thing was unseeable. *Keeping its painting is not the
same as being on screen.* The new check takes a real screenshot of the enemy's
rectangle, hides the painting, takes another, and asks whether the pixels
changed — with a control pair first, because two shots of a still frame must
come back byte-identical or the comparison proves nothing either way. Nothing
about stacking contexts is consulted or trusted.

Getting that check honest took four attempts, and each failure is a note worth
keeping:

- **Decoding the shots inside the page took the page down.** Full frame and
  72-pixel thumbnail alike destroyed the execution context, so the payload was
  never the problem — this far into the suite the renderer has no room for
  another canvas. Comparing PNG *sizes* in Node needs no decoder and answers
  the same question.
- **Byte equality reported a working frame as a difference.** The camera rig
  eases asymptotically and never quite lands, so no two frames are ever
  identical. Hence the control pair: it measures how much the picture moves on
  its own, and the test has to beat that by a wide margin. It does — noise 265
  bytes against a signal of 118,798.
- **A 72-pixel patch of the enemy's chest returned a signal of exactly zero.**
  The art is a cut-out with a great deal of transparency and the patch had
  landed on some of it. Where a figure's paint falls inside its box is not
  something to guess at; the whole box is.
- **And it was hiding the wrong element.** The foe's painting has been a frame
  STRIP since Build 50 — `.k-fanim`, six real frames of the Regent stepped
  across one sheet — and `#k-boss-art.k-has-anim img` is `display: none` in its
  favour. The test was hiding something that had not been on screen for seventy
  builds, and duly found that hiding it changed nothing.

### The pace, in numbers

Build 118 measured where each clip's motion lives and kept the shortest span
holding 86% of it. That is the right question for *which part of this clip
matters* and the wrong one for *what does the fight have time for* — and the two
got composed:

| clip | window | beat | played at |
|---|---|---|---|
| sword | 3.05 s | 1.00 s | **3.05×** |
| ward | 2.85 s | 0.85 s | **3.35×** |
| parry | 1.48 s | 0.42 s | **3.52×** |
| idle | 1.14 s | 2.40 s | **0.47×** |

Past about a quarter over, motion stops reading as motion and reads as a fault.
The idle went the other way and read as underwater.

**So the rule is inverted.** The beat is the fixed thing — it says how long this
verb has on screen — so the window is simply *the best span of that length*:
slide a window of the beat's duration along the clip and keep wherever the most
motion is. Playback lands at 1.0× by construction, and a clip is authored at the
speed a human animated it at, which is the speed it looks right at. A 20%
overrun is allowed, because urgency reads as urgency and fast-forward does not.

Everything now plays at **1.20×**, and the death — which holds when it finishes
— got its own length rather than the fight's.

### The loop was cut where it could not be cut

The other half, and the sharper bug. **You cannot cut an arbitrary window out of
a loop and expect it to loop:** the pose you cut in at is not the pose you cut
out at. Measured on the shipped library, as the angle between the first pose and
the last:

```
idle, authored whole   1.4°
idle, windowed         7.2°   ← a snap, once a cycle
```

Five times worse, on the one clip that is on screen almost all the time. Loops
keep every frame they were authored with now; the seam measures **0.09°**.

### The beat travels with the clip

It was a table in `cast3d.js` and a table in the mill, and two tables that must
agree are one bug waiting for somebody to edit the wrong one. `clips.json`
carries a `beat` and a `loop` flag now, written where the windows are chosen, so
the runtime divides and gets the rate rather than holding a second opinion.

`tools/rewindow.cjs` does this against the shipped library rather than the source
GLBs — the track data is all there, so the windows can be re-chosen at any time
without re-downloading sixty megabytes of animated character.

### Two new guards, for the two things that had none

- **PACE**: no clip plays outside 0.85–1.35× of its authored speed. Three builds
  shipped a sword swing at 3.05× and nothing could see it, because nothing
  exposed the number that would have said so.
- **LOOP**: every looping clip closes on itself, under 3°.

### A note on the repair

Restoring the beat table cost more than it should have. A splice keyed on `const
HOLDS` and `const RESAMPLE_FPS` deleted everything between them — and
`watercolour()`, `retarget()` and `sampleQuat()` live in that gap, which the
line numbers in the file said plainly and the edit did not check. The layer came
up with `failed: "load: watercolour is not defined"`, which the suite reported
as a hang rather than as a failure, because a layer that never becomes ready
leaves every check after it waiting. Restored from git; worth a line here
because the same shape of edit will look safe again next time.

**Suites:** flow 257, road 94, bond 76, slice 85, line 32, camp 48, music 22,
beat 10, cast 53 — 677 checks, all green.

---

## Build 120 — the camera leaves its spot, and the painting comes apart at the horizon

**The ask.** *"aim is off the screen fix that and build 120"* — and, from the
build before, *"Full cinematic, orbit anywhere."*

### First: the aim, and the blind spot nine suites shared

The screenshot showed the drag beam leaving the right-hand edge of the screen
instead of landing on the Kneeling Revenant. It reproduced instantly once the
right thing was varied:

```
at the harness's 932x430 window   --w-x = 704   beam ends on the foe
at the player's 2000x975 window   --w-x = 1515  on a stage 932 wide
```

`#k-scale` magnifies the whole board to fill whatever window it is opened in, so
there are **two pixel spaces**: a hero's CSS transform is written in stage units,
where the board is 932 wide always, while `getBoundingClientRect()` answers in
rendered pixels, where the same board is 2000 wide. Build 119 projected into the
rendered size and handed the number to a CSS transform — multiplying by the zoom
twice. `aimAnchor` reads the foe's rect, so the anchor landed 583 px past the
edge of the board and the beam pointed into the void.

The figure was drawn correctly the whole time, because the canvas *is* in
rendered pixels. Nothing looked wrong except the beam.

**It survived nine suites because the harness boots at exactly 932×430** — the
one window where the zoom is 1 and the two spaces are numerically equal. Every
check that has ever measured this measured the only case that cannot fail. The
suite now resizes and re-measures, and it is worth stating plainly: a harness
that only ever runs at one size is not testing size.

(Build 112 shipped the mirror image of this — `setViewport` applies the pixel
ratio itself, so pre-multiplying put the whole party off the top-right corner.
Whenever a thing is drawn in one space and positioned in another, ask which one
each number is in.)

### Second: the Revenant was wearing the Regent's body

The same screenshot showed *The Kneeling Revenant* fighting in the Mourning
Regent's gown. Build 118 gave the Regent `sel: '#k-boss-art'` — the slot the
first opponent stands in, which is true of the Regent and of the four creatures
there is no model for. It reads as "the boss turned up early" rather than as a
bug, which is how it shipped.

A foe is found by **who it is** now, not by which slot it stands in: game.js has
stamped `data-foe` with the creature's own id since Build 101. A plate only
gives up its painting to a figure that claims it by name, every frame, so the
four unmodelled foes keep their paintings — and so does anything whose model
fails to load, by the same rule rather than a second one.

### And then: the world in the round

A painted plate is correct from exactly one viewpoint. Swing thirty degrees and
the painted floor is a painted floor seen edge-on and the painted buildings
slide with you. But a painting of a street is two things stuck together, and
they come apart cleanly **at the horizon**:

| | what it is | where it goes |
|---|---|---|
| above the horizon | buildings, mist, sky — no parallax worth having | a curved **panel** at 45 m |
| below the horizon | the ground, which is a **plane** | the actual floor |

They need no blending: at the horizon both are infinitely far, so they meet by
construction. That is the whole trick, and it made this a build step
(`tools/horizon.cjs`) rather than a shader.

**The lens was measured, not assumed.** Two numbers, both found by looking:

- **The horizon**, as the row where the image stops changing vertically — a
  street receding to a vanishing point has its least vertical gradient exactly
  where everything converges. It came out at row **356 of 1344, 26.5%**.
- **The scale**, by cross-correlating the original 1600×893 plate against the
  outpainted 3168×1344 one. It sits at **74% of the panorama's width**, which
  gives a focal length of **1761 px** and an **83.9°** field.

Both cross-check hard: the principal point lands at **x = 1583 on a 3168-wide
image** — dead centre, which nothing forced — and the horizon predicted from the
plate's own lens falls within **5 px** of the one measured off the panorama.

The extra width came from outpainting `bg23-plaza.webp` to twice its size (2
credits), so the wings of the horizon are the same painting extended rather than
a different one generated.

### Three wrong floors, and why each was wrong

The floor took three attempts and each failure taught something:

1. **A lit procedural plane** (Build 119's first pass) laid a pale slab over the
   lower half of the frame. The plate is a *painting of a plaza, floor
   included*, in the right perspective — covering it traded good art for grey.
2. **Un-projecting the painted floor** — the textbook move, and the maths was
   right. It produced a fan of radial smears, because **that floor is a mirror,
   not a texture**: nearly every pixel below the horizon is a reflection of
   something above it, and a reflection is a property of the view, not of the
   ground. Un-projecting it stretches every vertical feature to infinity.
3. **Tiling the nearest painted strip** made choppy water. The nearest ground is
   also the *darkest* — mean luminance 17 of 255, the part in shadow — so
   lifting it to something a floor can be needed a gain of 5.7, which amplifies
   mottling into waves; and a 6.5 m tile over forty metres reads as a pattern.

So the painting is asked for the only thing it can answer reliably: **what
colour this plaza is.** rgb(73,74,77), its own hue at a value a floor can be.
Everything else is drawn — flagstones, pooling, standing water, paper grain — at
a 10 m tile that falls into fog before anybody can count the repeat.

Behind the painted 84° there is no painting, and pretending otherwise is what
mirror-folding does: four copies of the same lit doorway around the horizon.
What is actually behind you in a drowned city is weather, so that is what is
there. The panel carries its own alpha and dissolves into it; nothing is ever
seen to end.

### The tripod and the operator's hands

`cam()` has spoken in dolly, pan, roll, yaw and pitch since Build 22, and its
limits say what it is: pan clamped to 34 px, yaw to 7°. That is a **handheld
offset**, and it is the wrong shape for "swing around behind the party".

So a **shot** is a separate thing, stated the way an operator states one — stand
this far from the fight, this far around it, at this height, looking at this —
and the handheld offset applies on top, **in the camera's own axes**. That last
part matters: a push-in has always meant "toward what I am looking at", and
while the camera stood in one place that was also "along −Z in the world". The
moment the tripod can stand anywhere the two part company, and a push from
behind the party would have dollied sideways.

Five shots, wired to beats the fight already had: `home` on the player's turn,
`duel` on the enemy telegraph, `parry` when the bar opens, `allout` when three
of them cross the floor, `reckoning` when it is over. `home` is not a taste — it
is Build 119's camera written in the new terms, and the suite holds it to the
frame the painted stage framed.

**The floor marks came along, and that was not cosmetic.** FRONT / MID / BACK are
the drop targets: `rowTargetAt` picks a lane by asking which marker the finger is
nearest. A camera that can swing would have broken the picture visibly and the
*aim* silently — dragging a hero into whichever lane used to be painted there.
Projecting the marks from the same world the figures stand in fixed both at once,
with no raycast and no second copy of the layout.

### Four checks were measuring the wrong thing

`INK` has now been wrong twice in opposite directions, and both times because the
layer changed what it **is** rather than what it draws — counting lit pixels in
118, mean alpha in 119, and the layer became the whole scene in 120. It asserts
what outlives all three: the frame is painted, and it is not painted flat.

`POSE` was worse. It carried `down > 20%` from an alpha-silhouette instrument;
alpha stopped being a silhouette when the world filled the frame, and
thresholding on tone instead let the floor inside a hero's box vote. Comparing
the **pictures** works — the background does not move between two frames of one
shot, so it cancels — and the honest finding is that *"a knock-down dwarfs a
swing" was a property of the old measurement, not of the game*: 32% against 27%.
What the section actually guards is that skinning has not dropped out, which
makes every verb render the same bind pose, so the check that matters is that no
two actions render the same body.

`SHOT` first demanded all four bodies in frame for every shot. That is not what a
cinematic camera owes you: `duel` comes over Ash's shoulder on purpose. It checks
each shot frames its own **subject** and that nobody has ended up behind the lens.

`MARKS` read the front mark alone, and a swing pivots the line — the far end
travels a long way, the near end barely moves. It measures all three.

**Suites:** flow 257, road 94, bond 76, slice 85, line 32, camp 48, music 22,
beat 10, cast 50 — 674 checks, all green.

**Payload:** the world costs 266 KB (sky 50, floor 216) and retires a 58 KB
plate. The cast is still 9.9 MB and still the textures.

---

## Build 119 — one world, and the arrow turns around

**The ask.** *"Now I'm wondering if my battlefield should also be 3d with the
same painterly feel it is right now. That way we have more control over a
cinematic camera."*

The instinct was right and the reason underneath it is bigger than the floor.

### There was no world

Everything up to Build 118 drew each figure **alone**:

```js
for (const id of Object.keys(figs)) {
  const box = boxOf(id);                    // ask the DOM where this hero is
  renderer.setViewport(box.x, yUp, box.w, box.h);
  f.root.visible = true;
  renderer.render(scene, cam);              // draw it alone, orthographic
  f.root.visible = false;
}
```

Four figures, four renders, an **orthographic** camera, each one painted into
the rectangle the DOM said its old 2D portrait would have occupied. Every
figure standing at the world origin. They were never in a scene together.

Two things follow, and both were the ceiling:

- **There was no camera to move.** `cam()` moved a `<div>`. The figures came
  along as rectangles — they did not reproject, did not change their
  relationship to one another, could not occlude. A push-in magnified a
  photograph of a diorama rather than travelling into one.
- **There was nowhere to put a floor.** A ground plane spans all four boxes and
  belongs to none of them. Wanting a floor is what forces the whole thing.

### The change is one arrow

| | Build 118 | Build 119 |
|---|---|---|
| who decides position | DOM lanes (`--lane-x`, `--lane-z`) | the world, in metres |
| who follows | WebGL reads `getBoundingClientRect()` | the DOM reads `camera.project()` |
| camera | a CSS transform on a div | a real `PerspectiveCamera` |
| renders per frame | four scissored, orthographic | one |

**Twenty-nine places in `game.js` read a hero's bounding rect** — drop targets,
damage numbers, aim beams, nameplates, parry rings, the reckoning, the all-out.
Not one of them cares which direction the arrow points. They ask the DOM where
the hero is; the DOM still knows; it simply learned it from the world instead of
from a lane variable. That is why a change this deep touched none of them, and
why the whole rendering half came out **shorter** than the scissor dance it
replaced — that dance existed only to fake a shared space.

### The lens was converted, not chosen

The stage has been a real perspective volume since Build 21: `#k-field` carries
`perspective: 700px` with `perspective-origin: 50% 22%`. That is a pinhole
camera written in CSS — focal length 700 px, principal point at (466, 94.6) on a
932×430 frame — so the 3D camera that reproduces today's framing is not a matter
of taste. It is that same camera, transcribed.

The principal point sits **above** centre, which a symmetric frustum cannot
express: the horizon is at 22% of the height, not 50%, which is what looking
slightly down at a floor looks like. `setViewOffset` is the honest translation —
render the 430-tall window out of a 670.8-tall virtual frame centred on the
vanishing point, which works out at a 51.2° field of view.

Running the ladder the stage has drawn since Build 101 back through that lens —
projected centres and ground lines at 240/234, 352/253, 474/276, with a hero
1.75 m tall filling 176 px at the front rank — puts the eye **7.5 m back at
1.70 m**, head height. The party landed within 16 px of where it has always
stood. The read players know survived the rewrite, which is the only reason
eight suites that have never heard of three.js stayed green.

### The floor is not scenery

The first version of the ground was a plain mistake: a big lit plane across the
lower half of the frame. `bg23-plaza.webp` is a **painting of a plaza**, floor
included, in the right perspective, and covering it with procedural stone traded
good art for a pale slab and took the painted look down with it.

What a painting cannot do is know where anybody is standing. So the ground is
not scenery — it is **the surface the figures touch** — and it is two planes
doing one job each:

- **The catcher** carries nothing but shadow. `ShadowMaterial` is transparent
  everywhere light reaches and darkens only where a figure blocks it, so what
  lands on the painted plaza is four real contact shadows and not one pixel
  besides. The shadows move when the figures move, stretch when somebody lunges,
  and fall across each other. This is the entire return on the floor being real.
- **The wash** is a whisper of painted ground under the party — the pooled
  pigment and paper tooth the cast itself is painted with — pulling the figures
  down onto the plate rather than letting them hover in front of it.

The 2D shadow ellipse each hero has worn since Build 4 retires with this. It was
welcome for as long as there was no floor for a real shadow to fall on; now it is
a second, wrong shadow lying next to the right one.

### The camera language already existed

`cam()` has spoken in **dolly, pan, roll, yaw and pitch** since Build 22, writing
them onto `#k-cast` as custom properties for a CSS transform to consume. Those
are camera words. They were only ever a CSS transform because there was no
camera to give them to. Build 119 hands them to a real one, so every `camPush`,
`camParryOpen`, `camOffsetTo` and `camHold` written since Build 22 became a
three-dimensional camera move **without one line changing in game.js**.

One subtlety worth writing down: a custom property does not interpolate during a
CSS transition — the transition is on `transform`, not on the variables behind
it — so `getComputedStyle` returns where the camera is *going*, never where it
is. That turns out to be the useful half. The easing belongs here, at frame rate
and in three dimensions, rather than being reverse-engineered out of a matrix.

The suite proves it the only way that means anything: a push-in grows the near
rank **1.227×** and the far rank **1.177×**. That difference is parallax, and it
is precisely what a CSS scale cannot do.

### Three checks were measuring the wrong thing. Again.

This keeps happening and it is worth naming the pattern: a check that asserts
something *adjacent* to the truth passes or fails for reasons unrelated to the
game.

| check | what it actually watched | what it does now |
|---|---|---|
| `INK` | **lit pixels.** A pixel at 8% alpha and one at 100% both count as "lit", so a faint wash and a slab painted over the plaza score identically — and the slab was the bug it existed to catch | **mean alpha**: how much the layer *obscures*. The painted plaza has to read through |
| `POSE` | **`down > 20%`**, a number read off one renderer. Moving to a shared perspective world changes what fraction of a box a pose occupies for reasons that have nothing to do with skinning, and it duly failed at 18.9% on correct animation | the **ordering**: every action redraws the body, and a knock-down dwarfs the rest. That survives a camera change, a model swap and a new clip |
| `IDLE` | **differences of Euler angles.** A joint crossing ±180° reports a 359° swing | the **angle between quaternions**, which cannot exceed 180° by construction |

The `IDLE` one is the sharpest. The Regent's calmest bone was reporting the
liveliest motion in the cast — 359.03° — purely from a wraparound. Measured
properly it reads **6.19°**, in line with the party's 4.91–6.69. The old check
would have passed a completely frozen Regent.

`FOLLOW` had to reverse with the arrow: it used to set `--lane-x` and confirm the
figure was redrawn into the element's new box, which is now testing a mechanism
the game does not use. It changes the **row** instead — what the game changes —
and asserts both halves of the new promise: the figure walks 1.23 m across the
floor, and the DOM element lands on the projected figure to **0.0 px**.

### A 570 ms frame that had been there since Build 112

Chasing why the suite had got slow turned up something worth keeping:

```js
renderer.setSize(b.width, b.height, false);   // every frame
```

`setSize` assigns `canvas.width`, and **assigning `canvas.width` reallocates and
clears the drawing buffer whether or not the number changed** — it is the
documented way to wipe a canvas. Called unconditionally at 60 Hz on a 2330×1075
buffer, that is a fresh multi-megabyte allocation every frame to draw the same
size picture. It now resizes only when the size changes.

It hid because it looks like bookkeeping, and because switching things off
pointed the wrong way: turning off the shadows, the floor and every figure moved
1.74 fps to 2.1, which reads as "the renderer is just slow here". What found it
was measuring the layer against **itself disabled** — 1.74 against 60 — the one
comparison that could not be explained by the contents of the scene.

The honest remaining number: the world fills the whole viewport where Build 118
filled four small boxes, which is **2.2× the fragments** (3.9 fps → 1.74 in the
harness) and exactly the price of having a floor. A phone with a real GPU does
not notice. A software rasteriser turns it into a two-minute suite, so `?test=1`
— which has capped sleeps since Build 22 for the same reason — caps the drawing
buffer too. Nothing the suite measures is a function of pixel density.

### What is still a billboard

The backdrop. It is a painted plate and it cannot be orbited, which is the whole
of Build 120: the world in the round, so the camera can cross behind the party,
circle the Regent and drop low for a finisher. The projection already carries a
`behind` flag for every actor, because a point behind a camera projects
*mirrored through the origin* rather than off-screen — a hero would appear to
leap to the far side of the frame rather than leave it — and drag-to-lane will
have to be raycast against the floor in world space rather than picked by screen
x, so it survives a reversed board.

**Suites:** flow 257, road 94, bond 76, slice 75, line 32, camp 48, music 22,
beat 10, cast 37 — 651 checks, all green.

---

## Build 118 — the Regent joins the cast, and the party stands up straight

### The foe is not a special case

The Mourning Regent is a fourth actor in the same list as the party. Same rig,
same retarget, same clip library, same watercolour material, same measured
framing. The only two things it carries of its own are the DOM box it lives in
(`#k-boss-art` instead of a `.k-hero`) and a `side` of −1, which flips which end
of the stage it looks at.

**That is the whole return on having done the retargeting properly in Build 117.
A new foe now costs a model and no animation at all.** Its idle, its wind-up,
its blows, its flinch and its death all come out of a library that was recorded
on somebody else's skeleton.

It is wired to the beats the fight already had: `fxFoeWind` braces, `fxFoeSwing`
strikes on every blow of a bar, `fxStrikeBoss` flinches, `fxFoeDown` falls, and
`fxFoeSettle` hands everyone back to the idle.

A missing model no longer takes the layer down with it — an actor that fails to
load keeps its painted plate and the rest of the cast stands up regardless,
which is what makes adding the other four foes a one-file change.

### Timing is stated in seconds now

The first pass gave each clip a playback multiplier, and every one of them was a
guess: a number like `2.6` says nothing about whether the swing lands with the
damage number. What is written down now is **how long the action should take**,
and the layer works the speed out from the clip's own motion.

Which it can, because the mill **measures where the motion is**. A library clip
is authored to be looked at alone: it settles in, does the thing, and settles
back, and the settling is most of its length. `Sword_Judgment` is 4.4 seconds and
the swing inside it is under one. Summing how far every joint turns between
samples gives the clip's energy over time; the shortest span holding 86% of it,
padded a tenth either side for the wind-up, is the part worth playing. Between
54% and 82% of each clip survives, and the dead air is dropped rather than raced
through.

### And they were hunching

`Combat_Stance` is a deep crouch — right for one fighter filling a screen, and at
145 pixels in a party of three it just read as three people stooping. Blended at
0.62 against each model's own standing rest, it keeps the weight-shift and the
breath and loses most of the squat.

### Three checks that were measuring the wrong thing

Every one of them passed or failed for a reason that had nothing to do with the
game.

- **Bone lengths** guessed its parent-child pairs — `Hips→Spine`, `neck→Head` —
  and several are two or three joints apart in this rig, where the distance
  legitimately changes when anything between them bends. It reported 7% stretch
  on correct animation. It reads adjacency off the real hierarchy now: **23
  bones per actor, 0.00% drift.**
- **Facing** asserted one sign for the whole cast, which would have passed a
  Regent staring off the edge of the world the moment it joined. Each actor is
  checked against its own opponent's side now.
- **The idle** watched the Spine, and `Combat_Stance` is a weight-shift idle
  whose motion lives in the legs and the head — the spine turns a seventh of a
  degree. It reported four living figures as corpses. It asks the only question
  that survives a clip swap now: is *anything* moving?

flow 257/257 · road 94/94 · bond 76/76 · slice 85/85 · line 32/32 ·
camp 48/48 · music 22/22 · beat 10/10 · **cast 28/28** — no page errors.
