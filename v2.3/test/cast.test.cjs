// KIZUNA v2.3 — THE CAST GATE. Are the three of them actually standing there,
// and does the fight move them?
//
// This suite is the only one that boots `?cast=3d`. Everything else runs the
// painted stage, on purpose: the 3D layer is opt-in, and the proof that it is
// opt-in is that two hundred and fifty-seven checks elsewhere never see it.
//
// What it gates is the SEAM, not the art. Whether a robe looks good is a
// judgement; whether the figure is drawn into the box the DOM put the hero in,
// whether the idle is actually moving bones between turns, and whether each
// verb the fight already speaks reaches a clip — those are facts, and each one
// of them was broken at least once while this was being written.
'use strict';
const { boot } = require('./harness.cjs');

(async () => {
  const { page, J, sleep, check, report, shot, browser, ctx } = await boot({ query: 'cast=3d' });

  // ═══ A · THE LAYER IS THERE, OR IT SAID WHY NOT ═══
  console.log('\n── the layer ──');
  // loading a 678 KB model over a local server, decoding a webp and compiling
  // two shaders is not instant; the layer announces itself when it is ready
  await page.waitForFunction(
    () => window.Cast3D && window.Cast3D._state().ready, null, { timeout: 30000 }
  ).catch(() => {});
  // THE LAYER IS READY WITH THE PARTY; THE BESTIARY ARRIVES BEHIND IT. Build
  // 123's five creatures are 16.6 MB, which is a blank battlefield on a phone
  // and an eight-second timeout here, so `ready` now means the party is
  // standing and each creature is fetched when it is wanted. A census of the
  // whole cast has to say so — and this waits on the real loads rather than on
  // a sleep, so it also fails honestly if one of them never arrives.
  // READY MEANS THE PARTY IS STANDING. That is the whole claim the split makes,
  // and it is the one worth asserting, because the alternative — asserting that
  // NO creature has arrived yet — is a race the warm queue would win half the
  // time. Three heroes, no failures, whatever the bestiary is doing.
  const atReady = await J(() => (window.Cast3D ? window.Cast3D._state() : null));
  check('LOAD: the layer is ready when the PARTY is standing, not the bestiary',
    !!atReady && atReady.ready && !atReady.failed && !atReady.missing.length
    && ['ash', 'elin', 'mira'].every(id => atReady.figures.indexOf(id) >= 0),
    JSON.stringify({ ready: atReady && atReady.ready, figures: atReady && atReady.figures,
                     missing: atReady && atReady.missing }));

  await J(() => (window.Cast3D && window.Cast3D.warm ? window.Cast3D.warm() : null));
  const st = await J(() => (window.Cast3D ? window.Cast3D._state() : null));

  check('LAYER: ?cast=3d builds the layer and it comes up without excuses',
    !!st && st.on && st.ready && !st.failed, JSON.stringify(st && { on: st.on, ready: st.ready, failed: st.failed }));

  // FOUR NOW: the party and the thing they are fighting. The foe is not a
  // special case anywhere in the layer — same rig, same retarget, same clip
  // library — which is the return on having done the retargeting properly. A
  // new foe costs a model and no animation at all.
  // EIGHT NOW: three heroes and every creature they can meet. A foe is not a
  // special case anywhere in this layer — same rig, same retarget, same clip
  // library — which is the whole return on having done the retargeting
  // properly. Five creatures cost five models and no animation at all.
  check('LAYER: the party AND EVERY creature are on one rig, 24 bones each',
    !!st && st.figures.length === 8 && st.bones === 24 && st.foes.length === 5
    && !st.missing.length,
    JSON.stringify({ figures: st && st.figures, foes: st && st.foes,
                     bones: st && st.bones, missing: st && st.missing }));

  // THE VERBS THE FIGHT ALREADY SPEAKS. actionKind() has returned these four
  // since Build 36; if a clip goes missing the wiring fails silently, because
  // castPlay() is a no-op by design.
  const verbs = ['heal', 'cast', 'slash', 'ward', 'idle', 'hurt', 'parry', 'down'];
  const resolved = await J((vs) => {
    const out = {};
    for (const id of ['ash', 'elin', 'mira', 'mourner'])
      for (const v of vs) out[id + '.' + v] = window.Cast3D._verbClip(id, v);
    return out;
  }, verbs);
  check('LAYER: every verb the fight speaks resolves to a clip in the library',
    Object.values(resolved).every(c => c && st.clips.indexOf(c) >= 0),
    JSON.stringify(st && st.clips));

  // A LONGSWORD, A STAFF AND A PAIR OF DAGGERS ARE THREE DIFFERENT FIGHTS. If
  // `slash` collapsed to one clip the party would swing identically and the
  // whole point of giving them their own models would be lost below the neck.
  check('LAYER: slash is a different motion for each of them',
    resolved['ash.slash'] === 'sword' && resolved['elin.slash'] === 'staff'
    && resolved['mira.slash'] === 'daggers',
    JSON.stringify({ ash: resolved['ash.slash'], elin: resolved['elin.slash'],
                     mira: resolved['mira.slash'] }));

  // …and everything else IS shared, which is what makes one library enough.
  check('LAYER: the other verbs are one motion the whole cast shares',
    ['cast', 'heal', 'ward', 'parry', 'hurt', 'down'].every(v =>
      resolved['ash.' + v] === resolved['elin.' + v]
      && resolved['elin.' + v] === resolved['mira.' + v]
      && resolved['mira.' + v] === resolved['mourner.' + v]),
    JSON.stringify(['cast', 'heal', 'ward'].map(v => resolved['ash.' + v])));

  const canvas = await J(() => {
    const c = document.getElementById('k-cast3d');
    if (!c) return null;
    const host = document.getElementById('k-cast');
    const a = c.getBoundingClientRect(), b = host.getBoundingClientRect();
    return { w: Math.round(a.width), h: Math.round(a.height),
             hostW: Math.round(b.width), hostH: Math.round(b.height),
             buffer: [c.width, c.height],
             under: [...host.children].indexOf(c) === 0,
             clicks: getComputedStyle(c).pointerEvents,
             bodyFlag: document.body.classList.contains('k-cast3d') };
  });
  // IT MAY NOT EAT THE TAPS. Everything on this stage is drag-and-drop; a
  // canvas laid over the heroes that accepted pointer events would kill
  // aiming, dragging and row-changing in one line of CSS.
  check('LAYER: the canvas covers the stage, sits under the heroes, and takes no taps',
    !!canvas && canvas.w === canvas.hostW && canvas.h === canvas.hostH
    && canvas.under && canvas.clicks === 'none' && canvas.bodyFlag,
    JSON.stringify(canvas));

  // ═══ B · THE PICTURE MOVED FROM THE IMG TO THE CANVAS ═══
  console.log('\n── the swap ──');
  const swap = await J(() => {
    const h = document.querySelector('.k-hero[data-hero="ash"]');
    const img = h.querySelector('.k-fig img');
    return { imgStillThere: !!img,
             imgHidden: img ? +getComputedStyle(img).opacity === 0 : false,
             // …and the ELEMENT is untouched: still laid out, still hit-testable,
             // still carrying its row plate and its shadow
             heroBox: Math.round(h.getBoundingClientRect().width),
             rowPlate: !!h.querySelector('.k-hero-row b'),
             shadow: !!h.querySelector('.k-shadow') };
  });
  check('SWAP: the 2D plate is hidden but the hero ELEMENT is fully intact',
    swap.imgStillThere && swap.imgHidden && swap.heroBox > 40
    && swap.rowPlate && swap.shadow, JSON.stringify(swap));

  // ═══ C · SOMETHING IS ACTUALLY DRAWN, AND IN THE RIGHT BOX ═══
  // A layer that builds, reports ready and paints nothing passes every check
  // above. So: read the pixels, in each hero's box, off the real canvas.
  console.log('\n── ink on the canvas ──');
  await sleep(500);
  // THE COPY IS TAKEN INSIDE THE FRAME THAT DREW IT. A WebGL canvas without
  // `preserveDrawingBuffer` is empty by the time anyone else looks at it, and
  // reading it cold reports "the layer paints nothing" about a layer that is
  // painting fine. That is a fact about the instrument; the flag costs real
  // performance on a phone, so the layer hands out a snapshot instead.
  await J(() => window.Cast3D._snapshot());
  const painted = await J(() => {
    const c = window.__castShot;
    const host = document.getElementById('k-cast');
    const b = host.getBoundingClientRect();
    const sx = c.width / b.width, sy = c.height / b.height;
    const cx = c.getContext('2d');
    const out = {};
    const SEL = { ash: '.k-hero[data-hero="ash"]', elin: '.k-hero[data-hero="elin"]',
                  mira: '.k-hero[data-hero="mira"]', mourner: '#k-boss-art' };
    for (const id of ['ash', 'elin', 'mira', 'mourner']) {
      const r = document.querySelector(SEL[id]).getBoundingClientRect();
      const x = Math.round((r.left - b.left) * sx), y = Math.round((r.top - b.top) * sy);
      const w = Math.max(1, Math.round(r.width * sx)), hh = Math.max(1, Math.round(r.height * sy));
      const d = cx.getImageData(x, y, w, hh).data;
      let lit = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 24) lit++;
      out[id] = +(lit / (w * hh)).toFixed(3);
    }
    // …and OUTSIDE every hero box the canvas must be empty, which is what
    // proves the scissor is doing its job rather than the figures happening to
    // land somewhere plausible
    const all = cx.getImageData(0, 0, c.width, c.height).data;
    let litAll = 0;
    for (let i = 3; i < all.length; i += 4) if (all[i] > 24) litAll++;
    return { boxes: out, litAll };
  });
  const boxes = painted.boxes;
  check('INK: a figure is painted inside every actor\u2019s own box, foe included',
    ['ash', 'elin', 'mira', 'mourner'].every(id => boxes[id] > 0.06),
    JSON.stringify(boxes));

  const inBoxes = await J(() => {
    const b = document.getElementById('k-cast').getBoundingClientRect();
    const c = window.__castShot;
    const sx = c.width / b.width, sy = c.height / b.height;
    const SEL = { ash: '.k-hero[data-hero="ash"]', elin: '.k-hero[data-hero="elin"]',
                  mira: '.k-hero[data-hero="mira"]', mourner: '#k-boss-art' };
    return ['ash', 'elin', 'mira', 'mourner'].reduce((n, id) => {
      const r = document.querySelector(SEL[id]).getBoundingClientRect();
      return n + Math.round(r.width * sx) * Math.round(r.height * sy);
    }, 0);
  });
  // THIS CHECK USED TO SAY "the scissor holds" — nothing is drawn outside the
  // four hero boxes — and it was the right check for a layer that drew each
  // figure into its own scissored rectangle. Build 119 deleted the scissor on
  // purpose: there is one world now, and the ink outside the boxes is the
  // contact shadows the figures throw onto the floor, which is the entire
  // point of the floor being real.
  //
  // So the question changes rather than relaxes. Ink outside the boxes is
  // EXPECTED, and what must stay true is that it is a modest amount of it —
  // shadow pooling near the party, not a slab repainting the plaza. The first
  // version of the floor was exactly that slab, and this is the number that
  // would have caught it: it lit 2.3x the box area.
  // COUNTING LIT PIXELS IS THE WRONG QUESTION. A pixel at 8% alpha and a pixel
  // at 100% both count as "lit", so a faint wash over the plaza and a slab
  // painted on top of it score the same — and the slab was the actual bug this
  // is here to catch. What matters is how much the layer OBSCURES, which is
  // mean alpha: the painted plaza has to read through whatever the floor puts
  // over it. A shadow that lands and a wash that whispers come out around a
  // tenth; the first version of the floor, an opaque lit plane across the lower
  // half of the frame, came out above a third.
  const outside = await J(() => {
    const b = document.getElementById('k-cast').getBoundingClientRect();
    const c = window.__castShot;
    const sx = c.width / b.width, sy = c.height / b.height;
    const SEL = ['.k-hero[data-hero="ash"]', '.k-hero[data-hero="elin"]',
                 '.k-hero[data-hero="mira"]', '#k-boss-art'];
    const boxes = SEL.map(s => {
      const r = document.querySelector(s).getBoundingClientRect();
      return { x0: (r.left - b.left) * sx, x1: (r.right - b.left) * sx,
               y0: (r.top - b.top) * sy, y1: (r.bottom - b.top) * sy };
    });
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let sum = 0, n = 0, lum = 0, lum2 = 0;
    for (let y = 0; y < c.height; y += 2) for (let x = 0; x < c.width; x += 2) {
      if (boxes.some(q => x >= q.x0 && x <= q.x1 && y >= q.y0 && y <= q.y1)) continue;
      const i = (y * c.width + x) * 4;
      sum += d[i + 3];
      const L = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      lum += L; lum2 += L * L; n++;
    }
    const mean = lum / n;
    return { meanAlpha: +(sum / n / 255).toFixed(4),
             spread: +Math.sqrt(Math.max(0, lum2 / n - mean * mean)).toFixed(1),
             meanLum: +mean.toFixed(1), sampled: n };
  });
  // THIS CHECK HAS NOW BEEN WRONG TWICE, IN OPPOSITE DIRECTIONS, and both times
  // because the layer changed what it IS rather than what it draws.
  //
  //   Build 118: it counted lit pixels, so a wash at 8% alpha and a slab at
  //   100% scored the same — and the slab was the bug it existed to catch.
  //   Build 119: it measured mean alpha, which was right for a transparent
  //   layer floating over a painted plate. Build 120 retired the plate. The
  //   layer is the whole scene now, so alpha is 1 everywhere by design and the
  //   check failed on a world that had just started working properly.
  //
  // What is worth asserting outlives both: the frame is PAINTED and it is not
  // painted FLAT. A world that renders nothing and a world that renders one
  // grey fill are the two real failures, and tonal spread separates a floor
  // receding into mist from either of them.
  check('INK: the world fills the frame, and it is a place rather than a fill',
    outside.meanAlpha > 0.9 && outside.spread > 12,
    JSON.stringify(outside));

  // ═══ D · THE IDLE IS ACTUALLY MOVING ═══
  // The single most important clip in a turn-based game: almost all of the
  // fight is spent with nobody acting, and a frozen 3D figure reads as a
  // BROKEN 3D figure where a frozen painting reads as a painting.
  console.log('\n── the idle ──');
  // SAMPLED ACROSS THE WHOLE CYCLE, not two instants apart. The idle is
  // deliberately calm now — a slower loop at less than full weight, because
  // `Combat_Stance` at full strength reads as three people hunching — and two
  // samples 700ms apart can land either side of a pause and report a corpse.
  // What matters is that the loop HAS amplitude, so the range over a full
  // cycle is the thing to measure.
  const idleSwing = await J(async () => {
    // ACROSS THE WHOLE SKELETON, not one bone chosen in advance. The first two
    // versions of this check watched the Spine, and `Combat_Stance` is a
    // weight-shift idle: its motion lives in the legs and the head, and the
    // spine barely turns a seventh of a degree. It reported three living
    // figures as corpses. Which bone carries an idle is a property of the clip,
    // so the check asks the only question that survives a clip swap — is
    // ANYTHING moving?
    // ALL FOUR AT ONCE, not one after another. Watching each figure for its
    // own eighty frames is four times the frames for no more information —
    // and the frames are the expensive part here, because Build 119 fills the
    // whole viewport rather than four small boxes and the harness rasterises
    // in software. Sampling them together also compares them under identical
    // conditions, which is what the next check actually wants.
    // ANGLES BETWEEN QUATERNIONS, NOT DIFFERENCES OF EULERS. Decomposing to
    // XYZ and subtracting reports a 359-degree swing for a joint that crosses
    // +-180 — which is exactly what the Regent's calmest bone did, coming out
    // as the liveliest motion in the cast. The angle between two rotations is
    // 2*acos(|dot|) and cannot exceed 180 by construction.
    //
    // ALL FOUR AT ONCE, AND ONE CALL PER FRAME. Watching each figure for its
    // own eighty frames is four times the frames for no more information, and
    // asking for twenty-four bones one at a time is twenty-four round trips
    // per frame. The frames are the expensive part: Build 119 fills the whole
    // viewport rather than four small boxes, and the harness rasterises in
    // software. Sampling them together also compares them under identical
    // conditions, which is what the next check actually wants.
    const ids = Object.keys(window.Cast3D._state().playing);
    const first = {}, widest = {};
    for (const id of ids) { window.Cast3D._figure(id).clear(); widest[id] = { deg: 0, bone: null }; }
    // TWENTY-FOUR FRAMES IS SIX CYCLES HERE, NOT A QUARTER OF ONE. The mixer
    // advances by REAL elapsed time, and the harness runs at under two frames a
    // second, so each frame carries up to the dt clamp — a quarter of a second
    // of animation. Eighty of them was fifty seconds of wall clock to watch a
    // 1.7-second loop, and it was the most expensive thing in the file.
    for (let i = 0; i < 24; i++) {
      await new Promise(r => requestAnimationFrame(r));
      for (const id of ids) {
        const pose = window.Cast3D._bonePose(id);
        if (!first[id]) { first[id] = pose; continue; }
        for (const n of Object.keys(pose)) {
          const a = first[id][n], b = pose[n];
          const dot = Math.abs(a[0]*b[0] + a[1]*b[1] + a[2]*b[2] + a[3]*b[3]);
          const deg = 2 * Math.acos(Math.min(1, dot)) * 180 / Math.PI;
          if (deg > widest[id].deg) widest[id] = { deg: +deg.toFixed(2), bone: n };
        }
      }
    }
    return widest;
  });
  check('IDLE: nobody is holding their breath — every figure moves between turns',
    Object.values(idleSwing).every(v => v.deg > 1.5),
    JSON.stringify(idleSwing) + ' — widest swing over a cycle');

  // …and the three of them are NOT in lockstep. Three copies of one model
  // breathing on the same frame is worse than three still ones.
  // …read off a bone this idle actually drives, for the same reason
  const phases = await J(() => Object.fromEntries(
    Object.keys(window.Cast3D._state().playing)
      .map(id => [id, window.Cast3D._boneAngle(id, 'LeftLeg')])));
  const apart = (a, b) => a && b && a.some((v, i) => Math.abs(v - b[i]) > 0.02);
  check('IDLE: the three of them breathe out of step with each other',
    apart(phases.ash, phases.elin) && apart(phases.elin, phases.mira)
    && apart(phases.mira, phases.mourner),
    JSON.stringify(phases));

  // ═══ D2 · THE PACE, AND THE SEAM ═══
  //
  // Neither of these had a check, and both shipped broken for three builds.
  console.log('\n── the pace ──');
  const pace = await J(() => window.Cast3D._pace('ash'));

  // NOTHING IS FAST-FORWARDED. Build 118 measured where a clip's motion lives
  // and kept 86% of it, then divided that span by the beat — composing two
  // reasonable questions into a bad answer. A sword swing came out 3.05 seconds
  // against a one-second beat and played at 3.05x; a parry at 3.52x. Past about
  // a quarter over, motion stops reading as motion and reads as a fault. The
  // window is chosen BY the beat now, so the division lands just over one.
  const rates = Object.fromEntries(Object.entries(pace).map(([k, v]) => [k, v.rate]));
  check('PACE: no clip is fast-forwarded — everything plays near the speed it was authored at',
    Object.values(pace).every(v => v.rate >= 0.85 && v.rate <= 1.35),
    JSON.stringify(rates));

  // A LOOP HAS TO CLOSE ON ITSELF. You cannot cut an arbitrary window out of a
  // loop and expect it to loop: the pose you cut in at is not the pose you cut
  // out at. Windowing the idle took its seam from the 1.4 degrees it was
  // authored with to 7.2 — a snap once a cycle, on the one clip that is on
  // screen almost all the time, and the reason it read as unnatural.
  const seams = await J((names) => Object.fromEntries(
    names.map(n => [n, window.Cast3D._seam('ash', n)])),
    Object.keys(pace).filter(n => pace[n].loop));
  check('LOOP: every looping clip closes on itself, so it does not snap once a cycle',
    Object.keys(seams).length > 0 && Object.values(seams).every(v => v != null && v < 3),
    JSON.stringify(seams) + ' degrees between the first pose and the last');

  // ═══ E · EVERY VERB REACHES A CLIP ═══
  console.log('\n── the verbs ──');
  for (const v of ['slash', 'cast', 'ward', 'heal', 'hurt', 'parry']) {
    const got = await J((clip) => {
      window.Cast3D.play('ash', clip);
      return { playing: window.Cast3D._state().playing.ash,
               want: window.Cast3D._verbClip('ash', clip) };
    }, v);
    check('VERB: ' + v + ' plays', got.playing === got.want, JSON.stringify({ asked: v, ...got }));
  }

  // A CLIP RETURNS TO IDLE ON ITS OWN. If it did not, the first strike of a
  // fight would leave that hero frozen mid-swing for the rest of the run.
  // WAITED FOR, NOT SLEPT THROUGH. A fixed sleep here measures the harness's
  // frame rate as much as the clip: headless runs rAF several times slower
  // than a phone does, so "still playing after 900ms" said nothing about
  // whether the clip ends.
  const freed = await J(async () => {
    const f = window.Cast3D._figure('ash');
    window.Cast3D.play('ash', 'hurt');
    const t0 = performance.now();
    while (performance.now() - t0 < 6000) {
      await new Promise(r => setTimeout(r, 60));
      if (!f.clipName) return { cleared: true, ms: Math.round(performance.now() - t0) };
    }
    return { cleared: false, t: f.t, name: f.clipName };
  });
  check('VERB: a clip hands the body back when it is done',
    freed.cleared, JSON.stringify(freed));

  // …except DOWN, which holds. A hero who stands back up mid-fall would be the
  // funniest bug in the game and the least readable.
  await J(() => window.Cast3D.play('elin', 'down'));
  await sleep(1200);
  const held = await J(() => window.Cast3D._state().playing.elin);
  check('VERB: down HOLDS — a dead hero does not stand back up',
    held === 'down', JSON.stringify({ playing: held }));
  await J(() => window.Cast3D.play('elin', 'idle'));
  const up = await J(() => window.Cast3D._state().playing.elin);
  check('VERB: asking for idle by name means stop acting, not play idle once',
    up === null, JSON.stringify({ playing: up }));

  // ═══ E2 · AND THE POSE ACTUALLY REACHES THE PIXELS ═══
  // Every check above passes on a rig whose bones move and whose MESH does
  // not — which is exactly what happens when skinning silently drops out
  // (a raw ShaderMaterial without the skinning chunks, a clone that shares the
  // original's skeleton). Both of those happened while this was written, and
  // both look like an art problem from anywhere except a pixel diff.
  console.log('\n── the pose reaches the pixels ──');
  const silhouette = await J(async () => {
    const shot = async () => {
      await window.Cast3D._snapshot();
      const c = window.__castShot;
      const b = document.getElementById('k-cast').getBoundingClientRect();
      const sx = c.width / b.width, sy = c.height / b.height;
      const r = document.querySelector('.k-hero[data-hero="ash"]').getBoundingClientRect();
      const w = Math.round(r.width * sx), h = Math.round(r.height * sy);
      const d = c.getContext('2d').getImageData(
        Math.round((r.left - b.left) * sx), Math.round((r.top - b.top) * sy), w, h).data;
      // ALPHA STOPPED BEING A SILHOUETTE IN BUILD 120. The layer used to be a
      // transparent sheet over a painted plate, so "is this pixel opaque" WAS
      // "is this pixel the figure", and counting opaque pixels counted the
      // body. The world fills the frame now, every pixel is opaque, and the
      // check duly reported that no action changes anything.
      //
      // Thresholding on TONE instead was the next wrong answer: the floor
      // inside a hero's box has bright and dark pixels of its own, so two
      // thirds of the box came out "changed" for every verb and a knock-down
      // could not stand out from a parry.
      //
      // What actually answers the question is the PICTURE, compared with
      // itself. The background does not move between two frames of the same
      // shot, so it cancels; what is left is the figure. No threshold on what
      // a figure looks like, which is the assumption that broke twice.
      const lum = [];
      for (let i = 0; i < d.length; i += 4)
        lum.push(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
      return { mask: lum, lit: lum.length };
    };
    // THE MIXER'S CLOCK IS DRIVEN DIRECTLY. Sleeping for a chosen number of
    // milliseconds measures the harness's frame rate, not the clip — headless
    // advances animation at about a third of real time, which is how four
    // screenshots of four different actions once came out looking identical.
    const f = window.Cast3D._figure('ash');
    const hold = async (verb, frac) => {
      window.Cast3D.play('ash', verb);
      const a = f.acting;
      if (a) { a.time = a.getClip().duration * frac; a.setEffectiveWeight(1); }
      await new Promise(r => requestAnimationFrame(() => {
        if (a) { a.time = a.getClip().duration * frac; a.setEffectiveWeight(1); }
        requestAnimationFrame(r);
      }));
      return shot();
    };
    f.clear();
    await new Promise(r => requestAnimationFrame(r));
    const base = await shot();
    const out = {}, shots = {};
    for (const [verb, t] of [['slash', 0.55], ['cast', 0.55], ['ward', 0.45], ['down', 0.95]]) {
      const s = await hold(verb, t);
      let diff = 0;
      for (let i = 0; i < base.mask.length; i++)
        if (Math.abs(base.mask[i] - s.mask[i]) > 16) diff++;
      out[verb] = +(diff / base.lit * 100).toFixed(1);
      shots[verb] = s.mask;
    }
    // …AND EACH VERB AGAINST THE OTHERS. This is the failure the whole section
    // exists for: when skinning silently drops out — a raw ShaderMaterial
    // without the skinning chunks, a clone sharing the original's skeleton —
    // every action renders the SAME bind pose. Each one still differs from the
    // idle, so measuring only against the idle passes; what collapses is the
    // difference between them, and that is a thing to measure rather than to
    // hope for.
    const verbs = Object.keys(shots);
    out.apart = 100; out.closest = null;
    for (let a = 0; a < verbs.length; a++) for (let b2 = a + 1; b2 < verbs.length; b2++) {
      let d2 = 0;
      for (let i = 0; i < base.mask.length; i++)
        if (Math.abs(shots[verbs[a]][i] - shots[verbs[b2]][i]) > 16) d2++;
      const pct = +(d2 / base.lit * 100).toFixed(1);
      if (pct < out.apart) { out.apart = pct; out.closest = verbs[a] + '/' + verbs[b2]; }
    }
    f.clear();
    return out;
  });
  // THE `down > 20` HALF OF THIS WAS A NUMBER READ OFF ONE RENDERER. Build 119
  // moved every figure into a shared perspective world, which changes what
  // fraction of a box a pose occupies for reasons that have nothing to do with
  // whether skinning works — and the check duly failed at 18.9% on animation
  // that is completely correct. The property worth asserting is not a
  // percentage: it is that every action visibly redraws the body, and that
  // being knocked to the ground redraws it by far the most. That survives a
  // camera change, a model swap and a new clip; a threshold does not.
  // THE `down > 20%` HALF OF THIS WAS A NUMBER READ OFF ONE RENDERER, and it
  // has now been wrong under two of them: the alpha silhouette that produced it
  // made a knock-down look twice as large as a swing, and a picture diff — a
  // better instrument — puts them at 32 against 27, because every action moves
  // a great deal of the body. "Down dwarfs the rest" was a property of the
  // measurement, not of the game.
  //
  // What the section is actually guarding is that the POSE REACHES THE PIXELS,
  // and its real enemy is skinning dropping out, which makes every verb render
  // the same bind pose. So: every action repaints a solid part of the figure,
  // and no two actions look alike. Both survive a camera change, a model swap
  // and a new clip; neither is a threshold anybody had to choose.
  check('POSE: an action visibly changes the figure, not just its bone numbers',
    ['slash', 'cast', 'ward', 'down'].every(c => silhouette[c] > 8),
    JSON.stringify(silhouette) + ' % of the box repainted');
  // THE BAR IS LOW ON PURPOSE AND THAT IS THE POINT. The failure this catches
  // is total — skinning gone means every verb renders the identical bind pose,
  // and the closest pair reads 0.0. Two genuinely different poses that happen
  // to share a stance (a cast and a ward are both standing with the arms up)
  // sit around four or five, so anything comfortably above zero is the right
  // line to draw. A tighter bound here would only be a bound on which two clips
  // Meshy happened to author most alike.
  check('POSE: and no two actions render the same body',
    silhouette.apart > 2.5,
    JSON.stringify({ closestPair: silhouette.closest, apart: silhouette.apart })
      + '% — a lost skeleton reads 0.0');

  // ═══ F · THE WORLD PLACES, AND THE DOM FOLLOWS ═══
  //
  // THE ARROW REVERSED IN BUILD 119, and this is the check that has to reverse
  // with it. It used to set `--lane-x` and confirm the figure was redrawn into
  // the element's new box, which was the right check while the DOM was the
  // authority. It is now testing a mechanism the game does not use: the lane
  // variables move nothing, because the element's position is written BY the
  // projection every frame.
  //
  // What must be true instead is the same promise stated the other way round —
  // change the row, and the figure crosses the floor AND the element lands on
  // top of it. The second half is what keeps twenty-nine rect-readers in
  // game.js working: drop targets, damage numbers, aim beams, nameplates. If
  // the DOM ever stopped tracking the figure, all of them would quietly start
  // pointing at empty floor.
  console.log('\n── the world places, the DOM follows ──');
  const follow = await J(async () => {
    const h = document.querySelector('.k-hero[data-hero="mira"]');
    const at = () => ({
      world: window.Cast3D._world().actors.mira,
      dom: (() => {
        const b = document.getElementById('k-cast').getBoundingClientRect();
        const r = h.getBoundingClientRect();
        return { cx: +(r.left - b.left + r.width / 2).toFixed(1),
                 ground: +(r.top - b.top + r.height).toFixed(1) };
      })(),
    });
    const settle = async (n) => { for (let i = 0; i < n; i++) await new Promise(r => requestAnimationFrame(r)); };
    await settle(8);
    const before = at();
    // THE ROW IS WHAT THE GAME CHANGES — renderHeroes swaps this class when a
    // hero walks — so the row is what the check changes.
    h.classList.remove('k-row-mid'); h.classList.add('k-row-front');
    await settle(12);
    const after = at();
    h.classList.remove('k-row-front'); h.classList.add('k-row-mid');
    await settle(12);
    return { before, after,
             walkedM: +(after.world.x - before.world.x).toFixed(2),
             // does the ELEMENT sit where the FIGURE is? to the pixel.
             gapX: +Math.abs(after.dom.cx - after.world.screen.x).toFixed(2),
             gapY: +Math.abs(after.dom.ground - after.world.screen.ground).toFixed(2) };
  });
  check('FOLLOW: changing the row walks the figure across the floor, in metres',
    follow.walkedM > 0.8, JSON.stringify({ walked: follow.walkedM + ' m',
      from: follow.before.world.x, to: follow.after.world.x }));
  check('FOLLOW: and the DOM element lands exactly on the projected figure',
    follow.gapX < 1.5 && follow.gapY < 1.5,
    JSON.stringify({ gapX: follow.gapX, gapY: follow.gapY,
                     dom: follow.after.dom, projected: follow.after.world.screen }));

  // ═══ G · THE PANEL, AND THAT IT STAYS OUT OF THE WAY ═══
  // `?cast=3d&tune=1`. Its whole reason to exist is that a look chosen by
  // editing a constant and reloading is a look chosen by argument — but two
  // hundred pixels of it parked over the party HUD would make the build it
  // ships in unplayable, so it starts as a tab.
  console.log('\n── the tuning panel ──');
  const noPanel = await J(() => !!document.getElementById('k-cast-tune'));
  check('PANEL: it is not there unless it is asked for',
    !noPanel, JSON.stringify({ present: noPanel }));

  await page.goto(page.url().replace('?test=1', '?test=1&tune=1'), { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const t = document.getElementById('k-title');
    const go = t && t.querySelector('.k-tt-go');
    if (go) go.click();
  });
  await page.waitForFunction(() => window.Cast3D && window.Cast3D._state().ready, null, { timeout: 30000 });
  await sleep(300);
  const panel = await J(() => {
    const b = document.getElementById('k-cast-tune');
    const tab = document.getElementById('k-cast-tab');
    // ONE DIAL PER SETTING, counted off the layer rather than asserted as a
    // number — the panel gained a seventh the moment the watercolour became
    // optional, and a literal here would have failed for the one reason that
    // is not a defect.
    return b ? { dials: b.querySelectorAll('input[type=range]').length,
                 settings: Object.keys(window.Cast3D.look()).length,
                 clips: b.querySelectorAll('button[data-clip]').length,
                 startsClosed: b.style.display === 'none' && !!tab && tab.style.display !== 'none',
                 json: b.querySelector('#k-ct-json').textContent } : null;
  });
  check('PANEL: a dial for every setting, every clip, and it starts as a tab over nothing',
    !!panel && panel.dials === panel.settings && panel.clips === 8 && panel.startsClosed,
    JSON.stringify(panel));

  // …and a dial has to reach the shader, not just move a number in a readout
  const dial = await J(() => {
    document.getElementById('k-cast-tab').click();
    const r = document.querySelector('#k-cast-tune input[data-k="wash"]');
    const before = window.Cast3D.look().wash;
    r.value = '0.2'; r.dispatchEvent(new Event('input', { bubbles: true }));
    const f = window.Cast3D._figure('ash');
    const u = f.root.userData.mat.userData.u;
    return { before, look: window.Cast3D.look().wash, uniform: u.uWash.value };
  });
  check('PANEL: dragging a dial reaches the shader uniform, not just the readout',
    dial.look === 0.2 && dial.uniform === 0.2 && dial.before !== 0.2, JSON.stringify(dial));

  // ═══ G2 · THE ANIMATION DOES NOT RESHAPE THE BODY ═══
  // The clips come off a different skeleton than the characters wear — every
  // Meshy generation lands on its own bind pose — and a clip carries a position
  // track for every joint. Played raw, those tracks overwrite each character's
  // BONE LENGTHS with the source rig's, sixty times a second, which is what
  // "disfigured" actually was: heads folded into shoulders, arms stretched to
  // somebody else's proportions.
  //
  // A skeleton's bone lengths are a constant. If they move while a clip plays,
  // the retarget is broken, and no amount of looking at a 145-pixel figure
  // will tell you that reliably.
  console.log('\n── the body keeps its proportions ──');
  const bones = await J(async () => {
    // DIRECT PARENT TO CHILD ONLY, and taken off the real hierarchy rather
    // than a list of names that look adjacent. The first version of this check
    // guessed the pairs — Hips→Spine, neck→Head — and several of them are two
    // or three joints apart in this rig, where the distance changes the moment
    // anything in between bends. It reported 7% "stretch" on correct animation.
    // A bone's length is the distance to its own parent, and that is the only
    // distance a rotation cannot alter.
    const pairsOf = (f) => {
      const out = [];
      for (const n of Object.keys(f.bones)) {
        const b = f.bones[n];
        if (b.parent && b.parent.isBone && f.bones[b.parent.name]) out.push([b.parent.name, n]);
      }
      return out;
    };
    const V = (b) => b.getWorldPosition(new (b.position.constructor)());
    const out = {};
    for (const id of ['ash', 'elin', 'mira', 'mourner']) {
      const f = window.Cast3D._figure(id);
      const pairs = pairsOf(f);
      const len = () => pairs.map(([a, b]) => +V(f.bones[a]).distanceTo(V(f.bones[b])).toFixed(5));
      f.clear();
      await new Promise(r => requestAnimationFrame(r));
      const rest = len();
      let worst = 0;
      for (const verb of ['slash', 'cast', 'ward', 'hurt', 'down']) {
        window.Cast3D.play(id, verb);
        const a = f.acting;
        for (const frac of [0.25, 0.5, 0.85]) {
          if (a) { a.time = a.getClip().duration * frac; a.setEffectiveWeight(1); }
          await new Promise(r => requestAnimationFrame(r));
          len().forEach((v, i) => {
            if (!rest[i]) return;
            worst = Math.max(worst, Math.abs(v - rest[i]) / rest[i]);
          });
        }
      }
      f.clear();
      out[id] = { bones: pairs.length, drift: +(worst * 100).toFixed(2) };
    }
    return out;
  });
  check('BONES: no clip stretches anybody — every bone holds its length through every verb',
    Object.values(bones).every(v => v.drift < 1),
    JSON.stringify(bones) + ' — worst % drift from rest');

  // ═══ H · THEY ARE FACING THE ENEMY ═══
  // The foe stands on the right of this stage and always has. The party
  // arrived from the generator facing the camera, so for one build they fought
  // it with their backs turned — which no check would have caught, because
  // every other thing about them was correct.
  console.log('\n── which way they face ──');
  // MEASURED OFF THE BODY, NOT READ OFF THE DIAL. The first attempt at this
  // check asserted the number in the table — which was exactly the number that
  // had been set wrong, so it passed while the party fought backwards. What
  // matters is where the chest actually points once the idle has posed it: the
  // foe is on the +X side of the stage, so a facing hero's forward vector has
  // a clearly positive x and is not still pointing at the camera.
  // MEASURED AT REST. Acting clips turn the body on purpose — a swing winds up
  // — so facing is only a defined property of the standing stance. The check
  // above leaves everyone mid-fade out of a knock-down, and reading it there
  // once reported Mira at 124°, which was true of that instant and of nothing
  // else.
  await J(async () => {
    for (const id of Object.keys(window.Cast3D._state().playing)) window.Cast3D._figure(id).clear();
    for (let i = 0; i < 12; i++) await new Promise(r => requestAnimationFrame(r));
  });
  const facing = await J(() => window.Cast3D._facing());
  // EVERYONE LOOKS AT THEIR OWN OPPONENT. The party stands on the left of this
  // board and the foe on the right, so a facing hero's forward vector has a
  // clearly positive x and the foe's a clearly negative one. Asserting one sign
  // for the whole cast would have passed a Regent staring off the edge of the
  // world the moment it joined.
  // ASK NOW, NOT FIFTY CHECKS AGO. `st` is a snapshot taken at boot, and the
  // cast is no longer fixed at boot — a creature arrives when the warm queue
  // reaches it. Reading the roster from that stale snapshot classified the two
  // creatures that landed mid-run as heroes, and then failed them for facing
  // the way a creature faces. Nothing was wrong with the game.
  const foeIds = await J(() => window.Cast3D._state().foes);
  check('FACING: every chest points at whoever it is fighting',
    Object.entries(facing).every(([id, f]) =>
      f && (foeIds.indexOf(id) >= 0 ? f.x < -0.55 : f.x > 0.55)),
    JSON.stringify(facing));

  // …and nobody is square-on to it either, or the cast reads as cardboard
  // cut-outs in profile rather than as people at a three-quarter.
  check('FACING: turned toward the fight, but still angled to the camera',
    Object.values(facing).every(f => f && f.z > 0.2),
    JSON.stringify(Object.fromEntries(
      Object.entries(facing).map(([k, v]) => [k, v && v.z]))));

  // ═══ I · THERE IS ONE WORLD, AND EVERYBODY IS STANDING IN IT ═══
  //
  // Every check above this line passed in Build 118, where each figure was
  // drawn alone into its own scissored rectangle with an orthographic camera
  // and no shared space at all. That is the point: none of them can tell the
  // difference, because none of them ask. These do.
  console.log('\n── one world ──');
  await J(async () => {
    // quiet the rig before measuring the lens: the camera eases toward
    // whatever --cam-* says and the fight sets those, so a push in flight
    // would be measured as the framing.
    const c = document.getElementById('k-cast');
    for (const k of ['x', 'y', 'dz']) c.style.setProperty('--cam-' + k, '0px');
    for (const k of ['r', 'yaw', 'pitch']) c.style.setProperty('--cam-' + k, '0deg');
    for (const id of Object.keys(window.Cast3D._state().playing)) window.Cast3D._figure(id).clear();
    for (let i = 0; i < 14; i++) await new Promise(r => requestAnimationFrame(r));
  });
  const world = await J(() => window.Cast3D._world());

  check('WORLD: one scene, one perspective camera — not four orthographic slices',
    world.cam.kind === 'PerspectiveCamera'
    && Object.values(world.actors).every(a => a.inScene),
    JSON.stringify({ camera: world.cam.kind, fov: world.cam.fov,
                     inScene: Object.keys(world.actors).length,
                     onTheBoard: Object.values(world.actors).filter(a => a.visible).length }));

  // NOBODY FLOATS AND NOBODY SINKS. Each model comes back from the generator
  // at its own size with its origin wherever the generator felt like putting
  // it, so standing on the floor is a measurement, not an assumption: the
  // silhouette is measured by rendering it, and the figure is dropped until
  // the bottom of that silhouette is at y=0. The lowest JOINT sits a little
  // above zero on everybody — an ankle is not a sole, and the Regent's train
  // pools below its lowest bone — which is why the tolerance is one-sided.
  check('WORLD: every figure stands ON the floor, not above or through it',
    Object.values(world.actors).every(a => a.lowestBone > -0.02 && a.lowestBone < 0.45),
    JSON.stringify(Object.fromEntries(
      Object.entries(world.actors).map(([k, v]) => [k, v.lowestBone]))) + ' m, lowest joint');

  // THE PARTY IS ONE HEIGHT AND THE THING IT FIGHTS IS BIGGER. Height stopped
  // being an accident of which day a model was generated on when the world
  // arrived — it is scaled to what the fight needs.
  const talls = Object.fromEntries(Object.entries(world.actors).map(([k, v]) => [k, v.tall]));
  check('WORLD: the party stands level with itself and the Regent looms over it',
    talls.ash === talls.elin && talls.elin === talls.mira && talls.mourner > talls.ash * 1.15,
    JSON.stringify(talls) + ' m');

  // THE READ SURVIVED THE REWRITE. The ladder the 2D stage drew — the party
  // receding left and away, ground lines rising as they go — is what players
  // know, and the camera was solved from it rather than chosen. Ranks must
  // still step left, still step up, and still shrink.
  const A = world.actors;
  check('WORLD: the ranks still recede — further back is further left, higher and smaller',
    A.elin.screen.x < A.mira.screen.x && A.mira.screen.x < A.ash.screen.x
    && A.elin.screen.ground < A.mira.screen.ground && A.mira.screen.ground < A.ash.screen.ground
    && A.elin.screen.h < A.mira.screen.h && A.mira.screen.h < A.ash.screen.h,
    JSON.stringify(Object.fromEntries(
      Object.entries(A).map(([k, v]) => [k, v.screen.x + '/' + v.screen.ground + ' h' + v.screen.h]))));

  // …AND IT LANDED WHERE THE PAINTED STAGE HAD IT. The heroes' projected
  // centres and ground lines have been ~240/234, ~352/253, ~474/276 since
  // Build 101. Within a dozen pixels is the same board; the check exists so a
  // camera tweak cannot quietly slide the party off the painted plaza.
  const LADDER = { elin: [240, 234], mira: [352, 253], ash: [474, 276] };
  const drift = Object.fromEntries(Object.entries(LADDER).map(([id, [x, y]]) =>
    [id, [+(A[id].screen.x - x).toFixed(1), +(A[id].screen.ground - y).toFixed(1)]]));
  check('WORLD: and it frames the board the painted stage framed',
    Object.values(drift).every(([dx, dy]) => Math.abs(dx) < 22 && Math.abs(dy) < 22),
    JSON.stringify(drift) + ' px from the 2D ladder');

  // THE FLOOR IS REAL AND IT CATCHES LIGHT. Without this the world is four
  // figures in a void that happens to have a painting behind it.
  check('WORLD: there is a floor, and the light throws real shadows onto it',
    world.ground && world.shadows, JSON.stringify({ ground: world.ground, shadows: world.shadows }));

  // ═══ J · THE CAMERA IS REAL, AND THE FIGHT ALREADY KNOWS HOW TO DRIVE IT ═══
  //
  // `cam()` in game.js has spoken in dolly, pan, roll, yaw and pitch since
  // Build 22 — camera words that were a CSS transform only because there was
  // no camera. Build 119 hands them to a real one. Nothing in game.js changed,
  // so this check is the proof that nothing needed to.
  console.log('\n── the camera moves ──');
  const dolly = await J(async () => {
    const c = document.getElementById('k-cast');
    const settle = async () => { for (let i = 0; i < 14; i++) await new Promise(r => requestAnimationFrame(r)); };
    const before = window.Cast3D._world();
    c.style.setProperty('--cam-dz', '120px');   // a push-in, in the fight's own units
    await settle();
    const push = window.Cast3D._world();
    c.style.setProperty('--cam-dz', '0px');
    await settle();
    return { z0: before.cam.z, z1: push.cam.z,
             // a real push-in makes the NEAR rank grow more than the far one:
             // that is parallax, and it is the thing a CSS scale cannot do
             nearGrew: +(push.actors.ash.screen.h / before.actors.ash.screen.h).toFixed(4),
             farGrew: +(push.actors.elin.screen.h / before.actors.elin.screen.h).toFixed(4) };
  });
  check('CAMERA: the fight\u2019s own dolly moves a real camera through the world',
    dolly.z1 < dolly.z0 - 0.5,
    JSON.stringify({ from: dolly.z0, to: dolly.z1 }) + ' m along the view axis');
  check('CAMERA: and a push-in is parallax \u2014 the near rank grows more than the far',
    dolly.nearGrew > dolly.farGrew + 0.01,
    JSON.stringify({ front: dolly.nearGrew, back: dolly.farGrew }));

  // ═══ K · THE TWO SPACES, AND THE ONE THE SUITE HAS NEVER SEEN ═══
  //
  // `#k-scale` magnifies the whole 932x430 board to fill whatever window it is
  // opened in. A hero's CSS transform is written in STAGE UNITS, where the
  // board is always 932 wide; `getBoundingClientRect()` answers in RENDERED
  // pixels, where on a laptop the same board is 2000 wide.
  //
  // THIS HARNESS BOOTS AT EXACTLY 932x430, so the zoom is 1 and the two spaces
  // are numerically identical. Every check in this file — every check in every
  // file — has therefore only ever measured the one window size at which this
  // class of bug cannot show up. Build 119 projected into the rendered size and
  // handed the number to a CSS transform, multiplying by the zoom twice: at a
  // 2.15x window the Regent's anchor came out at x=1515 on a stage 932 wide and
  // the drag beam pointed off the right-hand edge of the screen. Nine suites
  // passed. A screenshot found it.
  console.log('\n── the same board in a bigger window ──');
  await page.setViewportSize({ width: 1864, height: 900 });
  const zoomed = await J(async () => {
    for (let i = 0; i < 12; i++) await new Promise(r => requestAnimationFrame(r));
    const st = document.getElementById('k-stage');
    const sr = st.getBoundingClientRect();
    const k = sr.width / st.offsetWidth;
    const w = window.Cast3D._world();
    const out = { zoom: +k.toFixed(3), actors: {} };
    // ASK THE WAY THE LAYER ASKS. This used to name `#k-boss-art` for the
    // Regent and a `.k-hero` for everyone else — a rule that was true of a cast
    // of four and returns null for the four creatures Build 123 added. The
    // layer has had one uniform rule since Build 118 (`nodeOf`: a hero by its
    // selector, a foe by WHO IT IS), and a check that keeps a second opinion
    // about where a figure lives is a check that will disagree with the game
    // eventually. Only actors actually on screen have a rect to compare.
    for (const id of Object.keys(w.actors)) {
      if (!w.actors[id].visible) continue;
      const n = document.querySelector(w.actors[id].foe
        ? '#k-cast [data-foe="' + id + '"]' : '.k-hero[data-hero="' + id + '"]');
      if (!n) continue;
      const r = n.getBoundingClientRect();
      out.actors[id] = {
        // the element's centre and ground line, converted back to stage units
        gapX: +Math.abs((r.left + r.width / 2 - sr.left) / k - w.actors[id].screen.x).toFixed(2),
        gapY: +Math.abs((r.top + r.height - sr.top) / k - w.actors[id].screen.ground).toFixed(2),
        onStage: (r.left + r.width / 2 - sr.left) / k < st.offsetWidth,
      };
    }
    return out;
  });
  check('SCALE: magnify the board and the DOM still lands on the figure',
    zoomed.zoom > 1.5
    && Object.values(zoomed.actors).every(a => a.gapX < 1.5 && a.gapY < 1.5 && a.onStage),
    JSON.stringify(zoomed));

  // …which is the thing the drag beam reads. `aimAnchor` takes the foe's rect,
  // and an anchor past the right edge of a 932-wide stage is a beam pointing
  // into the void — exactly what the screenshot showed.
  const beam = await J(() => {
    const st = document.getElementById('k-stage');
    const sr = st.getBoundingClientRect();
    const k = sr.width / st.offsetWidth;
    const boss = document.getElementById('k-boss-art');
    const br = boss.getBoundingClientRect();
    const card = document.querySelector('.k-card');
    const cr = card.getBoundingClientRect();
    const at = (x, y, t) => card.dispatchEvent(new PointerEvent(t,
      { bubbles: true, clientX: x, clientY: y, pointerId: 5 }));
    at(cr.left + cr.width / 2, cr.top + 10, 'pointerdown');
    at(cr.left + cr.width / 2 + 40, cr.top - 40, 'pointermove');
    at(br.left + br.width / 2, br.top + br.height / 2, 'pointermove');
    const d = document.querySelector('#k-aim .k-aim-dash');
    const path = d ? d.getAttribute('d') : '';
    at(br.left + br.width / 2, br.top + br.height / 2, 'pointerup');
    // every coordinate the beam was drawn with has to be inside the board
    const nums = (path.match(/-?\d+(\.\d+)?/g) || []).map(Number);
    const xs = nums.filter((_, i) => i % 2 === 0);
    return { path, maxX: xs.length ? +Math.max(...xs).toFixed(1) : null, stageW: st.offsetWidth };
  });
  check('SCALE: and the drag beam ends on the foe, not off the edge of the screen',
    beam.maxX != null && beam.maxX <= beam.stageW,
    JSON.stringify(beam));
  await page.setViewportSize({ width: 932, height: 430 });

  // ═══ L · A PLATE ONLY STEPS ASIDE FOR ITS OWN CREATURE ═══
  //
  // Build 118 gave the Regent `sel: '#k-boss-art'` — the slot the first
  // opponent stands in, which is true of the Regent AND of the four creatures
  // there is no model for. So the Kneeling Revenant, the Hollow Husk and the
  // rest all fought the party wearing the boss's body. It reads as "the boss
  // turned up early" rather than as a bug, which is how it shipped.
  //
  // THE STAND-IN HAD TO CHANGE, THE PROPERTY DID NOT (Build 123). This used
  // `revenant` as its example of a creature with no model, and every creature
  // has one now — so the check was asserting that a body which exists is not
  // drawn, and failing for the best possible reason. The property under test
  // was never "some creatures are unmodelled"; it is that an element gives up
  // its painting ONLY to the model that belongs on it. A name no model answers
  // to tests exactly that, and goes on testing it however much of the bestiary
  // gets built.
  console.log('\n── the right body on the right creature ──');
  const plate = await J(async () => {
    const boss = document.getElementById('k-boss-art');
    const settle = async () => { for (let i = 0; i < 8; i++) await new Promise(r => requestAnimationFrame(r)); };
    const was = boss.dataset.foe;
    await settle();
    const asRegent = { on: boss.classList.contains('k-cast3d-on'),
                       drawn: window.Cast3D._figure('mourner').root.visible };
    boss.dataset.foe = 'nobody';                 // a name no model answers to
    await settle();
    const asStranger = { on: boss.classList.contains('k-cast3d-on'),
                         drawn: window.Cast3D._figure('mourner').root.visible,
                         paintOpacity: getComputedStyle(boss.querySelector('img')).opacity };
    boss.dataset.foe = was;
    await settle();
    const back = { on: boss.classList.contains('k-cast3d-on'),
                   drawn: window.Cast3D._figure('mourner').root.visible };
    return { was, asStranger, asRegent, back };
  });
  check('PLATE: the Regent\u2019s body is drawn for the Regent',
    plate.asRegent.on && plate.asRegent.drawn, JSON.stringify(plate.asRegent));
  check('PLATE: a creature there is no model of keeps its own painting',
    !plate.asStranger.on && !plate.asStranger.drawn && plate.asStranger.paintOpacity === '1',
    JSON.stringify(plate.asStranger));

  // …AND "KEEPS ITS PAINTING" IS NOT THE SAME AS "CAN BE SEEN".
  //
  // The check above passed for a whole build while every unmodelled enemy was
  // invisible. It read CSS: opacity 1, visibility visible, the right rectangle
  // — all true, and all beside the point, because Build 120 made the world
  // canvas OPAQUE and left it at z-index 1 while a solo foe plate carries
  // z-index auto. The enemy was painted, correctly, behind a wall.
  //
  // The only thing that answers "is it visible" is the composited picture. So
  // this takes a real screenshot, hides the plate, takes another, and asks
  // whether the pixels where the enemy stands actually changed. Nothing about
  // stacking contexts is consulted or trusted.
  // DECODING THE SHOTS IN THE PAGE TOOK THE PAGE DOWN — even clipped, handing
  // images back through `evaluate` destroyed the execution context. It is also
  // more machinery than the question needs. Freeze the animation, photograph
  // the enemy's rectangle, hide the painting, photograph it again: if the two
  // PNGs are byte-identical, nothing about that painting was ever on screen.
  //
  // The control pair is what makes that argument sound. Two shots taken with
  // NOTHING changed must come back identical; if they do not, the frame is
  // still moving and the comparison would prove nothing either way.
  // "KEEPS ITS PAINTING" IS NOT THE SAME AS "CAN BE SEEN". The check above
  // passed for a whole build while every unmodelled enemy was invisible: it
  // read opacity 1, visibility visible, the right rectangle — all true, and all
  // beside the point, because the world canvas was opaque and in front. The
  // only thing that answers "is it visible" is the composited picture.
  //
  // A SMALL PATCH, AND A NOISE FLOOR. Two earlier attempts at this failed for
  // reasons worth recording: handing full screenshots back through `evaluate`
  // destroyed the page's execution context, and comparing whole PNGs
  // byte-for-byte reported a moving frame as a difference — the camera rig
  // eases asymptotically and never quite lands, so no two frames are ever bit
  // identical. So this photographs a thumbnail of the enemy's chest, takes a
  // CONTROL pair with nothing changed to find out how much the picture moves on
  // its own, and asks whether hiding the painting moves it a great deal more.
  const wasFoe = await J(() => {
    const b = document.getElementById('k-boss-art');
    const was = b.dataset.foe;
    // the state under test is a creature there is NO model of — with the Regent
    // standing there its painting is hidden on purpose, and hiding it twice
    // proves nothing
    b.dataset.foe = 'nobody';
    for (const id of ['ash', 'elin', 'mira', 'mourner']) {
      const f = window.Cast3D._figure(id);
      if (f) { f.clear(); f.mixer.timeScale = 0; }
    }
    return was;
  });
  await sleep(320);
  // THE WHOLE BOX, NOT A PATCH OF IT. A 72-pixel window at a chosen fraction of
  // the enemy's rectangle came back with a signal of exactly zero: the art is
  // a cut-out with a great deal of transparency, and the patch had landed on
  // some of it. Where a figure's paint happens to fall inside its box is not
  // something to guess at.
  const patch = await J(() => {
    const r = document.querySelector('#k-boss-art').getBoundingClientRect();
    return { x: Math.max(0, Math.round(r.left)), y: Math.max(0, Math.round(r.top)),
             width: Math.round(r.width), height: Math.round(r.height) };
  });
  // any re-render writes `data-foe` back from the real fight and the layer
  // reclaims the element on the next frame — hold it across every capture
  const hold = () => J(() => {
    const b = document.getElementById('k-boss-art');
    b.dataset.foe = 'nobody';
    return b.classList.contains('k-cast3d-on');
  });
  const grab = async () => {
    await hold(); await sleep(90);
    return page.screenshot({ clip: patch });
  };
  const shotA = await grab();
  const shotB = await grab();
  // HIDE THE WHOLE PLATE, NOT THE `img`. The foe's painting has been a frame
  // STRIP since Build 50 — `.k-fanim`, stepped across six real frames of the
  // Regent — and `#k-boss-art.k-has-anim img` is `display: none` in its favour.
  // A test that hid the img was hiding something that has not been on screen
  // for seventy builds, and duly reported that hiding it changed nothing.
  await J(() => { document.getElementById('k-boss-art').style.visibility = 'hidden'; });
  const shotC = await grab();
  const claimed = await hold();
  await J((was) => {
    document.getElementById('k-boss-art').style.visibility = '';
    document.getElementById('k-boss-art').dataset.foe = was;
    for (const id of ['ash', 'elin', 'mira', 'mourner']) {
      const f = window.Cast3D._figure(id);
      if (f) f.mixer.timeScale = 1;
    }
  }, wasFoe);
  // COMPARED IN NODE, WITHOUT DECODING ANYTHING. Handing images back through
  // `evaluate` destroyed the page's execution context twice, at a full page and
  // at a 72-pixel thumbnail alike, so the payload was never the problem — this
  // far into the suite the renderer simply has no room for another canvas.
  //
  // A PNG's compressed size is a fair proxy for its content: the same picture
  // encodes to the same number of bytes, and a picture missing a whole figure
  // does not. The control pair gives the floor — the camera rig eases
  // asymptotically and never quite lands, so consecutive frames are never
  // identical — and the question is whether hiding the painting moves the size
  // far past that.
  const seen = { noise: Math.abs(shotA.length - shotB.length),
                 signal: Math.abs(shotA.length - shotC.length),
                 bytes: shotA.length, claimed };
  check('PLATE: and the painting is actually ON SCREEN, not behind the world',
    !seen.claimed && seen.signal > Math.max(400, seen.noise * 3),
    JSON.stringify(seen) + ' — PNG bytes for the enemy\u2019s whole box');
  check('PLATE: and the body comes back when its own creature does',
    plate.back.on && plate.back.drawn, JSON.stringify(plate.back));

  // ═══ M · THE CAMERA LEAVES ITS SPOT (Build 120) ═══
  //
  // Build 119 gave the fight a real camera and left it standing where the
  // painted stage always stood. These are the checks that it can go somewhere
  // and that the world holds up when it does — which is the whole build.
  console.log('\n── the camera roams ──');
  const roam = await J(async () => {
    const settle = async (n) => { for (let i = 0; i < n; i++) await new Promise(r => requestAnimationFrame(r)); };
    const out = {};
    for (const name of ['home', 'duel', 'parry', 'allout', 'reckoning']) {
      window.Cast3D.shot(name, { speed: 40 });
      await settle(12);
      const w = window.Cast3D._world();
      const on = (k) => w.actors[k].screen.x > -60 && w.actors[k].screen.x < 992;
      // what the shot was named for: the foe for a duel, the defender for a
      // parry, the whole board otherwise
      const subj = name === 'duel' ? ['mourner']
                 : name === 'parry' ? ['ash', 'elin', 'mira']
                 : ['ash', 'mourner'];
      out[name] = { x: w.cam.x, y: w.cam.y, z: w.cam.z,
                    behind: Object.keys(w.actors)
                      .filter(k => w.actors[k].visible && w.actors[k].screen.behind),
                    subject: subj.some(on),
                    onStage: Object.keys(w.actors).filter(k => w.actors[k].visible).filter(on).length };
    }
    window.Cast3D.shot('home', { speed: 40 });
    await settle(12);
    return out;
  });
  check('SHOT: the fight can name a shot and the camera walks there',
    Object.keys(roam).length === 5
    && Object.values(roam).every(s => s.x != null),
    JSON.stringify(Object.fromEntries(Object.entries(roam).map(([k, v]) =>
      [k, v.x.toFixed(2) + ',' + v.y.toFixed(2) + ',' + v.z.toFixed(2)]))));

  // THEY ARE ACTUALLY DIFFERENT PLACES. A shot table whose entries all resolve
  // to the same spot is a shot table nobody would notice was broken.
  const spots = Object.values(roam).map(s => [s.x, s.y, s.z]);
  let spread = Infinity;
  for (let i = 0; i < spots.length; i++) for (let j = i + 1; j < spots.length; j++)
    spread = Math.min(spread, Math.hypot(spots[i][0] - spots[j][0],
                                       spots[i][1] - spots[j][1], spots[i][2] - spots[j][2]));
  check('SHOT: and they are five different places, not five names for one',
    spread > 0.7, JSON.stringify({ closestPair: +spread.toFixed(2) }) + ' m spread');

  // …AND EVERY ONE OF THEM IS A SHOT YOU COULD CUT TO. The first version of
  // this demanded all four bodies in frame for every shot, and that is not what
  // a cinematic camera owes you: `duel` comes over Ash's shoulder ON PURPOSE,
  // and the two heroes behind him are behind him. What a shot does owe you is
  // its own SUBJECT — the thing it was named for — and that nobody has ended up
  // behind the lens, which is the one failure that puts a hero on the wrong
  // side of the screen instead of off it.
  check('SHOT: every shot frames its own subject, and nobody is behind the lens',
    Object.values(roam).every(s => s.subject && !s.behind.length),
    JSON.stringify(Object.fromEntries(Object.entries(roam).map(([k, v]) =>
      [k, (v.subject ? 'subject framed' : 'SUBJECT LOST') + ', ' + v.onStage + ' of 4 in frame']))));

  // THE FLOOR MARKS ARE THE DROP TARGETS. `rowTargetAt` picks a lane by asking
  // which marker the finger is nearest, so a marker that does not follow the
  // camera hands a dragged hero to whichever lane used to be painted there.
  // This is the check that the aim survives the orbit, not just the picture.
  const marks = await J(async () => {
    const settle = async (n) => { for (let i = 0; i < n; i++) await new Promise(r => requestAnimationFrame(r)); };
    const read = () => {
      const b = document.getElementById('k-cast').getBoundingClientRect();
      const o = {};
      for (const el of document.querySelectorAll('#k-rows .k-row')) {
        const r = el.getBoundingClientRect();
        o[el.dataset.row] = +(r.left - b.left + r.width / 2).toFixed(1);
      }
      return o;
    };
    window.Cast3D.shot('home', { speed: 40 }); await settle(12);
    const atHome = read();
    window.Cast3D.shot('allout', { speed: 40 }); await settle(12);
    const atAllout = read();
    // …and does each mark still sit under the hero standing in that lane?
    const w = window.Cast3D._world();
    const under = Math.abs(atAllout.front - w.actors.ash.screen.x);
    window.Cast3D.shot('home', { speed: 40 }); await settle(12);
    return { atHome, atAllout, under: +under.toFixed(1) };
  });
  // ACROSS ALL THREE, not the one that happens to move least. A swing around
  // the board pivots the line of marks: the far end travels a long way and the
  // near end barely moves, so reading `front` alone measures the pivot rather
  // than the swing and calls a working camera broken.
  const markMove = ['back', 'mid', 'front']
    .reduce((s, r) => s + Math.abs(marks.atAllout[r] - marks.atHome[r]), 0);
  check('MARKS: the lane marks move with the camera, so the drop targets do too',
    markMove > 90, JSON.stringify({ ...marks, totalTravel: +markMove.toFixed(1) }));
  check('MARKS: and the front mark stays under whoever is standing in front',
    marks.under < 40, JSON.stringify({ gap: marks.under }) + ' px from Ash');

  // THE WORLD IS IN THE ROUND. A painted plate cannot be orbited, so the
  // painting was cut at its horizon: the half above it onto a curved panel
  // forty-five metres out, the half below it onto the actual ground.
  const round = await J(() => {
    const P = window.Cast3D._parts();
    let panel = 0, haze = 0, floor = 0;
    P.scene.traverse(o => {
      if (!o.isMesh) return;
      if (o.geometry.type === 'CylinderGeometry') { o.material.transparent ? panel++ : haze++; }
      if (o.geometry.type === 'PlaneGeometry') floor++;
    });
    return { panel, haze, floor, fog: !!P.scene.fog,
             plateHidden: getComputedStyle(document.getElementById('k-backdrop')).opacity };
  });
  check('ROUND: there is a horizon on every side and a floor under everything',
    round.panel >= 1 && round.haze >= 1 && round.floor >= 1 && round.fog,
    JSON.stringify(round));
  check('ROUND: and the flat painted plate has stood down',
    round.plateHidden === '0', JSON.stringify({ backdropOpacity: round.plateHidden }));

  // ═══ N · THE PLAZA IS FLOODED, AND THERE IS SOMETHING IN THE MIDDLE ═══
  //
  // Two things separated a world from a stage, and neither had a check.
  console.log('\n── the flooded plaza ──');

  // THE WATER IS MEASURED BY TURNING IT OFF. A reflection is not something a
  // property can confirm — the target can exist, be bound, and contribute
  // nothing — so the question is causal: does the floor look different with the
  // water on than with it off? Sampled in the lower half of the frame, which is
  // where the floor is from every shot this game takes.
  const water = await J(async () => {
    const settle = async (n) => { for (let i = 0; i < n; i++) await new Promise(r => requestAnimationFrame(r)); };
    const floorBand = async () => {
      await window.Cast3D._snapshot();
      const c = window.__castShot;
      const d = c.getContext('2d').getImageData(0, Math.round(c.height * 0.58),
                                                c.width, Math.round(c.height * 0.30)).data;
      const out = [];
      for (let i = 0; i < d.length; i += 4) out.push(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
      return out;
    };
    window.Cast3D.shot('home', { speed: 40 }); await settle(10);
    const wet = window.Cast3D.look().wet;
    const on = await floorBand();
    window.Cast3D.look({ wet: 0 }); await settle(6);
    const off = await floorBand();
    window.Cast3D.look({ wet }); await settle(6);
    let diff = 0;
    for (let i = 0; i < on.length; i++) diff += Math.abs(on[i] - off[i]);
    return { wet, meanChange: +(diff / on.length).toFixed(2), sampled: on.length };
  });
  check('WATER: the floor gives the city back — the plaza is flooded, not polished',
    water.wet > 0.05 && water.meanChange > 3,
    JSON.stringify(water) + ' — mean tone change across the floor when the water is switched off');

  // SOMETHING STANDS BETWEEN THE PARTY AND THE HORIZON. The world had a floor
  // and a cyclorama and nothing at all in between, which is why it read as a
  // stage: every parallax cue was either underfoot or forty-five metres away.
  const mid = await J(() => {
    const P = window.Cast3D._parts();
    const g = P.ground.userData.props;
    if (!g) return { pieces: 0 };
    let near = 0, inCorridor = 0;
    for (const m of g.children) {
      const p = m.position;
      const d = Math.hypot(p.x, p.z - 7.5);
      if (d > 6 && d < 30) near++;
      // …and none of it standing where the fight happens
      if (p.z > -16 && p.z < 6 && Math.abs(p.x - 0.4) < 7.5 - p.z * 0.42) inCorridor++;
    }
    return { pieces: g.children.length, inTheMiddle: near, inCorridor,
             mist: P.ground.userData.mist ? P.ground.userData.mist.children.length : 0 };
  });
  check('MIDDLE: there is a middle distance — masonry between the party and the horizon',
    mid.inTheMiddle > 20 && mid.mist >= 2, JSON.stringify(mid));
  check('MIDDLE: and none of it is standing where the fight is',
    mid.inCorridor === 0, JSON.stringify({ inCorridor: mid.inCorridor }));

  // ═══ O · A MOMENT MAY TAKE THE CAMERA, BUT NOT KEEP IT ═══
  //
  // A phase lasts until the phase changes; an action lasts about a second. If
  // both set the shot the same way, the first sword swing of the fight parks
  // the camera on the Regent's shoulder for the rest of the turn.
  console.log('\n── the camera answers the action ──');
  const moment = await J(async () => {
    const f = async (n) => { for (let i = 0; i < n; i++) await new Promise(x => requestAnimationFrame(x)); };
    const at = () => { const w = window.Cast3D._world().cam; return [+w.x.toFixed(2), +w.y.toFixed(2), +w.z.toFixed(2)]; };
    const apart = (a, b) => +Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]).toFixed(2);
    window.Cast3D.shot('home', { speed: 40 }); await f(10);
    const home = at();
    // THE HARNESS RUNS AT TWO FRAMES A SECOND, so counting frames counts
    // seconds by accident — a 700ms borrow is long over before forty frames
    // have passed. The borrow under test is given wall-clock room.
    window.Cast3D.shot('strike', { for: 40000, speed: 40 }); await f(10);
    const during = at();
    const stance = window.Cast3D.shot().base.az;
    window.Cast3D.shot('strike', { for: 100, speed: 40 });
    await new Promise(x => setTimeout(x, 400)); await f(10);
    const after = at();
    return { home, during, after, stance,
             moved: apart(home, during), returned: apart(home, after) };
  });
  check('MOMENT: an action takes the camera somewhere the phase was not',
    moment.moved > 1.2, JSON.stringify({ home: moment.home, during: moment.during,
                                         moved: moment.moved + ' m' }));
  check('MOMENT: …and hands it straight back when the beat is over',
    moment.returned < 0.15, JSON.stringify({ back: moment.after, off: moment.returned + ' m' }));
  // …AND IT NEVER OVERWROTE THE STANCE. This is what stops a borrowed camera
  // from becoming a kept one: the phase's shot is remembered rather than
  // re-sent, so an action never has to know what it interrupted.
  check('MOMENT: and the phase\u2019s own shot was never overwritten',
    moment.stance === 0, JSON.stringify({ stanceAz: moment.stance }));

  // every shot an action can ask for is a real, distinct place
  const acts = await J(async () => {
    const f = async (n) => { for (let i = 0; i < n; i++) await new Promise(x => requestAnimationFrame(x)); };
    const out = {};
    for (const n of ['strike', 'grace', 'fell', 'snap']) {
      window.Cast3D.shot(n, { speed: 40 }); await f(10);
      const w = window.Cast3D._world();
      out[n] = { at: [+w.cam.x.toFixed(2), +w.cam.y.toFixed(2), +w.cam.z.toFixed(2)],
                 behind: Object.keys(w.actors)
                   .filter(k => w.actors[k].visible && w.actors[k].screen.behind).length };
    }
    window.Cast3D.shot('home', { speed: 40 }); await f(10);
    return out;
  });
  const actSpots = Object.values(acts).map(v => v.at);
  let closest = Infinity;
  for (let i = 0; i < actSpots.length; i++) for (let j = i + 1; j < actSpots.length; j++)
    closest = Math.min(closest, Math.hypot(actSpots[i][0] - actSpots[j][0],
                                           actSpots[i][1] - actSpots[j][1], actSpots[i][2] - actSpots[j][2]));
  check('MOMENT: a strike, a mercy, a kill and a deflection are four different frames',
    closest > 0.8 && Object.values(acts).every(v => v.behind === 0),
    JSON.stringify(Object.fromEntries(Object.entries(acts).map(([k, v]) => [k, v.at.join(',')])))
      + ' — closest pair ' + closest.toFixed(2) + ' m');

  // ═══ M · THE MOTION IS SMOOTH, AND THAT IS A MEASUREMENT ═══
  //
  // "Sloppy and jittery" is a claim about the CLIP, and the two ways to check
  // it are both wrong: watching it in a harness that rasterises in software at
  // two frames a second measures the harness, and reading the keyframes
  // measures the data rather than what the mixer does with it.
  //
  // So this drives one figure's mixer BY HAND at a fixed 240 Hz with the layer
  // switched off, and reads the angular acceleration of the acting arm. Smooth
  // motion accelerates smoothly. A pose that snaps — an action that stops
  // contributing the instant it ends, an idle whose weight jumps, a blend that
  // flips branch between two near-antipodal rotations — shows up as one spike
  // two samples wide, hundreds of times the surrounding values.
  //
  // Build 124 measured 145 to 592 rad/s on the six acting verbs, one spike per
  // clip, every one of them landing on the clip's own beat. This is the
  // number that must not come back.
  console.log('\n── the motion itself ──');
  const smooth = await J(async (vs) => {
    const C3 = window.Cast3D;
    const was = C3._state().on;
    C3.disable();
    const f = C3._figure('ash');
    const STEP = 1 / 240, out = {};
    for (const v of vs) {
      const name = C3._verbClip('ash', v);
      if (!name) continue;
      f.clear(); f.play(name);
      for (let i = 0; i < 60; i++) f.step(STEP);      // past the fade-in
      const bone = f.bones.RightHand || f.bones.Hips;
      const q = [];
      for (let i = 0; i < 400; i++) {
        f.step(STEP);
        bone.updateWorldMatrix(true, false);
        const c = bone.quaternion.clone();
        bone.getWorldQuaternion(c);
        q.push(c);
      }
      const w = [];
      for (let i = 1; i < q.length; i++)
        w.push(2 * Math.acos(Math.min(1, Math.abs(q[i - 1].dot(q[i])))) / STEP);
      let peak = 0;
      for (let i = 1; i < w.length; i++) peak = Math.max(peak, Math.abs(w[i] - w[i - 1]));
      out[v] = +peak.toFixed(1);
    }
    f.clear();
    if (was) await C3.enable();
    return out;
  }, ['slash', 'cast', 'ward', 'heal', 'parry', 'hurt']);
  check('MOTION: no action snaps — the body is never thrown between two frames',
    Object.values(smooth).length === 6 && Object.values(smooth).every(v => v < 90),
    JSON.stringify(smooth) + ' rad/s\u00b2 peak — Build 124 ran 145 to 592');

  // ═══ M2 · A SHOT THAT IS A MOVE ═══
  //
  // Every shot used to be a destination: the tripod eased toward it, arrived,
  // and stopped. On the parry — the one screen where the player has to act —
  // that meant the frame had finished moving before the bar even started, and
  // the board read as three figures of the same size standing in a row.
  //
  // The property is not "the camera is somewhere different". It is that the
  // camera is STILL TRAVELLING while the beat is happening. So this samples the
  // eye against a real clock and asks for metres per second inside the window
  // and after it — a shot that is a stance must go quiet, and a shot that is a
  // move must not.
  //
  // Timestamps matter more than they look. A round trip through `evaluate` in a
  // software-rendered page takes far longer than a sleep asks for, and counting
  // samples as though they were milliseconds puts "after the move" inside the
  // window and reports a live camera as parked.
  console.log('\n── a shot that is a move ──');
  // BOTH SHOTS GET TO ARRIVE FIRST. The first version of this compared the
  // parry against `home` over the same wall-clock window and failed a working
  // camera: `home` was issued straight after the parry, so its "window" was
  // mostly the journey BACK from the parry's mark — 0.26 m/s of travel that
  // says nothing about whether a stance moves once it is standing. The control
  // has to be the same state, not the same stopwatch. So each shot is given
  // 1500 ms to walk to its mark, and only then is it timed.
  const paths = {};
  for (const name of ['parry', 'home']) {
    await J((n) => window.Cast3D.shot(n, { speed: 1.5 }), name);
    await sleep(1500);                       // let the tripod get there
    const t0 = Date.now(), pts = [];
    for (let i = 0; i < 10; i++) {
      await sleep(110);
      const c = await J(() => {
        const w = window.Cast3D._world().cam, t = window.Cast3D.shot().at;
        return [w.x, w.y, w.z, +t.fov.toFixed(1), +t.roll.toFixed(1)];
      });
      pts.push({ t: Date.now() - t0, p: c });
    }
    const legs = pts.slice(1).map((s, i) =>
      Math.hypot(s.p[0] - pts[i].p[0], s.p[1] - pts[i].p[1], s.p[2] - pts[i].p[2])
      / ((s.t - pts[i].t) / 1000));
    paths[name] = {
      moving: +(legs.reduce((a, b) => a + b, 0) / legs.length).toFixed(3),
      span: pts[pts.length - 1].t,
      lens: pts[pts.length - 1].p[3], roll: pts[pts.length - 1].p[4],
    };
  }
  check('MOVE: the parry camera is still travelling after it has arrived',
    paths.parry.moving > 0.08 && paths.parry.moving > paths.home.moving * 4,
    JSON.stringify(paths) + ' — m/s once standing on the mark');
  check('MOVE: …and a stance goes quiet, so the board can be read',
    paths.home.moving < 0.02 && paths.home.lens === 51.2 && paths.home.roll === 0,
    JSON.stringify(paths.home));
  await J(() => window.Cast3D.shot('home'));

  // ═══ M3 · THE AIR ═══
  //
  // A hit used to be a `<div>`: `shockRing` appended a CSS circle to the flat
  // stage and grew its width, and a swing was a keyframe on a sprite. Both sat
  // on the layer ABOVE the world, so an impact could not be occluded by the
  // body it happened to, did not move when the camera did, and never touched
  // the water the whole plaza stands in.
  //
  // THE SLASH IS MEASURED AT A TIMESTEP THIS MACHINE DOES NOT CHOOSE. A weapon
  // trail is built from samples of where the blade was, so its length is a
  // function of the frame rate — and this harness rasterises in software at
  // about two frames a second. Watching the real loop would measure Chromium.
  // Driving the figure and the trail by hand at 60 Hz measures the trail.
  console.log('\n── the air ──');
  const air = await J(() => {
    const C3 = window.Cast3D, F = C3._fx();
    if (!F) return null;
    const was = C3._state().on;
    C3.disable();
    const f = C3._figure('ash');
    const out = {};
    for (const v of ['slash', 'ward']) {
      f.clear();
      if (F.ribbons.ash) F.ribbons.ash.clear();
      f.play(C3._verbClip('ash', v));
      f.fxVerb = v;
      const DT = 1 / 60;
      for (let i = 0; i < 40; i++) { f.step(DT); F.trail('ash', f, DT); }
      const r = F.ribbons.ash;
      let span = 0;
      if (r) for (let i = 1; i < r.filled; i++)
        span += r.pts[(r.head + i - 1) % r.n].b.distanceTo(r.pts[(r.head + i) % r.n].b);
      out[v] = { drawn: !!(r && r.mesh.visible), swept: +span.toFixed(2) };
    }
    f.clear();
    return { out, was };
  }).then(async (r) => { if (r && r.was) await J(() => window.Cast3D.enable()); return r && r.out; });
  check('AIR: a slash is the path the weapon actually took, in metres of world',
    !!air && air.slash.drawn && air.slash.swept > 1.5,
    JSON.stringify(air && air.slash) + ' — swept by the blade across the swing');
  // …and a verb that swings nothing draws nothing. A trail on every action is
  // the same mistake as a trail on none: it stops meaning "something cut".
  check('AIR: …and a verb with no blade in it draws no arc',
    !!air && !air.ward.drawn,
    JSON.stringify(air && air.ward));

  const blow = await J(async () => {
    const C3 = window.Cast3D;
    C3.hit('mourner', 'slash', 1.6, 'ash');
    await new Promise(r => requestAnimationFrame(r));
    const s = C3._state();
    return { sparks: s.sparks, rings: s.rings };
  });
  check('AIR: an impact happens in the world — sparks in metres, a ring in the scene',
    blow.sparks > 30 && blow.rings > 0, JSON.stringify(blow));

  // ═══ M4 · A CREATURE COMES APART ═══
  //
  // COUNT THE BODY, DO NOT WEIGH A PICTURE OF IT. The first instrument here
  // screenshotted the creature's rectangle and compared PNG sizes, and it lied
  // in both directions: a burning body adds a white-hot tear that costs MORE
  // bytes than the body it is eating, and a solid body hides an arcade, sixty
  // pieces of rubble and their reflections — so a whole Regent can compress
  // SMALLER than the empty plaza behind her. The proxy was not even monotonic.
  //
  // `_cover` renders the figure alone into a small target and counts the pixels
  // it covers, which is what `fit` has done since Build 112. That is the
  // property rather than a stand-in for it.
  console.log('\n── coming apart ──');
  const gone = await J(() => {
    const C3 = window.Cast3D, f = C3._figure('mourner');
    if (!f) return null;
    f.dead = false; f.burn = null;
    f.mixer.timeScale = 0;                     // only the burn may change
    const u = f.root.userData.mat.userData;
    const out = [];
    for (const b of [0, 0.4, 0.7, 1.0]) { u.burn.value = b; out.push(C3._cover('mourner')); }
    u.burn.value = 0; f.mixer.timeScale = 1;
    return { px: out, tall: +u.tall.value.toFixed(2), foot: +u.foot.value.toFixed(2) };
  });
  check('BURN: a creature comes apart from the feet up, and ends up gone',
    !!gone && gone.px[0] > 400
    && gone.px[1] < gone.px[0] * 0.8 && gone.px[2] < gone.px[1] * 0.7 && gone.px[3] === 0,
    JSON.stringify(gone) + ' — pixels covered at burn 0 / .4 / .7 / 1');
  // …and the height it burns through is MEASURED, not assumed. Two versions of
  // this guessed: one divided by a constant 1.85, one assumed the model's
  // origin sits at its soles. The Regent's origin is at her hips and her legs
  // run to -1, so the whole lower body clamped to zero and she vanished at a
  // quarter of the burn. No two of these eight models agree on either number.
  check('BURN: …through a height read off the geometry, not guessed at',
    !!gone && gone.tall > 0.5 && gone.foot < 0.01,
    JSON.stringify({ tall: gone && gone.tall, foot: gone && gone.foot }));

  // ═══ M5 · A BLOW BEING AIMED IS A BLOW HALF-THROWN ═══
  //
  // While a card is held over a target the hero is wound up, and letting go
  // finishes the motion they already started. The ready pose is therefore NOT
  // a separate animation — it is the first third of the swing, stopped — which
  // is what makes the release unable to pop however long the player deliberates.
  console.log('\n── winding up ──');
  const snapR = () => J(() => {
    const f = window.Cast3D._figure('ash');
    return { holdFrac: f.holdFrac, held: f.held, acting: !!f.acting, verb: f.fxVerb,
             time: f.acting ? +f.acting.time.toFixed(3) : null,
             paused: f.acting ? f.acting.paused : null,
             dur: f.acting ? +f.acting.getClip().duration.toFixed(3) : null };
  });
  await J(() => window.Cast3D.play('ash', 'idle'));
  await sleep(400);
  await J(() => window.Cast3D.ready('ash', 'slash'));
  await sleep(1500);
  const wound = await snapR();
  check('READY: aiming winds the hero up and stops them a third into the swing',
    wound.acting && wound.held && wound.paused
    && Math.abs(wound.time - wound.dur * 0.34) < 0.09,
    JSON.stringify(wound));

  // …AND IT BREATHES. A wind-up perfectly still for four seconds while the
  // player thinks reads as a crash. It cannot come from blending an idle
  // underneath — that is the near-antipodal blend Build 125 measured throwing
  // the hips eighty degrees in a 240th of a second — so the tension is the
  // action's own time straining either side of the mark, inside one clip.
  const pA = await J(() => { const w = window.Cast3D._figure('ash').bones.RightHand;
    return w.getWorldPosition(w.position.clone()).toArray(); });
  await sleep(500);
  const pB = await J(() => { const w = window.Cast3D._figure('ash').bones.RightHand;
    return w.getWorldPosition(w.position.clone()).toArray(); });
  const breath = Math.hypot(pA[0] - pB[0], pA[1] - pB[1], pA[2] - pB[2]) * 1000;
  check('READY: …and the held pose breathes rather than freezing',
    breath > 2 && breath < 400, breath.toFixed(1) + ' mm at the wrist over half a second');

  // A RESTART IS A TRIP TO ZERO, NOT A WOBBLE. Comparing two samples of a
  // breathing hold cannot detect one: the tension moves the clip's time by
  // ±42ms, so any threshold small enough to catch a restart is smaller than the
  // breath — the first version of this check reported a working hold as
  // restarted. `play` resets to 0, so that is what to look for.
  const beforeR = await snapR();
  await J(() => window.Cast3D.ready('ash', 'slash'));
  const afterR = await snapR();
  check('READY: dragging across a second target does not restart the wind-up',
    afterR.acting && afterR.time > beforeR.dur * 0.34 - 0.1,
    JSON.stringify({ before: beforeR.time, after: afterR.time,
                     mark: +(beforeR.dur * 0.34).toFixed(3) }));

  // and the drop finishes THAT swing rather than starting another
  await J(() => window.Cast3D.play('ash', 'slash'));
  const rel = await snapR();
  check('READY: letting go finishes the same swing, from where it stopped',
    rel.acting && !rel.paused && rel.holdFrac === 0
    && rel.time > beforeR.dur * 0.30,
    JSON.stringify(rel));

  await sleep(1800);
  await J(() => window.Cast3D.ready('ash', 'slash'));
  await sleep(900);
  await J(() => window.Cast3D.unready('ash'));
  await sleep(260);
  const undone = await snapR();
  check('READY: …and a card that comes back unwinds the arm',
    !undone.acting && undone.holdFrac === 0, JSON.stringify(undone));
  await J(() => window.Cast3D.play('ash', 'idle'));

  // ═══ N · THE PATH EVERY PLAYER TAKES ═══
  //
  // Every check above this line ran on a page that ASKED for the 3D stage.
  // From Build 124 nobody asks — the layer is what you get for opening the
  // game — so the thing that now needs proving is not that `?cast=3d` works
  // but that the bare URL does. This opens one, in the same browser, with no
  // cast parameter of any kind, and asks the layer whether it is on.
  //
  // …and the way back has to be real too, or "default" quietly means "only".
  // `?cast=2d` is the route the other eight suites take; if it ever stopped
  // meaning the painted stage, they would all silently start measuring
  // something else.
  console.log('\n── the path every player takes ──');
  const stages = {};
  for (const [name, q] of [['default', ''], ['opt-out', '&cast=2d']]) {
    const p2 = await ctx.newPage();
    await p2.goto('http://127.0.0.1:8099/v2.3/index.html?test=1' + q,
                  { waitUntil: 'networkidle' });
    await p2.waitForFunction(() => window.__ready === true, null, { timeout: 8000 })
      .catch(() => {});
    // the layer boots on DOMContentLoaded and then loads three models
    await p2.waitForFunction(
      () => window.Cast3D && (!window.Cast3D.wanted() || window.Cast3D._state().ready
                              || window.Cast3D._state().failed),
      null, { timeout: 30000 }).catch(() => {});
    stages[name] = await p2.evaluate(() => ({
      wanted: window.Cast3D ? window.Cast3D.wanted() : null,
      on: window.Cast3D ? window.Cast3D._state().on : null,
      failed: window.Cast3D ? window.Cast3D._state().failed : null,
      // the body class is what the stylesheet reads to stand the plates down
      body: document.body.classList.contains('k-cast3d'),
    }));
    await p2.close();
  }
  check('DEFAULT: opening the game with no flag at all puts you in the world',
    stages.default.wanted === true && stages.default.on === true
    && stages.default.body === true && !stages.default.failed,
    JSON.stringify(stages.default));
  check('DEFAULT: and ?cast=2d is a real way back to the painted stage',
    stages['opt-out'].wanted === false && stages['opt-out'].on === false
    && stages['opt-out'].body === false,
    JSON.stringify(stages['opt-out']));

  await shot('cast3d');
  const out = report();
  await browser.close();
  process.exit(out.passed === out.total && out.errs === 0 ? 0 : 1);
})();
