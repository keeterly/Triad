// RUNMETER — a whole floor, played, N times.
//
// Walks the real road (Landing -> survivor -> relic -> descent) and plays each
// node, reporting where runs actually end and what the HP curve looks like on
// the way. Uses the harness TIME SCALE, so a floor is ~2 minutes.
//
//   SEEDS=4 SKILL=0.7 RELIC=compass node test/runmeter.cjs
//
'use strict';
const { boot } = require('./harness.cjs');
const SEEDS = +(process.env.SEEDS || 4);
const SKILL = +(process.env.SKILL || 0.7);
const RELIC = process.env.RELIC || null;
const PARTY = (process.env.PARTY || 'ash').split(',');
(async () => {
  const t = await boot({ p: 0 });
  const errs = []; t.page.on('pageerror', e => errs.push(e.message));
  await t.page.emulateMedia({ reducedMotion: 'reduce' });
  await t.autoParry(true); await t.fastCombat(0.08);
  // A CEREMONY BLOCKS THE FIGHT. triadCeremony() awaits a tap, and __room plays a
  // whole fight inside ONE page evaluate — so clear(), which only runs BETWEEN
  // nodes, can never reach one that fires mid-turn. Under the line (293) a shared
  // combo lands allies' actions together, so bonds and triads fire constantly and
  // this rig deadlocks on the first trio it forms. Auto-tap from inside the page.
  await t.J(() => setInterval(() => {
    const ov = document.querySelector('#overlay');
    if (ov && !ov.classList.contains('hidden') && ov.querySelector('.ov-tap')) ov.click();
  }, 50));
  await t.J(() => { try { localStorage.clear(); localStorage.setItem('kizuna2_1.tutorialSeen','1');
    localStorage.setItem('kizuna2_1.starters', JSON.stringify(['ash','elin','mira','cassia'])); } catch(_){}
    META.deaths = 2;
    window.__notes = 0;
    new MutationObserver((m) => { for (const x of m) for (const n of x.addedNodes)
      if (n.nodeType === 1 && n.classList && n.classList.contains('parry-ring')) window.__notes++;
    }).observe(document.documentElement, { childList: true, subtree: true });
    window.__fight = async () => {
      const nap = (ms) => new Promise(r => setTimeout(r, ms));
      let turns = 0, cards = 0, acts = 0; const n0 = window.__notes;
      while (turns < 22 && S && !S.over) {
        for (let g = 0; g < 10; g++) {
          const h = buildHand().filter(x => !x.spent && x.cost <= S.ep);
          const c = h.find(x => x.fx && x.fx.followUp) || h.find(x => x.chain)
                 || h.find(x => x.fx && (x.fx.dmg || x.fx.heal || x.fx.guard));
          if (!c) break;
          const live = livingEnemies(); if (!live.length) break;
          const tid = (c.target === 'ally' || c.target === 'allies') ? (lowestHpAlly()||{}).id : (frontmostEnemy()||live[0]).uid;
          try { await playCard(c, tid); cards++; } catch (e) { break; }
        }
        if (S && burstReady()) { try { await resolveAllOut(); } catch (_) {} }
        if (!S || S.over) break;
        acts += livingEnemies().length; turns++;
        try { await endTurn(); } catch (_) {}
        for (let i = 0; i < 500 && S && !S.over && (S.executing || S.enemyPhase); i++) await nap(15);
      }
      // let the victory handler run — it is what marks the node completed
      for (let i = 0; i < 120 && S && !S.over && !livingEnemies().length; i++) await nap(25);
      return { turns, cards, acts, notes: window.__notes - n0,
        wound: S ? Math.round(S.heroes.reduce((a,h)=>a+(h.wound||0),0)/S.heroes.reduce((a,h)=>a+h.maxHp,0)*100) : 0,
        // `ran` distinguishes a LOSS from a fight that never started. Without it
        // a click the walker fluffed was recorded as a wipe, and twice that has
        // been reported as a balance finding it was not.
        ran: !!S, win: !!(S && !livingEnemies().length), downs: S ? S.heroes.filter(h => h.downed).length : 0,
        hp: S ? Math.round(S.heroes.reduce((a,h)=>a+Math.max(0,h.hp),0)/S.heroes.reduce((a,h)=>a+h.maxHp,0)*100) : 0 };
    };
  });
  const clear = async () => {
    for (let i = 0; i < 34; i++) {
      if (await t.J(() => !!document.querySelector('.jc-next'))) { await t.J(() => document.querySelector('.jc-scene').click()); await t.sleep(80); continue; }
      if (await t.J(() => !!document.querySelector('.ov-tap'))) { await t.J(() => document.querySelector('#overlay').click()); await t.sleep(70); continue; }
      const hit = await t.J(() => { const b = document.querySelector('#ov-go, #ov-next, #ps-go, #rc-next, #cx-back, .rl-card.rl-none, #overlay .ov-btn.primary, .ov-forkopt, .ev-choice, .jc-opt, .camp-choice, .tc-choice');
        if (!b) return null; b.click(); return 1; });
      if (!hit) return; await t.sleep(180);
    }
  };
  console.log(`\n${SEEDS} floors · ${PARTY.join('+')} · parry skill ${SKILL}${RELIC ? ' · carrying ' + RELIC : ''}`);
  const ends = [];
  for (let sd = 0; sd < SEEDS; sd++) {
    await t.parrySkill(SKILL, 1000 + sd * 7919);
    await t.J((a) => { try { hideOverlay(); } catch(_){} S = null;
      RUN = newRun(a.party[0]); if (a.relic) RUN.relic = a.relic;
      RUN.roster = a.party.slice(); RUN.active = a.party.slice();
      RUN.hp = {}; a.party.forEach(id => RUN.hp[id] = HEROES[id].maxHp);
      RUN.wounds = {};
      RUN.floor = 1; RUN.completed = []; RUN.map = generateDescent(RUN.roster, 1);
      saveRun(); showMap(); }, { relic: RELIC, party: PARTY });
    const curve = []; let guard = 0, last = null, stuck = 0, died = null, camps = 0, skipped = 0;
    while (guard++ < 24) {
      await clear();
      const next = await t.J(() => { if (!RUN) return null;
        if (!document.querySelector('.map-strip')) showMap();
        const b = [...document.querySelectorAll('.map-node')].find(x => x.classList.contains('mn-reach') && !x.disabled);
        if (!b) return null; const n = mapNode(+b.dataset.node); b.click();
        return { type: n.type, level: n.level }; });
      if (!next) break;
      const sig = next.level + next.type; if (sig === last) { if (++stuck >= 2) break; } else { stuck = 0; last = sig; }
      await t.sleep(300);
      if (next.type === 'camp') camps++;
      if (['fight','elite','boss'].includes(next.type)) {
        const f = await t.J(() => window.__fight());
        if (!f.ran) { skipped++; continue; }          // the walker fluffed it — not a death
        curve.push(f.hp + (f.wound ? '/' + f.wound + 'w' : ''));
        if (!f.win) { died = 'L' + next.level + ' ' + next.type; break; }
      } else { await clear(); }
    }
    ends.push({ died, curve, camps, reached: curve.length, skipped });
    console.log(`  seed ${sd}: ${died ? 'DIED at ' + died : 'survived the floor'} · ${curve.length} fights · HP ${curve.join('→')}%`
      + ` · camps ${camps}${skipped ? ' · ' + skipped + ' node(s) the walker fluffed' : ''}`);
  }
  const dead = ends.filter(e => e.died).length;
  console.log(`\n  ── ${dead}/${SEEDS} floors ended in a wipe · median fights survived ${ends.map(e=>e.reached).sort((a,b)=>a-b)[Math.floor(SEEDS/2)]}`
    + ` · camps reached in total ${ends.reduce((a,e)=>a+e.camps,0)}`);
  console.log('ERRORS:', errs.length ? errs.slice(0,4) : 'none');
  await t.browser.close(); process.exit(0);
})();
