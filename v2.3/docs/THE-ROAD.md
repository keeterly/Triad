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
