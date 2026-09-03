'use strict';
const { boot } = require('./harness.cjs');
(async () => {
  const { page, J, browser } = await boot({ query: 'cast=3d' });
  page.on('pageerror', e => console.log('!! PAGE ERROR:', e.message));
  await page.waitForFunction(() => window.Cast3D && window.Cast3D._state().ready,
    null, { timeout: 30000 }).catch(() => console.log('!! never ready'));

  // QUIET THE RIG FIRST. The camera eases toward whatever --cam-* says, and the
  // fight sets those; measuring the lens while a push is in flight measures the
  // push. Zero them and let the ease settle.
  await J(async () => {
    const c = document.getElementById('k-cast');
    for (const k of ['x','y','dz','r','yaw','pitch']) c.style.setProperty('--cam-'+k, k==='r'||k==='yaw'||k==='pitch' ? '0deg' : '0px');
    for (let i = 0; i < 90; i++) await new Promise(r => requestAnimationFrame(r));
  });

  const w = await J(() => window.Cast3D._world());
  console.log('cam', JSON.stringify(w.cam), 'ground', w.ground, 'shadows', w.shadows);
  for (const id of Object.keys(w.actors)) {
    const a = w.actors[id];
    console.log(`  ${id.padEnd(8)} world(${a.x}, ${a.y}, ${a.z}) tall ${a.tall}  ->  screen x ${a.screen.x} ground ${a.screen.ground} h ${a.screen.h}`);
  }

  // SOLVE THE LENS FROM THE PICTURE. Two probe points at known world positions
  // give the focal length and the principal point the projection is ACTUALLY
  // using, whatever the constants intended.
  const probe = await J(() => {
    const b = document.getElementById('k-cast').getBoundingClientRect();
    const out = [];
    for (const [X, Y, Z] of [[0,0,0],[1,0,0],[0,0,-1],[0,1,0],[-2,0,0]]) {
      const v = new window.__THREE.Vector3(X, Y, Z);
      out.push({ w: [X,Y,Z], s: window.Cast3D._project(v, b) });
    }
    return out;
  }).catch(() => null);
  if (probe) console.log('probe', JSON.stringify(probe));

  // WHAT DOES A FRAME COST NOW? Four scissored renders became one, but the one
  // carries a floor and a shadow map.
  const fps = await J(async () => {
    const t0 = performance.now();
    for (let i = 0; i < 120; i++) await new Promise(r => requestAnimationFrame(r));
    return 120000 / (performance.now() - t0);
  });
  console.log('frames/sec (headless, ~1/3 real):', fps.toFixed(1));

  await page.screenshot({ path: 'shots/world119.png' });
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
