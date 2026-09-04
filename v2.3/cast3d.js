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
//
// BUILD 114: the three of them are their OWN models now, generated from the
// concept art that has been on the cards since Build 4, and they move with
// motion-captured clips instead of the eight hand-written poses that stood in
// for them. Ash keeps his sword, Elin keeps her staff. What made that
// affordable is that Meshy's humanoid auto-rig is standardised: all three came
// back with the same 24 joints, in the same order, under the same names, so
// the clip library is generated ONCE against one of them and retargets onto
// all three by name.

import * as THREE from './lib/three.module.min.js';
import { GLTFLoader } from './lib/GLTFLoader.js';

// ── who is on the board, and what colour they are ──────────────────────────
//
// THREE MODELS NOW, one per person, generated from the concept art that has
// been on their cards since Build 4. Build 112 ran one model in three palettes
// to find out whether the watercolour treatment could hold three separately
// generated figures together — it could, which is why this step was worth
// taking. What survives from that experiment is the palette itself.
//
// THEY FACE THE ENEMY, AND IT IS COMPUTED, NOT CHOSEN. Two builds got this
// wrong by eye — a generated model faces wherever the generator pointed it, a
// clip can carry its own turn, and a figure at three-quarters is genuinely
// hard to call from a 145-pixel render. So the layer MEASURES which way each
// body faces, from the line between its shoulders, and turns it to face the
// foe. `turn` is a fine adjustment ON TOP of that: three-quarters toward the
// camera, so they read as people rather than shoulders, and a few degrees
// apart so the line does not look stamped.
//
// THE HUE LIVES IN THE SHADOW, NOT IN THE PAPER. Tinting the light end is how
// three figures turn into three lumps of colour — cream, sage and gold — that
// read as silhouettes rather than as painted people. Real watercolour keeps
// the paper nearly white and does its colouring where the pigment pools, so
// each hero gets a near-neutral paper and a shadow that carries the character:
// warm earth for Ash, cold slate for Elin, sage for Mira.
//
// AND THE FOE IS JUST ANOTHER ONE OF THEM (Build 118). It stands in a
// different box, faces the other way and holds a different pose, but it is the
// same rig, the same retarget and the same clip library — which is the whole
// return on having done the retargeting properly. A new foe costs a model and
// no animation at all.
const CAST = {
  ash:  { model: 'ash.glb',  sel: '.k-hero[data-hero="ash"]',
          paper: 0xf7efe2, shadow: 0x9a7f6e, ink: 0x3d2f28,
          turn: 26, tall: 1.00, strike: 'sword' },
  elin: { model: 'elin.glb', sel: '.k-hero[data-hero="elin"]',
          paper: 0xf2f4f7, shadow: 0x8d9ab4, ink: 0x343b4a,
          turn: 34, tall: 0.97, strike: 'staff' },
  mira: { model: 'mira.glb', sel: '.k-hero[data-hero="mira"]',
          paper: 0xeef2ea, shadow: 0x76907c, ink: 0x2b352e,
          turn: 22, tall: 0.98, strike: 'daggers' },
  // ── AND EVERYTHING THE PARTY FIGHTS (Build 123) ────────────────────────────
  //
  // A FOE IS NOT A SPECIAL CASE, and that is the return on having done the
  // retargeting properly in Build 114. `side` flips which end of the stage it
  // looks at; everything downstream — the aim, the framing, the whole clip
  // library — is unchanged. Five creatures cost five models and no animation.
  //
  // They carry no `sel`, unlike the party: a foe is found by WHO IT IS, off the
  // `data-foe` the fight stamps on it, because any of them can stand in any
  // slot. See `nodeOf`. The Regent had one until now and it was already dead.
  //
  // `metres` is how tall the thing actually is, and it is the one number that
  // should differ per creature rather than per side. A generated model comes
  // back at whatever height the generator felt like; the fight decides that a
  // husk is a broken man and the Regent towers over all of them.
  //
  // `depth` is the row ladder's air. The thing a fight is ABOUT does not stand
  // behind any of it, so the boss and the elite carry full presence and the
  // three lesser creatures take their distance from the world like anyone else.
  husk:     { model: 'husk.glb', foe: true, side: -1,
              paper: 0xefe9df, shadow: 0x8a7f72, ink: 0x38312a,
              turn: 28, tall: 1.00, strike: 'sword', metres: 1.86 },
  cultist:  { model: 'cultist.glb', foe: true, side: -1,
              paper: 0xf1eee8, shadow: 0x87839a, ink: 0x35323f,
              turn: 33, tall: 1.00, strike: 'staff', metres: 1.92 },
  wraith:   { model: 'wraith.glb', foe: true, side: -1,
              paper: 0xeceff2, shadow: 0x7f8f9e, ink: 0x2f363d,
              turn: 26, tall: 1.00, strike: 'daggers', metres: 2.04 },
  revenant: { model: 'revenant.glb', foe: true, side: -1,
              paper: 0xf4efe6, shadow: 0x94836b, ink: 0x3b3226,
              turn: 31, tall: 1.00, strike: 'sword', metres: 2.14, depth: 1 },
  mourner:  { model: 'mourner.glb', foe: true, side: -1,
              paper: 0xf6f3ee, shadow: 0x8d8a97, ink: 0x39353f,
              turn: 30, tall: 1.00, strike: 'sword', metres: 2.30, depth: 1 },
};
const ART = './art/cast/';
const D = Math.PI / 180;
// Where the enemy stands, as a heading in degrees: 0 looks at the camera, 90
// looks at the right-hand side of the stage, which is where every foe in this
// game has stood since Build 4.
const FOE_HEADING = 90;
// the suites' own flag, already on the URL — see the drawing-buffer note in
// `frame`. It never changes what is drawn, only how many pixels it is drawn in.
const TEST = /(^|[?&])test=1(&|$)/.test(location.search);
const CLIPS_URL = ART + 'clips.json';

// ── the look, in one place ─────────────────────────────────────────────────
// `?cast=3d&tune=1` puts these on screen; window.Cast3D.look({...}) overrides
// them live, which is how they were chosen.
const LOOK = {
  // HOW MUCH WATERCOLOUR AT ALL, and the answer is none by default. The
  // treatment was built for a stand-in model whose texture was a grey
  // photogrammetry mush that needed the help. These three are painted from the
  // concept art and their own colour is the thing worth showing: Ash's
  // blue-grey cloak over the red sash, Elin's bone-white, Mira's violet under
  // black. A wash over that is a filter on top of art that already works.
  //
  // It stays in, dialable from 0 to 1, because it is thirty lines and someone
  // may want it for a memory or a reckoning where the stage should look
  // remembered rather than lived in.
  paint: 0.0,
  bands: 5.0,   // how many washes the tone is stepped into
  wash:  0.55,  // …and how much of the real painting survives the stepping
  lift:  0.36,  // watercolour has no true black; the paper shows through
  edge:  0.78,  // pigment pooling at the silhouette — the signature move
  grain: 0.16,  // the paper's tooth, in screen space
  air:   0.78,  // how hard the row ladder washes out the back ranks
  // THE GROUND (Build 119). The floor is not scenery — the plaza is already
  // painted — so it has exactly two settings: how dark a real contact shadow
  // lands on that painting, and how much painted ground shows under the party.
  shade: 0.46,
  floor: 0.34,
  // …and a third, Build 122: THE PLAZA IS FLOODED. Half the painting below the
  // horizon is a reflection, so this is not a polish setting — it is most of
  // what makes the ground read as that ground.
  wet: 0.70,
};
// what each dial does, for the panel — and so the next person to open this
// file does not have to read the shader to find out
const LOOK_HELP = {
  paint: ['watercolour', 0, 1, 0.01, 'how much of the wash is applied at all'],
  bands: ['washes', 2, 8, 1, 'how many flat tones the brush lays down'],
  wash:  ['flatten', 0, 1, 0.01, 'how much of the real painting the wash eats'],
  lift:  ['paper', 0, 0.8, 0.01, 'how far the blacks lift toward paper'],
  edge:  ['pooling', 0, 1.4, 0.01, 'pigment gathering at the silhouette'],
  grain: ['tooth', 0, 0.5, 0.01, 'the paper grain, in screen space'],
  air:   ['distance', 0, 1.6, 0.01, 'how hard the back ranks wash out'],
  shade: ['shadow', 0, 0.9, 0.01, 'how dark the contact shadows land'],
  floor: ['ground', 0, 1, 0.01, 'how much painted floor shows under the party'],
  wet:   ['water', 0, 1, 0.01, 'how much of the city the flooded floor gives back'],
};

// ── what each verb looks like, per person ──────────────────────────────────
//
// THE FIGHT SPEAKS FOUR VERBS and has since Build 36: actionKind() returns
// heal, cast, slash or ward. Three of them are the same motion whoever throws
// them. The fourth is not — a longsword, a staff and a pair of daggers are
// three different fights — so `slash` resolves through the character's own
// `strike` and everything else is shared.
//
// The names on the right are the clips in the library, which are named for the
// VERB rather than for what Meshy called them: the game never has to know that
// a parry arrived as "Armature|Sword_Parry|baselayer".
const VERB = {
  slash: (id) => CAST[id].strike,     // sword · staff · daggers
  cast:  () => 'cast',
  heal:  () => 'heal',
  ward:  () => 'ward',
  parry: () => 'parry',
  hurt:  () => 'hurt',
  down:  () => 'down',
  idle:  () => 'idle',
};

// A CLIP THAT HOLDS DOES NOT HAND THE BODY BACK. Everything else returns to
// the idle when it finishes; going down stays down until the fight says
// otherwise, which is the difference between a corpse and a stumble.
const HOLDS = { down: true };
// ── HOW LONG EACH VERB TAKES IS THE LIBRARY'S BUSINESS (Build 121) ─────────
//
// This was a table here and a table in the mill, and two tables that have to
// agree are one bug waiting for somebody to edit the wrong one. `clips.json`
// now carries a `beat` — how long the clip is meant to take on screen — and a
// `loop` flag, both written by `tools/rewindow.cjs` where the windows are
// chosen, so the rate is arithmetic rather than a second opinion.
//
// AND THE WINDOW IS CHOSEN BY THE BEAT NOW, which is the fix for the pace.
// Build 118 kept the shortest span holding 86% of a clip's motion and then
// divided by the beat, composing two reasonable questions into a bad answer: a
// sword swing came out 3.05 seconds long against a one-second beat and played
// at 3.05x. A parry played at 3.52x. Past about a quarter over, motion stops
// reading as motion and reads as a fault. The beat is the fixed thing — it says
// what the fight can afford — so the window is simply the best span OF THAT
// LENGTH, and playback lands at 1.2x for everything: urgent, not broken.
//
// LOOPS KEEP EVERY FRAME THEY WERE AUTHORED WITH. You cannot cut an arbitrary
// window out of a loop and expect it to loop — the pose you cut in at is not
// the pose you cut out at. Measured on the shipped library, the idle's authored
// loop closes to 1.4 degrees and the windowed one to 7.2: a five-fold worse
// seam, snapping once a cycle, for a clip that is on screen almost all the time.

// ── the animation ──────────────────────────────────────────────────────────
//
// BUILD 112 WROTE THESE BY HAND. The sample model arrived with no animation —
// one 0.3s clip holding a single keyframe per channel — so its eight verbs
// were authored as bone-rotation data: readable, tiny, and unmistakably
// hand-keyed. They are gone now, and so is the STANCE correction that existed
// only because those poses were offsets from a T-pose.
//
// What replaced them is a library of ten real clips, milled out of Meshy's
// animation catalogue by v2.3/tools/clips.cjs and stored as
// THREE.AnimationClip JSON. `Combat_Stance` for the idle, `Sword_Judgment`
// for Ash, `Double_Combo_Attack` for Mira, `Attack` for Elin's staff,
// `Charged_Spell_Cast`, `mage_soell_cast` for mending, `Block1`,
// `Sword_Parry`, `Hit_Reaction`, `Knock_Down`.
//
// Ten clips arrived as ten ~6 MB GLBs, each carrying a whole character around
// the curves we actually wanted. Stripped of mesh and texture, and of the
// scale tracks a rig nothing scales does not need, the library is 685 KB.

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
    uPaint: { value: LOOK.paint },
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
        uniform float uBands, uGrain, uEdge, uLift, uDepth, uWash, uAir, uPaint;
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
          // the model's own colour, lit — this is what ships
          vec3 base = gl_FragColor.rgb;
          vec3 c = base;
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
          // …and only as much of all that as was asked for. At uPaint 0 every
          // line above is dead code the compiler keeps and the eye never sees.
          c = mix(base, c, uPaint);
          // THE LADDER IS NOT PART OF THE TREATMENT. Back ranks lose saturation
          // and sit down in value whatever the paint is doing, because
          // FRONT/MID/BACK is a thing the player has to read, not a mood.
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

// ── retargeting ────────────────────────────────────────────────────────────
//
// EVERY MODEL COMES BACK ON ITS OWN SKELETON. Not "the same skeleton in a
// different pose" — a genuinely different bind pose per generation. Ash, Elin
// and Mira differ from each other by more than a radian at the wrist, and all
// three differ from the rig the clips were authored on. Same 24 names, same
// hierarchy, different rest orientations.
//
// Played raw that shears the mesh, because every joint is handed an absolute
// local rotation that meant one thing on the rig it was recorded from and
// something else on the rig it lands on.
//
// THIS IS A MODEL-SPACE OPERATION, and doing it in local space is the trap. A
// first attempt used `rest_t · rest_s⁻¹ · q` per bone, which is only exact
// when the two rigs' PARENTS already agree — it fixed Ash and Mira most of the
// way and left Elin, whose rest pose is furthest from the source, a collapsed
// bag of cloth. What is actually invariant between two skeletons is where a
// bone points IN THE WORLD relative to where it rested:
//
//     D(b)  = A_s(b) · G_s(b)⁻¹          the source bone's global departure
//     A_t(b) = D(b) · G_t(b)             the same departure, on the target
//     q_t(b) = A_t(parent)⁻¹ · A_t(b)    back to a local rotation
//
// where G is a rest pose accumulated down the hierarchy and A is an animated
// one. That needs the whole pose at once rather than one track at a time, so
// the clip is resampled onto a common timeline first.
//
// TWO THINGS ARE THROWN AWAY on the way through. Non-root position tracks: a
// clip carries one per joint, and each writes the SOURCE rig's bone offsets
// onto the target — overwriting the character's own bone LENGTHS sixty times a
// second with somebody else's, which is most of what "disfigured" looked like.
// A humanoid clip translates the hips; every other joint keeps the length the
// model was built with. And scale tracks, which the mill dropped already.
const RESAMPLE_FPS = 30;
// how much of the fighting stance the resting party actually wears
const IDLE_WEIGHT = 0.62;

function retarget(clip, restSrc, parentOf, bones, window) {
  const names = Object.keys(restSrc).filter(n => bones[n]);
  if (!names.length) return clip;

  // …ordered parents-first, so an accumulation can be done in one pass
  const order = [], seen = {};
  const visit = (n) => {
    if (seen[n] || !restSrc[n]) return;
    seen[n] = 1;
    const p = parentOf[n];
    if (p) visit(p);
    order.push(n);
  };
  names.forEach(visit);

  const Q = () => new THREE.Quaternion();
  // NORMALISE AFTER EVERY COMPOSITION. A quaternion that drifts off the unit
  // sphere is not a rotation any more — it is a rotation with a scale baked
  // into it — and this walks a chain of them twelve deep, twice, for every
  // frame of every clip. Left alone the error showed up as bones stretching by
  // seven percent mid-swing, which reads on screen as exactly the same
  // "disfigured" as a bad retarget and has nothing to do with retargeting.
  const restS = {}, Gs = {}, Gt = {};
  for (const n of order) {
    restS[n] = Q().fromArray(restSrc[n]).normalize();
    const p = parentOf[n];
    Gs[n] = (p && Gs[p] ? Gs[p].clone() : Q()).multiply(restS[n]).normalize();
    Gt[n] = (p && Gt[p] ? Gt[p].clone() : Q()).multiply(bones[n].quaternion).normalize();
  }

  // the source clip's rotation tracks, by bone
  const rot = {};
  const keptTracks = [];
  for (const t of clip.tracks) {
    const dot = t.name.indexOf('.');
    const bone = t.name.slice(0, dot), what = t.name.slice(dot + 1);
    if (what === 'quaternion') { rot[bone] = t; continue; }
    if (what === 'position' && bone === 'Hips') keptTracks.push(t.clone());
  }

  // ONLY THE PART WHERE SOMETHING HAPPENS. The mill measured where each clip's
  // motion actually lives — a four-second sword swing is under one second of
  // swing wrapped in three of standing still — and the window comes through
  // with the clip. Resampling inside it drops the dead air rather than racing
  // through it, which is what the speed multipliers used to do.
  const w0 = window ? window[0] : 0;
  const w1 = window ? window[1] : (clip.duration || 1);
  const dur = Math.max(0.05, w1 - w0);
  const n = Math.max(2, Math.round(dur * RESAMPLE_FPS));
  const times = new Float32Array(n);
  for (let i = 0; i < n; i++) times[i] = (i / (n - 1)) * dur;

  const out = {};
  for (const b of order) out[b] = new Float32Array(n * 4);
  const As = {}, At = {};
  const q = Q(), d = Q(), tmp = Q();

  for (let i = 0; i < n; i++) {
    const t = times[i];
    for (const b of order) {
      // source local at t — the track if there is one, otherwise its rest
      const track = rot[b];
      if (track) sampleQuat(track, t + w0, q); else q.copy(restS[b]);
      q.normalize();
      const p = parentOf[b];
      As[b] = (p && As[p] ? As[p].clone() : Q()).multiply(q).normalize();
      d.copy(As[b]).multiply(tmp.copy(Gs[b]).invert()).normalize();   // D = A_s · G_s⁻¹
      At[b] = d.clone().multiply(Gt[b]).normalize();                   // A_t = D · G_t
      const local = (p && At[p] ? tmp.copy(At[p]).invert().multiply(At[b])
                                : At[b].clone()).normalize();
      local.toArray(out[b], i * 4);
    }
  }

  // the hips track has to be re-based into the window too, or the root jumps
  const tracks = keptTracks.map(t => {
    const keep = [];
    for (let i = 0; i < t.times.length; i++) {
      if (t.times[i] >= w0 - 1e-4 && t.times[i] <= w1 + 1e-4) keep.push(i);
    }
    if (!keep.length) return t;
    const times2 = new Float32Array(keep.length);
    const vals2 = new Float32Array(keep.length * 3);
    keep.forEach((k, j) => {
      times2[j] = Math.max(0, t.times[k] - w0);
      for (let c = 0; c < 3; c++) vals2[j * 3 + c] = t.values[k * 3 + c];
    });
    return new THREE.VectorKeyframeTrack(t.name, times2, vals2);
  });
  for (const b of order) {
    tracks.push(new THREE.QuaternionKeyframeTrack(b + '.quaternion', times, out[b]));
  }
  return new THREE.AnimationClip(clip.name, dur, tracks);
}

// three's interpolants allocate; this is called a few thousand times at load,
// so the sampling is done by hand with a slerp between the bracketing keys
function sampleQuat(track, t, into) {
  const times = track.times, v = track.values;
  const last = times.length - 1;
  if (t <= times[0]) return into.fromArray(v, 0);
  if (t >= times[last]) return into.fromArray(v, last * 4);
  let lo = 0, hi = last;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (times[mid] <= t) lo = mid; else hi = mid; }
  const span = times[hi] - times[lo];
  const u = span > 0 ? (t - times[lo]) / span : 0;
  into.fromArray(v, lo * 4).normalize();
  const b = new THREE.Quaternion().fromArray(v, hi * 4).normalize();
  return into.slerp(b, u).normalize();
}

// ── the figure ─────────────────────────────────────────────────────────────
// One per hero: their own model, their own mixer, and whatever clip is
// playing over the idle underneath it.
//
// THE IDLE ALWAYS RUNS. A turn-based fight spends almost all of its time with
// nobody acting, and a still 3D figure reads as a BROKEN 3D figure where a
// still painting reads as a painting. So the idle is an action that never
// stops, and an acting clip is CROSS-FADED over the top of it and faded back
// out — which is also why nothing ever snaps.
class Figure {
  constructor(root, tone, clips, restSrc, parentOf, windows, meta) {
    this.root = root;
    this.tone = tone;
    // THE BONES AND THEIR REST POSE FIRST — the retarget needs them, and after
    // the mixer runs once `quaternion` is a pose, not a rest.
    this.bones = {};
    root.traverse(o => { if (o.isBone) this.bones[o.name] = o; });
    this.mixer = new THREE.AnimationMixer(root);
    this.actions = {};
    for (const name of Object.keys(clips)) {
      const loops = !!(meta[name] && meta[name].loop);
      const rt = retarget(clips[name], restSrc, parentOf, this.bones,
                          loops ? null : windows[name]);
      const a = this.mixer.clipAction(rt);
      a.setEffectiveWeight(0);
      // SPEED IS DERIVED, not chosen: the window is the length the beat can
      // afford, so the division lands just over 1 rather than at three.
      const beat = meta[name] && meta[name].beat;
      a.timeScale = (loops || !beat) ? 1 : (rt.duration / beat);
      // ── THE POSE HOLDS UNTIL SOMETHING BLENDS IT AWAY (Build 125) ────────
      //
      // This is what "sloppy and jittery" was, and it was one line.
      //
      // A LoopOnce action WITHOUT `clampWhenFinished` is disabled by three.js
      // the instant it reaches its end: its contribution goes from full to
      // nothing between one frame and the next, and the body snaps from the
      // last frame of the swing to the idle in a single tick. `clear()` calls
      // `fadeOut(0.22)` a moment later, which reads like a crossfade and is
      // not one — by the time it runs there is nothing left to fade, because
      // the action already stopped contributing.
      //
      // Measured on the rig rather than argued about: driving the mixer by
      // hand at 240 Hz and reading the right hand's angular acceleration, every
      // clip had exactly ONE spike, two to three samples wide, three hundred
      // times the typical value — and every one of them landed on the clip's
      // own beat. Six clips, six pops, 0.65s on a 0.66s parry, 1.142 on a
      // 1.15s sword. Nothing was wrong in the middle of any animation.
      //
      // Clamping holds the final pose instead. The action stays enabled and
      // paused on its last frame, so `clear()`'s fade has something real to
      // blend out of and the idle comes back underneath it over 0.22s.
      if (!loops) { a.loop = THREE.LoopOnce; a.clampWhenFinished = true; }
      this.actions[name] = a;
    }
    this.meta = meta || {};
    this.idle = this.actions.idle || null;
    if (this.idle) {
      this.idle.loop = THREE.LoopRepeat;
      // NOT AT FULL STRENGTH. `Combat_Stance` is a deep crouch — right for one
      // fighter filling a screen, and at 145 pixels in a party of three it just
      // reads as three people hunching. Blended against the model's own
      // standing rest it keeps the weight-shift and the breath and loses most
      // of the squat.
      this.idle.setEffectiveWeight(IDLE_WEIGHT).play();
      // THREE FIGURES BREATHING ON THE SAME FRAME is worse than three still
      // ones, so each starts somewhere else in the loop.
      this.idle.time = Math.random() * (this.idle.getClip().duration || 1);
    }
    this.clipName = null;
    this.acting = null;
    // where the idle's weight is heading, and how long it has to get there;
    // `step` walks it
    this.idleWant = IDLE_WEIGHT;
    this.idleRamp = 0.22;

    // THE CLIPS TRAVEL. A sword judgment steps into the blow and a knock-down
    // falls over backwards — motion that is right in a vacuum and wrong in a
    // box, because the camera here is nailed to the origin and a figure that
    // walks forward simply walks out of frame. So the hips are pinned in the
    // horizontal plane and left free in the vertical, which keeps the crouch
    // and the fall while throwing away the travel.
    this.hips = this.bones.Hips || null;
    this.hipRest = this.hips ? this.hips.position.clone() : null;

    // …AND EVERY MODEL COMES BACK A DIFFERENT SIZE. Meshy is asked for a height
    // in metres and obliges approximately, and nothing guarantees the figure
    // stands at x=0 either.
    //
    // THE FRAME IS FOUND BY LOOKING, NOT BY ARITHMETIC. Two attempts at
    // computing it failed in different ways: Box3.setFromObject reports a
    // SkinnedMesh's authored geometry box, which made Elin 0.75 m tall next to
    // a head bone standing at 1.35 and zoomed the camera into everyone's ribs;
    // and measuring bone-to-bone needs fudge factors for the sole below the toe
    // and the hood above the crown that are different for every character.
    // Rendering the figure once and reading its silhouette out of the alpha
    // channel is ground truth, costs one frame at load, and never needs a
    // constant tuned per model. `fit` fills these in.
    this.viewH = 2.0;
    this.midX = 0;
    this.midY = 0.9;

    this.mixer.addEventListener('finished', (e) => {
      if (e.action !== this.acting) return;
      if (HOLDS[this.clipName]) return;     // down stays down
      this.clear();
    });
  }

  play(name) {
    const a = this.actions[name];
    if (!a) return false;
    if (this.acting && this.acting !== a) this.acting.fadeOut(0.14);
    a.reset();
    a.setEffectiveWeight(1);
    a.fadeIn(0.12).play();
    // ── AND THE IDLE GETS OUT OF THE WAY ────────────────────────────────
    //
    // It used to stay underneath at a quarter weight, on the theory that a
    // held pose should keep breathing. It cost more than it bought, twice
    // over.
    //
    // NUMERICALLY: blending a standing idle under a lunging swing puts the two
    // Hips rotations near-antipodal, and a weighted blend between near-
    // antipodal quaternions is unstable — the shortest arc between them flips
    // as they pass 180°, and the blended result jumps to a rotation eighty
    // degrees away between one frame and the next. Measured: the sword's hips
    // moved 80° in a 240th of a second at clip time 0.74, with both weights
    // steady. Take the idle out and the same instant is smooth. The clip was
    // never the problem.
    //
    // AND VISUALLY: a quarter of a standing pose smeared over every swing is
    // exactly what "the actions don't read" is made of. An action is a
    // statement; averaging it with someone standing still softens the one
    // thing it was for.
    this.idleWant = 0;
    this.idleRamp = 0.12;                 // out as fast as the action comes in
    this.acting = a;
    this.clipName = name;
    return true;
  }

  clear() {
    if (this.acting) this.acting.fadeOut(0.22);
    // ── AND THE IDLE COMES BACK OVER THE SAME 0.22s ──────────────────────
    //
    // Setting this outright was the SECOND pop, and it hid behind the first.
    // With the action's final pose clamped the swing no longer vanishes, but
    // the idle underneath it still went from a whisper to full strength
    // between two frames — a two-and-a-half-fold jump in what the body is
    // being blended toward, which is its own snap. Fading the action out over
    // 0.22s while ramping the idle in over anything shorter is not a
    // crossfade; it is two cuts that happen to overlap.
    this.idleWant = IDLE_WEIGHT;
    this.idleRamp = 0.22;                 // back in over the action's own fade
    this.acting = null;
    this.clipName = null;
  }

  step(dt) {
    // the idle's weight is ours to move, and it moves at the speed of the
    // fades it is answering rather than instantly
    if (this.idle) {
      const w = this.idle.getEffectiveWeight();
      const k = Math.min(1, dt / (this.idleRamp || 0.22));
      if (Math.abs(this.idleWant - w) > 0.0005)
        this.idle.setEffectiveWeight(w + (this.idleWant - w) * k);
      else if (w !== this.idleWant) this.idle.setEffectiveWeight(this.idleWant);
    }
    this.mixer.update(dt);
    if (this.hips && this.hipRest) {
      this.hips.position.x = this.hipRest.x;
      this.hips.position.z = this.hipRest.z;
    }
  }
}

// ── the layer ──────────────────────────────────────────────────────────────
const Cast3D = (() => {
  let on = false, ready = false, failed = null;
  let renderer = null, scene = null, cam = null, canvas = null;
  let ground = null, reflect = null, mirror = null;
  const sized = { w: 0, h: 0, dpr: 0 };
  const figs = {};
  let last = 0, raf = 0, pending = null, clipNames = [], missing = [];
  // the clip library outlives `load` now: a creature mounted an hour into a
  // run is built from the same parsed clips the party was built from
  let clips = {}, windows = {}, meta = {}, restSrc = {}, parentOf = {};
  const fetching = {};
  let warming = null, unloaded = [];

  // ═══ THE WORLD (Build 119) ═════════════════════════════════════════════════
  //
  // Everything up to Build 118 drew each figure ALONE. One scissored viewport
  // per hero, an orthographic camera, the model standing at the world origin,
  // painted into the rectangle the DOM said its old 2D portrait would have
  // occupied. Four renders, four boxes, no shared space between them.
  //
  // Two things follow from that, and both were the ceiling:
  //
  //   THERE WAS NO CAMERA TO MOVE. `cam()` moved a <div>. The figures came
  //   along as rectangles — they did not reproject, did not change their
  //   relationship to one another, could not occlude. A push-in magnified a
  //   photograph of a diorama rather than travelling into one.
  //
  //   THERE WAS NOWHERE TO PUT A FLOOR. A ground plane spans all four boxes
  //   and belongs to none of them, so no arrangement of scissor rectangles can
  //   hold one. Wanting a floor is what forces the whole thing.
  //
  // So the arrow is inverted here. The WORLD decides where everybody is; the
  // DOM reads the projection and follows. That is the entire change, and it is
  // what makes a cinematic camera possible at all — there is now something for
  // a camera to be inside of. It is also LESS code than the scissor dance it
  // replaces, because the scissor dance existed only to fake a shared space.
  //
  // WHAT SURVIVES UNTOUCHED: twenty-nine places in game.js read a hero's
  // bounding rect — drop targets, damage numbers, aim beams, nameplates, parry
  // rings, the reckoning, the all-out. Not one of them cares which direction
  // the arrow points. They ask the DOM where the hero is; the DOM still knows;
  // it simply learned it from the world instead of from a CSS lane variable.
  // That is why a change this deep touched none of them.

  // ── THE LENS IS CONVERTED, NOT CHOSEN ──────────────────────────────────────
  //
  // The stage has been a real perspective volume since Build 21: `#k-field`
  // carries `perspective: 700px` with `perspective-origin: 50% 22%`. That is a
  // pinhole camera written in CSS — focal length 700 px, principal point at
  // (466, 94.6) on a 932x430 frame — so the 3D camera that reproduces today's
  // framing is not a matter of taste. It is that same camera, transcribed.
  //
  // The principal point sits ABOVE centre, and that is the part a symmetric
  // frustum cannot express: the horizon is at 22% of the height rather than
  // 50%, which is what looking slightly DOWN at a floor looks like. An
  // off-axis frustum is the honest translation, and `setViewOffset` is how
  // three.js spells one — render the 430-tall window out of a taller virtual
  // frame whose centre lands exactly on the vanishing point.
  const VIEW = { w: 932, h: 430, focal: 700, px: 466, py: 94.6 };
  const FULL_H = 2 * (VIEW.h - VIEW.py);              // 670.8
  const OFF_Y = FULL_H / 2 - VIEW.py;                 // 240.8
  const FOV = 2 * Math.atan((FULL_H / 2) / VIEW.focal) / D;   // 51.2 degrees

  // ── WHERE EVERYBODY STANDS, IN METRES ──────────────────────────────────────
  //
  // Solved from the ladder the 2D stage already draws, not invented, so the
  // board reads the same on the frame the world takes over — the read players
  // know survives, and eight suites that never heard of three.js stay green.
  //
  // The heroes' projected centres and ground lines have been 240/234, 352/253,
  // 474/276 since Build 101. Running those back through the lens above — with
  // a hero 1.75 m tall filling 176 px at the front rank — puts the eye 7.5 m
  // back at 1.70 m, head height, and lands the party on this diagonal. The
  // ranks recede AWAY from the enemy and INTO the scene at once, which is what
  // the 2D ladder was always drawing; it is a place now rather than a drawing
  // of one.
  const EYE = { x: 0, y: 1.70, z: 7.50 };

  // ── THE TRIPOD AND THE OPERATOR'S HANDS (Build 120) ────────────────────────
  //
  // Build 119 gave the fight a real camera but left it where the painted stage
  // had always stood: one spot, in front, looking in. `cam()`'s six properties
  // are a HANDHELD offset — a nudge, a push, a roll — and they are the right
  // shape for that and the wrong shape for "swing around behind the party".
  // Their limits say so: pan is clamped to 34 px and yaw to 7 degrees, because
  // past that the CSS lens they were written for fell apart.
  //
  // So a shot is a separate thing, stated the way a camera operator states one:
  // stand this far from the fight, this far around it, at this height, looking
  // at this. The handheld offset then applies ON TOP, in the camera's own axes,
  // which is why the two never fight — the tripod chooses the angle, the hands
  // do the breathing, and every camPush written since Build 22 keeps working
  // from wherever the tripod happens to be standing.
  //
  // `home` is not a taste: it is Build 119's camera written in the new terms,
  // and the suite holds it to the frame the painted stage framed.
  const BOARD = [0, 0, 0.15];          // the middle of the fight, on the floor
  const SHOTS = {
    // the board, as it has been framed since Build 4
    home:      { az:   0, dist: 7.35, height: 1.70, aimY: 1.70, at: 'board' },
    // a finisher: come around the party's shoulder and get low enough that the
    // Regent is above you, which is the whole feeling of fighting one
    duel:      { az: -33, dist: 5.85, height: 1.28, aimY: 1.62, at: 'foe' },
    // the all-out arcs behind the party and looks back down the line at what
    // all three of them are about to hit
    // 54 degrees put all four bodies in one clump behind the Regent — a shot
    // where the thing the player is about to do cannot be read. 33 keeps the
    // line legible and still swings hard enough to feel like a camera move.
    allout:    { az:  33, dist: 7.10, height: 2.35, aimY: 1.40, at: 'board' },
    // the parry is one hero's moment: in close, slightly under, so the incoming
    // blow reads as coming down at you
    parry:     { az: -13, dist: 5.10, height: 1.42, aimY: 1.58, at: 'party' },
    // after the kill, stand back up and take the room in
    reckoning: { az:  19, dist: 8.70, height: 2.60, aimY: 1.30, at: 'board' },

    // ── AND THE SHOTS A SINGLE ACTION ASKS FOR (Build 122) ───────────────────
    // Shorter, closer, and always transient: each of these is a beat, not a
    // stance, and each is asked for with `{ for: ms }`.
    // a blow landing: step in off the axis so the swing crosses the frame
    strike:    { az: -11, dist: 5.35, height: 1.38, aimY: 1.56, at: 'foe' },
    // …and mercy is the opposite shot in every respect — further back, higher,
    // on the party rather than on what it is hitting, because a heal is not an
    // impact and a camera that treats it like one flattens both
    grace:     { az:  17, dist: 6.30, height: 2.20, aimY: 1.48, at: 'party' },
    // the killing blow: low, close, swung well off the line, so the last thing
    // a creature does happens to somebody rather than in a diagram
    fell:      { az: -48, dist: 4.45, height: 1.02, aimY: 1.32, at: 'foe' },
    // a deflection is a fraction of a second, so its shot is nearly a cut
    snap:      { az: -19, dist: 4.20, height: 1.46, aimY: 1.54, at: 'party' },
  };
  // where a shot may be aimed. `party` and `foe` are read off the world rather
  // than written down, so a shot follows whoever is actually standing there.
  function aimPoint(at) {
    if (Array.isArray(at)) return at;
    if (at === 'party' || at === 'foe') {
      const want = at === 'foe';
      let n = 0, x = 0, z = 0;
      for (const id of Object.keys(figs)) {
        if (!!CAST[id].foe !== want || !figs[id].root.visible) continue;
        x += figs[id].root.position.x; z += figs[id].root.position.z; n++;
      }
      if (n) return [x / n, 0, z / n];
    }
    return BOARD;
  }
  const STAGE = {
    hero: { front: [0.00, 0.54], mid: [-1.23, -0.03], back: [-2.76, -1.06] },
    foe:  { front: [2.10, 0.60], mid: [3.30, -0.10], back: [4.45, -0.95] },
    solo: [2.55, 1.15],
  };
  // metres, crown to sole. A generated model comes back whatever height the
  // generator felt like — see `fit` — so each figure is scaled to stand at the
  // height the fight needs rather than the height it happened to arrive at.
  // The party is level with itself by design; each creature states its own.
  const TALL_M = { hero: 1.78, foe: 2.00 };
  // how much of a hero's box the figure fills, top to bottom. The rest is the
  // air a swing needs — a sword raised overhead leaves the frame at 1.0.
  const FILL = 0.72;
  // px per metre at the plane the party stands on: the conversion between the
  // camera language game.js already speaks (pixels) and the world (metres).
  const PX_M = VIEW.focal / EYE.z;
  // the ground runs well past the cyclorama, so its edge is never in shot
  const FLOOR_SPAN = 100;
  // the cyclorama's radius, which is also what decides the skyline's height:
  // the painting's top row sits 0.202 of the radius above the horizon, so 45 m
  // puts the tallest ruins about nine metres up. Bigger makes a taller city.
  const SKY_R = 45;

  // ── THE TWO TEXTURES THE PAINTING WAS CUT INTO ─────────────────────────────
  // `tools/horizon.cjs` splits `bg23-plaza-pano.png` at its measured horizon
  // and writes the halves out. Nothing here decides anything about them; it
  // loads them and puts them where the measurement says they go.
  function loadTex(url) {
    return new Promise((res, rej) => new THREE.TextureLoader().load(url, res, undefined, rej));
  }

  // ── AND THE WEATHER, WHICH IS NOT PAINTED AT ALL ───────────────────────────
  // Everything outside the painted arc. A vertical band the colour of the
  // painting's own mist, darkening toward the ground so the fog cylinder does
  // not glow along the floor line — three stops and a little grain, which is
  // all that is left of a city once it is far enough away.
  // one soft blot, drawn once, drifting three times — a cloud is not a shape,
  // it is an absence of edge, so this is a radial falloff with its own tooth
  function mistPuff() {
    const S = 256;
    const c = document.createElement('canvas');
    c.width = S; c.height = S / 2;
    const x = c.getContext('2d');
    for (let i = 0; i < 26; i++) {
      const cx = Math.random() * S, cy = (S / 4) + (Math.random() - 0.5) * (S / 3);
      const r = 20 + Math.random() * 58;
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, 'rgba(214,218,222,0.30)');
      g.addColorStop(1, 'rgba(214,218,222,0)');
      x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill();
    }
    // gone at the edges, or a sheet of mist has a rectangle in it
    const g2 = x.createLinearGradient(0, 0, S, 0);
    g2.addColorStop(0, 'rgba(0,0,0,1)'); g2.addColorStop(0.18, 'rgba(0,0,0,0)');
    g2.addColorStop(0.82, 'rgba(0,0,0,0)'); g2.addColorStop(1, 'rgba(0,0,0,1)');
    x.globalCompositeOperation = 'destination-out';
    x.fillStyle = g2; x.fillRect(0, 0, S, S / 2);
    return c;
  }

  function fogBand() {
    const c = document.createElement('canvas');
    c.width = 8; c.height = 256;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0.00, '#8f959d');
    g.addColorStop(0.42, '#9aa0a6');
    g.addColorStop(0.78, '#8a8d90');
    g.addColorStop(1.00, '#6e7073');
    x.fillStyle = g; x.fillRect(0, 0, 8, 256);
    const im = x.getImageData(0, 0, 8, 256);
    for (let i = 0; i < im.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 9;
      im.data[i] += n; im.data[i + 1] += n; im.data[i + 2] += n;
    }
    x.putImageData(im, 0, 0);
    return c;
  }

  async function build() {
    const host = document.getElementById('k-cast');
    if (!host) return false;
    canvas = document.createElement('canvas');
    canvas.id = 'k-cast3d';
    // ── THE CANVAS SITS AT THE BOTTOM, AND IT HAS TO (Build 121) ─────────────
    //
    // At z-index 1 it was fine for as long as it was mostly TRANSPARENT: the
    // scissored figures painted where the figures were and everything else
    // showed the DOM through. Build 120 made it opaque — floor, horizon, fog,
    // the whole frame — and a solo foe plate carries `z-index: auto`, so the
    // world quietly painted over every enemy there is no model for. The plate
    // reported opacity 1, visibility visible, and the right rectangle; it was
    // simply behind a wall.
    //
    // Zero puts it under everything in this stacking context and changes no
    // other relationship: the row markers, the heroes' nameplates and the
    // foes' own 1/2/3 depth ordering all keep the order they have always had.
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;'
      + 'pointer-events:none;z-index:0;';
    host.insertBefore(canvas, host.firstChild);
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    } catch (err) { failed = 'no webgl: ' + err.message; return false; }
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // REAL CONTACT SHADOWS ARE THE POINT OF THE FLOOR. Four figures throwing
    // onto the ground and across each other is most of what says "these people
    // are standing in a room" — it is the one cue a painted plate can never
    // carry, because a plate does not know where anybody is.
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    scene = new THREE.Scene();
    // LIT, NOT FLATTENED. Build 112 washed the light out because a paper doll
    // is lit like paper; with the wash off, that same flat ambient turns a
    // painted cloak into a sticker. A key from the front-right and a cool rim
    // from behind put the folds back.
    scene.add(new THREE.AmbientLight(0xffffff, 0.88));
    const k = new THREE.DirectionalLight(0xffffff, 1.45);
    k.position.set(4.5, 7.5, 5.0);
    k.castShadow = true;
    k.shadow.mapSize.set(1024, 1024);
    const sc = k.shadow.camera;
    sc.left = -8; sc.right = 8; sc.top = 8; sc.bottom = -8;
    sc.near = 0.5; sc.far = 26;
    // ACNE OR PETER-PANNING, pick one. A negative bias this small keeps the
    // contact — the shadow still touches the sole, which is the whole job —
    // without striping the cloaks.
    k.shadow.bias = -0.0012;
    k.shadow.normalBias = 0.02;
    const r = new THREE.DirectionalLight(0x9fb6d8, 0.72);
    r.position.set(-5, 3.5, -4);
    scene.add(k, r);
    scene.userData.key = k;

    // ── THE WORLD IN THE ROUND (Build 120) ───────────────────────────────────
    //
    // Build 119 left the painted plate doing the scenery and gave the ground
    // nothing but a shadow to catch, which was right while the camera stood
    // still. A plate is correct from exactly one viewpoint: swing thirty
    // degrees and the painted floor is seen edge-on and the painted buildings
    // slide with you. So the painting comes apart AT THE HORIZON, which is the
    // one line where the two halves of a street painting can be separated
    // cleanly (see tools/horizon.cjs, where it is measured rather than guessed):
    //
    //   ABOVE it, a curved PANEL at 45 metres. Buildings and mist have no
    //   parallax worth having, so a cylinder section carries them correctly
    //   from every angle — undistorted, at the painting's own resolution,
    //   across the 84 degrees it actually covers.
    //
    //   BELOW it, the GROUND, tiled from the nearest painted stone. A floor is
    //   a plane, and a plane is right from everywhere.
    //
    // They need no blending: at the horizon both are infinitely far, so they
    // meet by construction.
    //
    // Behind the painted arc there is no painting, and pretending otherwise is
    // what mirror-folding does — four copies of the same lit doorway around the
    // horizon. What is actually behind you in a drowned city is weather, so
    // that is what is there: a fog cylinder, generated here, costing nothing.
    const lens = await fetch(ART + 'lens.json').then(r => r.json()).catch(() => null);
    const L = lens || { halfFov: 41.975, skyAbove: 0.20219, skyBelow: 0.055, floorM: 6.48 };

    const tex = await loadTex(ART + 'floor.webp');
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(FLOOR_SPAN / L.floorM, FLOOR_SPAN / L.floorM);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    // ── THE PLAZA IS FLOODED, AND THAT IS THE WHOLE LOOK (Build 122) ─────────
    //
    // Look at the painting for two seconds and what you are looking at is
    // WATER. Half the pixels below the horizon are a reflection of the half
    // above it — the arcade, the lit doorway, the sky — which is exactly why
    // un-projecting that floor into a texture failed in Build 120: a reflection
    // is a property of the view, not of the ground.
    //
    // So the reflection is not a texture here. It is a second render of the
    // world from a camera mirrored through the floor plane, sampled by the
    // floor in the reflected fragment's own screen position. That is the only
    // version of it that answers the question the painting is asking — and it
    // is the thing the world was missing: a dry floor under a drowned city
    // reads as a stage, and a wet one reads as a place.
    const floorMat = new THREE.MeshStandardMaterial({
      map: tex, roughness: 0.62, metalness: 0.08,
      color: new THREE.Color().setScalar(0.5 + LOOK.floor * 1.6) });
    floorMat.onBeforeCompile = (sh) => {
      sh.uniforms.uRefl = { value: null };
      sh.uniforms.uWet = { value: LOOK.wet };
      floorMat.userData.u = sh.uniforms;
      sh.vertexShader = 'uniform mat4 uReflMat;\nvarying vec4 vRefl;\n' + sh.vertexShader
        .replace('#include <project_vertex>',
          '#include <project_vertex>\n  vRefl = uReflMat * modelMatrix * vec4( transformed, 1.0 );');
      sh.uniforms.uReflMat = { value: new THREE.Matrix4() };
      floorMat.userData.mat = sh.uniforms.uReflMat;
      sh.fragmentShader = 'uniform sampler2D uRefl;\nuniform float uWet;\nvarying vec4 vRefl;\n'
        + sh.fragmentShader.replace('#include <dithering_fragment>', `
        // THE WATER IS NOT EVERYWHERE, AND NOT EVENLY. A mirror-flat plaza is
        // an ice rink; what a soaked stone floor does is hold water in the low
        // places. The floor's own texture says where those are — the darker it
        // painted, the more it pools — so the same art drives the colour and
        // the wetness, and no second map has to be kept in step with it.
        vec2 rv = vRefl.xy / max(0.0001, vRefl.w);
        // A PERFECT MIRROR IS AN ICE RINK. Standing water on broken stone is
        // never flat: it is held in the low places and stirred by whatever is
        // falling. Offsetting the lookup by the floor's own texture — read at a
        // different scale so it does not correlate with what is under it —
        // breaks the mirror into something the eye reads as water, and costs
        // one extra sample of a texture that is already bound.
        vec3 stir = texture2D( map, vMapUv * 2.7 + vec2( 0.31, 0.17 ) ).rgb;
        rv += ( stir.rg - 0.5 ) * 0.030;
        vec3 mirrored = texture2D( uRefl, rv ).rgb;
        float pool = smoothstep( 0.44, 0.10, dot( texture2D( map, vMapUv ).rgb, vec3(0.333) ) );
        // …and at a grazing angle everything is a mirror, which is why a wet
        // street goes bright toward the horizon and stays dark at your feet
        float graze = pow( 1.0 - abs( normalize( vViewPosition ).z ), 2.6 );
        float k = uWet * clamp( 0.06 + pool * 0.42 + graze * 0.62, 0.0, 0.88 );
        // the water is DARKER than what it reflects — it is a puddle on a black
        // street, not a looking glass, and this is most of the difference
        // between a drowned plaza and a hotel lobby
        gl_FragColor.rgb = mix( gl_FragColor.rgb, mirrored * 0.72, k );
        #include <dithering_fragment>`);
    };
    ground = new THREE.Mesh(new THREE.PlaneGeometry(FLOOR_SPAN, FLOOR_SPAN), floorMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // HALF RESOLUTION, AND A TENTH OF THAT IN THE HARNESS. A reflection in
    // broken water has no fine detail to lose — but the pass is a whole extra
    // render of the world, and it is the most expensive thing in the frame:
    // 2.4 fps to 1.6 in the software rasteriser the suites run on, which took
    // the cast suite past twenty minutes. `?test=1` has capped sleeps since
    // Build 22 and the drawing buffer since Build 119 for the same reason, and
    // nothing the suite asks about the water is a function of its resolution:
    // the check switches the reflection off and compares the floor.
    reflect = new THREE.WebGLRenderTarget(TEST ? 160 : 512, TEST ? 80 : 256);
    reflect.texture.colorSpace = THREE.SRGBColorSpace;
    mirror = new THREE.PerspectiveCamera(FOV, VIEW.w / FULL_H, 0.1, 90);
    mirror.setViewOffset(VIEW.w, FULL_H, 0, OFF_Y, VIEW.w, VIEW.h);

    // THE PANEL. Its band is stated in units of the radius by the mill, so the
    // radius alone decides how tall the skyline stands — pick it and the
    // geometry follows, with the angles staying honest either way.
    const half = L.halfFov * D;
    const top = SKY_R * L.skyAbove, bot = SKY_R * L.skyBelow;
    const skyTex = await loadTex(ART + 'sky.webp');
    skyTex.colorSpace = THREE.SRGBColorSpace;
    // WHICH WAY ROUND, MEASURED NOT REASONED. three builds a cylinder with
    // theta 0 at +Z and winds toward +X; seen from inside, looking down -Z at
    // the board, that lays the painting on backwards. Flipping the texture is
    // one line and the alternative is a negative arc length.
    skyTex.wrapS = THREE.RepeatWrapping;
    skyTex.repeat.x = -1; skyTex.offset.x = 1;
    const panel = new THREE.Mesh(
      new THREE.CylinderGeometry(SKY_R, SKY_R, top + bot, 96, 1, true,
                                 Math.PI - half, half * 2),
      new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, transparent: true,
                                    fog: false, depthWrite: false }));
    panel.position.y = EYE.y + (top - bot) / 2;
    panel.renderOrder = -3;
    scene.add(panel);

    // THE WEATHER BEHIND IT. A hair further out so it never z-fights the panel,
    // and tall enough that no orbit finds its lip.
    const fogTex = new THREE.CanvasTexture(fogBand());
    fogTex.colorSpace = THREE.SRGBColorSpace;
    const haze = new THREE.Mesh(
      new THREE.CylinderGeometry(SKY_R + 3, SKY_R + 3, (top + bot) * 1.9, 64, 1, true),
      new THREE.MeshBasicMaterial({ map: fogTex, side: THREE.BackSide,
                                    fog: false, depthWrite: false }));
    haze.position.y = EYE.y + (top - bot) / 2;
    haze.renderOrder = -4;
    scene.add(haze);
    ground.userData.panel = panel;
    ground.userData.haze = haze;

    // ── THE MIDDLE DISTANCE, WHICH WAS MISSING (Build 122) ───────────────────
    //
    // The world had a floor and a horizon and nothing at all between them, and
    // that is why it read as a stage rather than as a street: every parallax
    // cue was either underfoot or forty-five metres away. A camera that swings
    // needs something at ten metres to swing PAST.
    //
    // What goes there is what the painting has — the arcade running off to the
    // right, and the rubble a collapsed city leaves in its own square. None of
    // it is modelled in detail on purpose: at ten to twenty metres through this
    // much fog a broken column is a silhouette, and a silhouette is a box. The
    // budget goes on there being enough of them, in the right places.
    //
    // SEEDED, so the plaza is the same plaza every time it loads. A battlefield
    // that rearranges itself between reloads is a different kind of wrong.
    let seed = 20250903;
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const rubbleTex = await loadTex(ART + 'floor.webp');
    rubbleTex.wrapS = rubbleTex.wrapT = THREE.RepeatWrapping;
    rubbleTex.repeat.set(0.5, 0.5);
    rubbleTex.colorSpace = THREE.SRGBColorSpace;
    const stone = new THREE.MeshStandardMaterial({
      map: rubbleTex, roughness: 0.86, metalness: 0.0,
      color: new THREE.Color().setScalar(0.34) });
    const props = new THREE.Group();
    const put = (geo, x, y, z, ry) => {
      const m = new THREE.Mesh(geo, stone);
      m.position.set(x, y, z);
      m.rotation.y = ry;
      m.castShadow = true; m.receiveShadow = true;
      props.add(m);
      return m;
    };
    // NOTHING STANDS BEHIND THE FIGHT. The first pass kept props out of the
    // party's own footprint and put a two-metre slab four metres behind it,
    // where the lens turns it into a shipping container parked between Mira and
    // the Regent. The exclusion is a CORRIDOR, not a footprint: it runs the
    // whole depth the camera looks down, and it widens with distance the way
    // the frame does.
    const clear = (x, z) => (z > -16 && z < 6 && Math.abs(x - 0.4) < 7.5 - z * 0.42);
    // THE ARCADE, which is the painting's own colonnade given depth. Set far
    // enough out to stay behind the fight and angled so a swing of the camera
    // slides the near columns across the far ones instead of across nothing.
    const colGeo = new THREE.CylinderGeometry(0.30, 0.38, 5.4, 7);
    const beamGeo = new THREE.BoxGeometry(3.4, 0.5, 0.7);
    for (let i = 0; i < 8; i++) {
      const x = 11.5 + i * 2.4, z = -1.5 - i * 3.0;
      put(colGeo, x, 2.7, z, rnd() * 6);
      if (i) put(beamGeo, x - 1.2, 5.4, z + 1.5, Math.atan2(2.4, 3.0) - Math.PI / 2);
    }
    // …and its ruined twin on the other side, further off and mostly stumps
    for (let i = 0; i < 6; i++) {
      const x = -12 - i * 2.8, z = -1 - i * 2.6;
      const h = 1.1 + rnd() * 3.6;
      put(new THREE.CylinderGeometry(0.32, 0.40, h, 7), x, h / 2, z, rnd() * 6);
    }
    // RUBBLE. Kept LOW and turned hard: a box seen square-on is a crate, and a
    // box tipped and rotated is a lump of masonry. Nothing here is taller than
    // a knee except where it has fallen against something.
    for (let i = 0; i < 74; i++) {
      const x = (rnd() - 0.5) * 48, z = 5 - rnd() * 36;
      if (clear(x, z)) continue;
      const w = 0.35 + rnd() * 1.5, h = 0.12 + rnd() * 0.42, d = 0.35 + rnd() * 1.2;
      const m = put(new THREE.BoxGeometry(w, h, d), x, h / 2 - 0.05, z, rnd() * 6);
      m.rotation.z = (rnd() - 0.5) * 0.8;
      m.rotation.x = (rnd() - 0.5) * 0.6;
    }
    // a few broken slabs, tipped where they fell — well out, and lying down
    for (let i = 0; i < 9; i++) {
      const x = (rnd() - 0.5) * 40, z = 2 - rnd() * 28;
      if (clear(x, z) || Math.abs(x) < 9) continue;
      const m = put(new THREE.BoxGeometry(1.8 + rnd() * 2.2, 0.26, 1.4 + rnd() * 1.6),
                    x, 0.34 + rnd() * 0.5, z, rnd() * 6);
      m.rotation.z = (rnd() - 0.5) * 1.3;
      m.rotation.x = (rnd() - 0.5) * 0.5;
    }
    scene.add(props);
    ground.userData.props = props;

    // ── AND THE WEATHER IN FRONT OF IT ───────────────────────────────────────
    // Three soft sheets of mist drifting across the middle distance. They face
    // the camera and they are almost nothing — but they are what puts AIR
    // between the party and the arcade, which is the difference between a
    // painting with fog in it and a place with fog in it.
    const mistTex = new THREE.CanvasTexture(mistPuff());
    const mist = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(26, 9),
        new THREE.MeshBasicMaterial({ map: mistTex, transparent: true, depthWrite: false,
                                      opacity: 0.20 - i * 0.045, fog: false }));
      m.position.set((rnd() - 0.5) * 8, 1.6 + i * 0.9, -6 - i * 5);
      m.renderOrder = -2;
      m.userData.drift = 0.05 + i * 0.03;
      mist.add(m);
    }
    scene.add(mist);
    ground.userData.mist = mist;

    // …AND THE AIR BETWEEN. Real distance fog is what makes forty metres of
    // floor read as forty metres rather than as a big flat sheet, and it is
    // what hides the ground plane's edge without a fade texture. At the seven
    // metres the party stands at it is imperceptible; by the cyclorama it has
    // taken a third of the contrast, which is what the painting does too.
    // The seam between the floor and the panel is the horizon, and a horizon
    // that is a hard line is a horizon nobody believes. At 0.0155 the fog was
    // too thin to close it; this takes about seventy per cent of the floor's
    // contrast by the time it reaches the cyclorama and still leaves the party,
    // seven metres out, untouched at four.
    scene.fog = new THREE.FogExp2(0x9aa0a6, 0.0285);

    cam = new THREE.PerspectiveCamera(FOV, VIEW.w / FULL_H, 0.1, 90);
    cam.setViewOffset(VIEW.w, FULL_H, 0, OFF_Y, VIEW.w, VIEW.h);
    cam.rotation.order = 'YXZ';
    return true;
  }

  // ── point them at the enemy ──────────────────────────────────────────────
  //
  // WHICH WAY IS THIS BODY FACING? The line from the left shoulder to the
  // right one is the lateral axis; crossing it with up gives the direction the
  // chest points. Measure that, and turning to face the foe is arithmetic.
  //
  // AND IT HAS TO BE MEASURED WITH THE IDLE RUNNING. This is the part two
  // builds got wrong by eye. A generated model faces wherever the generator
  // pointed it — but on top of that the idle clip carries its own rotation,
  // and `Combat_Stance` turns the body about fifty degrees all by itself. A
  // static angle set against the bind pose therefore cannot control facing at
  // all: the clip moves it afterwards. So the aim is taken after the mixer has
  // posed the figure, which is the only moment the number means anything.
  //
  // Acting clips turn the body too, and that is wanted — a swing should wind
  // up and follow through. Only the resting heading is pinned.
  function headingOf(f) {
    const g = (n) => (f.bones[n] ? f.bones[n].getWorldPosition(new THREE.Vector3()) : null);
    const L = g('LeftShoulder') || g('LeftUpLeg');
    const R = g('RightShoulder') || g('RightUpLeg');
    if (!L || !R) return null;
    const lateral = new THREE.Vector3().subVectors(R, L);
    const fwd = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), lateral).normalize();
    return Math.atan2(fwd.x, fwd.z) / D;   // 0 looks at the camera, 90 looks right
  }
  function aim(f, want) {
    f.root.updateWorldMatrix(true, true);
    const now = headingOf(f);
    if (now == null) return;
    let d = want - now;
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    f.root.rotation.y += d * D;
    f.root.userData.heading = want;
    f.root.updateWorldMatrix(true, true);
  }

  // ── find each figure's frame by looking at it ────────────────────────────
  // Render one figure alone into a small offscreen target, read the alpha
  // channel, and solve for the camera that puts its silhouette in the middle
  // of the box at FILL of the height. Four passes converge from any start.
  // Runs once, at load, on the idle's first frame.
  function fit(f) {
    const W = 192, H = 288;
    const target = new THREE.WebGLRenderTarget(W, H);
    const buf = new Uint8Array(W * H * 4);
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 40);
    const wasVisible = {};
    for (const id of Object.keys(figs)) {
      wasVisible[id] = figs[id].root.visible;
      figs[id].root.visible = (figs[id] === f);
    }
    const prevTarget = renderer.getRenderTarget();
    const scissorWas = renderer.getScissorTest();
    // AND THE VIEWPORT, WHICH ONLY MATTERS NOW THAT THIS RUNS MID-RUN. This
    // sets a 192x288 viewport and used to be called once, at load, before the
    // first frame — and `setSize` sets the viewport, so the next frame put it
    // back by accident. A creature that arrives at frame 4000 arrives between
    // two frames that both think the size is unchanged, and the whole world
    // would draw into a thumbnail in the bottom-left corner until the window
    // was resized.
    const vpWas = new THREE.Vector4();
    renderer.getViewport(vpWas);
    renderer.setScissorTest(false);
    // THE FLOOR IS NOT PART OF ANYBODY'S SILHOUETTE. This reads the alpha
    // channel to find where a figure begins and ends, and a ground plane
    // spanning the frame fills every pixel of it — leave it in and every
    // figure measures as exactly one screen tall.
    // THE WORLD IS NOT PART OF ANYBODY'S SILHOUETTE. This reads the alpha
    // channel to find where a figure begins and ends, and a floor and a
    // horizon fill every pixel of the frame — leave them in and every figure
    // measures as exactly one screen tall.
    const worldWas = ground && ground.visible;
    // EVERYTHING THE WORLD IS, not a list of the pieces it had when this was
    // written. Build 122 added an arcade, sixty pieces of rubble and three
    // sheets of mist, and every one of them landed inside the silhouette this
    // measures — which moved the Regent a quarter of a metre and lifted her
    // twenty pixels, from nothing but new scenery being in shot.
    const world = ground
      ? [ground, ground.userData.panel, ground.userData.haze,
         ground.userData.props, ground.userData.mist]
      : [];
    for (const o of world) if (o) o.visible = false;
    const fogWas = scene.fog; scene.fog = null;

    for (let pass = 0; pass < 5; pass++) {
      const aspect = W / H;
      cam.top = f.viewH / 2; cam.bottom = -f.viewH / 2;
      cam.left = -f.viewH * aspect / 2; cam.right = f.viewH * aspect / 2;
      cam.position.set(f.midX, f.midY, 6);
      cam.lookAt(f.midX, f.midY, 0);
      cam.updateProjectionMatrix();
      renderer.setRenderTarget(target);
      renderer.setViewport(0, 0, W, H);
      renderer.clear();
      renderer.render(scene, cam);
      renderer.readRenderTargetPixels(target, 0, 0, W, H, buf);

      let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (buf[(y * W + x) * 4 + 3] > 20) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
      if (x1 < 0) { f.viewH *= 2; continue; }          // nothing drawn: pull back
      // the render target counts y from the BOTTOM, like GL
      const perPx = f.viewH / H;
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      f.midX += (cx - W / 2) * perPx;
      f.midY += (cy - H / 2) * perPx;
      const h = (y1 - y0) / H;
      if (Math.abs(h - FILL) < 0.015) break;
      f.viewH *= h / FILL;
    }

    renderer.setRenderTarget(prevTarget);
    renderer.setViewport(vpWas);
    renderer.setScissorTest(scissorWas);
    for (const o of world) if (o) o.visible = worldWas;
    scene.fog = fogWas;
    for (const id of Object.keys(figs)) figs[id].root.visible = wasVisible[id];
    target.dispose();
  }

  // THE CLIP LIBRARY IS SHARED, THE MODELS ARE NOT. Meshy's humanoid rig is
  // standardised — all three characters came back with the same 24 joints, in
  // the same order, under the same names — so one library of clips authored
  // against one of them drives all three. An AnimationClip addresses its
  // tracks by node name, which means retargeting here is not a step at all; it
  // is simply what happens.
  // ── ONE CREATURE, STOOD UP ──────────────────────────────────────────────
  //
  // Everything that turns a downloaded GLB into a figure on the floor, in one
  // place, because it now happens at two different times: three heroes before
  // the layer says it is ready, and each creature whenever it turns up.
  function mount(id, gltf) {
    const tone = CAST[id];
    const root = gltf.scene;
    let map = null;
    root.traverse(o => {
      if (o.isMesh || o.isSkinnedMesh) map = map || o.material.map || o.material.emissiveMap;
    });
    const mat = watercolour(map, tone);
    root.traverse(o => {
      if (o.isMesh || o.isSkinnedMesh) { o.material = mat; o.frustumCulled = false; o.castShadow = true; }
    });
    root.scale.setScalar(tone.tall);
    root.userData.mat = mat;
    // `frame` decides who is visible, from who is on screen; a creature that
    // arrives while nothing is wearing it must not flash up in the middle of
    // the floor for the one frame before that runs.
    root.visible = false;
    scene.add(root);
    const f = figs[id] = new Figure(root, tone, clips, restSrc, parentOf, windows, meta);
    // one frame of the idle, so the measurement sees a standing figure rather
    // than whatever the bind pose happens to be
    f.step(0.016);
    // aim BEFORE framing: turning a figure changes its silhouette, and the
    // frame is measured from the silhouette
    const side = tone.side || 1;
    aim(f, side * FOE_HEADING - side * tone.turn);
    fit(f);
    stand(id);
    return f;
  }

  // ── AND NOW PUT IT ON THE GROUND ────────────────────────────────────────
  //
  // `fit` measured the silhouette by looking at it, which is the only thing
  // that has ever worked here — Box3 reports a SkinnedMesh's authored box and
  // bone-to-bone needs a fudge for the sole under the toe and the hood over
  // the crown, different for every character. Its output was a camera frame
  // when there was a camera per figure; it is the same measurement either
  // way, so it is simply read differently now: a figure that fills FILL of a
  // frame `viewH` tall is `viewH * FILL` metres tall, and its soles are half
  // that below the silhouette's centre.
  //
  // WHICH MAKES HEIGHT A DECISION RATHER THAN AN ACCIDENT. Meshy is asked for
  // a height in metres and obliges approximately; eight characters generated
  // on five different days do not agree to the centimetre, and a Kneeling
  // Revenant has no reason to be the size of the people fighting it. So each
  // figure is scaled to the height the FIGHT wants — the party level with each
  // other, the big things looming over them — and then dropped until its feet
  // touch y=0. Nobody floats and nobody sinks, because neither is a number
  // anyone chose.
  function stand(id) {
    const f = figs[id];
    const h0 = f.viewH * FILL;                       // metres, as generated
    const s = (CAST[id].metres || TALL_M[CAST[id].foe ? 'foe' : 'hero']) / h0;
    f.root.scale.multiplyScalar(s);
    f.worldH = h0 * s;
    f.ctrOff = f.midX * s;                           // it is not centred either
    f.root.position.y = -(f.midY - h0 / 2) * s;      // soles to the floor
    const slot = slotOf(id) || STAGE.hero.front;
    f.root.position.x = slot[0] - f.ctrOff;
    f.root.position.z = slot[1];
    f.root.updateWorldMatrix(true, true);
  }

  // ── ASK FOR SOMEBODY ────────────────────────────────────────────────────
  //
  // Idempotent and safe to call every frame: a figure already standing, a
  // fetch already in flight and a model already known to be absent all return
  // the same settled promise, so `frame` can simply say what it wants sixty
  // times a second.
  //
  // ONE MISSING MODEL IS NOT A DEAD LAYER. A creature that has not been
  // generated yet leaves its painted plate alone and lets the rest of the cast
  // stand up, rather than taking the whole stage down with it.
  function want(id) {
    if (!CAST[id] || figs[id] || missing.indexOf(id) >= 0) return Promise.resolve();
    if (fetching[id]) return fetching[id];
    return (fetching[id] = new GLTFLoader().loadAsync(ART + CAST[id].model)
      .then(g => { mount(id, g); }, () => { missing.push(id); }));
  }

  // THE CLIP LIBRARY IS SHARED, THE MODELS ARE NOT. Meshy's humanoid rig is
  // standardised — all eight characters came back with the same 24 joints, in
  // the same order, under the same names — so one library of clips authored
  // against one of them drives all of them. An AnimationClip addresses its
  // tracks by node name, which means retargeting here is not a step at all; it
  // is simply what happens.
  //
  // ── THE PARTY LOADS. THE BESTIARY ARRIVES. ──────────────────────────────
  //
  // Build 122 waited on every model before the layer would admit to being
  // ready, and Build 123 took that from two creatures to five: 16.6 MB before
  // the first frame, which is a blank battlefield on a phone and an eight-
  // second timeout in the harness.
  //
  // But the party is on screen from the first frame of every run, and a
  // creature is on screen when the fight puts it there — which is never at
  // load, and for most of the bestiary never at all, since a run meets two or
  // three of the five. So: the party is waited for, and each creature is
  // fetched when something asks for it. `frame` asks the moment an element
  // claims a foe id, and a warm queue asks quietly for the rest, one at a
  // time, once the party is standing — so the common case is that the model
  // arrived minutes before the creature did.
  //
  // It is the same `mount` either way. A creature that arrives on frame 4000
  // is indistinguishable from one that arrived on frame 1.
  async function load() {
    const lib = await fetch(CLIPS_URL).then(r => {
      if (!r.ok) throw new Error('clips ' + r.status);
      return r.json();
    });
    restSrc = lib.__rest || {};
    parentOf = lib.__parent || {};
    for (const name of Object.keys(lib)) {
      if (name === '__rest' || name === '__parent') continue;
      clips[name] = THREE.AnimationClip.parse(lib[name]);
      if (lib[name].window) windows[name] = lib[name].window;
      meta[name] = { beat: lib[name].beat, loop: !!lib[name].loop };
    }
    clipNames = Object.keys(clips);

    const ids = Object.keys(CAST);
    await Promise.all(ids.filter(id => !CAST[id].foe).map(want));
    ready = true;

    unloaded = ids.filter(id => CAST[id].foe);
    warming = unloaded.slice()
      .reduce((p, id) => p.then(() => want(id)), Promise.resolve());
  }

  // ── WHOSE ELEMENT IS THIS? ─────────────────────────────────────────────────
  //
  // A FOE IS FOUND BY WHO IT IS, NOT BY WHICH SLOT IT STANDS IN. Build 118
  // gave the Regent `sel: '#k-boss-art'` — the DOM slot the first opponent
  // occupies — and that is true of the Regent and of every other creature in
  // the game, so the Kneeling Revenant, the Hollow Husk and the rest were all
  // being drawn wearing the Regent's body. It reads as "the boss turned up
  // early" rather than as a bug, which is why it shipped.
  //
  // game.js has stamped `data-foe` with the creature's own id since Build 101
  // for exactly this kind of question, so the lookup asks that. Four of the
  // five foes have no model yet; they get their paintings back instead of
  // somebody else's body, which is the honest thing for the layer to do with
  // an actor it does not have.
  function nodeOf(id) {
    if (!CAST[id].foe) return document.querySelector(CAST[id].sel);
    return document.querySelector('#k-cast [data-foe="' + id + '"]');
  }

  // ── WHICH SLOT IS THIS BODY STANDING IN? ───────────────────────────────────
  // game.js stays the authority on WHO IS WHERE IN GAME TERMS — it has set the
  // row class and `data-row` since Build 101 and nothing here second-guesses
  // it. What the world owns is what that means in metres. The two never
  // disagree because only one of them has an opinion.
  function slotOf(id) {
    const node = nodeOf(id);
    if (!node) return null;
    const row = node.dataset.row
      || (node.classList.contains('k-row-front') ? 'front'
        : node.classList.contains('k-row-mid') ? 'mid'
        : node.classList.contains('k-row-back') ? 'back' : null);
    if (CAST[id].foe) {
      const host = document.getElementById('k-cast');
      const line = host && host.classList.contains('k-line-many');
      // one opponent stands where one opponent has always stood; a LINE of
      // them mirrors the party's ladder across the floor
      if (!line || !row) return STAGE.solo;
      return STAGE.foe[row] || STAGE.solo;
    }
    return STAGE.hero[row] || STAGE.hero.front;
  }

  // ── THE DOM FOLLOWS ────────────────────────────────────────────────────────
  //
  // Project the soles and the crown, and hand the DOM the rectangle they make.
  // Everything anchored to `.k-hero` — the nameplate, the HP bar, the drop
  // zone, the aim target, the damage popups — comes along for free, because
  // they were always anchored to the element rather than to the lane variable
  // that used to move it.
  //
  // `behind` is carried even though nothing uses it yet: once the camera is
  // allowed to cross the line, an actor can end up BEHIND it, and a projected
  // point behind the camera comes back mirrored through the origin rather than
  // off-screen — a hero would appear to leap to the opposite side of the frame
  // rather than leave it.
  // ── TWO PIXEL SPACES, AND THEY ARE NOT THE SAME ONE ────────────────────────
  //
  // `#k-scale` magnifies the whole 932x430 board to fill whatever window it is
  // opened in, so a hero's CSS transform is written in STAGE UNITS — where the
  // board is 932 wide, always — while `getBoundingClientRect()` answers in
  // RENDERED pixels, where on a laptop the same board is 2000 wide.
  //
  // Projecting into the rendered size and handing the number to a CSS transform
  // therefore multiplies by the zoom TWICE: at a 2.15x window the Regent's
  // anchor came out at x=1515 on a stage 932 wide, which put the drag beam off
  // the right-hand edge of the screen. The figure was drawn correctly the whole
  // time — the canvas is in rendered pixels and always was — so nothing looked
  // wrong except the beam pointing into the void.
  //
  // IT SURVIVED NINE SUITES BECAUSE THE HARNESS BOOTS AT EXACTLY 932x430. At
  // that one window the zoom is 1 and the two spaces are numerically equal, so
  // every check that has ever measured this measured the only case that cannot
  // fail. `offsetWidth` is the layout size, which is the space the transform
  // lives in, and it is the same number at every window size.
  //
  // (Build 112 shipped the mirror image of this and it read identically from a
  // distance: `setViewport` applies the pixel ratio itself, so pre-multiplying
  // put the whole party off the top-right corner. Whenever a thing is drawn in
  // one space and positioned in another, ask which one each number is in.)
  function hostBox(host) {
    return { w: host.offsetWidth || VIEW.w, h: host.offsetHeight || VIEW.h };
  }
  const _w = new THREE.Vector3(), _foot = new THREE.Vector3(), _crown = new THREE.Vector3();
  function toScreen(world, b) {
    _w.copy(world).applyMatrix4(cam.matrixWorldInverse);
    const behind = _w.z > -0.05;
    _w.applyMatrix4(cam.projectionMatrix);
    return { x: (_w.x * 0.5 + 0.5) * b.w, y: (-_w.y * 0.5 + 0.5) * b.h, behind };
  }

  function follow(id, f, b) {
    const node = nodeOf(id);
    if (!node) return;
    const foot = toScreen(_foot.copy(f.root.position), b);
    const crown = toScreen(_crown.set(f.root.position.x,
                                      f.root.position.y + f.worldH,
                                      f.root.position.z), b);
    const box = node.offsetHeight || 1;
    const s = Math.max(0.02, (foot.y - crown.y) / box);
    node.style.setProperty('--w-x', foot.x.toFixed(1));
    node.style.setProperty('--w-y', foot.y.toFixed(1));
    node.style.setProperty('--w-s', s.toFixed(4));
    node.style.setProperty('--w-off', (foot.behind || crown.behind) ? '1' : '0');
  }

  // ── THE FLOOR MARKS FOLLOW TOO ─────────────────────────────────────────────
  //
  // FRONT / MID / BACK are painted on the floor as three ellipses, and they are
  // also the drop targets: `rowTargetAt` in game.js picks a lane by asking which
  // marker's rect the finger is nearest. While the camera stood still, CSS
  // could park them at fixed pixels and both jobs were done.
  //
  // A camera that can swing behind the party breaks BOTH at once, and the
  // second one silently: the marks would sit where the board used to be, and
  // dragging a hero would put them in a lane chosen by where that lane was
  // painted three builds ago. Projecting the marks from the same world the
  // figures stand in fixes the picture and the aim in one go — no raycast, no
  // second copy of the layout, and `rowTargetAt` never learns anything changed.
  const _mark = new THREE.Vector3(), _edge = new THREE.Vector3();
  const MARK_M = 0.78;                    // a lane mark is about this wide, in metres
  function followRows(b) {
    const rows = document.querySelectorAll('#k-rows .k-row');
    for (const el of rows) {
      const slot = STAGE.hero[el.dataset.row];
      if (!slot) continue;
      const c = toScreen(_mark.set(slot[0], 0, slot[1]), b);
      const e = toScreen(_edge.set(slot[0] + MARK_M, 0, slot[1]), b);
      const w = Math.abs(e.x - c.x) * 2;
      el.style.setProperty('--w-x', c.x.toFixed(1));
      el.style.setProperty('--w-y', c.y.toFixed(1));
      el.style.setProperty('--w-s', Math.max(0.05, w / (el.offsetWidth || 140)).toFixed(4));
      el.style.setProperty('--w-off', c.behind ? '1' : '0');
    }
  }

  // ── THE CAMERA LANGUAGE ALREADY EXISTED ────────────────────────────────────
  //
  // `cam()` in game.js has spoken in dolly, pan, roll, yaw and pitch since
  // Build 22, writing them onto `#k-cast` as custom properties for a CSS
  // transform to consume. Those are camera words. They were only ever a CSS
  // transform because there was no camera to give them to. So this reads the
  // same six properties and moves the real one — which means every camPush,
  // camParryOpen, camOffsetTo and camHold written since Build 22 became a
  // three-dimensional camera move without one line changing in game.js.
  //
  // THE TARGET IS READ; THE TRAVEL IS OURS. A custom property does not
  // interpolate during a CSS transition — the transition is on `transform`,
  // not on the variables behind it — so getComputedStyle returns where the
  // camera is GOING, never where it is. That turns out to be the useful half:
  // the easing belongs here, at frame rate and in three dimensions, rather
  // than being reverse-engineered out of a matrix every frame.
  const RIG = { x: 0, y: 0, dz: 0, r: 0, yaw: 0, pitch: 0 };
  const WANT = { x: 0, y: 0, dz: 0, r: 0, yaw: 0, pitch: 0 };
  // the tripod: where it is standing now, and where it has been asked to stand
  const TRIPOD = Object.assign({}, SHOTS.home, { atP: BOARD.slice() });
  const SHOT = Object.assign({}, SHOTS.home);
  // ── A MOMENT MAY TAKE THE CAMERA, BUT IT MAY NOT KEEP IT ───────────────────
  //
  // A phase lasts until the phase changes; an ACTION lasts about a second. If
  // both set the shot the same way, the first sword swing of the fight parks
  // the camera on the Regent's shoulder for the rest of the turn. So a shot
  // asked for with `{ for: ms }` is transient: it plays, and when its time is
  // up the camera returns to whatever the phase had it doing — remembered here
  // rather than re-sent, so an action never has to know what it interrupted.
  const BASE = Object.assign({}, SHOTS.home);
  let holdUntil = 0;
  let shotSpeed = 1.6;
  const _eye = new THREE.Vector3(), _look = new THREE.Vector3();
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  // AZIMUTH TAKES THE SHORT WAY ROUND. Easing 350 degrees to 10 by subtracting
  // sends the camera the long way through everything behind it; a shot is a
  // move a camera operator could make, so it takes the shorter arc every time.
  function easeAngle(now, want, k) {
    let d = want - now;
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    return now + d * k;
  }

  function rig(host, dt) {
    // has the moment passed? then give the camera back
    if (holdUntil && now() >= holdUntil) {
      holdUntil = 0;
      Object.assign(SHOT, BASE);
      shotSpeed = 1.25;               // ease back rather than cut back
    }
    const cs = getComputedStyle(host);
    const n = (k) => { const v = parseFloat(cs.getPropertyValue(k)); return isNaN(v) ? 0 : v; };
    WANT.x = n('--cam-x'); WANT.y = n('--cam-y'); WANT.dz = n('--cam-dz');
    WANT.r = n('--cam-r'); WANT.yaw = n('--cam-yaw'); WANT.pitch = n('--cam-pitch');
    const k = Math.min(1, dt * 7.5);
    for (const key of Object.keys(RIG)) RIG[key] += (WANT[key] - RIG[key]) * k;

    // ── the tripod walks to its mark ──
    const ks = Math.min(1, dt * shotSpeed * 2.6);
    const target = aimPoint(SHOT.at);
    TRIPOD.az = easeAngle(TRIPOD.az, SHOT.az, ks);
    for (const key of ['dist', 'height', 'aimY']) TRIPOD[key] += (SHOT[key] - TRIPOD[key]) * ks;
    for (let i = 0; i < 3; i++) TRIPOD.atP[i] += (target[i] - TRIPOD.atP[i]) * ks;

    const a = TRIPOD.az * D;
    // kept on the module, not local, because the reflection pass mirrors them
    _eye.set(TRIPOD.atP[0] + Math.sin(a) * TRIPOD.dist,
             TRIPOD.height,
             TRIPOD.atP[2] + Math.cos(a) * TRIPOD.dist);
    _look.set(TRIPOD.atP[0], TRIPOD.aimY, TRIPOD.atP[2]);
    cam.position.copy(_eye);
    cam.up.set(0, 1, 0);
    cam.lookAt(_look);

    // ── and the operator's hands, in the camera's own axes ──
    //
    // IN THE CAMERA'S AXES, NOT THE WORLD'S. A push-in has always meant "toward
    // what I am looking at"; while the camera stood at one spot facing one way
    // that was also "along -Z in the world", so Build 119 could get away with
    // writing it as a world offset. The moment the tripod can stand anywhere,
    // the two part company — a push from behind the party would have dollied
    // sideways. Translating along the camera's own basis is what the words
    // meant all along.
    const m = 1 / PX_M;
    cam.translateX(-RIG.x * m);
    cam.translateY(RIG.y * m);
    cam.translateZ(-RIG.dz * m);
    cam.rotateX(-RIG.pitch * D);
    cam.rotateY(-RIG.yaw * D);
    cam.rotateZ(RIG.r * D);
    cam.updateMatrixWorld();
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
    if (!b.width) return;
    // stage units for placing the DOM, rendered pixels for the drawing buffer
    const css = hostBox(host);
    const zoom = b.width / css.w || 1;
    // ── RESIZE ONLY WHEN THE SIZE CHANGED ────────────────────────────────────
    //
    // This was costing 570 ms A FRAME, and it had been since Build 112.
    // `setSize` assigns `canvas.width`, and assigning canvas.width REALLOCATES
    // AND CLEARS THE DRAWING BUFFER whether or not the number changed — it is
    // the documented way to wipe a canvas. Called unconditionally every frame
    // on a 2330x1075 buffer, that is a fresh multi-megabyte allocation sixty
    // times a second to draw the same size picture.
    //
    // It hid because it looks like bookkeeping. The layer ran at 1.7 fps in the
    // harness and the suite blamed the scene: turning off the shadows, the
    // floor and every figure moved it to 2.1, which reads as "the renderer is
    // just slow here" rather than "nothing I switched off was ever the cost".
    // What found it was measuring the layer against ITSELF DISABLED — 1.74
    // against 60 — which is the only comparison that could not be explained by
    // the contents of the scene.
    //
    // 2.5 was also a strange ceiling to have chosen: at 932 CSS px wide the
    // figures are ~150 px tall, and there is nothing in a watercolour wash that
    // repays six times the fragments. Two is past the point anybody can see.
    // …AND THE HARNESS GETS ONE PIXEL PER PIXEL. Headless Chromium rasterises
    // in software, where cost is very nearly linear in fragments: the same
    // scene runs 1.76 / 3.35 / 5.24 fps at buffers of 1864x860, 932x430 and
    // 466x215. Build 118 drew into four scissor boxes covering about a
    // twelfth of the frame and got 3.9; one shared world has to fill all of
    // it, which is 2.2x the fragments and exactly the price of having a floor.
    //
    // A phone fills 1864x860 without noticing. A software rasteriser turns it
    // into a two-minute suite, so `?test=1` — which has capped sleeps since
    // Build 22 for the same reason — caps the buffer too. Nothing the suite
    // measures is a function of pixel density: geometry, facing, motion and
    // projection are all scale-free, and the two checks that count pixels
    // count them as a FRACTION of the box they are in.
    //
    // …AND THE BUFFER FOLLOWS THE ZOOM, NOT THE LAYOUT. The canvas's CSS box is
    // the stage's 932x430 whatever window it is in; the ancestor transform is
    // what makes it big. So crispness at a magnified window comes from folding
    // the zoom into the pixel ratio, not from resizing a box that never
    // changes — and the cap is on the product, so a very large monitor asks for
    // a sharper picture rather than an unbounded one.
    const dpr = Math.min(TEST ? 1 : 2.5, (window.devicePixelRatio || 1) * zoom);
    if (css.w !== sized.w || css.h !== sized.h || dpr !== sized.dpr) {
      sized.w = css.w; sized.h = css.h; sized.dpr = dpr;
      renderer.setPixelRatio(dpr);
      renderer.setSize(css.w, css.h, false);
    }

    rig(host, dt);

    // WHICH ELEMENTS ARE WEARING A FIGURE THIS FRAME. An element only gives up
    // its painting to a model that is actually standing on it — see `nodeOf` —
    // so the claim is made here, per frame, rather than assumed once at load.
    // ANYONE WHO HAS TURNED UP GETS ASKED FOR. This is the one moment lazy
    // loading has to notice: an element is wearing a foe id and there is no
    // model on it yet. In practice the warm queue has almost always got there
    // first — a fight is minutes into a run — and this list empties as the
    // models land, so the common case costs an empty loop.
    for (let i = 0; i < unloaded.length; i++) {
      const id = unloaded[i];
      if (figs[id] || missing.indexOf(id) >= 0) { unloaded.splice(i--, 1); continue; }
      if (nodeOf(id)) want(id);
    }

    const claimed = [];
    for (const id of Object.keys(figs)) {
      const f = figs[id];
      f.step(dt);
      const node = nodeOf(id);
      const vis = !!node && node.offsetParent !== null;
      f.root.visible = vis;
      if (vis) {
        claimed.push(node);
        if (!node.classList.contains('k-cast3d-on')) node.classList.add('k-cast3d-on');
      }
      if (!vis) continue;
      // THE WALK IS A WALK NOW. A row change used to be a 380ms CSS transition
      // on a transform: the figure slid because the rectangle it was painted
      // into slid. Easing the WORLD position instead means the model actually
      // crosses the floor — and its shadow crosses with it, which is the tell
      // that it is really over there rather than drawn smaller.
      const slot = slotOf(id);
      if (slot) {
        const k = Math.min(1, dt * 5.5);
        f.root.position.x += (slot[0] - f.ctrOff - f.root.position.x) * k;
        f.root.position.z += (slot[1] - f.root.position.z) * k;
      }
      const mat = f.root.userData.mat;
      if (mat && mat.userData.depth) {
        // the air-and-warmth ladder, from real distance rather than a class
        mat.userData.depth.value = Math.max(0, Math.min(1, 1 - (EYE.z - f.root.position.z - 6.4) / 3.2));
      }
    }

    // …and anything that WAS wearing a figure and is not any more takes its
    // painting back, or a foe that has been replaced mid-run leaves an empty
    // box standing where a creature ought to be.
    for (const n of document.querySelectorAll('#k-cast .k-cast3d-on'))
      if (claimed.indexOf(n) < 0) n.classList.remove('k-cast3d-on');

    // ── THE WATER, WHICH IS A SECOND VIEW OF THE SAME WORLD ──────────────────
    //
    // Mirror the camera through the floor plane, render everything except the
    // floor itself, and hand the result to the floor to sample. The mirroring
    // is exact rather than approximate because the plane is y=0 and the rig
    // already knows where the camera is looking: negate both heights and the
    // reflected view falls out.
    //
    // The floor samples it by the REFLECTED FRAGMENT'S OWN SCREEN POSITION, not
    // by its texture coordinates — which is what makes a reflection follow the
    // eye the way a reflection does. `uReflMat` carries the mirror camera's
    // view-projection, biased into [0,1], so the shader's divide by w lands on
    // the right pixel from any angle the camera cares to take.
    // THE DIAL HAS TO REACH THE SHADER EVEN WHEN IT TURNS THE PASS OFF. Writing
    // `uWet` inside the block that `wet` gates means turning the water down to
    // zero skips the write, the uniform keeps whatever it last held, and the
    // floor goes on reflecting a texture nobody is updating any more. The
    // setting is pushed first; only the expensive half is gated.
    if (ground.material.userData.u) ground.material.userData.u.uWet.value = LOOK.wet;
    if (reflect && LOOK.wet > 0.01) {
      mirror.position.set(_eye.x, -_eye.y, _eye.z);
      mirror.up.set(0, 1, 0);
      mirror.lookAt(_look.x, -_look.y, _look.z);
      mirror.rotateZ(RIG.r * D);
      mirror.updateMatrixWorld();
      mirror.updateProjectionMatrix();
      const u = ground.material.userData;
      if (u.mat) {
        u.mat.value
          .set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1)
          .multiply(mirror.projectionMatrix).multiply(mirror.matrixWorldInverse);
      }
      // the floor cannot reflect itself, and a shadow catcher in a mirror is a
      // dark smear where the water should be brightest
      ground.visible = false;
      const fogWas = scene.fog;
      renderer.setRenderTarget(reflect);
      renderer.clear();
      renderer.render(scene, mirror);
      renderer.setRenderTarget(null);
      scene.fog = fogWas;
      ground.visible = true;
      if (u.u) u.u.uRefl.value = reflect.texture;
    }

    // the mist drifts, and turns to face wherever the camera went
    if (ground && ground.userData.mist) {
      for (const m of ground.userData.mist.children) {
        m.position.x += m.userData.drift * dt;
        if (m.position.x > 16) m.position.x = -16;
        m.quaternion.copy(cam.quaternion);
      }
    }

    // ONE SCENE, ONE CAMERA, ONE PASS. Four scissored renders and four
    // orthographic frames are what it took to fake a shared space; a shared
    // space needs none of them.
    renderer.render(scene, cam);

    for (const id of Object.keys(figs)) follow(id, figs[id], css);
    followRows(css);

    if (pending) {
      const cv = document.createElement('canvas');
      cv.width = canvas.width; cv.height = canvas.height;
      cv.getContext('2d').drawImage(canvas, 0, 0);
      const done = pending; pending = null; done(cv);
    }
  }

  return {
    // ── THIS IS THE GAME NOW (Build 124) ──────────────────────────────────
    //
    // Twelve builds behind `?cast=3d` was the right way to grow a renderer —
    // the painted stage kept working the whole time and every step could be
    // measured against it. But a flag nobody sets is a feature nobody has, and
    // there is no longer a reason to prefer the plates: every creature in the
    // bestiary has a body, the world has a floor and a horizon, the camera
    // answers the fight, and the party costs 6.1 MB rather than 16.6.
    //
    // `?cast=2d` is the way back, and it is a real route rather than a
    // courtesy: it is what the eight suites that measure the RULES boot with,
    // and it is the honest answer for a machine that cannot draw this.
    wanted: () => !/(^|[?&])cast=2d(&|$)/.test(location.search),
    async enable() {
      if (on) return true;
      if (!(await build())) return false;
      try { await load(); } catch (err) { failed = 'load: ' + err.message; return false; }
      // ── AN EMPTY PLAZA IS WORSE THAN A PAINTING ─────────────────────────
      //
      // This mattered less when a flag turned the layer on: whoever set it
      // could unset it. On the default path it is the difference between a
      // bad network and a broken game.
      //
      // The world is OPAQUE — floor, horizon, fog, the whole frame — so if it
      // takes the stage with nobody standing in it, the result is not a
      // degraded 3D scene, it is an empty street where the fight should be.
      // A creature is different, and always has been: it arrives late by
      // design, and the plate rule covers the gap by name. The PARTY is not
      // optional. If any of the three failed to load, this hands the whole
      // stage back to the paintings, which are coherent on their own.
      const party = Object.keys(CAST).filter(id => !CAST[id].foe);
      const stood = party.filter(id => figs[id]);
      if (stood.length !== party.length) {
        failed = 'party: ' + stood.length + '/' + party.length + ' stood up';
        return false;
      }
      document.body.classList.add('k-cast3d');
    // NOTHING NEEDS MARKING AS ABSENT ANY MORE. A plate keeps its painting
    // until a figure claims it by name every frame, so a model that failed to
    // load — or a creature nobody has generated yet — is handled by the same
    // rule that handles a creature standing in somebody else's slot.
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
    // THE FIGHT ASKS FOR A VERB, NOT A CLIP. `slash` is a longsword for Ash, a
    // staff for Elin and a pair of daggers for Mira; everything else is the
    // same motion whoever throws it. Resolving that here means game.js keeps
    // speaking the four words actionKind() has returned since Build 36.
    play(heroId, verb) {
      const f = figs[heroId];
      if (!on || !f) return false;
      // IDLE IS NOT AN ACTION, it is what is left when no action is playing.
      // Asking for it by name — which is what standing back up does — means
      // "stop acting", not "play the idle once and then stop".
      if (verb === 'idle') { f.clear(); return true; }
      const pick = VERB[verb];
      return f.play(pick ? pick(heroId) : verb);
    },
    all(clip) { Object.keys(figs).forEach(id => this.play(id, clip)); },
    // test-only: what the layer thinks is true right now
    _state: () => ({
      on, ready, failed, clips: clipNames, missing,
      foes: Object.keys(CAST).filter(id => CAST[id].foe && figs[id]),
      figures: Object.keys(figs),
      playing: Object.fromEntries(Object.keys(figs).map(id => [id, figs[id].clipName || null])),
      bones: Object.keys(figs).length ? Object.keys(figs[Object.keys(figs)[0]].bones).length : 0,
    }),
    // test-only: THE WORLD, MEASURED OFF THE WORLD. Not the table it was
    // configured from — the live scene graph, the live camera, and where the
    // projection actually lands. Three checks in Build 118 passed while the
    // game was wrong because they read a dial instead of the thing the dial
    // was supposed to cause; this exists so the world's checks cannot.
    _world: () => {
      const host = document.getElementById('k-cast');
      // stage units, like everything the DOM is placed in — see hostBox
      const b = host ? hostBox(host) : { w: VIEW.w, h: VIEW.h };
      const out = { scenes: 1, ground: !!(ground && ground.parent),
                    shadows: !!(renderer && renderer.shadowMap.enabled),
                    cam: { kind: cam ? cam.type : null,
                           fov: cam ? +cam.fov.toFixed(2) : null,
                           x: cam ? +cam.position.x.toFixed(3) : null,
                           y: cam ? +cam.position.y.toFixed(3) : null,
                           z: cam ? +cam.position.z.toFixed(3) : null },
                    actors: {} };
      for (const id of Object.keys(figs)) {
        const f = figs[id];
        const p = f.root.position;
        const foot = toScreen(_foot.copy(p), b);
        const crown = toScreen(_crown.set(p.x, p.y + f.worldH, p.z), b);
        // the soles, read off the SKELETON rather than off the placement that
        // was supposed to put them there
        let low = Infinity;
        for (const n of Object.keys(f.bones)) {
          const y = f.bones[n].getWorldPosition(new THREE.Vector3()).y;
          if (y < low) low = y;
        }
        out.actors[id] = {
          x: +p.x.toFixed(3), y: +p.y.toFixed(3), z: +p.z.toFixed(3),
          tall: +f.worldH.toFixed(3), lowestBone: +low.toFixed(3),
          inScene: f.root.parent === scene,
          // LOADED IS NOT THE SAME AS IN THIS FIGHT (Build 123). Five creatures
          // have models and one of them is on the board; the other four are
          // standing at the origin with nothing to be, waiting for a fight that
          // calls for them. A check that asks "is anybody behind the camera"
          // has to mean the ones that are actually here.
          visible: f.root.visible,
          // so a check can find the element the way `nodeOf` finds it, rather
          // than keeping its own list of who is a monster
          foe: !!CAST[id].foe,
          screen: { x: +foot.x.toFixed(1), ground: +foot.y.toFixed(1),
                    h: +(foot.y - crown.y).toFixed(1), behind: foot.behind },
        };
      }
      return out;
    },
    // test-only: the pieces a performance probe needs to turn things off one
    // at a time. Which of the floor, its transparency and the shadow pass
    // costs what is a measurement, not a guess.
    _parts: () => ({ ground, renderer, scene, cam, figs }),
    // test-only: the whole pose at once, as quaternions.
    //
    // EULER ANGLES WRAP AND QUATERNIONS DO NOT. `_boneAngle` decomposes to
    // XYZ, and a joint that crosses +-180 degrees between two samples reports
    // a 359-degree swing — which is how the Regent's idle came out as the most
    // energetic motion in the cast while being perfectly calm. A rotation's
    // real size is the angle between two quaternions, and it is never larger
    // than 180 by construction.
    //
    // It also returns everything in one call: twenty-four round trips per
    // sampled frame, four times over, was most of what made the suite slow.
    // test-only: what every clip is actually doing — the rate it plays at, and
    // whether it is a loop. Two builds shipped with a sword swing at 3.05x and
    // an idle snapping 7 degrees once a cycle, and no check could see either,
    // because nothing exposed the number that would have said so.
    _pace: (heroId) => {
      const f = figs[heroId || Object.keys(figs)[0]]; if (!f) return null;
      const out = {};
      for (const n of Object.keys(f.actions)) {
        const a = f.actions[n];
        out[n] = { rate: +a.timeScale.toFixed(3),
                   dur: +a.getClip().duration.toFixed(3),
                   loop: a.loop === THREE.LoopRepeat };
      }
      return out;
    },
    // test-only: how far a clip's last pose is from its first, in degrees. A
    // loop that does not close snaps once a cycle, which is what windowing the
    // idle did to it — and the only way to see it is to measure the seam.
    _seam: (heroId, clipName) => {
      const f = figs[heroId || Object.keys(figs)[0]]; if (!f) return null;
      const a = f.actions[clipName]; if (!a) return null;
      const clip = a.getClip();
      let worst = 0;
      for (const tr of clip.tracks) {
        if (!/\.quaternion$/.test(tr.name)) continue;
        const v = tr.values, last = tr.times.length - 1;
        let dot = 0;
        for (let k = 0; k < 4; k++) dot += v[k] * v[last * 4 + k];
        const deg = 2 * Math.acos(Math.min(1, Math.abs(dot))) / D;
        if (deg > worst) worst = deg;
      }
      return +worst.toFixed(2);
    },
    _bonePose: (heroId) => {
      const f = figs[heroId]; if (!f) return null;
      const out = {};
      for (const n of Object.keys(f.bones)) out[n] = f.bones[n].quaternion.toArray();
      return out;
    },
    _boneAngle: (heroId, bone) => {
      const f = figs[heroId]; if (!f || !f.bones[bone]) return null;
      const e = new THREE.Euler().setFromQuaternion(f.bones[bone].quaternion);
      return [+(e.x / D).toFixed(2), +(e.y / D).toFixed(2), +(e.z / D).toFixed(2)];
    },
    // test-only: which library clip a verb resolves to for this person
    _verbClip: (heroId, verb) => (VERB[verb] ? VERB[verb](heroId) : null),
    // test-only: which way each chest ACTUALLY points, measured off the live
    // skeleton — not the number in the table that was supposed to cause it.
    // Two builds shipped a party fighting backwards because the dial was read
    // instead of the body.
    _facing: () => Object.fromEntries(Object.keys(figs).map(id => {
      const f = figs[id];
      const g = (n) => (f.bones[n] ? f.bones[n].getWorldPosition(new THREE.Vector3()) : null);
      const L = g('LeftShoulder') || g('LeftUpLeg'), R = g('RightShoulder') || g('RightUpLeg');
      if (!L || !R) return [id, null];
      const lateral = new THREE.Vector3().subVectors(R, L);
      const fwd = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), lateral).normalize();
      return [id, { x: +fwd.x.toFixed(3), z: +fwd.z.toFixed(3),
                    deg: +(Math.atan2(fwd.x, fwd.z) / D).toFixed(1) }];
    })),
    // Which way each of them stands. WHICH WAY IS "TOWARD THE ENEMY" DEPENDS
    // ON WHICH WAY THE GENERATOR HAPPENED TO FACE THE MODEL, so the angle is
    // picked by looking at it rather than by reasoning about sign conventions
    // and getting it backwards.
    turn(next) {
      if (!next) return Object.fromEntries(Object.keys(CAST).map(id => [id, CAST[id].turn]));
      for (const id of Object.keys(next)) {
        if (!figs[id]) continue;
        CAST[id].turn = next[id];
        const side = CAST[id].side || 1;
        aim(figs[id], side * FOE_HEADING - side * next[id]);
      }
      return this.turn();
    },
    // ── THE SHOT (Build 120) ─────────────────────────────────────────────────
    //
    // `Cast3D.shot('duel')` or a spec of your own. The fight names a shot the
    // way a director does — the tripod walks there, the handheld offset keeps
    // doing whatever it was doing, and nothing else in the game has to know a
    // camera moved. Called with nothing it reports where the camera is
    // actually standing, which is not always where it was last sent.
    shot(name, opts) {
      if (name == null) return { asked: { ...SHOT }, base: { ...BASE },
                                 holding: holdUntil ? Math.max(0, Math.round(holdUntil - now())) : 0,
                                 at: { ...TRIPOD, atP: TRIPOD.atP.slice() } };
      const base = typeof name === 'string' ? SHOTS[name] : name;
      if (!base) return false;
      const next = Object.assign({}, SHOTS.home, base, opts || {});
      if (opts && opts.for) {
        holdUntil = now() + opts.for;      // a moment: hand the camera back after
      } else {
        Object.assign(BASE, next);          // a stance: this is where it lives
        holdUntil = 0;
      }
      Object.assign(SHOT, next);
      shotSpeed = (opts && opts.speed) || 1.6;
      return true;
    },
    shots: () => Object.keys(SHOTS),
    // EVERYBODY, EVENTUALLY. The layer is ready with the party standing; the
    // bestiary arrives behind it. Anything that wants to talk about the whole
    // cast — the suite, a debug census — waits on this rather than on `ready`.
    warm: () => (warming || Promise.resolve())
      .then(() => Promise.all(Object.keys(fetching).map(k => fetching[k])))
      .then(() => Object.keys(figs)),
    _figure: (id) => figs[id] || null,
    // Tune the look without a reload: Cast3D.look({ bands: 5, wash: 0.4 }).
    // Called with nothing it reports what is currently set.
    look(next) {
      if (!next) return { ...LOOK };
      // THE GROUND'S TWO DIALS ARE NOT UNIFORMS ON ANYBODY. They are the
      // opacity of the shadow catcher and of the painted wash under it, so
      // they are set where they live rather than looked for on four figures
      // that do not have them.
      if (ground) {
        // the floor is real geometry now, so its dials are its own: how dark a
        // contact shadow lands, and how bright the painted stone reads
        if (next.shade != null && scene.userData.key)
          scene.userData.key.intensity = 1.45 * (1 - next.shade) + 0.45;
        if (next.floor != null)
          ground.material.color.setScalar(0.5 + next.floor * 1.6);
      }
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
  for (const c of Object.keys(VERB)) {
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
