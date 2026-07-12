// Screenshot the Clair Obscur slow-mo parry window: the world dilates (vignette +
// deep desaturation) as a note goes live, then the steel CLASH on a parried strike.
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
  // force the slow-mo state + a LIVE note over the front hero
  await t.J(() => {
    const st = document.getElementById('stage');
    st.classList.add('parry-focus', 'parry-slowmo');
    const fig = document.querySelector('#party-half .figure');
    const sr = st.getBoundingClientRect(), sc = sr.width/stageDW();
    const r = fig.getBoundingClientRect();
    const ax = (r.left + r.width/2 - sr.left)/sc, ay = (r.top + r.height*0.4 - sr.top)/sc;
    const ui = mkParryUiAt(ax, ay, `<span class="pr-target"></span><span class="pr-close"></span><span class="pr-lbl">TAP!</span>`, '');
    ui.el.classList.add('pr-live');
    // and a parried steel clash landing on the same spot
    bossAttackBeat('slash', ax, ay, true);
  });
  await t.sleep(120);
  await t.shot('slowmo-parry');
  await t.browser.close(); console.log('shot saved'); process.exit(0);
})();
