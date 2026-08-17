'use strict';
const { boot } = require('./harness.cjs');
const path = require('path');
(async () => {
  const t = await boot({ flow: 0 });
  await t.J(() => {
    ['husk','wraith','cultist','drone','revenant','echoknight'].forEach(id => markEnemySeen(id));
    try { localStorage.setItem('kizuna2_2.starters', JSON.stringify(['ash','elin','mira','cassia'])); } catch(_){}
    showJournal(() => {}, 'bestiary');
  });
  await t.sleep(400);
  await t.page.screenshot({ path: path.join(__dirname, 'shots', 'journal-bestiary.png') });
  await t.J(() => showJournal(() => {}, 'heroes'));
  await t.sleep(300);
  await t.page.screenshot({ path: path.join(__dirname, 'shots', 'journal-heroes.png') });
  console.log('bestiary seen:', (function(){try{return JSON.parse(localStorage.getItem('kizuna2_2.bestiary')||'[]').length}catch(_){return 0}})());
  await t.browser.close(); process.exit(0);
})();
