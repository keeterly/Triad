// KIZUNA v2.3 — THE FILMSTRIP. A real run, walked, photographed at every beat.
//
// Not a gate: a LOOK. The suites prove the rules hold; nothing in them can say
// whether the screen a player is standing in front of reads well. This walks
// one seed end to end in realtime and photographs every state it passes
// through, so the whole game can be reviewed as a sequence of frames rather
// than as a memory of it.
'use strict';
const { boot } = require('./harness.cjs');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'film');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const H = await boot({ query: 'road=1&realtime=1', skipTitle: true });
  const { J, sleep, page } = H;
  let n = 0;
  const shot = async (tag) => {
    await page.screenshot({ path: path.join(OUT, String(++n).padStart(2, '0') + '-' + tag + '.png') });
    return tag;
  };
  const up = () => J(() => ['k-title','k-wake','k-map','k-stage','k-camp','k-scene','k-swap','k-mark']
    .filter(id => { const e = document.getElementById(id); return e && !e.classList.contains('k-hidden'); }));

  // ── the title, cold ──
  await J(() => { try { localStorage.removeItem('kizuna23.run'); } catch (e) {} window.R.boot({}); });
  await sleep(2400);
  await shot('title');
  await J(() => document.querySelector('.k-tt-go').click());
  await sleep(900);
  await shot('wake');

  // take a memory and start walking
  await J(() => { const c = document.querySelector('#k-wake-cards button'); if (c) c.click(); });
  await sleep(1100);
  await shot('road-trailhead');

  const seen = {};
  for (let col = 0; col < 12; col++) {
    const info = await J(() => {
      const r = window.R.reachable(), m = window.R.map();
      if (!r.length) return null;
      // prefer a kind we have not photographed yet
      return r.map(id => { const q = m.find(x => x.id === id); return { id, kind: q && q.kind }; });
    });
    if (!info) break;
    const want = info.find(o => !seen[o.kind]) || info[0];
    seen[want.kind] = (seen[want.kind] || 0) + 1;
    // the two-tap gesture, and the confirmation card it raises
    await J((id) => window.R.tapNode(id), want.id);
    await sleep(420);
    if (col < 2) await shot('road-picked-' + want.kind);
    await J((id) => window.R.tapNode(id), want.id);
    await sleep(1400);

    let scr = (await up())[0];
    // a conversation may open before the stop's own business
    let guard = 0;
    while (scr === 'k-scene' && guard++ < 6) {
      const isBond = await J(() => { const s = window.R.scene(); return !!s && s.kind === 'bond'; });
      if (!isBond) break;
      await shot('bond-beat');
      await J(() => window.R.sceneSkip());
      await sleep(500);
      await shot('bond-fork');
      await J(() => { const f = document.querySelectorAll('#k-scene-fork .k-fork'); if (f[0]) f[0].click(); });
      await sleep(700);
      scr = (await up())[0];
      if (scr === 'k-swap') {
        await shot('swap');
        await J(() => { const c = document.querySelector('#k-swap-cols .k-swapcard'); if (c) c.click();
                        const g = document.getElementById('k-swap-go'); if (g && !g.disabled) g.click(); });
        await sleep(700);
        scr = (await up())[0];
      }
      if (scr === 'k-mark') {
        await shot('mark');
        await J(() => { const b = document.querySelector('#k-mark-cols .k-mk:not([disabled])'); if (b) b.click(); });
        await sleep(700);
        scr = (await up())[0];
      }
    }

    if (scr === 'k-stage') {
      await shot('combat-' + want.kind + '-open');
      // play one real turn so the hand, the aim and the intent are all live
      const boxes = await J(() => {
        const t = document.getElementById('k-boss-art'); if (!t) return null;
        const q = t.getBoundingClientRect();
        const cx = q.left + q.width / 2, cy = q.top + q.height / 2;
        const c = [...document.querySelectorAll('#k-hand .k-card')].find(e => {
          if (e.classList.contains('k-dead')) return false;
          try { return !!window.K.dropTargetAt(cx, cy, e.dataset.card); } catch (_) { return false; }
        });
        if (!c) return null;
        const r = c.getBoundingClientRect();
        return { from: [r.left + r.width / 2, r.top + r.height / 2], to: [cx, cy] };
      });
      if (boxes) {
        await page.mouse.move(boxes.from[0], boxes.from[1]);
        await sleep(80);
        await page.mouse.down();
        for (let k = 1; k <= 10; k++) {
          await page.mouse.move(boxes.from[0] + (boxes.to[0] - boxes.from[0]) * k / 10,
                                boxes.from[1] + (boxes.to[1] - boxes.from[1]) * k / 10);
          await sleep(16);
        }
        await sleep(120);
        await shot('combat-aiming');
        await page.mouse.up();
        await sleep(800);
        await shot('combat-after-play');
      }
      // the parry bar, mid-string
      await J(() => { const e = document.getElementById('k-endturn'); if (e) e.click(); });
      await sleep(400);
      await J(() => { const e = document.getElementById('k-endturn'); if (e) e.click(); });
      await sleep(4200);
      await shot('combat-parry');
      await sleep(4500);
      await shot('combat-volley');
      // …then end it and photograph the death and the reckoning
      await J(() => { window.K._markBrink('elin'); window.K._dealToBoss(9999, 'hit', 'ash'); });
      await sleep(700);
      await shot('kill-blow');
      await sleep(1400);
      await shot('kill-fallen');
      await sleep(1400);
      scr = (await up())[0];
      const onReck = await J(() => !!window.R.reckoning());
      if (onReck) {
        await shot('reckoning-beat');
        await J(() => { for (let i = 0; i < 14 && window.R.reckoning(); i++) {
          if (document.querySelector('.k-rk-opt')) break; window.R.reckNext(); } });
        await sleep(700);
        await shot('reckoning-fork');
        await J(() => { const o = document.querySelector('.k-rk-opt'); if (o) o.click(); });
        await sleep(1600);
      }
    } else if (scr === 'k-camp') {
      await shot('camp');
      await J(() => { const m = document.querySelector('#k-camp-read .k-tnode:not([disabled])'); if (m) m.click(); });
      await sleep(600);
      await shot('camp-node-picked');
      await J(() => window.R.leaveCamp());
      await sleep(700);
    } else if (scr === 'k-scene') {
      await shot('scene-' + want.kind);
      await J(() => { for (let i = 0; i < 24 && window.R.scene(); i++) {
        if (document.querySelector('#k-scene-fork .k-fork')) break; window.R.sceneNext(); } });
      await sleep(600);
      await shot('scene-' + want.kind + '-fork');
      await J(() => { const f = document.querySelectorAll('#k-scene-fork .k-fork'); if (f[0]) f[0].click(); });
      await sleep(900);
    }
    await sleep(500);
    const nowUp = (await up())[0];
    if (nowUp === 'k-map' && col < 3) await shot('road-after-' + want.kind);
    const over = await J(() => (window.R.state() || {}).over);
    if (over) { await shot('run-over'); break; }
  }
  const last = (await up())[0];
  if (last === 'k-map') await shot('road-late');

  await H.browser.close();
  console.log('frames: ' + n + ' in ' + OUT);
  console.log(fs.readdirSync(OUT).join('\n'));
})();
