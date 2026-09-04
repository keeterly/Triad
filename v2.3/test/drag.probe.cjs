'use strict';
// The whole gesture, with a real pointer: press a card, drag it onto the SECOND
// enemy, let go, and see which one lost health.
const { boot } = require('./harness.cjs');
(async () => {
  const { page, J, sleep, browser } = await boot({ query: process.argv[2] || 'cast=3d' });
  page.on('pageerror', e => console.log('!! PAGE ERROR:', e.message));
  await sleep(600);
  await J(() => startCombat({ foes: ['husk', 'husk'] }));
  await sleep(2600);

  for (const tapFirst of [false, true]) {
    await J(() => { C.aim = 0; });
    const setup = await J((tf) => {
      const card = (C.hand || []).find(id => cardDef(id).target === 'enemy');
      const btn = document.querySelector('.k-card[data-card="' + card + '"]');
      const el2 = document.querySelector('#k-cast .k-foe-art[data-ix="1"]');
      const br = btn.getBoundingClientRect(), tr = el2.getBoundingClientRect();
      return { card, from: [br.left + br.width / 2, br.top + 14],
               to: [tr.left + tr.width / 2, tr.top + tr.height * 0.45],
               hp: (C.foes || []).map(f => f.hp), aim: C.aim };
    }, tapFirst);
    if (tapFirst) {          // tap to select first, then drag
      await page.mouse.click(setup.from[0], setup.from[1]);
      await sleep(360);
    }
    await page.mouse.move(setup.from[0], setup.from[1]);
    await page.mouse.down();
    await sleep(60);
    await page.mouse.move(setup.from[0] + 30, setup.from[1] - 40, { steps: 4 });
    await sleep(60);
    await page.mouse.move(setup.to[0], setup.to[1], { steps: 10 });
    await sleep(220);
    const mid = await J(() => {
      const s = document.querySelector('.k-aim-snap');
      return { snap: s ? ('ix=' + (s.dataset.ix || '0')) : null };
    });
    await page.mouse.up();
    await sleep(900);
    const after = await J(() => ({ hp: (C.foes || []).map(f => f.hp), aim: C.aim }));
    console.log((tapFirst ? 'tap then drag' : 'plain drag   '),
                'aim', setup.aim, '->', after.aim,
                ' hp', JSON.stringify(setup.hp), '->', JSON.stringify(after.hp),
                ' snap', JSON.stringify(mid.snap));
  }
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
