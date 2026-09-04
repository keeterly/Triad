'use strict';
// LOOK AT THE FIVE GUARDS. Poses the party at each parry's contact frame and
// photographs the board, because authored motion is judged by looking at it and
// the numbers only say it is not standing still.
const { boot } = require('./harness.cjs');
(async () => {
  const { page, J, sleep, browser, shot } = await boot({ query: 'cast=3d' });
  page.on('pageerror', e => console.log('!! PAGE ERROR:', e.message));
  await sleep(600);
  await J(() => startCombat({ foes: ['husk'] }));
  for (let i = 0; i < 40 && !(await J(() => !!(window.Cast3D && window.Cast3D._figure('mira')))); i++) await sleep(250);
  const clips = (process.argv[2] || 'parry,parryR,parryL,parryU,parryD').split(',');
  const at = +(process.argv[3] || 0.3);
  for (const clip of clips) {
    const ok = await J(({ clip, at }) => {
      const C3 = window.Cast3D;
      let n = 0;
      for (const who of ['mira', 'elin', 'ash']) {
        const f = C3._figure(who); if (!f) continue;
        const a = f.actions[clip]; if (!a) continue;
        for (const k of Object.keys(f.actions)) { f.actions[k].setEffectiveWeight(0); f.actions[k].stop(); }
        if (f.idle) f.idle.setEffectiveWeight(0);
        a.reset(); a.setEffectiveWeight(1); a.play(); a.paused = true;
        a.time = a.getClip().duration * at;
        f.mixer.update(0);
        f.holdFrac = 0; f.acting = a;
        n++;
      }
      return n;
    }, { clip, at });
    await sleep(260);
    await shot('guard-' + clip);
    console.log(clip, 'posed', ok);
  }
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
