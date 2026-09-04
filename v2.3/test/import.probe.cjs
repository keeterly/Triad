'use strict';
// DID THE IMPORT KEEP THE POSE?
//
// Three earlier attempts at this number were each invalid, and the way they
// failed is the point:
//
//   1. World positions, driving the SOURCE skeleton with a clip expressed
//      against OUR rest pose — precisely the mismatch the retarget exists to
//      resolve. Errors larger than the limbs, confidently produced.
//   2. Bone directions in world space — added our characters' facing yaw to
//      every segment. A yaw barely moves a near-vertical thigh and moves a
//      horizontal arm by its full angle, so it looked like an arm bug.
//   3. Normalising by the hips' world quaternion — Meshy's Hips has a bind
//      orientation of (-0.49,-0.49,-0.58,0.43), which is not a body frame.
//
// What survives both different proportions and different orientations is a
// BASIS BUILT FROM THE BODY ITSELF: up from hips to head, right across the
// shoulders, forward their cross product — computed separately on each
// skeleton, every frame, from its own posed landmarks. Express every segment
// in that basis and the comparison no longer knows or cares that one figure is
// taller than the other or turned to face a different way.
const { boot } = require('./harness.cjs');
const SRC = process.argv[2] || '/import/samba.fbx';
const CLIP = process.argv[3] || 'testsamba';
(async () => {
  const { J, sleep, browser, page } = await boot({ query: 'cast=3d' });
  page.on('pageerror', e => console.log('PAGE ERROR', e.message));
  await sleep(600);
  await J(() => startCombat({ foes: ['husk'] }));
  for (let i = 0; i < 60 && !(await J(() => !!(window.Cast3D && window.Cast3D._figure('ash')))); i++) await sleep(250);

  const out = await J(async ({ src, clipName }) => {
    const THREE = await import('/v2.3/lib/three.module.min.js');
    const { FBXLoader } = await import('/v2.3/tools/lib/FBXLoader.js');
    const fbx = await new FBXLoader().loadAsync(src);
    const sb = {};
    fbx.traverse(o => { if (o.isBone) sb[o.name.replace(/^mixamorig[:_]?/i, '')] = o; });
    const sclip = fbx.animations[0];

    const C3 = window.Cast3D, f = C3._figure('ash');
    const a = f.actions[clipName];
    if (!a) return { err: 'no "' + clipName + '" in the library' };
    for (const k of Object.keys(f.actions)) { f.actions[k].setEffectiveWeight(0); f.actions[k].stop(); }
    if (f.idle) f.idle.setEffectiveWeight(0);
    // ── WHAT THE RETARGET ACTUALLY PROMISES ──
    //
    // Four invalid metrics taught this one, and each failed differently:
    //
    //   1. World POSITIONS, driving the source skeleton with a clip expressed
    //      against our rest — the exact mismatch the retarget resolves.
    //   2. Bone DIRECTIONS in world space — added our characters' facing yaw to
    //      every segment. A yaw barely moves a vertical thigh and moves a
    //      horizontal arm by its full angle, so it looked like an arm bug.
    //   3. Normalising by the hips' world quaternion — Meshy's Hips bind is
    //      (-0.49,-0.49,-0.58,0.43), which is not a body frame.
    //   4. Directions in a body-relative basis — valid, and still the wrong
    //      QUESTION: departure-based retargeting preserves relative motion, not
    //      absolute pose, so comparing poses measures the two REST POSES.
    //
    // The contract is: our bone's departure from OUR rest equals the source
    // bone's departure from ITS rest. And the ANGLE of a departure is invariant
    // under a change of frame — conjugating a rotation does not change how far
    // it turns — so this needs no common basis at all, which is what every
    // previous attempt got wrong. Both rests are OBSERVED rather than read off
    // bind matrices, because a bind matrix is in the space the model loaded in
    // and our figures have been moved and turned since.
    const D = Math.PI / 180, N = 30;
    const JOINTS = ['LeftShoulder','LeftArm','LeftForeArm','LeftHand',
                    'RightShoulder','RightArm','RightForeArm','RightHand',
                    'LeftUpLeg','LeftLeg','LeftFoot',
                    'RightUpLeg','RightLeg','RightFoot','Head','Hips'];

    // ── NO REST POSE AT ALL ──
    //
    // Four attempts at this measurement needed one, and every way of getting
    // one was wrong: bind matrices live in the space the model loaded in and
    // our figures have been turned since; zeroing the weights to read the bind
    // pose left the action unable to pose the body afterwards, and the metric
    // reported perfect agreement with a corpse.
    //
    // None of it is necessary. Each rig's FIRST FRAME is a reference both of
    // them already have. Measure how far each joint has turned from its own
    // frame zero, and compare those two numbers. The angle of a rotation is
    // unchanged by a change of frame, so this needs no common basis, no bind
    // matrix and no rest pose — and the two clips are the same performance, so
    // frame zero means the same instant on both.
    const smix2 = new THREE.AnimationMixer(fbx);
    smix2.clipAction(sclip).play();
    a.reset(); a.setEffectiveWeight(1); a.play(); a.paused = true;
    const wq = (b2) => b2.getWorldQuaternion(new THREE.Quaternion());
    const angOf = (q) => 2 * Math.acos(Math.min(1, Math.abs(q.w))) / D;
    const sample = (u) => {
      a.time = a.getClip().duration * u; f.mixer.update(0); f.root.updateMatrixWorld(true);
      smix2.setTime(sclip.duration * u); fbx.updateMatrixWorld(true);
    };
    const handAt = () => { const e = f.bones.RightHand.matrixWorld.elements;
                           return [+e[12].toFixed(3), +e[13].toFixed(3)]; };
    sample(0);
    const s0 = {}, o0 = {};
    for (const j of JOINTS) { if (sb[j]) s0[j] = wq(sb[j]); if (f.bones[j]) o0[j] = wq(f.bones[j]); }

    const acc = {};
    for (const j of JOINTS) acc[j] = { src: 0, ours: 0, gap: 0, worst: 0, n: 0 };
    for (let i = 1; i < N; i++) {
      sample(i / (N - 1));
      for (const j of JOINTS) {
        if (!s0[j] || !o0[j]) continue;
        const ds = angOf(wq(sb[j]).multiply(s0[j].clone().invert()).normalize());
        const dt = angOf(wq(f.bones[j]).multiply(o0[j].clone().invert()).normalize());
        acc[j].src += ds; acc[j].ours += dt;
        const g = Math.abs(ds - dt);
        acc[j].gap += g; acc[j].worst = Math.max(acc[j].worst, g); acc[j].n++;
      }
    }
    // A METRIC THAT CANNOT TELL "PERFECT" FROM "NOT RUNNING" IS NOT A METRIC.
    const alive = JOINTS.some(j => acc[j].n && acc[j].ours / acc[j].n > 1);
    if (!alive) return { err: 'our figure never moved — any agreement this'
      + ' reported would be agreement with a corpse',
      hands: [0, 0.25, 0.5, 0.75].map(u => { sample(u); return handAt(); }),
      action: { enabled: a.enabled, weight: a.getEffectiveWeight(), paused: a.paused,
                dur: +a.getClip().duration.toFixed(2) },
      acc: Object.fromEntries(Object.entries(acc).slice(0, 4).map(([k, v]) => [k, v])),
      keys: { src: Object.keys(s0).length, ours: Object.keys(o0).length } };
    const rep = {};
    for (const j of JOINTS) if (acc[j].n) rep[j] = {
      srcTurn: +(acc[j].src / acc[j].n).toFixed(1),
      ourTurn: +(acc[j].ours / acc[j].n).toFixed(1),
      gap: +(acc[j].gap / acc[j].n).toFixed(1),
      worst: +acc[j].worst.toFixed(1) };
    return rep;
  }, { src: SRC, clipName: CLIP });

  if (out.err) { console.log(JSON.stringify(out, null, 1)); }
  else {
    let worst = 0, sum = 0, n = 0;
    for (const k of Object.keys(out)) {
      const r = out[k];
      console.log(k.padEnd(16), 'source turns', String(r.srcTurn).padStart(6) + '°',
                  ' ours', String(r.ourTurn).padStart(6) + '°',
                  ' gap', String(r.gap).padStart(6) + '°',
                  ' worst', String(r.worst).padStart(6) + '°');
      sum += r.gap; n++; worst = Math.max(worst, r.worst);
    }
    console.log('\nmean gap'.padEnd(16), (sum / n).toFixed(1) + '°   worst ' + worst.toFixed(1) + '°');
  }
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
