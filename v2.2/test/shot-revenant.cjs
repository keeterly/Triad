// Verify the previously-invisible enemies (revenant/brood/cantor) now render art.
'use strict';
const { boot } = require('./harness.cjs');
const path = require('path');
(async () => {
  const t = await boot({ flow: 0 });
  const info = await t.J(() => {
    hideOverlay && hideOverlay();
    startFight({ type: 'fight', chapter: 3, heroes: ['ash', 'cassia', 'hask'], enemies: ['revenant', 'cantor', 'brood'], narrator: 'art check' });
    renderAll();
    return ['revenant', 'cantor', 'brood', 'wraith'].map(id => {
      const svg = (typeof enemyArt === 'function') ? enemyArt({ def: ENEMY_DEFS[id], id }) : '';
      return id + ':' + (svg && svg.length > 20 ? 'ART(' + svg.length + ')' : 'EMPTY');
    }).join('  ');
  });
  await t.sleep(400);
  await t.page.screenshot({ path: path.join(__dirname, 'shots', 'enemy-art-fixed.png') });
  console.log(info);
  const dom = await t.J(() => [...document.querySelectorAll('#enemy-half .figure')].map(f => (f.querySelector('.fig-art svg') ? 'HAS-SVG' : 'BLANK')).join(','));
  console.log('enemy figures in DOM:', dom);
  await t.browser.close();
  process.exit(0);
})();
