// Playtest: Hask's PYRE/HOAR elemental weave. Compares three play patterns —
// camp fire, camp ice, and weave (alternate) — to confirm the design rewards
// WEAVING both elements over camping one. Reports damage + charge economy.
'use strict';
const { boot } = require('./harness.cjs');

(async () => {
  const t = await boot({ flow: 0 });

  const run = await t.J(async () => {
    window.__autoParry = false;
    const FIRE = { owner: 'hask', name: 'Cinderfall', cost: 0, target: 'enemy', fx: { dmg: 8, elem: 'fire' } };
    const ICE  = { owner: 'hask', name: 'Ice Spike',  cost: 0, target: 'enemy', fx: { dmg: 6, elem: 'ice' } };

    async function drive(seq, nodes) {
      RUN = newRun('hask'); RUN.roster = ['hask']; RUN.active = ['hask'];
      RUN.hp = { hask: 22 }; RUN.nodes = nodes.slice();
      RUN.completed = [0,1,2,3,4,5,6,7,8]; RUN.bonds = {}; RUN._rotations = false;
      startMapFight(RUN.map.find(x => x.type === 'fight'));
      const h = S.heroes[0]; h.row = 'front'; h.aether = 0; h.charge = 0;
      const e = S.enemies[0]; e.hp = e.maxHp = 400; e.guard = 0;
      S.ep = 99; renderAll();
      const hp0 = e.hp; const log = [];
      for (const el of seq) {
        const before = S.enemies[0].hp;
        await resolveCard(el === 'F' ? { ...FIRE } : { ...ICE }, e.uid);
        log.push({ el, dmg: before - S.enemies[0].hp, aether: h.aether, charge: h.charge });
      }
      return { total: hp0 - S.enemies[0].hp, charge: h.charge, log };
    }

    const nodesEmber = ['hask.sig.front', 'hask.weave.astral'];
    const nodesFull  = ['hask.sig.front', 'hask.weave.astral', 'hask.weave.enochian'];

    return {
      campFire: await drive(['F','F','F','F','F','F'], nodesFull),
      campIce:  await drive(['I','I','I','I','I','I'], nodesFull),
      weaveNoBack: await drive(['I','F','I','F','I','F'], nodesEmber),
      weaveFull:   await drive(['I','F','I','F','I','F'], nodesFull),
    };
  });

  const fmt = r => r.log.map(x => `${x.el}${x.dmg}(a${x.aether>0?'+'+x.aether:x.aether}◆${x.charge})`).join(' ');
  console.log('\n=== HASK WEAVE PLAYTEST — 6 casts, dummy 400hp, Fire=8 Ice=6 base ===\n');
  console.log(`CAMP FIRE  (Backdraft owned): total ${String(run.campFire.total).padStart(3)}  ◆${run.campFire.charge}   ${fmt(run.campFire)}`);
  console.log(`CAMP ICE   (Backdraft owned): total ${String(run.campIce.total).padStart(3)}  ◆${run.campIce.charge}   ${fmt(run.campIce)}`);
  console.log(`WEAVE  (Emberwake only):      total ${String(run.weaveNoBack.total).padStart(3)}  ◆${run.weaveNoBack.charge}   ${fmt(run.weaveNoBack)}`);
  console.log(`WEAVE  (+ Backdraft capstone):total ${String(run.weaveFull.total).padStart(3)}  ◆${run.weaveFull.charge}   ${fmt(run.weaveFull)}`);
  console.log('\nGoal: WEAVE(+Backdraft) should be the clear top; camping one element should lag.');
  await t.browser.close();
  process.exit(0);
})();
