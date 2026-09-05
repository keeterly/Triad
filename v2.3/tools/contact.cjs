'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// WHERE THE BLOW LANDS — find each clip's contact frame and write it down
// ═══════════════════════════════════════════════════════════════════════════
//
//   node v2.3/tools/contact.cjs            report only
//   node v2.3/tools/contact.cjs --write    write `hit` into clips.json
//
// A clip's `beat` says how long the verb is on screen. Nothing said WHEN in
// that span the weapon arrives, so damage, the flash, the screen kick and the
// number all fired on the beat's schedule rather than on the frame the swing
// actually connects. That is most of "it doesn't look like our character is
// performing the attack to hit the enemy".
//
// THREE DEFINITIONS WERE MEASURED AND TWO WERE THROWN AWAY.
//
//   furthest forward   the hand's reach along the body's own forward axis.
//                      Right for a thrust, wrong for a cut that arrives across
//                      the body, and it disagreed with the pictures.
//   nearest the foe     the obvious physical answer, and unusable: the hips are
//                      pinned in the horizontal plane and the run-time lunge is
//                      what closes the distance, so the hand never gets nearer
//                      than half a metre in ANY clip and the reading is really
//                      about where the figure happens to be standing.
//   fastest             the moment the weapon hand is moving quickest RELATIVE
//                      TO THE HIPS. This is where an animator times a hit, it
//                      needs no target and no facing, and a step or a lunge
//                      cannot be mistaken for the arm.
//
// The third one is coherent where the others were not. Measured on the pack,
// the four attacks peak at 0.14 to 0.20 of the clip at speeds of 0.36 to 0.64,
// against about 0.1 for everything that is not a swing — a single spike across
// adjacent frames rather than a plateau. The spell clips peak late (cast 0.90),
// which is a spell releasing at the end of a gather, and correct.
//
// IT IS A HEURISTIC AND IT IS WRITTEN DOWN so it can be argued with: the value
// lands in clips.json as `hit`, and editing it there beats re-deriving it.
const fs = require('fs');
const path = require('path');
const { boot } = require('../test/harness.cjs');

const FILE = path.resolve(__dirname, '../art/cast/clips.json');
const WRITE = process.argv.includes('--write');
// nothing but an action has a contact frame; a stagger or a death is not aimed
const SKIP = /^(idle|hurt|down|get_up|parry)/;

(async () => {
  const { page, J, sleep, browser } = await boot({ query: 'cast=3d' });
  page.on('pageerror', e => console.log('!! PAGE ERROR:', e.message));
  await sleep(600);
  await J(() => startCombat({ foes: ['husk'] }));
  for (let i = 0; i < 40 && !(await J(() => !!(window.Cast3D && window.Cast3D._figure('ash')))); i++) await sleep(250);

  const out = await J(async () => {
    const C3 = window.Cast3D, f = C3._figure('ash');
    const B = {}; f.root.traverse(o => { if (o.isBone) B[o.name] = o; });
    const wp = (n) => { const m = B[n].matrixWorld.elements; return [m[12], m[13], m[14]]; };
    const res = {}, N = 60;
    for (const clip of Object.keys(f.actions)) {
      const a = f.actions[clip], dur = a.getClip().duration;
      const L = [], R = [], hip = [];
      for (let i = 0; i < N; i++) {
        for (const k of Object.keys(f.actions)) { f.actions[k].setEffectiveWeight(0); f.actions[k].stop(); }
        if (f.idle) f.idle.setEffectiveWeight(0);
        a.reset(); a.setEffectiveWeight(1); a.play(); a.paused = true;
        a.time = dur * (i / (N - 1)) * 0.999;
        f.mixer.update(0); f.root.updateMatrixWorld(true);
        L.push(wp('LeftHand')); R.push(wp('RightHand')); hip.push(wp('Hips'));
      }
      const span = (H) => { let mn = [1e9,1e9,1e9], mx = [-1e9,-1e9,-1e9];
        for (const p of H) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], p[k]); mx[k] = Math.max(mx[k], p[k]); }
        return Math.hypot(mx[0]-mn[0], mx[1]-mn[1], mx[2]-mn[2]); };
      // whichever hand travels further is the one holding the weapon
      const H = span(R) >= span(L) ? R : L;
      let at = 0, best = -1;
      for (let i = 1; i < N; i++) {
        const p = [H[i-1][0]-hip[i-1][0], H[i-1][1]-hip[i-1][1], H[i-1][2]-hip[i-1][2]];
        const q = [H[i][0]-hip[i][0],     H[i][1]-hip[i][1],     H[i][2]-hip[i][2]];
        const s = Math.hypot(q[0]-p[0], q[1]-p[1], q[2]-p[2]);
        if (s > best) { best = s; at = i / (N - 1); }
      }
      res[clip] = { at: +at.toFixed(3), speed: +best.toFixed(3), travel: +span(H).toFixed(2) };
    }
    for (const k of Object.keys(f.actions)) { f.actions[k].paused = false; f.actions[k].setEffectiveWeight(0); f.actions[k].stop(); }
    f.acting = null; if (f.idle) f.idle.setEffectiveWeight(1);
    return res;
  });
  await browser.close();

  const lib = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  console.log('clip           travel   hit@   speed   action?');
  let wrote = 0;
  for (const [k, v] of Object.entries(out)) {
    const act = !SKIP.test(k);
    console.log(k.padEnd(14) + String(v.travel).padStart(6) + String(v.at).padStart(8)
      + String(v.speed).padStart(8) + (act ? '   yes' : '   —'));
    if (WRITE && act && lib[k]) { lib[k].hit = v.at; wrote++; }
  }
  if (WRITE) {
    fs.writeFileSync(FILE, JSON.stringify(lib));
    console.log('\nwrote `hit` on ' + wrote + ' clips into ' + path.relative(process.cwd(), FILE));
  } else {
    console.log('\n(report only — pass --write to put these in clips.json)');
  }
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
