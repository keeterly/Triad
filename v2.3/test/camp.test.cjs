// KIZUNA v2.3 — the FIRE suite. The campfire, the tree, and the memories that
// are the only thing that opens it.
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
    // The wait is for the arrival deal to land — geometry measured mid-flight
    // is the geometry of the animation, not of the screen.
    await sleep(700);
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

  // ═══ F · THE MEMORY ═══
  console.log('\n── a memory ──');
  {
    await reset(11);
    const storyId = await J(() => {
      const st = window.R.map().find(n => n.kind === 'story');
      const prev = window.R.map().find(m => m.col === st.col - 1 && m.to.indexOf(st.id) >= 0);
      window.R._set({ at: prev.id, path: [prev.id], stop: prev.col + 1 });
      window.R.travel(st.id);
      return st.id;
    });
    await sleep(320);

    const S = await J(() => window.R.SCENES.map(s2 => ({ id: s2.id, title: s2.title, beats: s2.beats.length,
      voices: [...new Set(s2.beats.map(b => b.who))].filter(Boolean) })));
    check('MEMORY: the scenes are authored, and each is a conversation between all three',
      S.length === 3 && S.every(s2 => s2.beats >= 5 && s2.voices.length === 3),
      JSON.stringify(S.map(s2 => s2.id + ':' + s2.beats)));

    const open = await J(() => ({
      onScene: !document.getElementById('k-scene').classList.contains('k-hidden'),
      onMap: !document.getElementById('k-map').classList.contains('k-hidden'),
      title: document.getElementById('k-scene-title').textContent,
      line: document.getElementById('k-scene-line').textContent,
      figs: document.querySelectorAll('#k-scene-cast .k-sc-fig').length,
      tier: window.R.state().tier,
    }));
    check('MEMORY: a memory stop opens a scene, not a number — and all three are in the shot',
      open.onScene && !open.onMap && open.figs === 3 && open.line.length > 12 && open.tier === 1,
      JSON.stringify({ title: open.title, figs: open.figs, tier: open.tier }));

    // The speaker is lit and forward; the other two stay in the scene.
    // MEASURED WHILE THE SCENE IS ON SCREEN. A hidden element's rects are all
    // zero, so a fit check run after the scene closes passes without testing
    // anything — which is exactly what the first draft of this check did.
    const fits = await J(() => {
      const st = document.getElementById('k-scene').getBoundingClientRect();
      const plate = document.getElementById('k-scene-plate').getBoundingClientRect();
      const cast = document.getElementById('k-scene-cast').getBoundingClientRect();
      const bar = document.querySelector('.k-sc-bar-bot').getBoundingClientRect();
      const skip = document.getElementById('k-scene-skip').getBoundingClientRect();
      return { h: Math.round(plate.height), castH: Math.round(cast.height),
               inside: plate.bottom <= st.bottom && plate.top >= st.top,
               clearOfCast: plate.top >= cast.bottom - 30,
               aboveBar: plate.bottom <= bar.top,
               skipClear: skip.left > plate.right || skip.bottom < plate.top,
               lineSize: parseFloat(getComputedStyle(document.getElementById('k-scene-line')).fontSize) };
    });
    check('MEMORY: the plate is a real, readable box inside the frame — clear of the cast and the letterbox',
      fits.h >= 80 && fits.castH >= 150 && fits.inside && fits.clearOfCast
      && fits.aboveBar && fits.skipClear && fits.lineSize >= 16, JSON.stringify(fits));

    const lit = await J(() => {
      // step to the first beat that has a speaker
      for (let i = 0; i < 6; i++) {
        const on = document.querySelectorAll('#k-scene-cast .k-sc-on').length;
        if (on === 1) break;
        window.R.sceneNext();
      }
      return { on: document.querySelectorAll('.k-sc-on').length,
               off: document.querySelectorAll('.k-sc-off').length,
               who: document.getElementById('k-scene-who').textContent };
    });
    check('MEMORY: exactly one hero is lit at a time, and the plate names them',
      lit.on === 1 && lit.off === 2 && lit.who.length > 1, JSON.stringify(lit));

    // TAPPING ANYWHERE ADVANCES. A scene advanced only from one 60px button is
    // a scene read with the thumb hunting instead of with the eyes.
    const tapped = await J(() => {
      const before = window.R.beat();
      document.getElementById('k-scene-cast').click();
      return { before, after: window.R.beat() };
    });
    check('MEMORY: tapping anywhere in the frame advances it',
      tapped.after === tapped.before + 1, JSON.stringify(tapped));

    const paid = await J(() => {
      window.R.sceneSkip();
      return { done: document.getElementById('k-scene').classList.contains('k-sc-done'),
               text: document.getElementById('k-scene-line').textContent,
               tier: window.R.state().tier,
               onScene: !document.getElementById('k-scene').classList.contains('k-hidden') };
    });
    check('MEMORY: SKIP goes to the payout, never past it — skipping a scene never skips its reward',
      paid.done && /TIER 2 OPENS/.test(paid.text) && paid.onScene && paid.tier === 1,
      JSON.stringify(paid));

    await J(() => window.R.sceneNext());
    await sleep(240);
    const after = await R();
    const back = await J(() => ({
      onMap: !document.getElementById('k-map').classList.contains('k-hidden'),
      card: document.getElementById('k-map-card').textContent,
    }));
    check('MEMORY: leaving the scene raises the tier, pays an ember, and says so on the road',
      after.tier === 2 && after.embers >= 1 && after.seen.length === 1
      && back.onMap && /tier 2/i.test(back.card),
      JSON.stringify({ tier: after.tier, embers: after.embers, seen: after.seen }));

    // The two memories on a road are a conversation with a first half and a
    // second half — the same scene twice would be worse than one scene once.
    const second = await J(() => {
      const st = window.R.map().filter(n => n.kind === 'story')[1];
      const prev = window.R.map().find(m => m.col === st.col - 1 && m.to.indexOf(st.id) >= 0);
      window.R._set({ at: prev.id, path: [prev.id], stop: prev.col + 1 });
      window.R.travel(st.id);
      return true;
    });
    await sleep(320);
    const which = await J(() => ({ id: window.R.scene().id, title: document.getElementById('k-scene-title').textContent }));
    check('MEMORY: the second memory is the second scene — they are halves of one conversation',
      which.id === 'careful', JSON.stringify(which));

    await J(() => { window.R.sceneSkip(); window.R.sceneNext(); });
    await sleep(240);
    const tier3 = await R();
    check('MEMORY: two memories reach tier 3 — the deep nodes are unreachable any other way',
      tier3.tier === 3 && tier3.seen.length === 2, JSON.stringify({ tier: tier3.tier, seen: tier3.seen }));

  }

  // ═══ H · THE FIRE IS A PLACE, NOT A TABLE ═══
  // REWRITTEN at Build 57. The old check here read "every upgrade node wears
  // the card it upgrades, UNDER THE WORDS" and asserted the painting was dimmed
  // below 0.8 so the prose on top of it could win. That rule is gone: the node
  // is not a tile with a picture behind its sentences any more, it is a
  // card-shaped OBJECT whose picture is the point, with its name on a scrim at
  // the foot of it and its sentence moved out to the reading strip. So the
  // check now asserts the new contract — the painting is present and lit, the
  // name sits above it on its own backing, and the sentence is somewhere you
  // can actually read it.
  console.log('\n── the fire is a place ──');
  {
    await reset(11);
    await atCamp({ embers: 12, tier: 2 });
    await sleep(340);

    const plates = await J(() => {
      const all = [...document.querySelectorAll('#k-camp .k-tnode')];
      const carded = all.filter(b => b.querySelector('.k-tn-bg'));
      const srcs = carded.map(b => b.querySelector('.k-tn-bg').getAttribute('src'));
      // a plate nobody has touched: not held, not sealed, not the focused one
      const idle = carded.find(b => !b.className.match(/k-tn-(own|sealed|focus|poor)/));
      const bg = idle && idle.querySelector('.k-tn-bg');
      const z = (n) => { const v = getComputedStyle(n).zIndex; return v === 'auto' ? 0 : +v; };
      const r = idle ? idle.getBoundingClientRect() : { width: 0, height: 0 };
      return {
        total: all.length, carded: carded.length, distinct: new Set(srcs).size,
        painted: srcs.every(x => /\/cards\//.test(x)),
        // the picture is LIT now, not pushed to the back
        lit: bg ? parseFloat(getComputedStyle(bg).opacity) >= 0.85 : false,
        // …and the name still wins, because it sits above the picture on a scrim
        named: !!(idle && idle.querySelector('.k-tn-top b').textContent.trim().length),
        above: idle ? [...idle.querySelectorAll('span')].every(sp => z(sp) > z(bg)) : false,
        // card-shaped: taller than it is wide, by roughly a card's ratio
        ratio: r.width ? +(r.width / r.height).toFixed(2) : 0,
      };
    });
    check('FIRE: every memory is a card-shaped object wearing its own painting, lit, with its name over it',
      plates.carded === 9 && plates.distinct === 9 && plates.painted
      && plates.lit && plates.named && plates.above
      && plates.ratio > 0.4 && plates.ratio < 0.8,
      JSON.stringify(plates));

    // THE CHANGELOG IS GONE FROM THE GRID. Ten nodes each setting out their own
    // "7 damage. → 10 damage." is what made this screen read as a spreadsheet.
    // The before/after belongs to ONE of them at a time, in one strip, at a
    // size a phone can read — so no plate may carry the struck-through half.
    const strip = await J(() => {
      const s2 = document.getElementById('k-camp-read');
      const cs = s2 ? getComputedStyle(s2) : null;
      return {
        exists: !!s2,
        name: s2 ? (s2.querySelector('b') || {}).textContent : '',
        was: s2 ? (s2.querySelector('.k-cr-was') || {}).textContent : '',
        now: s2 ? (s2.querySelector('.k-cr-now') || {}).textContent : '',
        call: s2 ? (s2.querySelector('em') || {}).textContent : '',
        size: cs ? Math.round(parseFloat(cs.fontSize)) : 0,
        nowSize: s2 && s2.querySelector('.k-cr-now')
          ? +parseFloat(getComputedStyle(s2.querySelector('.k-cr-now')).fontSize).toFixed(1) : 0,
        // nothing on a plate strikes anything out any more
        diffsOnPlates: [...document.querySelectorAll('#k-camp .k-tnode')]
          .filter(b => getComputedStyle(b.querySelector('.k-tn-what') || b).textDecorationLine
            .indexOf('line-through') >= 0).length,
      };
    });
    check('FIRE: the before/after is read in one strip, at a readable size — not restated on all ten plates',
      strip.exists && strip.was && strip.now && strip.was !== strip.now
      && strip.nowSize >= 11 && strip.diffsOnPlates === 0,
      JSON.stringify(strip));
    check('FIRE: the strip names the memory and says what taking it would cost',
      /\S/.test(strip.name || '') && /\d/.test(strip.call || '') && /EMBER/.test(strip.call || ''),
      JSON.stringify({ name: strip.name, call: strip.call }));

    // THE PARTY IS AT THE FIRE. The hero header used to be a 22px avatar in a
    // stat bar — a row label. If the three of them are not actually present and
    // at human scale, this is a menu with a fire painted behind it.
    const party = await J(() => {
      const figs = [...document.querySelectorAll('#k-camp .k-ct-fig img')];
      const srcs = figs.map(f => f.getAttribute('src'));
      const hs = figs.map(f => Math.round(f.getBoundingClientRect().height));
      const fire = document.querySelector('#k-camp .k-camp-fire i');
      const cs = fire ? getComputedStyle(fire) : null;
      return { figs: figs.length, distinct: new Set(srcs).size, minH: Math.min(...hs),
               sparks: document.querySelectorAll('#k-camp .k-camp-sparks i').length,
               burning: cs ? cs.animationName !== 'none' && parseFloat(cs.animationDuration) > 0 : false };
    });
    check('FIRE: the three of them are standing at it, at human scale, and the fire actually burns',
      party.figs === 3 && party.distinct === 3 && party.minH >= 90
      && party.sparks >= 5 && party.burning,
      JSON.stringify(party));

    // A PURCHASE IS A DECISION YOU WATCH YOURSELF MAKE. The road's grammar: the
    // first tap picks the memory up and the strip says what it does, the second
    // tap spends. One stray thumb must never cost embers.
    const twoTap = await J(() => {
      const tap = (id) => document.querySelector('[data-node="' + id + '"]').click();
      // move the focus off the node we are about to buy
      tap('mira.twinfang');
      const first = { embers: window.R.state().embers,
                      focused: !!document.querySelector('[data-node="elin.mend"].k-tn-focus') };
      tap('elin.mend');
      const picked = { embers: window.R.state().embers,
                       focused: !!document.querySelector('[data-node="elin.mend"].k-tn-focus'),
                       reads: (document.getElementById('k-camp-read').querySelector('b') || {}).textContent };
      tap('elin.mend');
      const bought = { embers: window.R.state().embers, nodes: window.R.state().nodes.slice() };
      return { first, picked, bought };
    });
    check('FIRE: the first tap picks a memory up and reads it out, the second spends the embers',
      twoTap.first.embers === 12 && !twoTap.first.focused
      && twoTap.picked.embers === 12 && twoTap.picked.focused && /Mend/i.test(twoTap.picked.reads || '')
      && twoTap.bought.embers === 9 && twoTap.bought.nodes.indexOf('elin.mend') >= 0,
      JSON.stringify(twoTap));

    // …and a memory you cannot reach still has to explain itself when you pick
    // it up, or the lock is just a greyed-out box.
    const sealedRead = await J(() => {
      document.querySelector('[data-node="ash.lastlight"]').click();
      const s2 = document.getElementById('k-camp-read');
      return { call: (s2.querySelector('em') || {}).textContent,
               now: (s2.querySelector('.k-cr-now') || {}).textContent,
               spent: window.R.state().nodes.indexOf('ash.lastlight') >= 0 };
    });
    check('FIRE: picking up a sealed memory still tells you what it is and what would open it',
      /MEMORY/.test(sealedRead.call || '') && /\S/.test(sealedRead.now || '') && !sealedRead.spent,
      JSON.stringify(sealedRead));

    // ARRIVING IS AN EVENT, BUYING IS NOT. The row deals in off the fire when you
    // sit down; if it re-deals every time three embers change hands, the screen
    // flickers at you for using it.
    await reset(11);
    await atCamp({ embers: 12, tier: 2 });
    await sleep(340);
    const deal = await J(() => {
      const wrap = document.getElementById('k-camp-tree');
      const on = wrap.classList.contains('k-ct-deal');
      const seats = [...wrap.querySelectorAll('.k-tnode')]
        .map(b2 => b2.style.getPropertyValue('--seat').trim());
      const delays = [...wrap.querySelectorAll('.k-tnode')]
        .map(b2 => parseFloat(getComputedStyle(b2).animationDelay) || 0);
      window.R.kindle('mira.twinfang');
      return { on, seats, rising: delays[9] > delays[0],
               afterBuy: document.getElementById('k-camp-tree').classList.contains('k-ct-deal') };
    });
    check('FIRE: the memories deal in when you sit down, and stay put when you spend',
      deal.on && deal.rising && deal.seats.length === 10
      && new Set(deal.seats).size === 10 && !deal.afterBuy,
      JSON.stringify(deal));

  }

  // A SCENE THAT IS NOT ASKING A QUESTION HAS NO ANSWERS LYING AROUND.
  // Three kinds of scene share this screen and two of them end on a fork.
  // Hiding the fork used to leave its buttons in the DOM, so the next scene
  // opened with the last one's answers behind it — invisible, but present and
  // still matching every selector that looks for a fork. The soak stalled on
  // it; a player never could have, which is why it needed a random walk.
  console.log('\n── no ghosts on the fork ──');
  {
    const ghosts = await J(() => {
      const out = {};
      const forks = () => document.querySelectorAll('#k-scene-fork .k-fork').length;
      window.R.resetProfile(); window.R.newRun(41);
      // a reckoning, answered
      window.R.openReckoning({ foe: 'husk', deeds: { finisher: 'mira', lastHit: 'mira',
        shields: [{ by: 'elin', for: 'ash' }], stitches: {}, brink: [], fell: [],
        asOne: 0, untouched: false } });
      let n = 0;
      while (n++ < 20 && window.R.scene() && !document.querySelector('.k-fork-reck')) window.R.sceneNext();
      out.reckFork = forks();
      document.querySelectorAll('.k-fork-reck')[0].click();
      out.afterAnswer = forks();
      out.sceneGone = !window.R.scene();
      return out;
    });
    check('GHOSTS: answering a fork clears it the moment it is answered, not whenever something else redraws',
      ghosts.reckFork === 2 && ghosts.afterAnswer === 0 && ghosts.sceneGone,
      JSON.stringify(ghosts));

    // …and the real path: a mystery entered straight after a reckoning shows
    // ITS OWN two answers, not the last fight's.
    const own = await J(() => {
      window.R.newRun(41);
      window.R.openReckoning({ foe: 'husk', deeds: { finisher: 'mira', lastHit: 'mira',
        shields: [{ by: 'elin', for: 'ash' }], stitches: {}, brink: [], fell: [],
        asOne: 0, untouched: false } });
      let n = 0;
      while (n++ < 20 && window.R.scene() && !document.querySelector('.k-fork-reck')) window.R.sceneNext();
      const reckLabels = [...document.querySelectorAll('.k-fo-lbl')].map(e => e.textContent);
      document.querySelectorAll('.k-fork-reck')[0].click();
      // now a crossroads, from its first line
      const def = window.R.EVENTS[0];
      window.R._setScene(null);
      const node = { kind: 'event', event: def.id, id: 'e' };
      window.R.enterEvent ? window.R.enterEvent(node) : null;
      const atFirstBeat = document.querySelectorAll('#k-scene-fork .k-fork').length;
      let m = 0;
      while (m++ < 20 && window.R.scene() && !document.querySelector('.k-fork-opt')) window.R.sceneNext();
      const evLabels = [...document.querySelectorAll('.k-fo-lbl')].map(e => e.textContent);
      return { reckLabels, atFirstBeat, evLabels,
               shared: evLabels.filter(x => reckLabels.indexOf(x) >= 0) };
    });
    check('GHOSTS: a crossroads after a fight offers its own answers, never the last fight\u2019s',
      own.atFirstBeat === 0 && own.evLabels.length === 2 && own.shared.length === 0,
      JSON.stringify(own));
  }

  const r = report();
  await H.browser.close();
  process.exit(r.passed === r.total && r.errs === 0 ? 0 : 1);
})();
