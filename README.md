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

## Files

- `index.html` — page structure
- `styles.css` — landscape layout, dark-fantasy palette, juice animations
- `game.js` — characters, enemies, combat, render, input

## Status

Prototype v0.2. Single fight only — no map, no run, no recruitment yet. Mechanics sandbox for the queue-build + stagger loop.
