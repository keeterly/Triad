'use strict';
// Is the slash's hip jump IN THE BAKED TRACK, or something the mixer does to
// it? Read the retargeted clip's own keyframes and look for two adjacent
// samples that are further apart than any authored motion could be.
const { boot } = require('./harness.cjs');
(async () => {
  const { page, J, browser } = await boot({ query: 'cast=3d' });
  page.on('pageerror', e => console.log('!! PAGE ERROR:', e.message));
  await page.waitForFunction(() => window.Cast3D && window.Cast3D._state().ready,
    null, { timeout: 60000 });
  const out = await J(() => {
    const C3 = window.Cast3D;
    const f = C3._figure('ash');
    const res = {};
    for (const v of ['slash', 'cast', 'parry']) {
      const name = C3._verbClip('ash', v);
      const clip = f.actions[name].getClip();
      const rows = [];
      for (const t of clip.tracks) {
        if (!/\.quaternion$/.test(t.name)) continue;
        const n = t.times.length;
        let worst = 0, at = 0;
        for (let i = 1; i < n; i++) {
          const a = t.values.slice((i - 1) * 4, i * 4);
          const b = t.values.slice(i * 4, (i + 1) * 4);
          let d = Math.abs(a[0]*b[0] + a[1]*b[1] + a[2]*b[2] + a[3]*b[3]);
          if (d > 1) d = 1;
          const ang = 2 * Math.acos(d) * 180 / Math.PI;   // degrees between keys
          if (ang > worst) { worst = ang; at = t.times[i]; }
        }
        rows.push([t.name.replace('.quaternion', ''), +worst.toFixed(1), +at.toFixed(3)]);
      }
      rows.sort((p, q) => q[1] - p[1]);
      res[v] = { clip: name, dur: +clip.duration.toFixed(3),
                 keys: clip.tracks[0] ? clip.tracks[0].times.length : 0,
                 worst: rows.slice(0, 4) };
    }
    return res;
  });
  console.log('\nbiggest step between two ADJACENT baked keyframes, in degrees\n');
  for (const [v, r] of Object.entries(out)) {
    console.log(' ', v.padEnd(7), r.clip.padEnd(8), 'dur', r.dur, 'keys', r.keys);
    for (const [b, d, t] of r.worst) console.log('      ', b.padEnd(16), String(d).padStart(7) + '°  @', t);
  }
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
