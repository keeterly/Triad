// Playtest: drive an all-out for each hero solo and report what — if anything —
// is hero-specific at the climactic moment. Judges whether per-hero all-out
// finishers are needed.
'use strict';
const { boot } = require('./harness.cjs');

(async () => {
  const t = await boot({ flow: 0 });
  const rows = [];
  const heroes = ['ash', 'cassia', 'mira', 'elin', 'branwen'];
  for (const hid of heroes) {
    const r = await t.J(async (hid) => {
      window.__autoParry = false;
      const node = { ash: 'ash.allout.execution', cassia: 'cassia.allout.fortress' }[hid];
      RUN = newRun(hid); RUN.roster = [hid]; RUN.active = [hid];
      RUN.nodes = node ? [node] : [];
      RUN.completed = [0,1,2,3,4,5,6,7,8];
      startFight({ type: 'fight', chapter: 3, heroes: [hid], enemies: ['echoknight2'], narrator: 'ao drill' });
      const e = S.enemies[0]; e.hp = e.maxHp = 500;
      const h = S.heroes[0];
      const cls = h.def.cls;
      const casc = (typeof ALLOUT_CASCADE !== 'undefined' && (ALLOUT_CASCADE[cls] || ALLOUT_CASCADE._default)) || [];
      const hpBefore = e.hp, guardBefore = h.guard;
      S.momentum = 100; renderAll();
      await triggerAllOut();
      return {
        hid, cls,
        cascade: casc.map(n => n.t).join('+'),
        allOutNode: node || '(none)',
        bracedGuard: h.guard - guardBefore,
        totalDamage: hpBefore - S.enemies[0].hp,
      };
    }, hid);
    rows.push(r);
  }
  console.log('\n=== ALL-OUT PLAYTEST (solo, momentum 100, dummy 500hp) ===');
  rows.forEach(r => {
    console.log(`${r.hid.padEnd(8)} cls=${(r.cls||'').padEnd(9)} cascade=${(r.cascade||'').padEnd(11)} allOutNode=${r.allOutNode.padEnd(24)} braced+${r.bracedGuard} dmg=${r.totalDamage}`);
  });
  await t.browser.close();
  process.exit(0);
})();
