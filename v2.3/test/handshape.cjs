// KIZUNA v2.3 — THE SHAPE OF A HAND.
//
// Move 2 of the realtime playtest was "more cards need a combo": 10 of 16 were
// vanilla, so the ordering question the deck is built on was live in barely
// half of turns. The obvious fix — put a clause on everything — is the fix
// Build 25 measured and REVERSED, because nine conditional cards out of fifteen
// made every turn a reading exercise.
//
// So this measures both sides of that trade at once, over many opening hands:
//
//   DENSITY    how many of the five cards in hand carry a clause at all. Too
//              few and there is no decision; too many and there is no glance.
//   LIVE       how many of them are ARMED right now, cold, before anything is
//              played — the combos you could reach this turn.
//   THE GAP    the same hands played two ways: greedily in hand order, and
//              deliberately alternating heroes. The gap between them is the
//              size of the reward for playing well, and it is the number the
//              first playtest got backwards by measuring only the greedy arm.
'use strict';
const { boot } = require('./harness.cjs');

(async () => {
  const H = await boot();
  const N = +(process.argv[2] || 60);

  const r = await H.J((n) => {
    const K = window.K;
    let clauses = 0, liveCold = 0, hands = 0, cards = 0;
    let greedy = 0, deliberate = 0, greedyTurns = 0, delibTurns = 0;
    const byHero = { ash: 0, elin: 0, mira: 0 };

    for (let s = 0; s < n; s++) {
      // ── the hand as dealt ────────────────────────────────────────────────
      K.startCombat({ seed: 1000 + s });
      const hand = K.state().hand.slice();
      hands++; cards += hand.length;
      for (const id of hand) {
        const c = K.CARD_DEFS[id];
        if (c && c.cond) { clauses++; byHero[K.primaryHero(c)]++; }
        const ev = K.evaluateCard(id);
        if (ev && ev.condActive) liveCold++;
      }

      // ── arm A: greedy, in hand order, spend till you cannot ──────────────
      K.startCombat({ seed: 1000 + s });
      greedyTurns++;
      for (let g = 0; g < 6; g++) {
        const st = K.state(); if (!st || st.over) break;
        const can = st.hand.filter(id => K.evaluateCard(id).currentCost <= st.ap);
        if (!can.length) break;
        if (K.evaluateCard(can[0]).condActive) greedy++;
        K.playCard(can[0]);
      }

      // ── arm B: deliberate — never the same hero twice in a row ───────────
      K.startCombat({ seed: 1000 + s });
      delibTurns++;
      let lastHero = null;
      for (let g = 0; g < 6; g++) {
        const st = K.state(); if (!st || st.over) break;
        const can = st.hand.filter(id => K.evaluateCard(id).currentCost <= st.ap);
        if (!can.length) break;
        // prefer a card that is armed; failing that, one by a different hero
        const armed = can.filter(id => K.evaluateCard(id).condActive);
        const other = can.filter(id => K.primaryHero(K.CARD_DEFS[id]) !== lastHero);
        const pick = armed[0] || other[0] || can[0];
        if (K.evaluateCard(pick).condActive) deliberate++;
        lastHero = K.primaryHero(K.CARD_DEFS[pick]);
        K.playCard(pick);
      }
    }

    const pool = Object.keys(K.CARD_DEFS)
      .filter(id => K.CARD_DEFS[id].owner !== 'bond' && K.BOND_IDS.indexOf(id) < 0);
    return {
      hands, cards, clauses, liveCold, byHero,
      greedy, deliberate, greedyTurns, delibTurns,
      poolTotal: pool.length,
      poolCond: pool.filter(id => K.CARD_DEFS[id].cond).length,
      condTypes: pool.filter(id => K.CARD_DEFS[id].cond)
        .reduce((a, id) => { const t = K.CARD_DEFS[id].cond.type;
                             a[t] = (a[t] || 0) + 1; return a; }, {}),
      rewards: pool.filter(id => K.CARD_DEFS[id].cond)
        .reduce((a, id) => { const t = K.CARD_DEFS[id].cond.reward;
                             a[t] = (a[t] || 0) + 1; return a; }, {}),
    };
  }, N);

  const f = (x) => x.toFixed(2);
  console.log('\n  THE SHAPE OF A HAND — ' + r.hands + ' opening hands\n');
  console.log('  THE POOL');
  console.log('    cards that carry a clause   ' + r.poolCond + ' of ' + r.poolTotal
    + '   (' + Math.round(r.poolCond / r.poolTotal * 100) + '%)');
  console.log('    by condition                '
    + Object.entries(r.condTypes).map(([k, v]) => k + '×' + v).join('  '));
  console.log('    by reward                   '
    + Object.entries(r.rewards).map(([k, v]) => k + '×' + v).join('  '));

  console.log('\n  THE HAND');
  console.log('    clauses to read per hand    ' + f(r.clauses / r.hands) + ' of '
    + f(r.cards / r.hands) + ' cards');
  console.log('    armed before you play       ' + f(r.liveCold / r.hands));
  console.log('    whose clauses they are      '
    + Object.entries(r.byHero).map(([k, v]) => k + ' ' + f(v / r.hands)).join('   '));

  console.log('\n  THE GAP — the same hands, played two ways');
  console.log('    greedy, in hand order       ' + f(r.greedy / r.greedyTurns) + ' combos lit');
  console.log('    deliberate, alternating     ' + f(r.deliberate / r.delibTurns) + ' combos lit');
  const gap = r.deliberate / Math.max(1, r.greedy);
  console.log('    playing well is worth       ×' + gap.toFixed(2));

  console.log('\n  errors:', H.errs.length ? H.errs.slice(0, 3).join(' | ') : 'none');
  await H.browser.close();
})();
