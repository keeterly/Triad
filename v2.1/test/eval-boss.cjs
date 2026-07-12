'use strict';
const { boot } = require('./harness.cjs');

(async () => {
  const t = await boot({ flow: 0 });
  const note = (s) => console.log(s);

  async function runBoss(label, autoParry) {
    const setup = await t.J((ap) => {
      window.__autoParry = ap;
      RUN = newRun('ash');
      RUN.roster = ['ash','elin','mira']; RUN.active = ['ash','elin','mira'];
      RUN.hp = { ash: 32, elin: 26, mira: 28 };
      RUN.nodes = ['ash.sig.front','ash.combo.front','elin.sig.front','mira.sig.front','mira.combo.front'];
      RUN.bonds = { 'ash|elin': 3, 'elin|mira': 3, 'ash|mira': 3 };
      RUN.floor = 3; RUN.completed = [0,1,2,3,4,5,6,7,8,9,10,11,12];
      RUN.map = generateDescent(RUN.roster, 3);
      const bnode = RUN.map.find(x => x.type === 'boss');
      startFight({ type: 'boss', chapter: 4, heroes: RUN.active.slice(), enemies: bnode.enemies, useRunHp: true, floor: 3, depth: 10, boss: true, narrator: 'boss' });
      S.pairsAwake = new Set(['ash|elin','elin|mira','ash|mira']);
      renderAll();
      return { boss: S.enemies.map(e => e.def.name + ' ' + e.hp + 'hp'), party: S.heroes.map(h => h.id+':'+h.hp) };
    }, autoParry);
    note(`\n=== ${label} (autoParry=${autoParry}) ===`);
    note('Boss: ' + setup.boss.join(', ') + ' | Party: ' + setup.party.join(' '));
    let turn = 0, allOuts = 0;
    while (turn++ < 14) {
      const over = await t.J(() => !S || S.over);
      if (over) break;
      await t.J(async () => {
        for (const h of S.heroes.slice()) {
          if (h.downed) continue;
          let g = 0;
          while (g++ < 5) {
            if (S.executing || S.over) break;
            const card = buildHand().find(c => c.owner === h.id && !c.spent && c.cost <= S.ep && c.fx && (c.fx.dmg || c.fx.castDmg || c.fx.heal || c.fx.guard));
            if (!card) break;
            let tid = card.target === 'ally' || card.target === 'allies' ? (S.heroes.find(x=>x.hp<x.maxHp)||S.heroes[0]).id : (frontmostEnemy()||livingEnemies()[0]||{}).uid;
            try { await playCard(card, tid); } catch (_) { break; }
          }
        }
      });
      const canAO = await t.J(() => burstReady && burstReady());
      if (canAO) { await t.J(() => triggerAllOut()); allOuts++; await t.sleep(400); await t.dismissCeremony(); }
      await t.endTurn();
      await t.dismissCeremony();
    }
    const end = await t.J(() => ({
      win: !!(S && !livingEnemies().length && !S.heroes.every(h=>h.downed)),
      wipe: !!(S && S.heroes.every(h=>h.downed)),
      bossHp: S ? S.enemies.map(e=>e.def.name+':'+(e.dead?'DEAD':e.hp+'/'+e.maxHp)) : [],
      party: S ? S.heroes.map(h=>h.id+':'+(h.downed?'DOWN':h.hp+'/'+h.maxHp)) : [],
    }));
    note(`Result after ${turn} turns: ${end.win?'WIN':end.wipe?'WIPE':'timeout'} · allOuts ${allOuts}`);
    note('  boss: ' + end.bossHp.join(', '));
    note('  party: ' + end.party.join(' '));
  }

  await runBoss('BOSS w/ perfect auto-parry', true);
  await runBoss('BOSS w/ NO parry (eats hits)', false);

  await t.browser.close();
  process.exit(0);
})();
