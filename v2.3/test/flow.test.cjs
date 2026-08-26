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

  // ═══ A00 · ONE PRESS ANSWERS ONE NOTE ═══
  // The Hymn opens with two taps half a beat apart — 250ms — inside a grading
  // window that runs land−260ms to land+290ms. Both notes were listening, both
  // had their own stage-level pointerdown, and one finger fired both: the
  // first graded PERFECT and the second was silently eaten as an early GOOD
  // the player never played. The Regent's signature intent could not be played
  // FLAWLESS at all. Nothing in the suite noticed, because nothing in the
  // suite had ever pressed a real button.
  console.log('\n── one press, one note ──');
  {
    const arb = await J(() => {
      // two notes 250ms apart, a press dead on the first
      const now = 1000;
      const A = { landAt: now, kind: 'tap' }, B = { landAt: now + 250, kind: 'tap' };
      const K = window.K;
      if (!K._liveTest) return null;
      return K._liveTest([A, B], [
        { at: now,       want: 'A' },   // dead on A
        { at: now + 250, want: 'B' },   // dead on B
        { at: now + 100, want: 'A' },   // nearer A
        { at: now + 160, want: 'B' },   // nearer B
      ]);
    });
    check('PRESS: two notes a half-beat apart never both answer one finger',
      arb && arb.every(r => r.got === r.want), JSON.stringify(arb));

    // and the same rule is what stops a bait being "touched" by a press aimed
    // at the note after it
    const bait = await J(() => {
      const K = window.K;
      const now = 2000;
      const skull = { landAt: now, kind: 'bait' }, tap = { landAt: now + 500, kind: 'tap' };
      return K._liveTest([skull, tap], [
        { at: now,       want: 'A' },   // touching the skull is touching the skull
        { at: now + 260, want: 'B' },   // eager about the TAP, not the skull
        { at: now + 500, want: 'B' },
      ]);
    });
    check('PRESS: a press aimed at the note after a bait never counts as touching the skull',
      bait && bait.every(r => r.got === r.want), JSON.stringify(bait));
  }

  // ═══ A0 · WHAT THE SCREEN ACTUALLY SAYS OUT LOUD ═══
  // A comprehension pass found five things a first-time player is never told.
  // Each fix is one line of text or one icon; each is worth a gate, because
  // the failure mode of a hint is that it silently stops being rendered and
  // nobody notices for six builds.
  console.log('\n── what the screen says ──');
  {
    const dirge = await J(() => {
      window.K.forceIntent('hymn');
      const t = (document.getElementById('k-intent') || {}).textContent || '';
      return { text: t, dirge: window.K.dirgeAmount() };
    });
    check('SAYS: the dirge admits it cannot be parried — it looks like every blow that can be',
      dirge.dirge <= 0 || /no parry/i.test(dirge.text), JSON.stringify(dirge));

    const cue = await J(() => {
      const rows = [...document.querySelectorAll('.k-hero .k-hero-row')];
      return { n: rows.length, cues: rows.filter(r => r.querySelector('.k-movecue')).length,
               words: rows.map(r => (r.querySelector('b') || {}).textContent).join(',') };
    });
    check('SAYS: every hero carries a step cue — nothing else said a figure could be moved',
      cue.n === 3 && cue.cues === 3 && /FRONT/.test(cue.words), JSON.stringify(cue));

    // renderHeroes writes the row word on every render; if it ever writes over
    // the whole plate again the cue disappears and only this notices
    const survives = await J(() => {
      window.K.render();
      return document.querySelectorAll('.k-hero .k-hero-row .k-movecue').length;
    });
    check('SAYS: the step cue survives a re-render — it used to be written over',
      survives === 3, survives + ' of 3');

    const swap = await J(() => {
      const hint = document.querySelector('#k-deck-btn .k-cycle-hint');
      return { text: hint ? hint.textContent : null,
               titles: document.querySelectorAll('#k-deck-btn[title], #k-cycle-dot[title]').length };
    });
    check('SAYS: the free swap is written on the pile, not hidden in a hover tooltip on a touchscreen',
      !!swap.text && /swap/i.test(swap.text) && swap.titles === 0, JSON.stringify(swap));

    // A FEINT IS GRADED LIKE A TAP — press on the beat; doing nothing MISSES.
    // Its arrival label is WAIT, which two independent reviewers of this game
    // read as "do nothing" (the bait's rule). The note has to say NOW when the
    // window opens or the label is teaching the wrong answer.
    const feint = await J(() => {
      const words = window.K._noteWords ? window.K._noteWords() : null;
      return words;
    });
    check('SAYS: a feint says WAIT while it closes and NOW when it opens — doing nothing misses it',
      feint && feint.feint === 'WAIT' && feint.feintLive === 'NOW!'
      && feint.holdLive === 'RELEASE!' && feint.tapLive === 'TAP!'
      && feint.burstLive === null,          // a burst keeps its live tally
      JSON.stringify(feint));

    const early = await J(() => window.K.parryGrade(-400));
    check('SAYS: a rushed input is EARLY, not WAIT — WAIT is a feint’s own correct answer',
      early === null, 'way-early holds the note: ' + JSON.stringify(early));
  }

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
    const src = await J(async () => (await (await fetch('game.js?v=14')).text()));
    const phaseWrites = (src.match(/C\.phase = /g) || []).length;
    check('ONE TRANSITION OWNER: setPhase is the only C.phase mutator', phaseWrites === 1, phaseWrites + ' assignments');
    check('NO FLOW METER, NO ACTION TRAIL: nothing renders a meter or a trail', await J(() =>
      !document.querySelector('#k-flow, .k-flow, .k-trail, .k-action-trail')), '');
    // The name used to promise the Follow-Up floor as well, which this check
    // never exercised — it only read printed costs. The clamp is now actually
    // driven here: a 1-cost card whose condition would discount it further has
    // to come out at 1, never 0.
    check('COST FLOOR: every printed cost ≥ 1, and a discount can never reach 0', await J(() => {
      const defs = ['cleave','guardcut','cstance','crosssever','lastlight','lcascade','mend','frostbind','sgrace','intercession','serrate','qthrow','twinfang','backstab','execute','lightsteel'];
      const printed = defs.every(id => window.K.evaluateCard(id).card.cost >= 1);
      // DRIVE THE CLAMP, do not restate it. `Math.max(1, 0) === 1` would be a
      // test of JavaScript, not of this deck. Both paths into currentCost get
      // a zero pushed through them via the per-fight card overlay, and both
      // have to come back 1.
      const C = window.K.state();
      const keepA = C.cards.cleave, keepB = C.cards.crosssever;
      C.cards.cleave = { ...keepA, cost: 0 };
      const basePath = window.K.evaluateCard('cleave').currentCost;
      C.cards.crosssever = { ...keepB, cond: { ...keepB.cond, costTo: 0 } };
      const ev = window.K.evaluateCard('crosssever');
      // only meaningful while the condition is live; when it is not, the base
      // cost is what is read and the base cost is already ≥ 1
      const condPath = ev.condActive ? ev.currentCost : 1;
      C.cards.cleave = keepA; C.cards.crosssever = keepB;
      return printed && basePath === 1 && condPath === 1
        && defs.every(id => window.K.evaluateCard(id).currentCost >= 1);
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
    // THE FINALE IS THE LAST BLOW, not something bought after it. The card
    // completing the trio is what fires it — the old rule wanted all three to
    // have already acted, which costs the whole turn and left nothing to
    // finish with. Measured firing 0 times in 466 turns.
    await J(() => window.K.forceHand(['lcascade', 'serrate', 'lastlight', 'mend', 'cleave']));
    const cold = await J(() => window.K.evaluateCard('lastlight'));
    await J(() => window.K.playCard('lcascade'));                 // Elin
    const two = await J(() => window.K.evaluateCard('lastlight').condActive);
    await J(() => window.K.playCard('serrate'));                  // Mira
    const fin = await J(() => {
      const ev = window.K.evaluateCard('lastlight');
      return { active: ev.condActive, cost: ev.currentCost,
               dmg: ev.resolvedEffects.reduce((n, fx) => n + (fx.dmg || 0), 0),
               ap: window.K.state().ap };
    });
    const cs = await J(() => {
      const ev = window.K.evaluateCard('crosssever');   // follow-up is live after Mira
      return { cost: ev.currentCost, dmg: ev.resolvedEffects.reduce((n, fx) => n + (fx.dmg || 0), 0) };
    });
    const landed = await J(() => {
      const before = window.K.state().boss.hp;
      const ok = window.K.playCard('lastlight');                  // Ash completes it
      return { ok, dealt: before - window.K.state().boss.hp, ap: window.K.state().ap };
    });
    check('FINALE: the card that completes the trio IS the finale',
      !cold.condActive && !two && fin.active, 'after one other hero: ' + two);
    check('FINALE IS REACHABLE: Elin, Mira, then the finisher — inside one 3 AP turn',
      fin.ap === 1 && landed.ok && landed.dealt === 15 && landed.ap === 0,
      JSON.stringify({ apBefore: fin.ap, landed }));
    check('NO DUAL BONUS: Finale grants output, cost stays 1',
      fin.cost === 1 && fin.dmg === 15 && cold.currentCost === 1, JSON.stringify(fin));
    check('NO DUAL BONUS: Follow-Up Cross Sever costs 1, output stays 9',
      cs.cost === 1 && cs.dmg === 9, JSON.stringify(cs));
  }

  // ── the load a hand of five actually puts on you ──
  await fresh(11);
  {
    const load = await J(() => {
      const ALL = ['cleave','guardcut','cstance','crosssever','lastlight','lcascade','mend',
        'frostbind','sgrace','intercession','serrate','qthrow','twinfang','backstab','execute'];
      const conds = ALL.map(id => window.K.evaluateCard(id).card.cond)
        .filter(Boolean).map(c => c.type);
      const perHero = {};
      for (const id of ALL) {
        const c = window.K.evaluateCard(id).card;
        perHero[c.owner] = (perHero[c.owner] || 0) + (c.cond ? 1 : 0);
      }
      // every keyword must state its own rule in full somewhere the player can reach
      window.K.forceHand(['crosssever', 'cleave', 'mend', 'serrate', 'twinfang']);
      const card = document.querySelector('.k-card[data-card="crosssever"]');
      const r = card.getBoundingClientRect();
      card.dispatchEvent(new PointerEvent('pointerdown',
        { bubbles: true, clientX: r.left + 20, clientY: r.top + 20, pointerId: 21 }));
      return { conds, kinds: [...new Set(conds)].sort(), perHero, count: conds.length };
    });
    const taught = await J(async () => {
      await new Promise(r => setTimeout(r, 500));        // past the hold threshold
      const box = document.querySelector('.k-insp-cond');
      const out = { tag: box && box.querySelector('b').textContent.trim(),
                    rule: box && box.querySelector('span').textContent.trim() };
      window.K.render();
      return out;
    });
    // 15 cards, three heroes: no hero may carry more than two clauses to check,
    // and the whole deck may not exceed four distinct keywords
    check('LOAD: at most two conditional cards per hero, and four keywords in the whole deck',
      Object.values(load.perHero).every(n => n <= 3) && load.count <= 6
      && load.kinds.length <= 4,
      JSON.stringify({ perHero: load.perHero, total: load.count, keywords: load.kinds }));
    check('LOAD: a keyword states its own rule — the name alone teaches nothing',
      /After an Ally/.test(taught.tag || '') && /different hero/.test(taught.rule || ''),
      JSON.stringify(taught));
  }
  await settle();
  // ── two finales, so the trio is a fork and not a script ──
  await fresh(21);
  {
    const fork = await J(() => {
      window.K.forceHand(['serrate', 'cleave', 'mend', 'twinfang', 'frostbind']);
      const st = window.K.state();
      st.heroes.elin.hp = 20; st.heroes.ash.hp = 30; st.heroes.mira.hp = 24;
      window.K.playCard('serrate');                      // Mira
      window.K.playCard('cleave');                       // Ash
      const ev = window.K.evaluateCard('mend');          // Elin closes the round
      const before = { ash: st.heroes.ash.hp, elin: st.heroes.elin.hp, mira: st.heroes.mira.hp };
      window.K.playCard('mend');
      const s2 = window.K.state();
      return { armed: ev.condActive,
               ash: s2.heroes.ash.hp - before.ash, elin: s2.heroes.elin.hp - before.elin,
               mira: s2.heroes.mira.hp - before.mira };
    });
    // Mend heals the most-hurt hero 6, and the FINALE adds 5 to everyone
    check('TWO FINALES: closing with Elin stands the party up instead of killing',
      fork.armed && fork.elin === 11 && fork.ash === 5 && fork.mira === 5, JSON.stringify(fork));
  }
  await settle();
  // ── the combo announces itself ──
  await fresh(21);
  {
    const call = await J(async () => {
      window.K.forceHand(['serrate', 'lcascade', 'lastlight', 'mend', 'cleave']);
      window.K.playCard('serrate'); window.K.playCard('lcascade');
      document.querySelectorAll('.k-combo-call').forEach(t => t.remove());
      window.K.playCard('lastlight');                    // Ash closes: FINALE
      await new Promise(r => setTimeout(r, 40));
      const tags = [...document.querySelectorAll('.k-combo-call')];
      const tag = tags[tags.length - 1];
      return { shown: !!tag, all: tags.map(t => t.textContent.trim()),
               text: tag && tag.textContent.trim(),
               big: !!(tag && tag.classList.contains('k-combo-call-big')),
               shock: document.querySelectorAll('.k-shock-gold').length };
    });
    check('COMBO CALL: a combo you built announces itself, and a FINALE takes the board',
      call.all.length === 1 && call.text === 'All Three' && call.big && call.shock >= 1,
      JSON.stringify(call));
  }
  await settle();
  // ── the three cards the combo probe indicted ──
  await fresh(17);
  {
    const back = await J(() => {
      window.K.forceHand(['backstab', 'cleave', 'mend', 'serrate', 'twinfang']);
      const front = window.K.evaluateCard('backstab');
      window.K.moveHero('mira');                       // step her upstage
      const ev = window.K.evaluateCard('backstab');
      const hp0 = window.K.state().boss.hp;
      window.K.playCard('backstab');
      return { fromFront: front.condActive, fromBack: ev.condActive,
               row: window.K.state().heroes.mira.row,   // Backstab steps her out again
               dealt: hp0 - window.K.state().boss.hp,
               coldDmg: front.resolvedEffects.reduce((n, f) => n + (f.dmg || 0), 0) };
    });
    check('FROM THE BACK: Backstab pays for the row Mira stands in, and steps her out of it',
      !back.fromFront && back.fromBack && back.coldDmg === 5 && back.dealt === 10
      && back.row === 'front', JSON.stringify(back));

    const chain = await J(() => {
      window.K.startCombat({ seed: 17 });
      window.K.forceHand(['serrate', 'cstance', 'sgrace', 'cleave', 'mend']);
      const cold = window.K.evaluateCard('cstance').condActive;
      window.K.playCard('serrate');                    // Mira opens
      const held = window.K.state().hand.length;
      window.K.playCard('cstance');                    // Ash follows: draws
      const drew = window.K.state().hand.length - (held - 1);
      const brk0 = window.K.state().boss.brk;
      window.K.playCard('sgrace');                     // Elin follows: 2 Break
      return { cold, drew, broke: brk0 - window.K.state().boss.brk,
               ap: window.K.state().ap, cost: window.K.evaluateCard('sgrace').currentCost };
    });
    check('CHAIN: a follow-up Counterstance draws, and a follow-up Shared Grace chips Break',
      !chain.cold && chain.drew === 1 && chain.broke === 2 && chain.ap === 0 && chain.cost === 1,
      JSON.stringify(chain));
  }

  // ── the Regent is not a rotation ──
  {
    const vary = await J(async () => {
      const runs = [];
      for (let seed = 0; seed < 6; seed++) {
        window.K.startCombat({ seed: 300 + seed });
        const seq = [];
        for (let t = 0; t < 7; t++) {
          seq.push(window.K.currentIntent().id);
          const r = await window.K.endTurn({ grades: Array(8).fill('miss') });
          if (!r || r.outcome !== 'continue') break;
        }
        runs.push(seq.join(','));
      }
      // count repeats WITHIN a fight — flattening across runs counts the seam
      // between one fight's last intent and the next fight's first
      let repeats = 0;
      for (const r of runs) { const q = r.split(',');
        for (let i = 1; i < q.length; i++) if (q[i] && q[i] === q[i - 1]) repeats++; }
      return { runs, distinct: new Set(runs).size, repeats,
               openers: new Set(runs.map(r => r.split(',')[0])).size,
               kinds: new Set(runs.join(',').split(',')).size };
    });
    // the same seed must still replay exactly; different seeds must not
    const replay = await J(async () => {
      const go = async () => {
        window.K.startCombat({ seed: 777 });
        const seq = [];
        for (let t = 0; t < 6; t++) {
          seq.push(window.K.currentIntent().id);
          const r = await window.K.endTurn({ grades: Array(8).fill('miss') });
          if (!r || r.outcome !== 'continue') break;
        }
        return seq.join(',');
      };
      return { a: await go(), b: await go() };
    });
    check('THE REGENT IS NOT A ROTATION: seeds fight differently, openings vary, and she never repeats back to back',
      vary.distinct >= 4 && vary.repeats === 0 && vary.kinds >= 3 && vary.openers >= 2,
      JSON.stringify({ distinctFights: vary.distinct, backToBackRepeats: vary.repeats,
        distinctOpenings: vary.openers, intentsSeen: vary.kinds, sample: vary.runs.slice(0, 2) }));
    check('THE REGENT IS DETERMINISTIC: the same seed replays the same fight',
      replay.a === replay.b && replay.a.length > 0, JSON.stringify(replay));
  }
  await settle();
  // ── the KIZUNA ladder: what the three of them build together ──
  await fresh(19);
  {
    const kz = await J(async () => {
      const st = window.K.state();
      const bar = document.getElementById('k-kizuna');
      const out = { start: st.kizuna, disabled: bar.disabled, refused: await window.K.allOut() };
      window.K.forceHand(['cleave', 'mend', 'serrate', 'frostbind', 'twinfang']);
      window.K.playCard('cleave');                      // 6 damage
      out.fromDamage = window.K.state().kizuna;
      return out;
    });
    check('KIZUNA: the ladder starts empty and cannot be spent until it is full',
      kz.start === 0 && kz.disabled && kz.refused === false && kz.fromDamage > 0,
      JSON.stringify(kz));

    const turned = await J(async () => {
      const s0 = window.K.state();
      s0.kizuna = 0;
      window.K.forceIntent('benediction');              // one hit, two notes
      const before = window.K.state().kizuna;
      await window.K.endTurn({ grades: ['perfect', 'perfect'] });   // FLAWLESS
      return { before, after: window.K.state().kizuna };
    });
    check('KIZUNA: turning a blow aside charges it — mastery is what builds the ladder',
      turned.after - turned.before >= 14, JSON.stringify(turned));

    const fired = await J(async () => {
      const st = window.K.state();
      st.kizuna = 100; st.boss.hp = 140; window.K.render();
      const bar = document.getElementById('k-kizuna');
      const out = { ready: bar.classList.contains('k-kz-ready'), label: bar.textContent.trim(),
                    enabled: !bar.disabled, hp0: st.boss.hp, brk0: st.boss.brk };
      const ok = await window.K.allOut();
      const s2 = window.K.state();
      out.ok = ok; out.dealt = out.hp0 - s2.boss.hp; out.broke = out.brk0 - s2.boss.brk;
      out.spent = s2.kizuna; out.ap = s2.ap; out.phase = s2.phase;
      out.again = await window.K.allOut();
      return out;
    });
    check('KIZUNA: full, it becomes a button — all three strike, it costs no AP, and it empties',
      fired.ready && /ALL-OUT/.test(fired.label) && fired.enabled && fired.ok
      && fired.dealt >= 24 && fired.broke === 4 && fired.spent === 0 && fired.ap === 3
      && fired.phase === 'PLAYER_READY' && fired.again === false,
      JSON.stringify(fired));
  }
  await settle();

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
    check('PRINTED MOVEMENT: Backstab lunges Mira to the FRONT without spending the phase Move',
      row0 === 'mid' && s.heroes.mira.row === 'front' && s.moved === 0 && canStillMove,
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
      b.brk === 0 && b.broken && b.cancel && conds.execute, JSON.stringify(b));
    // Cleave is a flat 7, and BROKEN takes a quarter more
    check('BROKEN: +25% damage taken during the player phase (7 → 9)',
      hp0 - hp1 === 9, 'took ' + (hp0 - hp1));
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
      const ir = document.getElementById('k-intent').getBoundingClientRect();
      const br = document.getElementById('k-boss-art').getBoundingClientRect();
      const clearOf = (r) => ir.right < r.left || ir.left > r.right || ir.bottom < r.top || ir.top > r.bottom;
      // the telegraph floats in the sky ABOVE the Regent's head: horizontally
      // over the figure, vertically clear of it and of the boss HUD
      const hud = document.getElementById('k-boss-hud').getBoundingClientRect();
      const disjoint = ir.bottom < br.top + br.height * 0.45
        && clearOf(document.getElementById('k-party-hud').getBoundingClientRect());
      const overHead = ir.left > br.left - 40 && ir.right < br.right + 40
        && ir.top >= hud.bottom - 1;
      const oneLine = ir.height < 34;
      const chips = document.querySelectorAll('#k-intent .k-ichip');
      const iconed = [...chips].every(c => c.querySelector('svg.k-ico') && c.querySelector('b'));
      // THE TELEGRAPH IS ICONS AND NUMBERS, plus a fixed, tiny vocabulary of
      // qualifiers — never a name, never a sentence. This used to be "no word
      // of four letters or more", which was a proxy for the real rule and duly
      // failed the moment the dirge had to admit it cannot be parried. The
      // rule is now stated directly: every word on the telegraph must come
      // from the allow-list, so a name or a hint sentence still fails it.
      const OK_WORDS = ['all', 'no', 'parry'];
      const words = (document.getElementById('k-intent').textContent.match(/[A-Za-z]+/g) || []);
      const noWords = words.every(w => OK_WORDS.indexOf(w.toLowerCase()) >= 0);
      const noBanner = !document.getElementById('k-int-notes') && !document.getElementById('k-int-hint')
        && !document.getElementById('k-int-name');
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

      return { disjoint, rows, bars, cards: cards.length,
        fanned, pips,
        noMove: !document.querySelector('.k-hero-move'),
        ap: document.getElementById('k-ap-num').textContent,
        apPips: document.querySelectorAll('#k-ap-pips .k-ap-pip').length,
        apLit: document.querySelectorAll('#k-ap-pips .k-ap-pip:not(.k-ap-off)').length,
        // the far-left furniture is gone: no bond meter, no log line, no CYCLE chip
        gone: !document.querySelector('.k-bond-row') && !document.getElementById('k-piles')
              && !document.querySelector('#k-log:not(.k-sr)'),
        // the telegraph must not print over the Break pips
        breakClear: (() => {
          const a = document.getElementById('k-intent').getBoundingClientRect();
          const b = document.getElementById('k-break').getBoundingClientRect();
          return a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom;
        })(),
        // the ladder lives in the open sky: it must clear both HUDs, the
        // telegraph and every hero — inside the party stack it sat on top of
        // whoever was standing in the back row
        kzClear: (() => {
          const k = document.getElementById('k-kizuna').getBoundingClientRect();
          const hit = (r) => !(k.right <= r.left || k.left >= r.right
            || k.bottom <= r.top || k.top >= r.bottom);
          const others = [document.getElementById('k-party-hud'),
            document.getElementById('k-boss-hud'), document.getElementById('k-intent'),
            ...document.querySelectorAll('.k-hero')];
          return !others.some(n => hit(n.getBoundingClientRect()));
        })(),
        clipped, worstOver,
        overHead, oneLine, noBanner, iconed, noWords, chipN: chips.length,
        preview: window.K.intentPreviewDmg(),
        dirge: !!document.querySelector('#k-intent .k-ichip-dirge'),
        atk: (document.querySelector('#k-intent .k-ichip-atk b') || {}).textContent,
        hasTargetFace: !!document.querySelector('#k-intent .k-ichip-atk img'),
        hasDirge: !!document.querySelector('#k-intent .k-ichip-dirge') };
    });
    check('UI: intent clear of the Regent AND both HUDs; stacked rows; fanned hand; 12 Break pips; telegraph is icon chips above the Regent; no card clipped',
      ui.disjoint && ui.rows === 3 && ui.bars === 3 && ui.cards === 5 && ui.fanned
      && ui.pips === 12 && ui.noMove && ui.ap === '3' && ui.apPips === 3 && ui.apLit === 3
      && ui.gone && ui.breakClear && ui.kzClear
      && ui.clipped === 0 && ui.overHead && ui.oneLine && ui.noBanner
      && ui.iconed && ui.noWords && ui.atk === String(ui.preview) && ui.hasTargetFace && ui.hasDirge,
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
      window.K.forceHand(['crosssever', 'guardcut', 'mend', 'serrate', 'twinfang']);
      const q = (id) => document.querySelector('.k-card[data-card="' + id + '"]');
      // guardcut is the card with NO combo band — Cleave earned one in Build 23
      const cs = q('crosssever'), cl = q('guardcut');
      const px = (el, p) => el ? parseFloat(getComputedStyle(el)[p]) : 0;
      return {
        gem: cs.querySelector('.k-cgem').textContent.trim(),
        // innerText, not textContent: the clauses are on separate lines now and
        // textContent glues them into "9 damage.2 Break."
        prose: cs.querySelector('.k-cprose').innerText.replace(/\s+/g, ' ').trim(),
        proseLines: cs.querySelectorAll('.k-cprose br').length + 1,
        bolded: cs.querySelectorAll('.k-cprose b').length,
        icons: cs.querySelectorAll('.k-cprose .k-ico').length,
        condIcon: !!cs.querySelector('.k-combo-tag .k-ico'),
        ratio: +(cs.offsetWidth / cs.offsetHeight).toFixed(3),
        tag: cs.querySelector('.k-combo-tag').textContent.replace(/\s+/g, ' ').trim(),
        state: (cs.querySelector('.k-combo-state') || {}).textContent || '',
        pay: cs.querySelector('.k-combo-pay').textContent.replace(/\s+/g, ' ').trim(),
        plainProse: cl.querySelector('.k-cprose').innerText.replace(/\s+/g, ' ').trim(),
        noCondOnCore: !cl.querySelector('.k-combo'),
        proseSize: px(cs.querySelector('.k-cprose'), 'fontSize'),
        paySize: px(cs.querySelector('.k-combo-pay'), 'fontSize'),
        gemSize: px(cs.querySelector('.k-cgem'), 'fontSize'),
        banded: getComputedStyle(cs.querySelector('.k-combo')).borderTopWidth,
        textBox: !!cs.querySelector('.k-ctext'),
      };
    });
    check('CARD: the rules are one clause per line, iconed, with the numbers bolded',
      anat.prose === '9 damage. 2 Break.' && anat.proseLines === 2
      && anat.bolded === 2 && anat.icons === 2
      && anat.plainProse === '4 damage. 4 Guard.' && anat.textBox && anat.noCondOnCore,
      JSON.stringify(anat));
    // The combo must not read as one more grey sentence: it is a named,
    // banded block, and the base line is the biggest type on the face.
    check('CARD: the combo is its own banded block — named, iconed, and never a footnote',
      anat.tag === 'After an Ally' && anat.pay === 'costs 1 AP.' && anat.condIcon
      && anat.proseSize >= 9 && anat.proseSize > anat.paySize
      && parseFloat(anat.banded) >= 1 && anat.gemSize >= 12,
      JSON.stringify({ tag: anat.tag, pay: anat.pay, icon: anat.condIcon,
        prose: anat.proseSize, pay_px: anat.paySize, band: anat.banded, gem: anat.gemSize }));
    const face = await J(() => {
      window.K.startCombat({ seed: 11 });
      window.K.forceHand(['serrate', 'crosssever', 'mend', 'lastlight', 'cstance']);
      window.K.playCard('serrate');                    // arms the Follow-Ups
      const c = document.querySelector('.k-card[data-card="crosssever"]');
      const r = c.getBoundingClientRect();
      const box = (sel) => { const n = c.querySelector(sel); const b = n.getBoundingClientRect();
        return { l: b.left - r.left, t: b.top - r.top, r: b.right - r.left, b: b.bottom - r.top }; };
      const gem = box('.k-cgem'), own = box('.k-owner'), name = box('.k-cname');
      const out = {
        // what it costs, top-LEFT. whose it is, top-RIGHT. Both above the name.
        costTopLeft: gem.l < r.width * 0.3 && gem.t < r.height * 0.16,
        ownTopRight: own.r > r.width * 0.7 && own.t < r.height * 0.16,
        nameClear: name.t >= gem.b - 1 && name.t >= own.b - 1,
        nameOneLine: c.querySelector('.k-cname').getBoundingClientRect().height < 26
          && getComputedStyle(c.querySelector('.k-cname')).whiteSpace === 'nowrap',
        armedGlow: getComputedStyle(c).animationName,
      };
      window.K.state().ap = 0; window.K.render();      // nothing affordable now
      const p = document.querySelector('.k-card[data-card="crosssever"]');
      out.poor = p.classList.contains('k-card-poor');
      out.veil = getComputedStyle(p, '::after').backgroundColor;
      out.orbRed = getComputedStyle(p.querySelector('.k-cgem')).borderTopColor;
      out.stillGlows = getComputedStyle(p).animationName;
      return out;
    });
    check('CARD: cost top-left, owner top-right, name on its own line beneath them',
      face.costTopLeft && face.ownTopRight && face.nameClear && face.nameOneLine,
      JSON.stringify(face));
    check('CARD: an armed combo glows gold; an unaffordable card greys out and reddens its cost',
      face.armedGlow === 'k-armed' && face.poor && /rgba?\(/.test(face.veil)
      && face.veil !== 'rgba(0, 0, 0, 0)' && face.stillGlows === 'none'
      && (() => { const m = /rgb\((\d+), (\d+), (\d+)\)/.exec(face.orbRed);
                  return !!m && +m[1] > +m[2] + 40 && +m[1] > +m[3] + 40; })(),
      JSON.stringify({ glow: face.armedGlow, poor: face.poor, veil: face.veil,
        orb: face.orbRed, glowWhenPoor: face.stillGlows }));
    check('CARD: MTG-Arena proportion — the face is 63:88, not a tall slab',
      Math.abs(anat.ratio - 63 / 88) < 0.02, 'w/h = ' + anat.ratio + ' (target ' + (63 / 88).toFixed(3) + ')');
    const live = await J(() => {
      window.K.playCard('serrate');   // Mira first — Follow-Up needs a DIFFERENT hero
      const cs = document.querySelector('.k-card[data-card="crosssever"]');
      return { on: cs.querySelector('.k-combo').classList.contains('on'),
               state: (cs.querySelector('.k-combo-state') || {}).textContent.trim(),
               gem: cs.querySelector('.k-cgem').textContent.replace(/\s+/g, ''),
               gemLit: cs.querySelector('.k-cgem').classList.contains('on') };
    });
    check('CARD: a live combo lights its whole band, says ON, and restrikes the cost orb',
      live.on && live.state === 'ON' && !anat.state && live.gem === '12' && live.gemLit,
      JSON.stringify(Object.assign({ asleep: anat.state }, live)));
  }
  // ── StS numbers: nothing on screen should read in thousands ──
  await fresh(9);
  {
    const scale = await J(() => ({
      ash: document.querySelector('.k-pt-hero[data-hero="ash"] .k-pt-hp b').textContent.trim(),
      boss: document.getElementById('k-bhp').textContent.trim(),
      intent: (document.querySelector('#k-intent .k-ichip-atk b') || {}).textContent,
      commas: [...document.querySelectorAll('#k-hand .k-cprose, .k-pt-hp, #k-bhp, #k-intent b')]
        .filter(e => /\d,\d/.test(e.textContent)).length,
    }));
    check('SCALE: HP and damage read at Slay-the-Spire size — no four-digit numbers',
      scale.ash === '42' && scale.boss === '168' && scale.commas === 0
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
  // ── the rows: v2.2's slots, as ground you can see and drop onto ──
  await fresh(12);
  {
    const rows = await J(async () => {
      const stage = document.getElementById('k-stage');
      const h = document.querySelector('.k-hero[data-hero="ash"]');
      const hr = h.getBoundingClientRect();
      const back = document.querySelector('.k-row[data-row="back"]');
      const mid = document.querySelector('.k-row[data-row="mid"]');
      const front = document.querySelector('.k-row[data-row="front"]');
      const vis = (n) => parseFloat(getComputedStyle(n).opacity);
      const out = { hidden: vis(back), slots: document.querySelectorAll('#k-rows .k-row').length,
                    named: [...document.querySelectorAll('#k-rows .k-row-lbl')]
                      .map(n => n.textContent.trim()).join(',') };
      const at = (x, y, t) => h.dispatchEvent(new PointerEvent(t,
        { bubbles: true, clientX: x, clientY: y, pointerId: 7 }));
      const sr = stage.getBoundingClientRect(), k = sr.width / stage.offsetWidth || 1;
      const centre = (n) => ({ x: sr.left + (n.offsetLeft + n.offsetWidth / 2) * k,
                               y: sr.top + (n.offsetTop + n.offsetHeight / 2) * k });
      at(hr.left + hr.width / 2, hr.top + hr.height / 2, 'pointerdown');
      await new Promise(r => setTimeout(r, 260));      // past the rise transition
      out.raised = vis(back) > 0.9 && vis(mid) > 0.9 && vis(front) > 0.9;
      // MEASURED, not laid out — the lanes sit at real translateZ depths, so
      // offsetLeft is where the box was before the lens moved it.
      const cx = (n) => { const b = n.getBoundingClientRect(); return b.left + b.width / 2; };
      // they run left to right, BACK furthest from the Regent and FRONT nearest
      out.order = cx(back) < cx(mid) && cx(mid) < cx(front);
      out.toward = cx(front) < document.getElementById('k-boss-art').getBoundingClientRect().left;
      // and they must be separable by a thumb, not stacked on each other
      out.spread = Math.min(cx(mid) - cx(back), cx(front) - cx(mid));
      out.here = front.classList.contains('k-row-here');   // Ash starts FRONT
      const hint = document.getElementById('k-movehint');
      out.hint = hint.classList.contains('k-hidden') ? null : hint.textContent.trim();
      const b = centre(back);
      at(b.x, b.y, 'pointermove');
      await new Promise(r => setTimeout(r, 30));
      out.lit = back.classList.contains('k-row-hot');
      at(b.x, b.y, 'pointerup');
      await new Promise(r => setTimeout(r, 60));
      const st = window.K.state();
      out.row = st.heroes.ash.row; out.ap = st.ap; out.moved = st.turnState.moved;
      out.cleared = document.getElementById('k-movehint').classList.contains('k-hidden')
        && !stage.classList.contains('k-moving');
      return out;
    });
    check('ROWS: three named slots run BACK to FRONT toward the Regent, the move is priced',
      rows.slots === 3 && rows.named === 'BACK,MID,FRONT' && rows.hidden < 0.1
      && rows.raised && rows.order && rows.toward && rows.spread >= 70
      && rows.here && /MOVE/.test(rows.hint || ''),
      JSON.stringify({ slots: rows.slots, named: rows.named, order: rows.order,
        toward: rows.toward, spread: Math.round(rows.spread), here: rows.here, hint: rows.hint }));
    check('ROWS: carrying a hero to a named slot and letting go puts them there',
      rows.lit && rows.row === 'back' && rows.ap === 2 && rows.moved === 1 && rows.cleared,
      JSON.stringify({ lit: rows.lit, row: rows.row, ap: rows.ap, moved: rows.moved, cleared: rows.cleared }));
  }
  await settle();
  await fresh(12);
  {
    const sealed = await J(async () => {
      window.K.moveHero('mira');                    // the phase's one move, spent
      const stage = document.getElementById('k-stage');
      const h = document.querySelector('.k-hero[data-hero="ash"]');
      const hr = h.getBoundingClientRect();
      const back = document.querySelector('.k-row[data-row="back"]');
      const sr = stage.getBoundingClientRect(), k = sr.width / stage.offsetWidth || 1;
      const at = (x, y, t) => h.dispatchEvent(new PointerEvent(t,
        { bubbles: true, clientX: x, clientY: y, pointerId: 8 }));
      at(hr.left + hr.width / 2, hr.top + hr.height / 2, 'pointerdown');
      await new Promise(r => setTimeout(r, 30));
      const hint = document.getElementById('k-movehint');
      const out = { why: hint.textContent.trim(), sealed: stage.classList.contains('k-moving-no'),
                    reason: window.K.moveReason('ash') };
      const bx = sr.left + (back.offsetLeft + back.offsetWidth / 2) * k;
      const by = sr.top + (back.offsetTop + back.offsetHeight / 2) * k;
      at(bx, by, 'pointermove');
      await new Promise(r => setTimeout(r, 20));
      out.lit = back.classList.contains('k-row-hot');
      at(bx, by, 'pointerup');
      await new Promise(r => setTimeout(r, 40));
      out.row = window.K.state().heroes.ash.row;
      return out;
    });
    check('ROWS: a move that cannot happen says why and refuses — never a silent nothing',
      sealed.reason === 'already moved' && /ALREADY MOVED/.test(sealed.why)
      && sealed.sealed && !sealed.lit && sealed.row === 'front', JSON.stringify(sealed));
  }
  await settle();
  // ── a blow lands NOW, not at the top of the next turn ──
  await fresh(7);
  {
    const live = await J(async () => {
      window.K.forceIntent('hymn');
      const bar = () => document.querySelector('.k-pt-hero[data-hero="ash"] .k-bar-fill').style.width;
      const num = () => document.querySelector('.k-pt-hero[data-hero="ash"] .k-pt-hp b').textContent;
      const before = { bar: bar(), num: num() };
      const done = window.K.endTurn({ grades: Array(8).fill('miss') });
      const out = { before, drainedDuring: false, phaseWhen: null };
      for (let i = 0; i < 400; i++) {
        const ph = window.K.state().phase;
        if (ph === 'PLAYER_READY' || ph === 'DEFEAT') break;
        if (bar() !== before.bar) { out.drainedDuring = true; out.phaseWhen = ph;
                                    out.midNum = num(); break; }
        await new Promise(r => setTimeout(r, 6));
      }
      await done;
      out.after = { bar: bar(), num: num() };
      return out;
    });
    check('DAMAGE LANDS NOW: the party bar drains while the blow is resolving, not at the next turn',
      live.drainedDuring && live.phaseWhen !== 'PLAYER_READY' && live.after.num !== live.before.num,
      JSON.stringify(live));
  }
  await settle();
  // ── damage numbers are the loudest voice on the board ──
  await fresh(7);
  {
    const nums = await J(async () => {
      const clear = () => document.querySelectorAll('.k-pop').forEach(n => n.remove());
      const px = () => { const p = document.querySelector('.k-pop-dmg');
        return p ? parseFloat(getComputedStyle(p).fontSize) : null; };
      clear();                       // nothing from an earlier block may be measured
      window.K.forceHand(['serrate', 'cleave', 'frostbind', 'lcascade', 'lastlight']);
      window.K.playCard('serrate');            // 3 — the chip tier
      const small = px();
      clear(); window.K.state().ap = 3;
      window.K.playCard('cleave');             // 6 — a step up
      const mid = px();
      // a volley must not print its numbers on top of each other
      window.K.playCard('frostbind');
      const dx = new Set([...document.querySelectorAll('.k-pop')]
        .map(n => n.style.getPropertyValue('--pop-dx'))).size;
      const pops = document.querySelectorAll('.k-pop').length;
      // and a FINALE has to LOOK like one: Elin, Mira, then the finisher
      clear();
      window.K.startCombat({ seed: 7 });
      window.K.forceHand(['lcascade', 'serrate', 'lastlight', 'mend', 'cleave']);
      window.K.playCard('lcascade'); window.K.playCard('serrate');
      clear();
      window.K.playCard('lastlight');          // 15
      const big = px();
      return { small, mid, big, dx, pops };
    });
    check('NUMBERS: damage is legible at a glance and scales with the blow',
      nums.small >= 28 && nums.mid > nums.small && nums.big > nums.mid && nums.big >= 44,
      JSON.stringify({ chip: nums.small, mid: nums.mid, finale: nums.big }));
    check('NUMBERS: a volley fans its numbers apart instead of stacking them',
      nums.pops >= 2 && nums.dx >= 2, JSON.stringify({ pops: nums.pops, distinctOffsets: nums.dx }));
  }
  await settle();
  // ── the diorama: real depth, and a board that is not a stack of decals ──
  await fresh(12);
  {
    const dio = await J(async () => {
      const st = document.getElementById('k-stage');
      const field = document.getElementById('k-field');
      // the figures GLIDE between lanes, so a fresh board is still settling
      await new Promise(r => setTimeout(r, 460));
      const q = (r) => document.querySelector('.k-hero.k-row-' + r).getBoundingClientRect();
      const back = q('back'), mid = q('mid'), front = q('front');
      const out = {
        // the lens is real, not a scale fake
        lens: getComputedStyle(field).perspective,
        // DEPTH: further from the Regent is further away, so smaller and higher
        shrinks: back.width < mid.width && mid.width < front.width,
        lifts: back.bottom < mid.bottom && mid.bottom < front.bottom,
        // and further LEFT — the axis the fight is fought along
        leftward: back.left < mid.left && mid.left < front.left,
        raw: [back, mid, front].map(r => [Math.round(r.left), Math.round(r.bottom),
          Math.round(r.width)].join('/')).join('  '),
        who: [...document.querySelectorAll('.k-hero')].map(h =>
          h.dataset.hero + ':' + (h.className.match(/k-row-\w+/) || [''])[0]).join(' '),
        // atmospheric perspective: the back rank is cooler and dimmer
        airBack: getComputedStyle(document.querySelector('.k-hero.k-row-back img')).filter,
        airFront: getComputedStyle(document.querySelector('.k-hero.k-row-front img')).filter,
        // the figures breathe, each on its own clock
        breathing: [...document.querySelectorAll('.k-hero .k-fig')]
          .map(n => getComputedStyle(n).animationName),
        clocks: new Set([...document.querySelectorAll('.k-hero .k-fig')]
          .map(n => getComputedStyle(n).animationDuration)).size,
      };
      // and the lens answers a blow
      window.K.forceHand(['lastlight', 'cleave', 'mend', 'serrate', 'frostbind']);
      const cast = document.getElementById('k-cast');
      const dz = () => parseFloat(cast.style.getPropertyValue('--cam-dz')) || 0;
      const home = dz();
      window.K.playCard('cleave');
      out.pushed = dz() > home + 20;            // a real dolly, not a scale
      out.rolled = Math.abs(parseFloat(cast.style.getPropertyValue('--cam-r')) || 0) > 0.2;
      await new Promise(r => setTimeout(r, 900));
      out.released = Math.abs(dz() - home) < 12;   // and it comes home
      return out;
    });
    const sat = (f) => { const m = /saturate\(([\d.]+)\)/.exec(f || ''); return m ? +m[1] : 1; };
    check('DIORAMA: the rows are real depth — the far rank is smaller, higher, further left and hazier',
      /px/.test(dio.lens) && dio.shrinks && dio.lifts && dio.leftward
      && sat(dio.airBack) < sat(dio.airFront),
      JSON.stringify({ lens: dio.lens, shrinks: dio.shrinks, lifts: dio.lifts,
        leftward: dio.leftward, back: sat(dio.airBack), front: sat(dio.airFront),
        raw: dio.raw, who: dio.who }));
    check('DIORAMA: the board is not static — every figure breathes on its own clock, and the lens answers a blow',
      dio.breathing.length === 3 && dio.breathing.every(n => n === 'k-breathe')
      && dio.clocks === 3 && dio.pushed && dio.rolled && dio.released,
      JSON.stringify({ breathing: dio.breathing, clocks: dio.clocks,
        pushed: dio.pushed, rolled: dio.rolled, released: dio.released }));
  }
  await settle();
  // ── the beam cannot outlive the card that is throwing it ──
  await fresh(7);
  {
    const stale = await J(async () => {
      const st = document.getElementById('k-stage');
      const card = document.querySelector('.k-card');
      const r = card.getBoundingClientRect();
      const at = (x, y, t) => card.dispatchEvent(new PointerEvent(t,
        { bubbles: true, clientX: x, clientY: y, pointerId: 5 }));
      at(r.left + r.width / 2, r.top + 10, 'pointerdown');
      at(r.left + r.width / 2 + 120, r.top - 60, 'pointermove');
      at(r.left + r.width / 2 + 240, r.top - 90, 'pointermove');
      const drawn = !!document.querySelector('#k-aim .k-aim-dash');
      window.K.render();                       // anything that rebuilds the hand
      await new Promise(res => setTimeout(res, 140));
      const svg = document.getElementById('k-aim');
      const d = svg && svg.querySelector('.k-aim-dash');
      return { drawn, left: !!d, path: d ? d.getAttribute('d') : null };
    });
    check('AIM: the beam dies with the card — a re-render cannot strand it in the corner',
      stale.drawn && !stale.left, JSON.stringify(stale));
  }
  await settle();
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
        count: r && r.querySelector('.k-pr-n') && r.querySelector('.k-pr-n').textContent.trim(),
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
    // The VERB is readable from the first frame — a ring that only says "1/6"
    // tells you when and never what — and the beat count keeps its own line.
    check('PARRY: the ring names its gesture from the first frame and lights when gradeable',
      /^TAP!?$/.test(ring.label) && /^1\/\d+$/.test(ring.count || '') && ring.livesUp,
      JSON.stringify({ label: ring.label, count: ring.count, live: ring.livesUp }));
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
      const seq = st.querySelector('#k-seq');   // must no longer exist
      const out = {
        pulse: !!st.querySelector('#k-beat'),
        beatMs: st.querySelector('#k-beat') && st.querySelector('#k-beat').style.getPropertyValue('--beat'),
        noTracker: !seq,
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
    // ONE GRID, HALF-BEATS ALLOWED. The strings syncopate now — a hesitation
    // before the last blow, a jab on the off-beat — so the unit is the eighth
    // note. Everything still lands on the same clock; nothing floats.
    const onGrid = beat.gaps.length && beat.gaps.every(g => Math.abs(g / 250 - Math.round(g / 250)) < 0.08);
    const syncopated = beat.gaps.some(g => Math.abs(g / 500 - Math.round(g / 500)) > 0.08);
    // …and it BREATHES: six notes end to end is a wall, six in phrases with a
    // rest between hits is a bar you can read your way through.
    const rests = beat.gaps.filter(g => g > 900).length;
    check('BEAT: the whole volley runs on one 120 BPM clock, and the strings syncopate on it',
      beat.pulse && beat.beatMs === '500ms' && onGrid && syncopated && beat.noTracker,
      JSON.stringify({ pulse: beat.pulse, beat: beat.beatMs, gaps: beat.gaps,
        onGrid, syncopated, noTracker: beat.noTracker }));
    check('BEAT: the volley breathes — a rest beat separates one hit from the next',
      rests >= 1, JSON.stringify({ gaps: beat.gaps, rests }));
  }
  await settle();
  // ── the lens moves during a bar, and the rings ride it ──
  await fresh(7);
  {
    const ride = await J(async () => {
      window.K.forceIntent('hymn');
      window.K.endTurn();
      const cast = document.getElementById('k-cast');
      const out = { swung: 0, drift: 0, samples: 0, composed: false };
      let base = null;
      for (let i = 0; i < 260; i++) {
        const r = document.querySelector('.k-pring[data-hero]');
        if (r) {
          const dz = parseFloat(cast.style.getPropertyValue('--cam-dz')) || 0;
          if (base == null) base = dz;
          out.composed = out.composed || dz > 40;      // it DID lean in, once
          // …and then held: no dutching side to side between reads, which is
          // exactly when the player needs the world to stand still
          out.swung = Math.max(out.swung,
            Math.abs(parseFloat(cast.style.getPropertyValue('--cam-yaw')) || 0),
            Math.abs(parseFloat(cast.style.getPropertyValue('--cam-r')) || 0));
          // the ring must stay ON its hero however far the lens travels
          const h = document.querySelector('.k-hero[data-hero="' + r.dataset.hero + '"]');
          const hr = h.getBoundingClientRect(), rr = r.getBoundingClientRect();
          const hx = hr.left + hr.width / 2, hy = hr.top + hr.height * 0.26;
          out.drift = Math.max(out.drift,
            Math.hypot(rr.left + rr.width / 2 - hx - (+r.dataset.ox || 0), rr.top + rr.height / 2 - hy));
          out.samples++;
        }
        await new Promise(res => setTimeout(res, 8));
      }
      return out;
    });
    check('LENS: the parry is ONE held shot — it leans in once and never pivots between notes',
      ride.samples > 10 && ride.composed && ride.swung < 0.2 && ride.drift < 26,
      JSON.stringify({ samples: ride.samples, leanedIn: ride.composed,
        worstPivot: ride.swung, worstDrift: Math.round(ride.drift) }));
  }
  await settle();
  // ── the dilation: pausing animations is not the effect ──
  await fresh(7);
  {
    const dil = await J(async () => {
      window.K.forceIntent('hymn');
      window.K.endTurn();
      const st = document.getElementById('k-stage');
      let out = null;
      for (let i = 0; i < 200 && !out; i++) {
        if (st.classList.contains('k-slowmo')) {
          await new Promise(r => setTimeout(r, 190));   // past the drain transition
          const bg = document.getElementById('k-backdrop');
          const f = getComputedStyle(bg).filter;
          const sat = /saturate\(([\d.]+)\)/.exec(f);
          const br = /brightness\(([\d.]+)\)/.exec(f);
          out = { sat: sat ? +sat[1] : 1, bright: br ? +br[1] : 1,
                  vig: getComputedStyle(st, '::before').backgroundImage !== 'none' };
        }
        await new Promise(r => setTimeout(r, 10));
      }
      return out || { none: true };
    });
    check('DILATION: the world drains and a vignette rushes in — not just paused animation',
      !!dil && !dil.none && dil.sat <= 0.1 && dil.bright <= 0.4 && dil.vig, JSON.stringify(dil));
  }
  await settle();
  // ── a gesture always has time to finish before the next is asked for ──
  {
    const gaps = await J(() => {
      const MIN = { tap: 0.5, feint: 1, bait: 1, slide: 1.5, hold: 1.5, burst: 2 };
      const bad = [];
      for (const id of ['hymn', 'scythe', 'benediction', 'rain']) {
        window.K.forceIntent(id);
        for (const h of window.K.currentIntent().hits) {
          const want = h.beats || h.notes.map((_, i) => i);
          for (let i = 1; i < h.notes.length; i++) {
            const prev = String(h.notes[i - 1]).split(':')[0];
            const gap = (want[i] == null ? i : want[i]) - (want[i - 1] == null ? i - 1 : want[i - 1]);
            if (gap < MIN[prev]) bad.push(id + ' ' + h.notes[i - 1] + '→' + h.notes[i] + ' @' + gap);
          }
        }
      }
      return { bad, min: MIN };
    });
    // authored as well as enforced: the clamp is the safety net, not the design
    check('RHYTHM: no string asks for a travelling gesture before the last one could finish',
      gaps.bad.length === 0, JSON.stringify(gaps.bad));
  }
  await settle();
  // ── a mash gets its own air, and counts itself out loud ──
  await fresh(7);
  {
    const mash = await J(async () => {
      window.K.forceIntent('rain');                 // its first two hits are flurries
      window.K.endTurn();
      const st = document.getElementById('k-stage');
      let ring = null;
      for (let i = 0; i < 300 && !ring; i++) {
        ring = st.querySelector('.k-pring-burst');
        if (!ring) await new Promise(r => setTimeout(r, 10));
      }
      if (!ring) return { found: false };
      const out = { found: true, label0: ring.querySelector('.k-pr-lbl').textContent.trim() };
      const pt = (t) => st.dispatchEvent(new PointerEvent(t,
        { bubbles: true, clientX: 400, clientY: 200, pointerId: 11 }));
      pt('pointerdown'); pt('pointerup');
      out.label1 = ring.querySelector('.k-pr-lbl').textContent.trim();
      out.arc = ring.style.getPropertyValue('--burst');
      // every press sparks, whether or not it grades anything
      out.sparked = document.querySelectorAll('.k-press').length;
      // and NOTHING else is closing while the flurry is being played
      out.alone = st.querySelectorAll('.k-pring.k-pr-live').length <= 1;
      return out;
    });
    check('MASH: the flurry counts itself, sparks every press, and plays alone',
      mash.found && /0\/3/.test(mash.label0) && /1\/3/.test(mash.label1)
      && parseFloat(mash.arc) > 0 && mash.sparked >= 1 && mash.alone,
      JSON.stringify(mash));
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
  // ── the note vocabulary: six kinds, each a different ask ──
  {
    const vocab = await J(() => {
      const kinds = new Set();
      for (const it of ['hymn', 'scythe', 'benediction', 'rain']) {
        window.K.forceIntent(it);
        (window.K.currentIntent().hits || []).forEach(h =>
          h.notes.forEach(n => kinds.add(String(n).split(':')[0])));
      }
      window.K.forceIntent('scythe');
      const dirs = (window.K.currentIntent().hits || [])
        .flatMap(h => h.notes).filter(n => /:/.test(n));
      return { kinds: [...kinds].sort().join(','), dirs: dirs.join(','),
               dirOK: window.K.dirOK('R', 40, 4) && !window.K.dirOK('R', -40, 4)
                   && window.K.dirOK('L', -40, 2) && !window.K.dirOK('L', 5, 40) };
    });
    check('NOTES: the volley draws on six kinds, not one gesture repeated',
      /bait/.test(vocab.kinds) && /burst/.test(vocab.kinds) && /feint/.test(vocab.kinds)
      && /hold/.test(vocab.kinds) && /slide/.test(vocab.kinds) && /tap/.test(vocab.kinds),
      vocab.kinds);
    check('NOTES: a directional slide only answers to its own direction',
      /slide:R/.test(vocab.dirs) && /slide:L/.test(vocab.dirs) && vocab.dirOK,
      JSON.stringify(vocab.dirs));
  }
  // ── wrong way on the beat: a misread arrow costs a grade, not the string ──
  await fresh(7);
  {
    const wrong = await J(async () => {
      window.K.forceIntent('scythe');
      const done = window.K.endTurn();
      const st = document.getElementById('k-stage');
      let ring = null;
      for (let i = 0; i < 300 && !ring; i++) {           // wait for the first arrow
        ring = st.querySelector('.k-pring[data-dir]');
        if (!ring) await new Promise(res => setTimeout(res, 12));
      }
      if (!ring) return { found: false };
      const dir = ring.dataset.dir;
      const ax = { L: 70, R: -70, U: 0, D: 0 }[dir], ay = { U: 70, D: -70, L: 0, R: 0 }[dir];
      const wait = +ring.dataset.impact - performance.now() - 60;    // commit just early
      if (wait > 0) await new Promise(res => setTimeout(res, wait));
      const pt = (t, x, y) => st.dispatchEvent(new PointerEvent(t,
        { bubbles: true, clientX: x, clientY: y, pointerId: 9 }));
      pt('pointerdown', 400, 200);
      pt('pointermove', 400 + ax, 200 + ay);             // straight the wrong way
      pt('pointerup', 400 + ax, 200 + ay);
      const r = await done;
      return { found: true, dir, first: r.grades[0] };
    });
    check('NOTES: a misread arrow answered on the beat pays a grade, not the whole string',
      wrong.found && wrong.first !== 'miss' && wrong.first !== 'late', JSON.stringify(wrong));
  }
  await settle();
  // ── bait and burst resolve on their own rules ──
  await fresh(7);
  {
    const bait = await J(async () => {
      window.K.forceIntent('benediction');          // its first note is a bait
      const r = window.K.endTurn();
      await new Promise(res => setTimeout(res, 640));
      const ring = document.querySelector('.k-pring');
      const kind = ring && ring.dataset;
      const mark = ring && ring.querySelector('.k-pr-x svg');
      // leave it strictly alone
      await new Promise(res => setTimeout(res, 900));
      const out = await r;
      return { firstKind: kind && kind.kind, skull: !!mark,
               grades: out.grades.slice(0, 1) };
    });
    check('BAIT: the do-not-touch ring wears a skull, not a glyph to be learned',
      bait.skull, JSON.stringify({ skull: bait.skull, kind: bait.firstKind }));
    check('BAIT: a crossed ring left untouched is the best read there is',
      bait.firstKind === 'bait' && bait.grades[0] === 'perfect', JSON.stringify(bait));
  }
  await settle();
  await fresh(7);
  {
    const burst = await J(async () => {
      window.K.forceIntent('rain');                 // opens on a burst
      const r = window.K.endTurn();
      await new Promise(res => setTimeout(res, 640));
      const st = document.getElementById('k-stage');
      const kind = (document.querySelector('.k-pring') || {}).dataset;
      for (let i = 0; i < 3; i++) {                 // land the flurry
        st.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 400, clientY: 200, pointerId: 9 }));
        await new Promise(res => setTimeout(res, 40));
      }
      const out = await r;
      return { firstKind: kind && kind.kind, first: out.grades[0] };
    });
    check('BURST: landing the whole flurry before the ring shuts reads clean',
      burst.firstKind === 'burst' && burst.first !== 'miss', JSON.stringify(burst));
  }
  await settle();
  // ── the clash: a turned blow is the best thing in the game and hits like it ──
  await fresh(7);
  {
    const clash = await J(async () => {
      window.K.forceIntent('scythe');
      const notes = window.K.currentIntent().hits.reduce((n, h) => n + h.notes.length, 0);
      const done = window.K.endTurn({ grades: Array(notes).fill('perfect') });
      const out = { crescent: 0, shards: 0, flash: 0, flared: false, shock: 0, pulse: false };
      for (let i = 0; i < 90; i++) {
        const d = document.querySelector('.k-deflect');
        if (d) {
          out.crescent = Math.max(out.crescent, d.querySelectorAll('.k-df-crescent').length);
          out.shards = Math.max(out.shards, d.querySelectorAll('.k-df-shard').length);
          out.flash = Math.max(out.flash, d.querySelectorAll('.k-df-flash').length);
        }
        out.shock = Math.max(out.shock, document.querySelectorAll('.k-shock-gold').length);
        out.flared = out.flared || !!document.querySelector('.k-hero.k-deflected');
        out.pulse = out.pulse || !!document.querySelector('.k-pulse-gold');
        await new Promise(res => setTimeout(res, 14));
      }
      const r = await done;
      out.negated = r.negated;
      out.taken = r.taken;
      return out;
    });
    check('CLASH: a deflected blow throws a crescent, shards and a flash — not one ring',
      clash.negated > 0 && clash.taken === 0 && clash.crescent === 1 && clash.shards >= 6
      && clash.flash === 1 && clash.flared && clash.shock >= 2 && clash.pulse,
      JSON.stringify(clash));
  }
  await settle();
  // ── impact: a blow stops, kicks and shocks ──
  await fresh(7);
  {
    const hit = await J(async () => {
      window.K.forceHand(['lastlight', 'cleave', 'mend', 'serrate', 'frostbind']);
      window.K.playCard('cleave');
      const st = document.getElementById('k-stage');
      const out = {
        shock: document.querySelectorAll('.k-shock').length,
        kicked: /k-kick/.test(st.className),
        frozen: st.classList.contains('k-frozen'),
        struck: !!document.querySelector('#k-boss-art.k-struck'),
        // the Regent is thrown AWAY from the party, not merely lit
        thrown: !!document.querySelector('#k-boss-art.k-struck-r'),
        // an ORDINARY blow flashes too — the old rule only flashed above 1.2
        flash: document.querySelectorAll('.k-hitflash').length,
        pop: !!document.querySelector('.k-pop-dmg'),
      };
      // the freeze has to be long enough to perceive: under ~70ms it reads as a
      // dropped frame rather than a held one
      await new Promise(r => setTimeout(r, 66));
      out.stillFrozen = st.classList.contains('k-frozen');
      await new Promise(r => setTimeout(r, 600));
      out.left = { shock: document.querySelectorAll('.k-shock').length,
                   kick: /k-kick/.test(st.className),
                   flash: document.querySelectorAll('.k-hitflash').length,
                   frozen: st.classList.contains('k-frozen') };
      out.cleared = !out.left.shock && !out.left.kick && !out.left.flash && !out.left.frozen;
      return out;
    });
    check('IMPACT: an ordinary blow flashes, throws the figure, and holds the frame',
      hit.flash >= 1 && hit.thrown && hit.stillFrozen,
      JSON.stringify({ flash: hit.flash, thrown: hit.thrown, heldPast66ms: hit.stillFrozen }));
    check('IMPACT: a strike stops the frame, kicks the screen, and blows a shock ring',
      hit.shock >= 1 && hit.kicked && hit.frozen && hit.struck && hit.pop && hit.cleared,
      JSON.stringify(hit));
  }
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
        // a party card over Ash picks Ash specifically
        ally: K.dropTargetAt(ash.left + ash.width / 2, ash.top + ash.height / 2,
                             partyCard.dataset.card),
        // and nothing at all when the finger is miles away. NOT the bottom-left
        // corner any more — that is the draw pile, which is now the swap zone.
        far: K.dropTargetAt(6, 6, enemyCard.dataset.card),
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
      const dot = document.getElementById('k-cycle-dot').getBoundingClientRect();
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
          && !overlaps(et, d) && !overlaps(d, x),
        // the free swap is a dot ON the draw pile, not a chip of its own
        swapOnDeck: dot.left >= d.left - 6 && dot.right <= d.right + 6
          && dot.top >= d.top - 6 && dot.bottom <= d.bottom + 6,
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
      piles.orbRound && piles.orbAboveDeck && piles.endTurnAboveDiscard && piles.noOverlap
      && piles.swapOnDeck,
      JSON.stringify({ round: piles.orbRound, orbAbove: piles.orbAboveDeck,
        etAbove: piles.endTurnAboveDiscard, clear: piles.noOverlap, swap: piles.swapOnDeck }));
    check('PILES: a played card is seen flying into the discard, and the pile thumps',
      piles.flying >= 1 && piles.thumped && piles.landed && piles.discAfter === '1',
      JSON.stringify({ flying: piles.flying, thump: piles.thumped, after: piles.discAfter }));
  }
  // ── the draw is SEEN: cards fly out of the deck and grow into the hand ──
  await fresh(9);
  {
    const draw = await J(async () => {
      window.K.forceHand(['cleave', 'mend', 'serrate', 'frostbind', 'twinfang']);
      window.K.forceIntent('benediction');
      window.K.endTurn({ grades: ['miss', 'miss'] });
      const out = { flew: 0, faceDown: 0, grew: false, hidden: false };
      for (let i = 0; i < 200; i++) {
        if (window.K.state().phase === 'HAND_DRAWING') {
          const g = document.querySelectorAll('.k-fly');
          out.flew = Math.max(out.flew, g.length);
          out.faceDown = Math.max(out.faceDown,
            document.querySelectorAll('.k-fly.k-fly-back').length);
          // the real card stays invisible until its ghost lands on it
          if ([...document.querySelectorAll('#k-hand .k-card')].some(c => c.style.opacity === '0'))
            out.hidden = true;
        }
        await new Promise(r => setTimeout(r, 6));
      }
      await new Promise(r => setTimeout(r, 400));
      out.settled = [...document.querySelectorAll('#k-hand .k-card')].every(c => c.style.opacity !== '0');
      out.hand = window.K.state().hand.length;
      return out;
    });
    check('DRAW: a card is seen leaving the deck face down and arriving in the hand',
      draw.flew >= 1 && draw.faceDown >= 1 && draw.hidden && draw.settled && draw.hand === 5,
      JSON.stringify(draw));
    const fan = await J(() => {
      const cards = [...document.querySelectorAll('#k-hand .k-card')];
      const v = (c, n) => parseFloat(c.style.getPropertyValue(n));
      return {
        // the hand has its own lens, and the cards lean away from it
        lens: getComputedStyle(document.getElementById('k-hand')).perspective,
        tilts: cards.map(c => v(c, '--tilt')),
        // the OUTER cards lean hardest and the centre stands square
        splayed: Math.abs(v(cards[0], '--tilt')) > 4
          && Math.abs(v(cards[2], '--tilt')) < 1
          && v(cards[0], '--tilt') * v(cards[4], '--tilt') < 0,
        // and the fan re-flows rather than snapping when a card joins it
        eased: /cubic-bezier/.test(getComputedStyle(cards[0]).transitionTimingFunction)
          && parseFloat(getComputedStyle(cards[0]).transitionDuration) > 0.1,
      };
    });
    check('HAND: the fan sits in its own perspective and leans away at the edges',
      /px/.test(fan.lens) && fan.splayed && fan.eased, JSON.stringify(fan));
  }
  await settle();
  // ── the end-of-turn sweep, card by card ──
  await fresh(8);
  {
    const sweep = await J(async () => {
      window.K.forceHand(['cleave', 'mend', 'serrate', 'frostbind', 'twinfang']);
      window.K.forceIntent('benediction');
      const held = window.K.state().hand.length;
      window.K.endTurn({ grades: ['miss', 'miss'] });
      // A card must LEAVE the hand as its ghost launches. If the original sits
      // there until the last one has flown, hand + ghosts exceeds what was held
      // and the sweep reads as the hand duplicating itself.
      let over = 0, mid = 0, shrank = false, samples = 0;
      for (let i = 0; i < 60; i++) {
        if (window.K.state().phase === 'HAND_DISCARDING') {
          const fly = document.querySelectorAll('.k-fly').length;
          const inHand = document.querySelectorAll('#k-hand .k-card').length;
          mid = Math.max(mid, fly);
          over = Math.max(over, inHand + fly - held);
          if (fly > 0 && inHand < held) shrank = true;
          samples++;
        }
        await new Promise(r => setTimeout(r, 4));
      }
      await new Promise(r => setTimeout(r, 900));
      const s = window.K.state();
      return { held, mid, over, shrank, samples, hand: s.hand.length, discard: s.discard.length };
    });
    check('SWEEP: the hand empties as the cards fly — it never duplicates itself',
      sweep.samples > 0 && sweep.over <= 0 && sweep.shrank,
      JSON.stringify({ over: sweep.over, shrank: sweep.shrank, samples: sweep.samples }));
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
      // EVERY figure on the board, not just the cards. A long press on a hero
      // or on the Regent raised Copy / Save Image because the guards only ever
      // lived on .k-card, and all of those are <img> elements.
      const targets = ['#k-hand .k-card', '.k-hero[data-hero="ash"] img',
                       '#k-boss-art img', '#k-bg'];
      const out = { prevented: 0, sel: 0, n: targets.length, missing: [] };
      for (const sel of targets) {
        const node = document.querySelector(sel);
        if (!node) { out.missing.push(sel); continue; }
        const cs = getComputedStyle(node);
        if (!node.dispatchEvent(new Event('contextmenu', { bubbles: true, cancelable: true })))
          out.prevented++;
        if ((cs.userSelect || cs.webkitUserSelect) === 'none') out.sel++;
      }
      // Chromium does not implement -webkit-touch-callout, so assert the
      // declaration ships in the stylesheet rather than reading it back — and
      // that it ships on the WHOLE stage, not one component.
      const css = await (await fetch('styles.css')).text();
      const i = css.indexOf('#k-stage, #k-stage * {');
      const rule = i < 0 ? '' : css.slice(i, i + 260);
      out.calloutShipped = /-webkit-touch-callout:\s*none/.test(rule);
      out.highlightShipped = /-webkit-tap-highlight-color:\s*transparent/.test(rule);
      out.noDrag = /#k-stage img\s*\{[^}]*-webkit-user-drag:\s*none/.test(css);
      out.touch = getComputedStyle(document.getElementById('k-stage')).touchAction;
      return out;
    });
    check('LONG PRESS: no iOS callout on ANY figure — cards, heroes, the Regent, the plate',
      ios.missing.length === 0 && ios.prevented === ios.n && ios.sel === ios.n
      && ios.calloutShipped && ios.highlightShipped && ios.noDrag && ios.touch === 'none',
      JSON.stringify(ios));
  }

  const summary = report();
  await H.browser.close();
  process.exit(summary.passed === summary.total && summary.errs === 0 ? 0 : 1);
})().catch(e => { console.error('SUITE CRASH:', e); process.exit(2); });
