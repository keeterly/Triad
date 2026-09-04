'use strict';
// Does time actually dilate where the fight is? Slowing must reach the 3D
// world, not just pause CSS keyframes — measure how far a bone travels in a
// fixed slice of REAL time, slow versus normal.
const { boot } = require('./harness.cjs');
(async () => {
  const { page, J, sleep, browser } = await boot({ query: 'cast=3d' });
  page.on('pageerror', e => console.log('!! PAGE ERROR:', e.message));
  await page.waitForFunction(() => window.Cast3D && window.Cast3D._state().ready, null, { timeout: 60000 });
  await J(() => startCombat({ foes: ['mourner'] }));
  await sleep(2400);

  const travel = async (label) => {
    await J(() => window.Cast3D.play('ash', 'slash'));
    await sleep(260);
    const a = await J(() => { const w = window.Cast3D._figure('ash').bones.RightHand;
      return w.getWorldPosition(w.position.clone()).toArray(); });
    const t0 = Date.now();
    await sleep(700);
    const b = await J(() => { const w = window.Cast3D._figure('ash').bones.RightHand;
      return w.getWorldPosition(w.position.clone()).toArray(); });
    const ms = Date.now() - t0;
    const d = Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]);
    const st = await J(() => window.Cast3D._state().slow);
    console.log(label.padEnd(10), 'slow', String(st).padStart(5),
                ' wrist moved', d.toFixed(3), 'm in', ms + 'ms');
    return d;
  };
  const fast = await travel('normal');
  await J(() => parrySlowmo(true));
  await sleep(500);
  const slow = await travel('dilated');
  await J(() => parrySlowmo(false));
  console.log('\nratio', (slow / Math.max(1e-4, fast)).toFixed(2), '(1.0 = no dilation at all)');
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
