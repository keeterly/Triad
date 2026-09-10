// KIZUNA v2.3 — RUN simulator.
//
// balance.sim.cjs answers "is one fight tuned?". That is the wrong question for
// fodder: you should almost always beat the Husk, so its winrate tells you
// nothing. The question a road asks is "what does the fight COST", because the
// wound is carried to the next stop and the run is decided by attrition.
//
// So this plays the whole road — the same bot, the same page, the same rules —
// carrying HP between stops and camping where the map says to camp, and reports
// completion rate, where runs die, and how much health walks into the Regent.
'use strict';
const { boot } = require('./harness.cjs');
const { BOT } = require('./bot.cjs');

const ALL_BANDS = [
  { name: 'NO PARRY',      p: 0.00, glo: 0,  ghi: 6 },
  { name: '~HALF PARRIES', p: 0.50, glo: 8,  ghi: 45 },
  { name: 'EXCELLENT',     p: 0.92, glo: 65, ghi: 100 },
];
// SIM_BAND runs one tier at a time, so a comparison that only concerns the
// half-parry band can be run at the sample size a shipped NUMBER needs rather
// than the one the three-tier gate can afford.
const BANDS = process.env.SIM_BAND
  ? ALL_BANDS.filter(b => b.name.toLowerCase().indexOf(process.env.SIM_BAND.toLowerCase()) >= 0)
  : ALL_BANDS;
const RUNS = Number(process.env.SIM_RUNS || 120);
const MAX_TURNS = 30;
const MAXHP = { ash: 42, elin: 36, mira: 34 };
const total = (hp) => hp.ash + hp.elin + hp.mira;

(async () => {
  const H = await boot({ query: 'road=1' });
  const { J, page } = H;
  await J(() => { window.__SIM = true; });
  // The mend is the game's number, not the sim's — a simulator carrying its own
  // copy of a tuning constant measures a game nobody is playing.
  const CAMP_FRAC = await J(() => window.R.CAMP_FRAC);
  const TREE = await J(() => JSON.parse(JSON.stringify(window.R.TREE)));
  // SIM_KZCARRY overrides the game's carry so the change can be measured
  // against its own absence rather than against a remembered number.
  const KZ_CARRY = process.env.SIM_KZCARRY != null
    ? Number(process.env.SIM_KZCARRY)
    : await J(() => window.R.KIZUNA_CARRY);
  const SIGIL_BY_PAIR = await J(() => window.R.SIGIL_BY_PAIR);
  const BOND = await J(() => ({ steps: window.R.BOND_STEPS, pairs: window.R.PAIRS,
    scenes: Object.keys(window.R.BONDS).reduce((a, k) => {
      a[k] = window.R.BONDS[k].map(sc => sc.picks.map(p => p.card)); return a;
    }, {}) }));
  const BASE_ROSTER = await J(() => window.K.baseRoster());
  // SIM_NOBONDS measures the road without the social layer, so the layer can be
  // compared against its own absence rather than against a remembered number.
  const NOBONDS = process.env.SIM_NOBONDS != null;

  // One road, walked. The bot has no map sense, so it takes the choice a
  // player would take by default — it prefers a campfire when it is hurt and
  // the embers when it is not, which is the same heuristic the map is asking
  // a human to apply.
  async function walk(seed, p) {
    // THE ROAD NOW OPENS ON A CHOICE, and a sim that skipped it would be
    // walking a road no player can walk. The boon is taken through the real
    // run layer and its effects are READ BACK rather than re-implemented here,
    // so the sim cannot drift from the game. The pick rotates by seed so all
    // of them are walked across a tier instead of one being sampled 120 times.
    // AN OLD HABIT is excluded: it opens the swap screen and waits for a
    // finger, which a headless walk does not have.
    const start = await J((s) => {
      window.R.newRun(s);
      const offer = window.R.wakeOffer().filter(w => w.kind !== 'card');
      window.R.takeWake(offer[s % offer.length].id);
      const r = window.R.state();
      return { map: window.R.map().map(n => ({ id: n.id, col: n.col, kind: n.kind, foe: n.foe, to: n.to })),
               woke: r.woke, embers: r.embers, kizuna: r.kizuna, vigor: r.vigor || 0,
               foeBonus: r.foeBonus || 0, hp: r.hp, bonds: r.bonds };
    }, seed);
    const road = start.map;
    // the last column the dealt map actually has a node in
    const DEPTH = road.reduce((m, n) => Math.max(m, n.col), 0);
    const maxhp = {}; for (const k of Object.keys(MAXHP)) maxhp[k] = MAXHP[k] + start.vigor;
    let at = null, hp = start.hp ? { ...start.hp } : { ...maxhp };
    let embers = start.embers, fights = 0, tier = 1, kizuna = start.kizuna;
    let roster = JSON.parse(JSON.stringify(BASE_ROSTER));
    const bonds = { ...start.bonds };
    const levels = { 'ash|elin': 0, 'ash|mira': 0, 'elin|mira': 0 };
    let traded = 0, marked = 0;
    const sigils = {};             // cardId → the mark the bond put on it
    let nodes = [];     // what this run has kindled
    const trace = [];   // what the party had left walking away from each stop
    // ── THE ROAD IS AS LONG AS THE ROAD IS (Build 224) ──────────────────────
    //
    // This read `col < 6`, and it had been wrong since the road grew to eleven
    // columns. The boss stands at column 10, so the walk stopped five stops
    // short of it, fell out of the loop, and returned `{ win: false, diedAt: 5,
    // kind: 'ran-out' }` — which the report then printed as a DEATH at stop 5.
    // That is the whole of the "0% completion" this sim had been reporting: a
    // party that survived everything the walk let it reach was recorded as a
    // party that was killed. Two of the three tier gates were red on it, and
    // nothing was wrong with the game.
    //
    // The bound comes from the map now, so lengthening the road again cannot
    // quietly reintroduce it.
    for (let col = 0; col <= DEPTH; col++) {
      const open = at ? road.find(n => n.id === at).to : road.filter(n => n.col === 0).map(n => n.id);
      const opts = open.map(id => road.find(n => n.id === id));
      const hurt = total(hp) / total(maxhp);
      const want = opts.find(n => n.kind === 'camp' && hurt < 0.72)
        || opts.find(n => n.kind === 'story' && hurt >= 0.72)
        || opts.find(n => n.kind !== 'camp') || opts[0];
      at = want.id;
      if (want.kind === 'camp') {
        for (const k of Object.keys(maxhp)) hp[k] = Math.min(maxhp[k], Math.round(hp[k] + maxhp[k] * CAMP_FRAC));
        // A SIM THAT NEVER SPENDS MEASURES A PARTY NOBODY PLAYS. Same error the
        // ladder note warns about: a bot that hoards its embers reports the road
        // as harder than it is, and every number tuned off it is tuned for a
        // player who forgot the campfire existed. Greedy cheapest-first — a
        // deliberately unclever buyer, so the figure is a FLOOR on what the
        // tree is worth rather than a ceiling.
        // THE FIRE HEARS THEM FIRST, exactly as it does in the game: a pair
        // that crossed a level gets their scene, and the fork is a card that
        // has to be traded into one of the two heroes' five. The bot takes the
        // first fork and gives up the weakest card either owner holds — a
        // deliberately unclever trader, so what this measures is a FLOOR on
        // what the social layer is worth.
        if (!NOBONDS) {
          let guardB = 0;
          while (guardB++ < 6) {
            const pair = BOND.pairs.find(k => {
              const lv = BOND.steps.reduce((n, need) => (bonds[k] >= need ? n + 1 : n), 0);
              return lv > levels[k] && (BOND.scenes[k] || [])[levels[k]];
            });
            if (!pair) break;
            const card = BOND.scenes[pair][levels[pair]][0];
            levels[pair]++;
            const drop = await page.evaluate(([rst, owners, gained]) => {
              const worth = (id) => {
                const c = window.K.CARD_DEFS[id];
                return c.base.reduce((n, fx) => n + (fx.dmg || 0) + (fx.heal || 0) + (fx.healAll || 0)
                  + (fx.guardSelf || 0) + (fx.guardAll || 0) + (fx.guardAlly || 0) + (fx.guardLowest || 0)
                  + (fx.brk || 0) * 3 + (fx.bleed || 0) * 2, 0) / Math.max(1, c.cost);
              };
              let worst = null, wv = Infinity, wh = null;
              for (const h of owners) for (const id of rst[h]) {
                if (id === gained) continue;
                const v = worth(id);
                if (v < wv) { wv = v; worst = id; wh = h; }
              }
              return { hero: wh, id: worst };
            }, [roster, pair.split('|'), card]);
            if (!drop.id) break;
            const list = roster[drop.hero];
            list[list.indexOf(drop.id)] = card;
            traded++;
            // THE LEVEL ALSO MARKS A CARD. A sim that traded the card and
            // skipped the mark would measure the social layer at less than it
            // is — and the mark is the half that exists to make the combo
            // layer reachable, which is the half most likely to move a number.
            // Deliberately unclever again: the first unmarked card the pair
            // owns, so the figure stays a FLOOR.
            let sig = SIGIL_BY_PAIR[pair] && SIGIL_BY_PAIR[pair][levels[pair] - 1];
            // Diagnostics, so the mark can be measured against its own absence
            // the way the bond layer was. SIM_NOSIG places nothing; SIM_ONLYSIG
            // places only the named mark.
            if (process.env.SIM_NOSIG != null) sig = null;
            if (process.env.SIM_ONLYSIG && sig !== process.env.SIM_ONLYSIG) sig = null;
            if (sig) {
              const owners = pair.split('|');
              let target = null;
              for (const h of owners) {
                for (const id of roster[h]) if (!sigils[id]) { target = id; break; }
                if (target) break;
              }
              if (target) { sigils[target] = sig; marked++; }
            }
          }
        }
        let buying = true;
        while (buying) {
          buying = false;
          const open = TREE.filter(n => nodes.indexOf(n.id) < 0 && n.tier <= tier && n.cost <= embers)
                           .sort((a2, b2) => a2.cost - b2.cost);
          if (open.length) { embers -= open[0].cost; nodes.push(open[0].id); buying = true; }
        }
        trace.push({ col, kind: 'camp', left: total(hp), turns: 0 });
        continue;
      }
      if (want.kind === 'story') { embers += 1; tier = Math.min(5, tier + 1); trace.push({ col, kind: 'story', left: total(hp), turns: 0 }); continue; }
      fights++;
      const r = await page.evaluate(
        ([src, sd, pp, mt, o]) => eval(src)(sd, pp, mt, o),
        [BOT, seed * 31 + col * 7 + 1, p, MAX_TURNS, { foe: want.foe, partyHp: hp, kizuna, roster,
          vigor: start.vigor, sigils,
          foeBonus: want.kind === 'boss' ? start.foeBonus : 0,
          upgrades: nodes.map(id => (TREE.find(n => n.id === id) || {}).card).filter(Boolean),
          allout: (TREE.find(n => nodes.indexOf(n.id) >= 0 && n.allout) || {}).allout || null }]);
      hp = r.hp;
      kizuna = Math.round((r.kizuna || 0) * KZ_CARRY);
      for (const k of BOND.pairs) bonds[k] += ((r.pairBond || {})[k] || 0);
      trace.push({ col, kind: want.kind, foe: want.foe, left: total(hp), turns: r.turns,
                   allouts: r.allouts || 0 });
      if (!r.win) return { win: false, diedAt: col, kind: want.kind, foe: want.foe, hp, embers, fights, trace, nodes, traded, marked, roster, woke: start.woke };
      embers += ({ husk: 2, cultist: 2, wraith: 3, revenant: 5, mourner: 8 })[want.foe] || 2;
      if (want.kind === 'boss') return { win: true, diedAt: null, hp, embers, fights, trace, nodes, traded, marked, roster, woke: start.woke };
    }
    // Reaching here means the walk ran off the end of the map without meeting a
    // boss, which is a broken map rather than a dead party — so it is reported
    // as its own kind and at the stop it really got to.
    return { win: false, diedAt: DEPTH, kind: 'ran-out', hp, embers, fights, trace, nodes, traded, marked, roster, woke: start.woke };
  }

  // asked of the game rather than written down here, so a fourth basic added
  // tomorrow does not quietly start failing the shape gate
  const BASICS = await page.evaluate(() =>
    Object.keys(window.K.CARD_DEFS).filter(id => window.K.CARD_DEFS[id].basic));

  console.log(`\n  KIZUNA v2.3 — the road, walked ${RUNS}× per tier\n`);
  const rows = [];
  for (const band of BANDS) {
    const res = [];
    for (let i = 0; i < RUNS; i++) res.push(await walk(4000 + i * 13, band.p));
    const wins = res.filter(r => r.win);
    const rate = wins.length / res.length * 100;
    const deaths = {};
    res.filter(r => !r.win).forEach(r => { deaths[r.diedAt] = (deaths[r.diedAt] || 0) + 1; });
    // The one thing a road must never do: kill you at the trailhead.
    const col0 = res.filter(r => r.diedAt === 0).length / res.length * 100;
    const purse = res.map(r => r.embers).sort((a, b) => a - b);
    const held = rate >= band.glo && rate <= band.ghi;
    // 5/5/5, and no card that was WON sitting in the deck twice. It used to
    // ask for fifteen distinct ids, which stopped being the same question at
    // Build 224: a hero's three basics are three of one id now, so a healthy
    // road ends on ten or eleven names.
    const shapeBad = res.filter(r => {
      if (!r.roster) return true;
      if (['ash', 'elin', 'mira'].some(h => (r.roster[h] || []).length !== 5)) return true;
      const ids = ['ash', 'elin', 'mira'].reduce((a, h) => a.concat(r.roster[h]), []);
      return ids.some((x, i) => ids.indexOf(x) !== i && BASICS.indexOf(x) < 0);
    }).length;
    // EVERY ROAD ANSWERED ITS AWAKENING, and the tier as a whole walked more
    // than one of them — a rotation that quietly collapsed to a single boon
    // would report 120 roads and measure one.
    const unwoken = res.filter(r => !r.woke).length;
    const ranOut = res.filter(r => r.kind === 'ran-out').length;
    const marks = res.reduce((n, r) => n + (r.marked || 0), 0) / res.length;
    const woke = {}; res.forEach(r => { woke[r.woke] = (woke[r.woke] || 0) + 1; });
    rows.push({ name: band.name, rate, col0, held, shapeBad, unwoken, woke, marks, ranOut,
                purse: purse[Math.floor(purse.length / 2)] });
    console.log(`  ${held ? '✓' : '✗'} ${band.name.padEnd(15)} runs completed ${rate.toFixed(1)}%  `
      + `[gate ${band.glo}–${band.ghi}%]  died at stop ` + JSON.stringify(deaths)
      + `  median purse ${purse[Math.floor(purse.length / 2)]}`
      + `  median kindled ${(() => { const k = res.map(r => (r.nodes || []).length).sort((a2, b2) => a2 - b2); return k[Math.floor(k.length / 2)]; })()}`
      + `  all-outs/run ${(res.reduce((n, r) => n + (r.trace || []).reduce((m, t) => m + (t.allouts || 0), 0), 0) / res.length).toFixed(2)}`
      + `  bond cards ${(res.reduce((n, r) => n + (r.traded || 0), 0) / res.length).toFixed(2)}`);
    // WHERE THE HEALTH GOES. A completion rate says a road is too hard; the
    // attrition trace says which stop made it too hard, which is the only one
    // of the two you can act on.
    if (process.env.SIM_TRACE) {
      // as deep as any run actually walked, rather than a length written down
      const deepest = res.reduce((m, r) =>
        Math.max(m, ...(r.trace || []).map(t => t.col), 0), 0);
      for (let col = 0; col <= deepest; col++) {
        const at = res.flatMap(r => (r.trace || []).filter(t => t.col === col));
        if (!at.length) continue;
        const left = at.map(t => t.left).sort((a, b) => a - b);
        const trn = at.map(t => t.turns).sort((a, b) => a - b);
        const kinds = {}; at.forEach(t => { kinds[t.foe || t.kind] = (kinds[t.foe || t.kind] || 0) + 1; });
        console.log(`      stop ${col}  ${String(Object.keys(kinds).join('/')).padEnd(16)}`
          + ` median hp left ${String(left[Math.floor(left.length / 2)]).padStart(3)}/112`
          + `  rounds ${trn[Math.floor(trn.length / 2)]}  (n=${at.length})`);
      }
    }
  }
  // FIVE SLOTS A HERO, at the end of every road the sim walked — the rule the
  // whole social layer turns on, checked against the simulator's own trades
  // rather than only against the UI's.
  const rosters = [];
  for (const band of BANDS) void band;
  const allRosters = [];
  const trailhead = rows.find(r => r.name === '~HALF PARRIES') || rows[0];
  const fodderOk = trailhead.col0 <= 8;
  console.log(`  ${fodderOk ? '✓' : '✗'} TRAILHEAD      a competent party does not wipe on the first stop `
    + `(${trailhead.col0.toFixed(1)}% at ~half parries · gate ≤8%)`);
  const monotone = rows.length < 3 || (rows[0].rate <= rows[1].rate && rows[1].rate <= rows[2].rate);
  console.log(`  ${monotone ? '✓' : '✗'} MONOTONE       every step up in parry skill is a longer road survived`);
  // THE MARK IS HALF OF WHAT A BOND LEVEL PAYS, and it is the half that exists
  // to make the combo layer reachable. A tier that trades cards and marks none
  // is measuring the social layer at less than it is.
  const markOk = rows.some(r => r.marks > 0);
  console.log(`  ${markOk ? '✓' : '✗'} THE MARK       every bond level marks a card too `
    + `(${rows.map(r => r.name.trim().split(' ')[0] + ' ' + r.marks.toFixed(2)).join(' · ')} per road)`);
  const wokeOk = rows.every(r => r.unwoken === 0 && Object.keys(r.woke).length >= 3);
  console.log(`  ${wokeOk ? '✓' : '✗'} AWAKENING      every road answered its offer, and the tier walked `
    + `${Object.keys(rows[rows.length - 1].woke).sort().join('/')} `
    + `(${rows.reduce((n, r) => n + r.unwoken, 0)} unanswered of ${RUNS * 3})`);
  // ── AND THE WALK HAS TO REACH THE END OF THE ROAD ─────────────────────────
  //
  // The gate that would have caught this sim lying for six builds. When the road
  // grew to eleven columns and this walk still stopped at six, every run that
  // survived fell out of the loop and was recorded as a death at stop 5: two
  // tier gates went red and stayed red, and the numbers read like a game nobody
  // could finish. Nothing announced that the walk had simply stopped early,
  // because "did not reach the boss" and "died" were the same answer.
  //
  // They are not the same answer any more. `ran-out` is its own kind, and one of
  // them anywhere in a tier fails this — loudly, and pointing at the sim rather
  // than at the game.
  const ranOut = rows.reduce((n, r) => n + r.ranOut, 0);
  const reachOk = ranOut === 0;
  console.log(`  ${reachOk ? '✓' : '✗'} THE FULL ROAD  every walk ended at a boss or a death, never off the end of the map `
    + `(${ranOut} ran out of ${RUNS * rows.length})`);
  const shapeOk = rows.every(r => r.shapeBad === 0);
  console.log(`  ${shapeOk ? '✓' : '✗'} FIVE SLOTS     every road ends on 5/5/5 with no won card doubled `
    + `(${rows.reduce((n, r) => n + r.shapeBad, 0)} broken of ${RUNS * 3})`);
  const allOk = rows.every(r => r.held) && fodderOk && monotone && shapeOk && wokeOk && markOk
    && reachOk;
  console.log(`\n=== ${rows.filter(r => r.held).length}/${rows.length} run gates held · ${RUNS} roads each ===`);
  await H.browser.close();
  process.exit(allOk ? 0 : 1);
})().catch(e => { console.error('RUN SIM CRASH:', e); process.exit(2); });
