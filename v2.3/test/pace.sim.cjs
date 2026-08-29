// KIZUNA v2.3 — the PACE sim. Does a run DEVELOP?
//
// The balance sim asks whether a run is winnable. This one asks the question a
// player actually feels: between the trailhead and the Regent, how many times
// does something about my party CHANGE? A roguelite that is survivable and
// static is a roguelite nobody finishes twice.
//
// It counts the four things that can change a run — a card upgraded at a fire,
// a card swapped in at a bond, a mark placed, a tier opened — and it counts
// them at three levels of player skill, because "the run develops" must be true
// for someone who is bad at parrying as well as for someone who is good.
//
// No browser assertions here: this prints a table and exits 0. It is a
// measurement, not a gate — the moment it becomes a gate it stops being able to
// tell us something we did not already believe.
'use strict';
const { boot } = require('./harness.cjs');
const { BOT } = require('./bot.cjs');

const RUNS = +(process.env.PACE_RUNS || 24);
const MAX_TURNS = 30;
const ALL_SKILLS = [['clumsy', 0.45], ['ordinary', 0.7], ['sharp', 0.92]];
const SKILLS = process.env.PACE_SKILL
  ? ALL_SKILLS.filter(s => s[0] === process.env.PACE_SKILL) : ALL_SKILLS;

(async () => {
  const H = await boot({ query: 'road=1' });
  const { J, sleep, page } = H;

  // PACE_GOOD / PACE_GREAT override the parry's payout ladder, so a proposed
  // flattening can be MEASURED against the same seeds rather than argued.
  const tune = {};
  if (process.env.PACE_GOOD) tune.good = +process.env.PACE_GOOD;
  if (process.env.PACE_GREAT) tune.great = +process.env.PACE_GREAT;
  if (Object.keys(tune).length) {
    await J((t) => window.K._setParryWeights(t), tune);
    console.log('  parry ladder overridden: ' + JSON.stringify(await J(() => window.K._parryWeights())));
  }

  const rows = [];

  for (const [name, pSkill] of SKILLS) {
    const tally = { runs: 0, won: 0, wiped: 0, kindled: [], bonds: 0, marks: 0,
                    tiers: [], embersLeft: [], brokeAtFire: 0, fires: 0, stops: {},
                    // WHY the tree goes unspent, not just THAT it does. A purse
                    // full at the end can mean three different things — no fire
                    // to spend it at, no node open at your tier, or a price you
                    // cannot meet — and they have three different fixes.
                    firesPerRun: [], atFire: [], earnedAfterLastFire: [],
                    // the mechanism, not just the outcome: an all-out is the
                    // one bond source skill makes more frequent, so if the
                    // curve inverts this is the column that says why
                    allOuts: 0, turns: 0, recks: 0, reckBond: 0,
                    // WHERE a run ends, not just that it did. A cliff you
                    // cannot see the foot of is a cliff you tune by guessing.
                    diedAt: {}, diedTo: {}, hpIn: [] };

    for (let i = 0; i < RUNS; i++) {
      const seed = 7000 + i * 313;
      await J((s) => { window.R.newRun(s); return true; }, seed);
      await sleep(80);
      // take whatever the awakening offers first — the pacing question is about
      // the ROAD, and a bot that always shopped for the best memory would be
      // measuring the memory instead
      await J(() => {
        const o = window.R.wakeOffer();
        window.R.takeWake(o[Math.floor(Math.random() * o.length)].id);
      });
      await sleep(120);
      // that memory may itself have handed over a card
      await J(() => {
        const cards = [...document.querySelectorAll('#k-swap-cols .k-swapcard')];
        if (cards.length) { cards[0].click(); const go = document.getElementById('k-swap-go'); if (go && !go.disabled) go.click(); }
      });
      await sleep(120);

      tally.runs++;
      let dead = false;
      let lastFireEmbers = null, fireCount = 0;

      for (let col = 0; col < 6; col++) {
        const open = await J(() => window.R.reachable());
        if (!open.length) break;
        const target = open[Math.floor(Math.random() * open.length)];
        const kind = await J((id) => (window.R.map().find(n => n.id === id) || {}).kind, target);
        tally.stops[kind] = (tally.stops[kind] || 0) + 1;
        if (kind === 'fight' || kind === 'elite' || kind === 'boss') {
          const hp = await J(() => { const h = window.R.state().hp;
            return h ? Object.keys(h).reduce((n2, k) => n2 + h[k], 0) : 112; });
          tally.hpIn.push(hp);
        }
        await J((id) => window.R.travel(id), target);
        await sleep(340);

        // a bond scene may stand in front of a fire
        let guard = 0;
        while (guard++ < 4 && await J(() => !document.getElementById('k-scene').classList.contains('k-hidden')
                                          && !!(window.R.scene() || {}).pair)) {
          tally.bonds++;
          await J(() => { window.R.sceneSkip(); const f = document.querySelectorAll('#k-scene-fork .k-fork'); if (f.length) f[0].click(); });
          await sleep(200);
          await J(() => {
            const cards = [...document.querySelectorAll('#k-swap-cols .k-swapcard')];
            if (cards.length) { cards[0].click(); const go = document.getElementById('k-swap-go'); if (go && !go.disabled) go.click(); }
          });
          await sleep(200);
          const marked = await J(() => {
            const mk = [...document.querySelectorAll('#k-mark-cols .k-mk:not([disabled])')];
            if (!mk.length) return false;
            mk[0].click(); return true;
          });
          if (marked) tally.marks++;
          await sleep(200);
        }

        if (kind === 'camp') {
          tally.fires++; fireCount++;
          const spent = await J(() => {
            const st = window.R.state();
            const purse = st.embers, tier = st.tier;
            const unheld = window.R.TREE.filter(t => st.nodes.indexOf(t.id) < 0);
            const open = unheld.filter(t => t.tier <= tier);           // your tier allows it
            const afford = open.filter(t => t.cost <= purse);          // …and you can pay
            let n = 0, g = 0;
            while (g++ < 10) {
              const s2 = window.R.state();
              const next = window.R.TREE.find(t => s2.nodes.indexOf(t.id) < 0 && t.tier <= s2.tier && t.cost <= s2.embers);
              if (!next) break;
              window.R.kindle(next.id); n++;
            }
            const left = window.R.state().embers;
            window.R.leaveCamp();
            return { n, purse, tier, col: st.stop - 1, left,
                     sealed: unheld.length - open.length, open: open.length, afford: afford.length };
          });
          tally.atFire.push(spent);
          // THE FIRE MUST BE A CHOICE. StS2's live complaint is that its
          // campfires collapsed into "always rest"; this game mends for free,
          // so the equivalent failure is a fire you cannot afford ANYTHING at.
          if (spent.afford === 0) tally.brokeAtFire++;
          lastFireEmbers = spent.left;
          await sleep(220);
        } else if (kind === 'story') {
          await J(() => { let n = 0; while (n++ < 30 && window.R.scene()) window.R.sceneNext(); });
          await sleep(220);
        } else if (kind === 'event') {
          await J(() => {
            let n = 0;
            while (n++ < 20 && window.R.scene() && !document.querySelector('.k-fork-opt')) window.R.sceneNext();
            const o = [...document.querySelectorAll('.k-fork-opt')];
            if (o.length) o[Math.floor(Math.random() * o.length)].click();
          });
          await sleep(260);
        } else {
          const r = await page.evaluate(([src, sd, p, mt]) => {
            const K = window.K, orig = K.startCombat;
            K.startCombat = () => K.state();
            try { return eval(src)(sd, p, mt, {}); } finally { K.startCombat = orig; }
          }, [BOT, seed + col * 41, pSkill, MAX_TURNS]);
          if (r) { tally.allOuts += (r.allouts || 0); tally.turns += (r.turns || 0); }
          if (r && !r.win) {
            tally.diedAt[col] = (tally.diedAt[col] || 0) + 1;
            const foe = await J((id) => (window.R.map().find(n => n.id === id) || {}).foe, target);
            tally.diedTo[foe || '?'] = (tally.diedTo[foe || '?'] || 0) + 1;
          }
          await sleep(1100);
          if (!r || !r.win) { dead = true; break; }
          // THE RECKONING stands between the fight and the road now. Answer it
          // the way a player would — half of them take the bond, half the
          // momentum — so the pacing table measures the beat as it is played.
          const reck = await J(() => {
            const sc = window.R.scene();
            if (!sc || sc.kind !== 'reck') return null;
            let n = 0;
            while (n++ < 20 && window.R.scene() && !document.querySelector('.k-fork-reck')) window.R.sceneNext();
            const o = [...document.querySelectorAll('.k-fork-reck')];
            const ix = Math.random() < 0.5 ? 0 : 1;
            const id = sc.id;
            if (o.length) o[Math.min(ix, o.length - 1)].click();
            return { id, took: ix };
          });
          if (reck) { tally.recks++; if (reck.took === 0) tally.reckBond++; }
          await sleep(320);
        }
        const over = await J(() => window.R.state().over);
        if (over) break;
      }

      const end = await J(() => JSON.parse(JSON.stringify(window.R.state())));
      if (end.over === 'win') tally.won++;
      if (dead || end.over === 'loss') tally.wiped++;
      tally.kindled.push((end.nodes || []).length);
      tally.firesPerRun.push(fireCount);
      if (lastFireEmbers != null) tally.earnedAfterLastFire.push(end.embers - lastFireEmbers);
      tally.tiers.push(end.tier);
      tally.embersLeft.push(end.embers);
    }

    const med = (a) => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
    const avg = (a) => a.length ? +(a.reduce((s, x) => s + x, 0) / a.length).toFixed(2) : 0;
    rows.push({ name, pSkill, ...tally, medKindled: med(tally.kindled), avgKindled: avg(tally.kindled),
                medTier: med(tally.tiers), avgEmbers: avg(tally.embersLeft) });
  }

  console.log('\n══ DOES A RUN DEVELOP? ' + RUNS + ' runs per skill ══\n');
  console.log('  skill      won   wiped   nodes kindled   cards swapped in   marks   tier   embers left   broke at a fire');
  rows.forEach(r => {
    console.log('  ' + r.name.padEnd(10)
      + String(r.won).padStart(3) + '/' + r.runs
      + String(r.wiped).padStart(7)
      + String(r.avgKindled).padStart(16)
      + String(+(r.bonds / r.runs).toFixed(2)).padStart(19)
      + String(+(r.marks / r.runs).toFixed(2)).padStart(8)
      + String(r.medTier).padStart(7)
      + String(r.avgEmbers).padStart(14)
      + String(r.brokeAtFire + '/' + r.fires).padStart(18));
  });
  // …of whichever skills were actually run: PACE_SKILL can narrow this to one,
  // and indexing rows[1] blind crashed the summary after a 15-minute sweep.
  const mid = rows[Math.min(1, rows.length - 1)];
  console.log('\n  stops walked (' + mid.name + '): ' + JSON.stringify(mid.stops));
  console.log('\n── why the tree goes unspent ──');
  rows.forEach(r => {
    const f = r.atFire;
    const avg = (a) => a.length ? +(a.reduce((s2, x) => s2 + x, 0) / a.length).toFixed(2) : 0;
    console.log('  ' + r.name.padEnd(10)
      + ' fires/run ' + avg(r.firesPerRun)
      + ' · at a fire: purse ' + avg(f.map(x => x.purse))
      + ', tier ' + avg(f.map(x => x.tier))
      + ', sealed ' + avg(f.map(x => x.sealed))
      + ', open ' + avg(f.map(x => x.open))
      + ', affordable ' + avg(f.map(x => x.afford))
      + ', bought ' + avg(f.map(x => x.n))
      + ' · all-outs/run ' + (+(r.allOuts / r.runs).toFixed(2))
      + ' · turns/run ' + (+(r.turns / r.runs).toFixed(1))
      + ' · reckonings/run ' + (+(r.recks / r.runs).toFixed(2)));
  });
  console.log('\n── where the run ends ──');
  rows.forEach(r => {
    const avg = (a) => a.length ? +(a.reduce((s2, x) => s2 + x, 0) / a.length).toFixed(1) : 0;
    console.log('  ' + r.name.padEnd(10) + ' died at column ' + JSON.stringify(r.diedAt)
      + ' · to ' + JSON.stringify(r.diedTo)
      + ' · party HP walking INTO a fight (of 112): ' + avg(r.hpIn));
  });
  console.log('\n  fires are at columns: ' + JSON.stringify(rows[rows.length - 1].atFire.map(x => x.col)));
  console.log('\n  A run that changes fewer than ~4 things about the party between the');
  console.log('  trailhead and the Regent is a run that is survivable and static.');

  await H.browser.close();
  process.exit(0);
})();
