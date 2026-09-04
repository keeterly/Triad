'use strict';
// After a creature burns away, does its PAINTING come back? The reckoning
// screenshot showed the Grief-Wraith standing there whole, in 2D, under a
// banner reading FALLEN.
const { boot } = require('./harness.cjs');
(async () => {
  const { page, J, sleep, browser } = await boot({ query: 'cast=3d' });
  page.on('pageerror', e => console.log('!! PAGE ERROR:', e.message));
  await page.waitForFunction(() => window.Cast3D && window.Cast3D._state().ready, null, { timeout: 60000 });
  await J(() => window.Cast3D.warm());
  await J(() => startCombat({ foes: ['wraith'] }));
  await sleep(2600);

  const read = () => J(() => {
    const el = document.getElementById('k-boss-art');
    const f = window.Cast3D._figure('foe0');
    return { on3d: el.classList.contains('k-cast3d-on'),
             paint: getComputedStyle(el.querySelector('img')).opacity,
             body: !!f && f.root.visible, dead: !!(f && f.dead),
             burn: f && f.burn != null ? +f.burn.toFixed(2) : null };
  });
  console.log('alive      ', JSON.stringify(await read()));
  await J(() => window.Cast3D.fell('foe0'));
  await sleep(900);
  console.log('mid-burn   ', JSON.stringify(await read()));
  await sleep(3200);
  console.log('burned away', JSON.stringify(await read()));
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
