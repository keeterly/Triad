'use strict';
const { boot } = require('./harness.cjs');
(async () => {
  const { page, J, browser } = await boot({ query: 'cast=3d' });
  page.on('pageerror', e => console.log('!! PAGE ERROR:', e.message));
  await page.waitForFunction(() => window.Cast3D && window.Cast3D._state().ready,
    null, { timeout: 30000 }).catch(() => console.log('!! never ready'));
  await J(async () => {
    const c = document.getElementById('k-cast');
    for (const k of ['x','y','dz']) c.style.setProperty('--cam-'+k, '0px');
    for (const k of ['r','yaw','pitch']) c.style.setProperty('--cam-'+k, '0deg');
    for (let i = 0; i < 30; i++) await new Promise(r => requestAnimationFrame(r));
  });
  for (const s of (process.argv[2] || 'home,duel,parry,allout,reckoning').split(',')) {
    const info = await J(async (name) => {
      const spec = /^-?\d/.test(name) ? { az: Number(name) } : name;
      window.Cast3D.shot(spec, { speed: 40 });
      for (let i = 0; i < 60; i++) await new Promise(r => requestAnimationFrame(r));
      const w = window.Cast3D._world();
      return { cam: w.cam, behind: Object.keys(w.actors).filter(k => w.actors[k].screen.behind),
               xs: Object.fromEntries(Object.keys(w.actors).map(k => [k, w.actors[k].screen.x])) };
    }, s);
    console.log(s.padEnd(10), 'cam', JSON.stringify(info.cam), 'behind', JSON.stringify(info.behind));
    await page.screenshot({ path: 'shots/orbit-' + s + '.png' });
  }
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
