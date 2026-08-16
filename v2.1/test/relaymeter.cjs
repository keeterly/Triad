// RELAYMETER — decision density, measured, with the relay A/B'd against the
// private chains it replaces.
//
// The relay (Build 292) exists to raise ONE number: how many real choices a turn
// contains. The old system gave each hero their own chain, so a turn was three
// independent picks at one target and `plays` — the count of legal cards at a
// decision point — sat flat at 3. The relay passes the line BETWEEN heroes, so
// what a hero holds depends on who opened and who answered.
//
//   node test/relaymeter.cjs
//
// Reports, per party size, with the relay OFF (today) and ON (the change):
//   plays      mean legal plays at every decision point in the fight
//   mid        mean legal plays at decisions AFTER the turn's first card —
//              this is the number the plan named, and the one to beat
//   cards/turn how much the party actually gets to do
//   dmg/turn   throughput, because the relay reaching finishers every turn
//              moves difficulty whether or not it moves decisions
//   P:E        player cards per enemy action
//
// Runs the whole fight inside the page — thousands of CDP polls per fight were
// the cost of the earlier rigs, not the game.
'use strict';
const { boot } = require('./harness.cjs');
const REPS = +(process.env.REPS || 3);
// WHICH BUILD IS BEING MEASURED. 'cards' grants the tree's CARD nodes (the
// builder that inserts a middle step) and nothing else — the fork nodes are
// type:'branch' and stay unowned, so every rotation is a single line. 'full'
// grants all 37 ROTATION_GATES, the dev-preview build, where every opener forks.
// This matters more to the relay than to the chains it replaces: forks are
// exactly where a handed step becomes a CHOICE rather than a card, so measuring
// only the un-forked build would understate the relay by construction.
const TREE = process.env.TREE || 'full';
// A FIXED ENEMY PACK. generateDescent() rolls a different pack per fight, and
// measured across two runs of the SAME configuration that swing was larger than
// the relay-vs-baseline gap it was supposed to reveal — cards/turn moved 5.6 to
// 9.5 and P:E 4.7:1 to 11.9:1 with nothing changed but the seed. Pin the pack so
// the A/B compares the card engine and not the encounter.
const PACK = (process.env.PACK || 'husk,wraith,cultist').split(',');

(async () => {
  const t = await boot({ r: 0 });
  await t.page.emulateMedia({ reducedMotion: 'reduce' });
  await t.autoParry(true); await t.fastCombat(0.06); await t.parrySkill(1, 99);
  await t.J(() => {
    // A CEREMONY BLOCKS THE FIGHT. triadCeremony() awaits a tap on the overlay,
    // and this rig runs a whole fight inside ONE page evaluate — so nothing on
    // the Node side can tap it and the run deadlocks. The relay makes this the
    // common case rather than a rarity: it lands every hero's action every turn,
    // so "they struck as one" fires constantly and trios form fast. Auto-tap the
    // ceremony overlays from inside the page, which is what a player does.
    window.__triads = 0;
    setInterval(() => {
      const ov = document.querySelector('#overlay');
      if (ov && !ov.classList.contains('hidden') && ov.querySelector('.ov-tap')) { window.__triads++; ov.click(); }
    }, 50);
    window.__room = async (party, relay, tree, pack) => {
      RUN = newRun(party[0]); RUN.roster = party.slice(); RUN.active = party.slice();
      RUN.hp = {}; party.forEach(id => RUN.hp[id] = HEROES[id].maxHp);
      RUN.nodes = tree === 'full' ? ROTATION_GATES.slice()
                                  : EMBER_TREE.filter(n => n.type === 'card').map(n => n.id);
      RUN._rotations = true;
      RUN._relay = relay;               // the A/B: false runs the old private chains
      startFight({ type:'fight', chapter:3, heroes:party.slice(), enemies:pack.slice(),
        useRunHp:true, floor:1, depth:3, narrator:'r' });
      if (!S) return null;
      renderAll();
      const nap = (ms) => new Promise(r => setTimeout(r, ms));
      const foeHp0 = S.enemies.reduce((a, e) => a + e.maxHp, 0);
      const triads0 = window.__triads;
      let turns = 0, cards = 0, acts = 0, plays = [], mid = [];
      while (turns < 20 && S && !S.over) {
        // COUNT THE TURN AS IT STARTS, not after endTurn(). A fight that ends
        // inside the card loop breaks out before the old increment ran, so a
        // 2-turn win was divided by 1 — which flattered exactly the rows that
        // win fastest. Every read of cards/turn and dmg/turn below depends on it.
        turns++;
        for (let g = 0; g < 12; g++) {
          const legal = buildHand().filter(x => !x.spent && x.cost <= S.ep && x.kind !== 'move');
          // A DECISION POINT is a moment with something to play. Counting the
          // empty tail as "0 plays" would just measure how fast EP runs out.
          if (!legal.length) break;
          plays.push(legal.length);
          if (g > 0) mid.push(legal.length);       // mid-rotation: after the turn's first card
          const c = legal.find(x => x.fx && x.fx.followUp) || legal.find(x => x.chain)
                 || legal.find(x => x.fx && (x.fx.dmg || x.fx.heal || x.fx.guard));
          if (!c) break;
          const live = livingEnemies(); if (!live.length) break;
          const tid = (c.target === 'ally' || c.target === 'allies') ? (lowestHpAlly()||{}).id : (frontmostEnemy()||live[0]).uid;
          try { await playCard(c, tid); cards++; } catch (e) { break; }
        }
        if (S && burstReady()) { try { await resolveAllOut(); } catch (_) {} }
        if (!S || S.over) break;
        acts += livingEnemies().length;
        try { await endTurn(); } catch (_) {}
        for (let i = 0; i < 400 && S && !S.over && (S.executing || S.enemyPhase); i++) await nap(20);
      }
      const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
      const foeHp = S ? S.enemies.reduce((a, e) => a + Math.max(0, e.hp), 0) : foeHp0;
      return { turns, cards, acts, plays: mean(plays), mid: mean(mid), triads: window.__triads - triads0,
        dmg: (foeHp0 - foeHp) / Math.max(1, turns),
        hp: S ? Math.round(S.heroes.reduce((a,h)=>a+Math.max(0,h.hp),0)/S.heroes.reduce((a,h)=>a+h.maxHp,0)*100) : 0 };
    };
  });

  const PARTIES = [['ash','elin'], ['ash','elin','mira'], ['cassia','branwen','hask']];
  console.log('\ntree: ' + TREE + '   pack: ' + PACK.join('+') + '   reps: ' + REPS);
  console.log('party                      relay   plays    MID   cards/turn   dmg/turn    P:E    HP  ceremonies');
  for (const p of PARTIES) {
    for (const relay of [false, true]) {
      const rs = [];
      for (let i = 0; i < REPS; i++) {
        const r = await t.J((a) => window.__room(a.p, a.relay, a.tree, a.pack), { p, relay, tree: TREE, pack: PACK });
        if (r) rs.push(r);
      }
      if (!rs.length) { console.log(`${p.join('+').padEnd(26)}${(relay?'ON':'off').padStart(5)}   — no fight —`); continue; }
      const m = k => rs.reduce((a, r) => a + r[k], 0) / rs.length;
      const ratio = m('acts') ? (m('cards') / m('acts')).toFixed(1) : '--';
      console.log(`${p.join('+').padEnd(26)}${(relay ? 'ON' : 'off').padStart(5)}`
        + `  ${m('plays').toFixed(2).padStart(6)} ${m('mid').toFixed(2).padStart(6)}`
        + `  ${(m('cards') / Math.max(1, m('turns'))).toFixed(1).padStart(10)}`
        + `  ${m('dmg').toFixed(1).padStart(9)}  ${String(ratio + ':1').padStart(5)}  ${m('hp').toFixed(0).padStart(3)}%`
        + `  ${m('triads').toFixed(1).padStart(10)}`);
    }
  }
  await t.browser.close(); process.exit(0);
})();
