'use strict';
// During a parry, is the attack visible? Read the lights and the per-figure
// dim, and photograph the board.
const { boot } = require('./harness.cjs');
(async () => {
  const { page, J, sleep, browser, shot } = await boot({ query: 'cast=3d' });
  page.on('pageerror', e => console.log('!! PAGE ERROR:', e.message));
  await page.waitForFunction(() => window.Cast3D && window.Cast3D._state().ready, null, { timeout: 60000 });
  await J(() => window.Cast3D.warm());
  await J(() => startCombat({ foes: ['mourner'] }));
  await sleep(2600);
  const read = () => J(() => {
    const st = window.Cast3D._state();
    const sd = window.Cast3D._parts ? null : null;
    const lit = {};
    for (const k of st.figures) {
      const f = window.Cast3D._figure(k);
      lit[k] = +f.root.userData.mat.userData.lit.value.toFixed(2);
    }
    return { focus: st.focus, on: st.lit, lit };
  });
  console.log('before  ', JSON.stringify(await read()));
  await shot('focus-before');
  await J(() => parryFocus(true));
  await sleep(1400);
  console.log('parrying', JSON.stringify(await read()));
  await shot('focus-parry');
  await J(() => parryFocus(false));
  await sleep(1200);
  console.log('after   ', JSON.stringify(await read()));
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
