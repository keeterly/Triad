# KIZUNA | RESONANCE — Claude Code Narrative Handoff
## Version 0.7

## Purpose

This folder is the implementation-facing narrative handoff for the existing KIZUNA game. The combat system already exists and is out of scope for narrative integration unless a story trigger needs to observe combat outcomes. Do not replace, redesign, rebalance, or refactor combat as part of this handoff.

The immediate goal is to add a data-driven story layer that can coexist with the current game while the final dialogue, remaining character biographies, Domain names, and exact boss presentations continue to evolve.

## Source of truth order

1. `KIZUNA_STORY_BIBLE_v0.7.md` — narrative canon and creative rules.
2. `KIZUNA_STORY_BEATS_v0.7.json` — implementation-facing beat sequence, triggers, flags, and persistence.
3. `KIZUNA_NARRATIVE_INTEGRATION_PLAN_v0.7.md` — code integration boundaries and recommended architecture.
4. `KIZUNA_NARRATIVE_STATE_SCHEMA_v0.7.json` — save-state namespace and canonical state keys.
5. Existing game code — source of truth for combat, character stats, abilities, routing, UI architecture, and current repository conventions.

If this handoff conflicts with the current combat implementation, preserve combat and adapt the narrative adapter around it.

## Status vocabulary

- `LOCKED`: canon requirement. Implementation should support it now.
- `PROVISIONAL`: intended direction, but names/order/presentation can change. Keep data-driven.
- `TBD`: intentionally unresolved. Do not invent permanent canon in code.

## Key change in v0.7

The canonical opening is no longer a direct awakening at the Landing. The player first witnesses a previous-cycle battle in a post-apocalyptic memory-city: three heroes fight a giant Fallen. The game presents the sequence as a dream or fragmented memory. After the Fallen is struck down, the protagonist awakens at the Landing and hears the unknown voice say `Rise`.

Late-game revelation: the Fallen in the opening was the protagonist in a prior cycle. The three heroes were liberating them. Two of those heroes are later encountered as travelers; the third eventually becomes Fallen. One of the trio should ultimately be revealed as the protagonist's strongest Kizuna bond from the previous cycle.

## Claude Code implementation directive

Build the narrative framework first. Do not bulk-write or hard-code hundreds of scenes.

Recommended first vertical slice:

1. Add versioned `narrativeState` to save data.
2. Add event registry + trigger evaluator.
3. Add dialogue/cinematic event player using existing UI primitives.
4. Add safe hidden-speaker handling for the Priestess.
5. Implement `PRO_000_LAST_MEMORY` through `PRO_008_ASCENT_BEGINS`.
6. Add Archive/Replay support for completed major scenes.
7. Add developer narrative inspector showing flags, eligible events, and unmet conditions.
8. Integrate Act I skeleton only after the prologue works cleanly.

## Hard implementation boundaries

- Do not rewrite combat.
- Do not assume a specific monetization model.
- Do not bind story progression to one exact party composition unless the beat explicitly requires it.
- Do not expose canonical hidden speaker IDs in player-facing UI.
- Do not make unresolved character names or Domain names into schema keys; use stable IDs.
- Do not make death erase persistent narrative progression.
- Do not require an unwinnable prologue combat if the existing combat architecture cannot support it cleanly. A scripted cinematic battle or reduced-control tutorial is acceptable.

## Protagonist identity

The narrative uses the stable role ID `PROTAGONIST`. If the current game already treats Ash as the fixed protagonist, Claude may map `PROTAGONIST -> ASH` at the content layer. Do not hard-code that mapping into generic narrative systems until confirmed.
