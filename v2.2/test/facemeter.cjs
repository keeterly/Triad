// FACEMETER — does the number on the card equal the number that lands?
//
// Measured before Build 39: on a clean board every face was honest, and under
// any live modifier 530 of 989 readings lied. Crashing Wave read 11 and landed
// 48; Overload on three charges read 6 and landed 53; Elin's Mend read a heal
// and dealt 18. The face and the resolver were two hand-written copies of the
// same ladder, and they had already drifted.
//
// This drives every damaging card in the pool against a dummy under randomized
// board states — rally, chill, exposure, break, primed, desperation, an ally who
// already struck — and compares three things that must all agree: what
// previewFx() promises, what the rendered DOM face says, and what actually
// leaves the enemy.
//
//   node test/facemeter.cjs
'use strict';
const { boot } = require(require('path').join(__dirname, 'harness.cjs'));

(async () => {
  const t = await boot({});
  const J = t.J.bind(t);
  await t.page.setViewportSize({ width: 1000, height: 462 });

  const res = await J(async () => {
    try { localStorage.setItem('kizuna2_2.tutorialSeen', '1'); } catch (_) {}
    const out = { n: 0, bad: [], faceBad: [], noFace: [], heals: 0, healBad: [] };
    // a deterministic little PRNG so a failure is reproducible
    let seed = 0x2f6e2b1;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

    const HEROES_IN = ['ash', 'hask', 'mira', 'elin', 'cassia', 'branwen'];
    for (let round = 0; round < 150; round++) {
      const who = HEROES_IN[round % HEROES_IN.length];
      const mate = who === 'kiki' ? 'ash' : 'kiki';
      RUN = newRun(who); RUN.roster = [who, mate]; RUN.active = [who, mate];
      startFight({ type: 'fight', chapter: 1, heroes: [who, mate], enemies: ['husk'], narrator: 'face drill' });
      const e = S.enemies[0];
      e.hp = e.maxHp = 5000; e.guard = 0; e.poise = e.poiseMax = 99;
      const h = S.heroes.find(x => x.id === who);
      // scramble the board into a state that exercises the whole ladder
      if (rnd() < 0.5) h.buffDmg = 1 + Math.floor(rnd() * 4);
      if (rnd() < 0.3) h.chill = 1 + Math.floor(rnd() * 3);
      if (rnd() < 0.4) e.mark = 1 + Math.floor(rnd() * 5);
      if (rnd() < 0.3) e.staggered = true;
      if (rnd() < 0.4) e.lull = 1 + Math.floor(rnd() * 3);
      if (rnd() < 0.3) h.hp = Math.max(1, Math.round(h.maxHp * 0.2));       // desperate
      if (rnd() < 0.3) { e._hitBy = [mate]; }                                 // an ally already struck
      if (rnd() < 0.4 && h.id === 'hask') h.charge = 1 + Math.floor(rnd() * 3);
      if (rnd() < 0.4 && h.id === 'cassia') h.guard = 2 + Math.floor(rnd() * 6);
      S.ep = 99; renderAll();

      // A HEAL MUST NOT PROMISE WHAT A FULL-HEALTH HERO CANNOT RECEIVE
      for (const hc of buildHand().filter(c => c.owner === who && c.fx && c.fx.heal && !c.fx.healAll)) {
        const rc = (hc.target === 'self') ? h : (lowestHpAlly() || h);
        if (!rc) continue;
        // half the samples take the heal at FULL health, which is where a face
        // that reads its authored base promises something it cannot deliver
        rc.hp = (rnd() < 0.5) ? rc.maxHp : Math.max(1, rc.maxHp - 2);
        const pv = previewFx(hc, null);
        const hp0 = rc.hp;
        await resolveCard(hc, rc.id);
        const got = rc.hp - hp0;
        out.heals++;
        if (got !== pv.heal) out.healBad.push({ card: hc.name, promised: pv.heal, got });
        rc.hp = hp0;
      }
      const hand = buildHand().filter(c => c.owner === who && c.kind !== 'move' && c.fx && (c.fx.dmg || c.fx.smite));
      for (const card of hand) {
        const tgt = frontmostEnemy(); if (!tgt) continue;
        const pv = previewFx(card, tgt);
        const promised = pv.dmg != null ? pv.dmg : pv.smite;
        if (promised == null) continue;
        // what the FACE says, straight off the rendered DOM
        renderAll();   // the face must be read from the board as it stands RIGHT NOW
        const cel = document.querySelector(`#hand .card[data-card-name="${card.name}"]`);
        const el = cel && cel.querySelector('.ic-dmg');
        const faceN = el ? parseInt((el.textContent || '').replace(/[^0-9]/g, ''), 10) : null;
        const before = tgt.hp + (tgt.guard || 0);
        // snapshot the mutable state the resolve will spend, so each card is
        // measured against the board the preview actually saw
        const snap = { buffDmg: h.buffDmg, chill: h.chill, charge: h.charge, guard: h.guard,
                       aether: h.aether, hitBy: (tgt._hitBy || []).slice(), mark: tgt.mark };
        await resolveCard(card, tgt.uid);
        const landed = before - (tgt.hp + (tgt.guard || 0));
        out.n++;
        if (landed !== promised) out.bad.push({ card: card.name, owner: card.owner, promised, landed,
          steps: (pv.steps || []).map(s => s.k + ':' + s.v).join('+') });
        if (!cel) { /* not a card the hand draws — nothing to read */ }
        else if (faceN == null) out.noFace.push(card.name);
        else if (faceN !== promised) out.faceBad.push({ card: card.name, face: faceN, promised });
        // restore for the next card in this hand
        h.buffDmg = snap.buffDmg; h.chill = snap.chill; h.charge = snap.charge; h.guard = snap.guard;
        h.aether = snap.aether; tgt._hitBy = snap.hitBy; tgt.mark = snap.mark;
        tgt.hp = 5000; tgt.guard = 0; tgt.dead = false;
      }
    }
    return out;
  });

  console.log('\n=== FACEMETER · v2.2 ===\n');
  console.log('  ' + res.n + ' resolutions measured under randomized boards');
  console.log('  preview vs landed:  ' + (res.n - res.bad.length) + '/' + res.n + ' agree');
  console.log('  rendered face vs preview: ' + (res.n - res.faceBad.length) + '/' + res.n + ' agree');
  console.log('  heal faces: ' + (res.heals - res.healBad.length) + '/' + res.heals + ' restore exactly what they promise');
  res.healBad.slice(0, 6).forEach(b => console.log('   ✗ heal ' + b.card + ': promised ' + b.promised + ', restored ' + b.got));
  if (res.noFace.length) console.log('  faces with no number at all: ' + [...new Set(res.noFace)].join(', '));
  res.bad.slice(0, 12).forEach(b => console.log('   ✗ ' + b.owner + '/' + b.card + '  promised ' + b.promised + ', landed ' + b.landed + '   [' + b.steps + ']'));
  res.faceBad.slice(0, 8).forEach(b => console.log('   ✗ face ' + b.card + ': shows ' + b.face + ', preview says ' + b.promised));
  const ok = !res.bad.length && !res.faceBad.length && !res.noFace.length && !res.healBad.length && res.n > 100;
  console.log('\n  ' + (ok ? '✓ the card face is the number that lands' : '✗ the face still lies'));
  await t.browser.close();
  process.exit(ok ? 0 : 1);
})();
