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
