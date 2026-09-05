'use strict';
// THE SAME FRAME, FOUR WAYS. A percentage says the detector fires on the right
// pixels; it does not say the picture is better. These are for looking at:
// the plain render, the contour alone, the banded tone alone, and the three
// of them together as they ship.
const { boot } = require('./harness.cjs');
const LOOKS = {
  off:   { line: 0, flat: 0, tooth: 0 },
  ink:   { line: 0.85, linew: 1.15, bite: 0.03, reach: 14, flat: 0, tooth: 0 },
  drawn: { line: 0.85, linew: 1.15, bite: 0.03, reach: 14, flat: 0.30, steps: 6, tooth: 0.04 },
  bold:  { line: 1.0,  linew: 1.35, bite: 0.025, reach: 16, flat: 0.45, steps: 5, tooth: 0.06 },
};
(async () => {
  const { J, sleep, browser, shot, page } = await boot({ query: 'cast=3d' });
  page.on('pageerror', e => console.log('!! PAGE ERROR:', e.message));
  await sleep(600);
  await J(() => startCombat({ foes: ['husk', 'husk'] }));
  for (let i = 0; i < 40 && !(await J(() => !!(window.Cast3D && window.Cast3D._figure('mira')))); i++) await sleep(250);
  await sleep(500);
  for (const name of (process.argv[2] || 'off,mask,ink,band,drawn').split(',')) {
    await J(l => window.Cast3D.look(l), LOOKS[name]);
    await sleep(350);
    await shot('look-' + name);
    console.log(name, JSON.stringify(LOOKS[name]));
  }
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
