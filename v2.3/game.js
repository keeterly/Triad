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

const V23_BUILD = 23;   // MUST match version.json's "v2.3" — bump BOTH every build.

// PRESENTATION SCALE: 1 means the screen shows the engine's own numbers —
// Slay-the-Spire scale, where a hero has 42 HP and a Cleave hits for 6. Big
// JRPG numbers were tried and read as noise on a phone: four-digit damage on a
// 108px card leaves no room for the words that say what the card DOES.
const DISPLAY_SCALE = 1;
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
  mira: { name: 'MIRA', cls: 'Shade',    art: '../art/mira.webp', row0: 'mid',   maxHp: 34 },
};

// Effects are tiny data atoms; resolveEffects() is the only interpreter.
// Each `dmg` atom is its own strike (Twin Fang's hits stay hits). Conditions
// grant reward:'cost' (costTo) OR reward:'output' (bonus atoms) — never both.
const CARD_DEFS = {
  // ── Ash — Vanguard ──
  // NOTHING MAY BE A DEAD DRAW. Slay the Spire can afford a deliberately weak
  // Strike because you REMOVE it; a fixed 15-card deck cannot, so the vanilla
  // attack gets a reason to exist — and it pays for the risk of leaving Ash
  // where the sweeps land hardest.
  cleave:      { owner: 'ash', name: 'Cleave',        cost: 1, target: 'enemy', base: [{ dmg: 5 }],
                 cond: { type: 'FRONT_ROW', reward: 'output', bonus: [{ dmg: 4 }] } },
  guardcut:    { owner: 'ash', name: 'Guarding Cut',  cost: 1, target: 'enemy', base: [{ dmg: 4 }, { guardSelf: 4 }], cond: null },
  // A chain that can extend itself is what makes a combo deck play. Counterstance
  // was 0.15 plays a fight: Guard competes with a parry that negates outright,
  // so it had to be worth playing for something other than the Guard.
  cstance:     { owner: 'ash', name: 'Counterstance', cost: 1, target: 'party', base: [{ guardSelf: 5 }, { counterstance: true }],
                 cond: { type: 'FOLLOW_UP', reward: 'output', bonus: [{ draw: 1 }] } },
  crosssever:  { owner: 'ash', name: 'Cross Sever',   cost: 2, target: 'enemy', base: [{ dmg: 9 }, { brk: 2 }],
                 cond: { type: 'FOLLOW_UP', reward: 'cost', costTo: 1 } },
  // Priced so the whole line fits in one turn: Elin (1) + Mira (1) + this (1).
  // At 2 AP the finisher could never BE the third card, which is the only
  // place a finale can happen.
  // The cold floor has to be LOW or the card sabotages itself: at 7 raw for
  // 1 AP the best greedy play was to lead with it, which is the one thing that
  // guarantees the finale never happens. 5 cold is mediocre, 15 armed is
  // enormous, and the gap is the reason to hold it for third.
  lastlight:   { owner: 'ash', name: 'Last Light',    cost: 1, target: 'enemy', base: [{ dmg: 5 }],
                 cond: { type: 'FINALE', reward: 'output', bonus: [{ dmg: 10 }, { brk: 2 }] } },
  // ── Elin — Oracle ──
  lcascade:    { owner: 'elin', name: 'Lumen Cascade', cost: 1, target: 'enemy', base: [{ dmg: 4 }, { guardLowest: 5 }], cond: null },
  // THE SECOND FINALE, so the trio is a fork and not a script: close the round
  // with Ash and it is a killing blow, close it with Elin and the party stands
  // back up. One turn, one finisher, two very different turns.
  mend:        { owner: 'elin', name: 'Mend',          cost: 1, target: 'party', base: [{ heal: 6 }],
                 cond: { type: 'FINALE', reward: 'output', bonus: [{ healAll: 5 }] } },
  frostbind:   { owner: 'elin', name: 'Frost Bind',    cost: 1, target: 'enemy', base: [{ dmg: 4 }, { chill: 4 }], cond: null },
  // 2 AP for 3 Guard to a party that would rather parry was the worst rate in
  // the deck. At 1 AP with Break on the chain it becomes the SETUP card: the
  // thing you play mid-combo to arm next turn's BROKEN payoffs.
  sgrace:      { owner: 'elin', name: 'Shared Grace',  cost: 1, target: 'party', base: [{ guardAll: 3 }],
                 cond: { type: 'FOLLOW_UP', reward: 'output', bonus: [{ brk: 2 }] } },
  intercession:{ owner: 'elin', name: 'Intercession',  cost: 1, target: 'ally',  base: [{ guardSelf: 3 }, { guardAlly: 3 }, { intercede: true }], cond: null },
  // ── Mira — Shade ──
  serrate:     { owner: 'mira', name: 'Serrate',       cost: 1, target: 'enemy', base: [{ dmg: 3 }, { bleed: 3 }], cond: null },
  // The deck's only filter: what you play to FIND the hero missing from the
  // round you are building. Nudged to 5 so it is never strictly worse than the
  // vanilla strike while doing that job.
  qthrow:      { owner: 'mira', name: 'Quick Throw',   cost: 1, target: 'enemy', base: [{ dmg: 5 }, { drawDiscard: true }], cond: null },
  twinfang:    { owner: 'mira', name: 'Twin Fang',     cost: 1, target: 'enemy', base: [{ dmg: 3 }, { dmg: 3 }],
                 cond: { type: 'FOLLOW_UP', reward: 'output', bonus: [{ dmg: 3 }] } },
  // Backstab already steps Mira across the rows; now the row she steps OUT of
  // is the condition. "If Broken" fired 7% of the time and was a coin; this is
  // a two-beat plan the player sets up themselves.
  backstab:    { owner: 'mira', name: 'Backstab',      cost: 1, target: 'enemy', base: [{ moveSelf: 'front' }, { dmg: 5 }],
                 cond: { type: 'BACK_ROW', reward: 'output', bonus: [{ dmg: 5 }] } },
  // An execute should be dead weight until the target is finishable and then
  // decisive. At 2 AP it was neither: too expensive to hold in a 3 AP turn, and
  // 9 raw was a worse rate than two ordinary cards. 0.08 plays a fight.
  execute:     { owner: 'mira', name: 'Execute',       cost: 1, target: 'enemy', base: [{ dmg: 6 }],
                 cond: { type: 'BROKEN_OR_LOW', reward: 'output', bonus: [{ dmg: 8 }] } },
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
// bossHp joined the knobs in Build 17: once the combo layer actually fired the
// party gained a real damage engine, and the encounter had to be re-scaled to
// it rather than the deck being walked back to fit the old encounter.
// Swept in Build 17 against the mid band alone (SIM_BAND=HALF, the only tier
// that moved — the outer two are pinned at 0% and 100% by the parry's
// all-or-nothing turn). 120 HP left a half-parrying party winning 76% once the
// combo layer started firing, and 150 put that back at 35%. Build 20's KIZUNA
// all-out is worth about six more points of winrate on its own — a bot that
// never spends the ladder measures a party that never takes its best turn — so
// 160 restored 35%. Build 23 gave Cleave a live condition — a fixed deck cannot
// afford a dead card — which is worth another six points on its own, so 168
// lands at 34% in nine rounds, inside the deck's own 25-40% band, with dmgScale
// still at 1.0 so the authored hit numbers stay the real numbers.
//
// A note for whoever sweeps this next: seed-block variance is large. The same
// 140 HP config reads 39% over the first 100 seeds and 51.8% over 220. Do not
// trust a sweep at n<200 for a shipping number — rank candidates cheaply, then
// measure the winner at the full run count.
const TUNE = { dmgScale: 1.0, dirge: [4, 4], heal: [7, 9], parryKeep: 0.3, bossHp: 168,
  alloutDmg: 26, alloutBrk: 4 };

const REGENT_INTENTS = [
  // Each intent has its own HANDWRITING. The Hymn is a dirge you brace
  // through; the Advance is two sweeping arcs; the Benediction dares you to
  // interrupt it; the Rain is a flurry you have to out-mash.
  // Each intent keeps its own RHYTHM as well as its own gestures. `beats` places
  // a note inside the hit's bar, so a string can hesitate or double instead of
  // marching — a metronome is a thing you solve once, not a thing you play.
  { id: 'hymn', name: 'Ruinous Hymn', kind: 'attack',
    hits: [
      // a steady toll, then a caught breath, then the long note
      { dmg: [9, 12], target: 'ash',  notes: ['tap', 'tap'] },
      { dmg: [9, 12], target: 'ash',  notes: ['feint', 'tap'], beats: [0, 1.5] },
      { dmg: [9, 12], target: 'elin', notes: ['tap', 'hold'] },
    ] },
  { id: 'scythe', name: 'Scything Advance', kind: 'attack', frontOnly: true,
    hits: [
      // sweep and jab, on the half-beat: one motion, not two decisions
      { dmg: [13, 17], target: 'mira', notes: ['slide:R', 'tap'], beats: [0, 0.5], sweep: true },
      { dmg: [13, 17], target: 'ash',  notes: ['slide:L', 'hold', 'tap'], beats: [0, 1, 2.5], sweep: true },
    ] },
  { id: 'benediction', name: 'Hollow Benediction', kind: 'heal',
    hits: [
      { dmg: [8, 12], target: 'elin', notes: ['bait', 'tap'] },
    ] },
  { id: 'rain', name: 'Ashen Rain', kind: 'attack', sub: [1, 0.75],
    hits: [
      { dmg: [9, 13], target: 'ash',  notes: ['burst'] },
      { dmg: [9, 13], target: 'elin', notes: ['burst'] },
      { dmg: [9, 13], target: 'mira', notes: ['tap', 'slide:D'], beats: [0, 0.5] },
    ] },
];


// ═════════════════════════════════════════════════════════════════════════════
// THE PARRY — restored from v2.2, whole.
// ═════════════════════════════════════════════════════════════════════════════
// The impact instant is the CENTRE of the window, not its end: a late catch is
// a catch. The bands are wide because the GRADES are made to mean different
// things, not made unreachable.
//
//   perfect  ±95ms   touch latency (56-78ms measured) plus human jitter
//   great    ±170ms  the modal outcome — it must feel good, not like a near-miss
//   good     ±260ms  genuinely sloppy, and still worth something
//   late     +200ms  past good: a labelled miss, so a miss always says why
// Way early returns null — the note stays live and keeps listening, which is
// the forgiving behaviour a rhythm read needs.
// Playtested (test/parry.playtest.cjs): at ±80/140/220 a practised hand that
// read every arrow correctly still only cleaned 83-100% per kind, and a hand
// that misread ONE arrow lost the whole hit. The windows were never the wall
// — the reading burden was — so they widen a notch and the read gets help.
const PARRY_PERF_MS = 95, PARRY_GREAT_MS = 170, PARRY_GOOD_MS = 260, PARRY_LATE_MS = 200;
function parryGrade(off) {
  const a = Math.abs(off);
  if (off < -PARRY_GOOD_MS) return null;      // way early: WAIT… — the note holds
  if (a <= PARRY_PERF_MS) return 'perfect';
  if (a <= PARRY_GREAT_MS) return 'great';
  if (a <= PARRY_GOOD_MS) return 'good';
  return 'late';
}
// WEIGHTED, not counted. A note is not caught-or-not: a perfect turns its whole
// share, a great turns most of it, a late-but-read one turns half. Counting
// notes equally is what made "all caught" and "all perfect" the same outcome.
const PARRY_WEIGHT = { perfect: 1, great: 0.9, good: 0.6, late: 0, miss: 0 };
// One grade down. A gesture that was ON THE BEAT but read the note wrong is a
// timing success and a reading failure; paying it nothing made a misread arrow
// cost the same as no hand on the screen at all.
const DEMOTE = { perfect: 'great', great: 'good', good: 'good', late: 'late', miss: 'miss' };
// Two tiers above PARTIAL, and they are different prizes:
//   TURNED    every note GREAT or better -> the blow is negated entirely, and
//             the Regent's poise chips for it. Mastery a good human reaches.
//   FLAWLESS  every note PERFECT         -> TURNED, plus the riposte. The
//             summit, still rare.
const RIPOSTE_PER_NOTE = 2;
function readString(grades, notes) {
  let weight = 0, perfects = 0, greats = 0;
  for (const g of grades) {
    weight += PARRY_WEIGHT[g] || 0;
    if (g === 'perfect') perfects++;
    if (g === 'perfect' || g === 'great') greats++;
  }
  const turned = notes > 0 && greats === notes;
  const flawless = notes > 0 && perfects === notes;
  return { mit: turned ? 1 : (notes ? weight / notes : 0), turned, flawless, kept: greats, notes };
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
  const was = C.phase;
  C.phase = p;
  // THE HOME POSITION IS A COMPOSITION, never identity. On the player's turn
  // the lens hangs toward the party; on the Regent's it swings to feature her.
  if (p === 'PLAYER_READY') camPose(CAM_POSE_PLAYER);
  else if (p === 'ENEMY_TELEGRAPH') camPose(CAM_POSE_ENEMY);
}

function freshTurnState() {
  return { actionsPlayed: [], moved: 0, cycled: false, stitchedPairs: [] };
}

function startCombat(opts) {
  if (opts && opts.seed != null) setSeed(opts.seed);
  _camPoseCur = null;                     // a fresh fight re-composes the shot
  C = {
    phase: 'INTRO',
    turn: 1,
    heroes: {
      ash:  { row: HEROES23.ash.row0,  hp: HEROES23.ash.maxHp,  max: HEROES23.ash.maxHp,  guard: 0, downed: false },
      elin: { row: HEROES23.elin.row0, hp: HEROES23.elin.maxHp, max: HEROES23.elin.maxHp, guard: 0, downed: false },
      mira: { row: HEROES23.mira.row0, hp: HEROES23.mira.maxHp, max: HEROES23.mira.maxHp, guard: 0, downed: false },
    },
    boss: {
      name: 'The Mourning Regent', hp: TUNE.bossHp, max: TUNE.bossHp, phase: 1,
      breakMax: 12, brk: 12, broken: false, cancelNext: false,
      bleed: 0, chill: 0, intentIx: 0, _healedRecently: false,
    },
    kizuna: 0, allOuts: 0,
    deck: shuffle(DECK_IDS), hand: [], discard: [], exhausted: [],
    ap: AP_PER_TURN, apMax: AP_PER_TURN,
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
  // …and she does not always open the same way either
  C.boss.intentIx = pickIntent();
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

// THE REGENT IS NOT A ROTATION. She played hymn, scythe, benediction, rain,
// hymn, scythe… in that order, every fight — so the encounter was memorised
// after one playthrough and every turn after the first was a lookup rather
// than a read. Slay the Spire's enemies pick by weighted rules with anti-repeat
// constraints, which is why the same monster stays interesting; this does the
// same, off the fight's own seeded RNG so a seed still replays exactly.
function pickIntent() {
  const cur = C.boss.intentIx;
  const hurt = C.boss.hp / C.boss.max;
  const pool = [];
  REGENT_INTENTS.forEach((it, i) => {
    if (i === cur) return;                       // never the same thing twice running
    let w = 10;
    // she only sings herself whole when there is something to mend, and never
    // twice in quick succession — a heal on a full boss is a wasted turn for
    // both sides
    if (it.kind === 'heal') w = hurt > 0.75 ? 0 : (C.boss._healedRecently ? 2 : 14);
    // the sweeping advance and the flurry lean later, when the party is spread
    if (it.id === 'scythe') w = hurt < 0.6 ? 16 : 9;
    if (it.id === 'rain') w = C.boss.phase === 2 ? 16 : 9;
    pool.push({ i, w });
  });
  const total = pool.reduce((n, p) => n + p.w, 0);
  if (total <= 0) return (cur + 1) % REGENT_INTENTS.length;
  let r = rng() * total;
  for (const p of pool) { r -= p.w; if (r <= 0) {
    C.boss._healedRecently = REGENT_INTENTS[p.i].kind === 'heal';
    return p.i; } }
  return pool[pool.length - 1].i;
}
function currentIntent() {
  const it = REGENT_INTENTS[C.boss.intentIx % REGENT_INTENTS.length];
  const p = C.boss.phase - 1;
  const sub = it.sub ? it.sub[p] : 1;
  return { ...it, phaseHeal: it.kind === 'heal' ? TUNE.heal[p] : 0, sub };
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
  // A sweep loses its edge with distance: full weight at the front, most of it
  // blunted at the back. `sweep` replaces the old backFactor on/off shelter.
  if (hit.sweep && tgt) d = Math.ceil(raw * (ROW_SHELTER[C.heroes[tgt].row] != null
    ? ROW_SHELTER[C.heroes[tgt].row] : 1));
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
    // A FINALE is the LAST BLOW of the round, not something you pay for after
    // it. Requiring all three heroes to have ALREADY acted made the card
    // unreachable: the trio costs the whole turn, so nothing was left to
    // finish with, and the probe measured it firing 0 times in 466 turns.
    // The card that completes the trio IS the finale.
    case 'FINALE': {
      const seen = new Set(ts.actionsPlayed.map(a => a.ownerId));
      seen.add(ownerId);
      return ['ash', 'elin', 'mira'].every(h => seen.has(h));
    }
    case 'BROKEN':        return C.boss.broken;
    case 'BROKEN_OR_LOW': return C.boss.broken || C.boss.hp <= C.boss.max * 0.30;
    // Movement was a dead lever and "If Broken" was a coin that landed 7% of
    // the time. Tying a card to the row a hero stands in makes the rows worth
    // using and gives the player a condition they can CAUSE.
    case 'BACK_ROW':      return !!C.heroes[ownerId] && C.heroes[ownerId].row === 'back';
    case 'FRONT_ROW':     return !!C.heroes[ownerId] && C.heroes[ownerId].row === 'front';
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
  if (why !== 'allout') kizunaGain(n * KIZUNA_PER_DAMAGE);   // the all-out cannot feed itself
  if (_dmgBatch) { _dmgBatch.n += n; if (why) _dmgBatch.why = why; fxStrikeBoss(n, why); }
  else fxDamageBoss(n, why);
  checkBossPhase();
  if (C.boss.hp <= 0) setPhase('VICTORY');
}
function kizunaGain(n) {
  if (!C || C.kizuna >= KIZUNA_MAX) return;
  const was = C.kizuna;
  C.kizuna = Math.min(KIZUNA_MAX, C.kizuna + n);
  if (was < KIZUNA_MAX && C.kizuna >= KIZUNA_MAX) {
    logLine('KIZUNA — the three of them are ready.');
    fxKizunaReady();
  }
  renderKizuna();
}
// ALL-OUT: every hero still standing lands one blow at once. It costs no AP —
// the cost was the whole fight it took to charge — and it empties the meter.
async function allOut() {
  if (!C || C.phase !== 'PLAYER_READY' || C.pendingDiscard) return false;
  if (C.kizuna < KIZUNA_MAX) return false;
  const living = livingHeroes();
  if (!living.length) return false;
  C.kizuna = 0;
  C.allOuts = (C.allOuts || 0) + 1;
  setPhase('PLAYER_ACTION_RESOLVING');
  renderKizuna();
  await fxAllOut(living);
  const each = Math.round(TUNE.alloutDmg / 3);
  for (const id of living) {
    if (C.phase === 'VICTORY') break;
    dealToBoss(each, 'allout');
    await sleep(150);
  }
  breakDamage(TUNE.alloutBrk);
  logLine('ALL-OUT — ' + living.length + ' as one.');
  if (C.phase !== 'VICTORY') setPhase('PLAYER_READY');
  renderAll();
  return true;
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
// ONE CARD, ONE NUMBER. A card whose effects carry two damage atoms — a base
// strike plus a combo bonus — used to print them as two separate popups, so a
// 15-damage FINALE read on screen as a 5 and a 10: two chips instead of the
// blow it actually was. The HP and the impact still land per atom (Twin Fang
// really does strike twice); only the NUMBER is summed and shown once.
let _dmgBatch = null;
function resolveEffects(effects, ownerId, allyId) {
  const outer = _dmgBatch === null;
  if (outer) _dmgBatch = { n: 0, why: 'hit' };
  try { resolveEffectsInner(effects, ownerId, allyId); }
  finally {
    if (outer) {
      const b = _dmgBatch; _dmgBatch = null;
      if (b.n > 0) popDamage(b.n, b.why);
    }
  }
}
function resolveEffectsInner(effects, ownerId, allyId) {
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
    if (fx.healAll)    livingHeroes().forEach(id => {
      C.heroes[id].hp = Math.min(C.heroes[id].max, C.heroes[id].hp + fx.healAll); });
    if (fx.bleed)      C.boss.bleed += fx.bleed;
    if (fx.chill)      C.boss.chill += fx.chill;
    if (fx.counterstance) C.counterstance = true;
    if (fx.intercede && allyId) C.intercession = allyId;
    if (fx.moveSelf)   placeHero(ownerId, fx.moveSelf);
    if (fx.drawDiscard){ if (drawOne()) C.pendingDiscard = true; }
    if (fx.draw)       { for (let i = 0; i < fx.draw; i++) drawOne(); }
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
  // the ghost leaves from where the card actually sat, so it must be measured
  // BEFORE the hand re-renders
  if (ev.card.exhaust) fxExhaust(cardId); else flyFromHand(cardId, 'discard');
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
        fxResonanceBorn();
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
  flyFromHand(cardId, 'discard');
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
  flyFromHand(cardId, 'discard');
  C.hand.splice(C.hand.indexOf(cardId), 1);
  C.discard.push(cardId);
  drawOne();
  logLine('Cycled ' + CARD_DEFS[cardId].name + '.');
  renderAll();
  return true;
}

// MOVE, the way v2.2 asked it: the rows are places, not a toggle, and the
// refusal has to say WHY — "nothing happened" is the worst answer a board can
// give a finger that just did something deliberate.
const AP_PER_TURN = 3;
// THREE ROWS, not a toggle. Two lanes made "move" a switch you flipped; three
// named slots make it a place you choose, and give the sweeping attacks a real
// falloff to hide behind instead of a single on/off shelter.
// THE KIZUNA LADDER. The premise of the game is a party whose team attacks
// develop as they fight together, and there was nothing on the board measuring
// that. It fills from the two things the party does well — landing blows and
// turning blows aside — and cashes out as one strike from all three of them.
const KIZUNA_MAX = 100;
const KIZUNA_PER_DAMAGE = 1 / 3;      // a 15-damage FINALE is worth 5
const KIZUNA_TURNED = 8;              // a whole string read clean
const KIZUNA_FLAWLESS = 14;
const ROWS = ['front', 'mid', 'back'];
const ROW_SHELTER = { front: 1, mid: 0.62, back: 0.3 };
const MOVE_COST = 1;
// ONE HERO TO A LANE. Three of them could stand in the front row at once,
// which made a row a label rather than a position; now a move TRADES PLACES
// with whoever is already there, the way v2.2's slots did. Returns whoever was
// displaced, or null.
function placeHero(heroId, row) {
  const h = C.heroes[heroId];
  if (!h || h.row === row) return null;
  const other = Object.keys(C.heroes).find(id => id !== heroId && C.heroes[id].row === row);
  const from = h.row;
  h.row = row;
  if (other) { C.heroes[other].row = from; fxStep(other); }
  fxStep(heroId);
  return other || null;
}
function moveReason(heroId) {
  if (!C || C.phase !== 'PLAYER_READY' || C.pendingDiscard) return 'not your turn';
  if (!C.heroes[heroId] || C.heroes[heroId].downed) return 'down';
  if (C.turnState.moved >= 1) return 'already moved';
  if (C.ap < MOVE_COST) return 'needs ' + MOVE_COST + ' AP';
  return null;
}
// toRow is optional: called bare it toggles, which is what the tests and the
// printed Backstab movement have always meant by "move".
function moveHero(heroId, toRow) {
  if (moveReason(heroId)) return false;
  const h = C.heroes[heroId];
  // called bare it steps one row back, which is what "move" meant when there
  // were only two of them and is still what the printed movement wants
  const want = toRow || ROWS[Math.min(ROWS.length - 1, ROWS.indexOf(h.row) + 1)];
  if (!ROWS.includes(want) || want === h.row) return false;
  C.ap -= MOVE_COST;
  C.turnState.moved++;
  const displaced = placeHero(heroId, want);
  logLine(HEROES23[heroId].name + ' steps to the ' + want + ' row'
    + (displaced ? ', trading places with ' + HEROES23[displaced].name : '') + '.');
  renderAll();
  fxStep(heroId);
  return true;
}

// ═════════════════════════════════════════════════════════════════════════════
// END TURN → ENEMY PHASE → NEXT PLAYER PHASE. `opts.grades` lets the tests
// and the no-input accessibility path resolve the rhythm without live notes.
// ═════════════════════════════════════════════════════════════════════════════
async function endTurn(opts) {
  if (!C || C.phase !== 'PLAYER_READY' || C.pendingDiscard) return null;
  opts = opts || {};

  // END OF PLAYER PHASE — the hand sweeps into the discard, one card after
  // another, so the pile visibly grows and the turn has a full stop.
  if (HAND_SWEEP && C.hand.length) {
    setPhase('HAND_DISCARDING');
    await fxSweepHand();
  }

  // Broken expires here: the meter refills. (The pending cancel still
  // consumes the next enemy action.)
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
  let result = { intent: it.id, grades: [], hits: [], taken: 0, negated: 0, riposte: 0, canceled: false };

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
    // Who answers each hit, decided BEFORE the bar so the rhythm can be played
    // as one continuous phrase rather than stopping to resolve between notes.
    const answerers = it.hits.map(h => {
      const t = hitTargetId(h);
      return (C.intercession && C.intercession === t && !C.heroes.elin.downed) ? 'elin' : t;
    });
    // Tests and the no-input path may pass a flat grade list; otherwise the
    // player plays the whole bar now and the volley resolves against it.
    let flat = opts.grades ? opts.grades.slice() : await runVolleyRhythm(it.hits, answerers, it.sub);
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
      const grades = flat.splice(0, hit.notes.length);
      while (grades.length < hit.notes.length) grades.push('miss');
      result.grades.push(...grades);

      setPhase('ENEMY_RESOLUTION');
      // v2.2 PARTIAL MITIGATION: every note you turn aside negates its share;
      // the ones you miss still land. A whole string read GREAT-or-better is
      // TURNED — negated outright — and a string read PERFECTLY ripostes.
      const read = readString(grades, hit.notes.length);
      const parrier = C.heroes[parrierId];
      let turned = read.turned, negated = false;
      if (parrier && !parrier.downed && read.notes > 0) {
        let mit = read.mit;
        // RESPONSE LIMIT (deck §5): a hero fully negates only ONE hit per enemy
        // action. A second turned string in the same volley still holds most of
        // it, but the last quarter gets through.
        if (turned && negatedThisAction[parrierId]) { mit = 0.75; turned = false; }
        else if (turned) { negatedThisAction[parrierId] = true; negated = true; }
        dmg = Math.max(0, Math.round(dmg * (1 - mit)));
        if (turned) {
          breakDamage(1 + (C.counterstance ? 2 : 0));
          C.counterstance = false;
          result.negated++;
          logLine('TURNED — ' + HEROES23[parrierId].name + ' reads the whole string.');
        }
        if (turned) kizunaGain(KIZUNA_TURNED);
        if (read.flawless) {
          kizunaGain(KIZUNA_FLAWLESS - KIZUNA_TURNED);
          const rip = RIPOSTE_PER_NOTE * read.notes;
          result.riposte = (result.riposte || 0) + rip;
          dealToBoss(rip, 'riposte');
          breakDamage(1);
          logLine('FLAWLESS — ' + fmtN(rip) + ' returned.');
        }
        fxParryReceipt(parrierId, read);
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
      result.hits.push({ targetId: tgtId, parrierId, turned, negated, flawless: read.flawless,
                         mit: read.mit, kept: read.kept, notes: read.notes, taken: dmg });
      result.taken += dmg;
      await fxHitResolved(tgtId, dmg, turned, read.flawless);
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

  C.boss.intentIx = pickIntent();
  C.turn++;
  C.ap = C.apMax;
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
// The log is a live region now, not a line of italics on the board: the parry
// receipt over the hero and the numbers on the figures already say everything
// it used to, and this keeps the fight narrated for a screen reader.
function logLine(t) { C.log.push(t); const el = document.getElementById('k-log'); if (el) el.textContent = t; }

// ═════════════════════════════════════════════════════════════════════════════
// RHYTHM DEFENSE UI — notes launch from the Regent and travel to the target
// hero; the player answers ON the character. Tap anywhere, slide in any
// direction, hold-and-release. Graded against impact time.
// ═════════════════════════════════════════════════════════════════════════════
// The ring CLOSES onto the sweet spot. Everything else on screen desaturates
// and holds still, so the only live thing is the read. This is v2.2's parry
// presentation, restored: a big pale ring shrinking onto a dashed gold target,
// the note's index over it, and a dotted thread back to whatever is swinging.
// THE GRID IS THE CONTRACT (v2.2). The whole volley runs on ONE metronome at
// 120 BPM: every ring closes exactly on a beat, so a three-hit barrage reads as
// a bar of music rather than a handful of unrelated timers. Independent
// per-note timers are what made the last build feel flat.
// Musical waits are NEVER throttled: the fx sleep() collapses to 24ms under
// ?test=1 so the suite runs fast, and routing the metronome through it turned
// the grid into noise. The beat keeps real time in every mode.
// SLAY-THE-SPIRE HAND ECONOMY. The deck's §3 says "unplayed cards remain";
// the designer asked for the end of turn to sweep the hand into the discard,
// which is the Spire rule and the reason the discard pile is worth watching.
// Set false to restore the deck's keep-your-hand rule — nothing else changes.
const HAND_SWEEP = true;

const beatWait = (ms) => new Promise(r => setTimeout(r, Math.max(0, ms)));
const BEAT_MS = 500;             // 120 BPM
const BEAT_LEADIN = 2;           // beats of empty runway before the first note
const GESTURE_WORD = { tap: 'TAP', slide: 'SLIDE', hold: 'HOLD' };
let _grid = null;                // { t0, idx } — the live volley's beat clock

// Opens the metronome for a volley: the pulse, the runway, the beat count.
// Everything but the read desaturates and holds still while a bar plays.
function parryFocus(on) {
  const st = el('k-stage'); if (!st) return;
  st.classList.toggle('k-parry-focus', !!on);
}
// Clair-Obscur slow-mo: the instant a note becomes tappable, time dilates.
function parrySlowmo(on) {
  const st = el('k-stage'); if (!st) return;
  st.classList.toggle('k-slowmo', !!on);
}
// A dotted thread from whatever is swinging to the ring, so the blow reads as
// coming from the Regent rather than appearing out of the air.
function parryThread(fromEl, x, y) {
  const stage = el('k-stage'); if (!stage || !fromEl) return null;
  const sr = stage.getBoundingClientRect(), r = fromEl.getBoundingClientRect();
  const k = sr.width / stage.offsetWidth || 1;
  const fx = (r.left + r.width * 0.42 - sr.left) / k, fy = (r.top + r.height * 0.4 - sr.top) / k;
  const svg = document.createElementNS(AIMNS, 'svg');
  svg.setAttribute('class', 'k-pthread');
  svg.setAttribute('viewBox', '0 0 932 430');
  svg.innerHTML = '<path d="M ' + fx + ' ' + fy + ' Q ' + ((fx + x) / 2) + ' '
    + (Math.min(fy, y) - 40) + ' ' + x + ' ' + y + '" fill="none" stroke="#e0c084"'
    + ' stroke-width="1.6" stroke-dasharray="2 8" opacity="0.55"/>';
  stage.appendChild(svg);
  return svg;
}

function beatOpen(totalNotes) {
  _grid = { t0: performance.now() + BEAT_LEADIN * BEAT_MS, idx: 0, note: 0, total: totalNotes };
  const st = el('k-stage'); if (!st) return;
  const pulse = document.createElement('div');
  pulse.id = 'k-beat';
  pulse.style.setProperty('--beat', BEAT_MS + 'ms');
  st.appendChild(pulse);
}
function beatClose() {
  _grid = null;
  const p = el('k-beat'); if (p) p.remove();
}
// THE NOTE VOCABULARY. Six kinds, each asking a different thing of the hand,
// so a volley has shape instead of being one gesture repeated:
//
//   tap        strike on the beat
//   slide      sweep it aside — `slide:L/R/U/D` demands a DIRECTION
//   hold       brace through it and release on the beat
//   burst      a flurry: land BURST_TAPS strikes before the ring closes
//   feint      the ring hesitates mid-close, then snaps — punishes autopilot
//   bait       a crossed red ring you must NOT touch; discipline is the parry
const BURST_TAPS = 3;
const NOTE_WORD = { tap: 'TAP', slide: 'SLIDE', hold: 'HOLD', burst: 'MASH', feint: 'WAIT', bait: 'DON\u2019T' };
const DIR_ARROW = { L: '\u2190', R: '\u2192', U: '\u2191', D: '\u2193' };
// A crossed circle has to be learned. A skull does not.
const SKULL_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true">'
  + '<path d="M12 2C7 2 3.6 5.3 3.6 9.9c0 2.7 1.2 4.4 2.6 5.5.5.4.8 1 .8 1.6v1.3c0 .9.7 1.7 1.7 1.7h6.6c1 0 1.7-.8 1.7-1.7v-1.3c0-.6.3-1.2.8-1.6 1.4-1.1 2.6-2.8 2.6-5.5C20.4 5.3 17 2 12 2Z" fill="currentColor"/>'
  + '<circle cx="8.6" cy="10.2" r="2.3" fill="#120d0c"/><circle cx="15.4" cy="10.2" r="2.3" fill="#120d0c"/>'
  + '<path d="M12 13.2l-1.1 2.2h2.2L12 13.2Z" fill="#120d0c"/>'
  + '<path d="M9.4 17.6v3M12 17.6v3M14.6 17.6v3" stroke="#120d0c" stroke-width="1.1"/></svg>';
function parseNote(spec) {
  const parts = String(spec).split(':');
  return { kind: parts[0], dir: parts[1] || null };
}
// Did this drag go the way the note asked?
function dirOK(dir, dx, dy) {
  if (!dir) return Math.hypot(dx, dy) > 18;
  if (dir === 'L') return dx < -14 && Math.abs(dx) > Math.abs(dy);
  if (dir === 'R') return dx > 14 && Math.abs(dx) > Math.abs(dy);
  if (dir === 'U') return dy < -14 && Math.abs(dy) > Math.abs(dx);
  if (dir === 'D') return dy > 14 && Math.abs(dy) > Math.abs(dx);
  return false;
}
// A swipe is legible only once it has TRAVELLED, so grading it at the moment it
// crosses the threshold judged every slide later than the hand actually moved.
// A slide is credited from the instant the finger committed, capped at this
// much travel — the beat is still the beat, the gesture just stops paying a
// tax for being a gesture.
const SLIDE_LEAD_MS = 120;
// Beats of runway a note gets before it lands. A tap needs one; anything you
// must READ before you can answer it — an arrow, a crossed ring, a flurry —
// spawns earlier so the read and the answer are not the same half-second.
const NOTE_LEAD = { slide: 1.7, bait: 1.7, burst: 1.6, feint: 1.3 };
// A breath between the hits of a volley. Six notes back-to-back is a wall; the
// same six in phrases of two with a rest between them is a bar.
const REST_BEATS = 1;
// …and a burst gets a whole extra one after it.
const BURST_REST = 1;
// Sideways room between the notes of one hit, so a string reads as a run of
// positions rather than one point being shouted at repeatedly.
const NOTE_SPREAD = 58;

// One note: a ring closing on (ax, ay), exactly on its beat.
function runParryNote(spec, ax, ay, idx, total, dur, whoId, ox, oy) {
  return new Promise(resolve => {
    const stage = el('k-stage');
    if (!stage) return resolve('miss');
    const note = parseNote(spec), kind = note.kind, dir = note.dir;
    const ring = document.createElement('div');
    ring.className = 'k-pring k-pring-' + kind + (dir ? ' k-pring-dir' : '');
    ring.style.left = ax + 'px'; ring.style.top = ay + 'px';
    // whose head this is closing on, and how far off their centre it sits, so
    // a moving lens can never leave the ring behind
    if (whoId) { ring.dataset.hero = whoId;
                 ring.dataset.ox = ox || 0; ring.dataset.oy = oy || 0; }
    const glyph = kind === 'bait' ? '<span class="k-pr-x">' + SKULL_SVG + '</span>'
      : dir ? '<span class="k-pr-arrow">' + DIR_ARROW[dir] + '</span>'
      : kind === 'burst' ? '<span class="k-pr-burst"></span>' : '';
    // The verb is on screen from the first frame. It used to read "3/6" until
    // the ring went live, which told you WHEN but never WHAT, and left the read
    // and the answer sharing one window.
    const verb = NOTE_WORD[kind] + (dir ? ' ' + DIR_ARROW[dir] : '');
    ring.innerHTML = '<span class="k-pr-target"></span><span class="k-pr-close"></span>'
      + glyph + '<span class="k-pr-lbl">' + verb + '</span>'
      + (total > 1 ? '<span class="k-pr-n">' + idx + '/' + total + '</span>' : '');
    stage.appendChild(ring);
    ring.querySelector('.k-pr-close').style.animationDuration = dur + 'ms';
    const lbl = ring.querySelector('.k-pr-lbl');

    const t0 = performance.now();
    ring.dataset.impact = String(t0 + dur);      // the bots aim at the beat
    ring.dataset.kind = kind;
    ring.dataset.n = idx - 1; ring.dataset.total = total;
    if (dir) ring.dataset.dir = dir;
    let done = false, downAt = null, taps = 0, wrongAt = null;

    const liveT = setTimeout(function () {
      if (done) return;
      ring.classList.add('k-pr-live');
      lbl.textContent = verb + (kind === 'bait' ? '' : '!');
      parrySlowmo(true);
    }, Math.max(0, dur - PARRY_GOOD_MS));
    // a burst must read as "start now", so it opens the moment it spawns
    if (kind === 'burst') { ring.classList.add('k-pr-open');
      lbl.textContent = 'MASH 0/' + BURST_TAPS; ring.style.setProperty('--burst', '0'); }

    const finish = function (q) {
      if (done) return;
      done = true;
      clearTimeout(liveT); clearTimeout(missT);
      parrySlowmo(false);
      stage.removeEventListener('pointerdown', onDown, true);
      stage.removeEventListener('pointermove', onMove, true);
      stage.removeEventListener('pointerup', onUp, true);
      fxNoteGrade(ring, ax, ay, q, kind);
      resolve(q);
    };
    const tryGrade = function (at) {
      const g = parryGrade((at || performance.now()) - t0 - dur);
      if (g === null) { earlyNudge(ring, ax, ay); return false; }
      finish(g); return true;
    };
    const onDown = function (e) {
      downAt = performance.now();
      ring._dx = e.clientX; ring._dy = e.clientY;
      if (kind === 'bait') { finish('miss'); return; }        // touched the bait
      if (kind === 'burst') {
        taps++;
        // COUNT IT OUT LOUD. "MASH" with no tally gave the hand no idea whether
        // a tap had landed, so a flurry was played blind.
        lbl.textContent = 'MASH ' + Math.min(taps, BURST_TAPS) + '/' + BURST_TAPS;
        ring.style.setProperty('--burst', (Math.min(taps, BURST_TAPS) / BURST_TAPS).toFixed(2));
        ring.classList.remove('k-pr-tick'); void ring.offsetWidth; ring.classList.add('k-pr-tick');
        if (taps >= BURST_TAPS) tryGrade();
        return;
      }
      if (kind === 'tap' || kind === 'feint') tryGrade();
    };
    const onMove = function (e) {
      if (downAt == null || kind !== 'slide') return;
      const dx = e.clientX - ring._dx, dy = e.clientY - ring._dy;
      const at = Math.max(downAt, performance.now() - SLIDE_LEAD_MS);
      if (dirOK(dir, dx, dy)) { tryGrade(at); return; }
      // Wrong way so far. Remember WHEN, and keep listening — a hand that
      // corrects still earns full credit; one that never does pays a grade.
      if (wrongAt == null && Math.hypot(dx, dy) > 26) {
        wrongAt = at;
        ring.classList.remove('k-pr-wrong'); void ring.offsetWidth;
        ring.classList.add('k-pr-wrong');
      }
    };
    const onUp = function () {
      if (kind === 'hold' && downAt != null) tryGrade();
      downAt = null;
    };
    stage.addEventListener('pointerdown', onDown, true);
    stage.addEventListener('pointermove', onMove, true);
    stage.addEventListener('pointerup', onUp, true);
    const missT = setTimeout(function () {
      if (kind === 'bait') return finish('perfect');           // survived untouched
      if (kind === 'burst') return finish(taps >= BURST_TAPS ? 'perfect'
        : taps === BURST_TAPS - 1 ? 'great' : taps > 0 ? 'good' : 'miss');
      if (kind === 'slide' && wrongAt != null) {          // on the beat, wrong way
        const g = parryGrade(wrongAt - t0 - dur);
        return finish(g ? DEMOTE[g] : 'miss');
      }
      finish('miss');
    }, dur + PARRY_GOOD_MS + 30);
  });
}
function parryFlash(grade) {
  const s = document.getElementById('k-stage'); if (!s) return;
  const f = document.createElement('div');
  f.className = 'k-pflash k-pflash-' + grade;
  s.appendChild(f);
  setTimeout(() => f.remove(), 260);
}
// a spark under the finger, wherever it lands
function pressRipple(clientX, clientY) {
  const stage = el('k-stage'); if (!stage) return;
  const sr = stage.getBoundingClientRect(), k = sr.width / stage.offsetWidth || 1;
  const r = document.createElement('div');
  r.className = 'k-press';
  r.style.left = ((clientX - sr.left) / k) + 'px';
  r.style.top = ((clientY - sr.top) / k) + 'px';
  stage.appendChild(r);
  setTimeout(() => r.remove(), 340);
}
function earlyNudge(ring, ax, ay) {
  ring.classList.remove('k-pr-early'); void ring.offsetWidth; ring.classList.add('k-pr-early');
  const tag = document.createElement('div');
  tag.className = 'k-grade k-grade-early';
  tag.textContent = 'WAIT…';
  tag.style.left = ax + 'px'; tag.style.top = (ay - 44) + 'px';
  el('k-stage').appendChild(tag);
  setTimeout(() => tag.remove(), 420);
}

// THE WHOLE VOLLEY IS ONE BAR. Every note owns a fixed beat and is launched on
// it, whatever happened to the note before — a missed ring cannot drag the
// tempo, which is the difference between a rhythm and a queue of timers.
// Returns one flat grade list, in note order.
function anchorFor(heroId) {
  const stage = el('k-stage');
  const h = document.querySelector('.k-hero[data-hero="' + heroId + '"]');
  if (!stage || !h) return null;
  const sr = stage.getBoundingClientRect(), hr = h.getBoundingClientRect();
  const k = sr.width / stage.offsetWidth || 1;
  return { x: (hr.left + hr.width / 2 - sr.left) / k,
           y: (hr.top + hr.height * 0.26 - sr.top) / k };
}
async function runVolleyRhythm(hits, answerers, sub) {
  const step = BEAT_MS * (sub || 1);
  const kinds = hits.reduce((a, h) => a.concat(h.notes), []);
  const stage = el('k-stage');
  if (!stage || !kinds.length) return kinds.map(() => 'miss');
  parryFocus(true);
  camParryOpen();      // one composition, held for the whole bar
  camHold(true);
  // THE RINGS RIDE THE LENS. They live on the stage, outside the field, so a
  // camera move would slide them off the heroes they belong to. Re-anchoring
  // every frame costs three rect reads and buys a camera that can move during
  // a bar at all — which is what the escalating parry shot needs.
  let anchorRaf = requestAnimationFrame(function reanchor() {
    document.querySelectorAll('.k-pring[data-hero]').forEach(r => {
      const a = anchorFor(r.dataset.hero);
      if (!a) return;
      r.style.left = (a.x + (+r.dataset.ox || 0)) + 'px';
      r.style.top = (a.y + (+r.dataset.oy || 0)) + 'px';
    });
    anchorRaf = requestAnimationFrame(reanchor);
  });
  // EVERY PRESS REGISTERS. A press that lands between notes, or a fourth tap in
  // a flurry, used to do nothing at all — the hand could not tell "too early"
  // from "not registered", which is the worst thing a rhythm read can be.
  const onPress = (e) => pressRipple(e.clientX, e.clientY);
  stage.addEventListener('pointerdown', onPress, true);
  beatOpen(kinds.length);
  await beatWait(BEAT_LEADIN * BEAT_MS * 0.5);

  const jobs = [];
  let gi = 0, slot = 0;
  for (let hi = 0; hi < hits.length; hi++) {
    const who = answerers[hi];
    const pos = anchorFor(who);
    if (hi > 0) slot += REST_BEATS;         // a rest between hits, not a wall
    const inHit = hits[hi].notes.length;
    // A HIT CAN HAVE A RHYTHM. `beats` places each note in the hit's own bar,
    // so a string can syncopate — a quick double on the half-beat, a hesitation
    // before the last blow — instead of every enemy playing a metronome.
    const beats = hits[hi].beats || hits[hi].notes.map((_, i) => i);
    for (let ni = 0; ni < inHit; ni++) {
      const type = hits[hi].notes[ni];
      const idx = gi++, beat = slot + (beats[ni] == null ? ni : beats[ni]);
      const lead = NOTE_LEAD[parseNote(type).kind] || 1;
      // A hit's notes READ LEFT TO RIGHT across its hero. Longer runways mean
      // two rings share the air, and stacked on one point their labels and
      // arrows printed over each other — unreadable exactly when it mattered.
      const ox = (ni - (inHit - 1) / 2) * NOTE_SPREAD;
      const oy = (ni % 2 ? 15 : -7);
      jobs.push((async () => {
        const land = _grid.t0 + beat * step;               // this note's beat, fixed
        const wait = (land - step * lead) - performance.now();
        if (wait > 4) await beatWait(wait);
        if (!pos) return 'miss';
        document.querySelectorAll('.k-hero').forEach(h =>
          h.classList.toggle('k-parrying', h.dataset.hero === who));
        const dur = Math.max(180, Math.round(land - performance.now()));
        const g = await runParryNote(type, pos.x + ox, pos.y + oy, idx + 1, kinds.length, dur,
                                     who, ox, oy);
        return g;
      })());
    }
    slot += Math.max.apply(null, beats.map(b => b == null ? 0 : b)) + 1;
    // A MASH NEEDS ITS OWN AIR. Three taps inside one ring while the next note
    // is already closing is not a hard read, it is two hands' worth of work —
    // and the taps meant for the flurry rained on whatever came next.
    if (hits[hi].notes.some(n => parseNote(n).kind === 'burst')) slot += BURST_REST;
  }
  const thread = parryThread(el('k-boss-art'), anchorFor(answerers[0]) ? anchorFor(answerers[0]).x : 466,
                             anchorFor(answerers[0]) ? anchorFor(answerers[0]).y : 200);
  const grades = await Promise.all(jobs);
  stage.removeEventListener('pointerdown', onPress, true);
  cancelAnimationFrame(anchorRaf);
  camHold(false);
  if (thread) thread.remove();
  beatClose();
  parryFocus(false);
  document.querySelectorAll('.k-hero').forEach(h => h.classList.remove('k-parrying'));
  return grades;
}

// ═════════════════════════════════════════════════════════════════════════════
// FX + HITSTOP — coordinated beats; every fx is fail-safe when the DOM's gone.
// ═════════════════════════════════════════════════════════════════════════════
// THE FREEZE. v2.2's finding, restated: of the whole on-hit bundle the HITSTOP
// is the half doing the work — it costs no legibility at all, unlike a white
// wash. It has to be long enough to perceive: v2.2 shipped 95ms for a heavy and
// 155ms for a crash, and anything under ~70ms reads as a dropped frame rather
// than a held one. The old scale here started at 52ms, which is why the blows
// felt soft next to v2.2.
function hitstop(ms) {
  const s = document.getElementById('k-stage'); if (!s) return;
  clearTimeout(s._hsT);
  s.classList.add('k-frozen');
  s._hsT = setTimeout(() => s.classList.remove('k-frozen'), Math.max(70, ms));
}
// A blow's weight, in the four steps v2.2 graded: a graze, a hit, a heavy, a
// crash. Everything downstream reads the tier rather than re-deriving it.
function impactTier(power) {
  return power >= 2.0 ? 3 : power >= 1.1 ? 2 : power >= 0.45 ? 1 : 0;
}
// EVERY hit flashes. The old rule only flashed above power 1.2, so the ordinary
// exchange — which is most of a fight — landed with no flash at all.
function hitFlash(tier, tone) {
  const s = document.getElementById('k-stage'); if (!s) return;
  const f = document.createElement('div');
  f.className = 'k-hitflash k-hitflash-' + (tone || 'hit') + (tier >= 3 ? ' k-hitflash-huge' : tier >= 2 ? ' k-hitflash-big' : '');
  s.appendChild(f);
  setTimeout(() => f.remove(), tier >= 3 ? 250 : tier >= 2 ? 200 : 140);
}
// A struck figure is KNOCKED, not merely lit. v2.2 recoiled the art away from
// the blow and flashed it white in the same frame; v2.3 had the flash and no
// displacement, which is most of why nothing felt like it connected.
function struck(node, dir, tier) {
  if (!node) return;
  const cls = 'k-struck-' + (dir === 'r' ? 'r' : 'l') + (tier >= 3 ? ' k-struck-hard' : '');
  node.classList.remove('k-struck', 'k-struck-l', 'k-struck-r', 'k-struck-hard');
  void node.offsetWidth;
  node.className += ' k-struck ' + cls;
  clearTimeout(node._struckT);
  node._struckT = setTimeout(() =>
    node.classList.remove('k-struck', 'k-struck-l', 'k-struck-r', 'k-struck-hard'), 400);
}
// ── IMPACT ────────────────────────────────────────────────────────────────
// A blow should be FELT, and felt in proportion. Every strike gets the same
// four beats, scaled by how big it is: the world stops for a frame, the screen
// kicks, a shock ring blows out of the point of contact, and the thing that
// was hit flashes white and reels.
function centreOf(node) {
  const S = stageBox(); if (!S || !node) return null;
  const b = boxOf(node, S);
  return { x: b.x + b.w / 2, y: b.y + b.h * 0.38 };
}
function shockRing(x, y, power, tone) {
  const S = stageBox(); if (!S) return;
  const r = document.createElement('div');
  r.className = 'k-shock k-shock-' + (tone || 'hit');
  const size = 40 + power * 34;
  r.style.cssText = 'left:' + x + 'px;top:' + y + 'px;width:' + size + 'px;height:' + size + 'px;';
  S.st.appendChild(r);
  setTimeout(() => r.remove(), 520);
}
// ═════════════════════════════════════════════════════════════════════════
// THE LENS — v2.2's camera, rebuilt. A shake moves the FRAME; this moves the
// WORLD. The dolly travels through the field's perspective, so a push-in
// widens and parallaxes the ranks instead of flatly magnifying them, and the
// painted plate outside the field never moves at all.
//
// The home position is a COMPOSITION, never identity: on the player's turn the
// lens hangs toward the party, on the enemy's it swings to feature the Regent.
// Every punch settles back into whichever pose is active, so the fight reads as
// photographed rather than surveilled.
// ═════════════════════════════════════════════════════════════════════════
const CAM_SNAP = 'cubic-bezier(.16,.9,.28,1)';
const CAM_SETTLE = 'cubic-bezier(.3,.7,.25,1)';
const CAM_MAX_PAN = 34, CAM_MAX_DZ = 130, CAM_MAX_ROLL = 2.4;
const CAM_POSE_PLAYER = { x: 14, y: 1, dz: 26, r: -0.4, yaw: 3.4, pitch: 0.7 };
const CAM_POSE_ENEMY  = { x: -16, y: 3, dz: 30, r: 0.45, yaw: -3.8, pitch: 1.2 };
let _camBase = CAM_POSE_PLAYER, _camOutT = null, _camHeld = 0;
function camReduced() {
  try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  catch (_) { return false; }
}
function cam(spec) {
  const c = document.getElementById('k-cast'); if (!c || camReduced()) return;
  const s = spec || {};
  if (_camHeld && !s.force) return;
  const clamp = (v, lim) => Math.max(-lim, Math.min(lim, v || 0));
  c.style.setProperty('--cam-x', clamp(s.x, CAM_MAX_PAN) + 'px');
  c.style.setProperty('--cam-y', clamp(s.y, CAM_MAX_PAN * 0.5) + 'px');
  c.style.setProperty('--cam-dz', clamp(s.dz, CAM_MAX_DZ) + 'px');
  c.style.setProperty('--cam-r', clamp(s.r, CAM_MAX_ROLL) + 'deg');
  c.style.setProperty('--cam-yaw', clamp(s.yaw, 7) + 'deg');
  c.style.setProperty('--cam-pitch', clamp(s.pitch, 5) + 'deg');
  c.style.setProperty('--cam-ms', (s.ms == null ? 420 : s.ms) + 'ms');
  c.style.setProperty('--cam-ease', s.ease || CAM_SNAP);
}
// ONLY WHEN THE SIDE CHANGES. Every card resolution ends by returning to
// PLAYER_READY, and re-posing on each of those cancelled the punch the blow
// had just thrown — the lens twitched and snapped home before it had moved.
let _camPoseCur = null;
function camPose(pose, ms) {
  if (_camPoseCur === pose) return;
  _camPoseCur = pose;
  _camBase = pose || CAM_POSE_PLAYER;
  camReset(ms);
}
function camReset(ms) {
  clearTimeout(_camOutT); _camOutT = null;
  cam(Object.assign({}, _camBase, { ms: ms == null ? 560 : ms, ease: CAM_SETTLE, force: true }));
}
// where a subject sits relative to the stage centre, in stage px
function camOffsetTo(node) {
  const stage = el('k-stage'); if (!stage || !node) return null;
  const sr = stage.getBoundingClientRect(), k = sr.width / stage.offsetWidth || 1;
  const r = node.getBoundingClientRect();
  return { dx: (r.left + r.width / 2 - sr.left) / k - 466,
           dy: (r.top + r.height * 0.45 - sr.top) / k - 215 };
}
const CAM_PUNCH = [null,
  { dz: 40, r: 0.5, yaw: 1.8, pitch: 0.5, inMs: 110, hold: 90,  out: 380, pull: 0.05 },
  { dz: 74, r: 1.0, yaw: 3.0, pitch: 1.0, inMs: 100, hold: 150, out: 440, pull: 0.09 },
  { dz: 118, r: 1.7, yaw: 4.4, pitch: 1.6, inMs: 95,  hold: 230, out: 520, pull: 0.13 }];
let _punchAt = 0, _punchPow = -1;
// A PUNCH HOLDS BEFORE IT LEAVES. A shot that starts going home the instant it
// arrives reads as a twitch; the hold is what makes it feel authored.
function camPush(tier, node) {
  const p = Math.max(0, Math.min(3, tier | 0));
  if (p < 1 || camReduced() || _camHeld) return;
  // a volley calls this once per hit; collapse a burst into its strongest shove
  const now = performance.now();
  if (now - _punchAt < 150 && p <= _punchPow) return;
  _punchAt = now; _punchPow = p;
  const s = CAM_PUNCH[p];
  const o = node ? camOffsetTo(node) : null;
  const dir = o && o.dx < 0 ? -1 : 1;
  cam({ x: (_camBase.x || 0) - (o ? o.dx * s.pull : 0),
        y: (_camBase.y || 0) - (o ? o.dy * s.pull * 0.5 : 0),
        dz: (_camBase.dz || 0) + s.dz, r: dir * s.r,
        yaw: dir * s.yaw, pitch: s.pitch, ms: s.inMs, ease: CAM_SNAP });
  clearTimeout(_camOutT);
  _camOutT = setTimeout(() => camReset(s.out), s.inMs + s.hold);
}
// THE PARRY SHOT IS ONE SHOT. It was dutching side to side on every note —
// whipping the frame left, right, left between reads, which is exactly when a
// player needs the world to hold still. The lens composes ONCE at the top of
// the bar, leans in a touch, and does not move again until the bar is over.
// The per-note feedback belongs to the flash, the shock and the stop.
const CAM_POSE_PARRY = { x: 6, y: 2, dz: 62, r: 0, yaw: 0, pitch: 1.2 };
function camParryOpen() {
  if (camReduced()) return;
  cam(Object.assign({}, CAM_POSE_PARRY, { ms: 380, ease: CAM_SETTLE, force: true }));
}
function camHold(on) { _camHeld = on ? 1 : 0; if (!on) camReset(520); }
function screenKick(power) {
  const s = document.getElementById('k-stage'); if (!s) return;
  const cls = power > 1.5 ? 'k-kick-xl' : power > 0.8 ? 'k-kick-lg' : 'k-kick';
  s.classList.remove('k-kick', 'k-kick-lg', 'k-kick-xl');
  void s.offsetWidth;
  s.classList.add(cls);
  setTimeout(() => s.classList.remove(cls), 440);
}
function screenPulse(tone) {
  const s = document.getElementById('k-stage'); if (!s) return;
  const f = document.createElement('div');
  f.className = 'k-pulse k-pulse-' + (tone || 'hit');
  s.appendChild(f);
  setTimeout(() => f.remove(), 340);
}
// power ~0.4 (a graze) to ~2.5 (a finisher). dir is the way the struck figure
// is thrown — 'l' away from the Regent, 'r' away from the party.
function fxImpact(node, power, tone, dir) {
  const tier = impactTier(power);
  const c = centreOf(node);
  if (c) shockRing(c.x, c.y, power, tone);
  screenKick(power);
  hitFlash(tier, tone);
  camPush(tier, node);
  if (tier >= 2) screenPulse(tone);
  struck(node, dir, tier);
  hitstop(tier >= 3 ? 165 : tier >= 2 ? 105 : 75);
}
// A DAMAGE NUMBER IS A JRPG'S LOUDEST VOICE. These were 17px on a 932-wide
// stage — the one thing the player most needs to read, set smaller than the
// card text. They are tiered by weight now, they SLAM in rather than drifting
// up, and successive numbers stagger so a volley does not print over itself.
const POP_TIER = (n) => n >= 20 ? 'k-pop-xl' : n >= 12 ? 'k-pop-lg' : n >= 6 ? 'k-pop-md' : '';
let _popSeq = 0;
function popupOver(el, text, cls) {
  const stage = document.getElementById('k-stage'); if (!stage || !el) return;
  const sr = stage.getBoundingClientRect(), r = el.getBoundingClientRect();
  const scale = sr.width / stage.offsetWidth || 1;
  const p = document.createElement('div');
  p.className = 'k-pop ' + (cls || '');
  p.textContent = text;
  // fan successive numbers apart so a three-hit volley reads as three numbers
  const i = _popSeq++ % 3;
  p.style.setProperty('--pop-dx', (i === 0 ? 0 : i === 1 ? -26 : 26) + 'px');
  p.style.left = ((r.left + r.width / 2 - sr.left) / scale) + 'px';
  p.style.top = ((r.top + r.height * 0.26 - sr.top) / scale) + 'px';
  stage.appendChild(p);
  setTimeout(() => p.remove(), 1100);
}
// the blow itself — reels the Regent and shakes the frame, no number
function fxStrikeBoss(n, why) {
  const b = document.getElementById('k-boss-art');
  if (b) { b.classList.remove('k-recoil'); void b.offsetWidth; b.classList.add('k-recoil'); }
  fxImpact(b, Math.min(2.4, n / 6), why === 'bleed' ? 'bleed' : 'hit', 'r');
}
// the number, once, for whatever the whole card added up to
function popDamage(n, why) {
  popupOver(document.getElementById('k-boss-art'), fmtN(n),
    (why === 'bleed' ? 'k-pop-bleed' : 'k-pop-dmg') + ' ' + POP_TIER(n));
}
function fxDamageBoss(n, why) { fxStrikeBoss(n, why); popDamage(n, why); }
function fxBreak() { const el = document.getElementById('k-break'); if (el) { el.classList.remove('k-flash'); void el.offsetWidth; el.classList.add('k-flash'); } }
function fxPlayCard(cardId, ev) {
  const heroId = ev.card.owner === 'bond' ? 'ash' : ev.card.owner;
  const h = document.querySelector('.k-hero[data-hero="' + heroId + '"]');
  if (h) { h.classList.remove('k-acts'); void h.offsetWidth; h.classList.add('k-acts'); }
  if (ev.condActive && ev.card.cond) fxComboCall(ev.card.cond.type, h);
}
// A combo that only shows up as a bigger number is a combo nobody notices they
// built. It gets its own name, struck over the hero who closed it, and a
// FINALE gets the whole board — this is the payoff the deck is named for.
function fxComboCall(type, node) {
  const S = stageBox(); const c = centreOf(node);
  if (!S) return;
  const big = type === 'FINALE';
  const tag = document.createElement('div');
  tag.className = 'k-combo-call' + (big ? ' k-combo-call-big' : '');
  tag.textContent = COND_LABEL[type] || type;
  tag.style.left = (c ? c.x : 466) + 'px';
  tag.style.top = ((c ? c.y : 200) - 46) + 'px';
  S.st.appendChild(tag);
  setTimeout(() => tag.remove(), big ? 1100 : 760);
  if (c) shockRing(c.x, c.y, big ? 1.8 : 0.8, 'gold');
  if (big) { screenPulse('gold'); screenKick(1.2); hitstop(140); }
}
// The bond meter is gone, so the Resonance announces itself the way a combo
// does — struck over the pair who earned it — instead of ticking a number in
// the corner that nobody was watching.
function fxResonanceCharge() {
  const h = document.querySelector('.k-hero[data-hero="elin"]');
  if (h) { h.classList.remove('k-acts'); void h.offsetWidth; h.classList.add('k-acts'); }
}
function fxResonanceBorn() {
  const h = document.querySelector('.k-hero[data-hero="ash"]');
  const S = stageBox(); const c = centreOf(h);
  if (!S) return;
  const tag = document.createElement('div');
  tag.className = 'k-combo-call k-combo-call-big';
  tag.textContent = 'Resonance';
  tag.style.left = (c ? c.x + 40 : 340) + 'px';
  tag.style.top = ((c ? c.y : 200) - 52) + 'px';
  S.st.appendChild(tag);
  setTimeout(() => tag.remove(), 1100);
  if (c) shockRing(c.x + 40, c.y, 2.0, 'gold');
  screenPulse('gold'); screenKick(1.2); hitstop(150);
}
// THE LINE THAT CONNECTS THE GRADES TO THE HP BAR. Without it the player reads
// a stack of ratings fly past and then watches a number leave their health with
// no stated relationship between the two.
// THE CLASH. A blow turned aside is the best thing a player can do in this
// game, and it used to read as one gold ring. Now it is a struck-steel beat:
// the guard flares, a crescent of light throws off the hero in the direction
// the blow came from, shards spray, and the frame stops long enough to feel it.
function fxDeflect(node, flawless) {
  const S = stageBox(); const c = centreOf(node);
  if (!S || !c) { screenPulse('gold'); hitstop(120); return; }
  const boss = centreOf(document.getElementById('k-boss-art'));
  const ang = boss ? Math.atan2(boss.y - c.y, boss.x - c.x) * 180 / Math.PI : 0;
  const burst = document.createElement('div');
  burst.className = 'k-deflect' + (flawless ? ' k-deflect-max' : '');
  burst.style.cssText = 'left:' + c.x + 'px;top:' + c.y + 'px;--ang:' + ang.toFixed(1) + 'deg';
  // a crescent thrown toward whatever swung, plus shards off the point of contact
  let shards = '';
  const n = flawless ? 9 : 6;
  for (let i = 0; i < n; i++) {
    const a = ang - 62 + (124 / (n - 1)) * i + (i % 2 ? 7 : -7);
    shards += '<i class="k-df-shard" style="--a:' + a.toFixed(1) + 'deg;--d:'
      + (46 + (i % 3) * 20) + 'px;--t:' + (i * 14) + 'ms"></i>';
  }
  burst.innerHTML = '<span class="k-df-crescent"></span><span class="k-df-flash"></span>' + shards;
  S.st.appendChild(burst);
  setTimeout(() => burst.remove(), 720);
  camPush(flawless ? 3 : 2, node);
  shockRing(c.x, c.y, flawless ? 2.1 : 1.5, 'gold');
  setTimeout(() => shockRing(c.x, c.y, flawless ? 1.3 : 0.9, 'gold'), 90);
  screenPulse('gold');
  screenKick(flawless ? 1.4 : 0.9);
  if (node) {
    node.classList.remove('k-deflected'); void node.offsetWidth; node.classList.add('k-deflected');
    setTimeout(() => node.classList.remove('k-deflected'), 620);
  }
  hitstop(flawless ? 175 : 140);
}
function fxParryReceipt(heroId, read) {
  const at = document.querySelector('.k-hero[data-hero="' + heroId + '"]');
  if (!at || !read.notes) return;
  const stage = document.getElementById('k-stage'); if (!stage) return;
  const sr = stage.getBoundingClientRect(), r = at.getBoundingClientRect();
  const scale = sr.width / stage.offsetWidth || 1;
  const tag = document.createElement('div');
  const crown = read.flawless ? 'FLAWLESS' : read.turned ? 'TURNED' : null;
  tag.className = 'k-receipt' + (crown ? ' k-receipt-crown' : '');
  tag.innerHTML = crown
    ? '<b>' + crown + '</b><span>the blow is turned aside</span>'
    : '<b>' + read.kept + '/' + read.notes + ' turned</b><span>the rest gets through</span>';
  tag.style.left = ((r.left + r.width / 2 - sr.left) / scale) + 'px';
  tag.style.top = ((r.top - sr.top) / scale - 26) + 'px';
  stage.appendChild(tag);
  setTimeout(() => tag.remove(), 1150);
}
function fxNoteGrade(ring, ax, ay, grade, kind) {
  const stage = document.getElementById('k-stage');
  if (ring) {
    ring.classList.add('k-pr-land', 'k-pr-' + grade);
    setTimeout(() => ring.remove(), 200);
  }
  if (stage) {
    const tag = document.createElement('div');
    tag.className = 'k-grade k-grade-' + grade;
    tag.textContent = grade === 'perfect' ? 'PERFECT' : grade === 'great' ? 'GREAT'
      : grade === 'good' ? 'GOOD' : grade === 'late' ? 'LATE' : 'MISS';
    tag.style.left = ax + 'px'; tag.style.top = (ay - 40) + 'px';
    stage.appendChild(tag);
    setTimeout(() => tag.remove(), 700);
  }
  // EVERY landed press flashes the frame, tinted by how well it was read —
  // v2.2's parry-flash. Without it a note resolves as a word appearing.
  parryFlash(grade);
  if (grade === 'perfect') { shockRing(ax, ay, kind === 'burst' ? 1.5 : 1.1, 'gold'); hitstop(110); }
  else if (grade === 'great') { shockRing(ax, ay, 0.7, 'gold'); hitstop(75); }
  else if (grade === 'miss' && kind === 'bait') { screenPulse('hurt'); screenKick(1.1); }
}
// __SIM: the balance simulator runs thousands of fights; every beat is skipped.
// ── CARDS IN FLIGHT ───────────────────────────────────────────────────────
// A card that leaves the hand should be SEEN leaving it. Every route into a
// pile — played, cycled, thrown away, swept at end of turn — sends a ghost of
// the card from where it sat to the pile it lands in, and the pile thumps.
function stageBox() {
  const st = document.getElementById('k-stage');
  if (!st) return null;
  const r = st.getBoundingClientRect();
  return { st, r, k: r.width / st.offsetWidth || 1 };
}
function boxOf(el, S) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: (r.left - S.r.left) / S.k, y: (r.top - S.r.top) / S.k,
           w: r.width / S.k, h: r.height / S.k };
}
function flyCard(from, toEl, opts) {
  const S = stageBox(); if (!S || !from || !toEl) return Promise.resolve();
  const to = boxOf(toEl, S); if (!to) return Promise.resolve();
  const o = opts || {};
  const g = document.createElement('div');
  g.className = 'k-fly' + (o.faceDown ? ' k-fly-back' : '') + (o.flip ? ' k-fly-flip' : '');
  g.style.cssText = 'left:' + from.x + 'px;top:' + from.y + 'px;width:' + from.w
    + 'px;height:' + from.h + 'px;opacity:' + (o.fadeIn ? 0 : 1);
  if (o.html) g.innerHTML = o.html;
  S.st.appendChild(g);
  const ms = testMode() ? 40 : (o.ms || 380);
  const dx = (to.x + to.w / 2) - (from.x + from.w / 2);
  const dy = (to.y + to.h / 2) - (from.y + from.h / 2);
  // a card leaving the hand MORPHS DOWN into the stack; one arriving from the
  // deck grows to full size on the way in
  const scale = o.grow ? (to.w / Math.max(1, from.w))
                       : Math.min(1, to.w / Math.max(1, from.w));
  // A CARD DOES NOT SLIDE INTO A PILE, IT IS THROWN. A straight lerp is what
  // made the sweep read like a spreadsheet row moving; the card lifts off the
  // hand, arcs over, and drops onto the stack, turning as it goes.
  const lift = o.arc == null ? 26 : o.arc;
  const spin = o.spin || 0;
  const end = o.fadeOut === false ? 1 : 0.1;
  const mid = { transform: 'translate(' + (dx * 0.42).toFixed(1) + 'px,'
      + (dy * 0.34 - lift).toFixed(1) + 'px) scale(' + (1 + (scale - 1) * 0.3).toFixed(3)
      + ') rotate(' + (spin * 0.45).toFixed(1) + 'deg)',
    opacity: 1, offset: 0.5 };
  const last = { transform: 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1)
      + 'px) scale(' + scale.toFixed(3) + ') rotate(' + spin + 'deg)', opacity: end };
  return new Promise(res => {
    const done = () => { g.remove(); res(); };
    if (g.animate) {
      g.animate([{ transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 1 }, mid, last],
        { duration: ms, easing: 'cubic-bezier(.32,.02,.24,1)', fill: 'forwards' });
      setTimeout(done, ms + 20);
    } else {
      requestAnimationFrame(() => {
        g.style.transition = 'transform ' + ms + 'ms cubic-bezier(.4,.05,.3,1), opacity ' + ms + 'ms ease';
        g.style.transform = last.transform; g.style.opacity = String(end);
        setTimeout(done, ms + 20);
      });
    }
  });
}
// EXHAUST does not go to a pile — it burns out of the fight entirely.
function fxExhaust(cardId) {
  const node = document.querySelector('.k-card[data-card="' + cardId + '"]');
  const S = stageBox(); if (!node || !S) return;
  const b = boxOf(node, S);
  const g = document.createElement('div');
  g.className = 'k-fly k-fly-exhaust';
  g.style.cssText = 'left:' + b.x + 'px;top:' + b.y + 'px;width:' + b.w + 'px;height:' + b.h + 'px;';
  g.innerHTML = node.innerHTML;
  S.st.appendChild(g);
  requestAnimationFrame(() => {
    g.style.transition = 'transform 460ms ease, opacity 460ms ease, filter 460ms ease';
    g.style.transform = 'translateY(-42px) scale(1.12)';
    g.style.opacity = '0';
    g.style.filter = 'brightness(2.2) saturate(0.2)';
  });
  setTimeout(() => g.remove(), 500);
}
function pileThump(which) {
  const p = document.getElementById(which === 'deck' ? 'k-deck-btn' : 'k-disc-btn');
  if (!p) return;
  p.classList.remove('k-pile-thump'); void p.offsetWidth; p.classList.add('k-pile-thump');
  setTimeout(() => p.classList.remove('k-pile-thump'), 320);
}
// Send the card that is still sitting in the hand off to a pile.
function flyFromHand(cardId, which, opts) {
  const S = stageBox(); if (!S) return Promise.resolve();
  const node = document.querySelector('.k-card[data-card="' + cardId + '"]');
  const from = boxOf(node, S);
  if (!from) return Promise.resolve();
  const target = document.getElementById(which === 'deck' ? 'k-deck-btn' : 'k-disc-btn');
  const p = flyCard(from, target, Object.assign({ spin: -12, html: node.innerHTML }, opts || {}));
  pileThump(which);
  return p;
}

const sleep = (ms) => new Promise(r => setTimeout(r, (typeof window !== 'undefined' && window.__SIM) ? 0 : (testMode() ? Math.min(ms, 24) : ms)));
// THE SWEEP, Spire-style: each card LEAVES the hand as its ghost launches, so
// the fan closes behind it and the pile grows under it. The old version flew a
// ghost while the original sat in place until the last one had gone, which read
// as the hand duplicating itself rather than emptying.
async function fxSweepHand() {
  const target = document.getElementById('k-disc-btn');
  const n = C.hand.length;
  for (let i = 0; i < n; i++) {
    const S = stageBox();
    const id = C.hand[0];
    const node = document.querySelector('.k-card[data-card="' + id + '"]');
    const from = S && node ? boxOf(node, S) : null;
    const html = node ? node.innerHTML : '';
    C.hand.shift();
    C.discard.push(id);
    renderHand();                       // the ranks close in the same frame
    renderPiles();
    if (from && target) {
      flyCard(from, target, { spin: -16 - i * 7, arc: 46 + i * 8, ms: 460, html });
      pileThump('discard');
    }
    await sleep(testMode() ? 4 : 95);
  }
  await sleep(testMode() ? 6 : 260);
}
// THE DRAW BUILDS THE HAND. Every arriving card used to force a full re-layout
// with no transition, so the four cards already held SNAPPED to new angles five
// times in a row — which is what made the top of the turn look broken. The fan
// now glides to its new shape while the newcomer flies in over it, and the card
// lands face-up with a flip rather than appearing.
async function fxDrawOne() {
  const S = stageBox();
  const deck = document.getElementById('k-deck-btn');
  const before = S && deck ? boxOf(deck, S) : null;
  renderHand();
  if (before) {
    const id = C.hand[C.hand.length - 1];
    const node = document.querySelector('.k-card[data-card="' + id + '"]');
    const to = boxOf(node, S);
    if (to) {
      if (node) { node.classList.add('k-arriving'); node.style.opacity = '0'; }
      flyCard(before, node, { faceDown: true, fadeOut: false, grow: true, flip: true,
                              spin: -14, arc: 46, ms: 420 })
        .then(() => { if (node) { node.style.opacity = ''; node.classList.remove('k-arriving');
                                  node.classList.add('k-landed');
                                  setTimeout(() => node.classList.remove('k-landed'), 300); } });
      pileThump('deck');
    }
  }
  await sleep(testMode() ? 8 : 230);
}
async function fxDirge(n) {
  for (const id of livingHeroes()) {
    popupOver(document.querySelector('.k-hero[data-hero="' + id + '"]'), fmtN(n), 'k-pop-dirge k-pop-md');
  }
  const s = document.getElementById('k-stage');
  if (s) { s.classList.remove('k-dirge'); void s.offsetWidth; s.classList.add('k-dirge');
    setTimeout(() => s.classList.remove('k-dirge'), 700); }
  await sleep(320);
}
async function fxInterrupt() { const b = document.getElementById('k-boss-art'); if (b) { b.classList.add('k-broken'); await sleep(700); b.classList.remove('k-broken'); } }
async function fxBossHeal() { popupOver(document.getElementById('k-boss-art'), '+heal', 'k-pop-heal'); await sleep(500); }
async function fxHitResolved(tgtId, taken, negated, flawless) {
  const at = tgtId && document.querySelector('.k-hero[data-hero="' + tgtId + '"]');
  if (taken > 0) {
    popupOver(at || document.getElementById('k-party-hud'), fmtN(taken),
      'k-pop-dmg k-pop-hurt ' + POP_TIER(taken + 4));   // a hero has less HP; the same
                                                        // number hurts them more
    fxImpact(at, Math.min(2.4, taken / 5), 'hurt', 'l');
  } else if (negated) {
    fxDeflect(at, !!flawless);
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
  renderKizuna();
}
function renderKizuna() {
  const bar = el('k-kizuna'); if (!bar || !C) return;
  const pct = Math.round(C.kizuna / KIZUNA_MAX * 100);
  const ready = C.kizuna >= KIZUNA_MAX;
  el('k-kz-fill').style.width = pct + '%';
  el('k-kz-n').textContent = ready ? 'ALL-OUT' : pct + '%';
  bar.classList.toggle('k-kz-ready', ready);
  bar.disabled = !ready || C.phase !== 'PLAYER_READY';
}
function fxKizunaReady() {
  const bar = el('k-kizuna'); if (!bar) return;
  bar.classList.remove('k-kz-born'); void bar.offsetWidth; bar.classList.add('k-kz-born');
  screenPulse('gold');
}
// The three of them cross the floor at once. The camera drains, they strike,
// and the frame holds — this is the payoff for a whole fight of charging it.
async function fxAllOut(living) {
  const stage = el('k-stage'); if (!stage) return;
  stage.classList.add('k-allout');
  camPush(3, document.getElementById('k-boss-art'));
  const tag = document.createElement('div');
  tag.className = 'k-combo-call k-combo-call-big k-allout-call';
  tag.textContent = 'All-Out';
  tag.style.left = '466px'; tag.style.top = '150px';
  stage.appendChild(tag);
  living.forEach((id, i) => {
    const h = document.querySelector('.k-hero[data-hero="' + id + '"]');
    if (h) setTimeout(() => {
      h.classList.add('k-charging');
      setTimeout(() => h.classList.remove('k-charging'), 620);
    }, i * 90);
  });
  await sleep(520);
  tag.remove();
  stage.classList.remove('k-allout');
}
function renderBossHud() {
  el('k-bhp').textContent = fmtN(C.boss.hp);
  el('k-bmax').textContent = fmtN(C.boss.max);
  el('k-bhp-fill').style.width = (C.boss.hp / C.boss.max * 100) + '%';
  el('k-bflag').textContent = (C.boss.broken || C.boss.cancelNext) ? 'BROKEN' : '';
  el('k-turn-n').textContent = C.turn;
  const pips = [];
  for (let i = 0; i < C.boss.breakMax; i++) pips.push('<span class="k-pip' + (i < C.boss.brk ? ' on' : '') + '"></span>');
  el('k-break').innerHTML = pips.join('');
  el('k-chill').textContent = C.boss.chill > 0 ? '❄ ' + fmtN(C.boss.chill) : '';
  el('k-bleed').textContent = C.boss.bleed > 0 ? '🩸 ' + fmtN(C.boss.bleed) : '';
}
// THE TELEGRAPH — icons and amounts, in the sky above the Regent's head.
// One chip per thing the action will do: a blade for damage, a shield for
// guard, a star for a charge, a cross for healing, and the dirge's own mark.
// No sentence, no name, no counterplay hint: the shape says what kind of turn
// is coming and the number says how much.
const INTENT_ICON = { atk: 'atk', guard: 'guard', charge: 'finale', heal: 'heal', dirge: 'brk' };
function renderIntent() {
  const box = el('k-intent'); if (!box) return;
  const it = currentIntent();
  const chips = [];
  if (C.boss.cancelNext) {
    chips.push('<span class="k-ichip k-ichip-broken">' + icon('broken') + '<b>—</b></span>');
  } else {
    const hits = it.hits || [];
    if (hits.length) {
      const eff = intentTargetId();
      const face = eff ? '<img src="' + HEROES23[eff].art + '" alt="">' : '';
      chips.push('<span class="k-ichip k-ichip-atk">' + icon('atk')
        + '<b>' + fmtN(intentPreviewDmg()) + '</b>'
        + (hits.length > 1 ? '<i>×' + hits.length + '</i>' : '') + face + '</span>');
    }
    // the vocabulary is ready for defend and charge turns even though the
    // Regent has none yet — an intent carrying `guard` or `charge` shows one
    if (it.guard) chips.push('<span class="k-ichip k-ichip-guard">' + icon('guard') + '<b>' + fmtN(it.guard) + '</b></span>');
    if (it.charge) chips.push('<span class="k-ichip k-ichip-charge">' + icon('finale') + '<b>' + fmtN(it.charge) + '</b></span>');
    if (it.kind === 'heal') chips.push('<span class="k-ichip k-ichip-heal">' + icon('heal') + '<b>' + fmtN(it.phaseHeal) + '</b></span>');
    const dg = dirgeAmount();
    if (dg > 0) chips.push('<span class="k-ichip k-ichip-dirge">' + icon('brk') + '<b>' + fmtN(dg) + '</b><i>all</i></span>');
  }
  box.innerHTML = chips.join('');
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
    // THE FAN. A gentle arc — rotation from a low pivot plus a parabolic dip —
    // and a 3D lean so the edges of the hand turn away from the lens. A flat
    // row of upright cards is a spreadsheet; the tilt is what makes it a hand.
    const d = i - mid;
    const rot = (d * 3.0).toFixed(1), dy = (d * d * 1.6).toFixed(1);
    const tilt = (-d * 5.5).toFixed(1), lean = (2 + Math.abs(d) * 1.6).toFixed(1);
    // SLAY-THE-SPIRE ANATOMY, because this is read on a phone: a cost orb, a
    // name, the art, and then ONE text box of plain sentences with the numbers
    // bolded. The conditional clause sits in the same box on its own line,
    // labelled — dim while it sleeps, gold when it is live.
    const gem = ev.condActive && ev.currentCost !== c.cost
      ? ev.currentCost + '<s>' + c.cost + '</s>' : String(ev.currentCost);
    return '<button class="k-card' + (ev.condActive && !dead ? ' k-card-active' : '') + (afford ? '' : ' k-card-poor')
      + (dead ? ' k-card-dead' : '') + (c.owner === 'bond' ? ' k-card-res' : '')
      + (_sel === id ? ' k-card-sel' : '') + '" data-card="' + id + '"'
      + ' style="--rot:' + rot + 'deg;--dy:' + dy + 'px;--tilt:' + tilt
      + 'deg;--lean:' + lean + 'deg">'
      + cardFaceHTML(c, ev, gem, ownerArt)
      + '</button>';
  }).join('');
  hand.querySelectorAll('.k-card:not(.k-card-dead)').forEach(b => attachCardInput(b));
  // Rebuilding the hand orphans whatever was being dragged, so no beam can
  // still belong to anything. Leaving one alive is how it got stranded in the
  // corner of the screen with nothing holding the other end.
  aimClear();
}
const COND_LABEL = {
  FOLLOW_UP: 'Follow-Up', FINALE: 'Finale',
  BROKEN: 'If Broken', BROKEN_OR_LOW: 'Broken or ≤30% HP',
  BACK_ROW: 'From the Back', FRONT_ROW: 'From the Front',
};
// A small, consistent icon vocabulary — the same mark means the same thing on
// a card, in the inspect panel and in the Regent's intent line.
const ICON_PATHS = {
  atk:   'M2 14 L11 5 M9 3 L13 1 L11 5 M4 12 L2 14 L1 12',            // a blade
  guard: 'M8 1 L14 4 V8 Q14 12 8 15 Q2 12 2 8 V4 Z',                  // a shield
  heal:  'M8 3 V13 M3 8 H13',                                          // a cross
  bleed: 'M8 2 Q12 8 12 10 A4 4 0 0 1 4 10 Q4 8 8 2 Z',                // a drop
  chill: 'M8 2 V14 M3 5 L13 11 M13 5 L3 11',                           // a flake
  brk:   'M8 1 L11 6 L15 8 L11 10 L8 15 L5 10 L1 8 L5 6 Z',            // a shard
  follow:'M3 8 A3 3 0 0 1 8 8 A3 3 0 0 0 13 8 M11 6 L13 8 L11 10',     // a linked arc
  finale:'M8 1 L10 6 L15 6.5 L11.5 10 L12.5 15 L8 12.5 L3.5 15 L4.5 10 L1 6.5 L6 6 Z',
  broken:'M6 1 L9 7 L5 8 L10 15 L8 9 L12 8 Z',                         // a crack
  draw:  'M3 5 H10 V13 H3 Z M6 3 H13 V11',                             // two cards
  move:  'M2 8 H14 M11 5 L14 8 L11 11',                                // a step
};
function icon(name, cls) {
  const d = ICON_PATHS[name]; if (!d) return '';
  const fill = (name === 'guard' || name === 'bleed' || name === 'brk' || name === 'finale' || name === 'broken');
  return '<svg class="k-ico ' + (cls || '') + '" viewBox="0 0 16 16" aria-hidden="true">'
    + '<path d="' + d + '" ' + (fill ? 'fill="currentColor" stroke="none"' : 'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"')
    + '/></svg>';
}
const COND_ICON = { FOLLOW_UP: 'follow', FINALE: 'finale', BROKEN: 'broken',
  BROKEN_OR_LOW: 'broken', BACK_ROW: 'move', FRONT_ROW: 'move' };

function cardFaceHTML(c, ev, gem, ownerArt) {
  // THE CARD ANSWERS TWO QUESTIONS, so it is drawn as two blocks. The top is
  // what the card does, always, in the biggest type on the face. The bottom is
  // the COMBO — a banded strip with a named tag, because "Finale: +5 damage"
  // set as one more grey sentence read as a footnote instead of the payoff.
  const cond = c.cond
    ? '<span class="k-combo' + (ev.condActive ? ' on' : '') + '">'
      + '<span class="k-combo-tag">' + icon(COND_ICON[c.cond.type] || 'follow')
      + (COND_LABEL[c.cond.type] || c.cond.type)
      + (ev.condActive ? '<i class="k-combo-state">ON</i>' : '') + '</span>'
      + '<span class="k-combo-pay">' + condReward(c) + '</span></span>'
    : c.exhaust
      ? '<span class="k-combo k-combo-exh on"><span class="k-combo-tag">'
        + icon('finale') + 'Exhaust<i class="k-combo-state">ON</i></span>'
        + '<span class="k-combo-pay">Leaves the fight when played.</span></span>'
      : '';
  // THE ART LEADS, and the two corners sit ON it: cost top-left, whose card it
  // is top-right. With the name above the art instead, those corners ate 50 of
  // its 102px and every two-word name wrapped to two lines.
  return '<span class="k-cgem' + (ev.condActive && ev.currentCost !== c.cost ? ' on' : '') + '">' + gem + '</span>'
    + '<img class="k-owner" src="' + ownerArt + '" alt="">'
    + '<span class="k-cart"><img src="' + ownerArt + '" alt=""></span>'
    + '<span class="k-cname">' + c.name + '</span>'
    // the prose sits in its own inner span: .k-cprose centres its content with
    // flex, and a flex container turns each inline child into an item — which
    // silently ate the spaces and printed "9damage."
    + '<span class="k-ctext"><span class="k-cprose"><span>' + prose(c.base) + '</span></span>'
    + cond + '</span>';
}
// Plain sentences, numbers bolded — the way a card is read at a glance.
function prose(effects, plain) {
  const I = plain ? () => '' : icon;
  const out = [];
  const hits = effects.filter(f => f.dmg);
  if (hits.length === 1) out.push(I('atk') + '<b>' + fmtN(hits[0].dmg) + '</b> damage.');
  else if (hits.length > 1) out.push(I('atk') + '<b>' + fmtN(hits[0].dmg) + '</b> damage <b>×' + hits.length + '</b>.');
  for (const fx of effects) {
    if (fx.brk) out.push(I('brk') + '<b>' + fx.brk + '</b> Break.');
    if (fx.guardSelf) out.push(I('guard') + '<b>' + fmtN(fx.guardSelf) + '</b> Guard.');
    if (fx.guardAll) out.push(I('guard') + '<b>' + fmtN(fx.guardAll) + '</b> Guard to all.');
    if (fx.guardAlly) out.push(I('guard') + '<b>' + fmtN(fx.guardAlly) + '</b> Guard to an ally.');
    if (fx.guardLowest) out.push(I('guard') + '<b>' + fmtN(fx.guardLowest) + '</b> Guard to the lowest ally.');
    if (fx.heal) out.push(I('heal') + 'Heal <b>' + fmtN(fx.heal) + '</b>.');
    if (fx.healAll) out.push(I('heal') + 'Heal <b>' + fmtN(fx.healAll) + '</b> to all.');
    if (fx.bleed) out.push(I('bleed') + '<b>' + fmtN(fx.bleed) + '</b> Bleed.');
    if (fx.chill) out.push(I('chill') + '<b>' + fmtN(fx.chill) + '</b> Chill.');
    if (fx.counterstance) out.push(I('brk') + 'Next parry <b>+2</b> Break.');
    if (fx.intercede) out.push(I('guard') + 'Take their parry window.');
    if (fx.moveSelf) out.push(I('move') + 'Step to the <b>' + fx.moveSelf + '</b>.');
    if (fx.drawDiscard) out.push(I('draw') + 'Draw <b>1</b>, discard <b>1</b>.');
    if (fx.draw) out.push(I('draw') + 'Draw <b>' + fx.draw + '</b>.');
  }
  // ONE CLAUSE PER LINE. Run together, a two-effect card wraps wherever the
  // box happens to end and orphans a word — "9 damage. ✦ 2 / Break." Each
  // clause on its own line never orphans and scans as a list of things the
  // card does, which is what it is.
  return out.join(plain ? ' ' : '<br>');
}
// What the condition PAYS, as a clause that finishes the label's sentence.
function condReward(card) {
  if (!card.cond) return '';
  if (card.cond.reward === 'cost') return 'costs <b>' + card.cond.costTo + '</b> AP.';
  const hits = card.cond.bonus.filter(f => f.dmg);
  const parts = [];
  if (hits.length) parts.push(icon('atk') + '<b>+' + fmtN(hits.reduce((n, f) => n + f.dmg, 0)) + '</b> damage.');
  const rest = prose(card.cond.bonus.filter(f => !f.dmg));
  if (rest) parts.push(rest);
  return parts.join('<br>');
}
function condText(card) {
  if (!card.cond) return '';
  return (COND_LABEL[card.cond.type] || card.cond.type) + ': ' + stripTags(condReward(card));
}
function effectText(effects) { return prose(effects, true).replace(/<[^>]*>/g, ''); }
function stripTags(html) { return String(html).replace(/<br>/g, ' ').replace(/<[^>]*>/g, ''); }
function renderApDial() {
  el('k-ap-num').textContent = C.ap;
  el('k-ap').classList.toggle('k-ap-spent', C.ap === 0);   // a spent orb goes cold
  // …and the pips say what it is OUT OF, so nobody has to remember the budget
  const pips = el('k-ap-pips');
  if (pips) {
    let out = '';
    for (let i = 0; i < C.apMax; i++) out += '<span class="k-ap-pip' + (i < C.ap ? '' : ' k-ap-off') + '"></span>';
    pips.innerHTML = out;
  }
}
function renderPiles() {
  el('k-deck-n').textContent = C.deck.length;
  el('k-disc-n').textContent = C.discard.length;
  el('k-deck-btn').classList.toggle('k-pile-empty-stack', !C.deck.length);
  el('k-disc-btn').classList.toggle('k-pile-empty-stack', !C.discard.length);
  // the free swap is a dot on the draw pile, not a chip of its own
  const deck = el('k-deck-btn');
  if (deck) deck.classList.toggle('k-cycle-spent', !!C.turnState.cycled);
}
function renderHeroes() {
  document.querySelectorAll('.k-hero').forEach(h => {
    const id = h.dataset.hero;
    for (const r of ROWS) h.classList.toggle('k-row-' + r, C.heroes[id].row === r);
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
// SNAP, not a hit-test. A finger is a blunt instrument on a phone: rather than
// asking "is the pointer inside this box", find the NEAREST legal target and
// snap to it if it is anywhere close. Only targets the held card could
// actually accept are considered, so the snap can never suggest an illegal play.
const SNAP_RADIUS = 210;
function dropTargetAt(x, y, cardId) {
  const stage = el('k-stage');
  if (!stage) return null;
  const inside = (r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  // THE DRAW PILE IS THE SWAP. A separate CYCLE chip was a third object in the
  // corner explaining a rule; putting the card back where cards come from says
  // the same thing with no words. Only offered while the free swap is unspent.
  const deck = el('k-deck-btn');
  if (deck && !C.turnState.cycled) {
    const r = deck.getBoundingClientRect();
    if (inside({ left: r.left - 26, right: r.right + 26, top: r.top - 26, bottom: r.bottom + 26 }))
      return { zone: 'piles' };
  }
  const want = cardId ? (CARD_DEFS[cardId].target === 'enemy' ? 'enemy' : 'party') : null;
  const cands = [];
  if (!want || want === 'enemy') {
    const b = el('k-boss-art');
    if (b) cands.push({ zone: 'enemy', el: b, r: b.getBoundingClientRect() });
  }
  if (!want || want === 'party') {
    document.querySelectorAll('.k-hero').forEach(h => {
      if (C.heroes[h.dataset.hero] && !C.heroes[h.dataset.hero].downed)
        cands.push({ zone: 'party', hero: h.dataset.hero, el: h, r: h.getBoundingClientRect() });
    });
    const hud = el('k-party-hud');
    if (hud) cands.push({ zone: 'party', el: hud, r: hud.getBoundingClientRect() });
  }
  let best = null, bestD = Infinity;
  for (const c of cands) {
    // distance to the box, zero when the pointer is already inside it
    const dx = Math.max(c.r.left - x, 0, x - c.r.right);
    const dy = Math.max(c.r.top - y, 0, y - c.r.bottom);
    const d = Math.hypot(dx, dy);
    if (d < bestD) { bestD = d; best = c; }
  }
  if (!best || bestD > SNAP_RADIUS) return null;
  return { zone: best.zone, hero: best.hero, el: best.el, snapped: bestD > 0 };
}
function dropCommit(id, drop) {
  if (!drop) return false;
  if (drop.zone === 'piles') return cycleCard(id);
  const want = CARD_DEFS[id].target === 'enemy' ? 'enemy' : 'party';
  if (drop.zone !== want) return false;
  return playCard(id, drop.hero && drop.hero !== CARD_DEFS[id].owner ? drop.hero : undefined);
}
// ═════════════════════════════════════════════════════════════════════════════
// THE AIM BEAM — restored from v2.2. A glowing energy ribbon (soft halo, bright
// core, travelling dotted thread) cast from the card you are holding, ending in
// a rotating JRPG reticle on the thing you are about to hit.
// ═════════════════════════════════════════════════════════════════════════════
// The card FOLLOWS THE FINGER (v2.2's feel) and trails DOWN-LEFT of it, which
// is how the original played: your thumb sits on the target, the reticle is
// under your thumb, and the card hangs below-left where you can still read it
// and where it never covers the arc it is casting.
const CARD_OFFSET = { x: -58, y: 104 };
const AIMNS = 'http://www.w3.org/2000/svg';
let _aim = null;
function aimLayer() {
  let svg = document.getElementById('k-aim');
  if (!svg) {
    svg = document.createElementNS(AIMNS, 'svg');
    svg.id = 'k-aim';
    // its own compositor layer: the drag loop redraws this ~60x/s and must not
    // re-rasterize the drop-shadowed figures underneath
    svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;'
      + 'z-index:26;overflow:visible;will-change:transform;transform:translateZ(0)';
    el('k-stage').appendChild(svg);
  }
  svg.setAttribute('viewBox', '0 0 932 430');
  return svg;
}
function aimClear() {
  const s = document.getElementById('k-aim'); if (s) s.innerHTML = '';
  _aim = null;
  document.querySelectorAll('.k-aim-valid, .k-aim-snap')
    .forEach(f => f.classList.remove('k-aim-valid', 'k-aim-snap'));
}
function cornerPath(r) {
  const L = 6;
  return `M ${-r} ${-r + L} L ${-r} ${-r} L ${-r + L} ${-r}`
       + ` M ${r - L} ${-r} L ${r} ${-r} L ${r} ${-r + L}`
       + ` M ${r} ${r - L} L ${r} ${r} L ${r - L} ${r}`
       + ` M ${-r + L} ${r} L ${-r} ${r} L ${-r} ${r - L}`;
}
// Build the beam DOM ONCE per shape and only nudge geometry per frame — an
// innerHTML rewrite every frame is what made this stutter in v2.2.
function drawAim(fx, fy, ex, ey, valid, color, phase) {
  const svg = aimLayer();
  const cx = (v) => Math.max(6, Math.min(926, v)), cy = (v) => Math.max(6, Math.min(424, v));
  fx = cx(fx); fy = cy(fy); ex = cx(ex); ey = cy(ey);
  const c = valid ? color : '#7a7060';
  const R = 16;
  const shape = (valid ? 'v' : 'i') + c;
  if (!_aim || _aim.shape !== shape) {
    // v2.2's reticle: four corner brackets around a bright dot, breathing.
    const ret = valid
      ? `<g class="k-aim-ret">`
        + `<g class="k-aim-r1"><path d="${cornerPath(R)}" fill="none" stroke="${c}" stroke-width="2.6" stroke-linecap="round"/></g>`
        + `<circle class="k-aim-dot" r="3.4" fill="#fff2ea"/></g>`
      : '';
    // no SVG filter on the per-frame paths — a wide low-opacity underlay fakes
    // the glow without a blur rasterization every frame
    // the DASH is the line — a travelling dotted arc, with a soft underlay
    svg.innerHTML =
        `<path class="k-aim-glow" fill="none" stroke="${c}" stroke-width="9" stroke-linecap="round" opacity="0.16"/>`
      + `<path class="k-aim-dash" fill="none" stroke="${c}" stroke-width="3.4" stroke-linecap="round" stroke-dasharray="3 9"/>`
      + ret;
    _aim = { shape, glow: svg.querySelector('.k-aim-glow'),
      dash: svg.querySelector('.k-aim-dash'), ret: svg.querySelector('.k-aim-ret'),
      r1: svg.querySelector('.k-aim-r1') };
  }
  // a bowed ribbon, not a straight line — it reads as thrown, not aimed
  const bow = Math.min(60, Math.max(22, Math.abs(ex - fx) * 0.11));
  const d = `M ${fx} ${fy} Q ${(fx + ex) / 2} ${Math.max(10, Math.min(fy, ey) - bow)} ${ex} ${ey}`;
  if (_aim.glow) _aim.glow.setAttribute('d', d);
  if (_aim.dash) { _aim.dash.setAttribute('d', d); _aim.dash.setAttribute('stroke-dashoffset', -phase); }
  if (_aim.ret) _aim.ret.setAttribute('transform', `translate(${ex} ${ey})`);
  // the brackets breathe rather than spin — a lock-on, not a radar
  if (_aim.r1) _aim.r1.setAttribute('transform', `scale(${(1 + Math.sin(phase / 26) * 0.07).toFixed(3)})`);
}
// A card wanting the enemy is gold; one tending the party is green.
function aimColor(cardId) {
  return CARD_DEFS[cardId].target === 'enemy' ? '#e05b52' : '#98d878';
}
// Stage-space centre of whatever a drop would land on.
function aimAnchor(drop) {
  const stage = el('k-stage');
  const sr = stage.getBoundingClientRect();
  const scale = sr.width / stage.offsetWidth || 1;
  let node = null;
  if (!drop) return null;
  if (drop.zone === 'enemy') node = el('k-boss-art');
  else if (drop.zone === 'piles') node = el('k-deck-btn');
  else if (drop.hero) node = document.querySelector('.k-hero[data-hero="' + drop.hero + '"]');
  else node = el('k-party-hud');
  if (!node) return null;
  const r = node.getBoundingClientRect();
  return { x: (r.left + r.width / 2 - sr.left) / scale,
           y: (r.top + r.height * (drop.zone === 'enemy' ? 0.42 : 0.4) - sr.top) / scale,
           node };
}

// THE ROW SNAP, the same philosophy as the card snap: do not ask "is the
// finger inside this band", ask which row it is nearest — and weight depth,
// because "step back" is a movement up the screen, not sideways.
const ROW_SNAP = 300;
function rowTargetAt(clientX, clientY) {
  const stage = el('k-stage'); if (!stage) return null;
  const sr = stage.getBoundingClientRect();
  const k = sr.width / stage.offsetWidth || 1;
  const px = (clientX - sr.left) / k, py = (clientY - sr.top) / k;
  let best = null, bd = Infinity;
  document.querySelectorAll('#k-rows .k-row').forEach(r => {
    // MEASURED, not laid out: a lane sits at a real translateZ now, so its
    // offsetLeft is where the browser put the box before the lens moved it.
    const b = r.getBoundingClientRect();
    const cx = (b.left + b.width / 2 - sr.left) / k;
    const cy = (b.top + b.height / 2 - sr.top) / k;
    // the lanes are side by side now, so ACROSS is the intent and depth is
    // only a tiebreak — the old 1.7 weighting was for a purely vertical ladder
    const d = Math.hypot(px - cx, (py - cy) * 0.55);
    if (d < bd) { bd = d; best = r.dataset.row; }
  });
  return bd <= ROW_SNAP ? best : null;
}
// The price, or the reason there is no price to pay — over the hero's head,
// where the hand already is.
function moveHint(heroId, text, ok) {
  const hint = el('k-movehint'); if (!hint) return;
  if (!heroId) { hint.classList.add('k-hidden'); return; }
  const stage = el('k-stage'), node = document.querySelector('.k-hero[data-hero="' + heroId + '"]');
  if (!stage || !node) return;
  const sr = stage.getBoundingClientRect(), r = node.getBoundingClientRect();
  const k = sr.width / stage.offsetWidth || 1;
  if (text != null) hint.textContent = text;      // null: reposition, same words
  hint.classList.toggle('k-movehint-no', !ok);
  hint.style.left = ((r.left + r.width / 2 - sr.left) / k) + 'px';
  hint.style.top = ((r.top - sr.top) / k - 20) + 'px';
  hint.classList.remove('k-hidden');
}
function fxStep(heroId) {
  const node = document.querySelector('.k-hero[data-hero="' + heroId + '"]');
  if (!node) return;
  node.classList.remove('k-stepping'); void node.offsetWidth; node.classList.add('k-stepping');
  setTimeout(() => node.classList.remove('k-stepping'), 460);
}
function attachCardInput(btn) {
  // `armed` gates everything on a REAL press. Without it a bare hover's
  // pointermove measured its delta from (0,0), decided it was a drag, and
  // flung the card 375px off the hand before the button ever went down.
  let holdT = null, held = false, dragging = false, armed = false, sx = 0, sy = 0;
  let raf = 0, phase = 0, lastPt = null, home = null;
  // the beam is redrawn on its own frame loop so the dotted thread keeps
  // travelling and the reticle keeps turning even when the finger is still
  // A drag can outlive its own card: anything that re-renders the hand detaches
  // this button while the frame loop is still running, and a detached node
  // measures as a zero rect — which is how the beam ended up nailed to the top
  // corner of the screen, still pointing at the Regent, long after the drop.
  const abandon = () => {
    dragging = false; armed = false; held = false; lastPt = null;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    aimClear();
  };
  const spin = () => {
    if (!dragging) { raf = 0; return; }
    if (!btn.isConnected) { abandon(); return; }
    phase = (phase + 1.6) % 360;
    paintAim();
    raf = requestAnimationFrame(spin);
  };
  const paintAim = () => {
    if (!lastPt) return;
    const stage = el('k-stage');
    const sr = stage.getBoundingClientRect();
    const k = sr.width / stage.offsetWidth || 1;
    const cr = btn.getBoundingClientRect();
    if (!btn.isConnected || cr.width < 2) { abandon(); return; }
    const from = { x: (cr.left + cr.width / 2 - sr.left) / k, y: (cr.top - sr.top) / k };
    const id = btn.dataset.card;
    const drop = dropTargetAt(lastPt.x, lastPt.y, id);
    const want = CARD_DEFS[id].target === 'enemy' ? 'enemy' : 'party';
    const ok = !!drop && (drop.zone === want || drop.zone === 'piles');
    const snap = ok ? aimAnchor(drop) : null;
    document.querySelectorAll('.k-aim-snap').forEach(f => f.classList.remove('k-aim-snap'));
    if (snap && snap.node) snap.node.classList.add('k-aim-snap');
    const to = snap || { x: (lastPt.x - sr.left) / k, y: (lastPt.y - sr.top) / k };
    drawAim(from.x, from.y, to.x, to.y, ok, aimColor(id), phase);
  };
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();                          // no iOS callout, no selection
    held = false; dragging = false; armed = true; sx = e.clientX; sy = e.clientY;
    holdT = setTimeout(() => { if (!C.pendingDiscard) { held = true; openInspect(btn.dataset.card); } }, 420);
    try { btn.setPointerCapture(e.pointerId); } catch (_) {}
  });
  btn.addEventListener('pointermove', (e) => {
    if (!armed || held) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (!dragging && Math.hypot(dx, dy) > 14) {
      clearTimeout(holdT); dragging = true;
      // Measure the card's rest position UNDER the aiming transform — the fan's
      // rotate/translate moves its visual centre, so measuring before the swap
      // would anchor the drag to the wrong point and the card would sit off the
      // finger by the fan's offset.
      btn.style.setProperty('--dragx', '0px');
      btn.style.setProperty('--dragy', '0px');
      btn.classList.add('k-aiming');
      const stg0 = el('k-stage'), sr0 = stg0.getBoundingClientRect();
      const k0 = sr0.width / stg0.offsetWidth || 1;
      const h0 = btn.getBoundingClientRect();
      home = { x: (h0.left + h0.width / 2 - sr0.left) / k0,
               y: (h0.top + h0.height / 2 - sr0.top) / k0,
               hw: h0.width / k0 / 2, hh: h0.height / k0 / 2 };
      // light every figure this card could legally land on
      const want = CARD_DEFS[btn.dataset.card].target === 'enemy' ? 'enemy' : 'party';
      if (want === 'enemy') el('k-boss-art').classList.add('k-aim-valid');
      else document.querySelectorAll('.k-hero').forEach(h => h.classList.add('k-aim-valid'));
      if (!raf) raf = requestAnimationFrame(spin);
    }
    if (dragging && home) {
      // the card rides the finger: centred on it, lifted clear of the thumb
      const stg = el('k-stage'), sr2 = stg.getBoundingClientRect();
      const k = sr2.width / stg.offsetWidth || 1;
      const px = (e.clientX - sr2.left) / k, py = (e.clientY - sr2.top) / k;
      // clamped only to the STAGE edge — a real boundary, not a leash: it can
      // only bite at the very rim, never in the middle of an ordinary drag
      const hw = home.hw, hh = home.hh;      // measured under the aiming transform
      const cx2 = Math.max(hw + 2, Math.min(932 - hw - 2, px + CARD_OFFSET.x));
      const cy2 = Math.max(hh + 2, Math.min(430 - hh - 2, py + CARD_OFFSET.y));
      btn.style.setProperty('--dragx', (cx2 - home.x) + 'px');
      btn.style.setProperty('--dragy', (cy2 - home.y) + 'px');
      const over = dropTargetAt(e.clientX, e.clientY, btn.dataset.card);
      const want = CARD_DEFS[btn.dataset.card].target === 'enemy' ? 'enemy' : 'party';
      btn.classList.toggle('k-drop-ok', !!over && (over.zone === want || over.zone === 'piles'));
      lastPt = { x: e.clientX, y: e.clientY };
      paintAim();
    }
  });
  btn.addEventListener('pointerup', (e) => {
    clearTimeout(holdT);
    if (!armed) return;
    armed = false;
    if (held) { closeInspect(); return; }        // inspect ends when you let go
    const id = btn.dataset.card;
    if (C.pendingDiscard) { pickDiscard(id); return; }   // Quick Throw's second half
    if (dragging) {
      dragging = false; if (raf) { cancelAnimationFrame(raf); raf = 0; }
      aimClear();
      btn.classList.remove('k-dragging', 'k-aiming', 'k-drop-ok');
      btn.style.removeProperty('--dragx'); btn.style.removeProperty('--dragy');
      const over = dropTargetAt(e.clientX, e.clientY, id);
      if (!dropCommit(id, over)) renderHand();
      else { _sel = null; el('k-target-ring').classList.add('k-hidden'); }
      return;
    }
    if (_sel === id) { commitCard(id); }
    else { _sel = id; renderHand(); showTargetRing(id); }
  });
  btn.addEventListener('pointercancel', () => { clearTimeout(holdT); armed = false; dragging = false;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    aimClear();
    btn.classList.remove('k-dragging', 'k-aiming', 'k-drop-ok');
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
// MTG ARENA INSPECT — hold a card and it blows up, centred and legible, over a
// dimmed board. Release to put it back. It never commits the card: playing is
// dragging, so inspecting can never cost you a turn by accident.
function openInspect(cardId) {
  _focus = cardId;
  const ev = evaluateCard(cardId);
  const c = ev.card;
  const ownerArt = c.owner === 'bond' ? HEROES23.ash.art : HEROES23[c.owner].art;
  const who = c.owner === 'bond' ? 'ASH + ELIN · Bond Art'
    : HEROES23[c.owner].name + ' · ' + HEROES23[c.owner].cls + ' · ' + C.heroes[c.owner].row + ' row';
  const gem = ev.condActive && ev.currentCost !== c.cost
    ? ev.currentCost + '<s>' + c.cost + '</s>' : String(ev.currentCost);
  const f = el('k-focus');
  f.innerHTML = '<div class="k-insp-wrap"><div class="k-insp-card">'
    + cardFaceHTML(c, ev, gem, ownerArt) + '</div></div>'
    + '<div class="k-insp-side">'
    + '<div class="k-insp-who">' + who + '</div>'
    + '<div class="k-insp-now"><em>Resolves now</em>' + prose(ev.resolvedEffects) + '</div>'
    + (c.cond ? '<div class="k-insp-cond' + (ev.condActive ? ' on' : '') + '">'
        + (COND_LABEL[c.cond.type] || c.cond.type) + ' — ' + (ev.condActive ? 'ACTIVE' : 'not yet') + '</div>' : '')
    + '<div class="k-insp-hint">release to close · drag the card to play it</div>'
    + '</div>';
  f.classList.remove('k-hidden');
  el('k-stage').classList.add('k-inspecting');
}
function closeInspect() {
  _focus = null;
  el('k-focus').classList.add('k-hidden');
  el('k-stage').classList.remove('k-inspecting');
  document.querySelectorAll('.k-hero').forEach(h => h.classList.remove('k-dim', 'k-fwd'));
}

// THE PILES, OPENED — Slay the Spire lets you read the draw and discard piles
// at any time, and a deckbuilder is unplayable without it. The draw pile is
// shown sorted, not in draw order, so opening it cannot leak the shuffle.
function openPile(which) {
  const ids = which === 'deck' ? C.deck.slice().sort() : C.discard.slice();
  const f = el('k-focus');
  const title = which === 'deck' ? 'DRAW PILE' : 'DISCARD';
  f.innerHTML = '<div class="k-pile-view" id="k-pile-view">'
    + '<div class="k-pile-head">' + title + ' <b>' + ids.length + '</b>'
    + (which === 'deck' ? '<em>order hidden</em>' : '') + '</div>'
    + '<div class="k-pile-grid">'
    + (ids.length ? ids.map(id => {
        const ev = evaluateCard(id), c = ev.card;
        const art = c.owner === 'bond' ? HEROES23.ash.art : HEROES23[c.owner].art;
        return '<div class="k-card k-card-static">' + cardFaceHTML(c, ev, String(c.cost), art) + '</div>';
      }).join('') : '<div class="k-pile-empty">empty</div>')
    + '</div><div class="k-pile-hint">tap anywhere to close</div></div>';
  f.classList.remove('k-hidden');
  el('k-stage').classList.add('k-inspecting');
  _focus = 'pile:' + which;
}

function bindChrome() {
  el('k-endturn').onclick = () => { _sel = null; el('k-target-ring').classList.add('k-hidden'); endTurn(); };
  const pileBtn = (id, which) => {
    const n = el(id); if (!n) return;
    n.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); openPile(which); });
  };
  pileBtn('k-deck-btn', 'deck');
  pileBtn('k-disc-btn', 'discard');
  const kz = el('k-kizuna');
  if (kz) kz.addEventListener('click', (e) => { e.stopPropagation(); allOut(); });
  // MOVE IS A PLACE YOU PUT SOMEONE. Grabbing a hero raises the two rows out
  // of the ground; you carry them to one and let go. The old version was a
  // blind 44px threshold with nothing on screen to say a threshold existed.
  document.querySelectorAll('.k-hero').forEach(h => {
    let sx = 0, sy = 0, live = false, legal = false;
    const rows = () => document.querySelectorAll('#k-rows .k-row');
    h.addEventListener('pointerdown', (e) => {
      if (!C) return;
      const who = h.dataset.hero;
      sx = e.clientX; sy = e.clientY; live = true;
      const why = moveReason(who);
      legal = !why;
      el('k-stage').classList.add('k-moving');
      el('k-stage').classList.toggle('k-moving-no', !legal);
      moveHint(who, legal ? 'MOVE \u00b7 ' + MOVE_COST + ' AP' : why.toUpperCase(), legal);
      rows().forEach(r => r.classList.toggle('k-row-here', r.dataset.row === C.heroes[who].row));
      try { h.setPointerCapture(e.pointerId); } catch (_) {}
    });
    h.addEventListener('pointermove', (e) => {
      if (!live) return;
      if (Math.hypot(e.clientX - sx, e.clientY - sy) > 6) h.classList.add('k-hero-drag');
      const here = C.heroes[h.dataset.hero].row;
      const want = legal ? rowTargetAt(e.clientX, e.clientY) : null;
      rows().forEach(r => r.classList.toggle('k-row-hot',
        !!want && r.dataset.row === want && want !== here));
      // THE FIGURE PREVIEWS THE DESTINATION rather than being glued to the
      // finger. A hero is a tall sprite: dragging one by the chest sends the
      // body the opposite way from the row being aimed at, and the eye
      // believes the body. The hero already standing there previews the TRADE,
      // so the swap is visible before you commit to it rather than after.
      const occupant = want && Object.keys(C.heroes)
        .find(id => id !== h.dataset.hero && C.heroes[id].row === want);
      document.querySelectorAll('.k-hero').forEach(o => {
        const isSelf = o === h;
        for (const r of ROWS) {
          o.classList.toggle('k-prev-' + r,
            (isSelf && want === r) || (!isSelf && o.dataset.hero === occupant && here === r));
        }
      });
      moveHint(h.dataset.hero, null, legal);      // the price rides with them
    });
    const up = (e) => {
      if (!live) return;
      live = false;
      h.classList.remove('k-hero-drag');
      document.querySelectorAll('.k-hero').forEach(o =>
        o.classList.remove('k-prev-front', 'k-prev-mid', 'k-prev-back'));
      el('k-stage').classList.remove('k-moving', 'k-moving-no');
      moveHint(null);
      rows().forEach(r => r.classList.remove('k-row-hot', 'k-row-here'));
      if (!legal) return;
      const want = rowTargetAt(e.clientX, e.clientY);
      if (want) moveHero(h.dataset.hero, want);
    };
    h.addEventListener('pointerup', up);
    h.addEventListener('pointercancel', up);
  });
  // NO CALLOUT, ANYWHERE. The guard used to live on the card button alone, so a
  // long press on a hero, the Regent or the painted plate still raised iOS's
  // Copy / Save Image sheet — every one of those is an <img>, which is exactly
  // what iOS offers to save.
  el('k-stage').addEventListener('contextmenu', (e) => e.preventDefault());
  el('k-stage').addEventListener('selectstart', (e) => e.preventDefault());
  el('k-stage').addEventListener('dragstart', (e) => e.preventDefault());
  el('k-stage').addEventListener('pointerdown', (e) => {
    if (_focus) { closeInspect(); return; }
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
  evaluateCard, playCard, moveHero, moveReason, rowTargetAt, cycleCard, pickDiscard,
  allOut: () => allOut(),
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
  parryGrade, readString, dirOK, dropTargetAt, openPile, currentIntent, intentPreviewDmg, intentTargetId, dirgeAmount,
  tune(t) { Object.assign(TUNE, t || {}); return TUNE; },
};
