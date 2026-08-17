// TEMPOMETER — the action economy, measured.
//
// The question this answers: how many cards does the player get to play per
// enemy action, and how many parry opportunities does a fight actually
// contain? Measured because a bigger party FEELS like it gets fewer chances
// to parry, and it turns out to genuinely get fewer — fights end sooner than
// the extra foes lengthen them, so total enemy actions and parry notes both
// FALL as the line grows.
//
// It also A/Bs the proposed fix: one FINISHER a turn, party-wide, which is
// what the tutorial already claims the turn's question is.
//
//   node test/tempometer.cjs
//
// Runs the whole fight inside the page — thousands of CDP polls per fight
// were the cost of the earlier rigs, not the game.
//
'use strict';
const { boot } = require('./harness.cjs');
(async () => {
  const t = await boot({ r: 0 });
  await t.page.emulateMedia({ reducedMotion: 'reduce' });
  await t.autoParry(true); await t.fastCombat(0.06); await t.parrySkill(1, 99);
  await t.J(() => {
    window.__notes = 0;
    new MutationObserver((m) => { for (const x of m) for (const n of x.addedNodes)
      if (n.nodeType === 1 && n.classList && n.classList.contains('parry-ring')) window.__notes++;
    }).observe(document.documentElement, { childList: true, subtree: true });
    // the WHOLE fight in one round-trip: thousands of CDP polls were the cost,
    // not the game.
    window.__room = async (party, oneFin) => {
      window.__notes = 0;
      RUN = newRun(party[0]); RUN.roster = party.slice(); RUN.active = party.slice();
      RUN.hp = {}; party.forEach(id => RUN.hp[id] = HEROES[id].maxHp);
      RUN.nodes = EMBER_TREE.filter(n => n.type === 'card').map(n => n.id);
      // a level-3 room is not guaranteed on every generated map (Build 274 can
      // make a whole level a single recruit), so fall back rather than throw
      const maps = generateDescent(party, 1);
      const node = maps.filter(n => n.type === 'fight' && n.level === 3)[0]
                || maps.filter(n => n.type === 'fight')[0];
      startFight({ type:'fight', chapter:3, heroes:party.slice(),
        enemies:(node && node.enemies ? node.enemies.slice() : ['husk','wraith','cultist']),
        useRunHp:true, floor:1, depth:3, narrator:'r' });
      if (!S) return { turns:0, cards:0, acts:0, foes:0, notes:0, hp:0 };
      renderAll();
      const nap = (ms) => new Promise(r => setTimeout(r, ms));
      let turns = 0, cards = 0, acts = 0, foes = S.enemies.length;
      while (turns < 20 && S && !S.over) {
        let finThisTurn = 0;
        for (let g = 0; g < 10; g++) {
          let h = buildHand().filter(x => !x.spent && x.cost <= S.ep);
          // SIMULATE the proposed rule: only ONE finisher may be cashed a turn,
          // party-wide. The design already claims the turn's question is "who
          // gets to finish" — right now the answer is "everybody".
          if (oneFin && finThisTurn >= 1) h = h.filter(x => !/FINISHER/.test(x.stance || ''));
          const c = h.find(x => x.fx && x.fx.followUp) || h.find(x => x.chain)
                 || h.find(x => x.fx && (x.fx.dmg || x.fx.heal || x.fx.guard));
          if (!c) break;
          if (/FINISHER/.test(c.stance || '')) finThisTurn++;
          const live = livingEnemies(); if (!live.length) break;
          const tid = (c.target === 'ally' || c.target === 'allies') ? (lowestHpAlly()||{}).id : (frontmostEnemy()||live[0]).uid;
          try { await playCard(c, tid); cards++; } catch (e) { break; }
        }
        if (S && burstReady()) { try { await resolveAllOut(); } catch (_) {} }
        if (!S || S.over) break;
        acts += livingEnemies().length; turns++;
        try { await endTurn(); } catch (_) {}
        for (let i = 0; i < 400 && S && !S.over && (S.executing || S.enemyPhase); i++) await nap(20);
      }
      return { turns, cards, acts, foes, notes: window.__notes,
        hp: S ? Math.round(S.heroes.reduce((a,h)=>a+Math.max(0,h.hp),0)/S.heroes.reduce((a,h)=>a+h.maxHp,0)*100) : 0 };
    };
  });
  const show = async (label, oneFin) => {
  console.log('\n' + label);
  console.log('party            foes  turns  cards  cards/turn   enemy acts   PLAYER:ENEMY   parry notes  notes/turn   HP');
  for (const p of [['ash'], ['ash','elin'], ['ash','elin','mira']]) {
    const rs = [];
    for (let i = 0; i < 2; i++) rs.push(await t.J((a) => window.__room(a.p, a.f), { p, f: oneFin }));
    const m = k => rs.reduce((a,r)=>a+r[k],0)/rs.length;
    const ratio = m('acts') ? (m('cards')/m('acts')).toFixed(1) : '--';
    console.log(`${p.join('+').padEnd(16)}${m('foes').toFixed(1).padStart(4)}  ${m('turns').toFixed(1).padStart(5)}`
      + `  ${m('cards').toFixed(1).padStart(5)}  ${(m('cards')/Math.max(1,m('turns'))).toFixed(1).padStart(10)}`
      + `  ${m('acts').toFixed(1).padStart(11)}  ${String(ratio+':1').padStart(13)}`
      + `  ${m('notes').toFixed(1).padStart(12)}  ${(m('notes')/Math.max(1,m('turns'))).toFixed(1).padStart(10)}`
      + `  ${m('hp').toFixed(0).padStart(3)}%`);
  }
  };
  await show('— TODAY: every hero cashes a finisher every turn —', false);
  await show('— PROPOSED: ONE finisher a turn, party-wide —', true);
  await t.browser.close(); process.exit(0);
})();
