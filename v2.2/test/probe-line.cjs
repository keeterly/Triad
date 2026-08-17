// Hand-play one whole turn, card by card, with the EP and the whole table showing
// — so a number from a meter is never the first time anyone has seen what a change
// actually does. Written because the meter once reported the relay playing MORE
// cards a turn, which was the opposite of the prediction and turned out to be an
// endless-turn bug the meter's card cap had disguised. A surprising number in this
// repo gets played by hand before it gets reported.
//
//   node test/probe-line.cjs            the party-wide LINE
//   RELAY=0 node test/probe-line.cjs    the private per-hero chains it replaces
'use strict';
const { boot } = require('./harness.cjs');
const RELAY = process.env.RELAY !== '0';

(async () => {
  const t = await boot({ p: 0 });
  await t.page.emulateMedia({ reducedMotion: 'reduce' });
  await t.autoParry(true); await t.fastCombat(0.06); await t.parrySkill(1, 99);

  await t.J((relay) => {
    // triadCeremony() awaits a tap; a card played from inside one evaluate can
    // never get one. Tap it from inside the page, as a player would.
    setInterval(() => {
      const ov = document.querySelector('#overlay');
      if (ov && !ov.classList.contains('hidden') && ov.querySelector('.ov-tap')) ov.click();
    }, 50);
    const heroes = ['ash', 'elin', 'mira'], rows = { ash: 'front', elin: 'mid', mira: 'back' };
    RUN = newRun(heroes[0]);
    RUN.roster = heroes.slice(); RUN.active = heroes.slice();
    RUN.hp = {}; heroes.forEach(h => RUN.hp[h] = HEROES[h].maxHp);
    RUN.nodes = ROTATION_GATES.slice();
    RUN.completed = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    RUN.bonds = {}; RUN._rotations = true; RUN._line = relay;
    startFight({ type: 'fight', chapter: 3, heroes: heroes.slice(),
      enemies: ['husk', 'wraith', 'cultist'], useRunHp: true, floor: 1, depth: 3, narrator: 'p' });
    S.heroes.forEach(h => { if (rows[h.id]) h.row = rows[h.id]; });
    S.enemies.forEach(e => { e.hp = e.maxHp = 500; });   // nothing dies — measure the TURN, not the win
    S._rotations = true; S._line = relay; renderAll();
    window.__legal = () => buildHand().filter(c => !c.spent && c.cost <= S.ep && c.kind !== 'move');
    window.__show = () => 'ep ' + S.ep + '/' + S.maxEp + '  [' +
      window.__legal().map(c => `${c.ownerName}:${c.name}·${c.cost}`).join('  ') + ']';
    window.__step = async () => {
      const legal = window.__legal();
      if (!legal.length) return null;
      const c = legal.find(x => x.chain) || legal[0];
      await playCard(c, (c.target === 'ally' || c.target === 'allies')
        ? (lowestHpAlly() || {}).id : ((frontmostEnemy() || livingEnemies()[0] || {}).uid));
      return c.ownerName + ' plays ' + c.name + ' (' + c.cost + ' ep)';
    };
  }, RELAY);

  console.log('\n' + (RELAY ? '=== THE LINE ===' : '=== PRIVATE CHAINS ==='));
  console.log('turn start   | ' + await t.J(() => window.__show()));
  let n = 0;
  for (let i = 0; i < 25; i++) {
    const played = await t.J(() => window.__step());
    if (!played) break;
    n++;
    console.log(String(n).padStart(2) + '. ' + played.padEnd(34) + '| ' + await t.J(() => window.__show()));
  }
  console.log('\ncards this turn: ' + n + '   ' + await t.J(() =>
    'ep left ' + S.ep + '  line ' + JSON.stringify(S.line) + '  foe hp lost '
    + S.enemies.reduce((a, e) => a + (e.maxHp - e.hp), 0)));
  await t.browser.close(); process.exit(0);
})();
