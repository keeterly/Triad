// KIZUNA v2.3 — the BONDS suite. The social layer: what two of them earn by
// fighting together, the scene it opens, the fork that is a card, and the
// slot somebody has to give up to carry it.
//
// The rule this whole build turns on: THE DECK NEVER GROWS. Five slots a hero,
// fifteen cards, always — so a card won is a card lost, and which of the two
// heroes pays is the player's decision.
'use strict';
const { boot } = require('./harness.cjs');

(async () => {
  const H = await boot({ query: 'road=1' });
  const { J, check, report, sleep } = H;

  const R = () => J(() => JSON.parse(JSON.stringify(window.R.state())));
  const reset = (seed) => J((s) => { window.R.newRun(s); window.R.resetProfile(); return true; }, seed);
  const atCamp = (patch) => J((p) => {
    const camp = window.R.map().find(n => n.kind === 'camp');
    const prev = window.R.map().find(m => m.col === camp.col - 1 && m.to.indexOf(camp.id) >= 0);
    window.R._set(Object.assign({ at: prev.id, path: [prev.id], stop: prev.col + 1 }, p || {}));
    window.R.travel(camp.id);
    return camp.id;
  }, patch);

  await reset(11);

  // ═══ A · FIVE SLOTS A HERO, ALWAYS ═══
  console.log('\n── the roster ──');
  {
    const r = await J(() => {
      const base = window.K.baseRoster();
      return { ash: base.ash.length, elin: base.elin.length, mira: base.mira.length,
               ids: window.K.rosterIds(base).length,
               valid: window.K.rosterValid(base), slots: window.K.SLOTS_PER_HERO,
               bad: window.K.rosterValid({ ash: ['cleave'], elin: [], mira: [] }) };
    });
    check('ROSTER: three heroes, five slots each, fifteen cards',
      r.ash === 5 && r.elin === 5 && r.mira === 5 && r.ids === 15 && r.slots === 5
      && r.valid === true && r.bad === false, JSON.stringify(r));

    const dealt = await J(() => {
      const base = window.K.baseRoster();
      base.ash[0] = 'shieldblade';                   // a pair card in Ash's five
      window.K.startCombat({ seed: 3, roster: base });
      const c = window.K.state();
      const all = [...c.hand, ...c.deck, ...c.discard];
      return { n: all.length, has: all.indexOf('shieldblade') >= 0,
               gone: all.indexOf('cleave') >= 0 };
    });
    check('ROSTER: a fight is dealt the roster — the bond card is in it, the card it replaced is not',
      dealt.n === 15 && dealt.has && !dealt.gone, JSON.stringify(dealt));

    const bondCards = await J(() => {
      const ids = window.K.BOND_IDS;
      const pairs = ids.map(id => (window.K.pairOf(id) || []).join('|'));
      const shapes = ids.map(id => window.K.effectText(window.K.CARD_DEFS[id].base));
      return { n: ids.length, pairs: [...new Set(pairs)], allPaired: pairs.every(p => p.indexOf('|') > 0),
               distinct: new Set(shapes).size };
    });
    check('CARDS: twelve bond cards, three pairs, and no two of them do the same thing',
      bondCards.n === 12 && bondCards.pairs.length === 3 && bondCards.allPaired
      && bondCards.distinct === 12, JSON.stringify(bondCards));

    // A pair card needs both voices. One of them down and it cannot be played
    // at all — the cost of a card two people own.
    const both = await J(() => {
      const base = window.K.baseRoster();
      base.ash[0] = 'shieldblade';
      window.K.startCombat({ seed: 3, roster: base });
      window.K.forceHand(['shieldblade', 'mend', 'serrate', 'qthrow', 'frostbind']);
      const okAlive = window.K.playCard('shieldblade');
      window.K.startCombat({ seed: 3, roster: base });
      window.K.forceHand(['shieldblade', 'mend', 'serrate', 'qthrow', 'frostbind']);
      const c = window.K.state();
      c.heroes.mira.downed = true;
      const okDown = window.K.playCard('shieldblade');
      return { okAlive: !!okAlive, okDown: !!okDown };
    });
    check('CARDS: a pair card needs both voices — one of them down and it will not play',
      both.okAlive && !both.okDown, JSON.stringify(both));
  }

  // ═══ B · A BOND IS EARNED BY WHAT THEY DO FOR EACH OTHER ═══
  console.log('\n── earning it ──');
  {
    const earn = await J(() => {
      window.K.startCombat({ seed: 3 });
      window.K.forceHand(['cleave', 'serrate', 'mend', 'qthrow', 'frostbind']);
      const before = { ...window.K.state().pairBond };
      window.K.playCard('cleave');          // ash
      window.K.playCard('serrate');         // mira, straight after — a stitch
      const after = { ...window.K.state().pairBond };
      return { before, after };
    });
    check('BOND: acting straight after each other pays the pair that did it, and only them',
      earn.after['ash|mira'] > earn.before['ash|mira']
      && earn.after['ash|elin'] === 0 && earn.after['elin|mira'] === 0,
      JSON.stringify(earn.after));

    const shield = await J(() => {
      window.K.startCombat({ seed: 3 });
      window.K.forceHand(['intercession', 'cleave', 'serrate', 'qthrow', 'frostbind']);
      const b0 = { ...window.K.state().pairBond };
      window.K.playCard('intercession', 'mira');    // Elin steps in for Mira
      const b1 = { ...window.K.state().pairBond };
      return { b0, b1 };
    });
    check('BOND: stepping into a blow meant for someone else pays more than a follow-up',
      shield.b1['elin|mira'] >= 3 && shield.b1['ash|elin'] === 0, JSON.stringify(shield.b1));

    const banked = await J(() => {
      const s = window.K.combatSummary('VICTORY');
      return { has: !!s.pairBond, keys: Object.keys(s.pairBond || {}).length };
    });
    check('BOND: the fight hands its bonds back so the run can bank them',
      banked.has && banked.keys === 3, JSON.stringify(banked));
  }

  // ═══ C · THE FIRE HEARS THEM ═══
  console.log('\n── the scene, and the fork ──');
  {
    await reset(11);
    const scenes = await J(() => {
      const B = window.R.BONDS;
      const all = Object.keys(B).flatMap(k => B[k]);
      return { pairs: Object.keys(B).length, per: Object.keys(B).map(k => B[k].length),
               n: all.length, forks: all.every(s => s.picks && s.picks.length === 2),
               cards: [...new Set(all.flatMap(s => s.picks.map(p => p.card)))].length,
               beats: all.every(s => s.beats.length >= 3) };
    });
    check('SCENE: six scenes — three pairs, two levels — and every one ends in a fork of two',
      scenes.pairs === 3 && scenes.n === 6 && scenes.forks && scenes.cards === 12 && scenes.beats,
      JSON.stringify(scenes));

    // a pair over the threshold gets their scene AT the fire, before the tree
    const opened = await atCamp({ bonds: { 'ash|mira': 20, 'ash|elin': 0, 'elin|mira': 0 }, embers: 6, tier: 2 });
    await sleep(420);
    const at = await J(() => ({
      scene: !document.getElementById('k-scene').classList.contains('k-hidden'),
      camp: !document.getElementById('k-camp').classList.contains('k-hidden'),
      cast: document.querySelectorAll('#k-scene-cast .k-sc-fig').length,
      title: document.getElementById('k-scene-title').textContent,
    }));
    check('SCENE: a pair that crossed a level is heard at the fire, before the tree',
      at.scene && !at.camp && at.cast === 2, JSON.stringify(at));
    check('SCENE: a bond scene is a two-hander — only the pair is in the shot',
      at.cast === 2, at.cast + ' figures');

    const fork = await J(() => {
      window.R.sceneSkip();                       // straight to the fork
      const box = document.getElementById('k-scene-fork');
      const picks = [...box.querySelectorAll('.k-fork')].map(b => ({
        line: (b.querySelector('.k-fork-line') || {}).textContent,
        card: (b.querySelector('.k-fork-card b') || {}).textContent,
      }));
      return { shown: !box.classList.contains('k-hidden'), picks,
               plateHidden: getComputedStyle(document.getElementById('k-scene-plate')).display === 'none' };
    });
    check('FORK: skipping goes to the fork, and each reply names the card it wins',
      fork.shown && fork.picks.length === 2 && fork.picks.every(p => p.line && p.card)
      && fork.picks[0].card !== fork.picks[1].card, JSON.stringify(fork.picks));
  }

  // ═══ D · THE TRADE ═══
  console.log('\n── what leaves ──');
  {
    const took = await J(() => {
      window.R.takeBond(0);
      const r = window.R.state();
      return { onSwap: !document.getElementById('k-swap').classList.contains('k-hidden'),
               pending: window.R.pendingCard(),
               level: r.levels['ash|mira'],
               cols: document.querySelectorAll('#k-swap-cols .k-sw-col').length,
               offered: document.querySelectorAll('#k-swap-cols .k-swapcard').length,
               go: document.getElementById('k-swap-go').disabled };
    });
    check('TRADE: taking a fork opens the trade — both owners’ fives, ten cards, nothing chosen yet',
      took.onSwap && !!took.pending && took.cols === 2 && took.offered === 10 && took.go === true,
      JSON.stringify(took));

    const done = await J(() => {
      const first = document.querySelector('#k-swap-cols .k-swapcard');
      const dropped = first.dataset.id, hero = first.dataset.hero;
      first.click();
      const armed = !document.getElementById('k-swap-go').disabled;
      const gained = window.R.pendingCard();
      document.getElementById('k-swap-go').click();
      const r = window.R.state();
      const sizes = ['ash', 'elin', 'mira'].map(h => r.roster[h].length);
      const all = window.K.rosterIds(r.roster);
      return { armed, dropped, hero, gained, sizes, total: all.length,
               has: all.indexOf(gained) >= 0, gone: all.indexOf(dropped) < 0,
               uniq: new Set(all).size };
    });
    check('TRADE: the card goes into that hero’s five and the one it replaced leaves',
      done.armed && done.has && done.gone && done.uniq === 15, JSON.stringify(done));
    check('TRADE: five slots a hero, fifteen cards — the deck never grows',
      done.sizes.every(n => n === 5) && done.total === 15, JSON.stringify(done.sizes));

    const back = await J(() => ({
      camp: !document.getElementById('k-camp').classList.contains('k-hidden'),
      swap: !document.getElementById('k-swap').classList.contains('k-hidden'),
    }));
    check('TRADE: the trade hands you on to the tree, still at the same fire',
      back.camp && !back.swap, JSON.stringify(back));

    // TWO LEVELS CROSSED ON ONE ROAD IS TWO SCENES, back to back at the same
    // fire — the first draft of this check assumed one and read the second
    // scene opening as a bug.
    await reset(11);
    await atCamp({ bonds: { 'ash|mira': 40, 'ash|elin': 0, 'elin|mira': 0 }, embers: 6, tier: 2 });
    await sleep(420);
    const chain = await J(() => {
      const out = { titles: [] };
      out.titles.push(document.getElementById('k-scene-title').textContent);
      window.R.sceneSkip(); window.R.takeBond(0);
      document.querySelector('#k-swap-cols .k-swapcard').click();
      document.getElementById('k-swap-go').click();
      out.second = !document.getElementById('k-scene').classList.contains('k-hidden');
      out.titles.push(document.getElementById('k-scene-title').textContent);
      window.R.sceneSkip(); window.R.takeBond(1);
      document.querySelector('#k-swap-cols .k-swapcard').click();
      document.getElementById('k-swap-go').click();
      const r = window.R.state();
      out.camp = !document.getElementById('k-camp').classList.contains('k-hidden');
      out.level = r.levels['ash|mira'];
      out.sizes = ['ash', 'elin', 'mira'].map(h => r.roster[h].length);
      out.uniq = new Set(window.K.rosterIds(r.roster)).size;
      return out;
    });
    check('TRADE: two levels crossed on one road is two scenes at the same fire, and still 5/5/5',
      chain.second && chain.titles[0] !== chain.titles[1] && chain.level === 2
      && chain.camp && chain.sizes.every(n => n === 5) && chain.uniq === 15,
      JSON.stringify(chain));
  }

  // ═══ E · WHAT SURVIVES A DEATH ═══
  console.log('\n── the profile ──');
  {
    // three scenes heard and three cards won across the two fires above
    const prof = await J(() => JSON.parse(JSON.stringify(window.R.profile())));
    check('PROFILE: every scene heard and every card won is remembered',
      prof.heard.length === prof.won.length && prof.heard.length >= 2
      && new Set(prof.won).size === prof.won.length, JSON.stringify(prof));

    const survives = await J(() => {
      const before = JSON.parse(JSON.stringify(window.R.profile()));
      window.R.newRun(77);                       // a whole new run
      const r = window.R.state();
      const after = JSON.parse(JSON.stringify(window.R.profile()));
      return { before, after, bonds: r.bonds, levels: r.levels,
               roster: ['ash', 'elin', 'mira'].map(h => r.roster[h].length),
               base: window.K.rosterIds(r.roster).sort().join() === window.K.rosterIds(window.K.baseRoster()).sort().join() };
    });
    check('PROFILE: unlocks persist across a new run — the bond levels do not',
      survives.after.heard.length === survives.before.heard.length
      && survives.after.won.length === survives.before.won.length
      && Object.values(survives.bonds).every(v => v === 0)
      && Object.values(survives.levels).every(v => v === 0),
      JSON.stringify({ won: survives.after.won, bonds: survives.bonds }));
    check('PROFILE: a new run starts from the base fifteen, not the deck you built',
      survives.base && survives.roster.every(n => n === 5), JSON.stringify(survives.roster));

    const stored = await J(() => {
      const raw = localStorage.getItem('kizuna23.profile');
      const p = raw ? JSON.parse(raw) : null;
      return { saved: !!p, won: p ? p.won.length : 0 };
    });
    check('PROFILE: it is written to storage, so it outlives the tab',
      stored.saved && stored.won >= 1, JSON.stringify(stored));
  }

  const r = report();
  await H.browser.close();
  process.exit(r.passed === r.total && r.errs === 0 ? 0 : 1);
})();
