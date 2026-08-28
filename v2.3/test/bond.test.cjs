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
      // THE FORK SHOWS THE CARD ITSELF now, not a description of it — the
      // same face the hand draws, so the preview cannot disagree with what
      // arrives. The reply line still sits above it.
      const picks = [...box.querySelectorAll('.k-fork')].map(b => {
        const face = b.querySelector('.k-card-static');
        return { line: (b.querySelector('.k-fork-line') || {}).textContent,
                 card: (b.querySelector('.k-cname') || {}).textContent,
                 face: !!face,
                 gem: (b.querySelector('.k-cgem') || {}).textContent,
                 prose: ((b.querySelector('.k-cprose') || {}).textContent || '').trim().length,
                 glyphs: b.querySelectorAll('.k-cverb').length,
                 w: face ? Math.round(face.getBoundingClientRect().width) : 0 };
      });
      return { shown: !box.classList.contains('k-hidden'), picks,
               plateHidden: getComputedStyle(document.getElementById('k-scene-plate')).display === 'none' };
    });
    check('FORK: the card is DRAWN, not described — a real face, with its cost and its verb',
      fork.picks.length === 2 && fork.picks.every(p => p.face && p.w > 60
        && /^\d+$/.test(p.gem || '') && p.prose > 4 && p.glyphs >= 1),
      JSON.stringify(fork.picks.map(p => ({ card: p.card, gem: p.gem, w: p.w,
                                            prose: p.prose, glyphs: p.glyphs }))));
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

    // THIS, FOR THAT — as two faces rather than two sentences. The single most
    // consequential decision the road asks ("which of these fifteen leaves
    // forever?") was made with the arriving card as a one-line chip in the top
    // corner and the departing one as a text row in a list of ten. Neither card
    // was ever SEEN. The panel shows both at the size they are in the hand.
    const panel = await J(() => {
      const p = document.querySelector('.k-sw-trade');
      const face = () => document.querySelectorAll('.k-swt-face .k-card').length;
      const before = { panel: !!p, faces: face(),
                       empty: !!document.querySelector('.k-swt-empty'),
                       chip: (document.getElementById('k-swap-new') || {}).innerHTML };
      document.querySelector('#k-swap-cols .k-swapcard').click();
      const box = document.querySelector('.k-swt-face .k-card').getBoundingClientRect();
      return { before, afterFaces: face(),
               afterEmpty: !!document.querySelector('.k-swt-empty'),
               w: Math.round(box.width), h: Math.round(box.height),
               names: [...document.querySelectorAll('.k-swt-face .k-cname')]
                 .map(n => n.textContent) };
    });
    check('TRADE: the panel shows the card that leaves and the card that joins, as real faces',
      panel.before.panel && panel.before.faces === 1 && panel.before.empty
      && panel.before.chip === '' && panel.afterFaces === 2 && !panel.afterEmpty
      && panel.w > 90 && panel.h > 140 && panel.names.length === 2
      && panel.names[0] !== panel.names[1],
      JSON.stringify(panel));

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

    // A BOND LEVEL NOW PAYS TWICE — a card, and a mark on one they already
    // carry — so the trade hands on to the marking screen before the fire.
    const marking = await J(() => {
      const up = (id) => !document.getElementById(id).classList.contains('k-hidden');
      const cards = [...document.querySelectorAll('#k-mark-cols .k-mk')];
      // The mark is decided by the pair and the level — ash|mira level 1 —
      // so the screen's title is checked against the map, not a literal.
      const want = window.R.sigilFor('ash|mira', 1);
      return { onMark: up('k-mark'), onCamp: up('k-camp'),
               want, wantName: window.K.SIGILS[want].name.toUpperCase(),
               pending: window.R.state().pendingSigil,
               title: (document.getElementById('k-mark-title') || {}).textContent,
               line: ((document.getElementById('k-mark-line') || {}).textContent || '').length,
               offered: cards.length,
               faces: cards.filter(c => c.querySelector('.k-card-static')).length,
               wearing: cards.filter(c => c.querySelector('.k-csig')).length };
    });
    check('MARK: the level also teaches a mark, and every card it may land on is DRAWN wearing it',
      marking.onMark && !marking.onCamp && marking.pending
      && marking.pending === marking.want && marking.title === marking.wantName
      && marking.line > 10
      && marking.offered === 10 && marking.faces === 10 && marking.wearing === 10,
      JSON.stringify(marking));

    const placed = await J(() => {
      const btn = document.querySelector('#k-mark-cols .k-mk:not([disabled])');
      const id = btn.dataset.id;
      btn.click();
      const r = window.R.state();
      const up = (x) => !document.getElementById(x).classList.contains('k-hidden');
      const all = window.K.rosterIds(r.roster);
      return { id, sigil: r.sigils[id], pending: r.pendingSigil,
               onCamp: up('k-camp'), onMark: up('k-mark'),
               marks: Object.keys(r.sigils).length,
               owned: all.indexOf(id) >= 0,
               sizes: [r.roster.ash.length, r.roster.elin.length, r.roster.mira.length],
               uniq: new Set(all).size };
    });
    check('MARK: placing it marks exactly one card the party carries, and spends the grant',
      placed.sigil && placed.pending == null && placed.marks === 1 && placed.owned
      && placed.sizes.every(n => n === 5) && placed.uniq === 15,
      JSON.stringify(placed));

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
      const out = { titles: [], marks: [] };
      // Each level now runs scene → fork → swap → MARK, and only then hands
      // back to the next scene or the fire.
      const step = (ix) => {
        window.R.sceneSkip(); window.R.takeBond(ix);
        document.querySelector('#k-swap-cols .k-swapcard').click();
        document.getElementById('k-swap-go').click();
        out.marks.push(!document.getElementById('k-mark').classList.contains('k-hidden'));
        const btn = document.querySelector('#k-mark-cols .k-mk:not([disabled])');
        if (btn) btn.click();
      };
      out.titles.push(document.getElementById('k-scene-title').textContent);
      step(0);
      out.second = !document.getElementById('k-scene').classList.contains('k-hidden');
      out.titles.push(document.getElementById('k-scene-title').textContent);
      step(1);
      const r = window.R.state();
      out.sigils = Object.keys(r.sigils).length;
      out.pending = r.pendingSigil;
      out.camp = !document.getElementById('k-camp').classList.contains('k-hidden');
      out.level = r.levels['ash|mira'];
      out.sizes = ['ash', 'elin', 'mira'].map(h => r.roster[h].length);
      out.uniq = new Set(window.K.rosterIds(r.roster)).size;
      return out;
    });
    check('MARK: each level marks one card, and the grant never survives its own screen',
      chain.marks.length === 2 && chain.marks.every(Boolean)
      && chain.sigils === 2 && chain.pending == null,
      JSON.stringify({ marks: chain.marks, sigils: chain.sigils, pending: chain.pending }));
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

  // ═══ WHAT A WON CARD IS FOR — the awakening's persistent slot ═══
  // Before this, a card won on an earlier road did nothing until the run
  // happened to reach a campfire with the right pair at the right level. The
  // profile persisted and then sat there. AN OLD HABIT is the seam that makes
  // it matter on the first screen of the next run.
  console.log('\n── an old habit ──');
  {
    const seeded = await J(() => {
      window.R.resetProfile();
      const p = window.R.profile();
      p.won.push('shieldsong');                 // as if an earlier road won it
      window.R.newRun(31);
      const offer = window.R.wakeOffer();
      const card = document.querySelector('#k-wake-cards .k-wk-card');
      return { ids: offer.map(w => w.id), kinds: offer.map(w => w.kind),
               drawn: !!card,
               gain: card ? (card.querySelector('.k-wk-gain') || {}).textContent : null };
    });
    check('HABIT: a card won on an earlier road is offered on waking, by name',
      seeded.ids.indexOf('habit') >= 0 && seeded.kinds.filter(k => k === 'card').length === 1
      && seeded.drawn && /Shieldsong/i.test(seeded.gain || ''),
      JSON.stringify(seeded));

    // It is NOT free. The deck does not grow — five slots a hero, always — so
    // the card arrives through the same swap screen every other card uses.
    const swap = await J(() => {
      window.R.takeWake('habit');
      const hidden = (id) => document.getElementById(id).classList.contains('k-hidden');
      return { onSwap: !hidden('k-swap'), onMap: !hidden('k-map'),
               pending: window.R.pendingCard(),
               cols: [...document.querySelectorAll('#k-swap-cols .k-swapcard')].length };
    });
    check('HABIT: the card does not simply appear — it goes through the swap, like every other card',
      swap.onSwap && !swap.onMap && swap.pending === 'shieldsong' && swap.cols >= 5,
      JSON.stringify(swap));

    const done = await J(() => {
      const first = document.querySelector('#k-swap-cols .k-swapcard');
      const dropped = first.dataset.id, hero = first.dataset.hero;
      first.click();
      window.R.confirmSwap();
      const r = window.R.state();
      const hidden = (id) => document.getElementById(id).classList.contains('k-hidden');
      const all = [].concat(r.roster.ash, r.roster.elin, r.roster.mira);
      return { dropped, hero, onMap: !hidden('k-map'), woke: r.woke,
               sizes: [r.roster.ash.length, r.roster.elin.length, r.roster.mira.length],
               uniq: new Set(all).size, has: all.indexOf('shieldsong') >= 0,
               gone: all.indexOf(dropped) < 0 };
    });
    // The swap that follows an awakening has no campfire to go back to — the
    // first pass sent it to the camp screen with no fire behind it.
    check('HABIT: the trade is one for one, still five slots a hero, and it lets go onto the road',
      done.has && done.gone && done.sizes.every(n => n === 5) && done.uniq === 15
      && done.onMap && done.woke === 'habit',
      JSON.stringify(done));

    // NOTHING ON EITHER DECISION SCREEN HANGS OFF THE EDGE. Giving the fork a
    // real card face grew it; the same change tried on the swap screen put a
    // 150px card in a 90px header and half of it ended up above the top of
    // the screen. Neither screen had anything watching for that.
    const fits = await J(() => {
      // MEASURE AGAINST THE SCREEN THAT IS ACTUALLY UP. The first pass took
      // #k-stage as the frame — which is hidden while a scene is showing, so
      // its rect is all zeroes and every element in the fork read as spilling.
      // Same trap as the Build 28 fit check: a hidden element measures to
      // nothing, and nothing is a very easy thing to be outside of.
      const spill = (root) => {
        const host = document.querySelector(root);
        if (!host || host.classList.contains('k-hidden')) return ['screen not up: ' + root];
        const st = host.getBoundingClientRect(), out = [];
        if (st.width < 10) return ['frame has no size: ' + root];
        document.querySelectorAll(root + ' *').forEach(e => {
          const r = e.getBoundingClientRect();
          if (r.width < 1 && r.height < 1) return;
          if (getComputedStyle(e).visibility === 'hidden') return;
          // DECORATIVE BLEED IS NOT A SPILL. The card's portrait is deliberately
          // larger than the plate it sits in — that is what a bust crop IS —
          // and its parent clips it. getBoundingClientRect reports the
          // unclipped box, so it looked like an overflow. Content still has to
          // fit; only aria-hidden decoration is allowed past the edge.
          if (e.getAttribute('aria-hidden') === 'true') return;
          if (r.left < st.left - 0.5 || r.right > st.right + 0.5
              || r.top < st.top - 0.5 || r.bottom > st.bottom + 0.5) {
            out.push((e.className || e.tagName) + ' @' + Math.round(r.top) + ',' + Math.round(r.left));
          }
        });
        return out;
      };
      window.R.resetProfile(); window.R.newRun(31);
      const o = window.R.wakeOffer().find(w => w.kind === 'plain');
      window.R.takeWake(o.id);
      window.R._set({ bonds: { 'ash|elin': 14, 'ash|mira': 0, 'elin|mira': 0 },
                      levels: { 'ash|elin': 0, 'ash|mira': 0, 'elin|mira': 0 } });
      window.R.openBondScene(); window.R.sceneSkip();
      const fork = spill('#k-scene');
      window.R.takeBond(0);
      const swap = spill('#k-swap');
      return { fork, swap };
    });
    check('FITS: nothing on the fork or the swap screen hangs off the edge of the stage',
      fits.fork.length === 0 && fits.swap.length === 0, JSON.stringify(fits));

    // WHICH PAIR "STILL CLOSE" MEANS IS A FACT ABOUT THE RUN. The first pass
    // decided it inside renderWake(), so taking the memory without drawing the
    // screen first — which is what the simulator and every test do — fell back
    // to a default pair, and the sim measured a boon the game does not offer.
    const pairing = await J(() => {
      window.R.resetProfile();
      window.R.newRun(9001);
      const drawn = window.R.wakePair();                 // the screen drew it
      // A RUN THAT NEVER DREW THE SCREEN — the simulator, and every test that
      // calls takeWake directly. Clearing the field puts the run back in the
      // state those callers are actually in.
      window.R._set({ wakePair: null });
      const bare = window.R.wakePair();
      window.R.newRun(9001);
      window.R._set({ wakePair: null });
      window.R.WAKES.find(w => w.id === 'close').apply(window.R.state());
      const bonds = window.R.state().bonds;
      const boosted = Object.keys(bonds).filter(k => bonds[k] > 0);
      // and a different seed is allowed to name a different pair
      window.R.newRun(9002); const other = window.R.wakePair();
      window.R.newRun(9001); const again = window.R.wakePair();
      return { drawn, bare, boosted, other, again };
    });
    check('CLOSE: the pair is decided by the run, not by whether the screen was drawn',
      pairing.bare === pairing.drawn && pairing.again === pairing.drawn
      && pairing.boosted.length === 1 && pairing.boosted[0] === pairing.drawn,
      JSON.stringify(pairing));

    // And a profile with nothing won must never offer it.
    const bare = await J(() => {
      window.R.resetProfile();
      window.R.newRun(31);
      return { ids: window.R.wakeOffer().map(w => w.id),
               kinds: window.R.wakeOffer().map(w => w.kind) };
    });
    check('HABIT: a first-ever run is never offered a card it has not won',
      bare.ids.indexOf('habit') < 0 && bare.ids.length === 3
      && bare.kinds.filter(k => k === 'trade').length === 1,
      JSON.stringify(bare));
  }

  const r = report();
  await H.browser.close();
  process.exit(r.passed === r.total && r.errs === 0 ? 0 : 1);
})();
