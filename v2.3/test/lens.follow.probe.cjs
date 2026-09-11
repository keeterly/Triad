'use strict';
// HOW DOES THE CAMERA LEAVE ITS MARK, AND HOW DOES IT ARRIVE?
//
// A first-order lag — x += (want - x) * (1 - e^(-rate*dt)) — has its MAXIMUM
// velocity at t=0 and decays from there. It can only ease OUT. So a cut to a
// new shot starts at full speed and the move reads as a snap followed by a
// drift, which is exactly "jittery". A critically damped spring starts at rest,
// accelerates, and decelerates into the mark: it eases in AND out.
//
// The measurement is the VELOCITY PROFILE, not the rate constant: where in the
// move is the camera fastest? At 0% it is a lag. Somewhere in the middle it is
// a spring. And that question is frame-rate independent, because the rig is
// stepped by hand at a fixed dt.
const { boot } = require('./harness.cjs');
(async () => {
  const { page, J, sleep, browser } = await boot({ query: 'cast=3d' });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.waitForFunction(() => window.Cast3D && window.Cast3D._state().ready, null, { timeout: 60000 });
  await J(() => window.Cast3D.warm());
  await sleep(300);

  const profile = await J(() => {
    const C3 = window.Cast3D;
    // step the rig by hand at 60Hz so this machine's frame rate cannot decide
    // the shape of the curve
    const DT = 1 / 60;
    C3.shot('home');
    for (let i = 0; i < 400; i++) C3._rigStep(DT);     // settle on the mark
    const a = C3._tripod();
    C3.shot('snap', { for: 4000, speed: 2.1 });        // …and cut to a new one
    const path = [];
    for (let i = 0; i < 240; i++) { C3._rigStep(DT); path.push(C3._tripod().dist); }
    const b = path[path.length - 1];
    const span = Math.abs(b - a.dist) || 1;
    // per-step speed, normalised, and where the peak falls in the move
    const v = [];
    for (let i = 1; i < path.length; i++) v.push(Math.abs(path[i] - path[i - 1]) / DT);
    let peak = 0, peakAt = 0;
    v.forEach((s, i) => { if (s > peak) { peak = s; peakAt = i; } });
    // how long until 95% of the distance is covered
    let settle = -1;
    for (let i = 0; i < path.length; i++)
      if (Math.abs(path[i] - b) <= span * 0.05) { settle = i; break; }
    return { from: +a.dist.toFixed(3), to: +b.toFixed(3), span: +span.toFixed(3),
             peakSpeed: +peak.toFixed(3), peakAtMs: Math.round(peakAt * DT * 1000),
             peakAtPctOfMove: +(peakAt / Math.max(1, settle) * 100).toFixed(1),
             settle95Ms: settle < 0 ? null : Math.round(settle * DT * 1000),
             firstStepSpeed: +v[0].toFixed(3),
             speedAtStart: +(v[0] / peak).toFixed(3) };
  });
  console.log('dist channel', JSON.stringify(profile, null, 0));
  console.log('\nspeedAtStart is the tell: 1.0 = fastest on the first frame (a lag,');
  console.log('eases out only). Well under 1.0 = it builds (a spring, eases in too).');
  console.log('\npageErrors', errs.length, errs.slice(0, 2).join(' | '));
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
