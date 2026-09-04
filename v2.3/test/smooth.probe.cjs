'use strict';
// ── HOW SMOOTH IS THE MOTION, INDEPENDENT OF HOW FAST THE PAGE DRAWS? ───────
//
// "Jittery" is a claim about the CLIP, not about the frame rate, and the two
// are easy to confuse in a harness that rasterises in software at two frames a
// second. So this does not watch the animation run. It turns the layer off so
// nothing else touches the mixer, then drives one figure's mixer by hand at a
// fixed timestep and reads the bones.
//
// The measurement: for each step, the angle a bone turns through gives its
// angular SPEED. The change in that speed between steps is its angular
// ACCELERATION. Motion that is smooth has acceleration that varies smoothly;
// motion that is a chain of straight-line interpolations between sparse keys
// has acceleration of nearly zero inside each key interval and a spike at every
// boundary — the corner you actually see on screen.
//
// So the number that matters is the RATIO of the worst acceleration to the
// typical one. A smooth curve sits near 1. A faceted one runs high, and the
// spikes arrive at exactly the key rate.
const { boot } = require('./harness.cjs');

(async () => {
  const { page, J, browser } = await boot({ query: 'cast=3d' });
  page.on('pageerror', e => console.log('!! PAGE ERROR:', e.message));
  await page.waitForFunction(() => window.Cast3D && window.Cast3D._state().ready,
    null, { timeout: 60000 });

  const verbs = ['slash', 'cast', 'ward', 'heal', 'parry', 'hurt', 'idle'];
  const out = await J(async (vs) => {
    const C3 = window.Cast3D;
    C3.disable();                       // nothing else drives the mixer now
    const f = C3._figure('ash');
    const res = {};
    const STEP = 1 / 240;               // finer than any key rate in play
    for (const v of vs) {
      const name = C3._verbClip('ash', v);
      if (!name) continue;
      f.clear(); f.play(name);
      // let the fade-in finish, so what is measured is the clip and not the blend
      for (let i = 0; i < 60; i++) f.step(STEP);
      // WHICH BONE, not just how much. A spike in a wrist can be the wrist or
      // anything above it in the chain; naming the joint is the difference
      // between a hypothesis and a place to look.
      const names = Object.keys(f.bones);
      const per = {};
      for (const n of names) per[n] = [];
      const track = [];
      const bone = f.bones.RightHand || f.bones.Hips;
      for (let i = 0; i < 480; i++) {   // two seconds at 240 Hz
        f.step(STEP);
        bone.updateWorldMatrix(true, false);
        // a Quaternion of the right class without reaching for the module
        const q = bone.quaternion.clone();
        bone.getWorldQuaternion(q);
        track.push(q);
        for (const n of names) per[n].push(f.bones[n].quaternion.clone());
      }
      // the worst LOCAL jump any single joint makes, and who made it
      let blame = null, blameV = 0, blameAt = 0;
      for (const n of names) {
        const s2 = per[n];
        for (let i = 2; i < s2.length; i++) {
          const a1 = 2 * Math.acos(Math.min(1, Math.abs(s2[i - 2].dot(s2[i - 1])))) / STEP;
          const a2v = 2 * Math.acos(Math.min(1, Math.abs(s2[i - 1].dot(s2[i])))) / STEP;
          const j = Math.abs(a2v - a1);
          if (j > blameV) { blameV = j; blame = n; blameAt = i * STEP; }
        }
      }
      // angular speed between consecutive samples
      const w = [];
      for (let i = 1; i < track.length; i++) {
        let d = Math.abs(track[i - 1].dot(track[i]));
        if (d > 1) d = 1;
        w.push(2 * Math.acos(d) / STEP);
      }
      // and the change in that speed — the acceleration
      const acc = [];
      for (let i = 1; i < w.length; i++) acc.push(Math.abs(w[i] - w[i - 1]));
      // WHERE the spikes are, before deciding what they are. A ratio computed
      // over two seconds cannot tell a faceted swing apart from one clean pop
      // at the moment the clip ends and the idle takes over — and those are
      // different bugs with different fixes.
      const worst = acc.map((v, i) => [+(i * STEP).toFixed(3), +v.toFixed(0)])
        .sort((p, q) => q[1] - p[1]).slice(0, 6);
      const sorted = acc.slice().sort((a, b) => a - b);
      const med = sorted[Math.floor(sorted.length / 2)] || 1e-9;
      const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;
      // where the spikes are: count crossings well above the typical value,
      // which for a linearly-keyed clip lands on the key rate
      const bar = med * 8;
      let spikes = 0;
      for (let i = 1; i < acc.length; i++) if (acc[i] > bar && acc[i - 1] <= bar) spikes++;
      res[v] = {
        clip: name,
        ratio: +(p99 / med).toFixed(1),
        spikesPerSec: +(spikes / (acc.length * STEP)).toFixed(1),
        peakSpeed: +Math.max(...w).toFixed(2),
        peakAt: +(w.indexOf(Math.max(...w)) * STEP).toFixed(3),
        worst,
        blame: blame + '@' + blameAt.toFixed(3) + ' = ' + blameV.toFixed(0),
      };
    }
    return res;
  }, verbs);

  console.log('\nangular acceleration, worst vs typical — high = faceted motion\n');
  for (const [v, r] of Object.entries(out))
    console.log(('  ' + v).padEnd(10), String(r.ratio).padStart(8),
                '  spikes/s', String(r.spikesPerSec).padStart(6),
                '  peak', String(r.peakSpeed).padStart(7), '@', String(r.peakAt).padStart(6),
                ' ', r.clip, '\n     worst at', JSON.stringify(r.worst),
                '\n     loudest joint:', r.blame);
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
