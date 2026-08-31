// KIZUNA v2.3 — WHERE THE ENEMY TURN'S SECONDS GO.
//
// feel.playtest.cjs measured the symptom: 94% of a turn is watching, and one
// enemy turn timed at 8752ms. It could not say WHICH 8752ms, and "the bar is
// too long" is a guess until something says how much of it is notes and how
// much is air.
//
// This samples the live phase at 16ms through a real enemy turn and buckets the
// wall-clock by phase, and inside RHYTHM_DEFENSE separates the time a ring is
// actually on screen (the game) from the time none is (the runway, the rests,
// the tail). That distinction is the whole decision: shortening the notes makes
// the parry harder, shortening the air makes it tighter.
'use strict';
const { boot } = require('./harness.cjs');

const pad = (s, n) => String(s).padEnd(n);
const ms = (n) => (n / 1000).toFixed(2) + 's';

(async () => {
  const H = await boot({ query: 'realtime=1' });
  const { J } = H;

  const foes = process.argv[2] ? process.argv[2].split(',') : ['husk', 'cultist', 'wraith', 'revenant', 'mourner'];
  const rows = [];

  for (const foe of foes) {
    // every intent that foe owns, one bar each, played with no input at all —
    // the point is the SHAPE of the bar, not how well it is answered
    const intents = await J((f) => window.K.FOES[f].intents, foe);
    for (const intentId of intents) {
      const r = await J(async ([f, iid]) => {
        const K = window.K;
        K.startCombat({ foe: K.FOES[f], seed: 11 });
        // LENS: startCombat does not cancel an in-flight bar. Wait for quiet.
        for (let quiet = 0, i = 0; quiet < 20 && i < 400; i++) {
          quiet = document.querySelector('.k-pring') ? 0 : quiet + 1;
          await new Promise(r2 => setTimeout(r2, 16));
        }
        for (let i = 0; i < 200 && K.state().phase !== 'PLAYER_READY'; i++) {
          await new Promise(r2 => setTimeout(r2, 25));
        }
        K.forceIntent(iid);

        const t0 = performance.now();
        const byPhase = {}, seenNotes = new Set();
        let ringMs = 0, firstRing = null, lastRing = null, last = t0;
        const tick = setInterval(() => {
          const now = performance.now();
          const dt = now - last; last = now;
          const p = (K.state() && K.state().phase) || 'GONE';
          byPhase[p] = (byPhase[p] || 0) + dt;
          const rings = document.querySelectorAll('.k-pring');
          rings.forEach(x => seenNotes.add(x.dataset.kind + ':' + x.dataset.n + ':' + x.dataset.total));
          if (rings.length) {
            ringMs += dt;
            if (firstRing == null) firstRing = now - t0;
            lastRing = now - t0;
          }
          // AIR BETWEEN RINGS IS COMPUTED, NOT ACCUMULATED. The first version
          // added up every sample after the first ring that had no ring on it,
          // which silently swept up the whole TAIL as well — so the summary
          // reported "89% air" and pointed the fix at gaps that turn out not to
          // exist. Reading the rows straight (crescendo: 10.29s = 1.30 runway +
          // 6.00 rings + 3.01 tail) leaves nothing between the first ring and
          // the last: their runways are long enough that no frame of a bar is
          // ever empty. The waste is all at the ENDS, which is a different
          // build's worth of work from the one that figure implied.
        }, 16);
        await K.endTurn({ skipParry: false });
        clearInterval(tick);
        const total = performance.now() - t0;
        const runway = firstRing == null ? 0 : firstRing;
        const tail = lastRing == null ? 0 : total - lastRing;
        return {
          foe: f, intent: iid, total, byPhase, notes: seenNotes.size, runway, tail, ringMs,
          // …so this is the leftover, and it is the only honest way to get it
          airMs: Math.max(0, total - runway - tail - ringMs),
        };
      }, [foe, intentId]);
      rows.push(r);
    }
  }

  console.log('\n  THE ENEMY TURN, BY THE CLOCK — realtime, no input\n');
  console.log('  ' + pad('foe', 10) + pad('intent', 12) + pad('notes', 6)
    + pad('TOTAL', 8) + pad('runway', 8) + pad('rings', 8) + pad('air', 8) + 'tail');
  console.log('  ' + '─'.repeat(68));
  for (const r of rows) {
    console.log('  ' + pad(r.foe, 10) + pad(r.intent, 12) + pad(r.notes, 6)
      + pad(ms(r.total), 8) + pad(ms(r.runway), 8) + pad(ms(r.ringMs), 8)
      + pad(ms(r.airMs), 8) + ms(r.tail));
  }

  const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
  const n = rows.length;
  console.log('\n  MEAN BAR   ' + ms(sum('total') / n) + '   over ' + n + ' intents');
  console.log('    runway before the first note   ' + ms(sum('runway') / n));
  console.log('    a ring is on screen            ' + ms(sum('ringMs') / n));
  console.log('    dead air between rings         ' + ms(sum('airMs') / n));
  console.log('    tail after the last ring       ' + ms(sum('tail') / n));
  const air = sum('runway') + sum('airMs') + sum('tail');
  console.log('    nothing to play  ' + Math.round(air / sum('total') * 100)
    + '% of the enemy turn   (runway + gaps + tail)');

  console.log('\n  BY PHASE (mean per turn)');
  const ph = {};
  rows.forEach(r => Object.entries(r.byPhase).forEach(([k, v]) => { ph[k] = (ph[k] || 0) + v; }));
  Object.entries(ph).sort((a, b) => b[1] - a[1]).forEach(([k, v]) =>
    console.log('    ' + pad(k, 26) + pad(ms(v / n), 8)
      + '█'.repeat(Math.round(v / sum('total') * 40))));

  console.log('\n  NOTE COUNT PER BAR, BY FOE — the curve should rise with the ladder');
  const byFoe = {};
  rows.forEach(r => { (byFoe[r.foe] = byFoe[r.foe] || []).push(r.notes); });
  Object.entries(byFoe).forEach(([f, ns]) => console.log('    ' + pad(f, 10)
    + 'min ' + Math.min(...ns) + '  max ' + Math.max(...ns)
    + '  mean ' + (ns.reduce((a, b) => a + b, 0) / ns.length).toFixed(1)));

  console.log('\n  errors:', H.errs.length ? H.errs.slice(0, 3).join(' | ') : 'none');
  await H.browser.close();
})();
