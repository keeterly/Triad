# The Line — one combo, three beats, and the party picks who takes each one

**Status:** built and ON at Build 293. Supersedes the relay of Build 292, which is
kept in the tree behind `RUN._line = false` only as the A/B baseline.

---

## What it is

```
somebody plays an OPENER    →  every opener is DISCARDED, and every living hero
                               lays out what they can answer with
somebody plays a COMBO      →  every combo is discarded, and every living hero
                               lays out their FINISHER
somebody plays a FINISHER   →  the line is spent. The openers come back for
                               whoever has not opened yet, and EP decides whether
                               the turn holds another line
```

A hero always contributes out of **their own** row's rotation, so nobody is ever
dragged into someone else's vocabulary — Elin never swings a sword. The hero who
**reached** keeps answering from the line they reached into.

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

| party | MID (off → ON) | easy pack | hard pack |
|---|---|---|---|
| ash+elin | | 2.00 → **3.30** | 2.23 → **3.39** |
| ash+elin+mira | | 2.65 → **5.30** | 2.65 → **5.14** |
| cassia+branwen+hask | | 3.15 → **5.06** | 3.14 → **3.68** |

Roughly **double** for a trio, up for every party on both packs, no exceptions.
That is the number the whole redesign existed to move.

## What it cost, and the lever that is still unpulled

A line cashes **one** finisher where three private chains cashed three. So:

| | off → ON (hard pack) |
|---|---|
| cards a turn, trio | 9.5 → 5.8 |
| damage a turn, trio | 229 → 114 |
| end HP, ash+elin+mira | 100% → 53% |
| end HP, cassia+branwen+hask | 29% → **8%** |

On the easy pack this costs nothing (the room dies either way, 100% HP both ways).
On a hard room it bites hard, and cassia+branwen+hask is close to a wipe.

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

- **A hero with no CARD node has no combo at all.** Their line is opener →
  finisher, which is exactly what the tree not being bought is supposed to mean.
  If *nobody* can answer, the combo stage is **skipped** rather than stalling the
  party on an empty table.
- **Moving drops the line for everyone**, bank included. The line in flight
  belongs to the party, so one hero leaving formation costs every beat spent on
  it. Deliberate, and the reason it is priced that way is in `purgeChain`.
- **The REACH lost its original rationale.** It exists because a reached line
  forged *its own* combo back into the reacher's hand. Under the line an opener
  deals a stage to everyone, so what survives is narrower: the reacher keeps
  answering from the line they reached into. Worth revisiting on its own terms.
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
