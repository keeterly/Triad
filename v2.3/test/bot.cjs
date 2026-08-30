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
  K.startCombat({ seed, foe: O.foe ? K.FOES[O.foe] : undefined, partyHp: O.partyHp || undefined,
                  upgrades: O.upgrades || undefined, allout: O.allout || undefined,
                  kizuna: O.kizuna || 0, roster: O.roster || undefined,
                  // what the awakening changed — a bot that dropped these
                  // would report the road as if nobody had chosen anything
                  vigor: O.vigor || 0, foeBonus: O.foeBonus || 0,
                  sigils: O.sigils || {} });
  let rnd = seed * 2654435761 % 2147483647;
  const rand = () => { rnd = (rnd * 48271) % 2147483647; return rnd / 2147483647; };
  const S = () => K.state();
  const living = () => Object.keys(S().heroes).filter(h => !S().heroes[h].downed);
  // Every exit reports the wounds it leaves behind: on a road they are the
  // opening position of the next fight, so no return path may omit them.
  const HP = () => ({ ash: S().heroes.ash.hp, elin: S().heroes.elin.hp, mira: S().heroes.mira.hp });
  // what the bond is worth walking away, and how often the all-out actually
  // fired — the number that says whether the ladder is part of a fight at all
  const KZ = () => S().kizuna;
  const AO = () => S().allOuts;
  // and what the pairs built in this fight — without this the run simulator
  // could see the social layer exist and never see it accrue
  const PB = () => ({ ...S().pairBond });

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
      // THE BOT WAS BLIND TO WHERE ANYBODY WAS STANDING. backFactor was
      // renamed to sweep + ROW_SHELTER in the engine — game.js says so in a
      // comment — and this line was never updated, so hit.backFactor has been
      // undefined on every hit since. The forecast therefore priced lane
      // position at ZERO, which means every balance number this repo has ever
      // produced was measured by a party that could not tell the difference
      // between standing in front of a sweeping blade and standing behind it.
      if (hit.sweep) {
        const sh = (K.ROW_SHELTER || {})[st.heroes[tgt].row];
        if (sh != null) raw = Math.ceil(raw * sh);
      }
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
    const owner = K.primaryHero(ev.card);
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
    if (st.phase === 'VICTORY') return { win: true, turns: st.turn, hp: HP(), kizuna: KZ(), allouts: AO(), pairBond: PB() };
    if (st.phase === 'DEFEAT') return { win: false, turns: st.turn, died: true, hp: HP(), kizuna: KZ(), allouts: AO(), pairBond: PB() };
    const it = K.currentIntent();

    // POSITIONAL COUNTERPLAY, DRIVEN BY THE FORECAST RATHER THAN BY A FLAG.
    // This keyed on it.frontOnly, which appears exactly once in the whole
    // engine — its own definition — and nothing reads it. It also only ever
    // considered heroes already under 20 health, so the bot could not choose to
    // step out of the way BEFORE being hurt, which is the only time the choice
    // is worth anything. It now moves whoever a sweep is aimed at, when moving
    // measurably blunts what is coming and the AP is spare.
    if ((it.hits || []).some(h2 => h2.sweep) && S().ap >= 2 && !S().turnState.moved) {
      const before = forecast();
      const shelt = K.ROW_SHELTER || {};
      const order = ['front', 'mid', 'back'];
      let best = null, bestGain = 0;
      for (const h of living()) {
        const st2 = S().heroes[h];
        const back = order[Math.min(order.length - 1, order.indexOf(st2.row) + 1)];
        if (back === st2.row) continue;
        const now = shelt[st2.row] != null ? shelt[st2.row] : 1;
        const then = shelt[back] != null ? shelt[back] : 1;
        // what this hero is about to take, times the share the step removes
        const gain = (before[h] || 0) * Math.max(0, 1 - then / now);
        if (gain > bestGain) { bestGain = gain; best = h; }
      }
      // worth an AP only if it beats what an AP of damage would have bought
      if (best && bestGain >= 4) K.moveHero(best);
    }

    // SPEND THE LADDER. A bot that never fires the all-out measures a party
    // that never uses its best turn, and reports the fight as harder than it is.
    if (S().kizuna >= 100) {
      await K.allOut();
      if (S().phase === 'VICTORY') return { win: true, turns: S().turn, hp: HP(), kizuna: KZ(), allouts: AO(), pairBond: PB() };
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
        // a pair card needs BOTH its owners standing
        if (K.ownerHeroes(ev.card).some(h => S().heroes[h].downed)) continue;
        const v = (savesFor(id, d.who) + dmgOf(id) * 0.25) / ev.currentCost;
        if (v > bestV) { bestV = v; best = id; }
      }
      if (!best || bestV < 1.2) break;
      if (!K.playCard(best)) break;
      if (S().pendingDiscard) K.pickDiscard(S().hand[0]);
      if (S().phase === 'VICTORY') return { win: true, turns: S().turn, hp: HP(), kizuna: KZ(), allouts: AO(), pairBond: PB() };
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
        if (K.ownerHeroes(ev.card).some(h => cur.heroes[h].downed)) continue;
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
        if (last && K.ownerHeroes(ev.card).indexOf(last.ownerId) < 0) v += 1.0;
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
      if (S().phase === 'VICTORY') return { win: true, turns: S().turn, hp: HP(), kizuna: KZ(), allouts: AO(), pairBond: PB() };
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
    if (r && r.outcome === 'victory') return { win: true, turns: S().turn, hp: HP(), kizuna: KZ(), allouts: AO(), pairBond: PB() };
    if (r && r.outcome === 'defeat') return { win: false, turns: S().turn, died: true, hp: HP(), kizuna: KZ(), allouts: AO(), pairBond: PB() };
  }
  return { win: false, turns: maxTurns, timeout: true, hp: HP(), kizuna: KZ(), allouts: AO(), pairBond: PB() };
})
`;
