'use strict';
// EVERY CLIP, FRAME BY FRAME, ON ONE SHEET.
//
// A clip that plays for a second and a half cannot be judged from a still, and
// the suite's numbers only say the body is not standing still. This poses one
// figure at eight evenly spaced phases of each clip and lays them out left to
// right, so a swing reads as a swing or does not.
//
//   node test/frames.probe.cjs [clip,clip,…] [who] [cols]
const { boot } = require('./harness.cjs');
const fs = require('fs');
const path = require('path');

(async () => {
  const { page, J, sleep, browser } = await boot({ query: 'cast=3d' });
  page.on('pageerror', e => console.log('!! PAGE ERROR:', e.message));
  await sleep(600);
  await J(() => startCombat({ foes: ['husk'] }));
  for (let i = 0; i < 40 && !(await J(() => !!(window.Cast3D && window.Cast3D._figure('ash')))); i++) await sleep(250);

  const who = process.argv[3] || 'ash';
  const cols = +(process.argv[4] || 8);
  const clips = (process.argv[2] || '').split(',').filter(Boolean).length
    ? process.argv[2].split(',')
    : await J(w => Object.keys(window.Cast3D._figure(w).actions), who);

  // a clean, still camera so nothing but the body changes between frames
  await J(() => { window.Cast3D.uncut(); window.Cast3D.look({ line: 0, flat: 0, tooth: 0 }); });
  await sleep(400);

  for (const clip of clips) {
    const url = await J(async ({ clip, who, cols }) => {
      const C3 = window.Cast3D, f = C3._figure(who);
      const a = f.actions[clip];
      if (!a) return null;
      const b = document.getElementById('k-cast').getBoundingClientRect();
      const el = document.querySelector('.k-hero[data-hero="' + who + '"]');
      const r = el.getBoundingClientRect();
      // a generous box: an action throws an arm well outside the portrait slot
      const pad = { x: r.width * 1.1, y: r.height * 0.55 };
      let cell = null, strip = null, ctx = null;
      for (let i = 0; i < cols; i++) {
        for (const k of Object.keys(f.actions)) { f.actions[k].setEffectiveWeight(0); f.actions[k].stop(); }
        if (f.idle) f.idle.setEffectiveWeight(0);
        a.reset(); a.setEffectiveWeight(1); a.play(); a.paused = true;
        a.time = a.getClip().duration * (i / (cols - 1)) * 0.999;
        f.mixer.update(0);
        f.holdFrac = 0; f.acting = a;
        await new Promise(r2 => requestAnimationFrame(r2));
        await C3._snapshot();
        const c = window.__castShot;
        const sx = c.width / b.width, sy = c.height / b.height;
        const x0 = Math.max(0, Math.round((r.left - b.left - pad.x) * sx));
        const y0 = Math.max(0, Math.round((r.top - b.top - pad.y) * sy));
        const w = Math.min(c.width - x0, Math.round((r.width + pad.x * 2) * sx));
        const h = Math.min(c.height - y0, Math.round((r.height + pad.y * 1.6) * sy));
        if (!strip) {
          cell = { w, h };
          strip = document.createElement('canvas');
          strip.width = w * cols; strip.height = h;
          ctx = strip.getContext('2d');
        }
        ctx.drawImage(c, x0, y0, w, h, cell.w * i, 0, cell.w, cell.h);
        ctx.strokeStyle = 'rgba(255,190,90,0.5)';
        ctx.strokeRect(cell.w * i + 0.5, 0.5, cell.w - 1, cell.h - 1);
        ctx.fillStyle = 'rgba(255,210,120,0.95)';
        ctx.font = '16px monospace';
        ctx.fillText((i / (cols - 1)).toFixed(2), cell.w * i + 8, 20);
      }
      for (const k of Object.keys(f.actions)) { f.actions[k].paused = false; f.actions[k].setEffectiveWeight(0); f.actions[k].stop(); }
      f.acting = null; if (f.idle) f.idle.setEffectiveWeight(1);
      return strip.toDataURL('image/png');
    }, { clip, who, cols });
    if (!url) { console.log('-- no clip', clip, 'on', who); continue; }
    const out = path.join(__dirname, 'film-clips', who + '-' + clip + '.png');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
    console.log('wrote', path.relative(process.cwd(), out));
  }
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
