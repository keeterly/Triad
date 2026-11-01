'use strict';
// WHAT IS ON SCREEN DURING THE ENEMY TURN'S TAIL?
//
// turnbudget.cjs found 2.1s between the last ring and the player's next turn,
// on every enemy turn, and called it "nothing to play". Nothing to PLAY is not
// the same as nothing to SEE: Build 214 lengthened beats after a playtest said
// the game felt rushed, and a beat the player is reading is not dead air.
//
// So this timestamps the tail by what is happening in it, sampled every 16ms
// in realtime: is a popup up, is a hero recoiling, is the dirge running, is a
// card flying. A stretch where none of those is true is dead air — the only
// kind worth cutting.
const { boot } = require('./harness.cjs');
(async () => {
  const H = await boot({ query: 'realtime=1' });
  const { J, sleep } = H;
  const out = [];
  for (const foe of (process.env.TAIL_FOES || 'husk,wraith,mourner').split(',')) {
    for (let rep = 0; rep < 2; rep++) {
      await J((f) => { window.K.startCombat({ seed: 40 + f.length, foe: window.K.FOES[f] }); return true; }, foe);
      await sleep(1200);
      const r = await J(async () => {
        const K = window.K;
        for (let i = 0; i < 300 && K.state().phase !== 'PLAYER_READY'; i++) await new Promise(z => setTimeout(z, 20));
        const intent = K.currentIntent();
        const marks = [];
        let lastRing = 0, t0 = 0, raf = 0, prevPhase = '';
        const busy = () => {
          const st = document.getElementById('k-stage');
          const pops = st ? st.querySelectorAll('.k-pop').length : 0;
          const rings = st ? st.querySelectorAll('.k-pring').length : 0;
          const dirge = !!(st && st.classList.contains('k-dirge'));
          const flying = document.querySelectorAll('.k-card.k-flying, .k-fly, .k-drawing').length;
          const recoil = document.querySelectorAll('.k-hero.k-struck, .k-hero.k-recoil').length;
          return { pops, rings, dirge, flying, recoil };
        };
        const tick = () => {
          const now = performance.now();
          const b = busy(), ph = K.state().phase;
          if (b.rings) lastRing = now;
          if (ph !== prevPhase) { marks.push({ t: Math.round(now - t0), phase: ph }); prevPhase = ph; }
          marks.push({ t: Math.round(now - t0), ...b });
          if (ph !== 'PLAYER_READY' || now - t0 < 300) raf = requestAnimationFrame(tick);
        };
        t0 = performance.now();
        tick();
        await K.endTurn({ skipParry: false });
        cancelAnimationFrame(raf);
        const end = performance.now() - t0;
        const after = Math.round(lastRing - t0);
        // classify every sample AFTER the last ring
        let dead = 0, reading = 0, prev = null;
        const samples = marks.filter(m => m.pops != null && m.t >= after);
        for (const m of samples) {
          if (prev) {
            const dt = m.t - prev.t;
            const busyNow = prev.pops || prev.dirge || prev.flying || prev.recoil;
            if (busyNow) reading += dt; else dead += dt;
          }
          prev = m;
        }
        return { intent: intent && intent.id, hits: (intent && intent.hits || []).length,
                 total: Math.round(end), lastRing: after, tail: Math.round(end - after),
                 reading, dead,
                 phases: marks.filter(m => m.phase).map(m => m.phase + '@' + m.t).join(' ') };
      });
      out.push({ foe, ...r });
      console.log(foe.padEnd(8), JSON.stringify(r));
    }
  }
  const avg = (k) => Math.round(out.reduce((n, r) => n + r[k], 0) / out.length);
  console.log('\nMEAN  total', avg('total'), ' tail', avg('tail'), ' of which reading', avg('reading'), ' dead', avg('dead'));
  await H.browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
