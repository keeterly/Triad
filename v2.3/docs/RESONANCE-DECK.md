# KIZUNA · RESONANCE — Core Combat Mechanics Pass (v0.1)

Transcribed from the designer's handoff deck
(`KIZUNA_Resonance_Core_Mechanics_Claude_Code_Handoff.pptx`, 13 slides).
This document supersedes the sequencing, status, defense, economy and card
sections of `COMBAT-SPEC.md` (v2.3). Where the two disagree, THIS deck wins.
The rhythm-note parry INPUT (tap / slide / hold, v2.2 windows) is retained at
the designer's earlier direction; this deck redefines the parry OUTCOMES.

## 1 · Design contract

The fight is about party choreography, not combo bookkeeping.

1. **Readable pressure** — enemy intent is visible before commitment; camera
   drama never hides the decision.
2. **Three heroes, one economy** — a shared 3 AP phase creates meaningful
   tradeoffs without separate turn meters.
3. **Parry matters, but does not snowball** — timing prevents damage; it never
   creates automatic AP or counters.
4. **Sequencing stays legible** — only the immediately previous hero matters.
   No Flow meter and no action trail.

## 2 · Battle loop

1. **REVEAL** — show enemy intent and targeted hero.
2. **PLAN** — draw to 5; cycle once for free.
3. **ACT** — spend 3 shared AP in any hero order.
4. **RESOLVE** — enemy acts; each hit gets one parry window.
5. **CLEANUP** — tick statuses, expire Guard, refill hand.

Round pacing target: one high-confidence decision every 3–6 seconds;
cinematic camera cuts may decorate, never delay, the state transition.

## 3 · Deck economy

- **15 cards** — 5 equipped by each hero.
- **5 opening hand** — at least 1 card per hero.
- **7 hand cap** — unplayed cards remain.
- **1 free cycle** — discard 1, draw 1 each phase.

AP rules:
- 3 AP shared each player phase; AP never carries between phases.
- Card costs cannot fall below 1.
- Move costs 1 AP, once per phase.
- Movement printed on a card avoids the Move cost.
- Played cards discard; reshuffle only when the deck empties.

## 4 · Sequencing

Two rules create choreography without a combo meter:

- **FOLLOW-UP** — the immediately preceding card was played by a different
  hero. The UI shows only the most recent hero marker; there is no persistent
  action trail.
- **FINALE** — all three heroes have played at least one card this phase.

A conditional card receives either a cost reduction **or** increased output —
never both.

## 5 · Defense

Parry converts preparation into survival; it does not create a second offense
engine.

- **Failed parry** — full damage; Guard absorbs first.
- **Success** — reduce the hit by 70%.
- **Success + 2 Guard** — consume 2 Guard, negate the hit, deal 1 Break.
- **Response limit** — each hero may fully negate one hit per enemy action.
- **No reward loop** — no automatic counterattack and no AP refund.
- **Intercession** — Elin can take one ally's parry window — an authored
  exception, not a global rule.

## 6 · Combat language (statuses)

- **GUARD X** — absorbs damage. Expires at the start of the next player phase.
- **BLEED X** — triggers at the start of the enemy phase, then decreases by 1.
- **CHILL X** — reduces the enemy's next hit by X, then clears.
- **BREAK X** — reduces the Break meter. At zero, cancel the next enemy attack
  and enter Broken.
- **EXHAUST** — remove the card for the rest of the battle.
- **BROKEN** — +25% damage until the current player phase ends; then refill
  Break.

## 7 · The fifteen cards

### Ash — damage, Guard conversion, the clearest Finale payoff
| Card | Cost | Effect |
|---|---|---|
| Cleave | 1 AP | Deal 6 damage. |
| Guarding Cut | 1 AP | Deal 4 damage. Gain 4 Guard. |
| Counterstance | 1 AP | Gain 7 Guard. Next successful parry this round deals +2 Break. |
| Cross Sever | 2 AP | Deal 9 damage and 2 Break. **Follow-Up:** costs 1 AP. |
| Last Light | 2 AP | Deal 10 damage. **Finale:** +5 damage. |

### Elin — stabilizes the party, deliberate parry handoffs
| Card | Cost | Effect |
|---|---|---|
| Lumen Cascade | 1 AP | Deal 4 damage. Give 5 Guard to the lowest-health ally. |
| Mend | 1 AP | Heal 6 HP. |
| Frost Bind | 1 AP | Deal 4 damage. Apply Chill 4. |
| Shared Grace | 2 AP | All heroes gain 3 Guard. **Follow-Up:** costs 1 AP. |
| Intercession | 1 AP | Choose an ally; both gain 3 Guard. Elin may parry one hit aimed at that ally next enemy action. |

### Mira — hand quality, Broken exploitation, mobile pressure
| Card | Cost | Effect |
|---|---|---|
| Serrate | 1 AP | Deal 3 damage. Apply Bleed 3. |
| Quick Throw | 1 AP | Deal 4 damage. Draw 1, then discard 1. |
| Twin Fang | 1 AP | Deal two hits of 3. **Follow-Up:** deal three hits instead. |
| Backstab | 1 AP | Move to the opposite side and deal 5 damage. **If Broken:** +4 damage. |
| Execute | 2 AP | Deal 9 damage. **+6** if the enemy is Broken or below 30% HP. |

## 8 · Bond and Resonance

Repeated pair play produces one authored climax — not an endless combo chain.

1. **Earn a stitch** — a Follow-Up adds 1 Bond stitch to that hero pair;
   max 1 per pair per phase.
2. **Reach two stitches** — generate that pair's Resonance card directly into
   hand.
3. **Resolve once** — only one Resonance may be generated each phase.
   Resonance cards Exhaust.

**LIGHT THROUGH STEEL** — Ash + Elin · 1 AP · Exhaust
Deal 10 damage. All heroes gain 4 Guard.

## 9 · Memory progression

The prototype exposes the full ruleset; the campaign teaches it through three
signature unlocks: Ash's **Last Light** (Finale), Elin's **Intercession**
(ally-directed parry responses), Mira's **Execute** (Broken / low-health
exploitation). Vertical-slice rule: all 15 cards are available from the start
so balance testing is not gated by progression.

## 10 · Prototype acceptance criteria

Test encounter: **Ash 42 HP · Elin 36 HP · Mira 34 HP · Boss 120 HP ·
Break 12 · expected 7–9 rounds.**

Survival bands (winrate):
- **No parry:** 5–15%
- **~Half parries:** 25–40%
- **Excellent:** 45–60%

Claude Code build contract:
- Core models: BattleState · HeroState · EnemyIntent · CardDefinition · BondPair
- Required events: playCard · moveHero · cycleCard · attemptParry ·
  resolveEnemyHit · applyStatus · triggerBreak · generateResonance · endPhase
- Must-have tests: opening hero coverage · immediate Follow-Up · Finale
  gating · no dual conditional bonus · Guard expiry · Bleed decay · Break
  cancellation · one Resonance per phase

## Build-5 measured balance — and one finding

`test/balance.sim.cjs` plays the encounter 120 times per skill tier with a bot
that triages the way a real player does (buy exactly enough Guard/healing to
survive the telegraphed volley, swing with the rest). Measured on the shipped
build:

| Tier | Winrate | Deck band | Wins on round |
|---|---|---|---|
| No parry | 0.8% | 5–15% ✗ | 8 |
| ~Half parries | 29.2% | 25–40% ✓ | 9 |
| Excellent | 94.2% | 45–60% ✗ | 9 |

Round length lands inside the deck's 7–9 target, and winrate rises with skill
at every step.

**The three bands cannot hold at once, and it is structural rather than a
tuning miss.** A clean string blunts a hit by 70%, so parry is strictly and
largely beneficial: halving incoming damage roughly doubles how long the party
survives. Any tuning loose enough for a party that never parries to win 5–15%
of the time is one a skilled party wins ~100% of; any tuning tight enough to
hold experts to 45–60% kills the other two tiers outright at 0%. This was swept
across ~30 configurations of hit damage, dirge, boss self-heal and parry
strength — the full landscape is reproducible with `SIM_SWEEP`.

Two ways to reach the deck's curve, if the curve is what matters more than the
current parry payoff:
1. **Weaken the reward** — a clean string keeping ~55–65% of the hit instead of
   30% (`TUNE.parryKeep`) compresses the tiers enough to land all three bands.
   Costs the parry system much of its punch.
2. **Reinterpret the bands as damage taken** rather than winrate — the current
   build already sits close on that reading.

The build ships tuning #0 (parry at full 70% strength) because the standing
direction is that parry should be the best thing in the game. The simulator
gates the shipped curve so a regression is caught, and prints the deck bands
beside it every run.

### Build 6 — the v2.2 parry, restored at the designer's direction

The deck's §5 outcomes (clean string blunts 70%, 2 Guard negates) are replaced
by the v2.2 parry system, whole:

- **Weighted per note.** perfect 1.0 · great 0.9 · good 0.6 · miss 0. A hit's
  mitigation is the average across its string, so every note you turn aside
  negates its own share.
- **TURNED** — every note GREAT or better negates the blow outright and chips
  1 Break. Mastery a good human reaches most attempts.
- **FLAWLESS** — every note PERFECT is TURNED plus a riposte of 2 per note and
  another Break. The summit, still rare.
- **Windows are centred on the beat, not ended by it**: perfect ±80ms, great
  ±140ms, good ±220ms, then a labelled LATE tail. A tap that is way early does
  not miss — the note keeps listening.
- A **receipt** over the parrying hero states the outcome in the same breath as
  the damage: "2/3 turned · the rest gets through", or TURNED / FLAWLESS.

Two deck rules survive the swap. The **response limit** still holds — a hero
fully turns only ONE hit per enemy action, and a second turned string in the
same volley holds 75% instead of all of it. **Intercession** still hands Elin
an ally's window. The riposte contradicts the deck's "no reward loop"; the
standing direction that parry should be the best thing in the game wins.

Re-measured after the swap (the v2.2 parry is far more generous, so the
Regent's hits were re-tuned ×1.45 and the dirge set to 4/4):

| Tier | Winrate | Deck band | Wins on round |
|---|---|---|---|
| No parry | 0.0% | 5–15% ✗ | — |
| ~Half parries | 41.7% | 25–40% ✗ (just over) | 9 |
| Excellent | 100% | 45–60% ✗ | 8 |

The spread widened, which is what restoring the v2.2 parry buys: never
parrying is death, a mediocre parrier wins about two fights in five, and
mastery wins. Round length still lands inside the deck's 7–9 target.

### Build 7 — mobile readability and touch feel

- **Numbers are the engine's own.** `DISPLAY_SCALE` is 1: Ash has 42 HP, the
  Regent 120, a Cleave hits for 6. The ×150 JRPG scale was tried and read as
  noise — four-digit damage on a 122px card leaves no room for the words that
  say what the card DOES.
- **Card faces are Slay-the-Spire anatomy**: cost orb, name, art, then ONE text
  box of plain sentences with the numbers bolded ("Deal 9 damage. 2 Break."),
  and the conditional clause on its own labelled line in the same box
  ("Follow-Up: costs 1 AP.") — dim while it sleeps, gold when live.
- **Lifting a card parks it.** A lifted card commits to one spot and stops
  chasing the finger; the beam and reticle do the targeting. Chasing the finger
  made the card cover its own beam, and clamping it part-way made it feel stuck
  against an invisible wall.
- **Hold to inspect, MTG-Arena style.** A long press blows the card up over a
  dimmed board with its resolved effect spelled out; releasing puts it back. It
  never commits the card — playing is dragging — so inspecting cannot cost a
  turn. On iOS the callout, the tap highlight and text selection are all
  suppressed on cards.

### Build 8 — v2.2's parry and card feel, on the new systems

The designer sent a screen recording of v2.2 and asked for that feel back,
keeping the v2.3 deck and card systems. Both presentations are restored from
the original implementation, not approximated:

**The parry is a closing ring again.** Everything but the read desaturates and
holds still (`k-parry-focus`); a pale ring shrinks from 3.2× onto a dashed gold
sweet spot over the hero who must answer, with the note's index over it
("1/2") and a dotted thread back to whatever is swinging. The instant the note
becomes gradeable it goes gold, pulses, and the label snaps to the verb —
TAP! / SLIDE! / HOLD! — and time dilates while it is live. A press that is way
early shakes the ring, says WAIT…, and does **not** consume the note. A late
catch is still a catch. This replaces the travelling-note dots of Builds 5–7.

**The card follows the finger again.** No park, no leash. It trails down-left
of the touch point — the arrangement in the recording — so your thumb sits on
the target while the card stays readable and never covers the arc it casts.
The only clamp left is the stage rim, which can bite only at the very edge.
The aim line is v2.2's: a **crimson** travelling dotted arc (green when the
card tends the party) ending in four corner brackets around a bright dot that
breathe rather than spin.

The grading, weighting and TURNED/FLAWLESS tiers are unchanged from Build 6 —
this round changed how the parry *presents*, not how it *scores*.

### Build 9 — the intent banner is gone

The sky banner that carried the intent name, the per-hit volley groups, a
counterplay hint and the dirge line is removed. What survives is ONE line in
the Regent's own column, right under the Break pips:

    RUINOUS HYMN   21 → ASH ×3  |  +4 all

That is the whole decision: how much is coming, at whom, over how many hits,
plus the unparryable chip. The rhythm reads itself when the rings arrive, and
the counterplay hints were tutorial text the board did not need. Design
contract §1 ("readable pressure — enemy intent is visible before commitment")
still holds: the number a player needs to size Guard, healing and a row Move is
still on screen before they spend a single AP.

### The Dirge — an addition the deck does not list

The Regent's hymn settles on the whole party each enemy phase for unparryable
chip damage (3 in phase I, 4 in phase II, per living hero), answered only by
Guard and healing. Without it a well-timed party takes almost nothing and the
encounter has no floor. It resolves **after** the volley so that Guard is still
standing when the parry windows ask for it — a hero who banked 2 Guard can
always spend it to negate. It is named on the intent banner as
`DIRGE n TO ALL · UNPARRYABLE`.

## Build-5 implementation notes (accepted mappings)

- **An enemy action is a BARRAGE.** §5's "each hero may fully negate one hit
  per enemy action" only bites if an action carries several hits, and §2's
  loop says "each hit gets one parry window" — so the Regent's intents are
  volleys of 2–3 hits, each with its own target and its own rhythm string.
  The intent banner shows one glyph group per hit, named and priced.
- **Parry input** stays the v2.3 rhythm-note system (the designer's earlier
  "maintain our current parry system"). Mapping onto §5's outcomes: a string
  with any MISS is a failed parry; a string with no miss is a success; a
  success consumes 2 of the parrier's Guard to negate that hit outright when
  the Guard is there and the parrier has not already negated a hit this
  action, otherwise it blunts the hit by 70%. The perfect-string riposte and
  all-turned Break bonus of the previous build are REMOVED per "no reward
  loop".
- **Chill** is applied to the hit before the parry window, and the intent
  banner previews the chilled number (card faces must not lie).
- **Intercession's** negate consumes Elin's Guard; the 70% reduction still
  protects the original target.
- **Broken during the enemy phase** (via parry Break): Broken damage bonus
  applies through the following player phase; the meter refills at that
  phase's end; the cancel consumes the next enemy action either way.
- **Bond stitches** track the authored Ash+Elin pair (the only pair with a
  Resonance card in this slice). One generation per encounter — the card
  Exhausts and the climax is authored, not cyclic.
- Boss identity remains **The Mourning Regent** with the v2.3 intents,
  re-tuned to the 42/36/34 vs 120 encounter (no Affinity, no Burn — those
  systems are removed by this pass; Chill and Bleed replace them).
- Event-name mapping to the build contract: playCard/moveHero/cycleCard are
  literal; attemptParry+resolveEnemyHit live inside endTurn's enemy phase;
  applyStatus/triggerBreak/generateResonance are resolveEffects atoms;
  endPhase is endTurn.
