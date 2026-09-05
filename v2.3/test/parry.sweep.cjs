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

const RUNS = Number(process.env.SWEEP_RUNS || 90);
const MAX_TURNS = 30;
const BANDS = [
  { name: 'none', p: 0.00, lo: 0,  hi: 15 },
  { name: 'half', p: 0.50, lo: 25, hi: 55 },
  { name: 'best', p: 0.92, lo: 85, hi: 100 },
];
// great · good — perfect is always 1 and late/miss always 0
const CURVES = [
  { great: 0.90, good: 0.60 },        // shipping
  { great: 0.85, good: 0.40 },
  { great: 0.80, good: 0.25 },
  { great: 0.75, good: 0.15 },
  { great: 0.70, good: 0.10 },
  { great: 0.60, good: 0.05 },
];

(async () => {
  const H = await boot();
  const { J, page } = H;
  await J(() => { window.__SIM = true; });
  console.log('runs per band: ' + RUNS + '   (perfect is 1, late and miss are 0)');
  console.log('');
  console.log('  great  good |   none    half    best  |  verdict');
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
