'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// THE CITY GOES SOFT AND THE PARTY DOES NOT
// ═══════════════════════════════════════════════════════════════════════════
//
// A depth of field that softens everything is a smudge, and it would read as a
// win on any single "is the background blurrier" number — so both halves are
// measured against each other, on the same frame, and the one that matters is
// the one that must NOT move.
//
//   THE PLAZA loses high-frequency energy: that is the effect working.
//   THE PARTY keeps it: they are at the focal plane, which the camera picks
//   for itself from its own aim point, so if they soften the focus is wrong
//   and no amount of background blur redeems it.
//
// Sharpness is mean absolute Laplacian, the same reading the painterly probe
// uses, so the two are directly comparable. Bloom is measured where it can be
// seen at all — the brightest percentile — because a glow that lifts the mean
// of the whole frame is not a bloom, it is a fog.
const { boot } = require('./harness.cjs');

const OFF = { dof: 0, bloom: 0 };

(async () => {
  const { J, sleep, browser, shot, page } = await boot({ query: 'cast=3d' });
  page.on('pageerror', e => console.log('!! PAGE ERROR:', e.message));
  await sleep(600);
  await J(() => startCombat({ foes: ['husk'] }));
  for (let i = 0; i < 40 && !(await J(() => !!(window.Cast3D && window.Cast3D._figure('mira')))); i++)
    await sleep(250);
  await sleep(500);

  const read = async () => J(async () => {
    const C3 = window.Cast3D;
    await C3._snapshot();
    const c = window.__castShot, w = c.width, h = c.height;
    const d = c.getContext('2d').getImageData(0, 0, w, h).data;
    const b = document.getElementById('k-cast').getBoundingClientRect();
    const sx = w / b.width, sy = h / b.height;
    const inBox = window.__figMask;
    const lum = new Float32Array(w * h);
    for (let i = 0, j = 0; i < d.length; i += 4, j++)
      lum[j] = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / 255;
    let pS = 0, pN = 0, fS = 0, fN = 0;
    const all = [];
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = Math.abs(4 * lum[i] - lum[i - 1] - lum[i + 1] - lum[i - w] - lum[i + w]);
      all.push(lum[i]);
      if (inBox[i]) { if (lum[i] > 0.035) { pS += lap; pN++; } }
      // the far city: the top third of the frame, outside anybody's box —
      // the same region the contour check calls "plaza"
      else if (y < h / 3) { fS += lap; fN++; }
    }
    all.sort((a, z) => a - z);
    const q = (f) => all[Math.floor(all.length * f)];
    return {
      party: +(pS / Math.max(1, pN)).toFixed(5),
      plaza: +(fS / Math.max(1, fN)).toFixed(5),
      p99: +q(0.99).toFixed(3), p90: +q(0.90).toFixed(3), mean: +(all.reduce((a, z) => a + z, 0) / all.length).toFixed(3),
    };
  });

  const on = await J(() => window.Cast3D.look());
  // ── THE SUBJECT IS THE FIGURES, NOT THE RECTANGLES ROUND THEM ───────────
  //
  // A hero's box is mostly plaza, and plaza is exactly what this effect is
  // supposed to soften. Read over the boxes, the party's sharpness fell 22%
  // and looked like a focus fault; read over the figures themselves the
  // circle of confusion on them is 0.038 against 0.44 everywhere else, which
  // is the effect doing precisely its job. Measured through the mask the
  // figure material draws for itself, so it is the real silhouette and not a
  // rectangle standing in for one.
  await J(async () => {
    const C3 = window.Cast3D, was = C3.look();
    C3.look({ pl: -2 });
    await new Promise(r => requestAnimationFrame(r));
    await new Promise(r => requestAnimationFrame(r));
    await C3._snapshot();
    const c = window.__castShot, d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const m = new Uint8Array(c.width * c.height);
    for (let i = 0, j = 0; i < d.length; i += 4, j++)
      if (d[i] > 140 && d[i + 1] < 100 && d[i + 2] > 140) m[j] = 1;
    window.__figMask = m;
    C3.look(was);
  });
  await J(l => window.Cast3D.look(l), OFF);
  await sleep(400); await shot('lens-off');
  const off = await read();
  await J(l => window.Cast3D.look(l), on);
  await sleep(400); await shot('lens-on');
  const now = await read();

  const row = (k, a, z) => console.log('  ' + k.padEnd(8) + String(a).padStart(10)
    + String(z).padStart(10) + ((z / a - 1) * 100).toFixed(0).padStart(8) + '%');
  console.log('\n  ' + 'reading'.padEnd(8) + 'flat'.padStart(10) + 'lens'.padStart(10) + '  change');
  for (const k of ['party', 'plaza', 'p99', 'p90', 'mean']) row(k, off[k], now[k]);
  console.log('\n  plaza sharpness must FALL and party sharpness must HOLD');
  console.log('  dials: ' + JSON.stringify({ dof: on.dof, frange: on.frange, bloom: on.bloom, glowT: on.glowT }));
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
