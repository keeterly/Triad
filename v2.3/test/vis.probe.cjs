'use strict';
const { boot } = require('./harness.cjs');
(async () => {
  const { page, J, sleep, browser } = await boot({ query: 'cast=3d' });
  await page.waitForFunction(() => window.Cast3D && window.Cast3D._state().ready,
    null, { timeout: 30000 }).catch(() => console.log('!! never ready'));
  const st = async (label) => console.log(label, JSON.stringify(await J(() => {
    const b = document.getElementById('k-boss-art');
    const img = b.querySelector('img');
    const cs = getComputedStyle(img);
    return { foe: b.dataset.foe, on: b.classList.contains('k-cast3d-on'),
             inline: img.style.opacity || '(none)', computed: cs.opacity,
             display: cs.display, src: img.getAttribute('src').split('/').pop(),
             boxW: Math.round(b.getBoundingClientRect().width) };
  })));
  await J(() => {
    document.getElementById('k-boss-art').dataset.foe = 'revenant';
    for (const id of ['ash','elin','mira','mourner']) {
      const f = window.Cast3D._figure(id); if (f) { f.clear(); f.mixer.timeScale = 0; }
    }
  });
  await sleep(320);
  await st('after foe swap  ');
  const clip = await J(() => {
    const r = document.querySelector('#k-boss-art').getBoundingClientRect();
    return { x: Math.max(0,Math.round(r.left)), y: Math.max(0,Math.round(r.top)),
             width: Math.round(r.width), height: Math.round(r.height) };
  });
  const A = await page.screenshot({ clip });
  await sleep(120);
  const B = await page.screenshot({ clip });
  await J(() => { document.querySelector('#k-boss-art img').style.opacity = '0'; });
  await sleep(250);
  await st('after hide      ');
  const C = await page.screenshot({ clip });
  console.log('lengths A/B/C:', A.length, B.length, C.length);
  console.log('A==B', A.equals(B), ' A==C', A.equals(C));
  await page.screenshot({ path: 'shots/vis-hidden.png', clip });
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
