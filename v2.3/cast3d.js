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
// A SKINNED MESH CANNOT BE CLONED WITH `.clone()`. The copy comes back sharing
// the ORIGINAL's skeleton, so two Hollow Husks would be one puppet in two
// places — both playing whatever the last one was told to. SkeletonUtils
// rebuilds the bone hierarchy and rebinds, which is the only way two of the
// same creature can stand on a board and act independently.
import { clone as cloneSkinned } from './lib/SkeletonUtils.js';

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
  // `verb` is which of the fight's four words this person throws when nothing
  // in particular is being asked of them — an all-out, say. Ash and Mira answer
  // with the weapon in their hands and do not need to say so; Elin is the one
  // who casts, and a finisher where the party's mage swings her staff like a
  // club is a finisher that has forgotten who she is.
  elin: { model: 'elin.glb', sel: '.k-hero[data-hero="elin"]',
          paper: 0xf2f4f7, shadow: 0x8d9ab4, ink: 0x343b4a,
          turn: 34, tall: 0.97, strike: 'staff', verb: 'cast' },
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
// …AND THE LIBRARY RIDES THIS FILE'S OWN CACHE BUSTER. The clips are DATA that
// changes with a build — Build 137 replaced the parry with five of them — and
// `clips.json` had no version on it, so a returning player would have got the
// new code reading the old library out of their cache. `import.meta.url`
// already carries the `?v=` the page put on the script tag; borrowing it means
// there is no second number to remember to bump.
const CLIPS_URL = ART + 'clips.json' + (import.meta.url.match(/[?&]v=[^&]*/) || [''])[0].replace('&', '?');

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
  // THE LADDER SEPARATES RANKS; IT DOES NOT FOG THEM. At 0.78 the back rank
  // reached air 0.53 — 22% of its colour gone to grey and a tenth of it mixed
  // into the paper — so Mira read as weather and Elin as half-weather while
  // Ash, one rank forward, read as a person. The three ranks are still three
  // distances; the distance is just no longer the loudest thing about them.
  air:   0.42,  // how hard the row ladder washes out the back ranks
  // HOW BRIGHT THE BLADE ARC BURNS. This is the one thing about the trail that
  // a headless render cannot settle: the suite's browser draws at about two
  // frames a second, so by the time a screenshot lands the arc has faded to a
  // per cent of itself, and every judgement about "is it hot enough" has to be
  // made on a pinned frame that no player ever sees. So it is a dial rather
  // than a constant — turn it on the tuning panel against a real fight at a
  // real frame rate, which is the only place the answer lives.
  arc:   1.0,
  // THE GROUND (Build 119). The floor is not scenery — the plaza is already
  // painted — so it has exactly two settings: how dark a real contact shadow
  // lands on that painting, and how much painted ground shows under the party.
  shade: 0.46,
  floor: 0.34,
  // …and a third, Build 122: THE PLAZA IS FLOODED. Half the painting below the
  // horizon is a reflection, so this is not a polish setting — it is most of
  // what makes the ground read as that ground.
  wet: 0.70,
  // ── AND THE WHOLE FRAME IS DRAWN, NOT RENDERED (Build 140) ───────────────
  //
  // Everything above this line is per-object: a wash on a body, a shadow on the
  // floor. What makes a picture read as DRAWN rather than as 3D with a filter
  // on it is the one thing no per-object shader can do — a line where two
  // things meet. A contour belongs to the pair of surfaces either side of it,
  // so it can only be found once the whole frame exists and its depth is
  // known.
  //
  // `ink` is that line, taken off a depth edge. `flat` is the tone stepped into
  // bands across the whole picture rather than per body, so a hero and the
  // paving behind them land on the same ladder. `paper` is the tooth, over
  // everything, which is what stops the flat areas reading as vector art.
  // NOT `ink` AND NOT `paper`, however well those read. The watercolour shader
  // already has `uniform vec3 uPaper, uShadow, uInk` — they are its pigment
  // COLOURS — and `look()` turns a dial name straight into a uniform name, so
  // a dial called `ink` hands a float to a vec3 and every figure's material
  // throws on the next frame. Measured: 316 page errors from one `look` call.
  // ── THE DRAWN LOOK, AND WHY IT IS OFF ────────────────────────────────────
  //
  // What Arcane does is not a filter over a render, it is a painting that
  // happens to be lit in three dimensions: flat tone in bands, a drawn contour
  // where forms meet, and tooth over the sheet so nothing reads as vector art.
  // The contour works — measured, it inks 2.4% of the picture, 6.5% of the
  // party's own boxes and 1.5% of the square behind them, which is a drawn line
  // and not a wash. `?look=line:0.72,flat:0.34,tooth:0.05` turns it on.
  //
  // IT DOES NOT SHIP UNTIL THE ROUND TRIP IS FREE, and it is not. Routing the
  // frame through a render target and straight back — the pass running with
  // nothing whatever to do — moves the mean luminance of the drawing buffer
  // from 0.274 to 0.150 and pushes 52% of the frame into the darkest eighth of
  // the range against 5%. Build 140 shipped that as the default and the game
  // went dark. Whatever else the shader does is that, plus.
  //
  // FOUR ACCOUNTS OF THE MISSING CONVERSION, ALL WRONG, measured as the mean
  // against the same frame rendered straight to the canvas:
  //
  //     nothing at all                      -0.124
  //     the exact sRGB transfer, by hand    +0.126
  //     `colorspace_fragment`, three's own  +0.122
  //     pow(1/2.2)  +0.124      pow(2.2)  -0.249
  //     pow(1/1.5)  -0.005  ..which fits, and means nothing
  //
  // Things ruled out on the way: it is not the target's colorSpace (three
  // forces LinearSRGB for any render target and ignores what the texture says,
  // which is why setting it changed nothing in either direction); not tone
  // mapping (none is configured); not the missing MSAA (samples: 4 moved it by
  // 0.0003); not premultiplied alpha (the buffer reads alpha 1.0 everywhere).
  //
  // An exponent of 1.5 fitted to one browser is not an answer, it is a number
  // that will be wrong somewhere else. So the dials sit at zero, where the
  // target is never allocated and the render path is byte-for-byte the one
  // that shipped before any of this existed, and the pass waits for the round
  // trip to be understood rather than fitted.
  // ── A THIN LINE, AND NOTHING ELSE ────────────────────────────────────────
  //
  // What makes a 3D figure read as its own 2D art is the SILHOUETTE, drawn.
  // Not a posterised tone ladder and not paper grain — both were tried on top
  // and both fight the painting the model already carries.
  //
  // The threshold is the whole difference between an outline and a mess. At
  // 0.03 the detector catches every fold in a cloak and the figure arrives
  // stippled; at 0.16 it keeps the silhouette and the few folds deep enough to
  // read as drawing. Measured, as the share of each region it inks:
  //
  //     bite    frame   bodies   plaza
  //     0.03     2.84     7.12    1.17    ..stipple
  //     0.06     2.27     6.14    0.76
  //     0.10     2.00     5.65    0.74
  //     0.16     1.63     4.71    0.74    ..outline
  //     0.24     1.31     3.81    0.73    ..breaking up
  line:  0.9,    // how black the contour is
  linew: 0.9,    // how wide, in pixels of the drawing buffer — thin on purpose
  bite:  0.16,   // how far a surface must jump, as a fraction of its distance
  reach: 14.0,   // …and how far out the ink carries, in metres
  flat:  0.0,    // the band ladder stays off; it flattened the art it sat on
  steps: 6,
  tooth: 0.0,    // and so does the paper, which read as noise at this size
};
// what each dial does, for the panel — and so the next person to open this
// file does not have to read the shader to find out
const LOOK_HELP = {
  line:  ['ink line', 0, 1, 0.01, 'the contour drawn where two surfaces meet'],
  linew: ['line width', 0.5, 3, 0.05, 'how wide that contour is, in buffer pixels'],
  bite:  ['line bite', 0.01, 0.4, 0.005, 'how big a depth jump earns a line, as a fraction of its distance'],
  reach: ['line reach', 2, 30, 0.5, 'how far out the ink carries, in metres — past this the plaza stays paint'],
  flat:  ['flatten', 0, 1, 0.01, 'tone stepped into bands across the whole frame'],
  steps: ['bands', 2, 10, 1, 'how many of them'],
  tooth: ['paper', 0, 0.4, 0.01, 'the grain of the sheet, over everything'],
  paint: ['watercolour', 0, 1, 0.01, 'how much of the wash is applied at all'],
  bands: ['washes', 2, 8, 1, 'how many flat tones the brush lays down'],
  wash:  ['flatten', 0, 1, 0.01, 'how much of the real painting the wash eats'],
  lift:  ['paper', 0, 0.8, 0.01, 'how far the blacks lift toward paper'],
  edge:  ['pooling', 0, 1.4, 0.01, 'pigment gathering at the silhouette'],
  grain: ['tooth', 0, 0.5, 0.01, 'the paper grain, in screen space'],
  air:   ['distance', 0, 1.6, 0.01, 'how hard the back ranks wash out'],
  arc:   ['blade', 0, 3, 0.05, 'how hot the sword trail burns'],
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
// WHICH SWING, WITHIN A WEAPON.
//
// A slash is not one motion either. The fight already writes down what a card
// DOES — Twin Fang deals damage twice, Cross Sever breaks — so the swing can be
// read off that rather than being told separately, and `slash` stays one verb.
//
// IT IS A SUFFIX ON THE PERSON'S OWN STRIKE, not a clip name: `sword` becomes
// `swordHeavy`, `daggers` becomes `daggersCombo`. That keeps the weapon split
// and the card split independent, so a new weapon costs no card work and a new
// card costs no weapon work.
//
// AND IT STAYS THE VERB `slash`. Adding `slashHeavy` as a word of its own was
// the obvious shape and the wrong one: FX_VERB and READY_AT are both keyed by
// the verb, so a heavy blow would have swung in silence with no ribbon behind
// it. Only the CLIP changes; everything downstream still hears `slash`.
const SLASH_FLAVOUR = { heavy: 'Heavy', combo: 'Combo' };

const VERB = {
  // …and it is handed the FIGURE's own tone rather than a name to look up,
  // because a foe slot is called `foe1` and there is no such creature.
  slash: (tone, flavour) => tone.strike + (SLASH_FLAVOUR[flavour] || ''),
  cast:  () => 'cast',
  heal:  () => 'heal',
  ward:  () => 'ward',
  // …AND A PARRY ANSWERS THE ARROW. A note carries a direction — `CLAW <-` —
  // and until Build 137 the defender played the same clip whichever way the
  // blow came from, because there was only ever one and it barely moved. There
  // are five now: four guards and a centre-line shove for a note with no
  // arrow. Which arrow gets which guard is settled by PARRY_DIR, and that was
  // measured on screen rather than reasoned about.
  parry: (tone, dir) => 'parry' + (PARRY_DIR[dir] || ''),
  hurt:  () => 'hurt',
  down:  () => 'down',
  idle:  () => 'idle',
};

// …AND A FLAVOUR IS OPTIONAL, which is the whole reason this is a function and
// not a table lookup at the call site. Elin carries a staff and every foe
// carries one swing each; none of them have a `Heavy` or a `Combo`. A clip name
// that resolves to nothing does not fall back on its own — `f.play` refuses it
// and the figure stands there — so a body without the flavoured swing is given
// its ordinary one rather than nothing at all.
function clipFor(f, verb, dir) {
  const pick = VERB[verb];
  if (!pick) return verb;
  const name = pick(f.tone, dir);
  if (verb === 'slash' && f.actions && !f.actions[name]) return f.tone.strike;
  return name;
}

// WHICH GUARD ANSWERS WHICH ARROW.
//
// A note's arrow is what the THUMB does: `CLAW <-` asks for a swipe to the
// left. The guard that reads as answering it is the one whose hands travel the
// same way ACROSS THE SCREEN, because a thumb and an arm going the same way is
// the whole coupling — anything else and the hand is fighting the picture.
//
// That is a camera question, not an anatomy one, and it was measured rather
// than reasoned about: each guard was played on the live board and the point
// between the hands projected through the real lens. `parryR` carries it
// +0.105 in clip space — a hundred pixels to the right of where it started —
// and `parryL` carries it -0.041 the other way. So the names mean what the
// arrows mean, and this table is the identity it should be. It stays here
// because it is the thing that would have to change if the party ever turned
// to face the camera.
const PARRY_DIR = { L: 'L', R: 'R', U: 'U', D: 'D' };

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
  // ── AND HOW MUCH OF IT IS LEFT (Build 128) ────────────────────────────────
  //
  // 0 is a whole body; 1 is nothing. Between them a burn front eats upward
  // through the figure, and the band just ahead of it goes white-hot before it
  // goes. Held on the material rather than passed in, because the figure has
  // to keep animating through the whole thing — a creature that freezes and
  // then fades is a sprite being switched off, and a creature that is still
  // falling as it comes apart is dying.
  m.userData.burn = { value: 0 };
  // …AND HOW TALL THIS BODY IS IN ITS OWN UNITS. Not a constant. The first
  // version divided the fragment's height by 1.85 and called it done, which is
  // a guess about a number no model has ever agreed on: Meshy returns whatever
  // scale it feels like and every figure is rescaled at the root afterwards.
  // Measured, the Regent's local height is about 0.9 — so the burn front ran
  // off the top of her at just past half its travel and the last of the body
  // vanished all at once. `stand` fills this in from the height it just
  // measured, which is the only number in the file that is not a guess.
  m.userData.tall = { value: 1.85 };
  // …AND WHERE ITS FEET ARE IN THOSE UNITS. Also not a constant, and this is
  // the one that made the whole Regent vanish at a quarter of the burn: the
  // first two versions assumed a model's local origin sits at its soles. Some
  // of these are built around the hips, so `transformed.y` runs NEGATIVE
  // through the legs — clamped to zero, which made the entire lower body
  // discard the instant the front left the floor, and the rest went with it.
  //
  // A SkinnedMesh's geometry bounding box is famously the wrong tool for
  // asking how tall a character is in the world (Build 119 learned that the
  // hard way). It is exactly the right tool for asking what range
  // `transformed` covers, because that is literally what it is a box around.
  m.userData.foot = { value: 0 };
  // 1 while the world is at full strength, and while the world is dimmed for a
  // parry this is what says "not you" — the figure the moment is about keeps
  // its own light instead of going down with the plaza.
  m.userData.lit = { value: 1 };
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
    sh.uniforms.uBurn = m.userData.burn;
    sh.uniforms.uTall = m.userData.tall;
    sh.uniforms.uFoot = m.userData.foot;
    sh.uniforms.uLit = m.userData.lit;
    Object.assign(sh.uniforms, m.userData.u);
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', `
        uniform float uBands, uGrain, uEdge, uLift, uDepth, uWash, uAir, uPaint;
        uniform float uBurn;
        uniform float uLit;
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
      // ── THE PAINT GOES ON BEFORE THE ENCODE, NOT AFTER IT ────────────────
      //
      // This spliced in at `dithering_fragment`, which three runs AFTER
      // `colorspace_fragment`. So every line below operated on whatever the
      // output space happened to be — sRGB when drawing to the canvas, and
      // LINEAR when drawing to a render target, because three forces a target
      // to LinearSRGB and the encode chunk becomes a no-op there.
      //
      // That is why the post pass could never be made transparent. It was not
      // a missing conversion on the way out: the scene was SHADED DIFFERENTLY
      // in the two paths, and no single transform reconciles two different
      // treatments. Four candidate encodes were measured and the readings came
      // out symmetric about the truth — the frame too dark by 0.124 with no
      // conversion and too bright by 0.124 with a full one — which is the
      // signature of a difference that is not a gamma at all.
      //
      // Spliced before the encode, the treatment always runs in linear light
      // and exactly one conversion happens at the end: three's, on the canvas;
      // the pass's, when the pass is on. The round trip is then free by
      // construction rather than by a fitted exponent.
      .replace('#include <colorspace_fragment>', `
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
          // …and the three things it does are not equally worth doing. Losing
          // saturation with distance is aerial perspective and it reads as
          // depth. Mixing the body into the PAPER is what reads as haze — it
          // is the same move the fog makes, done twice — so it is now the
          // smallest of the three rather than the equal of them.
          float g = dot(c, vec3(0.299, 0.587, 0.114));
          float air = (1.0 - uDepth) * uAir;
          c = mix(c, vec3(g), air * 0.34);
          c *= 1.0 - air * 0.12;
          c = mix(c, uPaper * 0.92, air * 0.10);
          // …and if the world has been taken down for a moment that is not
          // about this body, take this body down with it. The lights do the
          // scene; this does the figures, because a dimmed key still leaves a
          // hero readable and the point is that only one of them should be.
          c *= uLit;
          gl_FragColor.rgb = c;

          // ── THE BURN ────────────────────────────────────────────────────
          //
          // A creature does not fade out. It comes APART: a ragged front eats
          // up through the body, the strip immediately ahead of it glows, and
          // what is behind it is simply gone.
          //
          // The front is a HEIGHT plus noise, not a plain alpha ramp. A ramp
          // dissolves a figure like a cross-fade — every part of it going at
          // once, which reads as a texture problem rather than as a death.
          // Threshold a noise field against a rising line and the body tears
          // instead: thin extremities go first, the mass of the torso holds
          // on, and the edge is different every time because the noise is
          // sampled in the model's own space.
          //
          // vBurnY is the fragment's height up the figure in its OWN units, so
          // this works the same on a 1.86m husk and a 2.30m Regent without
          // either of them being measured.
          if ( uBurn > 0.0001 ) {
            float grain = wcTooth( vBurnP.xz * 6.5 + vBurnP.y * 3.1 ) * 0.62
                        + wcTooth( vBurnP.xy * 17.0 ) * 0.38;
            // the front climbs a little past the top, so the last of the crown
            // is gone by the time uBurn reaches 1
            // FAR ENOUGH PAST THE TOP THAT THE NOISE CANNOT SAVE ANYTHING.
            // At 1.34 the front only just cleared the crown, and the tear
            // noise subtracts up to 0.15 — so a handful of fragments at the
            // very top survived a finished burn. Measured: 73 pixels of Regent
            // still standing at uBurn 1.0. The runtime hides the body a moment
            // later anyway, which is exactly how a thing like this ships.
            float front = uBurn * 1.52 - 0.20;
            float edge = ( front - vBurnY ) + ( grain - 0.5 ) * 0.30;
            if ( edge > 0.028 ) discard;                 // behind the front: gone
            // …and the last band before it goes is the hottest thing on screen
            float glow = smoothstep( -0.16, 0.028, edge );
            gl_FragColor.rgb = mix( gl_FragColor.rgb,
                                    mix( vec3( 0.85, 0.62, 0.24 ), vec3( 1.0, 0.96, 0.86 ),
                                         smoothstep( 0.35, 1.0, glow ) ),
                                    glow * 0.94 );
            gl_FragColor.rgb += vec3( 1.0, 0.78, 0.42 ) * pow( glow, 3.0 ) * 1.5;
          }
        }`)
      // ── AND THE ENCODE GOES LAST, AFTER THE FOG ──
      //
      // three runs `fog_fragment` AFTER `colorspace_fragment`, so the haze is
      // mixed into sRGB on the canvas and into linear light on a render target,
      // where the encode chunk is a no-op. This plaza is mostly haze, and that
      // alone left the pass 0.040 out after the paint had been moved. Moving
      // the one conversion behind the fog puts every path in the same order:
      // light, paint, haze, encode.
      .replace('#include <fog_fragment>',
               '#include <fog_fragment>\n#include <colorspace_fragment>');
    // the height of this fragment up the body, and where it sits in the model,
    // both in the figure's own space — so the tear is the same shape at any
    // scale and travels with the animation rather than with the world
    sh.vertexShader = sh.vertexShader
      .replace('void main() {',
               'uniform float uTall;\nuniform float uFoot;\n'
               + 'varying float vBurnY;\nvarying vec3 vBurnP;\nvoid main() {')
      .replace('#include <begin_vertex>', `
        #include <begin_vertex>
        vBurnP = transformed;
        vBurnY = clamp( ( transformed.y - uFoot ) / uTall, 0.0, 1.0 );`);
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', 'varying float vBurnY;\nvarying vec3 vBurnP;\nvoid main() {');
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

// ══════════════════════════════════════════════════════════════════════════
// THE LUNGE COMES HOME ON ITS OWN FEET
// ══════════════════════════════════════════════════════════════════════════
//
// Unreal keeps a clip's travel on a `root` bone and lets a capsule carry it;
// the importer folds it into the Hips because that is the only place it can go
// here. So an attack clip really does walk the body across the floor, and
// nothing in this layer ever walked it back — the slot ease simply dragged the
// figure home at dt*5.5 once the swing was over. From 1.45m that is 13cm on
// the first frame at 60Hz: about EIGHT METRES PER SECOND, backwards, under an
// idle, with both feet perfectly still. That is what "characters are sliding
// around a lot" is, and it is not the animation — it is the return.
//
// ── THE INSTRUMENT, WHICH TOOK THREE TRIES ────────────────────────────────
//
// Sliding is a foot moving over ground it is supposed to be holding, so the
// first metric called a foot planted when it sat within 3cm of its own lowest
// point and summed how far it travelled while it did. That is too loose: in a
// fast lunge a foot lifts, swings and lands between two samples with both of
// them low, and the whole STEP is counted as slide — it reported 17.5 m/s on a
// sword swing, which is a foot walking, sampled coarsely.
//
// What a body on its feet actually guarantees is that ONE of them is still. So
// take the slower of the two at every instant: during a real step that is the
// support foot and it reads near zero, and it is only large when both feet are
// crossing the ground at once, which is what gliding is. No plant test, no
// threshold. Except that it called FLIGHT a fault — swordHeavy leaves the
// ground — so a frame counts only while the lower foot is within 12cm of the
// lowest either foot reaches. `test/slide.probe.cjs` is that instrument, and
// it steps the mixer by hand because this browser draws at about 2fps.
//
// ── AND TWO FIXES IT THREW OUT ────────────────────────────────────────────
//
// Cancelling the drift outright, across the whole clip, took sword from 1.45m
// to 0.04m and pushed its foot slide the WRONG WAY — 0.59m up to 1.81m at the
// time, measured with the loose metric. The legs are not passengers: the
// stride is matched to the travel, and removing the travel leaves the feet
// sweeping backwards through the floor with nothing to walk against.
//
// Trimming the window so the walk is never played fails too. Sampling prefixes
// showed most of the travel is in the FIRST 30% — swordHeavy 1.62m of its 2.09
// by then, daggers its whole 1.09 — while contact lands at 14-20%. The travel
// IS the attack. These are charging blows; the actor runs into them.
//
// ── SO: THE APPROACH IS UNTOUCHED, THE FOLLOW-THROUGH PAYS IT BACK ────────
//
// Every centimetre up to the contact frame is exactly as authored, footwork
// and all. Only the tail is asked to bring the body home, on a smoothstep, so
// it eases out of the blow rather than reversing on a frame. Measured, in
// metres of glide inside the clip against metres of snap removed after it:
//
//   clip          drift    glide before -> after    snap removed (at ~8 m/s)
//   sword          1.45      0.59  ->  1.81               1.45
//   swordHeavy     2.09      1.79  ->  3.31               2.09
//   daggers        0.91      0.79  ->  1.54               0.91
//   daggersHeavy   0.89      1.53  ->  2.25               0.89
//   staff          0.50      0.12  ->  0.58               0.50
//   down           1.07      0.34  ->  0.34               1.07
//
// The clip gives up less ground than the snap gave up, in every row, and it
// gives it up slower — sword peaks at 3.14 m/s where the snap was eight — and
// under legs that are moving rather than a standing idle. `down` is free: it
// is airborne for a third of its length, so there was nothing to add.
//
// WHAT THIS DOES NOT FIX, said plainly because the number is there: these
// clips slide on their own, before anything here touches them. swordHeavy
// gives up 1.79m at a 14.35 m/s peak and daggersHeavy 1.53m at 10.59, against
// 0.03-0.07m and under 0.6 m/s for cast, heal, ward, parry and idle. That is
// mocap foot skate in the source and only foot IK will take it out.
//
const MIN_DRIFT = 10;    // rig units, about 10cm — under this nobody sees it
function homeward(clip, hitFrac) {
  const t = clip.tracks.find(x => x.name === 'Hips.position');
  if (!t || t.times.length < 3) return clip;
  const v = t.values, n = t.times.length;
  const t0 = t.times[0], t1 = t.times[n - 1];
  if (!(t1 - t0 > 0)) return clip;
  const dx = v[(n - 1) * 3] - v[0], dz = v[(n - 1) * 3 + 2] - v[2];
  if (Math.hypot(dx, dz) < MIN_DRIFT) return clip;
  // …and it starts at the blow, wherever the blow is. A clip with no contact
  // mark — the knockdown — gets the back third, which is its own settle.
  const f = (hitFrac > 0 && hitFrac < 0.9) ? hitFrac : 0.66;
  const from = t0 + (t1 - t0) * f;
  const run = Math.max(1e-4, t1 - from);
  for (let i = 0; i < n; i++) {
    const u = (t.times[i] - from) / run;
    const w = u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u);
    v[i * 3] -= dx * w;
    v[i * 3 + 2] -= dz * w;
  }
  homed[clip.name] = Math.round(Math.hypot(dx, dz));
  return clip;
}
const homed = {};   // test-only: which clips were brought home, and from how
                    // far — in rig units, the hundredths of a metre the tracks
                    // are written in, so sword's 140 is that 1.45 m

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


// ═══════════════════════════════════════════════════════════════════════════
// THE EFFECTS, WHICH BELONG IN THE WORLD (Build 127)
//
// A hit used to be a `<div>`. `shockRing` appended a CSS circle to the stage
// and animated its width; a swing was a keyframe on the sprite. Both lived on
// the flat DOM layer ABOVE the world, which meant an impact could not be
// occluded by the body it happened to, did not move when the camera did, sat
// at whatever size the screen said rather than the distance, and never once
// touched the water the whole plaza is standing in.
//
// So the effects move into the scene. Same camera, same depth buffer, same
// reflection pass — a spark thrown behind the Regent goes behind the Regent,
// and the flooded floor picks all of it up for free because the mirror pass
// renders the scene and the scene is where these now live.
//
// NOTHING IS FETCHED. Every texture here is drawn on a canvas at load, the way
// the floor has been since Build 122: a soft mote, a hot streak, and a torn
// ink edge for the ribbon. Three small textures beat three downloads, and they
// can be tuned in the file that uses them.
//
// AND THE PALETTE IS THE GAME'S. Bone white at the core, through the gold the
// KIZUNA bar and every combo already use, out to the ash grey the bestiary is
// painted in. No cyan, no magenta — a sword in this world throws embers and
// ink, not neon.
const FX_HOT = new THREE.Color(0xfff4d8);
const FX_GOLD = new THREE.Color(0xd8a33f);
const FX_ASH = new THREE.Color(0x6d635a);

function fxCanvas(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// THE MOMENT OF CONTACT, WHICH IS A CLASH AND NOT A CAMERA ARTEFACT.
//
// The first cut of this drew a star: a soft warm core with four long spikes and
// four short ones at even angles. That is a LENS FLARE — what a bright light
// does to glass — and glass is not in the fiction. It read as something magical
// happening at the point of contact rather than as two hard things meeting, and
// symmetry was most of the reason: nothing about a sword landing is the same in
// every direction.
//
// Steel on steel throws SLIVERS. Uneven lengths, uneven angles, hard ends, and
// gathered into the plane of the blow rather than sprayed evenly around it —
// which is why the angles here are biased into a band and the whole stamp is
// turned to the blow's own direction when it is fired. The core is small, white
// and cold; there is no warm halo, because the halo was doing the lens's job.
function clashTexture() {
  return fxCanvas(128, (x, s) => {
    const c = s / 2;
    // a small hard core — the point where the two things actually touched
    const g = x.createRadialGradient(c, c, 0, c, c, s * 0.085);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.55, 'rgba(238,246,255,0.7)');
    g.addColorStop(1, 'rgba(210,230,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, s, s);
    x.globalCompositeOperation = 'lighter';
    // …and the metal that came off it. A sliver is a triangle with a POINT at
    // the far end and its width at the core, so it reads as something thrown
    // from here rather than a line drawn through here.
    const sliver = (ang, len, wide, a) => {
      x.save(); x.translate(c, c); x.rotate(ang);
      const gg = x.createLinearGradient(0, 0, len, 0);
      gg.addColorStop(0, 'rgba(255,255,255,' + a + ')');
      gg.addColorStop(0.5, 'rgba(226,240,255,' + (a * 0.42) + ')');
      gg.addColorStop(1, 'rgba(200,225,255,0)');
      x.fillStyle = gg;
      x.beginPath(); x.moveTo(0, -wide); x.lineTo(len, 0); x.lineTo(0, wide);
      x.closePath(); x.fill();
      x.restore();
    };
    // ── A CROSS, AND THEN EVERYTHING ELSE ────────────────────────────────
    //
    // The first cut of this gathered every sliver into a ±37° band about one
    // axis. That was an overcorrection: the fault being fixed was the EVEN
    // eight-spike symmetry of a lens flare, and squashing the burst onto a
    // single axis trades one wrong shape for another — it reads as a fan.
    //
    // What the reference actually does is keep the spray radial and earn its
    // direction from two DOMINANT crossed beams: one long down the line of the
    // blow, one shorter across it. The cross says which way; the forty fine
    // slivers around it say how hard. Neither can do the other's job.
    for (let i = 0; i < 40; i++) {
      const ang = Math.random() * Math.PI * 2;
      // lengths on a long tail — mostly short, a few reaching right out
      const len = s * (0.055 + Math.pow(Math.random(), 2.6) * 0.40);
      sliver(ang, len, s * (0.004 + Math.random() * 0.009), 0.4 + Math.random() * 0.5);
    }
    // the long axis, doubled either side of centre, and the short one across it
    sliver(0, s * 0.50, s * 0.017, 1.0);
    sliver(Math.PI, s * 0.44, s * 0.015, 0.92);
    sliver(Math.PI / 2, s * 0.26, s * 0.012, 0.80);
    sliver(-Math.PI / 2, s * 0.23, s * 0.011, 0.74);
  });
}

// a mote: soft, round, and slightly eaten at the edge so it reads as ash
// rather than as a lens dot
function moteTexture() {
  return fxCanvas(64, (x, s) => {
    const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, s, s);
    // bite a little out of it, so a hundred of these do not look like a hundred
    // of the same circle
    x.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2, r = s * (0.22 + Math.random() * 0.26);
      x.beginPath();
      x.arc(s / 2 + Math.cos(a) * r, s / 2 + Math.sin(a) * r, s * 0.05 * Math.random(), 0, 7);
      x.fill();
    }
  });
}

// a streak: the same mote stretched, for anything travelling fast enough to
// smear — the sparks off an impact and the motes inside a blast
function streakTexture() {
  return fxCanvas(64, (x, s) => {
    const g = x.createLinearGradient(0, s / 2, s, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.42, 'rgba(255,255,255,0.85)');
    g.addColorStop(0.55, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    for (let y = 0; y < s; y++) {
      const d = Math.abs(y - s / 2) / (s / 2);
      x.globalAlpha = Math.max(0, 1 - d * d * 3.4);
      x.fillRect(0, y, s, 1);
    }
  });
}

// THE RIBBON'S EDGE IS THE WHOLE JOB. A weapon trail with a clean gradient
// reads as a plastic swoosh; what makes it a SLASH is that the edge is torn.
// This is a horizontal ramp — hot at the leading edge, gone at the trailing —
// multiplied by a vertical falloff and then chewed with noise, so the arc has
// an ink-brush edge rather than an airbrushed one.
function slashTexture() {
  return fxCanvas(256, (x, s) => {
    const img = x.createImageData(s, s);
    for (let y = 0; y < s; y++) {
      for (let i = 0; i < s; i++) {
        const u = i / (s - 1), v = y / (s - 1);
        // along the arc: a hot leading edge that falls away behind
        const along = Math.pow(u, 0.55);
        // across it: thin at both lips, solid through the middle
        const across = 1 - Math.pow(Math.abs(v * 2 - 1), 1.7);
        // and the tear — a couple of octaves of cheap value noise
        const n = Math.sin(u * 21.7 + v * 9.3) * 0.5 + Math.sin(u * 47.1 - v * 23.7) * 0.28
                + Math.sin(v * 61.3 + u * 5.1) * 0.16;
        let a = along * across * (0.72 + n * 0.34);
        a = Math.max(0, Math.min(1, a));
        // the leading two-fifths burn white, the tail cools to gold
        const heat = Math.pow(u, 2.2);
        const o = (y * s + i) * 4;
        img.data[o] = 255;
        img.data[o + 1] = 244 - (1 - heat) * 60;
        img.data[o + 2] = 216 - (1 - heat) * 140;
        img.data[o + 3] = a * 255;
      }
    }
    x.putImageData(img, 0, 0);
  });
}

// ── ONE POOL, ONE DRAW CALL ────────────────────────────────────────────────
//
// Every spark in the fight is a point in a single BufferGeometry that is
// allocated once and never grows. A burst does not create anything: it finds
// dead slots and refills them. This matters more than it looks in a browser —
// the alternative, a mesh per effect, spends its whole budget on allocation and
// draw calls and then stutters on the garbage, which is the exact opposite of
// what an impact is for.
//
// The shader is deliberately small. Size falls off with distance the way a real
// lens does (so a spark thrown toward the camera GROWS), colour rides from hot
// through gold to ash across a particle's life, and everything is additive with
// depth WRITING OFF — sparks must be occluded by bodies but must never occlude
// each other, or a burst turns into a mosaic of squares.
const SPARKS = 900;
class Sparks {
  constructor(map) {
    this.n = SPARKS;
    this.pos = new Float32Array(SPARKS * 3);
    this.vel = new Float32Array(SPARKS * 3);
    this.life = new Float32Array(SPARKS);      // seconds remaining
    this.max = new Float32Array(SPARKS);       // seconds it started with
    this.seed = new Float32Array(SPARKS);
    this.scale = new Float32Array(SPARKS);
    this.drag = new Float32Array(SPARKS);
    this.grav = new Float32Array(SPARKS);
    this.next = 0;
    // ── A SPARK IS A STREAK, NOT A DOT ────────────────────────────────────
    //
    // These were `THREE.Points`, and a point is a SQUARE facing the lens whose
    // only freedom is how big it is. That is the ceiling on how good they could
    // ever look: a real spark thrown at eight metres a second crosses most of
    // its own length inside one frame, so the eye expects a smear along the way
    // it is going. Drawing it as a round dot instead is the single thing that
    // reads as "particle system" rather than as metal coming off a strike, and
    // no amount of colour or count fixes it, because the fault is the shape.
    //
    // So each spark is an instanced QUAD, stretched along its own velocity as
    // that velocity appears ON SCREEN, and only as much as it is actually
    // moving — fast ones are long, slow ones relax back to round embers as they
    // fall. One draw call, four vertices, the same arrays as before.
    const g = new THREE.InstancedBufferGeometry();
    // the unit quad every spark is drawn from: x runs along the streak, y across
    g.setAttribute('aCorner', new THREE.BufferAttribute(new Float32Array([
      -0.5, -0.5,   0.5, -0.5,   -0.5, 0.5,   0.5, 0.5]), 2));
    g.setIndex([0, 1, 2, 2, 1, 3]);
    g.setAttribute('iPos', new THREE.InstancedBufferAttribute(this.pos, 3));
    g.setAttribute('iVel', new THREE.InstancedBufferAttribute(this.vel, 3));
    g.setAttribute('aLife', new THREE.InstancedBufferAttribute(this.life, 1));
    g.setAttribute('aMax', new THREE.InstancedBufferAttribute(this.max, 1));
    g.setAttribute('aScale', new THREE.InstancedBufferAttribute(this.scale, 1));
    g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(this.seed, 1));
    g.instanceCount = SPARKS;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 60);
    const m = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: map },
        uHot: { value: FX_HOT }, uGold: { value: FX_GOLD }, uAsh: { value: FX_ASH },
        uPx: { value: 1 },
        // how many metres of streak a metre-per-second of speed is worth. This
        // is a shutter time: 1/48s is a film camera's, and it is why the number
        // looks small and should not be tuned by eye.
        // …AND A CEILING ON IT. Shutter alone is not enough: the debris burst
        // leaves at up to 27 m/s, which at a 48th of a second is more than half
        // a metre of streak — photographed, they were white spears the length
        // of the foe, and eighty of them additively overlapped into a sheet.
        // A spark may not draw longer than nine times its own width, whatever
        // the arithmetic says, because past that it stops reading as a spark.
        uStretch: { value: 1 / 110 },
        uMaxLen: { value: 16.0 },
      },
      transparent: true, depthWrite: false, depthTest: true,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute vec2 aCorner;
        attribute vec3 iPos; attribute vec3 iVel;
        attribute float aLife; attribute float aMax;
        attribute float aScale; attribute float aSeed;
        uniform float uStretch, uMaxLen;
        varying float vAge; varying float vSeed; varying vec2 vC;
        void main() {
          vSeed = aSeed;
          vC = aCorner;
          vAge = aMax > 0.0 ? 1.0 - aLife / aMax : 1.0;
          vec4 mv = modelViewMatrix * vec4( iPos, 1.0 );
          // the velocity as the LENS sees it. A spark flying straight at the
          // camera has no screen-space direction at all and must stay round —
          // which falls out of this for free, because its xy goes to zero.
          vec3 vv = ( modelViewMatrix * vec4( iVel, 0.0 ) ).xyz;
          // ── AND A SPARK IS THIN ──────────────────────────────────────
          // aScale is the size every other effect in this layer means by it:
          // a mote's diameter. A spark is not a mote — it is a filament, a few
          // pixels across at this camera distance however long it is — so it
          // takes a third of that width and puts the rest into length. At full
          // width the streaks photographed as white lozenges: the right shape
          // for a tumbling ember and the wrong one for metal leaving a strike.
          float wide = aScale * 0.34 * ( 1.0 - 0.45 * vAge );
          float len = min( wide + length( vv.xy ) * uStretch, wide * uMaxLen );
          vec2 dir = length( vv.xy ) > 1e-4 ? normalize( vv.xy ) : vec2( 0.0, 1.0 );
          vec2 per = vec2( -dir.y, dir.x );
          mv.xy += dir * ( aCorner.x * len ) + per * ( aCorner.y * wide );
          gl_Position = projectionMatrix * mv;
          if ( aLife <= 0.0 ) gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 );  // parked offscreen
        }`,
      fragmentShader: `
        uniform vec3 uHot; uniform vec3 uGold; uniform vec3 uAsh;
        varying float vAge; varying float vSeed; varying vec2 vC;
        void main() {
          // a capsule rather than a sprite: round across, tapered along, and
          // BRIGHTEST AT THE LEADING END, because that is where the metal is —
          // the rest of the streak is where it has been.
          // a tight gaussian across, so the filament has a hard bright spine
          // and a soft shoulder rather than a uniform slab
          float across = exp( -pow( vC.y / 0.21, 2.0 ) );
          float head = smoothstep( -0.5, 0.5, vC.x );
          float along = mix( 0.25, 1.0, head );
          float core = exp( -pow( vC.y / 0.085, 2.0 ) ) * head;
          // white-hot, then gold, then ash — a spark COOLS, it does not just
          // fade. AND NOT ALL AT THE SAME RATE: a burst where every piece
          // changes colour together is one object flickering, not forty. The
          // seed moves each spark's ramp, so at any instant some are still
          // white and others have already gone to ash.
          float cool = vAge * ( 0.62 + fract( vSeed * 91.7 ) * 0.85 );
          vec3 c = mix( uHot, uGold, smoothstep( 0.0, 0.42, cool ) );
          c = mix( c, uAsh, smoothstep( 0.5, 1.0, cool ) );
          // and it flickers, because an ember tumbling in the air does
          float flick = 0.78 + 0.22 * sin( vSeed * 40.0 + vAge * 34.0 );
          float a = across * along * ( 1.0 - vAge ) * flick;
          gl_FragColor = vec4( c * ( 1.0 + ( 1.0 - vAge ) * 0.9 ) + uHot * core * 0.45,
                               clamp( a * 0.85, 0.0, 1.0 ) );
        }`,
    });
    this.points = new THREE.Mesh(g, m);
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
    this.geo = g;
    this.mat = m;
  }

  // fire `count` sparks from `at`, thrown along `dir` with `spread` radians of
  // scatter. Everything else is per-effect taste.
  emit(at, dir, count, o) {
    o = o || {};
    const speed = o.speed || 4, spread = o.spread === undefined ? 1.1 : o.spread;
    const life = o.life || 0.55, size = o.size || 0.055;   // METRES
    const grav = o.grav === undefined ? -3.2 : o.grav;
    const drag = o.drag === undefined ? 2.4 : o.drag;
    const d = _fxD.copy(dir).normalize();
    for (let k = 0; k < count; k++) {
      const i = this.next = (this.next + 1) % SPARKS;
      // a cone around `dir`: pick a random vector, push it toward the axis
      _fxV.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
      if (_fxV.lengthSq() < 1e-6) _fxV.set(0, 1, 0);
      _fxV.normalize().multiplyScalar(spread).add(d).normalize();
      const s = speed * (0.45 + Math.random() * 0.9);
      this.pos[i * 3] = at.x + _fxV.x * 0.06;
      this.pos[i * 3 + 1] = at.y + _fxV.y * 0.06;
      this.pos[i * 3 + 2] = at.z + _fxV.z * 0.06;
      this.vel[i * 3] = _fxV.x * s;
      this.vel[i * 3 + 1] = _fxV.y * s;
      this.vel[i * 3 + 2] = _fxV.z * s;
      const L = life * (0.6 + Math.random() * 0.8);
      this.life[i] = L; this.max[i] = L;
      // ── MOST OF THEM ARE SMALL ─────────────────────────────────────────
      // A uniform roll gives a burst where every piece is roughly the same
      // weight, which is the look of a particle system rather than of something
      // breaking. Real debris is mostly fines with a few big pieces, so the
      // roll is raised to a power: the median lands near a third of the stated
      // size and the tail still reaches well past it.
      this.scale[i] = size * (0.30 + Math.pow(Math.random(), 2.3) * 1.85);
      this.seed[i] = Math.random();
      // …and they do not all slow at the same rate either, which is what
      // stops the fan from staying a fan
      this.drag[i] = drag * (0.7 + Math.random() * 0.8); this.grav[i] = grav;
    }
  }

  step(dt) {
    const p = this.pos, v = this.vel, l = this.life;
    let live = 0;
    for (let i = 0; i < SPARKS; i++) {
      if (l[i] <= 0) continue;
      live++;
      l[i] -= dt;
      if (l[i] <= 0) { l[i] = 0; continue; }
      const k = Math.max(0, 1 - this.drag[i] * dt);
      const j = i * 3;
      v[j] *= k; v[j + 1] = v[j + 1] * k + this.grav[i] * dt; v[j + 2] *= k;
      p[j] += v[j] * dt; p[j + 1] += v[j + 1] * dt; p[j + 2] += v[j + 2] * dt;
      // the floor is wet stone, not a hole: an ember that reaches it stops
      if (p[j + 1] < 0.02) { p[j + 1] = 0.02; v[j + 1] *= -0.22; v[j] *= 0.6; v[j + 2] *= 0.6; }
    }
    this.live = live;
    if (live || this._wasLive) {
      this.geo.attributes.iPos.needsUpdate = true;
      this.geo.attributes.iVel.needsUpdate = true;
      this.geo.attributes.aLife.needsUpdate = true;
      this.geo.attributes.aMax.needsUpdate = true;
      this.geo.attributes.aScale.needsUpdate = true;
      this.geo.attributes.aSeed.needsUpdate = true;
    }
    this._wasLive = live > 0;
  }
}

// ── THE SLASH IS THE PATH THE WEAPON ACTUALLY TOOK ─────────────────────────
//
// This is the part that cannot be faked with a sprite, and the reason the old
// one read as a decal stuck on the screen: a slash is not a picture of an arc,
// it is the surface a blade swept through the air. So the trail is BUILT from
// the hand bone's real world position, sampled every frame while the swing
// plays, and the mesh is the ruled surface between the wrist and a point out
// along the blade.
//
// It costs nothing extra to be correct here — the bone is already being posed
// sixty times a second by an animation the fight chose, so the arc is
// automatically the arc that character makes with that weapon. Ash's longsword
// and Mira's daggers do not need separate art; they have separate arms.
const TRAIL = 22;                     // samples kept — about a third of a second
// …and how many vertices are drawn between two of them. Five is where the
// corners stop being findable on a fast swing at this camera distance; the
// cost is 105 verts instead of 22, which is nothing.
const RIB_SUB = 5;
// …AND HOW FAR PAST THE BLADE THE STRIP REACHES. The arc used to end exactly
// at the tip's curve, which is the one place it must NOT end: that curve is
// the cutting edge, and an edge with nothing outside it cannot glow. It can
// only stop. Flaring the outer rail a third past the tip gives the light
// somewhere to fall off into, and costs nothing but a wider quad — the edge
// itself stays exactly where the steel was, at `1/RIB_FLARE` across the band.
const RIB_FLARE = 1.34;
// ── CENTRIPETAL CATMULL-ROM ────────────────────────────────────────────────
//
// Uniform Catmull-Rom — the textbook one, with the 2/-5/4/-1 coefficients —
// assumes its control points are evenly spaced. A blade's are not: the tip
// crawls through the wind-up and covers half a metre in a frame at the peak of
// the stroke, so the parameterisation is wildly uneven and the curve OVERSHOOTS
// at every sharp joint, bulging outside the points it is supposed to smooth.
// Measured on a sword swing: the uniform spline's worst joint turned 64°, worse
// than the 52° of the raw sample chain it was drawn to smooth. A spline that
// turns harder than the polygon is not smoothing anything.
//
// Spacing the knots by the square root of the distance between points — the
// centripetal parameterisation, alpha = 0.5 — is the one choice in the family
// that provably cannot overshoot or form a cusp, whatever the points do. It
// costs three square roots per segment and nothing else.
//
// Written straight into the output array: this runs for every vertex of every
// arc every frame, and allocating a Vector3 here would be the most expensive
// thing the effects layer does.
function knot(t, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
  return t + Math.sqrt(Math.sqrt(dx * dx + dy * dy + dz * dz)) || t + 1e-4;
}
function cr(p0, p1, p2, p3, u, out, o) {
  const t0 = 0, t1 = knot(t0, p0, p1), t2 = knot(t1, p1, p2), t3 = knot(t2, p2, p3);
  // a run of coincident points leaves a zero-length knot span; fall back to the
  // segment's own endpoints rather than dividing by it
  if (!(t1 > t0) || !(t2 > t1) || !(t3 > t2)) {
    out[o] = p1.x + (p2.x - p1.x) * u;
    out[o + 1] = p1.y + (p2.y - p1.y) * u;
    out[o + 2] = p1.z + (p2.z - p1.z) * u;
    return;
  }
  const t = t1 + u * (t2 - t1);
  // Barry-Goldman: three levels of linear interpolation, per component
  const one = (c) => {
    const a1 = ((t1 - t) * p0[c] + (t - t0) * p1[c]) / (t1 - t0);
    const a2 = ((t2 - t) * p1[c] + (t - t1) * p2[c]) / (t2 - t1);
    const a3 = ((t3 - t) * p2[c] + (t - t2) * p3[c]) / (t3 - t2);
    const b1 = ((t2 - t) * a1 + (t - t0) * a2) / (t2 - t0);
    const b2 = ((t3 - t) * a2 + (t - t1) * a3) / (t3 - t1);
    return ((t2 - t) * b1 + (t - t1) * b2) / (t2 - t1);
  };
  out[o] = one('x'); out[o + 1] = one('y'); out[o + 2] = one('z');
}

class Ribbon {
  constructor(map) {
    // ── THE ARC IS A CURVE, NOT THE SAMPLES ──────────────────────────────
    //
    // One sample per frame, one quad per sample, was a chain of straight
    // segments with a visible corner at every joint — and the faster the blade
    // moved the further apart the samples were and the more the corners
    // showed. A swing is exactly when the blade is fastest, so the arc was
    // jaggiest precisely when it was most looked at, and no amount of shading
    // hides a polygon corner.
    //
    // The samples are control points now and the strip is a Catmull-Rom spline
    // through them, resampled at RIB_SUB times the density. Catmull-Rom rather
    // than a Bezier because it PASSES THROUGH its control points: the arc still
    // goes exactly where the blade went, and only the space between frames is
    // invented.
    this.n = TRAIL;
    this.segs = (TRAIL - 1) * RIB_SUB + 1;    // vertices along the arc
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(this.segs * 2 * 3);
    this.uv = new Float32Array(this.segs * 2 * 2);
    const idx = [];
    for (let i = 0; i < this.segs - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    for (let i = 0; i < this.segs; i++) {
      const u = i / (this.segs - 1);
      this.uv[i * 4] = u; this.uv[i * 4 + 1] = 0;
      this.uv[i * 4 + 2] = u; this.uv[i * 4 + 3] = 1;
    }
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(this.uv, 2));
    g.setIndex(idx);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 60);
    // ── THE ARC IS THREE THINGS, NOT ONE QUAD ─────────────────────────────
    //
    // It began as a single additive quad wearing a texture at a flat opacity:
    // the same brightness at the tail as at the blade, the same across the
    // width, a hard border where the geometry stopped. Shading it along and
    // across (Build 148) fixed the border and gave it a head, and it still
    // read cheap, because a bright shape drawn OVER the world is a decal. The
    // things that make an arc feel like it costs something are the things that
    // say it is IN the world and made of energy:
    //
    //   1 · IT BENDS WHAT IS BEHIND IT. Superheated air is a lens. This is the
    //       half that cannot be faked with brightness, and it is why the same
    //       geometry is drawn twice: once with normal blending, sampling the
    //       frame the world was just rendered into and offsetting the sample
    //       ACROSS the band, and once additively for the light. Additive alone
    //       cannot refract — adding the background to itself only doubles it.
    //
    //   2 · IT HAS A CORE, and the core is not the band. A blade trail is a
    //       thin white-hot spine with a wide soft bloom around it, and the
    //       spine tightens toward the leading edge. One falloff across the
    //       whole width gives a fat glowing ribbon; two — a narrow gaussian
    //       for the core, a wide sine for the bloom — give a blade.
    //
    //   3 · IT FRAYS AS IT DIES. The head is clean because it was just cut;
    //       the tail has had time to come apart. A little turbulence weighted
    //       by age does that, and it is what stops the shape reading as a
    //       stamped swoosh played back at different opacities.
    //
    // The refraction samples the target the WORLD pass writes, which this
    // frame is a frame behind — the arc is drawn inside the scene so it keeps
    // its depth test, and a pass cannot read the target it is writing. At a
    // sixtieth of a second the lag is a fraction of one segment of the trail
    // and there is nothing on screen to compare it against.
    const CHUNK = `
      varying vec2 vUv;
      varying vec4 vClip;
      void main() {
        vUv = uv;
        vClip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = vClip;
      }`;
    // ── THE SHAPE: A CUTTING EDGE WITH A BODY BEHIND IT ──────────────────
    //
    // Shared by both passes so they cannot disagree about where the arc is —
    // only about what to do there.
    //
    // The first cut spread the light across the whole swept sheet with a sine
    // falloff either side, which photographs as a soft white blob: bright in
    // the middle, hazy at both boundaries, no line anywhere. A slash does not
    // read from its middle. It reads from ITS EDGE — the curve the tip drew,
    // which is the outer boundary of the crescent — and everything inboard of
    // that is the body of displaced air behind the cut.
    //
    // So `v` runs 0 at the grip's path to 1 at the TIP's path, and the two
    // pieces are built from the distance inward from the tip:
    //
    //   edge · a thin hard line on the tip's curve, tightening as it gets
    //          younger, and no thinner than the pixel it is drawn on, so it
    //          stays a clean line at any distance instead of aliasing into
    //          dashes when the camera pulls back.
    //   body · an exponential falloff inward from that edge, clipped crisply
    //          at the grip so the crescent has a silhouette rather than
    //          dissolving, and frayed by a little turbulence as it ages.
    const SHAPE = `
      uniform float uFade, uTime, uGain, uTip;
      varying vec2 vUv;
      varying vec4 vClip;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      // 0 at the oldest sample, 1 at the blade right now
      float lifeOf() { return pow(clamp(vUv.x, 0.0, 1.0), 1.5); }
      // signed across the band: 0 ON the cutting edge, positive OUTSIDE it in
      // the flare, negative inboard through the body toward the grip
      float offOf() { return clamp(vUv.y, 0.0, 1.0) - uTip; }
      float edgeOf(float life) {
        // never thinner than the pixel, so the line antialiases instead of
        // breaking into dashes when the arc is far away or nearly edge-on
        float w = max(fwidth(vUv.y) * 1.6, mix(0.070, 0.022, life));
        return 1.0 - smoothstep(0.0, w, abs(offOf()));
      }
      float bodyOf(float life) {
        float d = max(-offOf(), 0.0);              // inboard only
        float b = exp(-d * 3.0) * smoothstep(0.0, 0.05, clamp(vUv.y, 0.0, 1.0));
        // the tail frays; the head is clean because it was just cut — and the
        // fray never touches the edge, which has to stay a line
        float turb = noise(vec2(vUv.x * 11.0 - uTime * 2.6, vUv.y * 3.5 + uTime * 0.7));
        return b * mix(0.45 + 0.55 * turb, 1.0, life);
      }
      // THE HALO, which is the whole reason the strip runs past the steel. Wide
      // and symmetric about the edge, so the cut sits in its own light instead
      // of being a bright line pasted on the world.
      float bloomOf(float life) {
        return exp(-abs(offOf()) * 5.4) * (0.30 + 0.70 * life);
      }`;

    const common = {
      uFade: { value: 0 }, uTime: { value: 0 }, uGain: { value: 1 },
      uTip:  { value: 1 / RIB_FLARE },
      uHot:  { value: new THREE.Color(0xfffdf6) },
      // …AND A WARM STOP BETWEEN THE TWO. Two colours can only ramp; three can
      // COOL, which is what a struck arc does — white at the steel, gold just
      // behind it, and the blue of the air by the time the tail has gone.
      uWarm: { value: new THREE.Color(0xffcf87) },
      uCool: { value: new THREE.Color(0x5f86c8) },
    };
    // ── PASS ONE: THE AIR ────────────────────────────────────────────────────
    // Normal blending, so it can REPLACE the pixel with a displaced sample of
    // the world instead of adding to it. The offset runs across the band and
    // reverses either side of the spine, which is what a lens does; the three
    // channels are pulled apart very slightly, which is what glass does.
    this.refMat = new THREE.ShaderMaterial({
      uniforms: Object.assign({ uScene: { value: null }, uAmt: { value: 0.022 } }, common),
      transparent: true, depthWrite: false, depthTest: true,
      side: THREE.DoubleSide, blending: THREE.NormalBlending,
      vertexShader: CHUNK,
      fragmentShader: SHAPE + `
        uniform sampler2D uScene;
        uniform float uAmt;
        void main() {
          float life = lifeOf();
          float body = max(bodyOf(life), bloomOf(life) * 0.55);
          vec2 uv = (vClip.xy / vClip.w) * 0.5 + 0.5;
          // outward from the cut, strongest just behind the edge and at the
          // young end of the arc, gone by the time the tail has cooled — and
          // it reverses across the edge, which is what a lens does
          float lens = offOf() * 2.4;
          float k = uAmt * uFade * body * (0.35 + 0.65 * life);
          vec2 off = vec2(lens, lens * 0.35) * k;
          vec3 c;
          c.r = texture2D(uScene, uv + off * 1.06).r;
          c.g = texture2D(uScene, uv + off).g;
          c.b = texture2D(uScene, uv + off * 0.94).b;
          // THE AIR IS THE BODY ALONE. Letting the haze reach the edge is what
          // made the whole arc read soft: a displaced, slightly milky sample
          // sitting on top of the one line that is supposed to be sharp.
          gl_FragColor = vec4(c, clamp(body * uFade * 0.55, 0.0, 1.0));
        }`,
    });
    // ── PASS TWO: THE LIGHT ──────────────────────────────────────────────────
    this.mat = new THREE.ShaderMaterial({
      uniforms: Object.assign({ uMap: { value: map } }, common),
      transparent: true, depthWrite: false, depthTest: true,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      vertexShader: CHUNK,
      fragmentShader: SHAPE + `
        uniform sampler2D uMap;
        uniform vec3 uHot, uWarm, uCool;
        void main() {
          float life = lifeOf();
          float body = bodyOf(life);
          float edge = edgeOf(life);
          float halo = bloomOf(life);
          // the ink of the swing still shapes the wide part; it never touches
          // the edge, which is geometry rather than texture
          float ink = 0.40 + 0.60 * texture2D(uMap, vUv).a;
          float glow = body * ink * life * uFade;
          float cut  = edge * life * uFade;
          float air  = halo * uFade * 0.85;
          // ── IT COOLS AS IT AGES ────────────────────────────────────────
          // White where the steel is, gold just behind it, the blue of the air
          // by the tail. Two stops could only fade; three can cool, and cooling
          // is what makes a struck arc read as something that HAPPENED rather
          // than something that is being drawn.
          vec3 c = mix(uCool, uWarm, smoothstep(0.0, 0.55, life));
          c = mix(c, uHot, smoothstep(0.50, 1.0, life));
          // …and the cut deliberately overshoots 1.0. There is no tone mapping
          // here, so it clips to white — and clipping is exactly what makes it
          // read as a hard edge rather than a bright smudge.
          vec3 col = (c * glow * 2.60 + c * air * 1.05 + uHot * cut * 11.50) * uGain;
          gl_FragColor = vec4(col,
            clamp((glow * 0.45 + air * 0.30 + cut) * uGain, 0.0, 1.0));
        }`,
    });
    // ONE GEOMETRY, TWO DRAWS. The air goes down first so the light lands on
    // top of what it bent, and both read the same buffer — a second copy of
    // twenty-two quads would be a second chance for them to disagree.
    this.air = new THREE.Mesh(g, this.refMat);
    this.air.frustumCulled = false;
    this.air.renderOrder = 4;
    this.air.visible = false;
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.mesh.visible = false;
    this.geo = g;
    this.head = 0; this.filled = 0; this.fade = 0;
    this.pts = [];
    for (let i = 0; i < TRAIL; i++) this.pts.push({ a: new THREE.Vector3(), b: new THREE.Vector3() });
  }
  // ONE SAMPLE IS THE BLADE ITSELF. `out` used to be a direction and `reach` a
  // guess at how far along it a weapon would reach, because there was no
  // weapon: the arc was a segment hung off the wrist. There are real blades in
  // these hands now, so `a` and `b` are the weapon's own base and tip and the
  // ribbon is the surface the edge actually swept. `reach` survives only for
  // the figures that still have nothing to hold.
  push(wrist, out, reach) {
    const p = this.pts[this.head];
    p.a.copy(wrist);
    if (reach > 0) p.b.copy(out).sub(wrist).normalize().multiplyScalar(reach).add(wrist);
    else p.b.copy(out);
    // ── A SAMPLE IS A PLACE THE BLADE WENT, NOT A FRAME THAT ELAPSED ──────
    //
    // Recording one every frame regardless meant a blade that is not moving
    // filled the ring with the same point over and over — which happens for
    // as long as a card is HELD, because the wind-up is still an action and
    // still asks for a trail. A run of identical control points is not just
    // wasted: a Catmull-Rom through them has no direction to follow and
    // overshoots, and the measured worst turn in the strip was a full 180°
    // reversal. Under a metre of blade travel per frame this changes nothing;
    // it only refuses to record standing still.
    const last = this.pts[(this.head - 1 + TRAIL) % TRAIL];
    if (this.filled > 0 && last.b.distanceToSquared(p.b) < 4e-4) { this.fade = 1; return; }
    this.head = (this.head + 1) % TRAIL;
    if (this.filled < TRAIL) this.filled++;
    this.fade = 1;
  }
  step(dt) {
    this.t = (this.t || 0) + dt;
    this.mat.uniforms.uTime.value = this.refMat.uniforms.uTime.value = this.t;
    this.mat.uniforms.uGain.value = this.refMat.uniforms.uGain.value = LOOK.arc;
    if (this.fade <= 0) { this.mesh.visible = this.air.visible = false; return; }
    // THE TAIL DIES ON ITS OWN. A trail that is simply switched off at the end
    // of the swing pops; one that keeps drawing while its opacity falls reads
    // as the air closing behind the blade.
    // …AND IT LINGERS A BEAT LONGER. At 3.6 the arc was gone almost as the blade
    // finished, which is tidy and reads as a UI flourish; a struck arc should
    // still be closing while the body recovers.
    this.fade = Math.max(0, this.fade - dt * 2.9);
    const f = this.fade * this.fade * 0.95;
    this.mat.uniforms.uFade.value = f;
    this.refMat.uniforms.uFade.value = f;
    // TWO SAMPLES IS A QUAD, AND A QUAD IS A SLASH. Requiring three meant a
    // frame rate low enough to take fewer than three samples during a swing
    // drew no arc at all — which is not a state anybody should ship to, since
    // the machines that draw slowest are exactly the ones already struggling
    // to sell the hit.
    this.mesh.visible = this.filled >= 2;
    // …and the air only when there is a frame of world for it to bend. With no
    // target allocated the refraction pass would sample nothing and lay a
    // transparent black sheet over the fight.
    this.air.visible = this.mesh.visible && !!this.refMat.uniforms.uScene.value;
    if (!this.mesh.visible) return;
    // the samples in order, oldest first, so u=0 is the tail and u=1 the blade
    const n = this.filled, ring = this.pts, first = (this.head - n + TRAIL * 2) % TRAIL;
    const at = (k) => ring[(first + Math.max(0, Math.min(n - 1, k))) % TRAIL];
    const N = this.segs;
    for (let i = 0; i < N; i++) {
      // where this vertex falls among the control points
      const x = (i / (N - 1)) * (n - 1);
      const k = Math.min(n - 2, Math.floor(x)), t = n > 1 ? x - k : 0;
      const p0 = at(k - 1), p1 = at(k), p2 = at(k + 1), p3 = at(k + 2);
      const o = i * 6;
      cr(p0.a, p1.a, p2.a, p3.a, t, this.pos, o);
      cr(p0.b, p1.b, p2.b, p3.b, t, this.pos, o + 3);
      // …and the outer rail runs on past the steel, so the glow has room
      for (let c = 0; c < 3; c++)
        this.pos[o + 3 + c] = this.pos[o + c]
          + (this.pos[o + 3 + c] - this.pos[o + c]) * RIB_FLARE;
    }
    this.geo.attributes.position.needsUpdate = true;
  }
  clear() { this.filled = 0; this.fade = 0; this.mesh.visible = this.air.visible = false; }
  // the world as it was drawn a frame ago, which is what the air bends
  behind(tex) { this.refMat.uniforms.uScene.value = tex; }
}

// ── THE SHOCKWAVE, WHICH IS NOW A RING IN THE WORLD ────────────────────────
//
// `shockRing` drew a CSS circle at a screen position and grew its width. This
// is a ring of geometry standing at the point of impact, facing the camera,
// expanding in METRES — so it is the right size for how far away the hit was
// without anybody computing that, it is occluded by whatever is in front of it,
// and it lands in the water with everything else.
// ── THE FLASH ─────────────────────────────────────────────────────────────
//
// A ring says how big the blow was; a flash says WHEN it was. It arrives at
// full brightness on the frame of contact and is gone in a sixth of a second,
// which is the whole point — anything that fades in has already missed the
// moment it exists to mark.
const FLASHES = 4;
const _flashV = new THREE.Vector3(), _flashQ = new THREE.Quaternion();
class Flashes {
  constructor(map) {
    this.fired = 0;
    this.items = [];
    const g = new THREE.PlaneGeometry(1, 1);
    for (let i = 0; i < FLASHES; i++) {
      const m = new THREE.MeshBasicMaterial({
        map, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false,
        depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(g, m);
      mesh.visible = false; mesh.renderOrder = 7; mesh.frustumCulled = false;
      this.items.push({ mesh, mat: m, t: 0, dur: 1, size: 1, spin: 0, long: 1.6,
                        dir: new THREE.Vector3() });
    }
  }
  // `toward` is the direction the blow was travelling. A clash is not the same
  // in every direction and must not be drawn as though it were.
  fire(at, size, dur, toward, along, span) {
    this.fired++;
    const it = this.items.find(i => i.t <= 0) || this.items[0];
    it.mesh.position.copy(at);
    it.t = it.dur = dur || 0.14;
    it.size = size;
    it.dir = along ? it.dir.copy(along).normalize()
           : (toward ? it.dir.copy(toward).normalize() : null);
    // HOW LONG THE CUT WAS, in the flash's own width. A blow that drew a metre
    // of steel across a body and one that tapped it are not the same picture,
    // and a round stamp cannot tell them apart.
    it.long = span ? Math.max(1.4, Math.min(4.2, span / Math.max(0.2, size) * 1.5)) : 1.6;
    // a little scatter on top, so two blows along the same line are not the
    // same picture twice — but only a little, or the direction stops reading
    it.spin = (Math.random() - 0.5) * 0.5;
    it.mesh.visible = true;
    return it;
  }
  step(dt, cam) {
    for (const it of this.items) {
      if (it.t <= 0) continue;
      it.t -= dt;
      if (it.t <= 0) { it.t = 0; it.mesh.visible = false; continue; }
      const k = it.t / it.dur;                 // 1 at contact, 0 as it dies
      // BIGGEST AT THE START. A flash that grows is an explosion; a flash that
      // is already there and shrinking is an impact.
      const sc = it.size * (0.55 + 0.85 * k);
      // long along the cut, thin across it — the flash is the slash's own shape
      it.mesh.scale.set(sc * it.long, sc * (0.62 + 0.25 * k), sc);
      // squared, so it is bright for an instant and then genuinely gone rather
      // than lingering at a quarter strength for the rest of the beat
      it.mat.opacity = k * k;
      if (cam) {
        // face the lens, then TURN IN THE PLANE OF THE SCREEN so the long
        // slivers lie along the blow. Projecting the world direction into the
        // camera's own axes and taking its angle is the whole of it — no
        // matrix work, and it stays right while the camera moves.
        it.mesh.quaternion.copy(cam.quaternion);
        if (it.dir) {
          _flashV.copy(it.dir).applyQuaternion(_flashQ.copy(cam.quaternion).invert());
          it.mesh.rotateZ(Math.atan2(_flashV.y, _flashV.x) + it.spin);
        } else it.mesh.rotateZ(it.spin);
      }
    }
  }
}

const SHOCKS = 5;
class Shocks {
  constructor() {
    this.fired = 0;      // …and the same for rings, so the pair can be compared
    this.items = [];
    const g = new THREE.RingGeometry(0.42, 0.5, 44);
    for (let i = 0; i < SHOCKS; i++) {
      const m = new THREE.MeshBasicMaterial({
        color: FX_HOT, transparent: true, opacity: 0, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(g, m);
      mesh.visible = false; mesh.renderOrder = 5; mesh.frustumCulled = false;
      this.items.push({ mesh, mat: m, t: 0, dur: 1, size: 1 });
    }
  }
  fire(at, size, dur) {
    this.fired++;
    const it = this.items.find(i => i.t <= 0) || this.items[0];
    it.mesh.position.copy(at);
    it.t = it.dur = dur || 0.42;
    it.size = size;
    it.mesh.visible = true;
    return it;
  }
  step(dt, cam) {
    for (const it of this.items) {
      if (it.t <= 0) continue;
      it.t -= dt;
      if (it.t <= 0) { it.t = 0; it.mesh.visible = false; continue; }
      const p = 1 - it.t / it.dur;
      // fast out of the gate and slowing — an impact does not expand linearly
      const e = 1 - Math.pow(1 - p, 3);
      it.mesh.scale.setScalar(0.25 + e * it.size);
      it.mat.opacity = (1 - p) * (1 - p) * 0.9;
      it.mesh.quaternion.copy(cam.quaternion);      // always square to the lens
    }
  }
}

// ── A CUT IS NOT AN EXPLOSION ──────────────────────────────────────────────
//
// Build 127 gave every impact the same two things: a cone of sparks and an
// expanding ring. That is what a blast looks like, and it is what a sword
// looked like too, which is why a hit read as "an explosion and a flash"
// whatever threw it.
//
// A ring is RADIAL — it says the energy came from a point and went everywhere.
// That is true of a spell and false of a blade, which arrives along a line and
// leaves along the same line. So a physical hit gets this instead: a short,
// bright, elongated mark, square to the lens and rotated to the direction the
// blow was travelling, that stretches along its own length and is gone in a
// fifth of a second. It reads as the cut rather than as the detonation.
// ── THE CLASH IS THE BLADE'S OWN CURVE ─────────────────────────────────────
//
// The mark left by a blow was a flat quad wearing a streak texture, rolled to
// lie along the blow. A quad is straight, and so however it is turned the hit
// reads as a LINE drawn across the foe — which is not what a sword does. A
// sword arrives on a curve, and the curve is the whole character of the thing:
// it is what separates a cut from a stab, and a clash from a flash.
//
// Guessing a curve would be a second mistake. The ribbon has been recording the
// blade's tip every frame of the swing, so the arc that actually arrived is
// already known to the metre — the shape is READ, not invented, exactly like
// the tangent the particles are laid along. What is drawn here is a short
// crescent of that path, camera-facing, tapering to nothing at both ends, alive
// for a sixth of a second.
const CLASH_N = 16;            // vertices along the crescent
const CLASHES = 3;
const _clA = new THREE.Vector3(), _clB = new THREE.Vector3(), _clC = new THREE.Vector3();
const _clT = new THREE.Vector3(), _clV = new THREE.Vector3(), _clNr = new THREE.Vector3();
class Clash {
  constructor() {
    this.fired = 0;
    this.items = [];
    for (let i = 0; i < CLASHES; i++) {
      const g = new THREE.BufferGeometry();
      const pos = new Float32Array(CLASH_N * 2 * 3);
      const uv = new Float32Array(CLASH_N * 2 * 2);
      const idx = [];
      for (let k = 0; k < CLASH_N - 1; k++) {
        const a = k * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      for (let k = 0; k < CLASH_N; k++) {
        const u = k / (CLASH_N - 1);
        uv[k * 4] = u; uv[k * 4 + 1] = 0;
        uv[k * 4 + 2] = u; uv[k * 4 + 3] = 1;
      }
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 60);
      const m = new THREE.ShaderMaterial({
        uniforms: { uFade: { value: 0 }, uHot: { value: new THREE.Color(0xfffdf4) },
                    uWarm: { value: new THREE.Color(0xffd9a0) } },
        transparent: true, depthWrite: false, depthTest: false,
        side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
        vertexShader: 'varying vec2 vUv;\n'
          + 'void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix'
          + ' * vec4(position,1.0); }',
        fragmentShader: [
          'uniform float uFade; uniform vec3 uHot, uWarm;',
          'varying vec2 vUv;',
          'void main(){',
          '  float u = clamp(vUv.x,0.0,1.0), v = clamp(vUv.y,0.0,1.0);',
          // ── POINTED AT BOTH ENDS ───────────────────────────────────
          // The taper was pow(.., 0.55), and an exponent BELOW one is what
          // makes a shape fat through the middle and blunt at the tips —
          // exactly backwards for a blade. Above one it comes to a point,
          // which is the silhouette every good slash FX has and the thing
          // that separates a crescent from a sausage.
          '  float span = pow(sin(u * 3.14159265), 1.7);',
          // ── AND IT IS A HAIRLINE, NOT A GLOW ───────────────────────
          // A core at 0.16 of the half-width with the body falling off at
          // 2.6 is a wide soft band with no line in it. The reference is a
          // bright filament with a shoulder: the core tightens to 0.06 and
          // the body falls twice as fast, so what carries the shape is the
          // SPINE and the glow is only what sits around it.
          '  float d = abs(v - 0.5) * 2.0;',
          '  float core = exp(-pow(d / 0.06, 2.0));',
          '  float body = exp(-d * 5.2);',
          '  float a = span * (body * 0.32 + core) * uFade;',
          '  vec3 c = uWarm * body * 1.1 + uHot * core * 6.5;',
          '  gl_FragColor = vec4(c * span, clamp(a, 0.0, 1.0));',
          '}',
        ].join('\n'),
      });
      const mesh = new THREE.Mesh(g, m);
      mesh.visible = false; mesh.renderOrder = 7; mesh.frustumCulled = false;
      this.items.push({ mesh, mat: m, geo: g, pos, t: 0, dur: 1 });
    }
  }
  // `pts` are world points along the blade's path, oldest first. `eye` is where
  // the camera is, so the strip can be turned to face it — a ribbon in space
  // seen edge-on is invisible, and an impact that vanishes at some angles is
  // worse than one that never curved.
  fire(pts, eye, width, dur) {
    if (!pts || pts.length < 2) return null;
    this.fired++;
    const it = this.items.find(i => i.t <= 0) || this.items[0];
    it.t = it.dur = dur || 0.17;
    const n = pts.length;
    for (let k = 0; k < CLASH_N; k++) {
      // resample the path evenly across the crescent
      const x = (k / (CLASH_N - 1)) * (n - 1);
      const i0 = Math.min(n - 2, Math.floor(x)), f = x - i0;
      _clA.copy(pts[i0]).lerp(pts[i0 + 1], f);
      // the tangent, from the neighbours rather than one segment, so a single
      // noisy sample cannot flip the strip
      const j0 = Math.max(0, i0 - 1), j1 = Math.min(n - 1, i0 + 2);
      _clT.copy(pts[j1]).sub(pts[j0]);
      if (_clT.lengthSq() < 1e-8) _clT.set(0, 1, 0);
      _clT.normalize();
      _clV.copy(eye).sub(_clA).normalize();
      _clNr.crossVectors(_clT, _clV);
      if (_clNr.lengthSq() < 1e-8) _clNr.set(0, 1, 0); else _clNr.normalize();
      const w = width * 0.5;
      const o = k * 6;
      _clB.copy(_clA).addScaledVector(_clNr, -w);
      _clC.copy(_clA).addScaledVector(_clNr, w);
      it.pos[o] = _clB.x; it.pos[o + 1] = _clB.y; it.pos[o + 2] = _clB.z;
      it.pos[o + 3] = _clC.x; it.pos[o + 4] = _clC.y; it.pos[o + 5] = _clC.z;
    }
    it.geo.attributes.position.needsUpdate = true;
    it.mesh.visible = true;
    return it;
  }
  step(dt) {
    for (const it of this.items) {
      if (it.t <= 0) continue;
      it.t -= dt;
      if (it.t <= 0) { it.t = 0; it.mesh.visible = false; continue; }
      const k = it.t / it.dur;
      it.mat.uniforms.uFade.value = k * k;
    }
  }
}

const CUTS = 4;
class Cuts {
  constructor(map) {
    this.items = [];
    const g = new THREE.PlaneGeometry(1, 1);
    for (let i = 0; i < CUTS; i++) {
      const m = new THREE.MeshBasicMaterial({
        map, transparent: true, opacity: 0, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(g, m);
      mesh.visible = false; mesh.renderOrder = 7; mesh.frustumCulled = false;
      this.items.push({ mesh, mat: m, t: 0, dur: 1, len: 1, spin: 0 });
    }
    // ── HOW MANY HAVE EVER BEEN THROWN ────────────────────────────────────
    //
    // A cut lives 0.19s, and a test that reads how many are ALIVE one frame
    // after a blow is really reading the frame rate: the suite's headless
    // browser draws at about 1.5fps, `dt` is capped at a quarter-second, and
    // every mark it fires is dead before anything can look at it. The check
    // that guards "a blade cuts along a line" went red for that and nothing
    // else. A monotonic count of how many were FIRED cannot be starved by a
    // slow machine, which is the property the check was always after.
    this.fired = 0;
  }
  // `along` is the blow's direction in the world; the mark is laid on that line
  fire(at, along, len, dur) {
    this.fired++;
    const it = this.items.find(i => i.t <= 0) || this.items[0];
    it.mesh.position.copy(at);
    it.t = it.dur = dur || 0.2;
    it.len = len;
    it.along = (it.along || new THREE.Vector3()).copy(along).normalize();
    it.mesh.visible = true;
    return it;
  }
  step(dt, cam) {
    for (const it of this.items) {
      if (it.t <= 0) continue;
      it.t -= dt;
      if (it.t <= 0) { it.t = 0; it.mesh.visible = false; continue; }
      const p = 1 - it.t / it.dur;
      // square to the lens, then rolled so its length lies along the blow —
      // worked out in SCREEN space, because that is where the player sees it
      it.mesh.quaternion.copy(cam.quaternion);
      _fxV.copy(it.along).applyQuaternion(_fxQ.copy(cam.quaternion).invert());
      it.mesh.rotateZ(Math.atan2(_fxV.y, _fxV.x));
      // it opens fast along its own length and thins as it goes
      it.mesh.scale.set(it.len * (0.55 + p * 1.5), it.len * 0.26 * (1 - p * 0.72), 1);
      it.mat.opacity = (1 - p) * (1 - p) * 0.95;
    }
  }
}

// ── WHAT EACH VERB LOOKS LIKE ──────────────────────────────────────────────
//
// One table, because the difference between a sword and a spell should be a
// row here rather than a branch somewhere in the fight. `hand` is which wrist
// throws it, `reach` how far the weapon extends past it, and the rest is how
// the air answers.
// `cut` is a blade arriving along a line; `ring` is energy leaving a point in
// every direction. A verb gets one or the other, never both, because both at
// once is exactly the undifferentiated bang this replaces.
const FX_VERB = {
  // A SWORD. Tight cone along the blow — 0.42 rather than 0.85, so the spray
  // follows the blade instead of puffing — fewer sparks, faster, shorter-lived,
  // and a cut mark rather than a shockwave.
  slash: { trail: true, reach: 0.92,
           hit: { n: 78, speed: 8.4, spread: 0.42, life: 0.36, size: 0.05, cut: 1.25,
                  shard: 20, ember: 12, arc: 1.15, flash: 1.15, flashMs: 0.13 } },
  // A SPELL, which really is radial: this is the one that has earned its ring.
  cast:  { trail: true, reach: 0.34, charge: true,
           hit: { n: 64, speed: 4.4, spread: 1.9, life: 0.9, size: 0.07, ring: 2.2, grav: -0.7,
                  flash: 1.5, flashMs: 0.24 } },
  heal:  { trail: false, charge: true,
           hit: { n: 40, speed: 1.5, spread: 1.6, life: 1.5, size: 0.06, ring: 0.9, grav: 1.5, drag: 1.1 } },
  ward:  { trail: false, charge: true,
           hit: { n: 34, speed: 2.2, spread: 2.4, life: 0.8, size: 0.055, ring: 1.7, grav: -0.4 } },
  // A DEFLECTION is steel on steel: almost no spray, one short bright mark
  // across the line of the blow that was turned aside.
  // A DEFLECTION throws the most metal of anything in the game — it is two
  // edges meeting — but it throws no light: the flash belongs to the blow that
  // lands, and a parry is the blow that did not.
  parry: { trail: false,
           hit: { n: 46, speed: 6.6, spread: 0.34, life: 0.26, size: 0.042, cut: 0.85,
                  shard: 16, ember: 8, arc: 0.62, flash: 0.7, flashMs: 0.12 } },
};

const _fxV = new THREE.Vector3(), _fxD = new THREE.Vector3();
const _travel = new THREE.Vector3();
const _fxQ = new THREE.Quaternion();
const _fxA = new THREE.Vector3(), _fxB = new THREE.Vector3();
const _hitU = new THREE.Vector3(), _hitW = new THREE.Vector3(), _hitS = new THREE.Vector3();
const _hitP = new THREE.Vector3(), _hitD = new THREE.Vector3();
const _hitT = new THREE.Vector3();

// ── THE DIRECTOR ───────────────────────────────────────────────────────────
//
// Holds the pool, the ribbons and the rings, and knows which bone is holding
// what. It is driven entirely by things the layer already knows: which figure
// is acting, which clip it is playing, and where the other side is standing.
// Nothing in game.js has to describe an effect — it says "slash" the way it
// always has, and the air does the rest.
// ── WHAT EACH OF THEM IS HOLDING ──────────────────────────────────────────
//
// The hands were empty. Every clip in the library is a sword swing, a pair of
// daggers or a staff cast, and the figure performing it was miming.
//
// THE GRIP IS DERIVED FROM THE RIG, NOT GUESSED AT. The one axis a hand bone
// reliably gives you is the line out from the elbow through the wrist, and the
// effects rig has used exactly that since it was written — "out along the
// forearm, away from the elbow, where a blade would be". A weapon built along
// its own +Y is turned to lie on that line, in the hand's LOCAL frame, so it
// travels with the wrist through every clip without knowing anything about the
// clip. Using the same axis as the trail also means the two agree, which they
// did not when the trail came off the right hand for a staff Elin swings left.
//
// THE SIZE IS IN METRES AND THE BONE IS NOT. `fit` scales each figure to the
// height the fight needs, so a blade parented to a hand inherits that scale;
// the group divides it back out so a sword is the length it says it is
// whatever size the model arrived at.
// A global multiplier on every light, so the whole scene can be graded from one
// place. It lives out here because `look()` drives the key light too and a
// constant hidden inside the scene builder is a ReferenceError waiting for the
// first person to touch the shade dial — which is exactly what it was.
const EXPOSURE = 1.0;
const WEAPON_HAND = { sword: ['RightHand'], daggers: ['RightHand', 'LeftHand'],
                      staff: ['LeftHand'] };
const STEEL = { colour: 0xb9c2cc, grip: 0x2a2320, gold: 0x8a6f3c };

function bladeMesh(len, wide, thick, colour) {
  // a blade is not a box: it tapers to a point and carries a central ridge, so
  // the two faces catch the light at different angles as it turns over
  const g = new THREE.BufferGeometry();
  const w = wide / 2, t = thick / 2, ric = len * 0.06;
  const v = [
    0, ric, 0,  -w, ric, 0,  0, ric, -t,   w, ric, 0,  0, ric, t,
    0, len, 0,
    -w * 0.35, len * 0.72, 0, w * 0.35, len * 0.72, 0,
  ];
  const f = [
    1, 2, 6,  2, 3, 7,  3, 4, 7,  4, 1, 6,
    6, 2, 5,  2, 7, 5,  7, 3, 5,  3, 6, 5,
    1, 0, 2,  2, 0, 3,  3, 0, 4,  4, 0, 1,
  ];
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setIndex(f);
  g.computeVertexNormals();
  return new THREE.Mesh(g, new THREE.MeshStandardMaterial({
    color: colour, metalness: 0.85, roughness: 0.28, flatShading: true }));
}
function wrap(r, len, colour, rough) {
  return new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.92, len, 8),
    new THREE.MeshStandardMaterial({ color: colour, metalness: 0.15, roughness: rough || 0.8 }));
}
function weaponMesh(kind) {
  const g = new THREE.Group();
  if (kind === 'staff') {
    // Shorter than a real quarterstaff on purpose: gripped low with a metre
    // and a bit above the hand, a full-length one swung a two-metre pole
    // across the whole frame every time she raised her arm to cast.
    const shaft = wrap(0.022, 1.34, 0x4a3a2a, 0.85);
    shaft.position.y = 0.42;
    const head = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.016, 6, 14),
      new THREE.MeshStandardMaterial({ color: STEEL.gold, metalness: 0.9, roughness: 0.3 }));
    head.position.y = 1.10;
    const stone = new THREE.Mesh(new THREE.OctahedronGeometry(0.045, 0),
      new THREE.MeshStandardMaterial({ color: 0x9fd8ff, emissive: 0x2b6d9e,
        emissiveIntensity: 1.4, metalness: 0.2, roughness: 0.15 }));
    stone.position.y = 1.10;
    g.add(shaft, head, stone);
    g.userData.edge = [0.55, 1.10];      // a staff draws from its head, not its length
    return g;
  }
  const dagger = kind === 'daggers';
  const len = dagger ? 0.34 : 0.86;
  const grip = wrap(dagger ? 0.014 : 0.017, dagger ? 0.10 : 0.20, STEEL.grip);
  grip.position.y = dagger ? -0.05 : -0.10;
  const guard = new THREE.Mesh(
    new THREE.BoxGeometry(dagger ? 0.10 : 0.20, 0.026, 0.038),
    new THREE.MeshStandardMaterial({ color: STEEL.gold, metalness: 0.9, roughness: 0.34 }));
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(dagger ? 0.019 : 0.026, 8, 6),
    new THREE.MeshStandardMaterial({ color: STEEL.gold, metalness: 0.9, roughness: 0.34 }));
  pommel.position.y = dagger ? -0.105 : -0.21;
  const blade = bladeMesh(len, dagger ? 0.036 : 0.055, dagger ? 0.010 : 0.016, STEEL.colour);
  g.add(grip, guard, pommel, blade);
  // where the edge starts and ends, so the trail can be the blade rather than
  // a guess hung off the wrist
  g.userData.edge = [0, len];
  return g;
}
// put it in the hand, on the forearm's own axis
function armFigure(f) {
  const kinds = WEAPON_HAND[f.tone.strike];
  if (!kinds || f.tone.foe) return;
  f.weapons = [];
  for (const hand of kinds) {
    const h = f.bones[hand];
    const fore = f.bones[hand === 'LeftHand' ? 'LeftForeArm' : 'RightForeArm'];
    if (!h || !fore) continue;
    h.updateWorldMatrix(true, false); fore.updateWorldMatrix(true, false);
    const a = h.getWorldPosition(new THREE.Vector3());
    const b = fore.getWorldPosition(new THREE.Vector3());
    const dir = a.clone().sub(b).normalize();
    const inv = h.getWorldQuaternion(new THREE.Quaternion()).invert();
    const local = dir.applyQuaternion(inv).normalize();
    // A STAFF RUNS AGAINST THE FOREARM, AND IT IS THE ONLY ONE THAT DOES. A
    // sword extends the arm — a hanging hand points its blade at the floor,
    // which is where a sheathed-length blade belongs. A staff is gripped low
    // with the head UP, so the same axis puts the stone in the paving: shipped
    // once that way and Elin dragged her staff along the ground by its head.
    if (f.tone.strike === 'staff') local.negate();
    const g = weaponMesh(f.tone.strike);
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), local);
    const sc = h.getWorldScale(new THREE.Vector3());
    g.scale.setScalar(1 / Math.max(1e-4, (sc.x + sc.y + sc.z) / 3));
    h.add(g);
    f.weapons.push(g);
  }
}

class Effects {
  constructor(scene) {
    this.sparks = new Sparks(moteTexture());
    this.streak = streakTexture();
    this.shocks = new Shocks();
    this.ribbons = {};
    this.slashMap = slashTexture();
    this.cuts = new Cuts(this.slashMap);
    this.flashes = new Flashes(clashTexture());
    for (const f of this.flashes.items) scene.add(f.mesh);
    this.clash = new Clash();
    for (const c of this.clash.items) scene.add(c.mesh);
    scene.add(this.sparks.points);
    for (const it of this.shocks.items) scene.add(it.mesh);
    for (const it of this.cuts.items) scene.add(it.mesh);
    this.scene = scene;
  }
  // ── AND THE EDGE THROWS OFF LIGHT WHEN IT MOVES ───────────────────────
  //
  // A swing that only draws a band is a decal. Steel travelling fast enough
  // sheds motes from the point, and because the tip's own speed decides it,
  // the shower is dense exactly where the swing is quickest and stops without
  // being told when the follow-through slows down. No new pool: these are the
  // same sparks the impact uses, thrown small, short-lived and nearly weightless
  // so they hang in the arc rather than raining out of it.
  shed(id, tip, dt) {
    const last = (this.tips || (this.tips = {}))[id];
    if (!last) { this.tips[id] = tip.clone(); return; }
    const move = tip.distanceTo(last);
    const speed = move / Math.max(1e-4, dt);
    last.copy(tip);
    // ── THE THRESHOLD IS THE BLADE'S OWN SPEED, MEASURED ──
    //
    // Metres per second of screen time, sampled along each clip at the weapon's
    // tip rather than guessed:
    //
    //     clip           peak   median   p75    frames over 14 m/s
    //     sword          61.8      6.7  12.1          19 of 79
    //     swordHeavy     69.0      5.3  10.5          18
    //     daggers        69.3      8.2  14.2          21
    //     cast           12.6      1.7   5.9           0
    //
    // 14 is above the median swing and above EVERYTHING the spell does, which
    // is the line that matters: a staff gathering light should not throw steel.
    // The first cut used 5, which two thirds of every clip clears — including
    // a third of the cast — and would have shed through the whole library.
    if (speed < 14) return;
    // …spread along the path travelled this frame, so a fast swing does not
    // stack every mote on one point, and more of them the harder it is moving
    const n = Math.min(4, Math.ceil((speed - 14) / 14));
    for (let k = 0; k < n; k++) {
      _fxV.copy(tip).lerp(last, Math.random());
      _fxD.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
      this.sparks.emit(_fxV, _fxD, 1, { speed: 0.8 + Math.random() * 1.4, spread: 1.6,
                                        life: 0.20 + Math.random() * 0.16,
                                        size: 0.018 + Math.random() * 0.016,
                                        grav: -0.6, drag: 3.4 });
    }
  }
  // the world as it was last drawn, passed down to every arc that exists
  behind(tex) { for (const id in this.ribbons) this.ribbons[id].behind(tex); this._behind = tex; }
  ribbonFor(id) {
    if (!this.ribbons[id]) {
      const r = new Ribbon(this.slashMap);
      r.behind(this._behind || null);
      this.scene.add(r.air);
      this.scene.add(r.mesh);
      this.ribbons[id] = r;
    }
    return this.ribbons[id];
  }
  // called every frame for every visible figure: if it is mid-swing, take a
  // sample of where its weapon is
  trail(id, f, dt) {
    const spec = FX_VERB[f.fxVerb];
    const swinging = f.acting && spec && spec.trail;
    if (swinging) {
      const arm = (WEAPON_HAND[f.tone.strike] || ['RightHand'])[0];
      const wrist = f.bones[arm] || f.bones.RightHand;
      const fore = f.bones[arm === 'LeftHand' ? 'LeftForeArm' : 'RightForeArm'];
      // THE ARC IS THE BLADE'S, WHEN THERE IS A BLADE. The weapon group runs
      // along its own +Y, so its `edge` says where the steel starts and stops;
      // pushing those two points is the surface the edge really swept. Without
      // one — a foe, or a figure holding nothing — it falls back to the old
      // guess along the forearm.
      const w = (f.weapons || [])[0];
      if (w && w.userData.edge) {
        w.updateWorldMatrix(true, false);
        const e = w.userData.edge;
        _fxA.set(0, e[0], 0).applyMatrix4(w.matrixWorld);
        _fxB.set(0, e[1], 0).applyMatrix4(w.matrixWorld);
        this.ribbonFor(id).push(_fxA, _fxB, 0);
        this.shed(id, _fxB, dt);
      } else if (wrist) {
        wrist.getWorldPosition(_fxA);
        if (fore) fore.getWorldPosition(_fxB); else _fxB.copy(_fxA).add(_fxD.set(0, 1, 0));
        // out along the forearm, away from the elbow — where a blade would be
        _fxD.copy(_fxA).sub(_fxB).normalize().multiplyScalar(2).add(_fxA);
        this.ribbonFor(id).push(_fxA, _fxD, spec.reach);
      }
    }
    // READ IT AFTER, NOT BEFORE. Looked up at the top of the function this was
    // whatever existed when the frame began — which on the first frame of a
    // swing is nothing, so the sample just taken was never stepped into the
    // mesh and the arc started one frame late every time.
    const r = this.ribbons[id];
    if (r) r.step(dt);
  }
  // the blow lands. `at` is where, `toward` is which way the energy goes.
  // ── THE BLOW LANDS ALONG A LINE, NOT AT A POINT ──────────────────────────
  //
  // Every burst here used to start from one place and spray outward, which is
  // what a bullet does. A sword does not hit a point — it DRAWS one, across the
  // target, and everything that comes off it comes off that line. Emitting from
  // a single spot and hoping the cone reads as a cut is why the impact looked
  // stamped on: a symmetric puff cannot say which way the steel went, however
  // many particles are in it.
  //
  // `cut` is the direction the blade's tip was actually travelling when it
  // arrived — the arc's own tangent, read off the trail the ribbon has been
  // recording all swing. Particles are laid ALONG it, bowed slightly so the
  // line is a curve rather than a rod, and thrown outward from it. The ends of
  // the arc spill along their own direction, which is the thing that reads as a
  // sweep instead of a spray.
  hit(at, toward, verb, power, cut, path, eye) {
    const spec = FX_VERB[verb] || FX_VERB.slash;
    const h = spec.hit;
    const k = Math.max(0.55, Math.min(1.9, power || 1));
    // the cut's own axes: along the arc, and the two ways off it
    const along = _hitU.copy(cut && cut.lengthSq() > 1e-6 ? cut : _hitU.set(0, 1, 0.35))
      .normalize();
    const out = _hitW.copy(toward).normalize();
    // …and a true perpendicular, so the bow of the arc is in the cut's own
    // plane rather than wherever the world's up happens to be
    const side = _hitS.crossVectors(along, out);
    if (side.lengthSq() < 1e-6) side.set(0, 1, 0); else side.normalize();
    const span = (h.arc || 0.9) * (0.75 + k * 0.35);
    // ── THE PATH THE BLADE REALLY TOOK ────────────────────────────────────
    //
    // When the swing has left a trail, everything below is laid on THAT rather
    // than on a straight line through `at` with a bow added to it. A guessed
    // 16%-of-span bow is still a line with a kink in it; the recorded path is
    // the curve the blade actually drew, and it is already known.
    const arcPts = (path && path.length >= 3) ? path : null;
    // where along the recorded path a fraction u lands, u in [-1, 1]
    const onPath = (u, into) => {
      const x = (u * 0.5 + 0.5) * (arcPts.length - 1);
      const i0 = Math.max(0, Math.min(arcPts.length - 2, Math.floor(x)));
      return into.copy(arcPts[i0]).lerp(arcPts[i0 + 1], x - i0);
    };
    // …and which way is "off the blade" there — the tangent's perpendicular in
    // the plane of the blow, so the spray leaves the edge rather than the point
    const offPath = (u, into) => {
      const x = (u * 0.5 + 0.5) * (arcPts.length - 1);
      const i0 = Math.max(0, Math.min(arcPts.length - 2, Math.floor(x)));
      const j0 = Math.max(0, i0 - 1), j1 = Math.min(arcPts.length - 1, i0 + 2);
      _hitT.copy(arcPts[j1]).sub(arcPts[j0]);
      if (_hitT.lengthSq() < 1e-8) return into.copy(out);
      _hitT.normalize();
      return into.crossVectors(_hitT, side).normalize();
    };

    // ── ONE · THE CUT ITSELF, which is most of the particles ───────────────
    const n = Math.round((h.n || 30) * k);
    for (let i = 0; i < n; i++) {
      // biased toward the middle of the stroke, where the steel bit deepest
      const u = (Math.random() + Math.random() - 1);
      if (arcPts) {
        onPath(u, _hitP);
        // off the edge, plus a share along the blade — the ends spill forward,
        // which is what makes a sweep out of a spray
        // ── AND THE ENDS THROW FORWARD ────────────────────────────────
        // A spray that leaves perpendicular everywhere is a line of jets. The
        // tips of a real arc keep the blade's own momentum, so the share of
        // velocity taken from the tangent rises with |u| — nothing at the
        // middle of the stroke where the steel bit straight in, most of it at
        // the points where the edge was already leaving.
        _hitD.copy(offPath(u, _hitD)).multiplyScalar(Math.random() < 0.5 ? 1 : -0.55)
          .addScaledVector(out, 0.55)
          .addScaledVector(along, u * (0.9 + 1.9 * u * u))
          .addScaledVector(side, (Math.random() - 0.5) * 0.35).normalize();
      } else {
        const bow = (1 - u * u) * span * 0.16;
        _hitP.copy(at).addScaledVector(along, u * span * 0.5).addScaledVector(side, bow);
        _hitD.copy(out).addScaledVector(along, u * 1.15)
             .addScaledVector(side, (Math.random() - 0.5) * 0.5).normalize();
      }
      this.sparks.emit(_hitP, _hitD, 1, {
        speed: h.speed * (0.55 + Math.random() * 0.9),
        spread: h.spread,
        life: h.life * (0.6 + Math.random() * 0.9),
        size: h.size * (0.7 + Math.random() * 0.8),
        grav: h.grav, drag: h.drag,
      });
    }

    // ── TWO · WHAT ACTUALLY LEAVES ────────────────────────────────────────
    //
    // One emission can only have one character. The cut spray is many, tight
    // and brief — it reads as the surface giving way. Debris is the opposite of
    // all three: a handful, thrown wide, outliving the moment and falling. The
    // spray makes it look like something happened to a texture; the pieces that
    // fly off and arc down make it look like it happened to a thing.
    if (h.shard) {
      const m = Math.round(h.shard * k);
      for (let i = 0; i < m; i++) {
        const u = Math.random() * 2 - 1;
        if (arcPts) {
          onPath(u * 0.9, _hitP);
          offPath(u, _hitD).multiplyScalar(Math.random() < 0.5 ? 1.3 : -0.8)
            .addScaledVector(out, 0.5).addScaledVector(along, u * 1.3)
            .addScaledVector(side, (Math.random() - 0.5) * 1.1).normalize();
        } else {
          _hitP.copy(at).addScaledVector(along, u * span * 0.45);
          _hitD.copy(out).addScaledVector(along, u * 1.6)
               .addScaledVector(side, (Math.random() - 0.5) * 1.4).normalize();
        }
        this.sparks.emit(_hitP, _hitD, 1, {
          speed: h.speed * (1.3 + Math.random() * 1.1), spread: 0.35,
          life: h.life * (2.2 + Math.random() * 1.6),
          size: h.size * (1.1 + Math.random() * 0.7),
          grav: 5.6, drag: 0.45,
        });
      }
    }

    // ── THREE · AND A FEW THAT HANG ───────────────────────────────────────
    // Slow, small and long-lived, drifting off the line after everything else
    // has gone. Nothing in the fight depends on them; they are the difference
    // between an effect that ENDS and one that settles.
    if (h.ember) {
      for (let i = 0; i < Math.round(h.ember * k); i++) {
        const u = Math.random() * 2 - 1;
        if (arcPts) onPath(u, _hitP);
        else _hitP.copy(at).addScaledVector(along, u * span * 0.55);
        _hitD.copy(side).multiplyScalar(Math.random() - 0.5)
             .addScaledVector(out, 0.35).addScaledVector(along, u * 0.4).normalize();
        this.sparks.emit(_hitP, _hitD, 1, {
          speed: 0.5 + Math.random() * 0.9, spread: 0.8,
          life: h.life * (4.0 + Math.random() * 3.0),
          size: h.size * 0.55, grav: -0.35, drag: 1.9,
        });
      }
    }

    // …and the light, stretched along the cut rather than stamped across it
    if (h.flash) this.flashes.fire(at, h.flash * (0.75 + k * 0.45), h.flashMs || 0.14,
                                   toward, along, span);
    // …AND THE MARK LIES ALONG THE CUT. It was laid along `toward` — the line
    // from the attacker to the target — which is the direction the blow
    // ARRIVED from, not the line the edge drew. A slash mark square across the
    // stroke is the same fault the flash had, and it reads as a bar hung in
    // front of the foe rather than as a wound.
    // …AND IT IS THE SIZE OF THE WOUND, not of the swing. `h.cut` was a flat
    // 1.25 scaled by power — 1.8 metres of mark for a sword, which is longer
    // than the foe is tall and reads as a slab hung in the air. The mark
    // belongs to the arc that made it, so it takes its length from the same
    // span the particles were laid along.
    if (h.cut) {
      // the crescent when the swing left a trail to draw it from; the flat mark
      // only when there is none — a spell, or a creature with no blade
      if (arcPts && eye) this.clash.fire(arcPts, eye, span * h.cut * 0.30, 0.17);
      else this.cuts.fire(at, along, span * h.cut * 0.72, 0.19);
    }
    if (h.ring) this.shocks.fire(at, h.ring * k, verb === 'heal' ? 0.7 : 0.42);
  }
  // a spell gathering in the hand before it goes anywhere
  charge(at, verb) {
    const spec = FX_VERB[verb];
    if (!spec || !spec.charge) return;
    // drawn INWARD: velocity toward the hand, so the motes converge
    for (let i = 0; i < 14; i++) {
      _fxV.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize();
      _fxD.copy(_fxV).multiplyScalar(-1);
      this.sparks.emit(_fxA.copy(at).addScaledVector(_fxV, 0.55), _fxD, 1,
        { speed: 1.9, spread: 0.05, life: 0.42, size: 0.04, grav: 0, drag: 0.4 });
    }
  }
  // ── ASH COMING OFF THE BURN FRONT ──────────────────────────────────────
  //
  // Emitted in a THIN BAND at the height the burn has reached, not from the
  // whole body — which is the difference between a creature crumbling and a
  // creature emitting smoke. The band is where the material is actually
  // discarding fragments this frame, so what leaves the body leaves from the
  // place the body is coming apart.
  //
  // And it goes UP. Everything else in this file falls: sparks off a blade
  // have weight, embers settle, the floor stops them. Ash does not — it is
  // what is left when the weight has burned out of something, so it drifts
  // with a small negative gravity and almost no drag, and it keeps going.
  ash(centre, radius, y, n, heat) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = radius * (0.25 + Math.random() * 0.85);
      _fxA.set(centre.x + Math.cos(a) * r, y + (Math.random() - 0.5) * 0.09,
               centre.z + Math.sin(a) * r * 0.55);
      // outward and up, with a lean so a crowd of them does not rise as a column
      _fxD.set(Math.cos(a) * 0.5, 1, Math.sin(a) * 0.5).normalize();
      this.sparks.emit(_fxA, _fxD, 1, {
        speed: 0.55 + Math.random() * 0.9, spread: 0.5,
        life: 1.5 + Math.random() * 1.4, size: 0.03 + Math.random() * (heat ? 0.055 : 0.025),
        grav: 0.62, drag: 0.55,
      });
    }
  }
  step(dt, cam, px) {
    this.sparks.step(dt);
    this.sparks.mat.uniforms.uPx.value = px;
    this.shocks.step(dt, cam);
    this.cuts.step(dt, cam);
    this.flashes.step(dt, cam);
    this.clash.step(dt);
  }
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
      if (!/homeward=off/.test(location.search)) homeward(rt, meta[name] && meta[name].hit);
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
    // WHICH VERB, not which clip. `sword`, `daggers` and `staff` are three
    // clips for one word, and the air should answer the word.
    this.fxVerb = null;
    // how far through coming apart this body is: null until it is dying
    this.burn = null;
    // ── A BLOW THAT IS BEING AIMED IS A BLOW HALF-THROWN (Build 129) ────────
    //
    // While a card is held over a target the hero is not standing still and is
    // not swinging either — they are WOUND UP, and letting go finishes the
    // motion they already started.
    //
    // Which means the ready pose is not a separate animation. It is the first
    // third of the swing, stopped. That is the whole trick: there is nothing
    // to blend into and nothing to blend out of, because the hold and the
    // follow-through are one clip played in two halves, so releasing cannot
    // pop no matter how long the player took to decide.
    this.holdFrac = 0;      // where in the clip to stop, 0 = not holding
    this.held = false;      // …and whether it has got there yet
    this.wob = 0;
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

  // wind up and stop, at `frac` of the way through the clip
  ready(name, frac) {
    if (!this.play(name)) return false;
    this.holdFrac = frac;
    this.held = false;
    this.wob = 0;
    this.holdAge = 0;
    return true;
  }
  // …and let it go, from exactly where it stopped
  release() {
    if (!this.holdFrac) return false;
    this.holdFrac = 0;
    this.held = false;
    if (this.acting) this.acting.paused = false;
    return true;
  }
  clear() {
    if (this.acting) { this.acting.paused = false; this.acting.fadeOut(0.22); }
    this.holdFrac = 0; this.held = false;
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
    this.fxVerb = null;
  }

  step(dt) {
    // ── HOLD, BUT DO NOT FREEZE ──
    //
    // A paused action still poses the body, so the wind-up simply stays on
    // screen — and a wind-up that is perfectly still for four seconds while
    // the player thinks reads as a crash. The fix cannot be to blend an idle
    // underneath: that is precisely the near-antipodal blend that Build 125
    // measured throwing the hips eighty degrees in a 240th of a second.
    //
    // So the tension comes from INSIDE the same clip. The action's own time
    // breathes a few hundredths of a second either side of the mark, which is
    // a body straining against a held pose and cannot pop, because there is
    // only ever one clip posing the figure.
    if (this.holdFrac && this.acting) {
      // ── AND IT LETS GO BY ITSELF EVENTUALLY ──
      //
      // Every path that ends a drag calls `unready`, and that is exactly the
      // kind of promise that holds until someone adds a ninth path. A hero
      // frozen at the top of a backswing for the rest of a fight is a worse
      // failure than a wind-up that quietly relaxes, so the hold has an outside
      // limit. Nobody deliberates over a card for eight seconds.
      this.holdAge = (this.holdAge || 0) + dt;
      if (this.holdAge > 8) {
        this.clear();                 // …and `clear` has just nulled `acting`
      } else {
        const mark = this.acting.getClip().duration * this.holdFrac;
        if (!this.held && this.acting.time >= mark) {
          this.held = true;
          this.acting.paused = true;
        }
        if (this.held) {
          // ── AND IT STRAINS FORWARD, NEVER BACKWARD ────────────────────────
          //
          // The breath was `mark + sin(t) * 0.042`, clamped at zero. That was
          // written when the mark sat a third of the way into a long procedural
          // clip and had 400ms of room either side of it. The Unreal clips open
          // in a ready stance and commit immediately, so every one of their
          // wind marks is around 0.03 — sword's is 40ms into a 1.17s swing, and
          // the breath is 42. The hold was therefore swinging BELOW the mark
          // for half of every cycle and clamping at 0: the held pose flickered
          // back to the clip's first frame and out again, about three times a
          // second, on every attack in the game.
          //
          // A wind-up strains toward the blow, not away from it. Raised cosine
          // rather than sine, so the travel is [mark, mark + amp] and the mark
          // is the floor rather than the middle — and the amplitude takes
          // whatever room the clip actually left, so a wind mark 40ms in gets a
          // small strain and one half a second in gets the full one.
          this.wob += dt;
          const amp = Math.min(0.042, mark * 0.55 + 0.004);
          this.acting.time = mark + (1 - Math.cos(this.wob * 2.3)) * 0.5 * amp;
        }
      }
    }
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
    // ── THE BODY TAKES THE TRAVEL, NOT THE FEET (Build 135) ────────────────
    //
    // The clips travel: a sword judgment steps into the blow, a knock-down
    // falls over backwards. Build 112 pinned the hips in the horizontal plane
    // so a figure could not walk out of frame, and its comment says this throws
    // the travel away.
    //
    // It does not throw it away. It TRANSFERS IT TO THE FEET. The legs go on
    // animating a stride the body never takes, so the planted foot slides along
    // the floor instead of the floor going past the body — measured at up to
    // 1.49 m of travel on a foot that is bearing weight, which is most of what
    // reads as a body moving wrongly.
    //
    // So the horizontal motion is lifted off the hips and given to the ROOT,
    // where it belongs. The figure genuinely steps into the blow, the foot that
    // is down stays down, and the slot easing in `frame` walks it back to its
    // mark afterwards — a lunge and a recovery rather than a skate.
    if (this.hips && this.hipRest) {
      const hx = this.hips.position.x, hz = this.hips.position.z;
      if (this.lastHip) {
        const dx = hx - this.lastHip.x, dz = hz - this.lastHip.z;
        // a clip that restarts jumps the hips a long way in one frame; that is
        // a cut, not a step, and moving the whole body by it would teleport it
        if (Math.abs(dx) < 6 && Math.abs(dz) < 6) {
          _travel.set(dx, 0, dz).applyQuaternion(this.root.quaternion)
                 .multiplyScalar(this.unit || 0);
          this.root.position.x += _travel.x;
          this.root.position.z += _travel.z;
        }
        this.lastHip.x = hx; this.lastHip.z = hz;
      } else {
        this.lastHip = { x: hx, z: hz };
      }
      this.hips.position.x = this.hipRest.x;
      this.hips.position.z = this.hipRest.z;
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // EVERY CLIP STANDS ON THE SAME FLOOR
  // ══════════════════════════════════════════════════════════════════════
  //
  // Measured on Ash and Mira alike, the lowest either ankle gets over a whole
  // clip:
  //
  //   idle        0.105 m        parry        0.105 m
  //   sword       0.257 m        swordHeavy   0.259 m
  //
  // The sword clips never put a foot on the ground. Not once, over their whole
  // length: their lowest ankle sits fifteen centimetres above the height a
  // foot rests at, so the hero swings while hovering. That is most of what is
  // left of "the characters slide" — a body whose feet never touch cannot look
  // planted whatever the root does underneath it, and every attempt to fix the
  // sliding by moving the root was working on the wrong end of the problem.
  //
  // It also slipped past the suite for a hundred builds because the check that
  // watches foot height asks whether anybody SINKS INTO the paving. Nobody
  // was. They were floating over it, and a one-sided test cannot see that.
  //
  // The rule is the one sentence that has to be true of every clip: THE LOWEST
  // A FOOT GETS IS THE HEIGHT A FOOT RESTS AT. Measured off the idle, which is
  // the pose the whole rig is built around, and applied as a constant shift to
  // the clip's own hips track.
  //
  // A clip that genuinely leaves the ground needs no exception and gets none:
  // a leap still touches down at takeoff and landing, so its lowest frame is
  // already at rest height and its shift comes out at zero. Only a clip that
  // never lands is moved, which is the definition of the fault.
  settle() {
    // THE LOWEST POINT OF THE FOOT, NOT THE ANKLE. Grounding on the ankle
    // alone leaves a pointed toe below the paving — swordHeavy put one 1.6cm
    // under — because how far the toe hangs below the ankle depends on the
    // pose. Whichever of the four bones gets lowest is the one that has to
    // touch.
    const feet = ['LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase']
      .map(n => this.bones[n]).filter(Boolean);
    if (feet.length < 2 || !this.hips || !this.idle) return;
    const low = (a) => {
      const clip = a.getClip(), dur = clip.duration;
      for (const k of Object.keys(this.actions)) {
        this.actions[k].setEffectiveWeight(0); this.actions[k].stop();
      }
      a.reset(); a.setEffectiveWeight(1); a.play(); a.paused = true;
      let y = Infinity;
      for (let i = 0; i < SETTLE_N; i++) {
        a.time = dur * i / (SETTLE_N - 1);
        this.mixer.update(0);
        this.root.updateMatrixWorld(true);
        for (const b of feet) y = Math.min(y, b.matrixWorld.elements[13]);
      }
      a.setEffectiveWeight(0); a.stop(); a.paused = false;
      return y;
    };
    const unit = this.unit;
    if (!(unit > 0)) return;
    const rest = low(this.idle);
    if (!isFinite(rest)) return;
    this.settled = {};
    for (const name of Object.keys(this.actions)) {
      if (name === 'idle') continue;
      const a = this.actions[name];
      const t = a.getClip().tracks.find(x => x.name === 'Hips.position');
      if (!t) continue;
      const y = low(a);
      if (!isFinite(y)) continue;
      const drop = y - rest;                       // metres of hover
      if (Math.abs(drop) < 0.02) continue;         // 2cm is nobody's problem
      const shift = drop / unit;                   // …into the track's own units
      for (let i = 1; i < t.values.length; i += 3) t.values[i] -= shift;
      this.settled[name] = +(drop * 100).toFixed(1);   // centimetres, for the suite
    }
    this.mixer.stopAllAction();
    if (this.idle) { this.idle.reset(); this.idle.setEffectiveWeight(IDLE_WEIGHT); this.idle.play(); }
  }

  // ── AND THEN THE FEET ARE MADE HONEST ──────────────────────────────────
  //
  // Runs after the slot ease has put the root where it is finally going this
  // frame, because a foot pinned to a world position is only pinned if the
  // world position is the one that gets drawn.
  //
  // The plant test is deliberately about HEIGHT and nothing else. Testing
  // speed would be circular — the whole point is that the foot is moving when
  // it should not be — and testing the clip's own contact marks would need
  // every clip annotated by hand. A foot near the floor is bearing weight; a
  // foot in the air is not; and a figure that is entirely in the air, which
  // swordHeavy genuinely is for part of its leap, owes nobody a planted foot.
  footLock(dt) {
    if (!this.bones.LeftFoot || !this.bones.RightFoot) return;
    const legs = this._legs || (this._legs = [
      { hip: this.bones.LeftUpLeg,  knee: this.bones.LeftLeg,  ankle: this.bones.LeftFoot,
        w: 0, at: new THREE.Vector3(), down: false },
      { hip: this.bones.RightUpLeg, knee: this.bones.RightLeg, ankle: this.bones.RightFoot,
        w: 0, at: new THREE.Vector3(), down: false },
    ]);
    if (!legs[0].hip || !legs[0].knee || !legs[1].hip || !legs[1].knee) return;
    this.root.updateMatrixWorld(true);

    // WHERE THE FLOOR IS, MEASURED. The lowest either ankle has been lately,
    // allowed to rise 12cm a second so it follows the ground rather than
    // remembering the one frame a knock-down put an ankle on the paving.
    let lowest = Infinity;
    for (const g of legs) {
      g.y = _ikA.setFromMatrixPosition(g.ankle.matrixWorld).y;
      lowest = Math.min(lowest, g.y);
    }
    this.floorY = this.floorY === undefined ? lowest
      : Math.min(lowest, this.floorY + dt * 0.12);

    for (const g of legs) {
      const h = g.y - this.floorY;
      // hysteresis, so a foot resting exactly on the threshold does not
      // chatter in and out of contact from one frame to the next
      if (g.down ? h > FOOT_OFF : h < FOOT_ON) g.down = !g.down;
      if (g.down && g.w <= 0) g.at.setFromMatrixPosition(g.ankle.matrixWorld);
      const want = g.down ? 1 : 0;
      g.w += Math.max(-1, Math.min(1, (want - g.w))) * Math.min(1, dt / FOOT_RAMP);
      if (g.w <= 0.001) { g.w = 0; continue; }
      // The pin is horizontal only: the height is the animation's to decide,
      // and holding that too would stop a heel from lifting. And the pin's
      // weight moves the TARGET rather than scaling the solve — see reachLeg.
      _ikT.setFromMatrixPosition(g.ankle.matrixWorld);
      _ikT.x += (g.at.x - _ikT.x) * g.w;
      _ikT.z += (g.at.z - _ikT.z) * g.w;
      if (!reachLeg(g.hip, g.knee, g.ankle, _ikT)) {
        // ── OUT OF REACH: THE STRIDE HAS OUTRUN THE PLANT ─────────────────
        //
        // The anchor is retaken where the animation has the foot now, which is
        // what a step is. Two more considered answers, both measured, both
        // worse:
        //
        //   Releasing the plant and letting the pin fade out over its ramp
        //   leaves the foot unpinned for the whole of a long stride, and the
        //   glide simply comes back — sword 0.39m up to 0.83, swordHeavy 1.07
        //   up to 2.74.
        //
        //   Crawling the anchor toward the foot at a walking pace, to avoid
        //   the jump, broke a clip that had nothing wrong with it: heal went
        //   from 0.03m of glide to 0.78 and its worst frame from 0.1 m/s to
        //   13, because an anchor that is always chasing is never actually
        //   holding anything.
        //
        // What this costs is honest and small: the retake is a jump, so two
        // clips keep a single-frame spike higher than they have without the
        // solver. Set against every clip in the game giving up between a third
        // and all of its glide, that is the trade to take.
        g.at.setFromMatrixPosition(g.ankle.matrixWorld);
      }
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════
// THE FOOT THAT IS DOWN STAYS DOWN
// ══════════════════════════════════════════════════════════════════════════
//
// Build 153 took the loud half of the sliding out — the one-to-two metre yank
// home after every swing, at about eight metres per second under a standing
// idle. What it could not touch is the quiet half, and `slide.probe.cjs` has
// been reporting it all along: these clips slide ON THEIR OWN, before anything
// in this file touches them. Taking the slower of the two feet at each instant
// — which is the support foot, and which a body on its feet keeps still —
// swordHeavy gives up 1.79m of ground at a 14.35 m/s peak and daggersHeavy
// 1.53m at 10.59, against 0.03-0.07m and under 0.6 m/s for cast, heal, ward,
// parry and idle. That is mocap foot skate baked into the source, and no
// amount of root-motion arithmetic reaches it: the travel is not wrong, the
// FEET are, and the only thing that fixes a foot is moving the leg.
//
// So: while a foot is bearing weight its world position is pinned, and the leg
// is solved to reach it. Two bones, closed form, no solver iteration.
//
// WHAT MAKES THIS SAFE RATHER THAN A NEW SOURCE OF WRONGNESS:
//
//   · The anchor GIVES. If the hips travel far enough that the leg would have
//     to stretch past its own length to keep the foot, the plant is dropped
//     and re-taken where the animation has the foot now. That is not a
//     failure case bolted on the side — it is how a stride works, and it is
//     what keeps the system from ever asking for a pose the skeleton cannot
//     hold.
//   · Nothing accumulates. Every frame solves from the animated pose fresh,
//     so a bad frame is one bad frame and never a drift.
//   · The floor is MEASURED, not declared. A hero is 1.78m and a creature is
//     2.00m and their ankles rest at different heights, so a constant would be
//     wrong for somebody. Each figure tracks the lowest its own ankles get and
//     lets that estimate rise slowly, which follows the floor and recovers
//     after a knock-down without ever needing to be told a number.
const _ikA = new THREE.Vector3(), _ikB = new THREE.Vector3(), _ikC = new THREE.Vector3();
const _ikT = new THREE.Vector3(), _ikU = new THREE.Vector3(), _ikV = new THREE.Vector3();
const _ikN = new THREE.Vector3(), _ikF = new THREE.Vector3(), _ikG = new THREE.Vector3();
// the target gets its own vector and is copied into it on entry. The first
// cut used a shared scratch for both the target and the hip-to-target length,
// so the very first line that measured the distance OVERWROTE the target with
// (target - hip) and every step after it aimed at a point that did not exist.
// It drove feet through the paving — daggers put an ankle 19cm underground —
// and it read on the probe as a huge improvement, because the floor reference
// is the lowest a foot gets and burying one drops it, which reclassifies
// ordinary frames as flight and quietly drops them out of the average.
const _ikTT = new THREE.Vector3();
const _ikQ = new THREE.Quaternion(), _ikP = new THREE.Quaternion();
const _ikW = new THREE.Quaternion(), _ikX = new THREE.Quaternion();
const _ikI = new THREE.Quaternion();
// how near the measured floor an ankle has to be to count as bearing weight,
// and how far it has to rise to stop counting. The gap is what stops a foot
// resting on the threshold from chattering in and out of contact.
const FOOT_ON = 0.075, FOOT_OFF = 0.135;
const FOOT_RAMP = 0.09;               // seconds to fade a pin in or out
const SETTLE_N = 26;                  // frames sampled to find a clip's lowest foot

// turn a rotation expressed in WORLD space into the bone's local quaternion.
// A bone's rotation orients everything below it about the bone's own origin,
// which is the joint — so this is the whole of "bend the knee" and "swing the
// leg from the hip" once the right world rotation is known.
function turnBone(bone, qWorld) {
  bone.getWorldQuaternion(_ikW);
  _ikW.premultiply(qWorld);
  if (bone.parent) { bone.parent.getWorldQuaternion(_ikP); _ikP.invert(); }
  else _ikP.identity();
  bone.quaternion.copy(_ikP.multiply(_ikW)).normalize();
  bone.updateMatrixWorld(true);
}

// hip -> knee -> ankle, solved so the ankle lands on `target`. Returns false if
// the target is out of reach, which is the caller's cue to let the foot go.
//
// THE SOLVE IS ALWAYS EXACT AND THE BLEND LIVES IN THE TARGET. Fading a pin in
// by scaling the two ROTATIONS looks equivalent and is not: at part weight the
// knee no longer sets the exact length, so the aim — which only fixes the
// direction — lands the ankle short of or PAST the target along the ray. Past
// it is below the floor, because the target sits below and ahead of the hip,
// and that is precisely what it did: daggers put a foot 16cm through the
// paving and swordHeavy 14. Interpolating the target between where the
// animation put the foot and where the pin wants it cannot overshoot anything,
// because every target it is ever given is a place the foot could be.
function reachLeg(hip, knee, ankle, target) {
  _ikTT.copy(target);
  hip.updateWorldMatrix(true, false);
  _ikA.setFromMatrixPosition(hip.matrixWorld);
  _ikB.setFromMatrixPosition(knee.matrixWorld);
  _ikC.setFromMatrixPosition(ankle.matrixWorld);
  const L1 = _ikA.distanceTo(_ikB), L2 = _ikB.distanceTo(_ikC);
  if (!(L1 > 1e-4 && L2 > 1e-4)) return false;
  const want = _ikG.copy(_ikTT).sub(_ikA).length();
  // OUT OF REACH IS A STEP, NOT AN ERROR. Past 98% of the leg's own length the
  // knee is locked straight and the ankle is as far away as it can get; asking
  // for more would only pull the hips or tear the pose.
  if (want > (L1 + L2) * 0.98 || want < Math.abs(L1 - L2) + 1e-3) return false;
  // the foot's own orientation is the animation's business, not ours: whatever
  // the leg does underneath it, the sole keeps pointing where it was pointing
  ankle.getWorldQuaternion(_ikX);

  // ── one · the knee bends until the chain spans the distance ──
  const now = _ikC.distanceTo(_ikA);
  const c1 = (L1 * L1 + L2 * L2 - want * want) / (2 * L1 * L2);
  const c0 = (L1 * L1 + L2 * L2 - now * now) / (2 * L1 * L2);
  const d = Math.acos(Math.max(-1, Math.min(1, c1)))
          - Math.acos(Math.max(-1, Math.min(1, c0)));
  if (Math.abs(d) > 1e-5) {
    _ikU.copy(_ikA).sub(_ikB);
    _ikV.copy(_ikC).sub(_ikB);
    _ikN.crossVectors(_ikU, _ikV);
    // a leg straight enough that its bend plane is undefined has no knee angle
    // worth correcting either — leave it to the aim
    if (_ikN.lengthSq() > 1e-8) {
      _ikN.normalize();
      _ikQ.setFromAxisAngle(_ikN, d);
      turnBone(knee, _ikQ);
      _ikC.setFromMatrixPosition(ankle.matrixWorld);
    }
  }

  // ── two · the whole limb swings from the hip until the ankle is on it ──
  _ikF.copy(_ikC).sub(_ikA);
  _ikG.copy(_ikTT).sub(_ikA);
  if (_ikF.lengthSq() > 1e-8 && _ikG.lengthSq() > 1e-8) {
    _ikQ.setFromUnitVectors(_ikF.normalize(), _ikG.normalize());
    turnBone(hip, _ikQ);
  }

  // …and put the sole back the way the animation had it
  ankle.getWorldQuaternion(_ikW);
  _ikQ.copy(_ikX).multiply(_ikW.invert());
  turnBone(ankle, _ikQ);
  return true;
}

// ── the layer ──────────────────────────────────────────────────────────────
const Cast3D = (() => {
  let on = false, ready = false, failed = null;
  let renderer = null, scene = null, cam = null, canvas = null;
  let ground = null, reflect = null, mirror = null;
  let fx = null;
  const sized = { w: 0, h: 0, dpr: 0 };
  const figs = {};
  let last = 0, raf = 0, pending = null, clipNames = [], missing = [];
  // the clip library outlives `load` now: a creature mounted an hour into a
  // run is built from the same parsed clips the party was built from
  let clips = {}, windows = {}, meta = {}, restSrc = {}, parentOf = {};
  const fetching = {};
  let warming = null, unloaded = [];
  // ── A FIGURE PER SLOT, A MODEL PER CREATURE (Build 130) ──────────────────
  //
  // Until now `figs` was keyed by creature: one `husk` figure, one `mourner`
  // figure. That is fine for a board with one opponent on it and wrong the
  // moment the road deals two of the same creature — which it has been able to
  // do since Build 101. Two Hollow Husks share `data-foe="husk"`, so `nodeOf`'s
  // querySelector found only the first, and there was only ever one body to
  // find it with anyway. Both of them fought the party as flat paintings.
  //
  // So the two ideas are separated. A MODEL is a downloaded GLB, one per
  // creature, cached here and shared. A FIGURE is somebody standing in a slot
  // on the board, and a slot is what the DOM says it is: the party's three
  // heroes by name, and the foe line by its index. Two husks are two figures
  // wearing two clones of one model.
  const models = {};                 // creature id -> the loaded gltf
  const wearing = {};                // slot key -> which creature it is wearing
  const FOE_SLOTS = 4;               // #k-boss-art plus the three the line can add
  const foeKey = (ix) => 'foe' + (ix || 0);

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
  // ── A SHOT MAY BE A MOVE, NOT A MARK (Build 126) ─────────────────────────
  //
  // Every shot here used to be a single pose. The tripod eased toward it, got
  // there, and STOPPED — which is why a parry looked like a lineup: three
  // figures the same size, level with the lens, holding still, in a frame that
  // had finished moving before the player had to do anything. game.js said so
  // in its own comment at the call site: "one composition, held for the whole
  // bar".
  //
  // So a shot may now carry `to` — a second pose — and `over`, the milliseconds
  // it takes to travel there. The tripod's target is no longer a fixed mark but
  // a point sliding between the two, which means the camera is still moving
  // when the beat lands rather than parked and waiting for it. `over` is
  // smoothstepped, so the move starts and ends calm and does its travelling in
  // the middle; a camera that begins at full speed reads as a glitch.
  //
  // Two more fields, both of which a camera operator would call basic and this
  // rig simply did not have:
  //
  // `roll` — the cant. It existed only as a CSS handheld offset, which meant a
  // SHOT could not be composed with one. A level horizon is a calm horizon, and
  // every shot in the game had one.
  //
  // `fov` — the lens. `toScreen` reads the live projection matrix, so the DOM
  // followers track a lens change for free and nothing needs to be told. A
  // wide lens up close is the whole difference between three people standing at
  // different distances and three people at different SIZES, which is what
  // depth reads as. Everything defaults to FOV, the lens the CSS pinhole was
  // measured at, so `home` is untouched.
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
    // …and it keeps swinging while the three of them commit, rather than
    // arriving and watching.
    allout:    { az:  40, dist: 7.60, height: 2.60, aimY: 1.38, roll: 3, fov: 52,
                 at: 'board',
                 to: { az: 26, dist: 6.70, height: 2.15, aimY: 1.44, roll: -1.5, fov: 55 },
                 over: 2200 },
    // …and where it goes once all three have committed: down onto the line of
    // them, low and wide, so the blows land in frame rather than after it. The
    // all-out used to hand the camera back BEFORE the damage was dealt — the
    // shot was over and the board was home by the time anything was hit.
    alloutland:{ az: -46, dist: 5.40, height: 1.10, aimY: 1.42, roll: -5, fov: 60,
                 at: 'foe',
                 to: { az: -22, dist: 6.30, height: 1.85, aimY: 1.40, roll: 0, fov: 55 },
                 over: 1600 },
    // ── THE PARRY, WHICH IS THE ONE MOMENT THE PLAYER HAS TO ACT ──────────
    //
    // It was az -13, dist 5.10, height 1.42: thirteen degrees off dead centre
    // and twenty-eight centimetres below eye line, which is the home shot with
    // a nudge. Held still, on a dimmed board, it framed the party as a row of
    // equal-sized figures in profile.
    //
    // Now it starts wide of the line and well under — low enough that the
    // party's shoulders are above the lens and whatever is swinging at them
    // comes DOWN into frame — and then arcs back toward the axis while rising
    // and pushing in over the length of the bar. The cant unwinds through the
    // move, from six degrees down on the left to nearly level, so the frame
    // settles exactly as the player has to read it.
    //
    // A 58° lens at 4.4 m is a much wider angle than the board's own 51.2° at
    // 7.35, and that is the point: this close, the near hero is half again the
    // size of the far one and the rank finally has depth in it.
    //
    // WHAT IT DELIBERATELY DOES NOT DO is whip. This is a rhythm defence — the
    // one screen where the player must read a moving bar and press on time — so
    // the move is long, continuous and slow enough to be furniture rather than
    // an event. Dynamism here means the frame is alive, not that it is hard to
    // read.
    // AND IT HAS TO CONTAIN THE THING BEING PARRIED. `at: 'party'` framed the
    // three of them beautifully and left whatever was swinging at them off the
    // edge: the player was asked to answer a blow they could not see. The
    // caller passes the defender and the body aiming at them, so the lens sits
    // between the two and the exchange is in one frame — pulled back a little
    // and widened, because two ranks need more room than one.
    parry:     { az: -36, dist: 5.20, height: 0.98, aimY: 1.62, roll: -6, fov: 60,
                 at: 'party',
                 to: { az: -14, dist: 4.55, height: 1.36, aimY: 1.56, roll: 1.5, fov: 63 },
                 over: 3200 },
    // AFTER THE KILL, stand back up and take the room in — as a slow crane
    // rather than a cut to a wide. The whole point of the reckoning is that the
    // fight has stopped; a camera that eases upward for four seconds says that
    // better than any frame it could hold.
    reckoning: { az:  12, dist: 7.90, height: 2.05, aimY: 1.36, roll: 0, fov: 53,
                 at: 'board',
                 to: { az: 23, dist: 9.10, height: 2.95, aimY: 1.24, roll: 0, fov: 50 },
                 over: 4000 },

    // ── AND THE SHOTS A SINGLE ACTION ASKS FOR (Build 122) ───────────────────
    // Shorter, closer, and always transient: each of these is a beat, not a
    // stance, and each is asked for with `{ for: ms }`.
    // A BLOW LANDING, and the camera goes in with it. The pose was fine and
    // completely inert: the tripod arrived during the wind-up and was standing
    // still by the time the blade did anything. Now it drifts across the line
    // and closes half a metre over the length of the swing, so the frame is
    // travelling when the hit lands. Short, because the beat is short.
    // ── A STRIKE IS TWO PEOPLE ──────────────────────────────────────────
    //
    // This was `at: 'foe'`: the lens aimed at what was being hit and held there
    // for the whole beat. Measured, that put the swinging hero at 0.02 of the
    // frame's width — hard against the left edge — and the other two off it
    // entirely. The player watched the enemy while their own hero swung out of
    // shot. The blow landing is half of what a strike is; who threw it is the
    // other half.
    //
    // The caller passes both names and `aimPoint` averages them, so the lens
    // sits between attacker and target and the swing travels ACROSS the frame
    // into the thing it hits. That needs more room than one figure did — hence
    // further back and wider — and it stays a push-in, because a strike should
    // still close on the moment of contact.
    strike:    { az: -18, dist: 6.40, height: 1.44, aimY: 1.52, roll: -2.5, fov: 58,
                 at: 'foe',
                 to: { az: -7, dist: 5.70, height: 1.30, roll: 1, fov: 60 },
                 over: 900 },
    // …and mercy is the opposite shot in every respect — further back, higher,
    // on the party rather than on what it is hitting, because a heal is not an
    // impact and a camera that treats it like one flattens both
    grace:     { az:  17, dist: 6.30, height: 2.20, aimY: 1.48, at: 'party' },
    // THE KILLING BLOW: low, close, swung well off the line, so the last thing
    // a creature does happens to somebody rather than in a diagram — and then
    // the camera keeps arcing round it as it goes down, rising a little, the
    // cant unwinding. Nearly two seconds of continuous move, which is the one
    // place in the fight that can afford it.
    fell:      { az: -58, dist: 4.30, height: 0.92, aimY: 1.30, roll: -7, fov: 60,
                 at: 'foe',
                 to: { az: -34, dist: 5.20, height: 1.66, aimY: 1.14, roll: 0, fov: 55 },
                 over: 1850 },
    // ── AND THE SHOTS A DUO AND A TRIO ASK FOR (Build 138) ──────────────────
    //
    // These are the only shots in the table whose `at` is left out, because
    // they are always sent with one: a duo shot is ABOUT the two people
    // throwing it and a relay shot is about whoever answers. That is what the
    // named-subject `at` is for.
    //
    // COMMIT is the first half of a duo: low, off the line, close enough that
    // the hero filling it reads as a person rather than a rank, and pushing in
    // while they wind up.
    commit:    { az: -30, dist: 3.90, height: 1.24, aimY: 1.44, roll: -4, fov: 58,
                 to: { az: -20, dist: 3.40, height: 1.30, roll: -1, fov: 60 },
                 over: 800 },
    // ANSWER is the cut: the other side of the line, the opposite cant, and it
    // arrives already moving. Cutting to a still frame after a moving one is
    // what makes a cut read as a mistake.
    answer:    { az:  34, dist: 3.60, height: 1.16, aimY: 1.46, roll: 6, fov: 60,
                 to: { az: 18, dist: 4.30, height: 1.44, roll: 0, fov: 55 },
                 over: 1000 },
    // TOGETHER is the frame that holds them BOTH, and it is the reason a duo
    // gets three shots rather than two: two singles say "one, then the other",
    // and the third says "and that was one thing".
    together:  { az: -12, dist: 5.20, height: 1.86, aimY: 1.50, roll: 0, fov: 54,
                 to: { az: -2, dist: 5.90, height: 2.05, roll: 0, fov: 52 },
                 over: 1100 },
    // A DEFLECTION IS A FRACTION OF A SECOND, so its shot is nearly a cut — and
    // the little it has time to do is snap back toward level, which reads as
    // the frame recoiling off the block.
    snap:      { az: -24, dist: 4.05, height: 1.44, aimY: 1.54, roll: -9, fov: 62,
                 at: 'party',
                 to: { az: -16, dist: 4.35, height: 1.50, roll: -1, fov: 58 },
                 over: 560 },
  };
  // where a shot may be aimed. `party` and `foe` are read off the world rather
  // than written down, so a shot follows whoever is actually standing there.
  // ── …AND A SHOT CAN BE ABOUT A PERSON (Build 138) ────────────────────────
  //
  // `at` has been able to say `party`, `foe`, `board` or a literal world point
  // since Build 119, and that is everything a shot needs as long as a shot is
  // about a SIDE. A duo card is not: it is two named people doing one thing,
  // and framing it means holding on one of them and then whipping to the other.
  // There was no way to say that.
  //
  // So an array of NAMES is a shot's subject — one person, or the midpoint of
  // several — while an array of numbers stays the literal point it always was.
  // Nothing had to be added to the shot table: `at: ['ash', 'mira']` is a
  // two-shot, and it follows them if they move, because it is read off the
  // world every frame like the sides are.
  function aimPoint(at) {
    if (Array.isArray(at) && typeof at[0] === 'string') {
      let n = 0, x = 0, z = 0;
      for (const id of at) {
        const f = figs[id];
        if (!f || !f.root.visible) continue;
        x += f.root.position.x + (f.ctrOff || 0); z += f.root.position.z; n++;
      }
      // a shot about somebody who is not on the board is a shot about the board
      if (n) return [x / n, 0, z / n];
      return BOARD;
    }
    if (Array.isArray(at)) return at;
    if (at === 'party' || at === 'foe') {
      const want = at === 'foe';
      let n = 0, x = 0, z = 0;
      for (const id of Object.keys(figs)) {
        const t = figs[id].tone;
        if (!!t.foe !== want || !figs[id].root.visible) continue;
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
  // ── A COLOUR TEXTURE HAS TO SAY IT IS ONE ────────────────────────────────
  //
  // three treats a texture as LINEAR unless told otherwise, and every one of
  // these is a painting: authored in sRGB, saved in sRGB. Loaded without the
  // tag they are never decoded, so the encode at the end of the shader lifts
  // them a second time and the whole plaza comes up washed. It went unnoticed
  // while the painterly treatment ran after the encode and hid it.
  function loadTex(url) {
    return new Promise((res, rej) => new THREE.TextureLoader().load(url, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      res(t);
    }, undefined, rej));
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
    // ── LIGHT THAT BELONGS TO THIS WORLD (Build 133) ─────────────────────
    //
    // What was here: a WHITE ambient at 0.88 and a WHITE key at 1.45. That is
    // two thirds of the light in the scene arriving from nowhere, with no
    // colour and no direction — every shadow filled flat, every form softened,
    // nothing to separate a grey cloak from a grey wall. "Bland" is the exact
    // right word for it, and the cause is the ambient rather than the key.
    //
    // The world is a flooded plaza under a low sun: warm light coming in along
    // the ground from the lit end of the street, cool sky bouncing off wet
    // stone everywhere else. So the flat ambient becomes a HEMISPHERE — cool
    // above, warm-dark below, which is what standing on wet stone under an open
    // sky actually does — and it drops to a third of its old strength so there
    // are shadows to model with.
    //
    // Warm key, cool fill. It is the oldest rule in the book and this scene had
    // neither half of it.
    // …AND IT HAS TO BE BRIGHT ENOUGH TO SEE (Build 134). Build 133 traded a
    // flat white 0.88 ambient for a coloured hemisphere at 0.34 — the right
    // shape and too little of it, so the modelling arrived and the figures went
    // muddy against a bright painted backdrop. The plate behind them is lit
    // daylight; the bodies in front of it have to live in the same exposure.
    // ── EXPOSURE, AND WHY IT IS NOT 1 ────────────────────────────────────
    //
    // The painterly treatment used to run AFTER three's encode, so its output
    // went to the screen unconverted. Moving it before the encode — which is
    // what made the post pass reconcilable at all — means the same light now
    // gets the sRGB lift applied to it, and the plaza came up 43% brighter than
    // the look it was authored at (mean luminance 0.391 against 0.274).
    //
    // These lights are linear and the transfer is not, so the correction is not
    // 0.70: it is 0.70 raised to 2.2. Measured back to the frame it was, rather
    // than assumed.
    const hemi = new THREE.HemisphereLight(0xc3d4ea, 0x4b3f34, 0.62 * EXPOSURE);
    scene.add(hemi);
    scene.userData.hemi = hemi;
    const k = new THREE.DirectionalLight(0xffe3b8, 2.75 * EXPOSURE);
    // LOW AND ALONG THE STREET, not overhead. At (4.5, 7.5, 5.0) the sun was
    // almost straight above the party, which throws a puddle of shadow under
    // each figure and models nothing. Dropped to a raking angle, the same light
    // rims the tops of shoulders, finds the folds in a cloak, and throws the
    // long shadows the plaza has been drawing on its floor since Build 119.
    k.position.set(7.5, 4.2, 3.4);
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
    // the cool counter, from behind and low, so a body has an edge against the
    // mist rather than dissolving into it
    const r = new THREE.DirectionalLight(0x8ba6cf, 1.25 * EXPOSURE);
    r.position.set(-6, 2.4, -5);
    // …and a dim warm bounce up off the water, which is the one light this
    // scene has a physical reason to expect and did not have
    const b = new THREE.DirectionalLight(0xd8a06a, 0.48 * EXPOSURE);
    b.position.set(1.5, -3, 4);
    scene.add(k, r, b);
    scene.userData.key = k;
    scene.userData.rim = r;
    scene.userData.bounce = b;
    // what each light is worth at full strength, so a focus can take them down
    // and put them back without anybody writing the numbers twice
    LIGHT_FULL.hemi = hemi.intensity;
    LIGHT_FULL.key = k.intensity;
    LIGHT_FULL.rim = r.intensity;
    LIGHT_FULL.bounce = b.intensity;

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
        // …and the same rule as the figures: the water goes on BEFORE the
        // encode. It matters twice here, because `uRefl` is itself a render
        // target and three forces those to linear — so blending a linear
        // reflection into an already-encoded floor was mixing two different
        // spaces every frame, on top of making the whole pass unreconcilable.
        + sh.fragmentShader.replace('#include <colorspace_fragment>', `
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
        gl_FragColor.rgb = mix( gl_FragColor.rgb, mirrored * 0.72, k );`)
        .replace('#include <fog_fragment>',
                 '#include <fog_fragment>\n#include <colorspace_fragment>');
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
    mistTex.colorSpace = THREE.SRGBColorSpace;
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
    // the effects live in the scene, which is the whole point of them: same
    // depth buffer as the bodies, and the reflection pass picks them up free
    fx = new Effects(scene);
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
    // ── HAZE, AND HOW MUCH OF IT THE PICTURE CAN AFFORD ──
    //
    // 0.0285 put a wall of pale grey between the camera and everything, and
    // once the colour pipeline was corrected it read as a whiteout. What haze
    // costs is not brightness, it is the BLACKS: measured over the drawing
    // buffer, the 5th percentile sat at 0.237 — nothing in the frame was ever
    // dark. Thinning it to 0.009 pulls that floor down to 0.184 and leaves the
    // spread alone, which is clarity arriving without the depth going away.
    //
    //     density   mean    5th pct   95th pct
    //     0.0285    0.365     0.237      0.605
    //     0.0200    0.345     0.211      0.584
    //     0.0140    0.333     0.194      0.565
    //     0.0090    0.324     0.184      0.554
    //     0.0050    0.319     0.177      0.553   ..and it stops paying here
    scene.fog = new THREE.FogExp2(0x9aa0a6, 0.009);

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

  // ── EVERYTHING THAT IS NOT A BODY ────────────────────────────────────────
  //
  // Two different places render one figure alone and read the pixels back —
  // `fit`, which measures a silhouette at load, and `_cover`, which asks how
  // much of a body is left mid-burn. Both are only correct if NOTHING else in
  // the scene is drawing, and this list has now been got wrong three times in
  // three builds: Build 122 added an arcade, rubble and mist and moved the
  // Regent a quarter of a metre; Build 128 added a spark pool, a ribbon per
  // figure and five shock rings, and a ring fired at the Regent a moment
  // earlier put 73 pixels of "body" back into a finished burn.
  //
  // The pattern is not carelessness, it is that the list lived in the function
  // that used it, so adding scenery anywhere else could not remind anybody. It
  // is derived now, from the scene as it actually is.
  function notBodies() {
    const out = ground
      ? [ground, ground.userData.panel, ground.userData.haze,
         ground.userData.props, ground.userData.mist]
      : [];
    if (fx) {
      out.push(fx.sparks.points);
      for (const k of Object.keys(fx.ribbons)) out.push(fx.ribbons[k].mesh);
      for (const it of fx.shocks.items) out.push(it.mesh);
      for (const it of fx.cuts.items) out.push(it.mesh);
    }
    return out.filter(Boolean);
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
    const world = notBodies();
    for (const o of world) o.visible = false;
    const fogWas = scene.fog; scene.fog = null;

    // ── AND IT HAS TO KNOW WHETHER IT WORKED ────────────────────────────────
    //
    // The loop below recovers from a frame that came back empty by doubling
    // `viewH` and trying again — sensible, except that it then RETURNS whatever
    // it last had whether or not that converged. A measurement that failed is
    // indistinguishable from one that succeeded, and the figure is scaled and
    // dropped by it regardless.
    //
    // Seen in the wild: the Ashen Cultist standing 0.72 m above the floor in
    // one suite run and 0.06 in the next, from the same model on the same seed.
    // A figure hanging in the air is exactly what an unconverged fit looks
    // like, and the reason it is intermittent is that it depends on what else
    // the renderer was doing during the two frames this borrows.
    //
    // So: try, check, and if the silhouette did not land near FILL, start over
    // from a clean guess. Two attempts is enough — the pass loop converges in
    // three or four from anywhere sane, and a second failure means something is
    // wrong that a third would not fix either.
    let converged = false;
    for (let attempt = 0; attempt < 2 && !converged; attempt++) {
      if (attempt) { f.viewH = 2.0; f.midX = 0; f.midY = 0.9; }
    for (let pass = 0; pass < 6; pass++) {
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
      if (Math.abs(h - FILL) < 0.015) { converged = true; break; }
      f.viewH *= h / FILL;
    }
    }
    f.fitOk = converged;

    renderer.setRenderTarget(prevTarget);
    renderer.setViewport(vpWas);
    renderer.setScissorTest(scissorWas);
    for (const o of world) o.visible = worldWas;
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
  function mount(key, castId, gltf) {
    const tone = CAST[castId];
    // EVERY SLOT GETS ITS OWN BODY. The cached gltf is the pattern, never the
    // thing on stage — hand the same scene graph to two slots and they share a
    // skeleton, which is one puppet standing in two places.
    const root = cloneSkinned(gltf.scene);
    let map = null;
    root.traverse(o => {
      if (o.isMesh || o.isSkinnedMesh) map = map || o.material.map || o.material.emissiveMap;
    });
    const mat = watercolour(map, tone);
    root.traverse(o => {
      if (o.isMesh || o.isSkinnedMesh) { o.material = mat; o.frustumCulled = false; o.castShadow = true; }
    });
    root.scale.setScalar(tone.tall);
    // WHAT RANGE DOES `transformed` ACTUALLY COVER? Ask the geometry, once,
    // here — the union of every mesh's own bounding box in the model's own
    // space. This is the range the burn front has to travel, and no two of
    // these eight models agree on it.
    let lo = Infinity, hi = -Infinity;
    root.traverse(o => {
      if (!(o.isMesh || o.isSkinnedMesh) || !o.geometry) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const b = o.geometry.boundingBox;
      if (!b) return;
      lo = Math.min(lo, b.min.y); hi = Math.max(hi, b.max.y);
    });
    if (isFinite(lo) && hi > lo) {
      mat.userData.foot.value = lo;
      mat.userData.tall.value = hi - lo;
    }
    root.userData.mat = mat;
    // `frame` decides who is visible, from who is on screen; a creature that
    // arrives while nothing is wearing it must not flash up in the middle of
    // the floor for the one frame before that runs.
    root.visible = false;
    scene.add(root);
    wearing[key] = castId;
    const f = figs[key] = new Figure(root, tone, clips, restSrc, parentOf, windows, meta);
    f.cast = castId;
    armFigure(f);                        // a sword clip wants a sword in it
    // one frame of the idle, so the measurement sees a standing figure rather
    // than whatever the bind pose happens to be
    f.step(0.016);
    // aim BEFORE framing: turning a figure changes its silhouette, and the
    // frame is measured from the silhouette
    const side = tone.side || 1;
    aim(f, side * FOE_HEADING - side * tone.turn);
    fit(f);
    stand(key);
    return f;
  }

  // …and taking a slot down again, when the fight replaces who stands there
  function unmount(key) {
    const f = figs[key];
    if (!f) return;
    scene.remove(f.root);
    if (fx && fx.ribbons[key]) { scene.remove(fx.ribbons[key].mesh); delete fx.ribbons[key]; }
    delete figs[key];
    delete wearing[key];
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
  function stand(key) {
    const f = figs[key];
    const tone = f.tone;
    const h0 = f.viewH * FILL;                       // metres, as generated
    const s = (tone.metres || TALL_M[tone.foe ? 'foe' : 'hero']) / h0;
    f.root.scale.multiplyScalar(s);
    f.worldH = h0 * s;
    f.ctrOff = f.midX * s;                           // it is not centred either
    f.root.position.y = -(f.midY - h0 / 2) * s;      // soles to the floor
    const slot = slotOf(key) || STAGE.hero.front;
    f.root.position.x = slot[0] - f.ctrOff;
    f.root.position.z = slot[1];
    f.root.updateWorldMatrix(true, true);
    // HOW MANY METRES IS ONE UNIT OF HIP TRAVEL? Measured off the bone rather
    // than assumed: these models carry a unit conversion of about 0.01 in a
    // node above the skeleton, and it lands differently per character once each
    // has been rescaled to the height the fight wants.
    if (f.hips) f.unit = f.hips.getWorldScale(_travel).x;
    f.lastHip = null;
    // …AND ONLY NOW CAN THE CLIPS BE STOOD ON THE FLOOR. `settle` measures how
    // far a clip hovers in METRES and shifts its hips track in rig units, so it
    // needs the conversion between them — which is not known until the figure
    // has been scaled to the height this fight wants, three lines above.
    f.settle();
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
  function want(castId) {
    if (!CAST[castId] || models[castId] || missing.indexOf(castId) >= 0) return Promise.resolve();
    if (fetching[castId]) return fetching[castId];
    return (fetching[castId] = new GLTFLoader().loadAsync(ART + CAST[castId].model)
      .then(g => { models[castId] = g; }, () => { missing.push(castId); }));
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
      meta[name] = { beat: lib[name].beat, loop: !!lib[name].loop,
                     hit: lib[name].hit, wind: lib[name].wind };
    }
    clipNames = Object.keys(clips);

    const ids = Object.keys(CAST);
    const party = ids.filter(id => !CAST[id].foe);
    await Promise.all(party.map(want));
    // a hero's slot is their own name — there is only ever one of each
    for (const id of party) if (models[id]) mount(id, id, models[id]);
    ready = true;

    unloaded = ids.filter(id => CAST[id].foe);
    warming = unloaded.slice()
      .reduce((p, id) => p.then(() => want(id)), Promise.resolve());
  }

  // WHICH CREATURE IS THIS SLOT WEARING? Heroes are their own creature and
  // always have been; a foe slot is wearing whatever the fight last put in it.
  function castOf(key) {
    if (CAST[key]) return CAST[key];
    const id = wearing[key];
    return id ? CAST[id] : null;
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
    // A HERO IS A NAME; A FOE IS A PLACE. `#k-boss-art` is where the first
    // opponent has always stood and carries no `data-ix`; the line adds the
    // rest with one each. Asking by `data-foe` found the first element wearing
    // that creature, which is the same element for both of a matched pair.
    if (CAST[id]) return document.querySelector(CAST[id].sel);
    const ix = +String(id).slice(3) || 0;
    return ix === 0 ? document.getElementById('k-boss-art')
                    : document.querySelector('#k-cast .k-foe-art[data-ix="' + ix + '"]');
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
    const tone = castOf(id) || (figs[id] && figs[id].tone);
    if (tone && tone.foe) {
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
  // every pose is filled out to the same shape, so nothing downstream has to
  // ask whether a shot happened to mention its lens
  const POSE = ['az', 'dist', 'height', 'aimY', 'roll', 'fov'];
  function full(shot) {
    const o = { roll: 0, fov: FOV };
    for (const k of POSE) if (shot[k] !== undefined) o[k] = shot[k];
    o.at = shot.at; o.to = shot.to; o.over = shot.over;
    return o;
  }
  const TRIPOD = Object.assign(full(SHOTS.home), { atP: BOARD.slice() });
  const SHOT = full(SHOTS.home);
  // ── A MOMENT MAY TAKE THE CAMERA, BUT IT MAY NOT KEEP IT ───────────────────
  //
  // A phase lasts until the phase changes; an ACTION lasts about a second. If
  // both set the shot the same way, the first sword swing of the fight parks
  // the camera on the Regent's shoulder for the rest of the turn. So a shot
  // asked for with `{ for: ms }` is transient: it plays, and when its time is
  // up the camera returns to whatever the phase had it doing — remembered here
  // rather than re-sent, so an action never has to know what it interrupted.
  const BASE = full(SHOTS.home);
  let holdUntil = 0;
  let shotSpeed = 1.6;
  // the pending steps of a cut list, and a flag so the list's own calls into
  // `shot` are not mistaken for somebody interrupting it
  const cutTimers = [];
  let cutting = false;
  function cutStop() { while (cutTimers.length) clearTimeout(cutTimers.pop()); }
  // when the current shot began, so a move knows how far through it is
  let shotAt = 0;
  const _eye = new THREE.Vector3(), _look = new THREE.Vector3();
  const _size = new THREE.Vector2();
  const _burnAt = new THREE.Vector3();
  const LIGHT_FULL = {};
  // ── THE PARRY DIMS THE WORLD, NOT THE PICTURE (Build 133) ────────────────
  //
  // `k-parry-focus` and `k-slowmo` put a CSS filter on the stage's children —
  // and `#k-cast` lives inside `#k-field`, which IS one of those children. So
  // the whole 3D world went down as a single element: the party, the plaza and
  // THE CREATURE SWINGING AT YOU, all to 34% brightness and 5% saturation.
  // A screenshot of a parry is a black rectangle with one yellow ring in it,
  // and the attack the ring is asking you to answer is invisible.
  //
  // `.k-hero.k-parrying { filter: none }` was the escape hatch for this and it
  // stopped working the day the figures became pixels in a canvas rather than
  // elements of their own.
  //
  // So the dim moves inside. The scene's own lights come down, which darkens
  // the plaza and the mist and everything standing in them — and whoever the
  // moment is ABOUT keeps a light of their own.
  // ── TIME, WHICH THE WORLD DID NOT HAVE (Build 136) ───────────────────────
  //
  // `parrySlowmo` has toggled `k-slowmo` since Build 22 and its comment calls it
  // "Clair-Obscur slow-mo: the instant a note becomes tappable, time dilates".
  // What the class does is `animation-play-state: paused` on the stage's
  // children — it stops CSS keyframes. The 3D world is a canvas driven by a
  // requestAnimationFrame loop, and no CSS property has ever touched it, so the
  // one place the fight actually happens ran at full speed through every
  // dilation. The bar slowed; the swing did not.
  //
  // Slowing is a factor on dt, and it eases rather than steps: time arriving at
  // a third of its speed between two frames is a stutter, and time sliding into
  // a third of its speed is the effect the game has been claiming for a hundred
  // builds.
  let slowLevel = 1, slowWant = 1;
  let focusLevel = 1, focusWant = 1;
  const focusOn = {};
  const _spot = { light: null };
  // HOW FAR INTO EACH SWING THE WIND-UP ENDS. Read off the clips rather than
  // chosen: the library's windows already trim each action down to the part
  // where something happens (Build 121), so a third of the way in is the top
  // of the backswing for a sword and the gather for a spell. A ward has almost
  // no wind-up — the arm goes up and stays up — so it holds later, near the
  // top of the guard, which is the pose that reads as "braced".
  const READY_AT = { slash: 0.34, cast: 0.38, heal: 0.30, ward: 0.52 };
  // long enough to read as a body coming apart rather than a sprite being
  // switched off, short enough that it is over before the reckoning wants the
  // camera. The `fell` shot is 1900ms; this finishes inside it.
  const BURN_SECONDS = 1.45;
  // how much room a charge leaves between itself and what it is charging, in
  // metres. The front rank stands about 2.1 from the foe line.
  const LUNGE_KEEP = 1.15;
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  // AZIMUTH TAKES THE SHORT WAY ROUND. Easing 350 degrees to 10 by subtracting
  // sends the camera the long way through everything behind it; a shot is a
  // move a camera operator could make, so it takes the shorter arc every time.
  // scratch for the moving mark, so a move costs no allocation per frame
  const MARK = { az: 0, dist: 0, height: 0, aimY: 0, roll: 0, fov: 0, at: 'board' };
  function shortWay(d) {
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    return d;
  }
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
      shotAt = now();                 // and if the stance is a move, from its top
      shotSpeed = 1.25;               // ease back rather than cut back
    }
    const cs = getComputedStyle(host);
    const n = (k) => { const v = parseFloat(cs.getPropertyValue(k)); return isNaN(v) ? 0 : v; };
    WANT.x = n('--cam-x'); WANT.y = n('--cam-y'); WANT.dz = n('--cam-dz');
    WANT.r = n('--cam-r'); WANT.yaw = n('--cam-yaw'); WANT.pitch = n('--cam-pitch');
    const k = Math.min(1, dt * 7.5);
    for (const key of Object.keys(RIG)) RIG[key] += (WANT[key] - RIG[key]) * k;

    // ── WHERE THE SHOT IS RIGHT NOW ──
    //
    // A plain shot is a mark and this reads it straight through. A shot with a
    // `to` is a MOVE: the mark itself slides from one pose to the other across
    // `over` milliseconds, and the tripod chases a target that is still going
    // somewhere. Smoothstepped, so it accelerates out of the first pose and
    // decelerates into the second instead of starting at full speed.
    let mark = SHOT;
    if (SHOT.to && SHOT.over) {
      const p = Math.min(1, Math.max(0, (now() - shotAt) / SHOT.over));
      const e = p * p * (3 - 2 * p);
      mark = MARK;
      for (const key of POSE) {
        const a0 = SHOT[key], a1 = SHOT.to[key] !== undefined ? SHOT.to[key] : a0;
        mark[key] = key === 'az' ? a0 + shortWay(a1 - a0) * e : a0 + (a1 - a0) * e;
      }
      mark.at = SHOT.at;
    }

    // ── the tripod walks to its mark ──
    const ks = Math.min(1, dt * shotSpeed * 2.6);
    const target = aimPoint(SHOT.at);
    TRIPOD.az = easeAngle(TRIPOD.az, mark.az, ks);
    for (const key of ['dist', 'height', 'aimY', 'roll', 'fov'])
      TRIPOD[key] += (mark[key] - TRIPOD[key]) * ks;
    // the lens is part of the composition, and the DOM followers read the live
    // projection matrix, so nothing else has to be told it changed
    if (Math.abs(cam.fov - TRIPOD.fov) > 0.01) {
      cam.fov = TRIPOD.fov;
      cam.updateProjectionMatrix();
    }
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
    // the shot's own cant, plus whatever the handheld is doing
    cam.rotateZ((RIG.r + TRIPOD.roll) * D);
    cam.updateMatrixWorld();
  }

  // ═══ THE FRAME IS DRAWN OVER (Build 140) ═════════════════════════════════
  //
  // Everything the look had until now was PER OBJECT: a wash on a body, a
  // shadow under it, air on the back ranks. None of that can draw the thing
  // that actually makes a picture read as drawn — A LINE WHERE TWO THINGS
  // MEET. A contour belongs to the pair of surfaces either side of it, and no
  // shader running on one of them knows the other is there. It exists only
  // once the whole frame does.
  //
  // So the world goes to a target with its depth kept, and one full-screen
  // pass finds the contours in that depth and lays them over the colour. Three
  // things, in the order a person would do them: draw the line, step the tone
  // onto a ladder, then let the paper's tooth through.
  //
  // THE ALPHA IS CARRIED THROUGH UNTOUCHED, which is not a detail: the canvas
  // is transparent where the world is not, and the DOM stage shows through it.
  // A pass that wrote opaque black into those pixels would put a box over the
  // hand of cards.
  let post = null, postScene = null, postCam = null, postMat = null;
  // ── TWO TARGETS, BECAUSE ONE CANNOT BE READ WHILE IT IS WRITTEN ──────────
  //
  // The blade arcs refract by sampling the frame the world is drawn into, and
  // they are drawn INSIDE that world so they keep their depth test. Handing
  // them the target currently bound is a feedback loop, and the driver does
  // not quietly do something approximate — it drops the draw and says
  // "Feedback loop formed between Framebuffer and active Texture", which is
  // exactly what the first cut of this did on every frame of every swing.
  // So the world alternates between two targets and the arcs read the other
  // one: last frame's world, a sixtieth of a second stale, which at the speed
  // an arc moves is a fraction of one of its twenty-two segments.
  let postB = null, postWarm = false;
  function inkWanted() {
    // ABS, because the debug views drive the line dial NEGATIVE and a gate
    // that reads `> 0.002` skips the pass entirely — which showed the plain
    // render and made two different debug modes produce identical histograms.
    return Math.abs(LOOK.line) > 0.002 || LOOK.flat > 0.002 || LOOK.tooth > 0.002;
  }
  // the one the arcs may read: whichever the world was drawn into LAST time,
  // and nothing at all until a frame has actually been put in it
  function postPrev() { return postWarm ? postB : null; }
  // …and a switch for it, because a system that changes every pose in the game
  // has to be measurable against its own absence. `?foot=off` is how the slide
  // probe reads the before and the after in one session.
  let _footIK = !/(^|[?&])foot=off(&|$)/.test(location.search);
  function footIK() { return _footIK; }
  function postTarget() {
    const w = Math.max(2, Math.round(sized.w * sized.dpr));
    const h = Math.max(2, Math.round(sized.h * sized.dpr));
    // …and the pair swaps before the size check, so a resize throws away the
    // stale one rather than handing the arcs a target of the wrong shape
    const t = post; post = postB; postB = t;
    if (post && post.width === w && post.height === h) return post;
    postWarm = false;
    if (post) { post.dispose(); if (post.depthTexture) post.depthTexture.dispose(); }
    // ── AND THE TARGET HOLDS LINEAR LIGHT, SO IT CANNOT BE EIGHT BITS ──
    //
    // three forces a render target to LinearSRGB, so what lands here is linear
    // and the encode happens on the way out. Eight bits of LINEAR is the one
    // combination that does not work: the transfer spends most of its
    // precision on the highlights, so the darks — which is most of this game —
    // arrive quantised to a handful of levels and come back banded and lifted.
    // Half-float costs memory and nothing else.
    post = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType });
    post.texture.minFilter = THREE.LinearFilter;
    post.texture.magFilter = THREE.LinearFilter;
    // ── THE TARGET ENCODES THE WAY THE CANVAS DOES ─────────────────────────
    //
    // `renderer.outputColorSpace` applies when drawing to the CANVAS and not
    // when drawing to a target, which defaults to linear. So simply routing the
    // frame through here and back changed every pixel in it — and the first
    // three cuts of this pass read that as the ink covering 64% of the picture
    // and went hunting through the edge detector for a fault that was never
    // there. The screenshots where turning the line on made everything dark
    // were gamma, not ink.
    // ── THE TARGET STAYS LINEAR, AND THE PASS ENCODES ON THE WAY OUT ──
    //
    // This line used to say SRGBColorSpace, on the theory that the target
    // should hold what the canvas would have held. It should not. With a linear
    // target the scene's own materials write linear light into it, the pass
    // samples linear light — which is the space its arithmetic wants anyway —
    // and `colorspace_fragment` at the end of the pass does the one conversion
    // the picture needs. Marking it sRGB put a conversion on the way in that
    // nothing undid, and the pass then halved the brightness of the whole game:
    // mean luminance 0.150 against 0.274 rendered straight to the canvas, with
    // 52% of the frame crushed into the darkest eighth of the range against 5%.
    post.texture.colorSpace = THREE.LinearSRGBColorSpace;
    // A DEPTH TEXTURE IS THE WHOLE POINT. Without one the pass could only find
    // edges in the colour, which draws a line around every pattern in the
    // paving and none between a hero and the wall they are standing against.
    post.depthTexture = new THREE.DepthTexture(w, h);
    post.depthTexture.format = THREE.DepthFormat;
    post.depthTexture.type = THREE.UnsignedIntType;
    return post;
  }
  function postPass() {
    if (postMat) return postMat;
    postMat = new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tDiffuse: { value: null }, tDepth: { value: null },
        uTexel: { value: new THREE.Vector2() },
        uLine: { value: 0 }, uLineW: { value: 1 }, uFlat: { value: 0 },
        uSteps: { value: 6 }, uTooth: { value: 0 },
        uBite: { value: 0.07 }, uReach: { value: 11 },
        uNear: { value: 0.1 }, uFar: { value: 100 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform sampler2D tDepth;
        uniform vec2 uTexel;
        uniform float uLine, uLineW, uFlat, uSteps, uTooth, uNear, uFar;
        uniform float uBite, uReach;
        varying vec2 vUv;

        // the depth buffer is not linear; a difference in it means something
        // different a metre away than it does ten, so it is converted before
        // anything is compared
        float lin(vec2 uv) {
          float d = texture2D(tDepth, uv).x;
          float z = d * 2.0 - 1.0;
          return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
        }
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        void main() {
          vec4 src = texture2D(tDiffuse, vUv);
          // A LINE DIAL BELOW -4.5 HANDS THE TEXEL STRAIGHT BACK, doing no
          // arithmetic of any kind. If the picture still changes at that
          // setting, the fault is in sampling and writing rather than in
          // anything this shader computes — and two guesses at which colour
          // conversion was missing had already been wrong in both directions.
          // …and the bands below that try one candidate encoding each, so the
          // one that makes the pass transparent can be MEASURED rather than
          // argued for. Every analytic account of what three does to a sample
          // and to a write has so far contradicted the next reading.
          if (uLine < -8.5) { gl_FragColor = vec4(pow(max(src.rgb, vec3(0.0)), vec3(1.0 / 1.5)), src.a); return; }
          if (uLine < -7.5) { gl_FragColor = vec4(pow(max(src.rgb, vec3(0.0)), vec3(2.2)), src.a); return; }
          if (uLine < -6.5) { gl_FragColor = vec4(pow(max(src.rgb, vec3(0.0)), vec3(1.0 / 2.2)), src.a); return; }
          if (uLine < -5.5) { gl_FragColor = vec4(src.rgb * src.a, src.a); return; }
          if (uLine < -4.5) { gl_FragColor = src; return; }
          vec3 col = src.rgb;
          vec2 o = uTexel * uLineW;

          // ── THE CONTOUR ──
          // A four-tap cross rather than a full Sobel: half the samples, and on
          // a line this thin the diagonals add nothing a player can see.
          float c  = lin(vUv);
          float dl = lin(vUv - vec2(o.x, 0.0));
          float dr = lin(vUv + vec2(o.x, 0.0));
          float du = lin(vUv - vec2(0.0, o.y));
          float dd = lin(vUv + vec2(0.0, o.y));

          // THE SECOND DERIVATIVE, IN METRES, AGAINST A THRESHOLD THAT GROWS
          // WITH DISTANCE.
          //
          // A depth GRADIENT is not a discontinuity: a floor at a grazing angle
          // changes depth fast across every pixel of it and is not an edge
          // anywhere. So the operator is a Laplacian — a linear ramp cancels in
          // dl + dr - 2c and only a step survives.
          //
          // The threshold used to be a RATIO of that curvature to the local
          // slope, on the theory that it needed no constant tuned to a scene.
          // It is scale-free and it does not work: it thresholds in a smooth
          // band, and the signal is not smooth. Captured a real depth frame out
          // of a running fight and measured the operator over the drawn pixels:
          //
          //     percentile   50th   90th   97th   99th   99.5th
          //     laplacian       0      1      7    227      263   (of 255, over a 14 m ramp)
          //
          // Nothing at all, then a cliff between the 97th and the 99th. On a
          // distribution shaped like that a smooth band cannot separate a
          // contour from a surface at any setting, which is why the ratio form
          // inked 64% of the frame however it was tuned. What separates them is
          // a hard cut anywhere in the gap — 7 counts is 0.38 m, 227 is 12.5 m.
          //
          // It is scaled by depth rather than left absolute because one pixel
          // spans more world the further away it is: the same 0.38 m that is a
          // silhouette on a body five metres out is ordinary floor curvature
          // across the far side of the plaza. Dividing by c is the distance
          // falloff, and it is one number (uBite) with a meaning — the fraction
          // of its own distance a surface has to jump to earn a line.
          // NO BACKTICKS IN HERE — this shader is inside a template literal.
          float lap = max(abs(dl + dr - 2.0 * c), abs(du + dd - 2.0 * c));
          float bite = uBite * c;
          float line = smoothstep(bite, bite * 2.0, lap);

          // …and where nothing was drawn there is nothing to outline. The far
          // plane is not a surface; without this the whole world gets a border
          // and the sky gets a frame.
          float solid = step(c, uFar * 0.94);
          // THE INK HAS A RANGE. Arcane draws the two people talking, not every
          // roof behind them — past uReach metres the line lets go and the back
          // of the plaza stays paint. Without it the detector is honest and the
          // picture is still wrong: a correct contour on every distant railing
          // reads as clutter, not as drawing.
          float near = 1.0 - smoothstep(uReach, uReach * 1.6, c);
          line *= solid * near * uLine;

          // ── THE TONE, ON A LADDER ──
          // Stepped by LUMINANCE and reapplied as a ratio, so a red sash steps
          // with the same rungs as a grey wall and stays red. Quantising each
          // channel on its own is what turns a painting into a poster.
          //
          // AND ONLY ON THE PART OF THE PICTURE THAT IS BUILT, which is what
          // the contour's own distance falloff already carries. The plaza behind the party is
          // a painting already; running a six-rung ladder over it put a hard
          // horizontal seam across the sky and flattened brushwork that was
          // doing its job. The figures are the thing that reads as rendered,
          // and they are the thing worth pushing onto the ladder.
          float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
          float stepped = floor(lum * uSteps + 0.5) / uSteps;
          col = mix(col, col * (stepped / max(0.0025, lum)), uFlat * near);

          // ── THE PAPER ──
          // In the drawing buffer's own pixels, so it stays the sheet the
          // picture is on rather than a texture floating in the world.
          float tooth = hash(floor(vUv / uTexel * 0.5)) - 0.5;
          col += tooth * uTooth;

          // the ink is a constant, not a swatch anybody will pick
          col = mix(col, vec3(0.169, 0.149, 0.133), clamp(line, 0.0, 1.0));

          // A NEGATIVE LINE DIAL SHOWS THE DEPTH INSTEAD. Tuning a threshold
          // against an input nobody has looked at is how the first two cuts of
          // this detector went: one fired on shading, one on something else,
          // and both were tuned rather than diagnosed.
          if (uLine < -3.5) col = vec3(lap);
          else if (uLine < -2.5) col = vec3(smoothstep(bite, bite * 2.0, lap) * solid * near);
          else if (uLine < -1.5) col = vec3(texture2D(tDepth, vUv).x);
          // a clean ramp over the stage's own depth range, so a capture of it
          // can be composited offline at a readable precision
          else if (uLine < -0.5) col = vec3(clamp((lin(vUv) - 2.0) / 14.0, 0.0, 1.0));

          gl_FragColor = vec4(col, src.a);
          // ── AND THREE PUTS IT BACK INTO THE SCREEN'S ENCODING ──
          //
          // THE PASS HAS TO PUT BACK WHAT SAMPLING TOOK OUT, and hand-rolling
          // that conversion was wrong three times running. Measured, as the
          // frame's mean luminance against the same frame rendered straight to
          // the canvas (0.2762):
          //
          //     raw, no conversion   0.1524   -0.124
          //     pow(1/2.2)           0.4017   +0.126
          //     pow(2.2)             0.0268   -0.249
          //     pow(1/1.5)           0.2713   -0.005
          //
          // 1/1.5 fits, and fitting an exponent is how a constant with no
          // meaning gets shipped and then turns out to be wrong on a browser
          // whose colour plumbing differs. This chunk is the mechanism every
          // built-in material uses: three expands it to whatever conversion the
          // CURRENT output actually needs, so it stays right when the target,
          // the canvas or the library changes underneath it.
          //
          // The debug bands above return before this on purpose — a passthrough
          // that is quietly converted cannot answer what the conversion is.
          #include <colorspace_fragment>
        }
      `,
    });
    postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    postScene = new THREE.Scene();
    postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat));
    return postMat;
  }
  function drawInk(t) {
    const m = postPass();
    m.uniforms.tDiffuse.value = t.texture;
    m.uniforms.tDepth.value = t.depthTexture;
    m.uniforms.uTexel.value.set(1 / t.width, 1 / t.height);
    m.uniforms.uLine.value = LOOK.line;
    m.uniforms.uLineW.value = LOOK.linew;
    m.uniforms.uBite.value = Math.max(0.002, LOOK.bite);
    m.uniforms.uReach.value = Math.max(0.5, LOOK.reach);
    m.uniforms.uFlat.value = LOOK.flat;
    m.uniforms.uSteps.value = Math.max(2, Math.round(LOOK.steps));
    m.uniforms.uTooth.value = LOOK.tooth;
    m.uniforms.uNear.value = cam.near;
    m.uniforms.uFar.value = cam.far;
    renderer.render(postScene, postCam);
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
    const real = last ? Math.min(0.25, (now - last) / 1000) : 0.016;
    last = now;
    // the dial itself moves in REAL time — otherwise slowing down would slow
    // down the act of slowing down, and the ease would never arrive
    if (Math.abs(slowWant - slowLevel) > 0.002)
      slowLevel += (slowWant - slowLevel) * Math.min(1, real / 0.12);
    const dt = real * slowLevel;

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

    // ── EASE THE FOCUS ──
    //
    // Never a cut. A parry opens with the world going down over about a fifth
    // of a second, which reads as the light being pulled off everything else
    // rather than as a lamp being switched.
    if (Math.abs(focusWant - focusLevel) > 0.002) {
      focusLevel += (focusWant - focusLevel) * Math.min(1, dt / 0.18);
      const sd = scene.userData;
      if (sd.hemi) sd.hemi.intensity = LIGHT_FULL.hemi * (0.26 + 0.74 * focusLevel);
      if (sd.key) sd.key.intensity = LIGHT_FULL.key * (0.24 + 0.76 * focusLevel);
      if (sd.rim) sd.rim.intensity = LIGHT_FULL.rim * (0.30 + 0.70 * focusLevel);
      if (sd.bounce) sd.bounce.intensity = LIGHT_FULL.bounce * (0.20 + 0.80 * focusLevel);
    }
    // whoever the moment is about stays lit; everybody else rides the level
    for (const id of Object.keys(figs)) {
      const mat = figs[id].root.userData.mat;
      if (!mat || !mat.userData.lit) continue;
      const want = focusOn[id] ? 1 : (0.34 + 0.66 * focusLevel);
      const has = mat.userData.lit.value;
      if (Math.abs(want - has) > 0.002) mat.userData.lit.value = has + (want - has) * Math.min(1, dt / 0.18);
    }

    rig(host, dt);

    // WHICH ELEMENTS ARE WEARING A FIGURE THIS FRAME. An element only gives up
    // its painting to a model that is actually standing on it — see `nodeOf` —
    // so the claim is made here, per frame, rather than assumed once at load.
    // ── WHO IS ACTUALLY ON THE BOARD? ──
    //
    // The fight owns the line: it builds an element per opponent and stamps the
    // creature on it. This reads that back every frame and makes the world
    // agree — a slot with nobody in it loses its body, a slot wearing a
    // different creature than last turn gets a new one, and a slot whose model
    // has not arrived asks for it.
    //
    // Doing it per frame rather than on a signal is what makes two Hollow Husks
    // work without the fight knowing the 3D layer exists. It is four
    // querySelectors on a board that changes twice a minute.
    for (let ix = 0; ix < FOE_SLOTS; ix++) {
      const key = foeKey(ix);
      const node = ix === 0 ? document.getElementById('k-boss-art')
                            : document.querySelector('#k-cast .k-foe-art[data-ix="' + ix + '"]');
      const live = node && node.offsetParent !== null;
      const castId = live ? node.dataset.foe : null;
      if (!live || !castId || !CAST[castId] || !CAST[castId].foe) {
        if (figs[key]) unmount(key);
        continue;
      }
      if (figs[key] && wearing[key] !== castId) unmount(key);
      if (!figs[key]) {
        if (models[castId]) mount(key, castId, models[castId]);
        else if (missing.indexOf(castId) < 0) want(castId);
      }
    }

    const claimed = [];
    for (const id of Object.keys(figs)) {
      const f = figs[id];
      f.step(dt);
      const node = nodeOf(id);
      // A CREATURE THAT BURNED AWAY STAYS AWAY. Visibility is decided fresh
      // every frame from who is on screen, which is right for everything
      // except a body that no longer exists — without this the ash finishes
      // rising and the corpse blinks back for the rest of the fight.
      const here = !!node && node.offsetParent !== null;
      const vis = !f.dead && here;
      f.root.visible = vis;
      // ── A BODY THAT BURNED AWAY KEEPS ITS ELEMENT ─────────────────────────
      //
      // Claiming the element is what stands the painted plate down, and Build
      // 128 stopped claiming it the moment the burn finished — so a creature
      // dissolved into ash and its PAINTING faded straight back in behind it.
      // The reckoning screen showed the Grief-Wraith standing there whole, in
      // 2D, under a banner reading FALLEN. The comment in 128 asserted the
      // opposite of what the code did.
      //
      // Dead still counts as here. The slot goes on holding its element and
      // simply draws nothing into it.
      if (here) {
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
        // …AND IT GIVES A LUNGE ROOM TO HAPPEN. Pulling at 5.5 while an action
        // is driving the body forward damps the step into a twitch; the same
        // ease brings it home once the swing is over, which is the recovery.
        let tx = slot[0] - f.ctrOff, tz = slot[1];
        let k = Math.min(1, dt * (f.acting ? 1.1 : 5.5));
        // ── …AND A FINISHER ACTUALLY CROSSES IT (Build 139) ─────────────────
        //
        // Build 138 gave the all-out three bodies and they swung on the spot.
        // Measured, a swing carries the root about four centimetres — the clip's
        // own step, transferred off the hips in Build 135 — which is a lunge,
        // not a charge, and "the three of them cross the floor at once" is a
        // charge.
        //
        // A lunge here is not a second animation system. It moves the MARK the
        // slot ease is already walking toward, so the body goes out under the
        // same rule that brings it home — fast on the way (the ease at 6.5),
        // and back at the slack 1.1 the previous build gave an acting figure,
        // which is a recovery rather than a rewind.
        // `frame(now)` shadows the `now()` helper with the rAF timestamp, which
        // is the same clock `lunge` stamped `until` from — so this compares the
        // number, not a call.
        //
        // AND IT NEVER EXPIRES UNSPENT. A wall-clock window shorter than a
        // frame is a window that can be stepped straight over: measured on the
        // suite's browser, which draws at about 1.5fps, Ash's 520ms charge was
        // set and cleared between two frames and he did not move a millimetre
        // while Elin crossed her whole metre. A charge is a thing that happens,
        // not a period during which it may happen, so it holds until it has
        // been drawn at least once however long that takes.
        if (f.lunge) {
          if (now < f.lunge.until || !f.lunge.seen) {
            tx += f.lunge.x; tz += f.lunge.z;
            k = Math.min(1, dt * 6.5);
            f.lunge.seen = true;
          } else f.lunge = null;
        }
        f.root.position.x += (tx - f.root.position.x) * k;
        f.root.position.z += (tz - f.root.position.z) * k;
      }
      // ── AND NOW THE FEET, once the root is where it is really going ──────
      //
      // After the slot ease, not before: a foot pinned to a world position is
      // only pinned if that is the position which gets drawn. Called here
      // rather than inside `step` for exactly that reason.
      if (footIK()) f.footLock(dt);
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
      mirror.rotateZ((RIG.r + TRIPOD.roll) * D);
      if (Math.abs(mirror.fov - cam.fov) > 0.01) mirror.fov = cam.fov;
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

    // ── THE AIR, LAST ──
    //
    // After the bodies have been posed and before anything is drawn: a swing
    // that has moved this frame has a new sample in its trail, and every spark
    // in the fight ages by the same dt everything else did.
    //
    // The point size is handed the drawing buffer's height because a point
    // sprite is sized in PIXELS. Without it a spark would be one size at
    // 932x430 and another at a magnified window — the same class of bug as the
    // aim beam in Build 120, and the same fix: ask the thing that actually
    // knows.
    if (fx) {
      // ── ANYTHING THAT IS COMING APART ──
      for (const id of Object.keys(figs)) {
        const f = figs[id];
        if (f.burn == null) continue;
        f.burn = Math.min(1.15, f.burn + dt / BURN_SECONDS);
        const mat = f.root.userData.mat;
        if (mat && mat.userData.burn) mat.userData.burn.value = Math.min(1, f.burn);
        // ash off the front, at the height the front has actually reached —
        // the same arithmetic the shader is doing, so the two agree
        const front = Math.max(0, Math.min(1, f.burn * 1.34 - 0.17));
        _burnAt.set(f.root.position.x + f.ctrOff, 0, f.root.position.z);
        if (f.burn < 1.02) {
          fx.ash(_burnAt, f.worldH * 0.20, f.root.position.y + front * f.worldH,
                 f.burn < 0.12 ? 7 : 4, true);
        }
        if (f.burn >= 1.12) {
          // gone. The plate underneath does NOT come back — a creature that
          // has burned away has burned away, and `frame` would otherwise hand
          // its painting straight back the moment the body stopped drawing.
          f.root.visible = false;
          f.burn = null;
          f.dead = true;
          if (mat && mat.userData.burn) mat.userData.burn.value = 0;
        }
      }
      for (const id of Object.keys(figs))
        if (figs[id].root.visible) fx.trail(id, figs[id], dt);
      // pixels per metre at one metre: the drawing buffer's height over the
      // frustum's height at unit distance. Recomputed every frame because the
      // lens is part of a shot now and a push-in changes it.
      fx.step(dt, cam, (renderer.getSize(_size).y * renderer.getPixelRatio())
                       / (2 * Math.tan(cam.fov * D / 2)));
    }

    // ONE SCENE, ONE CAMERA, ONE PASS. Four scissored renders and four
    // orthographic frames are what it took to fake a shared space; a shared
    // space needs none of them.
    //
    // …AND THEN THE FRAME IS DRAWN OVER (Build 140). When any of the ink dials
    // are up the world goes to a target first, so the contour pass can read the
    // depth it needs; with them all at zero this is the same single render to
    // the canvas it has always been, and the target is never even allocated.
    if (inkWanted()) {
      const t = postTarget();
      // ── AND THE ARCS ARE HANDED THE WORLD TO BEND ────────────────────────
      //
      // The blade trail's refraction pass reads the target the world is drawn
      // into. It is given LAST frame's, because it is drawn inside the scene —
      // that is what keeps its depth test, so a swing behind a pillar stays
      // behind the pillar — and a pass cannot sample the buffer it is writing.
      // At a sixtieth of a second the arc has moved a fraction of one of its
      // twenty-two segments, and there is nothing on screen to compare it to.
      fx.behind(postPrev() && postPrev().texture);
      renderer.setRenderTarget(t);
      renderer.clear();
      renderer.render(scene, cam);
      renderer.setRenderTarget(null);
      postWarm = true;
      drawInk(t);
    } else {
      // no target, no frame to bend — the arcs are light alone, as before
      fx.behind(null);
      renderer.render(scene, cam);
    }

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
    // ── THE PAINTED STAGE IS NOT A PLACE A PLAYER CAN END UP ──────────────
    //
    // `?cast=2d` was the documented way back while the 3D layer was growing.
    // It is not a feature any more: combat is the world, and a second renderer
    // reachable from the address bar is a second thing to keep working.
    //
    // The suites keep it, because it is what makes them fast — eight of them
    // check card costs, road topology and parry windows behind a software
    // rasteriser, and none can tell which stage they are standing on. So the
    // flag survives for `?test=1` and answers nobody else.
    wanted: () => !(/(^|[?&])cast=2d(&|$)/.test(location.search)
                    && /(^|[?&])test=1(&|$)/.test(location.search)),
    async enable() {
      if (on) return true;
      // ── SWITCHING BACK ON IS NOT STARTING OVER ─────────────────────────
      //
      // `disable()` stops the loop and hides the canvas; it does not throw the
      // world away. `enable()` did not know that, so every re-enable built a
      // SECOND canvas, a second renderer, a second scene, and reloaded every
      // model — while the first one was still sitting in the DOM. Nothing
      // looked wrong, which is why it survived: the new world is identical to
      // the old one, so the only symptom was a suite that quietly doubled its
      // memory and lost every effect that had been fired into the scene the
      // first one owned.
      //
      // That last part is how it was found. A check fired an impact
      // immediately after a re-enable and measured zero sparks — because the
      // sparks went into the scene it had just replaced.
      if (renderer && scene) {
        on = true; last = 0;
        document.body.classList.add('k-cast3d');
        if (canvas) canvas.style.display = '';
        if (!raf) raf = requestAnimationFrame(frame);
        return true;
      }
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
    play(heroId, verb, dir) {
      const f = figs[heroId];
      if (!on || !f) return false;
      // IDLE IS NOT AN ACTION, it is what is left when no action is playing.
      // Asking for it by name — which is what standing back up does — means
      // "stop acting", not "play the idle once and then stop".
      if (verb === 'idle') { f.clear(); return true; }
      const pick = VERB[verb];
      // ── A PLAY THAT FINDS THE BLOW ALREADY WOUND UP LETS IT GO ────────────
      //
      // Nothing at the call site had to change for this. The fight has said
      // `castPlay(hero, 'slash')` when a card resolves since Build 36, and it
      // still does; if that hero is standing there holding the first third of
      // exactly that swing, this continues it instead of starting a second
      // one. Rewiring the resolve path to know about aiming would have put the
      // ready/release pairing in two places that must agree, which is the kind
      // of thing that is correct on the day and wrong three builds later.
      if (f.holdFrac && f.fxVerb === verb) { f.release(); return true; }
      const okp = f.play(pick ? clipFor(f, verb, dir) : verb);
      // THE VERB, KEPT. The clip is `sword` or `daggers` or `staff`; the air
      // needs to know it was a `slash`. Set after the play so a refused clip
      // cannot leave a trail with nothing swinging it.
      if (okp) {
        f.fxVerb = verb;
        if (fx) {
          const r = fx.ribbons[heroId];
          if (r) r.clear();                       // a new swing starts a new arc
          // a spell gathers before it goes anywhere
          const spec = FX_VERB[verb];
          if (spec && spec.charge) {
            const arm = (WEAPON_HAND[f.tone.strike] || ['RightHand'])[0];
            const h = f.bones[arm] || f.bones.RightHand;
            if (h) fx.charge(h.getWorldPosition(new THREE.Vector3()), verb);
          }
        }
      }
      return okp;
    },
    // ── THE BLOW LANDS ─────────────────────────────────────────────────────
    //
    // game.js has always said WHERE a hit happened by handing over a DOM
    // element, because for eleven builds the effect was a div next to it. It
    // now says WHO, and the world already knows where that is standing — chest
    // height on the figure, in metres, which is the only place an impact was
    // ever really happening.
    //
    // `toward` is the line from whoever threw it, so the sparks come off the
    // body in the direction the blow was travelling instead of puffing
    // symmetrically like a firework.
    hit(targetId, verb, power, fromId) {
      if (!on || !fx) return false;
      const t = figs[targetId];
      if (!t || !t.root.visible) return false;
      const at = new THREE.Vector3(t.root.position.x + t.ctrOff,
                                   t.root.position.y + t.worldH * 0.58,
                                   t.root.position.z);
      const src = fromId && figs[fromId];
      const toward = new THREE.Vector3();
      if (src && src.root.visible) {
        toward.set(at.x - (src.root.position.x + src.ctrOff), 0.35,
                   at.z - src.root.position.z).normalize();
      } else {
        toward.set(t.tone.foe ? 1 : -1, 0.4, 0.2).normalize();
      }
      // ── WHICH WAY THE STEEL WENT, from the trail it just drew ───────────
      //
      // The ribbon has been recording the blade's tip every frame of the
      // swing, so the arc's tangent at the moment of contact is simply the
      // difference between its last two samples. Nothing has to be told about
      // the clip, the weapon or the direction — the swing already said it, and
      // this reads the record rather than guessing from the attacker's facing.
      const cut = new THREE.Vector3();
      const rib = src && fx.ribbons[fromId];
      let path = null;
      if (rib && rib.filled >= 3) {
        const last = (rib.head - 1 + TRAIL) % TRAIL;
        const back = (rib.head - 3 + TRAIL) % TRAIL;
        cut.copy(rib.pts[last].b).sub(rib.pts[back].b);
        // ── AND THE WHOLE CURVE, NOT JUST ITS DIRECTION ────────────────────
        //
        // The tangent said which way the steel went; the path says what SHAPE
        // it went in, which is the difference between a line across the foe and
        // a sword arriving. The last eight samples are about an eighth of a
        // second of blade — the part of the stroke that actually met the body.
        //
        // Moved onto the target rather than used where it was recorded: the
        // trail was drawn wherever the attacker's arm swung, and the blow lands
        // on the creature. Re-centring keeps the shape and puts it where the
        // hit is, which is the only part of it the player is looking at.
        // ── AND ENOUGH OF IT TO BE A CURVE ────────────────────────────────
        // Eight samples is about an eighth of a second of blade, and measured,
        // its bow came out at 4% of its own chord: a short segment of a big
        // circle is a straight line, and photographing it showed exactly that.
        // Sixteen is a quarter-second — most of the committed part of a stroke
        // — and it is the difference between a mark across the foe and a sword
        // arriving on one.
        const take = Math.min(16, rib.filled);
        const raw = [];
        for (let i = take - 1; i >= 0; i--)
          raw.push(rib.pts[(rib.head - 1 - i + TRAIL * 2) % TRAIL].b.clone());
        const mid = raw[Math.floor(raw.length / 2)];
        const shift = new THREE.Vector3().copy(at).sub(mid);
        raw.forEach(p2 => p2.add(shift));
        // ── THE BLADE'S CURVE, AT THE BLOW'S SIZE ──────────────────────────
        //
        // A quarter-second of sword tip is metres of travel — photographed at
        // full scale it swept clean past the foe and off the side of the
        // frame. What is wanted from the recording is its SHAPE, not its
        // extent: scaling about the contact point keeps the bow exactly (the
        // sagitta and the chord shrink together) while sizing the mark to the
        // thing it landed on.
        const chord = raw[0].distanceTo(raw[raw.length - 1]);
        const want = 1.5;                      // metres across, about a body
        if (chord > want) {
          const f = want / chord;
          raw.forEach(p2 => p2.sub(at).multiplyScalar(f).add(at));
        }
        path = raw;
      }
      fx.hit(at, toward, verb, power, cut, path, cam.position);
      return true;
    },
    // ── THE LIGHT COMES OFF EVERYTHING EXCEPT THIS ─────────────────────────
    //
    // `focus(['foe0','ash'])` takes the world down and holds these two lit.
    // `focus(null)` gives it back. The fight names the bodies the moment is
    // about; it does not have to know there are lights.
    // ── HOW FAST TIME IS RUNNING IN HERE ───────────────────────────────────
    //
    // 1 is now. Anything less is a held breath. The camera, the bodies, the
    // sparks and the burn all read the same clock, because a world where the
    // fighters slow down and the embers do not is a world with two clocks in
    // it and the player can see both.
    slow(factor) {
      slowWant = Math.max(0.05, Math.min(1, factor == null ? 1 : factor));
      return true;
    },
    focus(keys) {
      for (const k of Object.keys(focusOn)) delete focusOn[k];
      if (!keys || !keys.length) { focusWant = 1; return true; }
      for (const k of keys) if (k) focusOn[k] = 1;
      focusWant = 0;
      return true;
    },
    // ── WIND UP, AND WAIT ──────────────────────────────────────────────────
    //
    // Called while a card is being aimed. Idempotent: dragging across four
    // targets must not restart the wind-up four times, so a hero already
    // holding this verb is left exactly where it is.
    // `dir` carries the flavour for a slash, the arrow for a parry — the same
    // third word `play` takes. THE WIND-UP HAS TO AGREE WITH THE BLOW: aiming
    // reads the card's effects too, so a Cross Sever winds up the heavy swing
    // it is going to release rather than winding up an ordinary one and
    // switching clip halfway through the throw.
    ready(heroId, verb, dir) {
      const f = figs[heroId];
      if (!on || !f || f.dead) return false;
      if (f.holdFrac && f.fxVerb === verb) return true;
      const pick = VERB[verb];
      const name = pick ? clipFor(f, verb, dir) : verb;
      if (!f.actions[name]) return false;
      // ── WHERE THE WIND-UP STOPS IS THE CLIP'S OWN BUSINESS ──
      //
      // This was a constant per verb — 0.34 of the clip for a slash — chosen
      // against procedural clips several seconds long. On the Unreal pack the
      // blow lands at 0.14, so holding a card froze the body a THIRD of the way
      // in, which is well past the moment the blade arrives: the attack was
      // already over before the player let go. `tools/contact.cjs` writes each
      // clip's own mark, always before its own contact frame.
      const m = f.meta && f.meta[name];
      const at = (m && m.wind > 0) ? m.wind
               : (READY_AT[verb] === undefined ? 0.34 : READY_AT[verb]);
      if (!f.ready(name, at)) return false;
      f.fxVerb = verb;
      const r = fx && fx.ribbons[heroId];
      if (r) r.clear();
      return true;
    },
    // …and put the card back: the wind-up unwinds rather than completing
    unready(heroId) {
      const f = figs[heroId];
      if (!f || !f.holdFrac) return false;
      f.clear();
      return true;
    },
    // ── A CREATURE BURNS AWAY ──────────────────────────────────────────────
    //
    // The body keeps animating the whole way through. That is the point: a
    // figure that freezes and then dissolves is a sprite being switched off,
    // and one that is still falling as it comes apart is dying. So this starts
    // the burn and changes nothing else — `down` is already playing, and it
    // goes on playing under the tear.
    fell(id) {
      const f = figs[id];
      if (!on || !f || f.burn != null || f.dead) return false;
      f.burn = 0;
      return true;
    },
    // and a fight that starts puts every corpse back on its feet
    revive() {
      for (const id of Object.keys(figs)) {
        const f = figs[id];
        f.burn = null; f.dead = false;
        const mat = f.root.userData.mat;
        if (mat && mat.userData.burn) mat.userData.burn.value = 0;
      }
    },
    all(clip) { Object.keys(figs).forEach(id => this.play(id, clip)); },
    // test-only: what the layer thinks is true right now
    _state: () => ({
      on, ready, failed, clips: clipNames, missing,
      // WHO IS STANDING THERE, and what each one is wearing — a board with two
      // Hollow Husks on it is two entries, which is the whole point
      foes: Object.keys(figs).filter(k => figs[k].tone.foe),
      wearing: Object.assign({}, wearing),
      // …and the bestiary itself: a model is downloaded once and shared by
      // however many of that creature the road decided to deal
      creatures: Object.keys(models),
      figures: Object.keys(figs),
      playing: Object.fromEntries(Object.keys(figs).map(id => [id, figs[id].clipName || null])),
      bones: Object.keys(figs).length ? Object.keys(figs[Object.keys(figs)[0]].bones).length : 0,
      // the air: how many sparks are alive, and whether any arc is drawing
      sparks: fx ? (fx.sparks.live || 0) : 0,
      // any figure whose silhouette measurement never settled — it will be the
      // wrong size and standing at the wrong height, and saying so beats
      // shipping a floating body
      unfit: Object.keys(figs).filter(id => figs[id].fitOk === false),
      burning: Object.keys(figs).filter(id => figs[id].burn != null),
      gone: Object.keys(figs).filter(id => figs[id].dead),
      trails: fx ? Object.keys(fx.ribbons).filter(k => fx.ribbons[k].mesh.visible).length : 0,
      rings: fx ? fx.shocks.items.filter(i => i.t > 0).length : 0,
      cuts: fx ? fx.cuts.items.filter(i => i.t > 0).length : 0,
      // …and how many have been thrown in total, which a slow frame cannot eat
      ringsFired: fx ? fx.shocks.fired : 0,
      cutsFired: fx ? fx.cuts.fired : 0,
      focus: +focusLevel.toFixed(3),
      slow: +slowLevel.toFixed(3),
      lit: Object.keys(focusOn),
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
          foe: !!f.tone.foe,
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
    _verbClip: (heroId, verb, dir) => {
      const t = (figs[heroId] && figs[heroId].tone) || CAST[heroId];
      return t && VERB[verb] ? VERB[verb](t, dir) : null;
    },
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
        if (!CAST[id]) continue;
        CAST[id].turn = next[id];
        const side = CAST[id].side || 1;
        // every slot wearing this creature turns, not just the first one
        for (const key of Object.keys(figs))
          if (figs[key].cast === id || key === id)
            aim(figs[key], side * FOE_HEADING - side * next[id]);
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
    // ── A CUT LIST (Build 138) ────────────────────────────────────────────
    //
    // `shot` sets one pose, or one move between two poses, and for a hundred
    // builds that was the whole language — which is why every moment in this
    // game is one continuous camera move and no moment is ever CUT.
    //
    // A duo and an all-out are the two things that cannot be said that way. Two
    // people doing one thing is a two-shot: hold on the one who commits, whip
    // to the one who answers. Three of them is a crescendo — wide, then in,
    // then off the line as it lands. Both are a sequence of shots on a clock,
    // and a sequence is not something `shot` can express however many fields it
    // grows.
    //
    // Each entry is `{ shot, opts, hold }`: what to cut to, how to ask for it,
    // and how long before the next one. It is plain `setTimeout` and it is
    // CANCELLABLE — a later `shot` or `sequence` drops whatever is still
    // pending, so a kill landing in the middle of an all-out takes the camera
    // and the rest of the cut list does not fight it for the frame.
    sequence(list) {
      cutStop();
      if (!Array.isArray(list) || !list.length) return false;
      let t = 0;
      list.forEach((step, i) => {
        const go = () => {
          cutting = true;
          // …by name off the module's own export rather than through `this`,
          // which a destructured call would not have
          try { Cast3D.shot(step.shot, step.opts); } finally { cutting = false; }
        };
        if (i === 0) go();
        else cutTimers.push(setTimeout(go, t));
        t += Math.max(0, step.hold || 0);
      });
      return true;
    },
    // …and a way to say "stop cutting" without asking for a frame
    uncut: () => cutStop(),
    // ── SOMEBODY CROSSING THE FLOOR ────────────────────────────────────────
    //
    // `toward` is whatever `at` accepts: a name, a list of names, a side, or a
    // point. The distance is capped so nobody ends up standing inside the thing
    // they are hitting — a charge that overshoots reads as a collision, and the
    // party's front rank starts about two and a half metres from the foe line.
    lunge(id, toward, metres, ms) {
      const f = figs[id];
      if (!on || !f || !f.root.visible) return false;
      // A SLOT THAT IS NOT WEARING ANYBODY YET IS STILL A DIRECTION. The
      // bestiary loads behind the party, so an all-out thrown in the first
      // second of a fight names a creature whose model has not arrived — and
      // `aimPoint` answers an unknown subject with the BOARD, which is where
      // the front rank is already standing. Measured, Ash charged nowhere at
      // all while Elin crossed a full metre, because Ash was inside the
      // keep-out of a target that was really the middle of the floor. A `foeN`
      // key means the foe line whether or not anything is standing in it.
      let subject = toward;
      if (typeof toward === 'string' && !figs[toward])
        subject = /^foe/.test(toward) ? 'foe' : /^(party|foe|board)$/.test(toward) ? toward : 'party';
      else if (typeof toward === 'string') subject = [toward];
      const p = aimPoint(subject);
      const dx = p[0] - (f.root.position.x + (f.ctrOff || 0));
      const dz = p[2] - f.root.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.05) return false;
      const m = Math.max(0, Math.min(metres == null ? 0.9 : metres, d - LUNGE_KEEP));
      if (m <= 0) return false;
      f.lunge = { x: dx / d * m, z: dz / d * m, until: now() + (ms || 460) };
      return true;
    },
    // WHICH OF THE FIGHT'S FOUR WORDS THIS PERSON THROWS when nothing else is
    // being asked. The fight knows its verbs; it does not know that Elin is the
    // one who casts, and it should not have to.
    // HOW LONG THIS ACTION IS ACTUALLY ON SCREEN, in milliseconds.
    //
    // A camera beat used to be a constant — `for: 760` — chosen when the sword
    // clip was a 4.4s procedural one windowed down to 1.15. The Unreal clips
    // are their own lengths and the constant no longer matches any of them, so
    // the lens handed the frame back with a third of the swing still to play.
    // The layer already knows: playback is scaled so a clip lasts exactly its
    // beat, and a clip without one lasts as long as it was authored.
    beatMs: (id, verb, dir) => {
      const f = figs[id]; if (!f) return 0;
      const a = f.actions[clipFor(f, verb, dir)];
      if (!a) return 0;
      return Math.round(1000 * a.getClip().duration / (a.timeScale || 1));
    },
    // WHEN THE BLOW LANDS INSIDE THAT, in milliseconds from the clip starting.
    //
    // `tools/contact.cjs` measures it — the frame the weapon hand is moving
    // fastest relative to the hips — and writes it into the library as `hit`.
    // A clip with no contact frame (a stagger, a death, a guard) answers 0, and
    // the caller then does what it always did.
    contactMs: (id, verb, dir) => {
      const f = figs[id]; if (!f) return 0;
      const name = clipFor(f, verb, dir);
      const a = f.actions[name], m = f.meta && f.meta[name];
      if (!a || !m || !(m.hit > 0)) return 0;
      return Math.round(1000 * m.hit * a.getClip().duration / (a.timeScale || 1));
    },
    verbFor: (id) => {
      const t = (figs[id] && figs[id].tone) || CAST[id];
      return (t && t.verb) || 'slash';
    },
    shot(name, opts) {
      if (name == null) return { asked: { ...SHOT }, base: { ...BASE },
                                 holding: holdUntil ? Math.max(0, Math.round(holdUntil - now())) : 0,
                                 at: { ...TRIPOD, atP: TRIPOD.atP.slice() } };
      // A FRAME ASKED FOR FROM OUTSIDE THE CUT LIST ENDS THE CUT LIST — unless
      // it is a stance, which is only saying where to go once the cutting is
      // done. `setPhase` fires `castShot('home')` the instant a card resolves,
      // and treating that as an interruption cancelled every duo's second and
      // third shot before either played.
      if (!cutting && opts && opts.for) cutStop();
      const base = typeof name === 'string' ? SHOTS[name] : name;
      if (!base) return false;
      // `full` is what stops a move leaking. Every pose is filled out to the
      // same six fields plus `to`/`over`, so a shot that says nothing about its
      // lens gets the board's, and — the part that bit — a shot that is not a
      // move overwrites the previous shot's `to` with undefined rather than
      // inheriting a travel it never asked for.
      const next = full(Object.assign({}, SHOTS.home, base, opts || {}));
      if (opts && opts.for) {
        holdUntil = now() + opts.for;      // a moment: hand the camera back after
      } else {
        Object.assign(BASE, next);          // a stance: this is where it lives
        // ── …AND A STANCE WAITS FOR THE MOMENT IT INTERRUPTED (Build 138) ──
        //
        // `{ for: ms }` has existed since Build 122 to stop a phase parking the
        // camera on top of an action, and it has never once worked, because a
        // stance took the frame unconditionally two lines below this.
        //
        // Measured: playing a card logs `shot strike {for:760}` and
        // `shot home {}` ON THE SAME TICK — `fxPlayCard` asks for the beat and
        // `setPhase('PLAYER_READY')` immediately overwrites it. Every action
        // shot in this game, `strike` and `grace` alike, has been asked for and
        // discarded within a millisecond for sixteen builds. The comment above
        // `SHOT_FOR` describes a feature that was not running.
        //
        // A stance says where the camera LIVES, and `rig` already eases back to
        // exactly that when the hold expires. So while a moment holds the
        // frame, a stance updates the destination and does not touch it.
        if (holdUntil > now()) return true;
        holdUntil = 0;
      }
      Object.assign(SHOT, next);
      shotAt = now();                       // a move starts travelling from here
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
    // test-only: the air itself, so a probe can drive it at a fixed timestep
    // rather than at whatever the software rasteriser manages
    _fx: () => fx,
    _cam: () => cam,          // test-only: the effects billboard against it
    _scene: () => scene,        // test-only: the fog and the lights live here
    _homed: () => ({ ...homed }),     // test-only: the returns baked into clips
    _footIK: (v) => (v === undefined ? _footIK : (_footIK = !!v)),
    // ── test-only: HOW MUCH OF THIS BODY IS ACTUALLY DRAWN ─────────────────
    //
    // Screenshotting the creature's rectangle and weighing the PNG cannot
    // answer this, and the way it fails is instructive: a burning body adds a
    // white-hot tear that costs MORE bytes than the body it is eating, and a
    // solid body hides an arcade, sixty pieces of rubble and their reflections,
    // so a whole Regent can compress SMALLER than the empty plaza behind her.
    // The proxy is not even monotonic.
    //
    // So do what `fit` has done since Build 112: render the figure alone into a
    // small offscreen target and count the pixels it covers. That is the
    // property, not a stand-in for it.
    _cover(id) {
      const f = figs[id];
      if (!f || !renderer || !scene) return null;
      const W = 96, H = 128;
      const target = new THREE.WebGLRenderTarget(W, H);
      const buf = new Uint8Array(W * H * 4);
      const c = new THREE.OrthographicCamera(-1.4, 1.4, 1.9, -1.9, 0.01, 40);
      const wasVis = {};
      for (const k of Object.keys(figs)) {
        wasVis[k] = figs[k].root.visible;
        figs[k].root.visible = (k === id);
      }
      const world = notBodies();
      const worldWas = world.map(o => o.visible);
      for (const o of world) o.visible = false;
      const fogWas = scene.fog; scene.fog = null;
      const prev = renderer.getRenderTarget();
      const vp = new THREE.Vector4(); renderer.getViewport(vp);
      const p = f.root.position;
      c.position.set(p.x + f.ctrOff, p.y + f.worldH / 2, p.z + 6);
      c.lookAt(p.x + f.ctrOff, p.y + f.worldH / 2, p.z);
      c.updateProjectionMatrix();
      renderer.setRenderTarget(target);
      renderer.setViewport(0, 0, W, H);
      renderer.clear();
      renderer.render(scene, c);
      renderer.readRenderTargetPixels(target, 0, 0, W, H, buf);
      renderer.setRenderTarget(prev);
      renderer.setViewport(vp);
      for (let i = 0; i < world.length; i++) world[i].visible = worldWas[i];
      scene.fog = fogWas;
      for (const k of Object.keys(figs)) figs[k].root.visible = wasVis[k];
      target.dispose();
      let n = 0;
      for (let i = 0; i < W * H; i++) if (buf[i * 4 + 3] > 20) n++;
      return n;
    },
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
          scene.userData.key.intensity = (1.45 * (1 - next.shade) + 0.45) * EXPOSURE;
        if (next.floor != null)
          ground.material.color.setScalar(0.5 + next.floor * 1.6);
      }
      // A DIAL NAME IS NOT A UNIFORM NAME, and treating it as one is how a
      // dial called `ink` came to hand a float to `uniform vec3 uInk` — the
      // watercolour's pigment colour — and throw on every figure, every frame.
      // The types have to agree before the write, because the collision is
      // silent right up until the GPU refuses it.
      for (const id of Object.keys(figs)) {
        const u = figs[id].root.userData.mat.userData.u;
        for (const k of Object.keys(next)) {
          const key = 'u' + k[0].toUpperCase() + k.slice(1);
          if (!u[key]) continue;
          if (typeof u[key].value !== typeof next[k]) continue;
          u[key].value = next[k];
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
