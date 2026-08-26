// KIZUNA v2.3 — the simulated player, shared by every sim that needs one.
// Extracted from balance.sim.cjs when the run simulator needed the SAME bot:
// two bots that drift apart quietly produce two balance answers, and the one
// you did not run is always the one that was right.
//
// It is a source STRING, eval'd inside the page, because it has to read the
// live evaluator — the point of the bot is that it plays against the real
// rules rather than against a model of them.
'use strict';
module.exports.BOT = `
(async (seed, pSuccess, maxTurns, opts) => {
  const K = window.K;
  const O = opts || {};
  K.startCombat({ seed, foe: O.foe ? K.FOES[O.foe] : undefined, partyHp: O.partyHp || undefined });
  let rnd = seed * 2654435761 % 2147483647;
  const rand = () => { rnd = (rnd * 48271) % 2147483647; return rnd / 2147483647; };
  const S = () => K.state();
  const living = () => Object.keys(S().heroes).filter(h => !S().heroes[h].downed);
  // Every exit reports the wounds it leaves behind: on a road they are the
  // opening position of the next fight, so no return path may omit them.
  const HP = () => ({ ash: S().heroes.ash.hp, elin: S().heroes.elin.hp, mira: S().heroes.mira.hp });

  // What this action is about to do to each hero, given how reliably THIS
  // player parries. A real player knows their own hands.
  const forecast = () => {
    const st = S(), it = K.currentIntent();
    const per = {}; living().forEach(h => per[h] = 0);
    const dirge = K.dirgeAmount();
    living().forEach(h => per[h] += dirge);
    if (st.boss.cancelNext) return per;
    let chill = st.boss.chill;
    const negated = {};
    for (const hit of (it.hits || [])) {
      const t = K.intentTargetId && hit.target;
      const tgt = (st.heroes[hit.target] && !st.heroes[hit.target].downed) ? hit.target : living()[0];
      if (!tgt) continue;
      let raw = hit.dmg[st.boss.phase - 1];
      if (hit.backFactor != null && st.heroes[tgt].row === 'back') raw = Math.ceil(raw * hit.backFactor);
      raw = Math.max(0, raw - chill); chill = 0;
      const parrier = (st.intercession === tgt) ? 'elin' : tgt;
      // expected: pSuccess of the time it is blunted (or negated if Guard is
      // there and this parrier has not spent a negate on this action yet)
      // expected v2.2 mitigation: every note turned negates its share, and a
      // whole string turned negates the blow (once per hero per action)
      const n = hit.notes.length;
      const pTurn = Math.pow(pSuccess, n);
      const canTurn = !negated[parrier];
      if (canTurn && pTurn > 0.5) negated[parrier] = true;
      const partial = pSuccess * 0.925 + (1 - pSuccess) * 0.4 * 0.6;   // weighted share per note
      const mit = pTurn * (canTurn ? 1 : 0.75) + (1 - pTurn) * partial;
      per[tgt] = (per[tgt] || 0) + Math.max(0, raw * (1 - mit));
    }
    return per;
  };
  // Who dies this enemy phase if nothing changes, and by how much.
  const deficit = () => {
    const st = S(), f = forecast();
    let worst = 0, who = null;
    for (const h of living()) {
      const need = f[h] - st.heroes[h].hp - st.heroes[h].guard;
      if (need > worst) { worst = need; who = h; }
    }
    return { need: worst, who };
  };

  const dmgOf = (id) => { const ev = K.evaluateCard(id); return ev ? ev.resolvedEffects.reduce((n, fx) => n + (fx.dmg || 0), 0) : 0; };
  // How much a card buys the hero in trouble (Guard on them, or healing).
  const savesFor = (id, who) => {
    const ev = K.evaluateCard(id); if (!ev) return 0;
    const st = S(); let v = 0;
    const owner = ev.card.owner === 'bond' ? 'ash' : ev.card.owner;
    const low = living().sort((a, b) => st.heroes[a].hp - st.heroes[b].hp)[0];
    for (const fx of ev.resolvedEffects) {
      if (fx.guardSelf && owner === who) v += fx.guardSelf;
      if (fx.guardAll) v += fx.guardAll;
      if (fx.guardAlly) v += fx.guardAlly;
      if (fx.guardLowest && low === who) v += fx.guardLowest;
      if (fx.heal && low === who) v += fx.heal;
      if (fx.chill) v += Math.min(fx.chill, 6);
      if (fx.intercede) v += 3;
    }
    return v;
  };

  for (let turn = 0; turn < maxTurns; turn++) {
    let st = S();
    if (st.phase === 'VICTORY') return { win: true, turns: st.turn, hp: HP() };
    if (st.phase === 'DEFEAT') return { win: false, turns: st.turn, died: true, hp: HP() };
    const it = K.currentIntent();

    // Positional counterplay: the Scything Advance spares the Back row.
    if (it.frontOnly) {
      for (const h of ['mira', 'ash']) {
        if (S().ap >= 2 && !S().turnState.moved && !S().heroes[h].downed && S().heroes[h].row === 'front'
            && S().heroes[h].hp < 20) { K.moveHero(h); break; }
      }
    }

    // SPEND THE LADDER. A bot that never fires the all-out measures a party
    // that never uses its best turn, and reports the fight as harder than it is.
    if (S().kizuna >= 100) {
      await K.allOut();
      if (S().phase === 'VICTORY') return { win: true, turns: S().turn, hp: HP() };
    }

    // TRIAGE FIRST — buy exactly enough survival, then swing with the rest.
    // This is the deck's core tradeoff: defense costs AP, so a player who
    // cannot parry spends their whole turn staying alive and never kills.
    let guardLoop = 0;
    while (S().ap > 0 && guardLoop++ < 8) {
      const d = deficit();
      if (d.need <= 0 || !d.who) break;
      let best = null, bestV = 0;
      for (const id of S().hand) {
        const ev = K.evaluateCard(id);
        if (!ev || S().ap < ev.currentCost) continue;
        const o = ev.card.owner === 'bond' ? 'ash' : ev.card.owner;
        if (ev.card.owner === 'bond' ? (S().heroes.ash.downed || S().heroes.elin.downed) : S().heroes[o].downed) continue;
        const v = (savesFor(id, d.who) + dmgOf(id) * 0.25) / ev.currentCost;
        if (v > bestV) { bestV = v; best = id; }
      }
      if (!best || bestV < 1.2) break;
      if (!K.playCard(best)) break;
      if (S().pendingDiscard) K.pickDiscard(S().hand[0]);
      if (S().phase === 'VICTORY') return { win: true, turns: S().turn, hp: HP() };
    }

    // THEN OFFENSE — value per AP, nudged toward alternating heroes so the
    // Follow-Up discounts, Finale coverage and Bond stitches actually land.
    let atkLoop = 0;
    while (S().ap > 0 && atkLoop++ < 8) {
      const cur = S();
      const last = cur.turnState.actionsPlayed[cur.turnState.actionsPlayed.length - 1];
      let best = null, bestV = 0.5;
      for (const id of cur.hand) {
        const ev = K.evaluateCard(id);
        if (!ev || cur.ap < ev.currentCost) continue;
        const o = ev.card.owner === 'bond' ? 'ash' : ev.card.owner;
        if (ev.card.owner === 'bond' ? (cur.heroes.ash.downed || cur.heroes.elin.downed) : cur.heroes[o].downed) continue;
        let v = 0;
        for (const fx of ev.resolvedEffects) {
          if (fx.dmg) v += fx.dmg;
          if (fx.brk) v += fx.brk * 3;
          if (fx.bleed) v += fx.bleed * 2;
          if (fx.chill) v += fx.chill * 0.5;
          if (fx.guardSelf || fx.guardAll || fx.guardAlly || fx.guardLowest) v += 1.5;
          if (fx.drawDiscard) v += 1.5;
        }
        v /= ev.currentCost;
        if (last && ev.card.owner !== last.ownerId) v += 1.0;
        if (v > bestV) { bestV = v; best = id; }
      }
      if (!best) break;
      if (!K.playCard(best)) break;
      if (S().pendingDiscard) {
        const h = S().hand;
        let worst = h[0], wv = 1e9;
        for (const id of h) { const d = dmgOf(id); if (d < wv) { wv = d; worst = id; } }
        K.pickDiscard(worst);
      }
      if (S().phase === 'VICTORY') return { win: true, turns: S().turn, hp: HP() };
    }

    // Free cycle: dump whatever is least useful right now.
    if (!S().turnState.cycled && S().hand.length > 1) {
      const h = S().hand;
      let worst = null, wv = 1e9;
      for (const id of h) { const ev = K.evaluateCard(id); if (!ev) continue;
        const v = dmgOf(id) / Math.max(1, ev.currentCost);
        if (v < wv) { wv = v; worst = id; } }
      if (worst) K.cycleCard(worst);
    }

    // v2.2 grading is PER NOTE: skill is the chance a single note lands
    // GREAT-or-better, and a string is TURNED only if every note does.
    const grades = [];
    for (const h of (K.currentIntent().hits || [])) {
      for (let n = 0; n < h.notes.length; n++) {
        if (pSuccess <= 0) { grades.push('miss'); continue; }   // never engages
        const r = rand();
        grades.push(r < pSuccess * 0.3 ? 'perfect' : r < pSuccess ? 'great'
                  : r < pSuccess + (1 - pSuccess) * 0.5 ? 'good' : 'miss');
      }
    }
    const r = await K.endTurn({ grades });
    if (r && r.outcome === 'victory') return { win: true, turns: S().turn, hp: HP() };
    if (r && r.outcome === 'defeat') return { win: false, turns: S().turn, died: true, hp: HP() };
  }
  return { win: false, turns: maxTurns, timeout: true, hp: HP() };
})
`;
