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
  // …AND THE ROAD IS WHERE A CONVERSATION HAPPENS (Build 106). `_set` writes
  // the run and paints the map directly; `toMap` is the seam that asks whether
  // anything is owed. A walk that skipped it would never meet a bond scene at
  // all, because a node no longer opens one.
  const atCamp = (patch) => J((p) => {
    const camp = window.R.map().find(n => n.kind === 'camp');
    const prev = window.R.map().find(m => m.col === camp.col - 1 && m.to.indexOf(camp.id) >= 0);
    window.R._set(Object.assign({ at: prev.id, path: [prev.id], stop: prev.col + 1 }, p || {}));
    window.R.toMap();
    return camp.id;
  }, patch);
  // once the road has had its say, the stop the walk was aiming at
  const goCamp = (id) => J((c) => { window.R.travel(c); return true; }, id);

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

    // A PAIR OVER THE THRESHOLD IS HEARD ON THE ROAD (Build 106), before the
    // player has chosen where to go next — not on arrival at whatever stop they
    // chose. It used to fire in the doorway, which meant picking a fight and
    // then being handed a conversation, a fork and a card-swap screen before
    // the fight began: the same "upgrade prompt before a fight" the mark debt
    // was moved off this seam for at Build 103.
    const opened = await atCamp({ bonds: { 'ash|mira': 20, 'ash|elin': 0, 'elin|mira': 0 }, embers: 6, tier: 2 });
    await sleep(420);
    const at = await J(() => ({
      scene: !document.getElementById('k-scene').classList.contains('k-hidden'),
      camp: !document.getElementById('k-camp').classList.contains('k-hidden'),
      map: !document.getElementById('k-map').classList.contains('k-hidden'),
      cast: document.querySelectorAll('#k-scene-cast .k-sc-fig').length,
      title: document.getElementById('k-scene-title').textContent,
    }));
    check('SCENE: a pair that crossed a level is heard on the road — not in the doorway of the next stop',
      at.scene && !at.camp && !at.map && at.cast === 2, JSON.stringify(at));
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
                       empty: !!document.querySelector('.k-swt-back'),
                       chip: (document.getElementById('k-swap-new') || {}).innerHTML };
      document.querySelector('#k-swap-cols .k-swapcard').click();
      const box = document.querySelector('.k-swt-face .k-card').getBoundingClientRect();
      return { before, afterFaces: face(),
               afterEmpty: !!document.querySelector('.k-swt-back'),
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

    // A BOND LEVEL PAYS TWICE — AND THE TWO HALVES ARE A LEG OF THE ROAD APART.
    //
    // WHAT MOVED at Build 100: the scene, the fork, the swap and the marking
    // screen arrived back to back, four screens deep before the stop the player
    // had chosen began. WHAT MOVED at Build 106: the conversation itself came
    // off the node too, so all of this happens on the ROAD — and the road spends
    // ONE screen per leg, or the queue would simply empty in a different place.
    // So the trade hands back to the CHART with the mark on the books.
    const owed = await J(() => {
      const up = (id) => !document.getElementById(id).classList.contains('k-hidden');
      const r = window.R.state();
      return { onMark: up('k-mark'), onMap: up('k-map'), onCamp: up('k-camp'),
               pending: r.pendingSigil, pair: r.markPair,
               want: window.R.sigilFor('ash|mira', 1) };
    });
    check('MARK: a level leaves the mark OWED — one leg of the road, one conversation',
      !owed.onMark && owed.onMap && !owed.onCamp
      && owed.pending === owed.want && owed.pair === 'ash|mira',
      JSON.stringify(owed));

    // …AND THE STOP THE PLAYER THEN CHOOSES OPENS ON ITS OWN BUSINESS. This is
    // the whole point of moving the conversation: the doorway is empty.
    // (the fire this road carries — named here rather than carried in from the
    // block above, where `opened` belongs to a different walk)
    await J(() => { window.R.travel(window.R.map().find(n => n.kind === 'camp').id); });
    await sleep(460);
    const doorway0 = await J(() => {
      const up = (id) => !document.getElementById(id).classList.contains('k-hidden');
      return { camp: up('k-camp'), scene: up('k-scene'), swap: up('k-swap'), mark: up('k-mark') };
    });
    check('MARK: the fire opens as the fire — nothing is queued in the doorway of a stop',
      doorway0.camp && !doorway0.scene && !doorway0.swap && !doorway0.mark,
      JSON.stringify(doorway0));

    // …AND IT IS PAID BACK ON THE ROAD, NOT IN THE NEXT DOORWAY.
    //
    // WHAT MOVED at Build 103: the debt used to be settled on ARRIVAL at the
    // next stop, which meant the last screen between choosing a fight and
    // fighting it was a quiet card-upgrade prompt — a deliberative decision
    // wedged into the one beat of the loop where the player is leaning forward.
    // Leaving the fire is what settles it now: they are standing on the chart
    // with nothing yet committed to, which is the beat that is already for
    // thinking. Driven through the road's own door rather than by calling
    // openMark, because "returning to the road settles it" is the whole claim.
    await J(() => { window.R.leaveCamp(); });
    await sleep(420);
    const marking = await J(() => {
      const up = (id) => !document.getElementById(id).classList.contains('k-hidden');
      // TWO BEATS (Build 104). The screen opens on the MOMENT — the two of them
      // and the mark burning between them — and hands over to the decision. So
      // the walk answers the moment before it can be asked which card.
      // …AND THE MOMENT ENDS ON A FORK (Build 110). A mark used to be handed
      // over — the player chose the card and never which mark it was, which
      // made the run's most build-defining system a delivery schedule. Beat one
      // offers two, and taking one is what opens the cards.
      const forks = [...document.querySelectorAll('#k-mark-fork .k-mkf')];
      const beat1 = { beat: window.R.markBeat(),
                      cards: document.querySelectorAll('#k-mark-cols .k-mk').length,
                      forks: forks.length,
                      offered: forks.map(f => (f.querySelector('b') || {}).textContent),
                      cast: document.querySelectorAll('#k-mark-cast .k-mkc-fig').length };
      // take the SECOND, so a fall-through to the default cannot pass by luck
      forks[forks.length - 1].click();
      const took = window.R.state().pendingSigil;
      const cards = [...document.querySelectorAll('#k-mark-cols .k-mk')];
      // The mark is decided by the pair and the level — ash|mira level 1 —
      // so the screen's title is checked against the map, not a literal.
      const want = window.R.sigilFor('ash|mira', 1);
      return { beat1, beat2: window.R.markBeat(), took,
               onMark: up('k-mark'), onStage: up('k-stage'), onMap: up('k-map'),
               want, wantName: window.K.SIGILS[want].name.toUpperCase(),
               pending: window.R.state().pendingSigil,
               title: (document.getElementById('k-mark-title') || {}).textContent,
               line: ((document.getElementById('k-mark-line') || {}).textContent || '').length,
               // WHAT KIND OF THING THIS IS. The screen opened on a mark's NAME
               // and what that mark does, and never said what a mark IS — so a
               // player met the rule without being told what was happening to
               // them, or that it was permanent.
               kind: ((document.getElementById('k-mark-kind') || {}).textContent || ''),
               offered: cards.length,
               named: cards.filter(c => (c.querySelector('.k-sw-body b') || {}).textContent).length,
               said: cards.filter(c => ((c.querySelector('.k-sw-body em') || {}).textContent || '').length > 3).length,
               // nothing is drawn as a face until one is picked up
               facesIdle: document.querySelectorAll('#k-mark-cols .k-mkp-face').length,
               backs: document.querySelectorAll('#k-mark-cols .k-mkp-back').length };
    });
    check('MARK: the debt is settled back on the road — never in the doorway of the next stop',
      marking.onMark && !marking.onStage && !marking.onMap && marking.pending
      // WHAT THE LEVEL OWES IS NOW A FORK, so the title has to match what was
      // TAKEN rather than what the table lists first — asserting the default
      // here would assert the absence of the choice this build added.
      && marking.pending === marking.took
      && marking.title === marking.took.toUpperCase()
      && marking.line > 10,
      JSON.stringify(marking));
    check('MARK: the screen opens on the moment — the two of them, and a fork of two marks',
      marking.beat1.beat === 1 && marking.beat1.cards === 0
      && marking.beat1.forks === 2 && marking.beat1.cast === 2 && marking.beat2 === 2
      && marking.beat1.offered.every(n => /\S/.test(n || '')),
      JSON.stringify(marking.beat1));
    // WHICH MARK IS THE PLAYER'S, and taking the second has to actually take it
    check('MARK: the fork is a real choice — taking the second is the mark the run learns',
      marking.took === marking.beat1.offered[1].toLowerCase()
      && marking.pending === marking.took,
      JSON.stringify({ offered: marking.beat1.offered, took: marking.took,
                       pending: marking.pending })); 
    // TEN CARDS SCANNABLE, ONE READABLE — the trade screen's split, because it
    // is the trade screen's question. Ten faces shrunk to 62% and stacked five
    // to a half-width column was neither.
    check('MARK: all ten are offered as rows that say what they do, under a line saying what a mark IS',
      marking.offered === 10 && marking.named === 10 && marking.said === 10
      && marking.facesIdle === 0 && marking.backs === 2
      && /MARK/.test(marking.kind) && /REST OF THE RUN/.test(marking.kind),
      JSON.stringify({ offered: marking.offered, named: marking.named, said: marking.said,
                       facesIdle: marking.facesIdle, backs: marking.backs, kind: marking.kind }));

    // NOTHING MAY BE TOO SMALL TO READ, OR FALL OFF THE BOTTOM. The screen this
    // replaces printed each card's note ACROSS the card it described, scaled all
    // ten faces to 62%, and hung the row seven pixels past the bottom edge of a
    // container with `overflow: hidden`.
    await sleep(700);
    const picked = await J(() => {
      const box = document.getElementById('k-mark').getBoundingClientRect();
      const first = document.querySelector('#k-mark-cols .k-mk:not([disabled])');
      const id = first.dataset.id;
      first.click();                       // the first tap picks it up, and only that
      const faces = [...document.querySelectorAll('#k-mark-cols .k-mkp-face')];
      const rows = [...document.querySelectorAll('#k-mark-cols .k-mk')];
      const spill = [...document.querySelectorAll('#k-mark *')].filter(e => {
        const r = e.getBoundingClientRect();
        return r.width && (r.bottom > box.bottom + 1 || r.right > box.right + 1
                        || r.left < box.left - 1);
      }).length;
      const place = document.getElementById('k-mark-place');
      return { id, held: window.R.markHeld(), spent: !!window.R.state().sigils[id],
               on: !!document.querySelector('#k-mark-cols .k-mk.k-mk-on'),
               faces: faces.length,
               faceW: faces[0] ? Math.round(faces[0].getBoundingClientRect().width) : 0,
               rowPx: rows[0]
                 ? +parseFloat(getComputedStyle(rows[0].querySelector('.k-sw-body b')).fontSize).toFixed(1)
                 : 0,
               placeOff: place.disabled, placeSays: place.textContent, spill };
    });
    check('MARK: the first tap picks a card up and draws it twice — as it is, and as it would be',
      picked.held === picked.id && !picked.spent && picked.on
      && picked.faces === 2 && picked.faceW >= 96 && picked.placeOff === false,
      JSON.stringify(picked));
    check('MARK: every row is legible and nothing hangs off the screen',
      picked.rowPx >= 11 && picked.spill === 0, JSON.stringify(picked));

    const placed = await J(() => {
      const id = window.R.markHeld();
      document.getElementById('k-mark-place').click();
      const r = window.R.state();
      const up = (x) => !document.getElementById(x).classList.contains('k-hidden');
      const all = window.K.rosterIds(r.roster);
      return { id, sigil: r.sigils[id], pending: r.pendingSigil,
               onStage: up('k-stage'), onMark: up('k-mark'), onMap: up('k-map'),
               marks: Object.keys(r.sigils).length,
               owned: all.indexOf(id) >= 0,
               sizes: [r.roster.ash.length, r.roster.elin.length, r.roster.mira.length],
               uniq: new Set(all).size };
    });
    check('MARK: placing it marks exactly one card the party carries, and spends the grant',
      placed.sigil && placed.pending == null && placed.marks === 1 && placed.owned
      && placed.sizes.every(n => n === 5) && placed.uniq === 15,
      JSON.stringify(placed));

    // …AND PLACING IT HANDS THE ROAD BACK, with the next stop still unchosen —
    // and travelling to it then opens THAT STOP, with no screen in front of it.
    const back = await J(() => ({
      map: !document.getElementById('k-map').classList.contains('k-hidden'),
      mark: !document.getElementById('k-mark').classList.contains('k-hidden'),
      swap: !document.getElementById('k-swap').classList.contains('k-hidden'),
    }));
    check('MARK: answering it hands the road back — the chart, with nothing yet chosen',
      back.map && !back.mark && !back.swap, JSON.stringify(back));
    await J(() => { window.R.travel(window.R.reachable()[0]); });
    await sleep(620);
    const doorway = await J(() => ({
      stage: !document.getElementById('k-stage').classList.contains('k-hidden'),
      mark: !document.getElementById('k-mark').classList.contains('k-hidden'),
    }));
    check('MARK: and the stop the player chose is the only thing waiting at the end of the walk',
      doorway.stage && !doorway.mark, JSON.stringify(doorway));

    // WHAT MOVED at Build 69: two levels crossed on one road used to be two
    // scenes BACK TO BACK AT THE SAME FIRE. That was the campfire overload —
    // two conversations, each asking you to give up a card and then mark
    // another, and only then the tree. A bond fires where it is earned now, one
    // per stop, so two levels is two scenes at TWO stops. The rule the check is
    // really about never moved: each level runs its full scene → fork → swap →
    // mark, marks exactly one card, and the party still carries 5/5/5.
    await reset(11);
    await atCamp({ bonds: { 'ash|mira': 40, 'ash|elin': 0, 'elin|mira': 0 }, embers: 6, tier: 2 });
    await sleep(460);
    // ONE STOP, ONE EVENT. The scene, its fork and the trade are this stop's
    // business; the mark is OWED and arrives at the next arrival, so this walks
    // a stop and then reports what it left on the books rather than clicking
    // through a second screen that is no longer there.
    const runOne = () => J(() => {
      const out = {};
      out.title = document.getElementById('k-scene-title').textContent;
      window.R.sceneSkip(); window.R.takeBond(0);
      document.querySelector('#k-swap-cols .k-swapcard').click();
      document.getElementById('k-swap-go').click();
      out.markNow = !document.getElementById('k-mark').classList.contains('k-hidden');
      out.owed = window.R.state().pendingSigil;
      return out;
    });
    // …and paying a debt back on the road is how it is settled.
    const payDebt = () => J(() => {
      const on = !document.getElementById('k-mark').classList.contains('k-hidden');
      if (!on) return false;
      // the moment, which ends on a fork
      const f0 = document.querySelector('#k-mark-fork .k-mkf');
      if (f0) f0.click();
      const btn = document.querySelector('#k-mark-cols .k-mk:not([disabled])');
      if (btn) btn.click();                                  // pick it up
      document.getElementById('k-mark-place').click();       // and mark it
      return on;
    });
    // A LEG OF THE ROAD IS A CONVERSATION AND THE STOP IS THE STOP. The walk
    // has to move to see the second one: a leg out, a stop, a leg back.
    const leg = async () => {
      // resolve wherever we are and step to the next stop, then hand the road
      // back the way a finished stop does
      await J(() => { const r = window.R.reachable(); if (r.length) window.R.travel(r[0]); });
      await sleep(420);
      await J(() => window.R.toMap());
      await sleep(420);
    };
    const first = await runOne();
    await sleep(360);
    // …and the CHART is what it hands back to, with nothing else stacked on it
    const atChart = await J(() => ({
      map: !document.getElementById('k-map').classList.contains('k-hidden'),
      scene: !document.getElementById('k-scene').classList.contains('k-hidden'),
      mark: !document.getElementById('k-mark').classList.contains('k-hidden'),
    }));
    check('TRADE: the conversation hands back to the chart — one leg of the road, one screen',
      atChart.map && !atChart.scene && !atChart.mark, JSON.stringify(atChart));

    // the next leg pays the debt the first one left on the books
    await leg();
    const paidFirst = await payDebt();
    await sleep(460);
    // …and the leg after that opens the level still owed
    await leg();
    const opened = await J(() => !document.getElementById('k-scene').classList.contains('k-hidden'));
    const second = opened ? await runOne() : { title: null, markNow: false, owed: null };
    await sleep(360);
    await leg();
    const paidSecond = await payDebt();
    await sleep(360);
    const chain = await J(() => {
      const r = window.R.state();
      return { sigils: Object.keys(r.sigils).length, pending: r.pendingSigil,
               level: r.levels['ash|mira'],
               sizes: ['ash', 'elin', 'mira'].map(h => r.roster[h].length),
               uniq: new Set(window.K.rosterIds(r.roster)).size };
    });
    check('MARK: each level marks one card, and neither mark rides on the leg that earned it',
      paidFirst && paidSecond && !first.markNow && !second.markNow
      && !!first.owed && !!second.owed
      && chain.sigils === 2 && chain.pending == null,
      JSON.stringify({ paid: [paidFirst, paidSecond], sameLeg: [first.markNow, second.markNow],
                       owed: [first.owed, second.owed], sigils: chain.sigils, pending: chain.pending }));
    check('TRADE: two levels crossed on one road is two conversations on TWO legs, and still 5/5/5',
      opened && first.title !== second.title && chain.level === 2
      && chain.sizes.every(n => n === 5) && chain.uniq === 15,
      JSON.stringify({ titles: [first.title, second.title], opened, ...chain }));

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
          // ARIA-HIDDEN IS INHERITED. The carve-out only asked the element
          // itself, so decoration nested inside an aria-hidden container — the
          // memory splash's overscanned still, which its parent clips — was
          // reported as spilling off the stage. Nothing inside an aria-hidden
          // subtree is content; ask the subtree.
          if (e.closest('[aria-hidden="true"]')) return;
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
    await H.pastTitle();      // a fresh load lands on the title; CONTINUE is the door

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
    await H.pastTitle();      // a fresh load lands on the title; CONTINUE is the door
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
    await H.pastTitle();      // a fresh load lands on the title; CONTINUE is the door
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
    // The swap is what must not open — there is no card to trade. Where the
    // chain hands back to is a separate question, and this scene was opened
    // without a stop under it, so it hands back to the ROAD — which since
    // Build 103 is exactly where a mark debt is settled. Asserting "not the
    // marking screen" here would have been asserting the absence of the
    // behaviour the build added.
    check('TWICE: …and the level still lands and still owes its mark, with no card owed',
      paid.levelled && !paid.owes && !!paid.sigil && paid.n === 15 && paid.uniq === 15
      && paid.screen.length === 1 && paid.screen.indexOf('k-swap') < 0,
      JSON.stringify(paid));
  }


  // ═══ THE SECOND DOOR ═══
  // A card won at a fork had exactly one way into the run: push one of
  // somebody's five out. But a displaced card has gone to the BENCH since
  // Build 69 and the deck screen can bring it back — so "carry it now" and
  // "keep it for later" are both real answers, and forcing the trade made a
  // player break a five they liked to accept a card they might not want for
  // another three stops. That is not a decision, it is a toll.
  console.log('\n── carry it, or set it down ──');
  {
    await reset(11);
    await atCamp({ bonds: { 'ash|mira': 40, 'ash|elin': 0, 'elin|mira': 0 } });
    await sleep(460);
    const offered = await J(() => {
      window.R.sceneSkip(); window.R.takeBond(0);
      const go = document.getElementById('k-swap-go');
      const bn = document.getElementById('k-swap-bench');
      return { onSwap: !document.getElementById('k-swap').classList.contains('k-hidden'),
               card: window.R.pendingCard(),
               // THE TRADE ASKS FOR A PICK; THE BENCH NEVER DOES. Setting a
               // card down is the answer that is available before anything has
               // been chosen, which is exactly its weight.
               tradeDisabled: go.disabled, benchDisabled: bn.disabled,
               tradeSays: go.textContent, benchSays: bn.textContent,
               ask: document.getElementById('k-swap-ask').textContent };
    });
    check('BENCH: the trade screen offers two doors, and only the trade waits on a pick',
      offered.onSwap && offered.tradeDisabled && !offered.benchDisabled
      && /PICK A CARD/.test(offered.tradeSays) && /SET/.test(offered.benchSays)
      && !/WHO STEPS OUT/.test(offered.ask),
      JSON.stringify(offered));

    const set = await J(() => {
      document.getElementById('k-swap-bench').click();
      const r = window.R.state();
      const ids = window.K.rosterIds(r.roster);
      return { bench: JSON.parse(JSON.stringify(window.R.bench())),
               owes: r.pendingCard,
               sizes: ['ash', 'elin', 'mira'].map(h => r.roster[h].length),
               n: ids.length, uniq: new Set(ids).size,
               carries: ids.indexOf(window.R.state().pendingCard || '') >= 0,
               // the level is still a level: the mark is still owed
               sigil: r.pendingSigil, level: r.levels['ash|mira'] };
    });
    const benched = Object.keys(set.bench).reduce((a, h) => a.concat(set.bench[h]), []);
    check('BENCH: setting it down takes the card and takes nobody’s slot',
      benched.indexOf(offered.card) >= 0 && !set.owes
      && set.sizes.every(n => n === 5) && set.n === 15 && set.uniq === 15,
      JSON.stringify({ benched, sizes: set.sizes, owes: set.owes }));
    check('BENCH: …and it is still a bond level — the mark is owed either way',
      set.level === 1 && !!set.sigil, JSON.stringify({ level: set.level, sigil: set.sigil }));

    // THE CARD IS WON, NOT DEFERRED. It is in the profile the moment the fork
    // is answered, so a run that ends does not un-win it — and the deck screen
    // is a real door onto it rather than a promise.
    const later = await J((id) => {
      const r = window.R.state();
      const hero = (window.K.pairOf(id) || ['ash'])[0];
      return { won: window.R.profile().won.indexOf(id) >= 0,
               offeredBack: window.R.benchFor(hero).indexOf(id) >= 0,
               hero };
    }, offered.card);
    check('BENCH: the card is won and the deck screen can pick it up whenever they want it',
      later.won && later.offeredBack, JSON.stringify(later));

    // AND IT CANNOT BE BENCHED TWICE. The same duplicate rule the trade
    // enforces, at the same door: fifteen cards, fifteen names.
    const dup = await J((id) => {
      const r = window.R.state();
      r.roster.ash = [id].concat(r.roster.ash.slice(1));
      window.R._set({ roster: r.roster });
      window.R.openDeck(); window.R.closeDeck();
      const ids = window.K.rosterIds(window.R.state().roster);
      return { n: ids.length, uniq: new Set(ids).size,
               benchStillHas: window.R.benchFor('ash').indexOf(id) >= 0 };
    }, offered.card);
    check('BENCH: a card being carried is not also offered off the bench',
      dup.n === 15 && dup.uniq === 15 && !dup.benchStillHas, JSON.stringify(dup));
  }

  // ═══ THE RECALLS ═══
  // Build 98. The bond scenes were the game's only developing half, and the
  // one thing that could open one was two heroes fighting well together. A
  // party could travel the whole road, put down a thing it had never met and
  // answer a crossroads at a real cost, and develop NOTHING — the journey was
  // scenery with a fight in it.
  //
  // A recall is that beat with a different key: the ROAD sets it off, one
  // person remembers, and the fork is a card the same way a bond's fork is.
  // Everything past the fork is the machinery a bond already built, which is
  // exactly why these checks are here rather than in a suite of their own.
  console.log('\n── the recalls ──');
  {
    // THE TABLE STATES ITS OWN SHAPE. Nothing below names a memory, a card or
    // a threshold: a fifth recall, a re-tuned `when` or a swapped card is a
    // change these checks follow rather than a change they fail.
    const T = await J(() => window.R.RECALLS.map(r => ({
      id: r.id, who: r.who, title: r.title,
      beats: (r.beats || []).length,
      ask: r.ask, cards: r.picks.map(p => p.card),
      lines: r.picks.map(p => p.line) })));

    check('RECALL: every memory is one person remembering, with beats, a question and two cards',
      T.length >= 3
      && T.every(r => ['ash', 'elin', 'mira'].indexOf(r.who) >= 0)
      && T.every(r => r.beats >= 3 && /\S/.test(r.title) && /\S/.test(r.ask))
      && T.every(r => r.cards.length === 2 && r.lines.every(l => /\S/.test(l)))
      && new Set(T.map(r => r.id)).size === T.length,
      JSON.stringify(T.map(r => r.id + ':' + r.who + ':' + r.beats)));

    // A MEMORY BELONGS TO THE PERSON HAVING IT — and since Build 110 that is
    // literal: a recall hands over a card the rememberer owns ALONE.
    //
    // WHAT MOVED: both card-doors drew from the same twelve BOND cards, so the
    // road's entire card pool was one flavour and "one person remembering their
    // own trick" handed over something owned by two people. The two doors mean
    // different things now — a bond scene gives what two of them learn
    // together, a recall gives what one of them already knew — and it un-parks
    // the six solo cards the 3/1/1 deck displaced, which were painted, defined,
    // upgraded and unreachable.
    const owned = await J(() => window.R.RECALLS.map(r => ({
      id: r.id, who: r.who,
      owners: r.picks.map(p => window.K.CARD_DEFS[p.card].owner) })));
    check('RECALL: every card a memory offers is one the rememberer owns alone',
      owned.every(r => r.owners.every(o => o === r.who)),
      JSON.stringify(owned));
    // …and between them the memories reach every card the opening fifteen left
    // behind, or those cards are in the game and out of the player's reach
    const reach = await J(() => {
      const K = window.K, D = K.CARD_DEFS;
      const base = new Set(K.rosterIds(K.baseRoster()).map(id => D[id].sameAs || id));
      const parked = Object.keys(D).filter(id => !D[id].sameAs && !base.has(id)
        && K.BOND_IDS.indexOf(id) < 0 && id !== 'lightsteel');
      const offered = new Set(window.R.RECALLS.flatMap(r => r.picks.map(p => p.card)));
      return { parked, missed: parked.filter(id => !offered.has(id)) };
    });
    check('RECALL: nothing the opening fifteen displaced is stranded — every one is remembered by somebody',
      reach.parked.length === 6 && reach.missed.length === 0, JSON.stringify(reach));

    // …AND THE TWO ARE A FORK, NOT A RANKING. Two cards that do the same thing
    // to different numbers is the direct-upgrade trap the campfire already
    // fell into once; a fork has to be a question.
    const shapes = await J(() => window.R.RECALLS.map(r =>
      r.picks.map(p => window.K.effectText(window.K.CARD_DEFS[p.card].base))));
    check('RECALL: the two answers are different cards, not two sizes of one',
      shapes.every(pair => pair[0] !== pair[1]), JSON.stringify(shapes));

    // ── WHAT SETS ONE OFF ──
    // The ledger is the ONLY input. Asserted both ways: an empty record fires
    // nothing, and a record with everything in it fires every one of them — so
    // a `when` that reads something else, or that can never be satisfied by
    // play, shows up as a memory stuck on one side or the other.
    const gate = await J(() => {
      window.R.resetProfile();
      window.R.newRun(11);
      const st = window.R.state();
      const virgin = window.R.pendingRecall();
      const out = { virgin: virgin ? virgin.id : null, fires: [] };
      const full = { felled: Object.keys(window.K.FOES), chose: ['x:y'],
                     brink: ['ash', 'elin', 'mira'], told: [],
                     deepest: window.R.STOPS - 1, flawless: 3 };
      for (const rc of window.R.RECALLS) {
        st.journey = JSON.parse(JSON.stringify(full));
        let fired = false;
        try { fired = !!rc.when(st); } catch (_) { fired = false; }
        out.fires.push({ id: rc.id, fired });
      }
      // …and each one is DRIVEN BY THE LEDGER: knock every field back to empty
      // one at a time and each memory must be turned off by at least one of
      // them. A `when` that returns a constant survives every other check here.
      out.reads = window.R.RECALLS.map(rc => {
        const keys = Object.keys(full).filter(k => k !== 'told');
        return { id: rc.id, by: keys.filter(k => {
          st.journey = JSON.parse(JSON.stringify(full));
          st.journey[k] = Array.isArray(full[k]) ? [] : 0;
          try { return !rc.when(st); } catch (_) { return false; }
        }) };
      });
      return out;
    });
    check('RECALL: an empty record of the journey sets off nothing',
      gate.virgin === null, JSON.stringify({ virgin: gate.virgin }));
    check('RECALL: a journey that did everything sets off every one of them',
      gate.fires.every(f => f.fired), JSON.stringify(gate.fires));
    check('RECALL: every memory is driven by the ledger and by nothing else',
      gate.reads.every(r => r.by.length >= 1), JSON.stringify(gate.reads));

    // ── THE DOOR ──
    // A recall opens on ARRIVAL at the next stop, the same seam a bond uses,
    // and it holds that stop so the road can come back to it.
    const opened = await J(() => {
      window.R.resetProfile();
      window.R.newRun(11);
      const st = window.R.state();
      st.journey = { felled: Object.keys(window.K.FOES), chose: ['x:y'],
                     brink: ['ash', 'elin', 'mira'], told: [],
                     deepest: window.R.STOPS - 1, flawless: 3 };
      const rc = window.R.pendingRecall();
      const ok = window.R.openRecall('a-stop');
      const sc = window.R.scene();
      return { wanted: rc && rc.id, ok, id: sc && sc.id, kind: sc && sc.kind,
               resume: window.R.state().bondResume,
               onScene: !document.getElementById('k-scene').classList.contains('k-hidden'),
               picks: (sc && sc.picks || []).map(p => p.card) };
    });
    check('RECALL: it opens as a scene, and remembers the stop it interrupted',
      opened.ok && opened.kind === 'recall' && opened.id === opened.wanted
      && opened.onScene && opened.resume === 'a-stop' && opened.picks.length === 2,
      JSON.stringify(opened));

    // The scene reads as ONE PERSON REMEMBERING: their name over the fork, and
    // the whole party in the shot so the speaker can light up out of it.
    const staged = await J(() => {
      window.R.sceneSkip();
      return { who: document.getElementById('k-scene-who').textContent.trim(),
               forks: document.querySelectorAll('#k-scene-fork .k-fork').length,
               faces: document.querySelectorAll('#k-scene-fork .k-card-fork').length,
               ask: document.querySelector('#k-scene-fork .k-fork-ask').textContent.trim(),
               cast: document.querySelectorAll('#k-scene-cast .k-sc-fig').length };
    });
    const rememberer = await J((id) => {
      const rc = window.R.RECALLS.find(r => r.id === id);
      return ({ ash: 'Ash', elin: 'Elin', mira: 'Mira' })[rc.who];
    }, opened.id);
    check('RECALL: the fork names the person remembering and shows both cards as faces',
      staged.forks === 2 && staged.faces === 2 && /\S/.test(staged.ask)
      && staged.who.toLowerCase() === rememberer.toLowerCase() && staged.cast === 3,
      JSON.stringify({ staged, rememberer }));

    // ── THE FORK IS A CARD ──
    const took = await J(() => {
      const sc = window.R.scene();
      const want = sc.picks[0].card;
      const sigilBefore = window.R.state().pendingSigil;
      document.querySelector('#k-scene-fork .k-fork').click();
      const st = window.R.state();
      return { want, onSwap: !document.getElementById('k-swap').classList.contains('k-hidden'),
               pending: st.pendingCard, sigil: st.pendingSigil, sigilBefore,
               told: st.journey.told.slice(),
               heard: window.R.profile().heard.indexOf(sc.id) >= 0,
               won: window.R.profile().won.indexOf(want) >= 0 };
    });
    check('RECALL: answering hands the card to the swap and writes the memory down',
      took.onSwap && took.pending === took.want && took.told.indexOf(opened.id) >= 0
      && took.heard && took.won, JSON.stringify(took));
    // A BOND LEVEL PAYS TWICE — a card and a mark. A recall pays ONCE. It is
    // not a bond level and must not quietly hand out a bond level's sigil.
    check('RECALL: it pays a card and nothing else — no mark, no bond level',
      !took.sigil && !took.sigilBefore, JSON.stringify({ sigil: took.sigil }));

    const settled = await J(() => {
      const first = document.querySelector('#k-swap-cols .k-swapcard');
      if (first) first.click();
      const go = document.getElementById('k-swap-go');
      if (go && !go.disabled) go.click();
      const st = window.R.state();
      const ids = window.K.rosterIds(st.roster);
      return { n: ids.length, uniq: new Set(ids).size, has: ids.indexOf(st.pendingCard || '') < 0,
               carries: ids, owes: st.pendingCard, resume: st.bondResume,
               slots: ['ash', 'elin', 'mira'].map(h => st.roster[h].length),
               screen: ['k-stage', 'k-map', 'k-camp', 'k-scene', 'k-swap', 'k-wake', 'k-mark']
                 .filter(id => !document.getElementById(id).classList.contains('k-hidden')) };
    });
    check('RECALL: the trade lands and the road goes on — fifteen cards, one screen, no debt',
      settled.n === 15 && settled.uniq === 15 && settled.slots.every(n => n === 5)
      && !settled.owes && !settled.resume && settled.screen.length === 1
      && settled.carries.indexOf(took.want) >= 0, JSON.stringify(settled));

    // ── ONCE ──
    // A memory that keeps coming back is not a memory, it is a wall. The
    // trigger stays true forever, so `told` is the only thing stopping it.
    const again = await J((id) => {
      const st = window.R.state();
      st.journey.deepest = window.R.STOPS - 1;
      st.journey.chose = ['x:y']; st.journey.brink = ['ash', 'elin', 'mira'];
      st.journey.felled = Object.keys(window.K.FOES);
      const next = window.R.pendingRecall();
      return { told: st.journey.told.slice(), next: next ? next.id : null, was: id };
    }, opened.id);
    check('RECALL: a memory already had never comes back, even though its trigger still holds',
      again.told.indexOf(again.was) >= 0 && again.next !== again.was, JSON.stringify(again));

    // ── AND IT NEVER OFFERS WHAT THEY ALREADY CARRY ──
    // Same rule as the bond forks, and the same reason: every card a recall
    // hands over is a card BORROWED HABIT can start a returning player with.
    const dup = await J(() => {
      window.R.resetProfile();
      window.R.newRun(11);
      const st = window.R.state();
      st.journey = { felled: Object.keys(window.K.FOES), chose: ['x:y'],
                     brink: ['ash', 'elin', 'mira'], told: [],
                     deepest: window.R.STOPS - 1, flawless: 3 };
      const rc = window.R.pendingRecall();
      const hero = rc.who;
      st.roster[hero] = [rc.picks[0].card].concat(st.roster[hero].slice(1));
      window.R._set({ roster: st.roster });
      window.R.openRecall(null);
      const sc = window.R.scene();
      return { id: rc.id, held: rc.picks[0].card,
               picks: (sc && sc.picks || []).map(p => p.card) };
    });
    check('RECALL: a memory never offers a card the party already carries',
      dup.picks.length === 1 && dup.picks.indexOf(dup.held) < 0, JSON.stringify(dup));

    // …and when they carry BOTH there is nothing to hand over, so the memory
    // does not fire at all. A bond scene still pays its level and is worth
    // playing empty; a recall pays one thing, and a scene that arrives with
    // empty hands is a scene the player watched for no reason.
    const empty = await J(() => {
      window.R.resetProfile();
      window.R.newRun(11);
      const st = window.R.state();
      st.journey = { felled: Object.keys(window.K.FOES), chose: ['x:y'],
                     brink: ['ash', 'elin', 'mira'], told: [],
                     deepest: window.R.STOPS - 1, flawless: 3 };
      const rc = window.R.pendingRecall();
      const cards = rc.picks.map(p => p.card);
      st.roster[rc.who] = cards.concat(st.roster[rc.who].slice(cards.length));
      window.R._set({ roster: st.roster });
      const next = window.R.pendingRecall();
      return { was: rc.id, next: next ? next.id : null, cards };
    });
    check('RECALL: with both cards already carried the memory holds its tongue',
      empty.next !== empty.was, JSON.stringify(empty));

    // ── AND A BOND STILL COMES FIRST ──
    // A bond is a threshold the player watched fill and is waiting on; a
    // recall is the road paying out on its own. At most one of either per
    // stop, and the one that was earned wins the tie.
    const tie = await J(() => {
      window.R.resetProfile();
      window.R.newRun(11);
      const st = window.R.state();
      st.journey = { felled: Object.keys(window.K.FOES), chose: ['x:y'],
                     brink: ['ash', 'elin', 'mira'], told: [],
                     deepest: window.R.STOPS - 1, flawless: 3 };
      window.R._set({ bonds: { 'ash|elin': 99, 'ash|mira': 0, 'elin|mira': 0 } });
      const bondsWaiting = window.R.pendingBonds().length;
      const recallWaiting = !!window.R.pendingRecall();
      const opened = window.R.openBondScene('s') || window.R.openRecall('s');
      const sc = window.R.scene();
      return { bondsWaiting, recallWaiting, opened, kind: sc && sc.kind };
    });
    check('RECALL: with a bond and a memory both waiting, the earned one goes first',
      tie.bondsWaiting >= 1 && tie.recallWaiting && tie.opened && tie.kind === 'bond',
      JSON.stringify(tie));
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
