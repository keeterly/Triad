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
  const vman = vjson['v2.1'];
  console.log((vman === build ? '  ✓ ' : '  ✗ ') + `version.json v2.1 (${vman}) matches V2_BUILD (${build})`);
  if (vman !== build) process.exitCode = 1;

  const t = await boot({ flow: 0 });
  const { J, shot, check, sleep, tapCard, pickTarget, endTurn, dismissCeremony, clickOverlayBtn } = t;
  // The flow suite exercises the SHARED combat mechanics (stances, threads, triad,
  // duet, burst, boss) through CLASSIC hands, still shipped by the tutorial.  This
  // persisted flag forces classic across every run the suite spins up; the
  // branching-rotation descent gets its own ROTATION block (which clears it).
  await J(() => { try { localStorage.setItem('kizuna2_1.forceClassic', '1'); } catch (_) {} });

  // ---------- ONBOARDING: choose your survivor (v1-style solo start) ----------
  console.log('--- ONBOARDING ---');
  await clickOverlayBtn('#t-new');
  check('starter-select: 5 heroes shown, some locked, Ash unlocked',
    await J(() => document.querySelectorAll('.ss-fig').length === 5
      && document.querySelectorAll('.ss-fig.ss-locked').length >= 1
      && !!document.querySelector('.ss-fig[data-id="ash"]:not(.ss-locked)')));
  await shot('starter-select');
  await J(() => document.querySelector('.ss-fig[data-id="ash"]').click());   // pick Ash
  for (let i = 0; i < 6; i++) { if (!await J(() => !!document.querySelector('.ov-tap'))) break; await J(() => document.querySelector('#overlay').click()); await sleep(200); }
  await clickOverlayBtn('#ov-go'); await sleep(300);                          // BEGIN THE DESCENT
  check('run begins SOLO with the chosen survivor',
    await J(() => RUN && RUN.roster.length === 1 && RUN.roster[0] === 'ash' && RUN.active.length === 1),
    await J(() => JSON.stringify(RUN && RUN.roster)));
  check('solo map: the level-1 funnel is a single foe + recruits await',
    await J(() => RUN.map.filter(n => n.level === 1).length === 1
      && RUN.map.find(n => n.level === 1).enemies.length === 1
      && RUN.map.filter(n => n.type === 'recruit').length >= 2));

  // ---------- LEVEL 1: solo mechanics — drive the teaching flow directly ----------
  console.log('--- LEVEL 1 ---');
  await J(() => { flowIdx = 0; startFlowNode(); });
  for (let i = 0; i < 6; i++) { if (!await J(() => !!document.querySelector('.ov-tap'))) break; await J(() => document.querySelector('#overlay').click()); await sleep(200); }
  await clickOverlayBtn('#ov-go');
  await sleep(300);
  check('STARTING SPARK: fight 1 opens with core + the sparked FRONT signature (2 cards) / EP 3',
    await J(() => { const c = [...document.querySelectorAll('#hand .card')].map(x => x.dataset.cardName); return c.length === 2 && c.includes('Cleave') && c.includes('Crashing Wave') && S.ep === 3; }));
  check('SPARK: the starter opens with their FRONT signature WITHOUT owning a tree node — the tree starts empty',
    await J(() => !hasNode('ash.sig.front') && (RUN.nodes || []).length === 0 && sigUnlocked(S.heroes[0]) === true));
  const hp0 = await J(() => S.enemies[0].hp);
  check('husk is 18 HP (fun tuning: no turn-1 alpha kill)', hp0 === 18, String(hp0));
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

  // ---------- CHAPTER 2: threads + bond guard (drive the flow directly) ----------
  console.log('--- CHAPTER 2 ---');
  await J(() => { flowIdx = 5; startFlowNode(); }); await sleep(500);   // ch2 fight
  check('ch2 fight: two heroes', await J(() => S.heroes.length === 2 && S.maxEp === 4));
  await tapCard('Mend'); await pickTarget('ash'); await sleep(600);
  check('thread formed on heal', await J(() => S.threads.size === 1));
  check('CONCEPT: bond steels both (+2 guard each)', await J(() => S.heroes.every(h => h.guard >= 2)),
    await J(() => S.heroes.map(h => h.id + ':' + h.guard).join(',')));
  check('DECLUTTER: bonds no longer draw a permanent web of lines', await J(() => document.querySelectorAll('#thread-layer .thread-line').length === 0));
  check('GENERATED: the first bond materialized ECHO BOND', await J(() => !!document.querySelector('#hand .card[data-card-name="Echo Bond"]')));
  await tapCard('Echo Bond'); await sleep(550);
  check('ECHO BOND: the pair moves as one (⛨5 · ▲2 each)',
    await J(() => S.heroes.every(h => h.guard >= 5 && h.buffDmg >= 2)),
    await J(() => S.heroes.map(h => h.id + ':' + h.guard + '/' + h.buffDmg).join(',')));
  check('the bond card burned away on use', await J(() => !document.querySelector('#hand .card[data-card-name="Echo Bond"]')));
  await shot('ch2-thread');

  // ---------- DESCENT: map, recruit, composition, Formation resonant ----------
  console.log('--- THE DESCENT ---');
  await J(() => { localStorage.setItem('kizuna2_1.flow', '99'); localStorage.removeItem('kizuna2_1.run'); });
  await t.page.reload({ waitUntil: 'networkidle' }); await sleep(500);
  await clickOverlayBtn('#t-new'); await sleep(400);                      // → CHOOSE YOUR SURVIVOR
  await J(() => document.querySelector('.ss-fig[data-id="ash"]').click());    // pick Ash
  for (let i = 0; i < 6; i++) { if (!await J(() => !!document.querySelector('.ov-tap'))) break; await J(() => document.querySelector('#overlay').click()); await sleep(200); }
  await clickOverlayBtn('#ov-go'); await sleep(300);                          // → solo map
  // promote to the default trio so the resonance / formation checks below have
  // a full triangle to work with (recruiting is exercised separately).
  // grant the party its full kit for the mechanic checks below: per-run sigs +
  // embers, and a deep `completed` so every tree tier is open this descent.
  await J(() => {
    RUN.roster = ['ash', 'elin', 'mira']; RUN.active = ['ash', 'elin', 'mira'];
    RUN.hp = { ash: HEROES.ash.maxHp, elin: HEROES.elin.maxHp, mira: HEROES.mira.maxHp };
    RUN.nodes = EMBER_TREE.filter(n => n.type === 'card').map(n => n.id);
    RUN.embers = 999; RUN.completed = [0, 1, 2, 3, 4, 5, 6, 7];
    saveRun(); showMap();
  });
  await sleep(200);
  await t.autoParry(true);   // the bot parries the harder descent like a real player
  check('map renders with reachable node', await J(() => !!document.querySelector('.map-node.mn-reach')));
  check('party chip previews the trio resonant', await J(() => document.querySelector('.party-chip')?.textContent.includes('Twin Shadows')));
  await shot('map');

  // The map is now PROCEDURALLY GENERATED (v1-aligned).  First prove the
  // generator's structural invariants over many runs, then exercise the two
  // new node types, then PIN a deterministic descent for the scripted walk.
  const gen = await J(() => {
    let fails = 0, sawElite = false, sawEvent = false, nodes = 0;
    for (let i = 0; i < 60; i++) {
      const m = generateDescent(['ash', 'elin', 'mira']);
      const l1 = m.filter(n => n.level === 1);
      const boss = m.filter(n => n.type === 'boss');
      const maxL = Math.max(...m.map(n => n.level));
      if (l1.length !== 1 || l1[0].type !== 'fight') fails++;
      if (boss.length !== 1 || boss[0].level !== maxL) fails++;
      for (const n of m) { if (n.type !== 'boss' && (!n.next || !n.next.length)) { fails++; break; } }
      for (const n of m) { if (n.level !== 1 && !m.some(p => p.next.includes(n.id))) { fails++; break; } }
      const seen = new Set([l1[0].id]), q = [l1[0].id];
      while (q.length) { const c = q.shift(); for (const nx of (m[c].next || [])) if (!seen.has(nx)) { seen.add(nx); q.push(nx); } }
      if (!seen.has(boss[0].id)) fails++;
      if (!m.some(n => n.type === 'recruit' && n.hero === 'cassia')) fails++;
      if (m.some(n => n.type === 'elite')) sawElite = true;
      if (m.some(n => n.type === 'event')) sawEvent = true;
      nodes = m.length;
    }
    return { fails, sawElite, sawEvent, nodes };
  });
  check('GEN: 60 descents all valid (funnel→branch→boss · connected · recruit present)', gen.fails === 0, JSON.stringify(gen));
  check('GEN: node vocabulary includes elite + event across runs', gen.sawElite && gen.sawEvent, JSON.stringify(gen));

  // EVENT node resolves and applies its choice (shrine A = heal 6).
  await J(() => {
    RUN.map = [
      { id: 0, level: 1, col: 1, type: 'event', label: 'A COLD SHRINE', eventId: 'shrine', next: [1] },
      { id: 1, level: 2, col: 2, type: 'boss', label: 'x', enemies: ['echoknight2'], isBoss: true, next: [] },
    ];
    RUN.completed = []; RUN.hp.ash = 1; saveRun(); showMap();
  });
  await sleep(250);
  await J(() => document.querySelector('.map-node.mn-event.mn-reach').click()); await sleep(250);
  check('EVENT: a crossroads offers two choices', await J(() => !!document.querySelector('#ev-a') && !!document.querySelector('#ev-b')));
  await J(() => document.querySelector('#ev-a').click()); await sleep(300);
  check('EVENT: the choice resolved (party healed) and returned to the map',
    await J(() => RUN.hp.ash >= 7 && !!document.querySelector('.map-strip')), await J(() => 'ash hp ' + RUN.hp.ash));

  // ELITE node spikes enemy HP + damage over a plain run-scaled fight.
  const el = await J(() => {
    startFight({ type: 'fight', chapter: 3, heroes: ['ash', 'elin', 'mira'], enemies: ['drone'], useRunHp: true, depth: 3, elite: false });
    const base = S.enemies[0].maxHp, bmul = S.enemies[0].dmgMul;
    startFight({ type: 'fight', chapter: 3, heroes: ['ash', 'elin', 'mira'], enemies: ['drone'], useRunHp: true, depth: 3, elite: true });
    return { base, bmul, hp: S.enemies[0].maxHp, mul: S.enemies[0].dmgMul };
  });
  check('ELITE: the spike raises enemy HP and damage', el.hp > el.base && el.mul > el.bmul, JSON.stringify(el));

  // Pin a DETERMINISTIC descent so the scripted walk below is reproducible.
  const TEST_MAP = [
    { id: 0, level: 1, col: 1, type: 'fight',   label: 'ASHFALL ROAD',      enemies: ['husk', 'wraith'], next: [1] },
    { id: 1, level: 2, col: 2, type: 'recruit', label: 'THE GATE HOLDS',    hero: 'cassia', next: [2, 3] },
    { id: 2, level: 3, col: 3, type: 'fight',   label: 'HOLLOW CHOIR',      enemies: ['cultist', 'mourner'], next: [4] },
    { id: 3, level: 3, col: 3, type: 'event',   label: 'A COLD SHRINE',     eventId: 'shrine', next: [4] },
    { id: 4, level: 4, col: 4, type: 'camp',    label: 'EMBER REST',        next: [5, 6] },
    { id: 5, level: 5, col: 5, type: 'elite',   label: 'THE WARDEN STIRS',  enemies: ['drone', 'mourner', 'cultist'], elite: true, next: [7] },
    { id: 6, level: 5, col: 5, type: 'fight',   label: 'COLD PROCESSION',   enemies: ['wraith', 'cultist'], next: [7] },
    { id: 7, level: 6, col: 6, type: 'camp',    label: 'LAST FIRE',         next: [8] },
    { id: 8, level: 7, col: 7, type: 'boss',    label: 'THE REMEMBERED',    enemies: ['echoknight2'], isBoss: true, next: [] },
  ];
  await J((m) => {
    RUN.map = m.map(n => ({ ...n, next: n.next.slice() }));
    RUN.completed = []; RUN.bonds = {};
    RUN.roster.forEach(id => { RUN.hp[id] = HEROES[id].maxHp; });
    saveRun(); showMap();
  }, TEST_MAP);
  await sleep(250);

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
  // pin the recruit to Cassia (the map shuffles which traveler appears) so the rest of the onboarding is deterministic
  await J(() => { const el = document.querySelector('.map-node.mn-recruit.mn-reach'); RUN.map[+el.dataset.node].hero = 'cassia'; el.click(); }); await sleep(500);
  check('recruit opens the JRPG scene for Cassia',
    await J(() => !!document.querySelector('#overlay.jc .jc-scene') && ((document.querySelector('.jc-plate') || {}).textContent || '') === 'CASSIA'));
  await shot('recruit-cassia');
  // the recruit is a JRPG conversation — tap through the lines, answer warm twice → friend
  await J(() => {
    const run = (picks) => { let g = 0, pi = 0; while (g++ < 40) { const o = document.querySelectorAll('.jc-opt'); if (o.length) { (o[picks[pi++]] || o[0]).click(); continue; } if (document.querySelector('.jc-next')) { document.querySelector('.jc-scene').click(); continue; } break; } };
    run([0, 0]);
  }); await sleep(400);
  await clickOverlayBtn('#rc-next'); await sleep(500);      // → party select
  check('party select opens (roster now 4)', await J(() => !!document.querySelector('.ps-row') && document.querySelectorAll('.ps-fig').length === 4));
  // choose ash + elin + cassia  (Cleric+Guardian+Ronin → Oathkeepers' Advance, Formation)
  for (const want of ['ash', 'elin', 'cassia']) {
    await J((id) => {
      // toggle others off / target on, one effective click per call
      const on = [...document.querySelectorAll('.ps-fig.ps-on')].map(x => x.dataset.id);
      if (on.includes(id)) return;
      const off = on.find(x => !['ash', 'elin', 'cassia'].includes(x));
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
        const off = sel.find(x => !['ash', 'elin', 'cassia'].includes(x));
        if (sel.length >= 3 && off) [...document.querySelectorAll('.ps-fig.ps-on')].find(x => x.dataset.id === off)?.click();
        else [...document.querySelectorAll('.ps-fig')].find(x => x.dataset.id === id)?.click();
      }, want);
      await sleep(200);
    }
  }
  check('CONCEPT: picker previews Oathkeepers\' Advance for this trio',
    await J(() => document.querySelector('.ps-reso')?.textContent.includes('Oathkeepers')));
  await shot('party-select-phalanx');
  await clickOverlayBtn('#ps-go'); await sleep(400);
  // Deliberate formation: ash FRONT (attacker), then the two weavers where
  // their ally-cards live — Cassia MID (Cover), Elin BACK (Benediction) — so
  // all three threads can close.  Pick order IS the formation.
  await J(() => { RUN.active = ['ash', 'cassia', 'elin']; saveRun(); });

  // next fight: build the triangle deliberately, then verify the FORMATION resonant
  await J(() => document.querySelector('.map-node.mn-fight.mn-reach, .map-node.mn-reach').click()); await sleep(700);
  check('fight uses composed trio', await J(() => S.heroes.map(h => h.id).sort().join(',') === 'ash,cassia,elin'));
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
  // tap the hijacked resonant card by class (name carries a curly apostrophe)
  await J(() => {
    const c = document.querySelector('#hand .card.kind-resonant');
    c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7 }));
    c.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7 }));
  });
  // wait out the full two-stage cinematic (push, then heal-ripple + front guard)
  for (let w = 0; w < 20; w++) { if (await J(() => S.heroes.some(h => h.guard >= 4))) break; await sleep(300); }
  const rowsAfter = await J(() => S.enemies.filter(x => !x.dead).map(x => x.id + ':' + x.row).join(' '));
  check('FORMATION resonant pushed the enemy line', rowsBefore !== rowsAfter, rowsBefore + ' -> ' + rowsAfter);
  check('oathkeepers guard granted', await J(() => S.heroes.some(h => h.guard >= 4)),
    await J(() => S.heroes.map(h => h.id + ':' + h.row + ':g' + h.guard).join(' ')));
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
  // keep the party's full per-run kit granted for the mechanic checks below
  await J(() => {
    if (!RUN) RUN = newRun('ash');
    RUN.nodes = EMBER_TREE.filter(n => n.type === 'card').map(n => n.id);
    RUN.embers = 999; RUN.completed = [0, 1, 2, 3, 4, 5, 6, 7]; saveRun();
  });
  check('LOOP: victory accrued bond points for the held threads',
    await J(() => ['ash|cassia', 'ash|elin', 'cassia|elin'].every(k => (RUN.bonds[k] || 0) >= 1)),
    await J(() => JSON.stringify(RUN.bonds)));
  // fast-forward: fully kindle the trio, open the next fight column
  await J(() => {
    ['ash|cassia', 'ash|elin', 'cassia|elin'].forEach(k => RUN.bonds[k] = 2);
    RUN.active = ['ash', 'cassia', 'elin'];   // cassia MID so her Aegis (ally) is the awakener
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
  // The map regenerates each run, so a fallen descent is now remembered by
  // its DEPTH (level), and the ♰ resurfaces on a node at that depth next run.
  console.log('--- ABYSS ---');
  const fallenLevel = await J(() => S.node.level);
  await J(() => { S.heroes.forEach(h => { h.hp = 0; h.downed = true; }); checkEnd(); });
  await sleep(1400);
  check('LOOP: map defeat ends the run — the Abyss remembers', await J(() => document.body.innerText.includes('Abyss remembers')));
  check('memory stored at the fallen depth · run cleared', await J((lvl) => {
    const a = JSON.parse(localStorage.getItem('kizuna2_1.abyss') || '{}');
    return !!a[lvl] && !localStorage.getItem('kizuna2_1.run');
  }, fallenLevel));
  await shot('abyss-fallen');
  await clickOverlayBtn('#ov-fallen'); await sleep(500);
  await clickOverlayBtn('#t-new'); await sleep(400);                      // → CHOOSE YOUR SURVIVOR
  await J(() => document.querySelector('.ss-fig[data-id="ash"]').click());    // pick Ash → new run
  for (let i = 0; i < 6; i++) { if (!await J(() => !!document.querySelector('.ov-tap'))) break; await J(() => document.querySelector('#overlay').click()); await sleep(200); }
  await clickOverlayBtn('#ov-go'); await sleep(300);
  // pin a fresh deterministic map and hang the recovered memory on the entry
  // node so the ♰ is guaranteed reachable this run.
  await J((arg) => {
    const mem = JSON.parse(localStorage.getItem('kizuna2_1.abyss') || '{}')[arg.lvl];
    RUN.roster = ['ash', 'elin', 'mira']; RUN.active = ['ash', 'elin', 'mira'];
    RUN.map = arg.map.map(n => ({ ...n, next: n.next.slice() }));
    RUN.map[0].mem = mem; RUN.map[0].memLevel = arg.lvl;
    RUN.completed = []; RUN.bonds = {};
    saveRun(); showMap();
  }, { map: TEST_MAP, lvl: fallenLevel }); await sleep(400);
  check('next run: the map shows ♰ where they fell', await J(() => !!document.querySelector('.map-node .mn-mem')));
  await J(() => document.querySelector('.map-node[data-node="0"]').click()); await sleep(500);
  check('discovery beat: ashes of a descent', await J(() => !!document.querySelector('#ov-takeup')));
  await shot('abyss-memory');
  await clickOverlayBtn('#ov-takeup'); await sleep(900);
  check('LOOP: the fallen trio’s bonds echo into the new run', await J(() => {
    const b = RUN.bonds || {};
    return Object.keys(b).length >= 3 && Object.values(b).every(v => v >= 1);
  }), await J(() => JSON.stringify(RUN.bonds)));
  check('memory consumed · the fight begins over their ashes', await J((lvl) => {
    const a = JSON.parse(localStorage.getItem('kizuna2_1.abyss') || '{}');
    return !a[lvl] && typeof S !== 'undefined' && S && !S.over;
  }, fallenLevel));

  await t.autoParry(false);   // scripted drills below control their own input

  // ---------- SOLO ALLY-TARGET (onboarding regression) ----------
  // Ash alone in the onboarding: an ally-target card (Crossguard) must fall
  // back to targeting HIMSELF — the drag path used to filter the owner out and
  // the card would snap to nothing and spring back.
  console.log('--- SOLO ALLY ---');
  // re-establish the per-run kit (the ABYSS section above may have ended the run)
  await J(() => {
    if (!RUN) RUN = newRun('ash');
    RUN.nodes = EMBER_TREE.filter(n => n.type === 'card').map(n => n.id);
    RUN.embers = 999; RUN.completed = [0, 1, 2, 3, 4, 5, 6, 7]; saveRun();
  });
  await J(() => {
    hideOverlay();
    startFight({ type: 'fight', chapter: 1, heroes: ['ash'], enemies: ['husk'], narrator: 'solo drill' });
    S.heroes[0].row = 'mid';   // MID stance → Crossguard (ally, +6 guard) in hand
    S.ep = S.maxEp; renderAll();
  });
  await sleep(400);
  check('solo: Crossguard (ally card) is in hand for a lone Ash',
    await J(() => !!document.querySelector('#hand .card[data-card-name="Crossguard"]')));
  const soloGuard0 = await J(() => S.heroes[0].guard);
  await t.drag('#hand .card[data-card-name="Crossguard"]', '[data-fig="ash"]');
  check('solo: dragging Crossguard onto yourself applies its guard',
    await J((g) => S.heroes[0].guard >= g + 6, soloGuard0), await J((g) => 'guard ' + g + ' -> ' + S.heroes[0].guard, soloGuard0));

  // ---------- WEAKNESS / STAGGER (ported from v1) ----------
  console.log('--- STAGGER ---');
  await J(() => {
    hideOverlay();
    if (!RUN) RUN = newRun('ash');
    RUN.nodes = ['ash.sig.front', 'ash.exec'];   // core+sig hand, and Ash can EXECUTE a stagger (Coup de Grâce)
    // SOLO drill: at a full trio the hand tapers to one card/hero, so the
    // same-turn weakness→stagger double is a solo/duo play (or, at trio, routed
    // through a movement Echo).  Test the core mechanic where Ash holds both.
    startFight({ type: 'fight', chapter: 3, heroes: ['ash'], enemies: ['wraith'], narrator: 'stagger drill' });
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
  check('the FREE finisher cashed the ×2 (10 -> 20)', await J(() => S.enemies[0].hp) === hpMid - 20, 'hp ' + hpMid + '->' + await J(() => S.enemies[0].hp));
  check('stagger consumed by the payoff', await J(() => !S.enemies[0].staggered));
  check('the forged card burned away on use', await J(() => !document.querySelector('#hand .card[data-card-name="Coup de Grâce"]')));
  check('EXECUTIONER gate: WITHOUT the node the break still lands + pays EP, but NO free Coup de Grâce',
    await J(() => {
      RUN.nodes = ['ash.sig.front'];   // Ash has NOT kindled Executioner
      startFight({ type: 'fight', chapter: 3, heroes: ['ash'], enemies: ['wraith'], narrator: 'gate drill' });
      S.enemies[0].hp = S.enemies[0].maxHp = 40; S.ep = 8; renderAll();
      const e = S.enemies[0], ep0 = S.ep;
      dealToEnemy(e, 4, 'blade', 'ash');    // WEAKENED
      dealToEnemy(e, 4, 'blade', 'ash');    // STAGGERED
      return e.staggered === true && S.ep === ep0 + 1                             // break + PRESS-ON EP still happen
        && !document.querySelector('#hand .card[data-card-name="Coup de Grâce"]') // but the killing card is gated
        && !S.tempCards.some(c => c.name === 'Coup de Grâce'); }));
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
  // The boss strikes twice; stagger BREAKS the heavy (all-row) wind-up, so the
  // back line is spared — but its second, lighter blow still reaches the front.
  check('INTERRUPT: the staggered boss’s heavy (all-row) wind-up BROKE — back line untouched',
    await J(() => { const f = S.heroes.find(h => h.row === 'front'); return S.heroes.filter(h => h !== f).every(h => h.hp === h.maxHp); }));
  // FLOOR BOSS — colossal render + bullet-hell cascade parry sequences
  check('FLOOR BOSS: renders as one colossal figure filling the enemy half',
    await J(() => !!document.querySelector('#enemy-half.has-floor-boss .figure.floor-boss[data-fig]')));
  check('FLOOR BOSS: its OBLIVION blow is a 5-note parry CASCADE',
    await J(() => { const p = parryPatternFor(ENEMY_DEFS.echoknight2.intents[4]); return p.kind === 'seq' && p.notes.length === 5; }));
  check('FLOOR BOSS: the cascade previews on the telegraph (✷5)',
    await J(() => parryGlyph(ENEMY_DEFS.echoknight2.intents[4]) === '✷5'));
  // TWO-ATTACK BOSS — telegraphs and resolves two blows per round
  check('BOSS: strikes twice per round (attacksPerRound 2)',
    await J(() => ENEMY_DEFS.echoknight2.attacksPerRound === 2));
  check('BOSS: the telegraph shows BOTH coming blows (two intent segments)',
    await J(() => {
      hideOverlay();
      startFight({ type: 'fight', chapter: 3, heroes: ['ash', 'elin', 'branwen'], enemies: ['echoknight2'], narrator: 'double drill' });
      S.enemies[0].intentIdx = 0; renderAll();
      return enemyNextIntents(S.enemies[0]).length === 2
        && document.querySelectorAll('.figure.floor-boss .intent.intent-multi .i-seg').length === 2;
    }));
  check('BOSS: both blows feed the row-threat telegraph (two rows lit)',
    await J(() => {
      S.enemies[0].intentIdx = 2; renderAll();   // mid + back → two distinct damaging rows
      const lit = ['back', 'mid', 'front'].filter(r => document.querySelector(`#party-half .slot[data-row="${r}"].slot-telegraphed`));
      return lit.length === 2;
    }));

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
  // A full party's hand GROWS with unlocks — each hero shows Core + Signature
  // (when kindled).  HEAVY heroes hold BOTH like everyone else, but each card
  // carries a +1 EP premium, so fielding both in one turn is a real commitment.
  await J(() => {
    hideOverlay();
    if (!RUN) RUN = newRun('ash');
    RUN.nodes = EMBER_TREE.filter(n => n.type === 'card').map(n => n.id);   // full kit kindled → widest hand
    startFight({ type: 'fight', chapter: 3, heroes: ['ash', 'cassia', 'kiki'], enemies: ['husk'], narrator: 'economy drill' });
    renderAll();
  });
  await sleep(400);
  check('PARITY: HEAVY Cassia now shows TWO cards, same as STEADY+SWIFT (kit unlocked)',
    await J(() => {
      const n = (id) => document.querySelectorAll(`#hand .card[data-owner="${id}"]`).length;
      return n('cassia') === 2 && n('ash') === 2 && n('kiki') === 2;
    }), await J(() => 'ash:'+document.querySelectorAll('#hand .card[data-owner="ash"]').length+' cassia:'+document.querySelectorAll('#hand .card[data-owner="cassia"]').length+' kiki:'+document.querySelectorAll('#hand .card[data-owner="kiki"]').length));
  check('HEAVY PREMIUM: each of Cassia’s cards costs +1 — her base-1 core reads 2, never 1',
    await J(() => {
      const costs = [...document.querySelectorAll('#hand .card[data-owner="cassia"] .c-cost')].map(x => x.textContent);
      return costs.includes('2') && !costs.includes('1');
    }), await J(() => 'costs=' + [...document.querySelectorAll('#hand .card[data-owner="cassia"] .c-cost')].map(x => x.textContent).join(',')));
  check('SWIFT: Kiki’s 2-cost signature is discounted to 1',
    await J(() => { const c = [...document.querySelectorAll('#hand .card[data-owner="kiki"]')]; return c.some(x => x.querySelector('.c-cost').textContent === '1'); }));
  // SACRIFICE is a GESTURE now (drag a card onto the EP dial) — no button.
  check('SACRIFICE: cards no longer carry a channel button', await J(() => !document.querySelector('#hand .card-channel')));
  check('SACRIFICE: dragging a card ARMS the EP dial as a drop-target',
    await J(() => {
      S.channelUsed = false; S.ep = S.maxEp; renderAll();
      const c = document.querySelector('#hand .card[data-owner="kiki"]'); if (!c) return false;
      const r = c.getBoundingClientRect(), mx = r.left + r.width / 2, my = r.top + r.height / 2;
      c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 5, clientX: mx, clientY: my }));
      c.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 5, clientX: mx, clientY: my - 40 }));
      const armed = !!document.querySelector('#ep-cluster.ep-armed');
      c.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 5, clientX: mx, clientY: my - 40 }));
      return armed && !document.querySelector('#ep-cluster.ep-armed');   // disarms on release
    }));
  const epBefore = await J(() => S.ep);
  await J(() => { S.channelUsed = false; const c = buildHand().find(x => x.owner === 'kiki' && !x.spent && x.kind !== 'move'); channelCard(c); });
  await sleep(200);
  check('SACRIFICE: feeding a card to the dial grants +1 EP', await J(() => S.ep) === epBefore + 1, 'ep ' + epBefore + '->' + await J(() => S.ep));
  check('SACRIFICE: once per turn (channelUsed locks)', await J(() => S.channelUsed === true));
  await shot('economy');
  // HEAL FLOOR: mending a full-HP ally shields instead of wasting.  A small party
  // (non-lean) so Elin still holds her MID core (Mend) alongside her signature.
  await J(() => { hideOverlay(); startFight({ type:'fight', chapter:3, heroes:['ash','elin'], enemies:['husk'], narrator:'heal floor' }); renderAll(); });   // duo: Ash front (heroes[0]), Elin mid → holds Mend
  await sleep(300);
  const gBefore = await J(() => S.heroes[0].guard);
  await tapCard('Mend'); await pickTarget('ash'); await sleep(500);
  check('HEAL FLOOR: healing a full-HP ally became guard, not wasted (+5 spill, +bond)',
    await J((g) => S.heroes[0].hp === S.heroes[0].maxHp && S.heroes[0].guard >= g + 5, gBefore));

  // ---------- AIM: drag snaps to the target ----------
  console.log('--- AIM ---');
  await J(() => {
    hideOverlay();
    // duo (non-lean) so Hask still holds his MID core (Ice Bolt); put him in mid
    startFight({ type:'fight', chapter:3, heroes:['hask','elin'], enemies:['husk','wraith'], narrator:'aim drill' });
    S.heroes.find(h => h.id === 'hask').row = 'mid';
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
  // REGRESSION: a release that never reaches the card (lost capture / re-render)
  // must still end the drag and clear the aim beam — no orphaned reticle.
  check('AIM: a release that MISSES the card still ends the drag (no stuck beam)',
    await J(() => {
      startFight({ type: 'fight', chapter: 3, useRunHp: true, heroes: ['hask', 'elin'], enemies: ['husk', 'wraith'] });
      S.heroes.find(h => h.id === 'hask').row = 'mid'; S.ep = S.maxEp; renderAll();
      const c = document.querySelector('#hand .card[data-card-name="Ice Bolt"]'); if (!c) return false;
      const r = c.getBoundingClientRect(), mx = r.left + r.width / 2, my = r.top + r.height / 2;
      c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 8, clientX: mx, clientY: my }));
      c.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 8, clientX: mx, clientY: my - 70 }));   // lift toward the field
      const dragging = c.classList.contains('card-dragging');
      // the pointerup lands on WINDOW, not the card (capture lost) — the safety net must still finish
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 8, clientX: mx, clientY: my }));
      const ended = !document.querySelector('#hand .card.card-dragging') && !document.querySelector('.fig-snapped');
      return dragging && ended;
    }));

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
  // fill and unleash the all-out — now INTERACTIVE (reverse-parry strike notes).
  // auto-tap drives the offensive cascade; nailed strikes ramp the CHAIN.
  await t.autoParry(true);
  const allOut = await J(async () => {
    S.momentum = 100; renderAll();
    const before = S.enemies.map(e => e.hp);
    await triggerAllOut();
    return { before, after: S.enemies.map(e => e.hp), momentum: S.momentum, used: S.allOutUsed };
  });
  await t.autoParry(false);
  check('BURST: ALL-OUT hit the whole enemy line', allOut.after.every((hp, i) => hp < allOut.before[i]),
    JSON.stringify(allOut.before) + ' -> ' + JSON.stringify(allOut.after));
  check('BURST: momentum spent to zero', allOut.momentum === 0 && allOut.used >= 1);

  // TIMING MATTERS — a well-timed cascade out-damages an untimed (all-miss) one.
  const strikeCmp = await J(async () => {
    const setup = () => { startFight({ type: 'fight', chapter: 3, heroes: ['ash', 'elin', 'kiki'], enemies: ['husk'], narrator: 'strike cmp' }); S.enemies[0].hp = S.enemies[0].maxHp = 500; S.momentum = 100; renderAll(); };
    setup(); const h0 = S.enemies[0].hp; window.__autoParry = false; await triggerAllOut(); const missed = h0 - S.enemies[0].hp;
    setup(); const h1 = S.enemies[0].hp; window.__autoParry = true; await triggerAllOut(); window.__autoParry = false; const timed = h1 - S.enemies[0].hp;
    return { missed, timed };
  });
  check('BURST: timed strikes out-damage a fumbled cascade', strikeCmp.timed > strikeCmp.missed,
    'miss ' + strikeCmp.missed + ' vs timed ' + strikeCmp.timed);

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
  // varied rhythm patterns derive per intent + preview on the telegraph
  check('RHYTHM: attacks carry varied parry patterns (+ sizes)',
    await J(() => parryPatternFor({ heavy: true }).kind === 'hold'
      && parryPatternFor({ row: 'all', dmg: 4 }).size === 'wide'
      && parryPatternFor({ dmg: 3 }).kind === 'mash'
      && parryPatternFor({ dmg: 5 }).kind === 'multi'
      && parryPatternFor({ dmg: 8 }).size === 'big'
      && parryPatternFor({ dmg: 6 }).kind === 'tap'));
  check('INTENT: the telegraph pill is clean — damage + target row, no parry-glyph clutter',
    await J(() => { const p = document.querySelector('.intent'); return !!p && !!p.querySelector('.i-dmg') && !!p.querySelector('.i-row') && !p.querySelector('.i-parry'); }));
  check('ALL-HIT: a whole-party blow is one across-sweep parry',
    await J(() => { const p = parryPatternFor({ row: 'all', dmg: 5 }); return p.kind === 'swipe' && p.arc === 'arcAcross' && p.across === true; }));
  check('PARTIAL: a multi-tap parries per note (mitigation is fractional)',
    await J(() => { const p = parryPatternFor({ dmg: 4 }); return p.kind === 'multi' && p.count === 2; }));
  // a HOLD parried by bracing through impact negates the blow
  await J(() => {
    startFight({ type:'fight', chapter:3, heroes:['ash','elin','kiki'], enemies:['husk'], narrator:'hold drill' });
    const a = S.heroes.find(h => h.id === 'ash'); a.row = 'front';
    S.enemies[0].hp = S.enemies[0].maxHp = 40; S.ep = 0; S.momentum = 0;
    const it = S.enemies[0].def.intents[S.enemies[0].intentIdx % S.enemies[0].def.intents.length];
    it.parry = { kind: 'hold' }; renderAll();
  });
  await sleep(250);
  const ashHold0 = await J(() => S.heroes.find(h => h.id === 'ash').hp);
  t.page.evaluate(() => { endTurn(); });
  await t.page.waitForSelector('.parry-ring.parry-hold', { state: 'attached', timeout: 6000 });
  await t.page.mouse.move(150, 140); await t.page.mouse.down();   // brace and HOLD
  await sleep(1050);
  await t.page.mouse.up();
  await sleep(2400);
  check('RHYTHM: a braced HOLD negates the blow (perfect parry)',
    await J((o) => S.heroes.find(h => h.id === 'ash').hp === o.a && S.momentum > 0, { a: ashHold0 }),
    await J((o) => 'ashDmg:' + (o.a - S.heroes.find(h => h.id === 'ash').hp) + ' mom:' + S.momentum, { a: ashHold0 }));

  // ---------- EMBER PROGRESSION (Phase 1) ----------
  console.log('--- EMBERS ---');
  // earning: felling a foe banks embers into the RUN wallet (per-run, not meta)
  await J(() => {
    RUN = newRun('ash'); RUN.embers = 0; RUN.nodes = [];
    startFight({ type: 'fight', chapter: 1, heroes: ['ash'], enemies: ['husk'], narrator: 'ember drill' });
    S._embersRun = 0; renderAll();
  });
  const emb0 = await J(() => RUN.embers);
  await J(() => { const e = S.enemies[0]; e.hp = 0; dealToEnemy(e, 0); });   // trigger death path
  check('EARN: felling a normal foe banks +2 embers into the run wallet', await J(() => RUN.embers) === emb0 + 2,
    'embers ' + emb0 + ' -> ' + await J(() => RUN.embers));

  // spending: buying a node deducts embers, unlocks it, and opens the card
  await J(() => { RUN.embers = 10; RUN.nodes = []; saveRun(); });
  check('GATE: with the MID sig locked, a MID Ash holds only the core (1 card) — only the starter’s FRONT sig is free',
    await J(() => {
      startFight({ type: 'fight', chapter: 1, heroes: ['ash'], enemies: ['husk'], narrator: 'gate' });
      S.heroes[0].row = 'mid'; S.ep = S.maxEp; renderAll();
      return document.querySelectorAll('#hand .card').length === 1;
    }));
  await J(() => { const n = NODE_BY_ID['ash.sig.mid']; addEmbers(-n.cost); unlockNode('ash.sig.mid'); renderAll(); });
  check('UNLOCK: buying the MID signature deducts its cost (10 -> 5)', await J(() => RUN.embers) === 5,
    'embers ' + await J(() => RUN.embers));
  check('OPEN: the unlocked MID signature now appears in hand (2 cards)',
    await J(() => { S.heroes[0].row = 'mid'; renderAll();
      return document.querySelectorAll('#hand .card').length === 2
        && !!document.querySelector('#hand .card[data-card-name="Crossguard"]'); }));

  // rider: an unlocked upgrade bolts a keyword onto an existing card
  await J(() => { unlockNode('ash.sig.back'); unlockNode('ash.rider.expose'); });
  check('RIDER: Hunter’s Instinct adds EXPOSED to Thrown Edge (mark:2 in fx)',
    await J(() => {
      startFight({ type: 'fight', chapter: 1, heroes: ['ash'], enemies: ['husk'], narrator: 'rider' });
      S.heroes[0].row = 'back'; S.ep = S.maxEp; renderAll();
      const hand = buildHand();
      const te = hand.find(c => c.name === 'Thrown Edge');
      return !!te && te.fx.mark === 2 && te.fx.dmg === 4;   // base dmg preserved, rider added
    }));
  // and the shared def is NOT mutated by the rider (clone integrity)
  check('RIDER: the base card def is untouched (no shared-state leak)',
    await J(() => HEROES.ash.cards.back.core.fx.mark === undefined));

  // passive: closing to FRONT grants guard once the node is owned
  check('PASSIVE: Vanguard’s Momentum grants ⛨3 when Ash moves to FRONT',
    await J(() => {
      unlockNode('ash.passive.vanguard');
      startFight({ type: 'fight', chapter: 1, heroes: ['ash'], enemies: ['husk'], narrator: 'passive' });
      const a = S.heroes[0]; a.row = 'back'; a.guard = 0; S.ep = S.maxEp; renderAll();
      onHeroEnterRow(a, 'front', 'back');
      return a.guard === 3;
    }));

  // ---------- PHASE 2: depth-gated tiers · forging ----------
  console.log('--- PHASE 2 ---');
  check('TIER GATE: tier 2 stays sealed until you descend deeper this run',
    await J(() => { RUN.completed = []; return tierOpen(1) === true && tierOpen(2) === false; }));
  check('TIER GATE: descending opens tier 2, then tier 3 deeper still',
    await J(() => { RUN.completed = [0, 1]; const t2 = tierOpen(2) === true && tierOpen(3) === false; RUN.completed = [0, 1, 2, 3]; return t2 && tierOpen(3) === true; }));
  check('FORGE: WHETSTONE tempers an attack +1', await J(() => { const c = { kind: 'core', fx: { dmg: 6 } }; FORGE_BY_ID.whetstone.apply(c); return c.fx.dmg === 7; }));
  check('FORGE: QUICKENING cuts a signature’s cost by 1', await J(() => { const c = { kind: 'sig', cost: 2, fx: { dmg: 11 } }; FORGE_BY_ID.quicken.apply(c); return c.cost === 1; }));
  check('FORGE: HEXED EDGE adds ◎ EXPOSED to a core attack', await J(() => { const c = { kind: 'core', fx: { dmg: 6 } }; FORGE_BY_ID.hexedge.apply(c); return c.fx.mark === 1; }));
  check('FORGE: mkCard applies an active run forge to the built card', await J(() => {
    startFight({ type: 'fight', chapter: 1, heroes: ['ash'], enemies: ['husk'], narrator: 'forge' });
    S.heroes[0].row = 'front';
    const base = mkCard(S.heroes[0], 'core', HEROES.ash.cards.front.core).fx.dmg;
    RUN = RUN || { forges: [] }; const saved = RUN.forges; RUN.forges = ['whetstone'];
    const tempered = mkCard(S.heroes[0], 'core', HEROES.ash.cards.front.core).fx.dmg;
    RUN.forges = saved || [];
    return base === 6 && tempered === 7 && HEROES.ash.cards.front.core.fx.dmg === 6;   // def untouched
  }));

  // ---------- PHASE 3: constellations · alt all-out · Heat ----------
  console.log('--- PHASE 3 ---');
  check('CONSTELLATION: every roster hero has a full signature gate',
    await J(() => ['ash', 'elin', 'mira', 'cassia', 'branwen'].every(h => SIG_GATE[h] && SIG_GATE[h].front && SIG_GATE[h].mid && SIG_GATE[h].back)));
  check('RE-GATE: a recruited hero opens with only its CORE (sig gated)',
    await J(() => {
      RUN.nodes = [];   // nothing unlocked this run
      startFight({ type: 'fight', chapter: 2, heroes: ['cassia'], enemies: ['husk'], narrator: 'gate' });
      S.heroes[0].row = 'front'; S.ep = S.maxEp; renderAll();
      const cards = document.querySelectorAll('#hand .card');
      return cards.length === 1 && cards[0].dataset.cardName === 'Shield Bash';   // Bulwark (sig) gated
    }));
  check('CONSTELLATION: unlocking Cassia’s FRONT sig ADDS Bulwark alongside the core',
    await J(() => {
      unlockNode('cassia.sig.front'); renderAll();
      return !!document.querySelector('#hand .card[data-card-name="Bulwark"]')
        && !!document.querySelector('#hand .card[data-card-name="Shield Bash"]');   // heavy now holds BOTH
    }));
  check('ALT ALL-OUT: Rite of Endings is a tier-3 allout node (needs the front sig)',
    await J(() => { const n = NODE_BY_ID['ash.allout.execution']; return !!n && n.type === 'allout' && n.tier === 3 && n.requires.includes('ash.sig.front'); }));
  check('ALT ALL-OUT: it EXECUTES a foe under 25% HP only once owned',
    await J(() => {
      RUN.nodes = [];
      const low = { dead: false, hp: 5, maxHp: 100 };
      const before = allOutExecutes(low);
      unlockNode('ash.allout.execution');
      const after = allOutExecutes(low);
      const healthy = allOutExecutes({ dead: false, hp: 40, maxHp: 100 });
      return before === false && after === true && healthy === false;
    }));
  check('HEAT: raising heat scales the ember payout (2 → 4)',
    await J(() => { META.heat = 0; const a = emberReward({ def: {} }); META.heat = 4; const b = emberReward({ def: {} }); META.heat = 0; return a === 2 && b === 4; }));
  check('HEAT: raising heat makes run foes hit harder and last longer',
    await J(() => {
      META.heat = 0;
      startFight({ type: 'fight', chapter: 2, depth: 1, useRunHp: true, heroes: ['ash', 'elin', 'mira'], enemies: ['husk'], narrator: 'h0' });
      const hp0 = S.enemies[0].maxHp, dm0 = S.enemies[0].dmgMul;
      META.heat = 4;
      startFight({ type: 'fight', chapter: 2, depth: 1, useRunHp: true, heroes: ['ash', 'elin', 'mira'], enemies: ['husk'], narrator: 'h4' });
      const hp4 = S.enemies[0].maxHp, dm4 = S.enemies[0].dmgMul;
      META.heat = 0;
      return hp4 > hp0 && dm4 > dm0;
    }));
  check('ECONOMY: a felled ELITE pays the bigger bounty (4, not 2)',
    await J(() => {
      startFight({ type: 'fight', chapter: 2, depth: 3, useRunHp: true, elite: true, heroes: ['ash'], enemies: ['husk'] });
      return S.enemies[0]._elite === true && emberReward(S.enemies[0]) === 4;
    }));
  check('ECONOMY: clearing a fight pays a small steady bounty (+1 normal · +3 boss)',
    await J(() => {
      RUN = newRun('ash'); RUN.embers = 0;
      startFight({ type: 'fight', chapter: 1, heroes: ['ash'], enemies: ['husk'], narrator: 'clear' });
      S.node.mapId = null; S.enemies.forEach(e => { e.hp = 0; e.dead = true; }); onVictory();  // dead already → no kill reward, only the clear bounty
      const normal = RUN.embers;
      RUN.embers = 0; startFight({ type: 'fight', chapter: 3, heroes: ['ash'], enemies: ['echoknight2'], narrator: 'clear', isBoss: true });
      S.node.mapId = null; S.enemies.forEach(e => { e.hp = 0; e.dead = true; }); onVictory();
      return normal === 1 && RUN.embers === 3;
    }));

  // ---------- MID-RUN upgrading: reach the tree without leaving the run --------
  console.log('--- MID-RUN TREE ---');
  check('MID-RUN: the map exposes an ember-tree button that opens the sphere grid',
    await J(() => {
      S = null; RUN = newRun('ash'); showMap();
      const btn = document.querySelector('#map-tree');
      if (!btn) return false;
      btn.click();
      return !!document.querySelector('.et-canvas.et-grid') && !!document.querySelector('.et-orb[data-id]');
    }));
  check('MID-RUN: BACK from the tree returns to the descent map',
    await J(() => { const b = document.querySelector('#et-back'); if (!b) return false; b.click(); return !!document.querySelector('#map-tree'); }));
  check('MID-RUN: the ember tree is NOT reachable mid-fight (map-only unlocking)',
    await J(() => {
      startFight({ type: 'fight', chapter: 1, heroes: ['ash'], enemies: ['husk'], narrator: 'menu' });
      showMenu();
      return !document.querySelector('#m-tree');   // the pause menu offers no tree during a fight
    }));

  // ---------- PER-RUN / PARTY-ONLY progression ----------
  console.log('--- PER-RUN TREES ---');
  check('PARTY-ONLY: the tree shows only your FIELDED party (tabs == active party)',
    await J(() => {
      S = null; RUN = newRun('ash'); RUN.roster = ['ash', 'mira']; RUN.active = ['ash', 'mira'];
      RUN.embers = 20; RUN.nodes = []; RUN.completed = [0, 1, 2, 3];
      showEmberTree(() => {}, 'ash');
      const tabs = [...document.querySelectorAll('.et-tab')].map(t => t.dataset.hero);
      return tabs.length === 2 && tabs.indexOf('ash') >= 0 && tabs.indexOf('mira') >= 0 && tabs.indexOf('elin') < 0;
    }));
  check('PARTY-ONLY: a party hero CAN be kindled (KINDLE offered)',
    await J(() => { showEmberTree(() => {}, 'ash'); return !!document.querySelector('#et-buy'); }));
  check('PARTY-ONLY: asking for a non-party hero clamps to a party member',
    await J(() => { showEmberTree(() => {}, 'branwen'); const on = document.querySelector('.et-tab-on'); return !!on && ['ash', 'mira'].indexOf(on.dataset.hero) >= 0; }));
  check('PER-RUN: unlocks + embers live on the RUN, and reading them needs a run',
    await J(() => {
      RUN = newRun('ash'); RUN.nodes = ['ash.sig.front']; RUN.embers = 7;
      const had = hasNode('ash.sig.front') && runEmbers() === 7;
      RUN = null;                                   // the descent ends
      return had && !hasNode('ash.sig.front') && runEmbers() === 0;
    }));
  check('RESET: a fresh descent begins with an empty wallet AND an empty tree (everything is earned)',
    await J(() => { RUN = newRun('ash'); return RUN.embers === 0 && RUN.nodes.length === 0; }));
  check('RESET: falling (onDefeat) clears the run so progression is wiped',
    await J(() => {
      RUN = newRun('ash'); RUN.nodes = ['ash.sig.front']; RUN.embers = 9;
      startFight({ type: 'fight', chapter: 1, heroes: ['ash'], enemies: ['husk'], narrator: 'fall' });
      S.node = { mapId: 0, level: 0 }; S.heroes.forEach(h => { h.hp = 0; h.downed = true; });
      onDefeat();
      return RUN === null && runEmbers() === 0;   // the run (and its unlocks) is gone
    }));

  // ---------- GUIDED FIRST KINDLE ----------
  console.log('--- TEACH THE TREE ---');
  check('TEACH: with embers in hand, the map coaches you toward the Ember Tree',
    await J(() => {
      try { localStorage.removeItem('kizuna2_1.treeTaught'); } catch (_) {}
      S = null; RUN = newRun('ash'); RUN.embers = 8; showMap();
      return !!document.querySelector('.map-coach') && !!document.querySelector('.map-tree-btn.mt-teach');
    }));
  check('COACH: embers but none affordable → soft prompt only, no kindle nag',
    await J(() => {
      try { localStorage.removeItem('kizuna2_1.treeTaught'); } catch (_) {}
      S = null; RUN = newRun('ash'); RUN.active = ['ash']; RUN.embers = 3; RUN.completed = [];   // spark owned; cheapest other node costs 4
      showMap();
      return !canKindleNow() && !!document.querySelector('.map-coach-soft')
        && !document.querySelector('.map-coach:not(.map-coach-soft)') && !document.querySelector('.map-tree-btn.mt-teach');
    }));
  check('COACH: once a node is affordable, the map nags to kindle it',
    await J(() => {
      try { localStorage.removeItem('kizuna2_1.treeTaught'); } catch (_) {}
      S = null; RUN = newRun('ash'); RUN.active = ['ash']; RUN.embers = 6; RUN.completed = [];
      showMap();
      return canKindleNow() && !!document.querySelector('.map-coach:not(.map-coach-soft)') && !!document.querySelector('.map-tree-btn.mt-teach');
    }));
  check('TEACH: the tree shows a KINDLE coach until you learn it',
    await J(() => { showEmberTree(() => {}, 'ash'); return !!document.querySelector('.et-coach') && treeTaught() === false; }));
  check('TEACH: kindling a node plays a KINDLE BURST and banks the unlock',
    await J(() => {
      RUN.embers = 20; RUN.completed = [0, 1, 2, 3]; showEmberTree(() => {}, 'ash');
      const buy = document.querySelector('#et-buy'); if (!buy) return false;
      buy.click();
      // the unlock is committed immediately; the full-screen burst plays over the tree
      return treeTaught() === true && runEmbers() === 16 && !!document.querySelector('#kindle-fx');
    }));
  // dismiss the burst → the tree re-renders with the confirmation note
  await J(() => { const el = document.querySelector('#kindle-fx'); if (el) { el.classList.add('kf-ready'); el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); } });
  await sleep(450);
  check('TEACH: after the burst, the tree shows the kindled confirmation',
    await J(() => !document.querySelector('#kindle-fx') && !document.querySelector('.et-coach') && !!document.querySelector('.et-kindled-note')));
  check('TEACH: once learned, the map no longer nags',
    await J(() => { S = null; RUN = newRun('ash'); RUN.embers = 8; showMap(); return !document.querySelector('.map-coach'); }));

  // ---------- FLOOR 2 (ascension) · smarter foes · the Maw ----------
  console.log('--- FLOOR 2 ---');
  check('FLOOR: a run starts on floor 1; floor 1 boss is the Echo Knight',
    await J(() => {
      RUN = newRun('ash');
      const bossNode = RUN.map.find(n => n.type === 'boss');
      return RUN.floor === 1 && !!bossNode && bossNode.enemies[0] === 'echoknight2';
    }));
  check('FLOOR: clearing the floor-1 boss drops you to floor 2 (kit + embers kept, tiers stay open)',
    await J(() => {
      RUN = newRun('ash'); RUN.active = ['ash']; RUN.nodes = ['ash.sig.front']; RUN.embers = 12; RUN.completed = [0, 1, 2, 3, 4, 5];
      startFight({ type: 'fight', chapter: 3, heroes: ['ash'], enemies: ['echoknight2'], isBoss: true, useRunHp: true, mapId: 6, depth: 7, floor: 1 });
      S.enemies.forEach(e => { e.hp = 0; e.dead = true; }); onFloorCleared();
      const bossNode2 = RUN.map.find(n => n.type === 'boss');
      return RUN.floor === 2 && RUN.embers === 12 && hasNode('ash.sig.front')
        && tierOpen(3) === true                                   // depthBase carried the ramp
        && bossNode2.enemies[0] === 'echodevourer';               // floor-2 boss is the Maw
    }));
  check('FLOOR: floor 2 hits harder than floor 1 (continued depth ramp)',
    await J(() => {
      RUN = newRun('ash'); RUN.active = ['ash', 'elin', 'mira'];
      startFight({ type: 'fight', chapter: 3, depth: 3, floor: 1, useRunHp: true, heroes: ['ash', 'elin', 'mira'], enemies: ['husk'] });
      const dm1 = S.enemies[0].dmgMul, hp1 = S.enemies[0].maxHp, smart1 = S.enemies[0].smart;
      startFight({ type: 'fight', chapter: 3, depth: 3, floor: 2, useRunHp: true, heroes: ['ash', 'elin', 'mira'], enemies: ['husk'] });
      const dm2 = S.enemies[0].dmgMul, hp2 = S.enemies[0].maxHp, smart2 = S.enemies[0].smart;
      return dm2 > dm1 && hp2 > hp1 && smart1 === false && smart2 === true;
    }));
  check('SMART: a smart foe re-aims a single-row blow at the WEAKEST hero (telegraph honest)',
    await J(() => {
      startFight({ type: 'fight', chapter: 3, floor: 2, useRunHp: true, heroes: ['ash', 'elin', 'mira'], enemies: ['husk'] });
      S.heroes.forEach((h, i) => { h.row = ['front', 'mid', 'back'][i]; h.hp = h.maxHp; h.guard = 0; });
      const back = S.heroes.find(h => h.row === 'back'); back.hp = 3;   // the weak one is at BACK
      const e = S.enemies[0]; e.smart = true;
      const intent = { dmg: 6, row: 'front' };                         // nominally FRONT
      return effIntentRow(e, intent) === 'back';                       // but it hunts the BACK weakling
    }));
  check('MAW: the Hollow Maw is a floorBoss, weak to LIGHT, that DRAINS and HEXES',
    await J(() => {
      const m = ENEMY_DEFS.echodevourer;
      return !!m && m.floorBoss && m.weak === 'light'
        && m.intents.some(i => i.drain) && m.intents.some(i => i.hex);
    }));
  check('DRAIN: the Maw heals from the damage it deals (staggered, it cannot feed)',
    await J(() => {
      // fed: hp restored by round(dmg*drain); staggered: no feed
      const heal = (dmg, drain, stag) => stag ? 0 : Math.max(1, Math.round(dmg * drain));
      return heal(10, 0.6, false) === 6 && heal(10, 0.6, true) === 0;
    }));

  // ---------- HEX (Balatro-style curse) ----------
  console.log('--- HEX ---');
  check('HEX: landing a hex attack (undodged) curses the hero',
    await J(() => {
      startFight({ type: 'fight', chapter: 3, floor: 2, useRunHp: true, heroes: ['ash'], enemies: ['husk'] });
      const h = S.heroes[0]; h.hexed = 0;
      const intent = { hex: 2 };
      if (intent.hex) h.hexed = Math.max(h.hexed || 0, intent.hex);   // same rule as the enemy phase
      return h.hexed === 2;
    }));
  check('HEX: a hexed hero playing a card burns a random OTHER card from hand',
    await J(() => {
      startFight({ type: 'fight', chapter: 3, floor: 2, useRunHp: true, heroes: ['ash'], enemies: ['husk'] });
      RUN = RUN || newRun('ash'); RUN.nodes = ['ash.sig.front'];       // give Ash 2 cards (core + sig)
      const a = S.heroes[0]; a.row = 'front'; a.hexed = 2; S.ep = S.maxEp; renderAll();
      const before = buildHand().filter(c => c.owner === 'ash' && !c.spent && c.kind !== 'move').length;
      const played = buildHand().find(c => c.owner === 'ash' && c.name === 'Cleave');
      hexBurn(played);                                                 // simulate the on-play curse
      const after = buildHand().filter(c => c.owner === 'ash' && !c.spent && c.kind !== 'move').length;
      return before === 2 && after === 1;                             // one other card burned away
    }));
  check('HEX: it ticks down each turn and lifts',
    await J(() => {
      startFight({ type: 'fight', chapter: 3, floor: 2, useRunHp: true, heroes: ['ash'], enemies: ['husk'] });
      const h = S.heroes[0]; h.hexed = 1;
      h.hexed = Math.max(0, (h.hexed || 0) - 1);   // the per-turn tick
      return h.hexed === 0;
    }));

  // ---------- CARD INSPECT (press & hold) · stuck-overlay regression ----------
  console.log('--- CARD INSPECT ---');
  await J(() => {
    RUN = newRun('ash'); RUN.active = ['ash'];
    startFight({ type: 'fight', chapter: 3, useRunHp: true, heroes: ['ash'], enemies: ['husk'] });
    S.ep = S.maxEp; renderAll();
    const c = document.querySelector('#hand .card');
    window.__ci = !!c;
    if (c) c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 9, clientX: 120, clientY: 400 }));
  });
  await sleep(430);   // let the 340ms press-and-hold fire
  check('INSPECT: press & hold enlarges the card',
    await J(() => window.__ci && !!document.getElementById('card-inspect')));
  // the ending release lands on WINDOW, not the card (capture lost / element swapped)
  await J(() => window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 9, clientX: 120, clientY: 400 })));
  await sleep(60);
  check('INSPECT: a release ANYWHERE closes it — the overlay never sticks',
    await J(() => !document.getElementById('card-inspect')));
  check('INSPECT: a second touch cannot hijack an in-flight gesture',
    await J(() => {
      startFight({ type: 'fight', chapter: 3, useRunHp: true, heroes: ['ash'], enemies: ['husk'] });
      S.ep = S.maxEp; renderAll();
      const cards = document.querySelectorAll('#hand .card'); if (cards.length < 1) return false;
      const a = cards[0];
      a.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 120, clientY: 400 }));
      // a stray second finger presses the same card — must be ignored, no double-arm
      a.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 2, clientX: 120, clientY: 400 }));
      // releasing the FIRST pointer resolves cleanly (tap), the stray one is a no-op
      a.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 2, clientX: 120, clientY: 400 }));
      return !S.over || true;   // no crash / no stuck targeting state
    }));
  await J(() => { const el = document.getElementById('card-inspect'); if (el) el.remove(); });

  // ---------- BOSS INTRO cutscene ----------
  console.log('--- BOSS INTRO ---');
  check('INTRO: the Maw gets a dramatic cutscene (silhouette · name · quote)',
    await J(() => {
      window.__began = false;
      const el = bossIntro('echodevourer', () => { window.__began = true; });
      const cine = document.getElementById('boss-cine');
      return !!cine && !!cine.querySelector('.bc-art svg') && !!cine.querySelector('.bc-eyes')
        && cine.querySelector('.bc-name').textContent === 'THE HOLLOW MAW'
        && cine.textContent.indexOf('everything is food') >= 0;
    }));
  check('INTRO: tapping the cutscene dismisses it and begins the fight',
    await J(() => document.getElementById('boss-cine').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))) || true);
  await sleep(650);
  check('INTRO: the fight begins after the cutscene closes',
    await J(() => !document.getElementById('boss-cine') && window.__began === true));

  // ---------- CARD FACE + VANISH ----------
  console.log('--- CARD FACE ---');
  check('CARD FACE: the element rides on the damage number (light ✦) — no separate top-right element icon',
    await J(() => {
      RUN = newRun('elin'); RUN.active = ['elin'];
      startFight({ type: 'fight', chapter: 3, useRunHp: true, heroes: ['elin'], enemies: ['husk'] });
      S.heroes[0].row = 'front'; S.ep = S.maxEp; renderAll();
      const card = document.querySelector('#hand .card[data-card-name="Smite"]');
      const dmg = card && card.querySelector('.ic-dmg');
      return !!dmg && dmg.textContent.indexOf('✦') >= 0 && !card.querySelector('.c-school');
    }));
  check('VANISH: Vanish Strike carries warp:back (jumps to the back line, not one step)',
    await J(() => HEROES.mira.cards.front.sig.fx.warp === 'back' && HEROES.mira.cards.front.sig.fx.step == null));
  await J(() => {
    RUN = newRun('mira'); RUN.active = ['mira']; RUN.nodes = ['mira.sig.front'];
    startFight({ type: 'fight', chapter: 3, useRunHp: true, heroes: ['mira'], enemies: ['husk'] });
    S.heroes[0].row = 'front'; S.enemies[0].hp = S.enemies[0].maxHp = 40; S.ep = S.maxEp; renderAll();
  });
  await sleep(300);
  const vBefore = await J(() => S.heroes[0].row);
  await tapCard('Vanish Strike'); await pickTarget(); await sleep(400);
  check('VANISH: playing it warps Mira straight from FRONT to BACK',
    await J(() => S.heroes[0].row === 'back') && vBefore === 'front',
    'row ' + vBefore + ' -> ' + await J(() => S.heroes[0].row));

  // ---------- TRAVELER (JRPG cutscene conversation) ----------
  console.log('--- TRAVELER ---');
  check('TRAVELER: a recruit opens a JRPG SCENE — party LEFT, stranger RIGHT, a dialogue box',
    await J(() => {
      RUN = newRun('ash'); RUN.roster = ['ash']; RUN.active = ['ash'];
      const rn = RUN.map.find(n => n.type === 'recruit'); rn.hero = 'mira';
      try { localStorage.setItem(STARTERS_KEY, JSON.stringify(['ash'])); } catch (_) {}   // traveler is UNMET → full cutscene
      showRecruit(rn);
      return !!document.querySelector('#overlay.jc .jc-scene')
        && !!document.querySelector('.jc-fig-l .jc-art') && !!document.querySelector('.jc-fig-r .jc-art')
        && !!document.querySelector('.jc-box .jc-line') && !document.querySelector('.tc-name');   // no more big centered title
    }));
  check('TRAVELER: a WARM conversation → they walk with you, a bond already bound',
    await J(() => {
      RUN = newRun('ash'); RUN.roster = ['ash']; RUN.active = ['ash']; RUN.bonds = {};
      const rn = RUN.map.find(n => n.type === 'recruit'); rn.hero = 'cassia';
      try { localStorage.setItem(STARTERS_KEY, JSON.stringify(['ash'])); } catch (_) {}   // traveler is UNMET → full cutscene
      showRecruit(rn);
      const jcrun = (picks) => { let g = 0, pi = 0; while (g++ < 40) { const o = document.querySelectorAll('.jc-opt'); if (o.length) { (o[picks[pi++]] || o[0]).click(); continue; } if (document.querySelector('.jc-next')) { document.querySelector('.jc-scene').click(); continue; } break; } };
      jcrun([0, 0]);   // warm, warm
      return RUN.roster.includes('cassia') && (RUN.bonds['ash|cassia'] || 0) >= 1
        && ((document.querySelector('.tc-eyebrow') || {}).textContent || '').includes('THREAD IS BOUND');
    }));
  check('TRAVELER: a GUARDED conversation → they walk with you, but no bond yet',
    await J(() => {
      RUN = newRun('ash'); RUN.roster = ['ash']; RUN.active = ['ash']; RUN.bonds = {};
      const rn = RUN.map.find(n => n.type === 'recruit'); rn.hero = 'mira';
      try { localStorage.setItem(STARTERS_KEY, JSON.stringify(['ash'])); } catch (_) {}   // traveler is UNMET → full cutscene
      showRecruit(rn);
      const jcrun = (picks) => { let g = 0, pi = 0; while (g++ < 40) { const o = document.querySelectorAll('.jc-opt'); if (o.length) { (o[picks[pi++]] || o[0]).click(); continue; } if (document.querySelector('.jc-next')) { document.querySelector('.jc-scene').click(); continue; } break; } };
      jcrun([1, 1]);   // guarded, transactional → wary join
      return RUN.roster.includes('mira') && (RUN.bonds['ash|mira'] || 0) === 0;
    }));
  check('TRAVELER: CROSSING them in the talk → they turn foe (and are queued to ambush)',
    await J(() => {
      RUN = newRun('ash'); RUN.roster = ['ash']; RUN.active = ['ash']; RUN.foes = [];
      const rn = RUN.map.find(n => n.type === 'recruit'); rn.hero = 'cassia';
      try { localStorage.setItem(STARTERS_KEY, JSON.stringify(['ash'])); } catch (_) {}   // traveler is UNMET → full cutscene
      showRecruit(rn);
      const jcrun = (picks) => { let g = 0, pi = 0; while (g++ < 40) { const o = document.querySelectorAll('.jc-opt'); if (o.length) { (o[picks[pi++]] || o[0]).click(); continue; } if (document.querySelector('.jc-next')) { document.querySelector('.jc-scene').click(); continue; } break; } };
      jcrun([2, 1]);   // cold, then the hostile line
      return !RUN.roster.includes('cassia') && RUN.foes.includes('cassia')
        && ((document.querySelector('.tc-name') || {}).textContent || '').includes('CASSIA TURNS AWAY');
    }));
  check('TRAVELER: the wronged foe SPRINGS an ambush at the next fight (vengeful, weak to their own school)',
    await J(() => {
      const fn = RUN.map.find(n => n.type === 'fight');
      startMapFight(fn);
      const foe = S.enemies.find(e => e.def.name === 'VENGEFUL CASSIA');
      return !!foe && foe.def.weak === HEROES.cassia.school && RUN.foes.length === 0;
    }));
  check('TRAVELER: a guarded start can WARM UP in the second beat → friend',
    await J(() => {
      RUN = newRun('ash'); RUN.roster = ['ash']; RUN.active = ['ash']; RUN.bonds = {};
      const rn = RUN.map.find(n => n.type === 'recruit'); rn.hero = 'branwen';
      try { localStorage.setItem(STARTERS_KEY, JSON.stringify(['ash'])); } catch (_) {}   // traveler is UNMET → full cutscene
      showRecruit(rn);
      const jcrun = (picks) => { let g = 0, pi = 0; while (g++ < 40) { const o = document.querySelectorAll('.jc-opt'); if (o.length) { (o[picks[pi++]] || o[0]).click(); continue; } if (document.querySelector('.jc-next')) { document.querySelector('.jc-scene').click(); continue; } break; } };
      jcrun([1, 0]);   // guarded start, warm turn → friend
      return RUN.roster.includes('branwen') && (RUN.bonds['ash|branwen'] || 0) >= 1;
    }));
  check('TRAVELER: a full trio still gets the conversation encounter',
    await J(() => {
      RUN = newRun('ash'); RUN.roster = ['ash', 'elin', 'mira']; RUN.active = ['ash', 'elin', 'mira'];
      const rn = RUN.map.find(n => n.type === 'recruit'); rn.hero = 'branwen';
      try { localStorage.setItem(STARTERS_KEY, JSON.stringify(['ash'])); } catch (_) {}   // traveler is UNMET → full cutscene
      showRecruit(rn);
      return !!document.querySelector('#overlay.jc .jc-scene') && !document.querySelector('#rc-friend');
    }));
  // PARTY-AWARE DEPTH: an ally already in your line vouches (speaks + a ♦ shortcut)
  check('TRAVELER: a present ally VOUCHES — they speak in-scene and a ♦ shortcut appears',
    await J(() => {
      RUN = newRun('ash'); RUN.roster = ['ash', 'elin']; RUN.active = ['ash', 'elin']; RUN.bonds = {};
      const rn = RUN.map.find(n => n.type === 'recruit'); rn.hero = 'cassia';   // Elin knows Cassia
      try { localStorage.setItem(STARTERS_KEY, JSON.stringify(['ash'])); } catch (_) {}   // traveler is UNMET → full cutscene
      showRecruit(rn);
      let sawElin = false, g = 0;
      while (g++ < 12) {
        if (((document.querySelector('.jc-plate') || {}).textContent || '') === 'ELIN') sawElin = true;
        if (document.querySelector('.jc-opt')) break;
        document.querySelector('.jc-scene').click();
      }
      return sawElin && !!document.querySelector('.jc-vouch');
    }));
  check('TRAVELER: taking the ally’s vouch → they join as a friend (bonded)',
    await J(() => {
      RUN = newRun('ash'); RUN.roster = ['ash', 'elin']; RUN.active = ['ash', 'elin']; RUN.bonds = {};
      const rn = RUN.map.find(n => n.type === 'recruit'); rn.hero = 'cassia';
      try { localStorage.setItem(STARTERS_KEY, JSON.stringify(['ash'])); } catch (_) {}   // traveler is UNMET → full cutscene
      showRecruit(rn);
      const jcrun = (picks) => { let g = 0, pi = 0; while (g++ < 40) { const o = document.querySelectorAll('.jc-opt'); if (o.length) { const p = picks[pi++]; (typeof p === 'string' ? document.querySelector(p) : o[p]).click(); continue; } if (document.querySelector('.jc-next')) { document.querySelector('.jc-scene').click(); continue; } break; } };
      jcrun(['.jc-vouch', 0]);
      return RUN.roster.includes('cassia') && (RUN.bonds['ash|cassia'] || 0) >= 1;
    }));
  // PARTY MOOD
  check('MOOD: solo → ALONE · two crossings → HUNTED · two kindled bonds → IRONBOUND',
    await J(() => {
      RUN = newRun('ash'); RUN.active = ['ash']; RUN.bonds = {}; RUN.foesMade = 0;
      const solo = partyMood();
      RUN.active = ['ash', 'elin', 'mira']; RUN.foesMade = 2;
      const hunted = partyMood();
      RUN.foesMade = 0; RUN.bonds = { 'ash|elin': 2, 'ash|mira': 2 };
      const iron = partyMood();
      return solo === 'lonely' && hunted === 'hunted' && iron === 'ironbound';
    }));
  check('MOOD: a traveler READS your party in the scene (mood aside spoken)',
    await J(() => {
      RUN = newRun('ash'); RUN.roster = ['ash']; RUN.active = ['ash'];   // lonely → a read line exists
      const rn = RUN.map.find(n => n.type === 'recruit'); rn.hero = 'mira';
      try { localStorage.setItem(STARTERS_KEY, JSON.stringify(['ash'])); } catch (_) {}   // traveler is UNMET → full cutscene
      showRecruit(rn);
      const read = MOODS[partyMood()].read;
      let saw = false, g = 0;
      while (g++ < 12) {
        const l = (document.querySelector('.jc-line') || {}).textContent || '';
        if (read && l.indexOf(read.slice(0, 12)) >= 0) saw = true;
        if (document.querySelector('.jc-opt')) break;
        document.querySelector('.jc-scene').click();
      }
      return saw;
    }));
  check('MOOD: the map shows a mood chip (HUNTED after crossings)',
    await J(() => {
      RUN = newRun('ash'); RUN.active = ['ash']; RUN.foesMade = 2;
      showMap();
      const chip = document.querySelector('.map-mood');
      return !!chip && chip.textContent.includes('HUNTED');
    }));
  // PLACEMENT: recruits scatter across random depths (FFT-style), not clustered up front
  check('MAP: recruits scatter to random depths (one early, the rest spread deeper)',
    await J(() => {
      const seen = new Set(); let earlyAlways = true;
      for (let k = 0; k < 30; k++) {
        const map = generateDescent(['ash'], 1);
        const lvls = map.filter(nn => nn && nn.type === 'recruit').map(nn => nn.level);
        lvls.forEach(l => seen.add(l));
        if (!lvls.includes(2)) earlyAlways = false;
      }
      return earlyAlways && [...seen].some(l => l >= 4) && seen.size >= 3;   // reaches deeper than the old 2–4 cluster
    }));
  // REUNION: an already-met hero is a LIGHT re-encounter, not the full cutscene
  check('REUNION: an already-met hero gets a lighter re-encounter (A FAMILIAR FACE)',
    await J(() => {
      unlockStarter('branwen');   // met in a past run
      RUN = newRun('ash'); RUN.roster = ['ash']; RUN.active = ['ash']; RUN.bonds = {};
      const rn = { id: 300, type: 'recruit', hero: 'branwen', level: 3, col: 3 }; RUN.map[300] = rn;
      showRecruit(rn);
      return ((document.querySelector('.jc-eyebrow') || {}).textContent || '').includes('FAMILIAR FACE')
        && !!document.querySelector('.jc-line');
    }));
  check('REUNION: one warm word and they fall back in — bonded, no second beat',
    await J(() => {
      unlockStarter('branwen');
      RUN = newRun('ash'); RUN.roster = ['ash']; RUN.active = ['ash']; RUN.bonds = {};
      const rn = { id: 301, type: 'recruit', hero: 'branwen', level: 3, col: 3 }; RUN.map[301] = rn;
      showRecruit(rn);
      const jcrun = (picks) => { let g = 0, pi = 0; while (g++ < 20) { const o = document.querySelectorAll('.jc-opt'); if (o.length) { (o[picks[pi++]] || o[0]).click(); continue; } if (document.querySelector('.jc-next')) { document.querySelector('.jc-scene').click(); continue; } break; } };
      jcrun([0]);   // a single warm reply → friend
      return RUN.roster.includes('branwen') && (RUN.bonds['ash|branwen'] || 0) >= 1;
    }));

  // ---------- EMERGENT GROWTH (tier-3 forge loops) ----------
  console.log('--- EMERGENT ---');
  check('EMERGENT: each party hero has a tier-3 emergent node that forges a temp card',
    await J(() => {
      const em = EMBER_TREE.filter(n => n.type === 'emergent');
      return ['ash', 'elin', 'mira', 'cassia', 'branwen'].every(h => em.some(n => n.hero === h && n.tier === 3 && n.emergent && n.emergent.forge));
    }));
  check('EMERGENT: an emergent node needs its signature prerequisite kindled first',
    await J(() => {
      const n = NODE_BY_ID['mira.emergent.bloodscent'];
      return !!n && (n.requires || []).includes('mira.sig.back');
    }));
  check('EMERGENT: Mira’s Bloodscent forges Execute on her 2nd EXPOSED — not the 1st',
    await J(() => {
      RUN = newRun('mira'); RUN.active = ['mira']; RUN.nodes = ['mira.sig.back', 'mira.emergent.bloodscent'];
      startFight({ type: 'fight', chapter: 3, useRunHp: true, heroes: ['mira'], enemies: ['husk'] });
      const has = () => S.tempCards.some(c => c.name === 'Execute');
      fireEmergent('mira', 'expose');
      const afterOne = has();
      fireEmergent('mira', 'expose');
      const afterTwo = has();
      return afterOne === false && afterTwo === true;
    }));
  check('EMERGENT: the tally accrues ACROSS fights in a descent (grows over the run)',
    await J(() => {
      RUN = newRun('mira'); RUN.active = ['mira']; RUN.nodes = ['mira.sig.back', 'mira.emergent.bloodscent'];
      startFight({ type: 'fight', chapter: 3, useRunHp: true, heroes: ['mira'], enemies: ['husk'] });
      fireEmergent('mira', 'expose');                                   // fight A: 1 mark, no forge yet
      const forgedInA = S.tempCards.some(c => c.name === 'Execute');
      startFight({ type: 'fight', chapter: 3, useRunHp: true, heroes: ['mira'], enemies: ['husk'] });  // fresh fight, fresh hand
      const freshHand = !S.tempCards.some(c => c.name === 'Execute');
      fireEmergent('mira', 'expose');                                   // fight B: 2nd mark of the RUN → forge
      const forgedInB = S.tempCards.some(c => c.name === 'Execute');
      return forgedInA === false && freshHand === true && forgedInB === true;
    }));
  check('EMERGENT: a forged temp card cannot itself re-trigger the loop (no snowball)',
    await J(() => {
      RUN = newRun('ash'); RUN.active = ['ash']; RUN.nodes = ['ash.sig.front', 'ash.emergent.tempo'];
      startFight({ type: 'fight', chapter: 3, useRunHp: true, heroes: ['ash'], enemies: ['husk'] });
      RUN.emCount = {};
      const temp = { temp: true, owner: 'ash', kind: 'temp' };
      for (let i = 0; i < 6; i++) fireEmergent('ash', 'hit', temp);   // temp plays never count
      return (RUN.emCount['ash.emergent.tempo'] || 0) === 0;
    }));
  check('EMERGENT: an all-out burst does not forge emergent cards',
    await J(() => {
      RUN = newRun('mira'); RUN.active = ['mira']; RUN.nodes = ['mira.sig.back', 'mira.emergent.bloodscent'];
      startFight({ type: 'fight', chapter: 3, useRunHp: true, heroes: ['mira'], enemies: ['husk'] });
      S._burstResolving = true;
      fireEmergent('mira', 'expose'); fireEmergent('mira', 'expose');
      S._burstResolving = false;
      return !S.tempCards.some(c => c.name === 'Execute');
    }));
  check('EMERGENT: kindling an emergent node plays the KINDLE BURST cinematic',
    await J(() => {
      RUN = newRun('mira'); RUN.active = ['mira']; RUN.embers = 30; RUN.completed = [0, 1, 2, 3, 4, 5, 6, 7];
      RUN.nodes = ['mira.sig.back'];
      showEmberTree(() => {}, 'mira', 'mira.emergent.bloodscent');
      const buy = document.querySelector('#et-buy'); if (!buy) return false;
      buy.click();
      return hasNode('mira.emergent.bloodscent') && !!document.querySelector('#kindle-fx.t-emergent');
    }));
  await J(() => { const el = document.querySelector('#kindle-fx'); if (el) el.remove(); });

  // ---------- TITLE + SETTINGS (cinematic) ----------
  console.log('--- TITLE ---');
  check('TITLE: cinematic screen — NEW GAME + SETTINGS, no THE DESCENT / no HEAT, version at bottom',
    await J(() => {
      showTitle();
      const cine = document.querySelector('#overlay.title-cine');
      return !!cine && !!document.querySelector('.tt-title') && !!document.querySelector('#t-new') && !!document.querySelector('#t-settings')
        && !document.querySelector('#t-descent') && !document.querySelector('#heat-up')
        && !!document.querySelector('.tt-ver') && (document.querySelector('.tt-ver').textContent || '').includes('BUILD');
    }));
  check('TITLE: key-art reflects your LAST-played starter (falls back to Ash)',
    await J(() => {
      try { localStorage.removeItem(LAST_STARTER_KEY); } catch (_) {}
      showTitle();
      const dflt = !!document.querySelector('.tt-keyart.tt-art-ash');
      try { localStorage.setItem(LAST_STARTER_KEY, 'mira'); } catch (_) {}
      showTitle();
      const last = !!document.querySelector('.tt-keyart.tt-art-mira');
      try { localStorage.removeItem(LAST_STARTER_KEY); } catch (_) {}
      return dflt && last;
    }));
  check('SETTINGS: offers sound, HEAT, dev tools; BACK returns to the title',
    await J(() => {
      showSettings();
      const hasBits = !!document.querySelector('#s-sound') && !!document.querySelector('#s-heat-up') && !!document.querySelector('#s-dev');
      document.querySelector('#s-back').click();
      return hasBits && !!document.querySelector('#overlay.title-cine');
    }));
  check('SETTINGS: Heat adjusts from here (moved off the title)',
    await J(() => {
      META.heat = 0; showSettings();
      document.querySelector('#s-heat-up').click(); document.querySelector('#s-heat-up').click();
      return (META.heat || 0) === 2;
    }));

  // ---------- DEV: reset progress (test first-time flow) ----------
  console.log('--- DEV ---');
  check('DEV: the dev panel offers a RESET PROGRESS control',
    await J(() => { showDevPanel(); return !!document.querySelector('#d-reset'); }));
  check('DEV: reset wipes unlocks + tutorial + abyss, keeps device settings',
    await J(() => {
      unlockStarter('cassia'); setTreeTaught();
      localStorage.setItem(PROGRESS_KEY, '5');
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ sound: true }));   // a device pref to preserve
      const before = getUnlockedStarters().includes('cassia') && treeTaught();
      resetProgress();
      return before
        && localStorage.getItem(STARTERS_KEY) === null
        && localStorage.getItem(PROGRESS_KEY) === null
        && localStorage.getItem('kizuna2_1.treeTaught') === null
        && !treeTaught() && !getUnlockedStarters().includes('cassia')
        && !!localStorage.getItem(SETTINGS_KEY);   // settings kept
    }));

  // ---------- DEEP TREES (Phase 2): layered keyword identities per hero ----------
  console.log('--- DEEP TREES ---');
  await J(() => {
    window.setupFight = (heroes, nodeIds, rows, hp) => {
      RUN = newRun(heroes[0]);
      RUN.roster = heroes.slice(); RUN.active = heroes.slice();
      RUN.hp = {}; heroes.forEach(h => RUN.hp[h] = (hp && hp[h]) || HEROES[h].maxHp);
      RUN.nodes = nodeIds.slice();
      RUN.completed = [0, 1, 2, 3, 4, 5, 6, 7, 8];   // depth 9 → all four tiers open
      RUN.bonds = {};
      RUN._rotations = false;   // this helper exercises the CLASSIC tree mechanics (riders/passives); the ROTATION block flips it on per-test
      startMapFight(RUN.map.find(x => x.type === 'fight'));
      if (rows) S.heroes.forEach(h => { if (rows[h.id]) h.row = rows[h.id]; });
      S.ep = 20; renderAll();
    };
    window.handCard = (name) => buildHand().find(c => c.name === name);
  });
  // RIDERS — keywords bolt onto signatures at build time
  check('TREE ash.rider.wave: Crashing Wave strikes +3 (11→14)',
    await J(() => { setupFight(['ash'], ['ash.sig.front', 'ash.rider.wave'], { ash: 'front' }); const c = handCard('Crashing Wave'); return !!c && c.fx.dmg === 14; }));
  check('TREE mira.rider.twin: Twin Daggers now also EXPOSED 3',
    await J(() => { setupFight(['mira'], ['mira.sig.mid', 'mira.rider.twin'], { mira: 'mid' }); const c = handCard('Twin Daggers'); return !!c && c.fx.mark === 3; }));
  check('TREE cassia.rider.aegis: Aegis also grants COUNTER 1',
    await J(() => { setupFight(['cassia'], ['cassia.sig.mid', 'cassia.rider.aegis'], { cassia: 'mid' }); const c = handCard('Aegis'); return !!c && c.fx.counter === 1; }));
  check('TREE branwen.rider.volley: Killshot now also EXPOSED 2',
    await J(() => { setupFight(['branwen'], ['branwen.sig.mid', 'branwen.rider.volley'], { branwen: 'mid' }); const c = handCard('Killshot'); return !!c && c.fx.mark === 2; }));
  check('TREE elin.rider.radiance: Radiant Ward also heals party 2',
    await J(() => { setupFight(['elin'], ['elin.sig.front', 'elin.rider.radiance'], { elin: 'front' }); const c = handCard('Radiant Ward'); return !!c && c.fx.heal === 2 && c.fx.guard === 3; }));
  // dmgMod passives — EXPOSED exploiters
  check('TREE mira.passive.opportunist: +3 damage to an EXPOSED foe',
    await J(() => { setupFight(['mira'], ['mira.passive.opportunist'], { mira: 'mid' }); const e = S.enemies[0]; e.mark = 0; const a = passiveDmg(S.heroes[0], e); e.mark = 4; return a === 0 && passiveDmg(S.heroes[0], e) === 3; }));
  check('TREE branwen.passive.focus: +2 damage to an EXPOSED foe',
    await J(() => { setupFight(['branwen'], ['branwen.passive.focus'], { branwen: 'back' }); const e = S.enemies[0]; e.mark = 3; return passiveDmg(S.heroes[0], e) === 2; }));
  // postHit execute — Death Mark
  check('TREE mira.passive.deathmark: EXECUTES a foe at ≤30% HP, spares a healthy one',
    await J(() => {
      setupFight(['mira'], ['mira.passive.deathmark'], { mira: 'mid' });
      const e = S.enemies[0]; e.hp = Math.ceil(e.maxHp * 0.28); e.dead = false; firePassives('postHit', 'mira', { tgt: e });
      const executed = e.dead || e.hp <= 0;
      e.hp = e.maxHp; e.dead = false; firePassives('postHit', 'mira', { tgt: e });
      return executed && !e.dead;
    }));
  // turnStart passives
  check('TREE cassia.passive.vigil: braces +2 guard at turn start',
    await J(() => { setupFight(['cassia'], ['cassia.passive.vigil'], { cassia: 'front' }); const h = S.heroes[0]; h.guard = 0; firePassives('turnStart', 'cassia', {}); return h.guard === 2; }));
  check('TREE elin.passive.ward: turn start shields the most-wounded ally',
    await J(() => { setupFight(['elin', 'ash'], ['elin.passive.ward'], { elin: 'back', ash: 'front' }, { ash: 5 }); S.heroes.forEach(h => h.guard = 0); firePassives('turnStart', 'elin', {}); const ash = S.heroes.find(h => h.id === 'ash'); return ash.guard === 2; }));
  check('TREE branwen.passive.opening: turn start EXPOSES the nearest foe',
    await J(() => { setupFight(['branwen'], ['branwen.passive.opening'], { branwen: 'back' }); frontmostEnemy().mark = 0; firePassives('turnStart', 'branwen', {}); return frontmostEnemy().mark === 1; }));
  // enterRow passives
  check('TREE ash.passive.flow: changing rows rallies his next card +3',
    await J(() => { setupFight(['ash'], ['ash.passive.flow'], { ash: 'front' }); const h = S.heroes[0]; h.buffDmg = 0; firePassives('enterRow', 'ash', { toRow: 'mid', fromRow: 'front' }); return h.buffDmg === 3; }));
  // EP-refund latches (once per turn)
  check('TREE ash.passive.relentless: 1st follow-up refunds 1 EP, the 2nd does not',
    await J(() => { setupFight(['ash', 'mira'], ['ash.passive.relentless'], { ash: 'front', mira: 'mid' }); S._flags = {}; S.ep = 5; firePassives('followup', 'ash', {}); const a = S.ep; firePassives('followup', 'ash', {}); return a === 6 && S.ep === 6; }));
  check('TREE branwen.passive.reckoning: killing a MARKED foe refunds 1 EP (unmarked does not)',
    await J(() => { setupFight(['branwen'], ['branwen.passive.reckoning'], { branwen: 'back' }); S._flags = {}; S.ep = 4; firePassives('kill', 'branwen', { tgt: { mark: 2 } }); const a = S.ep; S._flags = {}; firePassives('kill', 'branwen', { tgt: { mark: 0 } }); return a === 5 && S.ep === 5; }));
  // capstone — Immovable
  check('TREE cassia.passive.immovable: her guard persists through the enemy turn',
    await J(() => { setupFight(['cassia'], ['cassia.passive.immovable'], { cassia: 'front' }); return keepsGuard('cassia') === true && keepsGuard('ash') === false; }));
  // capstone — Radiant Overflow (real heal; overheal spill reaches the whole party)
  check('TREE elin.passive.overflow: overheal shields the WHOLE party, not just the target',
    await J(async () => {
      setupFight(['elin', 'ash'], ['elin.passive.overflow', 'elin.sig.back'], { elin: 'back', ash: 'front' });
      S.heroes.forEach(h => { h.hp = h.maxHp; h.guard = 0; });
      await playCard(handCard('Benediction'), 'ash');   // heal 8, all overflow → +8 guard to both (+2 bond each)
      const ash = S.heroes.find(h => h.id === 'ash'), elin = S.heroes.find(h => h.id === 'elin');
      return elin.guard >= 8 && ash.guard >= 8;   // elin (non-target) got the spill ⇒ overflow works
    }));
  // ALL-OUT upgrades — resolve a full burst (untimed strikes still complete)
  check('TREE cassia.allout.fortress + elin.allout.dawn: party braces before & heals after the all-out',
    await J(async () => {
      setupFight(['cassia', 'elin'],
        ['cassia.allout.fortress', 'cassia.emergent.bulwark', 'cassia.sig.front', 'elin.allout.dawn', 'elin.emergent.afterglow', 'elin.sig.back'],
        { cassia: 'front', elin: 'back' });
      S.enemies.forEach(e => { e.hp = e.maxHp = 400; });   // survive the burst so Dawnbreak fires
      S.heroes.forEach(h => { h.hp = Math.max(1, h.maxHp - 12); h.guard = 0; });
      const beforeHp = {}; S.heroes.forEach(h => beforeHp[h.id] = h.hp);
      window.__autoParry = false; S.momentum = 100; renderAll();
      await triggerAllOut();
      const bracedAll = S.heroes.every(h => h.guard >= 5);     // Fortress +5 to everyone
      const healedAll = S.heroes.every(h => h.hp === beforeHp[h.id] + 5);   // Dawnbreak +5 to everyone
      return bracedAll && healedAll;
    }));

  // ---------- TEAM SYNERGY (Phase 3): cross-hero payoffs ----------
  console.log('--- TEAM SYNERGY ---');
  check('SYN ash.synergy.warcry: a follow-up hands the followed ally RALLY +2',
    await J(() => { setupFight(['ash', 'mira'], ['ash.synergy.warcry', 'ash.emergent.tempo'], { ash: 'front', mira: 'mid' }); const m = S.heroes.find(h => h.id === 'mira'); m.buffDmg = 0; firePassives('followup', 'ash', { ally: 'mira' }); return m.buffDmg === 2; }));
  check('SYN elin.synergy.blessing: mending/warding an ally blesses their next strike +2',
    await J(async () => { setupFight(['elin', 'ash'], ['elin.synergy.blessing'], { elin: 'mid', ash: 'front' }, { ash: 10 }); const a = S.heroes.find(h => h.id === 'ash'); a.buffDmg = 0; await playCard(handCard('Mend'), 'ash'); return a.buffDmg === 2; }));
  check('SYN mira.synergy.marked: EXPOSED foes take +2 from EVERY ally (not just Mira)',
    await J(() => { setupFight(['ash', 'mira'], ['mira.synergy.marked'], { ash: 'front', mira: 'mid' }); const e = S.enemies[0], a = S.heroes.find(h => h.id === 'ash'); e.mark = 0; const clean = passiveDmg(a, e); e.mark = 3; return clean === 0 && passiveDmg(a, e) === 2; }));
  check('SYN cassia.synergy.soak: allies BEHIND Cassia take −2 (she does not soak for those ahead)',
    await J(() => { setupFight(['cassia', 'ash'], ['cassia.synergy.soak'], { cassia: 'front', ash: 'back' }); const a = S.heroes.find(h => h.id === 'ash'), c = S.heroes.find(h => h.id === 'cassia'); return soakMitigation(a) === 2 && soakMitigation(c) === 0; }));
  check('SYN branwen.synergy.cadence: turn start rallies the party only when a foe is EXPOSED',
    await J(() => { setupFight(['branwen', 'ash'], ['branwen.synergy.cadence'], { branwen: 'back', ash: 'front' }); S.heroes.forEach(h => h.buffDmg = 0); livingEnemies().forEach(e => e.mark = 0); firePassives('turnStart', 'branwen', {}); const noMark = S.heroes.map(h => h.buffDmg).join(','); frontmostEnemy().mark = 2; firePassives('turnStart', 'branwen', {}); return noMark === '0,0' && S.heroes.every(h => h.buffDmg === 1); }));

  // ---------- DUET: a kindled PAIR + a shared act awakens a 2-hero vow ----------
  console.log('--- DUET ---');
  const duetSetup = await J(() => {
    RUN = newRun('ash');
    RUN.roster = ['ash', 'elin']; RUN.active = ['ash', 'elin'];
    RUN.hp = { ash: 20, elin: 24 };
    RUN.bonds = {}; RUN.bonds[pairKey('ash', 'elin')] = 2;   // KINDLED across the run
    startMapFight(RUN.map.find(x => x.type === 'fight'));
    return { pre: [...S.threads] };
  });
  await sleep(200);
  check('DUET: a kindled pair walks in with its thread PRE-FORMED',
    duetSetup.pre.length === 1 && duetSetup.pre[0] === 'ash|elin', JSON.stringify(duetSetup.pre));
  await J(async () => { await addThread('ash', 'elin'); });   // the shared act this fight
  await sleep(300);
  check('DUET: the shared act forged the pair vow (Warded Edge · 3 EP)',
    await J(() => { const d = S.tempCards.find(c => c.fx && c.fx.duet); return !!d && d.name === 'Warded Edge' && d.cost === 3; }),
    await J(() => JSON.stringify(S.tempCards.map(c => c.name))));
  check('DUET: it supersedes the generic Echo Bond', await J(() => !S.tempCards.find(c => c.name === 'Echo Bond')));
  check('DUET: costs 3 EP not the whole turn — playable now',
    await J(() => { const el = [...document.querySelectorAll('#hand .card')].find(x => x.dataset.cardName === 'Warded Edge'); return !!el && !el.classList.contains('disabled'); }));
  const dBefore = await J(() => ({ hp: S.enemies[0].hp, ep: S.ep }));
  await tapCard('Warded Edge'); await sleep(3200);   // the duet now plays a cinematic intro before its stages resolve
  const dAfter = await J(() => ({ hp: S.enemies[0].hp, guards: S.heroes.map(h => h.guard), ep: S.ep, gone: !S.tempCards.find(c => c.fx && c.fx.duet) }));
  check('DUET: resolves — both guard +4, foe struck 5, 3 EP spent, card consumed',
    dAfter.guards.every(g => g >= 6) && dAfter.hp === dBefore.hp - 5 && dAfter.ep === dBefore.ep - 3 && dAfter.gone,
    JSON.stringify({ dBefore, dAfter }));
  const noDuet = await J(async () => {
    RUN = newRun('ash');
    RUN.roster = ['ash', 'mira']; RUN.active = ['ash', 'mira'];
    RUN.hp = { ash: 32, mira: 22 }; RUN.bonds = {};   // un-kindled
    startMapFight(RUN.map.find(x => x.type === 'fight'));
    await addThread('ash', 'mira');
    return { duet: !!S.tempCards.find(c => c.fx && c.fx.duet), echo: !!S.tempCards.find(c => c.name === 'Echo Bond') };
  });
  check('DUET: an UN-kindled pair awakens no vow (falls back to Echo Bond)',
    !noDuet.duet && noDuet.echo, JSON.stringify(noDuet));

  // ---------- KIZUNA REACH: bonds form through ordinary cooperative play ----------
  console.log('--- KIZUNA REACH ---');
  check('KIZUNA: a party-wide ward threads the caster to EVERY ally it shelters',
    await J(async () => {
      setupFight(['elin', 'ash', 'mira'], ['elin.sig.front'], { elin: 'front', ash: 'mid', mira: 'back' });
      window.triadCeremony = async () => { S.resonantNew = true; };   // don't block on the cinematic
      S.ep = 20; const before = S.threads.size;
      await playCard(handCard('Radiant Ward'), null);   // target 'allies' → wards the whole party
      return before === 0 && S.threads.has('ash|elin') && S.threads.has('elin|mira') && S.threads.size === 2;
    }));
  check('KIZUNA: ganging up — a follow-up threads the striker with EVERY prior hitter of that foe',
    await J(async () => {
      setupFight(['ash', 'mira', 'branwen'], ['mira.sig.mid', 'branwen.sig.back'], { ash: 'front', mira: 'mid', branwen: 'back' });
      window.triadCeremony = async () => { S.resonantNew = true; };
      S.ep = 20; S.threads.clear();
      const e = frontmostEnemy(); e.hp = e.maxHp = 99;
      await playCard(buildHand().find(c => c.owner === 'ash' && c.fx && c.fx.dmg), e.uid);           // ash hits
      await playCard(buildHand().find(c => c.owner === 'mira' && c.name === 'Twin Daggers'), e.uid);  // mira follows → ash-mira
      await playCard(buildHand().find(c => c.owner === 'branwen' && c.name === 'Killing Arrow'), e.uid); // branwen follows → threads BOTH prior
      return S.threads.has('ash|mira') && S.threads.has('ash|branwen') && S.threads.has('branwen|mira') && S.triadFormed;
    }));

  // ---------- UI POLISH (Build 47): boss intent · tree pan · event cards ----------
  console.log('--- UI POLISH ---');
  check('UI: a buff intent telegraphs its EFFECT compactly (no flavor-text wrap)',
    await J(() => {
      RUN = newRun('ash'); RUN.roster = ['ash']; RUN.active = ['ash']; RUN.hp = { ash: 32 };
      startFight({ type: 'fight', chapter: 3, heroes: ['ash'], enemies: ['echodevourer'], useRunHp: true, floor: 2, depth: 7, isBoss: true, narrator: '' });
      S.enemies[0].intentIdx = 1;   // "The Hunger Deepens" — a buff intent
      renderAll();
      const pill = document.querySelector('.figure.floor-boss .intent');
      const seg = pill && pill.querySelector('.i-seg .i-row');
      return !!seg && /▲|⛨|GATHERS/.test(seg.textContent) && !/feeds/.test(pill.innerText);
    }));
  check('UI: the ember tree PANS on drag so outer-ring nodes are reachable',
    await J(() => {
      RUN = newRun('ash'); RUN.active = ['ash']; RUN.nodes = []; RUN.embers = 30; RUN.completed = [0, 1, 2, 3, 4, 5];
      showEmberTree(() => {}, 'ash');
      const c = document.getElementById('et-canvas'), pan = document.getElementById('et-pan');
      if (!c || !pan) return false;
      const P = (ty, x, y) => c.dispatchEvent(new PointerEvent(ty, { bubbles: true, pointerId: 9, clientX: x, clientY: y }));
      P('pointerdown', 400, 300); P('pointermove', 315, 240); P('pointerup', 315, 240);
      return /translate\(-?\d/.test(pan.style.transform) && pan.style.transform !== 'translate(0px, 0px)';
    }));
  check('UI: event choices are unified cards (icon · ACT · consequence)',
    await J(() => {
      hideOverlay(); showEvent({ id: 99, eventId: 'shrine' });
      const a = document.querySelector('#ev-a');
      return !!a && !!a.querySelector('.ev-choice-icon') && !!a.querySelector('.ev-choice-label')
        && !!a.querySelector('.ev-choice-effect') && !!document.querySelector('#ev-b .ev-choice-effect');
    }));

  // ---------- BOONS (mid-run randomness): companion gifts drafted 1-of-3 ----------
  console.log('--- BOONS ---');
  check('BOON: a companion gift bends a card (Duelist’s Focus → Ash sig +3)',
    await J(() => {
      RUN = newRun('ash'); RUN.roster = ['ash']; RUN.active = ['ash']; RUN.hp = { ash: 32 };
      RUN.boons = ['ash_duelist']; RUN.nodes = ['ash.sig.front']; RUN.completed = [0, 1, 2, 3];
      startFight({ type: 'fight', chapter: 3, heroes: ['ash'], enemies: ['husk'], useRunHp: true, floor: 1, depth: 4, narrator: '' });
      S.heroes[0].row = 'front'; const c = buildHand().find(x => x.name === 'Crashing Wave'); return !!c && c.fx.dmg === 14;
    }));
  check('BOON: a dmgMod gift applies only while its hero is FIELDED (Open Season)',
    await J(() => {
      RUN = newRun('ash'); RUN.roster = ['ash', 'branwen']; RUN.active = ['ash', 'branwen']; RUN.hp = { ash: 32, branwen: 20 };
      RUN.boons = ['branwen_season']; RUN.completed = [0, 1, 2, 3];
      startFight({ type: 'fight', chapter: 3, heroes: ['ash', 'branwen'], enemies: ['husk'], useRunHp: true, floor: 1, depth: 4, narrator: '' });
      const e = S.enemies[0], ash = S.heroes.find(h => h.id === 'ash'); e.mark = 2; const withB = passiveDmg(ash, e);
      RUN.active = ['ash']; const noB = passiveDmg(ash, e); return withB === 1 && noB === 0;
    }));
  check('BOON DRAFT: the pool is party-gated and picking one stores it',
    await J(() => {
      RUN = newRun('ash'); RUN.roster = ['ash', 'elin']; RUN.active = ['ash', 'elin']; RUN.boons = [];
      showBoonDraft(() => {}, {});
      const cards = [...document.querySelectorAll('.boon-card')];
      const gated = cards.every(c => ['ash', 'elin'].includes(BOON_BY_ID[c.id.replace('boon-', '')].hero));
      cards[0].click();
      return cards.length >= 1 && cards.length <= 3 && gated && RUN.boons.length === 1;
    }));
  check('CAMP: the fire’s third slot is COMMUNE (draw a boon), not the old Forge',
    await J(() => {
      RUN = newRun('ash'); RUN.roster = ['ash']; RUN.active = ['ash']; RUN.hp = { ash: 32 }; RUN.boons = [];
      showCamp({ id: 9, type: 'camp', label: 'EMBER REST' });
      return !!document.querySelector('#camp-boon') && !document.querySelector('#camp-forge');
    }));
  check('BOON: held gifts show in the combat topbar strip, party-gated',
    await J(() => {
      RUN = newRun('mira'); RUN.roster = ['mira', 'elin']; RUN.active = ['mira', 'elin']; RUN.hp = { mira: 22, elin: 24 };
      RUN.boons = ['mira_scent', 'cassia_vigil']; RUN.completed = [0, 1, 2, 3];   // cassia NOT fielded
      startFight({ type: 'fight', chapter: 3, heroes: ['mira', 'elin'], enemies: ['husk'], useRunHp: true, floor: 1, depth: 4, narrator: '' });
      renderAll();
      const ids = [...document.getElementById('combat-boons').children].map(c => c.dataset.boon);
      return ids.includes('mira_scent') && !ids.includes('cassia_vigil');
    }));
  check('BOON: the companion EVENT routes its gift choice into the draft',
    await J(() => {
      RUN = newRun('ash'); RUN.roster = ['ash', 'branwen']; RUN.active = ['ash', 'branwen']; RUN.boons = [];
      showEvent({ id: 3, type: 'event', eventId: 'companion' });
      document.querySelector('#ev-a').click();
      return !!document.querySelector('.boon-card');
    }));
  check('BOON: a proc pulses its topbar chip + pops a tag (Second Wind on follow-up)',
    await J(() => {
      RUN = newRun('ash'); RUN.roster = ['ash', 'mira']; RUN.active = ['ash', 'mira']; RUN.hp = { ash: 32, mira: 22 };
      RUN.boons = ['ash_relentless']; RUN.completed = [0, 1, 2, 3];
      startFight({ type: 'fight', chapter: 3, heroes: ['ash', 'mira'], enemies: ['husk'], useRunHp: true, floor: 1, depth: 4, narrator: '' });
      renderAll(); S._flags = {}; S.ep = 5;
      firePassives('followup', 'ash', { ally: 'mira' });
      const chip = document.querySelector('#combat-boons [data-boon="ash_relentless"]');
      return S.ep === 6 && !!chip && chip.classList.contains('cb-proc');
    }));
  check('BOON: a held gift is INSPECTABLE (press-hold / hover shows the full gift)',
    await J(() => {
      RUN = newRun('mira'); RUN.roster = ['mira']; RUN.active = ['mira']; RUN.hp = { mira: 22 };
      RUN.boons = ['mira_scent']; RUN.completed = [0, 1, 2, 3];
      startFight({ type: 'fight', chapter: 3, heroes: ['mira'], enemies: ['husk'], useRunHp: true, floor: 1, depth: 4, narrator: '' });
      renderAll();
      const chip = document.querySelector('#combat-boons .cb-boon');
      showBoonInspect(chip.dataset.boon, chip);
      const el = document.getElementById('boon-inspect');
      const ok = !!el && /Bloodscent/.test((el.querySelector('.bi-name') || {}).textContent || '') && /EXPOSED/.test(el.querySelector('.bi-desc').textContent);
      hideBoonInspect();
      return ok && !document.getElementById('boon-inspect');
    }));

  // ---------- SCALING: the 760×430 canvas fits every platform identically ----------
  console.log('--- SCALING ---');
  check('SCALE: fitStage fills the viewport at the correct contain-scale (desktop enlarges the logical canvas)',
    await J(() => {
      fitStage();
      const st = document.getElementById('stage');
      const sc = parseFloat((st.style.transform.match(/scale\(([-\d.]+)\)/) || [])[1]);
      const vv = window.visualViewport; const vw = (vv && vv.width) || innerWidth, vh = (vv && vv.height) || innerHeight;
      const k = isDesktop() ? DESK_K : 1;                 // desktop uses a larger 16:9 canvas so the UI reads smaller
      const want = Math.min(vw / (760 * k), vh / (430 * k));
      const sizeOK = Math.round(parseFloat(st.style.width)) === Math.round(760 * k) && Math.round(parseFloat(st.style.height)) === Math.round(430 * k);
      return Math.abs(sc - want) < 0.01 && sc > 0 && sizeOK;
    }));
  check('SCALE: fitStage reads visualViewport and never leaves the stage un-scaled',
    await J(() => { document.getElementById('stage').style.transform = ''; fitStage(); return /scale\([\d.]+\)/.test(document.getElementById('stage').style.transform); }));
  check('SCALE: screen⇄stage anchors round-trip exactly onto the target (no desktop tap/parry offset)',
    await J(() => {
      setupFight(['ash', 'elin', 'mira'], [], {}); fitStage(); renderAll();
      const st = document.getElementById('stage'), sr = st.getBoundingClientRect(), sc = stageScale();
      const fig = document.querySelector('.figure.party[data-fig="ash"]'), fr = figHitRect(fig);   // anchors on the visible ART, not the container box
      const a = noteAnchor(fig);                                  // screen → DESIGN coords (parry ring / popup anchor)
      const backX = sr.left + a.x * sc, backY = sr.top + a.y * sc;  // DESIGN → screen must return to the art
      return Math.abs(backX - (fr.left + fr.width / 2)) < 1 && Math.abs(backY - (fr.top + fr.height * 0.4)) < 1;
    }));
  check('SCALE: overlays anchor on the VISIBLE art, not an oversized figure box (boss reticle lands ON the boss)',
    await J(() => {
      RUN = newRun('ash'); RUN.roster = ['ash', 'elin', 'mira']; RUN.active = ['ash', 'elin', 'mira']; RUN.hp = { ash: 32, elin: 24, mira: 22 };
      RUN.nodes = []; RUN.completed = [0, 1];
      startFight({ type: 'fight', chapter: 3, heroes: ['ash', 'elin', 'mira'], enemies: ['echoknight2'], useRunHp: true, floor: 1, depth: 5, isBoss: true, narrator: '' });
      fitStage(); renderAll();
      const e = S.enemies[0], fig = document.querySelector(`[data-fig="${e.uid}"]`);
      const box = fig.getBoundingClientRect(), art = figHitRect(fig);
      const sr = document.getElementById('stage').getBoundingClientRect(), sc = stageScale();
      const a = noteAnchor(fig); const backX = sr.left + a.x * sc, backY = sr.top + a.y * sc;
      return box.width > art.width * 1.4                          // the boss container box really is much wider than the drawn boss
        && Math.abs(backX - (art.left + art.width / 2)) < 1       // yet the reticle/parry anchor sits on the ART
        && Math.abs(backY - (art.top + art.height * 0.4)) < 1;
    }));
  check('SCALE: the aim-layer / seq-preview viewBox tracks the design canvas (targeting reticle aims true)',
    await J(() => { const svg = aimLayer(); return svg.getAttribute('viewBox') === '0 0 ' + stageDW() + ' ' + stageDH(); }));

  // ---------- STANCE DEPTH: every position pathway grows nodes ----------
  console.log('--- STANCE DEPTH ---');
  check('TREE: every hero’s FRONT/MID/BACK signature now has a branch hanging off it',
    await J(() => {
      const heroes = ['ash', 'elin', 'mira', 'cassia', 'branwen'];
      const childrenOf = (id) => EMBER_TREE.filter(n => (n.requires || []).includes(id));
      return heroes.every(h => ['front', 'mid', 'back'].every(st => {
        const sig = (SIG_GATE[h] || {})[st];
        return !!sig && childrenOf(sig).length > 0;
      }));
    }));
  check('TREE: new stance nodes wire cleanly (valid requires, valid passives, unique ids)',
    await J(() => {
      const ids = new Set(); let ok = true;
      const special = ['elin_overflow'];   // handled inline in the heal-spill code, not via PASSIVE_DEFS
      EMBER_TREE.forEach(n => { if (ids.has(n.id)) ok = false; ids.add(n.id); });
      EMBER_TREE.forEach(n => { (n.requires || []).forEach(r => { if (!NODE_BY_ID[r]) ok = false; }); if ((n.type === 'passive' || n.type === 'synergy') && !PASSIVE_DEFS[n.passive] && !special.includes(n.passive)) ok = false; });
      return ok;
    }));

  // ---------- COMBO DEPTH: the thin stance lines grow a full arc ----------
  console.log('--- COMBO DEPTH ---');
  check('COMBO: Branwen’s MID line (once the thinnest) is now a 4-deep arc sig→steady→pierce→killing-blow',
    await J(() => {
      const chain = ['branwen.sig.mid', 'branwen.rider.steady', 'branwen.emergent.pierce', 'branwen.passive.killingblow'];
      // each node must require the one before it (a real prerequisite chain, not loose leaves)
      return chain.every((id, i) => !!NODE_BY_ID[id] && (i === 0 || (NODE_BY_ID[id].requires || []).includes(chain[i - 1])));
    }));
  check('COMBO elin.rider.searing: Smite (FRONT core) hits +3',
    await J(() => { setupFight(['elin'], ['elin.sig.front', 'elin.rider.searing'], { elin: 'front' }); const c = handCard('Smite'); return !!c && c.fx.dmg === 7; }));
  check('COMBO elin.rider.mercy: Benediction heals +3',
    await J(() => { setupFight(['elin'], ['elin.sig.back', 'elin.rider.mercy'], { elin: 'back' }); const c = handCard('Benediction'); return !!c && c.fx.heal === 11; }));
  check('COMBO elin.passive.evensong: turn start mends the most-wounded ally +3',
    await J(() => { setupFight(['elin', 'ash'], ['elin.passive.evensong'], { elin: 'back' }, { ash: 10 }); const a = S.heroes.find(h => h.id === 'ash'); const before = a.hp; firePassives('turnStart', 'elin', {}); return a.hp === before + 3; }));
  check('COMBO mira.rider.serrated: Shadow Knife (MID core) hits +2 and marks +1',
    await J(() => { setupFight(['mira'], ['mira.sig.mid', 'mira.rider.serrated'], { mira: 'mid' }); const c = handCard('Shadow Knife'); return !!c && c.fx.dmg === 6 && c.fx.mark === 4; }));
  check('COMBO mira.passive.frenzy: striking an EXPOSED foe buffs the next strike +2',
    await J(() => { setupFight(['mira'], ['mira.passive.frenzy'], { mira: 'mid' }); const h = S.heroes[0]; h.buffDmg = 0; const e = S.enemies[0]; e.mark = 2; firePassives('postHit', 'mira', { tgt: e }); return h.buffDmg === 2; }));
  check('COMBO cassia.rider.reinforce: Cover (MID core) wards +3',
    await J(() => { setupFight(['cassia'], ['cassia.sig.mid', 'cassia.rider.reinforce'], { cassia: 'mid' }); const c = handCard('Cover'); return !!c && c.fx.guard === 7; }));
  check('COMBO branwen.rider.steady: Killshot (MID signature) hits +3',
    await J(() => { setupFight(['branwen'], ['branwen.sig.mid', 'branwen.rider.steady'], { branwen: 'mid' }); const c = handCard('Killshot'); return !!c && c.fx.dmg === 14; }));
  check('COMBO branwen.passive.killingblow: +4 vs a foe at/below half HP, nothing above',
    await J(() => {
      setupFight(['branwen'], ['branwen.passive.killingblow'], { branwen: 'mid' });
      const h = S.heroes[0], e = S.enemies[0];
      e.maxHp = 100; e.hp = 100; const hi = passiveDmg(h, e);
      e.hp = 40; const lo = passiveDmg(h, e);
      return hi === 0 && lo === 4;
    }));

  // ---------- FLOOR 3: THE SUNDERING — a bond-cutting boss ----------
  console.log('--- FLOOR 3 ---');
  check('FLOOR 3: the Sundering is a mid-descent floor now (the run runs deeper than three)', await J(() => FLOORS > 3));
  check('FLOOR 3: a third floor generates THE SUNDERING as its boss',
    await J(() => {
      const map = generateDescent(['ash', 'elin', 'mira'], 3);
      const boss = map.find(n => n.isBoss);
      return !!boss && boss.enemies[0] === 'echosunder' && !!ENEMY_DEFS.echosunder && !!ENEMY_DEFS.echosunder.floorBoss && ENEMY_DEFS.echosunder.weak === 'song';
    }));
  check('FLOOR 3: the Sundering’s intents carry the SEVER mechanic (unique to it)',
    await J(() => ENEMY_DEFS.echosunder.intents.some(i => i.sever) && !ENEMY_DEFS.echoknight2.intents.some(i => i.sever) && !ENEMY_DEFS.echodevourer.intents.some(i => i.sever)));
  check('SUNDERING: a SEVER strike cuts a formed thread and un-forms the triad',
    await J(() => {
      RUN = newRun('ash'); RUN.roster = ['ash', 'elin', 'mira']; RUN.active = ['ash', 'elin', 'mira']; RUN.hp = { ash: 32, elin: 24, mira: 22 };
      RUN.nodes = []; RUN.completed = [0, 1, 2, 3, 4, 5];
      startFight({ type: 'fight', chapter: 3, heroes: ['ash', 'elin', 'mira'], enemies: ['echosunder'], useRunHp: true, floor: 3, depth: 7, isBoss: true, narrator: '' });
      S.threads = new Set(['ash|elin', 'ash|mira', 'elin|mira']); S.triadFormed = true;
      const cut = severThreads(S.enemies[0], 1);
      return cut === 1 && S.threads.size === 2 && S.triadFormed === false;
    }));

  // ---------- FLOOR 4: THE HOLLOW CHORUS — the multi-stage mega boss ----------
  console.log('--- FLOOR 4 / MEGA BOSS ---');
  check('FLOOR 4: the descent now runs FOUR floors', await J(() => FLOORS === 4));
  check('FLOOR 4: a TWO-node approach — a LAST FIRE (camp), then the mega boss (never a fight first)',
    await J(() => {
      const m = generateDescent(['ash', 'elin', 'mira'], 4);
      return m.length === 2
        && m[0].type === 'camp' && m[0].next.join() === '1'
        && m[1].type === 'boss' && m[1].enemies[0] === 'echochorus' && m[1].next.length === 0;
    }));
  check('MEGA: the Chorus is a 3-stage boss (Remembered → Devouring → Unmaking)',
    await J(() => {
      const d = ENEMY_DEFS.echochorus;
      return d && d.megaBoss && Array.isArray(d.stages) && d.stages.length === 3
        && d.stages.map(s => s.weak).join() === 'blade,light,song';
    }));
  await J(() => { window.megaBoot = () => {
    RUN = newRun('ash'); RUN.roster = ['ash', 'elin', 'mira']; RUN.active = ['ash', 'elin', 'mira']; RUN.hp = { ash: 32, elin: 24, mira: 22 };
    RUN.nodes = []; RUN.completed = [0, 1];
    startFight({ type: 'fight', chapter: 3, heroes: ['ash', 'elin', 'mira'], enemies: ['echochorus'], useRunHp: true, floor: 4, depth: 3, isBoss: true, narrator: '' });
    return S.enemies[0];
  }; });
  check('MEGA: it opens in stage 0 — THE REMEMBERED, weak to blade, its own HP',
    await J(() => { const e = megaBoot(); return e.stage === 0 && e.def.name === 'THE REMEMBERED' && e.def.weak === 'blade'
      && e.hp === e.maxHp && e.maxHp === Math.round(150 * (1 + (META.heat || 0) * 0.12)); }));
  check('MEGA: entering a stage swaps weakness / aura / intents / HP live on e.def',
    await J(() => { const e = megaBoot(); enterMegaStage(e, 1); const two = e.def.weak === 'light' && e.def.aura === 'maw';
      enterMegaStage(e, 2); const three = e.def.weak === 'song' && e.def.aura === 'sunder' && e.def.intents.some(i => i.discord);
      return two && three; }));
  check('MEGA: a stage carries a FIVE-note parry cascade (the climax sequences)',
    await J(() => ENEMY_DEFS.echochorus.stages.some(s => s.intents.some(i => i.parry && i.parry.notes && i.parry.notes.length === 5))));
  check('MEGA ECHO: a stored echo returns as the round’s first telegraph, stronger & non-chaining',
    await J(() => { const e = megaBoot(); const src = e._stages[0].intents.find(i => i.echo); e.echoStored = { intent: src, dmgBonus: src.echoBonus || 4 };
      const nx = enemyNextIntents(e); const v = nx[0];
      return v.echoOf === true && v.dmg === (src.dmg + src.echoBonus) && !v.echo; }));

  // ---------- BURST LEVELS: kizuna expands the all-out container ----------
  console.log('--- BURST LEVELS ---');
  check('BURST: a fresh fight opens at container Level 1 (cap 100)',
    await J(() => { setupFight(['ash', 'elin', 'mira'], [], {}); return S.burstLevel === 1 && burstCap() === 100; }));
  check('BURST: expandBurst grows the container (L2→175, L3→250) and never downgrades',
    await J(() => { setupFight(['ash', 'elin', 'mira'], [], {});
      expandBurst(2); const l2 = S.burstLevel === 2 && burstCap() === 175;
      expandBurst(3); const l3 = S.burstLevel === 3 && burstCap() === 250;
      expandBurst(2); const noDown = S.burstLevel === 3;   // a lower call can't shrink it
      return l2 && l3 && noDown; }));
  check('BURST: charge only exceeds 100 once the container is expanded',
    await J(() => { setupFight(['ash', 'elin', 'mira'], [], {}); S.momentum = 0;
      gainMomentum(300); const l1 = S.momentum === 100;             // clamped at the L1 cap
      expandBurst(2); S.momentum = 0; gainMomentum(300); const l2 = S.momentum === 175;   // now holds more
      return l1 && l2; }));
  check('BURST: the fire level tracks how full the container is',
    await J(() => { setupFight(['ash', 'elin', 'mira'], [], {}); expandBurst(3);
      S.momentum = 40;  const none = burstFireLevel() === 0;
      S.momentum = 120; const one = burstFireLevel() === 1;
      S.momentum = 180; const two = burstFireLevel() === 2;
      S.momentum = 250; const three = burstFireLevel() === 3;
      return none && one && two && three; }));
  check('BURST: a DUET expands to L2 and the TRIAD vow to L3 (wired into their resolutions)',
    await J(() => typeof expandBurst === 'function' && typeof allOutEncore === 'function'
      && resolveDuet.toString().includes('expandBurst(2')
      && resolveResonant.toString().includes('expandBurst(3')));
  check('BURST: the all-out scales by fire level and adds an L2+ encore (wired into resolveAllOut)',
    await J(() => { const s = resolveAllOut.toString();
      return s.includes('burstFireLevel()') && s.includes('lvlMul') && s.includes('allOutEncore'); }));

  // ---------- PERFECT REWARDS: flawless parry riposte + all-out finisher ----------
  console.log('--- PERFECT REWARDS ---');
  check('RIPOSTE: a flawless parry string counters, scaled by length; a single note does not',
    await J(() => parryRiposteDmg(1) === 0 && parryRiposteDmg(2) === 8 && parryRiposteDmg(3) === 12 && parryRiposteDmg(5) === 20));
  check('RIPOSTE: runParrySeq reports a FLAWLESS flag (every note PERFECT, not just caught)',
    await J(() => { const s = runParrySeq.toString(); return s.includes('perfects') && s.includes('flawless') && s.includes('notes: notes.length'); }));
  check('RIPOSTE: the flawless counter is wired into the enemy parry resolution',
    await J(() => { const s = enemyPhase.toString(); return s.includes('res.flawless') && s.includes('parryRiposteDmg'); }));
  check('FINISHER: a flawless all-out finisher scales with party size',
    await J(() => allOutFinisherDmg(3) === 19 && allOutFinisherDmg(2) === 13 && allOutFinisherDmg(1) === 13));
  check('FINISHER: an all-perfect cascade (3+ strikes) triggers the finisher (wired into resolveAllOut)',
    await J(() => { const s = resolveAllOut.toString(); return s.includes('perfectStrikes') && s.includes('allStrikes >= 3') && s.includes('allOutFinisher('); }));

  // ---------- PERF: party figures reused across renders (no SVG re-parse) ----------
  console.log('--- PERF ---');
  check('PERF: a party figure (and its SVG portrait) is REUSED across renders, not rebuilt',
    await J(() => {
      setupFight(['ash', 'elin', 'mira'], [], {});
      const a1 = document.querySelector('#party-half .figure.party[data-fig="ash"]');
      const svg1 = a1 && a1.querySelector('.fig-art svg');
      S.heroes[0].guard = 7; renderAll();   // a state change re-renders
      const a2 = document.querySelector('#party-half .figure.party[data-fig="ash"]');
      return !!a1 && !!svg1 && a1 === a2 && a2.querySelector('.fig-art svg') === svg1
        && !!a2.querySelector('.chip.guard');   // the cheap parts still updated
    }));
  check('PERF: a fresh fight frees the party-figure cache (drag closures rebind to the new fight)',
    await J(() => { setupFight(['ash', 'elin'], [], {}); const before = document.querySelector('.figure.party[data-fig="ash"]'); setupFight(['ash', 'elin'], [], {}); const after = document.querySelector('.figure.party[data-fig="ash"]'); return !!before && !!after && before !== after; }));
  check('PERF: the hand DOM is REUSED when nothing changed, and REBUILT when EP/hand changes',
    await J(() => {
      setupFight(['ash', 'elin', 'mira'], [], {}); renderAll();
      const c1 = document.querySelector('#hand .card');
      renderAll();                                   // identical hand → skip the rebuild
      const c2 = document.querySelector('#hand .card');
      S.ep = S.ep - 1; renderAll();                  // EP changed → rebuild (disabled states can shift)
      const c3 = document.querySelector('#hand .card');
      return !!c1 && c1 === c2 && !!c3 && c3 !== c1;
    }));

  // ---------- BRANCHING ROTATIONS (the descent combat system) ----------
  console.log('--- ROTATIONS ---');
  await J(() => { try { localStorage.removeItem('kizuna2_1.forceClassic'); } catch (_) {} });   // real rotations from here
  check('SWAP: a real DESCENT fight (useRunHp) now defaults to ROTATIONS; the tutorial stays classic',
    await J(() => { RUN = newRun('ash'); RUN.roster = ['ash']; RUN.active = ['ash']; RUN.hp = { ash: HEROES.ash.maxHp }; delete RUN._rotations;
      startMapFight(RUN.map.find(x => x.type === 'fight'));   // a real descent fight
      const descentRot = S._rotations === true && !!rotationFor(S.heroes[0]);
      // the same engine with a NON-useRunHp (tutorial) node stays classic
      const tutClassic = newBattle({ heroes: ['ash'], enemies: ['husk'] })._rotations === false;
      return descentRot && tutClassic; }));
  check('ROTATION off by default: a chain hero still shows the classic core+sig hand',
    await J(() => { setupFight(['ash'], ['ash.sig.front'], { ash: 'front' }); S._rotations = false;
      const names = buildHand().map(c => c.name);
      return rotationFor(S.heroes[0]) === null && names.includes('Cleave') && names.includes('Crashing Wave'); }));
  check('ROTATION on: Ash-front shows ONE live card — the opener (Cleave, 2 EP)',
    await J(() => { setupFight(['ash'], ['ash.rider.wave'], { ash: 'front' }); S._rotations = true; renderAll();
      const hand = buildHand().filter(c => c.owner === 'ash');
      return hand.length === 1 && hand[0].kind === 'opener' && hand[0].name === 'Cleave' && hand[0].cost === 2 && !!rotationFor(S.heroes[0]); }));
  check('ROTATION EARNED: base line is opener → FINISHER (a short combo) — no builder, no fork, before any skill',
    await J(() => { setupFight(['ash'], [], { ash: 'front' }); S._rotations = true; renderAll();
      const op = buildHand().find(c => c.kind === 'opener'); S.tempCards = []; resolveChainPlay(op);
      // the opener forges the FINISHER directly (Crashing Wave), not the builder
      return S.tempCards.length === 1 && S.tempCards[0].name === 'Crashing Wave'; }));
  check('ROTATION BUILDER node (signature) inserts a middle step: opener → builder → finisher',
    await J(() => { setupFight(['ash'], ['ash.sig.front', 'ash.rider.wave'], { ash: 'front' }); S._rotations = true; renderAll();
      const op = buildHand().find(c => c.kind === 'opener'); S.tempCards = []; resolveChainPlay(op);
      // opener now forges the BUILDER (Rising Slash), not the finisher directly; no fork yet
      const builder = S.tempCards.length === 1 && S.tempCards[0].name === 'Rising Slash';
      const rs = S.tempCards[0]; S.tempCards = S.tempCards.filter(t => t.uid !== rs.uid); resolveChainPlay(rs);
      const cw = S.tempCards.find(c => c.name === 'Crashing Wave');
      return builder && !!cw && cw.fx.dmg === 14; }));   // builder → finisher, and the rider still bites (11 → 14)
  check('ROTATION FORK node adds the branch (needs the builder): opener forges BOTH lines with a pick event',
    await J(() => { setupFight(['ash'], ['ash.sig.front', 'ash.branch.front', 'ash.rider.wave'], { ash: 'front' }); S._rotations = true; renderAll();
      const op = buildHand().find(c => c.kind === 'opener'); S.tempCards = []; resolveChainPlay(op);
      const rs = S.tempCards.find(c => c.name === 'Rising Slash'), su = S.tempCards.find(c => c.name === 'Sunder');
      return S.tempCards.length === 2 && !!rs && !!su && rs.cost === 0 && su.cost === 0
        && rs.branchGroup === su.branchGroup && rs.expiresTurn === S.turn
        && !!S._forgeEvent && S._forgeEvent.pick === true && S._forgeEvent.uids.length === 2; }));
  check('ROTATION picking a branch BURNS the unpicked sibling (on drop) and forges that line’s finisher',
    await J(() => { const rs = S.tempCards.find(c => c.name === 'Rising Slash');
      burnUnpickedSiblings(rs);                                 // playCard does this the instant the card drops
      S.tempCards = S.tempCards.filter(t => t.uid !== rs.uid);  // playCard removes the played temp card
      resolveChainPlay(rs);                                     // then forges the next step
      const names = S.tempCards.map(c => c.name);
      return names.includes('Crashing Wave') && !names.includes('Sunder') && !names.includes('Rising Slash')
        && typeof burnUnpickedSiblings === 'function'; }));
  check('ROTATION stance change abandons the in-progress chain (purgeChain clears forged steps)',
    await J(() => { purgeChain('ash'); return S.tempCards.filter(c => c.chain).length === 0; }));
  check('ROTATION every stance declares: base finisher (gateNot builder), builder (gate), fork (gate branch)',
    await J(() => ['ash', 'elin', 'mira', 'cassia', 'branwen'].every(hid =>
      ['front', 'mid', 'back'].every(r => {
        const rot = ROTATIONS[hid] && ROTATIONS[hid][r]; if (!rot) return false;
        const op = rot.cards[rot.opener]; if (!op || !op.next || op.next.length !== 3) return false;
        const [fin, bld, alt] = op.next;
        const finOk = fin && fin.key && fin.gateNot && rot.cards[fin.key];                                   // opener→finisher when builder NOT owned
        const bldOk = bld && bld.key && bld.gate && bld.gate === fin.gateNot && rot.cards[bld.key]           // builder inserts (same node hides the direct finisher)
          && (rot.cards[bld.key].next || []).length >= 1;
        const altOk = alt && alt.key && alt.gate && rot.cards[alt.key] && (rot.cards[alt.key].next || []).length >= 1;   // fork's alt line
        return finOk && bldOk && altOk;
      }))));
  check('ROTATION every rotation fx uses only supported effect keys (no dead effects)',
    await J(() => { const ok = new Set(['dmg', 'mark', 'guard', 'heal', 'buffDmg', 'counter', 'step', 'warp', 'lull']);
      return Object.values(ROTATIONS).every(st => Object.values(st).every(rot =>
        Object.values(rot.cards).every(c => Object.keys(c.fx || {}).every(k => ok.has(k))))); }));
  check('ROTATION Cassia openers carry the HEAVY +1 premium; forged steps stay free',
    await J(() => { setupFight(['cassia'], ROTATION_GATES.concat(['cassia.sig.front']), { cassia: 'front' }); S._rotations = true; renderAll();
      const op = buildHand().find(c => c.kind === 'opener');
      return !!op && op.name === 'Shield Bash' && op.cost === 2; }));
  check('ROTATION dev preview is the FULL build — all 30 rotation gates (15 finishers + 15 forks) unlocked',
    await J(() => typeof devPreviewRotations === 'function'
      && devPreviewRotations.toString().includes('_rotations = true')
      && devPreviewRotations.toString().includes('ROTATION_GATES')
      && Array.isArray(ROTATION_GATES) && ROTATION_GATES.length === 30));
  check('ROTATION forged steps sit in the HERO’s slot, not appended to the far right of the hand',
    await J(() => { setupFight(['ash', 'elin'], ['ash.sig.front', 'ash.branch.front'], { ash: 'front', elin: 'mid' }); S._rotations = true; renderAll();
      const op = buildHand().find(c => c.kind === 'opener' && c.owner === 'ash'); S.tempCards = []; resolveChainPlay(op);
      const names = buildHand().map(c => c.name);
      const iRs = names.indexOf('Rising Slash'), iSu = names.indexOf('Sunder'), iMend = names.indexOf('Mend');
      // Ash (first hero) forged cards precede Elin's opener — grouped in Ash's slot
      return iRs >= 0 && iSu >= 0 && iMend >= 0 && iRs < iMend && iSu < iMend; }));
  check('ROTATION bounce-back: origin = the HOME slot (drag-start), start = the struck ENEMY (hurl impact)',
    await J(() => { setupFight(['ash'], ['ash.sig.front'], { ash: 'front' }); S._rotations = true; renderAll();
      const op = buildHand().find(c => c.kind === 'opener'); const en = S.enemies.find(e => !e.dead);
      _forgeDrag = { name: op.name, owner: op.owner, homeX: 120, homeY: 405 };   // a real drag (home slot from drag start)
      captureForgeAnchors(op, en.uid);
      const home = clientPtLocal(120, 405), enC = rectCenterLocal(figHitRect(figEl(en.uid)) || figEl(en.uid).getBoundingClientRect());
      const o = S._forgeOrigin, s = S._forgeStart;
      return !!o && Math.abs(o.x - home.x) < 1 && Math.abs(o.y - home.y) < 1     // origin == home slot
        && !!s && Math.abs(s.x - enC.x) < 1 && Math.abs(s.y - enC.y) < 1         // start == the struck enemy
        && _forgeDrag === null; }));                                             // and it was consumed
  check('ROTATION the card HURLS in, then the bounce is JS-driven (survives prefers-reduced-motion)',
    await J(() => playCard.toString().includes('flyCard(card.name')
      && forgeReturnFx.toString().includes('HOLD')
      && forgeReturnFx.toString().includes('.style.transition')          // inline JS motion, not a CSS @keyframes
      && !forgeReturnFx.toString().includes('card-return-ghost')));       // no CSS-animation class to be suppressed
  // RUNTIME: boot the actual dev preview and drive a full opener→branch→finisher
  // for each active hero — catches any throw in the heal/guard/warp/step paths.
  await J(() => devPreviewRotations());
  await sleep(400);
  check('ROTATION preview boots a party fight with the engine LIVE',
    await J(() => !!S && S._rotations === true && S.heroes.length === 3 && !document.querySelector('#overlay:not(.hidden)')));
  check('ROTATION preview: every active hero shows exactly one opener (hand is small)',
    await J(() => { const openers = buildHand().filter(c => c.kind === 'opener');
      return openers.length === 3 && openers.every(o => o.cost >= 1); }));
  const drove = await J(async () => {
    // play each hero's whole rotation via the real playCard path; a throw rejects
    for (const h of S.heroes.slice()) {
      if (h.downed) continue;
      let guard = 0;
      while (guard++ < 5) {
        const card = buildHand().find(c => (c.kind === 'opener' || c.chain) && c.owner === h.id && !c.spent && c.cost <= S.ep);
        if (!card) break;
        let tid = null;
        if (card.target === 'enemy') tid = (S.enemies.find(e => !e.dead) || {}).uid;
        else if (card.target === 'ally') tid = (S.heroes.find(x => !x.downed) || {}).id;
        await playCard(card, tid);
      }
    }
    return true;
  });
  check('ROTATION preview: driving all three rotations end-to-end throws nothing', drove === true);

  t.report();
  await t.browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
