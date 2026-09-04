'use strict';
// THE PASS WITH NOTHING TO DO. If routing the frame through a render target and
// back changes the picture at all, every reading taken through the pass is that
// change plus whatever the shader did — and the shader gets blamed for it.
//
// `inkWanted()` gates on abs(line) > 0.002, so the earlier control at line
// 0.0001 did not run the pass: it compared two frames that both went straight
// to the canvas. 0.003 is the smallest dial that actually turns it on.
const { boot } = require('./harness.cjs');
(async () => {
  const { page, J, sleep, browser } = await boot({ query: 'cast=3d' });
  page.on('pageerror', e => console.log('!! PAGE ERROR:', e.message));
  await sleep(600);
  await J(() => startCombat({ foes: ['husk'] }));
  for (let i = 0; i < 40 && !(await J(() => !!(window.Cast3D && window.Cast3D._figure('ash')))); i++) await sleep(250);
  await sleep(400);
  const out = await J(async () => {
    const C3 = window.Cast3D;
    const read = async () => {
      for (let i = 0; i < 3; i++) await new Promise(r => requestAnimationFrame(r));
      await C3._snapshot();
      const c = window.__castShot;
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let s = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) { s += (d[i] * 0.299 + d[i+1] * 0.587 + d[i+2] * 0.114) / 255; n++; }
      return +(s / n).toFixed(4);
    };
    const r = {};
    C3.look({ line: 0,     flat: 0, tooth: 0 }); r.passOff      = await read();
    C3.look({ line: 0.003, flat: 0, tooth: 0 }); r.passOnNoInk  = await read();
    C3.look({ line: 0.72,  flat: 0, tooth: 0 }); r.inkOnly      = await read();
    C3.look({ line: 0.003, flat: 0.34, tooth: 0 }); r.bandsOnly = await read();
    C3.look({ line: 0,     flat: 0, tooth: 0 });
    return r;
  });
  console.log('mean luminance');
  for (const [k, v] of Object.entries(out)) console.log('  ' + k.padEnd(14), v);
  const cost = (out.passOnNoInk - out.passOff).toFixed(4);
  console.log('\nthe ROUND TRIP alone changes the mean by ' + cost
    + (Math.abs(out.passOnNoInk - out.passOff) > 0.01
       ? '  <-- the pass is not transparent; everything measured through it is wrong by this much'
       : '  <-- transparent, so the shader owns the rest'));
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
