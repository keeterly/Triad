// Screenshot the cinematic VOW VERSE banner during the all-out (portraits + name).
'use strict';
const { boot } = require('./harness.cjs');
const path = require('path');
(async () => {
  const t = await boot({ flow: 0 });
  await t.J(() => {
    hideOverlay && hideOverlay();
    RUN = newRun('ash'); RUN.roster = ['ash', 'elin', 'mira']; RUN.active = RUN.roster.slice();
    startFight({ type: 'fight', chapter: 3, heroes: ['ash', 'elin', 'mira'], enemies: ['wraith'], narrator: 'x' });
    S.pairsAwake = new Set([pairKey('ash', 'elin')]);
    document.getElementById('stage').classList.add('allout-focus');
    // fire the verse banner (don't await — grab it mid-slam)
    vowVerseIntro(['ash', 'elin'], 'Warded Edge', false);
  });
  await t.sleep(500);
  await t.page.screenshot({ path: path.join(__dirname, 'shots', 'vow-verse.png') });
  await t.browser.close(); console.log('shot saved'); process.exit(0);
})();
