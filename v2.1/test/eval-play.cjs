'use strict';
const { boot } = require('./harness.cjs');

(async () => {
  const t = await boot({ flow: 0 });
  const log = [];
  const note = (s) => { log.push(s); console.log(s); };

  // Hook flashNarrator so we can read every callout the player would see.
  await t.J(() => {
    window.__narr = [];
    const orig = window.flashNarrator;
    window.flashNarrator = function (msg) { try { window.__narr.push(String(msg)); } catch (_) {} return orig ? orig.apply(this, arguments) : undefined; };
  });
  const drainNarr = async () => t.J(() => { const n = window.__narr.slice(); window.__narr.length = 0; return n; });

  // ---- Snapshot of the starting economy / hand for a fresh solo hero ----
  const solo = await t.J(() => {
    RUN = newRun('ash');
    RUN.map = generateDescent(RUN.roster, 1);
    const fnode = RUN.map.find(x => x.type === 'fight');
    startMapFight(fnode);
    renderAll();
    const hand = buildHand().map(c => ({ n: c.name, cost: c.cost, tgt: c.target, stance: c.stance || '' }));
    return { ep: S.ep, epMax: S.epMax, hp: S.heroes.map(h => h.id + ' ' + h.hp + '/' + h.maxHp + ' @' + h.row),
             foes: S.enemies.map(e => e.def.name + ' ' + e.hp + 'hp row:' + e.row),
             hand, burstCap: (typeof burstCap === 'function' ? burstCap() : '?') };
  });
  note('=== SOLO ASH FIRST FIGHT (fresh run) ===');
  note('EP: ' + solo.ep + '/' + solo.epMax + '  burstCap ' + solo.burstCap);
  note('Party: ' + solo.hp.join(' | '));
  note('Foes: ' + solo.foes.join(' | '));
  note('Starting hand (' + solo.hand.length + ' cards):');
  solo.hand.forEach(c => note('   [' + c.cost + 'EP] ' + c.n + '  (' + c.tgt + ') ' + c.stance));

  // ---- Drive the solo fight a couple turns to watch EP & momentum flow ----
  await t.J(() => { window.__autoParry = true; });
  for (let turn = 1; turn <= 4; turn++) {
    const over = await t.J(() => !S || S.over);
    if (over) break;
    await t.J(async () => {
      let g = 0;
      while (g++ < 6) {
        if (S.executing || S.over) break;
        const card = buildHand().find(c => !c.spent && c.cost <= S.ep && c.fx && (c.fx.dmg || c.fx.castDmg));
        if (!card) break;
        let tid = card.target === 'enemy' || card.target === 'frontmost' ? (frontmostEnemy() || livingEnemies()[0] || {}).uid : (livingHeroes()[0] || {}).id;
        try { await playCard(card, tid); } catch (_) { break; }
      }
    });
    const st = await t.J(() => ({ ep: S.ep, mom: S.momentum, combo: S.combo, foes: livingEnemies().length }));
    note(`  turn ${turn}: after playing dmg cards → EP left ${st.ep}, momentum ${st.mom}/100, combo ${st.combo}, foes ${st.foes}`);
    await t.endTurn();
    await t.dismissCeremony();
    const nn = await drainNarr();
    if (nn.length) note('    narrator: ' + nn.join(' // '));
  }

  // ================= BONDED TRIO + ALL-OUT =================
  note('\n=== BONDED TRIO: bond assists + all-out payoff ===');
  await t.J(() => {
    window.__autoParry = true;
    RUN = newRun('ash');
    RUN.roster = ['ash', 'elin', 'mira']; RUN.active = ['ash', 'elin', 'mira'];
    RUN.hp = { ash: 32, elin: 26, mira: 28 };
    RUN.nodes = ['ash.sig.front', 'elin.sig.front', 'mira.sig.front'];
    RUN.bonds = { 'ash|elin': 3, 'elin|mira': 3, 'ash|mira': 3 };  // all kindled
    RUN.floor = 2; RUN.completed = [0,1,2,3,4,5];
    RUN.map = generateDescent(RUN.roster, 2);
    startFight({ type: 'fight', chapter: 3, heroes: RUN.active.slice(), enemies: ['husk','wraith','cultist'], useRunHp: true, floor: 2, depth: 6, narrator: 'bond test' });
    // Awaken all duets so weaves are live this fight
    if (typeof awakenDuet === 'function') { S.pairsAwake = new Set(['ash|elin','elin|mira','ash|mira']); }
    renderAll();
  });
  await drainNarr();
  const weaveInfo = await t.J(() => {
    const chips = [...document.querySelectorAll('#combat-boons [data-weave]')].map(c => ({ title: c.getAttribute('title'), txt: c.textContent }));
    return { pairsAwake: [...(S.pairsAwake||[])], chips };
  });
  note('pairsAwake: ' + weaveInfo.pairsAwake.join(', '));
  note('weave chips shown: ' + weaveInfo.chips.length + (weaveInfo.chips[0] ? ' e.g. "' + (weaveInfo.chips[0].title||'').slice(0,90) + '"' : ''));

  // Attack with Ash, observe bond assist callouts
  await t.J(async () => {
    const card = buildHand().find(c => c.owner === 'ash' && !c.spent && c.fx && c.fx.dmg && c.cost <= S.ep);
    if (card) { const tid = (frontmostEnemy()||livingEnemies()[0]||{}).uid; try { await playCard(card, tid); } catch(_){} }
  });
  await t.sleep(400);
  let nn = await drainNarr();
  note('After ONE Ash attack, callouts: ' + (nn.length ? nn.join(' // ') : '(none)'));

  // Pump momentum to full and fire all-out
  await t.J(() => { S.momentum = burstCap(); renderBurst && renderBurst(); });
  const canAO = await t.J(() => typeof triggerAllOut === 'function' && (typeof burstReady==='function' ? burstReady() : S.momentum>=100));
  note('burst ready for all-out: ' + canAO);
  await t.J(() => { S.crownReady = true; if ('allOutCrowned' in S) S.allOutCrowned = true; });
  const foesBefore = await t.J(() => livingEnemies().map(e => e.def.name + ':' + e.hp));
  await t.J(() => triggerAllOut());
  await t.sleep(500);
  await t.dismissCeremony();
  nn = await drainNarr();
  const foesAfter = await t.J(() => ({ living: livingEnemies().map(e => e.def.name+':'+e.hp), dead: S.enemies.filter(e=>e.dead).length }));
  note('ALL-OUT foes before: ' + foesBefore.join(', '));
  note('ALL-OUT foes after: living[' + foesAfter.living.join(', ') + '] dead ' + foesAfter.dead);
  note('ALL-OUT callouts (' + nn.length + '):');
  nn.forEach(m => note('   ' + m));

  // ================= BOSS SNAPSHOT =================
  note('\n=== BOSS ENCOUNTER (difficulty check) ===');
  const boss = await t.J(() => {
    const bnode = RUN.map.find(x => x.type === 'boss');
    return bnode ? { id: bnode.id, name: bnode.name || bnode.label, enemies: bnode.enemies } : null;
  });
  note('boss node: ' + JSON.stringify(boss));

  await t.browser.close();
  process.exit(0);
})();
