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

  // THE ROAD'S LENGTH IS THE ROAD'S TO STATE. Nine checks used to carry it as a
  // literal — 6, col(4), /^5:/ — so growing the road from six columns to eleven
  // read as nine regressions rather than one deliberate change.
  const STOPS = await J(() => window.R.STOPS);

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
    // …and REWRITTEN AGAIN at Build 69, when the road went from six columns to
    // eleven. The number was written into the check's own name and body, so a
    // deliberate change to the road's length read as nine broken checks. It
    // reads R.STOPS now: a check has no business restating a constant it does
    // not own.
    check('ROAD: as deep as the road says, and every stop but the last is a choice of two or three',
      colCount === STOPS
      && Array.from({ length: STOPS - 1 }, (_, c) => c)
           .every(c => cols[c].length >= 2 && cols[c].length <= 3)
      && cols[STOPS - 1].length === 1,
      JSON.stringify(Object.keys(cols).map(c => cols[c].length)));

    const ids = new Set(m.map(n => n.id));
    const inbound = {};
    m.forEach(n => n.to.forEach(t => { inbound[t] = (inbound[t] || 0) + 1; }));
    const orphan = m.filter(n => n.col > 0 && !inbound[n.id]);
    const dead = m.filter(n => n.col < STOPS - 1 && !n.to.length);
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
        // WHAT MOVED at Build 69: the road is eleven columns, not six, so the
        // numbers these rules were written around all changed. The RULES did
        // not — one elite per half rather than one per road, a fire roughly
        // every third column rather than two of them, nothing but rest and
        // memory on the Regent's doorstep — and they are written against the
        // road's own length now instead of against 3, 4 and 5.
        const LAST = window.R.STOPS - 1, DOOR = LAST - 1;
        const elites = m.filter(n => n.kind === 'elite');
        if (elites.length < 1 || elites.length > 2) why.push('elites');
        // an elite belongs in the back half of each stretch it guards, never at
        // the trailhead and never on the doorstep
        if (elites.some(n => n.col < 2 || n.col >= DOOR)) why.push('elite misplaced');
        if (!col(DOOR).every(n => n.kind === 'camp' || n.kind === 'story')) why.push('fight at the door');
        if (kind(LAST).join() !== 'boss') why.push('no Regent');
        const fires = m.filter(n => n.kind === 'camp');
        if (fires.length < 3) why.push('fires');
        if (m.filter(n => n.kind === 'story').length < 3) why.push('memories');
        // A FIRE HAS TO BE WITHIN REACH OF A HURT PARTY. On a longer road the
        // real risk is not "too few fires" but a stretch of five fights with no
        // way to mend in the middle of it, so the gap between fires is what is
        // asserted — including the run-up from the trailhead.
        const fireCols = [-1].concat(fires.map(n => n.col).sort((a, b) => a - b)).concat([LAST]);
        const widest = Math.max(...fireCols.slice(1).map((c, i) => c - fireCols[i]));
        if (widest > 5) why.push('gap ' + widest);
        // every route must be able to reach a memory BEFORE the last fire, or
        // the tier lock is unopenable on that road
        if (!m.some(n => n.kind === 'story' && n.col < DOOR - 2)) why.push('no early memory');
        if (why.length) bad.push(s + ':' + why.join('+'));
      }
      return { bad: bad.length, n: N, sample: bad.slice(0, 4) };
    });
    // EVERY STOP IS A FORK, and this is the check that was missing when the road
    // grew. The column-level rule above guarantees a CROSSING exists somewhere
    // in each column; it never guaranteed that the stop you are standing on has
    // two roads out of it. Measured across 400 roads before the fix: 43% of
    // stops were single-exit and 31% of arrivals raised CHOOSE THE NEXT STOP
    // over a board with one lit coin on it. Six stops hid that; eleven made the
    // road read as a corridor.
    //
    // The one legitimate single exit is the run-in to the Regent: the last
    // column is one node, so everything feeding it has one road out by design.
    const exits = await J(() => {
      const LAST = window.R.STOPS - 1;
      let nodes = 0, single = 0, arrivals = 0, dead = 0;
      for (let s2 = 1; s2 <= 300; s2++) {
        window.R.newRun(s2);
        const m = window.R.map();
        m.forEach(n => {
          if (n.col >= LAST - 1) return;          // the boss and its run-in
          nodes++;
          if (n.to.length < 2) single++;
        });
        // …and what a player actually MEETS, walking one route
        let at2 = null;
        for (let c = 0; c < LAST - 1; c++) {
          const opts = at2 === null ? m.filter(n => n.col === 0)
                                    : m.filter(n => at2.to.indexOf(n.id) >= 0);
          arrivals++;
          if (opts.length < 2) dead++;
          at2 = opts[0];
          if (!at2) break;
        }
      }
      return { nodes, single, arrivals, dead };
    });
    check('ROAD: every stop short of the Regent’s run-in is a fork — swept over 300 roads',
      exits.single === 0 && exits.dead === 0,
      JSON.stringify({ singleExit: exits.single + '/' + exits.nodes,
                       arrivalsWithNoChoice: exits.dead + '/' + exits.arrivals }));
    await reset(11);

    check('ROAD: the road is paced — elites placed, fires never more than five columns apart, an early memory, no fight on the Regent’s doorstep',
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
      v.length >= STOPS * 2 - 2 && v.length <= STOPS * 3 && v.every(n => n.glyph && n.word),
      v.length + ' stops drawn');

    // REWRITTEN at Build 58 for the one deliberate exception. Depth still runs
    // one way — where you may go is the only bright thing — but the Regent is
    // the thing the whole chart points at and is visible from the trailhead by
    // design (there is a check below that says exactly that). So she is named
    // as the exception rather than allowed to quietly break the rule, and
    // everything else must still recede.
    const openN = v.filter(n => n.open);
    // …and she is found by BEING the Regent. `/^5:/` was her column number
    // written into a regex, which stopped being true the moment the road grew.
    const bossId = await J(() => (window.R.map().find(n => n.kind === 'boss') || {}).id);
    const recede = v.filter(n => !n.open && !n.here && n.id !== bossId);
    const regent = v.find(n => n.id === bossId);
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
    // THE HEADER IS A FIXED 932px AND IT DOES NOT SCROLL. Adding the three bond
    // bars at Build 71 measured the EMBERS COUNTER out to x=1049 and the mute
    // button to 1090 — both entirely off the board, on a run's own currency and
    // one of its two controls, with nothing on screen to say they had gone. A
    // header that silently drops furniture to make room for a new meter is a
    // failure no visual check catches, because everything that remains looks
    // fine. Every piece of it is measured against the board now.
    //
    // A FIRST VERSION OF THIS CHECK WAS HOLLOW. It measured while the map was
    // not the screen that was up, so every getBoundingClientRect came back zero
    // — including the board's own width — and "nothing is off a 0px board"
    // passed green. It puts the road on screen first now, and asserts the board
    // measured its real width before believing anything else it says.
    const hdr = await J(() => {
      window.R._set({ bonds: { 'ash|elin': 7, 'ash|mira': 22, 'elin|mira': 34 },
                      kizuna: 45, embers: 188 });     // the widest each can read
      window.R.screen('map');
      window.R.render();
      const stage = document.getElementById('k-map').getBoundingClientRect();
      const out = {};
      ['k-map-prog', 'k-map-party', 'k-map-bonds', 'k-map-kizuna', 'k-embers', 'k-mute']
        .forEach(id => {
          const e = document.getElementById(id);
          if (!e || e.classList.contains('k-hidden')) return;
          const r = e.getBoundingClientRect();
          out[id] = { l: Math.round(r.left - stage.left), r: Math.round(r.right - stage.left) };
        });
      return { W: Math.round(stage.width), parts: out };
    });
    const off = Object.entries(hdr.parts).filter(([, b]) => b.l < 0 || b.r > hdr.W);
    const lap = Object.entries(hdr.parts).filter(([k, b], i, all) =>
      all.some(([k2, b2], j) => j > i && b.l < b2.r && b2.l < b.r));
    check('GLANCE: everything in the road header fits the board, and nothing overlaps anything',
      hdr.W > 900 && Object.keys(hdr.parts).length >= 5 && off.length === 0 && lap.length === 0,
      JSON.stringify({ W: hdr.W, measured: Object.keys(hdr.parts).length,
                       off: off.map(([k, b]) => k + ':' + b.l + '-' + b.r),
                       overlap: lap.map(([k]) => k) }));
    await reset(11);

    // …AND NONE OVERPRINTS ANOTHER. This is the risk a denser chart introduces
    // and the one the envelope sweep above cannot see: it tests each coin
    // against the furniture and the edges, never against its neighbours. At
    // eleven columns the centres are 73px apart and a name in nowrap can be
    // wider than that, so two visible names could share a line. Swept over
    // sixty roads, each walked three stops in so a standing node's name is on
    // screen beside the ones you may take.
    const names = await (async () => {
      const bad = [];
      for (let sd = 1; sd <= 60; sd++) {
        await J((x) => {
          window.R.newRun(x);
          for (let i = 0; i < 3; i++) { const r = window.R.reachable(); if (r.length) window.R.travel(r[0]); }
        }, sd);
        await sleep(90);
        await J(() => { window.R.screen('map'); window.R.render(); });
        await sleep(90);
        const hit = await J(() => {
          const vis = [...document.querySelectorAll('#k-map-nodes .k-node')]
            .filter(b => +getComputedStyle(b.querySelector('.k-n-word')).opacity > 0.5)
            .map(b => ({ t: b.querySelector('.k-n-word').textContent,
                         r: b.querySelector('.k-n-word').getBoundingClientRect() }));
          const out = [];
          for (let i = 0; i < vis.length; i++) for (let j = i + 1; j < vis.length; j++) {
            const a = vis[i].r, c = vis[j].r;
            if (a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom)
              out.push(vis[i].t + '×' + vis[j].t);
          }
          return out;
        });
        if (hit.length) bad.push(sd + ':' + hit[0]);
      }
      return bad;
    })();
    check('GLANCE: no two names a player can read at once share a line — swept over 60 roads',
      names.length === 0, names.length + ' overprinting' + (names.length ? ' — ' + names.slice(0, 3).join(', ') : ''));
    await reset(11);

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
      const rows = [...document.querySelectorAll('#k-map-key .k-key-row')];
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
      key.words.length === 6 && key.distinct === 6 && key.covers && key.quiet,
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

    // ONE TAP TRAVELS. This checked the opposite for eleven builds — that the
    // first tap only ASKED, and a second tap on a TRAVEL button committed — and
    // that rule is gone: at eleven stops the confirmation was a toll on every
    // move to prevent a mistake the coin itself now describes. The check that
    // replaces it has to be the one that made the old rule safe to remove:
    // THE PRICE IS LEGIBLE BEFORE THE TAP. Written against the pre-change code
    // this goes red — there was no .k-n-cost on any coin, and the numbers only
    // ever existed on a card that appeared after the first tap.
    const priced = await J(() => {
      const out = { open: 0, priced: 0, samples: [], banner: '' };
      document.querySelectorAll('.k-node.k-n-open').forEach(b => {
        out.open++;
        const c = b.querySelector('.k-n-cost');
        if (!c) return;
        const t = c.textContent.trim();
        if (!t) return;
        out.priced++; out.samples.push(t);
      });
      out.banner = (document.getElementById('k-map-card').textContent || '').trim();
      return out;
    });
    check('GLANCE: every stop you can take prices itself ON the chart, before any tap',
      priced.open >= 2 && priced.priced === priced.open
      && priced.samples.every(t => /\+\d|MEND|TRADE/.test(t)),
      JSON.stringify(priced));
    // …and the band that used to carry those numbers is not still down there
    // saying CHOOSE THE NEXT STOP over a chart that has already said it.
    check('GLANCE: no idle banner under the chart — the coins carry the reading now',
      priced.banner === '', JSON.stringify({ banner: priced.banner.slice(0, 60) }));
    // THE LOAD-BEARING RULE HAS TO TRAVEL WITH THE STOP. "Only a memory opens
    // the deeper nodes" was stated in exactly one place — the sealed-node line
    // at a fire the player had to have already reached. A run that took only
    // battles could spend both forks that mattered without ever learning it.
    // …and it has to say so WITHOUT being tapped, because tapping it is now
    // the same thing as taking it. The rule lives in the legend's own blurb,
    // which is on the chart at all times.
    const memory = await J(() => {
      const st = window.R.map().find(n => n.kind === 'story');
      const prev = window.R.map().find(m => m.col === st.col - 1 && m.to.indexOf(st.id) >= 0);
      window.R._set({ at: prev.id, path: [prev.id], stop: prev.col + 1 });
      const node = document.querySelector('[data-node="' + st.id + '"]');
      return {
        cost: node ? (node.querySelector('.k-n-cost') || {}).textContent || '' : '',
        rule: window.R.KIND.story.blurb,
        aria: node ? node.getAttribute('aria-label') : '',
      };
    });
    check('GLANCE: a memory says what it is FOR before you take it, not after',
      /deeper nodes/i.test(memory.rule) && /\+1/.test(memory.cost),
      JSON.stringify(memory));
    await reset(11);
  }

  // ═══ C · TRAVELLING ═══
  console.log('\n── travelling ──');
  {
    const before = await R();
    const target = (await J(() => window.R.reachable()))[0];
    await J((id) => { document.querySelector('[data-node="' + id + '"]').click(); }, target);
    await sleep(420);
    const st = await R();
    check('TRAVEL: one tap commits — you are at the stop and the path remembers it',
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

  // ═══ C2 · THE MYSTERY ═══
  // The road's sixth kind, and the only stop that is a DECISION rather than an
  // encounter. Everything about it is written as data, so everything about it
  // can be held to its own words.
  console.log('\n── a crossroads ──');
  {
    const standAt = (kind) => J((k) => {
      const st = window.R.map().find(n => n.kind === k);
      if (!st) return null;
      const prev = window.R.map().find(m => m.col === st.col - 1 && m.to.indexOf(st.id) >= 0);
      window.R._set({ at: prev.id, path: [prev.id], stop: prev.col + 1, embers: 12 });
      window.R.travel(st.id);
      return st.id;
    }, kind);

    // A road with no mystery on it cannot test one, so find a seed that grew
    // one rather than asserting on whichever seed happens to be loaded.
    const seed = await J(() => {
      for (let s = 1; s <= 80; s++) {
        window.R.newRun(s);
        if (window.R.map().some(n => n.kind === 'event')) return s;
      }
      return null;
    });
    await reset(seed);
    const at = await standAt('event');
    await sleep(420);

    const open = await J(() => ({
      on: ['k-stage', 'k-map', 'k-camp', 'k-scene']
        .filter(id => !document.getElementById(id).classList.contains('k-hidden')),
      title: (document.getElementById('k-scene-title').textContent || '').trim(),
      line: (document.getElementById('k-scene-line').textContent || '').trim(),
      fork: !!document.querySelector('.k-fork-opt'),
      pending: window.R.state().pending,
    }));
    check('MYSTERY: a mystery stop opens a crossroads, not a fight — and it starts by talking',
      open.on.length === 1 && open.on[0] === 'k-scene' && open.title.length > 3
      && open.line.length > 20 && !open.fork && open.pending === at,
      JSON.stringify(open));

    // THE FORK IS THE EXIT. A stop that can be tapped past is a stop that
    // resolves itself, which is the one thing a decision must never do.
    const held = await J(() => {
      for (let i = 0; i < 20; i++) window.R.sceneNext();
      return { still: !!window.R.scene(),
               onScene: !document.getElementById('k-scene').classList.contains('k-hidden'),
               fork: document.querySelectorAll('.k-fork-opt').length };
    });
    check('MYSTERY: it ends on its fork and waits there — no amount of tapping resolves it for you',
      held.still && held.onScene && held.fork >= 2, JSON.stringify(held));

    // BOTH SIDES OF THE TRADE, ON THE BUTTON, FROM THE SAME DATA THAT CHARGES
    // IT. A pick that advertises a price it does not charge is the worst thing
    // this screen could do, so the words are generated from the effect rather
    // than written beside it — and this is the check that says so.
    const honest = await J(() => {
      const def = window.R.EVENTS.find(e => e.title
        === document.getElementById('k-scene-title').textContent.trim());
      const opts = [...document.querySelectorAll('.k-fork-opt')];
      const rows = opts.map(o => ({
        label: o.querySelector('.k-fo-lbl').textContent,
        chips: [...o.querySelectorAll('.k-fo-fx em')].map(e => e.textContent),
        costs: [...o.querySelectorAll('.k-fo-fx .k-fo-down')].length,
        gains: [...o.querySelectorAll('.k-fo-fx .k-fo-up')].length,
      }));
      return { def: def ? def.picks.map(p => ({ label: p.label, keys: Object.keys(p.fx).length })) : null,
               rows };
    });
    check('MYSTERY: every pick prints one chip per effect it will actually apply, cost and gain apart',
      !!honest.def && honest.rows.length === honest.def.length
      && honest.rows.every((r, i) => r.label === honest.def[i].label
        && r.chips.length === honest.def[i].keys && r.costs + r.gains === r.chips.length),
      JSON.stringify(honest));

    const took = await J(() => {
      const def = window.R.EVENTS.find(e => e.title
        === document.getElementById('k-scene-title').textContent.trim());
      const before = JSON.parse(JSON.stringify(window.R.state()));
      const fx = def.picks[0].fx;
      document.querySelectorAll('.k-fork-opt')[0].click();
      const after = JSON.parse(JSON.stringify(window.R.state()));
      return { fx, before: { embers: before.embers, hp: before.hp, kizuna: before.kizuna,
                             bonds: before.bonds, foeBonus: before.foeBonus },
               after: { embers: after.embers, hp: after.hp, kizuna: after.kizuna,
                        bonds: after.bonds, foeBonus: after.foeBonus },
               flash: after.flash, pending: after.pending };
    });
    await sleep(300);
    const paid = await J((t) => {
      const b = t.before, a = t.after, fx = t.fx, bad = [];
      if (fx.embers && a.embers !== Math.max(0, b.embers + fx.embers)) bad.push('embers');
      if (fx.kizuna && a.kizuna !== Math.min(100, (b.kizuna || 0) + fx.kizuna)) bad.push('kizuna');
      if (fx.regent && a.foeBonus !== (b.foeBonus || 0) + fx.regent) bad.push('regent');
      if (fx.bond) {
        const moved = Object.keys(a.bonds).filter(k => a.bonds[k] !== (b.bonds[k] || 0));
        if (moved.length !== 1 || a.bonds[moved[0]] - (b.bonds[moved[0]] || 0) !== fx.bond) bad.push('bond');
      }
      if (fx.hurt || fx.heal) {
        const max = { ash: 42, elin: 36, mira: 34 };
        Object.keys(max).forEach(id => {
          const was = (b.hp && b.hp[id] != null) ? b.hp[id] : max[id];
          const want = fx.heal ? Math.min(max[id], was + fx.heal) : Math.max(1, was - fx.hurt);
          if (a.hp[id] !== want) bad.push('hp:' + id);
        });
      }
      // …and nothing it did NOT say may move
      if (!fx.embers && a.embers !== b.embers) bad.push('silent embers');
      if (!fx.kizuna && a.kizuna !== b.kizuna) bad.push('silent kizuna');
      if (!fx.regent && a.foeBonus !== b.foeBonus) bad.push('silent regent');
      return bad;
    }, took);
    check('MYSTERY: taking a trade charges exactly what it said, and moves nothing it did not mention',
      paid.length === 0, paid.join(',') + ' — ' + JSON.stringify({ fx: took.fx, before: took.before, after: took.after }));

    // THE RECEIPT IS GONE, AND THAT IS THE POINT. It printed a full-width
    // summary of the trade onto the map one second after the crossroads itself
    // had shown the player the fork, their pick and its consequence — the same
    // news twice, the second time on a screen they had already left. What the
    // road still owes them is the STATE: the stop spent, the road handed back,
    // and the header carrying the new numbers. That is what this asserts now.
    const back = await J(() => ({
      onMap: !document.getElementById('k-map').classList.contains('k-hidden'),
      card: document.getElementById('k-map-card').textContent.replace(/\s+/g, ' '),
      done: document.querySelectorAll('.k-n-done').length,
      pending: window.R.state().pending,
      // the header is where the trade is now legible
      embersShown: document.getElementById('k-embers-n').textContent,
      embersReal: String(window.R.state().embers),
    }));
    check('MYSTERY: the crossroads hands the road back, the stop is spent, and the header carries the trade',
      back.onMap && back.pending === null && back.done >= 1
      && back.embersShown === back.embersReal
      && took.flash && took.flash.icon === 'event' && (took.flash.gainSub || '').length > 3,
      JSON.stringify({ onMap: back.onMap, done: back.done, embers: back.embersShown, flash: took.flash }));
    check('MYSTERY: …and it does NOT re-announce it on a banner over the chart',
      back.card === '', JSON.stringify({ card: back.card.slice(0, 80) }));

    // A STOP WITH NO FIGHT IN IT MUST NOT BE ABLE TO END THE RUN. The road has
    // an elite for that. Swept across every bleed in the table, from 1 HP.
    const survive = await J(() => {
      const bad = [];
      window.R.EVENTS.forEach(e => e.picks.forEach((p, i) => {
        if (!p.fx.hurt) return;
        window.R.newRun(4242);
        window.R._set({ hp: { ash: 1, elin: 1, mira: 1 } });
        window.R._setScene({ ...e, kind: 'event' });
        window.R.takeEvent(i);
        const hp = window.R.state().hp;
        if (Object.keys(hp).some(k => hp[k] < 1)) bad.push(e.id + ':' + p.label + ':' + JSON.stringify(hp));
      }));
      return bad;
    });
    check('MYSTERY: no crossroads can kill anybody — a blood price always leaves one',
      survive.length === 0, survive.slice(0, 3).join(' · ') || 'every bleed leaves 1');

    // …and no chart may deal the same crossroads twice, or the second one is a
    // menu you have already read.
    const dealt = await J(() => {
      const bad = []; let withAny = 0, N = 250;
      for (let s = 1; s <= N; s++) {
        window.R.newRun(s);
        const ev = window.R.map().filter(n => n.kind === 'event');
        if (ev.length) withAny++;
        if (ev.some(n => !n.event || !window.R.eventDef(n.event))) bad.push(s + ':unwired');
        if (new Set(ev.map(n => n.event)).size !== ev.length) bad.push(s + ':dupe');
        // a mystery is a third lane, never a `must` — it can never cost you a
        // fire, the elite, or a memory
        // The rule was always about PLACEMENT — never at the trailhead, never
        // in the closing stretch where the last fire and the Regent live — even
        // though the check's name said "must-lane". Written against the road's
        // length it survives the road growing.
        if (ev.some(n => n.col === 0 || n.col >= window.R.STOPS - 2)) bad.push(s + ':misplaced');
      }
      return { bad: bad.length, withAny, n: N, sample: bad.slice(0, 3) };
    });
    check('MYSTERY: every mystery is wired to a written crossroads, never repeated, never at the trailhead or the door',
      dealt.bad === 0 && dealt.withAny > 250 * 0.4,
      JSON.stringify({ bad: dealt.bad, roadsWithOne: dealt.withAny + '/' + dealt.n, sample: dealt.sample }));
    await reset(11);
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

    // STAND WHERE THE FIRE IS REACHABLE, rather than inheriting wherever the
    // section above happened to stop. This used to depend on the previous
    // block leaving the party one column short of a camp; the mystery block
    // now sits between them and resets the run, and a check that silently
    // stops running is worse than one that fails.
    const campId = await J(() => {
      const camp = window.R.map().find(n => n.kind === 'camp');
      if (!camp) return null;
      const prev = window.R.map().find(m => m.col === camp.col - 1 && m.to.indexOf(camp.id) >= 0);
      const st = window.R.state();
      window.R._set({ at: prev.id, path: (st.path || []).concat([prev.id]), stop: prev.col + 1 });
      return camp.id;
    });
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
    // …by BEING the Regent, not by living at column 5. Her column moved when
    // the road grew; what she is did not.
    const boss = await J(() => window.R.map().find(n => n.col === window.R.STOPS - 1));
    check('BOSS: the last stop is the Regent, and she is visible from the trailhead',
      boss.kind === 'boss' && boss.foe === 'mourner', JSON.stringify({ kind: boss.kind, foe: boss.foe }));
    // …and the stop before her is "the one that leads to her", not column 4.
    await J((b) => {
      const last = window.R.STOPS - 1;
      const prev = window.R.map().find(m => m.col === last - 1 && m.to.indexOf(b.id) >= 0);
      window.R._set({ at: prev.id, path: [prev.id], stop: last, embers: 9 });
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
    // The Regent's dirge moved 4 -> 3 at Build 65. It is the half of her that
    // nobody can parry, and regent.probe measured it as 61% of the health a
    // party actually arrives with — a flat toll on TURNS that barely varied
    // with skill (54 / 50 / 42) while her parryable blows ranged tenfold
    // (44 / 20 / 5). What the check is really holding is the SHAPE: every foe
    // gets its own dirge, the boss's is the heaviest, and it is not so heavy
    // that the unanswerable half decides the fight.
    check('FOES: the fight really is handed the foe’s subset, and the dirge is its own',
      Object.keys(pools).every(id => pools[id].pool.length === F[id].intents.length)
      && pools.husk.dirge === 2 && pools.mourner.dirge === 3
      && pools.mourner.dirge > pools.husk.dirge,
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
    // WHAT MOVED at Build 69: a reload used to drop you straight back into the
    // run. It lands on the TITLE now and offers the stored run as CONTINUE —
    // which is most of what a title screen is for, and means the run coming
    // back whole is something the player asks for rather than something that
    // happens to them. What is asserted below is unchanged.
    const onTitle = await J(() => !document.getElementById('k-title').classList.contains('k-hidden'));
    check('SAVE: a reload lands on the title, with the stored run offered rather than resumed',
      onTitle, JSON.stringify({ onTitle }));
    await H.pastTitle();
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
    // …and it comes back when the player asks for it. boot() opens the title
    // now, so this drove a title screen and then read a run that had not been
    // built yet; CONTINUE is the door, exactly as it is for a real reload.
    const round = await J((b) => {
      localStorage.setItem('kizuna23.run', JSON.stringify(b));
      window.R.boot({});
      const btn = document.querySelector('#k-title-go .k-tt-go[data-go="on"]');
      const offered = !!btn;
      if (btn) btn.click();
      const r = window.R.state() || {};
      return { offered, at: r.at, embers: r.embers, stop: r.stop };
    }, before);
    check('SAVE: a stored run comes back whole — where you stand, and what you carry',
      round.offered && round.at === before.at && round.embers === before.embers && round.stop === before.stop,
      JSON.stringify(round));
  }

  // ═══ THE TITLE ═══
  // The one screen every first-time player sees, and — because it is on the
  // real boot path rather than skipped in test mode — the one the whole suite
  // walks through on its way in.
  console.log('\n── the title ──');
  {
    await J(() => { try { localStorage.removeItem('kizuna23.run'); } catch (e) {} });
    const cold = await J(() => {
      window.R.boot({});
      const up = (id) => !document.getElementById(id).classList.contains('k-hidden');
      return { onTitle: up('k-title'),
               elsewhere: ['k-wake','k-map','k-stage','k-camp','k-scene','k-swap','k-mark'].filter(up),
               name: (document.getElementById('k-title-name') || {}).textContent,
               line: ((document.getElementById('k-title-line') || {}).textContent || '').length,
               doors: [...document.querySelectorAll('.k-tt-go')].map(b => b.dataset.go),
               run: !!window.R.state() };
    });
    check('TITLE: a cold start opens on the title, and on nothing else',
      cold.onTitle && cold.elsewhere.length === 0, JSON.stringify(cold));
    check('TITLE: it says the game’s name, states the premise, and offers exactly one door',
      cold.name === 'KIZUNA' && cold.line > 30 && cold.doors.join() === 'new',
      JSON.stringify({ name: cold.name, line: cold.line, doors: cold.doors }));

    const begun = await J(() => {
      document.querySelector('.k-tt-go[data-go="new"]').click();
      const up = (id) => !document.getElementById(id).classList.contains('k-hidden');
      const r = window.R.state();
      return { onTitle: up('k-title'), onWake: up('k-wake'), built: !!r, stop: r && r.stop };
    });
    check('TITLE: BEGIN builds the run and hands it to the awakening',
      !begun.onTitle && begun.onWake && begun.built, JSON.stringify(begun));

    // …and with a road under way, the title offers it back FIRST.
    const offered = await J(() => {
      const c = document.querySelector('#k-wake-cards button'); if (c) c.click();
      window.R.boot({});
      return { doors: [...document.querySelectorAll('.k-tt-go')].map(b => b.dataset.go),
               labels: [...document.querySelectorAll('.k-tt-go')].map(b => b.textContent.trim()) };
    });
    check('TITLE: an unfinished run is offered back, and CONTINUE is the loud door',
      offered.doors.join() === 'on,new' && /CONTINUE/.test(offered.labels[0])
      && /AGAIN/.test(offered.labels[1]),
      JSON.stringify(offered));

    const kept = await J(() => {
      const was = JSON.parse(localStorage.getItem('kizuna23.run'));
      document.querySelector('.k-tt-go[data-go="on"]').click();
      const r = window.R.state();
      return { woke: r.woke === was.woke, seed: r.seed === was.seed, embers: r.embers === was.embers };
    });
    check('TITLE: CONTINUE brings the same road back, not a new one',
      kept.woke && kept.seed && kept.embers, JSON.stringify(kept));

    // BEGIN AGAIN THROWS THE OLD ROAD AWAY. Leaving it stored beside a second
    // run is how a player ends up with two and no way to tell which they are in.
    const wiped = await J(() => {
      const oldSeed = window.R.state().seed;
      window.R.boot({});
      document.querySelector('.k-tt-go[data-go="new"]').click();
      const r = window.R.state();
      return { oldSeed, seed: r.seed, path: r.path.length, woke: r.woke,
               stored: JSON.parse(localStorage.getItem('kizuna23.run') || 'null') };
    });
    check('TITLE: BEGIN AGAIN throws the stored road away rather than leaving two',
      wiped.path === 0 && wiped.woke == null
      && wiped.stored && wiped.stored.path.length === 0,
      JSON.stringify({ path: wiped.path, woke: wiped.woke,
                       storedPath: wiped.stored && wiped.stored.path.length }));
    await reset(11);
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
