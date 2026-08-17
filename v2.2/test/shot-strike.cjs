// Screenshot the redesigned JRPG attack telegraph (localized slash + spark),
// captured mid-animation on the target hero.
'use strict';
const { boot } = require('./harness.cjs');
(async () => {
  const t = await boot({ flow: 0 });
  await t.J(() => {
    hideOverlay && hideOverlay();
    RUN = newRun('cassia'); RUN.roster = ['cassia','mira','elin']; RUN.active = RUN.roster.slice();
    startFight({ type:'fight', chapter:3, heroes:['cassia','mira','elin'], enemies:['wraith'], narrator:'cassia' });
    renderAll();
  });
  await t.sleep(400);
  // fire a slash + slam telegraph ON the front hero's position, then grab it mid-cut
  await t.J(() => {
    const fig = document.querySelector('#party-half .figure');
    const sr = document.getElementById('stage').getBoundingClientRect();
    const r = fig.getBoundingClientRect();
    const ax = (r.left + r.width/2 - sr.left) / (sr.width/stageDW());
    const ay = (r.top + r.height*0.42 - sr.top) / (sr.height/stageDH());
    bossAttackBeat('slash', ax, ay);
  });
  await t.sleep(150);
  await t.shot('strike-telegraph');
  await t.browser.close(); console.log('shot saved'); process.exit(0);
})();
