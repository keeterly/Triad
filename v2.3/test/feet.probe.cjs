'use strict';
// The FEET check reduced to just its measurement, so the same number can be
// read on two builds without paying for 125 checks to find out which one moved
// it. It is a copy of the check's own body on purpose: a probe that measures
// something ADJACENT to the failing check answers a different question.
//
// It also reports what the check does not: how far into its clip each figure
// actually got in the 78 ticks. A slower clip covers less of itself in the same
// number of frames, and a slide total that grows while the covered fraction
// SHRINKS is a different fault from one that grows because there is more clip.
const { boot } = require('./harness.cjs');

(async () => {
  const { page, J, sleep, browser } = await boot({ query: (process.env.FEET_Q || 'cast=3d') });
  page.on('pageerror', e => console.log('!! PAGE ERROR:', e.message));
  await sleep(600);
  await J(() => startCombat({ foes: ['husk'] }));
  for (let i = 0; i < 40 && !(await J(() => !!(window.Cast3D && window.Cast3D._figure('ash')))); i++)
    await sleep(250);

  const out = await J(async () => {
    const C3 = window.Cast3D;
    const was = C3._state().on;
    C3.disable();
    const out = {};
    for (const who of ['ash', 'elin', 'mira']) {
      const f = C3._figure(who);
      const V = f.root.position.constructor;
      const wp = (b) => f.bones[b].getWorldPosition(new V());
      for (const verb of ['slash', 'hurt']) {
        const name = C3._verbClip(who, verb);
        if (!name) continue;
        f.clear(); f.play(name);
        const a = f.actions[name];
        const dur = a.getClip().duration;
        const DT = 1 / 60;
        const tick = () => { f.step(DT); if (window.Cast3D._footIK()) f.footLock(DT); };
        for (let i = 0; i < 8; i++) tick();
        const x0 = f.root.position.x, z0 = f.root.position.z;
        const down = { LeftFoot: null, RightFoot: null };
        const slide = { LeftFoot: 0, RightFoot: 0 };
        // …and the single worst STEP inside the sum. A slide of 2m built from
        // 70 crawling frames is a foot grinding along the floor; one built from
        // three 60cm jumps is the plant detector catching a foot mid-stride and
        // calling the stride a slide. The total cannot tell them apart.
        const worst = { LeftFoot: 0, RightFoot: 0 };
        let low = 0, n = 0;
        for (let i = 0; i < 70; i++) {
          tick();
          f.root.updateWorldMatrix(true, true);
          for (const foot of ['LeftFoot', 'RightFoot']) {
            const p = wp(foot);
            const planted = p.y < 0.14;
            if (planted) { low++; }
            n++;
            if (planted && down[foot]) {
              const d = Math.hypot(p.x - down[foot].x, p.z - down[foot].z);
              slide[foot] += d;
              worst[foot] = Math.max(worst[foot], d);
            }
            down[foot] = planted ? p : null;
          }
        }
        out[who + '.' + verb] = {
          slide: +Math.max(slide.LeftFoot, slide.RightFoot).toFixed(3),
          worstStep: +Math.max(worst.LeftFoot, worst.RightFoot).toFixed(3),
          body: +Math.hypot(f.root.position.x - x0, f.root.position.z - z0).toFixed(3),
          dur: +dur.toFixed(2),
          // how much of the clip the 78 ticks actually walked through
          covered: +(a.time / dur).toFixed(2),
          plantPct: Math.round(100 * low / n),
        };
      }
      f.clear();
    }
    if (was) await C3.enable();
    return out;
  });

  console.log('');
  console.log('  ' + 'figure.verb'.padEnd(14) + 'slide'.padStart(8) + 'worstStep'.padStart(11)
    + 'body'.padStart(8) + 'dur'.padStart(7) + 'covered'.padStart(9) + 'planted'.padStart(9));
  for (const [k, v] of Object.entries(out))
    console.log('  ' + k.padEnd(14) + v.slide.toFixed(3).padStart(8)
      + v.worstStep.toFixed(3).padStart(11) + v.body.toFixed(3).padStart(8)
      + v.dur.toFixed(2).padStart(7) + v.covered.toFixed(2).padStart(9)
      + (v.plantPct + '%').padStart(9));
  console.log('');
  console.log('  gate is slide < 1.2 on every row');
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
