// SKILLMETER — an honest difficulty reading.
//
// Every prior playtest ran a bot that hit every parry note perfectly, so every
// fight came back at full HP and told us nothing except that a robot finds the
// game easy. This runs the ACTUAL fight sequence of a generated descent, with HP
// carried between fights, at a range of parry-skill levels — and skips the map
// UI entirely, because what is being measured is combat, and walking overlays is
// where every previous version of this rig broke.
'use strict';
const { boot } = require('./harness.cjs');
const LEVELS = process.env.LEVELS ? process.env.LEVELS.split(',').map(Number) : [1.0, 0.8, 0.6, 0.4];
const RUNS = +(process.env.RUNS || 3);
const PARTY = (process.env.PARTY || 'ash,elin,mira').split(',');
const RELIC = process.env.RELIC || null;   // read a relic's COST honestly, not by eye
// LINE=0 runs the private per-hero chains the LINE replaced, so a floor-scale
// number can be attributed to the card engine instead of guessed at.
const LINE = process.env.LINE !== '0';

(async () => {
  const t = await boot({ sm: 0 });
  const errs = []; t.page.on('pageerror', e => errs.push(e.message));
  await t.J(() => { try { localStorage.clear(); localStorage.setItem('kizuna2_2.tutorialSeen','1'); } catch(_){} });
  await t.autoParry(true);
  // A CEREMONY BLOCKS THE FIGHT. triadCeremony() awaits a tap on the overlay, and
  // this rig plays a whole turn inside ONE page evaluate — so dismissCeremony(),
  // which only runs BETWEEN turns, can never reach one that fires mid-turn. That
  // used to be rare. Under the line (Build 293) a shared combo lands allies'
  // actions together, so bonds and triads fire constantly and this rig deadlocked
  // on the first trio it formed. Auto-tap from inside the page, as a player does.
  await t.J(() => setInterval(() => {
    const ov = document.querySelector('#overlay');
    if (ov && !ov.classList.contains('hidden') && ov.querySelector('.ov-tap')) ov.click();
  }, 50));

  const fight = async (pack, floor) => {
    await t.J((a) => {
      startFight({ type:'fight', chapter:3, heroes:RUN.active.slice(), enemies:a.pack,
        useRunHp:true, floor:a.floor, depth:a.depth, elite:a.elite, narrator:'sm' });
      renderAll();
    }, pack);
    await t.sleep(220);
    let turn = 0;
    while (turn++ < 18) {
      if (await t.J(() => !!(typeof S === 'undefined' || !S || S.over))) break;
      await t.J(`(async () => {
        for (let g = 0; g < 8; g++) {
          const h = buildHand().filter(x => !x.spent && x.cost <= S.ep);
          let c = h.find(x => x.fx && x.fx.followUp) || h.find(x => x.chain) || h.find(x => x.fx && (x.fx.dmg||x.fx.heal||x.fx.guard));
          if (!c) break;
          const live = livingEnemies(); if (!live.length) break;
          const tid = (c.target==='ally'||c.target==='allies') ? (lowestHpAlly()||{}).id : (frontmostEnemy()||live[0]).uid;
          try { await playCard(c, tid); } catch(e) { break; }
        }
        if (S && burstReady()) { try { await resolveAllOut(); } catch(_){} }
      })()`);
      await t.endTurn(); await t.dismissCeremony();
      for (let i=0;i<170;i++){ if (await t.J(() => !!(typeof S==='undefined'||!S||S.over||(!S.executing&&!S.enemyPhase)))) break; await t.sleep(50); }
    }
    return await t.J(() => {
      const r = { ran: !!S, win: !!(S && !livingEnemies().length), turns: S ? S.turn : 0,
        downed: S ? S.heroes.filter(h=>h.downed).length : 0,
        hpPct: S ? S.heroes.reduce((a,h)=>a+Math.max(0,h.hp),0) / S.heroes.reduce((a,h)=>a+h.maxHp,0) : 0 };
      if (S) S.heroes.forEach(h => { RUN.hp[h.id] = Math.max(h.downed ? 0 : 1, h.hp); });  // carry the wounds forward
      return r;
    });
  };

  console.log(`\nparty ${PARTY.join('+')}${RELIC ? ' · relic ' + RELIC : ''} · ${RUNS} descents per level · HP carried between fights · LINE ${LINE ? 'ON' : 'off'}`);
  console.log('skill   fights  cleared   HP at the boss door   downs   wiped   turns/fight   parry clean');
  for (const skill of LEVELS) {
    const A = { f:0, won:0, downs:0, wipes:0, turns:0, clean:0, botched:0, endHp:[] };
    for (let r = 0; r < RUNS; r++) {
      await t.parrySkill(skill, 4242 + r * 7919);
      const packs = await t.J((a) => {
        const p = a.party;
        RUN = newRun(p[0]);
        if (a.relic) RUN.relic = a.relic;
        RUN.roster = p.slice(); RUN.active = p.slice();
        RUN.hp = {}; p.forEach(id => RUN.hp[id] = HEROES[id].maxHp);
        RUN.nodes = EMBER_TREE.filter(n => n.type === 'card').map(n => n.id);
        RUN.floor = 1; RUN.completed = [];
        RUN._line = a.line;                  // the A/B: false runs the private chains
        RUN.map = generateDescent(RUN.roster, 1);
        // the ordered combat spine of one real descent
        const out = []; let cur = RUN.map.find(n => n.col === 1), g = 0;
        while (cur && g++ < 30) {
          if (cur.enemies) out.push({ pack: cur.enemies.slice(), floor: 1, depth: cur.level, elite: !!cur.elite, boss: !!cur.isBoss });
          const nx = (cur.next||[]).map(id => RUN.map.find(m => m.id === id)).filter(Boolean);
          if (!nx.length) break;
          cur = nx[Math.floor(Math.random()*nx.length)];
        }
        return out;
      }, { party: PARTY, relic: RELIC, line: LINE });
      let wiped = false;
      for (const p of packs) {
        const f = await fight(p, 1);
        if (!f.ran) continue;
        A.f++; A.turns += f.turns; A.downs += f.downed;
        if (f.win) A.won++; else { wiped = true; break; }
      }
      if (wiped) A.wipes++;
      A.endHp.push(await t.J(() => { const ids = RUN.active;
        return ids.reduce((a,id)=>a+Math.max(0,RUN.hp[id]||0),0) / ids.reduce((a,id)=>a+HEROES[id].maxHp,0); }));
      const log = await t.parryLog(); A.clean += log.clean; A.botched += log.botched;
    }
    const notes = A.clean + A.botched;
    const endHp = A.endHp.reduce((a,b)=>a+b,0) / (A.endHp.length||1);
    console.log(` ${skill.toFixed(2)}   ${String(A.f).padStart(5)}   ${String(A.won).padStart(6)}`
      + `   ${(endHp*100).toFixed(0).padStart(17)}%   ${String(A.downs).padStart(5)}`
      + `   ${String(A.wipes+'/'+RUNS).padStart(5)}   ${(A.f?A.turns/A.f:0).toFixed(1).padStart(11)}`
      + `   ${notes ? (A.clean/notes*100).toFixed(0) : '--'}% of ${notes}`);
  }
  console.log('\nERRORS:', errs.length ? errs.slice(0,4) : 'none');
  await t.browser.close(); process.exit(0);
})();
