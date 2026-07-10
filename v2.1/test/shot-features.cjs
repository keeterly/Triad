'use strict';
const { boot } = require('./harness.cjs');
const path = require('path');
(async () => {
  const t = await boot({ flow: 0 });
  // 1) CAMP with a fallen member → RAISE choice
  await t.J(() => {
    RUN = newRun('ash'); RUN.roster = ['ash', 'elin', 'hask']; RUN.active = ['ash', 'elin', 'hask'];
    RUN.hp = { ash: 12, elin: 20, hask: 0 };
    showCamp({ id: 90, label: 'THE GREY MILE' });
  });
  await t.sleep(500);
  await t.page.screenshot({ path: path.join(__dirname, 'shots', 'camp-raise.png') });
  // 2) EMBER TREE zoomed in
  const zoomInfo = await t.J(() => {
    hideOverlay();
    RUN = newRun('ash'); RUN.roster = ['ash']; RUN.active = ['ash'];
    RUN.embers = 40; RUN.completed = [0,1,2,3,4,5,6,7,8];
    showEmberTree(() => {}, 'ash');
    const zin = document.getElementById('et-zoom-in'), zout = document.getElementById('et-zoom-out');
    const pan = document.getElementById('et-pan');
    const before = pan.style.transform;
    if (zin) { zin.click(); zin.click(); }   // +0.5
    const after = pan.style.transform;
    return { hasButtons: !!(zin && zout), before, after };
  });
  await t.sleep(400);
  await t.page.screenshot({ path: path.join(__dirname, 'shots', 'tree-zoomed.png') });
  console.log('zoom buttons present:', zoomInfo.hasButtons);
  console.log('pan transform before:', zoomInfo.before, '→ after:', zoomInfo.after);
  console.log(/scale\(1\.5\)/.test(zoomInfo.after) ? '✓ zoom-in works (scale 1 → 1.5)' : '✗ zoom did not apply');
  await t.browser.close();
  process.exit(0);
})();
