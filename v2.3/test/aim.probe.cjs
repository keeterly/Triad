'use strict';
const { boot } = require('./harness.cjs');
(async () => {
  const q = process.argv[2] === '2d' ? '' : 'cast=3d';
  const { page, J, browser } = await boot({ query: q });
  // THE USER'S WINDOW IS NOT 932x430. The harness has always booted at exactly
  // the stage's own size, so `#k-scale` sits at scale 1 and every suite has
  // only ever measured the one case where stage units and CSS pixels agree.
  await page.setViewportSize({ width: Number(process.argv[3]||932), height: Number(process.argv[4]||430) });
  if (q) await page.waitForFunction(() => window.Cast3D && window.Cast3D._state().ready,
    null, { timeout: 30000 }).catch(() => console.log('!! never ready'));
  const r = await J(async () => {
    for (let i = 0; i < 30; i++) await new Promise(x => requestAnimationFrame(x));
    const st = document.getElementById('k-stage');
    const sr = st.getBoundingClientRect();
    const k = sr.width / st.offsetWidth || 1;
    const boss = document.getElementById('k-boss-art');
    const br = boss.getBoundingClientRect();
    const card = document.querySelector('.k-card');
    const cr = card.getBoundingClientRect();
    const at = (x, y, t) => card.dispatchEvent(new PointerEvent(t,
      { bubbles: true, clientX: x, clientY: y, pointerId: 5 }));
    at(cr.left + cr.width / 2, cr.top + 10, 'pointerdown');
    at(cr.left + cr.width / 2 + 40, cr.top - 40, 'pointermove');
    // drag right onto the middle of the foe
    at(br.left + br.width / 2, br.top + br.height / 2, 'pointermove');
    await new Promise(x => requestAnimationFrame(x));
    const d = document.querySelector('#k-aim .k-aim-dash');
    return {
      stage: { w: st.offsetWidth, h: st.offsetHeight, scale: +k.toFixed(3) },
      bossRect: { l: +(br.left - sr.left).toFixed(1), t: +(br.top - sr.top).toFixed(1),
                  w: +br.width.toFixed(1), h: +br.height.toFixed(1) },
      bossStage: { cx: +((br.left + br.width / 2 - sr.left) / k).toFixed(1),
                   cy: +((br.top + br.height * 0.42 - sr.top) / k).toFixed(1) },
      pointerWas: { x: +((br.left + br.width / 2 - sr.left) / k).toFixed(1) },
      path: d ? d.getAttribute('d') : null,
      foe: boss.dataset.foe,
      castOff: boss.classList.contains('k-cast3d-off'),
      wx: boss.style.getPropertyValue('--w-x'), ws: boss.style.getPropertyValue('--w-s'),
    };
  });
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
