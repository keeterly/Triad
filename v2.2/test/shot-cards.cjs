// One-off: screenshot a rotation hand showing the new OPENER/COMBO/FINISHER
// chain-position line across a party.  node test/shot-cards.cjs
'use strict';
const { boot } = require('./harness.cjs');

(async () => {
  const t = await boot({ flow: 0 });
  await t.J(() => {
    // party of three with combo (sig) nodes owned so forged steps show
    RUN = newRun('ash');
    RUN.roster = ['ash', 'cassia', 'elin']; RUN.active = RUN.roster.slice();
    RUN.hp = {}; RUN.roster.forEach(h => RUN.hp[h] = HEROES[h].maxHp);
    RUN.nodes = ['ash.sig.front', 'ash.branch.front', 'cassia.sig.front', 'elin.sig.front'];
    RUN.completed = [0,1,2,3,4,5,6,7,8]; RUN.bonds = {};
    RUN._rotations = true;
    startMapFight(RUN.map.find(x => x.type === 'fight'));
    S.heroes.forEach(h => { h.row = 'front'; });
    S.ep = 20;
    // drive Ash: play opener -> forge combo, then play combo -> forge finisher,
    // so his three cards (opener spent, combo, finisher) all sit in the hand.
    const ash = S.heroes.find(h => h.id === 'ash');
    renderAll();
    const op = buildHand().find(c => c.owner === 'ash' && c.kind === 'opener');
    S.tempCards = []; resolveChainPlay(op);
    const combo = S.tempCards.find(c => /^COMBO/.test(c.stance));
    if (combo) resolveChainPlay(combo);
    renderAll();
  });
  await t.sleep(400);
  await t.shot('rotation-cards');
  await t.browser.close();
  console.log('shot saved to test/shots/');
  process.exit(0);
})();
