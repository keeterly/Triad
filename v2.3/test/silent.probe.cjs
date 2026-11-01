'use strict';
// SEVEN TURNS WITH NO ENEMY.
//
// The feel playtest walked seed 7 and recorded turns 11-17 with zero notes and
// zero watch time — seven consecutive enemy phases in which the foe threw
// nothing. That is either a stagger loop (a foe broken again before its gauge
// can harden) or something worse, and either is the most severe gameplay
// finding available. This replays the same walk and logs WHY each enemy turn
// was quiet, from the state rather than from the screen.
const { boot } = require('./harness.cjs');
(async () => {
  const H = await boot({ query: 'road=1' });
  const { J } = H;
  await J(() => {
    window.R.newRun(7);
    const o = window.R.wakeOffer();
    window.R.takeWake((o.find(w => w.kind === 'plain') || o[0]).id);
  });
  await H.sleep(300);
  for (let step = 0; step < 14; step++) {
    const at = await J(() => {
      if (window.R.state().over) return { over: window.R.state().over };
      const open = window.R.reachable();
      if (!open.length) return { stuck: true };
      const n = window.R.map().find(m => m.id === open[0]);
      window.R.travel(n.id);
      return { kind: n.kind, id: n.id };
    });
    if (at.over || at.stuck) { console.log('end', JSON.stringify(at)); break; }
    if (!(at.kind === 'fight' || at.kind === 'elite' || at.kind === 'boss')) {
      console.log('stop', step, at.kind); continue;
    }
    await H.sleep(400);
    const foe = await J(() => { const C = window.K.state();
      return C ? (C.foes || []).map(f => f.id + ':' + f.hp).join(',') : null; });
    console.log('\nFIGHT at step', step, at.kind, foe);
    for (let t = 0; t < 12; t++) {
      const r = await J(async () => {
        const K = window.K; let C = K.state();
        if (!C || C.over) return { done: true, phase: C && C.phase };
        for (let i = 0; i < 200 && K.state().phase !== 'PLAYER_READY'; i++)
          await new Promise(z => setTimeout(z, 20));
        C = K.state(); if (!C || C.over) return { done: true };
        const it = K.currentIntent();
        const before = {
          turn: C.turn, foes: (C.foes || []).filter(f => !f.dead)
            .map(f => f.id + ' hp' + f.hp + (f.broken ? ' BROKEN' : '') + (f.cancelNext ? ' CANCEL' : '')),
          boss: { broken: C.boss && C.boss.broken, cancelNext: C.boss && C.boss.cancelNext,
                  brk: C.boss && C.boss.brk },
          intent: it ? (it.id + ' hits=' + (it.hits || []).length + ' kind=' + (it.kind || '-')) : null,
          ap: C.ap, hand: C.hand.length,
        };
        const played = [];
        for (let g = 0; g < 4; g++) {
          const st = K.state(); if (!st || st.over) break;
          const can = st.hand.filter(id => K.evaluateCard(id).currentCost <= st.ap);
          if (!can.length) break;
          const best = can.find(id => K.evaluateCard(id).condActive) || can[0];
          await K.playCard(best); played.push(best);
        }
        const r = await K.endTurn({ skipParry: true });
        const after = K.state();
        return { before, played, outcome: r && r.outcome, phase: after && after.phase,
                 party: after ? Object.values(after.heroes).map(h => h.hp).join('/') : null };
      });
      if (r.done) { console.log('  done', JSON.stringify(r)); break; }
      console.log('  ' + JSON.stringify(r));
    }
  }
  await H.browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
