// ── AUTHORING THE PARRY (Build 137) ────────────────────────────────────────
//
// The shipped `parry` clip does not parry. Measured on the rig, the whole clip
// moves the weapon hand THREE CENTIMETRES and rotates every bone in the body a
// combined 676 degrees over 1.9 seconds — against 8161 for the sword swing and
// 2824 for the flinch. Whatever GLB the mill was pointed at, it is a person
// standing still. That is what "play test parry, it needs work too" is: there
// was never a motion there to refine, and mirroring a three-centimetre clip
// would have produced two indistinguishable three-centimetre clips.
//
// The source GLBs are gone — the mill's inputs were six megabytes each and
// were never kept — so the parry is AUTHORED here, the way Build 112 authored
// the first eight verbs. Five of them, because a parry that does not answer
// the direction of the blow is the thing this build set out to fix: one for
// each arrow a note can carry, and one for a note that carries none.
//
// ── HOW A POSE IS WRITTEN ──────────────────────────────────────────────────
//
// Not as local bone quaternions. The rig's bind orientations are arbitrary —
// `Hips` rests at (-0.49, -0.49, -0.58, 0.43) — so "rotate the upper arm about
// its X" means nothing you can picture, and picking axes by guessing is the
// exact mistake this codebase has paid for three times.
//
// So a pose is written in the BODY'S OWN FRAME, measured off the rest skeleton
// rather than assumed: up runs hips-to-head, right runs left-shoulder-to-right,
// forward is their cross product. On this rig that comes out +Y up, -X right,
// +Z forward. A pose says "turn the chest 12 degrees to the right and lean it
// 8 back" and this file does the algebra:
//
//     A_s(b) = R(b) · G_s(b)            the world orientation we want
//     q(b)   = A_s(parent)⁻¹ · A_s(b)   the local rotation that produces it
//
// which is the same departure-from-rest the loader's `retarget` reads, so the
// authored pose lands on Ash, Mira, Elin and every creature alike without
// anything here knowing their proportions.
import * as THREE from '../lib/three.module.min.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LIB = path.join(HERE, '../art/cast/clips.json');

const d = JSON.parse(fs.readFileSync(LIB, 'utf8'));
const rest = d.__rest, parent = d.__parent;

// ── the body's frame, measured ─────────────────────────────────────────────
// FK the rest pose once. The bone offsets come from frame 0 of any clip's
// position tracks, which are constant for everything but the hips.
const off = {};
for (const t of d.hurt.tracks) {
  if (!t.name.endsWith('.position')) continue;
  off[t.name.split('.')[0]] = new THREE.Vector3(t.values[0], t.values[1], t.values[2]);
}
const order = [];
{
  const seen = {};
  const visit = (n) => {
    if (seen[n] || !rest[n]) return;
    seen[n] = 1;
    if (parent[n]) visit(parent[n]);
    order.push(n);
  };
  Object.keys(rest).forEach(visit);
}
const Gs = {}, at = {};
for (const n of order) {
  const q = new THREE.Quaternion().fromArray(rest[n]).normalize();
  const p = parent[n];
  Gs[n] = (p ? Gs[p].clone() : new THREE.Quaternion()).multiply(q).normalize();
  const m = new THREE.Matrix4().compose(off[n] || new THREE.Vector3(), q, new THREE.Vector3(1, 1, 1));
  at[n] = new THREE.Vector3().setFromMatrixPosition(p ? new THREE.Matrix4().compose(at[p], Gs[p], new THREE.Vector3(1,1,1)).multiply(m) : m);
}
const AXIS = (() => {
  const up = new THREE.Vector3().subVectors(at.Head, at.Hips).normalize();
  const right = new THREE.Vector3().subVectors(at.RightShoulder, at.LeftShoulder).normalize();
  const fwd = new THREE.Vector3().crossVectors(up, right).normalize();
  // re-square: the shoulder line is not exactly perpendicular to the spine
  right.crossVectors(fwd, up).normalize();
  return { up, right, fwd };
})();

// ── a pose becomes a set of local quaternions ──────────────────────────────
const D = Math.PI / 180;
function localsFor(pose) {
  const As = {}, out = {};
  for (const b of order) {
    const spec = pose[b];
    let R = new THREE.Quaternion();
    if (spec) {
      // composed in one fixed order so a pose reads the same however it was typed
      for (const ax of ['up', 'right', 'fwd']) {
        if (!spec[ax]) continue;
        R.premultiply(new THREE.Quaternion().setFromAxisAngle(AXIS[ax], spec[ax] * D));
      }
      R.normalize();
    }
    As[b] = R.multiply(Gs[b]).normalize();
    const p = parent[b];
    out[b] = (p ? As[p].clone().invert().multiply(As[b]) : As[b].clone()).normalize();
  }
  return out;
}

// ── keys become a clip ─────────────────────────────────────────────────────
// Baked at 30fps with a smoothstep between authored keys. The loader resamples
// again anyway; baking the EASING here is what keeps a five-key clip from
// reading as five linear ramps bolted together.
const FPS = 30;
const ease = (u) => u * u * (3 - 2 * u);
function buildClip(name, keys, beat) {
  const dur = keys[keys.length - 1][0];
  const n = Math.max(2, Math.round(dur * FPS) + 1);
  const times = [];
  const bones = order.filter(b => keys.some(k => k[1][b]));
  // …plus every ancestor of a posed bone, because its local rotation changes
  // when its parent turns even if nobody posed it
  const need = new Set();
  for (const b of order) {
    let x = b;
    while (x) { if (bones.includes(x)) { need.add(b); break; } x = parent[x]; }
  }
  const track = {};
  for (const b of need) track[b] = [];
  const cache = keys.map(k => localsFor(k[1]));
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), qo = new THREE.Quaternion();
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * dur;
    times.push(+t.toFixed(4));
    let j = 0;
    while (j < keys.length - 2 && keys[j + 1][0] < t) j++;
    const t0 = keys[j][0], t1 = keys[j + 1][0];
    const u = ease(Math.min(1, Math.max(0, (t - t0) / Math.max(1e-6, t1 - t0))));
    for (const b of need) {
      qa.fromArray(cache[j][b]instanceof Array?cache[j][b]:cache[j][b].toArray());
      qb.fromArray(cache[j + 1][b].toArray());
      qo.copy(qa).slerp(qb, u).normalize();
      track[b].push(...qo.toArray().map(v => +v.toFixed(5)));
    }
  }
  return {
    name, duration: +dur.toFixed(4), uuid: 'authored-' + name, blendMode: 2500,
    window: [0, +dur.toFixed(4)], beat,
    tracks: [...need].map(b => ({
      name: b + '.quaternion', type: 'quaternion', times, values: track[b],
    })),
  };
}

// ── THE POSES ──────────────────────────────────────────────────────────────
// Degrees in the body's own frame. `up` turns, `right` leans fore/aft and
// swings a hanging limb forward, `fwd` swings a hanging limb across the body.
const REST = {};
const merge = (...o) => Object.assign({}, ...o.map(x => x || {}));
// read bone by bone, so a direction can override the brace where it disagrees
// with it and inherit it everywhere else
const over = (base, extra) => {
  const out = {};
  for (const b of new Set([...Object.keys(base), ...Object.keys(extra)]))
    out[b] = merge(base[b], extra[b]);
  return out;
};
const scale = (pose, k) => Object.fromEntries(Object.entries(pose).map(
  ([b, s]) => [b, Object.fromEntries(Object.entries(s).map(([a, v]) => [a, +(v * k).toFixed(2)]))]));

// The brace every parry passes through: weight dropped, knees loaded, chest
// bladed, chin tucked. On its own it is a flinch; what makes it a PARRY is the
// arms, and what makes it answer the note is where they go.
const BRACE = {
  Hips:      { right: 7, up: -5 },
  Spine:     { right: 6, up: -5 },
  Spine01:   { right: 7, up: -7 },
  Spine02:   { right: 6, up: -7 },
  neck:      { right: -6, up: 5 },
  Head:      { right: -9, up: 7 },
  LeftUpLeg:  { right: 17, up: 7 },
  LeftLeg:    { right: -30 },
  LeftFoot:   { right: 15 },
  RightUpLeg: { right: 8, up: -7 },
  RightLeg:   { right: -22 },
  RightFoot:  { right: 12 },
};

// ── WHICH AXIS IS "SIDEWAYS" IS A CAMERA QUESTION ──────────────────────────
//
// The first cut of this file built the two horizontal guards as reflections of
// each other across the sagittal plane. The algebra was right and the result
// was useless twice over.
//
// The small reason: a mirror swaps which arm LEADS, and these people hold one
// weapon. Ash's sword is in his right hand in both guards.
//
// The large reason: THE PARTY IS NOT FACING THE CAMERA. They stand on the left
// of the board turned toward the foe line, so from the lens their own left and
// right run almost straight into and out of the screen. Measured on the live
// world, the two mirrored guards carried the weapon hand the same 0.065 of a
// clip-space unit, the SAME WAY, because the difference between them was
// almost entirely depth — and depth is not a direction an arrow can mean.
//
// So sideways, for these guards, is the body's FORE-AND-AFT axis, which is the
// one that projects across the screen. A right arrow is met by driving the
// guard OUT along it, toward the thing that threw the blow; a left arrow by
// dragging it back past the shoulder. A push and a pull rather than a pair of
// reflections — and each of them reads in its FOLLOW-THROUGH, so every
// direction gets its own instead of an overshoot of its contact pose.
const PUSH = {
  RightShoulder: { up: -12, right: 16 },
  RightArm:      { right: 84, fwd: -34, up: -14 },
  RightForeArm:  { right: 26, fwd: -46 },
  RightHand:     { fwd: -26 },
  LeftShoulder:  { up: -14, right: 12 },
  LeftArm:       { right: 76, fwd: 26 },
  LeftForeArm:   { right: 22, fwd: 40 },
};
const PUSH_PAST = over(scale(PUSH, 1.1), {
  RightArm:     { right: 104, fwd: -30 },
  RightForeArm: { right: 52, fwd: -20 },
  LeftArm:      { right: 96, fwd: 22 },
  LeftForeArm:  { right: 46, fwd: 18 },
});
const PULL = {
  RightShoulder: { up: 10, right: 8 },
  RightArm:      { right: 58, fwd: 30, up: 16 },
  RightForeArm:  { right: 40, fwd: 44 },
  RightHand:     { fwd: 24 },
  LeftShoulder:  { up: 12, right: 6 },
  LeftArm:       { right: 52, fwd: 44 },
  LeftForeArm:   { right: 34, fwd: 56 },
};
const PULL_PAST = {
  RightShoulder: { up: 16, right: -10 },
  RightArm:      { right: -34, fwd: 22, up: 24 },
  RightForeArm:  { right: 12, fwd: 58 },
  RightHand:     { fwd: 30 },
  LeftShoulder:  { up: 18, right: -8 },
  LeftArm:       { right: -26, fwd: 36 },
  LeftForeArm:   { right: 8, fwd: 64 },
};
// the torso goes with the hands — this is the half that reads at a hundred and
// fifty pixels, where a wrist is three of them
const BRACE_PUSH = over(BRACE, { Hips: { up: -14, right: -4 }, Spine: { up: -12, right: -3 },
                                 Spine01: { up: -15, right: -4 }, Spine02: { up: -15, right: -4 },
                                 neck: { up: 8 }, Head: { up: 13 } });
const BRACE_PULL = over(BRACE, { Hips: { up: 15, right: 14 }, Spine: { up: 13, right: 12 },
                                 Spine01: { up: 17, right: 13 }, Spine02: { up: 17, right: 12 },
                                 neck: { up: -9, right: -12 }, Head: { up: -14, right: -16 },
                                 LeftUpLeg: { right: 8 }, LeftLeg: { right: -22 },
                                 RightUpLeg: { right: 24, up: -10 }, RightLeg: { right: -38 } });

// HIGH GUARD. Both arms drive up over the crown and the knees take the weight —
// a blow from above is met by getting UNDER it, not by turning out of the way.
const HIGH = {
  RightShoulder: { right: 22 }, LeftShoulder: { right: 22 },
  RightArm:  { right: 126, fwd: -22 }, LeftArm:  { right: 126, fwd: 22 },
  RightForeArm: { right: 40, fwd: -40 }, LeftForeArm: { right: 40, fwd: 40 },
  RightHand: { fwd: -18 }, LeftHand: { fwd: 18 },
};
const HIGH_PAST = over(HIGH, {
  RightArm: { right: 152, fwd: -14 }, LeftArm: { right: 152, fwd: 14 },
  RightForeArm: { right: 18, fwd: -26 }, LeftForeArm: { right: 18, fwd: 26 },
});
const BRACE_HIGH = over(BRACE, {
  Hips: { right: -3, up: 0 }, Spine: { right: -5, up: 0 },
  Spine01: { right: -7, up: 0 }, Spine02: { right: -6, up: 0 },
  neck: { right: 16, up: 0 }, Head: { right: 24, up: 0 },
  LeftUpLeg: { right: 30, up: 4 }, LeftLeg: { right: -54 }, LeftFoot: { right: 22 },
  RightUpLeg: { right: 28, up: -4 }, RightLeg: { right: -52 }, RightFoot: { right: 20 },
});
// LOW GUARD. Down onto the knee, both hands sweeping across the shins. The
// hips stay under the shoulders — an early cut leaned them twenty-six degrees
// forward and the figure read as cowering rather than dropping into a stance.
const LOW = {
  RightShoulder: { right: -14 }, LeftShoulder: { right: -14 },
  RightArm:  { right: 26, fwd: -26 }, LeftArm:  { right: 22, fwd: 40 },
  RightForeArm: { right: 30, fwd: -40 }, LeftForeArm: { right: 26, fwd: 52 },
};
const LOW_PAST = over(scale(LOW, 1.15), {
  RightArm: { right: 14, fwd: -34 }, LeftArm: { right: 10, fwd: 48 },
});
const BRACE_LOW = over(BRACE, {
  Hips: { right: 12, up: -6 }, Spine: { right: 10, up: -5 },
  Spine01: { right: 9, up: -6 }, Spine02: { right: 8, up: -6 },
  neck: { right: -10 }, Head: { right: -14 },
  LeftUpLeg: { right: 54, up: 8 }, LeftLeg: { right: -92 }, LeftFoot: { right: 38 },
  RightUpLeg: { right: 26, up: -8 }, RightLeg: { right: -72 }, RightFoot: { right: 30 },
});
// STRAIGHT DOWN THE MIDDLE, for a note with no arrow: a short shove, both
// hands out at chest height.
const MID = {
  RightShoulder: { right: 8 }, LeftShoulder: { right: 8 },
  RightArm:  { right: 78, fwd: -20 }, LeftArm:  { right: 74, fwd: 22 },
  RightForeArm: { right: 22, fwd: -30 }, LeftForeArm: { right: 20, fwd: 34 },
};

// ── THE SHAPE OF THE MOTION ────────────────────────────────────────────────
// Anticipation, contact, follow-through, recovery. Contact sits 30% in so the
// beat lands on the MEETING rather than on the wind-up, and the guard carries
// past it before it comes home — which is the difference between a block and a
// parry.
const BEAT = 0.66;
function shape(brace, arm, past) {
  const contact = over(brace, arm);
  // the wind-up is the brace half-taken with the guard still low: the body has
  // committed, the hands have not arrived
  const wind = over(scale(brace, 0.45), scale(arm, -0.2));
  return [
    [0.00, REST],
    [0.11, wind],
    [0.26, contact],
    [0.44, over(brace, past || scale(arm, 1.2))],
    [0.66, brace],
    [0.88, REST],
  ];
}

const SPEC = {
  parry:  [BRACE,       MID,  null],
  parryR: [BRACE_PUSH,  PUSH, PUSH_PAST],
  parryL: [BRACE_PULL,  PULL, PULL_PAST],
  parryU: [BRACE_HIGH,  HIGH, HIGH_PAST],
  parryD: [BRACE_LOW,   LOW,  LOW_PAST],
};
for (const [name, [brace, arm, past]] of Object.entries(SPEC)) {
  d[name] = buildClip(name, shape(brace, arm, past), BEAT);
}
fs.writeFileSync(LIB, JSON.stringify(d));
const kb = (n) => (JSON.stringify(d[n]).length / 1024).toFixed(1) + 'kB';
console.log('authored', Object.keys(SPEC).map(n => n + ' ' + kb(n)).join('  '));
console.log('body frame  up', AXIS.up.toArray().map(v => +v.toFixed(2)),
            ' right', AXIS.right.toArray().map(v => +v.toFixed(2)),
            ' fwd', AXIS.fwd.toArray().map(v => +v.toFixed(2)));
console.log('library', (fs.statSync(LIB).size / 1024).toFixed(0) + 'kB');
