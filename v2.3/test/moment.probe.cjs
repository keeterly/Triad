'use strict';
const { boot } = require('./harness.cjs');
(async () => {
  const { page, J, browser } = await boot({ query: 'cast=3d' });
  page.on('pageerror', e => console.log('!! PAGE ERROR:', e.message));
  await page.waitForFunction(() => window.Cast3D && window.Cast3D._state().ready,
    null, { timeout: 30000 }).catch(() => console.log('!! never ready'));
  const r = await J(async () => {
    const f = async (n) => { for (let i = 0; i < n; i++) await new Promise(x => requestAnimationFrame(x)); };
    const at = () => { const w = window.Cast3D._world().cam; return [+w.x.toFixed(2), +w.y.toFixed(2), +w.z.toFixed(2)]; };
    window.Cast3D.shot('home', { speed: 40 }); await f(50);
    const home = at();
    // THE HARNESS RUNS AT TWO FRAMES A SECOND, so counting frames counts
    // seconds by accident: forty of them is twenty seconds, and a 700ms borrow
    // is long over before the measurement is taken. Wall clock, not frames.
    window.Cast3D.shot('strike', { for: 30000, speed: 40 }); await f(45);
    const during = at();
    const holding = window.Cast3D.shot().holding;
    window.Cast3D.shot('strike', { for: 120, speed: 40 });
    await new Promise(x => setTimeout(x, 400)); await f(45);
    const after = at();
    return { home, during, after, holding, base: window.Cast3D.shot().base.az };
  });
  console.log(JSON.stringify(r));
  for (const s of ['strike','grace','fell','snap']) {
    await J(async (n) => { window.Cast3D.shot(n, { speed: 40 });
      for (let i = 0; i < 55; i++) await new Promise(x => requestAnimationFrame(x)); }, s);
    await page.screenshot({ path: 'shots/act-' + s + '.png' });
  }
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
