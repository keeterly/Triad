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
    const c = document.querySelector('#hand .card.card-follow');
    return { present: !!c, owner: c && c.dataset.owner, hasAvatar: !!(c && c.querySelector('.c-follow-avatar svg')), hasIcon: !!(c && c.querySelector('.c-fx .ic')) };
  });
  console.log('follow-up card:', JSON.stringify(info));
  // now the portrait CUT-IN (fire without awaiting, grab it mid-slide)
  await t.J(() => { followCutIn('elin', 'ash', 'Warded Edge'); });
  await t.sleep(420);
  await t.page.screenshot({ path: path.join(__dirname, 'shots', 'follow-cutin.png') });
  await t.browser.close(); process.exit(0);
})();
