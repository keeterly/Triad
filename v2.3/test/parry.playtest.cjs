// KIZUNA v2.3 — PARRY PLAYTEST. Drives real bars with a synthetic hand that
// has human timing error, then reports what each note KIND actually scores.
// The point is to find which gestures are unfair rather than merely hard:
// a note whose grade is dominated by travel time, not by the player's read,
// is a broken note.
'use strict';
const { boot } = require('./harness.cjs');

// A hand, described honestly:
//  jitter   gaussian error around the beat (ms). ~55 is a practised player.
//  bias     systematic lateness (ms) — a tired or unfamiliar hand runs behind.
//  misread  chance the hand answers a DIRECTION note the wrong way. This is
//           the real difficulty of an arrow: not hitting the beat, but knowing
//           which way to go while the ring is closing. A rig that always reads
//           correctly measures the windows and nothing else.
const HANDS = {
  practised: { jitter: 55,  bias: 0,  misread: 0.15 },
  sloppy:    { jitter: 110, bias: 25, misread: 0.35 },
  panicked:  { jitter: 90,  bias: 15, misread: 0.70 },  // barely reads at all
  frame:     { jitter: 8,   bias: 0,  misread: 0 },     // a machine: the ceiling
};

const DRIVER = `
(async (jitter, bias, misread) => {
  const st = document.getElementById('k-stage');
  const seen = new WeakSet();
  const log = [];
  const rnd = () => {           // box-muller, so the error is gaussian
    let u = 0, v = 0;
    while (!u) u = Math.random();
    while (!v) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const at = (t, fn) => setTimeout(fn, Math.max(0, t - performance.now()));
  const pt = (type, x, y) => st.dispatchEvent(new PointerEvent(type,
    { bubbles: true, clientX: x, clientY: y, pointerId: 4 }));

  const tick = setInterval(() => {
    st.querySelectorAll('.k-pring').forEach(r => {
      if (seen.has(r)) return;
      seen.add(r);
      const impact = +r.dataset.impact, kind = r.dataset.kind;
      let dir = r.dataset.dir || 'R';
      let wrong = false;
      if (r.dataset.dir && Math.random() < misread) {     // read the arrow wrong
        const other = { L: 'R', R: 'L', U: 'D', D: 'U' }[dir];
        dir = other; wrong = true;
      }
      const D = { L: [-70, 0], R: [70, 0], U: [0, -70], D: [0, 70] }[dir];
      const err = rnd() * jitter + bias;
      const aim = impact + err;
      log.push({ kind, err: Math.round(err), wrong });
      if (kind === 'bait') return;                       // the hand knows to hold off
      if (kind === 'tap' || kind === 'feint') {
        at(aim, () => { pt('pointerdown', 400, 200); pt('pointerup', 400, 200); });
      } else if (kind === 'slide') {
        // a real flick commits ~80ms before the beat and has travelled by it
        at(aim - 80, () => pt('pointerdown', 400, 200));
        at(aim - 40, () => pt('pointermove', 400 + D[0] * 0.5, 200 + D[1] * 0.5));
        at(aim, () => { pt('pointermove', 400 + D[0], 200 + D[1]);
                        pt('pointerup', 400 + D[0], 200 + D[1]); });
      } else if (kind === 'hold') {
        at(aim - 220, () => pt('pointerdown', 400, 200));
        at(aim, () => pt('pointerup', 400, 200));
      } else if (kind === 'burst') {
        for (let i = 0; i < 3; i++) {
          at(aim - 150 + i * 55, () => { pt('pointerdown', 400, 200); pt('pointerup', 400, 200); });
        }
      }
    });
  }, 12);

  const out = [];
  for (const intent of ['hymn', 'scythe', 'benediction', 'rain']) {
    window.K.startCombat({ seed: 40 + out.length });
    window.K.forceIntent(intent);
    const r = await window.K.endTurn();
    out.push({ intent, grades: r.grades, taken: r.taken,
               turned: r.hits.filter(h => h.turned).length, hits: r.hits.length });
  }
  clearInterval(tick);
  return { runs: out, log };
})
`;

(async () => {
  const H = await boot();
  const which = process.env.HAND || 'practised';
  const hand = HANDS[which];
  const reps = Number(process.env.REPS || 3);
  const byKind = {};
  const byIntent = {};
  for (let i = 0; i < reps; i++) {
    const res = await H.page.evaluate(
      ([src, j, b, m]) => eval(src)(j, b, m), [DRIVER, hand.jitter, hand.bias, hand.misread]);
    // stitch grades back onto their kinds, in order
    let li = 0;
    for (const run of res.runs) {
      const acc = byIntent[run.intent] || (byIntent[run.intent] = { taken: 0, turned: 0, hits: 0, n: 0 });
      acc.taken += run.taken; acc.turned += run.turned; acc.hits += run.hits; acc.n++;
      for (const g of run.grades) {
        const ev = res.log[li++] || {};
        const kind = ev.kind || '?';
        const k = byKind[kind] || (byKind[kind] = { perfect: 0, great: 0, good: 0, late: 0, miss: 0, n: 0, wrong: 0 });
        k[g] = (k[g] || 0) + 1; k.n++;
        if (ev.wrong) k.wrong++;
      }
    }
  }
  console.log('\n  HAND: ' + which + '  (jitter ' + hand.jitter + 'ms, bias ' + hand.bias
    + 'ms, misread ' + Math.round(hand.misread * 100) + '%) · ' + reps + ' passes\n');
  console.log('  kind      n   perfect  great   good    miss    | clean%  misread');
  for (const [kind, k] of Object.entries(byKind)) {
    const clean = ((k.perfect + k.great) / k.n * 100);
    const pct = (v) => String(Math.round(v / k.n * 100)).padStart(5) + '%';
    console.log('  ' + kind.padEnd(8) + String(k.n).padStart(3)
      + pct(k.perfect) + pct(k.great) + pct(k.good) + pct((k.miss || 0) + (k.late || 0))
      + '    | ' + String(clean.toFixed(0) + '%').padStart(5)
      + String(k.wrong ? k.wrong + '/' + k.n : '').padStart(9));
  }
  console.log('\n  intent          hits  turned   dmg taken (avg)');
  for (const [id, a] of Object.entries(byIntent)) {
    console.log('  ' + id.padEnd(14) + String(a.hits / a.n).padStart(4)
      + String((a.turned / a.n).toFixed(1)).padStart(8)
      + String((a.taken / a.n).toFixed(1)).padStart(14));
  }
  console.log('');
  await H.browser.close();
})().catch(e => { console.error('PLAYTEST CRASH:', e); process.exit(2); });
