'use strict';
// The reported bug: two Hollow Husks on the board, both painted plates, no
// bodies. Build a board with two of the same creature and count the bodies.
const { boot } = require('./harness.cjs');
(async () => {
  const { page, J, sleep, browser } = await boot({ query: 'cast=3d' });
  page.on('pageerror', e => console.log('!! PAGE ERROR:', e.message));
  await page.waitForFunction(() => window.Cast3D && window.Cast3D._state().ready, null, { timeout: 60000 });
  await J(() => window.Cast3D.warm());

  await J(() => startCombat({ foes: ['husk', 'husk'] }));
  await sleep(2600);
  const two = await J(() => {
    const st = window.Cast3D._state(), w = window.Cast3D._world();
    const els = [...document.querySelectorAll('#k-cast [data-foe]')].map(n => ({
      foe: n.dataset.foe, ix: n.dataset.ix || '0',
      on3d: n.classList.contains('k-cast3d-on'),
      paint: n.querySelector('img') ? getComputedStyle(n.querySelector('img')).opacity : null,
    }));
    return { foes: st.foes, wearing: st.wearing, els,
             at: Object.fromEntries(st.foes.map(k => [k,
               [+w.actors[k].x.toFixed(2), +w.actors[k].z.toFixed(2), w.actors[k].visible]])) };
  });
  console.log('two husks:', JSON.stringify(two, null, 1));

  // and a mixed line
  await J(() => startCombat({ foes: ['husk', 'wraith', 'cultist'] }));
  await sleep(3000);
  const three = await J(() => {
    const st = window.Cast3D._state(), w = window.Cast3D._world();
    return { foes: st.foes, wearing: st.wearing,
             at: Object.fromEntries(st.foes.map(k => [k,
               [+w.actors[k].x.toFixed(2), +w.actors[k].z.toFixed(2), +w.actors[k].tall.toFixed(2)]])) };
  });
  console.log('mixed:', JSON.stringify(three, null, 1));

  // back to one, and the extra bodies must go
  await J(() => startCombat({ foes: ['mourner'] }));
  await sleep(2600);
  console.log('back to one:', JSON.stringify(await J(() => {
    const st = window.Cast3D._state(); return { foes: st.foes, wearing: st.wearing };
  })));
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
