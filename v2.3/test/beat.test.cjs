// KIZUNA v2.3 — THE BEAT GATE. Does the game give the player time to read it?
//
// This suite exists because every other suite is BLIND TO TIMING BY
// CONSTRUCTION. `?test=1` caps every sleep at 24ms so two hundred fights can be
// gated in a minute, which is right for a gate on RULES and useless for a gate
// on FEEL — under it the enemy's four-hit volley resolves in 79ms and the
// killing blow and the corpse arrive in the same frame. An instrument pointed
// at the test build reported both as defects; the shipping build had neither.
//
// So this one boots `?realtime=1`: test mode's determinism — fixed seed, fresh
// run, no music — with the animation's real durations put back. It is slow on
// purpose. It is the only place the choreography is enforced.
//
// What it enforces is ORDER and SPACING, never exact durations: a check that
// pins a beat to the millisecond breaks on every deliberate retune and teaches
// nobody anything. The rule is "two things the player must read separately do
// not arrive in the same frame."
'use strict';
const { boot } = require('./harness.cjs');

// The recorder. Samples the readable screen every animation frame and logs the
// moment anything changes, so a beat can be timed by what was VISIBLE rather
// than by what the source claims it slept for.
const PROBES = `
(function(){
  if (window.__beat) { window.__beat.log.length = 0; return true; }
  window.__beat = { t0: performance.now(), log: [], last: {} };
  const txt = id => { const e = document.getElementById(id); return e ? e.textContent.trim() : null; };
  const P = {
    hand:     () => document.querySelectorAll('#k-hand .k-card').length,
    ap:       () => txt('k-ap-num'),
    heroHp:   () => [...document.querySelectorAll('#k-party-hud .k-pt-hp')].map(e => e.textContent.replace(/\\s+/g, '')).join('|'),
    pops:     () => document.querySelectorAll('.k-pop').length,
    lifted:   () => document.querySelectorAll('#k-hand .k-card.k-dragging, #k-hand .k-card.k-aiming').length,
    foeDown:  () => document.getElementById('k-boss-art').classList.contains('k-foe-down') ? 1 : 0,
    reckOn:   () => document.getElementById('k-stage').classList.contains('k-reckoning') ? 1 : 0,
    parryBar: () => document.getElementById('k-stage').classList.contains('k-parry-focus') ? 1 : 0,
  };
  window.__beatMark = (tag) => window.__beat.log.push({ t: performance.now() - window.__beat.t0, k: 'MARK', v: tag });
  (function tick() {
    const B = window.__beat;
    for (const k in P) {
      let v = null;
      try { v = P[k](); } catch (e) {}
      const s = JSON.stringify(v);
      if (B.last[k] === undefined) { B.last[k] = s; continue; }
      if (B.last[k] !== s) { B.log.push({ t: performance.now() - B.t0, k, v: s }); B.last[k] = s; }
    }
    requestAnimationFrame(tick);
  })();
  return true;
})();
`;

(async () => {
  const H = await boot({ query: 'road=1&realtime=1' });
  const { J, sleep, page, check, report } = H;

  const take = () => J(() => { const l = window.__beat.log.slice(); window.__beat.log.length = 0; return l; });
  const at = (log, k) => log.filter(e => e.k === k);
  const mark = (log, v) => (log.find(e => e.k === 'MARK' && e.v === v) || {}).t;

  // ── open a fight ──
  await J(() => { window.R.newRun(4100); return true; });
  const opened = await J(() => {
    for (let step = 0; step < 8; step++) {
      const reach = window.R.reachable(), map = window.R.map();
      const want = reach.find(id => { const n = map.find(m => m.id === id); return n && (n.kind === 'fight' || n.kind === 'elite'); });
      if (want) { window.R.travel(want); return true; }
      if (!reach.length) return false;
      window.R.travel(reach[0]);
    }
    return false;
  });
  check('BEAT: a fight opens on the stage to be timed', opened);
  await sleep(900);
  await page.evaluate(PROBES);

  // ── 1. the card answers the finger ──────────────────────────────────────
  // The most-repeated gesture in the game. If the press does not lift the card
  // within a couple of frames the input reads as dropped, and a player who
  // thinks a press was dropped presses again.
  const boxes = await J(() => {
    // THE CARD HAS TO BE ONE THE FOE CAN BE THE TARGET OF. Grabbing whatever
    // sat leftmost in the fan and dragging it onto the Regent lifted the card
    // and then had the drop refused — a heal has no business landing there —
    // so the measurement of "does a played card resolve at once" reported that
    // nothing resolved at all, roughly half the time, for no reason to do with
    // the game's timing.
    const t = document.getElementById('k-boss-art');
    if (!t) return null;
    const q0 = t.getBoundingClientRect();
    const cx = q0.left + q0.width / 2, cy = q0.top + q0.height / 2;
    const c = [...document.querySelectorAll('#k-hand .k-card')].find(e => {
      if (e.classList.contains('k-dead')) return false;
      try { return !!window.K.dropTargetAt(cx, cy, e.dataset.card); } catch (_) { return false; }
    });
    if (!c) return null;
    const r = c.getBoundingClientRect(), q = t.getBoundingClientRect();
    return { from: [r.left + r.width / 2, r.top + r.height / 2], to: [q.left + q.width / 2, q.top + q.height / 2] };
  });
  if (boxes) {
    await page.mouse.move(boxes.from[0], boxes.from[1]);
    await sleep(60);
    await J(() => { window.__beatMark('press'); return true; });
    await page.mouse.down();
    // A REAL THUMB TAKES TIME. Twelve instant moves fired inside one frame
    // did not always arm the drag — the handler reads the delta from a genuine
    // press and a teleport is not the gesture it is written for — so the
    // measurement of the game's most-repeated interaction was itself flaky.
    for (let k = 1; k <= 12; k++) {
      await page.mouse.move(boxes.from[0] + (boxes.to[0] - boxes.from[0]) * k / 12,
                            boxes.from[1] + (boxes.to[1] - boxes.from[1]) * k / 12);
      await sleep(16);
    }
    await sleep(80);
    await J(() => { window.__beatMark('drop'); return true; });
    await page.mouse.up();
    await sleep(2400);
    const L = await take();
    const lift = at(L, 'lifted').find(e => e.v === '1');
    const spent = at(L, 'ap')[0];
    const answer = lift ? lift.t - mark(L, 'press') : Infinity;
    check('BEAT: the card answers the finger inside two frames',
      answer < 120, JSON.stringify({ liftMs: Math.round(answer) }));
    const resolve = spent ? spent.t - mark(L, 'drop') : Infinity;
    check('BEAT: dropping a card resolves it at once, not after a wait',
      resolve < 200, JSON.stringify({ resolveMs: Math.round(resolve) }));
  } else {
    check('BEAT: the card answers the finger inside two frames', false, 'no card to press');
    check('BEAT: dropping a card resolves it at once, not after a wait', false, 'no card to press');
  }

  // ── 2. the enemy's turn is READ, not dumped ─────────────────────────────
  const eb = await J(() => {
    const e = document.getElementById('k-endturn'); if (!e) return null;
    const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2];
  });
  const before = await J(() => ({ phase: window.K.state().phase, ap: window.K.state().ap,
                                 turn: window.K.state().turn }));
  // END TURN arms when AP is left and fires on the confirm; with no AP left the
  // first press fires it. Press until the turn actually moves rather than
  // assuming which of the two this is.
  for (let i = 0; i < 3; i++) {
    const moved = await J((t) => window.K.state().turn !== t || window.K.state().phase !== 'PLAYER_READY', before.turn);
    if (moved) break;
    await page.mouse.click(eb[0], eb[1]);
    await sleep(420);
  }
  const after = await J(() => ({ phase: window.K.state().phase, turn: window.K.state().turn }));
  check('BEAT: pressing END TURN hands the turn to the foe', after.phase !== 'PLAYER_READY' || after.turn !== before.turn,
    JSON.stringify({ before, after }));
  await sleep(20000);
  const T = await take();

  // the hand goes one card at a time, not all at once
  const preBar = at(T, 'parryBar').length ? at(T, 'parryBar')[0].t : Infinity;
  const swept = at(T, 'hand').filter(e => e.t < preBar);
  const sweepGaps = swept.slice(1).map((e, i) => e.t - swept[i].t);
  check('BEAT: the hand sweeps into the discard one card at a time',
    swept.length >= 2 && sweepGaps.every(g => g > 40),
    JSON.stringify({ cards: swept.length, gaps: sweepGaps.map(Math.round) }));

  // the parry bar is not dead air — it is the marquee mechanic and it runs
  const barOn = at(T, 'parryBar').find(e => e.v === '1');
  const barOff = at(T, 'parryBar').find(e => e.v === '0' && barOn && e.t > barOn.t);
  check('BEAT: the parry bar holds the enemy turn open rather than skipping it',
    !!(barOn && barOff && barOff.t - barOn.t > 1500),
    JSON.stringify({ barMs: barOn && barOff ? Math.round(barOff.t - barOn.t) : null }));

  // EVERY hero who loses health gets their own frame to lose it in. This is
  // the check the dirge failed: it applied all three shares at once and popped
  // three numbers into one frame, on top of the volley's numbers that had not
  // finished clearing — six figures on screen, and the tax that decides runs
  // was the one thing nobody could read.
  //
  // A FIRST VERSION OF THIS CHECK WAS HOLLOW. It only timed the GAPS between
  // heroHp changes, so the old dirge — which applied all three shares inside
  // one synchronous block — showed up as a single event with a healthy gap on
  // either side and sailed through the very defect the check was written for.
  // It has to read WHAT changed, not just when: a frame that moves two heroes
  // at once is the lump, however well spaced it is from its neighbours.
  const hurts = at(T, 'heroHp');
  const hurtGaps = hurts.slice(1).map((e, i) => e.t - hurts[i].t);
  const hpOf = (s) => JSON.parse(s).split('|').map(x => +(x.match(/^(\d+)/) || [0, 0])[1]);
  let lumped = 0;
  for (let i = 1; i < hurts.length; i++) {
    const a = hpOf(hurts[i - 1].v), b = hpOf(hurts[i].v);
    if (a.filter((n, ix) => n !== b[ix]).length > 1) lumped++;
  }
  check('BEAT: no two heroes lose health in the same frame — every blow gets its own beat',
    hurts.length >= 2 && hurtGaps.every(g => g > 90) && lumped === 0,
    JSON.stringify({ blows: hurts.length, lumpedFrames: lumped, gaps: hurtGaps.map(Math.round) }));

  // and the screen never carries more numbers than a person can read at once
  const peak = Math.max(0, ...at(T, 'pops').map(e => +e.v));
  check('BEAT: the screen never stacks more damage numbers than can be read',
    peak <= 4, JSON.stringify({ peak }));

  // ── 3. the death gets its beat, and the reckoning waits for it ──────────
  await J(() => { window.__beatMark('kill'); window.K._dealToBoss(9999, 'test', 'ash'); return true; });
  await sleep(6000);
  const D = await take();
  const blow = mark(D, 'kill');
  const fell = at(D, 'foeDown').find(e => e.v === '1');
  const reck = at(D, 'reckOn').find(e => e.v === '1');
  check('BEAT: the killing blow reads before the body starts to fall',
    !!fell && fell.t - blow > 250,
    JSON.stringify({ holdMs: fell ? Math.round(fell.t - blow) : null }));
  check('BEAT: the party does not start talking until the foe is on the ground',
    !!(reck && fell) && reck.t - fell.t > 600 && reck.t - blow > 1200,
    JSON.stringify({ blowToReck: reck ? Math.round(reck.t - blow) : null,
                     fallToReck: reck && fell ? Math.round(reck.t - fell.t) : null }));

  const r = report();
  await H.browser.close();
  process.exit(r.passed === r.total && !r.errs ? 0 : 1);
})();
