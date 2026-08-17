# KIZUNA | RESONANCE — Story Bible
## Version 0.7 — Integration Canon

## 1. High concept — LOCKED

KIZUNA | RESONANCE is a dark fantasy mobile JRPG roguelite about dead souls repeatedly ascending an impossible afterlife called the Abyss. The travelers recover fragments of their former lives, form bonds that persist through death, confront the harm they caused in life, and learn that suffering is not the same as repentance.

The central thesis is:

> You are responsible for what you have done, but you are not required to remain the person who did it.

Forgiveness, absolution, accountability, and change are separate ideas. Victims are never obligated to forgive. The game asks what a person should do with the future after committing something that cannot be undone.

## 2. Mobile narrative rules — LOCKED

The story must work in interrupted mobile sessions.

- Micro beat: 5–20 seconds.
- Short scene: 30–90 seconds.
- Major scene: 2–4 minutes.
- Cinematic event: 3–6 minutes maximum and rare.
- Enter scenes late and leave early.
- Essential information must be replayable through Archive/Memory systems.
- Dialogue should not restate information already communicated through combat, UI, or environment.
- Repeat runs should have shortened echo variants rather than replaying full exposition.

## 3. The Abyss — LOCKED

The Abyss was created deliberately by a magically empowered Priestess of near-demigod status. It was intended as a liminal sanctuary for souls burdened by grief, regret, guilt, shame, and unresolved attachment. Souls could rest, confront what bound them, repent where necessary, and become ready for rebirth.

The realm is physically real within its own metaphysical rules but responds to memory and emotion. Its landscapes combine incompatible fragments of human experience: cathedrals, apartment buildings, hospitals, subway platforms, castles, factories, forests, battlefields, bedrooms, and civilizations that should not coexist.

Environmental rule:

1. Familiar — something recognizably human.
2. Impossible — something violating physical/history logic.
3. Emotional — something carrying human memory or feeling.

The Abyss is not an objective divine court and does not assign numerical moral guilt.

## 4. The Priestess — LOCKED

The creator of the Abyss was a Priestess with extraordinary magical power and unusual innocence. She understood protection, loyalty, love, and service but had little direct experience with malice or grief.

She protected people she considered close friends. Those people betrayed her for material and financial benefit and arranged or enabled her execution by burning at the stake.

Because of her supernatural nature, death did not end her. She returned and killed her betrayers, expecting vengeance to bring closure. It did not. Their deaths left the betrayal and grief untouched.

She created the Abyss so other weary souls could find the solace, repentance, and release she herself could not find. Privately, she hoped her betrayers would someday arrive, understand what they had done, ask forgiveness, and give her closure.

They never arrived.

She waited across centuries. Her unresolved grief bled into the sanctuary, and the refuge slowly distorted into the dangerous, looping Abyss experienced by the player.

She is not a malicious god or deliberate jailer. She is the oldest person trapped by the same emotional law affecting everyone else.

## 5. The Unknown Voice — LOCKED

The unidentified voice speaking to the protagonist is the Priestess all along.

The opening use of:

> Rise.

is spoken by her.

She may narrate sparingly at thresholds such as death, rebirth, Domain transitions, Fallen liberation, or approaching the heart of the Abyss. She never knowingly lies. Her language is emotionally truthful but incomplete enough to sound like distant omniscient narration.

Before reveal:

- canonical speaker ID: `CREATOR_PRIESTESS`
- player-facing alias: `UNKNOWN_VOICE`

After reveal:

- player-facing alias may resolve to `PRIESTESS` or her final proper name once chosen.

Her identity must not leak via subtitle metadata, accessibility strings, player-facing logs, filenames, Codex text, or localization keys exposed to players.

## 6. The Landing — LOCKED

The Landing is the recurring rebirth point and persistent hub.

Emotional evolution:

- Early: loneliness.
- Midgame: refuge.
- Late: home.

As characters are rescued or discovered, the Landing should gain people, sleeping spaces, relic storage, cooking areas, training spaces, memorials, gardens, and other signs of ordinary life.

The emotional contradiction is intentional: the heroes want to escape the Abyss while gradually creating a place within it that matters to them.

## 7. Death and memory — LOCKED

Every run is canon.

Death is rebirth, not a non-diegetic retry.

Factual memory is fragile. Emotional memory persists more strongly.

> The mind forgets. The soul remembers.

Characters may forget names and conversations but retain trust, fear, affection, tactical instincts, resentment, promises as feelings, and unexplained familiarity.

Deep Kizuna bonds can eventually preserve explicit memories across cycles.

## 8. Resonance — LOCKED

Resonance is how buried memory re-enters consciousness. Triggers may include relics, spaces, phrases, sounds, smells, gestures, combat parallels, relationships, or emotional situations.

A strong Resonance answers one question while creating another.

Character memory progression:

1. Fragment — something happened.
2. Wound — something happened to me.
3. Contradiction — my version is incomplete.
4. Sin — this is what I did.
5. Truth — this is why I did it / what I was hiding from myself.
6. Choice — who will I choose to be now?

Trauma can explain behavior; it does not automatically absolve it.

## 9. Kizuna — LOCKED

Kizuna is a network between characters, not a protagonist-only affection ladder.

Suggested stages:

- Thread
- Trust
- Fracture
- Witness
- Grace
- Resonance

Relationships can strengthen while remaining morally unresolved. Grace does not automatically equal forgiveness or romance.

Bonds should affect gameplay through the existing systems where practical: assists, passives, combination actions, persistence modifiers, or story unlocks. Narrative integration should observe existing combat capabilities rather than redesigning combat around this document.

## 10. The Fallen — LOCKED

A Fallen is a traveler whose identity has collapsed around an unresolved emotional fixation after repeated cycles.

Design formula:

Human virtue -> trauma/failure -> lie -> obsession -> monster.

Defeating a Fallen destroys the monstrous state and allows the human soul to awaken again at the Landing.

The first major Fallen should whisper:

> Thank you.

Later, that soul appears at the Landing in human form.

Playable characters eventually discover they have also been Fallen in earlier cycles.

## 11. Canonical opening — LOCKED

### 11.1 Surface presentation

The game opens in media res in a post-apocalyptic memory-city. The city embodies the visual grammar of the Abyss: ruined modern urban structures fused with impossible architecture and fragments of other eras.

Three heroes are fighting a gigantic Fallen.

The sequence is presented without context. The player should assume this is a dream, prophecy, previous expedition, or metaphorical opening cinematic.

The scene ends with the trio landing a decisive strike. The Fallen collapses. The screen cuts away before the player receives a clear explanation.

The protagonist then awakens in shallow black water at the Landing with only faint impressions of the scene.

The Priestess speaks:

> Rise.

The title appears and the actual present-day ascent begins.

### 11.2 Hidden truth

The Fallen in the opening was the protagonist during a previous cycle.

The three heroes were not attacking a random monster. They were liberating the protagonist from a Fallen state.

The protagonist's awakening at the Landing is the direct consequence of the prologue Fallen being defeated.

This information must not be disclosed in early Act I.

### 11.3 The opening trio

The three opening heroes are persistent characters, not disposable cinematic NPCs.

Their final identities remain PROVISIONAL until mapped to the 13-character roster.

Stable role IDs:

- `PREV_TRIO_A`
- `PREV_TRIO_B`
- `PREV_TRIO_C`

Narrative destinations:

- Two are later encountered on the road as travelers.
- One eventually becomes Fallen and is fought by the current party.
- One of the trio should ultimately be revealed as the protagonist's strongest Kizuna bond from the previous cycle.

The three can foreshadow three possible outcomes of the cycle: continued ascent, loss/fall, and eventual release or disappearance.

### 11.4 Prologue misdirection

The story should deliberately encourage the player to identify with the three human heroes rather than the monster.

Possible assumptions across the campaign:

1. It was only a dream.
2. It was a memory from someone else's past.
3. The protagonist may have been one of the three heroes.
4. The scene really happened.
5. The protagonist was the Fallen.

The opening should be replayed later from the Fallen's point of view, recontextualizing the original cinematic.

### 11.5 Kizuna foreshadowing

During the opening battle, the Fallen briefly hesitates when confronted by one specific member of the trio.

At first this reads as boss behavior.

Late-game interpretation: even after losing identity, language, and human form, the protagonist's soul recognized a powerful prior-cycle bond.

This proves the rule `The mind forgets. The soul remembers.` before the player knows the rule exists.

## 12. Current known cast — PROVISIONAL BIOGRAPHIES / LOCKED NAMES + COMBAT ROLES

### Hask

- Combat: Fire and ice mage.
- Theme: indecision / courage.
- Lie: `There was nothing I could have done.`
- Truth direction: he demanded certainty before being willing to risk action.
- Fallen direction: `THE_EQUINOX`, divided between opposing forces.

### Branden

- Combat: longbow archer.
- Theme: survival / loyalty.
- Lie: `There was nothing else I could do.`
- Truth direction: wanting to survive was not the lie; refusing to acknowledge his choice was.
- Fallen direction: a creature that survives by maintaining impossible distance and abandoning others.

### Ash

- Combat: sword wielder.
- Theme: vengeance / responsibility.
- Lie: `They deserved it.`
- Truth direction: he wanted the guilty person to suffer because he was suffering.
- Fallen direction: `THE_EXECUTIONER`, justice stripped of compassion.

### Mira

- Combat: assassin.
- Theme: betrayal / intimacy.
- Lie: `I never loved them.`
- Truth direction: she loved someone and betrayed them anyway.
- Fallen direction: `THE_BELOVED`, intimacy becoming entrapment.

### Elin

- Combat: cleric.
- Theme: conviction / humility.
- Lie: `I did everything I could.`
- Truth direction: she eventually protected her certainty instead of the people she intended to save.
- Fallen direction: `THE_SAINT`, healing distorted into refusal to let suffering end.

The remaining eight character identities, classes, sins, wounds, voices, and Fallen forms are TBD.

## 13. Campaign macrostructure — LOCKED QUESTIONS / PROVISIONAL DETAILS

### Prologue — Last Memory

Question: `What did I just see?`

- Previous-cycle battle.
- Protagonist unknowingly shown as Fallen.
- Trio defeats Fallen.
- Protagonist wakes at Landing.
- Priestess: `Rise.`

### Act I — Ascent

Question: `Where are we?`

- Protagonist begins climbing.
- First companions join.
- Environmental evidence shows prior travelers.
- Resonance introduced.
- First present-day major Fallen defeated.
- Human whisper: `Thank you.`
- After later death/rebirth, defeated Fallen appears as a human at the Landing.

Act I reframe: `The monsters may be people.`

### Act II — Resonance

Question: `Who were we?`

- Roster expands.
- Wound memories create sympathy.
- Contradictions reveal characters are hiding parts of their histories.
- First major Sin reveal.
- One or both surviving opening-trio travelers re-enter the story.
- Familiarity between them and the protagonist is unexplained.
- Myths of the Priestess conflict: saint, witch, mother, jailer, mourning goddess.

Act II reframe: `We were not simply innocent victims.`

### Act III — The Fallen

Question: `What are we becoming?`

- Playable characters discover they possess Fallen forms.
- Evidence indicates this cycle has repeated far longer than remembered.
- The third opening hero is revealed as Fallen.
- Fighting them causes major prologue Resonances.
- The opening battle is eventually replayed from inside the monster.
- Reveal: the protagonist was the Fallen in the opening.
- The trio killed/liberated the protagonist in the previous cycle.

Act III reframe: `The first monster was me.`

### Act IV — Kizuna

Question: `Can we change?`

- Deep bonds begin surviving death consciously.
- Characters remember each other across rebirth.
- Prior-cycle relationships become recoverable.
- The protagonist learns which opening-trio hero shared the strongest prior Kizuna bond.
- Truth of the Abyss's creation emerges.
- The Priestess's distant narration becomes subtly more personal and sorrowful.
- The party realizes the creator is not simply judging them; she is trapped too.

Act IV reframe: `The Abyss was meant to help us leave.`

### Act V — Ascension

Question: `Can we move forward?`

- Final ascent reaches the heart of the Abyss.
- Ordinary memories return alongside memories of wrongdoing, restoring full humanity to the cast.
- The party confronts the Priestess and/or the embodiment of her accumulated grief.
- Final battle is liberation, not execution.
- Her grief releases.
- The corrupted Abyss begins to collapse.
- She is finally capable of moving on.
- She chooses to return voluntarily as steward of lost souls rather than punisher or judge.

Ending reframe: `Remaining can be a choice instead of a prison.`

## 14. Final confrontation — LOCKED

The party frees the Priestess from grief using the same thematic process by which Fallen are liberated.

Victory means separating person from fixation, not proving the Priestess evil.

The final blow breaks grief's hold. The distorted architecture of the Abyss collapses because its prison-like form was sustained by unresolved mourning.

The underlying liminal refuge may survive or be remade.

The Priestess is offered the possibility of leaving. She chooses to remain, now for strangers rather than for the betrayers she waited for.

She becomes a steward who can offer shelter, witness, guidance, and a path toward rebirth. She cannot forgive on behalf of victims or erase consequence.

### Epilogue motif

A new soul awakens in the renewed refuge.

Water. Darkness. Breathing.

The Priestess is present.

> Rise.

At the beginning the word feels like a command. At the ending it means: `Stand. You are not alone. There is still a next step.`

## 15. Story authoring still required — TBD

These items should remain data-driven and should not be invented as permanent code-level canon:

- Final protagonist identity / whether `PROTAGONIST` maps to Ash.
- Identities of `PREV_TRIO_A/B/C`.
- Which trio member is the strongest previous-cycle Kizuna bond.
- Remaining eight playable characters.
- Full character voice sheets.
- Exact number and themes of Domains.
- Exact first present-day Fallen identity.
- Exact order Mira and Elin join.
- Priestess proper name.
- Priestess betrayers' identities and whether any appear indirectly.
- Exact mechanics/presentation of the final boss.
- Exact ascension outcomes for all thirteen characters.
- Romance rules, if any.

## 16. Writing north star — LOCKED

The desired player relationship with a major character is:

`I like you.`

-> `I understand why you hurt.`

-> `Wait. What did you do?`

-> `I do not know how I feel about you anymore.`

-> `I understand you without needing to excuse you.`

-> `I want to see what you choose next.`

KIZUNA is not about proving bad people were secretly good. It is about refusing to reduce a whole person to one moral category while still taking harm seriously.
