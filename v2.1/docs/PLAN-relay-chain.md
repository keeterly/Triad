# The Relay Chain — a plan for a fresh session

**Status: SUPERSEDED at Build 293 by [THE LINE](THE-LINE.md).** Read that first.

Step 1 of this plan was built and measured at Build 292 and did not deliver: the
forced hand-off narrowed the fan on every beat and `plays` came back flat. The
line keeps this plan's insight — a combo belongs to the party, not to a hero —
and drops the part that failed, which was *forcing* the pass instead of offering
it. Dealing every stage party-wide roughly doubled `plays` for a trio.

This document is kept because the measurement below is the reason the design
changed, and because its three warnings all held. The relay itself survives in the
tree only as `RUN._line = false`, the A/B baseline the meter measures against.

---

## Step 1 — what the measurement said

The hand-off is implemented exactly as specified below, behind `RUN._relay`. It
works: an opener forges nothing for its own owner and instead hands each other
hero a step out of **their** rotation, the last hero the line reaches is handed
the FINISHER, and a stance change abandons the line for the whole party.

**It does not move `plays`.** That was the number this redesign exists to move,
and the plan says in advance what to do if it doesn't. `test/linemeter.cjs`
A/Bs the relay against the private chains it replaces, in the same fight, with
the tree fully granted and the enemy pack pinned:

| party | MID plays (off → ON) | end HP (off → ON) |
|---|---|---|
| ash+elin | 2.23 → **1.85** | 95% → 84% |
| ash+elin+mira | 2.65 → **3.00** | 100% → 96% |
| cassia+branwen+hask | 3.14 → **2.94** | 29% → **0% (wipe)** |

Only the canonical trio improves, by ~13%. A duo gets clearly worse — a two-hero
relay is two beats where two private chains were six — and the second trio gets
worse *and* dies. Throughput falls ~30% across the board, which is what killed
cassia+branwen+hask. Averaged over every row the number is flat.

So: **reconsidered, not tuned.** `RUN._relay` defaults to `false`; `main` plays
exactly as Build 291 did. Flipping it on is one line in `newBattle`.

### Three things worth knowing before touching it again

1. **Turn length is the whole balance lever, and the strict reading breaks it.**
   Read literally ("the openers return next turn as they do today"), the relay
   *is* the turn: three cards, then end. Measured, that cut a turn from ~9 cards
   to 3, halved damage, and took the standard trio from finishing a room at 98%
   HP to 33%. `_relay: 'once'` still runs that reading if anyone wants to re-read
   the number. The default reading lets a spent relay end and the unspent openers
   return, so EP governs turn length exactly as it does today — that is the only
   version that keeps the economy intact.
2. **The REACH loses its rationale.** Build 258's reach exists because
   `resolveChainPlay` keys off `card.chainStance`, so a reached line forges *its
   own* combo. Under the relay an opener forges nothing for its owner, so that
   property has nowhere to land. The reach still works as a differently-priced
   opener, but the reason it was built is gone, and its check had to be rewritten
   to assert what survives (reaching never drags an ALLY out of their stance).
3. **Bonds and triads fire far more often.** The relay lands every hero's action
   in the same line, so `they struck as one` fires constantly and trios form in
   one fight instead of never. That is the plan's "bonds get a mechanical seat"
   arriving — and it is also why `triadCeremony()`'s tap-to-continue overlay now
   deadlocks any rig that drives a whole fight inside one `page.evaluate`. Both
   meters auto-tap it from inside the page now.

### Two bugs this found, both fixed

- **A relay cleared mid-play never ended.** `playCard` pulls the played temp out
  of `S.tempCards` before it resolves, so during the last step of a line there is
  momentarily no card behind `S.relay`. The self-healing check cleared the flag
  there, wiping the record of who the line had reached — and the next pass handed
  it straight back to them. Two heroes traded free cards forever at 0 EP. The
  meter had a per-turn card cap and reported this as "12 cards a turn"; hand-playing
  one turn (`test/probe-line.cjs`) is what actually showed it. **The repo lesson
  held: the surprising number was a bug, not a finding.**
- **The meters count a turn only if it finishes.** `turns++` sat after
  `endTurn()`, so a fight won inside the card loop divided by 1 — flattering
  exactly the rows that win fastest. Fixed in `relaymeter`; `tempometer.cjs` has
  the same shape and the same flaw.

### Rig notes

`generateDescent()` rolls a fresh pack per fight, and across two runs of the same
configuration that swing was **larger than the relay-vs-baseline gap** it was
meant to reveal (cards/turn 5.6 → 9.5, P:E 4.7:1 → 11.9:1, nothing changed but
the seed). `relaymeter` pins the pack; anything measured against a generated one
should be treated as noise until it is re-run pinned.

---

## The problem this solves

The game's stated goal is teamwork. Its combat is three people doing solitaire
next to each other.

`ROTATIONS[hero][stance]` gives each hero an **opener**, and
`resolveChainPlay(card)` forges the next step **for `card.owner`** — the same
hero who just played. So a trio runs three private chains in parallel. Nothing
about the core loop is co-operative, which is why:

- **the skill tree feels forced.** A node deepens *your own* line. It has no way
  to express "these two work well together", so the tree reads as a stat page.
- **the weaves are unclear.** Bonds pay out as passive modifiers and one
  conditional strike, both of which happen *to* you rather than being something
  you *do*. There is no moment on screen where teamwork is the mechanic.
- **decision density is low.** Measured mid-rotation: `plays 3` — each hero
  holds exactly one card of their own chain, so a turn is three independent
  choices at one target. Best-play-vs-average sits at ~32%.

## The design

The chain passes **between** characters instead of running inside one.

```
turn opens        3 openers, one per hero
A plays theirs →  B and C DISCARD their openers, gain FOLLOW-UPs
B plays theirs →  C's follow-up becomes the FINISHER
```

Hand size stays at three — no bulk — but the branching becomes
`who opens × who answers × who finishes`: six orderings a turn from the same
card count, before a single node touches it.

### Why this produces the emergence

- **Skill nodes already reshape chains** through `chainNext` gates
  (`{key, gate}` forges only when a node is owned; `{key, gateNot}` only when it
  is not). Same machinery — but a node now changes *what your allies get
  handed*, not just your own next card. New node types are not required.
- **Bonds get a mechanical seat.** The hand-off between a **✦ WOVEN** pair is
  the natural place for the bonus: free, or upgraded, or opening a second
  option. The weave becomes something you watch happen on the pass.
- **PRIMED / FOLLOW-UP is a weaker version of exactly this** and should be
  absorbed, not left running alongside.

---

## Implementation

### Step 1 — the hand-off (do this alone first, and measure it)

**`resolveChainPlay(card)`** — `game.js` ~1756. Currently:

```js
const h = S.heroes.find(x => x.id === card.owner);
const rot = ROTATIONS[card.owner] && ROTATIONS[card.owner][card.chainStance];
// …forges rot.cards[key] for h
```

Change the recipient. On an **opener**, forge each *other* living hero's
follow-up out of **their own** stance's rotation (so a hero always plays their
own vocabulary — Elin never swings a sword), and clear their pending opener. On
a **follow-up**, forge the remaining hero's finisher. On a **finisher**, the
relay ends and the turn's openers return next turn as they do today.

The step a hero receives comes from *their* `ROTATIONS[them][their stance]`.
Suggested keying: the rotation's second entry is the follow-up and its terminal
entry is the finisher — the data already distinguishes these by `stance`
(`'COMBO · …'` / `'FINISHER · …'`), so no new authoring is needed to prototype.

**`buildHand`** — `game.js` ~4259. Openers are pushed per hero (`mkChainOpener`),
forged steps sit in their owner's slot via `chainTemps`. Discarding an opener
when someone else opens is a filter here: if a relay is live this turn and this
hero has a forged step, do not also push their opener.

**`purgeChain(heroId)`** — ~1795. Today a row change abandons that hero's own
chain. With a relay it should abandon the **relay**, because the line in flight
belongs to the party. Decide deliberately; either is defensible, and it wants a
comment saying which and why.

**State:** one field, e.g. `S.relay = { step: 'opener'|'follow'|'finish', from: heroId, used: [heroId] }`,
cleared at the turn rollover next to `expirePrimes()` (~7500, the block that
resets `mark`, `acted`, `_hitBy`).

### Step 2 — absorb PRIMED

`primeTypeForCard` (2552), `expirePrimes` (2630), `primeReady` (2635),
`offerFollowUp` (2642), `reofferFollowUp` (2667), `resolveFollowUp` (2685).

The relay's hand-off *is* the follow-up. Keep the bond formation
(`addThread(a, b, 'the follow-up answered')`) and the cut-in — move them onto
the relay pass — and delete the parallel PRIMED bookkeeping. Do not do this
until step 1 is measured, or two systems will be half-live at once.

---

## Measurement — run these before and after

Rigs are in `test/`, all fast (harness `fastCombat` time-scaling):

| rig | what it answers | target |
|---|---|---|
| `tempometer.cjs` | `plays N`, player:enemy ratio, parries/fight | `plays` should rise from **3**; ratio should stay near **1.4:1** |
| `roommeter.cjs` | one room, HP left by skill | should not get easier |
| `runmeter.cjs` | a whole floor, `SEEDS/SKILL/PARTY/RELIC` | wipe rate should hold near **2/4 at 0.7** |

Current baselines (Build 291): mid-rotation `plays 3`, best-vs-average **+32%**,
player:enemy **1.4:1**, ~6.8 parries a fight, floor wipe rate 2–3 of 4 at skill
0.70.

**The whole point of the change is `plays`.** If the relay does not raise it,
the redesign has not delivered and should be reconsidered rather than tuned.

### Rig caveat, learned the hard way

Three separate measurements this session were blocked by rig cost, and two
"findings" turned out to be walker artifacts. Before trusting a floor-scale
number: `runmeter` reports nodes the walker fluffed separately from wipes
(`ran` flag) — read that column. And **play any surprising result by hand
before reporting it.** Twice this session that was the only thing that caught a
false result.

---

## Tests

~170 checks in `test/flow.test.cjs` mention chain / opener / FINISHER / PRIMED /
rotation. Most are incidental; the ones that will genuinely need rewriting:

- **ROTATION block** (~4700–4790) — opener returns each turn, forged steps carry
  `expiresTurn`, the fork gate forges both paths, every rotation `fx` key is
  supported.
- **KIZUNA / PRIMED block** (~840–1000) — the whole PRIMED→FOLLOW-UP path.
  Expect to rewrite rather than repair, in step 2.
- **`purgeChain`** — the row-change abandonment drills.
- **TUTORIAL block** — Build 273 teaches rotation → telegraph → PRIMED →
  FOLLOW-UP → all-out. If PRIMED is absorbed, the tutorial's fourth beat is
  now the relay, and `FLOW`'s copy changes with it.

Do not relax a failing check to make it pass. Every one that fails is asserting
the old design; rewrite it to state the new intent, and say so in the comment.

---

## Ship ritual (this repo)

Bump **all four**: `V2_BUILD` (`game.js` line 24), `version.json` `"v2.1"`,
`game.js?v=` + `styles.css?v=` + `V2.1 BUILD NNN` (`index.html`). Build 288
shipped without them and it went unnoticed for a build.

Then: `node test/flow.test.cjs` (expect ≥782, `pageErrors: 1` — one intentional
404), heredoc commit (`git commit -F -`), push
`claude/kizuna-ability-system-wEc9E`, then
`git checkout main && git merge --ff-only <branch> && git push origin main`,
then check the branch back out. Run long suites with `run_in_background: true`
and an `until grep -q "EXIT=" …` wait loop.

---

## Risks worth naming up front

1. **Interaction with the healer cliff.** Wounds (Build 291) are implemented but
   their effect on the cliff is *unmeasured* — the floor-scale runs never
   finished. A relay changes damage throughput, so measure wounds and the relay
   together rather than attributing one's effect to the other.
2. **Turn length.** Three heroes chaining one line may mean fewer total cards a
   turn, which raises the enemy's share of the action. That is desirable (the
   player:enemy ratio was 4.9:1 before Build 281), but it will move difficulty —
   re-measure, do not assume.
3. **A hero left out.** With three heroes and a three-step relay everyone acts,
   but a duo, or a downed hero, breaks the arithmetic. Decide what a two-hero
   relay is before writing the code, not after.
