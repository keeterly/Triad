// KIZUNA v2.3 — the SOAK. A player who does not know what they are doing,
// many times over.
//
// Every other suite walks a route somebody chose. This one walks routes NOBODY
// chose: random seed, random awakening, random fork at every column, random
// pick at every crossroads, random spend at every fire, and a reload dropped
// into the middle of a run to see whether the game comes back the same. It
// asserts the same invariants the slice does, plus the two that only a soak can
// reach:
//
//   EXACTLY ONE SCREEN, at every single transition — not just at the six
//   places a scripted walk happens to look.
//
//   NEVER STUCK. At every point where the game is waiting for the player,
//   SOMETHING must be clickable. A soft-lock is the worst bug this game can
//   have — it is unrecoverable, it looks like a crash, and no assertion about
//   state will ever find one.
//
// A breach prints the seed and the whole choice trail, so anything it finds is
// reproducible by hand.
'use strict';
const { boot } = require('./harness.cjs');
const { BOT } = require('./bot.cjs');

const RUNS = +(process.env.SOAK_RUNS || 10);
const RESUME_URL = 'http://127.0.0.1:8099/v2.3/index.html?test=1&road=1&resume=1';
const MAX_TURNS = 24;

(async () => {
  const H = await boot({ query: 'road=1' });
  const { J, check, report, sleep, page } = H;

  const SCREENS = ['k-stage', 'k-map', 'k-camp', 'k-scene', 'k-swap', 'k-wake', 'k-mark'];
  const visible = () => J((ids) => ids.filter(id => {
    const el = document.getElementById(id);
    return el && !el.classList.contains('k-hidden');
  }), SCREENS);

  const breaches = [];
  let trail = [];
  let seedNow = 0;
  const note = (s) => trail.push(s);
  const fail = (what) => breaches.push(`seed ${seedNow} · ${what}\n      trail: ${trail.join(' → ')}`);

  // ── the invariants, checked after EVERY transition ───────────────────────
  async function invariants(where) {
    const bad = await J((w) => {
      const r = window.R.state(), out = [];
      if (!r) return [];
      if (r.embers < 0) out.push('negative embers: ' + r.embers);
      if (r.tier < 1 || r.tier > 5) out.push('tier out of range: ' + r.tier);
      if (r.kizuna < 0 || r.kizuna > 100) out.push('kizuna out of range: ' + r.kizuna);
      if ((r.foeBonus || 0) < 0) out.push('negative foeBonus');
      const cap = { ash: 42 + (r.vigor || 0), elin: 36 + (r.vigor || 0), mira: 34 + (r.vigor || 0) };
      if (r.hp) for (const id of Object.keys(cap)) {
        if (r.hp[id] > cap[id]) out.push(id + ' over max: ' + r.hp[id] + '/' + cap[id]);
        if (r.hp[id] < 0) out.push(id + ' below zero: ' + r.hp[id]);
      }
      if (new Set(r.nodes).size !== r.nodes.length) out.push('a node kindled twice');
      if (new Set(r.path).size !== r.path.length) out.push('a stop visited twice');
      if (new Set(r.seen || []).size !== (r.seen || []).length) out.push('a memory heard twice');
      if (r.roster) {
        for (const h of ['ash', 'elin', 'mira']) {
          if ((r.roster[h] || []).length !== 5) out.push(h + ' holds ' + (r.roster[h] || []).length + ' slots, not 5');
        }
        const ids = window.K.rosterIds(r.roster);
        if (new Set(ids).size !== ids.length) out.push('the roster holds a duplicate');
      }
      // THE ROAD MUST STAY WALKABLE. A run that is not over and has nothing
      // reachable is a run with no way forward — the exact shape of a
      // soft-lock, and it is invisible to every state assertion but this one.
      if (!r.over && r.woke && !r.pending) {
        const open = window.R.reachable();
        if (!open.length) out.push('no reachable stop, and the run is not over');
      }
      if (window.K.state()) {
        const c = window.K.state();
        const all = [...c.hand, ...c.deck, ...c.discard, ...c.exhausted].filter(id => id !== 'lightsteel');
        if (all.length !== 15) out.push('deck is ' + all.length + ' cards, not 15');
        if (c.ap < 0) out.push('negative AP');
        if (c.boss && c.boss.hp > c.boss.max) out.push('foe over its own max');
      }
      return out.map(s => w + ': ' + s);
    }, where);
    bad.forEach(b => fail(b));
    const v = await visible();
    if (v.length !== 1) fail(`${where}: ${v.length} screens up (${v.join(',') || 'none'})`);
    return v[0];
  }

  // ── NEVER STUCK ──────────────────────────────────────────────────────────
  // Whatever screen is up, there has to be a way off it. Combat is exempt only
  // while it is animating; everywhere else, the moment the game is waiting for
  // a player it owes them a control.
  async function notStuck(where, screen) {
    const live = await J((id) => {
      const root = document.getElementById(id);
      if (!root) return { n: 0, why: 'no root' };
      const sel = 'button:not([disabled]), [role="button"]:not([disabled]), .k-node.k-n-open,'
        + ' .k-tnode, .k-fork, .k-wk, .k-card, .k-swapcard, .k-mk';
      const els = [...root.querySelectorAll(sel)].filter(el => {
        if (el.classList.contains('k-hidden')) return false;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false;
        if (cs.pointerEvents === 'none') return false;
        const r = el.getBoundingClientRect();
        return r.width > 4 && r.height > 4;
      });
      return { n: els.length, sample: els.slice(0, 3).map(e => (e.className || '').split(' ')[0]) };
    }, screen);
    if (!live.n) fail(`${where}: nothing to click on ${screen} — soft-lock`);
    return live.n;
  }

  async function step(where) {
    const screen = await invariants(where);
    if (screen && screen !== 'k-stage') await notStuck(where, screen);
    return screen;
  }

  // A CARD OWED CAN ARRIVE ANYWHERE. The awakening pays one, a bond level pays
  // one, and a reload re-asks either — so the soak answers a swap or a mark
  // wherever it turns up rather than only where a script expected it.
  async function clearDebts(where, screen) {
    let guard = 0;
    while ((screen === 'k-swap' || screen === 'k-mark') && guard++ < 6) {
      if (screen === 'k-swap') {
        await J(() => {
          const cards = [...document.querySelectorAll('#k-swap-cols .k-swapcard')];
          if (cards.length) cards[Math.floor(Math.random() * cards.length)].click();
          const go = document.getElementById('k-swap-go');
          if (go && !go.disabled) go.click();
        });
        note('swap');
      } else {
        await J(() => {
          const mk = [...document.querySelectorAll('#k-mark-cols .k-mk:not([disabled])')];
          if (mk.length) mk[Math.floor(Math.random() * mk.length)].click();
        });
        note('mark');
      }
      await sleep(280);
      screen = await step(where + ' (debt)');
    }
    return screen;
  }

  // ── settling ─────────────────────────────────────────────────────────────
  const settle = () => J(async () => {
    for (let i = 0; i < 100; i++) {
      const busy = document.getElementById('k-beat') || document.querySelector('.k-pring')
        || document.querySelector('#k-hand.k-discarding');
      if (!busy) return true;
      await new Promise(r => setTimeout(r, 60));
    }
    return false;
  });

  // ── a run ────────────────────────────────────────────────────────────────
  let finished = 0, wiped = 0, reloaded = 0, mysteries = 0, bonds = 0, recks = 0;
  // HOW MANY CONVERSATIONS STAND BETWEEN THE PLAYER AND THE FIRE. Worth
  // printing rather than only bounding: a campfire you have to talk your way
  // through five times before you can spend an ember is a pacing fact, not a
  // stall, and the number is the only way to know which one it has become.
  let deepestBond = 0;

  for (let i = 0; i < RUNS; i++) {
    const seed = 1000 + i * 977;
    seedNow = seed; trail = [];
    // A RELOAD SOMEWHERE IN THE MIDDLE. Persistence is where a run-based game
    // hides its worst bugs, and `pending` — a stop entered but not finished —
    // is the subtlest state this game has.
    const reloadAt = 1 + (i % 5);

    await J((s) => { window.R.newRun(s); return true; }, seed);
    await sleep(200);
    await step('waking');

    // the awakening: take a random offer, by clicking it
    const woke = await J(() => {
      const cards = [...document.querySelectorAll('#k-wake-cards .k-wk')];
      const pick = cards[Math.floor(Math.random() * cards.length)];
      const id = pick.dataset.wake;
      pick.click();
      return id;
    });
    note('woke:' + woke);
    await sleep(300);
    let scr = await step('trailhead');
    scr = await clearDebts('trailhead', scr);
    if (scr !== 'k-map') fail('the awakening did not open the road (' + scr + ')');

    for (let col = 0; col < 6; col++) {
      const openIds = await J(() => window.R.reachable());
      if (!openIds.length) { fail('col ' + col + ': no reachable stop'); break; }

      // a random legal fork, taken through the real two-tap gesture
      const target = openIds[Math.floor(Math.random() * openIds.length)];
      const kind = await J((id) => (window.R.map().find(n => n.id === id) || {}).kind, target);
      await J((id) => { window.R.tapNode(id); }, target);
      await sleep(140);
      await step('picked ' + kind);
      await J((id) => { window.R.tapNode(id); }, target);
      note(`${col}:${kind}`);
      await sleep(460);

      let screen = await step('entered ' + kind);

      // A CAMPFIRE MAY OPEN SEVERAL BOND SCENES FIRST, and this used to drain at
      // most four of them before declaring the fire stuck behind a scene. There
      // are only three pairs, so four looked like plenty — but a pair whose bond
      // crossed TWO thresholds queues twice, and after four straight wins each
      // paying a reckoning, five deep is an ordinary Tuesday. The cap turned a
      // legitimate state into a failure. It drains until the fire opens now, and
      // only calls it stuck if the count stops moving.
      let guard = 0;
      while (screen === 'k-scene' && kind === 'camp' && guard++ < 14) {
        deepestBond = Math.max(deepestBond, guard);
        bonds++;
        await J(() => { window.R.sceneSkip(); });
        await sleep(160);
        await step('bond fork');
        await J(() => {
          const f = [...document.querySelectorAll('#k-scene-fork .k-fork')];
          f[Math.floor(Math.random() * f.length)].click();
        });
        await sleep(260);
        screen = await step('bond swap');
        screen = await clearDebts('bond payout', screen);
        note('bond');
      }

      if (kind === 'camp') {
        if (screen !== 'k-camp') { fail('col ' + col + ': camp did not open the fire (' + screen + ')'); break; }
        // spend a random amount, then leave
        const bought = await J(() => {
          let n = 0, g = 0;
          while (g++ < 12 && Math.random() < 0.7) {
            const btns = [...document.querySelectorAll('#k-camp .k-tnode')]
              .filter(b => !b.className.match(/k-tn-(own|sealed|poor)/));
            if (!btns.length) break;
            const b = btns[Math.floor(Math.random() * btns.length)];
            b.click(); b.click();          // pick it up, then kindle it
            n++;
          }
          return n;
        });
        note('kindled:' + bought);
        await sleep(200);
        await step('at the fire');
        await J(() => window.R.leaveCamp());
        await sleep(260);
      } else if (kind === 'story') {
        const closed = await J(() => {
          let n = 0;
          while (n++ < 30 && window.R.scene()) window.R.sceneNext();
          return !window.R.scene();
        });
        if (!closed) fail('col ' + col + ': the memory never closed');
        note('memory');
        await sleep(260);
      } else if (kind === 'event') {
        mysteries++;
        const took = await J(() => {
          let n = 0;
          while (n++ < 20 && window.R.scene() && !document.querySelector('.k-fork-opt')) window.R.sceneNext();
          const opts = [...document.querySelectorAll('.k-fork-opt')];
          if (!opts.length) return null;
          const ix = Math.floor(Math.random() * opts.length);
          const label = opts[ix].querySelector('.k-fo-lbl').textContent;
          opts[ix].click();
          return label;
        });
        if (!took) { fail('col ' + col + ': the crossroads never offered a fork'); break; }
        note('myst:' + took);
        await sleep(300);
      } else {
        if (screen !== 'k-stage') { fail('col ' + col + ': a ' + kind + ' did not open the stage (' + screen + ')'); break; }
        const r = await page.evaluate(([src, sd, p, mt]) => {
          const K = window.K, orig = K.startCombat;
          K.startCombat = () => K.state();
          try { return eval(src)(sd, p, mt, {}); } finally { K.startCombat = orig; }
        }, [BOT, seed + col * 31, 0.55 + Math.random() * 0.4, MAX_TURNS]);
        note(`${kind}:${r && r.win ? 'won' : 'LOST'}`);
        await sleep(900);
        await settle();
        if (r && !r.win) { wiped++; break; }
        // THE RECKONING stands between the fight and the road now: the foe is
        // on the ground and the two of them who did something say so. Answer
        // it at random, the way this soak answers everything.
        await sleep(1400);
        const said = await J(() => {
          const rk = window.R.reckoning && window.R.reckoning();
          if (!rk) return null;
          for (let i = 0; i < 20 && window.R.reckoning(); i++) {
            if (document.querySelector('.k-rk-opt')) break;
            window.R.reckNext();
          }
          const o = [...document.querySelectorAll('.k-rk-opt')];
          if (!o.length) return { id: rk.id, stuck: true };
          o[Math.floor(Math.random() * o.length)].click();
          return { id: rk.id };
        });
        if (said && said.stuck) fail('col ' + col + ': the reckoning never offered its fork');
        if (said) { recks++; note('reck:' + said.id); }
        await sleep(340);
      }

      await sleep(200);
      const back = await step('back from ' + kind);
      if (back !== 'k-map') { fail('col ' + col + ': a ' + kind + ' did not hand the road back (' + back + ')'); break; }

      // ── the reload ────────────────────────────────────────────────────────
      if (col === reloadAt) {
        const before = await J(() => JSON.parse(JSON.stringify(window.R.state())));
        // …the way a PLAYER's reload boots. Test mode is fresh by default, so
        // a plain page.reload() here measured the harness wiping the save
        // rather than the game restoring it.
        await page.goto(RESUME_URL, { waitUntil: 'networkidle' });
        await page.waitForFunction(() => window.__ready === true, null, { timeout: 8000 });
        await sleep(400);
        reloaded++;
        note('RELOAD');
        const after = await J(() => JSON.parse(JSON.stringify(window.R.state())));
        const same = ['at', 'stop', 'embers', 'tier', 'seed', 'woke', 'region']
          .filter(k => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
        if (same.length) fail('reload changed ' + same.join(',')
          + ' — ' + JSON.stringify(same.map(k => [before[k], after[k]])));
        if (JSON.stringify(before.path) !== JSON.stringify(after.path)) fail('reload changed the path walked');
        if (JSON.stringify(before.nodes) !== JSON.stringify(after.nodes)) fail('reload changed the tree');
        let rs = await step('after reload');
        rs = await clearDebts('after reload', rs);
        if (rs !== 'k-map') fail('the reload did not come back to the road (' + rs + ')');
      }

      const over = await J(() => window.R.state().over);
      if (over) break;
    }

    const end = await J(() => window.R.state());
    if (end.over === 'win') finished++;
    await step('run ' + i + ' end');
  }

  console.log('\n── the soak ──');
  console.log(`    ${RUNS} runs · ${finished} reached the Regent and won · ${wiped} wiped`);
  console.log(`    ${reloaded} mid-run reloads · ${mysteries} crossroads · ${bonds} bond scenes · ${recks} reckonings`
    + `\n    deepest queue of bond scenes in front of one campfire: ${deepestBond}`);

  check(`SOAK: ${RUNS} random runs, and not one invariant breached at any transition`,
    breaches.length === 0,
    breaches.length ? '\n    ' + breaches.slice(0, 6).join('\n    ') : 'clean');
  check('SOAK: the walk actually exercised the road — fights, fires, memories and crossroads',
    finished + wiped === RUNS && reloaded >= 1,
    `won ${finished} · wiped ${wiped} · reloads ${reloaded} · crossroads ${mysteries}`);
  check('SOAK: not one page error across every run',
    H.errs.length === 0, H.errs.slice(0, 3).join(' | ') || 'clean');

  const r = report();
  await H.browser.close();
  process.exit(r.passed === r.total && r.errs === 0 ? 0 : 1);
})();
