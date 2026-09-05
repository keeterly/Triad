'use strict';
// THE BLOW, PHOTOGRAPHED. A flash lives for a sixth of a second and this
// browser draws at about two frames a second, so a screenshot taken after a
// real hit lands on an empty frame every time. The blow is fired and then the
// effects are stepped BY HAND at 60Hz up to the moment worth looking at —
// the same trick the ribbon probe uses, for the same reason.
const { boot } = require('./harness.cjs');
(async () => {
  const { page, J, sleep, browser, shot } = await boot({ query: 'cast=3d' });
  const errs = [];
  page.on('pageerror', e => errs.push('PAGE ' + e.message));
  page.on('console', m => { const t = m.text();
    if (/THREE|shader|WebGL|GLSL/i.test(t)) errs.push('CONSOLE ' + t.slice(0, 300)); });
  await sleep(600);
  await J(() => startCombat({ foes: ['husk'] }));
  for (let i = 0; i < 40 && !(await J(() => !!(window.Cast3D && window.Cast3D._figure('ash')))); i++) await sleep(250);
  // …AND WAIT FOR THE FOE TOO. A creature is fetched and mounted separately
  // from the party, so a blow fired the moment Ash exists lands on empty floor
  // — which is a picture of the effect working and of the probe not.
  for (let i = 0; i < 60 && !(await J(() => !!(window.Cast3D._figure('foe0')))); i++) await sleep(250);

  const at = +(process.argv[2] || 0.05);      // seconds after the blow to look

  // ── FREEZE THE CLOCK FIRST, THEN STRIKE ────────────────────────────────
  //
  // The render loop steps the effects too, and this browser draws at about two
  // frames a second — so a flash with a sixth of a second to live is over
  // before the next paint, whatever order the rest of this runs in. The real
  // `step` is kept aside to drive by hand; the one the loop calls is stubbed to
  // a zero delta, which freezes every timer while leaving the billboarding to
  // the camera the loop already passes in.
  await J(() => {
    const fx = window.Cast3D._fx();
    window.__step = fx.step.bind(fx);
    fx.step = (dt, cam, px) => window.__step(0, cam, px);
  });

  const r = await J(({ at }) => {
    const C3 = window.Cast3D, fx = C3._fx();
    const foe = C3._figure('foe0') || C3._figure('husk');
    const ash = C3._figure('ash');
    if (!fx || !ash) return { err: 'no cast' };
    // a point out in front of the foe's chest, and the blow going away from Ash
    const p = (foe ? foe.root.position : ash.root.position).clone();
    p.y += 1.15; p.x -= 0.55;
    const dir = p.clone().sub(ash.root.position).setY(0.25).normalize();
    const before = fx.flashes.fired;
    fx.hit(p, dir, 'slash', 1.6);
    // …and walk it forward by hand to the instant worth looking at
    const STEP = 1 / 60;
    for (let t = 0; t < at; t += STEP) window.__step(STEP, C3._cam(), 600);
    const lit = fx.flashes.items.filter(i => i.t > 0);
    return { err: null, at,
             flashesFired: fx.flashes.fired - before,
             flashesLive: lit.length,
             opacity: lit.length ? +lit[0].mat.opacity.toFixed(3) : 0,
             scale: lit.length ? +lit[0].mesh.scale.x.toFixed(3) : 0,
             cuts: fx.cuts.items.filter(i => i.t > 0).length,
             rings: fx.shocks.items.filter(i => i.t > 0).length,
             at3: [p.x.toFixed(2), p.y.toFixed(2), p.z.toFixed(2)] };
  }, { at });
  if (r.err) { console.log('ERR', r.err); await browser.close(); process.exit(1); }

  await sleep(1200);
  await shot('impact-slash');
  console.log(JSON.stringify(r));
  console.log(errs.length ? '!! ' + errs.length + ' error(s):\n  ' + errs.slice(0, 5).join('\n  ')
                          : 'no shader or page errors');
  await browser.close();
  process.exit(errs.length || !r.flashesFired ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
