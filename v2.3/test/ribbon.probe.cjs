'use strict';
// THE ARC, PHOTOGRAPHED. A blade trail is judged by looking at it, so this
// drives a swing and takes the picture — and, because a shader that fails to
// compile is silent in three.js beyond one console line, it also asserts that
// both passes of the arc are on screen and that the refraction pass was handed
// a frame of world to bend.
const { boot } = require('./harness.cjs');
(async () => {
  const { page, J, sleep, browser, shot } = await boot({ query: 'cast=3d' });
  const LOUD = process.argv.includes('--loud');
  const errs = [];
  page.on('pageerror', e => errs.push('PAGE ' + e.message));
  page.on('console', m => { const t = m.text();
    if (/THREE|shader|WebGL|GLSL/i.test(t)) errs.push('CONSOLE ' + t.slice(0, 400)); });
  await sleep(600);
  await J(() => startCombat({ foes: ['husk'] }));
  for (let i = 0; i < 40 && !(await J(() => !!(window.Cast3D && window.Cast3D._figure('ash')))); i++) await sleep(250);

  await J(() => window.Cast3D.play('ash', 'slash'));
  const seen = [];
  for (let i = 0; i < 8; i++) {
    await sleep(120);
    seen.push(await J(() => {
      const fx = window.Cast3D._fx && window.Cast3D._fx();
      const r = fx && fx.ribbons && fx.ribbons.ash;
      if (!r) return null;
      return { light: r.mesh.visible, air: r.air.visible,
               fade: +r.mat.uniforms.uFade.value.toFixed(3),
               behind: !!r.refMat.uniforms.uScene.value,
               filled: r.filled };
    }));
  }
  // …AND THEN LOOK AT IT. The trail fades at 3.6/s and this browser draws at
  // about two frames a second, so by the time a screenshot lands the arc is at
  // 1% opacity — a picture of nothing. A first attempt pinned the uniform from
  // outside the loop and photographed an empty frame anyway, because `step()`
  // runs every frame BEFORE the render and writes the fade back from its own
  // counter. So the counter is what gets held, by handing step a dt of zero.
  await J((loud) => { window.__loud = loud; }, LOUD);
  await J(() => {
    const C3 = window.Cast3D, fx = C3._fx(), f = C3._figure('ash');
    const a = f.actions.sword || f.actions[Object.keys(f.actions)[0]];
    const r = fx.ribbonFor('ash');
    for (const k of Object.keys(f.actions)) { f.actions[k].setEffectiveWeight(0); f.actions[k].stop(); }
    if (f.idle) f.idle.setEffectiveWeight(0);
    a.reset(); a.setEffectiveWeight(1); a.play(); a.paused = true;
    f.acting = a; f.holdFrac = 0; f.fxVerb = 'slash';
    // walk the blade through the middle of the stroke, sampling as it goes, so
    // the ribbon holds a whole arc rather than the four stale points left over
    r.clear();
    const dur = a.getClip().duration;
    for (let i = 0; i < 20; i++) {
      a.time = dur * (0.10 + 0.32 * (i / 19));
      f.mixer.update(0); f.root.updateMatrixWorld(true);
      fx.trail('ash', f, 1 / 60);
    }
    // hold it: dt 0 decays nothing, so the arc stays at full strength for the
    // photograph while everything else about the frame is untouched
    const step = r.step.bind(r);
    r.fade = 1;
    r.step = () => { r.fade = 1; step(0); };
    // IS IT EVEN ON SCREEN? A ribbon that reports itself visible with a full
    // fade and draws nothing is either somewhere else or too dim to see, and
    // those want opposite fixes. Flooding it with one impossible colour
    // separates them in one photograph.
    if (window.__loud) {
      r.mat.uniforms.uHot.value.setRGB(4, 0, 0);
      r.mat.uniforms.uCool.value.setRGB(4, 0, 0);
    }
    window.__ribbon = () => {
      const p = r.geo.attributes.position.array;
      let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9], span = 0;
      for (let i = 0; i < p.length; i += 3)
        for (let c = 0; c < 3; c++) { lo[c] = Math.min(lo[c], p[i + c]); hi[c] = Math.max(hi[c], p[i + c]); }
      for (let c = 0; c < 3; c++) span = Math.max(span, hi[c] - lo[c]);
      // ── HOW JAGGED IS IT? ────────────────────────────────────────────
      // "Jaggedy" is a corner, and a corner is a turn between two consecutive
      // segments of the strip. Walking the tip's own edge of the ribbon and
      // taking the angle at each joint gives the number: a chain of raw
      // per-frame samples turns sharply at every one of them, a spline through
      // the same samples spreads the same total turn over five times as many
      // joints and so turns a fifth as hard at each.
      const turn = [];
      const N = p.length / 6;
      const pt = (i) => [p[i * 6 + 3], p[i * 6 + 4], p[i * 6 + 5]];   // the tip edge
      for (let i = 1; i < N - 1; i++) {
        const a2 = pt(i - 1), b2 = pt(i), c2 = pt(i + 1);
        const u = [b2[0] - a2[0], b2[1] - a2[1], b2[2] - a2[2]];
        const w = [c2[0] - b2[0], c2[1] - b2[1], c2[2] - b2[2]];
        const lu = Math.hypot(...u), lw = Math.hypot(...w);
        if (lu < 1e-6 || lw < 1e-6) continue;
        const d = (u[0] * w[0] + u[1] * w[1] + u[2] * w[2]) / (lu * lw);
        turn.push(Math.acos(Math.max(-1, Math.min(1, d))) * 180 / Math.PI);
      }
      // …and the same walk at the CONTROL POINTS ONLY, which is the strip the
      // old geometry drew. Same swing, same frame, one number each: the before
      // and the after of the spline, without having to trust two runs.
      const raw = [];
      for (let i = 5; i < N - 5; i += 5) {
        const a2 = pt(i - 5), b2 = pt(i), c2 = pt(i + 5);
        const u = [b2[0] - a2[0], b2[1] - a2[1], b2[2] - a2[2]];
        const w = [c2[0] - b2[0], c2[1] - b2[1], c2[2] - b2[2]];
        const lu = Math.hypot(...u), lw = Math.hypot(...w);
        if (lu < 1e-6 || lw < 1e-6) continue;
        const d = (u[0] * w[0] + u[1] * w[1] + u[2] * w[2]) / (lu * lw);
        raw.push(Math.acos(Math.max(-1, Math.min(1, d))) * 180 / Math.PI);
      }
      raw.sort((x, y) => y - x);
      turn.sort((x, y) => y - x);
      return { filled: r.filled, fade: +r.mat.uniforms.uFade.value.toFixed(2),
               light: r.mesh.visible, air: r.air.visible,
               verts: N,
               worstTurn: +(turn[0] || 0).toFixed(1),
               p95Turn: +(turn[Math.floor(turn.length * 0.05)] || 0).toFixed(1),
               worstRaw: +(raw[0] || 0).toFixed(1),
               box: lo.map((v, c) => +(hi[c] - v).toFixed(3)),
               at: lo.map((v, c) => +((v + hi[c]) / 2).toFixed(2)) };
    };
  });
  await sleep(1400);
  console.log('posed arc:', JSON.stringify(await J(() => window.__ribbon())));
  await shot('ribbon-swing');
  const live = seen.filter(Boolean);
  const lit = live.filter(s => s.light);
  const bent = live.filter(s => s.air);
  console.log(JSON.stringify(live, null, 0).replace(/\},/g, '},\n '));
  console.log('');
  console.log('frames with the light pass drawn : ' + lit.length + '/' + live.length);
  console.log('frames with the air  pass drawn : ' + bent.length + '/' + live.length);
  console.log('a frame of world to bend        : ' + (live.some(s => s.behind) ? 'yes' : 'NO'));
  console.log(errs.length ? '!! ' + errs.length + ' error(s):\n  ' + errs.slice(0, 6).join('\n  ')
                          : 'no shader or page errors');
  await browser.close();
  process.exit(errs.length || !lit.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
