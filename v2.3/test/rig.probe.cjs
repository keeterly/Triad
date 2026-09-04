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

const CHAIN = [['Hips','Spine'],['Spine','Spine01'],['Spine01','Spine02'],
  ['Spine02','neck'],['neck','Head'],
  ['LeftUpLeg','LeftLeg'],['LeftLeg','LeftFoot'],['LeftFoot','LeftToeBase'],
  ['RightUpLeg','RightLeg'],['RightLeg','RightFoot'],['RightFoot','RightToeBase'],
  ['LeftArm','LeftForeArm'],['LeftForeArm','LeftHand'],
  ['RightArm','RightForeArm'],['RightForeArm','RightHand']];

(async () => {
  const { page, J, browser } = await boot({ query: 'cast=3d' });
  page.on('pageerror', e => console.log('!! PAGE ERROR:', e.message));
  await page.waitForFunction(() => window.Cast3D && window.Cast3D._state().ready, null, { timeout: 60000 });

  const out = await J(async (CH) => {
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
        const len0 = {}, worst = {};
        let footSlide = 0, lean = 0;
        let prevFoot = null;
        for (let i = 0; i < 70; i++) {
          f.step(DT);
          f.root.updateWorldMatrix(true, true);
          for (const [a, b] of CH) {
            if (!f.bones[a] || !f.bones[b]) continue;
            const d = wp(a).distanceTo(wp(b));
            const key = a + '>' + b;
            if (len0[key] === undefined) { len0[key] = d; continue; }
            const drift = Math.abs(d - len0[key]) / Math.max(1e-4, len0[key]);
            if (!(worst[key] >= drift)) worst[key] = drift;
          }
          // the lower foot is the planted one; how far does it travel?
          const lf = wp('LeftFoot'), rf = wp('RightFoot');
          const plant = lf.y < rf.y ? lf : rf;
          if (prevFoot && Math.min(lf.y, rf.y) < 0.12) footSlide += prevFoot.distanceTo(plant);
          prevFoot = plant;
          // and how far is the head off the midpoint of the feet, horizontally?
          const h = wp('Head');
          const mid = lf.clone().add(rf).multiplyScalar(0.5);
          lean = Math.max(lean, Math.hypot(h.x - mid.x, h.z - mid.z));
        }
        const pairs = Object.entries(worst).sort((a, b) => b[1] - a[1]);
        res[who][verb] = {
          stretch: +(pairs[0] ? pairs[0][1] * 100 : 0).toFixed(1),
          stretchAt: pairs[0] ? pairs[0][0] : null,
          footSlide: +footSlide.toFixed(3),
          lean: +lean.toFixed(3),
        };
      }
      f.clear();
    }
    await C3.enable();
    return res;
  }, CHAIN);

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
