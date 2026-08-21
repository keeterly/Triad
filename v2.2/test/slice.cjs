// THE VERTICAL SLICE, PLAYED START TO FINISH, ON FILM.
//
// Every gate we have measures a PIECE at rest. A vertical slice is not a set of
// pieces — it is what a player actually walks through: the title, the road, a
// fight, a fire, the tree, a gate, a boss. This drives that whole path
// unattended, asserts the run never stalls, and lays every screen it passed
// through onto one contact sheet so the slice can be LOOKED AT, not just
// asserted about.
//
//   node test/slice.cjs            play it, write test/shots/slice/*.png + a sheet
//   node test/slice.cjs --quiet    same, no per-step chatter
'use strict';
const { boot } = require(require('path').join(__dirname, 'harness.cjs'));
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'shots', 'slice');
const QUIET = process.argv.includes('--quiet');
const log = (...a) => { if (!QUIET) console.log(...a); };

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const t = await boot({});
  const J = t.J.bind(t);
  const errs = [];
  t.page.on('pageerror', e => errs.push('page: ' + e.message));
  t.page.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push('console: ' + m.text()); });
  await t.page.setViewportSize({ width: 1000, height: 462 });

  let n = 0;
  const frames = [];
  const frame = async (label) => {
    const f = path.join(OUT, String(++n).padStart(2, '0') + '-' + label.replace(/\W+/g, '-') + '.png');
    await t.page.screenshot({ path: f });
    frames.push({ label, file: f });
    log('  ▸', label);
  };
  const problems = [];
  const flag = (what) => { problems.push(what); log('    ✗', what); };

  // invariants that must hold at EVERY step of the walk
  const audit = async (where) => {
    const bad = await J(() => {
      const out = [];
      const st = document.getElementById('stage');
      if (!st) return ['no #stage'];
      if (typeof S !== 'undefined' && S) {
        const drawn = document.querySelectorAll('#party-half [data-fig]').length;
        const living = S.heroes.filter(h => !h.downed).length;
        if (drawn < living) out.push('hidden hero (' + drawn + ' drawn < ' + living + ' living)');
        if (!S.over && livingEnemies().length === 0) out.push('fight alive with no foes');
        if (S.ep < 0) out.push('negative EP');
        if (!S.executing && st.classList.contains('executing')) out.push('input locked with nothing executing');
        if (typeof targeting !== 'undefined' && !targeting && st.classList.contains('aiming')) out.push('aim veil stuck');
      }
      // nothing the player must read may be under something else
      const clipped = [...document.querySelectorAll('.fig-name')].filter(e => {
        const r = e.getBoundingClientRect();
        return r.width > 2 && (r.width < 8 || r.height < 5);
      }).length;
      if (clipped) out.push(clipped + ' collapsed nameplate(s)');
      return out;
    });
    (bad || []).forEach(b => flag(where + ': ' + b));
  };

  const step = async (label, fn) => { log('▸', label); await fn(); await audit(label); };

  // ── 1. a run begins ──────────────────────────────────────────────────────
  await step('the road', async () => {
    await J(() => {
      try { localStorage.setItem('kizuna2_2.tutorialSeen', '1'); } catch (_) {}
      RUN = newRun('ash');
      RUN.roster = ['ash', 'hask', 'mira']; RUN.active = RUN.roster.slice();
      RUN.hp = {}; RUN.active.forEach(h => RUN.hp[h] = HEROES[h].maxHp);
      RUN.embers = 24; RUN.floor = 1; RUN.completed = [];
      RUN.map = generateDescent(RUN.roster, 1);
      SETTINGS.fightBg = true;
      showMap();
    });
    await t.sleep(1100);
    await frame('world-map');
  });

  // ── 2. every node type the floor offers, in order ────────────────────────
  const plan = await J(() => mapAll().map(x => ({ id: x.id, type: x.type, col: x.col, label: x.label })));
  const seen = new Set();
  for (const want of ['fight', 'event', 'camp', 'elite', 'boss']) {
    const node = plan.find(x => x.type === want);
    if (!node) { log('  (no', want, 'on this floor)'); continue; }
    seen.add(want);
    await step(want + ' · ' + node.label, async () => {
      await J((id) => { RUN.completed = mapAll().filter(x => x.col < mapNode(id).col).map(x => x.id);
                        enterMapNode(mapNode(id)); }, node.id);
      await t.sleep(1200);
      await frame('node-' + want);
      if (want === 'fight' || want === 'elite' || want === 'boss') {
        await t.autoParry(true);
        let turns = 0;
        while (turns++ < 24) {
          if (await J(() => !(typeof S !== 'undefined' && S) || S.over)) break;
          for (let k = 0; k < 5; k++) {
            const played = await J(async () => {
              if (!S || S.over || S.executing) return false;
              const c = buildHand().find(x => !x.spent && x.cost <= S.ep && x.kind !== 'move');
              if (!c) return false;
              const tid = (c.target === 'ally' || c.target === 'allies') ? (lowestHpAlly() || {}).id
                        : c.target === 'self' ? c.owner
                        : ((frontmostEnemy() || livingEnemies()[0]) || {}).uid;
              await playCard(c, tid); return true;
            });
            if (!played) break;
            for (let i = 0; i < 90; i++) { if (await J(() => !S || S.over || !S.executing)) break; await t.sleep(70); }
          }
          if (turns === 2) await frame('mid-' + want);
          if (await J(() => !S || S.over)) break;
          await J(async () => { if (S && !S.over && !S.executing) await endTurn(); });
          for (let i = 0; i < 200; i++) { if (await J(() => !S || S.over || !S.executing)) break; await t.sleep(70); }
        }
        const done = await J(() => ({ over: !!(S && S.over), foes: S ? livingEnemies().length : -1, turns: S ? S.turn : -1 }));
        if (!done.over) flag(want + ' never resolved (' + JSON.stringify(done) + ')');
        await frame('after-' + want);
        // walk past whatever screen the fight left up
        for (let i = 0; i < 6; i++) {
          const tapped = await J(() => { const ov = document.querySelector('#overlay');
            if (ov && !ov.classList.contains('hidden')) { ov.click(); return true; } return false; });
          if (!tapped) break;
          await t.sleep(600);
        }
      }
    });
  }

  // ── 3. the tree — where the run's growth is spent ─────────────────────────
  // the boss can END the run (either way), and a finished run has no RUN to
  // read — the walk has to be able to stand a fight back up and carry on
  const ensureRun = () => J(() => {
    if (RUN && RUN.active && RUN.active.length) return false;
    RUN = newRun('ash');
    RUN.roster = ['ash', 'hask', 'mira']; RUN.active = RUN.roster.slice();
    RUN.hp = {}; RUN.active.forEach(h => RUN.hp[h] = HEROES[h].maxHp);
    RUN.floor = 1; RUN.completed = []; RUN.map = generateDescent(RUN.roster, 1);
    return true;
  });

  await step('the fire teaches', async () => {
    await ensureRun();
    await J(() => { RUN.embers = 0; RUN.nodes = []; const c = mapAll().find(x => x.type === 'camp'); if (c) showCamp(c); });
    await t.sleep(900);
    await frame('campfire');
    const taught = await J(async () => {
      const b = document.querySelector('#camp-teach');
      if (!b) return { skipped: 'no teaching offered' };
      const before = (RUN.nodes || []).length, embers = runEmbers();
      b.click(); await new Promise(r => setTimeout(r, 900));
      const el = [...document.querySelectorAll('#et-star .et-orb[data-id]')].find(e => e.className.indexOf('et-ready') >= 0);
      if (!el) return { skipped: 'nothing kindleable' };
      el.click(); await new Promise(r => setTimeout(r, 700));
      const buy = document.getElementById('et-buy'); if (!buy) return { skipped: 'no buy button' };
      buy.click(); await new Promise(r => setTimeout(r, 900));
      const fx = document.getElementById('kindle-fx');
      if (fx) fx.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      await new Promise(r => setTimeout(r, 1500));
      return { before, after: (RUN.nodes || []).length, embers, embersAfter: runEmbers() };
    });
    if (!taught.skipped) {
      if (!(taught.after > taught.before)) flag('the fire taught nothing');
      if (taught.embersAfter !== taught.embers) flag('a free teaching still charged embers');
    } else log('    (' + taught.skipped + ')');
    await frame('after-teaching');
  });

  await step('the ember tree', async () => {
    await ensureRun();
    await J(() => { RUN.embers = 60; showEmberTree(() => showMap(), (RUN.active || ['ash'])[0]); });
    await t.sleep(900);
    await frame('ember-tree');
    const bought = await J(async () => {
      const before = (RUN.nodes || []).length;
      const el = [...document.querySelectorAll('#et-star .et-orb[data-id]')].find(e => e.className.indexOf('et-ready') >= 0);
      if (!el) return { skipped: true };
      el.click(); await new Promise(r => setTimeout(r, 700));
      const buy = document.getElementById('et-buy'); if (!buy) return { skipped: true };
      buy.click(); await new Promise(r => setTimeout(r, 900));
      const fx = document.getElementById('kindle-fx');
      if (fx) fx.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      await new Promise(r => setTimeout(r, 1400));
      return { before, after: (RUN.nodes || []).length };
    });
    if (!bought.skipped && !(bought.after > bought.before)) flag('kindling a node did not grant it');
    await frame('ember-tree-kindled');
  });

  // ── 4. the gate to the next domain ───────────────────────────────────────
  await step('the gate', async () => {
    await ensureRun();
    const gate = plan.find(x => x.type === 'gate');
    if (!gate) { log('  (no gate on this floor)'); return; }
    await J((id) => { RUN.completed = mapAll().map(x => x.id).filter(i => i !== id); enterMapNode(mapNode(id)); }, gate.id);
    await t.sleep(1100);
    await frame('domain-gate');
  });

  const sheet = frames.map((f, i) => `  ${String(i + 1).padStart(2, '0')}  ${f.label}`).join('\n');
  console.log('\n── the slice, in ' + frames.length + ' frames ──\n' + sheet);
  console.log('\nnode types walked: ' + [...seen].join(', '));
  console.log('problems: ' + (problems.length ? '\n  - ' + problems.join('\n  - ') : 'none'));
  console.log('errors:   ' + (errs.length ? '\n  - ' + errs.slice(0, 8).join('\n  - ') : 'none'));
  console.log('frames in ' + OUT);
  await t.browser.close();
  process.exit(problems.length || errs.length ? 1 : 0);
})();
