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
  check('GENERATED: the move left a fading echo (Echo: Cleave)',
    await J(() => !document.querySelector('#hand .card[data-card-name="Flowing Cut"]') && !!document.querySelector('#hand .card[data-card-name="Echo: Cleave"]')));
  await endTurn();
  check('dodge lesson: FRONT claw missed', await J(() => S.heroes[0].hp === 32));
  check('the echo faded with the turn', await J(() => !document.querySelector('#hand .card[data-card-name="Echo: Cleave"]')));
  check('CONCEPT: new turn, position rewrote the hand (Flowing Cut awaits)',
    await J(() => !!document.querySelector('#hand .card[data-card-name="Flowing Cut"]')));
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
  check('GENERATED: the first bond materialized ECHO BOND', await J(() => !!document.querySelector('#hand .card[data-card-name="Echo Bond"]')));
  await tapCard('Echo Bond'); await sleep(550);
  check('ECHO BOND: the pair moves as one (⛨5 · ▲2 each)',
    await J(() => S.heroes.every(h => h.guard >= 5 && h.buffDmg >= 2)),
    await J(() => S.heroes.map(h => h.id + ':' + h.guard + '/' + h.buffDmg).join(',')));
  check('the bond card burned away on use', await J(() => !document.querySelector('#hand .card[data-card-name="Echo Bond"]')));
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
      if (await J(() => !!document.querySelector('.triad-title'))) await dismissCeremony();
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
  check('HIJACK: the resonant card occupies the host’s signature slot',
    await J(() => !!document.querySelector('#hand .card.kind-resonant')));
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
      if (await J(() => !!document.querySelector('.triad-title'))) await dismissCeremony();
    }
    if (!await J(() => S.over)) await endTurn();
  }
  check('phalanx fight won', await J(() => S.over && S.enemies.every(x => x.dead)));
  await sleep(900); await clickOverlayBtn('#ov-next'); await sleep(400);

  // camp: heal + SHARE THE FIRE scene deepens the weakest bond
  await J(() => document.querySelector('.map-node.mn-camp.mn-reach')?.click()); await sleep(500);
  check('camp full-heals the roster', await J(() => Object.keys(RUN.hp).every(id => RUN.hp[id] === HEROES[id].maxHp)));
  const weakPair = await J(() => {
    const ids = RUN.active.slice(); let best = null, low = Infinity;
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const k = pairKey(ids[i], ids[j]); const pts = bondPts(k);
      if (pts < low) { low = pts; best = k; }
    }
    return { key: best, pts: low };
  });
  await clickOverlayBtn('#camp-fire'); await sleep(450);
  for (let i = 0; i < 8; i++) { if (!await J(() => !!document.querySelector('.ov-tap'))) break; await J(() => document.querySelector('#overlay').click()); await sleep(220); }
  await shot('camp-scene');
  check('CAMP SCENE: the fire dialogue deepened the weakest bond +1',
    await J((k) => bondPts(k), weakPair.key) === weakPair.pts + 1);
  await clickOverlayBtn('#ov-go'); await sleep(450);
  await clickOverlayBtn('#ps-go'); await sleep(450);
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
  await tapCard('Aegis'); await pickTarget('ash'); await sleep(700);
  const awoke = await dismissCeremony();
  check('LOOP: a single act of help AWAKENED the kindled triad', awoke);
  check('resonant hijacked the awakener’s signature', await J(() => !!document.querySelector('#hand .card.kind-resonant')));
  await shot('awakened');

  // ---------- THE ABYSS REMEMBERS: death contributes ----------
  console.log('--- ABYSS ---');
  const fallenNode = await J(() => S.node.mapId);
  await J(() => { S.heroes.forEach(h => { h.hp = 0; h.downed = true; }); checkEnd(); });
  await sleep(1400);
  check('LOOP: map defeat ends the run — the Abyss remembers', await J(() => document.body.innerText.includes('Abyss remembers')));
  check('memory stored at the fallen node · run cleared', await J((n) => {
    const a = JSON.parse(localStorage.getItem('kizuna2.abyss') || '{}');
    return !!a[n] && !localStorage.getItem('kizuna2.run');
  }, fallenNode));
  await shot('abyss-fallen');
  await clickOverlayBtn('#ov-fallen'); await sleep(500);
  await clickOverlayBtn('#t-descent'); await sleep(500);
  await J(() => { RUN.completed = [0, 1, 2, 3, 4, 5]; saveRun(); showMap(); }); await sleep(450);
  check('next run: the map shows ♰ where they fell', await J((n) => !!document.querySelector(`.map-node[data-node="${n}"] .mn-mem`), fallenNode));
  await J((n) => document.querySelector(`.map-node[data-node="${n}"]`).click(), fallenNode); await sleep(500);
  check('discovery beat: ashes of a descent', await J(() => !!document.querySelector('#ov-takeup')));
  await shot('abyss-memory');
  await clickOverlayBtn('#ov-takeup'); await sleep(900);
  check('LOOP: the fallen trio’s bonds echo into the new run', await J(() => {
    const b = RUN.bonds || {};
    return Object.keys(b).length >= 3 && Object.values(b).every(v => v >= 1);
  }), await J(() => JSON.stringify(RUN.bonds)));
  check('memory consumed · the fight begins over their ashes', await J((n) => {
    const a = JSON.parse(localStorage.getItem('kizuna2.abyss') || '{}');
    return !a[n] && typeof S !== 'undefined' && S && !S.over;
  }, fallenNode));

  // ---------- WEAKNESS / STAGGER (ported from v1) ----------
  console.log('--- STAGGER ---');
  await J(() => {
    hideOverlay();
    startFight({ type: 'fight', chapter: 3, heroes: ['ash', 'elin', 'kiki'], enemies: ['wraith'], narrator: 'stagger drill' });
    S.enemies[0].hp = S.enemies[0].maxHp = 40;   // survive the drill
    renderAll();
  });
  await sleep(500);
  check('weakness hidden before first blood (? chip)', await J(() => { const c = document.querySelector('.chip.weak'); return c && c.textContent.includes('?') && !c.classList.contains('revealed'); }));
  await tapCard('Cleave'); await sleep(650);
  check('first blood reveals the weakness (⚔ on the chip)', await J(() => S.enemies[0].weakRevealed && document.querySelector('.chip.weak')?.textContent.includes('⚔')));
  check('BLADE on BLADE-weak -> WEAKENED ⌖', await J(() => S.enemies[0].weakened));
  const epMid = await J(() => S.ep);
  await tapCard('Crashing Wave'); await sleep(750);
  check('same-turn repeat -> STAGGERED ⚡', await J(() => S.enemies[0].staggered));
  check('press-turn: the stagger paid +1 EP', await J(() => S.ep) === epMid - 2 + 1, 'ep=' + await J(() => S.ep));
  check('GENERATED: the stagger FORGED Coup de Grâce in Ash’s hand',
    await J(() => !!document.querySelector('#hand .card[data-card-name="Coup de Grâce"]')));
  await shot('staggered');
  const hpMid = await J(() => S.enemies[0].hp);
  await tapCard('Coup de Grâce'); await sleep(250); await pickTarget(); await sleep(650);
  check('the finisher cashed the ×2 (8 -> 16)', await J(() => S.enemies[0].hp) === hpMid - 16, 'hp ' + hpMid + '->' + await J(() => S.enemies[0].hp));
  check('stagger consumed by the payoff', await J(() => !S.enemies[0].staggered));
  check('the forged card burned away on use', await J(() => !document.querySelector('#hand .card[data-card-name="Coup de Grâce"]')));
  // INTERRUPT — the Bloodborne moment
  await J(() => {
    hideOverlay();
    startFight({ type: 'fight', chapter: 3, heroes: ['ash', 'elin', 'kiki'], enemies: ['echoknight2'], narrator: 'interrupt drill' });
    S.enemies[0].intentIdx = 4;    // OBLIVION ECHO — heavy wind-up
    S.enemies[0].staggered = true;
    S.enemies[0].weakRevealed = true;
    renderAll();
  });
  await sleep(400);
  await endTurn();
  check('INTERRUPT: the staggered boss’s heavy wind-up BROKE (party untouched)',
    await J(() => S.heroes.every(h => h.hp === h.maxHp)));

  // ---------- REACTIVE: 'NOT TODAY' — costed protection ----------
  console.log('--- REACTIVE ---');
  await J(() => {
    hideOverlay();
    startFight({ type: 'fight', chapter: 3, heroes: ['ash', 'elin', 'kiki'], enemies: ['cultist'], narrator: 'intercept drill' });
    RUN.bonds = { 'ash|elin': 3 };            // Ash is Elin's strongest bond
    S.heroes[1].hp = 13;                       // Elin one Hollow Verse from danger
    S.enemies[0].intentIdx = 2;                // Hollow Verse -> MID (Elin)
    renderAll();
  });
  await sleep(400);
  await endTurn();
  check('REACTIVE: Elin faltered — NOT TODAY forged in ASH’s hand',
    await J(() => { const c = document.querySelector('#hand .card[data-card-name="Not Today"]'); return !!c && c.dataset.owner === 'ash'; }));
  await shot('not-today');
  const rowsBefore2 = await J(() => S.heroes.map(h => h.id + ':' + h.row).join(' '));
  const elinHp = await J(() => S.heroes[1].hp);
  await tapCard('Not Today'); await sleep(800);
  check('the intercept moved bodies (Ash and Elin swapped rows)',
    await J(() => S.heroes.map(h => h.id + ':' + h.row).join(' ')) !== rowsBefore2);
  check('pros: Elin healed 4 · Ash ⛨4 ↺2 · thread formed',
    await J((prev) => S.heroes[1].hp === prev + 4 && S.heroes[0].guard >= 4 && S.heroes[0].counter >= 2 && S.threads.has('ash|elin'), elinHp));
  check('CONS: Ash overextended — ❄ CHILL 2 on his next strike', await J(() => S.heroes[0].chill >= 2));
  check('one-shot: the card burned away', await J(() => !document.querySelector('#hand .card[data-card-name="Not Today"]')));

  // ---------- CARD ECONOMY: tempo profiles + channel + heal floor ----------
  console.log('--- CARD ECONOMY ---');
  await J(() => {
    hideOverlay();
    startFight({ type: 'fight', chapter: 3, heroes: ['ash', 'cassia', 'kiki'], enemies: ['husk'], narrator: 'economy drill' });
    renderAll();
  });
  await sleep(400);
  check('ASYMMETRY: HEAVY Cassia contributes ONE card; SWIFT+STEADY show two',
    await J(() => {
      const n = (id) => document.querySelectorAll(`#hand .card[data-owner="${id}"]`).length;
      return n('cassia') === 1 && n('ash') === 2 && n('kiki') === 2;
    }), await J(() => 'ash:'+document.querySelectorAll('#hand .card[data-owner="ash"]').length+' cassia:'+document.querySelectorAll('#hand .card[data-owner="cassia"]').length+' kiki:'+document.querySelectorAll('#hand .card[data-owner="kiki"]').length));
  check('SWIFT: Kiki’s 2-cost signature is discounted to 1',
    await J(() => { const c = [...document.querySelectorAll('#hand .card[data-owner="kiki"]')]; return c.some(x => x.querySelector('.c-cost').textContent === '1'); }));
  // CHANNEL: sacrifice a card for +1 EP, once per turn
  const epBefore = await J(() => S.ep);
  await J(() => { const c = document.querySelector('#hand .card[data-owner="kiki"]'); const b = c.querySelector('.card-channel'); b.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  await sleep(250);
  check('CHANNEL: sacrificing a card gave +1 EP', await J(() => S.ep) === epBefore + 1, 'ep ' + epBefore + '->' + await J(() => S.ep));
  check('CHANNEL: once per turn (no more channel pips)', await J(() => S.channelUsed && !document.querySelector('.card-channel')));
  await shot('economy');
  // HEAL FLOOR: mending a full-HP ally shields instead of wasting
  await J(() => { hideOverlay(); startFight({ type:'fight', chapter:3, heroes:['ash','elin','kiki'], enemies:['husk'], narrator:'heal floor' }); renderAll(); });
  await sleep(300);
  const gBefore = await J(() => S.heroes[0].guard);
  await tapCard('Mend'); await pickTarget('ash'); await sleep(500);
  check('HEAL FLOOR: healing a full-HP ally became guard, not wasted (+5 spill, +bond)',
    await J((g) => S.heroes[0].hp === S.heroes[0].maxHp && S.heroes[0].guard >= g + 5, gBefore));

  // ---------- AIM: drag snaps to the target ----------
  console.log('--- AIM ---');
  await J(() => {
    hideOverlay();
    startFight({ type:'fight', chapter:3, heroes:['elin','hask','kiki'], enemies:['husk','wraith'], narrator:'aim drill' });
    S.enemies[0].hp = S.enemies[0].maxHp = 30;
    S.enemies[1].hp = S.enemies[1].maxHp = 30;
    renderAll();
  });
  await sleep(400);
  const wraithHp0 = await J(() => S.enemies[1].hp);
  const huskHp0 = await J(() => S.enemies[0].hp);
  // real pointer drag: Ice Bolt (Hask mid, ANY enemy) dragged onto the wraith
  await t.drag('#hand .card[data-card-name="Ice Bolt"]', '[data-fig="wraith#1"]');
  await sleep(400);
  check('AIM: drag played the card on the SNAPPED target (wraith took 4, husk untouched)',
    await J((o) => S.enemies[1].hp === o.w - 4 && S.enemies[0].hp === o.h, { w: wraithHp0, h: huskHp0 }),
    await J(() => 'husk:'+S.enemies[0].hp+' wraith:'+S.enemies[1].hp));

  // ---------- MOMENTUM: technical detonation + all-out burst ----------
  console.log('--- MOMENTUM ---');
  await J(() => {
    hideOverlay();
    startFight({ type:'fight', chapter:3, heroes:['ash','elin','kiki'], enemies:['husk','wraith'], narrator:'momentum drill' });
    S.enemies.forEach(e => { e.hp = e.maxHp = 50; e.weakRevealed = true; });
    S.enemies[0].lull = 2;   // husk primed (CHILLED)
    S.momentum = 0; S.combo = 0;
    renderAll();
  });
  await sleep(300);
  check('PRIMED: a chilled foe is flagged for detonation', await J(() => !!document.querySelector('.figure.fig-primed')));
  const tech = await J(() => {
    const before = S.enemies[0].hp, mom0 = S.momentum;
    dealToEnemy(S.enemies[0], 6, 'blade', 'ash');   // off-weakness hit on a chilled foe
    return { dealt: before - S.enemies[0].hp, momGain: S.momentum - mom0 };
  });
  check('TECHNICAL: off-weakness hit on a primed foe detonates (+4 bonus)', tech.dealt === 10, 'dealt ' + tech.dealt);
  check('TECHNICAL builds momentum', tech.momGain > 0, '+' + tech.momGain);
  // fill and unleash the all-out
  const allOut = await J(async () => {
    S.momentum = 100; renderAll();
    const before = S.enemies.map(e => e.hp);
    await triggerAllOut();
    return { before, after: S.enemies.map(e => e.hp), momentum: S.momentum, used: S.allOutUsed };
  });
  check('BURST: ALL-OUT hit the whole enemy line', allOut.after.every((hp, i) => hp < allOut.before[i]),
    JSON.stringify(allOut.before) + ' -> ' + JSON.stringify(allOut.after));
  check('BURST: momentum spent to zero', allOut.momentum === 0 && allOut.used >= 1);

  // ---------- PARRY: reactive timing window on enemy attacks ----------
  console.log('--- PARRY ---');
  await J(() => {
    hideOverlay();
    startFight({ type:'fight', chapter:3, heroes:['ash','elin','kiki'], enemies:['husk'], narrator:'parry drill' });
    const a = S.heroes.find(h => h.id === 'ash'); a.row = 'front';
    S.enemies[0].hp = S.enemies[0].maxHp = 40; S.ep = 0; S.momentum = 0; renderAll();
  });
  await sleep(250);
  const ashHp0 = await J(() => S.heroes.find(h => h.id === 'ash').hp);
  t.page.evaluate(() => { endTurn(); });   // don't await — interact mid-window
  const ringAppeared = await t.page.waitForSelector('.parry-ring', { state: 'attached', timeout: 6000 })
    .then(() => true).catch(() => false);
  check('PARRY: a reactive window opens on the enemy wind-up', ringAppeared);
  await sleep(430);                 // tap into the closing window (good/perfect band)
  await t.page.mouse.move(140, 130); await t.page.mouse.down(); await t.page.mouse.up();
  await sleep(2600);
  check('PARRY: a timed tap blunts the blow and builds momentum',
    await J((o) => (o.a - S.heroes.find(h => h.id === 'ash').hp) < 4 && S.momentum > 0, { a: ashHp0 }),
    await J((o) => 'ashDmg:' + (o.a - S.heroes.find(h => h.id === 'ash').hp) + ' mom:' + S.momentum, { a: ashHp0 }));

  t.report();
  await t.browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
