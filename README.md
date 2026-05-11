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

## Live build

Hosted via GitHub Pages — auto-rebuilds on every push to `main`.
**Play it:** https://keeterly.github.io/Triad/

## Iteration workflow

1. Edit files in `C:\Users\keete\Desktop\Triad\Triad-v0.1\` and reload `index.html` to test locally.
2. When ready to push:
   ```
   git add .
   git commit -m "what changed"
   git push
   ```
3. GitHub Pages rebuilds in ~30–60s. Reload the live URL on phone or desktop to see it.

### Versioning (per-branch snapshots)

Each major version gets a branch as an immutable snapshot. Active dev happens on `main`.

```
# when shipping v0.1
git checkout -b v0.1
git push -u origin v0.1
git checkout main   # continue work on main for v0.2
```

## Files

- `index.html` — page structure
- `styles.css` — landscape layout, dark-fantasy palette, juice animations
- `game.js` — characters, enemies, combat, render, input

## Status

Prototype. Single fight only — no map, no run, no recruitment yet. Mechanics sandbox for testing the rearrange-and-pick + stagger loop.
