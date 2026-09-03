'use strict';
const { boot } = require('./harness.cjs');
(async () => {
  const { page, J, browser } = await boot({ query: 'cast=3d' });
  await page.waitForFunction(() => window.Cast3D && window.Cast3D._state().ready,
    null, { timeout: 30000 }).catch(() => console.log('!! never ready'));
  const fps = () => J(async () => {
    for (let i = 0; i < 4; i++) await new Promise(r => requestAnimationFrame(r));
    const t0 = performance.now();
    for (let i = 0; i < 14; i++) await new Promise(r => requestAnimationFrame(r));
    return +(14000 / (performance.now() - t0)).toFixed(2);
  });
  console.log('devicePixelRatio', await J(() => window.devicePixelRatio));
  console.log('dpr 2 (buffer 1864x860)  ', await fps());
  await J(() => { const P = window.Cast3D._parts();
    P.renderer.setPixelRatio(1); P.renderer.setSize(932, 430, false); });
  console.log('dpr 1 (buffer  932x430)  ', await fps());
  await J(() => { const P = window.Cast3D._parts();
    P.renderer.setPixelRatio(0.5); P.renderer.setSize(932, 430, false); });
  console.log('dpr 0.5(buffer 466x215)  ', await fps());
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
