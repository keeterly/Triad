// Screenshot the party FORMATION editor + assert the whole thing (incl. WALK ON)
// fits inside the fixed stage at the device's wide aspect.
'use strict';
const { boot } = require('./harness.cjs');
const path = require('path');
(async () => {
  const t = await boot({ flow: 0 });
  const check = async (label, roster, active) => {
    const fits = await t.J((o) => {
      const r = o.r, a = o.a;
      RUN = newRun('ash');
      RUN.roster = r; RUN.active = a;
      RUN.hp = { ash: 32, elin: 24, mira: 21, cassia: 30, hask: 22 };
      RUN.floor = 2; RUN.completed = [];
      showPartySelect(() => {});
      const stage = document.getElementById('stage').getBoundingClientRect();
      const go = document.getElementById('ps-go').getBoundingClientRect();
      const head = document.querySelector('.et-head').getBoundingClientRect();
      return { ok: go.bottom <= stage.bottom + 0.5 && head.top >= stage.top - 0.5, goBottom: Math.round(go.bottom), stageBottom: Math.round(stage.bottom) };
    }, { r: roster, a: active });
    console.log(label, JSON.stringify(fits));
    return fits.ok;
  };
  // device case: 4 heroes → 1 bench (the reported overflow)
  await check('1-bench', ['ash', 'hask', 'elin', 'cassia'], ['ash', 'hask', 'elin']);
  await t.sleep(300);
  await t.page.screenshot({ path: path.join(__dirname, 'shots', 'party-1bench.png') });
  // 5 heroes → 2 bench
  await check('2-bench', ['ash', 'elin', 'mira', 'cassia', 'hask'], ['ash', 'cassia', 'elin']);
  await t.sleep(300);
  await t.page.screenshot({ path: path.join(__dirname, 'shots', 'party-2bench.png') });
  await t.browser.close(); process.exit(0);
})();
