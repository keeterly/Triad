// KIZUNA v2.3 — THE FEEL PLAYTEST. One map, played at real speed.
//
// Every other harness in this project runs under ?test=1, which caps every
// sleep at 24ms so two hundred fights fit in a minute. That is right for a
// suite and useless here: the question this asks is what a TURN FEELS LIKE,
// and a bar that takes 79ms under test takes four seconds in a hand. So this
// boots ?realtime=1 and walks one map end to end at the speed a player would.
//
// It measures the things game feel is actually made of:
//
//   DECISION DENSITY  how many cards you get to play in a turn, and how many
//                     you could have played — the gap between them is the
//                     difference between a decision and a formality.
//   THE SPLIT         of a turn's wall-clock, how much is you deciding and how
//                     much is you watching. StS is ~all decide; a JRPG is
//                     mostly watch. This game claims to be both.
//   THE READ          how many distinct things the screen asks you to parse
//                     before the one decision.
//   PARRY LOAD        notes per bar and seconds per bar — the input tax on
//                     every enemy turn.
//   DEAD TURNS        turns where the hand offered exactly one legal play.
'use strict';
const { boot } = require('./harness.cjs');

const bar = (n, max, w = 26) => '█'.repeat(Math.round((n / max) * w)).padEnd(w, '·');
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

(async () => {
  const H = await boot({ query: 'road=1&realtime=1' });
  const { J, page } = H;
  const log = [];

  await J(() => {
    window.R.newRun(7);
    const o = window.R.wakeOffer();
    window.R.takeWake((o.find(w => w.kind === 'plain') || o[0]).id);
  });
  await H.sleep(400);

  const map = await J(() => ({
    region: window.R.state().region,
    stops: window.R.map().length,
    kinds: window.R.map().reduce((a, n) => { a[n.kind] = (a[n.kind] || 0) + 1; return a; }, {}),
  }));
  console.log(`\n  THE ROAD — ${map.region.toUpperCase()} · ${map.stops} stops`);
  console.log('  ' + Object.entries(map.kinds).map(([k, n]) => `${n} ${k}`).join(' · '));

  // ── walk ─────────────────────────────────────────────────────────────────
  const turns = [];
  let stops = 0, fights = 0;

  for (let step = 0; step < 14; step++) {
    const at = await J(() => {
      if (window.R.state().over) return { over: window.R.state().over };
      const open = window.R.reachable();
      if (!open.length) return { stuck: true };
      // walk the road the way a player does: take the first open stop
      const n = window.R.map().find(m => m.id === open[0]);
      window.R.travel(n.id);
      return { kind: n.kind, id: n.id };
    });
    if (at.over || at.stuck) break;
    stops++;

    if (at.kind === 'fight' || at.kind === 'elite' || at.kind === 'boss') {
      fights++;
      await H.sleep(900);                       // the fight opens
      // ── play the fight, turn by turn, timing every phase ────────────────
      for (let t = 0; t < 12; t++) {
        const turn = await J(async () => {
          const K = window.K, C = K.state();
          if (!C || C.over) return { done: true };
          for (let i = 0; i < 200 && K.state().phase !== 'PLAYER_READY'; i++) {
            await new Promise(r => setTimeout(r, 25));
          }
          const S = K.state(); if (!S || S.over) return { done: true };

          const t0 = performance.now();
          // WHAT THE SCREEN IS ASKING. Counted before anything is played:
          // every number, letter and label the eye has to take in.
          const reads = document.querySelectorAll(
            '#k-intent .k-ichip, #k-hand .k-card, .k-hero .k-hp, #k-ap .k-ap-pip,'
            + ' #k-kizuna, #k-break .k-pip').length;

          const hand = S.hand.slice();
          const ap0 = S.ap;
          // every card that COULD be played right now — the size of the choice
          const legal = hand.filter(id => K.evaluateCard(id).currentCost <= S.ap);
          // …and of those, how many would land their combo
          const live = legal.filter(id => K.evaluateCard(id).condActive);

          const played = [];
          const decideStart = performance.now();
          // a player spends their AP: greedy, preferring a live combo
          for (let g = 0; g < 4; g++) {
            const st = K.state(); if (!st || st.over) break;
            const can = st.hand.filter(id => K.evaluateCard(id).currentCost <= st.ap);
            if (!can.length) break;
            const best = can.find(id => K.evaluateCard(id).condActive) || can[0];
            await K.playCard(best);
            played.push(best);
            await new Promise(r => setTimeout(r, 40));
          }
          const decideMs = performance.now() - decideStart;

          const watchStart = performance.now();
          const notes = [];
          // the enemy turn — count the bar and how long it holds the screen
          const seen = new Set();
          const watcher = setInterval(() => {
            document.querySelectorAll('.k-pring').forEach(r => {
              const key = r.dataset.kind + ':' + r.dataset.n + ':' + r.dataset.total;
              if (!seen.has(key)) { seen.add(key); notes.push(r.dataset.kind); }
            });
          }, 20);
          await K.endTurn({ skipParry: false });
          clearInterval(watcher);
          const watchMs = performance.now() - watchStart;

          return {
            reads, hand: hand.length, ap: ap0,
            legal: legal.length, live: live.length,
            played: played.length, playedIds: played,
            decideMs: Math.round(decideMs), watchMs: Math.round(watchMs),
            totalMs: Math.round(performance.now() - t0),
            notes,
          };
        });
        // A FIGHT THAT IS OVER STILL ANSWERS. The phase wait times out, the hand
        // is empty, and the loop records a turn of all zeros — ten of them per
        // fight, which drags every average toward nothing. An empty hand with
        // nothing played is not a turn; it is the fight having ended.
        if (turn.done || (turn.legal === 0 && turn.played === 0)) break;
        turns.push(turn);
        await H.sleep(120);
      }
      await H.sleep(500);
      // clear whatever the fight ended into (reckoning, bond scene, swap)
      for (let k = 0; k < 8; k++) {
        const cleared = await J(() => {
          const shot = (id) => { const e = document.getElementById(id);
            return e && !e.classList.contains('k-hidden'); };
          if (shot('k-scene')) {
            for (let i = 0; i < 12; i++) window.R.sceneNext();
            return 'scene';
          }
          if (shot('k-swap')) {
            const b = document.querySelector('.k-swapcard'); if (b) b.click();
            const go = document.getElementById('k-swap-go'); if (go) go.click();
            return 'swap';
          }
          if (shot('k-mark')) {
          // TWO BEATS (Build 104): the moment, then the decision, then the mark.
          (() => {
            // TAKE THE FORK (Build 110): the moment ends on two marks now, and
            // one of them has to be chosen before the cards are offered.
            const f = document.querySelector('#k-mark-fork .k-mkf');
            if (f) { f.click(); return true; }
            const g = document.getElementById('k-mark-go');
            if (g) { g.click(); return true; }
            return false;
          })();
          const mk = [...document.querySelectorAll('#k-mark-cols .k-mk:not([disabled])')];
          if (mk.length) mk[0].click();
          const pl = document.getElementById('k-mark-place');
          if (pl && !pl.disabled) pl.click();
            return 'mark';
          }
          return null;
        });
        if (!cleared) break;
        await H.sleep(320);
      }
    } else {
      // a fire, a memory, a crossroads — clear it and keep walking
      await H.sleep(700);
      for (let k = 0; k < 10; k++) {
        const cleared = await J(() => {
          const shot = (id) => { const e = document.getElementById(id);
            return e && !e.classList.contains('k-hidden'); };
          if (shot('k-scene')) {
            const fork = document.querySelector('.k-fork');
            if (fork) { fork.click(); return 'fork'; }
            window.R.sceneNext(); return 'scene';
          }
          if (shot('k-camp')) { const go = document.getElementById('k-camp-go');
            if (go) { go.click(); return 'camp'; } }
          if (shot('k-swap')) {
            const b = document.querySelector('.k-swapcard'); if (b) b.click();
            const go = document.getElementById('k-swap-go'); if (go) go.click();
            return 'swap';
          }
          if (shot('k-mark')) {
          // TWO BEATS (Build 104): the moment, then the decision, then the mark.
          (() => {
            // TAKE THE FORK (Build 110): the moment ends on two marks now, and
            // one of them has to be chosen before the cards are offered.
            const f = document.querySelector('#k-mark-fork .k-mkf');
            if (f) { f.click(); return true; }
            const g = document.getElementById('k-mark-go');
            if (g) { g.click(); return true; }
            return false;
          })();
          const mk = [...document.querySelectorAll('#k-mark-cols .k-mk:not([disabled])')];
          if (mk.length) mk[0].click();
          const pl = document.getElementById('k-mark-place');
          if (pl && !pl.disabled) pl.click();
            return 'mark';
          }
          return null;
        });
        if (!cleared) break;
        await H.sleep(300);
      }
    }
    await H.sleep(250);
    const done = await J(() => !!window.R.state().over);
    if (done) break;
  }

  // ── the read ─────────────────────────────────────────────────────────────
  const n = turns.length;
  if (!n) { console.log('\n  no turns played — the walk did not reach a fight'); await H.browser.close(); return; }
  const sum = (k) => turns.reduce((a, t) => a + (t[k] || 0), 0);
  const avg = (k) => +(sum(k) / n).toFixed(2);
  const decide = sum('decideMs'), watch = sum('watchMs'), total = decide + watch;
  const dead = turns.filter(t => t.legal <= 1).length;
  const noLive = turns.filter(t => t.live === 0).length;
  const allNotes = turns.flatMap(t => t.notes || []);
  const noteKinds = allNotes.reduce((a, k) => { a[k] = (a[k] || 0) + 1; return a; }, {});

  console.log(`\n  ── ${stops} stops walked · ${fights} fights · ${n} turns played ──\n`);
  console.log('  DECISION DENSITY');
  console.log(`    cards playable per turn   ${avg('legal').toFixed(2).padStart(5)}   ${bar(avg('legal'), 5)}`);
  console.log(`    cards actually played     ${avg('played').toFixed(2).padStart(5)}   ${bar(avg('played'), 5)}`);
  console.log(`    of those, combo live      ${avg('live').toFixed(2).padStart(5)}   ${bar(avg('live'), 5)}`);
  console.log(`    turns with ONE legal play ${String(dead).padStart(5)}   ${pct(dead, n)}% of turns`);
  console.log(`    turns with NO live combo  ${String(noLive).padStart(5)}   ${pct(noLive, n)}% of turns`);

  console.log('\n  THE SPLIT — where a turn’s time goes');
  console.log(`    deciding   ${String(Math.round(decide / n)).padStart(5)}ms/turn  ${bar(decide, total)}  ${pct(decide, total)}%`);
  console.log(`    watching   ${String(Math.round(watch / n)).padStart(5)}ms/turn  ${bar(watch, total)}  ${pct(watch, total)}%`);
  console.log(`    a turn is  ${(avg('totalMs') / 1000).toFixed(1)}s long`);

  console.log('\n  THE READ');
  console.log(`    things on screen to parse ${avg('reads').toFixed(1)} per turn`);
  console.log(`    hand size                 ${avg('hand').toFixed(1)}   AP ${avg('ap').toFixed(1)}`);

  console.log('\n  PARRY LOAD');
  console.log(`    notes per enemy turn      ${(allNotes.length / n).toFixed(2)}`);
  console.log(`    the bar holds the screen  ${(watch / n / 1000).toFixed(1)}s`);
  console.log(`    vocabulary seen           ${Object.entries(noteKinds).map(([k, c]) => k + '×' + c).join(' ') || 'none'}`);

  console.log('\n  PER TURN');
  console.log('    #   legal live played  decide  watch   notes');
  turns.forEach((t, i) => console.log(
    `    ${String(i + 1).padStart(2)}  ${String(t.legal).padStart(5)} ${String(t.live).padStart(4)} `
    + `${String(t.played).padStart(6)}  ${String(t.decideMs).padStart(6)} ${String(t.watchMs).padStart(6)}   `
    + (t.notes || []).join(',')));

  console.log('\n  errors:', H.errs.length ? H.errs.slice(0, 3).join(' | ') : 'none');
  try {
    require('fs').writeFileSync(require('path').join(__dirname, 'feel.txt'),
      JSON.stringify({ map, stops, fights, turns }, null, 1));
  } catch (_) {}
  await H.browser.close();
})();
