// ============================================================================
// KIZUNA v2.3 — RESONANCE core mechanics pass (docs/RESONANCE-DECK.md).
//
// This file is the whole slice: card data, the ONE evaluator, the combat
// state machine, the Mourning Regent, rhythm-note parry windows, and the
// mobile-landscape UI skinned to the painted reference.
//
// The load-bearing rules:
//  · Sequencing is FOLLOW-UP (previous card by a different hero) and FINALE
//    (all three heroes have played this phase). No Flow meter, no action
//    trail — only the immediately previous hero matters.
//  · A conditional card gets a cost reduction OR increased output — never
//    both. Costs never fall below 1. evaluateCard() is the single source of
//    truth for hand, focus, affordability and resolution.
//  · Parry prevents damage, it never creates offense: a clean string reduces
//    the hit 70%, or consumes 2 Guard to negate it and deal 1 Break. No
//    riposte, no AP refund.
//  · Guard is PER HERO and expires at the start of the next player phase.
//    Bleed ticks at enemy-phase start. Chill blunts the next hit. Break 12;
//    at zero the next enemy action dies and the Regent is BROKEN (+25%
//    damage taken until the player phase ends, then the meter refills).
//  · Unplayed cards remain (hand cap 7); draw to 5 each phase; one free
//    cycle per phase. Two Bond stitches generate LIGHT THROUGH STEEL
//    directly into hand; it Exhausts.
//  · One state-transition owner: setPhase() is the only door between phases.
// ============================================================================

'use strict';

const V23_BUILD = 5;   // MUST match version.json's "v2.3" — bump BOTH every build.

// PRESENTATION SCALE: the engine runs the deck's normalized values; the
// SCREEN multiplies every HP and damage number by one uniform factor so the
// game reads like the concept's big JRPG numbers. Set to 1 to read raw.
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
// THE PARTY AND THE 15-CARD DECK (deck §3, §7) — test-encounter values.
// ═════════════════════════════════════════════════════════════════════════════
const HEROES23 = {
  ash:  { name: 'ASH',  cls: 'Vanguard', art: '../art/kai.webp',  row0: 'front', maxHp: 42 },
  elin: { name: 'ELIN', cls: 'Oracle',   art: '../art/elin.webp', row0: 'back',  maxHp: 36 },
  mira: { name: 'MIRA', cls: 'Shade',    art: '../art/mira.webp', row0: 'front', maxHp: 34 },
};

// Effects are tiny data atoms; resolveEffects() is the only interpreter.
// Each `dmg` atom is its own strike (Twin Fang's hits stay hits). Conditions
// grant reward:'cost' (costTo) OR reward:'output' (bonus atoms) — never both.
const CARD_DEFS = {
  // ── Ash — Vanguard ──
  cleave:      { owner: 'ash', name: 'Cleave',        cost: 1, target: 'enemy', base: [{ dmg: 6 }], cond: null },
  guardcut:    { owner: 'ash', name: 'Guarding Cut',  cost: 1, target: 'enemy', base: [{ dmg: 4 }, { guardSelf: 4 }], cond: null },
  cstance:     { owner: 'ash', name: 'Counterstance', cost: 1, target: 'party', base: [{ guardSelf: 7 }, { counterstance: true }], cond: null },
  crosssever:  { owner: 'ash', name: 'Cross Sever',   cost: 2, target: 'enemy', base: [{ dmg: 9 }, { brk: 2 }],
                 cond: { type: 'FOLLOW_UP', reward: 'cost', costTo: 1 } },
  lastlight:   { owner: 'ash', name: 'Last Light',    cost: 2, target: 'enemy', base: [{ dmg: 10 }],
                 cond: { type: 'FINALE', reward: 'output', bonus: [{ dmg: 5 }] } },
  // ── Elin — Oracle ──
  lcascade:    { owner: 'elin', name: 'Lumen Cascade', cost: 1, target: 'enemy', base: [{ dmg: 4 }, { guardLowest: 5 }], cond: null },
  mend:        { owner: 'elin', name: 'Mend',          cost: 1, target: 'party', base: [{ heal: 6 }], cond: null },
  frostbind:   { owner: 'elin', name: 'Frost Bind',    cost: 1, target: 'enemy', base: [{ dmg: 4 }, { chill: 4 }], cond: null },
  sgrace:      { owner: 'elin', name: 'Shared Grace',  cost: 2, target: 'party', base: [{ guardAll: 3 }],
                 cond: { type: 'FOLLOW_UP', reward: 'cost', costTo: 1 } },
  intercession:{ owner: 'elin', name: 'Intercession',  cost: 1, target: 'ally',  base: [{ guardSelf: 3 }, { guardAlly: 3 }, { intercede: true }], cond: null },
  // ── Mira — Shade ──
  serrate:     { owner: 'mira', name: 'Serrate',       cost: 1, target: 'enemy', base: [{ dmg: 3 }, { bleed: 3 }], cond: null },
  qthrow:      { owner: 'mira', name: 'Quick Throw',   cost: 1, target: 'enemy', base: [{ dmg: 4 }, { drawDiscard: true }], cond: null },
  twinfang:    { owner: 'mira', name: 'Twin Fang',     cost: 1, target: 'enemy', base: [{ dmg: 3 }, { dmg: 3 }],
                 cond: { type: 'FOLLOW_UP', reward: 'output', bonus: [{ dmg: 3 }] } },
  backstab:    { owner: 'mira', name: 'Backstab',      cost: 1, target: 'enemy', base: [{ moveSelf: true }, { dmg: 5 }],
                 cond: { type: 'BROKEN', reward: 'output', bonus: [{ dmg: 4 }] } },
  execute:     { owner: 'mira', name: 'Execute',       cost: 2, target: 'enemy', base: [{ dmg: 9 }],
                 cond: { type: 'BROKEN_OR_LOW', reward: 'output', bonus: [{ dmg: 6 }] } },
  // ── the generated Resonance card (deck §8) — never in the 15-card deck ──
  lightsteel:  { owner: 'bond', name: 'Light Through Steel', cost: 1, target: 'enemy',
                 base: [{ dmg: 10 }, { guardAll: 4 }], cond: null, exhaust: true },
};
const DECK_IDS = Object.keys(CARD_DEFS).filter(id => CARD_DEFS[id].owner !== 'bond');   // the 15
const RES_ID = 'lightsteel';
const RESONANCE_PAIR = ['ash', 'elin'];

// ═════════════════════════════════════════════════════════════════════════════
// THE MOURNING REGENT — re-tuned to the 42/36/34 vs 120 test encounter.
// Values are [phase-1, phase-2]; the Regent hardens at half health.
// ═════════════════════════════════════════════════════════════════════════════
// An enemy ACTION is a BARRAGE of hits. Each hit carries its own target and
// its own rhythm string, and each hit gets one parry window — which is what
// makes "each hero may fully negate one hit per enemy action" (deck §5) a
// real limit: a hero can spend Guard to erase one hit of the volley, and must
// answer the rest on timing alone. Values are [phase-1, phase-2].
// TUNE — the Regent's pressure knobs, swept by test/balance.sim.cjs against
// the deck's survival bands. dmgScale multiplies every hit; dirge is the
// unparryable chip described below.
// Tuned against the deck's survival bands by test/balance.sim.cjs — the
// sweep and its finding are recorded in docs/RESONANCE-DECK.md. dmgScale is
// left at 1.0: the swept scale is baked into the authored hit values below so
// the data reads as the real numbers.
const TUNE = { dmgScale: 1.0, dirge: [3, 4], heal: [7, 9], parryKeep: 0.3 };

const REGENT_INTENTS = [
  { id: 'hymn', name: 'Ruinous Hymn', kind: 'attack',
    hits: [
      { dmg: [5, 6], target: 'ash',  notes: ['tap', 'tap'] },
      { dmg: [5, 6], target: 'ash',  notes: ['tap', 'slide'] },
      { dmg: [5, 6], target: 'elin', notes: ['tap', 'tap', 'hold'] },
    ] },
  { id: 'scythe', name: 'Scything Advance', kind: 'attack', frontOnly: true,
    hits: [
      { dmg: [7, 9], target: 'mira', notes: ['tap', 'slide'], backFactor: 0.35 },
      { dmg: [7, 9], target: 'ash',  notes: ['slide', 'tap', 'hold'], backFactor: 0.35 },
    ] },
  { id: 'benediction', name: 'Hollow Benediction', kind: 'heal',
    hits: [
      { dmg: [4, 6], target: 'elin', notes: ['tap', 'tap'] },
    ] },
  { id: 'rain', name: 'Ashen Rain', kind: 'attack',
    hits: [
      { dmg: [5, 7], target: 'ash',  notes: ['tap', 'tap'] },
      { dmg: [5, 7], target: 'elin', notes: ['tap', 'slide'] },
      { dmg: [5, 7], target: 'mira', notes: ['tap', 'tap'] },
    ] },
];

// ── rhythm grade windows — the v2.2 parry windows, unchanged
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
  'ENEMY_TELEGRAPH', 'ENEMY_ATTACK_LAUNCH', 'RHYTHM_DEFENSE',
  'ENEMY_RESOLUTION', 'HAND_DRAWING', 'VICTORY', 'DEFEAT'];
function setPhase(p) {
  if (!PHASES.includes(p)) throw new Error('unknown phase ' + p);
  if (!C || C.phase === 'VICTORY' || C.phase === 'DEFEAT') return;   // terminal states hold
  C.phase = p;
}

function freshTurnState() {
  return { actionsPlayed: [], moved: 0, cycled: false, stitchedPairs: [] };
}

function startCombat(opts) {
  if (opts && opts.seed != null) setSeed(opts.seed);
  C = {
    phase: 'INTRO',
    turn: 1,
    heroes: {
      ash:  { row: HEROES23.ash.row0,  hp: HEROES23.ash.maxHp,  max: HEROES23.ash.maxHp,  guard: 0, downed: false },
      elin: { row: HEROES23.elin.row0, hp: HEROES23.elin.maxHp, max: HEROES23.elin.maxHp, guard: 0, downed: false },
      mira: { row: HEROES23.mira.row0, hp: HEROES23.mira.maxHp, max: HEROES23.mira.maxHp, guard: 0, downed: false },
    },
    boss: {
      name: 'The Mourning Regent', hp: 120, max: 120, phase: 1,
      breakMax: 12, brk: 12, broken: false, cancelNext: false,
      bleed: 0, chill: 0, intentIx: 0,
    },
    deck: shuffle(DECK_IDS), hand: [], discard: [], exhausted: [],
    ap: 3,
    turnState: freshTurnState(),
    bond: { stitches: 0, generated: false },   // the authored Ash+Elin pair
    counterstance: false,       // Ash: next successful parry this round deals +2 Break
    intercession: null,         // Elin will take this ally's parry window next enemy action
    pendingDiscard: false,      // Quick Throw: draw 1, THEN discard 1
    telemetry: { plays: [], parry: [] },
    log: [],
  };
  drawOpening();
  setPhase('PLAYER_READY');
  renderAll();
  return C;
}

// Opening hand: 5 cards with AT LEAST ONE per hero (deck §3). Draw five, then
// repair coverage deterministically — swap a surplus card for the first card
// of each missing hero still in the deck.
function drawOpening() {
  for (let i = 0; i < 5; i++) drawOne();
  for (const heroId of Object.keys(HEROES23)) {
    if (C.hand.some(id => CARD_DEFS[id].owner === heroId)) continue;
    const inDeck = C.deck.findIndex(id => CARD_DEFS[id].owner === heroId);
    if (inDeck < 0) continue;
    const counts = {};
    C.hand.forEach(id => { const o = CARD_DEFS[id].owner; counts[o] = (counts[o] || 0) + 1; });
    const surplus = C.hand.findIndex(id => counts[CARD_DEFS[id].owner] > 1);
    if (surplus < 0) continue;
    const give = C.hand[surplus];
    C.hand[surplus] = C.deck[inDeck];
    C.deck[inDeck] = give;
  }
}

function currentIntent() {
  const it = REGENT_INTENTS[C.boss.intentIx % REGENT_INTENTS.length];
  const p = C.boss.phase - 1;
  return { ...it, phaseHeal: it.kind === 'heal' ? TUNE.heal[p] : 0 };
}
function livingHeroes() { return Object.keys(C.heroes).filter(id => !C.heroes[id].downed); }
// A hit falls on its scripted hero while they stand, otherwise on the first
// hero still on their feet.
function hitTargetId(hit) {
  if (C.heroes[hit.target] && !C.heroes[hit.target].downed) return hit.target;
  return livingHeroes()[0] || null;
}
// One hit's damage RIGHT NOW: phase value, row shelter, then Chill. Chill is
// spent by the first hit of the action, so only that hit previews the relief.
function hitDamage(hit, chillLeft) {
  const raw = Math.round(hit.dmg[C.boss.phase - 1] * TUNE.dmgScale);
  const tgt = hitTargetId(hit);
  let d = raw;
  if (hit.backFactor != null && tgt && C.heroes[tgt].row === 'back') d = Math.ceil(raw * hit.backFactor);
  return Math.max(0, d - (chillLeft || 0));
}
// The dirge: unparryable chip on every living hero, each enemy phase.
function dirgeAmount() { return TUNE.dirge[C.boss.phase - 1] || 0; }

// The primary target — who the banner names, and who the camera watches.
function intentTargetId() {
  const it = REGENT_INTENTS[C.boss.intentIx % REGENT_INTENTS.length];
  if (!it.hits || !it.hits.length) return null;
  return hitTargetId(it.hits[0]);
}
// What the telegraph promises: the whole volley, previewed live so moving a
// hero Back or landing a Chill re-reads the number before the player commits.
function intentPreviewDmg() {
  const it = currentIntent();
  if (!it.hits) return 0;
  let chill = C.boss.chill, total = 0;
  for (const h of it.hits) { total += hitDamage(h, chill); chill = 0; }
  return total;
}

// ═════════════════════════════════════════════════════════════════════════════
// THE EVALUATOR — deterministic, and the ONLY copy of this logic.
// ═════════════════════════════════════════════════════════════════════════════
function evalCondition(cond, ownerId) {
  const ts = C.turnState, last = ts.actionsPlayed[ts.actionsPlayed.length - 1];
  switch (cond) {
    case 'FOLLOW_UP':     return !!last && last.ownerId !== ownerId;
    case 'FINALE':        return ['ash', 'elin', 'mira'].every(h => ts.actionsPlayed.some(a => a.ownerId === h));
    case 'BROKEN':        return C.boss.broken;
    case 'BROKEN_OR_LOW': return C.boss.broken || C.boss.hp <= C.boss.max * 0.30;
    default: return false;
  }
}
function evaluateCard(cardId) {
  const card = CARD_DEFS[cardId];
  if (!card) return null;
  const condActive = card.cond ? evalCondition(card.cond.type, card.owner) : false;
  // A conditional card gets a cost reduction OR increased output — never
  // both. Costs never fall below 1 (deck §3).
  const currentCost = Math.max(1,
    (condActive && card.cond.reward === 'cost') ? card.cond.costTo : card.cost);
  const resolvedEffects = (condActive && card.cond.reward === 'output')
    ? [...card.base, ...card.cond.bonus] : card.base.slice();
  return { cardId, card, condActive, currentCost, resolvedEffects };
}

// ═════════════════════════════════════════════════════════════════════════════
// RESOLUTION
// ═════════════════════════════════════════════════════════════════════════════
function dealToBoss(n, why) {
  if (C.boss.broken) n = Math.round(n * 1.25);   // BROKEN: +25% damage taken
  C.boss.hp = Math.max(0, C.boss.hp - n);
  fxDamageBoss(n, why);
  checkBossPhase();
  if (C.boss.hp <= 0) setPhase('VICTORY');
}
function checkBossPhase() {
  if (C.boss.phase === 1 && C.boss.hp <= C.boss.max / 2 && C.boss.hp > 0) {
    C.boss.phase = 2;
    logLine('The Regent rises — the dirge sharpens.');
  }
}
// The only door into Broken: any Break damage from any source lands here.
function breakDamage(n) {
  if (n <= 0) return;
  C.boss.brk = Math.max(0, C.boss.brk - n);
  fxBreak();
  if (C.boss.brk === 0 && !C.boss.broken) {
    C.boss.broken = true;
    C.boss.cancelNext = true;
    logLine('BROKEN — the Regent staggers. The next attack dies unsung.');
  }
}
function guardHero(heroId, n) {
  const h = C.heroes[heroId];
  if (h && !h.downed) h.guard += n;
}
// ownerId: who played the card. allyId: chosen ally for 'ally'-target cards.
function resolveEffects(effects, ownerId, allyId) {
  for (const fx of effects) {
    if (fx.dmg)        dealToBoss(fx.dmg, 'hit');
    if (fx.brk)        breakDamage(fx.brk);
    if (fx.guardSelf)  guardHero(ownerId, fx.guardSelf);
    if (fx.guardAlly && allyId) guardHero(allyId, fx.guardAlly);
    if (fx.guardAll)   livingHeroes().forEach(id => guardHero(id, fx.guardAll));
    if (fx.guardLowest){ const low = livingHeroes().sort((a, b) => C.heroes[a].hp - C.heroes[b].hp)[0];
                         if (low) guardHero(low, fx.guardLowest); }
    if (fx.heal)       { const m = livingHeroes().sort((a, b) =>
        (C.heroes[b].max - C.heroes[b].hp) - (C.heroes[a].max - C.heroes[a].hp))[0];
      if (m) C.heroes[m].hp = Math.min(C.heroes[m].max, C.heroes[m].hp + fx.heal); }
    if (fx.bleed)      C.boss.bleed += fx.bleed;
    if (fx.chill)      C.boss.chill += fx.chill;
    if (fx.counterstance) C.counterstance = true;
    if (fx.intercede && allyId) C.intercession = allyId;
    if (fx.moveSelf)   { const h = C.heroes[ownerId]; h.row = h.row === 'front' ? 'back' : 'front'; }
    if (fx.drawDiscard){ if (drawOne()) C.pendingDiscard = true; }
    if (C.phase === 'VICTORY') return;
  }
}

function defaultAlly(ownerId) {
  const others = livingHeroes().filter(id => id !== ownerId);
  return others.sort((a, b) => C.heroes[a].hp - C.heroes[b].hp)[0] || null;
}

function playCard(cardId, allyId) {
  if (!C || C.phase !== 'PLAYER_READY' || C.pendingDiscard) return false;
  if (!C.hand.includes(cardId)) return false;
  const ev = evaluateCard(cardId);                    // cost updates BEFORE affordability
  const owner = ev.card.owner;
  if (owner === 'bond') {
    // both voices, or neither
    if (C.heroes.ash.downed || C.heroes.elin.downed) return false;
  } else if (C.heroes[owner].downed) return false;    // the fallen play nothing
  if (C.ap < ev.currentCost) return false;
  if (ev.card.target === 'ally' && !allyId) allyId = defaultAlly(owner);
  setPhase('PLAYER_ACTION_RESOLVING');
  C.ap -= ev.currentCost;
  C.hand.splice(C.hand.indexOf(cardId), 1);
  (ev.card.exhaust ? C.exhausted : C.discard).push(cardId);   // Resonance Exhausts

  // BOND STITCH (deck §8): playing right after a DIFFERENT hero is a
  // Follow-Up, and stitches that pair — max 1 per pair per phase. Two
  // stitches generate the pair's Resonance card directly into hand, once
  // per encounter (the card Exhausts; the climax is authored, not cyclic).
  const prev = C.turnState.actionsPlayed[C.turnState.actionsPlayed.length - 1];
  if (prev && prev.ownerId !== owner && owner !== 'bond' && prev.ownerId !== 'bond') {
    const pairKey = [prev.ownerId, owner].sort().join('|');
    if (pairKey === RESONANCE_PAIR.slice().sort().join('|')
        && !C.turnState.stitchedPairs.includes(pairKey)
        && !C.bond.generated) {
      C.turnState.stitchedPairs.push(pairKey);
      C.bond.stitches++;
      fxResonanceCharge();
      if (C.bond.stitches >= 2 && C.hand.length < 7) {
        C.bond.generated = true;
        C.hand.push(RES_ID);
        logLine('◈ RESONANCE — Light Through Steel takes shape in the hand.');
      }
    }
  }

  resolveEffects(ev.resolvedEffects, owner, allyId);
  C.turnState.actionsPlayed.push({ cardId, ownerId: owner, condActive: ev.condActive });
  C.telemetry.plays.push({ t: C.turn, cardId, cost: ev.currentCost, cond: ev.condActive });
  fxPlayCard(cardId, ev);
  if (C.phase !== 'VICTORY') setPhase('PLAYER_READY');
  renderAll();
  return true;
}

// Quick Throw's second half: the player chooses which card to let go.
function pickDiscard(cardId) {
  if (!C || !C.pendingDiscard || !C.hand.includes(cardId)) return false;
  C.hand.splice(C.hand.indexOf(cardId), 1);
  C.discard.push(cardId);
  C.pendingDiscard = false;
  renderAll();
  return true;
}

// The free cycle (deck §3): once per phase, discard 1 → draw 1. No AP.
function cycleCard(cardId) {
  if (!C || C.phase !== 'PLAYER_READY' || C.pendingDiscard) return false;
  if (C.turnState.cycled || !C.hand.includes(cardId)) return false;
  C.turnState.cycled = true;
  C.hand.splice(C.hand.indexOf(cardId), 1);
  C.discard.push(cardId);
  drawOne();
  logLine('Cycled ' + CARD_DEFS[cardId].name + '.');
  renderAll();
  return true;
}

function moveHero(heroId) {
  if (!C || C.phase !== 'PLAYER_READY' || C.pendingDiscard) return false;
  if (C.turnState.moved >= 1) return false;           // Move once per phase
  if (C.ap < 1 || C.heroes[heroId].downed) return false;
  C.ap -= 1;
  C.turnState.moved++;
  const h = C.heroes[heroId];
  h.row = h.row === 'front' ? 'back' : 'front';
  renderAll();
  return true;
}

// ═════════════════════════════════════════════════════════════════════════════
// END TURN → ENEMY PHASE → NEXT PLAYER PHASE. `opts.grades` lets the tests
// and the no-input accessibility path resolve the rhythm without live notes.
// ═════════════════════════════════════════════════════════════════════════════
async function endTurn(opts) {
  if (!C || C.phase !== 'PLAYER_READY' || C.pendingDiscard) return null;
  opts = opts || {};

  // END OF PLAYER PHASE — Broken expires here: the meter refills. (The
  // pending cancel still consumes the next enemy action.)
  if (C.boss.broken) {
    C.boss.broken = false;
    C.boss.brk = C.boss.breakMax;
  }

  // ENEMY PHASE — Bleed triggers first, then decays (deck §6).
  setPhase('ENEMY_TELEGRAPH');
  if (C.boss.bleed > 0) {
    dealToBoss(C.boss.bleed, 'bleed');
    C.boss.bleed = Math.max(0, C.boss.bleed - 1);
  }
  if (C.phase === 'VICTORY') { renderAll(); return report('victory'); }

  const it = currentIntent();
  let result = { intent: it.id, grades: [], hits: [], taken: 0, negated: 0, canceled: false };

  if (C.boss.cancelNext) {
    // BROKEN's cancel — the whole action dies unsung.
    C.boss.cancelNext = false;
    result.canceled = true;
    logLine('The ' + it.name + ' dies in the Regent’s throat.');
    await fxInterrupt();
  } else {
    if (it.kind === 'heal') {
      C.boss.hp = Math.min(C.boss.max, C.boss.hp + it.phaseHeal);
      logLine('The Regent sings itself whole — +' + it.phaseHeal + '.');
      await fxBossHeal();
    }
    // THE BARRAGE — every hit is launched and answered on its own string.
    setPhase('ENEMY_ATTACK_LAUNCH');
    result.targetId = intentTargetId();
    const negatedThisAction = {};      // one full negate per hero per ACTION
    // Tests and the no-input path may pass a flat grade list; it is consumed
    // hit by hit, in order.
    let flat = opts.grades ? opts.grades.slice() : null;

    for (const hit of it.hits) {
      if (!livingHeroes().length) break;
      const tgtId = hitTargetId(hit);
      if (!tgtId) break;
      let dmg = hitDamage(hit, C.boss.chill);
      if (C.boss.chill > 0) C.boss.chill = 0;      // Chill is spent by the first hit

      // INTERCESSION: Elin steps into the window aimed at her chosen ally.
      const parrierId = (C.intercession && C.intercession === tgtId && !C.heroes.elin.downed)
        ? 'elin' : tgtId;

      setPhase('RHYTHM_DEFENSE');
      let grades;
      if (flat) { grades = flat.splice(0, hit.notes.length); }
      else grades = await runRhythmHit(hit, tgtId, parrierId);
      while (grades.length < hit.notes.length) grades.push('miss');
      result.grades.push(...grades);

      setPhase('ENEMY_RESOLUTION');
      // Parry outcomes (deck §5): any miss fails the string; a clean string
      // succeeds. A success negates outright only if the parrier can pay 2
      // Guard AND has not already negated a hit this action.
      const success = hit.notes.length > 0 && grades.every(g => g !== 'miss');
      const parrier = C.heroes[parrierId];
      let negated = false;
      if (success && parrier && !parrier.downed) {
        if (parrier.guard >= 2 && !negatedThisAction[parrierId]) {
          parrier.guard -= 2;
          negatedThisAction[parrierId] = true;
          negated = true;
          dmg = 0;
          result.negated++;
          breakDamage(1 + (C.counterstance ? 2 : 0));
          C.counterstance = false;
          logLine('NEGATED — ' + HEROES23[parrierId].name + ' turns the blow aside. 1 Break.');
        } else {
          dmg = Math.ceil(dmg * TUNE.parryKeep);    // a clean string blunts the hit
          if (C.counterstance) { breakDamage(2); C.counterstance = false; }
        }
      }
      // Guard absorbs first, on the hero actually struck; then flesh.
      const struck = C.heroes[tgtId];
      if (dmg > 0) {
        if (struck.guard > 0) { const g = Math.min(struck.guard, dmg); struck.guard -= g; dmg -= g; }
        if (dmg > 0) {
          struck.hp = Math.max(0, struck.hp - dmg);
          if (struck.hp === 0) { struck.downed = true; struck.guard = 0; logLine(HEROES23[tgtId].name + ' falls.'); }
        }
      }
      result.hits.push({ targetId: tgtId, parrierId, success, negated, taken: dmg });
      result.taken += dmg;
      await fxHitResolved(tgtId, dmg, negated);
      if (!livingHeroes().length) { setPhase('DEFEAT'); renderAll(); return report('defeat', result); }
    }
  }
  // THE DIRGE — after the blows, the hymn itself settles on the whole party,
  // and no timing answers it: only Guard and healing do. It resolves LAST so
  // that Guard is still standing when the volley's parry windows ask for it —
  // a hero who banked 2 Guard can always spend it to negate.
  const dirge = dirgeAmount();
  if (dirge > 0 && !result.canceled) {
    for (const id of livingHeroes()) {
      const h = C.heroes[id];
      let d = dirge;
      if (h.guard > 0) { const g = Math.min(h.guard, d); h.guard -= g; d -= g; }
      if (d > 0) {
        h.hp = Math.max(0, h.hp - d);
        if (h.hp === 0) { h.downed = true; h.guard = 0; logLine(HEROES23[id].name + ' falls to the dirge.'); }
      }
    }
    await fxDirge(dirge);
    if (!livingHeroes().length) { setPhase('DEFEAT'); renderAll(); return report('defeat', result); }
  }

  C.intercession = null;                        // one enemy action, then it lapses

  // NEXT PLAYER PHASE — Guard expires now (deck §6); the stance lapses;
  // unplayed cards remain; draw to 5 (hand cap 7 only matters to generation).
  livingHeroes().forEach(id => { C.heroes[id].guard = 0; });
  C.counterstance = false;
  setPhase('HAND_DRAWING');
  while (C.hand.length < 5) { if (!drawOne()) break; await fxDrawOne(); }

  C.boss.intentIx++;
  C.turn++;
  C.ap = 3;
  C.turnState = freshTurnState();
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
// hero; the player answers ON the character. Tap anywhere, slide in any
// direction, hold-and-release. Graded against impact time.
// ═════════════════════════════════════════════════════════════════════════════
const NOTE_TRAVEL = 1100;   // ms from launch to impact
const NOTE_GAP = 620;       // ms between notes
function runRhythmHit(hit, tgtId, parrierId) {
  const notes = hit.notes;
  return new Promise(resolve => {
    if (!notes.length) return resolve([]);
    const stage = document.getElementById('k-stage');
    const bossEl = document.getElementById('k-boss-art');
    const heroEl = document.querySelector('.k-hero[data-hero="' + (parrierId || tgtId) + '"]') ||
                   document.querySelector('.k-hero');
    if (!stage || !bossEl || !heroEl) {
      return resolve(notes.map(() => 'miss'));      // headless / torn-down DOM: the hit lands
    }
    const sr = stage.getBoundingClientRect();
    const br = bossEl.getBoundingClientRect(), hr = heroEl.getBoundingClientRect();
    const scale = sr.width / stage.offsetWidth || 1;
    const from = { x: (br.left + br.width * 0.4 - sr.left) / scale, y: (br.top + br.height * 0.35 - sr.top) / scale };
    const to   = { x: (hr.left + hr.width * 0.5 - sr.left) / scale, y: (hr.top + hr.height * 0.42 - sr.top) / scale };
    // the hero answering this hit lights up, so the eye knows where to look
    document.querySelectorAll('.k-hero').forEach(h => h.classList.toggle('k-parrying', h.dataset.hero === (parrierId || tgtId)));

    const grades = [];
    let noteIx = 0, live = null;
    let downXY = null, moved = 0;

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
      moved = 0;
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
      document.querySelectorAll('.k-hero').forEach(h => h.classList.remove('k-parrying'));
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
  popupOver(b, '−' + fmtN(n), why === 'bleed' ? 'k-pop-bleed' : 'k-pop-dmg');
  if (b) { b.classList.remove('k-recoil'); void b.offsetWidth; b.classList.add('k-recoil'); }
  hitstop(n >= 9 ? 96 : 70);
}
function fxBreak() { const el = document.getElementById('k-break'); if (el) { el.classList.remove('k-flash'); void el.offsetWidth; el.classList.add('k-flash'); } }
function fxPlayCard(cardId, ev) {
  const heroId = ev.card.owner === 'bond' ? 'ash' : ev.card.owner;
  const h = document.querySelector('.k-hero[data-hero="' + heroId + '"]');
  if (h) { h.classList.remove('k-acts'); void h.offsetWidth; h.classList.add('k-acts'); }
}
function fxResonanceCharge() { const el = document.querySelector('.k-bond-row'); if (el) { el.classList.remove('k-flash'); void el.offsetWidth; el.classList.add('k-flash'); } }
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
// __SIM: the balance simulator runs thousands of fights; every beat is skipped.
const sleep = (ms) => new Promise(r => setTimeout(r, (typeof window !== 'undefined' && window.__SIM) ? 0 : (testMode() ? Math.min(ms, 24) : ms)));
async function fxDrawOne() { renderHand(); await sleep(testMode() ? 8 : 130); }
async function fxDirge(n) {
  for (const id of livingHeroes()) {
    popupOver(document.querySelector('.k-hero[data-hero="' + id + '"]'), '−' + fmtN(n), 'k-pop-dirge');
  }
  const s = document.getElementById('k-stage');
  if (s) { s.classList.remove('k-dirge'); void s.offsetWidth; s.classList.add('k-dirge');
    setTimeout(() => s.classList.remove('k-dirge'), 700); }
  await sleep(320);
}
async function fxInterrupt() { const b = document.getElementById('k-boss-art'); if (b) { b.classList.add('k-broken'); await sleep(700); b.classList.remove('k-broken'); } }
async function fxBossHeal() { popupOver(document.getElementById('k-boss-art'), '+heal', 'k-pop-heal'); await sleep(500); }
async function fxHitResolved(tgtId, taken, negated) {
  const at = tgtId && document.querySelector('.k-hero[data-hero="' + tgtId + '"]');
  if (taken > 0) {
    popupOver(at || document.getElementById('k-party-hud'), '−' + fmtN(taken), 'k-pop-dmg');
    const s = document.getElementById('k-stage'); if (s) { s.classList.remove('k-shake'); void s.offsetWidth; s.classList.add('k-shake'); }
  } else if (negated) {
    popupOver(at, 'NEGATED', 'k-pop-gold');
    hitstop(90);
  } else {
    popupOver(at, 'PARRIED', 'k-pop-gold');
  }
  await sleep(330);
}
function testMode() { return /[?&]test=1/.test(location.search); }

// ═════════════════════════════════════════════════════════════════════════════
// UI — the reference skin made live. One render root, small renderers per zone.
// ═════════════════════════════════════════════════════════════════════════════
let _sel = null;         // selected card id (tap-to-select → tap target commits)
let _focus = null;       // focus-mode card id (press-and-hold)

function el(id) { return document.getElementById(id); }

function renderAll() {
  if (!C || !el('k-stage')) return;
  renderPartyHud(); renderBossHud(); renderIntent(); renderHand();
  renderApDial(); renderPiles(); renderHeroes(); renderOutcome();
}
function renderPartyHud() {
  for (const id of Object.keys(C.heroes)) {
    const h = C.heroes[id];
    const row = document.querySelector('.k-pt-hero[data-hero="' + id + '"]');
    if (!row) continue;
    row.classList.toggle('k-downed', !!h.downed);
    row.querySelector('.k-bar-fill').style.width = (h.hp / h.max * 100) + '%';
    row.querySelector('.k-pt-hp').innerHTML = '<b>' + fmtN(h.hp) + '</b> / ' + fmtN(h.max)
      + (h.guard > 0 ? ' <span class="k-pt-guard">⛨' + fmtN(h.guard) + '</span>' : '');
  }
  const inter = el('k-intercede');
  if (inter) inter.textContent = C.intercession
    ? '⚔ Elin shields ' + HEROES23[C.intercession].name : '';
}
function renderBossHud() {
  el('k-bhp').textContent = fmtN(C.boss.hp);
  el('k-bmax').textContent = fmtN(C.boss.max);
  el('k-bhp-fill').style.width = (C.boss.hp / C.boss.max * 100) + '%';
  el('k-bflag').textContent = (C.boss.broken || C.boss.cancelNext) ? 'BROKEN' : '';
  el('k-turn-n').textContent = C.turn;
  const bondRow = document.querySelector('.k-bond-row');
  if (bondRow) {
    bondRow.classList.toggle('k-bond-ready', C.bond.stitches >= 2);
    el('k-bond-n').textContent = C.bond.generated ? '◈' : C.bond.stitches + '/2';
  }
  const pips = [];
  for (let i = 0; i < C.boss.breakMax; i++) pips.push('<span class="k-pip' + (i < C.boss.brk ? ' on' : '') + '"></span>');
  el('k-break').innerHTML = pips.join('');
  el('k-chill').textContent = C.boss.chill > 0 ? '❄ ' + fmtN(C.boss.chill) : '';
  el('k-bleed').textContent = C.boss.bleed > 0 ? '🩸 ' + fmtN(C.boss.bleed) : '';
}
function renderIntent() {
  const it = currentIntent();
  el('k-int-name').textContent = it.name;
  const eff = intentTargetId();
  el('k-int-val').textContent = it.kind === 'heal'
    ? ('+' + fmtN(it.phaseHeal) + ' · ' + fmtN(intentPreviewDmg()))
    : fmtN(intentPreviewDmg());
  const hits = it.hits || [];
  el('k-int-tgt').textContent = hits.length > 1 ? '× ' + hits.length + ' hits' : (eff ? '→ ' + HEROES23[eff].name : '');
  // one glyph group per hit, labelled with who answers it and for how much
  let chill = C.boss.chill;
  el('k-int-notes').innerHTML = hits.map(h => {
    const d = hitDamage(h, chill); chill = 0;
    const t = hitTargetId(h);
    const glyphs = h.notes.map(n =>
      n === 'tap' ? '<span class="k-nglyph">●</span>' : n === 'slide' ? '<span class="k-nglyph">➤</span>'
      : '<span class="k-nglyph k-nglyph-hold">▬</span>').join('');
    return '<span class="k-hitgrp"><b>' + (t ? HEROES23[t].name : '—') + '</b>'
      + glyphs + '<i>' + fmtN(d) + '</i></span>';
  }).join('') || '<span class="k-nglyph-none">no parry — Break it</span>';
  el('k-int-hint').textContent =
    C.boss.cancelNext ? 'BROKEN — this action dies unsung'
    : it.id === 'scythe' ? 'Front row only — a hero in Back is nearly spared'
    : it.id === 'benediction' ? 'It heals itself — Break it to stop the hymn'
    : 'Clean string blunts a hit · 2 Guard negates one per hero';
  const dg = el('k-int-dirge');
  if (dg) dg.textContent = dirgeAmount() > 0 ? 'DIRGE ' + fmtN(dirgeAmount()) + ' to all · unparryable' : '';
}
function renderHand() {
  const hand = el('k-hand'); if (!hand) return;
  const n = C.hand.length, mid = (n - 1) / 2;
  hand.classList.toggle('k-pick-discard', !!C.pendingDiscard);
  hand.innerHTML = C.hand.map((id, i) => {
    const ev = evaluateCard(id);
    const c = ev.card;
    const afford = C.ap >= ev.currentCost;
    const dead = c.owner === 'bond' ? (C.heroes.ash.downed || C.heroes.elin.downed) : C.heroes[c.owner].downed;
    const ownerArt = c.owner === 'bond' ? HEROES23.ash.art : HEROES23[c.owner].art;
    // the FAN: a gentle arc, rotation from a low pivot plus a parabolic dip
    const rot = ((i - mid) * 4).toFixed(1), dy = ((i - mid) * (i - mid) * 3).toFixed(1);
    const costLine = ev.condActive && ev.currentCost !== c.cost
      ? ev.currentCost + ' AP <s>' + c.cost + '</s>' : ev.currentCost + ' AP';
    return '<button class="k-card' + (ev.condActive && !dead ? ' k-card-active' : '') + (afford ? '' : ' k-card-poor')
      + (dead ? ' k-card-dead' : '') + (c.owner === 'bond' ? ' k-card-res' : '')
      + (_sel === id ? ' k-card-sel' : '') + '" data-card="' + id + '"'
      + ' style="--rot:' + rot + 'deg;--dy:' + dy + 'px">'
      + '<img class="k-owner" src="' + ownerArt + '" alt="">'
      + '<span class="k-cname">' + c.name + (c.exhaust ? ' ◈' : '') + '</span>'
      + '<span class="k-ccost' + (ev.condActive && ev.currentCost !== c.cost ? ' on' : '') + '">' + costLine + '</span>'
      + '<span class="k-ceffect">' + effectText(c.base) + '</span>'
      + '<span class="k-cart"><img src="' + ownerArt + '" alt=""></span>'
      + (c.cond ? '<span class="k-cmod' + (ev.condActive ? ' on' : '') + '">' + condText(c) + '</span>'
         : c.exhaust ? '<span class="k-cmod on">Ash + Elin · Exhausts</span>' : '')
      + '</button>';
  }).join('');
  hand.querySelectorAll('.k-card:not(.k-card-dead)').forEach(b => attachCardInput(b));
}
const COND_LABEL = {
  FOLLOW_UP: 'Follow-Up', FINALE: 'Finale',
  BROKEN: 'If Broken', BROKEN_OR_LOW: 'Broken or ≤30% HP',
};
// The strip's copy is BUILT from the data, never hand-authored — so its
// numbers ride the same display scale as everything else on the card.
function condText(card) {
  if (!card.cond) return '';
  const bits = [COND_LABEL[card.cond.type] || card.cond.type];
  if (card.cond.reward === 'cost') bits.push('costs ' + card.cond.costTo + ' AP');
  else bits.push(effectText(card.cond.bonus));
  return bits.join(' · ');
}
function effectText(effects) {
  const hits = effects.filter(fx => fx.dmg);
  const parts = [];
  if (hits.length === 1) parts.push(fmtN(hits[0].dmg) + ' damage');
  else if (hits.length > 1) parts.push(hits.length + '× ' + fmtN(hits[0].dmg) + ' damage');
  for (const fx of effects) {
    if (fx.brk)        parts.push(fx.brk + ' Break');
    if (fx.guardSelf)  parts.push('+' + fmtN(fx.guardSelf) + ' Guard');
    if (fx.guardAlly)  parts.push('ally +' + fmtN(fx.guardAlly) + ' Guard');
    if (fx.guardAll)   parts.push('all +' + fmtN(fx.guardAll) + ' Guard');
    if (fx.guardLowest)parts.push('lowest ally +' + fmtN(fx.guardLowest) + ' Guard');
    if (fx.heal)       parts.push('Heal ' + fmtN(fx.heal));
    if (fx.bleed)      parts.push('Bleed ' + fmtN(fx.bleed));
    if (fx.chill)      parts.push('Chill ' + fmtN(fx.chill));
    if (fx.counterstance) parts.push('next parry +2 Break');
    if (fx.intercede)  parts.push('shield their window');
    if (fx.moveSelf)   parts.push('switch row');
    if (fx.drawDiscard)parts.push('draw 1, discard 1');
  }
  return parts.join(' · ');
}
function renderApDial() {
  el('k-ap-num').textContent = C.ap;
}
function renderPiles() {
  el('k-deck-n').textContent = C.deck.length;
  el('k-disc-n').textContent = C.discard.length;
  const cy = el('k-cycle-n');
  if (cy) cy.textContent = C.turnState.cycled ? '0' : '1';
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

// ── input: tap-select → tap target; drag to target; hold → Character Focus ──
function stageScale() {
  const st = el('k-stage');
  return (st.getBoundingClientRect().width / st.offsetWidth) || 1;
}
// What lies under a released card: the Regent, a specific hero, the roster,
// or the piles corner (the free cycle's drop zone).
function dropTargetAt(x, y) {
  const inside = (r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  const piles = el('k-piles');
  if (piles) { const r = piles.getBoundingClientRect();
    if (inside({ left: r.left - 20, right: r.right + 20, top: r.top - 20, bottom: r.bottom + 20 })) return { zone: 'piles' }; }
  if (inside(el('k-boss-art').getBoundingClientRect())) return { zone: 'enemy' };
  for (const h of document.querySelectorAll('.k-hero')) if (inside(h.getBoundingClientRect())) return { zone: 'party', hero: h.dataset.hero };
  for (const row of document.querySelectorAll('.k-pt-hero')) if (inside(row.getBoundingClientRect())) return { zone: 'party', hero: row.dataset.hero };
  if (inside(el('k-party-hud').getBoundingClientRect())) return { zone: 'party' };
  return null;
}
function dropCommit(id, drop) {
  if (!drop) return false;
  if (drop.zone === 'piles') return cycleCard(id);
  const want = CARD_DEFS[id].target === 'enemy' ? 'enemy' : 'party';
  if (drop.zone !== want) return false;
  return playCard(id, drop.hero && drop.hero !== CARD_DEFS[id].owner ? drop.hero : undefined);
}
function attachCardInput(btn) {
  // `armed` gates everything on a REAL press. Without it a bare hover's
  // pointermove measured its delta from (0,0), decided it was a drag, and
  // flung the card 375px off the hand before the button ever went down.
  let holdT = null, held = false, dragging = false, armed = false, sx = 0, sy = 0;
  btn.addEventListener('pointerdown', (e) => {
    held = false; dragging = false; armed = true; sx = e.clientX; sy = e.clientY;
    holdT = setTimeout(() => { if (!C.pendingDiscard) { held = true; openFocus(btn.dataset.card); } }, 480);
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
      btn.classList.toggle('k-drop-ok', !!over && (over.zone === want || over.zone === 'piles'));
    }
  });
  btn.addEventListener('pointerup', (e) => {
    clearTimeout(holdT);
    if (!armed) return;
    armed = false;
    if (held) return;
    const id = btn.dataset.card;
    if (C.pendingDiscard) { pickDiscard(id); return; }   // Quick Throw's second half
    if (dragging) {
      btn.classList.remove('k-dragging', 'k-drop-ok');
      btn.style.removeProperty('--dragx'); btn.style.removeProperty('--dragy');
      const over = dropTargetAt(e.clientX, e.clientY);
      if (!dropCommit(id, over)) renderHand();
      else { _sel = null; el('k-target-ring').classList.add('k-hidden'); }
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
  const c = ev.card;
  const hero = c.owner === 'bond' ? { name: 'ASH + ELIN', cls: 'Resonance' } : HEROES23[c.owner];
  const rowTxt = c.owner === 'bond' ? 'Bond Art' : HEROES23[c.owner].cls + ' · ' + C.heroes[c.owner].row + ' row';
  const f = el('k-focus');
  f.innerHTML =
    '<div class="k-focus-hero">' + hero.name + ' <span>' + rowTxt + '</span></div>'
    + '<div class="k-focus-name">' + c.name + (c.exhaust ? ' ◈' : '') + '<span class="k-focus-cost">' + ev.currentCost
      + (ev.condActive && ev.currentCost !== c.cost ? ' <s>' + c.cost + '</s>' : '') + ' AP</span></div>'
    + '<div class="k-focus-base">Base · ' + effectText(c.base) + '</div>'
    + (c.cond ? '<div class="k-focus-mod' + (ev.condActive ? ' on' : '') + '">' + condText(c)
      + ' — ' + (ev.condActive ? 'ACTIVE' : 'not yet') + '</div>'
      : '<div class="k-focus-mod">' + (c.exhaust ? 'EXHAUSTS' : 'CORE') + '</div>')
    + '<div class="k-focus-now">Resolves now · ' + effectText(ev.resolvedEffects) + '</div>'
    + '<button class="k-focus-commit" id="k-focus-commit">COMMIT</button>'
    + '<button class="k-focus-close" id="k-focus-close">✕</button>';
  f.classList.remove('k-hidden');
  const dimFor = c.owner === 'bond' ? 'ash' : c.owner;
  document.querySelectorAll('.k-hero').forEach(h => h.classList.toggle('k-dim', h.dataset.hero !== dimFor));
  const fwd = document.querySelector('.k-hero[data-hero="' + dimFor + '"]');
  if (fwd) fwd.classList.add('k-fwd');
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
  evaluateCard, playCard, moveHero, cycleCard, pickDiscard,
  endTurn: (opts) => endTurn(opts),
  startCombat, setSeed,
  render: () => renderAll(),
  // test-only surgical hooks — deterministic setup, never used by the UI
  forceHand(ids) {
    const all = [...C.hand, ...C.deck, ...C.discard].filter(id => id !== RES_ID);
    C.hand = ids.slice();
    C.deck = all.filter(id => !ids.includes(id));
    C.discard = [];
    renderAll();
  },
  forceIntent(id) {
    const ix = REGENT_INTENTS.findIndex(i => i.id === id);
    if (ix >= 0) { C.boss.intentIx = ix; renderAll(); }
  },
  gradeOffset, currentIntent, intentPreviewDmg, intentTargetId, dirgeAmount,
  tune(t) { Object.assign(TUNE, t || {}); return TUNE; },
};
