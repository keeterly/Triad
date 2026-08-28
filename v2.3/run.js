// ============================================================================
// KIZUNA v2.3 — THE ROAD  ·  run.js
// ============================================================================
// Combat knows about one fight. This file knows about the six of them in a row.
//
// The brief was "node-based travel that reads at a glance", benchmarked against
// Slay the Spire 2, and the thing StS gets right is not the graph — it is that
// the graph answers three questions without being read: WHERE AM I, WHERE MAY I
// GO, and WHAT IS THERE. So the road here is deliberately small (six stops, two
// choices at each) and every one of those three answers is carried by a
// different channel: position by a pinned marker, permission by brightness and
// a gold pulse, content by an icon shape that is distinct in silhouette before
// it is distinct in colour. Nothing on this screen requires reading a word to
// make the decision; the words are there to confirm a decision already made by
// the eye.
//
// The run layer owns: the map, the party's carried wounds, the ember purse,
// and the outcome card at the end of a fight. It talks to combat through
// exactly two seams — `startCombat({foe, partyHp, onEnd})` going in, and the
// `combatSummary` it hands back coming out.
// ============================================================================
(function () {
  'use strict';

  const RUN_KEY = 'kizuna23.run';
  // WHAT A CAMPFIRE IS WORTH. The last campfire on the road sits one stop from
  // the Regent, and it exists so that fight is a FIGHT rather than the last
  // instalment of an attrition sum: at 0.35 the run sim walked a competent
  // party into her at 60% health, where a 33% encounter becomes a 10% one.
  const CAMP_FRAC = 0.55;
  // HALF THE BOND SURVIVES THE ROAD. Not all of it: a full carry turns the
  // ladder into a bank you fill on fodder and empty on the Regent, which is
  // one decision made once rather than a resource you feel. Half means the
  // all-out starts appearing in mid-road fights — which is the whole point,
  // since a four-round fight cannot fill the bar from nothing — while the
  // Regent still has to be earned inside her own fight.
  const KIZUNA_CARRY = 0.5;
  const COLS = 6;
  const STOPS = COLS;                       // one node visited per column

  // ── the run's own RNG, kept apart from the fight's ────────────────────────
  // A fight reseeds constantly; the map must not move underneath the player
  // because a fight happened. Same mulberry32, its own cursor.
  let _rs = 1;
  function rseed(n) { _rs = (n >>> 0) || 1; }
  function rr() {
    _rs |= 0; _rs = (_rs + 0x6D2B79F5) | 0;
    let t = Math.imul(_rs ^ (_rs >>> 15), 1 | _rs);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const pick = (a) => a[Math.floor(rr() * a.length) % a.length];

  // ═══════════════════════════════════════════════════════════════════════
  // THE TREE — what embers buy, and why a memory is worth taking
  // ═══════════════════════════════════════════════════════════════════════
  // Ten nodes on three tiers. Nine of them sharpen a card the party already
  // owns; the tenth develops the thing all three of them own together.
  //
  // THE TIER IS THE WHOLE POINT OF A MEMORY. Embers alone cannot reach tier 2,
  // no matter how many you carry — only a memory opens it. That is what makes
  // the column-4 fork (campfire or memory) a real question rather than a
  // decorated campfire, and it is why the tier was wired into the road at
  // Build 26 before there was anything for it to gate.
  const TREE = [
    // tier 1 — open from the first campfire
    { id: 'ash.cleave',      hero: 'ash',  tier: 1, cost: 3, card: 'cleave' },
    { id: 'elin.mend',       hero: 'elin', tier: 1, cost: 3, card: 'mend' },
    { id: 'mira.twinfang',   hero: 'mira', tier: 1, cost: 3, card: 'twinfang' },
    // tier 2 — one memory
    { id: 'ash.crosssever',  hero: 'ash',  tier: 2, cost: 4, card: 'crosssever' },
    { id: 'elin.sgrace',     hero: 'elin', tier: 2, cost: 4, card: 'sgrace' },
    { id: 'mira.backstab',   hero: 'mira', tier: 2, cost: 4, card: 'backstab' },
    // tier 3 — both memories
    { id: 'ash.lastlight',   hero: 'ash',  tier: 3, cost: 5, card: 'lastlight' },
    { id: 'elin.lcascade',   hero: 'elin', tier: 3, cost: 5, card: 'lcascade' },
    { id: 'mira.execute',    hero: 'mira', tier: 3, cost: 5, card: 'execute' },
    // the shared node: the team attack that develops over time
    { id: 'all.crescendo',   hero: 'all',  tier: 3, cost: 6, allout: { dmg: 34, brk: 6 },
      name: 'CRESCENDO', blurb: 'The all-out strikes for 34 and breaks for 6.' },
  ];
  const HERO_NAME = { ash: 'ASH', elin: 'ELIN', mira: 'MIRA', all: 'ALL THREE' };
  const treeNode = (id) => TREE.find(n => n.id === id);
  const held = (id) => RUN.nodes.indexOf(id) >= 0;
  const cardUps = () => RUN.nodes.map(id => (treeNode(id) || {}).card).filter(Boolean);
  const alloutOf = () => {
    const n = RUN.nodes.map(treeNode).find(x => x && x.allout);
    return n ? n.allout : null;
  };
  // What a node WILL DO, read off the two card faces rather than written twice.
  // A tree that describes its own effects in prose is a tree that goes stale
  // the first time a card is retuned.
  function nodeFace(n) {
    if (!n.card) return { name: n.name, from: '', to: n.blurb || '' };
    const K = window.K;
    const base = K.CARD_DEFS ? K.CARD_DEFS[n.card] : null;
    const up = K.CARD_UPS ? K.CARD_UPS[n.card] : null;
    return { name: (up && up.name) || n.card, from: base ? K.effectText(base.base) : '',
             to: up ? K.effectText(up.base) : '' };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // THE MEMORIES — what a scene is for
  // ═══════════════════════════════════════════════════════════════════════
  // A cutscene in a run-based game earns its interruption or it does not get
  // one. These earn it twice over: each is the only thing that opens a tier of
  // the tree, and each is about the three of them becoming more capable
  // TOGETHER, which is the mechanical thing the tier then sells you.
  //
  // Authored in order, not shuffled. Two memories fit on a road and they are a
  // conversation with a first half and a second half; picking them at random
  // would trade a small amount of variety for the only continuity the slice
  // has. `who: null` is the road talking rather than a person.
  // ═══════════════════════════════════════════════════════════════════════
  // THE BONDS — a social level that is earned by how you fight, not bought
  // ═══════════════════════════════════════════════════════════════════════
  // Three pairs. Points come only from things the two of them DID for each
  // other: acting straight after one another, and stepping into a blow meant
  // for the other. Both were already events the engine emitted; the social
  // layer reads them rather than inventing a new currency.
  //
  // Levels reset with the run — they are earned in the fighting. What PERSISTS
  // is the profile: which scenes you have heard and which cards you have won.
  // That is the progression that outlives a death.
  // ═══════════════════════════════════════════════════════════════════════
  // THE AWAKENING — the three of them wake, and one of them reaches back
  // ═══════════════════════════════════════════════════════════════════════
  // Slay the Spire opens every run with a choice made before you know
  // anything: it costs nothing, it cannot be optimised, and it is the first
  // thing that makes this run different from the last one. That is the job
  // here too — but the shape has to be ours, so a boon is never a stat bolted
  // onto a character. It is a MEMORY one of them reaches for, and the thing
  // it gives is the thing that memory is about.
  //
  // Everything an awakening can grant already exists: embers, the bond,
  // health, a pair's closeness, a card won on an earlier road. Nothing here
  // invents a currency — the deck still does not grow, and `habit` pays for
  // its card with a slot like every other card in the game.
  //
  // THREE ARE OFFERED, and the composition is fixed even though the contents
  // are not: exactly one is a TRADE — a real gain against a real cost — so
  // the choice is never three flavours of free. When an earlier run has won a
  // card, one slot is always that card, which is what makes the persistent
  // profile matter on turn one rather than at the third campfire.
  const WAKES = [
    { id: 'kindling', kind: 'plain', who: 'ASH', title: 'KINDLING',
      line: 'Ash keeps a twist of dry grass in her coat for no reason she can name. '
          + 'Her mother\u2019s hands, doing this, in a room that is gone. The road will want a fire.',
      gain: '+4 embers', apply(r) { r.embers += 4; } },
    { id: 'lastnote', kind: 'plain', who: 'ELIN', title: 'THE LAST NOTE',
      line: 'The three of them held a chord once, at the end of something. Elin never let go of it. '
          + 'It is still there under everything, waiting to be finished.',
      gain: 'the bond begins at 45', apply(r) { r.kizuna = 45; } },
    { id: 'rest', kind: 'plain', who: 'MIRA', title: 'A NIGHT THAT KEPT',
      line: 'One night nobody woke them. Mira remembers the weight of the other two against her back, '
          + 'and how nothing came. She has been carrying the rest of that night ever since.',
      gain: '+6 health, all three', apply(r) { r.vigor += 6; } },
    { id: 'close', kind: 'plain', who: null, title: 'STILL CLOSE',
      line: 'Something one of them did for another, so small neither would call it anything. '
          + 'It is the reason they can still find each other without looking.',
      gain: 'a pair begins close', apply(r) { r.bonds[wakePair()] = 10; } },
    // the persistent slot — offered only when an earlier road won something
    { id: 'habit', kind: 'card', who: 'ALL THREE', title: 'AN OLD HABIT',
      line: 'There is a thing they learned on a road that ended badly. The hands remember it '
          + 'whether or not anyone wants them to. The deck will have to make room.',
      gain: 'carry a card you have won', apply() {} },
    // the trades — one of these is always in the offer
    { id: 'borrowed', kind: 'trade', who: 'ALL THREE', title: 'BORROWED FIRE',
      line: 'There is a way to take the warmth now and settle for it later. All three of them '
          + 'know how. None of them says so out loud.',
      gain: '+8 embers', cost: 'they set out already hurt',
      apply(r) { r.embers += 8; r.hp = { ash: 34, elin: 29, mira: 27 }; } },
    { id: 'debt', kind: 'trade', who: 'ELIN', title: 'A DEBT OF BREATH',
      line: 'Reach back far enough and the chord is already ringing. So is everything that was '
          + 'listening to it the first time.',
      gain: 'the bond begins at 70', cost: 'the Regent wakes with 14 more',
      apply(r) { r.kizuna = 70; r.foeBonus += 14; } },
  ];
  const wakeDef = (id) => WAKES.find(w => w.id === id);
  // WHICH PAIR "STILL CLOSE" MEANS is a fact about the run, not about the
  // screen. The first pass decided it inside renderWake(), so taking the
  // memory without drawing it first — which is what the simulator and every
  // test do — silently fell back to a default pair, and the sim measured a
  // boon the game does not offer. Decided once, on demand, from the seed.
  function wakePair() {
    if (RUN && !RUN.wakePair) { rseed(RUN.seed ^ 0xC10E); RUN.wakePair = PAIRS[Math.floor(rr() * 3) % 3]; }
    return RUN ? RUN.wakePair : PAIRS[0];
  }
  const wonCards = () => (PROFILE && PROFILE.won ? PROFILE.won : [])
    .filter(id => window.K.CARD_DEFS[id]);

  // Deterministic in the run's own seed, on its own cursor, so the same seed
  // always wakes the same way — and so a test can name what it is choosing.
  function wakeOffer() {
    if (!RUN) return [];
    rseed(RUN.seed ^ 0x5EED);
    const pick = (list) => list[Math.floor(rr() * list.length) % list.length];
    const plains = WAKES.filter(w => w.kind === 'plain');
    const out = [pick(WAKES.filter(w => w.kind === 'trade'))];
    out.push(wonCards().length ? wakeDef('habit') : pick(plains));
    const rest = plains.filter(w => out.indexOf(w) < 0);
    out.push(pick(rest));
    // A THIRD DRAWN FROM WHAT IS LEFT, not from the whole pool: picking twice
    // from `plains` gave the same memory twice roughly one seed in four.
    const rest2 = plains.filter(w => out.indexOf(w) < 0);
    if (out[1] === out[2] && rest2.length) out[2] = pick(rest2);
    for (let i = out.length - 1; i > 0; i--) {          // shuffle, so the trade
      const j = Math.floor(rr() * (i + 1));             // is not always first
      const t = out[i]; out[i] = out[j]; out[j] = t;
    }
    return out;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // WHAT EACH BOND TEACHES — one sigil per level crossed
  // ═══════════════════════════════════════════════════════════════════════
  // The complaint the sigil answers is that cards are hard to CONNECT: the
  // combo layer wants an order a five-card hand rarely offers. Three of the
  // five marks exist to loosen exactly that, and they are earned by the bond,
  // so the mechanical answer to "these two do not work together" is the same
  // as the fictional one — they have not been together long enough yet.
  //
  // The MARK is fixed by the pair and the level; the CARD it goes on is the
  // player's. One decision, one screen. Letting the player choose both would
  // be two screens for one reward, and it would cost each pair the identity
  // that makes their level-up feel like theirs rather than a menu.
  const SIGIL_BY_PAIR = {
    'ash|elin':  ['held', 'bright'],     // she holds the line; he keeps one back
    'ash|mira':  ['echo', 'kindled'],    // the two quick ones — a move flows on
    'elin|mira': ['opening', 'bright'],  // they are the ones who start things
  };
  const sigilFor = (pair, lv) => (SIGIL_BY_PAIR[pair] || [])[lv - 1] || null;

  const PAIRS = ['ash|elin', 'ash|mira', 'elin|mira'];
  const BOND_STEPS = [12, 30];               // points to reach level 1, then 2
  const PAIR_NAME = { 'ash|elin': 'ASH + ELIN', 'ash|mira': 'ASH + MIRA', 'elin|mira': 'ELIN + MIRA' };
  const bondLevel = (pts) => BOND_STEPS.reduce((lv, need) => (pts >= need ? lv + 1 : lv), 0);

  // ── the profile: what survives a run ─────────────────────────────────────
  const PROFILE_KEY = 'kizuna23.profile';
  let PROFILE = null;
  function loadProfile() {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      const p = raw ? JSON.parse(raw) : null;
      if (p && Array.isArray(p.heard) && Array.isArray(p.won)) return p;
    } catch (_) {}
    return { heard: [], won: [] };
  }
  function saveProfile() { try { localStorage.setItem(PROFILE_KEY, JSON.stringify(PROFILE)); } catch (_) {} }
  function heard(id) { return PROFILE.heard.indexOf(id) >= 0; }
  function won(id) { return PROFILE.won.indexOf(id) >= 0; }

  // ── the bond scenes ──────────────────────────────────────────────────────
  // Six: three pairs, two levels each. Every one ends in a fork, and the fork
  // IS the card — the same two people at the same point in their story, taken
  // two different ways. A choice that only changed a line of dialogue would be
  // a choice in name only.
  const BONDS = {
    'ash|elin': [
      { id: 'ae1', title: 'THE PRACTICE', beats: [
        { who: null,   line: 'They have fallen into it again without discussing it.' },
        { who: 'elin', line: 'You still step left when you are tired.' },
        { who: 'ash',  line: 'You still cover it.' },
        { who: 'elin', line: 'I always will. That is not the same as it being fine.' },
      ], ask: 'What does he say to that?', picks: [
        { line: '"Then keep covering it."', card: 'shieldsong',
          after: 'She does not argue. She never has.' },
        { line: '"Then let me stop needing it."', card: 'lastvigil',
          after: 'He shifts his guard a half-step. It costs him something.' },
      ] },
      { id: 'ae2', title: 'WHAT IT ENDED AS', beats: [
        { who: 'ash',  line: 'You have not asked what I remember about the last time.' },
        { who: 'elin', line: 'No.' },
        { who: 'ash',  line: 'Why not.' },
        { who: 'elin', line: 'Because I was there, and because you would tell me the kind version.' },
      ], ask: 'What does he give her instead?', picks: [
        { line: 'The kind version anyway.', card: 'gravebloom',
          after: 'She lets him have it. Something in her unclenches.' },
        { line: 'All of it.', card: 'ashenoath',
          after: 'It takes a while. Neither of them sleeps much after.' },
      ] },
    ],
    'ash|mira': [
      { id: 'am1', title: 'IN FRONT', beats: [
        { who: 'mira', line: 'You keep putting yourself between me and things.' },
        { who: 'ash',  line: 'That is the job.' },
        { who: 'mira', line: 'It is a job you gave yourself.' },
      ], ask: 'What do they settle on?', picks: [
        { line: '"Cover me, then. Properly."', card: 'shieldblade',
          after: 'She stops working around him and starts working behind him.' },
        { line: '"Don\u2019t wait for me."', card: 'twinshadow',
          after: 'He stops turning to check. It is harder than standing still.' },
      ] },
      { id: 'am2', title: 'THE QUICK ONE', beats: [
        { who: null,   line: 'She is bleeding and has not mentioned it.' },
        { who: 'ash',  line: 'How long.' },
        { who: 'mira', line: 'Two stops. It is fine. I get out before it matters.' },
        { who: 'ash',  line: 'And when you do not.' },
      ], ask: 'What does she change?', picks: [
        { line: 'She starts leaving earlier.', card: 'cutthecord',
          after: 'Out of reach before the answer comes. It is not cowardice.' },
        { line: 'She starts hitting harder.', card: 'bothblades',
          after: 'Heavy first, then quick. Nothing left standing to answer.' },
      ] },
    ],
    'elin|mira': [
      { id: 'em1', title: 'THE SHAPE OF IT', beats: [
        { who: 'mira', line: 'You hear it differently than we do.' },
        { who: 'elin', line: 'I hear what it is asking for.' },
        { who: 'mira', line: 'And what is that.' },
        { who: 'elin', line: 'To be allowed to stop.' },
      ], ask: 'What does Mira do with that?', picks: [
        { line: 'Learns to slow it down.', card: 'coldmercy',
          after: 'A knife can be patient. She had not considered it.' },
        { line: 'Learns to ask her first.', card: 'quietword',
          after: 'They start speaking mid-fight. It is not tidy, and it works.' },
      ] },
      { id: 'em2', title: 'NOT A KINDNESS', beats: [
        { who: 'elin', line: 'You could have let me take that one.' },
        { who: 'mira', line: 'You would not have got up.' },
        { who: 'elin', line: 'That was mine to decide.' },
        { who: 'mira', line: '\u2026yes.' },
      ], ask: 'How does it settle?', picks: [
        { line: 'They share the weight.', card: 'thornandlamp',
          after: 'A little of everything, for everyone. Nobody carries it alone.' },
        { line: 'Elin names it out loud.', card: 'namethefear',
          after: 'Said plainly, it has less room to move.' },
      ] },
    ],
  };
  const bondScene = (pair, lv) => (BONDS[pair] || [])[lv - 1] || null;

  const SCENES = [
    { id: 'lullaby', title: 'WHAT THE SONG IS FOR', beats: [
      { who: null,   line: 'The road bends. The singing does not.' },
      { who: 'elin', line: 'It isn’t a threat. Listen to the shape of it.' },
      { who: 'mira', line: 'It’s a hymn. They’re always threats.' },
      { who: 'elin', line: 'It’s a lullaby. She’s still trying to put something to sleep.' },
      { who: 'mira', line: '…for who?' },
      { who: 'elin', line: 'For whatever she couldn’t keep.' },
      { who: 'ash',  line: 'Then we aren’t killing her. We’re finishing it.' },
      { who: null,   line: 'Three people stop arguing about what they are walking toward.' },
    ] },
    { id: 'careful', title: 'THE THING NOBODY SAYS', beats: [
      { who: null,   line: 'Nobody has said it since the first stop.' },
      { who: 'mira', line: 'You two move like one thing. You don’t even look.' },
      { who: 'ash',  line: 'We’ve had the practice.' },
      { who: 'mira', line: 'And how did that end.' },
      { who: 'elin', line: 'It ended.' },
      { who: 'ash',  line: 'Which is why we’re careful with you.' },
      { who: 'mira', line: 'Don’t be careful with me. Be fast.' },
      { who: null,   line: 'She steps up into the line without being asked. Nobody moves her back.' },
    ] },
    { id: 'floor', title: 'ONE MORE FLOOR', beats: [
      { who: null,   line: 'The stair keeps going. It should have stopped.' },
      { who: 'ash',  line: 'How far down does she go?' },
      { who: 'elin', line: 'As far as she has to. That’s what grief is.' },
      { who: 'mira', line: 'Then we go one floor further than that.' },
      { who: null,   line: 'It is not a plan. It is the closest thing they have.' },
    ] },
  ];

  // ── what a stop can be ────────────────────────────────────────────────────
  // Four kinds, and each one is a different SHAPE at a glance: blades cross,
  // a crown sits on a skull, a flame stands alone, an eye opens. Colour is the
  // second channel, never the only one — the map has to survive being small.
  const KIND = {
    fight: { id: 'fight', word: 'BATTLE', tone: 'steel',
             blurb: 'One of the Regent’s lesser kin. Embers for the winning.' },
    elite: { id: 'elite', word: 'ELITE', tone: 'red',
             blurb: 'It kneels, and it does not tire. Twice the embers, twice the price.' },
    camp:  { id: 'camp', word: 'CAMPFIRE', tone: 'gold',
             blurb: 'Rest and mend, or spend what you carry on what you can become.' },
    // THE RULE HAS TO TRAVEL WITH THE STOP. "Only a memory opens the deeper
    // nodes" is the single most important strategic fact in the run, and it
    // was stated in exactly one place: the sealed-node line at a campfire.
    // A player can reach the last fork having taken only battles, never seen
    // the tree, and never learned that the two forks that mattered are spent.
    story: { id: 'story', word: 'MEMORY', tone: 'violet',
             blurb: 'Something they have not said out loud yet — and the only thing that opens the deeper nodes at your fires.' },
    boss:  { id: 'boss', word: 'THE REGENT', tone: 'crown',
             blurb: 'The end of the descent. She has been singing the whole way down.' },
  };

  // The column plan. Fixed, not procedural — a six-stop road is short enough
  // that authored pacing beats generated pacing every time, and it means the
  // shape of a run is a thing that can be reasoned about and tested.
  //   0  two easy fights: the opening is a choice, but not yet a gamble
  //   1  fight or memory: pay a fight's embers, or take the tier unlock
  //   2  campfire or fight: the first real fork
  //   3  elite or fight: the gamble, placed where a full purse can answer it
  //   4  campfire or memory: no fighting on the Regent's doorstep
  //   5  the Regent
  const PLAN = [
    ['fight', 'fight'],
    ['fight', 'story'],
    ['camp', 'fight'],
    ['elite', 'fight'],
    ['camp', 'story'],
    ['boss'],
  ];
  // Which foe stands at a fight node, by depth. The ladder is legible: you
  // meet the Husk before you meet the Wraith, always.
  const FOE_BY_COL = [['husk', 'cultist'], ['husk', 'cultist'], ['cultist', 'wraith'],
                      ['wraith'], ['wraith'], ['mourner']];

  // ── geometry of the road ──────────────────────────────────────────────────
  // 932×430 with a header to clear: the road runs left to right across the
  // middle band, which is the same axis the fight is fought along, so "forward"
  // means the same thing on both screens.
  // The band the road runs through has to clear BOTH the header (74px) and the
  // confirmation card (62px tall, 20px off the floor → its top edge is y=348).
  // A stop is a 52px disc plus a word beneath it plus, for the one you are
  // standing on, a pin above it — so the lowest row can reach y+42 and the
  // highest can reach y-50.
  const MAP_X0 = 104, MAP_X1 = 838, MAP_Y = 224, MAP_SPREAD = 66;
  function nodeXY(col, ix, n) {
    const x = MAP_X0 + (MAP_X1 - MAP_X0) * (col / (COLS - 1));
    const y = n === 1 ? MAP_Y : MAP_Y + (ix === 0 ? -MAP_SPREAD : MAP_SPREAD);
    return { x, y };
  }

  // ── building a road ───────────────────────────────────────────────────────
  function buildMap(seed) {
    rseed(seed);
    const nodes = [];
    PLAN.forEach((kinds, col) => {
      kinds.forEach((kind, ix) => {
        const p = nodeXY(col, ix, kinds.length);
        const n = { id: col + ':' + ix, col, ix, kind, x: p.x, y: p.y, to: [] };
        if (kind === 'fight' || kind === 'elite' || kind === 'boss') {
          n.foe = kind === 'elite' ? 'revenant' : pick(FOE_BY_COL[col] || ['wraith']);
        }
        nodes.push(n);
      });
    });
    const at = (col) => nodes.filter(n => n.col === col);
    // EVERY NODE HAS A WAY IN AND A WAY OUT, and at least one crossing per
    // column. Without the forced crossing the road degenerates into two
    // parallel corridors, where the only decision in the whole run is the
    // first one — which is exactly the failure StS's map generator guards
    // against with the same rule.
    for (let c = 0; c < COLS - 1; c++) {
      const a = at(c), b = at(c + 1);
      a.forEach((n, i) => n.to.push(b[Math.min(i, b.length - 1)].id));
      if (b.length > 1 && a.length > 1) {
        let crossed = false;
        if (rr() < 0.55) { a[0].to.push(b[1].id); crossed = true; }
        if (rr() < 0.55) { a[1].to.push(b[0].id); crossed = true; }
        // THE FALLBACK HAS TO ACTUALLY CROSS. It used to pick a source and a
        // destination independently, so two of its four outcomes were the
        // straight-ahead edge the base connection had already added — silently
        // absorbed by the Set. The forced crossing therefore only crossed half
        // the time it fired, and 34% of seeds ended up with at least one
        // column that was two parallel corridors: the exact failure this rule
        // exists to prevent. The single-seed check in road.test.cjs passed on
        // luck. Pick the source, then take the OTHER lane, always.
        if (!crossed) { const from = rr() < 0.5 ? 0 : 1; a[from].to.push(b[1 - from].id); }
      } else if (b.length === 1) {
        a.forEach(n => { if (n.to.indexOf(b[0].id) < 0) n.to.push(b[0].id); });
      }
      a.forEach(n => { n.to = [...new Set(n.to)]; });
    }
    return nodes;
  }

  // ── run state ─────────────────────────────────────────────────────────────
  let RUN = null;
  let _pick = null;                  // the node the finger is asking about
  let _swapBack = null;              // where confirmSwap returns to
  let _markPair = null;              // whose cards the pending mark may land on
  let _busy = false;

  function freshRun(seed) {
    const s = (seed != null ? seed : (Date.now() >>> 0)) || 1;
    return {
      seed: s, map: buildMap(s), at: null, path: [], stop: 0,
      embers: 0, nodes: [],                       // the tree nodes this run has kindled
      kizuna: 0,                                  // what the three of them carry
      bonds: { 'ash|elin': 0, 'ash|mira': 0, 'elin|mira': 0 },
      levels: { 'ash|elin': 0, 'ash|mira': 0, 'elin|mira': 0 },
      roster: null,                               // set on boot from the base 15
      flash: null,                                // the receipt from the last stop
      pending: null,                              // a stop entered but not finished
      camped: 0, campDone: null,                  // the fire only mends once per visit
      sigils: {},                                 // cardId → the mark it wears
      pendingSigil: null,                         // a mark earned, not yet placed
      markPair: null,                             // whose cards it may land on
      woke: null,                                 // the memory reached for on waking
      vigor: 0,                                   // max HP the party woke up with
      foeBonus: 0,                                // HP the Regent woke up with
      wakePair: null,                             // the pair STILL CLOSE names
      seen: [],                                   // the memories this run has heard
      tier: 1,                                    // raised by MEMORY stops (Build 28)
      hp: null,                                   // null = everyone is whole
      over: null,                                 // 'win' | 'loss'
      last: null,                                 // the summary of the last fight
    };
  }
  function save() { try { localStorage.setItem(RUN_KEY, JSON.stringify(RUN)); } catch (_) {} }
  function load() {
    try {
      const raw = localStorage.getItem(RUN_KEY);
      if (!raw) return null;
      const r = JSON.parse(raw);
      return (r && r.map && r.map.length) ? r : null;
    } catch (_) { return null; }
  }
  function clear() { try { localStorage.removeItem(RUN_KEY); } catch (_) {} }

  const node = (id) => RUN.map.find(n => n.id === id);
  const here = () => (RUN.at ? node(RUN.at) : null);
  function reachable() {
    if (RUN.over) return [];
    if (!RUN.at) return RUN.map.filter(n => n.col === 0).map(n => n.id);
    const h = here();
    return h ? h.to.slice() : [];
  }
  const visited = (id) => RUN.path.indexOf(id) >= 0;

  // ── the screen ────────────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  const SCREENS = { map: 'k-map', combat: 'k-stage', camp: 'k-camp', scene: 'k-scene', swap: 'k-swap', wake: 'k-wake', mark: 'k-mark' };
  // WHICH SCREEN IS UP IS ALSO WHICH MUSIC IS PLAYING, and this is the only
  // function that answers the first question — so it answers the second too.
  // Scattering cues through the map, the camp, the scene and the swap would
  // mean four places that can disagree about what should be playing; there is
  // one rule here instead: the stage gets the battle theme, everything else
  // gets the road's bed.
  //
  // The road's bed RESUMES. You leave it for a fight and come back to it, and
  // restarting the track each time would make the map feel like a menu rather
  // than a place. Combat restarts, because it is an entrance.
  let _lastScreen = null;
  function screen(which) {
    for (const k of Object.keys(SCREENS)) {
      const el2 = $(SCREENS[k]);
      if (el2) el2.classList.toggle('k-hidden', k !== which);
    }
    const M = window.K && window.K.MUSIC, SRC = window.K && window.K.MUSIC_SRC;
    if (M && SRC) {
      try {
        if (which === 'combat') M.play(SRC.combat, 0.42, false);
        // LEAVING COMBAT IS A HAND-OFF, NOT A BLEND. The two pieces are too
        // different to overlap for two seconds: the battle theme goes fully
        // out, a breath of quiet lands on the victory beat, then the road
        // swells back in. Every other screen change is the same bed already
        // playing, which re-cues as a no-op.
        else if (_lastScreen === 'combat')
          M.play(SRC.world, 0.5, true, { sequence: true, outMs: 1100, gap: 300, inMs: 1900 });
        else M.play(SRC.world, 0.5, true);
      } catch (_) {}
    }
    _lastScreen = which;
  }

  // Icons carry the kind. Drawn rather than lettered, because the decision has
  // to survive a glance from arm's length on a phone.
  // FIVE SILHOUETTES THAT CANNOT BE CONFUSED WITH EACH OTHER — or with
  // anything else. Two of these were wrong on the first pass and both were
  // caught by looking at a screenshot rather than at the code:
  //   · the elite's crown-over-two-eyes-over-a-jaw rendered as a smiling face
  //     in a party hat, which is a poor read for the gamble node, and it
  //     shared the crown motif with the Regent so the two most dangerous
  //     stops had the same silhouette ingredient;
  //   · the campfire's "flame" was a plain teardrop, indistinguishable from
  //     the ember currency in the header, and semantically closer to water.
  // The elite is now crossed blades under a bar — a battle with weight on it,
  // built from the BATTLE glyph so the family reads — and the flame is a real
  // asymmetric fire with an inner tongue.
  const GLYPH = {
    fight: '<path d="M5 5 L19 19 M19 5 L5 19" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round"/>',
    // The crown has to survive being 4px tall at map scale, so it is a real
    // crown with three peaks rather than a thin band, and the blades below it
    // keep the BATTLE stroke weight so the family still reads.
    elite: '<path d="M6 11 L18 22 M18 11 L6 22" stroke="currentColor" stroke-width="2.6" fill="none" stroke-linecap="round"/>'
         + '<path d="M3 9 L5.5 2 L9 6.5 L12 1 L15 6.5 L18.5 2 L21 9 Z" fill="currentColor"/>',
    camp:  '<path d="M12 2 c1 4 4 5 4 9 a4 4 0 0 1 -8 0 c0 -2 1 -3 2 -4 c0 2 1 2 1 1 c0 -2 -1 -4 1 -6 z" fill="currentColor"/>'
         + '<path d="M5 20 l4 -3 M19 20 l-4 -3 M4 21 h16" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round"/>',
    story: '<ellipse cx="12" cy="12" rx="9" ry="6" fill="none" stroke="currentColor" stroke-width="1.9"/><circle cx="12" cy="12" r="2.6" fill="currentColor"/>',
    boss:  '<path d="M3 18 L5 7 L9 12 L12 5 L15 12 L19 7 L21 18 Z" fill="currentColor"/><path d="M3 20 h18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  };
  // The purse is a SPARK, not a drop — it must not share a silhouette with the
  // campfire it is spent at.
  const EMBER_SVG = '<path d="M12 2 L14 9 L21 11 L14 13 L12 20 L10 13 L3 11 L10 9 Z" fill="currentColor"/>';
  const svgIcon = (kind) => '<svg viewBox="0 0 24 24" aria-hidden="true">'
    + (kind === 'ember' ? EMBER_SVG : GLYPH[kind]) + '</svg>';

  function renderMap() {
    const wrap = $('k-map-nodes'), edges = $('k-map-edges');
    if (!wrap || !edges) return;
    const open = reachable();

    // EDGES FIRST, and in three weights. The road you walked is solid gold; the
    // roads you may take now are bright; everything else is a rumour. Three
    // weights is the most a glance can sort, so there are exactly three.
    let d = '';
    RUN.map.forEach(n => n.to.forEach(tid => {
      const t = node(tid); if (!t) return;
      const walked = visited(n.id) && visited(tid)
        && RUN.path.indexOf(tid) === RUN.path.indexOf(n.id) + 1;
      const live = RUN.at === n.id && open.indexOf(tid) >= 0;
      const cls = walked ? 'k-e-walk' : (live ? 'k-e-live' : 'k-e-dim');
      const mx = (n.x + t.x) / 2;
      d += '<path class="k-edge ' + cls + '" d="M' + n.x + ' ' + n.y
        + ' C' + mx + ' ' + n.y + ' ' + mx + ' ' + t.y + ' ' + t.x + ' ' + t.y + '"/>';
    }));
    edges.innerHTML = d;

    wrap.innerHTML = RUN.map.map(n => {
      const k = KIND[n.kind];
      const isHere = RUN.at === n.id;
      const isOpen = open.indexOf(n.id) >= 0;
      const been = visited(n.id);
      const cls = ['k-node', 'k-n-' + n.kind, 'k-tone-' + k.tone];
      if (isHere) cls.push('k-n-here');
      if (isOpen) cls.push('k-n-open');
      if (been && !isHere) cls.push('k-n-done');
      if (!isOpen && !been && !isHere) cls.push('k-n-far');
      if (_pick === n.id) cls.push('k-n-pick');
      return '<button type="button" class="' + cls.join(' ') + '" data-node="' + n.id + '"'
        + ' style="left:' + n.x + 'px; top:' + n.y + 'px"'
        + (isOpen ? '' : ' tabindex="-1"')
        + ' aria-label="' + k.word + '">'
        + '<span class="k-n-disc">' + svgIcon(n.kind) + '</span>'
        + '<span class="k-n-word">' + k.word + '</span>'
        + (isHere ? '<span class="k-n-pin">YOU ARE HERE</span>' : '')
        + '</button>';
    }).join('');

    wrap.querySelectorAll('.k-node').forEach(b => {
      b.addEventListener('click', (e) => { e.stopPropagation(); tapNode(b.dataset.node); });
    });

    $('k-map-prog').textContent = RUN.over ? (RUN.over === 'win' ? 'THE DESCENT IS ENDED' : 'THE ROAD ENDS HERE')
      : 'STOP ' + Math.min(RUN.stop + 1, STOPS) + ' OF ' + STOPS;
    $('k-embers-n').textContent = RUN.embers;
    const kz = $('k-map-kizuna'), kzf = $('k-map-kz-fill'), kzn = $('k-map-kz-n');
    if (kz && kzf && kzn) {
      const v = RUN.kizuna || 0;
      kz.classList.toggle('k-hidden', v <= 0);
      kzf.style.width = v + '%';
      kzn.textContent = v + '%';
      kz.classList.toggle('k-mkz-full', v >= 100);
    }
    // one spark, drawn from one place — the header used to carry its own copy
    // in index.html, which is how it ended up being the campfire's teardrop
    const spark = $('k-ember-ico');
    if (spark && !spark.dataset.drawn) { spark.innerHTML = svgIcon('ember'); spark.dataset.drawn = '1'; }
    renderRoster();
    renderCard();
  }

  function renderRoster() {
    const box = $('k-map-party'); if (!box) return;
    const H = { ash: { n: 'Ash', art: 'kai', max: 42 }, elin: { n: 'Elin', art: 'elin', max: 36 },
                mira: { n: 'Mira', art: 'mira', max: 34 } };
    box.innerHTML = Object.keys(H).map(id => {
      const h = H[id];
      const hp = RUN.hp && RUN.hp[id] != null ? RUN.hp[id] : h.max;
      const pct = Math.max(0, Math.min(100, hp / h.max * 100));
      const low = pct <= 34 ? ' k-mp-low' : '';
      return '<div class="k-mp' + low + '" data-hero="' + id + '">'
        + '<img src="../art/' + h.art + '.webp" alt="">'
        + '<span class="k-mp-hp"><b>' + hp + '</b>/' + h.max + '</span>'
        + '<span class="k-mp-bar"><i style="width:' + pct + '%"></i></span></div>';
    }).join('');
  }

  // THE CARD IS THE CONFIRMATION STEP. A phone map with one-tap travel is a map
  // that sends you into an elite by accident; the first tap asks, the second
  // commits, and in between the card says exactly what the stop is and what it
  // is worth. It doubles as the run's outcome card when the run is over.
  function renderCard() {
    const card = $('k-map-card'); if (!card) return;
    if (RUN.over) {
      const won = RUN.over === 'win';
      card.className = 'k-map-card k-mc-end' + (won ? ' k-mc-win' : ' k-mc-loss');
      card.innerHTML = '<div class="k-mc-body"><b>' + (won ? 'THE REGENT FALLS' : 'THE PARTY FALLS') + '</b>'
        + '<span>' + (won ? 'Six stops, ' + RUN.embers + ' embers, and the singing has stopped.'
                          : 'The descent keeps what it takes. Begin again.') + '</span></div>'
        + '<button type="button" id="k-map-go" class="k-mc-go">NEW RUN</button>';
      $('k-map-go').addEventListener('click', (e) => { e.stopPropagation(); newRun(); });
      return;
    }
    if (!_pick && RUN.flash) {
      const f = RUN.flash;
      card.className = 'k-map-card k-mc-flash k-tone-' + (f.tone || 'gold');
      card.innerHTML = (f.icon ? '<span class="k-mc-ico">' + svgIcon(f.icon) + '</span>' : '')
        + '<div class="k-mc-body"><b>' + f.title + '</b><span>' + f.sub + '</span></div>'
        + (f.gain ? '<div class="k-mc-gain"><b>' + f.gain + '</b><em>' + (f.gainSub || '') + '</em></div>' : '');
      return;
    }
    if (!_pick) {
      // A LAST RESORT THAT SHOULD NEVER FIRE. `pending` resume means a run can
      // no longer strand itself, but a map with no reachable stop and no way
      // off it is the single worst state this screen can reach, so it carries
      // its own exit rather than trusting that.
      if (!reachable().length) {
        card.className = 'k-map-card k-mc-idle';
        card.innerHTML = '<div class="k-mc-body"><b>THE ROAD GOES NO FURTHER</b>'
          + '<span>Something went wrong here. Begin again.</span></div>'
          + '<button type="button" id="k-map-go" class="k-mc-go">NEW RUN</button>';
        $('k-map-go').addEventListener('click', (e) => { e.stopPropagation(); newRun(); });
        return;
      }
      card.className = 'k-map-card k-mc-idle';
      card.innerHTML = '<div class="k-mc-body"><b>CHOOSE THE NEXT STOP</b>'
        + '<span>Tap a lit stop to see what waits there.</span></div>';
      return;
    }
    const n = node(_pick), k = KIND[n.kind];
    const foe = n.foe && window.K && window.K.FOES ? window.K.FOES[n.foe] : null;
    card.className = 'k-map-card k-tone-' + k.tone;
    card.innerHTML = '<span class="k-mc-ico">' + svgIcon(n.kind) + '</span>'
      + '<div class="k-mc-body"><b>' + (foe ? foe.name : k.word) + '</b>'
      + '<span>' + k.blurb + '</span></div>'
      + '<div class="k-mc-gain">' + gainText(n) + '</div>'
      + '<button type="button" id="k-map-go" class="k-mc-go">TRAVEL</button>';
    $('k-map-go').addEventListener('click', (e) => { e.stopPropagation(); travel(_pick); });
  }

  // WHAT IS THERE, in numbers. A choice between two stops is only a choice if
  // both prices are on screen at the same time as the decision.
  function gainText(n) {
    const foe = n.foe && window.K && window.K.FOES ? window.K.FOES[n.foe] : null;
    if (n.kind === 'camp') return '<b>REST</b><em>mend + spend</em>';
    if (n.kind === 'story') return '<b>+1</b><em>ember · opens deeper nodes</em>';
    if (foe) return '<b>+' + foe.embers + '</b><em>embers · ' + window.K.foeHp(foe) + ' hp</em>';
    return '';
  }

  function tapNode(id) {
    if (_busy || RUN.over) return;
    if (reachable().indexOf(id) < 0) return;      // a stop you cannot reach says nothing
    if (_pick === id) { travel(id); return; }     // second tap on the same stop commits
    _pick = id; RUN.flash = null;
    renderMap();
  }

  // ── travelling ────────────────────────────────────────────────────────────
  function travel(id) {
    if (_busy) return;
    const n = node(id);
    if (!n || reachable().indexOf(id) < 0) return;
    _busy = true;
    // A STOP IS PENDING UNTIL IT RESOLVES. travel() has to commit `at`/`path`
    // straight away — the map redraws from them — but the encounter itself
    // only begins 260ms later and then runs for as long as the player takes.
    // Closing the tab anywhere in that window used to leave the stop marked
    // spent with nothing gained: a memory whose tier could never be earned
    // again, or, at the boss, a run with `over` unset and no reachable node —
    // stranded, with no button on screen to end it. `pending` is the receipt
    // that says the stop was entered but never finished, and boot() re-enters
    // it instead of dumping the player onto a dead map.
    RUN.at = id; RUN.path.push(id); RUN.stop = n.col + 1; _pick = null; RUN.flash = null;
    RUN.pending = id;
    save();
    renderMap();
    setTimeout(() => { _busy = false; enter(n); }, 260);
  }

  function enter(n) {
    if (n.kind === 'camp') return enterCamp(n);
    if (n.kind === 'story') return enterStory(n);
    return enterFight(n);
  }

  function enterFight(n) {
    const foe = window.K.FOES[n.foe] || window.K.FOES.wraith;
    screen('combat');
    window.K.startCombat({ foe, partyHp: RUN.hp, onEnd: onFightEnd, kizuna: RUN.kizuna || 0,
                           roster: RUN.roster, upgrades: cardUps(), allout: alloutOf(),
                           sigils: RUN.sigils || {},
                           vigor: RUN.vigor || 0,
                           // A DEBT IS SETTLED WITH THE REGENT, not with every
                           // wraith on the way to her. Borrowing against the
                           // whole road would just be a difficulty setting.
                           foeBonus: foe.tier === 'boss' ? (RUN.foeBonus || 0) : 0 });
  }

  function onFightEnd(sum) {
    RUN.pending = null;
    RUN.last = sum;
    RUN.hp = sum.partyHp;
    RUN.kizuna = Math.round((sum.kizuna || 0) * KIZUNA_CARRY);
    // the fight's bonds bank into the run
    for (const k of PAIRS) RUN.bonds[k] = (RUN.bonds[k] || 0) + ((sum.pairBond || {})[k] || 0);
    if (sum.outcome === 'defeat') { RUN.over = 'loss'; save(); return toMap(); }
    // EMBERS ARE PAID FOR THE FIGHT AND FOR THE PARRY, separately. The base is
    // the foe's worth; the bonus is what the parry earned, so the best thing in
    // the game is also the thing that funds the tree.
    const foe = window.K.FOES[sum.foe];
    const base = foe ? foe.embers : 2;
    const clean = sum.cleanliness >= 0.92 ? 2 : sum.cleanliness >= 0.7 ? 1 : 0;
    RUN.embers += base + clean;
    RUN.lastGain = { base, clean };
    // SHOW THE NUMBER THE BONUS IS PAID ON. The 70% / 92% thresholds were
    // invisible, so a fight won with a FLAWLESS riposte and three turned
    // strings could still pay +0 and read as arbitrary — the best thing in the
    // game rewarding you for reasons it would not name.
    const pct = Math.round(sum.cleanliness * 100);
    RUN.flash = {
      icon: foe && foe.tier === 'elite' ? 'elite' : 'fight', tone: 'gold',
      title: (foe ? foe.name : 'IT FALLS') + ' — DOWN',
      sub: pct + '% of the notes turned aside — '
         + (clean === 2 ? 'the road pays double for that.'
          : clean === 1 ? '70% pays one ember, 92% pays two.'
          : 'clean 70% of a fight and the road pays extra.'),
      gain: '+' + (base + clean), gainSub: 'embers' + (clean ? ' · ' + base + '+' + clean + ' parry' : ''),
    };
    if (foe && foe.tier === 'boss') RUN.over = 'win';
    save();
    toMap();
  }

  // THE CAMPFIRE MENDS **AND** OPENS THE TREE — it is not rest-or-forge.
  // Slay the Spire's rest site makes you choose because its attrition is tuned
  // around sometimes not resting; this road's is not — run.sim.cjs tuned the
  // whole six-stop arc on the assumption that a campfire mends, and the
  // pre-boss fire exists specifically so the Regent is a fight rather than the
  // last instalment of a subtraction. The decision here is not whether to
  // heal. It is WHICH nodes, and — one column earlier — whether to take the
  // campfire at all or take the memory that opens the ones you cannot reach.
  const MAXHP = { ash: 42, elin: 36, mira: 34 };
  function enterCamp(n) {
    RUN.hp = RUN.hp || { ...MAXHP };
    // ONE MEND PER FIRE. Re-entering a pending campfire after a reload must
    // show the tree again without paying the heal a second time, or a reload
    // at the fire is an infinite healing loop.
    if (RUN.campDone !== n.id) {
      const before = { ...RUN.hp };
      for (const id of Object.keys(MAXHP)) {
        RUN.hp[id] = Math.min(MAXHP[id], Math.round((RUN.hp[id] != null ? RUN.hp[id] : MAXHP[id]) + MAXHP[id] * CAMP_FRAC));
      }
      RUN.camped = (RUN.camped || 0) + 1;
      RUN.mended = Object.keys(MAXHP).reduce((n2, id) => n2 + (RUN.hp[id] - before[id]), 0);
      RUN.campDone = n.id;
    }
    save();
    // THE FIRE HEARS THEM FIRST. A pair that crossed a level on the road gets
    // their scene before the tree — the fire is where people talk, and the
    // card that comes out of it is the reason to be at one.
    if (!openBondScene()) { screen('camp'); renderCamp(); }
  }

  // ── the bond scenes ──────────────────────────────────────────────────────
  function pendingBonds() {
    return PAIRS.filter(k => {
      const lv = bondLevel(RUN.bonds[k] || 0);
      return lv > (RUN.levels[k] || 0) && !!bondScene(k, (RUN.levels[k] || 0) + 1);
    });
  }
  function openBondScene() {
    const pair = pendingBonds()[0];
    if (!pair) return false;
    const lv = (RUN.levels[pair] || 0) + 1;
    _scene = { ...bondScene(pair, lv), kind: 'bond', pair, lv };
    _beat = 0;
    screen('scene');
    renderScene();
    return true;
  }
  // A fork taken: the card is won, and now it has to fit. Five slots a hero,
  // always — so one of the two must give something up, and which one is the
  // player's to decide.
  function takeBond(ix) {
    if (!_scene || _scene.kind !== 'bond') return;
    const pick = _scene.picks[ix]; if (!pick) return;
    RUN.levels[_scene.pair] = _scene.lv;
    if (!heard(_scene.id)) { PROFILE.heard.push(_scene.id); }
    if (!won(pick.card)) { PROFILE.won.push(pick.card); }
    saveProfile();
    _pendingCard = pick.card;
    _pendingAfter = pick.after;
    // The level also teaches them something about what they already carry.
    RUN.pendingSigil = sigilFor(_scene.pair, _scene.lv);
    _scene = null; _beat = 0;
    save();
    screen('swap');
    renderSwap();
  }

  // ── the fire ──────────────────────────────────────────────────────────────
  function renderCamp() {
    const wrap = document.getElementById('k-camp-tree');
    if (!wrap) return;
    document.getElementById('k-camp-embers').textContent = RUN.embers;
    const cspark = document.getElementById('k-camp-ember-ico');
    if (cspark && !cspark.dataset.drawn) { cspark.innerHTML = svgIcon('ember'); cspark.dataset.drawn = '1'; }
    document.getElementById('k-camp-mend').textContent = '+' + (RUN.mended || 0);
    const tierEl = document.getElementById('k-camp-tier');
    if (tierEl) tierEl.textContent = 'TIER ' + RUN.tier;

    wrap.innerHTML = ['ash', 'elin', 'mira'].map(hero => {
      const rows = TREE.filter(n => n.hero === hero).map(n => nodeHTML(n)).join('');
      return '<div class="k-ct-col"><header>'
        + '<img src="../art/' + ({ ash: 'kai', elin: 'elin', mira: 'mira' })[hero] + '.webp" alt="">'
        + '<b>' + HERO_NAME[hero] + '</b></header>' + rows + '</div>';
    }).join('');
    const shared = document.getElementById('k-camp-shared');
    if (shared) shared.innerHTML = TREE.filter(n => n.hero === 'all').map(n => nodeHTML(n, true)).join('');
    wrap.parentNode.querySelectorAll('.k-tnode').forEach(b => {
      b.addEventListener('click', (e) => { e.stopPropagation(); kindle(b.dataset.node); });
    });
    renderCampRoster();
  }

  function nodeHTML(n, wide) {
    const f = nodeFace(n);
    const own = held(n.id);
    const sealed = RUN.tier < n.tier;
    const poor = !own && !sealed && RUN.embers < n.cost;
    const cls = ['k-tnode'];
    if (own) cls.push('k-tn-own');
    if (sealed) cls.push('k-tn-sealed');
    if (poor) cls.push('k-tn-poor');
    if (wide) cls.push('k-tn-wide');
    return '<button type="button" class="' + cls.join(' ') + '" data-node="' + n.id + '"'
      + (own || sealed || poor ? ' tabindex="-1"' : '') + '>'
      + '<span class="k-tn-top"><b>' + f.name + '</b>'
      + '<em class="k-tn-cost">' + (own ? 'KINDLED' : sealed ? 'TIER ' + n.tier : n.cost) + '</em></span>'
      + '<span class="k-tn-what">' + (f.from ? '<i>' + f.from + '</i> → ' : '') + f.to + '</span>'
      + (sealed ? '<span class="k-tn-seal">A MEMORY OPENS THIS</span>' : '')
      + '</button>';
  }

  function renderCampRoster() {
    const box = document.getElementById('k-camp-party'); if (!box) return;
    const art = { ash: 'kai', elin: 'elin', mira: 'mira' };
    box.innerHTML = Object.keys(MAXHP).map(id => {
      const hp = RUN.hp && RUN.hp[id] != null ? RUN.hp[id] : MAXHP[id];
      const pct = Math.max(0, Math.min(100, hp / MAXHP[id] * 100));
      return '<div class="k-mp' + (pct <= 34 ? ' k-mp-low' : '') + '">'
        + '<img src="../art/' + art[id] + '.webp" alt="">'
        + '<span class="k-mp-hp"><b>' + hp + '</b>/' + MAXHP[id] + '</span>'
        + '<span class="k-mp-bar"><i style="width:' + pct + '%"></i></span></div>';
    }).join('');
  }

  function kindle(id) {
    const n = treeNode(id);
    // `travel` and `tapNode` are protected because reachable() empties when a
    // run ends. These are not, and they are all on window.R — so an ended run
    // could still be spent from a console. Cheap to close, so close it.
    if (RUN.over) return;
    if (!n || held(id) || RUN.tier < n.tier || RUN.embers < n.cost) return;
    RUN.embers -= n.cost;
    RUN.nodes.push(id);
    save();
    renderCamp();
    const btn = document.querySelector('[data-node="' + id + '"]');
    if (btn) { btn.classList.remove('k-tn-lit'); void btn.offsetWidth; btn.classList.add('k-tn-lit'); }
  }

  function leaveCamp() {
    if (RUN.over) return;
    RUN.pending = null;
    const bought = RUN.nodes.length;
    RUN.flash = { icon: 'camp', tone: 'gold', title: 'THE FIRE BURNS DOWN',
      sub: bought ? 'Sharper than you came. Nobody says much.' : 'Wounds close. Nobody says much.',
      gain: '+' + (RUN.mended || 0), gainSub: 'health mended' };
    save();
    toMap();
  }
  // ── a memory ──────────────────────────────────────────────────────────────
  let _beat = 0, _scene = null;
  let _pendingCard = null, _pendingAfter = '', _swapPick = null;
  function enterStory(n) {
    _scene = SCENES[Math.min(RUN.seen ? RUN.seen.length : 0, SCENES.length - 1)];
    _beat = 0;
    save();
    screen('scene');
    renderScene();
  }

  const CAST = { ash: { n: 'ASH', art: 'kai' }, elin: { n: 'ELIN', art: 'elin' },
                 mira: { n: 'MIRA', art: 'mira' } };

  function renderScene() {
    const box = $('k-scene-line'), who = $('k-scene-who'), cast = $('k-scene-cast');
    if (!box || !_scene) return;
    $('k-scene-title').textContent = _scene.title;
    const done = _beat >= _scene.beats.length;
    $('k-scene').classList.toggle('k-sc-done', done);
    const forking = done && _scene.kind === 'bond';
    $('k-scene').classList.toggle('k-sc-fork', forking);
    const forkBox = $('k-scene-fork');
    if (forkBox) {
      forkBox.classList.toggle('k-hidden', !forking);
      if (forking) {
        // SHOW THE CARD, not a description of it. The fork used to print a
        // name and a sentence in a box, so the player chose between two cards
        // while looking at neither — and then met the real face for the first
        // time in the middle of a fight. It is the same renderer the hand
        // uses, so the preview cannot disagree with what arrives.
        forkBox.innerHTML = '<span class="k-fork-ask">' + (_scene.ask || '') + '</span>'
          + '<div class="k-fork-row">'
          + _scene.picks.map((p, i) =>
              '<button type="button" class="k-fork" data-ix="' + i + '">'
              + '<span class="k-fork-line">' + p.line + '</span>'
              + window.K.staticCardHTML(p.card, { cls: 'k-card-fork' })
              + '</button>').join('')
          + '</div>';
        forkBox.querySelectorAll('.k-fork').forEach(b =>
          b.addEventListener('click', (e) => { e.stopPropagation(); takeBond(+b.dataset.ix); }));
      }
    }
    if (forking) {
      who.textContent = PAIR_NAME[_scene.pair] || '';
      who.classList.remove('k-hidden');
      box.className = 'k-sc-line k-sc-narr';
      box.textContent = '';
      $('k-scene-next').textContent = '';
      castRow();
      return;
    }

    if (done) {
      // THE SCENE PAYS OUT ON SCREEN. A cutscene that changes the run silently
      // is a cutscene the player has no reason to have watched.
      who.textContent = '';
      box.innerHTML = '<b class="k-sc-open">TIER ' + Math.min(5, RUN.tier + 1) + ' OPENS</b>'
        + '<span class="k-sc-openx">The deeper nodes are theirs to kindle now.</span>';
      $('k-scene-next').textContent = 'ON';
    } else {
      const b = _scene.beats[_beat];
      who.textContent = b.who ? CAST[b.who].n : '';
      who.classList.toggle('k-hidden', !b.who);
      box.className = 'k-sc-line' + (b.who ? '' : ' k-sc-narr');
      box.textContent = b.line;
      $('k-scene-next').textContent = _beat === _scene.beats.length - 1 ? 'END' : 'NEXT';
    }
    castRow();
    const dots = $('k-scene-dots');
    if (dots) dots.innerHTML = _scene.beats
      .map((_, i) => '<i class="' + (i < _beat ? 'on' : i === _beat ? 'now' : '') + '"></i>').join('');
  }

  // A BOND SCENE IS A TWO-HANDER. Only the pair is in the shot; the third is
  // somewhere else, which is the whole reason the conversation is happening.
  function castRow() {
    const cast = $('k-scene-cast'); if (!cast || !_scene) return;
    const done = _beat >= _scene.beats.length;
    const speaker = done ? null : (_scene.beats[_beat].who || null);
    const inShot = _scene.kind === 'bond' ? _scene.pair.split('|') : ['elin', 'ash', 'mira'];
    const order = ['elin', 'ash', 'mira'].filter(h => inShot.indexOf(h) >= 0);
    cast.innerHTML = order.map(id => {
      const c = CAST[id];
      return '<div class="k-sc-fig' + (speaker === id ? ' k-sc-on' : (speaker ? ' k-sc-off' : ''))
        + '" data-hero="' + id + '"><img src="../art/' + c.art + '.webp" alt="' + c.n + '"></div>';
    }).join('');
    cast.classList.toggle('k-sc-two', order.length === 2);
  }

  function sceneNext() {
    if (!_scene || RUN.over) return;
    // a bond scene ends on its fork and waits there — the choice is the exit
    if (_scene.kind === 'bond' && _beat >= _scene.beats.length) return;
    if (_beat < _scene.beats.length) { _beat++; renderScene(); return; }
    finishScene();
  }
  function sceneSkip() {
    if (!_scene || RUN.over) return;
    if (_scene.kind === 'bond') { _beat = _scene.beats.length; renderScene(); return; }
    _beat = _scene.beats.length;      // straight to the payout, never past it:
    renderScene();                     // skipping the scene must not skip the reward
  }
  function finishScene() {
    RUN.pending = null;
    RUN.seen = RUN.seen || [];
    if (_scene && RUN.seen.indexOf(_scene.id) < 0) RUN.seen.push(_scene.id);
    RUN.tier = Math.min(5, RUN.tier + 1);
    RUN.embers += 1;
    RUN.flash = { icon: 'story', tone: 'violet', title: (_scene ? _scene.title : 'A MEMORY'),
      sub: 'Tier ' + RUN.tier + ' of the tree opens to the three of them.',
      gain: '+1', gainSub: 'ember · tier' };
    _scene = null; _beat = 0;
    save();
    toMap();
  }

  // ── the awakening screen ─────────────────────────────────────────────────
  function renderWake() {
    const offer = wakeOffer();
    const box = $('k-wake-cards'); if (!box) return;
    // STILL CLOSE names a real pair, chosen once and remembered, so the card
    // can say WHO — "a pair begins close" is a mechanic; "Ash and Mira are
    // still close" is the thing the game is actually about.
    const pair = wakePair();
    const won = wonCards();
    box.innerHTML = offer.map(w => {
      // The voice line already names the pair; repeating it here just said
      // ASH + MIRA twice. The number is the part the player cannot infer —
      // level 1 is 12, so 10 is one stitch short of their first scene.
      const gain = w.id === 'close' ? 'they begin at 10 of ' + BOND_STEPS[0]
                 : w.id === 'habit' ? 'carry ' + (won.length === 1
                     ? window.K.CARD_DEFS[won[0]].name : 'one of ' + won.length + ' cards you have won')
                 : w.gain;
      // STILL CLOSE speaks in the voice of the pair it names. Every other
      // memory carries its own; the row is never empty, because a card with
      // no voice put its title on a different baseline from the two beside it.
      const who = w.id === 'close' ? PAIR_NAME[pair] : w.who;
      return '<button type="button" class="k-wk k-wk-' + w.kind + '" data-wake="' + w.id + '">'
        + '<span class="k-wk-who">' + who + '</span>'
        + '<b class="k-wk-title">' + w.title + '</b>'
        + '<em class="k-wk-line">' + w.line + '</em>'
        + '<span class="k-wk-gain">' + gain + '</span>'
        + (w.cost ? '<span class="k-wk-cost">' + w.cost + '</span>' : '')
        + '</button>';
    }).join('');
    box.querySelectorAll('.k-wk').forEach(b =>
      b.addEventListener('click', (e) => { e.stopPropagation(); takeWake(b.dataset.wake); }));
  }

  function takeWake(id) {
    if (!RUN || RUN.woke) return;
    const w = wakeDef(id); if (!w) return;
    // ONLY WHAT WAS OFFERED. Without this the id is an open door into the
    // whole pool from anywhere that can reach R.takeWake.
    if (wakeOffer().indexOf(w) < 0) return;
    RUN.woke = id;
    if (id === 'habit') {
      const won = wonCards();
      if (!won.length) { RUN.woke = null; return; }
      // Straight into the swap screen the rest of the game already uses, so
      // the five-slot rule is enforced by the one piece of code that knows it.
      _pendingCard = won[0];
      _pendingAfter = 'The hands remember it. Something has to make room.';
      _swapPick = null; _swapBack = 'map';
      save();
      screen('swap'); renderSwap();
      return;
    }
    w.apply(RUN);
    save();
    toMap();
  }

  // ── the swap ─────────────────────────────────────────────────────────────
  function renderSwap() {
    const K = window.K;
    const card = K.CARD_DEFS[_pendingCard]; if (!card) return toMap();
    const pair = K.pairOf(_pendingCard) || ['ash'];
    $('k-swap-line').textContent = _pendingAfter || '';
    // WRAPPED. swapCardHTML returns three sibling spans, and dropping them
    // straight into a flex container made `#k-swap-new > span` match all three
    // — so the cost, the body and the owners each got the card's own styling
    // and the whole thing spilled off the right edge of the screen.
    // THE SWAP KEEPS ITS COMPACT CHIP. A full 150px face was tried here and
    // hung off the top of the screen — the header has 90px — and it would have
    // been competing with ten card rows for the eye anyway. The place a card
    // has to be SEEN is the fork, where it is chosen before it is owned; here
    // it is being weighed against ten others in the same grammar they use.
    $('k-swap-new').innerHTML = '<span class="k-sw-newcard">' + swapCardHTML(_pendingCard, true) + '</span>';
    $('k-swap-ask').textContent = 'FIVE SLOTS EACH — WHAT LEAVES?';
    $('k-swap-cols').innerHTML = pair.map(h => {
      const art = ({ ash: 'kai', elin: 'elin', mira: 'mira' })[h];
      const rows = (RUN.roster[h] || []).map(id =>
        '<button type="button" class="k-swapcard' + (_swapPick && _swapPick.id === id && _swapPick.hero === h ? ' k-sw-on' : '')
        + '" data-hero="' + h + '" data-id="' + id + '">' + swapCardHTML(id, false) + '</button>').join('');
      return '<div class="k-sw-col"><header><img src="../art/' + art + '.webp" alt="">'
        + '<b>' + h.toUpperCase() + '</b><em>' + (RUN.roster[h] || []).length + '/5</em></header>' + rows + '</div>';
    }).join('');
    $('k-swap-cols').querySelectorAll('.k-swapcard').forEach(b =>
      b.addEventListener('click', (e) => { e.stopPropagation();
        _swapPick = { hero: b.dataset.hero, id: b.dataset.id }; renderSwap(); }));
    const go = $('k-swap-go');
    go.disabled = !_swapPick;
    go.textContent = _swapPick
      ? 'TRADE ' + K.CARD_DEFS[_swapPick.id].name.toUpperCase() + ' FOR ' + card.name.toUpperCase()
      : 'CHOOSE A CARD TO GIVE UP';
  }
  function swapCardHTML(id, big) {
    const K = window.K, c = K.CARD_DEFS[id];
    const who = (K.ownerHeroes(c) || []).map(h => h.toUpperCase()).join(' + ');
    return '<span class="k-sw-cost">' + c.cost + '</span>'
      + '<span class="k-sw-body"><b>' + c.name + '</b>'
      + '<em>' + K.effectText(c.base) + '</em></span>'
      + '<span class="k-sw-who">' + who + '</span>';
  }
  function confirmSwap() {
    if (!_swapPick || !_pendingCard) return;
    const list = RUN.roster[_swapPick.hero];
    const ix = list.indexOf(_swapPick.id);
    if (ix < 0) return;
    list[ix] = _pendingCard;
    RUN.flash = { icon: 'camp', tone: 'gold', title: window.K.CARD_DEFS[_pendingCard].name.toUpperCase() + ' — LEARNED',
      sub: _swapPick.hero.toUpperCase() + ' gives up ' + window.K.CARD_DEFS[_swapPick.id].name + ' to carry it.',
      gain: '5/5/5', gainSub: 'the deck never grows' };
    const _wasCard = _pendingCard;
    _pendingCard = null; _swapPick = null; _pendingAfter = '';
    const back = _swapBack; _swapBack = null;
    const pair = window.K.pairOf(_wasCard) || (_wasCard ? null : null);
    save();
    // A BOND LEVEL PAYS TWICE: a card, and a mark on one they already carry.
    if (back !== 'map' && RUN.pendingSigil && pair) return openMark(pair.join('|'));
    // A SWAP KNOWS WHERE IT CAME FROM. The awakening's card arrives before
    // there is a campfire to go back to; returning to one would have shown the
    // fire's screen with no fire behind it.
    if (back === 'map') return toMap();
    // another pair may also be waiting at this same fire
    if (!openBondScene()) { screen('camp'); renderCamp(); }
  }

  // ── the mark ─────────────────────────────────────────────────────────────
  // One screen, one decision: the bond decided WHAT was learned, the player
  // decides which card it lands on. Every card is drawn as a card — the whole
  // point is that the player is looking at the thing they are changing.
  function renderMark() {
    const K = window.K, sig = RUN.pendingSigil, def = K.SIGILS[sig];
    if (!def) return leaveMark();
    const pair = _markPair || PAIRS[0];
    $('k-mark-title').textContent = def.name.toUpperCase();
    $('k-mark-line').textContent = def.line;
    $('k-mark-ask').textContent = 'WHICH CARD LEARNS IT?';
    const heroes = pair.split('|');
    // NOBODY LEFT TO TEACH. Six marks is the most a road can grant and a pair
    // owns ten cards, so this cannot happen today — but a screen whose only
    // exit is a button that might all be disabled is one roster change away
    // from being a dead end, and there is no skip.
    if (heroes.every(h => (RUN.roster[h] || []).every(id => RUN.sigils[id]))) return leaveMark();
    $('k-mark-cols').innerHTML = heroes.map(h =>
      '<div class="k-mk-col"><header><b>' + h.toUpperCase() + '</b></header><div class="k-mk-row">'
      + (RUN.roster[h] || []).map(id => {
          const already = RUN.sigils[id];
          return '<button type="button" class="k-mk' + (already ? ' k-mk-taken' : '')
            + '" data-id="' + id + '"' + (already ? ' disabled' : '')
            + '>' + K.staticCardHTML(id, { sigil: already || sig, cls: 'k-card-mk' })
            + (already ? '<span class="k-mk-note">already ' + K.SIGILS[already].name + '</span>' : '')
            + '</button>';
        }).join('')
      + '</div></div>').join('');
    $('k-mark-cols').querySelectorAll('.k-mk:not([disabled])').forEach(b =>
      b.addEventListener('click', (e) => { e.stopPropagation(); placeSigil(b.dataset.id); }));
  }
  function placeSigil(cardId) {
    if (!RUN || !RUN.pendingSigil) return;
    // ONE MARK PER CARD. Stacking would make a single card the whole deck.
    if (RUN.sigils[cardId]) return;
    const owned = [].concat(RUN.roster.ash, RUN.roster.elin, RUN.roster.mira);
    if (owned.indexOf(cardId) < 0) return;      // only a card they actually carry
    RUN.sigils[cardId] = RUN.pendingSigil;
    RUN.flash = { icon: 'camp', tone: 'gold',
      title: window.K.CARD_DEFS[cardId].name.toUpperCase() + ' \u2014 '
             + window.K.SIGILS[RUN.pendingSigil].name.toUpperCase(),
      sub: window.K.SIGILS[RUN.pendingSigil].line,
      gain: 'the bond', gainSub: 'changes what you already carry' };
    RUN.pendingSigil = null; RUN.markPair = null; _markPair = null;
    save();
    leaveMark();
  }
  function leaveMark() {
    RUN.pendingSigil = null; RUN.markPair = null; _markPair = null; save();
    if (!openBondScene()) { screen('camp'); renderCamp(); }
  }
  function openMark(pair) {
    if (!RUN || !RUN.pendingSigil) return false;
    _markPair = pair || RUN.markPair;
    if (!_markPair) return false;
    RUN.markPair = _markPair; save();
    screen('mark'); renderMark();
    return true;
  }

  function toMap() { screen('map'); renderMap(); }

  function newRun(seed) {
    RUN = freshRun(seed);
    RUN.roster = window.K.baseRoster();
    _pick = null; _busy = false;
    save();
    toWake();
  }
  function toWake() { screen('wake'); renderWake(); }

  // ── boot ──────────────────────────────────────────────────────────────────
  function bindCamp() {
    const go = $('k-camp-leave');
    if (go) go.addEventListener('click', (e) => { e.stopPropagation(); leaveCamp(); });
    // TAP ANYWHERE ADVANCES. A scene that can only be advanced from one 60px
    // button is a scene read with the thumb hunting instead of with the eyes.
    const sc = $('k-scene');
    if (sc) sc.addEventListener('click', (e) => {
      if (e.target.closest('#k-scene-skip')) return;
      e.stopPropagation(); sceneNext();
    });
    const skip = $('k-scene-skip');
    if (skip) skip.addEventListener('click', (e) => { e.stopPropagation(); sceneSkip(); });
    const sw = $('k-swap-go');
    if (sw) sw.addEventListener('click', (e) => { e.stopPropagation(); confirmSwap(); });
    const mute = $('k-mute');
    if (mute) {
      const paint = () => {
        // the PREFERENCE, not the effective state — the button reports what the
        // player chose, and ?test=1 suppressing audio is not their choice
        const on = window.K.musicPref ? window.K.musicPref() : true;
        mute.classList.toggle('k-muted', !on);
        mute.setAttribute('aria-pressed', on ? 'false' : 'true');
        mute.title = on ? 'Music on' : 'Music off';
        // The speaker draws its own waves; muted, they are replaced by a slash,
        // because a speaker with the waves merely dimmed reads as "quiet", not
        // "off", at 15px.
        mute.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">'
          + '<path d="M4 9 h3.5 L12 5 v14 l-4.5 -4 H4 z" fill="currentColor"/>'
          + (on
              ? '<path d="M15.5 9.2 a4 4 0 0 1 0 5.6 M18 6.7 a7.5 7.5 0 0 1 0 10.6"'
                + ' fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>'
              : '<path d="M15.5 9.5 L21 14.5 M21 9.5 L15.5 14.5"'
                + ' fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>')
          + '</svg>';
      };
      paint();
      mute.addEventListener('click', (e) => {
        e.stopPropagation();
        window.K.musicSet(!window.K.musicPref());
        paint();
      });
    }
  }

  function boot(opts) {
    opts = opts || {};
    PROFILE = opts.freshProfile ? { heard: [], won: [] } : loadProfile();
    bindCamp();
    const saved = opts.fresh ? null : load();
    RUN = saved || freshRun(opts.seed);
    if (!RUN.roster) RUN.roster = window.K.baseRoster();
    _pick = null; _busy = false;
    if (!saved) save();
    // A STOP LEFT PENDING IS RE-ENTERED, not skipped. Combat is not
    // serialisable, so a fight resumed this way starts over against the same
    // foe with the party's carried wounds — the honest behaviour, and vastly
    // better than the alternatives it replaces: a memory silently stripped of
    // the only tier it could ever have given, or a boss stop that leaves the
    // run with nowhere to go and no way to end it.
    // AN AWAKENING LEFT UNANSWERED IS RE-ASKED. Closing the tab on the offer
    // used to be the one way to start a run with no memory at all.
    if (!RUN.over && !RUN.woke && !RUN.pending && !RUN.path.length) return toWake();
    // A MARK EARNED AND NOT PLACED IS RE-ASKED, for the same reason: closing
    // the tab on it was the one way to lose a reward the road had paid for.
    if (!RUN.over && RUN.pendingSigil && RUN.markPair && openMark(RUN.markPair)) return;
    if (RUN.pending && !RUN.over) {
      const n = node(RUN.pending);
      if (n) { enter(n); return; }
      RUN.pending = null; save();
    }
    toMap();
  }

  window.R = {
    boot,
    active: () => !!RUN && !RUN.over,
    state: () => RUN,
    map: () => (RUN ? RUN.map : []),
    reachable,
    travel, tapNode, newRun, clear,
    screen,
    render: renderMap,
    TREE, treeNode, kindle, leaveCamp, renderCamp, cardUps, alloutOf, nodeFace,
    pendingBonds, openBondScene, takeBond, confirmSwap, renderSwap,
    WAKES, wakeOffer, takeWake, renderWake, wakeDef, wakePair,
    SIGIL_BY_PAIR, sigilFor, renderMark, placeSigil, openMark, leaveMark,
    swapPick: () => _swapPick, pendingCard: () => _pendingCard,
    PAIRS, BOND_STEPS, BONDS, bondLevel, bondScene, PAIR_NAME,
    profile: () => PROFILE, resetProfile() { PROFILE = { heard: [], won: [] }; saveProfile(); },
    SCENES, sceneNext, sceneSkip, scene: () => _scene, beat: () => _beat,
    // test-only
    _set(patch) { Object.assign(RUN, patch || {}); save(); renderMap(); },
    _pick: () => _pick,
    KIND, PLAN, STOPS, CAMP_FRAC, KIZUNA_CARRY,
  };
})();
