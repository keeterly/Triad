// KIZUNA v2.3 — THE VERTICAL SLICE GATE.
//
// Every other suite tests a part. road.test.cjs drives one stop at a time,
// camp.test.cjs stands at a fire it teleported to, flow.test.cjs never leaves
// the board. All three can be green while the thing they are parts OF is
// broken, because none of them ever walks the whole way.
//
// This one plays an entire run: trailhead, six stops, the Regent, the end
// card — through the real screens, with the real engine, using the same bot
// the balance sims use. It asserts invariants at EVERY step rather than at the
// end, so a break reports where it happened instead of only that it happened.
'use strict';
const { boot } = require('./harness.cjs');
const { BOT } = require('./bot.cjs');

const MAXHP = { ash: 42, elin: 36, mira: 34 };
const MAX_TURNS = 30;

(async () => {
  const H = await boot({ query: 'road=1' });
  const { J, check, report, sleep } = H;

  const R = () => J(() => JSON.parse(JSON.stringify(window.R.state())));
  // EXACTLY ONE SCREEN, ALWAYS. The router is four `classList.toggle` calls;
  // the failure it invites is two screens up at once or none at all, and both
  // look like "the game froze" to a player.
  const visible = () => J(() => ['k-stage', 'k-map', 'k-camp', 'k-scene']
    .filter(id => !document.getElementById(id).classList.contains('k-hidden')));

  const breaches = [];
  async function invariants(where) {
    const bad = await J((w) => {
      const r = window.R.state(), out = [];
      if (r.embers < 0) out.push('negative embers: ' + r.embers);
      if (r.tier < 1 || r.tier > 5) out.push('tier out of range: ' + r.tier);
      const H2 = { ash: 42, elin: 36, mira: 34 };
      if (r.hp) for (const id of Object.keys(H2)) {
        if (r.hp[id] > H2[id]) out.push(id + ' over max: ' + r.hp[id]);
        if (r.hp[id] < 0) out.push(id + ' below zero: ' + r.hp[id]);
      }
      if (new Set(r.nodes).size !== r.nodes.length) out.push('a node kindled twice');
      if (new Set(r.path).size !== r.path.length) out.push('a stop visited twice');
      // The deck may get better; it may never get bigger.
      if (window.K.state()) {
        const c = window.K.state();
        const all = [...c.hand, ...c.deck, ...c.discard, ...c.exhausted].filter(id => id !== 'lightsteel');
        if (all.length !== 15) out.push('deck is ' + all.length + ' cards, not 15');
      }
      return out.map(s => w + ': ' + s);
    }, where);
    breaches.push(...bad);
  }

  const seen = { fight: 0, elite: 0, camp: 0, story: 0, boss: 0 };
  const log = [];

  await J((s) => window.R.newRun(s), 5150);
  const route = await J(() => {
    const m = window.R.map(), start = m.filter(n => n.col === 0);
    const paths = [];
    const rec = (n, acc) => {
      const path = acc.concat([n]);
      if (!n.to.length) { paths.push(path); return; }
      n.to.forEach(t => rec(m.find(q => q.id === t), path));
    };
    start.forEach(n => rec(n, []));
    let best = null, bestScore = -1;
    for (const p of paths) {
      const kinds = new Set(p.map(n => n.kind));
      if (kinds.size > bestScore) { bestScore = kinds.size; best = p; }
    }
    return best.map(n => n.id);
  });
  await invariants('trailhead');
  {
    const v = await visible();
    check('SLICE: the game opens on the road, and on nothing else',
      v.length === 1 && v[0] === 'k-map', v.join(','));
  }

  for (let col = 0; col < 6; col++) {
    // WALK A ROUTE CHOSEN UP FRONT, not greedily.
    //
    // A slice test that only ever fights proves the slice only ever fights, so
    // the walk has to cover every KIND of stop. Picking greedily at each fork
    // cannot guarantee that: the column's one crossing may not lead to the
    // kind you still need, and the first run of this gate duly reached the
    // Regent having never once seen a memory. The route is instead searched
    // for whole — there are at most 32 root-to-boss paths — and scored by how
    // many distinct kinds it visits.
    const pickId = route[col];
    const kind = await J((id) => window.R.map().find(n => n.id === id).kind, pickId);
    seen[kind] = (seen[kind] || 0) + 1;

    await J((id) => window.R.travel(id), pickId);
    await sleep(400);

    const v = await visible();
    const want = kind === 'camp' ? 'k-camp' : kind === 'story' ? 'k-scene' : 'k-stage';
    check(`SLICE: stop ${col} is a ${kind.toUpperCase()} and it opens the ${want.replace('k-', '')}`,
      v.length === 1 && v[0] === want, v.join(',') + ' (wanted ' + want + ')');
    await invariants('stop ' + col + ' open');

    if (kind === 'camp') {
      const spent = await J(() => {
        let bought = 0, guard = 0;
        while (guard++ < 12) {
          const n = window.R.TREE.find(t => window.R.state().nodes.indexOf(t.id) < 0
            && t.tier <= window.R.state().tier && t.cost <= window.R.state().embers);
          if (!n) break;
          window.R.kindle(n.id); bought++;
        }
        window.R.leaveCamp();
        return bought;
      });
      log.push(`stop ${col}: campfire, kindled ${spent}`);
      await sleep(300);
    } else if (kind === 'story') {
      // Walk the scene beat by beat the way a player would, not by skipping.
      const beats = await J(() => {
        let n = 0;
        while (n < 40 && window.R.scene()) { window.R.sceneNext(); n++; }
        return n;
      });
      log.push(`stop ${col}: memory, ${beats} taps`);
      await sleep(300);
    } else {
      const before = await R();
      const r = await H.page.evaluate(([src, sd, p, mt]) => {
        // THE BOT NORMALLY STARTS ITS OWN FIGHT. Here the road already started
        // one — with this stop's foe, this run's upgrades and this party's
        // wounds — so startCombat is stubbed for the length of the call and the
        // bot plays the board it was handed instead of a fresh one.
        const K = window.K, orig = K.startCombat;
        K.startCombat = () => K.state();
        try { return eval(src)(sd, p, mt, {}); } finally { K.startCombat = orig; }
      }, [BOT, 900 + col * 17, 0.86, MAX_TURNS]);
      log.push(`stop ${col}: ${kind}, ${r.win ? 'won' : 'LOST'} in ${r.turns} rounds`);
      await sleep(900);
      check(`SLICE: the ${kind} at stop ${col} resolves and hands the run back`,
        !!r && (r.win || r.died), JSON.stringify({ win: r && r.win, turns: r && r.turns }));
      const after = await R();
      if (r && r.win) {
        check(`SLICE: winning stop ${col} pays embers and carries the wounds forward`,
          after.embers >= before.embers && after.hp && after.hp.ash <= MAXHP.ash,
          JSON.stringify({ embers: [before.embers, after.embers], hp: after.hp }));
      }
    }
    await invariants('stop ' + col + ' done');
    const st = await R();
    if (st.over) break;
  }

  // ═══ THE END OF THE ROAD ═══
  console.log('\n── the whole way down ──');
  log.forEach(l => console.log('    ' + l));
  {
    const st = await R();
    const v = await visible();
    check('SLICE: the run ends, and it ends on the road with a card that says how',
      !!st.over && v.length === 1 && v[0] === 'k-map', JSON.stringify({ over: st.over, on: v }));
    const card = await J(() => document.getElementById('k-map-card').textContent);
    check('SLICE: the end card names the outcome and offers another run',
      /REGENT FALLS|PARTY FALLS/.test(card) && /NEW RUN/.test(card),
      card.replace(/\s+/g, ' ').slice(0, 76));
    check('SLICE: the walk covered every kind of stop the road can serve',
      seen.fight >= 1 && seen.camp >= 1 && seen.story >= 1 && seen.boss >= 1,
      JSON.stringify(seen));
    check('SLICE: no invariant was breached at any point along the way',
      breaches.length === 0, breaches.slice(0, 4).join(' · ') || 'clean');
    // A finished run must be inert: nothing on the map may still be taken.
    const inert = await J(() => {
      const before = JSON.stringify(window.R.state());
      window.R.tapNode((window.R.map()[0] || {}).id);
      window.R.travel((window.R.map()[3] || {}).id);
      return { same: JSON.stringify(window.R.state()) === before,
               open: window.R.reachable().length, active: window.R.active() };
    });
    check('SLICE: an ended run is inert — no stop can still be taken',
      inert.same && inert.open === 0 && inert.active === false, JSON.stringify(inert));
    // And a new run is genuinely new.
    const fresh = await J(() => {
      window.R.newRun(99);
      const r = window.R.state();
      return { at: r.at, embers: r.embers, nodes: r.nodes.length, tier: r.tier,
               over: r.over, path: r.path.length, seen: (r.seen || []).length };
    });
    check('SLICE: NEW RUN starts from nothing — no embers, no tree, no memories, no path',
      fresh.at === null && fresh.embers === 0 && fresh.nodes === 0 && fresh.tier === 1
      && !fresh.over && fresh.path === 0 && fresh.seen === 0, JSON.stringify(fresh));
  }

  const r = report();
  await H.browser.close();
  process.exit(r.passed === r.total && r.errs === 0 ? 0 : 1);
})();
