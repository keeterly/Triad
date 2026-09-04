'use strict';
// Fire a volley's worth of impacts as fast as they can land and count how many
// full-stage washes coexist. The sampler cannot catch a 200ms flash at two
// frames a second, so this asks the DOM directly, synchronously, mid-burst.
const { boot } = require('./harness.cjs');
(async () => {
  const { page, J, sleep, browser } = await boot({ query: process.argv[2] || 'cast=2d' });
  page.on('pageerror', e => console.log('!! PAGE ERROR:', e.message));
  await sleep(500);
  await J(() => startCombat({ foes: ['mourner'] }));
  await sleep(1800);
  const r = await J(() => {
    const stage = document.getElementById('k-stage');
    const hero = document.querySelector('.k-hero[data-hero="ash"]');
    let peakF = 0, peakP = 0;
    for (let i = 0; i < 6; i++) {
      fxImpact(hero, 2.0, 'hurt', 'l');
      peakF = Math.max(peakF, stage.querySelectorAll('.k-hitflash').length);
      peakP = Math.max(peakP, stage.querySelectorAll('.k-pulse').length);
    }
    return { flashes: peakF, pulses: peakP };
  });
  console.log('six impacts back to back →', JSON.stringify(r));
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
