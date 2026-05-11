# Triad

Dark-fantasy roguelite RPG prototype. Mobile landscape, single-fight combat sandbox. ATB-style action queue + stagger.

## Core mechanic

Three party members occupy three slots — **Front · Mid · Back**. Each turn you spend a **3-point ATB budget** on a queue of actions, then commit with **Fight**. Queued actions resolve top-to-bottom against the live battlefield, then enemies act.

Per character (tiles are contextual to that character's slot):

| Action | ATB | Resolve | Effect |
|---|---|---|---|
| **Attack** | 1 | — | Basic technique for the character's current slot |
| **Special** | 2 | 1 | Signature technique for the current slot |
| **Move ←/→** | 1 | — | Step one slot toward Front or Back, swapping with whoever's there |

Plus a **Team Special** that consumes the full ATB bar and 3 Resolve. Its effect depends on formation: home order (Cassia/Elin/Branwen) → *Sacred Triad*; full reverse → *Last Reach*; Cassia-mid-Branwen-front → *Hunter's Wedge*; other formations → *Triad Strike*.

Because actions resolve in order against live state, queuing **Move → Attack** uses the character's *new* position for the attack. Variable ATB costs force real trade-offs: 3 cheap attacks vs 1 special + 1 attack vs the full ultimate. Characters are extreme specialists: one *home* slot is devastating, others fall off. Enemies telegraph the **slot** they target so positioning is the puzzle.

### Reach

Every damaging action has a **reach** — the enemy slots it can hit. Cassia and front-shoved abilities are melee (front only). Branwen's mid-row shots are **mortar-style** (mid/back, skipping the front line). Her back-row attacks reach the whole field. If an action's reach is empty (e.g., front enemy already dead and you queued a melee strike), it fizzles.

**Hold any action tile (~220ms)** to preview the highlight on enemies it would hit. Release to dismiss the preview. A short tap queues the action as before.

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

Prototype v0.2. Single fight only — no map, no run, no recruitment yet. Mechanics sandbox for the queue-build + stagger loop.
