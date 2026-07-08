// Screenshot a mixed enemy line so the varied telegraphs (mash / hold / arc /
// slam glyphs) are visible on-screen. node test/shot-enemies.cjs
'use strict';
const { boot } = require('./harness.cjs');

(async () => {
  const t = await boot({ flow: 0 });
  await t.J(() => {
    hideOverlay();
    RUN = newRun('ash'); RUN.roster = ['ash', 'elin', 'cassia']; RUN.active = RUN.roster.slice();
    startFight({ type: 'fight', chapter: 3, heroes: ['ash', 'elin', 'cassia'], enemies: ['wraith', 'cultist', 'drone'], narrator: 'bestiary' });
    // aim each foe at a telegraphing damage intent so its glyph shows
    S.enemies[0].intentIdx = 0;   // Wraith — Grasping Flurry (mash)
    S.enemies[1].intentIdx = 1;   // Cultist — Dark Channel (hold)
    S.enemies[2].intentIdx = 1;   // Drone — Piston Slam (big tap)
    renderAll();
  });
  await t.sleep(500);
  await t.shot('enemy-telegraphs');
  await t.browser.close();
  console.log('shot saved');
  process.exit(0);
})();
