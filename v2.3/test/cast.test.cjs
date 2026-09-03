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

  check('LAYER: three figures, one per hero, and the rig came through the clone',
    !!st && st.figures.length === 3 && st.bones === 24,
    JSON.stringify({ figures: st && st.figures, bones: st && st.bones }));

  // THE VERBS THE FIGHT ALREADY SPEAKS. actionKind() has returned these four
  // since Build 36; if a clip goes missing the wiring fails silently, because
  // castPlay() is a no-op by design.
  const verbs = ['heal', 'cast', 'slash', 'ward'];
  check('LAYER: every verb the fight speaks has a clip to play',
    !!st && verbs.every(v => st.clips.indexOf(v) >= 0)
    && ['idle', 'hurt', 'parry', 'down'].every(v => st.clips.indexOf(v) >= 0),
    JSON.stringify(st && st.clips));

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
    for (const id of ['ash', 'elin', 'mira']) {
      const r = document.querySelector('.k-hero[data-hero="' + id + '"]').getBoundingClientRect();
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
  check('INK: a figure is painted inside every hero\u2019s own box',
    ['ash', 'elin', 'mira'].every(id => boxes[id] > 0.06),
    JSON.stringify(boxes));

  const inBoxes = await J(() => {
    const b = document.getElementById('k-cast').getBoundingClientRect();
    const c = window.__castShot;
    const sx = c.width / b.width, sy = c.height / b.height;
    return ['ash', 'elin', 'mira'].reduce((n, id) => {
      const r = document.querySelector('.k-hero[data-hero="' + id + '"]').getBoundingClientRect();
      return n + Math.round(r.width * sx) * Math.round(r.height * sy);
    }, 0);
  });
  check('INK: nothing is drawn outside the three boxes \u2014 the scissor holds',
    painted.litAll <= inBoxes * 1.02,
    JSON.stringify({ litAll: painted.litAll, boxPixels: inBoxes }));

  // ═══ D · THE IDLE IS ACTUALLY MOVING ═══
  // The single most important clip in a turn-based game: almost all of the
  // fight is spent with nobody acting, and a frozen 3D figure reads as a
  // BROKEN 3D figure where a frozen painting reads as a painting.
  console.log('\n── the idle ──');
  const a1 = await J(() => window.Cast3D._boneAngle('ash', 'Spine'));
  await sleep(700);
  const a2 = await J(() => window.Cast3D._boneAngle('ash', 'Spine'));
  const moved = a1 && a2 && a1.some((v, i) => Math.abs(v - a2[i]) > 0.05);
  check('IDLE: nobody is holding their breath — the spine moves between turns',
    moved, JSON.stringify({ before: a1, after: a2 }));

  // …and the three of them are NOT in lockstep. Three copies of one model
  // breathing on the same frame is worse than three still ones.
  const phases = await J(() => ({
    ash: window.Cast3D._boneAngle('ash', 'Spine'),
    elin: window.Cast3D._boneAngle('elin', 'Spine'),
    mira: window.Cast3D._boneAngle('mira', 'Spine'),
  }));
  const apart = (a, b) => a && b && a.some((v, i) => Math.abs(v - b[i]) > 0.02);
  check('IDLE: the three of them breathe out of step with each other',
    apart(phases.ash, phases.elin) && apart(phases.elin, phases.mira),
    JSON.stringify(phases));

  // ═══ E · EVERY VERB REACHES A CLIP ═══
  console.log('\n── the verbs ──');
  for (const v of ['slash', 'cast', 'ward', 'heal', 'hurt', 'parry']) {
    const got = await J((clip) => {
      window.Cast3D.play('ash', clip);
      return window.Cast3D._state().playing.ash;
    }, v);
    check('VERB: ' + v + ' plays', got === v, JSON.stringify({ asked: v, playing: got }));
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
    const f = window.Cast3D._figure('ash');
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
    // THE LAYER'S CLOCK IS HELD STILL. Sleeping for a chosen number of
    // milliseconds measures the harness's frame rate, not the clip — headless
    // advances a clip at about a third of real time, which is how four
    // screenshots of four different actions came out looking identical.
    const hold = async (clip, t) => {
      f.play(clip); f.t = t; f.blend = 1;
      await new Promise(r => requestAnimationFrame(r));
      f.t = t; f.blend = 1;
      return shot();
    };
    const base = await hold('idle', 0);
    const out = {};
    for (const [clip, t] of [['slash', 0.34], ['cast', 0.62], ['ward', 0.52], ['down', 0.90]]) {
      const s = await hold(clip, t);
      let diff = 0;
      for (let i = 0; i < base.mask.length; i++) if (base.mask[i] !== s.mask[i]) diff++;
      out[clip] = +(diff / base.lit * 100).toFixed(1);
    }
    f.clear();
    return out;
  });
  check('POSE: an action visibly changes the figure, not just its bone numbers',
    ['slash', 'cast', 'ward'].every(c => silhouette[c] > 8) && silhouette.down > 20,
    JSON.stringify(silhouette) + ' % of the silhouette redrawn');

  // ═══ F · THE FIGURE FOLLOWS THE ELEMENT ═══
  // This is the reason the layer is built this way at all: the figure's
  // position IS the DOM box, read fresh every frame, so a walk between rows
  // needs no second copy of the layout.
  console.log('\n── it follows the box ──');
  const follow = await J(async () => {
    // POSITION IS `--lane-x` INSIDE A TRANSFORM — that is how a row change
    // moves a hero, so that is what the check drives. Setting `transform`
    // directly would be testing a mechanism the game does not use.
    const h = document.querySelector('.k-hero[data-hero="mira"]');
    const before = h.getBoundingClientRect().left;
    h.style.setProperty('--lane-x', '700px');
    h.style.transition = 'none';
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const after = h.getBoundingClientRect().left;
    await window.Cast3D._snapshot();
    const c = window.__castShot;
    const b = document.getElementById('k-cast').getBoundingClientRect();
    const sx = c.width / b.width, sy = c.height / b.height;
    const r2 = h.getBoundingClientRect();
    const w = Math.max(1, Math.round(r2.width * sx)), hh = Math.max(1, Math.round(r2.height * sy));
    const d = c.getContext('2d').getImageData(
      Math.round((r2.left - b.left) * sx), Math.round((r2.top - b.top) * sy), w, hh).data;
    let lit = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 24) lit++;
    h.style.removeProperty('--lane-x'); h.style.transition = '';
    return { moved: Math.round(after - before), density: +(lit / (w * hh)).toFixed(3) };
  });
  check('FOLLOW: move the element and the figure is drawn at the new box',
    follow.moved > 60 && follow.density > 0.06, JSON.stringify(follow));

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
    return b ? { dials: b.querySelectorAll('input[type=range]').length,
                 clips: b.querySelectorAll('button[data-clip]').length,
                 startsClosed: b.style.display === 'none' && !!tab && tab.style.display !== 'none',
                 json: b.querySelector('#k-ct-json').textContent } : null;
  });
  check('PANEL: six dials, every clip, and it starts as a tab over nothing',
    !!panel && panel.dials === 6 && panel.clips === 8 && panel.startsClosed,
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

  await shot('cast3d');
  const out = report();
  await browser.close();
  process.exit(out.passed === out.total && out.errs === 0 ? 0 : 1);
})();
