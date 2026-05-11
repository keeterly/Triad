# Triad

Dark-fantasy roguelite RPG prototype. Mobile landscape, single-fight combat sandbox.

## Core mechanic

Three party members occupy three slots — **Front · Mid · Back**. Each turn you pick one action:

- **X / Y / Z** — the technique of the character currently in Front / Mid / Back. Tap = basic, hold = signature (costs 3 Resolve, locks that slot one turn).
- **Move** — swap two members (consumes the turn, no attack).
- **Defend** — +3 armor party, +1 Resolve.

Characters are extreme specialists: one *home* slot is devastating, others are weak. Some attacks reposition the character mid-combat (Cassia Mid → advances to Front; Branwen Front → retreats to Back). Enemies telegraph the **slot** they target — sometimes shoving your party out of formation.

## Stagger loop

Each enemy has a chain gauge under their HP. Damage builds it (Vulnerable hits build x2). At full, the enemy is **Staggered** — skips their next action and takes +50% damage. That's your burst window.

## Run locally

```
open index.html
```

No build step. Vanilla HTML/CSS/JS. Landscape orientation required (a rotate-prompt shows in portrait).

## Files

- `index.html` — page structure
- `styles.css` — landscape layout, dark-fantasy palette, juice animations
- `game.js` — characters, enemies, combat, render, input

## Status

Prototype. Single fight only — no map, no run, no recruitment yet. Mechanics sandbox for testing the rearrange-and-pick + stagger loop.
