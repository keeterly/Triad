# The Line — one combo, three beats, and the party picks who takes each one

**Status:** built and ON at Build 293; one card per hero since Build 294.
Supersedes the relay of Build 292, which is kept in the tree behind
`RUN._line = false` only as the A/B baseline.

---

## What it is

```
somebody plays an OPENER    →  every opener is DISCARDED, and every living hero
                               lays out where their OWN chain now stands
somebody plays that card    →  the table clears again; the hero who played walks
                               on down the branch THEY chose, everyone else walks
                               one step further along theirs
somebody plays a FINISHER   →  the line is spent, whenever in it that lands. The
                               openers come back for whoever has not opened yet,
                               and EP decides whether the turn holds another line
```

**One rule, not a stage table.** Playing any card advances the line one beat and a
FINISHER ends it. There is no party-wide stage to hold everyone in step, because
lines are not all the same length — see *chains of different lengths* below.

**Every hero shows exactly one card.** A hero always contributes out of **their
own** row's rotation, so nobody is ever dragged into someone else's vocabulary —
Elin never swings a sword. The hero who **reached** opens out of the line they
reached into *instead* of their own, and keeps answering from it.

The turn's question is *whose line do I finish, and whose beats do I borrow?*

## Why this, and not the relay

The relay (Build 292) forced the hand-off: an opener dealt the next step to every
hero *except* its owner. That narrows the fan every beat. Hand-played, the same
board went **4 legal cards → 4 → 2**, and `plays` came back flat — the redesign
failed its own stated test.

The line deals every stage party-wide instead. Same board, same tree:
**4 → 6 → 6.** Nothing about the hand-off was wrong; *forcing* it was.

## What it delivered

`test/linemeter.cjs`, tree fully granted, enemy pack pinned, 5 fights a row.
`MID` is mean legal plays at every decision after a turn's first card.

| party | easy pack | hard pack |
|---|---|---|
| ash+elin | 1.79 → **3.30** | 1.91 → **3.33** |
| ash+elin+mira | 2.10 → **4.64** | 2.26 → **4.93** |
| cassia+branwen+hask | 2.68 → **4.95** | 2.88 → **4.64** |

Roughly **double** for every party on both packs, no exceptions. That is the
number the whole redesign existed to move.

## What it cost, and the lever that is still unpulled

A line cashes **one** finisher where three private chains cashed three. On the
hard pack, at Build 294:

| | off → ON (hard pack) |
|---|---|
| cards a turn, ash+elin+mira | 10.5 → 5.3 |
| damage a turn, ash+elin+mira | 229 → 153 |
| end HP, ash+elin+mira | 100% → 91% |
| end HP, ash+elin | 96% → **55%** |
| end HP, cassia+branwen+hask | 24% → 43% *(up)* |

At Build 293 this was far worse — the trio ended at 53% and cassia+branwen+hask
at 8%. Making the reach SUBSTITUTE rather than add (294) fixed most of it without
anyone tuning a number: the reached opener is often the cheaper one, so a turn
buys more lines. cassia+branwen+hask now ends **better** with the line than
without it. **The duo is the weak case that remains** — a two-hero line is two
beats where two private chains were six.

On the easy pack the line costs nothing (the room dies either way).

**This is an EP problem, and EP has not been touched.** Rotation combat opens on
`2 + heroes + 1` EP; a line costs an opener (1–3) plus a finisher (1–2), so a trio
affords two lines a turn where it used to afford three chains. Anything that buys
a third line — more opening EP, cheaper openers, a node that discounts a finisher
— returns the throughput without touching the structure. Tune it against
`roommeter` and `runmeter`, not `linemeter`, because what moved is survival.

## Staying in your own line pays

Two counterweights make "carry it yourself" a real alternative to spreading it:

- **LINE_FOCUS** (`[0, 2, 5]`) empowers a finisher by how many of *this* line's
  earlier beats its owner already played. Applied at DEAL time, not resolve time,
  so the bonus is on the card's face while the choice is still open.
- **The caster's bank.** Hask banks ◆ CHARGE per beat he takes — 2 for opening, 1
  for answering — and it is **provisional**: he cashes it only if he also closes.
  Open the line and walk away and the stack never arrives. Moving drops it too,
  along with the line.

Spreading a line pays the other way, with no new code: allies acting together is
already what forms a thread, so a shared line lights bonds.

**The other five heroes have no bank yet.** `_pendCharge` is a generic field and
Hask is the only hero who converts it. Ash/Mira/Cassia/Branwen/Elin each want
their own reading of "I carried this line" — that is the obvious next piece of
design, and it is where the skill tree gets something to say.

## Consequences worth knowing

- **Chains of different lengths run side by side.** A hero with no CARD node runs
  opener → finisher, so one beat in they are *already holding their finisher*
  while a treed ally is still on a combo. Both hold a card. This is counted as a
  DEPTH per hero rather than one stage for the party, and Build 296 is where that
  changed: the party-wide-stage version left the untreed hero holding **nothing**
  at all while somebody else's line ran, which is the opposite of a combo the
  party builds together. It also deleted two special cases — "skip the combo stage
  when nobody has one" and the stage table itself.
- **The hero who plays commits to the branch they picked.** Their next card comes
  from that card's own continuation, not from a fresh walk of their chain, so a
  fork collapses to the line you chose the moment you choose it. That is where the
  hand got smaller: a trio's second beat went from six cards to five.
- **Moving drops the line for everyone**, bank included. The line in flight
  belongs to the party, so one hero leaving formation costs every beat spent on
  it. Deliberate, and the reason it is priced that way is in `purgeChain`.
- **The REACH substitutes now, it does not add (Build 294).** It used to sit
  BESIDE the standing opener, so one hero a turn opened holding two cards while
  everyone else held one. On a party-wide opener stage that is two votes on which
  line the party builds. It replaces instead, so the hand is one card per hero.
  The cost is real and named: reaching is no longer a *choice* between the cheap
  line you stand in and the dearer one the board wants — it IS that turn's hand.
  That choice mattered when a turn had almost none; the line supplies plenty now.
  What the reach still buys is the thing Build 258 was actually for: without it,
  two players with the same trio in the same rows see byte-identical opening hands
  every turn.
- **Its original rationale is gone either way.** The reach existed because a
  reached line forged *its own* combo back into the reacher's hand. Under the line
  an opener forges nothing for its owner. Worth revisiting on its own terms.
- **Bonds and triads fire far more often**, which is the point — and it is why
  `triadCeremony()`'s tap-to-continue deadlocks any rig driving a whole fight
  inside one `page.evaluate`. Both rigs auto-tap it now.
- **PRIMED / FOLLOW-UP still runs alongside** and is still a weaker version of
  this. Absorbing it is the next structural job, not a balance one.

## Rig notes, paid for the hard way

- **Hand-play before believing a number.** The meter once reported the relay
  playing *more* cards a turn. It was an endless-turn bug — two heroes trading
  free cards at 0 EP — that the meter's per-turn card cap had disguised as a
  finding. `test/probe-line.cjs` plays a turn card by card with the EP showing.
- **Never heal state mid-play.** `playCard` pulls the played temp out of
  `S.tempCards` *before* it resolves, so during a line's last beat there is
  momentarily no card behind `S.line`. The self-healing check must not fire there
  (`lineLive` guards on `S.executing`) or the record of which beats were played is
  wiped and the deal starts over.
- **Count a turn as it starts.** `turns++` after `endTurn()` means a fight won
  inside the card loop divides by 1, flattering exactly the rows that win fastest.
  Fixed in `linemeter`; **`tempometer.cjs` still has this flaw.**
- **Pin the pack.** `generateDescent()` rolls a fresh pack per fight, and across
  two runs of one configuration that swing was *larger than the effect being
  measured* (cards/turn 5.6 → 9.5 with nothing changed but the seed).
