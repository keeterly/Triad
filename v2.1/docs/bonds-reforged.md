# Bonds, Reforged — design spec

## Problem (why the old system felt bad)
- Kindled pairs spawned **Duet cards** (3 EP) and a full triangle spawned a **Resonant card** (all EP). You could hold **3 duos + 1 trio = 4 cards** at once.
- They **clogged the hand**, **drained all EP**, and — worst — were **generic per class-pair**, ignoring your ember tree and boons. They never produced the emergent boon+skill damage combos that make the build fun.
- They were a **third payoff system** sitting awkwardly between skills and the all-out, overlapping both.

## Concept: a bond expresses itself in two beats
A bond is no longer a card. It is a **living connection** that shows up twice:

1. **THE WEAVE (in-fight rider).** The moment a **kindled pair** threads (a shared act of help), their bond becomes a persistent **Weave** for the rest of the fight — a **build-aware rider** that reshapes how the pair's *own skills* resolve. It reads their boons/tree, so it **composes into emergent damage**. Continuous, subtle, zero cards, zero EP.

2. **THE VOW (all-out payoff).** Every woven pair adds a **Verse** to your **ALL-OUT**. Completing the triangle crowns the all-out into a **RESONANT ALL-OUT**. Bonds pay off at the marquee moment, and the finale is **shaped by who you bonded**. Runs on momentum, not EP.

No bond cards. No EP tax. Bonds **ride your skills** and **crown your all-out** — the two systems that already carry the game.

## The arc that should feel good
1. Field bonds → **Weaves light up** → your skills start doing connected, build-flavored things (continuous).
2. Complete the triangle → **TRIAD FORMED** ceremony → "your all-out is now RESONANT" (promised).
3. Fill BURST → unleash **ALL-OUT** → every woven bond pays off as a **verse**, the triad **crowns** it → a party-comp finale (delivered).

## Layer B — The Weave (data-driven riders)
`BOND_WEAVE[duetClassKey]` — one themed rider per class pair. Each has:
- `name`, `icon`, `blurb` (shown as a topbar chip, like a boon).
- Optional `dmgMod(owner, tgt)` → bonus damage when a **woven** hero attacks (added inside `passiveDmg`).
- Optional trigger hook (`onFinish`, `onHeal`, `onGuard`, `onHit`) fired from `firePassives`, gated to woven pairs.
- Build-aware: hooks may read `hasNode(...)` / boon state to **amplify**, so weaves + boons stack into unique effects.

Pair riders (first pass — one clear hook each, build-amplified):
| Pair (classes) | Weave | Rider |
|---|---|---|
| Ronin+Cleric | Warded Edge | woven Ash finisher heals most-wounded ally ⌈dmg/3⌉; +cleanse if Elin has `mercy` |
| Reaver+Ronin | Twin Edge | the pair's hits EXPOSE +1; **+3 dmg** vs already-EXPOSED |
| Cleric+Reaver | Silent Mercy | Elin's heal sharpens the target's next attack **+3** |
| Guardian+Ronin | Shield & Sword | when Cassia guards, woven ally gains **+2 dmg** next hit |
| Guardian+Cleric | Sanctified Wall | while both stand, a lethal blow to either leaves them at **1** (once/fight) |
| Guardian+Reaver | Wall & Whisper | Cassia's guard also EXPOSES the frontmost foe **+2** |
| Ranger+Ronin | Marked Charge | woven hit on a MARKED foe **+4 dmg** |
| Cleric+Ranger | Covered Advance | healed ally's next hit also MARKS its target **+2** |
| Ranger+Reaver | Kill Order | woven hit that leaves a foe ≤30% **executes** (Reaver flow) |
| Guardian+Ranger | Anvil & Arrow | when Cassia guards, chip **3** to the frontmost foe |

## Layer A — The Vow (all-out verses)
In `resolveAllOut`, after the encore and before the per-hero finishers:
- For **each awakened pair** (`S.pairsAwake`, both alive) → fire that pair's **Vow verse**: the duet's original 2-stage fx (`RESONANT_PAIRS`), scaled as an all-out flourish (guard/heal/mark/AoE), with a one-line flash.
- If `S.triadFormed` → fire the **Resonant Crown**: the trio's `triadEntry()` stages as the grand finale, scaled up.

The more bonds you wove, the richer the all-out. Party comp shapes the finale.

## Removed / changed
- **Removed:** duet cards, resonant hand card + signature hijack, the Echo Bond card.
- **Kept:** threads/kindling/campfire progression; the thread-form **+2 guard**; the **TRIAD FORMED** ceremony (payoff reworded to "all-out crowned"); momentum/burst/all-out.
- Duet DATA (`RESONANT_PAIRS`) is **reused** as all-out verses; `BOND_WEAVE` is new.

## Test posture
Rework the duet/triad/echo card tests to assert the new behavior: a woven pair sets a live weave (dmgMod fires); the triad crowns the all-out; the all-out plays a verse per woven pair; no duet/resonant cards enter the hand.
