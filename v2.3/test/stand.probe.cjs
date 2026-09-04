'use strict';
// Is the cultist really floating, and is it stable? Report every figure's
// lowest joint and the frame `fit` measured for it.
const { boot } = require('./harness.cjs');
(async () => {
  const { page, J, browser } = await boot({ query: 'cast=3d' });
  page.on('pageerror', e => console.log('!! PAGE ERROR:', e.message));
  await page.waitForFunction(() => window.Cast3D && window.Cast3D._state().ready, null, { timeout: 60000 });
  await J(() => window.Cast3D.warm());
  const w = await J(() => {
    const out = {};
    const W = window.Cast3D._world();
    for (const id of Object.keys(W.actors)) {
      const f = window.Cast3D._figure(id);
      out[id] = { low: W.actors[id].lowestBone, tall: W.actors[id].tall,
                  viewH: +f.viewH.toFixed(3), midY: +f.midY.toFixed(3),
                  scale: +f.root.scale.x.toFixed(3), y: +f.root.position.y.toFixed(3) };
    }
    return out;
  });
  for (const [id, v] of Object.entries(w))
    console.log(id.padEnd(10), 'low', String(v.low).padStart(6), ' tall', String(v.tall).padStart(5),
                ' viewH', String(v.viewH).padStart(6), ' midY', String(v.midY).padStart(6),
                ' scale', String(v.scale).padStart(6), ' y', v.y);
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
