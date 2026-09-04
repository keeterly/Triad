'use strict';
// Does aiming wind the hero up, does the drop finish the SAME swing rather than
// restarting it, and does a cancelled drag unwind?
const { boot } = require('./harness.cjs');
(async () => {
  const { page, J, sleep, browser } = await boot({ query: 'cast=3d' });
  page.on('pageerror', e => console.log('!! PAGE ERROR:', e.message));
  await page.waitForFunction(() => window.Cast3D && window.Cast3D._state().ready, null, { timeout: 60000 });

  // THE LAYER STAYS ON. An earlier version of this disabled it so it could
  // drive the mixer at a fixed timestep — and `ready` and `play` both refuse
  // when the layer is off, correctly, so it was measuring a figure that had
  // never been asked to do anything. The hold is time-based, so real time
  // works fine.
  const snap = () => J(() => {
    const f = window.Cast3D._figure('ash');
    return { holdFrac: f.holdFrac, held: f.held,
             acting: !!f.acting, verb: f.fxVerb,
             time: f.acting ? +f.acting.time.toFixed(3) : null,
             paused: f.acting ? f.acting.paused : null,
             dur: f.acting ? +f.acting.getClip().duration.toFixed(3) : null };
  });

  await J(() => window.Cast3D.play('ash', 'idle'));
  await sleep(400);
  await J(() => window.Cast3D.ready('ash', 'slash'));
  await sleep(1500);
  const held = await snap();
  console.log('winding up ', JSON.stringify(held));

  // it must BREATHE at the hold rather than freeze
  const a = await J(() => {
    const w = window.Cast3D._figure('ash').bones.RightHand;
    return w.getWorldPosition(w.position.clone()).toArray().map(v => +v.toFixed(4));
  });
  await sleep(500);
  const b = await J(() => {
    const w = window.Cast3D._figure('ash').bones.RightHand;
    return w.getWorldPosition(w.position.clone()).toArray().map(v => +v.toFixed(4));
  });
  const mm = Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]) * 1000;
  console.log('breath     ', mm.toFixed(1), 'mm at the wrist over half a second');

  // aiming at another target must not restart the wind-up
  // A RESTART IS A TRIP TO ZERO, NOT A WOBBLE. Comparing two samples of a
  // breathing hold cannot detect one: the tension oscillates the clip's time by
  // +/-42ms, so any threshold small enough to catch a restart is smaller than
  // the breath, and the first version of this check duly reported a working
  // hold as RESTARTED. `play` resets to 0, so that is what to look for.
  const before = await snap();
  await J(() => window.Cast3D.ready('ash', 'slash'));
  const after = await snap();
  const mark = before.dur * 0.34;
  console.log('re-aim     ', 'time', before.time, '->', after.time,
              ' (hold mark', mark.toFixed(3) + ', breath +/-0.042)',
              after.time < mark - 0.1 ? 'RESTARTED (bad)' : 'kept its place');

  // the drop finishes the same swing
  await J(() => window.Cast3D.play('ash', 'slash'));
  const rel = await snap();
  await sleep(600);
  const done = await snap();
  console.log('released   ', JSON.stringify(rel));
  console.log('and ran on ', JSON.stringify(done));

  // and a cancelled aim unwinds
  await sleep(1600);
  await J(() => window.Cast3D.ready('ash', 'slash'));
  await sleep(900);
  await J(() => window.Cast3D.unready('ash'));
  await sleep(200);
  console.log('cancelled  ', JSON.stringify(await snap()));
  const r = {};
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
