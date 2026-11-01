'use strict';
// WHERE DOES SKILL LIVE IN THIS GAME?
//
// A deckbuilder with a rhythm layer has two hands' worth of skill in it: how
// well you play the cards, and how well you parry. Every balance number this
// repo has ever produced was measured with ONE card policy — a one-step greedy
// rule — and varied only the parry. So nobody has ever measured how much the
// card layer is worth.
//
// This does: the same seeds, the same parry skill, the same grade sequence
// (the bot's parry RNG is separate from the card RNG), and two ways of playing
// the hand. If greedy and random win at similar rates, the cards are
// decoration and the parry is the whole game.
const { boot } = require('./harness.cjs');
const { BOT } = require('./bot.cjs');
const RUNS = Number(process.env.SKILL_RUNS || 60);
const P = (process.env.SKILL_P || '0.5,0.92').split(',').map(Number);
const FOES = (process.env.SKILL_FOES || 'mourner,wraith').split(',');
(async () => {
  const H = await boot();
  const { J, page } = H;
  await J(() => { window.__SIM = true; });
  console.log(`\n  SKILL PROBE · ${RUNS} fights per cell\n`);
  console.log('  foe        parry   policy   win%   turns(win)   hp left (win)');
  for (const foe of FOES) for (const p of P) {
    const row = {};
    for (const policy of ['greedy', 'random']) {
      const res = [];
      for (let i = 0; i < RUNS; i++) {
        res.push(await page.evaluate(([src, seed, pp, opts]) => eval(src)(seed, pp, 30, opts),
          [BOT, 3000 + i * 11, p, { foe, policy }]));
      }
      const w = res.filter(r => r.win);
      const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };
      const hpl = w.map(r => r.hp.ash + r.hp.elin + r.hp.mira);
      row[policy] = { win: w.length / res.length * 100, turns: med(w.map(r => r.turns)), hp: med(hpl) };
      console.log('  ' + foe.padEnd(10) + ' ' + String(p).padEnd(6) + '  ' + policy.padEnd(7)
        + '  ' + row[policy].win.toFixed(1).padStart(5) + '   ' + String(row[policy].turns).padStart(5)
        + '        ' + String(row[policy].hp).padStart(5));
    }
    console.log('  ' + ' '.repeat(18) + 'card skill is worth '
      + (row.greedy.win - row.random.win).toFixed(1) + ' points of win rate, '
      + (row.random.turns - row.greedy.turns) + ' turns, '
      + (row.greedy.hp - row.random.hp) + ' hp\n');
  }
  await H.browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
