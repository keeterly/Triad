'use strict';
// WHAT DO THE BODIES DO when two of them act together, or all three?
//
// RECORDED IN THE PAGE, NOT SAMPLED FROM OUTSIDE. The first cut of this probe
// polled `Cast3D.shot()` every 90ms over a Playwright bridge — but the suite's
// browser draws at about 1.5fps and every `evaluate` has to wait its turn on the
// page's own thread, so twenty "samples" spanned fourteen seconds and the first
// one landed after the all-out had already finished. It reported the camera
// never moving, which was the harness talking. Wrapping the two entry points
// and reading the log afterwards cannot miss anything.
const { boot } = require('./harness.cjs');
(async () => {
  const { page, J, sleep, browser } = await boot({ query: 'cast=3d' });
  page.on('pageerror', e => console.log('!! PAGE ERROR:', e.message));
  await sleep(600);
  await J(() => startCombat({ foes: ['husk'], kizuna: 999 }));
  for (let i = 0; i < 40 && !(await J(() => !!(window.Cast3D && window.Cast3D._figure('mira')))); i++) await sleep(250);

  const tap = () => J(() => {
    const C3 = window.Cast3D;
    window.__log = [];
    const t0 = performance.now();
    const at = () => Math.round(performance.now() - t0);
    if (!C3.__rawPlay) { C3.__rawPlay = C3.play; C3.__rawShot = C3.shot; }
    C3.play = function (id, verb, dir) {
      window.__log.push([at(), 'play', id, verb, dir || '']);
      return C3.__rawPlay.apply(C3, arguments);
    };
    C3.shot = function (name, opts) {
      if (name != null) window.__log.push([at(), 'shot', typeof name === 'string' ? name : '(pose)',
                                           JSON.stringify(opts || {})]);
      return C3.__rawShot.apply(C3, arguments);
    };
    return true;
  });
  const drain = () => J(() => {
    const C3 = window.Cast3D;
    if (C3.__rawPlay) { C3.play = C3.__rawPlay; C3.shot = C3.__rawShot;
                        C3.__rawPlay = null; C3.__rawShot = null; }
    return window.__log || [];
  });

  console.log('— all-out —');
  await tap();
  const fired = await J(() => window.K.allOut());
  await sleep(3000);
  const log = await drain();
  console.log('allOut() returned', fired);
  for (const r of log) console.log(' ', String(r[0]).padStart(5), r.slice(1).join(' '));
  const plays = log.filter(r => r[1] === 'play' && r[3] !== 'idle');
  console.log('bodies that acted:', [...new Set(plays.map(r => r[2]))].join(', ') || 'NONE');

  console.log('\n— a pair card —');
  await tap();
  const played = await J(async () => {
    window.K.forceHand(['bothblades']);
    const st = window.K.state();
    st.ap = 9;
    const r = await window.K.playCard('bothblades', { foe: 0 });
    return { ok: !!r, ap: st.ap };
  });
  await sleep(3200);
  const log2 = await drain();
  console.log('played:', JSON.stringify(played));
  for (const r of log2) console.log(' ', String(r[0]).padStart(5), r.slice(1).join(' '));
  const acted = [...new Set(log2.filter(r => r[1] === 'play' && ['ash', 'elin', 'mira'].includes(r[2]))
                                 .map(r => r[2]))];
  console.log('heroes that acted:', acted.join(', ') || 'NONE',
              '— the card is owned by ash|mira');

  console.log('\n— a SINGLE-owner card, for comparison —');
  await tap();
  await J(async () => {
    window.K.forceHand(['serrate']);
    window.K.state().ap = 9;
    return !!(await window.K.playCard('serrate', { foe: 0 }));
  });
  await sleep(2200);
  for (const r of await drain()) console.log(' ', String(r[0]).padStart(5), r.slice(1).join(' '));

  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
