// KIZUNA v2.3 — the rebuild acceptance suite.
// Spec §17.4's twelve scenarios, plus the §17.1 rules invariants, run against
// the real engine in a real page. Deterministic: seeds are fixed, hands are
// forced, and rhythm grades are passed straight to the resolver.
'use strict';
const { boot } = require('./harness.cjs');

(async () => {
  const t = await boot();
  const { J, check } = t;

  const fresh = (seed) => J((s) => { K.startCombat({ seed: s }); return true; }, seed || 7);
  const st = () => J(() => {
    const c = K.state();
    return {
      phase: c.phase, turn: c.turn, ap: c.ap,
      partyHp: c.party.hp, guard: c.party.guard, burn: c.party.burn,
      bossHp: c.boss.hp, brk: c.boss.brk, breakMax: c.boss.breakMax,
      ward: c.boss.ward, bossPhase: c.boss.phase, affinity: c.boss.affinity,
      bleed: c.boss.bleed, bleedTurns: c.boss.bleedTurns,
      hand: c.hand.slice(), deck: c.deck.length, discard: c.discard.length,
      rows: { ash: c.heroes.ash.row, elin: c.heroes.elin.row, mira: c.heroes.mira.row },
      res: { charges: c.resonance.charges, used: c.resonance.used },
      played: c.turnState.actionsPlayed.length,
    };
  });

  // ───────────────────────── §17.1 — rules invariants ─────────────────────────
  await fresh(7);
  {
    const deck = await J(() => {
      const defs = Object.entries(K.state() ? window.CARD_DEFS || {} : {});
      return null;
    });
    const counts = await J(() => {
      const c = K.state();
      const all = [...c.hand, ...c.deck, ...c.discard];
      const perHero = { ash: 0, elin: 0, mira: 0 };
      all.forEach(id => { perHero[K.evaluateCard(id).card.owner]++; });
      return { total: all.length, unique: new Set(all).size, perHero, hand: c.hand.length,
               handUnique: new Set(c.hand).size };
    });
    check('DECK: 15 cards, all unique, exactly five per hero', counts.total === 15 && counts.unique === 15
      && counts.perHero.ash === 5 && counts.perHero.elin === 5 && counts.perHero.mira === 5,
      JSON.stringify(counts.perHero));
    check('DECK: the opening hand is five unique physical instances', counts.hand === 5 && counts.handUnique === 5);
  }
  {
    const shared = await J(() => {
      const src = K.playCard.toString();
      return /evaluateCard\(/.test(src);   // resolution reads the SAME evaluator the UI renders from
    });
    check('EVALUATOR: resolution and rendering share evaluateCard — no duplicate modifier logic', shared);
    const discounts = await J(() => {
      const withOverride = [];
      for (const id of K.state().hand.concat(K.state().deck, K.state().discard)) {
        const ev = K.evaluateCard(id);
        if (ev.card.mod && ev.card.mod.costOverride !== undefined) withOverride.push(ev.card.owner);
      }
      return withOverride.sort();
    });
    check('COSTS: exactly three self-discount cards, one per hero', discounts.length === 3
      && discounts.join(',') === 'ash,elin,mira', discounts.join(','));
  }
  {
    const machine = await J(async () => {
      const res = await fetch('game.js?v=1'); const src = await res.text();
      const assigns = (src.match(/C\.phase = /g) || []).length;
      return { assigns, hasSetPhase: /function setPhase\(/.test(src) };
    });
    check('STATE MACHINE: setPhase is the only phase mutator', machine.hasSetPhase && machine.assigns === 1,
      machine.assigns + ' direct assignments');
    const noGhosts = await J(() => {
      const txt = document.body.textContent.toUpperCase();
      return !txt.includes('ACTION TRAIL') && !/\bFLOW\b/.test(txt);
    });
    check('NO GHOSTS: neither Flow nor an Action Trail appears anywhere in the UI', noGhosts);
  }

  // ───────────────────── §17.4 scenario 1 — Cross Sever first ─────────────────────
  await fresh(11);
  {
    await J(() => { K.forceHand(['crosssever', 'cleave', 'brace', 'mend', 'serrate']); });
    const ev = await J(() => K.evaluateCard('crosssever'));
    check('S1: Cross Sever first previews base — 2 AP, no modifier', ev.currentCost === 2 && !ev.modifierActive);
    await J(() => K.playCard('crosssever'));
    const s = await st();
    check('S1: it resolves at full base strength — 2 AP spent, 9 dealt', s.ap === 1 && s.bossHp === 81 && s.brk === 5);
  }

  // ───────────────────── scenario 2 — Cleave, then Cross Sever ─────────────────────
  await fresh(12);
  {
    await J(() => { K.forceHand(['cleave', 'crosssever', 'brace', 'mend', 'serrate']); });
    await J(() => K.playCard('cleave'));
    const ev = await J(() => K.evaluateCard('crosssever'));
    check('S2: as the second action the AP badge updates to 1 before affordability', ev.currentCost === 1 && ev.modifierActive);
    await J(() => K.playCard('crosssever'));
    const s = await st();
    check('S2: 1+1 AP spent; Cross Sever lands 12 and 1 Break', s.ap === 1 && s.bossHp === 90 - 6 - 12 && s.brk === 4);
  }

  // ───────────────────── scenario 3 — Lumen Cascade first ─────────────────────
  await fresh(13);
  {
    await J(() => { K.forceHand(['lcascade', 'cleave', 'brace', 'mend', 'serrate']); });
    await J(() => K.playCard('lcascade'));
    const s = await st();
    check('S3: played first it costs 1, deals 4, grants no bonus Guard',
      s.ap === 2 && s.bossHp === 86 && s.guard === 0);
  }

  // ───────────────────── scenario 4 — another hero, then Lumen Cascade ─────────────────────
  await fresh(14);
  {
    await J(() => { K.forceHand(['cleave', 'lcascade', 'brace', 'mend', 'serrate']); });
    await J(() => K.playCard('cleave'));
    const ev = await J(() => K.evaluateCard('lcascade'));
    check('S4: after another hero the badge reads 0 AP', ev.currentCost === 0 && ev.modifierActive);
    await J(() => K.playCard('lcascade'));
    const s = await st();
    check('S4: it deals 4 and grants 3 Guard for free', s.ap === 2 && s.bossHp === 90 - 6 - 4 && s.guard === 3);
  }

  // ───────────────────── scenario 5 — Execution Thread at ≤35% ─────────────────────
  await fresh(15);
  {
    await J(() => { K.state().boss.hp = 31; K.forceHand(['execthread', 'cleave', 'brace', 'mend', 'serrate']); });
    const ev = await J(() => K.evaluateCard('execthread'));
    check('S5: at 35% HP Execution Thread updates to 1 AP', ev.currentCost === 1 && ev.modifierActive);
    await J(() => K.playCard('execthread'));
    const s = await st();
    check('S5: it resolves for 15', s.bossHp === 16 && s.ap === 2);
  }

  // ───────────────────── scenario 6 — Bleed, then Twin Fang ─────────────────────
  await fresh(16);
  {
    await J(() => { K.forceHand(['serrate', 'twinfang', 'brace', 'mend', 'cleave']); });
    await J(() => K.playCard('serrate'));
    const mid = await st();
    check('S6: Serrate applies Bleed 3 for two turns', mid.bossHp === 87 && mid.bleed === 3 && mid.bleedTurns === 2);
    await J(() => K.playCard('twinfang'));
    const s = await st();
    check('S6: Twin Fang deals 10 total and consumes the Bleed',
      s.bossHp === 87 - 10 && s.bleed === 0 && s.bleedTurns === 0);
  }

  // ───────────────────── scenario 7 — move Ash, then Vanguard Thrust ─────────────────────
  await fresh(17);
  {
    await J(() => { K.forceHand(['vthrust', 'cleave', 'brace', 'mend', 'serrate']); });
    await J(() => K.moveHero('ash'));
    const ev = await J(() => K.evaluateCard('vthrust'));
    check('S7: after moving, the modifier arms', ev.modifierActive);
    await J(() => K.playCard('vthrust'));
    const s = await st();
    check('S7: 1 AP moved + 1 AP attack, for 9 damage and 1 Break',
      s.ap === 1 && s.bossHp === 81 && s.brk === 4 && s.rows.ash === 'back');
  }

  // ───────────────────── scenario 8 — Scything Advance vs a Back target ─────────────────────
  await fresh(18);
  {
    await J(() => K.forceIntent('scythe'));
    const before = await J(() => K.intentPreviewDmg());
    await J(() => K.moveHero('mira'));
    const after = await J(() => K.intentPreviewDmg());
    check('S8: the telegraph previews the positional counterplay live — 26 becomes 7',
      before === 26 && after === 7);
    const r = await J(() => K.endTurn({ grades: ['miss', 'miss', 'miss'] }));
    const s = await st();
    check('S8: taken entirely, it resolves for 7, not 26', s.partyHp === 42 - 7, 'hp ' + s.partyHp);
  }

  // ───────────────────── scenario 9 — miss everything, die ─────────────────────
  await fresh(19);
  {
    let outcome = 'continue';
    for (let i = 0; i < 5 && outcome === 'continue'; i++) {
      const r = await J(() => K.endTurn({ grades: ['miss', 'miss', 'miss', 'miss', 'miss'] }));
      outcome = r.outcome;
    }
    const s = await st();
    check('S9: parrying nothing and playing nothing is death within a few turns',
      outcome === 'defeat' && s.phase === 'DEFEAT' && s.partyHp === 0, 'turn ' + s.turn);
  }

  // ───────────────────── scenario 10 — the full PERFECT string ─────────────────────
  await fresh(20);
  {
    await J(() => K.forceIntent('hymn'));
    const r = await J(() => K.endTurn({ grades: ['perfect', 'perfect', 'perfect', 'perfect'] }));
    const s = await st();
    check('S10: a perfect string negates the Hymn, deals 1 Break, and ripostes 4×notes',
      r.turned === true && r.riposte === 16 && r.taken === 0
      && s.partyHp === 42 && s.bossHp === 90 - 16 && s.brk === 4);
  }
  {
    await fresh(21);
    await J(() => K.forceIntent('hymn'));
    const r = await J(() => K.endTurn({ grades: ['perfect', 'great', 'perfect', 'great'] }));
    const s = await st();
    check('S10b: all PERFECT/GREAT still turns the attack and Breaks — but no riposte',
      r.turned === true && r.riposte === 0 && s.partyHp === 42 && s.bossHp === 90 && s.brk === 4);
  }
  {
    await fresh(22);
    await J(() => K.forceIntent('hymn'));
    // packets of 22 across 4 notes: 6,6,5,5 — GOOD halves (ceil), MISS lands whole
    const r = await J(() => K.endTurn({ grades: ['good', 'good', 'miss', 'miss'] }));
    const s = await st();
    check('S10c: damage packets follow the individual grades — 3+3+5+5 lands',
      s.partyHp === 42 - 16, 'hp ' + s.partyHp);
  }

  // ───────────────────── scenario 11 — discard everything, draw one at a time ─────────────────────
  await fresh(23);
  {
    const before = await st();
    await J(() => K.endTurn({ grades: ['perfect', 'perfect', 'perfect', 'perfect', 'perfect'] }));
    const s = await st();
    check('S11: End Turn discards the whole hand and draws back to five',
      before.hand.length === 5 && s.hand.length === 5 && s.discard === 5 && s.deck === 5);
    const conserve = await J(() => {
      const c = K.state();
      return new Set([...c.hand, ...c.deck, ...c.discard]).size;
    });
    check('S11: no card is duplicated or lost across the cycle', conserve === 15);
    // two more empty turns: the reshuffle happens only when the pile runs dry
    await J(() => K.endTurn({ grades: ['perfect', 'perfect', 'perfect', 'perfect', 'perfect'] }));
    const s2 = await st();
    check('S11: second cycle — deck 0, discard 10, hand 5, no early reshuffle',
      s2.deck === 0 && s2.discard === 10 && s2.hand.length === 5);
    await J(() => K.endTurn({ grades: ['perfect', 'perfect', 'perfect', 'perfect', 'perfect'] }));
    const s3 = await st();
    check('S11: third cycle reshuffles the discard and keeps drawing',
      s3.hand.length === 5 && s3.deck + s3.discard === 10);
  }

  // ───────────────────── scenario 12 — Resonance across two turns ─────────────────────
  await fresh(24);
  {
    // Turn 1: Rising Edge (Ash, a Modifier Action) → Lumen Cascade (Elin, modifier ACTIVE)
    await J(() => { K.forceHand(['redge', 'lcascade', 'vthrust', 'wecho', 'brace']); });
    await J(() => K.playCard('redge'));
    await J(() => K.playCard('lcascade'));
    let s = await st();
    check('S12: the pair charges once — Ash then Elin, second modifier active', s.res.charges === 1);
    // a second qualifying pair the SAME turn must not double-charge
    await J(() => { K.state().boss.affinity = 'frost'; });
    await J(() => K.playCard('vthrust'));
    await J(() => K.playCard('wecho'));
    s = await st();
    check('S12: at most one charge per turn', s.res.charges === 1);
    // GREAT string: turned (survives clean) but no riposte — the boss must not
    // cross the phase-II line mid-scenario, or the arriving Ward and gauge
    // adjustment muddy the Bond Art's arithmetic below.
    await J(() => K.endTurn({ grades: ['great', 'great', 'great', 'great', 'great'] }));
    // Turn 2: charge again → ready
    await J(() => { K.forceHand(['redge', 'lcascade', 'cleave', 'brace', 'mend']); });
    await J(() => K.playCard('redge'));
    await J(() => K.playCard('lcascade'));
    s = await st();
    check('S12: two charges across two turns ready the Bond Art', s.res.charges === 2 && !s.res.used);
    const apBefore = s.ap, hpBefore = s.bossHp, brkBefore = s.brk;
    await J(() => K.playResonance());
    s = await st();
    check('S12: Light Through Steel — 1 AP, 10 damage, 2 Break, 7 Guard, Ash to Front',
      s.ap === apBefore - 1 && s.bossHp === hpBefore - 10
      && s.brk === Math.max(0, brkBefore - 2) && s.guard >= 7 && s.rows.ash === 'front' && s.res.used);
    const again = await J(() => K.playResonance());
    check('S12: once per encounter — a second invocation refuses', again === false);
  }

  // ───────────────────── break interrupt + benediction + phase II + burn ─────────────────────
  await fresh(25);
  {
    await J(() => { K.state().boss.brk = 0; K.forceIntent('benediction'); K.state().boss.hp = 60; });
    const r = await J(() => K.endTurn({ grades: [] }));
    const s = await st();
    check('BREAK: a Broken Regent loses its action — the Benediction never lands — and the gauge hardens +2',
      r.interrupted === true && s.bossHp === 60 && s.breakMax === 7 && s.brk === 7);
  }
  await fresh(26);
  {
    await J(() => { K.forceIntent('benediction'); K.state().boss.hp = 60; });
    await J(() => K.endTurn({ grades: [] }));
    const s = await st();
    check('BENEDICTION: un-Broken, the Regent heals 8 with no parry sequence', s.bossHp === 68);
  }
  await fresh(27);
  {
    await J(() => { K.state().boss.hp = 46; K.forceHand(['cleave', 'brace', 'mend', 'serrate', 'twinfang']); });
    await J(() => K.playCard('cleave'));
    const s = await st();
    check('PHASE II: crossing 45 grants 10 Ward and a 7-slot Break gauge',
      s.bossPhase === 2 && s.ward === 10 && s.breakMax === 7);
    await J(() => K.playCard('serrate'));
    const s2 = await st();
    check('PHASE II: the Ward absorbs before HP', s2.bossHp === 40 && s2.ward === 7);
  }
  await fresh(28);
  {
    await J(() => K.forceIntent('rain'));
    await J(() => K.endTurn({ grades: ['miss', 'miss', 'miss', 'miss'] }));
    let s = await st();
    check('BURN: unguarded Ashen Rain scorches — 20 taken, Burn 4 banked',
      s.partyHp === 22 && s.burn === 4);
    const r = await J(() => K.endTurn({ grades: ['good', 'good', 'good', 'good'] }));
    s = await st();
    // hymn 22 → packets 6,6,5,5 → good halves: 3+3+3+3=12, +4 burn = 16
    check('BURN: it adds to the next damaging resolution, then clears',
      s.partyHp === 22 - 16 && s.burn === 0, 'hp ' + s.partyHp);
  }
  await fresh(29);
  {
    await J(() => { K.forceHand(['brace', 'cleave', 'mend', 'serrate', 'twinfang']); });
    await J(() => K.playCard('brace'));
    await J(() => K.forceIntent('hymn'));
    await J(() => K.endTurn({ grades: ['good', 'good', 'miss', 'miss'] }));
    const s = await st();
    // 3+3+5+5 = 16 through the notes, then Guard 5 absorbs → 11 to HP; guard expires after
    check('GUARD: applies only after rhythm mitigation, and expires after the Enemy Phase',
      s.partyHp === 42 - 11 && s.guard === 0, 'hp ' + s.partyHp);
  }
  await fresh(30);
  {
    await J(() => { K.forceHand(['tshift', 'frostbind', 'cleave', 'brace', 'mend']); });
    await J(() => K.playCard('tshift'));      // sets Pyre
    const ev = await J(() => K.evaluateCard('frostbind'));
    await J(() => K.playCard('frostbind'));   // Pyre → +5, 2 Break, becomes Frost
    const s = await st();
    check('AFFINITY: one state, replaced on set — Pyre feeds Frost Bind then flips',
      ev.modifierActive && s.affinity === 'frost' && s.bossHp === 90 - 4 - 9 && s.brk === 3);
  }
  {
    const history = await J(() => K.state().turnState.actionsPlayed.length);
    await J(() => K.endTurn({ grades: ['perfect', 'perfect', 'perfect', 'perfect', 'perfect'] }));
    const s = await st();
    check('TURN SCOPE: the internal action history resets each Player Phase — and never renders as a trail',
      history === 2 && s.played === 0 && s.ap === 3);
  }

  // ───────────────────── presentation smoke ─────────────────────
  {
    await fresh(31);
    const ui = await J(() => ({
      intent: document.getElementById('k-int-name').textContent.length > 1,
      cards: document.querySelectorAll('#k-hand .k-card').length,
      apVisible: document.getElementById('k-ap-num').textContent === '3',
      resonance: !!document.getElementById('k-res-card'),
      actors: document.querySelectorAll('.k-hero img').length === 3 && !!document.querySelector('#k-boss-art img'),
      endTurnBig: document.getElementById('k-endturn').getBoundingClientRect().height >= 40,
    }));
    check('UI: intent visible before acting; five cards; AP dial; resonance card; independent actors',
      ui.intent && ui.cards === 5 && ui.apVisible && ui.resonance && ui.actors, JSON.stringify(ui));
    await t.shot('v23-combat');
  }

  const r = t.report();
  await t.browser.close();
  process.exit(r.passed === r.total ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
