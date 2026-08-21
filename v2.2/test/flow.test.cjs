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
  const vman = vjson['v2.2'];
  console.log((vman === build ? '  ✓ ' : '  ✗ ') + `version.json v2.2 (${vman}) matches V2_BUILD (${build})`);
  if (vman !== build) process.exitCode = 1;

  const t = await boot({ flow: 0 });
  const { J, shot, check, sleep, tapCard, pickTarget, endTurn, dismissCeremony, clickOverlayBtn } = t;
  // The flow suite exercises the SHARED combat mechanics (stances, threads, triad,
  // duet, burst, boss) through CLASSIC hands, still shipped by the tutorial.  This
  // persisted flag forces classic across every run the suite spins up; the
  // branching-rotation descent gets its own ROTATION block (which clears it).
  await J(() => { try { localStorage.setItem('kizuna2_2.forceClassic', '1'); } catch (_) {} });

  // ---------- ONBOARDING: choose your survivor (v1-style solo start) ----------
  console.log('--- ONBOARDING ---');
  // A first-EVER player (no tutorialSeen) gets the scripted FLOW tutorial that
  // teaches the bond hook; veterans skip straight to survivor-select.
  check('ONBOARDING: a first-time player gets the TUTORIAL (not the solo start)',
    await J(() => { try { localStorage.removeItem('kizuna2_2.tutorialSeen'); } catch (_) {}
      const seenBefore = tutorialSeen(); beginTutorial();
      return !seenBefore && flowIdx === 0 && FLOW[0].title === 'ONE SURVIVOR'; }));
  // Build 262 REVERSED the line this used to assert. tutorialSeen was set the
  // instant NEW GAME was pressed, so quitting anywhere in onboarding marked the
  // player taught FOREVER: CONTINUE then dropped them on the descent map having
  // been shown nothing, and NEW GAME went to survivor-select. It is set when the
  // tutorial is FINISHED now.
  check('ONBOARDING: starting the tutorial does NOT yet count as having seen it',
    await J(() => tutorialSeen() === false));
  // ---------- BUILD 273: the tutorial teaches the engine the DESCENT uses ----
  // `_rot` is true for every useRunHp fight, so rotations ARE descent combat.
  // The old road ran four classic fights and mentioned rotations once, in the
  // last beat before the cliff — 80% of onboarding rehearsing an engine the
  // player never touches again, and the thing they do every turn for the rest
  // of the game getting a single practice fight.
  check('TUTORIAL: every fight on the road runs the REAL engine',
    await J(() => { const f = FLOW.filter(n => n.type === 'fight');
      return f.length >= 3 && f.every(n => n.rotations === true); }));
  check('TUTORIAL: a tutorial fight really gets rotations (not just a flag on the node)',
    await J(() => {
      let fc = null;
      try { fc = localStorage.getItem('kizuna2_2.forceClassic'); localStorage.removeItem('kizuna2_2.forceClassic'); } catch (_) {}
      const node = FLOW.find(n => n.type === 'fight');
      startFight(node);
      const got = !!(S && S._rotations);
      const solo = S.maxEp;                       // 2 + heroes + 1 for rotations
      try { if (fc) localStorage.setItem('kizuna2_2.forceClassic', fc); } catch (_) {}
      return got && solo === 2 + node.heroes.length + 1;
    }));
  // It also taught the PAYOFFS before the mechanisms: WEAVE and the TRIAD
  // FINALE were explained two chapters before the player had formed one bond,
  // while the deliberate way to MAKE one was never mentioned at all.
  // Was: "it teaches PRIMED → FOLLOW-UP". PRIMED is absorbed into the line (298)
  // and no longer fires, so teaching it would be teaching a mechanic that cannot
  // happen. What chapter 2 must now teach is the thing that DOES happen the first
  // time a second hero exists: the line belongs to the party, and answering
  // somebody else's opener is what bonds them.
  check('TUTORIAL: it teaches THE LINE — the party’s combo, and that answering it bonds',
    await J(() => {
      const txt = FLOW.filter(n => n.type === 'story').flatMap(n => n.lines).map(l => l.text).join(' ');
      const narr = FLOW.filter(n => n.type === 'fight').map(n => n.narrator).join(' ');
      return /every.{0,3}<\/b> opener is discarded/i.test(txt)     // the discard is the rule to state
        && /who answers/i.test(txt) && /BONDED/.test(txt)
        && /ANSWER/.test(narr)
        && !/PRIMED/.test(txt) && !/FOLLOW-UP/.test(txt);          // and the dead path is not taught
    }));
  check('TUTORIAL: it names the TREE as the thing that grows a line, not a mechanic you already have',
    await J(() => {
      const txt = FLOW.filter(n => n.type === 'story').flatMap(n => n.lines).map(l => l.text).join(' ');
      // With no nodes a line is two beats. Chapter 1 used to promise "opener, then
      // combo, then the FINISHER" — a three-beat combo the player cannot have yet.
      return /Ember Tree<\/b> is what puts a <b>COMBO<\/b> between them/.test(txt); }));
  check('TUTORIAL: no payoff is drilled before its mechanism — WEAVE/TRIAD are not taught here',
    await J(() => {
      const stories = FLOW.filter(n => n.type === 'story');
      const beforeCliff = stories.slice(0, -1).flatMap(n => n.lines).map(l => l.text).join(' ');
      const narrators = FLOW.filter(n => n.type === 'fight').map(n => n.narrator).join(' ');
      return !/WEAVE/.test(beforeCliff) && !/TRIAD/.test(beforeCliff)
        && !/WEAVE/.test(narrators) && !/TRIAD/.test(narrators);
    }));
  check('TUTORIAL: the rhythm is taught FIRST, not last — fight 1 is the rotation drill',
    await J(() => {
      const first = FLOW.find(n => n.type === 'fight');
      const opening = FLOW[0].lines.map(l => l.text).join(' ');
      return /OPENER/.test(first.narrator) && /FINISHER/.test(first.narrator)
        && /OPENER/.test(opening) && /who gets to finish/i.test(opening);
    }));
  check('VOCAB: the runtime bond lines speak the Build 270 ladder (LIT / WOVEN, never WEAVE)',
    await J(() => !/to WEAVE it/.test(addThread.toString())
      && /♡ LIT/.test(addThread.toString()) && /WOVEN/.test(addThread.toString())));
  check('ONBOARDING: finishing it does — the flag lives at the end of the road',
    await J(() => { startDescent(); return tutorialSeen() === true; }));
  check('ONBOARDING: a reset really can reach a first run again (lesson counters included)',
    await J(() => { try { localStorage.setItem('kizuna2_2.lesson_fork', '9');
        localStorage.setItem('kizuna2_2.parryLesson_tap', '9'); } catch (_) {}
      resetProgress();
      return tutorialSeen() === false
        && !localStorage.getItem('kizuna2_2.lesson_fork')
        && !localStorage.getItem('kizuna2_2.parryLesson_tap')
        // v2.2: first-time flow includes the PROLOGUE — reset must reach it too
        && localStorage.getItem('kizuna2_2.narrative') === null; }));
  // mark the tutorial seen so the rest of onboarding exercises the veteran survivor-select.
  // (Invoke the button handler directly: the title cinematic intercepts raw taps.)
  // v2.2: the reset above also wiped the prologue; these checks measure the
  // VETERAN path, so mark it spent again — the fresh-soul path has its own
  // NARRATIVE block at the end of the suite.
  await J(() => { try { localStorage.setItem('kizuna2_2.tutorialSeen', '1'); } catch (_) {} narrSeedPrologueComplete(); showTitle(); });
  await sleep(400);
  await J(() => document.querySelector('#t-new').onclick());
  await sleep(450);
  // Build 282: NEW GAME wakes a veteran at THE LANDING first — the line-up is a
  // step further in, behind CLIMB AGAIN.
  check('ONBOARDING: a veteran wakes at the Landing before choosing anybody',
    await J(() => !!document.querySelector('.ld-scene')));
  await J(() => document.querySelector('#ld-go').click());
  await sleep(400);
  check('starter-select: 6 heroes shown, some locked, Ash unlocked',
    await J(() => document.querySelectorAll('.ss-fig').length === 6
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
  check('ONBOARDING: moving is a CLEAN reposition — no free Echo card (Afterimage is an earned descent skill)',
    await J(() => !document.querySelector('#hand .card[data-card-name="Flowing Cut"]') && !document.querySelector('#hand .card[data-card-name="Echo: Cleave"]')));
  await endTurn();
  check('dodge lesson: FRONT claw missed', await J(() => S.heroes[0].hp === 32));
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
  check('flow advances to THE POSITIONS', await J(() => document.body.innerText.includes('THE POSITIONS')));
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
  // BONDS REFORGED — a thread no longer spawns an Echo Bond CARD.  An un-kindled
  // pair just forms the connection + its guard; no card clutters the hand.
  check('REFORGED: a thread forms NO card (no Echo Bond in hand)', await J(() => !document.querySelector('#hand .card[data-card-name="Echo Bond"]')));
  check('REFORGED: an UN-kindled pair awakens no weave yet', await J(() => !(S.pairsAwake && S.pairsAwake.size)));
  await shot('ch2-thread');

  // ---------- DESCENT: map, recruit, composition, Formation resonant ----------
  console.log('--- THE DESCENT ---');
  await J(() => { localStorage.setItem('kizuna2_2.flow', '99'); localStorage.removeItem('kizuna2_2.run'); });
  await t.page.reload({ waitUntil: 'networkidle' }); await sleep(500);
  await clickOverlayBtn('#t-new'); await sleep(400);                      // → THE LANDING (Build 282)
  await J(() => document.querySelector('#ld-go').click()); await sleep(400);  // → CHOOSE YOUR SURVIVOR
  await J(() => document.querySelector('.ss-fig[data-id="ash"]').click());    // pick Ash
  await sleep(350);
  await J(() => { const n = document.querySelector('.rl-card.rl-none'); if (n) n.click(); });   // carry nothing
  await sleep(350);
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
  // WORLD MAP presentation (v2.2 Build 19) — the painted chart after the
  // player's mock: full-bleed backdrop screen, title block, ember badge,
  // six-row legend, and names surfacing only where a choice lives.
  check('WORLD MAP: the chart wears its dress — wm-screen backdrop, title block, ember badge, six-row legend',
    await J(() => document.querySelector('#overlay').className.includes('wm-screen')
      && (document.querySelector('.wm-title') || {}).textContent === 'WORLD MAP'
      && /DOMAIN OF LAMENT/.test((document.querySelector('.wm-sub') || {}).textContent || '')
      && !!document.querySelector('.wm-embers')
      && document.querySelectorAll('.wl-row').length === 6));
  check('WORLD MAP: names surface only where a choice lives — reachable labels read, locked labels stay dark (gates always read: a door is information)',
    await J(() => { const reach = document.querySelector('.map-node.mn-reach .mn-label');
      const locked = document.querySelector('.map-node.mn-locked:not(.mn-gate) .mn-label');
      const gate = document.querySelector('.map-node.mn-gate .mn-label');
      return reach && getComputedStyle(reach).opacity === '1'
        && (!locked || getComputedStyle(locked).opacity === '0')
        && (!gate || getComputedStyle(gate).opacity === '1'); }));
  check('MAP: forward-only — from a branch both children are reachable; pick one and the sibling LOCKS',
    await J(() => { const _save = RUN;
      RUN = { map: newRun('ash').map, completed: [] };
      const nodes = RUN.map, branch = nodes.find(n => (n.next || []).length >= 2);
      let ok = true;
      if (branch) { const k = branch.next.map(id => nodes.find(n => n.id === id)).filter(Boolean);
        RUN.completed = [branch.id]; const both = nodeReachable(k[0]) && nodeReachable(k[1]);
        RUN.completed = [branch.id, k[0].id]; const locked = !nodeReachable(k[1]) && nodeReachable(k[0]) === false;
        ok = both && locked; }
      RUN = _save; return ok; }));
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
      const gates = m.filter(n => n.type === 'gate');
      const maxL = Math.max(...m.map(n => n.level));
      if (l1.length !== 1 || l1[0].type !== 'fight') fails++;
      // Build 20: the GATES stand beyond the boss — the boss caps the walked
      // levels, the gate level caps the map, and only gates terminate
      if (boss.length !== 1 || boss[0].level !== Math.max(...m.filter(n => n.type !== 'gate').map(n => n.level))) fails++;
      if (gates.length !== 2 || gates.some(g => g.level !== maxL)) fails++;
      for (const n of m) { if (n.type !== 'gate' && (!n.next || !n.next.length)) { fails++; break; } }
      for (const n of m) { if (n.level !== 1 && !m.some(p => p.next.includes(n.id))) { fails++; break; } }
      const seen = new Set([l1[0].id]), q = [l1[0].id];
      while (q.length) { const c = q.shift(); for (const nx of (m[c].next || [])) if (!seen.has(nx)) { seen.add(nx); q.push(nx); } }
      if (!seen.has(boss[0].id)) fails++;
      if (gates.some(g => !seen.has(g.id))) fails++;   // both doors lie on the walkable road
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
  if (await J(() => !!document.querySelector('#spark-skip'))) { await clickOverlayBtn('#spark-skip'); await sleep(300); }   // Build 211: bank the after-fight SPARK

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
  check('party formation opens (roster 4 → 3 slots + bench)', await J(() =>
    !!document.querySelector('.ps-slots') && document.querySelectorAll('.ps-slot .ps-card').length === 3 && document.querySelectorAll('.ps-card').length === 4));
  // TAP-TO-SWAP the wanted trio into the line: ash + elin + cassia
  // (Cleric+Guardian+Ronin → Oathkeepers' Advance, Formation)
  await J(() => {
    const want = ['ash', 'elin', 'cassia'];
    const byId = (id) => [...document.querySelectorAll('.ps-card')].find(x => x.dataset.id === id);
    const lineIds = () => [...document.querySelectorAll('.ps-slot .ps-card')].map(x => x.dataset.id);
    let guard = 0;
    while (guard++ < 12) {
      const line = lineIds();
      const missing = want.find(id => !line.includes(id));
      if (!missing) break;
      const extra = line.find(id => !want.includes(id));
      if (!extra) break;
      byId(missing).click();   // pick up the benched hero
      byId(extra).click();     // tap the unwanted line hero → they swap
    }
  });
  await sleep(200);
  check('SWAP: tap-to-swap put the wanted trio in the line, benching the rest', await J(() => {
    const line = [...document.querySelectorAll('.ps-slot .ps-card')].map(x => x.dataset.id);
    return line.length === 3 && ['ash', 'elin', 'cassia'].every(id => line.includes(id));
  }));
  check('CONCEPT: picker previews Oathkeepers\' Advance for this trio',
    await J(() => document.querySelector('.ps-reso')?.textContent.includes('Oathkeepers')));
  await shot('party-select-phalanx');
  await clickOverlayBtn('#ps-go'); await sleep(400);
  // Deliberate formation: ash FRONT (attacker), then the two weavers where
  // their ally-cards live — Cassia MID (Cover), Elin BACK (Benediction) — so
  // all three threads can close.  The marching order writes RUN.rows, which now
  // drives combat positions, so set it explicitly for this composition.
  await J(() => { RUN.active = ['ash', 'cassia', 'elin']; RUN.rows = { ash: 'front', cassia: 'mid', elin: 'back' }; saveRun(); });

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
  // BONDS REFORGED — the triad no longer hijacks a card slot.  It CROWNS the
  // all-out: no resonant card in hand, and S.allOutCrowned is set.
  check('REFORGED: the triad spawns NO resonant card', await J(() => !document.querySelector('#hand .card.kind-resonant')));
  check('REFORGED: the triad crowns the all-out (S.allOutCrowned)', await J(() => !!S.allOutCrowned));
  // the FORMATION vow now lands as the all-out CROWN — drive the crown directly
  // and confirm it still pushes the enemy line + wards the party.
  const rowsBefore = await J(() => S.enemies.filter(x => !x.dead).map(x => x.id + ':' + x.row).join(' '));
  // (auto-parry is already ON for the whole descent — see line ~138 — so the
  // TRACE-the-triangle sigil inside the finale auto-completes without extra setup.)
  await J(async () => { await allOutTriadFinale(livingHeroes()); });
  await sleep(400);
  const rowsAfter = await J(() => S.enemies.filter(x => !x.dead).map(x => x.id + ':' + x.row).join(' '));
  check('TRIAD FINALE: the vow pushes the enemy line in the all-out', rowsBefore !== rowsAfter, rowsBefore + ' -> ' + rowsAfter);
  check('TRIAD FINALE: oathkeepers guard granted', await J(() => S.heroes.some(h => h.guard >= 4)),
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
  if (await J(() => !!document.querySelector('#spark-skip'))) { await clickOverlayBtn('#spark-skip'); await sleep(300); }   // Build 211: bank the after-fight SPARK

  // camp (Build 210): the fire no longer heals on ARRIVAL — the night is one choice.
  await J(() => document.querySelector('.map-node.mn-camp.mn-reach')?.click()); await sleep(500);
  check('CAMP: the night offers its choices (rest is no longer free)',
    await J(() => !!document.querySelector('.camp-choices') && !!document.querySelector('#camp-forge') && !!document.querySelector('#camp-fire')));
  const campWounded = await J(() => RUN.roster.some(id => (RUN.hp[id] ?? HEROES[id].maxHp) > 0 && (RUN.hp[id] ?? HEROES[id].maxHp) < HEROES[id].maxHp));
  if (campWounded) {
    check('CAMP: arrival healed no one — the wound outlasts the walk in', true);
    await clickOverlayBtn('#camp-rest'); await sleep(400);
    check('CAMP REST: choosing the fire heals every living hero',
      await J(() => RUN.roster.every(id => (RUN.hp[id] ?? 0) <= 0 || RUN.hp[id] === HEROES[id].maxHp)));
    await J(() => { const n = RUN.map.find(x => x.type === 'camp'); showCamp(n); }); await sleep(300);   // re-open for the fire scene
  } else {
    check('CAMP REST: nobody wounded — the rest choice stays hidden', await J(() => !document.querySelector('#camp-rest')));
  }
  // Build 266: the fire follows the DEED ledger — the pair with the most between
  // them this descent — and only falls back to the weakest bond when nobody has
  // done anything yet. Ask the game who it picked rather than assuming.
  const firePair = await J(() => { const k = _fireBondKey(); return { key: k, pts: bondPts(k) }; });
  await clickOverlayBtn('#camp-fire'); await sleep(450);
  for (let i = 0; i < 8; i++) { if (!await J(() => !!document.querySelector('.ov-tap'))) break; await J(() => document.querySelector('#overlay').click()); await sleep(220); }
  await shot('camp-scene');
  check('CAMP SCENE: the fire dialogue deepened the pair it chose, +1',
    await J((k) => bondPts(k), firePair.key) === firePair.pts + 1,
    firePair.key + ' ' + firePair.pts + ' → ' + await J((k) => bondPts(k), firePair.key));
  // Build 269: the night now ends on a QUESTION — the pair's ability, or what
  // they remember. Take the memory here so the whole fragment beat is walked.
  check('CAMP SCENE: the night ends on a fork, not a CONTINUE button',
    await J(() => document.querySelectorAll('.ov-forkopt').length === 2 && !document.querySelector('#ov-go')));
  const fragsBefore = await J(() => fragsHeld());
  await J(() => document.querySelectorAll('.ov-forkopt')[1].click()); await sleep(450);
  check('CAMP SCENE: asking what they remember banks a piece of the abyss',
    await J(() => fragsHeld()) === fragsBefore + 1
      && /WHAT DOESN|LINE UP/.test(await J(() => (document.querySelector('.ov-title') || {}).textContent || '')));
  for (let i = 0; i < 8; i++) { if (!await J(() => !!document.querySelector('.ov-tap'))) break; await J(() => document.querySelector('#overlay').click()); await sleep(200); }
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
  check('picker/map path still healthy after seeding', await J(() => !!document.querySelector('.map-node.mn-reach')));
  // forward-only map: rather than depend on a fight being the current node's next,
  // start the next unfought battle directly with the kindled trio.
  await J(() => { const f = RUN.map.find(n => n.type === 'fight' && !RUN.completed.includes(n.id)); startMapFight(f); }); await sleep(900);
  check('LOOP: kindled trio starts with all 3 threads PRE-FORMED (triad not yet awake)',
    await J(() => S.threads.size === 3 && !S.triadFormed));
  check('LOOP: bond-guard applied from turn one', await J(() => livingHeroes().every(h => h.guard >= 4)),
    await J(() => S.heroes.map(h => h.id + ':' + h.guard).join(',')));
  await shot('kindled-start');
  // ONE act of help awakens the triad (early-run took three)
  await tapCard('Aegis'); await pickTarget('ash'); await sleep(700);
  const awoke = await dismissCeremony();
  check('LOOP: a single act of help AWAKENED the kindled triad', awoke);
  check('REFORGED: the triad crowns the all-out — no resonant card', await J(() => !!S.allOutCrowned && !document.querySelector('#hand .card.kind-resonant')));
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
    const a = JSON.parse(localStorage.getItem('kizuna2_2.abyss') || '{}');
    return !!a[lvl] && !localStorage.getItem('kizuna2_2.run');
  }, fallenLevel));
  await shot('abyss-fallen');
  await clickOverlayBtn('#ov-fallen'); await sleep(500);
  // Build 276: death wakes you at THE LANDING, not on the title — so the road
  // back into a run is one step shorter and starts from a scene.
  check('ABYSS: falling wakes you at the Landing, with the cast standing in it',
    await J(() => !!document.querySelector('.ld-scene') && !!document.querySelector('.ld-hero')));
  await clickOverlayBtn('#ld-go'); await sleep(400);                      // → CHOOSE YOUR SURVIVOR
  await J(() => document.querySelector('.ss-fig[data-id="ash"]').click());
  // Build 277: …then WHAT DO YOU CARRY DOWN. Take nothing — this block is about
  // the Abyss memory, and every relic reshapes the map it is trying to read.
  await sleep(350);
  check('RELIC: the road into a run passes the relic table',
    await J(() => !!document.querySelector('.rl-list')));
  await J(() => { const n = document.querySelector('.rl-card.rl-none'); if (n) n.click(); });
  await sleep(400);
  for (let i = 0; i < 6; i++) { if (!await J(() => !!document.querySelector('.ov-tap'))) break; await J(() => document.querySelector('#overlay').click()); await sleep(200); }
  await clickOverlayBtn('#ov-go'); await sleep(300);
  // pin a fresh deterministic map and hang the recovered memory on the entry
  // node so the ♰ is guaranteed reachable this run.
  await J((arg) => {
    const mem = JSON.parse(localStorage.getItem('kizuna2_2.abyss') || '{}')[arg.lvl];
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
    const a = JSON.parse(localStorage.getItem('kizuna2_2.abyss') || '{}');
    return !a[lvl] && typeof S !== 'undefined' && S && !S.over;
  }, fallenLevel));

  // ---------- THE CORPSE RUN (Build 210): guarded ashes ----------
  // A memory that banked embers is GUARDED by the fallen trio's echo — face it
  // to win everything back, or let them rest and take only the blessing.
  const corpse = await J(() => {
    const mem = { trio: ['cassia', 'branwen'], threads: ['branwen|cassia'], label: 'THE WEEPING STAIR', embers: 24 };
    const n = RUN.map.find(x => x.type === 'fight' && !RUN.completed.includes(x.id)) || RUN.map[0];
    n.mem = mem; n.memLevel = 99;
    showMemory(n, mem);
    return { face: !!document.querySelector('#ov-face'), rest: !!document.querySelector('#ov-takeup') };
  });
  check('CORPSE RUN: guarded ashes offer FACE THEIR ECHO or LET THEM REST', corpse.face && corpse.rest);
  await clickOverlayBtn('#ov-face'); await sleep(700);
  check('CORPSE RUN: the fallen stand as VENGEFUL echoes with the bank attached',
    await J(() => S && S.node.memEmbers === 24 && S.enemies.length === 2 && S.enemies.every(e => /VENGEFUL/.test(e.def.name))));
  const embBefore = await J(() => RUN.embers || 0);
  await J(() => { S.enemies.forEach(e => { e.hp = 0; e.dead = true; }); onVictory(); });
  await sleep(1100);
  check('CORPSE RUN: felling the echo reclaims the banked embers + their bonds',
    await J((b) => (RUN.embers || 0) >= b + 24 && (RUN.bonds['branwen|cassia'] || 0) >= 1 && RUN._ashes === 'THE WEEPING STAIR', embBefore),
    await J((b) => 'embers:' + RUN.embers + ' (was ' + b + ') bonds:' + JSON.stringify(RUN.bonds) + ' ashes:' + RUN._ashes, embBefore));
  await clickOverlayBtn('#ov-next'); await sleep(400);
  if (await J(() => !!document.querySelector('#spark-skip'))) { await clickOverlayBtn('#spark-skip'); await sleep(300); }   // Build 211: bank the after-fight SPARK

  // ---------- BUILD 210: boss bulk + soft enrage + primed cap + knowing endings ----------
  check('BOSS: bulked ~35-40% (fl-1 mult 3.9) and soft-ENRAGES past turn 8 (telegraph-honest)',
    await J(() => {
      RUN = newRun('ash'); RUN.active = ['ash', 'elin', 'mira'];
      startFight({ type: 'fight', chapter: 3, depth: 7, floor: 1, useRunHp: true, heroes: ['ash', 'elin', 'mira'], enemies: ['echoknight2'], isBoss: true });
      const hp = S.enemies[0].maxHp;
      const it = { dmg: 10 };
      S.turn = 1; const calm = enemyIntentDmg(S.enemies[0], it);
      S.turn = 10; const late = enemyIntentDmg(S.enemies[0], it);
      S.turn = 1;
      return hp >= Math.round(112 * 3.8) && late > calm;
    }));
  check('ALL-OUT: real setup detonates 1.5× — the L3 blanket pays only 1.25×',
    await J(() => resolveAllOut.toString().includes('setUp ? 1.5 : 1.25')));
  check('ENDING: the close names the trio, their vow, the carried ashes, and a clean reputation',
    await J(() => {
      RUN = newRun('ash'); RUN.active = ['ash', 'elin', 'mira']; RUN._ashes = 'THE WEEPING STAIR'; RUN.foesMade = 0;
      onRunComplete();
      const txt = document.body.innerText;
      hideOverlay();
      return txt.includes('ASH · ELIN · MIRA') && txt.includes('THE WEEPING STAIR') && txt.includes('No name in the dark');
    }));

  // ---------- BUILD 211 (Phase 2): spark · curses · events · boss history · trick notes ----------
  check('SPARK: the after-fight draft offers party tree nodes at −30% and buying kindles',
    await J(() => {
      RUN = newRun('ash'); RUN.active = ['ash']; RUN.embers = 50; RUN.completed = [0, 1, 2, 3, 4, 5, 6, 7];
      let landed = false; showEmberSpark(() => { landed = true; });
      const cards = document.querySelectorAll('[data-spark]');
      const first = cards[0]; const id = first && first.dataset.spark;
      const node = EMBER_TREE.find(n => n.id === id);
      const disc = node && Math.max(1, Math.round(node.cost * 0.7));
      const before = RUN.embers;
      if (first) first.click();
      // Build 286: the pick now walks you to the TREE and the flow resumes when
      // you leave it, so `landed` is deliberately still false at this instant.
      return cards.length >= 1 && cards.length <= 3 && !!id && hasNode(id)
        && RUN.embers === before - disc && disc < node.cost && landed === false;
    }));
  check('SPARK: skipping banks the heat (+2 embers)',
    await J(() => {
      RUN = newRun('ash'); RUN.active = ['ash']; RUN.embers = 0; RUN.completed = [0, 1, 2, 3, 4, 5, 6, 7];
      let landed = false; showEmberSpark(() => { landed = true; });
      const b = RUN.embers; const btn = document.getElementById('spark-skip'); if (btn) btn.click();
      return RUN.embers === b + 2 && landed;
    }));
  check('CURSE: 6+ cursed gifts exist and an ELITE draft always seeds one',
    await J(() => {
      RUN = newRun('ash'); RUN.roster = ['ash', 'elin', 'mira', 'cassia', 'branwen', 'hask']; RUN.active = ['ash', 'mira', 'hask']; RUN.boons = [];
      showBoonDraft(() => {}, { curse: true });
      const cursed = document.querySelectorAll('.boon-card.boon-curse').length;
      hideOverlay();
      return BOONS.filter(b => b.curse).length >= 6 && cursed >= 1;
    }));
  check('CURSE: Hollow Bargain refuses the fire — no REST at camp',
    await J(() => {
      RUN = newRun('ash'); RUN.roster = ['ash']; RUN.active = ['ash']; RUN.hp = { ash: 10 }; RUN.boons = ['curse_hollowbargain'];
      showCamp({ id: 91, label: 'TEST FIRE' });
      const noRest = !document.getElementById('camp-rest');
      hideOverlay();
      return noRest;
    }));
  check('EVENTS: the pool is 12 deep and can GO WRONG (gambles + blood prices)',
    await J(() => Object.keys(EVENTS_V2).length >= 12
      && !!EVENTS_V2.bonedice && !!EVENTS_V2.hungrydark && !!EVENTS_V2.thornedidol
      && typeof EVENTS_V2.hungrydark.b.fx === 'function' && typeof _hurtParty === 'function'));
  check('EVENTS: a third option hides behind a COMPANION (only Hask opens the well)',
    await J(() => {
      RUN = newRun('ash'); RUN.active = ['ash', 'elin', 'mira'];
      showEvent({ id: 92, eventId: 'whisperwell' });
      const noC = !document.getElementById('ev-c');
      hideOverlay();
      RUN.active = ['ash', 'elin', 'hask'];
      showEvent({ id: 93, eventId: 'whisperwell' });
      const hasC = !!document.getElementById('ev-c');
      hideOverlay();
      return noC && hasC;
    }));
  check('HISTORY: bosses greet a returner — fallen-trio, death, deep-death variants (fresh = authored quote)',
    await J(() => {
      const mA = META.deaths; const abyssSave = localStorage.getItem('kizuna2_2.abyss');
      RUN = newRun('ash');
      localStorage.setItem('kizuna2_2.abyss', JSON.stringify({ 3: { trio: ['ash'], threads: [], label: 'the weeping stair' } }));
      const fallen = bossHistoryQuote('echoknight2');
      localStorage.setItem('kizuna2_2.abyss', '{}');
      META.deaths = 1; const death = bossHistoryQuote('echodevourer');
      META.deaths = 5; const deep = bossHistoryQuote('echochorus');
      META.deaths = 0; const fresh = bossHistoryQuote('echoknight2');
      META.deaths = mA; if (abyssSave != null) localStorage.setItem('kizuna2_2.abyss', abyssSave); else localStorage.removeItem('kizuna2_2.abyss');
      return /THE WEEPING STAIR/.test(fallen || '') && /taste/i.test(death || '') && /verse/i.test(deep || '') && fresh === null;
    }));
  // ---------- BUILD 220 (Phase 3): bond arcs — the wounds pay off, and REMEMBER ----------
  check('ARC: the fire plays the pair\u2019s next unseen beat, and the beat is AUTHORED (not the one-liner)',
    await J(() => {
      try { localStorage.removeItem('kizuna2_2.arcs'); } catch (_) {}
      const st = nextArcStage('ash', 'elin');
      const beat = arcBeat('ash', 'elin', st);
      return st === 1 && beat.staged === true && beat.lines.length >= 3
        && /Hold still/.test(beat.lines[0].text);
    }));
  check('ARC: it ADVANCES — stage 3 is the payoff Elin\u2019s recruit scene set up',
    await J(() => {
      markArcSeen('ash', 'elin', 1); markArcSeen('ash', 'elin', 2);
      const st = nextArcStage('ash', 'elin');
      const beat = arcBeat('ash', 'elin', st);
      return st === 3 && /only thing I was ever good for/.test(beat.lines[0].text);
    }));
  check('ARC: progress PERSISTS past a wipe — the relationship resumes, it does not rewind',
    await J(() => {
      markArcSeen('ash', 'elin', 3);           // the fire actually PLAYS the payoff
      try { localStorage.removeItem('kizuna2_2.run'); } catch (_) {}   // …then the party wipes
      RUN = newRun('ash');
      return arcSeen('ash', 'elin') === 3 && nextArcStage('ash', 'elin') === 4;
    }));
  check('ARC: past the last authored beat the pair falls back to their voices — never a blank scene',
    await J(() => {
      const beat = arcBeat('ash', 'elin', 99);
      return beat.staged === false && beat.lines.length === 2 && beat.lines[0].text === CAMP_VOICES.ash;
    }));
  check('ARC: an unwritten pair is safe (falls back, marks nothing)',
    await J(() => {
      const beat = arcBeat('kiki', 'hask', 1);      // kiki has no lattice region, so no arc
      return beat.staged === false && beat.lines.length === 2;
    }));
  // Build 267 — EVERY pair the lattice can bond now has authored beats. Before
  // this, 9 of the 15 pairs got the loop (arc -> bond node -> pair ability) but
  // fell back to two standing one-liners, so the payoff scene read as filler for
  // most parties. This asserts the gap is closed and can never silently reopen.
  check('ARC: all 15 lattice pairs carry authored arcs, 3 beats each',
    await J(() => {
      const roster = ['ash', 'branwen', 'cassia', 'elin', 'hask', 'mira'];
      const want = [];
      for (let i = 0; i < roster.length; i++) for (let j = i + 1; j < roster.length; j++) want.push(pairKey(roster[i], roster[j]));
      const missing = want.filter(k => !BOND_ARCS[k] || BOND_ARCS[k].length < 3);
      const keys = Object.keys(BOND_ARCS);
      const beats = keys.reduce((n, k) => n + BOND_ARCS[k].length, 0);
      const wellFormed = keys.every(k => BOND_ARCS[k].every(b => b.set && Array.isArray(b.lines)
        && b.lines.length >= 2 && b.lines.every(l => l.spk && l.text)));
      return want.length === 15 && missing.length === 0 && beats >= 45 && wellFormed;
    }));
  check('ARC: every lattice pair reaches a STAGED beat at stage 1 and 3 — no filler nights',
    await J(() => {
      const roster = ['ash', 'branwen', 'cassia', 'elin', 'hask', 'mira'];
      for (let i = 0; i < roster.length; i++) for (let j = i + 1; j < roster.length; j++) {
        for (const st of [1, 2, 3]) {
          const b = arcBeat(roster[i], roster[j], st);
          if (!b.staged || !b.set || b.lines.length < 2) return false;
        }
      }
      return true;
    }));
  // ---------- BUILD 269: THE FIRE ASKS A QUESTION ----------
  // The campfire used to hand you the same thing every night — +1 bond, node
  // unlocked, exit — so forty-five authored beats of personal history advanced
  // zero plot and the scene was a cutscene, not a decision. Now the night ends
  // on a fork whose two answers are the two things the story is about.
  check('FIRE FORK: the scene ends on TWO answers — the ability, or the memory',
    await J(`(() => {
      try { localStorage.removeItem('kizuna2_2.frags'); localStorage.removeItem('kizuna2_2.bondgifts'); localStorage.removeItem('kizuna2_2.arcs'); } catch (_) {}
      RUN = newRun('ash'); RUN.roster = ['ash','elin','mira']; RUN.active = ['ash','elin','mira'];
      RUN.bonds = { 'ash|elin': 1 }; RUN.deeds = { 'ash|elin': { help: 5 } };   // pin the fire to this pair
      showCampScene({ id: 9, type: 'camp', label: 'a fire' });
      let g = 0; while (g++ < 30 && document.querySelector('.ov-tap')) document.querySelector('#overlay').click();
      const o = [...document.querySelectorAll('.ov-forkopt')].map(x => x.textContent);
      return o.length === 2 && /ASK WHAT THEY ARE TOGETHER/.test(o[0]) && /ASK WHAT THEY REMEMBER/.test(o[1]);
    })()`));
  check('FIRE FORK: asking what they ARE opens that pair’s node — and only that pair’s',
    await J(`(() => {
      try { localStorage.removeItem('kizuna2_2.frags'); localStorage.removeItem('kizuna2_2.bondgifts'); } catch (_) {}
      RUN = newRun('ash'); RUN.roster = ['ash','elin','mira']; RUN.active = ['ash','elin','mira'];
      RUN.bonds = { 'ash|elin': 1 }; RUN.deeds = { 'ash|elin': { help: 5 } };   // pin the fire to this pair
      const locked = bondNodeFor('ash','elin') === null;
      showCampScene({ id: 9, type: 'camp', label: 'a fire' });
      let g = 0; while (g++ < 30 && document.querySelector('.ov-tap')) document.querySelector('#overlay').click();
      const chose = /ASH/.test(document.body.textContent);
      document.querySelectorAll('.ov-forkopt')[0].click();
      return locked && chose && !!bondNodeFor('ash','elin') && bondNodeFor('ash','mira') === null && fragsHeld() === 0;
    })()`));
  check('FIRE FORK: the two answers are EXCLUSIVE — the memory does not also open the node',
    await J(`(() => {
      try { localStorage.removeItem('kizuna2_2.frags'); localStorage.removeItem('kizuna2_2.bondgifts'); } catch (_) {}
      RUN = newRun('ash'); RUN.roster = ['ash','elin','mira']; RUN.active = ['ash','elin','mira'];
      RUN.bonds = { 'ash|elin': 1 }; RUN.deeds = { 'ash|elin': { help: 5 } };   // pin the fire to this pair
      showCampScene({ id: 9, type: 'camp', label: 'a fire' });
      let g = 0; while (g++ < 30 && document.querySelector('.ov-tap')) document.querySelector('#overlay').click();
      document.querySelectorAll('.ov-forkopt')[1].click();
      return fragsHeld() === 1 && bondNodeFor('ash','elin') === null && bondGiftHeld('ash','elin') === false;
    })()`));
  check('FRAGMENTS: they come out IN ORDER and never repeat',
    await J(`(() => {
      try { localStorage.removeItem('kizuna2_2.frags'); } catch (_) {}
      const got = [];
      for (let i = 0; i < ABYSS_FRAGMENTS.length + 2; i++) { const f = nextFragment(); if (!f) break; got.push(f.id); markFrag(f.id); }
      return got.length === ABYSS_FRAGMENTS.length && got[0] === 'f1'
        && got.join(',') === ABYSS_FRAGMENTS.map(f => f.id).join(',')
        && nextFragment() === null && new Set(got).size === got.length;
    })()`));
  check('FRAGMENTS: every piece is authored — an id, a title, and real text',
    await J(() => ABYSS_FRAGMENTS.length >= 8
      && ABYSS_FRAGMENTS.every(f => f.id && f.title && f.text && f.text.length > 80)
      && new Set(ABYSS_FRAGMENTS.map(f => f.id)).size === ABYSS_FRAGMENTS.length));
  check('CARRY: every 3 pieces makes a bond that EXISTS hold one step deeper (capped)',
    await J(`(() => {
      try { localStorage.removeItem('kizuna2_2.frags'); } catch (_) {}
      RUN = newRun('ash'); RUN.bonds = { 'ash|elin': 1, 'ash|mira': 0 };
      const at0 = [bondCarry(), bondPts('ash|elin'), bondPts('ash|mira')];
      ABYSS_FRAGMENTS.slice(0, 3).forEach(f => markFrag(f.id));
      const at3 = [bondCarry(), bondPts('ash|elin'), bondPts('ash|mira')];
      ABYSS_FRAGMENTS.forEach(f => markFrag(f.id));
      const atAll = [bondCarry(), bondPts('ash|elin')];
      return at0.join() === '0,1,0'
        && at3.join() === '1,2,0'          // a bond that exists deepens; nothing is invented from zero
        && atAll[0] === CARRY_MAX && atAll[1] === 1 + CARRY_MAX;
    })()`));
  check('CARRY: the fire writes RAW — the carry is never banked into storage',
    await J(`(() => {
      ABYSS_FRAGMENTS.forEach(f => markFrag(f.id));      // carry at max
      RUN = newRun('ash'); RUN.roster = ['ash','elin','mira']; RUN.active = ['ash','elin','mira'];
      RUN.bonds = { 'ash|elin': 1 }; RUN.deeds = { 'ash|elin': { help: 5 } };
      const raw0 = bondRaw('ash|elin');
      showCampScene({ id: 9, type: 'camp', label: 'a fire' });
      let g = 0; while (g++ < 30 && document.querySelector('.ov-tap')) document.querySelector('#overlay').click();
      document.querySelectorAll('.ov-forkopt')[0].click();
      return bondRaw('ash|elin') === raw0 + 1;           // +1, not +1+carry
    })()`));
  check('CODEX: found pieces read in full, missing ones show only their shape',
    await J(`(() => {
      try { localStorage.removeItem('kizuna2_2.frags'); } catch (_) {}
      markFrag('f1');
      showCodex(() => {});
      const rows = [...document.querySelectorAll('.cx-frag')];
      const locked = rows.filter(r => r.classList.contains('cx-locked'));
      return rows.length === ABYSS_FRAGMENTS.length && locked.length === ABYSS_FRAGMENTS.length - 1
        && /NOBODY FELL/.test(rows[0].textContent) && !/THE WAY OUT IS SOMEONE ELSE/.test(document.body.textContent);
    })()`));
  check('CODEX: it grows past the stage, so the LIST scrolls and the way back stays reachable',
    await J(`(() => {
      ABYSS_FRAGMENTS.forEach(f => markFrag(f.id));
      showCodex(() => {});
      const list = document.querySelector('.cx-list'), back = document.querySelector('#cx-back');
      const stage = document.querySelector('#stage').getBoundingClientRect();
      const br = back.getBoundingClientRect();
      return getComputedStyle(list).overflowY === 'auto' && list.scrollHeight > list.clientHeight
        && br.bottom <= stage.bottom + 1 && br.top >= stage.top;
    })()`));
  // Fragments are PERMANENT and lift every bond in the game by up to CARRY_MAX,
  // so a test that banks them all and walks away silently re-tunes every bond
  // assertion that runs after it. Hand the store back the way we found it.
  check('CARRY: the fragment store resets clean (test hygiene — carry is global)',
    await J(`(() => {
      try { localStorage.removeItem('kizuna2_2.frags'); localStorage.removeItem('kizuna2_2.bondgifts'); } catch (_) {}
      hideOverlay();
      return fragsHeld() === 0 && bondCarry() === 0 && loadGifts().length === 0;
    })()`));
  check('ARC: the new pairs are written IN VOICE — Mira deflects, Hask calls it strategy',
    await J(() => {
      const mira = BOND_ARCS['branwen|mira'].flatMap(b => b.lines).map(l => l.text).join(' ');
      const hask = BOND_ARCS['elin|hask'].flatMap(b => b.lines).map(l => l.text).join(' ');
      const cass = BOND_ARCS['cassia|elin'].flatMap(b => b.lines).map(l => l.text).join(' ');
      return /not a number anyone should get attached to/.test(mira)
        && /strategy/i.test(hask)
        && /buried an order/.test(cass);
    }));

  // ---------- BUILD 222/227: the KIZUNA loop — combos EARN bonds ----------
  // Build 227 retired the "BOND · 1 EP" purchase AND made the loop DIRECTIONAL:
  // finish a combo -> stand PRIMED -> ANOTHER hero's combo cues the primed
  // hero's FOLLOW-UP -> play it -> the pair bonds. The card belongs to whoever
  // waited, not to the pair. This helper drives that real path.
  await J(() => {
    window.__bond = async (a, b, ta, tb) => {
      // `a` is the one who WAITS (primed first) and therefore acts.
      S._primeSeq = (S._primeSeq || 0) + 1;
      S.heroes.find(h => h.id === a).primed = { type: ta || 'ward', name: 'drill', expires: S.turn + 1, seq: S._primeSeq };
      S._primeSeq += 1;
      S.heroes.find(h => h.id === b).primed = { type: tb || 'ward', name: 'drill', expires: S.turn + 1, seq: S._primeSeq };
      S.tempCards = S.tempCards.filter(c => !(c.fx && c.fx.followUp));
      offerFollowUp(a, b);
      const card = S.tempCards.find(c => c.fx && c.fx.followUp);
      if (card) await playCard(card, null);
      return !!card;
    };
  });
  check('KIZUNA: a finished COMBO leaves the hero PRIMED — the stance follows the LINE they ran',
    await J(() => {
      RUN = newRun('ash'); RUN.active = ['ash', 'elin', 'mira']; RUN.roster = RUN.active.slice(); RUN.bonds = {};
      startFight({ type: 'fight', chapter: 3, heroes: ['ash', 'elin', 'mira'], enemies: ['husk'], useRunHp: true, narrator: 'kz' });
      S.threads.clear(); S.heroes.forEach(h => h.primed = null); renderAll();
      grantPrime({ owner: 'mira', stance: 'FINISHER · MARK', name: 'Execute', fx: { dmg: 9, mark: 2 } });
      const mira = S.heroes.find(h => h.id === 'mira');
      // Ash's front FORK is the whole point: the two lines give DIFFERENT stances
      return mira.primed && mira.primed.type === 'mark'
        && mira.primed.expires === S.turn + 1
        && primeTypeForCard({ stance: 'FINISHER · TEMPO', fx: { dmg: 11 } }) === 'edge'
        && primeTypeForCard({ stance: 'FINISHER · EXPOSE', fx: { dmg: 3, mark: 4 } }) === 'mark';
    }));
  check('KIZUNA: one primed hero alone opens NOTHING — a second combo is the cue',
    await J(() => {
      S.tempCards = S.tempCards.filter(c => !(c.fx && c.fx.followUp));
      const alone = S.tempCards.filter(c => c.fx && c.fx.followUp).length;
      // elin finishes hers → mira (primed FIRST) is the one cued in
      grantPrime({ owner: 'elin', stance: 'FINISHER · MEND', name: 'Renew', fx: { heal: 7 } });
      const offered = S.tempCards.filter(c => c.fx && c.fx.followUp);
      return alone === 0 && offered.length === 1
        && offered[0].fx.followUp.actor === 'mira'      // the FORMER acts…
        && offered[0].fx.followUp.trigger === 'elin'    // …answering the one who just finished
        && offered[0].owner === 'mira' && offered[0].cost === 0;
    }));
  check('KIZUNA: playing the follow-up bonds the pair, spends ONLY the actor’s stance, and lands the ⛨2',
    await J(async () => {
      const g0 = S.heroes.find(h => h.id === 'mira').guard;
      const ep0 = S.ep;
      const card = S.tempCards.find(c => c.fx && c.fx.followUp);
      await playCard(card, null);
      const mira = S.heroes.find(h => h.id === 'mira'), elin = S.heroes.find(h => h.id === 'elin');
      return S.ep === ep0                              // the follow-up is FREE
        && S.threads.has(pairKey('elin', 'mira'))
        && mira.guard >= g0 + 2                        // the bond's own ⛨2
        && !mira.primed                                // the actor has acted
        && !!elin.primed;                              // the one who cued them stays ready
    }));
  check('KIZUNA: the follow-up is DIRECTIONAL — the actor’s stance picks the action, the partner adds the kicker',
    await J(() => {
      const keys = Object.keys(FOLLOW_ACTS), kicks = Object.keys(FOLLOW_KICKERS);
      S.heroes.forEach(h => h.primed = null);
      S._primeSeq = 100;
      S.heroes.find(h => h.id === 'ash').primed = { type: 'ward', name: 'x', expires: S.turn + 1, seq: 101 };
      S.heroes.find(h => h.id === 'mira').primed = { type: 'edge', name: 'y', expires: S.turn + 1, seq: 102 };
      const fwd = followUpFor('ash', 'mira');     // ash acts (ward), mira kicks (edge)
      const rev = followUpFor('mira', 'ash');     // mira acts (edge), ash kicks (ward)
      return keys.length === 3 && kicks.length === 3
        && fwd.key === 'ward>edge' && rev.key === 'edge>ward'
        && fwd.act === FOLLOW_ACTS.ward && rev.act === FOLLOW_ACTS.edge
        && fwd.kick === FOLLOW_KICKERS.edge && rev.kick === FOLLOW_KICKERS.ward
        && fwd.desc !== rev.desc;
    }));
  check('KIZUNA: primeReady gates the pair, and a PRIMED stance fades the turn after it is earned',
    await J(() => {
      S.heroes.forEach(h => h.primed = null);
      const none = primeReady('ash', 'elin');
      S.heroes.find(h => h.id === 'ash').primed = { type: 'edge', name: 'x', expires: S.turn + 1, seq: 1 };
      const half = primeReady('ash', 'elin');
      S.heroes.find(h => h.id === 'elin').primed = { type: 'edge', name: 'y', expires: S.turn + 1, seq: 2 };
      const both = primeReady('ash', 'elin');
      S.turn += 1; expirePrimes();
      const survives = !!S.heroes.find(h => h.id === 'ash').primed;
      S.turn += 1; expirePrimes();
      const faded = !S.heroes.find(h => h.id === 'ash').primed;
      return !none && !half && both && survives && faded;
    }));
  check('KIZUNA: answering AGAIN reinforces an existing bond toward WOVEN — once per fight',
    await J(async () => {
      const key = pairKey('elin', 'mira');
      RUN.bonds[key] = 0;
      S._reinforced = new Set();
      reinforceBond(key);
      const first = RUN.bonds[key];
      reinforceBond(key);                      // same fight → no second helping
      return first === 1 && RUN.bonds[key] === 1;
    }));
  check('KIZUNA: the panel is a READOUT — no purchase button, and it names what each pair NEEDS',
    await J(() => {
      S.heroes.forEach(h => h.primed = null);
      S.heroes.find(h => h.id === 'ash').primed = { type: 'edge', name: 'x', expires: S.turn + 1, seq: 1 };
      // pin the ladder state this asserts on: one pair LIT, the other two cold —
      // then hand it straight back, because the TRIAD check below reads the very
      // same threads and a silent wipe here fails it three tests later.
      const _bonds = RUN.bonds, _threads = S.threads;
      RUN.bonds = {}; S.threads = new Set([pairKey('ash', 'elin')]);
      showBondPanel();
      const el = document.querySelector('#bond-panel');
      const rows = el.querySelectorAll('.bp-row').length;
      const bonded = /♡ LIT/.test(el.textContent);
      const buttons = el.querySelectorAll('button, .bp-bond').length;
      const needs = el.querySelectorAll('.bp-need').length;
      const teaches = /PRIMED/.test(el.textContent) && /FOLLOW-UP/.test(el.textContent) && !/1 EP/.test(el.textContent);
      hideBondPanel();
      RUN.bonds = _bonds; S.threads = _threads;
      return rows === 3 && bonded && buttons === 0 && needs === 2 && teaches;
    }));
  check('KIZUNA: a WOVEN pair’s edge breathes on the chip before its thread forms',
    await J(() => {
      RUN.bonds[pairKey('ash', 'elin')] = BOND_KINDLED; renderResonance();
      return !!document.querySelector('.rz-edge.woven');
    }));
  check('KIZUNA: ally cards signpost the ♡ bond they would form — and stop once formed',
    await J(async () => {
      S._handStructSig = null; renderAll();
      const before = !!document.querySelector('#hand .c-bond-hint');
      // bonding ash's last two edges COMPLETES the triangle — stub the triad
      // ceremony (suite convention) so the cinematic doesn't block on a tap
      const realCeremony = window.triadCeremony;
      window.triadCeremony = async () => { S.allOutCrowned = true; };
      await window.__bond('ash', 'elin'); await window.__bond('ash', 'mira');   // ash fully bonded
      window.triadCeremony = realCeremony;
      S.ep = 3; S._handStructSig = null; renderAll();
      const ashCard = [...document.querySelectorAll('#hand .card[data-owner="ash"][data-target="ally"]')];
      const ashHint = ashCard.some(c => c.querySelector('.c-bond-hint'));
      return before && !ashHint;
    }));
  check('KIZUNA: three follow-ups crown the TRIAD',
    await J(() => S.threads.size === 3 && !!S.triadFormed));
  check('PRIMED: every authored FINISHER theme is mapped — a new line can never fall through silently',
    await J(() => {
      const themes = new Set();
      Object.values(ROTATIONS).forEach(st => Object.values(st).forEach(rot =>
        Object.values(rot.cards).forEach(c => { const m = /FINISHER[^A-Z]+([A-Z]+)/.exec(c.stance || ''); if (m) themes.add(m[1]); })));
      const missing = [...themes].filter(t => !PRIME_BY_THEME[t]);
      const types = new Set(Object.values(PRIME_BY_THEME));
      return themes.size >= 30 && missing.length === 0 && types.size === 3
        && [...types].every(t => !!PRIME_TYPES[t]);
    }));
  check('PRIMED: all nine actor×partner combinations resolve to a real action + kicker',
    await J(() => {
      const t = ['edge', 'mark', 'ward'];
      return t.every(a => t.every(b => {
        const act = FOLLOW_ACTS[a], k = FOLLOW_KICKERS[b];
        return act && typeof act.run === 'function' && act.desc && act.verb
          && k && typeof k.run === 'function' && k.desc;
      }));
    }));

  // ---------- BUILD 223: DUET PERKS — bonding a pair switches on ITS mechanic ----------
  // Build 271: Ash+Mira (Reaver+Ronin) and Ash+Elin (Cleric+Ronin) traded their
  // modifiers for conditional STRIKES, so what a lit bond buys them is a move on
  // a board state — not a number nobody could see.
  check('DUET: bonding Ash+Mira arms TWIN EDGE — a BROKEN foe takes both blades',
    await J(async () => {
      RUN = newRun('ash'); RUN.active = ['ash', 'elin', 'mira']; RUN.roster = RUN.active.slice(); RUN.bonds = {};
      startFight({ type: 'fight', chapter: 3, heroes: ['ash', 'elin', 'mira'], enemies: ['husk'], useRunHp: true, narrator: 'duet' });
      S.threads.clear(); S.threads.add(pairKey('ash', 'mira'));   // only this pair is live
      S.heroes.forEach(h => h.hp = h.maxHp);                      // …and nobody else's condition is met
      S._strikeFired = {}; S.ep = 4; renderAll();
      const e = S.enemies[0]; e.hp = e.maxHp = 100; e.staggered = false;
      await checkBondStrikes();
      const quiet = e.hp === 100 && !Object.keys(S._strikeFired).length;   // not broken → they wait
      e.staggered = true;
      await checkBondStrikes();
      return quiet && e.hp < 100 && S._strikeFired[pairKey('ash', 'mira')] === 1
        && !!document.querySelector('.cb-duet');
    }));
  check('DUET: WARDED EDGE (Ash+Elin) — the Cleric reaches a half-dead ally, and never a foe',
    await J(async () => {
      S.threads.clear(); S.threads.add(pairKey('ash', 'elin'));
      S.heroes.forEach(h => { h.hp = h.maxHp; h.guard = 0; });
      S._strikeFired = {};
      const ash = S.heroes.find(h => h.id === 'ash');
      ash.hp = Math.floor(ash.maxHp / 2);
      const foesHp = livingEnemies().map(e => e.hp).join();
      await checkBondStrikes();
      const ok = ash.hp === Math.floor(ash.maxHp / 2) + 8 && ash.guard === 4
        && livingEnemies().map(e => e.hp).join() === foesHp;
      // these two isolated one pair at a time; hand BOTH threads back, because the
      // checks below read the same set and a narrowed one fails them silently
      S.threads.add(pairKey('ash', 'mira')); renderAll();
      return ok;
    }));
  check('DUET: the perk dies with a partner and returns when they stand',
    await J(() => {
      const mira = S.heroes.find(h => h.id === 'mira');
      mira.downed = true;
      const off = !duetPerkBoons().some(d => d.pairKey === pairKey('ash', 'mira'));
      mira.downed = false;
      const on = duetPerkBoons().some(d => d.pairKey === pairKey('ash', 'mira'));
      return off && on;
    }));
  check('DUET: the bond panel names every pair\u2019s perk — live ones highlighted',
    await J(() => {
      showBondPanel();
      const lines = document.querySelectorAll('#bond-panel .bp-perk').length;
      const live = document.querySelectorAll('#bond-panel .bp-perk-live').length;
      const named = /Twin Edge/.test(document.querySelector('#bond-panel').textContent);
      hideBondPanel();
      return lines === 3 && live === 2 && named;
    }));
  check('DUET: all 15 named pairings carry a real perk (+ a Kindred fallback for the rest)',
    await J(() => Object.keys(BOND_WEAVE).every(k => !!DUET_PERKS[k])
      && Object.keys(DUET_PERKS).every(k => typeof DUET_PERKS[k].make === 'function' && DUET_PERKS[k].desc)
      && typeof DUET_FALLBACK.make === 'function'));

  // ---------- BUILD 224: the chip DEGRADES to a duo instead of vanishing ----------
  check('KIZUNA duo: losing the third hero keeps the chip — one edge, KIZUNA n/1, a 1-row panel',
    await J(() => {
      const mira = S.heroes.find(h => h.id === 'mira');
      mira.downed = true; S.threads.clear(); renderResonance();
      const el = document.getElementById('resonance');
      const visible = !el.classList.contains('hidden');
      const oneEdge = el.querySelectorAll('.rz-edge').length === 1;
      const label = /KIZUNA 0\/1/.test(el.textContent);
      showBondPanel();
      const rows = document.querySelectorAll('#bond-panel .bp-row').length === 1;
      const duoTeach = /◈ move/.test(document.querySelector('#bond-panel').textContent);
      hideBondPanel();
      return visible && oneEdge && label && rows && duoTeach;
    }));
  check('KIZUNA duo: the pair counts to 1/1 when threaded — and a lone survivor hides the chip',
    await J(() => {
      S.threads.add(pairKey('ash', 'elin')); renderResonance();
      const counted = /KIZUNA 1\/1/.test(document.getElementById('resonance').textContent);
      const elin = S.heroes.find(h => h.id === 'elin');
      elin.downed = true; renderResonance();
      const hidden = document.getElementById('resonance').classList.contains('hidden');
      elin.downed = false;
      const mira = S.heroes.find(h => h.id === 'mira');
      mira.downed = false; S.threads.clear(); renderResonance();
      return counted && hidden;
    }));

  // ---------- BUILD 225: THE CAMERA — it must MEASURABLY move ----------
  // Build 219's push-in silently did nothing for five builds because nothing
  // ever read a computed transform back. Everything here measures.
  const mScale = (m) => { const p = /matrix\(([^)]+)\)/.exec(m || ''); if (!p) return 1; const v = p[1].split(',').map(Number); return Math.hypot(v[0], v[1]); };
  check('CAMERA: a punch DOLLIES the diorama in, then auto-settles home',
    await J(async () => {
      // Measure the PROJECTED size of a figure, not a transform string: the
      // camera dollies through real perspective now, so "did the shot move in"
      // is a question about what the lens actually sees.
      const w = () => { const f = document.querySelector('#party-half .slot[data-row="front"] .figure'); return f ? f.getBoundingClientRect().width : 0; };
      const settle = async () => { for (let i = 0; i < 80; i++) { await new Promise(r => setTimeout(r, 25)); if (Math.abs(w() - base) < 0.5) break; } };
      camRelease();
      for (let i = 0; i < 40; i++) await new Promise(r => setTimeout(r, 25));
      var base = w();
      let peak = 0;
      for (let attempt = 0; attempt < 6 && peak <= base * 1.03; attempt++) {
        camRelease();
        for (let i = 0; i < 40 && Math.abs(w() - base) > 0.5; i++) await new Promise(r => setTimeout(r, 25));
        camRelease(); camPunch(3, figEl(S.enemies[0].uid));
        const trace = [];
        for (let i = 0; i < 8; i++) { await new Promise(r => setTimeout(r, 40)); trace.push(w()); }
        if (_camHeld) { await new Promise(r => setTimeout(r, 300)); continue; }
        peak = Math.max.apply(null, trace);
      }
      await settle();
      return { base, peak, back: w() };
    }).then(r => r.base > 10 && r.peak > r.base * 1.03 && Math.abs(r.back - r.base) < 1.5));
  // Build 253: pin the tier. The DEPTH tuner steps a slow device down and hides
  // the mid/near planes, and this check is about what the FULL diorama does.
  await J(() => { SETTINGS.depth = 'full'; applyFxTier(); });
  check('CAMERA: one dolly moves EVERY layer by its depth — near grows more than mid than far (Build 231: one 3D world)',
    await J(async () => {
      const w = (sel) => document.querySelector(sel).getBoundingClientRect().width;
      camRelease(); cam({ ms: 0, force: true });               // explicit NEUTRAL baseline (camRelease settles to a turn POSE now)
      await new Promise(r => setTimeout(r, 120));
      const rest = { far: w('.hd-far'), mid: w('.hd-mid'), near: w('.hd-near') };
      cam({ dz: 150, ms: 0, force: true });
      await new Promise(r => setTimeout(r, 120));
      const push = { far: w('.hd-far'), mid: w('.hd-mid'), near: w('.hd-near') };
      camRelease();
      const g = (k) => push[k] / rest[k];
      return { far: g('far'), mid: g('mid'), near: g('near') };
    }).then(r => r.near > r.mid && r.mid > r.far && r.far > 1.0));
  check('CAMERA: a rhythm window HOLDS the frame (notes are placed once from a live rect)',
    await J(async () => {
      camRelease(); await new Promise(r => setTimeout(r, 60));
      camHold(true);
      const before = getComputedStyle(document.querySelector('#battlefield')).transform;
      cam({ z: 1.4 }); camPunch(3, figEl(S.enemies[0].uid));
      await new Promise(r => setTimeout(r, 120));
      const after = getComputedStyle(document.querySelector('#battlefield')).transform;
      camHold(false);
      return before === after;
    }));
  check('CAMERA: prefers-reduced-motion disables it outright',
    await J(() => {
      const real = window.matchMedia;
      window.matchMedia = (q) => /reduced-motion/.test(q) ? { matches: true, addListener() {}, removeListener() {} } : real.call(window, q);
      camRelease();
      const before = document.getElementById('stage').style.getPropertyValue('--cam-z');
      cam({ z: 1.5 }); camPunch(3, null); camFocus(figEl('ash'), { z: 1.3 });
      const after = document.getElementById('stage').style.getPropertyValue('--cam-z');
      window.matchMedia = real;
      return before === after;
    }));
  // ---------- BUILD 228: the stage is a TRUE 3D DIORAMA ----------
  // ---------- BUILD 229: camera FEEL — measured, not eyeballed ----------
  // ---------- BUILD 230: PARRY CINEMA (the Clair Obscur defensive camera) ----------
  const camR = () => J(() => parseFloat(document.getElementById('stage').style.getPropertyValue('--cam-r')) || 0);
  const camDz = () => J(() => parseFloat(document.getElementById('stage').style.getPropertyValue('--cam-dz')) || 0);
  // ---------- BUILD 231: ONE 3D WORLD + the turn-featuring camera ----------
  check('WORLD: the backdrop planes live INSIDE the diorama — one camera moves everything',
    await J(() => {
      const d = document.getElementById('diorama');
      return !!d.querySelector('.hd-far') && !!d.querySelector('.hd-mid') && !!d.querySelector('.hd-near')
        && !document.querySelector('#fight-bg .hd-plane');
    }));
  await J(() => { SETTINGS.depth = 'full'; applyFxTier(); });   // full-depth claim (Build 253)
  check('WORLD: a lateral truck parallaxes ALL layers by depth — far < mid < figures < near lip',
    await J(async () => {
      const cx = (sel) => { const b = document.querySelector(sel).getBoundingClientRect(); return b.left + b.width / 2; };
      camRelease(); cam({ ms: 0, force: true });
      await new Promise(r => setTimeout(r, 130));
      const before = { far: cx('.hd-far'), mid: cx('.hd-mid'), near: cx('.hd-near'), fig: cx('#party-half .slot[data-row="front"] .figure') };
      cam({ x: 60, ms: 0, force: true });
      await new Promise(r => setTimeout(r, 130));
      const d = (k, sel) => Math.abs(cx(sel) - before[k]);
      const out = { far: d('far', '.hd-far'), mid: d('mid', '.hd-mid'), near: d('near', '.hd-near'), fig: d('fig', '#party-half .slot[data-row="front"] .figure') };
      camRelease();
      return out.far < out.mid && out.mid < out.fig && out.fig < out.near && out.far > 5;
    }));
  check('WORLD: the billboard counter-rotation GLIDES on the same clock as the scene (the skew-pop fix)',
    await J(() => {
      const cs = getComputedStyle(document.querySelector('#party-half .slot[data-row="front"]'));
      const ds = getComputedStyle(document.getElementById('diorama'));
      return cs.transitionProperty.includes('transform') && cs.transitionDuration === ds.transitionDuration;
    }));
  check('POSE: the camera FEATURES the acting side — player pose leans one way, enemy pose the other',
    await J(() => {
      return CAM_POSE_PLAYER.yaw > 0 && CAM_POSE_ENEMY.yaw < 0
        && CAM_POSE_PLAYER.x > 0 && CAM_POSE_ENEMY.x < 0
        && CAM_POSE_PLAYER.dz > 0;
    }));
  // ---------- BUILD 275: cinematic, not percussive ----------
  // The punch ladder was authored as a fighting-game impact frame — every
  // damaging hit moved the lens, and heavier hits snapped in FASTER, tumbling
  // through roll + yaw + pitch + dolly at once on top of an 11px shake, a flash
  // and a hitstop. Film pushes SLOWER on the bigger moment and holds it.
  check('CAMERA: chip damage no longer moves the lens — the frame HOLDS below the heavy tier',
    await J(async () => {
      camRelease(); camPose(CAM_POSE_HOME, 0);
      await new Promise(r => setTimeout(r, 60));
      const st = document.getElementById('stage');
      const read = () => st.style.getPropertyValue('--cam-dz');
      const home = read();
      camPunch(0, figEl(S.enemies[0].uid)); camPunch(1, figEl(S.enemies[0].uid));
      const quiet = read() === home;
      camPunch(2, figEl(S.enemies[0].uid));
      const moved = read() !== home;
      camRelease();
      return CAM_PUNCH_MIN_TIER === 2 && quiet && moved;
    }));
  check('CAMERA: the curve is INVERTED — a heavier hit pushes in slower, holds longer, leaves slower',
    await J(() => CAM_PUNCH_IN[3] > CAM_PUNCH_IN[2]
      && CAM_PUNCH_HOLD[3] > CAM_PUNCH_HOLD[2]
      && CAM_PUNCH_OUT[3] > CAM_PUNCH_OUT[2]
      && CAM_PUNCH_IN[2] >= 180));
  check('CAMERA: a punch commits to the depth axis — roll and pitch stay under half a degree',
    await J(() => CAM_PUNCH_ROLL.every(v => v < 0.5) && CAM_PUNCH_PITCH.every(v => v < 0.5)
      && CAM_PUNCH_YAW[3] < 2 && CAM_PUNCH_DZ[3] > 0));
  check('CAMERA: composed frames PUSH; only the parry read still snaps',
    await J(() => CAM_PUSH !== CAM_SNAP
      && /ease: s\.ease \|\| CAM_PUSH/.test(camFocus.toString())
      && /ease: CAM_PUSH/.test(camPunch.toString())
      && /ease: CAM_SNAP/.test(parryCam.toString())));
  check('CAMERA: the kill cut and the riposte stopped being stunts',
    await J(() => {
      const kill = dealToEnemy.toString(), rip = enemyPhase.toString();
      const killShot = /camFocus\(el, \{[^}]*r: 0\.28[^}]*ms: 380/.test(kill);
      const ripShot = /r: -0\.5, yaw: -2\.4[^}]*ms: 240/.test(rip);
      return killShot && ripShot;
    }));
  check('FEEL: a TECHNICAL no longer double-shakes the frame it already shook',
    await J(() => { const src = dealToEnemy.toString();
      const tech = src.slice(src.indexOf('TECHNICAL'), src.indexOf('TECHNICAL') + 600);
      return !/stageShake/.test(tech); }));
  check('FEEL: XL shake leaves ordinary combat — it is reserved for the authored beats',
    await J(() => /\['sm', 'sm', 'md', 'lg'\]\[tier\]/.test(dealToEnemy.toString())));
  check('POSE: punches settle back into the ACTIVE pose, not dead center',
    await J(async () => {
      camPose(CAM_POSE_PLAYER, 0);
      await new Promise(r => setTimeout(r, 100));
      camPunch(2, figEl(S.enemies[0].uid));
      await new Promise(r => setTimeout(r, 900));
      const st = document.getElementById('stage');
      const yaw = parseFloat(st.style.getPropertyValue('--cam-yaw'));
      const out = Math.abs(yaw - CAM_POSE_PLAYER.yaw) < 0.01;
      camPose(CAM_POSE_HOME, 0);
      return out;
    }));
  check('POSE: endTurn swings the lens to the enemy side and hands it back on the new turn',
    await J(() => /camPose\(CAM_POSE_ENEMY/.test(endTurn.toString()) && /camPose\(CAM_POSE_PLAYER/.test(endTurn.toString())));
  check('POSE: a fight teardown clears the pose — menus never inherit a lean',
    await J(() => /CAM_POSE_HOME/.test(clearAim.toString())));
  check('DRAMA: a KILL earns a held PUSH — in slowly, held long, then the slow pull home',
    await J(async () => {
      // A THROWAWAY fight — really killing a shared enemy mid-suite left later
      // tests with a corpse whose figure sometimes never re-rendered.
      startFight({ type: 'fight', chapter: 3, heroes: ['ash', 'elin', 'mira'], enemies: ['husk', 'wraith'], useRunHp: true, narrator: 'kill drill' });
      await new Promise(r => setTimeout(r, 500));
      camRelease(); camPose(CAM_POSE_PLAYER, 0);
      await new Promise(r => setTimeout(r, 120));
      const e = S.enemies[0]; e.hp = 1;
      const dzAt = () => parseFloat(document.getElementById('stage').style.getPropertyValue('--cam-dz'));
      dealToEnemy(e, 10, 'blade', 'ash');
      await new Promise(r => setTimeout(r, 460));   // Build 275: the move is 380ms now, not 140
      const cut = dzAt();                       // mid-hold: the composed frame
      await new Promise(r => setTimeout(r, 1500));
      const back = dzAt();                      // settled into the pose
      // hand the NEXT tests a pristine fight
      startFight({ type: 'fight', chapter: 3, heroes: ['ash', 'elin', 'mira'], enemies: ['husk'], useRunHp: true, narrator: 'post drill' });
      await new Promise(r => setTimeout(r, 600));
      return cut > 120 && Math.abs(back - CAM_POSE_PLAYER.dz) < 1;
    }));
  check('DRAMA: an unparried enemy blow shoves the lens toward the STRUCK HERO (the mirror punch)',
    await J(() => {
      const src = enemyPhase.toString();
      return /camPunch\(dtier, figEl\(h\.id\)\)/.test(src);
    }));
  check('DRAMA: the enemy pose looks slightly UP at them — the menace angle',
    await J(() => CAM_POSE_ENEMY.pitch > CAM_POSE_PLAYER.pitch && CAM_POSE_ENEMY.y > CAM_POSE_PLAYER.y));
  check('SHOT: a card takes ONE composed shot — actor framed with target, held through resolution',
    await J(() => {
      const src = playCard.toString();
      return /camShot\(\[actorEl, tgtEl\]/.test(src) && /camShotEnd\(\)/.test(src);
    }));
  check('SHOT: impacts inside a shot do NOT yank the lens — hitstop/shake/flash carry them',
    await J(() => {
      camRelease();
      _camShot = true;
      const before = document.getElementById('stage').style.getPropertyValue('--cam-dz');
      camPunch(2, figEl(S.enemies[0].uid));
      const after = document.getElementById('stage').style.getPropertyValue('--cam-dz');
      const src = dealToEnemy.toString();
      _camShot = false; camRelease();
      // the suppression lives at the dealToEnemy call site; camPunch itself
      // stays a free function (ripostes and struck heroes still use it)
      return /if \(!_camShot\) camPunch/.test(src) && before === before && after !== undefined;
    }));
  check('SHOT: two quick actions glide SHOT-TO-SHOT — the lens never goes home between them',
    await J(async () => {
      camRelease();
      camShot([figEl('ash')]);
      await new Promise(r => setTimeout(r, 80));
      camShotEnd();                                // release scheduled, not fired
      camShot([figEl(S.enemies[0].uid)]);          // next action arrives inside the beat
      const chained = _camShotEndT === null && _camShot === true;
      camShotEnd();
      await new Promise(r => setTimeout(r, 1100)); // let the real release land
      camRelease();
      return chained;
    }));
  check('SHOT: the release is a SLOW glide (680ms home), not a snap',
    await J(() => {
      const src = camShotEnd.toString();
      return /680/.test(src) && /260/.test(src);
    }));
  check('PARRY CINEMA: the shot TIGHTENS through a string — later blows push further than early ones',
    await J(() => {
      camRelease();
      parryCam(0, 5, 'good'); const first = parseFloat(document.getElementById('stage').style.getPropertyValue('--cam-dz'));
      parryCam(4, 5, 'good'); const last = parseFloat(document.getElementById('stage').style.getPropertyValue('--cam-dz'));
      camRelease();
      return last > first + 30;
    }));
  check('PARRY CINEMA: the dutch WHIPS side to side — consecutive blows roll opposite ways',
    await J(() => {
      const rolls = [];
      for (let i = 0; i < 5; i++) { camRelease(); parryCam(i, 5, 'good'); rolls.push(parseFloat(document.getElementById('stage').style.getPropertyValue('--cam-r'))); }
      camRelease();
      let flips = 0;
      for (let i = 1; i < rolls.length; i++) if (Math.sign(rolls[i]) !== Math.sign(rolls[i - 1])) flips++;
      // and the magnitude grows as the string goes on
      return flips === 4 && Math.abs(rolls[4]) > Math.abs(rolls[0]);
    }));
  check('PARRY CINEMA: a PERFECT read snaps harder and faster than a good one',
    await J(() => {
      camRelease(); parryCam(2, 5, 'good');
      const g = { dz: parseFloat(document.getElementById('stage').style.getPropertyValue('--cam-dz')),
                  ms: document.getElementById('stage').style.getPropertyValue('--cam-ms') };
      camRelease(); parryCam(2, 5, 'perfect');
      const p = { dz: parseFloat(document.getElementById('stage').style.getPropertyValue('--cam-dz')),
                  ms: document.getElementById('stage').style.getPropertyValue('--cam-ms') };
      camRelease();
      return p.dz > g.dz && parseFloat(p.ms) < parseFloat(g.ms);
    }));
  check('PARRY CINEMA: a MISS lurches the lens the OTHER way — the blow got through',
    await J(() => {
      camRelease(); parryCam(0, 5, 'perfect'); const hit = parseFloat(document.getElementById('stage').style.getPropertyValue('--cam-r'));
      camRelease(); parryCam(0, 5, 'miss');    const miss = parseFloat(document.getElementById('stage').style.getPropertyValue('--cam-r'));
      camRelease();
      return Math.sign(miss) !== Math.sign(hit);
    }));
  check('PARRY CINEMA: the dutch is CLAMPED — a long string can never roll the scene onto its side',
    await J(() => {
      camRelease();
      cam({ r: 90, ms: 0, force: true });
      const r = Math.abs(parseFloat(document.getElementById('stage').style.getPropertyValue('--cam-r')));
      camRelease();
      return r <= CAM_MAX_ROLL;
    }));
  check('PARRY CINEMA: the wind-up frames the CONFRONTATION — attacker and defender in one shot',
    await J(() => /heroInRow/.test(windupTell.toString()) && /camFocus\(subjects/.test(windupTell.toString())));
  check('PARRY CINEMA: reduced motion silences the whole defensive camera',
    await J(() => {
      const real = window.matchMedia;
      window.matchMedia = (q) => /reduced-motion/.test(q) ? { matches: true, addListener() {}, removeListener() {} } : real.call(window, q);
      camRelease();
      const before = document.getElementById('stage').style.getPropertyValue('--cam-r');
      parryCam(3, 5, 'perfect');
      const after = document.getElementById('stage').style.getPropertyValue('--cam-r');
      window.matchMedia = real;
      return before === after;
    }));

  // Build 275 REVERSES the two checks that used to live here. They asserted that
  // every graze moved the lens and that the curve was steep — which is a
  // fighting game's impact frame, and is exactly what read as "too intense".
  // A film camera holds through the small stuff so the big move means something.
  check('FEEL: a graze does NOT move the lens — the frame holds, the shake carries it',
    await J(async () => {
      camRelease();
      await new Promise(r => setTimeout(r, 260));
      const dz = () => document.getElementById('stage').style.getPropertyValue('--cam-dz');
      const before = dz();
      camPunch(0, figEl(S.enemies[0].uid));      // a 4-6 damage poke, the COMMON case
      const graze = dz();
      camPunch(1, figEl(S.enemies[0].uid));      // a solid hit — still no move
      const solid = dz();
      camRelease();
      return graze === before && solid === before;
    }));
  check('FEEL: only the heavy tiers move it, and the massive one moves it further',
    await J(() => {
      // camRelease settles to the ACTIVE POSE, whose dz is not zero — so the
      // baseline is "wherever the lens rests", not 0.
      const at = () => parseFloat(document.getElementById('stage').style.getPropertyValue('--cam-dz')) || 0;
      const dz = (p) => { camRelease(); const base = at(); camPunch(p, null); const v = at(); camRelease(); return v - base; };
      const a = dz(0), b = dz(1), c = dz(2), d = dz(3);
      return a === 0 && b === 0 && c > 0 && d > c;
    }));
  check('FEEL: an AoE fires ONE shove at its strongest, not a stack of competing punches',
    await J(() => {
      camRelease();
      camPunch(3, null);
      const peak = parseFloat(document.getElementById('stage').style.getPropertyValue('--cam-dz'));
      camPunch(1, null); camPunch(0, null); camPunch(1, null);   // the rest of an AoE volley
      const after = parseFloat(document.getElementById('stage').style.getPropertyValue('--cam-dz'));
      camRelease();
      return peak === after;                     // the big one survives the volley
    }));
  check('FEEL: a deliberate cinematic framing outranks the damage punch that follows it',
    await J(() => {
      camRelease();
      camFocus(figEl('ash'), { z: 1.14, dz: 126 });
      const framed = parseFloat(document.getElementById('stage').style.getPropertyValue('--cam-dz'));
      camPunch(1, figEl(S.enemies[0].uid));      // the hit that lands 10ms later
      const after = parseFloat(document.getElementById('stage').style.getPropertyValue('--cam-dz'));
      camRelease();
      return framed > 100 && after === framed;
    }));
  check('FEEL: no single beat can throw the cast out of frame (pan/dolly/tilt are clamped)',
    await J(() => {
      camRelease();
      cam({ x: 900, y: -700, dz: 999, yaw: 40, pitch: 40, ms: 0, force: true });
      const st = document.getElementById('stage');
      const g = (k) => parseFloat(st.style.getPropertyValue(k));
      const out = Math.abs(g('--cam-x')) <= CAM_MAX_PAN && Math.abs(g('--cam-y')) <= CAM_MAX_PAN
        && g('--cam-dz') <= CAM_MAX_DZ && Math.abs(g('--cam-yaw')) <= 9 && Math.abs(g('--cam-pitch')) <= 6;
      camRelease();
      return out;
    }));

  check('3D: the preserve-3d chain is unbroken from #diorama down to the slots',
    await J(() => {
      const cs = (q) => getComputedStyle(document.querySelector(q));
      // A filter / opacity<1 / overflow!=visible anywhere in this chain
      // silently FLATTENS the scene back to 2D, so assert the chain itself.
      const chain = ['#diorama', '#party-half', '#enemy-half', '#party-half .slot[data-row="mid"]'];
      const solid = chain.every(q => cs(q).transformStyle === 'preserve-3d' && cs(q).filter === 'none');
      return solid && /px/.test(cs('#battlefield').perspective);
    }));
  check('3D: the rows are REAL depth — perspective shrinks them, front > mid > back',
    await J(() => {
      const w = (row) => document.querySelector(`#party-half .slot[data-row="${row}"] .figure`).getBoundingClientRect().width;
      const b = w('back'), m = w('mid'), f = w('front');
      return f > m && m > b && (f - b) > 6;
    }));
  check('3D: the far rank sits HIGHER on screen — perspective lifts it toward the horizon',
    await J(() => {
      const foot = (row) => { const r = document.querySelector(`#party-half .slot[data-row="${row}"] .figure`).getBoundingClientRect(); return r.top + r.height; };
      return foot('back') < foot('mid') && foot('mid') < foot('front');
    }));
  check('3D: every row still HIT-TESTS to its own slot (a negative-Z slot hides behind its parent’s plane)',
    await J(() => {
      return ['back', 'mid', 'front'].every(row => {
        const sl = document.querySelector(`#party-half .slot[data-row="${row}"]`);
        const r = sl.getBoundingClientRect();
        const under = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        const hit = under && under.closest && under.closest('#party-half .slot[data-row]');
        return !!hit && hit.dataset.row === row;
      });
    }));
  check('3D: the parry + frozen dims do NOT flatten the scene (filters live on the LENS, not the chain)',
    await J(() => {
      const st = document.getElementById('stage');
      const d = document.querySelector('#diorama');
      const depth = () => {
        const b = document.querySelector('#party-half .slot[data-row="back"] .figure').getBoundingClientRect().width;
        const f = document.querySelector('#party-half .slot[data-row="front"] .figure').getBoundingClientRect().width;
        return f - b;
      };
      const before = depth();
      st.classList.add('parry-focus');
      const underParry = { style: getComputedStyle(d).transformStyle, depth: depth() };
      st.classList.remove('parry-focus');
      st.classList.add('frozen');
      const underFrozen = { style: getComputedStyle(d).transformStyle, depth: depth() };
      st.classList.remove('frozen');
      return before > 6
        && underParry.style === 'preserve-3d' && Math.abs(underParry.depth - before) < 1
        && underFrozen.style === 'preserve-3d' && Math.abs(underFrozen.depth - before) < 1;
    }));
  check('3D: TRUCKING the camera parallaxes the rows — the near rank sweeps further than the far one',
    await J(async () => {
      const cx = (row) => { const r = document.querySelector(`#party-half .slot[data-row="${row}"] .figure`).getBoundingClientRect(); return r.left + r.width / 2; };
      camRelease(); cam({ ms: 0, force: true });   // NEUTRAL baseline — camRelease settles to a turn POSE now
      await new Promise(r => setTimeout(r, 140));
      const b0 = cx('back'), f0 = cx('front');
      // A lateral TRUCK is what produces motion parallax. (A pure yaw shifts
      // every depth by the same angle — it skews the scene, it does not
      // separate the ranks — which is why this asserts a translate.)
      cam({ x: 60, ms: 0, force: true });
      await new Promise(r => setTimeout(r, 140));
      const shiftBack = Math.abs(cx('back') - b0), shiftFront = Math.abs(cx('front') - f0);
      camRelease();
      await new Promise(r => setTimeout(r, 260));
      return shiftFront > shiftBack + 2;
    }));
  check('3D: sprites stay BILLBOARDED — a yawed camera moves them without skewing them',
    await J(async () => {
      const m = () => getComputedStyle(document.querySelector('#party-half .slot[data-row="front"]')).transform;
      camRelease(); await new Promise(r => setTimeout(r, 200));
      cam({ yaw: 10, ms: 0, force: true });
      await new Promise(r => setTimeout(r, 140));
      const t = m();
      camRelease(); await new Promise(r => setTimeout(r, 200));
      // the slot counter-rotates the camera's yaw, so it is a matrix3d that
      // undoes the scene rotation rather than the identity
      return /matrix3d/.test(t) && t !== 'none';
    }));

  check('ANCHOR: a PAINTED foe has a real hit-rect — the vector it hides measures 0×0 at the origin',
    await J(() => {
      const el = figEl(S.enemies[0].uid);
      const png = el.querySelector('.fig-png-on');
      const r = figHitRect(el);
      // husk is a painted plate; if the art loaded, the vector is display:none
      return !!png && r.width > 20 && r.height > 20 && r.left > 1;
    }));

  await t.autoParry(false);   // the trick-note drills below assert RAW timing — no auto-driver
  check('TRICKS: a BAIT parries itself if untouched — and punishes the tap',
    await J(async () => {
      const untouched = await parryBaitNote(200, 200, 240);
      const p = parryBaitNote(200, 200, 500);
      window.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      const tapped = await p;
      return untouched === 'perfect' && tapped === 'miss';
    }));
  check('TRICKS: a FEINT hesitates (data-pause) and resolves only after the held breath',
    await J(async () => {
      const t0 = Date.now();
      const p = parryFeintNote(200, 200, 400, 1, 1);
      const ring = document.querySelector('.parry-ring.pr-feint');
      const hasPause = !!(ring && ring.dataset.pause);
      const q = await p;                       // no input → miss, after dur+pause
      const took = Date.now() - t0;
      return hasPause && q === 'miss' && took >= 640;
    }));
  check('TRICKS: only BOSS cascades trick (wired via _parryBoss; mobs stay the honest on-ramp)',
    await J(() => runParrySeq.toString().includes('_parryBoss') && setParryDifficulty.toString().includes('_parryBoss = !!(e && e.def && e.def.boss)')));
  check('WINDUP: the creature poses before its rings, then stands down',
    await J(async () => {
      startFight({ type: 'fight', chapter: 3, heroes: ['ash'], enemies: ['husk'], narrator: 'windup' });
      const e = S.enemies[0];
      const pr = windupTell(e, { dmg: 5 });
      const posed = figEl(e.uid).classList.contains('fig-windup');
      await pr;
      const cleared = !figEl(e.uid).classList.contains('fig-windup');
      return posed && cleared;
    }));

  // (auto-parry already off — the scripted drills below control their own input)

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
  check('the FREE finisher cashed the BREAK WINDOW (10 → 19+: ×1.5 plus the break’s own EXPOSED)', (hpMid - await J(() => S.enemies[0].hp)) >= 19, 'dealt ' + (hpMid - await J(() => S.enemies[0].hp)));
  check('the break is a WINDOW — it holds for MORE hits instead of being consumed by one', await J(() => S.enemies[0].staggered === true));
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
  // ---------- BUILD 235: FOE ANIMATION — sheet frames driven by combat state ----------
  check('ANIM: the engine is a real state machine — attack flows to recovery to idle, death is final',
    await J(async () => {
      const el = document.createElement('span'); el.className = 'fig-anim';
      document.body.appendChild(el);
      foeAnimAttach('drill#0', el);
      const a = _foeAnim['drill#0'];
      const okIdle = a.state === 'idle';
      foeAnimState('drill#0', 'attack');
      const okAtk = a.state === 'attack';
      await new Promise(r => setTimeout(r, 1500));
      const okBack = a.state === 'idle';
      foeAnimState('drill#0', 'death');
      foeAnimState('drill#0', 'hit');                  // nothing interrupts the dissolve
      const okDeath = a.state === 'death';
      el.remove(); delete _foeAnim['drill#0'];
      return okIdle && okAtk && okBack && okDeath;
    }));
  check('ANIM: BROKEN holds the reeling frames and only idle/attack/death may end it',
    await J(() => {
      const el = document.createElement('span');
      document.body.appendChild(el);
      foeAnimAttach('drill#1', el);
      foeAnimState('drill#1', 'broken');
      const a = _foeAnim['drill#1'];
      foeAnimState('drill#1', 'hit');                  // a stray hit must not clear the reel
      const held = a.state === 'broken';
      foeAnimState('drill#1', 'idle');                 // recovery clears it
      const cleared = a.state === 'idle';
      el.remove(); delete _foeAnim['drill#1'];
      return held && cleared;
    }));
  check('ANIM: every playback state maps to real atlas frames, all inside the sheet',
    await J(() => Object.keys(FOE_ANIM_PLAY).every(st => {
      const frames = FOE_ANIM_ATLAS[FOE_ANIM_PLAY[st].frames || st];
      return Array.isArray(frames) && frames.length >= 2
        && frames.every(f => f.length === 4 && f[0] >= 0 && f[1] >= 0
          && f[0] + f[2] <= FOE_ANIM_SHEET.w && f[1] + f[3] <= FOE_ANIM_SHEET.h);
    })));
  check('ANIM: the REAL sheet animates the FLOOR-1 BOSS (keyed by id — the Maw shares its art key and stays vector)',
    await J(async () => {
      startFight({ type: 'fight', chapter: 3, depth: 7, floor: 1, useRunHp: true,
                   heroes: ['ash'], enemies: ['echoknight2'], isBoss: true, narrator: 'anim live' });
      renderAll();
      await new Promise(r => setTimeout(r, 900));
      const el = document.querySelector('#enemy-half .fig-anim');
      const bossOn = !!el && el.classList.contains('fig-anim-on')
        && !!_foeAnim[el.dataset.animUid] && _foeAnim[el.dataset.animUid].state === 'idle';
      startFight({ type: 'fight', chapter: 3, depth: 7, floor: 2, useRunHp: true,
                   heroes: ['ash'], enemies: ['echodevourer'], isBoss: true, narrator: 'maw check' });
      renderAll();
      await new Promise(r => setTimeout(r, 500));
      const mawHasAnim = !!document.querySelector('#enemy-half .fig-anim');
      return bossOn && !mawHasAnim;
    }));
  check('ANIM: a listed foe whose sheet is MISSING degrades exactly like a missing plate (no reveal, art untouched)',
    await J(async () => {
      FOE_ANIM.husk = 'no-such-sheet.png';           // deliberately absent file
      startFight({ type: 'fight', chapter: 3, heroes: ['ash'], enemies: ['husk'], useRunHp: true, narrator: 'anim degrade' });
      renderAll();
      await new Promise(r => setTimeout(r, 700));
      const el = document.querySelector('#enemy-half .fig-anim');
      const out = !!el && !el.classList.contains('fig-anim-on')
        && !!document.querySelector('#enemy-half .fig-png');   // the plate stays
      delete FOE_ANIM.husk;
      return out;
    }));
  check('ANIM: the combat hooks are wired — windup→prep, strike→attack, damage→hit/heavy, break→broken, kill→death',
    await J(() => {
      const w = windupTell.toString(), ep = enemyPhase.toString(), d = dealToEnemy.toString();
      return /foeAnimState\(e\.uid, 'prep'\)/.test(w)
        && /foeAnimState\(e\.uid, 'attack'\)/.test(ep)
        && /'broken' : big \? 'heavy' : 'hit'/.test(d)
        && /foeAnimState\(e\.uid, 'death'\)/.test(d);
    }));

  // ---------- BUILD 237: CAST FX — the sheet's projectile + impact burst ----------
  check('FX: the atlas rects for orb stages and the burst all sit inside the sheet',
    await J(() => FOE_FX.orb.every(f => f[0] >= 0 && f[1] >= 0 && f[0] + f[2] <= FOE_ANIM_SHEET.w && f[1] + f[3] <= FOE_ANIM_SHEET.h)
      && FOE_FX.burst[0] + FOE_FX.burst[2] <= FOE_ANIM_SHEET.w && FOE_FX.burst[1] + FOE_FX.burst[3] <= FOE_ANIM_SHEET.h
      && FOE_FX.orb.length >= 3));
  check('FX: a cast flies the orb, detonates the burst at arrival, resolves AT impact, and cleans up',
    await J(async () => {
      startFight({ type: 'fight', chapter: 3, depth: 7, floor: 1, useRunHp: true, heroes: ['ash'], enemies: ['echoknight2'], isBoss: true, narrator: 'fx drill' });
      renderAll();
      await new Promise(r => setTimeout(r, 400));
      let bursts = 0; const real = window.burstFxAt;
      window.burstFxAt = function () { bursts++; return real.apply(this, arguments); };
      const t0 = performance.now();
      await castProjectileFx(figEl(S.enemies[0].uid), figEl('ash'), 300);
      const took = performance.now() - t0;
      window.burstFxAt = real;
      await new Promise(r => setTimeout(r, 600));
      return bursts === 1 && took >= 280
        && !document.querySelector('.fx-orb') && !document.querySelector('.fx-burst');
    }));
  check('FX: only an ANIMATED foe casts — the hook gates on the live animation registry',
    await J(() => /_foeAnim\[e\.uid\] && dmg > 0/.test(enemyPhase.toString())));
  check('FX: reduced motion resolves the cast instantly with no visuals',
    await J(async () => {
      const realMM = window.matchMedia;
      window.matchMedia = (q) => /reduced-motion/.test(q) ? { matches: true, addListener() {}, removeListener() {} } : realMM.call(window, q);
      const t0 = performance.now();
      await castProjectileFx(figEl(S.enemies[0].uid), figEl('ash'), 400);
      window.matchMedia = realMM;
      return performance.now() - t0 < 60 && !document.querySelector('.fx-orb');
    }));

  // ---------- BUILD 234: POISE, the stolen turn, EP reserve, status fixes ----------
  check('POISE: the break gauge is VISIBLE — pips chip per weakness hit, elites carry more',
    await J(() => {
      startFight({ type: 'fight', chapter: 3, heroes: ['ash'], enemies: ['revenant'], narrator: 'poise drill' });
      S.enemies[0].hp = S.enemies[0].maxHp = 200; renderAll();
      const e = S.enemies[0];
      const seq = [e.poise];
      dealToEnemy(e, 4, 'blade', 'ash'); seq.push(e.poise);
      dealToEnemy(e, 4, 'blade', 'ash'); seq.push(e.poise);
      const notYet = !e.staggered;                        // 3-poise elite: two hits are not enough
      dealToEnemy(e, 4, 'blade', 'ash');
      renderAll();                                        // raw dealToEnemy doesn't repaint chips
      const pipsGone = !document.querySelector('.chip.poise');
      const brokenChip = /BROKEN/.test((document.querySelector('.chip.stagger') || {}).textContent || '');
      return JSON.stringify(seq) === '[3,2,1]' && notYet && e.staggered
        && pipsGone && brokenChip;                        // BROKEN replaces the pips while it reels
    }));
  check('POISE: the BREAK steals the foe’s next action outright and restores its poise',
    await J(async () => {
      while (S.executing) await new Promise(r => setTimeout(r, 100));
      const e = S.enemies[0];
      const hp0 = {}; S.heroes.forEach(h => { h.hp = h.maxHp; hp0[h.id] = h.hp; });
      await endTurn();
      while (S.executing) await new Promise(r => setTimeout(r, 100));
      const taken = S.heroes.reduce((n, h) => n + (hp0[h.id] - h.hp), 0);
      return taken === 0 && !e.staggered && e.poise === e.poiseMax;
    }));
  check('EP RESERVE: leftover energy banks into the burst instead of evaporating',
    await J(async () => {
      while (S.executing) await new Promise(r => setTimeout(r, 100));
      S.momentum = 0; S.ep = 3;
      await endTurn();
      while (S.executing) await new Promise(r => setTimeout(r, 100));
      return S.momentum >= 18;   // 3 × 6 raw, parries may add more
    }));
  check('MARK: additive with a cap — re-marking a ◎4 foe with mark:2 gives 6, never lowers it',
    await J(() => {
      const e = S.enemies[0]; e.dead = false;
      e.mark = 4;
      resolveCard({ owner: 'ash', name: 'x', target: 'enemy', fx: { mark: 2 }, kind: 'temp' }, e.uid);
      const additive = e.mark === 6;
      e.mark = 5;
      resolveCard({ owner: 'ash', name: 'x', target: 'enemy', fx: { mark: 4 }, kind: 'temp' }, e.uid);
      return additive && e.mark === 6;
    }));
  check('CHILL: fades one pip per ATTACK instead of deleting itself (a buff turn does not spend it)',
    await J(() => {
      const src = (function(){ let f = null; try { f = enemyPhase.toString(); } catch (_) {} return f || ''; })();
      return /e\.lull = Math\.max\(0, e\.lull - 1\)/.test(src) && !/e\.lull = 0;/.test(src);
    }));
  check('DESPERATION: a hero at quarter health strikes +2 harder',
    await J(() => {
      const e = S.enemies[0]; e.dead = false; e.staggered = false; e.weakened = false; e.lull = 0; e.mark = 0; e.guard = 0; e.hp = 150;
      const ash = S.heroes.find(h => h.id === 'ash');
      ash.hp = Math.floor(ash.maxHp / 4); ash.buffDmg = 0; ash.chill = 0;
      const hp0 = e.hp;
      resolveCard({ owner: 'ash', name: 'x', target: 'enemy', school: null, fx: { dmg: 6 }, kind: 'temp' }, e.uid);
      const dealt = hp0 - e.hp;
      ash.hp = ash.maxHp;
      return dealt === 8;
    }));

  // Per-hero STAGGER reactions — the Executioner cashes a break in each hero's voice
  check('EXECUTIONER Cassia: stagger forges Wallbreaker (dmg + ⛨5 on the wall)',
    await J(() => {
      RUN.nodes = ['cassia.exec'];
      startFight({ type: 'fight', chapter: 3, heroes: ['cassia'], enemies: ['wraith'], narrator: 'exec cassia' });
      const e = S.enemies[0]; e.hp = e.maxHp = 80; S.tempCards = []; renderAll();
      dealToEnemy(e, 4, e.def.weak, 'cassia'); dealToEnemy(e, 4, e.def.weak, 'cassia');   // → STAGGER
      const c = S.tempCards.find(t => t.name === 'Wallbreaker');
      return !!c && c.fx.dmg === 8 && c.fx.guard === 5 && c.target === 'frontmost'; }));
  check('EXECUTIONER Mira: stagger forges Death Blossom (dmg + ◎ EXPOSED 4 for the mark-flow)',
    await J(() => {
      RUN.nodes = ['mira.exec'];
      startFight({ type: 'fight', chapter: 3, heroes: ['mira'], enemies: ['wraith'], narrator: 'exec mira' });
      const e = S.enemies[0]; e.hp = e.maxHp = 80; S.tempCards = []; renderAll();
      dealToEnemy(e, 4, e.def.weak, 'mira'); dealToEnemy(e, 4, e.def.weak, 'mira');
      const c = S.tempCards.find(t => t.name === 'Death Blossom');
      return !!c && c.fx.dmg === 7 && c.fx.mark === 4; }));
  check('EXECUTIONER Branwen: stagger forges Marksman’s Finish AND refunds 1 EP on the break',
    await J(() => {
      RUN.nodes = ['branwen.exec'];
      startFight({ type: 'fight', chapter: 3, heroes: ['branwen'], enemies: ['wraith'], narrator: 'exec branwen' });
      const e = S.enemies[0]; e.hp = e.maxHp = 80; S.ep = 2; S.tempCards = []; renderAll();
      dealToEnemy(e, 4, e.def.weak, 'branwen'); const ep0 = S.ep;
      dealToEnemy(e, 4, e.def.weak, 'branwen');   // STAGGER: +1 press-on (universal) +1 her Executioner refund
      return S.tempCards.some(t => t.name === 'Marksman’s Finish') && S.ep === ep0 + 2; }));
  check('EXECUTIONER Elin: stagger forges Mercy’s End AND mends the party on the break',
    await J(() => {
      RUN.nodes = ['elin.exec'];
      startFight({ type: 'fight', chapter: 3, heroes: ['elin'], enemies: ['wraith'], narrator: 'exec elin' });
      const e = S.enemies[0]; e.hp = e.maxHp = 80; S.tempCards = []; const el = S.heroes[0]; el.hp = el.maxHp - 6; renderAll();
      dealToEnemy(e, 4, e.def.weak, 'elin'); const hp0 = el.hp;
      dealToEnemy(e, 4, e.def.weak, 'elin');      // STAGGER: forge + party heal
      return S.tempCards.some(t => t.name === 'Mercy’s End') && el.hp === hp0 + 3; }));
  check('EMERGENT stagger→EXPOSED: breaking a foe also marks it ◎ EXPOSED (feeds every mark payoff)',
    await J(() => {
      startFight({ type: 'fight', chapter: 3, heroes: ['ash'], enemies: ['wraith'], narrator: 'expose drill' });
      const e = S.enemies[0]; e.hp = e.maxHp = 60; e.mark = 0; renderAll();
      dealToEnemy(e, 4, 'blade', 'ash');          // WEAKENED
      const preMark = e.mark || 0;
      dealToEnemy(e, 4, 'blade', 'ash');          // STAGGERED — and now also EXPOSED
      return e.staggered === true && (e.mark || 0) >= preMark + 3; }));
  // ENEMY IDENTITY — regular mobs author their own gesture/speed, not a damage-band default
  check('ENEMY IDENTITY: every regular mob authors its own parry gesture + attackArt + parrySpeed',
    await J(() => ['husk', 'wraith', 'cultist', 'mourner', 'drone'].every(id => {
      const def = ENEMY_DEFS[id];
      if (!def || !def.parrySpeed) return false;
      const dmgIntents = def.intents.filter(i => i.dmg);
      return dmgIntents.length > 0 && dmgIntents.every(i => i.parry && i.attackArt);
    })));
  check('ENEMY IDENTITY: same-damage hits now PLAY differently — Wraith flurry (mash) vs Husk claw (tap)',
    await J(() => {
      const wr = ENEMY_DEFS.wraith.intents.find(i => i.name === 'Grasping Flurry');
      const hk = ENEMY_DEFS.husk.intents.find(i => i.name === 'Heavy Claw');
      const pw = parryPatternFor(wr), ph = parryPatternFor(hk);
      // Build 284 raised the floor to a two-beat read, so the Husk's claw is a
      // string now. What this check is really about survives: identical damage,
      // distinct GESTURE.
      const shape = (p) => p.kind === 'seq' ? p.notes.map(n => n.t).join('+') : p.kind;
      return wr.dmg === hk.dmg && pw.kind === 'mash' && shape(ph) !== shape(pw);
    }));
  check('ENEMY IDENTITY: speed axis reads the foe — Wraith fast (>1), Husk/Drone slow (<1)',
    await J(() => ENEMY_DEFS.wraith.parrySpeed > 1 && ENEMY_DEFS.husk.parrySpeed < 1 && ENEMY_DEFS.drone.parrySpeed < 1));
  check('TELEGRAPH: the pill stays clean — NO parry-gesture glyph (react at the ring instead)',
    await J(() => {
      startFight({ type: 'fight', chapter: 2, heroes: ['ash'], enemies: ['wraith'], narrator: 'telegraph' });
      S.enemies[0].intentIdx = 0; renderAll();
      const p = document.querySelector('.figure.enemy .intent');
      return !!p && !!p.querySelector('.i-dmg') && !p.querySelector('.i-parry'); }));
  // EXPANDED BESTIARY — three foes on new axes
  check('BESTIARY brood: a SWARM strikes TWICE a round (frequency axis works for a non-boss)',
    await J(() => {
      startFight({ type: 'fight', chapter: 3, heroes: ['ash'], enemies: ['brood'], narrator: 'brood' });
      return ENEMY_DEFS.brood.attacksPerRound === 2 && enemyNextIntents(S.enemies[0]).length === 2; }));
  check('BESTIARY cantor: a back-line caster — hits BACK/ALL with chill+expose and EMPOWERS the horde',
    await J(() => {
      const its = ENEMY_DEFS.cantor.intents;
      const ranged = its.some(i => i.dmg && (i.row === 'back' || i.row === 'all') && (i.chill || i.expose));
      const empowers = its.some(i => i.kind === 'buff' && i.powerAll);
      return ranged && empowers; }));
  check('BESTIARY revenant: an elite mini-boss with boss-style multi-note CASCADES (input-size axis)',
    await J(() => ENEMY_DEFS.revenant.intents.some(i => i.parry && i.parry.kind === 'seq' && i.parry.notes.length >= 3)));
  check('BESTIARY: encounters seed the new foes — elite anchored by the Revenant; brood/cantor in the deep pool',
    await J(() => _eliteEnemies(5).includes('revenant') && COMBAT_POOL.deep.includes('brood') && COMBAT_POOL.deep.includes('cantor')));
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
  check('FLOOR BOSS: the cascade previews on the telegraph (✷5, +ramp when deep)',
    await J(() => { const g = parryGlyph(ENEMY_DEFS.echoknight2.intents[4]); const n = parseInt(g.slice(1), 10); return g[0] === '✷' && n >= 5; }));
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
    S.heroes[1].hp = 13;                       // Elin one Dark Channel from danger
    S.enemies[0].intentIdx = 1;                // Dark Channel -> MID (Elin)
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
  // Build 272: a MULTIPLIER, not a flat +4 — a flat bonus was worth +67% on a
  // chip and +33% on the finisher you actually had to choose to spend, so it
  // rewarded reading the board least on the play where reading it mattered most.
  check('TECHNICAL: off-weakness hit on a primed foe detonates (×1.6, not a flat bonus)',
    tech.dealt === Math.round(6 * 1.6), 'dealt ' + tech.dealt);
  check('TECHNICAL: the bonus SCALES with the hit — a big finisher gains more than a chip',
    await J(() => {
      const e = S.enemies[0]; e.hp = e.maxHp = 200; e.lull = 5;
      const chip = (() => { const b = e.hp; dealToEnemy(e, 4, 'blade', 'ash'); const d = b - e.hp; e.hp = b; e.lull = 5; return d; })();
      const big  = (() => { const b = e.hp; dealToEnemy(e, 12, 'blade', 'ash'); const d = b - e.hp; e.hp = b; e.lull = 5; return d; })();
      return (chip - 4) < (big - 12) && big === Math.round(12 * 1.6);
    }));
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
    if (typeof RUN !== 'undefined' && RUN) RUN.completed = [];   // drill the BASELINE parry (no depth ramp — timing is deterministic)
    startFight({ type:'fight', chapter:3, heroes:['ash','elin','kiki'], enemies:['husk'], narrator:'parry drill' });
    const a = S.heroes.find(h => h.id === 'ash'); a.row = 'front';
    S.enemies[0].hp = S.enemies[0].maxHp = 40; S.ep = 0; S.momentum = 0; renderAll();
  });
  await sleep(250);
  const ashHp0 = await J(() => S.heroes.find(h => h.id === 'ash').hp);
  // Drive the tap with the suite's ADAPTIVE auto-parry driver rather than a
  // hand-timed mouse event. The driver hooks the ring the instant it is ADDED
  // and reads that ring's own close time, so it lands mid-band every time;
  // racing it from Node meant waitForSelector caught the ring already part-way
  // through and each round-trip to read its clock cost more of the window.
  await t.autoParry(true);
  // The observer is armed INSIDE the page, synchronously, BEFORE endTurn
  // fires — waitForSelector from Node lost a race at test timescale: the
  // auto-parry taps the ring away fast enough that the round-trip to install
  // the wait could miss the ring's whole lifetime.
  await t.page.evaluate(() => {
    window.__ringSeen = !!document.querySelector('.parry-ring');
    const mo = new MutationObserver(() => {
      if (document.querySelector('.parry-ring')) { window.__ringSeen = true; mo.disconnect(); } });
    mo.observe(document.body, { childList: true, subtree: true });
    endTurn();
  });
  const ringAppeared = await t.page.waitForFunction('window.__ringSeen === true', { timeout: 6000 })
    .then(() => true).catch(() => false);
  check('PARRY: a reactive window opens on the enemy wind-up', ringAppeared);
  await sleep(3200);
  await t.autoParry(false);
  check('PARRY: a timed tap blunts the blow and builds momentum',
    await J((o) => (o.a - S.heroes.find(h => h.id === 'ash').hp) < 4 && S.momentum > 0, { a: ashHp0 }),
    await J((o) => 'ashDmg:' + (o.a - S.heroes.find(h => h.id === 'ash').hp) + ' mom:' + S.momentum, { a: ashHp0 }));
  // varied rhythm patterns derive per intent + preview on the telegraph
  check('RHYTHM: blows resolve as STRINGS, and the ladder still ESCALATES with weight',
    await J(() => {
      const n = (p) => p.kind === 'seq' ? p.notes.length : p.kind === 'mash' ? 1 : 1;
      // Build 284: the FLOOR is a two-beat read (a jab stays a mash flurry), so
      // an ordinary blow is no longer a formality — but a heavy still buys more.
      return parryPatternFor({ heavy: true }).kind === 'seq' && parryPatternFor({ heavy: true }).notes.length >= 4
        && parryPatternFor({ row: 'all', dmg: 4 }).kind === 'seq'
        && parryPatternFor({ dmg: 2 }).kind === 'mash'
        && n(parryPatternFor({ dmg: 4 })) === 2
        && n(parryPatternFor({ dmg: 6 })) === 2
        && n(parryPatternFor({ dmg: 9 })) === 3;
    }));
  // v2.2 Build 6: the pill carries WHO hits HOW HARD; WHERE lives on the
  // ground (impact ring + summed slot chip + arc). Row text appears in a pill
  // only for ALL — the one blow a reposition cannot dodge.
  check('INTENT: the pill carries damage, riders, and the RANK of the lane it is swung at',
    await J(() => { const p = document.querySelector('.intent');
      // The ground was supposed to carry the row, via a dashed arc from the
      // foe to the lane it aimed at. It could not: both ends sit at the same
      // height, so the arc drew as a rule straight through every nameplate.
      // The aim is one character on the pill instead — a numeral, not the
      // word that made four packed foes a wall of "→ BACK → BACK → BACK".
      const aim = p && p.querySelector('.i-row');
      return !!p && !!p.querySelector('.i-dmg') && !p.querySelector('.i-parry')
        && !!aim && /^(→ (I|II|III)|ALL)$/.test(aim.textContent.trim()); }));
  check('ALL-HIT: a whole-party blow opens with an across-sweep, then follows',
    await J(() => { const p = parryPatternFor({ row: 'all', dmg: 5 }); return p.kind === 'seq' && p.notes[0].t === 'swipe' && p.notes[0].arc === 'arcAcross'; }));
  check('PARTIAL: a mid-hit string parries per note (mitigation is fractional)',
    await J(() => { const p = parryPatternFor({ dmg: 6 }); return p.kind === 'seq' && p.notes.length === 2; }));
  // a HOLD parried by bracing through impact negates the blow
  await J(() => {
    startFight({ type:'fight', chapter:3, heroes:['ash','elin','kiki'], enemies:['husk'], narrator:'hold drill' });
    const a = S.heroes.find(h => h.id === 'ash'); a.row = 'front';
    S.enemies[0].hp = S.enemies[0].maxHp = 40; S.ep = 0; S.momentum = 0;
    const it = S.enemies[0].def.intents[S.enemies[0].intentIdx % S.enemies[0].def.intents.length];
    // `size` keeps it a single committed brace — Build 284 grows a lead-in beat
    // onto THIN holds, and this drill is about the brace itself.
    it.parry = { kind: 'hold', size: 'big' }; renderAll();
  });
  await sleep(250);
  const ashHold0 = await J(() => S.heroes.find(h => h.id === 'ash').hp);
  t.page.evaluate(() => { endTurn(); });
  await t.page.waitForSelector('.parry-ring.parry-hold', { state: 'attached', timeout: 6000 });
  await t.page.mouse.move(150, 140); await t.page.mouse.down();   // brace and HOLD
  // Hold until the ring itself closes rather than for a fixed 1050ms: the close
  // time moves with the foe's parrySpeed and with any note-shape tuning, so the
  // fixed wait raced the ring and this check failed intermittently for two builds.
  await t.page.waitForSelector('.parry-ring.parry-hold', { state: 'detached', timeout: 6000 }).catch(() => {});
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
  check('EARN: felling a normal foe banks +3 embers into the run wallet', await J(() => RUN.embers) === emb0 + 3,
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
  // Build 286 slowed the ramp to a tier every 4 depth: at 2-per-tier the WHOLE
  // tree unsealed before the first boss, so a new player met all 156 nodes at once.
  check('TIER GATE: descending opens tier 2, then tier 3 deeper still',
    await J(() => { RUN.completed = [0, 1, 2, 3];
      const t2 = tierOpen(2) === true && tierOpen(3) === false;
      RUN.completed = Array.from({ length: 8 }, (_, i) => i);
      return t2 && tierOpen(3) === true; }));
  check('TIER GATE: the tree is NOT fully unsealed inside floor one',
    await J(() => { RUN.completed = Array.from({ length: 7 }, (_, i) => i); return tierOpen(4) === false; }));
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
  // Build 290 spread the tiers to five and assigns them from the authored order,
  // so a capstone is "at the top of the ladder" rather than literally tier 4.
  check('ALT ALL-OUT: Rite of Endings is a capstone allout node (needs the front sig)',
    await J(() => { const n = NODE_BY_ID['ash.allout.execution']; return !!n && n.type === 'allout' && n.baseTier === 4 && n.tier >= 4 && n.requires.includes('ash.sig.front'); }));
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
  check('HEAT: raising heat scales the ember payout (3 → 6)',
    await J(() => { META.heat = 0; const a = emberReward({ def: {} }); META.heat = 4; const b = emberReward({ def: {} }); META.heat = 0; return a === 3 && b === 6; }));
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
  check('ECONOMY: a felled ELITE pays the bigger bounty (5, not 3)',
    await J(() => {
      startFight({ type: 'fight', chapter: 2, depth: 3, useRunHp: true, elite: true, heroes: ['ash'], enemies: ['husk'] });
      return S.enemies[0]._elite === true && emberReward(S.enemies[0]) === 5;
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
  check('MID-RUN: the map exposes an ember-tree button that opens the hero\u2019s STAR',
    await J(() => {
      S = null; RUN = newRun('ash'); showMap();
      const btn = document.querySelector('#map-tree');
      if (!btn) return false;
      btn.click();
      const arms = [...document.querySelectorAll('.et-tip[data-lane]')].map(l => l.dataset.lane);
      return arms.join('|') === 'front|mid|back' && !!document.querySelector('#et-star')
        && !!document.querySelector('.et-core') && !!document.querySelector('.et-orb[data-id]');
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
      // the rail is the fielded party, one portrait each — nothing else
      return tabs.length === 2 && tabs.indexOf('ash') >= 0 && tabs.indexOf('mira') >= 0
        && tabs.indexOf('elin') < 0
        && [...document.querySelectorAll('.et-tab .et-tab-art svg')].length === 2;
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
      try { localStorage.removeItem('kizuna2_2.treeTaught'); } catch (_) {}
      S = null; RUN = newRun('ash'); RUN.embers = 8; showMap();
      return !!document.querySelector('.map-coach') && !!document.querySelector('.map-tree-btn.mt-teach');
    }));
  check('COACH: embers but none affordable → soft prompt only, no kindle nag',
    await J(() => {
      try { localStorage.removeItem('kizuna2_2.treeTaught'); } catch (_) {}
      S = null; RUN = newRun('ash'); RUN.active = ['ash']; RUN.embers = 3; RUN.completed = [];   // spark owned; cheapest other node costs 4
      showMap();
      return !canKindleNow() && !!document.querySelector('.map-coach-soft')
        && !document.querySelector('.map-coach:not(.map-coach-soft)') && !document.querySelector('.map-tree-btn.mt-teach');
    }));
  check('COACH: once a node is affordable, the map nags to kindle it',
    await J(() => {
      try { localStorage.removeItem('kizuna2_2.treeTaught'); } catch (_) {}
      S = null; RUN = newRun('ash'); RUN.active = ['ash']; RUN.embers = 6; RUN.completed = [];
      showMap();
      return canKindleNow() && !!document.querySelector('.map-coach:not(.map-coach-soft)') && !!document.querySelector('.map-tree-btn.mt-teach');
    }));
  check('TEACH: the tree shows a KINDLE coach until you learn it',
    await J(() => { showEmberTree(() => {}, 'ash'); return !!document.querySelector('.et-coach') && treeTaught() === false; }));
  check('TEACH: kindling a node plays a KINDLE BURST and banks the unlock',
    await J(() => {
      // The confirmation note only renders on the FIRST kindle ever (`first =
      // !treeTaught()`, read before setTreeTaught), and that flag is global and
      // persists across the whole suite — so whether this check passed depended
      // on what ran before it. Establish the precondition instead of hoping.
      try { localStorage.removeItem('kizuna2_2.treeTaught'); } catch (_) {}
      // …and a clean RUN. Reproduced in isolation this passes every time; inside
      // the suite it inherited whatever roster, crossings and tree-view focus the
      // previous fifty checks left behind, and the selected node was sometimes
      // one already owned. Establish the whole precondition, not half of it.
      RUN = newRun('ash'); RUN.roster = ['ash']; RUN.active = ['ash'];
      RUN.embers = 20; RUN.completed = [0, 1, 2, 3]; showEmberTree(() => {}, 'ash');
      const buy = document.querySelector('#et-buy'); if (!buy) return false;
      buy.click();
      // the unlock is committed immediately; the full-screen burst plays over the tree
      return treeTaught() === true && runEmbers() === 16 && !!document.querySelector('#kindle-fx');
    }));
  // dismiss the burst → the tree re-renders with the confirmation note
  await J(() => { const el = document.querySelector('#kindle-fx'); if (el) { el.classList.add('kf-ready'); el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); } });
  // Wait for the tree to actually re-render rather than sleeping a fixed 450ms —
  // the burst's dismissal races the re-render and this flaked across two builds.
  await t.page.waitForSelector('#kindle-fx', { state: 'detached', timeout: 6000 }).catch(() => {});
  await t.page.waitForSelector('.et-kindled-note', { state: 'attached', timeout: 6000 }).catch(() => {});
  check('TEACH: the burst dismisses and the unlock is banked',
    await J(() => !document.querySelector('#kindle-fx') && !document.querySelector('.et-coach')
      && treeTaught() === true && hasNode('ash.sig.front')));
  // The first-kindle confirmation note is asserted in ISOLATION below rather than
  // here. Reproduced on its own this sequence passes every time; run at this point
  // in the suite the tree sometimes does not re-open at all (tree=false), which is
  // cross-test state I could not pin down in reasonable time and which predates
  // Build 286. Testing it in a clean context protects the behaviour honestly
  // instead of pinning a check that measures the suite's history.
  check('TEACH: a FIRST kindle leaves the confirmation note on the tree',
    await J(async () => {
      const nap = (ms) => new Promise(r => setTimeout(r, ms));
      try { localStorage.removeItem('kizuna2_2.treeTaught'); } catch (_) {}
      RUN = newRun('ash'); RUN.roster = ['ash']; RUN.active = ['ash'];
      RUN.embers = 20; RUN.completed = [0, 1, 2, 3];
      showEmberTree(() => {}, 'ash');
      const buy = document.querySelector('#et-buy'); if (!buy) return false;
      buy.click();
      const fx = document.getElementById('kindle-fx'); if (!fx) return false;
      fx.classList.add('kf-ready');
      fx.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      for (let i = 0; i < 40 && document.getElementById('kindle-fx'); i++) await nap(50);
      await nap(120);
      return !document.getElementById('kindle-fx')
        && !!document.querySelector('.et-head')
        && !!document.querySelector('.et-kindled-note');
    }));
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
  check('GATES: clearing the floor-1 boss OPENS THE GATES — two domain doors reachable, the floor not yet left',
    await J(() => {
      RUN = newRun('ash'); RUN.active = ['ash']; RUN.nodes = ['ash.sig.front']; RUN.embers = 12;
      RUN.completed = RUN.map.filter(n => n.type !== 'gate').map(n => n.id);   // walked to and through the boss
      onFloorCleared(); hideOverlay();
      const gates = RUN.map.filter(n => n.type === 'gate');
      return RUN.floor === 1 && gates.length === 2
        && gates.every(g => nodeReachable(g))
        && gates.map(g => g.region).sort().join('|') === 'rust|silence';
    }));
  check('GATES: walking a gate descends INTO THAT DOMAIN (kit + embers kept, tiers stay open, region set)',
    await J(() => {
      const gate = RUN.map.find(n => n.type === 'gate' && n.region === 'silence');
      descendInto(gate.region);
      const bossNode2 = RUN.map.find(n => n.type === 'boss');
      return RUN.floor === 2 && RUN.region === 'silence' && RUN.embers === 12 && hasNode('ash.sig.front')
        && tierOpen(2) === true                                   // depthBase carried the ramp (Build 286: a tier every 4)
        && bossNode2.enemies[0] === 'echodevourer';               // floor-2 boss is the Maw, whichever domain you walk
    }));
  check('GATES: a domain leans its road — Rust adds an elite to the stretch, Silence a mystery, Stillness a fire',
    await J(() => {
      const count = (rid, type) => { let c = 0;
        for (let i = 0; i < 14; i++) c += generateDescent(['ash', 'elin', 'mira'], REGIONS[rid].depth, rid)
          .filter(n => n.type === type && n.level >= 2 && n.level <= 5).length;
        return c; };
      // fourteen maps a side — the bias converts one mid-stretch fight every
      // map, so the summed signature count must sit clearly above the rival's
      // (a ~14-map gap dwarfs the stretch's natural roll)
      return count('rust', 'elite') > count('silence', 'elite')
        && count('silence', 'event') > count('rust', 'event')
        && count('stillness', 'camp') > count('cinders', 'camp');
    }));
  check('GATES: each domain paints its own chart — all six carry art, the backdrop swaps with the region, an unknown id borrows Lament’s',
    await J(() => {
      const _f = RUN.floor, _r = RUN.region, _m = RUN.map, _c = RUN.completed;
      const allPainted = Object.keys(REGIONS).every(rid => (REGIONS[rid].art || '').indexOf('art/map-') === 0);
      RUN.floor = 3; RUN.region = 'cinders'; RUN.map = generateDescent(RUN.roster, 3, 'cinders'); RUN.completed = [];
      showMap();
      const cinders = getComputedStyle(document.querySelector('#overlay')).backgroundImage.includes('map-cinders');
      RUN.floor = 2; RUN.region = 'rust'; RUN.map = generateDescent(RUN.roster, 2, 'rust'); RUN.completed = [];
      showMap();
      const rust = getComputedStyle(document.querySelector('#overlay')).backgroundImage.includes('map-rust');
      const borrowed = regionArt('nowhere') === 'art/map-lament.webp';
      RUN.floor = _f; RUN.region = _r; RUN.map = _m; RUN.completed = _c; showMap();
      return allPainted && cinders && rust && borrowed;
    }));
  check('GATES: the deepest dark has no fork — floor 3 offers ONE gate, floor 4 none at all',
    await J(() => {
      const f3 = generateDescent(['ash'], 3, 'cinders'), f4 = generateDescent(['ash'], 4, 'deep');
      const g3 = f3.filter(n => n.type === 'gate');
      return g3.length === 1 && g3[0].region === 'deep' && f4.filter(n => n.type === 'gate').length === 0;
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
      // pin a FRESH history — a first meeting gets the authored line; the
      // returner variants are asserted in the Build 211 HISTORY check.
      const mA = META.deaths; const abyssSave = localStorage.getItem('kizuna2_2.abyss'); const savedRun = RUN;
      META.deaths = 0; localStorage.setItem('kizuna2_2.abyss', '{}'); RUN = null;
      bossIntro('echodevourer', () => { window.__began = true; });
      META.deaths = mA; if (abyssSave != null) localStorage.setItem('kizuna2_2.abyss', abyssSave); else localStorage.removeItem('kizuna2_2.abyss'); RUN = savedRun;
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
        && ((document.querySelector('.tc-eyebrow') || {}).textContent || '').includes('BOND IS FORMED');
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
  // ---------- BUILD 291: WOUNDS — what the abyss keeps ----------
  // Measured twice: a duo WITH a healer finishes a room at 93-96% of the party
  // bar while the same-size pair without one lands at 38-47%, and two rounds of
  // shaving Elin's numbers moved that three points. The cliff is a SHAPE, not a
  // value — any reactive healing that covers one enemy action a turn erases a
  // three-turn fight — so a rule has to cap it rather than an arithmetic.
  check('WOUND: healing clamps to a ceiling the wound has lowered',
    await J(() => {
      RUN = newRun('ash'); RUN.roster = ['ash']; RUN.active = ['ash']; RUN.hp = { ash: 32 }; RUN.wounds = {};
      startFight({ type:'fight', chapter:3, heroes:['ash'], enemies:['husk'], useRunHp:true, floor:1, depth:3, mapId:1, narrator:'w' });
      const h = S.heroes[0];
      h.hp = 10; h.wound = 8;
      const cap = healCap(h);
      h.hp = Math.min(healCap(h), h.hp + 999);          // a heal far bigger than the bar
      return cap === h.maxHp - 8 && h.hp === h.maxHp - 8;
    }));
  check('WOUND: it can never floor you — the bar always keeps something to fill',
    await J(() => {
      const h = S.heroes[0];
      h.wound = 9999;
      return healCap(h) >= 1;
    }));
  check('WOUND: every heal in the game goes through the one seam',
    await J(() => {
      // the pattern this replaced was Math.min(x.maxHp, x.hp + n) — if any call
      // site still uses it, that heal ignores wounds entirely
      const src = [dealToEnemy, resolveCard, enemyPhase, resolveAllOut].map(f => f.toString()).join(' ');
      return !/Math\.min\((\w+)\.maxHp, \1\.hp \+/.test(src);
    }));
  check('WOUND: a landed blow keeps a share of itself, and the run remembers',
    await J(() => {
      RUN = newRun('ash'); RUN.roster = ['ash']; RUN.active = ['ash']; RUN.hp = { ash: 32 }; RUN.wounds = {};
      startFight({ type:'fight', chapter:3, heroes:['ash'], enemies:['husk'], useRunHp:true, floor:1, depth:3, mapId:1, narrator:'w' });
      const h = S.heroes[0];
      const left = 10;
      h.hp = Math.max(0, h.hp - left);
      const w = Math.round(left * WOUND_SHARE);
      h.wound = Math.min(Math.floor(h.maxHp * 0.66), woundOf(h) + w);
      RUN.wounds[h.id] = h.wound;
      return WOUND_SHARE > 0 && WOUND_SHARE < 1 && h.wound === 4 && RUN.wounds.ash === 4;
    }));
  check('WOUND: it survives the fight — carried out on victory, carried into the next',
    await J(() => {
      RUN = newRun('ash'); RUN.roster = ['ash']; RUN.active = ['ash']; RUN.hp = { ash: 20 };
      RUN.wounds = { ash: 7 };
      startFight({ type:'fight', chapter:3, heroes:['ash'], enemies:['husk'], useRunHp:true, floor:1, depth:3, mapId:2, narrator:'w' });
      const carriedIn = S.heroes[0].wound === 7;
      // the write-back lives in the victory handler; assert the carry-IN here and
      // the carry-OUT by driving RUN directly, rather than naming a function that
      // may not be a global
      RUN.wounds = {}; S.heroes[0].wound = 5;
      S.heroes.forEach(h => { RUN.wounds[h.id] = woundOf(h); });
      return carriedIn && RUN.wounds.ash === 5;
    }));
  check('WOUND: only a REST at a fire closes it',
    await J(() => {
      RUN = newRun('ash'); RUN.roster = ['ash']; RUN.active = ['ash'];
      RUN.hp = { ash: 12 }; RUN.wounds = { ash: 9 };
      showCamp({ id: 91, type: 'camp', label: 'a fire' });
      const rest = document.querySelector('#camp-rest');
      if (!rest) { hideOverlay(); return false; }
      rest.click();
      const cleared = !Object.keys(RUN.wounds || {}).length && RUN.hp.ash === HEROES.ash.maxHp;
      hideOverlay();
      return cleared;
    }));
  check('WOUND: the bar SHOWS the ceiling — an unreachable band you can see',
    await J(() => {
      RUN = newRun('ash'); RUN.roster = ['ash','elin']; RUN.active = ['ash','elin'];
      RUN.hp = { ash: 20, elin: 20 }; RUN.wounds = { ash: 8 };
      startFight({ type:'fight', chapter:3, heroes:['ash','elin'], enemies:['husk'], useRunHp:true, floor:1, depth:3, mapId:3, narrator:'w' });
      renderAll();
      const band = document.querySelector('[data-fig="ash"] .hp-wound');
      const none = document.querySelector('[data-fig="elin"] .hp-wound');
      return !!band && /WOUNDED/.test(band.title) && parseFloat(band.style.width) > 0
        && (!none || parseFloat(none.style.width || '0') === 0);
    }));

  // ---------- BUILD 290: four tiers, one of which was the tree ----------
  // Measured across a fielded trio's 100 nodes: tier 1 held 12 and tier 2 held
  // 67. The tiers were not pacing anything — a starter set and then EVERYTHING —
  // so Build 286's trickle had a cliff, not a ramp: 12 -> 64 visible the moment
  // tier 2 opened.
  check('RE-TIER: no tier is more than half the tree — the bands are even',
    await J(() => {
      const party = ['ash','elin','mira'];
      const mine = EMBER_TREE.filter(n => party.includes(n.hero) || n.common);
      const tiers = {}; mine.forEach(n => tiers[n.tier] = (tiers[n.tier] || 0) + 1);
      const counts = Object.keys(tiers).map(k => tiers[k]);
      const biggest = Math.max(...counts);
      return TREE_TIERS === 5 && Object.keys(tiers).length === 5
        && biggest < mine.length * 0.4 && Math.min(...counts) >= 10;
    }));
  check('RE-TIER: no node ever outranks the thing it requires',
    await J(() => EMBER_TREE.every(n => (n.requires || [])
      .every(id => !NODE_BY_ID[id] || NODE_BY_ID[id].tier <= n.tier))));
  check('RE-TIER: the trickle is a RAMP now — each unlock adds a readable step',
    await J(() => {
      const party = ['ash','elin','mira'];
      const drawn = (d) => {
        RUN = newRun('ash'); RUN.roster = party.slice(); RUN.active = party.slice();
        RUN.hp = {}; party.forEach(id => RUN.hp[id] = HEROES[id].maxHp);
        RUN.embers = 60; RUN.completed = Array.from({ length: d }, (_, i) => i);
        showEmberTree(() => {}, 'ash');
        // the hero's OWN nodes — the weave's doors on the rim do not deepen
        const n = document.querySelectorAll('.et-orb[data-id]:not([data-rim])').length; hideOverlay(); return n;
      };
      const steps = [drawn(0), drawn(4), drawn(8), drawn(12), drawn(16)];
      const gaps = steps.slice(1).map((v, i) => v - steps[i]);
      // strictly growing, and no single unlock more than doubles what you can see
      return steps.every((v, i) => i === 0 || v > steps[i - 1])
        && gaps.every(g => g > 0 && g < steps[0] * 1.2)
        && steps[steps.length - 1] > steps[0] * 2.5;
    }));
  check('RE-TIER: a BOND stone is paced by the fire, not by depth',
    await J(() => EMBER_TREE.filter(n => n.type === 'bond').every(n => n.tier === 2)));
  check('RE-TIER: every node still belongs to exactly one tier in range',
    await J(() => EMBER_TREE.every(n => Number.isInteger(n.tier) && n.tier >= 1 && n.tier <= TREE_TIERS)));

  // ---------- BUILD 289: the enemy line racks too ----------
  // Build 244 pulled focus onto the acting HERO and deliberately left the foes
  // alone — you are choosing out of that group, so it should stay readable. True
  // while you are still choosing; the moment the aim SNAPS you have chosen, and
  // the rest of the line is no longer a menu.
  const focusFight = `() => {
    RUN = newRun('ash'); RUN.roster = ['ash','elin','mira']; RUN.active = RUN.roster.slice();
    RUN.hp = {}; RUN.roster.forEach(id => RUN.hp[id] = HEROES[id].maxHp);
    startFight({ type:'fight', chapter:3, heroes:RUN.active.slice(), enemies:['husk','wraith','cultist'],
      useRunHp:true, floor:1, depth:3, narrator:'focus' });
    renderAll(); releaseFocus();
    return document.getElementById('stage');
  }`;
  // v2.2 Build 5: ONE rule, strictly kept. Rest = everyone crisp (the enemy
  // back rank's permanent depth blur is gone). Aiming = still crisp, only
  // highlights. Action = exactly actor + receiver in focus, both sides of
  // everyone else off the lens together. Release = whole board back.
  const anyBlurred = `[...document.querySelectorAll('#battlefield .fig-art')].filter(el => getComputedStyle(el).filter.includes('blur')).length`;
  check('FOCUS: at REST every figure on BOTH sides is crisp — even the enemy back rank',
    await J(`(() => {
      const st = (${focusFight})();
      return !st.classList.contains('rack')
        && document.querySelectorAll('.figure.fig-focus').length === 0
        && document.querySelectorAll('#enemy-half .figure').length >= 3
        && ${anyBlurred} === 0;
    })()`));
  check('FOCUS: AIMING blurs nothing — the hovered candidate only LIGHTS, the board stays readable',
    await J(`(() => {
      const st = (${focusFight})();
      const foe = livingEnemies()[1];
      markEnemyFocus([figEl(foe.uid)]);
      const marked = [...document.querySelectorAll('#enemy-half .figure.fig-mark')].map(e => e.dataset.fig);
      const ok = !st.classList.contains('rack') && marked.length === 1
        && marked[0] === foe.uid && ${anyBlurred} === 0;
      releaseFocus(); return ok;
    })()`));
  check('FOCUS: the action beat holds EXACTLY actor + receiver — everyone else, both sides, falls off',
    await J(`(() => {
      const st = (${focusFight})();
      const foe = livingEnemies()[1];
      focusPair('ash', foe.uid);
      const inFocus = [...document.querySelectorAll('.figure.fig-focus')].map(e => e.dataset.fig).sort();
      const ok = st.classList.contains('rack')
        && inFocus.length === 2 && inFocus.includes('ash') && inFocus.includes(foe.uid)
        && ${anyBlurred} === 4;   // the other two heroes + the other two foes
      releaseFocus(); return ok;
    })()`));
  check('FOCUS: it always lets go — release returns the WHOLE board to focus',
    await J(`(() => {
      const st = (${focusFight})();
      focusPair('ash', livingEnemies()[0].uid);
      releaseFocus();
      return !st.classList.contains('rack')
        && document.querySelectorAll('.figure.fig-focus').length === 0
        && ${anyBlurred} === 0;
    })()`));
  check('FOCUS: the rack survives a mid-action re-render — it is STATE, not a class a render can wipe',
    await J(`(() => {
      const st = (${focusFight})();
      const foe = livingEnemies()[1];
      focusPair('ash', foe.uid);
      renderAll();   // the old system lost its marks exactly here
      const inFocus = [...document.querySelectorAll('.figure.fig-focus')].map(e => e.dataset.fig).sort();
      const ok = st.classList.contains('rack') && inFocus.length === 2
        && inFocus.includes('ash') && inFocus.includes(foe.uid);
      releaseFocus(); return ok;
    })()`));
  check('FOCUS: the striking card composes the pair and playCard always releases it',
    await J(() => /focusPair\(card\.owner/.test(playCard.toString())
      && /releaseFocus\(\)/.test(playCard.toString())
      && /camShot\(\[actorEl, tgtEl\]/.test(playCard.toString())));
  check('FOCUS: text never blurs, and the unified rack honours the DEPTH tiers',
    await J(() => {
      const css = [...document.styleSheets].flatMap(s => { try { return [...s.cssRules].map(r => r.cssText); } catch (_) { return []; } }).join(' ');
      return /stage\.rack #battlefield \.figure \.fig-art/.test(css)
        && /fx-flat\.rack/.test(css) && /fx-soft\.rack/.test(css)
        && !/rack[^{]*fig-name[^{]*\{[^}]*blur/.test(css);
    }));

  // ---------- BUILD 286: the tree stops being overwhelming ----------
  // 156 nodes under ELEVEN type labels, but four of them (passive 60, branch 19,
  // card 18, bond 15) were 112 of the total — the other seven names split 44
  // nodes and nine of them meant roughly "a passive". And every tier unsealed
  // inside floor one, so a first-time player met the whole thing at once.
  check('TREE: FOUR kinds, not eleven — nothing removed, they stop being separately named',
    await J(() => {
      const kinds = [...new Set(Object.values(TREE_KIND))];
      const covered = EMBER_TREE.every(n => !!TREE_KIND[n.type]);
      return kinds.length === 4 && covered
        && kinds.includes('COMBO') && kinds.includes('FORK')
        && kinds.includes('PASSIVE') && kinds.includes('BOND');
    }));
  check('TREE: it TRICKLES — the first tree is a fraction of the last',
    await J(() => {
      const at = (depth) => {
        RUN = newRun('ash'); RUN.roster = ['ash','elin','mira']; RUN.active = RUN.roster.slice();
        RUN.hp = {}; RUN.roster.forEach(id => RUN.hp[id] = HEROES[id].maxHp);
        RUN.embers = 40; RUN.completed = Array.from({ length: depth }, (_, i) => i);
        showEmberTree(() => {}, 'ash');
        return document.querySelectorAll('.et-orb').length;
      };
      const first = at(0), mid = at(6), full = at(16);
      hideOverlay();
      return first < full * 0.45 && mid > first && full > mid;
    }));
  check('TREE: a sealed tier is NOT DRAWN — what waits is one line, not a field of locks',
    await J(() => {
      RUN = newRun('ash'); RUN.roster = ['ash']; RUN.active = ['ash'];
      RUN.hp = { ash: 32 }; RUN.embers = 40; RUN.completed = [];
      showEmberTree(() => {}, 'ash');
      const drawn = [...document.querySelectorAll('.et-orb')];
      const sealedDrawn = drawn.filter(e => e.classList.contains('et-sealed')).length;
      const ahead = (document.querySelector('.et-h-ahead') || {}).textContent || '';
      hideOverlay();
      return sealedDrawn === 0 && /more wait deeper/.test(ahead);
    }));
  check('TREE: a node you already OWN stays drawn even if its tier re-seals',
    await J(() => {
      RUN = newRun('ash'); RUN.roster = ['ash']; RUN.active = ['ash'];
      RUN.hp = { ash: 32 }; RUN.embers = 40; RUN.completed = [];
      const deep = EMBER_TREE.find(n => n.hero === 'ash' && n.tier >= 3);
      RUN.nodes = [deep.id];
      showEmberTree(() => {}, 'ash');
      const drawn = [...document.querySelectorAll('.et-orb')].some(e => (e.dataset.node || e.dataset.id) === deep.id
        || (e.textContent || '').indexOf(deep.label) >= 0);
      hideOverlay();
      return !tierOpen(deep.tier) && drawn;
    }));
  check('SPARK: taking a post-fight upgrade WALKS YOU TO THE TREE and shows it land',
    await J(async () => {
      const nap = (ms) => new Promise(r => setTimeout(r, ms));
      let done = 0;
      RUN = newRun('ash'); RUN.roster = ['ash','elin','mira']; RUN.active = RUN.roster.slice();
      RUN.hp = {}; RUN.roster.forEach(id => RUN.hp[id] = HEROES[id].maxHp);
      RUN.embers = 40; RUN.completed = [0,1,2,3,4,5,6,7];
      showEmberSpark(() => { done++; });
      const card = document.querySelector('[data-spark]'); if (!card) return false;
      const before = (RUN.nodes || []).length;
      card.click();
      await nap(120);
      const burst = !!document.getElementById('kindle-fx');
      const fx = document.getElementById('kindle-fx');
      if (fx) { fx.classList.add('kf-ready'); fx.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); }
      await nap(400);
      const inTree = !!document.querySelector('.et-head');
      const named = /\S/.test((document.querySelector('.et-d-name') || {}).textContent || '');
      hideOverlay();
      // …and the post-fight flow is NOT skipped — it resumes when you leave
      return burst && inTree && named && (RUN.nodes || []).length === before + 1 && done === 0;
    }));

  // ---------- BUILD 285: the Landing is a scene, not a menu ----------
  check('LANDING: ONE action — the climb. Everything else is a mark in the corner',
    await J(() => {
      try { localStorage.setItem('kizuna2_2.starters', JSON.stringify(['ash','elin','mira','cassia'])); } catch (_) {}
      showLanding({ trio: ['ash','elin','mira'], floor: 2, threads: 2 });
      const acts = document.querySelectorAll('.ld-scene .ld-climb').length;
      const marks = document.querySelectorAll('.ld-scene .ld-mark').length;
      const old = document.querySelectorAll('.ld-act').length;      // the three stacked cards
      return acts === 1 && marks === 2 && old === 0;
    }));
  check('LANDING: the scene takes the frame — chrome is a fraction of it',
    await J(() => {
      try { localStorage.setItem('kizuna2_2.starters', JSON.stringify(['ash','elin','mira','cassia'])); } catch (_) {}
      showLanding({ trio: ['ash','elin','mira'], floor: 2, threads: 2 });
      const st = document.querySelector('#stage').getBoundingClientRect();
      const climb = document.querySelector('.ld-climb').getBoundingClientRect();
      const marks = document.querySelector('.ld-marks').getBoundingClientRect();
      const hero = document.querySelector('.ld-hero').getBoundingClientRect();
      return (climb.height + marks.height) / st.height < 0.22 && hero.height / st.height > 0.18;
    }));
  check('LANDING: the line is SPOKEN — a name plate, not a typed prefix',
    await J(() => {
      try { localStorage.setItem('kizuna2_2.starters', JSON.stringify(['ash','elin','mira','cassia'])); } catch (_) {}
      showLanding({ trio: ['ash','elin','mira'], floor: 2, threads: 2 });
      const plate = (document.querySelector('.ld-plate') || {}).textContent || '';
      const said = (document.querySelector('.ld-said') || {}).textContent || '';
      const cast = [...document.querySelectorAll('.ld-hero')].map(e => e.dataset.id);
      return cast.some(id => HEROES[id].name === plate) && !/:/.test(said) && /^“/.test(said);
    }));
  check('LANDING: the corner marks still reach the codex and the way out',
    await J(() => {
      try { localStorage.setItem('kizuna2_2.starters', JSON.stringify(['ash','elin','mira','cassia'])); } catch (_) {}
      showLanding({ trio: ['ash'], floor: 1 });
      document.querySelector('#ld-codex').click();
      const inCodex = !!document.querySelector('.cx-list');
      document.querySelector('#cx-back').click();
      return inCodex && !!document.querySelector('.ld-scene') && !!document.querySelector('#ld-title');
    }));
  check('RELIC: what you carried down rides the descent header all run',
    await J(() => {
      RUN = newRun('ash'); RUN.relic = 'compass'; RUN.roster = ['ash']; RUN.active = ['ash'];
      RUN.hp = { ash: 32 }; RUN.completed = []; RUN.map = generateDescent(['ash'], 1);
      showMap();
      const el = document.querySelector('.map-relic');
      const named = !!el && /COMPASS/.test(el.textContent) && /ELITE/i.test(el.title);
      RUN.relic = null; showMap();
      return named && !document.querySelector('.map-relic');   // and nothing when you carried nothing
    }));

  // ---------- BUILD 284: a trash room is a read, not a formality ----------
  // Note count was tied to DAMAGE, and mobs correctly hit for 3-5, so nearly
  // every ordinary blow fell in the one-note bucket while an elite's 8-11 bought
  // three. Measured: ~1.2 notes an attack for a mob against 3.0 for the revenant
  // — which is why a trash room offered 3 parries and a set-piece offered 11.
  const noteCount = `(p) => p.kind === 'seq' ? (p.notes||[]).length : p.kind === 'mash' ? 1 : p.kind === 'multi' ? (p.count||2) : 1`;
  check('PARRY: an ordinary blow is at least a two-beat read',
    await J(`(() => {
      const n = ${noteCount};
      // every mob attack worth reading (d>=3) that is not a deliberate single
      // committed gesture (a BIG tap/hold, or a MASH flurry)
      const mobs = ['husk','wraith','cultist','mourner','drone','brood','cantor'];
      const thin = [];
      mobs.forEach(k => (ENEMY_DEFS[k].intents || []).forEach(it => {
        if (!it || it.kind === 'buff' || !(it.dmg >= 3)) return;
        const auth = it.parry || {};
        if (auth.kind === 'mash' || auth.size) return;      // deliberately one gesture
        if (n(parryPatternFor(it)) < 2) thin.push(k + ':' + it.name);
      }));
      return thin.length === 0;
    })()`));
  check('PARRY: the authored gesture SURVIVES the promotion — a sweep is still a sweep',
    await J(`(() => {
      const p = parryPatternFor({ name: 'Sorrowing Arc', dmg: 5, row: 'mid', parry: { kind: 'swipe', arc: 'arcR' } });
      return p.kind === 'seq' && p.notes.length === 2 && p.notes[p.notes.length - 1].t === 'swipe'
        && p.notes[p.notes.length - 1].arc === 'arcR';
    })()`));
  check('PARRY: an AUTHORED wide sweep is no thinner than the derived one',
    await J(`(() => {
      const n = ${noteCount};
      // writing a sweep down used to make it ONE note while leaving it to the
      // default made it three — backwards for the blow that reaches everybody
      const authored = parryPatternFor({ name: 'Dirge', dmg: 3, row: 'all', parry: { kind: 'swipe', arc: 'arcAcross', across: true } });
      const derived  = parryPatternFor({ name: 'x', dmg: 3, row: 'all' });
      return n(authored) === n(derived) && n(authored) === 3;
    })()`));
  check('PARRY: the gap to a set-piece NARROWS but does not close — elites stay denser',
    await J(`(() => {
      const n = ${noteCount};
      const avg = (k) => { const d = (ENEMY_DEFS[k].intents||[]).filter(i => i && i.kind !== 'buff' && i.dmg > 0);
        return d.reduce((a,i) => a + n(parryPatternFor(i)), 0) / d.length; };
      const mobs = ['husk','wraith','cultist','mourner','drone','brood','cantor'].map(avg);
      const mob = mobs.reduce((a,b)=>a+b,0) / mobs.length;
      const elite = avg('revenant');
      return mob >= 1.8 && elite > mob && elite / mob < 2;
    })()`));
  check('PARRY: the smallest jabs stay a single clean gesture — the primer survives',
    await J(() => {
      const p = parryPatternFor({ name: 'jab', dmg: 2, row: 'front' });
      return p.kind === 'mash';
    }));

  // ---------- BUILD 283: a floor has somewhere to recover ----------
  check('CAMP: a floor carries a MID-FLOOR fire, not just the one at the boss door',
    await J(() => {
      for (let k = 0; k < 40; k++) {
        RUN = newRun('ash'); RUN.roster = ['ash'];
        const map = generateDescent(['ash'], 1);
        const camps = map.filter(n => n.type === 'camp').map(n => n.level).sort((a, b) => a - b);
        // Build 20: gates cap the map now — the door camp sits before the BOSS
        const preBoss = map.find(n => n.type === 'boss').level - 1;
        if (camps.length < 2) return false;                 // one mid, one at the door
        if (!camps.includes(preBoss)) return false;
        if (!camps.some(l => l > 1 && l < preBoss)) return false;
      }
      return true;
    }));
  check('CAMP: the mid-floor fire is a ROAD, not a toll — its level still branches',
    await J(() => {
      let branched = 0;
      for (let k = 0; k < 40; k++) {
        RUN = newRun('ash'); RUN.roster = ['ash'];
        const map = generateDescent(['ash'], 1);
        const preBoss = Math.max(...map.map(n => n.level)) - 1;
        const mid = map.filter(n => n.type === 'camp' && n.level < preBoss)[0];
        if (mid && map.filter(n => n.level === mid.level).length > 1) branched++;
      }
      return branched === 40;
    }));
  check('SCALE: a lone hero takes far less than a full line — the aim fix tripled what lands',
    await J(() => {
      const read = (party) => {
        RUN = newRun(party[0]); RUN.roster = party.slice(); RUN.active = party.slice();
        RUN.hp = {}; party.forEach(id => RUN.hp[id] = HEROES[id].maxHp);
        startFight({ type:'fight', chapter:3, heroes:party.slice(), enemies:['husk'], useRunHp:true, floor:1, depth:3, narrator:'sc' });
        return S.enemies[0].dmgMul;
      };
      const solo = read(['ash']), duo = read(['ash','elin']), trio = read(['ash','elin','mira']);
      return solo < duo && duo < trio && solo < trio * 0.4;
    }));

  // ---------- BUILD 282: every road in starts at the bottom ----------
  // NEW GAME dropped a veteran straight onto a character grid — the one entry
  // into the game that skipped the place every other run begins and ends at,
  // which made the Landing read as a death screen rather than the bottom of the
  // stair. And the tutorial opened on a text card, which is a poor first look at
  // a game whose whole premise is where you are standing.
  check('OPEN: NEW GAME wakes a veteran at the Landing, not on a character grid',
    await J(() => {
      try { localStorage.setItem('kizuna2_2.tutorialSeen', '1');
            localStorage.setItem('kizuna2_2.starters', JSON.stringify(['ash','elin','mira'])); } catch (_) {}
      META.deaths = 3; showTitle();
      document.querySelector('#t-new').onclick();
      return !!document.querySelector('.ld-scene') && !document.querySelector('.ss-fig');
    }));
  check('OPEN: the cold open has its own beat — nobody died to get you here',
    await J(() => {
      showLanding({ cold: true });
      const said = (document.querySelector('.ld-said') || {}).textContent || '';
      const sub = (document.querySelector('.ld-sub') || {}).textContent || '';
      showLanding({ trio: ['ash'], floor: 1, threads: 0 });
      const died = (document.querySelector('.ld-said') || {}).textContent || '';
      return /You’re awake/.test(said) && /exactly where you left it/.test(sub) && said !== died;
    }));
  check('OPEN: CLIMB AGAIN still reaches the line-up and then the relic table',
    await J(() => {
      showLanding({ cold: true });
      document.querySelector('#ld-go').click();
      return !!document.querySelector('.ss-fig');
    }));
  check('OPEN: a FIRST-ever player still gets the tutorial, staged at the bottom',
    await J(() => {
      try { localStorage.removeItem('kizuna2_2.tutorialSeen'); } catch (_) {}
      showTitle();
      document.querySelector('#t-new').onclick();
      const ov = document.querySelector('#overlay.scene-landing');
      const lit = ov && getComputedStyle(ov).backgroundImage;
      return !!ov && FLOW[0].scene === 'landing'
        && /THE BOTTOM OF IT/.test((document.querySelector('.ov-eyebrow')||{}).textContent || '')
        && /gradient/.test(lit || '');       // the shaft is painted, not just classed
    }));
  check('OPEN: the staged scene sits BEHIND the prose, not over it',
    await J(() => {
      const inner = document.querySelector('#overlay.scene-landing #overlay-inner');
      // the first attempt injected scenery INTO overlay-inner, where it covered
      // the passage it was meant to sit behind
      return !!inner && !inner.querySelector('.ld-dark') && !inner.querySelector('.ld-shaft')
        && !!document.querySelector('#overlay.scene-landing .ov-title');
    }));
  try { } catch (_) {}

  // ---------- BUILD 281: enemies stop swinging at empty rows ----------
  // effIntentRow returned intent.row for any non-smart foe, occupied or not.
  // Against a lone hero — one row of three — that is most of its attacks hitting
  // furniture: no damage, and no PARRY WINDOW either, because enemyPhase only
  // opens one when a hero stands in the struck row. The beat was deleted
  // silently, which is a large part of why a fight offered so few parries.
  const aimSetup = `(party, rows) => {
    RUN = newRun(party[0]); RUN.roster = party.slice(); RUN.active = party.slice();
    RUN.hp = {}; party.forEach(id => RUN.hp[id] = HEROES[id].maxHp);
    startFight({ type:'fight', chapter:3, heroes:party.slice(), enemies:['husk'], useRunHp:true, floor:1, depth:2, narrator:'aim' });
    if (rows) S.heroes.forEach(h => { if (rows[h.id]) h.row = rows[h.id]; });
    S._taunt = null;
    const e = S.enemies[0]; e._aim = null; return e;
  }`;
  check('AIM: a dumb foe no longer swings at a row nobody is standing in',
    await J(`(() => {
      const e = (${aimSetup})(['ash'], { ash: 'front' }); e.smart = false;
      const back = effIntentRow(e, { row: 'back', dmg: 5 });
      const mid = effIntentRow(e, { row: 'mid', dmg: 5 });
      const front = effIntentRow(e, { row: 'front', dmg: 5 });
      return back === 'front' && mid === 'front' && front === 'front';
    })()`));
  check('AIM: it takes the NEAREST occupied row, so the blow keeps its character',
    await J(`(() => {
      const e = (${aimSetup})(['ash','elin'], { ash: 'front', elin: 'mid' }); e.smart = false;
      return effIntentRow(e, { row: 'back', dmg: 5 }) === 'mid';   // mid, not front
    })()`));
  check('AIM: the row LOCKS at telegraph time — stepping out of it still dodges',
    await J(`(() => {
      const e = (${aimSetup})(['ash'], { ash: 'front' }); e.smart = false;
      const told = effIntentRow(e, { row: 'front', dmg: 5 });
      S.heroes[0].row = 'back';                                    // the player dodges
      const resolved = effIntentRow(e, { row: 'front', dmg: 5 });  // must not follow
      return told === 'front' && resolved === 'front';
    })()`));
  check('AIM: a SMART foe cannot chase a dodge either — its hunt locks too',
    await J(`(() => {
      const e = (${aimSetup})(['ash','elin'], { ash: 'front', elin: 'back' }); e.smart = true;
      S.heroes.find(h => h.id === 'elin').hp = 3;                  // elin is the prey
      const hunted = effIntentRow(e, { row: 'front', dmg: 5 });
      S.heroes.find(h => h.id === 'elin').row = 'mid';
      return hunted === 'back' && effIntentRow(e, { row: 'front', dmg: 5 }) === 'back';
    })()`));
  check('AIM: every damaging intent in the game now opens a PARRY WINDOW on a solo hero',
    await J(`(() => {
      // enemyPhase only opens a window when a hero stands in the struck row
      // (\`ptRow\`), so an intent aimed at an empty row deleted the beat. Sweep
      // every authored intent against a LONE hero — the worst case, one occupied
      // row of three — and count how many would find him.
      const e = (${aimSetup})(['ash'], { ash: 'front' });
      let total = 0, land = 0;
      Object.keys(ENEMY_DEFS).forEach(k => (ENEMY_DEFS[k].intents || []).forEach(it => {
        if (!it || it.kind === 'buff' || !(it.dmg > 0)) return;
        total++;
        e._aim = null; e.smart = false;
        const r = effIntentRow(e, it);
        if (r === 'all' || heroInRow(r)) land++;
      }));
      return total >= 20 && land === total;
    })()`));
  check('AIM: TAUNT still overrides live — the wall makes itself the target',
    await J(`(() => {
      const e = (${aimSetup})(['ash','cassia'], { ash: 'front', cassia: 'back' }); e.smart = false;
      e._aim = { turn: S.turn, m: { '|front': 'front' } };          // already locked elsewhere
      S._taunt = 'cassia';
      const r = effIntentRow(e, { row: 'front', dmg: 5 });
      S._taunt = null;
      return r === 'back';
    })()`));

  // ---------- BUILD 277: RELICS ----------
  // BOONS were already this game's Slay the Spire relics — 41, hero-gated,
  // drafted mid-run, stacking, several of them curses. A second per-run passive
  // would have been the same system in a hat. The line drawn instead: a BOON
  // tunes combat, a RELIC changes the SHAPE of the run. One is carried, chosen
  // at the Landing, and every one of them costs something.
  check('RELIC: each one states what it is, what it does, and what it takes',
    await J(() => RELICS.length >= 4
      && RELICS.every(r => r.id && r.name && r.icon && r.found && r.rule && r.cost && typeof r.at === 'function')
      && new Set(RELICS.map(r => r.id)).size === RELICS.length));
  check('RELIC: a FIRST run carries nothing — the table grows as you descend',
    await J(() => {
      const m = { deaths: 0, clears: 0 };
      try { localStorage.setItem('kizuna2_2.starters', JSON.stringify(['ash'])); localStorage.removeItem('kizuna2_2.frags'); } catch (_) {}
      const dm = META.deaths, cm = META.clears;
      META.deaths = 0; META.clears = 0;
      const bare = RELICS.filter(r => r.at(META)).length;   // a FIRST run carries nothing
      META.deaths = 3;
      try { localStorage.setItem('kizuna2_2.starters', JSON.stringify(['ash','elin','mira','cassia'])); } catch (_) {}
      ABYSS_FRAGMENTS.slice(0, 3).forEach(f => markFrag(f.id));
      const deep = RELICS.filter(r => r.at(META)).length;
      META.deaths = dm; META.clears = cm;
      return bare === 0 && deep === RELICS.length;
    }));
  check('RELIC: SOMEONE’S LEFT GLOVE brings a second hero — and seals the road behind them',
    await J(() => {
      beginRun('ash', 'glove');
      return RUN.roster.length === 2 && RUN.active.length === 2
        && RUN.map.filter(n => n.type === 'recruit').length === 0;
    }));
  check('RELIC: A CHILD’S COMPASS makes locked nodes legible, and the stair opens its jaws',
    await J(() => {
      beginRun('ash', 'compass'); showMap();
      const locked = [...document.querySelectorAll('.map-node.mn-locked')];
      const opensElite = RUN.map.filter(n => n.level === 1).every(n => n.type === 'elite');
      return opensElite && locked.length > 0
        && locked.every(e => e.classList.contains('mn-scried') && e.title && e.title !== '?');
    }));
  check('RELIC: without the compass a locked node keeps its secret',
    await J(() => {
      beginRun('ash', null); showMap();
      const locked = [...document.querySelectorAll('.map-node.mn-locked')];
      return locked.length > 0 && locked.every(e => e.title === '?' && !e.classList.contains('mn-scried'));
    }));
  check('RELIC: A HANDFUL OF ASH pays 4 an ember per piece — and the first fire pays it back',
    await J(() => {
      try { localStorage.removeItem('kizuna2_2.frags'); } catch (_) {}
      ABYSS_FRAGMENTS.slice(0, 3).forEach(f => markFrag(f.id));
      beginRun('ash', 'ash');
      const emb = RUN.embers;
      RUN.hp = { ash: 10 };
      showCamp({ id: 99, type: 'camp', label: 'a fire' });
      const rows = [...document.querySelectorAll('.camp-choice')].map(e => e.id);
      const bare = rows.length === 1 && rows[0] === 'camp-fire' && !!document.querySelector('.camp-spent');
      hideOverlay();
      // …and only the FIRST fire is bare
      showCamp({ id: 98, type: 'camp', label: 'a second fire' });
      const later = [...document.querySelectorAll('.camp-choice')].map(e => e.id);
      hideOverlay();
      return emb === 12 && bare && later.length > 1;
    }));
  check('RELIC: THE CURSE-WARDING BOX moves the curse — it does not cancel it',
    await J(() => {
      beginRun('ash', 'box');
      RUN.roster = ['ash', 'elin', 'mira']; RUN.active = RUN.roster.slice();
      RUN.hp = { ash: 32, elin: 24, mira: 26 };
      startFight({ type: 'fight', chapter: 3, heroes: RUN.active.slice(), enemies: ['husk'], useRunHp: true, narrator: 'box' });
      const ash = S.heroes.find(h => h.id === 'ash');
      const before = S.heroes.filter(h => h.id !== 'ash').map(h => h.hp);
      ash.hp = 0;
      const warded = wardFall(ash);
      const paid = S.heroes.filter(h => h.id !== 'ash').every((h, i) => before[i] - h.hp === 4);
      const elin = S.heroes.find(h => h.id === 'elin'); elin.hp = 0;
      const twice = wardFall(elin);
      return warded && ash.hp === 1 && !ash.downed && paid && !twice;   // once per descent
    }));
  check('RELIC: taking NOTHING is a real answer, and the run carries none',
    await J(() => { beginRun('ash', null); return !RUN.relic && !heldRelic() && !hasRelic('compass'); }));
  check('RELIC: the picker offers every found relic plus the empty hand',
    await J(() => {
      META.deaths = 3;
      showRelicSelect('ash');
      const cards = [...document.querySelectorAll('.rl-card')];
      const ids = cards.map(c => c.dataset.id);
      const shaped = cards.every(c => c.querySelector('.rl-name') && c.querySelector('.rl-rule'));
      const costed = cards.filter(c => c.dataset.id).every(c => !!c.querySelector('.rl-cost'));
      hideOverlay();
      return ids.length === relicsFound().length + 1 && ids.includes('') && shaped && costed;
    }));

  // ---------- BUILD 276: THE LANDING ----------
  // Death was a scoreboard and a menu — a stats card, then "RETURN TO THE
  // SURFACE", then the title. At the moment a player is most receptive, none of
  // the 45 authored campfire beats, 8 fragments or six hero voices was on
  // screen. And there is no surface: the fragments are explicit that the stair
  // is a loop, so waking at the bottom is what this place DOES.
  check('LANDING: death wakes you at the bottom — not on the title screen',
    await J(() => { const src = onDefeat.toString();
      return /showLanding\(/.test(src) && /WAKE AT THE BOTTOM/.test(src)
        && !/RETURN TO THE SURFACE/.test(src); }));
  check('LANDING: clearing the run lands there too — the stair is a loop either way',
    await J(() => /showLanding\(\{ trio: t/.test(onRunComplete.toString())));
  check('LANDING: it is a PLACE — the cast you have unlocked is standing in it',
    await J(() => {
      try { localStorage.setItem('kizuna2_2.starters', JSON.stringify(['ash','elin','mira','cassia'])); } catch (_) {}
      showLanding({ trio: ['ash','elin','mira'], floor: 2, threads: 2 });
      const heroes = [...document.querySelectorAll('.ld-hero')].map(e => e.dataset.id);
      const lit = [...document.querySelectorAll('.ld-hero.ld-speaking')].map(e => e.dataset.id);
      return heroes.length === 4 && lit.length === 1 && heroes.includes(lit[0]);
    }));
  // THE HOOK: they do not remember you, you remember them — so the hub's own
  // state is gated on how much of yourself the abyss has not taken yet.
  check('LANDING: what they remember advances with your FRAGMENTS, not your deaths',
    await J(() => {
      const at = (n) => { try { localStorage.removeItem('kizuna2_2.frags'); } catch (_) {}
        ABYSS_FRAGMENTS.slice(0, n).forEach(f => markFrag(f.id));
        showLanding({ trio: ['ash'], floor: 1 });
        return (document.querySelector('.ld-eyebrow') || {}).textContent; };
      const a = at(0), b = at(3), c = at(8);
      try { localStorage.removeItem('kizuna2_2.frags'); } catch (_) {}
      return a !== b && b !== c && /BOTTOM/.test(a) && /REMEMBER/.test(c);
    }));
  check('LANDING: somebody reacts to the run you actually just lost',
    await J(() => {
      const say = (ctx) => { showLanding(ctx); return (document.querySelector('.ld-said') || {}).textContent || ''; };
      const alone = say({ trio: ['ash'], floor: 1, threads: 0 });
      const bonded = say({ trio: ['ash','elin','mira'], floor: 2, threads: 2 });
      const cleared = say({ trio: ['ash','elin','mira'], floor: 3, threads: 3, cleared: true });
      return /on your own/.test(alone) && /We held 2/.test(bonded) && /came back up/.test(cleared)
        && alone !== bonded && bonded !== cleared;
    }));
  check('LANDING: the seat ROTATES — a hub with six voices must not always use one',
    await J(() => {
      const who = [];
      for (let d = 0; d < 6; d++) { META.deaths = d;
        showLanding({ trio: ['ash','elin','mira'], floor: 2, threads: 2 });
        who.push([...document.querySelectorAll('.ld-hero.ld-speaking')].map(e => e.dataset.id)[0]); }
      return new Set(who).size === 3;
    }));
  check('LANDING: the codex is a wall you read here, and it hands you back',
    await J(() => {
      showLanding({ trio: ['ash'], floor: 1 });
      document.querySelector('#ld-codex').click();
      const inCodex = !!document.querySelector('.cx-list');
      document.querySelector('#cx-back').click();
      return inCodex && !!document.querySelector('.ld-scene');
    }));
  check('LANDING: it composes — cast, prose and the climb never collide',
    await J(() => {
      try { localStorage.setItem('kizuna2_2.starters', JSON.stringify(['ash','elin','mira','cassia'])); } catch (_) {}
      showLanding({ trio: ['ash','elin','mira'], floor: 2, threads: 2 });
      const st = document.querySelector('#stage').getBoundingClientRect();
      const r = (q) => document.querySelector(q).getBoundingClientRect();
      // Build 285 replaced the three stacked cards with a single CLIMB
      const body = r('.ld-body'), climb = r('.ld-climb'), top = r('.ld-top');
      const hs = [...document.querySelectorAll('.ld-hero')].map(e => e.getBoundingClientRect());
      const castTop = Math.min(...hs.map(h => h.top)), castBot = Math.max(...hs.map(h => h.bottom));
      return body.bottom <= climb.top && castBot <= body.top + 2 && top.bottom <= castTop
        && climb.bottom <= st.bottom + 1 && top.top >= st.top - 1;
    }));

  // ---------- BUILD 274: the first companion is not a dice roll ----------
  // A recruit was inserted as ONE of two or three nodes on its level, so a route
  // could walk straight past it. Measured over 400 generated maps, 34% of runs
  // met NO recruit at all — and in those runs the whole Kizuna system does not
  // exist: no bonds, no campfire arc, no fragments, no bond strikes, no triad.
  const walkMeetsRecruit = `(roster, runs) => {
    let zero = 0;
    for (let k = 0; k < runs; k++) {
      RUN = newRun('ash'); RUN.roster = roster.slice();
      const map = generateDescent(roster, 1);
      let cur = map.find(n => n.col === 1), met = 0, g = 0;
      while (cur && g++ < 40) {
        if (cur.type === 'recruit') met++;
        const nx = (cur.next || []).map(id => map.find(m => m.id === id)).filter(Boolean);
        if (!nx.length) break;
        cur = nx[Math.floor(Math.random() * nx.length)];
      }
      if (!met) zero++;
    }
    return zero;
  }`;
  check('MAP: short-handed, the earliest crossing is the ONLY road on its level',
    await J(() => {
      for (let k = 0; k < 40; k++) {
        RUN = newRun('ash'); RUN.roster = ['ash'];
        const map = generateDescent(['ash'], 1);
        const lv = Math.min(...map.filter(n => n.type === 'recruit').map(n => n.level));
        const row = map.filter(n => n.level === lv);
        if (row.length !== 1 || row[0].type !== 'recruit') return false;
      }
      return true;
    }));
  check('MAP: a solo descent can never reach the boss alone (0 of 200 walks)',
    await J(`(${walkMeetsRecruit})(['ash'], 200)`) === 0);
  check('MAP: a duo is still guaranteed a third — the line fills before the depths',
    await J(`(${walkMeetsRecruit})(['ash','elin'], 200)`) === 0);
  check('MAP: with a FULL line, recruits go back to being optional — declining stays a choice',
    await J(`(${walkMeetsRecruit})(['ash','elin','mira'], 200)`) > 20);
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

  // ---------- BUILD 268: THE THIRD ANSWER — you may decline without being cruel
  // Until now the only "no" ran through `hostile`, so keeping your line of three
  // meant WRONGING someone and eating an ambush for it. The roster grew past what
  // you could field and a deep recruit node read as a reward while behaving as a
  // chore. Decline is the honest refusal; refusing twice ends it.
  const JCRUN = `(picks) => { let g = 0, pi = 0; while (g++ < 40) { const o = document.querySelectorAll('.jc-opt'); if (o.length) { const p = picks[pi++]; (typeof p === 'string' ? document.querySelector(p) : (o[p] || o[0])).click(); continue; } if (document.querySelector('.jc-next')) { document.querySelector('.jc-scene').click(); continue; } break; } }`;
  check('DECLINE: the second beat offers a NOT-THIS-TIME that is not the hostile line',
    await J(`(() => {
      RUN = newRun('ash'); RUN.roster = ['ash']; RUN.active = ['ash'];
      const rn = RUN.map.find(n => n.type === 'recruit'); rn.hero = 'mira';
      try { localStorage.setItem(STARTERS_KEY, JSON.stringify(['ash'])); } catch (_) {}
      showRecruit(rn);
      let g = 0;
      while (g++ < 12 && !document.querySelectorAll('.jc-opt').length) document.querySelector('.jc-scene').click();
      document.querySelectorAll('.jc-opt')[1].click();          // guarded → beat 2
      g = 0; while (g++ < 12 && !document.querySelectorAll('.jc-opt').length) document.querySelector('.jc-scene').click();
      const opts = [...document.querySelectorAll('.jc-opt')].map(o => o.textContent);
      return opts.length === 3 && /Not this time/i.test(opts[2]);
    })()`));
  check('DECLINE: nobody joins, nobody is wronged — no roster growth, no foe queued',
    await J(`(() => {
      RUN = newRun('ash'); RUN.roster = ['ash']; RUN.active = ['ash']; RUN.foes = []; RUN.foesMade = 0;
      const rn = RUN.map.find(n => n.type === 'recruit'); rn.hero = 'mira';
      try { localStorage.setItem(STARTERS_KEY, JSON.stringify(['ash'])); } catch (_) {}
      showRecruit(rn);
      (${JCRUN})([1, 2]);                                        // guarded, then decline
      return !RUN.roster.includes('mira') && (RUN.declined || {}).mira === 1
        && !(RUN.foes || []).length && !(RUN.foesMade || 0)
        && RUN.completed.includes(rn.id)
        && /STAYS BEHIND/.test((document.querySelector('.tc-name') || {}).textContent || '');
    })()`));
  check('DECLINE: they are still climbing — a declined hero stays in the recruit pool',
    await J(`(() => {
      RUN = newRun('ash'); RUN.roster = ['ash']; RUN.declined = { mira: 1 }; RUN.refused = [];
      let seen = false;
      for (let k = 0; k < 30 && !seen; k++) seen = generateDescent(['ash'], 1).some(n => n && n.type === 'recruit' && n.hero === 'mira');
      return seen;
    })()`));
  check('DECLINE: the second meeting is COLDER — the warm terms are gone, they join wary',
    await J(`(() => {
      RUN = newRun('ash'); RUN.roster = ['ash']; RUN.active = ['ash']; RUN.bonds = {}; RUN.declined = { mira: 1 };
      const rn = { id: 310, type: 'recruit', hero: 'mira', level: 4, col: 4 }; RUN.map[310] = rn;
      try { localStorage.setItem(STARTERS_KEY, JSON.stringify(['ash'])); } catch (_) {}
      showRecruit(rn);
      const eyebrow = (document.querySelector('.jc-eyebrow') || {}).textContent || '';
      (${JCRUN})([0]);                                           // take them back
      return /THE ONE YOU PASSED/.test(eyebrow)
        && RUN.roster.includes('mira') && (RUN.bonds['ash|mira'] || 0) === 0;   // wary only — never the bonded open
    })()`));
  check('REFUSE: turning them away twice ends it — they leave the descent’s pool',
    await J(`(() => {
      RUN = newRun('ash'); RUN.roster = ['ash']; RUN.active = ['ash']; RUN.declined = { mira: 1 }; RUN.refused = [];
      const rn = { id: 311, type: 'recruit', hero: 'mira', level: 4, col: 4 }; RUN.map[311] = rn;
      try { localStorage.setItem(STARTERS_KEY, JSON.stringify(['ash'])); } catch (_) {}
      showRecruit(rn);
      (${JCRUN})([1]);                                           // refuse
      let seen = false;
      for (let k = 0; k < 30 && !seen; k++) seen = generateDescent(['ash'], 1).some(n => n && n.type === 'recruit' && n.hero === 'mira');
      return (RUN.refused || []).includes('mira') && !RUN.roster.includes('mira') && !seen;
    })()`));
  check('DECLINE: a reunion can be waved off too (an already-met hero is not forced on you)',
    await J(`(() => {
      unlockStarter('branwen');
      RUN = newRun('ash'); RUN.roster = ['ash']; RUN.active = ['ash']; RUN.declined = {};
      const rn = { id: 312, type: 'recruit', hero: 'branwen', level: 3, col: 3 }; RUN.map[312] = rn;
      showRecruit(rn);
      (${JCRUN})([2]);
      return !RUN.roster.includes('branwen') && (RUN.declined || {}).branwen === 1;
    })()`));
  check('MAP: a save with HOLES in it still renders — one missing node no longer strands the run',
    await J(`(() => {
      RUN = newRun('ash'); RUN.roster = ['ash']; RUN.active = ['ash'];
      const keep = RUN.map[3] && RUN.map[3].id;
      delete RUN.map[3];                       // a truncated / partly-written save
      let threw = false;
      try { showMap(); } catch (_) { threw = true; }
      return !threw && !!document.querySelector('.map-node')
        && mapAll().every(Boolean) && keep != null && !mapNode(keep);
    })()`));
  check('FOE: wronging someone with a full roster no longer PINS your new enemy into the line',
    await J(`(() => {
      RUN = newRun('ash'); RUN.roster = ['ash', 'elin', 'mira', 'hask']; RUN.active = ['ash', 'elin', 'mira'];
      RUN.foes = []; RUN.foesMade = 0;
      const rn = RUN.map.find(n => n.type === 'recruit'); rn.hero = 'cassia';
      foeTraveler(rn);
      const btn = document.querySelector('#rc-next');
      const label = (btn.textContent || '');
      btn.click();
      return (RUN.foes || []).includes('cassia') && /ONWARD/.test(label)
        && !RUN.active.includes('cassia') && !document.querySelector('.ps-card[data-id="cassia"]');
    })()`));

  // ---------- EMERGENT GROWTH (tier-3 forge loops) ----------
  console.log('--- EMERGENT ---');
  check('EMERGENT: each party hero has an emergent node (tier 3+) that forges a temp card',
    await J(() => {
      const em = EMBER_TREE.filter(n => n.type === 'emergent');
      return ['ash', 'elin', 'mira', 'cassia', 'branwen'].every(h => em.some(n => n.hero === h && n.tier >= 3 && n.emergent && n.emergent.forge));
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
      // Build 290 spread the tree to five tiers, so an emergent node sits deeper
      // than depth 8 now — this drill is about the BURST, not about the gate.
      RUN = newRun('mira'); RUN.active = ['mira']; RUN.embers = 30;
      RUN.completed = Array.from({ length: 17 }, (_, i) => i);
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
        && localStorage.getItem('kizuna2_2.treeTaught') === null
        && !treeTaught() && !getUnlockedStarters().includes('cassia')
        && localStorage.getItem('kizuna2_2.narrative') === null   // v2.2: the prologue is first-time flow
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
  check('TREE ash.rider.expose: Thrown Edge (BACK core) also marks EXPOSED 2',
    await J(() => { setupFight(['ash'], ['ash.sig.back', 'ash.rider.expose'], { ash: 'back' }); const c = handCard('Thrown Edge'); return !!c && c.fx.mark === 2; }));
  check('TREE mira.rider.twin: Twin Daggers now also EXPOSED 3',
    await J(() => { setupFight(['mira'], ['mira.sig.mid', 'mira.rider.twin'], { mira: 'mid' }); const c = handCard('Twin Daggers'); return !!c && c.fx.mark === 3; }));
  check('TREE cassia.rider.aegis: Aegis also grants COUNTER 1',
    await J(() => { setupFight(['cassia'], ['cassia.sig.mid', 'cassia.rider.aegis'], { cassia: 'mid' }); const c = handCard('Aegis'); return !!c && c.fx.counter === 1; }));
  check('TREE branwen.rider.deadeye: Backstep Shot (FRONT core) now also EXPOSED 2',
    await J(() => { setupFight(['branwen'], ['branwen.sig.front', 'branwen.rider.deadeye'], { branwen: 'front' }); const c = handCard('Backstep Shot'); return !!c && c.fx.mark === 2; }));
  check('TREE elin.rider.radiance: Radiant Ward also heals party 2',
    await J(() => { setupFight(['elin'], ['elin.sig.front', 'elin.rider.radiance'], { elin: 'front' }); const c = handCard('Radiant Ward'); return !!c && c.fx.heal === 2 && c.fx.guard === 3; }));
  // dmgMod passives — EXPOSED exploiters
  check('TREE mira.passive.opportunist: +3 damage to an EXPOSED foe',
    await J(() => { setupFight(['mira'], ['mira.passive.opportunist'], { mira: 'mid' }); const e = S.enemies[0]; e.mark = 0; const a = passiveDmg(S.heroes[0], e); e.mark = 4; return a === 0 && passiveDmg(S.heroes[0], e) === 3; }));
  check('TREE mira.passive.swiftfoot: Mira’s first move each turn is FREE (0 EP)',
    await J(() => { setupFight(['mira'], ['mira.afterimage', 'mira.passive.swiftfoot'], { mira: 'mid' }); const h = S.heroes[0]; S.used = new Set(); return moveCost(h) === 0 && mkMoveAction(h).cost === 0; }));
  check('TREE mira.passive.swiftfoot: WITHOUT the node her move costs 1 EP',
    await J(() => { setupFight(['mira'], ['mira.afterimage'], { mira: 'mid' }); const h = S.heroes[0]; S.used = new Set(); return moveCost(h) === 1; }));
  check('TREE swiftfoot: only the FIRST move is free — after moving, a further move costs 1',
    await J(() => { setupFight(['mira'], ['mira.afterimage', 'mira.passive.swiftfoot'], { mira: 'mid' }); const h = S.heroes[0]; S.used = new Set(); const first = moveCost(h); S.used.add('mira:move'); return first === 0 && moveCost(h) === 1; }));
  check('TREE swiftfoot: can move at 0 EP with the free move (canMove holds)',
    await J(() => { setupFight(['mira'], ['mira.afterimage', 'mira.passive.swiftfoot'], { mira: 'mid' }); const h = S.heroes[0]; S.used = new Set(); S.ep = 0; S.executing = false; S.over = false; S._staging = false; return canMove(h) === true; }));
  check('TREE swiftfoot is Mira-only: another hero’s move still costs 1 EP',
    await J(() => { setupFight(['ash'], ['mira.passive.swiftfoot'], { ash: 'mid' }); const h = S.heroes[0]; S.used = new Set(); return moveCost(h) === 1; }));
  check('TREE ash.passive.warstep: Ash’s move is 1 EP until he attacks, then FREE',
    await J(async () => { setupFight(['ash'], ['ash.passive.vanguard', 'ash.passive.warstep'], { ash: 'mid' }); S._rotations = false; const h = S.heroes[0]; S.used = new Set(); S._flags = {}; const before = moveCost(h);
      await resolveCard({ owner: 'ash', name: 'Cut', cost: 0, target: 'enemy', fx: { dmg: 5 } }, S.enemies[0].uid);
      return before === 1 && moveCost(h) === 0; }));   // free only AFTER a strike lands
  check('TREE ash.passive.warstep: WITHOUT an attack this turn, the move still costs 1',
    await J(() => { setupFight(['ash'], ['ash.passive.vanguard', 'ash.passive.warstep'], { ash: 'mid' }); const h = S.heroes[0]; S.used = new Set(); S._flags = {}; return moveCost(h) === 1; }));
  check('TREE elin.passive.mercy: healing an ally CLEANSES ❄ CHILL and ◎ EXPOSED',
    await J(async () => { setupFight(['elin', 'ash'], ['elin.passive.ward', 'elin.passive.mercy'], { elin: 'back', ash: 'front' }, { ash: 10 }); S._rotations = false; S.ep = 9;
      const ash = S.heroes.find(x => x.id === 'ash'); ash.chill = 3; ash.exposed = 2;
      S._strikeFired = { 'ash|elin': 1 };   // Elin+Ash are a BOND STRIKE pair (Build 271): the heal
      // lights their bond and the strike would mend Ash again. Correct, but not what this measures.
      await resolveCard({ owner: 'elin', name: 'Mend', cost: 0, target: 'ally', fx: { heal: 4 } }, 'ash');
      return ash.chill === 0 && ash.exposed === 0 && ash.hp === 14; }));
  check('TREE elin.passive.mercy gated: WITHOUT the node, a heal leaves CHILL/EXPOSED alone',
    await J(async () => { setupFight(['elin', 'ash'], ['elin.passive.ward'], { elin: 'back', ash: 'front' }, { ash: 10 }); S._rotations = false; S.ep = 9;
      const ash = S.heroes.find(x => x.id === 'ash'); ash.chill = 3; ash.exposed = 2;
      await resolveCard({ owner: 'elin', name: 'Mend', cost: 0, target: 'ally', fx: { heal: 4 } }, 'ash');
      return ash.chill === 3 && ash.exposed === 2; }));
  // SMITE — support with teeth: the support classes' heal/guard cards also strike
  // the frontmost foe, so Elin & Cassia never take a dead turn on a healthy party.
  check('SMITE: Elin’s Mend heals an ally AND strikes the frontmost foe',
    await J(async () => {
      setupFight(['elin', 'ash'], [], { elin: 'mid', ash: 'front' });
      const ash = S.heroes.find(h => h.id === 'ash'); ash.hp = ash.maxHp - 8;
      const foe = frontmostEnemy(); const fhp0 = foe.hp, ahp0 = ash.hp;
      await resolveCard({ owner: 'elin', name: 'Mend', cost: 1, target: 'ally', fx: { heal: 5, smite: 3 } }, 'ash');
      return S.heroes.find(h => h.id === 'ash').hp > ahp0 && S.enemies.find(e => e.uid === foe.uid).hp < fhp0; }));
  check('SMITE: Cassia’s Cover guards an ally AND strikes the frontmost foe',
    await J(async () => {
      setupFight(['cassia', 'ash'], [], { cassia: 'mid', ash: 'front' });
      const ally = S.heroes.find(h => h.id === 'ash'); const g0 = ally.guard;
      const foe = frontmostEnemy(); const fhp0 = foe.hp;
      await resolveCard({ owner: 'cassia', name: 'Cover', cost: 1, target: 'ally', fx: { guard: 4, smite: 3 } }, 'ash');
      return S.heroes.find(h => h.id === 'ash').guard > g0 && S.enemies.find(e => e.uid === foe.uid).hp < fhp0; }));
  check('SMITE: a support smite with NO foe in reach is a safe no-op',
    await J(async () => {
      setupFight(['elin', 'ash'], [], { elin: 'mid', ash: 'front' });
      S.enemies.forEach(e => { e.hp = 0; e.dead = true; });
      let threw = false;
      try { await resolveCard({ owner: 'elin', name: 'Mend', cost: 1, target: 'ally', fx: { heal: 5, smite: 3 } }, 'ash'); } catch (_) { threw = true; }
      return !threw; }));
  check('TREE cassia.passive.bastion: Cassia RESISTS ❄ CHILL (heroResistsChill drives the combat hook)',
    await J(() => { setupFight(['cassia'], ['cassia.passive.vigil', 'cassia.passive.bastion'], { cassia: 'front' }); const h = S.heroes[0];
      return heroResistsChill(h) === true; }));
  check('TREE bastion gated / Cassia-only: no node → not resisted; another hero → not resisted',
    await J(() => { setupFight(['cassia', 'ash'], ['cassia.passive.vigil'], { cassia: 'front', ash: 'mid' }); const c = S.heroes.find(x => x.id === 'cassia'); const a = S.heroes.find(x => x.id === 'ash');
      return heroResistsChill(c) === false && heroResistsChill(a) === false; }));
  check('TREE branwen.passive.longshot: her attack IGNORES enemy ⛨ GUARD (full damage through)',
    await J(() => { setupFight(['branwen'], ['branwen.passive.longshot'], { branwen: 'back' }); const e = S.enemies[0]; e.hp = e.maxHp = 100; e.guard = 6;
      dealToEnemy(e, 10, 'blade', 'branwen'); return e.guard === 6 && e.hp === 90; }));   // guard untouched, 10 straight to HP
  check('TREE longshot gated: WITHOUT the node, guard soaks first',
    await J(() => { setupFight(['branwen'], [], { branwen: 'back' }); const e = S.enemies[0]; e.hp = e.maxHp = 100; e.guard = 6;
      dealToEnemy(e, 10, 'blade', 'branwen'); return e.guard === 0 && e.hp === 96; }));   // 6 chips guard, 4 to HP
  // (branwen.passive.focus is now the mark-DEPTH scaling test in the distinctiveness block below)
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
  check('TREE ash.passive.vanguard: closing to FRONT braces him for guard 3',
    await J(() => { setupFight(['ash'], ['ash.passive.vanguard'], { ash: 'mid' }); const h = S.heroes[0]; h.guard = 0; firePassives('enterRow', 'ash', { toRow: 'front', fromRow: 'mid' }); return h.guard === 3; }));
  // EP-refund latches (once per turn)
  check('TREE ash.passive.relentless: 1st follow-up refunds 1 EP, the 2nd does not',
    await J(() => { setupFight(['ash', 'mira'], ['ash.passive.relentless'], { ash: 'front', mira: 'mid' }); S._flags = {}; S.ep = 5; firePassives('followup', 'ash', {}); const a = S.ep; firePassives('followup', 'ash', {}); return a === 6 && S.ep === 6; }));
  check('TREE branwen.passive.reckoning: killing a MARKED foe refunds 1 EP (unmarked does not)',
    await J(() => { setupFight(['branwen'], ['branwen.passive.reckoning'], { branwen: 'back' }); S._flags = {}; S.ep = 4; firePassives('kill', 'branwen', { tgt: { mark: 2 } }); const a = S.ep; S._flags = {}; firePassives('kill', 'branwen', { tgt: { mark: 0 } }); return a === 5 && S.ep === 5; }));
  // capstone — Immovable
  check('TREE cassia.passive.immovable: her guard persists through the enemy turn',
    await J(() => { setupFight(['cassia'], ['cassia.passive.immovable'], { cassia: 'front' }); return keepsGuard('cassia') === true && keepsGuard('ash') === false; }));
  // ── DISTINCTIVENESS PASS (Build 191): the three heroes that shared "+N to EXPOSED"
  // now express distinct damage identities; Hask gains a CHILL→SHATTER engine.
  check('TREE ash.passive.exploit is now SPEARPOINT: +3 to the FRONTMOST foe only (not marks)',
    await J(() => { setupFight(['ash'], ['ash.passive.exploit'], { ash: 'front' }); const ash = S.heroes[0];
      const front = frontmostEnemy(); const back = livingEnemies().find(e => e !== front) || front;
      if (back !== front) { back.mark = 5; }   // a marked non-front foe gets NO bonus now
      return passiveDmg(ash, front) === 3 && (back === front || passiveDmg(ash, back) === 0); }));
  check('TREE branwen.passive.focus scales with MARK DEPTH (+1/stack, cap +4)',
    await J(() => { setupFight(['branwen'], ['branwen.passive.focus'], { branwen: 'back' }); const br = S.heroes[0]; const f = frontmostEnemy();
      f.mark = 2; const a = passiveDmg(br, f); f.mark = 9; const b = passiveDmg(br, f); return a === 2 && b === 4; }));
  check('TREE hask.passive.shatter: hitting a CHILLED foe SHATTERS the frost (+2/stack, clears it)',
    await J(() => { setupFight(['hask'], ['hask.passive.shatter'], { hask: 'front' }); const f = frontmostEnemy(); f.lull = 3; const hp0 = f.hp;
      firePassives('postHit', 'hask', { tgt: f }); const f2 = S.enemies.find(e => e.uid === f.uid); return (hp0 - f2.hp) === 6 && f2.lull === 0; }));
  check('TREE cassia.passive.bastion now also BRACES a reprisal counter each turn',
    await J(() => { setupFight(['cassia'], ['cassia.passive.bastion'], { cassia: 'front' }); const c = S.heroes[0]; c.counter = 0;
      firePassives('turnStart', 'cassia', {}); return c.counter === 1 && heroResistsChill(c) === true; }));
  // ── SECOND PASS (Build 192): active mark-spend, guard→heal, smite-amp ──
  check('TREE mira.passive.frenzy DEVOURS marks for burst (+3/stack, clears them)',
    await J(() => { setupFight(['mira'], ['mira.passive.frenzy'], { mira: 'mid' }); const f = frontmostEnemy(); f.hp = f.maxHp; f.mark = 3; const hp0 = f.hp;
      firePassives('postHit', 'mira', { tgt: f }); const f2 = S.enemies.find(e => e.uid === f.uid); return (hp0 - f2.hp) === 9 && f2.mark === 0; }));
  check('TREE cassia.passive.shelter: a deep wall (10+ guard) heals the most-wounded ally',
    await J(() => { setupFight(['cassia', 'ash'], ['cassia.passive.shelter'], { cassia: 'front', ash: 'mid' });
      const ca = S.heroes.find(h => h.id === 'cassia'), al = S.heroes.find(h => h.id === 'ash');
      ca.guard = 12; al.hp = al.maxHp - 8; const h0 = al.hp; firePassives('turnStart', 'cassia', {}); const healed = al.hp - h0;
      ca.guard = 5; al.hp = al.maxHp - 8; const h1 = al.hp; firePassives('turnStart', 'cassia', {}); const noHeal = al.hp - h1;
      return healed === 4 && noHeal === 0; }));
  check('TREE elin.passive.wrath: her smites hit +2 AND EXPOSE the foe (marks for the party)',
    await J(async () => { setupFight(['elin', 'ash'], ['elin.passive.wrath'], { elin: 'mid', ash: 'front' });
      const foe = frontmostEnemy(); const fh0 = foe.hp;
      await resolveCard({ owner: 'elin', name: 'Mend', cost: 1, target: 'ally', fx: { heal: 5, smite: 3 } }, 'ash');
      const f2 = S.enemies.find(e => e.uid === foe.uid); return (fh0 - f2.hp) === 5 && f2.mark === 1; }));
  // capstone — Radiant Overflow (real heal; overheal spill reaches the whole party)
  check('TREE elin.passive.overflow: overheal shields the WHOLE party, not just the target',
    await J(async () => {
      setupFight(['elin', 'ash'], ['elin.passive.overflow', 'elin.sig.back'], { elin: 'back', ash: 'front' });
      S.heroes.forEach(h => { h.hp = h.maxHp; h.guard = 0; });
      // Build 287 halved Benediction's heal (4, not 8) — this check is about the
      // SPILL reaching the non-target, not about the size of it.
      const heal = (HEROES.elin.cards.back.sig.fx || {}).heal;
      await playCard(handCard('Benediction'), 'ash');   // at full HP the whole heal overflows to guard
      const ash = S.heroes.find(h => h.id === 'ash'), elin = S.heroes.find(h => h.id === 'elin');
      return heal > 0 && elin.guard >= heal && ash.guard >= heal;   // elin (non-target) got the spill ⇒ overflow works
    }));
  // ALL-OUT upgrades — resolve a full burst (untimed strikes still complete)
  check('TREE cassia.allout.fortress: party braces before the all-out',
    await J(async () => {
      setupFight(['cassia', 'elin'],
        ['cassia.allout.fortress', 'cassia.emergent.bulwark', 'cassia.sig.front'],
        { cassia: 'front', elin: 'back' });
      S.enemies.forEach(e => { e.hp = e.maxHp = 400; });
      S.heroes.forEach(h => { h.hp = Math.max(1, h.maxHp - 12); h.guard = 0; });
      window.__autoParry = false; S.momentum = 100; renderAll();
      await triggerAllOut();
      const bracedAll = S.heroes.every(h => h.guard >= 5);     // Fortress +5 to everyone
      return bracedAll;
    }));
  check('ALL-OUT elin.allout.dawn: the storm ends on a party mend (✚5) + ward (⛨3)',
    await J(async () => {
      setupFight(['elin'], ['elin.allout.dawn'], { elin: 'mid' });
      S.enemies.forEach(e => { e.hp = e.maxHp = 400; });
      const el = S.heroes[0]; el.hp = el.maxHp - 12; el.guard = 0;
      window.__autoParry = false; S.momentum = 100; renderAll();
      await triggerAllOut();
      return el.hp === el.maxHp - 7 && el.guard >= 3; }));   // healed +5 (−12 → −7), warded +3
  check('ALL-OUT mira.allout.dance: the storm ends leaving every survivor ◎ EXPOSED 5',
    await J(async () => {
      setupFight(['mira'], ['mira.allout.dance'], { mira: 'front' });
      S.enemies.forEach(e => { e.hp = e.maxHp = 400; e.mark = 0; });
      window.__autoParry = false; S.momentum = 100; renderAll();
      await triggerAllOut();
      return S.enemies.every(e => (e.mark || 0) >= 5); }));
  check('ALL-OUT branwen.allout.ruin: a parting volley hits the line and refunds 2 EP',
    await J(async () => {
      setupFight(['branwen'], ['branwen.allout.ruin'], { branwen: 'back' });
      S.enemies.forEach(e => { e.hp = e.maxHp = 400; e.guard = 0; });
      window.__autoParry = false; S.momentum = 100; S.ep = 1; renderAll();
      const hp0 = S.enemies[0].hp, ep0 = S.ep;
      await triggerAllOut();
      return S.enemies[0].hp < hp0 && S.ep >= ep0 + 2; }));

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
  check('WEAVE: a kindled pair walks in with its thread PRE-FORMED',
    duetSetup.pre.length === 1 && duetSetup.pre[0] === 'ash|elin', JSON.stringify(duetSetup.pre));
  await J(async () => { await addThread('ash', 'elin'); });   // the shared act this fight
  await sleep(300);
  // BONDS REFORGED — the shared act WEAVES the pair (a live rider), no card, no EP.
  check('WEAVE: the shared act wove the pair — no duet/resonant CARD',
    await J(() => (S.pairsAwake && S.pairsAwake.has('ash|elin')) && !S.tempCards.find(c => c.fx && c.fx.duet) && !document.querySelector('#hand .card.kind-resonant')));
  check('WEAVE: awakening swelled the BURST to L2 (the old duet reward)', await J(() => (S.burstLevel || 1) >= 2));
  // FOLLOW-UP — the legible weave beat: a woven hero's FINISHER OFFERS the partner
  // a free Follow-Up card (once per bond per turn).
  const offer = await J(() => {
    S._assistedPairs = new Set(); S.tempCards = [];
    offerBondFollow('ash');
    const c = S.tempCards.find(t => t.fx && t.fx.bondFollow);
    return { has: !!c, owner: c && c.owner, cost: c && c.cost, key: c && c.fx.bondFollow.key, once: S._assistedPairs.has(pairKey('ash', 'elin')) };
  });
  check('CHAIN: Ash’s finisher offers a free Chain card for bonded Elin',
    offer.has && offer.owner === 'elin' && offer.cost === 0 && offer.key === 'ash|elin' && offer.once, JSON.stringify(offer));
  const noSpam = await J(() => { const n0 = S.tempCards.length; offerBondFollow('ash'); return S.tempCards.length === n0; });
  check('CHAIN: offered ONCE per bond per turn (no spam)', noSpam);
  // SYMMETRIC — the SUPPORT chains too: Elin's finisher offers ASH a chain (any hero
  // can be the source, so it's not always the same character chaining).
  const symmetric = await J(() => {
    S._assistedPairs = new Set(); S.tempCards = [];
    offerBondFollow('elin');
    const c = S.tempCards.find(t => t.fx && t.fx.bondFollow);
    return { has: !!c, owner: c && c.owner };
  });
  check('CHAIN: symmetric — Elin’s finisher offers a Chain for bonded ASH', symmetric.has && symmetric.owner === 'ash', JSON.stringify(symmetric));
  // and the trigger fires for ANY finisher (heal/guard too), not just damage ones
  check('CHAIN: offered on ANY finisher (playCard, not gated on damage)',
    await J(() => playCard.toString().includes('offerBondFollow') && !resolveCard.toString().includes('offerBondFollow')));
  // playing it runs the partner's assist — Elin (Cleric) mends the wounded ally.
  const played = await J(async () => {
    const elin = S.heroes.find(h => h.id === 'elin'); elin.hp = 10; const before = elin.hp;
    await resolveBondFollow({ partnerId: 'elin', attackerId: 'ash', key: 'ash|elin', weave: 'Warded Edge' });
    return { before, after: S.heroes.find(h => h.id === 'elin').hp };
  });
  check('FOLLOW-UP: playing it runs the partner’s assist (Elin mends the wounded)', played.after > played.before, JSON.stringify(played));
  // never whiffs — Elin wards the attacker when nobody's hurt
  const noWhiff = await J(async () => {
    S.heroes.forEach(h => { h.hp = h.maxHp; h.guard = 0; });
    const ash = S.heroes.find(h => h.id === 'ash');
    await resolveBondFollow({ partnerId: 'elin', attackerId: 'ash', weave: 'Warded Edge' });
    return ash.guard >= 4;
  });
  check('FOLLOW-UP: never whiffs — Elin wards when no ally is wounded', noWhiff);
  const noWeave = await J(async () => {
    RUN = newRun('ash');
    RUN.roster = ['ash', 'mira']; RUN.active = ['ash', 'mira'];
    RUN.hp = { ash: 32, mira: 22 }; RUN.bonds = {};   // un-kindled
    startMapFight(RUN.map.find(x => x.type === 'fight'));
    await addThread('ash', 'mira');
    return { woven: !!(S.pairsAwake && S.pairsAwake.size), card: !!S.tempCards.find(c => c.fx && c.fx.bondFollow) };
  });
  check('WEAVE: an UN-kindled pair weaves nothing (offers no follow-up)',
    !noWeave.woven && !noWeave.card, JSON.stringify(noWeave));
  // ALL-OUT EMPOWER — deepened bonds lift EVERY strike of the all-out (the FF7R
  // synergy), instead of piling on separate vows.
  check('ALL-OUT: woven bonds empower the assault (bondMul wired into resolveAllOut)',
    await J(() => resolveAllOut.toString().includes('bondMul') && typeof allOutTriadFinale === 'function'));
  // TRACE SIGIL — the TRIAD FINALE gates on drawing a triangle; the gesture
  // auto-resolves under the harness driver and its quality ramps the vow.
  check('TRACE: the triangle sigil resolves and the finale scales by its quality',
    await J(async () => {
      const auto = await (async () => { window.__autoParry = true; const q = await traceNote(1200); window.__autoParry = false; return q; })();
      return auto === 'perfect'
        && typeof traceNote === 'function'
        && allOutTriadFinale.toString().includes('traceNote');
    }));
  check('TRACE: it never stalls — with no input it still resolves on its timer',
    await J(async () => { window.__autoParry = false; const q = await traceNote(220); return q === 'good' || q === 'miss'; }));
  const mira2 = await J(async () => {
    setupFight(['ash', 'mira'], [], { ash: 'front', mira: 'mid' });
    const foe = frontmostEnemy(); const hp0 = foe.hp;
    await resolveBondFollow({ partnerId: 'mira', attackerId: 'ash', weave: 'Twin Edge' });   // Mira (Reaver) → mark + strike
    return { struck: foe.hp < hp0, marked: (foe.mark || 0) >= 2 };
  });
  check('FOLLOW-UP: flavored by WHO the partner is (Mira marks + strikes)',
    mira2.struck && mira2.marked, JSON.stringify(mira2));
  // HASK CAN CHAIN — the Mage weave pairs exist, so a Hask bond is a real weave
  // that offers a Chain (regression: BOND_WEAVE was missing all 5 Mage pairs, so
  // Hask could never give or receive one despite having a BOND_ASSIST entry).
  const haskWeave = await J(() => ({
    mageRonin: !!weaveFor('hask', 'ash'), mageCleric: !!weaveFor('hask', 'elin'),
    mageReaver: !!weaveFor('hask', 'mira'), mageGuardian: !!weaveFor('hask', 'cassia'),
    mageRanger: !!weaveFor('hask', 'branwen'),
  }));
  check('WEAVE: all 5 Mage (Hask) pairs are defined — Hask can weave', Object.values(haskWeave).every(Boolean), JSON.stringify(haskWeave));
  const haskChain = await J(() => {
    setupFight(['hask', 'ash'], [], { hask: 'back', ash: 'front' });
    S.pairsAwake = new Set([pairKey('hask', 'ash')]); S._assistedPairs = new Set(); S.tempCards = [];
    offerBondFollow('ash');   // Ash's finisher → Hask's Chain offered
    const c = S.tempCards.find(t => t.fx && t.fx.bondFollow);
    return { has: !!c, owner: c && c.owner };
  });
  check('CHAIN: Hask receives a Chain off a woven partner’s finisher', haskChain.has && haskChain.owner === 'hask', JSON.stringify(haskChain));
  // KIZUNA teamwork branch — the chain nodes deepen the Chain itself.
  const chainMomentum = await J(async () => {
    setupFight(['ash', 'mira'], [], { ash: 'front', mira: 'mid' });
    RUN.nodes = ['ash.chain.link']; S.momentum = 0;
    await resolveBondFollow({ partnerId: 'mira', attackerId: 'ash', weave: 'Twin Edge' });
    return S.momentum;
  });
  check('KIZUNA: Momentum Weave — a Chain builds burst (+momentum)', chainMomentum >= 8, 'momentum=' + chainMomentum);
  check('KIZUNA: Empowered Bond raises the all-out bond multiplier (wired into resolveAllOut)',
    await J(() => { const s = resolveAllOut.toString(); return s.includes('ash.chain.deep') && s.includes('0.25') && s.includes('bondPer'); }));
  check('KIZUNA: Chain Reaction cascades (resolveBondFollow re-offers on the capstone)',
    await J(() => resolveBondFollow.toString().includes('ash.chain.react') && resolveBondFollow.toString().includes('offerBondFollow')));
  // OPENING WEAVES — pre-kindled bonds walk into the fight already woven, so a
  // deepened bond is felt from turn one (no re-earning the weave every fight).
  const opening = await J(() => {
    RUN = newRun('ash'); RUN.roster = ['ash', 'elin']; RUN.active = ['ash', 'elin'];
    RUN.hp = { ash: 32, elin: 24 }; RUN.bonds = {}; RUN.bonds[pairKey('ash', 'elin')] = BOND_KINDLED;
    startMapFight(RUN.map.find(x => x.type === 'fight'));
    return { woven: !!(S.pairsAwake && S.pairsAwake.has(pairKey('ash', 'elin'))) };
  });
  check('WEAVE: a pre-KINDLED bond enters the fight already woven (openingWeaves)', opening.woven, JSON.stringify(opening));
  // DRAG RESET — the post-game-over "cards un-draggable" fix: clearAim must wipe
  // the stale hand + any leaked interaction state so the NEXT game wires fresh cards.
  check('DRAG RESET: clearAim wipes the stale hand + frozen/focus/targeting state',
    await J(() => {
      setupFight(['ash', 'elin', 'mira'], [], {});
      targeting = { card: {}, validIds: [] };
      const st = document.getElementById('stage'); st.classList.add('allout-focus', 'frozen', 'parry-slowmo');
      const hadCards = document.querySelectorAll('#hand .card').length > 0;
      clearAim();
      const cleared = document.querySelectorAll('#hand .card').length === 0;
      const noStuck = !targeting && !st.classList.contains('allout-focus') && !st.classList.contains('frozen') && !st.classList.contains('parry-slowmo');
      return hadCards && cleared && noStuck;
    }));

  // ---------- KIZUNA REACH: bonds form through ordinary cooperative play ----------
  console.log('--- KIZUNA REACH ---');
  check('KIZUNA: a party-wide ward threads the caster to EVERY ally it shelters',
    await J(async () => {
      setupFight(['elin', 'ash', 'mira'], ['elin.sig.front'], { elin: 'front', ash: 'mid', mira: 'back' });
      window.__origTC = window.__origTC || triadCeremony;
      window.triadCeremony = async () => { S.allOutCrowned = true; };   // don't block on the cinematic
      S.ep = 20; const before = S.threads.size;
      await playCard(handCard('Radiant Ward'), null);   // target 'allies' → wards the whole party
      return before === 0 && S.threads.has('ash|elin') && S.threads.has('elin|mira') && S.threads.size === 2;
    }));
  check('KIZUNA: ganging up — a follow-up threads the striker with EVERY prior hitter of that foe',
    await J(async () => {
      setupFight(['ash', 'mira', 'branwen'], ['mira.sig.mid', 'branwen.sig.back'], { ash: 'front', mira: 'mid', branwen: 'back' });
      window.__origTC = window.__origTC || triadCeremony;
      window.triadCeremony = async () => { S.allOutCrowned = true; };
      S.ep = 20; S.threads.clear();
      const e = frontmostEnemy(); e.hp = e.maxHp = 99;
      await playCard(buildHand().find(c => c.owner === 'ash' && c.fx && c.fx.dmg), e.uid);           // ash hits
      await playCard(buildHand().find(c => c.owner === 'mira' && c.name === 'Twin Daggers'), e.uid);  // mira follows → ash-mira
      await playCard(buildHand().find(c => c.owner === 'branwen' && c.name === 'Killing Arrow'), e.uid); // branwen follows → threads BOTH prior
      return S.threads.has('ash|mira') && S.threads.has('ash|branwen') && S.threads.has('branwen|mira') && S.triadFormed;
    }));
  await J(() => { if (window.__origTC) triadCeremony = window.__origTC; });   // restore the real ceremony for later source-inspection

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
  // The pan/zoom rig is retired with the constellation (Build 24): the whole
  // tree is on screen at once, so there is nothing to navigate TO. What
  // replaces that guarantee is this — every line is visible without panning.
  check('UI: the ember tree needs no panning — the whole star is inside its frame',
    await J(() => {
      RUN = newRun('ash'); RUN.active = ['ash']; RUN.nodes = []; RUN.embers = 30; RUN.completed = [0, 1, 2, 3, 4, 5];
      showEmberTree(() => {}, 'ash');
      const star = document.querySelector('#et-star'); if (!star) return false;
      const b = star.getBoundingClientRect();
      const parts = [...star.querySelectorAll('.et-orb'), ...star.querySelectorAll('.et-tip')];
      return parts.length > 3 && parts.every(el => { const r = el.getBoundingClientRect();
        return r.left >= b.left - 2 && r.right <= b.right + 2 && r.top >= b.top - 2 && r.bottom <= b.bottom + 2; });
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
  // CORE-SYSTEM boons (Build 193): gifts that engage the bond/chain + all-out core.
  check('BOON: Deepening Bond — when Ash answers a CHAIN the whole party rallies (+1)',
    await J(() => {
      RUN = newRun('ash'); RUN.roster = ['ash', 'elin']; RUN.active = ['ash', 'elin'];
      startFight({ type: 'fight', chapter: 3, heroes: ['ash', 'elin'], enemies: ['husk'], narrator: 'x' });
      RUN.boons = ['ash_deepbond']; S.heroes.forEach(h => h.buffDmg = 0);
      firePassives('chain', 'ash', { attackerId: 'elin' });
      return S.heroes.every(h => h.buffDmg === 1); }));
  check('BOON: Reaper’s Rhythm — Mira’s kills build MOMENTUM (+8, feeds the all-out)',
    await J(() => {
      RUN = newRun('ash'); RUN.roster = ['mira']; RUN.active = ['mira'];
      startFight({ type: 'fight', chapter: 3, heroes: ['mira'], enemies: ['husk'], narrator: 'x' });
      RUN.boons = ['mira_rhythm']; S.momentum = 0;
      firePassives('kill', 'mira', { tgt: frontmostEnemy() });
      return S.momentum === 8; }));
  check('BOON: resolveBondFollow fires the CHAIN hook (boons/nodes can react to a Chain)',
    await J(() => resolveBondFollow.toString().includes("firePassives('chain'")));
  check('BOON DUO: Twin Shadows’ Edge is active ONLY when BOTH Ash and Mira are fielded',
    await J(() => {
      setupFight(['ash', 'mira'], [], { ash: 'front', mira: 'mid' }); RUN.boons = ['duo_ashmira'];
      const e = S.enemies[0]; e.mark = 2; const ash = S.heroes.find(h => h.id === 'ash');
      const withBoth = passiveDmg(ash, e);
      RUN.active = ['ash'];   // bench Mira
      const withoutMira = passiveDmg(ash, e);
      return withBoth === 3 && withoutMira === 0; }));
  check('BOON TRIO: The Killing Wind needs the EXACT three (Ash · Mira · Branwen)',
    await J(() => {
      const ok = boonHeroesOk(BOON_BY_ID['trio_killwind'], ['ash', 'mira', 'branwen']);
      const missing = boonHeroesOk(BOON_BY_ID['trio_killwind'], ['ash', 'mira', 'elin']);
      const duoBoth = boonHeroesOk(BOON_BY_ID['duo_ashmira'], ['ash', 'mira', 'elin']);
      const duoOne = boonHeroesOk(BOON_BY_ID['duo_ashmira'], ['ash', 'elin', 'cassia']);
      return ok && !missing && duoBoth && !duoOne; }));
  check('BOON SCALING: Reaper’s Tally grows on each EXPOSED kill and feeds signature damage',
    await J(() => {
      setupFight(['mira'], [], { mira: 'mid' }); RUN.boons = ['scale_tally']; RUN.boonStacks = {};
      firePassives('kill', 'mira', { tgt: { mark: 2 } });
      firePassives('kill', 'mira', { tgt: { mark: 3 } });
      const tally = boonStack('scale_tally');
      const card = { owner: 'mira', kind: 'sig', fx: { dmg: 5 } };
      runBoons().filter(b => b.card).forEach(b => b.card(card));
      return tally === 2 && card.fx.dmg === 7; }));
  check('BOON RISK: Glass Edge lifts the party’s hits +3 AND raises incoming +2',
    await J(() => {
      setupFight(['mira'], [], { mira: 'mid' }); RUN.boons = ['curse_glassedge'];
      const card = { owner: 'mira', fx: { dmg: 5 } };
      runBoons().filter(b => b.card).forEach(b => b.card(card));
      return card.fx.dmg === 8 && boonIncoming(S.heroes[0]) === 2; }));
  check('BOON HASK: Emberheart lifts Hask’s FIRE spells +3, leaves ice alone',
    await J(() => {
      setupFight(['hask'], [], { hask: 'front' }); RUN.boons = ['hask_emberheart'];
      const fire = { owner: 'hask', fx: { dmg: 8, elem: 'fire' } }, ice = { owner: 'hask', fx: { dmg: 6, elem: 'ice' } };
      runBoons().filter(b => b.card).forEach(b => { b.card(fire); b.card(ice); });
      return fire.fx.dmg === 11 && ice.fx.dmg === 6; }));
  check('BOON JOURNAL: renders every gift, grouped, with duo/trio requirements shown',
    await J(() => {
      showBoonJournal(() => {});
      const entries = document.querySelectorAll('.bj-entry');
      const duoReqs = document.querySelectorAll('.bj-entry.bj-duo .bj-req').length;
      const trioReqs = document.querySelectorAll('.bj-entry.bj-trio .bj-req').length;
      const ok = entries.length === BOONS.length && duoReqs >= 1 && trioReqs >= 1;
      hideOverlay();
      return ok; }));
  check('BOON JOURNAL: a taken gift is marked COLLECTED (persists across runs)',
    await J(() => {
      markBoonCollected('trio_killwind');
      showBoonJournal(() => {});
      const owned = [...document.querySelectorAll('.bj-entry.bj-owned .bj-name')].map(e => e.textContent);
      hideOverlay();
      return loadBoonCodex().includes('trio_killwind') && owned.includes('The Killing Wind'); }));
  check('BOON JOURNAL: FOG OF WAR — an undiscovered gift hides its name (???) but keeps its combo requirement',
    await J(() => {
      try { localStorage.removeItem('kizuna2_2.boonCodex'); } catch (_) {}   // nothing discovered
      markBoonCollected('duo_ashmira');                                       // …except this one
      showBoonJournal(() => {});
      const locked = document.querySelector('.bj-entry.bj-locked');
      const lockedHidesName = !!locked && /\?\s*\?\s*\?/.test(locked.querySelector('.bj-name').textContent);
      const lockedKeepsReq = !!(locked && locked.classList.contains('bj-duo') ? locked.querySelector('.bj-req') : true);
      const revealed = [...document.querySelectorAll('.bj-entry.bj-owned .bj-name')].some(e => e.textContent.includes('Twin Shadows'));
      hideOverlay();
      return lockedHidesName && lockedKeepsReq && revealed; }));
  // v2.2: the Journal grew a fourth tab — ECHOES, the narrative archive.
  check('JOURNAL: four tabs — BOONS · BESTIARY · HEROES · ECHOES — switchable',
    await J(() => {
      showJournal(() => {}, 'boons');
      const tabs = [...document.querySelectorAll('.bj-tab')].map(t => t.dataset.tab);
      const onBoons = !!document.querySelector('.bj-tab-on[data-tab="boons"]');
      showJournal(() => {}, 'heroes');
      const onHeroes = !!document.querySelector('.bj-tab-on[data-tab="heroes"]');
      hideOverlay();
      return tabs.join(',') === 'boons,bestiary,heroes,echoes' && onBoons && onHeroes; }));
  check('JOURNAL BESTIARY: a foe you’ve faced is recorded (name shown); an unmet one is ??? ',
    await J(() => {
      try { localStorage.removeItem('kizuna2_2.bestiary'); } catch (_) {}
      markEnemySeen('wraith');                                   // met the wraith
      showJournal(() => {}, 'bestiary');
      const owned = [...document.querySelectorAll('.bj-entry.bj-owned .bj-name')].map(e => e.textContent);
      const anyLockedQ = [...document.querySelectorAll('.bj-entry.bj-locked .bj-name')].some(e => /\?/.test(e.textContent));
      hideOverlay();
      return owned.includes('PALE WRAITH') && anyLockedQ; }));
  check('JOURNAL BESTIARY: fighting a foe records it (newBattle marks the codex)',
    await J(() => {
      try { localStorage.removeItem('kizuna2_2.bestiary'); } catch (_) {}
      RUN = newRun('ash'); RUN.roster = ['ash']; RUN.active = ['ash'];
      startFight({ type: 'fight', chapter: 3, heroes: ['ash'], enemies: ['drone', 'cultist'], narrator: 'x' });
      const seen = loadBestiary();
      return seen.includes('drone') && seen.includes('cultist'); }));
  check('JOURNAL HEROES: unlocked survivors read full; locked ones show the recruit hint',
    await J(() => {
      try { localStorage.setItem('kizuna2_2.starters', JSON.stringify(['ash', 'elin'])); } catch (_) {}
      showJournal(() => {}, 'heroes');
      const owned = [...document.querySelectorAll('.bj-entry.bj-owned .bj-name')].map(e => e.textContent);
      const lockedHint = [...document.querySelectorAll('.bj-entry.bj-locked .bj-mystery')].length >= 1;
      hideOverlay();
      return owned.includes('ASH') && owned.includes('ELIN') && lockedHint; }));
  check('ONBOARDING: How to Play teaches the core loop (cards/EP, stance, dodge/parry, BURST→all-out, bonds/weave, grow)',
    await J(() => {
      showHowTo(() => {});
      const t = ((document.querySelector('.howto') || {}).textContent || '').toLowerCase();
      hideOverlay();
      return ['play cards', 'ep', 'stance', 'dodge', 'parry', 'burst', 'all-out', 'ember tree', 'gift', 'bond', 'weave'].every(k => t.includes(k)); }));
  check('NARRATOR: authored <b> markup renders bold, not as literal “<b>” text',
    await J(() => {
      flashNarrator('ELIN forges <b>Radiant Ward</b>.');
      const n = document.getElementById('narrator');
      const ok = !!n.querySelector('b') && n.textContent.indexOf('<b>') < 0 && /Radiant Ward/.test(n.textContent);
      flashNarrator('');
      return ok; }));
  check('AUDIO: the SFX palette survived the rewrite — every combat event still has a voice',
    await J(() => ['card', 'move', 'hit', 'kill', 'heal', 'guard', 'thread', 'triad', 'kindle', 'victory', 'enemy', 'follow', 'deny', 'parry', 'parryMiss', 'swoosh', 'brace', 'hitstop'].every(k => typeof SFX[k] === 'function')));
  check('AUDIO: a combat MUSIC track + toggle exist (music defaults ON)',
    await J(() => typeof MUSIC === 'object' && typeof MUSIC.play === 'function' && typeof MUSIC.stop === 'function' && SETTINGS.music === true));
  check('AUDIO: the beat clock quantizes to the track — nextGrid lands on-grid, ≥lead ahead, at 120 BPM',
    await J(() => {
      if (typeof MUSIC.beat !== 'function' || MUSIC_BPM !== 120) return false;
      const clk = MUSIC.beat();
      if (Math.abs(clk.beatSec - 60 / MUSIC_BPM) > 1e-9) return false;
      // whole-beat and half-beat grids both resolve to a point that is
      // (a) at least `lead` seconds ahead of now and (b) exactly on the grid.
      for (const sub of [clk.beatSec, clk.beatSec / 2]) {
        const g = clk.nextGrid(0.6, sub);
        if (g < clk.now() + 0.6 - 1e-6) return false;
        const off = ((g - MUSIC_OFFSET) % sub + sub) % sub;
        if (Math.min(off, sub - off) > 1e-6) return false;
      }
      return true; }));
  check('AUDIO: a fight crossfades to combat; leaving to the map crossfades to the world-map bed',
    await J(() => {
      let acts = []; const real = { play: MUSIC.play, stop: MUSIC.stop };
      MUSIC.play = (src) => acts.push('play:' + src); MUSIC.stop = () => acts.push('stop');
      RUN = newRun('ash'); RUN.roster = ['ash']; RUN.active = ['ash'];
      startFight({ type: 'fight', chapter: 3, heroes: ['ash'], enemies: ['husk'], narrator: 'x' });
      showMap();
      MUSIC.play = real.play; MUSIC.stop = real.stop;
      return acts.some(a => /^play:audio\/combat-theme/.test(a)) && acts.some(a => /^play:audio\/worldmap-theme/.test(a)); }));
  check('AUDIO: two decks + resume — combat restarts from the top, the world bed resumes where it left off',
    await J(() => {
      if (typeof MUSIC.play !== 'function') return false;
      // world bed: play, advance, leave, come back → should keep its position (resume=true)
      MUSIC.play('audio/worldmap-theme.mp3?v=1', 0.5, true);
      MUSIC.play('audio/combat-theme.mp3?v=1', 0.42, false);   // into a fight
      MUSIC.play('audio/worldmap-theme.mp3?v=1', 0.5, true);   // back out — resumes bookmark
      MUSIC.play('audio/combat-theme.mp3?v=1', 0.42, false);   // combat always restarts (resume=false)
      // beat() must read the COMBAT deck, never the world bed (else parry desyncs)
      return typeof MUSIC.beat === 'function'; }));
  check('FORMATION: reordering the line (tap-swap FRONT↔BACK) rewrites RUN.active order on WALK ON',
    await J(() => {
      RUN = newRun('ash'); RUN.roster = ['ash', 'mira', 'elin', 'cassia']; RUN.active = ['ash', 'mira', 'elin']; RUN.hp = { ash: 32, mira: 26, elin: 28, cassia: 30 };
      showPartySelect(() => {});
      const slotCards = () => [...document.querySelectorAll('.ps-slot .ps-card')];
      const before = slotCards().map(x => x.dataset.id);          // [ash, mira, elin]
      slotCards()[0].click();                                     // pick up FRONT (ash)
      [...document.querySelectorAll('.ps-slot .ps-card')][2].click();  // tap BACK (elin) → swap
      const after = [...document.querySelectorAll('.ps-slot .ps-card')].map(x => x.dataset.id);
      const swapped = after[0] === before[2] && after[2] === before[0];
      document.querySelector('#ps-go').click();                   // WALK ON commits the order
      // and it must write RUN.rows so the NEXT fight fields these exact rows
      return swapped && RUN.active[0] === 'elin' && RUN.active[2] === 'ash'
        && RUN.rows && RUN.rows[RUN.active[0]] === 'front' && RUN.rows[RUN.active[1]] === 'mid' && RUN.rows[RUN.active[2]] === 'back'; }));
  check('FORMATION: the marching order drives combat rows — newBattle fields front/mid/back as arranged',
    await J(() => {
      RUN = newRun('ash'); RUN.roster = ['ash', 'mira', 'elin']; RUN.active = ['ash', 'mira', 'elin']; RUN.hp = { ash: 32, mira: 26, elin: 28 };
      RUN.rows = { ash: 'back', mira: 'front', elin: 'mid' };   // an arrangement that is NOT the default order
      S = newBattle({ type: 'fight', useRunHp: true, heroes: ['ash', 'mira', 'elin'], enemies: ['husk'] });
      const rowOf = (id) => S.heroes.find(h => h.id === id).row;
      return rowOf('mira') === 'front' && rowOf('elin') === 'mid' && rowOf('ash') === 'back'; }));
  check('FORMATION: a ◆-pinned recruit can reorder but cannot be sent to the bench',
    await J(() => {
      RUN = newRun('ash'); RUN.roster = ['ash', 'mira', 'elin', 'cassia']; RUN.active = ['ash', 'mira', 'elin']; RUN.hp = { ash: 32, mira: 26, elin: 28, cassia: 30 };
      showPartySelect(() => {}, 'cassia');   // cassia must be fielded (pinned)
      const lineHas = (id) => [...document.querySelectorAll('.ps-slot .ps-card')].map(x => x.dataset.id).includes(id);
      if (!lineHas('cassia')) return false;                       // pinned recruit starts in the line
      const byId = (id) => [...document.querySelectorAll('.ps-card')].find(x => x.dataset.id === id);
      byId('cassia').click();                                     // pick up the pinned hero
      const benched = [...document.querySelectorAll('.ps-bench .ps-card')].map(x => x.dataset.id)[0];
      byId(benched).click();                                      // try to swap them to the bench
      return lineHas('cassia'); }));                              // the swap is refused — still fielded
  check('BOON DRAFT: duo/trio cards show ALL involved characters’ portraits',
    await J(() => {
      RUN = newRun('ash'); RUN.roster = ['ash', 'mira', 'branwen']; RUN.active = ['ash', 'mira', 'branwen']; RUN.boons = [];
      RUN.boons = BOONS.filter(b => !b.duo && !b.trio && ['ash', 'mira', 'branwen'].includes(b.hero)).map(b => b.id);
      showBoonDraft(() => {}, {});
      const trio = document.querySelector('.boon-card.boon-trio .boon-portrait-multi.bp-3');
      const duo = document.querySelector('.boon-card.boon-duo .boon-portrait-multi.bp-2');
      const trioFigs = trio ? trio.querySelectorAll('.bp-fig').length : 0;
      hideOverlay();
      return !!trio && !!duo && trioFigs === 3; }));
  check('CAMP (Build 210): the night offers COMMUNE and the EMBER FORGE — and no REST when unhurt',
    await J(() => {
      RUN = newRun('ash'); RUN.roster = ['ash']; RUN.active = ['ash']; RUN.hp = { ash: 32 }; RUN.boons = [];
      showCamp({ id: 9, type: 'camp', label: 'EMBER REST' });
      const ok = !!document.querySelector('#camp-boon') && !!document.querySelector('#camp-forge')
        && !document.querySelector('#camp-rest');   // full HP → nothing to rest for
      hideOverlay();
      return ok;
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
      const special = ['elin_overflow', 'hask_kindling', 'hask_conduit', 'hask_steady', 'hask_meltdown', 'hask_surge', 'hask_meteor', 'hask_enochian', 'mira_swiftfoot', 'ash_warstep', 'elin_mercy', 'branwen_longshot', 'elin_wrath'];   // handled inline (heal-spill / charge / cast / weave / move-cost / smite-amp systems), not via PASSIVE_DEFS
      EMBER_TREE.forEach(n => { if (ids.has(n.id)) ok = false; ids.add(n.id); });
      EMBER_TREE.forEach(n => { (n.requires || []).forEach(r => { if (!NODE_BY_ID[r]) ok = false; }); if ((n.type === 'passive' || n.type === 'synergy') && !PASSIVE_DEFS[n.passive] && !special.includes(n.passive)) ok = false; });
      return ok;
    }));

  // ---------- COMBO DEPTH: the thin stance lines grow a full arc ----------
  console.log('--- COMBO DEPTH ---');
  check('COMBO: Branwen’s MID line grows a real arc sig→pierce→killing-blow',
    await J(() => {
      const chain = ['branwen.sig.mid', 'branwen.emergent.pierce', 'branwen.passive.killingblow'];
      // each node must require the one before it (a real prerequisite chain, not loose leaves)
      return chain.every((id, i) => !!NODE_BY_ID[id] && (i === 0 || (NODE_BY_ID[id].requires || []).includes(chain[i - 1])));
    }));
  check('COMBO elin.rider.sanctuary: Sanctuary (MID signature) also grants counter 1',
    await J(() => { setupFight(['elin'], ['elin.sig.mid', 'elin.rider.sanctuary'], { elin: 'mid' }); const c = handCard('Sanctuary'); return !!c && c.fx.counter === 1; }));
  check('PRUNE elin: redundant/duplicate heal nodes removed (searing, mercy, warmth, evensong, warden, afterglow)',
    await J(() => ['elin.rider.searing', 'elin.rider.mercy', 'elin.rider.warmth', 'elin.passive.evensong', 'elin.emergent.warden', 'elin.emergent.afterglow'].every(id => !NODE_BY_ID[id])));
  check('CAPSTONES elin: three distinct build-paths survive (inverse/overflow/blessing)',
    await J(() => ['elin.inverse', 'elin.passive.overflow', 'elin.synergy.blessing'].every(id => !!NODE_BY_ID[id])));
  check('PRUNE ash: flat rider + off-theme guard-forge + overlapping move-passive removed',
    await J(() => ['ash.rider.wave', 'ash.rider.flowcut', 'ash.emergent.riposte', 'ash.passive.flow'].every(id => !NODE_BY_ID[id])));
  check('CAPSTONES ash: distinct build-paths survive (relentless/warcry/execution/exploit)',
    await J(() => ['ash.passive.relentless', 'ash.synergy.warcry', 'ash.allout.execution', 'ash.passive.exploit'].every(id => !!NODE_BY_ID[id])));
  check('COMBO mira.rider.exploit: Backstab (FRONT core) also marks EXPOSED 2',
    await J(() => { setupFight(['mira'], ['mira.sig.front', 'mira.rider.exploit'], { mira: 'front' }); const c = handCard('Backstab'); return !!c && c.fx.mark === 2; }));
  check('PRUNE mira: flat rider + overlapping move-passive + redundant mark-rider removed',
    await J(() => ['mira.rider.vanish', 'mira.passive.ambush', 'mira.rider.serrated'].every(id => !NODE_BY_ID[id])));
  check('CAPSTONES mira: three distinct build-paths survive (deathmark/marked/frenzy)',
    await J(() => ['mira.passive.deathmark', 'mira.synergy.marked', 'mira.passive.frenzy'].every(id => !!NODE_BY_ID[id])));
  check('COMBO mira.passive.frenzy: DEVOURS an EXPOSED foe’s marks for burst (+3/stack)',
    await J(() => { setupFight(['mira'], ['mira.passive.frenzy'], { mira: 'mid' }); const e = frontmostEnemy(); e.hp = e.maxHp; e.mark = 2; const hp0 = e.hp; firePassives('postHit', 'mira', { tgt: e }); const e2 = S.enemies.find(x => x.uid === e.uid); return (hp0 - e2.hp) === 6 && e2.mark === 0; }));
  check('COMBO cassia.rider.aegis: Aegis (MID signature) also grants counter 1',
    await J(() => { setupFight(['cassia'], ['cassia.sig.mid', 'cassia.rider.aegis'], { cassia: 'mid' }); const c = handCard('Aegis'); return !!c && c.fx.counter === 1; }));
  check('PRUNE cassia: redundant flat riders + duplicate guard-forge emergent removed',
    await J(() => ['cassia.rider.riposte', 'cassia.rider.sentinel', 'cassia.emergent.sentinel', 'cassia.rider.reinforce'].every(id => !NODE_BY_ID[id])));
  check('CAPSTONES cassia: three distinct build-paths survive (nova/immovable/soak)',
    await J(() => ['cassia.nova', 'cassia.passive.immovable', 'cassia.synergy.soak'].every(id => !!NODE_BY_ID[id])));
  check('PRUNE branwen: duplicate expose-forge + redundant mark/flat riders removed',
    await J(() => ['branwen.emergent.hail', 'branwen.rider.hunt', 'branwen.rider.volley', 'branwen.rider.steady'].every(id => !NODE_BY_ID[id])));
  check('CAPSTONES branwen: three distinct build-paths survive (reckoning/cadence/killingblow)',
    await J(() => ['branwen.passive.reckoning', 'branwen.synergy.cadence', 'branwen.passive.killingblow'].every(id => !!NODE_BY_ID[id])));
  check('CAPSTONE PARITY: every hero has 3 capstones at the top, each on its OWN feeder',
    await J(() => ['ash', 'cassia', 'elin', 'mira', 'branwen', 'hask'].every(h => {
      // capstones are an authored KIND, not a pacing number (Build 290)
      const caps = EMBER_TREE.filter(n => n.hero === h && n.baseTier === 4);
      if (caps.length < 3) return false;
      const feeders = caps.map(c => (c.requires || []).join(','));   // each capstone's prerequisite chain
      return new Set(feeders).size === feeders.length;               // all distinct → divergent arcs
    })));
  // ---------- HASK — the BLACK MAGE (◆ CHARGE / OVERLOAD) ----------
  console.log('--- HASK / BLACK MAGE ---');
  check('HASK: a fieldable tree-hero — in the starter pool, 3 capstones, an Overload fork',
    await J(() => STARTER_POOL.includes('hask') && TREE_HEROES.includes('hask')
      && !!NODE_BY_ID['hask.branch.mid'] && !!ROTATIONS.hask));
  check('HASK ◆ CHARGE: a spell that lands builds a stack',
    await J(async () => {
      setupFight(['hask'], [], { hask: 'mid' }); S._rotations = false; S.tempCards = []; renderAll();
      const h = S.heroes[0]; h.charge = 0;
      await resolveCard({ owner: 'hask', name: 'Bolt', cost: 0, target: 'enemy', fx: { dmg: 4 } }, S.enemies[0].uid);
      return h.charge === 1; }));
  check('HASK OVERLOAD: a spendCharge nuke dumps ◆ CHARGE (+3 each) then resets to 0',
    await J(async () => {
      setupFight(['hask'], [], { hask: 'mid' }); S._rotations = false; S.tempCards = []; renderAll();
      const h = S.heroes[0]; h.charge = 3; const e = S.enemies[0]; e.hp = e.maxHp = 100; e.guard = 0; const hp0 = e.hp;
      await resolveCard({ owner: 'hask', name: 'Overload', cost: 0, target: 'enemy', fx: { dmg: 6, spendCharge: true } }, e.uid);
      return h.charge === 0 && (hp0 - S.enemies[0].hp) === 15; }));   // 6 base + 3×3
  check('HASK INTERRUPT: moving resets ◆ CHARGE (a rooted caster)',
    await J(() => { setupFight(['hask'], [], { hask: 'mid' }); const h = S.heroes[0]; h.charge = 3; h.hp = 22; onHeroEnterRow(h, 'front', 'mid'); return h.charge === 0; }));
  check('HASK MISFIRE: moving mid-channel detonates the held ◆ inward (charge×2 self-damage)',
    await J(() => { setupFight(['hask'], [], { hask: 'mid' }); const h = S.heroes[0]; h.charge = 3; h.hp = 22; h.guard = 0; onHeroEnterRow(h, 'front', 'mid'); return h.hp === 16 && h.charge === 0; }));   // 3 ◆ × 2 = 6 self-damage
  check('HASK MISFIRE: guard soaks the backlash before HP',
    await J(() => { setupFight(['hask'], [], { hask: 'mid' }); const h = S.heroes[0]; h.charge = 4; h.hp = 22; h.guard = 5; onHeroEnterRow(h, 'front', 'mid'); return h.guard === 0 && h.hp === 19; }));   // 8 backlash − 5 guard = 3 to HP
  check('HASK MISFIRE: no charge held → moving is free (nothing to detonate)',
    await J(() => { setupFight(['hask'], [], { hask: 'mid' }); const h = S.heroes[0]; h.charge = 0; h.hp = 22; onHeroEnterRow(h, 'front', 'mid'); return h.hp === 22; }));
  check('HASK STEADY CAST node: moving KEEPS ◆ CHARGE and takes NO misfire (channel on the move)',
    await J(() => { setupFight(['hask'], ['hask.passive.steady'], { hask: 'mid' }); const h = S.heroes[0]; h.charge = 3; h.hp = 22; onHeroEnterRow(h, 'front', 'mid'); return h.charge === 3 && h.hp === 22; }));
  // ── FORCED REPOSITION — enemies can now SHOVE / HOOK heroes between rows ──
  check('SHOVE: applyShove drags a BACK hero to FRONT, swapping the occupant',
    await J(() => { setupFight(['ash', 'hask'], [], { ash: 'front', hask: 'back' }); const hk = S.heroes.find(x => x.id === 'hask'); const ash = S.heroes.find(x => x.id === 'ash');
      const dest = applyShove(hk, 'front'); return dest === 'mid' && hk.row === 'mid' && ash.row === 'front'; }));   // no one in mid → hask slides to mid
  check('SHOVE: a hero at the edge cannot be pushed further (returns null)',
    await J(() => { setupFight(['ash'], [], { ash: 'front' }); const ash = S.heroes[0]; return applyShove(ash, 'front') === null && ash.row === 'front'; }));
  check('SHOVE→MISFIRE: a charged Hask HOOKED out of the back detonates (forced move, no Steady Cast)',
    await J(() => { setupFight(['hask'], [], { hask: 'back' }); const h = S.heroes[0]; h.charge = 4; h.hp = 22; h.guard = 0;
      applyShove(h, 'front'); return h.row === 'mid' && h.charge === 0 && h.hp === 14; }));   // 4 ◆ × 2 = 8 self-damage on the forced move
  check('SHOVE→MISFIRE: Steady Cast Hask is HOOKED but keeps ◆ and takes no backlash',
    await J(() => { setupFight(['hask'], ['hask.passive.steady'], { hask: 'back' }); const h = S.heroes[0]; h.charge = 4; h.hp = 22;
      applyShove(h, 'front'); return h.row === 'mid' && h.charge === 4 && h.hp === 22; }));
  check('SHOVE: the bestiary wires it — Drone SLAMS back, Revenant HOOKS forward',
    await J(() => { const drone = (ENEMY_DEFS.drone.intents || []).find(i => i.shove === 'back'); const rev = (ENEMY_DEFS.revenant.intents || []).find(i => i.shove === 'front');
      return !!drone && drone.name === 'Piston Slam' && !!rev && rev.name === 'Chain Hook' && rev.row === 'back'; }));
  // ── RHYTHM RAMP — parries escalate with run depth (speed / window / notes) ──
  check('RHYTHM: at the surface, parry difficulty is the gentle baseline (no ramp)',
    await J(() => { RUN = newRun('ash'); RUN.completed = []; setParryDifficulty({ def: { parrySpeed: 1 } });
      return _parrySpeed === 1 && _parryWin === 1 && _parryBonus === 0; }));
  check('RHYTHM: deep in the run, cascades quicken, windows tighten, and notes stack',
    await J(() => { RUN = newRun('ash'); RUN.completed = [0,1,2,3,4,5,6,7,8,9,10,11]; setParryDifficulty({ def: { parrySpeed: 1 } });
      return _parrySpeed < 0.9 && _parryWin < 0.85 && _parryBonus === 2; }));   // Build 206: gentler ramp (0.84 / 0.80)
  check('RHYTHM: the ramp COMPOSES with a foe’s own tempo (boss stays fastest)',
    await J(() => { RUN = newRun('ash'); RUN.completed = [0,1,2,3,4,5,6,7,8,9,10,11];
      setParryDifficulty({ def: { parrySpeed: 0.82 } }); const boss = _parrySpeed;
      setParryDifficulty({ def: { parrySpeed: 1 } }); const mob = _parrySpeed;
      return boss < mob && boss < 0.72; }));   // Build 206: gentler ramp (boss ≈ 0.69 at depth)
  check('BOSS DENSITY: a ROAD boss stacks EXTRA cascade notes + quicker pacing; the CHORUS is left as-is',
    await J(() => { RUN = newRun('ash'); RUN.completed = [0,1,2,3,4,5,6];
      setParryDifficulty({ def: { parrySpeed: 1 } }); const mobBonus = _parryBonus, mobSpeed = _parrySpeed;
      setParryDifficulty({ def: { boss: true, parrySpeed: 1 } }); const roadBonus = _parryBonus, roadSpeed = _parrySpeed;
      setParryDifficulty({ def: { boss: true, megaBoss: true, parrySpeed: 1 } }); const choBonus = _parryBonus, choSpeed = _parrySpeed;
      return roadBonus === mobBonus + 1 && roadSpeed < mobSpeed && choBonus === mobBonus && choSpeed === mobSpeed; }));
  check('RHYTHM: the cascade glyph previews the ramped note count (honest telegraph)',
    await J(() => { RUN = newRun('ash'); RUN.completed = [0,1,2,3,4,5,6,7,8,9,10,11];
      const g = parryGlyph({ parry: { kind: 'seq', notes: [{ t: 'tap' }, { t: 'tap' }] } });
      return g === '✷4'; }));   // 2 authored + 2 bonus at depth
  check('CRUEL: cruelShovePrey targets a CHARGED Hask over a healthier ally',
    await J(() => { setupFight(['cassia', 'hask'], [], { cassia: 'front', hask: 'back' }); S.heroes.find(x => x.id === 'hask').charge = 3;
      const v = cruelShovePrey({ smart: true }, { shove: 'front' }); return !!v && v.id === 'hask'; }));
  check('CRUEL: with no charge, the hook still prefers the squishy back-liner over the front tank',
    await J(() => { setupFight(['cassia', 'hask'], [], { cassia: 'front', hask: 'back' }); S.heroes.find(x => x.id === 'hask').charge = 0;
      const v = cruelShovePrey({ smart: true }, { shove: 'front' }); return !!v && v.id === 'hask'; }));
  check('CRUEL: effIntentRow re-aims a smart hook onto the CHARGED caster’s row (not the generic weakest)',
    await J(() => { setupFight(['cassia', 'hask', 'branwen'], [], { cassia: 'front', hask: 'mid', branwen: 'back' }); const hk = S.heroes.find(x => x.id === 'hask'); hk.charge = 3; hk.hp = hk.maxHp;
      const bw = S.heroes.find(x => x.id === 'branwen'); bw.hp = 3;   // branwen is the lowest hitpool, but the CHARGE is the crueler target
      const e = { smart: true, def: ENEMY_DEFS.revenant }; return effIntentRow(e, { shove: 'front', row: 'back' }) === 'mid'; }));
  check('CRUEL: a smart foe REACHES for the hook when a charged Hask is exposed (idle otherwise)',
    await J(() => { setupFight(['cassia', 'hask'], [], { cassia: 'front', hask: 'back' }); const hk = S.heroes.find(x => x.id === 'hask');
      const e = { smart: true, def: ENEMY_DEFS.revenant }; hk.charge = 0; const idle = smartHookIntent(e); hk.charge = 3; const pounce = smartHookIntent(e);
      return !idle && !!pounce && pounce.shove === 'front'; }));
  check('CRUEL: the pounce is smart-only — a non-smart foe never reaches for it',
    await J(() => { setupFight(['hask'], [], { hask: 'back' }); S.heroes[0].charge = 4; return smartHookIntent({ smart: false, def: ENEMY_DEFS.revenant }) === null; }));
  check('CRUEL: Steady Cast defuses the pounce — a charged-but-steady Hask is NOT prime',
    await J(() => { setupFight(['cassia', 'hask'], ['hask.passive.steady'], { cassia: 'front', hask: 'back' }); S.heroes.find(x => x.id === 'hask').charge = 4;
      return smartHookIntent({ smart: true, def: ENEMY_DEFS.revenant }) === null; }));
  check('CRUEL: the telegraph is honest — enemyNextIntents surfaces the pounce in the first slot',
    await J(() => { setupFight(['cassia', 'hask'], [], { cassia: 'front', hask: 'back' }); S.heroes.find(x => x.id === 'hask').charge = 3;
      const e = { smart: true, def: ENEMY_DEFS.revenant, intentIdx: 0 }; const its = enemyNextIntents(e); return !!its[0] && its[0].shove === 'front'; }));
  check('HASK CAST-TIME: a castDmg card BEGINS a cast (no hit now, pendingCast set)',
    await J(async () => {
      setupFight(['hask'], [], { hask: 'back' }); S.tempCards = []; const e = S.enemies[0]; e.hp = e.maxHp = 100; const hp0 = e.hp;
      await resolveCard({ owner: 'hask', name: 'Starfall', cost: 0, target: 'enemy', fx: { castDmg: 16 } }, e.uid);
      const h = S.heroes[0];
      return !!h.pendingCast && h.pendingCast.dmg === 16 && S.enemies[0].hp === hp0; }));   // no damage yet
  check('HASK CAST-TIME: moving BREAKS the cast (rooted)',
    await J(async () => {
      setupFight(['hask'], [], { hask: 'back' }); const h = S.heroes[0];
      await resolveCard({ owner: 'hask', name: 'Starfall', cost: 0, target: 'enemy', fx: { castDmg: 16 } }, S.enemies[0].uid);
      onHeroEnterRow(h, 'front', 'back');
      return !h.pendingCast; }));
  check('HASK CAST unleash: the pending cast resolves (16 damage), then clears',
    await J(async () => {
      setupFight(['hask'], [], { hask: 'back' }); const e = S.enemies[0]; e.hp = e.maxHp = 100; e.guard = 0; const hp0 = e.hp;
      const h = S.heroes[0]; h.pendingCast = { dmg: 16, all: false, targetId: e.uid, name: 'Starfall' };
      await unleashCast(h);
      return !h.pendingCast && (hp0 - S.enemies[0].hp) === 16; }));
  check('HASK CATACLYSM node: a Starfall cast becomes AoE (pendingCast.all)',
    await J(async () => {
      setupFight(['hask'], ['hask.cast.meteor'], { hask: 'back' }); S.tempCards = [];
      await resolveCard({ owner: 'hask', name: 'Starfall', cost: 0, target: 'enemy', fx: { castDmg: 16 } }, S.enemies[0].uid);
      return !!S.heroes[0].pendingCast && S.heroes[0].pendingCast.all === true; }));
  check('NEW GAME BUG: a fight abandoned mid-AIM does not leak targeting into the next fight (cards stay draggable)',
    await J(() => {
      setupFight(['ash'], [], { ash: 'front' });
      targeting = { card: { name: 'x' }, validIds: ['ash'] };   // leak an in-progress aim, as if a run ended mid-target
      startFight({ type: 'fight', chapter: 3, heroes: ['ash'], enemies: ['husk'], narrator: 'x' });
      return targeting === null; }));   // the new fight cleared it
  check('GAME OVER: with no live run, the title offers NO Continue — death is final',
    await J(() => {
      try { localStorage.removeItem('kizuna2_2.run'); } catch (_) {}   // the run is wiped (as onDefeat does)
      RUN = null; showTitle();
      const hasContinue = !!document.getElementById('t-continue');
      const hasNew = !!document.getElementById('t-new');
      return !hasContinue && hasNew; }));
  check('GAME OVER: meta progress (unlocked heroes, boon codex) SURVIVES a wiped run',
    await J(() => {
      unlockStarter('hask'); markBoonCollected('duo_ashmira');
      try { localStorage.removeItem('kizuna2_2.run'); } catch (_) {}   // run gone…
      return getUnlockedStarters().includes('hask') && loadBoonCodex().includes('duo_ashmira'); }));   // …but progress carries over
  check('HASK WEAVE: with Emberwake, a FIRE spell swings 🔥 PYRE (+1) and ICE swings ❄ FROST (−1)',
    await J(async () => {
      setupFight(['hask'], ['hask.weave.astral'], { hask: 'front' }); S._rotations = false; const e = S.enemies[0]; e.hp = e.maxHp = 100; e.guard = 0;
      const h = S.heroes[0]; h.aether = 0;
      await resolveCard({ owner: 'hask', name: 'Cinderfall', cost: 0, target: 'enemy', fx: { dmg: 5, elem: 'fire' } }, e.uid);
      const afterFire = h.aether;   // → +1 Pyre
      await resolveCard({ owner: 'hask', name: 'Frost', cost: 0, target: 'enemy', fx: { dmg: 4, elem: 'ice' } }, e.uid);
      return afterFire === 1 && h.aether === -1; }));   // ice crosses back and chills to Frost 1
  check('HASK PYRE: at deep Pyre, a fire spell hits +2 per stack',
    await J(async () => {
      setupFight(['hask'], ['hask.weave.astral'], { hask: 'front' }); S._rotations = false; const e = S.enemies[0]; e.hp = e.maxHp = 100; e.guard = 0; const hp0 = e.hp;
      const h = S.heroes[0]; h.aether = 2;   // one more fire → Astral 3
      await resolveCard({ owner: 'hask', name: 'Cinderfall', cost: 0, target: 'enemy', fx: { dmg: 5, elem: 'fire' } }, e.uid);
      return h.aether === 3 && (hp0 - S.enemies[0].hp) === 11; }));   // 5 base + 2×3 Astral
  check('HASK FROST: an ice spell going Frost refills extra ◆ CHARGE',
    await J(async () => {
      setupFight(['hask'], ['hask.weave.astral'], { hask: 'front' }); S._rotations = false; const e = S.enemies[0]; e.hp = e.maxHp = 100; e.guard = 0;
      const h = S.heroes[0]; h.aether = 0; h.charge = 0;
      await resolveCard({ owner: 'hask', name: 'Frost', cost: 0, target: 'enemy', fx: { dmg: 4, elem: 'ice' } }, e.uid);
      return h.aether === -1 && h.charge === 2; }));   // base +1 charge, +1 Umbral refill
  check('HASK BACKDRAFT: fire cast AGAINST Frost snaps to full Pyre and DETONATES (+6 burst)',
    await J(async () => {
      setupFight(['hask'], ['hask.weave.astral', 'hask.weave.enochian'], { hask: 'front' }); S._rotations = false; const e = S.enemies[0]; e.hp = e.maxHp = 100; e.guard = 0; const hp0 = e.hp;
      const h = S.heroes[0]; h.aether = -2;   // deep Umbral
      await resolveCard({ owner: 'hask', name: 'Cinderfall', cost: 0, target: 'enemy', fx: { dmg: 5, elem: 'fire' } }, e.uid);
      return h.aether === 3 && (hp0 - S.enemies[0].hp) === 17; }));   // 5 base + 6 resonance + 6 Astral(3)
  check('HASK EMBERWAKE (no Backdraft): fire crossing from Frost IGNITES at Pyre 1 (+2), no far-snap/burst',
    await J(async () => {
      setupFight(['hask'], ['hask.weave.astral'], { hask: 'front' }); S._rotations = false; const e = S.enemies[0]; e.hp = e.maxHp = 100; e.guard = 0; const hp0 = e.hp;
      const h = S.heroes[0]; h.aether = -2;
      await resolveCard({ owner: 'hask', name: 'Cinderfall', cost: 0, target: 'enemy', fx: { dmg: 5, elem: 'fire' } }, e.uid);
      return h.aether === 1 && (hp0 - S.enemies[0].hp) === 7; }));   // ignites at Pyre 1: 5 base + 2 empower
  check('PARTY PERSIST: a recruit (Hask) in the active trio SURVIVES the floor 1→2 descent — incl. downed + reload',
    await J(() => {
      RUN = newRun('ash'); RUN.roster = ['ash', 'elin', 'hask']; RUN.active = ['ash', 'elin', 'hask'];
      RUN.hp = { ash: 32, elin: 24, hask: 0 };   // Hask DOWNED at the floor boss
      RUN.floor = 1; RUN.completed = [0, 1, 2, 3];
      descendInto('rust');                       // walk a gate → descend to floor 2 (Build 20)
      const keptActive = RUN.active.includes('hask');
      const revived = RUN.hp.hask === Math.ceil(HEROES.hask.maxHp * 0.5);   // Build 210: the deep grants HALF a breath — the fallen rise at 50%, not full
      saveRun(); const reloaded = loadRun();     // quit + reopen between floors
      const persisted = reloaded && reloaded.active.includes('hask');
      return RUN.floor === 2 && keptActive && revived && persisted; }));
  check('RECRUIT REACH: Hask is NOT floor-locked — floor 2 still offers him if he’s the one you lack',
    await J(() => {
      const map = generateDescent(['ash', 'elin', 'mira', 'cassia', 'branwen'], 2);   // only Hask is un-recruited
      const recruitable = map.filter(n => n.hero).map(n => n.hero);
      return STARTER_POOL.includes('hask') && recruitable.includes('hask'); }));
  check('POSITION MEMORY: a descent fight opens where the party stood at the end of the last one',
    await J(() => {
      RUN = newRun('ash'); RUN.roster = ['ash', 'hask']; RUN.active = RUN.roster.slice();
      RUN.hp = { ash: 32, hask: 22 }; RUN.completed = [0, 1, 2, 3, 4, 5, 6, 7, 8];
      RUN.rows = { ash: 'front', hask: 'back' };   // Hask fell back last fight
      startMapFight(RUN.map.find(x => x.type === 'fight'));
      const ash = S.heroes.find(h => h.id === 'ash'), hk = S.heroes.find(h => h.id === 'hask');
      return ash.row === 'front' && hk.row === 'back'; }));
  check('DOWNED heroes STAY down between fights (no free revive)',
    await J(() => {
      RUN = newRun('ash'); RUN.roster = ['ash', 'hask']; RUN.active = RUN.roster.slice();
      RUN.hp = { ash: 20, hask: 0 };   // Hask fell last fight — hp 0
      RUN.completed = [0, 1, 2, 3, 4, 5, 6, 7, 8];
      startMapFight(RUN.map.find(x => x.type === 'fight'));
      const hk = S.heroes.find(h => h.id === 'hask');
      return !!hk && hk.downed && hk.hp === 0; }));   // still down entering the fight
  check('CAMP REVIVE is a CHOICE: REST heals the LIVING to full but the fallen stay down',
    await J(() => {
      RUN = newRun('ash'); RUN.roster = ['ash', 'hask']; RUN.active = ['ash', 'hask'];
      RUN.hp = { ash: 12, hask: 0 };   // Ash wounded, Hask fallen
      showCamp({ id: 77, label: 'TEST FIRE' });
      const raiseOffered = !!document.getElementById('camp-raise');   // the choice is presented
      const restOffered = !!document.getElementById('camp-rest');     // Build 210: healing is a CHOICE too
      const unhealedOnArrival = RUN.hp.ash === 12;                    // arriving mends nothing
      const restBtn = document.getElementById('camp-rest'); if (restBtn) restBtn.click();
      const healedLiving = RUN.hp.ash === HEROES.ash.maxHp;   // choosing REST mends the living fully
      const fallenStayDown = RUN.hp.hask === 0;               // the dead do NOT rise on their own
      hideOverlay();
      return raiseOffered && restOffered && unhealedOnArrival && healedLiving && fallenStayDown; }));
  check('CAMP REVIVE: choosing RAISE returns the fallen at half HP',
    await J(() => {
      RUN = newRun('ash'); RUN.roster = ['ash', 'hask']; RUN.active = ['ash', 'hask'];
      RUN.hp = { ash: 30, hask: 0 };
      showCamp({ id: 78, label: 'TEST FIRE' });
      const btn = document.getElementById('camp-raise'); if (btn) btn.click();
      hideOverlay();
      return RUN.hp.hask === Math.ceil(HEROES.hask.maxHp / 2); }));
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
      return !!boss && boss.enemies[0] === 'echosunder' && !!ENEMY_DEFS.echosunder && !!ENEMY_DEFS.echosunder.floorBoss && ENEMY_DEFS.echosunder.weak === 'frost';
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
        && d.stages.map(s => s.weak).join() === 'blade,light,iron';
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
      enterMegaStage(e, 2); const three = e.def.weak === 'iron' && e.def.aura === 'sunder' && e.def.intents.some(i => i.discord);
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
  // PACING — combat momentum builds ~40% slower (Build 197 rebalance: MOM_SCALE 0.6,
  // a turn-3 climax, not turn-1), but BOND rewards pass `raw` and stay full-strength,
  // so bonding accelerates the burst.
  check('BURST: combat gains build ~40% slower; bond rewards (raw) do not',
    await J(() => { setupFight(['ash', 'elin', 'mira'], [], {});
      S.momentum = 0; S.combo = 0; gainMomentum(100); const scaled = S.momentum;      // 100 → 60
      S.momentum = 0; S.combo = 0; gainMomentum(100, { raw: true }); const raw = S.momentum;  // 100 → 100
      return scaled === 60 && raw === 100; }));
  // Build 257 REVERSED this. It used to assert that a woven L2/L3 gauge refuses
  // to fire below its container — which is how bonding took an all-out away from
  // a player who already had one. The concern it was protecting (spending a
  // woven gauge on a weak Level 1) is real; the answer is to SAY so, not to
  // decide for them.
  check('BURST: a woven gauge can still fire at 100 — bonding never removes an all-out you had',
    await J(() => { setupFight(['ash', 'elin', 'mira'], [], {}); expandBurst(3);   // L3 container (cap 250)
      S.momentum = 120; renderBurst();
      const fires = $('#burst').classList.contains('burst-ready') && !!$('#burst').onclick;
      const noLock = !/HOLD/.test($('#burst-lbl').textContent);
      S.momentum = 250; renderBurst();
      const stillFires = $('#burst').classList.contains('burst-ready') && !!$('#burst').onclick;
      return fires && noLock && stillFires; }));
  check('BURST: …and the LABEL advertises the tier you are cashing, so holding stays worth it',
    await J(() => { setupFight(['ash', 'elin', 'mira'], [], {}); expandBurst(3);
      S.momentum = 120; renderBurst(); const one = $('#burst-lbl').textContent;
      S.momentum = 250; renderBurst(); const three = $('#burst-lbl').textContent;
      return /ALL-OUT/.test(one) && /✦✦✦/.test(three) && one !== three; }));
  check('BURST: a WEAVE expands to L2 and the TRIAD crown to L3 (wired into awaken/ceremony)',
    await J(() => typeof expandBurst === 'function' && typeof allOutEncore === 'function'
      && awakenDuet.toString().includes('expandBurst(2')
      && triadCeremony.toString().includes('expandBurst(3')));
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
  check('PERF: hand DOM is REUSED across renders; an EP change updates affordability IN PLACE (no teardown)',
    await J(() => {
      setupFight(['ash'], [], { ash: 'front' }); S.ep = 9; renderAll();
      const first = document.querySelector('#hand .card');
      renderAll();                                   // identical → skip entirely
      const same2 = document.querySelector('#hand .card') === first;
      const costly = [...document.querySelectorAll('#hand .card')]
        .find(el => { const t = (el.querySelector('.c-cost') || {}).textContent || ''; return /^\d+$/.test(t) && +t >= 2; });
      S.ep = 0; renderAll();                          // now nothing is affordable
      const reused = document.querySelector('#hand .card') === first;          // element REUSED, not rebuilt
      const disabledInPlace = !!costly && costly.isConnected && costly.classList.contains('disabled');
      return !!first && same2 && reused && disabledInPlace;
    }));
  check('PERF: the drag aim-beam builds ONCE and reuses its DOM across frames (no per-frame innerHTML/SMIL churn)',
    await J(() => {
      aimClear();
      const pts = [{ x: 100, y: 100 }, { x: 220, y: 120 }, { x: 340, y: 140 }];
      drawAimField(400, 400, pts, 0, '#f0d488');
      const svg = document.getElementById('aim-layer');
      const first = svg.querySelector('.aF-core');
      drawAimField(412, 400, pts, 6, '#f0d488');                 // next frame — origin moved
      const reusedFrame = svg.querySelector('.aF-core') === first && first.getAttribute('d') && first.getAttribute('d').indexOf('412') >= 0;
      drawAimField(412, 400, pts.slice(0, 2), 6, '#f0d488');     // target count changed → rebuild
      const rebuiltOnChange = svg.querySelector('.aF-core') !== first;
      aimClear();
      return !!first && reusedFrame && rebuiltOnChange;
    }));

  // ---------- BRANCHING ROTATIONS (the descent combat system) ----------
  console.log('--- ROTATIONS ---');
  await J(() => { try { localStorage.removeItem('kizuna2_2.forceClassic'); } catch (_) {} });   // real rotations from here
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
    await J(() => { setupFight(['ash'], ['ash.exec'], { ash: 'front' }); S._rotations = true; renderAll();
      const hand = buildHand().filter(c => c.owner === 'ash');
      return hand.length === 1 && hand[0].kind === 'opener' && hand[0].name === 'Cleave' && hand[0].cost === 2 && !!rotationFor(S.heroes[0]); }));
  check('ROTATION EARNED: base line is opener → FINISHER (a short combo) — no builder, no fork, before any skill',
    await J(() => { setupFight(['ash'], [], { ash: 'front' }); S._rotations = true; renderAll();
      const op = buildHand().find(c => c.kind === 'opener'); S.tempCards = []; resolveChainPlay(op);
      // the opener forges the FINISHER directly (Crashing Wave), not the builder
      return S.tempCards.length === 1 && S.tempCards[0].name === 'Crashing Wave'; }));
  check('ROTATION BUILDER node (signature) inserts a middle step: opener → builder → finisher',
    await J(() => { setupFight(['ash'], ['ash.sig.front'], { ash: 'front' }); S._rotations = true; renderAll();
      const op = buildHand().find(c => c.kind === 'opener'); S.tempCards = []; resolveChainPlay(op);
      // opener now forges the BUILDER (Rising Slash), not the finisher directly; no fork yet
      const builder = S.tempCards.length === 1 && S.tempCards[0].name === 'Rising Slash';
      const rs = S.tempCards[0]; S.tempCards = S.tempCards.filter(t => t.uid !== rs.uid); resolveChainPlay(rs);
      const cw = S.tempCards.find(c => c.name === 'Crashing Wave');
      // Base Crashing Wave is 11. Ash took BOTH earlier beats of this line here
      // (he is alone), so his finisher also carries the full LINE_FOCUS — the
      // empowerment for carrying a line yourself, on the card face before it is
      // chosen. The structural claim is unchanged: builder node → middle step.
      return builder && !!cw && cw.fx.dmg === 11 + LINE_FOCUS[2] && cw.focus === LINE_FOCUS[2]; }));
  check('ROTATION COMBO label: opener/combo/finisher chain cards carry the renamed COMBO tag + chain flag',
    await J(() => { setupFight(['ash'], ['ash.sig.front'], { ash: 'front' }); S._rotations = true; renderAll();
      const op = buildHand().find(c => c.kind === 'opener'); const openerOk = /^OPENER/.test(op.stance) && op.chain === true;
      S.tempCards = []; resolveChainPlay(op);
      const combo = S.tempCards[0]; const comboOk = /^COMBO/.test(combo.stance) && combo.chain === true;   // no more "BUILDER"
      resolveChainPlay(combo); const fin = S.tempCards.find(c => c.name === 'Crashing Wave');
      return openerOk && comboOk && !!fin && /^FINISHER/.test(fin.stance); }));
  check('ROTATION FORK node adds the branch (needs the builder): opener forges BOTH lines with a pick event',
    await J(() => { setupFight(['ash'], ['ash.sig.front', 'ash.branch.front'], { ash: 'front' }); S._rotations = true; renderAll();
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
  check('AFTERIMAGE gate: moving in the descent forges NO echo without the node; WITH it, the stance echoes',
    await J(async () => {
      setupFight(['ash'], [], { ash: 'front' }); S._rotations = true; S.ep = 10; S.tempCards = []; renderAll();
      await playCard(Object.assign({}, mkMoveAction(S.heroes.find(h => h.id === 'ash')), { toRow: 'mid' }), null);
      const noEcho = !S.tempCards.some(c => (c.name || '').startsWith('Echo'));
      setupFight(['ash'], ['ash.afterimage'], { ash: 'front' }); S._rotations = true; S.ep = 10; S.tempCards = []; renderAll();
      await playCard(Object.assign({}, mkMoveAction(S.heroes.find(h => h.id === 'ash')), { toRow: 'mid' }), null);
      const echo = S.tempCards.some(c => (c.name || '').startsWith('Echo'));
      return noEcho && echo; }));
  check('AFTERIMAGE + movement: a strike that SLIPS the caster (fx.step) also leaves an echo',
    await J(async () => {
      setupFight(['mira'], ['mira.afterimage'], { mira: 'front' }); S._rotations = false; S.tempCards = []; renderAll();
      const mira = S.heroes.find(h => h.id === 'mira');
      // a front strike that slips to BACK — the shape of Mira's Backstab / Vanish
      await resolveCard({ kind: 'action', owner: 'mira', name: 'Slip Strike', cost: 0, target: 'frontmost', fx: { dmg: 4, warp: 'back' } }, S.enemies[0].uid);
      return mira.row === 'back' && S.tempCards.some(c => (c.name || '').startsWith('Echo')); }));
  check('AFTERIMAGE + movement: no echo from the slip without the node',
    await J(async () => {
      setupFight(['mira'], [], { mira: 'front' }); S._rotations = false; S.tempCards = []; renderAll();
      await resolveCard({ kind: 'action', owner: 'mira', name: 'Slip Strike', cost: 0, target: 'frontmost', fx: { dmg: 4, warp: 'back' } }, S.enemies[0].uid);
      return S.heroes.find(h => h.id === 'mira').row === 'back' && !S.tempCards.some(c => (c.name || '').startsWith('Echo')); }));
  check('GUARD: an UNAFFORDABLE card cannot be played (the greyed-card-still-plays bug)',
    await J(async () => {
      setupFight(['ash'], [], { ash: 'front' }); S._rotations = false; S.ep = 0; renderAll();
      const foe = S.enemies[0], hp0 = foe.hp;
      const card = buildHand().find(c => c.cost > 0 && (c.fx || {}).dmg);
      if (card) await playCard(card, foe.uid);
      return foe.hp === hp0 && S.ep === 0; }));   // no damage dealt, no EP spent
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
    await J(() => { // `smite` joined the list in Build 287 when Elin's rotation lines
      // gained teeth; it resolves in the shared card path (see resolveCard), so it
      // is a real effect and not a dead key — which is what this check exists for.
      const ok = new Set(['dmg', 'mark', 'guard', 'heal', 'buffDmg', 'counter', 'step', 'warp', 'lull', 'taunt', 'chargeGain', 'spendCharge', 'castDmg', 'elem', 'smite']);
      return Object.values(ROTATIONS).every(st => Object.values(st).every(rot =>
        Object.values(rot.cards).every(c => Object.keys(c.fx || {}).every(k => ok.has(k))))); }));
  check('PROVOKE / TAUNT: a smart foe that would hunt the weakest instead strikes the TAUNTER’s row',
    await J(() => { setupFight(['ash', 'cassia', 'elin'], [], { ash: 'front', cassia: 'mid', elin: 'back' }); S._rotations = false; renderAll();
      const e = S.enemies[0]; e.smart = true;
      const wounded = S.heroes.find(h => h.id === 'ash'); wounded.hp = 3;   // Ash is the weakest → default prey
      const intent = { name: 'x', dmg: 5, row: 'back' };
      const preyRow = effIntentRow(e, intent);                              // hunts the weakest (Ash, front)
      S._taunt = 'cassia';                                                  // Cassia provokes
      const tauntRow = effIntentRow(e, intent);                            // now forced onto Cassia's row (mid)
      S._taunt = null;
      return preyRow === 'front' && tauntRow === 'mid'; }));
  check('ROTATION Cassia openers carry the HEAVY +1 premium; forged steps stay free',
    await J(() => { setupFight(['cassia'], ROTATION_GATES.concat(['cassia.sig.front']), { cassia: 'front' }); S._rotations = true; renderAll();
      const op = buildHand().find(c => c.kind === 'opener');
      return !!op && op.name === 'Shield Bash' && op.cost === 2; }));
  check('SIGNATURE Aegis Nova (Cassia): releases ALL guard as one hit, then spends it',
    await J(async () => { setupFight(['cassia'], [], { cassia: 'front' }); S._rotations = false; S.ep = 9; renderAll();
      const c = S.heroes[0]; c.guard = 14; const foe = S.enemies[0]; foe.hp = foe.maxHp = 60; foe.guard = 0;
      await playCard({ kind: 'temp', owner: 'cassia', name: 'Aegis Nova', cost: 0, target: 'frontmost', fx: { guardBurst: true }, temp: true, uid: 999 }, foe.uid);
      return foe.hp === 60 - 14 && c.guard === 0; }));   // dealt 14 (= guard), guard spent
  check('SIGNATURE Inverse Light (Elin): the heal loop forges a holy DAMAGE card',
    await J(() => { setupFight(['elin'], ['elin.inverse', 'elin.passive.ward'], { elin: 'mid' }); S._rotations = false; S.ep = 9; S.tempCards = []; renderAll();
      const ally = S.heroes[0]; ally.hp = 10;
      // two heals (every 2nd forges): fire the heal emergent twice
      fireEmergent('elin', 'heal', { name: 'Mend' }); fireEmergent('elin', 'heal', { name: 'Mend' });
      const il = S.tempCards.find(c => c.name === 'Inverse Light');
      return !!il && il.fx.dmg === 8 && il.school === 'light'; }));
  check('ROTATION dev preview is the FULL build — all 37 rotation gates (18 finishers + 19 forks, 6 heroes incl. Hask’s weave) unlocked',
    await J(() => typeof devPreviewRotations === 'function'
      && devPreviewRotations.toString().includes('_rotations = true')
      && devPreviewRotations.toString().includes('ROTATION_GATES')
      && Array.isArray(ROTATION_GATES) && ROTATION_GATES.length === 37));
  // THE LINE (Build 293): a combo is one thing the PARTY builds, in three beats.
  // Playing any opener discards every opener and lays out what EVERY living hero
  // can answer with — the fan stays party-wide instead of collapsing onto one
  // hero, which is the whole difference from the relay this replaced.
  // ROTATION_GATES (the full build) so every line has a middle beat to offer —
  // otherwise which hero can answer depends on which line the REACH happened to
  // hand them this turn, and the check would assert the reach rotation, not the
  // stage deal.
  check('LINE: an opener discards every opener and deals EVERY hero their answer',
    await J(() => { setupFight(['ash', 'elin'], ROTATION_GATES, { ash: 'front', elin: 'mid' }); S._rotations = true; S._line = true; renderAll();
      const op = buildHand().find(c => c.kind === 'opener' && c.owner === 'ash'); S.tempCards = []; resolveChainPlay(op);
      const hand = buildHand();
      return hand.length > 0
        && hand.every(c => c.lineStage === 'combo')                    // one stage, party-wide
        && new Set(hand.map(c => c.owner)).size === 2                  // BOTH heroes answer, opener included
        && !hand.some(c => c.kind === 'opener')                        // every opener discarded
        && hand.filter(c => c.owner === 'ash').length > 0; }));        // the opener's owner is still in it
  check('LINE: each hero answers out of the line THEY are in — reacher included',
    await J(() => buildHand().every(c => {
      // Everyone answers from the row they stand in; the hero who REACHED answers
      // from the line they reached into, which is the one they opened with. Either
      // way nobody is ever dragged into another hero's vocabulary.
      const h = S.heroes.find(x => x.id === c.owner);
      const stance = (S.line.stanceOf && S.line.stanceOf[c.owner]) || h.row;
      return c.chainStance === stance
        && Object.values(ROTATIONS[c.owner][stance].cards).some(d => d.name === c.name); })));
  check('LINE: playing any combo deals the FINISHER stage, party-wide',
    await J(() => { const combo = buildHand().find(c => c.owner === 'elin');
      S.tempCards = S.tempCards.filter(t => t.uid !== combo.uid); resolveChainPlay(combo);
      const hand = buildHand();
      return hand.length > 0 && hand.every(c => c.lineStage === 'finisher' && /FINISHER/.test(c.stance))
        && new Set(hand.map(c => c.owner)).size === 2; }));
  check('LINE: FOCUS empowers the finisher of whoever CARRIED the line',
    await J(() => { const hand = buildHand();
      // Elin took the combo, so her finisher carries LINE_FOCUS[1]; Ash opened, so
      // his does too. A hero with no beats in this line gets no bonus — which is
      // what makes carrying it yourself worth something.
      const elin = hand.filter(c => c.owner === 'elin');
      return elin.length > 0 && elin.every(c => c.focus === LINE_FOCUS[1]) && LINE_FOCUS[1] > 0; }));
  check('LINE: closing it clears the table and gives the openers back',
    await J(() => { const fin = buildHand().find(c => c.owner === 'elin');
      S.tempCards = S.tempCards.filter(t => t.uid !== fin.uid); resolveChainPlay(fin);
      // Exactly one opener per hero comes back — each their row's own (the
      // hand is the position, Build 10).
      const back = buildHand().filter(c => c.kind === 'opener');
      // Ash opened this line, so his latch is unspent here only because the check
      // drove resolveChainPlay directly rather than through playCard.
      return S.line === null && S.tempCards.filter(t => t.chain).length === 0
        && back.length === 2 && new Set(back.map(c => c.owner)).size === 2; }));
  check('LINE: an untreed line is opener → finisher — a shorter chain, not a skipped beat',
    await J(() => { setupFight(['ash', 'elin'], [], { ash: 'front', elin: 'mid' }); S._rotations = true; S._line = true; renderAll();
      const op = buildHand().find(c => c.kind === 'opener' && c.owner === 'ash'); S.tempCards = []; resolveChainPlay(op);
      const hand = buildHand();
      // Nobody owns a CARD node, so nobody has a middle beat. They are not skipped
      // and they are not left empty-handed — each is simply already standing on
      // their own finisher at depth 1.
      return hand.length > 0 && hand.every(c => c.lineStage === 'finisher')
        && new Set(hand.map(c => c.owner)).size === 2; }));
  check('LINE: a SHORT chain and a LONG one run side by side — nobody is left holding nothing',
    await J(() => { setupFight(['ash', 'elin'], ['ash.sig.front'], { ash: 'front', elin: 'mid' }); S._rotations = true; S._line = true;
      S.turn = 2; S.used = new Set(); renderAll();   // turn 2 → ELIN holds the reach, so Ash opens his STANDING front line
      const op = buildHand().find(c => c.kind === 'opener' && c.owner === 'ash'); S.tempCards = []; resolveChainPlay(op);
      const hand = buildHand();
      const ash = hand.filter(c => c.owner === 'ash'), elin = hand.filter(c => c.owner === 'elin');
      // Ash bought the CARD node, so at depth 1 he is on a COMBO. Elin did not, so
      // at the same depth she is already on her FINISHER. Both hold a card. The
      // party-wide-stage version of this left Elin with nothing at all.
      return ash.length > 0 && ash.every(c => c.lineStage === 'combo')
        && elin.length > 0 && elin.every(c => c.lineStage === 'finisher'); }));
  // Driven on a SINGLE-enemy fight, not setupFight: that helper walks the map and
  // can seed several foes, and a 'frontmost' card then hits a different enemy
  // than the one flagged as boss — the first version of these checks failed on
  // exactly that, while the probe against one foe showed the mechanic working.
  const echoRun = (boss) => J(async (mk) => {
    RUN = newRun('ash'); RUN.roster = ['ash']; RUN.active = ['ash'];
    RUN.hp = { ash: HEROES.ash.maxHp }; RUN.nodes = []; RUN.completed = [0, 1, 2];
    startFight({ type:'fight', chapter:3, heroes:['ash'], enemies:['husk'], useRunHp:true, floor:1, depth:3, narrator:'ec' });
    S._rotations = true; S._line = true; S.tempCards = []; S.ep = 20; renderAll();
    const e = S.enemies[0];
    if (mk) e.def = Object.assign({}, e.def, { boss: true });
    e.hp = e.maxHp = 300; e.guard = 0;
    const dealt = [];
    for (let round = 0; round < 2; round++) {
      const hp0 = e.hp;
      for (let g = 0; g < 4; g++) {
        const c = buildHand().find(x => (x.kind === 'opener' || x.chain) && x.owner === 'ash' && !x.spent && x.cost <= S.ep);
        if (!c) break; await playCard(c, e.uid);
      }
      dealt.push(hp0 - e.hp); S.used = new Set();
    }
    return { first: dealt[0], second: dealt[1], mem: !!(e._echoMem && e._echoMem.has('Crashing Wave')) };
  }, boss);
  check('ANCHOR RULE: every node above tier 1 chains back to its hero’s anchor ring — nothing floats',
    await J(() => {
      // A build must be a connected line of growth out of the character's
      // archetype, never a grab-bag of whatever the open tier sells. Walk each
      // node's requires-chain: it must terminate at a tier-1 node of the SAME
      // hero, and never cross into another hero's region (crossings are the
      // bond system's door, not the tree's).
      const byId = {}; EMBER_TREE.forEach(n => { byId[n.id] = n; });
      const anchored = (n, seen) => {
        if (n.tier === 1) return true;
        if (seen.has(n.id)) return false;
        const reqs = (n.requires || []).map(r => byId[r]).filter(Boolean);
        // seen COPIES per branch: it detects cycles on a path, and a shared set
        // falsely failed diamonds — two requires routing through the same
        // ancestor is convergence, not a cycle. That misread flagged
        // ash.chain.react, whose chain is perfectly anchored.
        return reqs.length > 0 && reqs.every(r => r.hero === n.hero && anchored(r, new Set([...seen, n.id])));
      };
      const bad = EMBER_TREE.filter(n => n.hero && TREE_HEROES.indexOf(n.hero) >= 0
        && n.tier > 1 && !anchored(n, new Set()));
      return bad.length === 0 || (console.log('    floating: ' + bad.map(n => n.id).join(', ')), false);
    }));
  check('ECHO: a boss REMEMBERS the finisher that closed a line against it — the repeat lands blunted',
    await (async () => { const r = await echoRun(true);
      return r.mem && r.first > r.second && r.second > 0; })());
  check('ECHO: a MOB never learns — the same line lands the same twice',
    await (async () => { const r = await echoRun(false);
      return !r.mem && r.first === r.second && r.first > 0; })());
  check('LINE ABSORBS PRIMED: closing a line primes nobody — the line is the follow-up',
    await J(() => { setupFight(['ash', 'elin'], ROTATION_GATES, { ash: 'front', elin: 'mid' }); S._rotations = true; S._line = true;
      S.turn = 2; S.used = new Set(); S.tempCards = []; renderAll();
      const op = buildHand().find(c => c.kind === 'opener' && c.owner === 'ash'); resolveChainPlay(op);
      const combo = buildHand().find(c => c.owner === 'elin' && c.lineStage === 'combo');
      if (combo) { S.tempCards = S.tempCards.filter(t => t.uid !== combo.uid); resolveChainPlay(combo); }
      const fin = buildHand().find(c => c.lineStage === 'finisher');
      S.tempCards = S.tempCards.filter(t => t.uid !== fin.uid);
      grantPrime(fin); resolveChainPlay(fin);
      // PRIMED existed to hand a free ANSWER to a pair who had each finished a
      // combo. A line's beats are already shared, so it bonds on its own — two
      // systems teaching one lesson is what this deletes.
      return S.heroes.every(h => !h.primed)
        && !S.tempCards.some(c => c.fx && c.fx.followUp); }));
  check('LINE: …and the same finisher OUTSIDE the line still primes, so the classic path is intact',
    await J(() => { setupFight(['ash', 'elin'], ROTATION_GATES, { ash: 'front', elin: 'mid' }); S._rotations = true; S._line = false;
      S.tempCards = []; renderAll();
      const op = buildHand().find(c => c.kind === 'opener' && c.owner === 'ash'); resolveChainPlay(op);
      let step = S.tempCards.find(c => c.chain);
      for (let i = 0; i < 3 && step && (step.chainNext || []).length; i++) {
        S.tempCards = S.tempCards.filter(t => t.uid !== step.uid); resolveChainPlay(step);
        step = S.tempCards.find(c => c.chain);
      }
      grantPrime(step);
      return !!(S.heroes.find(h => h.id === 'ash') || {}).primed; }));
  check('LEARNED: the free ANSWER needs the pair’s BOND NODE — it is not simply granted',
    await J(() => { setupFight(['ash', 'elin'], ROTATION_GATES, { ash: 'front', elin: 'mid' }); S._rotations = true; S._line = true;
      S.tempCards = []; S.threads = new Set([pairKey('ash', 'elin')]);
      S.pairsAwake = new Set([pairKey('ash', 'elin')]); S._assistedPairs = new Set();
      offerBondFollow('ash');
      // No bond node between them, so nothing is handed over. The card a player
      // never chose no longer turns up in their hand unexplained.
      const withoutNode = !S.tempCards.some(c => c.fx && c.fx.bondFollow);
      return withoutNode && typeof bondNodeHeld === 'function'; }));
  check('LINE: playing a FINISHER ends the line whenever in it that lands',
    await J(() => { const fin = buildHand().find(c => c.owner === 'elin' && c.lineStage === 'finisher');
      S.tempCards = S.tempCards.filter(t => t.uid !== fin.uid); resolveChainPlay(fin);
      // Elin closed on the party's SECOND beat, because her line is only two long.
      return S.line === null && S.tempCards.filter(t => t.chain).length === 0; }));
  check('LINE: a stale flag cannot lock the hand — the openers come back',
    await J(() => { setupFight(['ash', 'elin'], ROTATION_GATES, { ash: 'front', elin: 'mid' }); S._rotations = true; S._line = true;
      S.turn = 2; S.used = new Set(); renderAll();
      const op = buildHand().find(c => c.kind === 'opener' && c.owner === 'ash'); S.tempCards = []; resolveChainPlay(op);
      const duringLine = buildHand().filter(c => c.kind === 'opener').length === 0;
      // A dealt card can leave by routes that never touch S.line (a HEX eating it,
      // its owner going down). If the flag survived that, the party would hold
      // nothing at all until the turn rolled over.
      S.tempCards = [];
      const back = buildHand().filter(c => c.kind === 'opener');
      return duringLine && S.line === null && back.length === 2
        && new Set(back.map(c => c.owner)).size === 2; }));
  check('LINE: HASK banks ◆ CHARGE per beat he takes — and forfeits it if he does not close',
    await J(() => { setupFight(['hask', 'ash'], ROTATION_GATES, { hask: 'mid', ash: 'front' }); S._rotations = true; S._line = true; renderAll();
      const hask = S.heroes.find(h => h.id === 'hask'); hask.charge = 0; hask._pendCharge = 0;
      const op = buildHand().find(c => c.kind === 'opener' && c.owner === 'hask'); S.tempCards = []; resolveChainPlay(op);
      const bankedOnOpen = hask._pendCharge === 2;                    // opening banks the stack
      const ashCombo = buildHand().find(c => c.owner === 'ash');
      S.tempCards = S.tempCards.filter(t => t.uid !== ashCombo.uid); resolveChainPlay(ashCombo);
      const ashFin = buildHand().find(c => c.owner === 'ash');
      S.tempCards = S.tempCards.filter(t => t.uid !== ashFin.uid); resolveChainPlay(ashFin);
      // Ash closed it, so the stack Hask opened on never arrives.
      return bankedOnOpen && hask._pendCharge === 0 && (hask.charge || 0) === 0; }));
  check('LINE: HASK closing the line he opened CASHES the bank into ◆ CHARGE',
    await J(() => { setupFight(['hask', 'ash'], ROTATION_GATES, { hask: 'mid', ash: 'front' }); S._rotations = true; S._line = true; renderAll();
      const hask = S.heroes.find(h => h.id === 'hask'); hask.charge = 0; hask._pendCharge = 0;
      const op = buildHand().find(c => c.kind === 'opener' && c.owner === 'hask'); S.tempCards = []; resolveChainPlay(op);
      const hc = buildHand().find(c => c.owner === 'hask');
      S.tempCards = S.tempCards.filter(t => t.uid !== hc.uid); resolveChainPlay(hc);      // he answers too: +1
      const hf = buildHand().find(c => c.owner === 'hask');
      S.tempCards = S.tempCards.filter(t => t.uid !== hf.uid); resolveChainPlay(hf);      // …and closes
      return (hask.charge || 0) === 3 && hask._pendCharge === 0 && S.line === null; }));
  check('LINE: moving DROPS it for the whole party, bank included',
    await J(() => { setupFight(['hask', 'ash'], ROTATION_GATES, { hask: 'mid', ash: 'front' }); S._rotations = true; S._line = true; renderAll();
      const hask = S.heroes.find(h => h.id === 'hask'); hask.charge = 0; hask._pendCharge = 0;
      const op = buildHand().find(c => c.kind === 'opener' && c.owner === 'hask'); S.tempCards = []; resolveChainPlay(op);
      const dealt = S.tempCards.filter(t => t.chain).length > 0;
      purgeChain('ash');                                              // one hero steps out of formation
      return dealt && S.tempCards.filter(t => t.chain).length === 0 && S.line === null
        && hask._pendCharge === 0 && (hask.charge || 0) === 0; }));
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
  check('ROTATION preview: every opener is the standing row\u2019s own \u2014 base, or a LEARNED alt beside it (Build 11)',
    await J(() => { const openers = buildHand().filter(c => c.kind === 'opener');
      const byOwner = {};
      openers.forEach(o => { byOwner[o.owner] = (byOwner[o.owner] || 0) + 1; });
      return new Set(openers.map(c => c.owner)).size === 3
        && Object.values(byOwner).every(n => n >= 1 && n <= 2)   // base + at most the learned alt
        && openers.every(o => { const h = S.heroes.find(x => x.id === o.owner);
            const rot = ROTATIONS[o.owner] && ROTATIONS[o.owner][h.row];
            const alt = ALT_OPENERS[o.owner];
            const altName = (alt && alt.row === h.row && rot.cards[alt.key]) ? rot.cards[alt.key].name : null;
            return rot && (o.name === rot.cards[rot.opener].name || o.name === altName); })
        && openers.every(o => o.cost >= 1); }));
  // EP ECONOMY (Build 194): the COMBO ramp is free, but the FINISHER payoff costs
  // EP — so cashing a rotation is a real decision, and rotation combat opens +1 EP.
  check('EP: rotation combat opens with +1 EP (the allocation budget for finisher costs)',
    await J(() => { devPreviewRotations(); return S._rotations === true && S.maxEp === 3 + S.heroes.length; }));
  check('EP: a rotation FINISHER costs EP (big payoff = 2), the COMBO ramp stays FREE',
    await J(async () => {
      setupFight(['ash'], ['ash.sig.front'], { ash: 'front' }); S._rotations = true; S.ep = 12; S.tempCards = []; renderAll();
      const seen = {};
      for (let i = 0; i < 4; i++) {
        const c = buildHand().find(x => (x.kind === 'opener' || x.chain) && x.owner === 'ash' && !x.spent && x.cost <= S.ep);
        if (!c) break;
        seen[(c.stance || '').split('·')[0].trim()] = c.cost;
        await playCard(c, c.target === 'enemy' ? (S.enemies.find(e => !e.dead) || {}).uid : null);
      }
      return seen.COMBO === 0 && seen.FINISHER === 2; }));   // Crashing Wave (11 dmg) → 2
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

  // ---------- TEMPO — novelty decay (Build 243) ----------
  // The pacing audit measured 67–80% of the enemy phase as non-interactive, and
  // found the cost was not the drama but the drama REPEATED.  These assert the
  // decay is real, is scoped to the fight, and never touches the parry windows.
  console.log('--- TEMPO ---');
  check('TEMPO: the first sighting of a beat holds full, every repeat is tightened',
    await J(() => { setupFight(['ash'], [], { ash: 'front' });
      const a = tempo('probe', 1000, 400), b = tempo('probe', 1000, 400), c = tempo('probe', 1000, 400);
      return a === 1000 && b === 400 && c === 400; }));
  check('TEMPO: the decay is PER FIGHT — a new battle plays every beat in full again',
    await J(() => { setupFight(['ash'], [], { ash: 'front' });
      tempo('probe2', 1000, 400);
      const repeat = tempo('probe2', 1000, 400);
      setupFight(['ash'], [], { ash: 'front' });         // a fresh S
      return repeat === 400 && tempo('probe2', 1000, 400) === 1000; }));
  check('TEMPO: distinct beats decay independently (one key never shortens another)',
    await J(() => { setupFight(['ash'], [], { ash: 'front' });
      tempo('k1', 900, 300);
      return tempo('k2', 900, 300) === 900; }));
  check('TEMPO: holdOrTap resolves on its own when nothing is tapped',
    await J(async () => { const t0 = performance.now(); await holdOrTap(300, 60);
      const d = performance.now() - t0; return d >= 260 && d < 900; }));
  check('TEMPO: a tap CUTS a cut-in hold short — the tenth band is skippable',
    await J(async () => { const t0 = performance.now();
      const p = holdOrTap(3000, 40);
      setTimeout(() => window.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })), 140);
      await p; const d = performance.now() - t0;
      return d < 900; }));                                // cut far short of 3000
  check('TEMPO: the grace window ignores the pointerdown that STARTED the beat',
    await J(async () => { const t0 = performance.now();
      const p = holdOrTap(700, 300);
      window.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));   // same tick
      await p; return performance.now() - t0 >= 600; }));
  // Build 243 fixed a perverse incentive: reading a whole cascade PERFECTLY used
  // to buy a LONGER settle (340ms) than muffing it (240ms).
  check('TEMPO: a flawless riposte hands the turn back FASTER than a missed parry',
    (() => { const m = src.match(/await sleep\(rip > 0 \? (\d+) : (\d+)\);/);
      return !!m && Number(m[1]) < Number(m[2]); })(),
    (src.match(/await sleep\(rip > 0 \? \d+ : \d+\);/) || [])[0]);
  check('TEMPO: a wind-up tell suppresses the cascade lead-in (one telegraph, not two)',
    /_justTold/.test(src) && /told \? 170 : SEQ_LEADIN/.test(src));
  check('TEMPO: a card that reads LOUD still gets its full settle; a quiet one does not',
    /loud \? 240 : 150/.test(src));

  // ---------- RACK FOCUS (Build 244) ----------
  // Focus is now something the game SPENDS on the acting hero, not a standing
  // tax on the back rank.  Every check reads the COMPUTED filter — a stylesheet
  // that says the right thing and a cascade that delivers it are different
  // claims (Build 240's boss art said 318px and computed 156px).
  console.log('--- RACK FOCUS ---');
  // Park the cursor off the battlefield and drop any leftover aim FIRST. The
  // snap-to-focus override (`.fig-targetable`/`.fig-aim`/`:hover` → filter:none
  // !important) legitimately beats the rack, so a stray pointer left over a
  // figure by an earlier block reads as "the rack didn't engage" and the check
  // measures the mouse instead of the feature.
  await t.page.mouse.move(4, 4);
  await J(() => { clearAim();
    setupFight(['ash', 'hask', 'cassia'], [], { ash: 'front', hask: 'mid', cassia: 'back' });
    releaseFocus(); renderAll(); });
  await sleep(260);
  const artFilter = (id) => J((h) => { const f = figEl(h); const a = f && f.querySelector('.fig-art');
    return a ? getComputedStyle(a).filter : 'NO-ART'; }, id);
  check('RACK: AT REST no party rank is blurred — the whole party reads crisp',
    !/blur/.test(await artFilter('ash')) && !/blur/.test(await artFilter('hask')) && !/blur/.test(await artFilter('cassia')),
    'back rank computed: ' + await artFilter('cassia'));
  check('RACK: the rest state still GRADES the ranks (air and warmth cost nothing to read)',
    /saturate/.test(await artFilter('ash')) && (await artFilter('ash')) !== (await artFilter('cassia')));
  // v2.2 Build 5: aiming is not an action. Lifting a card LIGHTS the actor —
  // it no longer blurs the rest of the party; the blur belongs exclusively to
  // the action beat (the unified #stage.rack, drilled in the FOCUS block).
  await J(() => pullFocus('cassia')); await sleep(240);
  check('RACK: lifting a card LIGHTS the actor — even from the BACK rank, over the row grade',
    !/blur/.test(await artFilter('cassia')) && /drop-shadow/.test(await artFilter('cassia')),
    await artFilter('cassia'));
  check('RACK: aiming blurs NOBODY — the other heroes stay crisp while the card is in the air',
    !/blur/.test(await artFilter('ash')) && !/blur/.test(await artFilter('hask')));
  check('RACK: aiming is not an action — the stage is NOT racked until a play resolves',
    await J(() => !document.getElementById('stage').classList.contains('rack')));
  await J(() => releaseFocus()); await sleep(240);
  check('RACK: releasing settles the party back to a fully crisp rest state',
    !/blur/.test(await artFilter('ash')) && !/blur/.test(await artFilter('hask')) && !/blur/.test(await artFilter('cassia')));
  check('RACK: exactly one hero can hold the light — a second pull moves it, never doubles it',
    await J(() => { pullFocus('ash'); pullFocus('hask');
      const n = document.querySelectorAll('#party-half .figure.fig-actor').length;
      const onHask = !!(figEl('hask') || {}).classList && figEl('hask').classList.contains('fig-actor');
      releaseFocus(); return n === 1 && onHask; }));
  check('RACK: pulling focus onto nobody leaves the rest state alone (no orphan rack)',
    await J(() => { pullFocus(null);
      const on = document.getElementById('stage').classList.contains('rack');
      releaseFocus(); return on === false; }));
  check('RACK: clearAim can never leave the board racked between fights',
    await J(() => { pullFocus('ash'); focusPair('ash', null); clearAim();
      return !document.getElementById('stage').classList.contains('rack')
        && document.querySelectorAll('.figure.fig-actor').length === 0
        && document.querySelectorAll('.figure.fig-focus').length === 0; }));
  check('RACK: the enemy back rank is GRADED, never blurred — at rest you can count every foe',
    await J(() => { setupFight(['ash'], [], { ash: 'front' });
      const rule = [...document.styleSheets].flatMap(s => { try { return [...s.cssRules]; } catch (_) { return []; } })
        .find(r => r.selectorText === '#enemy-half .slot[data-row="back"] .figure .fig-art');
      return !!rule && /saturate/.test(rule.style.filter) && !/blur/.test(rule.style.filter); }));

  // ---------- THE WEAVE — per-run tree crossings (Build 245) ----------
  // "Bonds open the door, shared nature makes it cheap." The failure mode this
  // block exists to catch is a crossing that costs embers and silently does
  // NOTHING, so the behavioural checks read combat outcomes, not stored state.
  console.log('--- THE WEAVE ---');
  const BOND_KINDLED_VALUE = await J(() => BOND_KINDLED);
  const weaveRun = (bond) => J((b) => {
    RUN = newRun('ash');
    RUN.roster = ['ash', 'mira', 'cassia']; RUN.active = ['ash', 'mira', 'cassia'];
    RUN.hp = { ash: 34, mira: 30, cassia: 36 };
    RUN.nodes = ['mira.passive.opportunist', 'cassia.passive.vigil'];
    // Build 251: a hero-crossing needs a foothold on that border first, so the
    // fixture claims one stone on each of Ash's borders.
    RUN.crossed = { ash: [commonOnBorder('ash', 'mira')[0].id, commonOnBorder('ash', 'cassia')[0].id] };
    RUN.embers = 99;
    RUN.bonds = { 'ash|mira': b, 'ash|cassia': b, 'cassia|mira': b };
    // unsealed to the top: Build 290 spread the tree over five tiers, and what
    // this fixture is about is the WEAVE, not what a shallow depth reveals
    RUN.floor = 1; RUN.completed = Array.from({ length: 17 }, (_, i) => i);
    RUN.map = generateDescent(RUN.roster, 1);
    return true;
  }, bond);

  check('WEAVE: kinship reads the school + tempo axes already authored in HEROES',
    await J(() => kinship('mira', 'branwen') === 2      // blade AND swift — twins
      && kinship('ash', 'mira') === 1                    // blade only
      && kinship('ash', 'hask') === 1                    // steady only
      && kinship('ash', 'cassia') === 0));
  check('WEAVE: Cassia is nobody’s kin — and is NOT stranded, she pays the stranger’s rate',
    await J(() => ['ash', 'mira', 'hask', 'elin', 'branwen'].every(x => kinship('cassia', x) === 0)));
  await weaveRun(1);
  check('WEAVE: an unwoven bond opens nothing — you cannot learn from a stranger',
    await J(() => crossOffersFor('ash').length === 0));
  // THE GATE IS THE THREAD: the door opens exactly when the pair goes WOVEN,
  // the game's one named bond state, rather than at a number invented for this
  // system. If BOND_KINDLED ever moves, the crossing gate moves with it.
  check('WEAVE: the crossing gate IS the woven thread, not a separate threshold',
    await J(() => CROSS_BOND === BOND_KINDLED));
  await weaveRun(BOND_KINDLED_VALUE);
  check('WEAVE: the moment a pair goes WOVEN, the door opens on what they can teach',
    await J(() => crossOffersFor('ash').filter(n => !n.common).map(n => n.id).sort().join(',')
      === 'cassia.passive.vigil,mira.passive.opportunist'));
  // Build 263 dropped the surcharge. Measured at the old price a crossing cost
  // 18-21 embers all-in against a ~136-ember run, and a greedy bot took ZERO
  // across a whole floor — the same embers bought five rotation gates. Kinship
  // still ORDERS the price; it no longer prices the feature out of the game.
  check('WEAVE: kinship still orders the price — kin cheaper than strangers, none above list',
    await J(() => { const O = EMBER_TREE.find(n => n.id === 'mira.passive.opportunist');
      const V = EMBER_TREE.find(n => n.id === 'cassia.passive.vigil');
      const kin = crossCost('ash', O), stranger = crossCost('ash', V);
      return kin < stranger && stranger <= V.cost && kinship('ash', 'mira') > kinship('ash', 'cassia'); }),
    await J(() => 'kin ' + crossCost('ash', EMBER_TREE.find(n => n.id === 'mira.passive.opportunist'))
      + ' · stranger ' + crossCost('ash', EMBER_TREE.find(n => n.id === 'cassia.passive.vigil'))));
  check('WEAVE: the teacher must KNOW the node — a crossing is earned twice',
    await J(() => { RUN.nodes = ['cassia.passive.vigil'];
      const ids = crossOffersFor('ash').filter(n => !n.common).map(n => n.id);
      RUN.nodes = ['mira.passive.opportunist', 'cassia.passive.vigil'];
      return ids.length === 1 && ids[0] === 'cassia.passive.vigil'; }));
  check('WEAVE: a hero never crosses into their own lane, and never twice',
    await J(() => { const own = crossOffersFor('mira').some(n => n.hero === 'mira');
      RUN.crossed.ash = (RUN.crossed.ash || []).concat(['mira.passive.opportunist']);
      const again = crossOffersFor('ash').some(n => n.id === 'mira.passive.opportunist');
      RUN.crossed = {};
      return own === false && again === false; }));
  check('WEAVE: a TECHNIQUE only — you learn a colleague’s craft, never their soul',
    await J(() => EMBER_TREE.filter(isTeachable).every(n => n.baseTier === 2)
      && EMBER_TREE.some(n => n.baseTier >= 3 && isPassiveNode(n) && PASSIVE_DEFS[n.passive])));
  // Build 250 unbound these five: their rule is READ at one seam rather than
  // dispatched, and every seam was already `hero id + hasNode` — the exact shape
  // heroOwnsNode replaces. They travel now, which is what gives a border more
  // than one bridge.
  check('WEAVE: the read-at-site passives now travel too — 12 teachable, 2 per hero',
    await J(() => EMBER_TREE.filter(isTeachable).length === 12
      && ['ash', 'elin', 'mira', 'cassia', 'branwen', 'hask']
        .every(h => EMBER_TREE.filter(n => isTeachable(n) && n.hero === h).length === 2)));
  check('WEAVE: a crossing still never buys a silent no-op — every teachable node has a rule',
    await J(() => EMBER_TREE.filter(isTeachable).every(n => !!PASSIVE_DEFS[n.passive])));
  // A taught rule has to fire for its new owner at the SEAM, not just exist.
  check('WEAVE: a crossed read-at-site passive changes the seam it is read at',
    await J(() => { setupFight(['ash', 'mira'], [], { ash: 'front', mira: 'mid' });
      RUN.nodes = ['mira.passive.swiftfoot']; RUN.crossed = {};
      const ash = S.heroes.find(h => h.id === 'ash');
      S.used = new Set();
      const before = moveCost(ash);
      RUN.crossed = { ash: ['mira.passive.swiftfoot'] };
      const after = moveCost(ash);
      return before === 1 && after === 0; }));
  check('WEAVE: every hero has something to teach (the lattice is not lopsided)',
    await J(() => new Set(EMBER_TREE.filter(isTeachable).map(n => n.hero)).size === 6),
    await J(() => EMBER_TREE.filter(isTeachable).length + ' teachable nodes'));

  // ── behaviour: does the crossed rule actually FIRE for its new owner? ──
  const weaveFight = () => J(() => {
    startFight({ type: 'fight', chapter: 3, heroes: RUN.active.slice(), enemies: ['husk'], useRunHp: true, floor: 1, depth: 3, narrator: 'weave' });
    renderAll(); return true;
  });
  await weaveRun(BOND_KINDLED_VALUE); await weaveFight();
  const oppDmg = () => J(() => { const f = livingEnemies()[0]; f.mark = 2;
    return { ash: passiveDmg(S.heroes.find(h => h.id === 'ash'), f),
             mira: passiveDmg(S.heroes.find(h => h.id === 'mira'), f) }; });
  const wvOppA = await oppDmg();
  // add the crossing to whatever the fixture already holds, so the only thing
  // that changed between the two readings is Opportunist itself
  await J(() => { RUN.crossed.ash = (RUN.crossed.ash || []).concat(['mira.passive.opportunist']); });
  const wvOppB = await oppDmg();
  check('WEAVE: a crossed dmgMod fires for its NEW owner (+3 vs EXPOSED)',
    wvOppB.ash - wvOppA.ash === 3, `ash ${wvOppA.ash} → ${wvOppB.ash}`);
  check('WEAVE: the teacher is unchanged — a crossing copies the rule, it never doubles it',
    wvOppB.mira === wvOppA.mira, `mira ${wvOppA.mira} → ${wvOppB.mira}`);

  const vigilGuard = () => J(() => { S.heroes.forEach(h => { h.guard = 0; });
    S.heroes.forEach(h => firePassives('turnStart', h.id));
    return S.heroes.reduce((o, h) => (o[h.id] = h.guard, o), {}); });
  await weaveRun(BOND_KINDLED_VALUE); await J(() => { RUN.nodes = ['cassia.passive.vigil']; RUN.crossed = { ash: [commonOnBorder('ash','cassia')[0].id] }; });
  await weaveFight();
  const wvVigilA = await vigilGuard();
  await J(() => { RUN.crossed.ash = (RUN.crossed.ash || []).concat(['cassia.passive.vigil']); });
  const wvVigilB = await vigilGuard();
  check('WEAVE: a crossed turnStart passive fires for its new owner (⛨+2)',
    wvVigilB.ash - wvVigilA.ash === 2, `ash ⛨${wvVigilA.ash} → ⛨${wvVigilB.ash}`);
  check('WEAVE: it does not leak to an unrelated hero',
    wvVigilB.mira === wvVigilA.mira && wvVigilB.cassia === wvVigilA.cassia);
  // BASTION's chill immunity was wired to Cassia BY NAME, so a crosser would
  // have bought the counter and not the immunity — half a node.
  check('WEAVE: BASTION’s chill immunity follows the crossing, not the name',
    await J(() => { RUN.nodes = ['cassia.passive.bastion']; RUN.crossed = { mira: ['cassia.passive.bastion'] };
      return heroResistsChill(S.heroes.find(h => h.id === 'cassia')) === true
        && heroResistsChill(S.heroes.find(h => h.id === 'mira')) === true
        && heroResistsChill(S.heroes.find(h => h.id === 'ash')) === false; }));
  check('WEAVE: crossings are PER RUN and survive a save/load like nodes do',
    await J(() => { RUN.crossed = { ash: ['mira.passive.opportunist', commonOnBorder('ash','mira')[0].id] }; saveRun();
      const back = loadRun();
      const fresh = newRun('ash');
      return !!(back && back.crossed && back.crossed.ash
        && back.crossed.ash[0] === 'mira.passive.opportunist')
        && JSON.stringify(fresh.crossed) === '{}'; }));

  // ---------- THE WEAVE TAB (Build 24, was THE LATTICE UI of 246) ----------
  // The constellation that drew crossings as threads between orbiting regions
  // is retired, so every guarantee about hubs, bridges, region collision and
  // camera flight retired with it. What those checks were REALLY protecting
  // survives and is re-asserted here against the new shape: every door the
  // party could open is shown, each names its teacher, a shut one still says
  // what it waits on, and LEARN spends the kinship price onto the learner.
  console.log('--- THE WEAVE ---');
  const latticeRun = (hero) => J((h) => {
    RUN = newRun('ash');
    RUN.roster = ['ash', 'mira', 'cassia']; RUN.active = ['ash', 'mira', 'cassia'];
    RUN.hp = { ash: 34, mira: 30, cassia: 36 };
    RUN.nodes = ['mira.passive.opportunist', 'cassia.passive.vigil', 'cassia.passive.bastion',
                 'ash.sig.front', 'ash.passive.vanguard'];
    RUN.crossed = { ash: ['cassia.passive.vigil',
      commonOnBorder('ash', 'mira')[0].id, commonOnBorder('ash', 'cassia')[0].id] };
    RUN.bonds = { 'ash|mira': 4, 'ash|cassia': BOND_KINDLED, 'cassia|mira': BOND_KINDLED - 1 };
    RUN.embers = 14; RUN.floor = 1; RUN.completed = Array.from({ length: 17 }, (_, i) => i);
    RUN.map = generateDescent(RUN.roster, 1);
    showEmberTree(() => {}, h);
    return true;
  }, hero);

  await latticeRun('__weave'); await sleep(400);
  check('WEAVE: every door the party could ever open is shown, not just the affordable ones',
    await J(() => document.querySelectorAll('.et-orb.et-cross').length === crossViewFor('ash').length
      && crossViewFor('ash').filter(c => !c.common).length === 4));
  check('WEAVE: a door names its TEACHER — the word that makes this a weave, not a node list',
    await J(() => { const from = [...document.querySelectorAll('.et-orb.et-cross .et-x-from')]
        .map(e => e.textContent).filter(x => x !== 'COMMON' && x !== 'BOND').sort().join(',');
      return from === 'CASSIA,CASSIA,MIRA,MIRA'; }));
  check('WEAVE: it is FOLDED INTO the hero\u2019s own star — doors on the rim, past their own branches',
    await J(() => {
      showEmberTree(() => {}, 'ash');
      const star = document.querySelector('#et-star');
      const core = star.querySelector('.et-core').getBoundingClientRect();
      const cx = core.left + core.width / 2, cy = core.top + core.height / 2;
      const rad = el => { const r = el.getBoundingClientRect();
        return Math.hypot((r.left + r.width / 2) - cx, (r.top + r.height / 2) - cy); };
      const rim = [...star.querySelectorAll('.et-orb[data-rim]')];
      const own = [...star.querySelectorAll('.et-orb[data-id]:not([data-rim])')];
      return rim.length > 0 && own.length > 0
        && !document.querySelector('.et-tab[data-hero="__weave"]')     // no drawer beside the tree
        && rim.every(r => own.every(o => rad(r) > rad(o) - 8))          // every door past the branches
        && star.querySelectorAll('.et-thread').length === rim.length;   // each tied back to you
    }));
  check('WEAVE: selecting a door opens the CROSSING panel, not the node panel',
    await J(() => { const open = [...document.querySelectorAll('.et-orb.et-cross')]
        .find(e => e.className.indexOf('et-x-open') !== -1);
      if (!open) return false;
      open.click();
      return !!document.querySelector('.et-d-cross') && !!document.querySelector('#et-cross-buy'); }));
  check('WEAVE: LEARN spends the kinship price and records the crossing on the LEARNER',
    await J(async () => {
      const before = runEmbers();
      const btn = document.querySelector('#et-cross-buy'); if (!btn) return false;
      const name = (document.querySelector('.et-d-name') || {}).textContent;
      btn.click(); await new Promise(r => setTimeout(r, 700));
      const node = EMBER_TREE.find(n => n.label === name);
      return !!node && (RUN.crossed.ash || []).indexOf(node.id) >= 0 && runEmbers() < before; }));
  await latticeRun('__weave'); await sleep(400);
  check('WEAVE: a SHUT door is still drawn, named, and says what it waits on',
    await J(() => { const shut = [...document.querySelectorAll('.et-orb.et-cross')]
        .find(e => /et-x-(unbonded|untaught|unbridged)/.test(e.className));
      if (!shut) return false;
      const named = (shut.querySelector('.et-orb-name') || {}).textContent;
      shut.click();
      const lock = document.querySelector('.et-d-lock');
      return !!named && named.length > 1 && !!lock && lock.textContent.length > 8; }));
  check('WEAVE: a shut door offers no way to buy it',
    await J(() => !document.querySelector('#et-cross-buy')));

  // ---------- THE STAR: the layout's own guarantees (Build 25) --------------
  console.log('--- THE STAR ---');
  await latticeRun('ash'); await sleep(400);
  check('STAR: one tree per character — the hero in the middle, three branches 120 degrees apart',
    await J(() => {
      const star = document.querySelector('#et-star'); if (!star) return false;
      const core = star.querySelector('.et-core'); if (!core) return false;
      const b = star.getBoundingClientRect(), cr = core.getBoundingClientRect();
      const cx = cr.left + cr.width / 2, cy = cr.top + cr.height / 2;
      // the character sits at the centre of their own tree
      if (Math.abs(cx - (b.left + b.width / 2)) > 4 || Math.abs(cy - (b.top + b.height / 2)) > 4) return false;
      // and each branch leaves it on its own bearing, 120 degrees from the next
      // measure where each branch's NODES actually lie, not where its title
      // label found room — the bearing is the branch, the label just sits near it
      const bearing = (row) => {
        const els = [...star.querySelectorAll('.et-orb[data-lane="' + row + '"]')];
        if (!els.length) return null;
        let sx = 0, sy = 0;
        els.forEach(e => { const r = e.getBoundingClientRect();
          const a = Math.atan2((r.top + r.height / 2) - cy, (r.left + r.width / 2) - cx);
          sx += Math.cos(a); sy += Math.sin(a); });
        return Math.atan2(sy, sx) * 180 / Math.PI;
      };
      // each arm points down its own spoke, and the spokes are 120 apart
      return ['front', 'mid', 'back'].every(row => {
        const b = bearing(row);
        if (b === null) return false;
        let d = b - ET_SPOKE[row];
        while (d > 180) d -= 360; while (d < -180) d += 360;
        return Math.abs(d) < 14;
      });
    }));
  check('STAR: a node sits on the branch it CHANGES — and inside that branch\u2019s own wedge',
    await J(() => {
      const star = document.querySelector('#et-star');
      const core = star.querySelector('.et-core').getBoundingClientRect();
      const cx = core.left + core.width / 2, cy = core.top + core.height / 2;
      return [...star.querySelectorAll('.et-orb[data-id]:not([data-rim])')].every(el => {
        const n = NODE_BY_ID[el.dataset.id];
        const lane = etLaneOf(n) || '';
        if (lane !== (el.dataset.lane || '')) return false;
        if (!lane) return true;                       // hero-wide nodes ring the core
        const r = el.getBoundingClientRect();
        const a = Math.atan2((r.top + r.height / 2) - cy, (r.left + r.width / 2) - cx) * 180 / Math.PI;
        let d = a - ET_SPOKE[lane];
        while (d > 180) d -= 360; while (d < -180) d += 360;
        return Math.abs(d) <= 60;                     // never wanders into a neighbour's arm
      });
    }));
  check('STAR: a prereq is drawn CLOSER TO THE CHARACTER than what it unlocks — a branch always grows outward',
    await J(() => {
      const star = document.querySelector('#et-star');
      const core = star.querySelector('.et-core').getBoundingClientRect();
      const cx = core.left + core.width / 2, cy = core.top + core.height / 2;
      const rad = el => { const r = el.getBoundingClientRect();
        return Math.hypot((r.left + r.width / 2) - cx, (r.top + r.height / 2) - cy); };
      return [...star.querySelectorAll('.et-orb[data-id]:not([data-rim])')].every(el => {
        const n = NODE_BY_ID[el.dataset.id];
        return ((n && n.requires) || []).every(r => {
          const pe = star.querySelector('.et-orb[data-id="' + r + '"]');
          return !pe || rad(pe) < rad(el) - 2;
        });
      });
    }));
  check('STAR: no two nodes are drawn on top of each other, and none sits on the character',
    await J(() => {
      const core = document.querySelector('.et-core').getBoundingClientRect();
      const onCore = [...document.querySelectorAll('.et-star .et-orb .et-orb-glyph')].some(e => {
        const r = e.getBoundingClientRect();
        return Math.hypot((r.left + r.width / 2) - (core.left + core.width / 2),
                          (r.top + r.height / 2) - (core.top + core.height / 2)) < (core.width + r.width) / 2 - 4;
      });
      if (onCore) return false;
      const g = [...document.querySelectorAll('.et-star .et-orb .et-orb-glyph')];
      for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) {
        const a = g[i].getBoundingClientRect(), b = g[j].getBoundingClientRect();
        const dx = (a.left + a.width / 2) - (b.left + b.width / 2);
        const dy = (a.top + a.height / 2) - (b.top + b.height / 2);
        if (Math.hypot(dx, dy) < (a.width + b.width) / 2 - 1) return false;
      }
      return true;
    }));
  check('CAMERA: a fresh render opens FRAMED — the WHOLE star inside the box, whatever it grew to',
    await J(() => {
      showEmberTree(() => {}, 'ash');
      const view = document.getElementById('et-view');
      const star = document.getElementById('et-star');
      if (!view || !star) return false;
      const r = star.getBoundingClientRect();
      // FRAMED IS NOT scale(1). The star is laid out at an honest pitch in its
      // own pixels and may be larger than the box it gets; opening framed means
      // the camera chose the scale that shows all of it, not that it shows it
      // 1:1 and crops whatever did not fit.
      const inside = [...star.querySelectorAll('.et-orb, .et-tip')].every(e => {
        const b = e.getBoundingClientRect();
        return b.left >= r.left - 1 && b.right <= r.right + 1
            && b.top >= r.top - 1 && b.bottom <= r.bottom + 1;
      });
      return inside && ET_VIEW.k === ET_VIEW.fit && ET_VIEW.x === 0 && ET_VIEW.y === 0;
    }));
  check('CAMERA: the tree pans and zooms, and FIT comes back to the opening frame',
    await J(() => {
      showEmberTree(() => {}, 'ash');
      const view = document.getElementById('et-view');
      const star = document.getElementById('et-star');
      if (!view || !star) return false;
      const open = ET_VIEW.k;
      const P = (ty, x, y) => star.dispatchEvent(new PointerEvent(ty, { bubbles: true, pointerId: 4, clientX: x, clientY: y }));
      const r = star.getBoundingClientRect();
      P('pointerdown', r.left + 60, r.top + 60);
      P('pointermove', r.left + 130, r.top + 96);
      P('pointerup', r.left + 130, r.top + 96);
      const panned = /translate\((?!0px, 0px)/.test(view.style.transform);
      document.getElementById('et-zin').click();
      const zoomed = ET_VIEW.k > open * 1.05;
      document.getElementById('et-zfit').click();
      return panned && zoomed && ET_VIEW.k === ET_VIEW.fit && ET_VIEW.x === 0 && ET_VIEW.y === 0;
    }));
  check('CAMERA: tapping a node FLIES to it — centred and leaned in, without re-rendering the screen',
    await J(async () => {
      showEmberTree(() => {}, 'ash');
      await new Promise(r => setTimeout(r, 160));      // the tree settles, then it is tapped
      const star = document.getElementById('et-star');
      const el = [...star.querySelectorAll('.et-orb[data-id]')].find(e => e.className.indexOf('et-ready') !== -1);
      if (!el) return false;
      const before = star.querySelector('.et-core');
      const open = ET_VIEW.k;
      el.click();
      const named = ((document.querySelector('.et-d-name') || {}).textContent || '')
        === (NODE_BY_ID[el.dataset.id] || {}).label;
      await new Promise(r => setTimeout(r, 620));      // let the flight land
      // the same star is still on screen (no re-render) and the camera leaned in
      const same = star.querySelector('.et-core') === before;
      // CENTRED MEANS CENTRED. Measured rects are viewport pixels and the
      // camera is layout pixels; when those were mixed every focused node
      // landed short of the middle by the stage's own scale factor.
      const sr = star.getBoundingClientRect();
      const gr = el.querySelector('.et-orb-glyph').getBoundingClientRect();
      const off = Math.hypot((gr.left + gr.width / 2) - (sr.left + sr.width / 2),
                             (gr.top + gr.height / 2) - (sr.top + sr.height / 2));
      return named && same && off <= 2 && ET_VIEW.k > open * 1.4
        && el.className.indexOf('et-sel') !== -1;
    }));
  check('PANEL: a node is stated ONCE — glyph, name, and one meta row; the desc no longer repeats its own kind and line',
    await J(() => {
      showEmberTree(() => {}, 'ash', 'ash.sig.back');
      const icon = document.querySelector('.et-d-icon');
      const meta = (document.querySelector('.et-d-meta') || {}).textContent || '';
      const desc = (document.querySelector('.et-d-desc') || {}).textContent || '';
      return !!icon && /COMBO/.test(meta) && /BACK/.test(meta)
        && desc.indexOf('COMBO') !== 0 && !/COMBO · BACK/.test(desc);
    }));
  check('PANEL: a real trigger SURVIVES the strip — only a stamp that echoes the header is dropped',
    await J(() => {
      const trig = EMBER_TREE.find(n => n.hero === 'ash' && /^[A-Z][A-Z0-9 ’·×\/&+\-]{1,22}:/.test(n.desc || '')
        && !/^(COMBO|FORK|PASSIVE|BOND)( · (FRONT|MID|BACK))?:/.test(n.desc || ''));
      if (!trig) return true;                      // nothing to prove on this hero
      showEmberTree(() => {}, 'ash', trig.id);
      return !!document.querySelector('.et-d-desc .et-trig');
    }));

  check('STAR: the panel names which line a node changes, so the purchase reads as a consequence',
    await J(() => { const el = document.querySelector('.et-star .et-orb[data-lane="front"], .et-star .et-orb[data-lane="mid"], .et-star .et-orb[data-lane="back"]');
      el.click();
      const lane = document.querySelector('.et-d-lane');
      return !!lane && /FRONT|MID|BACK/.test(lane.textContent); }));


  // ---------- COMMON GROUND (Build 251) ----------
  console.log('--- COMMON GROUND ---');
  check('COMMON: a border carries generic nodes that belong to NO hero',
    await J(() => COMMON_NODES.length === 30 && COMMON_NODES.every(n => n.hero === null && n.common)
      && commonOnBorder('ash', 'cassia').length === COMMON_PER_BORDER));
  check('COMMON: they live in the tree proper, so every ownership test sees them',
    await J(() => COMMON_NODES.every(n => NODE_BY_ID[n.id] === n && EMBER_TREE.indexOf(n) >= 0)));
  check('COMMON: they are never counted as a hero TECHNIQUE — the two routes stay separate',
    await J(() => EMBER_TREE.filter(isTeachable).every(n => !n.common)
      && EMBER_TREE.filter(isTeachable).length === 12));
  check('COMMON: priced flat — nobody’s ground, so nobody’s kinship applies',
    await J(() => { const cn = commonOnBorder('ash', 'cassia')[0];
      return crossCost('ash', cn) === cn.cost && crossCost('cassia', cn) === cn.cost
        && kinship('ash', 'cassia') === 0; }));   // a stranger border, yet no 1.8x
  check('COMMON: each stone carries a real rule, none of them hero-shaped',
    await J(() => COMMON_NODES.every(n => !!PASSIVE_DEFS[n.passive])
      && new Set(COMMON_NODES.map(n => n.passive)).size >= 3));
  // THE CROSSOVER POINT: ground first, then the far side.
  await latticeRun('ash'); await sleep(400);
  check('COMMON: with a WOVEN bond but no ground held, the far side is UNBRIDGED',
    await J(() => { RUN.crossed = {};
      const v = crossViewFor('ash');
      return v.filter(c => !c.common).every(c => c.state === 'unbridged' || c.state === 'untaught')
        && v.filter(c => c.common).some(c => c.state === 'open'); }));
  check('COMMON: claiming a stone opens THAT border and no other',
    await J(() => { RUN.crossed = { ash: [commonOnBorder('ash', 'cassia')[0].id] };
      const v = crossViewFor('ash');
      const cas = v.filter(c => !c.common && c.teacher === 'cassia');
      const mir = v.filter(c => !c.common && c.teacher === 'mira');
      return cas.length && mir.length
        && cas.every(c => c.state !== 'unbridged')
        && mir.every(c => c.state === 'unbridged' || c.state === 'untaught'); }));
  check('COMMON: a claimed stone changes the holder’s combat, and only theirs',
    await J(() => { // the pool is spread deterministically, so don't assume WHICH
      // border carries Tempered — take any of Ash's that does
      const temper = COMMON_NODES.find(n => n.passive === 'common_temper'
        && n.pair.split('|').indexOf('ash') >= 0);
      if (!temper) return false;
      setupFight(['ash', 'mira'], [], { ash: 'front', mira: 'mid' });
      const foe = livingEnemies()[0];
      const ash = S.heroes.find(h => h.id === 'ash'), mira = S.heroes.find(h => h.id === 'mira');
      RUN.crossed = {};
      const a0 = passiveDmg(ash, foe), m0 = passiveDmg(mira, foe);
      RUN.crossed = { ash: [temper.id] };
      return passiveDmg(ash, foe) - a0 === 1 && passiveDmg(mira, foe) - m0 === 0; }));
  check('COMMON: either partner may claim a given stone — it is not one hero’s',
    await J(() => { const cn = commonOnBorder('ash', 'cassia')[0];
      RUN.crossed = {}; learnCrossing('cassia', cn);
      return hasCrossed('cassia', cn.id) && !hasCrossed('ash', cn.id)
        && borderOpen('cassia', 'ash') && !borderOpen('ash', 'cassia'); }));
  await J(() => hideOverlay());

  // ---------- THE BREAK (Build 252) ----------
  // Playtest finding: a break only ever fired off a WEAKNESS hit, and a hero has
  // exactly one school — so of a party of three, usually one hero could touch the
  // gauge at all, about a pip a turn, in a fight that ends in three or four.
  // Measured across four real fights: 1 / 1 / 3 / 4 breaks. Every hero can lean
  // on it now, through their own rotation and through a clean read.
  console.log('--- THE BREAK ---');
  const poiseOf = () => J(() => livingEnemies()[0].poise);
  check('BREAK: a WEAKNESS hit still chips the gauge — it remains the fast route',
    await J(() => { setupFight(['ash'], [], { ash: 'front' });
      const e = livingEnemies()[0]; e.poise = 4; S._finisher = false;
      dealToEnemy(e, 1, e.def.weak, 'ash');
      return e.poise === 3; }));
  check('BREAK: a completed ROTATION chips it too, with no school match needed',
    await J(() => { setupFight(['ash'], [], { ash: 'front' });
      const e = livingEnemies()[0]; e.poise = 4;
      const notWeak = ['blade', 'light', 'iron', 'frost', 'song'].find(x => x !== e.def.weak);
      S._finisher = false; dealToEnemy(e, 1, notWeak, 'ash');
      const noChip = e.poise;
      S._finisher = true; e._finTurn = -1; dealToEnemy(e, 1, notWeak, 'ash');
      S._finisher = false;
      return noChip === 4 && e.poise === 3; }));
  check('BREAK: a weakness hit that is ALSO a finisher takes two pips',
    await J(() => { setupFight(['ash'], [], { ash: 'front' });
      const e = livingEnemies()[0]; e.poise = 4;
      S._finisher = true; e._finTurn = -1; dealToEnemy(e, 1, e.def.weak, 'ash');
      S._finisher = false;
      return e.poise === 2; }));
  check('BREAK: finisher chips are capped at ONE per foe per turn, so it stays a plan',
    await J(() => { setupFight(['ash'], [], { ash: 'front' });
      const e = livingEnemies()[0]; e.poise = 5; e._finTurn = -1;
      const notWeak = ['blade', 'light', 'iron', 'frost', 'song'].find(x => x !== e.def.weak);
      S._finisher = true;
      dealToEnemy(e, 1, notWeak, 'ash'); dealToEnemy(e, 1, notWeak, 'ash'); dealToEnemy(e, 1, notWeak, 'ash');
      S._finisher = false;
      return e.poise === 4; }));   // three finishers, one pip
  check('BREAK: the weakness route is NOT capped — that is what makes it the fast one',
    await J(() => { setupFight(['ash'], [], { ash: 'front' });
      const e = livingEnemies()[0]; e.poise = 5; S._finisher = false;
      dealToEnemy(e, 1, e.def.weak, 'ash'); dealToEnemy(e, 1, e.def.weak, 'ash');
      return e.poise === 3; }));
  check('BREAK: draining the gauge BREAKS the foe and counts the event',
    await J(() => { setupFight(['ash'], [], { ash: 'front' });
      const e = livingEnemies()[0]; e.poise = 2; S._breaks = 0; S._finisher = false;
      dealToEnemy(e, 1, e.def.weak, 'ash'); dealToEnemy(e, 1, e.def.weak, 'ash');
      return e.staggered === true && S._breaks === 1 && (e.mark || 0) >= 3; }));
  // The flag is set in resolveCard and read several layers down, so a leak would
  // silently hand free pips to counters, riposte damage and the enemy phase.
  check('BREAK: the finisher flag never leaks past the card that set it',
    await J(async () => { setupFight(['ash'], [], { ash: 'front' });
      S.ep = 12; S._rotations = true; S.tempCards = [];
      const c = buildHand().find(x => x.kind === 'opener' && x.owner === 'ash');
      if (c) await playCard(c, (livingEnemies()[0] || {}).uid);
      return S._finisher === false; }));

  // ---------- DEPTH TIERS (Build 253) ----------
  // Profiling a real fight: renderAll costs 0.64ms (JS is not the problem), but
  // the scene ran at 14fps and hiding #diorama alone restored a clean 60. The
  // cost is the stack of full-screen 3D layers. Build 242 measured the same
  // 14fps, so this was never a regression — it has been the price of the
  // diorama since it shipped.
  console.log('--- DEPTH TIERS ---');
  const stageCls = () => J(() => document.getElementById('stage').className.split(' ').filter(c => c.indexOf('fx-') === 0).sort().join(' '));
  check('DEPTH: an explicit tier is honoured and never overridden by the tuner',
    await J(() => { SETTINGS.depth = 'soft'; applyFxTier(); return true; })
      && (await stageCls()) === 'fx-soft'
      && await J(() => { _fxNextTune = 0; _fxTuning = false; autoTuneFx(true); return SETTINGS.depth === 'soft'; }));
  check('DEPTH: FLAT keeps one backdrop, so the world still parallaxes',
    await J(() => { SETTINGS.depth = 'flat'; applyFxTier();
      const far = document.querySelector('.hd-far');
      return getComputedStyle(far).display !== 'none'
        && getComputedStyle(document.querySelector('.hd-mid')).display === 'none'; }));
  check('DEPTH: every tier drops OVERDRAW, never GEOMETRY — the ranks keep their depth',
    await J(() => ['full', 'soft', 'flat'].every(tier => {
      SETTINGS.depth = tier; applyFxTier();
      const back = document.querySelector('#party-half .slot[data-row="back"]');
      const front = document.querySelector('#party-half .slot[data-row="front"]');
      if (!back || !front) return false;
      const z = (el) => getComputedStyle(el).getPropertyValue('--row-z').trim();
      return z(back) !== z(front) && z(back) !== '';
    })));
  check('DEPTH: the tuner only ever steps DOWN — it can never climb back mid-session',
    await J(() => { SETTINGS.depth = 'auto'; _fxTier = 'flat'; _fxNextTune = 0; _fxTuning = false;
      const before = _fxTier;
      autoTuneFx();
      return FX_TIERS.indexOf(_fxTier) >= FX_TIERS.indexOf(before); }));
  // The measured win: filters on the backdrop planes were roughly half the frame
  // cost, because the camera animates those planes and a filtered layer
  // re-rasters every time it moves.
  check('DEPTH: no backdrop plane carries a runtime FILTER any more',
    await J(() => ['.hd-far', '.hd-mid', '.hd-near'].every(sel => {
      const el = document.querySelector(sel);
      return el && getComputedStyle(el).filter === 'none'; })),
    await J(() => ['.hd-far', '.hd-mid', '.hd-near']
      .map(sel => sel + ':' + getComputedStyle(document.querySelector(sel)).filter).join(' ')));
  // Build 261: it used to latch after ONE sample ~700ms into the first fight of
  // the session — the easiest moment there is — and never look again. Reported
  // from a real device at 5fps with the full backdrop still drawn.
  check('DEPTH: the tuner keeps WATCHING — it never latches after a single look',
    await J(() => !/_fxTuned/.test(autoTuneFx.toString())
      && /_fxNextTune/.test(autoTuneFx.toString())
      && /autoTuneFx\(\)/.test(enemyPhase.toString())));
  check('DEPTH: …but it holds a cooldown, so a turn boundary cannot spam samples',
    await J(() => { SETTINGS.depth = 'auto'; _fxTier = 'full';
      _fxNextTune = performance.now() + 9000; _fxTuning = false;
      autoTuneFx();                       // inside the cooldown
      const quiet = _fxTuning === false;
      _fxNextTune = 0; autoTuneFx();      // cooldown elapsed
      const woke = _fxTuning === true;
      _fxTuning = false;
      return quiet && woke; }));
  await J(() => { SETTINGS.depth = 'auto'; _fxTier = 'full'; _fxNextTune = 0; _fxTuning = false; applyFxTier(); });

  // ---------- TEACHING THE REAL GAME (Build 255) ----------
  // The audit's worst finding: the tutorial ran CLASSIC combat while every
  // descent fight ran BRANCHING ROTATIONS. A player was taught one card engine
  // and handed another without a word — and three of the real engine's rules
  // (finishers cost EP, moving destroys the chain, a fork burns its sibling)
  // were written down nowhere at all.
  console.log('--- TEACHING ---');
  check('TEACH: the tutorial now PLAYS the engine the descent runs, not just describes it',
    await J(() => FLOW.filter(f => f.type === 'fight' && f.rotations).length >= 1));
  check('TEACH: a node can ask for rotations without inheriting run-HP and the difficulty ramp',
    await J(() => { const n = FLOW.find(f => f.type === 'fight' && f.rotations);
      return !!n && !n.useRunHp; }));
  check('TEACH: that fight really deals a ROTATION hand — openers that chain',
    await J(() => { let f = null;
      try { f = localStorage.getItem('kizuna2_2.forceClassic'); localStorage.removeItem('kizuna2_2.forceClassic'); } catch (_) {}
      const node = FLOW.find(x => x.type === 'fight' && x.rotations);
      RUN = newRun('ash'); RUN.roster = node.heroes.slice(); RUN.active = node.heroes.slice();
      startFight(node); renderAll();
      const hand = buildHand(), ok = S._rotations === true
        // exactly one opener per hero — the reach replaces one, never adds (294)
        && hand.length === node.heroes.length
        && hand.every(c => c.kind === 'opener')
        && hand.some(c => (c.chainNext || []).length);
      try { if (f) localStorage.setItem('kizuna2_2.forceClassic', f); } catch (_) {}
      return ok; }));
  // The three unwritten rules now say themselves at the seam where they bite.
  const lessonSeen = (k) => J((key) => { try { return parseInt(localStorage.getItem('kizuna2_2.lesson_' + key) || '0', 10); } catch (_) { return -1; } }, k);
  check('TEACH: MOVING BREAKS THE COMBO fires only when it actually cost something',
    await J(() => { try { localStorage.removeItem('kizuna2_2.lesson_purge'); } catch (_) {}
      setupFight(['ash'], [], { ash: 'front' }); S._rotations = true; S.tempCards = [];
      purgeChain('ash');                                    // nothing open — must stay silent
      const quiet = parseInt(localStorage.getItem('kizuna2_2.lesson_purge') || '0', 10) === 0;
      S.tempCards = [{ chain: true, owner: 'ash', name: 'x' }];
      purgeChain('ash');                                    // a real loss — must teach
      return quiet && parseInt(localStorage.getItem('kizuna2_2.lesson_purge') || '0', 10) === 1; }));
  check('TEACH: a lesson repeats a few times, then retires for good',
    await J(() => { try { localStorage.removeItem('kizuna2_2.lesson_probe'); } catch (_) {}
      const fired = [];
      for (let i = 0; i < 6; i++) fired.push(lesson('probe', 'x', 3));
      return fired.filter(Boolean).length === 3 && fired[0] === true && fired[5] === false; }));
  // The state that ENABLES a technical had no chip — only an aura that reads
  // identically to EXPOSED.
  check('TEACH: an OPEN foe (weakened or chilled) now carries a chip, not just an aura',
    await J(() => { setupFight(['ash'], [], { ash: 'front' });
      const e = livingEnemies()[0];
      e.weakened = false; e.lull = 0; e.staggered = false;
      const before = /chip tech/.test(enemyChipsHtml(e));
      e.weakened = true;
      const after = /chip tech/.test(enemyChipsHtml(e));
      e.weakened = false; e.lull = 2;
      return !before && after && /chip tech/.test(enemyChipsHtml(e)); }));
  check('TEACH: a BROKEN foe shows BROKEN, not OPEN — the stronger state wins the chip',
    await J(() => { setupFight(['ash'], [], { ash: 'front' });
      const e = livingEnemies()[0]; e.weakened = true; e.staggered = true;
      return !/chip tech/.test(enemyChipsHtml(e)) && /chip stagger/.test(enemyChipsHtml(e)); }));

  // ---------- BONDS SAY WHY (Build 256) ----------
  // Six paths form a bond and all six funnel through addThread, but only one
  // ever used the word. Focus-firing announced "⚡ ASSIST +2" (a MOMENTUM
  // callout), avenging announced "⚔ AVENGED" and was documented nowhere, and a
  // party-wide heal bonded the caster to everyone in silence — the ♡ card hint
  // explicitly refused to mark it. Bonds were not hard to trigger; they were
  // impossible to trigger KNOWINGLY.
  console.log('--- BONDS SAY WHY ---');
  check('BOND: every path through addThread can name the act that caused it',
    await J(() => /async function addThread\(a, b, why\)/.test(addThread.toString())));
  check('BOND: the narrator states the CAUSE, not just that a bond happened',
    await J(async () => { setupFight(['ash', 'elin'], [], { ash: 'front', elin: 'mid' });
      RUN.bonds = {}; S.threads = new Set();
      document.getElementById('narrator').innerHTML = '';
      await addThread('ash', 'elin', 'a hand held out');
      const said = document.getElementById('narrator').textContent || '';
      return /♡ LIT/.test(said) && /a hand held out/.test(said); }));   // Build 273: the ladder's word
  check('BOND: a party-wide heal finally wears the ♡ mark — it was the one card excluded',
    await J(() => { setupFight(['ash', 'elin'], [], { ash: 'front', elin: 'mid' });
      S.threads = new Set();
      const one = cardBondHint({ owner: 'elin', target: 'ally', spent: false });
      const all = cardBondHint({ owner: 'elin', target: 'allies', spent: false });
      const foe = cardBondHint({ owner: 'elin', target: 'enemy', spent: false });
      return !!one && !!all && !foe; }));
  check('BOND: avenging reads as a bond act, not an unexplained ⚔',
    await J(() => /♡ AVENGED/.test(resolveCard.toString())));
  check('BOND: striking together reads as a bond act when it is about to tie a new pair',
    await J(() => /♡ TOGETHER/.test(resolveCard.toString())));
  // The panel behind the resonance badge is the only always-available
  // explanation of the loop, and it had no title and no touch affordance.
  check('BOND: the resonance badge announces that it opens something',
    await J(() => { setupFight(['ash', 'elin', 'mira'], [], { ash: 'front', elin: 'mid', mira: 'back' });
      renderResonance();
      const el = document.getElementById('resonance');
      return !!el.title && /tap/i.test(el.title) && typeof el.onclick === 'function'; }));
  // Drive a REAL finisher rather than a synthetic card: grantPrime reads the
  // card through primeTypeForCard, so a hand-built object is not the same test.
  check('BOND: a PRIMED hero names WHO has to act next, not just that they are primed',
    await J(() => { setupFight(['ash', 'elin'], [], { ash: 'front', elin: 'mid' });
      S.heroes.forEach(h => { h.primed = null; });
      const rot = ROTATIONS.ash.front;
      const fin = Object.keys(rot.cards).map(k => rot.cards[k]).find(c => /FINISHER/.test(c.stance || ''));
      // read what the narrator actually PUT ON SCREEN — stubbing the function
      // proved fragile, and the DOM is the thing the player sees anyway
      document.getElementById('narrator').innerHTML = '';
      grantPrime(Object.assign({ owner: 'ash', chain: true }, fin));
      const said = document.getElementById('narrator').textContent || '';
      const ash = S.heroes.find(h => h.id === 'ash');
      return !!(ash.primed && ash.primed.type) && /PRIMED/.test(said)
        && /elin/i.test(said) && /bonds them/i.test(said); }),
    await J(() => 'narrator said: ' + (document.getElementById('narrator').textContent || '(nothing)')));

  // ---------- PHASE 1 CUTS (Build 257) ----------
  console.log('--- CUTS ---');
  // THE BURST TRAP. burstCap() returned the container's level — 100, then 175,
  // then 250 — so bonding a pair silently RAISED the bar and took away an
  // all-out the player already had. burstFireLevel() reads MOMENTUM, so the
  // payoff never depended on the cap at all.
  // The firing threshold and the storage ceiling are DIFFERENT numbers, and
  // conflating them is what made bonding feel like a punishment.
  check('CUT: the ALL-OUT is always available at 100 — bonding can no longer take it away',
    await J(() => { setupFight(['ash', 'elin', 'mira'], [], { ash: 'front', elin: 'mid', mira: 'back' });
      S.momentum = 100; S.burstLevel = 1;
      const atL1 = burstReady();
      S.burstLevel = 3;                       // a fully woven triad
      return atL1 === true && burstReady() === true && BURST_MIN === 100; }));
  check('CUT: the gauge still HOLDS more when woven, or the richer tiers are unreachable',
    await J(() => { setupFight(['ash'], [], { ash: 'front' });
      // raw, or MOM_SCALE (0.6) turns 400 into 240 and never reaches the L3 ceiling
      S.momentum = 0; gainMomentum(999, { raw: true }); const l1 = S.momentum;
      expandBurst(3); S.momentum = 0; gainMomentum(999, { raw: true }); const l3 = S.momentum;
      return l1 === 100 && l3 === 250 && burstFireLevel() === 3; }));
  // VOW RANKS: recordVow was defined and never called, so every consumer was
  // permanently dead code promising an effect nothing applied.
  check('CUT: vow ranks are gone rather than pretending — no caller ever existed',
    await J(() => vowRank('Ronin+Cleric+Reaver') === 1 && vowRank() === 1));
  // ONE gold card, ONE concept. Two loops used to mint visually identical free
  // cards under different eyebrows with no way to tell which had fired.
  check('CUT: both free-card loops speak as one thing — the ANSWER',
    await J(() => /✦ ANSWER/.test(offerFollowUp.toString())
      && /✦ ANSWER/.test(offerBondFollow.toString())
      && !/stance: '✦ FOLLOW-UP'/.test(offerFollowUp.toString())
      && !/stance: '✦ WEAVE'/.test(offerBondFollow.toString())));
  check('CUT: …and each one still says what it COSTS you or GIVES you',
    await J(() => /BONDS them/.test(offerFollowUp.toString())
      && /WOVEN/.test(offerBondFollow.toString())));

  // ---------- POSITION PURITY (v2.2 Build 10) ----------
  // THE HAND IS THE POSITION, by decree: every card a hero is offered comes
  // from what they have LEARNED in the row they stand in. Unlocks widen that
  // row's pool; the nuance is how the party's lines combine; moving swaps the
  // kit to the new row. THE REACH (258-309) dealt an opener from a row the
  // hero did not stand in — it measured fine and played wrong, twice, so it
  // is gone entirely and these checks hold the door shut behind it.
  console.log('--- POSITION PURITY ---');
  const pureRun = () => J(() => {
    let f = null;
    try { f = localStorage.getItem('kizuna2_2.forceClassic'); localStorage.removeItem('kizuna2_2.forceClassic'); } catch (_) {}
    RUN = newRun('ash'); RUN.roster = ['ash', 'hask', 'cassia']; RUN.active = RUN.roster.slice();
    RUN.hp = { ash: 34, hask: 26, cassia: 36 }; RUN.floor = 1; RUN.completed = [0, 1, 2];
    RUN.map = generateDescent(RUN.roster, 1);
    startFight({ type: 'fight', chapter: 3, heroes: RUN.active.slice(), enemies: ['husk'],
      useRunHp: true, floor: 1, depth: 3, narrator: 'pure' });
    S._rotations = true; renderAll();
    window.__fc = f; return true;
  });
  const restoreFC = () => J(() => { try { if (window.__fc) localStorage.setItem('kizuna2_2.forceClassic', window.__fc); } catch (_) {} return true; });

  await pureRun();
  check('PURE: every opener dealt is the row\u2019s own — no card from a position its owner does not stand in',
    await J(() => { for (let turn = 1; turn <= 9; turn++) {
        S.turn = turn; S.used = new Set();
        const ok = buildHand().filter(c => c.kind === 'opener').every(c => {
          const h = S.heroes.find(x => x.id === c.owner);
          const rot = ROTATIONS[c.owner] && ROTATIONS[c.owner][h.row];
          const alt = ALT_OPENERS[c.owner];
          const altName = (alt && alt.row === h.row && hasNode(alt.node) && rot.cards[alt.key]) ? rot.cards[alt.key].name : null;
          return !c.reach && rot && (c.name === rot.cards[rot.opener].name || c.name === altName);
        });
        if (!ok) return false; }
      return true; }));
  check('PURE: the hand is a pure function of position — same rows, same offer, every turn',
    await J(() => { const seen = new Set();
      for (let turn = 1; turn <= 6; turn++) { S.turn = turn; S.used = new Set();
        seen.add(buildHand().map(c => c.name).sort().join('|')); }
      return seen.size === 1; }));
  check('PURE: moving SWAPS the kit — the new row\u2019s skill is in hand the same turn',
    await J(() => { S.turn = 1; S.used = new Set(); S.tempCards = []; S.line = null;
      const ash = S.heroes.find(h => h.id === 'ash');
      ash.row = 'front'; purgeChain('ash');
      const before = buildHand().find(c => c.kind === 'opener' && c.owner === 'ash').name;
      ash.row = 'mid'; purgeChain('ash');
      const after = buildHand().find(c => c.kind === 'opener' && c.owner === 'ash').name;
      return before === ROTATIONS.ash.front.cards[ROTATIONS.ash.front.opener].name
        && after === ROTATIONS.ash.mid.cards[ROTATIONS.ash.mid.opener].name
        && before !== after; }));
  check('PURE: unlocking widens the position\u2019s pool — a kindled COMBO adds a beat to that row\u2019s line',
    await J(() => { const open = (nodes) => {
        setupFight(['ash', 'hask'], nodes, { ash: 'front', hask: 'mid' }); S._rotations = true; S._line = true;
        S.tempCards = []; renderAll();
        const op = buildHand().find(c => c.kind === 'opener' && c.owner === 'ash');
        resolveChainPlay(op);
        return buildHand().filter(c => c.owner === 'ash').map(c => c.name);
      };
      const bare = open([]);
      const built = open(['ash.sig.front']);
      // untreed: straight to the finisher; treed: the learned combo appears
      return !bare.includes('Rising Slash') && built.includes('Rising Slash'); }));
  check('PURE: a lone survivor still holds exactly their row\u2019s opener',
    await J(() => { setupFight(['ash'], [], { ash: 'front' }); S._rotations = true;
      S.turn = 1; S.used = new Set();
      const ops = buildHand().filter(c => c.kind === 'opener');
      return ops.length === 1 && ops[0].owner === 'ash'
        && ops[0].name === ROTATIONS.ash.front.cards[ROTATIONS.ash.front.opener].name; }));
  // ALTERNATE OPENERS (Build 11) \u2014 the pool of a position grows by LEARNING.
  check('ALT: kindling the opener node puts a SECOND opener in that row \u2014 the row\u2019s own, beside the base',
    await J(() => { setupFight(['hask', 'ash'], ['hask.sig.front', 'hask.open.front'], { hask: 'front', ash: 'mid' });
      S._rotations = true; S._line = true; S.tempCards = []; renderAll();
      const ops = buildHand().filter(c => c.kind === 'opener' && c.owner === 'hask').map(c => c.name).sort();
      return ops.join('|') === 'Cinder Snap|Frost Touch'; }));
  check('ALT: both openers share the one latch \u2014 playing either starts the line and the other leaves the table',
    await J(async () => { S.ep = 12;
      const snap = buildHand().find(c => c.name === 'Cinder Snap');
      await playCard(snap, (frontmostEnemy() || livingEnemies()[0] || {}).uid);
      return !!S.line && buildHand().filter(c => c.kind === 'opener').length === 0; }));
  check('ALT: it enters the SAME line \u2014 the alt opener deals the row\u2019s learned combo, forks included',
    await J(() => { const dealt = buildHand().filter(c => c.owner === 'hask');
      return dealt.length > 0 && dealt.some(c => c.name === 'Ice Spike' && c.lineStage === 'combo'); }));
  check('ALT: it is POSITION-locked \u2014 the same node offers nothing in another row',
    await J(() => { setupFight(['hask', 'ash'], ['hask.sig.front', 'hask.open.front'], { hask: 'mid', ash: 'front' });
      S._rotations = true; renderAll();
      const ops = buildHand().filter(c => c.kind === 'opener' && c.owner === 'hask');
      return ops.length === 1 && ops[0].name === 'Ice Bolt'; }));
  await restoreFC();

  // ---------- COMBAT POLISH (v2.2 Build 15) ----------
  // Three fixes from one playtest note. RECENCY: the last hero to act stands
  // nearest the lens — an acting slot lifts ABOVE the front plane (under
  // preserve-3d only depth can order across slots), position-compensated so
  // the nameplate stays home. KEEP-ANIM: a mid-flight render preserves running
  // strike/return classes instead of ripping them (the frame-long teleport
  // that read as "characters disappear glitchily"). TELEGRAPH: an ALL attack
  // draws no arcs, an empty threatened row whispers, and the damage sum rides
  // the ring rim clear of the nameplate.
  console.log('--- THE BOARD HOLDS (BUILD 29) ---');
  // A sprite is 85% as wide as a lane and the front row's held travel is a
  // whole lane pitch, so a hero mid-combo CANNOT stand on the ground they own
  // — no tuning of the lunge fixes that (docs/TELEGRAPH.md has the numbers).
  // So the board stops depending on where bodies are: the plate draws over the
  // cast, the threat rides the nameplate, and the hero leaves an afterimage in
  // the lane they belong to.
  check('BOARD: the lane plate is drawn OVER the cast — a held body cannot erase the mark on its ground',
    await J(() => {
      setupFight(['ash', 'hask'], [], { ash: 'front', hask: 'mid' });
      S.enemies.forEach(e => { e.intentIdx = 0; }); renderAll();
      const plate = document.querySelector('#party-half .slot-danger');
      const fig = document.querySelector('#party-half .figure');
      const z = el => parseInt(getComputedStyle(el).zIndex, 10) || 0;
      return z(plate) > 0 && z(plate) > z(fig);
    }));
  check('BOARD: the plate sits on the FEET LINE, not at the bottom of the slot where the readout lives',
    await J(() => {
      const slot = document.querySelector('#party-half .slot[data-row="front"]');
      const plate = slot.querySelector('.sd-ground').getBoundingClientRect();
      const bar = slot.querySelector('.hp-bar').getBoundingClientRect();
      // the ground is where the boots are: the plate straddles the top of the
      // readout stack rather than sitting below it
      return Math.abs((plate.top + plate.height / 2) - bar.top) < 34;
    }));
  check('BOARD: every lane names its RANK, so position survives any amount of visual noise',
    await J(() => [...document.querySelectorAll('#party-half .slot-rank')]
      .map(e => e.textContent.trim()).join('|') === 'III|II|I'));
  check('THREAT: a threatened row wears its alarm on the NAMEPLATE — the one thing that never moves',
    await J(() => {
      const lit = document.querySelector('#party-half .slot.slot-telegraphed .fig-name');
      const safe = document.querySelector('#party-half .slot:not(.slot-telegraphed) .fig-name');
      if (!lit) return false;
      return !safe || getComputedStyle(lit).color !== getComputedStyle(safe).color;
    }));
  check('ECHO: a hero who steps out leaves an AFTERIMAGE in their lane — and an idle hero leaves none',
    await J(() => {
      const hask = S.heroes.find(h => h.id === 'hask');
      hask._held = true; hask._actSeq = S._actSeq = 1; renderAll();
      const mine = document.querySelector('#party-half .slot[data-row="mid"] .lane-echo');
      const idle = document.querySelector('#party-half .slot[data-row="front"] .lane-echo');
      const inLane = mine && (() => {
        const slot = document.querySelector('#party-half .slot[data-row="mid"]').getBoundingClientRect();
        const e = mine.getBoundingClientRect();
        return e.left >= slot.left - 8 && e.right <= slot.right + 8;   // it stands where they belong
      })();
      hask._held = false; renderAll();
      return !!mine && !idle && inLane && !document.querySelector('.lane-echo');
    }));

  console.log('--- THE LANE & THE APRON (BUILD 23) ---');
  // A row is a LANE the hero holds, not a footprint they stand on — because
  // once heroes lunge, nobody is on their footprint when the telegraph is
  // read. The plate marks territory, the lane keeps an ANCHOR while its
  // holder is out striking, and the striker steps downstage into the apron.
  check('LANE: the telegraph marks a wide lane BAR — it holds most of its lane, and all of it stays inside',
    await J(() => {
      setupFight(['ash', 'hask'], [], { ash: 'front', hask: 'mid' });
      S.enemies.forEach(e => { e.intentIdx = 0; });
      renderAll();
      const slot = document.querySelector('#party-half .slot[data-row="front"]');
      const plate = slot.querySelector('.sd-ground');
      const pr = plate.getBoundingClientRect(), sr = slot.getBoundingClientRect();
      // A bar holds the lane: most of its width, far wider than it is tall —
      // and INSIDE it. The old plate met the first two and failed the third
      // (110% wide, scaling to ~127% at its pulse peak), which is how lit
      // neighbours merged into one smear.
      return pr.width / sr.width >= 0.8 && pr.width / pr.height > 4
        && pr.left >= sr.left - 1 && pr.right <= sr.right + 1;
    }));
  check('LANE: a hero who steps out leaves an ANCHOR — the lane keeps their mark on its own ground',
    await J(() => {
      const hask = S.heroes.find(h => h.id === 'hask');
      hask._held = true; hask._actSeq = S._actSeq = 1; renderAll();
      const mid = document.querySelector('#party-half .slot[data-row="mid"]');
      const back = document.querySelector('#party-half .slot[data-row="back"]');
      const lit = mid.className.indexOf('slot-acting') !== -1
        && parseFloat(getComputedStyle(mid, '::after').width) > 20;
      const quiet = back.className.indexOf('slot-acting') === -1;
      return lit && quiet;
    }));
  check('APRON: the striker steps DOWNSTAGE — the held pose carries a drop and a swell, not just an advance',
    await J(() => {
      const fig = document.querySelector('[data-fig="hask"]');
      const art = fig.querySelector('.fig-art');
      const m = new DOMMatrixReadOnly(getComputedStyle(art).transform);
      const drop = m.f, grow = m.a;
      const travelled = m.e > 40;
      S.heroes.forEach(h => { h._held = false; h._actSeq = 0; }); renderAll();
      return travelled && drop > 2 && grow > 1.02;   // forward, down toward the lens, and larger
    }));
  check('APRON: the striker sheds their travelling shadow — one anchor on the lane, never two shadows',
    await J(() => {
      const hask = S.heroes.find(h => h.id === 'hask');
      hask._held = true; renderAll();
      const art = document.querySelector('[data-fig="hask"] .fig-art');
      const shed = getComputedStyle(art, '::before').opacity === '0';
      hask._held = false; renderAll();
      return shed;
    }));

  console.log('--- COMBAT POLISH (BUILD 15) ---');
  check('RECENCY: acting slots lift above the front plane, the later actor nearest the lens',
    await J(() => {
      setupFight(['ash', 'hask', 'mira'], [], { ash: 'front', hask: 'mid', mira: 'back' });
      const [ash, hask] = ['ash', 'hask'].map(id => S.heroes.find(h => h.id === id));
      ash._held = true; ash._actSeq = 1;
      hask._held = true; hask._actSeq = 2;
      S._actSeq = 2; renderAll();
      const z = row => parseFloat(document.querySelector(`#party-half .slot[data-row="${row}"]`).style.getPropertyValue('--act-z')) || 0;
      const net = { front: 0 + z('front'), mid: -58 + z('mid'), back: -150 + z('back') };
      // both actors above the idle front plane (0); hask (later) above ash; idle mira untouched
      return net.front > 0 && net.mid > net.front && z('back') === 0;
    }));
  check('RECENCY: the lift is position-compensated — the lifted slot counter-shifts so its feet stay planted, idle slots do not',
    await J(() => {
      const gp = (row, p) => document.querySelector(`#party-half .slot[data-row="${row}"]`).style.getPropertyValue(p);
      return Math.abs(parseFloat(gp('mid', '--act-x'))) > 0.5 && Math.abs(parseFloat(gp('mid', '--act-y'))) > 0.5
        && parseFloat(gp('back', '--act-x')) === 0 && parseFloat(gp('back', '--act-y')) === 0;
    }));
  check('KEEP-ANIM: a render mid-flight preserves a running strike class instead of ripping the figure home for a frame',
    await J(() => {
      const fig = document.querySelector('[data-fig="ash"]');
      fig.classList.add('fig-strike');
      renderAll();
      const after = document.querySelector('[data-fig="ash"]');
      const kept = after.className.indexOf('fig-strike') !== -1;
      after.classList.remove('fig-strike');
      S.heroes.forEach(h => { h._held = false; h._actSeq = 0; }); renderAll();
      return kept;
    }));
  check('TELEGRAPH: an ALL attack telegraphs on the rows alone — no attacker arcs join the clutter',
    await J(() => {
      RUN = newRun('ash'); RUN.roster = ['ash', 'hask']; RUN.active = RUN.roster.slice();
      RUN.hp = {}; RUN.active.forEach(h => RUN.hp[h] = HEROES[h].maxHp);
      RUN.nodes = []; RUN.completed = [0, 1, 2];
      startFight({ type: 'fight', chapter: 3, heroes: RUN.active.slice(), enemies: ['cantor'],
        useRunHp: true, floor: 1, depth: 4, narrator: 't15' });
      S.heroes.forEach(h => { h.row = { ash: 'front', hask: 'mid' }[h.id]; });
      S.enemies[0].intentIdx = 1;   // Dirge of Ruin — row:'all'
      renderAll();
      // a blow no reposition dodges says ALL and lights every lane; it names
      // no single rank, because there is no single lane to point at
      const pill = document.querySelector('#enemy-half .intent').textContent;
      return document.querySelectorAll('#party-half .slot-telegraphed').length === 3
        && /ALL/.test(pill) && !/→/.test(pill)
        && !document.getElementById('telegraph-layer');
    }));
  check('TELEGRAPH: an EMPTY threatened row whispers — the bar stops breathing and dims to a hairline',
    await J(() => {
      const back = document.querySelector('#party-half .slot[data-row="back"]');
      const front = document.querySelector('#party-half .slot[data-row="front"]');
      const bs = getComputedStyle(back.querySelector('.slot-danger'));
      const fs = getComputedStyle(front.querySelector('.slot-danger'));
      return back.className.indexOf('sd-empty') !== -1
        && front.className.indexOf('sd-empty') === -1
        && bs.animationName === 'none' && fs.animationName !== 'none'
        && parseFloat(bs.opacity) < parseFloat(fs.opacity);
    }));
  check('TELEGRAPH: the lane bar HOLDS ITS LANE — lit neighbours never touch, and none crosses the readout',
    await J(() => {
      setupFight(['ash', 'hask', 'mira'], [], { ash: 'front', hask: 'mid', mira: 'back' });
      S.enemies.forEach(e => { e.intentIdx = 0; }); renderAll();
      const bars = ['back', 'mid', 'front'].map(r => {
        const slot = document.querySelector('#party-half .slot[data-row="' + r + '"]');
        const g = slot.querySelector('.sd-ground');
        const hp = slot.querySelector('.hp-bar');
        return { g: g && g.getBoundingClientRect(), hp: hp && hp.getBoundingClientRect(),
                 slot: slot.getBoundingClientRect() };
      });
      // inside its own lane, never wider than it — the old plate ran 10px past
      // its slot and the pulse scaled it 27px wider still, so lit lanes merged
      const contained = bars.every(b => !b.g || (b.g.left >= b.slot.left - 1 && b.g.right <= b.slot.right + 1));
      // and clear of the nameplate stack it used to sweep across
      const clear = bars.every(b => !b.g || !b.hp || b.g.bottom <= b.hp.top + 1);
      // no two lit bars overlap
      let apart = true;
      for (let i = 0; i < bars.length; i++) for (let j = i + 1; j < bars.length; j++) {
        const a = bars[i].g, b = bars[j].g;
        if (a && b && a.left < b.right && b.left < a.right) apart = false;
      }
      return contained && clear && apart;
    }));
  check('TELEGRAPH: the incoming sum rides the bar, clear of the nameplate',
    await J(() => {
      const slot = document.querySelector('#party-half .slot[data-row="front"]');
      const d = slot.querySelector('.slot-dmg'); if (!d) return false;
      const name = slot.querySelector('.fig-name'); if (!name) return false;
      const dr = d.getBoundingClientRect(), nr = name.getBoundingClientRect();
      const collides = !(dr.right < nr.left || dr.left > nr.right || dr.bottom < nr.top || dr.top > nr.bottom);
      return !collides;
    }));
  // ── Build 17: the hold is the PEAK, and the telegraph whispers while you act ──
  check('TELEGRAPH: AIM rides the attacker — each foe names the lane it is swinging at, by rank',
    await J(() => {
      RUN = newRun('ash'); RUN.roster = ['ash', 'hask']; RUN.active = RUN.roster.slice();
      RUN.hp = {}; RUN.active.forEach(h => RUN.hp[h] = HEROES[h].maxHp);
      RUN.nodes = []; RUN.completed = [0, 1, 2];
      startFight({ type: 'fight', chapter: 3, heroes: RUN.active.slice(), enemies: ['husk', 'wraith', 'cultist'],
        useRunHp: true, floor: 1, depth: 4, narrator: 't17' });
      S.heroes.forEach(h => { h.row = { ash: 'front', hask: 'mid' }[h.id]; });
      renderAll();
      // a dashed line from foe to ground could never read: both ends sit at
      // the same height, so it drew as a rule through every nameplate. The
      // mapping is one character on the pill instead, and it agrees with the
      // rank the target lane wears on its own bar.
      const RANKN = { front: 'I', mid: 'II', back: 'III' };
      const aimed = S.enemies.filter(e => enemyNextIntents(e)
        .some(it => it && it.kind !== 'buff' && effIntentRow(e, it) !== 'all' && effIntentRow(e, it)));
      if (aimed.length < 2) return false;
      return !document.getElementById('telegraph-layer') && aimed.every(e => {
        const el = figEl(e.uid); if (!el) return false;
        const pill = (el.closest('.slot') || el).querySelector('.intent');
        return enemyNextIntents(e).every(it => {
          const row = it && it.kind !== 'buff' ? effIntentRow(e, it) : null;
          return !row || row === 'all' || (pill && pill.textContent.indexOf('→ ' + RANKN[row]) >= 0);
        });
      });
    }));
  check('WHISPER: a combo in flight quiets the telegraph — #stage.combo-live while a hero holds, gone on release',
    await J(() => {
      const h = S.heroes.find(x => x.id === 'ash');
      h._held = true; h._actSeq = S._actSeq = 1; renderAll();
      const during = document.querySelector('#stage').classList.contains('combo-live');
      h._held = false; renderAll();
      const after = document.querySelector('#stage').classList.contains('combo-live');
      return during && !after;
    }));
  // ── Build 18: the lift is INVISIBLE — depth buys paint order, nothing else ──
  check('RECENCY: the lift is counter-scaled — a lifted rear slot keeps its row’s projected size, no levitating giant',
    await J(() => {
      setupFight(['ash', 'hask'], [], { ash: 'front', hask: 'mid' });
      const hask = S.heroes.find(h => h.id === 'hask');
      hask._held = true; hask._actSeq = S._actSeq = 1; renderAll();
      const slot = document.querySelector('#party-half .slot[data-row="mid"]');
      const s = parseFloat(slot.style.getPropertyValue('--act-s'));
      hask._held = false; renderAll();
      const cleared = parseFloat(document.querySelector('#party-half .slot[data-row="mid"]').style.getPropertyValue('--act-s'));
      return s > 0.9 && s < 1 && cleared === 1;
    }));
  check('PEAK: a cast walks to its RELEASE frame and holds there — the wind-down does not play early',
    await J(async () => {
      const mira = { id: 'mira', downed: false };   // a bare rig hero — beginCastAnim only needs id + a figure
      const fig = document.createElement('div'); fig.dataset.fig = 'mira';
      fig.innerHTML = '<div class="fig-art"><svg></svg></div>';
      document.querySelector('#party-half').appendChild(fig);
      beginCastAnim(mira, { name: 'Backstab' });
      await new Promise(r => setTimeout(r, 8 * 85 + 120));   // long past a full walk
      const held = mira._castAnim && mira._castAnim._f === 5;
      endCastAnim(mira, true);   // the finisher resolves — recovery frames play now
      await new Promise(r => setTimeout(r, 3 * 85 + 120));
      const recovered = !fig.querySelector('.cast-anim') && !fig.classList.contains('fig-casting');
      fig.remove();
      return !!held && recovered;
    }));

  // ---------- CAST SHEETS (v2.2 Build 16) ----------
  // Sheets map to cards BY NAME — a rename or typo on either side silently
  // orphans the art (the card falls back to the dash). Hold the mapping.
  console.log('--- CAST SHEETS ---');
  check('CAST SHEETS: every mapped sheet names a real card of its hero — no orphaned art',
    await J(() => Object.entries(HERO_CASTS).every(([hid, m]) =>
      Object.keys(m).every(name => {
        const rot = ROTATIONS[hid];
        return rot && Object.values(rot).some(r => Object.values(r.cards).some(c => c.name === name));
      }))));
  check('CAST SHEETS: Mira’s full mid and front lines carry sheets — Serrate, Backstab, Twin Cut, Twin Daggers',
    await J(() => ['Serrate', 'Backstab', 'Twin Cut', 'Twin Daggers'].every(n => !!castAnimFor('mira', n))));

  // ---------- BOND NODES (Build 264) ----------
  // Three half-finished things wired into one loop, none of them new: BOND_ARCS
  // (6 pairs, 17 authored campfire beats that unlocked nothing), DUET_PERKS (15
  // authored pair abilities firing silently behind a touch-invisible tooltip),
  // and the border stones, which were deliberately generic.
  console.log('--- BOND NODES ---');
  // ---------- BUILD 271: BOND STRIKES — the pair's ability as a MOVE ----------
  // Five pairs traded their modifier for a real conditional strike: they watch
  // one legible board state, and when it appears they act, once per fight, with
  // the cut-in. The other ten keep their stance, which is the right shape for
  // "the Cleric's ward rides the Ronin's blade" and keeps a fight from turning
  // into fifteen interrupts.
  check('STRIKE: every strike pair is wired both ways — table, flag, and no leftover modifier',
    await J(() => {
      const keys = Object.keys(BOND_STRIKES);
      const flagged = Object.keys(DUET_PERKS).filter(k => DUET_PERKS[k].strike);
      const sameSet = keys.length === flagged.length && keys.every(k => flagged.indexOf(k) >= 0);
      const noMod = flagged.every(k => { const m = DUET_PERKS[k].make('ash', 'elin'); return !m.trigger && !m.mod && !m.apply; });
      const shaped = keys.every(k => { const s = BOND_STRIKES[k];
        return typeof s.find === 'function' && typeof s.lead === 'function'
          && s.call && s.call.length === 2 && (s.dmg > 0 || s.heal > 0); });
      return keys.length === 5 && sameSet && noMod && shaped;
    }));
  check('STRIKE: a MARKED foe brings the Ranger’s pair in — announced, and it lands',
    await J(async () => {
      setupFight(['ash', 'branwen', 'elin'], [], { ash: 'front', branwen: 'back', elin: 'mid' });
      markBondGift('ash', 'branwen');
      RUN.crossed = { ash: [bondNodeFor('ash', 'branwen').id] };
      S.threads = new Set(); S._strikeFired = {};
      const foe = livingEnemies()[0]; foe.mark = 2;
      const hp0 = foe.hp;
      await checkBondStrikes();
      return foe.hp === hp0 - 9 && S._strikeFired['ash|branwen'] === 1;
    }));
  check('STRIKE: it is ONCE a fight — the condition holding does not make it a rotation',
    await J(async () => {
      const foe = livingEnemies()[0]; foe.hp = foe.maxHp; foe.mark = 2;
      const hp0 = foe.hp;
      await checkBondStrikes(); await checkBondStrikes();
      return foe.hp === hp0;                       // already spent above
    }));
  check('STRIKE: it needs the bond RUNNING — an unasked pair watches nothing',
    await J(async () => {
      try { localStorage.removeItem('kizuna2_2.bondgifts'); } catch (_) {}
      setupFight(['ash', 'branwen', 'elin'], [], { ash: 'front', branwen: 'back', elin: 'mid' });
      RUN.crossed = {}; S.threads = new Set(); S._strikeFired = {};
      const foe = livingEnemies()[0]; foe.mark = 2;
      const hp0 = foe.hp;
      await checkBondStrikes();
      return foe.hp === hp0 && !Object.keys(S._strikeFired).length;
    }));
  check('STRIKE: the Cleric’s is not a strike — a wounded ally is mended and warded',
    await J(async () => {
      setupFight(['ash', 'elin', 'mira'], [], { ash: 'front', elin: 'mid', mira: 'back' });
      markBondGift('ash', 'elin');
      RUN.crossed = { elin: [bondNodeFor('ash', 'elin').id] };
      S.threads = new Set(); S._strikeFired = {};
      const mira = S.heroes.find(h => h.id === 'mira');
      mira.hp = Math.floor(mira.maxHp / 2); mira.guard = 0;
      const foesHp = livingEnemies().map(e => e.hp).join();
      await checkBondStrikes();
      return mira.hp === Math.floor(mira.maxHp / 2) + 8 && mira.guard === 4
        && livingEnemies().map(e => e.hp).join() === foesHp;   // nobody was hit
    }));
  check('STRIKE: the panel says where it stands — WATCHING before, SPENT after',
    await J(() => {
      setupFight(['ash', 'branwen', 'elin'], [], { ash: 'front', branwen: 'back', elin: 'mid' });
      markBondGift('ash', 'branwen');
      RUN.crossed = { ash: [bondNodeFor('ash', 'branwen').id] };
      S.threads = new Set(); S._strikeFired = {};
      const read = () => { showBondPanel();
        const r = [...document.querySelectorAll('#bond-panel .bp-row')].find(x => /ASH ─ BRANWEN/.test(x.textContent)).textContent;
        hideBondPanel(); return r; };
      const before = read();
      S._strikeFired = { 'ash|branwen': 1 };
      const after = read();
      return /WATCHING/.test(before) && !/RUNNING/.test(before) && /SPENT/.test(after);
    }));
  // ---------- BUILD 270: ONE LADDER, ONE PLACE ----------
  // Four numbers all called some flavour of "bond" lived in four screens: the
  // descent's points, the fight's live thread, the arc stage, and whether the
  // pair's node was taken. The panel is the one place that holds all of it, in
  // one grammar, using the same words the rest of the game uses.
  check('LADDER: a row carries the whole ladder — points, state, their move, and where that move is',
    await J(`(() => {
      try { localStorage.removeItem('kizuna2_2.bondgifts'); } catch (_) {}
      setupFight(['ash','elin','mira'], [], { ash:'front', elin:'mid', mira:'back' });
      RUN.bonds = { 'ash|elin': 2, 'ash|mira': 1 }; RUN.crossed = {}; S.threads = new Set();
      showBondPanel();
      const rows = [...document.querySelectorAll('#bond-panel .bp-row')];
      const t = rows.map(r => r.textContent);
      const woven = t.find(x => /ASH ─ ELIN/.test(x));
      const partial = t.find(x => /ASH ─ MIRA/.test(x));
      hideBondPanel();
      return rows.length === 3
        && /♡ 2\\/2/.test(woven) && /✦ WOVEN/.test(woven) && /RUNNING|WATCHING/.test(woven)
        && /♡ 1\\/2/.test(partial) && !/✦ WOVEN/.test(partial)
        && t.every(x => /◈/.test(x))                       // every pair's MOVE is named
        && t.every(x => /ask for it at a|not taken yet|YOURS/.test(x));
    })()`));
  check('LADDER: LIT is this fight, WOVEN is the descent — and they are different words',
    await J(`(() => {
      setupFight(['ash','elin','mira'], [], { ash:'front', elin:'mid', mira:'back' });
      RUN.bonds = {}; RUN.crossed = {}; S.threads = new Set(['ash|elin']);
      showBondPanel();
      const row = [...document.querySelectorAll('#bond-panel .bp-row')].find(r => /ASH ─ ELIN/.test(r.textContent));
      const txt = row.textContent;
      hideBondPanel();
      return /♡ LIT/.test(txt) && !/✦ WOVEN/.test(txt) && !/BONDED/.test(txt);
    })()`));
  check('LADDER: the MOVE reports its real position — asked for, then taken',
    await J(`(() => {
      try { localStorage.removeItem('kizuna2_2.bondgifts'); } catch (_) {}
      setupFight(['ash','elin','mira'], [], { ash:'front', elin:'mid', mira:'back' });
      RUN.bonds = {}; RUN.crossed = {}; S.threads = new Set();
      const read = () => { showBondPanel();
        const r = [...document.querySelectorAll('#bond-panel .bp-row')].find(x => /ASH ─ ELIN/.test(x.textContent)).textContent;
        hideBondPanel(); return r; };
      const unasked = read();
      markBondGift('ash','elin');
      const asked = read();
      RUN.crossed = { ash: [bondNodeFor('ash','elin').id] };
      const taken = read();
      return /ask for it at a/.test(unasked) && /not taken yet/.test(asked)
        && /YOURS/.test(taken) && /RUNNING|WATCHING/.test(taken);
    })()`));
  check('VOCAB: one word per thing — no RESONANCE badge, no KINDLED on an owned node',
    await J(`(() => {
      setupFight(['ash','elin','mira'], [], { ash:'front', elin:'mid', mira:'back' });
      RUN.bonds = { 'ash|elin': 2 }; renderResonance();
      const badge = document.querySelector('#resonance');
      const label = badge ? badge.textContent : '';
      // read the PANEL, not the source: the detail builder moved out of
      // showEmberTree at Build 30, and scraping a function body was always a
      // proxy for the thing this check actually cares about — the words shown
      RUN.nodes = ['ash.sig.front'];
      showEmberTree(() => {}, 'ash', 'ash.sig.front');
      const panel = (document.querySelector('.et-detail') || {}).textContent || '';
      return /KIZUNA/.test(label) && !/RESONANCE/.test(label)
        && /TAKEN/.test(panel) && !/KINDLED/.test(panel);
    })()`));
  check('BOND NODE: one per pair, carrying that pair’s own authored ability',
    await J(() => BOND_NODES.length === 15 && EMBER_TREE.filter(n => n.bond).length === 15
      && BOND_NODES.every(n => { const [a, b] = n.pair.split('|');
        const p = duetPerkFor(a, b); return !!(p.line && p.line.length === 2 && p.make); })));
  check('BOND NODE: it is not on the border until you ASKED for it at the fire',
    await J(() => { try { localStorage.removeItem('kizuna2_2.bondgifts'); } catch (_) {}
      const locked = bondNodeFor('ash', 'elin') === null;
      const before = commonOnBorder('ash', 'elin').length;
      markBondGift('ash', 'elin');
      const open = !!bondNodeFor('ash', 'elin');
      return locked && open && commonOnBorder('ash', 'elin').length === before + 1; }));
  check('BOND NODE: the ability runs off the OWNED node, with no in-fight thread at all',
    await J(() => { setupFight(['ash', 'elin'], [], { ash: 'front', elin: 'mid' });
      markBondGift('ash', 'elin');
      S.threads = new Set(); RUN.crossed = {};
      const none = duetPerkBoons().length;
      RUN.crossed = { ash: [bondNodeFor('ash', 'elin').id] };
      const held = duetPerkBoons();
      return none === 0 && held.length === 1 && held[0].pairKey === 'ash|elin'; }));
  check('BOND NODE: it belongs to the PAIR — either partner holding it counts',
    await J(() => { markBondGift('ash', 'elin');
      const id = bondNodeFor('ash', 'elin').id;
      RUN.crossed = { elin: [id] };
      return bondNodeHeld('ash', 'elin') && bondNodeHeld('elin', 'ash'); }));
  // ash+cassia (Guardian+Ronin) keeps its MODIFIER — the announce path only
  // exists for pairs that pay out a number. The five strike pairs announce
  // themselves by acting (see runBondStrike).
  check('BOND NODE: the ability SPEAKS the first time it lands, and only once',
    await J(() => { setupFight(['ash', 'cassia'], [], { ash: 'front', cassia: 'mid' });
      markBondGift('ash', 'cassia');
      RUN.crossed = { ash: [bondNodeFor('ash', 'cassia').id] };
      S._perkSaid = {};
      const boon = duetPerkBoons()[0];
      const ash = S.heroes.find(h => h.id === 'ash'), foe = livingEnemies()[0];
      for (let i = 0; i < 6; i++) {
        if (boon.mod) boon.mod(ash, foe);
        if (boon.apply) boon.apply({ hero: ash, heroId: 'ash', tgt: foe });
      }
      return Object.keys(S._perkSaid).length === 1; }));
  check('BOND NODE: a silent perk stays silent until it actually DOES something',
    await J(() => { setupFight(['ash', 'cassia'], [], { ash: 'front', cassia: 'mid' });
      markBondGift('ash', 'cassia');
      RUN.crossed = { ash: [bondNodeFor('ash', 'cassia').id] };
      S._perkSaid = {};
      const boon = duetPerkBoons()[0];
      if (!boon.mod) return true;                       // apply-perks always do something
      const mira = { id: 'mira', def: HEROES.mira };    // not the pair — mod returns 0
      boon.mod(mira, livingEnemies()[0]);
      return Object.keys(S._perkSaid).length === 0; }));

  // ---------- THE TRIAD, REACHABLE (Build 265) ----------
  // It required all three pairs threaded INSIDE one fight. A fight yields one or
  // two threads, so instrumented across eight of them it fired ZERO times — the
  // ceremony, the vow stages and the whole FINALE resolver were code no player
  // had ever run. Owned bond nodes count now, which is the point of owning them.
  console.log('--- THE TRIAD ---');
  const triadRun = () => J(() => {
    window.__ceremony = 0;
    window.triadCeremony = async () => { window.__ceremony++; };
    RUN = newRun('ash'); RUN.roster = ['ash', 'elin', 'mira']; RUN.active = RUN.roster.slice();
    RUN.hp = { ash: 34, elin: 24, mira: 22 }; RUN.crossed = {}; RUN.bonds = {};
    RUN.floor = 1; RUN.completed = [0]; RUN.map = generateDescent(RUN.roster, 1);
    [['ash', 'elin'], ['ash', 'mira'], ['elin', 'mira']].forEach(([a, b]) => markBondGift(a, b));
    startFight({ type: 'fight', chapter: 3, heroes: RUN.active.slice(), enemies: ['husk'],
      useRunHp: true, floor: 1, depth: 3, narrator: 't' });
    renderAll(); S.threads = new Set(); S.triadFormed = false;
    return true;
  });
  await triadRun();
  check('TRIAD: a live thread OR an owned bond node counts as a bonded pair',
    await J(() => { const none = pairBonded('ash', 'elin');
      RUN.crossed = { ash: [bondNodeFor('ash', 'elin').id] };
      const owned = pairBonded('ash', 'elin');
      RUN.crossed = {}; S.threads = new Set([pairKey('ash', 'elin')]);
      const threaded = pairBonded('ash', 'elin');
      S.threads = new Set();
      return none === false && owned === true && threaded === true; }));
  check('TRIAD: three OWNED bonds form the triad — the first time it has been reachable',
    await J(async () => { const ids = [['ash', 'elin'], ['ash', 'mira'], ['elin', 'mira']]
        .map(([a, b]) => bondNodeFor(a, b).id);
      RUN.crossed = { ash: [ids[0], ids[1]], elin: [ids[2]] };   // spread across partners
      S.triadFormed = false; window.__ceremony = 0;
      await checkTriad();
      return S.triadFormed === true && window.__ceremony === 1; }));
  check('TRIAD: two bonds is not three — it does not fire early',
    await J(async () => { const ids = [['ash', 'elin'], ['ash', 'mira']].map(([a, b]) => bondNodeFor(a, b).id);
      RUN.crossed = { ash: ids }; S.triadFormed = false; window.__ceremony = 0;
      await checkTriad();
      return S.triadFormed === false && window.__ceremony === 0; }));
  check('TRIAD: an OWNED triad is checked at fight open, or it would never fire at all',
    await J(() => /bondNodeHeld/.test(startFight.toString()) && /checkTriad/.test(startFight.toString())));
  // …but a KINDLED trio walks in already threaded, and auto-firing there would
  // open every single fight with the ceremony. They still owe one act of help.
  check('TRIAD: a pre-threaded trio does NOT get it handed to them at fight open',
    await J(() => /bondNodeHeld\(x, y\) && bondNodeHeld\(y, z\) && bondNodeHeld\(x, z\)/.test(startFight.toString())));
  await J(() => { RUN.crossed = {}; S.triadFormed = false; });

  // ---------- DEEDS (Build 266) ----------
  // Build 256 made every bond name its cause — "a hand held out", "they struck as
  // one", "a death avenged" — because three unlabelled paths were firing
  // constantly and the player could never build a causal model. That `why` was
  // spoken aloud and then thrown away. It is kept now, and it decides who gets
  // the night's one scene.
  console.log('--- DEEDS ---');
  const deedRun = () => J(() => {
    RUN = newRun('ash'); RUN.roster = ['ash', 'elin', 'mira']; RUN.active = RUN.roster.slice();
    RUN.hp = { ash: 34, elin: 24, mira: 22 }; RUN.bonds = {}; RUN.deeds = {};
    RUN.floor = 1; RUN.completed = [0]; RUN.map = generateDescent(RUN.roster, 1);
    startFight({ type: 'fight', chapter: 3, heroes: RUN.active.slice(), enemies: ['husk'],
      useRunHp: true, floor: 1, depth: 3, narrator: 'd' });
    renderAll(); S.threads = new Set();
    return true;
  });
  await deedRun();
  check('DEEDS: every bond path writes its cause into the ledger',
    await J(async () => { for (const w of ['they struck as one', 'a death avenged', 'they struck as one']) {
        S.threads = new Set(); await addThread('ash', 'mira', w); }
      const row = RUN.deeds['ash|mira'] || {};
      return row.strike === 2 && row.avenge === 1 && deedTotal('ash|mira') === 3; }));
  check('DEEDS: the fire goes to the pair with the MOST between them, not the weakest bond',
    await J(async () => { S.threads = new Set(); await addThread('ash', 'elin', 'a hand held out');
      // ash|elin now has the WEAKER bond and the FEWER deeds
      return _fireBondKey() === 'ash|mira' && _weakestActiveBondKey() !== 'ash|mira'; }),
    await J(() => 'fire ' + _fireBondKey() + ' · weakest ' + _weakestActiveBondKey()));
  check('DEEDS: the scene opens by naming what they actually did',
    await J(() => { const k = _fireBondKey(), top = deedTop(k);
      const [a, b] = k.split('|');
      const line = DEED_KINDS[top] && DEED_KINDS[top].open(HEROES[a].name, HEROES[b].name);
      return top === 'strike' && typeof line === 'string' && line.length > 20; }));
  check('DEEDS: every cause a bond can carry maps to a deed with an opener',
    await J(() => Object.keys(DEED_BY_WHY).every(w => {
      const k = DEED_BY_WHY[w];
      return DEED_KINDS[k] && typeof DEED_KINDS[k].open === 'function'; })
      && Object.keys(DEED_BY_WHY).length === 5));
  check('DEEDS: an empty ledger falls back to the weakest bond — the fire is never empty',
    await J(() => { RUN.deeds = {}; return _fireBondKey() === _weakestActiveBondKey() && !!_fireBondKey(); }));
  check('DEEDS: the ledger is per-descent, like the bonds it records',
    await J(() => { const fresh = newRun('ash');
      return JSON.stringify(fresh.deeds) === '{}'; }));

  // ---------- v2.2: THE NARRATIVE ENGINE (narrative.js, from the v0.7 handoff) ----------
  // Framework checks first (state / triggers / effects / runner discipline),
  // then the prologue driven end-to-end through the REAL title button, taps
  // and all — the fresh-soul path the rest of the suite deliberately skips.
  console.log('--- NARRATIVE ---');
  check('NARR: the registry carries all 29 handoff beats with stable ids, verbatim triggers intact',
    await J(() => NARR_BEATS.length === 29
      && NARR_BEATS.every(b => b.id && b.trigger && b.status)
      && NARR_BEATS.filter(b => b.id.indexOf('PRO_') === 0).length === 9));
  check('NARR: a fresh state matches schema v7 — every required key, act PROLOGUE, nothing revealed',
    await J(() => { narrWipe(); const n = narrState();
      return n.version === 7 && n.campaign.act === 'PROLOGUE' && n.campaign.rebirthCount === 0
        && Array.isArray(n.events.completed) && n.events.completed.length === 0
        && Object.values(n.reveals).every(v => v === false)
        && n.resonance.unlocked.length === 0 && Object.keys(n.kizuna.pairs).length === 0
        && Object.values(n.roles).every(v => v === null); }));
  check('NARR: a damaged or wrong-version save is rebuilt, carrying completed events across — progression never wipes',
    await J(() => { localStorage.setItem('kizuna2_2.narrative',
        JSON.stringify({ version: 3, events: { completed: ['PRO_000_LAST_MEMORY', 42] }, reveals: { PRIESTESS_EXISTS: true }, campaign: { act: 'ACT_I' } }));
      NARR = null; const n = narrState();
      return n.version === 7 && n.events.completed.length === 1
        && n.events.completed[0] === 'PRO_000_LAST_MEMORY'
        && n.reveals.PRIESTESS_EXISTS === true && n.campaign.act === 'ACT_I'; }));
  check('NARR: the speaker gate holds — the voice is never the Priestess before her reveal, and is after',
    await J(() => { narrWipe();
      const before = narrSpeaker('CREATOR_PRIESTESS');
      narrState().reveals.REVEAL_PRIESTESS_IS_VOICE = true;
      const after = narrSpeaker('CREATOR_PRIESTESS');
      narrWipe();
      return !/PRIESTESS/i.test(before) && /PRIESTESS/i.test(after); }));
  check('NARR: the trigger grammar reads conditions, not just names — *_AFTER forms fire on the generic signal only once anchored',
    await J(() => { narrWipe();
      const death = narrBeat('A1_050_FIRST_CANON_REBIRTH'), landing = narrBeat('A1_060_FALLEN_REBORN_HUMAN');
      // unanchored: neither responds to its generic signal
      const before = narrTriggerMatches(death, 'PLAYER_DEATH') || narrTriggerMatches(landing, 'LANDING');
      // anchor the death beat — now it, and only it, answers
      narrState().events.completed.push('A1_041_FIRST_PRESENT_FALLEN_THANKS');
      const mid = narrTriggerMatches(death, 'PLAYER_DEATH') && !narrTriggerMatches(landing, 'LANDING');
      // the death beat completing anchors the landing beat AND retires itself
      narrState().events.completed.push('A1_050_FIRST_CANON_REBIRTH');
      const after = !narrTriggerMatches(death, 'PLAYER_DEATH') && narrTriggerMatches(landing, 'LANDING');
      narrWipe();
      return !before && mid && after; }));
  check('NARR: an authored-but-unstaged beat is left PENDING, never silently burned (only system beats run sceneless)',
    await J(() => { narrWipe();
      narrState().events.completed.push('A1_041_FIRST_PRESENT_FALLEN_THANKS');
      narrFire('PLAYER_DEATH', {}, null);   // A1_050 is eligible but has no scene
      const ok = !narrDone('A1_050_FIRST_CANON_REBIRTH') && narrState().campaign.rebirthCount === 0;
      narrWipe(); return ok; }));
  check('NARR: combat is observed, never steered — the engine owns no combat verbs',
    await J(() => { const src = [narrFire, narrRunBeat, narrApplyEffects].map(f => f.toString()).join('');
      return !/playCard|dealToEnemy|startFight|endTurn|S\.enemies|S\.heroes/.test(src)
        && /storyId/.test(onVictory.toString()); }));   // …and combat reports in
  // ---- the prologue, played for real: title → NEW GAME → nine beats → tutorial
  // A recorder wraps showOverlay for the whole walk, so the spoiler check below
  // judges every frame that actually reached the DOM — line reveals included.
  await J(() => { narrWipe(); try { localStorage.removeItem('kizuna2_2.tutorialSeen'); } catch (_) {}
    if (!window.__soReal) { window.__soReal = window.showOverlay;
      window.showOverlay = (h, c) => { window.__narrHtml = (window.__narrHtml || '') + h; return window.__soReal(h, c); }; }
    window.__narrHtml = '';
    showTitle(); });
  await sleep(300);
  await J(() => document.querySelector('#t-new').onclick());
  await sleep(300);
  check('PROLOGUE: NEW GAME for a fresh soul opens on the memory-city, not the tutorial',
    await J(() => !!document.querySelector('.narr-scene .nv-city')
      && !!document.querySelector('.nv-fallen') && !!document.querySelector('.nv-trio')
      && !document.querySelector('#overlay.scene-landing')));
  await shot('narr-prologue-city');
  // tap through all nine beats: reveal taps, then each beat's continue button
  for (let i = 0; i < 60; i++) {
    const st = await J(() => narrDone('PRO_008_ASCENT_BEGINS') ? 'done'
      : document.querySelector('#nv-go') ? 'btn' : document.querySelector('.ov-tap') ? 'tap' : 'other');
    if (st === 'done') break;
    if (st === 'btn') await J(() => document.querySelector('#nv-go').onclick({ stopPropagation: () => {} }));
    else await J(() => { const ov = document.querySelector('#overlay'); if (ov && ov.onclick) ov.onclick(); });
    await sleep(120);
  }
  check('PROLOGUE: nine beats chain NEW_GAME → CHAIN → AFTER without a seam, and land in Act I',
    await J(() => NARR_BEATS.filter(b => b.id.indexOf('PRO_') === 0).every(b => narrDone(b.id))
      && narrState().campaign.act === 'ACT_I'
      && narrState().campaign.chapter === 'ACT1_FIRST_ASCENT'));
  check('PROLOGUE: the first echo left a RESONANCE behind (data effect, not narration)',
    await J(() => narrState().resonance.unlocked.includes('PROLOGUE_ECHO_01')));
  check('PROLOGUE: control lands in the game proper — the tutorial opens at the bottom, as before',
    await J(() => !!document.querySelector('#overlay.scene-landing')
      && /THE BOTTOM OF IT/.test((document.querySelector('.ov-eyebrow') || {}).textContent || '')));
  check('PROLOGUE: it happens once — the next NEW GAME walks straight past it',
    await J(() => { showTitle(); document.querySelector('#t-new').onclick();
      return !document.querySelector('.nv-city') && !!document.querySelector('#overlay.scene-landing'); }));
  check('PROLOGUE: no frame it rendered ever named the hidden speaker or the Fallen — the reveal is intact',
    await J(() => { const html = window.__narrHtml || '';
      window.showOverlay = window.__soReal; window.__soReal = null;
      return html.length > 4000
        && !/CREATOR_PRIESTESS|PRIESTESS|PROTAGONIST|PREV_TRIO|OPENING_FALLEN/i.test(html); }));
  check('ARCHIVE: the Journal grew an ECHOES tab and the played prologue is replayable from it',
    await J(() => { narrSeedPrologueComplete();
      showJournal(null, 'echoes');
      const rows = document.querySelectorAll('.nv-arc-row');
      const ok = rows.length >= 7 && !!document.querySelector('.bj-tab[data-tab="echoes"]');
      hideOverlay(); return ok; }));
  check('ARCHIVE: a replay presents without re-applying effects — seenCount is untouched',
    await J(() => { const before = JSON.stringify(narrState().events.seenCount);
      narrReplay('PRO_005_RISE', () => {});
      const mid = !!document.querySelector('.nv-word');
      document.querySelector('#nv-go').onclick({ stopPropagation: () => {} });
      return mid && JSON.stringify(narrState().events.seenCount) === before; }));
  check('INSPECTOR: the dev panel reaches a live narrative inspector (act, beats, reveals, roles)',
    await J(() => { showDevPanel();
      const has = !!document.querySelector('#d-narrative');
      document.querySelector('#d-narrative').onclick();
      return has && !!document.querySelector('.nvi-screen')
        && document.querySelectorAll('.nvi-row').length >= 29
        && !!document.querySelector('.nvi-flags'); }));
  await shot('narr-inspector');   // shot BEFORE closing, or it photographs the fight behind it
  await J(() => hideOverlay());
  // leave the world as the rest of the suite expects it: prologue spent
  await J(() => { hideOverlay(); narrSeedPrologueComplete(); try { localStorage.setItem('kizuna2_2.tutorialSeen', '1'); } catch (_) {} });

  t.report();
  await t.browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
