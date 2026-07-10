'use strict';
const { boot } = require('./harness.cjs');
const path = require('path');
(async () => {
  const t = await boot({ flow: 0 });
  const info = await t.J(() => {
    RUN = newRun('ash'); RUN.roster = ['ash', 'mira', 'branwen']; RUN.active = ['ash', 'mira', 'branwen']; RUN.boons = [];
    // force the pool to duo/trio by pre-owning the single-hero boons
    RUN.boons = BOONS.filter(b => !b.duo && !b.trio && !b.rare && ['ash','mira','branwen'].includes(b.hero)).map(b => b.id);
    showBoonDraft(() => {}, {});
    const cards = [...document.querySelectorAll('.boon-card')];
    return { count: cards.length, kinds: cards.map(c => c.className.replace('boon-card', '').trim()).join(' | '),
      froms: cards.map(c => (c.querySelector('.boon-from') || {}).textContent).join(' | ') };
  });
  await t.sleep(500);
  await t.page.screenshot({ path: path.join(__dirname, 'shots', 'boon-duo-trio.png') });
  console.log('cards:', info.count, '· classes:', info.kinds);
  console.log('froms:', info.froms);
  await t.browser.close();
  process.exit(0);
})();
