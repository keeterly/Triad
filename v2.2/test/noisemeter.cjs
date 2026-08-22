// NOISEMETER — how many things does the game say, and how many at once?
//
// There are ~160 places in game.js that can raise a floating popup. Nothing
// counted them, nothing bounded them, and nothing asked whether the player could
// act on any of it. This plays real turns and records every transient the game
// prints: how many per card play, how many alive at the same instant, and which
// labels fire most — so "too many popups" is a list with numbers next to it.
//
//   node test/noisemeter.cjs
'use strict';
const { boot } = require(require('path').join(__dirname, 'harness.cjs'));

(async () => {
  const t = await boot({});
  const J = t.J.bind(t);
  await t.page.setViewportSize({ width: 1000, height: 462 });
  await t.fastCombat(0.25);
  await t.autoParry(true);

  await J(() => {
    try { localStorage.setItem('kizuna2_2.tutorialSeen', '1'); } catch (_) {}
    RUN = newRun('ash'); RUN.roster = ['ash', 'hask', 'mira']; RUN.active = RUN.roster.slice();
    RUN.hp = {}; RUN.active.forEach(h => RUN.hp[h] = HEROES[h].maxHp);
    RUN.floor = 1; RUN.completed = []; RUN.map = generateDescent(RUN.roster, 1);
    const n = mapAll().find(x => x.type === 'elite') || mapAll().find(x => x.type === 'fight');
    RUN.completed = mapAll().filter(x => x.col < n.col).map(x => x.id);
    enterMapNode(n);
    window.__nm = [];
    const t0 = Date.now();
    new MutationObserver(ms => { for (const m of ms) for (const n2 of m.addedNodes) {
      if (n2.nodeType !== 1 || !n2.className) continue;
      if (/\bpopup\b/.test(String(n2.className)))
        window.__nm.push({ t: Date.now() - t0, text: (n2.textContent || '').trim() });
    } }).observe(document.getElementById('popup-layer'), { childList: true, subtree: true });
  });
  await t.sleep(1400);

  // play a real fight out
  let turns = 0;
  while (turns++ < 14) {
    if (await J(() => !(typeof S !== 'undefined' && S) || S.over)) break;
    for (let k = 0; k < 6; k++) {
      const played = await J(async () => {
        if (!S || S.over || S.executing) return false;
        const c = buildHand().find(x => !x.spent && x.cost <= S.ep && x.kind !== 'move');
        if (!c) return false;
        const tid = (c.target === 'ally' || c.target === 'allies') ? (lowestHpAlly() || {}).id
                  : c.target === 'self' ? c.owner : ((frontmostEnemy() || livingEnemies()[0]) || {}).uid;
        await playCard(c, tid); return true;
      });
      if (!played) break;
      for (let i = 0; i < 120; i++) { if (await J(() => !S || S.over || !S.executing)) break; await t.sleep(60); }
    }
    if (await J(() => !S || S.over)) break;
    await J(async () => { if (S && !S.over && !S.executing) await endTurn(); });
    for (let i = 0; i < 240; i++) { if (await J(() => !S || S.over || !S.executing)) break; await t.sleep(60); }
  }

  const msgs = await J(() => window.__nm);
  const plays = Math.max(1, turns);
  let peak = 0, peakAt = 0;
  for (const m of msgs) {
    const alive = msgs.filter(x => x.t >= m.t - 900 && x.t <= m.t).length;
    if (alive > peak) { peak = alive; peakAt = m.t; }
  }
  const byLabel = {};
  msgs.forEach(m => { const k = m.text.replace(/[0-9]+/g, 'N'); byLabel[k] = (byLabel[k] || 0) + 1; });
  const top = Object.entries(byLabel).sort((a, b) => b[1] - a[1]).slice(0, 14);

  console.log('\n=== NOISEMETER · v2.2 ===\n');
  console.log('  a full fight, ' + turns + ' turns');
  console.log('  ' + msgs.length + ' popups total  ·  ' + (msgs.length / plays).toFixed(1) + ' per turn');
  console.log('  peak alive at once: ' + peak + ' (at +' + peakAt + 'ms)');
  console.log('\n  most-printed labels:');
  top.forEach(([k, v]) => console.log('    ' + String(v).padStart(3) + '  ' + k));
  await t.browser.close();
})();
