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

const V2_BUILD = 65;
const $ = (sel) => document.querySelector(sel);

// ---------------------------------------------------------------------------
// SETTINGS — persisted player options (menu) + dev toggles.
// ---------------------------------------------------------------------------
const SETTINGS_KEY = 'kizuna2.settings';
const SETTINGS = Object.assign(
  { sound: true, haptics: true, fightBg: true },
  (() => { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') || {}; } catch (_) { return {}; } })()
);
function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(SETTINGS)); } catch (_) {} }

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
        sig:  { name: 'Vanish Strike', cost: 2, target: 'frontmost', fx: { dmg: 9, step: 'back' }, desc: '9 damage · vanish to BACK.' },
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
// DATA — the tutorial chapters (unchanged), then THE DESCENT map.
// ---------------------------------------------------------------------------
const FLOW = [
  { type: 'story', chapter: 1, title: 'ONE SURVIVOR', eyebrow: 'CHAPTER 1', lines: [
    { text: 'The first thing you understand is that everyone else is gone.' },
    { spk: 'ASH', text: '…then I carry it alone.' },
    { text: 'You are <b>Ash</b>. One blade, three ways to hold it — your <b>row is your stance</b>: Front cuts, Mid flows, Back strikes from the wind. <b>Drag Ash himself</b> between rows and his cards rewrite to match.' },
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
    { text: 'Others survived down there. Every trio you form <b>resonates differently</b>, so <b>who walks beside whom is your build</b>. And when a party falls, the Abyss remembers where — your next descent finds their ashes still warm.' },
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
const STARTERS_KEY = 'kizuna2.starters';
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
function generateDescent(roster) {
  roster = roster || ['ash'];
  // Recruits = anyone not already in the party.  You start solo (or short) and
  // build your trio from the road, so an early recruit is guaranteed close.
  const pending = _shuffle(STARTER_POOL.filter(id => !roster.includes(id)));
  // Spread the pending recruits across the early/mid stretches — the first two
  // land early (levels 2 & 3) so a solo lead isn't alone for long.
  const recruitAtLevel = {};
  pending.slice(0, 3).forEach((id, i) => { recruitAtLevel[2 + i] = id; });
  const numLevels = 7;
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
    if (recruitAtLevel[level]) types = types.slice(0, 2).concat('recruit');
    const ids = [];
    types.forEach(type => {
      const node = { id: idc, level, col: level, type, next: [] };
      if (type === 'fight')        { node.enemies = _combatEnemies(level); node.label = lbl.fight(); }
      else if (type === 'elite')   { node.enemies = _eliteEnemies(level); node.elite = true; node.label = lbl.elite(); }
      else if (type === 'event')   { node.eventId = eventQ[eventI++ % eventQ.length]; node.label = lbl.event(); }
      else if (type === 'camp')    { node.label = lbl.camp(); }
      else if (type === 'recruit') { node.hero = recruitAtLevel[level]; node.label = RECRUIT_NODE_LABELS[node.hero] || 'A NEW THREAD'; }
      else if (type === 'boss')    { node.enemies = ['echoknight2']; node.isBoss = true; node.label = lbl.boss(); }
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
const EVENTS_V2 = {
  shrine: {
    title: 'A COLD SHRINE',
    lines: ['A shrine to a god no one remembers leans in the dark.', 'It asks for something — or gives it. Hard to say which.'],
    a: { label: 'KNEEL AND PRAY · the party heals 6', fx: () => _healParty(6) },
    b: { label: 'OFFER A NAME · deepen the weakest bond +1 ♡', fx: () => _bumpWeakestBond() },
  },
  cache: {
    title: 'AN OLD CACHE',
    lines: ['A dead scout’s pack, half-buried. Whatever killed them is long gone.', 'Two things worth taking. Only time to grab one.'],
    a: { label: 'THE WHETSTONE · open the next fight with ▲ RALLY +2', fx: () => { RUN.campEdge = true; } },
    b: { label: 'THE POULTICE · the party heals 4', fx: () => _healParty(4) },
  },
  echo: {
    title: 'AN ECHO IN THE DARK',
    lines: ['A voice repeats a conversation the party half-remembers having.', 'Stay and listen, or press on before it learns your names.'],
    a: { label: 'LISTEN · heal 3 · deepen the weakest bond +1 ♡', fx: () => { _healParty(3); _bumpWeakestBond(); } },
    b: { label: 'PRESS ON · open the next fight with ▲ RALLY +2', fx: () => { RUN.campEdge = true; } },
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

function newRun(starterId) {
  // Begin SOLO with the chosen (unlocked) starter; recruit the rest on the road.
  starterId = (starterId && HEROES[starterId]) ? starterId : (getUnlockedStarters()[0] || 'ash');
  const roster = [starterId];
  const hp = {}; hp[starterId] = HEROES[starterId].maxHp;
  return {
    roster: roster.slice(),
    active: roster.slice(),
    hp,
    bonds: {},          // pairKey -> points; a pair at 2+ is KINDLED
    map: generateDescent(roster),   // a fresh branching descent every run
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
    // Small parties (a solo/duo opener before you've recruited) take fewer
    // knocks and face slightly softer foes, so the v1-style solo start is
    // survivable until the road fills your line.  Bosses ignore this — by the
    // final gate you should be a full trio, and the boss is meant to hurt.
    const ps = heroes.length;
    const psDmg = ps >= 3 ? 1 : ps === 2 ? 0.82 : 0.64;
    const psHp = ps >= 3 ? 1 : ps === 2 ? 0.86 : 0.72;
    enemies.forEach(e => {
      if (e.def.boss) {
        e.dmgMul = 2.3 + (depth - 1) * 0.08;
        const hp = Math.round(e.maxHp * 1.9);
        e.maxHp = hp; e.hp = hp;
      } else {
        e.dmgMul = (1.8 + (depth - 1) * 0.08) * psDmg;
        const hp = Math.round(e.maxHp * (1.65 + (depth - 1) * 0.06) * psHp);
        e.maxHp = hp; e.hp = hp;
      }
      // ELITE nodes hit harder and last longer — a real spike over a plain fight.
      if (node.elite && !e.def.boss) {
        e.dmgMul *= 1.15;
        const hp = Math.round(e.maxHp * 1.25);
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
  // The beam ORIGIN (the cast point) is pinned to a lower-central band, so it
  // never appears to shoot in from an off-screen corner however far the card is
  // flicked; the ENDPOINT (reticle) is free to reach any foe on the stage.
  fx = Math.max(150, Math.min(610, fx)); fy = Math.max(214, Math.min(408, fy));
  ex = Math.max(6, Math.min(754, ex)); ey = Math.max(6, Math.min(424, ey));
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
  // origin pinned lower-central (see drawAimJRPG) so the fan never starts off-screen
  fx = Math.max(150, Math.min(610, fx)); fy = Math.max(214, Math.min(408, fy));
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
  const sc = () => _sscale();

  el.addEventListener('pointerdown', (e) => {
    if (S.executing || S.over) return;
    pid = e.pointerId; startX = e.clientX; startY = e.clientY; ptrX = e.clientX; ptrY = e.clientY; dragging = false; inspecting = false;
    try { el.setPointerCapture(pid); } catch (_) {}
    // PRESS & HOLD to INSPECT — a big MtG-style enlarge of the card (works on
    // any card, even one you can't afford or have spent).  A drag or a quick
    // release cancels it.
    clearTimeout(holdT);
    holdT = setTimeout(() => { if (pid !== null && !dragging) { inspecting = true; showCardInspect(card, el); } }, 340);
    e.preventDefault();
  });
  el.addEventListener('pointermove', (e) => {
    if (pid === null) return;
    ptrX = e.clientX; ptrY = e.clientY;
    if (!dragging && !inspecting) {
      if (Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY) < 12) return;
      clearTimeout(holdT);
      // Can't play it? Deny on the drag attempt (spent, or unaffordable), rather
      // than lifting a card that can't land.
      if (card.spent || card.cost > S.ep) { if (card.cost > S.ep) denyCard(el, card); pid = null; try { el.releasePointerCapture(e.pointerId); } catch (_) {} return; }
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
    if (pid === null) return;
    clearTimeout(holdT);
    try { el.releasePointerCapture(pid); } catch (_) {}
    pid = null; cancelAnimationFrame(raf);
    if (inspecting) { inspecting = false; hideCardInspect(); return; }   // release from inspect — don't play
    if (!dragging) { onCardTap(card); return; }
    dragging = false;
    el.classList.remove('card-dragging');
    aimClear();
    document.querySelectorAll('.fig-tech-aim').forEach(f => f.classList.remove('fig-tech-aim'));
    if (!targeting) { $('#target-hint').classList.add('hidden'); $('#target-hint').classList.remove('th-tech'); }
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
// PRESS & HOLD INSPECT — a big, readable enlarge of the card (Magic-style), a
// clone of the real card so it's pixel-faithful, over a dimmed/blurred field.
function showCardInspect(card, el) {
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
  try { n = parseInt(localStorage.getItem('kizuna2.parryLessons') || '0', 10) || 0; } catch (_) {}
  if (n >= 3) return;
  try { localStorage.setItem('kizuna2.parryLessons', String(n + 1)); } catch (_) {}
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
  const rh = parryRhythm(notes.length);   // groove: varied tap speeds + gaps
  let hits = 0;
  for (let i = 0; i < notes.length; i++) {
    const nt = notes[i], p = pts[i], step = rh[i] || { d: 480, g: 110 };
    const done = preview.querySelectorAll('.sq-dot')[i]; if (done) done.classList.add('sq-active');
    if (art) bossAttackBeat(art, p.x, p.y);   // one art streak per note — SYNCED
    let q;
    if (nt.t === 'hold')       q = await parryHoldNote(p.x, p.y, 760);
    else if (nt.t === 'swipe') q = await parrySwipeNote(p.x, p.y, nt.arc || 'arcR', 680);
    else                       q = await parryTapNote(p.x, p.y, step.d, i + 1, notes.length);
    if (done) { done.classList.remove('sq-active'); done.classList.add(q === 'perfect' || q === 'good' ? 'sq-hit' : 'sq-miss'); }
    if (q === 'perfect' || q === 'good') hits++;
    if (step.g) await sleep(step.g);   // syncopated gap — a groove, not a metronome
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
  if (S.threads.has(key)) { await checkTriad(a); return; }   // kindled threads awaken on any help
  S.threads.add(key);
  sparkThread(a, b);       // a single arc of connection, then it fades
  renderResonance();       // update the RESONANCE badge (edge lights up)
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
  try { n = parseInt(localStorage.getItem('kizuna2.strikeLessons') || '0', 10) || 0; } catch (_) {}
  if (n >= 3) return;
  try { localStorage.setItem('kizuna2.strikeLessons', String(n + 1)); } catch (_) {}
  let el = document.getElementById('parry-coach');
  if (!el) { el = document.createElement('div'); el.id = 'parry-coach'; $('#stage').appendChild(el); }
  el.textContent = 'TAP each STRIKE on the enemy — chain them for more damage';
  el.classList.remove('pc-show'); void el.offsetWidth; el.classList.add('pc-show');
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('pc-show'), 2800);
}
async function resolveAllOut() {
  S._burstResolving = true;
  const heroes = livingHeroes();
  await allOutCineIntro(heroes);
  $('#stage').classList.add('allout-focus');
  allOutCoach();
  let chain = 0;
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
      }
      renderAll();
      if (checkEnd()) break;
      if (step.g) await sleep(step.g);
    }
    if (checkEnd()) break;
  }
  S.momentum = 0;
  S.combo = 0;
  S.allOutUsed = (S.allOutUsed || 0) + 1;
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
  _parryStreak = 0;   // a fresh parry combo for the phase
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
    const rows = intent.row === 'all' ? ROWS.slice() : [intent.row];
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
        popupAt(figEl(ptHero.id), '⚔ PERFECT — +BURST', 'tech');
        flashNarrator(ptHero.def.name + ' turns the blow — the burst swells!');
        parryFlash(figEl(ptHero.id));
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
        }
      }
      if (!perfectParry && intent.chill)  { h.chill = (h.chill || 0) + intent.chill; popupAt(figEl(h.id), '❄ CHILL −' + intent.chill, 'chill'); }
      if (!perfectParry && intent.expose) { h.exposed = (h.exposed || 0) + intent.expose; popupAt(figEl(h.id), '◎ EXPOSED +' + intent.expose, 'info'); }
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
  SFX.victory();
  setTimeout(() => {
    if (isBoss && S.node.mapId != null) { onRunComplete(); return; }
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
function onRunComplete() {
  RUN.done = true; saveRun();
  showOverlay(`
    <div class="ov-eyebrow" style="color:var(--gold-bright)">THE DESCENT · CLEARED</div>
    <div class="ov-title" style="font-size:26px">THE ECHO FADES</div>
    <div class="ov-lines" style="text-align:center; min-height:0;">
      <div class="ov-line">The Remembered Knight unremembers itself, one stroke at a time.</div>
      <div class="ov-line"><b>The thread held.</b>  Every triangle you never formed still waits below — other trios, other vows, another descent.</div>
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
  showOverlay(`
    <div class="ov-eyebrow">THE DESCENT</div>
    <div class="ov-title" style="font-size:20px; margin-bottom:14px;">CHOOSE THE ROAD</div>
    <div class="map-strip"><svg class="map-edges" aria-hidden="true"></svg>${colHtml}</div>
    <button class="party-chip" id="map-party">
      ${trio}
      <span class="party-chip-meta">PARTY · resonates as <b>✦ ${r.name}</b> <i>(${r.type})</i></span>
    </button>
  `, 'map-screen');
  document.querySelectorAll('.map-node.mn-reach').forEach(el => {
    el.onclick = () => enterMapNode(mapNode(+el.dataset.node));
  });
  $('#map-party').onclick = () => showPartySelect(() => showMap());
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
  showOverlay(`
    <div class="ov-eyebrow">A CROSSROADS</div>
    <div class="ov-title" style="font-size:22px">${ev.title}</div>
    <div class="ov-lines" style="text-align:center; min-height:0">${ev.lines.map(t => `<div class="ov-line">${t}</div>`).join('')}</div>
    <button class="ov-btn primary" id="ev-a">${ev.a.label}</button>
    <button class="ov-btn" id="ev-b">${ev.b.label}</button>
  `);
  const finish = (choice) => {
    choice.fx();
    if (!RUN.completed.includes(n.id)) RUN.completed.push(n.id);
    saveRun();
    showMap();
  };
  $('#ev-a').onclick = () => finish(ev.a);
  $('#ev-b').onclick = () => finish(ev.b);
}
function startMapFight(n) {
  const boss = !!n.isBoss;
  startFight({ type: 'fight', chapter: 3, heroes: RUN.active.slice(), enemies: n.enemies.slice(),
    useRunHp: true, mapId: n.id, depth: n.level || n.col, elite: !!n.elite, isBoss: boss,
    nodeType: n.type, label: n.label, level: n.level,
    narrator: n.label + (boss ? ' — it remembers you.' : (n.elite ? ' — a deeper sin waits.' : '')) });
  $('#chapter-chip').textContent = boss ? 'BOSS' : (n.elite ? 'ELITE' : 'DESCENT');
}
function showRecruit(n) {
  const h = HEROES[n.hero];
  const lines = (RECRUIT_LINES[n.hero] || []).map(l =>
    `<div class="ov-line">${l.spk ? `<span class="spk">${l.spk}</span>` : ''}${l.text}</div>`).join('');
  showOverlay(`
    <div class="ov-eyebrow">A NEW THREAD · ${(h.archetype || '').toUpperCase()}</div>
    <div class="ov-title" style="font-size:22px">${h.name} — ${h.cls.toUpperCase()}</div>
    <div class="ps-identity" style="margin:-4px auto 8px;max-width:360px">${h.identity || ''}</div>
    <div class="recruit-fig">${V2PORTRAITS[n.hero] || ''}</div>
    <div class="ov-lines" style="min-height:0">${lines}</div>
    <button class="ov-btn primary" id="rc-join">${h.name} JOINS</button>
  `);
  $('#rc-join').onclick = () => {
    if (!RUN.roster.includes(n.hero)) RUN.roster.push(n.hero);
    RUN.hp[n.hero] = h.maxHp;
    if (!RUN.completed.includes(n.id)) RUN.completed.push(n.id);
    unlockStarter(n.hero);   // meet them once → they're a future starter
    // Solo/duo → the newcomer just joins the line.  Once you're a full trio+,
    // composition becomes a choice.
    if (RUN.active.length < 3 && !RUN.active.includes(n.hero)) RUN.active.push(n.hero);
    saveRun();
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
  const tl = $('#timeline');
  if (!S) { tl.innerHTML = ''; return; }
  const rowDmg = { front: 0, mid: 0, back: 0 };
  livingEnemies().forEach(e => {
    const it = e.def.intents[e.intentIdx % e.def.intents.length];
    if (!it || it.kind === 'buff') return;
    const dmg = enemyIntentDmg(e, it);
    (it.row === 'all' ? ROWS.slice() : [it.row]).forEach(r => { rowDmg[r] += dmg; });
  });
  // The forecast is only useful if it drives the decision — so name the hero in
  // real danger and say the answer (parry or move), not just a bare number.
  let incoming = 0, doomed = null;
  ROWS.forEach(r => {
    const h = heroInRow(r);
    if (!h) return;
    incoming += rowDmg[r];
    if (rowDmg[r] > 0 && rowDmg[r] >= h.hp + h.guard && !h.invuln) doomed = h;
  });
  tl.innerHTML = `<span class="rd-round">ROUND ${S.turn}</span>`
    + (doomed
        ? `<span class="rd-threat rd-lethal"><span class="rd-i">☠</span> ${doomed.def.name} WILL FALL — <b>parry or move</b></span>`
        : incoming > 0
          ? `<span class="rd-threat"><span class="rd-i">⚔</span> ${incoming} incoming — <b>parry to negate</b></span>`
          : `<span class="rd-safe">— the line holds —</span>`);
}

function renderBattlefield() {
  // Per-row INCOMING DAMAGE, so the telegraph can look as scary as the blow is
  // big — a small poke barely glows, a boss's OBLIVION swells huge and red.
  const rowDmg = { front: 0, mid: 0, back: 0 };
  let anyHeavy = false;
  livingEnemies().forEach(e => {
    const it = e.def.intents[e.intentIdx % e.def.intents.length];
    if (!it || it.kind === 'buff') return;
    const dmg = enemyIntentDmg(e, it);
    if (it.heavy) anyHeavy = true;
    (it.row === 'all' ? ROWS.slice() : (it.row ? [it.row] : [])).forEach(r => { rowDmg[r] += dmg; });
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
    slot.innerHTML = `<span class="slot-ring"></span><span class="slot-danger" aria-hidden="true"><span class="sd-wave"></span></span>${rowDmg[row] > 0 ? `<span class="slot-dmg">✕ ${rowDmg[row]}</span>` : ''}`;
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
  // FLOOR BOSS — one colossal foe that fills the enemy half, rendered as a
  // single big figure instead of the three-slot line.
  const fboss = S.enemies.find(x => x.def.floorBoss && (!x.dead || x._justDied));
  enemyHalf.classList.toggle('has-floor-boss', !!fboss);
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
// The inner markup for an enemy figure (shared by the line + the floor boss).
function enemyFigInner(e) {
  const it = e.def.intents[e.intentIdx % e.def.intents.length];
  const intentHtml = it.kind === 'buff'
    ? `<div class="intent intent-buff"><span>◈</span><span class="i-row">${it.desc || 'gathers'}</span></div>`
    : `<div class="intent${it.heavy ? ' intent-heavy' : ''}"><span>⚔</span><span class="i-dmg">${enemyIntentDmg(e, it)}</span>${it.chill ? '<span class="i-st kw-chill">❄</span>' : ''}${it.expose ? '<span class="i-st kw-exposed">◎</span>' : ''}<span class="i-row">→ ${it.row === 'all' ? 'ALL' : ROW_LABEL[it.row]}</span><span class="i-parry" title="parry pattern">${parryGlyph(it)}</span>${it.heavy ? '<span class="i-break">⚡ STAGGER breaks</span>' : ''}</div>`;
  return `
    ${intentHtml}
    <div class="fig-art">${enemyArt(e)}${e._justDied ? '' : auraHTML({ guard: e.guard, rally: e.power, chill: e.lull, exposed: e.mark, weak: e.weakened, stagger: e.staggered })}</div>
    <div class="fig-chips">
      <span class="chip weak${e.weakRevealed ? ' revealed' : ''}" title="weakness — hit this element to WEAKEN, twice to STAGGER">${e.weakRevealed ? 'WEAK ' + (SCHOOL_GLYPH[e.def.weak] || '?') : '? ? ?'}</span>
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
    const channelable = !card.spent && !S.channelUsed && !S.executing && !S.over && card.kind !== 'resonant';
    el.innerHTML = `
      ${channelable ? `<button class="card-channel" title="Channel for +1 EP">↻</button>` : ''}
      <div class="c-top">
        <span class="c-cost tempo-${card.tempo || 'steady'}${card.cost === 0 ? ' c-free' : ''}">${card.cost === 0 ? 'FREE' : card.cost}</span>
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
function showHowTo() {
  showOverlay(`
    <div class="ov-eyebrow">HOW TO PLAY</div>
    <div class="ov-title" style="font-size:20px; margin-bottom:10px;">THE THREADS</div>
    <div class="ov-lines howto" style="text-align:left; max-width:420px; margin:0 auto;">
      <div class="ov-line"><b>Row is stance.</b> Drag a hero between FRONT/MID/BACK — their cards rewrite.</div>
      <div class="ov-line"><b>Defend.</b> When a blow winds up, dodge to an empty row or PARRY it — tap each note as its ring glows.</div>
      <div class="ov-line"><b>Bond.</b> Help an ally (heal, guard, follow-up) to form a THREAD. Hold all three and the trio RESONATES a shared vow.</div>
      <div class="ov-line"><b>Exploit.</b> Hit a foe's weakness twice in a turn to STAGGER it; chain hits to fill BURST, then unleash the ALL-OUT.</div>
      <div class="ov-line"><b>Inspect.</b> Press &amp; hold any card to enlarge it.</div>
    </div>
    <button class="ov-btn primary" id="ht-back">◂ BACK</button>
  `, 'menu-screen');
  $('#ht-back').onclick = () => showMenu();
}
function showDevPanel() {
  const onOff = (v) => `<span class="menu-val ${v ? 'mv-on' : 'mv-off'}">${v ? 'ON' : 'OFF'}</span>`;
  showOverlay(`
    <div class="ov-eyebrow">DEV</div>
    <div class="ov-title" style="font-size:20px; margin-bottom:12px;">DEV TOOLS</div>
    <div class="menu-list">
      <button class="menu-item" id="d-bg"><span>FIGHT BACKGROUND</span>${onOff(SETTINGS.fightBg)}</button>
      <button class="menu-item" id="d-back">◂ BACK</button>
    </div>
    <div class="ov-hint">Toggles here persist on this device.</div>
  `, 'menu-screen');
  $('#d-bg').onclick = () => { toggleSetting('fightBg'); showDevPanel(); };
  $('#d-back').onclick = () => showMenu();
}

function showTitle() {
  S = null;
  $('#stage').classList.remove('show-bg');
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
  // NEW GAME and THE DESCENT both start a fresh run — first CHOOSE YOUR SURVIVOR.
  $('#t-new').onclick = () => showStarterSelect(id => beginRun(id));
  const c = $('#t-continue');
  if (c) c.onclick = () => {
    const r = loadRun();
    if (r && !r.done) { RUN = r; showMap(); }
    else showStarterSelect(id => beginRun(id));
  };
  $('#t-descent').onclick = () => {
    const r = loadRun();
    if (r && !r.done) { RUN = r; saveRun(); showMap(); }
    else showStarterSelect(id => beginRun(id));
  };
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
  try { localStorage.setItem(PROGRESS_KEY, String(FLOW.length)); localStorage.removeItem(RUN_KEY); } catch (_) {}
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
{ const mb = $('#menu-btn'); if (mb) mb.onclick = showMenu; }
let unlocked = false;
try { unlocked = localStorage.getItem(UNLOCK_KEY) === '1'; } catch (_) {}
if (unlocked) showTitle(); else showGate();
