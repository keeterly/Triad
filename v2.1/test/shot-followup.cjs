// Screenshot the offered BOND FOLLOW-UP card materializing in the partner's hand.
'use strict';
const { boot } = require('./harness.cjs');
const path = require('path');
(async () => {
  const t = await boot({ flow: 0 });
  await t.J(() => {
    hideOverlay && hideOverlay();
    RUN = newRun('ash'); RUN.roster = ['ash','elin','mira']; RUN.active = RUN.roster.slice();
    startFight({ type:'fight', chapter:3, heroes:['ash','elin','mira'], enemies:['wraith'], narrator:'x' });
    S.pairsAwake = new Set([pairKey('ash','elin')]);   // Ash & Elin woven
    S._assistedPairs = new Set();
    renderCombatBoons();
    offerBondFollow('ash');   // Ash "played a finisher" → Elin's Follow-Up card appears
    renderAll();
  });
  await t.sleep(500);
  await t.page.screenshot({ path: path.join(__dirname, 'shots', 'bond-followup.png') });
  const info = await t.J(() => {
    const c = [...document.querySelectorAll('#hand .card')].find(x => x.dataset.cardName === 'Follow-Up');
    return { present: !!c, owner: c && c.dataset.owner };
  });
  console.log('follow-up card:', JSON.stringify(info));
  await t.browser.close(); process.exit(0);
})();
