// DOES CHOOSING BEAT SPAMMING?
// The developer's instinct: "the player can just spam random cards from their
// hand and it doesn't make a major difference." That is a testable claim. Three
// pilots play the SAME fights; if the random one keeps up with the considered
// one, card choice is not a decision and the whole hand is theatre.
'use strict';
const { boot } = require('./harness.cjs');

(async () => {
  const t = await boot({ flow: 0 });

  const PILOTS = {
    // 1. SPAM — any affordable card, any legal target, no thought at all.
    random: () => `
      const hand = buildHand().filter(c => !c.spent && c.cost <= S.ep);
      if (!hand.length) return false;
      const c = hand[Math.floor(Math.random() * hand.length)];
      const foes = livingEnemies();
      let tid = null;
      if (c.target === 'enemy') tid = foes[Math.floor(Math.random() * foes.length)].uid;
      else if (c.target === 'frontmost') tid = (frontmostEnemy() || {}).uid;
      else if (c.target === 'ally') { const a = livingHeroes(); tid = a[Math.floor(Math.random() * a.length)].id; }
      await playCard(c, tid); return true;`,
    // 2. GREEDY — always the biggest damage number available.
    greedy: () => `
      const hand = buildHand().filter(c => !c.spent && c.cost <= S.ep);
      const dmg = (c) => (c.fx && (c.fx.dmg || c.fx.castDmg || c.fx.aoeDmg)) || 0;
      const c = hand.slice().sort((a, b) => dmg(b) - dmg(a))[0];
      if (!c) return false;
      let tid = null;
      if (c.target === 'enemy' || c.target === 'frontmost') tid = (frontmostEnemy() || livingEnemies()[0] || {}).uid;
      else if (c.target === 'ally') tid = (livingHeroes()[0] || {}).id;
      await playCard(c, tid); return true;`,
    // 3. CONSIDERED — everything the game rewards: hit the school weakness,
    //    finish rotations, focus the lowest-HP foe, guard when hurt.
    smart: () => `
      const hand = buildHand().filter(c => !c.spent && c.cost <= S.ep);
      if (!hand.length) return false;
      const foes = livingEnemies();
      const hurt = S.heroes.filter(h => !h.downed && h.hp * 2 <= h.maxHp).length;
      const target = foes.slice().sort((a, b) => a.hp - b.hp)[0] || foes[0];
      const score = (c) => {
        const f = c.fx || {}; let s = 0;
        s += (f.dmg || 0) + (f.castDmg || 0) + (f.aoeDmg || 0) * foes.length;
        const owner = S.heroes.find(h => h.id === c.owner);
        if (owner && target && owner.def.school === target.def.weak) s += 8;   // weakness → poise
        if (c.chain && !c.chainNext) s += 6;                                   // finisher → poise
        if (hurt && (f.guard || f.heal)) s += 7 * hurt;                        // stabilise
        if (f.mark) s += 3;
        return s - c.cost * 1.5;
      };
      const c = hand.slice().sort((a, b) => score(b) - score(a))[0];
      let tid = null;
      if (c.target === 'enemy') tid = target.uid;
      else if (c.target === 'frontmost') tid = (frontmostEnemy() || {}).uid;
      else if (c.target === 'ally') tid = (S.heroes.filter(h => !h.downed).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0] || {}).id;
      await playCard(c, tid); return true;`,
  };

  async function run(pilot, enemies, elite, trials) {
    const body = PILOTS[pilot]();
    let wins = 0, turns = 0, hpLeft = 0, breaks = 0, done = 0;
    for (let i = 0; i < trials; i++) {
      await t.J((a) => {
        window.__autoParry = true; window.__fastFx = true;
        RUN = newRun('ash');
        RUN.roster = ['ash', 'hask', 'cassia']; RUN.active = ['ash', 'hask', 'cassia'];
        RUN.hp = { ash: 34, hask: 26, cassia: 36 };
        RUN.nodes = ['ash.sig.front', 'hask.sig.front', 'cassia.sig.front'];
        RUN.crossed = {}; RUN.bonds = { 'ash|hask': 2 };
        RUN.floor = 1; RUN.completed = [0, 1, 2];
        RUN.map = generateDescent(RUN.roster, 1);
        startFight({ type: 'fight', chapter: 3, heroes: RUN.active.slice(), enemies: a.en,
          useRunHp: true, floor: 1, depth: 4, elite: a.el, narrator: 'spam' });
        S._rotations = true; S._breaks = 0; renderAll();
      }, { en: enemies, el: !!elite });
      await t.sleep(220);
      let turn = 0;
      while (turn++ < 14) {
        if (await t.J(() => !!(typeof S === 'undefined' || !S || S.over))) break;
        await t.J(new Function('return (async () => { let g = 0; while (g++ < 10) { if (S.executing || S.over) break; const ok = await (async () => {' + body + '\n})(); if (!ok) break; } })()'));
        await t.J(() => { if (S && !S.over) endTurn(); });
        for (let k = 0; k < 400; k++) {
          if (await t.J(() => !!(typeof S === 'undefined' || !S || S.over || (!S.executing && !S.enemyPhase)))) break;
          await t.sleep(30);
        }
      }
      const r = await t.J(() => ({
        win: !!(S && !livingEnemies().length),
        hp: S ? S.heroes.reduce((s, h) => s + Math.max(0, h.hp), 0) : 0,
        maxHp: S ? S.heroes.reduce((s, h) => s + h.maxHp, 0) : 1,
        breaks: (S && S._breaks) || 0,
      }));
      if (r.win) wins++;
      turns += turn; hpLeft += r.hp / r.maxHp; breaks += r.breaks; done++;
    }
    return { pilot, wins, trials: done, turns: (turns / done).toFixed(1),
             hp: Math.round(hpLeft / done * 100), breaks: (breaks / done).toFixed(1) };
  }

  const FIGHTS = [
    { label: 'common pack', en: ['husk', 'wraith'], elite: false, trials: 4 },
    
    { label: 'ELITE', en: ['revenant', 'cultist'], elite: true, trials: 4 },
  ];
  for (const f of FIGHTS) {
    console.log(`\n▶ ${f.label}  (${f.trials} trials each)`);
    console.log('   pilot   won   turns   party HP left   breaks');
    for (const p of ['random', 'greedy', 'smart']) {
      const r = await run(p, f.en, f.elite, f.trials);
      console.log(`   ${r.pilot.padEnd(7)} ${String(r.wins + '/' + r.trials).padEnd(6)}${String(r.turns).padEnd(8)}${String(r.hp + '%').padEnd(16)}${r.breaks}`);
    }
  }
  await t.browser.close();
  process.exit(0);
})();
