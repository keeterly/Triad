// ═══════════════════════════════════════════════════════════════════════════
// KEEP THE PARTY ON THE PAVING — rescale a clip's upward hip travel
// ═══════════════════════════════════════════════════════════════════════════
//
//   node tools/ground.mjs                      report every clip's hip lift
//   node tools/ground.mjs sword=12 down=10     rescale those, in centimetres
//
// A clip carries its root motion on `Hips.position`, and two of ours carry far
// too much of it upward: `sword` raised the hips 70cm and `down` 89cm, against
// 2 to 10 for every other action in the library. On screen that is a figure
// hanging in mid-air over the plaza while the player lines up the next card,
// which reads as the animation being broken — and it is the thing a screenshot
// of it looks like.
//
// ONLY THE UP IS TOUCHED. A crouch is a real pose and a knock-down really does
// end on the floor, so keys BELOW the clip's own resting height are left
// exactly as they are; only the excursion above it is scaled, which keeps the
// shape of the arc and takes out the height. The horizontal travel is not
// touched either — a lunge across the tile is wanted.
import fs from 'fs';
const OUT = 'art/cast/clips.json';
const lib = JSON.parse(fs.readFileSync(OUT, 'utf8'));

const hipsOf = (clip) => (lib[clip].tracks || []).find(t => t.name === 'Hips.position');
const lift = (t) => {
  const ys = []; for (let i = 1; i < t.values.length; i += 3) ys.push(t.values[i]);
  return { rest: ys[0], max: Math.max(...ys), min: Math.min(...ys) };
};

const jobs = process.argv.slice(2).map(a => a.split('=')).filter(a => a.length === 2);
if (!jobs.length) {
  console.log('clip        rest    max     up      down');
  for (const k of Object.keys(lib)) {
    if (k.startsWith('__') || !hipsOf(k)) continue;
    const l = lift(hipsOf(k));
    console.log(k.padEnd(11) + l.rest.toFixed(1).padStart(6) + l.max.toFixed(1).padStart(8)
      + (l.max - l.rest).toFixed(1).padStart(8) + (l.rest - l.min).toFixed(1).padStart(8));
  }
  process.exit(0);
}

for (const [clip, want] of jobs) {
  const t = hipsOf(clip);
  if (!t) { console.error('no Hips.position on ' + clip); process.exit(1); }
  const l = lift(t);
  const up = l.max - l.rest;
  if (up <= +want) { console.log(clip + ': already ' + up.toFixed(1) + 'cm, left alone'); continue; }
  const k = +want / up;
  for (let i = 1; i < t.values.length; i += 3)
    if (t.values[i] > l.rest) t.values[i] = +(l.rest + (t.values[i] - l.rest) * k).toFixed(4);
  const after = lift(t);
  console.log(clip + ': hip lift ' + up.toFixed(1) + ' -> ' + (after.max - after.rest).toFixed(1)
    + 'cm  (scaled by ' + k.toFixed(3) + '; the drop to ' + after.min.toFixed(1) + ' is untouched)');
}
fs.writeFileSync(OUT, JSON.stringify(lib));
console.log('wrote ' + OUT);
