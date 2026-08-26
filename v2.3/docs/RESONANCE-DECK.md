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

### Build 10 — beat, icons, snap, piles, Arena proportion

- **The parry is a bar of music.** The whole volley runs on one 120 BPM
  metronome: every ring closes exactly on a beat, and notes are launched on
  their beat whatever happened to the note before — a missed ring can no longer
  drag the tempo, which is what made the last build feel flat. A pulse marks
  the downbeat and a **sequence track** shows every note of the bar, typed by
  gesture (dot / diamond / pill), lighting as it arrives and marking hit or
  miss behind it. A note's input window shuts when its GOOD window does, so two
  rings never fight over one tap. Musical waits bypass the test-mode sleep cap —
  routing them through it had been shredding the grid.
- **Icons.** One vocabulary — blade, shield, cross, drop, flake, shard, linked
  arc, star, crack, cards, step — used identically on card faces, in the
  inspect panel and in the piles.
- **Snap targeting.** Dropping is no longer a hit-test: the nearest *legal*
  target within 210px wins, so a blunt finger still lands the card, and an
  attack can never snap onto an ally.
- **The piles open.** DECK and DISCARD are buttons; either opens as a grid of
  readable cards. The draw pile is shown **sorted**, so opening it cannot leak
  the shuffle.
- **MTG-Arena proportion.** Card faces are 102×142 — 63:88 — smaller than
  before, with the cost orb and owner chip moved onto the art corners so the
  title gets the full width.

### Build 11 — the piles are objects, and cards are seen moving

- **Two real stacks.** The draw pile sits bottom-left beside the AP chip and
  the discard bottom-right beside END TURN, each a fanned stack of worn card
  backs with a live count. Either opens as a readable grid (Build 10); now they
  also read as places on the table rather than two words in a corner.
- **Every card that leaves the hand is seen leaving it.** Played, cycled,
  thrown away by Quick Throw, or swept at end of turn, a ghost of the card
  flies from where it sat into the pile it lands in, and the pile thumps.
  Drawing flies a card back the other way, out of the deck and onto the new
  card. An **Exhausted** card is the exception: it burns upward and out of the
  fight rather than landing anywhere.

**A deck rule changed here.** §3 says "unplayed cards remain"; the designer
asked for the end of turn to sweep the hand into the discard, which is the
Spire rule and what makes a discard pile worth watching. `HAND_SWEEP` at the
top of game.js is that switch — set it false to restore the keep-your-hand
rule, and nothing else changes. Re-measured with the sweep on: **0% / 43.8% /
100%** across the parry tiers, wins still landing on rounds 7–9, so the change
costs nothing in balance.

### Build 12 — the bottom bar, on the Spire convention

AP, DECK and DISCARD were confusing because AP was drawn as a **parchment card
stack** sitting right next to the draw pile: a resource and a zone shared a
silhouette, so the eye read three piles. The rule now is one shape per role:

- **Round = resource.** AP is a lit gold orb, unmistakably not a stack, and it
  goes cold when spent.
- **Rectangle = a place cards live.** The draw pile sits in the bottom-LEFT
  corner and the discard mirrors it bottom-RIGHT, each a fan of card backs with
  a count and a label above it. Empty piles dim.
- **Parchment = a button.** END TURN sits above its own pile on the right,
  exactly as the orb sits above its pile on the left, so the two sides mirror.
- **CYCLE** is an economy pip like AP, so it lives beside the orb rather than
  down among the zones.

This is Slay the Spire's arrangement (piles in the two bottom corners, the
resource orb on the left, the turn action on the right); MTG Arena groups both
zones on one side instead, which is worse here because our hand is centred and
would crowd them. A gate now asserts the orb is round, that each side's
resource/action sits above its own pile, and that nothing in the bottom bar
overlaps anything else.

### Build 13 — the telegraph is icons and amounts, over the head

The intent line is gone. In its place, a row of icon chips floats in the sky
above the Regent's head — the Spire's position, and not *on* the enemy:

    [⚔ 21 ×3 (ash)]  [✦ 4 all]

One chip per thing the action does. A blade for damage (with the hit count and
the target's face), a shield for guard, a star for a charge, a cross for
healing, the dirge's own mark for the unparryable chip. No sentence, no attack
name, no counterplay hint — the shape says what kind of turn is coming and the
number says how much. Each kind carries its own colour so the chip reads before
the number does.

The vocabulary is wired for **defend** and **charge** turns even though the
Regent has none yet: an intent carrying `guard` or `charge` renders its chip
automatically.

To make room, **Bond moved to the party column** — it is the party's meter, not
the Regent's, so it was in the wrong place anyway, and moving it freed the sky
between the boss HUD and the figure's head.

### Build 14 — impact, and a parry with a vocabulary

**The tracker is gone.** The ring says everything the row of dots said, and
the dots sat in the middle of the board saying it twice.

**Impact.** Every blow now gets the same four beats, scaled to its size: the
frame stops, the screen kicks, a shock ring blows out of the point of contact,
and whatever was hit flashes white and reels. Heavy hits add a full-frame
pulse. A turned blow is a gold clash with a hard stop and no shake — it should
not feel like being hit. Damage numbers go big past a threshold.

**Six note kinds**, so a volley has shape instead of one gesture repeated:

| Kind | The ask |
|---|---|
| `tap` | strike on the beat |
| `slide:L/R/U/D` | sweep it aside, in the direction shown |
| `hold` | brace through it, release on the beat |
| `burst` | a flurry — land 3 strikes before the ring shuts |
| `feint` | the ring stalls mid-close then snaps; autopilot dies here |
| `bait` | a crossed red ring you must NOT touch — discipline is the parry |

Each intent now has its own handwriting: the **Hymn** is a dirge you brace
through (tap, feint, hold), the **Advance** is two sweeping arcs (opposed
directional slides), the **Benediction** dares you to interrupt it (bait), and
the **Rain** is a flurry you have to out-mash (bursts). Ashen Rain also runs
its bar on **half-beats in Phase II** — the climax doubles time.

Re-tuned after the rewrite: shorter strings (a burst is one note) made the
mid tier much safer, so the Regent's hits went up ×1.3. Measured **0% / 26% /
100%**, wins on rounds 7–9, all three shipped gates green.

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

---

## Build 15 — the parry playtest, and what it changed

The note was: *"Playtest the parry system, it's too difficult and doesn't play
well right now."* So it was measured before it was touched.

`test/parry.playtest.cjs` drives real bars in a real browser with a synthetic
hand: gaussian timing error around each beat (Box-Muller), a systematic bias,
and — added after the first pass — a probability of **reading a direction
arrow wrong**. It reports the grade distribution per note KIND, so an unfair
note shows up as a kind whose score is dominated by something other than the
player's timing.

**The first run indicted the arrows, not the windows.** A hand that always
swiped right scored 90–100% clean on every kind *except* `slide`, which came
in at **42%**, and the all-slide Scything Advance turned **0 of 2** hits. Once
the rig was taught to read the arrow and swipe the right way, `slide` jumped
to **100%** with the windows completely unchanged.

That is the whole diagnosis: **the timing was never the wall. The reading
burden was.** Identify a direction, execute a directional gesture, inside one
500ms ring, with zero credit for guessing wrong, six or seven times back to
back with no rest.

Six changes, each aimed at that finding:

1. **The verb is on screen from the first frame.** The ring's label used to
   read `3/6` until it went live, which tells you *when* and never *what*; the
   read and the answer shared one half-second. It now reads `SLIDE →` from
   spawn, and the beat counter moved to its own line above the ring.
2. **A read gets its own runway.** `NOTE_LEAD` gives anything you must decode
   before you can answer it — an arrow, a crossed bait ring, a burst — 1.6–1.7
   beats of approach instead of 1. The beat it lands on does not move; only the
   time you have to look at it does.
3. **A slide is credited when the finger COMMITS.** A swipe is legible only
   once it has travelled, so grading it at the threshold crossing charged every
   slide a tax for being a gesture. It now grades at the pointerdown, capped at
   `SLIDE_LEAD_MS = 120` of travel credit, and the crossing threshold drops
   22px → 14px.
4. **A misread arrow costs a grade, not the string.** Swipe the wrong way on
   the beat and the ring shakes, keeps listening — correcting still earns full
   credit — and if the hand never corrects, the note pays out one grade down
   (`DEMOTE`) instead of nothing. Timing success plus reading failure should
   not score the same as no hand on the screen.
5. **The bar breathes.** `REST_BEATS = 1` puts a rest between the hits of a
   volley, so a six-note action is three phrases of two rather than a wall.
6. **Two intents were re-written, not re-tuned.** Scything Advance was five
   notes with three arrows in a row — a spelling test, not a sweep — and is now
   one arrow per hit. Ashen Rain's phase-2 `sub` went 0.5 → 0.75; at 250ms a
   note, touch latency alone makes the bar unplayable rather than hard.

7. **A hit's notes read left to right.** Longer runways put two rings in the
   air at once, and stacked on one point their labels printed straight over
   each other — `HTAPD!` where `HOLD!` and `TAP` should have been. Notes now
   fan sideways across their hero (`NOTE_SPREAD`), and a ring that is still
   approaching sits back at half opacity so the eye always knows which of the
   rings in the air is the one being asked for.

Windows widened a notch alongside all that (perfect ±80→95, great ±140→170,
good ±220→260), but the notes above are what actually moved the numbers.

**After (6 passes each, `test/parry.playtest.cjs`):**

```
practised (jitter 55ms, misread 15%)      sloppy (jitter 110ms, bias 25ms, misread 35%)
tap    100% clean                         tap    79% clean
hold   100%                               hold   92%
slide  100%  (2/18 misread)               slide  61%  (9/18 misread)
burst  100%                               burst  92%
feint  100%                               feint  83%
bait   100%                               bait   83%
```

A practised hand now clears the bar even when it misreads an arrow; a sloppy
one still pays — 5.7 damage per Ruinous Hymn against the practised hand's 2.0.
The skill gradient survived; the unfairness did not.

Two new suite gates hold the line: *the volley breathes — a rest beat
separates one hit from the next*, and *a misread arrow answered on the beat
pays a grade, not the whole string*.

---

## Build 16 — six notes from the table

**The dash glitch.** A red beam was left nailed to the top-left corner of the
screen, still pointing at the Regent, with no card holding the other end. A
drag can outlive its own card: anything that re-renders the hand detaches the
button while the frame loop is still running, and a detached node measures as
a zero rect — which the beam faithfully drew from. The loop now abandons
itself when its card is gone, and rebuilding the hand clears any beam outright.
Gated: *the beam dies with the card — a re-render cannot strand it in the
corner*.

**The combo now reads.** A card answers two questions — what it always does,
and what the combo pays — and both were set as the same small grey prose in one
box, so `Finale: +5 damage` read as a footnote rather than the payoff. The text
box is now two blocks: the base line in the biggest type on the face, and the
combo as a **banded strip with a named tag** (FOLLOW-UP / FINALE / IF BROKEN)
that goes gold and says **ON** the moment it is armed. Fixing the layout
surfaced a second bug: centring the prose with flex turned each inline child
into a flex item and silently ate the spaces, printing `9damage.` — the prose
now sits in its own inner span.

**Bait wears a skull.** A crossed circle has to be taught. A skull does not.

**Deflecting hits like it matters.** A turned blow is the best thing a player
can do in this game and it was one gold ring. `fxDeflect` makes it struck
steel: a crescent of light thrown back along the line the blow came in on,
shards off the point of contact, a white flash, two staggered shock rings, a
screen kick, the hero flaring white, and a 140–175ms stop. FLAWLESS gets the
larger crescent and nine shards instead of six.

**The sweep empties the hand.** The old end-of-turn discard flew a ghost of
each card while the original sat in the fan until the last one had gone — the
hand appeared to duplicate itself and then vanish. Each card now LEAVES the
hand as its ghost launches, so the ranks close behind it and the pile grows
under it, and `flyCard` throws a real arc (lift, curve, turn, drop) via
keyframes instead of a straight lerp. Gated by an invariant rather than a
screenshot: **cards in hand + ghosts in flight never exceeds what was held.**

**Movement is a place you put someone.** v2.2 had row slots, a Move action with
a price, a hint and drag-onto-a-row; v2.3 had a blind 44px threshold with
nothing on screen to say a threshold existed. Grabbing a hero now raises two
lanes out of the ground, dims and drops the hand out of the way, names the row
they stand in, and prices the move over their head. The figure **previews the
destination** rather than being glued to the finger — a hero is a tall sprite,
and dragging one by the chest sends the body the opposite way from the row
being aimed at, which the eye believes over the lanes. A move that cannot
happen says why (`ALREADY MOVED`, `NEEDS 1 AP`) instead of silently doing
nothing. BACK also became genuinely upstage — up and smaller, not merely left —
so the two lanes are separable by eye and by thumb.

---

## Build 17 — the combo probe, and the mechanic that could not happen

v2.3 exists to make **deck and card play** the fun part, so before tuning
anything I measured the thing that claim rests on. `test/combo.probe.cjs`
plays sixty fights and reports the *shape* of a turn rather than the winrate:
how wide the choice was, how often a conditional card was played armed versus
cold, whether FOLLOW-UP is a decision or a default, how often FINALE lands,
how much AP is left on the table, and which cards never get played at all.

### What it found

```
                          BEFORE            AFTER
conditional cards          33% of plays      56% of plays
…played ARMED              51%               90%
FOLLOW-UP taken            58%               95%
FINALE fired               0 of 19  (0%)     60 of 101 (59%)
three heroes in a turn     19%               24%
dead cards (<0.25/fight)   cstance, sgrace   —
```

**FINALE fired zero times in 466 turns.** Not rarely — never. Last Light cost
2 AP and the condition wanted all three heroes to have *already* acted; the
trio costs the whole 3 AP turn, so there was never anything left to finish
with. The marquee combo of a game about comboing was arithmetically
impossible, and nothing in the suite could see it because every test asserted
the rule rather than asking whether the rule was reachable.

### What changed

**A FINALE is the last blow of the round, not something bought after it.** The
card that *completes* the trio is what fires it. The line is now Elin (1) +
Mira (1) + finisher (1) = one 3 AP turn, and the suite gates the arithmetic,
not just the rule: *FINALE IS REACHABLE — Elin, Mira, then the finisher,
inside one 3 AP turn.*

**Last Light 2 AP / 10 raw → 1 AP / 5 raw, FINALE +10 and 2 Break.** The cold
floor has to be low or the card sabotages itself: at 7 raw for 1 AP the best
greedy play was to lead with it, which is the one move that guarantees the
finale never happens. 5 cold is mediocre; 15 armed is enormous; the gap is the
reason to hold it for third.

**Mend becomes the second FINALE,** so the trio is a fork instead of a script:
close the round with Ash and it is a killing blow, close it with Elin and the
party stands back up. One turn, one finisher, two very different turns.

**Backstab trades "If Broken" for "From the Back."** Broken landed 7% of the
time — a coin, not a plan. Backstab already steps Mira across the rows, so the
row she steps *out of* is now the condition: a two-beat play the player sets up
themselves, and the first thing that makes Build 16's row lanes worth using.

**Counterstance draws on a follow-up** (0.15 → 1.8 plays a fight). Guard
competes with a parry that negates outright, so it had to be worth playing for
something other than the Guard; a chain that can extend itself is what makes a
combo deck play.

**Shared Grace 2 AP → 1 AP, and chips 2 Break on a follow-up** (0.15 → 2.3).
It becomes the setup card — the thing you play mid-combo to arm next turn's
BROKEN payoffs — which also drags BROKEN_OR_LOW from a dead condition to 77–97%
armed.

**Execute 2 AP / 9 → 1 AP / 6, BROKEN_OR_LOW +8.** An execute should be dead
weight until the target is finishable and then decisive. At 2 AP it was
neither, and played 0.08 times a fight.

**The combo announces itself.** `fxComboCall` strikes the combo's name over
the hero who closed it, with a gold shock; a FINALE takes the whole board —
big type, a rule beneath it, screen pulse, kick and a 140ms stop. A combo that
shows up only as a bigger number is a combo nobody notices they built.

### One honest caveat

`qthrow` still measures at 0.17 plays a fight. Draw-1-discard-1 is card
*filtering*, and its value is entirely about finding a specific card — which a
rig that plans one step ahead never wants. It went to 5 damage so it is never
strictly worse than the vanilla strike, but the low number is the probe's
blind spot as much as the card's, and it is recorded here rather than tuned
away.

### Outstanding at the time of this commit

Making the deck work moved the encounter. The mid-skill band went 30.5% →
75.9%, outside its 25–55% gate, because the party now has a damage engine it
did not have before. The fix belongs in the encounter rather than in walking
the deck back, so `bossHp` joined `TUNE` as a swept knob and a HP × damage
sweep is the next step. **Build 17 is not balanced yet** — the combo layer is
correct and gated at 85/85 flow checks, but `test/balance.sim.cjs` reports
2/3 shipped gates until that sweep lands.
