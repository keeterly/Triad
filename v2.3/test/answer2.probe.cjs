'use strict';
// HOW LONG BEFORE A MISSED NOTE'S NUMBER IS LEGIBLE?
//
// `.k-frozen` — the hitstop — pauses `animation-play-state` on the stage AND
// every descendant, with no exemptions. `fxNoteStruck` creates the damage
// number and then calls `fxImpact`, which freezes for 75-165ms. The number's
// first keyframe is `opacity: 0` and it does not reach 1 until 12% of 1.1s, so
// the freeze is spent entirely on the invisible part of its life.
//
// Build 236 already exempted `.k-pop` from the SLOWMO pause for exactly this
// reason. It did not carry the exemption to the freeze.
//
// `animation.currentTime` is the honest instrument: it advances in animation
// time regardless of whether this machine painted a frame, so "how much of the
// number's life elapsed over N ms of wall clock" is machine-independent.
const { boot } = require('./harness.cjs');
(async () => {
  const { page, J, sleep, browser } = await boot({ query: 'cast=3d&realtime=1' });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.waitForFunction(() => window.Cast3D && window.Cast3D._state().ready, null, { timeout: 60000 });
  await J(() => window.Cast3D.warm());
  await J(() => window.K.startCombat({ seed: 7 }));
  await sleep(900);

  // fire it and then watch the ANIMATION CLOCK, not the pixels
  const run = (label, fire) => J((f) => new Promise(res => {
    const st = document.getElementById('k-stage');
    const t0 = performance.now();
    const marks = [];
    // eslint-disable-next-line no-new-func
    (new Function('K', f))(window.K);
    const pop = st.querySelector('.k-pop');
    const a = pop && pop.getAnimations()[0];
    if (!a) return res({ err: 'no animation on .k-pop' });
    const tick = () => {
      marks.push({ wall: Math.round(performance.now() - t0),
                   anim: a.currentTime == null ? null : Math.round(a.currentTime),
                   state: a.playState,
                   frozen: st.classList.contains('k-frozen') });
      if (performance.now() - t0 < 600) setTimeout(tick, 25); else {
        // when does it first reach full opacity, in ANIMATION time?
        const kf = a.effect.getKeyframes();
        const onAt = kf.find(k => +k.opacity === 1);
        res({ marks, dur: Math.round(a.effect.getTiming().duration),
              legibleAtPct: onAt ? onAt.computedOffset : null });
      }
    };
    tick();
  }), fire);

  const r = await run('missed note', "K._fxNoteStruck('ash', 7)");
  console.log('\n── a missed note\'s number ──');
  console.log('  duration', r.dur, 'ms · reaches full opacity at', r.legibleAtPct,
              '=', Math.round((r.legibleAtPct || 0) * r.dur), 'ms of animation time');
  console.log('  ', JSON.stringify(r.marks));
  const last = r.marks[r.marks.length - 1];
  if (last) {
    const lost = last.wall - last.anim;
    console.log('  over', last.wall, 'ms of wall clock the number lived', last.anim,
                'ms  →  LOST', lost, 'ms to the freeze');
    console.log('  time until legible:', Math.round((r.legibleAtPct || 0) * r.dur) + lost, 'ms');
  }
  console.log('\npageErrors', errs.length, errs.slice(0, 2).join(' | '));
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
