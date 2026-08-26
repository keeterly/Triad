// KIZUNA v2.3 — the FIRE suite. The campfire, the tree, and the one thing that
// makes a memory worth taking.
//
// The gauntlet asked for "a campfire and cutscene system that develops and
// unlocks skill nodes". Two halves, and only one of them is a screen: a tree
// that shows nodes but does not change the fight is decoration. So most of
// these checks end inside combat, asserting the card the player bought is the
// card the deck actually deals.
'use strict';
const { boot } = require('./harness.cjs');

(async () => {
  const H = await boot({ query: 'road=1' });
  const { J, check, report, sleep } = H;

  const R = () => J(() => JSON.parse(JSON.stringify(window.R.state())));
  const reset = (seed) => J((s) => { window.R.newRun(s); return true; }, seed);
  // Stand at a campfire without walking the whole road to one.
  const atCamp = (patch) => J((p) => {
    const camp = window.R.map().find(n => n.kind === 'camp');
    const prev = window.R.map().find(m => m.col === camp.col - 1 && m.to.indexOf(camp.id) >= 0);
    window.R._set(Object.assign({ at: prev.id, path: [prev.id], stop: prev.col + 1 }, p || {}));
    window.R.travel(camp.id);
    return camp.id;
  }, patch);

  await reset(11);

  // ═══ A · THE TREE IS A LADDER WITH A LOCK ON IT ═══
  console.log('\n── the shape of the tree ──');
  {
    const T = await J(() => window.R.TREE.map(n => ({ ...n })));
    check('TREE: ten nodes — three tiers for each of the three, and one they share',
      T.length === 10 && ['ash', 'elin', 'mira'].every(h => T.filter(n => n.hero === h).length === 3)
      && T.filter(n => n.hero === 'all').length === 1,
      T.map(n => n.hero).join(','));
    check('TREE: every hero node sharpens a card the party already owns',
      T.filter(n => n.hero !== 'all').every(n => !!n.card), 'cards: ' + T.filter(n => n.card).length);
    const byTier = t => T.filter(n => n.tier === t);
    check('TREE: prices climb with the tier, so a deeper node is a real commitment',
      Math.max(...byTier(1).map(n => n.cost)) < Math.min(...byTier(2).map(n => n.cost))
      && Math.max(...byTier(2).map(n => n.cost)) < Math.min(...byTier(3).map(n => n.cost)),
      JSON.stringify([1, 2, 3].map(t => byTier(t).map(n => n.cost))));
    const ups = await J(() => Object.keys(window.K.CARD_UPS));
    check('TREE: every card a node names has a written-out upgraded face',
      T.filter(n => n.card).every(n => ups.indexOf(n.card) >= 0), ups.join(','));
    // A tree that says what it does in prose goes stale the first time a card
    // is retuned. Every node reads its own two faces off the card tables.
    const faces = await J(() => window.R.TREE.filter(n => n.card).map(n => window.R.nodeFace(n)));
    check('TREE: a node shows the difference it buys — the card as it is, then as it becomes',
      faces.every(f => f.from && f.to && f.from !== f.to),
      JSON.stringify(faces[0]));
  }

  // ═══ B · EMBERS ALONE CANNOT REACH TIER 2 ═══
  console.log('\n── the lock, and the only key ──');
  {
    await reset(11);
    await atCamp({ embers: 99, tier: 1 });
    await sleep(320);
    const rich = await J(() => {
      const out = { sealed: [], open: [] };
      document.querySelectorAll('#k-camp .k-tnode').forEach(b => {
        (b.classList.contains('k-tn-sealed') ? out.sealed : out.open).push(b.dataset.node);
      });
      return out;
    });
    check('LOCK: a full purse at tier 1 still cannot buy a tier-2 node',
      rich.sealed.length === 7 && rich.open.length === 3,
      `sealed ${rich.sealed.length} · open ${rich.open.length}`);
    const refused = await J(() => {
      const before = window.R.state().embers;
      window.R.kindle('ash.crosssever');
      return { before, after: window.R.state().embers, nodes: window.R.state().nodes.slice() };
    });
    check('LOCK: kindling a sealed node is refused, and costs nothing to try',
      refused.before === refused.after && refused.nodes.length === 0, JSON.stringify(refused));
    const seal = await J(() => (document.querySelector('.k-tn-sealed .k-tn-seal') || {}).textContent);
    check('LOCK: a sealed node says what opens it, rather than only that it is shut',
      /MEMORY/.test(seal || ''), seal);

    await reset(11);
    await atCamp({ embers: 99, tier: 3 });
    await sleep(320);
    const deep = await J(() => document.querySelectorAll('#k-camp .k-tn-sealed').length);
    check('LOCK: two memories open the whole tree',
      deep === 0, deep + ' still sealed at tier 3');
  }

  // ═══ C · THE FIRE MENDS, AND THEN YOU SPEND ═══
  console.log('\n── at the fire ──');
  {
    await reset(11);
    await atCamp({ embers: 12, tier: 2, hp: { ash: 10, elin: 8, mira: 8 } });
    await sleep(320);
    const st = await R();
    check('FIRE: arriving mends — the road’s attrition is tuned on it, so it is not a choice',
      st.hp.ash > 10 && st.hp.elin > 8 && st.mended > 0,
      JSON.stringify({ hp: st.hp, mended: st.mended }));
    const shown = await J(() => ({
      onCamp: !document.getElementById('k-camp').classList.contains('k-hidden'),
      onMap: !document.getElementById('k-map').classList.contains('k-hidden'),
      mend: document.getElementById('k-camp-mend').textContent,
      purse: document.getElementById('k-camp-embers').textContent,
      tier: document.getElementById('k-camp-tier').textContent,
      nodes: document.querySelectorAll('#k-camp .k-tnode').length,
    }));
    check('FIRE: the fire is a place — the whole tree is on screen with the purse and the mend',
      shown.onCamp && !shown.onMap && shown.nodes === 10 && shown.purse === '12' && /TIER 2/.test(shown.tier),
      JSON.stringify(shown));

    // THE FIRE HAS TO FIT. Ten nodes on a 932x430 landscape phone is the whole
    // risk of this screen: one node clipped by the leave button, or a column
    // spilling past the floor, and the tree becomes a thing you scroll for.
    const fits = await J(() => {
      const stage = document.getElementById('k-camp').getBoundingClientRect();
      const leave = document.getElementById('k-camp-leave').getBoundingClientRect();
      const head = document.getElementById('k-camp-top').getBoundingClientRect();
      const bad = [];
      document.querySelectorAll('#k-camp .k-tnode').forEach(b2 => {
        const r = b2.getBoundingClientRect();
        if (r.bottom > stage.bottom || r.top < head.bottom - 1 || r.right > stage.right || r.left < stage.left) {
          bad.push({ n: b2.dataset.node, why: 'outside', top: Math.round(r.top), bottom: Math.round(r.bottom) });
        }
        if (r.bottom > leave.top && r.right > leave.left && r.left < leave.right) {
          bad.push({ n: b2.dataset.node, why: 'under the leave button' });
        }
        if (r.height < 34) bad.push({ n: b2.dataset.node, why: 'too short to read', h: Math.round(r.height) });
      });
      const cols = [...document.querySelectorAll('.k-ct-col')].map(c => Math.round(c.getBoundingClientRect().height));
      return { bad, cols, floor: Math.round(stage.bottom), leaveTop: Math.round(leave.top) };
    });
    check('FIRE: all ten nodes fit the screen — nothing clipped, nothing under the button',
      fits.bad.length === 0 && fits.cols.every(h => h > 200), JSON.stringify(fits));

    const bought = await J(() => {
      window.R.kindle('ash.cleave');
      const s2 = window.R.state();
      return { embers: s2.embers, nodes: s2.nodes.slice() };
    });
    check('FIRE: kindling spends the embers and keeps the node',
      bought.embers === 9 && bought.nodes[0] === 'ash.cleave', JSON.stringify(bought));
    const twice = await J(() => {
      window.R.kindle('ash.cleave');
      const s2 = window.R.state();
      return { embers: s2.embers, n: s2.nodes.length };
    });
    check('FIRE: a node already kindled cannot be bought again',
      twice.embers === 9 && twice.n === 1, JSON.stringify(twice));
    const poor = await J(() => {
      window.R._set({ embers: 2 });
      window.R.renderCamp();
      const b = document.querySelector('[data-node="elin.mend"]');
      return { poor: b.classList.contains('k-tn-poor'), readable: b.textContent.length > 10 };
    });
    check('FIRE: what you cannot afford greys its PRICE, not its face — you can read what you are saving for',
      poor.poor && poor.readable, JSON.stringify(poor));

    await J(() => window.R.leaveCamp());
    await sleep(200);
    const back = await J(() => ({
      onMap: !document.getElementById('k-map').classList.contains('k-hidden'),
      card: document.getElementById('k-map-card').textContent,
    }));
    check('FIRE: leaving hands you back to the road with a receipt for what happened',
      back.onMap && /MENDED|mended/.test(back.card), back.card.replace(/\s+/g, ' ').slice(0, 72));
  }

  // ═══ D · THE BOUGHT CARD IS THE DEALT CARD ═══
  console.log('\n── what the deck actually deals ──');
  {
    const base = await J(() => {
      window.K.startCombat({ seed: 3 });
      const ev = window.K.evaluateCard('cleave');
      return { name: ev.card.name, dmg: ev.resolvedEffects.reduce((n, f) => n + (f.dmg || 0), 0) };
    });
    const up = await J(() => {
      window.K.startCombat({ seed: 3, upgrades: ['cleave', 'twinfang'] });
      const c = window.K.evaluateCard('cleave'), t = window.K.evaluateCard('twinfang');
      return { name: c.card.name, dmg: c.resolvedEffects.reduce((n, f) => n + (f.dmg || 0), 0),
               twin: t.resolvedEffects.reduce((n, f) => n + (f.dmg || 0), 0),
               untouched: window.K.evaluateCard('serrate').card.name };
    });
    check('DEALT: a kindled node changes the card the evaluator resolves, and only that card',
      base.dmg === 7 && up.dmg === 10 && up.name === 'Cleave+' && up.twin === 12
      && up.untouched === 'Serrate', JSON.stringify({ base, up }));

    const face = await J(() => {
      window.K.startCombat({ seed: 3, upgrades: ['cleave'] });
      window.K.forceHand(['cleave', 'serrate', 'mend', 'qthrow', 'frostbind']);
      const btn = document.querySelector('[data-card="cleave"]');
      return { text: btn.textContent, plus: /\+/.test(btn.textContent) };
    });
    check('DEALT: the card in hand wears its new name — the face never lies about itself',
      face.plus, face.text.replace(/\s+/g, ' ').slice(0, 60));

    const deckSize = await J(() => {
      window.K.startCombat({ seed: 3, upgrades: ['cleave', 'mend', 'backstab'] });
      const c = window.K.state();
      return [...c.hand, ...c.deck, ...c.discard].length;
    });
    check('DEALT: the deck gets better without getting bigger — still fifteen cards',
      deckSize === 15, deckSize + ' cards');

    const team = await J(() => {
      // K.tune() hands back the LIVE tuning object, so both readings have to be
      // snapshotted as numbers — holding two references and comparing them
      // compares one object with itself.
      window.K.startCombat({ seed: 3, allout: { dmg: 34, brk: 6 } });
      const raised = window.K.tune({}).alloutDmg, brk = window.K.tune({}).alloutBrk;
      window.K.startCombat({ seed: 3 });
      const restored = window.K.tune({}).alloutDmg;
      return { raised, restored, brk };
    });
    check('DEALT: the team attack develops — and a spent run never leaks into the next one',
      team.raised === 34 && team.brk === 6 && team.restored === 26, JSON.stringify(team));
  }

  // ═══ E · THE RUN CARRIES IT ═══
  console.log('\n── the run carries it ──');
  {
    await reset(11);
    await atCamp({ embers: 20, tier: 3 });
    await sleep(320);
    await J(() => { window.R.kindle('ash.cleave'); window.R.kindle('all.crescendo'); window.R.leaveCamp(); });
    await sleep(240);
    const carried = await J(() => ({ ups: window.R.cardUps(), allout: window.R.alloutOf(),
                                     embers: window.R.state().embers }));
    check('CARRY: the run knows which faces it bought and what it did to the all-out',
      carried.ups.indexOf('cleave') >= 0 && carried.allout && carried.allout.dmg === 34
      && carried.embers === 11, JSON.stringify(carried));

    const fightId = await J(() => window.R.reachable().find(id => {
      const n = window.R.map().find(m => m.id === id);
      return n && (n.kind === 'fight' || n.kind === 'elite' || n.kind === 'boss');
    }));
    if (fightId) {
      await J((id) => window.R.travel(id), fightId);
      await sleep(420);
      const inFight = await J(() => ({
        name: window.K.evaluateCard('cleave').card.name,
        allout: window.K.tune({}).alloutDmg,
        ups: window.K.state().upgrades.slice(),
      }));
      check('CARRY: the next fight opens with the deck the fire built',
        inFight.name === 'Cleave+' && inFight.allout === 34 && inFight.ups.indexOf('cleave') >= 0,
        JSON.stringify(inFight));
    } else {
      check('CARRY: the next fight opens with the deck the fire built', false, 'no fight reachable');
    }

    const stored = await J(() => {
      const r = JSON.parse(localStorage.getItem('kizuna23.run'));
      return { nodes: r.nodes, embers: r.embers, tier: r.tier };
    });
    check('CARRY: the tree survives storage — a reloaded run is still the run you built',
      stored.nodes.length === 2 && stored.embers === 11, JSON.stringify(stored));
  }

  const r = report();
  await H.browser.close();
  process.exit(r.passed === r.total && r.errs === 0 ? 0 : 1);
})();
