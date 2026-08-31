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

const V23_BUILD = 94;   // MUST match version.json's "v2.3" — bump BOTH every build.

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
  // NOTHING MAY BE A DEAD DRAW — but the answer does not have to be a keyword.
  // Build 23 gave Cleave a row condition and it worked; it also meant nine of
  // fifteen cards had a clause to check. This is the deck's plain hard hit: the
  // best flat number in it, nothing to read, nothing to set up.
  cleave:      { owner: 'ash', name: 'Cleave',        cost: 1, target: 'enemy', base: [{ dmg: 7 }], cond: null },
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
  // THE CARD THAT MAKES THE LINE AFFORDABLE. A FINALE costs the whole turn —
  // three heroes, three AP — so the finisher was always the last thing that
  // could happen and a player who reached it had nothing left. One refund in
  // the MIDDLE of the line changes the arithmetic of the whole plan: Ash, then
  // this for free, then the finisher, and there is still an AP for a fourth
  // card. That is the turn this game wanted and could not pay for.
  lcascade:    { owner: 'elin', name: 'Lumen Cascade', cost: 1, target: 'enemy', base: [{ dmg: 4 }, { guardLowest: 5 }],
                 cond: { type: 'FOLLOW_UP', reward: 'ap', ap: 1 } },
  // THE SECOND FINALE, so the trio is a fork and not a script: close the round
  // with Ash and it is a killing blow, close it with Elin and the party stands
  // back up. One turn, one finisher, two very different turns.
  mend:        { owner: 'elin', name: 'Mend',          cost: 1, target: 'party', base: [{ heal: 6 }],
                 cond: { type: 'FINALE', reward: 'output', bonus: [{ healAll: 5 }] } },
  frostbind:   { owner: 'elin', name: 'Frost Bind',    cost: 1, target: 'enemy', base: [{ dmg: 4 }, { chill: 4 }], cond: null },
  // The setup card: the thing you play mid-combo to arm next turn's BROKEN
  // payoffs. Its Follow-Up landed 94% of the time, so the clause was a tax on
  // reading rather than a decision — it just does both now.
  sgrace:      { owner: 'elin', name: 'Shared Grace',  cost: 1, target: 'party',
                 base: [{ guardAll: 3 }, { brk: 2 }], cond: null },
  intercession:{ owner: 'elin', name: 'Intercession',  cost: 1, target: 'ally',  base: [{ guardSelf: 3 }, { guardAlly: 3 }, { intercede: true }], cond: null },
  // ── Mira — Shade ──
  serrate:     { owner: 'mira', name: 'Serrate',       cost: 1, target: 'enemy', base: [{ dmg: 3 }, { bleed: 3 }], cond: null },
  // The deck's only filter: what you play to FIND the hero missing from the
  // round you are building. Nudged to 5 so it is never strictly worse than the
  // vanilla strike while doing that job.
  // …AND THE FILTER PAYS FOR ITSELF. Digging for the hero missing from the round
  // you are building used to cost an AP, which meant the card that finds the
  // combo competed with the combo. Played after an ally it is free, so looking
  // is no longer a turn you spent not acting.
  qthrow:      { owner: 'mira', name: 'Quick Throw',   cost: 1, target: 'enemy', base: [{ dmg: 5 }, { drawDiscard: true }],
                 cond: { type: 'FOLLOW_UP', reward: 'ap', ap: 1 } },
  // Two strikes, always. Its Follow-Up landed 97% of the time — a clause that
  // is almost always true is not a decision, it is a thing to read every turn.
  // STILL PLAIN, AND DELIBERATELY. The first draft of this build gave it the
  // SAME_HERO fork and the suite caught what that cost: with Quick Throw and
  // Twin Fang both carrying clauses, Mira had exactly ONE card left with
  // nothing to read, and a check that needed two of them crashed. Build 25
  // spent itself cutting the deck's reading load from nine conditional cards
  // to six; three back is the fix for a combo layer that was too quiet, four
  // is walking back into the room Build 25 left. The fork lives on Guarding
  // Cut instead, where it costs the hero who has the most reason to hold
  // ground rather than the one who already reads four clauses.
  twinfang:    { owner: 'mira', name: 'Twin Fang',     cost: 1, target: 'enemy',
                 base: [{ dmg: 4 }, { dmg: 4 }], cond: null },
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

// ═════════════════════════════════════════════════════════════════════════════
// THE SHARPENED FACES — what a campfire can make of a card.
// ═════════════════════════════════════════════════════════════════════════════
// Every upgrade is a WHOLE card definition, authored by hand, not a delta
// applied to the base. Slay the Spire does it this way for a reason: a delta
// ("+3 damage") has to be re-derived every time you read it and quietly breaks
// the moment a card has two damage atoms, whereas a written-out face is the
// thing the player will actually see, and it can be read straight off this
// table by anyone tuning the deck.
//
// The deck GETS BETTER WITHOUT GETTING BIGGER. That is deliberate: Build 25
// spent itself reducing the reading load of fifteen cards, and answering a
// progression system by handing the player eighteen would undo it.
const CARD_UPS = {
  // Ash — the plain hard hit gets harder, the chain hits harder, the finisher ends it
  cleave:      { name: 'Cleave+',        cost: 1, target: 'enemy', base: [{ dmg: 10 }], cond: null },
  crosssever:  { name: 'Cross Sever+',   cost: 2, target: 'enemy', base: [{ dmg: 11 }, { brk: 3 }],
                 cond: { type: 'FOLLOW_UP', reward: 'cost', costTo: 1 } },
  lastlight:   { name: 'Last Light+',    cost: 1, target: 'enemy', base: [{ dmg: 6 }],
                 cond: { type: 'FINALE', reward: 'output', bonus: [{ dmg: 14 }, { brk: 3 }] } },
  // Elin — the mend, the setup, the strike that shelters
  mend:        { name: 'Mend+',          cost: 1, target: 'party', base: [{ heal: 9 }],
                 cond: { type: 'FINALE', reward: 'output', bonus: [{ healAll: 7 }] } },
  sgrace:      { name: 'Shared Grace+',  cost: 1, target: 'party', base: [{ guardAll: 5 }, { brk: 3 }], cond: null },
  lcascade:    { name: 'Lumen Cascade+', cost: 1, target: 'enemy', base: [{ dmg: 6 }, { guardLowest: 7 }],
                 cond: { type: 'FOLLOW_UP', reward: 'ap', ap: 1 } },
  // Mira — the double, the two-beat plan, the execution
  twinfang:    { name: 'Twin Fang+',     cost: 1, target: 'enemy', base: [{ dmg: 6 }, { dmg: 6 }], cond: null },
  backstab:    { name: 'Backstab+',      cost: 1, target: 'enemy', base: [{ moveSelf: 'front' }, { dmg: 7 }],
                 cond: { type: 'BACK_ROW', reward: 'output', bonus: [{ dmg: 7 }] } },
  execute:     { name: 'Execute+',       cost: 1, target: 'enemy', base: [{ dmg: 7 }],
                 cond: { type: 'BROKEN_OR_LOW', reward: 'output', bonus: [{ dmg: 12 }] } },
};
// A card's face is whatever THIS run has made of it. Every read goes through
// here — a single site that forgets is a card that lies about itself, which is
// the one thing Build 23 established the deck may never do.
function cardDef(id) {
  return (C && C.cards && C.cards[id]) || CARD_DEFS[id];
}
function buildCards(upgrades) {
  const out = {};
  for (const id of Object.keys(CARD_DEFS)) {
    const up = (upgrades && upgrades.indexOf(id) >= 0) ? CARD_UPS[id] : null;
    out[id] = up ? { ...CARD_DEFS[id], ...up, upgraded: true } : CARD_DEFS[id];
  }
  return out;
}
// ═════════════════════════════════════════════════════════════════════════════
// THE BOND CARDS — what two of them learn to do together.
// ═════════════════════════════════════════════════════════════════════════════
// Owned by a PAIR, not a hero. Won by a choice inside a campfire scene, and
// each choice is a different card: the same two people at the same point in
// their story, taken two different ways.
//
// THEY ARE NOT UPGRADES. A bond card is a SIDEGRADE with a different shape,
// costed against what it replaces rather than above it — because a card that
// is simply better makes every run converge on the same deck, and the whole
// point of a fork is that both roads stay worth walking. The cost is not power
// anyway: it is the slot, and the slot belongs to one of the two heroes.
const BOND_CARDS = {
  // ── ASH + ELIN — the two who have done this before ──
  shieldsong:  { owner: 'ash|elin', name: 'Shieldsong', cost: 1, target: 'party',
                 base: [{ guardAll: 4 }, { heal: 4 }], cond: null,
                 line: 'Guard the whole line, and mend the worst of it.' },
  lastvigil:   { owner: 'ash|elin', name: 'Last Vigil', cost: 1, target: 'enemy',
                 base: [{ dmg: 6 }, { guardSelf: 6 }], cond: null,
                 line: 'A blow struck from behind a raised shield.' },
  gravebloom:  { owner: 'ash|elin', name: 'Gravebloom', cost: 1, target: 'enemy',
                 base: [{ dmg: 5 }, { healAll: 4 }], cond: null,
                 line: 'What it takes from her, it gives to them.' },
  ashenoath:   { owner: 'ash|elin', name: 'Ashen Oath', cost: 2, target: 'enemy',
                 base: [{ dmg: 13 }, { brk: 3 }], cond: null,
                 line: 'Everything, at once, and nothing held back.' },
  // ── ASH + MIRA — the vanguard and the shade ──
  shieldblade: { owner: 'ash|mira', name: 'Shield the Blade', cost: 1, target: 'enemy',
                 base: [{ dmg: 5 }, { guardAlly: 5 }], cond: null,
                 line: 'He stands in front. She works behind him.' },
  twinshadow:  { owner: 'ash|mira', name: 'Twin Shadow', cost: 1, target: 'enemy',
                 base: [{ dmg: 5 }, { dmg: 5 }], cond: null,
                 line: 'Neither of them guards. Neither of them needs to.' },
  cutthecord:  { owner: 'ash|mira', name: 'Cut the Cord', cost: 1, target: 'enemy',
                 base: [{ dmg: 4 }, { bleed: 4 }, { moveSelf: 'back' }], cond: null,
                 line: 'Open it, and step out of reach.' },
  bothblades:  { owner: 'ash|mira', name: 'Both Blades', cost: 2, target: 'enemy',
                 base: [{ dmg: 9 }, { dmg: 5 }], cond: null,
                 line: 'The heavy one, then the quick one.' },
  // ── ELIN + MIRA — the oracle and the knife ──
  coldmercy:   { owner: 'elin|mira', name: 'Cold Mercy', cost: 1, target: 'enemy',
                 base: [{ dmg: 4 }, { chill: 5 }], cond: null,
                 line: 'Slow the song before it reaches anyone.' },
  quietword:   { owner: 'elin|mira', name: 'A Quiet Word', cost: 1, target: 'party',
                 base: [{ guardLowest: 6 }, { draw: 1 }], cond: null,
                 line: 'Cover the one who needs it, and find the next answer.' },
  thornandlamp:{ owner: 'elin|mira', name: 'Thorn and Lamp', cost: 1, target: 'enemy',
                 base: [{ dmg: 3 }, { bleed: 3 }, { guardAll: 3 }], cond: null,
                 line: 'A little of everything, for everyone.' },
  namethefear: { owner: 'elin|mira', name: 'Name the Fear', cost: 1, target: 'enemy',
                 base: [{ dmg: 4 }, { brk: 3 }], cond: null,
                 line: 'Say what it is out loud, and it staggers.' },
};
Object.assign(CARD_DEFS, BOND_CARDS);
const BOND_IDS = Object.keys(BOND_CARDS);
const isBondCard = (id) => BOND_IDS.indexOf(id) >= 0;
// A pair card belongs to BOTH its heroes, and to neither exclusively — which
// is why taking one costs a slot from one of the two, chosen by the player.
// Every card belongs to one hero or to two. These four are the only places the
// rest of the game needs to care which.
function ownerHeroes(card) {
  if (!card) return [];
  if (card.owner === 'bond') return RESONANCE_PAIR.slice();     // the authored climax
  if (card.owner.indexOf('|') > 0) return card.owner.split('|');
  return [card.owner];
}
function primaryHero(card) { return ownerHeroes(card)[0]; }
function isPairCard(card) { return ownerHeroes(card).length > 1; }
function ownerDown(card) { return ownerHeroes(card).some(h => C.heroes[h] && C.heroes[h].downed); }
function pairOf(id) {
  const c = CARD_DEFS[id];
  return c && c.owner && c.owner.indexOf('|') > 0 ? c.owner.split('|') : null;
}

const DECK_IDS = Object.keys(CARD_DEFS)
  .filter(id => CARD_DEFS[id].owner !== 'bond' && !isBondCard(id));   // the 15

// ═════════════════════════════════════════════════════════════════════════════
// THE ROSTER — five slots per hero, always.
// ═════════════════════════════════════════════════════════════════════════════
// The deck used to be a constant. It is a roster now: three lists of five, and
// a run's deck is whatever those lists hold. The 5/5/5 shape was an accident
// of the authored deck; it is a RULE now, and it is the thing that makes a
// bond card cost something — the pair card goes into one of its two heroes'
// five, and whatever was in that slot leaves.
const SLOTS_PER_HERO = 5;
function baseRoster() {
  const r = { ash: [], elin: [], mira: [] };
  for (const id of DECK_IDS) r[CARD_DEFS[id].owner].push(id);
  return r;
}
function rosterIds(roster) {
  const r = roster || baseRoster();
  return ['ash', 'elin', 'mira'].reduce((a, h) => a.concat(r[h] || []), []);
}
function rosterValid(roster) {
  if (!roster) return false;
  return ['ash', 'elin', 'mira'].every(h => Array.isArray(roster[h]) && roster[h].length === SLOTS_PER_HERO)
    && new Set(rosterIds(roster)).size === SLOTS_PER_HERO * 3;
}
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
// THE DIRGE IS THE HALF NOBODY CAN PARRY, and at 4 it was most of the Regent.
//
// pace.sim found a clumsy run does not die on the road at all: it walks all six
// stops at 88 of 112 health and then loses to her, twelve wipes of seventeen.
// regent.probe then asked where that health goes, and split her damage in two:
//
//   arriving at 88 of 112     won      taken   by blows   by the DIRGE
//   dirge 4   clumsy          2/20        99         44         54  (55%)
//             ordinary       18/20        70         20         50  (72%)
//             sharp          20/20        48          5         42  (89%)
//   dirge 3   clumsy          6/20        91         50         41  (45%)
//             ordinary       19/20        58         21         37  (64%)
//             sharp          20/20        33          5         28  (84%)
//
// Two things in that table. The blows — the half a player can answer — range
// 44 to 5 across skill, a tenfold spread, exactly as intended. The dirge barely
// moves: 54 / 50 / 42, because it is a tax on TURNS and every skill takes about
// eight of them. So at 4 the Regent's threat was mostly a flat toll that
// ignored the player entirely, and it was 61% of the health they arrive with.
//
// The obvious-looking fix — take it off the dirge and put it on her blows —
// was measured and is WRONG: raising her blows hurts a clumsy party ten times
// as much as a sharp one, so it makes the cliff steeper, not flatter.
//
// Three is the number. It triples the low end and does not touch the top.
// `alloutAp` is here rather than beside the all-out because it is a BALANCE
// number, not a rule: Build 94's AP ladder is the largest single power change
// this deck has taken, and the sim measured it immediately — the ~half-parry
// band went from inside its 25-55% gate to 81.3%. A number that moves a gate
// that far has to be drivable from the sim that watches the gate.
// `dmgScale` is 1.16 rather than 1.0 because Build 94's AP ladder made the party
// measurably stronger and the world has to absorb exactly that much. Measured at
// the ~half-parry band, 90 runs a point:
//
//     dmgScale   1.00  77.8%      1.16  58.9%
//                1.08  68.9%      1.24  53.3%
//
// Build 93 measured 58.9% on the same bot and seeds, so 1.16 is the point where
// this build is balance-NEUTRAL. 1.24 would land inside the shipped 25-55% gate
// and close a drift that predates this build — and that is deliberately not
// taken here: the band has been adrift since before the AP ladder existed, it
// wants a full three-band sweep rather than a number picked off a one-band
// probe, and a build should absorb its own delta and no more.
//
// The median winning fight stays at 8 rounds across the whole sweep, which is
// why this knob and not `bossHp`: more health buys the same winrate by making
// fights LONGER, and the deck's target is 7-9 rounds.
const TUNE = { dmgScale: 1.16, dirge: [3, 3], heal: [7, 9], parryKeep: 0.3, bossHp: 168,
  alloutDmg: 26, alloutBrk: 4, alloutAp: 1 };

const ALLOUT_BASE = { dmg: TUNE.alloutDmg, brk: TUNE.alloutBrk };

// ═════════════════════════════════════════════════════════════════════════════
// THE ACTS — what the foe is physically DOING, and therefore what the hand does
// ═════════════════════════════════════════════════════════════════════════════
// THE GESTURE IS THE ATTACK, MIRRORED. Before this, a hit named a NOTE — a
// rhythm token picked for variety — and the foe's body was then made to agree
// with the note (`FOE_SWING` mapped note -> animation, which is backwards). The
// result measured badly: of seven intents, three had gestures that agreed with
// what the foe appeared to do and four were arbitrary. The Hymn is a bell being
// struck and asked for tap/tap. Grief in Threes used the SWEEP pose and asked
// for three taps and a traced angle. Worse, the pose was chosen per INTENT, so
// a three-blow bar played one animation for all three blows: the foe struck
// three different ways and looked identical every time.
//
// A hit now names ACTS. The act decides all three of the things that were
// drifting apart:
//   • what the foe's body does        (pose + swing, per BLOW, not per bar)
//   • what the hand is asked for      (the note, derived — never authored)
//   • what the telegraph calls it     (the word, so the chip names the attack)
//
// So a claw is a wipe the same way the claw goes; a slash is a stroke along the
// blade's line; a cast is a circle drawn in the air, because that is what is
// being drawn at you. The player is reading the FOE, not a notation.
const ACTS = {
  // a bell struck, a weight coming down — you brace, you do not dodge
  toll:   { word: 'TOLL',   note: 'hold',        pose: 'k-foe-toll',   swing: 'k-fs-press',  mark: 'dirge' },
  // a raking swipe across the party — wipe the way it rakes
  claw:   { word: 'CLAW',   note: 'slide',       pose: 'k-foe-sweep',  swing: 'k-fs-arc',    mark: 'move' },
  // one blade stroke on a line — cut back along it
  slash:  { word: 'SLASH',  note: 'slide',       pose: 'k-foe-sweep',  swing: 'k-fs-arc',    mark: 'move' },
  // a straight stab: one point, one answer
  thrust: { word: 'THRUST', note: 'tap',         pose: 'k-foe-toll',   swing: 'k-fs-jab',    mark: 'atk' },
  // a sigil drawn in the air. You draw it back — the one act whose gesture has
  // a SHAPE in it, and the reason the draw note exists at all.
  sigil:  { word: 'SIGIL',  note: 'draw:circle', pose: 'k-foe-gather', swing: 'k-fs-cast',   mark: 'finale' },
  // many small impacts, no single moment to catch — out-mash it
  rain:   { word: 'RAIN',   note: 'burst',       pose: 'k-foe-rain',   swing: 'k-fs-flurry', mark: 'bleed' },
  // a twitch that does not commit
  feint:  { word: 'FEINT',  note: 'feint',       pose: 'k-foe-wind',   swing: 'k-fs-fake',   mark: 'follow' },
  // an opening that is bait
  lure:   { word: 'LURE',   note: 'bait',        pose: 'k-foe-gather', swing: 'k-fs-fake',   mark: 'broken' },
};
// `claw:R` -> the act plus the direction it travels. The direction rides on the
// ACT because it is a fact about the swing, not about the input.
function parseAct(spec) {
  const [id, dir] = String(spec).split(':');
  return { id, dir: dir || null, def: ACTS[id] || ACTS.thrust };
}
// The note a hit actually plays, derived — never authored beside the act, so
// the two cannot disagree.
function noteForAct(spec) {
  const a = parseAct(spec);
  const base = a.def.note;
  // a directional act hands its direction to a directional note
  if (base === 'slide' && a.dir) return 'slide:' + a.dir;
  return base;
}
// Every hit is authored with `acts`; `notes` is computed from it once, here, so
// everything downstream (the bots, the sims, the checks) keeps reading `notes`
// and cannot be handed a pair that drifted apart.
function deriveNotes(intents) {
  for (const it of intents) for (const h of it.hits) {
    if (!h.acts) continue;
    h.notes = h.acts.map(noteForAct);
  }
  return intents;
}

const REGENT_INTENTS = [
  // Each intent has its own HANDWRITING. The Hymn is a dirge you brace
  // through; the Advance is two sweeping arcs; the Benediction dares you to
  // interrupt it; the Rain is a flurry you have to out-mash.
  // Each intent keeps its own RHYTHM as well as its own gestures. `beats` places
  // a note inside the hit's bar, so a string can hesitate or double instead of
  // marching — a metronome is a thing you solve once, not a thing you play.
  { id: 'hymn', name: 'Ruinous Hymn', kind: 'attack',
    hits: [
      // a quick double toll, then a caught breath, then the long note. The
      // double is two TAPS — the one gesture you can genuinely repeat inside
      // half a beat, because your hand is already where it needs to be.
      { dmg: [9, 12], target: 'ash',  acts: ['thrust', 'thrust'], beats: [0, 0.5] },
      { dmg: [9, 12], target: 'ash',  acts: ['feint', 'toll'], beats: [0, 1.5] },
      { dmg: [9, 12], target: 'elin', acts: ['thrust', 'toll'] },
    ] },
  { id: 'scythe', name: 'Scything Advance', kind: 'attack', frontOnly: true,
    hits: [
      // sweep, then the jab a beat and a half later — the hand has to arrive
      // before it can strike again
      { dmg: [13, 17], target: 'mira', acts: ['claw:R', 'thrust'], beats: [0, 1.5], sweep: true },
      { dmg: [13, 17], target: 'ash',  acts: ['claw:L', 'toll', 'thrust'], beats: [0, 1.5, 3], sweep: true },
    ] },
  { id: 'benediction', name: 'Hollow Benediction', kind: 'heal',
    hits: [
      { dmg: [8, 12], target: 'elin', acts: ['lure', 'sigil'] },
    ] },
  // THE LADDER NEEDED A BOTTOM RUNG. Measured across the bestiary, the lightest
  // bar the FODDER could throw was 2 notes and the lightest the BOSS could
  // throw was also 2 — so the first thing a player meets and the last thing
  // they meet could ask exactly the same amount, and the curve that is supposed
  // to teach the vocabulary was flat at the bottom and inverted at the top.
  //
  // The Hollow Husk shared `scythe` with three other foes and could open a
  // first fight on five notes. This is its own hand instead: three notes, all
  // of them the two gestures a player already knows on turn one, and a shape
  // that reads as a shape — high, low, and a jab that arrives late.
  { id: 'lash', name: 'Grasping Lash', kind: 'attack',
    hits: [
      { dmg: [10, 14], target: 'ash',  acts: ['claw:L', 'thrust'], beats: [0, 1.5] },
      { dmg: [10, 14], target: 'mira', acts: ['thrust'] },
    ] },
  // …AND THE CHOIR'S OWN LIGHT HAND. The Lash was dealt to both fodder foes at
  // first and the suite caught what that meant: `lash` opens on a CLAW, the
  // Choir of One's sprite sheet has no sweep frames at all — it tolls, it
  // rains, it gathers — and a foe throwing a blow it has no body for falls back
  // to its idle loop mid-swing. An intent is not just a damage shape; it is a
  // list of things the thing on screen has to be able to DO.
  //
  // So the Choir gets three notes built only from what it can perform: the
  // sigil it is already drawing, and one long toll to close.
  { id: 'keening', name: 'The Keening', kind: 'attack',
    hits: [
      { dmg: [9, 13], target: 'elin', acts: ['sigil', 'thrust'], beats: [0, 1.5] },
      { dmg: [9, 13], target: 'ash',  acts: ['toll'] },
    ] },
  // …AND A TOP RUNG. The Regent's benediction was the two-note bar that dragged
  // the boss's floor down to the Husk's. This is the same act — it sings itself
  // whole and dares you to interrupt — written at the weight of the thing
  // singing it: a long gathering figure, a feint inside it, and the sigil at
  // the end that is the heal actually landing.
  { id: 'dirgesong', name: 'The Mourning Dirge', kind: 'heal',
    hits: [
      { dmg: [7, 10], target: 'elin', acts: ['lure', 'toll'], beats: [0, 1.5] },
      { dmg: [9, 13], target: 'ash',  acts: ['feint', 'thrust', 'sigil'], beats: [0, 1.5, 3] },
    ] },
  // FIVE NOTES, NOT FOUR — and the reason is the boss's floor. The Rain is the
  // only intent in the bestiary carrying a BURST, so taking it off the Mourning
  // Regent to keep her floor above the elite's took the whole mash gesture out
  // of the last fight in the game: four separate checks went red naming the
  // vocabulary they could no longer find. A boss that cannot throw a flurry is
  // a worse boss than a boss with a slightly soft floor.
  //
  // So the downpour gets the extra note it was always short of — a third rain
  // on the closing hit, which is what a downpour is — and it can be dealt to
  // the Regent without pulling her floor under the Revenant's.
  { id: 'rain', name: 'Ashen Rain', kind: 'attack', sub: [1, 0.75],
    hits: [
      { dmg: [9, 13], target: 'ash',  acts: ['rain'] },
      { dmg: [9, 13], target: 'elin', acts: ['rain'] },
      { dmg: [9, 13], target: 'mira', acts: ['thrust', 'claw:D', 'rain'], beats: [0, 1.5, 3.5] },
    ] },
  // THREE MORE HANDS, so that no two opponents play the same one. Four intents
  // shared five ways meant the bestiary's whole promise — "each foe draws from
  // the same vocabulary but is handed a different subset, so its handwriting is
  // legible after one turn" — was false: every foe opened with the Hymn, and
  // the elite and the Regent had identical sets.
  //
  // Each of these is a different SHAPE of bar rather than a different amount of
  // damage. Totals sit inside the band the existing four already occupy, so the
  // ladder from fodder to boss is still the one multiplier it was designed to
  // be, and the sims still gate it.
  //
  // THE LONG TOLL — two blows, no filler, and the whole hit rides on one note
  // each. Sparse on purpose: it is the weight intent, and a hold is the note
  // that asks the hand to commit and wait.
  { id: 'toll', name: 'The Long Toll', kind: 'attack',
    hits: [
      { dmg: [14, 19], target: 'ash',  acts: ['toll'] },
      { dmg: [14, 19], target: 'mira', acts: ['toll'] },
    ] },
  // GRIEF IN THREES — the opposite: light hits, many reads, and it tightens in
  // the second phase. Three taps on the half-beat is the closest thing in the
  // vocabulary to a drum fill.
  { id: 'flurry', name: 'Grief in Threes', kind: 'attack', sub: [1, 0.75],
    hits: [
      { dmg: [7, 10], target: 'mira', acts: ['slash:L', 'slash:R', 'slash:L'], beats: [0, 0.5, 1] },
      { dmg: [7, 10], target: 'elin', acts: ['thrust', 'sigil'], beats: [0, 1] },
      { dmg: [7, 10], target: 'ash',  acts: ['rain'] },
    ] },
  // THE RISING DIRGE — the Regent's own, and the only intent whose hits get
  // BIGGER as the bar goes on. The last blow is the one worth reading, and it
  // is the one guarded by a feint.
  { id: 'crescendo', name: 'The Rising Dirge', kind: 'attack',
    hits: [
      { dmg: [8, 11],  target: 'elin', acts: ['thrust', 'thrust'], beats: [0, 2] },
      // THE ARC IS THE REGENT'S OWN. It REPLACES the slide that stood here
      // rather than joining it: a new note kind is a change to how hard the
      // fight is to play, and adding one to the deepest intent in the bestiary
      // would have moved the ladder as well as the vocabulary. Same count, same
      // beats, one harder gesture — and it is on the middle hit, which had the
      // most runway to begin with.
      { dmg: [10, 14], target: 'ash',  acts: ['sigil', 'thrust', 'thrust'], beats: [0, 1.5, 2.5] },
      { dmg: [12, 16], target: 'mira', acts: ['feint', 'toll'], beats: [0, 1.5] },
    ] },
];
// AUTHORED AS ACTS, PLAYED AS NOTES. One pass, here, so nothing downstream
// can be handed an act and a note that disagree.
deriveNotes(REGENT_INTENTS);

// ═════════════════════════════════════════════════════════════════════════════
// THE BESTIARY — the Regent is the last thing you meet, not the only thing.
// ═════════════════════════════════════════════════════════════════════════════
// A run needs opponents that differ in what they ASK, not just in how much HP
// they own. Each foe draws from the same intent vocabulary but is handed a
// different subset of it, so its handwriting is legible after one turn: the
// Husk only ever tolls and sweeps, the Choir heals itself and rains, the
// Wraith is all sweep and flurry. Damage rides on a single multiplier and the
// dirge is per-foe, so the ladder from fodder to boss is one number to tune
// rather than four tables to keep in sync.
// THE LADDER IS THE FLOOR, NOT THE MEAN. What a player feels from a foe is the
// LIGHTEST bar it can open on — the mean is a statistic nobody experiences, and
// tuning against it hid the actual defect: the Grief-Wraith (84 HP, a third
// fight) had a floor of 4 notes while the Mourning Regent (98 HP, the boss)
// could open on 2. The first fight and the last could ask the same thing.
//
// So each foe's hand is dealt to hold a floor and a ceiling, and both rise:
//
//     husk      2 – 3      toll, lash
//     cultist   2 – 5      benediction, keening, rain
//     wraith    5 – 6      rain, scythe, flurry
//     revenant  5 – 6      scythe, flurry, hymn
//     mourner   5 – 7      scythe, hymn, rain, dirgesong, crescendo
//
// THE WRAITH AND THE REVENANT SHARE A RUNG, and that is honest rather than
// unfinished: what separates an elite from a third fight here is not how many
// notes it throws but how fast — the Revenant has two phases, and phase 2
// shortens the beat under everything it plays. The count is the ladder; the
// tempo is the elite.
//
// A check asserts it, so the next hand dealt cannot quietly flatten the curve.
const FOES = {
  husk:     { id: 'husk', name: 'The Hollow Husk', art: 'foe-husk', tier: 'fight',
              hp: 62, brk: 8, dmgMul: 0.70, dirge: 2, phases: 1, embers: 2,
              intents: ['toll', 'lash'] },
  cultist:  { id: 'cultist', name: 'The Choir of One', art: 'foe-cultist', tier: 'fight',
              hp: 76, brk: 9, dmgMul: 0.80, dirge: 2, phases: 1, embers: 2,
              intents: ['benediction', 'keening', 'rain'] },
  wraith:   { id: 'wraith', name: 'The Grief-Wraith', art: 'foe-wraith', tier: 'fight',
              hp: 84, brk: 10, dmgMul: 0.86, dirge: 3, phases: 1, embers: 3,
              intents: ['rain', 'scythe', 'flurry'] },
  // THE ELITE IS A GAMBLE, NOT A SECOND BOSS. At 116 HP / 0.96 / dirge 3 the
  // run sim measured it costing a ~half-parry party 72 of their 112 health —
  // more than the Regent herself — so the road was decided at stop 3 and the
  // last two stops were a formality. It keeps its two phases and its full
  // intent hand, which is what makes it feel like an elite; what it loses is
  // the attrition that made it the end of the run.
  revenant: { id: 'revenant', name: 'The Kneeling Revenant', art: 'foe-revenant', tier: 'elite',
              hp: 98, brk: 11, dmgMul: 0.88, dirge: 2, phases: 2, embers: 5,
              intents: ['scythe', 'flurry', 'hymn'] },
  mourner:  { id: 'mourner', name: 'The Mourning Regent', art: 'foe-mourner', tier: 'boss',
              hp: null, brk: 12, dmgMul: 1, dirge: null, phases: 2, embers: 8,
              intents: ['scythe', 'hymn', 'rain', 'dirgesong', 'crescendo'] },
};
// `hp: null` and `dirge: null` mean "whatever TUNE says" — the boss stays the
// one encounter the balance sim tunes directly, and the rest are scaled off it.
function foeHp(f) { return f.hp != null ? f.hp : TUNE.bossHp; }
function foeIntents(f) { return REGENT_INTENTS.filter(i => f.intents.indexOf(i.id) >= 0); }


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
  // THE FOE STANDS DOWN whenever the turn leaves its hands — including on the
  // early returns out of the enemy phase, which is why this lives here rather
  // than only at the bottom of endTurn. A posture held past its act is a foe
  // frozen mid-lunge for the rest of the fight.
  if (p === 'PLAYER_READY' || p === 'VICTORY' || p === 'DEFEAT') {
    if (typeof fxFoeSettle === 'function') fxFoeSettle();
  }
  // …AND A FOE THAT HAS ACTUALLY DIED GOES DOWN, whether or not a run is
  // waiting to collect the fight. This lived inside the `onEnd` block, so a
  // foe killed outside a run — the suite's own fights, a bare board — simply
  // stood there dead.
  // THE BLOW LANDS BEFORE THE BODY DOES. The fall used to start in the same
  // frame the health hit zero — 13ms after the killing hit, while that hit's
  // own flash was still on screen — so the impact and the collapse arrived as
  // one smear and the death had no moment of its own. It reads as a JRPG death
  // now: the blow connects, the figure holds a beat too long, and then it goes
  // down. The road's hand-off already waits 1750ms, so this costs the player
  // nothing — it spends silence that was there anyway.
  // …and it only falls if the fight is still won when the beat comes round:
  // startCombat clears k-foe-down, so a next fight opening inside the hold
  // would otherwise inherit a husk that was never there.
  if (p === 'VICTORY') setTimeout(() => {
    if (!C || C.phase !== 'VICTORY') return;
    try { fxFoeDown(); } catch (e) {}
  }, FOE_DEATH_HOLD);
  // A fight that was started BY something reports back to it. Combat itself
  // still knows nothing about runs, maps or embers — it only knows it is over.
  if ((p === 'VICTORY' || p === 'DEFEAT') && C.onEnd) {
    // THE HAND-OFF IS THE ONLY WAY OUT OF A FIGHT INSIDE A RUN — combat draws
    // no outcome card there, because the road owns it. So every way this can
    // fail strands the player on a finished board with nothing to press.
    //
    // Two of them are closed here. The summary used to be built in the same
    // declaration that captured the callback, so if it threw, `C.onEnd` was
    // never cleared, the timer was never set, and the throw propagated back up
    // through whatever dealt the killing blow — aborting the turn mid-flight.
    // And the callback ran naked inside a setTimeout, where a throw in the run
    // layer is unhandled and silent.
    const cb = C.onEnd;
    C.onEnd = null;
    // `onEnd` is cleared the instant the transition happens, so it cannot also
    // stand for "the road is still coming" — reading it that way made the
    // fallback outcome card appear in the same paint as the victory, beating
    // the road to its own screen. This flag is the honest signal: it is true
    // from the moment the hand-off is scheduled until the callback has actually
    // been given its turn.
    C._handoff = true;
    let snap = null;
    try { snap = combatSummary(p); }
    catch (e) { snap = { outcome: p === 'VICTORY' ? 'victory' : 'defeat',
                         foe: C.foe ? C.foe.id : null, turns: C.turn,
                         partyHp: null, pairBond: {}, kizuna: 0, cleanliness: 0, deeds: null }; }
    // LET THE KILL LAND. 620ms was enough to see a number and not enough to
    // see a death: the foe was still mid-recoil when the next screen arrived.
    // On a win the board now holds while it goes down.
    const handoffMs = p === 'VICTORY' ? 1750 : 900;
    setTimeout(() => {
      try { cb(snap); } catch (e) { console.error('onEnd failed', e); }
      if (C) C._handoff = false;
    }, handoffMs);
    // …and one more paint AFTER the hand-off window has passed. Nothing else
    // repaints combat once the turn has ended, so without this the fallback
    // outcome card would have no moment at which to appear — and it has to be
    // measured from the hand-off rather than fixed at 1500ms, because the
    // moment the win got its death beat the repaint started landing while
    // `_handoff` was still true and drew nothing at all.
    setTimeout(() => { try { renderOutcome(); } catch (e) {} }, handoffMs + 880);
  }
}
// What a finished fight is worth, in the only terms the run layer cares about.
function combatSummary(p) {
  const par = C.telemetry.parry;
  const notes = par.reduce((n, r) => n + r.notes, 0);
  const kept = par.reduce((n, r) => n + r.kept, 0);
  return {
    outcome: p === 'VICTORY' ? 'victory' : 'defeat',
    foe: C.foe ? C.foe.id : null,
    turns: C.turn,
    kizuna: C.kizuna,
    pairBond: { ...C.pairBond },
    partyHp: { ash: C.heroes.ash.hp, elin: C.heroes.elin.hp, mira: C.heroes.mira.hp },
    deeds: C.deeds ? JSON.parse(JSON.stringify(C.deeds)) : null,
    turned: par.filter(r => r.turned).length,
    flawless: par.filter(r => r.flawless).length,
    strings: par.length,
    cleanliness: notes ? kept / notes : 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// THE DEEDS — what this fight actually did, so the reckoning can talk about it
// ═══════════════════════════════════════════════════════════════════════════
// A post-fight scene that says something generic is a loading screen with
// dialogue on it. This ledger is the difference: every line the reckoning
// speaks is drawn from a thing that MEASURABLY happened — who landed the last
// blow, who was one hit from the floor when it did, who stepped in front of
// whom, who moved straight off somebody else's opening, whether the three of
// them ever struck as one. Nothing here is inferred and nothing is invented.
function freshDeeds() {
  return {
    finisher: null,      // who landed the killing blow — a PERSON, or nobody
    lastHit: null,       // …tracked continuously, because the kill is not announced
    // A PAIR CARD IS NOT A PERSON. Its owner id is 'ash|elin', and it used to
    // go into `finisher` exactly as a hero's would — so THE LAST BLOW handed
    // the reckoning a cast naming somebody who does not exist and the hand-off
    // died reading a name off nothing: the fight over, the conversation never
    // opening, the road holding a board with no way out of it. Eight soak runs
    // never saw it; sixteen did, twice. When the two of them ended it together
    // that is what these say, and `finisher` stays null.
    lastPair: null,
    finishPair: null,
    shields: [],         // [{by, for}] — an intercession that actually took a blow
    stitches: {},        // pairKey → how many times one moved off the other
    brink: [],           // heroes who dropped to a quarter of their health or less
    fell: [],            // heroes who went down, in a fight that was still won
    asOne: 0,            // all-outs thrown
    untouched: true,     // nobody took a single point of damage
    // WHERE THE PARTY'S HEALTH WENT. A blow can be read and turned aside; the
    // dirge cannot be answered by timing at all, only by Guard and healing. If
    // most of a losing party's health went to the half nobody can parry, then
    // "get better at parrying" is advice the game does not honour.
    tookHit: 0,          // damage that arrived through a readable string
    tookDirge: 0,        // …and damage that no hand could have stopped
  };
}
const deedPair = (a, b) => [a, b].sort().join('|');
// A QUARTER LEFT OR LESS, once, at any point — not "ended the fight low". A
// hero who was one blow from the floor in turn two and got mended back up was
// still one blow from the floor, and that is the thing worth talking about.
function markBrink(id) {
  if (!C || !C.deeds) return;
  const h = C.heroes[id]; if (!h) return;
  if (h.hp > 0 && h.hp <= Math.ceil(h.max * 0.25)) {
    if (C.deeds.brink.indexOf(id) < 0) C.deeds.brink.push(id);
  }
  if (h.hp === 0 && C.deeds.fell.indexOf(id) < 0) C.deeds.fell.push(id);
}

function freshTurnState() {
  return { actionsPlayed: [], moved: 0, cycled: false, stitchedPairs: [], refunded: 0 };
}

// WHICH FIGHT THIS IS, counted from the top. Declared here rather than beside
// the animation that reads it, because `startCombat` stamps it and `let` has no
// hoisted initialisation — the first fight of a session threw on a temporal
// dead zone when this sat 3200 lines further down.
let _combatSeq = 0;
function startCombat(opts) {
  opts = opts || {};
  if (opts.seed != null) setSeed(opts.seed);
  // THE ALL-OUT IS THE TEAM ATTACK THAT DEVELOPS. The run can raise it, and it
  // has to be restored on every fresh fight or a spent run leaks into the next.
  TUNE.alloutDmg = ALLOUT_BASE.dmg; TUNE.alloutBrk = ALLOUT_BASE.brk;
  if (opts.allout) { TUNE.alloutDmg = opts.allout.dmg; TUNE.alloutBrk = opts.allout.brk; }
  _camPoseCur = null; camHome();          // a fresh fight re-composes the shot
  // …AND A FRESH FOE IS NOT ALREADY DEAD. `k-foe-down` is a terminal pose and
  // nothing was clearing it, so the fight after a win opened with the new foe
  // lying on the floor at 27 degrees. Two checks caught it on the same run the
  // pose was written — the one that asserts a foe stands down for the player's
  // turn, and the one that asserts a fresh board has no corpse on it.
  const _bossBox = el('k-boss-art');
  if (_bossBox) _bossBox.classList.remove('k-foe-down');
  const foe = opts.foe || FOES.mourner;
  const carry = opts.partyHp || null;     // a run carries its wounds between fights
  // TWO THINGS THE AWAKENING CAN CHANGE. The run→engine seam is deliberately
  // narrow, so these are named for what they are rather than passed as a bag
  // of modifiers: `vigor` is max HP the party woke up with, `foeBonus` is HP
  // this particular foe woke up with. Both default to nothing.
  const vigor = Math.max(0, opts.vigor || 0);
  // …and a third: `apBonus` is base AP the party woke up with, which is the
  // campfire's route into the turn. Same narrow seam, same shape — a named
  // number, not a bag of modifiers.
  const apBase = Math.min(AP_CEILING, AP_PER_TURN + Math.max(0, opts.apBonus || 0));
  const hero = (id) => {
    const max = HEROES23[id].maxHp + vigor;
    return { row: HEROES23[id].row0,
             hp: carry && carry[id] != null ? Math.max(0, Math.min(max, carry[id])) : max,
             max, guard: 0, downed: false };
  };
  C = {
    phase: 'INTRO',
    // WHICH FIGHT THIS IS. Build 94 stopped awaiting the end-of-turn hand
    // sweep so it could play under the foe drawing breath, and that turned an
    // animation into something that can OUTLIVE its own combat: `fxSweepHand`
    // reads the global `C`, so a sweep still in flight when the next
    // startCombat lands was splicing the NEXT fight's hand into the next
    // fight's discard. The determinism check found it within one build — two
    // runs of the same seed diverged on the fourth intent — which is exactly
    // the kind of bug that is unfindable by hand and trivial with a fixed seed.
    id: (_combatSeq = (_combatSeq || 0) + 1),
    turn: 1,
    foe,
    cards: buildCards(opts.upgrades),
    upgrades: (opts.upgrades || []).slice(),
    intents: foeIntents(foe),
    onEnd: opts.onEnd || null,
    heroes: { ash: hero('ash'), elin: hero('elin'), mira: hero('mira') },
    boss: {
      name: foe.name, hp: foeHp(foe) + Math.max(0, opts.foeBonus || 0),
      max: foeHp(foe) + Math.max(0, opts.foeBonus || 0), phase: 1,
      breakMax: foe.brk, brk: foe.brk, broken: false, cancelNext: false,
      bleed: 0, chill: 0, intentIx: 0, _healedRecently: false,
    },
    // WHAT THE THREE OF THEM ALREADY HAVE. A bond does not reset because a
    // fight ended — and mechanically it could not be allowed to, because a
    // four-round fodder fight never fills the bar from zero. The all-out was
    // therefore something that happened twice a run, against the elite and the
    // Regent, which made Crescendo — the most expensive node in the tree and
    // the premise's "team attacks that develop over time" — an upgrade to a
    // button you press twice.
    kizuna: Math.max(0, Math.min(KIZUNA_MAX, opts.kizuna || 0)), allOuts: 0,
    // WHAT THE THREE OF THEM BUILT IN THIS FIGHT, per pair. Fed by the things
    // they actually did for each other — a follow-up, a blow taken for someone.
    pairBond: { 'ash|elin': 0, 'ash|mira': 0, 'elin|mira': 0 },
    deeds: freshDeeds(),
    roster: opts.roster && rosterValid(opts.roster) ? JSON.parse(JSON.stringify(opts.roster)) : baseRoster(),
    deck: [], hand: [], discard: [], exhausted: [],
    ap: apBase, apMax: apBase,
    turnState: freshTurnState(),
    // WHAT THE BOND CHANGED about the cards this party carries. Copied in, so
    // a fight can never write a mark back onto the run.
    sigils: Object.assign({}, opts.sigils || {}),
    bond: { stitches: 0, generated: false },   // the authored Ash+Elin pair
    counterstance: false,       // Ash: next successful parry this round deals +2 Break
    intercession: null,         // Elin will take this ally's parry window next enemy action
    pendingDiscard: false,      // Quick Throw: draw 1, THEN discard 1
    telemetry: { plays: [], parry: [] },
    log: [],
  };
  C.deck = shuffle(rosterIds(C.roster));
  for (const id of Object.keys(C.heroes)) if (C.heroes[id].hp <= 0) C.heroes[id].downed = true;
  // A FIGHT IS AN ENTRANCE. The battle theme restarts from its downbeat rather
  // than resuming, and it is ducked under the effects because the parry's own
  // sounds and the numbers are what the player is reading. Cueing here as well
  // as from the run layer's screen change is deliberate and free: re-cueing a
  // track that is already foreground is a no-op, and it means the standalone
  // combat page (no run layer at all) still has music.
  try { MUSIC.play(MUSIC_SRC.combat, 0.42, false); } catch (_) {}
  dressEncounter(foe);
  drawOpening();
  setPhase('PLAYER_READY');
  renderAll();
  return C;
}

// The fight wears its opponent. One <img> swap and one name — everything else
// about the encounter already lives in the state the HUD reads.
function dressEncounter(foe) {
  const art = document.querySelector('#k-boss-art img');
  if (art) { art.src = '../art/' + foe.art + '.webp'; art.alt = foe.name; }
  // WHICH FOE THIS IS, on the element, so the stylesheet can give each one its
  // own idle. Five opponents sharing a single slow breathe made them five
  // pictures at different HP totals.
  const b = el('k-boss-art'); if (b) b.dataset.foe = foe.id;
  foeAnimArm(foe.id);
  const nm = document.querySelector('#k-boss-hud .k-bname');
  if (nm && nm.childNodes[0]) nm.childNodes[0].nodeValue = foe.name + ' ';
  const st = el('k-stage');
  if (st) st.dataset.tier = foe.tier;
}

// Opening hand: 5 cards with AT LEAST ONE per hero (deck §3). Draw five, then
// repair coverage deterministically — swap a surplus card for the first card
// of each missing hero still in the deck.
function drawOpening() {
  // …and she does not always open the same way either
  C.boss.intentIx = pickIntent();
  for (let i = 0; i < 5; i++) drawOne();
  for (const heroId of Object.keys(HEROES23)) {
    if (C.hand.some(id => cardDef(id).owner === heroId)) continue;
    const inDeck = C.deck.findIndex(id => cardDef(id).owner === heroId);
    if (inDeck < 0) continue;
    const counts = {};
    C.hand.forEach(id => { const o = cardDef(id).owner; counts[o] = (counts[o] || 0) + 1; });
    const surplus = C.hand.findIndex(id => counts[cardDef(id).owner] > 1);
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
  C.intents.forEach((it, i) => {
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
  if (total <= 0) return (cur + 1) % C.intents.length;
  let r = rng() * total;
  for (const p of pool) { r -= p.w; if (r <= 0) {
    C.boss._healedRecently = C.intents[p.i].kind === 'heal';
    return p.i; } }
  return pool[pool.length - 1].i;
}
function currentIntent() {
  const it = C.intents[C.boss.intentIx % C.intents.length];
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
function hitDamage(hit, chillLeft, asRow) {
  const raw = Math.round(hit.dmg[C.boss.phase - 1] * TUNE.dmgScale * (C.foe ? C.foe.dmgMul : 1));
  const tgt = hitTargetId(hit);
  let d = raw;
  // `asRow` prices the same blow as if the target stood somewhere else — the
  // telegraph uses it to say what stepping back would actually cost, in damage
  // rather than in a percentage.
  // A sweep loses its edge with distance: full weight at the front, most of it
  // blunted at the back. `sweep` replaces the old backFactor on/off shelter.
  const inRow = asRow || (tgt && C.heroes[tgt] ? C.heroes[tgt].row : null);
  if (hit.sweep && inRow) d = Math.ceil(raw * (ROW_SHELTER[inRow] != null
    ? ROW_SHELTER[inRow] : 1));
  return Math.max(0, d - (chillLeft || 0));
}
// The dirge: unparryable chip on every living hero, each enemy phase.
function dirgeAmount() {
  if (C.foe && C.foe.dirge != null) return C.foe.dirge;
  return TUNE.dirge[C.boss.phase - 1] || 0;
}

// The primary target — who the banner names, and who the camera watches.
function intentTargetId() {
  const it = C.intents[C.boss.intentIx % C.intents.length];
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
// WHO IS ABOUT TO BE HIT, AND FOR HOW MUCH EACH. Not a total.
//
// The chip used to read `⚔ 21 ×3 [Ash's face]`: the volley TOTAL, the hit
// count, and the FIRST hit's target. Ashen Rain reads that way while actually
// dealing 7 to each of the three; the Ruinous Hymn reads `24 ×3 [Ash]` while
// Ash takes 16 and Elin takes 8 — and Elin's player is given no sign they are
// targeted at all.
//
// Worse, the player's own cards use the opposite grammar for the same shapes:
// Twin Fang's face says "4 damage ×2", meaning four PER HIT. Two meanings for
// one visual convention, on one screen. A player trained on either reading
// mis-sizes every Guard, every Mend and every step backwards.
function intentByTarget() {
  const it = currentIntent();
  if (!it.hits || !it.hits.length) return [];
  let chill = C.boss.chill;
  const rows = [];
  for (const h of it.hits) {
    const d = hitDamage(h, chill); chill = 0;
    const who = hitTargetId(h);
    if (!who) continue;
    const row = rows.find(r => r.who === who);
    // A SWEEP IS A DIFFERENT KIND OF BLOW AND THE TELEGRAPH NEVER SAID SO.
    // Standing back turns the Scything Advance from 26-34 into 8-12 — the best
    // single AP a player can spend anywhere in the game — and the chip showed
    // it as an ordinary number, so the lane was a decision nobody knew they
    // were being offered.
    // …and what the SAME blows would cost one row further back, computed the
    // way the engine computes them rather than as a percentage off the top. A
    // ratio is an estimate; this deck's rule is that the screen shows the
    // number that will actually land.
    const back = ROWS[Math.min(ROWS.length - 1, ROWS.indexOf(C.heroes[who].row) + 1)];
    const dBack = h.sweep ? hitDamage(h, chill, back) : d;
    // …AND WHAT THE BLOW ACTUALLY IS. The chip used one glyph for every strike
    // and a second for sweeps, so a bell, a claw and a cast all read the same
    // — the exact complaint that a telegraph does not match the attack. The
    // acts of a hit ride along so each blow can be marked as what it is.
    const acts = (h.acts || []).filter(a => {
      const k = parseAct(a).def.note;
      return k !== 'feint' && k !== 'bait';      // the fakes are not blows
    });
    if (row) { row.total += d; row.back += dBack; row.hits.push(d);
               row.acts = (row.acts || []).concat(acts);
               row.sweep = row.sweep || !!h.sweep; }
    else rows.push({ who, total: d, back: dBack, hits: [d], acts,
                     sweep: !!h.sweep });
  }
  return rows;
}

// ═════════════════════════════════════════════════════════════════════════════
// THE EVALUATOR — deterministic, and the ONLY copy of this logic.
// ═════════════════════════════════════════════════════════════════════════════
// ═════════════════════════════════════════════════════════════════════════════
// SIGILS — what a bond changes about a card you already carry
// ═════════════════════════════════════════════════════════════════════════════
// The deck's combo layer asks cards to be played in an order: FOLLOW_UP wants
// a different hero to have just acted, FINALE wants all three. In a five-card
// hand drawn from fifteen that is a demanding ask, and the honest complaint
// about it is that cards are hard to CONNECT — you hold the right two and the
// turn never lines them up.
//
// A sigil is a mark on ONE card in the roster that changes how it plays rather
// than what it does — Balatro's glass and gold, Slay the Spire's retain — and
// three of the five exist specifically to make the combo layer reachable. They
// are earned by the bond, so the mechanical answer to "these do not connect"
// is the same as the fictional one: they have not been together long enough.
//
// One per card, no stacking. The deck does not grow and neither does this.
// EVERY MARK IS A PROMISE AND, WHERE IT HAS ONE, A PRICE — in that order, in
// two sentences, never in one sentence with an em-dash apology hanging off it.
// The old set mixed three voices in five lines: `held` described the card
// ("Stays in hand"), `opening` described its own rules text ("Its combo counts
// if…"), and `kindled` addressed nobody. They read as errata. They are written
// to the player now, they lead with what they buy, and the two that cost
// something say so in a second sentence where a cost can actually be read.
//
// RETAIN'S PRICE IS REAL and has to survive the rewrite. The next turn draws back
// up to five, so a card you keep is a card you do not draw — measured, a bot
// placing it without choosing lost 1.7 points of completion with it.
const SIGILS = {
  // THE MARKS, NAMED AS KEYWORDS. They were Held / Echo / Opening / Kindled /
  // Bright — plain adjectives that described a feeling rather than a rule, and
  // a player meeting "Bright" mid-fight had to remember what it did rather
  // than read it. These are keywords: a verb or a noun that IS the rule, in the
  // register a deckbuilder's player already reads fluently.
  retain: { name: 'Retain', glyph: 'guard',
            line: 'Keep it when the turn ends. You draw one fewer to make room.' },
  // CHAIN IS THE MIRROR OF LEAD, and it used to point the wrong way. As RELAY
  // it set a flag for the card played AFTER it — so the card wearing the mark
  // did nothing for itself, and the player had to hold "the next thing I play
  // gets this" in their head across a decision. The benefit belongs on the
  // card that carries the mark. Lead the turn, or follow an ally: two halves
  // of one axis, and the same sentence shape.
  chain:  { name: 'Chain',  glyph: 'follow',
            line: 'Play it after an ally and its combo is already live.' },
  lead:   { name: 'Lead',   glyph: 'move',
            line: 'Lead the turn with it and its combo is already live.' },
  rally:  { name: 'Rally',  glyph: 'finale',
            line: 'They feel it every time it is played. The bond grows by 6.' },
  // SURGE SAYS THE HALF THE MARK OWNS, and lets EXHAUST say the rest. "Pyre"
  // had to carry both "stronger" and "one use only" in one word and carried
  // neither; the card face already prints EXHAUST, so the pair reads correctly
  // side by side.
  surge:  { name: 'Surge',  glyph: 'atk',
            line: 'Half again as strong. It burns out and leaves the fight.' },
};

const SIGIL_KZ = 6;
const sigilOf = (cardId) => (C && C.sigils ? C.sigils[cardId] : null) || null;
// SURGE scales the numbers a card actually deals, and nothing else. It walks
// the atoms rather than a whitelist of keys, so a card that grows a new number
// later is covered without anyone remembering to come back here — but `true`
// flags (intercede, drawDiscard) are not quantities and must not be touched.
const SURGE_MULT = 1.5;
function brighten(effects) {
  return effects.map(fx => {
    const out = {};
    for (const k of Object.keys(fx)) {
      out[k] = (typeof fx[k] === 'number') ? Math.ceil(fx[k] * SURGE_MULT) : fx[k];
    }
    return out;
  });
}

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
    // A FIFTH KEYWORD WAS DESIGNED HERE AND CUT. `SAME_HERO` — "this hero has
    // already acted, hit again with them" — is the one condition in the deck's
    // vocabulary that CANNOT be true at the same time as FOLLOW_UP or FINALE,
    // so a hand carrying both would have a genuine fork in it rather than one
    // ordering with one right answer.
    //
    // It is not here because the suite said no. `LOAD` budgets this deck at
    // four distinct keywords, and that budget is not a guess: Build 25 measured
    // nine conditional cards out of fifteen and walked it back to six because
    // every turn had become a reading exercise. A fifth keyword is the most
    // expensive kind of card change there is — it is vocabulary, paid once by
    // every player, forever — and it does not belong in the same build as a
    // retimed enemy turn and three new AP rules. It is worth doing on its own,
    // against its own measurement of what it costs to read.
    default: return false;
  }
}
function evaluateCard(cardId) {
  const card = cardDef(cardId);
  if (!card) return null;
  const sigil = sigilOf(cardId);
  let condActive = card.cond ? evalCondition(card.cond.type, card.owner) : false;
  // A SIGIL CAN OPEN A CONDITION THE BOARD DID NOT. Both routes are read here
  // rather than inside evalCondition, which stays a pure function of the
  // condition type — a sigil is a fact about one card, not about the rule.
  if (card.cond && !condActive) {
    const ts = C.turnState;
    // OPENING: the turn's first card has nobody to follow, which is exactly
    // the hand a FOLLOW_UP card is stranded in.
    // LEAD: the turn's first card has nobody to follow, which is exactly the
    // hand a FOLLOW_UP card is stranded in.
    if (sigil === 'lead' && !ts.actionsPlayed.length) condActive = true;
    // CHAIN: an ally has already acted, so whatever this card's combo asked
    // for, following counts. It opens the condition the card ALREADY HAS
    // rather than granting a fixed bonus — so it is worth putting on a FINALE
    // you cannot reach, or a BACK_ROW you are out of position for, and it is
    // worth nothing on a card with no combo at all. That is the decision.
    else if (sigil === 'chain') {
      const last = ts.actionsPlayed[ts.actionsPlayed.length - 1];
      if (last && last.ownerId !== primaryHero(card)) condActive = true;
    }
  }
  // A conditional card gets a cost reduction OR increased output OR its AP
  // back — never more than one. Costs never fall below 1 (deck §3), which is
  // why no sigil touches cost: almost every card in the deck costs 1, so a
  // discount sigil would be dead on arrival against that floor.
  //
  // THE REFUND IS THE THIRD REWARD, and it exists because of that same floor.
  // A 1-cost card cannot be discounted, so for most of the deck `reward:'cost'`
  // is unreachable and the only combo payoff available was a bigger number.
  // Bigger numbers do not change what a turn IS. A refund does: order the turn
  // correctly and the turn gets longer, which is the thing a deckbuilder is
  // actually for and the feeling this game did not have. It is bounded by the
  // conditions themselves — FOLLOW_UP and FINALE both require somebody ELSE to
  // have acted, so no card can refund itself in a loop.
  const currentCost = Math.max(1,
    (condActive && card.cond.reward === 'cost') ? card.cond.costTo : card.cost);
  let resolvedEffects = (condActive && card.cond.reward === 'output')
    ? [...card.base, ...card.cond.bonus] : card.base.slice();
  if (sigil === 'surge') resolvedEffects = brighten(resolvedEffects);
  // ONE REFUND A TURN, AND THE SIM IS WHY.
  //
  // The AP ladder was measured arm by arm against the ~half-parry band, and it
  // came back the opposite way round from the argument that built it: the
  // ALL-OUT'S GEAR — the rung this build argues hardest for — is worth ONE
  // point of winrate (59% -> 60%), because a bot rarely fills the bar twice and
  // the gear arrives late in an eight-round fight. The two combo REFUNDS, the
  // small quiet change, are worth SIXTEEN (59% -> 75%).
  //
  // Uncapped, two refund cards in one hand is two free cards, and FOLLOW_UP is
  // satisfied by simply not leading with them — so the ceiling on a good turn
  // was five cards, not four. Capped at one, the refund stays the thing that
  // makes a three-hero line affordable and stops being a way to play the whole
  // hand. It is also a better rule to READ than a rate: "the first one comes
  // back" is a sentence; "sometimes you get two" is a spreadsheet.
  const refund = (condActive && card.cond.reward === 'ap' && !C.turnState.refunded)
    ? (card.cond.ap || 1) : 0;
  return { cardId, card, condActive, currentCost, resolvedEffects, sigil, refund,
           exhaust: !!card.exhaust || sigil === 'surge' };
}

// ═════════════════════════════════════════════════════════════════════════════
// RESOLUTION
// ═════════════════════════════════════════════════════════════════════════════
function dealToBoss(n, why, who) {
  if (C.boss.broken) n = Math.round(n * 1.25);   // BROKEN: +25% damage taken
  // WHO SWUNG LAST. Recorded on every blow rather than at the kill, because
  // nothing tells this function that the blow it is applying is the last one.
  // …and a PAIR CARD IS NOT A PERSON: its owner id is 'ash|elin'. The ledger
  // records a person or nobody; the pair key goes in its own field. (See
  // freshDeeds for what this crash looked like from the road.)
  const solo = who && who.indexOf('|') < 0 ? who : null;
  if (C.deeds && who) {
    if (solo) C.deeds.lastHit = solo; else C.deeds.lastPair = who;
  }
  C.boss.hp = Math.max(0, C.boss.hp - n);
  if (why !== 'allout') kizunaGain(n * KIZUNA_PER_DAMAGE);   // the all-out cannot feed itself
  if (_dmgBatch) { _dmgBatch.n += n; if (why) _dmgBatch.why = why; fxStrikeBoss(n, why); }
  else fxDamageBoss(n, why);
  renderBossHud();          // the Regent's bar moves when she is hit, not later
  checkBossPhase();
  if (C.boss.hp <= 0) {
    if (C.deeds && !C.deeds.finisher && !C.deeds.finishPair) {
      C.deeds.finisher = solo || C.deeds.lastHit || null;
      if (!C.deeds.finisher) C.deeds.finishPair = who || C.deeds.lastPair || null;
    }
    setPhase('VICTORY');
  }
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
  // ANOTHER GEAR. Raised here, before the strike, so the pip is already lit
  // when the camera comes back — and `C.ap` is raised with it rather than
  // waiting for the refill, because an all-out is not usually the last thing
  // you want to do in a turn.
  const gearedUp = TUNE.alloutAp > 0 && C.apMax < AP_CEILING;
  if (gearedUp) {
    const was = C.apMax;
    C.apMax = Math.min(AP_CEILING, C.apMax + TUNE.alloutAp);
    C.ap += C.apMax - was;
  }
  // THREE AS ONE PAYS ALL THREE.
  //
  // The bond used to be paid for entirely by fight LENGTH: stitches accrue once
  // per pair per turn, so a player who won in four turns banked two thirds of
  // what a player who won in six did. pace.sim measured the result going
  // exactly the wrong way — 0.93 / 0.50 / 0.29 cards won per run as the bot's
  // parry rate rose from 45% to 92%. The game's whole thesis, three people
  // becoming more capable together, was starved by playing well.
  //
  // The all-out is the fix because it is the one thing on this board that skill
  // makes MORE frequent: kizuna charges from turned strings, so a sharp parry
  // is what brings it round. And it is literally all three of them landing at
  // once — if any single moment in this game should deepen a bond, it is this
  // one. Every LIVING pair is paid, so a party down to two still earns, and a
  // hero who is down does not bank a bond they were not present for.
  for (let i = 0; i < living.length; i++) {
    for (let j = i + 1; j < living.length; j++) {
      const k = [living[i], living[j]].sort().join('|');
      C.pairBond[k] = (C.pairBond[k] || 0) + BOND_PER_ALLOUT;
    }
  }
  if (C.deeds) C.deeds.asOne++;
  sfx('allout', 1.5);
  setPhase('PLAYER_ACTION_RESOLVING');
  renderKizuna();
  await fxAllOut(living);
  const each = Math.round(TUNE.alloutDmg / 3);
  for (const id of living) {
    if (C.phase === 'VICTORY') break;
    dealToBoss(each, 'allout', id);
    await sleep(150);
  }
  breakDamage(TUNE.alloutBrk);
  logLine('ALL-OUT — ' + living.length + ' as one.'
    + (gearedUp ? ' They find another gear: +' + TUNE.alloutAp + ' AP for the rest of this.' : ''));
  if (gearedUp) fxApGear();
  if (C.phase !== 'VICTORY') setPhase('PLAYER_READY');
  renderAll();
  return true;
}
// WHAT DYING LOOKS LIKE. The foe reels on its broken frames — the ones that
// already exist for a stagger — and then goes over and stays there. Two
// separate things on purpose: the reel is the hit registering, the fall is the
// fight ending, and running them together read as a glitch rather than a death.
function fxFoeDown() {
  const box = el('k-boss-art');
  if (!box) return;
  // THE POSE IT DIES IN IS THE POSE IT KEEPS. Not `foeAnimState('broken')` —
  // that starts the stagger loop at frame 0 and leaves it running, which is
  // what had the body pulsing on the ground. The frames are walked to the LAST
  // one of the broken run and then frozen, so the CSS fall lands a still shape
  // rather than a twitching one.
  try { foeAnimKill('broken'); } catch (e) {}
  box.classList.remove('k-foe-down');
  void box.offsetWidth;
  box.classList.add('k-foe-down');
}
// Freeze the sheet on the final frame of `name` and refuse every later state
// change. `foeAnimArm` builds a fresh `_fanim` per fight, so the flag cannot
// outlive the corpse that earned it.
function foeAnimKill(name) {
  const a = _fanim; if (!a) return;
  const st = a.sheet.states[name];
  if (st && st.length) { a.state = name; a.frame = st.length - 1; a.dir = 0; }
  a.dead = true;
  clearTimeout(_fanimBack); _fanimBack = null; a.resume = null;
  foeAnimPaint();
}

function checkBossPhase() {
  if (C.foe && C.foe.phases < 2) return;
  if (C.boss.phase === 1 && C.boss.hp <= C.boss.max / 2 && C.boss.hp > 0) {
    C.boss.phase = 2;
    logLine(C.boss.name + ' rises — the dirge sharpens.');
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
  if (C && C.phase !== 'PLAYER_ACTION_RESOLVING') setTimeout(renderPartyHud, 0);
  const h = C.heroes[heroId];
  if (h && !h.downed) { h.guard += n; if (typeof fxWard === 'function') fxWard(heroId, n); }
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
    if (fx.dmg)        dealToBoss(fx.dmg, 'hit', ownerId);
    if (fx.brk)        breakDamage(fx.brk);
    if (fx.guardSelf)  guardHero(ownerId, fx.guardSelf);
    if (fx.guardAlly && allyId) guardHero(allyId, fx.guardAlly);
    if (fx.guardAll)   livingHeroes().forEach(id => guardHero(id, fx.guardAll));
    if (fx.guardLowest){ const low = livingHeroes().sort((a, b) => C.heroes[a].hp - C.heroes[b].hp)[0];
                         if (low) guardHero(low, fx.guardLowest); }
    if (fx.heal)       { const m = livingHeroes().sort((a, b) =>
        (C.heroes[b].max - C.heroes[b].hp) - (C.heroes[a].max - C.heroes[a].hp))[0];
      if (m) { const was = C.heroes[m].hp;
        C.heroes[m].hp = Math.min(C.heroes[m].max, C.heroes[m].hp + fx.heal);
        fxHeal(m, C.heroes[m].hp - was); } }
    if (fx.healAll)    livingHeroes().forEach(id => {
      const was = C.heroes[id].hp;
      C.heroes[id].hp = Math.min(C.heroes[id].max, C.heroes[id].hp + fx.healAll);
      fxHeal(id, C.heroes[id].hp - was); });
    if (fx.bleed)      C.boss.bleed += fx.bleed;
    if (fx.chill)      C.boss.chill += fx.chill;
    if (fx.counterstance) C.counterstance = true;
    if (fx.intercede && allyId) {
      C.intercession = allyId;
      // STEPPING INTO A BLOW MEANT FOR SOMEONE ELSE. The largest single thing
      // one of them can do for another, and the bond is paid for it.
      if (allyId !== ownerId) {
        const k = [ownerId, allyId].sort().join('|');
        C.pairBond[k] = (C.pairBond[k] || 0) + BOND_PER_SHIELD;
      }
    }
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
  // A PAIR CARD NEEDS BOTH VOICES. One of them on the ground and it cannot be
  // played at all — which is the cost of a card two people own.
  if (ownerDown(ev.card)) return false;               // the fallen play nothing
  if (C.ap < ev.currentCost) return false;
  if (ev.card.target === 'ally' && !allyId) allyId = defaultAlly(owner);
  setPhase('PLAYER_ACTION_RESOLVING');
  C.ap -= ev.currentCost;
  // THE REFUND LANDS BEFORE THE CARD RESOLVES, so the AP row lights back up on
  // the same frame the card leaves the hand — a refund the player only notices
  // two cards later is a rule they have to be told rather than one they see.
  if (ev.refund) { C.ap += ev.refund; C.turnState.refunded++; fxApRefund(ev.refund); }
  // the ghost leaves from where the card actually sat, so it must be measured
  // BEFORE the hand re-renders
  if (ev.exhaust) fxExhaust(cardId); else flyFromHand(cardId, 'discard');
  C.hand.splice(C.hand.indexOf(cardId), 1);
  (ev.exhaust ? C.exhausted : C.discard).push(cardId);   // Resonance and Bright Exhaust

  // BOND STITCH (deck §8): playing right after a DIFFERENT hero is a
  // Follow-Up, and stitches that pair — max 1 per pair per phase. Two
  // stitches generate the pair's Resonance card directly into hand, once
  // per encounter (the card Exhausts; the climax is authored, not cyclic).
  const prev = C.turnState.actionsPlayed[C.turnState.actionsPlayed.length - 1];
  if (prev && prev.ownerId !== owner && owner !== 'bond' && prev.ownerId !== 'bond') {
    const pairKey = [prev.ownerId, owner].sort().join('|');
    // EVERY PAIR EARNS, not only the authored one. This key was already being
    // computed for all three pairs and then thrown away for two of them — the
    // social layer is this gate being opened, not a new system. Combat itself
    // is unchanged: the in-fight Resonance is still the ash|elin climax alone.
    // These points only leave the fight in the summary.
    // ONE STITCH PER PAIR PER TURN — AND IT HAS TO BE ONE LIST. The cap was
    // written into `stitchedPairs`, and the only line that ever PUSHED to it
    // lived inside the Resonance branch below. So the cap held for exactly one
    // case: ash|elin, before the Resonance card had been generated. ash|mira
    // and elin|mira were never recorded at all and were paid on every adjacency
    // in a turn; ash|elin went uncapped for the rest of the fight the moment
    // Light Through Steel took shape. Measured: elin|mira 2 → 4 across two
    // adjacencies in one turn, ash|elin 2 → 6 across four.
    //
    // That is Build 62's defect back in the building — a bond paid by fight
    // LENGTH — and it inverts the deck's own incentive, because ping-ponging
    // two heroes out-earned spreading across three, which is the opposite of
    // what FINALE asks for. The record is written once, here, and the
    // Resonance branch reads the same answer instead of keeping its own.
    const fresh = !C.turnState.stitchedPairs.includes(pairKey);
    if (fresh) {
      C.turnState.stitchedPairs.push(pairKey);
      C.pairBond[pairKey] = (C.pairBond[pairKey] || 0) + BOND_PER_STITCH;
      if (C.deeds) C.deeds.stitches[pairKey] = (C.deeds.stitches[pairKey] || 0) + 1;
    }
    if (fresh && pairKey === RESONANCE_PAIR.slice().sort().join('|')
        && !C.bond.generated) {
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

  // THE ACTION IS DECLARED BEFORE IT RESOLVES, so a spell's ring is on screen
  // before its damage lands — which is the whole difference between a spell
  // and a punch. fxPlayCard runs after resolution and cannot do this.
  _act = { kind: actionKind(ev.card, ev.resolvedEffects), tone: castTone(ev.resolvedEffects),
           heavy: primaryHero(ev.card) === 'ash' };
  _slashN = 0;
  const actor = document.querySelector('.k-hero[data-hero="' + primaryHero(ev.card) + '"]');
  if (actor) { actor.classList.remove('k-acts'); void actor.offsetWidth; actor.classList.add('k-acts'); }
  if (_act.kind === 'cast' || _act.kind === 'heal') {
    fxCast(primaryHero(ev.card), _act.tone,
           ev.card.target === 'enemy' ? document.getElementById('k-boss-art') : null);
  }
  try { resolveEffects(ev.resolvedEffects, owner, allyId); } finally { _act = null; }
  C.turnState.actionsPlayed.push({ cardId, ownerId: owner, condActive: ev.condActive });
  // RALLY pays the bond. CHAIN needs no hand-off: it reads the turn
  // it is written after this card's own condition has already been read.
  if (ev.sigil === 'rally') kizunaGain(SIGIL_KZ);
  C.telemetry.plays.push({ t: C.turn, cardId, cost: ev.currentCost, cond: ev.condActive,
                           sigil: ev.sigil || null });
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
  logLine('Cycled ' + cardDef(cardId).name + '.');
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
// WHAT A BOND IS PAID FOR. Both are things the pair DID for each other, not
// things that merely happened near them.
const BOND_PER_STITCH = 2;      // one hero acting straight after the other
const BOND_PER_SHIELD = 3;      // Elin stepping into a blow meant for someone else
// …and three of them striking as one, which is the only one of the three that
// SKILL makes more frequent rather than less. See allOut().
const BOND_PER_ALLOUT = 4;
const KIZUNA_MAX = 100;
// WHAT THE ALL-OUT LEAVES BEHIND. Until now it was a damage spike and nothing
// else: the bar filled, three of them hit at once, the bar emptied, and the
// party was in exactly the state it had been in a second earlier. For a game
// whose premise is "team attacks that DEVELOP over time" that is a firework,
// not a development.
//
// So it raises the party's ceiling for the rest of the fight — one more AP per
// turn, every turn, permanently until the fight ends. It is the right shape for
// three reasons the board can already prove:
//
//   · It is EARNED BY SKILL. Kizuna charges from turned strings, so a clean bar
//     buys a bigger turn. Before this, a perfect parry bought survival and
//     nothing else — the reward for playing the hardest system in the game well
//     was that less went wrong.
//   · It COMPOUNDS. More AP is more cards is more damage is more kizuna, so the
//     second all-out arrives sooner than the first. That rising curve is what a
//     Slay the Spire run has and this one did not.
//   · It is legible in one glance, because AP is already a row of marks: a
//     fourth mark appears and stays.
//
// Capped so a long fight cannot run away with it, and it is per-FIGHT —
// `apMax` is rebuilt by startCombat, so nothing leaks onto the road.
//
// THE CEILING IS THE CEILING, HOWEVER YOU REACH IT. A party carrying RESOLVE
// from the campfire opens at 4, so their FIRST all-out takes them to 5 and
// their second gears them not at all; a party without it opens at 3 and gets
// two. That is deliberate and it is visible — the pips simply stop appearing —
// and it means the road's rung and the fight's rung are two routes to the same
// place rather than two things that stack into a turn nobody balanced.
const AP_CEILING = 5;
// THE ALL-OUT HAS TO BE REACHABLE. A player reported it "broken and doesn't do
// anything", and both paths into it — the API and a real touch on the bar —
// fire correctly. What was broken was the ARITHMETIC: at 1/3 per damage and 8
// per turned string, a whole fight against a 76 HP foe charges roughly 50, half
// of which survives to the next stop. The run sim measured the result exactly:
// **1.02 all-outs per ROAD** — about one per six-stop run. The bar sat at 79,
// 80, 81% in every screenshot the player sent, which is what "broken" means
// from the other side of the screen: the payoff mechanic dangles just short
// forever and the button is never live.
//
// The premise is a team attack that DEVELOPS over a run, not one that fires
// once at the end of it. Retuned so an engaged party earns one roughly every
// other stop, and measured rather than estimated.
const KIZUNA_PER_DAMAGE = 0.45;       // a 15-damage FINALE is worth ~7
const KIZUNA_TURNED = 10;             // a whole string read clean
const KIZUNA_FLAWLESS = 17;
const ROWS = ['front', 'mid', 'back'];
// One character per row, and the same three the floor is painted with — the
// telegraph names a PLACE rather than a person now (see renderIntent).
const ROW_LETTER = { front: 'F', mid: 'M', back: 'B' };
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
  //
  // IT IS NOT AWAITED. The sweep costs 0.78s of an enemy turn measured at 7.95s,
  // and nothing in the enemy phase reads the hand — the telegraph, the wind-up
  // and the whole parry bar run against the board, not the cards. So the sweep
  // now plays UNDER the foe drawing breath, which is where a player is looking
  // anyway, and the turn stops paying for it twice. It is still awaited before
  // the draw, because a card cannot fly out of a pile it has not landed in yet.
  let sweeping = null;
  if (HAND_SWEEP && C.hand.length) {
    setPhase('HAND_DISCARDING');
    sweeping = fxSweepHand();
  }

  // Broken expires here: the meter refills. (The pending cancel still
  // consumes the next enemy action.)
  if (C.boss.broken) {
    C.boss.broken = false;
    C.boss.brk = C.boss.breakMax;
  }

  // ENEMY PHASE — Bleed triggers first, then decays (deck §6).
  setPhase('ENEMY_TELEGRAPH');
  fxFoeWind();
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
    fxFoeAct(it.id);
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
        let spent = false;   // read the whole string, but this hero's negate was already used
        if (turned && negatedThisAction[parrierId]) { mit = 0.75; turned = false; spent = true; }
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
          dealToBoss(rip, 'riposte', parrierId);
          breakDamage(1);
          logLine('FLAWLESS — ' + fmtN(rip) + ' returned.');
          // A RIPOSTE CAN END THE FIGHT MID-VOLLEY. The bleed tick already
          // guarded for this; the riposte did not, so the rest of the barrage
          // — and the unparryable dirge after it — kept landing on the party
          // after the Regent was already dead and VICTORY was locked. You
          // could watch your own heroes fall to something the game had
          // declared defeated, and the function returned 'defeat' for a fight
          // it had won.
          if (C.phase === 'VICTORY') { renderAll(); return report('victory', result); }
        }
        // THE RECEIPT MUST NOT LIE. It was handed the raw read, so on a second
        // clean string in one action it printed "TURNED — the blow is turned
        // aside" while a quarter of the damage went through. The Hymn strikes
        // Ash twice, so this was the routine case on the intent players meet
        // first, and nothing anywhere on screen teaches the response limit.
        fxParryReceipt(parrierId, spent ? { ...read, turned: false, flawless: false, spent: true } : read);
      }
      // STEPPING IN FRONT OF SOMEONE COUNTS WHEN THE BLOW ARRIVES, not when
      // the card is played. An intercession that was never tested is a card
      // played, not a thing done for somebody.
      if (C.deeds && parrierId !== tgtId) C.deeds.shields.push({ by: parrierId, for: tgtId });
      // Guard absorbs first, on the hero actually struck; then flesh.
      const struck = C.heroes[tgtId];
      if (dmg > 0) {
        if (C.deeds) C.deeds.untouched = false;
        if (struck.guard > 0) { const g = Math.min(struck.guard, dmg); struck.guard -= g; dmg -= g; }
        if (dmg > 0) {
          if (C.deeds) C.deeds.tookHit += dmg;
          struck.hp = Math.max(0, struck.hp - dmg);
          markBrink(tgtId);
          if (struck.hp === 0) { struck.downed = true; struck.guard = 0; logLine(HEROES23[tgtId].name + ' falls.'); }
        }
      }
      result.hits.push({ targetId: tgtId, parrierId, turned, negated, flawless: read.flawless,
                         mit: read.mit, kept: read.kept, notes: read.notes, taken: dmg });
      C.telemetry.parry.push({ t: C.turn, turned, flawless: read.flawless,
                               kept: read.kept, notes: read.notes });
      result.taken += dmg;
      await fxHitResolved(tgtId, dmg, turned, read.flawless);
      if (!livingHeroes().length) { setPhase('DEFEAT'); renderAll(); return report('defeat', result); }
    }
  }
  // THE DIRGE — after the blows, the hymn itself settles on the whole party,
  // and no timing answers it: only Guard and healing do. It resolves LAST so
  // that Guard is still standing when the volley's parry windows ask for it —
  // a hero who banked 2 Guard can always spend it to negate.
  if (C.phase === 'VICTORY') { renderAll(); return report('victory', result); }
  const dirge = dirgeAmount();
  if (dirge > 0 && !result.canceled) {
    // THE HYMN IS HEARD BEFORE IT IS FELT, and then it takes the party one at a
    // time. Applying all three at once and popping three numbers in one frame
    // put six figures on screen — the volley's were still clearing — and made
    // the tax that decides runs the one thing nobody could read.
    await fxDirgeOpen();
    const order = livingHeroes();
    for (let i = 0; i < order.length; i++) {
      const id = order[i];
      const h = C.heroes[id];
      let d = dirge;
      if (h.guard > 0) { const g = Math.min(h.guard, d); h.guard -= g; d -= g; }
      if (d > 0) {
        if (C.deeds) { C.deeds.untouched = false; C.deeds.tookDirge += d; }
        h.hp = Math.max(0, h.hp - d);
        markBrink(id);
        if (h.hp === 0) { h.downed = true; h.guard = 0; logLine(HEROES23[id].name + ' falls to the dirge.'); }
      }
      await fxDirgeOne(id, d, i === order.length - 1);
    }
    if (!livingHeroes().length) { setPhase('DEFEAT'); renderAll(); return report('defeat', result); }
  }

  fxFoeSettle();
  C.intercession = null;                        // one enemy action, then it lapses

  // NEXT PLAYER PHASE — Guard expires now (deck §6); the stance lapses;
  // unplayed cards remain; draw to 5 (hand cap 7 only matters to generation).
  livingHeroes().forEach(id => { C.heroes[id].guard = 0; });
  C.counterstance = false;
  setPhase('HAND_DRAWING');
  if (sweeping) await sweeping;     // the pile has to exist before it is drawn from
  while (C.hand.length < 5) {
    const shuffles = C.reshuffles || 0;
    if (!drawOne()) break;
    if ((C.reshuffles || 0) > shuffles) await fxReshuffle();
    await fxDrawOne();
  }

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
    // THE DECK RUNNING OUT IS AN EVENT. It happened silently — the discard
    // count dropped to zero and the draw count jumped, between frames, with no
    // moment on screen — so a player watching their last cards go by never saw
    // the pile come back. This counter is the only state it needs; the draw
    // loop notices it moved and plays the shuffle before the next card flies.
    C.reshuffles = (C.reshuffles || 0) + 1;
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
// THE FOE ACTS — idle, wind-up, the blow, the recovery
// ═════════════════════════════════════════════════════════════════════════════
// Until now the enemy was a still picture with a slow breathe on it. It did not
// wind up, it did not swing, and it did not recover — the whole barrage played
// out as rings appearing over the party while the thing throwing them stood
// perfectly still. That is most of why the attacks "don't feel like anything":
// there was no attacker in them.
//
// Three layers move independently and must not be given the same property:
//   · #k-boss-art  — the ACT. Wind-up, lunge, cast, recover.
//   · .k-fig       — the IDLE. Paused for the duration of an act.
//   · img          — the REACTIONS. Recoil when struck, reel when broken.
// Build 36 learned this the hard way on the heroes: anything that sets
// `animation` on the layer carrying the idle REPLACES the idle rather than
// layering over it, and the figure stops breathing for the rest of the fight.
// EVERY CLASS THE FOE CAN WEAR, DERIVED FROM THE ACTS. There used to be two
// hand-written maps here — intent -> pose and note -> swing — and the lists
// that CLEAR those classes were built from them. So adding an act meant
// remembering to add its animation to a list whose only job is to take it off
// again; miss it and the class sticks forever. Both lists come off ACTS now,
// which means a new act cannot be half-registered.
const FOE_POSES = [...new Set(Object.values(ACTS).map(a => a.pose))].concat(['k-foe-wind']);
const FOE_SWINGS = [...new Set(Object.values(ACTS).map(a => a.swing))];
function foeSet(slot, cls, ms) {
  const b = el('k-boss-art'); if (!b) return;
  slot.forEach(c => b.classList.remove(c));
  if (!cls) return;
  void b.offsetWidth;                       // restart even if the class repeats
  b.classList.add(cls);
  if (ms) setTimeout(() => b.classList.remove(cls), ms);
}
// THE BREATH BEFORE THE BLOW. Held rather than timed out: the wind-up ends when
// the act begins, so however long the launch takes the foe stays coiled.
// ONE mapping, not two. A sheet's act states are NAMED AFTER the pose class they
// accompany — `k-foe-toll` drives the `toll` frames — so an act naming its own
// pose can never leave the frames pointing somewhere else, and there is no
// second table to keep in step with the first.
const sheetStateOf = (cls) => (cls || '').replace('k-foe-', '') || 'idle';
function fxFoeWind() { foeSet(FOE_POSES, 'k-foe-wind'); foeAnimState('wind'); }
// THE OPENING POSTURE IS THE FIRST BLOW'S. A second table mapped intent -> pose
// and could disagree with what the bar then actually threw — Grief in Threes
// opened in the SWEEP pose and its first blow was a tap. The bar opens in the
// shape of the thing it is about to do.
function fxFoeAct(intentId) {
  const it = REGENT_INTENTS.find(x => x.id === intentId);
  const first = it && it.hits && it.hits[0] && (it.hits[0].acts || [])[0];
  const cls = first ? parseAct(first).def.pose : 'k-foe-toll';
  foeSet(FOE_POSES, cls); foeAnimState(sheetStateOf(cls));
}
// THE BODY FOLLOWS THE ACT, AND IT CHANGES PER BLOW. Two things were wrong
// here. `fxFoeSwing(kind)` took the NOTE and looked up an animation for it —
// the tail wagging the dog, since the note is supposed to be the answer to the
// blow. And the POSE was set once per intent, in `fxFoeAct`, so a three-blow
// bar held one posture throughout: the foe struck three different ways and
// looked identical every time. Both take the act now, and the pose is re-set
// on every blow, so a bar that claws then tolls then thrusts is three
// different shapes on screen.
function fxFoeSwing(actSpec) {
  const a = parseAct(actSpec);
  foeSet(FOE_POSES, a.def.pose);
  foeAnimState(sheetStateOf(a.def.pose));
  foeSet(FOE_SWINGS, a.def.swing || 'k-fs-jab', 420);
}
function fxFoeSettle() {
  foeSet(FOE_POSES, null); foeSet(FOE_SWINGS, null); foeAnimState('idle');
}

// ═════════════════════════════════════════════════════════════════════════════
// THE PAINTED IDLE — real frames, cut out of a generated clip
// ═════════════════════════════════════════════════════════════════════════════
// Everything above this line moves a STILL PICTURE: translate, scale and a CSS
// breathe. It is a good deal better than a foe standing perfectly still, but it
// is still one drawing being shoved around, and at rest the Regent reads as a
// photograph that someone is nudging.
//
// These frames are the character actually drawn six times. They came out of a
// five-second clip generated from her own plate, shot on a flat white void with
// the camera locked, then keyed and packed into one strip — which is worth
// writing down, because the obvious route does not work. Asking a still model
// for pose after pose, holding the character with a reference image, returns the
// REFERENCE'S pose every time: the wind-up, the toll and the sweep all came back
// as the idle. Loosen the reference enough to break that and the armour, the
// crown and the silhouette all change, so the frames stop being the same
// creature. Identity and motion pull against each other and a still model can
// only hold one of them at a time. A clip holds both for free.
//
// The layer is a sibling of the plate, NOT a child of `.k-fig`, on purpose. The
// pose and the blow live on `#k-boss-art` — the parent — so the sheet inherits
// them and every act above still plays. The idle lives on `.k-fig`, and the
// sheet must not inherit that one, because the sheet IS the idle; running both
// would breathe the creature twice.
// BOUNCE, not wrap, for every idle. Six frames of drift do not close into a
// ring — the last frame is the far end of the sway, not the way back to the
// first — so wrapping snaps the cloth across the whole excursion once a second.
// Played out and back, the same six frames are a hover.
//
// The ACTS hold. An act that timed itself back to the idle would drop the foe
// to resting in the middle of its own volley, because a barrage runs longer than
// the swing that opens it; `fxFoeSettle` is what lets it go, exactly as it
// already does for the CSS poses.
//
// Five foes, five tempos — the same rule the CSS idles follow. The Husk is dead
// weight, the Revenant moves as little as it can, and the Choir is singing.
const FOE_SHEETS = {
  mourner: {
    file: 'foe-mourner-anim.webp',
    cols: 6, rows: 4, cellW: 380, cellH: 214, figH: 209,
    states: { idle: [0, 1, 2, 3, 4, 5], wind: [6, 7], toll: [8, 9, 10],
              sweep: [11, 12, 13], rain: [14, 15, 16], gather: [17, 18, 19],
              hit: [20, 21], broken: [22, 23] },
    play: { idle: { ms: 150, bounce: true },
            wind: { ms: 130 }, toll: { ms: 95 }, sweep: { ms: 85 },
            rain: { ms: 110 }, gather: { ms: 130 },
            hit: { ms: 110 }, broken: { ms: 210, bounce: true } },
  },
  husk: {
    file: 'foe-husk-anim.webp',
    cols: 6, rows: 3, cellW: 380, cellH: 214, figH: 193,
    states: { idle: [0, 1, 2, 3, 4, 5], wind: [6, 7], toll: [8, 9, 10],
              sweep: [11, 12, 13], hit: [14, 15], broken: [16, 17] },
    play: { idle: { ms: 190, bounce: true },
            wind: { ms: 140 }, toll: { ms: 100 }, sweep: { ms: 95 },
            hit: { ms: 110 }, broken: { ms: 230, bounce: true } },
  },
  cultist: {
    // its idle frames come from the FIRST second of its clip, before the bloom:
    // the Choir's conjured light flares to a wide soft white, and white light on
    // a white void cannot be told from the backdrop — the key cut it into a
    // hard-edged disc that read as a bug rather than a spell. Its rain frames
    // stop before 1.8s for the same reason, where the downpour washes the field.
    file: 'foe-cultist-anim.webp',
    cols: 6, rows: 4, cellW: 380, cellH: 214, figH: 211,
    states: { idle: [0, 1, 2, 3, 4, 5], wind: [6, 7], toll: [8, 9, 10],
              rain: [11, 12, 13], gather: [14, 15, 16],
              hit: [17, 18], broken: [19, 20] },
    play: { idle: { ms: 170, bounce: true },
            wind: { ms: 140 }, toll: { ms: 100 }, rain: { ms: 115 },
            gather: { ms: 130 },
            hit: { ms: 110 }, broken: { ms: 220, bounce: true } },
  },
  wraith: {
    file: 'foe-wraith-anim.webp',
    cols: 6, rows: 3, cellW: 380, cellH: 214, figH: 205,
    states: { idle: [0, 1, 2, 3, 4, 5], wind: [6, 7], sweep: [8, 9, 10],
              rain: [11, 12, 13], hit: [14, 15], broken: [16, 17] },
    play: { idle: { ms: 165, bounce: true },
            wind: { ms: 130 }, sweep: { ms: 85 }, rain: { ms: 115 },
            hit: { ms: 105 }, broken: { ms: 215, bounce: true } },
  },
  revenant: {
    file: 'foe-revenant-anim.webp',
    cols: 6, rows: 4, cellW: 380, cellH: 214, figH: 208,
    states: { idle: [0, 1, 2, 3, 4, 5], wind: [6, 7], toll: [8, 9, 10],
              sweep: [11, 12, 13], gather: [14, 15, 16],
              hit: [17, 18], broken: [19, 20] },
    play: { idle: { ms: 220, bounce: true },
            wind: { ms: 150 }, toll: { ms: 100 }, sweep: { ms: 90 },
            gather: { ms: 140 },
            hit: { ms: 115 }, broken: { ms: 240, bounce: true } },
  },
};
let _fanim = null, _fanimT = null, _fanimWant = null, _fanimBack = null;

function foeAnimPaint() {
  const a = _fanim; if (!a || !a.el) return;
  const st = a.sheet.states[a.state] || a.sheet.states.idle || [0];
  const i = st[Math.min(a.frame, st.length - 1)];
  const c = a.sheet.cols, r = a.sheet.rows;
  // A uniform grid needs no per-frame rects: the cell is picked by stepping the
  // background across in even fractions, which is why the sheet is packed
  // square-celled rather than tightly.
  a.el.style.backgroundPositionX = c > 1 ? ((i % c) / (c - 1) * 100) + '%' : '0%';
  a.el.style.backgroundPositionY = r > 1 ? (Math.floor(i / c) / (r - 1) * 100) + '%' : '0%';
}
function foeAnimTick() {
  const a = _fanim;
  if (!a || !a.el || !a.el.isConnected) {
    if (_fanimT) { clearInterval(_fanimT); _fanimT = null; }
    _fanim = null; return;
  }
  if (document.hidden || camReduced()) return;    // reduced motion holds the pose
  // A CORPSE DOES NOT BREATHE. `broken` is a two-frame BOUNCING loop — it was
  // authored as a stagger, which is a thing that happens to a foe that is still
  // alive — and death borrowed it wholesale, so a dead enemy lay on the ground
  // ping-ponging between two frames forever. Every foe sheet does this, so the
  // fix belongs here rather than in five `play` blocks: once the fight has
  // killed it, the frame it landed on is the frame it keeps.
  if (a.dead) return;
  const play = a.sheet.play[a.state] || { ms: 150, bounce: true };
  const n = (a.sheet.states[a.state] || []).length;
  if (n < 2) return;
  const now = performance.now();
  if (now - a.at < play.ms) return;
  a.at = now;
  if (play.bounce) {
    if (a.frame + a.dir < 0 || a.frame + a.dir >= n) a.dir = -a.dir;
    a.frame += a.dir;
  } else if (a.frame + 1 < n) {
    a.frame++;
  } else if (play.loop) {
    a.frame = 0;
  } else if (play.then && a.sheet.states[play.then]) {
    a.state = play.then; a.frame = 0; a.dir = 1;
  } else {
    return;             // HOLD: an act stays coiled on its last frame
  }
  foeAnimPaint();
}
// THE ACTS HOLD, and `fxFoeSettle` is what lets them go — exactly how the CSS
// poses above already behave. An act that timed itself back to the idle would
// drop the foe back to resting in the middle of its own volley, because a
// barrage runs longer than the swing that opens it.
function foeAnimState(name) {
  const a = _fanim; if (!a || a.dead) return;
  // A foe whose sheet does not carry this act simply keeps what it is showing.
  // The CSS pose on the parent still plays over it, so the act still reads —
  // which is what lets frames land one state at a time.
  if (!a.sheet.states[name] || a.state === name) return;
  clearTimeout(_fanimBack); _fanimBack = null; a.resume = null;
  a.state = name; a.frame = 0; a.dir = 1; a.at = performance.now();
  foeAnimPaint();
}
// A REACTION INTERRUPTS, AND THEN GIVES THE STATE BACK. Being hit does not
// change what a foe is DOING: it was coiled to strike before the blow landed
// and it is still coiled after. So a reaction remembers the pose it interrupted
// and returns to it, rather than dumping the creature onto its idle in the
// middle of its own volley — and it times out against the same window the CSS
// shake runs for, so the frames and the shudder end together.
function foeAnimReact(name, ms) {
  const a = _fanim; if (!a || a.dead || !a.sheet.states[name]) return;
  // Struck again while already reeling: hold it longer and replay, but do NOT
  // let 'hit' become the thing it goes back to.
  if (a.state !== name) a.resume = a.state;
  a.state = name; a.frame = 0; a.dir = 1; a.at = performance.now();
  foeAnimPaint();
  clearTimeout(_fanimBack);
  _fanimBack = setTimeout(() => {
    _fanimBack = null;
    if (!_fanim || _fanim.state !== name) return;
    const back = _fanim.resume || 'idle';
    _fanim.resume = null;
    foeAnimState(back);
  }, ms);
}
// THE DEGRADATION CONTRACT, inherited from v2.2 and worth keeping exactly:
// naming a foe in FOE_SHEETS does NOTHING until its sheet really loads. The four
// foes with no sheet keep their painted plate, a missing or broken file leaves
// the plate up rather than an empty box, and there is no 404 storm — one probe,
// and silence if it fails.
function foeAnimArm(foeId) {
  if (_fanimT) { clearInterval(_fanimT); _fanimT = null; }
  clearTimeout(_fanimBack); _fanimBack = null;
  _fanim = null;
  _fanimWant = foeId;
  const box = el('k-boss-art'); if (!box) return;
  // ALL of them, not the first. Two fights started in the same frame arm two
  // probes; a cached sheet resolves both, and each one used to mount its own
  // layer. querySelector then retired one of the pair and left the other behind
  // — invisible, because the class was off, but one class away from a doubled
  // Regent, and dragging a stale interval along with it.
  box.querySelectorAll('.k-fanim').forEach(n => n.remove());
  box.classList.remove('k-has-anim');
  const sheet = FOE_SHEETS[foeId]; if (!sheet) return;
  const src = '../art/' + sheet.file;
  const probe = new Image();
  probe.onload = () => {
    // the encounter may have been swapped out while the sheet was in flight
    if (_fanimWant !== foeId || !box.isConnected) return;
    // idempotent: whatever a racing probe may have mounted goes first, so the
    // box holds exactly one layer and exactly one clock however many resolve
    if (_fanimT) { clearInterval(_fanimT); _fanimT = null; }
    box.querySelectorAll('.k-fanim').forEach(n => n.remove());
    const img = box.querySelector('img');
    const l = document.createElement('span');
    l.className = 'k-fanim';
    l.style.backgroundImage = "url('" + src + "')";
    l.style.backgroundSize = (sheet.cols * 100) + '% ' + (sheet.rows * 100) + '%';
    // SIZED BY THE CREATURE, NOT BY ITS CELL. A cell carries margin the painted
    // plate does not — the Regent's acts reach further than her idle, and each
    // foe's clip framed it a little differently — so a layer stretched to the
    // box would swap the plate for a visibly smaller foe, and by a different
    // amount for each one. Blow the cell up until the figure inside it stands
    // exactly as tall as the plate it is replacing, and the swap is invisible.
    const bw = box.clientWidth || 250, bh = box.clientHeight || 264;
    const pr = (img && img.naturalWidth) ? (img.naturalHeight / img.naturalWidth)
                                         : (511 / 760);   // every plate's shape
    const cellH = Math.min(bh, bw * pr) * sheet.cellH / sheet.figH;
    l.style.height = cellH + 'px';
    l.style.width = (cellH * sheet.cellW / sheet.cellH) + 'px';
    box.insertBefore(l, box.firstChild);
    box.classList.add('k-has-anim');
    _fanim = { el: l, sheet, state: 'idle', frame: 0, dir: 1, at: performance.now() };
    foeAnimPaint();
    _fanimT = setInterval(foeAnimTick, 60);
  };
  probe.onerror = () => {};
  probe.src = src;
}

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

// ═════════════════════════════════════════════════════════════════════════════
// MUSIC — two decks, one crossfader (ported from v2.2)
// ═════════════════════════════════════════════════════════════════════════════
// Games like Clair Obscur do not CUT between exploration and battle music: they
// run both stems and equal-power crossfade one into the other, so summed
// loudness stays flat — no dip on the way in, no bump. Two <audio> decks do the
// same job here. The world bed lives on one and combat on the other, and a
// change of screen dissolves between them.
//
// The two tracks are treated differently on purpose. The ROAD is a place you
// keep returning to, so its theme RESUMES where it left off — leaving the map
// for a fight and coming back should feel like stepping out of a room the music
// was still playing in. COMBAT is an entrance, so it restarts from its downbeat
// every time.
//
// And leaving combat does NOT crossfade. Two pieces this different overlapping
// for two seconds is a mess; the battle theme fades fully out, there is a beat
// of silence, and then the road's song swells in.
const MUSIC_SRC = {
  combat: '../audio/combat-theme.mp3?v=1',
  world:  '../audio/worldmap-theme.mp3?v=1',
};
// The combat theme is 120 BPM with its downbeat grid offset ~0.14s. This is not
// decoration: the parry grid runs at the same 120 (BEAT_MS = 500) and phase-
// locks to these numbers, so the rings close ON the track. Tune by ear if the
// track is ever re-exported.
const MUSIC_BPM = 120, MUSIC_OFFSET = 0.14, MUSIC_BEAT = 60 / MUSIC_BPM;
// Muting is a real setting and has to survive a reload; it lives beside the
// other kizuna23.* keys. Default ON — a game whose parry is built on a beat
// should open with the beat audible.
const MUSIC_KEY = 'kizuna23.music';
// WHAT THE PLAYER CHOSE, which is not the same question as whether anything is
// going to play. The button paints from this one: it reports a decision, and a
// speaker showing a slash for a reason the player never asked for is a lie
// about their own settings.
function musicPref() {
  try { return localStorage.getItem(MUSIC_KEY) !== '0'; } catch (_) { return true; }
}
// WHETHER ANYTHING PLAYS, which the whole engine gates on.
function musicOn() {
  // THE SUITE DOES NOT DOWNLOAD 11MB PER BOOT. Every check boots a fresh page
  // and most of them enter combat, so leaving music on under ?test=1 would put
  // two large fetches behind several hundred boots for no assertion's benefit.
  // ?test=1&music=1 turns it back on, which is how the music's own checks run —
  // opt-in rather than a mock, so what they exercise is the shipping path.
  if (testMode() && !/[?&]music=1/.test(location.search)) return false;
  return musicPref();
}
function musicSet(on) {
  try { localStorage.setItem(MUSIC_KEY, on ? '1' : '0'); } catch (_) {}
  MUSIC.refresh();
}
// ═════════════════════════════════════════════════════════════════════════════
// SFX — the blow, the hit, and the parry, SYNTHESISED
// ═════════════════════════════════════════════════════════════════════════════
// There was no combat audio at all: a volley of notes resolved in total
// silence, and a parry — a rhythm mechanic, of all things — gave the ear
// nothing to time against.
//
// These are BUILT, not sampled, and the reason is latency. A parry is graded in
// tens of milliseconds and the sound IS the feedback; an <audio> element's
// play() lands somewhere between 50 and 200ms after you ask for it, which on a
// rhythm read is not late, it is wrong. A WebAudio graph scheduled against the
// context clock fires when it is told to. It also weighs nothing, which matters
// in a repo already carrying 22MB of music, and it can be tuned by ear in the
// file rather than regenerated as an asset.
//
// One context, created on the first gesture — a browser will not start an
// AudioContext before the player has touched something — and it rides the same
// mute the music does, because a player who silenced the game silenced the game.
const SFX = (() => {
  let ctx = null, bus = null, noiseBuf = null;

  function wake() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch (_) { return null; }
    bus = ctx.createGain();
    bus.gain.value = 0.9;
    bus.connect(ctx.destination);
    // one second of white noise, reused by every percussive voice
    const n = ctx.sampleRate;
    noiseBuf = ctx.createBuffer(1, n, n);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }
  const live = () => (musicOn() && !(typeof window !== 'undefined' && window.__SIM)) ? wake() : null;

  // a filtered noise burst — the body of anything that hits
  function burst(t, { dur = 0.09, freq = 1800, q = 0.7, gain = 0.5, type = 'bandpass' }) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(bus);
    src.start(t); src.stop(t + dur + 0.02);
  }
  // a pitched voice — the ring, the chime, the thump
  function tone(t, { f0 = 440, f1 = null, dur = 0.18, gain = 0.25, type = 'triangle' }) {
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.02);
  }

  // Each voice is a SHAPE, not a pitch: steel is a bright short scrape with a
  // ring on top, a spell is two soft tones and no scrape, a body blow is all
  // low end and no ring. The ear should be able to tell what happened without
  // looking at the numbers.
  const VOICES = {
    slash(t, k) {
      burst(t, { dur: 0.07, freq: 3200, q: 0.6, gain: 0.42 * k });
      tone(t + 0.005, { f0: 2600, f1: 1100, dur: 0.13, gain: 0.12 * k, type: 'triangle' });
    },
    heavy(t, k) {
      burst(t, { dur: 0.13, freq: 1400, q: 0.5, gain: 0.5 * k });
      tone(t, { f0: 150, f1: 62, dur: 0.2, gain: 0.34 * k, type: 'sine' });
      tone(t + 0.01, { f0: 1900, f1: 780, dur: 0.16, gain: 0.1 * k, type: 'triangle' });
    },
    cast(t, k) {
      tone(t, { f0: 520, f1: 880, dur: 0.26, gain: 0.16 * k, type: 'sine' });
      tone(t + 0.02, { f0: 784, f1: 1320, dur: 0.22, gain: 0.1 * k, type: 'sine' });
      burst(t, { dur: 0.18, freq: 2600, q: 1.4, gain: 0.12 * k, type: 'highpass' });
    },
    hurt(t, k) {                       // a hero taking it
      burst(t, { dur: 0.12, freq: 520, q: 0.5, gain: 0.42 * k, type: 'lowpass' });
      tone(t, { f0: 190, f1: 74, dur: 0.22, gain: 0.3 * k, type: 'sine' });
    },
    guard(t, k) {                      // it lands on a ward instead
      burst(t, { dur: 0.07, freq: 2100, q: 2.4, gain: 0.22 * k });
      tone(t, { f0: 420, f1: 300, dur: 0.13, gain: 0.14 * k, type: 'triangle' });
    },
    // THE PARRY LADDER. Four grades that must be told apart with the eyes shut:
    // a perfect is a rising two-note chime, a great is the same idea flattened,
    // a good is one plain note, and a late is a dull knock that does not ring.
    perfect(t, k) {
      burst(t, { dur: 0.05, freq: 5200, q: 0.9, gain: 0.2 * k, type: 'highpass' });
      tone(t, { f0: 880, dur: 0.1, gain: 0.2 * k, type: 'triangle' });
      tone(t + 0.055, { f0: 1320, dur: 0.22, gain: 0.22 * k, type: 'triangle' });
    },
    great(t, k) {
      tone(t, { f0: 740, dur: 0.09, gain: 0.17 * k, type: 'triangle' });
      tone(t + 0.05, { f0: 988, dur: 0.16, gain: 0.15 * k, type: 'triangle' });
    },
    good(t, k) { tone(t, { f0: 620, dur: 0.13, gain: 0.15 * k, type: 'triangle' }); },
    late(t, k) {
      burst(t, { dur: 0.08, freq: 300, q: 0.7, gain: 0.24 * k, type: 'lowpass' });
      tone(t, { f0: 210, f1: 150, dur: 0.1, gain: 0.1 * k, type: 'sine' });
    },
    miss(t, k) {
      burst(t, { dur: 0.11, freq: 240, q: 0.6, gain: 0.26 * k, type: 'lowpass' });
    },
    brk(t, k) {                        // poise gives way
      tone(t, { f0: 170, f1: 44, dur: 0.5, gain: 0.4 * k, type: 'sine' });
      burst(t, { dur: 0.3, freq: 900, q: 0.4, gain: 0.4 * k });
      tone(t + 0.03, { f0: 2400, f1: 600, dur: 0.34, gain: 0.12 * k, type: 'triangle' });
    },
    allout(t, k) {                     // the whole party at once
      tone(t, { f0: 300, f1: 1200, dur: 0.34, gain: 0.24 * k, type: 'sawtooth' });
      burst(t + 0.16, { dur: 0.24, freq: 2200, q: 0.5, gain: 0.44 * k });
      tone(t + 0.16, { f0: 180, f1: 60, dur: 0.4, gain: 0.34 * k, type: 'sine' });
    },
    heal(t, k) {
      tone(t, { f0: 660, f1: 990, dur: 0.3, gain: 0.13 * k, type: 'sine' });
      tone(t + 0.06, { f0: 990, f1: 1320, dur: 0.26, gain: 0.09 * k, type: 'sine' });
    },
  };

  let lastAt = 0, lastName = '';
  return {
    // `k` scales the voice with the size of what happened, so a 4 and a 24 are
    // not the same sound at the same loudness
    play(name, k) {
      const c = live(); if (!c) return false;
      const v = VOICES[name]; if (!v) return false;
      const t = c.currentTime + 0.001;
      // A VOLLEY IS NOT A MACHINE GUN. Identical voices inside a few ms stack
      // into a click rather than reading as several blows, so a repeat of the
      // same voice is thinned rather than layered.
      if (name === lastName && t - lastAt < 0.035) return false;
      lastAt = t; lastName = name;
      try { v(t, Math.max(0.35, Math.min(1.6, k == null ? 1 : k))); } catch (_) { return false; }
      return true;
    },
    // the first real gesture is what a browser waits for
    unlock() { const c = live(); if (c && c.state === 'suspended') c.resume(); },
    _state() {
      return { ctx: !!ctx, state: ctx ? ctx.state : null, on: musicOn(),
               voices: Object.keys(VOICES) };
    },
  };
})();
function sfx(name, k) { try { return SFX.play(name, k); } catch (_) { return false; } }

const MUSIC = (() => {
  const CROSS = 2400;                 // crossfade length (ms) — long and gentle
  const decks = [];                   // [{a}, {a}] — two Audio elements
  let active = -1, want = false, wantSrc = null, wantVol = 0.5;
  let xf = null, lvl = null, seqT = null, hiddenPaused = false;
  const posBySrc = {};                // where each track was, so it can resume
  // TWO SPELLINGS OF THE SAME TRACK. `a.src` reads back as the browser's
  // RESOLVED absolute URL — "http://host/audio/worldmap-theme.mp3" — while what
  // we hand in is the relative "../audio/worldmap-theme.mp3?v=1". Comparing
  // them stripped of their query still never matches, and this module asks that
  // question twice in places where getting it wrong is silent:
  //
  //   · "is this track already foreground?" always answered NO, so cueing the
  //     bed a second time (which happens on every screen change, and on every
  //     fight, since both startCombat and the screen change cue it) tore down a
  //     playing deck and built the same track up again on the other one — two
  //     decks running the same file, one crossfading into the other;
  //   · "where was this track when it went out?" wrote the bookmark under one
  //     spelling and read it under the other, so `resume` always resumed from
  //     zero and the road's theme restarted from the top every single time you
  //     came back from a fight — the exact behaviour the resume flag exists to
  //     prevent.
  //
  // v2.2 shipped this and neither symptom was ever traced. The identity of a
  // track is its FILENAME; both spellings agree about that.
  const baseOf = (s) => (s || '').split('?')[0];
  const keyOf = (s) => { const b = baseOf(s); const i = b.lastIndexOf('/'); return i < 0 ? b : b.slice(i + 1); };
  const mk = () => {
    try { const a = new Audio(); a.loop = true; a.preload = 'auto'; a.volume = 0; return { a }; }
    catch (_) { return null; }
  };
  // The decks are made with NO src, so nothing is fetched until a track is
  // actually wanted — the two files are 11MB between them and only one of them
  // is ever needed at a time.
  const ensure = () => {
    if (decks.length || typeof Audio === 'undefined') return;
    const d0 = mk(), d1 = mk(); if (d0 && d1) decks.push(d0, d1);
  };
  // Equal-power: incoming rises on sin, outgoing falls on cos, so the sum is
  // flat. One timer drives both.
  // AN INTERRUPTED CROSSFADE MUST NOT STRAND THE DECK IT WAS RETIRING. Clearing
  // the timer used to be the whole of "cancel", which left the outgoing deck
  // frozen at whatever level it had reached — still playing, forever. It is
  // reachable in ordinary play: enter a fight and leave it inside the 2.4s
  // crossfade (a one-turn kill, a defeat on the opening volley) and the road's
  // bed keeps playing underneath the battle theme for the rest of the session.
  // A deck that was on its way out is finished on its way out.
  //
  // …but only for a deck the NEW job is not about to bring back in. Unmuting
  // cancels the fade-to-silence and ramps the very same deck back up; settling
  // it blindly paused the deck that was being restored, so the level rose on a
  // stopped track — audible as "unmute does nothing", and it left the combat
  // theme frozen so the next hand-off had nothing to fade.
  let xfJob = null;
  const crossfade = (out, inc, vol, ms) => {
    clearInterval(xf);
    if (xfJob && xfJob.out && xfJob.out !== inc && xfJob.out !== out) {
      try { xfJob.out.a.volume = 0; xfJob.out.a.pause(); } catch (_) {}
    }
    xfJob = { out, inc };
    const outFrom = out ? out.a.volume : 0;
    const steps = Math.max(1, Math.round(ms / 40)); let i = 0;
    xf = setInterval(() => {
      i++; const t = Math.min(1, i / steps);
      const kin = Math.sin(t * Math.PI / 2), kout = Math.cos(t * Math.PI / 2);
      if (inc) { try { inc.a.volume = Math.max(0, Math.min(1, vol * kin)); } catch (_) {} }
      if (out) { try { out.a.volume = Math.max(0, Math.min(1, outFrom * kout)); } catch (_) {} }
      if (i >= steps) { clearInterval(xf); xfJob = null; if (out) { try { out.a.pause(); } catch (_) {} } }
    }, 40);
  };
  // A level nudge that never dips to zero, so re-asserting a track that is
  // already up (map → camp → map) is inaudible rather than a little swell.
  const fadeDeck = (d, target, ms) => {
    if (!d) return;
    clearInterval(lvl);
    const from = d.a.volume; if (Math.abs(from - target) < 0.01) return;
    const steps = Math.max(1, Math.round(ms / 40)); let i = 0;
    lvl = setInterval(() => {
      i++; const t = Math.min(1, i / steps);
      try { d.a.volume = Math.max(0, Math.min(1, from + (target - from) * t)); } catch (_) {}
      if (i >= steps) clearInterval(lvl);
    }, 40);
  };
  const startDeck = (d, src, resume) => {
    if (keyOf(d.a.src) !== keyOf(src)) { try { d.a.src = src; } catch (_) {} }
    const at = resume ? (posBySrc[keyOf(src)] || 0) : 0;
    try { d.a.currentTime = at; } catch (_) {}
    try { d.a.volume = 0; } catch (_) {}
    const p = d.a.play(); if (p && p.catch) p.catch(() => {});   // blocked → a gesture retries
  };
  // AUTOPLAY IS BLOCKED UNTIL THE PLAYER TOUCHES SOMETHING, on every browser
  // that matters. Rather than asking for permission, every pointerdown is a
  // chance to start a track that is wanted but was refused.
  try { document.addEventListener('pointerdown', () => {
    if (!want || !musicOn() || hiddenPaused) return;
    const d = active >= 0 ? decks[active] : null;
    if (d && d.a.paused) {
      const p = d.a.play(); if (p && p.catch) p.catch(() => {});
      if (d.a.volume < 0.02) crossfade(null, d, wantVol, 500);
    }
  }, { capture: true }); } catch (_) {}
  // LOCK AND BACKGROUND. A phone that locks with the music running comes back
  // to it mid-phrase; currentTime means it picks up exactly where it stopped.
  const pauseForHide = () => {
    hiddenPaused = false;
    decks.forEach(d => { if (d && d.a && !d.a.paused) { hiddenPaused = true; try { d.a.pause(); } catch (_) {} } });
  };
  const resumeFromHide = () => {
    if (!hiddenPaused) return;
    hiddenPaused = false;
    if (!want || !musicOn()) return;
    const d = active >= 0 ? decks[active] : null;
    if (d && d.a.paused) { const p = d.a.play(); if (p && p.catch) p.catch(() => {}); }
  };
  try {
    document.addEventListener('visibilitychange', () => { if (document.hidden) pauseForHide(); else resumeFromHide(); });
    window.addEventListener('pagehide', pauseForHide);
  } catch (_) {}
  return {
    // Fade from whatever is up to `src`. resume=true continues that track from
    // where it paused (the road); resume=false restarts it (a fresh entrance).
    // opts.sequence uses the fade-out → silence → fade-in hand-off instead of
    // an overlapping crossfade.
    play(src, vol, resume, opts) {
      want = true; wantSrc = src; wantVol = (vol == null ? 0.5 : vol);
      clearTimeout(seqT);
      ensure(); if (!decks.length || !musicOn()) return;
      const cur = active >= 0 ? decks[active] : null;
      // ALREADY FOREGROUND — do not restart it and do not dip it. Screens change
      // often and most of those changes want the same bed; re-cueing has to be
      // a genuine no-op or the road's theme stutters every time you open a menu.
      if (cur && keyOf(cur.a.src) === keyOf(src)) {
        if (cur.a.paused) { const p = cur.a.play(); if (p && p.catch) p.catch(() => {}); }
        fadeDeck(cur, wantVol, 800);
        return;
      }
      if (cur) { try { posBySrc[keyOf(cur.a.src)] = cur.a.currentTime || 0; } catch (_) {} }
      const next = active === 0 ? 1 : 0;
      if (opts && opts.sequence) {
        const outMs = opts.outMs || 1100, gap = opts.gap || 300, inMs = opts.inMs || 1900;
        if (cur) crossfade(cur, null, 0, outMs);
        active = next;
        seqT = setTimeout(() => {
          // superseded (straight back into a fight) or backgrounded meanwhile
          if (!want || keyOf(wantSrc) !== keyOf(src) || !musicOn() || hiddenPaused) return;
          startDeck(decks[next], src, resume);
          crossfade(null, decks[next], wantVol, inMs);
        }, outMs + gap);
        return;
      }
      startDeck(decks[next], src, resume);
      crossfade(cur, decks[next], wantVol, (opts && opts.ms) || CROSS);
      active = next;
    },
    stop() {
      want = false; wantSrc = null;
      if (active >= 0 && decks[active]) {
        try { posBySrc[keyOf(decks[active].a.src)] = decks[active].a.currentTime || 0; } catch (_) {}
        crossfade(decks[active], null, 0, 1000);
      }
    },
    // reflect a live toggle without losing the player's place in the track
    refresh() {
      ensure(); if (!decks.length) return;
      if (musicOn() && want && wantSrc) {
        const d = active >= 0 ? decks[active] : null;
        if (d && keyOf(d.a.src) === keyOf(wantSrc)) {
          const p = d.a.play(); if (p && p.catch) p.catch(() => {});
          crossfade(null, d, wantVol, 700);
        } else this.play(wantSrc, wantVol, true);
      } else if (active >= 0 && decks[active]) crossfade(decks[active], null, 0, 500);
    },
    // THE BEAT CLOCK. Where is the COMBAT deck, and when is its next grid point?
    // Reads whichever deck is carrying the battle theme and only while it is
    // actually audible, so the road's bed never drives the parry's timing.
    beat() {
      let a = null;
      for (const d of decks) {
        if (d && d.a && keyOf(d.a.src).indexOf('combat-theme') >= 0) { a = d.a; break; }
      }
      const playing = !!(a && !a.paused && musicOn() && (a.currentTime || 0) > 0.05 && a.volume > 0.01);
      return {
        playing, beatSec: MUSIC_BEAT,
        now: () => (a ? (a.currentTime || 0) : 0),
        // the next grid point at least `lead` seconds out, on a `sub`-second grid
        nextGrid: (lead, sub) => {
          const g = sub || MUSIC_BEAT;
          const tt = (a ? (a.currentTime || 0) : 0) + (lead || 0);
          return Math.ceil((tt - MUSIC_OFFSET) / g) * g + MUSIC_OFFSET;
        },
      };
    },
    // FOR THE CHECKS. The decks are `new Audio()` and therefore never in the
    // document, so a test cannot reach them with a querySelector — the first
    // pass of the music suite tried and silently measured nothing at all. Both
    // decks are reported, not just the foreground one, because half of what
    // this system has to get right is what the OUTGOING deck is doing.
    _state() {
      const d = active >= 0 ? decks[active] : null;
      const one = (x) => x ? { src: keyOf(x.a.src) || null, vol: x.a.volume,
                               paused: x.a.paused, at: x.a.currentTime || 0 } : null;
      return { want, wantSrc, wantVol, on: musicOn(), active,
               src: d ? keyOf(d.a.src) : null, vol: d ? d.a.volume : 0,
               paused: d ? d.a.paused : true, at: d ? (d.a.currentTime || 0) : 0,
               decks: decks.length, deck: decks.map(one),
               // where each track was bookmarked when it went out
               marks: Object.assign({}, posBySrc) };
    },
  };
})();

const beatWait = (ms) => new Promise(r => setTimeout(r, Math.max(0, ms)));
const BEAT_MS = 500;             // 120 BPM
// Beats of empty runway before the first note. It was 2 — a full second of an
// enemy turn spent looking at a bar with nothing in it, before a telegraph the
// player has already been reading all through their own turn. It is 1.5 now,
// and it is a FLOOR rather than the whole story: gridStart takes the larger of
// this and whatever runway the opening note's own kind is owed, so an intent
// that opens on a DRAW (2.3 beats to walk a figure) still gets its full read.
// Under the old constant it did not — 2.3 asked, 2 given, and the ring for the
// hardest note in the vocabulary spawned already closing.
const BEAT_LEADIN = 1.5;
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

// PHASE-LOCK THE VOLLEY TO THE TRACK. The parry grid has always run at 120 BPM
// — BEAT_MS is 500 — which is the combat theme's tempo exactly. What it never
// did was start on one of the track's beats: t0 was "two beats from whenever
// the volley happened to open", so the rings closed at the right INTERVAL and
// the wrong PHASE, and a bar of parries sat a random fraction of a beat off the
// music under it. Right tempo, wrong downbeat, which is the one way a rhythm
// read can feel wrong without looking wrong.
//
// So the runway is rounded forward to the track's next grid point. The audio
// element's clock and performance.now() are read as a pair and the difference
// converted, because the two are unrelated timebases. When the music is off or
// still blocked by autoplay, `playing` is false and the grid keeps its old
// free-running behaviour — the parry has never depended on the music and must
// not start.
function gridStart(leadBeats) {
  const lead = Math.max(BEAT_LEADIN, leadBeats || 0);
  const free = performance.now() + lead * BEAT_MS;
  let b = null;
  try { b = MUSIC.beat(); } catch (_) { return free; }
  if (!b || !b.playing) return free;
  const nowSec = b.now();
  // the lead-in, in seconds, rounded UP to the track's next beat — never
  // shortening the runway the hand is promised
  const target = b.nextGrid(lead * BEAT_MS / 1000, b.beatSec);
  const delta = (target - nowSec) * 1000;
  if (!isFinite(delta) || delta < 0) return free;
  return performance.now() + delta;
}

function beatOpen(totalNotes, leadBeats) {
  _grid = { t0: gridStart(leadBeats), idx: 0, note: 0, total: totalNotes };
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
const NOTE_WORD = { tap: 'TAP', slide: 'SLIDE', hold: 'HOLD', burst: 'MASH', feint: 'WAIT',
                    bait: 'DON\u2019T', draw: 'DRAW' };
// ═════════════════════════════════════════════════════════════════════════════
// THE DRAW — press anywhere, draw the shape, release on the beat.
// ═════════════════════════════════════════════════════════════════════════════
// THIS REPLACES THE TRACE, AND THE REASON IS THE TRACE'S DESIGN, NOT ITS BUGS.
// A trace drew a rail on screen and asked the finger to RIDE it: the press had
// to land on the ring itself (a stab at the far end was "not a grip, it is a
// guess"), progress advanced only while the finger stayed inside a 62px tube,
// and the ring had to be carried 93% of the way before a release counted. Three
// separate ways to be told "no" while your thumb is moving, on a phone, inside
// half a second. It went through two rebuilds — waypoints, then a rail, then
// finger-follow — and still did not feel good, which is the signal that the
// thing being iterated on was the wrong thing.
//
// What the note is FOR is the interesting part: it is the answer to a foe
// drawing a sigil in the air. So draw one back. Not a path to follow — a SHAPE
// to make. The judge asks the stroke three questions about its gross form and
// none about where it happened:
//
//   • is it big enough to be a deliberate gesture, not a wobble?
//   • does it turn the right amount?  (a circle turns ~360 degrees; a line ~0)
//   • does it end where a shape like that ends?  (a circle closes; a line does not)
//
// Everything else is allowed: start anywhere, any size over the floor, either
// direction round, any speed. That is the difference between "trace this" and
// "draw a circle", and it is the whole point.
const DRAW_MIN = 90;            // total path length before a stroke is a gesture
const DRAW_SHAPES = {
  // turn: how far the heading should rotate over the stroke, in radians.
  // close: how near the end must come back to the start, as a share of the
  //        stroke's own size — so a big circle and a small one are judged alike.
  circle: { word: 'CIRCLE', turn: Math.PI * 2, turnTol: Math.PI * 0.85, close: 0.42 },
};
// How far the heading turned across a stroke, summed with sign so a figure that
// doubles back cancels itself out rather than counting twice.
function strokeTurn(pts) {
  let sum = 0;
  for (let i = 2; i < pts.length; i++) {
    const a1 = Math.atan2(pts[i - 1][1] - pts[i - 2][1], pts[i - 1][0] - pts[i - 2][0]);
    const a2 = Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]);
    let d = a2 - a1;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    sum += d;
  }
  return sum;
}
function strokeLen(pts) {
  let n = 0;
  for (let i = 1; i < pts.length; i++) n += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return n;
}
// Did this stroke make the shape the note asked for? Returns 0..1 — 1 is a
// clean read, and anything at or above DRAW_OK counts. Reported rather than
// boolean so the ring can show the hand how close it is getting WHILE it draws.
const DRAW_OK = 0.6;
function drawScore(shapeId, pts) {
  const sh = DRAW_SHAPES[shapeId] || DRAW_SHAPES.circle;
  if (!pts || pts.length < 6) return 0;
  const len = strokeLen(pts);
  if (len < DRAW_MIN) return 0;
  // size, so `close` is judged against the gesture the hand actually made
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of pts) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const span = Math.max(maxX - minX, maxY - minY) || 1;
  const turn = Math.abs(strokeTurn(pts));
  const turnErr = Math.abs(turn - sh.turn) / sh.turnTol;          // 0 = exact
  const gap = Math.hypot(pts[pts.length - 1][0] - pts[0][0],
                         pts[pts.length - 1][1] - pts[0][1]) / span;
  const closeErr = Math.max(0, gap - sh.close) / sh.close;
  return Math.max(0, 1 - Math.max(turnErr, closeErr));
}

// What a note says at the GRADEABLE INSTANT, which for some kinds is not the
// verb it arrived with. A burst returns null — its label is a live tally and
// overwriting it blinded the first tap.
function liveLabel(kind, verb) {
  if (kind === 'burst') return null;
  // a draw is mid-figure when the beat arrives; its own label is a live read of
  // the shape, so the ring must not overwrite it (same rule as burst)
  if (kind === 'draw') return null;
  if (kind === 'hold') return 'RELEASE!';     // graded on the release, not the press
  if (kind === 'feint') return 'NOW!';        // WAIT was the read; this is the answer
  return verb + (kind === 'bait' ? '' : '!');
}
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
// A TRACE GETS THE MOST RUNWAY IN THE VOCABULARY. It is the only note whose
// answer takes real time to PERFORM rather than to decide — the figure has to
// be walked, and a hand given a slide's runway to walk an arc is being asked to
// start before it has finished reading.
const NOTE_LEAD = { draw: 2.3, slide: 1.7, bait: 1.7, burst: 1.6, feint: 1.3 };
// A breath between the hits of a volley. Six notes back-to-back is a wall; the
// same six in phrases of two with a rest between them is a bar.
//
// IT IS A FLOOR NOW, NOT AN ADDITION. The scheduler used to close each hit with
// `slot += max(beats) + 1` and then open the next with `slot += REST_BEATS` —
// two separate paddings that stacked, so consecutive hits sat a full two beats
// (1.0s) apart no matter what the last gesture was. Measured across the whole
// bestiary that cost 1.5s on every three-hit intent, and it bought nothing: the
// rings have long runways, so a probe found ZERO frames between the first ring
// and the last with nothing on screen. The gap was never air the player could
// see — it was air they had to sit through at the end.
//
// Now one rule spans both cases: the gap after a hit is the same MIN_GAP_AFTER
// floor that governs the gap between two notes INSIDE a hit, and this is the
// minimum it may shrink to. A hit that ends on a tap can be answered again
// quickly; a hit that ends on a hold cannot, and the table already knew that.
//
// IT IS A WHOLE BEAT, NOT A HALF, AND THE SUITE IS WHY. The first pass set this
// to 0.5 and the BEAT check went red: it asserts a real REST between hits,
// because six notes end to end is a wall whatever the per-gesture floors say.
// That check is protecting phrasing, not padding — a hit is supposed to read as
// a phrase — so the rule keeps a full beat of breath and gives back only the
// half that was pure stacking. Three-hit intents lose two beats rather than
// three; the bar is still a bar.
const REST_BEATS = 1;
// …and a burst gets a whole extra one after it.
const BURST_REST = 1;
// HOW LONG A GESTURE TAKES TO FINISH. A tap is over the instant it lands, so a
// second tap can follow half a beat later and read as a quick double. Anything
// that TRAVELS — a swipe, a held brace, a flurry — is not finished when it is
// graded: the hand is still moving. Authoring a slide and a tap a half-beat
// apart asks for two different gestures inside 250ms, which is not a hard read,
// it is an impossible one. The scheduler enforces this so no future string can
// re-create it, whatever the data says.
const MIN_GAP_AFTER = { tap: 0.5, feint: 1, bait: 1, slide: 1.5, hold: 1.5, burst: 2 };

// ═════════════════════════════════════════════════════════════════════════════
// ONE PRESS ANSWERS ONE NOTE.
// ═════════════════════════════════════════════════════════════════════════════
// Every live note used to attach its OWN pointerdown to the stage. A note is
// gradeable from land−260ms to land+290ms, so any authored gap under ~550ms
// left two notes listening at once — and a single finger fired both handlers.
//
// The Hymn opens `['tap','tap']` half a beat apart: 250ms. So one press on the
// first tap graded it PERFECT and silently ate the second as an early GOOD the
// player never played. The Regent's signature intent could not be played
// FLAWLESS at all, and the only way to TURN that hit was to deliberately
// mistime the first tap. The same overlap let a press aimed at the tap AFTER a
// bait count as touching the skull the player had correctly waited out —
// punishing discipline for being eager about a different note.
//
// A press now belongs to exactly one note: the live note whose beat it is
// nearest to. Everything else ignores it. This is what MIN_GAP_AFTER was
// reaching for and could not express — it was calibrated to how long a gesture
// takes to TRAVEL, and said nothing about how long a note stays gradeable.
const _live = [];
function liveOpen(rec) { _live.push(rec); }
function liveClose(rec) { const i = _live.indexOf(rec); if (i >= 0) _live.splice(i, 1); }
function claimsPress(rec, at) {
  let best = null, bestD = Infinity;
  for (const r of _live) {
    const d = Math.abs(at - r.landAt);
    if (d < bestD) { bestD = d; best = r; }
  }
  return best === rec;
}
// Sideways room between the notes of one hit, so a string reads as a run of
// positions rather than one point being shouted at repeatedly.
const NOTE_SPREAD = 58;

// One note: a ring closing on (ax, ay), exactly on its beat.
function runParryNote(spec, ax, ay, idx, total, dur, whoId, ox, oy, actSpec) {
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
    // A RAIL YOU CANNOT SEE IS A RAIL YOU CANNOT RIDE. The note draws the whole
    // journey from the frame it spawns — the line the ring will travel and the
    // mouth it has to reach — so the ask is a picture rather than a word the
    // player has to have learned.
    // THE SHAPE IS SHOWN, NOT A PATH. A rail said "carry the ring along here";
    // a ghost of the figure says "make this". The difference matters because
    // the second one can be made anywhere on the screen at any size, which is
    // the entire reason the note was reworked.
    const shape = kind === 'draw' ? (DRAW_SHAPES[dir] || DRAW_SHAPES.circle) : null;
    const glyph = kind === 'bait' ? '<span class="k-pr-x">' + SKULL_SVG + '</span>'
      // the figure itself, ghosted, with a live trail drawn over it as the
      // finger works — so the hand can see the shape it is actually making
      : kind === 'draw' ? '<span class="k-pr-sigil"></span>'
        + '<svg class="k-pr-ink" viewBox="-140 -140 280 280" aria-hidden="true">'
        + '<polyline class="k-pr-inkline" points="" /></svg>'
      : dir ? '<span class="k-pr-arrow">' + DIR_ARROW[dir] + '</span>'
      : kind === 'burst' ? '<span class="k-pr-burst"></span>' : '';
    // The verb is on screen from the first frame. It used to read "3/6" until
    // the ring went live, which told you WHEN but never WHAT, and left the read
    // and the answer sharing one window.
    // THE RING NAMES THE ATTACK, NOT THE INPUT. "SLIDE ->" describes what the
    // thumb does; "CLAW ->" describes what is coming at you and lets the thumb
    // follow from it. The note kind is still what grades the press — this is
    // the word over it.
    const act = actSpec ? parseAct(actSpec) : null;
    // …AND THE DRAW IS NOT AN EXCEPTION TO THAT. The first cut had it fall back
    // to the generic word, so the one note whose entire purpose is answering a
    // specific attack was the only one that did not name it: the ring read
    // "DRAW" over a cast. Everything takes the act's word when it has one.
    const verb = (act ? act.def.word : NOTE_WORD[kind] || '')
      + (dir && kind !== 'draw' ? ' ' + DIR_ARROW[dir] : '');
    ring.innerHTML = ''
      + '<span class="k-pr-target"></span><span class="k-pr-close"></span>'
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
    let done = false, downAt = null, taps = 0, wrongAt = null, owned = false;
    // THE STROKE THE HAND IS MAKING, in stage px relative to the ring's home.
    // `best` is the highest score this stroke has reached — a hand that closes
    // a circle and then keeps moving has still drawn one.
    let stroke = [], best = 0;
    // where the ring's home is on screen right now — the lens moves under it,
    // so this is read fresh rather than cached at spawn
    const homeAt = () => {
      const rb = ring.getBoundingClientRect();
      return { x: rb.left, y: rb.top,
               k: ring.offsetWidth ? rb.width / ring.offsetWidth : 1,
               // a zero-size element still reports its own position; the ring is
               // 0x0 by design and its rect IS the home point
               tx: parseFloat(ring.style.getPropertyValue('--tx')) || 0,
               ty: parseFloat(ring.style.getPropertyValue('--ty')) || 0 };
    };
    // EVERY POINT THE FINGER HAS VISITED, and the running read of what it is
    // making. The ring does not move: it is the anchor the figure is drawn
    // around, not a thing to be carried. Nothing here rejects a press for being
    // in the wrong PLACE — the whole judge is about the stroke's shape.
    const inkTo = (cx, cy) => {
      const h = homeAt();
      const k = h.k || 1;
      stroke.push([(cx - h.x) / k, (cy - h.y) / k]);
      if (stroke.length > 200) stroke.shift();
      const sc = drawScore(dir || 'circle', stroke);
      if (sc > best) best = sc;
      ring.style.setProperty('--ink', best.toFixed(2));
      ring.classList.toggle('k-pr-inked', best >= DRAW_OK);
      const line = ring.querySelector('.k-pr-inkline');
      if (line) line.setAttribute('points', stroke.map(pt =>
        pt[0].toFixed(0) + ',' + pt[1].toFixed(0)).join(' '));
      if (best >= DRAW_OK && lbl.textContent !== 'RELEASE!') lbl.textContent = 'RELEASE!';
    };
    // This note's claim on the finger: the arbiter hands each press to whichever
    // live note its timestamp is nearest to, and a note only listens while it
    // is registered. `finish` deregisters it.
    const me = { landAt: t0 + dur, kind };
    liveOpen(me);

    const liveT = setTimeout(function () {
      if (done) return;
      ring.classList.add('k-pr-live');
      // …except a burst, whose label is a live tally. Overwriting it with
      // "MASH!" destroyed the count at the instant the hand needed it, and it
      // only came back after the first tap — so the first tap was blind.
      // THE LABEL AT THE GRADEABLE INSTANT SAYS WHAT TO DO *NOW*, which for
      // two of the six kinds is not the same as the verb they arrived with.
      //
      // A HOLD is graded on the RELEASE, and "HOLD!" told the hand to keep
      // holding — the one word on screen was advice for the wrong action.
      //
      // A FEINT arrives saying WAIT, and is then graded exactly like a tap:
      // press on the beat. Doing nothing scores a MISS. Two independent
      // reviewers of this game read "WAIT" as "do nothing" — which is the
      // bait's rule, not the feint's — and that is the whole difficulty of the
      // note being taught backwards. WAIT is right while the ring is closing;
      // the moment it opens, the answer is NOW.
      const live = liveLabel(kind, verb);
      if (live != null) lbl.textContent = live;
      parrySlowmo(true);
    }, Math.max(0, dur - PARRY_GOOD_MS));
    // a burst must read as "start now", so it opens the moment it spawns
    if (kind === 'burst') { ring.classList.add('k-pr-open');
      lbl.textContent = 'MASH 0/' + BURST_TAPS; ring.style.setProperty('--burst', '0'); }

    const finish = function (q) {
      if (done) return;
      done = true;
      liveClose(me);
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
      const at = performance.now();
      if (!claimsPress(me, at)) return;      // a nearer note owns this finger
      owned = true;
      downAt = at;
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
      // A DRAW IS TAKEN ANYWHERE. The trace demanded the press land on the ring
      // itself, which on a phone means aiming at a 58px target with the thumb
      // that is about to draw with it — two jobs for one finger, and the first
      // one silently voided the note. The stroke starts wherever the hand is.
      if (kind === 'draw') {
        stroke = [];
        ring.classList.add('k-pr-held');
        inkTo(e.clientX, e.clientY);
        return;
      }
      if (kind === 'tap' || kind === 'feint') tryGrade();
    };
    const onMove = function (e) {
      if (!owned || downAt == null) return;
      if (kind === 'draw') { inkTo(e.clientX, e.clientY); return; }
      if (kind !== 'slide') return;
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
      // a hold is graded on RELEASE, so it may only grade a press it owned
      if (kind === 'hold' && owned && downAt != null) tryGrade();
      // A DRAW IS GRADED ON THE RELEASE, once the figure reads. Lifting early is
      // not a miss on its own — the timer below decides that — because a hand
      // that lifts and puts itself back down still has until the beat, and
      // punishing the lift would make one bad frame end the note.
      if (kind === 'draw' && best >= DRAW_OK) tryGrade();
      if (kind === 'draw') ring.classList.remove('k-pr-held');
      downAt = null; owned = false;
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
      // A FIGURE ALMOST MADE IS NOT NOTHING. Draw a shape that reads most of the
      // way and fail only to let go on the beat, and it pays one grade — the
      // same way a slide that went wrong and corrected does.
      if (kind === 'draw' && best >= DRAW_OK * 0.75) return finish('good');
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
  // NOT 'WAIT…'. A feint's own correct label is WAIT, so the same word was
  // both the right answer to one note and the penalty for rushing another —
  // and the Hymn plays tap/feint/hold, so a new player meets both inside one
  // bar. The nudge says what actually happened instead.
  tag.textContent = 'EARLY';
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
// ═════════════════════════════════════════════════════════════════════════════
// THE STRING TRACK — the all-or-nothing rule, made visible while you play it.
// ═════════════════════════════════════════════════════════════════════════════
// A whole string read GREAT-or-better TURNS the blow; one GOOD and the negate,
// the Break and the Kizuna all evaporate. That is the sharpest rule in the
// game and it was completely invisible: nothing on screen counted the notes,
// nothing said the payout had already gone, and every verdict arrived at once
// after the last note of the whole bar. You could play four more notes of a
// string that had been dead since the first.
//
// One pip per note, over the hero being struck. It fills gold as each note
// lands clean, and the whole row goes cold the moment one drops — which is
// both the honest state and the clearest possible teaching of the rule.
function stringTrack(heroId, n) {
  const stage = el('k-stage'); if (!stage) return null;
  const box = document.createElement('div');
  // A TRACK BELONGS TO ITS HIT, not to the bar. All the hits are scheduled up
  // front, so creating the tracks visible put three rows of pips on screen at
  // once — two of them for blows that had not been thrown yet. Each wakes when
  // its own first note does.
  box.className = 'k-strack k-strack-idle';
  box.dataset.hero = heroId;
  box.innerHTML = Array.from({ length: n }, () => '<i></i>').join('');
  stage.appendChild(box);
  const place = () => {
    const a = anchorFor(heroId);
    if (!a) return;
    box.style.left = a.x + 'px';
    box.style.top = (a.y - 46) + 'px';
  };
  place();
  return {
    el: box, place,
    wake() { box.classList.remove('k-strack-idle'); },
    mark(i, grade) {
      const pip = box.children[i]; if (!pip) return;
      const clean = grade === 'perfect' || grade === 'great';
      pip.className = clean ? (grade === 'perfect' ? 'on best' : 'on') : 'off';
      if (!clean) box.classList.add('k-strack-lost');
    },
    done() { box.classList.add('k-strack-out'); setTimeout(() => box.remove(), 420); },
  };
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
  let thread = null, threadHero = null;
  const tracks = [];
  let anchorRaf = requestAnimationFrame(function reanchor() {
    tracks.forEach(t => t.place());       // the track rides the lens too
    let soonest = null, soonestT = Infinity;
    document.querySelectorAll('.k-pring[data-hero]').forEach(r => {
      const a = anchorFor(r.dataset.hero);
      if (!a) return;
      r.style.left = (a.x + (+r.dataset.ox || 0)) + 'px';
      r.style.top = (a.y + (+r.dataset.oy || 0)) + 'px';
      // whichever note lands next is the one the blow is currently aimed at
      const t = +r.dataset.impact || 0;
      if (t < soonestT) { soonestT = t; soonest = r.dataset.hero; }
    });
    // THE THREAD FOLLOWS THE BLOW. It used to be drawn once to the first
    // answerer and held for the whole bar, so during the Rain it still ended
    // on Ash while Elin's and Mira's notes were flying — the one cue that says
    // "this comes at HER" pointed at the wrong hero for every hit but the
    // first. It is redrawn only when the hero changes, not every frame.
    if (soonest && soonest !== threadHero) {
      threadHero = soonest;
      if (thread) thread.remove();
      const a = anchorFor(soonest);
      thread = parryThread(el('k-boss-art'), a ? a.x : 466, a ? a.y : 200);
    }
    anchorRaf = requestAnimationFrame(reanchor);
  });
  // EVERY PRESS REGISTERS. A press that lands between notes, or a fourth tap in
  // a flurry, used to do nothing at all — the hand could not tell "too early"
  // from "not registered", which is the worst thing a rhythm read can be.
  const onPress = (e) => pressRipple(e.clientX, e.clientY);
  stage.addEventListener('pointerdown', onPress, true);
  // THE RUNWAY IS THE OPENING NOTE'S, NOT A CONSTANT. A bar that opens on a
  // draw needs 2.3 beats before its ring is honest; one that opens on a tap
  // needs one. Asking for the larger of the two means the leadin can come down
  // for the common case without shortening the read on the rare hard one.
  const openLead = NOTE_LEAD[parseNote(kinds[0]).kind] || 1;
  beatOpen(kinds.length, openLead);
  await beatWait(BEAT_LEADIN * BEAT_MS * 0.5);

  const jobs = [];
  let gi = 0, slot = 0;
  for (let hi = 0; hi < hits.length; hi++) {
    const who = answerers[hi];
    const pos = anchorFor(who);
    const inHit = hits[hi].notes.length;
    const track = stringTrack(who, inHit);
    if (track) tracks.push(track);
    // A HIT CAN HAVE A RHYTHM. `beats` places each note in the hit's own bar,
    // so a string can syncopate — a quick double on the half-beat, a hesitation
    // before the last blow — instead of every enemy playing a metronome.
    const want = hits[hi].beats || hits[hi].notes.map((_, i) => i);
    // …clamped so a gesture always has time to finish before the next is asked for
    const beats = [];
    for (let ni = 0; ni < inHit; ni++) {
      const asked = want[ni] == null ? ni : want[ni];
      if (ni === 0) { beats.push(asked); continue; }
      const prev = parseNote(hits[hi].notes[ni - 1]).kind;
      // THE FLOOR IS A DURATION, NOT A BEAT COUNT. Phase 2's `sub` shortens
      // the beat, so a floor expressed in beats quietly shortened the hand's
      // time with it — the Rain's tap→slide dropped from 750ms to 562ms while
      // the grading windows stayed absolute. Dividing by `sub` keeps the
      // wall-clock gap the table is actually promising.
      const gapBeats = (MIN_GAP_AFTER[prev] == null ? 1 : MIN_GAP_AFTER[prev]) / (sub || 1);
      const floor = beats[ni - 1] + gapBeats;
      beats.push(Math.max(asked, floor));
    }
    for (let ni = 0; ni < inHit; ni++) {
      const type = hits[hi].notes[ni];
      const act = (hits[hi].acts || [])[ni] || null;
      const idx = gi++, beat = slot + beats[ni];
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
        if (track && ni === 0) track.wake();
        document.querySelectorAll('.k-hero').forEach(h =>
          h.classList.toggle('k-parrying', h.dataset.hero === who));
        const dur = Math.max(180, Math.round(land - performance.now()));
        // THE BLOW IS THROWN HERE, so this is where the thing throwing it moves.
        fxFoeSwing(act);
        const g = await runParryNote(type, pos.x + ox, pos.y + oy, idx + 1, kinds.length, dur,
                                     who, ox, oy, act);
        if (track) {
          track.mark(ni, g);
          // …and it leaves when ITS hit is finished, not when the bar is. Held
          // to the end of the bar, three tracks stacked up on screen at once.
          if (ni === inHit - 1) setTimeout(() => track.done(), 520);
        }
        return g;
      })());
    }
    // WHERE THE NEXT HIT STARTS. One rule, and it is the one already governing
    // two notes inside a hit: whatever the last gesture was, the hand needs that
    // long to finish it — never less than a half-beat of breath. This replaced a
    // flat `+1` close and a flat `+1` rest that stacked into a full two beats
    // between every pair of hits regardless of what had just been asked.
    const lastBeat = Math.max.apply(null, beats.map(b => b == null ? 0 : b));
    const lastKind = parseNote(hits[hi].notes[inHit - 1]).kind;
    const close = MIN_GAP_AFTER[lastKind] == null ? 1 : MIN_GAP_AFTER[lastKind];
    slot = lastBeat + Math.max(REST_BEATS, close / (sub || 1));
    // A MASH NEEDS ITS OWN AIR. Three taps inside one ring while the next note
    // is already closing is not a hard read, it is two hands' worth of work —
    // and the taps meant for the flurry rained on whatever came next.
    if (hits[hi].notes.some(n => parseNote(n).kind === 'burst')) slot += BURST_REST;
  }
  const grades = await Promise.all(jobs);
  tracks.forEach(t => t.done());
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
  bgParallax(s, clamp);
}
// PARALLAX. The backdrop is not in #k-cast — it is a plate behind the whole
// volume — so it never moved, and a lens that swung the cast across a fixed
// painting is what made a 3D board read as figures on a poster.
//
// It takes a REDUCED share of the same numbers rather than its own animation,
// so it can never disagree with the camera: a far plane shifts the same way
// the near one does and by less, which is the whole of parallax. The dolly is
// the exception — pushing in barely changes a horizon — so it buys a little
// scale instead of a lot of travel. Timing is shared through --cam-ms.
const BG_PAN = 0.30, BG_LIFT = 0.24, BG_ROLL = 0.34, BG_ZOOM = 0.00042;
function bgParallax(s, clamp) {
  const b = document.getElementById('k-backdrop'); if (!b) return;
  const dz = clamp(s.dz, CAM_MAX_DZ);
  b.style.setProperty('--bg-x', (clamp(s.x, CAM_MAX_PAN) * BG_PAN).toFixed(2) + 'px');
  b.style.setProperty('--bg-y', (clamp(s.y, CAM_MAX_PAN * 0.5) * BG_LIFT).toFixed(2) + 'px');
  b.style.setProperty('--bg-r', (clamp(s.r, CAM_MAX_ROLL) * BG_ROLL).toFixed(3) + 'deg');
  // the over-scale is the parallax slack: it must always exceed the largest
  // travel the pan can ask for, or the plate's edge walks into frame
  b.style.setProperty('--bg-s', (1.1 + dz * BG_ZOOM).toFixed(4));
  // THE PLATE NEEDS ITS OWN TIMING VARS. #k-backdrop is a SIBLING of #k-cast,
  // not a descendant, and a custom property inherits down rather than
  // sideways — so reading --cam-ms here silently fell through to the 420ms
  // default and the backdrop ignored every duration the camera asked for.
  b.style.setProperty('--bg-ms', (s.ms == null ? 420 : s.ms) + 'ms');
  b.style.setProperty('--bg-ease', s.ease || CAM_SNAP);
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
// A FRESH FIGHT OPENS ON THE PLAYER'S SHOT, INSTANTLY AND FROM ANY STATE.
// camReset settles to whatever pose is CURRENT, and a hold suppresses it
// entirely — so a fight started while a punch-in was still held (an all-out,
// a parry ring, a killing blow that rolled straight into the next stop) opened
// on the previous fight's camera. The whole cast then sat several pixels left
// of where the layout puts it, which is how Elin ended up sitting on the
// KIZUNA ladder: the ladder had not moved, the party had.
function camHome() {
  clearTimeout(_camOutT); _camOutT = null;
  _camHeld = 0; _camBase = CAM_POSE_PLAYER;
  cam(Object.assign({}, CAM_POSE_PLAYER, { ms: 0, ease: CAM_SETTLE, force: true }));
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
  // FAN AND STAGGER. A 26px spread was narrower than the digits themselves at
  // the md/lg tiers, so a volley resolving in one frame printed two 9s that
  // read as "99" — the exact smear Build 22 set out to kill, recreated by
  // resolving several hits simultaneously. Wider, and lifted as well as
  // spread, so two numbers can never share a baseline.
  const i = _popSeq++ % 3;
  p.style.setProperty('--pop-dx', (i === 0 ? 0 : i === 1 ? -52 : 52) + 'px');
  p.style.setProperty('--pop-dy', (i === 0 ? 0 : i === 1 ? -14 : 12) + 'px');
  p.style.left = ((r.left + r.width / 2 - sr.left) / scale) + 'px';
  p.style.top = ((r.top + r.height * 0.26 - sr.top) / scale) + 'px';
  stage.appendChild(p);
  setTimeout(() => p.remove(), 1100);
}
// the blow itself — reels the Regent and shakes the frame, no number
let _slashN = 0;
function fxStrikeBoss(n, why) {
  const b = document.getElementById('k-boss-art');
  if (b) { b.classList.remove('k-recoil'); void b.offsetWidth; b.classList.add('k-recoil'); }
  foeAnimReact('hit', 340);          // the window k-recoil runs for
  // THE SOUND SAYS WHAT THREW IT, the same way the visual effect does: steel
  // scrapes and rings, a spell blooms, and a bleed tick is the plain impact.
  if (_act && why === 'hit')
    sfx(_act.kind === 'cast' ? 'cast' : (_act.heavy ? 'heavy' : 'slash'), 0.7 + Math.min(1, n / 14));
  else sfx('slash', 0.55);
  // A BLOW LOOKS LIKE WHAT THREW IT. Steel cuts; a spell breaks over the
  // target; a bleed tick is neither and keeps the plain impact it always had.
  if (_act && why === 'hit') {
    if (_act.kind === 'slash') fxSlash(b, _slashN++, _act.heavy);
    else if (_act.kind === 'cast') fxBurst(b, _act.tone);
  }
  fxImpact(b, Math.min(2.4, n / 6), why === 'bleed' ? 'bleed' : 'hit', 'r');
}
// A spell does not cut — it breaks over the thing it hits.
function fxBurst(node, tone) {
  const S = stageBox(); if (!S || !node) return;
  const c = centreOf(node); if (!c) return;
  const b = document.createElement('i');
  b.className = 'k-burst k-tone-' + (tone || 'light');
  b.style.left = c.x + 'px'; b.style.top = (c.y + 46) + 'px';
  S.st.appendChild(b);
  setTimeout(() => b.remove(), 520);
}
// the number, once, for whatever the whole card added up to
function popDamage(n, why) {
  // A spell's number is the colour of the spell. Steel keeps the house red;
  // ice, light and life each read as themselves, so the number agrees with
  // the thing that threw it instead of contradicting it.
  const tone = (_act && _act.kind === 'cast' && why === 'hit') ? ' k-pop-tone k-tone-' + _act.tone : '';
  popupOver(document.getElementById('k-boss-art'), fmtN(n),
    (why === 'bleed' ? 'k-pop-bleed' : 'k-pop-dmg') + ' ' + POP_TIER(n) + tone);
}
function fxDamageBoss(n, why) { fxStrikeBoss(n, why); popDamage(n, why); }
function fxBreak() { const el = document.getElementById('k-break'); if (el) { el.classList.remove('k-flash'); void el.offsetWidth; el.classList.add('k-flash'); } }
// ═════════════════════════════════════════════════════════════════════════════
// WHAT KIND OF THING JUST HAPPENED.
// ═════════════════════════════════════════════════════════════════════════════
// Every card used to land with the same bundle — a shake, a flash, a ring —
// whether it was a sword, a spell or a bandage. The board could tell you THAT
// something hit and never WHAT hit, so a fight full of different verbs read as
// one repeated thump.
//
// The kind is DERIVED from the same effects the card face reads, by the same
// rule as `cardGlyphs`, so the animation can never disagree with the card. A
// card that stops dealing damage stops swinging, without anyone remembering to
// change the animation.
const ORACLE = 'elin';                      // the caster; her verbs are spoken, not swung
function actionKind(card, effects) {
  const has = (k) => effects.some(fx => fx[k]);
  const heroes = ownerHeroes(card);
  const caster = heroes.indexOf(ORACLE) >= 0;
  if (has('heal') || has('healAll')) return 'heal';
  if (has('chill') || caster) return 'cast';
  if (has('dmg')) return 'slash';
  if (has('guardSelf') || has('guardAll') || has('guardAlly') || has('guardLowest')) return 'ward';
  return 'slash';
}
// What a cast is made of decides its colour: frost is cold, mending is green,
// a ward is steel, and light is gold.
function castTone(effects) {
  const has = (k) => effects.some(fx => fx[k]);
  if (has('chill')) return 'ice';
  if (has('heal') || has('healAll')) return 'life';
  if (has('guardAll') || has('guardSelf') || has('guardAlly') || has('guardLowest')) return 'ward';
  return 'light';
}

// The action currently resolving, so the blow that lands knows what threw it.
// Same shape as `_dmgBatch`, and set and cleared in the same place.
let _act = null;

// ── the slash ────────────────────────────────────────────────────────────────
// A cut, drawn across the thing that was cut: a bright edge that sweeps in and
// wipes out, angled differently per hit so two strikes read as two strikes and
// not as one thing flickering twice.
const SLASH_ANGLE = [-27, 21, -13, 34];
function fxSlash(node, i, heavy) {
  const S = stageBox(); if (!S || !node) return;
  const c = centreOf(node); if (!c) return;
  const el2 = document.createElement('i');
  el2.className = 'k-slash' + (heavy ? ' k-slash-heavy' : '');
  el2.style.setProperty('--ang', (SLASH_ANGLE[i % SLASH_ANGLE.length]) + 'deg');
  // …biased DOWN the art box, because the figure inside it stands on the
  // bottom edge and the box's own centre is mostly empty sky above her head
  el2.style.left = (c.x + (i % 2 ? 16 : -14)) + 'px';
  el2.style.top = (c.y + 46 + (i % 2 ? -22 : 16)) + 'px';
  S.st.appendChild(el2);
  setTimeout(() => el2.remove(), heavy ? 460 : 340);
}

// ── the cast ─────────────────────────────────────────────────────────────────
// A spell is ANNOUNCED. The ring blooms under the caster before anything lands,
// which is the whole difference between a spell and a punch — you can see it
// coming, and so, in the fiction, could the thing it is aimed at.
function fxCast(heroId, tone, toNode) {
  const S = stageBox(); if (!S) return;
  const h = document.querySelector('.k-hero[data-hero="' + heroId + '"]');
  const c = centreOf(h); if (!c) return;
  const ring = document.createElement('i');
  ring.className = 'k-rune k-tone-' + tone;
  ring.style.left = c.x + 'px';
  ring.style.top = (c.y + 34) + 'px';
  S.st.appendChild(ring);
  setTimeout(() => ring.remove(), 620);
  if (h) { h.classList.remove('k-casting'); void h.offsetWidth; h.classList.add('k-casting');
           setTimeout(() => h.classList.remove('k-casting'), 620); }
  // and the spell travels, so the target is visibly the target
  const t = toNode ? centreOf(toNode) : null;
  if (!t) return;
  for (let i = 0; i < 5; i++) {
    const m = document.createElement('i');
    m.className = 'k-mote k-tone-' + tone;
    m.style.left = c.x + 'px';
    m.style.top = (c.y + 10) + 'px';
    m.style.setProperty('--dx', (t.x - c.x + (i - 2) * 12) + 'px');
    m.style.setProperty('--dy', (t.y - c.y + (i % 2 ? -14 : 10)) + 'px');
    m.style.animationDelay = (i * 42) + 'ms';
    S.st.appendChild(m);
    setTimeout(() => m.remove(), 700 + i * 42);
  }
}

// ── the ward ─────────────────────────────────────────────────────────────────
// Build 36 sorted every card into four verbs — heal, cast, slash, ward — and
// then shipped animations for three. A guard card played its cost, changed a
// number in the roster and did NOTHING on the board, which is the same
// complaint that build set out to answer, surviving inside its own fix.
function fxWard(heroId, n) {
  const S = stageBox(); if (!S || !n) return;
  const h = document.querySelector('.k-hero[data-hero="' + heroId + '"]');
  if (!h) return;
  const c = centreOf(h);
  h.classList.remove('k-warded'); void h.offsetWidth; h.classList.add('k-warded');
  setTimeout(() => h.classList.remove('k-warded'), 280);
  if (c) {
    const pl = document.createElement('i');
    pl.className = 'k-ward';
    pl.style.left = c.x + 'px'; pl.style.top = (c.y + 18) + 'px';
    S.st.appendChild(pl);
    setTimeout(() => pl.remove(), 680);
  }
  popupOver(h, '\u2688' + fmtN(n), 'k-pop-ward');
}

// ── the mend ─────────────────────────────────────────────────────────────────
// Healing used to be invisible: a number in the roster changed and nothing on
// the board moved. The one card in the deck whose whole job is to undo damage
// had less feedback than a card that missed.
function fxHeal(heroId, n) {
  if (n > 0) sfx('heal', 0.8 + Math.min(0.6, n / 14));
  const S = stageBox(); if (!S || !n) return;
  const h = document.querySelector('.k-hero[data-hero="' + heroId + '"]');
  if (!h) return;
  const c = centreOf(h);
  h.classList.remove('k-mended'); void h.offsetWidth; h.classList.add('k-mended');
  setTimeout(() => h.classList.remove('k-mended'), 300);
  if (c) {
    for (let i = 0; i < 6; i++) {
      const m = document.createElement('i');
      m.className = 'k-life';
      m.style.left = (c.x + (i - 2.5) * 13) + 'px';
      m.style.top = (c.y + 26) + 'px';
      m.style.animationDelay = (i * 55) + 'ms';
      S.st.appendChild(m);
      setTimeout(() => m.remove(), 900 + i * 55);
    }
  }
  popupOver(h, '+' + fmtN(n), 'k-pop-heal k-pop-md');
}

function fxPlayCard(cardId, ev) {
  const heroId = primaryHero(ev.card);
  const h = document.querySelector('.k-hero[data-hero="' + heroId + '"]');
  if (h) { h.classList.remove('k-acts'); void h.offsetWidth; h.classList.add('k-acts'); }
  if (ev.condActive && ev.card.cond) fxComboCall(ev.card.cond.type, h);
}
// A combo that only shows up as a bigger number is a combo nobody notices they
// built. It gets its own name, struck over the hero who closed it, and a
// FINALE gets the whole board — this is the payoff the deck is named for.
// TWO ANNOUNCEMENTS MUST NOT SHARE A BEAT. A FINALE that also generates the
// Resonance printed "ALL THREE" and "RESONANCE" on the same centre point at
// the same instant, and the result was unreadable mush at exactly the moment
// the game most wants to be read.
function callSpace() {
  // Only ever waits on a call that is ON SCREEN RIGHT NOW. A timestamp-based
  // spacer also delayed calls that had nothing to collide with — an unrelated
  // announcement half a second earlier pushed the next one out, which is a
  // worse bug than the overlap it was fixing.
  return document.querySelector('.k-combo-call') ? 320 : 0;
}
function fxComboCall(type, node) {
  const S = stageBox(); const c = centreOf(node);
  if (!S) return;
  const wait = callSpace();
  if (wait > 0) { setTimeout(() => fxComboCall(type, node), wait); return; }
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
  // A FINALE that also births the Resonance used to strike both words on the
  // same point in the same frame. This one waits its turn.
  const wait = callSpace();
  if (wait > 0) { setTimeout(fxResonanceBorn, wait); return; }
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
  // `spent` means the string was read clean but this hero had already spent
  // their one full negate this action — the deck's response limit.
  const at = document.querySelector('.k-hero[data-hero="' + heroId + '"]');
  if (!at || !read.notes) return;
  const stage = document.getElementById('k-stage'); if (!stage) return;
  const sr = stage.getBoundingClientRect(), r = at.getBoundingClientRect();
  const scale = sr.width / stage.offsetWidth || 1;
  const tag = document.createElement('div');
  const crown = read.flawless ? 'FLAWLESS' : read.turned ? 'TURNED' : read.spent ? 'SPENT' : null;
  tag.className = 'k-receipt' + (crown ? ' k-receipt-crown' : '');
  tag.innerHTML = crown
    ? '<b>' + crown + '</b><span>' + (read.spent
        ? 'read clean — but this hero already spent their negate'
        : 'the blow is turned aside') + '</span>'
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
  // the one place every graded press passes through, so the ladder is heard in
  // exactly the order it is scored
  sfx(grade === 'perfect' ? 'perfect' : grade === 'great' ? 'great'
    : grade === 'good' ? 'good' : grade === 'late' ? 'late' : 'miss',
    kind === 'burst' ? 1.15 : 1);
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
  const ms = fastFx() ? 40 : (o.ms || 380);
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

// The dirge's shape, in one place. LEAD is the darkening before anyone is
// touched; STEP is the gap between one hero and the next — wide enough that
// three numbers never share a frame; TAIL is the breath before the turn moves
// on, so the last number is not still rising when the hand starts drawing.
const DIRGE_LEAD = 190, DIRGE_STEP = 240, DIRGE_TAIL = 300;
// How long the killing blow is allowed to read before the body starts to fall.
// Long enough for the impact flash to clear (it fades over ~380ms), short
// enough to sit well inside the 1750ms the road waits before it takes over.
const FOE_DEATH_HOLD = 420;
const sleep = (ms) => new Promise(r => setTimeout(r, (typeof window !== 'undefined' && window.__SIM) ? 0 : (fastFx() ? Math.min(ms, 24) : ms)));
// THE SWEEP, Spire-style: each card LEAVES the hand as its ghost launches, so
// the fan closes behind it and the pile grows under it. The old version flew a
// ghost while the original sat in place until the last one had gone, which read
// as the hand duplicating itself rather than emptying.
async function fxSweepHand() {
  const target = document.getElementById('k-disc-btn');
  const mine = C.id;                       // the fight this sweep belongs to
  // RETAIN STAYS. The sweep used to shift from the front until the hand was
  // empty; a kept card has to be stepped OVER rather than counted out, or the
  // loop walks off the end of a hand that never empties.
  const going = C.hand.filter(id => sigilOf(id) !== 'retain');
  const n = going.length;
  for (let i = 0; i < n; i++) {
    const S = stageBox();
    const id = going[i];
    const node = document.querySelector('.k-card[data-card="' + id + '"]');
    const from = S && node ? boxOf(node, S) : null;
    const html = node ? node.innerHTML : '';
    if (!C || C.id !== mine) return;    // a new fight started; this hand is gone
    C.hand.splice(C.hand.indexOf(id), 1);
    C.discard.push(id);
    renderHand();                       // the ranks close in the same frame
    renderPiles();
    if (from && target) {
      flyCard(from, target, { spin: -16 - i * 7, arc: 46 + i * 8, ms: 460, html });
      pileThump('discard');
    }
    await sleep(fastFx() ? 4 : 95);
  }
  await sleep(fastFx() ? 6 : 260);
  if (!C || C.id !== mine) return;
}
// THE DRAW BUILDS THE HAND. Every arriving card used to force a full re-layout
// with no transition, so the four cards already held SNAPPED to new angles five
// times in a row — which is what made the top of the turn look broken. The fan
// now glides to its new shape while the newcomer flies in over it, and the card
// lands face-up with a flip rather than appearing.
// THE DISCARD GOES HOME. When the draw pile runs dry the whole discard flies
// back across the board and lands as the new deck, and only then does the next
// card come off it — so the moment reads as "you have been through the whole
// deck once", which in a fifteen-card deck is a real piece of information about
// the fight rather than a bookkeeping detail.
async function fxReshuffle() {
  const S = stageBox();
  const deck = document.getElementById('k-deck-btn');
  const disc = document.getElementById('k-disc-btn');
  if (!S || !deck || !disc) return;
  const from = boxOf(disc, S);
  renderPiles();                                  // the counts have already swapped
  if (!from) return;
  // a short stack of face-down cards crossing the board, staggered so it reads
  // as a handful of cards rather than one object sliding. `flyCard` measures its
  // destination from a live ELEMENT, so the deck button is handed in directly —
  // a pre-measured box is silently ignored and the flight never leaves.
  const FAN = 5;
  const flights = [];
  for (let i = 0; i < FAN; i++) {
    flights.push(new Promise(res => setTimeout(() => {
      flyCard(from, deck, { faceDown: true, fadeOut: true, grow: false, flip: false,
                            spin: 18 - i * 7, arc: -54 - i * 9, ms: 420 })
        .then(res, res);
    }, i * 55)));
  }
  setTimeout(() => {
    deck.classList.remove('k-pile-thump'); void deck.offsetWidth;
    deck.classList.add('k-pile-thump');
    setTimeout(() => deck.classList.remove('k-pile-thump'), 320);
  }, 300);
  logLine('The deck is spent — what was played is shuffled back.');
  await Promise.all(flights);
  await sleep(90);
}

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
  // THE STAGGER IS NOT THE FLIGHT. Each card's flight is 420ms and they overlap
  // freely; this is only the gap between one leaving the pile and the next. At
  // 230ms five cards cost 1.15s of a turn in which nothing is playable and
  // nothing is being decided — the hand is already known, it is arriving. At
  // 130 the fan still builds card by card and the top of the turn comes half a
  // second sooner.
  await sleep(fastFx() ? 8 : 130);
}
// THE DIRGE SETTLES; IT DOES NOT DROP. Every other blow in the turn earns its
// own beat — the volley spaces four hits 330ms apart, each with one number over
// one hero — and then the dirge, the tax that actually decides runs, arrived as
// a single frame with three numbers in it, landing on top of the volley's
// numbers that had not finished clearing. Six figures on screen at once, and
// the one the player most needs to read is the one they cannot.
//
// So it sweeps. The stage darkens FIRST — the hymn is heard before it is felt —
// and then it takes the party one at a time, front to back, far enough apart to
// count three separate people being hurt by the same thing.
async function fxDirgeOpen() {
  const s = document.getElementById('k-stage');
  if (s) { s.classList.remove('k-dirge'); void s.offsetWidth; s.classList.add('k-dirge');
    setTimeout(() => s.classList.remove('k-dirge'), 700); }
  await sleep(DIRGE_LEAD);
}
// One hero's share of it. The HP is applied by the caller immediately before
// this runs, so the bar drains WITH the number rather than three turns' worth
// of bars dropping at once behind the first figure — the same lie
// fxHitResolved was written to stop the volley telling.
async function fxDirgeOne(id, n, last) {
  renderPartyHud();
  const at = document.querySelector('.k-hero[data-hero="' + id + '"]');
  if (n > 0) {
    popupOver(at, fmtN(n), 'k-pop-dirge k-pop-md');
    fxImpact(at, 1.1, 'hurt', 'l');
    sfx('hurt', 0.5);
  } else {
    // GUARD THAT ATE THE WHOLE HYMN IS THE BEST THING GUARD EVER DOES, and it
    // used to print "0" — or, before the sweep, nothing distinguishable at all.
    // Banking Guard against the dirge is the counterplay the tax is supposed to
    // teach, so the turn it works has to look like it worked.
    fxDeflect(at, false);
    sfx('guard', 0.85);
  }
  await sleep(last ? DIRGE_TAIL : DIRGE_STEP);
}
async function fxInterrupt() {
  const b = document.getElementById('k-boss-art');
  if (!b) return;
  b.classList.add('k-broken');
  foeAnimReact('broken', 700);
  sfx('brk', 1.4);
  await sleep(700);
  b.classList.remove('k-broken');
}
async function fxBossHeal() { popupOver(document.getElementById('k-boss-art'), '+heal', 'k-pop-heal'); await sleep(500); }
async function fxHitResolved(tgtId, taken, negated, flawless) {
  // THE BAR DRAINS WITH THE NUMBER. The HP was applied the moment the blow
  // landed but nothing redrew until the whole turn was over, so the popup said
  // "-9" and the party stayed at full health until the next player phase —
  // three hits of a volley arrived as one lump of damage after the fact.
  renderPartyHud();
  const at = tgtId && document.querySelector('.k-hero[data-hero="' + tgtId + '"]');
  if (taken > 0) {
    popupOver(at || document.getElementById('k-party-hud'), fmtN(taken),
      'k-pop-dmg k-pop-hurt ' + POP_TIER(taken + 4));   // a hero has less HP; the same
                                                        // number hurts them more
    fxImpact(at, Math.min(2.4, taken / 5), 'hurt', 'l');
    sfx('hurt', 0.6 + Math.min(1, taken / 12));
  } else if (negated) {
    fxDeflect(at, !!flawless);
    sfx('guard', flawless ? 1.2 : 0.9);
  }
  // THE BEAT IS AS LONG AS THERE IS SOMETHING TO READ. A blow that landed puts
  // a number over a hero and drains a bar, and 330ms is the time that takes to
  // register. A blow TURNED ASIDE has already said everything it is going to
  // say — the deflect fired the instant the note was read, seconds ago — and
  // holding the screen for it is charging the player for playing well.
  //
  // Which makes the whole enemy turn shorter the better the bar is answered.
  // That is the right way round: in this game skill is supposed to buy tempo,
  // and until now a perfect parry and a whiffed one cost exactly the same
  // wall-clock.
  await sleep(taken > 0 ? 330 : 170);
}
// AP COMES BACK. A refund that only shows up as a mark quietly re-lighting is a
// rule the player has to be told; this is the mark arriving from the card that
// paid for it, so the refund reads as a consequence of the play.
function fxApRefund(n) {
  const row = el('k-ap-pips'); if (!row) return;
  const pips = row.querySelectorAll('.k-ap-pip');
  for (let i = 0; i < n; i++) {
    const p = pips[Math.max(0, pips.length - 1 - i)];
    if (!p) continue;
    p.classList.remove('k-ap-back'); void p.offsetWidth; p.classList.add('k-ap-back');
    setTimeout(() => p.classList.remove('k-ap-back'), 700);
  }
  sfx('resonance', 0.7);
}
// …AND THE CEILING RISES. A different beat from a refund on purpose: a refund
// is one mark blinking back on, this is the whole row growing, and the two must
// not look alike or the permanent thing reads as the temporary one.
function fxApGear() {
  const row = el('k-ap'); if (!row) return;
  row.classList.remove('k-ap-gear'); void row.offsetWidth; row.classList.add('k-ap-gear');
  setTimeout(() => row.classList.remove('k-ap-gear'), 1200);
}
function testMode() { return /[?&]test=1/.test(location.search); }
// TEST MODE STRIPS THE TIMING OUT — every sleep is capped at 24ms so two
// hundred fights can be gated in a minute. That is right for a suite and
// ruinous for any measurement of what a turn FEELS like: an instrument that
// booted with ?test=1 read the enemy's four-hit volley as landing in 79ms and
// called it a pile-up, when the game a player gets spaces those same four hits
// 330ms apart. It very nearly bought a fix for a bug that existed only in the
// harness. `?realtime=1` keeps everything test mode is for — the fixed seed,
// the fresh boot, the silence — and gives the animation back its real
// durations, so the beat instrument measures the game that ships.
function realtime() { return /[?&]realtime=1/.test(location.search); }
function fastFx() { return testMode() && !realtime(); }

// ═════════════════════════════════════════════════════════════════════════════
// UI — the reference skin made live. One render root, small renderers per zone.
// ═════════════════════════════════════════════════════════════════════════════
let _sel = null;         // selected card id (tap-to-select → tap target commits)
// THE HAND IGNORES THE FINGER FOR A MOMENT AFTER A PLAY. Tapping a card
// selects it and tapping it again commits — but a played card leaves, the fan
// closes ranks, and the NEXT card slides under a finger that has not moved.
// Tapping one fixed spot four times played two cards and spent two thirds of
// the turn without the player ever choosing a card or a target. On a phone
// that is not an edge case, it is Tuesday.
// THE CONFIRM BELONGS TO ONE TURN. Keyed to the turn number rather than a
// dataset flag, because a flag on the button survived startCombat — so a fresh
// fight opened with END TURN still reading "3 AP LEFT — END?" and the next
// press only disarmed it instead of ending the turn.
let _etArmedTurn = -1;
function disarmEndTurn() {
  const btn = el('k-endturn'); if (!btn) return;
  clearTimeout(btn._t);
  _etArmedTurn = -1;
  btn.classList.remove('k-et-armed');
  btn.textContent = 'END TURN';
}
let _handLockUntil = 0;
const HAND_LOCK_MS = 340;
function lockHand() { _handLockUntil = (typeof performance !== 'undefined' ? performance.now() : Date.now()) + HAND_LOCK_MS; }
function handLocked() { return (typeof performance !== 'undefined' ? performance.now() : Date.now()) < _handLockUntil; }
let _focus = null;       // focus-mode card id (press-and-hold)

function el(id) { return document.getElementById(id); }

// A DEAD FOE ENDS THE FIGHT — asserted on every paint, not only where the
// damage was dealt. A player reported a board sitting at 0 HP with the fight
// still running, and roughly a hundred scripted fights across every foe, with
// and without the run's hand-off, would not reproduce the trigger. What can be
// fixed without knowing the trigger is the SHAPE of the failure: `dealToBoss`
// is still the one place that decides victory, and this is a net under it, so
// no route to zero — present or future — can leave the board playable.
//
// `!(hp > 0)` rather than `hp <= 0` deliberately: it also catches NaN, which
// compares false against everything and would otherwise make a foe immortal
// AND keep it off this net.
function bossIsDown() {
  return !!(C && C.boss && !(C.boss.hp > 0));
}
function renderAll() {
  if (!C || !el('k-stage')) return;
  if (bossIsDown() && C.phase !== 'VICTORY' && C.phase !== 'DEFEAT') setPhase('VICTORY');
  renderPartyHud(); renderBossHud(); renderIntent(); renderHand();
  renderApDial(); renderPiles(); renderHeroes(); renderOutcome();
}
// A BAR THAT EASES DOWN DOES NOT READ AS A WOUND. Every HP bar in the game
// transitioned width over 400ms, which is the shape of a meter SETTLING — the
// number slammed and the bar politely drifted. It snaps now, so the truth is
// instant, and a pale ghost holds at the old value for a beat before falling
// to meet it: the size of the bite stays on screen after the bite. Healing
// runs the other way — the ghost jumps ahead and the fill grows into it.
function setBar(bar, pct) {
  if (!bar) return;
  const fill = bar.querySelector('.k-bar-fill'); if (!fill) return;
  let ghost = bar.querySelector('.k-bar-ghost');
  if (!ghost) {
    ghost = document.createElement('i');
    ghost.className = 'k-bar-ghost';
    bar.insertBefore(ghost, fill);          // behind the fill, same box
    ghost.style.width = pct + '%';
  }
  const was = parseFloat(fill.dataset.pct);
  fill.dataset.pct = pct;
  const fresh = !(was >= 0);
  // A REPAINT THAT CHANGES NOTHING MUST NOT WIPE THE TRAIL. Resolution
  // re-renders the HUD several times for one blow; the first call opened the
  // ghost correctly and the second, with the same value, snapped it shut
  // again — so the trail existed for exactly as long as it took the next
  // render to run, which is to say never.
  if (!fresh && Math.abs(pct - was) < 0.01) return;
  // The snap has to be a real style change, not a class the next render might
  // race: inline transition off for the drop, back to the sheet for a gain.
  fill.style.transition = (!fresh && pct < was) ? 'none' : '';
  fill.style.width = pct + '%';
  clearTimeout(ghost._t);
  if (fresh || pct > was) { ghost.style.width = pct + '%'; return; }
  ghost.style.width = was + '%';
  // FFXIV's read: the amount lost goes white for a beat, THEN drains.
  ghost.classList.remove('k-bar-hit'); void ghost.offsetWidth; ghost.classList.add('k-bar-hit');
  ghost._t = setTimeout(() => { ghost.style.width = pct + '%'; }, 190);
}
function renderPartyHud() {
  // what this turn is about to do to each of them, read from the same function
  // the chip row reads — one source, so the two can never disagree
  // AIMED AND SHARED ARE TWO DIFFERENT FACTS AND THE BADGE HAS TO SAY BOTH.
  // A first pass folded the dirge into one total, so Ash's row read a flat 12
  // while the telegraph beside it read `9 ASH` and `3 all` — two authoritative
  // numbers for one event, which a player cannot reconcile and which is worse
  // than the seven-hundred-pixel journey the badge was added to remove. It
  // prints the sum as its parts now: 9+3, the same two numbers the chip row
  // shows, in the same order.
  const aimed = {}, shared = {};
  if (C && C.boss && !C.boss.cancelNext && C.phase !== 'VICTORY' && C.phase !== 'DEFEAT') {
    try {
      intentByTarget().forEach(r => { aimed[r.who] = (aimed[r.who] || 0) + r.total; });
      const dg = dirgeAmount();
      if (dg > 0) livingHeroes().forEach(id => { shared[id] = dg; });
    } catch (e) {}
  }
  const incoming = {};
  Object.keys(C.heroes).forEach(id => { incoming[id] = (aimed[id] || 0) + (shared[id] || 0); });
  for (const id of Object.keys(C.heroes)) {
    const h = C.heroes[id];
    const row = document.querySelector('.k-pt-hero[data-hero="' + id + '"]');
    if (!row) continue;
    row.classList.toggle('k-downed', !!h.downed);
    setBar(row.querySelector('.k-bar'), h.hp / h.max * 100);
    row.querySelector('.k-pt-hp').innerHTML = '<b>' + fmtN(h.hp) + '</b> / ' + fmtN(h.max)
      + (h.guard > 0 ? ' <span class="k-pt-guard">⛨' + fmtN(h.guard) + '</span>' : '')
      + (incoming[id] ? ' <span class="k-pt-inc">\u2726'
          // a hero nobody is aiming at reads the shared number alone, not "0+3"
          + (aimed[id] ? fmtN(aimed[id]) + (shared[id] ? '<s>+' + fmtN(shared[id]) + '</s>' : '')
                       : fmtN(shared[id] || 0))
          + '</span>' : '');
    // THE THREAT BELONGS BESIDE THE BAR IT WILL EMPTY. The telegraph lived
    // seven hundred pixels away in the top-right corner, so reading "who takes
    // 13 twice" and reading "who is at 4 health" were two separate journeys
    // across the screen, and the player had to hold one of them in their head.
    // The same number is now in both places: the chip row says what the turn
    // does, each hero's own row says what it does TO THEM.
    // AND THE OUTLINE MEANS AIMED, NOT MERELY PRESENT. Every foe in the
    // bestiary carries a dirge and the dirge reaches everyone, so keying this
    // on `incoming` lit all three rows on every turn of every fight — a
    // highlight that is always on is chrome, and it drowned the one turn where
    // somebody genuinely is the target.
    row.classList.toggle('k-pt-aimed', !!aimed[id] && !h.downed);
    row.classList.toggle('k-pt-lethal', !h.downed && incoming[id] >= h.hp + h.guard);
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
  // A VERB, NOT A NOUN. "ALL-OUT" named the thing without saying what to do
  // with it, on a control most players never saw light up in the first place.
  el('k-kz-n').textContent = ready ? 'ALL-OUT \u25B8' : pct + '%';
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
  setBar(el('k-bhp-fill').parentNode, C.boss.hp / C.boss.max * 100);
  // THE GAUGE BECOMES THE WORD. A "BROKEN" tag beside the name was a footnote
  // on the least-read line of the readout, while the break pips sat next to it
  // saying nothing at all. Now the gauge itself turns into STAGGERED — same
  // real estate, different state — and the name carries no tag.
  const stag = !!(C.boss.broken || C.boss.cancelNext);
  el('k-bflag').textContent = '';
  const bw = document.querySelector('#k-boss-hud .k-break-wrap');
  if (bw) bw.classList.toggle('k-is-stag', stag);
  // A GAUGE THAT COUNTS DOWN HAS TO SAY SO, AND SAY BY HOW MUCH. Twelve lit
  // pips meant "furthest from Staggered" — backwards from every stagger bar a
  // player has met, and unnumbered, so three turns of chipping looked identical
  // to none. The pool is POISE and the thing your cards deal is BREAK, which is
  // the grammar the card faces already use ("2 Break"); a full bar now honestly
  // means intact. The number is the half a pip row cannot give.
  const bn = el('k-brk-n');
  if (bn) bn.textContent = stag ? '' : fmtN(C.boss.brk) + '/' + fmtN(C.boss.breakMax);
  el('k-turn-n').textContent = C.turn;
  // THE BREAK GAUGE ONLY EVER FLASHED AS A WHOLE. Knocking a pip out is the
  // single most consequential thing a support card does, and it was a silent
  // repaint — the row flashed, so you could see that break had moved and
  // never by how much. The pips knocked out THIS repaint go out one at a
  // time, from the top down, so a 3-break card reads as three.
  //
  // The gauge counts DOWN: C.boss.brk is the resistance still standing, and a
  // card's `brk` atom takes it away. The first pass of this animated pips
  // coming ON, which is a thing that only happens when a fight starts.
  const box = el('k-break');
  const before = box.dataset.brk === undefined ? C.boss.brk : +box.dataset.brk;
  const pips = [];
  for (let i = 0; i < C.boss.breakMax; i++) {
    const on = i < C.boss.brk;
    const gone = !on && i < before;                 // lit a moment ago, dark now
    pips.push('<span class="k-pip' + (on ? ' on' : '') + (gone ? ' k-pip-out' : '')
      + '" style="--pip-i:' + (before - 1 - i) + '"></span>');
  }
  box.dataset.brk = C.boss.brk;
  box.innerHTML = pips.join('');
  el('k-chill').textContent = C.boss.chill > 0 ? '❄ ' + fmtN(C.boss.chill) : '';
  el('k-bleed').textContent = C.boss.bleed > 0 ? '🩸 ' + fmtN(C.boss.bleed) : '';
}
// THE TELEGRAPH — icons and amounts, in the sky above the Regent's head.
// One chip per thing the action will do: a blade for damage, a shield for
// guard, a star for a charge, a cross for healing, and the dirge's own mark.
// No sentence, no name, no counterplay hint: the shape says what kind of turn
// is coming and the number says how much.
const INTENT_ICON = { atk: 'atk', guard: 'guard', charge: 'finale', heal: 'heal', dirge: 'dirge' };
function renderIntent() {
  const box = el('k-intent'); if (!box) return;
  const it = currentIntent();
  const chips = [];
  if (C.boss.cancelNext) {
    chips.push('<span class="k-ichip k-ichip-broken">' + icon('broken') + '<b>—</b></span>');
  } else {
    // ONE CHIP PER TARGET, and the number on it is what THAT hero takes.
    // A hero struck twice reads "8 ×2" meaning eight apiece — the same grammar
    // the player's own cards use.
    // A PLACE, NOT A PERSON. The chip named the hero it was aimed at — nine
    // letters of ASH/ELIN/MIRA per blow — and with three blows plus a dirge the
    // readout ran 425px across the sky. The name was also the wrong axis: rows
    // are EXCLUSIVE in this game (moveHero TRADES PLACES, one hero per row), so
    // a row letter identifies the target just as precisely in one character AND
    // names the thing the player can actually act on. F/M/B rather than the
    // F/C/B a first sketch used, because the floor of the battlefield already
    // has FRONT, MID and BACK painted on it and a legend that disagrees with
    // the board is worse than no legend.
    //
    // And repeats are SPELLED OUT rather than collapsed to ×2. At name-width a
    // second chip was unaffordable and "9 ×2" was the compression that bought
    // room; at three characters two chips fit, and two marks in a row is how a
    // player counts blows without doing arithmetic.
    for (const row of intentByTarget()) {
      const where = ROW_LETTER[C.heroes[row.who].row] || '?';
      row.hits.forEach((d, i) => {
        chips.push('<span class="k-ichip k-ichip-atk">'
          // THE SYMBOL SAYS WHAT KIND OF BLOW IT IS, and this deck has exactly
          // two kinds of reachable blow plus the hymn: an ordinary strike, and
          // a SWEEP, which is the one that standing further back blunts. That
          // is a distinction the rules already make and the player already has
          // to act on, so it is the one the marks carry.
          // the mark of THIS blow, so a bar of a claw then a bell then a stab
          // is three different chips rather than three identical ones
          + icon((row.acts && row.acts[i] ? parseAct(row.acts[i]).def.mark : null)
                 || (row.sweep ? 'move' : 'atk'))
          + '<b>' + fmtN(d) + '</b><u>' + where + '</u>'
          // …and if distance blunts it, say so and say by how much from here
          // A STEP AND WHAT IT BUYS. This was a curved arrow the eye had to
          // decode; a plain arrow beside a row letter reads as "step, and it
          // becomes this" without a legend, which is the whole sentence.
          + (row.sweep && i === 0 && row.back < row.total
              ? '<em class="k-ichip-sweep" title="a sweep — one row back and it lands for '
                + fmtN(row.back) + '">\u2192' + fmtN(row.back) + '</em>' : '')
          + '</span>');
      });
    }
    // the vocabulary is ready for defend and charge turns even though the
    // Regent has none yet — an intent carrying `guard` or `charge` shows one
    if (it.guard) chips.push('<span class="k-ichip k-ichip-guard">' + icon('guard') + '<b>' + fmtN(it.guard) + '</b></span>');
    if (it.charge) chips.push('<span class="k-ichip k-ichip-charge">' + icon('finale') + '<b>' + fmtN(it.charge) + '</b></span>');
    if (it.kind === 'heal') chips.push('<span class="k-ichip k-ichip-heal">' + icon('heal') + '<b>' + fmtN(it.phaseHeal) + '</b></span>');
    const dg = dirgeAmount();
    // THE DIRGE IS THE ONE BLOW YOU CANNOT ANSWER. It shares the chip
    // vocabulary with everything you CAN answer, so without saying so it reads
    // as a parry window the game forgot to open — a bug, rather than the rule
    // that only Guard and healing reach it. Earlier builds carried the word
    // UNPARRYABLE on the old intent banner; the chip telegraph dropped it and
    // never put it back.
    // …AND IT HAS TWO ANSWERS, WHICH "no parry" DENIES. Guard absorbs it
    // (see endTurn), and BROKEN cancels the whole action, hymn included —
    // `if (dirge > 0 && !result.canceled)`. So the chip was telling the player
    // there is nothing to be done about the single largest source of damage in
    // the fight, while two counterplays sat unmentioned. It names them.
    // THE TWO ANSWERS BECOME THE TWO MARKS THAT ANSWER IT. `Guard or Break`
    // was eighty-five pixels of prose sitting at the end of a line of marks —
    // the only sentence on the readout, and the widest thing on it. The shield
    // and the split are the same two glyphs the player's own cards use for
    // exactly these two things, so the line stays a line of marks. The words
    // survive for anyone reading the screen rather than looking at it.
    if (dg > 0) chips.push('<span class="k-ichip k-ichip-dirge">' + icon('dirge')
      + '<b>' + fmtN(dg) + '</b><u>ALL</u>'
      + '<span class="k-ichip-ans" title="Guard absorbs it, and Breaking her cancels it">'
      + icon('guard') + icon('brk') + '<i class="k-sr">Guard or Break</i></span></span>');
  }
  box.innerHTML = chips.join('');
}
function renderHand() {
  const hand = el('k-hand'); if (!hand) return;
  const n = C.hand.length, mid = (n - 1) / 2;
  hand.classList.toggle('k-pick-discard', !!C.pendingDiscard);
  // A PULSE IS NOT A SENTENCE. Quick Throw draws one and then discards one, so
  // for that moment the next tap destroys a card instead of playing it — and
  // the only thing saying so was an animation. A player taps to play, and
  // loses the card believing they played it.
  const dp = el('k-discard-prompt');
  if (dp) dp.classList.toggle('k-hidden', !C.pendingDiscard);
  hand.innerHTML = C.hand.map((id, i) => {
    const ev = evaluateCard(id);
    const c = ev.card;
    const afford = C.ap >= ev.currentCost;
    const dead = ownerDown(c);
    const ownerArt = HEROES23[primaryHero(c)].art;
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
    return '<button data-own="' + (c.owner || primaryHero(c))
      + '" class="k-card' + (ev.sigil ? ' k-card-sig k-sig-' + ev.sigil : '')
      + (ev.condActive && !dead ? ' k-card-active' : '') + (afford ? '' : ' k-card-poor')
      + (dead ? ' k-card-dead' : '') + (isPairCard(c) ? ' k-card-res' : '')
      + (c.cond && c.cond.type === 'FINALE' ? ' k-card-tri' : '')
      // TEAM PLAYS ARE BLUE. Gold was doing two jobs on this face — it
      // marked a bond card AND it marked a live combo — so the one
      // colour on the screen could not say which of the two it meant.
      // Gold now means only 'this is live right now'; blue means 'this
      // is a play that needs more than one of them'. A duo card is blue
      // because two heroes own it; a Finale is blue because it wants all
      // three to have acted. Both can still arm, and arming is the gold.
      + (_sel === id ? ' k-card-sel' : '') + '" data-card="' + id + '"'
      + ' style="--rot:' + rot + 'deg;--dy:' + dy + 'px;--tilt:' + tilt
      + 'deg;--lean:' + lean + 'deg">'
      // THE WISP IS ITS OWN ELEMENT, not a pseudo. `.k-card::before` is already
      // the face's inner texture and `.k-card-poor::after` is the unaffordable
      // scrim — a card can be armed AND unaffordable, so both pseudo slots are
      // spoken for and taking either would have silently deleted something.
      // The follow-up gets its own class: "after an ally" is the combo the
      // player is asked to look for, so it is the one that runs brightest.
      + (ev.condActive && !dead
          ? '<i class="k-wisp' + (c.cond && c.cond.type === 'FOLLOW_UP' ? ' k-wisp-ally' : '') + '"></i>'
          : '')
      + cardFaceHTML(c, ev, gem, ownerArt)
      + '</button>';
  }).join('');
  hand.querySelectorAll('.k-card:not(.k-card-dead)').forEach(b => attachCardInput(b));
  // Rebuilding the hand orphans whatever was being dragged, so no beam can
  // still belong to anything. Leaving one alive is how it got stranded in the
  // corner of the screen with nothing holding the other end.
  aimClear();
}
// A KEYWORD MUST STATE ITS OWN RULE. "Finale" is a name for a thing that
// happens, not a description of how to make it happen — a player who has not
// read a manual has no way to find out what it wants. Every tag now says the
// condition in the two or three words the card has room for, and the inspect
// panel spells it out in full.
const COND_LABEL = {
  FOLLOW_UP: 'After an Ally', FINALE: 'All Three',
  BROKEN: 'When Broken',
  // …and this one is NOT the same keyword. It armed against an un-Broken foe
  // at 8/98 health while its own tag said WHEN BROKEN — a card lying about
  // itself, which is the one thing this deck may never do.
  BROKEN_OR_LOW: 'Broken or Low',
  BACK_ROW: 'From the Back',
};
const COND_RULE = {
  FOLLOW_UP: 'Play this straight after a different hero acts, in the same turn.',
  FINALE: 'Play this as the card that completes all three heroes in one turn.',
  BROKEN: 'The Regent must be BROKEN.',
  BROKEN_OR_LOW: 'The Regent must be BROKEN, or under 30% health.',
  BACK_ROW: 'This hero must be standing in the BACK row.',
};
// A small, consistent icon vocabulary — the same mark means the same thing on
// a card, in the inspect panel and in the Regent's intent line.
// EVERY CARD ITS OWN PAINTING. Until now the picture on a card was the hero's
// full-body portrait, which meant all five of a hero's cards were one image —
// the art could only say WHOSE card this was, never WHICH. These are painted
// per card and per action: Cleave is a blade coming down, Mend is a light held
// in two hands, Backstab is someone stepping out of a wall of shadow. The top
// half of the face now answers "what does this do" before a word is read.
//
// A card without a painting falls back to the hero portrait, framed as a bust
// exactly as before — the bond cards are earned rather than dealt, so they can
// wait. The two framings are NOT interchangeable: a portrait is a tall figure
// on a blank canvas and has to be blown up and anchored high to fill the plate,
// while these are composed for this frame and want to sit in it untouched.
// `k-cbg-own` carries the old blow-up; the bespoke path takes none of it.
const CARD_ART = {
  cleave: 1, guardcut: 1, cstance: 1, crosssever: 1, lastlight: 1,
  lcascade: 1, mend: 1, frostbind: 1, sgrace: 1, intercession: 1,
  serrate: 1, qthrow: 1, twinfang: 1, backstab: 1, execute: 1,
  lightsteel: 1,
  // THE TWELVE BOND CARDS, and every one of them is a TWO-FIGURE painting —
  // which is the whole reason they were worth painting rather than just worth
  // filling in. A bond card is about two people doing one thing: Shield the
  // Blade is Ash's guard raised with Mira already moving out past it, Both
  // Blades is his greatsword still in its follow-through while her dagger
  // flashes by on the same arc, A Quiet Word is the two of them close with one
  // small light between their hands. The portrait fallback could not say any
  // of that; it could only say "Ash".
  shieldsong: 1, lastvigil: 1, gravebloom: 1, ashenoath: 1,
  shieldblade: 1, twinshadow: 1, cutthecord: 1, bothblades: 1,
  coldmercy: 1, quietword: 1, thornandlamp: 1, namethefear: 1,
};
// The id is the BASE id, not the upgraded one — Cleave+ is the same swing as
// Cleave and shares its painting rather than going bare.
function cardArt(cardId) {
  return CARD_ART[cardId] ? '../art/cards/' + cardId + '.webp' : null;
}

// THREE OF THESE DID NOT READ, and they were the three that appear most.
//
//   · `atk` was a diagonal stroke with a small head on it, which at 10px is an
//     ARROW — the same shape the game uses for "step to the front" — so the
//     commonest clause in the deck was marked with the icon for movement. It is
//     a sword now: blade, crossguard, grip. Vertical, so it cannot be confused
//     with any of the horizontal arrows.
//   · `brk` was a four-pointed star and `finale` is a five-pointed one. Two
//     stars, side by side on Cross Sever, for two unrelated things. Break is
//     splitting something open, so it is a diamond cracked down the middle and
//     pulled apart — which also says what the mechanic does.
//   · `draw` was two overlapping rectangles, and at the 8px the crowded cards
//     set it at, two overlapping rectangles are a smudge. One card with an
//     arrow rising out of it survives the size.
//   · `follow` was an arc doubling back with an arrowhead on the end, and the
//     head — the only part that said which WAY it ran — was gone by 10px,
//     leaving a squiggle. Two chevrons say "then, and then" at any size, which
//     is what After an Ally means.
//
// Judged on a proof sheet at 10, 15 and 44px rather than in the editor: the
// first sword had a pommel bar and a short guard, which at 44px read as an
// ankh and at 10px as a blob on a stick.
//
// The rest were tested at size and left alone: a shield, a drop, a flake, a
// cross, an arrow and a five-point star all still read.
// FOUR OF THESE DID NOT SURVIVE THEIR OWN SIZE. Rendered at the 11px they wear
// on a card face and the 13px they wear in the telegraph, `atk` was a hollow
// blade outline stroked at 1.9 on a 16-unit box — the outline closed on itself
// and the most-used mark in the game read as an ankh; `draw` was a card outline
// with an arrow INSIDE it, which at 11px is a filled rectangle with a smudge in
// it; `broken` was a bolt thin enough to read as a stray tick; and `heal` was a
// two-stroke cross with no mass. The rule that came out of laying the whole set
// out at 11/13/18/34px: a glyph that must read at 11px is FILLED, not stroked —
// stroke is for marks whose whole meaning is a line (a flake, a chevron, an
// arrow, three strokes of a hymn), and those are the only four still stroked.
const ICON_PATHS = {
  // AN ANGLED BLADE, NOT AN UPRIGHT ONE. The first filled attempt stood the
  // sword vertically with a wide crossguard, and at 11px it was a plus sign —
  // indistinguishable from `heal`, which is the one mark in the set it must
  // never be confused with. Laid on the diagonal, with a chiselled tip and a
  // guard narrow enough not to dominate, it reads as a weapon at every size.
  atk:   'M5.09 9.29 L11.24 3.13 L13.4 2.6 L12.87 4.76 L6.71 10.91 Z'
       + ' M8.57 11.75 L4.25 7.43 L3.23 8.45 L7.55 12.77 Z'
       + ' M5.82 11.29 L3.27 13.83 L2.17 12.73 L4.71 10.18 Z',
  guard: 'M8 1 L14 4 V8 Q14 12 8 15 Q2 12 2 8 V4 Z',                  // a shield
  heal:  'M6.5 2.2 H9.5 V6.5 H13.8 V9.5 H9.5 V13.8 H6.5 V9.5 H2.2 V6.5 H6.5 Z',   // a cross with body
  bleed: 'M8 2 Q12 8 12 10 A4 4 0 0 1 4 10 Q4 8 8 2 Z',                // a drop
  chill: 'M8 2 V14 M3 5 L13 11 M13 5 L3 11',                           // a flake
  brk:   'M6.2 1.5 L1.5 8 L6.2 14.5 Z M9.8 1.5 L14.5 8 L9.8 14.5 Z',   // split apart
  follow:'M3 3.5 L7.5 8 L3 12.5 M8.5 3.5 L13 8 L8.5 12.5',             // then, and then
  finale:'M8 1 L10 6 L15 6.5 L11.5 10 L12.5 15 L8 12.5 L3.5 15 L4.5 10 L1 6.5 L6 6 Z',
  broken:'M9.6 0.8 L3.6 8.8 H7.2 L6 15.2 L12.4 6.8 H8.8 Z',            // a crack, with mass
  // a card, and the card coming OFF it — the arrow is outside the rectangle so
  // the two shapes stay two shapes at 11px
  draw:  'M2.6 5.6 H8.8 V15.2 H2.6 Z M12.1 1.2 L15.6 5.6 H13.3 V11 H10.9 V5.6 H8.6 Z',
  move:  'M2 8 H14 M11 5 L14 8 L11 11',                                // a step
  // THE DIRGE IS NOT BREAK. It wore `brk` — the split-apart glyph the player's
  // own cards use for "2 Break" — so the same mark meant "strip the Regent's
  // poise" on a card in hand and "2 unblockable to all three of you" in the
  // sky, on one screen. A hymn falling on everyone: three descending strokes
  // over a line nobody gets under.
  dirge: 'M3 2.5 V8 M8 2.5 V10 M13 2.5 V8 M1.5 13 H14.5',
};
const STROKE_ICONS = { chill: 1, follow: 1, move: 1, dirge: 1 };
function icon(name, cls) {
  const d = ICON_PATHS[name]; if (!d) return '';
  // FILLED IS THE DEFAULT NOW; stroke is the exception, for the four marks whose
  // whole meaning is a line. See the note above ICON_PATHS.
  const fill = !STROKE_ICONS[name];
  return '<svg class="k-ico ' + (cls || '') + '" viewBox="0 0 16 16" aria-hidden="true">'
    + '<path d="' + d + '" ' + (fill ? 'fill="currentColor" stroke="none"' : 'fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"')
    + '/></svg>';
}
const COND_ICON = { FOLLOW_UP: 'follow', FINALE: 'finale', BROKEN: 'broken',
  BROKEN_OR_LOW: 'broken', BACK_ROW: 'move' };

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
      + '<span class="k-combo-pay">' + condReward(c, ev.sigil) + '</span></span>'
    // EXHAUST SAID ITSELF TWICE. The tag read EXHAUST and the line under it
    // read "Leaves the fight when played." — twenty-nine characters, the longest
    // line in the deck, restating a keyword directly above it. The word stands
    // alone now and the sentence lives in the pickup panel with the others.
    : c.exhaust
      ? '<span class="k-combo k-combo-exh on k-combo-bare"><span class="k-combo-tag">'
        + icon('finale') + 'Exhaust</span></span>'
      : '';
  void COND_LABEL;
  // THE ART ZONE CARRIES THE CARD'S VERB, not the hero's face a second time.
  //
  // It used to hold `ownerArt` — the same portrait as the emblem in the corner,
  // blown up to 60px. Which meant all five of Mira's cards were the identical
  // image, and at 108px wide against dark character art the whole zone
  // collapsed to a black smear: three cards in a hand were distinguishable
  // only by reading their titles. That is the exact opposite of what a card
  // game's hand is for, and it is the last thing standing between this combat
  // and StS2's readability.
  //
  // So the zone now shows up to two glyphs derived from what the card actually
  // does — blade, shield, cross, shard, drop, flake, cards, step. Derived, not
  // authored, so a card can never advertise an effect it no longer has, and it
  // survives an upgrade changing the numbers underneath. Warm plate for a card
  // that reaches the enemy, cool for one that helps the party: the hand sorts
  // itself into "attack" and "answer" before a single word is read.
  const glyphs = cardGlyphs(ev.resolvedEffects);
  const tone = c.target === 'enemy' ? 'k-cart-warm' : 'k-cart-cool';
  // HOW MANY THINGS THIS CARD DOES sets how tight the rows are. The concept
  // this face is built to shows two rows on every card; the deck has cards
  // with four. Rather than let those clip — or set every card at the size the
  // worst one needs — the block tightens only when it has to.
  const rowsHTML = prose(faceBase(c, ev.sigil), 'rows');
  // HOW MUCH TEXT, NOT HOW MANY CLAUSES. This used to count rows, on the
  // assumption that a row is a line — and it was, only because a row that
  // outgrew the card ran off the side instead of wrapping. Rows wrap now, so
  // "Take their parry window" is one clause and two lines, and a card budgeted
  // as a three-row card clipped. Each row is costed at the lines it will
  // actually take: roughly 18 uppercase characters fit the 106px of usable
  // width at the base size, and an icon costs about two characters of it.
  // Re-derived for the 104px card: the usable row is ~94px, and a clause of
  // "Step to the back" — sixteen characters plus a mark — is already two lines
  // there. Measured against the real deck rather than estimated from the type
  // size, because the bold numbers set their own taller line and a row with one
  // in it costs more than its character count suggests.
  const LINE_CHARS = 15;
  const rowLines = (html) => (html.match(/<i class="k-crow">[\s\S]*?<\/i>/g) || [])
    .reduce((n, r) => n + Math.max(1, Math.ceil(
      (r.replace(/<svg[\s\S]*?<\/svg>/g, '~~').replace(/<[^>]+>/g, '').trim().length)
      / LINE_CHARS)), 0);
  const nRows = rowLines(rowsHTML) + (cond ? 1 : 0);
  const rowClass = 'k-ctext' + (nRows >= 5 ? ' k-rows-5' : nRows === 4 ? ' k-rows-4'
    : nRows === 3 ? ' k-rows-3' : '');
  // WHOSE CARD THIS IS, SAID rather than pictured. The corner held a 17px
  // portrait disc — the same face as the art behind it, at a size where Ash
  // and Mira are one silhouette. A name in small caps over the title reads at
  // a glance and gives the top corner back to the cost.
  const who = (ownerHeroes(c) || []).map(h => (HEROES23[h] ? HEROES23[h].name : h)).join(' + ');
  // The card's own painting if it has one, the hero portrait if it does not.
  // `own` is what tells the stylesheet which of the two framings to apply.
  const painted = cardArt(ev.cardId);
  const src = painted || ownerArt, own = !painted;
  return '<span class="k-cgem' + (ev.condActive && ev.currentCost !== c.cost ? ' on' : '') + '">' + gem + '</span>'
    // THE PLATE CARRIES BOTH NOW. Build 29 took the portrait out because it was
    // being asked to identify the card and could not — five cards of one hero
    // were five copies of one picture, and against dark art the zone was a
    // black smear. The GLYPH identifies the card; the portrait, bled behind a
    // scrim, is atmosphere and says only whose hand this is.
    + '<span class="k-cart ' + tone + (glyphs.length > 1 ? ' k-cart-two' : '') + '">'
    + '<img class="k-cbg' + (own ? ' k-cbg-own' : '') + '" src="' + src
    + '" alt="" aria-hidden="true">'
    + '</span>'
    // THE TYPE, IN THE CORNER OPPOSITE THE COST. The verb marks used to sit in
    // the middle of the picture, which is the one place a picture cannot spare
    // — they were there because the plate had no picture worth protecting. Read
    // as a pair of corner marks they still sort the hand into attack and answer
    // at a glance, and the art gets its whole frame back.
    + '<span class="k-ctype' + (glyphs.length > 1 ? ' k-ctype-two' : '') + ' ' + tone + '">'
    + glyphs.map(g => icon(g, 'k-cverb')).join('') + '</span>'
    // A LONG NAME GETS ITS OWN SIZE rather than an ellipsis. "Light Through
    // Steel" needs 106px of a 94px line at the deck's title size, and a card
    // whose name is cut off is a card the player cannot look up.
    + '<span class="k-cwho">' + who + '</span>'
    + '<span class="k-cname' + (c.name.length > 15 ? ' k-cname-vlong' : c.name.length > 10 ? ' k-cname-long' : '') + '">' + c.name + '</span>'
    // THE MARK IS ON THE FACE. A sigil that changed how a card played and did
    // not appear on it would be a rule the player had to remember per card.
    // A CHIP, AND IT READS LEFT TO RIGHT. Two treatments have failed here now.
    // The first was a full-width gold ribbon across the middle of the painting
    // — the loudest object on the card, wider than its own name, a sticker
    // rather than something earned. The second traded that for a spine down the
    // left edge, which fixed the loudness and introduced a worse problem: the
    // word ran VERTICALLY, and a seven-letter word set at 7px rotated ninety
    // degrees is not read, it is decoded. Nothing else on this screen asks the
    // player to tilt their head. It is a small horizontal chip now, tucked under
    // the cost orb on the dark end of the art — glyph, then name, on one line,
    // the way every other label in the game is set.
    + (ev.sigil && SIGILS[ev.sigil]
        ? '<span class="k-csig k-csig-' + ev.sigil + '">'
          + icon(SIGILS[ev.sigil].glyph || 'finale', 'k-csig-g')
          + '<u>' + SIGILS[ev.sigil].name + '</u></span>' : '')
    // the prose sits in its own inner span: .k-cprose centres its content with
    // flex, and a flex container turns each inline child into an item — which
    // silently ate the spaces and printed "9damage."
    // THE FACE MUST NOT LIE. This printed prose(c.base) — the card's numbers
    // BEFORE its mark — so a Bright card advertised 7 damage and dealt 11.
    // Same rule Build 23 set for the combo layer, broken again by a feature
    // that changes numbers somewhere other than the combo.
    + '<span class="' + rowClass + '"><span class="k-cprose">' + rowsHTML + '</span>'
    + cond + '</span>';
}
// A CARD SHOWN OUTSIDE A FIGHT. The run layer — a bond scene's fork, the swap
// screen — had no way to draw a card, so it printed a name and a sentence in a
// box. The player was asked to choose between two cards while looking at
// neither. There is no combat to evaluate against here, so every conditional
// is drawn asleep, which is exactly the state the card will arrive in.
function staticCardHTML(id, opts) {
  const o = opts || {};
  const c = o.def || cardDef(id);
  if (!c) return '';
  // A PREVIEW SHOWS THE MARK IT WILL ARRIVE WITH. `sigil` is passed in rather
  // than read from combat state, because the run layer is the only place that
  // knows what a card is about to be given.
  const sigil = o.sigil || null;
  // cardId has to be here as well as `card` — the face looks the painting up
  // by id, and a preview without it silently fell back to the hero portrait,
  // which is exactly the picture the cutscene preview exists to replace.
  const ev = { cardId: id, card: c, condActive: false, currentCost: c.cost, sigil,
               resolvedEffects: sigil === 'surge' ? brighten(c.base) : c.base };
  const art = HEROES23[primaryHero(c)].art;
  return '<div data-own="' + (c.owner || primaryHero(c))
    + '" class="k-card k-card-static' + (sigil ? ' k-card-sig k-sig-' + sigil : '')
    + (o.cls ? ' ' + o.cls : '') + '">'
    + cardFaceHTML(c, ev, String(c.cost), art) + '</div>';
}
// Plain sentences, numbers bolded — the way a card is read at a glance.
// WHAT KIND OF CARD IS THIS, in at most two marks. Ordered by how much the
// atom defines the card rather than by where it sits in the list, so Guarding
// Cut reads blade-then-shield and Shared Grace reads shield-then-shard.
const VERB_OF = [
  ['dmg', 'atk'], ['heal', 'heal'], ['healAll', 'heal'],
  ['guardSelf', 'guard'], ['guardAll', 'guard'], ['guardAlly', 'guard'],
  ['guardLowest', 'guard'], ['intercede', 'guard'],
  ['brk', 'brk'], ['bleed', 'bleed'], ['chill', 'chill'],
  ['drawDiscard', 'draw'], ['draw', 'draw'], ['moveSelf', 'move'],
];
function cardGlyphs(effects) {
  const out = [];
  for (const [key, glyph] of VERB_OF) {
    if (!effects.some(fx => fx[key])) continue;
    if (out.indexOf(glyph) < 0) out.push(glyph);
    if (out.length === 2) break;
  }
  return out.length ? out : ['atk'];
}
function prose(effects, plain) {
  // `plain` was a boolean and is now also the string 'rows', so a truthiness
  // test silently stripped every icon out of the row layout — the card face
  // printed "7 DAMAGE" with nothing in front of it. Only the plain-TEXT mode
  // drops the marks.
  const I = (plain === true || plain === 'plain') ? () => '' : icon;
  const out = [];
  const hits = effects.filter(f => f.dmg);
  if (hits.length === 1) out.push(I('atk') + '<b>' + fmtN(hits[0].dmg) + '</b> damage.');
  else if (hits.length > 1) out.push(I('atk') + '<b>' + fmtN(hits[0].dmg) + '</b> damage <b>×' + hits.length + '</b>.');
  for (const fx of effects) {
    if (fx.brk) out.push(I('brk') + '<b>' + fx.brk + '</b> Break.');
    if (fx.guardSelf) out.push(I('guard') + '<b>' + fmtN(fx.guardSelf) + '</b> Guard.');
    if (fx.guardAll) out.push(I('guard') + '<b>' + fmtN(fx.guardAll) + '</b> Guard to all.');
    if (fx.guardAlly) out.push(I('guard') + '<b>' + fmtN(fx.guardAlly) + '</b> Guard \u00b7 ally.');
    if (fx.guardLowest) out.push(I('guard') + '<b>' + fmtN(fx.guardLowest) + '</b> Guard \u00b7 lowest.');
    if (fx.heal) out.push(I('heal') + 'Heal <b>' + fmtN(fx.heal) + '</b>.');
    if (fx.healAll) out.push(I('heal') + 'Heal <b>' + fmtN(fx.healAll) + '</b> to all.');
    if (fx.bleed) out.push(I('bleed') + '<b>' + fmtN(fx.bleed) + '</b> Bleed.');
    if (fx.chill) out.push(I('chill') + '<b>' + fmtN(fx.chill) + '</b> Chill.');
    if (fx.counterstance) out.push(I('brk') + 'Parry <b>+2</b> Break.');
    // A KEYWORD, NOT A SENTENCE. Twenty-three characters of prose on a 94px
    // line for a rule that is the same every time it appears. The word goes on
    // the face and the rule goes where the player is already looking when they
    // want it — the panel that opens when the card is picked up.
    if (fx.intercede) out.push(I('guard') + 'Intercede.');
    if (fx.moveSelf) out.push(I('move') + 'Step <b>' + fx.moveSelf + '</b>.');
    // TWO CLAUSES, BECAUSE IT IS TWO THINGS. As one row this wrapped at the
    // comma inside a 73px face and printed "Draw 1" over ", discard 1", which
    // reads as a rendering fault rather than as a rule. A row is one clause.
    if (fx.drawDiscard) { out.push(I('draw') + 'Draw <b>1</b>.'); out.push(I('draw') + 'Discard <b>1</b>.'); }
    if (fx.draw) out.push(I('draw') + 'Draw <b>' + fx.draw + '</b>.');
  }
  // ONE CLAUSE PER LINE. Run together, a two-effect card wraps wherever the
  // box happens to end and orphans a word — "9 damage. ✦ 2 / Break." Each
  // clause on its own line never orphans and scans as a list of things the
  // card does, which is what it is.
  //
  // `rows` goes further and gives each clause its own ruled ROW. A list of
  // things separated by hairlines reads as a list of things; the same clauses
  // stacked with <br> read as a paragraph that happens to have breaks in it,
  // and the difference is most of what makes a card look designed rather than
  // typed. The trailing full stop goes with it — a row is not a sentence.
  if (plain === 'rows') {
    return out.map(t => '<i class="k-crow">' + t.replace(/\.\s*$/, '') + '</i>').join('');
  }
  return out.join(plain ? ' ' : '<br>');
}
// What the condition PAYS, as a clause that finishes the label's sentence.
// What the top block of the face should print: the card's numbers as the mark
// leaves them, which is what will actually land.
function faceBase(card, sigil) {
  return sigil === 'surge' ? brighten(card.base) : card.base;
}
function condReward(card, sigil) {
  if (!card.cond) return '';
  if (card.cond.reward === 'cost') return 'costs <b>' + card.cond.costTo + '</b> AP.';
  // THE REFUND SAYS WHAT IT IS ON THE FACE, and it says it SHORT. The first
  // draft read "free — the AP comes back", and the clip check found Quick Throw
  // overflowing its own text block: that card already spends two lines saying
  // it draws one and discards one, and a payoff row half again as long as the
  // longest one in the deck did not fit. It also could not say "costs 0",
  // because that is not what happens — the AP is spent and then returned, and
  // a card in this deck may not lie about its own arithmetic.
  if (card.cond.reward === 'ap') {
    const n = card.cond.ap || 1;
    return n >= card.cost ? 'the AP comes <b>back</b>.'
                          : '<b>' + n + '</b> AP comes back.';
  }
  // the combo's own numbers are brightened too — they are numbers this card
  // deals, and evaluateCard brightens the whole resolved list
  const bonus = sigil === 'surge' ? brighten(card.cond.bonus) : card.cond.bonus;
  const hits = bonus.filter(f => f.dmg);
  const parts = [];
  if (hits.length) parts.push(icon('atk') + '<b>+' + fmtN(hits.reduce((n, f) => n + f.dmg, 0)) + '</b> damage.');
  const rest = prose(bonus.filter(f => !f.dmg));
  if (rest) parts.push(rest);
  return parts.join('<br>');
}
function condText(card) {
  if (!card.cond) return '';
  return (COND_LABEL[card.cond.type] || card.cond.type) + ': ' + stripTags(condReward(card));
}
function effectText(effects) { return prose(effects, true).replace(/<[^>]*>/g, ''); }
function stripTags(html) { return String(html).replace(/<br>/g, ' ').replace(/<[^>]*>/g, ''); }
// WHAT THIS ONE WOULD COST. The realtime playtest counted 23.3 things on screen
// to parse per turn and found that the number gating every decision — how much
// AP is left — was not among the first of them: a 41x9px strip of diamonds in
// the last row of pixels on the board, 0.09% of the screen, saying a number
// nothing else on screen repeats.
//
// Position was only half of it. The question a hand actually asks is not "how
// much do I have" but "if I play THIS, what is left for the rest of the turn",
// and answering that was arithmetic done in the player's head every time. So
// the marks a card would consume now light as ABOUT TO GO the moment it is
// picked up, and the ones that would survive stay as they are. The answer is
// read rather than computed, which is the whole difference between a glance and
// a pause.
function apPreview(cardId) {
  if (!C || !cardId) return 0;
  const ev = evaluateCard(cardId);
  if (!ev) return 0;
  return Math.max(0, ev.currentCost - (ev.refund || 0));
}
function renderApDial() {
  if (C && _etArmedTurn !== C.turn) disarmEndTurn();
  el('k-ap-num').textContent = C.ap;
  el('k-ap').classList.toggle('k-ap-spent', C.ap === 0);   // a spent orb goes cold
  // …and the pips say what it is OUT OF, so nobody has to remember the budget
  const pips = el('k-ap-pips');
  if (pips) {
    // a card in the hand under a finger is a spend that has not happened yet
    const want = C.phase === 'PLAYER_READY' ? apPreview(_sel) : 0;
    const spending = Math.min(want, C.ap);
    let out = '';
    for (let i = 0; i < C.apMax; i++) {
      const lit = i < C.ap;
      // count the doomed marks from the RIGHT of the lit run, so the ones that
      // would survive stay put and the eye reads what remains, not what goes
      const doomed = lit && i >= C.ap - spending;
      out += '<span class="k-ap-pip' + (lit ? '' : ' k-ap-off')
           + (doomed ? ' k-ap-going' : '') + '"></span>';
    }
    pips.innerHTML = out;
    // the row itself says whether this card is affordable at all
    el('k-ap').classList.toggle('k-ap-short', !!_sel && want > C.ap);
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
    // A DEAD HERO WAS STILL STANDING. `k-downed` only ever reached the 24px
    // HUD row, so a third of the party could be dead while the board showed
    // three figures breathing.
    h.classList.toggle('k-downed', !!C.heroes[id].downed);
    for (const r of ROWS) h.classList.toggle('k-row-' + r, C.heroes[id].row === r);
    // the word only — the row plate also carries a permanent step cue saying
    // this figure can be picked up and put somewhere, and writing textContent
    // over the whole plate would delete it every render
    h.querySelector('.k-hero-row b').textContent = C.heroes[id].row.toUpperCase();
  });
  // TURN ONE TEACHES THE MOVE, and then gets out of the painting's way. The
  // step cue used to be permanent — three arrows standing in the middle of the
  // battlefield saying something that is true on every turn of every fight.
  const st = el('k-stage');
  if (st) st.classList.toggle('k-teach-move', C.turn <= 1);
}
// COMBAT MUST NEVER BE A DEAD END. Inside a run this used to draw nothing at
// all — the road owns the outcome card — which was right in principle and left
// exactly one thing between a won fight and a board with nothing on it to
// press: a single `setTimeout(cb, 620)`. A player has now been stranded on a
// finished fight twice, and I could not reproduce the trigger across roughly a
// hundred scripted fights, real volleys and the full run layer included.
//
// So the rule is narrowed rather than the cause guessed at again. The road owns
// the outcome card only while the road is actually COMING — that is, while the
// hand-off is still pending. Once it has been spent, if the stage is still the
// screen the player is looking at, then whatever was supposed to happen did
// not, and combat draws its own way out.
//
// The button is deliberately the road's own `screen('map')` rather than a
// reload: the fight's result was already banked by onFightEnd if it ran, and
// re-running it would pay the embers twice.
function renderOutcome() {
  const ov = el('k-overlay');
  if (!ov) return;
  const terminal = C.phase === 'VICTORY' || C.phase === 'DEFEAT';
  const inRun = !!(window.R && window.R.active && window.R.active());
  // still playing, or the road's hand-off is still in flight → nothing to draw
  if (!terminal || C.onEnd || C._handoff) { ov.className = 'k-ov k-hidden'; return; }
  const stage = el('k-stage');
  const stageUp = !!stage && !stage.classList.contains('k-hidden');
  // SOMETHING ELSE IS USING THE BOARD. The reckoning holds the stage after a
  // win — the foe on the ground, the party still in their lanes — so combat's
  // own outcome card would print straight through a conversation. Combat still
  // knows nothing about runs here: only that the stage has been claimed.
  if (stage && stage.classList.contains('k-reckoning')) { ov.className = 'k-ov k-hidden'; return; }
  if (inRun && !stageUp) { ov.className = 'k-ov k-hidden'; return; }   // the road took over
  const won = C.phase === 'VICTORY';
  const title = won ? ((C.foe && C.foe.name ? C.foe.name.toUpperCase() : 'THE REGENT') + ' FALLS')
                    : 'THE PARTY FALLS';
  ov.className = 'k-ov';
  ov.innerHTML = '<div class="k-ov-title' + (won ? '' : ' k-ov-loss') + '">' + title + '</div>'
    + '<div class="k-ov-sub">turn ' + C.turn + '</div>'
    + (inRun ? '<button type="button" id="k-ov-go">CONTINUE</button>' : '');
  const go = el('k-ov-go');
  if (go) go.onclick = () => {
    try { window.R.screen('map'); window.R.render(); } catch (e) { console.error(e); }
  };
  if (inRun) console.warn('KIZUNA: the road did not take over a finished fight — '
    + 'outcome drawn by combat as a fallback', { phase: C.phase, foe: C.foe && C.foe.id });
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
// THE HAND IS THE WAY BACK. There was no cancel zone anywhere on the board: the
// snap looks for the NEAREST legal target within 210px and takes it, and the
// hand sits well inside 210px of every hero, so bringing a card back down and
// letting go of it played the card. There was no gesture that meant "no" —
// once you picked a card up you were committed to spending it.
//
// Releasing over the hand now cancels, which is what every card game does and
// what a player will try first. Checked before anything else, so it beats the
// snap rather than competing with it.
function overHand(x, y) {
  const h = el('k-hand'); if (!h) return false;
  const r = h.getBoundingClientRect();
  if (!r.width) return false;
  // a little slack above the fan, because the card rides below the finger and
  // the hand's own top edge is where a player aims when they mean "put it back"
  return x >= r.left - 12 && x <= r.right + 12 && y >= r.top - 10 && y <= r.bottom + 40;
}
function dropTargetAt(x, y, cardId) {
  const stage = el('k-stage');
  if (!stage) return null;
  if (overHand(x, y)) return null;
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
  const want = cardId ? (cardDef(cardId).target === 'enemy' ? 'enemy' : 'party') : null;
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
  const want = cardDef(id).target === 'enemy' ? 'enemy' : 'party';
  if (drop.zone !== want) return false;
  return playCard(id, drop.hero && drop.hero !== cardDef(id).owner ? drop.hero : undefined);
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
  return cardDef(cardId).target === 'enemy' ? '#e05b52' : '#98d878';
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
    const hand1 = el('k-hand'); if (hand1) hand1.classList.remove('k-hand-cancel');
    // …and PUT THE CARD BACK. This reset the flags but left the lift in place,
    // so a card abandoned while still attached — the hand hidden behind a
    // parry, a screen change mid-drag — stayed sitting wherever the finger had
    // last been, out of the fan, until something else rebuilt the hand.
    btn.classList.remove('k-dragging', 'k-aiming', 'k-drop-ok');
    btn.style.removeProperty('--dragx'); btn.style.removeProperty('--dragy');
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
    const want = cardDef(id).target === 'enemy' ? 'enemy' : 'party';
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
    if (!armed) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    const far = Math.hypot(dx, dy) > 14;
    // A HOLD THAT TURNS INTO A MOVE IS A DRAG. This is the single worst bug in
    // the build and it is entirely a phone bug: a thumb does not move 14px in
    // the first 420ms of a deliberate drag, so the hold timer fired first,
    // `held` latched, and this handler returned early FOREVER. The player then
    // swept the card all the way onto the Regent and let go, and nothing
    // happened — no beam, no play, no feedback of any kind. On a mouse the
    // pointer clears 14px almost instantly, which is why every check and every
    // desktop playtest missed it.
    //
    // The inspect panel has been printing "release to close · drag the card to
    // play it" since Build 28. The card was telling the truth about what it
    // should do; nothing implemented it.
    //
    // Closing the inspect is safe to do inside this same event: `.k-inspecting`
    // only transitions a brightness filter, so the fan's geometry is untouched
    // and the `home` measurement below is still correct.
    if (held && far) { closeInspect(); held = false; }
    if (held) return;
    if (!dragging && far) {
      clearTimeout(holdT); dragging = true;
      // A DRAG RETIRES ANY STANDING SELECTION. Otherwise the previously
      // tapped card stays raised with its gold ring on the target while the
      // dragged card paints a red one over the top of it.
      // …and `id` is NOT in scope here — it is declared inside the paint loop
      // and inside the pointerup handler, not on the listener. Build 31 wrote
      // this guard against a free variable, so every drag that began while a
      // card was selected threw "id is not defined" and abandoned the gesture:
      // no beam, no aim, the card left sitting in the fan. It surfaced only
      // once a test finally selected a card and then dragged a different one.
      if (_sel && _sel !== btn.dataset.card) clearSelection(true);
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
      const want = cardDef(btn.dataset.card).target === 'enemy' ? 'enemy' : 'party';
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
      const want = cardDef(btn.dataset.card).target === 'enemy' ? 'enemy' : 'party';
      btn.classList.toggle('k-drop-ok', !!over && (over.zone === want || over.zone === 'piles'));
      // …and SAY that letting go here puts it back, rather than leaving the
      // player to discover a cancel by accidentally not spending a card.
      const hand = el('k-hand');
      if (hand) hand.classList.toggle('k-hand-cancel', overHand(e.clientX, e.clientY));
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
    // PUT THE CARD DOWN BEFORE DECIDING WHAT THE GESTURE MEANT. Every early
    // return below used to skip this, so a drag that ended on a branch other
    // than the drop branch left the card lifted out of the fan with its aiming
    // transform and an orphaned beam still on screen — recoverable only if
    // something else happened to rebuild the hand. Releasing the gesture and
    // interpreting it are two different jobs.
    const wasDragging = dragging;
    const hand0 = el('k-hand'); if (hand0) hand0.classList.remove('k-hand-cancel');
    if (dragging) {
      dragging = false; if (raf) { cancelAnimationFrame(raf); raf = 0; }
      aimClear();
      btn.classList.remove('k-dragging', 'k-aiming', 'k-drop-ok');
      btn.style.removeProperty('--dragx'); btn.style.removeProperty('--dragy');
    }
    if (C.pendingDiscard) {                      // Quick Throw's second half
      if (!pickDiscard(id)) renderHand();
      return;
    }
    if (wasDragging) {
      const over = dropTargetAt(e.clientX, e.clientY, id);
      if (!dropCommit(id, over)) renderHand();
      else { lockHand(); clearSelection(); }
      return;
    }
    // A tap that arrives while the hand is still settling from the last play
    // is a tap aimed at a card that has since moved. It selects, never commits.
    if (handLocked()) { _sel = id; renderHand(); renderApDial(); showPick(id); return; }
    if (_sel === id) { commitCard(id); }
    else { _sel = id; renderHand(); renderApDial(); showPick(id); }
  });
  btn.addEventListener('pointercancel', () => { clearTimeout(holdT); armed = false; dragging = false;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    aimClear();
    const hc = el('k-hand'); if (hc) hc.classList.remove('k-hand-cancel');
    btn.classList.remove('k-dragging', 'k-aiming', 'k-drop-ok');
    btn.style.removeProperty('--dragx'); btn.style.removeProperty('--dragy'); });
}
// ONE TARGETING SYSTEM AT A TIME. Tap-select raises a card and paints a gold
// ring on its legal target; drag-aim paints a red reticle and a beam. Starting
// a drag while a different card was still selected left BOTH on screen — two
// cards looking active, and the Regent wearing two rings that overlapped. The
// drag wins, because the drag is the thing the hand is doing right now.
// `quiet` drops the selection WITHOUT rebuilding the fan. That matters
// exactly once, and it cost three checks to find: retiring a standing
// selection at the START of a drag re-rendered the hand, which replaced every
// card element — including the one the finger was holding. The dragged card
// was detached mid-gesture, so no beam was ever drawn and the card never
// moved. A drag is the one moment the hand must not be rebuilt underneath.
function clearSelection(quiet) {
  if (!_sel) return;
  _sel = null;
  pickClear();
  // the preview is a claim about a card that is no longer under the finger —
  // it has to go the moment the selection does, whether the hand redraws or not
  if (C) renderApDial();
  if (!quiet) renderHand();
}
// ═════════════════════════════════════════════════════════════════════════════
// TAP TO AIM — the same arcs a drag casts, on the people themselves
// ═════════════════════════════════════════════════════════════════════════════
// Tapping a card used to raise a spinning dashed circle: a shape that appeared
// nowhere else in this interface, and which for an ally card sat on the party
// HUD — on the PORTRAITS rather than on the characters standing in the scene.
// It also said nothing about who the card could reach.
//
// Tap now casts what a drag casts: one bowed dotted ribbon per figure the card
// can legally land on, each ending in the same corner-bracket reticle the drag
// path uses, all of it drawn on the battlefield. The reticles are the buttons —
// tapping one plays the card AT that specific ally, which the ring could never
// express because it only ever had one position.
let _pick = null;

function pickLayer() {
  let svg = document.getElementById('k-pick');
  if (!svg) {
    svg = document.createElementNS(AIMNS, 'svg');
    svg.id = 'k-pick';
    svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;'
      + 'pointer-events:none;z-index:25;overflow:visible';
    el('k-stage').appendChild(svg);
  }
  svg.setAttribute('viewBox', '0 0 932 430');
  return svg;
}
function pickClear() {
  if (_pick && _pick.raf) cancelAnimationFrame(_pick.raf);
  _pick = null;
  const s = document.getElementById('k-pick');
  if (s) s.innerHTML = '';
  document.querySelectorAll('.k-pick-valid')
    .forEach(n => n.classList.remove('k-pick-valid'));
}
// WHERE THE CARD ACTUALLY LANDS — which is not always a choice.
// The first pass drew an arc to every living ally for anything that was not an
// enemy card, and that was a LIE of exactly the kind the card faces are held to
// avoid: `heal` has no ally argument at all, it finds the most wounded on its
// own, so three arcs offered a pick the rules do not have. Pressing the one
// over Elin healed Ash, and the check caught it.
//
// So there are three cases, and only the middle one is a decision:
//   enemy  — one answer, the foe
//   ally   — the player names the ally, and every living one is offered
//   party  — the card's own rule picks, and the arcs SHOW that pick: the most
//            wounded for a heal, the lowest for a ward, everyone for an all
function pickTargets(cardId) {
  const ev = evaluateCard(cardId);
  const c = ev.card;
  const out = [];
  const fig = (id) => document.querySelector('.k-hero[data-hero="' + id + '"]');
  if (c.target === 'enemy') {
    const b = el('k-boss-art');
    if (b) out.push({ node: b, hero: null, yf: 0.42 });
    return out;
  }
  const live = livingHeroes();
  if (c.target === 'ally') {
    live.forEach(id => { const n = fig(id); if (n) out.push({ node: n, hero: id, yf: 0.4 }); });
    return out;
  }
  const set = [];
  const add = (id) => {
    if (id && set.indexOf(id) < 0 && live.indexOf(id) >= 0) set.push(id);
  };
  for (const fx of (ev.resolvedEffects || c.base || [])) {
    if (fx.guardAll || fx.healAll) live.forEach(add);
    // the same sorts the resolver runs, so the arc cannot disagree with it
    if (fx.heal) add(live.slice().sort((a, b) =>
      (C.heroes[b].max - C.heroes[b].hp) - (C.heroes[a].max - C.heroes[a].hp))[0]);
    if (fx.guardLowest) add(live.slice().sort((a, b) => C.heroes[a].hp - C.heroes[b].hp)[0]);
    if (fx.guardSelf || fx.counterstance || fx.intercede) add(primaryHero(c));
  }
  if (!set.length) add(primaryHero(c));
  set.forEach(id => { const n = fig(id); if (n) out.push({ node: n, hero: null, yf: 0.4 }); });
  return out;
}
function showPick(cardId) {
  pickClear();
  const stage = el('k-stage'); if (!stage) return;
  const targets = pickTargets(cardId);
  if (!targets.length) return;
  const sr = stage.getBoundingClientRect();
  const scale = sr.width / stage.offsetWidth || 1;
  const pt = (node, yf) => {
    const r = node.getBoundingClientRect();
    return { x: (r.left + r.width / 2 - sr.left) / scale,
             y: (r.top + r.height * yf - sr.top) / scale };
  };
  const btn = document.querySelector('.k-card[data-card="' + cardId + '"]');
  const from = btn ? pt(btn, 0.12) : { x: 466, y: 402 };
  const col = aimColor(cardId);
  const svg = pickLayer();
  let html = '';
  targets.forEach((t, i) => {
    const p = pt(t.node, t.yf);
    const bow = Math.min(60, Math.max(22, Math.abs(p.x - from.x) * 0.11));
    const d = 'M ' + from.x + ' ' + from.y + ' Q ' + ((from.x + p.x) / 2) + ' '
            + Math.max(10, Math.min(from.y, p.y) - bow) + ' ' + p.x + ' ' + p.y;
    html += '<path class="k-pk-glow" d="' + d + '" fill="none" stroke="' + col
         +  '" stroke-width="9" stroke-linecap="round" opacity="0.14"/>'
         +  '<path class="k-pk-dash" d="' + d + '" fill="none" stroke="' + col
         +  '" stroke-width="3.4" stroke-linecap="round" stroke-dasharray="3 9"/>'
         +  '<g class="k-pk-ret" data-i="' + i + '" transform="translate(' + p.x + ' ' + p.y + ')">'
         // an invisible disc under the brackets: the reticle is the button, and
         // a 16px bracket is not a thumb-sized target
         +  '<circle class="k-pk-hit" r="30" fill="rgba(0,0,0,0.001)"/>'
         +  '<g class="k-pk-r1"><path d="' + cornerPath(16) + '" fill="none" stroke="' + col
         +  '" stroke-width="2.6" stroke-linecap="round"/></g>'
         +  '<circle r="3.4" fill="#fff2ea"/></g>';
    t.node.classList.add('k-pick-valid');
  });
  svg.innerHTML = html;
  _pick = { cardId, targets, t0: performance.now(), raf: 0,
            dashes: [].slice.call(svg.querySelectorAll('.k-pk-dash')),
            rings: [].slice.call(svg.querySelectorAll('.k-pk-r1')) };
  [].slice.call(svg.querySelectorAll('.k-pk-ret')).forEach((g) => {
    g.style.pointerEvents = 'auto';
    g.style.cursor = 'pointer';
    g.addEventListener('pointerdown', (e) => {
      e.stopPropagation(); e.preventDefault();
      const t = targets[+g.dataset.i];
      commitCard(cardId, t && t.hero);
    });
  });
  const step = () => {
    if (!_pick) return;
    const ph = (performance.now() - _pick.t0) * 0.05;
    for (const d of _pick.dashes) d.setAttribute('stroke-dashoffset', -ph);
    const k = (1 + Math.sin(ph / 26) * 0.07).toFixed(3);
    for (const r of _pick.rings) r.setAttribute('transform', 'scale(' + k + ')');
    _pick.raf = requestAnimationFrame(step);
  };
  _pick.raf = requestAnimationFrame(step);
}
function commitCard(cardId, allyId) {
  lockHand();
  _sel = null;
  pickClear();
  playCard(cardId, allyId);
}
// MTG ARENA INSPECT — hold a card and it blows up, centred and legible, over a
// dimmed board. Release to put it back. It never commits the card: playing is
// dragging, so inspecting can never cost you a turn by accident.
// THE GAME HAD NO RULES TEXT. `COND_RULE` explained a card's CONDITION and
// that was the entire rulebook: Break, Guard, Bleed, Chill and the dirge appear
// on card faces as bolded numbers with no definition anywhere in game.js, run.js
// or index.html. A player could reach the Regent without ever being told that
// Guard is spent at end of turn, that the dirge cannot be parried, or — the one
// that decides fights — that emptying her Poise cancels her whole next action,
// the hymn included.
//
// It lives in the inspect panel rather than in a glossary nobody opens: the
// keywords a card actually uses are spelled out beside it, at the moment the
// player is looking at that card and asking what it does.
const KEYWORD_RULE = {
  brk:   ['Break', 'Strips the foe\u2019s Poise. Empty it and they are STAGGERED: their next action dies unsung — the dirge with it — and they take +25% until it refills.'],
  guard: ['Guard', 'Absorbed before health, and it is one of only two things that answer the dirge. It is spent at the end of your turn, so it is worth exactly the turn you bank it for.'],
  heal:  ['Heal', 'Health back, up to the hero\u2019s maximum. Nothing carries over.'],
  chill: ['Chill', 'The foe\u2019s NEXT hit lands softer. One hit only — the first one spends it.'],
  bleed: ['Bleed', 'Ticks at the start of the foe\u2019s turn, then weakens by one. It stacks with itself.'],
  dirge: ['The dirge', 'The hymn settles on all three of them after the blows. No timing answers it — only Guard, healing, and STAGGERING her before she sings.'],
  // THE TWO THE FACE STOPPED SPELLING OUT. Both were full sentences on a 94px
  // line saying the same thing every time they appeared, which is the exact
  // shape of a keyword.
  intercede: ['Intercede', 'Step into the blow meant for someone else. You answer its parry window instead of them, and whatever Guard is on you is what absorbs it.'],
  exhaust: ['Exhaust', 'Played once and gone — it leaves the fight rather than going to the discard, so it will not come back around this fight.'],
};
// which of them a given card actually puts on the board
function keywordsOf(effects, card) {
  const k = new Set();
  // WHAT THE FACE PRINTS, NOT ONLY WHAT RESOLVES THIS INSTANT. Reading
  // `resolvedEffects` alone meant a card whose Break lives in its conditional
  // half explained fewer keywords than the card in front of it was showing —
  // and a sleeping condition is exactly the state a new player reads it in.
  const all = (effects || []).slice()
    .concat((card && card.base) || [])
    .concat((card && card.cond && card.cond.bonus) || []);
  for (const fx of all) {
    // Counterstance's whole effect is a flag; its face still prints BREAK
    if (fx.counterstance) k.add('brk');
    if (fx.brk) k.add('brk');
    if (fx.guardSelf || fx.guardAll || fx.guardAlly || fx.guardLowest) k.add('guard');
    if (fx.heal || fx.healAll) k.add('heal');
    if (fx.chill) k.add('chill');
    if (fx.bleed) k.add('bleed');
    if (fx.intercede) k.add('intercede');
  }
  if (card && card.exhaust) k.add('exhaust');
  return [...k];
}

// THE INSPECT PANEL, BUILT ONCE. The deck screen shows the same reading of a
// card that combat's press-and-hold does, and two copies of a rules panel is
// how a game ends up explaining the same keyword two different ways. This is
// the one place that decides what a card SAYS; `openInspect` fills it from
// live combat and `staticInspectHTML` fills it from the card alone.
//   ev   — an evaluation (real, or the synthetic one staticCardHTML uses)
//   who  — the line above the rules; combat adds the row the hero stands in,
//          the deck screen cannot, because off the board there is no row.
//   hint — the footer; the gesture differs between the two callers.
function inspectHTML(ev, who, hint) {
  const c = ev.card;
  const ownerArt = HEROES23[primaryHero(c)].art;
  const gem = ev.condActive && ev.currentCost !== c.cost
    ? ev.currentCost + '<s>' + c.cost + '</s>' : String(ev.currentCost);
  return '<div class="k-insp-wrap"><div class="k-insp-card">'
    + cardFaceHTML(c, ev, gem, ownerArt) + '</div></div>'
    + '<div class="k-insp-side">'
    + '<div class="k-insp-who">' + who + '</div>'
    // THE MARK'S NAME LIVES HERE NOW. The face carries the fold — a glyph and a
    // colour, the way a set symbol does — and a symbol on its own cannot state
    // a rule. Arena puts the symbol on the card and the reminder text on the
    // detail view; this is the detail view.
    + (ev.sigil && SIGILS[ev.sigil]
        ? '<div class="k-insp-sig k-csig-' + ev.sigil + '">'
          + '<b>' + icon(SIGILS[ev.sigil].glyph || 'finale')
          + SIGILS[ev.sigil].name.toUpperCase() + '</b>'
          + '<span>' + SIGILS[ev.sigil].line + '</span></div>' : '')
    + '<div class="k-insp-now"><em>Resolves now</em>' + prose(ev.resolvedEffects) + '</div>'
    // ACTIVE / NOT YET IS A READING OF A TURN IN PROGRESS. On the deck screen
    // there is no turn, so every condition read "not yet" — which is not a
    // neutral default, it is a false claim about a fight that is not happening.
    // `condLive` is false there and the label states the rule and stops.
    + (c.cond ? '<div class="k-insp-cond' + (ev.condActive ? ' on' : '') + '">'
        + '<b>' + (COND_LABEL[c.cond.type] || c.cond.type)
        + (ev.condLive === false ? '' : ' — ' + (ev.condActive ? 'ACTIVE' : 'not yet')) + '</b>'
        + '<span>' + (COND_RULE[c.cond.type] || '') + '</span>'
        // WHAT IT PAYS, spelled out where there is room for it. The face carries
        // the keyword and the number; this is the place a player asks what the
        // number is FOR, and it was the one thing the panel did not answer.
        + '<em class="k-insp-pay">' + condReward(c, ev.sigil) + '</em></div>' : '')
    + (() => {
        const ks = keywordsOf(ev.resolvedEffects, c);
        if (!ks.length) return '';
        return '<div class="k-insp-keys">' + ks.map(k =>
          '<div class="k-insp-key">' + icon(k) + '<b>' + KEYWORD_RULE[k][0] + '</b>'
          + '<span>' + KEYWORD_RULE[k][1] + '</span></div>').join('') + '</div>';
      })()
    // two lines of hint under a panel that now also carries the mark was a line
    // too many — the same two things, in half the words. The words themselves
    // belong to the CALLER: "drag to play" is a lie on a screen with no board.
    + (hint ? '<div class="k-insp-hint">' + hint + '</div>' : '')
    + '</div>';
}
// WHO A CARD BELONGS TO, without asking the board. A pair card names both.
function inspectWho(c, row) {
  if (isPairCard(c)) return ownerHeroes(c).map(h => HEROES23[h].name).join(' + ') + ' \u00b7 Bond';
  return HEROES23[c.owner].name + ' \u00b7 ' + HEROES23[c.owner].cls
    + (row ? ' \u00b7 ' + row + ' row' : '');
}
// THE SAME PANEL, WITHOUT A FIGHT. Built on the synthetic evaluation
// `staticCardHTML` uses, so the deck screen and the card preview cannot drift
// apart: nothing here reads `C`.
function staticInspectHTML(id, opts) {
  const o = opts || {};
  const c = o.def || cardDef(id);
  if (!c) return '';
  const sigil = o.sigil || null;
  const ev = { cardId: id, card: c, condActive: false, condLive: false,
               currentCost: c.cost, sigil,
               resolvedEffects: sigil === 'surge' ? brighten(c.base) : c.base };
  return inspectHTML(ev, inspectWho(c, null), o.hint || '');
}
function openInspect(cardId) {
  _focus = cardId;
  const ev = evaluateCard(cardId);
  const f = el('k-focus');
  f.innerHTML = inspectHTML(ev, inspectWho(ev.card, C.heroes[ev.card.owner] && C.heroes[ev.card.owner].row),
                            'release to close \u00b7 drag to play');
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
        const art = HEROES23[primaryHero(c)].art;
        return '<div class="k-card k-card-static">' + cardFaceHTML(c, ev, String(c.cost), art) + '</div>';
      }).join('') : '<div class="k-pile-empty">empty</div>')
    + '</div><div class="k-pile-hint">tap anywhere to close</div></div>';
  f.classList.remove('k-hidden');
  el('k-stage').classList.add('k-inspecting');
  _focus = 'pile:' + which;
}

function bindChrome() {
  // ENDING A TURN WITH AP IN HAND ASKS ONCE. The button sits beside the
  // discard pile and the volley begins the instant it is pressed, so a single
  // mis-tap throws away a whole turn AND rolls straight into a bar you are not
  // braced for. The confirm only appears when there is something to lose.
  el('k-endturn').onclick = () => {
    const btn = el('k-endturn');
    if (C && C.ap > 0 && C.phase === 'PLAYER_READY' && _etArmedTurn !== C.turn) {
      _etArmedTurn = C.turn;
      btn.classList.add('k-et-armed');
      btn.textContent = C.ap + ' AP LEFT — END?';
      clearTimeout(btn._t);
      btn._t = setTimeout(disarmEndTurn, 2600);
      return;
    }
    disarmEndTurn();
    _sel = null; pickClear(); endTurn();
  };
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
      // A PARRY BAR OWNS THE FINGER. The rings sit over the heroes, and a hero
      // carries its own drag — so pressing a ring was ALSO grabbing the figure
      // underneath it: the rows lifted out of the ground, the move hint came
      // up, and setPointerCapture took the pointer. Pressing a note made the
      // whole board move.
      // GATED ON THE PHASE AND THE DOM, NOT ON `_live`. The first guard read
      // `_live.length`, and that list is a running array a note removes itself
      // from — one leaked entry and hero movement is dead for the rest of the
      // fight, which is a worse bug than the one being fixed. A hero can only
      // be moved on your own turn anyway (moveReason has always said so), and a
      // ring in the document is a fact that cannot go stale.
      if (C.phase !== 'PLAYER_READY') return;
      if (document.querySelector('.k-pring')) return;
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
    SFX.unlock();          // the first touch is what a browser waits for
    if (_focus) { closeInspect(); return; }
    // TAPPING THE PERSON IS TAPPING THE RETICLE. The brackets are the button,
    // but nobody aims at a bracket when a character is standing under it.
    if (_sel && _pick) {
      const fig = e.target.closest && e.target.closest('.k-pick-valid');
      if (fig) {
        const t = _pick.targets.filter(x => x.node === fig)[0];
        if (t) { e.preventDefault(); commitCard(_sel, t.hero); return; }
      }
    }
    if (_sel && !e.target.closest('.k-card') && !e.target.closest('#k-pick')) {
      _sel = null; pickClear(); renderHand(); renderApDial();
    }
  });
}

// ── boot + test hooks ──
window.addEventListener('DOMContentLoaded', () => {
  bindChrome();
  const seed = testMode() ? 7 : undefined;
  // THE SUITE STILL BOOTS STRAIGHT INTO A FIGHT. Combat has 106 checks written
  // against a page that opens on the board; putting a map in front of it would
  // have rewritten all of them to say the same things one click later, which
  // buys nothing. ?test=1&road=1 boots the run instead, for the road's own checks.
  const road = /[?&]road=1/.test(location.search);
  // ?resume=1 — boot the way a PLAYER's reload boots: from the stored run.
  // Test mode is otherwise deliberately `fresh`, so every suite starts clean —
  // which also means the resume path, where a run-based game hides its worst
  // bugs, was the one path no suite could reach.
  const resume = /[?&]resume=1/.test(location.search);
  if (window.R && window.R.boot && (!testMode() || road)) {
    window.R.boot({ seed, fresh: testMode() && !resume });
  }
  else startCombat({ seed });
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
  // A TEST HOOK THAT SILENTLY SELECTS SOMETHING ELSE IS WORSE THAN NO HOOK.
  // This found the intent's index in REGENT_INTENTS — the full table of eight —
  // and assigned it to `C.boss.intentIx`, which currentIntent() reads against
  // C.intents, the FOE'S filtered subset. The two lists only agree for a foe
  // that draws every intent. Measured across the bestiary: 11 of 17 calls
  // selected a different intent from the one they named — asking the wraith for
  // its scythe got the rain, asking the husk for its toll got the scythe — so
  // every check in the suite that names an intent on a non-Regent foe has been
  // asserting against something else, and passing.
  forceIntent(id) {
    const ix = (C.intents || []).findIndex(i => i.id === id);
    if (ix >= 0) { C.boss.intentIx = ix; renderAll(); return true; }
    // …AND IT SAYS SO OUT LOUD. Returning false was not enough: every caller in
    // the suite ignores the return, so when Build 94 re-dealt the bestiary's
    // intent hands, fourteen checks went on asking the Mourning Regent for a
    // Benediction she no longer knows — and quietly graded whatever intent
    // happened to be current instead. Six of them failed with baffling
    // messages about the wrong note kind; the rest passed while testing
    // something else. The harness counts a console error as a suite failure,
    // so a stale name is now loud at the exact line that used it.
    console.error('forceIntent: ' + C.foe.id + ' has no intent "' + id + '" — '
      + 'it knows ' + (C.intents || []).map(i => i.id).join(', '));
    return false;
  },
  KEYWORD_RULE, keywordsOf, ROW_SHELTER, parryGrade, readString, dirOK, dropTargetAt, openPile, currentIntent, intentPreviewDmg, intentTargetId, dirgeAmount,
  // test-only: the deeds ledger is what the reckoning is allowed to talk
  // about, so its two writers are drivable directly rather than only through a
  // whole fight that happens to produce the situation
  _markBrink: (id) => markBrink(id), _dealToBoss: (n, why, who) => dealToBoss(n, why, who),
  // test-only: the parry's payout ladder is the steepest curve in the game.
  // TURNED is all-or-nothing PER NOTE, so it compounds — a player who reads
  // 45% of notes turns 0.45^2 = 20% of a two-note string while one who reads
  // 92% turns 85%, and a 2x gap in hands becomes a 4x gap in the thing that
  // decides fights. Tuning that by argument is how a cliff gets steeper, so
  // the ladder is drivable from a sim and the change can be A/B'd.
  _parryWeights: () => ({ ...PARRY_WEIGHT }),
  _setParryWeights: (o) => { Object.assign(PARRY_WEIGHT, o || {}); },
  actionKind, castTone, cardArt, overHand, FOE_SHEETS, fxFoeDown,
  // test-only: drive the foe's performance directly, through the same hooks the
  // fight drives, so a check can ask what each intent actually pulls
  _fxFoeWind: () => fxFoeWind(), _fxFoeAct: (i) => fxFoeAct(i),
  _fxFoeSettle: () => fxFoeSettle(),
  _fxStrikeBoss: (n, why) => fxStrikeBoss(n, why), _fxInterrupt: () => fxInterrupt(),
  // test-only: drive the two paths that carry combat audio, through the very
  // functions the fight calls, so a check hears what a player would
  _fxNoteGrade: (grade, kind) => fxNoteGrade(null, 400, 200, grade, kind),
  _fxHitResolved: (id, taken, negated, flawless) => fxHitResolved(id, taken, negated, flawless),
  MUSIC, MUSIC_SRC, musicOn, musicPref, musicSet, gridStart, ICON_PATHS, icon, SFX, sfx,
  // test-only: the runway a bar is promised, so a check can assert the RULE
  // (rounding forward never shortens it) instead of restating the number. The
  // music suite hardcoded 1.0s — BEAT_LEADIN 2 x BEAT_MS 500 — and went red the
  // moment Build 94 shortened the lead-in, reporting a broken promise where
  // there was only a changed constant.
  BEAT_MS, BEAT_LEADIN,
  intentByTarget, ROW_LETTER,
  FOES, foeHp, combatSummary, CARD_UPS, CARD_DEFS, cardDef, effectText, staticCardHTML, staticInspectHTML,
  cam, bgParallax, SIGILS, sigilOf, brighten,
  BOND_CARDS, BOND_IDS, baseRoster, rosterIds, rosterValid, SLOTS_PER_HERO,
  ownerHeroes, primaryHero, isPairCard, pairOf,
  _setPhase: setPhase,          // test-only: end a fight without playing it out
  // test-only: the words a note wears on arrival vs at the gradeable instant,
  // read from the function the note itself calls rather than restated here
  ACTS, parseAct, noteForAct, DRAW_SHAPES, DRAW_OK, drawScore, strokeTurn,
  FOE_POSES, FOE_SWINGS,
  INTENTS: () => REGENT_INTENTS,
  _noteWords: () => ({ feint: NOTE_WORD.feint, bait: NOTE_WORD.bait,
                       feintLive: liveLabel('feint', NOTE_WORD.feint),
                       holdLive: liveLabel('hold', NOTE_WORD.hold),
                       tapLive: liveLabel('tap', NOTE_WORD.tap),
                       burstLive: liveLabel('burst', NOTE_WORD.burst) }),
  // test-only: drive the press arbiter directly. Two notes and a list of press
  // timestamps in, the letter of the note that claims each press out.
  _liveTest(notes, presses) {
    const saved = _live.splice(0, _live.length);
    notes.forEach(n => liveOpen(n));
    const letter = (n) => String.fromCharCode(65 + notes.indexOf(n));
    const out = presses.map(p => {
      const owner = notes.find(n => claimsPress(n, p.at));
      return { at: p.at, want: p.want, got: owner ? letter(owner) : null };
    });
    _live.splice(0, _live.length);
    saved.forEach(n => _live.push(n));
    return out;
  },
  tune(t) { Object.assign(TUNE, t || {}); return TUNE; },
};
