'use strict';
const { boot } = require('./harness.cjs');
(async () => {
  const t = await boot({ flow: 0 });
  await t.J(() => {
    hideOverlay && hideOverlay();
    RUN = newRun('ash'); RUN.roster = ['ash', 'elin', 'branwen']; RUN.active = RUN.roster.slice();
    RUN.nodes = []; RUN.completed = [0,1,2,3,4,5,6,7,8];
    showEmberTree(() => {}, 'ash', 'ash.emergent.tempo');
  });
  await t.sleep(500);
  await t.shot('tree-detail');
  await t.browser.close(); console.log('shot saved'); process.exit(0);
})();
