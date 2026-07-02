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
//    burns into the hand, keyed to the CLASS composition of the trio.
//    All ten triangles of the five-hero roster have distinct resonants
//    across four families: Offense / Defense / Formation / Utility.
//  · BUILD 2 adds: drag-to-play, the DESCENT (a node map after the tutorial
//    chapters), recruits (Cassia the Guardian, Hask the Mage), camps, and
//    party composition — your chosen trio decides which resonant exists.
// ============================================================================

'use strict';

const V2_BUILD = 8;
const $ = (sel) => document.querySelector(sel);

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
  document.addEventListener('pointerdown', () => { const c = ac(); if (c && c.state === 'suspended') c.resume(); }, { capture: true });
  function tone(freq, dur, type, vol, delay, slideTo) {
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
    triad:   () => { [440, 554, 659, 880].forEach((f, i) => tone(f, 0.7, 'sine', 0.05, i * 0.09)); },
    victory: () => { [523, 659, 784].forEach((f, i) => tone(f, 0.25, 'triangle', 0.05, i * 0.11)); },
    enemy:   () => tone(220, 0.09, 'square', 0.04, 0, 180),
    follow:  () => { tone(500, 0.07, 'triangle', 0.05); tone(750, 0.1, 'triangle', 0.05, 0.06); },
  };
})();

// ---------------------------------------------------------------------------
// DATA — heroes.
// ---------------------------------------------------------------------------
const ROWS = ['front', 'mid', 'back'];
const ROW_LABEL = { front: 'FRONT', mid: 'MID', back: 'BACK' };
const STANCE = {
  front: { name: 'Blade Stance', tag: 'AGGRESSIVE' },
  mid:   { name: 'Flow Stance',  tag: 'BALANCED' },
  back:  { name: 'Wind Stance',  tag: 'RANGED' },
};

const HEROES = {
  ash: {
    name: 'ASH', cls: 'Ronin', tint: 'var(--ash-tint)', maxHp: 32,
    cards: {
      front: {
        core: { name: 'Cleave',        cost: 1, target: 'frontmost', fx: { dmg: 6 },            desc: '6 damage to the nearest enemy.' },
        sig:  { name: 'Crashing Wave', cost: 2, target: 'frontmost', fx: { dmg: 11 },           desc: '11 damage to the nearest enemy.' },
      },
      mid: {
        core: { name: 'Flowing Cut',   cost: 1, target: 'frontmost', fx: { dmg: 4, guard: 3 },  desc: '4 damage · gain 3 guard.' },
        sig:  { name: 'Crossguard',    cost: 2, target: 'ally',      fx: { guard: 5, counter: 3 }, desc: 'Stand for an ally: they gain 5 guard · counter attackers for 3 this round.' },
      },
      back: {
        core: { name: 'Thrown Edge',   cost: 1, target: 'enemy',     fx: { dmg: 4 },            desc: '4 damage to ANY enemy.' },
        sig:  { name: 'Marked Fate',   cost: 2, target: 'enemy',     fx: { dmg: 3, mark: 3 },   desc: '3 damage · EXPOSED: enemy takes +3 from EVERY hit this round.' },
      },
    },
  },
  elin: {
    name: 'ELIN', cls: 'Cleric', tint: 'var(--elin-tint)', maxHp: 24,
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
    name: 'KIKI', cls: 'Bard', tint: 'var(--kiki-tint)', maxHp: 20,
    cards: {
      front: {
        core: { name: 'Sharp Note',    cost: 1, target: 'frontmost', fx: { dmg: 3, lull: 1 },   desc: '3 damage · CHILL: enemy deals −1 next attack.' },
        sig:  { name: 'Discord',       cost: 2, target: 'enemy',     fx: { dmg: 5, lull: 2 },   desc: '5 damage to ANY enemy · CHILL −2.' },
      },
      mid: {
        core: { name: 'Inspire',       cost: 1, target: 'ally',      fx: { buffDmg: 3 },        desc: 'RALLY: an ally’s next damaging card deals +3.' },
        sig:  { name: 'Battle Hymn',   cost: 2, target: 'allies',    fx: { buffDmg: 2 },        desc: 'RALLY: every ally’s next damaging card deals +2.' },
      },
      back: {
        core: { name: 'Lullaby',       cost: 1, target: 'enemy',     fx: { lull: 2 },           desc: 'CHILL: an enemy deals −2 on its next attack.' },
        sig:  { name: 'Crescendo',     cost: 2, target: 'ally',      fx: { buffDmg: 5 },        desc: 'RALLY: an ally’s next damaging card deals +5.' },
      },
    },
  },
  cassia: {
    name: 'CASSIA', cls: 'Guardian', tint: 'var(--cassia-tint)', maxHp: 34,
    cards: {
      front: {
        core: { name: 'Shield Bash',   cost: 1, target: 'frontmost', fx: { dmg: 4, guard: 2 },  desc: '4 damage · gain 2 guard.' },
        sig:  { name: 'Held Gate',     cost: 2, target: 'self',      fx: { guard: 9, counter: 3 }, desc: 'Gain 9 guard · counter attackers for 3 this round.' },
      },
      mid: {
        core: { name: 'Cover',         cost: 1, target: 'ally',      fx: { guard: 4 },          desc: 'An ally gains 4 guard.' },
        sig:  { name: 'Rampart',       cost: 2, target: 'allies',    fx: { guard: 3 },          desc: 'Every ally gains 3 guard.' },
      },
      back: {
        core: { name: 'Thrown Shield', cost: 1, target: 'enemy',     fx: { dmg: 3, lull: 1 },   desc: '3 damage to ANY enemy · CHILL −1.' },
        sig:  { name: 'Fortress Vow',  cost: 2, target: 'ally',      fx: { guard: 5, counter: 3 }, desc: 'An ally gains 5 guard · they counter for 3 this round.' },
      },
    },
  },
  hask: {
    name: 'HASK', cls: 'Mage', tint: 'var(--hask-tint)', maxHp: 22,
    cards: {
      front: {
        core: { name: 'Frost Touch',   cost: 1, target: 'frontmost', fx: { dmg: 4, lull: 1 },   desc: '4 frost damage · CHILL −1.' },
        sig:  { name: 'Shatter',       cost: 2, target: 'frontmost', fx: { dmg: 9 },            desc: '9 frost damage to the nearest enemy.' },
      },
      mid: {
        core: { name: 'Ice Bolt',      cost: 1, target: 'enemy',     fx: { dmg: 4 },            desc: '4 frost damage to ANY enemy.' },
        sig:  { name: 'Chill Ward',    cost: 2, target: 'ally',      fx: { guard: 4, counter: 2 }, desc: 'An ally gains 4 guard · they counter for 2 this round.' },
      },
      back: {
        core: { name: 'Deep Freeze',   cost: 1, target: 'enemy',     fx: { dmg: 5 },            desc: '5 frost damage to ANY enemy.' },
        sig:  { name: 'Hasten',        cost: 2, target: 'ally',      fx: { buffDmg: 4 },        desc: 'RALLY: an ally’s next damaging card deals +4.' },
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
    name: 'HOLLOW HUSK', maxHp: 18,
    intents: [
      { name: 'Claw',  dmg: 4, row: 'front' },
      { name: 'Lurch', dmg: 3, row: 'mid' },
      { name: 'Wither', kind: 'buff', desc: 'hardens', guardSelf: 3 },
    ],
  },
  wraith: {
    name: 'PALE WRAITH', maxHp: 16,
    intents: [
      { name: 'Grasp Beyond', dmg: 5, row: 'back' },
      { name: 'Chill Wail',   dmg: 2, row: 'all' },
      { name: 'Drift',        dmg: 4, row: 'mid' },
    ],
  },
  cultist: {
    name: 'ASH CULTIST', maxHp: 15,
    intents: [
      { name: 'Sacrificial Knife', dmg: 5, row: 'front' },
      { name: 'Blood Chant', kind: 'buff', desc: 'gathers power', powerSelf: 2 },
      { name: 'Hollow Verse', dmg: 4, row: 'mid' },
    ],
  },
  mourner: {
    name: 'GRAVE MOURNER', maxHp: 18,
    intents: [
      { name: 'Dirge',     dmg: 3, row: 'all' },
      { name: 'Sorrowing', dmg: 5, row: 'mid' },
      { name: 'Keening', kind: 'buff', desc: 'keens louder', powerSelf: 2 },
    ],
  },
  drone: {
    name: 'HOLLOW DRONE', maxHp: 20,
    intents: [
      { name: 'Refrain',  dmg: 5, row: 'front' },
      { name: 'Dull Hum', dmg: 3, row: 'all' },
      { name: 'Harden', kind: 'buff', desc: 'hardens', guardSelf: 4 },
    ],
  },
  echoknight: {
    name: 'THE ECHO KNIGHT', maxHp: 42, boss: true,
    intents: [
      { name: 'Returning Stroke', dmg: 6, row: 'front' },
      { name: 'Echoed Arc',       dmg: 4, row: 'mid' },
      { name: 'Remembered Blade', dmg: 5, row: 'back' },
      { name: 'OBLIVION ECHO',    dmg: 8, row: 'all', heavy: true },
    ],
  },
  echoknight2: {
    name: 'THE ECHO KNIGHT, REMEMBERED', maxHp: 60, boss: true, art: 'echoknight',
    intents: [
      { name: 'Returning Stroke', dmg: 7, row: 'front' },
      { name: 'Gathers the Echo', kind: 'buff', desc: 'the echo swells', powerSelf: 2 },
      { name: 'Echoed Arc',       dmg: 5, row: 'mid' },
      { name: 'Remembered Blade', dmg: 6, row: 'back' },
      { name: 'OBLIVION ECHO',    dmg: 9, row: 'all', heavy: true },
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
};
const RESONANT_FALLBACK = {
  name: 'Triad Strike', type: 'Offense',
  desc: 'The three strike as one: 6 damage to every enemy.',
  stages: [{ text: 'the triad strikes as one', fx: { aoeDmg: 6 } }],
};

// ---------------------------------------------------------------------------
// DATA — the tutorial chapters (unchanged), then THE DESCENT map.
// ---------------------------------------------------------------------------
const FLOW = [
  { type: 'story', chapter: 1, title: 'ONE SURVIVOR', eyebrow: 'CHAPTER 1', lines: [
    { text: 'The first thing you understand is that everyone else is gone.' },
    { spk: 'ASH', text: '...then I carry it alone.' },
    { text: 'You are <b>Ash</b>. One blade, three ways to hold it. Your <b>row is your stance</b> — Front cuts, Mid flows, Back strikes from the wind. <b>Drag Ash himself</b> to another row and watch his cards transform.' },
  ]},
  { type: 'fight', chapter: 1, heroes: ['ash'], enemies: ['husk'],
    narrator: 'Tap or drag a card to play it. DRAG ASH HIMSELF to change rows (1 EP).' },
  { type: 'story', chapter: 1, title: 'THE STANCES', eyebrow: 'CHAPTER 1', lines: [
    { text: 'More of them ahead. Watch what each enemy <b>telegraphs</b>: the damage, and the <b>row</b> it will strike.' },
    { spk: 'ASH', text: 'If the blow falls on FRONT... I simply won’t be there.' },
    { text: '<b>Drag yourself</b> to another row to dodge. An attack on an empty row hits nothing.' },
  ]},
  { type: 'fight', chapter: 1, heroes: ['ash'], enemies: ['husk', 'wraith'],
    narrator: 'Dodge by standing elsewhere. The row they call is the row they strike.' },
  { type: 'story', chapter: 2, title: 'ELIN', eyebrow: 'CHAPTER 2 · TWO', lines: [
    { text: 'A light in the ash-fog. A healer, kneeling over what’s left of her order.' },
    { spk: 'ELIN', text: 'You’re bleeding. Stand still.' },
    { spk: 'ASH', text: '...you’re coming with me.' },
    { text: 'Two now. Drag a hero onto an ally to <b>swap</b> rows. And watch what happens when one of you <b>helps</b> the other.' },
  ]},
  { type: 'fight', chapter: 2, heroes: ['ash', 'elin'], enemies: ['cultist', 'husk'],
    narrator: 'When Elin heals Ash, something forms between them. Watch.' },
  { type: 'story', chapter: 3, title: 'KIKI', eyebrow: 'CHAPTER 3 · THREE', lines: [
    { text: 'Someone is singing. In this place. Singing.' },
    { spk: 'KIKI', text: 'Oh good, an audience! Try to die interestingly, at least.' },
    { text: 'Three now. Threads can close into something greater. No one will tell you how. You’ll know it when it happens.' },
  ]},
  { type: 'fight', chapter: 3, heroes: ['ash', 'elin', 'kiki'], enemies: ['echoknight', 'cultist'],
    narrator: 'Help each other. All three of you.' },
  { type: 'story', chapter: 3, title: 'THE ROAD DOWN', eyebrow: 'THE DESCENT', lines: [
    { text: 'The tutorial road ends at a cliff’s edge, and below — the <b>Descent</b>.' },
    { text: 'Others survived. You’ll find them on the road, and every trio you form <b>resonates differently</b> — ten triangles, ten different vows.' },
    { spk: 'KIKI', text: 'New friends! Statistically some of them must like music.' },
  ], next: 'descent' },
];

// The Descent — a small node map.  Linear columns with occasional choices.
const MAP_NODES = [
  { id: 0, col: 1, type: 'fight',   label: 'ASHFALL ROAD',   enemies: ['husk', 'wraith'], next: [1] },
  { id: 1, col: 2, type: 'recruit', label: 'THE GATE HOLDS', hero: 'cassia', next: [2, 3] },
  { id: 2, col: 3, type: 'fight',   label: 'HOLLOW CHOIR',   enemies: ['cultist', 'mourner'], next: [4] },
  { id: 3, col: 3, type: 'fight',   label: 'MOURNING FIELD', enemies: ['mourner', 'drone'], next: [4] },
  { id: 4, col: 4, type: 'camp',    label: 'EMBER REST',     next: [5] },
  { id: 5, col: 5, type: 'recruit', label: 'THE FROSTLING',  hero: 'hask', next: [6, 7] },
  { id: 6, col: 6, type: 'fight',   label: 'DRONE NEST',     enemies: ['drone', 'husk', 'wraith'], next: [8] },
  { id: 7, col: 6, type: 'fight',   label: 'COLD PROCESSION',enemies: ['wraith', 'cultist', 'mourner'], next: [8] },
  { id: 8, col: 7, type: 'camp',    label: 'LAST FIRE',      next: [9] },
  { id: 9, col: 8, type: 'boss',    label: 'THE REMEMBERED', enemies: ['echoknight2', 'cultist'], next: [] },
];
const RECRUIT_LINES = {
  cassia: [
    { text: 'A knight holds a shattered gate alone, shield planted like a gravestone.' },
    { spk: 'CASSIA', text: 'If you’re walking down, you’ll want a wall that walks with you.' },
  ],
  hask: [
    { text: 'Frost patterns bloom across the stones. Something small and cold is waiting.' },
    { spk: 'HASK', text: 'You’re warm. Stand near me and I’ll forgive the noise.' },
  ],
};

// ---------------------------------------------------------------------------
// STATE
// ---------------------------------------------------------------------------
let S = null;               // battle state
let flowIdx = 0;
let RUN = null;             // descent run state
let targeting = null;       // { card, validIds, drag? } while picking a target
const PROGRESS_KEY = 'kizuna2.flow';
const RUN_KEY = 'kizuna2.run';
const UNLOCK_KEY = 'kizuna.unlocked';

function newRun() {
  return {
    roster: ['ash', 'elin', 'kiki'],
    active: ['ash', 'elin', 'kiki'],
    hp: { ash: HEROES.ash.maxHp, elin: HEROES.elin.maxHp, kiki: HEROES.kiki.maxHp },
    bonds: {},          // pairKey -> points; a pair at 2+ is KINDLED
    completed: [],
    done: false,
  };
}
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
  }));
  const enemies = node.enemies.map((id, i) => ({
    id, def: ENEMY_DEFS[id], uid: id + '#' + i,
    hp: ENEMY_DEFS[id].maxHp, maxHp: ENEMY_DEFS[id].maxHp,
    row: ['front', 'mid', 'back'][i] || 'mid',
    guard: 0, power: 0, mark: 0, lull: 0, intentIdx: 0, dead: false, acted: false,
  }));
  // Kindled bonds walk into battle already connected: the pair's thread is
  // pre-formed and the bond-guard applies from turn one.  The triad itself
  // still needs ONE act of help this fight to awaken (see addThread).
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
    triadFormed: false, resonantUsed: false, resonantNew: false,
    executing: false, over: false, turn: 1,
  };
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
  if (card.kind === 'move') return 'move';
  const fx = card.fx || {};
  if (fx.dmg) return 'attack';
  if (fx.guard || fx.counter) return 'guard';
  return 'skill';
}
function buildHand() {
  // 1 Core + 1 Signature per hero.  Movement is not a card — you drag the
  // hero.  When the triad forms, the resonant card doesn't ADD to the hand:
  // it HIJACKS the closing helper's signature slot (the card evolves).
  // Played cards LEAVE the fan (they return next turn) — what remains is
  // exactly what you can still do.
  const hand = [];
  const host = resonantHost();
  livingHeroes().forEach(h => {
    const set = h.def.cards[h.row];
    const core = mkCard(h, 'core', set.core);
    if (!core.spent) hand.push(core);
    if (host === h.id) hand.push(mkResonantCard(h));
    else { const sig = mkCard(h, 'sig', set.sig); if (!sig.spent) hand.push(sig); }
  });
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
  return { kind, owner: h.id, ownerName: h.def.name, tint: h.def.tint,
    stance: STANCE[h.row].name, name: def.name, cost: def.cost, target: def.target, fx: def.fx, desc: def.desc,
    spent: S.used.has(h.id + ':' + kind) };
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
  return { kind: 'resonant', owner: 'triad', ownerName: host ? host.def.name : 'THE TRIAD',
    tint: 'var(--gold-bright)',
    stance: 'TEMPORARY', name: r.name, cost: S.maxEp, target: 'none', fx: { resonant: true },
    desc: r.desc + '  Consumes your entire turn.  Temporary — this fight only.', spent: false };
}

// ---------------------------------------------------------------------------
// PLAY — tap or drag.
// ---------------------------------------------------------------------------
function onCardTap(card) {
  if (S.executing || S.over || card.spent) return;
  if (card.cost > S.ep) { flashNarrator('Not enough EP.'); return; }
  if (card.kind === 'resonant' && S.ep < S.maxEp) {
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
function attachDrag(el, card) {
  let startX = 0, startY = 0, dragging = false, pid = null;
  const scale = () => ($('#stage').getBoundingClientRect().width / 760) || 1;
  el.addEventListener('pointerdown', (e) => {
    if (S.executing || S.over || card.spent || card.cost > S.ep) return;
    pid = e.pointerId;
    startX = e.clientX; startY = e.clientY; dragging = false;
    try { el.setPointerCapture(pid); } catch (_) {}
    e.preventDefault();
  });
  el.addEventListener('pointermove', (e) => {
    if (pid === null) return;
    const dx = e.clientX - startX, dy = e.clientY - startY;
    if (!dragging) {
      if (Math.abs(dx) + Math.abs(dy) < 14) return;
      dragging = true;
      el.classList.add('card-dragging');
      const spec = targetSpec(card);
      if (card.kind === 'resonant' && S.ep < S.maxEp) { /* will be rejected on drop */ }
      enterTargeting(card, spec.pick ? spec.validIds : ['__field__'], spec.hint || 'Drop on the field', { drag: true });
    }
    el.style.transform = `translate(${dx / scale()}px, ${dy / scale()}px) translateY(-14px)`;
  });
  const finish = (e) => {
    if (pid === null) return;
    try { el.releasePointerCapture(pid); } catch (_) {}
    pid = null;
    if (!dragging) { targeting = null; $('#target-hint').classList.add('hidden'); onCardTap(card); return; }
    dragging = false;
    el.classList.remove('card-dragging');
    el.style.transform = '';
    const wasTargeting = targeting; targeting = null;
    $('#target-hint').classList.add('hidden');
    // What's under the release point?
    el.style.pointerEvents = 'none';
    const under = document.elementFromPoint(e.clientX, e.clientY);
    el.style.pointerEvents = '';
    const fig = under && under.closest ? under.closest('[data-fig]') : null;
    const slot = under && under.closest ? under.closest('.slot[data-row]') : null;
    const field = under && under.closest ? under.closest('#battlefield') : null;
    const spec = targetSpec(card);
    if (spec.pick && spec.isRow) {
      if (slot && spec.validIds.includes('row:' + slot.dataset.row)) { playCard(Object.assign({}, card, { toRow: slot.dataset.row }), null); return; }
    } else if (spec.pick) {
      if (fig && spec.validIds.includes(fig.dataset.fig)) { playCard(card, fig.dataset.fig); return; }
    } else if (field) {
      if (card.kind === 'resonant' && S.ep < S.maxEp) { flashNarrator('The Vow needs your ENTIRE turn — play it first.'); renderAll(); return; }
      playCard(card, null); return;
    }
    renderAll();  // cancelled — snap everything back
  };
  el.addEventListener('pointerup', finish);
  el.addEventListener('pointercancel', finish);
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
  requestAnimationFrame(() => {
    ghost.style.transition = 'transform 0.42s cubic-bezier(0.3, 0.9, 0.4, 1), opacity 0.42s ease';
    ghost.style.transform = `translate(${dx}px, ${dy}px) scale(0.28) rotate(4deg)`;
    ghost.style.opacity = '0';
  });
  setTimeout(() => ghost.remove(), 480);
}

async function playCard(card, targetId) {
  if (S.executing || S.over) return;
  S.executing = true;
  $('#stage').classList.add('executing');
  S.ep -= card.cost;
  if (card.owner !== 'triad') S.used.add(card.owner + ':' + card.kind);
  if (card.kind !== 'move') {
    SFX.card();
    flyCard(card.name, targetId ? figEl(targetId) : (card.target === 'frontmost' && frontmostEnemy() ? figEl(frontmostEnemy().uid) : null));
  } else { SFX.move(); }
  pulseEp();
  renderAll();
  await resolveCard(card, targetId);
  S.executing = false;
  $('#stage').classList.remove('executing');
  renderAll();
  checkEnd();
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
    // The position rewrite is the point — let the hand visibly morph.
    S._morphHeroId = owner.id;
    if (occupant) S._morphHeroId2 = occupant.id;
    renderAll();
    popupAt(figEl(owner.id), STANCE[card.toRow].name.toUpperCase(), 'info');
    if (occupant) popupAt(figEl(occupant.id), 'SWAP', 'info');
    await sleep(340);
    return;
  }

  if (card.kind === 'resonant') { await resolveResonant(); return; }

  const fx = card.fx || {};
  if (fx.dmg) {
    let tgt = null;
    if (card.target === 'frontmost') tgt = frontmostEnemy();
    else if (card.target === 'enemy') tgt = livingEnemies().find(e => e.uid === targetId) || frontmostEnemy();
    if (tgt) {
      let amt = fx.dmg + (owner ? owner.buffDmg : 0);
      if (owner && owner.buffDmg) { popupAt(figEl(owner.id), 'RALLY +' + owner.buffDmg, 'guard'); owner.buffDmg = 0; }
      amt += tgt.mark || 0;
      // FOLLOW-UP: striking an enemy an ally already hit this turn is a
      // combo — +2 damage, and fighting together forms a thread between
      // the two attackers (Concept 3: following up strengthens bonds).
      const hitters = tgt._hitBy || (tgt._hitBy = []);
      const prev = hitters.length ? hitters[hitters.length - 1] : null;
      const isFollowUp = !!(owner && prev && prev !== owner.id);
      if (isFollowUp) amt += 2;
      dealToEnemy(tgt, amt);
      if (owner) hitters.push(owner.id);
      if (isFollowUp) {
        popupAt(figEl(owner.id), 'FOLLOW-UP +2', 'info');
        SFX.follow();
        await addThread(owner.id, prev);
      }
      if (tgt.dead) await sleep(140);   // hitstop: let the kill land
    } else {
      flashNarrator('No target in reach — the cut finds only air.');
    }
  }
  if (fx.mark) {
    const tgt = livingEnemies().find(e => e.uid === targetId);
    if (tgt) { tgt.mark = fx.mark; popupAt(figEl(tgt.uid), 'EXPOSED +' + fx.mark, 'info'); }
  }
  if (fx.lull) {
    const tgt = card.target === 'enemy' ? (livingEnemies().find(e => e.uid === targetId) || frontmostEnemy()) : frontmostEnemy();
    if (tgt) { tgt.lull = (tgt.lull || 0) + fx.lull; popupAt(figEl(tgt.uid), 'CHILL −' + fx.lull, 'info'); }
  }
  if (fx.heal || fx.guard || fx.buffDmg || fx.counter) {
    let receivers = [];
    if (card.target === 'ally')   receivers = [S.heroes.find(h => h.id === targetId)].filter(Boolean);
    if (card.target === 'self')   receivers = [owner];
    if (card.target === 'allies') receivers = livingHeroes();
    if (card.target === 'frontmost' && fx.guard) receivers = [owner];
    for (const rc of receivers) {
      if (!rc || rc.downed) continue;
      if (fx.heal)   { rc.hp = Math.min(rc.maxHp, rc.hp + fx.heal); popupAt(figEl(rc.id), '+' + fx.heal, 'heal'); SFX.heal(); }
      if (fx.guard)  { rc.guard += fx.guard; popupAt(figEl(rc.id), '⛨ ' + fx.guard, 'guard'); SFX.guard(); }
      if (fx.buffDmg){ rc.buffDmg += fx.buffDmg; popupAt(figEl(rc.id), 'RALLY +' + fx.buffDmg, 'guard'); }
      if (fx.counter){ rc.counter = Math.max(rc.counter, fx.counter); }
      if (owner && rc.id !== owner.id && card.target === 'ally') await addThread(owner.id, rc.id);
    }
  }
  await sleep(280);
}

function dealToEnemy(e, amt) {
  let left = amt;
  if (e.guard > 0) { const g = Math.min(e.guard, left); e.guard -= g; left -= g; }
  e.hp = Math.max(0, e.hp - left);
  const big = amt >= 8;
  popupAt(figEl(e.uid), '−' + amt, 'dmg' + (big ? ' popup-big' : ''));
  shake(figEl(e.uid));
  SFX.hit(big);
  if (big) stageShake();
  if (e.hp === 0 && !e.dead) {
    e.dead = true;
    e._justDied = true;
    SFX.kill();
    stageShake();
    const el = figEl(e.uid);
    if (el) el.classList.add('fig-dying');
    setTimeout(() => { e._justDied = false; if (S && !S.over) renderAll(); }, 750);
  }
}
// Micro screen-shake for weighty moments.
function stageShake() {
  const st = $('#stage');
  st.classList.remove('stage-shake'); void st.offsetWidth; st.classList.add('stage-shake');
}
function pulseEp() {
  const dial = $('#ep-dial');
  if (!dial) return;
  dial.classList.remove('ep-pulse'); void dial.offsetWidth; dial.classList.add('ep-pulse');
}

async function addThread(a, b) {
  const key = pairKey(a, b);
  if (S.threads.has(key)) { await checkTriad(a); return; }   // kindled threads awaken on any help
  S.threads.add(key);
  renderThreads(key);
  SFX.thread();
  flashNarrator('A thread forms — ' + HEROES[a].name + ' ─ ' + HEROES[b].name);
  // The bond itself protects: both linked heroes steel by 2 guard the moment
  // the thread forms.  Kizuna has immediate tactical weight, not just
  // triad-progress bookkeeping.
  [a, b].forEach(id => {
    const h = S.heroes.find(x => x.id === id);
    if (h && !h.downed) { h.guard += 2; popupAt(figEl(id), 'BOND ⛨2', 'guard'); }
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
    <div class="triad-cardname">✦ ${r.name} — ${r.type}</div>
    <div class="ov-tap">${HEROES[S.resonantHostId] ? HEROES[S.resonantHostId].name + '’s signature transforms' : 'a card transforms'} · tap to continue</div>
  `, 'triad-ceremony');
  await new Promise(res => { $('#overlay').onclick = () => { $('#overlay').onclick = null; res(); }; });
  hideOverlay();
  $('#stage').classList.remove('frozen');
  S.resonantNew = true;
  renderAll();
}

async function resolveResonant() {
  const r = triadEntry();
  S.resonantUsed = true;
  for (const st of (r.stages || [])) {
    flashNarrator('✦ ' + st.text);
    const fx = st.fx || {};
    if (fx.aoeDmg) livingEnemies().forEach(e => dealToEnemy(e, fx.aoeDmg + (e.mark || 0)));
    if (fx.hitFrontmost) { const t = frontmostEnemy(); if (t) dealToEnemy(t, fx.hitFrontmost + (t.mark || 0)); }
    if (fx.healAll) livingHeroes().forEach(h => { h.hp = Math.min(h.maxHp, h.hp + fx.healAll); popupAt(figEl(h.id), '+' + fx.healAll, 'heal'); });
    if (fx.guardAll) livingHeroes().forEach(h => { h.guard += fx.guardAll; popupAt(figEl(h.id), '⛨ ' + fx.guardAll, 'guard'); });
    if (fx.guardFront) { const h = heroInRow('front'); if (h) { h.guard += fx.guardFront; popupAt(figEl(h.id), '⛨ ' + fx.guardFront, 'guard'); } }
    if (fx.buffAllDmg) livingHeroes().forEach(h => { h.buffDmg += fx.buffAllDmg; popupAt(figEl(h.id), '+' + fx.buffAllDmg + ' NEXT', 'guard'); });
    if (fx.counterAll) livingHeroes().forEach(h => { h.counter = Math.max(h.counter, fx.counterAll); });
    if (fx.lullAll) livingEnemies().forEach(e => { e.lull = (e.lull || 0) + fx.lullAll; popupAt(figEl(e.uid), '−' + fx.lullAll + ' ATK', 'info'); });
    if (fx.markAll) livingEnemies().forEach(e => { e.mark = fx.markAll; popupAt(figEl(e.uid), 'MARKED', 'info'); });
    if (fx.invulnFront) { const h = heroInRow('front'); if (h) { h.invuln = true; popupAt(figEl(h.id), 'INVULNERABLE', 'info'); } }
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
    await sleep(820);
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
    S.heroes.forEach(h => { h.guard = 0; h.counter = 0; h.invuln = false; });
    S.enemies.forEach(e => { e.mark = 0; e.acted = false; e._hitBy = []; });
    S.executing = false;
    $('#stage').classList.remove('executing');
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
  await sleep(620);
  for (const e of livingEnemies()) {
    if (S.over) break;
    const intent = e.def.intents[e.intentIdx % e.def.intents.length];
    e.intentIdx++;
    e.acted = true;
    renderTimeline();
    const lungeEl = figEl(e.uid);
    if (lungeEl && intent.kind !== 'buff') { lungeEl.classList.add('fig-lunge'); SFX.enemy(); }
    await sleep(400);
    if (intent.kind === 'buff') {
      if (intent.guardSelf) { e.guard += intent.guardSelf; popupAt(figEl(e.uid), '⛨ ' + intent.guardSelf, 'guard'); }
      if (intent.powerSelf) { e.power += intent.powerSelf; popupAt(figEl(e.uid), '+' + intent.powerSelf + ' ATK', 'info'); }
      renderAll();
      continue;
    }
    let dmg = Math.max(0, (intent.dmg || 0) + (e.power || 0) - (e.lull || 0));
    if (e.lull) e.lull = 0;
    const rows = intent.row === 'all' ? ROWS.slice() : [intent.row];
    let hitAny = false;
    for (const row of rows) {
      const h = heroInRow(row);
      if (!h) continue;
      hitAny = true;
      if (h.invuln) {
        popupAt(figEl(h.id), 'INVULNERABLE', 'info');
      } else {
        let left = dmg;
        if (h.guard > 0) { const g = Math.min(h.guard, left); h.guard -= g; left -= g; popupAt(figEl(h.id), '⛨', 'guard'); }
        if (left > 0) {
          h.hp = Math.max(0, h.hp - left);
          const big = left >= 7;
          popupAt(figEl(h.id), '−' + left, 'dmg' + (big ? ' popup-big' : ''));
          shake(figEl(h.id));
          SFX.hit(big);
          if (big) stageShake();
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
  const isBoss = S.node.enemies.some(id => ENEMY_DEFS[id].boss);
  SFX.victory();
  setTimeout(() => {
    if (S.node.mapId === 9) { onRunComplete(); return; }
    const th = S.threads.size;
    showOverlay(`
      <div class="ov-eyebrow" style="color:var(--gold-bright)">VICTORY</div>
      <div class="ov-title" style="font-size:22px">${isBoss ? 'THE ECHO FADES' : 'THE ROAD HOLDS'}</div>
      ${th ? `<div class="ov-sub">${th} thread${th > 1 ? 's' : ''} held${S.triadFormed ? ' · the triad answered' : ''}</div>` : ''}
      ${bondLines.length ? `<div class="bond-growth">${bondLines.map(l => `<span class="bg-line${/KINDLED/.test(l) ? ' bg-kindled' : ''}">♡ ${l}</span>`).join('')}</div>` : ''}
      <button class="ov-btn primary" id="ov-next">CONTINUE</button>
    `);
    $('#ov-next').onclick = () => { hideOverlay(); S.node.mapId != null ? showMap() : advanceFlow(); };
  }, 700);
}
function onDefeat() {
  setTimeout(() => {
    showOverlay(`
      <div class="ov-eyebrow">DEFEAT</div>
      <div class="ov-title" style="font-size:22px">THE THREAD FRAYS</div>
      <div class="ov-sub">but does not break</div>
      <button class="ov-btn primary" id="ov-retry">TRY AGAIN</button>
    `);
    $('#ov-retry').onclick = () => {
      hideOverlay();
      if (S.node.mapId != null) startMapFight(MAP_NODES[S.node.mapId]);
      else startFlowNode();
    };
  }, 700);
}
function onRunComplete() {
  RUN.done = true; saveRun();
  showOverlay(`
    <div class="ov-eyebrow" style="color:var(--gold-bright)">THE DESCENT · CLEARED</div>
    <div class="ov-title" style="font-size:26px">THE ECHO FADES</div>
    <div class="ov-lines" style="text-align:center; min-height:0;">
      <div class="ov-line">The Remembered Knight unremembers itself, one stroke at a time.</div>
      <div class="ov-line"><b>${RUN.roster.length} walked out of ${RUN.roster.length === 5 ? 'five' : RUN.roster.length}.</b>  Ten triangles wait for other trios, other descents.</div>
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
        ? `<button class="ov-btn primary" id="ov-go">${node.next === 'descent' ? 'BEGIN THE DESCENT' : (FLOW[flowIdx + 1] && FLOW[flowIdx + 1].type === 'fight' ? 'TO BATTLE' : 'CONTINUE')}</button>`
        : `<div class="ov-tap">tap to continue ▸</div>`}
    `);
    if (done) {
      $('#ov-go').onclick = (ev) => {
        ev.stopPropagation();
        hideOverlay();
        if (node.next === 'descent') startDescent();
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
  return MAP_NODES.some(p => RUN.completed.includes(p.id) && p.next.includes(n.id));
}
function showMap() {
  S = null;
  $('#chapter-chip').textContent = 'DESCENT';
  $('#timeline').innerHTML = '';
  const cols = {};
  MAP_NODES.forEach(n => { (cols[n.col] = cols[n.col] || []).push(n); });
  const glyph = { fight: '⚔', recruit: '☉', camp: '⌂', boss: '☠' };
  const colHtml = Object.keys(cols).sort((a, b) => a - b).map(c => `
    <div class="map-col">
      ${cols[c].map(n => {
        const done = RUN.completed.includes(n.id);
        const reach = nodeReachable(n);
        return `<button class="map-node mn-${n.type}${done ? ' mn-done' : ''}${reach ? ' mn-reach' : ''}"
          data-node="${n.id}" ${reach ? '' : 'disabled'}>
          <span class="mn-glyph">${done ? '✓' : glyph[n.type]}</span>
          <span class="mn-label">${n.label}</span>
        </button>`;
      }).join('')}
    </div>`).join('<div class="map-arrow">›</div>');
  const trio = RUN.active.map(id => `<span class="party-chip-fig">${V2PORTRAITS[id] || ''}</span>`).join('');
  const r = triadEntryFor(RUN.active);
  showOverlay(`
    <div class="ov-eyebrow">THE DESCENT</div>
    <div class="ov-title" style="font-size:20px; margin-bottom:14px;">CHOOSE THE ROAD</div>
    <div class="map-strip">${colHtml}</div>
    <button class="party-chip" id="map-party">
      ${trio}
      <span class="party-chip-meta">PARTY · resonates as <b>✦ ${r.name}</b> <i>(${r.type})</i></span>
    </button>
  `, 'map-screen');
  document.querySelectorAll('.map-node.mn-reach').forEach(el => {
    el.onclick = () => enterMapNode(MAP_NODES[+el.dataset.node]);
  });
  $('#map-party').onclick = () => showPartySelect(() => showMap());
}
function enterMapNode(n) {
  hideOverlay();
  if (n.type === 'fight' || n.type === 'boss') startMapFight(n);
  else if (n.type === 'recruit') showRecruit(n);
  else if (n.type === 'camp') showCamp(n);
}
function startMapFight(n) {
  startFight({ type: 'fight', chapter: 3, heroes: RUN.active.slice(), enemies: n.enemies.slice(),
    useRunHp: true, mapId: n.id, narrator: n.label + (n.type === 'boss' ? ' — it remembers you.' : '') });
  $('#chapter-chip').textContent = n.type === 'boss' ? 'BOSS' : 'DESCENT';
}
function showRecruit(n) {
  const h = HEROES[n.hero];
  const lines = (RECRUIT_LINES[n.hero] || []).map(l =>
    `<div class="ov-line">${l.spk ? `<span class="spk">${l.spk}</span>` : ''}${l.text}</div>`).join('');
  showOverlay(`
    <div class="ov-eyebrow">A NEW THREAD</div>
    <div class="ov-title" style="font-size:22px">${h.name} — ${h.cls.toUpperCase()}</div>
    <div class="recruit-fig">${V2PORTRAITS[n.hero] || ''}</div>
    <div class="ov-lines" style="min-height:0">${lines}</div>
    <button class="ov-btn primary" id="rc-join">${h.name} JOINS</button>
  `);
  $('#rc-join').onclick = () => {
    if (!RUN.roster.includes(n.hero)) RUN.roster.push(n.hero);
    RUN.hp[n.hero] = h.maxHp;
    if (!RUN.completed.includes(n.id)) RUN.completed.push(n.id);
    saveRun();
    // A bigger roster than 3 means composition is now a choice.
    if (RUN.roster.length > 3) showPartySelect(() => showMap(), n.hero);
    else showMap();
  };
}
function showCamp(n) {
  RUN.roster.forEach(id => { RUN.hp[id] = HEROES[id].maxHp; });
  if (!RUN.completed.includes(n.id)) RUN.completed.push(n.id);
  saveRun();
  showOverlay(`
    <div class="ov-eyebrow" style="color:var(--gold-bright)">CAMPFIRE</div>
    <div class="ov-title" style="font-size:22px">${n.label}</div>
    <div class="ov-lines" style="text-align:center; min-height:0">
      <div class="ov-line">The fire holds back the dark a while. <b>Every wound closes.</b></div>
      <div class="ov-line">Around it, the party re-forms — choose who walks the next stretch.</div>
    </div>
    <button class="ov-btn primary" id="camp-party">CHOOSE THE TRIO</button>
  `);
  $('#camp-party').onclick = () => showPartySelect(() => showMap());
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
        <span class="ps-cls">${h.cls} · ${RUN.hp[id] ?? h.maxHp}/${h.maxHp}</span>
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

function renderAll() {
  if (!S) return;
  renderTimeline();
  renderBattlefield();
  renderThreads();
  renderActionBar();
}

function renderTimeline() {
  const tl = $('#timeline');
  if (!S) { tl.innerHTML = ''; return; }
  const bits = [];
  livingHeroes().forEach(h => {
    bits.push(`<div class="tl-diamond tl-hero"><div class="tl-art">${V2PORTRAITS[h.id] || ''}</div></div>`);
  });
  bits.push(`<div class="tl-turn"><span>${S.turn}</span></div>`);
  livingEnemies().forEach(e => {
    bits.push(`<div class="tl-diamond tl-enemy${e.acted ? ' tl-acted' : ''}"><div class="tl-art">${enemyArt(e)}</div></div>`);
  });
  tl.innerHTML = bits.join('');
}

function renderBattlefield() {
  const telegraphed = new Set();
  livingEnemies().forEach(e => {
    const it = e.def.intents[e.intentIdx % e.def.intents.length];
    if (it.row === 'all') ROWS.forEach(r => telegraphed.add(r));
    else if (it.row) telegraphed.add(it.row);
  });

  const party = $('#party-half');
  party.innerHTML = '';
  ['back', 'mid', 'front'].forEach(row => {
    const slot = document.createElement('div');
    slot.className = 'slot' + (telegraphed.has(row) ? ' slot-telegraphed' : '');
    slot.dataset.row = row;
    const h = S.heroes.find(x => x.row === row && !x.downed);
    const downedHere = S.heroes.find(x => x.row === row && x.downed);
    slot.innerHTML = `<span class="slot-ring"></span>`;
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
        <div class="fig-art">${V2PORTRAITS[who.id] || ''}</div>
        <div class="fig-chips">
          ${who.invuln ? `<span class="chip buff">✦ INVULN</span>` : ''}
          ${who.guard ? `<span class="chip guard">⛨ ${who.guard}</span>` : ''}
          ${who.buffDmg ? `<span class="chip buff">+${who.buffDmg}</span>` : ''}
          ${who.counter ? `<span class="chip counter">↺ ${who.counter}</span>` : ''}
        </div>
        <div class="hp-bar"><div class="hp-fill" style="width:${(who.hp / who.maxHp) * 100}%"></div></div>
        <div class="fig-name">${who.def.name} <span class="hp-num">${who.hp}/${who.maxHp}</span></div>
      `;
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
  ['front', 'mid', 'back'].forEach(row => {
    const slot = document.createElement('div');
    slot.className = 'slot';
    slot.dataset.row = row;
    const e = S.enemies.find(x => x.row === row && (!x.dead || x._justDied));
    if (e) {
      const it = e.def.intents[e.intentIdx % e.def.intents.length];
      const fig = document.createElement('div');
      fig.className = 'figure enemy' + (e._justDied ? ' fig-dying' : '');
      fig.dataset.fig = e.uid;
      const targetable = targeting && !targeting.isRow && targeting.validIds.includes(e.uid);
      if (targetable) fig.classList.add('fig-targetable');
      const intentHtml = it.kind === 'buff'
        ? `<div class="intent intent-buff"><span>◈</span><span class="i-row">${it.desc || 'gathers'}</span></div>`
        : `<div class="intent${it.heavy ? ' intent-heavy' : ''}"><span>⚔</span><span class="i-dmg">${Math.max(0, (it.dmg || 0) + (e.power || 0) - (e.lull || 0))}</span><span class="i-row">→ ${it.row === 'all' ? 'ALL' : ROW_LABEL[it.row]}</span></div>`;
      fig.innerHTML = `
        ${intentHtml}
        <div class="fig-art">${enemyArt(e)}</div>
        <div class="fig-chips">
          ${e.guard ? `<span class="chip guard">⛨ ${e.guard}</span>` : ''}
          ${e.power ? `<span class="chip buff">+${e.power}</span>` : ''}
          ${e.mark ? `<span class="chip mark">✕ ${e.mark}</span>` : ''}
        </div>
        <div class="hp-bar"><div class="hp-fill" style="width:${(e.hp / e.maxHp) * 100}%"></div></div>
        <div class="fig-name">${e.def.name} <span class="hp-num">${e.hp}/${e.maxHp}</span></div>
      `;
      fig.onclick = () => onFigureTap(e.uid);
      slot.appendChild(fig);
    }
    enemyHalf.appendChild(slot);
  });
}

function renderThreads(newKey) {
  const svg = $('#thread-layer');
  svg.innerHTML = '';
  if (!S || S.node.chapter < 2) return;
  const stageR = $('#stage').getBoundingClientRect();
  const scale = stageR.width / 760;
  S.threads.forEach(key => {
    const [a, b] = key.split('|');
    const ea = figEl(a), eb = figEl(b);
    if (!ea || !eb) return;
    const ra = ea.getBoundingClientRect(), rb = eb.getBoundingClientRect();
    const bf = $('#battlefield').getBoundingClientRect();
    const x1 = (ra.left + ra.width / 2 - bf.left) / scale;
    const y1 = (ra.top + ra.height * 0.45 - bf.top) / scale;
    const x2 = (rb.left + rb.width / 2 - bf.left) / scale;
    const y2 = (rb.top + rb.height * 0.45 - bf.top) / scale;
    const midY = Math.min(y1, y2) - 22;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M ${x1} ${y1} Q ${(x1 + x2) / 2} ${midY} ${x2} ${y2}`);
    path.setAttribute('class', 'thread-line' + (key === newKey ? ' thread-new' : ''));
    svg.appendChild(path);
  });
  // Ghost the MISSING links once the first thread exists: the player sees
  // the triangle taking shape and exactly which bond is still unformed.
  const live = livingHeroes();
  if (S.threads.size > 0 && !S.triadFormed && live.length >= 3) {
    const ids = live.map(h => h.id);
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const k = pairKey(ids[i], ids[j]);
      if (S.threads.has(k)) continue;
      const ea = figEl(ids[i]), eb = figEl(ids[j]);
      if (!ea || !eb) continue;
      const ra = ea.getBoundingClientRect(), rb = eb.getBoundingClientRect();
      const bf = $('#battlefield').getBoundingClientRect();
      const x1 = (ra.left + ra.width / 2 - bf.left) / scale, y1 = (ra.top + ra.height * 0.45 - bf.top) / scale;
      const x2 = (rb.left + rb.width / 2 - bf.left) / scale, y2 = (rb.top + rb.height * 0.45 - bf.top) / scale;
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      g.setAttribute('d', `M ${x1} ${y1} Q ${(x1 + x2) / 2} ${Math.min(y1, y2) - 22} ${x2} ${y2}`);
      g.setAttribute('class', 'thread-line thread-ghost');
      svg.appendChild(g);
    }
  }
}

function renderActionBar() {
  $('#ep-num').textContent = S.ep;
  $('#ep-max').textContent = '/' + S.maxEp;
  $('#btn-endturn').disabled = S.executing || S.over;
  // When nothing is playable, softly pulse END TURN so the next step is obvious.
  const anyPlayable = buildHand().some(c => !c.spent && c.cost <= S.ep)
    || livingHeroes().some(h => canMove(h));
  $('#btn-endturn').classList.toggle('et-nudge', !S.executing && !S.over && !anyPlayable);

  const handEl = $('#hand');
  handEl.innerHTML = '';
  if (S.over) return;
  const TYPE_LABEL = { attack: '✕ ATTACK', guard: '⛨ GUARD', skill: '✦ SKILL', move: '⇄ MOVE',
    resonant: '✦ RESONANCE · ' + (triadEntry().type || '').toUpperCase() };
  buildHand().forEach(card => {
    const type = cardType(card);
    const el = document.createElement('div');
    el.className = `card kind-${card.kind}`
      + (card.spent ? ' card-spent' : (card.cost > S.ep ? ' disabled' : ''));
    if (card.kind === 'resonant' && S.resonantNew) el.classList.add('card-burn-in');
    el.style.setProperty('--tint', card.tint);
    el.dataset.owner = card.owner;
    el.dataset.cardName = card.name;
    el.dataset.target = card.target || 'none';
    el.dataset.kind = card.kind;
    el.innerHTML = `
      <div class="c-top">
        <span class="c-cost">${card.cost}</span>
        <span class="c-name">${card.name}</span>
      </div>
      <div class="c-type t-${type}">${TYPE_LABEL[type]}</div>
      <div class="c-desc">${card.desc}</div>
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
  requestAnimationFrame(() => {
    const kids = [...handEl.children];
    if (!kids.length) return;
    const avail = handEl.clientWidth;
    let total = 0;
    kids.forEach(k => { total += k.offsetWidth + 6; });
    const overlap = total > avail ? Math.min(86, (total - avail) / Math.max(1, kids.length - 1)) : 0;
    const mid = (kids.length - 1) / 2;
    kids.forEach((k, i) => {
      if (i > 0 && overlap) k.style.marginLeft = (-overlap) + 'px';
      k.style.zIndex = i + 1;
      const d = i - mid;
      k.style.transformOrigin = '50% 130%';
      k.style.setProperty('--fan-rot', (d * 3.4).toFixed(2) + 'deg');
      k.style.setProperty('--fan-y', (d * d * 2.4).toFixed(1) + 'px');
      if (morphIds.includes(k.dataset.owner)) k.classList.add('card-morph');
    });
  });
}

// ---------------------------------------------------------------------------
// FX helpers
// ---------------------------------------------------------------------------
function popupAt(el, text, cls) {
  if (!el) return;
  const layer = $('#popup-layer');
  const stageR = $('#stage').getBoundingClientRect();
  const scale = stageR.width / 760;
  const r = el.getBoundingClientRect();
  const p = document.createElement('div');
  p.className = 'popup ' + (cls || '');
  p.textContent = text;
  p.style.left = ((r.left + r.width / 2 - stageR.left) / scale) + 'px';
  p.style.top = ((r.top - stageR.top) / scale + 6) + 'px';
  layer.appendChild(p);
  setTimeout(() => p.remove(), 1050);
}
function shake(el) {
  if (!el) return;
  el.classList.remove('fig-hit'); void el.offsetWidth; el.classList.add('fig-hit');
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

function showTitle() {
  S = null;
  $('#timeline').innerHTML = '';
  $('#chapter-chip').textContent = 'KIZUNA';
  const savedFlow = parseInt(localStorage.getItem(PROGRESS_KEY) || '0', 10) || 0;
  const savedRun = loadRun();
  const canContinue = savedFlow > 0 || (savedRun && !savedRun.done);
  showOverlay(`
    <div class="ov-title">KIZUNA</div>
    <div class="ov-sub">THREADS · VERSION 2 PROTOTYPE</div>
    <div class="ov-line" style="text-align:center; max-width:440px; margin:0 auto 20px;">
      The party is the character. Cards are how three people talk;
      <b>the thread between them</b> is what you’re playing.
    </div>
    <button class="ov-btn primary" id="t-new">NEW GAME</button>
    ${canContinue ? `<button class="ov-btn" id="t-continue">CONTINUE</button>` : ''}
    <button class="ov-btn" id="t-descent">THE DESCENT</button>
    <div class="ov-hint">V2 BUILD ${V2_BUILD} · V1 LIVES AT THE ROOT URL</div>
  `);
  $('#t-new').onclick = () => {
    flowIdx = 0; RUN = null;
    try { localStorage.setItem(PROGRESS_KEY, '0'); localStorage.removeItem(RUN_KEY); } catch (_) {}
    startFlowNode();
  };
  const c = $('#t-continue');
  if (c) c.onclick = () => {
    const r = loadRun();
    if (r && !r.done) { RUN = r; showMap(); }
    else { flowIdx = Math.min(savedFlow, FLOW.length - 1); startFlowNode(); }
  };
  $('#t-descent').onclick = () => {
    const r = loadRun();
    RUN = (r && !r.done) ? r : newRun();
    saveRun();
    showMap();
  };
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
      if (!v || !(v.v2 > V2_BUILD)) return;
      if (document.getElementById('update-chip')) return;
      const chip = document.createElement('button');
      chip.id = 'update-chip';
      chip.textContent = '✦ UPDATE READY · BUILD ' + v.v2 + ' — TAP';
      chip.onclick = () => location.replace(location.pathname + '?u=' + v.v2);
      document.body.appendChild(chip);
    })
    .catch(() => {});
}
setInterval(checkForUpdate, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkForUpdate(); });
setTimeout(checkForUpdate, 2500);

fitStage();
let unlocked = false;
try { unlocked = localStorage.getItem(UNLOCK_KEY) === '1'; } catch (_) {}
if (unlocked) showTitle(); else showGate();
