# PARRY-SPEC — what the parry is today, and what it must become

*Diagnosis measured against v2.2 Build 36, headless Playwright, real fights driven
through the shipping input pipeline (`test/harness.cjs` auto-parry, frame-perfect
and 60%-skill bots). All numbers below were either read out of `game.js` or
measured live; where the two disagreed, the measurement is reported.*

---

## 1 · The measured system, as shipped

### Timing windows (ms remaining before ring close — one-sided, no late grace)

| grade | tap / feint | swipe | hold | mash | bait |
|---|---|---|---|---|---|
| PERFECT | last **170ms** | last **250ms** | hold at close (any timing) | ≥count taps (any timing) | touch nothing |
| GREAT | last **340ms** | — | — | — | — |
| GOOD | last **540ms** | any earlier swipe | held once, let go | ≥half count | — |
| MISS | tap after close = same as no tap | wrong arc / none | never pressed | <half | tapped it |

All three tap bands scale by `_parryWin`: ×1.0 at surface → **×0.80 by depth 12**
(perfect 170→136ms). A tap **1ms after ring close is a full MISS** — the listener
is removed at timeout. Early taps are forgiven ("WAIT…" nudge, note keeps
listening).

### Note lifetimes and cadence

- Music **is** beat-synced and it works: with `combat-theme.mp3` playing
  (confirmed live in-harness), cascade notes land on the 120 BPM grid —
  **one note per 500ms**, ring lifetime ≈ one beat (measured 447–500ms).
- Free-run (music off, or any boss cascade with a trick note): first note
  `660·speed·1.30` ≈ 858ms, later notes `560·speed·1.30` ≈ 728ms, gaps 160ms.
  Per-foe `parrySpeed` multiplies all of it: **0.785× (deep boss) to 1.4× (brood)**
  — cadence swings ±50% between foes in the same room.
- Single tap 820ms · hold 1170ms (820 in-seq) · mash 1495ms · feint +320ms
  mid-close pause · bait 700·speed. `PARRY_PACE = 1.30` global.
- Lead-in: 460ms `SEQ_LEADIN` (170ms if the wind-up tell just played);
  the tell itself is 460ms first time, 270ms after.

### Volume and share of play (measured)

| fight | notes/attack | parry share of wall-clock |
|---|---|---|
| husk+wraith pack, played normally | 2–3 | **20–28%** of a ~15s, 3-turn fight |
| same pack, pure defense | 2–4 | 44% |
| revenant elite, pure defense | 3–5 (cascades 1.5–2.5s) | 54% |
| echoknight boss, pure defense | 5–7 (cascades **3.2–4.6s**) | **66–72%** |
| echoknight2, 4 turns | 38 notes across 6 attacks | 66% |

### Outcome economics

- Per-note mitigation weight: perfect 1.0 · great 0.88 · good 0.72 · miss 0.
  Attack damage taken = `1 − avg(weights)`.
- **All-perfect** pattern → damage ×0 (`PARRY_PERFECT_MULT 0`), +18 momentum,
  poise −1 (break route), +1 ember, and on ≥2-note patterns a **riposte of
  4 × notes** (+7 momentum). `BURST_MIN` is 100, so one perfect cascade is ~25%
  of an all-out.
- Partial → `+5 + 11·mit` momentum (≈15 when you catch everything at "great").
- Miss → the note's share lands at **1.0×** (no punish multiplier since B288).

### The damning measurements

1. **The top of the system never fires.** A frame-perfect bot played four fights
   and 61 notes and **never fully negated a single cascade** — every cascade
   resolved partial. Full negate + riposte requires *every* note perfect: taps in
   a one-sided 170ms band, swipes in 250ms, across 5–7 notes. The riposte, the
   FLAWLESS banner, the poise-chip route — the whole Clair Obscur fantasy — is
   dead content in ordinary play. (On cascades `perfect` and `flawless` are the
   same flag, so the two-tier reward the code intends doesn't even exist.)
2. **The modal outcome has no styling.** GREAT was 60–80% of all graded notes in
   every measured fight, and `prt-great` / `pb-great` / `pf-great` /
   `pr-land-great` have **no CSS rules** — the most common thing a player does
   renders as unstyled text, no ring pop, a generic white flash. Weaker feedback
   than GOOD.
3. **The taught cue is a lie in synced mode.** The coach says "tap the instant
   the ring glows gold", but gold-on happens at `dur − GOOD` = 500 − 540 <
   0 — synced rings spawn **already gold** (measured `live@0–8ms` on every mob
   tap). Tapping on the glow yields the *worst* catchable grade (GOOD, 28%
   bleed-through).
4. **Bosses never play on the music.** Any boss cascade of ≥3 notes gets a feint
   injected, tricks set `synced = false`, and the whole cascade leaves the beat
   grid (measured: every echoknight/echoknight2 cascade free-ran at 616–740ms
   intervals). The set-piece fights — the ones the rhythm identity is for — are
   the only fights *not* on the grid.
5. **A miss never says why.** Late tap (the dominant human failure under a
   one-sided window), wrong-direction swipe, and never-touching all print the
   same word: MISS. The `'early'` branch in `noteFeedback` is unreachable dead
   code (early taps route to the WAIT nudge).
6. **The pattern preview never shipped.** `parryGlyph()` (⊙⊙ / ▭ / ➤ / ✷N on the
   intent pill) is called only by tests; `.i-parry` CSS is orphaned. The player
   cannot see *which* string is coming, so intents can't be planned around —
   the comment in `parryPatternFor` claims otherwise.
7. **There is no accessibility path.** `PARRY_ENABLED` is a compile-time const;
   settings offer sound/music/haptics/background only. The depth ramp tightens
   windows 20% and speeds cascades 16% with no opt-out, and a player who cannot
   do timing eats 100% of every blow, forever.
8. Minor rot: `PARRY_GREAT_MULT` (0.22) is defined and never used (the real
   weights are hardcoded 0.88/0.72, and the header comment says 0.12/0.28);
   the `parryRhythm` groove table is bypassed whenever music plays.

## 2 · Judgment

**Is it rhythm or reaction? Neither, and that is the core failure.** The
beat-grid, the cascade cadence, and the anticipatory gold cue are rhythm-game
furniture — but the windows are *reaction* windows: one-sided, measured backwards
from a visual close, with instant death for lateness. A player who does the
rhythm-correct thing — tap on the felt beat, where the strike lands and the music
pulses — puts half their taps 1–80ms after close and gets MISS. The optimal
strategy is to systematically tap *ahead* of the beat, which fights the music the
game itself synchronizes to. Sekiro's parry is reaction with generous buffering;
Paper Mario is anticipation with symmetric tolerance; this is anticipation graded
by reaction rules.

**The experienced game is mush.** Because negate-everything is unreachable and
miss-everything is rare, virtually every attack resolves in the 72–88% band:
a small number bleeds through, a partial popup fires, the (unstyled) GREAT text
flashes. Stakes per note are low, the top prize never pays, and mastery has no
visible ceiling. Meanwhile the *cost* structure is fine — a fluffed mob note is
3–5 damage, genuinely survivable — the problem is entirely on the reward side.

**Repetition scales wrong at the fight scale, right at the boss scale.** The
boss numbers are actually good — 5–7-note cascades, 66–72% of the fight, feints
and baits reserved for it: a boss *is* a parry gauntlet, which is the correct
shape. But every trash jab also runs the full ritual (tell → dim → lead-in →
cascade → camera), and mob patterns collapse to tap-tap / tap-swipe at wildly
different per-foe tempos, so the mid-fight texture is "same two gestures at
arbitrary speeds". Depth difficulty is a physics screw (tighter windows, faster
rings) rather than richer asks.

**What already works — keep all of it:** the wind-up tells and gesture-specific
poses; per-intent authored patterns; weighted partial mitigation (catching 3 of
4 mattering is genuinely better than binary); parry-as-burst-engine; poise chip
on a clean read; the ergonomic thumb zones; early-tap forgiveness; the seq
preview arc with numbered dots; the camera sway and slow-mo grammar; the
riposte *staging* (held frame → counter) — it is beautifully directed and almost
never seen.

## 3 · The specification

**North star:** every enemy attack is a bar of music you can hear coming. You
read the pose, see the string on the telegraph, and tap *on the beat* — on the
beat, not before it. Catching the whole bar cleanly turns the blow; catching it
perfectly answers it. A bad-timing player picks GUARD and plays a different,
honest defense. Nobody is ever asked to react in under 200ms to a surprise.

### 3.1 Windows — symmetric, centered on the beat

The impact instant (`ring close` = `bossAttackBeat` = the audio beat when
synced) becomes the **center** of the window, not its end:

| grade | offset from beat | notes |
|---|---|---|
| PERFECT | **±80ms** (160ms total) | ≈ touch latency (56–78ms measured medians, per game.js:90) + human jitter on an anticipated beat (~±60ms) |
| GREAT | **±140ms** | |
| GOOD | **±220ms** | late side included — a late catch is a catch |
| MISS | outside ±220ms, or no input | |

- Constant at all depths and for all foes. **Delete `_parryWin` entirely.**
  Difficulty never touches the physics of a tap (see 3.5).
- Ring animation retimed so the ring closes onto the target circle at beat
  center and *overshoots* slightly through the late window — the visual no
  longer implies "close = too late".
- The note keeps listening for **+350ms after the good window** purely to label
  the failure LATE (input consumed, still 0 mitigation).
- Swipes are graded by when the arc-match completes, same table. Holds are
  graded twice: press on its beat (same table) and release on the marked release
  beat (±140ms for full credit) — see 3.2.
- These wider bands are *paid for* by the reward restructure in 3.3: mush is
  removed by making grades mean different outcomes, not by making the top grade
  untouchable.

### 3.2 Rhythm, always — the grid is the contract

- **Every note lands on the beat grid, no exceptions.** Synced: 120 BPM grid as
  today. Music off: a fixed 500ms internal grid with an audible tick per note
  spawn (`SFX`), so the beat is hearable even silent-mode players get from the
  ring pulse. Delete the `parryRhythm`/`seqRhythm` free-run groove tables and
  `SEQ_LEADIN` special-casing — the grid plus a fixed 2-beat lead-in replaces
  them.
- **Tricks stay on the grid.** Delete `synced = playing && !tricks`. FEINT is
  redefined as a **rest**: the ring freezes for exactly one beat (telegraphed by
  the pulse skipping) and its impact moves to the next grid point — a
  syncopation you can count, not a random 320ms hesitation. BAIT already is a
  rest note (a beat you must not touch) — keep it, boss/elite only, unchanged.
- **Note spawn = 2 beats before impact**: one beat of dim approach, one beat
  live. The gold glow now means "*next* beat is yours" — a true anticipation
  cue instead of a lie. Coach copy changes to: *"Feel the beat — tap as the
  ring lands."*
- Subdivision replaces speed: a foe's intensity is *whole beats* (mobs, road
  bosses) or *half-beats on marked pairs* (elite flurries, megaBoss late
  stages). **Delete per-foe `parrySpeed` as a time multiplier** and the boss
  ×0.92 — cadence is always 500ms or 250ms, musical by construction.

### 3.3 Vocabulary — five notes, every one a timing ask

| note | ask | grading |
|---|---|---|
| **TAP** ⊙ | tap on the beat | 3.1 table |
| **HOLD** ▭ | press on this beat, **release on the marked later beat** | press + release each graded; both great+ = perfect |
| **SWIPE** ➤ | trace/flick the arc so it completes on the beat | 3.1 table |
| **REST** ✕ (was BAIT) | touch nothing for one beat | binary, boss/elite only |
| **SKIP** (was FEINT) | ring rests one beat, then its beat comes | 3.1 table on the delayed beat |

- **Delete MASH.** It is the one gesture with zero timing content, it breaks the
  rhythm frame, and it grades binary. `d ≤ 2` flurry attacks become two taps on
  a half-beat pair — the "primer" jab becomes an actual rhythm lesson.
- Keep pattern derivation from intent (heavy → tap-hold-tap-swipe, row:all →
  across-sweep + taps, etc.) and authored `intent.parry` overrides — the
  Build 284 promotion rules are good.
- **Ship the pattern preview**: wire `parryGlyph(intent)` into `intentSeg()`
  (`.i-parry` CSS already exists). Reading the intent row now tells you *what
  you will play*, which is the JRPG plan→execute link the telegraph was built
  for.

### 3.4 Grades, rewards — a reachable curve instead of a cliff

Per-note mitigation: perfect **1.0** · great **0.9** · good **0.6** · miss **0**.
(Good drops from 0.72: with symmetric windows GOOD is now genuinely sloppy, and
the gap makes grades legible in the HP bar.)

Attack resolution:

- **TURNED (full negate)** — every note **great or better**. Damage ×0. +18
  momentum, poise −1. This is the reachable mastery tier: the green promise
  ("the screen never lies") at a standard a good human hits most attempts.
- **FLAWLESS** — every note **perfect**. Everything TURNED gives, plus the
  riposte (`4 × notes`, through the hero's school), +7 momentum, +1 ember, and
  the held-frame counter cinematic. Now truly distinct from TURNED — the
  `flawless`/`perfect` duplicate flag gets a real meaning; expect it roughly
  1-in-4 cascades from a skilled player, near-never at half-beats.
- **PARTIAL** — anything else: `1 − avg(weights)` lands; `+5 + 11·mit` momentum.
- **MISS costs stay as-is** (missed share at 1.0×, never amplified — Build 288's
  call was right).
- **Fight-scale mastery:** the combo counter persists across the whole fight; at
  10 / 20 / 30 linked notes it pays a +6 momentum surge with a callout. A great
  parry player now feels it in all-out frequency, not just in a mitigation
  number.

### 3.5 Difficulty — scale the ask, never the physics

| tier | notes | subdivision | vocabulary |
|---|---|---|---|
| mob | 2–3 | whole beats | tap, swipe, hold |
| elite | 3–5 | one half-beat pair allowed | + skip |
| road boss | 5–7 | half-beat pairs | + rest; one skip AND one rest max per cascade |
| megaBoss | authored strings | half-beats in late stages | full vocabulary |

- Depth ramp: keep `_parryBonus` note-count growth (+0 → +2, boss +1) —
  **but appended notes echo the pattern's own vocabulary** (repeat its last
  non-trick note) instead of bolting generic taps onto an authored string.
- **Delete `_parryWin` and the `_parrySpeed` depth term** (Build 206's two
  screws). Deep runs get denser bars and richer vocabulary, never smaller
  physical targets. Trash stays 2–3 notes at depth 12 — its job is texture and
  burst income; the drama lives in the boss cascade, which the measurements show
  is already correctly the majority of a boss fight.

### 3.6 Feedback — every outcome tells you what happened and why

- **PERFECT** — gold, clash SFX, slow-mo pop, ring-land burst (exists, keep).
- **GREAT** — **ship the missing tier CSS**: `prt-great` (silver-gold, 18px,
  between perfect and good), `pb-great` ring, `pf-great` flash,
  `pr-land-great` pop. One line each; the modal outcome must land the hit.
- **GOOD** — amber, smaller, a visibly duller thunk.
- **MISS, with a reason, always:** `LATE` (input inside the +350ms label
  window) · `EARLY` stays the non-consuming WAIT nudge · `WRONG WAY ↶` for a
  mis-directed swipe (show the correct arc glyph) · `BAITED!` on a touched
  rest · bare `MISS` only for no input at all. Delete the unreachable `'early'`
  word branch in `noteFeedback`.
- **Post-cascade receipt** (1s, at the ring anchor): `“4/5 TURNED — 3 dmg
  through”` — the line that connects grades to the HP bar, which nothing does
  today.
- Layout: ratings spawn **above** the ring; the combo counter docks to the top
  corner of the parry zone (measured collision: GREAT ×4 text, combo counter,
  and live ring all stacked at one point mid-boss-cascade). Never more than one
  live ring + one approach ring visible; cascade UI stays inside the thumb zone
  and off the hand/cards, as now.

### 3.7 Accessibility — a real path that is not losing

New setting, **PARRY STYLE** (menu + pre-run, switchable mid-run, no penalty
flag anywhere):

- **FULL** — everything above.
- **STEADY** — windows ×1.6 (perfect ±128ms), whole beats only, no skip/rest,
  cascades capped at 5. Full rewards, honest label ("a steadier drumbeat").
- **GUARD** — no timing input at all. Every attack auto-resolves at 60%
  mitigation (the GOOD line) with the ward flash playing over the hero; partial
  momentum accrues at the same formula; ripostes/embers don't fire, and in
  exchange the party gains **+2 guard per hero per turn** — a different defense
  economy with its own identity, not a charity discount. The cascade UI simply
  doesn't spawn; enemy attacks keep their tells and art, and fights get ~40%
  shorter — which some players will pick for pace alone. That is the point.
- `PARRY_ENABLED` const is superseded by this setting (keep the const as the
  harness kill-switch). `camReduced()` already handles reduced motion — also
  gate the slow-mo flashes behind it.

### 3.8 Delete list (as important as the additions)

- MASH note, its UI, CSS, and coach line.
- `_parryWin` and every window-tightening site; `_parrySpeed` as a tempo
  multiplier and per-foe `parrySpeed` data (replaced by subdivision tier).
- `synced && !tricks` — the trick escape from the beat grid.
- `parryRhythm` / `seqRhythm` groove tables and `SEQ_LEADIN` (grid + 2-beat
  lead-in replaces all three).
- `PARRY_GREAT_MULT` (already dead) and the stale window comment block above it.
- The one-sided `rem ≤ PERF` grading in tap/feint/swipe (replaced by signed
  offset from beat center).
- "Wait for the ring to glow gold — then TAP" coaching (replaced by beat-front
  copy).
- The `flawless === perfect` duplication on seq results.

### 3.9 Harness contract (so the bots keep measuring honestly)

Rings keep exposing close time via `.pr-close` `animationDuration`; add
`data-impact` (epoch ms of beat center) so `test/harness.cjs` can aim at the
beat rather than "close − 200ms", plus `data-release` on holds. Skill<1 bots
should miss late as often as early now that both exist. `parryGlyph` finally
gets a shipping call site, so `flow.test.cjs`'s existing assertions become real
UI tests.

---

*Measured artifacts: `test/shots/01-cascade-early.png` … `04-cascade-bait.png`
(live boss cascade, trick notes, and the rating/combo collision), plus the
parrymeter runs logged in the session that produced this spec.*

---

## 4 · What shipped — Build 38, and what it measures

The spec above was written from measurements of the old system. This section
records what was actually built against it, and the numbers the rebuilt system
produces, so the next person to touch the parry starts from evidence rather
than from this document's intentions.

### 4.1 The measurement rig was lying, and that came first

Before any game code changed, two faults in the test harness had to be fixed,
because every difficulty number this project has ever produced about parries was
measuring them rather than the game.

The first: `test/harness.cjs` scaled `setTimeout` and `setInterval` under
`fastCombat`, but left `Date.now()` running at wall speed. The parry grader
measures `Date.now() - t0` against the note's duration. So at a 0.06 scale a note
scheduled for 700 game-ms closed after 42 real milliseconds while the grader
still saw 42ms elapsed against a 700ms beat — every bot tap read as wildly early,
in every suite run, for the entire life of the rig. The harness now installs a
monotonic virtual clock that rebases on each scale change, so game-time and
timer-time are the same time again.

The second: the auto-parry bot deliberately aimed at "close minus 200ms". Under
one-sided windows that was the sweet spot. Under windows centred on the beat it
is a 200ms-early read, which is precisely the band the new grader downgrades.
Notes now publish `data-impact` (and holds publish `data-press`), and the bot
aims at the beat.

Neither fix changes a line of game code. Both change every number.

### 4.2 The bands, measured

`test/parrymeter.cjs` drives real cascades with a bot whose aim can be biased by
a known number of milliseconds, and reads the grades straight off the screen —
what it counts is exactly what a player is shown. Sweeping the bias:

```
   -260ms   perfect  0%   great   0%   good   0%   late   0%   miss 100%
   -160ms   perfect  0%   great   7%   good  93%   late   0%   miss   0%
   -100ms   perfect 17%   great  83%   good   0%   late   0%   miss   0%
    -40ms   perfect100%   great   0%   good   0%   late   0%   miss   0%
     60ms   perfect100%   great   0%   good   0%   late   0%   miss   0%
    120ms   perfect  0%   great 100%   good   0%   late   0%   miss   0%
    190ms   perfect  0%   great   0%   good  92%   late   8%   miss   0%
    300ms   perfect  0%   great   0%   good   0%   late 100%   miss   0%
```

That is the §3.1 table, symmetric, both sides of the beat, exactly as specified.

And the question the whole rebuild existed to answer — is the top of this system
reachable at all? The old measurement was *a frame-perfect bot played 61 notes
across four fights and never once fully negated a cascade.* The new one:

```
DEAD ON THE BEAT (40 notes)
  perfect 39   great 0   good 0   late 1   miss 0
  cascades: 15   turned+ 14 (93%)   flawless 14
```

### 4.3 What was built

- **Symmetric windows** centred on the beat (`parryGrade(off)`), ±80 / ±140 /
  ±220, with a 200ms tail that grades LATE rather than MISS. A note now outlives
  its own beat, so a late catch is a catch.
- **Two tiers where there was one cliff.** TURNED (every note great or better)
  fully negates the blow. FLAWLESS (every note perfect) adds the riposte, the
  counter cinematic, and the ember. The `perfect`/`flawless` duplicate flag
  finally means two different things.
- **Weighted mitigation** — 1 / 0.9 / 0.6 / 0 — so the grades spread across the
  HP bar instead of bunching in a mushy band nothing the player did could escape.
- **Difficulty scales the ask, not the physics.** `_parrySpeed` and `_parryWin`
  are pinned at 1. Depth buys denser cascades; the tap is the same size on floor
  one and floor four.
- **MASH is deleted.** It was the one gesture with no timing content. The jab it
  used to cover is a two-tap primer now — the shortest possible lesson in the
  thing every other note is built from.
- **A brace is two beats.** HOLD asks for a press on a marked beat and a release
  on the close, grades both, and takes the worse. A hold you could answer by
  pressing at the start and never lifting was not a read.
- **A deflect is a beat too.** SWIPE was graded `rem <= 250` from the ring's
  close — one-sided and a quarter-second generous early. Measured, the bot's
  clean sweep graded GOOD on 100% of deflects, which capped every cascade
  containing one below full negate no matter how well it was read.
- **Trick notes stay on the grid.** A feint spends two beats, a bait spends one.
  A trick is a rest inside the rhythm, not an escape from it.
- **The telegraph names the read.** `parryGlyph()` finally has a call site: every
  intent pill carries the gesture it will ask for. Reading the intent row tells
  you what you will play.
- **The chain is fight-long and pays.** Linked notes surge the burst gauge at 10
  / 20 / 30 / 45 / 60, so reading well is felt in how often the all-out comes up.
- **PARRY STYLE**, three ways to play the defence: FULL, STEADY (the same windows
  1.7× wider — every grade still reachable, every reward still available), and
  GUARD (no timing at all; blows half-land and the party stands +2 guard a turn).
  The last is a different economy, not a penalty box.
