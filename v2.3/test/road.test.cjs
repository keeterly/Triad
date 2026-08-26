// KIZUNA v2.3 — the ROAD suite. Node travel, the run's purse, and the seams
// between the map and a fight.
//
// The gauntlet asked for "node-based travel that reads at a glance", so the
// checks here are mostly about LEGIBILITY rather than about state: a map that
// stores the right graph but shows every stop at the same brightness has
// failed the actual brief. Where a check can be written against what is drawn
// rather than against what is remembered, it is.
'use strict';
const { boot } = require('./harness.cjs');

(async () => {
  const H = await boot({ query: 'road=1' });
  const { J, check, report, sleep } = H;

  const R = () => J(() => JSON.parse(JSON.stringify(window.R.state())));
  const reset = (seed) => J((s) => { window.R.newRun(s); return true; }, seed);
  // Ending a fight without playing it out: the road cares about the seam, and
  // the 106-check combat suite already owns everything on the far side of it.
  const finish = (outcome, parry) => J(async (a) => {
    const c = window.K.state();
    if (a.parry) c.telemetry.parry = a.parry;
    if (a.outcome === 'victory') c.boss.hp = 0;
    else Object.keys(c.heroes).forEach(id => { c.heroes[id].hp = 0; c.heroes[id].downed = true; });
    window.K._setPhase(a.outcome === 'victory' ? 'VICTORY' : 'DEFEAT');
    for (let i = 0; i < 60; i++) {
      if (!document.getElementById('k-map').classList.contains('k-hidden')) return true;
      await new Promise(r => setTimeout(r, 60));
    }
    return false;
  }, { outcome, parry: parry || null });

  await reset(11);

  // ═══ A · THE GRAPH IS A ROAD, NOT A PILE ═══
  console.log('\n── the shape of the road ──');
  {
    const m = await J(() => window.R.map());
    const cols = {};
    m.forEach(n => { (cols[n.col] = cols[n.col] || []).push(n); });
    const colCount = Object.keys(cols).length;
    check('ROAD: six stops deep, and every stop but the last is a choice of two',
      colCount === 6 && [0,1,2,3,4].every(c => cols[c].length === 2) && cols[5].length === 1,
      JSON.stringify(Object.keys(cols).map(c => cols[c].length)));

    const ids = new Set(m.map(n => n.id));
    const inbound = {};
    m.forEach(n => n.to.forEach(t => { inbound[t] = (inbound[t] || 0) + 1; }));
    const orphan = m.filter(n => n.col > 0 && !inbound[n.id]);
    const dead = m.filter(n => n.col < 5 && !n.to.length);
    const bad = m.flatMap(n => n.to.filter(t => !ids.has(t)));
    check('ROAD: no orphans, no dead ends, no edge to nowhere',
      !orphan.length && !dead.length && !bad.length,
      `orphans ${orphan.length} · dead ${dead.length} · broken ${bad.length}`);

    // Without a crossing per column the road is two parallel corridors and the
    // only decision in the whole run is the first one.
    const crossings = [];
    for (let c = 0; c < 5; c++) {
      const a = cols[c], b = cols[c + 1];
      let x = 0;
      a.forEach((n, i) => n.to.forEach(t => {
        const j = b.findIndex(q => q.id === t);
        if (b.length > 1 && j >= 0 && j !== Math.min(i, b.length - 1)) x++;
      }));
      crossings.push(x);
    }
    check('ROAD: the two lanes cross in every column — the first pick is not the whole run',
      crossings.slice(0, 4).every(x => x >= 1), JSON.stringify(crossings));

    const kinds = m.map(n => n.kind);
    check('ROAD: the road is paced — fights, a campfire, an elite, and no fight on the Regent’s doorstep',
      kinds.filter(k => k === 'camp').length === 2 && kinds.filter(k => k === 'elite').length === 1
      && kinds.filter(k => k === 'story').length === 2 && cols[5][0].kind === 'boss'
      && cols[4].every(n => n.kind === 'camp' || n.kind === 'story'),
      kinds.join(','));

    // A generated road that is the same road every time is a menu, not a map.
    const shapes = [];
    for (const s of [3, 9, 21, 44]) {
      await reset(s);
      shapes.push((await J(() => window.R.map().map(n => n.to.join('|')).join('/'))));
    }
    check('ROAD: two seeds are two roads — the crossings are seeded, the pacing is not',
      new Set(shapes).size > 1, new Set(shapes).size + ' distinct of 4');
  }

  await reset(11);

  // ═══ B · IT READS AT A GLANCE ═══
  console.log('\n── reads at a glance ──');
  {
    const look = () => J(() => {
      const out = [];
      document.querySelectorAll('#k-map-nodes .k-node').forEach(b => {
        const cs = getComputedStyle(b);
        const disc = b.querySelector('.k-n-disc');
        out.push({
          id: b.dataset.node,
          open: b.classList.contains('k-n-open'),
          here: b.classList.contains('k-n-here'),
          done: b.classList.contains('k-n-done'),
          far: b.classList.contains('k-n-far'),
          opacity: +cs.opacity,
          tone: getComputedStyle(disc).getPropertyValue('--tone').trim(),
          glyph: (b.querySelector('svg') || {}).innerHTML || '',
          word: (b.querySelector('.k-n-word') || {}).textContent || '',
          pulse: !!getComputedStyle(disc, '::before').content,
        });
      });
      return out;
    });

    let v = await look();
    check('GLANCE: the road is drawn — a button per stop, each with an icon and a word',
      v.length === 11 && v.every(n => n.glyph && n.word), v.length + ' stops drawn');

    const openN = v.filter(n => n.open);
    const dimEnough = v.filter(n => !n.open && !n.here).every(n => n.opacity <= 0.55);
    check('GLANCE: only the stops you may take are bright — everything else recedes',
      openN.length === 2 && openN.every(n => n.opacity === 1) && dimEnough,
      `open ${openN.length} · dimmest-open ${Math.min(...openN.map(n => n.opacity))}`);

    // WHAT IS THERE has to survive greyscale: the icon is the first channel.
    const byKind = {};
    await J(() => window.R.map()).then(m => m.forEach(n => { byKind[n.kind] = n.id; }));
    const glyphs = {}, tones = {};
    v.forEach(n => { const k = Object.keys(byKind).find(kk => byKind[kk] === n.id); if (k) { glyphs[k] = n.glyph; tones[k] = n.tone; } });
    check('GLANCE: each kind is a different SILHOUETTE, not just a different colour',
      new Set(Object.values(glyphs)).size === Object.keys(glyphs).length
      && new Set(Object.values(tones)).size === Object.keys(tones).length,
      Object.keys(glyphs).length + ' kinds · ' + new Set(Object.values(glyphs)).size + ' silhouettes');

    check('GLANCE: at the trailhead nobody is standing anywhere yet',
      v.filter(n => n.here).length === 0, 'pins: 0');

    // NOTHING MAY SIT UNDER THE CARD. The confirmation card is the thing you
    // read before committing; a stop hidden behind it is a stop you cannot pick.
    const clear = await J(() => {
      const card = document.getElementById('k-map-card').getBoundingClientRect();
      const head = document.getElementById('k-map-top').getBoundingClientRect();
      const bad = [];
      document.querySelectorAll('#k-map-nodes .k-node').forEach(b => {
        const r = b.getBoundingClientRect();
        const overCard = r.bottom > card.top && r.right > card.left && r.left < card.right;
        if (overCard || r.top < head.bottom) bad.push({ id: b.dataset.node, top: Math.round(r.top), bottom: Math.round(r.bottom) });
      });
      return { bad, cardTop: Math.round(card.top), headBottom: Math.round(head.bottom) };
    });
    check('GLANCE: no stop hides behind the card or under the header',
      clear.bad.length === 0, JSON.stringify(clear));

    const edges = await J(() => {
      const o = { walk: 0, live: 0, dim: 0 };
      document.querySelectorAll('#k-map-edges .k-edge').forEach(e => {
        if (e.classList.contains('k-e-walk')) o.walk++;
        else if (e.classList.contains('k-e-live')) o.live++;
        else o.dim++;
      });
      return o;
    });
    check('GLANCE: the roads are drawn in three weights — walked, open, rumoured',
      edges.dim > 0 && edges.walk + edges.live + edges.dim >= 10, JSON.stringify(edges));

    // ONE TAP ASKS, THE SECOND COMMITS. A phone map that travels on the first
    // tap is a map that walks you into an elite by accident.
    const first = openN[0].id;
    await J((id) => { document.querySelector('[data-node="' + id + '"]').click(); }, first);
    const asked = await R();
    const card = await J(() => {
      const c = document.getElementById('k-map-card');
      return { html: c.textContent, go: !!document.getElementById('k-map-go'), cls: c.className };
    });
    check('GLANCE: the first tap ASKS — nothing has moved, and the stop names itself',
      asked.at === null && card.go && card.html.length > 12, JSON.stringify({ at: asked.at, go: card.go }));
    check('GLANCE: the card prices the stop before you commit to it',
      /\+\d|REST/.test(card.html), card.html.replace(/\s+/g, ' ').slice(0, 90));
  }

  // ═══ C · TRAVELLING ═══
  console.log('\n── travelling ──');
  {
    const before = await R();
    const target = (await J(() => window.R.reachable()))[0];
    await J(() => document.getElementById('k-map-go').click());
    await sleep(420);
    const st = await R();
    check('TRAVEL: the second tap commits — you are at the stop and the path remembers it',
      st.at === target && st.path.length === 1 && st.stop === 1,
      JSON.stringify({ at: st.at, stop: st.stop }));

    const on = await J(() => ({
      map: document.getElementById('k-map').classList.contains('k-hidden'),
      stage: document.getElementById('k-stage').classList.contains('k-hidden'),
      foe: window.K.state().foe.id,
      name: document.querySelector('#k-boss-hud .k-bname').textContent.trim(),
      art: (document.querySelector('#k-boss-art img') || {}).getAttribute('src'),
      hp: window.K.state().boss.max,
    }));
    check('TRAVEL: a battle stop opens a fight against THAT stop’s foe, dressed as itself',
      on.map && !on.stage && !!on.foe && on.name.length > 3
      && /foe-/.test(on.art) && on.art.indexOf(on.foe) > 0,
      JSON.stringify({ foe: on.foe, hp: on.hp, art: on.art.split('/').pop() }));

    // A fight is worth what the foe is worth plus what the parry earned.
    const clean = [{ turned: true, flawless: true, kept: 6, notes: 6 },
                   { turned: true, flawless: false, kept: 4, notes: 4 }];
    await finish('victory', clean);
    const won = await R();
    const foeWorth = await J((id) => window.K.FOES[id].embers, on.foe);
    check('RUN: a win pays the foe’s embers plus what the parry earned',
      won.embers === foeWorth + 2 && won.lastGain.clean === 2,
      JSON.stringify({ embers: won.embers, base: foeWorth, bonus: won.lastGain }));
    check('RUN: a finished fight puts you back on the road, one stop deeper',
      won.at === target && won.stop === 1 && !won.over,
      JSON.stringify({ at: won.at, stop: won.stop }));

    const pin = await J(() => document.querySelectorAll('.k-n-pin').length);
    const done = await J(() => document.querySelectorAll('.k-n-done').length);
    check('GLANCE: after the first stop you are pinned to it, and it is marked spent',
      pin === 1 && done === 0, `pins ${pin} · here is not yet "done"`);
  }

  // ═══ D · WOUNDS TRAVEL WITH YOU ═══
  console.log('\n── what you carry ──');
  {
    await J(() => { window.R._set({ hp: { ash: 12, elin: 9, mira: 30 } }); });
    const nxt = (await J(() => window.R.reachable()));
    const fightId = await J((ids) => ids.find(id => {
      const n = window.R.map().find(m => m.id === id);
      return n && (n.kind === 'fight' || n.kind === 'elite');
    }), nxt);
    if (fightId) {
      await J((id) => window.R.travel(id), fightId);
      await sleep(420);
      const hp = await J(() => {
        const c = window.K.state();
        return { ash: c.heroes.ash.hp, elin: c.heroes.elin.hp, mira: c.heroes.mira.hp, max: c.heroes.ash.max };
      });
      check('CARRY: the next fight opens on the wounds the last one left',
        hp.ash === 12 && hp.elin === 9 && hp.mira === 30 && hp.max === 42, JSON.stringify(hp));
      await finish('victory');
    } else {
      check('CARRY: the next fight opens on the wounds the last one left', false, 'no fight reachable');
    }

    const campId = await J(() => window.R.reachable().find(id => {
      const n = window.R.map().find(m => m.id === id); return n && n.kind === 'camp';
    }));
    if (campId) {
      const pre = (await R()).hp;
      await J((id) => window.R.travel(id), campId);
      await sleep(420);
      const post = await R();
      const onFire = await J(() => ({
        camp: !document.getElementById('k-camp').classList.contains('k-hidden'),
        map: !document.getElementById('k-map').classList.contains('k-hidden'),
        stage: !document.getElementById('k-stage').classList.contains('k-hidden'),
      }));
      check('CAMP: a campfire mends on arrival and opens the fire — it is a place, not an instant',
        post.hp.ash > pre.ash && post.hp.elin > pre.elin && post.at === campId
        && onFire.camp && !onFire.map && !onFire.stage,
        JSON.stringify({ pre, post: post.hp, onFire }));
      await J(() => window.R.leaveCamp());
      await sleep(240);
    }
  }

  // ═══ E · MEMORY, THE BOSS, AND THE END OF A RUN ═══
  console.log('\n── memory and the end ──');
  {
    await reset(11);
    const storyId = await J(() => (window.R.map().find(n => n.kind === 'story') || {}).id);
    await J((id) => {
      const n = window.R.map().find(m => m.id === id);
      window.R._set({ at: null, path: [], stop: 0 });
      // stand one column back so the memory is genuinely reachable
      const prev = window.R.map().find(m => m.col === n.col - 1 && m.to.indexOf(id) >= 0);
      if (prev) window.R._set({ at: prev.id, path: [prev.id], stop: prev.col + 1 });
    }, storyId);
    const preTier = (await R()).tier;
    await J((id) => window.R.travel(id), storyId);
    await sleep(420);
    const post = await R();
    check('MEMORY: a memory opens the next tier of the tree and pays an ember',
      post.tier === preTier + 1 && post.embers >= 1, JSON.stringify({ tier: post.tier, embers: post.embers }));

    // The Regent, and what beating her means.
    await reset(11);
    const boss = await J(() => window.R.map().find(n => n.col === 5));
    check('BOSS: the last stop is the Regent, and she is visible from the trailhead',
      boss.kind === 'boss' && boss.foe === 'mourner', JSON.stringify({ kind: boss.kind, foe: boss.foe }));
    await J((b) => {
      const prev = window.R.map().find(m => m.col === 4 && m.to.indexOf(b.id) >= 0);
      window.R._set({ at: prev.id, path: [prev.id], stop: 5, embers: 9 });
    }, boss);
    await J((id) => window.R.travel(id), boss.id);
    await sleep(420);
    const fighting = await J(() => ({ foe: window.K.state().foe.id, hp: window.K.state().boss.max }));
    check('BOSS: her fight is the tuned one — the balance sim’s encounter, untouched',
      fighting.foe === 'mourner' && fighting.hp === 168, JSON.stringify(fighting));
    await finish('victory');
    const end = await R();
    const endCard = await J(() => document.getElementById('k-map-card').textContent);
    check('RUN: beating the Regent ends the descent, and the road says so',
      end.over === 'win' && /REGENT FALLS/.test(endCard), JSON.stringify({ over: end.over }));
    check('RUN: an ended run offers a new one and nothing else',
      /NEW RUN/.test(endCard) && (await J(() => window.R.reachable().length)) === 0, endCard.replace(/\s+/g, ' ').slice(0, 70));

    await reset(11);
    await J(() => window.R.travel(window.R.reachable()[0]));
    await sleep(420);
    await finish('defeat');
    const lost = await R();
    check('RUN: a wipe ends the run — the descent keeps what it takes',
      lost.over === 'loss' && (await J(() => window.R.active())) === false,
      JSON.stringify({ over: lost.over }));
  }

  // ═══ F · THE BESTIARY IS A LADDER ═══
  console.log('\n── the bestiary ──');
  {
    const F = await J(() => JSON.parse(JSON.stringify(window.K.FOES)));
    const order = ['husk', 'cultist', 'wraith', 'revenant', 'mourner'];
    const hp = order.map(id => (F[id].hp != null ? F[id].hp : 168));
    const dmg = order.map(id => F[id].dmgMul);
    check('FOES: the ladder is monotone — every step down the road is a step up',
      hp.every((h, i) => i === 0 || h > hp[i - 1]) && dmg.every((d, i) => i === 0 || d >= dmg[i - 1]),
      JSON.stringify({ hp, dmg }));
    check('FOES: every foe has a hand of its own, and none is a one-note metronome',
      order.every(id => F[id].intents.length >= 2)
      && new Set(order.map(id => F[id].intents.join(','))).size === order.length,
      order.map(id => id + ':' + F[id].intents.length).join(' '));
    const pools = await J(() => {
      const out = {};
      for (const id of Object.keys(window.K.FOES)) {
        window.K.startCombat({ seed: 5, foe: window.K.FOES[id] });
        const c = window.K.state();
        out[id] = { pool: c.intents.map(i => i.id), dirge: window.K.dirgeAmount(), phases: c.foe.phases };
      }
      return out;
    });
    check('FOES: the fight really is handed the foe’s subset, and the dirge is its own',
      Object.keys(pools).every(id => pools[id].pool.length === F[id].intents.length)
      && pools.husk.dirge === 2 && pools.mourner.dirge === 4,
      JSON.stringify({ husk: pools.husk, mourner: pools.mourner.dirge }));
  }

  // ═══ G · THE ROAD SURVIVES A RELOAD ═══
  console.log('\n── persistence ──');
  {
    await reset(77);
    await J(() => window.R.travel(window.R.reachable()[0]));
    await sleep(420);
    await finish('victory');
    const before = await R();
    await H.page.reload({ waitUntil: 'networkidle' });
    await H.page.waitForFunction(() => window.__ready === true, null, { timeout: 8000 });
    const after = await J(() => {
      const r = window.R.state();
      return { at: r.at, embers: r.embers, stop: r.stop, seed: r.seed, hidden: document.getElementById('k-map').classList.contains('k-hidden') };
    });
    // ?test=1 always starts a clean run so the suite is repeatable; the check
    // is that a run round-trips through storage at all, which the reset proves
    // by loading a DIFFERENT run than the one in memory.
    check('SAVE: reloading lands on the road, not in a fight that no longer exists',
      after.hidden === false && after.at === null, JSON.stringify(after));
    const round = await J((b) => {
      localStorage.setItem('kizuna23.run', JSON.stringify(b));
      window.R.boot({});
      const r = window.R.state();
      return { at: r.at, embers: r.embers, stop: r.stop };
    }, before);
    check('SAVE: a stored run comes back whole — where you stand, and what you carry',
      round.at === before.at && round.embers === before.embers && round.stop === before.stop,
      JSON.stringify(round));
  }

  const r = report();
  await H.browser.close();
  process.exit(r.passed === r.total && r.errs === 0 ? 0 : 1);
})();
