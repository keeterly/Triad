// ============================================================================
// KIZUNA v2 — "Threads" card prototype.  BUILD 2.
//
// Design thesis: THE PARTY IS THE CHARACTER.  Cards are the expression layer;
// formation + relationships are the game.
//
//  · Each hero: 1 Core + 1 Signature card, re-written by their row (stance),
//    plus battle-generated temporaries (the resonant card is the first).
//  · Resonance is EMERGENT: single-target help forms a visible thread.
//    A full triangle freezes the field — TRIAD FORMED — and a resonant card
//    burns into the hand, keyed to the CLASS composition of the trio.  Every
//    class-triangle has its own vow (Offense / Defense / Formation), so which
//    three walk together IS the build.
//  · Reactive combat: enemy blows are PARRIED on a rhythm window; chaining
//    links / weakness / follow-ups fills BURST, unleashed as an interactive
//    ALL-OUT — the offensive mirror of the parry.
//  · The DESCENT is a procedurally-generated branching map (fight / elite /
//    event / camp / recruit / boss); a fallen party's ashes are remembered by
//    the Abyss and resurface in the next descent.
// ============================================================================

'use strict';

const V2_BUILD = 53;
const $ = (sel) => document.querySelector(sel);

// ---------------------------------------------------------------------------
// SETTINGS — persisted player options (menu) + dev toggles.
// ---------------------------------------------------------------------------
const SETTINGS_KEY = 'kizuna2_1.settings';
const SETTINGS = Object.assign(
  { sound: true, haptics: true, fightBg: true },
  (() => { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') || {}; } catch (_) { return {}; } })()
);
function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(SETTINGS)); } catch (_) {} }

// ---------------------------------------------------------------------------
// EMBERS — the PER-RUN progression currency.  Defeating foes yields embers,
// spent on your party's Ember Tree (a skill-tree for cards) to open their kit
// for THIS descent.  Everything resets when the run ends — see below.
// ---------------------------------------------------------------------------
// META now holds only the persistent difficulty setting (HEAT).  Progression is
// NOT permanent — it lives on the RUN.
const META_KEY = 'kizuna2_1.meta';
const META = Object.assign(
  { heat: 0 },
  (() => { try { const m = JSON.parse(localStorage.getItem(META_KEY) || '{}') || {}; return { heat: +m.heat || 0 }; } catch (_) { return {}; } })()
);
function saveMeta() { try { localStorage.setItem(META_KEY, JSON.stringify({ heat: META.heat })); } catch (_) {} }
// PER-RUN progression — embers and skill-tree unlocks live on the RUN and reset
// when it ends (death OR completion).  Between runs nothing is banked; every
// descent you rebuild your party's kit from scratch.
function runEmbers() { return (RUN && +RUN.embers) || 0; }
function hasNode(id) { return !!(RUN && RUN.nodes && RUN.nodes.indexOf(id) >= 0); }
function unlockNode(id) { if (RUN && !hasNode(id)) { (RUN.nodes = RUN.nodes || []).push(id); saveRun(); } }
function addEmbers(n) { if (!RUN) return; RUN.embers = Math.max(0, (RUN.embers || 0) + n); saveRun(); }
// A tree TIER opens as you DESCEND: tier 1 from the start, tier 2 once a couple
// of nodes are behind you, tier 3 deeper still — the kit grows across the run.
function runDepth() { return RUN ? ((RUN.depthBase || 0) + (RUN.completed ? RUN.completed.length : 0)) : 0; }
function tierOpen(tier) { return runDepth() >= (tier - 1) * 2; }
// one-time hand-hold: the first time you have embers to spend, the game walks
// you through opening the Ember Tree and kindling a skill.
function treeTaught() { try { return localStorage.getItem('kizuna2_1.treeTaught') === '1'; } catch (_) { return false; } }
function setTreeTaught() { try { localStorage.setItem('kizuna2_1.treeTaught', '1'); } catch (_) {} }

// ---------------------------------------------------------------------------
// THE EMBER TREE — declarative skill-tree for cards.  Each node is pure data
// the engine reads at card-build/move time, so there is no bespoke code per
// node.  Node types:
//   card    — unlocks a hero's signature card for a stance (SIG_GATE)
//   rider   — attaches an effect to an existing card (bridge: adds a keyword)
//   passive — a standing rule fired by a game hook (e.g. moving to FRONT)
//   allout  — an alternate all-out (Phase 3)
// Phase 1 ships Ash's opening constellation; other heroes keep their full kit
// until they get their own constellations.
// ---------------------------------------------------------------------------
const EMBER_TREE = [
  { id: 'ash.sig.front', hero: 'ash', tier: 1, cost: 4, type: 'card', gate: { stance: 'front' }, label: 'Crashing Wave', desc: 'FRONT signature — an 11-damage cleave through the nearest foe.' },
  { id: 'ash.sig.back',  hero: 'ash', tier: 1, cost: 4, type: 'card', gate: { stance: 'back'  }, label: 'Marked Fate',  desc: 'BACK signature — 3 damage and <span class="kw kw-exposed">◎ EXPOSED 4</span> on any foe.' },
  { id: 'ash.sig.mid',   hero: 'ash', tier: 1, cost: 5, type: 'card', gate: { stance: 'mid'   }, label: 'Crossguard',   desc: 'MID signature — throw <span class="kw kw-guard">⛨ 6</span> guard onto an ally.' },
  { id: 'ash.rider.expose', hero: 'ash', tier: 2, cost: 6, type: 'rider', requires: ['ash.sig.back'], label: 'Hunter’s Instinct', desc: 'Thrown Edge (BACK core) now also inflicts <span class="kw kw-exposed">◎ EXPOSED 2</span> — position becomes a debuff.', rider: { card: 'Thrown Edge', fx: { mark: 2 }, descAdd: ' · <span class="kw kw-exposed">◎ EXPOSED 2</span>' } },
  { id: 'ash.passive.vanguard', hero: 'ash', tier: 2, cost: 6, type: 'passive', label: 'Vanguard’s Momentum', desc: 'Whenever Ash closes to FRONT, he gains <span class="kw kw-guard">⛨ 3</span> guard — repositioning becomes defense.', passive: 'ash_vanguard' },
  { id: 'ash.allout.execution', hero: 'ash', tier: 3, cost: 10, type: 'allout', requires: ['ash.sig.front'], label: 'Rite of Endings', desc: 'ALT ALL-OUT — every strike of your all-out EXECUTES any foe left under 25% HP.', allout: 'execution' },
  { id: 'ash.emergent.tempo', hero: 'ash', tier: 3, cost: 9, type: 'emergent', requires: ['ash.sig.front'], label: 'Rising Tempo',
    desc: 'Ash learns the <b>rhythm of the duel</b>. Every <b>3rd strike</b> he lands this fight forges a free <b>Follow Cut</b> — the momentum becomes a card.',
    emergent: { on: 'hit', every: 3, stance: 'FORGED · TEMPO', flash: 'Ash finds the rhythm — <b>Follow Cut</b> forged.',
      forge: { name: 'Follow Cut', cost: 0, target: 'enemy', fx: { dmg: 7 }, desc: '<b>Free.</b> The rhythm carries the blade — <b>7 damage</b> to any foe. Landed on the beat.' } } },

  // ELIN — the Mender: wards and light
  { id: 'elin.sig.front', hero: 'elin', tier: 1, cost: 4, type: 'card', gate: { stance: 'front' }, label: 'Radiant Ward', desc: 'FRONT signature — every ally gains <span class="kw kw-guard">⛨ 3</span>.' },
  { id: 'elin.sig.mid',   hero: 'elin', tier: 1, cost: 5, type: 'card', gate: { stance: 'mid'   }, label: 'Sanctuary',   desc: 'MID signature — heal an ally 4 and ward them <span class="kw kw-guard">⛨ 4</span>.' },
  { id: 'elin.sig.back',  hero: 'elin', tier: 1, cost: 4, type: 'card', gate: { stance: 'back'  }, label: 'Benediction', desc: 'BACK signature — heal an ally 8.' },
  { id: 'elin.rider.warmth', hero: 'elin', tier: 2, cost: 6, type: 'rider', requires: ['elin.sig.mid'], label: 'Warm Light', desc: 'Mend (MID core) now also wards the ally for <span class="kw kw-guard">⛨ 2</span> — a heal that holds.', rider: { card: 'Mend', fx: { guard: 2 }, descAdd: ' · <span class="kw kw-guard">⛨ 2</span>' } },
  { id: 'elin.emergent.afterglow', hero: 'elin', tier: 3, cost: 9, type: 'emergent', requires: ['elin.sig.back'], label: 'Afterglow',
    desc: 'Elin’s light <b>lingers</b>. Every <b>2nd time she heals</b> this fight forges a free <b>Afterglow</b> — the warmth spreads to the whole party.',
    emergent: { on: 'heal', every: 2, stance: 'FORGED · LIGHT', flash: 'The light lingers — <b>Afterglow</b> forged.',
      forge: { name: 'Afterglow', cost: 0, target: 'allies', fx: { guard: 3 }, desc: '<b>Free.</b> The mending glow spills over — every ally gains <span class="kw kw-guard">⛨ 3</span>.' } } },

  // MIRA — the Assassin: exposure and slips
  { id: 'mira.sig.front', hero: 'mira', tier: 1, cost: 4, type: 'card', gate: { stance: 'front' }, label: 'Vanish Strike', desc: 'FRONT signature — 9 damage, then vanish to BACK.' },
  { id: 'mira.sig.mid',   hero: 'mira', tier: 1, cost: 5, type: 'card', gate: { stance: 'mid'   }, label: 'Twin Daggers',  desc: 'MID signature — 10 damage to ANY foe.' },
  { id: 'mira.sig.back',  hero: 'mira', tier: 1, cost: 4, type: 'card', gate: { stance: 'back'  }, label: 'Killing Mark',  desc: 'BACK signature — <span class="kw kw-exposed">◎ EXPOSED 5</span> on any foe.' },
  { id: 'mira.rider.exploit', hero: 'mira', tier: 2, cost: 6, type: 'rider', requires: ['mira.sig.front'], label: 'Killer’s Eye', desc: 'Backstab (FRONT core) now also inflicts <span class="kw kw-exposed">◎ EXPOSED 2</span>.', rider: { card: 'Backstab', fx: { mark: 2 }, descAdd: ' · <span class="kw kw-exposed">◎ EXPOSED 2</span>' } },
  { id: 'mira.emergent.bloodscent', hero: 'mira', tier: 3, cost: 9, type: 'emergent', requires: ['mira.sig.back'], label: 'Bloodscent',
    desc: 'Mira <b>smells the opening</b>. Every <b>2nd time she marks a foe</b> <span class="kw kw-exposed">◎ EXPOSED</span> this fight forges a free <b>Execute</b> — the mark becomes a killing card.',
    emergent: { on: 'expose', every: 2, stance: 'FORGED · BLOOD', flash: 'She smells blood — <b>Execute</b> forged.',
      forge: { name: 'Execute', cost: 0, target: 'enemy', fx: { dmg: 12 }, desc: '<b>Free.</b> The opening is hers — <b>12 damage</b> to any foe. An EXPOSED target has nowhere to hide.' } } },

  // CASSIA — the Warden: guard and retaliation
  { id: 'cassia.sig.front', hero: 'cassia', tier: 1, cost: 4, type: 'card', gate: { stance: 'front' }, label: 'Bulwark', desc: 'FRONT signature — 6 damage and gain <span class="kw kw-guard">⛨ 6</span>.' },
  { id: 'cassia.sig.mid',   hero: 'cassia', tier: 1, cost: 5, type: 'card', gate: { stance: 'mid'   }, label: 'Aegis',   desc: 'MID signature — ward an ally <span class="kw kw-guard">⛨ 7</span>.' },
  { id: 'cassia.sig.back',  hero: 'cassia', tier: 1, cost: 4, type: 'card', gate: { stance: 'back'  }, label: 'Sentinel Throw', desc: 'BACK signature — 7 damage to ANY foe.' },
  { id: 'cassia.rider.riposte', hero: 'cassia', tier: 2, cost: 6, type: 'rider', requires: ['cassia.sig.front'], label: 'Riposte', desc: 'Shield Bash (FRONT core) now also grants <span class="kw kw-counter">↺ 1</span> — punish the next blow.', rider: { card: 'Shield Bash', fx: { counter: 1 }, descAdd: ' · <span class="kw kw-counter">↺ 1</span>' } },
  { id: 'cassia.emergent.bulwark', hero: 'cassia', tier: 3, cost: 9, type: 'emergent', requires: ['cassia.sig.front'], label: 'Iron Answer',
    desc: 'Cassia turns <b>defense into a weapon</b>. Every <b>2nd time she raises guard</b> this fight forges a free <b>Bulwark Break</b> — the wall answers back.',
    emergent: { on: 'guard', every: 2, stance: 'FORGED · IRON', flash: 'The wall answers — <b>Bulwark Break</b> forged.',
      forge: { name: 'Bulwark Break', cost: 0, target: 'enemy', fx: { dmg: 9 }, desc: '<b>Free.</b> The shield becomes the blow — <b>9 damage</b> to any foe. Every wall she raises is a blade held back.' } } },

  // BRANWEN — the Marksman: marks and repositioning
  { id: 'branwen.sig.front', hero: 'branwen', tier: 1, cost: 4, type: 'card', gate: { stance: 'front' }, label: 'Hunter’s Mark', desc: 'FRONT signature — <span class="kw kw-exposed">◎ EXPOSED 4</span> and slip to BACK.' },
  { id: 'branwen.sig.mid',   hero: 'branwen', tier: 1, cost: 5, type: 'card', gate: { stance: 'mid'   }, label: 'Killshot',    desc: 'MID signature — 11 damage to ANY foe.' },
  { id: 'branwen.sig.back',  hero: 'branwen', tier: 1, cost: 4, type: 'card', gate: { stance: 'back'  }, label: 'Killing Arrow', desc: 'BACK signature — 9 damage and <span class="kw kw-exposed">◎ EXPOSED 2</span>.' },
  { id: 'branwen.rider.deadeye', hero: 'branwen', tier: 2, cost: 6, type: 'rider', requires: ['branwen.sig.back'], label: 'Deadeye', desc: 'Backstep Shot (FRONT core) now also inflicts <span class="kw kw-exposed">◎ EXPOSED 2</span>.', rider: { card: 'Backstep Shot', fx: { mark: 2 }, descAdd: ' · <span class="kw kw-exposed">◎ EXPOSED 2</span>' } },
  { id: 'branwen.emergent.tally', hero: 'branwen', tier: 3, cost: 9, type: 'emergent', requires: ['branwen.sig.back'], label: 'Death’s Tally',
    desc: 'Branwen <b>counts her marks</b>. Every <b>2nd time she inflicts</b> <span class="kw kw-exposed">◎ EXPOSED</span> this fight forges a free <b>Killing Arrow</b> — the tally comes due.',
    emergent: { on: 'expose', every: 2, stance: 'FORGED · TALLY', flash: 'The tally comes due — <b>Killing Arrow</b> forged.',
      forge: { name: 'Killing Arrow', cost: 0, target: 'enemy', fx: { dmg: 9, mark: 2 }, desc: '<b>Free.</b> The counted shot lands — <b>9 damage</b> and <span class="kw kw-exposed">◎ EXPOSED 2</span> to any foe.' } } },

  // ═══ DEEP TREES (Phase 2) — each hero grows a layered keyword identity across
  // four tiers: signatures → keyword riders & passives → emergent procs + an
  // all-out upgrade → an identity CAPSTONE.  All data-driven (rider / passive /
  // allout), read by the shared hooks above. ═══════════════════════════════════

  // ASH — TEMPO: momentum, repositioning, follow-ups
  { id: 'ash.rider.wave', hero: 'ash', tier: 2, cost: 6, type: 'rider', requires: ['ash.sig.front'], label: 'Crushing Wave', desc: 'Crashing Wave (FRONT signature) strikes for <b>+3</b> — the cleave lands heavier.', rider: { card: 'Crashing Wave', fx: { dmg: 3 }, descAdd: ' · <b>+3</b>' } },
  { id: 'ash.passive.flow', hero: 'ash', tier: 3, cost: 8, type: 'passive', requires: ['ash.passive.vanguard'], label: 'Flowing Momentum', desc: 'Whenever Ash changes rows, his next damaging card this turn deals <span class="kw kw-rally">▲ +3</span> — motion becomes force.', passive: 'ash_flow' },
  { id: 'ash.passive.relentless', hero: 'ash', tier: 4, cost: 12, type: 'passive', requires: ['ash.emergent.tempo'], label: 'Relentless', desc: 'The FIRST <span class="kw kw-rally">FOLLOW-UP</span> Ash lands each turn refunds <b>1 EP</b> — the duel never lets up.', passive: 'ash_relentless' },

  // ELIN — LIGHT: wards, overheal shields, party sustain
  { id: 'elin.passive.ward', hero: 'elin', tier: 2, cost: 6, type: 'passive', label: 'Warding Light', desc: 'At the start of your turn, your most wounded ally gains <span class="kw kw-guard">⛨ 2</span> — the light finds the hurt.', passive: 'elin_ward' },
  { id: 'elin.rider.radiance', hero: 'elin', tier: 3, cost: 7, type: 'rider', requires: ['elin.sig.front'], label: 'Radiance', desc: 'Radiant Ward (FRONT signature) now also heals every ally <span class="kw kw-heal">✚ 2</span>.', rider: { card: 'Radiant Ward', fx: { heal: 2 }, descAdd: ' · <span class="kw kw-heal">✚ 2</span> party' } },
  { id: 'elin.allout.dawn', hero: 'elin', tier: 3, cost: 9, type: 'allout', requires: ['elin.emergent.afterglow'], label: 'Dawnbreak', desc: 'ALL-OUT upgrade — when your all-out ends, the whole party heals <span class="kw kw-heal">✚ 5</span>.', allout: 'dawn' },
  { id: 'elin.passive.overflow', hero: 'elin', tier: 4, cost: 11, type: 'passive', requires: ['elin.rider.radiance'], label: 'Radiant Overflow', desc: 'When Elin’s heal overflows a target, the spilled <span class="kw kw-guard">⛨</span> shields the WHOLE party — not just them.', passive: 'elin_overflow' },

  // MIRA — EXPOSED: exploit marks, execute the wounded
  { id: 'mira.passive.opportunist', hero: 'mira', tier: 2, cost: 6, type: 'passive', requires: ['mira.sig.back'], label: 'Opportunist', desc: 'Mira deals <b>+3</b> to any <span class="kw kw-exposed">◎ EXPOSED</span> foe — she never wastes an opening.', passive: 'mira_opportunist' },
  { id: 'mira.rider.twin', hero: 'mira', tier: 3, cost: 7, type: 'rider', requires: ['mira.sig.mid'], label: 'Twinned Edge', desc: 'Twin Daggers (MID signature) now also inflicts <span class="kw kw-exposed">◎ EXPOSED 3</span>.', rider: { card: 'Twin Daggers', fx: { mark: 3 }, descAdd: ' · <span class="kw kw-exposed">◎ EXPOSED 3</span>' } },
  { id: 'mira.passive.deathmark', hero: 'mira', tier: 4, cost: 12, type: 'passive', requires: ['mira.emergent.bloodscent'], label: 'Death Mark', desc: 'When Mira strikes a foe at or below <b>30% HP</b>, she EXECUTES it outright — the wounded do not walk away.', passive: 'mira_execute' },

  // CASSIA — GUARD: retaliation, an immovable wall
  { id: 'cassia.passive.vigil', hero: 'cassia', tier: 2, cost: 6, type: 'passive', label: 'Standing Vigil', desc: 'At the start of your turn, Cassia braces for <span class="kw kw-guard">⛨ 2</span> — the wall is never caught flat.', passive: 'cassia_vigil' },
  { id: 'cassia.rider.aegis', hero: 'cassia', tier: 3, cost: 7, type: 'rider', requires: ['cassia.sig.mid'], label: 'Warded Aegis', desc: 'Aegis (MID signature) also grants the ally <span class="kw kw-counter">↺ 1</span> — the ward bites back.', rider: { card: 'Aegis', fx: { counter: 1 }, descAdd: ' · <span class="kw kw-counter">↺ 1</span>' } },
  { id: 'cassia.allout.fortress', hero: 'cassia', tier: 3, cost: 9, type: 'allout', requires: ['cassia.emergent.bulwark'], label: 'Fortress', desc: 'ALL-OUT upgrade — before Cassia’s all-out, the whole party gains <span class="kw kw-guard">⛨ 5</span>.', allout: 'fortress' },
  { id: 'cassia.passive.immovable', hero: 'cassia', tier: 4, cost: 12, type: 'passive', requires: ['cassia.rider.aegis'], label: 'Immovable', desc: 'Cassia’s <span class="kw kw-guard">⛨ guard</span> no longer fades at turn’s end — the wall only grows.', passive: 'cassia_immovable' },

  // BRANWEN — MARK: marks at range, the tally comes due
  { id: 'branwen.passive.focus', hero: 'branwen', tier: 2, cost: 6, type: 'passive', requires: ['branwen.sig.back'], label: 'Hunter’s Focus', desc: 'Branwen deals <b>+2</b> to any <span class="kw kw-exposed">◎ EXPOSED</span> foe.', passive: 'branwen_hunter' },
  { id: 'branwen.rider.volley', hero: 'branwen', tier: 3, cost: 7, type: 'rider', requires: ['branwen.sig.mid'], label: 'Volley', desc: 'Killshot (MID signature) now also inflicts <span class="kw kw-exposed">◎ EXPOSED 2</span>.', rider: { card: 'Killshot', fx: { mark: 2 }, descAdd: ' · <span class="kw kw-exposed">◎ EXPOSED 2</span>' } },
  { id: 'branwen.passive.opening', hero: 'branwen', tier: 3, cost: 8, type: 'passive', requires: ['branwen.passive.focus'], label: 'Opening Shot', desc: 'At the start of your turn, Branwen EXPOSES the nearest foe <span class="kw kw-exposed">◎ 1</span> — the hunt is always on.', passive: 'branwen_opening' },
  { id: 'branwen.passive.reckoning', hero: 'branwen', tier: 4, cost: 12, type: 'passive', requires: ['branwen.emergent.tally'], label: 'The Reckoning', desc: 'The first <span class="kw kw-exposed">◎ EXPOSED</span> foe Branwen kills each turn refunds <b>1 EP</b> — the tally always comes due.', passive: 'branwen_reckoning' },

  // ═══ TEAM SYNERGY (Phase 3) — each hero's identity now pays the WHOLE party.
  // These are the cross-hero combos: who you bring changes how everyone plays. ═══
  { id: 'ash.synergy.warcry', hero: 'ash', tier: 4, cost: 11, type: 'synergy', requires: ['ash.emergent.tempo'], label: 'Warcry', desc: 'When Ash lands a <span class="kw kw-rally">FOLLOW-UP</span>, the ally he followed gains <span class="kw kw-rally">▲ RALLY +2</span> — his momentum becomes theirs.', passive: 'ash_warcry' },
  { id: 'elin.synergy.blessing', hero: 'elin', tier: 4, cost: 11, type: 'synergy', requires: ['elin.passive.ward'], label: 'Blessed Edge', desc: 'When Elin heals or wards an ally, that ally’s next strike deals <span class="kw kw-rally">▲ +2</span> — her light sharpens their blade.', passive: 'elin_blessing' },
  { id: 'mira.synergy.marked', hero: 'mira', tier: 4, cost: 11, type: 'synergy', requires: ['mira.passive.opportunist'], label: 'Marked for Death', desc: 'While Mira stands with you, <span class="kw kw-exposed">◎ EXPOSED</span> foes take <b>+2</b> from EVERY ally — her openings are the whole party’s.', passive: 'mira_marked' },
  { id: 'cassia.synergy.soak', hero: 'cassia', tier: 4, cost: 11, type: 'synergy', requires: ['cassia.passive.vigil'], label: 'Guardian’s Aegis', desc: 'Allies in the rows BEHIND Cassia take <b>−2</b> from every enemy blow — she covers the line.', passive: 'cassia_soak' },
  { id: 'branwen.synergy.cadence', hero: 'branwen', tier: 4, cost: 11, type: 'synergy', requires: ['branwen.passive.opening'], label: 'Hunter’s Cadence', desc: 'At the start of your turn, if any foe is <span class="kw kw-exposed">◎ EXPOSED</span>, the WHOLE party gains <span class="kw kw-rally">▲ RALLY +1</span>.', passive: 'branwen_cadence' },
];
const NODE_BY_ID = {};
EMBER_TREE.forEach(n => { NODE_BY_ID[n.id] = n; });
// heroId -> stance -> gating nodeId (a hero's signature is hidden until unlocked)
const SIG_GATE = {};
EMBER_TREE.forEach(n => { if (n.type === 'card' && n.gate && n.gate.stance) { (SIG_GATE[n.hero] = SIG_GATE[n.hero] || {})[n.gate.stance] = n.id; } });
// is hero h's signature available in its current stance?  (ungated heroes: yes)
function sigUnlocked(h) { const g = SIG_GATE[h.id] && SIG_GATE[h.id][h.row]; return !g || hasNode(g); }
// unlocked rider effects attached to a given (owner, card)
function ridersFor(ownerId, cardName) {
  return EMBER_TREE.filter(n => n.type === 'rider' && n.hero === ownerId && n.rider && n.rider.card === cardName && hasNode(n.id));
}
// ember reward for felling a foe — higher HEAT pays out more (risk → reward)
function emberReward(e) {
  const base = (e.def.floorBoss || e.def.boss) ? 10 : (e._elite ? 4 : 2);
  return Math.round(base * (1 + (META.heat || 0) * 0.25));
}
// ALT ALL-OUT (Rite of Endings): each all-out strike finishes a foe under 25% HP
function allOutExecutes(e) {
  return hasNode('ash.allout.execution') && e && !e.dead && e.hp > 0 && e.hp <= Math.ceil(e.maxHp * 0.25);
}
// a hero has just entered a new row — fire any unlocked positional passives
function onHeroEnterRow(hero, toRow, fromRow) {
  if (!hero || hero.downed || toRow === fromRow) return;
  firePassives('enterRow', hero.id, { toRow, fromRow });
}
// EMERGENT LOOPS — a kindled tier-3 node installs a per-fight counter that watches
// a hero repeat their archetypal act (strike / expose / heal / raise guard); on the
// Nth repeat it FORGES a signature temp card into that hero's hand.  This is how a
// hero's kit "grows over the run" — the more they play to type, the more their
// story-cards appear.  Data-driven (node.emergent), so no bespoke code per hero.
function emergentNodes(heroId) {
  return EMBER_TREE.filter(n => n.type === 'emergent' && n.hero === heroId && n.emergent && hasNode(n.id));
}
function fireEmergent(heroId, event, card) {
  // don't chain off an all-out burst, and don't let a forged temp card re-forge
  if (!heroId || typeof S === 'undefined' || !S || S._burstResolving) return;
  if (card && card.temp) return;
  const hero = S.heroes.find(h => h.id === heroId);
  if (!hero || hero.downed) return;
  const nodes = emergentNodes(heroId);
  if (!nodes.length) return;
  // the tally accrues across the WHOLE descent (on RUN, not the fight) so trash
  // fights feed the payoff — the loop genuinely grows over the run.
  const tally = (RUN && (RUN.emCount = RUN.emCount || {})) || (S._emCount = S._emCount || {});
  nodes.forEach(n => {
    if (n.emergent.on !== event) return;
    const c = (tally[n.id] = (tally[n.id] || 0) + 1);
    if (c % n.emergent.every !== 0) return;
    const f = n.emergent.forge;
    genTempCard({ kind: 'temp', owner: heroId, ownerName: hero.def.name, tint: hero.def.tint,
      stance: n.emergent.stance || 'FORGED', name: f.name, cost: f.cost || 0, target: f.target || 'enemy',
      school: (f.fx && f.fx.dmg) ? hero.def.school : null, fx: Object.assign({}, f.fx), desc: f.desc });
    popupAt(figEl(heroId), '✦ ' + f.name, 'rally');
    if (n.emergent.flash) flashNarrator(n.emergent.flash);
  });
}

// PASSIVES (Phase 2) — standing rules a kindled node installs, fired by game
// hooks.  Fully data-driven: a passive node carries `passive: '<id>'`, and the
// engine looks up PASSIVE_DEFS[id] at each hook.  A def declares a `trigger`
// and an `apply(ctx)` (side-effect) or, for damage tuning, `trigger:'dmgMod'`
// with `mod(owner, tgt) -> number`.  No bespoke wiring per node.
const PASSIVE_DEFS = {
  // ASH — TEMPO: motion is force, the duel never lets up
  ash_vanguard: { trigger: 'enterRow', apply: (c) => { if (c.toRow === 'front') { c.hero.guard += 3; popupAt(figEl(c.hero.id), '⛨ +3', 'guard'); } } },
  ash_flow:     { trigger: 'enterRow', apply: (c) => { c.hero.buffDmg += 3; popupAt(figEl(c.hero.id), '▲ +3 NEXT', 'rally'); } },
  ash_relentless: { trigger: 'followup', apply: (c) => { if (!S._flags.ashRefund) { S._flags.ashRefund = true; refundEp(1); } } },
  // ELIN — LIGHT: the ward finds the hurt
  elin_ward:    { trigger: 'turnStart', apply: (c) => { if (c.hero.id !== 'elin') return; const t = lowestHpAlly(); if (t) { t.guard += 2; popupAt(figEl(t.id), '⛨ +2', 'guard'); } } },
  // MIRA — EXPOSED: never waste an opening; mark the dying
  mira_opportunist: { trigger: 'dmgMod', mod: (owner, tgt) => (tgt && tgt.mark ? 3 : 0) },
  mira_execute: { trigger: 'postHit', apply: (c) => { const t = c.tgt; if (t && !t.dead && t.hp > 0 && t.hp <= Math.ceil(t.maxHp * 0.30)) { popupAt(figEl(t.uid), '☠ DEATH MARK', 'dmg'); dealToEnemy(t, t.hp, c.hero.def.school, c.hero.id); } } },
  // CASSIA — GUARD: the wall is never caught flat, and only grows
  cassia_vigil: { trigger: 'turnStart', apply: (c) => { if (c.hero.id !== 'cassia') return; c.hero.guard += 2; popupAt(figEl(c.hero.id), '⛨ +2', 'guard'); } },
  cassia_immovable: { trigger: 'keepGuard' },   // read by endTurn's guard-reset
  // BRANWEN — MARK: the hunt is always on, the tally comes due
  branwen_hunter: { trigger: 'dmgMod', mod: (owner, tgt) => (tgt && tgt.mark ? 2 : 0) },
  branwen_opening: { trigger: 'turnStart', apply: (c) => { if (c.hero.id !== 'branwen') return; const e = frontmostEnemy(); if (e) { e.mark = (e.mark || 0) + 1; popupAt(figEl(e.uid), '◎ +1', 'info'); } } },
  branwen_reckoning: { trigger: 'kill', apply: (c) => { if (c.tgt && c.tgt.mark && !S._flags.brRefund) { S._flags.brRefund = true; refundEp(1); } } },
  // ── TEAM SYNERGY (Phase 3) — a hero's kit pays off for the whole party ──
  ash_warcry:      { trigger: 'followup', apply: (c) => { const a = c.ally && S.heroes.find(h => h.id === c.ally); if (a && !a.downed) { a.buffDmg += 2; popupAt(figEl(a.id), '▲ RALLY +2', 'rally'); } } },
  elin_blessing:   { trigger: 'support', apply: (c) => { const r = c.receiver; if (r && !r.downed && r.id !== c.hero.id) { r.buffDmg += 2; popupAt(figEl(r.id), '▲ BLESSED +2', 'rally'); } } },
  mira_marked:     { trigger: 'partyDmgMod', mod: (owner, tgt) => (tgt && tgt.mark ? 2 : 0) },
  cassia_soak:     { trigger: 'mitigate' },   // read by the enemy-damage step (soakMitigation)
  branwen_cadence: { trigger: 'turnStart', apply: (c) => { if (c.hero.id !== 'branwen') return; if (!livingEnemies().some(e => e.mark)) return; livingHeroes().forEach(h => { h.buffDmg += 1; popupAt(figEl(h.id), '▲ +1', 'rally'); }); } },
};
function refundEp(n) {
  S.ep = Math.min(S.maxEp + 2, S.ep + n);
  pulseEp(); SFX.move();
  popupAt($('#ep-dial'), '+' + n + ' EP', 'rally');
}
function lowestHpAlly() {
  const live = livingHeroes(); if (!live.length) return null;
  return live.slice().sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
}
// a node whose effect is a PASSIVE_DEFS rule — passives + team-synergy nodes
function isPassiveNode(n) { return (n.type === 'passive' || n.type === 'synergy') && n.passive; }
// unlocked passive/synergy nodes for a hero matching a trigger
function passiveNodesFor(heroId, trigger) {
  return EMBER_TREE.filter(n => isPassiveNode(n) && n.hero === heroId
    && hasNode(n.id) && PASSIVE_DEFS[n.passive] && PASSIVE_DEFS[n.passive].trigger === trigger);
}
// fire all of a hero's owned side-effect passives for a trigger
function firePassives(trigger, heroId, ctx) {
  if (!heroId || typeof S === 'undefined' || !S) return;
  const hero = S.heroes.find(h => h.id === heroId);
  if (!hero || hero.downed) return;
  S._flags = S._flags || {};
  const c = Object.assign({ hero, heroId }, ctx || {});
  passiveNodesFor(heroId, trigger).forEach(n => {
    try { PASSIVE_DEFS[n.passive].apply(c); } catch (_) {}
  });
  // BOONS with the same trigger, gated to this hero
  runBoons().forEach(b => { if (b.hero === heroId && b.trigger === trigger && b.apply) { try { b.apply(c); } catch (_) {} } });
}
// sum of damage-tuning passives against a target: the ATTACKER's own
// dmgMod exploiters, PLUS any living ally's party-wide synergy (partyDmgMod).
function passiveDmg(owner, tgt) {
  if (!owner) return 0;
  let bonus = 0;
  EMBER_TREE.forEach(n => {
    if (isPassiveNode(n) && n.hero === owner.id && hasNode(n.id)) {
      const d = PASSIVE_DEFS[n.passive];
      if (d && d.trigger === 'dmgMod' && d.mod) bonus += d.mod(owner, tgt) || 0;
    }
  });
  // team synergy: a nodeholder anywhere in the LIVING party lifts everyone's hits
  livingHeroes().forEach(ph => {
    EMBER_TREE.forEach(n => {
      if (isPassiveNode(n) && n.hero === ph.id && hasNode(n.id)) {
        const d = PASSIVE_DEFS[n.passive];
        if (d && d.trigger === 'partyDmgMod' && d.mod) bonus += d.mod(owner, tgt) || 0;
      }
    });
  });
  // BOON damage tuners (each gates itself by owner inside .mod)
  runBoons().forEach(b => { if (b.trigger === 'dmgMod' && b.mod) bonus += b.mod(owner, tgt) || 0; });
  return bonus;
}
// team mitigation: Cassia's Guardian's Aegis soaks for allies in rows behind her
function soakMitigation(h) {
  if (!h || !hasNode('cassia.synergy.soak')) return 0;
  const cassia = livingHeroes().find(x => x.id === 'cassia');
  if (!cassia || cassia.id === h.id) return 0;
  return (ROWS.indexOf(h.row) > ROWS.indexOf(cassia.row)) ? 2 : 0;
}
// does this hero keep their guard through the enemy turn? (Cassia's Immovable)
function keepsGuard(heroId) {
  return passiveNodesFor(heroId, 'keepGuard').length > 0;
}

// ---------------------------------------------------------------------------
// BOONS (the roguelite's mid-run randomness engine) — companion "gifts" you
// DRAFT 1-of-3 at elites, events, and the fire.  Each is tied to a hero and is
// only OFFERED / ACTIVE while that hero is in your party, so WHO you bring
// shapes the boon pool: party-as-draft and relic-as-draft reinforce each other.
// Boons reuse the same effect engine as passives/forges — a `card(c)` build-time
// mod and/or a hook `{ trigger, apply }` / `{ trigger:'dmgMod', mod }` — so there
// is no bespoke wiring per boon.  Stored on RUN.boons (per-descent, wiped on death).
// ---------------------------------------------------------------------------
const BOONS = [
  // ASH — tempo
  { id: 'ash_duelist', hero: 'ash', name: 'Duelist’s Focus', icon: '⚔', desc: 'Ash’s <b>signature</b> attacks strike for <b>+3</b>.',
    card: (c) => { if (c.owner === 'ash' && c.kind === 'sig' && c.fx && c.fx.dmg) c.fx.dmg += 3; } },
  { id: 'ash_tide', hero: 'ash', name: 'Rushing Tide', icon: '⇄', desc: 'Ash’s damaging cards cost <b>1 less</b> (min 1).',
    card: (c) => { if (c.owner === 'ash' && c.fx && c.fx.dmg && c.cost > 1) c.cost -= 1; } },
  { id: 'ash_relentless', hero: 'ash', name: 'Second Wind', icon: '↻', desc: 'Ash’s first <span class="kw kw-rally">FOLLOW-UP</span> each turn refunds <b>1 EP</b>.',
    trigger: 'followup', apply: () => { if (!S._flags.boonAsh) { S._flags.boonAsh = true; refundEp(1); boonProc('ash', 'ash_relentless'); } } },
  // ELIN — light
  { id: 'elin_grace', hero: 'elin', name: 'Elin’s Grace', icon: '✚', desc: 'When Elin heals or wards an ally, they also gain <span class="kw kw-guard">⛨ 1</span>.',
    trigger: 'support', apply: (c) => { if (c.receiver && !c.receiver.downed) { c.receiver.guard += 1; popupAt(figEl(c.receiver.id), '⛨ +1', 'guard'); boonProc('elin', 'elin_grace'); } } },
  { id: 'elin_warm', hero: 'elin', name: 'Warm Hands', icon: '❂', desc: 'Elin’s healing cards restore <b>+2</b>.',
    card: (c) => { if (c.owner === 'elin' && c.fx && c.fx.heal) c.fx.heal += 2; } },
  { id: 'elin_dawn', hero: 'elin', name: 'Dawnward', icon: '☀', desc: 'At the start of your turn, your most-wounded ally heals <span class="kw kw-heal">✚ 2</span>.',
    trigger: 'turnStart', apply: (c) => { if (c.hero.id !== 'elin') return; const t = lowestHpAlly(); if (t && t.hp < t.maxHp) { t.hp = Math.min(t.maxHp, t.hp + 2); popupAt(figEl(t.id), '✚2', 'heal'); boonProc('elin', 'elin_dawn'); } } },
  // MIRA — exposed / execute
  { id: 'mira_scent', hero: 'mira', name: 'Bloodscent', icon: '◎', desc: 'Mira deals <b>+2</b> to any <span class="kw kw-exposed">◎ EXPOSED</span> foe.',
    trigger: 'dmgMod', mod: (o, t) => (o.id === 'mira' && t && t.mark ? 2 : 0) },
  { id: 'mira_patience', hero: 'mira', name: 'Killer’s Patience', icon: '☠', desc: 'The first <span class="kw kw-exposed">◎ EXPOSED</span> foe Mira kills each turn refunds <b>1 EP</b>.',
    trigger: 'kill', apply: (c) => { if (c.tgt && c.tgt.mark && !S._flags.boonMira) { S._flags.boonMira = true; refundEp(1); boonProc('mira', 'mira_patience'); } } },
  { id: 'mira_fang', hero: 'mira', name: 'Twin Fang', icon: '⚔', desc: 'Mira’s <b>signature</b> attacks strike for <b>+2</b>.',
    card: (c) => { if (c.owner === 'mira' && c.kind === 'sig' && c.fx && c.fx.dmg) c.fx.dmg += 2; } },
  // CASSIA — guard
  { id: 'cassia_vigil', hero: 'cassia', name: 'Bulwark Heart', icon: '⛨', desc: 'At the start of your turn, Cassia braces for <span class="kw kw-guard">⛨ 2</span>.',
    trigger: 'turnStart', apply: (c) => { if (c.hero.id !== 'cassia') return; c.hero.guard += 2; popupAt(figEl(c.hero.id), '⛨ +2', 'guard'); boonProc('cassia', 'cassia_vigil', { quiet: true }); } },
  { id: 'cassia_iron', hero: 'cassia', name: 'Ironclad', icon: '◆', desc: 'Cassia’s guard-granting cards give <span class="kw kw-guard">⛨ +2</span>.',
    card: (c) => { if (c.owner === 'cassia' && c.fx && c.fx.guard) c.fx.guard += 2; } },
  { id: 'cassia_reprisal', hero: 'cassia', name: 'Reprisal', icon: '↺', desc: 'While Cassia holds <span class="kw kw-guard">⛨ guard</span>, her strikes deal <b>+3</b>.',
    trigger: 'dmgMod', mod: (o) => (o.id === 'cassia' && o.guard > 0 ? 3 : 0) },
  // BRANWEN — mark
  { id: 'branwen_deadeye', hero: 'branwen', name: 'Deadeye', icon: '◎', desc: 'Branwen’s marks land <b>+1</b> deeper <span class="kw kw-exposed">◎ EXPOSED</span>.',
    card: (c) => { if (c.owner === 'branwen' && c.fx && c.fx.mark) c.fx.mark += 1; } },
  { id: 'branwen_season', hero: 'branwen', name: 'Open Season', icon: '✦', desc: 'While Branwen stands with you, EVERY ally deals <b>+1</b> to <span class="kw kw-exposed">◎ EXPOSED</span> foes.',
    trigger: 'dmgMod', mod: (o, t) => (t && t.mark ? 1 : 0) },
  { id: 'branwen_bounty', hero: 'branwen', name: 'Hunter’s Bounty', icon: '☠', desc: 'The first <span class="kw kw-exposed">◎ EXPOSED</span> foe Branwen kills each turn refunds <b>1 EP</b>.',
    trigger: 'kill', apply: (c) => { if (c.tgt && c.tgt.mark && !S._flags.boonBran) { S._flags.boonBran = true; refundEp(1); boonProc('branwen', 'branwen_bounty'); } } },
];
const BOON_BY_ID = {}; BOONS.forEach(b => { BOON_BY_ID[b.id] = b; });
// active boons: OWNED this descent AND their hero is currently fielded
function runBoons() {
  if (typeof RUN === 'undefined' || !RUN || !Array.isArray(RUN.boons)) return [];
  const party = (RUN.active && RUN.active.length) ? RUN.active : RUN.roster || [];
  return RUN.boons.map(id => BOON_BY_ID[id]).filter(b => b && party.indexOf(b.hero) >= 0);
}
// held boons as a compact icon strip in the combat topbar
function renderCombatBoons() {
  const el = document.getElementById('combat-boons'); if (!el) return;
  const boons = runBoons();
  el.innerHTML = boons.map(b => `<span class="cb-boon" data-boon="${b.id}" style="--tint:${HEROES[b.hero].tint}" title="${HEROES[b.hero].name}’s ${b.name} — ${b.desc.replace(/<[^>]+>/g, '')}">${b.icon}</span>`).join('');
  el.classList.toggle('hidden', !boons.length);
}
// FEEDBACK when a boon fires — a chip pulse in the topbar, and (for discrete
// procs) a labelled pop over the hero, so gifts are FELT the moment they trigger.
function boonProc(heroId, boonId, opts) {
  const b = BOON_BY_ID[boonId]; if (!b) return;
  if (!(opts && opts.quiet)) { try { popupAt(figEl(heroId), '✦ ' + b.name.toUpperCase(), 'boon'); } catch (_) {} }
  const el = document.getElementById('combat-boons');
  const chip = el && el.querySelector(`[data-boon="${boonId}"]`);
  if (chip) { chip.classList.remove('cb-proc'); void chip.offsetWidth; chip.classList.add('cb-proc'); }
}

// IN-RUN FORGING — the temporary (per-descent) ember sink.  At a campfire you
// spend embers to TEMPER the whole kit for the rest of the run; the tempers
// reset next descent.  Each is applied to every card at build time (mkCard).
const FORGE_OFFERS = [
  { id: 'whetstone', cost: 5, label: 'WHETSTONE', desc: 'Every attack strikes for +1 for the rest of this descent.', apply: (c) => { if (c.fx && c.fx.dmg) c.fx.dmg += 1; } },
  { id: 'quicken',   cost: 6, label: 'QUICKENING', desc: 'Your signature cards cost 1 less for the rest of this descent.', apply: (c) => { if (c.kind === 'sig' && c.cost > 0) c.cost -= 1; } },
  { id: 'hexedge',   cost: 6, label: 'HEXED EDGE', desc: 'Your CORE attacks also inflict ◎ EXPOSED 1 for the rest of this descent.', apply: (c) => { if (c.kind === 'core' && c.fx && c.fx.dmg) c.fx.mark = (c.fx.mark || 0) + 1; } },
];
const FORGE_BY_ID = {};
FORGE_OFFERS.forEach(f => { FORGE_BY_ID[f.id] = f; });
function runForges() { return (typeof RUN !== 'undefined' && RUN && Array.isArray(RUN.forges)) ? RUN.forges : []; }

// ---------------------------------------------------------------------------
// SFX — tiny synthesized cues (no assets).  Volumes stay low; every cue is a
// short envelope so rapid plays never smear.  Context wakes on first gesture.
// ---------------------------------------------------------------------------
const SFX = (() => {
  let ctx = null;
  const ac = () => {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) {} }
    return ctx;
  };
  document.addEventListener('pointerdown', () => { const c = ac(); if (c && c.state === 'suspended') c.resume(); try { ensureHaptic(); } catch (_) {} }, { capture: true });
  function tone(freq, dur, type, vol, delay, slideTo) {
    if (!SETTINGS.sound) return;
    const c = ac(); if (!c || c.state !== 'running') return;
    const t0 = c.currentTime + (delay || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.06, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(c.destination);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  return {
    card:    () => tone(620, 0.07, 'triangle', 0.045),
    move:    () => tone(360, 0.06, 'triangle', 0.04),
    hit:     (big) => { tone(big ? 95 : 130, big ? 0.2 : 0.12, 'square', big ? 0.075 : 0.055, 0, big ? 55 : 90); },
    kill:    () => { tone(180, 0.3, 'sawtooth', 0.06, 0, 55); tone(90, 0.35, 'square', 0.05, 0.05, 40); },
    heal:    () => { tone(520, 0.14, 'sine', 0.05); tone(780, 0.18, 'sine', 0.035, 0.06); },
    guard:   () => tone(290, 0.09, 'triangle', 0.055),
    thread:  () => { tone(440, 0.35, 'sine', 0.05); tone(660, 0.4, 'sine', 0.04, 0.09); },
    // KINDLE — a rising ember-catch: struck spark, swelling chord, bright bloom
    kindle:  () => { tone(180, 0.1, 'square', 0.05, 0, 90); [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, 0.5, 'triangle', 0.05, 0.12 + i * 0.075)); tone(1568, 0.6, 'sine', 0.035, 0.5); },
    triad:   () => { [440, 554, 659, 880].forEach((f, i) => tone(f, 0.7, 'sine', 0.05, i * 0.09)); },
    victory: () => { [523, 659, 784].forEach((f, i) => tone(f, 0.25, 'triangle', 0.05, i * 0.11)); },
    enemy:   () => tone(220, 0.09, 'square', 0.04, 0, 180),
    follow:  () => { tone(500, 0.07, 'triangle', 0.05); tone(750, 0.1, 'triangle', 0.05, 0.06); },
    deny:    () => { tone(150, 0.08, 'square', 0.05, 0, 110); tone(120, 0.1, 'square', 0.045, 0.06, 90); },
    // parry gesture feedback — pitch RAMPS with the combo streak (rhythm feel)
    parry:   (perfect, streak) => { const b = 620 + Math.min(8, streak || 0) * 55; tone(b, 0.06, 'triangle', 0.06); if (perfect) tone(b * 1.5, 0.12, 'sine', 0.05, 0.03); },
    parryMiss: () => tone(140, 0.12, 'sawtooth', 0.05, 0, 90),
    swoosh:  () => { tone(300, 0.14, 'sine', 0.04, 0, 900); },
    brace:   () => tone(160, 0.16, 'square', 0.05),
    hitstop: () => tone(70, 0.05, 'square', 0.05),
  };
})();

// HAPTICS — physical feedback for gestures on devices that support it (mobile).
// Distinct pulse patterns per event so a tap, a hold, a swipe and a perfect all
// FEEL different in the hand.  No-op on desktop.
const HAP = {
  tap:      [10],
  perfect:  [10, 22, 14],
  good:     [12],
  miss:     [34],
  press:    [16],
  swipe:    [8, 16, 8],
  play:     [7],
  struck:   [26],
  burst:    [16, 30, 16, 30, 24],
};
// iOS Safari has NO Vibration API — the only web haptic there is the switch
// trick: programmatically toggling a hidden <input switch> fires a system tap
// (iOS 17.4+).  Use navigator.vibrate where it exists (Android) and fall back
// to the switch elsewhere so presses/taps are FELT on iPhone too.
let _hapLabel = null, _hapInput = null;
function ensureHaptic() {
  if (_hapLabel || typeof document === 'undefined' || !document.body) return;
  const l = document.createElement('label');
  l.setAttribute('aria-hidden', 'true');
  // rendered (not display:none) but out of the way — hidden elements don't tap.
  l.style.cssText = 'position:fixed;bottom:2px;right:2px;width:6px;height:6px;opacity:0.001;pointer-events:none;z-index:-1;';
  const i = document.createElement('input');
  i.type = 'checkbox'; i.setAttribute('switch', ''); i.tabIndex = -1;
  l.appendChild(i); document.body.appendChild(l);
  _hapLabel = l; _hapInput = i;
}
function haptic(p) {
  if (!SETTINGS.haptics) return;
  let vibrated = false;
  try { if (navigator.vibrate) vibrated = navigator.vibrate(p); } catch (_) {}
  // iOS fallback: click the LABEL (this toggles the switch and fires a system
  // tap on iOS 17.4+).  Do NOT pre-toggle checked — the click does the toggle.
  if (!vibrated) { try { ensureHaptic(); if (_hapLabel) _hapLabel.click(); } catch (_) {} }
}

// ---------------------------------------------------------------------------
// DATA — heroes.
// ---------------------------------------------------------------------------
const ROWS = ['front', 'mid', 'back'];
// Schools — every hero's attacks carry their element; every enemy hides a
// weakness (revealed the first time it takes damage).  Weakness hit ->
// WEAKENED ⌖; second weakness hit the SAME TURN -> STAGGERED ⚡ (+1 EP,
// once per turn); the next hit on a staggered enemy deals ×2.  A staggered
// enemy whose turn comes up on a HEAVY intent is INTERRUPTED.
const SCHOOL_GLYPH = { blade: '⚔', light: '✦', song: '♫', iron: '◆', frost: '❅' };
const ROW_LABEL = { front: 'FRONT', mid: 'MID', back: 'BACK' };
const STANCE = {
  front: { name: 'Blade Stance', tag: 'AGGRESSIVE' },
  mid:   { name: 'Flow Stance',  tag: 'BALANCED' },
  back:  { name: 'Wind Stance',  tag: 'RANGED' },
};

const HEROES = {
  ash: {
    school: 'blade', tempo: 'steady', name: 'ASH', cls: 'Ronin', archetype: 'Skirmisher', identity: 'Strikes and slips — repositions as he attacks.', tint: 'var(--ash-tint)', maxHp: 32,
    cards: {
      front: {
        core: { name: 'Cleave',        cost: 1, target: 'frontmost', fx: { dmg: 6 },            desc: '6 damage to the nearest enemy.' },
        sig:  { name: 'Crashing Wave', cost: 2, target: 'frontmost', fx: { dmg: 11 },           desc: '11 damage to the nearest enemy.' },
      },
      mid: {
        core: { name: 'Flowing Cut',   cost: 1, target: 'frontmost', fx: { dmg: 4, guard: 3 },  desc: '4 damage · gain 3 guard.' },
        sig:  { name: 'Crossguard',    cost: 2, target: 'ally',      fx: { guard: 6 }, desc: 'Guard an ally: <span class="kw kw-guard">⛨ 6</span>.' },
      },
      back: {
        core: { name: 'Thrown Edge',   cost: 1, target: 'enemy',     fx: { dmg: 4, step: 'front' }, desc: '4 damage to ANY enemy, then close to FRONT.' },
        sig:  { name: 'Marked Fate',   cost: 1, target: 'enemy',     fx: { dmg: 3, mark: 4 },   desc: '3 damage · <span class="kw kw-exposed">◎ EXPOSED 4</span>: +4 from EVERY hit. Fades by 1 each turn.' },
      },
    },
  },
  elin: {
    school: 'light', tempo: 'steady', name: 'ELIN', cls: 'Cleric', archetype: 'Mender', identity: 'Keeps the line standing — wards and heals.', tint: 'var(--elin-tint)', maxHp: 24,
    cards: {
      front: {
        core: { name: 'Smite',         cost: 1, target: 'frontmost', fx: { dmg: 4 },            desc: '4 holy damage to the nearest enemy.' },
        sig:  { name: 'Radiant Ward',  cost: 2, target: 'allies',    fx: { guard: 3 },          desc: 'Every ally gains 3 guard.' },
      },
      mid: {
        core: { name: 'Mend',          cost: 1, target: 'ally',      fx: { heal: 5 },           desc: 'Heal an ally 5.' },
        sig:  { name: 'Sanctuary',     cost: 2, target: 'ally',      fx: { heal: 4, guard: 4 }, desc: 'Heal an ally 4 · they gain 4 guard.' },
      },
      back: {
        core: { name: 'Distant Prayer',cost: 1, target: 'allies',    fx: { heal: 2 },           desc: 'Heal every ally 2.' },
        sig:  { name: 'Benediction',   cost: 2, target: 'ally',      fx: { heal: 8 },           desc: 'Heal an ally 8.' },
      },
    },
  },
  kiki: {
    school: 'song', tempo: 'swift', name: 'KIKI', cls: 'Bard', archetype: 'Herald', identity: 'Rallies allies and chills foes — cheap, swift.', tint: 'var(--kiki-tint)', maxHp: 20,
    cards: {
      front: {
        core: { name: 'Sharp Note',    cost: 1, target: 'frontmost', fx: { dmg: 3, lull: 1 },   desc: '3 damage · <span class="kw kw-chill">❄ CHILL</span> −1 next attack.' },
        sig:  { name: 'Discord',       cost: 2, target: 'enemy',     fx: { dmg: 5, lull: 2 },   desc: '5 damage to ANY enemy · <span class="kw kw-chill">❄ CHILL</span> −2.' },
      },
      mid: {
        core: { name: 'Inspire',       cost: 1, target: 'ally',      fx: { buffDmg: 4 },        desc: '<span class="kw kw-rally">▲ RALLY</span>: an ally’s next damaging card deals +4.' },
        sig:  { name: 'Battle Hymn',   cost: 2, target: 'allies',    fx: { buffDmg: 2 },        desc: '<span class="kw kw-rally">▲ RALLY</span>: every ally’s next damaging card deals +2.' },
      },
      back: {
        core: { name: 'Lullaby',       cost: 1, target: 'enemy',     fx: { lull: 2 },           desc: '<span class="kw kw-chill">❄ CHILL</span>: an enemy deals −2 on its next attack.' },
        sig:  { name: 'Crescendo',     cost: 2, target: 'ally',      fx: { buffDmg: 5 },        desc: '<span class="kw kw-rally">▲ RALLY</span>: an ally’s next damaging card deals +5.' },
      },
    },
  },
  cassia: {
    // HEAVY: one card per stance — expensive, high-impact, slow.  Her whole
    // turn is a single deliberate play (the guardian anchor).  MID card is
    // ally-target so she can still weave threads from her natural position.
    tempo: 'heavy', school: 'iron', name: 'CASSIA', cls: 'Guardian', archetype: 'Warden', identity: 'An immovable wall — guards the whole party.', tint: 'var(--cassia-tint)', maxHp: 34,
    cards: {
      front: {
        core: { name: 'Shield Bash', cost: 1, target: 'frontmost', fx: { dmg: 4, guard: 2 }, desc: '4 damage · 2 guard.' },
        sig:  { name: 'Bulwark',     cost: 2, target: 'frontmost', fx: { dmg: 6, guard: 6 }, desc: '6 damage · gain 6 guard — an immovable wall.' },
      },
      mid: {
        core: { name: 'Cover', cost: 1, target: 'ally', fx: { guard: 4 }, desc: 'An ally gains 4 guard.' },
        sig:  { name: 'Aegis', cost: 2, target: 'ally', fx: { guard: 7 }, desc: 'Guard an ally: <span class="kw kw-guard">⛨ 7</span>.' },
      },
      back: {
        core: { name: 'Thrown Shield',  cost: 1, target: 'enemy', fx: { dmg: 4 }, desc: '4 damage to ANY enemy.' },
        sig:  { name: 'Sentinel Throw', cost: 2, target: 'enemy', fx: { dmg: 7 }, desc: '7 damage to ANY enemy.' },
      },
    },
  },
  hask: {
    school: 'frost', tempo: 'steady', name: 'HASK', cls: 'Mage', archetype: 'Frostcaller', identity: 'Frost from range — sets up the shatter.', tint: 'var(--hask-tint)', maxHp: 22,
    cards: {
      front: {
        core: { name: 'Frost Touch',   cost: 1, target: 'frontmost', fx: { dmg: 4, lull: 1 },   desc: '4 frost damage · <span class="kw kw-chill">❄ CHILL</span> −1.' },
        sig:  { name: 'Shatter',       cost: 2, target: 'frontmost', fx: { dmg: 9 },            desc: '9 frost damage to the nearest enemy.' },
      },
      mid: {
        core: { name: 'Ice Bolt',      cost: 1, target: 'enemy',     fx: { dmg: 4 },            desc: '4 frost damage to ANY enemy.' },
        sig:  { name: 'Frost Ward',    cost: 2, target: 'ally',      fx: { guard: 5 }, desc: 'Guard an ally: <span class="kw kw-guard">⛨ 5</span>.' },
      },
      back: {
        core: { name: 'Deep Freeze',   cost: 1, target: 'enemy',     fx: { dmg: 5 },            desc: '5 frost damage to ANY enemy.' },
        sig:  { name: 'Hasten',        cost: 2, target: 'ally',      fx: { buffDmg: 6 },        desc: '<span class="kw kw-rally">▲ RALLY</span>: an ally’s next damaging card deals +6.' },
      },
    },
  },
  mira: {
    school: 'blade', tempo: 'swift', name: 'MIRA', cls: 'Reaver', archetype: 'Assassin',
    identity: 'A shadow that strikes and vanishes — marks prey, slips away.', tint: 'var(--mira-tint)', maxHp: 21,
    cards: {
      front: {
        core: { name: 'Backstab',      cost: 1, target: 'frontmost', fx: { dmg: 6, step: 'back' }, desc: '6 damage · slip to BACK.' },
        sig:  { name: 'Vanish Strike', cost: 2, target: 'frontmost', fx: { dmg: 9, warp: 'back' }, desc: '9 damage · vanish to the BACK line.' },
      },
      mid: {
        core: { name: 'Shadow Knife',  cost: 1, target: 'enemy', fx: { dmg: 4, mark: 3 }, desc: '4 damage · <span class="kw kw-exposed">◎ EXPOSED 3</span>.' },
        sig:  { name: 'Twin Daggers',  cost: 2, target: 'enemy', fx: { dmg: 10 }, desc: '10 damage to ANY enemy — a focused kill.' },
      },
      back: {
        core: { name: 'Thrown Dagger', cost: 1, target: 'enemy', fx: { dmg: 4, step: 'front' }, desc: '4 damage to ANY enemy · close to FRONT.' },
        sig:  { name: 'Killing Mark',  cost: 2, target: 'enemy', fx: { dmg: 3, mark: 5 }, desc: '3 damage · <span class="kw kw-exposed">◎ EXPOSED 5</span>: +5 from every hit. Fades 1/turn.' },
      },
    },
  },
  branwen: {
    // RANGED marksman: every shot reaches ANY enemy (ignores rows), so she
    // hunts from the back line and hates being shoved to the front — her
    // front-stance cards fire and RETREAT.  She marks prey for the party to
    // cash.  The mirror of Ash: he advances into the cut, she falls back to it.
    school: 'blade', tempo: 'swift', name: 'BRANWEN', cls: 'Ranger', archetype: 'Marksman',
    identity: 'Looses from the back line — marks prey from range, never in reach.', tint: 'var(--branwen-tint)', maxHp: 20,
    cards: {
      front: {
        core: { name: 'Backstep Shot', cost: 1, target: 'enemy', fx: { dmg: 5, step: 'back' }, desc: '5 damage to ANY enemy · loose and fall back to BACK.' },
        sig:  { name: 'Hunter’s Mark', cost: 2, target: 'enemy', fx: { dmg: 3, mark: 4, step: 'back' }, desc: '3 damage · <span class="kw kw-exposed">◎ EXPOSED 4</span> · slip to BACK.' },
      },
      mid: {
        core: { name: 'Aimed Shot',    cost: 1, target: 'enemy', fx: { dmg: 6 }, desc: '6 damage to ANY enemy.' },
        sig:  { name: 'Killshot',      cost: 2, target: 'enemy', fx: { dmg: 11 }, desc: '11 damage to ANY enemy — a clean execution.' },
      },
      back: {
        core: { name: 'Marking Arrow', cost: 1, target: 'enemy', fx: { dmg: 4, mark: 3 }, desc: '4 damage · <span class="kw kw-exposed">◎ EXPOSED 3</span>.' },
        sig:  { name: 'Killing Arrow', cost: 2, target: 'enemy', fx: { dmg: 9, mark: 2 }, desc: '9 damage · <span class="kw kw-exposed">◎ EXPOSED 2</span> — pins the prey.' },
      },
    },
  },
};

// ---------------------------------------------------------------------------
// DATA — enemies.  Intents telegraph damage + the PARTY ROW they strike.
// def.art overrides the portrait key (the remembered Echo Knight reuses art).
// ---------------------------------------------------------------------------
const ENEMY_DEFS = {
  husk: {
    // 18 HP: survives Cleave+Crashing Wave (17) so the FIRST fight forces one
    // real decision — eat the telegraphed hit, or learn to change stance.
    weak: 'light', name: 'HOLLOW HUSK', maxHp: 18,
    intents: [
      { name: 'Claw',  dmg: 4, row: 'front' },
      { name: 'Lurch', dmg: 3, row: 'mid' },
      { name: 'Wither', kind: 'buff', desc: 'hardens', guardSelf: 3 },
    ],
  },
  wraith: {
    weak: 'blade', name: 'PALE WRAITH', maxHp: 16,
    intents: [
      { name: 'Grasp Beyond', dmg: 5, row: 'back' },
      { name: 'Chill Wail',   dmg: 2, row: 'all', chill: 1 },
      { name: 'Drift',        dmg: 4, row: 'mid' },
    ],
  },
  cultist: {
    weak: 'blade', name: 'ASH CULTIST', maxHp: 15,
    intents: [
      { name: 'Sacrificial Knife', dmg: 5, row: 'front' },
      { name: 'Blood Chant', kind: 'buff', desc: 'gathers power', powerSelf: 2 },
      { name: 'Hollow Verse', dmg: 4, row: 'mid', expose: 2 },
    ],
  },
  mourner: {
    weak: 'iron', name: 'GRAVE MOURNER', maxHp: 18,
    intents: [
      { name: 'Dirge',     dmg: 3, row: 'all' },
      { name: 'Sorrowing', dmg: 5, row: 'mid' },
      { name: 'Keening', kind: 'buff', desc: 'keens the horde onward', powerAll: 1 },
    ],
  },
  drone: {
    weak: 'iron', name: 'HOLLOW DRONE', maxHp: 20,
    intents: [
      { name: 'Refrain',  dmg: 5, row: 'front' },
      { name: 'Dull Hum', dmg: 3, row: 'all' },
      { name: 'Harden', kind: 'buff', desc: 'hardens', guardSelf: 4 },
    ],
  },
  echoknight: {
    weak: 'blade', name: 'THE ECHO KNIGHT', maxHp: 56, boss: true,
    intents: [
      { name: 'Returning Stroke', dmg: 7, row: 'front' },
      { name: 'Echoed Arc',       dmg: 5, row: 'mid' },
      { name: 'Remembered Blade', dmg: 6, row: 'back' },
      { name: 'OBLIVION ECHO',    dmg: 10, row: 'all', heavy: true },
    ],
  },
  echoknight2: {
    weak: 'blade', name: 'THE ECHO KNIGHT, REMEMBERED', maxHp: 112, boss: true, floorBoss: true, art: 'echoknight',
    attacksPerRound: 2,   // the colossus strikes TWICE each round — two telegraphs to answer
    intents: [
      // The floor boss fills the field; its blows are CASCADES you parry as a
      // sequence — taps racing down an arc, a braced hold, a deflect sweep.
      { name: 'Returning Stroke', dmg: 9,  row: 'front', attackArt: 'slash', parry: { kind: 'seq', notes: [{ t: 'tap' }, { t: 'tap' }, { t: 'tap' }] } },
      { name: 'Gathers the Echo', kind: 'buff', desc: 'the echo swells', powerSelf: 3 },
      { name: 'Echoed Arc',       dmg: 7,  row: 'mid',  attackArt: 'claw', parry: { kind: 'seq', notes: [{ t: 'swipe', arc: 'arcR' }, { t: 'tap' }, { t: 'tap' }] } },
      { name: 'Remembered Blade', dmg: 8,  row: 'back', expose: 2, attackArt: 'slam', parry: { kind: 'seq', notes: [{ t: 'tap' }, { t: 'tap' }, { t: 'hold' }] } },
      { name: 'OBLIVION ECHO',    dmg: 13, row: 'all', heavy: true, attackArt: 'blast', parry: { kind: 'seq', notes: [{ t: 'tap' }, { t: 'tap' }, { t: 'tap' }, { t: 'swipe', arc: 'arcU' }, { t: 'hold' }] } },
    ],
  },
  // FLOOR 2 boss — a different concept from the Echo Knight.  Not a rhythm of
  // remembered strokes but a HUNGER: it HUNTS the weakest of you (smart) and
  // DRAINS life from every blow to heal itself, so you can't just out-race it —
  // you have to deny the damage.  Parries lean on braced HOLDs ("resist the pull").
  echodevourer: {
    weak: 'light', name: 'THE HOLLOW MAW', maxHp: 132, boss: true, floorBoss: true, art: 'echoknight', aura: 'maw',
    attacksPerRound: 2,
    intents: [
      { name: 'Cursed Reach', dmg: 5,  row: 'front', hex: 2, attackArt: 'claw',  parry: { kind: 'seq', notes: [{ t: 'tap' }, { t: 'hold' }] } },
      { name: 'The Hunger Deepens', kind: 'buff', desc: 'it feeds and swells', powerSelf: 2 },
      { name: 'DEVOUR',        dmg: 6,  row: 'front', drain: 0.6, attackArt: 'slam', parry: { kind: 'seq', notes: [{ t: 'hold' }, { t: 'tap' }, { t: 'hold' }] } },
      { name: 'Withering Wail', dmg: 4, row: 'all', chill: 1, attackArt: 'blast', parry: { kind: 'seq', notes: [{ t: 'swipe', arc: 'arcAcross' }, { t: 'tap' }] } },
      { name: 'THE GREAT GORGE', dmg: 7, row: 'all', heavy: true, drain: 0.4, attackArt: 'blast', parry: { kind: 'seq', notes: [{ t: 'hold' }, { t: 'tap' }, { t: 'swipe', arc: 'arcU' }, { t: 'tap' }, { t: 'hold' }] } },
    ],
  },
};

// ---------------------------------------------------------------------------
// DATA — the ten resonant cards, one per class-triangle of the roster.
// Four families: Offense / Defense / Formation / Utility.  Stage fx verbs:
//   aoeDmg hitFrontmost healAll guardAll guardFront buffAllDmg lullAll
//   markAll counterAll invulnFront pushBack
// ---------------------------------------------------------------------------
const RESONANT_TABLE = {
  'Bard+Cleric+Ronin': {
    name: 'Threefold Vow', type: 'Offense',
    desc: 'Strike ALL enemies 8 · heal the party 6 · the party gains 5 guard.',
    stages: [
      { text: 'the blade answers every line at once',  fx: { aoeDmg: 8 } },
      { text: 'light closes every wound',              fx: { healAll: 6 } },
      { text: 'the song turns to armor',               fx: { guardAll: 5 } },
    ],
  },
  'Bard+Cleric+Guardian': {
    name: 'Divine Bastion', type: 'Defense',
    desc: 'Your FRONT hero becomes INVULNERABLE this round · heal the party 4.',
    stages: [
      { text: 'the gate becomes a sanctum — untouchable', fx: { invulnFront: true } },
      { text: 'grace settles over the line',              fx: { healAll: 4 } },
    ],
  },
  'Bard+Cleric+Mage': {
    name: 'Hymn of Still Water', type: 'Utility',
    desc: 'ALL enemies deal −3 on their next attack · heal the party 5.',
    stages: [
      { text: 'the hymn slows every raised hand', fx: { lullAll: 3 } },
      { text: 'still water closes over the hurt', fx: { healAll: 5 } },
    ],
  },
  'Bard+Guardian+Mage': {
    name: 'Frozen Bulwark', type: 'Defense',
    desc: 'The party gains 7 guard · everyone counters attackers for 3 this round.',
    stages: [
      { text: 'frost climbs the shield-wall',   fx: { guardAll: 7 } },
      { text: 'the wall remembers who struck it', fx: { counterAll: 3 } },
    ],
  },
  'Bard+Guardian+Ronin': {
    name: 'Warsong Phalanx', type: 'Formation',
    desc: 'PUSH every enemy back one row · the party gains 4 guard.',
    stages: [
      { text: 'the warsong drives them backward', fx: { pushBack: true } },
      { text: 'the phalanx sets its feet',        fx: { guardAll: 4 } },
    ],
  },
  'Bard+Mage+Ronin': {
    name: 'Killing Tempo', type: 'Offense',
    desc: 'Strike ALL enemies 5 · every ally’s next damaging card deals +3.',
    stages: [
      { text: 'the tempo sharpens to a knife', fx: { aoeDmg: 5 } },
      { text: 'every hand finds the beat',     fx: { buffAllDmg: 3 } },
    ],
  },
  'Cleric+Guardian+Mage': {
    name: 'Frost Sanctum', type: 'Utility',
    desc: 'Heal the party 6 · the party gains 3 guard · ALL enemies deal −2 next attack.',
    stages: [
      { text: 'the sanctum seals its doors',  fx: { healAll: 6, guardAll: 3 } },
      { text: 'cold quiets the killing mood', fx: { lullAll: 2 } },
    ],
  },
  'Cleric+Guardian+Ronin': {
    name: 'Oathkeepers’ Advance', type: 'Formation',
    desc: 'PUSH every enemy back one row · heal the party 4 · your FRONT hero gains 5 guard.',
    stages: [
      { text: 'the oath walks forward and the dark gives way', fx: { pushBack: true } },
      { text: 'the line holds behind the shield',              fx: { healAll: 4, guardFront: 5 } },
    ],
  },
  'Cleric+Mage+Ronin': {
    name: 'Last Rite', type: 'Offense',
    desc: '12 damage to the NEAREST enemy · heal the party 4.',
    stages: [
      { text: 'one name is written, one rite is read', fx: { hitFrontmost: 12 } },
      { text: 'what was spent returns',                fx: { healAll: 4 } },
    ],
  },
  'Guardian+Mage+Ronin': {
    name: 'Shatterpoint', type: 'Offense',
    desc: 'MARK every enemy (+3 from every hit) · strike ALL enemies 5.',
    stages: [
      { text: 'frost finds every fault-line', fx: { markAll: 3 } },
      { text: 'and the hammer falls',         fx: { aoeDmg: 5 } },
    ],
  },
  // Reaver (Mira) trios — the shadow marks, the party executes.
  'Cleric+Guardian+Reaver': {
    name: 'Veiled Bulwark', type: 'Defense',
    desc: 'The party gains 6 guard · heal the party 4 · MARK every enemy (+3 from every hit).',
    stages: [
      { text: 'shadows fold around the wall', fx: { guardAll: 6 } },
      { text: 'and mend what the dark spared', fx: { healAll: 4, markAll: 3 } },
    ],
  },
  'Cleric+Reaver+Ronin': {
    name: 'Twin Shadows', type: 'Offense',
    desc: 'MARK every enemy (+3) · strike ALL enemies 6 · heal the party 3.',
    stages: [
      { text: 'two blades open the dark', fx: { markAll: 3 } },
      { text: 'and bleed it dry',         fx: { aoeDmg: 6, healAll: 3 } },
    ],
  },
  'Guardian+Reaver+Ronin': {
    name: 'Executioner’s Wall', type: 'Offense',
    desc: 'MARK every enemy (+3) · the FRONT hero gains 6 guard · 12 to the nearest enemy.',
    stages: [
      { text: 'the wall names its mark', fx: { markAll: 3, guardFront: 6 } },
      { text: 'and the shadow ends it',  fx: { hitFrontmost: 12 } },
    ],
  },
  // Ranger (Branwen) trios — she marks from range, the line cashes the wound.
  'Cleric+Ranger+Ronin': {
    name: 'Hunter’s Grace', type: 'Offense',
    desc: 'MARK every enemy (+3) · strike ALL enemies 5 · heal the party 3.',
    stages: [
      { text: 'she names every wound from the dark', fx: { markAll: 3 } },
      { text: 'and the volley falls with mercy behind it', fx: { aoeDmg: 5, healAll: 3 } },
    ],
  },
  'Guardian+Ranger+Ronin': {
    name: 'Killing Field', type: 'Offense',
    desc: 'MARK every enemy (+3) · the FRONT hero gains 5 guard · 12 to the nearest enemy.',
    stages: [
      { text: 'the wall pins them, the arrow marks them', fx: { markAll: 3, guardFront: 5 } },
      { text: 'and the killshot lands',                    fx: { hitFrontmost: 12 } },
    ],
  },
  'Ranger+Reaver+Ronin': {
    name: 'No Quarter', type: 'Offense',
    desc: 'MARK every enemy (+4) · strike ALL enemies 6.',
    stages: [
      { text: 'two hunters call the same mark', fx: { markAll: 4 } },
      { text: 'and nothing walks out',          fx: { aoeDmg: 6 } },
    ],
  },
};
const RESONANT_FALLBACK = {
  name: 'Triad Strike', type: 'Offense',
  desc: 'The three strike as one: 6 damage to every enemy.',
  stages: [{ text: 'the triad strikes as one', fx: { aoeDmg: 6 } }],
};

// ---------------------------------------------------------------------------
// DATA — DUET VOWS.  Where the triad is three threads held at once, a DUET is
// a single KINDLED bond (2+ points earned across the run) that a SHARED ACT in
// battle awakens — a pair's smaller, personal resonance.  Keyed by the two
// classes (sorted, '+').  Stage fx verbs are PAIR-scoped:
//   aoeDmg hitFrontmost pairHeal pairGuard guardFront pairRally pairCounter
//   markFront markAll lullAll
// A duet costs DUET_COST (not your whole turn) and deepens like a vow.
// ---------------------------------------------------------------------------
const DUET_COST = 3;
const RESONANT_PAIRS = {
  'Cleric+Ronin': {   // Elin + Ash — the healer wards, the blade answers
    name: 'Warded Edge', type: 'Offense',
    desc: 'Both gain 4 guard · strike ALL enemies 5.',
    stages: [
      { text: 'her light closes around his guard', fx: { pairGuard: 4 } },
      { text: 'and he answers every line',          fx: { aoeDmg: 5 } },
    ],
  },
  'Reaver+Ronin': {   // Mira + Ash — two blades open the same wound
    name: 'Twin Edge', type: 'Offense',
    desc: 'EXPOSE every enemy (+2) · strike ALL enemies 6.',
    stages: [
      { text: 'two blades find the same seam', fx: { markAll: 2 } },
      { text: 'and open it together',          fx: { aoeDmg: 6 } },
    ],
  },
  'Cleric+Reaver': {   // Elin + Mira — mercy, then the killing stroke
    name: 'Silent Mercy', type: 'Offense',
    desc: 'Both heal 5 · 9 to the NEAREST enemy.',
    stages: [
      { text: 'she mends what the dark spared', fx: { pairHeal: 5 } },
      { text: 'and the shadow ends the rest',   fx: { hitFrontmost: 9 } },
    ],
  },
  'Guardian+Ronin': {   // Cassia + Ash — she holds the gate, he cuts through it
    name: 'Shield & Sword', type: 'Offense',
    desc: 'FRONT hero gains 6 guard · strike ALL enemies 5.',
    stages: [
      { text: 'the wall sets its feet',   fx: { guardFront: 6 } },
      { text: 'and the blade leaps past it', fx: { aoeDmg: 5 } },
    ],
  },
  'Guardian+Cleric': {   // Cassia + Elin — an unbroken line
    name: 'Sanctified Wall', type: 'Defense',
    desc: 'Both gain 6 guard · both heal 5.',
    stages: [
      { text: 'the wall is blessed', fx: { pairGuard: 6 } },
      { text: 'and made whole',      fx: { pairHeal: 5 } },
    ],
  },
  'Guardian+Reaver': {   // Cassia + Mira — the wall names the mark
    name: 'Wall & Whisper', type: 'Defense',
    desc: 'Both gain 5 guard · EXPOSE every enemy (+3).',
    stages: [
      { text: 'the wall holds', fx: { pairGuard: 5 } },
      { text: 'while the shadow marks them all', fx: { markAll: 3 } },
    ],
  },
  'Ranger+Ronin': {   // Branwen + Ash — she marks, he charges the mark
    name: 'Marked Charge', type: 'Offense',
    desc: 'EXPOSE every enemy (+3) · strike ALL enemies 5.',
    stages: [
      { text: 'she names the wounds from range', fx: { markAll: 3 } },
      { text: 'and he charges every one',        fx: { aoeDmg: 5 } },
    ],
  },
  'Cleric+Ranger': {   // Elin + Branwen — covered while she draws
    name: 'Covered Advance', type: 'Utility',
    desc: 'Both heal 5 · EXPOSE every enemy (+3).',
    stages: [
      { text: 'she tends the line', fx: { pairHeal: 5 } },
      { text: 'so the volley can mark them all', fx: { markAll: 3 } },
    ],
  },
  'Ranger+Reaver': {   // Branwen + Mira — two hunters, one kill order
    name: 'Kill Order', type: 'Offense',
    desc: 'EXPOSE every enemy (+3) · 10 to the NEAREST enemy.',
    stages: [
      { text: 'two hunters call the same mark', fx: { markAll: 3 } },
      { text: 'and the killshot lands',         fx: { hitFrontmost: 10 } },
    ],
  },
  'Guardian+Ranger': {   // Cassia + Branwen — anvil and arrow
    name: 'Anvil & Arrow', type: 'Offense',
    desc: 'FRONT hero gains 5 guard · 10 to the NEAREST enemy.',
    stages: [
      { text: 'the anvil holds them fast', fx: { guardFront: 5 } },
      { text: 'and the arrow drives home', fx: { hitFrontmost: 10 } },
    ],
  },
};
const DUET_FALLBACK = {
  name: 'Shared Vow', type: 'Offense',
  desc: 'Both gain 4 guard · strike ALL enemies 5.',
  stages: [
    { text: 'the two move as one', fx: { pairGuard: 4 } },
    { text: 'and strike as one',   fx: { aoeDmg: 5 } },
  ],
};
function duetClassKey(a, b) { return [HEROES[a].cls, HEROES[b].cls].sort().join('+'); }
function duetFor(a, b) { return RESONANT_PAIRS[duetClassKey(a, b)] || DUET_FALLBACK; }

// ---------------------------------------------------------------------------
// DATA — the tutorial chapters (unchanged), then THE DESCENT map.
// ---------------------------------------------------------------------------
const FLOW = [
  { type: 'story', chapter: 1, title: 'ONE SURVIVOR', eyebrow: 'CHAPTER 1', lines: [
    { text: 'The first thing you understand is that everyone else is gone.' },
    { spk: 'ASH', text: '…then I carry it alone.' },
    { text: 'You are <b>Ash</b>. One blade, three ways to hold it — your <b>row is your stance</b>: Front cuts, Mid flows, Back strikes from the wind. <b>Drag Ash himself</b> between rows and his cards rewrite to match.' },
    { text: 'You begin lean: a <b>basic strike</b> in each stance, and <b>one opening signature</b> already lit. Everything deeper — new arts, upgrades, ruinous finishers — you’ll <b>earn on the way down</b>.' },
  ]},
  { type: 'fight', chapter: 1, heroes: ['ash'], enemies: ['husk'],
    narrator: 'Tap or drag a card to strike. DRAG ASH to change stance (1 EP). When the husk winds up, TAP in time to turn the blow.' },
  { type: 'story', chapter: 1, title: 'THE STANCES', eyebrow: 'CHAPTER 1', lines: [
    { text: 'Every foe <b>telegraphs</b> before it strikes: the damage it will deal, and the <b>row</b> it will hit.' },
    { spk: 'ASH', text: 'So I answer one of two ways — not be there, or meet it.' },
    { text: '<b>Drag to an empty row</b> to dodge the blow, or hold your ground and <b>PARRY</b> it — tap each note the instant its ring glows gold. A clean parry blunts the strike and feeds your <b>momentum</b>.' },
  ]},
  { type: 'fight', chapter: 1, heroes: ['ash'], enemies: ['husk', 'wraith'],
    narrator: 'Dodge the row they call — or stand and PARRY it. The row they name is the row they strike.' },
  { type: 'story', chapter: 2, title: 'ELIN', eyebrow: 'CHAPTER 2 · TWO', lines: [
    { text: 'A light in the ash-fog — a healer, kneeling over what’s left of her order.' },
    { spk: 'ELIN', text: 'You’re bleeding. Stand still.' },
    { spk: 'ASH', text: '…you’re coming with me.' },
    { text: 'Two now. When one of you <b>helps</b> the other — a heal, a guard, a follow-up on a wounded foe — a <b>thread</b> forms between them. The threads are the whole point. Watch.' },
  ]},
  { type: 'fight', chapter: 2, heroes: ['ash', 'elin'], enemies: ['cultist', 'husk'],
    narrator: 'Have Elin heal Ash — a thread kindles between them. Fight side by side and it deepens.' },
  { type: 'story', chapter: 3, title: 'MIRA', eyebrow: 'CHAPTER 3 · THREE', lines: [
    { text: 'A blade rests at your throat before you hear a single step. Then, slowly, it lowers.' },
    { spk: 'MIRA', text: 'You came through the dark loud as a funeral. …Lucky I only kill what I mean to. Move.' },
    { text: 'Three now — a triangle. Hold all three <b>threads</b> at once and the trio <b>RESONATES</b>: a shared vow only your exact three can speak. No one will tell you how. You’ll feel it close.' },
  ]},
  { type: 'fight', chapter: 3, heroes: ['ash', 'elin', 'mira'], enemies: ['echoknight', 'cultist'],
    narrator: 'Help one another until all three threads hold — then the triad answers. Chain hits to fill BURST.' },
  { type: 'story', chapter: 3, title: 'THE ROAD DOWN', eyebrow: 'THE DESCENT', lines: [
    { text: 'The tutorial road ends at a cliff’s edge. Below waits the <b>Descent</b> — and the Abyss beneath it.' },
    { text: 'The dead give up <b>✦ embers</b>. Between fights, open your party’s <b>Ember Tree</b> on the map and spend them to unlock new cards and upgrades — only for the heroes you’re fielding, and only for <b>this descent</b>. Fall, and the whole kit burns away with you.' },
    { text: 'Every trio you form <b>resonates differently</b>, so <b>who walks beside whom is your build</b>. And when a party falls, the Abyss remembers where — your next descent finds their ashes still warm.' },
    { spk: 'MIRA', text: 'Down, then. Stay close. …That’s not sentiment. It’s tactics.' },
  ], next: 'descent' },
];

// ---------------------------------------------------------------------------
// THE DESCENT — a PROCEDURALLY GENERATED branching map (v1-aligned).  Every
// run generates a fresh descent: a single funnel FIGHT, then several branching
// stretches (2-3 nodes each — the player chooses the road), a pre-boss CAMP
// gate, and the BOSS.  Node vocabulary: fight · elite · event · camp · recruit
// · boss.  The generated map lives on RUN.map (an array indexed by id) so it
// persists with the run; `mapNode(id)` / `mapAll()` read it.
// ---------------------------------------------------------------------------
// STARTERS & RECRUITS — every run begins SOLO with a hero you choose from your
// UNLOCKED starters (v1-style); the other party members are RECRUITED on the
// road.  Recruiting a hero permanently UNLOCKS them as a future starter, so the
// roster you can open with grows the more you play.
const STARTER_POOL = ['ash', 'elin', 'mira', 'cassia', 'branwen'];   // all pickable/recruitable heroes
const DEFAULT_STARTERS = ['ash', 'mira'];                            // unlocked from the first run (solo-viable damage)
const STARTERS_KEY = 'kizuna2_1.starters';
const LAST_STARTER_KEY = 'kizuna2_1.lastStarter';   // whose key-art greets you on the title
function getUnlockedStarters() {
  try { const a = JSON.parse(localStorage.getItem(STARTERS_KEY) || 'null'); if (Array.isArray(a) && a.length) return a.filter(id => STARTER_POOL.includes(id)); } catch (_) {}
  return DEFAULT_STARTERS.slice();
}
function unlockStarter(id) {
  if (!STARTER_POOL.includes(id)) return;
  const a = getUnlockedStarters();
  if (!a.includes(id)) { a.push(id); try { localStorage.setItem(STARTERS_KEY, JSON.stringify(a)); } catch (_) {} }
}
const RECRUIT_NODE_LABELS = {
  ash: 'A LONE BLADE', elin: 'THE LAST LIGHT', mira: 'A SHADOW ON THE ROAD',
  cassia: 'THE GATE HOLDS', branwen: 'THE OUTLAW’S DEBT',
};
const COMBAT_POOL = {
  early: ['husk', 'wraith', 'cultist'],
  mid:   ['cultist', 'mourner', 'husk', 'wraith'],
  deep:  ['drone', 'mourner', 'cultist', 'wraith', 'husk'],
};
const NODE_LABELS = {
  fight: ['ASHFALL ROAD', 'HOLLOW CHOIR', 'MOURNING FIELD', 'COLD PROCESSION', 'THE GREY MILE', 'SILENT MARCH', 'THE BROKEN CHANCEL', 'DRONE NEST', 'THE WEEPING STAIR'],
  elite: ['THE WARDEN STIRS', 'A DEEPER SIN', 'THE GORGE OF NAMES', 'THE HUNGERING DARK', 'WHERE THE STRONG FELL'],
  event: ['A COLD SHRINE', 'AN OLD CACHE', 'AN ECHO IN THE DARK', 'A FORK IN THE BLACK', 'THE WATCHER’S STONE'],
  camp:  ['EMBER REST', 'HOLLOW REST', 'LAST FIRE', 'THE QUIET HOUR'],
  boss:  ['THE REMEMBERED'],
};
function _rand(n) { return Math.floor(Math.random() * n); }
function _pick(a) { return a[_rand(a.length)]; }
function _shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = _rand(i + 1); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function _labeler(type) { const q = _shuffle(NODE_LABELS[type] || ['THE ROAD']); let i = 0; return () => q[i++ % q.length]; }
function _combatEnemies(level) {
  const pool = level <= 2 ? COMBAT_POOL.early : level <= 4 ? COMBAT_POOL.mid : COMBAT_POOL.deep;
  // The level-1 funnel is a single foe — a gentle opener for a solo starter.
  const count = level <= 1 ? 1 : level <= 2 ? 2 : (Math.random() < 0.45 ? 3 : 2);
  const out = []; for (let i = 0; i < count; i++) out.push(_pick(pool)); return out;
}
function _eliteEnemies(level) {
  const heavy = _pick(['drone', 'mourner']);
  const rest = _shuffle(['cultist', 'wraith', 'husk', 'mourner']).slice(0, level >= 5 ? 2 : 1);
  return [heavy, ...rest];
}
// One branching stretch's node TYPES (2-3), always with at least one fight and
// weighted toward variety as the descent deepens.
function _stretchTypes(level) {
  const types = ['fight'];
  const r = Math.random();
  if (level >= 3 && r < 0.42) types.push('elite');
  else types.push(Math.random() < 0.62 ? 'event' : 'fight');
  if (Math.random() < 0.5) types.push(Math.random() < 0.5 ? 'event' : 'fight');
  return _shuffle(types);
}
// Wire each stretch to the next: every source reaches 1-2 adjacent targets and
// every target keeps at least one incoming edge (no orphans, no dead ends).
function _connect(prev, next, nodes) {
  prev.forEach((pid, pi) => {
    const span = Math.max(1, prev.length - 1);
    const base = Math.min(next.length - 1, Math.round(pi * (next.length - 1) / span));
    const t = new Set([next[base]]);
    if (next[base + 1] && Math.random() < 0.5) t.add(next[base + 1]);
    if (next[base - 1] && Math.random() < 0.3) t.add(next[base - 1]);
    nodes[pid].next = [...t];
  });
  next.forEach(nid => {
    if (!prev.some(pid => nodes[pid].next.includes(nid))) {
      nodes[prev[_rand(prev.length)]].next.push(nid);
    }
  });
}
function generateDescent(roster, floor) {
  roster = roster || ['ash'];
  floor = floor || 1;
  // Recruits = anyone not already in the party.  You start solo (or short) and
  // build your trio from the road, so an early recruit is guaranteed close.
  const pending = _shuffle(STARTER_POOL.filter(id => !roster.includes(id)));
  const numLevels = 7;
  // Scatter recruit encounters at RANDOM depths (not clustered up front) —
  // FFT-style, you cross paths with survivors anywhere on the road.  One lands
  // early (level 2) so a solo lead isn't alone for long; the rest fall at random
  // deeper levels among the mid stretch.
  const midLevels = _shuffle(Array.from({ length: Math.max(0, numLevels - 4) }, (_, i) => i + 3));  // 3 .. numLevels-2
  const recruitLevels = [2].concat(midLevels).slice(0, Math.min(pending.length, 3));
  const recruitAtLevel = {};
  recruitLevels.forEach((lvl, i) => { recruitAtLevel[lvl] = pending[i]; });
  const nodes = [];
  const levels = [];
  const lbl = { fight: _labeler('fight'), elite: _labeler('elite'), event: _labeler('event'), camp: _labeler('camp'), boss: _labeler('boss') };
  const eventQ = _shuffle(Object.keys(EVENTS_V2));
  let eventI = 0, idc = 0;
  for (let level = 1; level <= numLevels; level++) {
    let types;
    if (level === 1) types = ['fight'];
    else if (level === numLevels) types = ['boss'];
    else if (level === numLevels - 1) types = ['camp'];
    else types = _stretchTypes(level);
    if (recruitAtLevel[level]) { types = types.slice(0, 2); types.splice(_rand(types.length + 1), 0, 'recruit'); }   // random row, not always the bottom
    const ids = [];
    types.forEach(type => {
      const node = { id: idc, level, col: level, type, next: [] };
      if (type === 'fight')        { node.enemies = _combatEnemies(level); node.label = lbl.fight(); }
      else if (type === 'elite')   { node.enemies = _eliteEnemies(level); node.elite = true; node.label = lbl.elite(); }
      else if (type === 'event')   { node.eventId = eventQ[eventI++ % eventQ.length]; node.label = lbl.event(); }
      else if (type === 'camp')    { node.label = lbl.camp(); }
      else if (type === 'recruit') { node.hero = recruitAtLevel[level]; node.label = RECRUIT_NODE_LABELS[node.hero] || 'A NEW THREAD'; }
      else if (type === 'boss')    { node.enemies = [floor >= 2 ? 'echodevourer' : 'echoknight2']; node.isBoss = true; node.floorBoss = true; node.label = floor >= 2 ? 'THE HOLLOW MAW' : lbl.boss(); }
      nodes[idc] = node; ids.push(idc); idc++;
    });
    levels.push(ids);
  }
  for (let l = 0; l < levels.length - 1; l++) _connect(levels[l], levels[l + 1], nodes);
  // A previous descent's ashes surface once — attach any Abyss memory to a node
  // at the same depth (level) in this fresh map so the ♰ still marks the road.
  const abyss = loadAbyss();
  Object.keys(abyss).forEach(lvlKey => {
    const lv = +lvlKey;
    const candidates = nodes.filter(n => n.level === lv && n.type !== 'boss');
    if (candidates.length) { const n = candidates[_rand(candidates.length)]; n.mem = abyss[lvlKey]; n.memLevel = lv; }
  });
  return nodes;
}
function mapAll() { return (RUN && RUN.map) || []; }
function mapNode(id) { return mapAll()[id]; }

// EVENT nodes — a crossroads with two choices, each trading in the run's real
// resources (party HP, bonds, a one-fight edge).  Kept small and readable; the
// fx run at click-time so they close over the current RUN.
function _healParty(x) { RUN.roster.forEach(id => { RUN.hp[id] = Math.min(HEROES[id].maxHp, (RUN.hp[id] ?? HEROES[id].maxHp) + x); }); }
function _weakestActiveBondKey() {
  const ids = RUN.active.slice(); let best = null, low = Infinity;
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const k = pairKey(ids[i], ids[j]); const p = bondPts(k);
    if (p < low) { low = p; best = k; }
  }
  return best;
}
function _bumpWeakestBond() { const k = _weakestActiveBondKey(); if (k) { RUN.bonds = RUN.bonds || {}; RUN.bonds[k] = (RUN.bonds[k] || 0) + 1; } return k; }
// Each choice is { icon, label (the ACT), effect (the CONSEQUENCE, styled) }
// so every event renders the same two-line choice card — one shared structure.
const EVENTS_V2 = {
  shrine: {
    title: 'A COLD SHRINE', eyebrow: 'A CROSSROADS',
    lines: ['A shrine to a god no one remembers leans in the dark.', 'It asks for something — or gives it. Hard to say which.'],
    a: { icon: '✦', label: 'KNEEL AND PRAY', effect: 'The party heals <b>6</b>.', fx: () => _healParty(6) },
    b: { icon: '♡', label: 'OFFER A NAME', effect: 'Deepen your weakest bond <b>+1</b>.', fx: () => _bumpWeakestBond() },
  },
  cache: {
    title: 'AN OLD CACHE', eyebrow: 'A CROSSROADS',
    lines: ['A dead scout’s pack, half-buried. Whatever killed them is long gone.', 'Two things worth taking. Only time to grab one.'],
    a: { icon: '▲', label: 'THE WHETSTONE', effect: 'Open the next fight with <span class="kw kw-rally">▲ RALLY +2</span>.', fx: () => { RUN.campEdge = true; } },
    b: { icon: '✚', label: 'THE POULTICE', effect: 'The party heals <b>4</b>.', fx: () => _healParty(4) },
  },
  echo: {
    title: 'AN ECHO IN THE DARK', eyebrow: 'A CROSSROADS',
    lines: ['A voice repeats a conversation the party half-remembers having.', 'Stay and listen, or press on before it learns your names.'],
    a: { icon: '♡', label: 'LISTEN', effect: 'Heal <b>3</b> · deepen your weakest bond <b>+1</b>.', fx: () => { _healParty(3); _bumpWeakestBond(); } },
    b: { icon: '▲', label: 'PRESS ON', effect: 'Open the next fight with <span class="kw kw-rally">▲ RALLY +2</span>.', fx: () => { RUN.campEdge = true; } },
  },
  // A companion moment — the third BOON source (alongside elites and the fire).
  companion: {
    title: 'A QUIET WORD', eyebrow: 'A CROSSROADS',
    lines: ['One of them falls into step beside you, turning something over in their hands.', 'They’ve been meaning to show you how they do a certain thing.'],
    a: { icon: '✦', label: 'HEAR THEM OUT', effect: 'A companion shares how they fight — <b>draw 1 of 3</b>.', boon: true },
    b: { icon: '✚', label: 'KEEP MOVING', effect: 'Press on · the party heals <b>4</b>.', fx: () => _healParty(4) },
  },
};

// One voice per hero — camp scenes pair the two least-bonded companions.
const CAMP_VOICES = {
  ash:    '…I don’t talk much. But I’d notice if you were gone.',
  elin:   'Hold still a moment. Even wounds no one can see want tending.',
  kiki:   'I’m writing a song about us, you know. You’re the difficult verse.',
  cassia: 'A wall is only as strong as who it shelters. Stand behind me tomorrow.',
  hask:   'You’re warm. Sit closer. That’s strategy, not sentiment.',
  mira:   'I watch the dark so you don’t have to. …Don’t thank me. I’ll deny it.',
  branwen:'I keep to the treeline so I can see you all. …Habit. Comes from losing people you didn’t.',
};

const RECRUIT_LINES = {
  cassia: [
    { text: 'A knight holds a shattered gate alone, shield planted like a gravestone.' },
    { spk: 'CASSIA', text: 'If you’re walking down, you’ll want a wall that walks with you.' },
  ],
  hask: [
    { text: 'Frost patterns bloom across the stones. Something small and cold is waiting.' },
    { spk: 'HASK', text: 'You’re warm. Stand near me and I’ll forgive the noise.' },
  ],
  branwen: [
    { text: 'An arrow thuds into the post beside you before you ever saw the archer. She steps from the dark, bow already lowered.' },
    { spk: 'BRANWEN', text: 'Relax — if I’d wanted you dead you wouldn’t be reading this. You walk down there without eyes on the treeline, you don’t walk back. Let me be your eyes.' },
  ],
};

// ---------------------------------------------------------------------------
// STATE
// ---------------------------------------------------------------------------
let S = null;               // battle state
let flowIdx = 0;
let RUN = null;             // descent run state
let targeting = null;       // { card, validIds, drag? } while picking a target
const PROGRESS_KEY = 'kizuna2_1.flow';
const RUN_KEY = 'kizuna2_1.run';
const ABYSS_KEY = 'kizuna2_1.abyss';   // nodeId -> memory of a fallen descent
function loadAbyss() { try { return JSON.parse(localStorage.getItem(ABYSS_KEY) || '{}'); } catch (_) { return {}; } }
function saveAbyss(a) { try { localStorage.setItem(ABYSS_KEY, JSON.stringify(a)); } catch (_) {} }
// Vow ranks — every time a class-triangle actually speaks its vow, the vow
// deepens.  PERSISTS ACROSS RUNS (and deaths): the trio remembers how to
// fight together.  1 use -> rank II, 3 uses -> rank III (+2 to the vow's
// numeric stages per rank above I).
const VOWS_KEY = 'kizuna2_1.vows';
function loadVows() { try { return JSON.parse(localStorage.getItem(VOWS_KEY) || '{}'); } catch (_) { return {}; } }
function vowUses(classKey) { return loadVows()[classKey] || 0; }
function vowRank(classKey) { const u = vowUses(classKey); return u >= 3 ? 3 : u >= 1 ? 2 : 1; }
function recordVow(classKey) {
  const v = loadVows(); v[classKey] = (v[classKey] || 0) + 1;
  try { localStorage.setItem(VOWS_KEY, JSON.stringify(v)); } catch (_) {}
}
const ROMAN = ['', 'I', 'II', 'III'];
function trioClassKey(ids) { return ids.map(id => HEROES[id].cls).sort().join('+'); }
const UNLOCK_KEY = 'kizuna2_1.unlocked';

function newRun(starterId) {
  // Begin SOLO with the chosen (unlocked) starter; recruit the rest on the road.
  starterId = (starterId && HEROES[starterId]) ? starterId : (getUnlockedStarters()[0] || 'ash');
  const roster = [starterId];
  const hp = {}; hp[starterId] = HEROES[starterId].maxHp;
  // STARTING SPARK — the lone starter opens with their FRONT signature already
  // kindled, so a solo turn has a real SECOND action (core + signature = 2 cards,
  // matching the 3 solo EP).  The tree still gates the mid/back sigs, riders, and
  // emergent capstones, so there's plenty left to earn on the way down.
  const spark = (SIG_GATE[starterId] && SIG_GATE[starterId].front) || null;
  return {
    roster: roster.slice(),
    active: roster.slice(),
    hp,
    bonds: {},          // pairKey -> points; a pair at 2+ is KINDLED
    floor: 1,           // the descent has FLOORS; clearing a floor boss drops you deeper
    depthBase: 0,       // depth carried from cleared floors, so the ramp keeps rising
    map: generateDescent(roster, 1),   // a fresh branching descent every run
    completed: [],
    embers: 0,          // per-run ember wallet — earned and spent THIS descent only
    nodes: spark ? [spark] : [],   // per-run skill-tree unlocks — reset when the run ends (seeded with the starting spark)
    forges: [],         // temporary ember tempers bought at camps — reset each descent
    boons: [],          // companion GIFTS drafted on the road — reset each descent (party-gated)
    foes: [],           // travelers you wronged — they ambush a later fight this run
    foesMade: 0,        // count of travelers ever crossed this run — reputation for party MOOD
    emCount: {},        // emergent-loop tallies — accrue ACROSS the whole descent (grow over time)
    done: false,
  };
}
const FLOORS = 2;         // total floors in a full descent
const BOND_KINDLED = 2;
const bondPts = (k) => (RUN && RUN.bonds && RUN.bonds[k]) || 0;
function saveRun() { try { localStorage.setItem(RUN_KEY, RUN ? JSON.stringify(RUN) : ''); } catch (_) {} }
function loadRun() { try { const r = localStorage.getItem(RUN_KEY); return r ? JSON.parse(r) : null; } catch (_) { return null; } }

function newBattle(node) {
  const ids = node.heroes;
  const heroes = ids.map((id, i) => ({
    id, def: HEROES[id],
    hp: (node.useRunHp && RUN) ? Math.max(1, RUN.hp[id] ?? HEROES[id].maxHp) : HEROES[id].maxHp,
    maxHp: HEROES[id].maxHp,
    row: ['front', 'mid', 'back'][i] || 'front',
    guard: 0, buffDmg: 0, counter: 0, invuln: false, downed: false,
    chill: 0, exposed: 0,
  }));
  const enemies = node.enemies.map((id, i) => ({
    id, def: ENEMY_DEFS[id], uid: id + '#' + i,
    hp: ENEMY_DEFS[id].maxHp, maxHp: ENEMY_DEFS[id].maxHp,
    row: ['front', 'mid', 'back'][i] || 'mid',
    guard: 0, power: 0, mark: 0, lull: 0, intentIdx: 0, dead: false, acted: false,
    weakRevealed: false, weakened: false, staggered: false,
    smart: (node.floor || 1) >= 2,   // deeper foes HUNT the weakest of you (see effIntentRow)
  }));
  // DIFFICULTY — the tutorial (no useRunHp) stays a gentle on-ramp, but the
  // real run (the DESCENT) hits harder and RAMPS as you go deeper, so fights
  // stay threatening instead of being out-tempo'd.  dmgMul feeds the single
  // enemyIntentDmg() source of truth; non-boss HP scales up so foes survive to
  // act (no more turn-1 alpha wipes).  Bosses are already tuned high — they
  // take only a light damage ramp and keep their hand-set HP.
  if (node.useRunHp) {
    // depth carries across floors, so floor 2 continues the ramp (harder) rather
    // than restarting soft.  numLevels-per-floor is 7.
    const depth = Math.max(1, (node.depth || 1) + ((node.floor || 1) - 1) * 7);
    // Small parties (a solo/duo opener before you've recruited) take fewer
    // knocks and face slightly softer foes, so the v1-style solo start is
    // survivable until the road fills your line.  Bosses ignore this — by the
    // final gate you should be a full trio, and the boss is meant to hurt.
    const ps = heroes.length;
    const psDmg = ps >= 3 ? 1 : ps === 2 ? 0.82 : 0.64;
    const psHp = ps >= 3 ? 1 : ps === 2 ? 0.86 : 0.72;
    enemies.forEach(e => {
      if (e.def.boss) {
        // Bosses already hit hard and strike TWICE a round, so their per-floor
        // ramp is GENTLE (+3 effective depth per floor, not +7): a single
        // UNPARRIED blow should be frightening, not an instant execution.
        const bdepth = Math.max(1, (node.depth || 1) + ((node.floor || 1) - 1) * 3);
        e.dmgMul = 2.3 + (bdepth - 1) * 0.08;
        // A single-target boss gets FOCUS-FIRED by a full trio (every hero piles
        // follow-ups onto one body), so it needs real bulk to be a CLIMAX rather
        // than a 2-turn pushover.  The floor-1 boss leans on HP for that; the
        // floor-2 boss (life-DRAIN + hunts the weakest) is deadly at less, so it
        // keeps the leaner multiplier instead of becoming an HP sponge.
        const bhpMult = (node.floor || 1) >= 2 ? 1.9 : 2.9;
        const hp = Math.round(e.maxHp * bhpMult);
        e.maxHp = hp; e.hp = hp;
      } else {
        e.dmgMul = (1.8 + (depth - 1) * 0.08) * psDmg;
        const hp = Math.round(e.maxHp * (1.65 + (depth - 1) * 0.06) * psHp);
        e.maxHp = hp; e.hp = hp;
      }
      // ELITE nodes hit harder and last longer — a real spike over a plain fight.
      if (node.elite && !e.def.boss) {
        e._elite = true;                 // pays the bigger ember bounty (emberReward)
        e.dmgMul *= 1.3;
        const hp = Math.round(e.maxHp * 1.6);
        e.maxHp = hp; e.hp = hp;
      }
    });
    // HEAT — the opt-in difficulty valve.  Each level makes every foe hit harder
    // and last longer, so a widening tree meets a rising challenge (and pays more
    // embers — see emberReward).
    const heat = META.heat || 0;
    if (heat > 0) {
      enemies.forEach(e => {
        e.dmgMul = (e.dmgMul || 1) * (1 + heat * 0.15);
        const hp = Math.round(e.maxHp * (1 + heat * 0.12));
        e.maxHp = hp; e.hp = hp;
      });
    }
  }
  // Kindled bonds walk into battle already connected: the pair's thread is
  // pre-formed and the bond-guard applies from turn one.  The triad itself
  // still needs ONE act of help this fight to awaken (see addThread).
  // Sharpened steel from camp: the party opens this fight rallied.
  if (node.useRunHp && RUN && RUN.campEdge) {
    heroes.forEach(h => { h.buffDmg += 2; });
    RUN.campEdge = false;
    saveRun();
  }
  const threads = new Set();
  if (node.useRunHp && RUN && RUN.bonds) {
    const ids = heroes.map(h => h.id);
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const k = pairKey(ids[i], ids[j]);
      if (bondPts(k) >= BOND_KINDLED) {
        threads.add(k);
        [ids[i], ids[j]].forEach(id => { const h = heroes.find(x => x.id === id); if (h) h.guard += 2; });
      }
    }
  }
  return {
    node, heroes, enemies,
    maxEp: 2 + heroes.length, ep: 2 + heroes.length,
    used: new Set(),
    threads,
    pairsAwake: new Set(),   // kindled pairs whose DUET has awakened THIS fight
    tempCards: [], _tuid: 0, channelUsed: false,
    momentum: 0, combo: 0, comboBest: 0, allOutUsed: 0,
    triadFormed: false, resonantUsed: false, resonantNew: false,
    executing: false, over: false, turn: 1,
  };
}

// Generated cards — skills forging skills.  Capped at 3 so the fan never
// floods; each carries temp:true + a uid, and may expire at turn end.
function genTempCard(card) {
  if (S.tempCards.length >= 3) { flashNarrator('The moment passes — too many possibilities in hand.'); return; }
  card.temp = true;
  card.uid = ++S._tuid;
  S.tempCards.push(card);
  S._tempNew = card.uid;
  SFX.card();
  renderAll();
}

const pairKey = (a, b) => [a, b].sort().join('|');
const livingHeroes = () => S.heroes.filter(h => !h.downed);
const livingEnemies = () => S.enemies.filter(e => !e.dead);
const heroInRow = (row) => livingHeroes().find(h => h.row === row) || null;
const frontmostEnemy = () => ['front', 'mid', 'back'].map(r => livingEnemies().find(e => e.row === r)).find(Boolean) || livingEnemies()[0] || null;
const enemyArt = (e) => V2PORTRAITS[e.def.art || e.id] || '';

// ---------------------------------------------------------------------------
// HAND
// ---------------------------------------------------------------------------
function cardType(card) {
  if (card.kind === 'resonant') return 'resonant';
  if (card.kind === 'temp') return 'temp';
  if (card.kind === 'move') return 'move';
  const fx = card.fx || {};
  if (fx.dmg) return 'attack';
  if (fx.guard || fx.counter) return 'guard';
  return 'skill';
}
function buildHand() {
  // Each hero contributes a Core + their Signature (once it's UNLOCKED) — so the
  // hand GROWS as you kindle skills on the way down.  That breadth is earned, not
  // dumped on you: you open with a single spark and unlock the rest through the
  // ember tree, growing into a wide full-party hand as you go.  HEAVY heroes
  // contribute one (expensive) card.  Movement is not a card — you drag the hero.
  // When the triad forms, the resonant card HIJACKS the host's signature slot
  // (the card evolves).  Played cards LEAVE the fan (they return next turn) — what
  // remains is exactly what you can still do.
  const hand = [];
  const host = resonantHost();
  livingHeroes().forEach(h => {
    const set = h.def.cards[h.row];
    const heavy = (h.def.tempo || 'steady') === 'heavy';
    if (!heavy) {
      const core = mkCard(h, 'core', set.core);
      if (!core.spent) hand.push(core);
    }
    if (host === h.id) hand.push(mkResonantCard(h));
    else if (sigUnlocked(h)) { const sig = mkCard(h, 'sig', set.sig); if (!sig.spent) hand.push(sig); }
    else if (heavy) { const core = mkCard(h, 'core', set.core); if (!core.spent) hand.push(core); }   // heavy fallback: the CORE stands in until the signature is unlocked
  });
  S.tempCards.filter(t => t.expiresTurn == null || t.expiresTurn >= S.turn).forEach(t => hand.push(t));
  return hand;
}
// Whose signature is currently transformed?  The hero whose act of help
// closed the triangle; falls back to any living hero if they went down.
function resonantHost() {
  if (!S.triadFormed || S.resonantUsed) return null;
  const live = livingHeroes().map(h => h.id);
  if (S.resonantHostId && live.includes(S.resonantHostId)) return S.resonantHostId;
  return live[0] || null;
}
function mkCard(h, kind, def) {
  const tempo = h.def.tempo || 'steady';
  let cost = def.cost;
  if (tempo === 'swift' && cost > 1) cost -= 1;   // fast heroes play cheap and often
  // EMBER RIDERS (permanent) + FORGES (temporary, per-run) bolt effects onto the
  // base card.  Clone fx first so the shared def is never mutated.
  let fx = def.fx, desc = def.desc;
  const riders = ridersFor(h.id, def.name);
  const forges = runForges();
  const boons = runBoons().filter(b => b.card);
  if (riders.length || forges.length || boons.length) fx = Object.assign({}, def.fx);
  if (riders.length) {
    riders.forEach(n => {
      Object.keys(n.rider.fx).forEach(k => { fx[k] = (fx[k] || 0) + n.rider.fx[k]; });
      if (n.rider.descAdd) desc = desc + n.rider.descAdd;
    });
  }
  const card = { kind, owner: h.id, ownerName: h.def.name, tint: h.def.tint, tempo,
    stance: STANCE[h.row].name, name: def.name, cost, target: def.target, fx, desc,
    school: (fx && fx.dmg) ? h.def.school : null,
    spent: S.used.has(h.id + ':' + kind) };
  // temper the cloned card with any run forges (mutates card.fx / card.cost)
  forges.forEach(fid => { const f = FORGE_BY_ID[fid]; if (f) f.apply(card); });
  boons.forEach(b => { try { b.card(card); } catch (_) {} });   // companion gifts bend the card too
  if (card.fx && card.fx.dmg && !card.school) card.school = h.def.school;
  return card;
}
// Synthetic move "card" — never shown in hand; movement is a figure-drag
// (or tap-the-hero, then tap a row).  Routed through playCard so EP cost,
// once-per-turn use, and execution flow stay identical to real cards.
function mkMoveAction(h) {
  return { kind: 'move', owner: h.id, ownerName: h.def.name, tint: h.def.tint,
    stance: STANCE[h.row].name, name: 'Move', cost: 1, target: 'row',
    desc: '', spent: S.used.has(h.id + ':move') };
}
function canMove(h) {
  return !S.executing && !S.over && !h.downed && S.ep >= 1 && !S.used.has(h.id + ':move');
}
function triadEntryFor(ids) {
  const classes = ids.map(id => HEROES[id].cls).sort().join('+');
  return RESONANT_TABLE[classes] || RESONANT_FALLBACK;
}
function triadEntry() { return triadEntryFor(livingHeroes().map(h => h.id)); }
function mkResonantCard(host) {
  const r = triadEntry();
  const key = trioClassKey(livingHeroes().map(h => h.id));
  const rank = vowRank(key);
  const uses = vowUses(key);
  const toNext = rank === 1 ? 1 - uses : rank === 2 ? 3 - uses : 0;
  return { kind: 'resonant', owner: 'triad', ownerName: host ? host.def.name : 'THE TRIAD',
    tint: 'var(--gold-bright)',
    stance: 'TEMPORARY', name: r.name + (rank > 1 ? ' ' + ROMAN[rank] : ''), cost: S.maxEp, target: 'none', fx: { resonant: true },
    desc: r.desc + (rank > 1 ? `  <span class="kw kw-rally">DEEPENED ×${rank - 1}</span> — the vow remembers.` : '')
      + (toNext > 0 ? `  (${toNext} more vow${toNext > 1 ? 's' : ''} deepens it)` : '')
      + '  Consumes your entire turn.', spent: false };
}

// ---------------------------------------------------------------------------
// PLAY — tap or drag.
// ---------------------------------------------------------------------------
function onCardTap(card) {
  if (S.executing || S.over || card.spent) return;
  if (card.cost > S.ep) { flashNarrator('Not enough EP.'); return; }
  if (card.kind === 'resonant' && !card.pair && S.ep < S.maxEp) {
    flashNarrator('The Vow needs your ENTIRE turn — play it first.');
    return;
  }
  const spec = targetSpec(card);
  if (spec.pick) { enterTargeting(card, spec.validIds, spec.hint); return; }
  playCard(card, null);
}
// What a card needs: pick=true → tap/drop a specific figure or row.
function targetSpec(card) {
  if (card.target === 'enemy') return { pick: true, validIds: livingEnemies().map(e => e.uid), hint: 'Choose an enemy' };
  if (card.target === 'ally') {
    const others = livingHeroes().filter(h => h.id !== card.owner).map(h => h.id);
    return { pick: true, validIds: others.length ? others : livingHeroes().map(h => h.id), hint: 'Choose an ally' };
  }
  if (card.target === 'row') {
    const owner = S.heroes.find(h => h.id === card.owner);
    return { pick: true, isRow: true, validIds: ROWS.filter(r => r !== owner.row).map(r => 'row:' + r), hint: 'Choose a row' };
  }
  return { pick: false };
}
function enterTargeting(card, validIds, hint, opts) {
  targeting = Object.assign({ card, validIds }, opts || {});
  if (validIds[0] && validIds[0].startsWith('row:')) targeting.isRow = true;
  $('#target-hint').textContent = hint + (targeting.drag ? '' : ' — tap a figure');
  $('#target-hint').classList.remove('hidden');
  renderBattlefield();
  renderThreads();
}
function cancelTargeting() {
  targeting = null;
  $('#target-hint').classList.add('hidden');
  renderAll();
}
function onFigureTap(id) {
  if (!targeting || targeting.isRow || targeting.drag) return;
  if (!targeting.validIds.includes(id)) { cancelTargeting(); return; }
  const card = targeting.card;
  targeting = null;
  $('#target-hint').classList.add('hidden');
  playCard(card, id);
}
function onRowTap(row) {
  if (!targeting || !targeting.isRow || targeting.drag) return;
  const card = targeting.card;
  if (!targeting.validIds.includes('row:' + row)) { cancelTargeting(); return; }
  targeting = null;
  $('#target-hint').classList.add('hidden');
  playCard(Object.assign({}, card, { toRow: row }), null);
}

// Drag-to-play (the mock's primary gesture).  pointerdown on a card arms it;
// movement past a threshold lifts the card and highlights valid targets;
// release over a target (or over the battlefield, for untargeted cards)
// plays it.  A short press-release without movement falls back to tap-play.
// Aim helpers — StS-style targeting: the card lifts, an arrow curves to the
// SNAPPED target (always the nearest valid one), and releasing anywhere in
// the field plays on it.  Loose, precise, and unmistakable about where a
// card lands.
const _AIMNS = 'http://www.w3.org/2000/svg';
function _sscale() { return ($('#stage').getBoundingClientRect().width / 760) || 1; }
function enemyFigEls() { return livingEnemies().map(e => figEl(e.uid)).filter(Boolean); }
function dragTargets(card) {
  const fx = card.fx || {};
  if (fx.resonant || fx.notToday || fx.bondPair) return { mode: 'field', els: [] };
  switch (card.target) {
    case 'enemy':     return { mode: 'enemy', els: enemyFigEls() };
    case 'frontmost': { const f = frontmostEnemy(); return { mode: 'enemy', els: f ? [figEl(f.uid)].filter(Boolean) : [] }; }
    case 'ally': {
      // Match targetSpec (the tap path): when the caster is the ONLY living
      // ally (e.g. Ash alone in the onboarding), an ally card falls back to
      // targeting yourself — otherwise Crossguard & friends can't be dropped.
      const others = livingHeroes().filter(h => h.id !== card.owner);
      const pool = others.length ? others : livingHeroes();
      return { mode: 'ally', els: pool.map(h => figEl(h.id)).filter(Boolean) };
    }
    case 'allies':    return { mode: 'party', els: livingHeroes().map(h => figEl(h.id)).filter(Boolean) };
    case 'self':      return { mode: 'self',  els: [figEl(card.owner)].filter(Boolean) };
    default:          return { mode: 'field', els: [] };
  }
}
// Which figures a field card (resonant vow / bond pair / Not Today) actually
// touches — so the aim can light them up instead of pointing at empty air.
function fieldTargets(card) {
  const fx = card.fx || {};
  if (fx.notToday)  return fx.notToday.map(id => figEl(id)).filter(Boolean);
  if (fx.bondPair)  return fx.bondPair.map(id => figEl(id)).filter(Boolean);
  if (fx.duet) {
    // The duet lights its OWN pair, plus every foe if a stage strikes.
    const dfx = {}; (duetFor(fx.pairIds[0], fx.pairIds[1]).stages || []).forEach(st => Object.assign(dfx, st.fx || {}));
    const els = fx.pairIds.map(id => figEl(id)).filter(Boolean);
    if (dfx.aoeDmg || dfx.hitFrontmost || dfx.markAll || dfx.markFront || dfx.lullAll) enemyFigEls().forEach(e => els.push(e));
    return els;
  }
  if (fx.resonant) {
    // The vow sweeps the whole board: rally the party, strike every foe.
    const rfx = {}; (triadEntry().stages || []).forEach(st => Object.assign(rfx, st.fx || {}));
    const hits = rfx.aoeDmg || rfx.dmg || rfx.hitFrontmost;
    const els = livingHeroes().map(h => figEl(h.id)).filter(Boolean);
    if (hits) enemyFigEls().forEach(e => els.push(e));
    return els;
  }
  return [];
}
function aimLayer() {
  let svg = document.getElementById('aim-layer');
  if (!svg) {
    svg = document.createElementNS(_AIMNS, 'svg');
    svg.id = 'aim-layer';
    svg.setAttribute('viewBox', '0 0 760 430');
    svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:55;overflow:visible';
    $('#stage').appendChild(svg);
  }
  return svg;
}
function aimClear() {
  const s = document.getElementById('aim-layer'); if (s) s.innerHTML = '';
  document.querySelectorAll('.fig-valid, .fig-snapped').forEach(f => f.classList.remove('fig-valid', 'fig-snapped'));
}
// School-tinted aim colour — the beam carries the card's element (JRPG flair).
const SCHOOL_AIM = { blade: '#e05a5a', light: '#f0d488', song: '#c8a0e0', iron: '#a8c8e8', frost: '#8ecbe8' };
function aimColor(card) {
  const fx = card.fx || {};
  if (fx.resonant) return '#f0d488';
  if (card.school) return SCHOOL_AIM[card.school] || '#f0d488';
  if (card.target === 'ally' || card.target === 'allies' || fx.heal || fx.guard || fx.bondPair || fx.notToday) return '#98d878';
  return '#f0d488';
}
function _cornerPath(cx, cy, r) {
  const L = 6;
  return [
    `M ${cx - r} ${cy - r + L} L ${cx - r} ${cy - r} L ${cx - r + L} ${cy - r}`,
    `M ${cx + r - L} ${cy - r} L ${cx + r} ${cy - r} L ${cx + r} ${cy - r + L}`,
    `M ${cx + r} ${cy + r - L} L ${cx + r} ${cy + r} L ${cx + r - L} ${cy + r}`,
    `M ${cx - r + L} ${cy + r} L ${cx - r} ${cy + r} L ${cx - r} ${cy + r - L}`,
  ].join(' ');
}
// A glowing energy ribbon (soft halo + bright core) ending in a rotating
// JRPG targeting reticle — distinct from Slay-the-Spire's flat arrow.
function drawAimJRPG(fx, fy, ex, ey, valid, field, angle, color, tech) {
  const svg = aimLayer();
  // The beam casts FROM THE CARD (its position, clamped to the stage as a
  // safety net).  The card is held in a lower-central zone by the drag clamp,
  // so the origin is always on-screen and reads as coming from the card you're
  // holding — not from a detached point.
  const cx = (v) => Math.max(6, Math.min(754, v)), cy = (v) => Math.max(6, Math.min(424, v));
  fx = cx(fx); fy = cy(fy); ex = cx(ex); ey = cy(ey);
  const bow = Math.min(60, Math.max(22, Math.abs(ex - fx) * 0.11));
  const midX = (fx + ex) / 2, midY = Math.max(10, Math.min(fy, ey) - bow);
  const path = `M ${fx} ${fy} Q ${midX} ${midY} ${ex} ${ey}`;
  const c = valid ? color : '#7a7060';
  let ret = '';
  if (valid && !field) {
    const R = 16;
    ret = `<g transform="rotate(${angle} ${ex} ${ey})"><rect x="${ex - R}" y="${ey - R}" width="${2 * R}" height="${2 * R}" rx="2" fill="none" stroke="${c}" stroke-width="1.6" opacity="0.85"/></g>`
        + `<g transform="rotate(${-angle * 0.7} ${ex} ${ey})"><path d="${_cornerPath(ex, ey, R + 5)}" fill="none" stroke="#fff6d8" stroke-width="2.4" stroke-linecap="round" style="filter:drop-shadow(0 0 4px ${c})"/></g>`
        + `<circle cx="${ex}" cy="${ey}" r="3" fill="#fff6d8" style="filter:drop-shadow(0 0 7px ${c})"/>`
        + (tech ? `<text x="${ex + R + 8}" y="${ey - R + 2}" font-size="15" fill="#ffe14a" style="filter:drop-shadow(0 0 5px rgba(255,225,74,0.9))">⚡</text>` : '');
  } else if (field) {
    ret = `<circle cx="${ex}" cy="${ey}" r="9" fill="none" stroke="${c}" stroke-width="2"><animate attributeName="r" values="7;12;7" dur="0.8s" repeatCount="indefinite"/></circle>`;
  }
  svg.innerHTML =
      `<path d="${path}" fill="none" stroke="${c}" stroke-width="9" stroke-linecap="round" opacity="0.22" style="filter:blur(3px)"/>`
    + `<path d="${path}" fill="none" stroke="${c}" stroke-width="4" stroke-linecap="round" opacity="0.5"/>`
    + `<path d="${path}" fill="none" stroke="#fff6d8" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="2 7" stroke-dashoffset="${-angle}" style="filter:drop-shadow(0 0 4px ${c})"/>`
    + ret;
}
// Field-card aim — a vow / bond touches MANY figures at once, so fan a thread
// out to each affected figure and ring it, rather than beaming into the void.
function drawAimField(fx, fy, pts, angle, color) {
  const svg = aimLayer();
  // origin from the card (clamped to the stage; the card is kept on-screen by
  // the drag clamp) so the fan reads as coming from the card, never off-screen
  fx = Math.max(6, Math.min(754, fx)); fy = Math.max(6, Math.min(424, fy));
  let s = '';
  pts.forEach(p => {
    const bow = Math.min(64, Math.max(20, Math.abs(p.x - fx) * 0.12));
    const midX = (fx + p.x) / 2, midY = Math.max(12, Math.min(fy, p.y) - bow);
    const path = `M ${fx} ${fy} Q ${midX} ${midY} ${p.x} ${p.y}`;
    s += `<path d="${path}" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" opacity="0.18" style="filter:blur(2.5px)"/>`
       + `<path d="${path}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round" opacity="0.55"/>`
       + `<path d="${path}" fill="none" stroke="#fff6d8" stroke-width="1.2" stroke-linecap="round" stroke-dasharray="2 6" stroke-dashoffset="${-angle}" style="filter:drop-shadow(0 0 3px ${color})"/>`
       + `<circle cx="${p.x}" cy="${p.y}" r="7" fill="none" stroke="${color}" stroke-width="1.8"><animate attributeName="r" values="6;10;6" dur="0.8s" repeatCount="indefinite"/></circle>`
       + `<circle cx="${p.x}" cy="${p.y}" r="2.4" fill="#fff6d8" style="filter:drop-shadow(0 0 5px ${color})"/>`;
  });
  svg.innerHTML = s;
}

// Damped, finger-following card drag with a JRPG aim ribbon.  A RAF loop
// eases the card toward the pointer (weighted tilt from velocity) and eases
// the beam's endpoint toward the SNAPPED target — loose to aim, fluid to feel.
function attachDrag(el, card) {
  let pid = null, dragging = false, startX = 0, startY = 0;
  let ptrX = 0, ptrY = 0, originX = 0, originY = 0;
  let curTX = 0, curTY = 0, curEX = 0, curEY = 0, vel = 0, angle = 0, raf = 0;
  let snapped = null, _aimTech = false, holdT = null, inspecting = false;
  let canSac = false, canPlay = false, overEp = false, winUp = null;
  const sc = () => _sscale();
  // Is the pointer over the EP dial (the sacrifice drop-target)?  Generous pad.
  const epOrbHit = (x, y) => {
    const o = $('#ep-dial'); if (!o) return false;
    const r = o.getBoundingClientRect(); const pad = Math.max(r.width, 26) * 0.6;
    return x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;
  };
  const disarmEp = () => { const c = $('#ep-cluster'); if (c) c.classList.remove('ep-armed', 'ep-sac-hot'); };

  el.addEventListener('pointerdown', (e) => {
    if (S.executing || S.over) return;
    if (pid !== null) return;   // a gesture is already in flight — don't let a second touch hijack it
    pid = e.pointerId; startX = e.clientX; startY = e.clientY; ptrX = e.clientX; ptrY = e.clientY; dragging = false; inspecting = false;
    try { el.setPointerCapture(pid); } catch (_) {}
    // SAFETY NET — if a re-render swaps this card out or capture is lost, the
    // card's own pointerup never fires and the aim beam/raf would stick.  A
    // window capture listener guarantees finish() ALWAYS runs on release.
    if (winUp) { window.removeEventListener('pointerup', winUp, true); window.removeEventListener('pointercancel', winUp, true); }
    winUp = (ev) => finish(ev);
    window.addEventListener('pointerup', winUp, true);
    window.addEventListener('pointercancel', winUp, true);
    // PRESS & HOLD to INSPECT — a big MtG-style enlarge of the card (works on
    // any card, even one you can't afford or have spent).  A drag or a quick
    // release cancels it.
    clearTimeout(holdT);
    holdT = setTimeout(() => {
      if (pid !== null && !dragging) {
        inspecting = true;
        // Close-from-anywhere safety net: if the ending pointerup never reaches
        // this card (capture lost, a re-render swapped the element, a stray
        // second touch), the inspect + gesture would otherwise stick open.  The
        // window listener guarantees release ALWAYS clears both.
        showCardInspect(card, el, () => {
          inspecting = false;
          const held = pid; pid = null;
          if (held !== null) { try { el.releasePointerCapture(held); } catch (_) {} }
          cancelAnimationFrame(raf);
        });
      }
    }, 340);
    e.preventDefault();
  });
  el.addEventListener('pointermove', (e) => {
    if (pid === null || e.pointerId !== pid) return;
    ptrX = e.clientX; ptrY = e.clientY;
    if (!dragging && !inspecting) {
      if (Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY) < 12) return;
      clearTimeout(holdT);
      // You can drag a card to PLAY it (affordable) or to SACRIFICE it onto the
      // EP dial for +1 EP (once per turn).  Only deny if it can do neither.
      canPlay = !card.spent && card.cost <= S.ep;
      canSac  = !card.spent && !S.channelUsed && card.kind !== 'resonant' && card.kind !== 'move';
      if (!canPlay && !canSac) { if (card.cost > S.ep) denyCard(el, card); pid = null; try { el.releasePointerCapture(e.pointerId); } catch (_) {} return; }
      dragging = true;
      el.classList.add('card-dragging');
      el.style.transition = 'none';
      if (canSac) { const cl = $('#ep-cluster'); if (cl) cl.classList.add('ep-armed'); }   // invite the sacrifice
      const r = el.getBoundingClientRect();
      originX = r.left + r.width / 2; originY = r.top + r.height / 2;
      const sr = $('#stage').getBoundingClientRect();
      curTX = 0; curTY = 0; curEX = (ptrX - sr.left) / sc(); curEY = (ptrY - sr.top) / sc();
      const dt = dragTargets(card);
      const lit = dt.mode === 'field' ? fieldTargets(card) : dt.els;
      lit.forEach(t => t.classList.add('fig-valid'));
      if (dt.mode === 'field') {
        const hint = $('#target-hint');
        hint.textContent = card.kind === 'resonant' ? 'RELEASE TO UNLEASH THE VOW' : 'RELEASE TO SEAL THE BOND';
        hint.classList.remove('hidden');
      }
      loop();
    }
  });
  function loop() {
    raf = requestAnimationFrame(loop);
    if (!dragging) return;
    const sr = $('#stage').getBoundingClientRect(), s = sc();
    // ease the card toward the finger
    const tgtTX = (ptrX - originX) / s, tgtTY = (ptrY - originY) / s;
    const nx = curTX + (tgtTX - curTX) * 0.26, ny = curTY + (tgtTY - curTY) * 0.26;
    vel = vel * 0.72 + (nx - curTX) * 0.28;
    curTX = nx; curTY = ny;
    // Keep the CARD parked in a comfortable LOWER-CENTRAL zone as it lifts — it
    // leans a little toward the finger but never flies to a corner or off the
    // page.  Only the beam + reticle follow the finger to aim, so targeting is
    // unaffected however far you drag.  (A previous clamp was far too loose —
    // 12% from the edge / 34% from the top — so flicking up-left parked the card
    // in the corner and the beam appeared to shoot in from off-screen.)
    const W = sr.width, H = sr.height;
    const vw = (typeof window !== 'undefined' && window.innerWidth) || sr.right;
    const vh = (typeof window !== 'undefined' && window.innerHeight) || sr.bottom;
    const cx = (sr.left + sr.right) / 2;
    let scx = originX + curTX * s, scy = originY + curTY * s;
    scx = Math.max(cx - W * 0.22, Math.min(cx + W * 0.22, scx));            // stay within a central band
    scy = Math.max(sr.top + H * 0.40, Math.min(sr.bottom - H * 0.03, scy)); // lifts well up, still on-screen
    curTX = (scx - originX) / s; curTY = (scy - originY) / s;
    const tilt = Math.max(-15, Math.min(15, vel * 1.5));
    el.style.transform = `translate(${curTX}px, ${curTY}px) rotate(${tilt}deg) scale(1.07)`;
    // GUARANTEE the whole card stays on screen: measure the actual rendered box
    // (transform-origin + tilt + the 1.07 lift make a predictive clamp unreliable)
    // and push it back inside min(stage, viewport) with a small pad.  This is
    // what finally kills the off-screen-drag glitch.
    {
      const b = el.getBoundingClientRect();
      const padL = Math.max(sr.left, 0) + 4, padR = Math.min(sr.right, vw) - 4;
      const padT = sr.top + 4, padB = Math.min(sr.bottom, vh) - 4;
      let cx = 0, cy = 0;
      if (b.left < padL) cx = padL - b.left; else if (b.right > padR) cx = padR - b.right;
      if (b.top < padT) cy = padT - b.top;  else if (b.bottom > padB) cy = padB - b.bottom;
      if (cx || cy) {
        curTX += cx / s; curTY += cy / s;
        el.style.transform = `translate(${curTX}px, ${curTY}px) rotate(${tilt}deg) scale(1.07)`;
      }
    }
    // snapped target
    const { mode, els } = dragTargets(card);
    document.querySelectorAll('.fig-snapped').forEach(f => f.classList.remove('fig-snapped'));
    // SACRIFICE zone — over the EP dial: light it, drop the aim beam, prompt.
    overEp = canSac && epOrbHit(ptrX, ptrY);
    { const cl = $('#ep-cluster'); if (cl) cl.classList.toggle('ep-sac-hot', overEp); }
    if (overEp) {
      snapped = null; aimClear();
      const hint = $('#target-hint'); hint.textContent = 'SACRIFICE · feed the card for +1 EP'; hint.classList.remove('hidden');
      return;
    }
    if (mode !== 'field' && !targeting) { const h = $('#target-hint'); if ((h.textContent || '').indexOf('SACRIFICE') === 0) h.classList.add('hidden'); }
    let ex, ey, valid, field = false;
    const cr = el.getBoundingClientRect();
    const fromX = (cr.left + cr.width / 2 - sr.left) / s, fromY = (cr.top - sr.top) / s + 2;
    if (mode === 'field') {
      // A field card touches many figures — thread the beam to each of them
      // and ring them, rather than a lone arrow pointing at nothing.
      snapped = '__field__';
      const pts = fieldTargets(card).map(t => {
        t.classList.add('fig-snapped');
        const r = t.getBoundingClientRect();
        return { x: (r.left + r.width / 2 - sr.left) / s, y: (r.top + r.height * 0.4 - sr.top) / s };
      });
      angle = (angle + 3) % 360;
      drawAimField(fromX, fromY, pts, angle, aimColor(card));
      return;
    } else {
      let best = null, bd = Infinity;
      els.forEach(t => { const r = t.getBoundingClientRect(); const d = (r.left + r.width / 2 - ptrX) ** 2 + (r.top + r.height / 2 - ptrY) ** 2; if (d < bd) { bd = d; best = t; } });
      snapped = best; if (best) best.classList.add('fig-snapped');
      valid = !!best;
      if (best) { const r = best.getBoundingClientRect(); ex = (r.left + r.width / 2 - sr.left) / s; ey = (r.top + r.height * 0.4 - sr.top) / s; }
      else { ex = (ptrX - sr.left) / s; ey = (ptrY - sr.top) / s; }
      // TECHNICAL preview — aiming a damaging card at a PRIMED foe (chilled or
      // weakened, off its weakness line) will detonate.  Rather than a flashing
      // banner, the RETICLE itself goes electric-yellow with a ⚡ — a quiet,
      // in-place cue on the very thing you're aiming at.
      document.querySelectorAll('.fig-tech-aim').forEach(f => f.classList.remove('fig-tech-aim'));
      _aimTech = false;
      if (best && best.dataset.fig && card.fx && (card.fx.dmg || card.fx.hitFrontmost)) {
        const te = S.enemies.find(x => x.uid === best.dataset.fig);
        if (te && (te.lull || te.weakened) && !(card.school && card.school === te.def.weak)) { _aimTech = true; best.classList.add('fig-tech-aim'); }
      }
    }
    curEX += (ex - curEX) * 0.34; curEY += (ey - curEY) * 0.34;
    angle = (angle + 3) % 360;
    drawAimJRPG(fromX, fromY, curEX, curEY, valid, field, angle, _aimTech ? '#ffe14a' : aimColor(card), _aimTech);
  }
  const finish = (e) => {
    if (pid === null || (e && e.pointerId !== pid)) return;   // ignore stray / second-pointer releases
    if (winUp) { window.removeEventListener('pointerup', winUp, true); window.removeEventListener('pointercancel', winUp, true); winUp = null; }
    clearTimeout(holdT);
    try { el.releasePointerCapture(pid); } catch (_) {}
    pid = null; cancelAnimationFrame(raf);
    if (inspecting) { inspecting = false; hideCardInspect(); return; }   // release from inspect — don't play
    if (!dragging) { onCardTap(card); return; }
    dragging = false;
    el.classList.remove('card-dragging');
    aimClear();
    disarmEp();
    document.querySelectorAll('.fig-tech-aim').forEach(f => f.classList.remove('fig-tech-aim'));
    if (!targeting) { $('#target-hint').classList.add('hidden'); $('#target-hint').classList.remove('th-tech'); }
    // SACRIFICE — released over the EP dial → feed the card for +1 EP.
    if (canSac && epOrbHit(e.clientX, e.clientY)) { channelCard(card); return; }
    const handTop = $('#hand').getBoundingClientRect().top;
    const cancelled = e.clientY > handTop - 8;
    const { mode } = dragTargets(card);
    if (!cancelled && mode === 'field') {
      if (card.kind === 'resonant' && !card.pair && S.ep < S.maxEp) { flashNarrator('The Vow needs your ENTIRE turn — play it first.'); springBack(el); return; }
      playCard(card, null); return;
    }
    if (!cancelled && snapped && snapped.dataset) { playCard(card, snapped.dataset.fig); return; }
    springBack(el);   // released in the hand or on nothing — ease home
  };
  el.addEventListener('pointerup', finish);
  el.addEventListener('pointercancel', finish);
}
// PRESS & HOLD INSPECT — a big, readable enlarge of the card (Magic-style), a
// clone of the real card so it's pixel-faithful, over a dimmed/blurred field.
function showCardInspect(card, el, onClose) {
  hideCardInspect();
  const wrap = document.createElement('div');
  wrap.id = 'card-inspect';
  const clone = el.cloneNode(true);
  clone.className = 'card kind-' + card.kind + ' ci-card';
  clone.removeAttribute('style');
  clone.style.setProperty('--tint', card.tint || 'var(--gold)');
  const ch = clone.querySelector('.card-channel'); if (ch) ch.remove();
  const scrim = document.createElement('div'); scrim.className = 'ci-scrim';
  const hint = document.createElement('div'); hint.className = 'ci-hint'; hint.textContent = 'release to close';
  wrap.appendChild(scrim); wrap.appendChild(clone); wrap.appendChild(hint);
  $('#stage').appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add('ci-on'));
  try { haptic(HAP.press); } catch (_) {}
  // Release ANYWHERE closes the inspect and runs the gesture cleanup — a window
  // capture listener fires before (and independently of) the card's own pointerup,
  // so a lost capture or swapped element can never leave the overlay stuck open.
  const close = () => {
    window.removeEventListener('pointerup', close, true);
    window.removeEventListener('pointercancel', close, true);
    hideCardInspect();
    if (onClose) onClose();
  };
  window.addEventListener('pointerup', close, true);
  window.addEventListener('pointercancel', close, true);
}
function hideCardInspect() { const el = document.getElementById('card-inspect'); if (el) el.remove(); }
// Denial feedback for an unaffordable card — a short shake + a reason.
function denyCard(el, card) {
  el.classList.remove('card-deny'); void el.offsetWidth; el.classList.add('card-deny');
  setTimeout(() => el.classList.remove('card-deny'), 400);
  const need = card.cost - S.ep;
  flashNarrator(`Not enough EP — ${card.name} needs ${card.cost} (${need} more).`);
  try { SFX.deny && SFX.deny(); } catch (_) {}
}
// Spring the card back to its fan position, then re-render.
function springBack(el) {
  el.style.transition = 'transform 0.26s cubic-bezier(0.34, 1.5, 0.5, 1)';
  el.style.transform = '';
  setTimeout(() => renderAll(), 240);
}

// Drag a HERO to reposition them (1 EP, once per hero per turn).  A short
// tap instead opens the tap-to-move row picker — unless a card is currently
// targeting, in which case the tap is the target pick.
function attachHeroDrag(fig, hero) {
  let startX = 0, startY = 0, dragging = false, pid = null;
  const scale = () => ($('#stage').getBoundingClientRect().width / 760) || 1;
  const highlight = (on) => {
    document.querySelectorAll('#party-half .slot').forEach(sl => {
      sl.classList.toggle('slot-droppable', on && sl.dataset.row !== hero.row);
    });
    const hint = $('#target-hint');
    if (on) { hint.textContent = 'Move ' + hero.def.name + ' — drop on a row'; hint.classList.remove('hidden'); }
    else if (!targeting) hint.classList.add('hidden');
  };
  fig.addEventListener('pointerdown', (e) => {
    if (targeting) return;                    // a card is picking targets — let the tap through
    pid = e.pointerId;
    startX = e.clientX; startY = e.clientY; dragging = false;
    try { fig.setPointerCapture(pid); } catch (_) {}
  });
  fig.addEventListener('pointermove', (e) => {
    if (pid === null) return;
    const dx = e.clientX - startX, dy = e.clientY - startY;
    if (!dragging) {
      if (Math.abs(dx) + Math.abs(dy) < 14) return;
      if (!canMove(hero)) { pid = null; flashNarrator(S.used.has(hero.id + ':move') ? hero.def.name + ' has already moved this turn.' : 'Not enough EP to move.'); return; }
      dragging = true;
      fig.classList.add('fig-dragging');
      fig.style.transition = 'none';
      highlight(true);
    }
    fig.style.transform = `translate(${dx / scale()}px, ${dy / scale()}px)`;
  });
  const finish = (e) => {
    if (pid === null) return;
    try { fig.releasePointerCapture(pid); } catch (_) {}
    pid = null;
    if (!dragging) {
      // tap: target pick beats move; otherwise open the row picker
      if (targeting) { onFigureTap(hero.id); return; }
      if (!canMove(hero)) return;
      enterTargeting(mkMoveAction(hero), ROWS.filter(r => r !== hero.row).map(r => 'row:' + r), 'Move ' + hero.def.name);
      return;
    }
    dragging = false;
    fig.classList.remove('fig-dragging');
    fig.style.transition = '';
    fig.style.transform = '';
    highlight(false);
    fig.style.pointerEvents = 'none';
    const under = document.elementFromPoint(e.clientX, e.clientY);
    fig.style.pointerEvents = '';
    const slot = under && under.closest ? under.closest('#party-half .slot[data-row]') : null;
    if (slot && slot.dataset.row !== hero.row && canMove(hero)) {
      playCard(Object.assign({}, mkMoveAction(hero), { toRow: slot.dataset.row }), null);
      return;
    }
    renderAll();
  };
  fig.addEventListener('pointerup', finish);
  fig.addEventListener('pointercancel', finish);
}

// Visual: the played card lifts out of the fan and flies toward its target
// (or the field's center), shrinking and fading as the effect lands.
function flyCard(cardName, targetEl) {
  const el = document.querySelector(`#hand .card[data-card-name="${CSS.escape(cardName)}"]`);
  if (!el) return;
  const stage = $('#stage');
  const sr = stage.getBoundingClientRect();
  const scale = sr.width / 760 || 1;
  const r = el.getBoundingClientRect();
  const ghost = el.cloneNode(true);
  ghost.className = el.className + ' card-ghost';
  ghost.style.cssText = `position:absolute; margin:0; z-index:120; pointer-events:none;
    left:${(r.left - sr.left) / scale}px; top:${(r.top - sr.top) / scale}px;
    width:${r.width / scale}px; height:${r.height / scale}px; transform:none;`;
  $('#popup-layer').appendChild(ghost);
  const tr = (targetEl || $('#battlefield')).getBoundingClientRect();
  const dx = (tr.left + tr.width / 2 - (r.left + r.width / 2)) / scale;
  const dy = (tr.top + tr.height / 2 - (r.top + r.height / 2)) / scale;
  // WEIGHT — a quick wind-up POP, then the card is HURLED at the target and
  // shrinks into the blow, so a play lands with intent instead of drifting off.
  requestAnimationFrame(() => {
    ghost.style.transition = 'transform 0.1s ease-out';
    ghost.style.transform = 'scale(1.13) rotate(-2deg)';
    setTimeout(() => {
      ghost.style.transition = 'transform 0.4s cubic-bezier(0.4, 1.3, 0.5, 1), opacity 0.4s ease';
      ghost.style.transform = `translate(${dx}px, ${dy}px) scale(0.24) rotate(5deg)`;
      ghost.style.opacity = '0';
    }, 100);
  });
  setTimeout(() => ghost.remove(), 560);
}

// Visual: a DISCARDED card burns away where it sat — desaturating to ash,
// crumpling and drifting down with a warm ember glow — so channeling reads as
// "this card is gone, spent for fuel," not a card that silently vanished.
function dissolveCard(cardName) {
  const el = document.querySelector(`#hand .card[data-card-name="${CSS.escape(cardName)}"]`);
  if (!el) return;
  const sr = $('#stage').getBoundingClientRect();
  const scale = sr.width / 760 || 1;
  const r = el.getBoundingClientRect();
  const ghost = el.cloneNode(true);
  const ch = ghost.querySelector('.card-channel'); if (ch) ch.remove();
  ghost.className = el.className.replace('card-dragging', '') + ' card-dissolve';
  ghost.style.cssText = `position:absolute; margin:0; z-index:118; pointer-events:none;
    left:${(r.left - sr.left) / scale}px; top:${(r.top - sr.top) / scale}px;
    width:${r.width / scale}px; height:${r.height / scale}px; transform:none;`;
  const layer = $('#popup-layer');
  layer.appendChild(ghost);
  // A little rising ash so the eye follows the card out of play.
  for (let i = 0; i < 5; i++) {
    const em = document.createElement('span');
    em.className = 'discard-ash';
    em.style.left = ((r.left - sr.left) / scale + 20 + Math.random() * (r.width / scale - 40)) + 'px';
    em.style.top = ((r.top - sr.top) / scale + 40 + Math.random() * 60) + 'px';
    em.style.animationDelay = (i * 60) + 'ms';
    layer.appendChild(em);
    setTimeout(() => em.remove(), 900);
  }
  setTimeout(() => ghost.remove(), 640);
}

// CHANNEL — DISCARD any card for +1 EP (once per turn): the pressure valve
// that means no card is ever truly dead.  A heal at full HP, a finisher with
// nothing to finish — feed it to the fire and buy a better play.
function channelCard(card) {
  if (S.executing || S.over || S.channelUsed || card.spent) return;
  if (card.kind === 'resonant') { flashNarrator('The vow cannot be spent for scraps.'); return; }
  S.channelUsed = true;
  dissolveCard(card.name);            // burn the discarded card away, visibly
  if (card.temp) S.tempCards = S.tempCards.filter(t => t.uid !== card.uid);
  else if (card.owner !== 'triad') S.used.add(card.owner + ':' + card.kind);
  S.ep = Math.min(S.maxEp + 2, S.ep + 1);
  pulseEp();
  SFX.move();
  flashNarrator(card.ownerName + ' DISCARDS ' + card.name + ' to the fire — +1 EP.');
  popupAt($('#ep-dial'), '+1 EP', 'rally');
  renderAll();
}

async function playCard(card, targetId) {
  if (S.executing || S.over) return;
  haptic(HAP.play);
  S.executing = true;
  $('#stage').classList.add('executing');
  S.ep -= card.cost;
  if (card.temp) S.tempCards = S.tempCards.filter(t => t.uid !== card.uid);
  else if (card.owner !== 'triad') S.used.add(card.owner + ':' + card.kind);
  if (card.kind !== 'move') {
    SFX.card();
    flyCard(card.name, targetId ? figEl(targetId) : (card.target === 'frontmost' && frontmostEnemy() ? figEl(frontmostEnemy().uid) : null));
  } else { SFX.move(); }
  pulseEp();
  renderAll();
  await resolveCard(card, targetId);
  if (card.kind !== 'move') hexBurn(card);   // a hexed hero's card play eats another card
  S.executing = false;
  $('#stage').classList.remove('executing');
  renderAll();
  checkEnd();
}
// HEX (the Maw's curse) — when a hexed hero plays a card, a RANDOM other card in
// the hand burns away.  Balatro-flavoured: your options are eaten as you act.
function hexBurn(playedCard) {
  const owner = playedCard && S.heroes.find(h => h.id === playedCard.owner);
  if (!owner || !(owner.hexed > 0)) return;
  const pool = buildHand().filter(c => c.kind !== 'move' && c.kind !== 'resonant' && !c.spent
    && !(c.owner === playedCard.owner && c.kind === playedCard.kind && !c.temp)   // not the just-played core/sig
    && !(c.temp && c.uid === playedCard.uid));                                     // not the just-played temp
  if (!pool.length) return;
  const victim = pool[Math.floor(Math.random() * pool.length)];
  if (victim.temp) S.tempCards = S.tempCards.filter(t => t.uid !== victim.uid);
  else if (victim.owner !== 'triad') S.used.add(victim.owner + ':' + victim.kind);
  dissolveCard(victim.name);
  popupAt(figEl(owner.id), '☠ HEX burns ' + victim.name, 'dmg');
  if (SFX.deny) SFX.deny();
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function resolveCard(card, targetId) {
  const owner = S.heroes.find(h => h.id === card.owner);
  if (owner && owner.downed) return;

  if (card.kind === 'move') {
    const from = owner.row;
    const occupant = livingHeroes().find(h => h.id !== owner.id && h.row === card.toRow);
    owner.row = card.toRow;
    if (occupant) occupant.row = from;
    onHeroEnterRow(owner, card.toRow, from);
    // The departed stance lingers: a fading echo of its core, THIS TURN only.
    // Movement converts tempo into an extra weaker action — and the echo
    // keeps the OLD stance's strike, so stance-dancing can line up
    // same-element pairs for staggers.
    const oldCore = owner.def.cards[from].core;
    if (oldCore.fx && oldCore.fx.dmg) {
      genTempCard({ kind: 'temp', owner: owner.id, ownerName: owner.def.name, tint: owner.def.tint,
        stance: 'AFTERIMAGE', name: 'Echo: ' + oldCore.name, cost: 0, target: oldCore.target,
        school: owner.def.school, fx: { dmg: Math.max(2, oldCore.fx.dmg - 2) }, expiresTurn: S.turn,
        desc: `<b>Free.</b> The stance you left behind strikes once more for ${Math.max(2, oldCore.fx.dmg - 2)} — then fades with the turn.` });
    }
    S._morphHeroId = owner.id;
    if (occupant) S._morphHeroId2 = occupant.id;
    renderAll();
    popupAt(figEl(owner.id), STANCE[card.toRow].name.toUpperCase(), 'info');
    if (occupant) popupAt(figEl(occupant.id), 'SWAP', 'info');
    await sleep(340);
    return;
  }

  if (card.kind === 'resonant') { if (card.pair) { await resolveDuet(card); return; } await resolveResonant(); return; }

  const fx = card.fx || {};
  if (fx.notToday) {
    const [prId, wdId] = fx.notToday;
    const pr = S.heroes.find(x => x.id === prId);
    const wd = S.heroes.find(x => x.id === wdId);
    if (!pr || pr.downed || !wd || wd.downed) { flashNarrator('The moment has passed.'); return; }
    // Bodies move: the protector steps into the fire.
    const prRow = pr.row;
    pr.row = wd.row;
    wd.row = prRow;
    S._morphHeroId = prId;
    S._morphHeroId2 = wdId;
    wd.hp = Math.min(wd.maxHp, wd.hp + 4);
    pr.guard += 4;
    pr.counter = Math.max(pr.counter, 2);
    pr.chill = (pr.chill || 0) + 2;   // the cost: the next strike comes slower
    renderAll();
    popupAt(figEl(prId), 'NOT TODAY', 'info');
    popupAt(figEl(wdId), '+4', 'heal');
    popupAt(figEl(prId), '❄ OVEREXTENDED −2', 'chill');
    SFX.guard();
    await addThread(prId, wdId);   // protecting is a bond act
    await sleep(400);
    return;
  }
  if (fx.bondPair) {
    fx.bondPair.forEach(id => {
      const h = S.heroes.find(x => x.id === id);
      if (!h || h.downed) return;
      h.guard += fx.bondGuard;
      h.buffDmg += fx.bondRally;
      popupAt(figEl(id), '⛨ ' + fx.bondGuard + ' · ▲ ' + fx.bondRally, 'guard');
    });
    SFX.thread();
    await sleep(300);
    return;
  }
  if (fx.dmg) {
    let tgt = null;
    if (card.target === 'frontmost') tgt = frontmostEnemy();
    else if (card.target === 'enemy') tgt = livingEnemies().find(e => e.uid === targetId) || frontmostEnemy();
    if (tgt) {
      let amt = fx.dmg + (owner ? owner.buffDmg : 0);
      if (owner && owner.buffDmg) { popupAt(figEl(owner.id), '▲ RALLY +' + owner.buffDmg, 'rally'); owner.buffDmg = 0; }
      if (owner && owner.chill) { amt = Math.max(0, amt - owner.chill); popupAt(figEl(owner.id), '❄ −' + owner.chill, 'chill'); owner.chill = 0; }
      amt += tgt.mark || 0;
      amt += passiveDmg(owner, tgt);   // EXPOSED-exploiter passives (Opportunist / Hunter's Focus)
      // subtle feedback when a damage-tuning BOON is lifting this hit (chip pulse, no popup spam)
      if (owner) runBoons().forEach(b => { if (b.trigger === 'dmgMod' && b.mod && (b.mod(owner, tgt) || 0) > 0) boonProc(owner.id, b.id, { quiet: true }); });
      // FOLLOW-UP: striking an enemy an ally already hit this turn is a
      // combo — +2 damage, and fighting together forms a thread between
      // the two attackers (Concept 3: following up strengthens bonds).
      const hitters = tgt._hitBy || (tgt._hitBy = []);
      const prev = hitters.length ? hitters[hitters.length - 1] : null;
      const isFollowUp = !!(owner && prev && prev !== owner.id);
      if (isFollowUp) amt += 2;
      dealToEnemy(tgt, amt, owner ? owner.def.school : null, owner ? owner.id : null);
      if (owner && !tgt.dead) firePassives('postHit', owner.id, { tgt });   // execute thresholds (Death Mark)
      if (owner) {
        hitters.push(owner.id);
        fireEmergent(owner.id, 'hit', card);
        if (tgt.dead) { fireEmergent(owner.id, 'kill', card); firePassives('kill', owner.id, { tgt }); }
      }
      if (isFollowUp) {
        gainMomentum(12, { combo: true });   // LINK — chaining allies builds burst
        linkPopup(owner.id);
        popupAt(figEl(owner.id), '⚡ FOLLOW-UP +2', 'info');
        SFX.follow();
        firePassives('followup', owner.id, { ally: prev });   // ally = the hero Ash followed
        // GANGING UP binds the whole party: thread with EVERY ally who has
        // struck this foe this turn, not just the last — so focus-firing one
        // enemy (the natural strong play) weaves the full triangle instead of
        // leaving the triad's marquee moment locked behind fussy pick order.
        const priorAllies = hitters.filter((id, i) => id !== owner.id && hitters.indexOf(id) === i);
        for (const ally of priorAllies) await addThread(owner.id, ally);
      }
      // AVENGE: cutting down an enemy that hurt an ally this fight forms a
      // thread with the one you avenged — protective aggression bonds too.
      if (tgt.dead && owner) {
        const wounded = (tgt._damaged || []).filter(id => id !== owner.id && livingHeroes().some(h => h.id === id));
        if (wounded.length) {
          const avenged = wounded[wounded.length - 1];
          popupAt(figEl(owner.id), '⚔ AVENGED', 'info');
          await addThread(owner.id, avenged);
        }
      }
      if (tgt.dead) await sleep(140);   // hitstop: let the kill land
    } else {
      flashNarrator('No target in reach — the cut finds only air.');
    }
  }
  if (fx.mark) {
    const tgt = livingEnemies().find(e => e.uid === targetId);
    if (tgt) { tgt.mark = fx.mark; popupAt(figEl(tgt.uid), '◎ EXPOSED +' + fx.mark, 'info'); if (owner) fireEmergent(owner.id, 'expose', card); }
  }
  if (fx.lull) {
    const tgt = card.target === 'enemy' ? (livingEnemies().find(e => e.uid === targetId) || frontmostEnemy()) : frontmostEnemy();
    if (tgt) { tgt.lull = (tgt.lull || 0) + fx.lull; popupAt(figEl(tgt.uid), '❄ CHILL −' + fx.lull, 'chill'); }
  }
  if (fx.heal || fx.guard || fx.buffDmg || fx.counter) {
    let receivers = [];
    if (card.target === 'ally')   receivers = [S.heroes.find(h => h.id === targetId)].filter(Boolean);
    if (card.target === 'self')   receivers = [owner];
    if (card.target === 'allies') receivers = livingHeroes();
    if (card.target === 'frontmost' && fx.guard) receivers = [owner];
    for (const rc of receivers) {
      if (!rc || rc.downed) continue;
      if (fx.heal) {
        const room = rc.maxHp - rc.hp, healed = Math.min(room, fx.heal), spill = fx.heal - healed;
        rc.hp += healed;
        if (healed) popupAt(figEl(rc.id), '✚' + healed, 'heal');
        if (spill) {
          // overheal shields — and Elin's RADIANT OVERFLOW spreads the spill to
          // the WHOLE party instead of pooling on one target.
          if (owner && owner.id === 'elin' && hasNode('elin.passive.overflow')) {
            livingHeroes().forEach(h => { h.guard += spill; popupAt(figEl(h.id), '⛨' + spill, 'guard'); });
          } else { rc.guard += spill; popupAt(figEl(rc.id), '⛨' + spill, 'guard'); }
        }
        SFX.heal();
      }
      if (fx.guard)  { rc.guard += fx.guard; popupAt(figEl(rc.id), '⛨ ' + fx.guard, 'guard'); SFX.guard(); }
      if (fx.buffDmg){ rc.buffDmg += fx.buffDmg; popupAt(figEl(rc.id), '▲ RALLY +' + fx.buffDmg, 'rally'); }
      if (fx.counter){ rc.counter = Math.max(rc.counter, fx.counter); }
      // TEAM SYNERGY: warding/mending an ally can bless their next strike (Elin's Blessed Edge)
      if (owner && (fx.heal || fx.guard)) firePassives('support', owner.id, { receiver: rc });
      // A shared act BONDS: helping an ally forms a thread.  A PARTY-wide ward or
      // heal (target 'allies') weaves the caster to EVERYONE it shelters — so a
      // support hero's whole role knits the triangle, and the triad's marquee
      // moment is reachable through ordinary play instead of fussy pick order.
      if (owner && rc.id !== owner.id && (card.target === 'ally' || card.target === 'allies')) await addThread(owner.id, rc.id);
    }
    // one emergent tick per PLAY (not per receiver): the caster's mending / warding loop
    if (owner && receivers.length) {
      if (fx.heal)  fireEmergent(owner.id, 'heal', card);
      if (fx.guard) fireEmergent(owner.id, 'guard', card);
    }
  }
  // Movement built into the action: the caster repositions after resolving,
  // free (no EP, no move-use).  The hand morphs to the new stance.
  //   step — slip ONE row toward front/back.
  //   warp — jump straight to a named row (e.g. a "vanish" to BACK).
  if ((fx.step || fx.warp) && owner && !owner.downed) {
    let to;
    if (fx.warp) to = fx.warp;
    else { const idx = ROWS.indexOf(owner.row); to = fx.step === 'front' ? ROWS[Math.max(0, idx - 1)] : ROWS[Math.min(2, idx + 1)]; }
    if (ROWS.indexOf(to) >= 0 && to !== owner.row) {
      const occ = livingHeroes().find(h => h.id !== owner.id && h.row === to);
      const from = owner.row; owner.row = to; if (occ) occ.row = from;
      onHeroEnterRow(owner, to, from);
      S._morphHeroId = owner.id; if (occ) S._morphHeroId2 = occ.id;
      renderAll();
      popupAt(figEl(owner.id), (fx.warp ? '✦ ' : '⇄ ') + STANCE[to].name.toUpperCase(), 'info');
      SFX.move();
      await sleep(320);
    }
  }
  await sleep(280);
}

// Single source of truth for how hard an enemy intent hits — base + power,
// scaled by the fight's difficulty multiplier, then reduced by CHILL.  Used by
// the enemy turn AND both telegraphs (intent bubble + threat forecast) so what
// you're shown is exactly what lands.
function enemyIntentDmg(e, intent) {
  const scaled = Math.round(((intent.dmg || 0) + (e.power || 0)) * (e.dmgMul || 1));
  return Math.max(0, scaled - (e.lull || 0));
}
// The intents an enemy will execute on its COMING turn (one, or two for a boss
// that strikes twice).  Drives both the telegraph and the resolution so what is
// shown is exactly what lands.
function enemyNextIntents(e) {
  const len = e.def.intents.length;
  const n = (e.def.floorBoss && e.def.attacksPerRound) ? e.def.attacksPerRound : 1;
  const out = [];
  for (let k = 0; k < n; k++) out.push(e.def.intents[(e.intentIdx + k) % len]);
  return out;
}
// SMART foes (floor 2+) don't hammer a fixed row — they HUNT the most vulnerable
// living hero (lowest hp+guard; ties to the most-exposed).  Computed live, so the
// telegraph always shows the real target — and moving the weak one re-aims it.
function effIntentRow(e, intent) {
  if (!e || !e.smart || !intent || intent.kind === 'buff' || intent.row === 'all') return intent ? intent.row : undefined;
  const live = (typeof S !== 'undefined' && S) ? livingHeroes() : [];
  if (!live.length) return intent.row;
  const prey = live.slice().sort((a, b) => (a.hp + (a.guard || 0)) - (b.hp + (b.guard || 0)) || (b.exposed || 0) - (a.exposed || 0))[0];
  return prey.row;
}
function dealToEnemy(e, amt, school, byHeroId) {
  // STAGGER payoff: the next hit on a staggered enemy lands double.
  if (e.staggered) {
    amt *= 2;
    e.staggered = false;
    popupAt(figEl(e.uid), '×2!', 'dmg popup-big');
    stageShake();
  }
  // TECHNICAL — striking a PRIMED foe (CHILLED or WEAKENED) off the weakness
  // line detonates the setup for bonus damage + momentum.  This is the combo
  // payoff: prime with a status card, then anyone cashes it.  (Suppressed in an
  // all-out, which runs its own detonation.)
  let technical = false;
  if (byHeroId && !S._burstResolving && (e.lull || e.weakened) && !(school && school === e.def.weak)) {
    amt += 4;
    technical = true;
    gainMomentum(8, { combo: true });
  }
  let left = amt;
  if (e.guard > 0) { const g = Math.min(e.guard, left); e.guard -= g; left -= g; }
  e.hp = Math.max(0, e.hp - left);
  // First blood reveals the hidden weakness.
  if (!e.weakRevealed) {
    e.weakRevealed = true;
    flashNarrator(e.def.name + ' — weak to ' + (SCHOOL_GLYPH[e.def.weak] || '?') + ' ' + (e.def.weak || '').toUpperCase() + '.');
  }
  // Weakness state machine: WEAKENED, then STAGGERED on the same-turn repeat.
  // (Suppressed during an ALL-OUT so the burst stays clean damage, not a
  // cascade of forged finishers.)
  if (school && school === e.def.weak && e.hp > 0 && !S._burstResolving) {
    gainMomentum(10, { combo: true });            // exploiting a weakness builds burst
    if (e.weakened) {
      e.weakened = false;
      e.staggered = true;
      gainMomentum(18);                            // the BREAK is a big surge
      popupAt(figEl(e.uid), '⚡ STAGGERED', 'info');
      SFX.follow();
      // The stagger forges a finisher in the staggerer's hand — the reward
      // for engineering the state is the card that cashes it.
      if (byHeroId && HEROES[byHeroId]) {
        const fh = S.heroes.find(x => x.id === byHeroId);
        if (fh && !fh.downed) genTempCard({ kind: 'temp', owner: byHeroId, ownerName: fh.def.name, tint: fh.def.tint,
          stance: 'FORGED · FINISHER', name: 'Coup de Grâce', cost: 0, target: 'enemy',
          school: fh.def.school, fx: { dmg: 10 },
          desc: '<b>Free.</b> The break leaves them wide open — <b>10 damage</b>, and a STAGGERED foe takes it doubled. End them while they reel.' });
      }
      if (!S._pressUsed) {
        S._pressUsed = true;
        S.ep += 1;
        pulseEp();
        popupAt(figEl(e.uid), '+1 EP · PRESS ON', 'rally');
      }
    } else {
      e.weakened = true;
      popupAt(figEl(e.uid), '⌖ WEAKENED', 'info');
      if (!S._weakTaught) { S._weakTaught = true; flashNarrator('Weakness! Hit ' + SCHOOL_GLYPH[e.def.weak] + ' again THIS turn to STAGGER.'); }
    }
  }
  // IMPACT TIER — the weight of the blow drives every feel channel (flash,
  // hitstop, shake, popup), so a 4-damage poke and a 30-damage crash land
  // nothing alike.  0 light · 1 solid · 2 heavy · 3 massive.
  const tier = amt >= 20 ? 3 : amt >= 12 ? 2 : amt >= 7 ? 1 : 0;
  const big = tier >= 2;
  popupAt(figEl(e.uid), '−' + amt, 'dmg' + (big ? ' popup-big' : ''));
  // (damagedHeroes bookkeeping lives in enemyPhase; kills resolve avenging
  // in resolveCard where the attacker is known)
  if (byHeroId) lungeFig(figEl(byHeroId));       // the striker drives forward
  impactFx(figEl(e.uid), school || 'phys', big); // school-typed blow lands
  struck(figEl(e.uid), 'r');                 // recoil + flash + brief stun
  hitFlash(tier);                                 // screen flash (+ hitstop if heavy)
  SFX.hit(big);
  if (tier >= 1) stageShake(['sm', 'sm', 'lg', 'xl'][tier]);
  if (technical) {                                // detonation callout
    popupAt(figEl(e.uid), '⚡ TECHNICAL', 'tech');
    techBurst(figEl(e.uid));
    stageShake('lg');
  }
  if (e.hp === 0 && !e.dead) {
    e.dead = true;
    e._justDied = true;
    const reward = emberReward(e);                  // felling a foe yields embers
    addEmbers(reward);
    if (S) S._embersRun = (S._embersRun || 0) + reward;
    const rel = figEl(e.uid); if (rel) popupAt(rel, '✦ +' + reward, 'ember');
    gainMomentum(8);                                // a kill feeds the burst
    SFX.kill();
    stageShake('lg');
    hitFlash(3);                                    // the kill gets a white flash + slow-mo beat
    const el = figEl(e.uid);
    if (el) { el.classList.add('fig-dying'); deathBurst(el); }
    setTimeout(() => { e._justDied = false; if (S && !S.over) renderAll(); }, 750);
  }
}
// Screen-shake, scaled to the moment: 'sm' a nudge, 'xl' a wall-rattling slam.
function stageShake(mag) {
  const st = $('#stage');
  const cls = 'stage-shake-' + (mag || 'md');
  st.classList.remove('stage-shake-sm', 'stage-shake-md', 'stage-shake-lg', 'stage-shake-xl');
  void st.offsetWidth; st.classList.add(cls);
  clearTimeout(st._shakeT); st._shakeT = setTimeout(() => st.classList.remove(cls), 460);
}
// A struck figure: directional recoil + bright flash.  On big hits the global
// HITSTOP (below) freezes this recoil mid-pose for the "the blow connects" beat.
function struck(el, dir) {
  if (!el) return;
  const cls = dir === 'r' ? 'fig-hit-r' : dir === 'l' ? 'fig-hit-l' : 'fig-hit';
  el.classList.remove('fig-hit', 'fig-hit-l', 'fig-hit-r'); void el.offsetWidth;
  el.classList.add(cls);
}
// Full-screen impact flash, scaled by tier (0 light → 3 kill/massive).  Tier ≥ 2
// also HITSTOPs — a freeze of every animation, longer the bigger the blow, for
// that meaty "the blow connects" beat.
function hitFlash(tier) {
  tier = tier | 0;
  const st = $('#stage');
  const f = document.createElement('div');
  f.className = 'hit-flash' + (tier >= 2 ? ' hit-flash-big' : '') + (tier >= 3 ? ' hit-flash-huge' : '');
  st.appendChild(f);
  setTimeout(() => f.remove(), tier >= 3 ? 240 : tier >= 2 ? 190 : 120);
  if (tier >= 2) {
    st.classList.add('hitstop');
    const dur = tier >= 3 ? 155 : 95;
    clearTimeout(st._hsT); st._hsT = setTimeout(() => st.classList.remove('hitstop'), dur);
    try { SFX.hitstop(); } catch (_) {}
  }
}
// A kill blooms a shatter burst at the enemy — a bright core, an expanding ring,
// and shards flung outward: the satisfying "it breaks" beat.
function deathBurst(el) {
  if (!el) return;
  const layer = $('#popup-layer'); if (!layer) return;
  const sr = $('#stage').getBoundingClientRect(), s = sr.width / 760 || 1;
  const r = el.getBoundingClientRect();
  const x = (r.left + r.width / 2 - sr.left) / s, y = (r.top + r.height * 0.42 - sr.top) / s;
  const b = document.createElement('div');
  b.className = 'death-burst'; b.style.left = x + 'px'; b.style.top = y + 'px';
  let shards = '';
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * 360 + (i * 37 % 24) - 12;
    const d = 46 + (i * 53 % 34);
    shards += `<span class="db-shard" style="--a:${a}deg; --d:${d}px"></span>`;
  }
  b.innerHTML = `<span class="db-core"></span><span class="db-ring"></span>${shards}`;
  layer.appendChild(b);
  setTimeout(() => b.remove(), 720);
}
function pulseEp() {
  const dial = $('#ep-dial');
  if (!dial) return;
  dial.classList.remove('ep-pulse'); void dial.offsetWidth; dial.classList.add('ep-pulse');
}

// ---------------------------------------------------------------------------
// MOMENTUM — the combat-earned burst gauge (Persona all-out / Clair Obscur
// gradient).  Exploiting weaknesses, chaining LINKs (follow-ups), staggering,
// and killing all feed it.  A running LINK combo counter (per player turn)
// scales each gain so chaining pays.  Full gauge → ALL-OUT ATTACK.
// ---------------------------------------------------------------------------
const MOM_MAX = 100;
function gainMomentum(amt, opts) {
  if (!S || S.over || S._burstResolving) return;   // bursts don't feed themselves
  opts = opts || {};
  if (opts.combo) {
    S.combo = (S.combo || 0) + 1;
    if (S.combo > (S.comboBest || 0)) S.comboBest = S.combo;
    amt += Math.min(8, S.combo);                    // longer chains fill faster
  }
  const before = S.momentum || 0;
  S.momentum = Math.max(0, Math.min(MOM_MAX, before + amt));
  const fill = $('#burst-fill');
  if (fill) { fill.classList.remove('burst-gain'); void fill.offsetWidth; fill.classList.add('burst-gain'); }
  if (S.momentum >= MOM_MAX && before < MOM_MAX) {
    flashNarrator('✦ BURST FULL — unleash the ALL-OUT, then TAP each strike to chain it.');
    SFX.triad();
  }
}
// Show a "LINK ×N" combo callout above a hero as the chain grows.
function linkPopup(heroId) {
  if (S.combo >= 2) popupAt(figEl(heroId), '⚡ LINK ×' + S.combo, 'rally');
}
function burstReady() { return S && (S.momentum || 0) >= MOM_MAX && !S.executing && !S.over; }

// ---------------------------------------------------------------------------
// PARRY — a reactive timing window on enemy attacks (Clair Obscur flavor).
// Tap as the ring closes: PERFECT negates the blow, ripostes, and builds
// momentum; a looser tap BLOCKS half.  Experimental — flip PARRY_ENABLED to
// false to remove the whole layer cleanly (enemy attacks then resolve as before).
// ---------------------------------------------------------------------------
const PARRY_ENABLED = true;
const PARRY_MISS_MULT = 1.6;   // an UNPARRIED blow lands HARDER (real-run only)

// Each intent carries a rhythm PATTERN — its own way to be turned aside — so
// defense has Project-Diva variety: a clean tap, a quick double-tap flurry, a
// braced HOLD for heavy blows, or a SWIPE to sweep away a wide attack.  Derived
// from the intent so every enemy reads consistently; `intent.parry` can author
// an override.  A short glyph (⊙ / ⊙⊙ / ▭ / ➤) previews it on the telegraph.
function parryPatternFor(intent) {
  if (intent.parry) return normPattern(intent.parry);
  const d = intent.dmg || 0;
  // The GESTURE and its SIZE read the attack: a heavy blast you BRACE (big
  // hold), a wide sweeping claw you DEFLECT along a big arc, a huge single
  // blow you SLAM (big tap), a frenzied flurry you MASH, mid hits a double-tap.
  if (intent.heavy)         return { kind: 'hold', size: 'big' };
  if (intent.row === 'all') return { kind: 'swipe', arc: 'arcAcross', size: 'wide', across: true };  // one sweep over the whole party
  if (d >= 7)               return { kind: 'tap', size: 'big' };
  if (d <= 3)               return { kind: 'mash', count: 4 };
  if (d <= 5)               return { kind: 'multi', count: 2 };
  return { kind: 'tap' };
}
// legacy dir -> arc, so authored {kind:'swipe',dir:'up'} still works
function normPattern(p) {
  if (p.kind === 'swipe' && !p.arc) p = Object.assign({}, p, { arc: { left: 'arcL', right: 'arcR', up: 'arcU', down: 'arcU' }[p.dir] || 'arcR' });
  return p;
}
// A curved "deflect" sweep — you trace the arc to turn the blow aside, the way
// Project Diva slide-notes and a real parry both carve a curve.
const SWIPE_ARCS = {
  arcR: { d: 'M -42 24 Q 0 -50 42 24', glyph: '↷', ok: (dx, dy) => dx > 34 && Math.abs(dx) > Math.abs(dy) * 0.5 },
  arcL: { d: 'M 42 24 Q 0 -50 -42 24', glyph: '↶', ok: (dx, dy) => dx < -34 && Math.abs(dx) > Math.abs(dy) * 0.5 },
  arcU: { d: 'M -38 34 Q 44 6 -6 -46', glyph: '⤴', ok: (dx, dy) => dy < -34 && Math.abs(dy) > Math.abs(dx) * 0.4 },
  // a wide, shallow sweep ACROSS the party — one flick over all three heroes
  arcAcross: { d: 'M -58 6 Q 0 -30 58 6', glyph: '⟺', ok: (dx, dy) => Math.abs(dx) > 46 && Math.abs(dx) > Math.abs(dy) },
};
const PARRY_GLYPH = { tap: '⊙', multi: '⊙⊙', hold: '▭', swipe: '➤', mash: '⊙⊙⊙' };
function parryGlyph(intent) {
  const p = parryPatternFor(intent);
  if (p.kind === 'seq') return '✷' + p.notes.length;   // a bullet-hell cascade
  const g = p.kind === 'swipe' ? (SWIPE_ARCS[p.arc] || SWIPE_ARCS.arcR).glyph : PARRY_GLYPH[p.kind];
  return (p.size === 'big' ? '◉' : p.size === 'wide' ? '⟺' : '') + g;   // size hint
}

// Stage-space anchor (center) of the parry UI for a given target figure.
function noteAnchor(targetEl) {
  const sr = $('#stage').getBoundingClientRect(), scale = sr.width / 760;
  const r = targetEl.getBoundingClientRect();
  return { x: (r.left + r.width / 2 - sr.left) / scale, y: (r.top + r.height * 0.4 - sr.top) / scale };
}
// --- the parry UI base: a ring at a STAGE coordinate (so boss notes can be
// placed anywhere along an arc, not just on the target hero) ---
function mkParryUiAt(ax, ay, innerHtml, cls) {
  const el = document.createElement('div');
  el.className = 'parry-ring ' + (cls || '');
  el.style.left = ax + 'px'; el.style.top = ay + 'px';
  el.innerHTML = innerHtml;
  $('#popup-layer').appendChild(el);
  return { el, close: () => { el.classList.add('pr-out'); setTimeout(() => el.remove(), 160); } };
}
// Immediate per-gesture RESPONSE: rating text + a burst ring at the note, a
// combo streak that escalates, and a pitch-ramped tick.  This is the rhythm
// feedback — you FEEL every tap land the instant you make it.
let _parryStreak = 0;
function noteFeedback(ui, ax, ay, q) {
  const good = q === 'perfect' || q === 'good';
  if (good) _parryStreak++; else _parryStreak = 0;
  ui.el.classList.add(q === 'perfect' ? 'pr-land-perfect' : good ? 'pr-land-good' : 'pr-land-miss');
  const layer = $('#popup-layer');
  const rate = document.createElement('div');
  rate.className = 'parry-rate ' + (q === 'perfect' ? 'prt-perfect' : good ? 'prt-good' : 'prt-miss');
  rate.style.left = ax + 'px'; rate.style.top = (ay - 4) + 'px';
  const word = q === 'perfect' ? 'PERFECT' : q === 'good' ? 'GOOD' : q === 'early' ? 'EARLY' : 'MISS';
  rate.innerHTML = word + (good && _parryStreak > 1 ? ` <em>×${_parryStreak}</em>` : '');
  layer.appendChild(rate);
  setTimeout(() => rate.remove(), 620);
  const burst = document.createElement('div');
  burst.className = 'parry-burst ' + (q === 'perfect' ? 'pb-perfect' : good ? 'pb-good' : 'pb-miss');
  burst.style.left = ax + 'px'; burst.style.top = ay + 'px';
  layer.appendChild(burst);
  setTimeout(() => burst.remove(), 440);
  // Screen-level RESPONSE to the press: a quick full-bleed flash sells the
  // impact.  (Cheap — it's a separate fading overlay, so it never forces the
  // paused/blurred battlefield behind it to re-rasterize.)
  const flash = document.createElement('div');
  flash.className = 'parry-flash ' + (q === 'perfect' ? 'pf-perfect' : good ? 'pf-good' : 'pf-miss');
  layer.appendChild(flash);
  setTimeout(() => flash.remove(), 220);
  try { if (good) SFX.parry(q === 'perfect', _parryStreak); else SFX.parryMiss(); } catch (_) {}
  haptic(q === 'perfect' ? HAP.perfect : good ? HAP.good : HAP.miss);
  comboCounter(good);
}
// A prominent Project-Diva-style COMBO counter — a big number that grows and
// pops with each linked gesture, and clears when the chain breaks.
function comboCounter(good) {
  let el = document.getElementById('parry-combo');
  if (!el) { el = document.createElement('div'); el.id = 'parry-combo'; $('#stage').appendChild(el); }
  if (good && _parryStreak >= 2) {
    el.innerHTML = `<span class="pc-num">${_parryStreak}</span><span class="pc-lbl">COMBO</span>`;
    el.classList.remove('pc-pop'); void el.offsetWidth; el.classList.add('pc-on', 'pc-pop');
    clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('pc-on'), 1500);
  } else if (!good) {
    el.classList.remove('pc-on');
  }
}
// TAP note — an APPROACH ring shrinks onto the sweet spot.  It stays dim while
// closing, then GLOWS GOLD and says "TAP!" the instant it enters the hit
// window, so the moment to press is unmistakable.  Tapping too early no longer
// WASTES the note — it nudges ("WAIT…") and keeps listening, so a single
// mistimed press is forgiven and the timing is teachable rather than punishing.
function parryTapNote(ax, ay, dur, idx, total, size) {
  return new Promise(resolve => {
    const label = total > 1 ? `${idx}/${total}` : (size === 'big' ? 'SLAM' : 'TAP');
    const ui = mkParryUiAt(ax, ay, `<span class="pr-target"></span><span class="pr-close"></span><span class="pr-lbl">${label}</span>`, size === 'big' ? 'pr-big' : '');
    ui.el.querySelector('.pr-close').style.animationDuration = dur + 'ms';
    const lbl = ui.el.querySelector('.pr-lbl');
    const GOOD = 460, PERF = 175;   // windows measured as ms remaining at the tap
    let done = false; const t0 = Date.now();
    // light the note up the moment it becomes tappable — "wait for the glow"
    const liveT = setTimeout(() => { if (!done) { ui.el.classList.add('pr-live'); lbl.textContent = size === 'big' ? 'SLAM!' : 'TAP!'; } }, Math.max(0, dur - GOOD));
    const finish = (q) => { if (done) return; done = true; clearTimeout(liveT); window.removeEventListener('pointerdown', onTap, true); noteFeedback(ui, ax, ay, q); ui.close(); resolve(q); };
    const onTap = () => {
      const rem = dur - (Date.now() - t0);
      if (rem > GOOD) { parryEarlyNudge(ui, ax, ay); return; }   // too soon — forgive, keep listening
      finish(rem <= PERF ? 'perfect' : 'good');
    };
    window.addEventListener('pointerdown', onTap, true);
    setTimeout(() => finish('miss'), dur);
  });
}
// Premature press: a quick "WAIT…" nudge on the note that does NOT consume it.
function parryEarlyNudge(ui, ax, ay) {
  ui.el.classList.remove('pr-earlybump'); void ui.el.offsetWidth; ui.el.classList.add('pr-earlybump');
  const tag = document.createElement('div');
  tag.className = 'parry-rate prt-early';
  tag.style.left = ax + 'px'; tag.style.top = (ay - 4) + 'px';
  tag.textContent = 'WAIT…';
  $('#popup-layer').appendChild(tag);
  setTimeout(() => tag.remove(), 400);
  try { haptic(HAP.tap); } catch (_) {}
}
// First-few-parries coach — a short caption teaching the tap timing.  Shown at
// most 3 times ever (persisted), so new players get the "wait for the glow"
// lesson without it nagging veterans.
function parryCoach(msg) {
  let n = 0;
  try { n = parseInt(localStorage.getItem('kizuna2_1.parryLessons') || '0', 10) || 0; } catch (_) {}
  if (n >= 3) return;
  try { localStorage.setItem('kizuna2_1.parryLessons', String(n + 1)); } catch (_) {}
  let el = document.getElementById('parry-coach');
  if (!el) { el = document.createElement('div'); el.id = 'parry-coach'; $('#stage').appendChild(el); }
  el.textContent = msg;
  el.classList.remove('pc-hide'); void el.offsetWidth; el.classList.add('pc-show');
  clearTimeout(el._t); el._t = setTimeout(() => { el.classList.remove('pc-show'); }, 2800);
}
// Non-linear rhythm for multi/seq runs: notes carry GROOVE, not an even
// metronome.  Durations stay in the reactive-friendly band while VARYING, and
// the GAPS between notes syncopate (a beat, then a quick pair, an off-beat
// pause).  The first note is the accented downbeat (a touch slower/wider).
function parryRhythm(count) {
  const T = {
    1: [{ d: 700, g: 0 }],
    2: [{ d: 620, g: 150 }, { d: 440, g: 0 }],
    3: [{ d: 620, g: 120 }, { d: 440, g: 70 }, { d: 440, g: 0 }],
    4: [{ d: 600, g: 110 }, { d: 440, g: 230 }, { d: 440, g: 90 }, { d: 420, g: 0 }],
    5: [{ d: 600, g: 100 }, { d: 440, g: 80 }, { d: 440, g: 220 }, { d: 460, g: 90 }, { d: 420, g: 0 }],
  };
  return T[count] || Array.from({ length: count }, (_, i) => ({ d: i === 0 ? 600 : 440, g: i === count - 1 ? 0 : 110 }));
}
// A boss CASCADE reads differently from a mob's quick double-tap: it's a longer
// chain you have to stay with, so it wants a STEADY, readable groove rather than
// syncopation.  An accented (slower, wider) downbeat announces the run, then even
// beats with a consistent gap — every note catchable, the rhythm never a trick.
const SEQ_LEADIN = 460;   // beat of quiet after the telegraph draws, before note 1
function seqRhythm(count) {
  const out = [];
  for (let i = 0; i < count; i++) out.push({ d: i === 0 ? 660 : 560, g: i === count - 1 ? 0 : 160 });
  return out;
}
// MASH note — a frenzied flurry: tap rapidly to fill the meter before it closes.
function parryMashNote(ax, ay, count, dur) {
  return new Promise(resolve => {
    const ui = mkParryUiAt(ax, ay, `<span class="pr-target"></span><span class="pr-close"></span><span class="pr-mash"><span class="pr-mash-fill"></span></span><span class="pr-lbl">MASH!</span>`, 'parry-mash pr-big');
    ui.el.querySelector('.pr-close').style.animationDuration = dur + 'ms';
    const fill = ui.el.querySelector('.pr-mash-fill');
    let done = false, taps = 0;
    const finish = (q) => { if (done) return; done = true; window.removeEventListener('pointerdown', onTap, true); noteFeedback(ui, ax, ay, q); ui.close(); resolve(q); };
    const onTap = () => {
      taps++; if (fill) fill.style.width = Math.min(100, (taps / count) * 100) + '%';
      haptic(HAP.tap);
      if (taps >= count) finish('perfect');
    };
    window.addEventListener('pointerdown', onTap, true);
    setTimeout(() => finish(taps >= Math.ceil(count / 2) ? 'good' : 'miss'), dur);
  });
}
// HOLD note — press and BRACE; keep held until the bar fills (through impact).
function parryHoldNote(ax, ay, dur, size) {
  return new Promise(resolve => {
    const ui = mkParryUiAt(ax, ay, `<span class="pr-hold-track"><span class="pr-hold-fill"></span></span><span class="pr-lbl">BRACE</span>`, 'parry-hold' + (size === 'big' ? ' pr-big' : ''));
    ui.el.querySelector('.pr-hold-fill').style.animationDuration = dur + 'ms';
    let done = false, holding = false, everHeld = false;
    const finish = (q) => { if (done) return; done = true; window.removeEventListener('pointerdown', onDown, true); window.removeEventListener('pointerup', onUp, true); noteFeedback(ui, ax, ay, q); ui.close(); resolve(q); };
    const onDown = () => { if (!everHeld) { try { SFX.brace(); } catch (_) {} haptic(HAP.press); } holding = true; everHeld = true; ui.el.classList.add('pr-pressed'); };
    const onUp = () => { holding = false; ui.el.classList.remove('pr-pressed'); };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointerup', onUp, true);
    setTimeout(() => finish(holding ? 'perfect' : everHeld ? 'good' : 'miss'), dur);
  });
}
// DEFLECT note — trace the curved arc to sweep the blow aside (a real parry
// carves a curve; so do Project-Diva slide notes).  Detection is forgiving: a
// sweep whose net direction matches the arc counts, so tracing OR flicking works.
function parrySwipeNote(ax, ay, arc, dur, size) {
  return new Promise(resolve => {
    const spec = SWIPE_ARCS[arc] || SWIPE_ARCS.arcR;
    const wide = size === 'wide';
    const ui = mkParryUiAt(ax, ay,
      `<svg class="pr-arc-svg" viewBox="-60 -60 120 120">
         <path class="pr-arc-path" d="${spec.d}"/>
         <path class="pr-arc-draw" d="${spec.d}"/>
         <circle class="pr-arc-dot" r="5"><animateMotion dur="${dur}ms" repeatCount="1" fill="freeze" path="${spec.d}"/></circle>
       </svg><span class="pr-lbl">${wide ? 'SWEEP' : 'DEFLECT'} ${spec.glyph}</span>`, 'parry-swipe' + (wide ? ' pr-wide' : ''));
    ui.el.querySelector('.pr-arc-draw').style.animationDuration = dur + 'ms';
    let done = false, sx = null, sy = null, maxHit = null; const t0 = Date.now();
    const finish = (q) => { if (done) return; done = true; window.removeEventListener('pointerdown', onDown, true); window.removeEventListener('pointermove', onMove, true); window.removeEventListener('pointerup', onUp, true); noteFeedback(ui, ax, ay, q); ui.close(); resolve(q); };
    const onDown = (e) => { sx = e.clientX; sy = e.clientY; };
    const onMove = (e) => {
      if (sx == null || maxHit) return;
      if (spec.ok(e.clientX - sx, e.clientY - sy)) { maxHit = true; try { SFX.swoosh(); } catch (_) {} haptic(HAP.swipe); const rem = dur - (Date.now() - t0); finish(rem <= 250 ? 'perfect' : 'good'); }
    };
    const onUp = () => { sx = null; };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
    setTimeout(() => finish('miss'), dur);
  });
}
// Place N notes along a bowed arc sweeping from the boss toward the target —
// the "bullet-hell for parries" cascade the floor boss unleashes.
function arcPoints(n, anchor) {
  const x0 = 540, y0 = 96;                                   // near the boss
  const x1 = anchor.x, y1 = Math.max(70, anchor.y - 24);     // toward the hero
  const cx = (x0 + x1) / 2, cy = Math.min(y0, y1) - 66;      // bow up
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const u = 1 - t;
    pts.push({ x: u * u * x0 + 2 * u * t * cx + t * t * x1, y: u * u * y0 + 2 * u * t * cy + t * t * y1 });
  }
  return pts;
}
// A faint telegraph of the whole cascade — the arc and every note position —
// so the incoming sequence reads as "a series along an arc" before it starts.
function mkSeqPreview(pts) {
  const dots = pts.map((p, i) => `<circle cx="${p.x}" cy="${p.y}" r="9" class="sq-dot"/><text x="${p.x}" y="${p.y + 3.5}" class="sq-num">${i + 1}</text>`).join('');
  const d = 'M ' + pts.map(p => `${p.x} ${p.y}`).join(' L ');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'seq-preview');
  svg.setAttribute('viewBox', '0 0 760 430');
  svg.innerHTML = `<path d="${d}" class="sq-line"/>${dots}`;
  $('#stage').appendChild(svg);
  return svg;
}
// SEQUENCE — a chain of mixed notes (taps along an arc, a hold, a deflect).
// Every note must land to fully turn the attack aside; partial → BLOCK.
async function runParrySeq(notes, anchor, art) {
  const pts = arcPoints(notes.length, anchor);
  const preview = mkSeqPreview(pts);
  const rh = seqRhythm(notes.length);   // steady, readable cascade groove
  await sleep(SEQ_LEADIN);              // let the whole arc register before note 1 lands
  let hits = 0;
  for (let i = 0; i < notes.length; i++) {
    const nt = notes[i], p = pts[i], step = rh[i] || { d: 560, g: 160 };
    const done = preview.querySelectorAll('.sq-dot')[i]; if (done) done.classList.add('sq-active');
    if (art) bossAttackBeat(art, p.x, p.y);   // one art streak per note — SYNCED
    let q;
    if (nt.t === 'hold')       q = await parryHoldNote(p.x, p.y, 820);
    else if (nt.t === 'swipe') q = await parrySwipeNote(p.x, p.y, nt.arc || 'arcR', 760);
    else                       q = await parryTapNote(p.x, p.y, step.d, i + 1, notes.length);
    if (done) { done.classList.remove('sq-active'); done.classList.add(q === 'perfect' || q === 'good' ? 'sq-hit' : 'sq-miss'); }
    if (q === 'perfect' || q === 'good') hits++;
    if (step.g) await sleep(step.g);   // even gap — a groove you can stay inside
  }
  preview.remove();
  // PARTIAL: each note you turned aside negates its share; the ones you missed
  // still land.  mit = fraction parried; perfect only if you caught them all.
  return { mit: hits / notes.length, perfect: hits === notes.length };
}
// Run a pattern; returns { mit (0..1 damage negated), perfect } | null if off.
// While a parry is live the world behind the notes desaturates, blurs and
// dims (`parry-focus`) so the reactive gesture is the only thing in focus —
// the notes/ratings live in #popup-layer, above the filter, and stay crisp.
async function runParry(targetEl, pattern, art) {
  if (!PARRY_ENABLED || !targetEl) { await sleep(380); return null; }
  const stage = $('#stage');
  stage.classList.add('parry-focus');
  try {
    return await runParryInner(targetEl, pattern, art);
  } finally {
    stage.classList.remove('parry-focus');
  }
}
async function runParryInner(targetEl, pattern, art) {
  let a = noteAnchor(targetEl);
  const k = pattern.kind, sz = pattern.size || '';
  // An across-sweep parries a WHOLE-PARTY blow — center it over the party line.
  if (pattern.across) {
    const figs = livingHeroes().map(h => figEl(h.id)).filter(Boolean);
    if (figs.length) {
      const sr = $('#stage').getBoundingClientRect(), s = sr.width / 760;
      let sx = 0, sy = 0;
      figs.forEach(f => { const r = f.getBoundingClientRect(); sx += (r.left + r.width / 2 - sr.left) / s; sy += (r.top + r.height * 0.4 - sr.top) / s; });
      a = { x: sx / figs.length, y: sy / figs.length };
    }
  }
  if (art && k !== 'seq') bossAttackBeat(art, a.x, a.y);   // single-note attacks: one beat
  if (k === 'tap' || k === 'multi' || k === 'seq' || !k) parryCoach('Wait for the ring to glow gold — then TAP');
  if (k === 'seq')   return await runParrySeq(pattern.notes, a, art);
  // multi is a mini-cascade — partial mitigation too (miss a tap, take its
  // share).  Notes vary in SPEED (a slower downbeat, then a snappier one) but
  // stay CONTIGUOUS — a quick double-tap, no dead gap between them.
  if (k === 'multi') {
    const rh = parryRhythm(pattern.count);
    let hits = 0;
    for (let i = 0; i < pattern.count; i++) {
      const step = rh[i] || { d: 480 };
      const q = await parryTapNote(a.x, a.y, step.d, i + 1, pattern.count, sz);
      if (q === 'perfect' || q === 'good') hits++;
    }
    return { mit: hits / pattern.count, perfect: hits === pattern.count };
  }
  let q;
  if (k === 'hold')       q = await parryHoldNote(a.x, a.y, 900, sz);
  else if (k === 'swipe') q = await parrySwipeNote(a.x, a.y, pattern.arc, 860, sz);
  else if (k === 'mash')  q = await parryMashNote(a.x, a.y, pattern.count || 4, 1150);
  else                    q = await parryTapNote(a.x, a.y, 700, 1, 1, sz);
  return { mit: q === 'perfect' ? 1 : q === 'good' ? 0.5 : 0, perfect: q === 'perfect' };
}
function parryFlash(el) {
  if (!el) return;
  el.classList.remove('fig-parry'); void el.offsetWidth; el.classList.add('fig-parry');
  setTimeout(() => el && el.classList.remove('fig-parry'), 500);
}

async function addThread(a, b) {
  const key = pairKey(a, b);
  // A KINDLED pair (thread pre-formed at fight start) awakens its DUET on the
  // FIRST act of help this fight — the "kindled bond + a shared act" trigger.
  if (S.threads.has(key)) { await awakenDuet(a, b); await checkTriad(a); return; }
  S.threads.add(key);
  sparkThread(a, b);       // a single arc of connection, then it fades
  renderResonance();       // update the RESONANCE badge (edge lights up)
  SFX.thread();
  // If this newly-threaded pair is ALREADY kindled from earlier fights, this
  // very act awakens their duet — and it stands in for the generic Echo Bond.
  const kindledNow = bondPts(key) >= BOND_KINDLED;
  const duetAwoke = kindledNow ? await awakenDuet(a, b) : false;
  // The fight's FIRST bond materializes an Echo Bond — a card the pair
  // shares, stronger if the two are already kindled (progression made card).
  if (!duetAwoke && !S._echoBondGiven) {
    S._echoBondGiven = true;
    const kindled = bondPts(key) >= BOND_KINDLED;
    genTempCard({ kind: 'temp', owner: 'bond', ownerName: HEROES[a].name + ' + ' + HEROES[b].name,
      tint: 'var(--gold-bright)', stance: kindled ? 'KINDLED BOND' : 'BOND',
      name: 'Echo Bond', cost: 1, target: 'none',
      fx: { bondPair: [a, b], bondGuard: kindled ? 4 : 3, bondRally: kindled ? 3 : 2 },
      desc: `${HEROES[a].name} and ${HEROES[b].name} move as one: both gain <span class="kw kw-guard">⛨ ${kindled ? 4 : 3}</span> and <span class="kw kw-rally">▲ RALLY ${kindled ? 3 : 2}</span>.` });
  }
  flashNarrator('A thread forms — ' + HEROES[a].name + ' ─ ' + HEROES[b].name);
  // The bond itself protects: both linked heroes steel by 2 guard the moment
  // the thread forms.  Kizuna has immediate tactical weight, not just
  // triad-progress bookkeeping.
  [a, b].forEach(id => {
    const h = S.heroes.find(x => x.id === id);
    if (h && !h.downed) { h.guard += 2; popupAt(figEl(id), '♡ BOND ⛨2', 'guard'); }
  });
  // Nudge: when only one link is missing, say so — the triangle should feel
  // one decision away, not hidden.
  const live = livingHeroes();
  if (!S.triadFormed && live.length >= 3 && !S._triangleNudged) {
    const ids = live.map(h => h.id);
    let missing = 0;
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      if (!S.threads.has(pairKey(ids[i], ids[j]))) missing++;
    }
    if (missing === 1) { S._triangleNudged = true; flashNarrator('One more bond completes the triangle…'); }
  }
  await checkTriad(a);
}
async function checkTriad(closer) {
  const live = livingHeroes();
  if (live.length < 3 || S.triadFormed) return;
  const [x, y, z] = live.map(h => h.id);
  if (S.threads.has(pairKey(x, y)) && S.threads.has(pairKey(y, z)) && S.threads.has(pairKey(x, z))) {
    S.triadFormed = true;
    S.resonantHostId = closer;   // the helper whose act closed / awoke the triangle
    await triadCeremony();
  }
}

async function triadCeremony() {
  $('#stage').classList.add('frozen');
  SFX.triad();
  await sleep(700);
  const r = triadEntry();
  const names = livingHeroes().map(h => h.def.name).join(' · ');
  showOverlay(`
    <svg class="triad-svg" viewBox="0 0 150 130">
      <path d="M 75 12 L 138 112 L 12 112 Z"/>
    </svg>
    <div class="triad-title">TRIAD FORMED</div>
    <div class="triad-names">${names}</div>
    <div class="triad-cardname">✦ ${r.name}${vowRank(trioClassKey(livingHeroes().map(h => h.id))) > 1 ? ' ' + ROMAN[vowRank(trioClassKey(livingHeroes().map(h => h.id)))] : ''} — ${r.type}</div>
    <div class="ov-tap">${HEROES[S.resonantHostId] ? HEROES[S.resonantHostId].name + '’s signature transforms' : 'a card transforms'} · tap to continue</div>
  `, 'triad-ceremony');
  await new Promise(res => { $('#overlay').onclick = () => { $('#overlay').onclick = null; res(); }; });
  hideOverlay();
  $('#stage').classList.remove('frozen');
  S.resonantNew = true;
  renderAll();
}

// The full-screen layer the resonant cinematic paints onto (created lazily).
function cineLayer() {
  let el = document.getElementById('resonant-cine');
  if (!el) { el = document.createElement('div'); el.id = 'resonant-cine'; el.className = 'hidden'; $('#stage').appendChild(el); }
  return el;
}
// BOSS ATTACK ART — one JRPG attack BEAT per parry note, SYNCED to the cascade
// and rendered BEHIND the notes (dim, z-8) so it sells the giant blade/claw/blast
// without ever obscuring the gesture you're reading.  A 4-note claw = 4 rakes
// racing down the arc as you tap.  Purely visual, self-removing.
function bossAttackBeat(kind, ax, ay) {
  const fx = document.createElement('div');
  fx.className = 'boss-beat bb-' + kind;
  fx.style.setProperty('--by', (ay / 430 * 100) + '%');
  fx.style.setProperty('--bx', (ax / 760 * 100) + '%');
  $('#stage').appendChild(fx);
  stageShake();
  setTimeout(() => fx.remove(), 640);
}
// A transient full-screen impact flash + shake — punctuates each vow stage.
function cineFlash(color) {
  const st = $('#stage');
  const f = document.createElement('div');
  f.className = 'rc-flash';
  if (color) f.style.background = `radial-gradient(ellipse at 50% 45%, ${color} 0%, transparent 70%)`;
  st.appendChild(f);
  stageShake();
  setTimeout(() => f.remove(), 420);
}
// JRPG banner: the trio's name slams in, the triangle draws itself, a light
// sweeps the field.  Holds, then recedes so the stage impacts read clearly.
async function resonantCineIntro(r, host, rank) {
  $('#stage').classList.add('frozen');
  const el = cineLayer();
  el.classList.remove('hidden', 'rc-out');
  el.innerHTML = `
    <div class="rc-wash"></div>
    <div class="rc-rays"></div>
    <div class="rc-sweep"></div>
    <svg class="rc-tri" viewBox="0 0 150 130"><path d="M 75 12 L 138 112 L 12 112 Z"/></svg>
    <div class="rc-host">${host ? host.name + ' CALLS THE VOW' : 'THE TRIAD SPEAKS'}</div>
    <div class="rc-name">✦ ${r.name}${rank > 1 ? ' ' + ROMAN[rank] : ''}</div>
    <div class="rc-type">${r.type}</div>`;
  SFX.triad();
  cineFlash('rgba(240,212,136,0.5)');
  await sleep(1250);
  el.classList.add('rc-out');          // fade the banner, keep field clear
  $('#stage').classList.remove('frozen');
  await sleep(220);
}
function resonantCineEnd() {
  const el = cineLayer();
  el.classList.add('hidden'); el.classList.remove('rc-out'); el.innerHTML = '';
  $('#stage').classList.remove('frozen');
}

// STRIKE note — the OFFENSIVE mirror of the parry.  Same closing-ring timing,
// but placed ON the enemy and tinted red: tap as it lands to land the blow with
// an ACCENT.  perfect > good > (missed = a weak, glancing hit).  Reuses the
// .parry-ring plumbing (so the auto-tester can drive it) with a .pr-strike skin.
function strikeNote(targetEl, idx, total, dur) {
  return new Promise(resolve => {
    const a = targetEl ? noteAnchor(targetEl) : { x: 500, y: 150 };
    const label = total > 1 ? `${idx}/${total}` : 'STRIKE';
    const ui = mkParryUiAt(a.x, a.y, `<span class="pr-target"></span><span class="pr-close"></span><span class="pr-lbl">${label}</span>`, 'pr-strike');
    ui.el.querySelector('.pr-close').style.animationDuration = dur + 'ms';
    const lbl = ui.el.querySelector('.pr-lbl');
    const GOOD = 440, PERF = 165;
    let done = false; const t0 = Date.now();
    const liveT = setTimeout(() => { if (!done) { ui.el.classList.add('pr-live'); lbl.textContent = 'STRIKE!'; } }, Math.max(0, dur - GOOD));
    const finish = (q) => { if (done) return; done = true; clearTimeout(liveT); window.removeEventListener('pointerdown', onTap, true); strikeFeedback(ui, a.x, a.y, q); ui.close(); resolve(q); };
    const onTap = () => { const rem = dur - (Date.now() - t0); if (rem > GOOD) { parryEarlyNudge(ui, a.x, a.y); return; } finish(rem <= PERF ? 'perfect' : 'good'); };
    window.addEventListener('pointerdown', onTap, true);
    setTimeout(() => finish('miss'), dur);
  });
}
// Per-strike RESPONSE — red rating word + burst; a perfect connects hard.
function strikeFeedback(ui, ax, ay, q) {
  const good = q === 'perfect' || q === 'good';
  ui.el.classList.add(q === 'perfect' ? 'pr-land-perfect' : good ? 'pr-land-good' : 'pr-land-miss');
  const layer = $('#popup-layer');
  const rate = document.createElement('div');
  rate.className = 'parry-rate strike-rate ' + (q === 'perfect' ? 'srt-perfect' : good ? 'srt-good' : 'srt-miss');
  rate.style.left = ax + 'px'; rate.style.top = (ay - 4) + 'px';
  rate.textContent = q === 'perfect' ? 'PERFECT!' : q === 'good' ? 'HIT' : 'WEAK';
  layer.appendChild(rate); setTimeout(() => rate.remove(), 560);
  const burst = document.createElement('div');
  burst.className = 'parry-burst strike-burst ' + (q === 'perfect' ? 'pb-perfect' : good ? 'pb-good' : 'pb-miss');
  burst.style.left = ax + 'px'; burst.style.top = ay + 'px';
  layer.appendChild(burst); setTimeout(() => burst.remove(), 420);
  try { if (good) SFX.parry(q === 'perfect', 1); else SFX.parryMiss(); } catch (_) {}
  haptic(q === 'perfect' ? HAP.perfect : good ? HAP.good : HAP.miss);
}
// STRIKE SWIPE — the offensive slash: flick across the enemy along the arc.
// Same forgiving detection as the parry deflect, red-skinned, its own rating.
function strikeSwipeNote(targetEl, arc, dur) {
  return new Promise(resolve => {
    const a = targetEl ? noteAnchor(targetEl) : { x: 500, y: 150 };
    const spec = SWIPE_ARCS[arc] || SWIPE_ARCS.arcR;
    const ui = mkParryUiAt(a.x, a.y,
      `<svg class="pr-arc-svg" viewBox="-60 -60 120 120">
         <path class="pr-arc-path" d="${spec.d}"/>
         <path class="pr-arc-draw" d="${spec.d}"/>
         <circle class="pr-arc-dot" r="5"><animateMotion dur="${dur}ms" repeatCount="1" fill="freeze" path="${spec.d}"/></circle>
       </svg><span class="pr-lbl">SLASH ${spec.glyph}</span>`, 'parry-swipe pr-strike');
    ui.el.querySelector('.pr-arc-draw').style.animationDuration = dur + 'ms';
    let done = false, sx = null, sy = null, maxHit = null; const t0 = Date.now();
    const finish = (q) => { if (done) return; done = true; window.removeEventListener('pointerdown', onDown, true); window.removeEventListener('pointermove', onMove, true); window.removeEventListener('pointerup', onUp, true); strikeFeedback(ui, a.x, a.y, q); ui.close(); resolve(q); };
    const onDown = (e) => { sx = e.clientX; sy = e.clientY; };
    const onMove = (e) => {
      if (sx == null || maxHit) return;
      if (spec.ok(e.clientX - sx, e.clientY - sy)) { maxHit = true; try { SFX.swoosh(); } catch (_) {} haptic(HAP.swipe); const rem = dur - (Date.now() - t0); finish(rem <= 260 ? 'perfect' : 'good'); }
    };
    const onUp = () => { sx = null; };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
    setTimeout(() => finish('miss'), dur);
  });
}
// STRIKE HOLD — the offensive CHARGE: press and hold through the wind-up, then
// it lands as one heavy SLAM.  A guardian's/mage's signature all-out beat.
function strikeHoldNote(targetEl, dur) {
  return new Promise(resolve => {
    const a = targetEl ? noteAnchor(targetEl) : { x: 500, y: 150 };
    const ui = mkParryUiAt(a.x, a.y, `<span class="pr-hold-track"><span class="pr-hold-fill"></span></span><span class="pr-lbl">CHARGE</span>`, 'parry-hold pr-strike pr-big');
    ui.el.querySelector('.pr-hold-fill').style.animationDuration = dur + 'ms';
    const lbl = ui.el.querySelector('.pr-lbl');
    let done = false, holding = false, everHeld = false;
    const finish = (q) => { if (done) return; done = true; window.removeEventListener('pointerdown', onDown, true); window.removeEventListener('pointerup', onUp, true); strikeFeedback(ui, a.x, a.y, q); ui.close(); resolve(q); };
    const onDown = () => { if (!everHeld) { try { SFX.brace(); } catch (_) {} haptic(HAP.press); } holding = true; everHeld = true; ui.el.classList.add('pr-pressed'); lbl.textContent = 'SLAM!'; };
    const onUp = () => { holding = false; ui.el.classList.remove('pr-pressed'); };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointerup', onUp, true);
    setTimeout(() => finish(holding ? 'perfect' : everHeld ? 'good' : 'miss'), dur);
  });
}
// The rising CHAIN counter during the all-out — nailing strikes in a row ramps
// the damage multiplier, so a clean cascade reads as a building finisher.
function allOutCombo(chain, q) {
  let el = document.getElementById('parry-combo');
  if (!el) { el = document.createElement('div'); el.id = 'parry-combo'; $('#stage').appendChild(el); }
  if (chain >= 2) {
    el.innerHTML = `<span class="pc-num">${chain}</span><span class="pc-lbl">CHAIN</span>`;
    el.classList.remove('pc-pop'); void el.offsetWidth; el.classList.add('pc-on', 'pc-pop');
    clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('pc-on'), 1400);
  } else if (q === 'miss' || q === 'early') {
    el.classList.remove('pc-on');
  }
}

// ALL-OUT ATTACK — the momentum burst.  The whole party piles onto the enemy
// line one after another; PRIMED foes (exposed / chilled / weakened / staggered)
// take extra, so setting up before you spend the gauge pays off.
async function allOutCineIntro(heroes) {
  $('#stage').classList.add('frozen');
  const el = cineLayer();
  el.classList.remove('hidden', 'rc-out');
  el.innerHTML = `
    <div class="rc-wash allout"></div>
    <div class="rc-rays allout"></div>
    <div class="rc-sweep"></div>
    <div class="rc-host">${heroes.map(h => h.def.name).join('  ·  ')}</div>
    <div class="rc-name allout">⚔ ALL-OUT ATTACK</div>
    <div class="rc-type allout">MOMENTUM UNLEASHED</div>`;
  SFX.triad();
  cineFlash('rgba(255,120,80,0.55)');
  await sleep(1050);
  el.classList.add('rc-out');
  $('#stage').classList.remove('frozen');
  await sleep(200);
}
// The all-out is now INTERACTIVE — the reverse-parry.  As each hero piles on,
// a short cascade of STRIKE notes lands on the enemy line; tap each in time to
// accent the blow.  A running CHAIN of clean strikes ramps a damage multiplier,
// so a nailed cascade is a devastating finisher — but fumbling the timing
// deals a weak, glancing share (skill-gated: miss < a solid hit < perfect).
const ALLOUT = { base: 4, qmul: { perfect: 1.5, good: 1.0, miss: 0.4, early: 0.4 }, comboStep: 0.05, comboCap: 10 };
const ALLOUT_RHYTHM = [{ d: 560, g: 120 }, { d: 460, g: 80 }, { d: 440, g: 0 }];
// Each ARCHETYPE unleashes differently — the input you make expresses the class:
//   Ronin   flurries TAPS · Reaver rakes twin SWIPES · Guardian/Mage CHARGE a
//   heavy SLAM · Ranger looses an aimed shot then a raking SLASH · supports keep
//   a steady two-tap.  Fewer notes hit harder each (damage is normalised), so a
//   Guardian's single charged slam ≈ a Ronin's two quick cuts.
const ALLOUT_CASCADE = {
  Ronin:    [{ t: 'tap' }, { t: 'tap' }],
  Reaver:   [{ t: 'swipe', arc: 'arcR' }, { t: 'swipe', arc: 'arcL' }],
  Guardian: [{ t: 'hold' }],
  Mage:     [{ t: 'hold' }, { t: 'tap' }],
  Ranger:   [{ t: 'tap' }, { t: 'swipe', arc: 'arcU' }],
  Cleric:   [{ t: 'tap' }, { t: 'tap' }],
  Bard:     [{ t: 'tap' }, { t: 'tap' }],
  _default: [{ t: 'tap' }, { t: 'swipe', arc: 'arcR' }],
};
function allOutCoach() {
  let n = 0;
  try { n = parseInt(localStorage.getItem('kizuna2_1.strikeLessons') || '0', 10) || 0; } catch (_) {}
  if (n >= 3) return;
  try { localStorage.setItem('kizuna2_1.strikeLessons', String(n + 1)); } catch (_) {}
  let el = document.getElementById('parry-coach');
  if (!el) { el = document.createElement('div'); el.id = 'parry-coach'; $('#stage').appendChild(el); }
  el.textContent = 'TAP each STRIKE on the enemy — chain them for more damage';
  el.classList.remove('pc-show'); void el.offsetWidth; el.classList.add('pc-show');
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('pc-show'), 2800);
}
async function resolveAllOut() {
  S._burstResolving = true;
  const heroes = livingHeroes();
  // FORTRESS (Cassia) — the party braces before the storm.
  if (hasNode('cassia.allout.fortress') && heroes.some(h => h.id === 'cassia')) {
    heroes.forEach(h => { h.guard += 5; popupAt(figEl(h.id), '⛨ +5', 'guard'); });
  }
  await allOutCineIntro(heroes);
  $('#stage').classList.add('allout-focus');
  allOutCoach();
  let chain = 0, goodHits = 0;
  for (const h of heroes) {
    if (S.over || !livingEnemies().length) break;
    lungeFig(figEl(h.id));
    await sleep(90);
    // the hero's cascade is keyed to their ARCHETYPE — the gesture IS the class
    const casc = ALLOUT_CASCADE[h.def.cls] || ALLOUT_CASCADE._default;
    const noteBase = ALLOUT.base * (2 / casc.length);   // fewer notes → each hits harder
    for (let i = 0; i < casc.length; i++) {
      if (S.over || !livingEnemies().length) break;
      const tgt = frontmostEnemy() || livingEnemies()[0];
      if (!tgt) break;
      const nt = casc[i];
      const step = ALLOUT_RHYTHM[i] || { d: 480, g: 0 };
      let q;
      if (nt.t === 'swipe')     q = await strikeSwipeNote(figEl(tgt.uid), nt.arc || 'arcR', step.d + 140);
      else if (nt.t === 'hold') q = await strikeHoldNote(figEl(tgt.uid), 860);
      else                      q = await strikeNote(figEl(tgt.uid), i + 1, casc.length, step.d);
      const good = q === 'perfect' || q === 'good';
      if (good) goodHits++;
      chain = good ? chain + 1 : 0;
      allOutCombo(chain, q);
      const comboMul = 1 + Math.min(chain, ALLOUT.comboCap) * ALLOUT.comboStep;
      const qmul = ALLOUT.qmul[q] ?? 0.4;
      cineFlash(q === 'perfect' ? 'rgba(255,120,80,0.5)' : 'rgba(255,240,210,0.4)');
      if (q === 'perfect') stageShake();
      for (const e of livingEnemies()) {
        let dmg = Math.max(1, Math.round(noteBase * qmul * comboMul));
        const primed = e.staggered || e.weakened || e.mark || e.lull;
        if (primed) { dmg = Math.round(dmg * 1.5); }                 // detonate the setup
        dealToEnemy(e, dmg, h.def.school, h.id);
        if (primed) popupAt(figEl(e.uid), '⚡ TECHNICAL', 'info');
        if (allOutExecutes(e)) {                                     // ALT ALL-OUT: Rite of Endings
          popupAt(figEl(e.uid), '☠ EXECUTED', 'dmg');
          dealToEnemy(e, e.hp, h.def.school, h.id);              // finish the wounded
        }
      }
      renderAll();
      if (checkEnd()) break;
      if (step.g) await sleep(step.g);
    }
    if (checkEnd()) break;
  }
  // DAWNBREAK (Elin) — the light spills over when the storm passes.
  if (!S.over && hasNode('elin.allout.dawn') && livingHeroes().some(h => h.id === 'elin')) {
    livingHeroes().forEach(h => { h.hp = Math.min(h.maxHp, h.hp + 5); popupAt(figEl(h.id), '✚5', 'heal'); });
    SFX.heal();
  }
  S.momentum = 0;
  S.combo = 0;
  S.allOutUsed = (S.allOutUsed || 0) + 1;
  // a clean ALL-OUT pays embers — the better the cascade, the bigger the bounty
  const aoBonus = Math.min(4, Math.floor(goodHits / 2));
  if (aoBonus > 0) {
    addEmbers(aoBonus); if (S) S._embersRun = (S._embersRun || 0) + aoBonus;
    const anchor = livingEnemies()[0] || livingHeroes()[0];
    if (anchor) popupAt(figEl(anchor.uid || anchor.id), '✦ +' + aoBonus, 'ember');
  }
  S._burstResolving = false;
  $('#stage').classList.remove('allout-focus');
  resonantCineEnd();
  renderAll();
}
async function triggerAllOut() {
  if (!burstReady()) return;
  haptic(HAP.burst);
  S.executing = true;
  $('#stage').classList.add('executing');
  renderAll();
  await resolveAllOut();
  S.executing = false;
  $('#stage').classList.remove('executing');
  renderAll();
  checkEnd();
}

async function resolveResonant() {
  const r = triadEntry();
  S.resonantUsed = true;
  const key = trioClassKey(livingHeroes().map(h => h.id));
  const rank = vowRank(key);
  const rankBonus = (rank - 1) * 2;
  recordVow(key);
  const host = HEROES[S.resonantHostId];
  await resonantCineIntro(r, host, rank);
  flashNarrator('✦ The vow deepens — spoken ' + vowUses(key) + ' time' + (vowUses(key) > 1 ? 's' : '') + '.');
  for (const st of (r.stages || [])) {
    flashNarrator('✦ ' + st.text);
    const fx = {};
    Object.assign(fx, st.fx || {});
    ['aoeDmg', 'hitFrontmost', 'healAll', 'guardAll', 'guardFront', 'buffAllDmg'].forEach(k => {
      if (fx[k]) fx[k] += rankBonus;
    });
    // Each stage lands as its own beat: an impact flash, then the numbers
    // RIPPLE across the line (small gaps) so every hit stays readable.
    const offensive = fx.aoeDmg || fx.hitFrontmost;
    cineFlash(offensive ? 'rgba(212,69,69,0.5)' : 'rgba(240,212,136,0.45)');
    await sleep(180);
    if (fx.aoeDmg) { for (const e of livingEnemies()) { dealToEnemy(e, fx.aoeDmg + (e.mark || 0)); await sleep(150); } }
    if (fx.hitFrontmost) { const t = frontmostEnemy(); if (t) dealToEnemy(t, fx.hitFrontmost + (t.mark || 0)); }
    if (fx.healAll) { for (const h of livingHeroes()) { h.hp = Math.min(h.maxHp, h.hp + fx.healAll); popupAt(figEl(h.id), '+' + fx.healAll, 'heal'); SFX.heal(); await sleep(110); } }
    if (fx.guardAll) { for (const h of livingHeroes()) { h.guard += fx.guardAll; popupAt(figEl(h.id), '⛨ ' + fx.guardAll, 'guard'); await sleep(90); } }
    if (fx.guardFront) { const h = heroInRow('front'); if (h) { h.guard += fx.guardFront; popupAt(figEl(h.id), '⛨ ' + fx.guardFront, 'guard'); } }
    if (fx.buffAllDmg) { for (const h of livingHeroes()) { h.buffDmg += fx.buffAllDmg; popupAt(figEl(h.id), '▲ +' + fx.buffAllDmg + ' NEXT', 'rally'); await sleep(90); } }
    if (fx.counterAll) livingHeroes().forEach(h => { h.counter = Math.max(h.counter, fx.counterAll); });
    if (fx.lullAll) { for (const e of livingEnemies()) { e.lull = (e.lull || 0) + fx.lullAll; popupAt(figEl(e.uid), '❄ CHILL −' + fx.lullAll, 'chill'); await sleep(90); } }
    if (fx.markAll) { for (const e of livingEnemies()) { e.mark = fx.markAll; popupAt(figEl(e.uid), '◎ EXPOSED +' + fx.markAll, 'info'); await sleep(90); } }
    if (fx.invulnFront) { const h = heroInRow('front'); if (h) { h.invuln = true; popupAt(figEl(h.id), '✦ INVULNERABLE', 'info'); } }
    if (fx.pushBack) {
      // Formation: shove the enemy line one row toward the back.  Processed
      // back-to-front so a vacated row can receive the next enemy.
      ['mid', 'front'].forEach(row => {
        const to = row === 'mid' ? 'back' : 'mid';
        livingEnemies().filter(e => e.row === row).forEach(e => {
          if (!livingEnemies().some(o => o !== e && o.row === to)) {
            e.row = to;
            popupAt(figEl(e.uid), 'PUSHED', 'info');
          }
        });
      });
    }
    renderAll();
    await sleep(560);
    if (checkEnd()) { resonantCineEnd(); return; }
  }
  resonantCineEnd();
}

// ---------------------------------------------------------------------------
// DUET — a kindled pair's shared resonance.  Lighter than the triad: no field
// freeze, no full-turn cost — a bright beat and a card forged into the hand.
// ---------------------------------------------------------------------------
function forgeDuetCard(card) {
  // A duet is a MAJOR moment — it bypasses the 3-card temp cap so it always lands.
  card.temp = true;
  card.uid = ++S._tuid;
  S.tempCards.push(card);
  S._tempNew = card.uid;
  SFX.card();
}
async function awakenDuet(a, b) {
  const key = pairKey(a, b);
  if (bondPts(key) < BOND_KINDLED) return false;            // only KINDLED bonds can awaken
  S.pairsAwake = S.pairsAwake || new Set();
  if (S.pairsAwake.has(key)) return false;                  // once per fight
  const ha = S.heroes.find(x => x.id === a), hb = S.heroes.find(x => x.id === b);
  if (!ha || ha.downed || !hb || hb.downed) return false;
  S.pairsAwake.add(key);
  const d = duetFor(a, b);
  const rank = vowRank(duetClassKey(a, b));
  const suffix = rank > 1 ? ' ' + ROMAN[rank] : '';
  // The awaken beat — mirrors the triad's spark WITHOUT freezing the field.
  sparkThread(a, b);
  SFX.thread();
  cineFlash('rgba(240,212,136,0.4)');
  flashNarrator('✦ DUET — ' + HEROES[a].name + ' & ' + HEROES[b].name + ' awaken ' + d.name + suffix);
  forgeDuetCard({
    kind: 'resonant', pair: true, pairIds: [a, b], owner: 'duet',
    ownerName: HEROES[a].name + ' & ' + HEROES[b].name,
    tint: 'var(--gold-bright)', stance: 'DUET',
    name: d.name + suffix, cost: DUET_COST, target: 'none',
    fx: { resonant: true, duet: true, pairIds: [a, b] },
    desc: d.desc + (rank > 1 ? `  <span class="kw kw-rally">DEEPENED ×${rank - 1}</span>` : '')
      + `  A shared vow — costs <b>${DUET_COST} EP</b>.`, spent: false });
  renderAll();
  return true;
}
async function resolveDuet(card) {
  const [a, b] = card.pairIds || [];
  const d = duetFor(a, b);
  const ck = duetClassKey(a, b);
  const rank = vowRank(ck);
  const rankBonus = rank - 1;   // duets deepen a touch each time they're spoken
  recordVow(ck);
  const pair = [a, b].map(id => S.heroes.find(h => h.id === id)).filter(h => h && !h.downed);
  flashNarrator('✦ ' + d.name + ' — ' + HEROES[a].name + ' & ' + HEROES[b].name);
  for (const st of (d.stages || [])) {
    flashNarrator('✦ ' + st.text);
    const fx = Object.assign({}, st.fx || {});
    ['aoeDmg', 'hitFrontmost', 'pairHeal', 'pairGuard', 'guardFront', 'pairRally'].forEach(k => {
      if (fx[k]) fx[k] += rankBonus;
    });
    const offensive = fx.aoeDmg || fx.hitFrontmost;
    cineFlash(offensive ? 'rgba(212,69,69,0.45)' : 'rgba(240,212,136,0.4)');
    await sleep(160);
    if (fx.aoeDmg) { for (const e of livingEnemies()) { dealToEnemy(e, fx.aoeDmg + (e.mark || 0)); await sleep(140); } }
    if (fx.hitFrontmost) { const t = frontmostEnemy(); if (t) dealToEnemy(t, fx.hitFrontmost + (t.mark || 0)); }
    if (fx.pairHeal) { for (const h of pair) { h.hp = Math.min(h.maxHp, h.hp + fx.pairHeal); popupAt(figEl(h.id), '+' + fx.pairHeal, 'heal'); SFX.heal(); await sleep(100); } }
    if (fx.pairGuard) { for (const h of pair) { h.guard += fx.pairGuard; popupAt(figEl(h.id), '⛨ ' + fx.pairGuard, 'guard'); await sleep(80); } }
    if (fx.guardFront) { const h = pair.find(x => x.row === 'front') || heroInRow('front'); if (h) { h.guard += fx.guardFront; popupAt(figEl(h.id), '⛨ ' + fx.guardFront, 'guard'); } }
    if (fx.pairRally) { for (const h of pair) { h.buffDmg += fx.pairRally; popupAt(figEl(h.id), '▲ +' + fx.pairRally + ' NEXT', 'rally'); await sleep(80); } }
    if (fx.pairCounter) pair.forEach(h => { h.counter = Math.max(h.counter, fx.pairCounter); });
    if (fx.markFront) { const t = frontmostEnemy(); if (t) { t.mark = (t.mark || 0) + fx.markFront; popupAt(figEl(t.uid), '◎ EXPOSED +' + fx.markFront, 'info'); } }
    if (fx.markAll) { for (const e of livingEnemies()) { e.mark = (e.mark || 0) + fx.markAll; popupAt(figEl(e.uid), '◎ EXPOSED +' + fx.markAll, 'info'); await sleep(80); } }
    if (fx.lullAll) { for (const e of livingEnemies()) { e.lull = (e.lull || 0) + fx.lullAll; popupAt(figEl(e.uid), '❄ CHILL −' + fx.lullAll, 'chill'); await sleep(80); } }
    renderAll();
    await sleep(480);
    if (checkEnd()) return;
  }
}

// ---------------------------------------------------------------------------
// END TURN → enemy phase → next turn
// ---------------------------------------------------------------------------
async function endTurn() {
  if (S.executing || S.over) return;
  S.executing = true;
  $('#stage').classList.add('executing');
  renderAll();
  await enemyPhase();
  if (!S.over) {
    S.turn++;
    S.ep = S.maxEp;
    S.used = new Set();
    S._flags = {};   // per-turn passive latches (EP refunds) reset
    // IMMOVABLE (Cassia) keeps her guard through the enemy turn — everyone else's fades.
    S.heroes.forEach(h => { h.guard = keepsGuard(h.id) ? h.guard : 0; h.counter = 0; h.invuln = false; h.exposed = 0; h._hitByE = []; h.hexed = Math.max(0, (h.hexed || 0) - 1); });
    // EXPOSED (mark) now survives the turn rollover but FADES by 1, so a mark
    // laid down this turn still pays off next turn — making it a real setup,
    // not a same-turn-only tax.
    S.enemies.forEach(e => { e.mark = Math.max(0, (e.mark || 0) - 1); e.acted = false; e._hitBy = []; e.staggered = false; });
    S.tempCards = S.tempCards.filter(t => t.expiresTurn == null || t.expiresTurn >= S.turn);
    S._pressUsed = false;
    S.combo = 0;                 // the LINK chain is a within-turn combo
    S.channelUsed = false;
    S.executing = false;
    $('#stage').classList.remove('executing');
    // TURN-START passives — the wall braces, the light finds the hurt, the hunt resumes.
    livingHeroes().forEach(h => firePassives('turnStart', h.id, {}));
    turnBanner('TURN ' + S.turn, 'tb-player');
    renderAll();
  }
}

// Slim center banner marking the turn handoff — combat reads as call and
// response instead of popups appearing out of nowhere.
function turnBanner(text, cls) {
  const b = document.createElement('div');
  b.className = 'turn-banner ' + (cls || '');
  b.textContent = text;
  $('#stage').appendChild(b);
  setTimeout(() => b.remove(), 950);
}

async function enemyPhase() {
  turnBanner('ENEMY TURN', 'tb-enemy');
  _parryStreak = 0;   // a fresh parry combo for the phase
  // WEAKENED expires if you didn't capitalize this turn; STAGGERED holds
  // through the phase — a staggered enemy can be interrupted below.
  livingEnemies().forEach(e => { e.weakened = false; });
  await sleep(620);
  for (const e of livingEnemies()) {
    if (S.over) break;
    // A boss takes MULTIPLE actions per round; each is its own telegraphed,
    // parryable strike drawn from the next intents in its cycle.
    const times = (e.def.floorBoss && e.def.attacksPerRound) ? e.def.attacksPerRound : 1;
    for (let atk = 0; atk < times; atk++) {
    if (S.over || e.dead) break;
    const intent = e.def.intents[e.intentIdx % e.def.intents.length];
    e.intentIdx++;
    e.acted = true;
    renderTimeline();
    // INTERRUPT: a staggered enemy cannot release a HEAVY intent — the
    // wind-up breaks (the Bloodborne moment: aggression stops the big hit).
    if (e.staggered && intent.heavy) {
      e.staggered = false;
      popupAt(figEl(e.uid), 'INTERRUPTED', 'info');
      flashNarrator(e.def.name + '’s ' + intent.name + ' is BROKEN by the stagger.');
      SFX.kill();
      stageShake();
      renderAll();
      await sleep(650);
      continue;
    }
    const lungeEl = figEl(e.uid);
    if (intent.kind === 'buff') {
      await sleep(400);
      if (intent.guardSelf) { e.guard += intent.guardSelf; popupAt(figEl(e.uid), '⛨ ' + intent.guardSelf, 'guard'); SFX.guard(); }
      if (intent.powerSelf) { e.power += intent.powerSelf; popupAt(figEl(e.uid), '▲ +' + intent.powerSelf, 'rally'); }
      if (intent.powerAll) {
        livingEnemies().forEach(o => { o.power += intent.powerAll; popupAt(figEl(o.uid), '▲ +' + intent.powerAll, 'rally'); });
        flashNarrator(e.def.name + ' rallies the horde.');
      }
      renderAll();
      continue;
    }
    if (lungeEl) { lungeEl.classList.add('fig-lunge'); SFX.enemy(); }
    const eRow = effIntentRow(e, intent);                 // smart foes hunt the weakest
    const rows = eRow === 'all' ? ROWS.slice() : [eRow];
    // PARRY — a rhythm window on the wind-up whose PATTERN varies by attack.
    // Turning a blow aside doesn't deal damage; it CHARGES your BURST — parry is
    // the engine that fuels the all-out.  PERFECT negates + a big surge; a partial
    // BLOCKs half + a smaller surge; MISS lets the (heavier) blow land.
    // Reposition beforehand to dodge the row entirely instead.
    let parryMul = 1, perfectParry = false;
    const weightMode = PARRY_ENABLED && S.node && S.node.useRunHp;   // real run hits harder
    const ptRow = rows.find(r => heroInRow(r));
    const ptHero = ptRow ? heroInRow(ptRow) : null;
    if (PARRY_ENABLED && ptHero) {
      const res = await runParry(figEl(ptHero.id), parryPatternFor(intent), intent.attackArt);
      const mit = res ? res.mit : 0;                    // fraction of the blow negated
      if (res && res.perfect) {
        perfectParry = true; parryMul = 0;
        popupAt(figEl(ptHero.id), '⚔ PERFECT — +BURST ✦', 'tech');
        flashNarrator(ptHero.def.name + ' turns the blow — the burst swells!');
        parryFlash(figEl(ptHero.id));
        addEmbers(1); if (S) S._embersRun = (S._embersRun || 0) + 1;   // mastery pays embers
        gainMomentum(24, { combo: true });   // parry FEEDS the burst
        lungeFig(figEl(ptHero.id));
        renderAll();
        await sleep(240);
        if (e.dead || S.over) continue;
      } else if (mit > 0) {
        // PARTIAL — you caught some of the cascade; only the missed share lands
        parryMul = 1 - mit;
        popupAt(figEl(ptHero.id), '⛨ ' + Math.round(mit * 100) + '% PARRIED · +BURST', 'guard');
        gainMomentum(Math.round(6 + mit * 14), { combo: true });
      } else {
        parryMul = weightMode ? PARRY_MISS_MULT : 1;    // fully unparried = more weight
        if (weightMode) popupAt(figEl(ptHero.id), 'UNPARRIED!', 'dmg');
      }
    } else {
      await sleep(400);
    }
    let dmg = Math.round(enemyIntentDmg(e, intent) * parryMul);
    if (e.lull) e.lull = 0;
    let hitAny = false;
    for (const row of rows) {
      const h = heroInRow(row);
      if (!h) continue;
      hitAny = true;
      if (h.invuln) {
        popupAt(figEl(h.id), 'INVULNERABLE', 'info');
      } else {
        // Enemies fight by the player's grammar: EXPOSED heroes take more,
        // and a second enemy striking the same hero this phase FOLLOWS UP.
        let hitDmg = dmg + (h.exposed || 0);
        const hby = h._hitByE || (h._hitByE = []);
        const prevE = hby.length ? hby[hby.length - 1] : null;
        if (prevE && prevE !== e.uid) {
          hitDmg += 2;
          popupAt(figEl(e.uid), '⚡ FOLLOW-UP +2', 'info');
          SFX.follow();
        }
        hby.push(e.uid);
        // TEAM SYNERGY: Cassia soaks for allies in the rows behind her (Guardian's Aegis)
        const soak = soakMitigation(h);
        if (soak) { hitDmg = Math.max(0, hitDmg - soak); popupAt(figEl(h.id), '⛨ COVERED −' + soak, 'guard'); }
        let left = hitDmg;
        if (h.guard > 0) { const g = Math.min(h.guard, left); h.guard -= g; left -= g; popupAt(figEl(h.id), '⛨', 'guard'); }
        if (left > 0) {
          h.hp = Math.max(0, h.hp - left);
          const dtier = left >= 20 ? 3 : left >= 12 ? 2 : left >= 7 ? 1 : 0;
          const big = dtier >= 2;
          popupAt(figEl(h.id), '−' + left, 'dmg' + (big ? ' popup-big' : ''));
          impactFx(figEl(h.id), 'foe', big);   // red claw-strike on the hero
          struck(figEl(h.id), 'l'); haptic(dtier >= 2 ? HAP.struckBig || HAP.struck : HAP.struck);   // recoil + flash + stun
          hitFlash(dtier);                      // a heavy enemy blow rocks the screen
          SFX.hit(big);
          if (dtier >= 1) stageShake(['sm', 'sm', 'lg', 'xl'][dtier]);
          (e._damaged || (e._damaged = [])).push(h.id);   // remembered for AVENGE
          // DRAIN — the Maw feeds: a share of the damage dealt heals it.  Staggered
          // (its wind-up broken) it cannot feed, so STAGGER is the counter.
          if (intent.drain && !e.staggered) {
            const fed = Math.max(1, Math.round(left * intent.drain));
            e.hp = Math.min(e.maxHp, e.hp + fed);
            popupAt(figEl(e.uid), '♥ +' + fed, 'heal');
          }
        }
      }
      if (!perfectParry && intent.chill)  { h.chill = (h.chill || 0) + intent.chill; popupAt(figEl(h.id), '❄ CHILL −' + intent.chill, 'chill'); }
      if (!perfectParry && intent.expose) { h.exposed = (h.exposed || 0) + intent.expose; popupAt(figEl(h.id), '◎ EXPOSED +' + intent.expose, 'info'); }
      // HEX — the Maw's curse.  If you don't DODGE the row (or perfect-parry), the
      // hex clings: while hexed, every card you play burns another from your hand.
      if (!perfectParry && intent.hex) { h.hexed = Math.max(h.hexed || 0, intent.hex); popupAt(figEl(h.id), '☠ HEXED', 'dmg'); }
      // REACTIVE: an ally in real danger summons their strongest bond.
      // Costed on purpose — the intercept scrambles formation and chills
      // the protector; declining it is as expressive as playing it.
      if (h.hp > 0 && h.hp * 2 <= h.maxHp && !S._notTodayGiven) {
        const protector = livingHeroes()
          .filter(x => x.id !== h.id)
          .map(x => ({ x, w: bondPts(pairKey(x.id, h.id)) + (S.threads.has(pairKey(x.id, h.id)) ? 1 : 0) }))
          .filter(o => o.w > 0)
          .sort((a, b) => b.w - a.w)[0];
        if (protector) {
          S._notTodayGiven = true;
          const pr = protector.x;
          genTempCard({ kind: 'temp', owner: pr.id, ownerName: pr.def.name, tint: pr.def.tint,
            stance: 'REACTIVE · RESCUE', name: 'Not Today', cost: 0, target: 'none',
            fx: { notToday: [pr.id, h.id] }, expiresTurn: S.turn + 1,
            desc: `<b>Free.</b> ${pr.def.name} throws themselves in the way — swap rows with ${h.def.name}, heal them 4, gain <span class="kw kw-guard">⛨ 4</span> <span class="kw kw-counter">↺ 2</span>. The cost is theirs: <span class="kw kw-chill">❄ CHILL −2</span> on ${pr.def.name}’s next strike.` });
          flashNarrator(pr.def.name + ' sees ' + h.def.name + ' falter — a card takes shape.');
        }
      }
      if (h.counter > 0 && !e.dead) { dealToEnemy(e, h.counter); flashNarrator(h.def.name + ' counters!'); }
      if (h.hp === 0) { h.downed = true; popupAt(figEl(h.id), 'DOWN', 'dmg'); }
    }
    if (!hitAny) {
      popupAt(figEl(e.uid), 'MISS', 'info');
      flashNarrator(e.def.name + '’s ' + intent.name + ' finds an empty row.');
    }
    renderAll();
    await sleep(400);
    if (checkEnd()) break;
    // A clear BREATHER between the boss's two blows — the second wind-up gets its
    // own telegraph and a beat to read, so the pair lands as call-and-response
    // instead of a single overwhelming wall of notes.
    if (atk + 1 < times) { flashNarrator(e.def.name + ' winds up again…'); await sleep(560); }
    }
    if (S.over) break;
  }
}

function checkEnd() {
  if (S.over) return true;
  if (!livingEnemies().length) { S.over = true; onVictory(); return true; }
  if (!livingHeroes().length) { S.over = true; onDefeat(); return true; }
  return false;
}

function onVictory() {
  // Write survivors' HP back into the run (downed heroes stagger up at 6).
  let bondLines = [];
  if (S.node.useRunHp && RUN) {
    S.heroes.forEach(h => { RUN.hp[h.id] = h.downed ? 6 : h.hp; });
    if (S.node.mapId != null && !RUN.completed.includes(S.node.mapId)) RUN.completed.push(S.node.mapId);
    // Fighting together with a thread held IS the reward: the pair grows.
    RUN.bonds = RUN.bonds || {};
    S.threads.forEach(k => {
      const before = RUN.bonds[k] || 0;
      RUN.bonds[k] = before + 1;
      const [a, b] = k.split('|');
      const name = HEROES[a].name + ' ─ ' + HEROES[b].name;
      bondLines.push(before + 1 === BOND_KINDLED ? name + ' · KINDLED' : name + ' +1');
    });
    saveRun();
  }
  const isBoss = S.node.isBoss || S.node.enemies.some(id => ENEMY_DEFS[id].boss);
  // a CLEAR pays a small steady bounty on top of the per-kill embers, so every
  // fight advances the tree a little (not just a trickle between boss lumps).
  const clearBonus = isBoss ? 3 : (S.node.elite ? 2 : 1);
  addEmbers(clearBonus); S._embersRun = (S._embersRun || 0) + clearBonus;
  SFX.victory();
  setTimeout(() => {
    if (!S) return;   // the fight was torn down before this deferred beat fired
    if (isBoss && S.node.mapId != null) { onFloorCleared(); return; }   // floor boss → deeper, or the run's end
    const th = S.threads.size;
    showOverlay(`
      <div class="ov-eyebrow" style="color:var(--gold-bright)">VICTORY</div>
      <div class="ov-title" style="font-size:22px">${isBoss ? 'THE ECHO FADES' : 'THE ROAD HOLDS'}</div>
      ${th ? `<div class="ov-sub">${th} thread${th > 1 ? 's' : ''} held${S.triadFormed ? ' · the triad answered' : ''}</div>` : ''}
      ${S._embersRun ? `<div class="ov-embers">✦ ${S._embersRun} embers gathered — spend them on the <b>Ember Tree</b></div>` : ''}
      ${bondLines.length ? `<div class="bond-growth">${bondLines.map(l => `<span class="bg-line${/KINDLED/.test(l) ? ' bg-kindled' : ''}">♡ ${l}</span>`).join('')}</div>` : ''}
      <button class="ov-btn primary" id="ov-next">CONTINUE</button>
    `);
    const wasElite = !!S.node.elite;   // an elite kill hands you a companion's gift
    $('#ov-next').onclick = () => {
      hideOverlay();
      if (S.node.mapId == null) { advanceFlow(); return; }
      if (wasElite) showBoonDraft(() => showMap(), { eyebrow: 'THE ELITE FALLS', title: 'SPOILS OF THE ROAD', flavor: 'The harder the fight, the more your companions have to teach. Take one — it holds until you fall.' });
      else showMap();
    };
  }, 700);
}
function onDefeat() {
  // On the Descent, death is contribution: the run ends, and the Abyss
  // stores a memory of who fell here — the next descent will find it.
  if (S.node.mapId != null && RUN) {
    const memLevel = S.node.level != null ? S.node.level : S.node.depth;
    const abyss = loadAbyss();
    abyss[memLevel] = {
      trio: RUN.active.slice(),
      threads: [...S.threads],
      label: S.node.label || (mapNode(S.node.mapId) || {}).label || 'the dark',
    };
    saveAbyss(abyss);
    try { localStorage.removeItem(RUN_KEY); } catch (_) {}
    RUN = null;
    const names = abyss[memLevel].trio.map(id => HEROES[id].name).join(' · ');
    setTimeout(() => {
      showOverlay(`
        <div class="ov-eyebrow">THE DESCENT ENDS</div>
        <div class="ov-title" style="font-size:22px">THE THREAD FRAYS</div>
        <div class="ov-lines" style="text-align:center; min-height:0">
          <div class="ov-line">${names} fall at <b>${abyss[memLevel].label}</b>.</div>
          <div class="ov-line">But nothing here is wasted. <b>The Abyss remembers.</b></div>
        </div>
        <button class="ov-btn primary" id="ov-fallen">RETURN TO THE SURFACE</button>
      `);
      $('#ov-fallen').onclick = () => { hideOverlay(); showTitle(); };
    }, 700);
    return;
  }
  // Tutorial defeats stay forgiving: retry the same beat.
  setTimeout(() => {
    showOverlay(`
      <div class="ov-eyebrow">DEFEAT</div>
      <div class="ov-title" style="font-size:22px">THE THREAD FRAYS</div>
      <div class="ov-sub">but does not break</div>
      <button class="ov-btn primary" id="ov-retry">TRY AGAIN</button>
    `);
    $('#ov-retry').onclick = () => { hideOverlay(); startFlowNode(); };
  }, 700);
}
// A floor boss falls — either you drop into the next, deeper floor (keeping your
// whole in-run build), or, on the final floor, the descent is truly cleared.
function onFloorCleared() {
  if ((RUN.floor || 1) >= FLOORS) { onRunComplete(); return; }
  RUN.depthBase = (RUN.depthBase || 0) + (RUN.completed ? RUN.completed.length : 0);   // the ramp keeps rising
  RUN.floor = (RUN.floor || 1) + 1;
  RUN.completed = [];
  RUN.map = generateDescent(RUN.roster, RUN.floor);
  RUN.roster.forEach(id => { RUN.hp[id] = HEROES[id].maxHp; });   // catch your breath before the deep
  saveRun();
  showOverlay(`
    <div class="ov-eyebrow" style="color:var(--gold-bright)">FLOOR ${RUN.floor - 1} · CLEARED</div>
    <div class="ov-title" style="font-size:24px">THE FLOOR GIVES WAY</div>
    <div class="ov-lines" style="text-align:center; min-height:0;">
      <div class="ov-line">The Echo shatters — and the ground beneath it opens onto a <b>deeper dark</b>.</div>
      <div class="ov-line">Down here the dead are <b>older, hungrier — and they learn</b>. Your kindled skills descend with you… but so does the price of falling.</div>
    </div>
    <button class="ov-btn primary" id="ov-deeper">DESCEND · FLOOR ${RUN.floor}</button>
  `);
  $('#ov-deeper').onclick = () => { hideOverlay(); showMap(); };
}
function onRunComplete() {
  RUN.done = true; saveRun();
  showOverlay(`
    <div class="ov-eyebrow" style="color:var(--gold-bright)">THE DESCENT · CLEARED</div>
    <div class="ov-title" style="font-size:26px">THE HUNGER STILLS</div>
    <div class="ov-lines" style="text-align:center; min-height:0;">
      <div class="ov-line">The Maw folds inward and is gone. For the first time, the deep dark is quiet.</div>
      <div class="ov-line"><b>The thread held — all the way down.</b> Every triangle you never formed still waits below: other trios, other vows, another descent.</div>
    </div>
    <button class="ov-btn primary" id="ov-title">BACK TO TITLE</button>
  `);
  $('#ov-title').onclick = () => { RUN = null; saveRun(); showTitle(); };
}

// ---------------------------------------------------------------------------
// FLOW (tutorial chapters)
// ---------------------------------------------------------------------------
function advanceFlow() {
  flowIdx++;
  try { localStorage.setItem(PROGRESS_KEY, String(flowIdx)); } catch (_) {}
  startFlowNode();
}
function startFlowNode() {
  const node = FLOW[flowIdx];
  if (!node) { startDescent(); return; }
  $('#chapter-chip').textContent = 'CH ' + (node.chapter || 1);
  if (node.type === 'story') showStory(node);
  else startFight(node);
}
function startFight(node) {
  S = newBattle(node);
  hideOverlay();
  flashNarrator(node.narrator || '');
  renderAll();
}

function showStory(node) {
  let revealed = 1;
  const render = () => {
    const linesHtml = node.lines.slice(0, revealed).map(l =>
      `<div class="ov-line">${l.spk ? `<span class="spk">${l.spk}</span>` : ''}${l.text}</div>`).join('');
    const done = revealed >= node.lines.length;
    showOverlay(`
      <div class="ov-eyebrow">${node.eyebrow || ''}</div>
      <div class="ov-title" style="font-size:24px">${node.title}</div>
      <div class="ov-lines">${linesHtml}</div>
      ${done
        ? `<button class="ov-btn primary" id="ov-go">${(node.next === 'descent' || node.beginDescent) ? 'BEGIN THE DESCENT' : (FLOW[flowIdx + 1] && FLOW[flowIdx + 1].type === 'fight' ? 'TO BATTLE' : 'CONTINUE')}</button>`
        : `<div class="ov-tap">tap to continue ▸</div>`}
    `);
    if (done) {
      $('#ov-go').onclick = (ev) => {
        ev.stopPropagation();
        hideOverlay();
        if (node.campDone) showPartySelect(() => showMap());
        else if (node.beginDescent) showMap();
        else if (node.next === 'descent') startDescent();
        else advanceFlow();
      };
    } else {
      $('#overlay').onclick = () => { $('#overlay').onclick = null; revealed++; render(); };
    }
  };
  render();
}

// ---------------------------------------------------------------------------
// THE DESCENT — map, recruits, camps, party composition.
// ---------------------------------------------------------------------------
function startDescent() {
  if (!RUN || RUN.done) RUN = newRun();
  try { localStorage.setItem(PROGRESS_KEY, String(FLOW.length)); } catch (_) {}
  saveRun();
  showMap();
}
function nodeReachable(n) {
  if (RUN.completed.includes(n.id)) return false;
  if (n.col === 1) return true;
  return mapAll().some(p => RUN.completed.includes(p.id) && p.next.includes(n.id));
}
function showMap() {
  S = null;
  $('#stage').classList.remove('show-bg');
  $('#chapter-chip').textContent = 'DESCENT';
  $('#timeline').innerHTML = '';
  const cols = {};
  mapAll().forEach(n => { (cols[n.col] = cols[n.col] || []).push(n); });
  const glyph = { fight: '⚔', elite: '✸', event: '?', recruit: '☉', camp: '⌂', boss: '☠' };
  // Your CURRENT position = the deepest completed node (where the trail ends).
  const doneNodes = mapAll().filter(n => RUN.completed.includes(n.id));
  const curNode = doneNodes.length ? doneNodes.reduce((a, b) => (b.col >= a.col ? b : a)) : null;
  const colHtml = Object.keys(cols).sort((a, b) => a - b).map(c => `
    <div class="map-col">
      ${cols[c].map(n => {
        const done = RUN.completed.includes(n.id);
        const reach = nodeReachable(n);
        const cur = curNode && n.id === curNode.id;
        return `<button class="map-node mn-${n.type}${done ? ' mn-done' : ''}${reach ? ' mn-reach' : ''}${cur ? ' mn-current' : ''}${(!done && !reach) ? ' mn-locked' : ''}"
          data-node="${n.id}" ${reach ? '' : 'disabled'} title="${n.label}">
          <span class="mn-pulse" aria-hidden="true"></span>
          <span class="mn-icon">${glyph[n.type]}</span>
          ${cur ? '<span class="mn-here" aria-hidden="true">▾</span>' : ''}
          ${done && !cur ? '<span class="mn-check" aria-hidden="true">✓</span>' : ''}
          ${n.mem ? '<span class="mn-mem" title="A previous descent fell here">♰</span>' : ''}
          <span class="mn-label">${n.label}</span>
        </button>`;
      }).join('')}
    </div>`).join('');
  const trio = RUN.active.map(id => `<span class="party-chip-fig">${V2PORTRAITS[id] || ''}</span>`).join('');
  const r = triadEntryFor(RUN.active);
  const mood = partyMood(), moodDef = MOODS[mood];
  // Only nag "kindle a skill" when you can actually AFFORD one — otherwise it
  // prompts an impossible action (and, since the teach never completes, nags
  // forever).  With embers-but-not-enough, coach toward gathering more.
  const hasEmbers = runEmbers() > 0;
  const canKindle = hasEmbers && !treeTaught() && canKindleNow();
  const coach = canKindle
    ? `<div class="map-coach">✦ You tore <b>${runEmbers()} embers</b> from the dead — open your <b>EMBER TREE</b> below and kindle your first skill before you press on.</div>`
    : (hasEmbers && !treeTaught()
      ? `<div class="map-coach map-coach-soft">✦ <b>${runEmbers()} embers</b> gathered. Fell a few more foes and you’ll have enough to kindle a skill in the <b>EMBER TREE</b>.</div>`
      : '');
  const boonStrip = (RUN.boons && RUN.boons.length)
    ? `<span class="map-boons">${RUN.boons.map(id => { const b = BOON_BY_ID[id]; return b ? `<span class="map-boon" style="--tint:${HEROES[b.hero].tint}" title="${HEROES[b.hero].name}’s ${b.name} — ${b.desc.replace(/<[^>]+>/g, '')}">${b.icon}</span>` : ''; }).join('')}</span>`
    : '';
  showOverlay(`
    <div class="ov-eyebrow">THE DESCENT${(RUN.floor || 1) >= 2 ? ` · FLOOR ${RUN.floor}` : ''}${moodDef && moodDef.label ? ` <span class="map-mood" style="color:${moodDef.tint}; border-color:${moodDef.tint}66">♦ ${moodDef.label}</span>` : ''}${boonStrip}</div>
    <div class="ov-title" style="font-size:20px; margin-bottom:14px;">${(RUN.floor || 1) >= 2 ? 'THE DEEPER DARK' : 'CHOOSE THE ROAD'}</div>
    <div class="map-strip"><svg class="map-edges" aria-hidden="true"></svg>${colHtml}</div>
    ${coach}
    <div class="map-footer">
      <button class="party-chip" id="map-party">
        ${trio}
        <span class="party-chip-meta">PARTY · resonates as <b>✦ ${r.name}</b> <i>(${r.type})</i></span>
      </button>
      <button class="map-tree-btn${canKindle ? ' mt-glow mt-teach' : (hasEmbers ? ' mt-glow' : '')}" id="map-tree">✦ EMBER TREE<span class="mt-embers">${runEmbers()}</span></button>
    </div>
  `, 'map-screen');
  document.querySelectorAll('.map-node.mn-reach').forEach(el => {
    el.onclick = () => enterMapNode(mapNode(+el.dataset.node));
  });
  $('#map-party').onclick = () => showPartySelect(() => showMap());
  // the tree only holds your PARTY's constellations — open on the first member
  $('#map-tree').onclick = () => showEmberTree(showMap, (RUN.active && RUN.active[0]) || 'ash');
  // draw the connecting edges once the overlay has laid out (two frames so the
  // scale/opacity intro is settled and node positions are final)
  requestAnimationFrame(() => requestAnimationFrame(drawMapEdges));
}
// Curved connector edges: a bright GOLD trail through the nodes you've walked,
// highlighted edges for the choices open right now, dim for the road ahead.
function drawMapEdges() {
  const strip = document.querySelector('.map-strip');
  const svg = strip && strip.querySelector('.map-edges');
  if (!strip || !svg) return;
  const sr = strip.getBoundingClientRect();
  if (!sr.width) return;
  svg.setAttribute('viewBox', `0 0 ${sr.width} ${sr.height}`);
  const centerOf = (id) => {
    const el = strip.querySelector(`.map-node[data-node="${id}"] .mn-icon`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2 - sr.left, y: r.top + r.height / 2 - sr.top };
  };
  let html = '';
  mapAll().forEach(n => {
    const a = centerOf(n.id); if (!a) return;
    (n.next || []).forEach(nid => {
      const b = centerOf(nid); if (!b) return;
      const nDone = RUN.completed.includes(n.id);
      const mDone = RUN.completed.includes(nid);
      const mReach = nodeReachable(mapNode(nid));
      const cls = (nDone && mDone) ? 'me-taken' : (nDone && mReach) ? 'me-open' : 'me-future';
      const mx = (a.x + b.x) / 2;
      html += `<path class="me ${cls}" d="M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}"/>`;
    });
  });
  svg.innerHTML = html;
}
function resolveMapNode(n) {
  if (n.type === 'fight' || n.type === 'elite' || n.type === 'boss') startMapFight(n);
  else if (n.type === 'recruit') showRecruit(n);
  else if (n.type === 'camp') showCamp(n);
  else if (n.type === 'event') showEvent(n);
}
function enterMapNode(n) {
  hideOverlay();
  if (n.mem) { showMemory(n, n.mem); return; }
  resolveMapNode(n);
}
// Discovery of a fallen descent — take up their thread, and their bonds echo
// into this run.  Consumed once found.
function showMemory(n, mem) {
  const names = mem.trio.map(id => (HEROES[id] || {}).name || id).join(' · ');
  const th = (mem.threads || []).length;
  showOverlay(`
    <div class="ov-eyebrow">♰ ASHES OF A DESCENT</div>
    <div class="ov-title" style="font-size:20px">SOMEONE FELL HERE</div>
    <div class="ov-lines" style="text-align:center; min-height:0">
      <div class="ov-line"><b>${names}</b> — they made it this far, once.</div>
      <div class="ov-line">${th ? `Their ${th} thread${th > 1 ? 's' : ''} still hum in the cold air.` : 'The ashes are quiet, but still warm.'}</div>
    </div>
    <button class="ov-btn primary" id="ov-takeup">TAKE UP THEIR THREAD</button>
    <div class="ov-hint">${th ? '+1 ♡ TO EACH BOND THEY HELD · ' : ''}THE PARTY HEALS 4 BY THEIR FIRE</div>
  `);
  $('#ov-takeup').onclick = () => {
    RUN.bonds = RUN.bonds || {};
    (mem.threads || []).forEach(k => { RUN.bonds[k] = (RUN.bonds[k] || 0) + 1; });
    RUN.roster.forEach(id => { RUN.hp[id] = Math.min(HEROES[id].maxHp, (RUN.hp[id] || HEROES[id].maxHp) + 4); });
    const abyss = loadAbyss();
    delete abyss[n.memLevel != null ? n.memLevel : n.level];
    saveAbyss(abyss);
    n.mem = null;
    saveRun();
    hideOverlay();
    resolveMapNode(n);
  };
}
function showEvent(n) {
  const ev = EVENTS_V2[n.eventId] || EVENTS_V2.shrine;
  const choice = (c, id) => `
    <button class="ev-choice" id="${id}">
      <span class="ev-choice-icon">${c.icon || '◆'}</span>
      <span class="ev-choice-body">
        <span class="ev-choice-label">${c.label}</span>
        <span class="ev-choice-effect">${c.effect || ''}</span>
      </span>
    </button>`;
  showOverlay(`
    <div class="ov-eyebrow">${ev.eyebrow || 'A CROSSROADS'}</div>
    <div class="ov-title" style="font-size:22px">${ev.title}</div>
    <div class="ov-lines" style="text-align:center; min-height:0">${ev.lines.map(t => `<div class="ov-line">${t}</div>`).join('')}</div>
    <div class="ev-choices">${choice(ev.a, 'ev-a')}${choice(ev.b, 'ev-b')}</div>
  `, 'event-screen');
  const finish = (choice) => {
    if (!RUN.completed.includes(n.id)) RUN.completed.push(n.id);
    if (choice.boon) {   // this branch offers a companion's gift — into the draft
      saveRun();
      showBoonDraft(() => showMap(), { eyebrow: ev.title.toUpperCase(), title: 'A COMPANION’S GIFT', flavor: 'They show you a piece of how they fight. Take one — it holds until you fall.' });
      return;
    }
    if (choice.fx) choice.fx();
    saveRun();
    showMap();
  };
  $('#ev-a').onclick = () => finish(ev.a);
  $('#ev-b').onclick = () => finish(ev.b);
}
function startMapFight(n) {
  const boss = !!n.isBoss;
  const floor = RUN.floor || 1;
  const begin = () => {
    let enemies = n.enemies.slice();
    let ambush = '';
    // A wronged traveler has been waiting on the road — they spring the ambush
    // now (never onto a boss; the boss is its own reckoning).
    if (!boss && RUN.foes && RUN.foes.length) {
      const foes = RUN.foes.splice(0);
      foes.forEach(fid => enemies.push(ensureFoeDef(fid)));
      ambush = ' — ' + foes.map(fid => 'VENGEFUL ' + HEROES[fid].name).join(' & ') + ' springs from cover.';
      saveRun();
    }
    startFight({ type: 'fight', chapter: 3, heroes: RUN.active.slice(), enemies,
      useRunHp: true, mapId: n.id, depth: n.level || n.col, floor, elite: !!n.elite, isBoss: boss,
      nodeType: n.type, label: n.label, level: n.level, ambush: !!ambush,
      narrator: ambush ? (n.label + ambush) : n.label + (boss ? (floor >= 2 ? ' — it is hungry.' : ' — it remembers you.') : (n.elite ? ' — a deeper sin waits.' : (floor >= 2 ? ' — the deep dark stirs.' : ''))) });
    $('#chapter-chip').textContent = ambush ? 'AMBUSH' : (boss ? 'BOSS' : (n.elite ? 'ELITE' : 'DESCENT')) + (floor >= 2 ? ' · FL' + floor : '');
  };
  if (boss) bossIntro(n.enemies[0], begin);   // a dramatic cutscene precedes the boss
  else begin();
}

// ---------------------------------------------------------------------------
// BOSS INTRO — a dramatic full-screen cutscene: the colossus rises from the
// dark, its eyes ignite, its NAME slams the screen, it speaks — then the fight.
// ---------------------------------------------------------------------------
const BOSS_CINE = {
  echoknight2:  { name: 'THE ECHO KNIGHT', epithet: 'THE REMEMBERED', eye: '#ff5038', roar: 'blade',
    quote: 'You buried me once. I have counted every hand that threw the dirt.' },
  echodevourer: { name: 'THE HOLLOW MAW', epithet: 'IT HUNGERS', eye: '#a86bff', roar: 'maw',
    quote: 'Down here, everything is food. Even the little light you carry.' },
};
let _bossCineBusy = false;
function bossIntro(bossId, onDone) {
  const c = BOSS_CINE[bossId] || BOSS_CINE.echoknight2;
  const def = ENEMY_DEFS[bossId] || {};
  const art = V2PORTRAITS[def.art || bossId] || '';
  hideOverlay();
  $('#stage').classList.remove('show-bg');
  const old = document.getElementById('boss-cine'); if (old) old.remove();
  const el = document.createElement('div');
  el.id = 'boss-cine';
  el.className = c.roar === 'maw' ? 'bc-maw' : 'bc-knight';
  el.style.setProperty('--bc-eye', c.eye);
  el.innerHTML = `
    <div class="bc-bar bc-bar-t"></div>
    <div class="bc-bar bc-bar-b"></div>
    <div class="bc-rays"></div>
    <div class="bc-vign"></div>
    <div class="bc-boss"><div class="bc-glow"></div><div class="bc-art">${art}</div><div class="bc-eyes"><span></span><span></span></div></div>
    ${Array.from({ length: 16 }).map((_, i) => `<span class="bc-ember" style="--i:${i}"></span>`).join('')}
    <div class="bc-flash"></div>
    <div class="bc-txt">
      <div class="bc-epithet">${c.epithet}</div>
      <div class="bc-name">${c.name}</div>
      <div class="bc-rule"></div>
      <div class="bc-quote">“${c.quote}”</div>
    </div>
    <div class="bc-skip">TAP TO FACE IT</div>`;
  $('#stage').appendChild(el);
  _bossCineBusy = true;
  requestAnimationFrame(() => el.classList.add('bc-run'));
  const timers = [];
  const at = (ms, fn) => timers.push(setTimeout(fn, ms));
  at(260,  () => { if (SFX.enemy) SFX.enemy(); stageShake('sm'); });                        // the ground rumbles
  at(1150, () => { if (SFX.kill) SFX.kill(); stageShake('lg'); el.classList.add('bc-eyes-on'); });  // eyes ignite
  at(2050, () => { if (SFX.kill) SFX.kill(); if (SFX.enemy) SFX.enemy(); stageShake('xl'); el.classList.add('bc-slam'); });  // NAME slams
  at(2450, () => stageShake('md'));
  let done = false;
  const finish = () => {
    if (done) return; done = true;
    timers.forEach(clearTimeout);
    el.classList.add('bc-out');
    setTimeout(() => { el.remove(); _bossCineBusy = false; onDone(); }, 460);
  };
  el.addEventListener('pointerdown', finish);
  at(6400, finish);   // auto-advance if they don't tap
  return el;
}
// KINDLE BURST — the moment a skill catches.  A full-screen ember-bloom over the
// tree: the node's glyph ignites, ember shards fan out, the skill NAME slams in
// and its effect line resolves.  Short, skippable, then back to the tree.
let _kindleBusy = false;
function kindleBurst(node, onDone) {
  const heroName = (HEROES[node.hero] && HEROES[node.hero].name) || '';
  const tint = (HEROES[node.hero] && HEROES[node.hero].tint) || '#e8b84a';
  const glyph = TREE_TYPE_GLYPH[node.type] || '✦';
  const kind = TREE_TYPE_LABEL[node.type] || 'SKILL';
  const old = document.getElementById('kindle-fx'); if (old) old.remove();
  const el = document.createElement('div');
  el.id = 'kindle-fx';
  el.className = 'kf t-' + node.type;
  el.style.setProperty('--kf-tint', tint);
  el.innerHTML = `
    <div class="kf-scrim"></div>
    <div class="kf-rays"></div>
    <div class="kf-flash"></div>
    <div class="kf-core">
      <div class="kf-halo"></div>
      <div class="kf-glyph">${glyph}</div>
      ${Array.from({ length: 18 }).map((_, i) => `<span class="kf-shard" style="--i:${i}"></span>`).join('')}
    </div>
    <div class="kf-txt">
      <div class="kf-eyebrow">${heroName} · NEW ${kind}</div>
      <div class="kf-name">${node.label}</div>
      <div class="kf-rule"></div>
      <div class="kf-desc">${node.desc}</div>
    </div>
    <div class="kf-skip">TAP TO CONTINUE</div>`;
  $('#stage').appendChild(el);
  _kindleBusy = true;
  if (SFX.kindle) SFX.kindle();
  requestAnimationFrame(() => el.classList.add('kf-run'));
  const timers = [];
  const at = (ms, fn) => timers.push(setTimeout(fn, ms));
  at(120, () => stageShake('sm'));
  at(620, () => { stageShake('md'); el.classList.add('kf-slam'); if (SFX.follow) SFX.follow(); });
  let done = false;
  const finish = () => {
    if (done) return; done = true;
    timers.forEach(clearTimeout);
    el.classList.add('kf-out');
    setTimeout(() => { el.remove(); _kindleBusy = false; (onDone || function () {})(); }, 360);
  };
  el.addEventListener('pointerdown', () => { if (el.classList.contains('kf-ready')) finish(); });
  at(700, () => el.classList.add('kf-ready'));   // ignore stray taps during the slam
  at(3600, finish);   // auto-advance
  return el;
}
// ===========================================================================
// TRAVELER ENCOUNTERS — you're all clawing out of the same abyss, and you cross
// paths on the way up.  Recruitment is a short BG3-style CONVERSATION: what you
// SAY across two beats decides how it lands.  There's only one way to travel
// together — but the talk sets the TERMS:
//   friend  — you met them warm         → they walk with you, a bond already bound
//   neutral — pragmatic / wary          → they walk with you, no bond yet (warmth is earned)
//   foe     — you crossed them          → they leave resentful and AMBUSH you later
// It all lives on RUN and wipes on death — every descent the conversation can
// go a different way and hand you a differently-tempered party.
// Each option carries a `tone` (warm > 0, guarded = 0, cold < 0); `hostile`
// marks the line that crosses them for good.  b1 tone picks the reply bucket;
// the running total resolves the encounter.
// ===========================================================================
const TRAVELERS = {
  cassia: {
    eyebrow: 'A BANNER IN THE DUST', speaker: 'CASSIA',
    scene: 'A knight kneels in a broken gate, her sword driven through a fallen banner. Same climb as you — she only stopped to bury one of her own.',
    line1: 'If you’re here for the sword, take it and go. If you’re here to ask who carried it — don’t.',
    opts1: [
      { text: 'Keep your sword. Keep the grief, too. Just carry them up with us.', tone: 2 },
      { text: 'I only need to know one thing. Can you still fight?', tone: 0 },
      { text: 'Then finish burying your dead and stay out of our way.', tone: -1 },
    ],
    react: {
      warm:    'Plenty have offered to take the blade. You’re the first to offer to share the weight.',
      guarded: 'Blunt. I can respect blunt. Yes — I can still fight.',
      cold:    'Travel light, travel fast. That’s exactly how the last group climbed. None of them made it.',
    },
    opts2: {
      warm:    [ { text: 'Then get up. Whatever you buried, it’s behind you now.', tone: 2 }, { text: 'We hold the line together, or none of us climb.', tone: 1 } ],
      guarded: [ { text: 'Good. Then walk with us — the whole way up.', tone: 2 }, { text: 'Then take the front. That’s all I’m asking.', tone: 0 } ],
      cold:    [ { text: '…Alright. Come on, then. Just keep pace.', tone: 2 }, { text: 'Take the sword. Leave her in the dirt.', tone: -2, hostile: true } ],
    },
  },
  elin: {
    eyebrow: 'A TRAIL OF LINEN', speaker: 'ELIN',
    scene: 'She’s binding a dead man’s wound as gently as if he could still feel it. Climbing out like everyone — she just can’t bring herself to step over the fallen.',
    line1: 'I mend anyone still walking. So — are you walking? Or just bleeding somewhere quiet?',
    opts1: [
      { text: 'Still walking. And we’d get a lot farther with you beside us.', tone: 2 },
      { text: 'Bleeding, if I’m honest. Can you do anything about that?', tone: 0 },
      { text: 'The dead are past helping. We don’t have time — for them or you.', tone: -1 },
    ],
    react: {
      warm:    'Then let me keep you on your feet. It’s the only thing I’ve ever been good for.',
      guarded: 'Most things, yes. Now hold still and stop arguing with me.',
      cold:    'They had names, the dead. …But the living have farther to go. I know that better than anyone.',
    },
    opts2: {
      warm:    [ { text: 'Stay close behind us. We’ll keep the dark off you.', tone: 2 }, { text: 'Come with us. No one else dies today.', tone: 1 } ],
      guarded: [ { text: 'Fair enough. From here, you’re one of us.', tone: 2 }, { text: 'Just keep the party breathing. That’s the deal.', tone: 0 } ],
      cold:    [ { text: '…You’re right to stay. Come with us instead — please.', tone: 2 }, { text: 'Take whatever supplies she’s got and move on.', tone: -2, hostile: true } ],
    },
  },
  mira: {
    eyebrow: 'A KNIFE IN THE DARK', speaker: 'MIRA',
    scene: 'Three bodies cool behind her, and you never heard a sound. She’s been carving her own way up — alone, and sick of it.',
    line1: 'You move loud enough to wake the dead. Someone ought to watch the dark for you. …Don’t make me sorry I offered.',
    opts1: [
      { text: 'We’re all clawing out of the same hole. Watch it with us.', tone: 2 },
      { text: 'You’re good in the dark. Keep pace and you’ve earned a place.', tone: 0 },
      { text: 'Go watch the dark for someone else. We’re fine.', tone: -1 },
    ],
    react: {
      warm:    'Huh. Most people flinch when I speak. …Fine. I’ll keep you breathing.',
      guarded: 'A clean arrangement. I can work with clean arrangements.',
      cold:    'Suit yourself. The dark’s patient. So am I.',
    },
    opts2: {
      warm:    [ { text: 'So what are you really running from?', tone: 2 }, { text: 'Then stay close. We don’t leave people behind.', tone: 1 } ],
      guarded: [ { text: 'Carry your weight and there’s no trouble.', tone: 2 }, { text: 'Keep your eyes on the dark. Nothing more.', tone: 0 } ],
      cold:    [ { text: '…Actually — wait. We could use eyes like yours.', tone: 2 }, { text: 'Try lifting her blades while she’s talking.', tone: -2, hostile: true } ],
    },
  },
  branwen: {
    eyebrow: 'EYES ON THE TREELINE', speaker: 'BRANWEN',
    scene: 'An arrow buries itself by your head before you ever see her. She steps out with the bow already lowered — one more climber who’d sooner watch you than trust you.',
    line1: 'Relax. If I wanted you dead, you’d never have read this far. Climb with no eyes on the treeline and you don’t climb at all. Let me be yours.',
    opts1: [
      { text: 'Eyes we can trust would be worth a lot. Walk with us.', tone: 2 },
      { text: 'Lower that a little further and we’ll talk.', tone: 0 },
      { text: 'We don’t take arrows from strangers in the dark.', tone: -1 },
    ],
    react: {
      warm:    'Trust. That’s a bold word, this far down. …I’ll earn it, then.',
      guarded: 'Already lowered, see? The reasonable sort of dangerous.',
      cold:    'Smart. Trust gets people killed down here. …Doesn’t mean you don’t still need me.',
    },
    opts2: {
      warm:    [ { text: 'You take the high ground, we’ll take the low.', tone: 2 }, { text: 'Then no one walks into the dark blind again.', tone: 1 } ],
      guarded: [ { text: 'Good enough for me. Fall in.', tone: 2 }, { text: 'Just call out what you see.', tone: 0 } ],
      cold:    [ { text: '…But we do need you. Come on.', tone: 2 }, { text: 'Cut her bowstring and leave her here.', tone: -2, hostile: true } ],
    },
  },
  _default: {
    eyebrow: 'A STRANGER ON THE PATH', speaker: 'STRANGER',
    scene: 'Another climber out of the same dark. They stop when you stop, and wait.',
    line1: 'You’re climbing out too, then. …Two backs are better than one down here.',
    opts1: [
      { text: 'Then let’s climb together.', tone: 2 },
      { text: 'Keep pace, and we’ll see how it goes.', tone: 0 },
      { text: 'We climb on our own.', tone: -1 },
    ],
    react: {
      warm:    'Good. I was getting tired of my own company.',
      guarded: 'Fair. I’ll earn my place on the way up.',
      cold:    '…Going it alone gets you killed. But it’s your climb.',
    },
    opts2: {
      warm:    [ { text: 'Then stay close.', tone: 2 }, { text: 'No one gets left behind.', tone: 1 } ],
      guarded: [ { text: 'Alright — you’re one of us now.', tone: 2 }, { text: 'Just keep up.', tone: 0 } ],
      cold:    [ { text: '…Fine. Come on.', tone: 2 }, { text: 'Take what they’re carrying and go.', tone: -2, hostile: true } ],
    },
  },
};
const toneBucket = (t) => t > 0 ? 'warm' : t < 0 ? 'cold' : 'guarded';
// PARTY-AWARE DEPTH — when a specific ally is already in your line, they speak
// up in the encounter and open a warm shortcut: shared history vouching for the
// stranger.  (Bonus option lands friend; tone 3.)
const TRAVELER_ALLIES = {
  cassia:  { elin:    { line: 'She held the gate at Vael Crossing until every last one of us was through. I owe her my life.', bonus: 'Elin says you held the line. That’s good enough for me.' } },
  elin:    { cassia:  { line: 'She stitched me back together once. I only walked away because of her. Bring her along.',       bonus: 'Cassia’s alive because of you. Come with us.' } },
  mira:    { branwen: { line: 'I’ve held a treeline beside this one. She kills quiet, and she never misses.',                  bonus: 'Branwen vouches for you. Watch the dark with us.' } },
  branwen: { mira:    { line: 'She was the knife I never heard coming. I’d rather she watched our backs than a stranger’s.',    bonus: 'Mira trusts you. Take the high line with us.' } },
};
function activeAllyFor(n) {
  const map = TRAVELER_ALLIES[n.hero];
  if (!map || !RUN || !RUN.active) return null;
  for (const id of RUN.active) { if (id !== n.hero && map[id]) return { id, entry: map[id] }; }
  return null;
}
// PARTY MOOD — a per-run read on how your line is carrying itself, drawn from
// the bonds you've kindled and the names you've made enemies of.  Travelers
// read it in their opening; the map shows it as a chip.  Resets with the run.
const MOODS = {
  lonely:    { label: 'ALONE',     tint: '#8ea2c8', read: 'You’re travelling light. Too light for a place like this.' },
  hunted:    { label: 'HUNTED',    tint: '#e8604a', read: 'Word travels fast down here. You’ve left angry names in your wake.' },
  ironbound: { label: 'IRONBOUND', tint: '#f0d488', read: 'There’s real trust between your people. I can see it from here.' },
  warm:      { label: 'HOLDING',   tint: '#e8b84a', read: 'Your line watches each other’s backs. That’s rare, this deep.' },
  wary:      { label: 'WARY',      tint: '#c89a5a', read: 'You carry yourselves like people who’ve been crossed. Can’t blame you.' },
  steady:    { label: 'STEADY',    tint: '#b8a88a', read: '' },
};
function partyMood() {
  if (!RUN) return 'steady';
  const active = RUN.active || [];
  const bonds = RUN.bonds || {};
  const kindled = Object.values(bonds).filter(v => v >= BOND_KINDLED).length;
  const warm = Object.values(bonds).filter(v => v >= 1).length;
  const foesMade = RUN.foesMade || 0;   // reputation persists past the ambush
  if (foesMade >= 2) return 'hunted';
  if (active.length <= 1) return 'lonely';
  if (kindled >= 2) return 'ironbound';
  if (foesMade >= 1) return 'wary';
  if (warm && warm >= active.length - 1) return 'warm';
  return 'steady';
}
// JRPG CUTSCENE — the party stands stage-LEFT, the stranger stage-RIGHT, and
// they talk across a dialogue box that advances one line at a time (tap to
// continue), then hands you a couple of short replies.  The lit side is whoever
// is speaking.  A present ally steps in to vouch; the traveler reads your mood
// as a first aside.  Resolves into the terms of the alliance — or a foe.
// Once you've MET a hero (they're unlocked from a past run), crossing paths
// again needs no unlock ceremony — just a familiar face and a quick word.
const REUNION_LINES = {
  cassia:  'Still climbing, I see. Good. …Room in that line for a shield?',
  elin:    'You look worse than the last time I patched you up. …Shall I walk with you again?',
  mira:    'You again. Loud as ever. …I’ll watch the dark for you. Same as before.',
  branwen: 'Knew our paths would cross again. Still no eyes on your treeline. Let me fix that.',
  hask:    'The cold followed me here too. …It’s warmer with company. Shall I?',
};
function showReunion(n) {
  const h = HEROES[n.hero];
  const trav = Object.assign({}, TRAVELERS[n.hero] || TRAVELERS._default, { eyebrow: 'A FAMILIAR FACE' });
  const st = { n, trav, tone: 0, hostile: false, ally: null, _beat2: true };   // one beat, no crossing
  const line = REUNION_LINES[n.hero] || 'A familiar face, this deep. …Room for one more?';
  jcPlay(st, [{ side: 'them', speaker: h.name, text: line }], () => {
    jcChoose(st, [
      { text: 'Always. Fall in.', tone: 2 },
      { text: 'We can use the hands. Keep pace.', tone: 0 },
    ]);
  });
}
function showRecruit(n) {
  // A hero you've already met is a lighter beat — no full unlock cutscene.
  if (getUnlockedStarters().includes(n.hero)) return showReunion(n);
  const trav = TRAVELERS[n.hero] || TRAVELERS._default;
  const st = { n, trav, tone: 0, hostile: false, ally: activeAllyFor(n) };
  const open = [{ side: 'them', speaker: trav.speaker, scene: trav.scene, text: trav.line1 }];
  const mood = partyMood(), moodDef = MOODS[mood];
  if (moodDef && moodDef.read) open.push({ side: 'them', speaker: trav.speaker, text: moodDef.read, tint: moodDef.tint, aside: true });
  if (st.ally) open.push({ side: 'us', speaker: HEROES[st.ally.id].name, heroId: st.ally.id, text: st.ally.entry.line });
  jcPlay(st, open, () => {
    let opts = trav.opts1.slice();
    if (st.ally) opts = opts.concat([{ text: st.ally.entry.bonus, tone: 3, ally: true }]);
    jcChoose(st, opts);
  });
}
function jcPlay(st, lines, done) { st._lines = lines; st._li = 0; st._onDone = done; jcRenderSay(st); }
function jcRenderSay(st) { jcRender(st, { say: st._lines[st._li], more: st._li < st._lines.length - 1 }); }
function jcAdvance(st) {
  st._li++;
  if (st._li < st._lines.length) jcRenderSay(st);
  else st._onDone();
}
function jcChoose(st, opts) { st._opts = opts; jcRender(st, { choose: opts }); }
function jcPick(st, o) {
  st.tone += (o.tone || 0);
  if (o.hostile) st.hostile = true;
  if (!st._beat2) {
    st._beat2 = true;
    st.bucket = toneBucket(o.tone || 0);
    jcPlay(st, [{ side: 'them', speaker: st.trav.speaker, text: st.trav.react[st.bucket] }],
      () => jcChoose(st, st.trav.opts2[st.bucket].slice()));
  } else {
    hideOverlay();
    if (st.hostile) return foeTraveler(st.n);
    return joinTraveler(st.n, st.tone >= 2);   // warm total → friend; else a wary join
  }
}
// Render one frame: the party group (stage-LEFT), the stranger (stage-RIGHT),
// and the dialogue box (a typed line, or your replies).  The speaking side is
// lit; the other dims back.  The whole active line stands on the left, with the
// current speaker brought to the front.
function jcRender(st, content) {
  if (st._typeTimer) { clearInterval(st._typeTimer); st._typeTimer = null; }
  const n = st.n, trav = st.trav;
  const party = (RUN && RUN.active && RUN.active.length) ? RUN.active.slice() : ['ash'];
  const lead = party[0];
  let speaker = lead, lit = 'them', box = '';
  if (content.say) {
    const s = content.say;
    lit = s.side;
    if (s.side === 'us' && s.heroId) speaker = s.heroId;
    box = `
      <div class="jc-plate jc-plate-${s.side}">${s.speaker}</div>
      ${s.scene ? `<div class="jc-scene-cap">${s.scene}</div>` : ''}
      <div class="jc-line${s.aside ? ' jc-aside' : ''}"${s.tint ? ` style="color:${s.tint}"` : ''}></div>
      <div class="jc-next">tap ▸</div>`;
  } else {
    lit = 'us';
    box = `
      <div class="jc-plate jc-plate-us">${HEROES[lead].name}</div>
      <div class="jc-opts">${content.choose.map((o, i) =>
        `<button class="jc-opt tc-say${o.ally ? ' tc-vouch jc-vouch' : ''}" id="rc-say-${i}">${o.text}</button>`).join('')}</div>`;
  }
  // the party lineup: the speaker (or lead) stands front-and-lit; the rest fall
  // in behind, smaller and dimmer.
  const ordered = [speaker].concat(party.filter(id => id !== speaker));
  const leftFigs = ordered.map((id, i) =>
    `<span class="jc-hero${i === 0 ? ' jc-hero-lead jc-art' : ' jc-hero-back'}" style="--i:${i}">${V2PORTRAITS[id] || ''}</span>`).join('');
  showOverlay(`
    <div class="jc-scene jc-lit-${lit}">
      <div class="jc-eyebrow">${trav.eyebrow}</div>
      <div class="jc-fig jc-fig-l">${leftFigs}</div>
      <div class="jc-fig jc-fig-r"><span class="jc-art">${V2PORTRAITS[n.hero] || ''}</span></div>
      <div class="jc-box">${box}</div>
    </div>
  `, 'traveler-cine jc');
  // Advance on a tap of the SCENE itself (not #overlay) — the click that OPENED
  // this scene bubbles through the old DOM to #overlay, so binding there would
  // auto-skip the first line.  The fresh .jc-scene isn't in that bubble path.
  $('#overlay').onclick = null;
  const scene = $('.jc-scene');
  if (content.say) {
    const lineEl = $('.jc-line');
    jcType(st, lineEl, content.say.text);
    if (scene) scene.onclick = () => {
      if (st._typing) jcTypeDone(st, lineEl, content.say.text);   // first tap: finish the reveal
      else jcAdvance(st);                                         // second tap: next line
    };
  } else {
    content.choose.forEach((o, i) => { const b = $('#rc-say-' + i); if (b) b.onclick = (e) => { e.stopPropagation(); jcPick(st, o); }; });
  }
}
// TYPEWRITER — reveal a spoken line character by character; a tap completes it.
function jcType(st, el, text) {
  if (!el) return;
  st._typing = true;
  el.textContent = '';
  const scene = $('.jc-scene'); if (scene) scene.classList.add('jc-typing');
  let i = 0;
  st._typeTimer = setInterval(() => {
    i += 2;
    el.textContent = text.slice(0, i);
    if (i >= text.length) jcTypeDone(st, el, text);
  }, 20);
}
function jcTypeDone(st, el, text) {
  if (st._typeTimer) { clearInterval(st._typeTimer); st._typeTimer = null; }
  st._typing = false;
  if (el) el.textContent = text;
  const scene = $('.jc-scene'); if (scene) scene.classList.remove('jc-typing');
}
// FRIEND / NEUTRAL join — a friend arrives already threaded to the whole line.
function joinTraveler(n, friend) {
  const rid = n.hero, h = HEROES[rid];
  if (!RUN.roster.includes(rid)) RUN.roster.push(rid);
  RUN.hp[rid] = h.maxHp;
  unlockStarter(rid);
  if (RUN.active.length < 3 && !RUN.active.includes(rid)) RUN.active.push(rid);
  if (friend) {
    RUN.bonds = RUN.bonds || {};
    RUN.active.filter(id => id !== rid).forEach(id => { const k = pairKey(id, rid); RUN.bonds[k] = Math.max(RUN.bonds[k] || 0, 1); });
  }
  if (!RUN.completed.includes(n.id)) RUN.completed.push(n.id);
  saveRun();
  const beat = friend
    ? `You climb on together — and the talk carried. <b>${h.name}</b> walks at your side with a thread <b>already bound</b> between you.`
    : `<b>${h.name}</b> falls in with you — pragmatic, watchful. Two climbers, one dark. The warmth will have to be earned on the way up.`;
  showTravelerOutcome(rid, friend ? '♡ A THREAD IS BOUND' : 'A WARY ALLIANCE', h.name + ' WALKS WITH YOU', beat, false, rid);
}
// FOE — you wrong them, and they mark you for it.  They vanish, then spring an
// AMBUSH at the next fight (a "vengeful <name>" built from their own kit).
function foeTraveler(n) {
  const rid = n.hero, h = HEROES[rid];
  RUN.foes = RUN.foes || [];
  if (!RUN.foes.includes(rid)) RUN.foes.push(rid);
  RUN.foesMade = (RUN.foesMade || 0) + 1;   // reputation — persists past the ambush (feeds mood)
  if (!RUN.completed.includes(n.id)) RUN.completed.push(n.id);
  saveRun();
  showTravelerOutcome(rid, '⚔ A NAME AGAINST YOU', h.name + ' TURNS AWAY',
    `You wrong <b>${h.name}</b>, and they mark you for it. They melt into the dark — but the reach is long, and they are <b>waiting on the road ahead</b>.`, true, rid);
}
// Shared cinematic outcome beat for friend / neutral / decline / foe.
function showTravelerOutcome(figId, eyebrow, title, beat, foe, mustInclude) {
  showOverlay(`
    <div class="tc-bar tc-bar-t"></div>
    <div class="tc-bar tc-bar-b"></div>
    <div class="tc-vign"></div>
    <div class="tc-body">
      <div class="tc-eyebrow${foe ? ' tc-eyebrow-foe' : ''}">${eyebrow}</div>
      ${figId ? `<div class="tc-portrait${foe ? ' tc-foe-art' : ''}"><span class="tc-glow"></span><span class="tc-art">${V2PORTRAITS[figId] || ''}</span></div>` : '<div class="tc-portrait tc-portrait-empty"></div>'}
      <div class="tc-name">${title}</div>
      <div class="tc-scene tc-scene-wide">${beat}</div>
      <div class="tc-choices"><button class="tc-choice tc-friend" id="rc-next"><span class="tc-c-label">${RUN.roster.length > 3 ? 'CHOOSE YOUR LINE' : 'ONWARD'}</span></button></div>
    </div>
  `, 'traveler-cine' + (foe ? ' tc-foe-scene' : ''));
  $('#rc-next').onclick = () => { hideOverlay(); (RUN.roster.length > 3) ? showPartySelect(() => showMap(), mustInclude) : showMap(); };
}
// A "vengeful traveler" enemy synthesized from a wronged hero's own kit — you
// know how they fight, so they're weak to their own school.  Registered once.
function ensureFoeDef(heroId) {
  const id = 'foe_' + heroId;
  if (ENEMY_DEFS[id]) return id;
  const h = HEROES[heroId];
  const intents = [], seen = {};
  ['front', 'mid', 'back'].forEach(row => {
    const set = h.cards[row]; if (!set) return;
    [set.core, set.sig].forEach(cd => {
      if (cd && cd.fx && cd.fx.dmg && intents.length < 2 && !seen[cd.name]) {
        seen[cd.name] = 1; intents.push({ name: cd.name, dmg: Math.max(4, cd.fx.dmg), row });
      }
    });
  });
  if (!intents.length) intents.push({ name: 'Vengeful Strike', dmg: 5, row: 'front' });
  intents.push({ name: 'Steel Themselves', kind: 'buff', desc: 'sets their guard', guardSelf: 3 });
  ENEMY_DEFS[id] = { weak: h.school, name: 'VENGEFUL ' + h.name, maxHp: Math.round(h.maxHp * 0.6), art: heroId, intents, foeHero: heroId };
  return id;
}
// BOON DRAFT — a companion offers a GIFT: pick 1 of 3 (party-gated), held for
// this descent.  The mid-run randomness beat, shown at elites, events, the fire.
function showBoonDraft(onDone, opts) {
  opts = opts || {};
  const done = onDone || (() => showMap());
  const party = (RUN.active && RUN.active.length) ? RUN.active : (RUN.roster || []);
  RUN.boons = RUN.boons || [];
  const pool = BOONS.filter(b => party.indexOf(b.hero) >= 0 && RUN.boons.indexOf(b.id) < 0);
  if (!pool.length) { done(); return; }
  // Prefer VARIETY — gifts from different companions when we can, so a draft
  // reads as "who's offering" rather than three of the same hero.
  const shuffled = _shuffle(pool);
  const picks = [], usedHeroes = new Set();
  shuffled.forEach(b => { if (picks.length < 3 && !usedHeroes.has(b.hero)) { picks.push(b); usedHeroes.add(b.hero); } });
  shuffled.forEach(b => { if (picks.length < 3 && picks.indexOf(b) < 0) picks.push(b); });
  const cardHtml = (b) => `
    <button class="boon-card" id="boon-${b.id}" style="--tint:${HEROES[b.hero].tint}">
      <span class="boon-portrait">${V2PORTRAITS[b.hero] || ''}</span>
      <span class="boon-scrim"></span>
      <span class="boon-medallion">${b.icon}</span>
      <span class="boon-body">
        <span class="boon-from">${HEROES[b.hero].name}’S GIFT</span>
        <span class="boon-name">${b.name}</span>
        <span class="boon-desc">${b.desc}</span>
      </span>
    </button>`;
  showOverlay(`
    <div class="ov-eyebrow" style="color:var(--gold-bright)">${opts.eyebrow || 'A BOND DEEPENS'}</div>
    <div class="ov-title" style="font-size:22px">${opts.title || 'A COMPANION’S GIFT'}</div>
    <div class="ov-lines" style="text-align:center; min-height:0"><div class="ov-line">${opts.flavor || 'Someone shares a piece of how they fight. Take one — it holds until you fall.'}</div></div>
    <div class="boon-choices">${picks.map(cardHtml).join('')}</div>
  `, 'boon-screen');
  picks.forEach(b => { const el = $('#boon-' + b.id); if (el) el.onclick = () => {
    RUN.boons.push(b.id); saveRun();
    try { SFX.kindle(); } catch (_) {}
    done();
  }; });
}
function showCamp(n) {
  RUN.roster.forEach(id => { RUN.hp[id] = HEROES[id].maxHp; });
  if (!RUN.completed.includes(n.id)) RUN.completed.push(n.id);
  saveRun();
  // CINEMATIC CAMPFIRE — the party gathers, lit warm by the fire; the night's
  // one choice is offered as cards over the scene (mirrors the JRPG cutscenes).
  const party = ((RUN.active && RUN.active.length) ? RUN.active : RUN.roster).slice();
  const mid = (party.length - 1) / 2;
  const heroes = party.map((id, i) => {
    const side = i < mid ? 'l' : i > mid ? 'r' : 'c';   // right side faces the fire (flipped)
    return `<span class="camp-hero camp-hero-${side}" style="--off:${(i - mid).toFixed(2)}">${V2PORTRAITS[id] || ''}</span>`;
  }).join('');
  const embers = Array.from({ length: 9 }, (_, i) => `<span class="cf-ember" style="--i:${i}"></span>`).join('');
  const choice = (id, icon, label, effect) => `
    <button class="ev-choice camp-choice" id="${id}">
      <span class="ev-choice-icon">${icon}</span>
      <span class="ev-choice-body"><span class="ev-choice-label">${label}</span><span class="ev-choice-effect">${effect}</span></span>
    </button>`;
  showOverlay(`
    <div class="camp-scene">
      <div class="camp-glow"></div>
      <div class="camp-party">${heroes}</div>
      <div class="camp-fire"><span class="cf-core"></span><span class="cf-flame"></span>${embers}</div>
      <div class="camp-top">
        <div class="camp-eyebrow">CAMPFIRE</div>
        <div class="camp-title">${n.label}</div>
        <div class="camp-flavor">The fire holds back the dark a while. <b>Every wound closes.</b> One evening, one choice.</div>
      </div>
      <div class="camp-choices">
        ${choice('camp-fire', '♡', 'SHARE THE FIRE', 'Deepen your weakest bond <b>+1</b>.')}
        ${choice('camp-steel', '▲', 'SHARPEN STEEL', 'Open the next fight with <span class="kw kw-rally">▲ RALLY +2</span>.')}
        ${choice('camp-boon', '✦', 'COMMUNE AT THE FIRE', 'A companion shares a gift — <b>draw 1 of 3</b>.')}
      </div>
    </div>
  `, 'camp-cine');
  $('#camp-fire').onclick = () => showCampScene(n);
  $('#camp-steel').onclick = () => {
    RUN.campEdge = true;
    saveRun();
    showPartySelect(() => showMap());
  };
  $('#camp-boon').onclick = () => showBoonDraft(() => showMap(), { eyebrow: n.label.toUpperCase(), title: 'A COMPANION’S GIFT', flavor: 'By the fire, someone shares a piece of how they fight. Take one — it holds until you fall.' });
}

// IN-RUN FORGE — spend embers on a TEMPORARY temper that lasts this descent.
// A different sink from the permanent tree: depth for this run, not breadth.
function showForge(n) {
  RUN.forges = RUN.forges || [];
  const offers = FORGE_OFFERS.map(f => {
    const owned = RUN.forges.includes(f.id);
    const afford = runEmbers() >= f.cost;
    const state = owned ? 'owned' : afford ? 'ready' : 'poor';
    const foot = owned ? '<span class="et-owned">✓ TEMPERED</span>' : `<span class="et-cost${afford ? '' : ' et-cant'}">✦ ${f.cost}</span>`;
    return `<button class="et-node et-forge et-${state}" data-id="${f.id}" ${owned || !afford ? 'disabled' : ''}>
      <span class="et-type t-forge">TEMPER</span>
      <span class="et-name">${f.label}</span>
      <span class="et-desc">${f.desc}</span>
      <span class="et-foot">${foot}</span>
    </button>`;
  }).join('');
  showOverlay(`
    <div class="ov-eyebrow" style="color:#ffb469">THE EMBER FORGE</div>
    <div class="et-wallet">✦ <b>${runEmbers()}</b> <span>embers</span></div>
    <div class="et-forge-note">These tempers hold only for this descent — spend freely, or bank toward the tree.</div>
    <div class="et-tier-row">${offers}</div>
    <button class="ov-btn" id="forge-back">◂ BACK TO THE FIRE</button>
  `, 'map-screen et-screen');
  document.querySelectorAll('.et-node:not([disabled])').forEach(el => {
    el.onclick = () => {
      const f = FORGE_BY_ID[el.dataset.id];
      if (!f || RUN.forges.includes(f.id) || runEmbers() < f.cost) return;
      addEmbers(-f.cost); RUN.forges.push(f.id); saveRun();
      SFX.thread();
      showForge(n);
    };
  });
  $('#forge-back').onclick = () => showCamp(n);
}
// A small scene by the fire between the two LEAST-bonded active companions —
// where the numbers become people.
function showCampScene(n) {
  const ids = RUN.active.slice();
  let pair = null, low = Infinity;
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const pts = bondPts(pairKey(ids[i], ids[j]));
    if (pts < low) { low = pts; pair = [ids[i], ids[j]]; }
  }
  if (!pair) { showPartySelect(() => showMap()); return; }
  const [a, b] = pair;
  const key = pairKey(a, b);
  const before = bondPts(key);
  RUN.bonds = RUN.bonds || {};
  RUN.bonds[key] = before + 1;
  saveRun();
  const kindledNow = before + 1 === BOND_KINDLED;
  showStory({
    type: 'story', chapter: 3, title: 'BY THE FIRE', eyebrow: n.label.toUpperCase(),
    lines: [
      { text: 'The pot is shared. The watch is set. Two of them sit a little apart from the dark.' },
      { spk: HEROES[a].name, text: CAMP_VOICES[a] || '…' },
      { spk: HEROES[b].name, text: CAMP_VOICES[b] || '…' },
      { text: `The fire holds. <b>♡ ${HEROES[a].name} ─ ${HEROES[b].name}${kindledNow ? ' · KINDLED' : ' +1'}</b>${kindledNow ? ' — they will walk into every battle already connected.' : '.'}` },
    ],
    campDone: true,
  });
}
// Party composition — pick exactly 3 (or all, if fewer).  The preview line
// shows WHICH resonant this trio unlocks, so composition reads as a build.
function showPartySelect(onDone, mustInclude) {
  let picked = RUN.active.slice();
  if (mustInclude && !picked.includes(mustInclude)) picked = [mustInclude].concat(picked).slice(0, 3);
  const need = Math.min(3, RUN.roster.length);
  const render = () => {
    const figs = RUN.roster.map(id => {
      const on = picked.includes(id);
      const h = HEROES[id];
      return `<button class="ps-fig${on ? ' ps-on' : ''}" data-id="${id}">
        <span class="ps-art">${V2PORTRAITS[id] || ''}</span>
        <span class="ps-name">${h.name}</span>
        <span class="ps-cls">${h.cls} · <b>${h.archetype || ''}</b> · ${RUN.hp[id] ?? h.maxHp}/${h.maxHp}</span>
        <span class="ps-identity">${h.identity || ''}</span>
      </button>`;
    }).join('');
    const ready = picked.length === need;
    const r = ready ? triadEntryFor(picked) : null;
    const orderHint = picked.length
      ? picked.map((id, i) => HEROES[id].name + ' → ' + ['FRONT', 'MID', 'BACK'][i]).join(' · ')
      : 'pick order sets the line: 1st → FRONT · 2nd → MID · 3rd → BACK';
    showOverlay(`
      <div class="ov-eyebrow">THE PARTY IS THE CHARACTER</div>
      <div class="ov-title" style="font-size:20px">WHO WALKS?</div>
      <div class="ps-order">${orderHint}</div>
      <div class="ps-row">${figs}</div>
      <div class="ps-reso">${ready && picked.length === 3
        ? `this trio resonates as <b>✦ ${r.name}</b> — ${r.type}<br><span class="ps-reso-desc">${r.desc}</span>`
        : `choose ${need}`}</div>
      <div class="ps-bonds">${(() => {
        if (picked.length < 2) return '';
        const out = [];
        for (let i = 0; i < picked.length; i++) for (let j = i + 1; j < picked.length; j++) {
          const k = pairKey(picked[i], picked[j]);
          const pts = bondPts(k);
          if (pts >= BOND_KINDLED) out.push(`♡ ${HEROES[picked[i]].name} ─ ${HEROES[picked[j]].name} · kindled`);
          else if (pts > 0) out.push(`♡ ${HEROES[picked[i]].name} ─ ${HEROES[picked[j]].name} · ${pts}/${BOND_KINDLED}`);
        }
        return out.join('<span class="ps-bond-sep"> · </span>');
      })()}</div>
      <button class="ov-btn primary" id="ps-go" ${ready ? '' : 'disabled'}>WALK ON</button>
    `);
    document.querySelectorAll('.ps-fig').forEach(el => {
      el.onclick = () => {
        const id = el.dataset.id;
        if (picked.includes(id)) picked = picked.filter(x => x !== id);
        else if (picked.length < need) picked.push(id);
        render();
      };
    });
    $('#ps-go').onclick = () => {
      RUN.active = picked.slice();
      saveRun();
      hideOverlay();
      onDone();
    };
  };
  render();
}

// ---------------------------------------------------------------------------
// RENDER
// ---------------------------------------------------------------------------
function figEl(id) { return document.querySelector(`[data-fig="${id}"]`); }

// Animated status chips (ported feel from v1): a chip whose value GREW since
// the last render gets a one-shot pop-and-glow, so gaining guard / rally /
// stagger visibly lands rather than silently appearing in the chip row.
function chipPop(who, key, val) {
  const prev = who._fxPrev || {};
  return (val > (prev[key] || 0)) ? ' chip-pop' : '';
}
function snapFx(who, obj) { who._fxPrev = obj; }

// Status AURA — persistent particle/glow effects painted OVER the character
// body so an active status reads as an atmosphere around the figure, not just
// a pill.  fx flags: guard, rally, chill, exposed, counter, invuln (allies);
// weak, stagger add for enemies.  CSS drives the looping motion; --i staggers
// each particle so a field of them shimmers rather than pulsing in lockstep.
function auraHTML(fx) {
  const field = (cls, n) => {
    let s = '';
    for (let i = 0; i < n; i++) s += `<span class="ap ${cls}" style="--i:${i};--x:${Math.round(12 + (i + 0.5) * (76 / n))}"></span>`;
    return `<div class="ap-field">${s}</div>`;
  };
  let html = '';
  if (fx.invuln)  html += `<span class="aura-glow aura-invuln"></span>`;
  if (fx.guard)   html += `<span class="aura-shield"></span>`;
  if (fx.exposed) html += `<span class="aura-glow aura-expose"></span>`;
  if (fx.weak)    html += `<span class="aura-glow aura-weak"></span>`;
  if (fx.stagger) html += `<span class="aura-glow aura-stagger"></span>` + field('ap-stagger', 5);
  if (fx.rally)   html += field('ap-rally', 5);
  if (fx.chill)   html += `<span class="aura-glow aura-chill"></span>` + field('ap-chill', 5);
  if (fx.counter) html += field('ap-counter', 4);
  return html ? `<div class="fig-aura">${html}</div>` : '';
}

function renderAll() {
  if (!S) return;
  applyFightBg();
  renderTimeline();
  renderBattlefield();
  renderThreads();
  renderResonance();
  renderCombatBoons();
  renderActionBar();
}
// The fight backdrop shows only during battle (S set) and only if the player
// hasn't switched it off in DEV.  Toggled here + cleared by the map/title.
function applyFightBg() {
  const st = $('#stage');
  if (st) st.classList.toggle('show-bg', !!(S && SETTINGS.fightBg));
}

// Combat no longer has an action-scripted / ATB order (your whole turn, then
// theirs), so a turn-order strip would be dishonest.  This spot instead
// carries a THREAT FORECAST: total enemy damage that would land on OCCUPIED
// party rows next phase.  Vacate a telegraphed row and the number drops —
// the forecast is the formation puzzle made numeric, and it drives the
// guard / intercept / dodge decision.
function renderTimeline() {
  // The threat forecast used to sit here as a top banner (round number + "N
  // incoming — parry to negate").  That hand-holding is gone: the danger now
  // reads straight off the battlefield — the lock-on brackets and the ✕N (or a
  // ☠ when it's lethal) on the threatened hero.  The player learns the UI.
  const tl = $('#timeline');
  if (tl) tl.innerHTML = '';
}

function renderBattlefield() {
  // Per-row INCOMING DAMAGE, so the telegraph can look as scary as the blow is
  // big — a small poke barely glows, a boss's OBLIVION swells huge and red.
  const rowDmg = { front: 0, mid: 0, back: 0 };
  let anyHeavy = false;
  livingEnemies().forEach(e => {
    enemyNextIntents(e).forEach(it => {          // sum EVERY blow this foe will throw (a boss throws two)
      if (!it || it.kind === 'buff') return;
      const dmg = enemyIntentDmg(e, it);
      if (it.heavy) anyHeavy = true;
      const row = effIntentRow(e, it);           // smart foes aim at the weakest — shown honestly
      (row === 'all' ? ROWS.slice() : (row ? [row] : [])).forEach(r => { rowDmg[r] += dmg; });
    });
  });
  // Classify a row's threat: how big, and would it drop the hero standing there?
  const dangerClass = (row) => {
    const d = rowDmg[row]; if (d <= 0) return '';
    const h = S.heroes.find(x => x.row === row && !x.downed);
    const lethal = h && !h.invuln && d >= h.hp + h.guard;
    const tier = lethal ? 'sd-lethal' : (d >= 16 || anyHeavy) ? 'sd-lg' : d >= 9 ? 'sd-md' : 'sd-sm';
    return ' slot-telegraphed ' + tier;
  };

  const party = $('#party-half');
  party.innerHTML = '';
  ['back', 'mid', 'front'].forEach(row => {
    const slot = document.createElement('div');
    slot.className = 'slot' + dangerClass(row);
    slot.dataset.row = row;
    const h = S.heroes.find(x => x.row === row && !x.downed);
    const downedHere = S.heroes.find(x => x.row === row && x.downed);
    const dRow = rowDmg[row];
    const hRow = S.heroes.find(x => x.row === row && !x.downed);
    const lethalRow = hRow && !hRow.invuln && dRow >= hRow.hp + hRow.guard;
    slot.innerHTML = `<span class="slot-ring"></span><span class="slot-danger" aria-hidden="true"><span class="sd-brackets"><i></i><i></i><i></i><i></i></span><span class="sd-wave"></span></span>${dRow > 0 ? `<span class="slot-dmg${lethalRow ? ' sd-dmg-lethal' : ''}">${lethalRow ? '☠' : '✕'} ${dRow}</span>` : ''}`;
    const who = h || downedHere;
    if (who) {
      const fig = document.createElement('div');
      fig.className = 'figure party' + (who.downed ? ' downed' : '');
      fig.dataset.fig = who.id;
      const solo = livingHeroes().length === 1;
      const targetable = targeting && !targeting.isRow && targeting.validIds.includes(who.id);
      if (targetable) fig.classList.add('fig-targetable');
      fig.innerHTML = `
        ${solo ? `<span class="stance-tag">${STANCE[who.row].name.toUpperCase()}</span>` : ''}
        <div class="fig-art">${V2PORTRAITS[who.id] || ''}${who.downed ? '' : auraHTML({ guard: who.guard, rally: who.buffDmg, chill: who.chill, exposed: who.exposed, counter: who.counter, invuln: who.invuln })}</div>
        <div class="fig-chips">
          ${who.invuln ? `<span class="chip buff${chipPop(who,'invuln',1)}">✦ INVULN</span>` : ''}
          ${who.guard ? `<span class="chip guard${chipPop(who,'guard',who.guard)}">⛨ ${who.guard}</span>` : ''}
          ${who.buffDmg ? `<span class="chip buff${chipPop(who,'buffDmg',who.buffDmg)}">▲ ${who.buffDmg}</span>` : ''}
          ${who.counter ? `<span class="chip counter${chipPop(who,'counter',who.counter)}">↺ ${who.counter}</span>` : ''}
          ${who.exposed ? `<span class="chip mark${chipPop(who,'exposed',who.exposed)}">◎ ${who.exposed}</span>` : ''}
          ${who.chill ? `<span class="chip chill${chipPop(who,'chill',who.chill)}">❄ ${who.chill}</span>` : ''}
          ${who.hexed ? `<span class="chip hex${chipPop(who,'hexed',who.hexed)}" title="HEXED — your card plays burn your hand">☠ HEXED</span>` : ''}
        </div>
        <div class="hp-bar"><div class="hp-fill" style="width:${(who.hp / who.maxHp) * 100}%"></div></div>
        <div class="fig-name">${who.def.name} <span class="hp-num">${who.hp}/${who.maxHp}</span></div>
      `;
      snapFx(who, { invuln: who.invuln ? 1 : 0, guard: who.guard, buffDmg: who.buffDmg, counter: who.counter, exposed: who.exposed, chill: who.chill });
      if (canMove(who)) fig.classList.add('can-move');
      attachHeroDrag(fig, who);
      // Click fallback for target-picking (synthetic clicks / accessibility
      // tools).  Safe alongside the pointer path: onFigureTap no-ops once
      // targeting clears, so a double-fire can't double-play.
      fig.onclick = () => { if (targeting) onFigureTap(who.id); };
      slot.appendChild(fig);
    }
    const lbl = document.createElement('span');
    lbl.className = 'slot-label';
    lbl.textContent = ROW_LABEL[row];
    slot.appendChild(lbl);
    if (targeting && targeting.isRow && targeting.validIds.includes('row:' + row)) {
      slot.style.cursor = 'pointer';
      slot.querySelector('.slot-ring').style.borderColor = 'var(--gold-bright)';
      if (!targeting.drag) slot.onclick = () => onRowTap(row);
    }
    party.appendChild(slot);
  });

  const enemyHalf = $('#enemy-half');
  enemyHalf.innerHTML = '';
  // FLOOR BOSS — one colossal foe that fills the enemy half, rendered as a
  // single big figure instead of the three-slot line.
  const fboss = S.enemies.find(x => x.def.floorBoss && (!x.dead || x._justDied));
  enemyHalf.classList.toggle('has-floor-boss', !!fboss);
  enemyHalf.classList.toggle('boss-maw', !!(fboss && fboss.def.aura === 'maw'));   // the Maw glows a sickly, hungry green
  if (fboss) {
    const fig = document.createElement('div');
    const primed = !!(fboss.lull || fboss.weakened || fboss.staggered);
    fig.className = 'figure enemy floor-boss' + (fboss._justDied ? ' fig-dying' : '') + (primed && !fboss._justDied ? ' fig-primed' : '');
    fig.dataset.fig = fboss.uid;
    if (targeting && !targeting.isRow && targeting.validIds.includes(fboss.uid)) fig.classList.add('fig-targetable');
    fig.innerHTML = enemyFigInner(fboss);
    snapFx(fboss, { weakened: fboss.weakened ? 1 : 0, staggered: fboss.staggered ? 1 : 0, guard: fboss.guard, power: fboss.power, mark: fboss.mark, lull: fboss.lull });
    fig.onclick = () => onFigureTap(fboss.uid);
    enemyHalf.appendChild(fig);
    return;
  }
  ['front', 'mid', 'back'].forEach(row => {
    const slot = document.createElement('div');
    slot.className = 'slot';
    slot.dataset.row = row;
    const e = S.enemies.find(x => x.row === row && (!x.dead || x._justDied));
    if (e) {
      const fig = document.createElement('div');
      // PRIMED — this foe is set up for a TECHNICAL detonation (chilled or
      // weakened).  A pulsing electric ring + ⚡ tag reads "hit me for a combo".
      const primed = !!(e.lull || e.weakened || e.staggered);
      fig.className = 'figure enemy' + (e._justDied ? ' fig-dying' : '') + (primed && !e._justDied ? ' fig-primed' : '');
      fig.dataset.fig = e.uid;
      const targetable = targeting && !targeting.isRow && targeting.validIds.includes(e.uid);
      if (targetable) fig.classList.add('fig-targetable');
      fig.innerHTML = enemyFigInner(e);
      snapFx(e, { weakened: e.weakened ? 1 : 0, staggered: e.staggered ? 1 : 0, guard: e.guard, power: e.power, mark: e.mark, lull: e.lull });
      fig.onclick = () => onFigureTap(e.uid);
      slot.appendChild(fig);
    }
    enemyHalf.appendChild(slot);
  });
}
// one intent rendered as an inline segment (glyph · dmg → row · riders)
function intentSeg(e, it) {
  if (it.kind === 'buff') {
    // Telegraph the MECHANICAL effect, not the flavor line — a compact glyph so
    // the pill stays one short, readable segment (the flavor lives in the title).
    let eff = 'GATHERS';
    if (it.powerAll) eff = '▲ ALL +' + it.powerAll;
    else if (it.powerSelf) eff = '▲ +' + it.powerSelf;
    else if (it.guardSelf) eff = '⛨ +' + it.guardSelf;
    return `<span class="i-seg" title="${it.desc || ''}"><span class="i-glyph">◈</span><span class="i-row">${eff}</span></span>`;
  }
  const row = effIntentRow(e, it);   // smart foes point at the hero they're hunting
  return `<span class="i-seg"><span class="i-glyph">⚔</span><span class="i-dmg">${enemyIntentDmg(e, it)}</span><span class="i-arrow">→</span><span class="i-row">${row === 'all' ? 'ALL' : ROW_LABEL[row]}</span>${it.hex ? '<span class="i-st kw-hex" title="HEX — if it lands, your card plays burn your hand; dodge it">☠</span>' : ''}${it.drain ? '<span class="i-st kw-drain" title="drains life — heals the Maw">♥</span>' : ''}${it.chill ? '<span class="i-st kw-chill" title="chills you">❄</span>' : ''}${it.expose ? '<span class="i-st kw-exposed" title="exposes you">◎</span>' : ''}</span>`;
}
// The inner markup for an enemy figure (shared by the line + the floor boss).
function enemyFigInner(e) {
  const its = enemyNextIntents(e);
  const heavy = its.some(x => x.heavy);
  const intentHtml = its.length > 1
    ? `<div class="intent intent-multi${heavy ? ' intent-heavy' : ''}">${its.map(x => intentSeg(e, x)).join('<span class="i-div">+</span>')}</div>`
    : `<div class="intent${its[0].kind === 'buff' ? ' intent-buff' : ''}${heavy ? ' intent-heavy' : ''}">${intentSeg(e, its[0])}</div>`;
  return `
    ${intentHtml}
    <div class="fig-art">${enemyArt(e)}${e._justDied ? '' : auraHTML({ guard: e.guard, rally: e.power, chill: e.lull, exposed: e.mark, weak: e.weakened, stagger: e.staggered })}</div>
    <div class="fig-chips">
      <span class="chip weak${e.weakRevealed ? ' revealed' : ''}" title="weakness — strike this element to WEAKEN, again to STAGGER">${e.weakRevealed ? `<span class="ru-i">${SCHOOL_GLYPH[e.def.weak] || '?'}</span>WEAK: ${(e.def.weak || '?').toUpperCase()}` : `<span class="ru-i">◇</span>? ? ?`}</span>
      ${e.weakened ? `<span class="chip mark${chipPop(e,'weakened',1)}"><span class="ru-i">⌖</span>WEAKENED</span>` : ''}
      ${e.staggered ? `<span class="chip stagger${chipPop(e,'staggered',1)}"><span class="ru-i">⚡</span>STAGGERED</span>` : ''}
      ${e.guard ? `<span class="chip guard${chipPop(e,'guard',e.guard)}"><span class="ru-i">⛨</span>GUARD ${e.guard}</span>` : ''}
      ${e.power ? `<span class="chip buff${chipPop(e,'power',e.power)}"><span class="ru-i">▲</span>RAGE ${e.power}</span>` : ''}
      ${e.mark ? `<span class="chip mark${chipPop(e,'mark',e.mark)}"><span class="ru-i">◎</span>EXPOSED ${e.mark}</span>` : ''}
      ${e.lull ? `<span class="chip chill${chipPop(e,'lull',e.lull)}"><span class="ru-i">❄</span>CHILL ${e.lull}</span>` : ''}
    </div>
    <div class="hp-bar"><div class="hp-fill" style="width:${(e.hp / e.maxHp) * 100}%"></div></div>
    <div class="fig-name">${e.def.name} <span class="hp-num">${e.hp}/${e.maxHp}</span></div>
  `;
}

// Bonds no longer draw a permanent web of lines across the party (it cluttered
// the field and read vaguely).  The thread layer stays clear; a bond forming
// plays a single quick SPARK between the pair (see sparkThread), and the running
// state lives in the compact RESONANCE badge (see renderResonance).
function renderThreads() {
  const svg = $('#thread-layer');
  if (svg) svg.innerHTML = '';
}
// A one-shot spark that arcs between two bonded heroes, then fades — the moment
// of connection, not a persistent tether.
function sparkThread(a, b) {
  const ea = figEl(a), eb = figEl(b); if (!ea || !eb) return;
  const bf = $('#battlefield').getBoundingClientRect(), scale = bf.width / 760 || 1;
  const ra = ea.getBoundingClientRect(), rb = eb.getBoundingClientRect();
  const x1 = (ra.left + ra.width / 2 - bf.left) / scale, y1 = (ra.top + ra.height * 0.42 - bf.top) / scale;
  const x2 = (rb.left + rb.width / 2 - bf.left) / scale, y2 = (rb.top + rb.height * 0.42 - bf.top) / scale;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'thread-spark');
  svg.setAttribute('viewBox', `0 0 ${Math.round(bf.width / scale)} ${Math.round(bf.height / scale)}`);
  svg.innerHTML = `<path d="M ${x1} ${y1} Q ${(x1 + x2) / 2} ${Math.min(y1, y2) - 26} ${x2} ${y2}" class="ts-line"/>`;
  $('#battlefield').appendChild(svg);
  setTimeout(() => svg.remove(), 850);
}
// The RESONANCE badge — a small triangle of the trio's three bonds.  Each edge
// lights as its thread forms; a full triangle is TRIAD READY.  Replaces the old
// web of lines with one legible "how close am I to the vow" read.
function renderResonance() {
  const el = $('#resonance'); if (!el) return;
  const live = S ? livingHeroes() : [];
  if (!S || S.node.chapter < 2 || live.length < 3) { el.classList.add('hidden'); el.classList.remove('rz-ready'); return; }
  el.classList.remove('hidden');
  const ids = live.slice(0, 3).map(h => h.id);
  const C = [{ x: 23, y: 7 }, { x: 43, y: 39 }, { x: 3, y: 39 }];
  const E = [[0, 1], [1, 2], [0, 2]];
  let formed = 0;
  const edges = E.map(([i, j]) => {
    const on = S.threads.has(pairKey(ids[i], ids[j])); if (on) formed++;
    return `<line x1="${C[i].x}" y1="${C[i].y}" x2="${C[j].x}" y2="${C[j].y}" class="rz-edge${on ? ' on' : ''}"/>`;
  }).join('');
  const fill = formed === 3 ? `<polygon points="${C.map(c => c.x + ',' + c.y).join(' ')}" class="rz-fill"/>` : '';
  const dots = ids.map((id, i) => `<circle cx="${C[i].x}" cy="${C[i].y}" r="4.2" class="rz-dot" style="fill:${HEROES[id].tint}"/>`).join('');
  const ready = S.triadFormed && !S.resonantUsed;
  el.classList.toggle('rz-ready', ready);
  const label = S.resonantUsed ? 'VOW SPENT' : ready ? '✦ TRIAD READY' : 'RESONANCE ' + formed + '/3';
  el.innerHTML = `<svg viewBox="-3 -3 52 48" class="rz-svg">${fill}${edges}${dots}</svg><span class="rz-lbl">${label}</span>`;
}

// The MOMENTUM gauge — fills as you exploit weaknesses / chain LINKs; when
// full it becomes a tappable ALL-OUT button.
function renderBurst() {
  const burst = $('#burst'); if (!burst) return;
  const frac = Math.max(0, Math.min(1, (S.momentum || 0) / MOM_MAX));
  $('#burst-fill').style.width = (frac * 100) + '%';
  burst.style.setProperty('--charge', frac.toFixed(3));   // glow intensity ramps with charge
  const ready = burstReady();
  const wasReady = burst.classList.contains('burst-ready');
  burst.classList.toggle('burst-ready', ready);
  // no %, no clutter — the flowing energy IS the read (FFXVI limit-gauge feel)
  $('#burst-lbl').textContent = ready ? '⚡ ALL-OUT' : 'BURST';
  burst.onclick = ready ? () => triggerAllOut() : null;
  burst.style.cursor = ready ? 'pointer' : 'default';
  if (ready && !wasReady) haptic(HAP.good);
}
function renderActionBar() {
  $('#ep-num').textContent = S.ep;
  $('#ep-max').textContent = '/' + S.maxEp;
  renderBurst();
  $('#btn-endturn').disabled = S.executing || S.over;
  // When nothing is playable, softly pulse END TURN so the next step is obvious.
  const anyPlayable = buildHand().some(c => !c.spent && c.cost <= S.ep)
    || livingHeroes().some(h => canMove(h));
  $('#btn-endturn').classList.toggle('et-nudge', !S.executing && !S.over && !anyPlayable);

  const handEl = $('#hand');
  handEl.innerHTML = '';
  if (S.over) return;
  // Icon-first card face — legibility over prose (mobile).  Full text lives
  // in the card's title attribute for anyone who wants the detail.
  const fxIconStr = (fx, hasAll, dg) => {
    dg = dg || '⚔';   // the damage glyph carries the card's ELEMENT (blade/light/…)
    const b = [];
    const d = fx.dmg || fx.hitFrontmost;
    if (fx.aoeDmg) b.push(`<span class="ic ic-dmg">${dg}${fx.aoeDmg}<em>·ALL</em></span>`);
    else if (d)    b.push(`<span class="ic ic-dmg">${dg}${d}</span>`);
    const heal = fx.heal || fx.healAll;
    if (heal) b.push(`<span class="ic ic-heal">✚${heal}${fx.healAll ? '<em>·ALL</em>' : ''}</span>`);
    const g = fx.guard || fx.guardAll || fx.guardFront;
    if (g) b.push(`<span class="ic ic-guard">⛨${g}</span>`);
    const r = fx.buffDmg || fx.buffAllDmg;
    if (r) b.push(`<span class="ic ic-rally">▲${r}</span>`);
    const co = fx.counter || fx.counterAll;
    if (co) b.push(`<span class="ic ic-counter">↺${co}</span>`);
    const l = fx.lull || fx.lullAll;
    if (l) b.push(`<span class="ic ic-chill">❄${l}</span>`);
    const m = fx.mark || fx.markAll;
    if (m) b.push(`<span class="ic ic-exposed">◎${m}</span>`);
    if (fx.invulnFront) b.push(`<span class="ic ic-guard">✦INV</span>`);
    if (fx.pushBack) b.push(`<span class="ic ic-move">⇄PUSH</span>`);
    if (fx.step) b.push(`<span class="ic ic-move">⇄${fx.step === 'front' ? 'F' : 'B'}</span>`);
    if (fx.warp) b.push(`<span class="ic ic-move">✦${(fx.warp[0] || '').toUpperCase()}</span>`);
    return b.join('');
  };
  const cardIcons = (card) => {
    const fx = card.fx || {};
    const dg = SCHOOL_GLYPH[card.school] || '⚔';   // element carried on the damage number
    if (fx.duet) {
      const rfx = {}; (duetFor(fx.pairIds[0], fx.pairIds[1]).stages || []).forEach(st => Object.assign(rfx, st.fx || {}));
      const nfx = {};   // map PAIR-scoped verbs onto the icons fxIconStr understands
      if (rfx.aoeDmg) nfx.aoeDmg = rfx.aoeDmg;
      if (rfx.hitFrontmost) nfx.hitFrontmost = rfx.hitFrontmost;
      if (rfx.pairHeal) nfx.heal = rfx.pairHeal;
      if (rfx.pairGuard) nfx.guard = rfx.pairGuard;
      if (rfx.guardFront) nfx.guardFront = rfx.guardFront;
      if (rfx.pairRally) nfx.buffDmg = rfx.pairRally;
      if (rfx.pairCounter) nfx.counter = rfx.pairCounter;
      if (rfx.markFront) nfx.mark = rfx.markFront;
      if (rfx.markAll) nfx.markAll = rfx.markAll;
      if (rfx.lullAll) nfx.lullAll = rfx.lullAll;
      return fxIconStr(nfx, false, dg);
    }
    if (fx.resonant) { const rfx = {}; (triadEntry().stages || []).forEach(st => Object.assign(rfx, st.fx || {})); return fxIconStr(rfx, false, dg); }
    if (fx.bondPair) return `<span class="ic ic-guard">⛨${fx.bondGuard}</span><span class="ic ic-rally">▲${fx.bondRally}</span>`;
    if (fx.notToday) return `<span class="ic ic-move">⇄</span><span class="ic ic-heal">✚4</span><span class="ic ic-guard">⛨4</span><span class="ic ic-counter">↺2</span>`;
    return fxIconStr(fx, false, dg);
  };
  // Reach: a 3-cell front/mid/back diagram for enemy cards (filled = can hit),
  // so 'nearest' vs 'any' reads without words; support targets stay labelled.
  const reachPips = (cells) => `<span class="rch-pips" title="enemy reach — front · mid · back">${cells.map(c => `<i class="rp${c ? ' on' : ''}"></i>`).join('')}</span>`;
  const cardReach = (card) => {
    const fx = card.fx || {};
    if (fx.duet) return `<span class="rch rch-t">◈ DUET</span>`;
    if (fx.resonant) return `<span class="rch rch-t">◈ ALL</span>`;
    if (fx.notToday || fx.bondPair) return `<span class="rch rch-t">◇ BOND</span>`;
    switch (card.target) {
      case 'frontmost': return `${reachPips([1, 0, 0])}`;
      case 'enemy':     return `${reachPips([1, 1, 1])}`;
      case 'ally':      return `<span class="rch rch-a">♥ ALLY</span>`;
      case 'allies':    return `<span class="rch rch-a">♥ PARTY</span>`;
      case 'self':      return `<span class="rch rch-a">SELF</span>`;
      default:          return '';
    }
  };
  buildHand().forEach(card => {
    const type = cardType(card);
    const el = document.createElement('div');
    el.className = `card kind-${card.kind}`
      + (card.spent ? ' card-spent' : (card.cost > S.ep ? ' disabled' : ''));
    if (card.kind === 'resonant' && S.resonantNew) el.classList.add('card-burn-in');
    if (card.temp && S._tempNew === card.uid) { el.classList.add('card-burn-in'); S._tempNew = null; }
    el.style.setProperty('--tint', card.tint);
    el.dataset.owner = card.owner;
    el.dataset.cardName = card.name;
    el.dataset.target = card.target || 'none';
    el.dataset.kind = card.kind;
    const isTemp = card.temp || card.kind === 'resonant';
    el.title = card.name + ' — ' + card.desc.replace(/<[^>]+>/g, '');
    // SACRIFICE is a gesture now (drag the card onto the EP dial) — no button.
    el.innerHTML = `
      <div class="c-top">
        <span class="c-cost tempo-${card.tempo || 'steady'}${card.cost === 0 ? ' c-free' : ''}">${card.cost === 0 ? 'FREE' : card.cost}</span>
        <span class="c-name">${card.name}</span>
        ${isTemp ? `<span class="c-temp-mark">✧</span>` : ''}
      </div>
      <div class="c-fx">${cardIcons(card)}</div>
      <div class="c-desc">${card.desc}</div>
      <div class="c-reach">${cardReach(card)}</div>
      <div class="c-owner"><span>${card.ownerName}</span><span class="c-stance">· ${card.stance}</span></div>
    `;
    attachDrag(el, card);
    handEl.appendChild(el);
  });
  if (S.resonantNew) S.resonantNew = false;

  // Arc the hand like a held fan: slight rotation + parabolic lift around the
  // center card, overlapping only when width demands it.  Hover/drag straightens
  // the card.  Cards of a hero who just changed rows morph-flip into their new
  // forms — position visibly rewrites the hand.
  const morphIds = [S._morphHeroId, S._morphHeroId2].filter(Boolean);
  S._morphHeroId = S._morphHeroId2 = null;
  // Lay the fan out SYNCHRONOUSLY, before the browser's first paint, so a
  // fresh hand never flickers through its un-fanned (rotate 0) state on the
  // way in.  Transitions are suppressed for this placement pass so a reshuffle
  // snaps cleanly into shape instead of sliding in from center every render.
  const kids = [...handEl.children];
  if (kids.length) {
    const avail = handEl.clientWidth || handEl.offsetWidth;
    let total = 0;
    kids.forEach(k => { total += k.offsetWidth + 6; });
    const overlap = total > avail ? Math.min(86, (total - avail) / Math.max(1, kids.length - 1)) : 0;
    const mid = (kids.length - 1) / 2;
    kids.forEach((k, i) => {
      k.style.transition = 'none';
      if (i > 0 && overlap) k.style.marginLeft = (-overlap) + 'px';
      k.style.zIndex = i + 1;
      const d = i - mid;
      k.style.transformOrigin = '50% 130%';
      k.style.setProperty('--fan-rot', (d * 3.4).toFixed(2) + 'deg');
      k.style.setProperty('--fan-y', (d * d * 2.4).toFixed(1) + 'px');
    });
    // Force one reflow so the fanned transform is committed with transitions
    // off, then restore the CSS transition (for hover/drag) on the next frame.
    void handEl.offsetWidth;
    requestAnimationFrame(() => {
      kids.forEach(k => {
        k.style.transition = '';
        if (morphIds.includes(k.dataset.owner)) k.classList.add('card-morph');
      });
    });
  }
}

// ---------------------------------------------------------------------------
// FX helpers
// ---------------------------------------------------------------------------
// Popups that land on the SAME figure within a short window cascade upward and
// stagger in time, so a card that does several things (damage + rally + bond)
// reads as a sequence of legible numbers instead of one illegible stack.
const _popupStacks = new Map();   // figId -> { n, last }
function popupAt(el, text, cls) {
  if (!el) return;
  const layer = $('#popup-layer');
  const stageR = $('#stage').getBoundingClientRect();
  const scale = stageR.width / 760;
  const r = el.getBoundingClientRect();
  const key = el.dataset.fig || 'x';
  const now = Date.now();
  let st = _popupStacks.get(key);
  if (!st || now - st.last > 850) st = { n: 0, last: now };
  st.n++; st.last = now; _popupStacks.set(key, st);
  const idx = st.n - 1;
  const p = document.createElement('div');
  p.className = 'popup ' + (cls || '');
  p.textContent = text;
  p.style.left = ((r.left + r.width / 2 - stageR.left) / scale) + 'px';
  p.style.top = ((r.top - stageR.top) / scale + 6 - idx * 15) + 'px';
  if (idx) { p.style.animationDelay = (idx * 95) + 'ms'; p.style.animationFillMode = 'both'; }
  layer.appendChild(p);
  setTimeout(() => p.remove(), 1050 + idx * 95);
}
function shake(el, dir) {
  if (!el) return;
  const cls = dir === 'r' ? 'fig-hit-r' : dir === 'l' ? 'fig-hit-l' : 'fig-hit';
  el.classList.remove('fig-hit', 'fig-hit-l', 'fig-hit-r'); void el.offsetWidth; el.classList.add(cls);
}
// A short forward lunge on the attacker — heroes drive right toward the enemy
// line, enemies drive left toward the party (direction from the .party class).
function lungeFig(el) {
  if (!el) return;
  const cls = el.classList.contains('enemy') ? 'fig-lunge' : 'fig-lunge-hero';
  el.classList.remove('fig-lunge', 'fig-lunge-hero'); void el.offsetWidth; el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), 420);
}

// ATTACK-TYPE IMPACT VFX — each school reads differently when it lands, so the
// player feels WHAT kind of blow struck: a blade slashes, light bursts, song
// rings out, iron shocks, frost shatters.  Enemy blows use a red claw-strike.
const IMPACT_SVG = {
  blade: `<span class="im-slash s1"></span><span class="im-slash s2"></span><span class="im-spark"></span>`,
  light: `<span class="im-flare"></span><span class="im-rays"></span><span class="im-ring gold"></span>`,
  song:  `<span class="im-ring song r1"></span><span class="im-ring song r2"></span><span class="im-ring song r3"></span>`,
  iron:  `<span class="im-shock"></span><span class="im-ring iron"></span><span class="im-spark iron"></span>`,
  frost: `<span class="im-shatter"><i></i><i></i><i></i><i></i><i></i><i></i></span><span class="im-ring frost"></span>`,
  foe:   `<span class="im-claw c1"></span><span class="im-claw c2"></span><span class="im-claw c3"></span>`,
  phys:  `<span class="im-burst"></span><span class="im-ring phys"></span>`,
};
function impactFx(el, school, big) {
  if (!el) return;
  const layer = $('#popup-layer');
  const stageR = $('#stage').getBoundingClientRect();
  const scale = stageR.width / 760;
  const r = el.getBoundingClientRect();
  const fx = document.createElement('div');
  fx.className = 'impact impact-' + (school || 'phys') + (big ? ' impact-big' : '');
  fx.style.left = ((r.left + r.width / 2 - stageR.left) / scale) + 'px';
  fx.style.top = ((r.top + r.height * 0.42 - stageR.top) / scale) + 'px';
  fx.innerHTML = IMPACT_SVG[school] || IMPACT_SVG.phys;
  layer.appendChild(fx);
  setTimeout(() => fx.remove(), 660);
}
// A distinct electric detonation burst for a TECHNICAL hit on a primed foe.
function techBurst(el) {
  if (!el) return;
  const layer = $('#popup-layer');
  const stageR = $('#stage').getBoundingClientRect();
  const scale = stageR.width / 760;
  const r = el.getBoundingClientRect();
  const fx = document.createElement('div');
  fx.className = 'impact impact-tech';
  fx.style.left = ((r.left + r.width / 2 - stageR.left) / scale) + 'px';
  fx.style.top = ((r.top + r.height * 0.42 - stageR.top) / scale) + 'px';
  fx.innerHTML = `<span class="tb-ring"></span><span class="tb-bolt b1"></span><span class="tb-bolt b2"></span><span class="tb-bolt b3"></span><span class="tb-bolt b4"></span>`;
  layer.appendChild(fx);
  setTimeout(() => fx.remove(), 620);
}
let _narrTimer = null;
function flashNarrator(text) {
  $('#narrator').textContent = text || '';
  clearTimeout(_narrTimer);
  if (text) _narrTimer = setTimeout(() => { $('#narrator').textContent = ''; }, 4200);
}

// ---------------------------------------------------------------------------
// OVERLAY / TITLE / GATE
// ---------------------------------------------------------------------------
function showOverlay(html, extraClass) {
  const ov = $('#overlay');
  ov.className = extraClass || '';
  ov.classList.remove('hidden');
  $('#overlay-inner').innerHTML = html;
}
function hideOverlay() {
  $('#overlay').classList.add('hidden');
  $('#overlay').onclick = null;
}

// ---------------------------------------------------------------------------
// MENU — a standard mobile-RPG pause menu, reachable from the ☰ button.
// ---------------------------------------------------------------------------
function toggleSetting(key) {
  SETTINGS[key] = !SETTINGS[key]; saveSettings();
  if (key === 'fightBg') applyFightBg();
  if (key === 'sound' && SETTINGS.sound) { try { SFX.card(); } catch (_) {} }
}
function resumeFromMenu() {
  hideOverlay();
  if (S) renderAll();
  else if (RUN && !RUN.done) showMap();
  else showTitle();
}
function showMenu() {
  const inRun = !!(RUN && !RUN.done);
  const onOff = (v) => `<span class="menu-val ${v ? 'mv-on' : 'mv-off'}">${v ? 'ON' : 'OFF'}</span>`;
  showOverlay(`
    <div class="ov-eyebrow">PAUSED</div>
    <div class="ov-title" style="font-size:22px; margin-bottom:14px;">MENU</div>
    <div class="menu-list">
      <button class="menu-item menu-primary" id="m-resume">▸ RESUME</button>
      <button class="menu-item" id="m-sound"><span>SOUND</span>${onOff(SETTINGS.sound)}</button>
      <button class="menu-item" id="m-haptics"><span>HAPTICS</span>${onOff(SETTINGS.haptics)}</button>
      <button class="menu-item" id="m-howto"><span>HOW TO PLAY</span><span class="menu-val">?</span></button>
      ${inRun ? `<button class="menu-item menu-warn" id="m-abandon"><span>ABANDON RUN</span><span class="menu-val">✕</span></button>` : ''}
      <button class="menu-item" id="m-title"><span>RETURN TO TITLE</span><span class="menu-val">⌂</span></button>
      <button class="menu-item menu-dev" id="m-dev"><span>⚙ DEV TOOLS</span><span class="menu-val">›</span></button>
    </div>
  `, 'menu-screen');
  $('#m-resume').onclick = resumeFromMenu;
  $('#m-sound').onclick = () => { toggleSetting('sound'); showMenu(); };
  $('#m-haptics').onclick = () => { toggleSetting('haptics'); showMenu(); };
  $('#m-howto').onclick = () => showHowTo();
  $('#m-title').onclick = () => { RUN = null; S = null; try { localStorage.removeItem(RUN_KEY); } catch (_) {} showTitle(); };
  const ab = $('#m-abandon');
  if (ab) ab.onclick = () => { RUN = null; S = null; try { localStorage.removeItem(RUN_KEY); } catch (_) {} showTitle(); };
  $('#m-dev').onclick = () => showDevPanel();
}
function showHowTo(back) {
  showOverlay(`
    <div class="ov-eyebrow">HOW TO PLAY</div>
    <div class="ov-title" style="font-size:20px; margin-bottom:10px;">THE THREADS</div>
    <div class="ov-lines howto" style="text-align:left; max-width:440px; margin:0 auto;">
      <div class="ov-line"><b>Row is stance.</b> Drag a hero between FRONT/MID/BACK — their cards rewrite.</div>
      <div class="ov-line"><b>Defend.</b> When a blow winds up, dodge to an empty row or PARRY it — tap each note as its ring glows.</div>
      <div class="ov-line"><b>Bond.</b> Help an ally (heal, guard, follow-up) to form a THREAD. Hold all three and the trio RESONATES a shared vow.</div>
      <div class="ov-line"><b>Exploit.</b> Hit a foe's weakness twice in a turn to STAGGER it; chain hits to fill BURST, then unleash the ALL-OUT.</div>
      <div class="ov-line"><b>Grow.</b> Every hero starts with one card per stance. Foes drop <b>✦ embers</b> — on the map, spend them in your party's <b>EMBER TREE</b> to unlock cards and upgrades. It's power for <i>this descent only</i>: fall, and it burns away.</div>
      <div class="ov-line"><b>Sacrifice.</b> Drag a card onto your <b>EP dial</b> to feed it for <b>+1 EP</b> — once a turn, so no card is ever dead.</div>
      <div class="ov-line"><b>Inspect.</b> Press &amp; hold any card to enlarge it.</div>
    </div>
    <button class="ov-btn primary" id="ht-back">◂ BACK</button>
  `, 'menu-screen');
  $('#ht-back').onclick = () => (back || showMenu)();
}
// FULL PROGRESS RESET (dev) — wipe everything that makes the game "not
// first-time": unlocked heroes, tutorial flow, one-time coaches, the abyss
// memories and vow ranks, the current run, and Heat.  Device prefs (sound,
// fight background) and the entry gate are left alone.
function resetProgress() {
  [STARTERS_KEY, LAST_STARTER_KEY, PROGRESS_KEY, RUN_KEY, ABYSS_KEY, VOWS_KEY, META_KEY,
   'kizuna2_1.treeTaught', 'kizuna2_1.parryLessons', 'kizuna2_1.strikeLessons']
    .forEach(k => { try { localStorage.removeItem(k); } catch (_) {} });
  RUN = null; S = null; flowIdx = 0; META.heat = 0;
}
let _devResetArmed = false;
function showDevPanel(back) {
  const onOff = (v) => `<span class="menu-val ${v ? 'mv-on' : 'mv-off'}">${v ? 'ON' : 'OFF'}</span>`;
  const armed = _devResetArmed;
  showOverlay(`
    <div class="ov-eyebrow">DEV</div>
    <div class="ov-title" style="font-size:20px; margin-bottom:12px;">DEV TOOLS</div>
    <div class="menu-list">
      <button class="menu-item" id="d-bg"><span>FIGHT BACKGROUND</span>${onOff(SETTINGS.fightBg)}</button>
      <button class="menu-item${armed ? ' mi-danger' : ''}" id="d-reset">
        <span>${armed ? '⚠ TAP AGAIN TO WIPE' : 'RESET PROGRESS'}</span>
        <span class="menu-val mv-off">${armed ? 'CONFIRM' : 'unlocks · tutorial · abyss'}</span>
      </button>
      <button class="menu-item" id="d-back">◂ BACK</button>
    </div>
    <div class="ov-hint">Reset wipes unlocks &amp; tutorial to test first-time flow. Device settings are kept.</div>
  `, 'menu-screen');
  $('#d-bg').onclick = () => { toggleSetting('fightBg'); showDevPanel(); };
  $('#d-reset').onclick = () => {
    if (!_devResetArmed) { _devResetArmed = true; showDevPanel(); return; }   // two-tap confirm
    _devResetArmed = false;
    resetProgress();
    flashNarrator('Progress wiped — the reach forgets you.');
    showTitle();
  };
  $('#d-back').onclick = () => { _devResetArmed = false; (back || showMenu)(); };
}

function showTitle() {
  S = null;
  $('#stage').classList.remove('show-bg');
  $('#timeline').innerHTML = '';
  $('#chapter-chip').textContent = 'KIZUNA';
  const savedFlow = parseInt(localStorage.getItem(PROGRESS_KEY) || '0', 10) || 0;
  const savedRun = loadRun();
  const canContinue = savedFlow > 0 || (savedRun && !savedRun.done);
  // A full-screen JRPG title: a key-art figure fills the frame, the logo sits
  // top-center, and a horizontal menu bar runs across the bottom.  The key art
  // is whoever you LAST descended as (falls back to Ash).
  let artHero = 'ash';
  try { const l = localStorage.getItem(LAST_STARTER_KEY); if (l && HEROES[l] && V2PORTRAITS[l]) artHero = l; } catch (_) {}
  showOverlay(`
    <div class="tt-rays"></div>
    <div class="tt-keyart tt-art-${artHero}"><span class="tt-keyart-glow"></span><span class="tt-keyart-fig">${V2PORTRAITS[artHero] || ''}</span></div>
    <div class="tt-vign"></div>
    <div class="tt-scrim"></div>
    ${Array.from({ length: 14 }).map((_, i) => `<span class="tt-ember" style="--i:${i}"></span>`).join('')}
    <div class="tt-top">
      <div class="tt-title">KIZUNA</div>
      <div class="tt-rule"></div>
      <div class="tt-sub">RESONANCE</div>
    </div>
    <div class="tt-menu-bar">
      <button class="tt-opt tt-opt-primary" id="t-new">NEW GAME</button>
      ${canContinue ? `<button class="tt-opt" id="t-continue">CONTINUE</button>` : ''}
      <button class="tt-opt" id="t-settings">SETTINGS</button>
    </div>
    <div class="tt-ver">V2.1 · BUILD ${V2_BUILD}</div>
  `, 'title-cine');
  $('#t-new').onclick = () => showStarterSelect(id => beginRun(id));
  const c = $('#t-continue');
  if (c) c.onclick = () => {
    const r = loadRun();
    if (r && !r.done) { RUN = r; showMap(); }
    else showStarterSelect(id => beginRun(id));
  };
  $('#t-settings').onclick = () => showSettings();
}
// SETTINGS (from the title) — device prefs, difficulty (Heat), and dev tools.
function showSettings() {
  const onOff = (v) => `<span class="menu-val ${v ? 'mv-on' : 'mv-off'}">${v ? 'ON' : 'OFF'}</span>`;
  showOverlay(`
    <div class="ov-eyebrow">TITLE</div>
    <div class="ov-title" style="font-size:22px; margin-bottom:14px;">SETTINGS</div>
    <div class="menu-list">
      <button class="menu-item" id="s-sound"><span>SOUND</span>${onOff(SETTINGS.sound)}</button>
      <button class="menu-item" id="s-haptics"><span>HAPTICS</span>${onOff(SETTINGS.haptics)}</button>
      <button class="menu-item" id="s-bg"><span>FIGHT BACKGROUND</span>${onOff(SETTINGS.fightBg)}</button>
      <button class="menu-item" id="s-heat"><span>HEAT <i style="opacity:.6">· foes hit harder, +embers</i></span><span class="menu-heat"><button id="s-heat-dn" aria-label="lower heat">−</button><b>${META.heat || 0}</b><button id="s-heat-up" aria-label="raise heat">+</button></span></button>
      <button class="menu-item" id="s-howto"><span>HOW TO PLAY</span><span class="menu-val">?</span></button>
      <button class="menu-item menu-dev" id="s-dev"><span>⚙ DEV TOOLS</span><span class="menu-val">›</span></button>
      <button class="menu-item menu-primary" id="s-back">◂ BACK</button>
    </div>
  `, 'menu-screen');
  $('#s-sound').onclick = () => { toggleSetting('sound'); showSettings(); };
  $('#s-haptics').onclick = () => { toggleSetting('haptics'); showSettings(); };
  $('#s-bg').onclick = () => { toggleSetting('fightBg'); showSettings(); };
  const setHeat = (d) => { META.heat = Math.max(0, Math.min(5, (META.heat || 0) + d)); saveMeta(); showSettings(); };
  $('#s-heat-dn').onclick = (e) => { e.stopPropagation(); setHeat(-1); };
  $('#s-heat-up').onclick = (e) => { e.stopPropagation(); setHeat(1); };
  $('#s-howto').onclick = () => showHowTo(showSettings);
  $('#s-dev').onclick = () => showDevPanel(showSettings);
  $('#s-back').onclick = () => showTitle();
}

// THE EMBER TREE — a branching constellation.  Each hero's nodes hang from a
// root along lit paths; a node's PREREQUISITE feeds it down a thread.  Pick a
// node to read it in the detail bar, then kindle it.
const TREE_TYPE_LABEL = { card: 'SIGNATURE', rider: 'UPGRADE', passive: 'PASSIVE', allout: 'ALL-OUT', emergent: 'EMERGENT', synergy: 'TEAM SYNERGY' };
const TREE_TYPE_GLYPH = { card: '❖', rider: '⊕', passive: '❉', allout: '✷', emergent: '✦', synergy: '☍' };
const TREE_HEROES = EMBER_TREE.reduce((a, n) => (a.includes(n.hero) ? a : a.concat(n.hero)), []);
const TREE_PAN = {};   // per-hero pan offset, kept across re-renders (selecting a node re-renders)
// Drag-to-pan the constellation so outer-ring nodes (the tier-3/4 arms that
// reach past the canvas) are always tap-able.  Suppresses the orb SELECT click
// when the gesture was actually a drag.
function attachTreePan(heroId) {
  const canvas = document.getElementById('et-canvas');
  const pan = document.getElementById('et-pan');
  if (!canvas || !pan) return;
  const CLAMP = 165;
  const clamp = (v) => Math.max(-CLAMP, Math.min(CLAMP, v));
  let ox = (TREE_PAN[heroId] && TREE_PAN[heroId].x) || 0;
  let oy = (TREE_PAN[heroId] && TREE_PAN[heroId].y) || 0;
  const apply = () => { pan.style.transform = `translate(${ox}px, ${oy}px)`; };
  apply();
  let sx = 0, sy = 0, drag = false, pid = null;
  canvas.addEventListener('pointerdown', (e) => {
    pid = e.pointerId; sx = e.clientX; sy = e.clientY; drag = true; canvas._dragMoved = false;
    canvas.classList.add('et-grabbing');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== pid) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) + Math.abs(dy) > 6) canvas._dragMoved = true;
    pan.style.transform = `translate(${clamp(ox + dx)}px, ${clamp(oy + dy)}px)`;
  });
  const end = (e) => {
    if (!drag) return; drag = false; canvas.classList.remove('et-grabbing');
    ox = clamp(ox + (e.clientX - sx)); oy = clamp(oy + (e.clientY - sy));
    TREE_PAN[heroId] = { x: ox, y: oy }; apply();
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
}
// node state for the current META: owned / ready(buyable) / poor(can't afford)
// / needs(prereq) / sealed(tier).
function nodeState(n) {
  if (hasNode(n.id)) return 'owned';
  if (!tierOpen(n.tier)) return 'sealed';
  if (!(n.requires || []).every(r => hasNode(r))) return 'needs';
  return runEmbers() >= n.cost ? 'ready' : 'poor';
}
// You can only build the heroes you're FIELDING — the tree shows your party.
function partyHeroes() { return (RUN && RUN.active && RUN.active.length) ? RUN.active.filter(id => TREE_HEROES.indexOf(id) >= 0) : []; }
// Is at least one node in the party's trees kindle-able RIGHT NOW (affordable,
// prereqs met, tier open)?  Gates the map's "kindle a skill" coach.
function canKindleNow() {
  return partyHeroes().some(hid => EMBER_TREE.some(n => n.hero === hid && nodeState(n) === 'ready'));
}
function showEmberTree(onBack, heroId, selId) {
  $('#stage').classList.remove('show-bg');
  // a "__kindled:" prefix on selId means we just bought that node — celebrate it
  let justKindled = false;
  if (selId && String(selId).indexOf('__kindled:') === 0) { justKindled = true; selId = selId.slice(10); }
  const party = partyHeroes();
  // only your fielded party has constellations here; clamp to a party member
  if (party.length && party.indexOf(heroId) < 0) heroId = party[0];
  heroId = heroId && HEROES[heroId] ? heroId : (party[0] || 'ash');
  const nodes = EMBER_TREE.filter(n => n.hero === heroId);
  // ---- SPHERE GRID: a hub at the centre, rings growing OUTWARD.  A node's ring
  // is its prerequisite DEPTH (0 = spokes off the hub), its angle inherited from
  // the prerequisite so a chain reads as one radial arm. --------------------------
  const W = 300, H = 300, CX = 150, CY = 150, R0 = 66, RING = 62;
  const depth = {};
  const depthOf = (n) => {
    if (depth[n.id] != null) return depth[n.id];
    const reqs = (n.requires || []).map(r => NODE_BY_ID[r]).filter(Boolean);
    return depth[n.id] = reqs.length ? 1 + Math.max.apply(null, reqs.map(depthOf)) : 0;
  };
  nodes.forEach(depthOf);
  const byDepth = {}; nodes.forEach(n => { (byDepth[depth[n.id]] = byDepth[depth[n.id]] || []).push(n); });
  const angle = {};
  // inner ring: spread the hub's spokes evenly; an even count is offset a
  // half-step so the arms sit DIAGONAL (never axis-aligned) — no two labels
  // stack on a flat horizontal spoke.
  (byDepth[0] || []).forEach((n, i, a) => { const off = a.length % 2 === 0 ? 0.5 : 0; angle[n.id] = -90 + (i + off) * (360 / a.length); });
  // deeper rings: sit at the prerequisite's angle (siblings fan apart a little)
  Object.keys(byDepth).map(Number).filter(d => d > 0).sort((a, b) => a - b).forEach(d => {
    const groups = {};
    byDepth[d].forEach(n => { const k = (n.requires || [])[0] || 'root'; (groups[k] = groups[k] || []).push(n); });
    Object.keys(groups).forEach(k => {
      const base = angle[k] != null ? angle[k] : 0, arr = groups[k];
      arr.forEach((n, i) => { angle[n.id] = base + (arr.length > 1 ? (i - (arr.length - 1) / 2) * 24 : 0); });
    });
  });
  const pos = {};
  nodes.forEach(n => {
    const a = (angle[n.id] || 0) * Math.PI / 180, r = R0 + depth[n.id] * RING;
    pos[n.id] = { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
  });
  const root = { x: CX, y: CY };
  // ---- LINKS: straight spokes — prereq → node, or hub → a depth-0 node ---------
  const links = [];
  nodes.forEach(n => {
    const reqs = (n.requires || []).filter(r => pos[r]);
    if (reqs.length) reqs.forEach(r => links.push({ a: pos[r], b: pos[n.id], on: hasNode(r), full: hasNode(r) && hasNode(n.id) }));
    else links.push({ a: root, b: pos[n.id], on: tierOpen(n.tier), full: hasNode(n.id) });
  });
  const linkSvg = links.map(l => {
    const cls = l.full ? 'et-link-full' : l.on ? 'et-link-on' : 'et-link-off';
    return `<path class="et-link ${cls}" vector-effect="non-scaling-stroke" d="M ${l.a.x} ${l.a.y} L ${l.b.x} ${l.b.y}" />`;
  }).join('');
  // faint ring guides behind the spokes, one per depth present
  const maxDepth = Math.max.apply(null, nodes.map(n => depth[n.id]));
  let ringSvg = '';
  for (let d = 0; d <= maxDepth; d++) ringSvg += `<circle class="et-ring" cx="${CX}" cy="${CY}" r="${R0 + d * RING}" vector-effect="non-scaling-stroke" />`;
  // ---- ORBS -------------------------------------------------------------------
  const orbs = nodes.map(n => {
    const st = nodeState(n);
    const p = pos[n.id];
    return `<button class="et-orb et-${st} t-${n.type}${n.id === selId ? ' et-sel' : ''}" data-id="${n.id}"
       style="left:${(p.x / W) * 100}%; top:${(p.y / H) * 100}%">
       <span class="et-orb-glyph">${st === 'owned' ? '✓' : st === 'sealed' ? '🔒' : TREE_TYPE_GLYPH[n.type]}</span>
       <span class="et-orb-name">${n.label}</span>
       ${st === 'ready' || st === 'poor' ? `<span class="et-orb-cost${st === 'poor' ? ' et-cant' : ''}">✦${n.cost}</span>` : ''}
     </button>`;
  }).join('');
  const rootOrb = `<div class="et-orb et-root" style="left:${(root.x / W) * 100}%; top:${(root.y / H) * 100}%"><span class="et-orb-glyph">◆</span></div>`;
  // ---- DETAIL BAR (selected node) ---------------------------------------------
  const sel = selId ? NODE_BY_ID[selId] : nodes.find(n => nodeState(n) === 'ready') || nodes[0];
  let detail = '<div class="et-detail-empty">Pick a node to inspect it.</div>';
  if (sel) {
    const st = nodeState(sel);
    const reqNames = (sel.requires || []).filter(r => !hasNode(r)).map(r => NODE_BY_ID[r].label);
    const action = st === 'owned' ? '<span class="et-d-owned">✓ KINDLED</span>'
      : st === 'sealed' ? `<span class="et-d-lock">descend deeper to unseal tier ${sel.tier}</span>`
      : st === 'needs' ? `<span class="et-d-lock">needs ${reqNames.join(' · ')}</span>`
      : `<button class="et-d-buy${st === 'poor' ? ' et-d-cant' : ''}" id="et-buy" ${st === 'poor' ? 'disabled' : ''}>KINDLE · ✦ ${sel.cost}</button>`;
    detail = `<div class="et-d-head"><span class="et-d-type t-${sel.type}">${TREE_TYPE_LABEL[sel.type]}</span><span class="et-d-name">${sel.label}</span></div>
      <div class="et-d-desc">${sel.desc}</div>
      <div class="et-d-foot">${action}</div>`;
  }
  // tabs are ONLY your fielded party's constellations
  const tabHeroes = party.length ? party : [heroId];
  const tabs = tabHeroes.map(hid => {
    const done = EMBER_TREE.filter(n => n.hero === hid).every(n => hasNode(n.id));
    return `<button class="et-tab${hid === heroId ? ' et-tab-on' : ''}${done ? ' et-tab-done' : ''}" data-hero="${hid}">${HEROES[hid].name}</button>`;
  }).join('');
  showOverlay(`
    <div class="et-head"><span class="et-h-title">THE EMBER TREE</span><span class="et-h-wallet">✦ <b>${runEmbers()}</b></span><span class="et-h-boss">this descent only · resets if you fall</span></div>
    <div class="et-tabs">${tabs}</div>
    <div class="et-body">
      <div class="et-canvas et-grid" id="et-canvas">
        <div class="et-pan" id="et-pan">
          <svg class="et-links" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${ringSvg}${linkSvg}</svg>
          ${rootOrb}${orbs}
        </div>
      </div>
      <div class="et-side">
        ${!treeTaught() ? `<div class="et-coach">Tap a <b>lit node</b>, then press <b>KINDLE</b> — the skill joins ${HEROES[heroId].name}’s hand for this descent.</div>` : ''}
        <div class="et-detail">${detail}</div>
        <button class="ov-btn et-back-btn" id="et-back">◂ BACK</button>
      </div>
    </div>
  `, 'map-screen et-screen');
  document.querySelectorAll('.et-tab').forEach(el => {
    el.onclick = () => { if (el.dataset.hero !== heroId) showEmberTree(onBack, el.dataset.hero); };
  });
  const etCanvas = document.getElementById('et-canvas');
  document.querySelectorAll('.et-orb[data-id]').forEach(el => {
    el.onclick = () => { if (etCanvas && etCanvas._dragMoved) return; showEmberTree(onBack, heroId, el.dataset.id); };   // a drag pans; a tap selects
  });
  attachTreePan(heroId);
  const buy = $('#et-buy');
  if (buy && sel) buy.onclick = () => {
    if (nodeState(sel) !== 'ready') return;
    const first = !treeTaught();
    const bought = sel;
    addEmbers(-bought.cost); unlockNode(bought.id); setTreeTaught();   // learning the tree, once
    // the skill CATCHES — a full-screen ember-bloom before dropping back to the tree
    kindleBurst(bought, () => showEmberTree(onBack, heroId, first ? '__kindled:' + bought.id : bought.id));
  };
  // celebrate the very first kindle so the loop clicks: node → KINDLE → in hand
  if (justKindled) {
    const c = document.querySelector('.et-side');
    if (c) { const b = document.createElement('div'); b.className = 'et-kindled-note'; b.innerHTML = '✓ <b>Kindled!</b> It’s in your hand now. Spend more embers here between fights — but it all resets if you fall.'; c.insertBefore(b, c.firstChild); }
  }
  $('#et-back').onclick = () => { hideOverlay(); (onBack || showTitle)(); };
}
// CHOOSE YOUR SURVIVOR — pick the hero you begin (solo) with, from the ones
// you've UNLOCKED.  Locked heroes are shown dimmed: recruit them on the road to
// unlock them as a future starter.
function showStarterSelect(onPick) {
  const unlocked = getUnlockedStarters();
  const cards = STARTER_POOL.map(id => {
    const h = HEROES[id]; const open = unlocked.includes(id);
    return `<button class="ss-fig${open ? '' : ' ss-locked'}" data-id="${id}" ${open ? '' : 'disabled'}>
      <span class="ss-art">${V2PORTRAITS[id] || ''}</span>
      <span class="ss-name">${h.name}</span>
      <span class="ss-cls">${h.cls} · <b>${h.archetype || ''}</b></span>
      <span class="ss-identity">${open ? (h.identity || '') : '🔒 recruit them on the road to unlock'}</span>
    </button>`;
  }).join('');
  showOverlay(`
    <div class="ov-eyebrow">THE ABYSS TAKES EVERYONE · WHO WALKS BACK IN?</div>
    <div class="ov-title" style="font-size:20px; margin-bottom:12px;">CHOOSE YOUR SURVIVOR</div>
    <div class="ss-row">${cards}</div>
    <div class="ov-hint">You descend ALONE — the rest of your thread is found on the road.</div>
    <button class="ov-btn" id="ss-back">◂ BACK</button>
  `, 'map-screen');
  document.querySelectorAll('.ss-fig:not(.ss-locked)').forEach(el => {
    el.onclick = () => { hideOverlay(); onPick(el.dataset.id); };
  });
  $('#ss-back').onclick = () => showTitle();
}
// A short, hero-specific opening beat, then into the Descent.
function beginRun(starterId) {
  RUN = newRun(starterId);
  flowIdx = FLOW.length;
  try { localStorage.setItem(PROGRESS_KEY, String(FLOW.length)); localStorage.removeItem(RUN_KEY); localStorage.setItem(LAST_STARTER_KEY, starterId); } catch (_) {}
  saveRun();
  const h = HEROES[starterId];
  showStory({
    type: 'story', chapter: 3, title: h.name, eyebrow: 'ONE SURVIVOR',
    lines: [
      { text: 'The first thing you understand is that everyone else is gone.' },
      { spk: h.name, text: '…then I carry it alone. For now.' },
      { text: `You are <b>${h.name}</b> — ${h.identity || h.cls}. Your <b>row is your stance</b>, and when a blow falls you <b>dodge</b> it or <b>parry</b> it in time. Descend, find the others, and the <b>threads</b> you forge become the real weapon.` },
    ],
    beginDescent: true,
  });
}

function showGate() {
  showOverlay(`
    <div class="ov-title" style="font-size:24px">KIZUNA</div>
    <div class="ov-sub">THREADS</div>
    <div class="gate-card">
      <input type="password" id="gate-input" autocomplete="off" placeholder="…" />
      <button class="ov-btn primary" id="gate-go">ENTER</button>
      <div class="gate-err" id="gate-err"></div>
    </div>
  `);
  const tryIt = () => {
    if (($('#gate-input').value || '').toLowerCase() === 'keeter') {
      try { localStorage.setItem(UNLOCK_KEY, '1'); } catch (_) {}
      showTitle();
    } else { $('#gate-err').textContent = 'incorrect'; $('#gate-input').value = ''; }
  };
  $('#gate-go').onclick = tryIt;
  $('#gate-input').addEventListener('keydown', e => { if (e.key === 'Enter') tryIt(); });
  setTimeout(() => $('#gate-input').focus(), 60);
}

// ---------------------------------------------------------------------------
// FIT-TO-SCREEN + BOOT
// ---------------------------------------------------------------------------
function fitStage() {
  const w = window.innerWidth, h = window.innerHeight;
  const scale = Math.min(w / 760, h / 430);
  $('#stage').style.transform = `scale(${scale})`;
}
window.addEventListener('resize', fitStage);
window.addEventListener('orientationchange', () => setTimeout(fitStage, 120));

// Cancel tap-targeting on stray taps (drag mode manages its own lifecycle).
document.addEventListener('pointerdown', (e) => {
  if (!targeting || targeting.drag) return;
  if (e.target.closest('.fig-targetable') || (targeting.isRow && e.target.closest('.slot'))) return;
  cancelTargeting();
}, true);

$('#btn-endturn').addEventListener('click', endTurn);

// ---------------------------------------------------------------------------
// AUTO-UPDATE — GitHub Pages caches HTML for ~10 minutes, so a fresh deploy
// can sit invisible behind a stale index.html.  We poll a tiny version
// manifest (cache: no-store beats the CDN), and when a newer build exists an
// UPDATE chip appears; tapping it reloads with a cache-busting query so the
// fresh HTML (and its fresh ?v= asset URLs) actually arrive.
function checkForUpdate() {
  fetch('../version.json?ts=' + Date.now(), { cache: 'no-store' })
    .then(r => r.ok ? r.json() : null)
    .then(v => {
      if (!v || !(v['v2.1'] > V2_BUILD)) return;
      if (document.getElementById('update-chip')) return;
      const chip = document.createElement('button');
      chip.id = 'update-chip';
      chip.textContent = '✦ UPDATE READY · BUILD ' + v['v2.1'] + ' — TAP';
      chip.onclick = () => location.replace(location.pathname + '?u=' + v['v2.1']);
      document.body.appendChild(chip);
    })
    .catch(() => {});
}
setInterval(checkForUpdate, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkForUpdate(); });
setTimeout(checkForUpdate, 2500);

fitStage();
{ const mb = $('#menu-btn'); if (mb) mb.onclick = showMenu; }
let unlocked = false;
try { unlocked = localStorage.getItem(UNLOCK_KEY) === '1'; } catch (_) {}
if (unlocked) showTitle(); else showGate();
