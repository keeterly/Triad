// KIZUNA v2.3 — the BEAT instrument. What does a turn actually FEEL like?
//
// Every other sim asks whether the numbers are fair. This one asks the only
// question a player asks in the first thirty seconds: when I do a thing, does
// the game tell me it happened, and does it give me time to see it?
//
// It records a TIMELINE of what is OBSERVABLE — not the constants in the
// source, which lie about what the player perceives (a 620ms flight that
// starts 300ms after the click is a 920ms wait), but the moments the screen
// actually changes: a card leaves the hand, a damage number is painted, a
// health bar moves, control comes back.
//
// From that timeline it reports the two ways a beat can be wrong:
//   SILENCE  — you acted, and for this long nothing on screen changed
//   BLUR     — two things the player needs to read separately landed within
//              a frame or two of each other, so only the later one registers
//   DEAD AIR — a stretch during which nothing changed at all and you could
//              not act either
//
// Not a gate. A measurement. Prints a table and exits 0.
'use strict';
const { boot } = require('./harness.cjs');

const RUNS = +(process.env.BEAT_RUNS || 3);

// The watchers: what on screen the player reads, and what to call it when it
// moves. Each is a pure read of the live DOM, sampled every animation frame.
const PROBES = `
(function(){
  if (window.__beat) { window.__beat.log.length = 0; return true; }
  window.__beat = { t0: performance.now(), log: [], last: {} };
  const txt = id => { const e = document.getElementById(id); return e ? e.textContent.trim() : null; };
  const beatProbes = {
    hand:      () => document.querySelectorAll('#k-hand .k-card').length,
    ap:        () => txt('k-ap-num'),
    bossHp:    () => { const e = document.getElementById('k-bhp-fill'); return e ? e.style.width : null; },
    bossBreak: () => txt('k-break'),
    kizuna:    () => txt('k-kz-n'),
    intent:    () => { const e = document.getElementById('k-intent'); return e ? e.textContent.trim().slice(0, 60) : null; },
    turn:      () => txt('k-turn-n'),
    heroHp:    () => [...document.querySelectorAll('#k-party-hud .k-pt-hp')].map(e => e.textContent.replace(/\\s+/g, '')).join('|'),
    // the big painted number is the ONLY thing that tells a player how hard a
    // blow was; if it never appears the hit did not communicate
    pops:      () => document.querySelectorAll('.k-pop').length,
    flash:     () => document.querySelectorAll('.k-hitflash, .k-shock, .k-pulse').length,
    // the choreography, not just the bookkeeping — is anybody MOVING?
    acting:    () => [...document.querySelectorAll('.k-hero, #k-boss-art')]
                       .filter(e => /k-(stepping|striking|acting|recoil|hurt|cast)/.test(e.className)).length,
    log:       () => txt('k-log'),
    // the marquee mechanic. The notes on screen are RINGS (.k-pring); the
    // stage wears .k-parry-focus for the length of the bar and .k-slowmo for
    // the moment a note is tappable. A first pass probed .k-note — a class
    // that is styled but never on screen — and reported the whole parry bar as
    // five seconds of dead air. It is not: it is the best thing in the game.
    parry:     () => document.querySelectorAll('.k-pring').length,
    parryBar:  () => document.getElementById('k-stage').classList.contains('k-parry-focus') ? 1 : 0,
    slowmo:    () => document.getElementById('k-stage').classList.contains('k-slowmo') ? 1 : 0,
    grade:     () => document.querySelectorAll('.k-grade').length,
    // the most-repeated gesture in the game: does the card answer the finger?
    lifted:    () => document.querySelectorAll('#k-hand .k-card.k-dragging, #k-hand .k-card.k-aiming, #k-hand .k-card.k-sel').length,
    aim:       () => document.querySelectorAll('.k-aimbeam, .k-aimdot, .k-reticle, [class*="k-aim"]').length,
    dropOk:    () => document.querySelectorAll('.k-drop-ok, .k-row-ok, .k-tgt-ok').length,
    // the moment the user screenshotted: the husk falling, the board standing
    // down, and the party turning to talk over it
    foeDown:   () => document.querySelector('#k-boss-art') && document.getElementById('k-boss-art').classList.contains('k-foe-down') ? 1 : 0,
    reckOn:    () => document.getElementById('k-stage').classList.contains('k-reckoning') ? 1 : 0,
    reckWho:   () => txt('k-reck-who'),
    reckFork:  () => document.querySelectorAll('.k-rk-opt').length,
    onRoad:    () => document.getElementById('k-map') && !document.getElementById('k-map').classList.contains('k-hidden') ? 1 : 0,
    endturn:   () => txt('k-endturn'),
    // can the player ACT? the end-turn button live and at least one card
    // reachable is the only honest definition of "it is my turn"
    canAct:    () => {
      const et = document.getElementById('k-endturn');
      const live = et && !et.disabled && !et.classList.contains('k-hidden')
                   && getComputedStyle(et).pointerEvents !== 'none';
      return live ? 1 : 0;
    },
  };
  window.__beatMark = (tag) => window.__beat.log.push({ t: performance.now() - window.__beat.t0, k: 'MARK', v: tag });
  (function tick() {
    const B = window.__beat;
    for (const k in beatProbes) {
      let v = null;
      try { v = beatProbes[k](); } catch (e) {}
      const s = JSON.stringify(v);
      if (B.last[k] === undefined) { B.last[k] = s; continue; }
      if (B.last[k] !== s) { B.log.push({ t: performance.now() - B.t0, k, v: s }); B.last[k] = s; }
    }
    requestAnimationFrame(tick);
  })();
  return true;
})();
`;

const pad = (s, n) => String(s).padEnd(n);
const num = (v, n = 6) => String(Math.round(v)).padStart(n);

(async () => {
  const H = await boot({ query: 'road=1&realtime=1' });
  const { J, sleep, page } = H;

  // every episode's timeline, keyed by what the player just did
  const episodes = [];

  for (let r = 0; r < RUNS; r++) {
    const seed = 4100 + r * 271;
    await J((s) => { window.R.newRun(s); return true; }, seed);
    // walk to the first fight and open it
    const opened = await J(() => {
      // walk forward until a fight or elite is the stop we are standing on
      for (let step = 0; step < 8; step++) {
        const reach = window.R.reachable();
        const map = window.R.map();
        const want = reach.find(id => {
          const n = map.find(m => m.id === id);
          return n && (n.kind === 'fight' || n.kind === 'elite');
        });
        if (want) { window.R.travel(want); return true; }
        if (!reach.length) return false;
        window.R.travel(reach[0]);
      }
      return false;
    });
    if (!opened) continue;
    await sleep(900);

    await page.evaluate(PROBES);

    // ── EPISODE 1: play a card the way a player does — a real drag ──
    const boxes = await J(() => {
      // the card has to be one the foe can actually receive — a heal dragged
      // onto the Regent lifts and is then refused, which measured as "nothing
      // resolved" for reasons nothing to do with the game's timing
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
      return { from: [r.left + r.width / 2, r.top + r.height / 2],
               to:   [q.left + q.width / 2, q.top + q.height / 2] };
    });
    if (boxes) {
      await page.mouse.move(boxes.from[0], boxes.from[1]);
      await sleep(60);
      await J(() => { window.__beatMark('PRESS:card'); return true; });
      await page.mouse.down();
      // drag in real steps — the handler arms on a genuine press and reads
      // the delta, so a teleport is not the same gesture a thumb makes
      for (let k = 1; k <= 12; k++) {
        await page.mouse.move(
          boxes.from[0] + (boxes.to[0] - boxes.from[0]) * k / 12,
          boxes.from[1] + (boxes.to[1] - boxes.from[1]) * k / 12);
        await sleep(16);
      }
      await sleep(80);
      await J(() => { window.__beatMark('DROP:card'); return true; });
      await page.mouse.up();
      await sleep(2600);
      episodes.push(await J(() => {
        const l = window.__beat.log.slice(); window.__beat.log.length = 0; return { what: 'play a card', log: l };
      }));
    }

    // ── EPISODE 2: end the turn. click -> the foe acts -> control returns ──
    const eb = await J(() => {
      const e = document.getElementById('k-endturn');
      if (!e) return null;
      const r = e.getBoundingClientRect();
      window.__beatMark('CLICK:endturn');
      return [r.left + r.width / 2, r.top + r.height / 2];
    });
    if (eb) {
      // END TURN ARMS before it fires when AP is left — the confirm is a
      // second press, so a player's real gesture is click, read, click
      await page.mouse.click(eb[0], eb[1]);
      await sleep(500);
      await page.mouse.click(eb[0], eb[1]);
      await sleep(17000);
      episodes.push(await J(() => {
        const l = window.__beat.log.slice(); window.__beat.log.length = 0; return { what: 'end the turn', log: l };
      }));
    }

    // ── EPISODE 3: the kill. The one the note was about — how long between
    // the enemy dying and being asked to talk about it. Driven straight at
    // the engine because a fight walked to its natural end takes minutes in
    // realtime, and it is the SHAPE after the killing blow we are timing.
    const killed = await J(() => {
      if (!window.K.state() || window.K.state().phase === 'VICTORY') return false;
      window.__beatMark('KILL:blow');
      window.K._dealToBoss(9999, 'test', 'ash');
      return true;
    });
    if (killed) {
      await sleep(9000);
      episodes.push(await J(() => {
        const l = window.__beat.log.slice(); window.__beat.log.length = 0; return { what: 'the kill', log: l };
      }));
    }
  }

  await H.browser.close();

  // ── read the timelines ──
  console.log('\n══ THE BEAT: what the screen does after you act ══\n');

  const gaps = {};   // what -> [silence after each MARK]
  const air = {};    // what -> [longest stretch with nothing and no input]

  for (const ep of episodes) {
    const L = ep.log;
    if (!L.length) continue;
    for (let i = 0; i < L.length; i++) {
      if (L[i].k !== 'MARK') continue;
      const next = L.slice(i + 1).find(e => e.k !== 'MARK' && e.k !== 'canAct');
      const key = ep.what + ' · ' + L[i].v.replace('CLICK:', '');
      (gaps[key] = gaps[key] || []).push(next ? next.t - L[i].t : Infinity);
    }
    // the longest stretch with no visible change
    let worst = 0, at = null;
    for (let i = 1; i < L.length; i++) {
      const d = L[i].t - L[i - 1].t;
      if (d > worst) { worst = d; at = L[i - 1].k + ' -> ' + L[i].k; }
    }
    (air[ep.what] = air[ep.what] || []).push([worst, at]);
  }

  const med = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };

  console.log('  ── SILENCE: you clicked, and the screen said nothing for ──\n');
  for (const k of Object.keys(gaps)) {
    const m = med(gaps[k]);
    const verdict = !Number.isFinite(m) ? 'NOTHING EVER HAPPENED'
      : m > 260 ? 'the click feels dropped'
      : m > 120 ? 'noticeable' : 'immediate';
    console.log('  ' + pad(k, 28) + num(m) + 'ms   ' + verdict);
  }

  console.log('\n  ── DEAD AIR: the longest stretch with nothing to watch ──\n');
  for (const k of Object.keys(air)) {
    const m = med(air[k].map(x => x[0]));
    const where = air[k].sort((a, b) => b[0] - a[0])[0];
    console.log('  ' + pad(k, 28) + num(m) + 'ms   worst ' + Math.round(where[0]) + 'ms at ' + where[1]);
  }

  console.log('\n  ── BLUR: things that landed inside the same 80ms ──\n');
  const blurs = {};
  for (const ep of episodes) {
    const L = ep.log.filter(e => e.k !== 'MARK' && e.k !== 'canAct');
    for (let i = 1; i < L.length; i++) {
      if (L[i].t - L[i - 1].t < 80) {
        const key = [L[i - 1].k, L[i].k].sort().join(' + ');
        blurs[key] = (blurs[key] || 0) + 1;
      }
    }
  }
  const bl = Object.entries(blurs).sort((a, b) => b[1] - a[1]);
  if (!bl.length) console.log('    none — every reading got its own moment');
  for (const [k, n] of bl.slice(0, 10)) console.log('  ' + pad(k, 34) + num(n, 4) + '×');

  if (process.env.BEAT_RAW) {
    console.log('\n  ── the raw timeline ──');
    for (const ep of episodes.slice(0, 3)) {
      console.log('\n  · ' + ep.what);
      let prev = 0;
      for (const e of ep.log) {
        const d = e.t - prev; prev = e.t;
        console.log('    ' + num(e.t, 6) + 'ms  (+' + num(d, 5) + ')  ' + pad(e.k, 10) + ' ' + String(e.v).slice(0, 46));
      }
    }
  }

  console.log('\n  A beat the player cannot see did not happen. A beat they cannot');
  console.log('  act through is a beat they are waiting out.\n');
})();
