'use strict';
// DOES THE CONVERSION DEPEND ON WHICH WAY THE SOURCE IS STANDING?
//
// It must not. A retarget asks each bone what it did relative to its own rest
// pose and replays that against our rest, so turning the whole source rig
// before sampling has to come out the same clip. Turning it and comparing is
// therefore a complete test of the property, and it needs nothing but the one
// FBX already in the repo.
//
// THIS IS THE CHECK THE IMPORTER'S OWN GATE COULD NOT BE. That gate asks how
// far the furthest joint TURNED, and the angle of a rotation does not change
// when you change the frame you measure it in — so a clip rotated into
// completely the wrong axes turns exactly as far as one rotated correctly. It
// read a healthy number over a party folded in half.
//
//   node test/retarget.probe.cjs [degrees]
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const HERE = path.resolve(__dirname, '..');
const SRC = path.join(HERE, '..', 'import', 'samba.fbx');
const spin = process.argv[2] || '-90';

if (!fs.existsSync(SRC)) {
  console.error('no ' + SRC + ' — this probe needs one source animation to convert twice');
  process.exit(2);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'retarget-'));
const manifest = path.join(tmp, 'manifest.json');
fs.writeFileSync(manifest, JSON.stringify({ probe: { file: SRC } }));

// a fresh library each run, carrying only the rest pose a conversion needs
const base = JSON.parse(fs.readFileSync(path.join(HERE, 'art', 'cast', 'clips.json'), 'utf8'));
const seed = { __rest: base.__rest, __parent: base.__parent, idle: base.idle };

const run = (deg) => {
  const out = path.join(tmp, 'out' + deg + '.json');
  fs.writeFileSync(out, JSON.stringify(seed));
  execFileSync('node', [path.join(HERE, 'tools', 'unreal.cjs'), manifest, out],
               { env: { ...process.env, SPIN: String(deg) }, stdio: 'pipe' });
  return JSON.parse(fs.readFileSync(out, 'utf8')).probe;
};

const flat = run(0);
const spun = run(spin);
if (!flat || !spun) { console.error('the importer wrote no clip'); process.exit(1); }

const byName = (c) => Object.fromEntries(c.tracks.map(t => [t.name, t]));
const A = byName(flat), B = byName(spun);
const rows = [];
for (const name of Object.keys(A)) {
  if (!name.endsWith('.quaternion') || !B[name]) continue;
  const a = A[name].values, b = B[name].values;
  let worst = 0;
  for (let i = 0; i + 3 < Math.min(a.length, b.length); i += 4) {
    // a quaternion and its negation are the same rotation
    let d = Math.abs(a[i] * b[i] + a[i + 1] * b[i + 1] + a[i + 2] * b[i + 2] + a[i + 3] * b[i + 3]);
    worst = Math.max(worst, 2 * Math.acos(Math.min(1, d)) * 180 / Math.PI);
  }
  rows.push([name.replace('.quaternion', ''), worst]);
}
rows.sort((x, y) => y[1] - x[1]);
const worst = rows.length ? rows[0][1] : 999;
// WHERE THE BAR SITS, AND WHY IT IS NOT ZERO. The library rounds quaternion
// components to four decimals, so two byte-identical conversions still read
// about 2.3 degrees apart through this metric — a dot product wrong in the
// fourth decimal is an angle wrong in the second. Measured: the fixed
// conversion reads 2.0 on every one of the 22 bones, which is that floor and
// nothing else. The broken one read 180.0 at the hips and 94 to 170 across the
// arms and head. Five degrees is clear of the floor and nowhere near the fault.
const BAR = 5;
console.log('source turned ' + spin + ' degrees about x before sampling; '
  + rows.length + ' bones compared');
for (const [n, d] of rows.slice(0, 6))
  console.log('  ' + n.padEnd(16) + d.toFixed(1).padStart(7) + ' deg apart');
console.log('');
console.log(worst < BAR
  ? 'PASS  the conversion is the same clip either way — worst bone ' + worst.toFixed(2) + ' deg'
  : 'FAIL  standing the source on its side changed the animation — worst bone '
    + worst.toFixed(1) + ' deg. The departure is being measured in the world rather'
    + ' than in each bone\'s own rest frame.');
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(worst < BAR ? 0 : 1);
