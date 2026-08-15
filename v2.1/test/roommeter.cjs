// ROOMMETER — one room, measured, in seconds.
//
// The descent-scale rigs cost ten minutes a reading, which made the questions
// that mattered unaffordable. This runs single rooms under the harness TIME
// SCALE (see fastCombat) so a full trio fight resolves in ~20s of wall clock
// with the combat maths untouched.
//
//   REPS=4 LEVELS=1.0,0.6,0.3 node test/roommeter.cjs
//
'use strict';
const { boot } = require('./harness.cjs');
(async () => {
  const t = await boot({ f: 0 });
  await t.page.emulateMedia({ reducedMotion: 'reduce' });
  await t.autoParry(true);
  await t.fastCombat(0.06);
  const one = async (party, skill, seed, opt) => {
    const o = opt || {};
    await t.parrySkill(skill, seed);
    await t.J((a) => {
      const p = a.p;
      RUN = newRun(p[0]); if (a.relic) RUN.relic = a.relic;
      RUN.roster = p.slice(); RUN.active = p.slice();
      RUN.hp = {}; p.forEach(id => RUN.hp[id] = HEROES[id].maxHp);
      RUN.nodes = EMBER_TREE.filter(n => n.type === 'card').map(n => n.id);
      const want = a.elite ? 'elite' : 'fight';
      const maps = generateDescent(p, 1);
      const node = maps.filter(n => n.type === want && n.level === a.d)[0] || maps.filter(n => n.type === want)[0];
      startFight({ type: want, chapter:3, heroes:p.slice(), enemies:node.enemies.slice(),
        useRunHp:true, floor:1, depth:a.d, elite:a.elite, narrator:'f' });
      renderAll();
    }, { p: party, d: o.depth || 3, elite: o.elite, relic: o.relic });
    let turn = 0;
    while (turn++ < 24) {
      if (await t.J(() => !!(typeof S === 'undefined' || !S || S.over))) break;
      await t.J(`(async () => { for (let g=0;g<8;g++){ const h=buildHand().filter(x=>!x.spent&&x.cost<=S.ep); let c=h.find(x=>x.fx&&x.fx.followUp)||h.find(x=>x.chain)||h.find(x=>x.fx&&(x.fx.dmg||x.fx.heal||x.fx.guard)); if(!c)break; const live=livingEnemies(); if(!live.length)break; const tid=(c.target==='ally'||c.target==='allies')?(lowestHpAlly()||{}).id:(frontmostEnemy()||live[0]).uid; try{await playCard(c,tid);}catch(e){break;} } if(S&&burstReady()){try{await resolveAllOut();}catch(_){}} })()`);
      await t.endTurn(); await t.dismissCeremony();
      for (let i=0;i<200;i++){ if (await t.J(() => !!(typeof S==='undefined'||!S||S.over||(!S.executing&&!S.enemyPhase)))) break; await t.sleep(15); }
    }
    return await t.J(() => ({ foes:S?S.enemies.length:0, turns:S?S.turn:0, downs:S?S.heroes.filter(h=>h.downed).length:0,
      win: S && !livingEnemies().length ? 1 : 0,
      hp: S ? Math.round(S.heroes.reduce((a,h)=>a+Math.max(0,h.hp),0)/S.heroes.reduce((a,h)=>a+h.maxHp,0)*100) : 0 }));
  };
  const REPS = +(process.env.REPS || 4);
  const table = async (label, rows) => {
    console.log('\n' + label);
    console.log('party            skill   foes  turns   won   HP left   downs');
    for (const [party, opt] of rows) for (const sk of (process.env.LEVELS||'1.0,0.6,0.3').split(',').map(Number)) {
      const rs = [];
      for (let i = 0; i < REPS; i++) rs.push(await one(party, sk, 313 + i * 4409, opt));
      const m = (k) => rs.reduce((a, r) => a + r[k], 0) / rs.length;
      console.log(`${party.join('+').padEnd(16)}${sk.toFixed(2)}   ${m('foes').toFixed(1).padStart(4)}`
        + `   ${m('turns').toFixed(1).padStart(5)}   ${String(rs.filter(r=>r.win).length+'/'+REPS).padStart(3)}`
        + `   ${m('hp').toFixed(0).padStart(6)}%   ${m('downs').toFixed(1)}`);
    }
  };
  const t0 = Date.now();
  await table('— IS IT THE HEALER? same size, one with Elin, one without —',
    [[['ash','mira'], {}], [['ash','elin'], {}], [['ash','mira','branwen'], {}], [['ash','elin','mira'], {}]]);
  await table('— A CHILD\'S COMPASS · the ELITE it puts at level 1 —',
    [[['ash'], { depth:1, elite:true, relic:'compass' }], [['ash','elin','mira'], { depth:1, elite:true, relic:'compass' }]]);
  console.log('\nwall ' + ((Date.now()-t0)/1000/60).toFixed(1) + ' min');
  await t.browser.close(); process.exit(0);
})();
