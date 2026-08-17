// FUN RUN — play the game the way a player would: a built trio descends, fights
// real packs with auto-parry, and we watch for the moments that make it sing
// (threads, all-outs, boon procs, the weave, the parry ramp) — then report feel.
'use strict';
const { boot } = require('./harness.cjs');
const path = require('path');

(async () => {
  const t = await boot({ flow: 0 });
  const shots = path.join(__dirname, 'shots');
  const log = [];
  const note = (s) => { log.push(s); console.log(s); };

  // A mid-run trio: Ash (front skirmisher), Hask (mid weaver), Cassia (back wall).
  // Some skills kindled, a bond formed, and a boon in hand — a real build.
  await t.J(() => {
    window.__autoParry = true;
    RUN = newRun('ash');
    RUN.roster = ['ash', 'hask', 'cassia']; RUN.active = ['ash', 'hask', 'cassia'];
    RUN.hp = { ash: 32, hask: 22, cassia: 34 };
    RUN.nodes = ['ash.sig.front', 'hask.sig.front', 'hask.weave.astral', 'cassia.sig.front', 'cassia.passive.vigil'];
    RUN.boons = ['duo_haskcassia'];              // Frostwall: chilled foes +2 from all
    RUN.bonds = { 'ash|hask': 2, 'hask|cassia': 1 };
    RUN.floor = 1; RUN.completed = [0, 1, 2, 3, 4];   // depth 5 → parry ramp is mild
    RUN.map = generateDescent(RUN.roster, 1);
  });

  async function driveFight(label, enemies) {
    await t.J((en) => {
      startFight({ type: 'fight', chapter: 3, heroes: RUN.active.slice(), enemies: en, useRunHp: true, floor: RUN.floor, depth: 5, narrator: 'fun run' });
      S._rotations = true; renderAll();
    }, enemies);
    await t.sleep(500);
    const start = await t.J(() => ({ hp: S.heroes.map(h => h.id + ':' + h.hp), foes: S.enemies.map(e => e.def.name + ' ' + e.hp) }));
    note(`\n▶ ${label} — foes: ${start.foes.join(', ')}`);
    let turn = 0, allOut = false;
    while (turn++ < 8) {
      const over = await t.J(() => !!(typeof S === 'undefined' || !S || S.over));
      if (over) break;
      // play every affordable damaging/self card, best-effort targeting the frontmost foe
      await t.J(async () => {
        for (const h of S.heroes.slice()) {
          if (h.downed) continue;
          let g = 0;
          while (g++ < 6) {
            if (S.executing || S.over) break;
            const card = buildHand().find(c => c.owner === h.id && !c.spent && c.cost <= S.ep && (c.fx && (c.fx.dmg || c.fx.chargeGain || c.fx.guard || c.fx.castDmg || c.fx.spendCharge)));
            if (!card) break;
            let tid = null;
            if (card.target === 'enemy') tid = (livingEnemies()[0] || {}).uid;
            else if (card.target === 'frontmost') tid = (frontmostEnemy() || {}).uid;
            else if (card.target === 'ally') tid = (livingHeroes()[0] || {}).id;
            try { await playCard(card, tid); } catch (_) { break; }
          }
        }
      });
      // fire an all-out if the burst is full (the payoff moment)
      const canAO = await t.J(() => (typeof triggerAllOut === 'function') && S && S.momentum >= 100 && !S.over);
      if (canAO) { await t.J(() => triggerAllOut()); allOut = true; note('  ⚡ ALL-OUT unleashed!'); await t.sleep(600); }
      await t.endTurn();
      await t.dismissCeremony();
    }
    const end = await t.J(() => ({
      over: !!(!S || S.over), win: !!(S && !livingEnemies().length),
      hp: S ? S.heroes.map(h => h.id + ':' + (h.downed ? 'DOWN' : h.hp + '/' + h.maxHp)) : [],
      momentum: S ? S.momentum : 0, threads: S ? S.threads.size : 0, triad: !!(S && S.triadFormed),
      downs: S ? S.heroes.filter(h => h.downed).length : 0,
    }));
    end.turns = turn;
    note(`  ${end.win ? '✓ CLEARED' : '✗ WIPED'} in ${end.turns} turns · party ${end.hp.join(' ')} · threads ${end.threads}${end.triad ? ' · ✦TRIAD' : ''}${allOut ? ' · ⚡all-out' : ''}${end.downs ? ' · ' + end.downs + ' down' : ''}`);
    return end;
  }

  await driveFight('FIGHT 1 · a common pack', ['husk', 'wraith']);
  await t.shot('funrun-fight1');
  // Elite — the tension centrepiece: cascades + the Chain Hook that drags a
  // charged Hask.  Turn OFF auto-perfect-parry so it actually threatens.
  await t.J(() => { window.__autoParry = false; });
  await driveFight('FIGHT 2 · the elite (Chain Hook, no auto-parry)', ['revenant']);
  await t.shot('funrun-elite');

  note('\n=== FEEL NOTES ===');
  const feel = await t.J(() => {
    const codex = (function () { try { return JSON.parse(localStorage.getItem('kizuna2_2.boonCodex') || '[]'); } catch (_) { return []; } })();
    return { boonsSeen: codex.length };
  });
  note(`boons collected in codex: ${feel.boonsSeen}`);
  await t.browser.close();
  process.exit(0);
})();
