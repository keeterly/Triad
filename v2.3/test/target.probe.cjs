'use strict';
// Can a drag reach the SECOND enemy? Ask dropTargetAt what it resolves at the
// centre of each foe's box, in both stages.
const { boot } = require('./harness.cjs');
(async () => {
  const args = process.argv[2] || 'cast=3d';
  const { page, J, sleep, browser } = await boot({ query: args });
  page.on('pageerror', e => console.log('!! PAGE ERROR:', e.message));
  await sleep(600);
  await J(() => startCombat({ foes: ['husk', 'husk', 'wraith'] }));
  await sleep(2800);
  const out = await J(() => {
    const boxes = [...document.querySelectorAll('#k-cast [data-foe]')]
      .filter(n => n.offsetParent !== null)
      .map(n => {
        const r = n.getBoundingClientRect();
        return { ix: n.dataset.ix || '0', foe: n.dataset.foe,
                 l: Math.round(r.left), t: Math.round(r.top),
                 w: Math.round(r.width), h: Math.round(r.height),
                 cx: Math.round(r.left + r.width / 2), cy: Math.round(r.top + r.height / 2) };
      });
    // an attack card to aim with
    const card = (C.hand || []).find(id => cardDef(id).target === 'enemy') || (C.hand || [])[0];
    const hits = boxes.map(b => {
      const d = dropTargetAt(b.cx, b.cy, card);
      return { at: b.ix, got: d ? (d.foe === undefined ? 'first' : String(d.foe)) : 'none' };
    });
    return { card, boxes, hits, living: (C.foes || []).map(f => f.ix + ':' + f.id) };
  });
  console.log(args);
  console.log('  living   ', JSON.stringify(out.living));
  for (const b of out.boxes)
    console.log('  box ix=' + b.ix, b.foe.padEnd(8), 'x', b.l, 'y', b.t, 'w', b.w, 'h', b.h, ' centre', b.cx + ',' + b.cy);
  console.log('  drops    ', JSON.stringify(out.hits));
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
