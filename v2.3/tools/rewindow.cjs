// ═══════════════════════════════════════════════════════════════════════════
// THE RE-WINDOW — choose the span the BEAT can afford, and play it at speed
// ═══════════════════════════════════════════════════════════════════════════
//
// Build 118 measured where the motion lives in each clip and kept the shortest
// span holding 86% of it. That was the right question for "which part of this
// clip matters" and the WRONG one for "what does the fight have time for", and
// the two got composed: the window came out at 3.05 seconds for a sword swing,
// the beat gives it one, and the runtime divided — so the swing played at 3.05x
// and the parry at 3.52x. Sped up past about a quarter, motion stops reading as
// motion; it reads as a fault.
//
//   clip     window   beat    rate
//   sword     3.05s   1.00s   3.05x
//   ward      2.85s   0.85s   3.35x
//   parry     1.48s   0.42s   3.52x
//   idle      1.14s   2.40s   0.47x   ← and the other way, underwater
//
// So the rule is inverted. The beat is the fixed thing: it says how long this
// verb has on screen. The window is then simply THE BEST SPAN OF THAT LENGTH —
// slide a window of the beat's duration along the clip and keep wherever the
// most motion is. Playback lands at 1.0x by construction, and the clip is
// authored at the speed a human animated it at, which is the speed it looks
// right at.
//
// A small overrun is allowed: taking up to 25% more clip than the beat and
// playing it 25% quick reads as urgency rather than as fast-forward, and it
// buys back the anticipation that a hard cut at the beat would lose.
//
// LOOPS ARE EXEMPT, AND THIS IS THE OTHER HALF OF THE BUG. You cannot cut an
// arbitrary window out of a loop and expect it to loop: the pose where you cut
// in is not the pose where you cut out. Measured on the shipped library, the
// idle's authored loop closes to 1.4 degrees and the windowed one to 7.2 — a
// five-fold worse seam, snapping every cycle, which is exactly what "the
// looping is not natural" looks like. A looping clip keeps every frame it was
// authored with.
//
//   node v2.3/tools/rewindow.cjs <clips.json>
'use strict';
const fs = require('fs');

const FILE = process.argv[2];
if (!FILE) { console.error('usage: node rewindow.cjs <clips.json>'); process.exit(2); }

// how long the fight gives each verb, in seconds on screen
const BEAT = {
  sword: 1.15, daggers: 1.00, staff: 1.00, cast: 1.20, heal: 1.10,
  ward: 1.05, parry: 0.66, hurt: 0.66,
  // a death is the one beat that must not be hurried: `down` HOLDS when it
  // finishes, so the fall gets its own length rather than the fight's.
  down: 2.05,
};
const LOOPS = { idle: true };
const OVERRUN = 1.20;      // the most clip a beat may hold, played that much quick
const PAD = 0.045;         // a breath either side, so a cut is never on the frame

function quatTracks(clip) { return clip.tracks.filter(t => /\.quaternion$/.test(t.name)); }

// the same motion-energy curve the mill measures, on one common timeline
function energy(clip) {
  const rots = quatTracks(clip);
  if (!rots.length) return null;
  const base = rots.reduce((a, b) => (b.times.length > a.times.length ? b : a));
  const times = base.times, n = times.length;
  if (n < 4) return null;
  const e = new Array(n).fill(0);
  for (const t of rots) {
    const v = t.values, m = t.times.length;
    for (let i = 1; i < m; i++) {
      let d = 0;
      for (let k = 0; k < 4; k++) d += v[(i - 1) * 4 + k] * v[i * 4 + k];
      const at = Math.min(n - 1, Math.round((t.times[i] / times[n - 1]) * (n - 1)));
      e[at] += 1 - Math.abs(d);
    }
  }
  return { times, e };
}

// slide a window of `span` seconds and keep where the most motion is
function bestSpan(times, e, span) {
  const n = times.length;
  let best = [times[0], Math.min(times[n - 1], times[0] + span)], bestSum = -1;
  for (let lo = 0; lo < n; lo++) {
    const t0 = times[lo], t1 = t0 + span;
    if (t1 > times[n - 1] + 1e-6) break;
    let sum = 0;
    for (let hi = lo; hi < n && times[hi] <= t1; hi++) sum += e[hi];
    if (sum > bestSum) { bestSum = sum; best = [t0, t1]; }
  }
  return best;
}

const lib = JSON.parse(fs.readFileSync(FILE, 'utf8'));
console.log(`  ${'clip'.padEnd(9)} ${'full'.padStart(6)} ${'beat'.padStart(6)} ${'window'.padStart(15)} ${'plays at'.padStart(9)}`);
for (const name of Object.keys(lib)) {
  if (name.startsWith('__')) continue;
  const clip = lib[name];
  const dur = clip.duration;
  if (LOOPS[name]) {
    delete clip.window;
    clip.loop = true; clip.beat = dur;
    console.log(`  ${name.padEnd(9)} ${dur.toFixed(2).padStart(6)} ${'loop'.padStart(6)} ${'(whole clip)'.padStart(15)} ${'1.00x'.padStart(9)}`);
    continue;
  }
  const beat = BEAT[name];
  if (!beat) { console.log(`  ${name.padEnd(9)} — no beat, left as it was`); continue; }
  const en = energy(clip);
  if (!en) continue;
  // THE PAD IS PART OF THE BUDGET, NOT ON TOP OF IT. Adding a breath either
  // side after choosing a full-length span pushes the window past what the beat
  // can hold and the rate creeps back up — which is how a 1.20 ceiling shipped
  // as 1.37. The search asks for the pad's worth less, and gets it back.
  const span = Math.max(0.05, Math.min(dur, beat * OVERRUN) - 2 * PAD);
  let [a, b] = bestSpan(en.times, en.e, span);
  a = Math.max(0, a - PAD); b = Math.min(dur, b + PAD);
  clip.window = [+a.toFixed(3), +b.toFixed(3)];
  // THE BEAT TRAVELS WITH THE CLIP. It was a table in cast3d.js and a table
  // here, and two tables that must agree are one bug waiting for somebody to
  // edit the wrong one. The library states how long each clip is meant to take;
  // the runtime divides and gets the rate.
  clip.beat = beat;
  const rate = (b - a) / beat;
  console.log(`  ${name.padEnd(9)} ${dur.toFixed(2).padStart(6)} ${beat.toFixed(2).padStart(6)}`
    + ` ${(a.toFixed(2) + '-' + b.toFixed(2) + 's').padStart(15)} ${(rate.toFixed(2) + 'x').padStart(9)}`);
}
fs.writeFileSync(FILE, JSON.stringify(lib));
console.log(`\n  ${FILE} rewritten (${(fs.statSync(FILE).size / 1024).toFixed(0)} KB)`);
