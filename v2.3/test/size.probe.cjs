'use strict';
// How many PIXELS is a spark, actually? The formula is size/distance times
// pixels-per-metre-at-one-metre, so this reads the live uniform and works out
// what the shader will produce for a real ember at a real distance.
const { boot } = require('./harness.cjs');
(async () => {
  const { page, J, sleep, browser } = await boot({ query: 'cast=3d' });
  page.on('pageerror', e => console.log('!! PAGE ERROR:', e.message));
  await page.waitForFunction(() => window.Cast3D && window.Cast3D._state().ready, null, { timeout: 60000 });
  await sleep(700);
  const r = await J(() => {
    const F = window.Cast3D._fx();
    const uPx = F.sparks.mat.uniforms.uPx.value;
    const px = (metres, dist) => Math.min(96, metres * uPx / dist);
    return {
      uPx: +uPx.toFixed(1),
      stageH: window.Cast3D._world().cam ? 430 : 430,
      spark_at_7m: +px(0.055, 7).toFixed(1),
      spark_at_4m: +px(0.055, 4).toFixed(1),
      biggest_ash_at_5m: +px(0.085, 5).toFixed(1),
      // what Build 127 produced, for the record
      old_at_7m: +(26 * (430 * 1 * 0.5) / 7).toFixed(0),
    };
  });
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
