# The telegraph and the lunge — why they fight, and what other games do about it

**Status:** analysis, v2.2 Build 28. Supersedes the reasoning behind Build 23
(lane plates + apron + anchor), which treated the symptom and left the cause.

---

## 1. The problem, measured

Live board, three heroes, two of them mid-combo and holding their peak pose:

| | value |
|---|---|
| lane pitch (distance between row centres) | **128 px** |
| hero sprite width | **109 px** |
| front row's held travel (`--adv` 96 + peak 30) | **126 px** |
| "apron" drop that is supposed to read as stepping downstage | **7–8 px** |

Two consequences fall straight out of those four numbers:

- **A sprite is 85% as wide as a lane.** Any forward travel beyond ~19px puts
  part of a hero's body over the neighbouring lane's ground. There is no
  tuning of the lunge that avoids this while the lunge is still worth having.
- **The front row's travel is one whole lane pitch.** A held front hero stands
  exactly one lane ahead of the ground they own. Measured: Ash's body sits at
  476–586 while his own plate is 361–476 — he is completely off it. Hask (mid)
  covers 65px of the *front* lane's plate, 57% of it.

The Build 23 apron is 7px. It does not read as "stepped out of the line"; it
reads as nothing. So the mitigation dressed the problem without moving it.

## 2. Why it is structural, not a bug

One surface is being asked to do two incompatible jobs.

- **The ground is the BOARD.** Rows are the game's core grammar — your hand is
  your position, an enemy blow is aimed at a row, moving swaps your kit. A
  board has to hold still to be read.
- **The ground is also the STAGE.** The Golden Sun beat system is the best
  thing in the combat: strike, hit-stop, hold the pose, next hero, finisher
  releases everyone. Theatre needs the actors to leave their marks.

Every game that does both successfully separates them. We didn't.

## 3. How other games handle it

### Family A — keep the board still
- **Darkest Dungeon** is our closest cousin: four ranks a side, skills gated by
  the rank you stand in and the ranks they reach — our exact grammar. Its
  characters *do* lunge, but the lunge is **transient**; they snap back at
  once. Rank identity is further nailed down by strict left-to-right ordering,
  and shuffle effects visibly swap the sprites. The board is stable in every
  moment you are actually reading it.
- **Into the Breach** is the gold standard for telegraphing: every enemy attack
  is shown on the exact tiles it will strike, before you commit. Units never
  leave their tile while the telegraph stands, and the telegraph is drawn
  **over** the units, not under them.

**Cost to us:** closed. Transient lunges are precisely what we chose against.

### Family B — move the truth off the ground
- **Slay the Spire** puts intent above the *attacker*. The defender has no
  position to lose, so nothing can desync.
- **Grandia** carries the whole threat model in a HUD — the IP bar shows who
  acts when, with what kind of action, and where the cancel window is — which
  frees the field entirely for characters to run around in.
- **XCOM** anchors information to the target and the HUD (hit chance,
  overwatch cones); the shooter animates however it likes.
- **Sea of Stars** and its peers show incoming attacks as locks/counters near
  the enemy, naming the target rather than painting the floor.

**Cost to us:** we lose "the blow lands *here*, on this ground" — which is the
read that made the ground telegraph good in the first place.

### Family C — separate the stage from the board
- **Fire Emblem** shows danger zones on the tactical map, then plays the
  cinematic attack in an entirely **separate view**. The board is never
  disturbed by the theatre because they never share a frame.

**Cost to us:** a cutaway per action would wreck the combo rhythm.

### Family D — the overlay outranks the actors
- **Into the Breach** again: the truth is drawn on top of everything. Whatever
  a sprite does, it cannot hide what is about to happen.

**Cost to us:** almost none. This is free and we are not doing it.

## 4. What this says about our design

The lunge is not negotiable and the row grammar is not negotiable, so Family A
and C are out. The answer is **B + D**, with the ground kept as flavour rather
than as the load-bearing signal:

1. **Anchor the threat to something that never moves.** The nameplate already
   stays home by decree — it is the natural home for the authoritative read.
   Threat becomes part of the nameplate strip (row, name, incoming), so it is
   immune to whatever the body is doing.
2. **Draw the board over the theatre.** The lane plate currently renders
   *behind* the figures. A hero standing across a plate erases it. Into the
   Breach's rule says the opposite: the plate should read through the body.
3. **Leave the hero's own shape in their lane** — an **afterimage**: a
   translucent silhouette of the hero standing where they belong while their
   body is out at full extension. It answers "whose lane is this" with the
   strongest signal available, and it is *already our fiction* — this is a
   game about echoes, and Ash literally kindles a node called Afterimage.
4. **Name the ranks.** Darkest Dungeon's ordering lesson, made explicit: a
   small I / II / III on each lane so rank survives any amount of visual noise.

## 5. What we deliberately do not take

- **A full formation HUD** (Grandia's bar for position). It would be the most
  legible option and the least characterful; the diorama is the game's face.
  Held in reserve if the above measures still test badly.
- **Shorter lunges.** Tried at Build 23 (112→96). The arithmetic above shows
  it cannot work: the sprite is 85% of a lane.
- **Snapping heroes home to read the board.** It would solve everything and
  destroy the beat system.
