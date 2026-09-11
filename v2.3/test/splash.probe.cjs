'use strict';
// WHERE DID THE IMPACT BURST GO?
//
// Two things the earlier probe could NOT tell apart, because it called the fx
// bundle by hand:
//   · does a REAL CARD PLAY still reach the sparks, or has the chain
//     playCard -> fxPlayCard -> atImpact -> fxImpact -> castHit -> C3.hit come
//     apart somewhere it cannot be seen?
//   · and when it does, how many sparks actually get thrown?
//
// Sampled over the whole life of the play rather than at one arbitrary age:
// this harness rasterises at about two frames a second, so a single reading
// 90 ms after a burst catches it wherever it happens to be. The PEAK over a
// window is the number that means something.
const { boot } = require('./harness.cjs');
(async () => {
  const { page, J, sleep, browser } = await boot({ query: 'cast=3d' });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.waitForFunction(() => window.Cast3D && window.Cast3D._state().ready, null, { timeout: 60000 });
  await J(() => window.Cast3D.warm());

  // peak live sparks over `ms`, sampled in-page so the harness's frame rate
  // cannot decide the answer
  const peakOver = (ms) => J((t) => new Promise(res => {
    let peak = 0, n = 0;
    const t0 = performance.now();
    const tick = () => {
      const s = window.Cast3D._state().sparks;
      if (s > peak) peak = s; n++;
      if (performance.now() - t0 < t) setTimeout(tick, 16); else res({ peak, samples: n });
    };
    tick();
  }), ms);

  for (const card of ['twinfang', 'emberstep', 'cleave']) {
    await J(() => window.K.startCombat({ seed: 7 }));
    await sleep(500);
    const hand = await J(() => (window.K._hand ? window.K._hand() : [])
      .map(c => c.id || c));
    const ok = await J((c) => { try { return !!window.K.playCard(c); } catch (e) { return 'ERR:' + e.message; } }, card);
    const got = await peakOver(1400);
    console.log(String(card).padEnd(11), 'played', JSON.stringify(ok),
                'peak sparks', JSON.stringify(got), 'hand', JSON.stringify(hand.slice(0, 6)));
    await sleep(600);
  }

  // …and the control: the same blow thrown straight at the fx layer
  await J(() => window.K.startCombat({ seed: 7 }));
  await sleep(500);
  await J(() => window.Cast3D.hit('foe0', 'slash', 1.8, 'ash'));
  console.log('control    ', 'peak sparks', JSON.stringify(await peakOver(1400)));

  console.log('pageErrors', errs.length, errs.slice(0, 2).join(' | '));
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
