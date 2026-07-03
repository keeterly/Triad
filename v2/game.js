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

const V2_BUILD = 27;
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
    deny:    () => { tone(150, 0.08, 'square', 0.05, 0, 110); tone(120, 0.1, 'square', 0.045, 0.06, 90); },
  };
})();

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
    school: 'blade', tempo: 'steady', name: 'ASH', cls: 'Ronin', tint: 'var(--ash-tint)', maxHp: 32,
    cards: {
      front: {
        core: { name: 'Cleave',        cost: 1, target: 'frontmost', fx: { dmg: 6 },            desc: '6 damage to the nearest enemy.' },
        sig:  { name: 'Crashing Wave', cost: 2, target: 'frontmost', fx: { dmg: 11 },           desc: '11 damage to the nearest enemy.' },
      },
      mid: {
        core: { name: 'Flowing Cut',   cost: 1, target: 'frontmost', fx: { dmg: 4, guard: 3 },  desc: '4 damage · gain 3 guard.' },
        sig:  { name: 'Crossguard',    cost: 2, target: 'ally',      fx: { guard: 5, counter: 3 }, desc: 'Stand for an ally: <span class="kw kw-guard">⛨ 5 guard</span> · <span class="kw kw-counter">↺ counter 3</span> this round.' },
      },
      back: {
        core: { name: 'Thrown Edge',   cost: 1, target: 'enemy',     fx: { dmg: 4, step: 'front' }, desc: '4 damage to ANY enemy, then close to FRONT.' },
        sig:  { name: 'Marked Fate',   cost: 1, target: 'enemy',     fx: { dmg: 3, mark: 4 },   desc: '3 damage · <span class="kw kw-exposed">◎ EXPOSED 4</span>: +4 from EVERY hit. Fades by 1 each turn.' },
      },
    },
  },
  elin: {
    school: 'light', tempo: 'steady', name: 'ELIN', cls: 'Cleric', tint: 'var(--elin-tint)', maxHp: 24,
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
    school: 'song', tempo: 'swift', name: 'KIKI', cls: 'Bard', tint: 'var(--kiki-tint)', maxHp: 20,
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
    tempo: 'heavy', school: 'iron', name: 'CASSIA', cls: 'Guardian', tint: 'var(--cassia-tint)', maxHp: 34,
    cards: {
      front: {
        core: { name: 'Shield Bash', cost: 1, target: 'frontmost', fx: { dmg: 4, guard: 2 }, desc: '4 damage · 2 guard.' },
        sig:  { name: 'Bulwark',     cost: 2, target: 'frontmost', fx: { dmg: 6, guard: 6 }, desc: '6 damage · gain 6 guard — an immovable wall.' },
      },
      mid: {
        core: { name: 'Cover', cost: 1, target: 'ally', fx: { guard: 4 }, desc: 'An ally gains 4 guard.' },
        sig:  { name: 'Aegis', cost: 2, target: 'ally', fx: { guard: 6, counter: 3 }, desc: 'Stand for an ally: <span class="kw kw-guard">⛨ 6</span> · <span class="kw kw-counter">↺ 3</span>.' },
      },
      back: {
        core: { name: 'Thrown Shield',  cost: 1, target: 'enemy', fx: { dmg: 3, lull: 1 }, desc: '3 damage · <span class="kw kw-chill">❄ CHILL</span> −1.' },
        sig:  { name: 'Sentinel Throw', cost: 2, target: 'enemy', fx: { dmg: 5, guard: 4 }, desc: '5 damage to ANY enemy · gain 4 guard.' },
      },
    },
  },
  hask: {
    school: 'frost', tempo: 'steady', name: 'HASK', cls: 'Mage', tint: 'var(--hask-tint)', maxHp: 22,
    cards: {
      front: {
        core: { name: 'Frost Touch',   cost: 1, target: 'frontmost', fx: { dmg: 4, lull: 1 },   desc: '4 frost damage · <span class="kw kw-chill">❄ CHILL</span> −1.' },
        sig:  { name: 'Shatter',       cost: 2, target: 'frontmost', fx: { dmg: 9 },            desc: '9 frost damage to the nearest enemy.' },
      },
      mid: {
        core: { name: 'Ice Bolt',      cost: 1, target: 'enemy',     fx: { dmg: 4 },            desc: '4 frost damage to ANY enemy.' },
        sig:  { name: 'Chill Ward',    cost: 2, target: 'ally',      fx: { guard: 4, counter: 2 }, desc: 'An ally gains <span class="kw kw-guard">⛨ 4 guard</span> · <span class="kw kw-counter">↺ counter 2</span>.' },
      },
      back: {
        core: { name: 'Deep Freeze',   cost: 1, target: 'enemy',     fx: { dmg: 5 },            desc: '5 frost damage to ANY enemy.' },
        sig:  { name: 'Hasten',        cost: 2, target: 'ally',      fx: { buffDmg: 6 },        desc: '<span class="kw kw-rally">▲ RALLY</span>: an ally’s next damaging card deals +6.' },
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
    weak: 'song', name: 'ASH CULTIST', maxHp: 15,
    intents: [
      { name: 'Sacrificial Knife', dmg: 5, row: 'front' },
      { name: 'Blood Chant', kind: 'buff', desc: 'gathers power', powerSelf: 2 },
      { name: 'Hollow Verse', dmg: 4, row: 'mid', expose: 2 },
    ],
  },
  mourner: {
    weak: 'frost', name: 'GRAVE MOURNER', maxHp: 18,
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
    weak: 'song', name: 'THE ECHO KNIGHT', maxHp: 42, boss: true,
    intents: [
      { name: 'Returning Stroke', dmg: 6, row: 'front' },
      { name: 'Echoed Arc',       dmg: 4, row: 'mid' },
      { name: 'Remembered Blade', dmg: 5, row: 'back' },
      { name: 'OBLIVION ECHO',    dmg: 8, row: 'all', heavy: true },
    ],
  },
  echoknight2: {
    weak: 'song', name: 'THE ECHO KNIGHT, REMEMBERED', maxHp: 60, boss: true, art: 'echoknight',
    intents: [
      { name: 'Returning Stroke', dmg: 7, row: 'front' },
      { name: 'Gathers the Echo', kind: 'buff', desc: 'the echo swells', powerSelf: 2 },
      { name: 'Echoed Arc',       dmg: 5, row: 'mid' },
      { name: 'Remembered Blade', dmg: 6, row: 'back', expose: 2 },
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
// One voice per hero — camp scenes pair the two least-bonded companions.
const CAMP_VOICES = {
  ash:    '…I don’t talk much. But I’d notice if you were gone.',
  elin:   'Hold still a moment. Even wounds no one can see want tending.',
  kiki:   'I’m writing a song about us, you know. You’re the difficult verse.',
  cassia: 'A wall is only as strong as who it shelters. Stand behind me tomorrow.',
  hask:   'You’re warm. Sit closer. That’s strategy, not sentiment.',
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
const ABYSS_KEY = 'kizuna2.abyss';   // nodeId -> memory of a fallen descent
function loadAbyss() { try { return JSON.parse(localStorage.getItem(ABYSS_KEY) || '{}'); } catch (_) { return {}; } }
function saveAbyss(a) { try { localStorage.setItem(ABYSS_KEY, JSON.stringify(a)); } catch (_) {} }
// Vow ranks — every time a class-triangle actually speaks its vow, the vow
// deepens.  PERSISTS ACROSS RUNS (and deaths): the trio remembers how to
// fight together.  1 use -> rank II, 3 uses -> rank III (+2 to the vow's
// numeric stages per rank above I).
const VOWS_KEY = 'kizuna2.vows';
function loadVows() { try { return JSON.parse(localStorage.getItem(VOWS_KEY) || '{}'); } catch (_) { return {}; } }
function vowUses(classKey) { return loadVows()[classKey] || 0; }
function vowRank(classKey) { const u = vowUses(classKey); return u >= 3 ? 3 : u >= 1 ? 2 : 1; }
function recordVow(classKey) {
  const v = loadVows(); v[classKey] = (v[classKey] || 0) + 1;
  try { localStorage.setItem(VOWS_KEY, JSON.stringify(v)); } catch (_) {}
}
const ROMAN = ['', 'I', 'II', 'III'];
function trioClassKey(ids) { return ids.map(id => HEROES[id].cls).sort().join('+'); }
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
    chill: 0, exposed: 0,
  }));
  const enemies = node.enemies.map((id, i) => ({
    id, def: ENEMY_DEFS[id], uid: id + '#' + i,
    hp: ENEMY_DEFS[id].maxHp, maxHp: ENEMY_DEFS[id].maxHp,
    row: ['front', 'mid', 'back'][i] || 'mid',
    guard: 0, power: 0, mark: 0, lull: 0, intentIdx: 0, dead: false, acted: false,
    weakRevealed: false, weakened: false, staggered: false,
  }));
  // DIFFICULTY — the tutorial (no useRunHp) stays a gentle on-ramp, but the
  // real run (the DESCENT) hits harder and RAMPS as you go deeper, so fights
  // stay threatening instead of being out-tempo'd.  dmgMul feeds the single
  // enemyIntentDmg() source of truth; non-boss HP scales up so foes survive to
  // act (no more turn-1 alpha wipes).  Bosses are already tuned high — they
  // take only a light damage ramp and keep their hand-set HP.
  if (node.useRunHp) {
    const depth = Math.max(1, node.depth || 1);
    enemies.forEach(e => {
      if (e.def.boss) {
        e.dmgMul = 1.15 + (depth - 1) * 0.02;
      } else {
        e.dmgMul = 1.4 + (depth - 1) * 0.05;
        const hp = Math.round(e.maxHp * (1.3 + (depth - 1) * 0.04));
        e.maxHp = hp; e.hp = hp;
      }
    });
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
  // 1 Core + 1 Signature per hero.  Movement is not a card — you drag the
  // hero.  When the triad forms, the resonant card doesn't ADD to the hand:
  // it HIJACKS the closing helper's signature slot (the card evolves).
  // Played cards LEAVE the fan (they return next turn) — what remains is
  // exactly what you can still do.
  const hand = [];
  const host = resonantHost();
  livingHeroes().forEach(h => {
    const set = h.def.cards[h.row];
    // HEAVY heroes contribute a single (expensive) card; others show two.
    if ((h.def.tempo || 'steady') !== 'heavy') {
      const core = mkCard(h, 'core', set.core);
      if (!core.spent) hand.push(core);
    }
    if (host === h.id) hand.push(mkResonantCard(h));
    else { const sig = mkCard(h, 'sig', set.sig); if (!sig.spent) hand.push(sig); }
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
  return { kind, owner: h.id, ownerName: h.def.name, tint: h.def.tint, tempo,
    stance: STANCE[h.row].name, name: def.name, cost, target: def.target, fx: def.fx, desc: def.desc,
    school: (def.fx && def.fx.dmg) ? h.def.school : null,
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
    case 'ally':      return { mode: 'ally',  els: livingHeroes().filter(h => h.id !== card.owner).map(h => figEl(h.id)).filter(Boolean) };
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
function drawAimJRPG(fx, fy, ex, ey, valid, field, angle, color) {
  const svg = aimLayer();
  const bow = Math.max(28, Math.abs(ex - fx) * 0.16);
  const midX = (fx + ex) / 2, midY = Math.min(fy, ey) - bow;
  const path = `M ${fx} ${fy} Q ${midX} ${midY} ${ex} ${ey}`;
  const c = valid ? color : '#7a7060';
  let ret = '';
  if (valid && !field) {
    const R = 16;
    ret = `<g transform="rotate(${angle} ${ex} ${ey})"><rect x="${ex - R}" y="${ey - R}" width="${2 * R}" height="${2 * R}" rx="2" fill="none" stroke="${c}" stroke-width="1.6" opacity="0.85"/></g>`
        + `<g transform="rotate(${-angle * 0.7} ${ex} ${ey})"><path d="${_cornerPath(ex, ey, R + 5)}" fill="none" stroke="#fff6d8" stroke-width="2.4" stroke-linecap="round" style="filter:drop-shadow(0 0 4px ${c})"/></g>`
        + `<circle cx="${ex}" cy="${ey}" r="3" fill="#fff6d8" style="filter:drop-shadow(0 0 7px ${c})"/>`;
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
  let s = '';
  pts.forEach(p => {
    const bow = Math.max(22, Math.abs(p.x - fx) * 0.14);
    const midX = (fx + p.x) / 2, midY = Math.min(fy, p.y) - bow;
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
  let snapped = null;
  const sc = () => _sscale();

  el.addEventListener('pointerdown', (e) => {
    if (S.executing || S.over || card.spent) return;
    // Can't afford it — shake the card and say why, rather than silently
    // swallowing the touch (the card also renders greyed via .disabled).
    if (card.cost > S.ep) { denyCard(el, card); e.preventDefault(); return; }
    pid = e.pointerId; startX = e.clientX; startY = e.clientY; ptrX = e.clientX; ptrY = e.clientY; dragging = false;
    try { el.setPointerCapture(pid); } catch (_) {}
    e.preventDefault();
  });
  el.addEventListener('pointermove', (e) => {
    if (pid === null) return;
    ptrX = e.clientX; ptrY = e.clientY;
    if (!dragging) {
      if (Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY) < 12) return;
      dragging = true;
      el.classList.add('card-dragging');
      el.style.transition = 'none';
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
    const tilt = Math.max(-15, Math.min(15, vel * 1.5));
    el.style.transform = `translate(${curTX}px, ${curTY}px) rotate(${tilt}deg) scale(1.07)`;
    // snapped target
    const { mode, els } = dragTargets(card);
    document.querySelectorAll('.fig-snapped').forEach(f => f.classList.remove('fig-snapped'));
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
    }
    curEX += (ex - curEX) * 0.34; curEY += (ey - curEY) * 0.34;
    angle = (angle + 3) % 360;
    drawAimJRPG(fromX, fromY, curEX, curEY, valid, field, angle, aimColor(card));
  }
  const finish = (e) => {
    if (pid === null) return;
    try { el.releasePointerCapture(pid); } catch (_) {}
    pid = null; cancelAnimationFrame(raf);
    if (!dragging) { onCardTap(card); return; }
    dragging = false;
    el.classList.remove('card-dragging');
    aimClear();
    if (!targeting) $('#target-hint').classList.add('hidden');
    const handTop = $('#hand').getBoundingClientRect().top;
    const cancelled = e.clientY > handTop - 8;
    const { mode } = dragTargets(card);
    if (!cancelled && mode === 'field') {
      if (card.kind === 'resonant' && S.ep < S.maxEp) { flashNarrator('The Vow needs your ENTIRE turn — play it first.'); springBack(el); return; }
      playCard(card, null); return;
    }
    if (!cancelled && snapped && snapped.dataset) { playCard(card, snapped.dataset.fig); return; }
    springBack(el);   // released in the hand or on nothing — ease home
  };
  el.addEventListener('pointerup', finish);
  el.addEventListener('pointercancel', finish);
}
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
  requestAnimationFrame(() => {
    ghost.style.transition = 'transform 0.42s cubic-bezier(0.3, 0.9, 0.4, 1), opacity 0.42s ease';
    ghost.style.transform = `translate(${dx}px, ${dy}px) scale(0.28) rotate(4deg)`;
    ghost.style.opacity = '0';
  });
  setTimeout(() => ghost.remove(), 480);
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
    // The departed stance lingers: a fading echo of its core, THIS TURN only.
    // Movement converts tempo into an extra weaker action — and the echo
    // keeps the OLD stance's strike, so stance-dancing can line up
    // same-element pairs for staggers.
    const oldCore = owner.def.cards[from].core;
    if (oldCore.fx && oldCore.fx.dmg) {
      genTempCard({ kind: 'temp', owner: owner.id, ownerName: owner.def.name, tint: owner.def.tint,
        stance: 'FADING', name: 'Echo: ' + oldCore.name, cost: 1, target: oldCore.target,
        school: owner.def.school, fx: { dmg: Math.max(2, oldCore.fx.dmg - 2) }, expiresTurn: S.turn,
        desc: `${Math.max(2, oldCore.fx.dmg - 2)} damage. The old stance lingers — this turn only.` });
    }
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
      // FOLLOW-UP: striking an enemy an ally already hit this turn is a
      // combo — +2 damage, and fighting together forms a thread between
      // the two attackers (Concept 3: following up strengthens bonds).
      const hitters = tgt._hitBy || (tgt._hitBy = []);
      const prev = hitters.length ? hitters[hitters.length - 1] : null;
      const isFollowUp = !!(owner && prev && prev !== owner.id);
      if (isFollowUp) amt += 2;
      dealToEnemy(tgt, amt, owner ? owner.def.school : null, owner ? owner.id : null);
      if (owner) hitters.push(owner.id);
      if (isFollowUp) {
        gainMomentum(12, { combo: true });   // LINK — chaining allies builds burst
        linkPopup(owner.id);
        popupAt(figEl(owner.id), '⚡ FOLLOW-UP +2', 'info');
        SFX.follow();
        await addThread(owner.id, prev);
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
    if (tgt) { tgt.mark = fx.mark; popupAt(figEl(tgt.uid), '◎ EXPOSED +' + fx.mark, 'info'); }
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
        if (spill) { rc.guard += spill; popupAt(figEl(rc.id), '⛨' + spill, 'guard'); }   // overheal shields
        SFX.heal();
      }
      if (fx.guard)  { rc.guard += fx.guard; popupAt(figEl(rc.id), '⛨ ' + fx.guard, 'guard'); SFX.guard(); }
      if (fx.buffDmg){ rc.buffDmg += fx.buffDmg; popupAt(figEl(rc.id), '▲ RALLY +' + fx.buffDmg, 'rally'); }
      if (fx.counter){ rc.counter = Math.max(rc.counter, fx.counter); }
      if (owner && rc.id !== owner.id && card.target === 'ally') await addThread(owner.id, rc.id);
    }
  }
  // Movement built into the action: the caster repositions after resolving,
  // free (no EP, no move-use).  The hand morphs to the new stance.
  if (fx.step && owner && !owner.downed) {
    const idx = ROWS.indexOf(owner.row);
    const to = fx.step === 'front' ? ROWS[Math.max(0, idx - 1)] : ROWS[Math.min(2, idx + 1)];
    if (to !== owner.row) {
      const occ = livingHeroes().find(h => h.id !== owner.id && h.row === to);
      const from = owner.row; owner.row = to; if (occ) occ.row = from;
      S._morphHeroId = owner.id; if (occ) S._morphHeroId2 = occ.id;
      renderAll();
      popupAt(figEl(owner.id), '⇄ ' + STANCE[to].name.toUpperCase(), 'info');
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
function dealToEnemy(e, amt, school, byHeroId) {
  // STAGGER payoff: the next hit on a staggered enemy lands double.
  if (e.staggered) {
    amt *= 2;
    e.staggered = false;
    popupAt(figEl(e.uid), '×2!', 'dmg popup-big');
    stageShake();
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
          stance: 'FORGED', name: 'Coup de Grâce', cost: 1, target: 'enemy',
          school: fh.def.school, fx: { dmg: 8 },
          desc: '8 damage. Forged from the stagger — spend it while they reel.' });
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
  const big = amt >= 8;
  popupAt(figEl(e.uid), '−' + amt, 'dmg' + (big ? ' popup-big' : ''));
  // (damagedHeroes bookkeeping lives in enemyPhase; kills resolve avenging
  // in resolveCard where the attacker is known)
  if (byHeroId) lungeFig(figEl(byHeroId));       // the striker drives forward
  impactFx(figEl(e.uid), school || 'phys', big); // school-typed blow lands
  shake(figEl(e.uid), 'r');                       // enemy recoils away
  SFX.hit(big);
  if (big) stageShake();
  if (e.hp === 0 && !e.dead) {
    e.dead = true;
    e._justDied = true;
    gainMomentum(8);                                // a kill feeds the burst
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
    flashNarrator('✦ MOMENTUM FULL — tap BURST to unleash the ALL-OUT ATTACK.');
    SFX.triad();
  }
}
// Show a "LINK ×N" combo callout above a hero as the chain grows.
function linkPopup(heroId) {
  if (S.combo >= 2) popupAt(figEl(heroId), '⚡ LINK ×' + S.combo, 'rally');
}
function burstReady() { return S && (S.momentum || 0) >= MOM_MAX && !S.executing && !S.over; }

async function addThread(a, b) {
  const key = pairKey(a, b);
  if (S.threads.has(key)) { await checkTriad(a); return; }   // kindled threads awaken on any help
  S.threads.add(key);
  renderThreads(key);
  SFX.thread();
  // The fight's FIRST bond materializes an Echo Bond — a card the pair
  // shares, stronger if the two are already kindled (progression made card).
  if (!S._echoBondGiven) {
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
async function resolveAllOut() {
  S._burstResolving = true;
  const heroes = livingHeroes();
  await allOutCineIntro(heroes);
  for (const h of heroes) {
    if (S.over || !livingEnemies().length) break;
    cineFlash('rgba(255,240,210,0.5)');
    lungeFig(figEl(h.id));
    await sleep(120);
    for (const e of livingEnemies()) {
      let dmg = 6 + heroes.length;                                   // each hero piles on
      const primed = e.staggered || e.weakened || e.mark || e.lull;
      if (primed) { dmg = Math.round(dmg * 1.5); }                   // detonate the setup
      dealToEnemy(e, dmg, h.def.school, h.id);
      if (primed) popupAt(figEl(e.uid), '⚡ TECHNICAL', 'info');
      await sleep(80);
    }
    renderAll();
    await sleep(200);
    if (checkEnd()) break;
  }
  S.momentum = 0;
  S.combo = 0;
  S.allOutUsed = (S.allOutUsed || 0) + 1;
  S._burstResolving = false;
  resonantCineEnd();
  renderAll();
}
async function triggerAllOut() {
  if (!burstReady()) return;
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
    S.heroes.forEach(h => { h.guard = 0; h.counter = 0; h.invuln = false; h.exposed = 0; h._hitByE = []; });
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
  // WEAKENED expires if you didn't capitalize this turn; STAGGERED holds
  // through the phase — a staggered enemy can be interrupted below.
  livingEnemies().forEach(e => { e.weakened = false; });
  await sleep(620);
  for (const e of livingEnemies()) {
    if (S.over) break;
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
    if (lungeEl && intent.kind !== 'buff') { lungeEl.classList.add('fig-lunge'); SFX.enemy(); }
    await sleep(400);
    if (intent.kind === 'buff') {
      if (intent.guardSelf) { e.guard += intent.guardSelf; popupAt(figEl(e.uid), '⛨ ' + intent.guardSelf, 'guard'); SFX.guard(); }
      if (intent.powerSelf) { e.power += intent.powerSelf; popupAt(figEl(e.uid), '▲ +' + intent.powerSelf, 'rally'); }
      if (intent.powerAll) {
        livingEnemies().forEach(o => { o.power += intent.powerAll; popupAt(figEl(o.uid), '▲ +' + intent.powerAll, 'rally'); });
        flashNarrator(e.def.name + ' rallies the horde.');
      }
      renderAll();
      continue;
    }
    let dmg = enemyIntentDmg(e, intent);
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
        let left = hitDmg;
        if (h.guard > 0) { const g = Math.min(h.guard, left); h.guard -= g; left -= g; popupAt(figEl(h.id), '⛨', 'guard'); }
        if (left > 0) {
          h.hp = Math.max(0, h.hp - left);
          const big = left >= 7;
          popupAt(figEl(h.id), '−' + left, 'dmg' + (big ? ' popup-big' : ''));
          impactFx(figEl(h.id), 'foe', big);   // red claw-strike on the hero
          shake(figEl(h.id), 'l');              // hero recoils away from foes
          SFX.hit(big);
          if (big) stageShake();
          (e._damaged || (e._damaged = [])).push(h.id);   // remembered for AVENGE
        }
      }
      if (intent.chill)  { h.chill = (h.chill || 0) + intent.chill; popupAt(figEl(h.id), '❄ CHILL −' + intent.chill, 'chill'); }
      if (intent.expose) { h.exposed = (h.exposed || 0) + intent.expose; popupAt(figEl(h.id), '◎ EXPOSED +' + intent.expose, 'info'); }
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
            stance: 'REACTIVE', name: 'Not Today', cost: 1, target: 'none',
            fx: { notToday: [pr.id, h.id] }, expiresTurn: S.turn + 1,
            desc: `${pr.def.name} steps in: swap rows with ${h.def.name}, heal them 4, gain <span class="kw kw-guard">⛨ 4</span> <span class="kw kw-counter">↺ 2</span> — but overextends: <span class="kw kw-chill">❄ CHILL −2</span> on ${pr.def.name}’s next strike. Next turn only.` });
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
  // On the Descent, death is contribution: the run ends, and the Abyss
  // stores a memory of who fell here — the next descent will find it.
  if (S.node.mapId != null && RUN) {
    const abyss = loadAbyss();
    abyss[S.node.mapId] = {
      trio: RUN.active.slice(),
      threads: [...S.threads],
      label: MAP_NODES[S.node.mapId].label,
    };
    saveAbyss(abyss);
    try { localStorage.removeItem(RUN_KEY); } catch (_) {}
    RUN = null;
    const names = abyss[S.node.mapId].trio.map(id => HEROES[id].name).join(' · ');
    setTimeout(() => {
      showOverlay(`
        <div class="ov-eyebrow">THE DESCENT ENDS</div>
        <div class="ov-title" style="font-size:22px">THE THREAD FRAYS</div>
        <div class="ov-lines" style="text-align:center; min-height:0">
          <div class="ov-line">${names} fall at <b>${abyss[S.node.mapId].label}</b>.</div>
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
        if (node.campDone) showPartySelect(() => showMap());
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
  return MAP_NODES.some(p => RUN.completed.includes(p.id) && p.next.includes(n.id));
}
function showMap() {
  S = null;
  $('#chapter-chip').textContent = 'DESCENT';
  $('#timeline').innerHTML = '';
  const cols = {};
  MAP_NODES.forEach(n => { (cols[n.col] = cols[n.col] || []).push(n); });
  const glyph = { fight: '⚔', recruit: '☉', camp: '⌂', boss: '☠' };
  const abyss = loadAbyss();
  const colHtml = Object.keys(cols).sort((a, b) => a - b).map(c => `
    <div class="map-col">
      ${cols[c].map(n => {
        const done = RUN.completed.includes(n.id);
        const reach = nodeReachable(n);
        return `<button class="map-node mn-${n.type}${done ? ' mn-done' : ''}${reach ? ' mn-reach' : ''}"
          data-node="${n.id}" ${reach ? '' : 'disabled'}>
          ${abyss[n.id] ? '<span class="mn-mem" title="A previous descent fell here">♰</span>' : ''}
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
  const abyss = loadAbyss();
  if (abyss[n.id]) { showMemory(n, abyss[n.id]); return; }
  if (n.type === 'fight' || n.type === 'boss') startMapFight(n);
  else if (n.type === 'recruit') showRecruit(n);
  else if (n.type === 'camp') showCamp(n);
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
    delete abyss[n.id];
    saveAbyss(abyss);
    saveRun();
    hideOverlay();
    if (n.type === 'fight' || n.type === 'boss') startMapFight(n);
    else if (n.type === 'recruit') showRecruit(n);
    else if (n.type === 'camp') showCamp(n);
  };
}
function startMapFight(n) {
  startFight({ type: 'fight', chapter: 3, heroes: RUN.active.slice(), enemies: n.enemies.slice(),
    useRunHp: true, mapId: n.id, depth: n.col, narrator: n.label + (n.type === 'boss' ? ' — it remembers you.' : '') });
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
      <div class="ov-line">One evening, one choice — what does the party do with it?</div>
    </div>
    <button class="ov-btn primary" id="camp-fire">SHARE THE FIRE · deepen the weakest bond +1 ♡</button>
    <button class="ov-btn" id="camp-steel">SHARPEN STEEL · open the next fight with ▲ RALLY +2</button>
  `);
  $('#camp-fire').onclick = () => showCampScene(n);
  $('#camp-steel').onclick = () => {
    RUN.campEdge = true;
    saveRun();
    showPartySelect(() => showMap());
  };
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
  renderTimeline();
  renderBattlefield();
  renderThreads();
  renderActionBar();
}

// Combat no longer has an action-scripted / ATB order (your whole turn, then
// theirs), so a turn-order strip would be dishonest.  This spot instead
// carries a THREAT FORECAST: total enemy damage that would land on OCCUPIED
// party rows next phase.  Vacate a telegraphed row and the number drops —
// the forecast is the formation puzzle made numeric, and it drives the
// guard / intercept / dodge decision.
function renderTimeline() {
  const tl = $('#timeline');
  if (!S) { tl.innerHTML = ''; return; }
  const rowDmg = { front: 0, mid: 0, back: 0 };
  livingEnemies().forEach(e => {
    const it = e.def.intents[e.intentIdx % e.def.intents.length];
    if (!it || it.kind === 'buff') return;
    const dmg = enemyIntentDmg(e, it);
    (it.row === 'all' ? ROWS.slice() : [it.row]).forEach(r => { rowDmg[r] += dmg; });
  });
  let incoming = 0, lethal = false;
  ROWS.forEach(r => {
    const h = heroInRow(r);
    if (!h) return;
    incoming += rowDmg[r];
    if (rowDmg[r] >= h.hp + h.guard && !h.invuln) lethal = true;
  });
  tl.innerHTML = `<span class="rd-round">ROUND ${S.turn}</span>`
    + (incoming > 0
        ? `<span class="rd-threat${lethal ? ' rd-lethal' : ''}"><span class="rd-i">⚔</span> ${incoming} incoming${lethal ? ' ☠' : ''}</span>`
        : `<span class="rd-safe">— the line holds —</span>`);
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
        <div class="fig-art">${V2PORTRAITS[who.id] || ''}${who.downed ? '' : auraHTML({ guard: who.guard, rally: who.buffDmg, chill: who.chill, exposed: who.exposed, counter: who.counter, invuln: who.invuln })}</div>
        <div class="fig-chips">
          ${who.invuln ? `<span class="chip buff${chipPop(who,'invuln',1)}">✦ INVULN</span>` : ''}
          ${who.guard ? `<span class="chip guard${chipPop(who,'guard',who.guard)}">⛨ ${who.guard}</span>` : ''}
          ${who.buffDmg ? `<span class="chip buff${chipPop(who,'buffDmg',who.buffDmg)}">▲ ${who.buffDmg}</span>` : ''}
          ${who.counter ? `<span class="chip counter${chipPop(who,'counter',who.counter)}">↺ ${who.counter}</span>` : ''}
          ${who.exposed ? `<span class="chip mark${chipPop(who,'exposed',who.exposed)}">◎ ${who.exposed}</span>` : ''}
          ${who.chill ? `<span class="chip chill${chipPop(who,'chill',who.chill)}">❄ ${who.chill}</span>` : ''}
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
        : `<div class="intent${it.heavy ? ' intent-heavy' : ''}"><span>⚔</span><span class="i-dmg">${enemyIntentDmg(e, it)}</span>${it.chill ? '<span class="i-st kw-chill">❄</span>' : ''}${it.expose ? '<span class="i-st kw-exposed">◎</span>' : ''}<span class="i-row">→ ${it.row === 'all' ? 'ALL' : ROW_LABEL[it.row]}</span></div>`;
      fig.innerHTML = `
        ${intentHtml}
        <div class="fig-art">${enemyArt(e)}${e._justDied ? '' : auraHTML({ guard: e.guard, rally: e.power, chill: e.lull, exposed: e.mark, weak: e.weakened, stagger: e.staggered })}</div>
        <div class="fig-chips">
          <span class="chip weak" title="weakness">${e.weakRevealed ? (SCHOOL_GLYPH[e.def.weak] || '?') : '?'}</span>
          ${e.weakened ? `<span class="chip mark${chipPop(e,'weakened',1)}">⌖</span>` : ''}
          ${e.staggered ? `<span class="chip stagger${chipPop(e,'staggered',1)}">⚡</span>` : ''}
          ${e.guard ? `<span class="chip guard${chipPop(e,'guard',e.guard)}">⛨ ${e.guard}</span>` : ''}
          ${e.power ? `<span class="chip buff${chipPop(e,'power',e.power)}">▲ ${e.power}</span>` : ''}
          ${e.mark ? `<span class="chip mark${chipPop(e,'mark',e.mark)}">◎ ${e.mark}</span>` : ''}
          ${e.lull ? `<span class="chip chill${chipPop(e,'lull',e.lull)}">❄ ${e.lull}</span>` : ''}
        </div>
        <div class="hp-bar"><div class="hp-fill" style="width:${(e.hp / e.maxHp) * 100}%"></div></div>
        <div class="fig-name">${e.def.name} <span class="hp-num">${e.hp}/${e.maxHp}</span></div>
      `;
      snapFx(e, { weakened: e.weakened ? 1 : 0, staggered: e.staggered ? 1 : 0, guard: e.guard, power: e.power, mark: e.mark, lull: e.lull });
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

// The MOMENTUM gauge — fills as you exploit weaknesses / chain LINKs; when
// full it becomes a tappable ALL-OUT button.
function renderBurst() {
  const burst = $('#burst'); if (!burst) return;
  const pct = Math.round(((S.momentum || 0) / MOM_MAX) * 100);
  $('#burst-fill').style.width = pct + '%';
  const ready = burstReady();
  burst.classList.toggle('burst-ready', ready);
  $('#burst-lbl').textContent = ready ? 'ALL-OUT ▸' : 'BURST';
  burst.onclick = ready ? () => triggerAllOut() : null;
  burst.style.cursor = ready ? 'pointer' : 'default';
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
  const fxIconStr = (fx, hasAll) => {
    const b = [];
    const d = fx.dmg || fx.hitFrontmost;
    if (fx.aoeDmg) b.push(`<span class="ic ic-dmg">⚔${fx.aoeDmg}<em>·ALL</em></span>`);
    else if (d)    b.push(`<span class="ic ic-dmg">⚔${d}</span>`);
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
    return b.join('');
  };
  const cardIcons = (card) => {
    const fx = card.fx || {};
    if (fx.resonant) { const rfx = {}; (triadEntry().stages || []).forEach(st => Object.assign(rfx, st.fx || {})); return fxIconStr(rfx); }
    if (fx.bondPair) return `<span class="ic ic-guard">⛨${fx.bondGuard}</span><span class="ic ic-rally">▲${fx.bondRally}</span>`;
    if (fx.notToday) return `<span class="ic ic-move">⇄</span><span class="ic ic-heal">✚4</span><span class="ic ic-guard">⛨4</span><span class="ic ic-counter">↺2</span>`;
    return fxIconStr(fx);
  };
  // Reach: a 3-cell front/mid/back diagram for enemy cards (filled = can hit),
  // so 'nearest' vs 'any' reads without words; support targets stay labelled.
  const reachPips = (cells) => `<span class="rch-pips" title="enemy reach — front · mid · back">${cells.map(c => `<i class="rp${c ? ' on' : ''}"></i>`).join('')}</span>`;
  const cardReach = (card) => {
    const fx = card.fx || {};
    if (fx.resonant) return `<span class="rch rch-t">◈ ALL</span>`;
    if (fx.notToday || fx.bondPair) return `<span class="rch rch-t">◇ BOND</span>`;
    switch (card.target) {
      case 'frontmost': return `${reachPips([1, 0, 0])}<span class="rch-lbl">nearest</span>`;
      case 'enemy':     return `${reachPips([1, 1, 1])}<span class="rch-lbl">any foe</span>`;
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
    const channelable = !card.spent && !S.channelUsed && !S.executing && !S.over && card.kind !== 'resonant';
    el.innerHTML = `
      ${channelable ? `<button class="card-channel" title="Channel for +1 EP">↻</button>` : ''}
      <div class="c-top">
        <span class="c-cost tempo-${card.tempo || 'steady'}">${card.cost}</span>
        <span class="c-name">${card.name}</span>
        ${card.school ? `<span class="c-school">${SCHOOL_GLYPH[card.school]}</span>` : ''}
        ${isTemp ? `<span class="c-temp-mark">✧</span>` : ''}
      </div>
      <div class="c-fx">${cardIcons(card)}</div>
      <div class="c-desc">${card.desc}</div>
      <div class="c-reach">${cardReach(card)}</div>
      <div class="c-owner"><span>${card.ownerName}</span><span class="c-stance">· ${card.stance}</span></div>
    `;
    const chBtn = el.querySelector('.card-channel');
    if (chBtn) {
      chBtn.addEventListener('pointerdown', e => e.stopPropagation());
      chBtn.addEventListener('click', e => { e.stopPropagation(); channelCard(card); });
    }
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
