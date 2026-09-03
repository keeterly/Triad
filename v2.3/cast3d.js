// ═══════════════════════════════════════════════════════════════════════════
// THE CAST IN THREE DIMENSIONS
// ═══════════════════════════════════════════════════════════════════════════
//
// A painted sprite can only face one way. Every hero on this stage has been a
// single .webp since Build 4, which is why they turn to face the camera when
// they cross the board, why a strike is a CSS nudge rather than a swing, and
// why the all-out is four sprites sliding at a fifth. The figures are the one
// part of the fight that cannot act.
//
// THIS LAYER DOES NOT REPLACE THE STAGE. That is the whole design. The DOM
// keeps every job it already does — .k-hero holds the box, the row, the drag,
// the aim target, the popups, the shadow, the drop zones, the party HUD. This
// draws ONE canvas across #k-cast, reads where the DOM has put each hero this
// frame, and paints a figure into that box. Nothing above it knows the
// difference; the img inside .k-fig is simply hidden.
//
// It follows that a CSS transform on .k-hero — the walk between rows, the
// drag, the forward lean on a play — moves the 3D figure too, for free and in
// perfect sync, because the figure's position IS the element's box read fresh
// every frame. There is no second copy of the layout to keep true.
//
// OFF BY DEFAULT. `?cast=3d` turns it on. The eight suites run the 2D stage
// exactly as before.

import * as THREE from './lib/three.module.min.js';
import { GLTFLoader } from './lib/GLTFLoader.js';
import { clone as cloneSkinned } from './lib/SkeletonUtils.js';

// ── who is on the board, and what colour they are ──────────────────────────
//
// ONE MODEL, THREE PEOPLE, and that is not a placeholder shrug — it is the
// experiment. Three separately generated models will never share proportion,
// palette or silhouette language; each generation is a lottery. If the
// watercolour treatment can make three copies of ONE figure read as three
// different people, it can carry three different figures into one party. The
// palette is the variable: paper, shadow and ink per hero, plus a height and a
// standing angle.
// THE HUE LIVES IN THE SHADOW, NOT IN THE PAPER. Tinting the light end is how
// three figures turn into three lumps of colour — cream, sage and gold — that
// read as silhouettes rather than as painted people. Real watercolour keeps
// the paper nearly white and does its colouring where the pigment pools, so
// each hero gets a near-neutral paper and a shadow that carries the character:
// warm earth for Ash, cold slate for Elin, sage for Mira.
const CAST = {
  ash:  { paper: 0xf7efe2, shadow: 0x9a7f6e, ink: 0x3d2f28, turn:  -14, tall: 1.00 },
  elin: { paper: 0xf2f4f7, shadow: 0x8d9ab4, ink: 0x343b4a, turn:    9, tall: 0.95 },
  mira: { paper: 0xeef2ea, shadow: 0x76907c, ink: 0x2b352e, turn:   16, tall: 0.96 },
};
const MODEL = './art/cast/aspirant.glb';

// ── the look, in one place ─────────────────────────────────────────────────
// `?cast=3d` reads these; window.Cast3D.look({...}) overrides them live, which
// is how they were chosen.
const LOOK = {
  bands: 5.0,   // how many washes the tone is stepped into
  wash:  0.55,  // …and how much of the real painting survives the stepping
  lift:  0.36,  // watercolour has no true black; the paper shows through
  edge:  0.78,  // pigment pooling at the silhouette — the signature move
  grain: 0.16,  // the paper's tooth, in screen space
  air:   0.78,  // how hard the row ladder washes out the back ranks
};
// what each dial does, for the panel — and so the next person to open this
// file does not have to read the shader to find out
const LOOK_HELP = {
  bands: ['washes', 2, 8, 1, 'how many flat tones the brush lays down'],
  wash:  ['flatten', 0, 1, 0.01, 'how much of the real painting the wash eats'],
  lift:  ['paper', 0, 0.8, 0.01, 'how far the blacks lift toward paper'],
  edge:  ['pooling', 0, 1.4, 0.01, 'pigment gathering at the silhouette'],
  grain: ['tooth', 0, 0.5, 0.01, 'the paper grain, in screen space'],
  air:   ['distance', 0, 1.6, 0.01, 'how hard the back ranks wash out'],
};

// ── the animation ──────────────────────────────────────────────────────────
//
// THE MODEL ARRIVED WITH NO ANIMATION. Its one clip is 0.3s long and holds a
// single keyframe per channel — a bind pose wearing an animation's name. What
// it does have is a 24-bone skeleton with MIXAMO NAMES (Hips, Spine, Spine01,
// LeftShoulder, LeftForeArm, neck, Head…), which means poses can be written
// against it by hand and, later, that Mixamo's own library retargets onto it
// without a rename.
//
// So the clips here are DATA, not baked curves: a bone name, and a few keys of
// euler rotation in degrees. That buys three things a downloaded clip does not.
// The timing can be tuned to the combat beats it has to hit rather than the
// other way round. A clip is thirty lines instead of a megabyte. And every
// verb the fight already speaks — actionKind() returns heal, cast, slash,
// ward — can have a clip named after it, so wiring is a lookup rather than a
// mapping table that drifts.
//
// Keys are [t, [x, y, z]] with t in SECONDS and rotations in DEGREES, applied
// as offsets from the bind pose. `hips` may also carry [t, [x,y,z], [dx,dy,dz]]
// — a translation offset in metres, which is what makes a lunge travel.
const D = Math.PI / 180;

// THE BIND POSE IS A T-POSE, and every clip here is written as an OFFSET from
// rest — which means that without this the party stands on the battlefield
// with their arms straight out for the whole fight, gently breathing. The
// model arrived in the pose a rigger hands over, not the pose a character
// stands in.
//
// So a STANCE is folded into rest once, at load: arms down and slightly
// forward, elbows soft, weight settled, head level. Clips then read as
// "eighteen degrees of shoulder" from a person standing, which is what makes
// them writable by hand at all.
const STANCE = {
  LeftShoulder:  [0, 0, -6],
  RightShoulder: [0, 0, 6],
  LeftArm:       [0, 0, -72],
  RightArm:      [0, 0, 72],
  LeftForeArm:   [0, -14, -12],
  RightForeArm:  [0, 14, 12],
  LeftHand:      [0, 0, -6],
  RightHand:     [0, 0, 6],
  Spine:         [2, 0, 0],
  Spine01:       [-1, 0, 0],
  neck:          [-2, 0, 0],
};

const CLIPS = {
  // IDLE IS THE ONE THAT MATTERS. A turn-based fight spends almost all of its
  // time with nobody acting; if the party is frozen between plays, the 3D
  // figures look worse than the sprites did, because a still 3D model reads as
  // a broken 3D model where a still painting reads as a painting. Breathing,
  // a slow weight shift, and a little drift in the arms — long, unequal
  // periods so three figures on one screen never fall into lockstep.
  idle: { loop: true, dur: 4.4, tracks: {
    Hips:          [[0, [0, 0, 0], [0, 0, 0]], [1.5, [1.2, 0, 0], [0, -0.012, 0]],
                    [3.0, [0, 0, 0], [0, 0.004, 0]], [4.4, [0, 0, 0], [0, 0, 0]]],
    Spine:         [[0, [0, 0, 0]], [1.5, [-1.6, 0.8, 0]], [3.0, [1.0, -0.6, 0]], [4.4, [0, 0, 0]]],
    Spine01:       [[0, [0, 0, 0]], [2.2, [-1.4, 0, 0]], [4.4, [0, 0, 0]]],
    neck:          [[0, [0, 0, 0]], [1.9, [1.8, -2.4, 0]], [3.6, [-1.0, 1.6, 0]], [4.4, [0, 0, 0]]],
    LeftArm:       [[0, [0, 0, 0]], [2.1, [0, 0, 3.2]], [4.4, [0, 0, 0]]],
    RightArm:      [[0, [0, 0, 0]], [2.6, [0, 0, -3.4]], [4.4, [0, 0, 0]]],
    LeftForeArm:   [[0, [0, 0, 0]], [2.4, [0, 0, 2.6]], [4.4, [0, 0, 0]]],
    RightForeArm:  [[0, [0, 0, 0]], [1.8, [0, 0, -2.2]], [4.4, [0, 0, 0]]],
  } },

  // A SWING NEEDS AN ANTICIPATION OR IT IS A TELEPORT. Wind back away from the
  // target for a third of the clip, snap through in three frames, then settle.
  // The hips travel forward on the snap and drift back on the settle — that
  // forward carry is most of what makes a hit feel like it had weight.
  slash: { dur: 0.72, tracks: {
    Hips:          [[0, [0, 0, 0], [0, 0, 0]], [0.24, [0, 14, 0], [0, 0, -0.05]],
                    [0.34, [0, -22, 0], [0, -0.02, 0.20]], [0.50, [0, -12, 0], [0, 0, 0.12]],
                    [0.72, [0, 0, 0], [0, 0, 0]]],
    Spine:         [[0, [0, 0, 0]], [0.24, [-8, 12, 0]], [0.34, [12, -18, 0]], [0.72, [0, 0, 0]]],
    Spine01:       [[0, [0, 0, 0]], [0.24, [-6, 8, 0]], [0.34, [10, -12, 0]], [0.72, [0, 0, 0]]],
    RightShoulder: [[0, [0, 0, 0]], [0.24, [0, 0, -18]], [0.34, [0, 0, 26]], [0.72, [0, 0, 0]]],
    RightArm:      [[0, [0, 0, 0]], [0.24, [-38, 0, -26]], [0.34, [46, 0, 34]], [0.72, [0, 0, 0]]],
    RightForeArm:  [[0, [0, 0, 0]], [0.24, [-46, 0, 0]], [0.34, [18, 0, 0]], [0.72, [0, 0, 0]]],
    LeftArm:       [[0, [0, 0, 0]], [0.24, [14, 0, 20]], [0.34, [-20, 0, -14]], [0.72, [0, 0, 0]]],
    neck:          [[0, [0, 0, 0]], [0.24, [-6, 10, 0]], [0.34, [10, -12, 0]], [0.72, [0, 0, 0]]],
  } },

  // A SPELL IS ANNOUNCED — the game already believes this; fxCast blooms a ring
  // under the caster before anything lands. So the clip is a gather and a
  // release, and it is SLOWER than the slash: you can see it coming.
  cast: { dur: 0.94, tracks: {
    Hips:          [[0, [0, 0, 0], [0, 0, 0]], [0.40, [-4, 0, 0], [0, -0.03, 0]],
                    [0.62, [6, 0, 0], [0, 0.02, 0.04]], [0.94, [0, 0, 0], [0, 0, 0]]],
    Spine:         [[0, [0, 0, 0]], [0.40, [-12, 0, 0]], [0.62, [10, 0, 0]], [0.94, [0, 0, 0]]],
    Spine01:       [[0, [0, 0, 0]], [0.40, [-8, 0, 0]], [0.62, [8, 0, 0]], [0.94, [0, 0, 0]]],
    LeftArm:       [[0, [0, 0, 0]], [0.40, [-52, 0, 24]], [0.62, [-28, 0, 40]], [0.94, [0, 0, 0]]],
    RightArm:      [[0, [0, 0, 0]], [0.40, [-52, 0, -24]], [0.62, [-28, 0, -40]], [0.94, [0, 0, 0]]],
    LeftForeArm:   [[0, [0, 0, 0]], [0.40, [-34, 0, 0]], [0.62, [-12, 0, 0]], [0.94, [0, 0, 0]]],
    RightForeArm:  [[0, [0, 0, 0]], [0.40, [-34, 0, 0]], [0.62, [-12, 0, 0]], [0.94, [0, 0, 0]]],
    neck:          [[0, [0, 0, 0]], [0.40, [-10, 0, 0]], [0.62, [6, 0, 0]], [0.94, [0, 0, 0]]],
  } },

  // A GUARD IS A BRACE, not a flourish: turn the shoulder in, drop the weight,
  // hold it a beat longer than feels necessary, come back up.
  ward: { dur: 0.80, tracks: {
    Hips:          [[0, [0, 0, 0], [0, 0, 0]], [0.20, [0, 18, 0], [0, -0.045, 0]],
                    [0.52, [0, 20, 0], [0, -0.05, 0]], [0.80, [0, 0, 0], [0, 0, 0]]],
    Spine:         [[0, [0, 0, 0]], [0.20, [10, 14, 0]], [0.52, [12, 16, 0]], [0.80, [0, 0, 0]]],
    LeftShoulder:  [[0, [0, 0, 0]], [0.20, [0, 0, 22]], [0.52, [0, 0, 24]], [0.80, [0, 0, 0]]],
    LeftArm:       [[0, [0, 0, 0]], [0.20, [-58, 0, 34]], [0.52, [-60, 0, 36]], [0.80, [0, 0, 0]]],
    LeftForeArm:   [[0, [0, 0, 0]], [0.20, [-64, 0, 0]], [0.52, [-66, 0, 0]], [0.80, [0, 0, 0]]],
    RightArm:      [[0, [0, 0, 0]], [0.20, [-24, 0, -18]], [0.52, [-26, 0, -20]], [0.80, [0, 0, 0]]],
    neck:          [[0, [0, 0, 0]], [0.20, [8, 8, 0]], [0.52, [9, 9, 0]], [0.80, [0, 0, 0]]],
  } },

  // MENDING OPENS. Everything else here closes the body; this one lifts the
  // chest and opens the arms, so heal reads as the opposite of guard even at
  // 145 pixels tall where you cannot see the hands.
  heal: { dur: 1.00, tracks: {
    Hips:          [[0, [0, 0, 0], [0, 0, 0]], [0.44, [-6, 0, 0], [0, 0.028, 0]], [1.00, [0, 0, 0], [0, 0, 0]]],
    Spine:         [[0, [0, 0, 0]], [0.44, [-14, 0, 0]], [1.00, [0, 0, 0]]],
    Spine01:       [[0, [0, 0, 0]], [0.44, [-10, 0, 0]], [1.00, [0, 0, 0]]],
    LeftArm:       [[0, [0, 0, 0]], [0.44, [-30, 0, 46]], [1.00, [0, 0, 0]]],
    RightArm:      [[0, [0, 0, 0]], [0.44, [-30, 0, -46]], [1.00, [0, 0, 0]]],
    LeftForeArm:   [[0, [0, 0, 0]], [0.44, [-16, 0, 0]], [1.00, [0, 0, 0]]],
    RightForeArm:  [[0, [0, 0, 0]], [0.44, [-16, 0, 0]], [1.00, [0, 0, 0]]],
    neck:          [[0, [0, 0, 0]], [0.44, [-16, 0, 0]], [1.00, [0, 0, 0]]],
  } },

  // TAKING A HIT IS FAST AND UGLY. Two frames out, four frames back.
  hurt: { dur: 0.46, tracks: {
    Hips:          [[0, [0, 0, 0], [0, 0, 0]], [0.09, [0, 0, 0], [0, -0.03, -0.10]],
                    [0.24, [0, 0, 0], [0, 0, -0.03]], [0.46, [0, 0, 0], [0, 0, 0]]],
    Spine:         [[0, [0, 0, 0]], [0.09, [18, -8, 0]], [0.24, [8, -4, 0]], [0.46, [0, 0, 0]]],
    Spine01:       [[0, [0, 0, 0]], [0.09, [14, -6, 0]], [0.46, [0, 0, 0]]],
    neck:          [[0, [0, 0, 0]], [0.09, [22, -10, 0]], [0.24, [10, -4, 0]], [0.46, [0, 0, 0]]],
    LeftArm:       [[0, [0, 0, 0]], [0.09, [0, 0, 26]], [0.46, [0, 0, 0]]],
    RightArm:      [[0, [0, 0, 0]], [0.09, [0, 0, -26]], [0.46, [0, 0, 0]]],
  } },

  // THE PARRY IS THE BEST THING IN THE GAME and it lasts a handful of frames,
  // so this is the shortest clip here: a turn into the blow, not away from it.
  parry: { dur: 0.34, tracks: {
    Hips:          [[0, [0, 0, 0], [0, 0, 0]], [0.08, [0, 26, 0], [0, -0.02, 0.05]], [0.34, [0, 0, 0], [0, 0, 0]]],
    Spine:         [[0, [0, 0, 0]], [0.08, [-6, 22, 0]], [0.34, [0, 0, 0]]],
    RightShoulder: [[0, [0, 0, 0]], [0.08, [0, 0, 30]], [0.34, [0, 0, 0]]],
    RightArm:      [[0, [0, 0, 0]], [0.08, [-64, 0, 22]], [0.34, [0, 0, 0]]],
    RightForeArm:  [[0, [0, 0, 0]], [0.08, [-70, 0, 0]], [0.34, [0, 0, 0]]],
    neck:          [[0, [0, 0, 0]], [0.08, [-4, 20, 0]], [0.34, [0, 0, 0]]],
  } },

  // DOWN HOLDS. Unlike every other clip this one does not return to idle — it
  // ends where it ends and stays there until the fight says otherwise.
  down: { dur: 0.90, hold: true, tracks: {
    Hips:          [[0, [0, 0, 0], [0, 0, 0]], [0.30, [0, 0, 0], [0, -0.22, -0.06]],
                    [0.90, [10, 0, 0], [0, -0.42, -0.10]]],
    Spine:         [[0, [0, 0, 0]], [0.30, [22, 6, 0]], [0.90, [40, 10, 0]]],
    Spine01:       [[0, [0, 0, 0]], [0.90, [26, 6, 0]]],
    neck:          [[0, [0, 0, 0]], [0.90, [34, 8, 0]]],
    LeftArm:       [[0, [0, 0, 0]], [0.90, [0, 0, 40]]],
    RightArm:      [[0, [0, 0, 0]], [0.90, [0, 0, -40]]],
    LeftUpLeg:     [[0, [0, 0, 0]], [0.90, [-30, 0, 0]]],
    RightUpLeg:    [[0, [0, 0, 0]], [0.90, [-24, 0, 0]]],
  } },
};

// ── the watercolour material ───────────────────────────────────────────────
//
// PATCHED, NOT REPLACED. A raw ShaderMaterial has to re-implement skinning,
// and a version that silently does not renders the bind pose — which looks
// exactly like an art problem and is not one. Patching the stock material also
// keeps normals and the view vector in the SAME space (three gives both in
// view space); dotting a view-space normal against a world-space eye vector
// turns the whole figure black.
//
// Four moves, and the third is the one that actually reads as watercolour:
//   1. lift      — watercolour has no true black; the paper shows through
//   2. wash      — luminance quantised into three bands, so tone STEPS
//   3. edge dark — pigment pools where the water stops. A thin fresnel band
//                  toward ink. Without it this reads as flat 3D, not as paint.
//   4. grain     — the paper's tooth, in SCREEN space, so it stays paper and
//                  does not swim around with the figure
function watercolour(map, tone) {
  const m = new THREE.MeshStandardMaterial({
    map, roughness: 1, metalness: 0, side: THREE.DoubleSide,
  });
  // ATMOSPHERIC PERSPECTIVE IS THE ROW LADDER. The painted stage sold FRONT /
  // MID / BACK with a CSS filter on the hero's img — saturate and brighten at
  // the front, wash out at the back — and hiding that img to put a figure
  // there would have quietly deleted the strongest depth cue on the board.
  // So the same ladder is a uniform: 1 at the front, 0 at the back.
  m.userData.depth = { value: 1 };
  // EVERY KNOB STAYS REACHABLE. Tuning a look by editing a constant, reloading
  // and comparing two screenshots taken a minute apart is how you end up
  // arguing about it; holding them all on the material means a sweep is one
  // page load and the comparison is side by side.
  m.userData.u = {
    uBands: { value: LOOK.bands }, uGrain: { value: LOOK.grain },
    uEdge:  { value: LOOK.edge },  uLift:  { value: LOOK.lift },
    uWash:  { value: LOOK.wash },  uAir:   { value: LOOK.air },
    uPaper: { value: new THREE.Color(tone.paper) },
    uShadow: { value: new THREE.Color(tone.shadow) },
    uInk:   { value: new THREE.Color(tone.ink) },
  };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uDepth = m.userData.depth;
    Object.assign(sh.uniforms, m.userData.u);
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', `
        uniform float uBands, uGrain, uEdge, uLift, uDepth, uWash, uAir;
        uniform vec3 uPaper, uShadow, uInk;
        float wcHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float wcTooth(vec2 p){
          vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          float a = mix(mix(wcHash(i), wcHash(i+vec2(1,0)), f.x),
                        mix(wcHash(i+vec2(0,1)), wcHash(i+vec2(1,1)), f.x), f.y);
          i = floor(p*2.3); f = fract(p*2.3); f = f*f*(3.0-2.0*f);
          float b = mix(mix(wcHash(i), wcHash(i+vec2(1,0)), f.x),
                        mix(wcHash(i+vec2(0,1)), wcHash(i+vec2(1,1)), f.x), f.y);
          return a*0.65 + b*0.35;
        }
        void main() {`)
      .replace('#include <dithering_fragment>', `
        #include <dithering_fragment>
        {
          vec3 c = gl_FragColor.rgb;
          c = mix(vec3(uLift), vec3(1.0), c);
          float lum = dot(c, vec3(0.299, 0.587, 0.114));
          // 2 · wash — quantise tone, and MIX BACK toward the true value.
          // At full strength three bands throw away every mark in the
          // texture, and a robe painted with a hundred folds arrives as
          // three flat shapes. uWash decides how much of the painting is
          // allowed to survive the brush.
          float q = max(floor(lum * uBands + 0.5) / uBands, 1.0 / (uBands * 2.0));
          float t = mix(lum, q, uWash);
          c *= t / max(lum, 0.001);
          c = mix(c * uShadow, c * uPaper, smoothstep(0.26, 0.88, t));
          float fres = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0), 3.6);
          c = mix(c, uInk, clamp(fres * uEdge, 0.0, 0.55));
          c *= 1.0 - uGrain * (1.0 - wcTooth(gl_FragCoord.xy * 0.85));
          // the ladder: back ranks lose saturation and sit down in value, and
          // drift toward the paper as if there were air in between
          float g = dot(c, vec3(0.299, 0.587, 0.114));
          float air = (1.0 - uDepth) * uAir;
          c = mix(c, vec3(g), air * 0.42);
          c *= 1.0 - air * 0.18;
          c = mix(c, uPaper * 0.92, air * 0.20);
          gl_FragColor.rgb = c;
        }`);
  };
  return m;
}

// ── the figure ─────────────────────────────────────────────────────────────
// One per hero: the cloned skeleton, the bones we can address by Mixamo name,
// and whatever clip is playing over the idle underneath it.
class Figure {
  constructor(root, tone) {
    this.root = root;
    this.tone = tone;
    this.bones = {};
    this.rest = {};
    root.traverse(o => {
      if (!o.isBone) return;
      this.bones[o.name] = o;
      // THE BIND POSE IS THE ZERO. Clips are written as offsets from wherever
      // the model actually stands, so a clip is readable as "eighteen degrees
      // of shoulder" rather than as an absolute quaternion nobody can picture.
      const st = STANCE[o.name];
      const q = o.quaternion.clone();
      if (st) q.multiply(new THREE.Quaternion().setFromEuler(
        new THREE.Euler(st[0] * D, st[1] * D, st[2] * D)));
      this.rest[o.name] = { q, p: o.position.clone() };
      // …and the stance is applied NOW, not only once a clip happens to touch
      // this bone: a bone no clip mentions must still stand naturally.
      o.quaternion.copy(q);
    });
    this.clip = null;      // the acting clip, or null
    this.t = 0;            // time inside it
    this.idleT = Math.random() * CLIPS.idle.dur;   // so three figures never sync
    this.blend = 0;        // 0 = pure idle, 1 = pure clip
  }

  play(name) {
    const c = CLIPS[name];
    if (!c) return false;
    this.clip = c; this.clipName = name; this.t = 0;
    return true;
  }

  clear() { this.clip = null; this.clipName = null; this.blend = 0; }

  // sample one track at time t → [rot(deg), pos(m)]
  static sample(keys, t) {
    if (!keys.length) return null;
    if (t <= keys[0][0]) return [keys[0][1], keys[0][2] || null];
    const last = keys[keys.length - 1];
    if (t >= last[0]) return [last[1], last[2] || null];
    for (let i = 1; i < keys.length; i++) {
      if (t > keys[i][0]) continue;
      const a = keys[i - 1], b = keys[i];
      let u = (t - a[0]) / (b[0] - a[0]);
      u = u * u * (3 - 2 * u);                       // smoothstep, not linear
      const lerp3 = (p, q) => p && q
        ? [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u, p[2] + (q[2] - p[2]) * u]
        : null;
      return [lerp3(a[1], b[1]), lerp3(a[2] || [0, 0, 0], b[2] || [0, 0, 0])];
    }
    return [last[1], last[2] || null];
  }

  step(dt) {
    this.idleT = (this.idleT + dt) % CLIPS.idle.dur;
    if (this.clip) {
      this.t += dt;
      if (this.t >= this.clip.dur && !this.clip.hold) this.clear();
      else if (this.t >= this.clip.dur) this.t = this.clip.dur;
    }
    // EASE IN AND OUT OF AN ACTION. A clip that snaps on at full strength pops,
    // and popping is the thing that gives away a rig. 90 ms each way.
    const want = this.clip ? 1 : 0;
    const rate = dt / 0.09;
    this.blend += Math.max(-rate, Math.min(rate, want - this.blend));

    const idle = CLIPS.idle.tracks;
    const act = this.clip ? this.clip.tracks : null;
    const names = this._names || (this._names = [...new Set(
      [...Object.keys(idle), ...Object.values(CLIPS).flatMap(c => Object.keys(c.tracks))])]);

    const e = new THREE.Euler(), q = new THREE.Quaternion();
    for (const n of names) {
      const b = this.bones[n]; if (!b) continue;
      const rest = this.rest[n];
      const i = idle[n] ? Figure.sample(idle[n], this.idleT) : null;
      const a = act && act[n] ? Figure.sample(act[n], this.t) : null;
      const mix = (x, y) => (x || 0) * (1 - this.blend) + (y || 0) * this.blend;
      const ir = i ? i[0] : [0, 0, 0], ar = a ? a[0] : [0, 0, 0];
      e.set(mix(ir[0], ar[0]) * D, mix(ir[1], ar[1]) * D, mix(ir[2], ar[2]) * D);
      q.setFromEuler(e);
      b.quaternion.copy(rest.q).multiply(q);
      const ip = i ? i[1] : null, ap = a ? a[1] : null;
      if (ip || ap) {
        const i0 = ip || [0, 0, 0], a0 = ap || [0, 0, 0];
        b.position.set(rest.p.x + mix(i0[0], a0[0]),
                       rest.p.y + mix(i0[1], a0[1]),
                       rest.p.z + mix(i0[2], a0[2]));
      }
    }
  }
}

// ── the layer ──────────────────────────────────────────────────────────────
const Cast3D = (() => {
  let on = false, ready = false, failed = null;
  let renderer = null, scene = null, cam = null, canvas = null;
  const figs = {};
  let last = 0, raf = 0, pending = null;

  // THE CAMERA IS ORTHOGRAPHIC and every figure gets its own slice of it. A
  // perspective camera spanning the whole stage would splay the outer heroes
  // outward, which fights the painted backdrop's own vanishing point and makes
  // the party look like it is standing in a fish-eye. Orthographic keeps each
  // figure square to the viewer, exactly like the sprites it replaces, and the
  // 3D is spent on ROTATION and MOTION rather than on perspective.
  const VIEW_H = 2.0;   // world metres visible top to bottom in a hero's box

  function build() {
    const host = document.getElementById('k-cast');
    if (!host) return false;
    canvas = document.createElement('canvas');
    canvas.id = 'k-cast3d';
    // it sits UNDER the DOM heroes, which keep the shadows, rows and popups
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;'
      + 'pointer-events:none;z-index:1;';
    host.insertBefore(canvas, host.firstChild);
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    } catch (err) { failed = 'no webgl: ' + err.message; return false; }
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setScissorTest(true);
    scene = new THREE.Scene();
    // FLAT LIGHT. Paper dolls are lit like paper, not like film: a big ambient
    // so the washes read as washes, and two weak directionals only so the
    // silhouette has any form at all when a figure turns.
    scene.add(new THREE.AmbientLight(0xffffff, 2.1));
    const k = new THREE.DirectionalLight(0xffffff, 0.9); k.position.set(2.5, 4, 3);
    const r = new THREE.DirectionalLight(0x9fb6d8, 0.5); r.position.set(-3, 2, -2.5);
    scene.add(k, r);
    cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 40);
    return true;
  }

  async function load() {
    const gltf = await new GLTFLoader().loadAsync(MODEL);
    let map = null;
    gltf.scene.traverse(o => {
      if (o.isMesh || o.isSkinnedMesh) map = map || o.material.map || o.material.emissiveMap;
    });
    for (const id of Object.keys(CAST)) {
      const tone = CAST[id];
      // SkeletonUtils.clone, NOT Object3D.clone. The latter hands every copy
      // the ORIGINAL's skeleton, so three figures share one pose and only the
      // first one animates — and the symptom is that they all stand in the
      // bind pose, which reads as "the rig is broken".
      const root = cloneSkinned(gltf.scene);
      const mat = watercolour(map, tone);
      root.traverse(o => { if (o.isMesh || o.isSkinnedMesh) { o.material = mat; o.frustumCulled = false; } });
      root.userData.mat = mat;
      root.rotation.y = tone.turn * D;
      root.scale.setScalar(tone.tall);
      scene.add(root);
      figs[id] = new Figure(root, tone);
    }
    ready = true;
  }

  // Where the DOM has put this hero, in canvas pixels, THIS frame.
  function boxOf(id) {
    const h = document.querySelector('.k-hero[data-hero="' + id + '"]');
    if (!h) return null;
    const host = document.getElementById('k-cast');
    if (!host) return null;
    const a = h.getBoundingClientRect(), b = host.getBoundingClientRect();
    if (!a.width || !b.width) return null;
    // the canvas is laid out over #k-cast, so subtracting its origin gives
    // canvas-local CSS pixels; the scissor wants them from the BOTTOM
    // …and which rank it is standing in, because that is a picture decision
    const depth = h.classList.contains('k-row-front') ? 1
                : h.classList.contains('k-row-mid') ? 0.55 : 0;
    return { x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height,
             hostH: b.height, depth, vis: h.offsetParent !== null };
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!ready || !on) return;
    const host = document.getElementById('k-cast');
    if (!host) return;
    // THE CLAMP GUARDS A RESTORED TAB, NOT A SLOW ONE. At 0.05 it also ate
    // time on any device running below 20fps — the clips played in slow motion
    // and, worse, drifted out of step with the combat beats they exist to
    // match. A quarter of a second still stops a backgrounded tab from
    // teleporting the whole party when it comes back.
    const dt = last ? Math.min(0.25, (now - last) / 1000) : 0.016;
    last = now;

    const b = host.getBoundingClientRect();
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    renderer.setPixelRatio(dpr);
    renderer.setSize(b.width, b.height, false);
    // ONE CLEAR FOR THE WHOLE CANVAS, with the scissor off. Clearing with it on
    // only wipes the current box, and letting each render() clear its own only
    // works while no two hero boxes overlap — which they do the moment one
    // walks a row or is dragged.
    renderer.autoClear = false;
    renderer.setScissorTest(false);
    renderer.clear();
    renderer.setScissorTest(true);

    // EVERY FIGURE STANDS AT THE WORLD ORIGIN — they are placed by VIEWPORT,
    // not by position — so exactly one may be visible per render or all three
    // draw on top of each other inside one hero's box.
    for (const o of Object.keys(figs)) figs[o].root.visible = false;

    for (const id of Object.keys(figs)) {
      const f = figs[id];
      f.step(dt);
      const box = boxOf(id);
      if (!box || !box.vis) continue;
      const mat = f.root.userData.mat;
      if (mat && mat.userData.depth) mat.userData.depth.value = box.depth;
      // one scissored viewport per hero — the figure is drawn INTO the box the
      // DOM element occupies, so every CSS move the stage makes is followed.
      //
      // THESE ARE CSS PIXELS, NOT BUFFER PIXELS. three.js multiplies by the
      // pixel ratio inside setViewport/setScissor, so pre-multiplying here
      // scales every offset by the ratio twice and the whole party renders off
      // the top-right corner of the canvas — which looks exactly like "the
      // layer draws nothing" from anywhere except a pixel dump.
      //
      // …and GL counts y from the BOTTOM, while the DOM counts from the top.
      const yUp = box.hostH - box.y - box.h;
      renderer.setViewport(box.x, yUp, box.w, box.h);
      renderer.setScissor(box.x, yUp, box.w, box.h);
      const aspect = box.w / box.h;
      cam.top = VIEW_H / 2; cam.bottom = -VIEW_H / 2;
      cam.left = -VIEW_H * aspect / 2; cam.right = VIEW_H * aspect / 2;
      cam.position.set(0, VIEW_H / 2 - 0.14, 6);
      cam.lookAt(0, VIEW_H / 2 - 0.14, 0);
      cam.updateProjectionMatrix();
      f.root.visible = true;
      renderer.render(scene, cam);
      f.root.visible = false;
    }

    if (pending) {
      const cv = document.createElement('canvas');
      cv.width = canvas.width; cv.height = canvas.height;
      cv.getContext('2d').drawImage(canvas, 0, 0);
      const done = pending; pending = null; done(cv);
    }
  }

  return {
    // `?cast=3d` and nothing else. Off, this file costs one function call.
    wanted: () => /(^|[?&])cast=3d(&|$)/.test(location.search),
    async enable() {
      if (on) return true;
      if (!build()) return false;
      try { await load(); } catch (err) { failed = 'load: ' + err.message; return false; }
      document.body.classList.add('k-cast3d');
      on = true; last = 0;
      if (!raf) raf = requestAnimationFrame(frame);
      return true;
    },
    disable() {
      on = false;
      document.body.classList.remove('k-cast3d');
      if (canvas) canvas.style.display = 'none';
    },
    // the fight speaks in verbs; this is the whole interface
    play(heroId, clip) {
      const f = figs[heroId];
      if (!on || !f) return false;
      // IDLE IS NOT AN ACTION, it is what is left when no action is playing.
      // Asking for it by name — which is what standing back up does — means
      // "stop acting", not "play the idle once and then stop".
      if (clip === 'idle') { f.clear(); return true; }
      return f.play(clip);
    },
    all(clip) { Object.keys(figs).forEach(id => this.play(id, clip)); },
    // test-only: what the layer thinks is true right now
    _state: () => ({
      on, ready, failed, clips: Object.keys(CLIPS),
      figures: Object.keys(figs),
      playing: Object.fromEntries(Object.keys(figs).map(id => [id, figs[id].clipName || null])),
      bones: Object.keys(figs).length ? Object.keys(figs[Object.keys(figs)[0]].bones).length : 0,
    }),
    _boneAngle: (heroId, bone) => {
      const f = figs[heroId]; if (!f || !f.bones[bone]) return null;
      const e = new THREE.Euler().setFromQuaternion(f.bones[bone].quaternion);
      return [+(e.x / D).toFixed(2), +(e.y / D).toFixed(2), +(e.z / D).toFixed(2)];
    },
    _figure: (id) => figs[id] || null,
    // Tune the look without a reload: Cast3D.look({ bands: 5, wash: 0.4 }).
    // Called with nothing it reports what is currently set.
    look(next) {
      if (!next) return { ...LOOK };
      for (const id of Object.keys(figs)) {
        const u = figs[id].root.userData.mat.userData.u;
        for (const k of Object.keys(next)) {
          const key = 'u' + k[0].toUpperCase() + k.slice(1);
          if (u[key]) u[key].value = next[k];
        }
      }
      Object.assign(LOOK, next);
      return { ...LOOK };
    },
    // test-only: A WEBGL CANVAS IS EMPTY BY THE TIME ANYONE ELSE LOOKS AT IT.
    // Without `preserveDrawingBuffer` — which costs real performance on a
    // phone and is not worth paying for a test — the buffer is gone at the end
    // of the frame that drew it. So the copy is taken INSIDE that frame, and
    // the suite waits for it rather than reading the canvas cold and
    // concluding the layer paints nothing.
    _snapshot() {
      return new Promise(res => {
        pending = (cv) => { window.__castShot = cv; res({ w: cv.width, h: cv.height }); };
      });
    },
  };
})();

// ── the tuning panel ───────────────────────────────────────────────────────
// `?cast=3d&tune=1`. Six dials, the eight clips, and a line of JSON to copy
// back. A look chosen by editing a constant, reloading, and comparing two
// screenshots taken a minute apart is a look chosen by argument; this makes it
// a look chosen by looking.
function tunePanel() {
  const box = document.createElement('div');
  box.id = 'k-cast-tune';
  box.style.cssText = 'position:fixed;left:8px;top:8px;z-index:9999;width:212px;'
    + 'font:10px/1.5 ui-monospace,Menlo,monospace;color:#d8d0c4;'
    + 'background:rgba(14,13,17,0.92);border:1px solid #3a3630;border-radius:6px;'
    + 'padding:8px 9px;backdrop-filter:blur(3px);user-select:none;';
  let html = '<b style="letter-spacing:.1em;color:#c8b98e">THE CAST</b>'
    + '<span id="k-ct-hide" style="float:right;cursor:pointer;opacity:.6">\u2715</span>';
  for (const k of Object.keys(LOOK_HELP)) {
    const [label, min, max, step] = LOOK_HELP[k];
    html += '<div style="margin-top:5px">'
      + '<label style="display:flex;justify-content:space-between">'
      + '<span>' + label + '</span><b id="k-ctv-' + k + '">' + LOOK[k] + '</b></label>'
      + '<input type="range" data-k="' + k + '" min="' + min + '" max="' + max
      + '" step="' + step + '" value="' + LOOK[k] + '" style="width:100%;height:12px">'
      + '</div>';
  }
  html += '<div style="margin-top:7px;border-top:1px solid #332f2a;padding-top:6px">';
  for (const c of Object.keys(CLIPS)) {
    html += '<button data-clip="' + c + '" style="margin:1px 2px 1px 0;padding:2px 5px;'
      + 'font:9px ui-monospace,monospace;background:#241f28;color:#cfc6b6;'
      + 'border:1px solid #453d34;border-radius:3px;cursor:pointer">' + c + '</button>';
  }
  html += '</div><div id="k-ct-json" style="margin-top:6px;color:#8d8578;'
    + 'word-break:break-all;cursor:pointer" title="click to copy"></div>';
  box.innerHTML = html;
  document.body.appendChild(box);

  // IT STARTS OUT OF THE WAY. Two hundred pixels of debug panel parked over
  // the party HUD makes the demo unplayable, which defeats the point of
  // having it in a build you are meant to play. Closed, it is a tab.
  const tab = document.createElement('button');
  tab.id = 'k-cast-tab';
  tab.textContent = '\u25c8';
  tab.style.cssText = 'position:fixed;left:8px;top:8px;z-index:9999;width:22px;height:22px;'
    + 'font:12px/1 ui-monospace,monospace;color:#c8b98e;background:rgba(14,13,17,0.86);'
    + 'border:1px solid #45403a;border-radius:5px;cursor:pointer;padding:0;';
  document.body.appendChild(tab);
  const open = (yes) => { box.style.display = yes ? '' : 'none'; tab.style.display = yes ? 'none' : ''; };
  tab.addEventListener('click', () => open(true));
  open(false);

  const json = box.querySelector('#k-ct-json');
  const show = () => {
    json.textContent = JSON.stringify(Cast3D.look());
    for (const k of Object.keys(LOOK_HELP)) {
      const v = box.querySelector('#k-ctv-' + k);
      if (v) v.textContent = LOOK[k];
    }
  };
  box.addEventListener('input', (e) => {
    const k = e.target.dataset.k;
    if (!k) return;
    Cast3D.look({ [k]: parseFloat(e.target.value) });
    show();
  });
  box.addEventListener('click', (e) => {
    if (e.target.id === 'k-ct-hide') { open(false); return; }
    const c = e.target.dataset.clip;
    if (c) { Cast3D.all(c); return; }
    if (e.target === json && navigator.clipboard) navigator.clipboard.writeText(json.textContent);
  });
  show();
}

window.Cast3D = Cast3D;
if (Cast3D.wanted()) {
  const go = () => Cast3D.enable().then(ok => {
    if (!ok) { console.warn('[cast3d] stayed on the painted stage:', Cast3D._state().failed); return; }
    if (/(^|[?&])tune=1(&|$)/.test(location.search)) tunePanel();
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go);
  else go();
}
export default Cast3D;
