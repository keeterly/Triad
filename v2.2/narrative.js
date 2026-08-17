// ═══════════════════════════════════════════════════════════════════════════
// KIZUNA v2.2 — THE NARRATIVE ENGINE
//
// Built from the v0.7 narrative handoff (story bible + beats + state schema +
// integration plan). Five responsibilities, kept separate on purpose:
//
//   1. STATE      — narrState(): versioned, persistent, schema v7. Campaign
//                   progression survives death; death is diegetic, not a reset.
//   2. REGISTRY   — NARR_BEATS: the beat data, verbatim from the handoff JSON.
//                   Content is DATA. This file's framework half never reads a
//                   specific beat id; only the content half (scenes) does.
//   3. TRIGGERS   — narrTriggerMatches(): the handoff's trigger grammar.
//                   game.js emits plain signals ('NEW_GAME', 'LANDING',
//                   'PLAYER_DEATH', 'COMBAT_VICTORY:<id>'); the resolver maps
//                   them onto beat triggers, including the *_AFTER:<id> forms.
//   4. RUNNER     — narrFire(): plays at most one beat per signal, then walks
//                   the CHAIN:/AFTER: links until the sequence runs dry, then
//                   hands control back through `done`. A beat whose scene is
//                   not authored yet is SKIPPED, never silently completed —
//                   a once-only beat must not burn invisibly (the only
//                   exception is type 'system', which is pure effects).
//   5. EFFECTS    — narrApplyEffects(): the handoff's effect grammar, applied
//                   to state and saved.
//
// THE COMBAT BOUNDARY (from the handoff, preserved verbatim in spirit): this
// module OBSERVES combat — it never reaches into it. It may be told a fight
// started, ended, was won or lost. It never changes damage, AI, turn order,
// or combat UI. The prologue battle is therefore a cinematic (the handoff's
// Option B), not a rigged unwinnable fight.
//
// SPOILER SAFETY: canonical speaker ids (CREATOR_PRIESTESS, role ids) exist
// only in data and internal state. Everything player-facing goes through
// narrSpeaker(), which resolves to the reveal-safe alias until the matching
// reveal flag is set. Nothing below may interpolate a canonical id into DOM.
//
// Load order: this file loads BEFORE game.js and calls no game function at
// load time — scenes resolve showOverlay/hideOverlay/etc. when they run.
// ═══════════════════════════════════════════════════════════════════════════

const NARR_VERSION = 7;                       // schema const — bump only with a migration
const NARR_KEY = 'kizuna2_2.narrative';

// ─── 2. REGISTRY — beat data, generated verbatim from KIZUNA_STORY_BEATS_v0.7.json.
// Do not hand-edit ids, triggers, or effects here; edit the handoff and regenerate.
// Status vocabulary: LOCKED (canon), PROVISIONAL (subject to change), TBD.
const NARR_BEATS = [
  {
    "id": "PRO_000_LAST_MEMORY",
    "status": "LOCKED",
    "act": "PROLOGUE",
    "type": "cinematic",
    "trigger": "NEW_GAME",
    "participants": [
      "PREV_TRIO_A",
      "PREV_TRIO_B",
      "PREV_TRIO_C",
      "OPENING_FALLEN"
    ],
    "summary": "In a post-apocalyptic memory-city, three heroes battle a gigantic Fallen. No context is given.",
    "playerBelief": "Dream, prophecy, or unrelated past battle.",
    "hiddenTruth": "OPENING_FALLEN is the prior-cycle PROTAGONIST.",
    "effects": [
      "SET_EVENT_COMPLETE:PRO_000_LAST_MEMORY"
    ],
    "repeatPolicy": "once"
  },
  {
    "id": "PRO_001_TRIO_ENGAGEMENT",
    "status": "LOCKED",
    "act": "PROLOGUE",
    "type": "major",
    "trigger": "CHAIN:PRO_000_LAST_MEMORY",
    "summary": "Brief playable or semi-interactive battle segment establishes the trio and the Fallen's overwhelming scale.",
    "implementationNote": "Use existing combat only if a scripted outcome can be supported without refactoring. Otherwise use cinematic/semi-interactive presentation.",
    "effects": [
      "SET_EVENT_COMPLETE:PRO_001_TRIO_ENGAGEMENT"
    ],
    "repeatPolicy": "once"
  },
  {
    "id": "PRO_002_FALLEN_HESITATES",
    "status": "LOCKED",
    "act": "PROLOGUE",
    "type": "short",
    "trigger": "CHAIN:PRO_001_TRIO_ENGAGEMENT",
    "summary": "The Fallen briefly hesitates when confronted by one trio member.",
    "hiddenTruth": "That hero holds the strongest prior-cycle Kizuna bond with PROTAGONIST.",
    "effects": [
      "SET_EVENT_COMPLETE:PRO_002_FALLEN_HESITATES"
    ],
    "repeatPolicy": "once"
  },
  {
    "id": "PRO_003_LIBERATION_STRIKE",
    "status": "LOCKED",
    "act": "PROLOGUE",
    "type": "major",
    "trigger": "CHAIN:PRO_002_FALLEN_HESITATES",
    "summary": "The trio lands the decisive strike. The Fallen collapses. Do not reveal the monster's identity.",
    "effects": [
      "SET_EVENT_COMPLETE:PRO_003_LIBERATION_STRIKE"
    ],
    "repeatPolicy": "once"
  },
  {
    "id": "PRO_004_REBIRTH",
    "status": "LOCKED",
    "act": "PROLOGUE",
    "type": "short",
    "trigger": "CHAIN:PRO_003_LIBERATION_STRIKE",
    "participants": [
      "PROTAGONIST"
    ],
    "summary": "Blackness, water, breath. PROTAGONIST awakens at the Landing with faint impressions of the battle.",
    "effects": [
      "SET_EVENT_COMPLETE:PRO_004_REBIRTH",
      "SET_CAMPAIGN_ACT:ACT_I"
    ],
    "repeatPolicy": "once"
  },
  {
    "id": "PRO_005_RISE",
    "status": "LOCKED",
    "act": "PROLOGUE",
    "type": "micro",
    "trigger": "CHAIN:PRO_004_REBIRTH",
    "participants": [
      "CREATOR_PRIESTESS",
      "PROTAGONIST"
    ],
    "summary": "The unknown voice says: Rise.",
    "speakerPresentation": {
      "canonical": "CREATOR_PRIESTESS",
      "preRevealAlias": "UNKNOWN_VOICE"
    },
    "effects": [
      "SET_EVENT_COMPLETE:PRO_005_RISE"
    ],
    "repeatPolicy": "once"
  },
  {
    "id": "PRO_006_TITLE",
    "status": "LOCKED",
    "act": "PROLOGUE",
    "type": "system",
    "trigger": "CHAIN:PRO_005_RISE",
    "summary": "Display KIZUNA | RESONANCE title.",
    "effects": [
      "SET_EVENT_COMPLETE:PRO_006_TITLE"
    ],
    "repeatPolicy": "once"
  },
  {
    "id": "PRO_007_FIRST_ECHO",
    "status": "PROVISIONAL",
    "act": "PROLOGUE",
    "type": "short",
    "trigger": "AFTER:PRO_006_TITLE",
    "participants": [
      "PROTAGONIST"
    ],
    "summary": "A 5-15 second fragmented echo of the opening battle: silhouettes, a strike, the monster, no context.",
    "effects": [
      "UNLOCK_RESONANCE:PROLOGUE_ECHO_01",
      "SET_EVENT_COMPLETE:PRO_007_FIRST_ECHO"
    ],
    "repeatPolicy": "once"
  },
  {
    "id": "PRO_008_ASCENT_BEGINS",
    "status": "LOCKED",
    "act": "ACT_I",
    "type": "system",
    "trigger": "CHAIN:PRO_007_FIRST_ECHO",
    "summary": "Give the player control at the Landing and present the simple objective ASCEND.",
    "effects": [
      "SET_EVENT_COMPLETE:PRO_008_ASCENT_BEGINS",
      "SET_CHAPTER:ACT1_FIRST_ASCENT"
    ],
    "repeatPolicy": "once"
  },
  {
    "id": "A1_010_FIRST_COMPANION",
    "status": "PROVISIONAL",
    "act": "ACT_I",
    "type": "short",
    "trigger": "FIRST_ELIGIBLE_TRAVELER_ENCOUNTER",
    "summary": "PROTAGONIST encounters the first companion while climbing. Identity/order should map to current roster design rather than be hard-coded by narrative framework.",
    "effects": [
      "SET_EVENT_COMPLETE:A1_010_FIRST_COMPANION"
    ],
    "repeatPolicy": "once"
  },
  {
    "id": "A1_020_RESONANCE_TUTORIAL",
    "status": "LOCKED",
    "act": "ACT_I",
    "type": "short",
    "trigger": "FIRST_RESONANCE_RELIC",
    "summary": "Introduce a fragmentary memory that answers almost nothing but establishes the Resonance language.",
    "effects": [
      "UNLOCK_SYSTEM:RESONANCE",
      "SET_EVENT_COMPLETE:A1_020_RESONANCE_TUTORIAL"
    ],
    "repeatPolicy": "once"
  },
  {
    "id": "A1_030_FIRST_CAMP",
    "status": "LOCKED",
    "act": "ACT_I",
    "type": "short",
    "trigger": "FIRST_SAFE_REST_WITH_COMPANION",
    "summary": "A quiet human scene establishes that ordinary conversation and companionship are the emotional counterweight to the Abyss.",
    "effects": [
      "UNLOCK_SYSTEM:KIZUNA",
      "SET_EVENT_COMPLETE:A1_030_FIRST_CAMP"
    ],
    "repeatPolicy": "once"
  },
  {
    "id": "A1_040_FIRST_PRESENT_FALLEN",
    "status": "LOCKED",
    "act": "ACT_I",
    "type": "major",
    "trigger": "FIRST_DOMAIN_BOSS_REACHED",
    "participants": [
      "FIRST_PRESENT_FALLEN"
    ],
    "summary": "Party confronts a major Fallen. Dialogue is broken and seemingly monstrous.",
    "effects": [
      "SET_EVENT_COMPLETE:A1_040_FIRST_PRESENT_FALLEN"
    ],
    "repeatPolicy": "once"
  },
  {
    "id": "A1_041_FIRST_PRESENT_FALLEN_THANKS",
    "status": "LOCKED",
    "act": "ACT_I",
    "type": "micro",
    "trigger": "COMBAT_VICTORY:A1_040_FIRST_PRESENT_FALLEN",
    "summary": "As the Fallen dies, a faint human voice says: Thank you.",
    "effects": [
      "SET_EVENT_COMPLETE:A1_041_FIRST_PRESENT_FALLEN_THANKS"
    ],
    "repeatPolicy": "once"
  },
  {
    "id": "A1_050_FIRST_CANON_REBIRTH",
    "status": "LOCKED",
    "act": "ACT_I",
    "type": "major",
    "trigger": "FIRST_PLAYER_DEATH_AFTER:A1_041_FIRST_PRESENT_FALLEN_THANKS",
    "summary": "Player rebirth at Landing establishes death as diegetic and memory as unstable.",
    "effects": [
      "INCREMENT:rebirthCount",
      "SET_EVENT_COMPLETE:A1_050_FIRST_CANON_REBIRTH"
    ],
    "repeatPolicy": "once"
  },
  {
    "id": "A1_060_FALLEN_REBORN_HUMAN",
    "status": "LOCKED",
    "act": "ACT_I",
    "type": "major",
    "trigger": "LANDING_AFTER:A1_050_FIRST_CANON_REBIRTH",
    "participants": [
      "FIRST_PRESENT_FALLEN"
    ],
    "summary": "The defeated boss appears at the Landing in human form, confused and without clear memory of being Fallen.",
    "effects": [
      "SET_REVEAL:REVEAL_FALLEN_ARE_TRAVELERS",
      "SET_EVENT_COMPLETE:A1_060_FALLEN_REBORN_HUMAN"
    ],
    "repeatPolicy": "once"
  },
  {
    "id": "A2_100_FIRST_SIN_REVEAL",
    "status": "PROVISIONAL",
    "act": "ACT_II",
    "type": "major",
    "trigger": "CHARACTER_MEMORY_STAGE:SIN",
    "summary": "First major character transgression is revealed, breaking the assumption that the cast are innocent souls unjustly trapped.",
    "repeatPolicy": "once"
  },
  {
    "id": "A2_120_TRIO_SURVIVOR_A",
    "status": "PROVISIONAL",
    "act": "ACT_II",
    "type": "major",
    "trigger": "STORY_GATE:TRIO_SURVIVOR_A",
    "participants": [
      "PROTAGONIST",
      "PREV_TRIO_A"
    ],
    "summary": "One opening hero is encountered alive as a traveler. Neither party has enough memory to explain the familiarity.",
    "repeatPolicy": "once"
  },
  {
    "id": "A2_130_TRIO_SURVIVOR_B",
    "status": "PROVISIONAL",
    "act": "ACT_II",
    "type": "major",
    "trigger": "STORY_GATE:TRIO_SURVIVOR_B",
    "participants": [
      "PROTAGONIST",
      "PREV_TRIO_B"
    ],
    "summary": "Second opening hero reappears. Their memory of previous cycles may be stronger or differently fragmented.",
    "repeatPolicy": "once"
  },
  {
    "id": "A3_200_PLAYABLE_FALLEN_REVEAL",
    "status": "LOCKED",
    "act": "ACT_III",
    "type": "major",
    "trigger": "STORY_GATE:PLAYABLE_FALLEN_TRUTH",
    "summary": "Party discovers playable travelers have also become Fallen in prior cycles.",
    "effects": [
      "SET_REVEAL:REVEAL_PLAYABLES_HAVE_FALLEN_FORMS"
    ],
    "repeatPolicy": "once"
  },
  {
    "id": "A3_220_TRIO_C_FALLEN",
    "status": "LOCKED",
    "act": "ACT_III",
    "type": "major",
    "trigger": "STORY_GATE:TRIO_C_FALLEN",
    "participants": [
      "PROTAGONIST",
      "PREV_TRIO_C"
    ],
    "summary": "The third opening hero has fallen and is now a major boss. Recognition fragments begin surfacing during/after the encounter.",
    "repeatPolicy": "once"
  },
  {
    "id": "A3_230_PROLOGUE_POV_REPLAY",
    "status": "LOCKED",
    "act": "ACT_III",
    "type": "cinematic",
    "trigger": "AFTER:A3_220_TRIO_C_FALLEN",
    "summary": "Replay key moments of the prologue from inside the opening Fallen's perception.",
    "effects": [
      "SET_REVEAL:REVEAL_PROLOGUE_WAS_REAL"
    ],
    "repeatPolicy": "once"
  },
  {
    "id": "A3_240_PROTAGONIST_WAS_FALLEN",
    "status": "LOCKED",
    "act": "ACT_III",
    "type": "major",
    "trigger": "CHAIN:A3_230_PROLOGUE_POV_REPLAY",
    "summary": "Reveal that the opening Fallen was PROTAGONIST in the prior cycle and that the trio liberated them.",
    "effects": [
      "SET_REVEAL:REVEAL_PROLOGUE_FALLEN_IDENTITY"
    ],
    "repeatPolicy": "once"
  },
  {
    "id": "A4_300_PRIOR_KIZUNA_REVEAL",
    "status": "LOCKED",
    "act": "ACT_IV",
    "type": "major",
    "trigger": "STORY_GATE:TRIO_PRIOR_KIZUNA",
    "summary": "Reveal which opening hero shared the strongest prior-cycle bond with PROTAGONIST, explaining the Fallen's hesitation.",
    "effects": [
      "SET_REVEAL:REVEAL_TRIO_PRIOR_KIZUNA"
    ],
    "repeatPolicy": "once"
  },
  {
    "id": "A4_330_ABYSS_CREATOR_TRUTH",
    "status": "LOCKED",
    "act": "ACT_IV",
    "type": "major",
    "trigger": "STORY_GATE:CREATOR_TRUTH",
    "summary": "Reveal the Priestess's betrayal, execution, vengeance, creation of the refuge, and endless waiting for betrayers who never came.",
    "effects": [
      "SET_REVEAL:REVEAL_PRIESTESS_IS_CREATOR",
      "SET_REVEAL:REVEAL_ABYSS_ORIGINAL_PURPOSE"
    ],
    "repeatPolicy": "once"
  },
  {
    "id": "A5_400_PRIESTESS_VOICE_REVEAL",
    "status": "LOCKED",
    "act": "ACT_V",
    "type": "major",
    "trigger": "FIRST_DIRECT_PRIESTESS_ENCOUNTER",
    "summary": "Recognition through voice/cadence reveals that the unknown narrator who said Rise was the Priestess all along.",
    "effects": [
      "SET_REVEAL:REVEAL_PRIESTESS_IS_VOICE"
    ],
    "repeatPolicy": "once"
  },
  {
    "id": "A5_420_FINAL_LIBERATION",
    "status": "LOCKED",
    "act": "ACT_V",
    "type": "cinematic",
    "trigger": "FINAL_BOSS_VICTORY",
    "summary": "The party frees the Priestess from accumulated grief. Victory is liberation, not execution.",
    "effects": [
      "SET_WORLD_STATE:ABYSS_COLLAPSE",
      "SET_EVENT_COMPLETE:A5_420_FINAL_LIBERATION"
    ],
    "repeatPolicy": "once"
  },
  {
    "id": "A5_430_STEWARD_CHOICE",
    "status": "LOCKED",
    "act": "ACT_V",
    "type": "major",
    "trigger": "CHAIN:A5_420_FINAL_LIBERATION",
    "summary": "Freed to leave, the Priestess chooses to return as steward of lost souls rather than remain as punisher or wait for her betrayers.",
    "effects": [
      "SET_WORLD_STATE:STEWARD_REALM",
      "SET_EVENT_COMPLETE:A5_430_STEWARD_CHOICE"
    ],
    "repeatPolicy": "once"
  },
  {
    "id": "EPI_500_RISE_AGAIN",
    "status": "LOCKED",
    "act": "EPILOGUE",
    "type": "cinematic",
    "trigger": "CHAIN:A5_430_STEWARD_CHOICE",
    "participants": [
      "CREATOR_PRIESTESS",
      "NEW_LOST_SOUL"
    ],
    "summary": "A new soul awakens in the renewed refuge. The Priestess is present and says Rise, transforming the opening command into an act of welcome and guidance.",
    "repeatPolicy": "once"
  }
];

const NARR_PRINCIPLES = {
  "combatBoundary": "OBSERVE_EXISTING_COMBAT_DO_NOT_REWRITE",
  "speakerSpoilerPolicy": "CANONICAL_ID_WITH_REVEAL_SAFE_ALIAS",
  "protagonistRole": "PROTAGONIST",
  "runCanon": true,
  "memoryRule": "THE_MIND_FORGETS_THE_SOUL_REMEMBERS"
};

// ─── 1. STATE ───────────────────────────────────────────────────────────────
let NARR = null;

function narrDefaultState() {
  return {
    version: NARR_VERSION,
    campaign: { act: 'PROLOGUE', chapter: 'PROLOGUE', highestDomainReached: null, rebirthCount: 0 },
    events: { completed: [], seenCount: {} },
    reveals: {
      PRIESTESS_EXISTS: false,
      REVEAL_PRIESTESS_IS_CREATOR: false,
      REVEAL_PRIESTESS_IS_VOICE: false,
      REVEAL_FALLEN_ARE_TRAVELERS: false,
      REVEAL_PLAYABLES_HAVE_FALLEN_FORMS: false,
      REVEAL_PROLOGUE_WAS_REAL: false,
      REVEAL_PROLOGUE_FALLEN_IDENTITY: false,
      REVEAL_TRIO_PRIOR_KIZUNA: false,
      REVEAL_ABYSS_ORIGINAL_PURPOSE: false,
    },
    resonance: { unlocked: [], characterStage: {} },
    kizuna: { pairs: {} },
    // Role → character mappings stay null until the story bible LOCKS them.
    // PROTAGONIST may present as Ash at the content layer, but the framework
    // never assumes it (handoff: do not hard-code the mapping).
    roles: { PROTAGONIST: null, PREV_TRIO_A: null, PREV_TRIO_B: null, PREV_TRIO_C: null,
             PREV_TRIO_STRONGEST_BOND: null, FIRST_PRESENT_FALLEN: null },
  };
}

// Load with a conservative migration: campaign progression must never be lost
// (the mind forgets; the SAVE remembers). On a version mismatch or damage we
// rebuild defaults and carry across only what still validates — completed
// event ids and boolean reveals — rather than trusting an old shape wholesale.
function narrLoad() {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(NARR_KEY)); } catch (_) { raw = null; }
  if (raw && raw.version === NARR_VERSION && raw.campaign && raw.events && raw.reveals) {
    const st = narrDefaultState();
    // merge stored onto defaults so new keys added later always exist
    st.campaign = Object.assign(st.campaign, raw.campaign);
    st.events = Object.assign(st.events, raw.events);
    st.reveals = Object.assign(st.reveals, raw.reveals);
    st.resonance = Object.assign(st.resonance, raw.resonance || {});
    st.kizuna = Object.assign(st.kizuna, raw.kizuna || {});
    st.roles = Object.assign(st.roles, raw.roles || {});
    if (raw.systems) st.systems = raw.systems;
    return st;
  }
  const st = narrDefaultState();
  if (raw && typeof raw === 'object') {
    if (raw.events && Array.isArray(raw.events.completed))
      st.events.completed = raw.events.completed.filter(x => typeof x === 'string');
    if (raw.reveals && typeof raw.reveals === 'object')
      Object.keys(st.reveals).forEach(k => { if (raw.reveals[k] === true) st.reveals[k] = true; });
    if (raw.campaign && typeof raw.campaign === 'object') {
      if (typeof raw.campaign.act === 'string') st.campaign.act = raw.campaign.act;
      if (typeof raw.campaign.chapter === 'string') st.campaign.chapter = raw.campaign.chapter;
      if (typeof raw.campaign.rebirthCount === 'number') st.campaign.rebirthCount = raw.campaign.rebirthCount;
    }
  }
  return st;
}
function narrSave() { try { localStorage.setItem(NARR_KEY, JSON.stringify(NARR)); } catch (_) {} }
function narrState() { if (!NARR) NARR = narrLoad(); return NARR; }
function narrDone(id) { return narrState().events.completed.indexOf(id) >= 0; }
function narrBeat(id) { return NARR_BEATS.find(b => b.id === id) || null; }

// ─── SPEAKERS — the one gate every player-facing name passes through ────────
// Pre-reveal, the Priestess is only ever the unattributed voice. Role ids
// resolve to their mapped character's name once the mapping is locked in
// state; until then they fall back to a neutral description.
const NARR_ALIAS = {
  CREATOR_PRIESTESS: '???',
  UNKNOWN_VOICE: '???',
  PROTAGONIST: 'YOU',
  PREV_TRIO_A: 'A TRAVELER',
  PREV_TRIO_B: 'A TRAVELER',
  PREV_TRIO_C: 'A TRAVELER',
  FIRST_PRESENT_FALLEN: 'THE FALLEN',
  OPENING_FALLEN: 'THE FALLEN',
};
function narrSpeaker(canonicalId) {
  const n = narrState();
  if (canonicalId === 'CREATOR_PRIESTESS' || canonicalId === 'UNKNOWN_VOICE')
    return n.reveals.REVEAL_PRIESTESS_IS_VOICE ? 'THE PRIESTESS' : NARR_ALIAS.UNKNOWN_VOICE;
  const mapped = n.roles && n.roles[canonicalId];
  if (mapped && typeof HEROES !== 'undefined' && HEROES[mapped]) return HEROES[mapped].name;
  return NARR_ALIAS[canonicalId] || '';
}

// ─── 3. TRIGGERS ────────────────────────────────────────────────────────────
// Literal signals match directly (NEW_GAME, FIRST_RESONANCE_RELIC, STORY_GATE:x,
// COMBAT_VICTORY:x, CHAIN:x, AFTER:x). Two grammar forms are conditions, not
// names — they fire on a GENERIC signal once their anchor event is complete:
//   FIRST_PLAYER_DEATH_AFTER:<id>  ← signal 'PLAYER_DEATH'
//   LANDING_AFTER:<id>             ← signal 'LANDING'
function narrTriggerMatches(beat, signal) {
  if (narrDone(beat.id)) return false;                    // every v0.7 beat is once-only
  const t = beat.trigger || '';
  if (t === signal) return true;
  if (signal === 'PLAYER_DEATH' && t.indexOf('FIRST_PLAYER_DEATH_AFTER:') === 0)
    return narrDone(t.slice('FIRST_PLAYER_DEATH_AFTER:'.length));
  if (signal === 'LANDING' && t.indexOf('LANDING_AFTER:') === 0)
    return narrDone(t.slice('LANDING_AFTER:'.length));
  return false;
}
function narrCandidates(signal) { return NARR_BEATS.filter(b => narrTriggerMatches(b, signal)); }

// ─── 5. EFFECTS ─────────────────────────────────────────────────────────────
function narrApplyEffects(beat) {
  const n = narrState();
  (beat.effects || []).forEach(fx => {
    const i = fx.indexOf(':');
    const op = i < 0 ? fx : fx.slice(0, i), arg = i < 0 ? '' : fx.slice(i + 1);
    if (op === 'SET_EVENT_COMPLETE') {
      if (n.events.completed.indexOf(arg) < 0) n.events.completed.push(arg);
      n.events.seenCount[arg] = (n.events.seenCount[arg] || 0) + 1;
    }
    else if (op === 'SET_CAMPAIGN_ACT') n.campaign.act = arg;
    else if (op === 'SET_CHAPTER') n.campaign.chapter = arg;
    else if (op === 'UNLOCK_RESONANCE') { if (n.resonance.unlocked.indexOf(arg) < 0) n.resonance.unlocked.push(arg); }
    else if (op === 'UNLOCK_SYSTEM') { n.systems = n.systems || {}; n.systems[arg] = true; }
    else if (op === 'SET_REVEAL') n.reveals[arg] = true;
    else if (op === 'INCREMENT') n.campaign[arg] = (n.campaign[arg] || 0) + 1;
    else if (typeof console !== 'undefined') console.warn('[narrative] unknown effect', fx);
  });
  narrSave();
}

// ─── 4. RUNNER ──────────────────────────────────────────────────────────────
// game.js calls narrFire(signal, ctx, done). If nothing is eligible, done runs
// immediately — so callers can fire unconditionally and never special-case.
// When a beat completes, the runner looks for a hard CHAIN: link off it, then
// a soft AFTER: link, and keeps walking until the sequence is spent.
function narrFire(signal, ctx, done) {
  ctx = ctx || {};
  const beat = narrCandidates(signal)[0];
  if (!beat) { if (done) done(); return false; }
  narrRunBeat(beat, ctx, done, false);
  return true;
}
function narrRunBeat(beat, ctx, done, replay) {
  const scene = NARR_SCENES[beat.id];
  if (!scene && beat.type !== 'system') {
    // Authored data, unauthored presentation: leave the beat PENDING. Burning
    // a once-only beat with no scene would erase story the player never saw.
    if (typeof console !== 'undefined') console.warn('[narrative] no scene for', beat.id, '— left pending');
    if (done) done();
    return;
  }
  const after = replay ? (done || function () {}) : () => {
    narrApplyEffects(beat);
    const next = narrCandidates('CHAIN:' + beat.id)[0] || narrCandidates('AFTER:' + beat.id)[0];
    if (next) narrRunBeat(next, ctx, done, false);
    else if (done) done();
  };
  if (scene) scene(ctx, after, replay);
  else after();                                           // system beat: pure effects
}
// Replay a completed scene from the Archive — presentation only, no effects.
function narrReplay(id, back) {
  const beat = narrBeat(id);
  if (!beat || !NARR_SCENES[id]) { if (back) back(); return; }
  narrRunBeat(beat, { replay: true }, back, true);
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTENT — the prologue vertical slice (PRO_000 … PRO_008).
//
// Presented as a cinematic sequence (handoff Option B): the existing combat
// system is observed, not rewritten, and nothing here fakes an unwinnable
// fight. Visuals are painted the way this game paints all its scenes — CSS
// light on a dark stage — and prose reveals line by line on tap, exactly like
// showStory, so the prologue reads as the same game.
//
// VOICE RULES kept here: no names for the trio (identities PROVISIONAL), the
// Fallen is only ever "it / the Fallen", the voice is narrSpeaker-resolved,
// and nothing on screen may state the hidden truth.
// ═══════════════════════════════════════════════════════════════════════════

// A tap-through passage on a painted backdrop. Mirrors showStory's rhythm
// (one line per tap, newest kept in view) without depending on FLOW's shape.
function narrPassage(o, done) {
  let revealed = 1;
  const render = () => {
    const doneLines = revealed >= o.lines.length;
    showOverlay(`
      ${o.backdrop || ''}
      <div class="ov-eyebrow">${o.eyebrow || ''}</div>
      ${o.title ? `<div class="ov-title" style="font-size:24px">${o.title}</div>` : ''}
      <div class="ov-lines">${o.lines.slice(0, revealed).map(l =>
        `<div class="ov-line">${l.spk ? `<span class="spk">${l.spk}</span>` : ''}${l.text}</div>`).join('')}</div>
      ${doneLines ? `<button class="ov-btn primary" id="nv-go">${o.btn || 'CONTINUE'}</button>`
                  : `<div class="ov-tap">tap to continue ▸</div>`}
    `, 'story-screen narr-scene ' + (o.cls || ''));
    const box = document.querySelector('#overlay .ov-lines');
    if (box) box.scrollTop = box.scrollHeight;
    if (doneLines) {
      const go = document.querySelector('#nv-go');
      if (go) go.onclick = (ev) => { ev.stopPropagation(); hideOverlay(); done(); };
    } else {
      document.querySelector('#overlay').onclick = () => {
        document.querySelector('#overlay').onclick = null; revealed++;
        if (o.onReveal) o.onReveal(revealed);
        render();
      };
    }
  };
  render();
}

// The memory-city backdrop: familiar, impossible, emotional — the Abyss's
// three-part environmental rule, painted in gradients like every other scene.
function narrCityBackdrop(extra) {
  return `<div class="nv-scene">
    <div class="nv-sky"></div>
    <div class="nv-city nv-city-far"></div>
    <div class="nv-city nv-city-near"></div>
    <div class="nv-ash">${Array.from({ length: 10 }).map((_, i) => `<span style="--i:${i}"></span>`).join('')}</div>
    <div class="nv-fallen"><span class="nv-fallen-eye e1"></span><span class="nv-fallen-eye e2"></span></div>
    <div class="nv-trio"><span class="nv-fig f1"></span><span class="nv-fig f2"></span><span class="nv-fig f3"></span></div>
    ${extra || ''}
  </div>`;
}

const NARR_SCENES = {

  // In a post-apocalyptic memory-city, three heroes battle a gigantic Fallen.
  // No context is given — the player is left to assume dream or prophecy.
  PRO_000_LAST_MEMORY: (ctx, done) => {
    narrPassage({
      cls: 'nv-pro-city',
      backdrop: narrCityBackdrop(),
      eyebrow: '· · ·',
      lines: [
        { text: 'A city that was. Towers lean over streets that end in open sky, and a cathedral grows straight out of an apartment block, as if both had always agreed to it.' },
        { text: 'Ash falls upward, slow, like the ground is letting go of it.' },
        { text: 'Three figures hold the last intersection. They are small against what is coming, and they are not running.' },
        { text: 'The thing that fills the avenue was not built and was not born. It moves like something that has forgotten every shape it ever had except <b>forward</b>.' },
      ],
      btn: 'HOLD THE LINE',
    }, done);
  },

  // Semi-interactive engagement: each tap is a beat of the fight. Scale first,
  // then the trio as one animal — competence without names.
  PRO_001_TRIO_ENGAGEMENT: (ctx, done) => {
    narrPassage({
      cls: 'nv-pro-city nv-fight',
      backdrop: narrCityBackdrop(),
      eyebrow: 'THE LAST INTERSECTION',
      onReveal: () => { const s = document.querySelector('.nv-scene'); if (s) { s.classList.remove('nv-hit'); void s.offsetWidth; s.classList.add('nv-hit'); } },
      lines: [
        { text: 'One of them steps out first and <b>takes its attention</b> — turns a blow that should end the street aside with something between skill and refusal.' },
        { text: 'The second is never where it strikes. Every miss buys the third a breath, and the third spends every breath exactly.' },
        { text: 'They do not speak. They do not need to. Three people moving like one long-practised sentence.' },
        { text: 'And still it comes on. Whole floors of it. They are winning, and it does not matter, and they keep winning anyway.' },
      ],
      btn: 'CONTINUE',
    }, done);
  },

  // It hesitates before ONE of them. Reads as boss behavior. Is not.
  PRO_002_FALLEN_HESITATES: (ctx, done) => {
    narrPassage({
      cls: 'nv-pro-city nv-still',
      backdrop: narrCityBackdrop('<div class="nv-hush"></div>'),
      eyebrow: 'ONE BREATH',
      lines: [
        { text: 'It turns on the third figure, full weight behind the blow that has been coming all fight —' },
        { text: '— and stops.' },
        { text: 'Nothing stops it. It has walked through walls of the world all night. But before this one small person it hangs, enormous and unmoving, for exactly one breath.' },
        { text: 'The breath ends.' },
      ],
      btn: 'CONTINUE',
    }, done);
  },

  // The decisive strike. Whiteout, collapse, cut to black before any answer.
  PRO_003_LIBERATION_STRIKE: (ctx, done) => {
    narrPassage({
      cls: 'nv-pro-city nv-strikeout',
      backdrop: narrCityBackdrop('<div class="nv-flash"></div>'),
      eyebrow: 'TOGETHER',
      lines: [
        { text: 'Three answers arrive as one. The avenue goes <b>white</b>.' },
        { text: 'The colossus comes apart — not like a thing breaking, but like a held breath, finally let go.' },
        { text: 'As it falls, the ash stops climbing. The city is quiet in a way it has clearly not been for a very long time.' },
      ],
      btn: '· · ·',
    }, done);
  },

  // Blackness, water, breath. Awakening at the Landing with almost nothing.
  PRO_004_REBIRTH: (ctx, done) => {
    narrPassage({
      cls: 'nv-black nv-water',
      backdrop: '<div class="nv-scene nv-scene-black"><div class="nv-ripple"></div><div class="nv-breath"></div></div>',
      eyebrow: '',
      lines: [
        { text: 'Black. Cold. Shallow water, holding you the way a hand holds something it has caught.' },
        { text: 'You breathe. The breath is loud. It feels newly issued.' },
        { text: 'There was — a city? Three small lights against something vast? It is already going, the way dreams go, faster the harder you hold.' },
      ],
      btn: 'OPEN YOUR EYES',
    }, done);
  },

  // The voice. One word. The speaker plate resolves through narrSpeaker so the
  // canonical identity can never reach the DOM before its reveal.
  PRO_005_RISE: (ctx, done) => {
    narrPassage({
      cls: 'nv-black nv-rise',
      backdrop: '<div class="nv-scene nv-scene-black"></div>',
      eyebrow: '',
      lines: [
        { spk: narrSpeaker('CREATOR_PRIESTESS'), text: '<span class="nv-word">Rise.</span>' },
      ],
      btn: 'RISE',
    }, done);
  },

  // The title, where a film would put it: after the cold open.
  PRO_006_TITLE: (ctx, done) => {
    showOverlay(`
      <div class="nv-scene nv-scene-black"></div>
      <div class="nv-titlecard">
        <div class="nv-t1">KIZUNA</div>
        <div class="nv-trule"></div>
        <div class="nv-t2">RESONANCE</div>
      </div>
      <div class="ov-tap">tap ▸</div>
    `, 'story-screen narr-scene nv-black nv-titlecard-screen');
    document.querySelector('#overlay').onclick = () => { hideOverlay(); done(); };
  },

  // A 5–15 second fragmented echo: the battle again, in shards, no context.
  // Its resonance unlock is an EFFECT (data), not something the scene narrates.
  PRO_007_FIRST_ECHO: (ctx, done) => {
    narrPassage({
      cls: 'nv-pro-city nv-echo',
      backdrop: narrCityBackdrop(),
      eyebrow: '· · ·',
      lines: [
        { text: 'A strike. Silhouettes. Something enormous, falling —' },
        { text: 'Gone. Between one heartbeat and the next, gone entirely. Only the feeling stays, the way warmth stays in a chair.' },
        { text: 'Something of it stays with you.' },
      ],
      btn: 'CONTINUE',
    }, done);
  },

  // Control. One objective, one word, then the game the player came for.
  PRO_008_ASCENT_BEGINS: (ctx, done) => {
    narrPassage({
      cls: 'nv-black nv-objective',
      backdrop: '<div class="nv-scene nv-scene-black"><div class="nv-shaft-up"></div></div>',
      eyebrow: 'THE ONLY DIRECTION',
      title: 'ASCEND',
      lines: [
        { text: 'The dark above you is stacked in floors, like a building, like a throat. Somewhere up there is out.' },
      ],
      btn: 'BEGIN',
    }, done);
  },
};

// Player-safe archive titles for completed scenes — the Journal's ECHOES tab.
// System beats and unauthored beats never list; titles must stay reveal-safe.
const NARR_ARCHIVE_TITLES = {
  PRO_000_LAST_MEMORY: 'The Last Memory',
  PRO_001_TRIO_ENGAGEMENT: 'Three Against the Colossus',
  PRO_002_FALLEN_HESITATES: 'One Breath',
  PRO_003_LIBERATION_STRIKE: 'The Avenue Goes White',
  PRO_004_REBIRTH: 'Shallow Water',
  PRO_005_RISE: 'Rise',
  PRO_007_FIRST_ECHO: 'The First Echo',
};
function narrArchiveEntries() {
  return narrState().events.completed
    .filter(id => NARR_ARCHIVE_TITLES[id] && NARR_SCENES[id])
    .map(id => ({ id, title: NARR_ARCHIVE_TITLES[id] }));
}
function journalEchoesHtml() {
  const rows = narrArchiveEntries();
  if (!rows.length) return `<div class="nv-arc-empty">Nothing yet. What happens to you is kept here — the mind forgets, but this page remembers.</div>`;
  return `<div class="nv-arc-list">${rows.map(e => `
    <button class="nv-arc-row" data-narr="${e.id}">
      <span class="nv-arc-name">✧ ${e.title}</span>
      <span class="nv-arc-go">REPLAY ›</span>
    </button>`).join('')}</div>`;
}

// ─── DEV — the narrative inspector (integration plan §12) ───────────────────
// Read-only truth about the engine: where the campaign stands, what has fired,
// what is waiting on what. Dev-only surface, so canonical ids ARE shown here.
function showNarrativeInspector(back) {
  const n = narrState();
  const signals = ['NEW_GAME', 'LANDING', 'PLAYER_DEATH'];
  const rows = NARR_BEATS.map(b => {
    const isDone = narrDone(b.id);
    const live = signals.some(s => narrTriggerMatches(b, s))
      || narrTriggerMatches(b, 'CHAIN:' + (n.events.completed[n.events.completed.length - 1] || ''));
    const scene = !!NARR_SCENES[b.id] || b.type === 'system';
    const state = isDone ? '<span class="nvi-done">DONE</span>'
      : !scene ? '<span class="nvi-noscene">NO SCENE</span>'
      : live ? '<span class="nvi-live">ELIGIBLE</span>'
      : `<span class="nvi-wait">waits: ${b.trigger}</span>`;
    return `<div class="nvi-row"><span class="nvi-id">${b.id}</span>${state}</div>`;
  }).join('');
  const revs = Object.keys(n.reveals).map(k =>
    `<span class="nvi-flag ${n.reveals[k] ? 'on' : ''}">${k.replace(/^REVEAL_/, '')}</span>`).join('');
  const roles = Object.keys(n.roles).map(k => `<div class="nvi-row"><span class="nvi-id">${k}</span><span class="nvi-wait">${n.roles[k] || '—'}</span></div>`).join('');
  showOverlay(`
    <div class="ov-eyebrow">DEV</div>
    <div class="ov-title" style="font-size:20px; margin-bottom:8px;">NARRATIVE INSPECTOR</div>
    <div class="nvi-head">act <b>${n.campaign.act}</b> · chapter <b>${n.campaign.chapter}</b> · rebirths <b>${n.campaign.rebirthCount}</b>
      · resonance <b>${n.resonance.unlocked.length}</b> · kizuna pairs <b>${Object.keys(n.kizuna.pairs).length}</b></div>
    <div class="nvi-sec">EVENTS (${n.events.completed.length}/${NARR_BEATS.length})</div>
    <div class="nvi-list">${rows}</div>
    <div class="nvi-sec">REVEALS</div>
    <div class="nvi-flags">${revs}</div>
    <div class="nvi-sec">ROLES</div>
    <div class="nvi-list">${roles}</div>
    <div class="nvi-btns">
      <button class="menu-item" id="nvi-prologue"><span>▸ RUN / REPLAY PROLOGUE</span></button>
      <button class="menu-item" id="nvi-seed"><span>SKIP PROLOGUE (mark complete)</span></button>
      <button class="menu-item mi-danger" id="nvi-wipe"><span>WIPE NARRATIVE STATE</span></button>
      <button class="menu-item menu-primary" id="nvi-back"><span>◂ BACK</span></button>
    </div>
  `, 'menu-screen nvi-screen');
  const again = () => showNarrativeInspector(back);
  document.querySelector('#nvi-prologue').onclick = () => {
    hideOverlay();
    if (narrDone('PRO_000_LAST_MEMORY')) narrReplay('PRO_000_LAST_MEMORY', again);
    else narrFire('NEW_GAME', {}, again);
  };
  document.querySelector('#nvi-seed').onclick = () => { narrSeedPrologueComplete(); again(); };
  document.querySelector('#nvi-wipe').onclick = () => { narrWipe(); again(); };
  document.querySelector('#nvi-back').onclick = () => { hideOverlay(); if (back) back(); };
}
function narrWipe() { try { localStorage.removeItem(NARR_KEY); } catch (_) {} NARR = null; }
// Mark the whole prologue complete without presenting it — dev/test utility,
// applies each beat's real effects so state lands exactly where playing lands it.
function narrSeedPrologueComplete() {
  NARR_BEATS.filter(b => b.id.indexOf('PRO_') === 0).forEach(b => { if (!narrDone(b.id)) narrApplyEffects(b); });
}
