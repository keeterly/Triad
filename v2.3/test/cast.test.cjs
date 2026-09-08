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
  // …AND A CENSUS OF BODIES IS THE WRONG QUESTION NOW (Build 130). A figure is
  // somebody standing in a slot on THIS board, so counting them counts the
  // encounter rather than the cast — a fight against one Regent has four
  // figures in it and always should. What the bestiary promises is that every
  // creature in it has a MODEL, on the same rig, ready to be worn by however
  // many slots the road deals.
  const BESTIARY = ['husk', 'cultist', 'wraith', 'revenant', 'mourner'];
  check('LAYER: every creature in the bestiary has a model, on one rig',
    !!st && BESTIARY.every(c => st.creatures.indexOf(c) >= 0)
    && ['ash', 'elin', 'mira'].every(c => st.creatures.indexOf(c) >= 0)
    && st.bones === 24 && !st.missing.length,
    JSON.stringify({ creatures: st && st.creatures, figures: st && st.figures,
                     wearing: st && st.wearing, bones: st && st.bones,
                     missing: st && st.missing }));

  // ── AND TWO OF THE SAME CREATURE ARE TWO BODIES ──────────────────────────
  //
  // The bug this replaces: both Hollow Husks in a matched pair shared
  // `data-foe="husk"`, so `nodeOf`'s querySelector found only the first — and
  // there was only ever one husk figure to find it with anyway. Both of them
  // fought the party as flat paintings while the heroes around them were solid.
  await J(() => startCombat({ foes: ['husk', 'husk'] }));
  await sleep(2600);
  const pair = await J(() => {
    const st2 = window.Cast3D._state();
    const els = [...document.querySelectorAll('#k-cast [data-foe]')]
      .filter(n => n.offsetParent !== null)
      .map(n => ({ ix: n.dataset.ix || '0', on: n.classList.contains('k-cast3d-on') }));
    const w = window.Cast3D._world();
    return { foes: st2.foes, wearing: st2.wearing, els,
             apart: st2.foes.length === 2
               ? +Math.abs(w.actors[st2.foes[0]].x - w.actors[st2.foes[1]].x).toFixed(2) : 0 };
  });
  check('LAYER: two of the same creature are two bodies, in two places',
    pair.foes.length === 2 && pair.apart > 0.5
    && pair.els.length === 2 && pair.els.every(e => e.on),
    JSON.stringify(pair));

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
             // THE ROW TAG WAS ONE OF THE THINGS THIS COUNTED, and it is gone
             // on purpose: three rings on the floor already say where the
             // ranks are, and a word under every body repeated it in the part
             // of the frame the fight happens in. What this check is really
             // about is that the 3D layer HIDES the painted plate without
             // dismantling the element around it, and the element's own box
             // and shadow anchor say that.
             shadow: !!h.querySelector('.k-shadow') };
  });
  check('SWAP: the 2D plate is hidden but the hero ELEMENT is fully intact',
    swap.imgStillThere && swap.imgHidden && swap.heroBox > 40
    && swap.shadow, JSON.stringify(swap));

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
                  mira: '.k-hero[data-hero="mira"]', foe0: '#k-boss-art' };
    for (const id of ['ash', 'elin', 'mira', 'foe0']) {
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
    ['ash', 'elin', 'mira', 'foe0'].every(id => boxes[id] > 0.06),
    JSON.stringify(boxes));

  const inBoxes = await J(() => {
    const b = document.getElementById('k-cast').getBoundingClientRect();
    const c = window.__castShot;
    const sx = c.width / b.width, sy = c.height / b.height;
    const SEL = { ash: '.k-hero[data-hero="ash"]', elin: '.k-hero[data-hero="elin"]',
                  mira: '.k-hero[data-hero="mira"]', foe0: '#k-boss-art' };
    return ['ash', 'elin', 'mira', 'foe0'].reduce((n, id) => {
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

  // ═══ C2 · AND THEY ARE POINTING AT THE ENEMY, AND STAY POINTING (Build 210)
  //
  // Reported off a phone: the whole party facing three different wrong ways in
  // one frame — two in profile, one with its back to the room — in a build
  // whose headings measure correct on every boot of this harness.
  //
  // The heading was pinned ONCE, in `mount`, off a single measurement taken one
  // 16ms step after the model arrived, and `aim` returned silently when it
  // could not measure. So a body that started wrong stayed wrong for the run
  // and nothing anywhere said so. It is an invariant now, eased every frame on
  // a body at rest.
  //
  // THIS IS THE MECHANISM, NOT THE SYMPTOM. It knocks each figure a long way
  // off and asks whether it comes home, which is a question a boot that happens
  // to be correct cannot answer.
  console.log('\n── which way they are facing ──');
  const aimHold = await J(async () => {
    const C3 = window.Cast3D;
    const wait = (n) => new Promise(z => { let i = 0;
      const t = () => (++i >= n ? z() : requestAnimationFrame(t)); requestAnimationFrame(t); });
    const readAll = () => {
      const o = {};
      for (const id of ['elin', 'mira', 'ash']) {
        const f = C3._figure(id); if (!f) continue;
        o[id] = { off: +(f.root.userData.headOff || 0).toFixed(2),
                  want: f.root.userData.heading,
                  failed: !!f.root.userData.aimFailed };
      }
      return o;
    };
    await wait(3);
    const rest = readAll();
    // knock every body a long way off its heading
    for (const id of ['elin', 'mira', 'ash']) {
      const f = C3._figure(id); if (f) f.root.rotation.y += 130 * Math.PI / 180;
    }
    await wait(6);
    const healed = readAll();
    // …and a body that is ACTING must be left alone, or a swing is fought.
    //
    // `down` AND NOT `slash`, FOR A REASON THIS COST A RUN. Headless draws at
    // about 1.5fps, so four frames is two and a half seconds and the sword clip
    // is 1.17 — the swing was over before the knock landed, the figure read
    // `acting: false`, and the check failed while the code was correct. `down`
    // is the one clip that HOLDS: a dead hero does not stand back up, so the
    // body is still acting however long the frame took.
    C3.play('ash', 'down');
    await wait(3);
    const fa = C3._figure('ash');
    const before = fa.root.rotation.y;
    fa.root.rotation.y += 60 * Math.PI / 180;
    const knocked = fa.root.rotation.y;
    await wait(4);
    const held = { acting: !!fa.acting,
                   kept: Math.abs(fa.root.rotation.y - knocked) < 1e-6,
                   moved: +((fa.root.rotation.y - before) * 180 / Math.PI).toFixed(1) };
    // ── AND IT PUTS THE BODY BACK, WHICH IS NOT TIDINESS ──────────────────
    //
    // The first cut left Ash holding a slash and walked away. Twelve sections
    // later PACE measures how fast the sword clip plays ON ASH and read 0.488
    // against 0.876 on the three runs before it — a check failing because of
    // the state another check left behind, which is the worst kind of failure
    // to debug because it points at innocent code.
    C3.play('ash', 'idle');
    await wait(4);
    return { rest, healed, held, handedBack: !C3._figure('ash').acting };
  });
  check('FACE: every body is pointing where it was aimed, and none of them gave up measuring',
    Object.keys(aimHold.rest).length === 3
      && Object.keys(aimHold.rest).every(k => !aimHold.rest[k].failed
                                          && Math.abs(aimHold.rest[k].off) < 2),
    JSON.stringify(aimHold.rest) + ' — degrees between the chest normal off the '
      + 'shoulder line and the heading this body was aimed at. `failed` is `aim` '
      + 'finding no bones to measure, which used to be a silent return');
  check('FACE: …and a body knocked off its heading walks back onto it',
    Object.keys(aimHold.healed).length === 3
      && Object.keys(aimHold.healed).every(k => Math.abs(aimHold.healed[k].off) < 2),
    JSON.stringify(aimHold.healed) + ' — every figure rotated 130 degrees off its '
      + 'heading, then read a few frames later. Before Build 210 nothing in the '
      + 'game ever re-checked a facing, so this stayed at 130 for the whole run');
  check('FACE: …and a swing is left alone, because a blow is supposed to turn the body',
    aimHold.held.acting && aimHold.held.kept && aimHold.handedBack,
    JSON.stringify(aimHold.held) + ' — the same knock during an action. The '
      + 'invariant must not touch a body that is acting: a swing winds up and '
      + 'follows through, and a heading held rigid through one is a body sliding '
      + 'under its own animation');

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
    && apart(phases.mira, phases.foe0),
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

  // ── …AND EVERY SLIDER CAN REACH THE VALUE THE GAME IS RUNNING (Build 212) ──
  //
  // Build 211 took `bloom` to 2.8 against a slider that stopped at 2. The panel
  // therefore could not display the setting the game was actually using, and
  // the first drag of that control would have silently CHANGED it — a tuning
  // surface that lies about the state and then corrupts it.
  //
  // The check above counts dials against settings and cannot see this: the
  // slider existed and was counted. The range is part of the same contract.
  // Read off the real inputs, so it is the DOM's bounds against the layer's own
  // values rather than two tables compared to each other.
  const bounds = await J(() => {
    const b = document.getElementById('k-cast-tune');
    if (!b) return null;
    const look = window.Cast3D.look(), bad = [];
    for (const r of b.querySelectorAll('input[type=range][data-k]')) {
      const k = r.dataset.k, v = look[k];
      if (v == null) continue;
      const lo = parseFloat(r.min), hi = parseFloat(r.max);
      if (!(v >= lo && v <= hi)) bad.push({ k: k, value: v, min: lo, max: hi });
    }
    return { n: b.querySelectorAll('input[type=range][data-k]').length, bad: bad };
  });
  check('PANEL: …and every slider can reach the value the game is actually running',
    !!bounds && bounds.n > 20 && bounds.bad.length === 0,
    JSON.stringify(bounds) + ' — each dial default against its own slider bounds. '
      + 'Build 211 shipped bloom at 2.8 on a slider that stopped at 2, and the '
      + 'dial-count check passed the whole time because the slider was there');

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
    for (const id of ['ash', 'elin', 'mira', 'foe0']) {
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
    talls.ash === talls.elin && talls.elin === talls.mira && talls.foe0 > talls.ash * 1.15,
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
  // centres and ground lines held at ~240/234, ~352/253, ~474/276 from Build
  // 101 to 172. Within a dozen pixels is the same board; the check exists so a
  // camera tweak cannot quietly slide the party off the painted plaza.
  //
  // RE-BASELINED AT BUILD 173, and the gate is why the number is here rather
  // than guessed: the home shot moved back from 7.35 m to 8.05 and up from
  // 1.70 to 1.80, deliberately, because the board grew — a line of three
  // creatures a metre wider than it used to be, on a plaza the old framing
  // cropped. That lifts every ground line by 17 to 29 px and narrows the
  // party's spread by about 32, which this caught on the first run. The
  // tolerance stays at 22 so the next unintended nudge is caught the same way.
  const LADDER = { elin: [252, 218], mira: [348, 232], ash: [454, 248] };
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
      const n = !w.actors[id].foe
        ? document.querySelector('.k-hero[data-hero="' + id + '"]')
        : (id === 'foe0' ? document.getElementById('k-boss-art')
           : document.querySelector('#k-cast .k-foe-art[data-ix="' + id.slice(3) + '"]'));
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
  // …AND THE SLOT LOSES ITS BODY ENTIRELY NOW (Build 130). Under the old
  // arrangement a foe figure existed for the whole fight and merely stopped
  // being visible; a slot is reconciled against the DOM every frame, so an
  // element wearing a creature nothing knows about is not a hidden body — it
  // is no body at all. That is a better answer, and it is what to assert.
  const plate = await J(async () => {
    const boss = document.getElementById('k-boss-art');
    const settle = async () => { for (let i = 0; i < 10; i++) await new Promise(r => requestAnimationFrame(r)); };
    const body = () => { const f = window.Cast3D._figure('foe0'); return !!f && f.root.visible; };
    const was = boss.dataset.foe;
    await settle();
    const asRegent = { on: boss.classList.contains('k-cast3d-on'), drawn: body() };
    boss.dataset.foe = 'nobody';                 // a name no model answers to
    await settle();
    const asStranger = { on: boss.classList.contains('k-cast3d-on'), drawn: body(),
                         paintOpacity: getComputedStyle(boss.querySelector('img')).opacity };
    boss.dataset.foe = was;
    await settle();
    const back = { on: boss.classList.contains('k-cast3d-on'), drawn: body() };
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
    for (const id of ['ash', 'elin', 'mira', 'foe0']) {
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
    for (const id of ['ash', 'elin', 'mira', 'foe0']) {
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
      const subj = name === 'duel' ? ['foe0']
                 : name === 'parry' ? ['ash', 'elin', 'mira']
                 : ['ash', 'foe0'];
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

  // ── A CUT IS NOT AN EXPLOSION ──
  //
  // Build 127 gave every impact the same cone of sparks and the same expanding
  // ring, which is what a blast looks like — and what a sword looked like too,
  // so a hit read as "an explosion and a flash" whatever threw it.
  //
  // A ring is RADIAL: it says the energy came from a point and went everywhere.
  // True of a spell, false of a blade, which arrives along a line and leaves
  // along the same one. So the property is not "an impact makes particles" but
  // that the two are TOLD APART, and this asserts exactly that swap.
  //
  // COUNT WHAT WAS THROWN, NOT WHAT IS STILL IN THE AIR. The first instrument
  // here read how many marks were ALIVE one frame after the blow, and a cut
  // lives 0.19 seconds — so on the suite's headless browser, which draws at
  // about one and a half frames a second, every cut was dead before anything
  // could look at it and the check reported a blade behaving like a spell. It
  // was measuring the frame rate. `cutsFired` and `ringsFired` are monotonic
  // and a slow machine cannot eat them.
  const blow = await J(async () => {
    const C3 = window.Cast3D;
    const rd = async () => { await new Promise(r => requestAnimationFrame(r));
                             const s = C3._state();
                             return { sparks: s.sparks, rings: s.ringsFired, cuts: s.cutsFired }; };
    const was = await rd();
    C3.hit('foe0', 'slash', 1.6, 'ash');
    const a = await rd();
    await new Promise(r => setTimeout(r, 900));
    C3.hit('foe0', 'cast', 1.6, 'elin');
    const b = await rd();
    const d = (x, y) => ({ sparks: x.sparks, rings: x.rings - y.rings, cuts: x.cuts - y.cuts });
    return { steel: d(a, was), spell: d(b, a) };
  });
  check('AIR: an impact happens in the world — sparks in metres, not pixels',
    blow.steel.sparks > 15 && blow.spell.sparks > 15, JSON.stringify(blow));
  check('AIR: …and a blade cuts along a line where a spell goes off in a circle',
    blow.steel.cuts > 0 && blow.steel.rings === 0
    && blow.spell.rings > 0 && blow.spell.cuts === 0,
    JSON.stringify(blow));

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
    const C3 = window.Cast3D, f = C3._figure('foe0');
    if (!f) return null;
    f.dead = false; f.burn = null;
    f.mixer.timeScale = 0;                     // only the burn may change
    const u = f.root.userData.mat.userData;
    const out = [];
    for (const b of [0, 0.4, 0.7, 1.0]) { u.burn.value = b; out.push(C3._cover('foe0')); }
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
  // THE MARK IS THE CLIP'S, NOT A CONSTANT. This asserted a third of the way
  // in, which was the old rule and is the bug: on the Unreal pack the blow
  // lands at 0.136, so a third of the way in is well past it and the attack was
  // over before the player let go. `holdFrac` reports where this clip says to
  // stop, and the property worth checking is that the body got there.
  check('READY: aiming winds the hero up and stops the body where the clip says',
    wound.acting && wound.held && wound.paused && wound.holdFrac > 0
    && Math.abs(wound.time - wound.dur * wound.holdFrac) < 0.09,
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

  // …AND IT NEVER STRAINS BACKWARDS. Sampling the held clip's own time across
  // a full breath: every sample must sit at or above the mark. Below it the
  // pose is unwinding toward the clip's first frame, which is what the old
  // sine did on every Unreal attack — their wind marks are all about 0.03,
  // and the breath was wider than the mark was deep.
  const breathe = await J(async () => {
    const f = window.Cast3D._figure('ash');
    const mark = f.acting ? f.acting.getClip().duration * f.holdFrac : 0;
    const seen = [];
    for (let i = 0; i < 40; i++) { f.step(0.035); seen.push(f.acting ? f.acting.time : 0); }
    return { mark: +mark.toFixed(4), lo: +Math.min(...seen).toFixed(4),
             hi: +Math.max(...seen).toFixed(4) };
  });
  check('READY: the held pose strains toward the blow and never back past the mark',
    breathe.mark > 0 && breathe.lo >= breathe.mark - 1e-4 && breathe.hi > breathe.mark,
    JSON.stringify(breathe) + ' — sword marks at 0.040 and the old breath was ±0.042');

  // A RESTART IS A TRIP TO ZERO, NOT A WOBBLE. Comparing two samples of a
  // breathing hold cannot detect one: the tension moves the clip's time by
  // ±42ms, so any threshold small enough to catch a restart is smaller than the
  // breath — the first version of this check reported a working hold as
  // restarted. `play` resets to 0, so that is what to look for.
  const beforeR = await snapR();
  await J(() => window.Cast3D.ready('ash', 'slash'));
  const afterR = await snapR();
  // AND IT CANNOT BE CHECKED ON THE CLOCK ANY MORE. The mark used to be a third
  // of the way into a long clip, so a restart showed up as the time falling a
  // long way. It is now about forty milliseconds in — inside the breath the
  // hold deliberately adds — so time alone can no longer tell a restart from
  // the wind-up straining. What the guard actually promises is that a second
  // `ready` for the same verb is a no-op: same clip, same mark, still held.
  check('READY: dragging across a second target does not restart the wind-up',
    afterR.acting && afterR.held && afterR.holdFrac === beforeR.holdFrac
    && afterR.verb === beforeR.verb,
    JSON.stringify({ before: beforeR.time, after: afterR.time,
                     holdFrac: afterR.holdFrac, stillHeld: afterR.held }));

  // and the drop finishes THAT swing rather than starting another
  await J(() => window.Cast3D.play('ash', 'slash'));
  const rel = await snapR();
  // AND THE MARK IS THE FLOOR OF THE HOLD, WHICH IT WAS NOT. This read
  // `time > mark` and went red about half the time, which was the code telling
  // the truth: the breath was `mark + sin(t) * 0.042` and sword's mark is 40ms
  // into the clip, so for half of every cycle the held time was BELOW the mark
  // and clamped at zero — the pose flicking back to the clip's first frame
  // three times a second on every attack. The strain is a raised cosine now,
  // travelling [mark, mark + amp] with the amplitude taking whatever room the
  // clip left, so the mark is a floor and `time >= mark` is a property the
  // hold actually has. Which makes this check honest rather than lucky.
  check('READY: letting go finishes the same swing, from where it stopped',
    rel.acting && !rel.paused && rel.holdFrac === 0 && rel.verb === beforeR.verb
    && rel.time >= beforeR.dur * beforeR.holdFrac - 1e-3,
    JSON.stringify(Object.assign({ stoppedAt: +(beforeR.dur * beforeR.holdFrac).toFixed(3) }, rel)));

  await sleep(1800);
  await J(() => window.Cast3D.ready('ash', 'slash'));
  await sleep(900);
  await J(() => window.Cast3D.unready('ash'));
  await sleep(260);
  const undone = await snapR();
  check('READY: …and a card that comes back unwinds the arm',
    !undone.acting && undone.holdFrac === 0, JSON.stringify(undone));
  await J(() => window.Cast3D.play('ash', 'idle'));

  // ═══ M6 · A DRAG REACHES THE ENEMY IT IS POINTING AT ═══
  //
  // `dropTargetAt` scores candidates by distance to the box, ZERO when the
  // pointer is inside it — a fine way to find the thing under a finger and a
  // useless way to choose between two things under a finger, because every
  // containing candidate ties at nothing and the earliest in the list wins.
  //
  // That was right while the opponents were painted plates laid out side by
  // side; their boxes did not quite overlap. Bodies in a perspective world do,
  // because that is what perspective IS — a line of three measured 569-751,
  // 666-830 and 765-875 across, so the middle of the second was inside the
  // first one's box. Dragging onto the second husk hit the first, and onto the
  // third hit the second.
  console.log('\n── pointing at the right enemy ──');
  await J(() => startCombat({ foes: ['husk', 'husk', 'wraith'] }));
  await sleep(2800);
  const aimed = await J(() => {
    const card = (C.hand || []).find(id => cardDef(id).target === 'enemy') || (C.hand || [])[0];
    return [...document.querySelectorAll('#k-cast [data-foe]')]
      .filter(n => n.offsetParent !== null)
      .map(n => {
        const r = n.getBoundingClientRect();
        const d = dropTargetAt(r.left + r.width / 2, r.top + r.height / 2, card);
        return { at: n.dataset.ix || '0', got: d && d.foe != null ? String(d.foe) : 'none' };
      });
  });
  check('AIM: dropping on a body hits THAT body, even where three overlap',
    aimed.length === 3 && aimed.every(a => a.at === a.got),
    JSON.stringify(aimed));

  // …AND THE BEAM HAS TO AGREE WITH IT (Build 134). `aimAnchor` sent every
  // enemy drop to `#k-boss-art` whatever `drop.foe` said, so Build 131's fix
  // resolved the right body and this drew the arc to the first one anyway and
  // hung `.k-aim-snap` on it. The drop was correct and every visible thing
  // about it was a lie — including, once the first opponent had died, a reticle
  // sitting on a corpse while the card resolved on somebody else.
  const anchored = await J(() => {
    const card = (C.hand || []).find(id => cardDef(id).target === 'enemy') || (C.hand || [])[0];
    return [...document.querySelectorAll('#k-cast [data-foe]')]
      .filter(n => n.offsetParent !== null)
      .map(n => {
        const r = n.getBoundingClientRect();
        const d = dropTargetAt(r.left + r.width / 2, r.top + r.height / 2, card);
        const a = aimAnchor(d);
        return { at: n.dataset.ix || '0',
                 beam: a && a.node ? (a.node.dataset.ix || '0') : 'none' };
      });
  });
  check('AIM: …and the beam ends on the body the drop resolved to',
    anchored.length === 3 && anchored.every(a => a.at === a.beam),
    JSON.stringify(anchored));

  // ═══ M7 · A SPARK IS A SIZE, AND A CORPSE STAYS GONE ═══
  //
  // `gl_PointSize` is pixels. Build 127 fed it `aScale * (bufferHeight * dpr *
  // 0.5) / distance` with aScale around 30 — a factor invented rather than
  // derived — which on a 430-pixel stage is 30 x 537 / 7 = 2300 PIXELS per
  // ember. Every spark five times taller than the screen, and every impact a
  // white circle with the fight somewhere behind it. "All hits just look like
  // a glowing circle" was arithmetic, not taste.
  //
  // The projection is size over distance, like everything else in the frame:
  // a sphere `d` metres across at `z` metres covers `d * H / (2 z tan(fov/2))`
  // pixels. So sizes are METRES now, and this checks the number the shader will
  // actually produce rather than the dial that feeds it.
  console.log('\n── how big is a spark ──');
  const spark = await J(() => {
    const F = window.Cast3D._fx();
    if (!F) return null;
    const uPx = F.sparks.mat.uniforms.uPx.value;
    return { uPx: +uPx.toFixed(1),
             at7m: +(0.055 * uPx / 7).toFixed(1),
             at4m: +(0.055 * uPx / 4).toFixed(1),
             ash5m: +(0.085 * uPx / 5).toFixed(1) };
  });
  check('SPARK: an ember is an ember, not a screen — a few pixels at fighting range',
    !!spark && spark.at7m > 1 && spark.at7m < 24 && spark.at4m < 40,
    JSON.stringify(spark) + ' px — Build 127 produced 799 here, on a 430px stage');

  // …AND A BODY THAT BURNED AWAY DOES NOT HAND ITS PAINTING BACK. Claiming the
  // element is what stands the plate down, and Build 128 stopped claiming it
  // the moment the burn finished — so a creature dissolved into ash and its
  // PAINTING faded back in behind it. The reckoning showed the Grief-Wraith
  // standing whole, in 2D, under a banner reading FALLEN.
  await J(() => startCombat({ foes: ['wraith'] }));
  await sleep(2600);
  await J(() => window.Cast3D.fell('foe0'));
  // WAIT FOR THE BURN, NOT FOR A STOPWATCH. It advances by animation time, and
  // this harness draws at about two frames a second with dt clamped to a
  // quarter — so a fixed sleep buys a number of FRAMES that shrinks as the
  // suite grows, and this check began failing for no reason but being later in
  // the file than it used to be.
  for (let i = 0; i < 40 && !(await J(() => !!window.Cast3D._figure('foe0').dead)); i++)
    await sleep(200);
  const fallen = await J(() => {
    const el = document.getElementById('k-boss-art');
    const f = window.Cast3D._figure('foe0');
    return { on3d: el.classList.contains('k-cast3d-on'),
             paint: getComputedStyle(el.querySelector('img')).opacity,
             body: !!f && f.root.visible, dead: !!(f && f.dead) };
  });
  check('FALLEN: a creature that burned away stays gone, painting and all',
    fallen.dead && !fallen.body && fallen.on3d && fallen.paint === '0',
    JSON.stringify(fallen));

  // ═══ M8 · THE PARRY DIMS THE WORLD, NOT THE PICTURE ═══
  //
  // `k-parry-focus` and `k-slowmo` put a CSS filter on the stage's children,
  // and `#k-cast` lives inside `#k-field`, which IS one of those children — so
  // the party, the plaza and THE CREATURE SWINGING AT YOU all went down as a
  // single element to 34% brightness and 5% saturation. A screenshot of a parry
  // is a black rectangle with one yellow ring in it and no attack behind it.
  // `.k-hero.k-parrying { filter: none }` was the escape hatch and it stopped
  // meaning anything the day the figures became pixels in a canvas.
  console.log('\n── the light comes off the world, not the fight ──');
  await J(() => startCombat({ foes: ['mourner'] }));
  await sleep(2400);
  const beforeF = await J(() => window.Cast3D._state().focus);
  await J(() => parryFocus(true));
  await sleep(1300);
  const during = await J(() => {
    const st = window.Cast3D._state();
    const sd = { key: 0, hemi: 0 };
    const f = window.Cast3D._figure('foe0');
    return { focus: st.focus, lit: st.lit,
             foeLit: +f.root.userData.mat.userData.lit.value.toFixed(2),
             fieldFilter: getComputedStyle(document.getElementById('k-field')).filter };
  });
  await J(() => parryFocus(false));
  await sleep(1000);
  const afterF = await J(() => window.Cast3D._state().focus);
  check('FOCUS: a parry takes the light off the world and leaves it on the fight',
    beforeF === 1 && during.focus < 0.35 && afterF > 0.8
    && during.lit.indexOf('foe0') >= 0 && during.foeLit > 0.9,
    JSON.stringify({ before: beforeF, during: during.focus, after: afterF,
                     lit: during.lit, foeLit: during.foeLit }));
  // …and the CSS must not be flattening the whole world on top of that
  check('FOCUS: …and the 3D field is not dimmed as one element by a filter',
    during.fieldFilter === 'none',
    JSON.stringify({ fieldFilter: during.fieldFilter }));

  // ═══ M9 · THE BODY TAKES THE TRAVEL, NOT THE FEET ═══
  //
  // The clips travel — a sword judgment steps into the blow. Build 112 pinned
  // the hips in the horizontal plane so a figure could not walk out of frame,
  // and its comment says that throws the travel away. It does not: it TRANSFERS
  // IT TO THE FEET, so the legs animate a stride the body never takes and the
  // planted foot slides along the floor.
  //
  // TWO CORRECTIONS TO THE INSTRUMENT BEFORE ANY OF THIS WAS TRUSTWORTHY. It
  // first summed the distance to "whichever foot is lower", so every change of
  // which foot that was counted a stride width as slide. And it first read bone
  // lengths off GUESSED adjacency — Hips>Spine, which are not adjacent here —
  // and reported 9.7% stretch on correct animation, which is precisely the
  // mistake Build 118 made, fixed, and wrote down. Adjacency is read off the
  // hierarchy now, and a planted foot is one foot.
  console.log('\n── the feet stay where they are put ──');
  const feet = await J(async () => {
    const C3 = window.Cast3D;
    const was = C3._state().on;
    C3.disable();
    const out = {};
    for (const who of ['ash', 'elin', 'mira']) {
      const f = C3._figure(who);
      const V = f.root.position.constructor;
      const wp = (b) => f.bones[b].getWorldPosition(new V());
      for (const verb of ['slash', 'hurt']) {
        const name = C3._verbClip(who, verb);
        if (!name) continue;
        f.clear(); f.play(name);
        const DT = 1 / 60;
        // …THROUGH THE WHOLE PATH, not just the mixer. `step` is half of what a
        // frame does to a figure; the other half is the foot solver, which runs
        // after the slot ease. A check that calls one and not the other grades
        // an animation the game never draws.
        const tick = () => { f.step(DT); if (window.Cast3D._footIK()) f.footLock(DT); };
        for (let i = 0; i < 8; i++) tick();
        const x0 = f.root.position.x, z0 = f.root.position.z;
        const down = { LeftFoot: null, RightFoot: null };
        const slide = { LeftFoot: 0, RightFoot: 0 };
        // ── THE WHOLE SWING, NOT SEVENTY FRAMES OF IT ──────────────────────
        //
        // This ran a fixed frame count, which is a WALL-CLOCK window over a
        // clip whose speed is not constant: Build 167 gave the swing a warp
        // that starts slow and accelerates into the blow, and elin's staff
        // promptly reported 0.037m of root travel against a 0.04 bar it had
        // been clearing at 0.042. Nothing about her stride changed — the same
        // seventy frames simply covered less of the clip, because the front of
        // it now plays slower.
        //
        // It is the same fault the skate gate had in Build 163 and it wants
        // the same answer: run until the CLIP is done rather than until the
        // frames are. The cap is a guard against a clip that never finishes,
        // not a budget.
        const act = f.actions[name], clipDur = act.getClip().duration;
        for (let i = 0; i < 400 && f.acting && act.time < clipDur * 0.995; i++) {
          tick();
          f.root.updateWorldMatrix(true, true);
          for (const foot of ['LeftFoot', 'RightFoot']) {
            const p = wp(foot);
            const planted = p.y < 0.14;
            if (planted && down[foot])
              slide[foot] += Math.hypot(p.x - down[foot].x, p.z - down[foot].z);
            down[foot] = planted ? p : null;
          }
        }
        out[who + '.' + verb] = { slide: +Math.max(slide.LeftFoot, slide.RightFoot).toFixed(3),
                                  body: +Math.hypot(f.root.position.x - x0, f.root.position.z - z0).toFixed(3) };
      }
      f.clear();
    }
    if (was) await C3.enable();
    return out;
  });
  // THE PROPERTY IS THAT THE BODY MOVES, not that the slide reaches some
  // number. A stride is only stolen from the feet if something else takes it,
  // and the root is the only thing that can — so this asks whether the root
  // actually travelled during a swing. Setting a slide threshold instead would
  // be tuning the bar to the result: the knock-down still slides about a metre,
  // because a clip that falls over backwards travels further than a lunge and
  // properly fixing that wants foot IK rather than root motion. Measured, the
  // three worst cases fall 20-53% (1.159 -> 0.948, 1.157 -> 0.548,
  // 1.154 -> 0.924); pinning alone moved the body not at all.
  const travelled = Object.entries(feet).filter(([k]) => /slash/.test(k));
  check('FEET: the body carries its own travel, so the feet do not have to',
    travelled.length === 3 && travelled.every(([, v]) => v.body > 0.04),
    JSON.stringify(Object.fromEntries(travelled)) + ' — body travel in metres during a swing');
  // ── AND THE SKATE CHECK MEASURED THE WRONG THING, TWICE OVER ────────────
  //
  // It summed how far a foot moved while below an absolute height, over a
  // FIXED NUMBER OF FRAMES. Both halves are wrong, and Build 163 is what made
  // that visible: slowing the clips by 14% moved ash's slash from 0.93 to 2.06
  // without touching the solver at all, because the window is wall-clock and a
  // slower clip puts a different amount of motion — and a different number of
  // anchor retakes — inside the same 70 frames. A reading that changes when
  // playback speed changes is not measuring the feet.
  //
  // The metric is the second fault. A foot near the ground that the ANIMATION
  // is moving is a low step, which is most of what an attack does; a foot the
  // solver is dragging is skate. Summing movement-while-low counts both, so it
  // rewards welding a foot to the floor and penalises stepping — and it duly
  // "improved" when a foot was pinned that should not have been, and "got
  // worse" when the pin was correctly released.
  //
  // ── SO IT ASKS THE DIFFERENTIAL, WHICH IS THE ACTUAL CLAIM ──────────────
  //
  // The glide here is the support-foot reading the slide probe already uses:
  // at every step take the SLOWER of the two feet, because a body on its feet
  // always has one of them still, so a large number means BOTH feet are moving
  // over the ground and that is exactly and only what gliding is. A swinging
  // foot cannot inflate it and a welded foot cannot flatter it.
  //
  // And it is measured with the solver off and then on, in the same page, on
  // the same clips, stepped by the clip's own time so no playback rate can
  // reach it. The property is the one the layer claims: THE SOLVER TAKES THE
  // SOURCE SKATE OUT. Measured, it removes 56-80% (sword 1.78->0.43, daggers
  // 1.54->0.67, staff 0.57->0.11, swordHeavy 3.43->1.27, daggersHeavy
  // 2.47->1.04), so the bar is set at half. That bar cannot be met by doing
  // nothing — with the solver off the two readings are equal and it fails.
  const skate = await J(async () => {
    const C3 = window.Cast3D;
    const was = C3._state().on, ik0 = C3._footIK();
    C3.disable();
    const f = C3._figure('ash');
    const V = f.root.position.constructor;
    const wp = (b) => f.bones[b].getWorldPosition(new V());
    const N = 48;
    // the clips that travel: a parry or a cast has no stride to skate on
    const CLIPS = ['sword', 'daggers', 'staff', 'swordHeavy', 'daggersHeavy'];
    const run = (ik) => {
      C3._footIK(ik);
      const out = {};
      for (const name of CLIPS) {
        const a = f.actions[name];
        if (!a) continue;
        for (const k of Object.keys(f.actions)) {
          f.actions[k].setEffectiveWeight(0); f.actions[k].stop();
        }
        if (f.idle) f.idle.setEffectiveWeight(0);
        a.reset(); a.setEffectiveWeight(1); a.play(); a.paused = true;
        f.restY = undefined; f.floorY = undefined;
        const dur = a.getClip().duration, dt = dur / (N - 1);
        const L = [], R = [];
        for (let i = 0; i < N; i++) {
          // stepped at the CLIP'S own time, so `timeScale` — and every dial
          // that scales it — is out of the measurement entirely
          a.time = i * dt;
          f.mixer.update(0);
          f.root.updateMatrixWorld(true);
          if (ik) f.footLock(dt);
          f.root.updateMatrixWorld(true);
          L.push(wp('LeftFoot')); R.push(wp('RightFoot'));
        }
        const d = (p, q) => Math.hypot(p.x - q.x, p.z - q.z);
        const floor = Math.min(...L.map(p => p.y), ...R.map(p => p.y));
        let glide = 0;
        for (let i = 1; i < N; i++) {
          // a figure with both feet off the ground owes nobody a planted one
          if (Math.min(L[i].y, R[i].y) - floor > 0.12) continue;
          glide += Math.min(d(L[i], L[i - 1]), d(R[i], R[i - 1]));
        }
        out[name] = +glide.toFixed(3);
      }
      return out;
    };
    const off = run(false), on = run(true);
    f.clear();
    C3._footIK(ik0);
    if (was) await C3.enable();
    const cut = {};
    for (const k of Object.keys(off))
      cut[k] = off[k] > 0.01 ? +(1 - on[k] / off[k]).toFixed(2) : null;
    return { off, on, cut };
  });
  const cuts = Object.values(skate.cut).filter(v => v !== null);
  check('FEET: the foot solver takes the skate out of the clips that have it',
    cuts.length === 5 && cuts.every(v => v >= 0.5),
    JSON.stringify(skate.cut) + ' — fraction of the source glide removed, per clip; raw '
      + JSON.stringify(skate.off) + ' m becomes ' + JSON.stringify(skate.on)
      + ' — with the solver off these two are the same and the check fails');

  // ═══ M10 · TIME DILATES WHERE THE FIGHT IS ═══
  //
  // `parrySlowmo` has toggled `k-slowmo` since Build 22, and its comment calls
  // it "Clair-Obscur slow-mo: the instant a note becomes tappable, time
  // dilates". What the class does is `animation-play-state: paused` on the
  // stage's children — it stops CSS keyframes. The 3D world is a canvas driven
  // by its own animation loop, and no CSS property has ever touched it, so for
  // every build since the world existed the bar slowed and the swing coming at
  // you did not. The one thing the player is being asked to answer was the one
  // thing that never slowed down.
  //
  // ── MEASURED AS THE WORLD'S OWN CLOCK AGAINST THE WALL CLOCK ──
  //
  // The first instrument sampled how far a WRIST travelled in a fixed slice of
  // real time, once at full speed and once slowed, on the reasoning that a
  // distance cannot be produced by the dial alone. It is a fair property and an
  // unreliable way to read it, and two sessions have now watched it fail on a
  // build that was fine: 0.224 / 0.414 / 0.252 against a 0.62 bar on one
  // machine, and fast 1.037 against slow 0.962 here — with the same check
  // passing twice in a row either side of that failure.
  //
  // Two things break it and neither is the game. Headless renders at about two
  // frames a second, so a 640ms window is one or two samples and the wrist is
  // wherever the swing happened to be. And a strike is barely longer than the
  // window, so at full speed it can END inside it while the slowed arm is still
  // mid-swing: the two halves are not measuring the same motion at all.
  //
  // What the dial does is scale the time the 3D world advances by — frame()
  // multiplies real elapsed time by the eased level and hands that to the
  // mixer. So the honest reading is the MIXER'S OWN CLOCK against the wall
  // clock: seconds of animation per second of reality, at each setting. Frame
  // rate divides out of the ratio, and the idle loops so nothing can finish
  // underneath the measurement.
  const clock = await J(async () => {
    const C3 = window.Cast3D, f = C3._figure('ash');
    // let the eased level ARRIVE before reading anything: it moves at
    // real/0.12 per frame, which at two frames a second is not instant
    const settle = async (want) => {
      C3.slow(want);
      for (let i = 0; i < 240; i++) {
        await new Promise(r => requestAnimationFrame(r));
        if (Math.abs(C3._state().slow - want) < 0.01) break;
      }
    };
    const rate = async () => {
      const t0 = performance.now(), m0 = f.mixer.time;
      for (let i = 0; i < 24; i++) await new Promise(r => requestAnimationFrame(r));
      return (f.mixer.time - m0) / ((performance.now() - t0) / 1000);
    };
    await settle(1);
    const fast = await rate();
    await settle(0.34);
    const slow = await rate();
    const at = C3._state().slow;
    await settle(1);
    return { fast: +fast.toFixed(3), slow: +slow.toFixed(3),
             ratio: +(slow / (fast || 1)).toFixed(3), dial: at, back: C3._state().slow };
  });
  check('TIME: slowing down reaches the world, not just the interface',
    clock.ratio > 0.2 && clock.ratio < 0.55,
    JSON.stringify(clock) + ' — seconds of animation per second of reality;'
      + ' the dial asks for 0.34 and a canvas ignoring it would read 1.0');
  check('TIME: …and it gives the clock back',
    clock.back > 0.9, JSON.stringify({ back: clock.back }));

  // ═══ M11 · THE GUARD ANSWERS THE ARROW ═══
  //
  // Two things are being protected here, and the second is the one that was
  // wrong for twenty-five builds.
  //
  // THAT THERE IS A MOTION AT ALL. The shipped `parry` moved the weapon hand
  // three centimetres — measured against 86 for a sword swing and 76 for a
  // flinch — because whatever GLB the mill was pointed at was a person standing
  // still. "The parry needs work" was not a polish note; there was nothing to
  // polish. So the floor is a real one: a parry has to move a hand further than
  // a body breathing does.
  //
  // AND THAT THE FIVE OF THEM DIFFER ON SCREEN. A note carries an arrow, and
  // the guards have to travel the way it points IN THE PICTURE — which is not
  // the same as travelling that way in the body, because the party stands side
  // on to the lens. The first cut of the authored clips mirrored one guard to
  // make the other; the algebra was right and both of them came out moving the
  // same way on screen, because the difference between them was depth. So this
  // measures where the hands go THROUGH THE REAL CAMERA, which is the only
  // frame the arrow on the note is drawn in.
  console.log('\n── the guard answers the arrow ──');
  const guards = await J(async () => {
    const C3 = window.Cast3D, f = C3._figure('ash');
    const parts = C3._parts();
    const mul = (m, v) => { const e = m.elements, o = [];
      for (let r = 0; r < 4; r++) o[r] = e[r] * v[0] + e[4 + r] * v[1] + e[8 + r] * v[2] + e[12 + r] * v[3];
      return o; };
    const wp = (n) => { const b = f.bones[n]; b.updateWorldMatrix(true, false);
                        const e = b.matrixWorld.elements; return [e[12], e[13], e[14]]; };
    const guard = () => {
      const g = ['LeftHand', 'RightHand'].map(wp);
      const m = [0, 1, 2].map(i => (g[0][i] + g[1][i]) / 2);
      parts.cam.updateMatrixWorld();
      const v = mul(parts.cam.projectionMatrix, mul(parts.cam.matrixWorldInverse, [...m, 1]));
      // …AND THE BODY'S OWN HEIGHT, which is the thing an up or down arrow is
      // really about. Rotating the legs moves the FEET, not the body: the hips
      // are the root of that chain, so Build 137's ninety-degree knee bend
      // moved Ash's head eight MILLIMETRES and read as a man lifting his feet.
      let low = 9;
      for (const n of Object.keys(f.bones)) low = Math.min(low, wp(n)[1]);
      return { x: v[3] ? v[0] / v[3] : 0, y: m[1], head: wp('Head')[1], low };
    };
    const out = {};
    for (const dir of [null, 'L', 'R', 'U', 'D']) {
      const clip = C3._verbClip('ash', 'parry', dir);
      const a = f.actions[clip];
      if (!a) { out[dir || 'none'] = null; continue; }
      for (const k of Object.keys(f.actions)) { f.actions[k].setEffectiveWeight(0); f.actions[k].stop(); }
      if (f.idle) f.idle.setEffectiveWeight(0);
      a.reset(); a.setEffectiveWeight(1); a.play(); a.paused = true;
      const dur = a.getClip().duration;
      let x0 = 0, y0 = 0, h0 = 0, lo = 0, hi = 0, top = 0, bot = 0, far = 0;
      let hUp = 0, hDn = 0, floor = 9;
      for (let i = 0; i <= 20; i++) {
        a.time = dur * (i / 20);
        f.mixer.update(0);
        f.root.updateMatrixWorld(true);
        const g = guard();
        if (i === 0) { x0 = g.x; y0 = g.y; h0 = g.head; }
        lo = Math.min(lo, g.x - x0); hi = Math.max(hi, g.x - x0);
        bot = Math.min(bot, g.y - y0); top = Math.max(top, g.y - y0);
        far = Math.max(far, Math.abs(g.y - y0));
        hUp = Math.max(hUp, g.head - h0); hDn = Math.min(hDn, g.head - h0);
        floor = Math.min(floor, g.low);
      }
      for (const k of Object.keys(f.actions)) { f.actions[k].setEffectiveWeight(0); f.actions[k].stop(); }
      out[dir || 'none'] = { clip, right: +hi.toFixed(4), left: +lo.toFixed(4),
                             up: +top.toFixed(3), down: +bot.toFixed(3), reach: +far.toFixed(3),
                             head: +(hUp + hDn).toFixed(3), floor: +floor.toFixed(3) };
    }
    if (f.idle) f.idle.setEffectiveWeight(0.55);
    C3.play('ash', 'idle');
    return out;
  });
  const G = (k) => guards[k] || { right: 0, left: 0, up: 0, down: 0, reach: 0 };
  check('GUARD: a parry is a MOTION — the shipped one moved a hand three centimetres',
    ['none', 'L', 'R', 'U', 'D'].every(k => guards[k] && guards[k].reach > 0.12),
    JSON.stringify(Object.fromEntries(Object.entries(guards).map(([k, v]) => [k, v && v.reach])))
      + ' m — how far the guard gets from where it started');
  check('GUARD: the arrow picks a different clip for every direction',
    new Set(['none', 'L', 'R', 'U', 'D'].map(k => guards[k] && guards[k].clip)).size === 5,
    JSON.stringify(Object.fromEntries(Object.entries(guards).map(([k, v]) => [k, v && v.clip]))));
  check('GUARD: a right arrow drives the hands right ACROSS THE SCREEN, a left arrow left',
    G('R').right > G('L').right && G('L').left < G('R').left && G('R').right > 0.06,
    JSON.stringify({ R: [G('R').left, G('R').right], L: [G('L').left, G('L').right] })
      + ' — clip-space x travel; mirroring gave both of them +0.065');
  check('GUARD: an up arrow gets under the blow and a down arrow drops below it',
    G('U').up > G('none').up && G('D').up < G('none').up,
    JSON.stringify({ U: G('U').up, D: G('D').up, none: G('none').up }) + ' m of lift');
  // …AND THE BODY MOVES, NOT JUST THE ARMS. This is the one the first cut of
  // the guards failed silently: a deep knee bend rotates the legs about the
  // pelvis and leaves everything above it exactly where it was, so both
  // vertical guards moved Ash's head by under a centimetre. The height now
  // comes from the hips, where it has to.
  check('GUARD: …and it is the BODY that rises and drops, not only the hands',
    G('U').head > 0.02 && G('D').head < -0.1,
    JSON.stringify({ U: G('U').head, D: G('D').head, none: G('none').head })
      + ' m the head moves — rotating the legs alone gave 0.003 and -0.008');
  check('GUARD: …without anybody sinking into the paving',
    ['none', 'L', 'R', 'U', 'D'].every(k => guards[k] && guards[k].floor > -0.05),
    JSON.stringify(Object.fromEntries(Object.entries(guards).map(([k, v]) => [k, v && v.floor])))
      + ' m — the lowest joint at its lowest; an 18cm crouch was 24 and buried the toes');

  // ═══ M12 · TWO OF THEM, AND THREE ═══
  //
  // Twelve cards in this deck are owned by a PAIR and one by the bond itself,
  // and the all-out is all three at once. Recorded from inside the page — the
  // browser here draws at about 1.5fps, so polling a half-second window over
  // the Playwright bridge measures the harness rather than the game — the
  // all-out played exactly three clips and all three were the VICTIM flinching.
  // A pair card moved one person. `Both Blades` swung one blade.
  console.log('\n── two of them, and three ──');
  const tap = () => J(() => {
    const C3 = window.Cast3D;
    window.__log = [];
    const t0 = performance.now();
    if (!C3.__rawPlay) { C3.__rawPlay = C3.play; C3.__rawShot = C3.shot; }
    C3.play = function (id, verb) {
      window.__log.push([Math.round(performance.now() - t0), 'play', id, verb]);
      return C3.__rawPlay.apply(C3, arguments);
    };
    C3.shot = function (name, opts) {
      if (name != null && typeof name === 'string')
        window.__log.push([Math.round(performance.now() - t0), 'shot', name, !!(opts && opts.for)]);
      return C3.__rawShot.apply(C3, arguments);
    };
  });
  const drain = () => J(() => {
    const C3 = window.Cast3D;
    if (C3.__rawPlay) { C3.play = C3.__rawPlay; C3.shot = C3.__rawShot;
                        C3.__rawPlay = null; C3.__rawShot = null; }
    return window.__log || [];
  });
  const heroesIn = (log) => [...new Set(log.filter(r => r[1] === 'play'
      && ['ash', 'elin', 'mira'].includes(r[2]) && r[3] !== 'idle').map(r => r[2]))].sort();
  const shotsIn = (log) => log.filter(r => r[1] === 'shot' && r[3]).map(r => r[2]);

  await tap();
  await J(async () => {
    window.K.forceHand(['bothblades']);           // owner: ash|mira
    window.K.state().ap = 9;
    await window.K.playCard('bothblades', { foe: 0 });
  });
  await sleep(3400);
  const duo = await drain();
  check('DUO: a pair card moves BOTH of the people who own it',
    heroesIn(duo).join(',') === 'ash,mira',
    JSON.stringify(heroesIn(duo)) + ' acted — Both Blades is owned by ash|mira');
  check('DUO: …one after the other, so it reads as an answer and not a copy',
    (() => { const p = duo.filter(r => r[1] === 'play' && ['ash', 'mira'].includes(r[2]));
             return p.length >= 2 && p[1][0] - p[0][0] >= 120; })(),
    JSON.stringify(duo.filter(r => r[1] === 'play' && ['ash', 'mira'].includes(r[2]))));
  check('DUO: and the camera CUTS — one on each of them, then a frame holding both',
    ['commit', 'answer', 'together'].every(n => shotsIn(duo).includes(n)),
    JSON.stringify(shotsIn(duo)));

  await tap();
  await J(async () => { const st = window.K.state(); st.kizuna = 100; await window.K.allOut(); });
  await sleep(4200);
  const trio = await drain();
  check('TRIO: an all-out moves every living body, not just the one being hit',
    heroesIn(trio).length === 3,
    JSON.stringify(heroesIn(trio)) + ' — it used to be nobody');
  check('TRIO: …and the camera is still on them when the blows land',
    shotsIn(trio).includes('alloutland'),
    JSON.stringify(shotsIn(trio)) + ' — home used to be asked for BEFORE the damage');
  // ── …AND THEY CROSS THE FLOOR, EACH SAYING THEIR OWN WORD ──
  //
  // Build 138 gave the all-out three bodies and all three swung a sword on the
  // spot. A swing carries the root about four centimetres — the clip's own step
  // — and "the three of them cross the floor at once" is not four centimetres.
  const charge = await J(async () => {
    const C3 = window.Cast3D;
    const who = ['ash', 'elin', 'mira'];
    const home = {}, far = {}, verbs = {};
    for (const id of who) { const f = C3._figure(id);
      home[id] = [f.root.position.x, f.root.position.z]; far[id] = 0;
      verbs[id] = C3.verbFor(id); }
    let stop = false;
    const tick = () => {
      for (const id of who) { const f = C3._figure(id);
        far[id] = Math.max(far[id], Math.hypot(f.root.position.x - home[id][0],
                                               f.root.position.z - home[id][1])); }
      if (!stop) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    window.K.state().kizuna = 100;
    await window.K.allOut();
    await new Promise(r => setTimeout(r, 2600));
    stop = true;
    for (const id of who) far[id] = +far[id].toFixed(3);
    return { far, verbs };
  });
  check('TRIO: every one of them actually crosses the floor',
    ['ash', 'elin', 'mira'].every(id => charge.far[id] > 0.5),
    JSON.stringify(charge.far) + ' m from where they started — a swing alone carries 0.04');
  check('TRIO: …and the party mage casts rather than swinging her staff like a club',
    charge.verbs.elin === 'cast' && charge.verbs.ash === 'slash' && charge.verbs.mira === 'slash',
    JSON.stringify(charge.verbs));

  // ── A PHASE MUST NOT STEAL THE FRAME FROM A BEAT ──
  //
  // `{ for: ms }` has existed since Build 122 precisely to stop this, and it
  // never worked: a stance took the frame unconditionally, and `setPhase` fires
  // `castShot('home')` the instant a card resolves. Measured, `shot strike` and
  // `shot home` land on the SAME TICK — so every action shot in this game has
  // been asked for and thrown away within a millisecond for sixteen builds.
  const steal = await J(() => {
    const C3 = window.Cast3D;
    C3.uncut();
    C3.shot('home');                          // a clean stance, nothing held
    const home = C3.shot().asked.az;
    C3.shot('strike', { for: 4000 });         // a beat takes the frame
    const held = C3.shot().asked.az;
    C3.shot('home');                          // what setPhase does, one tick later
    const s = C3.shot();
    return { home, held, after: s.asked.az, lives: s.base.az, holding: s.holding > 0 };
  });
  check('SHOT: a phase says where the camera LIVES; it does not interrupt a beat',
    steal.holding && steal.held === steal.after
    && steal.after !== steal.home && steal.lives === steal.home,
    JSON.stringify(steal) + ' — azimuth. `after` is the beat still on screen'
      + ' and `lives` is where the stance will take it once the beat is done');

  // ── AND A SHOT CAN BE ABOUT A PERSON ──
  // `at` could name a SIDE or a literal point. A duo is neither: it is two
  // named people, and framing it means holding on one and cutting to the other.
  // Compared against the same shot aimed at the foe line, because the question
  // is whether the lens actually goes somewhere else — not whether the field
  // was copied through.
  const about = await J(async () => {
    const C3 = window.Cast3D;
    const f = C3._figure('ash');
    if (!f) return null;
    const settle = async () => { for (let i = 0; i < 6; i++)
      await new Promise(r => requestAnimationFrame(r)); };
    C3.uncut();
    // A MOMENT FROM THE SECTION ABOVE CAN STILL BE HOLDING THE FRAME, and a
    // stance asked for while one is — correctly, since Build 138 — updates
    // where the camera lives without moving it. So both shots below would be
    // recorded and neither would take, and the two readings would come back
    // identical for a reason that has nothing to do with aiming at a person.
    // The hold expiring is not the property under test; the check above this
    // one is the one that owns it.
    for (let i = 0; i < 240 && C3.shot().holding > 0; i++)
      await new Promise(r => requestAnimationFrame(r));
    C3.shot('together', { at: 'foe' });
    await settle();
    const atFoe = C3.shot().at.atP.slice();
    C3.shot('together', { at: ['ash'] });
    await settle();
    const s = C3.shot();
    return { asked: s.asked.at, atFoe: atFoe.map(v => +v.toFixed(2)),
             atAsh: s.at.atP.map(v => +v.toFixed(2)),
             ashX: +(f.root.position.x + (f.ctrOff || 0)).toFixed(2) };
  });
  check('SHOT: a shot can be about a PERSON, not just a side of the board',
    !!about && Array.isArray(about.asked) && about.asked[0] === 'ash'
    && Math.abs(about.atAsh[0] - about.ashX) < Math.abs(about.atFoe[0] - about.ashX),
    JSON.stringify(about) + ' — the lens ends up nearer Ash than the foe line does');
  await J(() => { window.Cast3D.uncut(); window.Cast3D.shot('home'); });

  // ═══ N · THE CAMERA STAYS FOR THE WHOLE ACTION, AND FRAMES BOTH OF THEM ═══
  //
  // Two faults, reported from a playtest as "the camera frames the enemy when
  // the attack goes off and we don't see our heroes perform their full action".
  //
  // THE HOLD WAS A CONSTANT. `for: 760` was chosen when a sword swing was a
  // 4.4s procedural clip windowed down to 1.15s on screen. The Unreal clips are
  // their own lengths — measured, slash 1150ms, heavy 1183, cast 1200 — so the
  // lens handed the frame back with better than a third of every action still
  // to play. The layer knows how long a clip will be on screen; the camera asks
  // it now instead of guessing.
  //
  // AND THE FRAME HELD ONE END OF THE EXCHANGE. `strike` was `at: 'foe'`:
  // measured, that put the swinging hero at 0.12 of the frame's width and the
  // other two at -0.13 and -0.02 — off the picture. Naming the attacker AND the
  // target puts the lens between them, and the swing travels across the frame
  // into the thing it lands on: 0.35 for the hero, 0.69 for the foe.
  console.log('\n── the camera stays for the whole action ──');
  const lens = await J(async () => {
    const C3 = window.Cast3D;
    const b = document.getElementById('k-cast').getBoundingClientRect();
    const seen = (id) => {
      const e = document.querySelector('.k-hero[data-hero="' + id + '"]')
        || document.querySelector('#k-cast .k-foe-art[data-ix="' + String(id).replace('foe', '') + '"]');
      if (!e) return null;
      const q = e.getBoundingClientRect();
      return +(((q.left + q.width / 2) - b.left) / b.width).toFixed(2);
    };
    const foe = 'foe' + ((window.C && window.C.aim) || 0);
    const target = document.querySelector('#k-cast .k-foe-art') ? foe : null;
    const ms = C3.beatMs('ash', 'slash');
    C3.uncut();
    C3.shot('strike', { for: Math.max(760, ms + 420), speed: 2.9, at: ['ash', foe] });
    // READ THE HOLD NOW. A hold is a deadline in real time, and headless runs at
    // about two frames a second — waiting forty frames to look at it measures
    // the harness's frame rate and reports an expired hold as a missing one.
    const held = C3.shot().holding;
    for (let i = 0; i < 12; i++) await new Promise(r => requestAnimationFrame(r));
    return { ms, held, hero: seen('ash'), foe: seen(foe), target };
  });
  check('LENS: the camera holds for as long as the action is on screen',
    lens.ms > 0 && lens.held + 40 >= lens.ms,
    JSON.stringify(lens) + ' ms — the hold was a flat 760 against actions of 1150 to 1200');
  // …AND BOTH ENDS OF IT ARE IN THE PICTURE. A fraction of the frame's width:
  // 0 is the left edge and 1 the right, so anything outside 0..1 is off screen
  // and anything under about 0.1 is jammed against the edge.
  check('LENS: …and the hero throwing the blow is in the frame, not on its edge',
    lens.hero != null && lens.hero > 0.15 && lens.hero < 0.85,
    JSON.stringify({ hero: lens.hero, foe: lens.foe })
      + ' — aiming at the foe alone put the hero at 0.12 and the other two off the picture');

  // ═══ N · THEY ARE HOLDING SOMETHING ═══
  //
  // Every clip in the library is a sword swing, a pair of daggers or a staff
  // cast, and until now the figure performing it had empty hands.
  //
  // The grip is derived from the rig rather than posed by hand: the line out
  // from the elbow through the wrist is the one axis a hand bone reliably
  // gives you, and it is the same axis the effects rig has used for the trail
  // since it was written. So the checks are about PARENTAGE and SCALE — that
  // the thing is a child of the hand that swings it, and that a sword is a
  // sword's length once the figure's own fitting scale is divided back out.
  console.log('\n── they are holding something ──');
  const arms = await J(() => {
    const C3 = window.Cast3D, out = {};
    for (const id of ['ash', 'elin', 'mira']) {
      const f = C3._figure(id);
      if (!f) continue;
      const w = f.weapons || [];
      out[id] = { kind: f.tone.strike, n: w.length, inHand: 0, metres: 0 };
      for (const g of w) {
        // is it parented to a hand?
        for (let o = g.parent; o; o = o.parent)
          if (o.isBone && /Hand$/.test(o.name)) { out[id].inHand++; break; }
        // THREE is not a global in this page, so the box is walked by hand:
        // every mesh's own bounding box, its eight corners pushed through that
        // mesh's world matrix, and the extent of the union
        g.updateWorldMatrix(true, true);
        let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
        g.traverse(o => {
          if (!o.isMesh || !o.geometry) return;
          if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
          const bb = o.geometry.boundingBox, e = o.matrixWorld.elements;
          for (let i = 0; i < 8; i++) {
            const x = (i & 1) ? bb.max.x : bb.min.x;
            const y = (i & 2) ? bb.max.y : bb.min.y;
            const z = (i & 4) ? bb.max.z : bb.min.z;
            const p = [e[0]*x + e[4]*y + e[8]*z  + e[12],
                       e[1]*x + e[5]*y + e[9]*z  + e[13],
                       e[2]*x + e[6]*y + e[10]*z + e[14]];
            for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], p[k]); mx[k] = Math.max(mx[k], p[k]); }
          }
        });
        out[id].metres = Math.max(out[id].metres,
          +Math.max(mx[0]-mn[0], mx[1]-mn[1], mx[2]-mn[2]).toFixed(2));
      }
    }
    return out;
  });
  const want = { ash: 1, elin: 1, mira: 2 };
  check('ARMS: every hero is holding the weapon their clips swing',
    Object.entries(want).every(([k, n]) => arms[k] && arms[k].n === n && arms[k].inHand === n),
    JSON.stringify(arms) + ' — a dagger pair is two, and each one has to be a'
      + ' child of the hand that swings it');
  // …AND AT THE SIZE IT SAYS IT IS. A blade parented to a bone inherits the
  // scale `fit` gave the figure, which is not 1 on any of these models.
  check('ARMS: …and a sword is a sword long, not the model scale it inherited',
    arms.ash && arms.ash.metres > 0.7 && arms.ash.metres < 1.4
    && arms.mira && arms.mira.metres > 0.2 && arms.mira.metres < 0.6,
    JSON.stringify({ sword: arms.ash && arms.ash.metres, dagger: arms.mira && arms.mira.metres,
                     staff: arms.elin && arms.elin.metres }) + ' metres, longest edge');

  // ═══ N · HOLDING A CARD WINDS UP; LETTING GO SWINGS ═══
  //
  // The hold mark was a constant per verb — 0.34 of the clip for a slash —
  // chosen against procedural clips several seconds long. On the Unreal pack
  // the blow lands at 0.136, so holding a card froze the body a THIRD of the
  // way in: well past the moment the blade arrives. The attack was over before
  // the player let go of the card, which is exactly what was reported.
  //
  // Each clip now carries its own mark, measured by tools/contact.cjs as the
  // calmest moment before the blow. On the spells that is a real gather — cast
  // holds at 0.339 of 0.898 — and on the swings it comes out at the opening
  // pose, because these clips begin in a fighting stance and commit at once
  // with no backswing in them. Against a relaxed idle that stance IS the
  // wind-up, and the whole swing plays on release.
  console.log('\n── holding winds up, letting go swings ──');
  const wind = await J(async () => {
    const C3 = window.Cast3D, out = {};
    for (const [who, verb] of [['ash', 'slash'], ['mira', 'slash'], ['elin', 'cast']]) {
      C3.unready(who);
      if (!C3.ready(who, verb)) { out[who] = { err: 'refused' }; continue; }
      const f = C3._figure(who);
      for (let i = 0; i < 90 && !f.held; i++) await new Promise(r => requestAnimationFrame(r));
      const a = f.acting;
      out[who] = {
        clip: a && a.getClip().name,
        held: !!f.held,
        stopped: a ? Math.round(1000 * a.time / (a.timeScale || 1)) : -1,
        contact: C3.contactMs(who, verb),
      };
      C3.unready(who);
    }
    return out;
  });
  const early = Object.entries(wind).every(([, v]) =>
    v.held && v.contact > 0 && v.stopped >= 0 && v.stopped < v.contact);
  check('WIND: a held card stops the body BEFORE the blow, not after it',
    early, JSON.stringify(wind) + ' ms — a constant 0.34 of the clip stopped'
      + ' the sword at 391ms against a contact frame at 156');
  // …AND THERE IS STILL AN ACTION LEFT TO THROW. A wind-up that has consumed
  // the whole swing leaves releasing the card with nothing to show.
  const left = Object.entries(wind).every(([, v]) => v.contact - v.stopped > 40);
  check('WIND: …and the blow is still to come when the card is let go',
    left, JSON.stringify(Object.fromEntries(Object.entries(wind)
      .map(([k, v]) => [k, (v.contact - v.stopped) + 'ms of swing left']))));

  // ═══ N · THE BLOW WAITS FOR THE SWING ═══
  //
  // `resolveEffects` ran BEFORE `fxPlayCard`, so the damage, the flash, the
  // screen kick, the recoil and the number all fired before the hero had begun
  // to move: the enemy was hit and THEN the sword came down. No camera work
  // fixes that, and it is the whole of "it doesn't look like our character is
  // performing the attack to hit the enemy".
  //
  // Checked at the instant the card resolves, which needs no timer and cannot
  // race: the acting figure must already be swinging, and the damage number
  // must not have been printed yet.
  console.log('\n── the blow waits for the swing ──');
  const order = await J(async () => {
    const C3 = window.Cast3D;
    const before = document.querySelectorAll('.k-pop').length;
    if (typeof C === 'undefined' || !C || !C.hand) return { err: 'no fight in progress' };
    // the sections above spend the hand; deal a fresh fight so there is
    // certainly something to swing
    if (!(C.hand || []).some(id => cardDef(id).target === 'enemy')) {
      startCombat({ foes: ['husk'] });
      for (let i = 0; i < 30; i++) await new Promise(r => requestAnimationFrame(r));
    }
    const card = (C.hand || []).find(id => cardDef(id).target === 'enemy');
    if (!card) return { err: 'no attack card in hand', hand: (C.hand || []).length };
    const who = primaryHero(cardDef(card));
    C.aim = 0;
    playCard(card);
    // read on the very next line — nothing has had a chance to time out
    return { who, playing: C3._state().playing[who],
             popped: document.querySelectorAll('.k-pop').length - before,
             contact: C3.contactMs(who, 'slash'), beat: C3.beatMs(who, 'slash') };
  });
  check('BLOW: the hero is already swinging when the card resolves',
    !order.err && !!order.playing,
    JSON.stringify(order) + ' — fxPlayCard used to run AFTER resolveEffects');
  check('BLOW: …and the damage has not been printed yet',
    !order.err && order.popped === 0,
    JSON.stringify({ popped: order.popped, contactMs: order.contact })
      + ' — the number now waits for the frame the weapon arrives on');
  check('BLOW: …which is a real frame inside the action, not its start or its end',
    !order.err && order.contact > 0 && order.contact < order.beat,
    JSON.stringify({ contactMs: order.contact, onScreenMs: order.beat })
      + ' — measured by tools/contact.cjs as the fastest frame of the weapon hand');

  // ═══ N · THE BODY IS STILL A BODY ═══
  //
  // An imported clip can be wrong in a way every other check in this file
  // passes over. The suite already asks whether a verb moves the figure, and
  // whether two verbs look different from each other — a party folded into a
  // ball moves plenty and looks nothing like a party standing up, so both
  // sailed through. So did the importer's own gate, which asks how far the
  // furthest joint TURNED: the angle of a rotation does not change when you
  // change the frame you measure it in, so a clip rotated into completely the
  // wrong axes turns exactly as far as one rotated correctly.
  //
  // Measured on the import that shipped in Build 140: a heavy sword swing put
  // the trunk 131 degrees off vertical halfway through — past horizontal, head
  // below the hips, both feet 70cm in the air — and the ordinary swing reached
  // 111. The clips that replaced them reach 73 at the top of a leap.
  //
  // ONE CLIP IS ALLOWED TO GO PAST HORIZONTAL and it is the knock-down, where
  // being horizontal is the entire point. Everything else is a person on their
  // feet, whatever else they are doing.
  console.log('\n── the body is still a body ──');
  let folds = await J(async () => {
    const C3 = window.Cast3D, f = C3._figure('ash');
    const B = {};
    f.root.traverse(o => { if (o.isBone) B[o.name] = o; });
    const wp = (n) => { const o = B[n]; if (!o) return null;
      const m = o.matrixWorld.elements; return [m[12], m[13], m[14]]; };
    const worst = {}, off = {};
    for (const clip of Object.keys(f.actions)) {
      const a = f.actions[clip], dur = a.getClip().duration;
      let mx = 0, air = 0;
      for (let i = 0; i < 8; i++) {
        for (const k of Object.keys(f.actions)) { f.actions[k].setEffectiveWeight(0); f.actions[k].stop(); }
        if (f.idle) f.idle.setEffectiveWeight(0);
        a.reset(); a.setEffectiveWeight(1); a.play(); a.paused = true;
        a.time = dur * (i / 7) * 0.999;
        f.mixer.update(0);
        f.root.updateMatrixWorld(true);
        const h = wp('Hips'), hd = wp('Head'), lf = wp('LeftFoot'), rf = wp('RightFoot');
        if (!h || !hd) continue;
        const v = [hd[0] - h[0], hd[1] - h[1], hd[2] - h[2]];
        const L = Math.hypot(v[0], v[1], v[2]) || 1;
        mx = Math.max(mx, Math.acos(Math.max(-1, Math.min(1, v[1] / L))) * 180 / Math.PI);
        if (lf && rf) air = Math.max(air, Math.min(lf[1], rf[1]));
      }
      worst[clip] = +mx.toFixed(0);
      off[clip] = +air.toFixed(2);
    }
    for (const k of Object.keys(f.actions)) { f.actions[k].paused = false; f.actions[k].setEffectiveWeight(0); f.actions[k].stop(); }
    f.acting = null; if (f.idle) f.idle.setEffectiveWeight(1);
    return { worst, off };
  });
  const feetUp = folds.off; folds = folds.worst;
  const upright = Object.entries(folds).filter(([k]) => k !== 'down');
  const bent = upright.filter(([, v]) => v >= 90).map(([k, v]) => k + ' ' + v + '°');
  check('BODY: nobody folds past horizontal — the knock-down is the one that may',
    bent.length === 0 && folds.down != null,
    JSON.stringify(folds) + ' — the furthest the trunk gets from vertical, in degrees;'
      + ' the Build 140 import read swordHeavy 131 and sword 111');
  // …AND THE POSE THE PLAYER SEES MOST HAS TO READ AS STANDING. An idle is on
  // screen between every decision, so a permanent stoop is the single most
  // visible thing a bad conversion does: the import shipped one at 37 degrees.
  check('BODY: …and the idle is a person standing, not a person stooping',
    folds.idle != null && folds.idle < 32,
    JSON.stringify({ idle: folds.idle }) + '° off vertical at its worst — the'
      + ' hand-authored guards read 14 and the Build 140 import read 37');

  // …AND NOBODY HANGS IN THE AIR. The trunk angle is only half of what a
  // player calls "the rotation is off": the other half is a figure a metre off
  // the paving, floating over the plaza while the next card is being lined up.
  // `sword` did exactly that — its own root motion raised the hips 70cm, where
  // every other action in the library moves 2 to 10, and both feet went 1.03m
  // up. tools/ground.mjs rescales the UPWARD hip travel of a clip and leaves
  // the downward alone, so a crouch and a fall still work; sword came back to
  // 0.41 and the Build 140 import's swordHeavy read 0.70.
  //
  // The knock-down is exempt from this one too, for the same reason: it is
  // supposed to leave its feet.
  const floating = Object.entries(feetUp).filter(([k, v]) => k !== 'down' && v > 0.5);
  check('BODY: …and nobody hangs in the air while the fight waits for them',
    floating.length === 0,
    JSON.stringify(feetUp) + ' m — the highest the LOWER foot gets; sword was 1.03'
      + ' before tools/ground.mjs and the Build 140 import read 0.70');

  // ═══ N · EVERYBODY STANDS ON THE FLOOR ═══
  //
  // The lowest either foot gets over a clip, against the height a foot rests
  // at in the idle. Whatever a clip does, at some point in it a foot is on the
  // ground — so those two numbers are the same number, and a clip where they
  // are not is a clip the character performs while hovering.
  //
  // Measured at Build 155: idle 0.105, parry 0.105, sword 0.257, swordHeavy
  // 0.259. The sword clips never put a foot down ONCE over their whole length.
  //
  // This is the check the suite did not have, and its absence is instructive:
  // BODY above asks whether anybody sinks INTO the paving, which is the same
  // question asked in one direction only. Nobody was sinking. They were
  // fifteen centimetres in the air, for a hundred builds, in the loudest
  // animation in the game.
  const standing = await J(() => {
    const C3 = window.Cast3D, f = C3._figure('ash');
    const feet = ['LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase']
      .map(n => f.bones[n]).filter(Boolean);
    const low = (a) => {
      const dur = a.getClip().duration;
      for (const k of Object.keys(f.actions)) { f.actions[k].setEffectiveWeight(0); f.actions[k].stop(); }
      if (f.idle) f.idle.setEffectiveWeight(0);
      a.reset(); a.setEffectiveWeight(1); a.play(); a.paused = true;
      let y = Infinity;
      for (let i = 0; i < 24; i++) {
        a.time = dur * i / 23; f.mixer.update(0); f.root.updateMatrixWorld(true);
        for (const b of feet) y = Math.min(y, b.matrixWorld.elements[13]);
      }
      a.setEffectiveWeight(0); a.stop(); a.paused = false;
      return y;
    };
    const rest = low(f.idle);
    const out = {};
    for (const n of Object.keys(f.actions)) if (n !== 'idle') out[n] = +((low(n && f.actions[n]) - rest) * 100).toFixed(1);
    if (f.idle) { f.idle.reset(); f.idle.setEffectiveWeight(1); f.idle.play(); }
    return { rest: +rest.toFixed(3), hover: out, lifted: C3._figure('ash').settled || {} };
  });
  // a clip that genuinely leaves the ground still lands, so its lowest frame is
  // at rest height like everyone else's — no clip needs an exception here
  const hovering = Object.entries(standing.hover).filter(([, v]) => Math.abs(v) > 3);
  check('GROUND: every clip puts a foot on the floor at some point in it',
    hovering.length === 0,
    JSON.stringify(standing.hover) + ' cm above the idle\'s own resting foot'
      + ' — sword hovered 15cm for its whole length before `settle`; lifted: '
      + JSON.stringify(standing.lifted));

  // ═══ N · NOBODY SLIDES HOME ═══
  //
  // An Unreal attack clip carries its travel on a root bone; the importer folds
  // it into the Hips because that is the only place it can go here. So a swing
  // really does walk the body a metre or two across the floor, and for several
  // builds nothing walked it back — the slot ease dragged the figure home at
  // dt*5.5, which from 1.45m is about eight metres per second, backwards, with
  // both feet still. `homeward` gives the follow-through the job instead.
  //
  // The check is on the CLIP, not on a frame of the fight: where the hips end
  // relative to where they began. A clip that ends where it started needs no
  // drag, and no drag is the whole point. `test/slide.probe.cjs` is the fuller
  // instrument — it also reads how far a support foot gives up while it is the
  // one holding the body — and its numbers are in the comment on `homeward`.
  const rootTravel = await J(() => {
    const C3 = window.Cast3D, f = C3._figure('ash');
    const out = {};
    for (const name of Object.keys(f.actions)) {
      const t = f.actions[name].getClip().tracks.find(x => x.name === 'Hips.position');
      if (!t) continue;
      const n = t.times.length, v = t.values;
      // in rig units — hundredths of a metre — the same units the tracks carry
      out[name] = Math.round(Math.hypot(v[(n - 1) * 3] - v[0], v[(n - 1) * 3 + 2] - v[2]));
    }
    return { out, homed: C3._homed ? C3._homed() : {} };
  });
  const wander = Object.entries(rootTravel.out).filter(([, v]) => v > 15);
  check('SLIDE: every clip ends where it began, so nothing has to be dragged back',
    wander.length === 0,
    JSON.stringify(rootTravel.out) + ' — rig units, ~100 to the metre; brought home: '
      + JSON.stringify(rootTravel.homed));
  check('SLIDE: …and the clips that needed it are the ones that were walking',
    Object.keys(rootTravel.homed).length >= 4,
    JSON.stringify(rootTravel.homed) + ' — sword drifted 140 of these, swordHeavy 202');

  // ═══ N · THE ARC IS MADE OF LIGHT, NOT STUCK ON ═══
  //
  // The blade trail draws twice over one buffer: once with normal blending to
  // BEND the frame behind it, once additively for the light. The refraction
  // half is the one that can fail silently — three.js reports a shader that
  // will not compile on the console and carries on, and sampling the target it
  // is being drawn into is a feedback loop the driver answers by dropping the
  // draw. Both of those shipped for a few minutes each; both are here now.
  const arc = await J(async () => {
    const C3 = window.Cast3D, fx = C3._fx(), f = C3._figure('ash');
    const r = fx.ribbonFor('ash');
    const a = f.actions.sword; if (!a) return { err: 'no sword clip' };
    for (const k of Object.keys(f.actions)) { f.actions[k].setEffectiveWeight(0); f.actions[k].stop(); }
    if (f.idle) f.idle.setEffectiveWeight(0);
    a.reset(); a.setEffectiveWeight(1); a.play(); a.paused = true;
    f.acting = a; f.holdFrac = 0; f.fxVerb = 'slash';
    r.clear();
    const dur = a.getClip().duration;
    for (let i = 0; i < 20; i++) {
      a.time = dur * (0.10 + 0.32 * (i / 19));
      f.mixer.update(0); f.root.updateMatrixWorld(true);
      fx.trail('ash', f, 1 / 60);
    }
    r.fade = 1; r.step(0);
    const p = r.geo.attributes.position.array;
    let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    for (let i = 0; i < p.length; i += 3)
      for (let c = 0; c < 3; c++) { lo[c] = Math.min(lo[c], p[i + c]); hi[c] = Math.max(hi[c], p[i + c]); }
    return { filled: r.filled, light: r.mesh.visible, air: r.air.visible,
             behind: !!r.refMat.uniforms.uScene.value,
             span: +Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]).toFixed(2),
             order: [r.air.renderOrder, r.mesh.renderOrder] };
  });
  check('ARC: a swing draws both halves of the trail — the air it bends and the light it throws',
    !arc.err && arc.light === true && arc.air === true && arc.filled >= 20,
    JSON.stringify(arc));
  // ── AND IT IS A CURVE, NOT A CHAIN OF SAMPLES ───────────────────────────
  //
  // "Jaggedy" is a corner, and a corner is a turn between two consecutive
  // segments of the strip — so walk the tip's own edge and take the angle at
  // every joint. One sample per frame and one quad per sample turned hard at
  // every joint, and the faster the blade moved the worse it got, which is to
  // say it was jaggiest exactly when it was most looked at.
  //
  // The control is in the same frame rather than in a second run: `worstRaw`
  // walks only the control points, which IS the strip the old geometry drew.
  // A spline has to turn less at its worst joint than the polygon it was drawn
  // to smooth — and the first attempt did not. Uniform Catmull-Rom assumes
  // evenly spaced points, a blade's are anything but, and it overshot to 64°
  // against the chain's 52°. Centripetal spacing is the member of the family
  // that provably cannot overshoot; it reads 44° against 48°.
  const arcTurn = await J(() => {
    const r = window.Cast3D._fx().ribbons.ash;
    const p = r.geo.attributes.position.array, N = p.length / 6;
    const tip = (i) => [p[i * 6 + 3], p[i * 6 + 4], p[i * 6 + 5]];
    const walk = (stride) => {
      const out = [];
      for (let i = stride; i < N - stride; i += stride) {
        const a = tip(i - stride), b = tip(i), c = tip(i + stride);
        const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
        const w = [c[0] - b[0], c[1] - b[1], c[2] - b[2]];
        const lu = Math.hypot(u[0], u[1], u[2]), lw = Math.hypot(w[0], w[1], w[2]);
        if (lu < 1e-6 || lw < 1e-6) continue;
        const d = (u[0] * w[0] + u[1] * w[1] + u[2] * w[2]) / (lu * lw);
        out.push(Math.acos(Math.max(-1, Math.min(1, d))) * 180 / Math.PI);
      }
      return out.sort((x, y) => y - x);
    };
    const fine = walk(1), raw = walk(5);
    return { verts: N, worst: +(fine[0] || 0).toFixed(1),
             p95: +(fine[Math.floor(fine.length * 0.05)] || 0).toFixed(1),
             worstRaw: +(raw[0] || 0).toFixed(1) };
  });
  check('ARC: the strip is a curve through the samples, and turns less than they do',
    arcTurn.verts > 100 && arcTurn.worst > 0 && arcTurn.worst < arcTurn.worstRaw
    && arcTurn.p95 < 20,
    JSON.stringify(arcTurn) + ' — degrees per joint; uniform Catmull-Rom overshot'
      + ' to 64 against the chain\'s 52 before centripetal spacing');

  check('ARC: the refraction pass has a frame of world to bend, and is not reading its own',
    !arc.err && arc.behind === true && arc.order[0] < arc.order[1],
    JSON.stringify(arc) + ' — the world alternates between two targets; sampling'
      + ' the bound one is a feedback loop and the driver drops the draw');

  // ═══ N · THE DRAWN LOOK ═══
  //
  // The post pass exists to make a rendered scene read as a painted one, and
  // the only part of it that can be wrong in an interesting way is the contour:
  // it either finds the places where two surfaces meet, or it smears.
  //
  // MEASURING IT TOOK THREE WRONG INSTRUMENTS, so this uses none of them.
  // Diffing an inked frame against the pass switched OFF carries the whole
  // render-target round trip in the difference and reads 98% at every threshold
  // — the ink is invisible underneath it. Diffing against the pass switched on
  // with the line at zero is better but still a difference of two frames, and
  // the frames move. What answers the question outright is the shader's own
  // debug view, which outputs the contour mask alone: no second frame, no
  // differencing, nothing for a colour space to spoil.
  //
  // And a single percentage is not enough. A detector that inks 2% of
  // EVERYTHING uniformly is exactly as broken as one that inks 64%, only
  // quieter. What a drawn line looks like is a few per cent of the frame,
  // several times denser inside the figures than over the plaza behind them.
  // ── IS THE CAST ACTUALLY ON SCREEN ──────────────────────────────────────
  //
  // A one-word GLSL collision — a float t the watercolour block twelve lines
  // down already owned — left the figure program invalid, and this browser
  // reports that as a WebGL warning and nothing else: no exception, no console
  // error, nothing thrown. The plaza rendered, the weapons rendered because
  // they are their own meshes, and the party was gone.
  //
  // THE SUITE DOES CATCH IT, and it is worth being exact about that rather
  // than claiming a blind spot it does not have. Run against the broken
  // shader, four checks go red: BURN counts no pixels, and GUARD, ARMS and
  // GROUND all read nonsense because a figure's scale is measured off its
  // rendered silhouette, so nothing drawn means nothing measured. What none of
  // them says is WHY. A reviewer handed "a sword is 1.79m" and "the lowest
  // joint is -0.30" has four unrelated geometry faults to chase and no reason
  // to suspect the fragment shader.
  //
  // So this one names it. It is answered by the material itself — a colour
  // nothing else in the world draws, emitted by the very shader whose
  // compilation is in doubt — and it sits first, because if it is red the
  // other four are its symptoms and not four more bugs.
  console.log('\n── the cast is on screen ──');
  const drawn = await J(async () => {
    const C3 = window.Cast3D;
    const was = C3.look();
    C3.look({ pl: -2 });
    await new Promise(r => requestAnimationFrame(r));
    await new Promise(r => requestAnimationFrame(r));
    await C3._snapshot();
    const c = window.__castShot, w = c.width, h = c.height;
    const d = c.getContext('2d').getImageData(0, 0, w, h).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4)
      if (d[i] > 140 && d[i + 1] < 100 && d[i + 2] > 140) n++;
    C3.look(was);
    return { px: n, pct: +(100 * n / (w * h)).toFixed(2) };
  });
  check('CAST: the figures are actually drawn — the shader ran and wrote pixels',
    drawn.px > 500,
    JSON.stringify(drawn) + ' — the figure material emitting a colour nothing else '
      + 'draws; an invalid program leaves this at 0 and throws nothing');

  // ── THE LENS: THE CITY GOES SOFT AND THE PARTY DOES NOT ─────────────────
  //
  // Half of this is trivially satisfiable and the other half is the effect. A
  // blur that softens the whole frame would pass any "is the background
  // blurrier" reading, so both are measured on one frame and the one that
  // must NOT move is the subject.
  //
  // AND IT IS MEASURED THROUGH THE FIGURES' OWN MASK, not their boxes. A
  // hero's box is mostly plaza, and plaza is exactly what this softens — read
  // over boxes the party's sharpness fell 22% and read as a focus fault, when
  // the circle of confusion on the figures themselves is 0.04 against 0.44
  // everywhere else. The rectangle averaged a success together with a
  // requirement and reported the mean as a failure.
  // ── WARM LIGHT AGAINST COOL SHADOW, AND NOT A BLUE CAST ─────────────────
  //
  // The painted light shipped tinting the whole picture blue. Two things did
  // it: the terminator sat on the MEDIAN of the lighting, so half of every
  // body counted as shadow and took the cool, and the counter-light was a
  // saturated blue added on top of that. What was wanted is a disagreement
  // between the two halves; what shipped was agreement at a bluer value.
  //
  // So the property is the SIGN of the split, not the amount of colour: the
  // lit half must run warm and the shadow half must run cooler than it. A
  // cast fails this however pretty it is, because both halves move together.
  //
  // AND THE TWO HALVES ARE SPLIT BY THE SHADER'S OWN LIGHTING TERM, not by
  // how bright the pixels came out. Elin is bone-white and Mira is violet
  // under black, so her shadow is brighter than Mira's key — grouping by
  // luminance groups by ALBEDO, put a mixture in both buckets, and reported
  // the split inverted, which cost two tuning passes in the wrong direction.
  console.log('\n── warm against cool ──');
  const hue = await J(async () => {
    const C3 = window.Cast3D;
    const was = C3.look();
    const grab = async () => {
      await new Promise(r => requestAnimationFrame(r));
      await new Promise(r => requestAnimationFrame(r));
      await C3._snapshot();
      const c = window.__castShot;
      return { w: c.width, h: c.height,
               d: c.getContext('2d').getImageData(0, 0, c.width, c.height).data };
    };
    const dec = (v) => v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    C3.look({ pl: -2 });
    const mk = await grab();
    C3.look({ pl: -1 });
    const li = await grab();
    C3.look(was);
    const px = await grab();
    let dn = 0, ds = 0, ln = 0, ls = 0;
    for (let i = 0, j = 0; i < mk.d.length; i += 4, j++) {
      if (!(mk.d[i] > 140 && mk.d[i + 1] < 100 && mk.d[i + 2] > 140)) continue;
      const lv = dec(li.d[i] / 255) * 4.0;
      const bmr = (px.d[i + 2] - px.d[i]) / 255;
      if (lv > was.term) { ls += bmr; ln++; } else { ds += bmr; dn++; }
    }
    return { lit: +(ls / Math.max(1, ln)).toFixed(4), shadow: +(ds / Math.max(1, dn)).toFixed(4),
             litN: ln, shadowN: dn };
  });
  check('HUE: the light runs warm and the shadow runs cool — a split, not a cast',
    hue.litN > 500 && hue.shadowN > 500 && hue.lit < 0 && hue.shadow > hue.lit,
    JSON.stringify(hue) + ' — blue minus red, on figure pixels, grouped by the '
      + 'shader own lighting term; a blue cast moves both together and fails');

  console.log('\n── the lens ──');
  const glass = await J(async () => {
    const C3 = window.Cast3D;
    const was = C3.look();
    const grab = async () => {
      await new Promise(r => requestAnimationFrame(r));
      await new Promise(r => requestAnimationFrame(r));
      await C3._snapshot();
      const c = window.__castShot;
      return { w: c.width, h: c.height,
               d: c.getContext('2d').getImageData(0, 0, c.width, c.height).data };
    };
    C3.look({ pl: -2 });
    const mk = await grab();
    const fig = new Uint8Array(mk.w * mk.h);
    let figN = 0;
    for (let i = 0, j = 0; i < mk.d.length; i += 4, j++)
      if (mk.d[i] > 140 && mk.d[i + 1] < 100 && mk.d[i + 2] > 140) { fig[j] = 1; figN++; }
    C3.look(was);
    // ── AND THE PLAZA BAND IS NOT THE SKY (Build 209) ──────────────────────
    //
    // "How much detail did the far third lose" was averaged over EVERY
    // non-figure pixel in the top third, and most of that band is sky and
    // mist, which has no detail to lose. A blur of nothing over nothing is a
    // ratio of one, so the reading was a weighted average of the architecture
    // (which the lens genuinely softens) and a large flat area pulling it
    // toward 1 — and how much of each was in frame depended on where the
    // camera happened to be standing.
    //
    // Measured across boots: 0.67, 0.74, 0.77, 0.86, 0.88, against a gate of
    // 0.75. That is not a lens changing, it is a shot changing; the same check
    // passed and failed on consecutive runs of an unchanged build. Confirmed
    // separately that Build 209 own dials do not move it — off 0.862/0.872,
    // on 0.884/0.864, interleaved.
    //
    // So the band is now the quarter of the far third that actually CARRIES
    // detail, chosen on the sharp frame and reused for the blurred one — the
    // same pixels compared to themselves. No threshold is written down: it is
    // that frame's own 75th percentile.
    const sharp = async (pm) => {
      const g = await grab(), w = g.w, h = g.h, d = g.d;
      const L = new Float32Array(w * h);
      for (let i = 0, j = 0; i < d.length; i += 4, j++)
        L[j] = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / 255;
      const lapAt = (i) =>
        Math.abs(4 * L[i] - L[i - 1] - L[i + 1] - L[i - w] - L[i + w]);
      let mask = pm, cut = 0;
      if (!mask) {
        const far = [];
        for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
          const i = y * w + x;
          if (!fig[i] && y < h / 3) far.push(lapAt(i));
        }
        far.sort((a, z) => a - z);
        cut = far.length ? far[Math.floor(far.length * 0.75)] : 0;
        mask = new Uint8Array(w * h);
        for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
          const i = y * w + x;
          if (!fig[i] && y < h / 3 && lapAt(i) >= cut) mask[i] = 1;
        }
      }
      let ps = 0, pn = 0, fs = 0, fn = 0, hi = [];
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const lap = lapAt(i);
        hi.push(L[i]);
        if (fig[i]) { ps += lap; pn++; }
        else if (mask[i]) { fs += lap; fn++; }
      }
      hi.sort((a, z) => a - z);
      let msum = 0;
      for (let j = 0; j < L.length; j++) msum += L[j];
      return { party: ps / Math.max(1, pn), plaza: fs / Math.max(1, fn),
               p99: hi[Math.floor(hi.length * 0.99)], pm: mask, cut: +cut.toFixed(4),
               mean: msum / Math.max(1, L.length), farN: fn };
    };
    // ── AND THE COMPARISON FRAME HAS TO GO THROUGH THE PASS (Build 191) ──
    //
    // This used to take ONE off-frame at {dof: 0, bloom: 0} and compare
    // everything against it. That worked only by accident: `inkWanted()` keeps
    // the post pass alive when the contour is on, and the contour was on, so
    // both frames were composited. Build 191 removed the contour and the same
    // off-frame started skipping the pass altogether — so the glow ratio was
    // measuring whether the pass RAN, not what the bloom does, and it came
    // back 0.836 for a bloom that had not changed at all.
    //
    // Two off-frames now, each turning off only the thing it is about and
    // leaving the other on, so the pass composites in every frame compared.
    C3.look({ dof: 0 });
    // the detail band is chosen HERE, on the sharp frame, and handed to the
    // blurred one — otherwise each frame picks its own quarter and the two
    // numbers are not measured over the same city
    const offLens = await sharp();
    C3.look(was);
    C3.look({ bloom: 0 });
    const offGlow = await sharp(offLens.pm);
    C3.look(was);
    const on = await sharp(offLens.pm);
    // ══ AND THE GLOW IS READ OFF THE GLOW BUFFER (Build 211) ═══════════════
    //
    // `on.p99 / offGlow.p99` was the old measurement and it does not work. Run
    // six times against SETTINGS THAT DID NOT CHANGE, it returns 0.978, 0.9767,
    // 1.0031, 1.0163, 1.0085 and 0.9987 — noise of about 0.04 against a gate of
    // 1.005. The currently shipped dials read 0.9901 on one frame and 1.02 on
    // the next, so this check has been reporting which frame the run stopped on
    // and passing since Build 191 on luck.
    //
    // The frame's 99th percentile is the wrong estimator: it is dominated by
    // pixels that are already at the top of the range, where an additive bloom
    // has nothing left to add.
    //
    // `bloom: -1` outputs tGlow ALONE — the layer has supported it since the
    // dial was written and the dial's own note tells the reader to use it. That
    // is the light going into the air, with no estimator in between, and it
    // repeats: 2.25 / 2.24 at the old floor, 0.18 / 0.18 at 0.55, 0.04 / 0.03
    // at 0.70, monotonic the whole way.
    C3.look(was);
    C3.look({ bloom: -1 });
    const air = await sharp(offLens.pm);
    C3.look(was);
    return {
      figN,
      party: +(on.party / Math.max(1e-6, offLens.party)).toFixed(2),
      plaza: +(on.plaza / Math.max(1e-6, offLens.plaza)).toFixed(2),
      glow:  +(on.p99 / Math.max(1e-6, offGlow.p99)).toFixed(3),
      air:   +(air.mean * 1000).toFixed(2),
      fog:   +((on.mean - offGlow.mean) * 1000).toFixed(2),
      farN: offLens.farN, cut: offLens.cut,
      onByDefault: was.dof > 0.002,
    };
  });
  check('LENS: the city falls out of focus behind the fight',
    glass.figN > 500 && glass.plaza < 0.75,
    JSON.stringify(glass) + ' — sharpness with the lens over sharpness without, '
      + 'as a ratio; the far plaza has to lose a quarter of its detail');
  check('LENS: …and the party it is focused on stays sharp',
    glass.figN > 500 && glass.party > 0.9,
    JSON.stringify(glass) + ' — measured through the figures own mask; over their '
      + 'boxes this reads 0.78 and the boxes are mostly plaza');
  // BOTH HALVES OF THE OLD SENTENCE, EACH ON AN INSTRUMENT THAT CAN SEE IT.
  // `air` is the glow buffer's own mean, so "light gets into the air" is read
  // where the light actually is; `fog` is what the composite adds to the frame
  // MEAN, which is the half the old check named and never measured. At the
  // reported dials the fog was real and running at 1.5.
  check('LENS: light gets into the air',
    glass.air > 0.008,
    JSON.stringify(glass) + ' — the mean of the glow buffer alone, x1000, via '
      + 'bloom:-1. The old measurement was the frame p99 with bloom over without, '
      + 'which returned 0.978 to 1.016 across six runs of UNCHANGED settings — '
      + 'noise of 0.04 against a gate of 1.005');
  check('LENS: …without fogging the picture',
    Math.abs(glass.fog) < 0.6,
    JSON.stringify(glass) + ' — what the bloom adds to the whole frame mean, '
      + 'x1000. A bloom that lifts the picture is a haze, not a highlight: at '
      + 'the floor this shipped with it read 1.5 to 1.7, and from 0.42 up it is '
      + 'zero to within noise');

  // ── ONE BAD PIXEL MUST NOT BECOME A BLOCK ─────────────────────────────────
  //
  // Build 192 put black squares on the phone: hard-edged, axis-aligned, 56
  // device pixels on a side, sitting on the figures and flashing. They were
  // read three ways before they were read right — a GPU tile, a DOM element,
  // the tangent frame — and none of those survived the measurements. What
  // fitted every one of them is that a SINGLE fragment went NaN and the bloom
  // chain grew it: the cut halves, nine gaussian taps reach four texels, the
  // cut halves again, nine more reach four more, and fourteen quarter-res
  // texels is fifty-six device pixels. That is not an estimate that happens to
  // be close, it is the number the flood fill measured off the screenshot.
  //
  // So this does not check the shading, and it does not check that the shader
  // text contains a guard, which would be a check on itself. It hands the
  // renderer the fault — one poisoned pixel per 97-square lattice cell, from a
  // dial that is zero in every shipped frame — and asks whether the picture
  // that comes back has a block in it. A dead uniform, a folded-away guard or
  // a chain that grows the fault some other way all fail this the same way.
  console.log('\n── one bad pixel ──');
  const nan = await J(async () => {
    const C3 = window.Cast3D;
    const was = C3.look();
    const grab = async () => {
      await new Promise(r => requestAnimationFrame(r));
      await new Promise(r => requestAnimationFrame(r));
      await C3._snapshot();
      const c = window.__castShot;
      return { w: c.width, h: c.height,
               d: c.getContext('2d').getImageData(0, 0, c.width, c.height).data };
    };
    // THE BLOCK IS BLACK OR IT IS WHITE, and which one is not this check's
    // business. A NaN written to eight bits comes out 0; an Inf comes out 255.
    // Both are the same fault and both are equally unshippable.
    const blocks = (f, step) => {
      let n = 0;
      for (let y = 8; y < f.h - 24; y += step) {
        for (let x = 8; x < f.w - 24; x += step) {
          let lo = 0, hi = 0;
          for (let j = 0; j < 24; j += 3) for (let i = 0; i < 24; i += 3) {
            const k = ((y + j) * f.w + (x + i)) * 4;
            const m = Math.max(f.d[k], f.d[k + 1], f.d[k + 2]);
            if (m <= 2) lo++; else if (m >= 253) hi++;
          }
          if (lo === 64 || hi === 64) n++;
        }
      }
      return n;
    };
    C3.look({ nan: 0 });
    const clean = await grab();
    C3.look({ nan: 1 });
    const hurt = await grab();
    C3.look(was);
    C3.look({ nan: 0 });
    return { dial: 'nan' in was, w: hurt.w, h: hurt.h,
             clean: blocks(clean, 12), poisoned: blocks(hurt, 12) };
  });
  // ── THE TONE OF THE CAST, AGAINST THE ART SHEET ──────────────────────────
  //
  // Measured over the figures' own pixels — the mask is taken at pl:-2, which
  // paints them flat magenta BEFORE any lighting, so it does not move when the
  // thing being measured does. Against the target sheet, in sRGB:
  //
  //                p25    p50    >0.60   band mean   band std   at 1.0   <0.10
  //     the art   0.172  0.343   32.3%     0.823       0.118      0.0%    8.4%
  //     shipped   0.176  0.309   12.7%     0.822       0.137      0.9%    5.2%
  //
  // Two properties, and they pull against each other, which is why they are
  // two checks. A body has to have a lit side AND a shadow side — the picture
  // before this had neither, every figure inside one 0.17-wide grey band. And
  // the lit side has to still be DRAWN: a gain that reaches the same
  // percentiles by clipping everything above the terminator scores identically
  // on the first check and turns a bone-white robe into a silhouette, which is
  // exactly what the first tuning pass shipped into a screenshot before the
  // instrument could see it.
  console.log('\n── the tone of the cast ──');
  const tone = await J(async () => {
    const C3 = window.Cast3D;
    const was = C3.look();
    const grab = async () => {
      await new Promise(r => requestAnimationFrame(r));
      await new Promise(r => requestAnimationFrame(r));
      await C3._snapshot();
      const c = window.__castShot;
      return { w: c.width, h: c.height,
               d: c.getContext('2d').getImageData(0, 0, c.width, c.height).data };
    };
    C3.look({ pl: -2 });
    const mk = await grab();
    const fig = new Uint8Array(mk.w * mk.h);
    let figN = 0;
    for (let i = 0, j = 0; i < mk.d.length; i += 4, j++)
      if (mk.d[i] > 140 && mk.d[i + 1] < 100 && mk.d[i + 2] > 140) { fig[j] = 1; figN++; }
    C3.look(was);
    const g = await grab();
    const L = [];
    for (let i = 0, j = 0; i < g.d.length; i += 4, j++) {
      if (!fig[j]) continue;
      L.push((0.2126 * g.d[i] + 0.7152 * g.d[i + 1] + 0.0722 * g.d[i + 2]) / 255);
    }
    L.sort((a, z) => a - z);
    const pct = (f) => +(L.filter(f).length / Math.max(1, L.length) * 100).toFixed(1);
    const band = L.filter(v => v > 0.60);
    const bm = band.length ? band.reduce((a, z) => a + z, 0) / band.length : 0;
    const bs = band.length
      ? Math.sqrt(band.reduce((a, z) => a + (z - bm) * (z - bm), 0) / band.length) : 0;
    return { figN,
      p25: +L[Math.floor(L.length * 0.25)].toFixed(3),
      p50: +L[Math.floor(L.length * 0.50)].toFixed(3),
      hi60: pct(v => v > 0.60), lo10: pct(v => v < 0.10),
      bandMean: +bm.toFixed(3), bandStd: +bs.toFixed(3), clip: pct(v => v >= 0.999),
      expo: was.expo };
  });
  // ── WHERE THE FLOOR GOES, AND WHY IT IS NOT JUST UNDER THE READING ──────
  //
  // This was gated at 4 against the expo 5 picture, and at expo 3 the suite's
  // own frame came back 4.2 — a pass with five percent of headroom, which is a
  // gate measuring which shot the run stopped on rather than whether the cast
  // has a lit side. Placed on the two populations instead:
  //
  //     the fault  (no cast exposure)   0.3% – 0.7%   across cameras
  //     shipped    (expo 3)             4.2% – 8.4%   across cameras
  //
  // Two is three times the worst of the fault and half the best of the ship,
  // which separates them with room on both sides. That is what a floor is for.
  // It is deliberately NOT moved to sit just under 4.2.
  check('TONE: a body has a lit side and a shadow side, not one grey band',
    tone.figN > 500 && tone.hi60 > 2 && tone.lo10 > 2,
    JSON.stringify(tone) + ' — over the figures own pixels in sRGB; the art sheet '
      + 'reads 32.3% over 0.60 and 8.4% under 0.10, and this picture had 0.7% and 6.8% '
      + 'before the cast got an exposure of its own');
  // ── AND EACH BODY AT ITS OWN VALUE, NOT THE PARTY'S AVERAGE ─────────────
  //
  // The party average is what hid the fault twice. Measured per body against
  // the art sheet's own medians, in sRGB, two of the three were already exactly
  // right and the third was nowhere near — and every global dial that moved her
  // moved them off a mark they were already on:
  //
  //                before   after    the art
  //     mira        0.187   0.187     0.192
  //     ash         0.278   0.278     0.273
  //     elin        0.403   0.582     0.581
  //
  // So this reads them one at a time. The tolerance is wide because a fight
  // frames the party differently shot to shot; what it is guarding is a body
  // being lit as though it were one of the others, which is a tenth of the
  // scale away, not a hundredth.
  // All three are the sheet's own numbers again. Build 202 had to hold Mira to
  // the value she was shipped at, because the black point cost her 0.028 of
  // median; Build 203's per-body exposure bought most of it back — 0.216 — so
  // the target can be the art's again.
  const ART_MED = { elin: 0.581, ash: 0.273, mira: 0.192 };
  const bodies = await J(async (art) => {
    const C3 = window.Cast3D, was = C3.look();
    const grab = async () => {
      await new Promise(z => requestAnimationFrame(z));
      await new Promise(z => requestAnimationFrame(z));
      await C3._snapshot();
      const c = window.__castShot;
      return { w: c.width, h: c.height,
               d: c.getContext('2d').getImageData(0, 0, c.width, c.height).data };
    };
    C3.look({ pl: -2 });
    const mk = await grab();
    const fig = new Uint8Array(mk.w * mk.h);
    for (let i = 0, j = 0; i < mk.d.length; i += 4, j++)
      if (mk.d[i] > 140 && mk.d[i + 1] < 100 && mk.d[i + 2] > 140) fig[j] = 1;
    C3.look(was);
    const g = await grab();
    const cr = document.getElementById('k-cast3d').getBoundingClientRect();
    const out = {};
    for (const id of Object.keys(art)) {
      const el = document.querySelector('.k-hero[data-hero="' + id + '"]');
      if (!el) continue;
      const b = el.getBoundingClientRect();
      const x0 = Math.round((b.left - cr.left) / cr.width * mk.w);
      const y0 = Math.round((b.top - cr.top) / cr.height * mk.h);
      const x1 = Math.round((b.right - cr.left) / cr.width * mk.w);
      const y1 = Math.round((b.bottom - cr.top) / cr.height * mk.h);
      const q = [];
      for (let y = Math.max(0, y0); y < Math.min(mk.h, y1); y++)
        for (let x = Math.max(0, x0); x < Math.min(mk.w, x1); x++) {
          const j = y * mk.w + x;
          if (fig[j]) q.push((0.2126 * g.d[j * 4] + 0.7152 * g.d[j * 4 + 1]
                            + 0.0722 * g.d[j * 4 + 2]) / 255);
        }
      if (q.length < 200) { out[id] = { n: q.length }; continue; }
      q.sort((a, z) => a - z);
      out[id] = { n: q.length, med: +q[(q.length * 0.5) | 0].toFixed(3),
                  want: art[id],
                  off: +Math.abs(q[(q.length * 0.5) | 0] - art[id]).toFixed(3),
                  lo10: +(100 * q.filter(v => v < 0.10).length / q.length).toFixed(1),
                  clip: +(100 * q.filter(v => v >= 0.999).length / q.length).toFixed(2) };
    }
    return out;
  }, ART_MED);
  const litBodies = Object.keys(bodies).filter(k => bodies[k].med != null);
  check('TONE: each body sits at its own value, not the party average',
    litBodies.length === 3
      && litBodies.every(k => bodies[k].off <= 0.09 && bodies[k].clip < 2),
    JSON.stringify(bodies) + ' — each hero median in sRGB against the art sheet, '
      + 'over that hero own masked pixels. Elin shipped at 0.403 against a 0.581 '
      + 'target while Mira and Ash were already exact, and the party average read '
      + 'healthy throughout — which is why this is measured one body at a time');

  // A BLACK POINT IS THE ONE THING A GAMMA CAN UNDO, and the two of them are
  // one line apart in the shader. At black 0.006 with a curve of 1.1 Mira
  // measured 0% under 0.10 again — the fault this guards is not a dial being
  // wrong, it is a later build pairing them without knowing they cancel.
  check('TONE: …and the darkest body actually reaches black',
    bodies.mira && bodies.mira.lo10 != null && bodies.mira.lo10 > 4,
    JSON.stringify(bodies.mira) + ' — Mira under 0.10, against the art sheet 13%. '
      + 'She shipped at 0.1% — lit almost entirely by ambient, one value from '
      + 'hood to boot. A gamma cannot give her this and will silently take it '
      + 'away again: paired with a curve of 1.1 the same black point reads 0%');

  // ══ AND THE SURFACE ANSWERS THE LIGHT (Build 209) ═══════════════════════
  //
  // These models carry ONE albedo each — no normal map, no roughness map, no
  // metalness map — and the material is built at metalness 0, so its F0 is 4%
  // and no roughness setting can make it catch a highlight. That is the last
  // structural gap against the art sheet and it is per body:
  //
  //                       over 0.85      the art sheet
  //     elin                12.9%           ~10.6%
  //     ash                  5.6%           ~10.6%
  //     mira                 1.6%           ~10.6%
  //
  // Elin was already there. Mira had essentially no highlights at all, because
  // she is a dark albedo lit almost entirely by ambient.
  //
  // THIS IS AN A/B OF THE DIAL, NOT A READING OF A FRAME. Every absolute
  // number in this file has at some point measured which shot the run stopped
  // on; a toggle cannot, because both halves are the same shot. Take the dial
  // out of the shader and the two halves come back identical and this fails,
  // which is the only thing a check on a look is worth.
  const surf = await J(async () => {
    const C3 = window.Cast3D, was = C3.look();
    const grab = async () => {
      await new Promise(z => requestAnimationFrame(z));
      await new Promise(z => requestAnimationFrame(z));
      await C3._snapshot();
      const c = window.__castShot;
      return { w: c.width, h: c.height,
               d: c.getContext('2d').getImageData(0, 0, c.width, c.height).data };
    };
    C3.look({ pl: -2 });
    const mk = await grab();
    const fig = new Uint8Array(mk.w * mk.h);
    for (let i = 0, j = 0; i < mk.d.length; i += 4, j++)
      if (mk.d[i] > 140 && mk.d[i + 1] < 100 && mk.d[i + 2] > 140) fig[j] = 1;
    C3.look(was);
    const cr = document.getElementById('k-cast3d').getBoundingClientRect();
    const el = document.querySelector('.k-hero[data-hero="mira"]');
    const b = el.getBoundingClientRect();
    const x0 = Math.round((b.left - cr.left) / cr.width * mk.w);
    const y0 = Math.round((b.top - cr.top) / cr.height * mk.h);
    const x1 = Math.round((b.right - cr.left) / cr.width * mk.w);
    const y1 = Math.round((b.bottom - cr.top) / cr.height * mk.h);
    const lum = (g, j) => (0.2126 * g.d[j * 4] + 0.7152 * g.d[j * 4 + 1]
                         + 0.0722 * g.d[j * 4 + 2]) / 255;
    const read = async (set) => {
      C3.look(was); C3.look(set);
      const g = await grab();
      const q = [];
      // ── AND THE OTHER READING IS LOCAL CONTRAST, NOT BRIGHTNESS ─────────
      //
      // A cavity darkens a crease and leaves the ridge beside it alone. That
      // is a REDISTRIBUTION: it nets out to almost nothing in a mean, and the
      // first cut of this check learned that the expensive way — the mean
      // moved 0.0009 against a frame-to-frame drift of 0.0024, so the dial
      // was below the noise of the instrument pointed at it. The quantity a
      // cavity actually changes is how much a pixel differs from the ones
      // touching it, which is exactly what a Laplacian is.
      let e = 0, en = 0;
      for (let y = Math.max(1, y0); y < Math.min(mk.h - 1, y1); y++)
        for (let x = Math.max(1, x0); x < Math.min(mk.w - 1, x1); x++) {
          const j = y * mk.w + x;
          if (!fig[j]) continue;
          q.push(lum(g, j));
          // only where the whole cross is on the body, so the silhouette's own
          // step against the plaza is never counted as surface detail
          if (!(fig[j - 1] && fig[j + 1] && fig[j - mk.w] && fig[j + mk.w])) continue;
          e += Math.abs(4 * lum(g, j) - lum(g, j - 1) - lum(g, j + 1)
                        - lum(g, j - mk.w) - lum(g, j + mk.w));
          en++;
        }
      const mean = q.reduce((a, z) => a + z, 0) / Math.max(1, q.length);
      return { n: q.length,
               hi85: +(100 * q.filter(v => v > 0.85).length / Math.max(1, q.length)).toFixed(2),
               clip: +(100 * q.filter(v => v >= 0.999).length / Math.max(1, q.length)).toFixed(2),
               mean: +mean.toFixed(4),
               edge: +(e / Math.max(1, en)).toFixed(5) };
    };
    // ── AND THE BASELINE IS READ TWICE, WHICH IS THE WHOLE POINT ──────────
    //
    // "The same frame" is a lie by about a fifth of a second: the bodies are
    // breathing between reads, and headless draws at roughly 1.5fps. So the
    // baseline is taken at both ends and the gap between those two IS the
    // noise floor, measured in this run rather than assumed. A dial has to
    // beat the drift it is being compared against, and the first cut of the
    // cavity gate passed by 0.0009 of mean — a third of a per cent — which is
    // a gate on which frame the run happened to stop on.
    //
    // `was` carries whatever the dials actually ship at, so this measures the
    // shipped setting rather than a number written into the check.
    C3.slow(0.05);
    const off  = await read({ gloss: 0, cav: 0 });
    const lit  = await read({ gloss: was.gloss, cav: 0 });
    const cave = await read({ gloss: 0, cav: was.cav });
    const off2 = await read({ gloss: 0, cav: 0 });
    C3.look(was); C3.slow(1);
    const base = (off.mean + off2.mean) / 2;
    const baseE = (off.edge + off2.edge) / 2;
    return { off, lit, cave, off2,
             base: +base.toFixed(4),
             drift: +Math.abs(off2.mean - off.mean).toFixed(4),
             baseEdge: +baseE.toFixed(5),
             edgeDrift: +Math.abs(off2.edge - off.edge).toFixed(5),
             dial: { gloss: was.gloss, cav: was.cav } };
  });
  const baseHi = (surf.off.hi85 + surf.off2.hi85) / 2;
  check('SURFACE: the darkest body catches a highlight, and it costs it no more than it buys',
    surf.off.n > 400 && surf.lit.hi85 >= baseHi * 1.5 && surf.lit.clip < 2.5,
    JSON.stringify(surf) + ' — Mira over 0.85, the same frame with the highlight '
      + 'off and on. Her albedo is dark and the key barely reaches her, so at '
      + 'metalness 0 she shipped with 1.6% of her over 0.85 against the art '
      + 'sheet 10.6%. The cost is measured and it is real — a specular on a '
      + 'dark material converts some of its blacks, 10.7% to 9.4% — which is '
      + 'why the ceiling here is the clip and not the gain');
  // ── AND THE CAVITY IS NOT GATED ON WORKING, BECAUSE THIS FRAME CANNOT SEE IT
  //
  // Three instruments were pointed at it and all three came back inside the
  // noise, measured against a baseline read at BOTH ends of the same run:
  //
  //     percentiles at 0.10 / 0.60 / 0.85    no movement outside noise
  //     mean over the body                   0.0009 against a drift of 0.0024
  //     local contrast over the body         under a drift of 0.0082, and the
  //                                          two baselines were falling anyway
  //
  // The same reading catches the HIGHLIGHT easily in the same run — local
  // contrast 0.3583 and 0.3502 at the ends, 0.3698 with the gloss on — so the
  // instrument is not blunt. What it cannot see is a three-texel radius on a
  // 2048 map at this frame's scale: the harness renders at dpr 1 with MSAA off,
  // so the entire cavity signal lands under a screen pixel and is averaged away
  // before it is read. At dpr 2, side by side, it is the difference between
  // Elin's robe as a soft white mass and Elin's robe with folds in it.
  //
  // Build 208 wrote down the rule this follows: a gate on a measurement that
  // cannot resolve the thing is worse than no gate, because one day it fails
  // for a reason that has nothing to do with the dial. So the claim that the
  // cavity WORKS is not gated here. What is gated is the way it could go wrong
  // without anyone noticing — quietly becoming a brightness control — which
  // this frame resolves perfectly well.
  check('SURFACE: …and the cavity stays a redistribution, not a brightness control',
    Math.abs(surf.base - surf.cave.mean) < surf.base * 0.03,
    JSON.stringify({ base: surf.base, cav: surf.cave.mean,
                     ends: [surf.off.mean, surf.off2.mean],
                     edge: { base: surf.baseEdge, cav: surf.cave.edge,
                             lit: surf.lit.edge, drift: surf.edgeDrift },
                     dial: surf.dial })
      + ' — mean over Mira own pixels, cavity off at both ends of the run and '
      + 'on in the middle. A cavity darkens a crease and leaves the ridge beside '
      + 'it, so the mean must barely move; a dial that walked the whole body '
      + 'down would be an exposure wearing a different name, and nothing else '
      + 'in this suite would catch it');

  // ══ AND A BODY IS A LIT SURFACE, NOT A LAMP (Build 211) ════════════════
  //
  // `glowT` is a threshold in LINEAR light applied to the WHOLE frame; `expo`
  // multiplies the CAST and nothing else. The two were set ten builds apart and
  // never read in the same picture, so when Build 196 gave the figures an
  // exposure — and 201-205 took it to five times on Mira — nothing moved the
  // floor with them. Reported from a phone as the characters glowing:
  //
  //                      over the floor      after
  //     figure pixels          21%            5.8%
  //     world pixels           0.6%           0.1%
  //     Elin                   42.5%         10.2%
  //
  // 0.33 linear is sRGB 0.604 — the top of the ORDINARY tonal range, not above
  // it. A body carrying the art sheet's own histogram (32.3% over 0.60) would
  // have put a third of itself into an additive bloom. In the painting that
  // band is paint. 0.70 is sRGB 0.86, and Elin now lands on 10.2% against the
  // sheet's 10.6% highlight band.
  //
  // The floor is placed between the two populations rather than under the
  // reading: the fault measured 42.5% on one body and 21% over all of them, and
  // this passes at 5.8%.
  const lamp = await J(async () => {
    const C3 = window.Cast3D, was = C3.look();
    const grab = async () => {
      await new Promise(z => requestAnimationFrame(z));
      await new Promise(z => requestAnimationFrame(z));
      await C3._snapshot();
      const c = window.__castShot;
      return { w: c.width, h: c.height,
               d: c.getContext('2d').getImageData(0, 0, c.width, c.height).data };
    };
    C3.look({ pl: -2 });
    const mk = await grab();
    const fig = new Uint8Array(mk.w * mk.h);
    for (let i = 0, j = 0; i < mk.d.length; i += 4, j++)
      if (mk.d[i] > 140 && mk.d[i + 1] < 100 && mk.d[i + 2] > 140) fig[j] = 1;
    C3.look(was);
    const cr = document.getElementById('k-cast3d').getBoundingClientRect();
    const g = await grab();
    // the SAME conversion the threshold sees: the glow floor is in linear light
    // and the snapshot is sRGB, and reading one as the other is how this file
    // has mis-set a threshold before
    const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92
                                    : Math.pow((v + 0.055) / 1.055, 2.4); };
    const L = (j) => 0.2126 * lin(g.d[j * 4]) + 0.7152 * lin(g.d[j * 4 + 1])
                   + 0.0722 * lin(g.d[j * 4 + 2]);
    let nFig = 0, overFig = 0;
    for (let j = 0; j < mk.w * mk.h; j++)
      if (fig[j]) { nFig++; if (L(j) > was.glowT) overFig++; }
    const per = {};
    for (const id of ['elin', 'mira', 'ash']) {
      const e = document.querySelector('.k-hero[data-hero="' + id + '"]');
      if (!e) continue;
      const b = e.getBoundingClientRect();
      const x0 = Math.round((b.left - cr.left) / cr.width * mk.w);
      const y0 = Math.round((b.top - cr.top) / cr.height * mk.h);
      const x1 = Math.round((b.right - cr.left) / cr.width * mk.w);
      const y1 = Math.round((b.bottom - cr.top) / cr.height * mk.h);
      let n = 0, o = 0;
      for (let y = Math.max(0, y0); y < Math.min(mk.h, y1); y++)
        for (let x = Math.max(0, x0); x < Math.min(mk.w, x1); x++) {
          const j = y * mk.w + x; if (!fig[j]) continue;
          n++; if (L(j) > was.glowT) o++;
        }
      if (n > 200) per[id] = +(100 * o / n).toFixed(1);
    }
    return { glowT: was.glowT, floorInSRGB: +Math.pow(was.glowT, 1 / 2.2).toFixed(3),
             figN: nFig, figOverFloor: +(100 * overFig / Math.max(1, nFig)).toFixed(1),
             perBody: per };
  });
  check('GLOW: a body is a lit surface, not a lamp — only its highlights reach the bloom',
    lamp.figN > 500 && lamp.figOverFloor < 12
      && Object.keys(lamp.perBody).length === 3
      && Object.keys(lamp.perBody).every(k => lamp.perBody[k] < 20),
    JSON.stringify(lamp) + ' — share of each body over the glow floor, in the '
      + 'LINEAR light the threshold is expressed in. At the reported setting '
      + 'Elin read 42.5% and the party 21%, and the bodies — 4.4% of the frame '
      + '— were making 65.5% of its bloom');

  // ── AND THE DISTANCE IS A PLACE, NOT A GREY CARD ────────────────────────
  //
  // Every tone reading in this suite masks down to the FIGURES, and the plaza
  // is most of the frame. Measured on the canvas alone — no HUD, figures
  // excluded — against the reference the look is aimed at:
  //
  //                        far median   far saturation
  //     before Build 206      0.370         0.205
  //     shipped               0.290         0.440
  //     the reference         0.195         0.458
  //
  // Twice as bright and half as coloured is what "one flat grey card" measures
  // as, and no setting of the old dials could reach it: the grade desaturated
  // toward grey before applying a mild blue, so the thing it graded TOWARD was
  // nearly neutral. The floors sit between the two populations rather than
  // under the shipped reading.
  const plaza = await J(async () => {
    const C3 = window.Cast3D, was = C3.look();
    const grab = async () => {
      await new Promise(z => requestAnimationFrame(z));
      await new Promise(z => requestAnimationFrame(z));
      await C3._snapshot();
      const c = window.__castShot;
      return { w: c.width, h: c.height,
               d: c.getContext('2d').getImageData(0, 0, c.width, c.height).data };
    };
    C3.look({ pl: -2 });
    const mk = await grab();
    const fig = new Uint8Array(mk.w * mk.h);
    for (let i = 0, j = 0; i < mk.d.length; i += 4, j++)
      if (mk.d[i] > 140 && mk.d[i + 1] < 100 && mk.d[i + 2] > 140) fig[j] = 1;
    C3.look(was);
    const g = await grab();
    const L = [], S = [];
    for (let y = 0; y < mk.h / 3; y++) for (let x = 0; x < mk.w; x++) {
      const j = y * mk.w + x;
      if (fig[j]) continue;
      const r = g.d[j * 4], gr = g.d[j * 4 + 1], b = g.d[j * 4 + 2];
      L.push((0.2126 * r + 0.7152 * gr + 0.0722 * b) / 255);
      const mxc = Math.max(r, gr, b), mnc = Math.min(r, gr, b);
      S.push(mxc > 0 ? (mxc - mnc) / mxc : 0);
    }
    L.sort((a, z) => a - z);
    return { n: L.length, med: +L[(L.length * 0.5) | 0].toFixed(3),
             sat: +(S.reduce((a, z) => a + z, 0) / S.length).toFixed(3),
             atmoc: was.atmoc, atmok: was.atmok };
  });
  check('SCENE: the distance is a place, not a grey card behind the fight',
    plaza.n > 2000 && plaza.sat > 0.30 && plaza.med < 0.34,
    JSON.stringify(plaza) + ' — the far third of the canvas with the figures cut '
      + 'out, against the reference frame at 0.195 median and 0.458 saturation. '
      + 'It read 0.370 and 0.205 before the grade was given a colour to aim at');

  check('TONE: …and the lit side is still drawn, not clipped flat',
    tone.figN > 500 && tone.clip < 2.5 && tone.bandStd > 0.09,
    JSON.stringify(tone) + ' — how much of the figure sits at 1.0, and how much '
      + 'variation is left above 0.60; the art carries 0.118 and clips nothing, and a '
      + 'gain tuned on percentiles alone reached 7.5% clipped with no folds left in it');

  check('LENS: one bad pixel does not become a block on the screen',
    nan.dial && nan.poisoned === 0 && nan.clean === 0,
    JSON.stringify(nan) + ' — 24px all-black or all-white squares counted over the '
      + 'frame, with a NaN deliberately written into one pixel in 97; without the '
      + 'gate in the cut pass this reads dozens');

  // THE PAINTED ELLIPSE UNDER A FIGURE BELONGS TO THE 2D STAGE. In three
  // dimensions there is a real shadow from a real light, and the painted one
  // was switched off for the HEROES and nobody else — so the foe kept a blob
  // under it, and since the plate is stood down on death while the element
  // stays, that blob was still on the floor after the creature burned away.
  const blob = await J(() => {
    const out = {};
    for (const sel of ['.k-hero[data-hero="ash"] .k-shadow', '#k-boss-art .k-shadow']) {
      const el = document.querySelector(sel);
      out[sel.indexOf('hero') >= 0 ? 'hero' : 'foe'] =
        el ? +getComputedStyle(el).opacity : null;
    }
    return out;
  });
  check('SHADE: the painted floor blob is off for the foe as well as the party',
    blob.hero === 0 && blob.foe === 0,
    JSON.stringify(blob) + ' — computed opacity of the 2D shadow ellipse; the foe '
      + 'kept its own and it outlived the creature');

  // ── THE WATER REFLECTS THE CAMERA THAT IS THERE ─────────────────────────
  //
  // The mirror was rebuilt from the TRIPOD's mark — the eased eye and aim point
  // — with the roll bolted back on by hand, and the operator's offsets (push,
  // pan, yaw, pitch) never reached it. On an ordinary combat framing the two
  // are close enough that nothing shows; on a shot that pulls well off its
  // mark, like the reckoning, the floor sampled a reflection rendered from
  // somewhere the player is not, and it arrived as long smeared streaks under
  // the party that no camera angle explains.
  //
  // A reflection about the floor is exactly this: the same point with its
  // height negated. Anything that moves the camera and not the mirror breaks
  // this equality, whether or not anybody remembered it existed.
  const mir = await J(() => {
    const C3 = window.Cast3D, cam = C3._cam(), m = C3._mirror();
    if (!m) return { err: 'no mirror' };
    // …with the camera pulled off its mark, which is the case that failed
    C3.shot('reckoning', { speed: 0.85 });
    return new Promise(r => setTimeout(() => {
      cam.updateMatrixWorld(); m.updateMatrixWorld();
      const c = cam.getWorldPosition(new cam.position.constructor());
      const p = m.getWorldPosition(new cam.position.constructor());
      C3.shot('home');
      r({ dx: +Math.abs(p.x - c.x).toFixed(3),
          dy: +Math.abs(p.y + c.y).toFixed(3),
          dz: +Math.abs(p.z - c.z).toFixed(3),
          camY: +c.y.toFixed(2), mirY: +p.y.toFixed(2) });
    }, 1400));
  });
  check('WATER: the mirror sits where the camera reflects to, not where the mark is',
    !mir.err && mir.dx < 0.02 && mir.dy < 0.02 && mir.dz < 0.02,
    JSON.stringify(mir) + ' — metres between the mirror camera and the real one '
      + 'flipped about the floor, measured on a shot that pulls off its mark');

  // ── AND WHAT THE BURN DISCARDS, IT DISCARDS FROM ITS SHADOW ─────────────
  //
  // The tear runs in the colour pass; the shadow map is drawn with three's own
  // depth material, which knows nothing about it — so a creature dissolved into
  // ash went on casting a whole, solid, creature-shaped shadow, and it outlived
  // the creature by the length of the reckoning. Nothing about the picture says
  // this is missing until somebody dies and leaves a hole where a body was, so
  // the check is structural: every skinned mesh carries a depth material of its
  // own, and the default one has no idea the burn exists.
  const bshade = await J(() => {
    const f = window.Cast3D._figure('ash');
    let n = 0, custom = 0;
    f.root.traverse(o => { if (o.isSkinnedMesh) { n++; if (o.customDepthMaterial) custom++; } });
    return { skinned: n, withDepth: custom };
  });
  check('BURN: a body coming apart casts a shadow that is coming apart too',
    bshade.skinned > 0 && bshade.withDepth === bshade.skinned,
    JSON.stringify(bshade) + ' — skinned meshes carrying their own depth material; '
      + 'without it the discard never reaches the shadow map');

  console.log('\n── the drawn look ──');
  const ink = await J(async () => {
    const C3 = window.Cast3D;
    const grab = async () => {
      await C3._snapshot();
      const c = window.__castShot;
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      const lum = new Float32Array(c.width * c.height);
      for (let i = 0, j = 0; i < d.length; i += 4, j++)
        lum[j] = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      return { lum, w: c.width, h: c.height };
    };
    const was = C3.look();               // look() with nothing reports what is set
    C3.look({ line: -3 });                       // the contour mask, on its own
    await new Promise(r => requestAnimationFrame(r));
    await new Promise(r => requestAnimationFrame(r));
    const m = await grab();
    const b = document.getElementById('k-cast').getBoundingClientRect();
    const sx = m.w / b.width, sy = m.h / b.height;
    const inBox = new Uint8Array(m.w * m.h);
    let boxN = 0;
    for (const who of ['ash', 'elin', 'mira']) {
      const el = document.querySelector('.k-hero[data-hero="' + who + '"]');
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const x0 = Math.max(0, Math.round((r.left - b.left) * sx)), x1 = Math.min(m.w, Math.round((r.right - b.left) * sx));
      const y0 = Math.max(0, Math.round((r.top - b.top) * sy)), y1 = Math.min(m.h, Math.round((r.bottom - b.top) * sy));
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++)
        if (!inBox[y * m.w + x]) { inBox[y * m.w + x] = 1; boxN++; }
    }
    let farN = 0;
    const isFar = new Uint8Array(m.w * m.h);
    for (let y = 0; y < Math.floor(m.h / 3); y++) for (let x = 0; x < m.w; x++)
      if (!inBox[y * m.w + x]) { isFar[y * m.w + x] = 1; farN++; }
    let all = 0, box = 0, far = 0;
    for (let i = 0; i < m.lum.length; i++) if (m.lum[i] > 127) {
      all++; if (inBox[i]) box++; if (isFar[i]) far++;
    }
    C3.look(was);
    return {
      frame:   +(all / m.lum.length * 100).toFixed(2),
      bodies:  +(box / Math.max(1, boxN) * 100).toFixed(2),
      plaza:   +(far / Math.max(1, farN) * 100).toFixed(2),
      // the ink is gone (Build 191); what ships for opening the game is the lens
      onByDefault: was.dof > 0.002,
    };
  });
  check('LOOK: the contour is a LINE and not a wash — a few per cent of the picture',
    ink.frame > 0.4 && ink.frame < 12,
    JSON.stringify(ink) + ' — the ratio detector this replaced inked 64% at every setting it was given');
  // THE ONE THAT ACTUALLY MATTERS. Coverage alone cannot tell a silhouette from
  // an even sprinkle of noise; the ratio between where it draws and where it
  // does not can.
  check('LOOK: …and it draws round the PEOPLE, not over the square behind them',
    ink.bodies > 2.5 && ink.bodies > ink.plaza * 2.5,
    JSON.stringify(ink) + ' % of each region inked — an undiscriminating detector reads these equal');
  // …AND IT STAYS OFF UNTIL THE PASS IS FREE. Build 140 shipped it on and the
  // game went dark, because routing the frame through a render target and
  // straight back — with the shader doing nothing at all — moves the drawing
  // buffer's mean luminance from 0.274 to 0.150 and crushes 52% of the picture
  // into the darkest eighth of the range, against 5%. Four accounts of the
  // missing conversion were measured and all four were wrong; the one exponent
  // that fits is a number with no meaning. Until that is understood rather than
  // fitted, the defaults leave the target unallocated and the render path
  // byte-for-byte what it was before the pass existed.
  // …AND NOW IT DOES SHIP, because the round trip finally costs nothing. Build
  // 142 switched this off with the pass 0.124 out; the fault was that the
  // painterly treatment ran AFTER three's encode, so the scene was shaded in
  // two different colour spaces depending on which path it took. With the
  // paint, the haze and the encode in one order everywhere the error is 0.008.
  // ── AND THE OUTLINE IS NOT WHAT YOU GET ANY MORE (Build 191) ──────────
  //
  // This asserted the drawn contour ships. It was removed for looking cheap —
  // a depth operator draws a line of even weight around everything with an
  // edge, which is a filter rather than drawing — so the check that guarded it
  // goes with it rather than being loosened into something that passes.
  //
  // What DOES ship for opening the game is the lens, and that is worth holding
  // on to: it is the treatment the whole separation between the fight and the
  // city now rests on.
  check('LOOK: the lens is what you get for opening the game',
    ink.onByDefault === true,
    JSON.stringify({ lens: ink.onByDefault }) + ' — the band ladder, the paper'
      + ' grain and the ink contour all fought the art and are all off');

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
  // ── A BLOW IS THROWN AT SOMETHING, SO THE BODY GOES TO IT ───────────────
  //
  // `lunge` had existed since Build 139 and one thing called it: the all-out.
  // Every ordinary attack was swung on the spot, so three people stood in a
  // line and waved weapons at something two and a half metres away.
  //
  // Two halves, and the second is the one that can fail for the right reason.
  // A swing crosses ground and comes home; a HEAL does not cross at all,
  // because otherwise this is not a step, it is a figure that moves whenever
  // anything happens.
  //
  // THE HAND IS FORCED AND THE FIGHT RESTARTED PER CASE. A first cut played
  // both into one turn: the second found no AP, did not play, and reported
  // "the heal did not step" — true, and no evidence at all. Whether the card
  // played is part of the reading now, so a case that never ran cannot pass
  // by staying still.
  //
  // AND THE STEP IS READ WHERE IT IS SET. At two frames a second the slot ease
  // snaps to its mark in one frame, so a sampled position catches the travel
  // wherever the sampler and the renderer line up — a 0.62m step read as
  // 0.222. The lunge vector is what the ease walks toward, without the frame
  // rate in it. The RETURN is still sampled, because that is a thing that
  // happens over time, and it is only asked to arrive eventually.
  // ── A SWING IS NOT ONE SPEED ────────────────────────────────────────────
  //
  // Every attack used to play at a constant rate, which is what flat is: the
  // body covers the same ground in the first sixtieth of the wind-up as in the
  // sixtieth the weapon lands on, and nothing in the motion says which frame
  // the blow is.
  //
  // The warp pins three points — start, CONTACT and end — so each half maps
  // onto itself and neither the moment the weapon arrives nor the length of
  // the clip moves. That invariant is what lets it be applied at all: contact
  // and beat are both derived from duration and timeScale, and everything
  // downstream is scheduled off them. It is checked two ways — the shape here,
  // and the consequences in beat.test, which reads when the number prints and
  // how long the camera holds.
  console.log('\n── the swing ──');
  const swing = await J(() => {
    const C3 = window.Cast3D, f = C3._figure('ash');
    const name = C3._verbClip('ash', 'slash');
    const m = f.meta && f.meta[name];
    if (!m || !(m.hit > 0)) return { err: 'no contact frame on ' + name };
    f.clear(); f.play(name);
    const a = f.actions[name], dur = a.getClip().duration;
    const base = a._baseRate;
    const at = [];
    for (const u of [0.02, 0.25, 0.5, 0.75, 0.98]) {
      a.time = u * dur;
      f.step(0.0001);
      at.push(+(a.timeScale / base).toFixed(2));
    }
    // the fastest frame of the clip, and where it sits relative to contact
    let peak = 0, peakU = 0;
    for (let i = 1; i < 200; i++) {
      a.time = (i / 200) * dur;
      f.step(0.0001);
      const r = a.timeScale / base;
      if (r > peak) { peak = r; peakU = i / 200; }
    }
    f.clear();
    return { at, hit: +m.hit.toFixed(3), peak: +peak.toFixed(2), peakU: +peakU.toFixed(3),
             lo: +Math.min(...at).toFixed(2), hi: +Math.max(...at).toFixed(2) };
  });
  check('SWING: the blow accelerates rather than playing at one speed',
    !swing.err && swing.hi / swing.lo > 3,
    JSON.stringify(swing) + ' — rate against the clip own budget, sampled across it');
  check('SWING: …and it is fastest at the frame the weapon arrives',
    !swing.err && Math.abs(swing.peakU - swing.hit) < 0.04,
    JSON.stringify(swing) + ' — the peak has to land on the contact frame, not '
      + 'somewhere in the follow-through');

  // ── THREE RANKS ON ONE LINE ─────────────────────────────────────────────
  //
  // The middle slot sat 27cm off the line between its neighbours and the steps
  // between ranks were uneven, so the party read as a bend rather than as a
  // formation with a front and a back. Measured as the perpendicular distance
  // of the middle mark from the line joining the other two, which is the only
  // thing "in a line" can mean.
  const line = await J(() => {
    const S = window.Cast3D._stage ? window.Cast3D._stage() : null;
    if (!S) return { err: 'no stage' };
    const off = (r) => {
      const a = r.front, b = r.back, m = r.mid;
      const vx = b[0] - a[0], vy = b[1] - a[1];
      const L = Math.hypot(vx, vy) || 1;
      return +(Math.abs((m[0] - a[0]) * vy - (m[1] - a[1]) * vx) / L).toFixed(4);
    };
    return { hero: off(S.hero), foe: off(S.foe) };
  });
  // ── AND EACH BODY STANDS ON ITS OWN MARK ────────────────────────────────
  //
  // A figure is placed by subtracting the distance between its FEET and its
  // root, frozen once while it is standing still. Before that existed it was
  // placed by the centre of its rendered SILHOUETTE — which includes whatever
  // it is holding, so Elin's staff pushed her body off the ring that is
  // supposed to be under her feet.
  //
  // ── AND WHAT THIS COSTS TO MEASURE HONESTLY (Build 181) ─────────────────
  //
  // This check spent three builds red-on-and-off, reporting 8.3 / 8.3 / 0.1 px
  // for elin across runs of unchanged code, and the repeated 8.3 was read as a
  // fallback constant — "the freeze never fired". It was a coincidence. Read
  // out of the layer directly, the freeze fires for every figure on every run
  // and elin's silhouette offset is -0.048, nowhere near the 0.083 the number
  // was being blamed on.
  //
  // What moves is the IDLE. A standing figure shifts its weight, the solver
  // pins the feet where the pose puts them, and a single sample of a live foot
  // against a static mark measures wherever in that cycle the sample landed —
  // three to seven centimetres, which is three to seven pixels.
  //
  // So it is measured as two things instead of one. The SETTLED stand point —
  // where the placement arithmetic actually puts the body — has to be on the
  // mark to within a centimetre, and that is exact and cannot drift. The LIVE
  // feet are then averaged over two samples most of a second apart: sway
  // cancels between them and a placement error does not.
  const standAt = () => J(() => {
    const C3 = window.Cast3D, cam = C3._cam();
    const V = C3._figure('ash').root.position.constructor;
    const host = document.getElementById('k-cast').getBoundingClientRect();
    const px = (x, y, z) => {
      const v = new V(x, y, z).project(cam);
      return [(v.x * 0.5 + 0.5) * host.width, (-v.y * 0.5 + 0.5) * host.height];
    };
    const out = {};
    for (const [id, row] of [['elin', 'back'], ['mira', 'mid'], ['ash', 'front']]) {
      const f = C3._figure(id); if (!f) continue;
      const S = C3._stage().hero[row];
      f.root.updateMatrixWorld(true);
      const eL = f.bones.LeftFoot.matrixWorld.elements, eR = f.bones.RightFoot.matrixWorld.elements;
      const feet = px((eL[12] + eR[12]) / 2, 0, (eL[14] + eR[14]) / 2);
      const mark = px(S[0], 0, S[1]);
      out[id] = { dx: feet[0] - mark[0], dy: feet[1] - mark[1],
                  // HOW FAR THE FEET ARE FROM THE MARK, IN METRES — the same
                  // fault as `dx`/`dy` but in the units the layer thinks in,
                  // so a placement error and a projection error can be told
                  // apart.
                  //
                  // This used to read `root.x + standDX - mark`, which is the
                  // placement arithmetic solved for its own input: the layer
                  // puts the root at `mark - standDX`, so that expression is
                  // zero however wrong the stand is. It reported 0.0000 for
                  // all three through every build in which one of them was
                  // eight pixels off its mark, which is the whole reason that
                  // fault went four builds without a cause.
                  settled: +Math.hypot((eL[12] + eR[12]) / 2 - S[0],
                                       (eL[14] + eR[14]) / 2 - S[1]).toFixed(4),
                  frozen: f.standDX !== undefined };
    }
    return out;
  });
  // ── AND IT WAITS FOR THE FIXED POINT, NOT FOR A CLOCK (Build 192) ──────
  //
  // The stand correction is a damped fixed point: it takes a pass every three
  // still frames and halves the error each time. That is a number of FRAMES,
  // and this check sampled after a number of SECONDS — which is the same thing
  // only while the frame rate holds. Build 192 put an environment and four
  // extra texture fetches into the figure shader, the headless renderer got
  // slower, fewer frames fitted in the same wall clock, and Mira was caught
  // 5cm from her mark still converging. Nothing about the placement had
  // changed; the check was measuring the test machine.
  //
  // So it waits for the thing it is about to measure to stop moving, and gives
  // up after a bounded number of tries rather than hanging. A suite that waits
  // on a condition survives a slower renderer; one that waits on a stopwatch
  // has to be re-tuned every time the cost of a frame changes.
  for (let i = 0; i < 30; i++) {
    const a = await J(() => JSON.stringify(window.Cast3D._state().stand || {}));
    await sleep(320);
    const b = await J(() => JSON.stringify(window.Cast3D._state().stand || {}));
    if (a === b && a !== '{}') break;
  }
  const s1 = await standAt();
  await sleep(820);
  const s2 = await standAt();
  const stand = {};
  for (const id of Object.keys(s1)) {
    if (!s2[id]) continue;
    stand[id] = { mean: +Math.hypot((s1[id].dx + s2[id].dx) / 2,
                                    (s1[id].dy + s2[id].dy) / 2).toFixed(1),
                  // …and WHICH WAY, because across the floor and up the screen
                  // are two different faults: sideways is placement, and
                  // vertical on a back-rank body is depth
                  ax: [+((s1[id].dx + s2[id].dx) / 2).toFixed(1),
                       +((s1[id].dy + s2[id].dy) / 2).toFixed(1)],
                  sway: +Math.hypot(s1[id].dx - s2[id].dx, s1[id].dy - s2[id].dy).toFixed(1),
                  settled: s1[id].settled, frozen: s1[id].frozen };
  }
  check('LINE: …and each body stands on its own mark, not beside it',
    Object.keys(stand).length === 3
    && Object.keys(stand).every(k => stand[k].frozen
                                  && stand[k].settled < 0.04
                                  && stand[k].mean < 4.5),
    JSON.stringify(stand) + ' — `settled` is metres between the FEET and the'
    + ' mark, `mean` is the same fault in screen px averaged across the idle,'
    + ' `sway` is how far the feet moved between the two samples');

  check('LINE: the three ranks stand on one line, not an arc',
    !line.err && line.hero < 0.01 && line.foe < 0.01,
    JSON.stringify(line) + ' m — how far the middle mark sits off the line '
      + 'joining the front and back; it was 0.27 for the party');

  // ── AND THE TEXTURE IS READ AS SHARPLY AS THE MACHINE ALLOWS ────────────
  //
  // The maps are 2048 square and were being sampled with anisotropy 1, which
  // is the setting that picks a mip from a surface's WORST axis: every cloak
  // falling away from the camera, every turning sleeve, read from a blurred
  // mip while the detail sat in the texture. This is the cheapest sharpness in
  // the file and it was left on the default.
  const sharp = await J(() => {
    const f = window.Cast3D._figure('ash');
    let sk = null; f.root.traverse(o => { if (o.isSkinnedMesh) sk = o; });
    const map = sk && sk.material && sk.material.map;
    const gl = document.createElement('canvas').getContext('webgl2');
    const ext = gl && gl.getExtension('EXT_texture_filter_anisotropic');
    const max = ext ? gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : 1;
    return { aniso: map ? map.anisotropy : null, max,
             size: map && map.image ? [map.image.width, map.image.height] : null };
  });
  check('SHARP: the figures are sampled at the anisotropy the machine offers',
    sharp.aniso >= Math.min(16, sharp.max),
    JSON.stringify(sharp) + ' — 1 is the default and it costs a 2048 map most '
      + 'of its detail on anything turned away from the camera');

  console.log('\n── the step into the blow ──');
  const step = {};
  for (const c of [{ card: 'serrate', who: 'mira', verb: 'slash' },
                   { card: 'mend', who: 'elin', verb: 'heal' }]) {
    await J(() => startCombat({ foes: ['husk'] }));
    // …AND FOR THE FOE, not only for the attacker: the step is aimed at the
    // enemy, so a card played before the bestiary model arrives measures a
    // fallback rather than the swing, and a 3.1m run reads as 0.34m.
    for (let i = 0; i < 40 && !(await J((w) => !!(window.Cast3D && window.Cast3D._figure(w)
        && window.Cast3D._figure('foe0')), c.who)); i++)
      await sleep(250);
    await sleep(600);
    const r = await J(({ card, who }) => {
      const f = window.Cast3D._figure(who);
      if (!f) return { err: 'no figure' };
      window.__home = [f.root.position.x, f.root.position.z];
      if (window.K.forceHand) window.K.forceHand([card, 'cleave', 'serrate', 'qthrow', 'frostbind']);
      const ap0 = window.K.state().ap;
      try { window.K.playCard(card); } catch (e) { return { err: e.message }; }
      const L = f.lunge;
      return { played: window.K.state().ap !== ap0,
               step: L ? +Math.hypot(L.x, L.z).toFixed(3) : 0 };
    }, c);
    let back = 9;
    for (let i = 0; i < 20 && !r.err; i++) {
      await sleep(160);
      back = await J((w) => {
        const f = window.Cast3D._figure(w), h = window.__home;
        return +Math.hypot(f.root.position.x - h[0], f.root.position.z - h[1]).toFixed(3);
      }, c.who);
      if (back < 0.05) break;
    }
    step[c.verb] = { ...r, back };
  }
  check('STEP: a swing crosses the floor at the thing it is swung at',
    step.slash.played === true && step.slash.step > 1.0,
    JSON.stringify(step.slash) + ' — metres, set at play time and timed so the '
      + 'body is still driving forward on the contact frame; a lean is not a run, '
      + 'so this asks for more than a metre');
  check('STEP: …and comes back to its own mark afterwards',
    step.slash.played === true && step.slash.back < 0.05,
    JSON.stringify(step.slash) + ' — a step that does not return is a party '
      + 'migrating into the enemy line over a fight');
  check('STEP: …and a heal does not charge the enemy',
    step.heal.played === true && step.heal.step === 0,
    JSON.stringify(step.heal) + ' — the card has to have actually played, or '
      + 'this passes by nothing happening');

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
  // …AND THE WAY BACK IS NOW A TEST ROUTE, NOT A PLAYER'S. `?cast=2d` answers
  // only alongside `?test=1`, which is what keeps eight suites fast behind a
  // software rasteriser while making sure nobody can reach a second renderer
  // from the address bar. The harness always passes test=1, so this still
  // exercises the painted stage — it just proves the flag is not dead.
  check('DEFAULT: and ?cast=2d is still the painted stage for the suites',
    stages['opt-out'].wanted === false && stages['opt-out'].on === false
    && stages['opt-out'].body === false,
    JSON.stringify(stages['opt-out']));

  // ═══ THE PICTURE HAS DARKS, COLOUR AND A LINE (Build 186) ══════════════
  //
  // "Washed out with an unrefined outline" was three faults and none of them
  // had an instrument, so each could come back silently. Measured on the
  // combat frame, before: mean saturation 0.068 — a greyscale image with a
  // tint — with nothing below 0.089 and nothing above 0.682. No black in the
  // game and no white.
  //
  // THE LINE IS THE ONE THAT TOOK FOUR TRIES TO MEASURE, and every failure was
  // the instrument rather than the shader:
  //
  //   "most of the ink should be at full strength" — false for any thin line.
  //   A one-pixel contour is mostly EDGE; partial coverage is what
  //   antialiasing IS. A perfectly clean silhouette scored 0.22 on this,
  //   indistinguishable from the smear it was supposed to catch.
  //
  //   measured over the whole board — the board is mostly plaza, the plaza is
  //   deliberately out of focus, and the ink fades with the same circle of
  //   confusion. A correct fade counted as weak ink.
  //
  //   coverage of the COMPOSITE against an un-inked frame — confounded by the
  //   ink COLOUR. Build 186 made the ink four times darker, so every partly
  //   covered edge pixel began crossing the threshold and the "thinner" line
  //   measured as covering more: 20.6% before, 26.2% after, for a line that
  //   had barely changed shape.
  //
  // What answers the question is the MASK, which the shader will print on
  // request (uLine < -2.5) and which neither the ink colour nor the picture
  // underneath can touch. Read over the bodies own boxes:
  //
  //                 covers   at full   partial   crisp
  //     Laplacian    4.43%     2.90%     1.53%    0.65
  //     both terms   4.52%     3.68%     0.84%    0.81
  //
  // So the gate is CRISPNESS, not coverage — the share of the mark that is
  // committed rather than grey — with coverage kept in a corridor either side
  // so a line that vanishes and a line that floods both fail.
  // ═══ EVERYBODY IS FACING THE FIGHT (Build 190) ═════════════════════════
  //
  // Reported as "Mira is facing the wrong direction", and she was not: every
  // model faces the camera correctly at a heading of zero, and all three stood
  // between 57 and 68 degrees, which is toward the enemy line. What was wrong
  // is that hers was 68 — the most side-on of the three — so the least of her
  // face was showing, and her silhouette is a hood, a ponytail and a dark
  // cloak, which gives a player fewer clues about which way she points than
  // Ash's face or Elin's staff. It read as turned away because it nearly was.
  //
  // THE BOUND COMES FROM THE FAULT, and saying so is the honest version: 68
  // was reported as wrong by someone looking at it, 64 and 57 were not, so the
  // line sits at 66. A cast entry added later with a `turn` that leaves its
  // owner more side-on than that will fail here rather than in a screenshot.
  console.log('\n── everybody is facing the fight ──');
  {
    const facing = await J(() => {
      const C3 = window.Cast3D, out = {};
      for (const id of ['ash', 'elin', 'mira']) {
        const f = C3._figure(id); if (!f) continue;
        f.root.updateWorldMatrix(true, true);
        const V = f.root.position.constructor;
        const g = n => f.bones[n] ? f.bones[n].getWorldPosition(new V()) : null;
        const L = g('LeftShoulder') || g('LeftUpLeg');
        const R = g('RightShoulder') || g('RightUpLeg');
        if (!L || !R) continue;
        const fwd = new V().crossVectors(new V(0, 1, 0), new V().subVectors(R, L)).normalize();
        // 0 looks at the camera, +90 looks along the board at the foes
        out[id] = +(Math.atan2(fwd.x, fwd.z) * 180 / Math.PI).toFixed(1);
      }
      return out;
    });
    const ids = Object.keys(facing);
    check('FACING: every hero is turned toward the enemy line, not away from it',
      ids.length === 3 && ids.every(k => facing[k] > 20 && facing[k] < 110),
      JSON.stringify(facing) + ' — degrees off looking at the camera; a body'
      + ' turned past 90 has started showing its back to the player');
    // …AND THE SECOND HALF IS READ OFF THE CONFIG, NOT THE POSE.
    //
    // The first cut of this bounded the live heading at 66 degrees, and it
    // failed on Ash at 68.9 while the suite's own older facing check, in the
    // same run, reported him at 63.9. The idle sways a body about five
    // degrees, so a static bound tight enough to catch the fault sits inside
    // the noise and flaps. What was actually wrong is a number in the cast
    // table — `turn`, how far a body is brought back toward the camera — and
    // that number does not move at all.
    const turns = await J(() => {
      const C3 = window.Cast3D, out = {};
      for (const id of ['ash', 'elin', 'mira']) {
        const f = C3._figure(id);
        if (f && f.tone) out[id] = f.tone.turn;
      }
      return out;
    });
    const tk = Object.keys(turns);
    check('FACING: …and no hero is angled further off the camera than the others',
      tk.length === 3 && tk.every(k => turns[k] >= 25),
      JSON.stringify(turns) + ' — Mira shipped at 22 against Ash 26 and Elin 34'
      + ' and was reported as facing the wrong way; the floor is where that fault'
      + ' was, and it is read off the table rather than the pose because the idle'
      + ' sways a body five degrees either way');
  }

  console.log('\n── the picture is drawn, not rendered ──');
  {
    const pic = await J(async () => {
      const C3 = window.Cast3D;
      const grab = async () => {
        await new Promise(r => requestAnimationFrame(r));
        await new Promise(r => requestAnimationFrame(r));
        await C3._snapshot();
        const c = window.__castShot;
        return { w: c.width, h: c.height,
                 d: c.getContext('2d').getImageData(0, 0, c.width, c.height).data };
      };
      const was = C3.look();
      const on = await grab();
      C3.look({ line: -3 });                 // the mask the composite draws
      const mask = await grab();
      // …and the FIGURES, flat magenta written after the painted light, so the
      // silhouette this measures does not move when the lighting does
      C3.look(was);
      C3.look({ pl: -2 });
      const fm = await grab();
      C3.look(was);
      // the middle of the board, where the party stands — in fractions, so the
      // reading does not depend on the buffer this browser happened to make
      const x0 = Math.round(on.w * 0.38), x1 = Math.round(on.w * 0.86);
      const y0 = Math.round(on.h * 0.12), y1 = Math.round(on.h * 0.72);
      let sat = 0, n = 0, dark = 0, lo = 1, hi = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const i = (y * on.w + x) * 4;
        const r = on.d[i] / 255, g = on.d[i + 1] / 255, b = on.d[i + 2] / 255;
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        sat += mx > 0 ? (mx - mn) / mx : 0;
        const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        if (L < 0.06) dark++;
        if (L < lo) lo = L; if (L > hi) hi = L;
        n++;
      }
      // …and the ink on the BODIES, whose boxes come from the DOM the layer
      // already follows, in canvas fractions
      const cv = document.getElementById('k-cast3d');
      const cr = cv.getBoundingClientRect();
      const boxes = [];
      document.querySelectorAll('.k-hero, #k-boss-art').forEach(e => {
        const b = e.getBoundingClientRect();
        if (!b.width || !b.height) return;
        boxes.push([Math.round((b.left - cr.left) / cr.width * on.w),
                    Math.round((b.top - cr.top) / cr.height * on.h),
                    Math.round((b.right - cr.left) / cr.width * on.w),
                    Math.round((b.bottom - cr.top) / cr.height * on.h)]);
      });
      let bn = 0, any = 0, full = 0;
      // …and the luminance inside each body's box against a ring around it
      let inSum = 0, inN = 0, ringSum = 0, ringN = 0;
      const lumAt = (x, y) => { const i = (y * on.w + x) * 4;
        return (0.2126 * on.d[i] + 0.7152 * on.d[i + 1] + 0.0722 * on.d[i + 2]) / 255; };
      for (const [bx0, by0, bx1, by1] of boxes) {
        for (let y = Math.max(0, by0); y < Math.min(on.h, by1); y++)
          for (let x = Math.max(0, bx0); x < Math.min(on.w, bx1); x++) {
            const v = mask.d[(y * on.w + x) * 4];
            if (v > 10) any++;
            if (v > 200) full++;
            inSum += lumAt(x, y); inN++;
            bn++;
          }
        const pad = Math.round((bx1 - bx0) * 0.55);
        for (let y = Math.max(0, by0); y < Math.min(on.h, by1); y++)
          for (let x = Math.max(0, bx0 - pad); x < Math.min(on.w, bx1 + pad); x++) {
            if (x >= bx0 && x < bx1) continue;      // the ring, not the body
            ringSum += lumAt(x, y); ringN++;
          }
      }
      // ── AND THE SEPARATION IS MEASURED AT THE EDGE, NOT AS TWO AVERAGES ──
      //
      // Build 196 raised the cast's exposure and this reading FELL, from 0.045
      // to 0.013, while the bodies were plainly easier to see. The old form
      // was |mean inside the DOM box − mean of a ring around it|, and a DOM box
      // is mostly plaza — so what it really tracked was where the figures' mean
      // sat relative to the ground's. The exposure carried that mean from below
      // the ground (0.247 against 0.300) to above it (0.356 against 0.318), and
      // an absolute difference passes through zero on the way. It was reading
      // the crossing, not the separation.
      //
      // Measured on the same frames, same mask, same session, the contrast that
      // actually exists at the silhouette went the other way:
      //
      //                 step across the edge   edges over 0.05   mean gap
      //     expo 1            0.1069                71.2%         0.0527
      //     expo 5            0.1405                73.6%         0.0380
      //
      // So this walks the figure mask's own boundary and compares two pixels
      // inside against three outside — far enough to clear the lens fringe,
      // close enough to still be the body and the ground. That is the
      // comparison an eye makes at a silhouette, which is what the check has
      // always claimed to be making, and it cannot be cancelled by a mean.
      const W = on.w;
      const isFig = (j) => fm.d[j * 4] > 140 && fm.d[j * 4 + 1] < 100 && fm.d[j * 4 + 2] > 140;
      let stepSum = 0, stepN = 0, strong = 0;
      for (let y = 4; y < on.h - 4; y++) for (let x = 4; x < W - 4; x++) {
        const j = y * W + x;
        if (!isFig(j)) continue;
        let dx = 0, dy = 0;
        if (!isFig(j - 1)) dx = -1; else if (!isFig(j + 1)) dx = 1;
        else if (!isFig(j - W)) dy = -1; else if (!isFig(j + W)) dy = 1;
        else continue;
        const a = (y - dy * 2) * W + (x - dx * 2), b = (y + dy * 3) * W + (x + dx * 3);
        if (a < 0 || b < 0 || a >= W * on.h || b >= W * on.h) continue;
        if (!isFig(a) || isFig(b)) continue;   // both sides must be what they claim
        const d = Math.abs(lumAt((a % W), Math.floor(a / W)) - lumAt((b % W), Math.floor(b / W)));
        stepSum += d; stepN++; if (d > 0.05) strong++;
      }
      return { sat: +(sat / n).toFixed(3), dark: +(100 * dark / n).toFixed(2),
               lo: +lo.toFixed(3), hi: +hi.toFixed(3), bodies: boxes.length,
               covers: +(100 * any / bn).toFixed(2),
               atFull: +(100 * full / bn).toFixed(2),
               crisp: any ? +(full / any).toFixed(2) : 0,
               edges: stepN,
               step: +(stepSum / Math.max(1, stepN)).toFixed(4),
               strongPct: +(100 * strong / Math.max(1, stepN)).toFixed(1),
               // kept because it is the number that used to be gated on, and a
               // reader comparing this build to an older log needs to see it
               meanGap: +Math.abs((inN ? inSum / inN : 0)
                                - (ringN ? ringSum / ringN : 0)).toFixed(3) };
    });
    check('DRAWN: the picture has colour in it — it measured 0.068, a grey with a tint',
      pic.sat > 0.13,
      JSON.stringify(pic) + ' — mean saturation over the board');
    check('DRAWN: …and a black to stand it against, which it did not have',
      pic.lo < 0.02 && pic.dark > 1.5,
      JSON.stringify(pic) + ' — the darkest pixel, and the share under 0.06');
    // ── AND THE SEPARATION IS VALUE NOW, NOT A LINE (Build 191) ────────
    //
    // The contour was removed for looking cheap, so the check that guarded it
    // goes with it — a gate for a feature that is gone is not a gate. But the
    // JOB it was doing has to be guarded by something, and the job was never
    // the line: it was that a body reads as separate from what is behind it.
    //
    // That is what this asks instead, and it is the harder question. It
    // compares the luminance of the bodies against the luminance of the ring
    // of picture immediately around them, which is the comparison an eye
    // actually makes at a silhouette. An outline would pass it trivially; so
    // would a figure lit against a dark ground, which is the point — either is
    // a real answer and a flat grey figure on a flat grey plaza is not.
    check('DRAWN: …and a body separates from what is behind it',
      pic.bodies >= 3 && pic.edges > 300 && pic.step > 0.06,
      JSON.stringify(pic) + ' — the mean luminance step across the figures own'
      + ' silhouette, two pixels inside against three outside. It reads 0.141'
      + ' with the cast exposure and 0.107 without it, so the floor sits below'
      + ' both: this is a guard against a flat picture, not a target. An'
      + ' outline would pass it and so does a figure lit against a dark ground'
      + ' — either is a real answer, and a grey figure on a grey plaza is not.'
      + ' It replaced a difference of two MEANS, which fell to 0.013 on a build'
      + ' that made the bodies easier to see, because the figures average'
      + ' crossed the grounds and an absolute difference goes through zero');
  }

  // ═══ A PLACE THAT IS NOT THE FIGHT (Build 184) ═════════════════════════
  //
  // Every mark, every visibility and every DOM follower in this layer has been
  // read off the COMBAT DOM. A scene is the other way round — the marks come
  // from a table, nobody claims an element, the world is switched off so the
  // figures composite over the room that screen is painted as — and the two
  // things that would break a run are the canvas not moving and the canvas not
  // coming back. Both are checked, in that order.
  // ── THE PARRY READOUT, ON THE STAGE PLAYERS ACTUALLY GET ─────────────────
  //
  // Build 217 made a parry prove itself: the receipt names what the hands
  // caught, and the number carries the blow it would have been struck through
  // above the one that landed. Its checks live in the beat gate, which boots
  // the PAINTED stage — right for them, because the words and the numbers are
  // DOM and do not know which stage they are over.
  //
  // What is not stage-independent is WHERE the readout lands. Over the painted
  // stage a hero is a DOM plate; here the figure is projected from a 3D scene
  // and the plate follows it every frame. A number anchored to a hero who has
  // moved is a number over nobody, and the beat gate cannot see that.
  {
    const aimed = await J(async () => {
      window.K.startCombat({ seed: 21 });
      window.K.forceIntent('hymn');
      await new Promise(r => setTimeout(r, 1200));
      const st = document.getElementById('k-stage');
      const sr = st.getBoundingClientRect();
      const mid = (e) => { const r = e.getBoundingClientRect();
                           return Math.round(r.left + r.width / 2 - sr.left); };
      // ── BOTH IN THE SAME TICK, OR IT IS NOT A COMPARISON ───────────────
      //
      // The first cut sampled the popup's position while the volley ran and the
      // figures' position after it finished. Those are different instants, and
      // on a stage where the lens is still travelling that is not a measurement
      // of anything: the number read 376 against figures that were at -397,
      // -154 and 78 by the time anyone asked.
      const seen = [];
      const watch = setInterval(() => {
        const at = {};
        document.querySelectorAll('.k-hero[data-hero]').forEach(h => { at[h.dataset.hero] = mid(h); });
        document.querySelectorAll('.k-pop').forEach(p => {
          const w = p.querySelector('.k-pop-was');
          if (!w) return;
          const key = w.textContent + '>' + p.lastChild.textContent;
          const x = mid(p);
          const gap = Math.round(Math.min(...Object.values(at).map(hx => Math.abs(hx - x))));
          const had = seen.find(s => s.key === key);
          // the WORST frame is the one that matters: a number that is right at
          // rest and adrift while the camera moves is still adrift
          if (!had) seen.push({ key, x, gap, worst: gap });
          else had.worst = Math.max(had.worst, gap);
        });
      }, 30);
      const r = await window.K.endTurn({ grades: (window.K.currentIntent().hits || [])
        .flatMap(h => h.notes.map(() => 'good')) });
      clearInterval(watch);
      const heroes = {}, widths = [];
      document.querySelectorAll('.k-hero[data-hero]').forEach(h => {
        heroes[h.dataset.hero] = mid(h);
        widths.push(Math.round(h.getBoundingClientRect().width));
      });
      return { seen, heroes, widths, stageW: Math.round(sr.width), taken: r.taken,
               struck: (r.hits || []).map(h => h.targetId) };
    });
    // ── AND IT PROVES IT HAS SOMETHING TO MEASURE FIRST ────────────────────
    //
    // The first cut of this check ran at the END of the suite, after the camp
    // borrowed the canvas, and the stage was hidden by then: every rect came
    // back {0,0,0,0}, so every |hero - pop| was |0 - 0| and it passed while
    // measuring nothing at all. A positional check has to fail when it has no
    // positions, which is the only reason this reads the widths.
    const laid = aimed.stageW > 400
      && Object.keys(aimed.heroes).length === 3
      && aimed.widths.every(w => w > 40);
    // …and it is over the hero the blow was aimed at, within half a figure, in
    // EVERY frame of its life and not merely in the one where it was born.
    //
    // HALF A FIGURE, MEASURED, not 60px. The first threshold was a round number
    // and it passed by eight pixels — because a volley FANS its numbers apart by
    // up to 52px on purpose (`--pop-dx`, so two 9s never read as "99"), and a
    // literal that happens to sit just outside a deliberate offset is a literal
    // about to fail for the one reason that is not a fault.
    const halfFigure = Math.min(...aimed.widths) / 2;
    const onTarget = aimed.seen.length > 0 && aimed.seen.every(p => p.worst < halfFigure);
    check('PARRY: the readout lands on the figure, not where the figure used to be',
      laid && onTarget && aimed.seen.every(p => {
        const [was, now] = p.key.split('>');
        return +was > +now;
      }),
      JSON.stringify(aimed) + ' — the numbers and words are DOM and the beat '
        + 'gate proves what they SAY; only here is there a projected figure for '
        + 'them to miss');
  }

  console.log('\n── a place that is not the fight ──');
  {
    const lent = await J(async () => {
      window.R.newRun({ seed: 5 });
      await new Promise(r => setTimeout(r, 260));
      const st = window.R.state();
      st.embers = 9; st.tier = 2;
      window.R.sitDown();
      return true;
    });
    await sleep(2600);
    const at = await J(() => {
      const cv = document.getElementById('k-cast3d');
      const S = window.Cast3D._state();
      const seen = {};
      for (const id of ['ash', 'elin', 'mira']) {
        const f = window.Cast3D._figure(id);
        seen[id] = f ? { vis: f.root.visible,
                         x: +f.root.position.x.toFixed(2),
                         z: +f.root.position.z.toFixed(2) } : null;
      }
      const door = document.querySelector('#k-camp .k-ctdoor[data-door="mira"]');
      return { scene: window.Cast3D.sceneName(),
               host: cv && cv.parentNode ? cv.parentNode.id : null,
               wide: cv ? Math.round(cv.getBoundingClientRect().width) : 0,
               mode: document.getElementById('k-camp').classList.contains('k-camp-3d'),
               seen: seen, foes: S.foes.length,
               // the room shows through, so the plaza is not drawing
               worldOn: S.worldOn,
               follows: door ? door.style.getPropertyValue('--fx') : '' };
    });
    check('SCENE: the fire borrows the canvas and stands the three of them in a ring',
      lent === true && at.scene === 'camp' && at.host === 'k-camp-cast' && at.wide > 400 && at.mode
      && ['ash', 'elin', 'mira'].every(id => at.seen[id] && at.seen[id].vis)
      // a ring, not a line: they do not share a depth the way the party does
      && new Set(['ash', 'elin', 'mira'].map(id => at.seen[id].z)).size === 3
      && at.foes === 0 && /px$/.test(at.follows) && at.worldOn === false,
      JSON.stringify(at));

    const back = await J(async () => {
      window.R.leaveCamp();
      await new Promise(r => setTimeout(r, 200));
      const cv = document.getElementById('k-cast3d');
      return { scene: window.Cast3D.sceneName(),
               host: cv && cv.parentNode ? cv.parentNode.id : null,
               mode: document.getElementById('k-camp').classList.contains('k-camp-3d'),
               worldOn: window.Cast3D._state().worldOn };
    });
    // THE ONE THAT WOULD RUIN A RUN. A canvas left parented into a hidden
    // screen means the next fight opens onto an empty stage — and the way back
    // is not always `leaveCamp`, so `screen()` does it for every path.
    check('SCENE: …and the battlefield gets it back, with the world switched on',
      back.scene === null && back.host === 'k-cast' && !back.mode
      && back.worldOn === true,
      JSON.stringify(back));
  }

  await shot('cast3d');
  const out = report();
  await browser.close();
  process.exit(out.passed === out.total && out.errs === 0 ? 0 : 1);
})();
