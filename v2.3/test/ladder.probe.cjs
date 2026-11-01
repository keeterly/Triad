'use strict';
// THE PARRY LADDER A PLAYER ACTUALLY CLIMBS.
//
// turnbudget.cjs measures notes per bar by FOE, one creature at a time:
// husk 2 · cultist 2 · wraith 2.3 · revenant 5.7 · mourner 5.6 — flat, then a
// cliff, against its own heading that "the curve should rise with the ladder".
// But the road also deals PACKS from column 2, and each body in a line throws
// its own share. So the curve a player meets is by COLUMN, packs included,
// and that is what this measures: every fight the road can deal at each
// column, composed the way the fight composes it, notes counted.
const { boot } = require('./harness.cjs');
(async () => {
  const H = await boot({ query: 'road=1' });
  const { J } = H;
  const rows = await J(async () => {
    const K = window.K, R = window.R;
    const byCol = {};
    for (let seed = 1; seed <= 60; seed++) {
      R.newRun(seed);
      for (const n of R.map()) {
        if (!(n.kind === 'fight' || n.kind === 'elite' || n.kind === 'boss')) continue;
        K.startCombat({ seed: seed * 13 + n.col, foe: K.FOES[n.foe], foes: n.foes || null });
        const counts = [];
        // every intent this lineup will throw, a full rotation's worth
        for (let t = 0; t < 6; t++) {
          const v = K._composeVolley ? K._composeVolley() : null;
          const hits = (v && v.hits) || (K.currentIntent().hits || []);
          counts.push(hits.reduce((s, h) => s + (h.notes || []).length, 0));
          // walk every body in the line to its next intent, so six samples
          // cover the rotation rather than reading one turn six times
          (K.state().foes || []).forEach(F => { F.intentIx = (F.intentIx + 1) % F.intents.length; });
        }
        const key = n.col;
        (byCol[key] = byCol[key] || { col: n.col, kinds: {}, notes: [] });
        byCol[key].kinds[n.foes ? n.foes.join('+') : n.foe] = 1;
        byCol[key].notes.push(...counts);
      }
    }
    return Object.values(byCol).map(c => {
      const s = c.notes.slice().sort((a, b) => a - b);
      return { col: c.col, lineups: Object.keys(c.kinds).length,
               min: s[0], med: s[s.length >> 1], max: s[s.length - 1],
               mean: +(s.reduce((a, b) => a + b, 0) / s.length).toFixed(2) };
    });
  });
  console.log('\n  col  lineups   notes/bar  min  med  max  mean');
  for (const r of rows) console.log('  ' + String(r.col).padStart(3) + '  ' + String(r.lineups).padStart(7)
    + '            ' + String(r.min).padStart(4) + String(r.med).padStart(5) + String(r.max).padStart(5)
    + String(r.mean).padStart(7));
  await H.browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
