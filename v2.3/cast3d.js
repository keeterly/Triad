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
  // THE REGENT FACES THE OTHER WAY, which is the only thing about it that is
  // special: `side` flips which end of the stage it looks at, and everything
  // downstream — the aim, the frame, the clips — is unchanged.
  mourner: { model: 'mourner.glb', sel: '#k-boss-art', foe: true, side: -1,
             paper: 0xf6f3ee, shadow: 0x8d8a97, ink: 0x39353f,
             // FULL PRESENCE. `depth` is the row ladder's air, and the thing
             // the fight is about does not stand behind any of it.
             turn: 30, tall: 1.00, strike: 'sword', depth: 1 },
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
  floor: 0.20,
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

// ── HOW LONG EACH ACTION TAKES ─────────────────────────────────────────────
//
// SECONDS, NOT SPEEDS. The first pass set a playback multiplier per clip and
// they were pure guesses — a number like 2.6 says nothing about whether the
// swing lands with the damage number. These are the durations the fight wants,
// and the layer works the speed out from the clip's own measured motion window,
// so swapping a clip for a longer or shorter one changes nothing here.
//
// A parry is the shortest thing in the game and has to be: it is a reaction
// inside a rhythm window. A knock-down is the longest, because it is the last
// thing that hero does.
const BEAT = {
  idle: 2.4,        // a loop, calm — the party is waiting, not jogging on the spot
  sword: 1.00, daggers: 0.95, staff: 0.90,
  cast: 1.10, heal: 1.05, ward: 0.85,
  parry: 0.42, hurt: 0.50, down: 1.40,
};

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
  constructor(root, tone, clips, restSrc, parentOf, windows) {
    this.root = root;
    this.tone = tone;
    // THE BONES AND THEIR REST POSE FIRST — the retarget needs them, and after
    // the mixer runs once `quaternion` is a pose, not a rest.
    this.bones = {};
    root.traverse(o => { if (o.isBone) this.bones[o.name] = o; });
    this.mixer = new THREE.AnimationMixer(root);
    this.actions = {};
    for (const name of Object.keys(clips)) {
      const rt = retarget(clips[name], restSrc, parentOf, this.bones, windows[name]);
      const a = this.mixer.clipAction(rt);
      a.setEffectiveWeight(0);
      // SPEED IS DERIVED, not chosen: the clip is as long as its motion window
      // and has to finish inside the beat the fight gives it.
      a.timeScale = BEAT[name] ? (rt.duration / BEAT[name]) : 1;
      if (HOLDS[name]) { a.loop = THREE.LoopOnce; a.clampWhenFinished = true; }
      else if (name !== 'idle') a.loop = THREE.LoopOnce;
      this.actions[name] = a;
    }
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
    // the idle keeps running underneath at a whisper, so a held pose still
    // breathes rather than freezing solid
    if (this.idle) this.idle.setEffectiveWeight(HOLDS[name] ? 0 : 0.25);
    this.acting = a;
    this.clipName = name;
    return true;
  }

  clear() {
    if (this.acting) this.acting.fadeOut(0.22);
    if (this.idle) this.idle.setEffectiveWeight(IDLE_WEIGHT);
    this.acting = null;
    this.clipName = null;
  }

  step(dt) {
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
  let ground = null;
  const sized = { w: 0, h: 0, dpr: 0 };
  const figs = {};
  let last = 0, raf = 0, pending = null, clipNames = [], missing = [];

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
  const STAGE = {
    hero: { front: [0.00, 0.54], mid: [-1.23, -0.03], back: [-2.76, -1.06] },
    foe:  { front: [2.10, 0.60], mid: [3.30, -0.10], back: [4.45, -0.95] },
    solo: [2.55, 1.15],
  };
  // metres, crown to sole. A generated model comes back whatever height the
  // generator felt like — see `fit` — so each figure is scaled to stand at the
  // height the fight needs rather than the height it happened to arrive at.
  const TALL_M = { hero: 1.78, foe: 2.16 };
  // how much of a hero's box the figure fills, top to bottom. The rest is the
  // air a swing needs — a sword raised overhead leaves the frame at 1.0.
  const FILL = 0.72;
  // px per metre at the plane the party stands on: the conversion between the
  // camera language game.js already speaks (pixels) and the world (metres).
  const PX_M = VIEW.focal / EYE.z;

  // ── THE FLOOR IS PAINTED, NOT PHOTOGRAPHED ─────────────────────────────────
  //
  // A photographic stone tile under watercolour figures reads as a photograph
  // with cartoons standing on it — the exact failure the whole look exists to
  // avoid. So the ground is painted the way the cast is painted: a warm paper
  // wash, pigment pooling where a real wash pools, joints drawn as wobbling
  // brush strokes rather than ruled lines, and the paper grain over all of it.
  //
  // It is generated, not downloaded. 512 square in a canvas costs nothing to
  // ship and nothing to load, and the thing that actually sells the floor is
  // not its texture anyway — it is the four figures casting real shadows onto
  // it, which no painted plate has ever been able to fake.
  function groundTexture() {
    const S = 512;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const x = c.getContext('2d');
    x.fillStyle = '#c6b8a2';
    x.fillRect(0, 0, S, S);
    // PIGMENT POOLS. Drawn four times, wrapped, or every blotch would stop
    // dead at the tile edge and the repeat would read as a grid of stamps.
    for (let i = 0; i < 110; i++) {
      const cx = Math.random() * S, cy = Math.random() * S;
      const r = 16 + Math.random() * 78;
      const dark = Math.random() < 0.55;
      for (const [ox, oy] of [[0, 0], [S, 0], [0, S], [-S, 0], [0, -S]]) {
        const g = x.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, r);
        g.addColorStop(0, dark ? 'rgba(112,95,78,0.15)' : 'rgba(242,235,219,0.17)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = g;
        x.beginPath(); x.arc(cx + ox, cy + oy, r, 0, 7); x.fill();
      }
    }
    // THE JOINTS WOBBLE. A flagstone edge drawn with a ruler is the single
    // fastest way to lose the painted look. They also stop short of the tile
    // border: a wobbling line cannot meet its own other end across a seam, so
    // the seam simply carries no line and the wash hides where it falls.
    x.lineCap = 'round';
    const stroke = (x0, y0, x1, y1, w, a) => {
      x.strokeStyle = 'rgba(78,64,52,' + a + ')';
      x.lineWidth = w;
      x.beginPath(); x.moveTo(x0, y0);
      for (let s = 1; s <= 8; s++) {
        const t = s / 8;
        x.lineTo(x0 + (x1 - x0) * t + (Math.random() - 0.5) * 4.2,
                 y0 + (y1 - y0) * t + (Math.random() - 0.5) * 4.2);
      }
      x.stroke();
    };
    const N = 4, cell = S / N, pad = 10;
    for (let i = 1; i < N; i++) {
      stroke(i * cell, pad, i * cell, S - pad, 1.3 + Math.random(), 0.26 + Math.random() * 0.16);
      stroke(pad, i * cell, S - pad, i * cell, 1.3 + Math.random(), 0.26 + Math.random() * 0.16);
    }
    // the same paper grain the figures wear, so floor and cast share a surface
    const img = x.getImageData(0, 0, S, S), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * 24;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    x.putImageData(img, 0, 0);
    return c;
  }

  // The floor must not END. A plane that stops has an edge, and an edge in the
  // middle of a painted plaza is worse than no floor at all, so it dissolves
  // into the backdrop instead of meeting it.
  function groundFade() {
    const S = 256;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const x = c.getContext('2d');
    // TIGHT, AND GONE LONG BEFORE THE EDGE. The wash is here to seat four
    // figures on the plate, not to lay a veil over a painting that is already
    // finished — measured across the frame, the first pass was obscuring a
    // fifth of the plaza, which is a filter rather than a floor.
    const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.30, '#ffffff');
    g.addColorStop(0.78, '#2a2a2a');
    g.addColorStop(1, '#000000');
    x.fillStyle = g;
    x.fillRect(0, 0, S, S);
    return c;
  }

  function build() {
    const host = document.getElementById('k-cast');
    if (!host) return false;
    canvas = document.createElement('canvas');
    canvas.id = 'k-cast3d';
    // it sits UNDER the DOM heroes, which keep the rows, drags and popups
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;'
      + 'pointer-events:none;z-index:1;';
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

    // ── THE FLOOR THAT IS ALREADY THERE ──────────────────────────────────────
    //
    // The first version of this laid a big lit plane across the whole lower
    // half of the frame, and it was a plain mistake: `bg23-plaza.webp` is a
    // PAINTING OF A PLAZA, floor included, in the right perspective, and
    // covering it with procedural stone traded good art for a pale slab and
    // took the painted look down with it.
    //
    // What a painting cannot do is know where anybody is standing. So the
    // ground here is not scenery — it is THE SURFACE THE FIGURES TOUCH — and it
    // is two planes doing one job each:
    //
    //   THE CATCHER carries nothing but shadow. `ShadowMaterial` is fully
    //   transparent everywhere light reaches and darkens only where a figure
    //   blocks it, so what lands on the painted plaza is four real contact
    //   shadows and not one pixel besides. This is the whole return on the
    //   floor being real: the shadows move when the figures move, stretch when
    //   somebody lunges, and fall across each other.
    //
    //   THE WASH is a whisper of painted ground under the party — the pooled
    //   pigment and paper tooth the cast itself is painted with — pulling the
    //   figures down onto the plate rather than letting them hover in front of
    //   it. It fades out well inside its own edges, because a floor with a
    //   visible edge in the middle of a plaza is worse than no floor at all.
    //
    // Build 120 replaces the plate with geometry, because a billboard cannot be
    // orbited. Until then the painting beats anything that would replace it,
    // and this stays out of its way.
    const fade = new THREE.CanvasTexture(groundFade());
    const tex = new THREE.CanvasTexture(groundTexture());
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const wash = new THREE.Mesh(
      new THREE.PlaneGeometry(17, 17),
      new THREE.MeshBasicMaterial({ map: tex, alphaMap: fade, transparent: true,
                                    opacity: LOOK.floor, depthWrite: false }));
    wash.rotation.x = -Math.PI / 2;
    wash.position.set(0.8, 0.002, 0.4);
    wash.renderOrder = -1;
    scene.add(wash);

    ground = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.ShadowMaterial({ opacity: LOOK.shade, transparent: true }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0.8, 0.004, 0.4);
    ground.receiveShadow = true;
    ground.userData.wash = wash;
    scene.add(ground);

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
    renderer.setScissorTest(false);
    // THE FLOOR IS NOT PART OF ANYBODY'S SILHOUETTE. This reads the alpha
    // channel to find where a figure begins and ends, and a ground plane
    // spanning the frame fills every pixel of it — leave it in and every
    // figure measures as exactly one screen tall.
    const groundWas = ground && ground.visible;
    if (ground) { ground.visible = false; ground.userData.wash.visible = false; }

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
    renderer.setScissorTest(scissorWas);
    if (ground) { ground.visible = groundWas; ground.userData.wash.visible = groundWas; }
    for (const id of Object.keys(figs)) figs[id].root.visible = wasVisible[id];
    target.dispose();
  }

  // THE CLIP LIBRARY IS SHARED, THE MODELS ARE NOT. Meshy's humanoid rig is
  // standardised — all three characters came back with the same 24 joints, in
  // the same order, under the same names — so one library of clips authored
  // against one of them drives all three. An AnimationClip addresses its
  // tracks by node name, which means retargeting here is not a step at all; it
  // is simply what happens.
  async function load() {
    const loader = new GLTFLoader();
    // ONE MISSING MODEL IS NOT A DEAD LAYER. A foe that has not been generated
    // yet should leave its painted plate alone and let the rest of the cast
    // stand up, rather than taking the whole stage down with it.
    const ids = Object.keys(CAST);
    const [lib, ...models] = await Promise.all([
      fetch(CLIPS_URL).then(r => {
        if (!r.ok) throw new Error('clips ' + r.status);
        return r.json();
      }),
      ...ids.map(id => loader.loadAsync(ART + CAST[id].model).catch(() => null)),
    ]);
    const restSrc = lib.__rest || {};
    const parentOf = lib.__parent || {};
    const clips = {}, windows = {};
    for (const name of Object.keys(lib)) {
      if (name === '__rest' || name === '__parent') continue;
      clips[name] = THREE.AnimationClip.parse(lib[name]);
      if (lib[name].window) windows[name] = lib[name].window;
    }
    clipNames = Object.keys(clips);

    ids.forEach((id, i) => {
      const tone = CAST[id];
      if (!models[i]) { missing.push(id); return; }
      const root = models[i].scene;
      let map = null;
      root.traverse(o => {
        if (o.isMesh || o.isSkinnedMesh) map = map || o.material.map || o.material.emissiveMap;
      });
      const mat = watercolour(map, tone);
      root.traverse(o => {
        if (o.isMesh || o.isSkinnedMesh) { o.material = mat; o.frustumCulled = false; o.castShadow = true; }
      });
      // aimed once the idle has posed them — see `aim` below
      root.scale.setScalar(tone.tall);
      root.userData.mat = mat;
      scene.add(root);
      figs[id] = new Figure(root, tone, clips, restSrc, parentOf, windows);
    });
    // one frame of the idle, so the measurement sees a standing figure rather
    // than whatever the bind pose happens to be
    for (const id of Object.keys(figs)) figs[id].step(0.016);
    // aim BEFORE framing: turning a figure changes its silhouette, and the
    // frame is measured from the silhouette
    for (const id of Object.keys(figs)) {
      const side = CAST[id].side || 1;
      aim(figs[id], side * FOE_HEADING - side * CAST[id].turn);
    }
    for (const id of Object.keys(figs)) fit(figs[id]);
    // ── AND NOW PUT THEM ON THE GROUND ───────────────────────────────────────
    //
    // `fit` measured each silhouette by looking at it, which is the only thing
    // that has ever worked here — Box3 reports a SkinnedMesh's authored box and
    // bone-to-bone needs a fudge for the sole under the toe and the hood over
    // the crown, different for every character. Its output was a camera frame
    // when there was a camera per figure; it is the same measurement either
    // way, so it is simply read differently now: a figure that fills FILL of a
    // frame `viewH` tall is `viewH * FILL` metres tall, and its soles are half
    // that below the silhouette's centre.
    //
    // WHICH MAKES HEIGHT A DECISION RATHER THAN AN ACCIDENT. Meshy is asked for
    // a height in metres and obliges approximately; three heroes generated on
    // three different days do not agree to the centimetre, and the Regent has
    // no reason to be the same size as the people fighting it. So each figure
    // is scaled to the height the FIGHT wants — the party level with each
    // other, the Regent looming over them — and then dropped until its feet
    // touch y=0. Nobody floats and nobody sinks, because neither is a number
    // anyone chose.
    for (const id of Object.keys(figs)) {
      const f = figs[id];
      const h0 = f.viewH * FILL;                       // metres, as generated
      const s = TALL_M[CAST[id].foe ? 'foe' : 'hero'] / h0;
      f.root.scale.multiplyScalar(s);
      f.worldH = h0 * s;
      f.ctrOff = f.midX * s;                           // it is not centred either
      f.root.position.y = -(f.midY - h0 / 2) * s;      // soles to the floor
      const slot = slotOf(id) || STAGE.hero.front;
      f.root.position.x = slot[0] - f.ctrOff;
      f.root.position.z = slot[1];
      f.root.updateWorldMatrix(true, true);
    }
    ready = true;
  }

  // ── WHICH SLOT IS THIS BODY STANDING IN? ───────────────────────────────────
  // game.js stays the authority on WHO IS WHERE IN GAME TERMS — it has set the
  // row class and `data-row` since Build 101 and nothing here second-guesses
  // it. What the world owns is what that means in metres. The two never
  // disagree because only one of them has an opinion.
  function slotOf(id) {
    const node = document.querySelector(CAST[id].sel);
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
  const _w = new THREE.Vector3(), _foot = new THREE.Vector3(), _crown = new THREE.Vector3();
  function toScreen(world, b) {
    _w.copy(world).applyMatrix4(cam.matrixWorldInverse);
    const behind = _w.z > -0.05;
    _w.applyMatrix4(cam.projectionMatrix);
    return { x: (_w.x * 0.5 + 0.5) * b.width, y: (-_w.y * 0.5 + 0.5) * b.height, behind };
  }

  function follow(id, f, b) {
    const node = document.querySelector(CAST[id].sel);
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
  function rig(host, dt) {
    const cs = getComputedStyle(host);
    const n = (k) => { const v = parseFloat(cs.getPropertyValue(k)); return isNaN(v) ? 0 : v; };
    WANT.x = n('--cam-x'); WANT.y = n('--cam-y'); WANT.dz = n('--cam-dz');
    WANT.r = n('--cam-r'); WANT.yaw = n('--cam-yaw'); WANT.pitch = n('--cam-pitch');
    const k = Math.min(1, dt * 7.5);
    for (const key of Object.keys(RIG)) RIG[key] += (WANT[key] - RIG[key]) * k;
    // pixels are what game.js speaks; metres are what the world is in
    const m = 1 / PX_M;
    cam.position.set(EYE.x - RIG.x * m, EYE.y + RIG.y * m, EYE.z - RIG.dz * m);
    cam.rotation.set(-RIG.pitch * D, -RIG.yaw * D, RIG.r * D);
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
    const dpr = Math.min(TEST ? 1 : 2, window.devicePixelRatio || 1);
    if (b.width !== sized.w || b.height !== sized.h || dpr !== sized.dpr) {
      sized.w = b.width; sized.h = b.height; sized.dpr = dpr;
      renderer.setPixelRatio(dpr);
      renderer.setSize(b.width, b.height, false);
    }

    rig(host, dt);

    for (const id of Object.keys(figs)) {
      const f = figs[id];
      f.step(dt);
      const node = document.querySelector(CAST[id].sel);
      const vis = !!node && node.offsetParent !== null;
      f.root.visible = vis;
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

    // ONE SCENE, ONE CAMERA, ONE PASS. Four scissored renders and four
    // orthographic frames are what it took to fake a shared space; a shared
    // space needs none of them.
    renderer.render(scene, cam);

    for (const id of Object.keys(figs)) follow(id, figs[id], b);

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
    // the CSS hides every 2D plate under `.k-cast3d`; anything that failed to
    // load gets its painting back rather than standing there invisible
    for (const id of missing) {
      const el = document.querySelector(CAST[id].sel);
      if (el) el.classList.add('k-cast3d-off');
    }
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
      const b = host ? host.getBoundingClientRect() : { width: VIEW.w, height: VIEW.h };
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
        if (next.shade != null) ground.material.opacity = next.shade;
        if (next.floor != null) ground.userData.wash.material.opacity = next.floor;
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
