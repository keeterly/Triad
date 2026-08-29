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
const SKILLS = [['clumsy', 0.45], ['ordinary', 0.7], ['sharp', 0.92]];

(async () => {
  const H = await boot({ query: 'road=1' });
  const { J, sleep, page } = H;

  const rows = [];

  for (const [name, pSkill] of SKILLS) {
    const tally = { runs: 0, won: 0, wiped: 0, kindled: [], bonds: 0, marks: 0,
                    tiers: [], embersLeft: [], brokeAtFire: 0, fires: 0, stops: {} };

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

      for (let col = 0; col < 6; col++) {
        const open = await J(() => window.R.reachable());
        if (!open.length) break;
        const target = open[Math.floor(Math.random() * open.length)];
        const kind = await J((id) => (window.R.map().find(n => n.id === id) || {}).kind, target);
        tally.stops[kind] = (tally.stops[kind] || 0) + 1;
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
          tally.fires++;
          const spent = await J(() => {
            const st = window.R.state();
            const could = window.R.TREE.filter(t => st.nodes.indexOf(t.id) < 0 && t.tier <= st.tier);
            const afford = could.filter(t => t.cost <= window.R.state().embers);
            let n = 0, g = 0;
            while (g++ < 10) {
              const s2 = window.R.state();
              const next = window.R.TREE.find(t => s2.nodes.indexOf(t.id) < 0 && t.tier <= s2.tier && t.cost <= s2.embers);
              if (!next) break;
              window.R.kindle(next.id); n++;
            }
            window.R.leaveCamp();
            return { n, could: could.length, afford: afford.length };
          });
          // THE FIRE MUST BE A CHOICE. StS2's live complaint is that its
          // campfires collapsed into "always rest"; this game mends for free,
          // so the equivalent failure is a fire you cannot afford ANYTHING at.
          if (spent.afford === 0) tally.brokeAtFire++;
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
          await sleep(700);
          if (!r || !r.win) { dead = true; break; }
        }
        const over = await J(() => window.R.state().over);
        if (over) break;
      }

      const end = await J(() => JSON.parse(JSON.stringify(window.R.state())));
      if (end.over === 'win') tally.won++;
      if (dead || end.over === 'loss') tally.wiped++;
      tally.kindled.push((end.nodes || []).length);
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
  console.log('\n  stops walked: ' + JSON.stringify(rows[1].stops));
  console.log('\n  A run that changes fewer than ~4 things about the party between the');
  console.log('  trailhead and the Regent is a run that is survivable and static.');

  await H.browser.close();
  process.exit(0);
})();
