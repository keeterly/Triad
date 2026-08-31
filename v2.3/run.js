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
  // ELEVEN COLUMNS, NOT SIX. A six-stop road put every upgrade the game has —
  // two bond conversations, the mark that puts a state on a card, and the whole
  // ember tree — onto the two campfire stops, because those were the only stops
  // that could carry them. The run was over before any of it had room to land.
  // Eleven stops is not "more of the same": it is the space the developing half
  // of the game needs in order to be spread out instead of stacked.
  const COLS = 11;
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
  // seeded Fisher-Yates, on the run's own cursor — a shuffled lane order is
  // what stops every road being the same eleven coins in the same eleven places
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rr() * (i + 1)) % (i + 1);
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  const shuffled = (a) => shuffle(a.slice());

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
    // ── the shared nodes: what all three of them own together ──
    // NINE OF TEN NODES WERE THE SAME CHOICE. Every tier offered one hero's
    // card traded for a bigger version of that card, which is a number going up
    // in three different places — a grid, but not a decision, because nothing
    // on it changed how a turn is PLAYED. These two do.
    //
    // RESOLVE is the run-scale rung of the AP ladder (the other two are the
    // combo refund, which lasts a turn, and the all-out's gear, which lasts a
    // fight). One more AP every turn for the rest of the road is the largest
    // single thing on this tree and it is priced like it: five embers at tier
    // 2, which is what the DEEPEST card node costs two tiers later. That is the
    // fork the campfire did not have — nine of its ten nodes were one hero's
    // card traded for a bigger version of that card, and the price of this one
    // is a whole tier of sharpening gone.
    { id: 'all.resolve',     hero: 'all',  tier: 2, cost: 5, ap: 1,
      name: 'RESOLVE', blurb: 'One more AP, every turn, for the rest of the road.' },
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
  // Summed rather than found, so a second AP node could be added to the tree
  // without this becoming the reason it does not work.
  const apBonusOf = () => RUN.nodes.map(treeNode)
    .reduce((a, n) => a + ((n && n.ap) || 0), 0);
  // What a node WILL DO, read off the two card faces rather than written twice.
  // A tree that describes its own effects in prose is a tree that goes stale
  // the first time a card is retuned.
  function nodeFace(n) {
    if (!n.card) return { name: n.name, from: '', to: n.blurb || '' };
    const K = window.K;
    const base = K.CARD_DEFS ? K.CARD_DEFS[n.card] : null;
    const up = K.CARD_UPS ? K.CARD_UPS[n.card] : null;
    // THE CLAUSE IS PART OF THE FACE. This read only `.base`, which was fine
    // while every upgrade was the same card with bigger numbers — Build 96
    // rewrote them as ROLE changes, and two of them change nothing but the
    // combo: Twin Fang+ has the identical base and learns to punish a Broken
    // foe. Reading the base alone, the fire showed "4 damage x2 -> 4 damage x2"
    // and asked five embers for it.
    const face = (c) => {
      if (!c) return '';
      const eff = K.effectText(c.base);
      const cd = c.cond && K.condText ? K.condText(c) : '';
      return cd ? eff + ' \u00b7 ' + cd : eff;
    };
    return { name: (up && up.name) || n.card, from: face(base), to: face(up) };
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
      // Ash is he/him in every bond scene ("What does he say to that?", "He
      // shifts his guard"). This was the one place that said otherwise, and it
      // is the SECOND screen of the game.
      line: 'Ash twists the dry grass the way his mother did, in a kitchen that is gone. '
          + 'His hands do it while he talks about something else. The road will want a fire.',
      gain: '+4 embers', apply(r) { r.embers += 4; } },
    { id: 'lastnote', kind: 'plain', who: 'ELIN', title: 'THE LAST NOTE',
      line: 'The three of them held one chord, once, at the end of something. Elin never let it go. '
          + 'She hums it under her breath, waiting for the other two to come in.',
      // WHAT IT SETS IS WHAT IT SAYS. These call `r.kizuna`, and every other
      // surface — the combat bar, the map HUD, the reckoning's own prize band —
      // calls that KIZUNA. Meanwhile BOND is the separate per-pair ladder the
      // awakening's "still close" memory moves. Two currencies, one word, on
      // the second screen a player ever sees.
      gain: 'kizuna begins at 45', apply(r) { r.kizuna = 45; } },
    { id: 'rest', kind: 'plain', who: 'MIRA', title: 'A NIGHT THAT KEPT',
      line: 'One night nothing came for them. Mira remembers two warm backs against hers, and how she '
          + 'stayed awake anyway, guarding a quiet that did not need her. She kept the quiet.',
      gain: '+6 health, all three', apply(r) { r.vigor += 6; } },
    { id: 'close', kind: 'plain', who: null, title: 'STILL CLOSE',
      line: 'A small kindness passed between two of them, too small for either to name it. '
          + 'It is why they can still find each other in the dark without looking.',
      gain: 'a pair begins close', apply(r) { r.bonds[wakePair()] = 10; } },
    // the persistent slot — offered only when an earlier road won something
    { id: 'habit', kind: 'card', who: 'ALL THREE', title: 'AN OLD HABIT',
      line: 'A thing the three of them worked out on a road that ended badly. The hands kept it '
          + 'after the rest of them agreed to let go. The deck will have to make room.',
      gain: 'carry a card you have won', apply() {} },
    // the trades — one of these is always in the offer
    { id: 'borrowed', kind: 'trade', who: 'ALL THREE', title: 'BORROWED FIRE',
      line: 'There is a way to take the warmth now and pay for it further down. All three of them '
          + 'know how. All three of them pretend not to.',
      gain: '+8 embers', cost: 'they set out already hurt',
      apply(r) { r.embers += 8; r.hp = { ash: 34, elin: 29, mira: 27 }; } },
    { id: 'debt', kind: 'trade', who: 'ELIN', title: 'A DEBT OF BREATH',
      line: 'Reach back far enough and the chord is already ringing. So is everything that was '
          + 'listening the first time. Elin reaches anyway.',
      gain: 'kizuna begins at 70', cost: 'the Regent wakes with 14 more',
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
    'ash|elin':  ['retain', 'surge'],  // she holds the line; he keeps one back
    'ash|mira':  ['chain', 'rally'],   // the two quick ones — a move flows on
    'elin|mira': ['lead', 'surge'],    // they are the ones who start things
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

  // ═══════════════════════════════════════════════════════════════════════
  // THE RECALLS — a memory the ROAD sets off, not the fighting
  // ═══════════════════════════════════════════════════════════════════════
  // The bond scenes are the game's developing half and there was exactly one
  // thing that could open one: two heroes acting well together often enough to
  // cross a threshold. So a party that travelled a long way, put down something
  // it had never met, and answered a crossroads in a way that cost them
  // something developed NOTHING. The journey was scenery with a fight in it.
  //
  // A recall is the same beat with a different key. Everything downstream is
  // shared — the scene, the fork, the card, the swap that makes room for it,
  // the profile that remembers it after the run dies — so this is a second
  // DOOR into a room that was already built, not a second room.
  //
  // `when` reads the journey ledger and nothing else. It is a pure function of
  // the run, which is what lets a check drive it without walking a road.
  const RECALLS = [
    // ── A PLACE ──
    { id: 'rc-deep', who: 'ash', title: 'HOW FAR IN',
      when: (r) => r.journey.deepest >= 4,
      beats: [
        { who: null,  line: 'The light has not changed in hours. It is not that it is dark — it is that it is the SAME, and has been, for longer than a day should hold still.' },
        { who: 'ash', line: 'I used to be able to tell how far we had come by how tired I was.' },
        { who: 'mira', line: 'And now?' },
        { who: 'ash', line: 'Now I am tired the same amount I was at the gate. That is the part I do not like.' },
      ],
      ask: 'What does he do with that?',
      picks: [
        { line: 'He plants himself and lets it come to him.', card: 'lastvigil',
          after: 'If the road will not end, he will simply stop moving first.' },
        { line: 'He stops counting and keeps walking.', card: 'gravebloom',
          after: 'Whatever this place is taking, he decides not to notice it going.' },
      ] },
    // ── A MONSTER ──
    { id: 'rc-wraith', who: 'mira', title: 'SHE KNEW THAT ONE',
      when: (r) => r.journey.felled.indexOf('wraith') >= 0,
      beats: [
        { who: null,   line: 'It came apart the way wet paper does. Mira does not look away from where it was for a long time after there is nothing there.' },
        { who: 'elin', line: 'You have seen one before.' },
        { who: 'mira', line: 'I have BEEN one before. For about a week. It is not a thing you catch, it is a thing you agree to.' },
        { who: 'elin', line: '…and you disagreed.' },
        { who: 'mira', line: 'Somebody disagreed on my behalf. I never found out who.' },
      ],
      ask: 'What does she take from it?',
      picks: [
        { line: 'The trick of coming apart on purpose.', card: 'cutthecord',
          after: 'Open it, step out of reach — and the line moves with her.' },
        { line: 'The trick of not being where the grief lands.', card: 'coldmercy',
          after: 'Slow the song before it reaches anyone.' },
      ] },
    // ── AN INTERACTION: somebody nearly lost ──
    { id: 'rc-brink', who: 'elin', title: 'THE COUNT',
      when: (r) => r.journey.brink.length >= 1,
      beats: [
        { who: null,   line: 'Nobody died. Elin has said so twice, which is once more than she needed to.' },
        { who: 'elin', line: 'I keep a number. I have kept it since before either of you.' },
        { who: 'ash',  line: 'Of what?' },
        { who: 'elin', line: 'Of the ones I got to in time. It is not a large number and I do not intend to stop adding to it.' },
      ],
      ask: 'What does she reach for?',
      picks: [
        { line: 'The thing that keeps everyone standing.', card: 'shieldsong',
          after: 'Nobody strikes. The whole line simply stops being open.' },
        { line: 'The thing that finds the one who is worst.', card: 'quietword',
          after: 'Cover the one who needs it, and find the next answer.' },
      ] },
    // ── A DECISION ──
    { id: 'rc-chose', who: 'ash', title: 'WHAT IT COST',
      when: (r) => r.journey.chose.length >= 1,
      beats: [
        { who: null,   line: 'The crossroads is a long way behind them. Ash is still doing the arithmetic on it.' },
        { who: 'ash',  line: 'I want it written down somewhere that we chose that.' },
        { who: 'mira', line: 'Nobody is writing anything down.' },
        { who: 'ash',  line: 'Then I will remember it, and you can all be furious with me later when I bring it up.' },
      ],
      ask: 'What does he carry out of it?',
      picks: [
        { line: 'The willingness to pay up front.', card: 'ashenoath',
          after: 'Everything, at once, and nothing held back.' },
        { line: 'The habit of covering the one who did not choose.', card: 'shieldblade',
          after: 'He stands in front. She works behind him.' },
      ] },
  ];

  // ── the bond scenes ──────────────────────────────────────────────────────
  // Six: three pairs, two levels each. Every one ends in a fork, and the fork
  // IS the card — the same two people at the same point in their story, taken
  // two different ways. A choice that only changed a line of dialogue would be
  // a choice in name only.
  const BONDS = {
    'ash|elin': [
      { id: 'ae1', title: 'THE PRACTICE', beats: [
        { who: null,   line: 'Nobody suggests it. They simply end up shoulder to shoulder, the way water ends up downhill.' },
        { who: 'elin', line: 'You still drift left when you are tired. I could set a clock by it.' },
        { who: 'ash',  line: 'And you still slide across to cover it before I have finished being tired.' },
        { who: 'elin', line: 'I always will. I would only rather it were a choice than a reflex.' },
      ], ask: 'What does he say to that?', picks: [
        { line: '"Then keep covering it. Please."', card: 'shieldsong',
          after: 'She does not argue. She never has. But she does notice the word.' },
        { line: '"Then let me stop needing it."', card: 'lastvigil',
          after: 'He shifts his guard half a step. It costs him more than the fight did.' },
      ] },
      { id: 'ae2', title: 'WHAT IT ENDED AS', beats: [
        { who: 'ash',  line: 'You have never once asked what I remember about the last time.' },
        { who: 'elin', line: 'No.' },
        { who: 'ash',  line: 'You ask everybody everything. Why not me.' },
        { who: 'elin', line: 'Because I was there. And because you would hand it to me with the sharp parts filed off.' },
      ], ask: 'What does he give her instead?', picks: [
        { line: 'The filed-down version anyway.', card: 'gravebloom',
          after: 'She lets him have it. Something in her shoulders comes down regardless.' },
        { line: 'All of it. Sharp parts included.', card: 'ashenoath',
          after: 'It takes most of the night. Neither sleeps. Both of them look lighter for it.' },
      ] },
    ],
    'ash|mira': [
      { id: 'am1', title: 'IN FRONT', beats: [
        { who: 'mira', line: 'Four times today you put your shoulder where my ribs were going to be. I counted.' },
        { who: 'ash',  line: 'That is the job.' },
        { who: 'mira', line: 'It is a job you handed yourself. You never asked me to sign anything.' },
      ], ask: 'What do they settle on?', picks: [
        { line: '"Cover me properly, then."', card: 'shieldblade',
          after: 'She stops working around him and starts working behind him. It is faster. She hates that.' },
        { line: '"Don\u2019t wait for me."', card: 'twinshadow',
          after: 'He stops turning to check. It is harder than standing in front of her ever was.' },
      ] },
      { id: 'am2', title: 'THE QUICK ONE', beats: [
        { who: null,   line: 'She has been bleeding since the second stop and has mentioned it to nobody.' },
        { who: 'ash',  line: 'You have been favouring that side since the choir. How long.' },
        { who: 'mira', line: 'Two stops. It is fine \u2014 I am always gone before it matters.' },
        { who: 'ash',  line: 'And the day you are not, I would like to already be standing there.' },
      ], ask: 'What does she change?', picks: [
        { line: 'She starts leaving earlier.', card: 'cutthecord',
          after: 'Out of reach before the answer arrives. She would not call it care. It is.' },
        { line: 'She starts hitting harder.', card: 'bothblades',
          after: 'Heavy first, then quick. Nothing left standing to argue with either of them.' },
      ] },
    ],
    'elin|mira': [
      { id: 'em1', title: 'THE SHAPE OF IT', beats: [
        { who: 'mira', line: 'You hear something down here the rest of us do not. What is it saying?' },
        { who: 'elin', line: 'It is not saying. It is asking.' },
        { who: 'mira', line: 'Asking for what.' },
        { who: 'elin', line: 'To be allowed to stop. Everything this far down is asking for that.' },
      ], ask: 'What does Mira do with that?', picks: [
        { line: 'She learns to slow a knife down.', card: 'coldmercy',
          after: 'A blade can be patient. Nobody had ever thought to tell her.' },
        { line: 'She learns to ask before she moves.', card: 'quietword',
          after: 'They start talking mid-fight. It is not tidy. It works.' },
      ] },
      { id: 'em2', title: 'NOT A KINDNESS', beats: [
        { who: 'elin', line: 'That one was mine, and you took it off me.' },
        { who: 'mira', line: 'You would not have got back up. I have watched you get up. It is slow.' },
        { who: 'elin', line: 'Slow is still mine to decide.' },
        { who: 'mira', line: '\u2026yes. All right. Yes.' },
      ], ask: 'How does it settle?', picks: [
        { line: 'They agree to share the weight.', card: 'thornandlamp',
          after: 'A little of everything, carried by everyone. Nobody gets to be the noble one.' },
        { line: 'Elin says the frightened part out loud.', card: 'namethefear',
          after: 'Named plainly, in company, it has much less room to move.' },
      ] },
    ],
  };
  const bondScene = (pair, lv) => (BONDS[pair] || [])[lv - 1] || null;

  // ═══════════════════════════════════════════════════════════════════════
  // THE MEMORIES — and the frame each one opens on
  // ═══════════════════════════════════════════════════════════════════════
  // `art` NAMES A RENDERED STILL OF THE MOMENT ITSELF, not a mood plate. A
  // memory stop used to open on `bg-descent` — the same crushed backdrop every
  // scene in the game uses — so three different memories arrived looking
  // identical, and the screen said "a cutscene is happening" rather than
  // "THIS is happening". The brief for each frame is in docs/SCENE-ART.md,
  // written as prompts so the set can be re-rendered without re-deciding what
  // is in the shot.
  //
  // A MISSING FILE IS NOT A BROKEN SCREEN. `sceneArt` falls back to the
  // region's own painting, so a memory in THE SILENCE opens on the drowned
  // garden rather than on nothing — which is worse than the old backdrop but
  // is still this run's own place, and it upgrades the moment a file lands.
  const SCENES = [
    { id: 'lullaby', title: 'WHAT THE SONG IS FOR', art: 'scene-lullaby', beats: [
      { who: null,   line: 'The road bends. The singing does not.' },
      { who: 'elin', line: 'Stop a moment. It isn’t a threat — listen to the shape of it.' },
      { who: 'mira', line: 'It’s a hymn. In my experience hymns are threats with better manners.' },
      { who: 'elin', line: 'It’s a lullaby. She’s still trying to put something to sleep, and it won’t go.' },
      { who: 'mira', line: '…for who?' },
      { who: 'elin', line: 'For whatever she couldn’t keep. She has been at it a very long time.' },
      { who: 'ash',  line: 'Then we aren’t going down there to kill her. We’re going down to finish it.' },
      { who: null,   line: 'Three people stop arguing about what they are walking toward, and start walking.' },
    ] },
    { id: 'careful', title: 'THE THING NOBODY SAYS', art: 'scene-careful', beats: [
      { who: null,   line: 'It has been sitting between them since the trailhead, unsaid, taking up room.' },
      { who: 'mira', line: 'You two move like one animal. You don’t even look. How long have you had that?' },
      { who: 'ash',  line: 'A long time. Practice, mostly. Some of it we’d rather not have had.' },
      { who: 'mira', line: 'And how did the practice end.' },
      { who: 'elin', line: 'It ended.' },
      { who: 'ash',  line: 'Which is the whole reason we keep being careful with you.' },
      { who: 'mira', line: 'Don’t be careful with me. Be fast.' },
      { who: null,   line: 'She steps up into the line before it is offered. Neither of them moves her back.' },
    ] },
    { id: 'floor', title: 'ONE MORE FLOOR', art: 'scene-floor', beats: [
      { who: null,   line: 'The stair keeps going down. It should have run out three turns ago.' },
      { who: 'ash',  line: 'How far down does a thing like her go?' },
      { who: 'elin', line: 'As far as she has to. That’s the trouble with grief — it hasn’t got a floor.' },
      { who: 'mira', line: 'Then we go one floor further than that. All three of us, or none.' },
      { who: null,   line: 'It is not a plan. It is a promise wearing a plan’s coat, and it is what they have.' },
    ] },
  ];

  // ═══════════════════════════════════════════════════════════════════════
  // THE CHART — where this descent is happening
  // ═══════════════════════════════════════════════════════════════════════
  // A road drawn on black is a flowchart. v2.2's map was a PAINTING with a road
  // across it, and that is most of what made it read as a place you were going
  // down into rather than a menu of six buttons. The six charts come back, one
  // per run, seeded — so a run has a face, and two runs are two descents rather
  // than the same descent twice.
  //
  // A region is a NAME and a PAINTING and nothing else. No bias, no modifier,
  // no extra rule to learn: the slice's job here is atmosphere and identity,
  // and a region that also changed the maths would be a second system smuggled
  // in behind a backdrop.
  const REGIONS = [
    { id: 'lament', name: 'THE LAMENT', art: 'map-lament',
      line: 'Islands of a city that stopped mid-sentence.' },
    { id: 'silence', name: 'THE SILENCE', art: 'map-silence',
      line: 'A drowned garden. The tree is still holding something up.' },
    { id: 'stillness', name: 'THE STILLNESS', art: 'map-stillness',
      line: 'Stairs going down into a light nobody lit.' },
    { id: 'rust', name: 'THE RUST', art: 'map-rust',
      line: 'Scaffolds the diggers left, still bolted to nothing.' },
    { id: 'cinders', name: 'THE CINDERS', art: 'map-cinders',
      line: 'Something under the rock is still burning.' },
    { id: 'deep', name: 'THE DEEP', art: 'map-deep',
      line: 'Cold light in the stone. It answers when you walk.' },
  ];
  // Hashed rather than `seed % 6`, so consecutive seeds (which is what a sweep
  // and a tester both use) do not walk the list in order.
  function regionFor(seed) {
    let h = ((seed >>> 0) ^ 0x9e3779b9) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
    return REGIONS[((h ^ (h >>> 16)) >>> 0) % REGIONS.length];
  }
  const regionOf = (id) => REGIONS.find(r => r.id === id) || REGIONS[0];

  // A STOP HAS A NAME. "BATTLE · BATTLE · BATTLE" down a chart is a difficulty
  // list; a road you are walking has places on it. The kind word stays as the
  // functional read under the mark — the name is what the stop calls itself
  // when you pick it up, which is the only place there is room to say it.
  const NAMES = {
    // A LONGER ROAD EMPTIES THE BAGS. Names are dealt without replacement and
    // fall back to the kind's own word when a bag runs dry — so on an
    // eleven-column chart the back half was turning into BATTLE, BATTLE,
    // BATTLE, which is exactly the tell the bags exist to avoid.
    fight: ['ASHFALL ROAD', 'THE HOLLOW CHOIR', 'MOURNING FIELD', 'COLD PROCESSION',
            'THE GREY MILE', 'THE BROKEN CHANCEL', 'THE WEEPING STAIR', 'SILENT MARCH',
            'THE LOW GALLERY', 'A STAIR WITHOUT A RAIL', 'THE SALT TERRACE',
            'WHAT THE FLOOD LEFT', 'THE UNLIT NAVE', 'A ROAD OF OWN MAKING',
            'THE THIN BRIDGE', 'BELOW THE BELL', 'THE CHALK CUTTING',
            'WHERE THE CARTS STOPPED', 'THE SUNKEN ORCHARD', 'A LONG SHALLOW STEP'],
    elite: ['THE WARDEN STIRS', 'WHERE THE STRONG FELL', 'THE GORGE OF NAMES',
            'THE KEEPER OF THE STAIR', 'WHAT GUARDS THE CROSSING'],
    camp:  ['A FIRE SOMEBODY LEFT', 'THE LEE OF THE WALL', 'THE LAST DRY STONE',
            'AN OVERHANG, JUST', 'THE HOLLOW UNDER THE ROOT'],
    story: ['THE QUIET STRETCH', 'A PLACE TO SIT DOWN', 'SOMEWHERE OUT OF THE WIND',
            'THE HOUR BEFORE', 'A GAP IN THE WEATHER', 'THE FLAT ROCK'],
    boss:  ['THE MOURNING REGENT'],
    event: ['A FORK IN THE BLACK', 'THE WATCHER\u2019S STONE', 'SOMETHING LEFT BEHIND',
            'WHERE THE ROAD FORGETS', 'AN OPEN HAND', 'A DOOR IN A WALL',
            'THE STONE THAT WAS MOVED'],
  };

  // ═══════════════════════════════════════════════════════════════════════
  // THE MYSTERIES — the stop that is a decision instead of a fight
  // ═══════════════════════════════════════════════════════════════════════
  // A road of nothing but battles, fires and memories has one shape of turn on
  // it: fight, recover, unlock. A mystery is the stop where the run's OTHER
  // currencies get to be spent — blood, embers, the warmth between them, and
  // one debt that comes due at the very bottom.
  //
  // NO COIN FLIPS. v2.2's events had real gambles in them, and on a road this
  // short a coin that eats six embers is not tension, it is a stop that
  // sometimes does nothing. Every mystery here is a TRADE with both sides
  // written on it — which is also the only version of this that a check can
  // hold to account. The one that FEELS like a gamble pays its cost at the
  // bottom of the road instead of hiding it behind a die.
  //
  // Effects are DATA, never functions, so a mystery cannot quietly reach into
  // the run and do something its own words did not say.
  //   embers  ± the purse            hurt    each hero bleeds (never below 1)
  //   heal    each hero mends        bond    the WEAKEST pair deepens
  //   kizuna  the carried %          regent  the Regent wakes with more HP
  const EVENTS = [
    { id: 'toll', title: 'THE TOLL', eyebrow: 'A CROSSROADS',
      lines: ['A gate of black iron, and a bowl worn smooth by ten thousand payments.',
              'Nothing guards it. Somehow that is worse.'],
      picks: [
        { icon: 'ember', label: 'PAY THE BOWL', say: 'Ash pays before anyone asks him to. The road beyond is kinder for it.',
          fx: { embers: -6, heal: 10 } },
        { icon: 'fight', label: 'FORCE THE GATE', say: 'Mira goes first. The iron does not give quietly, and neither does she.',
          fx: { hurt: 4, embers: 5 } },
      ] },
    { id: 'well', title: 'THE WHISPERING WELL', eyebrow: 'A CROSSROADS',
      lines: ['A well that repeats whatever is dropped into it — coins, names, promises.',
              'Something at the bottom has been collecting them.'],
      picks: [
        { icon: 'ember', label: 'DROP FOUR EMBERS', say: 'It gives back the things none of them would say out loud. Nobody meets anyone\u2019s eye.',
          fx: { embers: -4, bond: 4 } },
        { icon: 'story', label: 'COVER YOUR EARS', say: 'Two embers left on the lip, and not one name given away.',
          fx: { embers: 2 } },
      ] },
    { id: 'idol', title: 'THE THORNED IDOL', eyebrow: 'A BLOOD PRICE',
      lines: ['An idol of woven briars, palms open. Old blood blacks the thorns.',
              'It gives to those who bleed. It does not say how much.'],
      picks: [
        { icon: 'elite', label: 'GRASP THE THORNS', say: 'Three hands close on it at the same moment. Nobody had to count down.',
          fx: { hurt: 5, kizuna: 25 } },
        { icon: 'camp', label: 'LEAVE IT HUNGRY', say: 'It watches them go. They walk closer together than the path requires.',
          fx: { heal: 3 } },
      ] },
    { id: 'banner', title: 'THE OLD BANNER', eyebrow: 'A CROSSROADS',
      lines: ['A company banner, half-buried — an order nobody living can name.',
              'Whoever carried it planted it facing DOWN the road. They meant to hold.'],
      picks: [
        { icon: 'camp', label: 'BURN IT FOR HEAT', say: 'One night warm enough to matter. Elin apologises to it under her breath.',
          fx: { heal: 8 } },
        { icon: 'ember', label: 'STRIP THE GOLD THREAD', say: 'It deserved better. It gets this.',
          fx: { embers: 6 } },
        { icon: 'story', label: 'PLANT IT AGAIN', say: 'They set it facing down the road again. Nobody says why. Nobody has to.',
          fx: { bond: 3, kizuna: 10 } },
      ] },
    { id: 'dark', title: 'THE HUNGRY DARK', eyebrow: 'A BLOOD PRICE',
      lines: ['A patch of dark deeper than the dark around it. It does not move. It is patient.',
              'What is fed to it does not come back. What is TRADED to it does.'],
      picks: [
        { icon: 'ember', label: 'FEED IT EMBERS', say: 'It exhales, and the cold goes out of them.',
          fx: { embers: -7, heal: 12 } },
        { icon: 'elite', label: 'FEED IT BLOOD', say: 'It pays in kind, and in full.',
          fx: { hurt: 6, embers: 9 } },
      ] },
    { id: 'sleeper', title: 'A SLEEPING ECHO', eyebrow: 'A DEBT',
      lines: ['One of the hollow dead, sat against a stone. Ember-light banked in its chest.',
              'It is dreaming. What it dreams of is further down.'],
      picks: [
        { icon: 'ember', label: 'TAKE THE LIGHT', say: 'It does not wake. Something below it does.',
          fx: { embers: 10, regent: 16 } },
        { icon: 'story', label: 'STEP AROUND IT', say: 'They go the long way round, shoulder to shoulder, and let it keep dreaming.',
          fx: { embers: 2, bond: 2 } },
      ] },
    { id: 'mirror', title: 'THE MIRROR POOL', eyebrow: 'A CROSSROADS',
      lines: ['Still water showing the three of them a step out of true.',
              'The reflections move a heartbeat late. Or early. Better not to check twice.'],
      picks: [
        { icon: 'story', label: 'HOLD THE GAZE', say: 'Whatever it shows them, they agree to carry the same weight of it.',
          fx: { hurt: 2, bond: 4, kizuna: 10 } },
        { icon: 'camp', label: 'LOOK AWAY', say: 'Some things are not owed a second look.',
          fx: { heal: 5 } },
      ] },
  ];
  const eventDef = (id) => EVENTS.find(e => e.id === id) || EVENTS[0];

  // ═══════════════════════════════════════════════════════════════════════
  // THE RECKONING — the beat after a fight, and what it is FOR
  // ═══════════════════════════════════════════════════════════════════════
  // StS's loop is win a fight, pick one of three cards. It fires eight to ten
  // times a run and it is most of why a run feels like it is going somewhere.
  // This game had nothing there at all: the foe fell, a receipt appeared on the
  // road, and you walked on. `pace.sim` put a number on the hole — about three
  // things change about the party between the trailhead and the Regent.
  //
  // So the beat is here, and it is NOT a card draft. The foe is still on the
  // ground and the three of them are still standing in it, and they say
  // something about what just happened — to each other, out loud, while it is
  // fresh. Then you choose how that lands.
  //
  // WHAT MAKES IT NOT A LOADING SCREEN WITH DIALOGUE ON IT: every reckoning is
  // selected by a DEED the engine measured. Who landed the last blow. Who was
  // a quarter of the way from the floor when it did. Who stepped in front of
  // whom and had the blow actually arrive. Who moved straight off somebody
  // else's opening. Whether the three of them ever struck as one. A reckoning
  // that cannot point at something that happened does not get to speak — which
  // is why the fallback is the plainest one in the table.
  //
  // WHAT IT PAYS. Two answers, and they are not the same KIND of thing: one
  // deepens a pair — the long game, because bonds are what hand over cards —
  // and one carries momentum into the next fight. Build, or tempo. It is the
  // oldest good choice in the genre and it costs nothing to understand.
  const RECK_BOND = 6;       // half of what a first bond level asks
  const RECK_KIZ = 22;       // …or a fifth of an all-out, banked for the next fight

  const RECKONINGS = [
    // ── the sharpest ones first: two people, one specific thing ──────────
    { id: 'lastblow', weight: 5,
      // the one who nearly went down, watching the one who ended it
      cast: (d) => {
        const a = d.finisher, b = (d.brink || []).find(h => h !== d.finisher);
        return (a && b) ? [a, b] : null;
      },
      title: 'THE LAST BLOW',
      beats: (A, B) => [
        { who: null, line: 'It comes apart mid-note, and the noise it had been making stops.' },
        { who: B.id, line: 'I was about three seconds from the floor there.' },
        { who: A.id, line: 'I know. I was counting them too. That is why it is over.' },
      ],
      ask: 'What does that settle?',
      picks: (A, B) => [
        { label: '"THEN DO NOT CUT IT SO FINE."', say: 'Said to the floor rather than to ' + A.n + '. It still arrives.',
          bond: [A.id, B.id] },
        { label: 'NOTHING. KEEP MOVING.', say: 'The road does not wait to be thanked.',
          kizuna: RECK_KIZ },
      ] },

    { id: 'infront', weight: 5,
      cast: (d) => { const s2 = (d.shields || [])[0]; return s2 ? [s2.by, s2.for] : null; },
      title: 'IN FRONT OF YOU',
      beats: (A, B) => [
        { who: null, line: A.n + ' is still standing exactly where the blow was going to land.' },
        { who: B.id, line: 'That was meant for me.' },
        { who: A.id, line: 'Yes.' },
        { who: B.id, line: 'You do not get to keep doing that to me.' },
      ],
      // A LINE WHOSE SPEAKER IS CHOSEN AT RUNTIME CANNOT CARRY A PRONOUN. This
      // reckoning's cast is whoever stepped in front of whoever, so "she" was
      // wrong for two thirds of the pairs it can draw. That goes for the ANSWERS
      // as well as the question: the second fork used to narrate "she does not
      // answer" over a cast that is Ash two times in three.
      ask: 'And what comes back?',
      picks: (A, B) => [
        { label: '"THEN BE SOMEWHERE ELSE."', say: 'Neither of them means it. Both of them mean it.',
          bond: [A.id, B.id] },
        { label: 'NO ANSWER. NOT YET.', say: 'Some answers wait for a quieter stretch of road.',
          kizuna: RECK_KIZ },
      ] },

    { id: 'opening', weight: 4,
      cast: (d) => {
        const best = Object.keys(d.stitches || {}).sort((a, b) => d.stitches[b] - d.stitches[a])[0];
        if (!best || (d.stitches[best] || 0) < 2) return null;
        return best.split('|');
      },
      title: 'OFF YOUR OPENING',
      beats: (A, B) => [
        { who: null, line: 'Three times it happened, and neither of them called for it once.' },
        { who: A.id, line: 'You went exactly where I was going to go.' },
        { who: B.id, line: 'You left it open for me.' },
        { who: A.id, line: 'I left it open on purpose.' },
      ],
      ask: 'Does either of them admit that was a plan?',
      picks: (A, B) => [
        { label: '"THEN LEAVE IT OPEN AGAIN."', say: 'A thing they will not have to say twice.',
          bond: [A.id, B.id] },
        { label: 'LET IT STAND AS LUCK.', say: 'Easier. And they both know better.',
          kizuna: RECK_KIZ },
      ] },

    { id: 'fell', weight: 4,
      cast: (d) => {
        const b = (d.fell || [])[0]; if (!b) return null;
        const a = d.finisher && d.finisher !== b ? d.finisher : null;
        return a ? [a, b] : null;
      },
      title: 'YOU WENT DOWN',
      beats: (A, B) => [
        { who: null, line: B.n + ' is upright again. It took longer than either of them will say out loud.' },
        { who: A.id, line: 'You were gone.' },
        { who: B.id, line: 'For a moment.' },
        { who: A.id, line: 'It was not a moment. I was counting.' },
      ],
      ask: 'How does it get put down?',
      picks: (A, B) => [
        { label: '"I AM NOT DOING THAT AGAIN."', say: 'A promise nobody on this road can keep. It gets made anyway.',
          bond: [A.id, B.id] },
        { label: 'THEY DO NOT PUT IT DOWN.', say: 'It walks the rest of the way with them.',
          kizuna: RECK_KIZ },
      ] },

    // ── the whole party ──────────────────────────────────────────────────
    { id: 'asone', weight: 3,
      cast: (d, live) => (d.asOne > 0 && live.length >= 2) ? live.slice(0, 2) : null,
      title: 'AS ONE',
      beats: (A, B) => [
        { who: null, line: 'For about a second and a half, they were not three people.' },
        { who: A.id, line: 'That.' },
        { who: B.id, line: 'I know.' },
        { who: null, line: 'Neither of them can say what it was. Both of them would like it back.' },
      ],
      ask: 'What do they do with that?',
      picks: (A, B) => [
        { label: 'NAME IT, SO IT CAN BE ASKED FOR.', say: 'Naming a thing is how you get to use it twice.',
          bond: [A.id, B.id] },
        { label: 'DO NOT TOUCH IT. JUST GO.', say: 'Some things stop working when you look at them.',
          kizuna: RECK_KIZ },
      ] },

    { id: 'untouched', weight: 3,
      cast: (d, live) => (d.untouched && live.length >= 2) ? live.slice(0, 2) : null,
      title: 'NOT ONE MARK',
      beats: (A, B) => [
        { who: null, line: 'It never landed. Not once, on any of them.' },
        { who: B.id, line: 'That does not happen. That has never once happened.' },
        { who: A.id, line: 'It happened.' },
      ],
      ask: 'What do they take from it?',
      picks: (A, B) => [
        { label: '"SO IT CAN HAPPEN."', say: 'Said carefully, the way you hold a thing that might still be true tomorrow.',
          bond: [A.id, B.id] },
        { label: 'GET DOWN THE ROAD BEFORE IT STOPS.', say: 'Momentum is a thing you can spend.',
          kizuna: RECK_KIZ },
      ] },

    // ── and the one that can always speak ────────────────────────────────
    { id: 'down', weight: 1,
      cast: (d, live) => live.length >= 2 ? live.slice(0, 2) : null,
      title: 'IT IS DOWN',
      beats: (A, B) => [
        { who: null, line: 'Whatever it was singing, it has stopped.' },
        { who: A.id, line: 'Is that all of them?' },
        { who: B.id, line: 'It is never all of them. But it is fewer than there were.' },
      ],
      ask: 'How do they leave it?',
      picks: (A, B) => [
        { label: 'STAND A MOMENT LONGER.', say: 'Not for the thing on the ground. For each other.',
          bond: [A.id, B.id] },
        { label: 'GO NOW.', say: 'There is light further down and it is not waiting.',
          kizuna: RECK_KIZ },
      ] },
  ];

  // The most SPECIFIC reckoning that can point at something this fight did —
  // and, between equals, one the run has not already heard.
  function pickReckoning(deeds, live) {
    if (!deeds) return null;
    // The selector is a pure read of the ledger — it can be asked the question
    // outside a run (a check, a sim) and should answer, not throw.
    const seen = (RUN && RUN.reckSeen) || [];
    // A CAST HAS TO NAME TWO REAL PEOPLE. This filter checked the shape — two
    // entries, not the same one twice — and never that either entry was
    // somebody. A cast of ['ash', undefined] is length 2 with distinct members,
    // so it passed, and openReckoning then read `.n` off nothing and took the
    // whole hand-off down with it: the fight ended, the reckoning never opened,
    // and the road was handed a board it could not leave. Eight soak runs never
    // saw it; sixteen did, twice.
    const REAL = ['ash', 'elin', 'mira'];
    const shaped = RECKONINGS
      .map(r => ({ r, cast: r.cast(deeds, live) }))
      .filter(x => x.cast && x.cast.length === 2 && x.cast[0] !== x.cast[1]);
    const able = shaped.filter(x => x.cast.every(id => REAL.indexOf(id) >= 0));
    // …and it says which one it threw out. A guard that silently drops a
    // malformed cast fixes the crash and hides the thing that built it.
    for (const x of shaped) {
      if (able.indexOf(x) < 0) {
        try { console.warn('reckoning ' + x.r.id + ' cast names a stranger: ' + JSON.stringify(x.cast)); } catch (e) {}
      }
    }
    if (!able.length) return null;
    const top = Math.max(...able.map(x => x.r.weight));
    const best = able.filter(x => x.r.weight === top);
    const fresh = best.filter(x => seen.indexOf(x.r.id) < 0);
    return (fresh.length ? fresh : best)[0];
  }

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
    // A MYSTERY IS THE STOP WHERE THE OTHER CURRENCIES GET SPENT. It never
    // takes a turn off you and it never rolls a die: it asks one question with
    // both sides of the trade written on it.
    event: { id: 'event', word: 'MYSTERY', tone: 'mist',
             blurb: 'A crossroads. Whatever is here will want something — and it pays for what it takes.' },
    boss:  { id: 'boss', word: 'THE REGENT', tone: 'crown',
             blurb: 'The end of the descent. She has been singing the whole way down.' },
  };

  // The column plan. Authored, not procedural — a six-stop road is short enough
  // that authored pacing beats generated pacing every time, and it means the
  // shape of a run is a thing that can be reasoned about and tested.
  //   0  two easy fights: the opening is a choice, but not yet a gamble
  //   1  fight or memory: pay a fight's embers, or take the tier unlock
  //   2  campfire or fight: the first real fork
  //   3  elite or fight: the gamble, placed where a full purse can answer it
  //   4  campfire or memory: no fighting on the Regent's doorstep
  //   5  the Regent
  //
  // WHAT CHANGED AT BUILD 58. The plan used to name TWO kinds per column and
  // put them in the same lane every time, so every road in the game was the
  // same eleven coins in the same eleven places and the only thing a seed
  // moved was which diagonal joined them. A column now names the kinds it
  // MUST offer plus one it MAY, shuffles which lane each falls in, and jitters
  // where the coin actually sits. The pacing guarantees are untouched — the
  // `must` list is the old plan — so the elite is still at column 3, the
  // Regent's doorstep still has no fight on it, and a memory is still the only
  // thing that opens a tier.
  //
  // `may` is a POOL, not a single kind: the third lane is where the road gets
  // to be different, so what it offers varies too. A MYSTERY can only ever be
  // a third lane — it never displaces a `must`, so it cannot cost you the
  // elite, a fire, or a memory.
  // The shape of a road, column by column. Three fires instead of two, and they
  // sit at 3, 6 and 9 — a third of the way apart — so the run has a rhythm of
  // press-forward / sit-down rather than one long grind and a rest at the end.
  // Memories and crossroads are seeded between them so that the stop where the
  // party CHANGES is rarely the same stop where they REST.
  const PLAN = [
    { must: ['fight', 'fight'], may: null },                 //  0 the trailhead
    { must: ['fight', 'story'], may: ['event', 'fight'] },   //  1
    { must: ['fight', 'event'], may: ['story'] },            //  2
    { must: ['camp', 'fight'],  may: ['story'] },            //  3 the first fire
    { must: ['elite', 'fight'], may: ['event', 'fight'] },   //  4
    { must: ['story', 'fight'], may: ['event'] },            //  5
    { must: ['camp', 'event'],  may: ['fight'] },            //  6 the second
    { must: ['fight', 'elite'], may: ['story', 'fight'] },   //  7
    { must: ['fight', 'event'], may: ['story'] },            //  8
    // NOTHING BUT REST AND MEMORY ON HER DOORSTEP. You always arrive at the
    // Regent having chosen how to spend the last quiet stop, never having just
    // finished a fight — the encounter is tuned as a FIGHT, not as the last
    // instalment of an attrition sum.
    { must: ['camp', 'story'],  may: null },                 //  9 the last fire
    { must: ['boss'],           may: null },                 // 10
  ];
  // Which foe stands at a fight node, by depth. The ladder is legible: you
  // meet the Husk before you meet the Wraith, always.
  const FOE_BY_COL = [
    ['husk', 'cultist'], ['husk', 'cultist'], ['husk', 'cultist'],
    ['cultist', 'wraith'], ['cultist', 'wraith'], ['cultist', 'wraith'],
    ['wraith'], ['wraith'], ['wraith'], ['wraith'], ['mourner'],
  ];

  // ── geometry of the road ──────────────────────────────────────────────────
  // 932×430 with a header to clear: the road runs left to right across the
  // middle band, which is the same axis the fight is fought along, so "forward"
  // means the same thing on both screens.
  //
  // The band has to clear BOTH the header (74px) and the confirmation card. A
  // stop is a 52px disc plus a word beneath it, and the party stands above the
  // one you are on — so the highest lane can reach y-56 and the lowest y+42.
  // Three lanes at ±64 around 218 with ±8 of jitter lands inside exactly the
  // envelope the two-lane road already proved: 146 to 290.
  const MAP_X0 = 108, MAP_X1 = 836, MAP_Y = 218, MAP_SPREAD = 64;
  // THE WANDER SCALES WITH THE SPACING. Eleven columns across the same 728px
  // put the coins 73px apart instead of 146, so a ±14px drift that read as
  // character on a six-stop road would have neighbours trading places on an
  // eleven-stop one.
  const JIT_X = 7, JIT_Y = 8;
  function laneY(ix, n) {
    if (n === 1) return MAP_Y;
    if (n === 2) return MAP_Y + (ix === 0 ? -MAP_SPREAD : MAP_SPREAD);
    return MAP_Y + (ix - 1) * MAP_SPREAD;
  }

  // ── building a road ───────────────────────────────────────────────────────
  function buildMap(seed) {
    rseed(seed);
    const nodes = [];
    // names are dealt, not drawn with replacement — two ASHFALL ROADs on one
    // chart is the tell that the places are decoration rather than places
    const bag = {};
    Object.keys(NAMES).forEach(k => { bag[k] = shuffled(NAMES[k]); });
    // …and so are the mysteries themselves: two of the same crossroads on one
    // road would make the second one a menu you have already read.
    const mysteries = shuffled(EVENTS.map(e => e.id));
    const nameFor = (kind) => (bag[kind] && bag[kind].length ? bag[kind].pop() : KIND[kind].word);

    PLAN.forEach((col, c) => {
      // THE THIRD LANE IS THE VARIETY. A column that can widen does so about
      // half the time, which is what makes one road three coins across at the
      // fork and another two — and makes the mid-road worth looking at twice.
      const kinds = col.must.slice();
      if (col.may && rr() < 0.55) kinds.push(pick(col.may));
      shuffle(kinds);                       // …and which lane each falls in
      kinds.forEach((kind, ix) => {
        const x = MAP_X0 + (MAP_X1 - MAP_X0) * (c / (COLS - 1));
        const y = laneY(ix, kinds.length);
        // the wander. The Regent is the one fixed point on the chart — she is
        // the thing the whole road is pointing at, so she does not drift.
        const jx = kind === 'boss' ? 0 : Math.round((rr() - 0.5) * 2 * JIT_X);
        const jy = kind === 'boss' ? 0 : Math.round((rr() - 0.5) * 2 * JIT_Y);
        const n = { id: c + ':' + ix, col: c, ix, kind, name: nameFor(kind),
                    x: x + jx, y: y + jy, to: [] };
        if (kind === 'fight' || kind === 'elite' || kind === 'boss') {
          n.foe = kind === 'elite' ? 'revenant' : pick(FOE_BY_COL[c] || ['wraith']);
        }
        if (kind === 'event') n.event = mysteries.pop() || EVENTS[0].id;
        nodes.push(n);
      });
    });
    const at = (col) => nodes.filter(n => n.col === col);
    // EVERY NODE HAS A WAY IN AND A WAY OUT, and at least one crossing per
    // column. Without the forced crossing the road degenerates into parallel
    // corridors, where the only decision in the whole run is the first one —
    // which is exactly the failure StS's map generator guards against with the
    // same rule.
    for (let c = 0; c < COLS - 1; c++) {
      const a = at(c), b = at(c + 1);
      // the straight-ahead road: each lane meets the lane opposite it. With
      // uneven lane counts "opposite" is a ratio, not an index — three lanes
      // feeding two must not all pile into lane 1.
      const near = (i) => a.length < 2 ? 0
        : Math.round(i * (b.length - 1) / (a.length - 1));
      a.forEach((n, i) => n.to.push(b[near(i)].id));
      if (b.length > 1 && a.length > 1) {
        let crossed = false;
        a.forEach((n, i) => {
          const alt = b.filter((_, j) => j !== near(i));
          // two roads out of a stop is the most a glance can hold, so a node
          // that already forks does not fork again
          if (alt.length && n.to.length < 2 && rr() < 0.55) {
            n.to.push(pick(alt).id); crossed = true;
          }
        });
        // A SECOND ROAD OUT IS A FLOOR, NOT A DICE ROLL. The 0.55 above decided
        // whether a stop forks at all, and the fallback below it repairs the
        // COLUMN — it guarantees a crossing exists somewhere — never the NODE.
        // So a stop that lost its coin flip had exactly one exit, and arriving
        // there raised CHOOSE THE NEXT STOP over a board with one lit coin on
        // it. Measured across 400 roads: 43% of stops were single-exit and 31%
        // of arrivals offered no choice at all. Six stops hid it; eleven made
        // the road read as a corridor. The roll now decides WHICH second road,
        // never WHETHER there is one.
        a.forEach((n, i) => {
          if (n.to.length >= 2) return;
          const alt = b.filter((t, j) => j !== near(i) && n.to.indexOf(t.id) < 0);
          if (alt.length) { n.to.push(pick(alt).id); crossed = true; }
        });
        // THE FALLBACK HAS TO ACTUALLY CROSS. It used to pick a source and a
        // destination independently, so half its outcomes were the
        // straight-ahead edge the base connection had already added — silently
        // absorbed by the Set. The forced crossing therefore only crossed half
        // the time it fired, and 34% of seeds ended up with a column that was
        // two parallel corridors. Pick the source, then take a DIFFERENT lane.
        if (!crossed) {
          const i = Math.floor(rr() * a.length) % a.length;
          const alt = b.filter((_, j) => j !== near(i));
          if (alt.length) a[i].to.push(pick(alt).id);
        }
      } else if (b.length === 1) {
        a.forEach(n => { if (n.to.indexOf(b[0].id) < 0) n.to.push(b[0].id); });
      }
      // NO ORPHANS. A third lane nobody's `near` maps onto is a coin painted
      // on the chart with no road to it — the one failure a wider column can
      // introduce that a two-lane column never could.
      b.forEach((t, j) => {
        if (a.some(n => n.to.indexOf(t.id) >= 0)) return;
        let src = 0, best = Infinity;
        a.forEach((_, i) => { const d = Math.abs(near(i) - j); if (d < best) { best = d; src = i; } });
        a[src].to.push(t.id);
      });
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
      seed: s, region: regionFor(s).id, map: buildMap(s), at: null, path: [], stop: 0,
      embers: 0, nodes: [],                       // the tree nodes this run has kindled
      kizuna: 0,                                  // what the three of them carry
      bonds: { 'ash|elin': 0, 'ash|mira': 0, 'elin|mira': 0 },
      levels: { 'ash|elin': 0, 'ash|mira': 0, 'elin|mira': 0 },
      roster: null,                               // set on boot from the base 15
      // WHAT THEY OWN BUT ARE NOT CARRYING. A swapped-out card used to be
      // written over and gone — `list[ix] = newCard` and the old name never
      // appeared again — which made every trade permanent and made "the cards
      // they own" a set the player could not look at, because it did not
      // exist. It exists now: the deck screen is a door onto it, and the five
      // slots are still five, so the trade is still a trade.
      bench: { ash: [], elin: [], mira: [] },
      flash: null,                                // the receipt from the last stop
      pending: null,                              // a stop entered but not finished
      camped: 0, campDone: null,                  // the fire only mends once per visit
      // A CARD WON AND NOT YET PLACED. The mark has been re-asked on boot since
      // Build 28; the card it arrives with never was, because it lived in a
      // module variable instead of in the run. Closing the tab on the swap
      // screen therefore threw the card away — the whole payout of an
      // awakening or a bond arc — and dropped the player on the road with no
      // way to get it back. The soak found it on its third random run.
      pendingCard: null,                          // the card waiting for a slot
      pendingAfter: '',                           // the line it arrived with
      swapBack: null,                             // 'map' | null — where the swap returns to
      sigils: {},                                 // cardId → the mark it wears
      pendingSigil: null,                         // a mark earned, not yet placed
      markPair: null,                             // whose cards it may land on
      woke: null,                                 // the memory reached for on waking
      vigor: 0,                                   // max HP the party woke up with
      foeBonus: 0,                                // HP the Regent woke up with
      wakePair: null,                             // the pair STILL CLOSE names
      seen: [],                                   // the memories this run has heard
      // ── WHAT THE ROAD HAS ACTUALLY DONE ──────────────────────────────────
      // The only thing that could make one of them remember was bond points,
      // which come from fighting well — so a run that travelled widely and
      // fought plainly developed nothing, and the journey itself was scenery.
      // This is the ledger a memory can be triggered ON: a place reached, a
      // thing put down, a decision taken, somebody nearly lost.
      //
      // Every field is fed from something the game ALREADY emits — the fight
      // summary's deeds ledger and the crossroads' own answer — so this
      // invents no currency and nothing new has to be remembered to write.
      journey: { felled: [], chose: [], brink: [], told: [], deepest: 0, flawless: 0 },
      reckSeen: [],                               // the reckonings it has already spoken
      tier: 1,                                    // raised by MEMORY stops (Build 28)
      hp: null,                                   // null = everyone is whole
      over: null,                                 // 'win' | 'loss'
      last: null,                                 // the summary of the last fight
    };
  }
  function save() { try { localStorage.setItem(RUN_KEY, JSON.stringify(RUN)); } catch (_) {} }
  // A RUN SAVED BEFORE THE LEDGER EXISTED STILL LOADS. Anything reading
  // `RUN.journey.felled` on a Build-97 save would throw on the first stop, and
  // the reload path is the one every soak run walks.
  function withJourney(r) {
    if (r && !r.journey) r.journey = { felled: [], chose: [], brink: [], told: [], deepest: 0, flawless: 0 };
    if (r && r.journey) {
      for (const k of ['felled', 'chose', 'brink', 'told']) if (!Array.isArray(r.journey[k])) r.journey[k] = [];
      for (const k of ['deepest', 'flawless']) if (typeof r.journey[k] !== 'number') r.journey[k] = 0;
    }
    return r;
  }
  function load() {
    try {
      const raw = localStorage.getItem(RUN_KEY);
      if (!raw) return null;
      const r = JSON.parse(raw);
      // EVERY DOOR ONTO A STORED RUN IS THIS ONE, which is the only reason the
      // migration can live in one place. It was written and then never called
      // for a build, and the road suite caught it: a Build-97 save came back
      // with no `journey` at all, and the first fight it finished would have
      // thrown on `J.felled`.
      return (r && r.map && r.map.length) ? withJourney(r) : null;
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
  const SCREENS = { title: 'k-title', map: 'k-map', combat: 'k-stage', camp: 'k-camp', scene: 'k-scene', swap: 'k-swap', wake: 'k-wake', mark: 'k-mark', deck: 'k-deck' };
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
    // A FORK IN THE ROAD, not a question mark: the mark has to survive being
    // 4px tall and read as a DECISION rather than as "unknown", because what
    // is unknown here is which side of a trade you take, not what the stop is.
    event: '<path d="M12 22 V13 M12 13 L5 5 M12 13 L19 5" stroke="currentColor" stroke-width="2.3"'
         + ' fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
         + '<circle cx="5" cy="4" r="2.2" fill="currentColor"/><circle cx="19" cy="4" r="2.2" fill="currentColor"/>',
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
    paintChart();

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
        + ' aria-label="' + (n.name || k.word) + ' — ' + k.word + '">'
        + '<span class="k-n-disc">' + svgIcon(n.kind) + '</span>'
        // THE KIND, NOT THE NAME. Swapping in the place name put 'A STAIR
        // WITHOUT A RAIL' in a nowrap span on every one of eleven columns —
        // and an invisible span still takes its width, so far coins grew wide
        // enough to overprint each other and to reach under the legend. The
        // legend names the marks; the coin says which mark it is.
        + '<span class="k-n-word">' + k.word + '</span>'
        // THE PRICE MOVED ONTO THE STOP. It used to live on a confirmation card
        // at the foot of the screen, which meant the only way to learn what a
        // stop cost was to tap it — a chart that hides its numbers until you
        // commit is not a chart, it is a menu. One tap travels now, so the
        // numbers have to be readable BEFORE the tap, which means on the coin.
        + (isOpen || isHere ? '<span class="k-n-cost">' + costLine(n) + '</span>' : '')
        + '</button>';
    }).join('');

    wrap.querySelectorAll('.k-node').forEach(b => {
      b.addEventListener('click', (e) => { e.stopPropagation(); tapNode(b.dataset.node); });
    });

    // THE HEADER SAYS WHERE, THEN HOW FAR. A run that opens on "STOP 1 OF 6"
    // and nothing else is a progress bar; a run that opens on the name of the
    // place it is happening in is a descent into somewhere.
    const reg = regionOf(RUN.region);
    $('k-map-prog').innerHTML = '<b>' + reg.name + '</b>'
      + (RUN.over ? (RUN.over === 'win' ? 'THE DESCENT IS ENDED' : 'THE ROAD ENDS HERE')
                  : 'STOP ' + Math.min(RUN.stop + 1, STOPS) + ' OF ' + STOPS);
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
    renderKey();
    renderYou();
    renderRoster();
    renderCard();
  }

  // ── the chart the road is drawn on ───────────────────────────────────────
  // The painting is set from the run rather than baked into the markup, and
  // only when it actually changes: swapping the src every render would restart
  // the decode on a 1672px image every time a node was tapped.
  function paintChart() {
    const img = document.querySelector('#k-map-bg img');
    const reg = regionOf(RUN.region);
    const src = '../art/' + reg.art + '.webp';
    if (img && img.getAttribute('src') !== src) img.setAttribute('src', src);
    const say = $('k-map-say');
    if (say && say.textContent !== reg.line) say.textContent = reg.line;
  }

  // THE MARKS NAME THEMSELVES ONCE, off to the side, so the chart does not have
  // to. Eleven words competing with a painting is how the road ended up
  // reading as a spreadsheet of stops; the legend is what buys the right to
  // show a word only where there is a choice to make.
  function renderKey() {
    const key = $('k-map-key');
    if (!key || key.dataset.drawn) return;
    key.innerHTML = ['fight', 'elite', 'camp', 'story', 'event', 'boss'].map(id => {
      const k = KIND[id];
      return '<span class="k-key-row k-tone-' + k.tone + '">'
        + '<i>' + svgIcon(id) + '</i><b>' + k.word + '</b></span>';
    }).join('');
    key.dataset.drawn = '1';
  }

  // WHERE THE THREE OF THEM ARE STANDING. This was the words YOU ARE HERE on a
  // tag above the stop. The party is a party, so it is the party: three coins
  // standing on the coin, and they WALK to the next one — the token is a
  // persistent element rather than part of the nodes' innerHTML, which is the
  // whole reason its left/top can transition instead of snapping.
  function renderYou() {
    const you = $('k-map-you');
    if (!you) return;
    const n = RUN.at ? node(RUN.at) : null;
    if (!n) { you.classList.add('k-hidden'); you.dataset.on = ''; return; }
    if (!you.dataset.drawn) {
      const art = { ash: 'kai', elin: 'elin', mira: 'mira' };
      you.innerHTML = Object.keys(art).map(id =>
        '<img src="../art/' + art[id] + '.webp" alt="" data-hero="' + id + '">').join('');
      you.dataset.drawn = '1';
    }
    // arriving on the road for the first time is a placement, not a walk
    const warp = you.classList.contains('k-hidden') || !you.dataset.on;
    if (warp) { you.style.transition = 'none'; }
    you.classList.remove('k-hidden');
    you.style.left = n.x + 'px';
    you.style.top = (n.y - 46) + 'px';
    you.dataset.on = n.id;
    if (warp) { void you.offsetWidth; you.style.transition = ''; }
    Object.keys(MAXHP).forEach(id => {
      const img = you.querySelector('[data-hero="' + id + '"]');
      if (!img) return;
      const hp = RUN.hp && RUN.hp[id] != null ? RUN.hp[id] : MAXHP[id];
      img.classList.toggle('k-you-down', hp <= 0);
    });
  }

  function renderRoster() {
    const box = $('k-map-party'); if (!box) return;
    const H = { ash: { n: 'Ash', art: 'kai' }, elin: { n: 'Elin', art: 'elin' },
                mira: { n: 'Mira', art: 'mira' } };
    box.innerHTML = Object.keys(H).map(id => {
      const h = H[id], max = MAXHP[id];
      const hp = RUN.hp && RUN.hp[id] != null ? RUN.hp[id] : max;
      const pct = Math.max(0, Math.min(100, hp / max * 100));
      const low = pct <= 34 ? ' k-mp-low' : '';
      return '<div class="k-mp' + low + '" data-hero="' + id + '">'
        + '<img src="../art/' + h.art + '.webp" alt="">'
        + '<span class="k-mp-hp"><b>' + hp + '</b>/' + max + '</span>'
        + '<span class="k-mp-bar"><i style="width:' + pct + '%"></i></span></div>';
    }).join('');
  }

  // THREE PAIRS, THREE FILLS, AND THE NUMBER THAT MATTERS. A bond level is worth
  // a card AND a mark, and both thresholds are printed so the fill has a scale:
  // 7/12 says how far and how much further. Levelled pairs read as done rather
  // than as a bar stuck at the end.
  // …AND IT NO LONGER DRAWS ON THE MAP. Three chips of "0/12" across the top of
  // the chart was permanent furniture for a number that moves at a fight's end;
  // the reading lives beside the heroes it is between, on the deck screen. The
  // function stays because it still guards on its box and costs nothing, and
  // because the header may yet want a compact bond mark that is not three chips.
  function renderBonds() {
    const box = $('k-map-bonds'); if (!box || !RUN) return;
    const art = { ash: 'kai', elin: 'elin', mira: 'mira' };
    box.innerHTML = PAIRS.map(k => {
      const pts = RUN.bonds[k] || 0;
      const lv = bondLevel(pts);
      const done = lv >= BOND_STEPS.length;
      const need = done ? BOND_STEPS[BOND_STEPS.length - 1] : BOND_STEPS[lv];
      const from = lv === 0 ? 0 : BOND_STEPS[lv - 1];
      const pct = done ? 100 : Math.max(0, Math.min(100, (pts - from) / (need - from) * 100));
      const [a, b] = k.split('|');
      // NO SECOND SET OF FACES. Six more portraits beside the party's own three
      // made the header nine faces deep and none of them said which was which —
      // "several portraits with unclear information". The pair is named in
      // letters, which is unambiguous once you know three people, and the row
      // gets its width back.
      const ini = CAST[a].n[0] + CAST[b].n[0];
      return '<div class="k-mb' + (done ? ' k-mb-full' : '') + (pts ? '' : ' k-mb-cold')
        + '" data-pair="' + k + '" title="' + PAIR_NAME[k] + '">'
        + '<span class="k-mb-who">' + ini + '</span>'
        + '<span class="k-mb-bar"><i style="width:' + pct + '%"></i></span>'
        + '<span class="k-mb-n">' + (done ? '\u25c8' : pts + '/' + need) + '</span>'
        + '</div>';
    }).join('');
  }

  // THE CARD IS NOW ONLY THE RUN'S LAST WORD. It used to be the confirmation
  // step — tap to ask, tap again to commit — and the reason that was worth a
  // permanent band at the foot of the chart was that the band was the only
  // place the stop's price was written. Both halves are gone: the price is on
  // the coin, and the tap travels. What is left is the two things that are
  // genuinely a full-width statement — the run ending, and the run stranding.
  function renderCard() {
    const card = $('k-map-card'); if (!card) return;
    if (RUN.over) {
      const won = RUN.over === 'win';
      card.className = 'k-map-card k-mc-end' + (won ? ' k-mc-win' : ' k-mc-loss');
      card.innerHTML = '<div class="k-mc-body"><b>' + (won ? 'THE REGENT FALLS' : 'THE PARTY FALLS') + '</b>'
        + '<span>' + (won ? STOPS + ' stops, ' + RUN.embers + ' embers, and the singing has stopped.'
                          : 'The descent keeps what it takes. Begin again.') + '</span></div>'
        + '<button type="button" id="k-map-go" class="k-mc-go">NEW RUN</button>';
      $('k-map-go').addEventListener('click', (e) => { e.stopPropagation(); newRun(); });
      return;
    }
    // THE RECEIPT IS GONE. It announced what had just happened on the screen
    // the player was standing on one second earlier — "MIRA gives up Quick
    // Throw to carry it" the moment after they chose exactly that — and it took
    // the widest band at the foot of the chart to do it. What it reported is
    // already in the header (embers, bonds) and in the deck.
    if (false && !_pick && RUN.flash) {
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
      // NOTHING TO SAY, SO SAY NOTHING. This drew a 900px banner reading
      // CHOOSE THE NEXT STOP across the foot of a chart whose lit coins were
      // already the only bright things on it, and whose subtitle described a
      // confirmation step that no longer exists. The stops carry their own
      // prices now; the band under them was pure furniture.
      card.className = 'k-map-card k-hidden';
      card.innerHTML = '';
      return;
    }
    const n = node(_pick), k = KIND[n.kind];
    const foe = n.foe && window.K && window.K.FOES ? window.K.FOES[n.foe] : null;
    card.className = 'k-map-card k-tone-' + k.tone;
    // THE STOP NAMES ITSELF, AND THEN SAYS WHAT IT IS. The title used to be the
    // kind word or the foe's name, so three of the six stops on a road were all
    // called BATTLE and the chart had no places on it. The name is the title
    // now; the kind is a chip beside it, and the foe is named in the price line
    // where the thing you are being told is what it costs and pays.
    card.innerHTML = '<span class="k-mc-ico">' + svgIcon(n.kind) + '</span>'
      + '<div class="k-mc-body"><b>' + (n.name || k.word)
      + '<em class="k-mc-kind">' + (foe ? foe.name : k.word) + '</em></b>'
      + '<span>' + k.blurb + '</span></div>'
      + '<div class="k-mc-gain">' + gainText(n) + '</div>'
      + '<button type="button" id="k-map-go" class="k-mc-go">TRAVEL</button>';
    $('k-map-go').addEventListener('click', (e) => { e.stopPropagation(); travel(_pick); });
  }

  // The same reading as gainText, sized for a coin rather than a banner: two
  // facts at most, because a third one at 8px is a smudge.
  function costLine(n) {
    const foe = n.foe && window.K && window.K.FOES ? window.K.FOES[n.foe] : null;
    if (n.kind === 'camp') return 'MEND \u00b7 SPEND';
    if (n.kind === 'story') return '+1\u2726';
    if (n.kind === 'event') return 'A TRADE';
    if (foe) return '+' + foe.embers + '\u2726 \u00b7 ' + window.K.foeHp(foe) + 'hp';
    return '';
  }

  // WHAT IS THERE, in numbers. A choice between two stops is only a choice if
  // both prices are on screen at the same time as the decision.
  function gainText(n) {
    const foe = n.foe && window.K && window.K.FOES ? window.K.FOES[n.foe] : null;
    if (n.kind === 'camp') return '<b>REST</b><em>mend + spend</em>';
    if (n.kind === 'story') return '<b>+1</b><em>ember · opens deeper nodes</em>';
    // A mystery prices itself as WHAT IT ASKS, because that is the part that
    // varies — the payout is on the fork, and putting a number here that the
    // crossroads might not honour is exactly the lie the card must not tell.
    if (n.kind === 'event') return '<b>?</b><em>a trade · no fight</em>';
    if (foe) return '<b>+' + foe.embers + '</b><em>embers · ' + window.K.foeHp(foe) + ' hp</em>';
    return '';
  }

  // ONE TAP TRAVELS. The second tap was a confirmation step added when the
  // chart was six big coins and a misfire cost a whole run; at eleven smaller
  // ones it is a toll on every single move, eleven times a run, to prevent a
  // mistake the card underneath was already describing.
  function tapNode(id) {
    if (_busy || RUN.over) return;
    if (reachable().indexOf(id) < 0) return;      // a stop you cannot reach says nothing
    _pick = id; RUN.flash = null;
    renderMap();
    travel(id);
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

  // ONE CONVERSATION PER STOP. Bond scenes used to WAIT for a campfire, and
  // arrive all at once when they got there — so a fire was two or three
  // conversations, each of which asks you to give up a card and then place a
  // mark on another one, and only THEN the tree and the embers. Four systems on
  // one stop, three times a run, with nothing happening on the other eight.
  //
  // A bond fires where it is EARNED now: on arrival at the next stop, before
  // that stop's own business, at most one. Eleven stops carry the developing
  // half of the game between them instead of three.
  function enter(n) {
    // A BOND FIRST, THEN A RECALL. A bond is a threshold the player watched
    // fill and is waiting on; a recall is the road paying out on its own, and
    // the gaps between bonds are exactly where it belongs. At most one of
    // either per stop, so over a road they interleave rather than queue.
    if (n.kind !== 'boss' && (openBondScene(n.id) || openRecall(n.id))) return;
    enterStop(n);
  }
  function enterStop(n) {
    // HOW FAR INTO THIS PLACE THEY HAVE COME. A region is chosen at the top of
    // a run and never changes, so "you are in the Cinders" is true on stop one
    // and says nothing; how DEEP into it they have walked is the fact a memory
    // of a place can hang on.
    //
    // WRITTEN HERE, NOT IN travel(), and the difference is a whole beat. Set
    // on departure, arriving at the fourth column recorded the fourth column
    // and then immediately checked the ledger against it — so the memory of
    // how far in they had come opened INSTEAD of the stop that earned it, and
    // the fight the player had chosen never started. Every trigger now shares
    // one seam: a stop writes what it did as its business begins, and whatever
    // that unlocks arrives at the NEXT arrival, which is exactly where a bond
    // level already lands.
    if (RUN.journey) RUN.journey.deepest = Math.max(RUN.journey.deepest || 0, n.col || 0);
    if (n.kind === 'camp') return enterCamp(n);
    if (n.kind === 'story') return enterStory(n);
    if (n.kind === 'event') return enterEvent(n);
    return enterFight(n);
  }
  // Where a bond chain lets go. The stop it interrupted is remembered on RUN
  // rather than held in a closure, because the chain spans three screens and
  // the player can close the tab in the middle of it.
  function endBondChain() {
    const id = RUN && RUN.bondResume;
    if (RUN) { RUN.bondResume = null; save(); }
    const n = id && node(id);
    if (n) return enterStop(n);
    return toMap();
  }

  function enterFight(n) {
    const foe = window.K.FOES[n.foe] || window.K.FOES.wraith;
    screen('combat');
    window.K.startCombat({ foe, partyHp: RUN.hp, onEnd: onFightEnd, kizuna: RUN.kizuna || 0,
                           roster: RUN.roster, upgrades: cardUps(), allout: alloutOf(),
                           sigils: RUN.sigils || {},
                           vigor: RUN.vigor || 0, apBonus: apBonusOf(),
                           // A DEBT IS SETTLED WITH THE REGENT, not with every
                           // wraith on the way to her. Borrowing against the
                           // whole road would just be a difficulty setting.
                           foeBonus: foe.tier === 'boss' ? (RUN.foeBonus || 0) : 0 });
  }

  function onFightEnd(sum) {
    RUN.pending = null;
    RUN.last = sum;
    RUN.hp = sum.partyHp;
    // WHAT THIS FIGHT PUT IN THE LEDGER. Read off the summary the engine
    // already builds rather than counted again here: a second tally of the
    // same events is a second tally that can disagree with the first.
    const J = RUN.journey;
    if (sum.outcome === 'victory' && sum.foe && J.felled.indexOf(sum.foe) < 0) J.felled.push(sum.foe);
    const d = sum.deeds || {};
    (d.brink || []).forEach(h => { if (J.brink.indexOf(h) < 0) J.brink.push(h); });
    if (sum.outcome === 'victory' && d.untouched) J.flawless++;
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
    // THE FOE IS STILL ON THE GROUND. Before the road takes them back, the
    // three of them say something about what just happened — chosen by what
    // the fight actually did. The Regent is the exception: the descent ending
    // is its own beat and a conversation would step on it.
    if (openReckoning(sum)) return;
    toMap();
  }

  // ── the reckoning ────────────────────────────────────────────────────────
  // IT HAPPENS WHERE THE FIGHT HAPPENED.
  //
  // The first version of this cut to the memory screen — its own letterbox, its
  // own backdrop, the three of them re-staged as cut-outs. Which meant that the
  // instant you killed something you were somewhere else: the body, the room
  // and the people standing in it all replaced by a set dressed to look like
  // them. The board simply holds now. The foe is on the ground where it fell,
  // the party is in the lanes it fought from, the hand and the HUD stand down,
  // and the two who did something talk about it over the wreck.
  let _reck = null, _rbeat = 0;

  function openReckoning(sum) {
    // THE REGENT GETS NO RECKONING. The end of the descent is its own beat and
    // a conversation over her body would step on it. The rule lives HERE rather
    // than at the one call site, so a second caller cannot forget it.
    if (!RUN || RUN.over) return false;
    const deeds = sum && sum.deeds;
    const live = ['ash', 'elin', 'mira'].filter(id =>
      !(RUN.hp && RUN.hp[id] != null && RUN.hp[id] <= 0));
    const hit = pickReckoning(deeds, live);
    if (!hit) return false;
    const stage = $('k-stage');
    if (!stage || stage.classList.contains('k-hidden')) return false;   // no board to stand on
    const [aId, bId] = hit.cast;
    const A = { id: aId, n: CAST[aId].n }, B = { id: bId, n: CAST[bId].n };
    RUN.reckSeen = RUN.reckSeen || [];
    if (RUN.reckSeen.indexOf(hit.r.id) < 0) RUN.reckSeen.push(hit.r.id);
    _reck = { id: hit.r.id, title: hit.r.title, ask: hit.r.ask,
              beats: hit.r.beats(A, B), picks: hit.r.picks(A, B),
              foe: sum.foe, cast: [aId, bId] };
    _rbeat = 0;
    save();
    stage.classList.add('k-reckoning');
    renderReck();
    return true;
  }

  function renderReck() {
    const box = $('k-reck'); if (!box || !_reck) return;
    const done = _rbeat >= _reck.beats.length;
    box.classList.remove('k-hidden');
    box.classList.toggle('k-reck-asking', done);
    // THE TITLE NAMES THE FIGHT IT ENDS. It used to be four words in the top
    // corner with nothing to attach them to — a caption for a scene the player
    // has to reconstruct. Standing the foe's name over it says what this is a
    // reckoning OF, which is the whole reason the conversation is happening
    // here, over this body, rather than anywhere else.
    // `foe` is the id; the bestiary holds the name it is known by.
    const fell = _reck.foe && window.K.FOES[_reck.foe];
    $('k-reck-title').innerHTML =
      (fell ? '<i>' + fell.name.toUpperCase() + ' &middot; FALLEN</i>' : '')
      + '<b>' + _reck.title + '</b>';
    // ONLY THE TWO WHO ARE TALKING ARE LIT. The third is still standing there —
    // this is the same board — but the eye needs telling who this is between.
    ['ash', 'elin', 'mira'].forEach(id => {
      const fig = document.querySelector('.k-hero[data-hero="' + id + '"]');
      if (!fig) return;
      fig.classList.toggle('k-reck-in', _reck.cast.indexOf(id) >= 0);
      fig.classList.toggle('k-reck-out', _reck.cast.indexOf(id) < 0);
    });
    const plate = $('k-reck-plate'), fork = $('k-reck-fork');
    plate.classList.toggle('k-hidden', done);
    fork.classList.toggle('k-hidden', !done);
    if (!done) {
      const b = _reck.beats[_rbeat];
      $('k-reck-who').textContent = b.who ? CAST[b.who].n : '';
      $('k-reck-who').classList.toggle('k-hidden', !b.who);
      $('k-reck-line').className = b.who ? 'k-rk-line' : 'k-rk-line k-rk-narr';
      $('k-reck-line').textContent = b.line;
      $('k-reck-next').textContent = _rbeat === _reck.beats.length - 1 ? 'END' : 'NEXT';
      // the speaker leans in, the other holds
      ['ash', 'elin', 'mira'].forEach(id => {
        const fig = document.querySelector('.k-hero[data-hero="' + id + '"]');
        if (fig) fig.classList.toggle('k-reck-say', b.who === id);
      });
      $('k-reck-dots').innerHTML = _reck.beats
        .map((_, i) => '<i class="' + (i < _rbeat ? 'on' : i === _rbeat ? 'now' : '') + '"></i>').join('');
      fork.innerHTML = '';
      return;
    }
    ['ash', 'elin', 'mira'].forEach(id => {
      const fig = document.querySelector('.k-hero[data-hero="' + id + '"]');
      if (fig) fig.classList.remove('k-reck-say');
    });
    // WHAT YOU GET HAS TO READ BEFORE WHAT YOU SAY. The prize used to be a
    // hairline chip of 9.5px text under two lines of dialogue — so the loudest
    // thing on a REWARD screen was the wording of the answer, and the reward
    // itself was the quietest. It is a band now, with the faces of the pair a
    // bond deepens on it: whose bond, and by how much, without reading a word.
    fork.innerHTML = '<span class="k-rk-ask">' + (_reck.ask || '') + '</span>'
      + '<div class="k-rk-row">'
      + _reck.picks.map((p, i) => {
          const prize = p.bond
            ? '<span class="k-rk-faces">'
              + p.bond.map(id => '<img src="../art/' + CAST[id].art + '.webp" alt="">').join('')
              + '</span><span class="k-rk-amt">BOND +' + RECK_BOND + '</span>'
              + '<span class="k-rk-who2">' + CAST[p.bond[0]].n + ' &amp; ' + CAST[p.bond[1]].n + '</span>'
            : '<span class="k-rk-glyph">\u25c8</span>'
              + '<span class="k-rk-amt">KIZUNA +' + p.kizuna + '%</span>'
              + '<span class="k-rk-who2">carried into the next fight</span>';
          return '<button type="button" class="k-rk-opt' + (p.bond ? ' k-rk-bond' : ' k-rk-kz')
            + '" data-ix="' + i + '">'
            + '<b>' + p.label + '</b><span class="k-rk-say">' + p.say + '</span>'
            + '<span class="k-rk-fx">' + prize + '</span></button>';
        }).join('')
      + '</div>';
    fork.querySelectorAll('.k-rk-opt').forEach(b =>
      b.addEventListener('click', (e) => { e.stopPropagation(); takeReckoning(+b.dataset.ix); }));
  }

  function reckNext() {
    if (!_reck) return;
    if (_rbeat < _reck.beats.length) { _rbeat++; renderReck(); }
  }

  function closeReck() {
    _reck = null; _rbeat = 0;
    const box = $('k-reck');
    if (box) { box.classList.add('k-hidden'); const f = $('k-reck-fork'); if (f) f.innerHTML = ''; }
    const stage = $('k-stage');
    if (stage) stage.classList.remove('k-reckoning');
    ['ash', 'elin', 'mira'].forEach(id => {
      const fig = document.querySelector('.k-hero[data-hero="' + id + '"]');
      if (fig) fig.classList.remove('k-reck-in', 'k-reck-out', 'k-reck-say');
    });
    const boss = $('k-boss-art');
    if (boss) boss.classList.remove('k-foe-down');
  }

  function takeReckoning(ix) {
    if (!_reck || RUN.over) return;
    const p = _reck.picks[ix]; if (!p) return;
    let gain = '', gainSub = '';
    if (p.bond) {
      const k = PAIRS.find(x => x === [p.bond[0], p.bond[1]].sort().join('|'));
      if (k) {
        RUN.bonds[k] = (RUN.bonds[k] || 0) + RECK_BOND;
        gain = '+' + RECK_BOND; gainSub = PAIR_NAME[k] + ' \u00b7 closer';
      }
    }
    if (p.kizuna) {
      RUN.kizuna = Math.max(0, Math.min(100, (RUN.kizuna || 0) + p.kizuna));
      gain = '+' + p.kizuna + '%'; gainSub = 'kizuna carried on';
    }
    RUN.flash = { icon: 'story', tone: 'gold', title: _reck.title,
                  sub: p.say, gain, gainSub };
    closeReck();
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
  // ONE PLACE THAT KNOWS HOW BIG A HERO IS. `vigor` is max HP the party woke
  // up with, and the engine has always honoured it — but the road's roster and
  // the fire both carried their own hard-coded 42/36/34, so a party that woke
  // with +6 was shown the wrong denominator on every screen and, worse, was
  // MENDED to six below its real ceiling at every fire. The mystery stops trade
  // in health, so this had to stop being three copies of the same table.
  const BASE_HP = { ash: 42, elin: 36, mira: 34 };
  const MAXHP = new Proxy(BASE_HP, {
    get: (t, k) => (typeof k === 'string' && t[k] != null)
      ? t[k] + ((RUN && RUN.vigor) || 0) : t[k],
  });
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
    // THE FIRE IS THE FIRE. It used to hear the conversations first — every
    // pair that had crossed a level, one after another, before the tree was
    // even on screen. They happen on the road now (see enter), so a campfire is
    // one thing again: mend, and spend.
    sitDown();
  }

  // ── the bond scenes ──────────────────────────────────────────────────────
  function pendingBonds() {
    return PAIRS.filter(k => {
      const lv = bondLevel(RUN.bonds[k] || 0);
      return lv > (RUN.levels[k] || 0) && !!bondScene(k, (RUN.levels[k] || 0) + 1);
    });
  }
  // `resume` is the stop this conversation is interrupting — the one to enter
  // when the chain (scene → fork → swap → mark) finally lets go. Passing none
  // means the chain returns to the road, which is what the awakening's card and
  // the test hooks want.
  function openBondScene(resume) {
    const pair = pendingBonds()[0];
    if (!pair) return false;
    RUN.bondResume = resume || null;
    save();
    const lv = (RUN.levels[pair] || 0) + 1;
    _scene = { ...bondScene(pair, lv), kind: 'bond', pair, lv };
    // A CARD CANNOT BE WON TWICE. BORROWED HABIT starts a returning player
    // already holding a card they won on an earlier road — and every card in
    // the profile came out of one of THESE forks, so the fork could hand over
    // a second copy and the swap would duly put it in the deck. The soak found
    // it on run 7 of 12, three screens after the reload that made it look like
    // a persistence bug. It is not: it is a fork that does not check.
    const held = new Set(window.K.rosterIds(RUN.roster));
    _scene.picks = (_scene.picks || []).filter(p => !held.has(p.card));
    // …and if they already carry BOTH, the conversation still happens and the
    // level still pays its mark. A bond scene is the story beat first; the
    // card is what it hands over, not what it is for.
    if (!_scene.picks.length) {
      _scene.picks = [{ line: 'Nothing changes hands. It did not need to.',
                        card: null, after: '' }];
    }
    _beat = 0;
    screen('scene');
    renderScene();
    openSplash(_scene);
    return true;
  }
  // A fork taken: the card is won, and now it has to fit. Five slots a hero,
  // always — so one of the two must give something up, and which one is the
  // player's to decide.
  function takeBond(ix) {
    if (!_scene || _scene.kind !== 'bond') return;
    const pick = _scene.picks[ix]; if (!pick) return;
    const pair = _scene.pair;
    RUN.levels[pair] = _scene.lv;
    if (!heard(_scene.id)) { PROFILE.heard.push(_scene.id); }
    if (pick.card && !won(pick.card)) { PROFILE.won.push(pick.card); }
    saveProfile();
    // The level also teaches them something about what they already carry.
    RUN.pendingSigil = sigilFor(pair, _scene.lv);
    const card = pick.card, after = pick.after;
    closeScene();
    // Nothing to hand over — they already carry everything this scene could
    // give — so the level pays its other half and the road goes on.
    if (!card) { save(); if (!openMark(pair)) endBondChain(); return; }
    openSwap(card, after, null);
  }

  // ── the recalls ──────────────────────────────────────────────────────────
  // A recall is offered when the ledger says so AND there is still something
  // it could hand over. That second half matters: a bond scene pays a level
  // and a mark even when both its cards are already carried, so it is worth
  // playing empty — a recall pays ONE thing, and a memory that arrives with
  // nothing in its hands is a scene the player watched for no reason. It
  // simply does not fire, and stays available in case a later swap frees it.
  function pendingRecall() {
    if (!RUN || !RUN.journey) return null;
    const held = new Set(window.K.rosterIds(RUN.roster));
    const told = RUN.journey.told || [];
    for (const rc of RECALLS) {
      if (told.indexOf(rc.id) >= 0) continue;
      let fires = false;
      try { fires = !!rc.when(RUN); } catch (_) { fires = false; }
      if (!fires) continue;
      if (!rc.picks.some(p => !held.has(p.card))) continue;
      return rc;
    }
    return null;
  }
  // Same shape as openBondScene, and deliberately so — everything downstream
  // (the beats, the fork, the swap, the profile) is the machinery a bond scene
  // already built. The differences are the two this scene actually has: one
  // person is remembering rather than two talking, and the payout is the card
  // and nothing else.
  function openRecall(resume) {
    const rc = pendingRecall();
    if (!rc) return false;
    RUN.bondResume = resume || null;
    const held = new Set(window.K.rosterIds(RUN.roster));
    _scene = { ...rc, kind: 'recall' };
    _scene.picks = rc.picks.filter(p => !held.has(p.card));
    _beat = 0;
    save();
    screen('scene');
    renderScene();
    openSplash(_scene);
    return true;
  }
  function takeRecall(ix) {
    if (!_scene || _scene.kind !== 'recall') return;
    const pick = _scene.picks[ix]; if (!pick) return;
    const J = RUN.journey;
    if (J.told.indexOf(_scene.id) < 0) J.told.push(_scene.id);
    // The profile remembers a recall exactly the way it remembers a bond: the
    // scene was heard, the card was won. BORROWED HABIT reads one list.
    if (!heard(_scene.id)) PROFILE.heard.push(_scene.id);
    if (pick.card && !won(pick.card)) PROFILE.won.push(pick.card);
    saveProfile();
    const card = pick.card, after = pick.after;
    closeScene();
    save();
    if (!card) return endBondChain();
    openSwap(card, after, null);
  }

  // ── the fire ─────────────────────────────────────────────────────────────
  // THE FIRE IS A PLACE, NOT A TABLE. This screen was ten rectangles of the
  // same size in a 3x3-and-one grid, each carrying its own "7 damage. -> 10
  // damage." — which is a changelog, and it read as one. The rebuild keeps
  // every rule and moves three things:
  //
  //   1. THE PARTY IS PRESENT. The three of them stand at the fire above their
  //      own memories, at full figure, lit from below. The hero header was a
  //      22px avatar in a stat bar; now it is the person you are spending on.
  //   2. THE MEMORIES ARE OBJECTS. Each node is a card-shaped plate wearing the
  //      painting of the card it sharpens, with a single ember badge for its
  //      price. No node argues its case in prose any more.
  //   3. ONE PLACE TO READ. The before/after sentence belongs to whichever
  //      memory you have picked up, set once, at a size a phone can read —
  //      and picking one up is the first tap, kindling it the second. That is
  //      the road's own grammar (the first tap asks, the second commits) and
  //      it is what turns a purchase into a decision you watched yourself make.
  let _campPick = null;

  // SITTING DOWN IS THE ARRIVAL. Everything that should happen once per fire —
  // dealing the memories out of it, and starting with nothing picked up —
  // happens here rather than in renderCamp, which runs again on every purchase.
  function sitDown() {
    const wrap = document.getElementById('k-camp-tree');
    if (wrap) delete wrap.dataset.visit;
    _campPick = null;
    _campOpen = null;                 // every fire opens on the four doors
    screen('camp');
    renderCamp();
  }

  function renderCamp() {
    const wrap = document.getElementById('k-camp-tree');
    if (!wrap) return;
    document.getElementById('k-camp-embers').textContent = RUN.embers;
    const cspark = document.getElementById('k-camp-ember-ico');
    if (cspark && !cspark.dataset.drawn) { cspark.innerHTML = svgIcon('ember'); cspark.dataset.drawn = '1'; }
    document.getElementById('k-camp-mend').textContent = '+' + (RUN.mended || 0);
    const tierEl = document.getElementById('k-camp-tier');
    if (tierEl) tierEl.textContent = 'TIER ' + RUN.tier;

    // ARRIVING IS AN EVENT, BUYING IS NOT. The memories deal in off the fire the
    // first time you sit down at a given campfire, and never again for the rest
    // of that visit — a screen that re-deals its whole row every time you spend
    // three embers is a screen that flickers at you for using it.
    const fresh = !wrap.dataset.visit;
    wrap.dataset.visit = '1';
    wrap.classList.toggle('k-ct-deal', fresh);

    // ── FOUR DOORS, NOT ELEVEN CARDS ────────────────────────────────────────
    // Sitting down used to put every node in the tree on screen at once, and
    // the answer to "what did that do" was "it made the campfire overwhelming".
    // Slay the Spire's fire asks ONE question with two answers — rest, or
    // smith — and everything else is behind whichever you pick.
    //
    // The mend is not one of the answers here, because it cannot be: the road's
    // attrition is tuned on the assumption that a fire mends, so making it
    // optional would be a difficulty change wearing a UI change. What IS a
    // choice is whose memory to spend on, and that is what opens: four doors —
    // three people and the fire itself — and the nodes live inside them.
    //
    // A door says what is behind it BEFORE it is opened, so nobody spends a tap
    // to learn a branch is sealed or unaffordable.
    wrap.classList.toggle('k-ct-open', !!_campOpen);
    const leave = document.getElementById('k-camp-leave');
    if (leave) leave.textContent = _campOpen ? 'BACK' : 'BACK TO THE ROAD';
    const say = document.getElementById('k-camp-say');
    if (say) say.textContent = _campOpen
      ? 'What do they remember?'
      : 'Wounds close. Nobody says much. There is time to remember.';
    if (!_campOpen) { renderCampDoors(wrap); return; }
    renderCampBranch(wrap, _campOpen);
  }

  // WHAT IS BEHIND A DOOR, in one line, read off the same three states a node
  // wears: held, sealed by tier, or priced beyond the purse.
  function branchState(hero) {
    const ns = TREE.filter(n => n.hero === hero);
    const open = ns.filter(n => !held(n.id) && RUN.tier >= n.tier);
    const afford = open.filter(n => RUN.embers >= n.cost);
    const sealed = ns.filter(n => !held(n.id) && RUN.tier < n.tier);
    let say, cls = '';
    if (!ns.some(n => !held(n.id))) { say = 'nothing left to remember'; cls = 'k-ctd-done'; }
    else if (afford.length) say = afford.length + (afford.length === 1 ? ' within reach' : ' within reach');
    else if (open.length) { cls = 'k-ctd-poor';
      say = Math.min.apply(null, open.map(n => n.cost)) + ' embers for the cheapest'; }
    else { cls = 'k-ctd-sealed'; say = 'sealed \u2014 a memory opens these'; }
    return { say, cls, ns, afford: afford.length, sealed: sealed.length };
  }

  function renderCampDoors(wrap) {
    const ART = { ash: 'kai', elin: 'elin', mira: 'mira' };
    let seat = 0;                     // the doors deal in off the fire, in order
    const doors = ['ash', 'elin', 'mira'].map(hero => {
      const hp = RUN.hp && RUN.hp[hero] != null ? RUN.hp[hero] : MAXHP[hero];
      const pct = Math.max(0, Math.min(100, hp / MAXHP[hero] * 100));
      const st = branchState(hero);
      return '<button type="button" class="k-ctdoor ' + st.cls
        + (pct <= 34 ? ' k-ct-hurt' : '') + '" data-door="' + hero + '"'
        + ' style="--seat:' + seat++ + '">'
        + '<div class="k-ct-fig"><img src="../art/' + ART[hero] + '.webp" alt=""></div>'
        + '<b>' + HERO_NAME[hero] + '</b>'
        + '<span class="k-ct-hp"><i style="width:' + pct + '%"></i></span>'
        + '<em>' + hp + '<i>/' + MAXHP[hero] + '</i></em>'
        + '<span class="k-ctd-say">' + st.say + '</span></button>';
    });
    const all = branchState('all');
    doors.push('<button type="button" class="k-ctdoor k-ct-all ' + all.cls + '" data-door="all"'
      + ' style="--seat:' + seat++ + '">'
      + '<div class="k-ct-fig k-ct-brazier">' + svgIcon('ember') + '</div>'
      + '<b>' + HERO_NAME.all + '</b>'
      + '<span class="k-ctd-say">' + all.say + '</span></button>');
    wrap.innerHTML = doors.join('');
    wrap.querySelectorAll('.k-ctdoor').forEach(b =>
      b.addEventListener('click', (e) => { e.stopPropagation(); openBranch(b.dataset.door); }));
    focusMemory(null, true);      // the strip belongs to an opened door
  }

  function renderCampBranch(wrap, hero) {
    const ART = { ash: 'kai', elin: 'elin', mira: 'mira' };
    const ns = TREE.filter(n => n.hero === hero);
    let seat = 0;
    wrap.innerHTML = '<div class="k-ctb">'
      + '<div class="k-ctb-who">'
      + (hero === 'all'
          ? '<div class="k-ct-fig k-ct-brazier">' + svgIcon('ember') + '</div>'
          : '<div class="k-ct-fig"><img src="../art/' + ART[hero] + '.webp" alt=""></div>')
      + '<b>' + HERO_NAME[hero] + '</b></div>'
      + '<div class="k-ctb-fan">' + ns.map(n => nodeHTML(n, seat++)).join('') + '</div>'
      + '</div>';
    wrap.querySelectorAll('.k-tnode').forEach(b => {
      b.addEventListener('click', (e) => { e.stopPropagation(); tapMemory(b.dataset.node); });
      // A MOUSE READS BY POINTING, A THUMB READS BY TAPPING. Hover picks the
      // memory up so the strip follows the cursor and one click still buys;
      // on touch there is no hover, so the first tap does the picking up.
      b.addEventListener('pointerenter', (e) => {
        if (e.pointerType === 'mouse') focusMemory(b.dataset.node);
      });
    });
    // OPENING A DOOR PICKS UP THE FIRST THING BEHIND IT, so the strip has
    // something to say the moment the branch appears rather than after a hover
    // the player has no reason to perform.
    const first = ns.find(n => !held(n.id) && RUN.tier >= n.tier) || ns[0];
    focusMemory(_campPick && ns.some(n => n.id === _campPick) ? _campPick
                : (first && first.id), true);
  }

  // WHICH DOOR IS OPEN. null is the four of them; a hero id is that branch.
  let _campOpen = null;
  function openBranch(hero) {
    if (!TREE.some(n => n.hero === hero)) return false;
    _campOpen = hero;
    _campPick = null;
    renderCamp();
    return true;
  }
  function closeBranch() {
    if (!_campOpen) return false;
    _campOpen = null;
    _campPick = null;
    renderCamp();
    return true;
  }

  // A plate: the painting, the price, the name. Everything it DOES is said once,
  // in the strip, for the one you are holding.
  function nodeHTML(n, seat) {
    const f = nodeFace(n);
    const own = held(n.id);
    const sealed = RUN.tier < n.tier;
    const poor = !own && !sealed && RUN.embers < n.cost;
    const cls = ['k-tnode'];
    if (own) cls.push('k-tn-own');
    if (sealed) cls.push('k-tn-sealed');
    if (poor) cls.push('k-tn-poor');
    const art = n.card && window.K.cardArt ? window.K.cardArt(n.card) : null;
    cls.push(art ? 'k-tn-art' : 'k-tn-plain');
    return '<button type="button" class="' + cls.join(' ') + '" data-node="' + n.id + '"'
      + ' style="--seat:' + (seat || 0) + '">'
      + (art ? '<img class="k-tn-bg" src="' + art + '" alt="" aria-hidden="true">' : '')
      + '<span class="k-tn-lift" aria-hidden="true"></span>'
      + '<span class="k-tn-cost">' + (own ? '✓' : sealed ? 'T' + n.tier : n.cost) + '</span>'
      + '<span class="k-tn-top"><b>' + f.name + '</b></span>'
      + '<span class="k-tn-what">' + (f.to || f.from) + '</span>'
      + (sealed ? '<span class="k-tn-seal">A MEMORY OPENS THIS</span>' : '')
      + '</button>';
  }

  // WHAT THE STRIP IS READING. `keep` means "only re-pick if what you were
  // holding is gone" — the re-render after a purchase should hand you the next
  // thing you can take rather than throw the reading away.
  function focusMemory(id, keep) {
    // AT THE DOORS THERE IS NOTHING TO READ. The strip describes ONE memory,
    // and with no door open there is no memory on screen — a strip explaining a
    // node the player cannot see is worse than an empty one, because it looks
    // like it belongs to whatever they are looking at.
    if (!_campOpen) {
      _campPick = null;
      const strip = document.getElementById('k-camp-read');
      if (strip) { strip.innerHTML = ''; strip.classList.add('k-cr-idle'); }
      return;
    }
    const mine = (x) => x.hero === _campOpen;
    let n = treeNode(id);
    if (n && !mine(n)) n = null;              // never leave the open branch
    if (keep && n && held(n.id)) n = null;
    if (!n) {
      const open = (x) => mine(x) && !held(x.id) && RUN.tier >= x.tier;
      n = TREE.find(x => open(x) && RUN.embers >= x.cost)
       || TREE.find(open) || TREE.find(mine);
    }
    if (!n) return;
    const strip0 = document.getElementById('k-camp-read');
    if (strip0) strip0.classList.remove('k-cr-idle');
    _campPick = n.id;
    document.querySelectorAll('#k-camp .k-tnode').forEach(b =>
      b.classList.toggle('k-tn-focus', b.dataset.node === _campPick));
    campSay(n);
  }

  function campSay(n) {
    const strip = document.getElementById('k-camp-read');
    if (!strip || !n) return;
    const f = nodeFace(n);
    const own = held(n.id);
    const sealed = RUN.tier < n.tier;
    const poor = !own && !sealed && RUN.embers < n.cost;
    const call = own ? 'ALREADY KINDLED'
      : sealed ? 'SEALED — A MEMORY OPENS TIER ' + n.tier
      : poor ? 'NOT ENOUGH EMBERS — ' + n.cost + ' NEEDED'
      : 'TAP AGAIN TO KINDLE — ' + n.cost + ' EMBERS';
    strip.className = 'k-cr ' + (own ? 'k-cr-own' : sealed ? 'k-cr-sealed' : poor ? 'k-cr-poor' : 'k-cr-go');
    strip.innerHTML = '<b>' + f.name + '</b>'
      + (f.from ? '<span class="k-cr-was">' + f.from + '</span>'
                + '<span class="k-cr-arrow">→</span>' : '')
      + '<span class="k-cr-now">' + f.to + '</span>'
      + '<em>' + call + '</em>';
  }

  // The first tap picks a memory up, the second kindles it. Anything you cannot
  // buy still picks up — a sealed node has to be able to say what would open it.
  function tapMemory(id) {
    if (_campPick !== id) { focusMemory(id); return; }
    kindle(id);
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
    // …and it lands on the person. A purchase that only changes a number in a
    // purse is a transaction; a purchase that lights somebody up is a memory.
    const who = document.querySelector('#k-camp-tree .k-ct-col[data-hero="'
      + (n.hero === 'all' ? 'all' : n.hero) + '"] .k-ct-fig');
    if (who) { who.classList.remove('k-ct-flare'); void who.offsetWidth; who.classList.add('k-ct-flare'); }
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
  // ── the still a scene opens on, and the splash that presents it ──────────
  // ONE RULE FOR ALL THREE KINDS. A memory names its own frame; a bond scene
  // and a crossroads do not have one yet, so they take the run's region — the
  // place this is happening — rather than the one generic descent plate that
  // every screen in the game shared.
  // WHICH STILLS ACTUALLY EXIST. Naming a file that is not there is not a
  // harmless fallback — the browser fetches it, logs a 404, and every suite in
  // this project counts a console error as a failure. (It did: road went to
  // pageErrors: 1 the moment the art slots landed.) So the game asks for a
  // frame only when the frame is here. Add the id when the render lands in
  // ../art; docs/SCENE-ART.md holds the prompt each one is rendered from.
  const SCENE_ART = {
    lullaby: 1, careful: 1, floor: 1,
  };
  function sceneArt(sc) {
    if (sc && sc.art && SCENE_ART[sc.id]) return '../art/' + sc.art + '.webp';
    return '../art/' + regionOf(RUN.region).art + '.webp';
  }
  // A FRAME THAT ARRIVES MISSING MUST NOT LEAVE A HOLE. The still is the whole
  // subject of the splash, so a 404 is not a cosmetic problem — it is a black
  // rectangle with a title on it. onerror walks down to the region painting,
  // and then to the descent plate, and the splash is skipped entirely if even
  // that fails, because a splash with nothing in it is worse than no splash.
  function setSceneArt(img, sc) {
    if (!img) return;
    const want = sceneArt(sc);
    const region = '../art/' + regionOf(RUN.region).art + '.webp';
    img.onerror = function () {
      if (img.src.indexOf(region) < 0 && want !== region) { img.src = region; return; }
      img.onerror = null; img.src = '../art/bg-descent.webp';
      const sp = $('k-scene-splash'); if (sp) sp.classList.add('k-hidden');
    };
    img.src = want;
  }
  // THE SPLASH IS AN OVERLAY, NOT A PHASE. It could have been `_beat = -1` with
  // the scene held shut behind it, and that is the version that breaks things:
  // every check and the soak's random walk drive scenes by beat, and a stop
  // that opens on a beat no caller expects is a stop the walk can sit inside
  // forever. So the beat semantics are untouched — the scene is live and
  // advanceable from the first frame — and the splash simply plays over the
  // top and gets out of the way. A tap dismisses it AND advances, because a
  // player who taps wants the scene, not an argument about which layer they hit.
  const SPLASH_MS = 2200;
  let _splashT = null;
  function openSplash(sc) {
    const sp = $('k-scene-splash'); if (!sp) return;
    clearTimeout(_splashT);
    sp.classList.remove('k-hidden');
    sp.innerHTML = '<img alt="">'
      + '<div class="k-spl-veil"></div>'
      + '<div class="k-spl-t"><b>' + (sc.title || 'A MEMORY') + '</b>'
      + '<span>' + (sc.kind === 'event' ? 'A CROSSROADS'
                  : sc.kind === 'bond' ? 'WHAT THEY CARRY'
                  : sc.kind === 'recall' ? 'SOMETHING COMES BACK' : 'A MEMORY') + '</span></div>';
    setSceneArt(sp.querySelector('img'), sc);
    // re-trigger the entrance even when two scenes open back to back
    sp.classList.remove('k-spl-in'); void sp.offsetWidth; sp.classList.add('k-spl-in');
    const scr = $('k-scene');
    if (scr) { scr.classList.remove('k-sc-splashing'); void scr.offsetWidth;
               scr.classList.add('k-sc-splashing'); }
    _splashT = setTimeout(closeSplash, SPLASH_MS);
  }
  function closeSplash() {
    clearTimeout(_splashT);
    const sp = $('k-scene-splash'); if (!sp || sp.classList.contains('k-hidden')) return false;
    sp.classList.add('k-spl-out');
    setTimeout(() => {
      const el2 = $('k-scene-splash'); if (!el2) return;
      el2.classList.add('k-hidden'); el2.classList.remove('k-spl-out', 'k-spl-in');
      el2.innerHTML = '';
      const scr = $('k-scene'); if (scr) scr.classList.remove('k-sc-splashing');
    }, 320);
    return true;
  }
  function splashOpen() {
    const sp = $('k-scene-splash');
    return !!sp && !sp.classList.contains('k-hidden') && !sp.classList.contains('k-spl-out');
  }

  function enterStory(n) {
    // TAGGED, because three kinds of scene share this screen now and two of
    // them wait on a fork. A memory used to arrive with no `kind` at all, which
    // is a hole any "is this the forking sort?" test falls straight into.
    _scene = { ...SCENES[Math.min(RUN.seen ? RUN.seen.length : 0, SCENES.length - 1)],
               kind: 'story' };
    _beat = 0;
    save();
    screen('scene');
    renderScene();
    openSplash(_scene);
  }

  const CAST = { ash: { n: 'ASH', art: 'kai' }, elin: { n: 'ELIN', art: 'elin' },
                 mira: { n: 'MIRA', art: 'mira' } };

  function renderScene() {
    const box = $('k-scene-line'), who = $('k-scene-who'), cast = $('k-scene-cast');
    if (!box || !_scene) return;
    // THE BACKDROP IS THE SAME FRAME THE SPLASH SHOWED, crushed down to
    // atmosphere. Dissolving from a full-strength still into a DIFFERENT
    // picture is a cut, and it throws away the one thing the splash just
    // established — that this scene happens somewhere specific.
    const bgBox = $('k-scene-bg'), bg = bgBox && bgBox.querySelector('img');
    if (bg && bg.dataset.scene !== (_scene.id || _scene.kind)) {
      bg.dataset.scene = _scene.id || _scene.kind;
      setSceneArt(bg, _scene);
      // a frame rendered FOR this memory is crushed less than a region plate
      // standing in for one — see the note beside .k-sc-own
      bgBox.classList.toggle('k-sc-own', !!(_scene.art && SCENE_ART[_scene.id]));
    }
    $('k-scene-title').textContent = _scene.title;
    const beats = sceneBeats();
    const done = _beat >= beats.length;
    $('k-scene').classList.toggle('k-sc-done', done);
    $('k-scene').classList.toggle('k-sc-myst', _scene.kind === 'event');
    const forking = done && (_scene.kind === 'bond' || _scene.kind === 'event' || _scene.kind === 'recall');
    $('k-scene').classList.toggle('k-sc-fork', forking);
    const forkBox = $('k-scene-fork');
    if (forkBox) {
      forkBox.classList.toggle('k-hidden', !forking);
      // NO FORK SURVIVES INTO THE NEXT SCENE. Hiding the box left its buttons
      // in the DOM, so a crossroads opened at beat 0 with the previous
      // RECKONING's answers still sitting behind it — invisible, but present,
      // matching `.k-fork-opt`, and wired to a handler that would refuse them.
      // The soak walked straight into it: three of eight runs stalled on a
      // mystery that could not be answered because the thing answering it was
      // the ghost of the last fight. A player cannot click a hidden button, so
      // this was never going to be seen — which is exactly why it needed a
      // random walk to find it.
      if (!forking) forkBox.innerHTML = '';
      if (forking && _scene.kind === 'event') {
        // BOTH SIDES OF THE TRADE, ON THE BUTTON. A crossroads that says only
        // what it gives is a crossroads with one obvious answer; the cost is
        // the decision, so it is set in the same row as the gain and coloured
        // as what it is.
        forkBox.innerHTML = '<span class="k-fork-ask">' + (_scene.eyebrow || 'A CROSSROADS') + '</span>'
          + '<div class="k-fork-row k-fork-myst">'
          + _scene.picks.map((p, i) =>
              '<button type="button" class="k-fork k-fork-opt" data-ix="' + i + '">'
              + '<span class="k-fo-ico">' + svgIcon(p.icon) + '</span>'
              + '<b class="k-fo-lbl">' + p.label + '</b>'
              + '<span class="k-fo-say">' + p.say + '</span>'
              + '<span class="k-fo-fx">' + Object.keys(p.fx).map(k =>
                  '<em class="' + (fxGood(k) && !(k === 'embers' && p.fx[k] < 0)
                    ? 'k-fo-up' : 'k-fo-down') + '">'
                  + fxWords({ [k]: p.fx[k] })[0] + '</em>').join('')
              + '</span></button>').join('')
          + '</div>';
        forkBox.querySelectorAll('.k-fork').forEach(b =>
          b.addEventListener('click', (e) => { e.stopPropagation(); takeEvent(+b.dataset.ix); }));
      } else if (forking) {
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
              // a fork with nothing left to hand over shows no card face —
              // there is no card, and drawing an empty frame would say there
              // was one and it had been taken away
              + (p.card ? window.K.staticCardHTML(p.card, { cls: 'k-card-fork' }) : '')
              + '</button>').join('')
          + '</div>';
        const take = _scene.kind === 'recall' ? takeRecall : takeBond;
        forkBox.querySelectorAll('.k-fork').forEach(b =>
          b.addEventListener('click', (e) => { e.stopPropagation(); take(+b.dataset.ix); }));
      }
    }
    if (forking) {
      who.textContent = _scene.kind === 'event' ? ''
        : _scene.kind === 'recall' ? (CAST[_scene.who] ? CAST[_scene.who].n : '')
        : (PAIR_NAME[_scene.pair] || '');
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
      const b = beats[_beat];
      who.textContent = b.who ? CAST[b.who].n : '';
      who.classList.toggle('k-hidden', !b.who);
      box.className = 'k-sc-line' + (b.who ? '' : ' k-sc-narr');
      box.textContent = b.line;
      $('k-scene-next').textContent = _beat === beats.length - 1 ? 'END' : 'NEXT';
    }
    castRow();
    const dots = $('k-scene-dots');
    if (dots) dots.innerHTML = beats
      .map((_, i) => '<i class="' + (i < _beat ? 'on' : i === _beat ? 'now' : '') + '"></i>').join('');
  }

  // A BOND SCENE IS A TWO-HANDER. Only the pair is in the shot; the third is
  // somewhere else, which is the whole reason the conversation is happening.
  // ONE DOOR OUT. Four things end a scene and every one of them used to write
  // `_scene = null; _beat = 0;` by hand — which is three chances to forget the
  // third line. Clearing the fork here rather than on the NEXT scene's first
  // render means an answered question stops existing the moment it is
  // answered, instead of lingering invisibly until something else redraws.
  function closeScene() {
    closeSplash();
    _scene = null; _beat = 0;
    const fork = $('k-scene-fork');
    if (fork) { fork.innerHTML = ''; fork.classList.add('k-hidden'); }
  }

  // A memory is written as `beats`; a mystery is written as two `lines` the
  // road says. One accessor, so every part of this screen walks the same list.
  function sceneBeats() {
    if (!_scene) return [];
    return _scene.beats || (_scene.lines || []).map(line => ({ who: null, line }));
  }

  function castRow() {
    const cast = $('k-scene-cast'); if (!cast || !_scene) return;
    const beats = sceneBeats();
    const done = _beat >= beats.length;
    const speaker = done ? null : (beats[_beat].who || null);
    // WHO IS IN THE SHOT. A bond is a two-hander; a recall is one person
    // remembering with whoever happens to answer them, so the whole party
    // stands there and the speaker lights up out of it.
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
    closeSplash();          // the frame has been looked at; get out of the way

    const n = sceneBeats().length;
    // a bond scene and a mystery both END ON THEIR FORK and wait there — the
    // choice is the exit, and tapping past it would be a stop that resolved
    // itself. Named positively: an unrecognised kind must fall through to the
    // payout, never get stuck in front of a fork that is not there.
    if ((_scene.kind === 'bond' || _scene.kind === 'event' || _scene.kind === 'recall') && _beat >= n) return;
    if (_beat < n) { _beat++; renderScene(); return; }
    finishScene();
  }
  function sceneSkip() {
    if (!_scene || RUN.over) return;
    closeSplash();

    _beat = sceneBeats().length;      // straight to the payout, never past it:
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
    closeScene();
    save();
    toMap();
  }

  // ── a mystery ─────────────────────────────────────────────────────────────
  // The same letterboxed stage a memory uses. A mystery IS a small scene — two
  // lines and then a question — so it borrows the frame rather than inventing a
  // second one, and the only new part is the fork, which shows both sides of
  // every trade before you take one.
  function enterEvent(n) {
    const def = eventDef(n.event);
    _scene = { ...def, kind: 'event', node: n.id };
    _beat = 0;
    save();
    screen('scene');
    renderScene();
    openSplash(_scene);
  }

  // WHAT A TRADE SAYS ABOUT ITSELF, written from the same data that applies it,
  // so a pick can never advertise a price it does not charge.
  function fxWords(fx) {
    const out = [];
    if (fx.embers)  out.push((fx.embers > 0 ? '+' : '\u2212') + Math.abs(fx.embers) + ' embers');
    if (fx.heal)    out.push('heal ' + fx.heal + ' each');
    if (fx.hurt)    out.push('bleed ' + fx.hurt + ' each');
    // …AND IT NAMES THE PAIR IT ACTUALLY PAYS. This said "closest pair" while
    // takeEvent applies it through weakestPair() — the pair FURTHEST BEHIND.
    // The chip advertised the opposite pair from the one it charges, which is
    // the single failure this whole function exists to make impossible (see the
    // comment above it). It names them now, so there is nothing left to get
    // backwards.
    if (fx.bond) {
      const w = (RUN && RUN.bonds) ? weakestPair() : null;
      out.push(w ? CAST[w.split('|')[0]].n + ' & ' + CAST[w.split('|')[1]].n + ' +' + fx.bond
                 : 'the pair furthest behind +' + fx.bond);
    }
    if (fx.kizuna)  out.push('kizuna +' + fx.kizuna + '%');
    if (fx.regent)  out.push('the Regent wakes with +' + fx.regent + ' HP');
    return out;
  }
  const fxGood = (k) => k === 'embers' || k === 'heal' || k === 'bond' || k === 'kizuna';

  // THE WEAKEST PAIR, not a named one. A mystery does not know who the run has
  // been kind to; deepening whichever bond is furthest behind is the version
  // that is always worth something and never picks a favourite for you.
  function weakestPair() {
    return PAIRS.slice().sort((a, b) => (RUN.bonds[a] || 0) - (RUN.bonds[b] || 0))[0];
  }

  function takeEvent(ix) {
    if (!_scene || _scene.kind !== 'event' || RUN.over) return;
    const p = _scene.picks[ix]; if (!p) return;
    // A DECISION IS A THING THAT HAPPENED. Recorded as the crossroads and the
    // answer, so a memory can be triggered on having chosen at all, or on
    // having chosen a particular way.
    RUN.journey.chose.push(_scene.id + ':' + (p.label || ix));
    const fx = p.fx;
    if (fx.embers) RUN.embers = Math.max(0, RUN.embers + fx.embers);
    if (fx.heal || fx.hurt) {
      RUN.hp = RUN.hp || {};
      Object.keys(BASE_HP).forEach(id => {
        const cur = RUN.hp[id] != null ? RUN.hp[id] : MAXHP[id];
        // A MYSTERY NEVER KILLS ANYBODY. A stop with no fight in it that can
        // end the run is a stop that reads as a trap, and the road already has
        // an elite for that. It leaves 1.
        RUN.hp[id] = fx.heal ? Math.min(MAXHP[id], cur + fx.heal)
                             : Math.max(1, cur - fx.hurt);
      });
    }
    if (fx.bond) { const k = weakestPair(); RUN.bonds[k] = (RUN.bonds[k] || 0) + fx.bond; }
    if (fx.kizuna) RUN.kizuna = Math.max(0, Math.min(100, (RUN.kizuna || 0) + fx.kizuna));
    if (fx.regent) RUN.foeBonus = (RUN.foeBonus || 0) + fx.regent;
    // THE RECEIPT LEADS WITH WHAT YOU GOT, and carries the whole trade under
    // it. Leading with the price read as though the stop had only cost you
    // something, which is the one thing a crossroads never does.
    const words = fxWords(fx);
    const won = Object.keys(fx).find(k => fxGood(k) && !(k === 'embers' && fx[k] < 0));
    const head = won ? fxWords({ [won]: fx[won] })[0] : words[0] || '';
    RUN.pending = null;
    RUN.flash = { icon: 'event', tone: 'mist', title: _scene.title,
      sub: p.label.charAt(0) + p.label.slice(1).toLowerCase() + ' \u2014 ' + p.say,
      gain: head.split(' ')[0], gainSub: words.join(' \u00b7 ') };
    closeScene();
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
      openSwap(won[0], 'The hands remember it. Something has to make room.', 'map');
      return;
    }
    w.apply(RUN);
    save();
    toMap();
  }

  // ── the swap ─────────────────────────────────────────────────────────────
  // ONE DOOR IN, and it writes the run before it shows the screen. Every path
  // that hands the party a card goes through here, so there is exactly one
  // place that has to remember what is owed.
  function openSwap(card, after, back) {
    RUN.pendingCard = card;
    RUN.pendingAfter = after || '';
    RUN.swapBack = back || null;
    _pendingCard = card; _pendingAfter = after || ''; _swapPick = null; _swapBack = back || null;
    save();
    screen('swap');
    renderSwap();
  }

  function renderSwap() {
    const K = window.K;
    const card = K.CARD_DEFS[_pendingCard]; if (!card) return toMap();
    const pair = K.pairOf(_pendingCard) || ['ash'];
    $('k-swap-line').textContent = _pendingAfter || '';
    // WRAPPED. swapCardHTML returns three sibling spans, and dropping them
    // straight into a flex container made `#k-swap-new > span` match all three
    // — so the cost, the body and the owners each got the card's own styling
    // and the whole thing spilled off the right edge of the screen.
    // THE CHIP IS GONE, and the header with it. A card arriving into the deck
    // was described by a one-line chip in the top corner while the thing it
    // would replace was a text row in a list of ten — so the decision was made
    // without seeing either card. The trade panel below shows both, full size.
    // …AND IT IS NO LONGER FOREVER. This note used to call the choice "which of
    // these fifteen leaves forever?", which was true when a displaced card was
    // written over and gone. It goes to the bench now and the deck screen can
    // bring it back, so the weight here is which five are being CARRIED into
    // the next fight — still the road's sharpest question, and an honest one.
    $('k-swap-new').innerHTML = '';
    // NOT "WHAT LEAVES" ANY MORE. A displaced card goes to the bench now — the
    // deck screen is a door onto it and the trade can be undone there — so the
    // question this screen asks is which of the five stops being CARRIED, not
    // which one is destroyed. Copy that describes a cost the game no longer
    // charges is worse than no copy: a player who believes it plays around a
    // rule that is not there.
    $('k-swap-ask').textContent = 'FIVE SLOTS EACH — WHO STEPS OUT?';
    // TWO LISTS AND THE TRADE. The lists stay compact rows, because ten cards
    // have to be SCANNABLE and ten faces would be a wall; the panel is where
    // the two cards that actually matter are looked at.
    $('k-swap-cols').innerHTML = pair.map(h => {
      const art = ({ ash: 'kai', elin: 'elin', mira: 'mira' })[h];
      const rows = (RUN.roster[h] || []).map(id =>
        '<button type="button" class="k-swapcard' + (_swapPick && _swapPick.id === id && _swapPick.hero === h ? ' k-sw-on' : '')
        + '" data-hero="' + h + '" data-id="' + id + '">' + swapCardHTML(id, false) + '</button>').join('');
      return '<div class="k-sw-col"><header><img src="../art/' + art + '.webp" alt="">'
        + '<b>' + h.toUpperCase() + '</b><em>' + (RUN.roster[h] || []).length + '/5</em></header>' + rows + '</div>';
    }).join('') + tradePanelHTML(card);
    $('k-swap-cols').querySelectorAll('.k-swapcard').forEach(b =>
      b.addEventListener('click', (e) => { e.stopPropagation();
        _swapPick = { hero: b.dataset.hero, id: b.dataset.id }; renderSwap(); }));
    const go = $('k-swap-go');
    go.disabled = !_swapPick;
    go.textContent = _swapPick
      ? 'TRADE ' + K.CARD_DEFS[_swapPick.id].name.toUpperCase() + ' FOR ' + card.name.toUpperCase()
      : 'CHOOSE A CARD TO GIVE UP';
  }
  // THIS, FOR THAT. The card leaving on the left, the card arriving on the
  // right, both as the faces they will be in the hand — same painting, same
  // rules, same size. Until a card is chosen the left slot is an empty frame
  // that says what goes in it, so the panel reads as a question rather than as
  // a picture of the prize.
  function tradePanelHTML(incoming) {
    const K = window.K;
    const out = _swapPick
      ? '<div class="k-swt-face">' + K.staticCardHTML(_swapPick.id, { cls: 'k-card-swt' }) + '</div>'
      : '<div class="k-swt-empty"><span>CHOOSE<br>A CARD</span></div>';
    return '<div class="k-sw-trade">'
      + '<div class="k-swt-pair">'
      +   '<div class="k-swt-slot"><em>LEAVES</em>' + out + '</div>'
      +   '<span class="k-swt-arrow" aria-hidden="true">'
      +     '<svg viewBox="0 0 24 24"><path d="M3 12 H19 M15 7 L20 12 L15 17"'
      +     ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"'
      +     ' stroke-linejoin="round"/></svg></span>'
      +   '<div class="k-swt-slot"><em>JOINS</em><div class="k-swt-face">'
      +     K.staticCardHTML(_pendingCard, { cls: 'k-card-swt' }) + '</div></div>'
      + '</div></div>';
  }
  function swapCardHTML(id, big) {
    const K = window.K, c = K.CARD_DEFS[id];
    const who = (K.ownerHeroes(c) || []).map(h => h.toUpperCase()).join(' + ');
    return '<span class="k-sw-cost">' + c.cost + '</span>'
      + '<span class="k-sw-body"><b>' + c.name + '</b>'
      + '<em>' + K.effectText(c.base) + '</em></span>'
      + '<span class="k-sw-who">' + who + '</span>';
  }
  // ── THE BENCH ────────────────────────────────────────────────────────────
  // Five slots per hero, always — that rule is the deck's whole shape and does
  // not move. What changes is where a card goes when it steps out of one.
  function bench() {
    if (!RUN) return { ash: [], elin: [], mira: [] };
    if (!RUN.bench) RUN.bench = { ash: [], elin: [], mira: [] };
    ['ash', 'elin', 'mira'].forEach(h => { if (!Array.isArray(RUN.bench[h])) RUN.bench[h] = []; });
    return RUN.bench;
  }
  function benchPut(hero, id) {
    if (!id) return;
    const b = bench();
    if (b[hero].indexOf(id) < 0) b[hero].push(id);
  }
  function benchTake(id) {
    const b = bench();
    ['ash', 'elin', 'mira'].forEach(h => {
      const i = b[h].indexOf(id); if (i >= 0) b[h].splice(i, 1);
    });
  }
  // What this hero could put in a slot instead of what is in it: whatever they
  // have set down, minus anything already being carried by anyone.
  function benchFor(hero) {
    const carried = window.K.rosterIds(RUN.roster);
    return bench()[hero].filter(id => carried.indexOf(id) < 0);
  }

  // ── THE DECK SCREEN ──────────────────────────────────────────────────────
  // The run's actual shape, top down: three heroes down the left and the five
  // cards each of them carries to the right. Fifteen slots, and until now there
  // was nowhere in the game to look at them — the only view of a card outside a
  // fight was whichever one a scene happened to be offering.
  // A FAN OF CARDS and three bars. The deck's door has to look like a deck —
  // Spire taught every player of this genre what that icon means — and the
  // settings' door has to look like the one thing everybody already knows.
  const FAN_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true">'
    + '<rect x="8.6" y="4.2" width="11" height="15.4" rx="2" transform="rotate(14 14 12)"'
    + ' fill="none" stroke="currentColor" stroke-width="1.6"/>'
    + '<rect x="6.5" y="4.2" width="11" height="15.4" rx="2"'
    + ' fill="#17141b" stroke="currentColor" stroke-width="1.6"/>'
    + '<rect x="4.4" y="4.2" width="11" height="15.4" rx="2" transform="rotate(-14 10 12)"'
    + ' fill="#17141b" stroke="currentColor" stroke-width="1.6"/></svg>';
  const BARS_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true">'
    + '<path d="M4 7 H20 M4 12 H20 M4 17 H20" fill="none" stroke="currentColor"'
    + ' stroke-width="1.9" stroke-linecap="round"/></svg>';
  function toggleMenu() {
    const m = $('k-menu'); if (!m) return;
    m.classList.toggle('k-hidden');
  }
  function closeMenu() { const m = $('k-menu'); if (m) m.classList.add('k-hidden'); }

  let _deckPick = null;             // { hero, id } — the card the panel is reading
  // THE PANEL IS NEVER EMPTY. It used to open with nothing selected, which left
  // 42% of the board — 395 x 374px, measured — holding nothing at all, and then
  // a tap opened a drawer that was 8% full. Both halves of that are the same
  // mistake: treating "no selection" as a state worth drawing. There is no such
  // state now. Opening the screen reads Ash's first card, and every tap moves
  // the reading. The gold bar down a card's left edge means "this is the one
  // the panel is describing" — not "this is armed for something".
  function openDeck() {
    if (!RUN) return false;
    closeMenu();          // it does not belong to this screen
    _deckPick = firstPick();
    screen('deck'); renderDeck();
    return true;
  }
  function firstPick() {
    for (const h of ['ash', 'elin', 'mira']) {
      const id = (RUN.roster[h] || [])[0];
      if (id) return { hero: h, id };
    }
    return null;
  }
  function closeDeck() { _deckPick = null; deckBlur(); toMap(); }
  function renderDeck() {
    const K = window.K, box = $('k-deck-rows'); if (!box || !RUN) return;
    const bs = bench();
    const owned = ['ash', 'elin', 'mira'].reduce((n, h) => n + bs[h].length, 0);
    $('k-deck-sub').textContent = 'FIVE EACH' + (owned ? ' \u00b7 ' + owned + ' SET DOWN' : '');
    box.innerHTML = ['ash', 'elin', 'mira'].map(h => {
      const c = CAST[h];
      // the bond a hero is in, beside the hero — the readout the header used to
      // carry, now next to the two people it is actually between
      // RUN.bonds, not pairBond — the second is the CURRENT FIGHT's tally and
      // the first is what the road carries. renderBonds always read the road's;
      // reaching for the fight's here would have shown zeros on every map.
      const bonds = PAIRS.filter(p => p.split('|').indexOf(h) >= 0).map(p => {
        const pts = (RUN.bonds && RUN.bonds[p]) || 0;
        const lv = bondLevel(pts);
        const done = lv >= BOND_STEPS.length;
        const need = done ? BOND_STEPS[BOND_STEPS.length - 1] : BOND_STEPS[lv];
        const other = p.split('|').filter(x => x !== h)[0];
        return '<span class="k-dk-bond' + (done ? ' k-dk-bond-full' : '') + '">'
          + CAST[other].n[0] + '<i>' + (done ? '\u25c8' : Math.min(pts, need) + '/' + need) + '</i></span>';
      }).join('');
      return '<div class="k-dk-row" data-hero="' + h + '">'
        + '<div class="k-dk-who"><img src="../art/' + c.art + '.webp" alt="">'
        + '<b>' + c.n + '</b><span class="k-dk-bonds">' + bonds + '</span></div>'
        + '<div class="k-dk-cards">'
        + (RUN.roster[h] || []).map(id =>
            '<button type="button" class="k-dk-slot'
            + (_deckPick && _deckPick.hero === h && _deckPick.id === id ? ' k-dk-on' : '')
            + '" data-hero="' + h + '" data-id="' + id + '">'
            + K.staticCardHTML(id, { sigil: (RUN.sigils || {})[id] || null, cls: 'k-card-dk' })
            + '</button>').join('')
        + '</div></div>';
    }).join('');
    box.querySelectorAll('.k-dk-slot').forEach(b => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        if (_held) return;                    // that was a hold, not a tap
        tapSlot(b.dataset.hero, b.dataset.id);
      });
      bindHold(b, b.dataset.id);
    });
    renderDeckPanel();
  }
  // ── the right-hand panel ────────────────────────────────────────────────
  // WHAT THIS CARD IS, AND WHAT COULD TAKE ITS PLACE. Two jobs, one panel,
  // because they are the same question asked twice: a player looking at a slot
  // wants to know what is in it and what else could be. It used to answer only
  // the second, and only after a tap, which is why the screen was mostly empty.
  //
  // The reading is `staticInspectHTML` — the SAME panel combat's press-and-hold
  // draws, built from the card alone. Two rules panels would drift; one cannot.
  function renderDeckPanel() {
    const K = window.K, box = $('k-deck-bench'); if (!box) return;
    if (!_deckPick) { box.classList.add('k-hidden'); box.innerHTML = ''; return; }
    box.classList.remove('k-hidden');
    const alts = benchFor(_deckPick.hero);
    const name = K.CARD_DEFS[_deckPick.id].name.toUpperCase();
    box.innerHTML = '<div class="k-dk-read">'
      + K.staticInspectHTML(_deckPick.id, { sigil: (RUN.sigils || {})[_deckPick.id] || null })
      + '</div>'
      + '<div class="k-dk-swap">'
      + '<p class="k-dk-ask">SWAP <b>' + name + '</b> FOR</p>'
      + (alts.length
          ? '<div class="k-dk-alts">'
            + alts.map(id => '<button type="button" class="k-dk-alt" data-id="' + id + '">'
                + K.staticCardHTML(id, { sigil: (RUN.sigils || {})[id] || null, cls: 'k-card-dk' })
                + '</button>').join('') + '</div>'
          // AN HONEST DEAD END. "Nothing else set down" told the player the
          // shelf was empty but not why, which on a screen whose whole subject
          // is a bench reads like a fault. It is not one: the party owns
          // fifteen cards and is carrying fifteen cards.
          : '<p class="k-dk-none">Nothing is set down. All fifteen are being carried \u2014 '
            + 'a card reaches the bench when a scene or a fire hands ' + CAST[_deckPick.hero].n
            + ' one to carry instead.</p>')
      + '</div>';
    box.querySelectorAll('.k-dk-alt').forEach(b => {
      b.addEventListener('click', (e) => { e.stopPropagation(); if (!_held) deckSwap(b.dataset.id); });
      bindHold(b, b.dataset.id);
    });
    // A CUT SENTENCE THAT DOES NOT LOOK SCROLLABLE READS AS A FAULT. Guard's
    // rule is four lines and the column holds three, so the panel ends mid-word
    // — fine if the player can see there is more, indefensible if they cannot.
    // The cue is set from the measurement rather than guessed from the card,
    // because whether it overflows depends on the mark and the keywords too.
    const read = box.querySelector('.k-dk-read');
    if (read) read.classList.toggle('k-dk-scrolls', read.scrollHeight > read.clientHeight + 1);
  }

  // ── press and hold: the card, at the size a card should be read at ────────
  // THE SAME GESTURE COMBAT USES, to the millisecond. A player learns "hold to
  // read it properly" once, in a fight, and it has to still be true here — a
  // gesture that works on one screen and does nothing on the next is worse
  // than no gesture, because the player stops trusting the first one.
  let _held = false, _holdT = null;
  const DECK_HOLD = 420;                       // combat's figure, not a new one
  function bindHold(btn, id) {
    const go = (e) => {
      _held = false;
      clearTimeout(_holdT);
      _holdT = setTimeout(() => { _held = true; deckFocus(id); }, DECK_HOLD);
      try { btn.setPointerCapture(e.pointerId); } catch (_) {}
    };
    const stop = () => { clearTimeout(_holdT); if (_held) deckBlur(); };
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
    btn.addEventListener('pointerdown', go);
    btn.addEventListener('pointerup', stop);
    btn.addEventListener('pointercancel', stop);
    // A FINGER THAT WANDERS IS STILL HOLDING. Combat cancels a hold at 14px
    // because the same gesture also drags a card onto a foe; nothing here is
    // draggable, so wandering off the card should not snatch the reading away.
    btn.addEventListener('pointerleave', () => { if (!_held) clearTimeout(_holdT); });
  }
  function deckFocus(id) {
    const K = window.K, f = $('k-deck-focus'); if (!f) return;
    f.innerHTML = K.staticInspectHTML(id, { sigil: (RUN.sigils || {})[id] || null,
                                            hint: 'release to close' });
    f.classList.remove('k-hidden');
    $('k-deck').classList.add('k-inspecting');
  }
  function deckBlur() {
    const f = $('k-deck-focus'); if (!f) return;
    f.classList.add('k-hidden'); f.innerHTML = '';
    $('k-deck').classList.remove('k-inspecting');
    // cleared on the NEXT frame: the click that follows a release fires first,
    // and a tap that was really a hold must not also change the selection
    setTimeout(() => { _held = false; }, 0);
  }

  // A TAP MOVES THE READING. It used to toggle — tapping the selected card
  // again cleared it — which was the only way a player could reach the empty
  // state this screen no longer has. There is always exactly one card being
  // read, so a tap on the one already being read is a no-op.
  function tapSlot(hero, id) {
    if (_deckPick && _deckPick.hero === hero && _deckPick.id === id) return;
    _deckPick = { hero, id };
    // A TAP DOES NOT REBUILD THE ROWS. It used to call renderDeck(), which
    // re-wrote all fifteen cards — and a CSS transition needs the SAME NODE to
    // still be there when the class changes, so every transition on the
    // selection was dead on arrival. No easing curve could have fixed that;
    // none of them ever ran. The rows only change when the ROSTER changes.
    markPick();
    renderDeckPanel();
  }
  function markPick() {
    document.querySelectorAll('.k-dk-slot').forEach(b => b.classList.toggle('k-dk-on',
      !!_deckPick && b.dataset.hero === _deckPick.hero && b.dataset.id === _deckPick.id));
  }
  function deckSwap(newId) {
    if (!_deckPick) return;
    const list = RUN.roster[_deckPick.hero];
    const ix = list.indexOf(_deckPick.id);
    if (ix < 0) return;
    if (benchFor(_deckPick.hero).indexOf(newId) < 0) return;   // not theirs to take
    benchPut(_deckPick.hero, list[ix]);
    list[ix] = newId;
    benchTake(newId);
    _deckPick = null;
    save(); renderDeck();
  }

  function confirmSwap() {
    if (!_swapPick || !_pendingCard) return;
    const list = RUN.roster[_swapPick.hero];
    const ix = list.indexOf(_swapPick.id);
    if (ix < 0) return;
    // THE ONE PLACE A DUPLICATE CAN ENTER THE DECK, so the rule is enforced
    // here as well as at every door that leads here. Fifteen cards, fifteen
    // names: a second copy of one silently costs the party a card they had.
    if (window.K.rosterIds(RUN.roster).indexOf(_pendingCard) >= 0) {
      _pendingCard = null; _swapPick = null; _pendingAfter = '';
      RUN.pendingCard = null; RUN.pendingAfter = ''; _swapBack = null;
      const b = RUN.swapBack; RUN.swapBack = null;
      save();
      if (b === 'map') return toMap();
      return endBondChain();
    }
    // the card that steps out is put down, not destroyed
    benchPut(_swapPick.hero, list[ix]);
    list[ix] = _pendingCard;
    benchTake(_pendingCard);
    RUN.flash = { icon: 'camp', tone: 'gold', title: window.K.CARD_DEFS[_pendingCard].name.toUpperCase() + ' — LEARNED',
      sub: _swapPick.hero.toUpperCase() + ' sets down ' + window.K.CARD_DEFS[_swapPick.id].name + ' to carry it.',
      gain: '5/5/5', gainSub: 'five slots, and a bench' };
    const _wasCard = _pendingCard;
    _pendingCard = null; _swapPick = null; _pendingAfter = '';
    // Read the destination from the RUN, not from a module variable: a stale
    // `_swapBack` left over from the awakening's card was what sent a bond
    // swap at a campfire back to the road instead of to the fire.
    const back = RUN.swapBack; _swapBack = null;
    RUN.pendingCard = null; RUN.pendingAfter = ''; RUN.swapBack = null;
    const pair = window.K.pairOf(_wasCard) || (_wasCard ? null : null);
    save();
    // A BOND LEVEL PAYS TWICE: a card, and a mark on one they already carry.
    if (back !== 'map' && RUN.pendingSigil && pair) return openMark(pair.join('|'));
    // A SWAP KNOWS WHERE IT CAME FROM. The awakening's card arrives before
    // there is a campfire to go back to; returning to one would have shown the
    // fire's screen with no fire behind it.
    if (back === 'map') return toMap();
    return endBondChain();
  }

  // ── the mark ─────────────────────────────────────────────────────────────
  // One screen, one decision: the bond decided WHAT was learned, the player
  // decides which card it lands on. Every card is drawn as a card — the whole
  // point is that the player is looking at the thing they are changing.
  // WHAT PASSED BETWEEN THEM. One line per mark rather than fifteen, with the
  // two names substituted, because the thing that varies is WHICH TRICK was
  // taught — the pair is already standing there saying who taught it. Written
  // so either half of a pair can be A: nobody is described in a way that only
  // fits one of them, and no line carries a gendered pronoun.
  // KEYED BY THE MARK'S ID, so a rename that misses one shows up as a scene
  // with no line rather than a wrong one.
  const MARK_SAY = {
    retain: '{A} stops handing {B} everything at once. Some of it keeps.',
    chain:  'They find the trick of it: {B} learns to move in the space {A} has just left.',
    lead:   '{B} learns to go first. {A} has been waiting a long time for that.',
    rally:  'Neither of them can say what changed. They will both feel it, every time.',
    surge:  '{A} shows {B} how to spend everything in one breath. It only works once.',
  };
  function renderMark() {
    const K = window.K, sig = RUN.pendingSigil, def = K.SIGILS[sig];
    if (!def) return leaveMark();
    const pair = _markPair || PAIRS[0];
    const heroes = pair.split('|');
    const A = CAST[heroes[0]], B = CAST[heroes[1]];
    $('k-mark').className = 'k-mk-sig-' + sig;
    $('k-mark-title').textContent = def.name.toUpperCase();
    $('k-mark-line').textContent = def.line;
    // THE SCENE. The two of them, the mark burning between them, and the road
    // they are standing on — the same painting the map is drawn over, so the
    // moment happens somewhere rather than in a void.
    const bg = $('k-mark-bg-img');
    if (bg) bg.src = '../art/' + regionOf(RUN.region).art + '.webp';
    const figs = $('k-mark-cast').querySelectorAll('.k-mkc-fig');
    if (figs[0]) { figs[0].src = '../art/' + A.art + '.webp'; figs[0].alt = A.n; }
    if (figs[1]) { figs[1].src = '../art/' + B.art + '.webp'; figs[1].alt = B.n; }
    const gl = $('k-mark-glyph');
    if (gl) gl.innerHTML = K.icon(def.glyph || 'finale');
    $('k-mark-say').textContent = (MARK_SAY[sig] || '')
      .replace('{A}', A.n).replace('{B}', B.n);
    $('k-mark-ask').textContent = 'WHICH CARD LEARNS IT?';
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
    endBondChain();
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
    // ONE CONTROL, AND IT BACKS OUT OF WHATEVER YOU ARE IN. With a door open it
    // closes the door; at the doors it leaves the fire. Two buttons competing
    // for the same corner of a 932x430 screen is how a back button gets pressed
    // by mistake, and "the thing I am looking at closes" is the one behaviour
    // nobody has to learn.
    const go = $('k-camp-leave');
    if (go) go.addEventListener('click', (e) => {
      e.stopPropagation();
      if (_campOpen) { closeBranch(); return; }
      leaveCamp();
    });
    // TAP ANYWHERE ADVANCES. A scene that can only be advanced from one 60px
    // button is a scene read with the thumb hunting instead of with the eyes.
    const sc = $('k-scene');
    if (sc) sc.addEventListener('click', (e) => {
      if (e.target.closest('#k-scene-skip')) return;
      e.stopPropagation(); sceneNext();
    });
    // THE RECKONING TAKES A TAP ANYWHERE, like every other beat in this game —
    // but never on the fork, which is the one thing on it that is a choice.
    const rk = $('k-reck');
    if (rk) rk.addEventListener('click', (e) => {
      if (e.target.closest('#k-reck-fork')) return;
      e.stopPropagation(); reckNext();
    });
    const skip = $('k-scene-skip');
    if (skip) skip.addEventListener('click', (e) => { e.stopPropagation(); sceneSkip(); });
    const sw = $('k-swap-go');
    if (sw) sw.addEventListener('click', (e) => { e.stopPropagation(); confirmSwap(); });
    // THE TWO DOORS THE HEADER NOW HAS
    const dk = $('k-deck-btn-map');
    if (dk) {
      dk.innerHTML = FAN_SVG;
      dk.addEventListener('click', (e) => { e.stopPropagation(); closeMenu(); openDeck(); });
    }
    const dkx = $('k-deck-close');
    if (dkx) dkx.addEventListener('click', (e) => { e.stopPropagation(); closeDeck(); });
    const mb = $('k-menu-btn');
    if (mb) {
      mb.innerHTML = BARS_SVG;
      mb.addEventListener('click', (e) => { e.stopPropagation(); toggleMenu(); });
    }
    // a menu that will not close is a menu that is in the way
    document.addEventListener('click', (e) => {
      const m = $('k-menu');
      if (!m || m.classList.contains('k-hidden')) return;
      if (m.contains(e.target) || (mb && mb.contains(e.target))) return;
      closeMenu();
    });
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

  // THE TITLE IS THE FIRST SCREEN, and the only one that is a decision about
  // the GAME rather than inside it. The run behind it is not built until the
  // player asks for it — BEGIN throws away whatever was stored, CONTINUE picks
  // it up — so the title is also the one place a stored run can be abandoned
  // without finishing or dying in it.
  let _bootOpts = null;
  function boot(opts) {
    _bootOpts = opts = opts || {};
    PROFILE = opts.freshProfile ? { heard: [], won: [] } : loadProfile();
    bindCamp();
    if (opts.title !== false) return toTitle();
    return begin(opts);
  }
  function toTitle() {
    const saved = load();
    // ANY UNFINISHED RUN IS WORTH OFFERING BACK, including one still sitting on
    // the awakening. Requiring a travelled stop meant closing the tab on the
    // opening choice threw it away silently, which is the one moment a player
    // is most likely to walk off and come back to.
    const going = !!(saved && !saved.over);
    const go = $('k-title-go');
    if (go) {
      go.innerHTML =
        (going ? '<button type="button" class="k-tt-go k-tt-on" data-go="on">CONTINUE THE DESCENT</button>' : '')
        + '<button type="button" class="k-tt-go' + (going ? ' k-tt-alt' : '') + '" data-go="new">'
        + (going ? 'BEGIN AGAIN' : 'BEGIN THE DESCENT') + '</button>';
      go.querySelectorAll('.k-tt-go').forEach(b => b.addEventListener('click', (e) => {
        e.stopPropagation();
        beginFromTitle(b.dataset.go === 'new');
      }));
    }
    screen('title');
  }
  // BEGIN AGAIN THROWS THE OLD ROAD AWAY. Leaving it stored and starting a
  // second run beside it is how a player ends up with two runs and no way to
  // tell which one they are in.
  function beginFromTitle(fresh) {
    const o = Object.assign({}, _bootOpts || {}, { title: false });
    if (fresh) { o.fresh = true; try { localStorage.removeItem(RUN_KEY); } catch (e) {} }
    begin(o);
  }
  function begin(opts) {
    opts = opts || {};
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
    // A CARD WON AND NOT PLACED IS RE-ASKED FIRST, because the mark that comes
    // with a bond level is the SECOND half of that payout and asking for it
    // before the card would place a mark on a deck the card has not joined yet.
    if (!RUN.over && RUN.pendingCard && window.K.CARD_DEFS[RUN.pendingCard]) {
      openSwap(RUN.pendingCard, RUN.pendingAfter, RUN.swapBack);
      return;
    }
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
    boot, toTitle, beginFromTitle, renderBonds,
    openDeck, closeDeck, renderDeck, renderDeckPanel, markPick, deckSwap, tapSlot, bench, benchFor,
    sceneArt, openSplash, closeSplash, splashOpen, SCENE_ART,
    deckFocus, deckBlur,
    deckPick: () => _deckPick, toggleMenu, closeMenu,
    active: () => !!RUN && !RUN.over,
    state: () => RUN,
    map: () => (RUN ? RUN.map : []),
    reachable,
    travel, tapNode, newRun, clear,
    screen,
    render: renderMap,
    REGIONS, regionOf, EVENTS, eventDef, takeEvent, weakestPair,
    RECKONINGS, pickReckoning, openReckoning, takeReckoning, enterEvent,
    reckoning: () => _reck, reckNext, closeReck, TREE, treeNode, kindle, apBonusOf, openBranch, closeBranch, campOpen: () => _campOpen, tapMemory, focusMemory, sitDown, leaveCamp, renderCamp, cardUps, alloutOf, nodeFace,
    pendingBonds, openBondScene, takeBond, confirmSwap, renderSwap,
    RECALLS, pendingRecall, openRecall, takeRecall,
    WAKES, wakeOffer, takeWake, renderWake, wakeDef, wakePair,
    SIGIL_BY_PAIR, sigilFor, renderMark, placeSigil, openMark, leaveMark,
    swapPick: () => _swapPick, pendingCard: () => _pendingCard,
    PAIRS, BOND_STEPS, BONDS, bondLevel, bondScene, PAIR_NAME,
    profile: () => PROFILE, resetProfile() { PROFILE = { heard: [], won: [] }; saveProfile(); },
    SCENES, sceneNext, sceneSkip, scene: () => _scene, beat: () => _beat,
    // test-only
    _set(patch) { Object.assign(RUN, patch || {}); save(); renderMap(); },
    // TEST HOOK. Puts a scene on the stage without walking a road to it, so a
    // crossroads' effects can be swept across every pick in the table rather
    // than asserted on whichever one a seed happened to deal.
    _setScene(sc) { _scene = sc; _beat = sc ? (sc.beats || sc.lines || []).length : 0; },
    _pick: () => _pick,
    KIND, PLAN, STOPS, CAMP_FRAC, KIZUNA_CARRY,
  };
})();
