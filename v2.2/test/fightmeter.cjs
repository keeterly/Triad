// FIGHTMETER — how long does a fight actually last, and does the player ever
// get to play one?
//
// The parry is the best thing in this game and a player who never reaches the
// enemy phase never sees it. This drives a plain, tactics-free bot through every
// room type on the floor and reports the only numbers that decide whether the
// combat has a shape: turns to resolve, how much of the enemy line dies on turn
// one, blows the party actually had to answer, and health spent doing it.
//
//   node test/fightmeter.cjs           the default sweep
//   FIGHTS=8 node test/fightmeter.cjs  more samples per room type
'use strict';
const { boot } = require(require('path').join(__dirname, 'harness.cjs'));
const PER = +(process.env.FIGHTS || 5);

(async () => {
  const t = await boot({});
  const J = t.J.bind(t);
  await t.page.setViewportSize({ width: 1000, height: 462 });
  await t.fastCombat(0.12);
  await t.autoParry(true);
  // A FRAME-PERFECT DEFENDER TAKES NO DAMAGE, WHICH MEASURES NOTHING ABOUT THE
  // GAME. Default the bot to a plausible human: most notes read, some botched.
  const SKILL = process.env.SKILL === undefined ? 0.6 : +process.env.SKILL;
  await t.parrySkill(SKILL);

  // count the blows the party was actually asked to answer
  await J(() => {
    window.__fm = { cascades: 0 };
    new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes)
      if (n.nodeType === 1 && n.classList && n.classList.contains('parry-ring')) window.__fm.cascades++;
    }).observe(document.getElementById('popup-layer'), { childList: true, subtree: true });
  });

  const enter = (kind, seed) => J((o) => {
    try { localStorage.setItem('kizuna2_2.tutorialSeen', '1'); } catch (_) {}
    RUN = newRun('ash');
    RUN.roster = ['ash', 'hask', 'mira']; RUN.active = RUN.roster.slice();
    RUN.hp = {}; RUN.active.forEach(h => RUN.hp[h] = HEROES[h].maxHp);
    RUN.embers = 0; RUN.floor = 1; RUN.completed = [];
    RUN.map = generateDescent(RUN.roster, 1);
    const pool = mapAll().filter(x => x.type === o.k);
    const node = pool[o.s % Math.max(1, pool.length)] || mapAll().find(x => x.type === 'fight');
    RUN.completed = mapAll().filter(x => x.col < node.col).map(x => x.id);
    S = null;                       // never read a stale board as "already won"
    enterMapNode(node);
    window.__fm.cascades = 0;
    return { label: node.label };
  }, { k: kind, s: seed });

  // A BOSS DOOR IS A SCREEN, NOT A FIGHT. enterMapNode on a boss opens the
  // domain gate and waits for the player; a rig that starts counting turns
  // there reads a stale board, calls the fight won in one turn, and reports a
  // balance problem that does not exist. Walk through whatever stands between
  // the node and the first hand.
  const reachBoard = async () => {
    for (let i = 0; i < 14; i++) {
      const st = await J(() => ({ live: !!(typeof S !== 'undefined' && S && !S.over && S.enemies && S.enemies.length),
        ov: !!(document.querySelector('#overlay') && !document.querySelector('#overlay').classList.contains('hidden')) }));
      if (st.live) return true;
      if (st.ov) await J(() => { const b = document.querySelector('#overlay .btn-primary, #overlay button'); (b || document.querySelector('#overlay')).click(); });
      await t.sleep(500);
    }
    return false;
  };

  // THE BOT HAS NO TACTICS. It plays whatever it can afford, biggest first, at
  // whatever is in front of it, and ends the turn. If a fight cannot survive
  // that, it was never a fight.
  const playFight = async () => {
    let turns = 0, t1Kill = 0;
    while (turns++ < 30) {
      if (await J(() => !(typeof S !== 'undefined' && S) || S.over)) break;
      for (let k = 0; k < 6; k++) {
        const played = await J(async () => {
          if (!S || S.over || S.executing) return false;
          const opts = buildHand().filter(c => !c.spent && c.cost <= S.ep && c.kind !== 'move');
          if (!opts.length) return false;
          const c = opts.sort((a, b) => ((b.fx && b.fx.dmg) || 0) - ((a.fx && a.fx.dmg) || 0))[0];
          const tid = (c.target === 'ally' || c.target === 'allies') ? (lowestHpAlly() || {}).id
                    : c.target === 'self' ? c.owner
                    : ((frontmostEnemy() || livingEnemies()[0]) || {}).uid;
          await playCard(c, tid); return true;
        });
        if (!played) break;
        for (let i = 0; i < 120; i++) { if (await J(() => !S || S.over || !S.executing)) break; await t.sleep(60); }
      }
      if (turns === 1) t1Kill = await J(() => S ? S.enemies.filter(e => e.dead).length / Math.max(1, S.enemies.length) : 1);
      if (await J(() => !S || S.over)) break;
      await J(async () => { if (S && !S.over && !S.executing) await endTurn(); });
      for (let i = 0; i < 300; i++) { if (await J(() => !S || S.over || !S.executing)) break; await t.sleep(60); }
    }
    return Object.assign({ turns, t1Kill }, await J(() => ({
      won: !!(S && S.over && livingEnemies().length === 0),
      cascades: window.__fm.cascades,
      party: S ? S.heroes.reduce((a, h) => a + Math.max(0, h.hp), 0) : 0,
      allOut: S ? (S.allOutUsed || 0) : 0,
    })));
  };

  console.log('\n=== FIGHTMETER · v2.2 · parry skill ' + SKILL + ' ===\n');
  const rows = [];
  for (const kind of ['fight', 'elite', 'boss']) {
    for (let i = 0; i < PER; i++) {
      await enter(kind, i);
      await t.sleep(700);
      if (!(await reachBoard())) { console.log('  (' + kind + ' ' + i + ': never reached a board — skipped)'); continue; }
      const pre = await J(() => ({ foes: livingEnemies().length, hp: livingEnemies().reduce((a, e) => a + e.hp, 0),
        party: S.heroes.reduce((a, h) => a + h.hp, 0) }));
      await J(() => { window.__fm.cascades = 0; });
      const r = await playFight();
      rows.push(Object.assign({ kind, foes: pre.foes, foeHp: pre.hp, hp0: pre.party }, r));
      for (let k = 0; k < 6; k++) {
        const tapped = await J(() => { const ov = document.querySelector('#overlay');
          if (ov && !ov.classList.contains('hidden')) { ov.click(); return true; } return false; });
        if (!tapped) break; await t.sleep(400);
      }
    }
  }

  const pct = (n, d) => d ? Math.round((n / d) * 100) + '%' : '—';
  const show = (kind) => {
    const g = rows.filter(r => r.kind === kind); if (!g.length) return;
    const turns = g.map(r => r.turns).sort((a, b) => a - b);
    const med = turns[Math.floor(turns.length / 2)];
    const one = g.filter(r => r.turns <= 1).length;
    const casc = g.reduce((a, r) => a + r.cascades, 0) / g.length;
    const hpLost = g.reduce((a, r) => a + (r.hp0 - r.party) / Math.max(1, r.hp0), 0) / g.length;
    console.log(kind.toUpperCase().padEnd(6) +
      '  n=' + g.length +
      '  turns med ' + med + ' (' + turns.join('/') + ')' +
      '  one-turned ' + pct(one, g.length) +
      '  notes faced ' + casc.toFixed(1) +
      '  hp spent ' + Math.round(hpLost * 100) + '%' +
      '  won ' + pct(g.filter(r => r.won).length, g.length));
  };
  ['fight', 'elite', 'boss'].forEach(show);

  const all = rows.length, oneTurn = rows.filter(r => r.turns <= 1).length;
  const noParry = rows.filter(r => r.cascades === 0).length;
  console.log('\n  ' + pct(oneTurn, all) + ' of fights end before the enemy ever swings');
  console.log('  ' + pct(noParry, all) + ' of fights show the player no parry at all');
  await t.browser.close();
})();
