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
    heroHp:   () => [...document.querySelectorAll('.k-vit-us .k-vit-num')].map(e => e.textContent.replace(/\\s+/g, '')).join('|'),
    pops:     () => document.querySelectorAll('.k-pop').length,
    lifted:   () => document.querySelectorAll('#k-hand .k-card.k-dragging, #k-hand .k-card.k-aiming').length,
    foeDown:  () => document.getElementById('k-boss-art').classList.contains('k-foe-down') ? 1 : 0,
    reckOn:   () => document.getElementById('k-stage').classList.contains('k-reckoning') ? 1 : 0,
    parryBar: () => document.getElementById('k-stage').classList.contains('k-parry-focus') ? 1 : 0,
    call:     () => document.querySelector('.k-allout-call') ? 1 : 0,
    striking: () => document.querySelectorAll('.k-hero.k-charging').length,
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

  // THE HAND GOES ONE CARD AT A TIME, and it is now timed by the hand rather
  // than by the parry bar. This took every hand event BEFORE the bar opened,
  // which worked only while the sweep was awaited ahead of the enemy phase.
  // Build 94 stopped awaiting it — it plays under the foe drawing breath, which
  // is 0.78s off an enemy turn measured at 7.95s — so all but the first card
  // now leaves while the bar is up, and the check saw one card and no gaps.
  // What it is asserting is that the count comes DOWN in steps, so it follows
  // the count down and stops where the draw starts putting cards back.
  const handRun = at(T, 'hand').map(e => ({ t: e.t, n: +JSON.parse(e.v) }));
  const swept = [];
  for (const e of handRun) {
    if (swept.length && e.n >= swept[swept.length - 1].n) break;   // the draw begins
    swept.push(e);
  }
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

  // ── 4. A BAR THAT IS ABANDONED TAKES ITSELF DOWN (Build 210) ────────────
  //
  // Reported off a phone: a dashed ring and its SIGIL label parked in the
  // top-left corner of the board, over the party stack, while a live bar played
  // in the middle of the screen. Ghost furniture from a bar that never finished.
  //
  // `runVolleyRhythm` tore itself down on its LAST LINE — the press listener,
  // the re-anchor loop, the beat pulse, the held lens, the parry focus. That is
  // a promise that holds only while nothing throws. One rejected note and the
  // await never returns, so none of it runs: the loop that moves the rings is
  // cancelled, no ring is ever removed, and every one of them is stranded where
  // it happened to be.
  //
  // MEASURED BOTH WAYS. On the Build 209 file this reads
  // {rings:1, beat:true, parrying:1, focus:true} — a real ring left on the
  // stage at a fixed pixel with nothing moving it.
  //
  // The bar is abandoned the way it actually breaks: a note throws mid-volley.
  // The FIRST note plays normally so a ring is open when the second one fails,
  // which is the state the photograph shows.
  const ghosts = await J(async () => {
    if (typeof window.runVolleyRhythm !== 'function') return { noFn: true };
    const realCast = window.castPlay;
    let n = 0, threw = false;
    window.castPlay = function () {
      if (++n < 2) return realCast.apply(this, arguments);
      threw = true; throw new Error('abandon the bar');
    };
    let rejected = false;
    try {
      await window.runVolleyRhythm(
        [{ notes: ['tap'], src: 0 }, { notes: ['tap'], src: 0 }], ['ash', 'mira'], 1);
    } catch (e) { rejected = true; }
    window.castPlay = realCast;
    await new Promise(z => setTimeout(z, 400));
    const st = document.getElementById('k-stage');
    return { rejected, threw,
             rings: document.querySelectorAll('.k-pring').length,
             beat: !!document.getElementById('k-beat'),
             parrying: document.querySelectorAll('.k-hero.k-parrying').length,
             focus: !!(st && st.classList.contains('k-parry-focus')) };
  });
  check('BEAT: a parry bar that is abandoned leaves nothing of itself on the board',
    ghosts.rejected && ghosts.threw && ghosts.rings === 0 && !ghosts.beat
      && ghosts.parrying === 0 && !ghosts.focus,
    JSON.stringify(ghosts) + ' — a note throws mid-volley, so the bar rejects '
      + 'instead of finishing. Every ring, the beat pulse, the held lens and the '
      + 'parrying flag must go with it; on the build this was reported against, '
      + 'all four survived');

  // ── DID THE PARRY WORK? ───────────────────────────────────────────────────
  //
  // Playtested as "hard to tell if parrying worked", and the reason was
  // measurable rather than a matter of taste. Answering every note of a volley
  // and being graded GOOD on all of them took 15 where leaving the screen alone
  // took 18 — and the two frames were indistinguishable: six red numbers either
  // way, and three receipts that both read "0/2 turned — the rest gets through",
  // because `kept` counts GREAT-or-better and a whole string read late counts
  // zero of them.
  //
  // Two things now separate them, and this is what holds them apart:
  //   the RECEIPT names what the hands caught, so a read is never printed as a
  //   miss; and the NUMBER carries the blow it would have been, struck through
  //   above the one that landed, so the player has something to measure their
  //   own hands against. A blow turned aside prints a nothing rather than
  //   nothing at all.
  const proof = await J(async () => {
    const out = {};
    const run = async (grade) => {
      window.K.startCombat({ seed: 21 });
      window.K.forceIntent('hymn');
      const seen = { receipts: [], was: [], pops: [] };
      const watch = setInterval(() => {
        document.querySelectorAll('.k-receipt').forEach(e => {
          const t = e.querySelector('b').textContent.trim();
          if (seen.receipts.indexOf(t) < 0) seen.receipts.push(t);
        });
        document.querySelectorAll('.k-pop').forEach(e => {
          const w = e.querySelector('.k-pop-was');
          const key = (w ? w.textContent + '>' : '') + e.lastChild.textContent;
          if (seen.pops.indexOf(key) < 0) seen.pops.push(key);
          if (w && seen.was.indexOf(key) < 0) seen.was.push(key);
        });
      }, 30);
      const r = await window.K.endTurn({ grades: (window.K.currentIntent().hits || [])
        .flatMap(h => h.notes.map(() => grade)) });
      await new Promise(z => setTimeout(z, 500));
      clearInterval(watch);
      return { taken: r.taken, ...seen };
    };
    out.good = await run('good');
    out.miss = await run('miss');
    out.great = await run('great');
    return out;
  });
  check('PARRY: a string read late is not reported as a string missed',
    proof.good.receipts.length > 0 && proof.miss.receipts.length > 0
    && proof.good.receipts.join() !== proof.miss.receipts.join()
    && !/^0\//.test(proof.good.receipts[0]),
    JSON.stringify({ read: proof.good.receipts, missed: proof.miss.receipts })
      + ' — both of these used to say "0/2 turned"');
  check('PARRY: the number carries the blow it would have been, struck through',
    proof.good.was.length > 0 && proof.good.was.every(k => {
      const [was, now] = k.split('>');
      return +was > +now;
    }) && proof.miss.was.length === 0,
    JSON.stringify({ blunted: proof.good.was, whiffed: proof.miss.pops })
      + ' — a blow nothing was done about carries no struck-through number, '
      + 'because there is nothing to compare it to');
  check('PARRY: a blow turned aside prints a nothing, not nothing at all',
    proof.great.was.some(k => k.split('>')[1] === '0'),
    JSON.stringify({ turned: proof.great.was, taken: proof.great.taken })
      + ' — the best outcome in the game was the only one with no readout, '
      + 'which is also what a dropped frame looks like');

  // ── 6. THE ALL-OUT ANNOUNCES ITSELF, THEN THEY MOVE (Build 234) ─────────
  //
  // The call and the three strikes started in the SAME FRAME, and the call's
  // keyframe ran 1100ms against a stagger that was over in 870 — so the one
  // moment in the game built to be watched played out entirely underneath 26px
  // of glowing capitals with a 60px bloom on it, on a camera that had just
  // pushed in to fill the frame with the people it was covering.
  //
  // THIS BELONGS IN THIS SUITE AND NOWHERE ELSE. A first cut of it lived in
  // flow, which caps every sleep at 24ms — so the announce it was written to
  // measure collapsed to one frame, the sampler got five readings across the
  // whole all-out, and the check reported an overlap that was the harness's
  // fast-forward rather than the game's. The claim is about a shape in time;
  // only the realtime suite can see one.
  await J(() => { window.K.startCombat({ seed: 7, foes: ['husk', 'cultist'] });
                  window.K.state().kizuna = 100; window.K.render(); return true; });
  await sleep(700);
  await take();                                  // start the log clean
  await J(() => { window.K.allOut(); return true; });   // deliberately not awaited
  await sleep(6000);
  const A = await take();
  const callOn = at(A, 'call').find(e => e.v === '1');
  const callOff = at(A, 'call').find(e => e.v === '0' && callOn && e.t > callOn.t);
  const hitOn = at(A, 'striking').find(e => +JSON.parse(e.v) > 0);
  check('BEAT: the all-out announces itself first, and nothing is drawn over the strike',
    !!(callOn && callOff && hitOn)
    && callOff.t - callOn.t > 400            // the word gets the board to itself
    && hitOn.t + 40 >= callOff.t,            // …and nobody swings until it is gone
    JSON.stringify({ wordMs: callOn && callOff ? Math.round(callOff.t - callOn.t) : null,
                     wordGoneAt: callOff ? Math.round(callOff.t) : null,
                     firstSwingAt: hitOn ? Math.round(hitOn.t) : null })
      + ' — `wordGoneAt` is the announce leaving the stage and `firstSwingAt` is '
      + 'the first body committing. They used to be the same instant, which is '
      + 'the difference between announcing a thing and printing it on top of it');

  // ── 7. A READ THAT LANDED HOLDS THE FRAME (Build 236) ───────────────────
  //
  // Time dilated the instant a note became tappable and snapped back the
  // instant it was answered — so the dilation covered the WAITING and never the
  // payoff, and the one frame a player earned by reading a blow correctly was
  // the first frame played at full speed. And the deflect that proves the read
  // fired at the END of the volley, out of the string's verdict, over a hero
  // who had gone back to standing there seconds earlier.
  //
  // Both are one claim and it is a claim about a FRAME: there must be a frame
  // carrying the deflect and the dilation at once. On the pre-236 build that
  // frame cannot exist — `parrySlowmo(false)` ran before the grade was drawn,
  // and no deflect was thrown per note at all — so this fails twice over there.
  //
  // The bar is answered by hand: every ring publishes the timestamp it lands
  // on (`data-impact`, which the bots already aim at), so a press scheduled for
  // that instant is a real read rather than a grade written into the state.
  const held = await J(async () => {
    const st = document.getElementById('k-stage');
    const seen = { frames: 0, both: 0, deflect: 0, slow: 0 };
    let stop = false;
    (function tick() {
      if (stop) return;
      seen.frames++;
      const d = st.querySelectorAll('.k-deflect').length > 0;
      const s = st.classList.contains('k-slowmo');
      if (d) seen.deflect++;
      if (s) seen.slow++;
      if (d && s) seen.both++;
      requestAnimationFrame(tick);
    })();
    window.K.startCombat({ seed: 21 });
    window.K.forceIntent('hymn');
    const turn = window.K.endTurn();
    const armed = {};
    const poll = setInterval(() => {
      st.querySelectorAll('.k-pring[data-impact]').forEach(r => {
        const id = (r.dataset.hero || '') + ':' + (r.dataset.n || '') + ':' + r.dataset.impact;
        if (armed[id]) return;
        const wait = (+r.dataset.impact) - performance.now();
        if (wait > 500 || wait < -200) return;
        armed[id] = 1;
        setTimeout(() => {
          const b = r.getBoundingClientRect();
          st.dispatchEvent(new PointerEvent('pointerdown',
            { clientX: b.left, clientY: b.top, bubbles: true }));
          st.dispatchEvent(new PointerEvent('pointerup',
            { clientX: b.left, clientY: b.top, bubbles: true }));
        }, Math.max(0, wait));
      });
    }, 20);
    const res = await turn;
    clearInterval(poll); stop = true;
    return { ...seen, grades: (res.grades || []).join(',') };
  });
  const read = held.grades.split(',').filter(g => g === 'perfect' || g === 'great').length;
  check('BEAT: a note read GREAT or better throws its deflect inside the frame it slowed',
    read > 0 && held.deflect > 0 && held.both > 0,
    JSON.stringify(held) + ' — `both` is frames carrying the deflect AND the '
      + 'dilation at once. The bar was answered by pressing on each ring\u2019s own '
      + 'published impact time, so the grades are a real read. Before Build 236 '
      + 'the dilation was released before the grade was drawn and the deflect '
      + 'belonged to the end of the volley, so `both` was zero by construction');

  // ── 8. THEY GO ONE AT A TIME (Build 238) ────────────────────────────────
  //
  // Reported: "they should act one after another not at the same time". Both
  // the all-out and a pair card staggered their second and third actors by
  // 190ms and 200ms — numbers chosen against a swing that was a windowed
  // procedural clip, and the Unreal acts run about 600. So the second body
  // started while the first was still winding up, and three of them read as one
  // chord with a smear on the front rather than as a phrase.
  //
  // Measured off `.k-acts` and `.k-charging` — the classes each hero wears for
  // its own act — because "one after another" is a claim about WHEN each body
  // commits, and that is the moment those land. The all-out gets its announce
  // beat checked with it: the word has to clear, and then the board has to be
  // empty for a moment, before anybody moves.
  const relay = await J(async () => {
    const st = document.getElementById('k-stage');
    const t0 = () => performance.now();
    const watch = (sel, cls) => {
      const seen = {};
      const tick = setInterval(() => {
        st.querySelectorAll(sel).forEach(h => {
          if (h.classList.contains(cls) && seen[h.dataset.hero] == null) {
            seen[h.dataset.hero] = Math.round(performance.now() - start);
          }
        });
      }, 8);
      return { seen, stop: () => clearInterval(tick) };
    };
    let start = t0();
    // ── the all-out ──
    window.K.startCombat({ seed: 21 });
    const s = window.K.state(); s.kizuna = 100; s.boss.hp = 900; window.K.render();
    start = t0();
    const w1 = watch('.k-hero', 'k-charging');
    let wordAt = null, wordGone = null;
    const wt = setInterval(() => {
      const on = !!st.querySelector('.k-allout-call');
      if (on && wordAt == null) wordAt = Math.round(performance.now() - start);
      if (!on && wordAt != null && wordGone == null) wordGone = Math.round(performance.now() - start);
    }, 8);
    await window.K.allOut();
    w1.stop(); clearInterval(wt);
    const out = Object.keys(w1.seen).map(k => w1.seen[k]).sort((a, b) => a - b);

    // ── a pair card ──
    window.K.startCombat({ seed: 21 });
    // WHICH CARD IS A PAIR is a fact the game already draws: `isPairCard`
    // puts `k-card-res` on the face. Reading it off the rendered hand asks the
    // game rather than re-deriving its rule in the test.
    const res = document.querySelector('#k-hand .k-card.k-card-res');
    const pair = res ? res.dataset.card : null;
    let duo = null;
    if (pair) {
      start = t0();
      const w2 = watch('.k-hero', 'k-acts');
      await window.K.playCard(pair);
      await new Promise(z => setTimeout(z, 1600));
      w2.stop();
      duo = Object.keys(w2.seen).map(k => w2.seen[k]).sort((a, b) => a - b);
    }
    return { out, wordAt, wordGone, duo, pair: pair || null };
  });
  const gaps = (a) => (a || []).slice(1).map((t, i) => t - a[i]);
  const outGaps = gaps(relay.out);
  check('BEAT: the all-out announces, the board breathes, and then they go one at a time',
    relay.out.length >= 2 && relay.wordGone != null
    && relay.out[0] >= relay.wordGone            // nobody moves while the word is up
    && relay.out[0] - relay.wordGone > 200       // …and the board holds, empty, first
    && outGaps.every(g => g > 380),              // an act is about 600; this is a relay
    JSON.stringify({ word: [relay.wordAt, relay.wordGone], commits: relay.out, gaps: outGaps })
      + ' — `commits` is when each hero took `k-charging`, from the press. They '
      + 'used to be 190ms apart, which against a 600ms act is three people '
      + 'swinging at once');
  const duoGaps = gaps(relay.duo);
  check('BEAT: …and a pair card is two people, one after the other',
    !relay.pair || (relay.duo && relay.duo.length === 2 && duoGaps[0] > 380),
    JSON.stringify({ card: relay.pair, commits: relay.duo, gap: duoGaps[0] })
      + ' — 200ms was the old relay, which put the second hero into the first '
      + 'one\u2019s wind-up. No pair card in the opening hand is a pass: the '
      + 'claim is about the ones that exist, not about drawing one');

  // ═══ THE FREEZE DOES NOT FREEZE THE READOUT (Build 239) ═══
  console.log('\n── what the impact says ──');
  // ── WHY THIS COULD NOT HAVE BEEN CAUGHT ────────────────────────────────
  //
  // `.k-frozen` — the hitstop — pauses `animation-play-state` on the stage and
  // EVERY DESCENDANT. `fxImpact` and `fxDeflect` each call `hitstop()`
  // themselves, so both were freezing the readout that says what the blow did:
  // a damage number whose first keyframe is `opacity: 0` spent the whole freeze
  // invisible, and the deflect's 460ms crescent sweep was held for 175ms inside
  // an element removed at 720ms.
  //
  // No existing check could see it. Every suite drives volleys with
  // `opts.grades`, which sets `onGraded` to null ON PURPOSE — so the per-note
  // path Build 236 added has never once been exercised by a gate. This is the
  // blind spot, closed.
  //
  // The instrument is `animation.currentTime`, not computed opacity: it advances
  // in animation time whether or not this machine painted a frame, so "did the
  // number's life advance while the world was frozen" is machine-independent.
  const thaw = await J(() => new Promise(res => {
    const st = document.getElementById('k-stage');
    window.K._fxNoteStruck('ash', 7);            // a note that got through
    const pop = st.querySelector('.k-pop');
    const a = pop && pop.getAnimations()[0];
    if (!a) return res({ err: 'no animation on the damage number' });
    const frozenAtBirth = st.classList.contains('k-frozen');
    const t0 = a.currentTime || 0;
    // wait out a few real frames and ask the animation, not the pixels
    let n = 0;
    const tick = () => {
      if (++n < 8) return requestAnimationFrame(tick);
      res({ frozenAtBirth,
            stillFrozen: st.classList.contains('k-frozen'),
            state: a.playState,
            advancedMs: Math.round((a.currentTime || 0) - t0) });
    };
    requestAnimationFrame(tick);
  }));
  check('IMPACT: the number a blow prints is not frozen by that blow\'s own hitstop',
    !thaw.err && thaw.frozenAtBirth && thaw.state === 'running' && thaw.advancedMs > 0,
    JSON.stringify(thaw) + ' — `frozenAtBirth` must be true or the check is '
      + 'vacuous: it has to be asked DURING a freeze to mean anything. With the '
      + 'freeze pausing it the clock advanced exactly 0ms, and the number\u2019s '
      + 'whole fade-in (12% of 1.1s) sat behind it');

  const r = report();
  await H.browser.close();
  process.exit(r.passed === r.total && !r.errs ? 0 : 1);
})();
