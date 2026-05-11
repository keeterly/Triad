# Triad

Dark-fantasy roguelite RPG prototype. Mobile landscape, single-fight combat sandbox. ATB-style action queue + stagger.

## Core mechanic

Three party members occupy three slots — **Front · Mid · Back**. Each turn you build a **3-slot action queue** and commit it with **Fight**. Queued actions resolve top-to-bottom against the live battlefield, then enemies act.

Per character (tiles are contextual to that character's slot):

- **Attack** — free. Basic technique for the character's current slot.
- **Special** — costs **1 Resolve**. Signature technique for the current slot.
- **Move ←/→** — free. Step one slot toward Front or Back, swapping with whoever's there. Front character can only retreat; Back can only advance; Mid picks a direction.

Plus:

- **Team Special** — costs **3 Resolve**, fills the whole queue. The effect changes with formation: home order (Cassia/Elin/Branwen) unlocks **Sacred Triad**; full reverse unlocks **Last Reach**; other combinations get **Triad Strike** or named alternates.

Because actions resolve in order against live state, queuing **Move → Attack** uses the character's *new* position for the attack. The same character can fill all three queue slots — burst potential if you give up positional flexibility. Characters are extreme specialists: one *home* slot is devastating, others fall off. Enemies telegraph the **slot** they target so positioning is the puzzle.

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
