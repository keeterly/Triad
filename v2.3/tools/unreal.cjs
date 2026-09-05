// ═══════════════════════════════════════════════════════════════════════════
// THE UNREAL IMPORTER — bring a Mannequin animation onto this game's rig
// ═══════════════════════════════════════════════════════════════════════════
//
//   node v2.3/tools/unreal.cjs <manifest.json> <clips.json>
//
// The manifest names the file and, optionally, which clip inside it:
//
//   { "parryU": { "file": "packs/combat/Block_High.fbx" },
//     "hurt":   { "file": "packs/hits/Reactions.fbx", "clip": "Hit_Front" } }
//
// It reads FBX (what Unreal exports) and GLB alike, converts, and MERGES into
// an existing clips.json. Run `rewindow.cjs` afterwards, exactly as the Meshy
// mill's output is run through it, so an imported clip gets the same beat and
// the same window rule as everything already in the library.
//
// ── WHY THIS IS SMALL ──────────────────────────────────────────────────────
//
// Because the retargeter is small: it does not compare skeletons, it computes
// each bone's DEPARTURE from a rest pose and replays that departure on the
// target's own rest. What it cannot guess is the two things a foreign skeleton
// does not come with: WHICH BONE IS WHICH, and what the source's rest pose was.
//
// ── AND THE DEPARTURE IS MEASURED IN THE BONE'S OWN FRAME ──────────────────
//
// There are two ways to write that sentence and only one of them is true.
//
//     D  = A_s · G_s⁻¹      A_t = D · G_t          (world)
//     D  = G_s⁻¹ · A_s      A_t = G_t · D          (the bone's own rest frame)
//
// The first says "whatever this bone did in the source's WORLD, do that in
// ours". It is only correct when the two skeletons stand in the same world.
// The second says "whatever this bone did relative to where it rests, do that
// relative to where you rest", and is the one that needs no agreement about
// which way is up.
//
// This file shipped the first, under a comment claiming it was orientation
// agnostic. It is not, and Unreal is Z-UP while this library is Y-up, so every
// rotation arrived about the wrong axes. Measured on the shipped clips: the
// party stood permanently hunched at 36 degrees off vertical where the
// hand-authored clips read 10, and a heavy sword swing folded the figure into
// a ball on the floor — 131 degrees of trunk pitch, both feet 70cm in the air —
// halfway through the swing.
//
// WHY NOTHING CAUGHT IT. The importer's own fidelity gate asks how far the
// furthest joint TURNED, and the angle of a rotation is invariant under a
// change of frame. A clip rotated into completely the wrong axes turns exactly
// as far as one rotated correctly, so the gate read a healthy number over a
// figure folded in half. `test/retarget.probe.cjs` is the check that can see
// it: it converts the same clip twice, once with the source stood on its side,
// and the two conversions have to agree.
//
// So this tool supplies both, offline, and re-expresses the animation against
// the rest pose the library already carries — `__rest` — so an imported clip
// enters as a peer of the ones milled from Meshy. Nothing at runtime changes,
// nothing about the existing clips changes, and the library stays homogeneous.
// A per-clip rest would have been the other way to do it and it would have made
// every consumer of `__rest` ask which one it meant.
//
// ── THE SPINE IS NAMED BACKWARDS AND THAT IS THE TRAP ──────────────────────
//
// Meshy's rig calls the LOWEST vertebra `Spine02` and the highest `Spine` —
// `__parent` reads Spine02 → Spine01 → Spine going up. Unreal counts the other
// way, spine_01 at the bottom. Mapped by number rather than by position, every
// imported torso would be inverted: a bow would arch backwards, and it would
// look like a bad retarget rather than a bad table.
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');

const MANIFEST = process.argv[2], OUT = process.argv[3];
if (!MANIFEST || !OUT) {
  console.error('usage: node unreal.cjs <manifest.json> <clips.json>');
  process.exit(2);
}

// ── UNREAL MANNEQUIN → THIS GAME'S 24 JOINTS ───────────────────────────────
//
// Everything not in this table is dropped on purpose. `root` is handled
// separately (see the root-motion note). The twist bones — upperarm_twist_01,
// thigh_twist_01 and their kin — have no home on a 24-joint rig, and dropping
// them flattens forearm roll: a sword that rotates in the hand mid-swing will
// arrive rotating at the elbow instead. That is a real loss and it is the price
// of the rig we have. The IK bones (ik_hand_gun, ik_foot_root) and any weapon
// sockets are drivers, not anatomy, and belong nowhere.
const MAP = {
  pelvis: 'Hips',
  spine_01: 'Spine02', spine_02: 'Spine01', spine_03: 'Spine',
  // UE5 added a fourth and fifth on the new Mannequin; fold them onto the three
  // we have rather than dropping the chest entirely
  spine_04: 'Spine', spine_05: 'Spine',
  neck_01: 'neck', neck_02: 'neck', head: 'Head',
  clavicle_l: 'LeftShoulder', upperarm_l: 'LeftArm',
  lowerarm_l: 'LeftForeArm', hand_l: 'LeftHand',
  clavicle_r: 'RightShoulder', upperarm_r: 'RightArm',
  lowerarm_r: 'RightForeArm', hand_r: 'RightHand',
  thigh_l: 'LeftUpLeg', calf_l: 'LeftLeg', foot_l: 'LeftFoot', ball_l: 'LeftToeBase',
  thigh_r: 'RightUpLeg', calf_r: 'RightLeg', foot_r: 'RightFoot', ball_r: 'RightToeBase',
};
// …and the same rig under Mixamo's names, because a pack bought for Unreal is
// as likely to have been authored on one as the other, and the cost of knowing
// both is a second table.
const MIXAMO = {
  Hips: 'Hips', Spine: 'Spine02', Spine1: 'Spine01', Spine2: 'Spine',
  Neck: 'neck', Head: 'Head',
  LeftShoulder: 'LeftShoulder', LeftArm: 'LeftArm',
  LeftForeArm: 'LeftForeArm', LeftHand: 'LeftHand',
  RightShoulder: 'RightShoulder', RightArm: 'RightArm',
  RightForeArm: 'RightForeArm', RightHand: 'RightHand',
  LeftUpLeg: 'LeftUpLeg', LeftLeg: 'LeftLeg', LeftFoot: 'LeftFoot', LeftToeBase: 'LeftToeBase',
  RightUpLeg: 'RightUpLeg', RightLeg: 'RightLeg', RightFoot: 'RightFoot', RightToeBase: 'RightToeBase',
};
// a bone this rig already speaks, passed straight through
const OURS = {};
for (const v of Object.values(MAP)) OURS[v] = v;

const jobs = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const lib = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
if (!lib.__rest || !lib.__parent) {
  console.error(OUT + ' has no __rest/__parent — import into an existing library,'
    + ' because that rest pose is what an imported clip is re-expressed against.');
  process.exit(2);
}

function requirePlaywright() {
  try { return require('playwright'); } catch (_) {}
  return require('/opt/node22/lib/node_modules/playwright');
}
function findChromium() {
  for (const p of ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome']) {
    try { fs.accessSync(p); return p; } catch (_) {}
  }
  return null;
}

const ROOT = path.resolve(__dirname, '../..');
const PORT = 8098;
function serve() {
  const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript',
                  '.json': 'application/json', '.glb': 'model/gltf-binary',
                  '.fbx': 'application/octet-stream', '.html': 'text/html' };
  return http.createServer((req, res) => {
    const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    fs.readFile(f, (e, b) => {
      if (e) { res.writeHead(404); return res.end('no'); }
      res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream',
                           'access-control-allow-origin': '*' });
      res.end(b);
    });
  }).listen(PORT);
}

const DP = 4;
const round = (v) => +v.toFixed(DP);

(async () => {
  const server = serve();
  const { chromium } = requirePlaywright();
  const exe = findChromium();
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const page = await browser.newPage();
  page.on('console', m => { if (m.type() === 'error') console.log('  page:', m.text()); });
  page.on('pageerror', e => console.log('  PAGE ERROR:', e.message));
  await page.goto(`http://127.0.0.1:${PORT}/v2.3/index.html?test=1&cast=2d`,
                  { waitUntil: 'domcontentloaded' });

  const report = [];
  for (const [verb, spec] of Object.entries(jobs)) {
    const url = '/' + path.relative(ROOT, path.resolve(spec.file)).split(path.sep).join('/');
    const got = await page.evaluate(async (arg) => {
      const THREE = await import('/v2.3/lib/three.module.min.js');
      const load = async () => {
        if (/\.fbx$/i.test(arg.url)) {
          const { FBXLoader } = await import('/v2.3/tools/lib/FBXLoader.js');
          return { root: await new FBXLoader().loadAsync(arg.url), clips: null };
        }
        const { GLTFLoader } = await import('/v2.3/lib/GLTFLoader.js');
        const g = await new GLTFLoader().loadAsync(arg.url);
        return { root: g.scene, clips: g.animations };
      };
      const { root, clips: gclips } = await load();
      const clips = gclips || root.animations || [];
      if (!clips.length) return { err: 'no animation in ' + arg.url };
      const clip = arg.clip ? clips.find(c => c.name === arg.clip) : clips[0];
      if (!clip) return { err: 'no clip "' + arg.clip + '" — has ' + clips.map(c => c.name).join(', ') };

      // ── WHICH NAMING IS THIS, AND WHICH BONES ARE THERE ──
      // ── HOLD THE BONE THE MIXER WILL ACTUALLY DRIVE ──────────────────────
      //
      // A traversal that keys bones by name is not the same thing as three's
      // own lookup, and on this file they disagree: an FBX can carry two
      // skeletons whose bones share names, and `PropertyBinding.findNode`
      // resolves a track to the FIRST it finds while a traversal keeps the
      // LAST it wrote. Measured on the test fixture, `findNode('mixamorigHips')`
      // and `bones['mixamorigHips']` were different objects.
      //
      // Everything then behaved perfectly and produced nothing: the tracks
      // bound, the mixer posed its skeleton, and this tool sampled the other
      // one — which never moves — so every departure came out identity and the
      // converter wrote out the rest pose. The clip loaded, retargeted and
      // played, and the figure stood there looking intact.
      //
      // So bones are resolved the way the animation system resolves them.
      const bones = {};
      root.traverse(o => { if (o.isBone || o.type === 'Bone') bones[o.name] = o; });
      const drivenBy = (name) => THREE.PropertyBinding.findNode(root, name) || bones[name];
      let doubled = 0;
      for (const n of Object.keys(bones)) if (drivenBy(n) !== bones[n]) doubled++;
      const strip = (n) => n.replace(/^mixamorig[:_]?/i, '');
      const tables = [arg.MAP, arg.MIXAMO, arg.OURS];
      let map = null, hits = -1;
      for (const t of tables) {
        const n = Object.keys(bones).filter(b => t[strip(b)]).length;
        if (n > hits) { hits = n; map = t; }
      }
      const mine = {};                     // our name -> source bone
      for (const b of Object.keys(bones)) {
        const to = map[strip(b)];
        // spine_04/_05 both fold onto Spine; keep the HIGHEST one, which is the
        // one whose motion the chest actually reads as
        if (to && !mine[to]) mine[to] = drivenBy(b);
      }
      const missing = Object.values(arg.MAP).filter((v, i, a) => a.indexOf(v) === i)
                            .filter(v => !mine[v]);

      // ── THE SOURCE'S REST POSE ──
      // Read before anything is animated: a loaded skeleton is sitting in its
      // bind pose, and that is the frame every departure is measured from.
      const restQ = {}, restP = {};
      for (const k of Object.keys(mine)) {
        restQ[k] = mine[k].quaternion.clone();
        restP[k] = mine[k].position.clone();
      }
      const parentOf = {};
      for (const k of Object.keys(mine)) {
        let p = mine[k].parent;
        while (p && !Object.keys(mine).some(x => mine[x] === p)) p = p.parent;
        parentOf[k] = p ? Object.keys(mine).find(x => mine[x] === p) : null;
      }
      // parents first
      const order = [], seen = {};
      const visit = (n) => { if (seen[n]) return; seen[n] = 1;
                             if (parentOf[n]) visit(parentOf[n]); order.push(n); };
      Object.keys(mine).forEach(visit);

      const Q = () => new THREE.Quaternion();
      // ── STAND THE SOURCE IN A ROTATED FRAME, ON PURPOSE ──
      //
      // Only ever set by test/retarget.probe.cjs. Both the rest pose and every
      // sampled frame accumulate from the topmost mapped bone, so this seeds
      // that accumulation — which is exactly what a source authored Z-up looks
      // like from in here, and nothing a scene-graph rotation could reproduce:
      // the world above the pelvis never enters this arithmetic.
      //
      // A conversion that asks each bone what it did RELATIVE TO ITS OWN REST
      // cancels this seed exactly, because it appears on the left of both the
      // rest and the pose. One that measures the departure in the shared frame
      // does not. That difference is the whole test.
      const spin = new THREE.Quaternion();
      if (arg.spin) spin.setFromAxisAngle(new THREE.Vector3(1, 0, 0), arg.spin * Math.PI / 180);
      // ── R: THE SOURCE'S WORLD, EXPRESSED IN OURS ──
      //
      // Set below, once the bind pose has said which way is up in this file.
      // It is the piece the first two cuts of this converter both lacked, in
      // opposite ways: one carried the departure in the source's world and
      // never rotated it into ours, the other sidestepped the question by
      // measuring in each bone's own rest frame — which needs no up axis and is
      // also wrong, because the two rigs do not hold a bone the same way
      // relative to the body it is in. A yaw about the source's spine came out
      // as a pitch about ours, and the further a clip yawed the worse it got.
      const Rq = new THREE.Quaternion(), Ri = new THREE.Quaternion();
      const round = (v) => +v.toFixed(4);
      const gOf = (rest, par) => {
        const G = {};
        for (const n of order) {
          const p = par[n];
          G[n] = (p && G[p] ? G[p].clone() : spin.clone()).multiply(rest[n]).normalize();
        }
        return G;
      };
      const Gsrc = gOf(restQ, parentOf);

      // the library's rest — what an imported clip must end up expressed against
      const tgtQ = {}, tgtPar = arg.lib.__parent;
      for (const k of Object.keys(arg.lib.__rest)) tgtQ[k] = Q().fromArray(arg.lib.__rest[k]).normalize();
      const tOrder = [], tSeen = {};
      const tVisit = (n) => { if (tSeen[n] || !tgtQ[n]) return; tSeen[n] = 1;
                              if (tgtPar[n]) tVisit(tgtPar[n]); tOrder.push(n); };
      Object.keys(tgtQ).forEach(tVisit);
      const Gtgt = {};
      for (const n of tOrder) {
        const p = tgtPar[n];
        Gtgt[n] = (p && Gtgt[p] ? Gtgt[p].clone() : Q()).multiply(tgtQ[n]).normalize();
      }

      // ── SAMPLE THE SOURCE AND RE-EXPRESS IT ──
      const mixer = new THREE.AnimationMixer(root);
      const action = mixer.clipAction(clip);
      action.play();
      action.paused = true;
      const FPS = 30;
      const n = Math.max(2, Math.round(clip.duration * FPS) + 1);
      const times = [], out = {}, hip = [];
      for (const k of order) if (Gtgt[k]) out[k] = [];

      // HOW A STRIDE AUTHORED FOR SOMEBODY ELSE'S LEGS LANDS ON OURS. The
      // Mannequin is not our proportions, so a step measured in its centimetres
      // is the wrong number of ours. Hip height is the honest ratio: it is what
      // sets how far a leg can reach, and normalising by it means a stride
      // arrives as the same FRACTION of a stride rather than the same distance.
      // ── AND WHICH WAY IS UP IN THE SOURCE ──
      //
      // Mixamo exports Y-up with no root bone: its pelvis rests at about
      // (0, 95, 0) and a stride arrives on z. Unreal is Z-UP and keeps travel
      // on a `root` bone: the same pelvis reads about (-2.6, 1.7, 77) and the
      // lunge arrives on y. Reading `.y` on that gives a hip height of 1.7
      // where the truth is 77, so `scale` came out ~50x too large — and the
      // lunge was then multiplied by it, writing a hips track that fell to
      // -12689 and drove the figure through the floor and off the stage.
      //
      // Decided from the REST POSE rather than from bone names, because a rig
      // can be renamed and its axes cannot: whichever of y and z carries the
      // hip's height off the floor is the up we are looking at.
      // TWO DIFFERENT HEIGHTS ARE NEEDED AND THEY ARE NOT THE SAME NUMBER.
      // The bind pose is read first, before the mixer has posed anything.
      const bindV = mine.Hips ? mine.Hips.getWorldPosition(new THREE.Vector3())
                              : new THREE.Vector3(0, 1, 0);
      action.time = 0;
      mixer.update(0);
      root.updateMatrixWorld(true);
      const pose0V = mine.Hips ? mine.Hips.getWorldPosition(new THREE.Vector3()) : bindV;

      const zUp = Math.abs(bindV.z) > Math.abs(bindV.y);
      // …and now R is known: the same change of basis `upright` does to a
      // position, as a rotation, so a turn and a travel arrive in one frame.
      if (zUp) Rq.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
      Ri.copy(Rq).invert();
      // into the library's frame, where y is up and z is the way a stride goes
      const upright = (v) => (zUp ? { x: v.x, y: v.z, z: -v.y }
                                  : { x: v.x, y: v.y, z: v.z });
      const bindHipY = upright(bindV).y || 1;
      const pose0HipY = upright(pose0V).y;

      // SCALE IS PROPORTIONS, so it comes off the BIND pose — how long the legs
      // are, which is true of the rig and not of any one clip. Taking it off
      // frame 0 instead made `get_up` — which begins flat on the floor — divide
      // by a hip height of almost nothing: scale came out 6.5x where every
      // other clip got 1.17, and the figure rose five units into the air.
      const tgtHip = arg.lib.__hipRest || null;
      const hipRest = tgtHip || [0, 0, 0];
      let scale = 1;
      if (bindHipY > 1e-6 && hipRest[1]) scale = hipRest[1] / bindHipY;

      // ANCHORING IS PLACEMENT, and that is a different question. `hipRest` is
      // frame 0 of a clip in the library — a figure standing on its feet — so a
      // clip that also starts on its feet should start there too. Anchored to
      // the bind pose instead, a combat stance (about four fifths of T-pose hip
      // height) was planted a fifth of a leg into the ground and the feet came
      // out below the floor. A clip that starts on the GROUND must not be
      // anchored that way: lift `get_up` to standing and it begins by floating.
      const standing = pose0HipY > 0.6 * bindHipY;
      const srcHipY = standing ? pose0HipY : bindHipY;

      const d = Q(), tmp = Q();
      // ── DID THE SOURCE ACTUALLY MOVE? ────────────────────────────────────
      //
      // The first cut of this tool wrote out the REST POSE — every emitted
      // quaternion exactly `__rest`, constant across all 547 frames of a samba
      // — because the mixer never posed the FBX and every departure came out as
      // identity. Nothing downstream could tell: the clip loaded, parsed,
      // retargeted and played, and the figure stood there translating on its
      // hips track looking intact and faintly alive. A tool that can silently
      // emit a rest pose is worse than one that crashes.
      //
      // AND IT DOES NOT COMPARE THE FIRST FRAME WITH THE LAST. The first cut of
      // this guard did, and reported a samba as motionless: the clip LOOPS, so
      // its last key is its first — and it came back negated, which is the same
      // rotation written the other way round, so even the sign did not give it
      // away. Middle against ends is the reading that survives a loop.
      const d0 = Q(), d1 = Q();
      const spread = (vals, keys) => {
        if (keys < 3) return 0;
        const mid = (keys >> 1) * 4;
        let w = 0;
        for (const o of [0, (keys - 1) * 4]) {
          d0.fromArray(vals, o).normalize();
          d1.fromArray(vals, mid).normalize();
          w = Math.max(w, 2 * Math.acos(Math.min(1, Math.abs(d0.dot(d1)))) / (Math.PI / 180));
        }
        return w;
      };
      let moved = 0;
      for (const t of clip.tracks) if (/\.quaternion$/.test(t.name))
        moved = Math.max(moved, spread(t.values, t.times.length));

      // …AND A THIRD READING: did the RIG respond? A clip can hold motion and
      // still pose nothing, if the mixer's tracks do not bind to the bones this
      // tool is holding — three sanitises `mixamorig:Hips` to `mixamorigHips`,
      // and a binding that misses warns to the console and animates air. Source
      // motion, rig response and output motion are three separate claims and
      // the error message should say which one failed.
      const poseWatch = ['Hips', 'RightHand', 'LeftFoot'].filter(k => mine[k]);
      const poseSeen = poseWatch.map(k => ({ k, q: mine[k].quaternion.clone(), moved: 0 }));

      for (let i = 0; i < n; i++) {
        const t = (i / (n - 1)) * clip.duration;
        // POSE BY THE ACTION'S OWN CLOCK. `mixer.setTime` rewinds every action
        // to zero and re-advances, which is a different thing from asking for a
        // frame and is not the pattern the rest of this repo's probes use.
        action.time = t;
        mixer.update(0);
        root.updateMatrixWorld(true);
        times.push(+t.toFixed(4));
        // the source's global orientation this frame, parents first
        const A = {};
        for (const b of order) {
          const p = parentOf[b];
          A[b] = (p && A[p] ? A[p].clone() : spin.clone()).multiply(mine[b].quaternion).normalize();
        }
        // the same DEPARTURE from rest, carried onto our rest pose
        const At = {};
        for (const b of order) {
          if (!Gtgt[b]) continue;                       // a bone our rig does not have
          // THE DEPARTURE IN WORLD AXES, CARRIED INTO OUR WORLD — see header.
          //     D    = A · Gsrc⁻¹        the bone's turn, in the SOURCE's world
          //     D'   = R · D · R⁻¹       the same turn, in OURS
          //     A_t  = D' · Gtgt
          d.copy(A[b]).multiply(tmp.copy(Gsrc[b]).invert()).normalize();
          d.premultiply(Rq).multiply(Ri).normalize();
          At[b] = d.clone().multiply(Gtgt[b]).normalize();
        }
        // …and back to a LOCAL rotation, against OUR hierarchy rather than the
        // source's — which is the whole reason a spine named backwards matters
        for (const b of tOrder) {
          if (!At[b]) continue;
          const p = tgtPar[b];
          const local = (p && At[p] ? tmp.copy(At[p]).invert().multiply(At[b])
                                    : At[b].clone()).normalize();
          out[b].push(round(local.x), round(local.y), round(local.z), round(local.w));
        }
        for (const w of poseSeen)
          w.moved = Math.max(w.moved,
            2 * Math.acos(Math.min(1, Math.abs(w.q.dot(mine[w.k].quaternion)))) / (Math.PI / 180));
        // ROOT MOTION LIVES IN THE HIPS HERE. Unreal keeps it on a `root` bone
        // this rig does not have, and Build 135 already reads the hips' travel
        // and gives it to the figure's root — so folding one into the other is
        // both the only place it can go and the place the layer expects it.
        if (mine.Hips) {
          const w = upright(mine.Hips.getWorldPosition(new THREE.Vector3()));
          hip.push(round(hipRest[0] + w.x * scale),
                   round(hipRest[1] + (w.y - srcHipY) * scale),
                   round(hipRest[2] + w.z * scale));
        }
      }
      // …and did OUR OUTPUT move? Both halves, because the source clip having
      // motion and the conversion carrying it are two different claims.
      let out_moved = 0;
      for (const b of tOrder) {
        const v = out[b];
        if (!v || v.length < 12) continue;
        out_moved = Math.max(out_moved, spread(v, v.length / 4));
      }
      const tracks = [];
      if (hip.length) tracks.push({ name: 'Hips.position', type: 'vector', times, values: hip });
      for (const b of tOrder) if (out[b] && out[b].length)
        tracks.push({ name: b + '.quaternion', type: 'quaternion', times, values: out[b] });
      return {
        clip: { name: arg.verb, duration: +clip.duration.toFixed(4),
                uuid: 'unreal-' + arg.verb, blendMode: 2500,
                window: [0, +clip.duration.toFixed(4)], tracks },
        naming: map === arg.MAP ? 'unreal' : map === arg.MIXAMO ? 'mixamo' : 'native',
        mapped: Object.keys(mine).length, missing, scale: +scale.toFixed(3),
        source: clip.name, frames: n, dur: +clip.duration.toFixed(2),
        srcMoved: +moved.toFixed(1), outMoved: +out_moved.toFixed(1),
        rigMoved: +Math.max(0, ...poseSeen.map(w => w.moved)).toFixed(1),
        bound: clip.tracks.filter(t => /quaternion$/.test(t.name))
                          .filter(t => !bones[t.name.split('.')[0]]).length,
        doubled,
        others: clips.map(c => c.name).slice(0, 12),
      };
    }, { url, clip: spec.clip || null, verb, MAP, MIXAMO, OURS, spin: +(process.env.SPIN || 0),
         lib: { __rest: lib.__rest, __parent: lib.__parent,
                __hipRest: hipRestOf(lib) } });

    if (got.err) { console.error('  ' + verb + ': ' + got.err); continue; }
    // REFUSE TO WRITE A REST POSE. `outMoved` is how far the furthest joint
    // turns between the first emitted frame and the last; a clip that converted
    // to nothing reads zero here, and writing it would put a corpse in the
    // library that every downstream check would happily call a clip.
    if (got.outMoved < 1) {
      console.error('  ' + verb + ': CONVERTED TO NOTHING — clip ' + got.srcMoved
        + '°, rig ' + got.rigMoved + '°, output ' + got.outMoved + '°.'
        + (got.srcMoved < 1
            ? ' The clip itself holds no rotation.'
            : got.rigMoved < 1
              ? ' The clip holds motion but the RIG never moved: '
                + got.bound + ' of its rotation tracks name a node this tool did'
                + ' not find as a bone'
                + (got.doubled ? ', and ' + got.doubled + ' bone names resolve to a'
                                 + ' DIFFERENT object than a traversal finds — two'
                                 + ' skeletons sharing names.' : '.')
              : ' The rig moved, so the conversion dropped it downstream.'));
      continue;
    }
    lib[verb] = got.clip;
    if (spec.beat) lib[verb].beat = spec.beat;
    if (spec.loop) lib[verb].loop = true;
    report.push({ verb, ...got, clip: undefined });
    console.log(`  ${verb.padEnd(10)} ${got.naming.padEnd(7)} ${got.mapped} bones`
      + `  ${got.dur}s/${got.frames}f  scale ${got.scale}`
      + `  turns clip ${got.srcMoved}° rig ${got.rigMoved}° out ${got.outMoved}°`
      + (got.doubled ? `  (${got.doubled} doubled bone names)` : '')
      + (got.missing.length ? '  MISSING ' + got.missing.join(',') : '')
      + `  <- ${got.source}`);
  }
  await browser.close();
  server.close();
  fs.writeFileSync(OUT, JSON.stringify(lib));
  console.log('wrote ' + OUT + '  ' + (fs.statSync(OUT).size / 1024).toFixed(0) + 'kB');
  console.log('now run:  node v2.3/tools/rewindow.cjs ' + OUT);
})().catch(e => { console.error('FATAL', e); process.exit(1); });

// The library's own hips rest, read off frame 0 of any clip that carries one —
// the same anchor `tools/parry.mjs` uses, and the thing an imported stride is
// rescaled into.
function hipRestOf(lib) {
  for (const k of Object.keys(lib)) {
    if (k.startsWith('__') || !lib[k].tracks) continue;
    const t = lib[k].tracks.find(x => x.name === 'Hips.position');
    if (t) return [t.values[0], t.values[1], t.values[2]];
  }
  return null;
}
