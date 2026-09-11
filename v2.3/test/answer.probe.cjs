'use strict';
// WHAT DOES THE PLAYER ACTUALLY SEE WHEN A BLOW LANDS?
//
// fx.probe already proves the Sparks system works when `fx.hit` is called
// directly. That is not the question. The question is whether the GAME'S path
// reaches it — fxImpact -> castHit -> actorOf -> C3.hit — in a real fight, and
// whether Build 236's per-note answer (the deflect, the missed-note hit) ends
// up anywhere a player is looking.
//
// Every suite drives volleys with `opts.grades`, which sets `onGraded` to null
// on purpose. So the per-note path has never been exercised by a check: it is
// a blind spot by construction, which is why nothing noticed.
const { boot } = require('./harness.cjs');
(async () => {
  const { page, J, sleep, browser } = await boot({ query: 'cast=3d' });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.waitForFunction(() => window.Cast3D && window.Cast3D._state().ready, null, { timeout: 60000 });
  await J(() => window.Cast3D.warm());
  await J(() => window.K.startCombat({ seed: 7 }));
  await sleep(600);

  const sparks = () => J(() => window.Cast3D._state().sparks);
  const where = (sel) => J((s) => {
    const st = document.getElementById('k-stage'); const n = document.querySelector(s);
    if (!st || !n) return null;
    const sr = st.getBoundingClientRect(), r = n.getBoundingClientRect();
    const k = sr.width / st.offsetWidth || 1;
    const cs = getComputedStyle(n);
    return { x: +((r.left + r.width / 2 - sr.left) / k).toFixed(1),
             y: +((r.top + r.height / 2 - sr.top) / k).toFixed(1),
             w: +(r.width / k).toFixed(1), h: +(r.height / k).toFixed(1),
             op: cs.opacity, vis: cs.visibility, disp: cs.display, z: cs.zIndex };
  }, sel);

  console.log('\n── ONE · does the game\'s own hit path reach the sparks ──');
  console.log('  .k-hero[ash] plate ', JSON.stringify(await where('.k-hero[data-hero="ash"]')));
  console.log('  #k-boss-art        ', JSON.stringify(await where('#k-boss-art')));
  const s0 = await sparks();
  // the game's bundle, on the foe, exactly as a card play calls it
  await J(() => window.K._fxImpact(document.getElementById('k-boss-art'),
                                   1.8, 'hit', 'r', 'slash'));
  await sleep(200);
  const s1 = await sparks();
  console.log('  sparks via fxImpact ', JSON.stringify({ before: s0, after: s1, gained: s1 - s0 }));
  // …and the fx API directly, as the control
  await sleep(1500);
  const s2 = await sparks();
  await J(() => window.Cast3D.hit('foe0', 'slash', 1.8, 'ash'));
  await sleep(200);
  const s3 = await sparks();
  console.log('  sparks via C3.hit   ', JSON.stringify({ before: s2, after: s3, gained: s3 - s2 }));

  console.log('\n── TWO · the deflect, where it lands ──');
  await sleep(1600);
  await J(() => window.K._parryDeflect('ash', 'l', true));
  await sleep(120);
  console.log('  .k-deflect         ', JSON.stringify(await where('.k-deflect')));
  console.log('  slowmo on stage    ', JSON.stringify(await J(() =>
    ({ cls: document.getElementById('k-stage').className,
       worldSlow: window.Cast3D._state().slow }))));
  await page.screenshot({ path: '/tmp/ans-deflect.png' });

  console.log('\n── THREE · a note that got through ──');
  await sleep(900);
  const p0 = await J(() => document.querySelectorAll('.k-pop').length);
  await J(() => window.K._fxNoteStruck('ash', 7));
  await sleep(140);
  console.log('  .k-pop             ', JSON.stringify(await where('.k-pop')));
  console.log('  pops              ', JSON.stringify({ before: p0,
    after: await J(() => document.querySelectorAll('.k-pop').length) }));
  await page.screenshot({ path: '/tmp/ans-struck.png' });

  console.log('\npageErrors', errs.length, errs.slice(0, 3).join(' | '));
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
