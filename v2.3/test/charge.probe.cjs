'use strict';
// DOES ANYBODY ACTUALLY CROSS THE FLOOR? Records each hero's world position
// every frame through an all-out, from inside the page — the harness draws at
// about 1.5fps and sampling over the bridge measures the bridge.
const { boot } = require('./harness.cjs');
(async () => {
  const { page, J, sleep, browser } = await boot({ query: 'cast=3d' });
  page.on('pageerror', e => console.log('!! PAGE ERROR:', e.message));
  await sleep(600);
  await J(() => startCombat({ foes: ['husk'] }));
  // WAIT FOR THE CREATURE, NOT JUST THE PARTY. The bestiary loads behind the
  // party (Build 127's warm queue), and an earlier cut of this probe measured
  // an all-out thrown before the husk's model existed — so every charge aimed
  // at the middle of the floor and the front rank did not move.
  for (let i = 0; i < 60 && !(await J(() => !!(window.Cast3D && window.Cast3D._figure('foe0')))); i++) await sleep(250);
  const out = await J(async () => {
    const C3 = window.Cast3D;
    const who = ['ash', 'elin', 'mira'];
    const home = {}, log = [], verbs = {};
    for (const id of who) { const f = C3._figure(id);
      home[id] = [f.root.position.x, f.root.position.z];
      verbs[id] = C3.verbFor(id); }
    let stop = false;
    const t0 = performance.now();
    const tick = () => {
      const row = { t: Math.round(performance.now() - t0) };
      for (const id of who) { const f = C3._figure(id);
        row[id] = +Math.hypot(f.root.position.x - home[id][0],
                              f.root.position.z - home[id][1]).toFixed(3); }
      log.push(row);
      if (!stop) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    C3.__p = C3.play; const played = [];
    C3.play = function (id, v) { played.push(id + ':' + v); return C3.__p.apply(C3, arguments); };
    window.K.state().kizuna = 100;
    await window.K.allOut();
    await new Promise(r => setTimeout(r, 2500));
    stop = true; C3.play = C3.__p;
    const far = {};
    for (const id of who) far[id] = Math.max(...log.map(r => r[id]));
    return { verbs, played: played.filter(p => !p.startsWith('foe')), far, log };
  });
  console.log('verb per person :', JSON.stringify(out.verbs));
  console.log('clips played    :', out.played.join('  '));
  console.log('furthest from home (m):', JSON.stringify(out.far));
  console.log('\n   ms    ash   elin   mira');
  for (const r of out.log) console.log(String(r.t).padStart(5),
    String(r.ash).padStart(6), String(r.elin).padStart(6), String(r.mira).padStart(6));
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
