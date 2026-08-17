// Repro: does Hask survive a floor 1 -> 2 transition when he's in the active party?
'use strict';
const { boot } = require('./harness.cjs');
(async () => {
  const t = await boot({ flow: 0 });
  const out = await t.J(() => {
    RUN = newRun('ash');
    RUN.roster = ['ash', 'elin', 'hask']; RUN.active = ['ash', 'elin', 'hask'];
    RUN.hp = { ash: 32, elin: 24, hask: 0 };   // HASK DOWNED at the floor boss (hp 0)
    RUN.floor = 1; RUN.completed = [0, 1, 2, 3];
    const before = { roster: RUN.roster.slice(), active: RUN.active.slice(), floor: RUN.floor, haskHp: RUN.hp.hask };
    onFloorCleared();
    const afterCleared = { roster: RUN.roster.slice(), active: RUN.active.slice(), floor: RUN.floor, haskHp: RUN.hp.hask };
    // simulate quitting and reopening between floors
    saveRun();
    const reloaded = loadRun();
    const afterReload = reloaded ? { roster: reloaded.roster, active: reloaded.active, floor: reloaded.floor } : null;
    return { before, afterCleared, afterReload, fightHeroes: RUN.active.slice(), FLOORS: (typeof FLOORS !== 'undefined' ? FLOORS : '?') };
  });
  console.log('FLOORS =', out.FLOORS);
  console.log('BEFORE  floor', out.before.floor, '· active', JSON.stringify(out.before.active), '· hask hp', out.before.haskHp, '(DOWNED)');
  console.log('AFTER   floor', out.afterCleared.floor, '· active', JSON.stringify(out.afterCleared.active), '· hask hp', out.afterCleared.haskHp);
  console.log('RELOAD  floor', out.afterReload && out.afterReload.floor, '· active', JSON.stringify(out.afterReload && out.afterReload.active));
  console.log('fight would field:', JSON.stringify(out.fightHeroes));
  console.log(out.afterCleared.active.includes('hask') && out.afterReload.active.includes('hask') ? '✓ Hask SURVIVES (incl. downed + reload)' : '✗ Hask was DROPPED');
  await t.browser.close();
  process.exit(0);
})();
