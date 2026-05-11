// Triad — prototype v0.1 (landscape rebuild)
// Each turn the player chooses ONE of: X/Y/Z (techs of Front/Mid/Back occupants),
// Move (swap two members, no attack), Defend (+armor & resolve, no attack).
// Signatures cost Resolve and lock that slot for one turn → rotation pressure.
// Characters are extreme specialists: one home slot dominates, others fall off.
// Enemies telegraph the slot they target so positioning is the puzzle.

// ============================================================================
// SVG PORTRAITS
// ============================================================================

const PORTRAITS = {
  cassia: `
<svg viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <defs><radialGradient id="pc-cassia" cx="50%" cy="35%" r="80%">
    <stop offset="0" stop-color="#5a3820"/><stop offset="1" stop-color="#1a0e08"/></radialGradient></defs>
  <rect width="100" height="130" fill="url(#pc-cassia)"/>
  <path d="M 50 28 Q 32 30 30 50 L 30 78 Q 35 95 50 98 Q 65 95 70 78 L 70 50 Q 68 30 50 28 Z" fill="#9a7838" stroke="#3a2410" stroke-width="1.5"/>
  <rect x="34" y="58" width="32" height="4" fill="#0a0805"/>
  <path d="M 47 28 L 50 18 L 53 28 Z" fill="#c8a464" stroke="#5a3820" stroke-width="0.5"/>
  <rect x="49" y="62" width="2" height="14" fill="#3a2410"/>
  <path d="M 28 95 Q 50 105 72 95 L 72 130 L 28 130 Z" fill="#5a3820" stroke="#2a1808" stroke-width="1"/>
  <path d="M 40 105 L 60 105 L 58 122 L 42 122 Z" fill="#7a5828" opacity="0.6"/>
</svg>`,
  elin: `
<svg viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <defs><radialGradient id="pc-elin" cx="50%" cy="35%" r="75%">
    <stop offset="0" stop-color="#3a4a6a"/><stop offset="1" stop-color="#0a1018"/></radialGradient></defs>
  <rect width="100" height="130" fill="url(#pc-elin)"/>
  <circle cx="50" cy="42" r="24" fill="none" stroke="#e8dcc4" stroke-width="0.8" opacity="0.4"/>
  <circle cx="50" cy="42" r="16" fill="none" stroke="#f0e8c0" stroke-width="0.5" opacity="0.5"/>
  <path d="M 50 25 Q 25 25 25 50 L 25 90 L 30 90 Q 32 50 50 48 Q 68 50 70 90 L 75 90 L 75 50 Q 75 25 50 25 Z" fill="#3a3848" stroke="#1a1828" stroke-width="1"/>
  <ellipse cx="50" cy="62" rx="14" ry="18" fill="#0a0a14"/>
  <circle cx="44" cy="60" r="1.3" fill="#e8dcc4"/>
  <circle cx="56" cy="60" r="1.3" fill="#e8dcc4"/>
  <path d="M 25 88 L 75 88 L 80 130 L 20 130 Z" fill="#28283a" stroke="#1a1a28" stroke-width="1"/>
  <path d="M 47 102 L 53 102 L 53 110 L 57 110 L 57 113 L 53 113 L 53 122 L 47 122 L 47 113 L 43 113 L 43 110 L 47 110 Z" fill="#e8dcc4" opacity="0.7"/>
</svg>`,
  branwen: `
<svg viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <defs><radialGradient id="pc-branwen" cx="50%" cy="40%" r="80%">
    <stop offset="0" stop-color="#384828"/><stop offset="1" stop-color="#0a1408"/></radialGradient></defs>
  <rect width="100" height="130" fill="url(#pc-branwen)"/>
  <path d="M 20 30 Q 14 65 20 100" fill="none" stroke="#5a3820" stroke-width="2.5"/>
  <path d="M 20 30 L 20 100" stroke="#3a2410" stroke-width="0.8"/>
  <path d="M 50 28 Q 28 30 30 55 L 28 90 L 34 90 Q 36 55 50 52 Q 64 55 66 90 L 72 90 L 70 55 Q 72 30 50 28 Z" fill="#3a4828" stroke="#1a2410" stroke-width="1"/>
  <ellipse cx="50" cy="62" rx="13" ry="16" fill="#1a1408"/>
  <circle cx="45" cy="60" r="1" fill="#c8a464"/>
  <circle cx="55" cy="60" r="1" fill="#c8a464"/>
  <path d="M 52 64 L 56 70" stroke="#c44040" stroke-width="0.6"/>
  <path d="M 28 88 L 72 88 L 78 130 L 22 130 Z" fill="#2a3818" stroke="#1a2410" stroke-width="1"/>
  <rect x="25" y="100" width="50" height="3" fill="#5a3820"/>
  <line x1="80" y1="30" x2="86" y2="100" stroke="#7a5828" stroke-width="1"/>
  <polygon points="78,28 84,28 81,22" fill="#c8a464"/>
</svg>`,
  ghoul: `
<svg viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <defs><radialGradient id="pc-ghoul" cx="50%" cy="40%" r="80%">
    <stop offset="0" stop-color="#4a3a30"/><stop offset="1" stop-color="#0a0805"/></radialGradient></defs>
  <rect width="100" height="130" fill="url(#pc-ghoul)"/>
  <ellipse cx="50" cy="62" rx="28" ry="35" fill="#6a5a48" stroke="#2a1808" stroke-width="1"/>
  <ellipse cx="40" cy="57" rx="4" ry="5" fill="#0a0805"/>
  <ellipse cx="60" cy="57" rx="4" ry="5" fill="#0a0805"/>
  <circle cx="40" cy="58" r="1.4" fill="#c44040"/>
  <circle cx="60" cy="58" r="1.4" fill="#c44040"/>
  <path d="M 35 80 Q 50 95 65 80 L 65 82 Q 50 92 35 82 Z" fill="#1a0808"/>
  <polygon points="37,80 39,88 41,80" fill="#e8dcc4"/>
  <polygon points="44,80 46,90 48,80" fill="#e8dcc4"/>
  <polygon points="52,80 54,90 56,80" fill="#e8dcc4"/>
  <polygon points="59,80 61,88 63,80" fill="#e8dcc4"/>
  <path d="M 20 97 Q 30 88 40 92 L 40 130 L 18 130 Z" fill="#4a3828"/>
  <path d="M 80 97 Q 70 88 60 92 L 60 130 L 82 130 Z" fill="#4a3828"/>
  <path d="M 40 92 L 60 92 L 64 130 L 36 130 Z" fill="#2a1810"/>
</svg>`,
  cultist: `
<svg viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <defs><radialGradient id="pc-cultist" cx="50%" cy="30%" r="80%">
    <stop offset="0" stop-color="#3a2848"/><stop offset="1" stop-color="#0a0a14"/></radialGradient></defs>
  <rect width="100" height="130" fill="url(#pc-cultist)"/>
  <path d="M 50 18 L 24 95 L 76 95 Z" fill="#1a1018" stroke="#0a050a" stroke-width="1"/>
  <ellipse cx="50" cy="64" rx="14" ry="18" fill="#0a0508"/>
  <ellipse cx="50" cy="60" rx="3" ry="5" fill="#c44040" opacity="0.9"/>
  <circle cx="50" cy="60" r="1.5" fill="#f0e0a0"/>
  <path d="M 24 93 L 76 93 L 84 130 L 16 130 Z" fill="#241828" stroke="#1a1018" stroke-width="1"/>
  <rect x="35" y="108" width="30" height="2" fill="#4a3a20"/>
</svg>`,
  wraith: `
<svg viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <defs><radialGradient id="pc-wraith" cx="50%" cy="40%" r="80%">
    <stop offset="0" stop-color="#2a3a4a"/><stop offset="1" stop-color="#050810"/></radialGradient></defs>
  <rect width="100" height="130" fill="url(#pc-wraith)"/>
  <path d="M 15 115 Q 25 108 35 115 Q 45 108 55 115 Q 65 108 75 115 Q 85 108 85 115" stroke="#8ab0c8" stroke-width="0.4" fill="none" opacity="0.4"/>
  <ellipse cx="50" cy="58" rx="22" ry="32" fill="#3a4a5a" opacity="0.6"/>
  <ellipse cx="50" cy="58" rx="18" ry="28" fill="#4a5a6a" opacity="0.6"/>
  <ellipse cx="42" cy="55" rx="3.5" ry="6" fill="#050810"/>
  <ellipse cx="58" cy="55" rx="3.5" ry="6" fill="#050810"/>
  <circle cx="42" cy="56" r="1.2" fill="#8ac8e8"/>
  <circle cx="58" cy="56" r="1.2" fill="#8ac8e8"/>
  <ellipse cx="50" cy="78" rx="6" ry="9" fill="#050810"/>
  <path d="M 30 90 L 30 105 L 35 100 L 40 110 L 45 102 L 50 112 L 55 102 L 60 110 L 65 100 L 70 105 L 70 90 Z" fill="#2a3a4a" opacity="0.7"/>
</svg>`,
};

// ============================================================================
// CONSTANTS
// ============================================================================

const SLOTS = ['front', 'mid', 'back'];
const SLOT_LABELS = { front: 'Front', mid: 'Mid', back: 'Back' };
// visual display orders so the rows face each other (party right-edge = Front, enemy left-edge = Front)
const PARTY_DISPLAY_ORDER = ['back', 'mid', 'front'];
const ENEMY_DISPLAY_ORDER = ['front', 'mid', 'back'];
const SIG_COST = 3;
const RESOLVE_MAX = 5;
const RESOLVE_DRIP = 1;
const KILL_RESOLVE = 2;
const DEFEND_ARMOR = 3;
const DEFEND_RESOLVE = 1;

// stagger / chain
const STAGGER_THRESHOLD = 30;
const STAGGER_DMG_MULT = 1.5; // damage taken while staggered
const STAGGER_DURATION = 1;   // skipped enemy turns

// ============================================================================
// CHARACTERS — extreme specialists: one home slot, one ok, one weak
// passive applies always; home slot is where they shine
// ============================================================================

const CHARS = {
  cassia: {
    id: 'cassia',
    name: 'Cassia',
    title: 'Disgraced Knight',
    maxHp: 26,
    home: 'front',
    passive: { name: 'Steadfast', desc: '−1 dmg taken in Front' },
    techs: {
      front: {
        basic: { name: 'Greatsword Cleave', desc: '8 dmg + vuln', fn: (s) => { dmgEnemyAt(s, 0, 8); applyVulnEnemy(s, 0, 1); } },
        sig:   { name: 'Sunder',            desc: '14 dmg + strip armor + 2 vuln', fn: (s) => { dmgEnemyAt(s, 0, 14); stripArmor(s, 0); applyVulnEnemy(s, 0, 2); } },
      },
      mid: {
        basic: { name: 'Vanguard',      desc: '5 dmg + advance to Front', fn: (s) => { dmgEnemyAt(s, 0, 5); advance(s, 'cassia'); } },
        sig:   { name: 'Heroic Charge', desc: '9 dmg + advance + 3 armor', fn: (s) => { dmgEnemyAt(s, 0, 9); advance(s, 'cassia'); addArmor(s, 'cassia', 3); } },
      },
      back: {
        basic: { name: 'Banner', desc: '+2 armor party', fn: (s) => partyArmor(s, 2) },
        sig:   { name: 'Rally',  desc: 'Heal 4 to party', fn: (s) => partyHeal(s, 4) },
      },
    },
  },
  elin: {
    id: 'elin',
    name: 'Elin',
    title: 'Sister of the Veil',
    maxHp: 19,
    home: 'mid',
    passive: { name: 'Mercy', desc: 'Heals self 1 when healing an ally' },
    techs: {
      front: {
        basic: { name: 'Phase Step', desc: '3 dmg + retreat to Mid', fn: (s) => { dmgEnemyAt(s, 0, 3); retreat(s, 'elin'); } },
        sig:   { name: 'Veil Step',  desc: '6 dmg + retreat + 2 armor', fn: (s) => { dmgEnemyAt(s, 0, 6); retreat(s, 'elin'); addArmor(s, 'elin', 2); } },
      },
      mid: {
        basic: { name: 'Mend',         desc: 'Heal 6 lowest + cleanse', fn: (s) => { healLowest(s, 6); cleanseLowest(s); } },
        sig:   { name: 'Greater Mend', desc: 'Heal 12 lowest + cleanse + 2 armor', fn: (s) => { const c = healLowest(s, 12); cleanseLowest(s); if (c) c.armor += 2; } },
      },
      back: {
        basic: { name: 'Prayer',    desc: '+2 Resolve, heal 3 lowest', fn: (s) => { gainResolve(s, 2); healLowest(s, 3); } },
        sig:   { name: 'Sanctuary', desc: '+4 armor to party', fn: (s) => partyArmor(s, 4) },
      },
    },
  },
  branwen: {
    id: 'branwen',
    name: 'Branwen',
    title: 'Outlaw Archer',
    maxHp: 17,
    home: 'back',
    passive: { name: 'Bleed Hunter', desc: '+2 dmg to bleeding enemies' },
    techs: {
      front: {
        basic: { name: 'Backstep Shot', desc: '4 dmg + bleed 1 + retreat to Back', fn: (s) => { dmgEnemyAt(s, 0, 4); bleedEnemyAt(s, 0, 1); retreatFull(s, 'branwen'); } },
        sig:   { name: 'Vanish Shot',   desc: '7 dmg + bleed 2 + retreat + 1 vuln', fn: (s) => { dmgEnemyAt(s, 0, 7); bleedEnemyAt(s, 0, 2); retreatFull(s, 'branwen'); applyVulnEnemy(s, 0, 1); } },
      },
      mid: {
        basic: { name: 'Trick Shot', desc: '5 dmg lowest-HP enemy', fn: (s) => dmgEnemyLowest(s, 5) },
        sig:   { name: 'Pierce',     desc: '8 dmg lowest + ignore armor', fn: (s) => { s.ignoreArmor = true; dmgEnemyLowest(s, 8); s.ignoreArmor = false; } },
      },
      back: {
        basic: { name: 'Volley',      desc: '4 dmg + bleed 1 all', fn: (s) => { dmgAllEnemies(s, 4); aliveEnemies(s).forEach(e => e.bleed = Math.max(e.bleed, 1)); } },
        sig:   { name: 'Arrow Storm', desc: '7 dmg + bleed 2 all', fn: (s) => { dmgAllEnemies(s, 7); aliveEnemies(s).forEach(e => e.bleed = Math.max(e.bleed, 2)); } },
      },
    },
  },
};

// ============================================================================
// ENEMIES — slot-targeted intents create the positioning puzzle
// ============================================================================

const ENEMIES = {
  ghoul: {
    id: 'ghoul', name: 'Ghoul', title: 'Sin of Hunger', maxHp: 14,
    intents: [
      { name: 'Bite',    tag: 'ATK 6',          targetSlot: 'front', kind: 'atk', fn: (s) => dmgPartyAt(s, 'front', 6) },
      { name: 'Charge',  tag: 'ATK 4 + shove',  targetSlot: 'front', kind: 'atk', fn: (s) => { dmgPartyAt(s, 'front', 4); enemyShove(s, 'front', 'back'); } },
      { name: 'Frenzy',  tag: 'ATK 3 + bleed',  targetSlot: 'front', kind: 'atk', fn: (s) => { dmgPartyAt(s, 'front', 3); bleedPartyAt(s, 'front', 2); } },
    ],
  },
  cultist: {
    id: 'cultist', name: 'Cultist', title: 'Sin of Whispers', maxHp: 10,
    intents: [
      { name: 'Curse',     tag: 'WEAK 2',         targetSlot: 'front', kind: 'debuff', fn: (s) => weakSlot(s, 'front', 2) },
      { name: 'Hex',       tag: 'ATK 2 + weak',   targetSlot: 'front', kind: 'atk',    fn: (s) => { dmgPartyAt(s, 'front', 2); weakSlot(s, 'front', 1); } },
      { name: 'Doom Mark', tag: 'ATK 2 + vuln',   targetSlot: 'back',  kind: 'debuff', fn: (s) => { dmgPartyAt(s, 'back', 2); applyVulnParty(s, 'back', 1); } },
    ],
  },
  wraith: {
    id: 'wraith', name: 'Wraith', title: 'Sin of Sorrow', maxHp: 9,
    intents: [
      { name: 'Spectral Bolt', tag: 'ATK 5',     targetSlot: 'back', kind: 'atk', fn: (s) => dmgPartyAt(s, 'back', 5) },
      { name: 'Wail',          tag: 'ATK 2 all', targetSlot: 'all',  kind: 'aoe', fn: (s) => dmgAllParty(s, 2) },
      { name: 'Drain',         tag: 'ATK 3 low', targetSlot: '?',    kind: 'atk', fn: (s) => dmgLowestParty(s, 3) },
    ],
  },
};

// ============================================================================
// ADJACENCY — pair synergies between adjacent positions (F-M and M-B)
// ============================================================================

const ADJ = {
  'cassia+elin': {
    name: "Sister's Watch", type: 'bond',
    onPartyHit(s, id) { if (id === 'cassia') gainResolve(s, 1); },
  },
  'branwen+cassia': {
    name: 'Old Rivalry', type: 'friction',
    dmgMod: -2, // applied to Branwen's outgoing damage
  },
  'branwen+elin': {
    name: "Mercy's Gift", type: 'bond',
    onElinHeal(s) {
      const b = s.party.chars.branwen;
      if (b && !b.downed) { b.hp = Math.min(b.maxHp, b.hp + 1); spawnPopupId('branwen', '+1', 'heal'); }
    },
  },
};

// ============================================================================
// STATE
// ============================================================================

let state;

function newState() {
  return {
    turn: 1,
    resolve: 0,
    moveArmed: false,
    moveSelection: null,
    over: false,
    outgoingDmgMod: 0,
    ignoreArmor: false,
    currentActorId: null, // who is acting right now (for passives + adjacency hooks)

    party: {
      slots: { front: 'cassia', mid: 'elin', back: 'branwen' },
      chars: {
        cassia:  newCharState('cassia'),
        elin:    newCharState('elin'),
        branwen: newCharState('branwen'),
      },
      lockedSlot: null,
      pendingLock: null,
    },

    enemies: {
      slots: { front: 'ghoul', mid: 'cultist', back: 'wraith' },
      chars: {
        ghoul:   newEnemyState('ghoul'),
        cultist: newEnemyState('cultist'),
        wraith:  newEnemyState('wraith'),
      },
    },

    messages: [],
  };
}

function newCharState(id) {
  const def = CHARS[id];
  return {
    id, hp: def.maxHp, maxHp: def.maxHp,
    armor: 0, bleed: 0, weak: 0, taunt: false, retaliate: 0, vuln: 0,
    downed: false,
  };
}
function newEnemyState(id) {
  const def = ENEMIES[id];
  return {
    id, hp: def.maxHp, maxHp: def.maxHp,
    armor: 0, bleed: 0, vuln: 0,
    chain: 0, staggered: false, staggerTurns: 0,
    dead: false, intentIdx: 0,
  };
}

// ============================================================================
// QUERY HELPERS
// ============================================================================

function charBySlot(s, slot) { const id = s.party.slots[slot]; return id ? s.party.chars[id] : null; }
function enemyBySlot(s, slot) { const id = s.enemies.slots[slot]; return id ? s.enemies.chars[id] : null; }
function slotOfChar(s, id) { return SLOTS.find(sl => s.party.slots[sl] === id); }
function aliveParty(s) { return Object.values(s.party.chars).filter(c => !c.downed); }
function aliveEnemies(s) { return Object.values(s.enemies.chars).filter(e => !e.dead); }
function firstAliveEnemyFrom(s, startIdx) {
  for (let i = startIdx; i < 3; i++) { const e = enemyBySlot(s, SLOTS[i]); if (e && !e.dead) return e; }
  for (let i = startIdx - 1; i >= 0; i--) { const e = enemyBySlot(s, SLOTS[i]); if (e && !e.dead) return e; }
  return null;
}

// ============================================================================
// DAMAGE / HEAL — apply with popups + flashes
// ============================================================================

function applyDmgToEnemy(s, e, baseAmt) {
  if (!e || e.dead) return;
  let amt = baseAmt;

  // current actor mods (weak self, branwen friction, branwen bleed-hunter)
  if (s.currentActorId === 'branwen') {
    if (isAdjacent(s, 'branwen', 'cassia')) amt -= 2; // Old Rivalry friction
    if (e.bleed > 0) amt += 2;                         // Bleed Hunter passive
  }
  amt += s.outgoingDmgMod;

  // vulnerable adds +2 per stack consumed (1 stack per hit)
  let vulnConsumed = 0;
  if (e.vuln > 0 && amt > 0) { amt += 2; vulnConsumed = 1; }

  // staggered = +50% damage taken
  if (e.staggered && amt > 0) amt = Math.floor(amt * STAGGER_DMG_MULT);

  amt = Math.max(0, amt);
  if (amt === 0) {
    spawnPopupId(e.id, 'miss', 'miss', 'enemy');
    log(`<b>${ENEMIES[e.id].name}</b> shrugs it off.`);
    return;
  }

  let toHp = amt;
  if (!s.ignoreArmor) {
    const absorbed = Math.min(e.armor, amt);
    e.armor = Math.max(0, e.armor - amt);
    toHp = amt - absorbed;
  }
  e.hp = Math.max(0, e.hp - toHp);
  if (vulnConsumed) e.vuln = Math.max(0, e.vuln - 1);

  // chain build-up (skipped if already staggered or no HP damage)
  if (!e.staggered && toHp > 0) {
    let chainGain = toHp;
    if (vulnConsumed) chainGain *= 2;
    e.chain = Math.min(STAGGER_THRESHOLD, e.chain + chainGain);
    if (e.chain >= STAGGER_THRESHOLD) triggerStagger(s, e);
  }

  const popupType = e.staggered ? 'crit' : 'dmg';
  spawnPopupId(e.id, `-${toHp}`, popupType, 'enemy');
  flashCardId(e.id, 'hit', 'enemy');
  log(`<b>${ENEMIES[e.id].name}</b> takes ${toHp} damage${e.staggered ? ' (stagger!)' : ''}.`);
  if (e.hp === 0) killEnemy(s, e);
}

function triggerStagger(s, e) {
  e.staggered = true;
  e.staggerTurns = STAGGER_DURATION;
  spawnPopupId(e.id, 'STAGGER', 'stagger', 'enemy');
  flashCardId(e.id, 'hit', 'enemy');
  log(`<b>${ENEMIES[e.id].name}</b> is STAGGERED!`);
}

function killEnemy(s, e) {
  e.dead = true;
  log(`<b>${ENEMIES[e.id].name}</b> falls.`);
  gainResolve(s, KILL_RESOLVE);
}

function applyDmgToParty(s, c, amt) {
  if (!c || c.downed) return;
  // Cassia "Steadfast" — -1 dmg when in Front
  if (c.id === 'cassia' && slotOfChar(s, 'cassia') === 'front') amt = Math.max(0, amt - 1);
  // Vulnerable on party
  if (c.vuln > 0 && amt > 0) { amt += 2; c.vuln = Math.max(0, c.vuln - 1); }

  const absorbed = Math.min(c.armor, amt);
  c.armor = Math.max(0, c.armor - amt);
  const toHp = amt - absorbed;
  c.hp = Math.max(0, c.hp - toHp);

  spawnPopupId(c.id, `-${toHp}`, 'dmg', 'party');
  flashCardId(c.id, 'hit', 'party');
  log(`<b>${CHARS[c.id].name}</b> takes ${toHp} damage.`);

  // Adjacency: Sister's Watch — Elin gains Resolve when Cassia is hit
  getAdjacencyPairs(s).forEach(p => { if (p.synergy.onPartyHit) p.synergy.onPartyHit(s, c.id); });

  // Retaliate
  if (c.retaliate > 0 && toHp > 0) {
    log(`<b>${CHARS[c.id].name}</b> retaliates!`);
    const target = firstAliveEnemyFrom(s, 0);
    if (target) applyDmgToEnemy(s, target, c.retaliate);
  }

  if (c.hp === 0) {
    c.downed = true;
    log(`<b>${CHARS[c.id].name}</b> falls.`);
  }
}

function applySelfDmg(s, charId, amt) {
  const c = s.party.chars[charId];
  if (!c || c.downed) return;
  c.hp = Math.max(0, c.hp - amt);
  spawnPopupId(charId, `-${amt}`, 'dmg', 'party');
  flashCardId(charId, 'hit', 'party');
  log(`<b>${CHARS[charId].name}</b> takes ${amt} self damage.`);
  if (c.hp === 0) { c.downed = true; log(`<b>${CHARS[charId].name}</b> falls.`); }
}

// ============================================================================
// EFFECT HELPERS (used by techs/intents)
// ============================================================================

function dmgEnemyAt(s, startIdx, amt) {
  const e = firstAliveEnemyFrom(s, startIdx);
  if (e) applyDmgToEnemy(s, e, amt);
}
function dmgEnemyLowest(s, amt) {
  const alive = aliveEnemies(s); if (alive.length === 0) return;
  alive.sort((a, b) => a.hp - b.hp);
  applyDmgToEnemy(s, alive[0], amt);
}
function dmgAllEnemies(s, amt) { aliveEnemies(s).forEach(e => applyDmgToEnemy(s, e, amt)); }

function stripArmor(s, idx) {
  const e = firstAliveEnemyFrom(s, idx);
  if (e) e.armor = 0;
}
function bleedEnemyAt(s, idx, turns) {
  const e = firstAliveEnemyFrom(s, idx);
  if (e) e.bleed = Math.max(e.bleed, turns);
}
function applyVulnEnemy(s, idx, stacks) {
  const e = firstAliveEnemyFrom(s, idx);
  if (e) e.vuln += stacks;
}

function addArmor(s, id, amt) { const c = s.party.chars[id]; if (c && !c.downed) c.armor += amt; }
function partyArmor(s, amt) { aliveParty(s).forEach(c => { c.armor += amt; spawnPopupId(c.id, `+${amt}⛨`, 'armor', 'party'); }); }
function partyHeal(s, amt) {
  aliveParty(s).forEach(c => {
    const before = c.hp;
    c.hp = Math.min(c.maxHp, c.hp + amt);
    const got = c.hp - before;
    if (got > 0) spawnPopupId(c.id, `+${got}`, 'heal', 'party');
  });
  triggerElinHeal(s);
}
function healLowest(s, amt) {
  const alive = aliveParty(s); if (alive.length === 0) return null;
  alive.sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp));
  const c = alive[0];
  const before = c.hp;
  c.hp = Math.min(c.maxHp, c.hp + amt);
  const got = c.hp - before;
  if (got > 0) { spawnPopupId(c.id, `+${got}`, 'heal', 'party'); flashCardId(c.id, 'heal', 'party'); }
  // Elin passive: heal self 1 when healing an ally
  if (s.currentActorId === 'elin' && c.id !== 'elin') {
    const e = s.party.chars.elin;
    const eb = e.hp; e.hp = Math.min(e.maxHp, e.hp + 1);
    if (e.hp - eb > 0) spawnPopupId('elin', '+1', 'heal', 'party');
  }
  triggerElinHeal(s);
  return c;
}
function cleanseLowest(s) {
  const alive = aliveParty(s); if (alive.length === 0) return;
  alive.sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp));
  const c = alive[0]; c.bleed = 0; c.weak = 0;
}
function taunt(s, id) { const c = s.party.chars[id]; if (c && !c.downed) c.taunt = true; }
function gainResolve(s, amt) {
  const before = s.resolve;
  s.resolve = Math.min(RESOLVE_MAX, s.resolve + amt);
  if (s.resolve > before) flashResolve();
}

function triggerElinHeal(s) {
  if (s.currentActorId !== 'elin') return;
  getAdjacencyPairs(s).forEach(p => { if (p.synergy.onElinHeal) p.synergy.onElinHeal(s); });
}

// Enemy → party effects (slot-targeted)
function dmgPartyAt(s, slot, amt) {
  const tauntee = aliveParty(s).find(c => c.taunt);
  let target = tauntee || charBySlot(s, slot);
  if (!target || target.downed) target = aliveParty(s)[0];
  if (target) applyDmgToParty(s, target, amt);
}
function dmgLowestParty(s, amt) {
  const tauntee = aliveParty(s).find(c => c.taunt);
  if (tauntee) return applyDmgToParty(s, tauntee, amt);
  const alive = aliveParty(s); if (alive.length === 0) return;
  alive.sort((a, b) => a.hp - b.hp);
  applyDmgToParty(s, alive[0], amt);
}
function dmgAllParty(s, amt) { aliveParty(s).forEach(c => applyDmgToParty(s, c, amt)); }
function weakSlot(s, slot, amt) {
  const c = charBySlot(s, slot);
  if (c && !c.downed) { c.weak += amt; log(`<b>${CHARS[c.id].name}</b> gains Weak.`); }
}
function bleedPartyAt(s, slot, turns) {
  const c = charBySlot(s, slot);
  if (c && !c.downed) c.bleed = Math.max(c.bleed, turns);
}
function applyVulnParty(s, slot, stacks) {
  const c = charBySlot(s, slot);
  if (c && !c.downed) c.vuln += stacks;
}

// ============================================================================
// POSITIONING — swap helpers used by abilities and forced-rotation intents
// ============================================================================

function swapWith(s, charId, targetSlot) {
  const fromSlot = slotOfChar(s, charId);
  if (!fromSlot || fromSlot === targetSlot) return;
  const other = s.party.slots[targetSlot];
  s.party.slots[fromSlot] = other;
  s.party.slots[targetSlot] = charId;
  log(`<b>${CHARS[charId].name}</b> moves to ${SLOT_LABELS[targetSlot]}.`);
}
function advance(s, charId) {
  const slot = slotOfChar(s, charId);
  if (slot === 'mid')  swapWith(s, charId, 'front');
  else if (slot === 'back') swapWith(s, charId, 'mid');
}
function retreat(s, charId) {
  const slot = slotOfChar(s, charId);
  if (slot === 'front') swapWith(s, charId, 'mid');
  else if (slot === 'mid')  swapWith(s, charId, 'back');
}
function retreatFull(s, charId) {
  const slot = slotOfChar(s, charId);
  if (slot === 'front') swapWith(s, charId, 'back');
  else if (slot === 'mid')  swapWith(s, charId, 'back');
}
// enemy effect: shove the player in fromSlot to toSlot, swapping with whoever's there
function enemyShove(s, fromSlot, toSlot) {
  const a = s.party.slots[fromSlot], b = s.party.slots[toSlot];
  if (!a || !b) return;
  if (s.party.chars[a].downed) return;
  s.party.slots[fromSlot] = b;
  s.party.slots[toSlot]   = a;
  log(`<b>${CHARS[a].name}</b> is shoved to ${SLOT_LABELS[toSlot]}.`);
}

// ============================================================================
// ADJACENCY
// ============================================================================

function isAdjacent(s, idA, idB) {
  const a = slotOfChar(s, idA), b = slotOfChar(s, idB);
  if (!a || !b) return false;
  const pairs = [['front','mid'], ['mid','back']];
  return pairs.some(p => (p[0]===a && p[1]===b) || (p[0]===b && p[1]===a));
}
function adjKey(a, b) { return [a, b].sort().join('+'); }
function getAdjacencyPairs(s) {
  const pairs = [];
  [['front','mid'], ['mid','back']].forEach(([sa, sb]) => {
    const a = s.party.slots[sa], b = s.party.slots[sb];
    if (!a || !b) return;
    if (s.party.chars[a].downed || s.party.chars[b].downed) return;
    const k = adjKey(a, b);
    if (ADJ[k]) pairs.push({ ids: [a, b], synergy: ADJ[k], key: k });
  });
  return pairs;
}

// ============================================================================
// TURN FLOW
// ============================================================================

function startTurn(s) {
  s.messages = [];
  log(`<span class="msg-strong">— Turn ${s.turn} —</span>`);

  s.party.lockedSlot = s.party.pendingLock;
  s.party.pendingLock = null;

  // bleed tick
  aliveParty(s).forEach(c => {
    if (c.bleed > 0) {
      const dmg = 2;
      c.hp = Math.max(0, c.hp - dmg); c.bleed -= 1;
      spawnPopupId(c.id, `-${dmg}`, 'dmg', 'party');
      flashCardId(c.id, 'hit', 'party');
      log(`<b>${CHARS[c.id].name}</b> bleeds (${dmg}).`);
      if (c.hp === 0) { c.downed = true; log(`<b>${CHARS[c.id].name}</b> falls.`); }
    }
  });
  aliveEnemies(s).forEach(e => {
    if (e.bleed > 0) {
      const dmg = Math.max(0, 2 - (s.ignoreArmor ? 0 : e.armor));
      e.hp = Math.max(0, e.hp - dmg); e.bleed -= 1;
      if (dmg > 0) { spawnPopupId(e.id, `-${dmg}`, 'dmg', 'enemy'); flashCardId(e.id, 'hit', 'enemy'); }
      log(`<b>${ENEMIES[e.id].name}</b> bleeds (${dmg}).`);
      if (e.hp === 0) killEnemy(s, e);
    }
  });

  gainResolve(s, RESOLVE_DRIP);

  // queue intents — ensure each living enemy has a valid intent index
  aliveEnemies(s).forEach(e => { e.intentIdx = e.intentIdx % ENEMIES[e.id].intents.length; });

  checkEnd(s);
  render();
}

function playerAct(actionKey, wantSig) {
  if (state.over) return;
  const slot = { X: 'front', Y: 'mid', Z: 'back' }[actionKey];
  if (!slot) return;
  if (state.party.lockedSlot === slot) { flashMsg(`${SLOT_LABELS[slot].toUpperCase()} is locked — rotate to refresh.`); return; }
  const charId = state.party.slots[slot];
  const c = state.party.chars[charId];
  if (!c || c.downed) { flashMsg(`That slot is empty.`); return; }

  const techDef = CHARS[charId].techs[slot];
  const useSig = !!wantSig && state.resolve >= SIG_COST;
  const variant = useSig ? techDef.sig : techDef.basic;

  log(`<b>${CHARS[charId].name}</b> uses <b>${variant.name}</b>${useSig ? ' ★' : ''}.`);

  state.currentActorId = charId;
  state.outgoingDmgMod = c.weak > 0 ? -2 : 0;
  try { variant.fn(state); }
  finally {
    state.outgoingDmgMod = 0;
    state.ignoreArmor = false;
    state.currentActorId = null;
  }
  if (c.weak > 0) c.weak = Math.max(0, c.weak - 1);

  if (useSig) {
    state.resolve -= SIG_COST;
    state.party.pendingLock = slot;
    log(`${SLOT_LABELS[slot].toUpperCase()} locked next turn.`);
  }

  endPlayerTurn();
}

function playerMove(slotA, slotB) {
  const s = state;
  const t = s.party.slots[slotA]; s.party.slots[slotA] = s.party.slots[slotB]; s.party.slots[slotB] = t;
  log(`Party rotates.`);
  s.moveArmed = false; s.moveSelection = null;
  endPlayerTurn();
}

function playerDefend() {
  partyArmor(state, DEFEND_ARMOR);
  gainResolve(state, DEFEND_RESOLVE);
  log(`Party braces (+${DEFEND_ARMOR} armor, +${DEFEND_RESOLVE} Resolve).`);
  endPlayerTurn();
}

function endPlayerTurn() {
  const s = state;
  aliveParty(s).forEach(c => { c.taunt = false; c.retaliate = 0; });

  if (checkEnd(s)) { render(); return; }

  // ENEMY TURN — animated slightly: render first, then resolve after a beat
  render();
  setTimeout(() => resolveEnemyTurn(s), 450);
}

function resolveEnemyTurn(s) {
  for (const e of aliveEnemies(s)) {
    if (s.over) break;
    if (e.staggered) {
      log(`<b>${ENEMIES[e.id].name}</b> is staggered — cannot act.`);
      e.staggerTurns -= 1;
      if (e.staggerTurns <= 0) {
        e.staggered = false;
        e.chain = 0;
        log(`<b>${ENEMIES[e.id].name}</b> recovers.`);
      }
      continue;
    }
    const def = ENEMIES[e.id];
    const intent = def.intents[e.intentIdx % def.intents.length];
    log(`<b>${def.name}</b> uses <b>${intent.name}</b>.`);
    intent.fn(s);
    if (checkEnd(s)) break;
    e.intentIdx = (e.intentIdx + 1) % def.intents.length;
  }
  if (s.over) { render(); return; }
  s.turn += 1;
  startTurn(s);
}

function checkEnd(s) {
  if (s.over) return true;
  if (aliveEnemies(s).length === 0) {
    s.over = true;
    showOverlay('Victory', 'The sins are unbound — for a moment. Rest before the next reach.');
    return true;
  }
  if (aliveParty(s).length === 0) {
    s.over = true;
    showOverlay('Defeat', 'Your order is dust. The sins walk on.');
    return true;
  }
  return false;
}

// ============================================================================
// UI — RENDER
// ============================================================================

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function render() {
  renderHUD();
  renderColumns();
  renderActions();
  renderControls();
  renderMessages();
}

function renderHUD() {
  $('#turn-num').textContent = state.turn;
  const pips = $('#resolve-pips'); pips.innerHTML = '';
  for (let i = 0; i < RESOLVE_MAX; i++) {
    const p = document.createElement('div');
    p.className = 'pip' + (i < state.resolve ? ' filled' : '');
    pips.appendChild(p);
  }
}

function flashResolve() {
  $('#resolve-pips').animate(
    [{ filter: 'brightness(2)' }, { filter: 'brightness(1)' }],
    { duration: 350 }
  );
}

function renderColumns() {
  // determine which player slots are targeted by enemy intents
  const threatened = new Set();
  aliveEnemies(state).forEach(e => {
    const intent = ENEMIES[e.id].intents[e.intentIdx % ENEMIES[e.id].intents.length];
    if (intent.targetSlot === 'all') SLOTS.forEach(s => threatened.add(s));
    else if (intent.targetSlot && intent.targetSlot !== '?') threatened.add(intent.targetSlot);
  });

  // adjacency map for visual borders
  const adjMap = {};
  getAdjacencyPairs(state).forEach(p => {
    p.ids.forEach(id => {
      if (!adjMap[id] || p.synergy.type === 'friction') adjMap[id] = p.synergy.type;
    });
  });

  const partyCol = $('#party-col'); partyCol.innerHTML = '';
  PARTY_DISPLAY_ORDER.forEach(slot => {
    const c = charBySlot(state, slot);
    partyCol.appendChild(makePartyCard(c, slot, threatened.has(slot), adjMap));
  });

  const enemyCol = $('#enemy-col'); enemyCol.innerHTML = '';
  ENEMY_DISPLAY_ORDER.forEach(slot => {
    const e = enemyBySlot(state, slot);
    enemyCol.appendChild(makeEnemyCard(e, slot));
  });
}

function makePartyCard(c, slot, threatened, adjMap) {
  const card = document.createElement('div');
  card.className = 'card party-card';
  card.dataset.slot = slot;
  if (!c) {
    card.classList.add('empty');
    card.innerHTML = `<div class="slot-banner">${slot}</div><div class="card-portrait"></div><div class="card-bottom"><div class="card-name">—</div></div>`;
    return card;
  }
  card.dataset.id = c.id;
  if (c.downed) card.classList.add('downed');
  if (adjMap[c.id] === 'bond') card.classList.add('adjacent-bond');
  if (adjMap[c.id] === 'friction') card.classList.add('adjacent-friction');
  if (state.moveArmed && state.moveSelection === slot) card.classList.add('selected');
  if (threatened && !c.downed) card.classList.add('targeted-by-enemy');
  if (state.party.lockedSlot === slot) card.classList.add('locked-slot');

  const def = CHARS[c.id];
  const isHome = def.home === slot;
  const hpPct = (c.hp / c.maxHp) * 100;
  card.innerHTML = `
    <div class="slot-banner ${isHome ? 'home' : ''}">${slot}${isHome ? ' · home' : ''}</div>
    <div class="card-portrait">
      ${PORTRAITS[c.id] || ''}
      <div class="card-statuses">${renderStatuses(c)}</div>
    </div>
    <div class="card-bottom">
      <div class="card-name">${def.name}</div>
      <div class="hp-bar">
        <div class="hp-fill ${hpPct < 35 ? 'low' : ''}" style="width:${hpPct}%"></div>
        <div class="hp-text">${c.hp}/${c.maxHp}</div>
      </div>
    </div>
  `;
  card.addEventListener('click', () => onPartyCardClick(slot));
  return card;
}

function makeEnemyCard(e, slot) {
  const card = document.createElement('div');
  card.className = 'card enemy-card';
  card.dataset.slot = slot;
  if (!e || e.dead) {
    card.classList.add('empty');
    card.innerHTML = `<div class="slot-banner">${slot}</div><div class="card-portrait"></div><div class="card-bottom"><div class="card-name">—</div></div>`;
    return card;
  }
  card.dataset.id = e.id;
  if (e.staggered) card.classList.add('staggered');

  const def = ENEMIES[e.id];
  const intent = def.intents[e.intentIdx % def.intents.length];
  const hpPct = (e.hp / e.maxHp) * 100;
  const chainPct = (e.chain / STAGGER_THRESHOLD) * 100;
  const intentClass = intent.kind === 'aoe' ? 'intent-aoe' : (intent.kind === 'debuff' ? 'intent-debuff' : '');
  const targetTag = intent.targetSlot === 'all' ? 'ALL'
    : intent.targetSlot === '?' ? 'LOW'
    : (intent.targetSlot || '').slice(0,1).toUpperCase();

  const staggerBanner = e.staggered ? `<div class="staggered-banner">STAGGERED</div>` : '';

  card.innerHTML = `
    ${e.staggered ? '' : `<div class="intent ${intentClass}"><span>${intent.tag}</span><span class="intent-target">${targetTag}</span></div>`}
    ${staggerBanner}
    <div class="slot-banner">${slot}</div>
    <div class="card-portrait">
      ${PORTRAITS[e.id] || ''}
      <div class="card-statuses">${renderStatuses(e)}</div>
    </div>
    <div class="card-bottom">
      <div class="card-name">${def.name}</div>
      <div class="hp-bar">
        <div class="hp-fill ${hpPct < 35 ? 'low' : ''}" style="width:${hpPct}%"></div>
        <div class="hp-text">${e.hp}/${e.maxHp}</div>
      </div>
      <div class="chain-bar"><div class="chain-fill" style="width:${chainPct}%"></div></div>
    </div>
  `;
  return card;
}

function renderStatuses(ent) {
  const c = [];
  if (ent.armor > 0)     c.push(`<span class="status-chip status-armor">⛨${ent.armor}</span>`);
  if (ent.bleed > 0)     c.push(`<span class="status-chip status-bleed">bleed ${ent.bleed}</span>`);
  if (ent.taunt)         c.push(`<span class="status-chip status-taunt">taunt</span>`);
  if (ent.weak > 0)      c.push(`<span class="status-chip status-weak">weak ${ent.weak}</span>`);
  if (ent.vuln > 0)      c.push(`<span class="status-chip status-vuln">vuln ${ent.vuln}</span>`);
  if (ent.retaliate > 0) c.push(`<span class="status-chip status-retal">retaliate ${ent.retaliate}</span>`);
  return c.join('');
}

function renderActions() {
  const map = [['X','front'], ['Y','mid'], ['Z','back']];
  document.querySelectorAll('.action-btn').forEach(btn => {
    const action = btn.dataset.action;
    const slot = map.find(m => m[0] === action)[1];
    const charId = state.party.slots[slot];
    const c = state.party.chars[charId];
    const locked = state.party.lockedSlot === slot;
    const empty = !c || c.downed;
    const nameEl = btn.querySelector('.btn-name');
    const descEl = btn.querySelector('.btn-desc');
    const slotEl = btn.querySelector('.btn-slot');
    const sigNameEl = btn.querySelector('.sig-name');
    const sigDescEl = btn.querySelector('.sig-desc');

    slotEl.textContent = `${SLOT_LABELS[slot]} · ${action}`;
    if (empty || locked) {
      btn.disabled = true;
      btn.classList.remove('sig-ready', 'holding', 'held-sig');
      nameEl.textContent = locked ? 'Locked' : '—';
      descEl.textContent = locked ? 'rotate to refresh' : '';
      if (sigNameEl) sigNameEl.textContent = '—';
      if (sigDescEl) sigDescEl.textContent = '';
      return;
    }
    btn.disabled = state.moveArmed;
    const def = CHARS[charId].techs[slot];
    nameEl.textContent = def.basic.name;
    descEl.textContent = def.basic.desc;
    if (sigNameEl) sigNameEl.textContent = def.sig.name;
    if (sigDescEl) sigDescEl.textContent = ' — ' + def.sig.desc;
    btn.classList.toggle('sig-ready', state.resolve >= SIG_COST && !state.moveArmed);
  });
}

function renderControls() {
  const moveBtn = $('#btn-move');
  const defBtn  = $('#btn-defend');
  moveBtn.disabled = false;
  moveBtn.classList.toggle('armed', state.moveArmed);
  moveBtn.querySelector('.ctrl-label').textContent = state.moveArmed ? 'Cancel' : 'Move';
  defBtn.disabled = state.moveArmed;
}

function renderMessages() {
  const bar = $('#message-bar');
  bar.innerHTML = state.messages.slice(-10).map(m => {
    const isStrong = m.startsWith('<span class="msg-strong">');
    return `<div class="msg-line ${isStrong ? 'msg-strong' : ''}">${m.replace(/<span class="msg-strong">|<\/span>/g,'')}</div>`;
  }).join('');
  bar.scrollTop = bar.scrollHeight;
}

function log(html) { state.messages.push(html); }
function flashMsg(text) { log(`<i>${text}</i>`); renderMessages(); }

// ============================================================================
// POPUPS + FLASHES — visual juice
// ============================================================================

function spawnPopupId(id, text, type, side) {
  // resolve side automatically if not given
  let cardEl;
  if (side) cardEl = document.querySelector(`#${side === 'enemy' ? 'enemy' : 'party'}-col .card[data-id="${id}"]`);
  if (!cardEl) cardEl = document.querySelector(`.card[data-id="${id}"]`);
  if (!cardEl) return;
  spawnPopup(cardEl, text, type);
}

function spawnPopup(cardEl, text, type='dmg') {
  const layer = $('#popup-layer');
  const stage = $('#stage');
  if (!cardEl || !layer || !stage) return;
  const r = cardEl.getBoundingClientRect();
  const s = stage.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = `popup ${type}`;
  el.textContent = text;
  el.style.left = (r.left + r.width / 2 - s.left) + 'px';
  el.style.top  = (r.top - s.top + 8) + 'px';
  layer.appendChild(el);
  setTimeout(() => el.remove(), 950);
}

function flashCardId(id, type, side) {
  let cardEl;
  if (side) cardEl = document.querySelector(`#${side === 'enemy' ? 'enemy' : 'party'}-col .card[data-id="${id}"]`);
  if (!cardEl) cardEl = document.querySelector(`.card[data-id="${id}"]`);
  if (!cardEl) return;
  cardEl.classList.add(`${type}-flash`);
  setTimeout(() => cardEl.classList.remove(`${type}-flash`), 600);
}

// ============================================================================
// INPUT
// ============================================================================

function onPartyCardClick(slot) {
  if (!state.moveArmed) return;
  const c = charBySlot(state, slot); if (!c || c.downed) return;
  if (state.moveSelection === null) { state.moveSelection = slot; render(); return; }
  if (state.moveSelection === slot) { state.moveSelection = null; render(); return; }
  playerMove(state.moveSelection, slot);
}

function bindUI() {
  const HOLD_MS = 450;
  const holdState = { btn: null, timer: null, fired: false };

  function startHold(btn) {
    if (btn.disabled || state.over) return;
    holdState.btn = btn;
    holdState.fired = false;
    btn.classList.add('holding');
    if (btn.classList.contains('sig-ready')) {
      holdState.timer = setTimeout(() => {
        if (holdState.btn === btn) {
          holdState.fired = true;
          btn.classList.remove('holding');
          btn.classList.add('held-sig');
          setTimeout(() => btn.classList.remove('held-sig'), 220);
          playerAct(btn.dataset.action, true);
        }
      }, HOLD_MS);
    }
  }
  function endHold(btn) {
    if (holdState.btn !== btn) return;
    if (holdState.timer) { clearTimeout(holdState.timer); holdState.timer = null; }
    btn.classList.remove('holding');
    const wasFired = holdState.fired;
    holdState.btn = null;
    holdState.fired = false;
    if (!wasFired) playerAct(btn.dataset.action, false);
  }
  function cancelHold(btn) {
    if (holdState.btn !== btn) return;
    if (holdState.timer) { clearTimeout(holdState.timer); holdState.timer = null; }
    btn.classList.remove('holding');
    holdState.btn = null;
    holdState.fired = false;
  }

  $$('.action-btn').forEach(btn => {
    btn.addEventListener('pointerdown',  (e) => { e.preventDefault(); startHold(btn); });
    btn.addEventListener('pointerup',    () => endHold(btn));
    btn.addEventListener('pointerleave', () => cancelHold(btn));
    btn.addEventListener('pointercancel',() => cancelHold(btn));
    btn.addEventListener('contextmenu',  (e) => e.preventDefault()); // suppress long-press menu on touch
  });

  $('#btn-move').addEventListener('click', () => {
    state.moveArmed = !state.moveArmed;
    state.moveSelection = null;
    if (state.moveArmed) flashMsg('Tap two party members to swap (consumes turn).');
    render();
  });
  $('#btn-defend').addEventListener('click', () => playerDefend());
  $('#overlay-btn').addEventListener('click', () => { hideOverlay(); init(); });
}

function showOverlay(title, body) {
  $('#overlay-title').textContent = title;
  $('#overlay-body').textContent = body;
  $('#overlay').classList.remove('hidden');
}
function hideOverlay() { $('#overlay').classList.add('hidden'); }

// ============================================================================
// BOOT
// ============================================================================

function init() {
  state = newState();
  startTurn(state);
}

document.addEventListener('DOMContentLoaded', () => { bindUI(); init(); });
