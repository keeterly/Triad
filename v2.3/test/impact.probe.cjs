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
    const ash = C3._figure('ash');
    if (!fx || !ash) return { err: 'no cast' };

    // ── FILL THE TRAIL FIRST, BECAUSE THE TRAIL IS THE POINT ───────────────
    //
    // A first version called `fx.hit(...)` straight, which takes the no-path
    // fallback and draws the old flat mark — it was photographing the branch
    // the fix does not use. The blow has to arrive the way it does in a fight:
    // a swing plays, the ribbon records the blade, and the layer's own `hit`
    // reads that record. So pose the stroke and sample it, exactly as a real
    // frame would, then call the API the game calls.
    const a2 = ash.actions.sword || ash.actions[Object.keys(ash.actions)[0]];
    for (const k of Object.keys(ash.actions)) { ash.actions[k].setEffectiveWeight(0); ash.actions[k].stop(); }
    if (ash.idle) ash.idle.setEffectiveWeight(0);
    a2.reset(); a2.setEffectiveWeight(1); a2.play(); a2.paused = true;
    ash.acting = a2; ash.holdFrac = 0; ash.fxVerb = 'slash';
    fx.ribbonFor('ash').clear();
    const dur = a2.getClip().duration;
    for (let i = 0; i < 18; i++) {
      a2.time = dur * (0.08 + 0.26 * (i / 17));
      ash.mixer.update(0); ash.root.updateMatrixWorld(true);
      fx.trail('ash', ash, 1 / 60);
    }
    const rib = fx.ribbons.ash;

    const before = { flash: fx.flashes.fired, clash: fx.clash.fired, cut: fx.cuts.fired };
    const landed = C3.hit('foe0', 'slash', 1.6, 'ash');
    const STEP = 1 / 60;
    for (let t = 0; t < at; t += STEP) window.__step(STEP, C3._cam(), 600);

    // how bent is the crescent actually drawn? sagitta over chord: 0 is a
    // straight line, and anything a player would call an arc is well above it
    let bend = 0;
    const live = fx.clash.items.filter(i => i.t > 0)[0];
    if (live) {
      const p = live.pos, N = p.length / 6, mid = (v, i) => (p[i * 6 + v] + p[i * 6 + 3 + v]) / 2;
      const P = (i) => [mid(0, i), mid(1, i), mid(2, i)];
      const A = P(0), B = P(N - 1), M = P(Math.floor(N / 2));
      const ch = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]);
      const mx = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2];
      const sg = Math.hypot(M[0] - mx[0], M[1] - mx[1], M[2] - mx[2]);
      bend = ch > 1e-6 ? sg / ch : 0;
    }
    const lit = fx.flashes.items.filter(i => i.t > 0);
    return { err: null, at, landed, ribbon: rib ? rib.filled : 0,
             flashesFired: fx.flashes.fired - before.flash,
             clashFired: fx.clash.fired - before.clash,
             flatCuts: fx.cuts.fired - before.cut,
             bend: +bend.toFixed(3),
             opacity: lit.length ? +lit[0].mat.opacity.toFixed(3) : 0 };
  }, { at });
  if (r.err) { console.log('ERR', r.err); await browser.close(); process.exit(1); }

  await sleep(1200);
  await shot('impact-slash');
  console.log(JSON.stringify(r));
  console.log(errs.length ? '!! ' + errs.length + ' error(s):\n  ' + errs.slice(0, 5).join('\n  ')
                          : 'no shader or page errors');
  await browser.close();
  // a curve drawn from the real path, and NOT the flat fallback
  const ok = r.flashesFired > 0 && r.clashFired > 0 && r.flatCuts === 0 && r.bend > 0.02;
  console.log(ok ? 'the mark is a curve off the blade\'s own path'
                 : '!! the impact did not draw the recorded arc');
  process.exit(errs.length || !ok ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
