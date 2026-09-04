'use strict';
// Watch a parry happen. Screenshot the bar through its life and report what the
// player is actually being asked to read.
const { boot } = require('./harness.cjs');
const path = require('path');
(async () => {
  const { page, J, sleep, browser, shot } = await boot({ query: process.argv[2] || 'cast=3d' });
  page.on('pageerror', e => console.log('!! PAGE ERROR:', e.message));
  await sleep(600);
  const WHO = process.argv[3] || 'husk';
  await J((w) => startCombat({ foes: [w] }), WHO);
  await sleep(2400);
  // END TURN arms on the first press and fires on the confirm when AP is left,
  // so press until the turn actually moves rather than assuming which it is.
  const eb = await J(() => {
    const e = document.getElementById('k-endturn'); if (!e) return null;
    const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2];
  });
  for (let i = 0; i < 4; i++) {
    const moved = await J(() => window.K.state().phase !== 'PLAYER_READY');
    if (moved) break;
    await page.mouse.click(eb[0], eb[1]);
    await sleep(420);
  }

  for (let i = 0; i < 18; i++) {
    await sleep(240);
    const st = await J(() => {
      const notes = [...document.querySelectorAll('#k-stage .k-pr')].map(n => {
        const r = n.getBoundingClientRect();
        return { cls: n.className, w: Math.round(r.width), h: Math.round(r.height),
                 x: Math.round(r.left), y: Math.round(r.top) };
      });
      // HOW MANY FULL-SCREEN WASHES ARE STACKED RIGHT NOW. Each is a div over
      // the whole stage; a volley adds one per hit and they multiply.
      const flashes = document.querySelectorAll('#k-stage .k-hitflash').length;
      const pulses = document.querySelectorAll('#k-stage .k-pulse').length;
      const stg = document.getElementById('k-stage');
      const dim = !!stg && stg.classList.contains('k-parry-focus');
      const slow = !!stg && stg.classList.contains('k-slowmo');
      const cam = window.Cast3D && window.Cast3D._state().on ? window.Cast3D._world().cam : null;
      return { phase: C && C.phase, notes: notes.length, flashes, pulses, first: notes[0] || null, dim, slow,
               cam: cam ? [cam.x, cam.y, cam.z] : null };
    });
    if (st.dim) await shot('parry-' + String(i).padStart(2, '0'));
    console.log(String(i).padStart(2), st.phase, 'notes', st.notes,
                'dim', st.dim ? 'Y' : '.', 'slow', st.slow ? 'Y' : '.',
                'flash', st.flashes, 'pulse', st.pulses,
                st.first ? JSON.stringify(st.first) : '');
  }
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
