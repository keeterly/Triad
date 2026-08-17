# The Narrative Engine — v2.2's reason to exist

**Status:** framework + prologue vertical slice shipped at v2.2 Build 1.
v2.2 is a fork of v2.1 Build 316 (combat untouched); everything narrative
lives in `narrative.js` plus five one-line sockets in `game.js`.

The source of truth is the v0.7 handoff, committed verbatim in
[`docs/narrative-handoff-v0.7/`](narrative-handoff-v0.7/). Truth order when
documents disagree: README → STORY_BIBLE → STORY_BEATS → INTEGRATION_PLAN →
STATE_SCHEMA. When the handoff conflicts with the current combat
implementation, **combat wins** and the adapter bends around it — that rule is
the handoff's own.

---

## The shape: five responsibilities, one file

`narrative.js` loads before `game.js` and calls no game function at load time.

| responsibility | where | what it owns |
|---|---|---|
| **State** | `narrState()` | schema v7, persisted at `kizuna2_2.narrative`: campaign act/chapter/rebirths, completed events, reveals, resonance, kizuna pairs, role mappings. Campaign progression survives death — death is diegetic here, never a reset. |
| **Registry** | `NARR_BEATS` | all 29 v0.7 beats, injected **verbatim** from `KIZUNA_STORY_BEATS_v0.7.json`. Ids, triggers, effects are data — regenerate from the handoff, never hand-edit. |
| **Triggers** | `narrTriggerMatches()` | the grammar. Literal signals match directly; `FIRST_PLAYER_DEATH_AFTER:<id>` and `LANDING_AFTER:<id>` are *conditions* that answer the generic `PLAYER_DEATH` / `LANDING` signals once their anchor event is complete. |
| **Runner** | `narrFire(signal, ctx, done)` | plays at most one beat per signal, then walks `CHAIN:` (hard link) and `AFTER:` (soft link) until the sequence is spent, then calls `done`. If nothing is eligible, `done` fires immediately — callers never special-case. |
| **Effects** | `narrApplyEffects()` | `SET_EVENT_COMPLETE / SET_CAMPAIGN_ACT / SET_CHAPTER / UNLOCK_RESONANCE / UNLOCK_SYSTEM / SET_REVEAL / INCREMENT`. Applied when a beat **completes**, not when it starts. |

**The one discipline rule the runner enforces:** an authored beat whose scene
is not written yet is left PENDING, never silently completed. Only `type:
'system'` beats may run sceneless (pure effects). A once-only beat burning
invisibly would erase story the player never saw — the inspector shows these
as `NO SCENE` in red so unauthored content is loud, not lost.

## The combat boundary

The engine **observes** combat; it never reaches in. The sockets in `game.js`:

- `showTitle` → `narrFire('NEW_GAME', …)` wraps NEW GAME; no-op once the prologue is spent
- `onVictory` → `narrFire('COMBAT_VICTORY:' + S.node.storyId)` when an encounter carries a story id (none do yet — this is Act I's socket)
- `onDefeat` → `narrFire('PLAYER_DEATH')`
- `showLanding` → `narrFire('LANDING')`
- `resetProgress` → `narrWipe()` (first-time flow includes the prologue)

No damage formulas, no AI, no turn order, no combat UI. The prologue battle is
a **cinematic** (the handoff's Option B) for exactly this reason: the checked
alternative — an unwinnable scripted fight — would have needed combat to learn
"lose on purpose," and the handoff forbids buying the opening at that price.

## Spoiler safety

Canonical ids (`CREATOR_PRIESTESS`, `PROTAGONIST`, `PREV_TRIO_*`,
`OPENING_FALLEN`) exist in data and internal state only. Every player-facing
name resolves through `narrSpeaker()`, which returns the reveal-safe alias
(`???`, `A TRAVELER`, `THE FALLEN`) until the matching reveal flag flips. The
suite records **every overlay frame the prologue renders** and asserts no
canonical id ever reached the DOM. Role→character mappings stay `null` until
the bible locks them — PROTAGONIST may *present* as Ash someday, but only as
data, never in framework code.

## The prologue (PRO_000 … PRO_008)

Nine beats, one unbroken sequence off `NEW_GAME`, tap-through in the same
rhythm as `showStory`: memory-city → trio engagement (semi-interactive: each
tap lands a strike) → the hesitation → whiteout → black water → **"Rise."**
(speaker `???`) → title card → the first echo (unlocks `PROLOGUE_ECHO_01` as a
data effect, not narration) → ASCEND, then control passes to the existing
entry (tutorial for a first soul, the Landing for a veteran). It happens once,
ever; the next NEW GAME walks straight past it. Scenes are painted the way
this game paints everything — CSS light on a dark stage — and the backdrops
follow the bible's environmental rule: familiar, impossible, emotional.

**The trio is nameless on purpose.** Their identities are PROVISIONAL in the
bible; the scenes describe three figures moving "like one long-practised
sentence" and never assign a face, a class, or a name.

## Player-facing archive, dev-facing truth

- **Journal → ECHOES tab**: completed scenes, reveal-safe titles, replayable.
  Replays present only — effects never re-apply. (The bible's mobile rule:
  essential story must survive an interrupted session.)
- **Settings → DEV TOOLS → NARRATIVE INSPECTOR**: act/chapter/rebirths, all 29
  beats with DONE / ELIGIBLE / waits-on / NO SCENE, reveal flags, role
  mappings, plus run/replay-prologue, skip-prologue, and wipe. This is the
  surface the integration plan asked for instead of dialogue-call logging.

## Testing it

16 checks in the suite's NARRATIVE block (816 total, all green at Build 1):
schema shape, conservative migration (wrong-version saves carry completed
events + reveals across — progression never wipes), the speaker gate both
sides of its reveal, the `*_AFTER` grammar (anchoring enables a beat,
completing it retires it), the no-scene discipline, the combat boundary
(engine source owns no combat verbs), and the prologue played end-to-end
through the real title button — chain integrity, act/chapter/resonance
landing, once-only, and the every-frame spoiler sweep.

`test/playtest-prologue.cjs` walks it with real taps and screenshots every
beat (`test/shots/prologue-*.png`). The screenshot-first law paid immediately:
the first paint had the backdrop trapped in the prose column and stacked over
the text — 816 green checks couldn't see it, one screenshot could. (Cause:
positioning `#overlay-inner` made it the containing block; the landing scene
works precisely because inner stays static. The fix and the reason are
commented in `styles.css`.)

## Harness note

The rigs measure combat, and the prologue now stands in front of it — so
`boot()` seeds a prologue-complete narrative state by default (the exact state
playing it leaves behind). Pass `freshNarrative: true` for the fresh-soul
path. `resetProgress()` wipes narrative too; suite checks that re-enter the
veteran title path after a reset re-seed via `narrSeedPrologueComplete()`.

## What's next (in handoff order, not invented)

- **N3 — Act I skeleton**: `A1_010`–`A1_060` scenes. The sockets already
  fire; each beat needs its scene plus, for `A1_040`, an encounter carrying
  `storyId` so `COMBAT_VICTORY:` finds it. `A1_050` increments `rebirthCount`.
- **N4 — pipeline**: FIRST/REMEMBERED/ECHO repeat variants (the runner's
  `seenCount` already tracks what a variant system needs), authoring
  validation for dangling ids.
- **N5 — later-act hooks**: flags exist in state already; do **not** script
  the beats before the bible locks them.
- TBD lore stays TBD: no protagonist mapping, no trio identities, no
  Priestess name, no Domain names as keys. All of it is data when it lands.
