// KIZUNA v2.3 — THE VERTICAL SLICE GATE.
//
// Every other suite tests a part. road.test.cjs drives one stop at a time,
// camp.test.cjs stands at a fire it teleported to, flow.test.cjs never leaves
// the board. All three can be green while the thing they are parts OF is
// broken, because none of them ever walks the whole way.
//
// This one plays an entire run: trailhead, six stops, the Regent, the end
// card — through the real screens, with the real engine, using the same bot
// the balance sims use. It asserts invariants at EVERY step rather than at the
// end, so a break reports where it happened instead of only that it happened.
'use strict';
const { boot } = require('./harness.cjs');
const { BOT } = require('./bot.cjs');

const MAXHP = { ash: 42, elin: 36, mira: 34 };
const MAX_TURNS = 30;

(async () => {
  const H = await boot({ query: 'road=1' });
  const { J, check, report, sleep } = H;

  const R = () => J(() => JSON.parse(JSON.stringify(window.R.state())));
  // EXACTLY ONE SCREEN, ALWAYS. The router is four `classList.toggle` calls;
  // the failure it invites is two screens up at once or none at all, and both
  // look like "the game froze" to a player.
  // EVERY SCREEN THE GAME HAS. "And on nothing else" is only a claim about
  // the screens this list knows about — k-wake and k-swap were both missing
  // from it, so a run could have opened on two screens at once and this would
  // have reported one.
  const visible = () => J(() => ['k-stage', 'k-map', 'k-camp', 'k-scene', 'k-swap', 'k-wake']
    .filter(id => !document.getElementById(id).classList.contains('k-hidden')));

  const breaches = [];
  async function invariants(where) {
    const bad = await J((w) => {
      const r = window.R.state(), out = [];
      if (r.embers < 0) out.push('negative embers: ' + r.embers);
      if (r.tier < 1 || r.tier > 5) out.push('tier out of range: ' + r.tier);
      // A NIGHT THAT KEPT raises the ceiling, so the ceiling is not a constant.
      const H2 = { ash: 42 + (r.vigor || 0), elin: 36 + (r.vigor || 0), mira: 34 + (r.vigor || 0) };
      if (r.hp) for (const id of Object.keys(H2)) {
        if (r.hp[id] > H2[id]) out.push(id + ' over max: ' + r.hp[id]);
        if (r.hp[id] < 0) out.push(id + ' below zero: ' + r.hp[id]);
      }
      if (new Set(r.nodes).size !== r.nodes.length) out.push('a node kindled twice');
      // FIVE SLOTS A HERO, at every step of a whole run — the rule the bond
      // system turns on, checked continuously rather than at the end.
      if (r.roster) {
        for (const h of ['ash', 'elin', 'mira']) {
          if ((r.roster[h] || []).length !== 5) out.push(h + ' holds ' + (r.roster[h] || []).length + ' slots, not 5');
        }
        const ids = window.K.rosterIds(r.roster);
        if (new Set(ids).size !== ids.length) out.push('the roster holds a duplicate');
      }
      if (new Set(r.path).size !== r.path.length) out.push('a stop visited twice');
      // The deck may get better; it may never get bigger.
      if (window.K.state()) {
        const c = window.K.state();
        const all = [...c.hand, ...c.deck, ...c.discard, ...c.exhausted].filter(id => id !== 'lightsteel');
        if (all.length !== 15) out.push('deck is ' + all.length + ' cards, not 15');
      }
      return out.map(s => w + ': ' + s);
    }, where);
    breaches.push(...bad);
  }

  const seen = { fight: 0, elite: 0, camp: 0, story: 0, event: 0, boss: 0 };
  const log = [];

  // A SEED WHOSE BEST ROUTE TOUCHES ALL SIX KINDS. The route search below
  // maximises distinct kinds, but it can only pick from what the road offers —
  // and a mystery is a third-lane stop, so not every seed grows one. 5013 does,
  // which is what lets the gate walk a crossroads as well as a fire.
  await J((s) => window.R.newRun(s), 5013);
  const route = await J(() => {
    const m = window.R.map(), start = m.filter(n => n.col === 0);
    const paths = [];
    const rec = (n, acc) => {
      const path = acc.concat([n]);
      if (!n.to.length) { paths.push(path); return; }
      n.to.forEach(t => rec(m.find(q => q.id === t), path));
    };
    start.forEach(n => rec(n, []));
    let best = null, bestScore = -1;
    for (const p of paths) {
      const kinds = new Set(p.map(n => n.kind));
      if (kinds.size > bestScore) { bestScore = kinds.size; best = p; }
    }
    return best.map(n => n.id);
  });
  // ═══ THE AWAKENING — the run's first choice, before it knows anything ═══
  await invariants('waking');
  {
    const v = await visible();
    check('SLICE: the game opens on the awakening, and on nothing else',
      v.length === 1 && v[0] === 'k-wake', v.join(','));
    const offer = await J(() => {
      const o = window.R.wakeOffer();
      const cards = [...document.querySelectorAll('#k-wake-cards .k-wk')];
      return { ids: o.map(w => w.id), kinds: o.map(w => w.kind),
               drawn: cards.map(c => c.dataset.wake),
               titles: cards.map(c => (c.querySelector('.k-wk-title') || {}).textContent),
               lines: cards.map(c => ((c.querySelector('.k-wk-line') || {}).textContent || '').length),
               gains: cards.map(c => (c.querySelector('.k-wk-gain') || {}).textContent),
               costs: cards.map(c => !!c.querySelector('.k-wk-cost')) };
    });
    check('WAKE: three memories are offered, and the screen draws the three it chose',
      offer.ids.length === 3 && new Set(offer.ids).size === 3
      && offer.drawn.join(',') === offer.ids.join(','),
      JSON.stringify({ ids: offer.ids, drawn: offer.drawn }));
    // The composition is fixed even though the contents are not: exactly one
    // of the three costs you something, so the choice is never three flavours
    // of free.
    check('WAKE: exactly one of the three is a trade, and it is the one wearing a cost',
      offer.kinds.filter(k => k === 'trade').length === 1
      && offer.costs.filter(Boolean).length === 1
      && offer.costs[offer.kinds.indexOf('trade')] === true,
      JSON.stringify({ kinds: offer.kinds, costs: offer.costs }));
    check('WAKE: every memory is written, not just priced — a title, prose, and what it gives',
      offer.titles.every(t => t && t.length > 3)
      && offer.lines.every(n => n > 80)
      && offer.gains.every(g => g && g.length > 3),
      JSON.stringify({ titles: offer.titles, lines: offer.lines, gains: offer.gains }));

    // A DETERMINISTIC OFFER. The rest of the run is seeded; the choice that
    // opens it cannot be the one thing that is not, or a seed no longer names
    // a run.
    const stable = await J(() => {
      const a = window.R.wakeOffer().map(w => w.id);
      window.R.newRun(5013);                 // the walk's own seed, re-rolled
      const b = window.R.wakeOffer().map(w => w.id);
      window.R.newRun(4242);
      const c = window.R.wakeOffer().map(w => w.id);
      window.R.newRun(5013);
      return { a, b, c };
    });
    check('WAKE: the same seed wakes the same way, and a different seed does not',
      stable.a.join(',') === stable.b.join(',') && stable.b.join(',') !== stable.c.join(','),
      JSON.stringify(stable));

    // Take the trade — it is the option with something to go wrong.
    const took = await J(() => {
      const t = window.R.wakeOffer().find(w => w.kind === 'trade');
      const before = JSON.parse(JSON.stringify(window.R.state()));
      window.R.takeWake(t.id);
      const r = window.R.state();
      const hidden = (id) => document.getElementById(id).classList.contains('k-hidden');
      return { id: t.id, woke: r.woke, onMap: !hidden('k-map'),
               embers: [before.embers, r.embers], kizuna: [before.kizuna, r.kizuna],
               foeBonus: r.foeBonus, hp: r.hp,
               gained: r.embers > before.embers || r.kizuna > before.kizuna,
               paid: !!r.hp || r.foeBonus > 0 };
    });
    check('WAKE: taking a memory applies it, records it, and opens the road',
      took.woke === took.id && took.onMap && took.gained && took.paid,
      JSON.stringify(took));

    // The offer is answered ONCE. Without this, R.takeWake is a button that
    // grants a boon every time it is pressed.
    const again = await J(() => {
      const r0 = JSON.parse(JSON.stringify(window.R.state()));
      window.R.wakeOffer().forEach(w => window.R.takeWake(w.id));
      const r = window.R.state();
      return { woke: r.woke, was: r0.woke, embers: [r0.embers, r.embers],
               kizuna: [r0.kizuna, r.kizuna], foeBonus: [r0.foeBonus, r.foeBonus] };
    });
    check('WAKE: a memory can only be reached for once',
      again.woke === again.was && again.embers[0] === again.embers[1]
      && again.kizuna[0] === again.kizuna[1] && again.foeBonus[0] === again.foeBonus[1],
      JSON.stringify(again));

    // And nothing outside the offer can be taken.
    const offPool = await J(() => {
      window.R.newRun(5150);
      const offered = window.R.wakeOffer().map(w => w.id);
      const outsider = window.R.WAKES.map(w => w.id).find(id => offered.indexOf(id) < 0);
      window.R.takeWake(outsider);
      return { outsider, woke: window.R.state().woke };
    });
    check('WAKE: a memory that was not offered cannot be taken',
      offPool.outsider && offPool.woke == null, JSON.stringify(offPool));

    // Back to the run this slice actually walks, with a plain memory taken so
    // the road below is measured against a known start.
    await J(() => {
      window.R.newRun(5013);
      const plain = window.R.wakeOffer().find(w => w.kind === 'plain');
      window.R.takeWake(plain.id);
    });
  }
  await invariants('trailhead');
  {
    const v = await visible();
    check('SLICE: once the memory is taken, the road — and nothing else',
      v.length === 1 && v[0] === 'k-map', v.join(','));
  }

  for (let col = 0; col < 6; col++) {
    // WALK A ROUTE CHOSEN UP FRONT, not greedily.
    //
    // A slice test that only ever fights proves the slice only ever fights, so
    // the walk has to cover every KIND of stop. Picking greedily at each fork
    // cannot guarantee that: the column's one crossing may not lead to the
    // kind you still need, and the first run of this gate duly reached the
    // Regent having never once seen a memory. The route is instead searched
    // for whole — there are at most 32 root-to-boss paths — and scored by how
    // many distinct kinds it visits.
    const pickId = route[col];
    const kind = await J((id) => window.R.map().find(n => n.id === id).kind, pickId);
    seen[kind] = (seen[kind] || 0) + 1;

    await J((id) => window.R.travel(id), pickId);
    await sleep(400);

    let v = await visible();
    // A CAMPFIRE MAY OPEN A BOND SCENE FIRST. Two of them crossing a level on
    // the road get heard before the tree, and the fork they end on is a card
    // that has to be traded into somebody's five. The gate walks that whole
    // path — it is the one place the social layer, the deck and the road all
    // touch at once.
    let bonds = 0;
    if (kind === 'camp' && v[0] === 'k-scene') {
      while (v[0] === 'k-scene' && bonds < 4) {
        bonds++;
        const traded = await J(() => {
          window.R.sceneSkip();
          window.R.takeBond(0);
          const card = window.R.pendingCard();
          const first = document.querySelector('#k-swap-cols .k-swapcard');
          const dropped = first ? first.dataset.id : null;
          if (first) first.click();
          const go = document.getElementById('k-swap-go');
          if (go && !go.disabled) go.click();
          // A BOND LEVEL PAYS TWICE. The swap hands on to the marking screen,
          // and the walk has to answer it or the fire never opens.
          const marked = !document.getElementById('k-mark').classList.contains('k-hidden');
          const mk = document.querySelector('#k-mark-cols .k-mk:not([disabled])');
          const markedCard = mk ? mk.dataset.id : null;
          if (mk) mk.click();
          const r = window.R.state();
          return { card, dropped, marked, markedCard, sigil: r.sigils[markedCard] || null,
                   sizes: ['ash', 'elin', 'mira'].map(h => r.roster[h].length),
                   uniq: new Set(window.K.rosterIds(r.roster)).size };
        });
        log.push(`stop ${col}: bond — took ${traded.card}, gave up ${traded.dropped}`);
        check(`SLICE: the bond at stop ${col} trades one for one — still five slots a hero`,
          traded.sizes.every(n => n === 5) && traded.uniq === 15, JSON.stringify(traded));
        check(`SLICE: the bond at stop ${col} also marks a card the party already carries`,
          traded.marked && !!traded.markedCard && !!traded.sigil,
          JSON.stringify({ marked: traded.marked, card: traded.markedCard, sigil: traded.sigil }));
        await sleep(300);
        v = await visible();
      }
    }
    const want = kind === 'camp' ? 'k-camp'
      : (kind === 'story' || kind === 'event') ? 'k-scene' : 'k-stage';
    check(`SLICE: stop ${col} is a ${kind.toUpperCase()} and it opens the ${want.replace('k-', '')}`,
      v.length === 1 && v[0] === want, v.join(',') + ' (wanted ' + want + ')');
    await invariants('stop ' + col + ' open');

    if (kind === 'camp') {
      const spent = await J(() => {
        let bought = 0, guard = 0;
        while (guard++ < 12) {
          const n = window.R.TREE.find(t => window.R.state().nodes.indexOf(t.id) < 0
            && t.tier <= window.R.state().tier && t.cost <= window.R.state().embers);
          if (!n) break;
          window.R.kindle(n.id); bought++;
        }
        window.R.leaveCamp();
        return bought;
      });
      log.push(`stop ${col}: campfire, kindled ${spent}`);
      await sleep(300);
    } else if (kind === 'story') {
      // Walk the scene beat by beat the way a player would, not by skipping.
      const walked = await J(() => {
        const tier = window.R.state().tier;
        let n = 0;
        while (n < 40 && window.R.scene()) { window.R.sceneNext(); n++; }
        return { n, closed: !window.R.scene(), tier: [tier, window.R.state().tier] };
      });
      log.push(`stop ${col}: memory, ${walked.n} taps`);
      // A MEMORY HAS TO END. Tapping through it and running out of taps is not
      // the same as finishing it — a scene that never closes never pays its
      // tier, and the walk sails on to the next stop none the wiser. That is
      // exactly what happened when the mystery's fork-guard swallowed the
      // memory's exit, and only the log noticed.
      check(`SLICE: the memory at stop ${col} closes itself and pays the tier it promised`,
        walked.closed && walked.n < 40 && walked.tier[1] === walked.tier[0] + 1,
        JSON.stringify(walked));
      await sleep(300);
    } else if (kind === 'event') {
      // A MYSTERY ENDS ON ITS FORK AND WAITS THERE. Tap through the lines the
      // way a player would, then take the trade — and check on the way out
      // that the button charged exactly what its own chips said it would.
      const traded = await J(() => {
        const before = JSON.parse(JSON.stringify(window.R.state()));
        let n = 0;
        while (n < 20 && window.R.scene() && !document.querySelector('.k-fork-opt')) {
          window.R.sceneNext(); n++;
        }
        const opts = [...document.querySelectorAll('.k-fork-opt')];
        const chips = opts.map(o => [...o.querySelectorAll('.k-fo-fx em')].map(e => e.textContent));
        const label = opts[0] ? opts[0].querySelector('.k-fo-lbl').textContent : '';
        if (opts[0]) opts[0].click();
        const after = JSON.parse(JSON.stringify(window.R.state()));
        return { taps: n, opts: opts.length, chips, label,
                 embers: [before.embers, after.embers],
                 hp: [before.hp, after.hp], flash: after.flash };
      });
      log.push(`stop ${col}: mystery — ${traded.label}`);
      check(`SLICE: the mystery at stop ${col} offers a real fork and both sides of every trade`,
        traded.opts >= 2 && traded.chips.every(c => c.length >= 1)
        && traded.chips.some(c => c.length >= 2),
        JSON.stringify({ opts: traded.opts, chips: traded.chips }));
      check(`SLICE: taking the trade hands the road back with a receipt for it`,
        !!traded.flash && traded.flash.icon === 'event'
        && (traded.flash.gainSub || '').length > 3,
        JSON.stringify(traded.flash));
      await sleep(400);
    } else {
      const before = await R();
      const r = await H.page.evaluate(([src, sd, p, mt]) => {
        // THE BOT NORMALLY STARTS ITS OWN FIGHT. Here the road already started
        // one — with this stop's foe, this run's upgrades and this party's
        // wounds — so startCombat is stubbed for the length of the call and the
        // bot plays the board it was handed instead of a fresh one.
        const K = window.K, orig = K.startCombat;
        K.startCombat = () => K.state();
        try { return eval(src)(sd, p, mt, {}); } finally { K.startCombat = orig; }
      }, [BOT, 900 + col * 17, 0.86, MAX_TURNS]);
      log.push(`stop ${col}: ${kind}, ${r.win ? 'won' : 'LOST'} in ${r.turns} rounds`);
      // THE BOARD HOLDS AFTER A WIN. The foe goes down, then the reckoning
      // stands on the stage — foe on the ground, party in their lanes — so
      // the road does not come back until it has been answered.
      await sleep(2100);
      const said = await J(() => {
        const rk = window.R.reckoning && window.R.reckoning();
        if (!rk) return null;
        for (let i = 0; i < 20 && window.R.reckoning(); i++) {
          if (document.querySelector('.k-rk-opt')) break;
          window.R.reckNext();
        }
        const o = [...document.querySelectorAll('.k-rk-opt')];
        if (!o.length) return { id: rk.id, stuck: true };
        o[0].click();
        return { id: rk.id };
      });
      if (said && said.stuck) breaches.push(`stop ${col}: the reckoning never offered its fork`);
      if (said) log.push(`stop ${col}: reckoning — ${said.id}`);
      await sleep(400);
      check(`SLICE: the ${kind} at stop ${col} resolves and hands the run back`,
        !!r && (r.win || r.died), JSON.stringify({ win: r && r.win, turns: r && r.turns }));
      const after = await R();
      if (r && r.win) {
        check(`SLICE: winning stop ${col} pays embers and carries the wounds forward`,
          after.embers >= before.embers && after.hp && after.hp.ash <= MAXHP.ash,
          JSON.stringify({ embers: [before.embers, after.embers], hp: after.hp }));
      }
    }
    await invariants('stop ' + col + ' done');
    const st = await R();
    if (st.over) break;
  }

  // ═══ THE END OF THE ROAD ═══
  console.log('\n── the whole way down ──');
  log.forEach(l => console.log('    ' + l));
  {
    const st = await R();
    const v = await visible();
    check('SLICE: the run ends, and it ends on the road with a card that says how',
      !!st.over && v.length === 1 && v[0] === 'k-map', JSON.stringify({ over: st.over, on: v }));
    const card = await J(() => document.getElementById('k-map-card').textContent);
    check('SLICE: the end card names the outcome and offers another run',
      /REGENT FALLS|PARTY FALLS/.test(card) && /NEW RUN/.test(card),
      card.replace(/\s+/g, ' ').slice(0, 76));
    // ALL SIX KINDS, not four. A gate that only proves the road can fight and
    // rest is a gate that would not have noticed the mystery arriving broken.
    check('SLICE: the walk covered every kind of stop the road can serve',
      seen.fight >= 1 && seen.camp >= 1 && seen.story >= 1 && seen.event >= 1
      && seen.elite >= 1 && seen.boss >= 1,
      JSON.stringify(seen));
    check('SLICE: no invariant was breached at any point along the way',
      breaches.length === 0, breaches.slice(0, 4).join(' · ') || 'clean');
    // A finished run must be inert: nothing on the map may still be taken.
    const inert = await J(() => {
      const before = JSON.stringify(window.R.state());
      window.R.tapNode((window.R.map()[0] || {}).id);
      window.R.travel((window.R.map()[3] || {}).id);
      return { same: JSON.stringify(window.R.state()) === before,
               open: window.R.reachable().length, active: window.R.active() };
    });
    check('SLICE: an ended run is inert — no stop can still be taken',
      inert.same && inert.open === 0 && inert.active === false, JSON.stringify(inert));
    // And a new run is genuinely new.
    const fresh = await J(() => {
      window.R.newRun(99);
      const r = window.R.state();
      return { at: r.at, embers: r.embers, nodes: r.nodes.length, tier: r.tier,
               over: r.over, path: r.path.length, seen: (r.seen || []).length };
    });
    check('SLICE: NEW RUN starts from nothing — no embers, no tree, no memories, no path',
      fresh.at === null && fresh.embers === 0 && fresh.nodes === 0 && fresh.tier === 1
      && !fresh.over && fresh.path === 0 && fresh.seen === 0, JSON.stringify(fresh));
  }

  const r = report();
  await H.browser.close();
  process.exit(r.passed === r.total && r.errs === 0 ? 0 : 1);
})();
