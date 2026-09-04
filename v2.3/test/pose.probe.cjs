'use strict';
// IS THE BODY STILL A BODY. Poses every clip in the library at eight phases and
// reads the real world positions off the posed skeleton: how far the trunk is
// from vertical, and how far the lower foot is off the paving.
//
// THIS IS THE INSTRUMENT THAT FOUND THE BROKEN IMPORT. The importer's own gate
// asks how far the furthest joint TURNED, and the angle of a rotation does not
// change when you change the frame you measure it in — so a clip converted into
// entirely the wrong axes turns exactly as far as one converted correctly, and
// the gate read healthy over a party folded in half. What cannot be faked is
// where the head ends up relative to the hips once the pose is on the rig.
//
//   node test/pose.probe.cjs [who]
const { boot } = require('./harness.cjs');
(async () => {
  const { page, J, sleep, browser } = await boot({ query: 'cast=3d' });
  page.on('pageerror', e => console.log('!! PAGE ERROR:', e.message));
  await sleep(600);
  await J(() => startCombat({ foes: ['husk'] }));
  const who = process.argv[2] || 'ash';
  for (let i = 0; i < 40 && !(await J(w => !!(window.Cast3D && window.Cast3D._figure(w)), who)); i++) await sleep(250);

  const out = await J(async (who) => {
    const C3 = window.Cast3D, f = C3._figure(who);
    const B = {};
    f.root.traverse(o => { if (o.isBone) B[o.name] = o; });
    const wp = (n) => { const o = B[n]; if (!o) return null;
      const m = o.matrixWorld.elements; return [m[12], m[13], m[14]]; };
    const res = {};
    for (const clip of Object.keys(f.actions)) {
      const a = f.actions[clip], dur = a.getClip().duration;
      const row = [];
      for (let i = 0; i < 8; i++) {
        for (const k of Object.keys(f.actions)) { f.actions[k].setEffectiveWeight(0); f.actions[k].stop(); }
        if (f.idle) f.idle.setEffectiveWeight(0);
        a.reset(); a.setEffectiveWeight(1); a.play(); a.paused = true;
        a.time = dur * (i / 7) * 0.999;
        f.mixer.update(0);
        f.root.updateMatrixWorld(true);
        const h = wp('Hips'), hd = wp('Head'), lf = wp('LeftFoot'), rf = wp('RightFoot');
        if (!h || !hd) { row.push(null); continue; }
        const v = [hd[0] - h[0], hd[1] - h[1], hd[2] - h[2]];
        const L = Math.hypot(v[0], v[1], v[2]) || 1;
        row.push({ lean: +(Math.acos(Math.max(-1, Math.min(1, v[1] / L))) * 180 / Math.PI).toFixed(0),
                   foot: +Math.min(lf ? lf[1] : 9, rf ? rf[1] : 9).toFixed(2) });
      }
      res[clip] = row;
    }
    for (const k of Object.keys(f.actions)) { f.actions[k].paused = false; f.actions[k].setEffectiveWeight(0); f.actions[k].stop(); }
    f.acting = null; if (f.idle) f.idle.setEffectiveWeight(1);
    return res;
  }, who);

  console.log('\n' + who + ' — degrees the trunk is off vertical, at eight phases of each clip');
  for (const [k, row] of Object.entries(out))
    console.log('  ' + k.padEnd(14) + row.map(r => r ? String(r.lean).padStart(5) : '  ---').join(''));
  console.log('\n' + who + ' — metres the LOWER foot is off the paving');
  for (const [k, row] of Object.entries(out))
    console.log('  ' + k.padEnd(14) + row.map(r => r ? r.foot.toFixed(2).padStart(6) : '   ---').join(''));
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
