# Triad

Dark-fantasy roguelite RPG prototype. Mobile landscape. ATB-style action queue + stagger, played as a 3-fight gauntlet with branching encounter choice and persistent damage between fights.

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

## Adjacency synergies

Each pair of characters in adjacent slots has a named synergy — and a *different* synergy depending on whether the pair is on the **Front-Mid** line or the **Mid-Back** line. The synergy name appears as a small chip on the facing edge of each card; green = bond, red = friction.

| Pair | Front-Mid | Mid-Back |
|---|---|---|
| Cassia + Elin    | **Sister's Watch** — Cassia hit → Elin +1 Resolve | **Veiled Vow** — Elin heals anyone → Cassia +1 armor |
| Branwen + Cassia | **Old Rivalry** (friction) — Branwen's outgoing damage −2 | **Banner Fire** — Cassia grants armor → Branwen's next attack +2 dmg |
| Branwen + Elin   | **Spirit Arrow** — Branwen attacks → Elin's next heal +2 | **Mercy's Gift** — Elin heals → Branwen +1 HP |

Pending one-shot bonuses (next-attack/next-heal) show as gold chips on the receiver's card and consume on use.

## Stagger loop

Each enemy has a chain gauge under their HP. Damage builds it (Vulnerable hits build x2). At full, the enemy is **Staggered** — skips their next action and takes +50% damage. That's your burst window.

## Run structure — three reaches

A run is three fights, called **reaches**. After each win you pick one of two encounters for the next reach, so a run is 2×2×2 = 8 possible paths. Things that persist between fights: **HP** (including downed status — a fallen character stays down for the run), **Resolve** (capped at 3 between fights so you can't bank it forever), and **pending one-shot bonuses** like Spirit Arrow's +2 heal. Things that reset: armor, statuses (bleed/weak/vuln/taunt/retaliate), the queue, the turn counter, and the enemy roster. Wipe at any point ends the run.

### New enemies introduced in later reaches

| Enemy | Target tag | What it punishes |
|---|---|---|
| **Line Caster** *(Sin of Voices)* | `F+M` / `M+B` | Hits a *pair* of adjacent slots at once. Tight bond formations get caught in the crossfire — split the line, eat the AoE, or armor through. |
| **Sniper** *(Sin of Distance)* | `M+B>` | Pierces past Front to hit Mid and Back. Squishy supports in the back row can't hide. Closer it sits, the more it hurts. |
| **Grappler** *(Sin of Grasp)* | `M` (pull) | Hooks your Mid character into Front and disrupts adjacency lines. Either pre-empt the pull or accept the formation shift. |

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

Prototype v0.3. Three-fight run with branching encounter choice; HP/Resolve persist between fights. Six hand-built encounters, six enemy types. No recruitment, no map screen yet — pacing is "fight → pick → fight → pick → fight".
