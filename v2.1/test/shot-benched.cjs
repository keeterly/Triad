// Screenshot the map with a BENCHED roster member, to confirm it's visible (not "gone").
'use strict';
const { boot } = require('./harness.cjs');
const path = require('path');
(async () => {
  const t = await boot({ flow: 0 });
  const info = await t.J(() => {
    RUN = newRun('ash');
    RUN.roster = ['ash', 'elin', 'mira', 'hask'];   // 4 recruited
    RUN.active = ['ash', 'elin', 'mira'];            // Hask BENCHED
    RUN.hp = { ash: 32, elin: 24, mira: 21, hask: 22 };
    RUN.floor = 2; RUN.completed = [];
    showMap();
    const figs = document.querySelectorAll('.party-chip-fig');
    const benched = document.querySelectorAll('.party-chip-fig.benched');
    const meta = (document.querySelector('.party-chip-meta') || {}).textContent || '';
    return { figs: figs.length, benched: benched.length, metaHasBenched: /benched/.test(meta) };
  });
  await t.sleep(400);
  await t.page.screenshot({ path: path.join(__dirname, 'shots', 'benched-hask.png') });
  console.log('party chip figs:', info.figs, '· benched shown:', info.benched, '· meta mentions benched:', info.metaHasBenched);
  console.log(info.benched === 1 && info.metaHasBenched ? '✓ benched Hask is visible + labelled' : '✗ benched hero not surfaced');
  await t.browser.close();
  process.exit(0);
})();
