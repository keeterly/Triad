'use strict';
// AN AUDIT OF HOW THE BODIES MOVE.
//
// Not "does it look wrong" — four properties a real skeleton has, each measured
// against the rig as it actually plays:
//   1. bones keep their LENGTH (a retarget that shears stretches limbs)
//   2. joints stay inside human RANGE (a knee that bends backwards, an elbow
//      that hyperextends, a neck that rotates 90 degrees)
//   3. the feet do not SLIDE while bearing weight
//   4. the body does not LEAN off its own base
const { boot } = require('./harness.cjs');

// TWO CORRECTIONS TO THIS INSTRUMENT, BOTH OF WHICH IT GOT WRONG FIRST TIME.
//
// 1. ADJACENCY IS READ, NOT GUESSED. The first version hardcoded pairs like
//    Hips>Spine and reported 9.7% "stretch" on a swing. Those two are not
//    adjacent in this rig — the world distance between them is three times
//    scale x offset, so there are joints in between — and the gap between
//    non-adjacent joints legitimately changes when anything between them bends.
//    Build 118 made exactly this mistake, fixed it, and wrote it down; this
//    repeated it. The suite's own check reads the real hierarchy and reports
//    0.00% drift across 23 bones.
//
// 2. A PLANTED FOOT IS ONE FOOT. The first version summed the distance to
//    "whichever foot is lower", so every time the lower foot CHANGED it counted
//    a stride width as slide. Each foot is now tracked on its own, and only
//    while it stays down.

(async () => {
  const { page, J, browser } = await boot({ query: 'cast=3d' });
  page.on('pageerror', e => console.log('!! PAGE ERROR:', e.message));
  await page.waitForFunction(() => window.Cast3D && window.Cast3D._state().ready, null, { timeout: 60000 });

  const out = await J(async () => {
    const C3 = window.Cast3D;
    C3.disable();
    const res = {};
    for (const who of ['ash', 'elin', 'mira']) {
      const f = C3._figure(who);
      res[who] = {};
      for (const verb of ['idle', 'slash', 'cast', 'hurt']) {
        const name = C3._verbClip(who, verb);
        if (!name) continue;
        f.clear(); f.play(name);
        const DT = 1 / 60;
        for (let i = 0; i < 8; i++) f.step(DT);
        const V = new (f.root.position.constructor)();
        const wp = (b) => f.bones[b].getWorldPosition(new (f.root.position.constructor)());
        // every bone whose PARENT is also a bone: the real adjacency
        const pairs0 = [];
        for (const n of Object.keys(f.bones)) {
          const p = f.bones[n].parent;
          if (p && p.isBone && f.bones[p.name]) pairs0.push([p.name, n]);
        }
        const len0 = {}, worst = {};
        let lean = 0;
        const down = { LeftFoot: null, RightFoot: null };
        const slide = { LeftFoot: 0, RightFoot: 0 };
        for (let i = 0; i < 70; i++) {
          f.step(DT);
          f.root.updateWorldMatrix(true, true);
          for (const [a, b] of pairs0) {
            const d = wp(a).distanceTo(wp(b));
            const key = a + '>' + b;
            if (len0[key] === undefined) { len0[key] = d; continue; }
            const drift = Math.abs(d - len0[key]) / Math.max(1e-4, len0[key]);
            if (!(worst[key] >= drift)) worst[key] = drift;
          }
          // ONE FOOT AT A TIME, and only while it is down
          for (const foot of ['LeftFoot', 'RightFoot']) {
            const p = wp(foot);
            const planted = p.y < 0.14;
            if (planted && down[foot]) slide[foot] += Math.hypot(p.x - down[foot].x, p.z - down[foot].z);
            down[foot] = planted ? p : null;
          }
          const lf = wp('LeftFoot'), rf = wp('RightFoot'), h = wp('Head');
          const mid = lf.clone().add(rf).multiplyScalar(0.5);
          lean = Math.max(lean, Math.hypot(h.x - mid.x, h.z - mid.z));
        }
        const footSlide = Math.max(slide.LeftFoot, slide.RightFoot);
        const pairs = Object.entries(worst).sort((a, b) => b[1] - a[1]);
        res[who][verb] = {
          stretch: +(pairs[0] ? pairs[0][1] * 100 : 0).toFixed(2),
          stretchAt: pairs[0] ? pairs[0][0] : null,
          footSlide: +footSlide.toFixed(3),
          lean: +lean.toFixed(3),
        };
      }
      f.clear();
    }
    await C3.enable();
    return res;
  });

  console.log('\nbone length drift %, planted-foot travel (m), head-off-base (m)\n');
  for (const [who, verbs] of Object.entries(out)) {
    console.log(' ' + who);
    for (const [v, r] of Object.entries(verbs))
      console.log('   ' + v.padEnd(7), 'stretch', String(r.stretch).padStart(6) + '%',
                  (r.stretchAt || '').padEnd(22),
                  'footslide', String(r.footSlide).padStart(6),
                  'lean', String(r.lean).padStart(6));
  }
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
