// Playtest: Hask SUSTAINED output over 3 turns — the honest view of paths whose
// payoff is delayed (CAST lands next turn) or banked (OVERLOAD holds ◆ CHARGE).
// Each turn walks the real rotation; pending casts unleash at the next turn start.
// A "hold" variant banks the Overload finisher for two turns, then dumps.
'use strict';
const { boot } = require('./harness.cjs');

(async () => {
  const t = await boot({ flow: 0 });

  const res = await t.J(async () => {
    window.__autoParry = false;
    function init(hero, stance, nodes) {
      RUN = newRun(hero); RUN.roster = [hero]; RUN.active = [hero];
      RUN.hp = {}; RUN.hp[hero] = HEROES[hero].maxHp; RUN.nodes = nodes.slice();
      RUN.completed = [0,1,2,3,4,5,6,7,8]; RUN.bonds = {}; RUN._rotations = false;
      startMapFight(RUN.map.find(x => x.type === 'fight'));
      const h = S.heroes[0]; h.row = stance;
      const e = S.enemies[0]; e.hp = e.maxHp = 4000; e.guard = 0;
      S.ep = 999; renderAll();
      return { h, e };
    }
    async function walk(hero, stance, has, holdFinisher) {
      const rot = ROTATIONS[hero][stance];
      let key = rot.opener, steps = 0, dmg0 = S.enemies[0].hp;
      while (key && steps < 6) {
        const card = rot.cards[key]; if (!card) break;
        const isFinisher = card.stance && card.stance.startsWith('FINISHER');
        if (holdFinisher && isFinisher) break;   // bank: don't fire the finisher this turn
        await resolveCard(Object.assign({ owner: hero, kind: steps === 0 ? 'opener' : 'chain' }, card), S.enemies[0].uid);
        steps++;
        const nx = card.next; if (!nx) break;
        let pick = null;
        for (const n of nx) { if (typeof n === 'string') { pick = pick || n; continue; }
          if (n.gate && has(n.gate)) pick = n.key; else if (n.gateNot && !has(n.gateNot) && !pick) pick = n.key; }
        key = pick;
      }
      return dmg0 - S.enemies[0].hp;
    }
    async function run3(hero, stance, nodes, opts) {
      opts = opts || {};
      const { h } = init(hero, stance, nodes);
      const has = id => nodes.includes(id);
      const per = [];
      for (let turn = 0; turn < 3; turn++) {
        // turn start: unleash any pending cast (the real turn-start behavior)
        let castDmg = 0;
        if (h.pendingCast) { const b = S.enemies[0].hp; await unleashCast(h); castDmg = b - S.enemies[0].hp; }
        const hold = opts.bank && turn < 2;   // bank first two turns, dump on the third
        const chain = await walk(hero, stance, has, hold);
        per.push(chain + castDmg);
      }
      // one more unleash if a cast is still pending after turn 3
      let tail = 0; if (h.pendingCast) { const b = S.enemies[0].hp; await unleashCast(h); tail = b - S.enemies[0].hp; }
      return { per, tail, total: per.reduce((a,b)=>a+b,0) + tail, charge: h.charge||0 };
    }
    // Cross-stance bank: build ◆ by dealing RIME damage (front) for 2 turns, then
    // MOVE to mid and dump Overload. Steady Cast lets ◆ survive the stance-move.
    async function crossBank(steady) {
      const nodes = ['hask.sig.front', 'hask.branch.front', 'hask.sig.mid', 'hask.branch.mid',
        'hask.passive.conduit', 'hask.passive.meltdown'].concat(steady ? ['hask.passive.steady'] : []);
      const { h } = init('hask', 'front', nodes);
      const has = id => nodes.includes(id);
      const per = [];
      per.push(await walk('hask', 'front', has, false));   // turn 1: Rime (front), builds ◆
      per.push(await walk('hask', 'front', has, false));   // turn 2: Rime (front), builds ◆
      const chargeBeforeMove = h.charge || 0;
      h.row = 'mid'; onHeroEnterRow(h, 'mid', 'front');     // MOVE to mid — wipes ◆ unless Steady
      const chargeAfterMove = h.charge || 0;
      per.push(await walk('hask', 'mid', has, false));      // turn 3: Overload dump
      return { per, total: per.reduce((a,b)=>a+b,0), chargeBeforeMove, chargeAfterMove };
    }

    return {
      crossNoSteady: await crossBank(false),
      crossSteady:   await crossBank(true),
      rime:     await run3('hask', 'front', ['hask.sig.front', 'hask.branch.front']),
      overloadN:await run3('hask', 'mid',   ['hask.sig.mid', 'hask.branch.mid']),
      overloadB:await run3('hask', 'mid',   ['hask.sig.mid', 'hask.branch.mid', 'hask.passive.conduit', 'hask.passive.meltdown', 'hask.passive.kindling'], { bank: true }),
      cast:     await run3('hask', 'back',  ['hask.sig.back', 'hask.branch.back']),
      castAoe:  await run3('hask', 'back',  ['hask.sig.back', 'hask.branch.back', 'hask.cast.meteor']),
      weave:    await run3('hask', 'front', ['hask.sig.front', 'hask.weave.astral']),
      weaveCap: await run3('hask', 'front', ['hask.sig.front', 'hask.weave.astral', 'hask.weave.enochian']),
    };
  });

  const row = (name, r, note) => {
    const avg = (r.total / 3).toFixed(1);
    console.log(`${name.padEnd(20)} turns [${r.per.map(x=>String(x).padStart(3)).join(', ')}]${r.tail?` +tail ${r.tail}`:''}  total ${String(r.total).padStart(3)}  avg/turn ${String(avg).padStart(5)}   ${note||''}`);
  };
  console.log('\n=== HASK SUSTAINED — 3 turns, per-turn dmg (Technical procs included; solo vs dummy) ===\n');
  row('RIME (front)', res.rime, 'steady chill+technical; front-row risk');
  row('OVERLOAD dump/turn', res.overloadN, 'dumps ◆ every turn (sustained)');
  row('OVERLOAD bank→dump', res.overloadB, 'holds ◆ 2 turns, Conduit+Meltdown, then dumps');
  row('CAST (back)', res.cast, 'Starfall ◈16 lands next turn; safe back row');
  row('CAST +Cataclysm', res.castAoe, 'same, but AoE on every foe');
  row('WEAVE Emberwake', res.weave, 'open Frost → ignite fire each turn');
  row('WEAVE +Backdraft', res.weaveCap, 'crossings snap to ±3 + detonate; deep invest + front risk');
  console.log('\n--- CROSS-STANCE BANK: 2 turns Rime (front, builds ◆) → move to mid → Overload dump ---');
  console.log(`no Steady Cast:  turns [${res.crossNoSteady.per.map(x=>String(x).padStart(3)).join(', ')}]  total ${res.crossNoSteady.total}   ◆ before move ${res.crossNoSteady.chargeBeforeMove} → after ${res.crossNoSteady.chargeAfterMove} (WIPED by move)`);
  console.log(`with Steady Cast:turns [${res.crossSteady.per.map(x=>String(x).padStart(3)).join(', ')}]  total ${res.crossSteady.total}   ◆ before move ${res.crossSteady.chargeBeforeMove} → after ${res.crossSteady.chargeAfterMove} (KEPT — big dump)`);
  console.log('\nContext: Branwen (archer) ~35/turn signature; Hask has 22 HP. Front-stance paths');
  console.log('(RIME/WEAVE) stand Hask in the danger row — that exposure is the price of the ceiling.');
  await t.browser.close();
  process.exit(0);
})();
