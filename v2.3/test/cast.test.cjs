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
  const { page, J, sleep, check, report, shot, browser } = await boot({ query: 'cast=3d' });

  // ═══ A · THE LAYER IS THERE, OR IT SAID WHY NOT ═══
  console.log('\n── the layer ──');
  // loading a 678 KB model over a local server, decoding a webp and compiling
  // two shaders is not instant; the layer announces itself when it is ready
  await page.waitForFunction(
    () => window.Cast3D && window.Cast3D._state().ready, null, { timeout: 30000 }
  ).catch(() => {});
  const st = await J(() => (window.Cast3D ? window.Cast3D._state() : null));

  check('LAYER: ?cast=3d builds the layer and it comes up without excuses',
    !!st && st.on && st.ready && !st.failed, JSON.stringify(st && { on: st.on, ready: st.ready, failed: st.failed }));

  // FOUR NOW: the party and the thing they are fighting. The foe is not a
  // special case anywhere in the layer — same rig, same retarget, same clip
  // library — which is the return on having done the retargeting properly. A
  // new foe costs a model and no animation at all.
  check('LAYER: the party AND the foe are on the same rig, 24 bones each',
    !!st && st.figures.length === 4 && st.bones === 24 && st.foes.length === 1
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
    let sum = 0, n = 0;
    for (let y = 0; y < c.height; y += 2) for (let x = 0; x < c.width; x += 2) {
      if (boxes.some(q => x >= q.x0 && x <= q.x1 && y >= q.y0 && y <= q.y1)) continue;
      sum += d[(y * c.width + x) * 4 + 3]; n++;
    }
    return { meanAlpha: +(sum / n / 255).toFixed(4), sampled: n };
  });
  check('INK: the floor lets the painted plaza through — it is shadow, not a second floor',
    outside.meanAlpha > 0.005 && outside.meanAlpha < 0.22,
    JSON.stringify(outside) + ' — mean alpha outside every actor\u2019s box');

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
    for (let i = 0; i < 80; i++) {
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
      const mask = []; let lit = 0;
      for (let i = 3; i < d.length; i += 4) { const on = d[i] > 24 ? 1 : 0; mask.push(on); lit += on; }
      return { mask, lit };
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
    const out = {};
    for (const [verb, t] of [['slash', 0.55], ['cast', 0.55], ['ward', 0.45], ['down', 0.95]]) {
      const s = await hold(verb, t);
      let diff = 0;
      for (let i = 0; i < base.mask.length; i++) if (base.mask[i] !== s.mask[i]) diff++;
      out[verb] = +(diff / base.lit * 100).toFixed(1);
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
  const worst = Math.max(silhouette.slash, silhouette.cast, silhouette.ward);
  check('POSE: an action visibly changes the figure, not just its bone numbers',
    ['slash', 'cast', 'ward'].every(c => silhouette[c] > 5) && silhouette.down > worst * 1.6,
    JSON.stringify(silhouette) + ' % of the silhouette redrawn — down must dwarf the rest');

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
    await settle(20);
    const before = at();
    // THE ROW IS WHAT THE GAME CHANGES — renderHeroes swaps this class when a
    // hero walks — so the row is what the check changes.
    h.classList.remove('k-row-mid'); h.classList.add('k-row-front');
    await settle(50);
    const after = at();
    h.classList.remove('k-row-front'); h.classList.add('k-row-mid');
    await settle(50);
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
    for (let i = 0; i < 30; i++) await new Promise(r => requestAnimationFrame(r));
  });
  const facing = await J(() => window.Cast3D._facing());
  // EVERYONE LOOKS AT THEIR OWN OPPONENT. The party stands on the left of this
  // board and the foe on the right, so a facing hero's forward vector has a
  // clearly positive x and the foe's a clearly negative one. Asserting one sign
  // for the whole cast would have passed a Regent staring off the edge of the
  // world the moment it joined.
  const foeIds = st.foes || [];
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
    for (let i = 0; i < 60; i++) await new Promise(r => requestAnimationFrame(r));
  });
  const world = await J(() => window.Cast3D._world());

  check('WORLD: one scene, one perspective camera — not four orthographic slices',
    world.cam.kind === 'PerspectiveCamera'
    && Object.values(world.actors).every(a => a.inScene),
    JSON.stringify({ camera: world.cam.kind, fov: world.cam.fov,
                     inScene: Object.keys(world.actors).length }));

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
    const settle = async () => { for (let i = 0; i < 60; i++) await new Promise(r => requestAnimationFrame(r)); };
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

  await shot('cast3d');
  const out = report();
  await browser.close();
  process.exit(out.passed === out.total && out.errs === 0 ? 0 : 1);
})();
