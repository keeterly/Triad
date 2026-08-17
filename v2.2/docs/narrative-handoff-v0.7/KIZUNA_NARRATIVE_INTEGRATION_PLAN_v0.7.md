# KIZUNA | RESONANCE — Narrative Integration Plan
## Version 0.7

## 1. Integration objective

Add narrative progression to the existing game without disturbing the completed combat system. The story layer should observe game state and request existing presentation/gameplay actions through adapters rather than own combat logic.

## 2. Recommended architecture

Use a data-driven event system with five responsibilities:

1. **Narrative state** — persistent flags, counters, relationship values, memory unlocks, reveal state.
2. **Event registry** — content definitions indexed by stable event ID.
3. **Requirement resolver** — determines whether an event is eligible.
4. **Event runner** — plays dialogue/cinematic/camera/UI actions using existing game systems.
5. **Effects resolver** — applies narrative flags, unlocks, Archive entries, Kizuna deltas, and content gates.

Narrative code should not know how damage, skills, enemy AI, targeting, or combat turns work.

## 3. Combat integration boundary

Allowed narrative observations:

- combat started / ended
- boss ID
- victory / defeat / retreat
- party composition
- character alive/downed state at end
- skill/ability used, only if existing code already emits such events
- phase reached, only if existing boss system exposes phases cleanly

Allowed narrative requests:

- start encounter by existing encounter ID
- choose an existing scripted boss variant
- show pre/post-combat scene
- set narrative flags after a result

Disallowed unless separately requested:

- new damage formulas
- skill redesign
- AI rewrite
- turn-order rewrite
- combat UI replacement
- broad combat refactor for narrative convenience

## 4. Stable role IDs

Use role IDs rather than names where identity is intentionally hidden.

- `PROTAGONIST`
- `CREATOR_PRIESTESS`
- `UNKNOWN_VOICE` is a display alias, not canonical speaker identity
- `PREV_TRIO_A`
- `PREV_TRIO_B`
- `PREV_TRIO_C`
- `FIRST_PRESENT_FALLEN`

Once identities are finalized, content can map roles to character IDs without changing trigger schemas.

## 5. Suggested content folders

Adapt names to repository conventions rather than forcing this exact structure.

```text
src/
  narrative/
    NarrativeState.*
    NarrativeEventRegistry.*
    NarrativeRequirementResolver.*
    NarrativeRunner.*
    NarrativeEffects.*
    NarrativeAdapters.*
    narrativeTypes.*
  content/
    narrative/
      prologue.*
      act1.*
      act2.*
      act3.*
      act4.*
      act5.*
      characters.*
      kizuna.*
      resonance.*
      priestess.*
```

If the repository already has quest/dialogue/content infrastructure, extend it rather than creating a parallel framework.

## 6. Event contract

Minimum fields:

```ts
interface NarrativeEvent {
  id: string;
  status: 'LOCKED' | 'PROVISIONAL';
  act: string;
  type: 'micro' | 'short' | 'major' | 'cinematic' | 'system';
  trigger: TriggerDefinition;
  requirements?: Requirement[];
  participants?: string[];
  repeatPolicy: 'once' | 'echo' | 'repeatable';
  presentation: PresentationStep[];
  effects?: NarrativeEffect[];
  archive?: ArchiveDefinition;
}
```

Presentation steps should reference adapters rather than contain gameplay implementation details.

Example:

```json
{
  "op": "startEncounter",
  "encounterId": "OPENING_FALLEN_ENCOUNTER"
}
```

not:

```json
{
  "bossHp": 99999,
  "bossDamage": 872,
  "turnScript": []
}
```

## 7. Hidden speaker protection

Canonical content can store:

```json
{
  "speakerId": "CREATOR_PRIESTESS",
  "displayAliasPolicy": "PRIESTESS_REVEAL_STATE",
  "text": "Rise."
}
```

The UI adapter resolves the visible name:

- before `REVEAL_PRIESTESS_IS_VOICE`: `Unknown Voice`
- after flag: finalized Priestess display name

Never duplicate the same line under a fake canonical speaker ID.

## 8. Prologue implementation strategy

The prologue should not require new combat technology.

Preferred order:

### Option A — existing combat supports scripted tutorial encounter

Use the normal combat system with a special encounter definition and narrative checkpoints.

### Option B — combat cannot safely support a forced cinematic outcome

Present the battle as a cinematic or semi-interactive sequence using existing animation/VFX/camera assets. Do not compromise combat architecture to force an unwinnable battle.

The required narrative result is fixed: the opening Fallen is defeated, then `PROTAGONIST` awakens at the Landing.

## 9. Prologue spoiler protection

The opening boss must not be named with a player-identifying string. Use a neutral internal encounter role such as `OPENING_FALLEN`.

Do not put `PROTAGONIST_FALLEN` into player-visible filenames, localization keys, Archive titles, encounter labels, or UI assets.

The save file may record the hidden truth only in internal state if necessary, but the reveal should be gated by `REVEAL_PROLOGUE_FALLEN_IDENTITY`.

## 10. Story progression model

Use two layers:

### Campaign progression

Persistent across all runs:

- act reached
- major event completion
- character discoveries
- Resonance unlocks
- Kizuna progression
- Priestess reveal state
- prologue truth reveal state

### Run progression

Reset or partially reset on death:

- current Domain
- temporary node progress
- transient encounters
- temporary run conversations
- temporary buffs / resources handled by existing game systems

Never gate essential campaign progression only behind volatile run state without a recovery path.

## 11. Repeat behavior

Each important scene can support:

- `FIRST`: full version
- `REMEMBERED`: altered dialogue acknowledging familiarity
- `ECHO`: very short repeat version

Example:

```text
FIRST:
Hask: We've been here before.
Ash: You remember?

ECHO:
Ash looks up.
Hask: Don't.
```

## 12. Narrative debugging requirement

Add a developer-only narrative inspector showing:

- current act
- completed events
- candidate events
- unmet requirements per candidate
- current reveal flags
- Resonance unlocks
- Kizuna pair states
- current role-to-character mappings

This will be more valuable than logging individual dialogue calls while content is changing rapidly.

## 13. Integration milestones

### Milestone N1 — framework

- versioned narrative save namespace
- event registry
- requirement resolver
- event runner
- effect resolver
- developer inspector

### Milestone N2 — prologue vertical slice

Implement:

- `PRO_000_LAST_MEMORY`
- `PRO_001_TRIO_ENGAGEMENT`
- `PRO_002_FALLEN_HESITATES`
- `PRO_003_LIBERATION_STRIKE`
- `PRO_004_REBIRTH`
- `PRO_005_RISE`
- `PRO_006_TITLE`
- `PRO_007_FIRST_ECHO`
- `PRO_008_ASCENT_BEGINS`

### Milestone N3 — Act I skeleton

- first companion encounter
- first camp
- first Resonance tutorial
- first present-day Fallen
- `Thank you` defeat beat
- rebirth of defeated Fallen as human

### Milestone N4 — content pipeline

- Archive replay
- dialogue variants
- relationship conditions
- localization-safe speaker alias resolution
- authoring validation for missing IDs/references

### Milestone N5 — later-act hooks

Add flags and placeholder events for:

- first Sin reveal
- opening trio survivor encounters
- opening trio Fallen encounter
- prologue POV replay
- protagonist Fallen identity reveal
- Priestess creator reveal
- Priestess voice reveal
- final liberation
- Steward epilogue

Do not fully script these before the story beat details are approved.

## 14. Claude Code task prompt

Use this if handing the folder directly to Claude Code:

> Read `README_CLAUDE_HANDOFF.md`, then `KIZUNA_STORY_BIBLE_v0.7.md`, `KIZUNA_STORY_BEATS_v0.7.json`, `KIZUNA_NARRATIVE_INTEGRATION_PLAN_v0.7.md`, and `KIZUNA_NARRATIVE_STATE_SCHEMA_v0.7.json`. Inspect the existing repository architecture before editing. The combat system already exists and must remain intact. First report where current save state, routing/run state, dialogue/UI overlays, encounters, character IDs, and event hooks live. Then implement only Milestone N1 and the smallest viable portion of N2 using the repository's existing patterns. Keep narrative content data-driven. Do not invent TBD lore or finalize provisional identities. Add a developer narrative inspector. Preserve all existing combat behavior and tests.
