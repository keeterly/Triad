'use strict';
// Dump the Hips straight through the moment it jumps.
const { boot } = require('./harness.cjs');
(async () => {
  const { page, J, browser } = await boot({ query: 'cast=3d' });
  page.on('pageerror', e => console.log('!! PAGE ERROR:', e.message));
  await page.waitForFunction(() => window.Cast3D && window.Cast3D._state().ready, null, { timeout: 60000 });
  await page.evaluate(() => { window.__noIdle = true; });
  const out = await J(() => {
    const C3 = window.Cast3D; C3.disable();
    const f = C3._figure('ash');
    const name = C3._verbClip('ash', 'slash');
    const a = f.actions[name];
    f.clear(); f.play(name);
    // THE DECISIVE EXPERIMENT: take the idle out from underneath. If the jump
    // survives it is in the clip; if it vanishes it is the blend.
    if (window.__noIdle && f.idle) { f.idle.setEffectiveWeight(0); f.idleWant = 0; }
    const STEP = 1 / 240;
    const rows = [];
    for (let i = 0; i < 320; i++) {
      f.step(STEP);
      const t = (i - 60) * STEP;
      if (t > 0.33 && t < 0.40) {
        const q = f.bones.Hips.quaternion;
        rows.push({ t: +t.toFixed(4), at: +a.time.toFixed(4),
                    w: +a.getEffectiveWeight().toFixed(3),
                    idle: +(f.idle ? f.idle.getEffectiveWeight() : 0).toFixed(3),
                    q: [q.x, q.y, q.z, q.w].map(v => +v.toFixed(4)) });
      }
    }
    return { dur: a.getClip().duration, ts: a.timeScale, rows };
  });
  console.log('clip dur', out.dur, 'timeScale', out.ts);
  for (const r of out.rows) console.log(' t', r.t, 'clipT', r.at, 'w', r.w, 'idle', r.idle, JSON.stringify(r.q));
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
