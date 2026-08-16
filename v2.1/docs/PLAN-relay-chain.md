# The Relay Chain — a plan for a fresh session

**Status:** designed, not built. Written at Build 291 (782/782 checks, `main` clean).

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
