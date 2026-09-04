'use strict';
// Do the effects exist in the WORLD — sparks alive, an arc drawing, a ring
// expanding — and do they actually change the picture?
const { boot } = require('./harness.cjs');
(async () => {
  const { page, J, sleep, browser } = await boot({ query: 'cast=3d' });
  page.on('pageerror', e => console.log('!! PAGE ERROR:', e.message));
  await page.waitForFunction(() => window.Cast3D && window.Cast3D._state().ready, null, { timeout: 60000 });
  await J(() => window.Cast3D.warm());

  console.log('idle       ', JSON.stringify(await J(() => {
    const s = window.Cast3D._state(); return { sparks: s.sparks, trails: s.trails, rings: s.rings };
  })));

  // ── THE TRAIL, AT A TIMESTEP THIS MACHINE DOES NOT CHOOSE ──────────────
  //
  // A weapon trail is built from samples of where the blade was, so how many
  // it gets is a function of the frame rate — and this harness rasterises in
  // software at about two frames a second. Watching the real loop would
  // measure Chromium. So: drive the figure and the trail by hand at 60 Hz and
  // ask how long the arc actually is in metres.
  const arc = await J(() => {
    const C3 = window.Cast3D, fx = C3._fx();
    C3.disable();
    const f = C3._figure('ash');
    f.clear(); f.play(C3._verbClip('ash', 'slash')); f.fxVerb = 'slash';
    if (fx.ribbons.ash) fx.ribbons.ash.clear();
    const DT = 1 / 60;
    for (let i = 0; i < 40; i++) { f.step(DT); fx.trail('ash', f, DT); }
    const r = fx.ribbons.ash;
    if (!r) return { built: false };
    // how far the leading edge travelled across the samples it kept
    let span = 0;
    for (let i = 1; i < r.filled; i++) {
      const a = r.pts[(r.head + i - 1) % r.n].b, b = r.pts[(r.head + i) % r.n].b;
      span += a.distanceTo(b);
    }
    return { built: true, visible: r.mesh.visible, samples: r.filled,
             sweptMetres: +span.toFixed(3), opacity: +r.mat.opacity.toFixed(3) };
  });
  console.log('slash arc  ', JSON.stringify(arc));
  await J(() => window.Cast3D.enable());
  await sleep(400);

  for (const verb of ['slash', 'cast', 'heal', 'ward']) {
    await J((v) => window.Cast3D.play('ash', v), verb);
    await sleep(260);
    const mid = await J(() => {
      const s = window.Cast3D._state(); return { sparks: s.sparks, trails: s.trails };
    });
    await J((v) => window.Cast3D.hit('foe0', v, 1.6, 'ash'), verb);
    await sleep(160);
    const hit = await J(() => {
      const s = window.Cast3D._state(); return { sparks: s.sparks, rings: s.rings };
    });
    console.log(verb.padEnd(10), 'while swinging', JSON.stringify(mid), ' on impact', JSON.stringify(hit));
    await sleep(1400);
  }
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
