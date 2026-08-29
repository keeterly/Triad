// KIZUNA v2.3 — THE REGENT PROBE. Where does a losing party's health go?
//
// pace.sim found that a clumsy run does NOT die on the road: it walks the whole
// six stops at 88 of 112 health and then loses to the Regent, twelve wipes out
// of seventeen. So the question is not "is the road too long" — it is what she
// does that a learning player cannot answer.
//
// Two halves of her damage, and only one of them can be parried. The dirge
// settles on the WHOLE party every turn and no timing answers it: only Guard
// and healing do. It is therefore a tax on TIME — and a player who reads fewer
// notes kills more slowly, so the half they cannot answer is the half that
// scales with how much they are struggling.
//
// A measurement, not a gate.
'use strict';
const { boot } = require('./harness.cjs');
const { BOT } = require('./bot.cjs');

const REPS = +(process.env.PROBE_REPS || 24);
const SKILLS = [['clumsy', 0.45], ['ordinary', 0.7], ['sharp', 0.92]];
const FOE = process.env.PROBE_FOE || 'mourner';
// null = full health; otherwise a fraction of each hero's max
const WEAR = process.env.PROBE_HP ? +process.env.PROBE_HP : null;
const PARTY_HP = WEAR
  ? { ash: Math.round(42 * WEAR), elin: Math.round(36 * WEAR), mira: Math.round(34 * WEAR) }
  : null;

(async () => {
  const H = await boot();
  const { J, page } = H;
  const tune = {};
  if (process.env.PROBE_GOOD) tune.good = +process.env.PROBE_GOOD;
  if (process.env.PROBE_DIRGE) tune.dirge = +process.env.PROBE_DIRGE;
  if (process.env.PROBE_MUL) tune.mul = +process.env.PROBE_MUL;
  if (tune.good) await J((g) => window.K._setParryWeights({ good: g }), tune.good);
  if (tune.dirge != null) await J((a2) => { window.K.FOES[a2.foe].dirge = a2.d; },
    { foe: FOE, d: tune.dirge });
  if (process.env.PROBE_MUL) await J((a2) => { window.K.FOES[a2.foe].dmgMul = a2.m; },
    { foe: FOE, m: +process.env.PROBE_MUL });

  console.log(`\n══ ${FOE.toUpperCase()} · ${REPS} fights per skill`
    + (Object.keys(tune).length ? ' · tuned ' + JSON.stringify(tune) : '') + ' ══\n');
  console.log('  skill        won   turns   dmg taken   …by blows   …by the DIRGE   dirge share   all-outs');

  for (const [name, p] of SKILLS) {
    let won = 0, turns = 0, hit = 0, dirge = 0, ao = 0;
    for (let i = 0; i < REPS; i++) {
      // …at the health players ACTUALLY arrive with. pace.sim measured a party
      // walking into a fight at 88 of 112, so testing her at full health tests
      // a fight nobody has.
      const r = await page.evaluate(([src, sd, ps, foe, hp]) =>
        eval(src)(sd, ps, 40, { foe, partyHp: hp }), [BOT, 500 + i * 97, p, FOE, PARTY_HP]);
      const d = await J(() => window.K.state().deeds);
      if (r && r.win) won++;
      turns += (r && r.turns) || 0;
      ao += (r && r.allouts) || 0;
      hit += (d && d.tookHit) || 0;
      dirge += (d && d.tookDirge) || 0;
    }
    const tot = hit + dirge;
    console.log('  ' + name.padEnd(11)
      + String(won).padStart(4) + '/' + REPS
      + String(+(turns / REPS).toFixed(1)).padStart(8)
      + String(Math.round(tot / REPS)).padStart(12)
      + String(Math.round(hit / REPS)).padStart(12)
      + String(Math.round(dirge / REPS)).padStart(16)
      + String(Math.round(tot ? dirge / tot * 100 : 0) + '%').padStart(14)
      + String(+(ao / REPS).toFixed(2)).padStart(11));
  }
  console.log('\n  The party carries '
    + (PARTY_HP ? Object.values(PARTY_HP).reduce((n, x) => n + x, 0) + ' of 112' : '112')
    + ' health into her.');
  await H.browser.close();
  process.exit(0);
})();
