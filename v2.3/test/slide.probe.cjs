'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// WHY THE BODIES SLIDE
// ═══════════════════════════════════════════════════════════════════════════
//
// Two different things get called sliding and they want opposite fixes, so the
// first job is to tell them apart:
//
//   ROOT DRIFT — the clip's own hips travel across the floor and never come
//   back, so the figure ends the swing somewhere it did not start and the slot
//   ease drags it home over the following second. The drag has no footsteps in
//   it at all; that part is unambiguous sliding.
//
//   FOOT SKATE — the foot that is carrying the body's weight moves through the
//   ground while it is planted. That is the clip's own fault and cancelling the
//   root motion would make it WORSE, not better, because a genuine stride needs
//   its travel.
//
// So this measures both, per clip: how far the root drifts, and how far the
// planted foot slides while planted. A clip with drift and no skate is stepping
// honestly and the drift is the problem. A clip with skate is gliding and the
// travel is a lie the root motion is covering for.
//
// The mixer is stepped BY HAND — `a.time = t; mixer.update(0)` — rather than
// left to run against the clock. This browser draws at about two frames a
// second and every wall-clock-paced reading taken in this suite has had to be
// thrown away; sampling the clip at its own times has no such problem and is
// exactly reproducible.
const { boot } = require('./harness.cjs');

(async () => {
  const { page, J, sleep, browser } = await boot({ query: (process.env.SLIDE_Q || 'cast=3d') });
  page.on('pageerror', e => console.log('!! PAGE ERROR:', e.message));
  await sleep(600);
  await J(() => startCombat({ foes: ['husk'] }));
  for (let i = 0; i < 40 && !(await J(() => !!(window.Cast3D && window.Cast3D._figure('ash')))); i++)
    await sleep(250);

  const who = process.argv[2] || 'ash';
  const SAMPLES = +(process.argv[3] || 48);
  const ENDS = (process.argv[4] || '1').split(',').map(Number);

  for (const END of ENDS) {
  await J((e) => { window.__slideEnd = e; }, END);
  const rows = await J(({ who, SAMPLES }) => {
    const C3 = window.Cast3D;
    const f = C3._figure(who);
    if (!f) return { err: 'no figure ' + who };
    const names = Object.keys(f.actions);
    const out = [];
    // read a bone's world x/y/z straight off its matrix, so no THREE global is
    // needed in here — the page's three is a module and this is the page
    const wp = (b) => { const e = b.matrixWorld.elements; return { x: e[12], y: e[13], z: e[14] }; };
    for (const name of names) {
      const a = f.actions[name];
      const dur = a.getClip().duration;
      for (const k of Object.keys(f.actions)) { f.actions[k].setEffectiveWeight(0); f.actions[k].stop(); }
      if (f.idle) f.idle.setEffectiveWeight(0);
      a.reset(); a.setEffectiveWeight(1); a.play(); a.paused = true;

      const L = f.bones.LeftToeBase || f.bones.LeftFoot;
      const R = f.bones.RightToeBase || f.bones.RightFoot;
      const H = f.bones.Hips;
      if (!L || !R || !H) return { err: 'missing bones' };

      // …AND OVER A PREFIX OF THE CLIP, NOT ONLY THE WHOLE OF IT. A mocap
      // attack is a strike followed by the actor walking out of frame, and the
      // window this layer plays takes the lot. Sampling a prefix says where the
      // strike stops and the walking starts, which is the number a window wants.
      const END = +(window.__slideEnd || 1);
      // …THROUGH THE SAME PATH THE FIGHT USES. Posing the mixer by hand and
      // reading the bones measures the CLIP; the fight also runs a foot solver
      // after the mixer every frame, and a probe that skips it would grade the
      // animation while the game draws something else. It is called here with
      // the sample interval as its dt, exactly as the frame loop calls it, and
      // it obeys the same ?foot=off switch so before and after are one session.
      const step = dur * END / (SAMPLES - 1);
      const ik = window.Cast3D._footIK();
      const hip = [], lf = [], rf = [];
      for (let i = 0; i < SAMPLES; i++) {
        a.time = (i / (SAMPLES - 1)) * dur * END;
        f.mixer.update(0);
        f.root.updateMatrixWorld(true);
        if (ik) f.footLock(step);
        f.root.updateMatrixWorld(true);
        hip.push(wp(H)); lf.push(wp(L)); rf.push(wp(R));
      }
      f.floorY = undefined;      // each clip is its own ground, not the last one's
      const d = (p, q) => Math.hypot(p.x - q.x, p.z - q.z);
      // ROOT DRIFT: where the hips end relative to where they began, on the
      // floor plane. Net, not total — a body that steps out and steps back has
      // travelled and drifted nothing, which is what a clip should do.
      const drift = d(hip[SAMPLES - 1], hip[0]);
      // …and the largest excursion on the way, so a clip that lunges a metre
      // and returns is told apart from one that never moves.
      let reach = 0;
      for (const h of hip) reach = Math.max(reach, d(h, hip[0]));

      // FOOT SKATE: a foot is PLANTED when it is within 3cm of its own lowest
      // point over the clip — its own, because the two feet do not reach the
      // same height and a shared threshold would call one of them planted for
      // the whole clip. While planted, any horizontal movement is skate.
      // ── THE SUPPORT FOOT IS THE MEASUREMENT ──────────────────────────────
      //
      // A first cut called a foot "planted" when it was within 3cm of its own
      // lowest point and summed how far it moved while it was. That reading is
      // too loose to trust: during a fast lunge a foot can lift, swing and land
      // between two samples with both of them low, and the whole STEP is then
      // counted as slide. It reported a 17.5 m/s peak on a sword swing, which
      // is not a foot sliding, it is a foot walking, sampled coarsely.
      //
      // A body on its feet always has one of them still. So at every instant
      // take the SLOWER of the two feet: during a real step that is the support
      // foot and it is near zero, and it is only large when BOTH feet are
      // moving over the ground — which is exactly and only what gliding is. No
      // plant detection, no threshold, nothing to tune.
      // …EXCEPT WHEN NOBODY IS ON THE GROUND. Both feet moving is only sliding
      // if one of them is supposed to be carrying the body. swordHeavy is a
      // LEAP — it has no frame with a foot down at all — and reading it as a
      // 14 m/s slide was the metric calling flight a fault. A frame counts only
      // while the lower foot is within 12cm of the lowest either foot reaches
      // in the clip; above that the figure is in the air and owes nobody a
      // planted foot.
      const dt = dur / (SAMPLES - 1);
      const sp = (p, q) => d(p, q) / dt;
      const floor = Math.min(...lf.map(p => p.y), ...rf.map(p => p.y));
      let glideSum = 0, glidePeak = 0, air = 0, ground = 0;
      for (let i = 1; i < SAMPLES; i++) {
        const low = Math.min(lf[i].y, rf[i].y);
        if (low - floor > 0.12) { air++; continue; }
        ground++;
        const g = Math.min(sp(lf[i], lf[i - 1]), sp(rf[i], rf[i - 1]));
        glideSum += g * dt; glidePeak = Math.max(glidePeak, g);
      }
      // THE FLOOR REFERENCE ITSELF, reported. `airborne` is measured against
      // the lowest either foot reaches in this clip — so anything that moves a
      // foot DOWN lowers that reference and reclassifies ordinary frames as
      // flight, which would quietly drop them out of the glide sum and fake an
      // improvement. Printing the reference is how that is told apart from a
      // real one.
      const lowY = Math.min(...lf.map(p => p.y), ...rf.map(p => p.y));
      const hiY = Math.max(...lf.map(p => p.y), ...rf.map(p => p.y));
      out.push({ name, dur: +dur.toFixed(2), drift: +drift.toFixed(3), reach: +reach.toFixed(3),
                 glide: +glideSum.toFixed(3), peak: +glidePeak.toFixed(2),
                 floor: +lowY.toFixed(3), rise: +(hiY - lowY).toFixed(3),
                 air: Math.round(100 * air / Math.max(1, air + ground)) });
    }
    return { who, out };
  }, { who, SAMPLES });

  if (rows.err) { console.log('ERR', rows.err); await browser.close(); process.exit(1); }
  console.log('');
  console.log('=== figure ' + rows.who + '  ·  first ' + Math.round(END * 100)
    + '% of each clip  ·  metres, ' + SAMPLES + ' samples ===');
  console.log('');
  console.log('  ' + 'clip'.padEnd(14) + 'dur'.padStart(6) + 'drift'.padStart(8)
    + 'reach'.padStart(8) + '   glide m' + '  peak m/s' + '  airborne');
  const bad = [];
  for (const r of rows.out.sort((a, b) => b.drift - a.drift)) {
    const flag = r.drift > 0.15 ? '  <-- DRIFTS' : '';
    if (r.drift > 0.15) bad.push(r.name);
    console.log('  ' + r.name.padEnd(14) + String(r.dur).padStart(6)
      + r.drift.toFixed(3).padStart(8) + r.reach.toFixed(3).padStart(8)
      + r.glide.toFixed(3).padStart(10) + r.peak.toFixed(2).padStart(10)
      + (r.air + '%').padStart(10)
      + r.floor.toFixed(3).padStart(8) + r.rise.toFixed(3).padStart(8) + flag);
  }
  console.log('');
  console.log(bad.length
    ? 'clips whose root never comes home: ' + bad.join(', ')
    : 'no clip drifts more than 15cm');
  }
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
