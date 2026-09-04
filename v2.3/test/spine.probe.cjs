'use strict';
// Hips>Spine drifts up to 9.7% during a swing. A rotation cannot change the
// distance between a parent and a child, so something is SCALING. Ask the
// bones directly: their world scale, their local scale, and the distance.
const { boot } = require('./harness.cjs');
(async () => {
  const { page, J, browser } = await boot({ query: 'cast=3d' });
  page.on('pageerror', e => console.log('!! PAGE ERROR:', e.message));
  await page.waitForFunction(() => window.Cast3D && window.Cast3D._state().ready, null, { timeout: 60000 });
  const out = await J(async () => {
    const C3 = window.Cast3D; C3.disable();
    const f = C3._figure('ash');
    const V = f.root.position.constructor;
    f.clear(); f.play(C3._verbClip('ash', 'slash'));
    const DT = 1 / 60;
    for (let i = 0; i < 10; i++) f.step(DT);
    const rows = [];
    for (let i = 0; i < 60; i++) {
      f.step(DT);
      f.root.updateWorldMatrix(true, true);
      const H = f.bones.Hips, S = f.bones.Spine;
      const hp = H.getWorldPosition(new V()), sp = S.getWorldPosition(new V());
      const hs = H.getWorldScale(new V()), ss = S.getWorldScale(new V());
      const q = H.quaternion;
      rows.push({
        d: +hp.distanceTo(sp).toFixed(5),
        localOff: +Math.hypot(S.position.x, S.position.y, S.position.z).toFixed(5),
        hipsWorldScale: [+hs.x.toFixed(5), +hs.y.toFixed(5), +hs.z.toFixed(5)],
        uniform: Math.abs(hs.x - hs.y) < 1e-6 && Math.abs(hs.y - hs.z) < 1e-6,
        spineWorldScale: [+ss.x.toFixed(5), +ss.y.toFixed(5), +ss.z.toFixed(5)],
        hipsLocalScale: +H.scale.x.toFixed(4),
        qLen: +Math.sqrt(q.x*q.x + q.y*q.y + q.z*q.z + q.w*q.w).toFixed(5),
      });
    }
    f.clear();
    await C3.enable();
    const d = rows.map(r => r.d);
    return { min: Math.min(...d), max: Math.max(...d),
             drift: +(((Math.max(...d) - Math.min(...d)) / Math.min(...d)) * 100).toFixed(1),
             first: rows[0], worst: rows[d.indexOf(Math.max(...d))],
             localOffVaries: new Set(rows.map(r => r.localOff)).size > 1,
             scaleVaries: new Set(rows.map(r => r.hipsWorldScale.join(','))).size > 1,
             everUniform: rows.every(r => r.uniform) };
  });
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
