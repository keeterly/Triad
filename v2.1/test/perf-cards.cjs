// Measure where card/render time actually goes, to target the lag fix.
'use strict';
const { boot } = require('./harness.cjs');

(async () => {
  const t = await boot({ flow: 0 });
  const r = await t.J(() => {
    // a busy board: full party, several enemies → biggest hand + battlefield
    RUN = newRun('ash'); RUN.roster = ['ash', 'elin', 'cassia']; RUN.active = RUN.roster.slice();
    RUN.nodes = EMBER_TREE.filter(n => ['card', 'branch'].includes(n.type)).map(n => n.id);
    startFight({ type: 'fight', chapter: 3, heroes: ['ash', 'elin', 'cassia'], enemies: ['brood', 'cantor', 'revenant'], narrator: 'perf' });
    S.ep = 9; renderAll();
    const handEl = document.getElementById('hand');
    const N = 200;
    const now = () => performance.now();

    // 1) full renderAll with an UNCHANGED hand (the common case — sig skip active)
    let t0 = now();
    for (let i = 0; i < N; i++) renderAll();
    const perRenderAll = (now() - t0) / N;

    // 2a) EP-only change every call — now a cheap affordability pass, not a rebuild
    t0 = now();
    for (let i = 0; i < N; i++) { S.ep = 9 - (i % 2); renderAll(); }
    const perEpChange = (now() - t0) / N;
    S.ep = 9;

    // 2b) FORCE a true structural rebuild every call (bust the struct sig)
    t0 = now();
    for (let i = 0; i < N; i++) { S._handStructSig = null; renderAll(); }
    const perRebuild = (now() - t0) / N;

    // 3) just the fan-layout reflow cost (measure a forced reflow read)
    t0 = now();
    for (let i = 0; i < N; i++) { void handEl.offsetWidth; [...handEl.children].forEach(k => k.offsetWidth); }
    const perFanReflow = (now() - t0) / N;

    // 4) a simulated drag frame's layout reads (2× getBoundingClientRect + a query)
    const card = handEl.querySelector('.card');
    t0 = now();
    for (let i = 0; i < N; i++) {
      document.getElementById('stage').getBoundingClientRect();
      card && card.getBoundingClientRect();
      document.querySelectorAll('.fig-snapped').forEach(() => {});
    }
    const perDragFrame = (now() - t0) / N;

    return {
      handCards: handEl.childElementCount,
      enemies: S.enemies.length,
      perRenderAll: +perRenderAll.toFixed(3),
      perEpChange: +perEpChange.toFixed(3),
      perRebuild: +perRebuild.toFixed(3),
      perFanReflow: +perFanReflow.toFixed(3),
      perDragFrame: +perDragFrame.toFixed(3),
    };
  });
  console.log('\n=== CARD/RENDER PERF (ms, avg over 200) ===');
  console.log(`hand cards: ${r.handCards} · enemies: ${r.enemies}`);
  console.log(`renderAll (hand UNCHANGED, sig-skip):   ${r.perRenderAll} ms`);
  console.log(`renderAll (EP change — affordability):  ${r.perEpChange} ms   <-- WAS a full rebuild, now a light pass`);
  console.log(`renderAll (forced structural rebuild):  ${r.perRebuild} ms   <-- unavoidable when the card SET changes`);
  console.log(`fan-layout forced reflow only:          ${r.perFanReflow} ms`);
  console.log(`drag frame layout reads (2×gBCR+query): ${r.perDragFrame} ms`);
  await t.browser.close();
  process.exit(0);
})();
