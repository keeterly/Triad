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

const BANDS = [
  { name: 'NO PARRY',      p: 0.00, glo: 0,  ghi: 6 },
  { name: '~HALF PARRIES', p: 0.50, glo: 8,  ghi: 45 },
  { name: 'EXCELLENT',     p: 0.92, glo: 65, ghi: 100 },
];
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
    const road = await J((s) => {
      window.R.newRun(s);
      return window.R.map().map(n => ({ id: n.id, col: n.col, kind: n.kind, foe: n.foe, to: n.to }));
    }, seed);
    let at = null, hp = { ...MAXHP }, embers = 0, fights = 0, tier = 1, kizuna = 0;
    let roster = JSON.parse(JSON.stringify(BASE_ROSTER));
    const bonds = { 'ash|elin': 0, 'ash|mira': 0, 'elin|mira': 0 };
    const levels = { 'ash|elin': 0, 'ash|mira': 0, 'elin|mira': 0 };
    let traded = 0;
    let nodes = [];     // what this run has kindled
    const trace = [];   // what the party had left walking away from each stop
    for (let col = 0; col < 6; col++) {
      const open = at ? road.find(n => n.id === at).to : road.filter(n => n.col === 0).map(n => n.id);
      const opts = open.map(id => road.find(n => n.id === id));
      const hurt = total(hp) / total(MAXHP);
      const want = opts.find(n => n.kind === 'camp' && hurt < 0.72)
        || opts.find(n => n.kind === 'story' && hurt >= 0.72)
        || opts.find(n => n.kind !== 'camp') || opts[0];
      at = want.id;
      if (want.kind === 'camp') {
        for (const k of Object.keys(MAXHP)) hp[k] = Math.min(MAXHP[k], Math.round(hp[k] + MAXHP[k] * CAMP_FRAC));
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
          upgrades: nodes.map(id => (TREE.find(n => n.id === id) || {}).card).filter(Boolean),
          allout: (TREE.find(n => nodes.indexOf(n.id) >= 0 && n.allout) || {}).allout || null }]);
      hp = r.hp;
      kizuna = Math.round((r.kizuna || 0) * KZ_CARRY);
      for (const k of BOND.pairs) bonds[k] += ((r.pairBond || {})[k] || 0);
      trace.push({ col, kind: want.kind, foe: want.foe, left: total(hp), turns: r.turns,
                   allouts: r.allouts || 0 });
      if (!r.win) return { win: false, diedAt: col, kind: want.kind, foe: want.foe, hp, embers, fights, trace, nodes, traded, roster };
      embers += ({ husk: 2, cultist: 2, wraith: 3, revenant: 5, mourner: 8 })[want.foe] || 2;
      if (want.kind === 'boss') return { win: true, diedAt: null, hp, embers, fights, trace, nodes, traded, roster };
    }
    return { win: false, diedAt: 5, kind: 'ran-out', hp, embers, fights, trace, nodes, traded, roster };
  }

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
    const shapeBad = res.filter(r => !r.roster
      || ['ash', 'elin', 'mira'].some(h => (r.roster[h] || []).length !== 5)
      || new Set(['ash', 'elin', 'mira'].reduce((a, h) => a.concat(r.roster[h]), [])).size !== 15).length;
    rows.push({ name: band.name, rate, col0, held, shapeBad,
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
      for (let col = 0; col < 6; col++) {
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
  const trailhead = rows.find(r => r.name === '~HALF PARRIES');
  const fodderOk = trailhead.col0 <= 8;
  console.log(`  ${fodderOk ? '✓' : '✗'} TRAILHEAD      a competent party does not wipe on the first stop `
    + `(${trailhead.col0.toFixed(1)}% at ~half parries · gate ≤8%)`);
  const monotone = rows[0].rate <= rows[1].rate && rows[1].rate <= rows[2].rate;
  console.log(`  ${monotone ? '✓' : '✗'} MONOTONE       every step up in parry skill is a longer road survived`);
  const shapeOk = rows.every(r => r.shapeBad === 0);
  console.log(`  ${shapeOk ? '✓' : '✗'} FIVE SLOTS     every road ends on 5/5/5 and fifteen unique cards `
    + `(${rows.reduce((n, r) => n + r.shapeBad, 0)} broken of ${RUNS * 3})`);
  const allOk = rows.every(r => r.held) && fodderOk && monotone && shapeOk;
  console.log(`\n=== ${rows.filter(r => r.held).length}/${rows.length} run gates held · ${RUNS} roads each ===`);
  await H.browser.close();
  process.exit(allOk ? 0 : 1);
})().catch(e => { console.error('RUN SIM CRASH:', e); process.exit(2); });
