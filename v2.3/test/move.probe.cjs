'use strict';
// Does the parry camera still be moving when the player has to act, or does it
// arrive and park? Sample the eye position over the length of the bar.
const { boot } = require('./harness.cjs');
(async () => {
  const { page, J, sleep, browser } = await boot({ query: 'cast=3d' });
  page.on('pageerror', e => console.log('!! PAGE ERROR:', e.message));
  await page.waitForFunction(() => window.Cast3D && window.Cast3D._state().ready, null, { timeout: 60000 });
  for (const name of ['parry', 'home']) {
    await J((n) => window.Cast3D.shot(n, { speed: 1.5 }), name);
    // REAL TIMESTAMPS. A round trip through `evaluate` in a software-rendered
    // page takes far longer than the sleep asks for, so counting samples and
    // calling it milliseconds put "after the move ended" inside the window and
    // reported a live camera as parked.
    const t0 = Date.now();
    const path = [];
    for (let i = 0; i < 16; i++) {
      await sleep(120);
      const w = await J(() => {
        const c = window.Cast3D._world().cam;
        const t = window.Cast3D.shot().at;
        return [c.x, c.y, c.z, +t.fov.toFixed(1), +t.roll.toFixed(1)];
      });
      path.push({ t: Date.now() - t0, p: w });
    }
    // metres per second, timestamped, so each leg can be placed inside or
    // outside the move it is supposed to be measuring
    const legs = path.slice(1).map((s, i) => {
      const a = path[i].p, b = s.p;
      const dt = (s.t - path[i].t) / 1000;
      return { at: s.t, v: +(Math.hypot(b[0]-a[0], b[1]-a[1], b[2]-a[2]) / dt).toFixed(3) };
    });
    const OVER = 3200;
    const inside = legs.filter(l => l.at > 900 && l.at < OVER);
    const after = legs.filter(l => l.at > OVER + 400);
    const avg = (xs) => xs.length ? (xs.reduce((a, b) => a + b.v, 0) / xs.length).toFixed(3) : 'n/a';
    console.log('\n' + name);
    console.log('  eye', JSON.stringify(path[path.length - 1].p), 'at', path[path.length - 1].t + 'ms');
    console.log('  legs', JSON.stringify(legs.map(l => l.at + ':' + l.v)));
    console.log('  m/s while the bar is running:', avg(inside), ' after it:', avg(after));
  }
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
