'use strict';
// Does a creature actually come apart? Count the pixels it occupies as the
// burn advances — not the uniform, the picture.
const { boot } = require('./harness.cjs');
(async () => {
  const { page, J, sleep, browser } = await boot({ query: 'cast=3d' });
  page.on('pageerror', e => console.log('!! PAGE ERROR:', e.message));
  await page.waitForFunction(() => window.Cast3D && window.Cast3D._state().ready, null, { timeout: 60000 });
  await J(() => window.Cast3D.warm());
  await sleep(600);

  // COUNT THE BODY, DO NOT WEIGH A PICTURE OF IT. `_cover` renders the figure
  // alone into a small target and counts the pixels it covers — ground truth,
  // and immune to both ways the PNG proxy lied.
  const tall = await J(() => {
    const f = window.Cast3D._figure('foe0');
    const u = f.root.userData.mat.userData;
    return { uTall: +u.tall.value.toFixed(3), uFoot: +u.foot.value.toFixed(3),
             worldH: +f.worldH.toFixed(3), scale: +f.root.scale.x.toFixed(3) };
  });
  console.log('body, as measured off the geometry:', JSON.stringify(tall));
  const cover = await J(() => {
    const C3 = window.Cast3D, f = C3._figure('foe0');
    f.dead = false; f.burn = null; f.mixer.timeScale = 0;
    const u = f.root.userData.mat.userData;
    const out = [];
    for (const b of [0, 0.2, 0.4, 0.6, 0.8, 1.0]) {
      u.burn.value = b;
      out.push([b, C3._cover('foe0')]);
    }
    u.burn.value = 0; f.mixer.timeScale = 1;
    return out;
  });
  const whole = cover[0][1] || 1;
  for (const [b, n] of cover)
    console.log('  burn', String(b).padStart(4), ' covered', String(n).padStart(6),
                'px  =', (n / whole * 100).toFixed(0) + '% of the body');

  const st = await J(() => window.Cast3D._state());
  console.log('state', JSON.stringify({ burning: st.burning, gone: st.gone, sparks: st.sparks }));

  // and the real thing, end to end
  await J(() => { const C3 = window.Cast3D; const f = C3._figure('foe0');
    f.dead = false; f.root.visible = true;
    const m = f.root.userData.mat; if (m) m.userData.burn.value = 0;
    C3.fell('foe0'); });
  for (let i = 0; i < 6; i++) {
    await sleep(420);
    const s = await J(() => { const x = window.Cast3D._state();
      const f = window.Cast3D._figure('foe0');
      return { burn: f.burn == null ? null : +f.burn.toFixed(2), gone: x.gone, sparks: x.sparks }; });
    console.log('  t' + i, JSON.stringify(s));
  }
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
