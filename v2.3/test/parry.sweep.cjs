'use strict';
// ── WHAT SHOULD A HALF-READ STRING BE WORTH? ───────────────────────────────
//
// The shipped gate wants a party that reads about half the notes to win 25-55%
// of the time. It wins 79.1%, because failure pays too well: at p=0.5 a quarter
// of notes come back `good` and a `good` is worth 0.6 of a perfect, so the
// player negates two thirds of everything the Regent throws.
//
// The reward for MASTERY is not the thing to touch — a whole string read
// GREAT-or-better negates the blow outright, and that is the deck's most
// deliberate decision. What is tunable is what PARTIAL play is worth, and this
// sweeps exactly that: the same fights, the same seeds, one curve at a time.
//
// Three gates have to hold at once, which is the whole difficulty: no-parry
// under 15%, half-parry 25-55%, excellent at or above 85%.
const { boot } = require('./harness.cjs');
const { BOT } = require('./bot.cjs');

// ── AND IT HAS TO BE THE SAME SAMPLE THE GATE USES ────────────────────────
//
// This ran at 90 and picked 0.80/0.25 on a reading of 41.1%. The real gate
// runs 220 — of which those 90 are the FIRST 90, same seed formula — and the
// same curve measured 55.9% there, missing the ceiling by a point. A 15-point
// gap between a subset and its superset is not a curve being wrong, it is a
// sample too small to choose on: at n=90 the standard error near a coin flip
// is 5.3 points, and the gate's edges are 25 and 55.
//
// So the default matches the gate. A sweep cheaper than the thing it is
// deciding is a sweep that decides wrongly.
const RUNS = Number(process.env.SWEEP_RUNS || 220);
const MAX_TURNS = 30;
// `none` is 0% and `best` is 100% on every curve tried — re-pricing partial
// credit is invisible to a player who turns everything and to one who turns
// nothing — so a sweep that reruns them is spending four fifths of its time
// confirming what four curves already showed. SWEEP_ALL=1 puts them back.
const BANDS = (process.env.SWEEP_ALL ? [
  { name: 'none', p: 0.00, lo: 0,  hi: 15 },
  { name: 'half', p: 0.50, lo: 25, hi: 55 },
  { name: 'best', p: 0.92, lo: 85, hi: 100 },
] : [{ name: 'half', p: 0.50, lo: 25, hi: 55 }]);
// great · good — perfect is always 1 and late/miss always 0
const CURVES = [
  { great: 0.80, good: 0.25 },        // 41.1% at n=90, 55.9% at n=220 — over
  { great: 0.78, good: 0.20 },
  { great: 0.75, good: 0.15 },        // 31.1% at n=90
  { great: 0.72, good: 0.10 },
];

(async () => {
  const H = await boot();
  const { J, page } = H;
  await J(() => { window.__SIM = true; });
  console.log('runs per band: ' + RUNS + '   (perfect is 1, late and miss are 0)');
  console.log('');
  console.log('  great  good |' + BANDS.map(b => b.name.padStart(7)).join(' ') + '  |  verdict');
  for (const c of CURVES) {
    const got = [];
    for (const b of BANDS) {
      let wins = 0;
      for (let i = 0; i < RUNS; i++) {
        const r = await page.evaluate(([src, seed, p, mt, w]) => {
          window.K._setParryWeights(w);
          return eval(src)(seed, p, mt);
        }, [BOT, 1000 + i * 7, b.p, MAX_TURNS, { perfect: 1, great: c.great, good: c.good, late: 0, miss: 0 }]);
        if (r.win) wins++;
      }
      got.push(wins / RUNS * 100);
    }
    const ok = BANDS.every((b, i) => got[i] >= b.lo && got[i] <= b.hi);
    console.log('  ' + c.great.toFixed(2) + '  ' + c.good.toFixed(2) + ' |'
      + got.map(v => (v.toFixed(1) + '%').padStart(7)).join(' ') + '  |  '
      + (ok ? 'ALL THREE HOLD' : BANDS.map((b, i) =>
          got[i] < b.lo ? b.name + ' low' : got[i] > b.hi ? b.name + ' high' : null)
          .filter(Boolean).join(', ')));
  }
  await H.browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
