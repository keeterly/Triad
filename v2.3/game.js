// ============================================================================
// KIZUNA v2.3 — the shared-deck combat rebuild.
//
// This file is the whole slice: card data, the ONE evaluator, the combat
// state machine, the Mourning Regent, packet-based rhythm defense, and the
// mobile-landscape UI from the v2.3 design canvas.
//
// The load-bearing rules (docs/COMBAT-SPEC.md):
//  · Every card is an Action. No Opener/Combo/Finisher gates — a card plays
//    whenever its CURRENT cost can be paid, and a failed Modifier never
//    cancels a base effect.
//  · evaluateCard() is the single source of truth. The hand, the focus
//    panel, affordability and resolution all read the same function; there
//    is no second copy of the Modifier logic hiding in the UI.
//  · One state-transition owner. setPhase() is the only door between
//    phases; nothing else mutates C.phase.
//  · Defense is played. Enemy damage splits into packets, one per rhythm
//    note; each note's grade decides its packet. The timing windows are the
//    v2.2 parry windows, unchanged, because they already matched the spec.
// ============================================================================

'use strict';

const V23_BUILD = 4;   // MUST match version.json's "v2.3" — bump BOTH every build.

// PRESENTATION SCALE (spec §6): the engine runs the normalized prototype
// values; the SCREEN multiplies every HP and damage number by one uniform
// factor so the game reads like the concept's big JRPG numbers. Because the
// factor is uniform, all visible arithmetic still checks out. Set to 1 to
// read raw values.
const DISPLAY_SCALE = 150;
const fmtN = (n) => (n * DISPLAY_SCALE).toLocaleString('en-US');

// ── deterministic RNG (mulberry32) — the whole fight is replayable from a seed
let _seed = (Date.now() >>> 0);
function setSeed(n) { _seed = (n >>> 0) || 1; }
function rng() {
  _seed |= 0; _seed = (_seed + 0x6D2B79F5) | 0;
  let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function shuffle(a) {
  const x = a.slice();
  for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; }
  return x;
}

// ═════════════════════════════════════════════════════════════════════════════
// THE PARTY AND THE 15-CARD DECK (spec §6) — normalized prototype values.
// ═════════════════════════════════════════════════════════════════════════════
// Per-hero HP (Build 2, at the designer's direction): the party reads as a
// stacked JRPG roster, so each hero carries their own pool. The pools sum to
// the spec's normalized 42, keeping aggregate boss pressure intact; the
// deviation from §7.1's single shared pool is recorded in the spec addendum.
const HEROES23 = {
  ash:  { name: 'ASH',  cls: 'Vanguard', art: '../art/kai.webp',  row0: 'front', maxHp: 16 },
  elin: { name: 'ELIN', cls: 'Oracle',   art: '../art/elin.webp', row0: 'back',  maxHp: 12 },
  mira: { name: 'MIRA', cls: 'Shade',    art: '../art/mira.webp', row0: 'front', maxHp: 14 },
};

// Effects are tiny data atoms; resolveEffects() is the only interpreter.
//  dmg / guard / healParty / brk / bleed(+turns) / setAffinity / strikeAgain
//  consumeBleed / switchRow / moveTo
const CARD_DEFS = {
  // ── Ash — Vanguard ──
  cleave:    { owner: 'ash', name: 'Cleave',          cost: 1, target: 'enemy', base: [{ dmg: 6 }], mod: null },
  brace:     { owner: 'ash', name: 'Brace',           cost: 1, target: 'party', base: [{ guard: 5 }], mod: null },
  vthrust:   { owner: 'ash', name: 'Vanguard Thrust', cost: 1, target: 'enemy', base: [{ dmg: 5 }],
               mod: { cond: 'AFTER_MOVING', bonus: [{ dmg: 4 }, { brk: 1 }], text: 'After Moving · +4 damage · 1 Break' } },
  redge:     { owner: 'ash', name: 'Rising Edge',     cost: 1, target: 'enemy', base: [{ dmg: 4 }],
               mod: { cond: 'AFTER_OTHER_HERO', bonus: [{ strikeAgain: 4 }], text: 'After Another Hero · strike again for 4' } },
  crosssever:{ owner: 'ash', name: 'Cross Sever',     cost: 2, target: 'enemy', base: [{ dmg: 9 }], memory: true,
               mod: { cond: 'SECOND_ACTION', costOverride: 1, bonus: [{ dmg: 3 }, { brk: 1 }], text: 'Second Action · cost 1 AP · +3 damage · 1 Break' } },
  // ── Elin — Oracle ──
  lveil:     { owner: 'elin', name: 'Lumen Veil',     cost: 1, target: 'party', base: [{ guard: 5 }], mod: null },
  mend:      { owner: 'elin', name: 'Mend',           cost: 1, target: 'party', base: [{ healParty: 5 }, { guard: 2 }], mod: null },
  frostbind: { owner: 'elin', name: 'Frost Bind',     cost: 1, target: 'enemy', base: [{ dmg: 4 }, { setAffinity: 'frost' }],
               mod: { cond: 'TARGET_HAS_PYRE', bonus: [{ dmg: 5 }, { brk: 2 }], text: 'Target Has Pyre · +5 damage · 2 Break · Pyre becomes Frost' } },
  wecho:     { owner: 'elin', name: "Winter's Echo",  cost: 1, target: 'enemy', base: [{ dmg: 4 }],
               mod: { cond: 'TARGET_HAS_FROST', bonus: [{ dmg: 3 }, { guard: 4 }], text: 'Target Has Frost · +3 damage · gain 4 Guard' } },
  lcascade:  { owner: 'elin', name: 'Lumen Cascade',  cost: 1, target: 'enemy', base: [{ dmg: 4 }], memory: true,
               mod: { cond: 'AFTER_OTHER_HERO', costOverride: 0, bonus: [{ guard: 3 }], text: 'After Another Hero · cost 0 AP · gain 3 Guard' } },
  // ── Mira — Shade ──
  serrate:   { owner: 'mira', name: 'Serrate',        cost: 1, target: 'enemy', base: [{ dmg: 3 }, { bleed: 3, turns: 2 }], mod: null },
  sstep:     { owner: 'mira', name: 'Shadowstep',     cost: 1, target: 'enemy', base: [{ dmg: 4 }, { switchRow: 'mira' }], mod: null },
  twinfang:  { owner: 'mira', name: 'Twin Fang',      cost: 1, target: 'enemy', base: [{ dmg: 4 }],
               mod: { cond: 'TARGET_IS_BLEEDING', bonus: [{ strikeAgain: 6 }, { consumeBleed: true }], text: 'Target Is Bleeding · strike again for 6 · consume Bleed' } },
  tshift:    { owner: 'mira', name: 'Thermal Shift',  cost: 1, target: 'enemy', base: [{ dmg: 4 }, { setAffinity: 'pyre' }],
               mod: { cond: 'TARGET_HAS_FROST', bonus: [{ dmg: 5 }, { brk: 2 }], text: 'Target Has Frost · +5 damage · 2 Break · Frost becomes Pyre' } },
  execthread:{ owner: 'mira', name: 'Execution Thread', cost: 2, target: 'enemy', base: [{ dmg: 9 }], memory: true,
               mod: { cond: 'TARGET_HP_BELOW_35', costOverride: 1, bonus: [{ dmg: 6 }], text: 'Target ≤35% HP · cost 1 AP · +6 damage' } },
};
const DECK_IDS = Object.keys(CARD_DEFS);   // 15, five per hero — the whole deck

// ── the one equipped Bond Art (spec §8) ──
const RESONANCE = {
  pair: ['ash', 'elin'],
  name: 'Light Through Steel',
  cost: 1,
  text: '10 damage · 2 Break · 7 party Guard · Ash to Front · once per encounter',
};

// ═════════════════════════════════════════════════════════════════════════════
// THE MOURNING REGENT (spec §10)
// ═════════════════════════════════════════════════════════════════════════════
// Rhythm strings per intent; phase II appends one note (longer strings).
const REGENT_INTENTS = [
  { id: 'hymn',  name: 'Ruinous Hymn',       kind: 'attack', dmg: [22, 29], target: 'ash',
    notes: [['tap', 'tap', 'slide', 'tap'], ['tap', 'tap', 'slide', 'tap', 'hold']] },
  { id: 'scythe', name: 'Scything Advance',  kind: 'attack', dmg: [26, 33], backDmg: [7, 11], target: 'mira',
    notes: [['tap', 'slide', 'hold'], ['tap', 'slide', 'tap', 'hold']] },
  { id: 'benediction', name: 'Hollow Benediction', kind: 'heal', heal: [8, 10], target: 'self', notes: [[], []] },
  { id: 'rain', name: 'Ashen Rain',          kind: 'attack', dmg: [20, 27], burn: [4, 6], target: 'elin',
    notes: [['tap', 'tap', 'tap', 'slide'], ['tap', 'tap', 'tap', 'slide', 'tap']] },
];

// ── rhythm grade windows — the v2.2 parry windows, which already match §9.3
const PERF_MS = 80, GREAT_MS = 140, GOOD_MS = 220;
function gradeOffset(absMs) {
  if (absMs <= PERF_MS) return 'perfect';
  if (absMs <= GREAT_MS) return 'great';
  if (absMs <= GOOD_MS) return 'good';
  return 'miss';
}

// ═════════════════════════════════════════════════════════════════════════════
// COMBAT STATE + THE ONE TRANSITION OWNER
// ═════════════════════════════════════════════════════════════════════════════
let C = null;

const PHASES = ['INTRO', 'PLAYER_READY', 'CARD_FOCUS', 'PLAYER_ACTION_RESOLVING',
  'HAND_DISCARDING', 'ENEMY_TELEGRAPH', 'ENEMY_ATTACK_LAUNCH', 'RHYTHM_DEFENSE',
  'ENEMY_RESOLUTION', 'HAND_DRAWING', 'VICTORY', 'DEFEAT'];
function setPhase(p) {
  if (!PHASES.includes(p)) throw new Error('unknown phase ' + p);
  if (!C || C.phase === 'VICTORY' || C.phase === 'DEFEAT') return;   // terminal states hold
  C.phase = p;
}

function startCombat(opts) {
  if (opts && opts.seed != null) setSeed(opts.seed);
  C = {
    phase: 'INTRO',
    turn: 1,
    party: { guard: 0, burn: 0 },   // Guard and Burn stay party-shared (spec §7.1)
    heroes: {
      ash:  { row: HEROES23.ash.row0,  hp: HEROES23.ash.maxHp,  max: HEROES23.ash.maxHp,  downed: false },
      elin: { row: HEROES23.elin.row0, hp: HEROES23.elin.maxHp, max: HEROES23.elin.maxHp, downed: false },
      mira: { row: HEROES23.mira.row0, hp: HEROES23.mira.maxHp, max: HEROES23.mira.maxHp, downed: false },
    },
    boss: {
      name: 'The Mourning Regent', hp: 90, max: 90, phase: 1, ward: 0,
      breakMax: 5, brk: 5, affinity: null, bleed: 0, bleedTurns: 0, intentIx: 0,
    },
    deck: shuffle(DECK_IDS), hand: [], discard: [],
    ap: 3,
    turnState: { actionsPlayed: [], heroesMoved: [], resonanceChargedThisTurn: false },
    resonance: { charges: 0, used: false },
    telemetry: { plays: [], parry: [], fourCardTurns: 0 },
    log: [],
  };
  for (let i = 0; i < 5; i++) drawOne();
  setPhase('PLAYER_READY');
  renderAll();
  return C;
}

function currentIntent() {
  const it = REGENT_INTENTS[C.boss.intentIx % REGENT_INTENTS.length];
  const p = C.boss.phase - 1;
  const notes = it.notes[p] || it.notes[0];
  return { ...it, phaseDmg: it.dmg ? it.dmg[p] : 0, phaseHeal: it.heal ? it.heal[p] : 0,
           phaseBackDmg: it.backDmg ? it.backDmg[p] : null, phaseBurn: it.burn ? it.burn[p] : 0,
           noteSeq: notes };
}
function livingHeroes() { return Object.keys(C.heroes).filter(id => !C.heroes[id].downed); }
// Who the blow actually falls on: the scripted target while they stand,
// otherwise the first hero still on their feet.
function intentTargetId() {
  const it = REGENT_INTENTS[C.boss.intentIx % REGENT_INTENTS.length];
  if (it.target === 'self') return null;
  if (C.heroes[it.target] && !C.heroes[it.target].downed) return it.target;
  return livingHeroes()[0] || null;
}
// The number the telegraph shows RIGHT NOW — positional counterplay previews
// live (move the Scything target Back and the plate re-reads 7, not 26).
function intentPreviewDmg() {
  const it = currentIntent();
  if (it.kind !== 'attack') return 0;
  const tgt = intentTargetId();
  if (it.phaseBackDmg != null && tgt && C.heroes[tgt].row === 'back') return it.phaseBackDmg;
  return it.phaseDmg;
}

// ═════════════════════════════════════════════════════════════════════════════
// THE EVALUATOR (spec §14.2) — deterministic, and the ONLY copy of this logic.
// ═════════════════════════════════════════════════════════════════════════════
function evalCondition(cond, ownerId) {
  const ts = C.turnState, last = ts.actionsPlayed[ts.actionsPlayed.length - 1];
  switch (cond) {
    case 'AFTER_MOVING':        return ts.heroesMoved.includes(ownerId);
    case 'AFTER_OTHER_HERO':    return !!last && last.ownerId !== ownerId;
    case 'SECOND_ACTION':       return ts.actionsPlayed.length === 1;
    case 'TARGET_HAS_PYRE':     return C.boss.affinity === 'pyre';
    case 'TARGET_HAS_FROST':    return C.boss.affinity === 'frost';
    case 'TARGET_IS_BLEEDING':  return C.boss.bleedTurns > 0;
    case 'TARGET_HP_BELOW_35':  return C.boss.hp <= C.boss.max * 0.35;
    default: return false;
  }
}
function evaluateCard(cardId) {
  const card = CARD_DEFS[cardId];
  if (!card) return null;
  const modifierActive = card.mod ? evalCondition(card.mod.cond, card.owner) : false;
  const currentCost = (modifierActive && card.mod.costOverride !== undefined)
    ? card.mod.costOverride : card.cost;
  return {
    cardId, card, modifierActive, currentCost,
    resolvedEffects: modifierActive ? [...card.base, ...card.mod.bonus] : card.base.slice(),
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// RESOLUTION
// ═════════════════════════════════════════════════════════════════════════════
function dealToBoss(n, why) {
  let left = n;
  if (C.boss.ward > 0) { const w = Math.min(C.boss.ward, left); C.boss.ward -= w; left -= w; }
  C.boss.hp = Math.max(0, C.boss.hp - left);
  fxDamageBoss(n, why);
  checkBossPhase();
  if (C.boss.hp <= 0) setPhase('VICTORY');
}
function checkBossPhase() {
  if (C.boss.phase === 1 && C.boss.hp <= 45 && C.boss.hp > 0) {
    C.boss.phase = 2;
    C.boss.ward = 10;
    C.boss.breakMax = 7;
    C.boss.brk = Math.min(C.boss.brk + 2, C.boss.breakMax);   // gauge adjusts with the new max
    logLine('The Regent rises — Phase II. A ward of 10 gathers.');
  }
}
function resolveEffects(effects) {
  // Additive `dmg` atoms are ONE strike — "deal +6 damage" rides the same blow
  // it modifies. Split hits would let a mid-card phase transition (the Ward
  // arriving at 45) interpose between a base and its bonus; only strikeAgain
  // is a genuinely separate blow.
  const strike = effects.reduce((n, fx) => n + (fx.dmg || 0), 0);
  let struck = false;
  for (const fx of effects) {
    if (fx.dmg && !struck) { struck = true; dealToBoss(strike, 'hit'); }
    if (fx.strikeAgain) dealToBoss(fx.strikeAgain, 'again');
    if (fx.brk)        { C.boss.brk = Math.max(0, C.boss.brk - fx.brk); fxBreak(); }
    if (fx.guard)      C.party.guard += fx.guard;
    if (fx.healParty)  { const m = livingHeroes().sort((a, b) =>
        (C.heroes[b].max - C.heroes[b].hp) - (C.heroes[a].max - C.heroes[a].hp))[0];
      if (m) C.heroes[m].hp = Math.min(C.heroes[m].max, C.heroes[m].hp + fx.healParty); }
    if (fx.bleed)      { C.boss.bleed = fx.bleed; C.boss.bleedTurns = fx.turns || 2; }
    if (fx.consumeBleed) { C.boss.bleed = 0; C.boss.bleedTurns = 0; }
    if (fx.setAffinity) C.boss.affinity = fx.setAffinity;
    if (fx.switchRow)  { const h = C.heroes[fx.switchRow]; h.row = h.row === 'front' ? 'back' : 'front'; }
    if (fx.moveTo)     C.heroes[fx.moveTo.hero].row = fx.moveTo.row;
    if (C.phase === 'VICTORY') return;
  }
}

function playCard(cardId) {
  if (!C || C.phase !== 'PLAYER_READY') return false;
  if (!C.hand.includes(cardId)) return false;
  const ev = evaluateCard(cardId);                    // cost updates BEFORE affordability
  if (C.heroes[ev.card.owner].downed) return false;   // the fallen play nothing
  if (C.ap < ev.currentCost) return false;
  setPhase('PLAYER_ACTION_RESOLVING');
  C.ap -= ev.currentCost;
  C.hand.splice(C.hand.indexOf(cardId), 1);
  C.discard.push(cardId);

  // Resonance charge (spec §8.1): a Modifier Action of the pair resolved, the
  // IMMEDIATELY following Action is the other member's, and ITS Modifier is
  // active. Checked against the previous entry BEFORE this play is recorded.
  const prev = C.turnState.actionsPlayed[C.turnState.actionsPlayed.length - 1];
  const pair = RESONANCE.pair;
  if (!C.resonance.used && C.resonance.charges < 2 && !C.turnState.resonanceChargedThisTurn
      && prev && prev.isModifierCard
      && pair.includes(prev.ownerId) && pair.includes(ev.card.owner)
      && prev.ownerId !== ev.card.owner && ev.modifierActive) {
    C.resonance.charges++;
    C.turnState.resonanceChargedThisTurn = true;      // at most one per turn
    fxResonanceCharge();
  }

  resolveEffects(ev.resolvedEffects);
  C.turnState.actionsPlayed.push({ cardId, ownerId: ev.card.owner,
    modifierActive: ev.modifierActive, isModifierCard: !!ev.card.mod });
  C.telemetry.plays.push({ t: C.turn, cardId, cost: ev.currentCost, mod: ev.modifierActive });
  fxPlayCard(cardId, ev);
  if (C.phase !== 'VICTORY') setPhase('PLAYER_READY');
  renderAll();
  return true;
}

function moveHero(heroId) {
  if (!C || C.phase !== 'PLAYER_READY' || C.ap < 1) return false;
  if (C.heroes[heroId].downed) return false;
  C.ap -= 1;
  const h = C.heroes[heroId];
  h.row = h.row === 'front' ? 'back' : 'front';
  if (!C.turnState.heroesMoved.includes(heroId)) C.turnState.heroesMoved.push(heroId);
  renderAll();
  return true;
}

function playResonance() {
  if (!C || C.phase !== 'PLAYER_READY') return false;
  if (C.resonance.used || C.resonance.charges < 2 || C.ap < RESONANCE.cost) return false;
  if (C.heroes.ash.downed || C.heroes.elin.downed) return false;   // both voices, or neither
  setPhase('PLAYER_ACTION_RESOLVING');
  C.ap -= RESONANCE.cost;
  C.resonance.used = true;
  dealToBoss(10, 'resonance');
  C.boss.brk = Math.max(0, C.boss.brk - 2);
  C.party.guard += 7;
  C.heroes.ash.row = 'front';
  logLine('◈ LIGHT THROUGH STEEL — Ash and Elin answer together.');
  fxResonancePlay();
  if (C.phase !== 'VICTORY') setPhase('PLAYER_READY');
  renderAll();
  return true;
}

// ═════════════════════════════════════════════════════════════════════════════
// END TURN → ENEMY PHASE → DRAW (spec §3.3). `opts.grades` lets the tests and
// the no-input accessibility path resolve the rhythm without the live notes.
// ═════════════════════════════════════════════════════════════════════════════
async function endTurn(opts) {
  if (!C || C.phase !== 'PLAYER_READY') return null;
  opts = opts || {};
  if (C.turnState.actionsPlayed.length >= 4) C.telemetry.fourCardTurns++;

  // HAND TRANSITION — played AND unplayed cards all go to the discard.
  setPhase('HAND_DISCARDING');
  await fxDiscardHand();
  while (C.hand.length) C.discard.push(C.hand.pop());

  // END-OF-PLAYER-PHASE — Bleed ticks on the boss.
  if (C.boss.bleedTurns > 0) {
    dealToBoss(C.boss.bleed, 'bleed');
    C.boss.bleedTurns--;
    if (C.boss.bleedTurns <= 0) C.boss.bleed = 0;
  }
  if (C.phase === 'VICTORY') { renderAll(); return report('victory'); }

  // ENEMY PHASE
  setPhase('ENEMY_TELEGRAPH');
  const it = currentIntent();
  let result = { intent: it.id, grades: [], taken: 0, turned: false, riposte: 0, interrupted: false };

  if (C.boss.brk <= 0) {
    // BROKEN — the action is interrupted and the gauge hardens (spec §7.2).
    result.interrupted = true;
    C.boss.breakMax += 2;
    C.boss.brk = C.boss.breakMax;
    logLine('BREAK — the ' + it.name + ' dies in the Regent’s throat.');
    await fxInterrupt();
  } else if (it.kind === 'heal') {
    C.boss.hp = Math.min(C.boss.max, C.boss.hp + it.phaseHeal);
    logLine('The Regent sings itself whole — +' + it.phaseHeal + '.');
    await fxBossHeal();
  } else {
    // A damaging intent LAUNCHES and is answered note by note.
    setPhase('ENEMY_ATTACK_LAUNCH');
    const tgtId = intentTargetId();
    result.targetId = tgtId;
    const total = intentPreviewDmg();
    const notes = it.noteSeq;
    setPhase('RHYTHM_DEFENSE');
    const grades = opts.grades ? opts.grades.slice(0, notes.length)
                               : await runRhythmUI(it, notes, tgtId);
    while (grades.length < notes.length) grades.push('miss');
    result.grades = grades;
    C.telemetry.parry.push({ t: C.turn, intent: it.id, grades: grades.slice() });

    setPhase('ENEMY_RESOLUTION');
    // packets: near-equal integers that sum to the total
    const n = notes.length;
    const base = Math.floor(total / n), extra = total - base * n;
    const packets = Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0));
    const allTurned = grades.every(g => g === 'perfect' || g === 'great');
    const allPerfect = grades.every(g => g === 'perfect');
    let incoming = 0;
    if (!allTurned) {
      grades.forEach((g, i) => {
        if (g === 'perfect' || g === 'great') return;
        incoming += (g === 'good') ? Math.ceil(packets[i] / 2) : packets[i];
      });
    }
    // Burn banked from a previous Ashen Rain adds to this resolution, then clears.
    if (incoming > 0 && C.party.burn > 0) { incoming += C.party.burn; C.party.burn = 0; }

    // Guard applies only AFTER rhythm mitigation.
    let afterGuard = incoming;
    if (C.party.guard > 0) { const g = Math.min(C.party.guard, afterGuard); C.party.guard -= g; afterGuard -= g; }
    const struck = tgtId ? C.heroes[tgtId] : null;
    if (struck && afterGuard > 0) {
      struck.hp = Math.max(0, struck.hp - afterGuard);
      if (struck.hp === 0) { struck.downed = true; logLine(HEROES23[tgtId].name + ' falls.'); }
    }
    result.taken = afterGuard;
    if (afterGuard > 0 && it.phaseBurn) C.party.burn = it.phaseBurn;   // Ashen Rain scorches what it touches

    if (allTurned) {
      result.turned = true;
      C.boss.brk = Math.max(0, C.boss.brk - 1);
      logLine('TURNED — the whole ' + it.name + ' comes apart. 1 Break.');
    }
    if (allPerfect && n > 0) {
      result.riposte = 4 * n;
      dealToBoss(result.riposte, 'riposte');
      logLine('RIPOSTE — ' + result.riposte + ' returned.');
    }
    await fxAttackResolved(result);
    if (!livingHeroes().length) { setPhase('DEFEAT'); renderAll(); return report('defeat', result); }
    if (C.phase === 'VICTORY') { renderAll(); return report('victory', result); }
  }

  // Guard expires after the Enemy Phase (spec §7.1).
  C.party.guard = 0;

  // DRAW PHASE — one at a time; reshuffle only when the pile runs dry.
  setPhase('HAND_DRAWING');
  while (C.hand.length < 5) { if (!drawOne()) break; await fxDrawOne(); }

  C.boss.intentIx++;
  C.turn++;
  C.ap = 3;
  C.turnState = { actionsPlayed: [], heroesMoved: [], resonanceChargedThisTurn: false };
  setPhase('PLAYER_READY');
  renderAll();
  return report('continue', result);
}
function drawOne() {
  if (!C.deck.length) {
    if (!C.discard.length) return false;
    C.deck = shuffle(C.discard);
    C.discard = [];
  }
  C.hand.push(C.deck.pop());
  return true;
}
function report(outcome, result) { return { outcome, ...(result || {}) }; }
function logLine(t) { C.log.push(t); const el = document.getElementById('k-log'); if (el) { el.textContent = t; el.classList.remove('k-log-in'); void el.offsetWidth; el.classList.add('k-log-in'); } }

// ═════════════════════════════════════════════════════════════════════════════
// RHYTHM DEFENSE UI — notes launch from the Regent and travel to the target
// hero; the player answers ON the character (spec §9.2). Tap anywhere, slide
// in any direction, hold-and-release. Graded against impact time.
// ═════════════════════════════════════════════════════════════════════════════
const NOTE_TRAVEL = 1100;   // ms from launch to impact
const NOTE_GAP = 620;       // ms between notes
function runRhythmUI(intent, notes, tgtId) {
  return new Promise(resolve => {
    if (!notes.length) return resolve([]);
    const stage = document.getElementById('k-stage');
    const bossEl = document.getElementById('k-boss-art');
    const heroEl = document.querySelector('.k-hero[data-hero="' + (tgtId || intent.target) + '"]') ||
                   document.querySelector('.k-hero');
    if (!stage || !bossEl || !heroEl) {
      return resolve(notes.map(() => 'miss'));      // headless / torn-down DOM: all packets land
    }
    const sr = stage.getBoundingClientRect();
    const br = bossEl.getBoundingClientRect(), hr = heroEl.getBoundingClientRect();
    const scale = sr.width / stage.offsetWidth || 1;
    const from = { x: (br.left + br.width * 0.4 - sr.left) / scale, y: (br.top + br.height * 0.35 - sr.top) / scale };
    const to   = { x: (hr.left + hr.width * 0.5 - sr.left) / scale, y: (hr.top + hr.height * 0.42 - sr.top) / scale };

    const grades = [];
    let noteIx = 0, live = null;
    let downAt = 0, downXY = null, moved = 0;

    const finishNote = (grade) => {
      grades.push(grade);
      if (live) { fxNoteGrade(live.el, grade); live = null; }
      noteIx++;
      if (noteIx >= notes.length) { cleanup(); resolve(grades); }
      else setTimeout(launch, NOTE_GAP);
    };
    const launch = () => {
      const type = notes[noteIx];
      const el = document.createElement('div');
      el.className = 'k-note k-note-' + type;
      el.innerHTML = type === 'slide' ? '<span class="k-note-arrow">➤</span>' : type === 'hold' ? '<span class="k-note-hold"></span>' : '';
      el.style.left = from.x + 'px'; el.style.top = from.y + 'px';
      stage.appendChild(el);
      const t0 = performance.now();
      const impact = t0 + NOTE_TRAVEL;
      live = { el, type, impact, judged: false, holdDown: false };
      const step = () => {
        if (!live || live.el !== el) { el.remove(); return; }
        const t = Math.min(1, (performance.now() - t0) / NOTE_TRAVEL);
        el.style.left = (from.x + (to.x - from.x) * t) + 'px';
        el.style.top = (from.y + (to.y - from.y) * t - Math.sin(t * Math.PI) * 34) + 'px';
        el.style.setProperty('--k-note-t', t.toFixed(3));
        if (t >= 1) {
          // grace after impact — a late input inside GOOD still counts
          setTimeout(() => { if (live && live.el === el && !live.judged) { live.judged = true; finishNote('miss'); } }, GOOD_MS + 40);
          return;
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    const judge = (type) => {
      if (!live || live.judged) return;
      if (type !== live.type) return;               // wrong gesture: let it ride (may still miss)
      live.judged = true;
      const off = Math.abs(performance.now() - live.impact);
      finishNote(gradeOffset(off));
    };
    const down = (e) => {
      downAt = performance.now(); moved = 0;
      downXY = { x: e.clientX, y: e.clientY };
      if (live && live.type === 'hold' && !live.judged) live.holdDown = true;
    };
    const move = (e) => { if (downXY) moved = Math.max(moved, Math.hypot(e.clientX - downXY.x, e.clientY - downXY.y)); };
    const up = () => {
      if (!live || live.judged) { downXY = null; return; }
      if (live.type === 'hold') { if (live.holdDown) judge('hold'); }
      else if (live.type === 'slide') { if (moved > 24) judge('slide'); }
      else { if (moved <= 24) judge('tap'); }
      downXY = null;
    };
    const cleanup = () => {
      stage.removeEventListener('pointerdown', down);
      stage.removeEventListener('pointermove', move);
      stage.removeEventListener('pointerup', up);
    };
    stage.addEventListener('pointerdown', down);
    stage.addEventListener('pointermove', move);
    stage.addEventListener('pointerup', up);
    launch();
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// FX + HITSTOP — coordinated beats; every fx is fail-safe when the DOM's gone.
// ═════════════════════════════════════════════════════════════════════════════
function hitstop(ms) {
  const s = document.getElementById('k-stage'); if (!s) return;
  s.classList.add('k-frozen');
  setTimeout(() => s.classList.remove('k-frozen'), ms);
}
function popupOver(el, text, cls) {
  const stage = document.getElementById('k-stage'); if (!stage || !el) return;
  const sr = stage.getBoundingClientRect(), r = el.getBoundingClientRect();
  const scale = sr.width / stage.offsetWidth || 1;
  const p = document.createElement('div');
  p.className = 'k-pop ' + (cls || '');
  p.textContent = text;
  p.style.left = ((r.left + r.width / 2 - sr.left) / scale) + 'px';
  p.style.top = ((r.top + r.height * 0.3 - sr.top) / scale) + 'px';
  stage.appendChild(p);
  setTimeout(() => p.remove(), 1000);
}
function fxDamageBoss(n, why) {
  const b = document.getElementById('k-boss-art');
  popupOver(b, '−' + fmtN(n), why === 'riposte' ? 'k-pop-gold' : 'k-pop-dmg');
  if (b) { b.classList.remove('k-recoil'); void b.offsetWidth; b.classList.add('k-recoil'); }
  hitstop(n >= 9 ? 96 : 70);
}
function fxBreak() { const el = document.getElementById('k-break'); if (el) { el.classList.remove('k-flash'); void el.offsetWidth; el.classList.add('k-flash'); } }
function fxPlayCard(cardId, ev) {
  const h = document.querySelector('.k-hero[data-hero="' + ev.card.owner + '"]');
  if (h) { h.classList.remove('k-acts'); void h.offsetWidth; h.classList.add('k-acts'); }
}
function fxResonanceCharge() { const el = document.getElementById('k-res-card'); if (el) { el.classList.remove('k-flash'); void el.offsetWidth; el.classList.add('k-flash'); } }
function fxResonancePlay() { hitstop(112); }
function fxNoteGrade(el, grade) {
  if (!el) return;
  const tag = document.createElement('div');
  tag.className = 'k-grade k-grade-' + grade;
  tag.textContent = grade === 'perfect' ? 'PERFECT' : grade === 'great' ? 'GREAT' : grade === 'good' ? 'GOOD' : 'MISS';
  el.parentElement && el.parentElement.appendChild(tag);
  tag.style.left = el.style.left; tag.style.top = el.style.top;
  setTimeout(() => tag.remove(), 700);
  if (grade === 'perfect') hitstop(94);
  el.remove();
}
const sleep = (ms) => new Promise(r => setTimeout(r, testMode() ? Math.min(ms, 24) : ms));
async function fxDiscardHand() {
  const hand = document.getElementById('k-hand'); if (!hand) return;
  hand.classList.add('k-discarding');
  await sleep(320);
  hand.classList.remove('k-discarding');
}
async function fxDrawOne() { renderHand(); await sleep(testMode() ? 8 : 130); }
async function fxInterrupt() { const b = document.getElementById('k-boss-art'); if (b) { b.classList.add('k-broken'); await sleep(700); b.classList.remove('k-broken'); } }
async function fxBossHeal() { popupOver(document.getElementById('k-boss-art'), '+heal', 'k-pop-heal'); await sleep(500); }
async function fxAttackResolved(result) {
  if (result.taken > 0) {
    const at = result.targetId && document.querySelector('.k-hero[data-hero="' + result.targetId + '"]');
    popupOver(at || document.getElementById('k-party-hud'), '−' + fmtN(result.taken), 'k-pop-dmg');
    const s = document.getElementById('k-stage'); if (s) { s.classList.remove('k-shake'); void s.offsetWidth; s.classList.add('k-shake'); }
  }
  await sleep(420);
}
function testMode() { return /[?&]test=1/.test(location.search); }

// ═════════════════════════════════════════════════════════════════════════════
// UI — the design canvas made live. One render root, small renderers per zone.
// ═════════════════════════════════════════════════════════════════════════════
let _sel = null;         // selected card id (tap-to-select → tap target commits)
let _focus = null;       // focus-mode card id (press-and-hold)

function el(id) { return document.getElementById(id); }

function renderAll() {
  if (!C || !el('k-stage')) return;
  renderPartyHud(); renderBossHud(); renderIntent(); renderHand();
  renderApDial(); renderPiles(); renderResonance(); renderHeroes(); renderOutcome();
}
function renderPartyHud() {
  for (const id of Object.keys(C.heroes)) {
    const h = C.heroes[id];
    const row = document.querySelector('.k-pt-hero[data-hero="' + id + '"]');
    if (!row) continue;
    row.classList.toggle('k-downed', !!h.downed);
    row.querySelector('.k-bar-fill').style.width = (h.hp / h.max * 100) + '%';
    row.querySelector('.k-pt-hp').innerHTML = '<b>' + fmtN(h.hp) + '</b> / ' + fmtN(h.max);
  }
  el('k-guard').textContent = fmtN(C.party.guard);
  el('k-guard-wrap').style.visibility = C.party.guard > 0 ? 'visible' : 'hidden';
  el('k-burn').style.display = C.party.burn > 0 ? '' : 'none';
}
function renderBossHud() {
  el('k-bhp').textContent = fmtN(C.boss.hp);
  el('k-bmax').textContent = fmtN(C.boss.max);
  el('k-bhp-fill').style.width = (C.boss.hp / C.boss.max * 100) + '%';
  el('k-ward').textContent = C.boss.ward > 0 ? '⛨' + fmtN(C.boss.ward) : '';
  el('k-turn-n').textContent = C.turn;
  const bondRow = document.querySelector('.k-bond-row');
  if (bondRow) {
    const ready = C.resonance.charges >= 2 && !C.resonance.used;
    bondRow.classList.toggle('k-bond-ready', ready);
    el('k-bond-n').textContent = C.resonance.used ? '—' : C.resonance.charges + '/2';
  }
  const pips = [];
  for (let i = 0; i < C.boss.breakMax; i++) pips.push('<span class="k-pip' + (i < C.boss.brk ? ' on' : '') + '"></span>');
  el('k-break').innerHTML = pips.join('');
  const aff = C.boss.affinity;
  el('k-affinity').textContent = aff === 'frost' ? '❄ FROST' : aff === 'pyre' ? '🔥 PYRE' : '';
  el('k-affinity').className = 'k-aff' + (aff ? ' k-aff-' + aff : '');
  el('k-bleed').textContent = C.boss.bleedTurns > 0 ? '🩸 ' + fmtN(C.boss.bleed) : '';
}
function renderIntent() {
  const it = currentIntent();
  el('k-int-name').textContent = it.name;
  const eff = intentTargetId();
  const tgt = it.target === 'self' ? 'Self' : eff ? HEROES23[eff].name : '—';
  el('k-int-val').textContent = it.kind === 'heal' ? ('+' + fmtN(it.phaseHeal)) : fmtN(intentPreviewDmg());
  el('k-int-tgt').textContent = '→ ' + tgt;
  el('k-int-notes').innerHTML = it.noteSeq.map(t =>
    t === 'tap' ? '<span class="k-nglyph">●</span>' : t === 'slide' ? '<span class="k-nglyph">➤</span>' : '<span class="k-nglyph k-nglyph-hold">▬</span>'
  ).join('') || '<span class="k-nglyph-none">no parry — Break it</span>';
  el('k-int-hint').textContent =
    it.id === 'scythe' ? (eff && C.heroes[eff].row === 'back' ? 'Target is Back — mostly spent' : 'Move ' + (eff ? HEROES23[eff].name : 'the target') + ' Back to blunt it')
    : it.id === 'benediction' ? 'Interrupt by Breaking the Regent'
    : it.id === 'rain' ? 'Unguarded damage Burns' : 'Parry to turn it · perfect string ripostes';
}
function renderHand() {
  const hand = el('k-hand'); if (!hand) return;
  const n = C.hand.length, mid = (n - 1) / 2;
  hand.innerHTML = C.hand.map((id, i) => {
    const ev = evaluateCard(id);
    const c = ev.card;
    const afford = C.ap >= ev.currentCost;
    const dead = C.heroes[c.owner].downed;
    // the FAN: a gentle arc, rotation from a low pivot plus a parabolic dip
    const rot = ((i - mid) * 4).toFixed(1), dy = ((i - mid) * (i - mid) * 3).toFixed(1);
    const costLine = ev.modifierActive && ev.currentCost !== c.cost
      ? ev.currentCost + ' AP <s>' + c.cost + '</s>' : ev.currentCost + ' AP';
    // the reference's face: name, cost, effect, then the ink figure filling
    // the card. A Modifier card carries its strip; an active one lights the
    // strip dark-and-gold with the RESOLVED bonus. CORE cards run clean.
    return '<button class="k-card' + (ev.modifierActive && !dead ? ' k-card-active' : '') + (afford ? '' : ' k-card-poor')
      + (dead ? ' k-card-dead' : '')
      + (_sel === id ? ' k-card-sel' : '') + '" data-card="' + id + '"'
      + ' style="--rot:' + rot + 'deg;--dy:' + dy + 'px">'
      + '<img class="k-owner" src="' + HEROES23[c.owner].art + '" alt="">'
      + '<span class="k-cname">' + c.name + (c.memory ? ' ◈' : '') + '</span>'
      + '<span class="k-ccost' + (ev.modifierActive && ev.currentCost !== c.cost ? ' on' : '') + '">' + costLine + '</span>'
      + '<span class="k-ceffect">' + effectText(c.base) + '</span>'
      + '<span class="k-cart"><img src="' + HEROES23[c.owner].art + '" alt=""></span>'
      + (c.mod ? '<span class="k-cmod' + (ev.modifierActive ? ' on' : '') + '">' + modText(c) + '</span>' : '')
      + '</button>';
  }).join('');
  hand.querySelectorAll('.k-card:not(.k-card-dead)').forEach(b => attachCardInput(b));
}
const COND_LABEL = {
  AFTER_MOVING: 'After moving', AFTER_OTHER_HERO: 'After another hero',
  SECOND_ACTION: 'Second action', TARGET_HAS_PYRE: 'Target has Pyre',
  TARGET_HAS_FROST: 'Target has Frost', TARGET_IS_BLEEDING: 'Target bleeding',
  TARGET_HP_BELOW_35: 'Target ≤35% HP',
};
// The strip's copy is BUILT from the data, never hand-authored — so its
// numbers ride the same display scale as everything else on the card.
function modText(card) {
  if (!card.mod) return '';
  const bits = [COND_LABEL[card.mod.cond] || card.mod.cond];
  if (card.mod.costOverride !== undefined) bits.push(card.mod.costOverride + ' AP');
  const fx = effectText(card.mod.bonus);
  if (fx) bits.push(fx);
  return bits.join(' · ');
}
function effectText(effects) {
  return effects.map(fx =>
    fx.dmg ? fmtN(fx.dmg) + ' damage' : fx.guard ? '+' + fmtN(fx.guard) + ' Guard' :
    fx.healParty ? 'Heal ' + fmtN(fx.healParty) : fx.strikeAgain ? 'again for ' + fmtN(fx.strikeAgain) :
    fx.bleed ? 'Bleed ' + fmtN(fx.bleed) : fx.consumeBleed ? 'consume Bleed' :
    fx.setAffinity ? 'set ' + fx.setAffinity : fx.switchRow ? 'switch row' : ''
  ).filter(Boolean).join(' · ');
}
function renderApDial() {
  el('k-ap-num').textContent = C.ap;
  const ring = el('k-ap-ring');
  if (ring) ring.setAttribute('stroke-dasharray', (175.9 * C.ap / 3).toFixed(1) + ' 175.9');
}
function renderPiles() {
  el('k-deck-n').textContent = C.deck.length;
  el('k-disc-n').textContent = C.discard.length;
}
function renderResonance() {
  const card = el('k-res-card'); if (!card) return;
  const ready = C.resonance.charges >= 2 && !C.resonance.used;
  card.className = 'k-res' + (ready ? ' k-res-ready' : '') + (C.resonance.used ? ' k-res-used' : '');
  el('k-res-pips').innerHTML =
    '<span class="k-rpip' + (C.resonance.charges >= 1 ? ' on' : '') + '"></span>' +
    '<span class="k-rpip' + (C.resonance.charges >= 2 ? ' on' : '') + '"></span>';
  el('k-res-state').textContent = C.resonance.used ? 'spent' : ready ? 'READY · 1 AP' : '1 AP · once';
}
function renderHeroes() {
  document.querySelectorAll('.k-hero').forEach(h => {
    const id = h.dataset.hero;
    h.classList.toggle('k-back', C.heroes[id].row === 'back');
    h.querySelector('.k-hero-row').textContent = C.heroes[id].row.toUpperCase();
  });
}
function renderOutcome() {
  const ov = el('k-overlay');
  if (!ov) return;
  if (C.phase === 'VICTORY') { ov.className = 'k-ov'; ov.innerHTML = '<div class="k-ov-title">THE REGENT FALLS</div><div class="k-ov-sub">turn ' + C.turn + '</div>'; }
  else if (C.phase === 'DEFEAT') { ov.className = 'k-ov'; ov.innerHTML = '<div class="k-ov-title k-ov-loss">THE PARTY FALLS</div><div class="k-ov-sub">turn ' + C.turn + '</div>'; }
  else ov.className = 'k-ov k-hidden';
}

// ── input: tap-select → tap target; press-and-hold → Character Focus ──
function stageScale() {
  const st = el('k-stage');
  return (st.getBoundingClientRect().width / st.offsetWidth) || 1;
}
// What lies under a released card: the Regent, or the party's side (a hero
// figure or the roster). Enemy cards want the Regent; party cards want ours.
function dropTargetAt(x, y) {
  const inside = (r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  if (inside(el('k-boss-art').getBoundingClientRect())) return 'enemy';
  if (inside(el('k-party-hud').getBoundingClientRect())) return 'party';
  for (const h of document.querySelectorAll('.k-hero')) if (inside(h.getBoundingClientRect())) return 'party';
  return null;
}
function attachCardInput(btn) {
  // `armed` gates everything on a REAL press. Without it a bare hover's
  // pointermove measured its delta from (0,0), decided it was a drag, and
  // flung the card 375px off the hand before the button ever went down.
  let holdT = null, held = false, dragging = false, armed = false, sx = 0, sy = 0;
  btn.addEventListener('pointerdown', (e) => {
    held = false; dragging = false; armed = true; sx = e.clientX; sy = e.clientY;
    holdT = setTimeout(() => { held = true; openFocus(btn.dataset.card); }, 480);
    try { btn.setPointerCapture(e.pointerId); } catch (_) {}
  });
  btn.addEventListener('pointermove', (e) => {
    if (!armed || held) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (!dragging && Math.hypot(dx, dy) > 14) { clearTimeout(holdT); dragging = true; btn.classList.add('k-dragging'); }
    if (dragging) {
      const k = stageScale();
      btn.style.setProperty('--dragx', (dx / k) + 'px');
      btn.style.setProperty('--dragy', (dy / k) + 'px');
      const over = dropTargetAt(e.clientX, e.clientY);
      const want = CARD_DEFS[btn.dataset.card].target === 'enemy' ? 'enemy' : 'party';
      btn.classList.toggle('k-drop-ok', over === want);
    }
  });
  btn.addEventListener('pointerup', (e) => {
    clearTimeout(holdT);
    if (!armed) return;
    armed = false;
    if (held) return;
    const id = btn.dataset.card;
    if (dragging) {
      btn.classList.remove('k-dragging', 'k-drop-ok');
      btn.style.removeProperty('--dragx'); btn.style.removeProperty('--dragy');
      const over = dropTargetAt(e.clientX, e.clientY);
      const want = CARD_DEFS[id].target === 'enemy' ? 'enemy' : 'party';
      if (over === want) { _sel = null; el('k-target-ring').classList.add('k-hidden'); playCard(id); }
      else renderHand();
      return;
    }
    if (_sel === id) { commitCard(id); }
    else { _sel = id; renderHand(); showTargetRing(id); }
  });
  btn.addEventListener('pointercancel', () => { clearTimeout(holdT); armed = false; dragging = false;
    btn.classList.remove('k-dragging', 'k-drop-ok');
    btn.style.removeProperty('--dragx'); btn.style.removeProperty('--dragy'); });
}
function showTargetRing(cardId) {
  const c = CARD_DEFS[cardId];
  const ring = el('k-target-ring'); if (!ring) return;
  const at = c.target === 'enemy' ? el('k-boss-art') : el('k-party-hud');
  if (!at) return;
  const stage = el('k-stage');
  const sr = stage.getBoundingClientRect(), r = at.getBoundingClientRect();
  const scale = sr.width / stage.offsetWidth || 1;
  ring.style.left = ((r.left + r.width / 2 - sr.left) / scale) + 'px';
  ring.style.top = ((r.top + r.height / 2 - sr.top) / scale) + 'px';
  ring.classList.remove('k-hidden');
  ring.onclick = () => commitCard(cardId);
}
function commitCard(cardId) {
  _sel = null;
  el('k-target-ring').classList.add('k-hidden');
  playCard(cardId);
}
function openFocus(cardId) {
  _focus = cardId;
  const ev = evaluateCard(cardId);
  const c = ev.card, hero = HEROES23[c.owner];
  const f = el('k-focus');
  f.innerHTML =
    '<div class="k-focus-hero">' + hero.name + ' <span>' + hero.cls + ' · ' + C.heroes[c.owner].row + ' row</span></div>'
    + '<div class="k-focus-name">' + c.name + (c.memory ? ' ◈' : '') + '<span class="k-focus-cost">' + ev.currentCost
      + (ev.modifierActive && ev.currentCost !== c.cost ? ' <s>' + c.cost + '</s>' : '') + ' AP</span></div>'
    + '<div class="k-focus-base">Base · ' + effectText(c.base) + '</div>'
    + (c.mod ? '<div class="k-focus-mod' + (ev.modifierActive ? ' on' : '') + '">' + modText(c)
      + ' — ' + (ev.modifierActive ? 'ACTIVE' : 'not yet') + '</div>' : '<div class="k-focus-mod">CORE</div>')
    + '<div class="k-focus-now">Resolves now · ' + effectText(ev.resolvedEffects) + '</div>'
    + '<button class="k-focus-commit" id="k-focus-commit">COMMIT</button>'
    + '<button class="k-focus-close" id="k-focus-close">✕</button>';
  f.classList.remove('k-hidden');
  document.querySelectorAll('.k-hero').forEach(h => h.classList.toggle('k-dim', h.dataset.hero !== c.owner));
  document.querySelector('.k-hero[data-hero="' + c.owner + '"]').classList.add('k-fwd');
  el('k-focus-commit').onclick = () => { closeFocus(); playCard(cardId); };
  el('k-focus-close').onclick = closeFocus;
}
function closeFocus() {
  _focus = null;
  el('k-focus').classList.add('k-hidden');
  document.querySelectorAll('.k-hero').forEach(h => { h.classList.remove('k-dim', 'k-fwd'); });
}

function bindChrome() {
  el('k-endturn').onclick = () => { _sel = null; el('k-target-ring').classList.add('k-hidden'); endTurn(); };
  el('k-res-card').onclick = () => playResonance();
  // MOVE IS DRAG. Pull a hero sideways past the threshold and release —
  // rows are a toggle, so either direction reads as "step to the other row".
  document.querySelectorAll('.k-hero').forEach(h => {
    let sx = 0, live = false;
    h.addEventListener('pointerdown', (e) => {
      if (!C || C.phase !== 'PLAYER_READY') return;
      sx = e.clientX; live = true;
      try { h.setPointerCapture(e.pointerId); } catch (_) {}
    });
    h.addEventListener('pointermove', (e) => {
      if (!live) return;
      const dx = (e.clientX - sx) / stageScale();
      h.classList.add('k-hero-drag');
      h.style.setProperty('--hdx', Math.max(-70, Math.min(70, dx)) + 'px');
    });
    const up = (e) => {
      if (!live) return;
      live = false;
      const dx = (e.clientX - sx) / stageScale();
      h.classList.remove('k-hero-drag');
      h.style.removeProperty('--hdx');
      if (Math.abs(dx) > 44) moveHero(h.dataset.hero);
    };
    h.addEventListener('pointerup', up);
    h.addEventListener('pointercancel', up);
  });
  el('k-stage').addEventListener('pointerdown', (e) => {
    if (_sel && !e.target.closest('.k-card') && !e.target.closest('#k-target-ring')) {
      _sel = null; el('k-target-ring').classList.add('k-hidden'); renderHand();
    }
  });
}

// ── boot + test hooks ──
window.addEventListener('DOMContentLoaded', () => {
  bindChrome();
  const seed = testMode() ? 7 : undefined;
  startCombat({ seed });
  window.__ready = true;
});
window.K = {
  state: () => C,
  evaluateCard, playCard, moveHero, playResonance,
  endTurn: (opts) => endTurn(opts),
  startCombat, setSeed,
  // test-only surgical hooks — deterministic setup, never used by the UI
  forceHand(ids) {
    const all = [...C.hand, ...C.deck, ...C.discard];
    C.hand = ids.slice();
    C.deck = all.filter(id => !ids.includes(id));
    C.discard = [];
    renderAll();
  },
  forceIntent(id) {
    const ix = REGENT_INTENTS.findIndex(i => i.id === id);
    if (ix >= 0) { C.boss.intentIx = ix; renderAll(); }
  },
  gradeOffset, currentIntent, intentPreviewDmg, intentTargetId,
};
