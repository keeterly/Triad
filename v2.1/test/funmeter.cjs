// FUNMETER — the combat system played across its PROGRESSION, against mobs and
// a boss, with the fun proxies this repo has learned to trust read at each stage.
//
// "Fun" is not one number, but its absence shows up in measurable ways:
//   MID     legal plays after the turn's first card — flat 1-2 means execution,
//           not decision (the number the line redesign existed to move)
//   SPREAD  gap between the best card and the mean — near 0 means six cards
//           wearing one hat
//   ROLES   how many KINDS of thing are on offer (hurt/mend/shield/setup)
//   turns   fight length — 1-2 is an alpha-strike, 10+ is a slog
//
// The matrix is the progression a real run walks:
//   START     no nodes            two-beat lines, no fork, no follow-ups
//   MID-RUN   combo+fork nodes    three-beat lines that branch
//   LATE      + bonds held        cross-hero follow-ups in the line
// each against a MOB pack and the floor BOSS, so the same engine is read where
// fights are cheap and where they are not.
//
//   node test/funmeter.cjs        REPS=3 by default
'use strict';
const { boot } = require('./harness.cjs');
const REPS = +(process.env.REPS || 3);

(async () => {
  const t = await boot({ f: 0 });
  await t.page.emulateMedia({ reducedMotion: 'reduce' });
  await t.autoParry(true); await t.fastCombat(0.06); await t.parrySkill(0.8, 4242);
  await t.J(() => {
    setInterval(() => { const ov = document.querySelector('#overlay');
      if (ov && !ov.classList.contains('hidden') && ov.querySelector('.ov-tap')) ov.click(); }, 50);
    window.__worth = (c) => { const f = c.fx || {};
      return (f.dmg||0) + (f.aoeDmg||0)*2 + (f.castDmg||0) + (f.smite||0) + (f.heal||0)*1.2
           + (f.guard||0)*0.8 + (f.mark||0)*1.5 + (f.buffDmg||0) + (f.chargeGain||0)*2 + (f.counter||0)*2; };
    window.__role = (c) => { const f = c.fx || {};
      if (f.heal) return 'mend'; if (f.guard || f.counter) return 'shield';
      if (f.mark || f.buffDmg || f.chargeGain || f.lull || f.lineRally) return 'setup';
      if (f.dmg || f.aoeDmg || f.castDmg || f.smite) return 'hurt'; return 'other'; };
    window.__fight = async (stage, pack) => {
      const party = ['ash', 'elin', 'mira'];
      RUN = newRun('ash'); RUN.roster = party.slice(); RUN.active = party.slice();
      RUN.hp = {}; party.forEach(h => RUN.hp[h] = HEROES[h].maxHp);
      RUN.nodes = stage === 'start' ? [] : ROTATION_GATES.slice();
      RUN.crossed = {};
      if (stage === 'late') for (let i = 0; i < party.length; i++) for (let j = i + 1; j < party.length; j++) {
        const nd = NODE_BY_ID['bond.' + [party[i], party[j]].sort().join('|')];
        if (!nd) continue;
        (RUN.crossed[party[i]] = RUN.crossed[party[i]] || []).push(nd.id);
        (RUN.crossed[party[j]] = RUN.crossed[party[j]] || []).push(nd.id);
      }
      startFight({ type:'fight', chapter:3, heroes:party.slice(), enemies:pack.slice(),
        useRunHp:true, floor:1, depth:3, narrator:'f' });
      if (!S) return null;
      renderAll();
      const nap = ms => new Promise(r => setTimeout(r, ms));
      const foeHp0 = S.enemies.reduce((a,e)=>a+e.maxHp,0);
      let turns = 0, cards = 0; const mids = [], spreads = [], roles = [];
      while (turns < 16 && S && !S.over) {
        turns++;
        for (let g = 0; g < 14; g++) {
          const legal = buildHand().filter(x => !x.spent && x.cost <= S.ep && x.kind !== 'move');
          if (!legal.length) break;
          if (g > 0) mids.push(legal.length);
          if (legal.length > 1) {
            const w = legal.map(window.__worth), mean = w.reduce((a,b)=>a+b,0)/w.length;
            if (mean > 0) spreads.push((Math.max(...w)-mean)/mean);
            roles.push(new Set(legal.map(window.__role)).size);
          }
          const c = legal.find(x => x.chain) || legal[0];
          const live = livingEnemies(); if (!live.length) break;
          const tid = (c.target==='ally'||c.target==='allies') ? (lowestHpAlly()||{}).id : (frontmostEnemy()||live[0]).uid;
          try { await playCard(c, tid); cards++; } catch (e) { break; }
        }
        if (S && burstReady()) { try { await resolveAllOut(); } catch(_){} }
        if (!S || S.over) break;
        try { await endTurn(); } catch(_){}
        for (let i = 0; i < 400 && S && !S.over && (S.executing || S.enemyPhase); i++) await nap(20);
      }
      const mean = a => a.length ? a.reduce((x,y)=>x+y,0)/a.length : 0;
      return { turns, cards,
        mid: mean(mids), spread: mean(spreads), roles: mean(roles),
        win: !!(S && !livingEnemies().length),
        hp: S ? Math.round(S.heroes.reduce((a,h)=>a+Math.max(0,h.hp),0)/S.heroes.reduce((a,h)=>a+h.maxHp,0)*100) : 0 };
    };
  });

  const STAGES = ['start', 'mid', 'late'];
  const PACKS = { MOBS: ['husk','wraith','cultist'], BOSS: ['echoknight2'] };
  for (const [pn, pack] of Object.entries(PACKS)) {
    console.log(`\n═══ ${pn} — ${pack.join('+')} ═══`);
    console.log('stage      MID   SPREAD   ROLES   turns  cards/turn   won    HP');
    for (const stage of STAGES) {
      const rs = [];
      for (let i = 0; i < REPS; i++) { const r = await t.J(a => window.__fight(a.stage, a.pack), { stage, pack }); if (r) rs.push(r); }
      if (!rs.length) { console.log(`${stage.padEnd(9)}  — no fight —`); continue; }
      const m = k => rs.reduce((a,r)=>a+r[k],0)/rs.length;
      console.log(`${stage.padEnd(9)} ${m('mid').toFixed(2).padStart(5)}  ${(m('spread')*100).toFixed(0).padStart(6)}%  ${m('roles').toFixed(2).padStart(6)}  ${m('turns').toFixed(1).padStart(6)}  ${(m('cards')/Math.max(1,m('turns'))).toFixed(1).padStart(10)}  ${rs.filter(r=>r.win).length}/${rs.length}  ${m('hp').toFixed(0).padStart(4)}%`);
    }
  }
  await t.browser.close(); process.exit(0);
})();
