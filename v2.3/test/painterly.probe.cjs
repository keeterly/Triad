'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// IS THE LIGHT DRAWN, AND IS THE PAINTING STILL THERE
// ═══════════════════════════════════════════════════════════════════════════
//
// Two things have to be true at once and they pull against each other, which
// is exactly why the last two attempts at this look were switched back off.
//
//   THE LIGHT IS DRAWN — the terminator is an edge rather than a ramp, the
//   shadow carries a hue instead of going grey, and the two sides of a form
//   part in colour and not only in value.
//
//   THE PAINTING SURVIVES — these models are painted from the concept art, so
//   a treatment that gives the light three values and takes the texture's
//   hundred folds with it has destroyed the thing it was applied to. The band
//   ladder did precisely that and read as an improvement on every summary
//   number anybody had at the time.
//
// So the detail reading is the one that matters, and it is deliberately the
// one that can fail: mean absolute Laplacian inside the party's own boxes,
// which is high-frequency energy — brush marks, folds, trim, hair. A treatment
// that flattens the art drops it. Everything else here can look wonderful
// while that number falls and the answer is still no.
const { boot } = require('./harness.cjs');

const OFF = { pl: 0 };

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
    const c = window.__castShot;
    const w = c.width, h = c.height;
    const d = c.getContext('2d').getImageData(0, 0, w, h).data;
    // the party's own boxes: the plaza has its own art and is not what any of
    // this is applied to
    const b = document.getElementById('k-cast').getBoundingClientRect();
    const sx = w / b.width, sy = h / b.height;
    const inBox = new Uint8Array(w * h);
    for (const who of ['ash', 'elin', 'mira']) {
      const el = document.querySelector('.k-hero[data-hero="' + who + '"]');
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const x0 = Math.max(1, Math.round((r.left - b.left) * sx)), x1 = Math.min(w - 1, Math.round((r.right - b.left) * sx));
      const y0 = Math.max(1, Math.round((r.top - b.top) * sy)), y1 = Math.min(h - 1, Math.round((r.bottom - b.top) * sy));
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) inBox[y * w + x] = 1;
    }
    const lum = new Float32Array(w * h);
    for (let i = 0, j = 0; i < d.length; i += 4, j++)
      lum[j] = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / 255;

    let det = 0, detN = 0, grad = [];
    const px = [];
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (!inBox[i]) continue;
      // BACKGROUND INSIDE A BOX IS NOT A BODY. A hero's rectangle contains
      // plaza either side of them, and plaza is unaffected by any of this, so
      // counting it dilutes every reading toward "nothing changed".
      if (lum[i] < 0.035) continue;
      const lap = Math.abs(4 * lum[i] - lum[i - 1] - lum[i + 1] - lum[i - w] - lum[i + w]);
      det += lap; detN++;
      const gx = lum[i + 1] - lum[i - 1], gy = lum[i + w] - lum[i - w];
      grad.push(Math.hypot(gx, gy));
      const k = i * 4;
      px.push([d[k], d[k + 1], d[k + 2], lum[i]]);
    }
    grad.sort((a, z) => a - z);
    px.sort((a, z) => a[3] - z[3]);
    const sat = (p) => {
      const mx = Math.max(p[0], p[1], p[2]), mn = Math.min(p[0], p[1], p[2]);
      return mx < 1 ? 0 : (mx - mn) / mx;
    };
    // blue-minus-red, signed: the sign of the warm/cool split, which a
    // saturation number alone cannot show
    const bmr = (p) => (p[2] - p[0]) / 255;
    const q = Math.max(1, Math.floor(px.length / 4));
    const dark = px.slice(0, q), lite = px.slice(-q);
    const mean = (a, f) => a.reduce((s, p) => s + f(p), 0) / Math.max(1, a.length);
    return {
      n: detN,
      detail: +(det / Math.max(1, detN)).toFixed(5),
      // THE TERMINATOR IS A FEW PER CENT OF THE PIXELS, so the 97th
      // percentile is mostly ordinary shading and moves the wrong way when
      // the shadow side is deliberately flattened. The edge itself lives out
      // at the very top of the distribution.
      hardEdge: +(grad[Math.floor(grad.length * 0.997)] || 0).toFixed(4),
      midEdge: +(grad[Math.floor(grad.length * 0.97)] || 0).toFixed(4),
      darkSat: +mean(dark, sat).toFixed(3),
      liteSat: +mean(lite, sat).toFixed(3),
      darkBmR: +mean(dark, bmr).toFixed(3),
      liteBmR: +mean(lite, bmr).toFixed(3),
      lum: +mean(px, p => p[3]).toFixed(3),
    };
  });

  const on = await J(() => window.Cast3D.look());
  await J(l => window.Cast3D.look(l), OFF);
  await sleep(400); await shot('paint-off');
  const off = await read();
  await J(l => window.Cast3D.look(l), on);
  await sleep(400); await shot('paint-on');
  const now = await read();

  const row = (k, a, b) => console.log('  ' + k.padEnd(10)
    + String(a).padStart(9) + String(b).padStart(9)
    + (typeof a === 'number' && a !== 0 ? ((b / a - 1) * 100).toFixed(0) + '%' : '').padStart(8));
  console.log('\n  inside the party boxes, lit pixels only  (n=' + now.n + ')\n');
  console.log('  ' + 'reading'.padEnd(10) + 'plain'.padStart(9) + 'painted'.padStart(9) + '  change');
  for (const k of ['detail', 'hardEdge', 'midEdge', 'darkSat', 'liteSat', 'darkBmR', 'liteBmR', 'lum'])
    row(k, off[k], now[k]);
  console.log('\n  detail must NOT fall — that is the painting surviving the light');
  console.log('  dials: ' + JSON.stringify({ pl: on.pl, term: on.term, soft: on.soft,
    fold: on.fold, cross: on.cross, rim: on.rim, rimp: on.rimp }));
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
