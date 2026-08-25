# KIZUNA — Combat Mechanics Specification v2.3

Status: Rebuild handoff
Audience: gameplay engineering, combat design, UI/UX, animation
Supersedes: the v2.2 Opener → Combo → Finisher gating model
Prototype reference: https://kizuna-combat-prototype.venia-4453.chatgpt.site

---

## 1. Product intent

KIZUNA is a mobile-landscape, party-based dark-fantasy JRPG. Combat combines:

- A shared deck built from three individual character loadouts.
- Flexible actions that always work when their AP cost can be paid.
- Conditional modifiers that reward sequencing, position, enemy state, and party coordination.
- Enemy telegraphs followed by direct rhythm-action defense.
- Memory progression that introduces new cards gradually.
- Bond progression that creates rare character-pair and triad moments.

The desired feeling is the clarity and flexibility of a modern deck-builder, the rotational satisfaction of Final Fantasy XIV, the party identity of a JRPG, and a tactile defensive exchange inspired by rhythm-action games. It must not require the player to solve a large rules puzzle before every action.

### Design pillars

1. Every card is useful. A card's base action always resolves at full strength.
2. Setup creates upside, not permission. Conditions improve actions; they do not unlock basic usability.
3. Three heroes feel like one party. Their 15 cards form one shared hand and deck.
4. Defense is played, not observed. Enemy attacks become readable rhythm sequences.
5. Strong turns are authored. Cost reduction and bonuses create occasional four-card turns without infinite loops.
6. Newness is earned through memory and bonds. The system expands gradually rather than presenting a large card pool immediately.

---

## 2. Major change from v2.2

**Remove hard card roles and sequence gates.**

Do not classify cards as Opener, Combo, Finisher, or Support in the rules or primary UI. Do not prevent a card from being played because the previous card had the wrong tag.

Every playable card is an Action. Some Actions are Core Actions, while others have one Modifier.

Example:

> Cross Sever — Base: Deal 9 damage for 2 AP.
> Modifier — Second Action: Cost becomes 1 AP, deal +3 damage, and deal 1 Break.

Cross Sever may be played first for its complete base effect. Playing it second makes it more efficient and more powerful.

---

## 3. Encounter structure

### 3.1 Party

- Standard party: three heroes.
- Each hero equips exactly five cards.
- The three loadouts combine into one 15-card combat deck.
- A character's five slots may contain any mix of Core or Modifier Actions.
- There is no required distribution of offensive, defensive, positional, or conditional cards.
- Card ownership remains visible through portrait, name, accent, animation, and focus behavior.

### 3.2 Encounter start

1. Combine the three equipped five-card loadouts.
2. Shuffle all 15 cards.
3. Draw five cards.
4. Set player AP to 3.
5. Reveal the boss's next action, target, damage, rhythm pattern, and relevant counterplay.
6. Begin the Player Phase.

### 3.3 Turn loop

```text
PLAYER PHASE
  Reveal current boss intent
  Set AP to 3
  Reset turn-scoped modifier state
  Player may play Actions in any affordable order
  Player may move one or more heroes by paying AP
  Player may invoke a ready Resonance Action
  Player ends turn

HAND TRANSITION
  Discard every played and unplayed card from the current hand
  Animate remaining cards into the discard pile

ENEMY PHASE
  Resolve Bleed and other end-of-player-phase effects
  If boss is Broken, cancel its action and harden its Break gauge
  Otherwise resolve its ritual or launch its rhythm attack
  Resolve Guard, damage, status effects, parries, and counters

DRAW PHASE
  Reshuffle discard into deck if necessary
  Draw one card at a time until the hand contains five
  Advance boss intent and turn counter
  Return to Player Phase
```

### 3.4 Deck lifecycle

- Deck size: 15 in the standard three-person party.
- Hand size: 5.
- Cards played during the turn enter the discard pile.
- At End Turn, all unplayed cards also enter the discard pile.
- Draw back to five one card at a time after the Enemy Phase.
- When the draw pile is empty, shuffle the full discard pile and continue drawing.
- There is no automatic hand retention in the starting ruleset.
- Never silently generate extra copies of equipped cards.

This produces a predictable three-hand cycle before reshuffling while preserving uncertainty within each hand.

---

## 4. Action Points

### 4.1 Core economy

- Player begins each Player Phase with 3 AP.
- AP does not carry between turns.
- Standard card costs are 1 or 2 AP.
- Moving a hero between Front and Back costs 1 AP.
- There is no Flow resource.
- There is no action trail resource or action-trail HUD.
- Manual card draw is excluded from the current starting ruleset. If restored later, it must be separately balanced and must not coexist with cheap self-discounts without testing.

### 4.2 Conditional cost reduction

Only explicitly authored cards may reduce their own cost.

Rules:

- A damaging Action cannot cost less than 1 AP.
- A non-damaging or low-impact setup Action may cost 0 AP if explicitly authored.
- Cost reductions do not stack.
- A 0-AP Action cannot create or propagate another cost reduction.
- Do not create generic "the next card costs less" effects in the starting deck.
- Limit the starting 15-card deck to three self-discount cards: one per hero.
- The card's AP badge must update immediately when its Modifier becomes active.

The cost reduction is part of the Modifier, not an independent resource.

---

## 5. Action anatomy

Every card contains:

1. Owner.
2. Name.
3. Current AP cost.
4. Target: enemy, party, self, or positional.
5. Base effect.
6. Either CORE or one Modifier condition and bonus.
7. Optional Memory marker.
8. Art and animation reference.

### 5.1 Core Action

A Core Action has no condition. Its displayed value is always its resolved value.

> Cleave — 1 AP — Deal 6 damage. — CORE

Core cards lower cognitive load, stabilize poor hands, and teach each hero's role.

### 5.2 Modifier Action

A Modifier Action has a complete base effect plus exactly one condition and one grouped bonus package.

> Twin Fang — 1 AP — Deal 4 damage.
> Modifier: If the target is Bleeding, strike again for 6 and consume Bleed.

Starting cards should not contain multiple independent "if," "unless," or "for each" clauses.

### 5.3 Supported starting conditions

- AFTER_MOVING: Owner moved this turn.
- AFTER_OTHER_HERO: The immediately previous Action belonged to another hero.
- SECOND_ACTION: Exactly one Action has resolved this turn.
- TARGET_HAS_PYRE
- TARGET_HAS_FROST
- TARGET_IS_BLEEDING
- TARGET_HP_BELOW_35_PERCENT

Conditions are evaluated immediately before the card resolves. The UI must preview the result using current state.

### 5.4 Position and immediate action

The combat space has Front and Back rows.

- Moving costs 1 AP.
- Positional Modifiers inspect the owner's row when the Action resolves.
- If an Action is played immediately after moving, no additional "line" or action-chain requirement applies.
- Front generally supports risk and damage.
- Back generally mitigates explicitly telegraphed positional attacks.
- Position is meaningful only when a card or enemy intent says it is meaningful.

---

## 6. Starting party and 15-card deck

Prototype balance uses normalized values: party HP 42 and boss HP 90. Production may display larger numbers, but all values must be scaled by the same factor and retested. Do not copy decorative values from concept art independently.

### 6.1 Ash — Vanguard

Identity: dependable damage, movement payoff, cross-hero sequencing, Break pressure.

| Card | Cost | Base effect | Modifier |
|---|---:|---|---|
| Cleave | 1 | Deal 6 damage. | CORE |
| Brace | 1 | Gain 5 party Guard. | CORE |
| Vanguard Thrust | 1 | Deal 5 damage. | After Moving: +4 damage and 1 Break. |
| Rising Edge | 1 | Deal 4 damage. | After Another Hero: strike again for 4. |
| Cross Sever ◈ | 2 | Deal 9 damage. | Second Action: cost becomes 1 AP, +3 damage, and 1 Break. |

### 6.2 Elin — Oracle

Identity: Guard, recovery, Frost, state conversion, cross-hero support.

| Card | Cost | Base effect | Modifier |
|---|---:|---|---|
| Lumen Veil | 1 | Gain 5 party Guard. | CORE |
| Mend | 1 | Restore 5 party HP and gain 2 Guard. | CORE |
| Frost Bind | 1 | Deal 4 damage and set Frost. | Target Has Pyre: +5 damage, 2 Break, and replace Pyre with Frost. |
| Winter's Echo | 1 | Deal 4 damage. | Target Has Frost: +3 damage and gain 4 Guard. |
| Lumen Cascade ◈ | 1 | Deal 4 damage. | After Another Hero: cost becomes 0 AP and gain 3 Guard. |

### 6.3 Mira — Shade

Identity: Bleed, execution, row switching, affinity conversion, burst.

| Card | Cost | Base effect | Modifier |
|---|---:|---|---|
| Serrate | 1 | Deal 3 damage; apply Bleed 3 for two turns. | CORE |
| Shadowstep | 1 | Deal 4 damage and switch Mira's row. | CORE |
| Twin Fang | 1 | Deal 4 damage. | Target Is Bleeding: strike again for 6 and consume Bleed. |
| Thermal Shift | 1 | Deal 4 damage and set Pyre. | Target Has Frost: +5 damage, 2 Break, and replace Frost with Pyre. |
| Execution Thread ◈ | 2 | Deal 9 damage. | Target at or below 35% HP: cost becomes 1 AP and deal +6 damage. |

◈ denotes a Memory Action in the prototype loadout.

---

## 7. Status systems

### 7.1 Guard

- Guard is shared by the party.
- Guard absorbs damage that passes through rhythm defense.
- Guard is generated during the Player Phase and expires after the Enemy Phase unless a card explicitly says otherwise.
- Guard is insurance for imperfect timing, not a replacement for parrying.

### 7.2 Break

- Boss begins with 5 Break/Poise.
- Break damage reduces the gauge.
- If it reaches zero before the Enemy Phase resolves, the current boss action is interrupted.
- After an interruption, restore the gauge and increase its maximum by 2.
- On Phase II transition, the prototype uses a maximum of 7 and adjusts the remaining gauge appropriately.
- A full successful parry string deals 1 Break.

### 7.3 Pyre and Frost

- The enemy has one affinity state: None, Pyre, or Frost.
- Setting one replaces the other.
- Affinity Modifiers consume or flip state only when explicitly stated.
- The UI shows one compact affinity emblem near the boss HUD.

### 7.4 Bleed

- Bleed 3 deals 3 damage at the end of the Player Phase.
- It lasts for two turns in the starting deck.
- Twin Fang may consume it for immediate burst.

### 7.5 Burn

- Ashen Rain applies Burn when unguarded damage penetrates defense.
- Prototype Burn: 4 in Phase I and 6 in Phase II.
- Existing Burn adds to the next damaging enemy resolution and then clears unless refreshed by the defined encounter logic.

---

## 8. Resonance and bonds

Resonance is not a sixth normal card shuffled into the deck. It is a separate, encounter-limited Bond Action displayed beside the hand.

### 8.1 Charging Resonance

The prototype Bond Art is between Ash and Elin.

Gain one Resonance charge when:

1. A Modifier Action belonging to Ash or Elin resolves.
2. The immediately following Action belongs to the other member of the pair.
3. The second Action's Modifier is active.

Additional rules:

- Maximum one charge per turn.
- Two charges ready the Bond Art.
- The Bond Art may be used once per encounter.
- Resonance does not require a visible action-trail UI.
- The Resonance card should communicate the next eligible partner through portrait emphasis and short copy.

### 8.2 Starting Bond Art

**Light Through Steel — Ash + Elin**

- Cost: 1 AP.
- Deal 10 damage.
- Deal 2 Break.
- Gain 7 party Guard.
- Move Ash to Front.
- Once per encounter.

### 8.3 Future pair and triad design

Bond progression may unlock new Pair or Triad Arts. These should be authored moments, not passive arithmetic bonuses.

- Pair: two named heroes satisfy a simple order or state relationship across one or more turns.
- Triad: all three heroes contribute an Action carrying compatible thematic marks during the same turn or encounter window.
- Charge progress is visible on one dedicated Resonance card.
- Only one Bond Art may be equipped initially to avoid cognitive overload.
- Trigger language should name characters and the required relationship, not expose internal tags.

---

## 9. Enemy intent and rhythm defense

### 9.1 Intent requirements

Before the Player Phase, show:

- Enemy action name.
- Target or Self.
- Total incoming damage or healing.
- Rhythm input sequence.
- Special counterplay, such as moving the target Back or Breaking a ritual.

The player must be able to plan offense, Guard, position, and Break from the telegraph.

### 9.2 Parry presentation

Enemy attacks must visibly launch from the boss and travel toward the targeted hero. Defense is performed on the character in the battlefield, not in a detached modal minigame.

Supported inputs:

- Tap: tap as the projectile or timing ring reaches the hero.
- Slide: swipe in the indicated direction as the attack reaches the hero.
- Hold: press on the first pulse and release on the impact pulse.

The sequence should feel closer to a Project DIVA-style note string or Clair Obscur-style direct defense than a conventional QTE button prompt.

### 9.3 Timing grades

Prototype windows:

- PERFECT: absolute timing error ≤ 80 ms.
- GREAT: ≤ 140 ms.
- GOOD: ≤ 220 ms.
- MISS/LATE: outside the window.

Damage is divided into packets equal to the number of notes.

- PERFECT: negate that packet.
- GREAT: negate that packet.
- GOOD: take half that packet, rounded up.
- MISS/LATE: take the full packet.

If all notes are PERFECT or GREAT, turn the complete attack and deal 1 Break.

If every note is PERFECT, also perform a riposte dealing 4 × note count damage.

### 9.4 Hitstop and feedback

- Successful heavy player attacks: 90–112 ms hitstop.
- Standard attacks: approximately 70 ms hitstop.
- Perfect parry: approximately 94 ms freeze plus haptic feedback.
- Great parry: lighter haptic pulse.
- Boss and hero poses must freeze consistently during hitstop; UI timers must not desynchronize.
- Use directional trails, impact flashes, recoil, camera impulse, sound, and haptics as a coordinated event.

---

## 10. Mourning Regent prototype encounter

### 10.1 Baseline

- Party HP: 42.
- Boss HP: 90.
- Boss Phase II begins at 45 HP.
- Phase II grants 10 Ward.
- Phase II lengthens rhythm strings.
- Phase II adds 7 damage pressure to standard attacks.

### 10.2 Intent rotation

| Intent | Phase I | Phase II | Notes |
|---|---:|---:|---|
| Ruinous Hymn | 22 damage | 29 damage | Standard rhythm attack. |
| Scything Advance | 26 damage | 33 damage | If target is Back: 7 damage in Phase I, 11 in Phase II. |
| Hollow Benediction | Heal 8 | Heal 10 | Interrupt by Breaking the boss. No parry sequence. |
| Ashen Rain | 20 damage | 27 damage | Penetrating unguarded damage applies Burn. |

The intent rotation repeats, but target selection may vary according to encounter scripting.

### 10.3 Difficulty target

| Defense profile | Win rate | Expected successful fight |
|---|---:|---:|
| Miss every parry | ~10–15% | A rare, narrow win with roughly 1 HP remaining. |
| Competent mixed timing | ~95–99% | Median 6 turns; meaningful damage taken. |
| Skilled timing | ~100% | Median 5–6 turns; faster and safer through counters. |

The no-parry path should be barely possible through excellent card use, Guard, Break, and positioning. It must not be a reliable strategy.

---

## 11. Memory progression

Memories are the primary card-unlock cadence.

- Unlocking a character memory introduces one or a small choice of new cards associated with that event.
- New cards enter the character's owned card pool, not automatically the active deck.
- Each character still equips only five cards.
- The player swaps an unlocked card into one of that character's five slots between encounters.
- Memory cards may be sidegrades, specialization tools, or new conditional patterns; they should not be mandatory linear upgrades.
- Introduce one new mechanical idea at a time.
- Present the card alongside a short memory fragment so mechanical growth and narrative growth feel inseparable.

Recommended unlock cadence:

1. Show the memory scene.
2. Reveal one new Action or a choice between two Actions.
3. Explain only its Base and single Modifier.
4. Offer immediate slot comparison against the character's current five cards.
5. Allow testing before committing when practical.

---

## 12. UI and interaction specification

### 12.1 Battlefield composition

Target mobile landscape first.

- Party HUD hugs the upper-left edge with portraits and slim HP information.
- Enemy name, HP, Break, Affinity, and intent hug the upper-right edge.
- Characters and boss remain grounded and visually separate from the backdrop.
- Cards occupy the lower center without covering character torsos.
- Circular AP meter sits at lower left.
- Move control sits adjacent to AP.
- Deck/discard counters and End Turn remain low priority near the lower-right edge.
- Resonance is a separate vertical card immediately to the right of the hand.
- Do not show Flow.
- Do not show an Action Trail.

### 12.2 Card reading order

Each card must read in this order:

1. Current AP cost medallion.
2. Owner mark.
3. ACTION and optional MEMORY marker.
4. Card name.
5. Concise base effect.
6. Large action illustration.
7. CORE or gold Modifier strip.
8. Owner and live readiness state.

When a Modifier becomes active:

- Animate the AP medallion to its current cost.
- Illuminate the Modifier strip in restrained gold.
- Show the fully resolved effect in focus mode.
- Do not cover the card with a large "combo ready" label.

### 12.3 Primary input model

- Tap a card: select it and highlight its valid target.
- Drag a card: drag to the enemy or party target and release to play.
- Press and hold: enter Character Focus.
- In Character Focus, bring the owning hero forward, soften non-owning heroes, enlarge the chosen card information, and provide a clear Commit target.
- Cancel focus by releasing outside the target, tapping close, or using platform back behavior.
- All interactions require touch targets of at least 44 CSS px where practical.

### 12.4 Character Focus

Focus should evoke character emphasis without a detached full-screen menu.

Focus mode must show:

- Hero name, profession, and current row.
- Action name and current AP cost.
- Base effect.
- Modifier condition and whether it is currently active.
- Exact effect that will resolve now.
- Target and Commit action.

The hero should shift forward through depth, light, camera framing, or scale — not through a detached full-screen menu.

---

## 13. Animation and camera requirements

### 13.1 Characters

- Characters and boss are independent transparent actors, never baked into the battlefield backdrop.
- Feet must share a consistent ground plane.
- Required states: idle, focus, anticipation, attack/cast, impact/recoil, return, hit, parry, perfect parry, defeat, victory.
- Idle motion should be restrained: breathing, cloth/hair secondary motion, weapon drift, and small stance corrections.
- Card activation focuses the owning character before the attack animation begins.

### 13.2 Camera battle director

- Default: wide three-quarter battlefield view.
- Card hold: controlled push or lateral emphasis toward the owner.
- Action commit: short hero-biased shot, then impact-biased framing.
- Resonance: pair/triad composition with one authored camera sweep.
- Enemy attack: boss anticipation, visible launch, target tracking, defensive input, impact/result.
- Always preserve rhythm-note readability over cinematic motion.

### 13.3 Backdrop separation

Render the environment as a standalone battlefield backdrop or layered diorama. Boss and heroes must remain separate assets. The backdrop should provide ground contact, atmospheric depth, and camera-safe negative space without containing duplicate characters or UI.

---

## 14. Recommended implementation model

### 14.1 Card data

```ts
type CardDefinition = {
  id: string;
  ownerId: string;
  name: string;
  baseCost: number;
  target: "enemy" | "party" | "self";
  baseEffects: Effect[];
  classification: "core" | "modifier";
  modifier?: {
    condition: Condition;
    costOverride?: number;
    bonusEffects: Effect[];
    consumesState?: string;
  };
  memoryId?: string;
  artId: string;
  animationId: string;
};
```

### 14.2 Runtime card evaluation

```ts
function evaluateCard(card, combatState): EvaluatedCard {
  const modifierActive = card.modifier
    ? evaluateCondition(card.modifier.condition, combatState)
    : false;

  const currentCost = modifierActive && card.modifier?.costOverride !== undefined
    ? card.modifier.costOverride
    : card.baseCost;

  return {
    currentCost,
    modifierActive,
    resolvedEffects: modifierActive
      ? [...card.baseEffects, ...card.modifier.bonusEffects]
      : card.baseEffects,
  };
}
```

Evaluation must be deterministic and shared by card rendering, focus preview, affordability checks, AI simulation, and final resolution. Never duplicate Modifier logic separately in the UI and combat engine.

### 14.3 Turn-scoped state

```ts
type TurnState = {
  ap: number;
  actionsPlayed: Array<{cardId: string; ownerId: string}>;
  heroesMoved: Set<string>;
  resonanceChargedThisTurn: boolean;
  guard: number;
};
```

The action history exists internally for condition evaluation but is not presented as an Action Trail HUD.

### 14.4 Combat state machine

```text
INTRO
PLAYER_READY
CARD_FOCUS
PLAYER_ACTION_RESOLVING
PLAYER_READY
HAND_DISCARDING
ENEMY_TELEGRAPH
ENEMY_ATTACK_LAUNCH
RHYTHM_DEFENSE
ENEMY_RESOLUTION
HAND_DRAWING
PLAYER_READY
VICTORY | DEFEAT
```

Only one state transition owner should advance combat. Animations report completion to the state machine; arbitrary timeouts must not independently mutate combat state.

---

## 15. Cognitive-load rules

Hard constraints for the starting game:

- Five cards visible in hand.
- Three AP.
- One Base effect and at most one Modifier per card.
- No hard action sequence gates.
- No Flow resource.
- No visible Action Trail.
- No more than three cost-reduction cards in the starting 15-card deck.
- No generic discount chaining.
- One enemy intent visible at a time.
- One equipped Resonance Art initially.
- No more than three persistent enemy states visible at once.
- Use consistent condition language across cards and UI.
- The player should identify a legal action in under two seconds and a strong sequence in under ten seconds.

Complexity should emerge from interactions between simple cards, not from paragraph-length cards.

---

## 16. Balance findings already validated

- Cost reduction alone increased card count but felt less effective and less satisfying.
- Full existing bonuses plus discounts made defense too optional.
- Controlled cost-plus-effect Modifiers created the best pacing.
- Four-card turns occurred on roughly 15–17% of turns.
- Controlled burst rose to roughly 29 damage from a baseline near 24.
- Boss pressure was raised so ignoring every parry wins only about 12% of simulated fights.

Do not increase the three starting discount bonuses without retesting the no-parry survival rate.

---

## 17. Rebuild acceptance criteria

### 17.1 Rules

- [ ] Every card can be played whenever its current AP cost can be paid.
- [ ] Modifier failure never cancels a base effect.
- [ ] The standard deck contains exactly five cards per hero and 15 total.
- [ ] The opening hand contains five unique physical card instances from that deck.
- [ ] End Turn discards the complete hand.
- [ ] Cards draw back to five one at a time.
- [ ] Discard reshuffles only when the draw pile is insufficient.
- [ ] Conditional costs update before affordability is checked.
- [ ] Cost reductions cannot stack or propagate.
- [ ] Internal action history resets each Player Phase.
- [ ] Flow and Action Trail do not appear.

### 17.2 Enemy and defense

- [ ] Boss intent is visible before the player acts.
- [ ] The boss visibly animates and launches each damaging attack.
- [ ] Tap, slide, and hold notes resolve against the targeted hero.
- [ ] Damage packets correspond to individual timing results.
- [ ] Guard applies only after rhythm mitigation.
- [ ] Full GREAT/PERFECT strings negate the action and deal Break.
- [ ] Full PERFECT strings trigger riposte damage.
- [ ] Break can interrupt the boss before its action.
- [ ] No-parry wins remain rare but possible.

### 17.3 Presentation

- [ ] Cards remain legible on an iPhone-sized landscape viewport.
- [ ] Five cards and the Resonance card do not cover character torsos.
- [ ] Each character and boss has independent transparent art and a shared ground plane.
- [ ] Press-and-hold focus visibly emphasizes the owning hero.
- [ ] Current AP cost is the most prominent number on each card.
- [ ] Base effect and Modifier are visually distinct.
- [ ] Active Modifiers use restrained gold emphasis.
- [ ] Hitstop freezes the relevant actors without breaking input timing.
- [ ] The interface matches the restrained ink-wash, parchment, black, and sparse-gold concept direction.

### 17.4 Test scenarios

1. Play Cross Sever first: spend 2 AP and deal 9.
2. Play Cleave, then Cross Sever: spend 1 + 1 AP; Cross Sever deals 12 and 1 Break.
3. Play Lumen Cascade first: spend 1 AP, deal 4, gain no bonus Guard.
4. Play any other hero, then Lumen Cascade: it updates to 0 AP, deals 4, and grants 3 Guard.
5. Bring boss to 35% HP: Execution Thread updates to 1 AP and resolves for 15 damage.
6. Apply Bleed, then Twin Fang: deal 10 total from Twin Fang and consume Bleed.
7. Move Ash, then Vanguard Thrust: pay 1 AP to move and 1 AP to attack for 9 plus 1 Break.
8. Move the Scything Advance target Back: preview and resolve 7/11 rather than 26/33 damage.
9. Miss every rhythm input: Guard may preserve the party, but repeated misses should normally cause defeat.
10. Complete a full PERFECT string: negate damage, deal Break, play riposte, hitstop, camera, sound, and haptics in sync.
11. End a turn with three unplayed cards: all three animate to discard, then five cards draw individually after the Enemy Phase.
12. Trigger Ash → Elin Resonance correctly across two turns: charge no more than once per turn, ready at two, spend 1 AP, and become unavailable afterward.

---

## 18. Explicit non-goals for this rebuild

- Do not restore hard Opener/Combo/Finisher/Support tags.
- Do not restore Flow.
- Do not restore a visible Action Trail.
- Do not add freeform deck growth during an encounter.
- Do not add generic energy-generation loops.
- Do not add multiple Modifiers to starting cards.
- Do not bake heroes or the boss into the backdrop.
- Do not treat the current web prototype's animation timing as final production animation quality.
- Do not imitate Clair Obscur, Chaos Zero Nightmare, Slay the Spire, Gloomhaven, Sunderfolk, or Final Fantasy XIV literally; use their relevant interaction principles while preserving KIZUNA's own visual and narrative identity.

---

## 19. Recommended rebuild sequence

1. Implement the deterministic combat state machine and card evaluator.
2. Implement the exact 15-card deck, discard, reshuffle, and one-by-one draw lifecycle.
3. Implement AP, movement, Guard, affinity, Bleed, Burn, Break, and the three controlled self-discounts.
4. Implement the Mourning Regent intent cycle and phase transition.
5. Implement packet-based rhythm defense with debug timing visualization.
6. Add independent character and boss actors with shared ground anchors.
7. Build mobile-landscape HUD and card anatomy from the concept layout.
8. Add card focus and drag-to-target interaction.
9. Add Resonance charge logic and Light Through Steel.
10. Add animation events, hitstop, camera direction, haptics, and audio hooks.
11. Run deterministic rules tests, automated encounter simulations, and human playtests.
12. Tune only after logging card use, Modifier activation, damage taken, parry grades, fight length, and failure cause.

---

## 20. Telemetry for playtesting

Record per encounter:

- Deck loadout and draw order.
- Cards played, current cost, and Modifier activation.
- AP unused each turn.
- Four-card-turn frequency.
- Damage, Guard generated, Guard absorbed, healing, and Break.
- Movement decisions and positional damage prevented.
- Resonance charge timing and use.
- Parry grade per note and per intent.
- Damage taken from packets, Burn, and missed positioning.
- Boss phase reached, turns to victory, remaining HP, and defeat cause.

Primary tuning questions:

1. Can a player understand why a Modifier activated?
2. Does every hand contain at least one reasonable line?
3. Are four-card turns memorable rather than routine?
4. Does good defense change the outcome without making Guard irrelevant?
5. Do different hero card orders create meaningfully different solutions?
6. Does Resonance feel like a relationship moment rather than a meter payout?

---

## Addendum — accepted deviations (Build 2, at the designer's direction)

1. **Per-hero HP, not one shared pool.** The party HUD stacks portraits with
   individual HP bars, JRPG-style, so each hero carries their own pool:
   Ash 16 · Elin 12 · Mira 14 (the spec's normalized 42, preserved in sum).
   A hero at 0 falls; their cards are dead in the shared hand; the boss
   retargets the first hero still standing; defeat is the whole line down.
   Heals reach the most wounded living hero. Guard and Burn remain
   party-shared per §7.1/§7.5. The no-parry win-rate target in §10.3 needs
   re-simulation against focused damage.
2. **The intent banner sits top-center**, in the open sky, and never covers
   the Regent's art.
3. **The hand fans** — a low-pivot arc; a card straightens and lifts on
   hover/selection, and while dragging.
4. **No Move button.** Movement is drag: pull a hero sideways past a
   threshold to step them to the other row (still 1 AP). Cards drag to their
   target (the Regent, or the party side) and release to play; tap-select →
   tap-target and press-and-hold Focus remain.
