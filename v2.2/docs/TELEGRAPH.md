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

---

## 6. Build 32 — what the board actually looked like, and what it cost

Everything in §4 shipped. It read badly anyway, for reasons the design notes
could not have caught: the failure was not in the *ideas* but in the number of
them drawn at once, and in two pieces of geometry nobody had measured.

### 6.1 Six marks per lane

A threatened lane was carrying, simultaneously: a lane plate; a second
outline drawn *inside* the plate; four glowing corner brackets; a floor pool;
an expanding shockwave ring; and a floating sum above the plate. Plus a red
nameplate, a red HP bar, a rank numeral tinted red, an afterimage, and — the
loudest of all — a dashed arc from the striking foe. Ten red things, one
message.

Reduced to **one lane bar** per threatened lane, carrying its own text: the
lane's rank at the left cap, the incoming sum at the right.

    III ·············· ☠ 28

### 6.2 The pulse was scaling the mark past its own lane

Measured, at a 999×461 stage, three lanes lit:

| | width |
|---|---|
| lane (BACK slot) | 109 px |
| plate at rest | 119 px |
| plate at pulse peak (`scale(1.16)`) | ~138 px |

A mark that names a lane was 27 px wider than the lane. With neighbouring
lanes lit, the plates merged into one red smear — which is precisely what the
lane plate was introduced to prevent. The pulse also swept the plate *down*
across the nameplate and HP bar beneath it.

**Rule: the telegraph never changes size.** Magnitude is carried by weight —
rim brightness, glow, and breath rate — never by growth. A mark that grows
cannot stay inside the thing it names.

### 6.3 The arc could never have worked

The one honest arc — heaviest blow, foe to target lane — was drawn with a
control point 14 px below the chord. Across ~700 px of field that is a
straight line, and it landed at `slot.bottom - 26`, which is exactly where the
HP bar sits. So it drew as a **dashed rule straight through every nameplate on
the board**.

Sagging it properly does not help: a readable sag over that span is ~110 px,
and the battlefield has ~30 px below the feet line before the hand of cards.
Arcing it *upward* was already rejected for crossing the cast's faces. There
is no room for this line. It is not a tuning problem.

**The aim moved onto the attacker's own pill: `⚔ 16 → III`.** Build 6 removed
`→ BACK` from the pill because four packed foes became a wall of words. A
numeral is not a word — and every lane now wears that numeral on its own bar,
so the two readings name each other. Four foes cost four characters instead of
four crossing dashes.

### 6.4 A keyframe that touches `transform` destroys a centring translate

The lethal sum blinked with `primed-blink`, which sets `transform: scale(.86)`
at 50%. That replaces the whole transform — including the `translateX(-50%)`
that centres the element — so the lethal number jumped half its width sideways
on every blink. Anything centred by transform must not be animated by a
keyframe that writes `transform`. The bar line is positioned by `left`/`right`
instead, and the lethal blink animates opacity.
