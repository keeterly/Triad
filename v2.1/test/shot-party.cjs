// Screenshot the redesigned party FORMATION editor (FRONT/MID/BACK slots + bench).
'use strict';
const { boot } = require('./harness.cjs');
const path = require('path');
(async () => {
  const t = await boot({ flow: 0 });
  await t.J(() => {
    RUN = newRun('ash');
    RUN.roster = ['ash', 'elin', 'mira', 'cassia', 'hask'];   // 5 recruited → 3 slots + 2 bench
    RUN.active = ['ash', 'cassia', 'elin'];
    RUN.hp = { ash: 32, elin: 24, mira: 21, cassia: 30, hask: 22 };
    RUN.floor = 2; RUN.completed = [];
    showPartySelect(() => {});
  });
  await t.sleep(500);
  await t.page.screenshot({ path: path.join(__dirname, 'shots', 'party-formation.png') });
  const info = await t.J(() => ({
    slots: document.querySelectorAll('.ps-slot .ps-card').length,
    bench: document.querySelectorAll('.ps-bench .ps-card').length,
    labels: [...document.querySelectorAll('.ps-slotlabel b')].map(x => x.textContent).join('/'),
  }));
  console.log('slots:', info.slots, '· bench:', info.bench, '· positions:', info.labels);
  await t.browser.close();
  process.exit(0);
})();
