'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// IS ANYBODY STANDING ON THE FLOOR?
// ═══════════════════════════════════════════════════════════════════════════
//
// The lowest either foot gets over a whole clip, against the height a foot
// rests at in the idle. They should be the same number: whatever a clip does,
// at some point in it a foot is on the ground.
//
// They were not. Measured at Build 155, on Ash and Mira alike:
//
//   idle 0.105    parry 0.105    sword 0.257    swordHeavy 0.259
//
// The sword clips never put a foot down once, over their whole length —
// fifteen centimetres of hover, for the entire swing. That is most of what was
// left of "the characters slide": a body whose feet never touch cannot look
// planted whatever the root is doing underneath it.
//
// It survived a hundred builds because the suite's foot check asks whether
// anybody SINKS INTO the paving. Nobody was. They were floating over it, and a
// one-sided test cannot see that.
const { boot } = require('./harness.cjs');
(async () => {
  const { J, sleep, browser } = await boot({ query: 'cast=3d&foot=off' });
  await sleep(600);
  await J(() => startCombat({ foes: ['husk'] }));
  for (let i = 0; i < 40 && !(await J(() => !!(window.Cast3D && window.Cast3D._figure('ash')))); i++) await sleep(250);
  const r = await J(() => {
    const C3 = window.Cast3D;
    const out = {};
    for (const who of ['ash', 'mira', 'foe0']) {
      const f = C3._figure(who); if (!f) continue;
      const rows = {};
      for (const name of ['idle', 'sword', 'daggers', 'swordHeavy', 'parry']) {
        const a = f.actions[name]; if (!a) continue;
        for (const k of Object.keys(f.actions)) { f.actions[k].setEffectiveWeight(0); f.actions[k].stop(); }
        if (f.idle) f.idle.setEffectiveWeight(0);
        a.reset(); a.setEffectiveWeight(1); a.play(); a.paused = true;
        const dur = a.getClip().duration;
        let ankLo = 1e9, ankHi = -1e9, toeLo = 1e9;
        for (let i = 0; i < 60; i++) {
          a.time = dur * i / 59; f.mixer.update(0); f.root.updateMatrixWorld(true);
          for (const s of ['Left', 'Right']) {
            const A = f.bones[s + 'Foot'], T = f.bones[s + 'ToeBase'];
            if (A) { const y = A.matrixWorld.elements[13]; ankLo = Math.min(ankLo, y); ankHi = Math.max(ankHi, y); }
            if (T) toeLo = Math.min(toeLo, T.matrixWorld.elements[13]);
          }
        }
        rows[name] = { ankLo: +ankLo.toFixed(3), ankHi: +ankHi.toFixed(3), toeLo: +toeLo.toFixed(3) };
      }
      out[who] = { rootY: +f.root.position.y.toFixed(3), rows };
    }
    return out;
  });
  for (const who of Object.keys(r)) {
    console.log(who + '  rootY=' + r[who].rootY);
    for (const k of Object.keys(r[who].rows)) {
      const v = r[who].rows[k];
      console.log('   ' + k.padEnd(12) + 'ankle ' + v.ankLo.toFixed(3) + ' .. ' + v.ankHi.toFixed(3)
        + '   toe low ' + v.toeLo.toFixed(3));
    }
  }
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
