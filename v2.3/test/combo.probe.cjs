// KIZUNA v2.3 — COMBO PROBE. v2.3 exists to make DECK AND CARD PLAY the fun
// part, so this measures the thing that claim rests on: how much of a turn is
// actually a decision, and how much of the combo layer ever fires.
//
// It is not a winrate rig — balance.sim.cjs owns that. It reports the shape of
// a turn: how wide the choice was, how often a conditional card was played hot
// versus cold, whether FOLLOW-UP is a decision or a default, how often FINALE
// lands, how much AP is left on the table, and which cards never get played.
'use strict';
const { boot } = require('./harness.cjs');

const DRIVER = `
(async (fights, seed0) => {
  const K = window.K, S = () => K.state();
  const T = {
    turns: 0, fights: 0, plays: 0, apLeft: 0, apTotal: 0,
    condHot: 0, condCold: 0,                 // conditional cards played armed / not
    followChance: 0, followTaken: 0,         // plays where FOLLOW-UP was available
    finaleTurns: 0, threeHeroTurns: 0,
    optionsSum: 0, contendersSum: 0, forced: 0, dead: 0,
    playsPerTurn: {}, byCard: {}, byCond: {},
  };
  const dmgOf = (id) => { const ev = K.evaluateCard(id); if (!ev) return 0;
    return ev.resolvedEffects.reduce((n, f) => n + (f.dmg || 0), 0); };
  // Defence is only worth what it actually saves. Scoring "heal 6" as a flat 6
  // when nobody is hurt reports the deck's defensive cards as dead when the rig
  // simply never needed them — that measures the bot, not the deck.
  const value = (id) => {
    const ev = K.evaluateCard(id); if (!ev) return 0;
    const st = S();
    const alive = ['ash', 'elin', 'mira'].filter(h => !st.heroes[h].downed);
    const missing = (h) => st.heroes[h].max - st.heroes[h].hp;
    const worst = alive.reduce((n, h) => Math.max(n, missing(h)), 0);
    const incoming = K.intentPreviewDmg ? K.intentPreviewDmg() : 12;
    const share = Math.max(2, incoming / Math.max(1, alive.length));
    let v = 0;
    for (const fx of ev.resolvedEffects) {
      if (fx.dmg) v += fx.dmg;
      if (fx.brk) v += fx.brk * 3;
      if (fx.bleed) v += fx.bleed * 2;
      if (fx.chill) v += Math.min(fx.chill, incoming) * 0.9;
      if (fx.guardSelf) v += Math.min(fx.guardSelf, share);
      if (fx.guardAll) v += alive.length * Math.min(fx.guardAll, share) * 0.7;
      if (fx.guardAlly) v += Math.min(fx.guardAlly, share);
      if (fx.guardLowest) v += Math.min(fx.guardLowest, share);
      if (fx.intercede) v += share * 0.8;          // the window moves to Elin
      if (fx.counterstance) v += 2.5;              // +2 Break on the next turned string
      if (fx.drawDiscard) v += 1.5;
      if (fx.draw) v += fx.draw * 3;
      if (fx.heal) v += Math.min(fx.heal, worst) * 1.2;
      if (fx.healAll) v += alive.reduce((n, h) => n + Math.min(fx.healAll, missing(h)), 0);
    }
    return v / Math.max(1, ev.currentCost);
  };
  const playable = () => {
    const st = S(); const out = [];
    for (const id of st.hand) {
      const ev = K.evaluateCard(id); if (!ev) continue;
      if (st.ap < ev.currentCost) continue;
      const o = ev.card.owner === 'bond' ? 'ash' : ev.card.owner;
      const dead = ev.card.owner === 'bond'
        ? (st.heroes.ash.downed || st.heroes.elin.downed) : st.heroes[o].downed;
      if (dead) continue;
      out.push(id);
    }
    return out;
  };

  for (let f = 0; f < fights; f++) {
    K.startCombat({ seed: seed0 + f });
    T.fights++;
    for (let turn = 0; turn < 40; turn++) {
      const st0 = S();
      if (st0.phase === 'VICTORY' || st0.phase === 'DEFEAT') break;
      T.turns++;
      T.apTotal += st0.ap;
      // the move is a combo piece: Backstab pays for the row she leaves. With
      // three rows the destination has to be named — the old bare toggle only
      // stepped her one row back, so she never reached BACK from the front and
      // the rig reported the condition as dead when it was merely unvisited.
      if (st0.hand.includes('backstab') && st0.heroes.mira.row !== 'back'
          && !st0.turnState.moved && st0.ap >= 2 && !st0.heroes.mira.downed)
        K.moveHero('mira', 'back');

      // ── the decision space, measured BEFORE anything is played ──
      const opts = playable();
      T.optionsSum += opts.length;
      if (!opts.length) T.dead++;
      if (opts.length === 1) T.forced++;
      if (opts.length > 1) {
        const vals = opts.map(value).sort((a, b) => b - a);
        // how many plays are within 25% of the best — a turn with one clear
        // answer is solved, not played
        T.contendersSum += vals.filter(v => v >= vals[0] * 0.75).length;
      } else T.contendersSum += opts.length;

      let played = 0;
      for (let step = 0; step < 8; step++) {
        const cur = S();
        if (cur.phase === 'VICTORY' || cur.phase === 'DEFEAT') break;
        const legal = playable();
        if (!legal.length) break;
        const last = cur.turnState.actionsPlayed[cur.turnState.actionsPlayed.length - 1];
        // was a FOLLOW-UP even on offer this step?
        const couldFollow = legal.some(id => {
          const c = K.evaluateCard(id).card;
          return c.cond && c.cond.type === 'FOLLOW_UP' && last && c.owner !== last.ownerId;
        });
        if (couldFollow) T.followChance++;

        // ONE STEP OF PLANNING. A purely greedy hand dumps its finisher first
        // and then reports that finales never happen — which measures the bot,
        // not the game. Before taking a conditional card cold, check whether
        // some other affordable card would ARM it, and lead with that instead.
        let best = null, bestV = -1;
        for (const id of legal) {
          const e = K.evaluateCard(id);
          let v = value(id);
          if (last && e.card.owner !== last.ownerId) v += 1.0;
          // holding a cold conditional is worth what it would pay once armed
          if (e.card.cond && !e.condActive && cur.ap > e.currentCost) {
            const armable = legal.some(o => {
              if (o === id) return false;
              const oe = K.evaluateCard(o);
              if (cur.ap < oe.currentCost + e.currentCost) return false;
              const t = e.card.cond.type;
              if (t === 'FOLLOW_UP') return oe.card.owner !== e.card.owner;
              if (t === 'FINALE') {
                const seen = new Set(cur.turnState.actionsPlayed.map(a => a.ownerId));
                seen.add(e.card.owner); seen.add(oe.card.owner);
                return ['ash', 'elin', 'mira'].every(x => seen.has(x));
              }
              return false;
            });
            if (armable) v -= 4;                    // wait for it
          }
          if (v > bestV) { bestV = v; best = id; }
        }
        const ev = K.evaluateCard(best);
        const c = ev.card;
        if (c.cond) {
          if (ev.condActive) T.condHot++; else T.condCold++;
          const k = c.cond.type;
          T.byCond[k] = T.byCond[k] || { hot: 0, cold: 0 };
          if (ev.condActive) T.byCond[k].hot++; else T.byCond[k].cold++;
          if (k === 'FOLLOW_UP' && ev.condActive) T.followTaken++;
        }
        if (!K.playCard(best)) break;
        T.byCard[best] = (T.byCard[best] || 0) + 1;
        T.plays++; played++;
        if (S().pendingDiscard) {
          const h = S().hand;
          let worst = h[0], wv = 1e9;
          for (const id of h) { const d = dmgOf(id); if (d < wv) { wv = d; worst = id; } }
          K.pickDiscard(worst);
        }
      }
      const ts = S().turnState;
      const heroes = new Set(ts.actionsPlayed.map(a => a.ownerId));
      if (['ash', 'elin', 'mira'].every(h => heroes.has(h))) T.threeHeroTurns++;
      if (ts.actionsPlayed.some(a => a.condActive
          && K.evaluateCard(a.cardId) && CARD_FIN.has(a.cardId))) T.finaleTurns++;
      T.playsPerTurn[played] = (T.playsPerTurn[played] || 0) + 1;
      T.apLeft += S().ap;

      if (!S().turnState.cycled && S().hand.length > 1) {
        const h = S().hand;
        let worst = null, wv = 1e9;
        for (const id of h) { const ev2 = K.evaluateCard(id); if (!ev2) continue;
          const v = value(id); if (v < wv) { wv = v; worst = id; } }
        if (worst) K.cycleCard(worst);
      }
      // a mid-skill hand, so the fights run their natural length
      const grades = [];
      for (const h of (K.currentIntent().hits || []))
        for (let n = 0; n < h.notes.length; n++) {
          const r = Math.random();
          grades.push(r < 0.2 ? 'perfect' : r < 0.55 ? 'great' : r < 0.8 ? 'good' : 'miss');
        }
      const r = await K.endTurn({ grades });
      if (r && (r.outcome === 'victory' || r.outcome === 'defeat')) break;
    }
  }
  return T;
})
`;

const CARD_FIN = "new Set(['lastlight'])";

(async () => {
  const H = await boot();
  await H.page.evaluate(() => { window.__SIM = true; });
  const fights = Number(process.env.FIGHTS || 60);
  const T = await H.page.evaluate(
    ([src, fin, n]) => { window.CARD_FIN = eval(fin); return eval(src)(n, 4100); },
    [DRIVER, CARD_FIN, fights]);

  const pct = (a, b) => b ? (a / b * 100).toFixed(0) + '%' : '—';
  console.log('\n  COMBO PROBE · ' + T.fights + ' fights, ' + T.turns + ' turns, ' + T.plays + ' cards played\n');

  console.log('  ── is a turn a decision? ──');
  console.log('    legal plays at turn start   ' + (T.optionsSum / T.turns).toFixed(2));
  console.log('    of those, real contenders   ' + (T.contendersSum / T.turns).toFixed(2)
    + '   (within 25% of the best line)');
  console.log('    turns with exactly one play ' + pct(T.forced, T.turns));
  console.log('    turns with nothing playable ' + pct(T.dead, T.turns));
  console.log('    cards played per turn       ' + (T.plays / T.turns).toFixed(2)
    + '   ' + JSON.stringify(T.playsPerTurn));
  console.log('    AP left on the table        ' + (T.apLeft / T.turns).toFixed(2)
    + ' of ' + (T.apTotal / T.turns).toFixed(2));

  console.log('\n  ── does the combo layer fire? ──');
  const cond = T.condHot + T.condCold;
  console.log('    conditional cards played    ' + cond + '  (' + pct(cond, T.plays) + ' of all plays)');
  console.log('    …played ARMED               ' + pct(T.condHot, cond));
  console.log('    FOLLOW-UP on offer / taken  ' + T.followChance + ' / ' + T.followTaken
    + '   (' + pct(T.followTaken, T.followChance) + ')');
  console.log('    three heroes in one turn    ' + pct(T.threeHeroTurns, T.turns));
  for (const [k, v] of Object.entries(T.byCond))
    console.log('      ' + k.padEnd(16) + 'hot ' + String(v.hot).padStart(4)
      + '   cold ' + String(v.cold).padStart(4) + '   ' + pct(v.hot, v.hot + v.cold));

  console.log('\n  ── is the whole deck in play? ──');
  const rows = Object.entries(T.byCard).sort((a, b) => b[1] - a[1]);
  const per = (n) => (n / T.fights).toFixed(2);
  for (const [id, n] of rows) console.log('    ' + id.padEnd(14) + String(n).padStart(5) + '   ' + per(n) + '/fight');
  const ALL = ['cleave', 'guardcut', 'cstance', 'crosssever', 'lastlight', 'lcascade', 'mend',
    'frostbind', 'sgrace', 'intercession', 'serrate', 'qthrow', 'twinfang', 'backstab', 'execute'];
  const never = ALL.filter(id => !T.byCard[id]);
  const rare = ALL.filter(id => T.byCard[id] && T.byCard[id] / T.fights < 0.25);
  if (never.length) console.log('    NEVER PLAYED: ' + never.join(', '));
  if (rare.length) console.log('    barely played (<0.25/fight): ' + rare.join(', '));
  console.log('');
  await H.browser.close();
})().catch(e => { console.error('PROBE CRASH:', e); process.exit(2); });
