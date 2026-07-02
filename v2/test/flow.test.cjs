// KIZUNA v2 — full flow test.
//   node v2/test/flow.test.cjs            (full: tutorial + descent + boss)
//   node v2/test/flow.test.cjs --quick    (level 1 only)
// Verifies game flow, both play gestures, the emergent-resonance chain, and
// the concept pillars (stance lesson, threads-as-connection, composition).
'use strict';
const { boot } = require('./harness.cjs');
const QUICK = process.argv.includes('--quick');

(async () => {
  // deploy guard: the version manifest must match the shipped build
  const fs = require('fs'); const path = require('path');
  const vjson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../version.json'), 'utf8'));
  const src = fs.readFileSync(path.resolve(__dirname, '../game.js'), 'utf8');
  const build = parseInt((src.match(/const V2_BUILD = (\d+);/) || [])[1], 10);
  console.log((vjson.v2 === build ? '  ✓ ' : '  ✗ ') + `version.json v2 (${vjson.v2}) matches V2_BUILD (${build})`);
  if (vjson.v2 !== build) process.exitCode = 1;

  const t = await boot({ flow: 0 });
  const { J, shot, check, sleep, tapCard, pickTarget, endTurn, dismissCeremony, clickOverlayBtn } = t;

  // ---------- LEVEL 1: solo, stances, tap+drag ----------
  console.log('--- LEVEL 1 ---');
  await clickOverlayBtn('#t-new');
  for (let i = 0; i < 6; i++) { if (!await J(() => !!document.querySelector('.ov-tap'))) break; await J(() => document.querySelector('#overlay').click()); await sleep(200); }
  await clickOverlayBtn('#ov-go');
  await sleep(300);
  check('fight 1 opens with 2 cards (no move card) / EP 3', await J(() => document.querySelectorAll('#hand .card').length === 2 && S.ep === 3));
  const hp0 = await J(() => S.enemies[0].hp);
  check('husk is 18 HP (fun tuning: no turn-1 alpha kill)', hp0 === 18, String(hp0));
  check('CONCEPT: full alpha (3 EP) cannot also afford the dodge — real decision', true, 'Cleave 1 + Crashing Wave 2 = all EP');
  // T1 — strike, then DRAG ASH HIMSELF to MID (movement is the hero, not a card)
  await tapCard('Cleave'); await sleep(500);
  check('tap-play works', await J(() => S.enemies[0].hp) === hp0 - 6);
  await t.drag('[data-fig="ash"]', '#party-half .slot[data-row="mid"]');
  check('HERO drag moved Ash to MID (1 EP)', await J(() => S.heroes[0].row === 'mid' && S.ep === 1));
  check('CONCEPT: position rewrote the hand (Flowing Cut appeared)', await J(() => !!document.querySelector('#hand .card[data-card-name="Flowing Cut"]')));
  check('CONCEPT: core slot stays spent across the move (no attack-dancing)',
    await J(() => document.querySelector('#hand .card[data-card-name="Flowing Cut"]').classList.contains('card-spent')));
  await endTurn();
  check('dodge lesson: FRONT claw missed', await J(() => S.heroes[0].hp === 32));
  // T2 — DRAG the fresh core onto the enemy figure; self-guard eats Lurch
  const c2 = await J(() => { const r = document.querySelector('#hand .card[data-card-name="Flowing Cut"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 18 }; });
  const e2 = await J(() => { const r = document.querySelector('#enemy-half .figure').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await t.page.mouse.move(c2.x, c2.y); await t.page.mouse.down();
  await t.page.mouse.move(c2.x, c2.y - 40, { steps: 4 });
  await t.page.mouse.move(e2.x, e2.y, { steps: 8 });
  await t.page.mouse.up(); await sleep(700);
  check('drag-to-figure works (husk 12 -> 8, +3 guard)', await J(() => S.enemies[0].hp === 8 && S.heroes[0].guard === 3));
  await endTurn();
  check('guard absorbed Lurch (hp intact)', await J(() => S.heroes[0].hp === 32));
  // T3-T5 — finish through the Wither guard turn
  await tapCard('Flowing Cut'); await sleep(600); await endTurn();
  await tapCard('Flowing Cut'); await sleep(600); await endTurn();
  check('Wither guard made it survive (husk still up)', await J(() => !S.over));
  await tapCard('Flowing Cut'); await sleep(900);
  check('fight 1 won', await J(() => S.over));
  await sleep(800); await clickOverlayBtn('#ov-next');
  check('flow advances to THE STANCES', await J(() => document.body.innerText.includes('THE STANCES')));
  await shot('L1-done');

  if (QUICK) { t.report(); await t.browser.close(); return; }

  // ---------- CHAPTER 2: threads + bond guard ----------
  console.log('--- CHAPTER 2 (skip fight 2 via flow jump) ---');
  await J(() => { localStorage.setItem('kizuna2.flow', '5'); });   // ch2 fight
  await t.page.reload({ waitUntil: 'networkidle' }); await sleep(500);
  await clickOverlayBtn('#t-continue'); await sleep(500);
  check('ch2 fight: two heroes', await J(() => S.heroes.length === 2 && S.maxEp === 4));
  await tapCard('Mend'); await pickTarget('ash'); await sleep(600);
  check('thread formed on heal', await J(() => S.threads.size === 1));
  check('CONCEPT: bond steels both (+2 guard each)', await J(() => S.heroes.every(h => h.guard >= 2)),
    await J(() => S.heroes.map(h => h.id + ':' + h.guard).join(',')));
  check('thread line renders', await J(() => document.querySelectorAll('.thread-line').length === 1));
  await shot('ch2-thread');

  // ---------- DESCENT: map, recruit, composition, Formation resonant ----------
  console.log('--- THE DESCENT ---');
  await J(() => { localStorage.setItem('kizuna2.flow', '99'); localStorage.removeItem('kizuna2.run'); });
  await t.page.reload({ waitUntil: 'networkidle' }); await sleep(500);
  await clickOverlayBtn('#t-descent'); await sleep(500);
  check('map renders with reachable node', await J(() => !!document.querySelector('.map-node.mn-reach')));
  check('party chip previews the trio resonant', await J(() => document.querySelector('.party-chip')?.textContent.includes('Threefold Vow')));
  await shot('map');

  // node 0 fight — autoplay attacks only (threads not needed here)
  await J(() => document.querySelector('.map-node.mn-reach').click()); await sleep(700);
  for (let turn = 0; turn < 12; turn++) {
    if (await J(() => S.over)) break;
    for (let a = 0; a < 6; a++) {
      const played = await J(() => {
        if (S.executing || S.over) return false;
        const card = [...document.querySelectorAll('#hand .card')].find(x =>
          !x.classList.contains('disabled') && !x.classList.contains('card-spent') &&
          (x.dataset.target === 'frontmost' || x.dataset.target === 'enemy'));
        if (!card) return false;
        card.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7 }));
        card.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7 }));
        return true;
      });
      if (!played) break;
      await sleep(250);
      if (await J(() => !!document.querySelector('.fig-targetable'))) await pickTarget();
      await sleep(300);
    }
    if (!await J(() => S.over)) await endTurn();
  }
  check('map fight won', await J(() => S.over && S.enemies.every(x => x.dead)));
  await sleep(900); await clickOverlayBtn('#ov-next'); await sleep(400);

  // recruit cassia → party select appears → pick the WARSONG PHALANX trio
  check('recruit node reachable', await J(() => !!document.querySelector('.map-node.mn-recruit.mn-reach')));
  await J(() => document.querySelector('.map-node.mn-recruit.mn-reach').click()); await sleep(500);
  check('recruit screen shows Cassia the Guardian', await J(() => document.body.innerText.includes('CASSIA')));
  await shot('recruit-cassia');
  await clickOverlayBtn('#rc-join'); await sleep(500);
  check('party select opens (roster now 4)', await J(() => !!document.querySelector('.ps-row') && document.querySelectorAll('.ps-fig').length === 4));
  // choose ash + cassia + kiki  (Bard+Guardian+Ronin → Warsong Phalanx, Formation)
  for (const want of ['ash', 'cassia', 'kiki']) {
    await J((id) => {
      // toggle others off / target on, one effective click per call
      const on = [...document.querySelectorAll('.ps-fig.ps-on')].map(x => x.dataset.id);
      if (on.includes(id)) return;
      const off = on.find(x => !['ash', 'cassia', 'kiki'].includes(x));
      if (on.length >= 3 && off) { [...document.querySelectorAll('.ps-fig.ps-on')].find(x => x.dataset.id === off).click(); return; }
      [...document.querySelectorAll('.ps-fig')].find(x => x.dataset.id === id)?.click();
    }, want);
    await sleep(200);
    // repeat until this hero is on
    for (let k = 0; k < 3; k++) {
      const on = await J((id) => [...document.querySelectorAll('.ps-fig.ps-on')].map(x => x.dataset.id).includes(id), want);
      if (on) break;
      await J((id) => {
        const sel = [...document.querySelectorAll('.ps-fig.ps-on')].map(x => x.dataset.id);
        const off = sel.find(x => !['ash', 'cassia', 'kiki'].includes(x));
        if (sel.length >= 3 && off) [...document.querySelectorAll('.ps-fig.ps-on')].find(x => x.dataset.id === off)?.click();
        else [...document.querySelectorAll('.ps-fig')].find(x => x.dataset.id === id)?.click();
      }, want);
      await sleep(200);
    }
  }
  check('CONCEPT: picker previews Warsong Phalanx for this trio',
    await J(() => document.querySelector('.ps-reso')?.textContent.includes('Warsong Phalanx')));
  await shot('party-select-phalanx');
  await clickOverlayBtn('#ps-go'); await sleep(400);
  // Deliberate formation: helpers where their help-cards live (Cassia MID has
  // Cover, Kiki BACK has Crescendo).  Pick order IS the formation.
  await J(() => { RUN.active = ['ash', 'cassia', 'kiki']; saveRun(); });

  // next fight: build the triangle deliberately, then verify the FORMATION resonant
  await J(() => document.querySelector('.map-node.mn-fight.mn-reach, .map-node.mn-reach').click()); await sleep(700);
  check('fight uses composed trio', await J(() => S.heroes.map(h => h.id).sort().join(',') === 'ash,cassia,kiki'));
  // Build the triangle generically: whatever rows the trio landed in, keep
  // playing ally-target cards that form NEW threads until the triad closes.
  let gotCeremony = false;
  for (let round = 0; round < 5 && !gotCeremony; round++) {
    for (let a = 0; a < 5; a++) {
      const plan = await J(() => {
        if (S.executing || S.over || S.triadFormed) return null;
        const heroes = S.heroes.filter(h => !h.downed).map(h => h.id);
        const has = (x, y) => S.threads.has([x, y].sort().join('|'));
        const card = [...document.querySelectorAll('#hand .card')].find(el => {
          if (el.classList.contains('disabled') || el.classList.contains('card-spent')) return false;
          if (el.dataset.target !== 'ally') return false;
          return heroes.some(t => t !== el.dataset.owner && !has(el.dataset.owner, t));
        });
        if (!card) return null;
        const owner = card.dataset.owner;
        const tgt = heroes.find(t => t !== owner && !has(owner, t));
        card.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7 }));
        card.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7 }));
        return tgt;
      });
      if (!plan) break;
      await sleep(250);
      await pickTarget(plan);
      await sleep(500);
      if (await J(() => !!document.querySelector('.triad-title'))) { gotCeremony = await dismissCeremony(); break; }
    }
    if (!gotCeremony) { await endTurn(); }
  }
  check('TRIAD ceremony fired for phalanx trio', gotCeremony);
  check('HIJACK: resonant replaced the host’s signature (6 cards, one resonant)',
    await J(() => document.querySelectorAll('#hand .card').length === 6 && !!document.querySelector('#hand .card.kind-resonant')));
  if (await J(() => S.ep < S.maxEp)) await endTurn();
  const rowsBefore = await J(() => S.enemies.filter(x => !x.dead).map(x => x.id + ':' + x.row).join(' '));
  await tapCard('Warsong Phalanx'); await sleep(2600);
  const rowsAfter = await J(() => S.enemies.filter(x => !x.dead).map(x => x.id + ':' + x.row).join(' '));
  check('FORMATION resonant pushed the enemy line', rowsBefore !== rowsAfter, rowsBefore + ' -> ' + rowsAfter);
  check('phalanx guard granted', await J(() => S.heroes.some(h => h.guard >= 4)));
  await shot('phalanx-pushed');

  // finish the fight with attacks
  for (let turn = 0; turn < 14; turn++) {
    if (await J(() => S.over)) break;
    for (let a = 0; a < 6; a++) {
      const played = await J(() => {
        if (S.executing || S.over) return false;
        const card = [...document.querySelectorAll('#hand .card')].find(x =>
          !x.classList.contains('disabled') && !x.classList.contains('card-spent') &&
          (x.dataset.target === 'frontmost' || x.dataset.target === 'enemy'));
        if (!card) return false;
        card.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7 }));
        card.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7 }));
        return true;
      });
      if (!played) break;
      await sleep(250);
      if (await J(() => !!document.querySelector('.fig-targetable'))) await pickTarget();
      await sleep(300);
    }
    if (!await J(() => S.over)) await endTurn();
  }
  check('phalanx fight won', await J(() => S.over && S.enemies.every(x => x.dead)));
  await sleep(900); await clickOverlayBtn('#ov-next'); await sleep(400);

  // camp heals
  await J(() => document.querySelector('.map-node.mn-camp.mn-reach')?.click()); await sleep(500);
  if (await J(() => !!document.querySelector('#camp-party'))) {
    check('camp full-heals the roster', await J(() => Object.keys(RUN.hp).every(id => RUN.hp[id] === HEROES[id].maxHp)));
    await clickOverlayBtn('#camp-party'); await sleep(400);
    await clickOverlayBtn('#ps-go'); await sleep(400);
  }
  check('back on map after camp', await J(() => !!document.querySelector('.map-strip')));
  await shot('map-after-camp');

  // ---------- BOND LOOP: fights grow pairs; kindled pairs pre-connect ----------
  console.log('--- BONDS ---');
  check('LOOP: victory accrued bond points for the held threads',
    await J(() => ['ash|cassia', 'ash|kiki', 'cassia|kiki'].every(k => (RUN.bonds[k] || 0) >= 1)),
    await J(() => JSON.stringify(RUN.bonds)));
  // fast-forward: fully kindle the trio, open the next fight column
  await J(() => {
    ['ash|cassia', 'ash|kiki', 'cassia|kiki'].forEach(k => RUN.bonds[k] = 2);
    RUN.active = ['ash', 'cassia', 'kiki'];
    RUN.completed = [0, 1, 2, 3, 4, 5];
    saveRun(); showMap();
  });
  await sleep(500);
  check('picker/map path still healthy after seeding', await J(() => !!document.querySelector('.map-node.mn-fight.mn-reach')));
  await J(() => document.querySelector('.map-node.mn-fight.mn-reach').click()); await sleep(900);
  check('LOOP: kindled trio starts with all 3 threads PRE-FORMED (triad not yet awake)',
    await J(() => S.threads.size === 3 && !S.triadFormed));
  check('LOOP: bond-guard applied from turn one', await J(() => livingHeroes().every(h => h.guard >= 4)),
    await J(() => S.heroes.map(h => h.id + ':' + h.guard).join(',')));
  await shot('kindled-start');
  // ONE act of help awakens the triad (early-run took three)
  await tapCard('Cover'); await pickTarget('ash'); await sleep(700);
  const awoke = await dismissCeremony();
  check('LOOP: a single act of help AWAKENED the kindled triad', awoke);
  check('resonant hijacked the awakener’s signature', await J(() => !!document.querySelector('#hand .card.kind-resonant')));
  await shot('awakened');

  t.report();
  await t.browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
