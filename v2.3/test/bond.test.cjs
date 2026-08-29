// KIZUNA v2.3 — the BONDS suite. The social layer: what two of them earn by
// fighting together, the scene it opens, the fork that is a card, and the
// slot somebody has to give up to carry it.
//
// The rule this whole build turns on: THE DECK NEVER GROWS. Five slots a hero,
// fifteen cards, always — so a card won is a card lost, and which of the two
// heroes pays is the player's decision.
'use strict';
const { boot } = require('./harness.cjs');

const RESUME_URL = 'http://127.0.0.1:8099/v2.3/index.html?test=1&road=1&resume=1';

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

  // ═══ A CARD OWED IS A CARD REMEMBERED ═══
  // Found by the soak on its third random run, on Build 59. A bond level and
  // the awakening both hand over a card and then ask which of five slots it
  // takes — and until now that card lived in a MODULE VARIABLE. Close the tab
  // on the swap screen and the card was simply gone: the whole payout of an
  // awakening, or of a bond arc, thrown away with no way to get it back and no
  // sign that anything had happened. The mark that comes with a bond level has
  // been re-asked on boot since Build 28; the card it arrives with never was.
  console.log('\n── a card owed ──');
  {
    // bank a won card so the awakening's card-granting memory can be offered
    await J(() => {
      localStorage.setItem('kizuna23.profile', JSON.stringify({ heard: [], won: ['shieldblade'] }));
    });
    await H.page.goto(RESUME_URL, { waitUntil: 'networkidle' });
    await H.page.waitForFunction(() => window.__ready === true, null, { timeout: 8000 });

    const seed = await J(() => {
      for (let s = 1; s <= 200; s++) {
        window.R.newRun(s);
        if (window.R.wakeOffer().some(w => w.id === 'habit')) return s;
      }
      return null;
    });
    const owed = await J((sd) => {
      window.R.newRun(sd);
      window.R.takeWake('habit');
      return { card: window.R.pendingCard(),
               onSwap: !document.getElementById('k-swap').classList.contains('k-hidden'),
               roster: JSON.parse(JSON.stringify(window.R.state().roster)) };
    }, seed);

    await H.page.goto(RESUME_URL, { waitUntil: 'networkidle' });
    await H.page.waitForFunction(() => window.__ready === true, null, { timeout: 8000 });
    await sleep(350);
    const kept = await J(() => ({
      card: window.R.pendingCard(),
      onSwap: !document.getElementById('k-swap').classList.contains('k-hidden'),
      screens: ['k-stage', 'k-map', 'k-camp', 'k-scene', 'k-swap', 'k-wake', 'k-mark']
        .filter(id => !document.getElementById(id).classList.contains('k-hidden')),
      slots: ['ash', 'elin', 'mira'].map(h => window.R.state().roster[h].length),
    }));
    check('OWED: a card won and not yet placed survives closing the tab — the swap is re-asked, not skipped',
      owed.onSwap && !!owed.card && kept.onSwap && kept.card === owed.card
      && kept.screens.length === 1 && kept.slots.every(n => n === 5),
      JSON.stringify({ owed: owed.card, kept: kept.card, screens: kept.screens }));

    // …and once it IS placed, the debt is gone: a reload must not re-ask for a
    // card the party is already carrying.
    const after = await J(() => {
      const first = document.querySelector('#k-swap-cols .k-swapcard');
      if (first) first.click();
      const go = document.getElementById('k-swap-go');
      if (go && !go.disabled) go.click();
      const r2 = window.R.state();
      return { owes: r2.pendingCard, carries: window.K.rosterIds(r2.roster) };
    });
    await H.page.goto(RESUME_URL, { waitUntil: 'networkidle' });
    await H.page.waitForFunction(() => window.__ready === true, null, { timeout: 8000 });
    await sleep(350);
    const settled = await J(() => ({
      owes: window.R.state().pendingCard,
      onSwap: !document.getElementById('k-swap').classList.contains('k-hidden'),
      carries: window.K.rosterIds(window.R.state().roster),
      slots: ['ash', 'elin', 'mira'].map(h => window.R.state().roster[h].length),
    }));
    check('OWED: once the card has a slot the debt is settled — a reload does not ask again',
      !after.owes && !settled.owes && !settled.onSwap
      && settled.carries.indexOf(owed.card) >= 0
      && settled.slots.every(n => n === 5) && new Set(settled.carries).size === 15,
      JSON.stringify({ owes: settled.owes, onSwap: settled.onSwap,
                       hasCard: settled.carries.indexOf(owed.card) >= 0 }));
  }

  // ═══ A CARD CANNOT BE WON TWICE ═══
  // Found by the soak on run 7 of 12, three screens after a reload — which is
  // what made it look like a persistence bug. It is not. BORROWED HABIT starts
  // a returning player already holding a card they won on an earlier road, and
  // every card in the profile came out of one of these very forks. So the fork
  // could offer it again, the swap put a second copy in the deck, and the
  // party quietly lost a card to make room for one they already had.
  console.log('\n── a card cannot be won twice ──');
  {
    const dup = await J(() => {
      // hold a card that one of the ash|mira forks offers, then walk into it
      window.R.resetProfile();
      window.R.newRun(11);
      const scene = window.R.BONDS['ash|mira'][0];
      const offered = scene.picks.map(p => p.card);
      const st = window.R.state();
      st.roster.mira = [offered[0]].concat(st.roster.mira.slice(1));
      window.R._set({ roster: st.roster, bonds: { 'ash|elin': 0, 'ash|mira': 99, 'elin|mira': 0 } });
      const opened = window.R.openBondScene();
      const sc = window.R.scene();
      return { offered, opened, picks: (sc && sc.picks || []).map(p => p.card),
               holds: window.K.rosterIds(window.R.state().roster).filter(id => id === offered[0]).length };
    });
    check('TWICE: a bond fork never offers a card the party already carries',
      dup.opened && dup.holds === 1 && dup.picks.indexOf(dup.offered[0]) < 0
      && dup.picks.length >= 1,
      JSON.stringify(dup));

    // …and taking whatever is left still leaves fifteen distinct cards.
    const after = await J(() => {
      const sc = window.R.scene();
      window.R.sceneSkip();
      window.R.takeBond(0);
      const first = document.querySelector('#k-swap-cols .k-swapcard');
      if (first) first.click();
      const go = document.getElementById('k-swap-go');
      if (go && !go.disabled) go.click();
      const ids = window.K.rosterIds(window.R.state().roster);
      return { took: sc.picks[0].card, n: ids.length, uniq: new Set(ids).size,
               slots: ['ash', 'elin', 'mira'].map(h => window.R.state().roster[h].length) };
    });
    check('TWICE: fifteen cards, fifteen names — the swap cannot put a second copy in the deck',
      after.n === 15 && after.uniq === 15 && after.slots.every(n => n === 5),
      JSON.stringify(after));

    // BOTH already carried: the conversation still happens and the level still
    // pays its mark. The scene is the story beat first.
    const both = await J(() => {
      window.R.resetProfile();
      window.R.newRun(11);
      const scene = window.R.BONDS['elin|mira'][0];
      const offered = scene.picks.map(p => p.card);
      const st = window.R.state();
      st.roster.mira = offered.concat(st.roster.mira.slice(offered.length));
      window.R._set({ roster: st.roster, bonds: { 'ash|elin': 0, 'ash|mira': 0, 'elin|mira': 99 } });
      const opened = window.R.openBondScene();
      const sc = window.R.scene();
      return { opened, offered, picks: (sc && sc.picks || []).map(p => p.card),
               lines: (sc && sc.picks || []).map(p => p.line),
               beats: (sc && sc.beats || []).length };
    });
    check('TWICE: when they already carry both, the scene still plays and simply hands nothing over',
      both.opened && both.beats > 0 && both.picks.length === 1 && both.picks[0] === null
      && /\S/.test(both.lines[0] || ''),
      JSON.stringify(both));

    const paid = await J(() => {
      const before = window.R.state().levels['elin|mira'];
      window.R.sceneSkip();
      window.R.takeBond(0);
      const st = window.R.state();
      const ids = window.K.rosterIds(st.roster);
      return { levelled: st.levels['elin|mira'] > before,
               owes: st.pendingCard, sigil: st.pendingSigil,
               screen: ['k-stage', 'k-map', 'k-camp', 'k-scene', 'k-swap', 'k-wake', 'k-mark']
                 .filter(id => !document.getElementById(id).classList.contains('k-hidden')),
               n: ids.length, uniq: new Set(ids).size };
    });
    check('TWICE: …and the level still lands and still pays its mark, with no card owed',
      paid.levelled && !paid.owes && paid.n === 15 && paid.uniq === 15
      && paid.screen.length === 1,
      JSON.stringify(paid));
  }

  // ═══ THE RECKONING ═══
  // The beat after a fight, and the thing that makes it not a loading screen
  // with dialogue on it: every reckoning is selected by a deed the ENGINE
  // measured. A reckoning that cannot point at something that happened does
  // not get to speak.
  console.log('\n── the reckoning ──');
  {
    const deedsOf = (patch) => Object.assign({
      finisher: null, lastHit: null, shields: [], stitches: {},
      brink: [], fell: [], asOne: 0, untouched: false }, patch || {});

    const picked = await J((D) => {
      const live = ['ash', 'elin', 'mira'];
      const of = (d) => { const p = window.R.pickReckoning(d, live); return p ? { id: p.r.id, cast: p.cast } : null; };
      return {
        // a shield that actually took a blow outranks everything general
        shield: of(Object.assign({}, D, { shields: [{ by: 'elin', for: 'mira' }], asOne: 1 })),
        // the finisher and somebody who was on the brink
        last: of(Object.assign({}, D, { finisher: 'ash', brink: ['mira'], asOne: 1 })),
        // a pair that moved off each other twice or more
        opening: of(Object.assign({}, D, { stitches: { 'ash|elin': 3 }, asOne: 1 })),
        // one stitch is not a habit, so it must NOT select the opening scene
        oneStitch: of(Object.assign({}, D, { stitches: { 'ash|elin': 1 } })),
        // nothing happened worth naming — the plainest one still speaks
        bare: of(Object.assign({}, D, {})),
      };
    }, deedsOf());
    check('RECK: the reckoning is chosen by a deed — the sharpest thing the fight actually did',
      picked.shield && picked.shield.id === 'infront' && picked.shield.cast.join() === 'elin,mira'
      && picked.last && picked.last.id === 'lastblow' && picked.last.cast.join() === 'ash,mira'
      && picked.opening && picked.opening.id === 'opening' && picked.opening.cast.join() === 'ash,elin',
      JSON.stringify(picked));
    check('RECK: …and a deed that did not happen cannot select its scene — one stitch is not a habit',
      picked.oneStitch && picked.oneStitch.id !== 'opening'
      && picked.bare && picked.bare.id === 'down',
      JSON.stringify({ oneStitch: picked.oneStitch, bare: picked.bare }));

    // THE TWO IN THE SHOT ARE THE TWO THE DEED NAMES — and the shot is the
    // BOARD. Build 66 moved the reckoning onto the stage: the foe on the
    // ground where it fell, the party in the lanes it fought from, the hand
    // and the HUD standing down. Cutting to a letterboxed set meant that the
    // instant you killed something you were somewhere else.
    const shot = await J(() => {
      window.R.resetProfile();
      window.R.newRun(41);
      window.K.startCombat({ seed: 3 });          // a board to stand on
      window.R.screen('combat');
      const opened = window.R.openReckoning({ foe: 'husk', deeds: {
        finisher: 'mira', lastHit: 'mira', shields: [{ by: 'elin', for: 'ash' }],
        stitches: {}, brink: [], fell: [], asOne: 0, untouched: false } });
      const rk = window.R.reckoning();
      const stage = document.getElementById('k-stage');
      const dim = (id) => +getComputedStyle(document.getElementById(id)).opacity;
      return { opened, id: rk && rk.id, cast: rk && rk.cast,
               onStage: stage.classList.contains('k-reckoning'),
               stageUp: !stage.classList.contains('k-hidden'),
               sceneUp: !document.getElementById('k-scene').classList.contains('k-hidden'),
               lit: [...document.querySelectorAll('.k-hero.k-reck-in')].map(f => f.dataset.hero).sort(),
               dark: [...document.querySelectorAll('.k-hero.k-reck-out')].map(f => f.dataset.hero),
               plate: !document.getElementById('k-reck-plate').classList.contains('k-hidden'),
               line: (document.getElementById('k-reck-line').textContent || '').length,
               hand: dim('k-hand'), hud: dim('k-boss-hud'), ap: dim('k-ap') };
    });
    check('RECK: it happens on the BOARD — the party in their lanes, the hand and the HUD stood down',
      shot.opened && shot.onStage && shot.stageUp && !shot.sceneUp
      && shot.lit.join() === 'ash,elin' && shot.dark.join() === 'mira'
      && shot.plate && shot.line > 20
      && shot.hand === 0 && shot.hud === 0 && shot.ap === 0,
      JSON.stringify(shot));

    // …and the thing it is standing over is on the ground — DRIVEN, not
    // assumed. Reading the foe without running the fall first reported
    // opacity 1 and passed for the wrong reason.
    const body = await J(async () => {
      window.K.fxFoeDown();
      const b = document.getElementById('k-boss-art');
      const mid = +getComputedStyle(b).opacity;
      await new Promise(r => setTimeout(r, 1700));      // let the fall finish
      const cs = getComputedStyle(b);
      const r2 = b.getBoundingClientRect();
      return { down: b.classList.contains('k-foe-down'), mid,
               shown: cs.display !== 'none' && cs.visibility !== 'hidden',
               // it was measurably present at 0.42 — box, display and
               // visibility all fine — and completely invisible against this
               // backdrop's pale sky, which is the one thing the whole beat
               // stands over. Presence is not the same as being seen.
               op: +cs.opacity, w: Math.round(r2.width), h: Math.round(r2.height) };
    });
    check('RECK: …over a body that is still visibly there, not a faded-out sprite',
      body.down && body.shown && body.op >= 0.6 && body.w > 40 && body.h > 40,
      JSON.stringify(body));

    // THE FORK IS THE EXIT, and it pays exactly what its chip says.
    const held = await J(() => {
      for (let i = 0; i < 12; i++) window.R.reckNext();
      return { still: !!window.R.reckoning(),
               forks: document.querySelectorAll('.k-rk-opt').length,
               plateGone: document.getElementById('k-reck-plate').classList.contains('k-hidden') };
    });
    check('RECK: it ends on its fork and waits there — no amount of tapping answers it for you',
      held.still && held.forks === 2 && held.plateGone, JSON.stringify(held));

    const paidBond = await J(() => {
      const b = JSON.parse(JSON.stringify(window.R.state().bonds));
      const kz = window.R.state().kizuna;
      document.querySelectorAll('.k-rk-opt')[0].click();
      const a = window.R.state();
      const moved = Object.keys(a.bonds).filter(k => a.bonds[k] !== b[k])
        .map(k => k + ':+' + (a.bonds[k] - b[k]));
      return { moved, kz: [kz, a.kizuna],
               onMap: !document.getElementById('k-map').classList.contains('k-hidden'),
               // the board is handed back clean: no lit heroes, no fallen foe,
               // no reckoning class left behind for the next fight to inherit
               stageClean: !document.getElementById('k-stage').classList.contains('k-reckoning'),
               litLeft: document.querySelectorAll('.k-hero.k-reck-in, .k-hero.k-reck-out').length,
               bodyLeft: document.getElementById('k-boss-art').classList.contains('k-foe-down'),
               reckGone: !window.R.reckoning(),
               flash: a.flash };
    });
    check('RECK: the answer that deepens a pair deepens THAT pair, and hands the board back clean',
      paidBond.moved.length === 1 && paidBond.moved[0] === 'ash|elin:+6'
      && paidBond.kz[0] === paidBond.kz[1] && paidBond.onMap
      && paidBond.stageClean && paidBond.litLeft === 0 && !paidBond.bodyLeft
      && paidBond.reckGone && !!paidBond.flash,
      JSON.stringify(paidBond));

    const paidKz = await J(() => {
      window.R.newRun(41);
      window.K.startCombat({ seed: 3 });
      window.R.screen('combat');
      window.R._set({ kizuna: 10 });
      window.R.openReckoning({ foe: 'wraith', deeds: {
        finisher: 'ash', lastHit: 'ash', shields: [], stitches: {},
        brink: ['elin'], fell: [], asOne: 0, untouched: false } });
      for (let i = 0; i < 12; i++) window.R.reckNext();
      const b = JSON.parse(JSON.stringify(window.R.state().bonds));
      const kz = window.R.state().kizuna;
      document.querySelectorAll('.k-rk-opt')[1].click();
      const a = window.R.state();
      return { bondsMoved: Object.keys(a.bonds).filter(k => a.bonds[k] !== b[k]).length,
               kz: [kz, a.kizuna] };
    });
    check('RECK: …and the answer that keeps the momentum pays kizuna instead, moving no bond',
      paidKz.bondsMoved === 0 && paidKz.kz[1] === paidKz.kz[0] + 22,
      JSON.stringify(paidKz));

    // THE REGENT DOES NOT GET ONE. The descent ending is its own beat and a
    // conversation over her body would step on it.
    const regent = await J(() => {
      window.R.newRun(41);
      window.K.startCombat({ seed: 3 });
      window.R.screen('combat');
      window.R._set({ over: 'win' });
      const opened = window.R.openReckoning({ foe: 'mourner', deeds: {
        finisher: 'ash', lastHit: 'ash', shields: [{ by: 'elin', for: 'mira' }],
        stitches: {}, brink: [], fell: [], asOne: 2, untouched: false } });
      return { opened, up: !!window.R.reckoning() };
    });
    check('RECK: the Regent gets no reckoning — the end of the descent is its own beat',
      regent.opened === false && regent.up === false, JSON.stringify(regent));

    // …and with no board to stand on there is no reckoning either, rather than
    // a conversation floating over whatever screen happens to be up.
    const noBoard = await J(() => {
      window.R.newRun(41);
      window.R.screen('map');
      const opened = window.R.openReckoning({ foe: 'husk', deeds: {
        finisher: 'mira', lastHit: 'mira', shields: [{ by: 'elin', for: 'ash' }],
        stitches: {}, brink: [], fell: [], asOne: 0, untouched: false } });
      return { opened, up: !!window.R.reckoning() };
    });
    check('RECK: with no board to stand on, it does not open at all',
      noBoard.opened === false && noBoard.up === false, JSON.stringify(noBoard));
  }

  const r = report();
  await H.browser.close();
  process.exit(r.passed === r.total && r.errs === 0 ? 0 : 1);
})();
