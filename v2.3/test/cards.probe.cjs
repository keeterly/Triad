'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// DOES EVERY CARD DO WHAT IT SAYS?
// ═══════════════════════════════════════════════════════════════════════════
//
// The card table declares effects as ATOMS — { dmg: 7 }, { guardAlly: 3 },
// { moveSelf: 'front' } — and `resolveEffectsInner` is one long list of `if`s
// that turns each atom into a change in the fight. Two ways that can lie, and
// neither shows up as an error:
//
//   1. An atom nothing handles. The `if` for it was never written, or was
//      renamed on one side only. The card prints the line and does nothing.
//   2. An atom whose handler is guarded by a condition the play didn't meet —
//      `guardAlly` with no ally resolved, `intercede` likewise, `moveSelf` into
//      a row already occupied, `draw` on an empty deck. The atom runs, takes
//      the branch that does nothing, and the card is quietly a blank.
//
// So this does not read the resolver. It plays every card in the game from a
// state chosen so that NO atom can be a no-op by circumstance, and asks the
// fight what changed. An atom that moved nothing is reported by name.
//
// AND IT RUNS THE CARD FOUR TIMES, because a card has four faces and only one
// of them is the one in the table. Cold and ARMED — a combo's `bonus` atoms
// only exist on the turn its condition is true, and those are the newest,
// least-played atoms in the deck. Base and UPGRADED — the campfire replaces a
// card with a whole hand-authored face, which can carry an atom the original
// never had (Last Light+ adds `guardAll`, Shared Grace+ adds `chill`), so an
// upgrade is the one place a brand-new atom enters the game unaccompanied.
//
// NOT EVERY REWARD IS AN ATOM. A combo pays in one of three currencies and
// only one of them — `output` — adds effects to the list. `cost` rewrites what
// the card charges and `ap` hands a point back, and neither leaves a trace in
// `resolvedEffects`, so an atom-only audit calls Cross Sever's discount and
// Shared Grace's refund "ok" while reading nothing about them at all. Those two
// are checked against the AP the turn actually spent.
//
// The comparison is per-CHANNEL, not per-number: `dmg: 7` is checked to have
// taken health off the foe, not to have taken exactly 7 — damage is scaled by
// TUNE, by BROKEN, and by the sigil layer, and asserting the arithmetic here
// would only restate three other functions and go red whenever one is tuned.
// "Did the atom reach its channel at all" is the question the card face makes
// a promise about.
const { boot } = require('./harness.cjs');

(async () => {
  const { page, J, sleep, browser } = await boot({});
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await sleep(400);

  // THE FOUR RUNS PER CARD, enumerated up front. An upgrade is keyed by the
  // card it sharpens — and `sameAs` means one purchase sharpens three ids — so
  // the key to hand `startCombat` is the card's OWN key, not its id.
  const runs = await J(() => {
    const K = window.K;
    const out = [];
    for (const id of Object.keys(K.CARD_DEFS)) {
      const c = K.CARD_DEFS[id];
      const key = c.sameAs || id;
      const hasUp = !!K.CARD_UPS[key];
      const modes = c.cond ? ['cold', 'armed'] : ['cold'];
      for (const face of hasUp ? ['base', 'up'] : ['base'])
        for (const mode of modes) out.push({ id, key, face, mode });
      // an upgraded face can CARRY a condition the base one does not
      if (hasUp && !c.cond && K.CARD_UPS[key].cond) out.push({ id, key, face: 'up', mode: 'armed' });
    }
    return out;
  });

  const report = [];
  for (const run of runs) {
    const r = await J(({ id, key, face, mode }) => {
      const K = window.K;
      K.startCombat({ seed: 5, upgrades: face === 'up' ? [key] : [] });
      const C = K.state();
      // A STATE IN WHICH NOTHING IS A NO-OP BY ACCIDENT. Every hero hurt (so a
      // heal has somewhere to go) and unguarded (so a ward is visible), Mira in
      // the back (so a move to the front is a real move), the foe healthy (so
      // damage is not an overkill that clamps), and AP enough for the dearest
      // card in the game.
      C.boss.hp = C.boss.max; C.boss.brk = C.boss.breakMax || C.boss.brk;
      C.boss.bleed = 0; C.boss.chill = 0; C.boss.broken = false;
      Object.keys(C.heroes).forEach(h => {
        C.heroes[h].hp = Math.max(1, Math.round(C.heroes[h].max * 0.5));
        C.heroes[h].guard = 0; C.heroes[h].downed = false;
      });
      // three different hp values, so `guardLowest` and `heal` each have one
      // unambiguous winner rather than a tie the sort breaks arbitrarily
      C.heroes.ash.hp = 30; C.heroes.elin.hp = 20; C.heroes.mira.hp = 10;
      // Mira in the MIDDLE, so both of the game's two `moveSelf` targets are a
      // real step for her: Backstab's 'front' and Cut the Cord's 'back'. Parked
      // her in the back and half the moves were already true on arrival.
      K.placeHero('ash', 'front'); K.placeHero('elin', 'back'); K.placeHero('mira', 'mid');
      C.counterstance = false; C.intercession = null;
      C.ap = 9; C.pendingDiscard = false;
      C.turnState.freeMoves = 0;
      C.turnState.actionsPlayed = [];
      K.forceHand([id]);
      // ── ARM THE CLAUSE, from the same facts `evalCondition` reads ─────────
      // Not by setting a flag: by putting the fight in the state the card asks
      // for, so a condition whose reading has drifted from its wording fails
      // here rather than passing on a stub.
      const def = K.cardDef(id);
      const selfOf = (c) => (c.selfHero && C.heroes[c.selfHero]) ? c.selfHero : K.primaryHero(c);
      if (mode === 'armed' && def.cond) {
        const me = selfOf(def);
        const mine = K.ownerHeroes(def);
        const others = ['ash', 'elin', 'mira'].filter(h => mine.indexOf(h) < 0);
        switch (def.cond.type) {
          case 'FOLLOW_UP':
            C.turnState.actionsPlayed.push({ cardId: 'x', ownerId: others[0], condActive: false });
            break;
          case 'FINALE':
            others.forEach(h => C.turnState.actionsPlayed.push({ cardId: 'x', ownerId: h, condActive: false }));
            break;
          case 'BROKEN': case 'BROKEN_OR_LOW':
            C.boss.broken = true; C.boss.brk = 0; break;
          case 'BACK_ROW':   K.placeHero(me, 'back'); break;
          case 'REPOSITIONED': if (C.turnState.movedBy.indexOf(me) < 0) C.turnState.movedBy.push(me); break;
          case 'WARDED':     if (C.turnState.wardedBy.indexOf(me) < 0) C.turnState.wardedBy.push(me); break;
        }
      }
      // the deck must not be empty or `draw` has nothing to draw and reports a
      // failure that belongs to the setup, not to the card
      if (!C.deck.length) C.deck = Object.keys(K.CARD_DEFS).filter(x => x !== id).slice(0, 5);

      const ev = K.evaluateCard(id);
      // A RUN THAT DID NOT ARM WHAT IT SET OUT TO ARM PROVES NOTHING, and it
      // would prove it quietly: the cold atoms all pass and the bonus atoms
      // are simply not in the list to be checked. The setup is asserted.
      const armFailed = (mode === 'armed' && def.cond && !ev.condActive);
      const atoms = (ev.resolvedEffects || []).map(f => Object.assign({}, f));
      const before = {
        ap: C.ap, hp: C.boss.hp, brk: C.boss.brk, bleed: C.boss.bleed, chill: C.boss.chill,
        guard: { ash: C.heroes.ash.guard, elin: C.heroes.elin.guard, mira: C.heroes.mira.guard },
        hero: { ash: C.heroes.ash.hp, elin: C.heroes.elin.hp, mira: C.heroes.mira.hp },
        row: { ash: C.heroes.ash.row, elin: C.heroes.elin.row, mira: C.heroes.mira.row },
        hand: C.hand.length, free: C.turnState.freeMoves,
        cs: !!C.counterstance, inter: C.intercession, pend: !!C.pendingDiscard,
      };
      const played = K.playCard(id);
      const after = {
        ap: C.ap, hp: C.boss.hp, brk: C.boss.brk, bleed: C.boss.bleed, chill: C.boss.chill,
        guard: { ash: C.heroes.ash.guard, elin: C.heroes.elin.guard, mira: C.heroes.mira.guard },
        hero: { ash: C.heroes.ash.hp, elin: C.heroes.elin.hp, mira: C.heroes.mira.hp },
        row: { ash: C.heroes.ash.row, elin: C.heroes.elin.row, mira: C.heroes.mira.row },
        hand: C.hand.length, free: C.turnState.freeMoves,
        cs: !!C.counterstance, inter: C.intercession, pend: !!C.pendingDiscard,
      };
      const heroes = ['ash', 'elin', 'mira'];
      const gained = heroes.filter(h => after.guard[h] > before.guard[h]);
      const healed = heroes.filter(h => after.hero[h] > before.hero[h]);
      // WHOSE self-atoms these are: the same answer `selfHeroOf` gives, so a
      // pair card's `guardSelf` is checked against the hero it actually names.
      // Reading `primaryHero` alone would have checked Ash's row for Cut the
      // Cord's step — a card that says on its face that MIRA is the one who
      // steps — and passed a broken move by measuring the wrong person.
      const self = selfOf(ev.card);
      const dead = [];
      for (const fx of atoms) {
        if (fx.dmg        && !(after.hp   < before.hp))    dead.push('dmg');
        if (fx.brk        && !(after.brk  < before.brk))   dead.push('brk');
        if (fx.bleed      && !(after.bleed > before.bleed)) dead.push('bleed');
        if (fx.chill      && !(after.chill > before.chill)) dead.push('chill');
        if (fx.guardSelf  && !(after.guard[self] > before.guard[self])) dead.push('guardSelf');
        if (fx.guardAlly  && !gained.some(h => h !== self)) dead.push('guardAlly');
        if (fx.guardAll   && !heroes.every(h => after.guard[h] > before.guard[h])) dead.push('guardAll');
        if (fx.guardLowest && !gained.length) dead.push('guardLowest');
        if (fx.heal       && !healed.length) dead.push('heal');
        if (fx.healAll    && !heroes.every(h => after.hero[h] > before.hero[h])) dead.push('healAll');
        if (fx.counterstance && !after.cs) dead.push('counterstance');
        if (fx.intercede  && !after.inter) dead.push('intercede');
        if (fx.moveSelf   && after.row[self] !== fx.moveSelf) dead.push('moveSelf:' + fx.moveSelf);
        if (fx.freeMove   && !(after.free > before.free)) dead.push('freeMove');
        if (fx.drawDiscard && !(after.pend && after.hand > before.hand - 1)) dead.push('drawDiscard');
        if (fx.draw       && !(after.hand > before.hand - 1)) dead.push('draw');
      }
      if (armFailed) dead.push('CLAUSE NEVER ARMED (' + def.cond.type + ')');
      // ── AND WHAT THE TURN ACTUALLY PAID ──────────────────────────────────
      // `spent` is the only honest reading of a card's price: AP before minus
      // AP after, which nets the charge against any refund. A discount that
      // never reached `currentCost` and a refund that never reached `C.ap` are
      // both invisible in the effect list and both plain here.
      const spent = before.ap - after.ap;
      const rw = (mode === 'armed' && def.cond) ? def.cond.reward : null;
      if (rw === 'cost') {
        if (ev.currentCost !== def.cond.costTo) dead.push('cost-> ' + ev.currentCost + ' not ' + def.cond.costTo);
        else if (spent !== def.cond.costTo) dead.push('cost charged ' + spent);
        else if (def.cond.costTo >= def.cost) dead.push('cost discount is not a discount');
      }
      if (rw === 'ap') {
        const want = ev.currentCost - (def.cond.ap || 0);
        if (!ev.refund) dead.push('ap refund never issued');
        else if (spent !== want) dead.push('ap net ' + spent + ' not ' + want);
      }
      return { id, face, mode, name: ev.card.name, played, cost: ev.currentCost,
               armed: !!ev.condActive, upgraded: !!ev.card.upgraded,
               reward: (def.cond && def.cond.reward) || null, spent,
               atoms: atoms.map(a => Object.keys(a).join('+')), dead,
               // the lowest-hp hero is the one guardLowest and heal should pick
               lowest: heroes.slice().sort((a, b) => before.hero[a] - before.hero[b])[0],
               gained, healed, self };
    }, run);
    report.push(r);
  }

  const broken = report.filter(r => !r.played || r.dead.length);
  console.log('faces audited: ' + report.length
    + '  (' + new Set(report.map(r => r.id)).size + ' cards x cold/armed x base/upgraded)');
  for (const r of report) {
    const tag = (!r.played ? 'UNPLAYABLE' : r.dead.length ? 'DEAD ' + r.dead.join(',') : 'ok');
    console.log(('  ' + r.id).padEnd(15)
      + (r.face === 'up' ? '+' : ' ') + (r.mode === 'armed' ? '*' : ' ') + ' '
      + (r.name || '').padEnd(22) + tag.padEnd(34)
      + ('ap-' + r.spent).padEnd(6) + '[' + r.atoms.join(' | ') + ']');
  }
  console.log('');
  console.log('  + = upgraded face   * = its clause armed');
  console.log(broken.length
    ? '!! ' + broken.length + ' face(s) do not do what they declare'
    : 'every declared atom reached its channel, on every face');
  if (errs.length) console.log('pageErrors:', errs.length, errs.slice(0, 4));
  await browser.close();
  process.exit(broken.length || errs.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
