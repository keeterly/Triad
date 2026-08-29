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
  // A RUN NOW OPENS ON THE AWAKENING, not on the road. The road's own checks
  // are about what comes after that choice, so they answer it — deliberately,
  // by name, rather than by clicking whatever happens to be first, so a change
  // to the offer cannot silently change what the road suite is measuring.
  const reset = (seed) => J((s) => {
    window.R.newRun(s);
    const offer = window.R.wakeOffer();
    const plain = offer.find(w => w.kind === 'plain') || offer[0];
    window.R.takeWake(plain.id);
    return true;
  }, seed);
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
    // REWRITTEN at Build 58: a column used to be exactly two stops, always, in
    // the same two lanes — so every road in the game was the same eleven coins
    // in the same eleven places. A column now offers two OR three. What has not
    // moved is that every stop but the last is a CHOICE, which is the rule this
    // check was always really about.
    check('ROAD: six stops deep, and every stop but the last is a choice of two or three',
      colCount === 6 && [0,1,2,3,4].every(c => cols[c].length >= 2 && cols[c].length <= 3)
      && cols[5].length === 1,
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

    // ONE SEED IS NOT A PROOF OF A SEEDED PROPERTY.
    //
    // This check used to build seed 11's road and assert its crossings. Seed
    // 11 happens to cross in every column, so it passed — while 34% of real
    // seeds did not, because the forced-crossing fallback picked its source
    // and destination independently and half the time produced the
    // straight-ahead edge that was already there. A generator's invariant has
    // to be swept, and the sweep is what found the bug.
    const sweep = await J(() => {
      const bad = [], N = 400;
      for (let s = 1; s <= N; s++) {
        window.R.newRun(s);
        const m = window.R.map();
        const col = (c) => m.filter(n => n.col === c);
        for (let c = 0; c < 4; c++) {
          const a = col(c), b = col(c + 1);
          let x = 0;
          // "straight ahead" is a RATIO once a column can be three wide, not
          // min(i, len-1) — with three lanes feeding two, lanes 1 and 2 both
          // used to count as crossings under the old formula and a genuinely
          // bare column could pass.
          const near = (i) => a.length < 2 ? 0 : Math.round(i * (b.length - 1) / (a.length - 1));
          a.forEach((n, i) => n.to.forEach(t => {
            const j = b.findIndex(q => q.id === t);
            if (b.length > 1 && j >= 0 && j !== near(i)) x++;
          }));
          if (x === 0) bad.push(s + ':' + c);
        }
      }
      return { bad: bad.length, n: N, sample: bad.slice(0, 5) };
    });
    check('ROAD: the lanes cross in EVERY column of EVERY seed — swept, not sampled',
      sweep.bad === 0, sweep.bad + ' bare columns across ' + sweep.n + ' seeds'
      + (sweep.sample.length ? ' — ' + sweep.sample.join(',') : ''));
    await reset(11);

    // THE PACING IS AUTHORED, THE SHAPE IS NOT. A third lane may add a fight or
    // a memory; it may never add a second elite, move the elite off column 3,
    // or put a fight on the Regent's doorstep. Swept, because a guarantee that
    // holds for one seed of a generator is not a guarantee.
    const pace = await J(() => {
      const bad = [], N = 300;
      for (let s = 1; s <= N; s++) {
        window.R.newRun(s);
        const m = window.R.map();
        const col = (c) => m.filter(n => n.col === c);
        const kind = (c) => col(c).map(n => n.kind);
        const why = [];
        if (m.filter(n => n.kind === 'elite').length !== 1) why.push('elites');
        if (kind(3).indexOf('elite') < 0) why.push('elite off col3');
        if (!col(4).every(n => n.kind === 'camp' || n.kind === 'story')) why.push('fight at the door');
        if (kind(5).join() !== 'boss') why.push('no Regent');
        if (m.filter(n => n.kind === 'camp').length < 2) why.push('fires');
        if (m.filter(n => n.kind === 'story').length < 2) why.push('memories');
        // every route must be able to reach a memory BEFORE the last fire, or
        // the tier lock is unopenable on that road
        if (!m.some(n => n.kind === 'story' && n.col < 4)) why.push('no early memory');
        if (why.length) bad.push(s + ':' + why.join('+'));
      }
      return { bad: bad.length, n: N, sample: bad.slice(0, 4) };
    });
    check('ROAD: the road is paced — one elite at column 3, two fires, an early memory, no fight on the Regent’s doorstep',
      pace.bad === 0, pace.bad + ' broken of ' + pace.n + (pace.sample.length ? ' — ' + pace.sample.join(',') : ''));
    await reset(11);

    // A generated road that is the same road every time is a menu, not a map.
    // A generated road that is the same road every time is a menu, not a map.
    // The old check compared four seeds' EDGE lists, which the two-lane road
    // could vary while still drawing the identical eleven coins in the
    // identical eleven places. Three things have to move now: how many stops a
    // column holds, which lane each kind falls in, and where the coin sits.
    const vary = await J(() => {
      const widths = new Set(), lanes = new Set(), spots = new Set(), edges = new Set();
      let wide = 0, N = 120;
      for (let s = 1; s <= N; s++) {
        window.R.newRun(s);
        const m = window.R.map();
        const col = (c) => m.filter(n => n.col === c);
        widths.add([0,1,2,3,4].map(c => col(c).length).join(''));
        lanes.add(m.map(n => n.kind).join(','));
        spots.add(m.map(n => n.x + ',' + n.y).join('/'));
        edges.add(m.map(n => n.to.join('|')).join('/'));
        if ([0,1,2,3,4].some(c => col(c).length === 3)) wide++;
      }
      return { widths: widths.size, lanes: lanes.size, spots: spots.size,
               edges: edges.size, wide, n: N };
    });
    check('ROAD: two seeds are two roads — the width, the lane order, the coins and the crossings all move',
      vary.widths >= 4 && vary.lanes >= 20 && vary.spots >= 110 && vary.edges >= 20
      && vary.wide > vary.n * 0.5,
      JSON.stringify(vary));
    await reset(11);
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
      v.length >= 10 && v.length <= 13 && v.every(n => n.glyph && n.word),
      v.length + ' stops drawn');

    // REWRITTEN at Build 58 for the one deliberate exception. Depth still runs
    // one way — where you may go is the only bright thing — but the Regent is
    // the thing the whole chart points at and is visible from the trailhead by
    // design (there is a check below that says exactly that). So she is named
    // as the exception rather than allowed to quietly break the rule, and
    // everything else must still recede.
    const openN = v.filter(n => n.open);
    const recede = v.filter(n => !n.open && !n.here && !/^5:/.test(n.id));
    const regent = v.find(n => /^5:/.test(n.id));
    check('GLANCE: only the stops you may take are bright — everything but the Regent recedes',
      openN.length >= 2 && openN.length <= 3 && openN.every(n => n.opacity === 1)
      && recede.length && recede.every(n => n.opacity <= 0.55)
      && regent && regent.opacity < 1 && regent.opacity >= 0.6,
      `open ${openN.length} · dimmest-open ${Math.min(...openN.map(n => n.opacity))}`
      + ` · loudest-far ${Math.max(...recede.map(n => n.opacity))} · regent ${regent && regent.opacity}`);

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

    // ONE SEED'S LAYOUT IS NOT A LAYOUT. The coins are jittered off the grid
    // now, so "it fits" has to be swept — and it can be, exactly, without
    // rendering 200 roads: measure ONE node's real extent around its centre
    // and then apply that envelope to every seed's stored x/y.
    const envelope = await J(() => {
      const b = document.querySelector('#k-map-nodes .k-node');
      const n = window.R.map().find(q => q.id === b.dataset.node);
      const r = b.getBoundingClientRect();
      const stage = document.getElementById('k-map').getBoundingClientRect();
      const boss = document.querySelector('.k-node.k-n-boss').getBoundingClientRect();
      // the party token stands 46px above the stop's centre and is 25px tall,
      // so on the stop you are ON it — not the disc — is the topmost thing
      const you = 46 + 13;
      return {
        up: Math.max(n.y - (r.top - stage.top), you), down: (r.bottom - stage.top) - n.y,
        left: n.x - (r.left - stage.left), right: (r.right - stage.left) - n.x,
        bossW: boss.width, bossH: boss.height,
        card: (() => { const c = document.getElementById('k-map-card').getBoundingClientRect();
          return { t: c.top - stage.top, l: c.left - stage.left, r: c.right - stage.left }; })(),
        key: (() => { const c = document.getElementById('k-map-key').getBoundingClientRect();
          return { t: c.top - stage.top, l: c.left - stage.left, r: c.right - stage.left }; })(),
        head: document.getElementById('k-map-top').getBoundingClientRect().height,
        W: stage.width, H: stage.height,
      };
    });
    const fitAll = await J((env) => {
      const bad = [], N = 240;
      for (let s = 1; s <= N; s++) {
        window.R.newRun(s);
        window.R.map().forEach(n => {
          const grow = n.kind === 'boss' ? (env.bossW - (env.left + env.right)) / 2 : 0;
          const t = n.y - env.up, b2 = n.y + env.down;
          const l = n.x - env.left - grow, r = n.x + env.right + grow;
          if (t < env.head) bad.push(s + ':' + n.id + ':head');
          if (b2 > env.H) bad.push(s + ':' + n.id + ':floor');
          if (l < 0 || r > env.W) bad.push(s + ':' + n.id + ':edge');
          if (b2 > env.card.t && r > env.card.l && l < env.card.r) bad.push(s + ':' + n.id + ':card');
          // …and the legend is furniture too. A coin behind it is a stop you
          // cannot pick, exactly like one behind the card.
          if (b2 > env.key.t && r > env.key.l && l < env.key.r) bad.push(s + ':' + n.id + ':key');
        });
      }
      return { bad: bad.length, n: N, sample: bad.slice(0, 4) };
    }, envelope);
    check('GLANCE: the coins wander, and none wanders off the chart or behind the furniture — swept over 240 roads',
      fitAll.bad === 0, fitAll.bad + ' bad of ' + fitAll.n + ' roads'
      + (fitAll.sample.length ? ' — ' + fitAll.sample.join(',') : ''));
    await reset(11);

    // ═══ THE CHART ═══
    // v2.2's map was a PAINTING with a road across it; v2.3's was a road on
    // black. That is most of what "the world map needs work" meant, and it is
    // the one property on this screen that a state assertion cannot reach — so
    // it is asserted where it actually lives: the painting is a real region's
    // art, at a brightness that leaves it a picture rather than a texture, and
    // the header names the same place the picture is of.
    const chart = await J(() => {
      const img = document.querySelector('#k-map-bg img');
      const cs = getComputedStyle(img);
      const bright = (cs.filter.match(/brightness\(([\d.]+)\)/) || [])[1];
      return { src: img.getAttribute('src'),
               bright: bright ? +bright : 0,
               w: img.naturalWidth, h: img.naturalHeight,
               head: (document.getElementById('k-map-prog').textContent || '').trim(),
               say: (document.getElementById('k-map-say').textContent || '').trim(),
               region: window.R.state().region };
    });
    const regions = await J(() => window.R.REGIONS.map(r => ({ ...r })));
    const mine = regions.find(r => r.id === chart.region);
    check('CHART: the road is drawn on a painting of somewhere, and the header names that somewhere',
      !!mine && chart.src === '../art/' + mine.art + '.webp' && chart.w > 1000
      && chart.head.indexOf(mine.name) === 0 && chart.say === mine.line,
      JSON.stringify({ region: chart.region, src: chart.src, head: chart.head, w: chart.w }));
    // 0.42 was the value that made this a black rectangle with coins on it.
    check('CHART: the painting is lit enough to BE a painting — not a texture under a black plate',
      chart.bright >= 0.5, 'brightness ' + chart.bright);

    const spread = await J(() => {
      const seen = {}, N = 200;
      for (let s = 1; s <= N; s++) { window.R.newRun(s); const r = window.R.state().region; seen[r] = (seen[r] || 0) + 1; }
      return { seen, kinds: Object.keys(seen).length, min: Math.min(...Object.values(seen)) };
    });
    check('CHART: a run has a face — all six charts turn up, and none of them hogs the road',
      spread.kinds === 6 && spread.min > 200 / 6 * 0.5, JSON.stringify(spread));
    await reset(11);

    // A STOP HAS A NAME. "BATTLE · BATTLE · BATTLE" down a chart is a
    // difficulty list; a road you walk has places on it — and two of the same
    // place on one chart is the tell that they are decoration.
    const named = await J(() => {
      const bad = [], N = 200;
      for (let s = 1; s <= N; s++) {
        window.R.newRun(s);
        const m = window.R.map();
        const names = m.map(n => n.name);
        if (names.some(x => !x || x.length < 4)) bad.push(s + ':blank');
        if (new Set(names).size !== names.length) bad.push(s + ':dupe');
      }
      return { bad: bad.length, n: N, sample: bad.slice(0, 3) };
    });
    check('CHART: every stop is a PLACE — it has a name, and no chart repeats one',
      named.bad === 0, named.bad + ' bad of ' + named.n
      + (named.sample.length ? ' — ' + named.sample.join(',') : ''));
    await reset(11);

    // THE LEGEND BUYS THE RIGHT TO A QUIET CHART. Words surface only where a
    // choice lives; the vocabulary lives once, off to the side. If the legend
    // is missing a mark, a stop on the road is a symbol nobody ever names.
    const key = await J(() => {
      const rows = [...document.querySelectorAll('#k-map-key .k-mk-row')];
      const words = rows.map(r => r.querySelector('b').textContent);
      const marks = rows.map(r => r.querySelector('svg').innerHTML);
      const onRoad = new Set([...document.querySelectorAll('#k-map-nodes .k-node')]
        .map(b => b.querySelector('.k-n-word').textContent));
      const quiet = [...document.querySelectorAll('#k-map-nodes .k-node')]
        .filter(b => !b.classList.contains('k-n-open') && !b.classList.contains('k-n-here')
                  && !b.classList.contains('k-n-boss'))
        .every(b => +getComputedStyle(b.querySelector('.k-n-word')).opacity === 0);
      return { words, distinct: new Set(marks).size,
               covers: [...onRoad].every(w => words.indexOf(w) >= 0), quiet };
    });
    check('CHART: the marks are named once, in the legend — so the chart itself stays quiet',
      key.words.length === 5 && key.distinct === 5 && key.covers && key.quiet,
      JSON.stringify(key));

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
    // THE LOAD-BEARING RULE HAS TO TRAVEL WITH THE STOP. "Only a memory opens
    // the deeper nodes" was stated in exactly one place — the sealed-node line
    // at a fire the player had to have already reached. A run that took only
    // battles could spend both forks that mattered without ever learning it.
    const memory = await J(() => {
      const st = window.R.map().find(n => n.kind === 'story');
      const prev = window.R.map().find(m => m.col === st.col - 1 && m.to.indexOf(st.id) >= 0);
      window.R._set({ at: prev.id, path: [prev.id], stop: prev.col + 1 });
      window.R.tapNode(st.id);
      return document.getElementById('k-map-card').textContent;
    });
    check('GLANCE: a memory says what it is FOR before you take it, not after',
      /deeper nodes/i.test(memory), memory.replace(/\s+/g, ' ').slice(0, 96));
    await reset(11);
    await J(() => { document.querySelector('.k-node.k-n-open').click(); });

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
    // HALF THE BOND SURVIVES THE ROAD — and the road has to show it, or it is
    // a resource the player only ever meets mid-fight.
    const bond = await J(() => {
      const r = window.R.state();
      const el2 = document.getElementById('k-map-kizuna');
      return { carry: window.R.KIZUNA_CARRY, held: r.kizuna,
               shown: el2 ? !el2.classList.contains('k-hidden') : null,
               width: (document.getElementById('k-map-kz-fill') || {}).style
                 ? document.getElementById('k-map-kz-fill').style.width : null };
    });
    check('RUN: the bond the party carries is on the road, not only in a fight',
      bond.carry > 0 && bond.carry < 1 && (bond.held > 0 ? bond.shown : !bond.shown),
      JSON.stringify(bond));

    check('RUN: a win pays the foe’s embers plus what the parry earned',
      won.embers === foeWorth + 2 && won.lastGain.clean === 2,
      JSON.stringify({ embers: won.embers, base: foeWorth, bonus: won.lastGain }));
    check('RUN: a finished fight puts you back on the road, one stop deeper',
      won.at === target && won.stop === 1 && !won.over,
      JSON.stringify({ at: won.at, stop: won.stop }));

    // REWRITTEN at Build 58: where you are standing was the words YOU ARE HERE
    // on a tag (`.k-n-pin`). It is the three of them now, on a token that walks
    // between stops — so the check is that the party is ON the stop you just
    // reached, not that a label exists somewhere.
    const you = await J(() => {
      const t = document.getElementById('k-map-you');
      const here = document.querySelector('.k-node.k-n-here');
      if (!t || !here) return { shown: false };
      const a = t.getBoundingClientRect(), b = here.getBoundingClientRect();
      return { shown: !t.classList.contains('k-hidden'),
               faces: t.querySelectorAll('img').length,
               on: t.dataset.on,
               dx: Math.round(Math.abs((a.left + a.width / 2) - (b.left + b.width / 2))),
               above: a.bottom <= b.top + b.height * 0.6,
               done: document.querySelectorAll('.k-n-done').length };
    });
    check('GLANCE: after the first stop the three of them are standing on it, and it is not yet spent',
      you.shown && you.faces === 3 && you.on === target && you.dx <= 6 && you.above
      && you.done === 0, JSON.stringify(you));
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
    } else {
      // A LOOKUP THAT FINDS NOTHING MUST FAIL, NOT VANISH. Without this arm the
      // check is simply never pushed and the suite's total silently drops by
      // one — which reads as "32/32 passed" for a check that did not run. The
      // camp at column 2 is guaranteed by PLAN and by the unconditional base
      // edge in buildMap, so this arm should be unreachable; the day it is
      // reachable is the day someone changed the road's shape.
      check('CAMP: a campfire mends on arrival and opens the fire — it is a place, not an instant',
        false, 'no camp reachable — the road’s shape changed');
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
    // A memory is a SCENE now (camp.test.cjs owns what happens inside it); what
    // the road has to guarantee is that the stop opens one and that finishing
    // it pays back into the run.
    const opened = await J(() => ({
      scene: !document.getElementById('k-scene').classList.contains('k-hidden'),
      map: !document.getElementById('k-map').classList.contains('k-hidden'),
      tier: window.R.state().tier,
    }));
    check('MEMORY: a memory stop opens a scene, and holds the road until it is heard',
      opened.scene && !opened.map && opened.tier === preTier, JSON.stringify(opened));
    await J(() => { window.R.sceneSkip(); window.R.sceneNext(); });
    await sleep(300);
    const post = await R();
    check('MEMORY: hearing it opens the next tier of the tree and pays an ember',
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
      const hidden = (id) => document.getElementById(id).classList.contains('k-hidden');
      return { at: r.at, embers: r.embers, stop: r.stop, seed: r.seed, woke: r.woke,
               inFight: !hidden('k-stage'), onWake: !hidden('k-wake'), onMap: !hidden('k-map') };
    });
    // ?test=1 always starts a clean run so the suite is repeatable; the check
    // is that a run round-trips through storage at all, which the reset proves
    // by loading a DIFFERENT run than the one in memory.
    //
    // A FRESH RUN NOW OPENS ON THE AWAKENING. The bug this guards against is
    // reloading back into a fight that no longer exists, and that is still
    // exactly what it asks: nowhere near the stage, standing at the trailhead
    // with the offer unanswered.
    check('SAVE: reloading never lands in a fight that no longer exists',
      after.inFight === false && after.at === null && after.onWake === true
      && after.woke == null,
      JSON.stringify(after));
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

  // THE MUTE REPORTS A CHOICE, NOT AN ENVIRONMENT. This suite boots WITHOUT
  // &music=1, so nothing is playing — and while the button painted from the
  // effective state rather than from the stored preference it showed a slash
  // here, telling a player their music was off when they had never touched it.
  // The road suite is the right place to hold that line, because it is the one
  // that sees the header in its ordinary, silent-under-test condition.
  const mute = await J(() => {
    const b = document.getElementById('k-mute');
    return b ? { muted: b.classList.contains('k-muted'),
                 pref: window.K.musicPref(), on: window.K.musicOn() } : null;
  });
  check('ROAD: the music button shows the player\u2019s choice, not whether audio is live',
    !!mute && mute.pref === true && mute.on === false && mute.muted === false,
    JSON.stringify(mute));

  const r = report();
  await H.browser.close();
  process.exit(r.passed === r.total && r.errs === 0 ? 0 : 1);
})();
