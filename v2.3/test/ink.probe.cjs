'use strict';
// WHAT DOES THE CONTOUR ACTUALLY DRAW ON. Sweeps the line threshold and, for
// each setting, counts the pixels the pass darkens — over the whole frame, over
// the three heroes' own boxes, and over a strip of plaza well behind them.
//
// A single number for the frame is not enough to tell a drawing from a smear:
// the ratio detector this replaces inked 64% of everything, and a detector that
// inks 2% of everything uniformly is just as wrong, only quieter. What a drawn
// line looks like is a few per cent overall, several times that INSIDE the
// figures, and near nothing on the far side of the square.
const { boot } = require('./harness.cjs');

(async () => {
  const { page, J, sleep, browser, shot } = await boot({ query: 'cast=3d' });
  page.on('pageerror', e => console.log('!! PAGE ERROR:', e.message));
  await sleep(600);
  await J(() => startCombat({ foes: ['husk', 'husk'] }));
  for (let i = 0; i < 40 && !(await J(() => !!(window.Cast3D && window.Cast3D._figure('mira')))); i++) await sleep(250);
  await sleep(400);

  const bites = (process.argv[2] || '0.03,0.05,0.075,0.1,0.15,0.25').split(',').map(Number);
  const reach = +(process.argv[3] || 11);

  const rows = await J(async ({ bites, reach }) => {
    const C3 = window.Cast3D;
    const grab = async () => {
      await C3._snapshot();
      const c = window.__castShot;
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      const lum = new Float32Array(c.width * c.height);
      for (let i = 0, j = 0; i < d.length; i += 4, j++)
        lum[j] = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      return { lum, w: c.width, h: c.height };
    };
    // where the three of them are on the drawing buffer, in its own pixels
    const boxes = () => {
      const c = window.__castShot;
      const b = document.getElementById('k-cast').getBoundingClientRect();
      const sx = c.width / b.width, sy = c.height / b.height;
      return ['ash', 'elin', 'mira'].map(who => {
        const el = document.querySelector('.k-hero[data-hero="' + who + '"]');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x0: Math.round((r.left - b.left) * sx), y0: Math.round((r.top - b.top) * sy),
                 x1: Math.round((r.right - b.left) * sx), y1: Math.round((r.bottom - b.top) * sy) };
      }).filter(Boolean);
    };

    // NO CONTROL FRAME, BECAUSE A CONTROL FRAME IS WHAT GOT THIS WRONG. The
    // first cut compared an inked frame against the pass switched OFF, so the
    // difference carried the whole render-target round trip and read 98.6% at
    // every threshold in the sweep — the ink was invisible underneath it.
    //
    // The shader has a debug view that outputs the contour mask ON ITS OWN, so
    // it can just be counted. No second frame, no differencing, nothing for a
    // colour space to spoil.
    C3.look({ line: 0, flat: 0, tooth: 0 });
    await new Promise(r => requestAnimationFrame(r));
    await C3._snapshot();
    const bx = boxes();
    const probe = await grab();
    const inBox = new Uint8Array(probe.w * probe.h);
    let boxN = 0;
    for (const b of bx)
      for (let y = Math.max(0, b.y0); y < Math.min(probe.h, b.y1); y++)
        for (let x = Math.max(0, b.x0); x < Math.min(probe.w, b.x1); x++)
          if (!inBox[y * probe.w + x]) { inBox[y * probe.w + x] = 1; boxN++; }
    // the far plaza: the top third of the frame, minus anything a hero covers
    let farN = 0;
    const isFar = new Uint8Array(probe.w * probe.h);
    for (let y = 0; y < Math.floor(probe.h / 3); y++)
      for (let x = 0; x < probe.w; x++)
        if (!inBox[y * probe.w + x]) { isFar[y * probe.w + x] = 1; farN++; }

    const out = [];
    for (const bite of bites) {
      C3.look({ line: -3, linew: 1.15, bite, reach, flat: 0, tooth: 0 });
      await new Promise(r => requestAnimationFrame(r));
      await new Promise(r => requestAnimationFrame(r));
      const s = await grab();
      let all = 0, box = 0, far = 0;
      for (let i = 0; i < s.lum.length; i++) {
        if (s.lum[i] > 127) {
          all++;
          if (inBox[i]) box++;
          if (isFar[i]) far++;
        }
      }
      out.push({ bite, all: +(all / s.lum.length * 100).toFixed(2),
                 onBodies: +(box / Math.max(1, boxN) * 100).toFixed(2),
                 onPlaza: +(far / Math.max(1, farN) * 100).toFixed(2) });
    }
    C3.look({ line: 0, flat: 0, tooth: 0 });
    return { out, px: probe.w + 'x' + probe.h, boxN, farN, near: +C3._state().near || 0 };
  }, { bites, reach });

  console.log('buffer', rows.px, '| hero boxes', rows.boxN, 'px | far plaza', rows.farN, 'px');
  console.log('bite     frame%   bodies%   plaza%');
  for (const r of rows.out)
    console.log(String(r.bite).padEnd(8), String(r.all).padEnd(8), String(r.onBodies).padEnd(9), r.onPlaza);

  // and a picture at whichever one was asked for, to look at
  const pick = +(process.argv[4] || 0.075);
  await J(({ pick, reach }) => window.Cast3D.look({ line: 0.72, linew: 1.15, bite: pick, reach, flat: 0.34, tooth: 0.05 }), { pick, reach });
  await sleep(400);
  await shot('ink-' + pick);
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
