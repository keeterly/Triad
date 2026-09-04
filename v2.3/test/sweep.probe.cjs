'use strict';
// WHICH WAY DOES A PARRY GO? The note carries a direction (CLAW <-) and the
// defender has one clip. Before mirroring anything, measure the clip: sample
// the sword hand through the parry and report its travel along the figure's own
// lateral axis (+ = toward that figure's right hand side).
const { boot } = require('./harness.cjs');
(async () => {
  const { page, J, sleep, browser } = await boot({ query: 'cast=3d' });
  page.on('pageerror', e => console.log('!! PAGE ERROR:', e.message));
  await sleep(600);
  await J(() => startCombat({ foes: ['husk'] }));
  for (let i = 0; i < 40 && !(await J(() => !!(window.Cast3D && window.Cast3D._figure('mira')))); i++) await sleep(250);

  const out = await J(({ who, verbs }) => {
    const C3 = window.Cast3D;
    const f = C3._figure(who);
    if (!f) return { err: 'no figure ' + who };
    const wp = (b) => { b.updateWorldMatrix(true, false);
                        const e = b.matrixWorld.elements; return [e[12], e[13], e[14]]; };
    // …and where that lands ON SCREEN, which is the only frame the arrow on the
    // note is drawn in. Done by hand: the page has no THREE to borrow.
    const parts = C3._parts();
    const mul = (m, v) => { const e = m.elements, o = [];
      for (let r = 0; r < 4; r++) o[r] = e[r] * v[0] + e[4 + r] * v[1] + e[8 + r] * v[2] + e[12 + r] * v[3];
      return o; };
    const sx = (p3) => { parts.cam.updateMatrixWorld();
      const v = mul(parts.cam.projectionMatrix, mul(parts.cam.matrixWorldInverse, [p3[0], p3[1], p3[2], 1]));
      return v[3] ? v[0] / v[3] : 0; };
    // the figure's own lateral axis, read off the skeleton at rest
    const L = f.bones.LeftShoulder || f.bones.LeftArm;
    const R = f.bones.RightShoulder || f.bones.RightArm;
    if (!L || !R) return { err: 'no shoulders' };
    // BOTH HANDS. A mirrored guard sweeps with the OTHER arm, so reading one
    // wrist reports two identical numbers for two opposite motions — which is
    // exactly what the first cut of this probe did.
    const LH = f.bones.LeftHand, RH = f.bones.RightHand;

    if (f.idle) f.idle.setEffectiveWeight(0);
    const report = {};
    let lat = null;
    for (const verb of verbs) {
    const bar = verb.indexOf('|');
    const clip = C3._verbClip(who, bar < 0 ? verb : verb.slice(0, bar), bar < 0 ? null : verb.slice(bar + 1));
    const a = f.actions[clip];
    if (!a) { report[verb] = { err: 'no action ' + clip }; continue; }
    for (const k of Object.keys(f.actions)) f.actions[k].setEffectiveWeight(0);
    a.reset(); a.setEffectiveWeight(1); a.play(); a.paused = true;
    const dur = a.getClip().duration;
    const N = 21, samples = [];
    for (let i = 0; i < N; i++) {
      a.time = dur * (i / (N - 1));
      f.mixer.update(0);
      f.root.updateMatrixWorld(true);
      if (lat == null) {
        const lp = wp(L), rp = wp(R);
        const v = [rp[0] - lp[0], 0, rp[2] - lp[2]];
        const m = Math.hypot(v[0], v[2]) || 1;
        lat = [v[0] / m, 0, v[2] / m];
      }
      const l = wp(LH), r = wp(RH);
      const g = [(l[0] + r[0]) / 2, (l[1] + r[1]) / 2, (l[2] + r[2]) / 2];
      samples.push({ t: +(i / (N - 1)).toFixed(2),
                     side: g[0] * lat[0] + g[2] * lat[2],
                     sx: sx(g), y: g[1],
                     lx: sx(l), rx: sx(r), ly: l[1], ry: r[1] });
    }
    const col = (k) => samples.map(s => s[k]);
    const side = col('side'), y = col('y'), scr = col('sx');
    // the FURTHEST the hand gets from where it started, signed — a parry comes
    // home, so an end-to-end reading of one is always zero and says nothing
    const far = (a) => +(a.reduce((b, v) => Math.abs(v - a[0]) > Math.abs(b - a[0]) ? v : b, a[0]) - a[0]).toFixed(4);
    report[verb] = { clip, dur: +dur.toFixed(2),
             // the guard — the point between the hands — is what a parry puts
             // between the body and the blow, so that is the thing to measure
             farSide: far(side), farScreen: far(scr),
             // a parry goes out and comes back, so ONE extreme hides half the
             // motion: the pull-back guard reaches forward before it drags
             screenOut: +(Math.max(...scr) - scr[0]).toFixed(4),
             screenBack: +(Math.min(...scr) - scr[0]).toFixed(4),
             lift: +(Math.max(...y) - y[0]).toFixed(3),
             hands: { L: far(col('lx')), R: far(col('rx')) },
             reach: +(Math.max(...col('lx').map(Math.abs), ...col('rx').map(Math.abs))).toFixed(3) };
    a.setEffectiveWeight(0); a.stop();
    }
    return { who, lateral: [+lat[0].toFixed(2), +lat[2].toFixed(2)], report };
  }, { who: process.argv[2] || 'ash', verbs: (process.argv[3] || 'parry,slash,cast,ward,hurt,down').split(',') });
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
