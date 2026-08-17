'use strict';
const { boot } = require('./harness.cjs');
const path = require('path');
(async () => {
  const t = await boot({ flow: 0 });
  await t.J(() => {
    // pretend a few gifts have been collected across runs
    ['ash_duelist', 'hask_emberheart', 'duo_ashmira', 'trio_killwind', 'curse_glassedge'].forEach(id => markBoonCollected(id));
    showBoonJournal(() => {});
  });
  await t.sleep(500);
  await t.page.screenshot({ path: path.join(__dirname, 'shots', 'boon-journal.png') });
  const info = await t.J(() => ({ entries: document.querySelectorAll('.bj-entry').length, owned: document.querySelectorAll('.bj-entry.bj-owned').length, sections: document.querySelectorAll('.bj-sec-title').length }));
  console.log('journal:', JSON.stringify(info));
  await t.browser.close();
  process.exit(0);
})();
