// KIZUNA v2.3 — Build 5 acceptance suite: the RESONANCE core mechanics pass
// (docs/RESONANCE-DECK.md). Covers the deck's must-have tests — opening hero
// coverage, immediate Follow-Up, Finale gating, no dual conditional bonus,
// Guard expiry, Bleed decay, Break cancellation, one Resonance per phase —
// plus economy, parry outcomes, Intercession, and the UI presentation gates.
'use strict';
const { boot } = require('./harness.cjs');

(async () => {
  const H = await boot();
  const { J, check, report } = H;

  const fresh = (seed) => J((s) => { window.K.startCombat({ seed: s }); return true; }, seed);
  // a flat grade list for the whole barrage: 'clean' answers every string
  const grades = (kind) => J((k) => (window.K.currentIntent().hits || [])
    .flatMap(h => h.notes.map(() => k)), kind);
  // what the barrage is about to do, straight from the engine
  // a live bar runs ~4s; let it finish before the next block touches the DOM
  const settle = () => J(async () => {
    for (let i = 0; i < 120; i++) {
      if (!document.getElementById('k-beat') && !document.querySelector('.k-pring')) return true;
      await new Promise(r => setTimeout(r, 60));
    }
    return false;
  });
  const volley = () => J(() => {
    const it = window.K.currentIntent();
    return { total: window.K.intentPreviewDmg(), hits: (it.hits || []).length,
             dirge: window.K.dirgeAmount() };
  });
  const S = () => J(() => {
    const c = window.K.state();
    return {
      phase: c.phase, turn: c.turn, ap: c.ap,
      heroes: JSON.parse(JSON.stringify(c.heroes)),
      boss: JSON.parse(JSON.stringify(c.boss)),
      hand: c.hand.slice(), deck: c.deck.length, discard: c.discard.slice(),
      exhausted: c.exhausted.slice(),
      bond: JSON.parse(JSON.stringify(c.bond)),
      counterstance: c.counterstance, intercession: c.intercession,
      pendingDiscard: c.pendingDiscard,
      moved: c.turnState.moved, cycled: c.turnState.cycled,
      actions: c.turnState.actionsPlayed.length,
    };
  });

  // ═══ A · DECK INTEGRITY + THE EVALUATOR ═══
  console.log('\n── invariants ──');
  {
    const d = await J(() => {
      const c = window.K.state();
      const all = [...c.hand, ...c.deck, ...c.discard];
      const owners = {};
      all.forEach(id => { const o = window.K.evaluateCard(id).card.owner; owners[o] = (owners[o] || 0) + 1; });
      return { n: all.length, uniq: new Set(all).size, owners, hasBond: all.includes('lightsteel') };
    });
    check('DECK: 15 unique cards, 5 per hero, Resonance never in the deck',
      d.n === 15 && d.uniq === 15 && d.owners.ash === 5 && d.owners.elin === 5 && d.owners.mira === 5 && !d.hasBond,
      JSON.stringify(d.owners));
  }
  {
    let ok = true, detail = '';
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      await fresh(seed);
      const cov = await J(() => {
        const c = window.K.state();
        const o = new Set(c.hand.map(id => window.K.evaluateCard(id).card.owner));
        return { n: c.hand.length, cov: o.size };
      });
      if (cov.n !== 5 || cov.cov !== 3) { ok = false; detail = 'seed ' + seed + ': ' + JSON.stringify(cov); break; }
    }
    check('OPENING COVERAGE: 5 cards, at least one per hero, across 8 seeds', ok, detail);
  }
  {
    const src = await J(async () => (await (await fetch('game.js?v=12')).text()));
    const phaseWrites = (src.match(/C\.phase = /g) || []).length;
    check('ONE TRANSITION OWNER: setPhase is the only C.phase mutator', phaseWrites === 1, phaseWrites + ' assignments');
    check('NO FLOW METER, NO ACTION TRAIL: nothing renders a meter or a trail', await J(() =>
      !document.querySelector('#k-flow, .k-flow, .k-trail, .k-action-trail')), '');
    check('COST FLOOR: every printed cost ≥ 1 and Follow-Up floors at 1', await J(() => {
      const defs = ['cleave','guardcut','cstance','crosssever','lastlight','lcascade','mend','frostbind','sgrace','intercession','serrate','qthrow','twinfang','backstab','execute','lightsteel'];
      return defs.every(id => window.K.evaluateCard(id).card.cost >= 1);
    }), '');
  }

  // ═══ B · SEQUENCING: FOLLOW-UP + FINALE ═══
  console.log('\n── sequencing ──');
  await fresh(11);
  {
    await J(() => window.K.state() && window.K.forceHand(['lcascade', 'crosssever', 'cleave', 'mend', 'serrate']));
    const before = await J(() => window.K.evaluateCard('crosssever').currentCost);
    await J(() => window.K.playCard('lcascade'));
    const after = await J(() => {
      const ev = window.K.evaluateCard('crosssever');
      return { cost: ev.currentCost, active: ev.condActive };
    });
    check('FOLLOW-UP: Cross Sever reads 2 AP cold, 1 AP right after another hero',
      before === 2 && after.cost === 1 && after.active, before + '→' + after.cost);
    await J(() => window.K.playCard('crosssever'));
    const s = await S();
    check('FOLLOW-UP: the discount actually charges 1 AP', s.ap === 1, 'ap=' + s.ap);
  }
  await fresh(12);
  {
    await J(() => window.K.forceHand(['cleave', 'lcascade', 'serrate', 'lastlight', 'mend']));
    const cold = await J(() => window.K.evaluateCard('lastlight'));
    await J(() => { window.K.playCard('cleave'); window.K.playCard('lcascade'); });
    const two = await J(() => window.K.evaluateCard('lastlight').condActive);
    await J(() => window.K.playCard('serrate'));
    const fin = await J(() => {
      const ev = window.K.evaluateCard('lastlight');
      return { active: ev.condActive, cost: ev.currentCost,
               dmg: ev.resolvedEffects.reduce((n, fx) => n + (fx.dmg || 0), 0) };
    });
    check('FINALE: gated until ALL THREE heroes have played this phase',
      !cold.condActive && !two && fin.active, 'after 2 heroes: ' + two);
    check('NO DUAL BONUS: Finale grants +5 output, cost stays 2',
      fin.cost === 2 && fin.dmg === 15 && cold.currentCost === 2, JSON.stringify(fin));
    const cs = await J(() => {
      const ev = window.K.evaluateCard('crosssever');   // follow-up is live after serrate
      return { cost: ev.currentCost, dmg: ev.resolvedEffects.reduce((n, fx) => n + (fx.dmg || 0), 0) };
    });
    check('NO DUAL BONUS: Follow-Up Cross Sever costs 1, output stays 9',
      cs.cost === 1 && cs.dmg === 9, JSON.stringify(cs));
  }

  // ═══ C · ECONOMY: cycle, hand persistence, move, Quick Throw ═══
  console.log('\n── economy ──');
  await fresh(13);
  {
    const before = await S();
    const ok1 = await J(() => window.K.cycleCard(window.K.state().hand[0]));
    const mid = await S();
    const ok2 = await J(() => window.K.cycleCard(window.K.state().hand[0]));
    check('FREE CYCLE: discard 1 draw 1, no AP, once per phase',
      ok1 && !ok2 && mid.hand.length === 5 && mid.ap === 3 && mid.discard.length === 1 && mid.cycled,
      'second cycle: ' + ok2);
  }
  await fresh(14);
  {
    await J(() => window.K.forceHand(['cleave', 'mend', 'serrate', 'frostbind', 'twinfang']));
    await J(() => window.K.playCard('cleave'));
    const keep = (await S()).hand;
    const r = await J(() => window.K.endTurn({ grades: ['miss', 'miss', 'miss', 'miss', 'miss'] }));
    const s = await S();
    check('END-OF-TURN SWEEP: the hand goes to the discard and a fresh 5 is drawn',
      keep.every(id => s.discard.includes(id)) && s.hand.length === 5
      && !keep.some(id => s.hand.includes(id) && s.discard.indexOf(id) < 0),
      'swept ' + keep.length + ' → discard ' + s.discard.length + ', hand ' + s.hand.length);
  }
  await fresh(15);
  {
    const a = await J(() => window.K.moveHero('ash'));
    const b = await J(() => window.K.moveHero('mira'));
    const s = await S();
    check('MOVE: 1 AP and once per phase', a && !b && s.ap === 2 && s.moved === 1, 'second move: ' + b);
  }
  await fresh(16);
  {
    await J(() => window.K.forceHand(['backstab', 'cleave', 'mend', 'serrate', 'frostbind']));
    const row0 = await J(() => window.K.state().heroes.mira.row);
    await J(() => window.K.playCard('backstab'));
    const s = await S();
    const canStillMove = await J(() => window.K.moveHero('ash'));
    check('PRINTED MOVEMENT: Backstab switches Mira\'s row without spending the phase Move',
      s.heroes.mira.row !== row0 && s.moved === 0 && canStillMove,
      row0 + '→' + s.heroes.mira.row);
  }
  await fresh(17);
  {
    await J(() => window.K.forceHand(['qthrow', 'cleave', 'mend', 'serrate', 'frostbind']));
    await J(() => window.K.playCard('qthrow'));
    const mid = await S();
    const blockedPlay = await J(() => window.K.playCard('cleave'));
    const blockedEnd = await J(() => window.K.endTurn());
    await J(() => window.K.pickDiscard(window.K.state().hand[0]));
    const s = await S();
    check('QUICK THROW: draw 1 then the player discards 1 — everything else waits',
      mid.pendingDiscard && mid.hand.length === 5 && !blockedPlay && blockedEnd === null
      && !s.pendingDiscard && s.hand.length === 4,
      JSON.stringify({ mid: mid.hand.length, blockedPlay, after: s.hand.length }));
  }

  // ═══ D · STATUSES: Guard, Bleed, Chill, Break/Broken ═══
  console.log('\n── statuses ──');
  await fresh(21);
  {
    await J(() => { window.K.forceHand(['guardcut', 'cleave', 'mend', 'serrate', 'frostbind']); window.K.forceIntent('hymn'); });
    await J(() => window.K.playCard('guardcut'));
    const g = await J(() => window.K.state().heroes.ash.guard);
    const v = await volley();
    const r = await J(() => window.K.endTurn({ grades: [] }));   // no input: every string misses
    const s = await S();
    // the whole party loses HP+Guard equal to the volley plus the dirge
    const lost = (42 - s.heroes.ash.hp) + (36 - s.heroes.elin.hp) + (34 - s.heroes.mira.hp);
    check('GUARD ABSORBS FIRST: an unanswered volley spends Guard before flesh',
      g === 4 && lost === v.total + v.dirge * 3 - 4,
      JSON.stringify({ guard: g, volley: v, lost }));
  }
  await fresh(22);
  {
    await J(() => { window.K.forceHand(['sgrace', 'cleave', 'mend', 'serrate', 'frostbind']); window.K.forceIntent('benediction'); });
    await J(() => window.K.playCard('sgrace'));
    const g0 = await J(() => { const h = window.K.state().heroes; return [h.ash.guard, h.elin.guard, h.mira.guard]; });
    await J(() => window.K.endTurn({ grades: [] }));
    await J(() => window.K.render());
    const g1 = await J(() => { const h = window.K.state().heroes; return [h.ash.guard, h.elin.guard, h.mira.guard]; });
    check('GUARD EXPIRY: survives the enemy phase, gone at the next player phase',
      g0.every(g => g === 3) && g1.every(g => g === 0), g0 + ' → ' + g1);
  }
  await fresh(23);
  {
    await J(() => { window.K.forceHand(['serrate', 'cleave', 'mend', 'frostbind', 'twinfang']); window.K.forceIntent('hymn'); });
    await J(() => window.K.playCard('serrate'));
    const hp0 = await J(() => window.K.state().boss.hp);
    await J(() => window.K.endTurn({ grades: [] }));
    const t1 = await J(() => ({ hp: window.K.state().boss.hp, bleed: window.K.state().boss.bleed }));
    await J(() => window.K.endTurn({ grades: [] }));
    const t2 = await J(() => ({ hp: window.K.state().boss.hp, bleed: window.K.state().boss.bleed }));
    check('BLEED DECAY: ticks 3 then 2 at enemy-phase start, decreasing by 1',
      t1.hp === hp0 - 3 && t1.bleed === 2 && t2.hp === t1.hp - 2 && t2.bleed === 1,
      JSON.stringify({ hp0, t1, t2 }));
  }
  await fresh(24);
  {
    await J(() => { window.K.forceHand(['frostbind', 'cleave', 'mend', 'serrate', 'twinfang']); window.K.forceIntent('hymn'); });
    const raw = await J(() => window.K.intentPreviewDmg());
    await J(() => window.K.playCard('frostbind'));
    const chilled = await J(() => window.K.intentPreviewDmg());
    const r = await J(() => window.K.endTurn({ grades: [] }));
    const after = await J(() => window.K.state().boss.chill);
    check('CHILL: blunts the volley\'s first hit by 4 (previewed live), then clears',
      raw - chilled === 4 && r.taken === chilled && after === 0,
      raw + '→' + chilled + ' taken=' + r.taken);
  }
  await fresh(25);
  {
    await J(() => { window.K.forceHand(['crosssever', 'cleave', 'backstab', 'execute', 'mend']); window.K.forceIntent('hymn');
      window.K.state().boss.brk = 2; window.K.render(); });
    await J(() => window.K.playCard('crosssever'));
    const b = await J(() => { const s = window.K.state().boss; return { brk: s.brk, broken: s.broken, cancel: s.cancelNext }; });
    const conds = await J(() => ({ backstab: window.K.evaluateCard('backstab').condActive,
                                   execute: window.K.evaluateCard('execute').condActive }));
    const hp0 = await J(() => window.K.state().boss.hp);
    await J(() => window.K.playCard('cleave'));
    const hp1 = await J(() => window.K.state().boss.hp);
    const r = await J(() => window.K.endTurn({ grades: [] }));
    const s = await S();
    check('BREAK → BROKEN: meter to zero staggers the Regent and arms the cancel',
      b.brk === 0 && b.broken && b.cancel && conds.backstab && conds.execute, JSON.stringify(b));
    check('BROKEN: +25% damage taken during the player phase (6 → 8)',
      hp0 - hp1 === 8, 'took ' + (hp0 - hp1));
    check('BREAK CANCELLATION: the next enemy action dies; the meter refills to 12',
      r.canceled === true && s.boss.brk === 12 && !s.boss.broken && !s.boss.cancelNext,
      JSON.stringify({ canceled: r.canceled, brk: s.boss.brk }));
  }

  // ═══ E · PARRY OUTCOMES (deck §5 on the rhythm strings) ═══
  console.log('\n── defense ──');
  await fresh(31);
  {
    await J(() => { window.K.forceHand(['cleave', 'mend', 'serrate', 'frostbind', 'twinfang']); window.K.forceIntent('hymn'); });
    const v = await volley();
    const r = await J(() => window.K.endTurn({ grades: [] }));
    check('FAILED PARRY: every hit of the volley lands in full',
      r.taken === v.total && r.negated === 0, 'taken=' + r.taken + ' of ' + v.total);
  }
  await fresh(32);
  {
    await J(() => { window.K.forceHand(['cleave', 'mend', 'serrate', 'frostbind', 'twinfang']); window.K.forceIntent('hymn'); });
    const hp0 = await J(() => window.K.state().boss.hp);
    const v = await volley();
    const r = await J(async () => window.K.endTurn({ grades:
      (window.K.currentIntent().hits || []).flatMap(h => h.notes.map(() => 'great')) }));
    const hp1 = await J(() => window.K.state().boss.hp);
    // v2.2: a string read GREAT-or-better throughout is TURNED — negated whole.
    // Ash answers two hits of the Hymn and may only fully turn one; the second
    // still holds 75% of itself.
    check('TURNED: a whole string read GREAT-or-better negates its hit outright',
      r.hits.filter(h => h.turned).length === 2 && r.hits.filter(h => h.turned).every(h => h.taken === 0),
      JSON.stringify(r.hits.map(h => ({ t: h.turned, taken: h.taken }))));
    check('GREAT is not PERFECT: a turned string does not riposte',
      hp1 === hp0 && !r.riposte, hp0 + '→' + hp1 + ' riposte=' + r.riposte);
  }
  await fresh(33);
  {
    await J(() => { window.K.forceHand(['guardcut', 'cleave', 'mend', 'serrate', 'frostbind']); window.K.forceIntent('hymn'); });
    const brk0 = await J(() => window.K.state().boss.brk);
    const r = await J(async () => window.K.endTurn({ grades:
      (window.K.currentIntent().hits || []).flatMap(h => h.notes.map(() => 'great')) }));
    const brk1 = await J(() => window.K.state().boss.brk);
    const ashHits = r.hits.filter(h => h.targetId === 'ash');
    check('TURNED chips the Regent: each turned string costs it 1 Break',
      brk0 - brk1 === r.negated && r.negated === 2, 'brkDelta=' + (brk0 - brk1) + ' turned=' + r.negated);
    check('RESPONSE LIMIT: a hero fully turns only ONE hit per enemy action',
      ashHits.length === 2 && ashHits.filter(h => h.turned).length === 1
      && ashHits.some(h => !h.turned && h.mit === 1 && h.taken > 0),
      JSON.stringify(ashHits.map(h => ({ turned: h.turned, taken: h.taken }))));
  }
  await fresh(34);
  {
    await J(() => { window.K.forceHand(['cstance', 'cleave', 'mend', 'serrate', 'frostbind']); window.K.forceIntent('hymn'); });
    await J(() => window.K.playCard('cstance'));
    const brk0 = await J(() => window.K.state().boss.brk);
    const r = await J(async () => window.K.endTurn({ grades:
      (window.K.currentIntent().hits || []).flatMap(h => h.notes.map(() => 'great')) }));
    const brk1 = await J(() => window.K.state().boss.brk);
    // 1 Break per turned string, +2 from the stance on the first one only
    check('COUNTERSTANCE: the next turned string deals +2 Break, once',
      r.negated >= 1 && brk0 - brk1 === r.negated + 2, 'delta=' + (brk0 - brk1) + ' turned=' + r.negated);
  }
  // ── FLAWLESS: the summit above TURNED ──
  await fresh(36);
  {
    await J(() => { window.K.forceHand(['cleave', 'mend', 'serrate', 'frostbind', 'twinfang']); window.K.forceIntent('hymn'); });
    const hp0 = await J(() => window.K.state().boss.hp);
    const notes = await J(() => (window.K.currentIntent().hits || []).reduce((n, h) => n + h.notes.length, 0));
    const r = await J(async () => window.K.endTurn({ grades:
      (window.K.currentIntent().hits || []).flatMap(h => h.notes.map(() => 'perfect')) }));
    const hp1 = await J(() => window.K.state().boss.hp);
    check('FLAWLESS: a string read PERFECTLY throughout ripostes, 2 per note',
      r.riposte === notes * 2 && hp0 - hp1 === r.riposte,
      'riposte=' + r.riposte + ' over ' + notes + ' notes, boss ' + hp0 + '→' + hp1);
  }
  // ── PARTIAL: the grades spread across the damage instead of bunching ──
  await fresh(37);
  {
    await J(() => { window.K.forceHand(['cleave', 'mend', 'serrate', 'frostbind', 'twinfang']); window.K.forceIntent('hymn'); });
    const raw = await J(() => window.K.currentIntent().hits[0].dmg[0]);
    const mixed = await J(async () => {
      const hits = window.K.currentIntent().hits;
      // first string: one great, one miss -> weighted 0.9/2 = 0.45 mitigation
      const g = ['great', 'miss'];
      for (let i = 1; i < hits.length; i++) hits[i].notes.forEach(() => g.push('miss'));
      return window.K.endTurn({ grades: g });
    });
    const first = mixed.hits[0];
    check('PARTIAL: each note turned aside negates its share, weighted by grade',
      Math.abs(first.mit - 0.45) < 0.001 && first.taken === Math.round(raw * 0.55) && !first.turned,
      JSON.stringify({ raw, mit: first.mit, taken: first.taken }));
  }
  // ── the grading windows themselves ──
  {
    const w = await J(() => ({
      perfect: window.K.parryGrade(60), perfectEarly: window.K.parryGrade(-60),
      great: window.K.parryGrade(120), good: window.K.parryGrade(-200),
      late: window.K.parryGrade(300), tooEarly: window.K.parryGrade(-400),
    }));
    check('WINDOWS: the beat is the CENTRE of the window — a late catch is a catch',
      w.perfect === 'perfect' && w.perfectEarly === 'perfect' && w.great === 'great'
      && w.good === 'good' && w.late === 'late' && w.tooEarly === null, JSON.stringify(w));
  }
  await fresh(35);
  {
    await J(() => { window.K.forceHand(['intercession', 'cleave', 'mend', 'serrate', 'frostbind']); window.K.forceIntent('scythe'); });
    await J(() => window.K.playCard('intercession', 'mira'));
    const g = await J(() => ({ elin: window.K.state().heroes.elin.guard, mira: window.K.state().heroes.mira.guard,
                               who: window.K.state().intercession }));
    const r = await J(async () => window.K.endTurn({ grades:
      (window.K.currentIntent().hits || []).flatMap(h => h.notes.map(() => 'great')) }));
    const s = await S();
    const miraHit = r.hits.find(h => h.targetId === 'mira');
    check('INTERCESSION: both gain 3 Guard and Elin steps into Mira\'s window',
      g.elin === 3 && g.mira === 3 && g.who === 'mira' && miraHit && miraHit.parrierId === 'elin',
      JSON.stringify(g));
    check('INTERCESSION NEGATE: Elin\'s Guard pays and the blow aimed at Mira is erased',
      miraHit && miraHit.negated && miraHit.taken === 0 && s.intercession === null,
      JSON.stringify(miraHit));
  }

  // ═══ F · BOND AND RESONANCE ═══
  console.log('\n── resonance ──');
  await fresh(41);
  {
    await J(() => { window.K.forceHand(['lcascade', 'cleave', 'mend', 'guardcut', 'serrate']); window.K.forceIntent('benediction'); });
    await J(() => { window.K.playCard('lcascade'); window.K.playCard('cleave'); });   // elin → ash: stitch
    const s1 = await J(() => window.K.state().bond.stitches);
    await J(() => { window.K.playCard('mend'); });                                     // ash → elin adjacency again
    const s2 = await J(() => window.K.state().bond.stitches);
    check('BOND STITCH: an Ash↔Elin Follow-Up stitches the pair — max 1 per phase',
      s1 === 1 && s2 === 1, s1 + ',' + s2);
    await J(() => window.K.endTurn({ grades: [] }));
    await J(() => { window.K.forceHand(['lcascade', 'cleave', 'mend', 'guardcut', 'serrate']); window.K.forceIntent('benediction'); });
    await J(() => { window.K.playCard('lcascade'); window.K.playCard('cleave'); });
    const gen = await S();
    check('RESONANCE GENERATED: two stitches put Light Through Steel in the hand',
      gen.bond.stitches === 2 && gen.bond.generated && gen.hand.includes('lightsteel'),
      JSON.stringify(gen.bond) + ' hand=' + gen.hand.join(','));
    const hp0 = await J(() => window.K.state().boss.hp);
    await J(() => window.K.playCard('lightsteel'));
    const s = await S();
    check('LIGHT THROUGH STEEL: 1 AP, 10 damage, all heroes +4 Guard, EXHAUSTS',
      hp0 - s.boss.hp === 10 && s.heroes.ash.guard >= 4 && s.heroes.elin.guard >= 4 && s.heroes.mira.guard >= 4
      && s.exhausted.includes('lightsteel') && !s.discard.includes('lightsteel'),
      JSON.stringify({ dmg: hp0 - s.boss.hp, ex: s.exhausted }));
    await J(() => window.K.endTurn({ grades: [] }));
    await J(() => { window.K.forceHand(['lcascade', 'cleave', 'mend', 'guardcut', 'serrate']); window.K.forceIntent('benediction'); });
    await J(() => { window.K.playCard('lcascade'); window.K.playCard('cleave'); });
    const again = await S();
    check('ONE AUTHORED CLIMAX: the Resonance never regenerates this encounter',
      !again.hand.includes('lightsteel') && again.bond.generated, 'hand=' + again.hand.join(','));
  }

  // ═══ G · THE REGENT ═══
  console.log('\n── the regent ──');
  await fresh(51);
  {
    await J(() => { window.K.forceIntent('benediction'); window.K.state().boss.hp = 100; window.K.render(); });
    await J(() => window.K.endTurn({ grades: [] }));
    const hp = await J(() => window.K.state().boss.hp);
    check('BENEDICTION: the Regent sings itself whole (+7)', hp === 107, 'hp=' + hp);
  }
  await fresh(52);
  {
    await J(() => { window.K.state().boss.hp = 61; window.K.render(); });
    await J(() => { window.K.forceHand(['cleave', 'mend', 'serrate', 'frostbind', 'twinfang']); });
    await J(() => window.K.playCard('cleave'));
    const p = await J(() => window.K.state().boss.phase);
    check('PHASE II: the dirge sharpens at half health', p === 2, 'phase=' + p);
  }
  await fresh(53);
  {
    await J(() => { window.K.state().heroes.ash.hp = 0; window.K.state().heroes.ash.downed = true;
      window.K.forceIntent('hymn'); window.K.render(); });
    const tgt = await J(() => window.K.intentTargetId());
    const dead = await J(() => {
      window.K.forceHand(['cleave', 'mend', 'serrate', 'frostbind', 'twinfang']);
      return { play: window.K.playCard('cleave'),
               deadInHand: !!document.querySelector('.k-card[data-card="cleave"].k-card-dead') };
    });
    check('DOWNED: the Hymn finds a hero still standing; the fallen\'s cards are dead',
      tgt !== 'ash' && tgt != null && !dead.play && dead.deadInHand, 'tgt=' + tgt);
  }

  // ═══ H · PRESENTATION ═══
  console.log('\n── presentation ──');
  await fresh(7);
  {
    const ui = await J(() => {
      // the intent is now ONE LINE inside the Regent's own column — no banner
      const ir = document.getElementById('k-intent').getBoundingClientRect();
      const br = document.getElementById('k-boss-art').getBoundingClientRect();
      const clearOf = (r) => ir.right < r.left || ir.left > r.right || ir.bottom < r.top || ir.top > r.bottom;
      // it may share the Regent's (mostly transparent) art box the way the rest
      // of the boss HUD always has — what matters is that it rides ABOVE the
      // figure rather than across it, and never touches the party roster
      const disjoint = ir.bottom < br.top + br.height * 0.45
        && clearOf(document.getElementById('k-party-hud').getBoundingClientRect());
      const inBossCol = document.getElementById('k-boss-hud').contains(document.getElementById('k-intent'));
      const oneLine = ir.height < 26;
      const chip = document.getElementById('k-intent');
      const intentFits = chip.scrollWidth <= chip.clientWidth + 1;
      const noBanner = !document.getElementById('k-int-notes') && !document.getElementById('k-int-hint');
      const rows = document.querySelectorAll('.k-pt-hero').length;
      const bars = document.querySelectorAll('.k-pt-hero .k-bar-fill').length;
      const cards = document.querySelectorAll('#k-hand .k-card');
      const fanned = [...cards].some(c => (c.style.getPropertyValue('--rot') || '0deg') !== '0deg');
      const pips = document.querySelectorAll('#k-break .k-pip').length;

      // no card may hang off the stage — the fan grew when the faces were redesigned
      const st = document.getElementById('k-stage').getBoundingClientRect();
      const over = [...cards].map(c => {
        const b = c.getBoundingClientRect();
        return Math.max(b.bottom - st.bottom, st.top - b.top, st.left - b.left, b.right - st.right);
      });
      const clipped = over.filter(o => o > 0.5).length;
      const worstOver = Math.round(Math.max(...over));
      const dirge = document.getElementById('k-int-dirge').textContent;
      return { disjoint, rows, bars, cards: cards.length,
        fanned, pips,
        noMove: !document.querySelector('.k-hero-move'),
        ap: document.getElementById('k-ap-num').textContent,
        cycle: document.getElementById('k-cycle-n').textContent,
        bond: document.getElementById('k-bond-n').textContent, dirge: !!dirge, clipped, worstOver,
        inBossCol, oneLine, noBanner, intentFits,
        num: document.getElementById('k-int-val').textContent.trim(),
        tgt: document.getElementById('k-int-tgt').textContent.trim() };
    });
    check('UI: intent clear of the Regent AND both HUDs; stacked rows; fanned hand; 12 Break pips; intent is one line beside the Regent, no banner; no card clipped',
      ui.disjoint && ui.rows === 3 && ui.bars === 3 && ui.cards === 5 && ui.fanned
      && ui.pips === 12 && ui.noMove && ui.ap === '3' && ui.cycle === '1' && ui.bond === '0/2'
      && ui.dirge && ui.clipped === 0 && ui.inBossCol && ui.oneLine && ui.noBanner && ui.intentFits
      && ui.num === '21' && /ASH/.test(ui.tgt) && /×3/.test(ui.tgt),
      JSON.stringify(ui));
    const hover = await J(async () => {
      const card = document.querySelector('#k-hand .k-card');
      const r = card.getBoundingClientRect();
      card.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: r.left + 200, clientY: r.top - 100 }));
      await new Promise(res => setTimeout(res, 60));
      return !card.classList.contains('k-dragging');
    });
    check('UI: a bare hover is not a drag — pointer tracking arms only on a real press', hover, '');
  }
  // ── the aim beam, restored from v2.2 ──
  await fresh(7);
  {
    const beam = await J(async () => {
      const card = [...document.querySelectorAll('#k-hand .k-card')]
        .find(c => c.dataset.card && window.K.evaluateCard(c.dataset.card).card.target === 'enemy');
      const r = card.getBoundingClientRect();
      const boss = document.getElementById('k-boss-art').getBoundingClientRect();
      const at = (x, y, t) => card.dispatchEvent(new PointerEvent(t, { bubbles: true, clientX: x, clientY: y, pointerId: 1 }));
      at(r.left + r.width / 2, r.top + 10, 'pointerdown');
      at(boss.left + boss.width / 2, boss.top + boss.height / 2, 'pointermove');
      await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
      const svg = document.getElementById('k-aim');
      const out = {
        layer: !!svg,
        glow: !!svg && !!svg.querySelector('.k-aim-glow'),
        dotted: !!svg && svg.querySelector('.k-aim-dash')
          && svg.querySelector('.k-aim-dash').getAttribute('stroke-dasharray') === '3 9',
        crimson: !!svg && /#e05b52/i.test(svg.querySelector('.k-aim-dash').getAttribute('stroke') || ''),
        reticle: !!svg && !!svg.querySelector('.k-aim-ret'),
        brackets: !!svg && !!svg.querySelector('.k-aim-r1 path') && !!svg.querySelector('.k-aim-dot'),
        bowed: !!svg && /^M .+ Q .+ .+$/.test(svg.querySelector('.k-aim-dash').getAttribute('d') || ''),
        snapped: document.getElementById('k-boss-art').classList.contains('k-aim-snap'),
      };
      // the card TRACKS the finger (v2.2 feel), trailing down-left of it so it
      // never covers the arc and reticle it is casting
      const held = card.getBoundingClientRect();
      const pxx = boss.left + boss.width / 2, pyy = boss.top + boss.height / 2;
      out.tracksFinger = Math.abs(held.left + held.width / 2 - pxx) < 140;
      out.trailsBelowLeft = (held.top + held.height / 2) > pyy
        && (held.left + held.width / 2) < pxx;
      at(boss.left + boss.width / 2, boss.top + boss.height / 2, 'pointerup');
      out.cleared = !document.getElementById('k-aim').querySelector('.k-aim-dash');
      return out;
    });
    check('AIM: picking a card casts the v2.2 beam — crimson dotted arc, bracket reticle',
      beam.layer && beam.glow && beam.dotted && beam.crimson && beam.reticle
      && beam.brackets && beam.bowed, JSON.stringify(beam));
    check('AIM: the beam snaps to a legal target and clears on release',
      beam.snapped && beam.cleared, JSON.stringify({ snapped: beam.snapped, cleared: beam.cleared }));
    check('AIM: the card follows the finger, trailing clear of its own reticle',
      beam.tracksFinger && beam.trailsBelowLeft,
      JSON.stringify({ tracks: beam.tracksFinger, trails: beam.trailsBelowLeft }));
  }
  // ── card anatomy: Slay-the-Spire readability on a phone ──
  await fresh(11);
  {
    const anat = await J(() => {
      window.K.forceHand(['crosssever', 'cleave', 'mend', 'serrate', 'twinfang']);
      const q = (id) => document.querySelector('.k-card[data-card="' + id + '"]');
      const cs = q('crosssever'), cl = q('cleave');
      const px = (el, p) => el ? parseFloat(getComputedStyle(el)[p]) : 0;
      return {
        gem: cs.querySelector('.k-cgem').textContent.trim(),
        prose: cs.querySelector('.k-cprose').textContent.replace(/\s+/g, ' ').trim(),
        bolded: cs.querySelectorAll('.k-cprose b').length,
        icons: cs.querySelectorAll('.k-cprose .k-ico').length,
        condIcon: !!cs.querySelector('.k-cline .k-ico'),
        ratio: +(cs.offsetWidth / cs.offsetHeight).toFixed(3),
        cond: cs.querySelector('.k-cline').textContent.replace(/\s+/g, ' ').trim(),
        plainProse: cl.querySelector('.k-cprose').textContent.replace(/\s+/g, ' ').trim(),
        noCondOnCore: !cl.querySelector('.k-cline'),
        proseSize: px(cs.querySelector('.k-cprose'), 'fontSize'),
        gemSize: px(cs.querySelector('.k-cgem'), 'fontSize'),
        textBox: !!cs.querySelector('.k-ctext'),
      };
    });
    check('CARD: the rules are plain sentences, iconed and with the numbers bolded',
      anat.prose === '9 damage. 2 Break.' && anat.bolded === 2 && anat.icons === 2
      && anat.plainProse === '6 damage.' && anat.textBox && anat.noCondOnCore,
      JSON.stringify(anat));
    check('CARD: the conditional clause is labelled and iconed, in the same text box',
      anat.cond === 'Follow-Up: costs 1 AP.' && anat.condIcon
      && anat.proseSize >= 8 && anat.gemSize >= 12,
      JSON.stringify({ cond: anat.cond, icon: anat.condIcon, prose: anat.proseSize, gem: anat.gemSize }));
    check('CARD: MTG-Arena proportion — the face is 63:88, not a tall slab',
      Math.abs(anat.ratio - 63 / 88) < 0.02, 'w/h = ' + anat.ratio + ' (target ' + (63 / 88).toFixed(3) + ')');
    const live = await J(() => {
      window.K.playCard('serrate');   // Mira first — Follow-Up needs a DIFFERENT hero
      const cs = document.querySelector('.k-card[data-card="crosssever"]');
      return { on: cs.querySelector('.k-cline').classList.contains('on'),
               gem: cs.querySelector('.k-cgem').textContent.replace(/\s+/g, ''),
               gemLit: cs.querySelector('.k-cgem').classList.contains('on') };
    });
    check('CARD: a live condition lights its clause and restrikes the cost orb',
      live.on && live.gem === '12' && live.gemLit, JSON.stringify(live));
  }
  // ── StS numbers: nothing on screen should read in thousands ──
  await fresh(9);
  {
    const scale = await J(() => ({
      ash: document.querySelector('.k-pt-hero[data-hero="ash"] .k-pt-hp b').textContent.trim(),
      boss: document.getElementById('k-bhp').textContent.trim(),
      intent: document.getElementById('k-int-val').textContent.trim(),
      commas: [...document.querySelectorAll('#k-hand .k-cprose, .k-pt-hp, #k-bhp, #k-int-val')]
        .filter(e => /\d,\d/.test(e.textContent)).length,
    }));
    check('SCALE: HP and damage read at Slay-the-Spire size — no four-digit numbers',
      scale.ash === '42' && scale.boss === '120' && scale.commas === 0
      && Number(scale.intent) < 100, JSON.stringify(scale));
  }
  // ── lifting a card: it follows the finger, the way v2.2 played ──
  await fresh(7);
  {
    const lift = await J(async () => {
      const card = [...document.querySelectorAll('#k-hand .k-card')]
        .find(c => window.K.evaluateCard(c.dataset.card).card.target === 'enemy');
      const st = document.getElementById('k-stage').getBoundingClientRect();
      const r0 = card.getBoundingClientRect();
      const at = (x, y, t) => card.dispatchEvent(new PointerEvent(t, { bubbles: true, clientX: x, clientY: y, pointerId: 1 }));
      at(r0.left + r0.width / 2, r0.top + 10, 'pointerdown');
      at(r0.left + r0.width / 2, r0.top - 60, 'pointermove');
      await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
      const a1 = card.getBoundingClientRect();
      const boss = document.getElementById('k-boss-art').getBoundingClientRect();
      at(boss.left + boss.width / 2, boss.top + boss.height / 2, 'pointermove');
      await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
      const a2 = card.getBoundingClientRect();
      const out = {
        aiming: card.classList.contains('k-aiming'),
        lifted: a1.top < r0.top - 20,
        // the whole point: the card KEEPS moving with the finger, no wall
        followed: a2.left - a1.left > 60,
        onStage: a2.top > st.top && a2.bottom < st.bottom + 1,
        snapped: document.getElementById('k-boss-art').classList.contains('k-aim-snap'),
      };
      at(boss.left + boss.width / 2, boss.top + boss.height / 2, 'pointerup');
      return out;
    });
    check('LIFT: the card tracks the finger the whole way — nothing parks or sticks',
      lift.aiming && lift.lifted && lift.followed && lift.onStage && lift.snapped,
      JSON.stringify(lift));
  }
  // ── the parry: v2.2's closing ring over a dimmed board ──
  await fresh(7);
  {
    const ring = await J(async () => {
      window.K.forceIntent('hymn');
      window.K.endTurn();                      // live rhythm, no grades passed
      await new Promise(res => setTimeout(res, 620));   // past the lead-in
      const st = document.getElementById('k-stage');
      const r = st.querySelector('.k-pring');
      const cs = r && getComputedStyle(r.querySelector('.k-pr-close'));
      const out = {
        ring: !!r,
        target: !!(r && r.querySelector('.k-pr-target')),
        closing: !!(cs && cs.animationName === 'k-prclose'),
        label: r && r.querySelector('.k-pr-lbl').textContent.trim(),
        focus: st.classList.contains('k-parry-focus'),
        thread: !!st.querySelector('.k-pthread'),
        lit: !!st.querySelector('.k-hero.k-parrying'),
        noTravellers: !st.querySelector('.k-note'),
      };
      await new Promise(res => setTimeout(res, 420));
      out.livesUp = !!st.querySelector('.k-pring.k-pr-live');
      return out;
    });
    check('PARRY: a ring closes on a dashed sweet spot over a desaturated board',
      ring.ring && ring.target && ring.closing && ring.focus && ring.thread
      && ring.lit && ring.noTravellers, JSON.stringify(ring));
    check('PARRY: the note counts itself against the whole volley and lights when gradeable',
      /^1\/7$|^TAP!$/.test(ring.label) && ring.livesUp, JSON.stringify({ label: ring.label, live: ring.livesUp }));
  }
  await settle();
  // ── the beat: one metronome across the whole volley ──
  await fresh(7);
  {
    const beat = await J(async () => {
      window.K.forceIntent('hymn');
      window.K.endTurn();
      await new Promise(res => setTimeout(res, 620));
      const st = document.getElementById('k-stage');
      const seq = st.querySelector('#k-seq');
      const out = {
        pulse: !!st.querySelector('#k-beat'),
        beatMs: st.querySelector('#k-beat') && st.querySelector('#k-beat').style.getPropertyValue('--beat'),
        track: !!seq,
        dots: seq ? seq.children.length : 0,
        kinds: seq ? [...seq.children].map(d => d.className.replace('k-sq ', '').split(' ')[0]).join(',') : '',
      };
      // ring closes ON the beat: measure two successive impacts
      const stamps = new Set();
      for (let i = 0; i < 60; i++) {
        st.querySelectorAll('.k-pring').forEach(r => {
          if (r.dataset.impact) stamps.add(Math.round(+r.dataset.impact));
        });
        await new Promise(res => setTimeout(res, 40));
      }
      const sorted = [...stamps].sort((a, b) => a - b);
      out.gaps = sorted.slice(1).map((v, i) => v - sorted[i]);
      return out;
    });
    // every gap must be a whole number of beats — a skipped beat is still on grid
    const onGrid = beat.gaps.length && beat.gaps.every(g => Math.abs(g / 500 - Math.round(g / 500)) < 0.08);
    check('BEAT: the whole volley runs on one 120 BPM metronome, rings closing on the beat',
      beat.pulse && beat.beatMs === '500ms' && onGrid,
      JSON.stringify({ pulse: beat.pulse, beat: beat.beatMs, gaps: beat.gaps }));
    check('BEAT: a sequence track shows every note of the bar, typed by gesture',
      beat.track && beat.dots === 7 && /k-sq-slide/.test(beat.kinds) && /k-sq-hold/.test(beat.kinds),
      JSON.stringify({ dots: beat.dots, kinds: beat.kinds }));
  }
  await settle();
  // ── an early press is forgiven, not consumed ──
  await fresh(7);
  {
    const early = await J(async () => {
      window.K.forceIntent('hymn');
      window.K.endTurn();
      await new Promise(res => setTimeout(res, 640));     // ring is up, beat is not
      const st = document.getElementById('k-stage');
      st.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 400, clientY: 200, pointerId: 3 }));
      await new Promise(res => setTimeout(res, 60));
      return { stillLive: !!st.querySelector('.k-pring'),
               nudged: !!st.querySelector('.k-grade-early') || !!st.querySelector('.k-pr-early') };
    });
    check('PARRY: pressing way early nudges and keeps listening — the note is not spent',
      early.stillLive && early.nudged, JSON.stringify(early));
  }
  await settle();
  // ── snapping: a blunt finger still finds the right target ──
  await fresh(7);
  {
    const snap = await J(() => {
      const enemyCard = [...document.querySelectorAll('#k-hand .k-card')]
        .find(c => window.K.evaluateCard(c.dataset.card).card.target === 'enemy');
      const partyCard = [...document.querySelectorAll('#k-hand .k-card')]
        .find(c => window.K.evaluateCard(c.dataset.card).card.target !== 'enemy');
      const boss = document.getElementById('k-boss-art').getBoundingClientRect();
      const ash = document.querySelector('.k-hero[data-hero="ash"]').getBoundingClientRect();
      const K = window.K;
      return {
        // well short of the Regent, but nothing else is nearer: still snaps
        nearMiss: K.dropTargetAt(boss.left - 70, boss.top + boss.height / 2, enemyCard.dataset.card),
        // an attack never snaps to a hero, however close the finger is
        wrongSide: K.dropTargetAt(ash.left + 5, ash.top + 20, enemyCard.dataset.card),
        // a party card near Ash picks Ash specifically
        ally: K.dropTargetAt(ash.left + 4, ash.top + 30, partyCard.dataset.card),
        // and nothing at all when the finger is miles away
        far: K.dropTargetAt(6, 424, enemyCard.dataset.card),
      };
    });
    check('SNAP: a near miss still finds the Regent, and an attack never snaps to an ally',
      snap.nearMiss && snap.nearMiss.zone === 'enemy' && snap.nearMiss.snapped
      && (!snap.wrongSide || snap.wrongSide.zone === 'enemy'),
      JSON.stringify({ near: snap.nearMiss, wrong: snap.wrongSide }));
    check('SNAP: a party card picks the nearest hero, and a wild throw picks nothing',
      snap.ally && snap.ally.zone === 'party' && snap.ally.hero === 'ash' && !snap.far,
      JSON.stringify({ ally: snap.ally, far: snap.far }));
  }
  // ── the piles open, Slay-the-Spire style ──
  await fresh(7);
  {
    const pile = await J(() => {
      document.getElementById('k-deck-btn').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      const f = document.getElementById('k-focus');
      const out = {
        open: !f.classList.contains('k-hidden'),
        head: f.querySelector('.k-pile-head') && f.querySelector('.k-pile-head').textContent.replace(/\s+/g, ' ').trim(),
        cards: f.querySelectorAll('.k-pile-grid .k-card').length,
        deckN: window.K.state().deck.length,
        readable: !!f.querySelector('.k-pile-grid .k-cprose'),
        // opening the draw pile must not leak the shuffle
        sorted: [...f.querySelectorAll('.k-pile-grid .k-cname')].map(n => n.textContent),
        drawOrder: window.K.state().deck.slice().map(id => window.K.evaluateCard(id).card.name),
      };
      document.getElementById('k-stage').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 460, clientY: 40 }));
      out.closed = document.getElementById('k-focus').classList.contains('k-hidden');
      return out;
    });
    check('PILES: the draw pile opens as readable cards and closes on a tap',
      pile.open && pile.cards === pile.deckN && pile.readable && pile.closed
      && /DRAW PILE/.test(pile.head), JSON.stringify({ head: pile.head, cards: pile.cards, deck: pile.deckN }));
    check('PILES: opening the draw pile does not leak the shuffle order',
      pile.sorted.join('|') !== pile.drawOrder.join('|') || pile.cards <= 1,
      'shown: ' + pile.sorted.slice(0, 3).join(',') + ' … actual: ' + pile.drawOrder.slice(0, 3).join(','));
  }
  // ── the piles are visible objects, and cards are SEEN entering them ──
  await fresh(7);
  {
    const piles = await J(async () => {
      const st = document.getElementById('k-stage').getBoundingClientRect();
      const d = document.getElementById('k-deck-btn').getBoundingClientRect();
      const x = document.getElementById('k-disc-btn').getBoundingClientRect();
      const ap = document.getElementById('k-ap').getBoundingClientRect();
      const et = document.getElementById('k-endturn').getBoundingClientRect();
      const cyc = document.getElementById('k-piles').getBoundingClientRect();
      const overlaps = (a, b) => !(a.right <= b.left || a.left >= b.right
        || a.bottom <= b.top || a.top >= b.bottom);
      const orbRound = getComputedStyle(document.querySelector('.k-ap-chip')).borderRadius;
      const out = {
        deckLeft: d.left - st.left < st.width * 0.35,
        discRight: st.right - x.right < st.width * 0.35,
        lowerThird: d.top - st.top > st.height * 0.6 && x.top - st.top > st.height * 0.6,
        // the resource is round and the zones are rectangles — never the same shape
        orbRound: /50%/.test(orbRound),
        // the resource sits ABOVE its corner pile, Spire-style, and nothing
        // in the bottom bar overlaps anything else
        orbAboveDeck: ap.bottom <= d.top,
        endTurnAboveDiscard: et.bottom <= x.top,
        noOverlap: !overlaps(ap, d) && !overlaps(ap, x) && !overlaps(et, x)
          && !overlaps(et, d) && !overlaps(cyc, ap) && !overlaps(cyc, d) && !overlaps(d, x),
        deckN: document.getElementById('k-deck-n').textContent,
        discN: document.getElementById('k-disc-n').textContent,
        stateDeck: String(window.K.state().deck.length),
        stacked: !!document.querySelector('#k-deck-btn .k-pile-stack'),
      };
      // playing a card sends a ghost of it to the discard, and the pile thumps
      window.K.forceHand(['cleave', 'mend', 'serrate', 'frostbind', 'twinfang']);
      window.K.playCard('cleave');
      out.flying = document.querySelectorAll('.k-fly').length;
      out.thumped = document.getElementById('k-disc-btn').classList.contains('k-pile-thump');
      await new Promise(r => setTimeout(r, 260));
      out.landed = document.querySelectorAll('.k-fly').length === 0;
      out.discAfter = document.getElementById('k-disc-n').textContent;
      return out;
    });
    check('PILES: a draw stack and a discard stack sit in the lower corners, counting live',
      piles.deckLeft && piles.discRight && piles.lowerThird && piles.stacked
      && piles.deckN === piles.stateDeck, JSON.stringify(piles));
    check('BOTTOM BAR: round resource above its pile, action above its pile, nothing overlapping',
      piles.orbRound && piles.orbAboveDeck && piles.endTurnAboveDiscard && piles.noOverlap,
      JSON.stringify({ round: piles.orbRound, orbAbove: piles.orbAboveDeck,
        etAbove: piles.endTurnAboveDiscard, clear: piles.noOverlap }));
    check('PILES: a played card is seen flying into the discard, and the pile thumps',
      piles.flying >= 1 && piles.thumped && piles.landed && piles.discAfter === '1',
      JSON.stringify({ flying: piles.flying, thump: piles.thumped, after: piles.discAfter }));
  }
  // ── the end-of-turn sweep, card by card ──
  await fresh(8);
  {
    const sweep = await J(async () => {
      window.K.forceHand(['cleave', 'mend', 'serrate', 'frostbind', 'twinfang']);
      window.K.forceIntent('benediction');
      const held = window.K.state().hand.length;
      window.K.endTurn({ grades: ['miss', 'miss'] });
      await new Promise(r => setTimeout(r, 40));
      const mid = document.querySelectorAll('.k-fly').length;
      await new Promise(r => setTimeout(r, 900));
      const s = window.K.state();
      return { held, mid, hand: s.hand.length, discard: s.discard.length };
    });
    check('SWEEP: ending the turn throws the whole hand to the discard, one card at a time',
      sweep.mid >= 1 && sweep.discard >= sweep.held && sweep.hand === 5,
      JSON.stringify(sweep));
  }
  // ── hold to inspect, release to dismiss (MTG Arena) ──
  await fresh(7);
  {
    const insp = await J(async () => {
      const card = document.querySelector('#k-hand .k-card');
      const id = card.dataset.card;
      const r = card.getBoundingClientRect();
      const at = (t) => card.dispatchEvent(new PointerEvent(t, { bubbles: true, clientX: r.left + 20, clientY: r.top + 20, pointerId: 1 }));
      const before = window.K.state().hand.length;
      at('pointerdown');
      await new Promise(res => setTimeout(res, 560));
      const f = document.getElementById('k-focus');
      const open = !f.classList.contains('k-hidden');
      const big = !!f.querySelector('.k-insp-card .k-cprose');
      const dimmed = document.getElementById('k-stage').classList.contains('k-inspecting');
      const noCommit = !f.querySelector('#k-focus-commit');
      at('pointerup');
      return { open, big, dimmed, noCommit,
               closed: document.getElementById('k-focus').classList.contains('k-hidden'),
               unplayed: window.K.state().hand.length === before && window.K.state().hand.includes(id) };
    });
    check('INSPECT: holding blows the card up over a dimmed board, MTG-Arena style',
      insp.open && insp.big && insp.dimmed && insp.noCommit, JSON.stringify(insp));
    check('INSPECT: releasing dismisses it and never plays the card',
      insp.closed && insp.unplayed, JSON.stringify({ closed: insp.closed, unplayed: insp.unplayed }));
    // the iOS long-press callout must be suppressed on cards
    const ios = await J(async () => {
      const card = document.querySelector('#k-hand .k-card');
      const cs = getComputedStyle(card);
      const ev = new Event('contextmenu', { bubbles: true, cancelable: true });
      const prevented = !card.dispatchEvent(ev);
      // Chromium does not implement -webkit-touch-callout, so assert the
      // declaration ships in the stylesheet rather than reading it back
      const css = await (await fetch('styles.css?v=12')).text();
      const rule = css.slice(css.indexOf('.k-card {'), css.indexOf('.k-card {') + 260);
      return { calloutShipped: /-webkit-touch-callout:\s*none/.test(rule),
               highlightShipped: /-webkit-tap-highlight-color:\s*transparent/.test(rule),
               select: cs.userSelect || cs.webkitUserSelect, touch: cs.touchAction, prevented };
    });
    check('INSPECT: a long press cannot raise the iOS callout or select text',
      ios.calloutShipped && ios.highlightShipped && ios.select === 'none'
      && ios.touch === 'none' && ios.prevented, JSON.stringify(ios));
  }

  const summary = report();
  await H.browser.close();
  process.exit(summary.passed === summary.total && summary.errs === 0 ? 0 : 1);
})().catch(e => { console.error('SUITE CRASH:', e); process.exit(2); });
