// CHOICEMETER — do the cards on the table actually DIFFER?
//
// linemeter counts how many legal plays a decision has. That is breadth, not fun:
// six cards that all do 8 damage is one choice wearing six hats. This reads, at
// every decision of a real fight, how far apart the options are — the spread
// between the best card on the table and the average one, by the crude currency
// the game actually deals in (damage, healing, guard, exposure).
//
// SPREAD is (best - mean) / mean. Near 0 means the table is padding. The higher it
// is, the more a turn rewards reading the board rather than tapping the biggest
// number. ROLES counts how many DIFFERENT kinds of thing are on offer at once
// (hurt / mend / shield / set up) — variety a single number cannot see.
//
//   node test/choicemeter.cjs
'use strict';
const { boot } = require('./harness.cjs');
const REPS = +(process.env.REPS || 4);
const LINE = process.env.LINE !== '0';
const PACK = (process.env.PACK || 'husk,wraith,cultist').split(',');
// ANS=0 measures the line WITHOUT the learned cross-character answers, so the
// thing they add can be attributed rather than assumed.
const ANS = process.env.ANS !== '0';

(async () => {
  const t = await boot({ c: 0 });
  await t.page.emulateMedia({ reducedMotion: 'reduce' });
  await t.autoParry(true); await t.fastCombat(0.06); await t.parrySkill(1, 99);
  await t.J(() => {
    setInterval(() => { const ov = document.querySelector('#overlay');
      if (ov && !ov.classList.contains('hidden') && ov.querySelector('.ov-tap')) ov.click(); }, 50);
    // What a card is WORTH, in the only units the fight understands. Deliberately
    // crude: the point is whether the options differ, not to rank them well.
    window.__worth = (c) => { const f = c.fx || {};
      return (f.dmg||0) + (f.aoeDmg||0)*2 + (f.castDmg||0) + (f.smite||0)
           + (f.heal||0)*1.2 + (f.guard||0)*0.8 + (f.mark||0)*1.5
           + (f.buffDmg||0) + (f.chargeGain||0)*2 + (f.counter||0)*2; };
    window.__role = (c) => { const f = c.fx || {};
      if (f.heal) return 'mend'; if (f.guard || f.counter) return 'shield';
      if (f.mark || f.buffDmg || f.chargeGain || f.lull) return 'setup';
      if (f.dmg || f.aoeDmg || f.castDmg || f.smite) return 'hurt'; return 'other'; };
    window.__room = async (party, line, pack, ans) => {
      RUN = newRun(party[0]); RUN.roster = party.slice(); RUN.active = party.slice();
      RUN.hp = {}; party.forEach(id => RUN.hp[id] = HEROES[id].maxHp);
      RUN.nodes = ROTATION_GATES.concat(ans ? ['ash.answer','elin.answer','mira.answer','cassia.answer','branwen.answer','hask.answer'] : []); RUN._rotations = true; RUN._line = line;
      startFight({ type:'fight', chapter:3, heroes:party.slice(), enemies:pack.slice(),
        useRunHp:true, floor:1, depth:3, narrator:'c' });
      if (!S) return null;
      renderAll();
      const nap = ms => new Promise(r => setTimeout(r, ms));
      const spreads = [], roles = [];
      let turns = 0;
      while (turns++ < 12 && S && !S.over) {
        for (let g = 0; g < 12; g++) {
          const legal = buildHand().filter(x => !x.spent && x.cost <= S.ep && x.kind !== 'move');
          if (!legal.length) break;
          if (legal.length > 1) {
            const w = legal.map(window.__worth);
            const mean = w.reduce((a,b)=>a+b,0) / w.length;
            if (mean > 0) spreads.push((Math.max(...w) - mean) / mean);
            roles.push(new Set(legal.map(window.__role)).size);
          }
          const c = legal.find(x => x.chain) || legal[0];
          const live = livingEnemies(); if (!live.length) break;
          const tid = (c.target==='ally'||c.target==='allies') ? (lowestHpAlly()||{}).id : (frontmostEnemy()||live[0]).uid;
          try { await playCard(c, tid); } catch (e) { break; }
        }
        if (S && burstReady()) { try { await resolveAllOut(); } catch(_){} }
        if (!S || S.over) break;
        try { await endTurn(); } catch(_){}
        for (let i=0;i<400 && S && !S.over && (S.executing||S.enemyPhase);i++) await nap(20);
      }
      const mean = a => a.length ? a.reduce((x,y)=>x+y,0)/a.length : 0;
      return { spread: mean(spreads), roles: mean(roles), n: spreads.length };
    };
  });
  const PARTIES = [['ash','elin'], ['ash','elin','mira'], ['cassia','branwen','hask']];
  console.log(`\npack ${PACK.join('+')} · ${REPS} fights a row · LINE ${LINE ? 'ON' : 'off'} · ANSWERS ${ANS ? 'learned' : 'not learned'}`);
  console.log('party                      SPREAD   ROLES on offer   decisions');
  for (const p of PARTIES) {
    const rs = [];
    for (let i = 0; i < REPS; i++) { const r = await t.J(a => window.__room(a.p, a.line, a.pack, a.ans), { p, line: LINE, pack: PACK, ans: ANS }); if (r) rs.push(r); }
    if (!rs.length) { console.log(p.join('+').padEnd(26) + '  — no fight —'); continue; }
    const m = k => rs.reduce((a,r)=>a+r[k],0)/rs.length;
    console.log(`${p.join('+').padEnd(26)}  ${(m('spread')*100).toFixed(0).padStart(4)}%   ${m('roles').toFixed(2).padStart(13)}   ${m('n').toFixed(0).padStart(9)}`);
  }
  await t.browser.close(); process.exit(0);
})();
