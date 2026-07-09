'use strict';
const { boot } = require('./harness.cjs');
(async () => {
  const t = await boot({ flow: 0 });
  await t.J(() => {
    hideOverlay && hideOverlay();
    RUN = newRun('hask'); RUN.roster = ['hask','cassia','elin']; RUN.active = RUN.roster.slice();
    RUN.nodes = EMBER_TREE.filter(n => n.hero==='hask' && ['card','branch'].includes(n.type)).map(n=>n.id);
    startFight({ type:'fight', chapter:3, heroes:['hask','cassia','elin'], enemies:['wraith','cultist'], narrator:'hask' });
    S.heroes.find(h=>h.id==='hask').charge = 3;   // show the CHARGE chip
    S.enemies[0].intentIdx = 0; renderAll();
  });
  await t.sleep(500); await t.shot('hask-fight');
  await t.browser.close(); console.log('shot saved'); process.exit(0);
})();
