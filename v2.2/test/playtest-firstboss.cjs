// PLAYTEST-FIRSTBOSS — the honest new-player road, start to first boss.
//
// Boots with NOTHING: no tutorial seen, no narrative state, no unlocks beyond
// the default. Then drives the real screens the way a thumb does — title,
// prologue, tutorial chapters, the descent map, sparks, the tree, camps,
// recruits — until the floor-1 boss is dead and the floor gives way.
//
// Three jobs at once:
//   1. FLOW — does every screen lead somewhere, does anything dead-end?
//   2. FIT — is anything cut off at phone size? (bounding-box checks on the
//      controls each screen needs, not just eyeballs)
//   3. STORY — the text of every narrative screen is logged in order, so the
//      transcript can be read against the story bible afterwards.
//
//   node test/playtest-firstboss.cjs
//
// Shots land in test/shots/road-*.png
'use strict';
const { boot } = require('./harness.cjs');

(async () => {
  const t = await boot({ freshNarrative: true, flow: 0 });
  const errs = []; t.page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await t.page.emulateMedia({ reducedMotion: 'reduce' });
  await t.autoParry(true); await t.fastCombat(0.12); await t.parrySkill(0.75, 777);

  const story = [];    // every narrative screen, in the order the player meets it
  const fit = [];      // screens whose controls fell off the viewport
  const flow = [];     // screen-by-screen route
  const note = (s) => { flow.push(s); console.log(s); };

  await t.J(() => {
    // ceremonies fired MID-FIGHT await a tap while the rig is awaiting the
    // card that caused them — auto-tap those, and only those; story screens
    // outside combat are paced by the rig so they can be read and shot.
    setInterval(() => {
      const ov = document.querySelector('#overlay');
      if (typeof S !== 'undefined' && S && !S.over && ov && !ov.classList.contains('hidden') && ov.querySelector('.ov-tap')) ov.click();
    }, 60);
    try { localStorage.removeItem('kizuna2_2.tutorialSeen'); localStorage.removeItem('kizuna2_2.flow'); } catch (_) {}
    resetProgress();
    showTitle();
  });
  await t.sleep(400);

  // What screen is the game showing right now? One classifier, one truth.
  const readScreen = () => t.J(() => {
    const ov = document.querySelector('#overlay');
    const ovUp = ov && !ov.classList.contains('hidden');
    const q = (sel) => ov && ov.querySelector(sel);
    const txt = (sel) => { const el = q(sel); return el ? el.textContent.trim().replace(/\s+/g, ' ') : ''; };
    const vis = (sel) => { const el = q(sel); if (!el) return null;
      const r = el.getBoundingClientRect(); const H = window.innerHeight, W = window.innerWidth;
      return { on: r.bottom <= H + 1 && r.top >= -1 && r.right <= W + 1 && r.left >= -1, r: [r.left | 0, r.top | 0, r.right | 0, r.bottom | 0] }; };
    const inFight = typeof S !== 'undefined' && S && !S.over;
    const kind =
      !ovUp && inFight ? 'fight'
      : !ovUp ? 'none'
      : q('#t-new') ? 'title'
      : q('.nv-scene') ? 'prologue'
      : q('.ld-scene') ? 'landing'
      : q('.map-strip') ? 'map'
      : q('.spark-card') ? 'spark'
      : q('#et-canvas') ? 'tree'
      : q('.ss-fig') ? 'starter'
      : q('.rl-card') ? 'relic'
      : q('.camp-choice') ? 'camp'
      : q('.jc-scene') ? 'recruit'
      : q('#ps-go') ? 'march'
      : q('#rc-next') ? 'onward'
      : q('.ov-forkopt') ? 'fork'
      : q('.boon-card') ? 'boon'
      : q('.ev-choice') ? 'event'
      : q('#ov-go') ? 'story'
      : q('#ov-next') ? 'victory'
      : q('#ov-deeper') ? 'floor'
      : q('#ov-fallen') ? 'gameover'
      : q('.ov-tap') ? 'tap'
      : q('.ov-btn') ? 'button'
      : 'other';
    return {
      kind, inFight,
      eyebrow: txt('.ov-eyebrow'), title: txt('.ov-title'), line: txt('.ov-line'),
      // fit probes for the screens that historically clip
      mapFooter: kind === 'map' ? vis('#map-tree') : null,
      mapCoach: kind === 'map' ? vis('.map-coach') : null,
      sparkSkip: kind === 'spark' ? vis('#spark-skip') : null,
      treeBack: kind === 'tree' ? vis('#et-back') : null,
      lastLabel: kind === 'map' ? (Array.from(ov.querySelectorAll('.map-node .mn-label')).map(l => { const r = l.getBoundingClientRect(); return { t: l.textContent.trim(), off: r.right > window.innerWidth + 1 }; }).filter(x => x.off).map(x => x.t).join('|')) : '',
    };
  });

  const shotOnce = (() => { const seen = new Set(); return async (tag) => {
    if (seen.has(tag)) return; seen.add(tag); await t.shot('road-' + tag); }; })();

  // Drive one fight turn: play affordable cards, then END TURN. Also probes the
  // held-pose beat the first time: a card leaves the hand → its owner should
  // HOLD the advance until END TURN releases it.
  let poseChecked = false, poseHeld = null, poseReleased = null;
  const fightTurn = async () => {
    const played = await t.J(async () => {
      let n = 0, g = 0;
      while (g++ < 10) {
        if (S.executing || S.over) break;
        const card = buildHand().find(c => !c.spent && c.cost <= S.ep && c.kind !== 'move');
        if (!card) break;
        let tid = null;
        if (card.target === 'enemy' || card.target === 'frontmost') tid = ((typeof frontmostEnemy === 'function' && frontmostEnemy()) || livingEnemies()[0] || {}).uid;
        else if (card.target === 'ally' || card.target === 'allies') tid = ((typeof lowestHpAlly === 'function' && lowestHpAlly()) || livingHeroes()[0] || {}).id;
        else if (card.target === 'self') tid = card.owner;
        try { await playCard(card, tid); n++; } catch (_) { break; }
      }
      return n;
    });
    if (played && !poseChecked) {
      poseHeld = await t.J(() => !!document.querySelector('#party-half .figure.fig-held'));
      await shotOnce('fight-pose-held');
    }
    const over = await t.J(() => !S || S.over);
    if (!over) {
      await t.J(() => { if (!S.executing && !S.over) endTurn(); });
      if (played && !poseChecked) {
        await t.sleep(120);
        poseReleased = await t.J(() => !document.querySelector('#party-half .figure.fig-held'));
        poseChecked = true;
      }
      for (let i = 0; i < 240; i++) { if (await t.J(() => !S || S.over || !S.executing)) break; await t.sleep(60); }
    }
  };

  let bossDown = false, guard = 0, lastKind = '', sameKind = 0, wipes = 0;
  while (!bossDown && guard++ < 900) {
    const s = await readScreen();
    // record narrative text the first time each titled screen appears
    if (s.title && (s.kind === 'story' || s.kind === 'prologue' || s.kind === 'tap' || s.kind === 'victory' || s.kind === 'floor' || s.kind === 'landing'))
      if (!story.length || story[story.length - 1].t !== s.title || story[story.length - 1].l !== s.line)
        story.push({ k: s.kind, e: s.eyebrow, t: s.title, l: s.line });
    // fit probes
    if (s.mapFooter && !s.mapFooter.on) fit.push('map: EMBER TREE button off-screen ' + JSON.stringify(s.mapFooter.r));
    if (s.mapCoach && !s.mapCoach.on) fit.push('map: coach line off-screen ' + JSON.stringify(s.mapCoach.r));
    if (s.sparkSkip && !s.sparkSkip.on) fit.push('spark: skip button off-screen ' + JSON.stringify(s.sparkSkip.r));
    if (s.treeBack && !s.treeBack.on) fit.push('tree: BACK off-screen ' + JSON.stringify(s.treeBack.r));
    if (s.lastLabel) fit.push('map: label past right edge → ' + s.lastLabel);
    if (s.kind === lastKind) { if (++sameKind > 140) { note('  ⚠ STUCK on ' + s.kind + ' — bailing'); break; } }
    else { sameKind = 0; lastKind = s.kind; }

    switch (s.kind) {
      case 'title': await shotOnce('01-title'); note('▶ TITLE'); await t.J(() => document.querySelector('#t-new').onclick()); break;
      case 'prologue': await shotOnce('02-prologue'); await t.J(() => {
        const go = document.querySelector('#nv-go');
        if (go) go.onclick({ stopPropagation: () => {} });
        else { const ov = document.querySelector('#overlay'); if (ov.onclick) ov.onclick(); }
      }); break;
      case 'tap': case 'story': {
        if (s.eyebrow || s.title) note('  ✦ ' + (s.eyebrow ? s.eyebrow + ' · ' : '') + s.title);
        await t.J(() => {
          const go = document.querySelector('#ov-go');
          if (go) go.onclick({ stopPropagation: () => {} });
          else { const ov = document.querySelector('#overlay'); if (ov.onclick) ov.onclick(); else { const b = ov.querySelector('.ov-btn'); if (b) b.click(); } }
        }); break;
      }
      case 'fight': {
        const foes = await t.J(() => S.enemies.filter(e => !e.dead).map(e => e.def.name).join('+'));
        // "the first boss" means the DESCENT's floor boss — the tutorial's Echo
        // Knight is a chapter beat, not the target
        const isBoss = await t.J(() => !!(S.node && S.node.mapId != null && (S.node.isBoss || (S.node.enemies || []).some(id => ENEMY_DEFS[id] && ENEMY_DEFS[id].boss))));
        if (sameKind === 0) note('▶ FIGHT: ' + foes + (isBoss ? '  ◆ FLOOR BOSS' : ''));
        if (isBoss) await shotOnce('boss-fight');
        await fightTurn();
        if (isBoss && await t.J(() => S && S.over && !livingEnemies().length)) bossDown = true;
        break;
      }
      case 'victory': note('  ✓ victory'); await shotOnce('victory');
        if (await t.J(() => { const b = document.querySelector('#ov-next'); if (b) { b.onclick(); return true; } return false; })) break; break;
      case 'landing': await shotOnce('landing'); note('▶ THE LANDING'); await t.J(() => { const b = document.querySelector('#ld-go'); if (b) b.click(); }); break;
      case 'starter': await t.J(() => { const f = document.querySelector('.ss-fig[data-id="ash"]:not(.ss-locked)') || document.querySelector('.ss-fig:not(.ss-locked)'); if (f) f.click(); }); break;
      case 'relic': await t.J(() => { const n = document.querySelector('.rl-card.rl-none') || document.querySelector('.rl-card'); if (n) n.click(); }); break;
      case 'map': {
        await shotOnce('map');
        const picked = await t.J(() => {
          const nodes = mapAll().filter(nodeReachable);
          if (!nodes.length) return null;
          const n = nodes.find(x => x.type === 'boss') || nodes.find(x => x.type === 'camp') || nodes[0];
          const el = document.querySelector(`.map-node[data-node="${n.id}"]`);
          if (el && el.onclick) { el.onclick(); return n.type + ':' + (n.label || n.id); }
          return null;
        });
        note('▶ MAP → ' + (picked || 'NO REACHABLE NODE'));
        if (!picked) { note('  ⚠ DEAD END on map'); guard = 9999; }
        break;
      }
      case 'spark': {
        await shotOnce('spark');
        note('  ✦ spark draft');
        await t.J(() => {
          const buy = document.querySelector('.spark-card:not(.spark-poor):not([disabled])');
          if (buy && (window.__sparks | 0) < 2) { window.__sparks = (window.__sparks | 0) + 1; buy.onclick ? buy.onclick() : buy.click(); }
          else document.querySelector('#spark-skip').onclick();
        });
        break;
      }
      case 'tree': { await shotOnce('tree'); note('  ✦ ember tree (from spark)'); await t.sleep(700); await shotOnce('tree-settled');
        await t.J(() => { const b = document.querySelector('#et-back'); if (b) b.onclick ? b.onclick() : b.click(); }); break; }
      case 'camp': { note('▶ CAMP'); await shotOnce('camp'); await t.J(() => {
        const rest = document.querySelector('#camp-rest') || document.querySelector('.camp-choice');
        if (rest) rest.click(); }); break; }
      case 'recruit': { if (sameKind === 0) { note('▶ RECRUIT (journey scene)'); await shotOnce('recruit'); }
        await t.J(() => {
          const opt = document.querySelector('.jc-opt');
          if (opt) { opt.onclick ? opt.onclick({ stopPropagation: () => {} }) : opt.click(); return; }
          const sc = document.querySelector('.jc-scene');
          if (sc && sc.onclick) sc.onclick();
          else { const b = document.querySelector('#overlay .ov-btn'); if (b) b.click(); }
        }); break; }
      case 'march': { note('▶ MARCHING ORDER'); await shotOnce('marching-order'); await t.J(() => document.querySelector('#ps-go').onclick()); break; }
      case 'onward': await t.J(() => { const b = document.querySelector('#rc-next'); b.onclick ? b.onclick() : b.click(); }); break;
      case 'fork': await t.J(() => { const o = document.querySelector('.ov-forkopt'); if (o) o.onclick ? o.onclick({ stopPropagation: () => {} }) : o.click(); }); break;
      case 'event': { note('▶ EVENT'); await t.J(() => { const c = document.querySelector('.ev-choice'); if (c) c.click(); }); break; }
      case 'boon': { note('  ✦ boon draft'); await shotOnce('boon'); await t.J(() => { const b = document.querySelector('.boon-card'); if (b) b.click(); }); break; }
      case 'floor': { note('▶ FLOOR CLEARED'); await shotOnce('floor-cleared'); bossDown = true; break; }
      case 'gameover': { wipes++; note('✖ PARTY WIPED — run ' + wipes + ' ends. Waking at the bottom, as the game intends.');
        await shotOnce('gameover');
        if (wipes >= 3) { note('  three wipes — stopping so the report can say so'); guard = 9999; break; }
        await t.J(() => { window.__sparks = 0; const b = document.querySelector('#ov-fallen'); if (b) b.onclick(); });
        break; }
      case 'button': await t.J(() => { const b = document.querySelector('#overlay .ov-btn'); if (b) b.click(); }); break;
      default: {
        if (sameKind === 20) {   // stuck a while — describe the mystery screen once
          const sig = await t.J(() => {
            const ov = document.querySelector('#overlay');
            return ov.className + ' :: ' + Array.from(ov.querySelectorAll('button')).map(b => (b.id || b.className) + '"' + b.textContent.trim().slice(0, 20) + '"').slice(0, 6).join(' | ')
              + ' :: onclick=' + !!ov.onclick;
          });
          note('  ? unknown screen → ' + sig);
          await shotOnce('unknown');
        }
        await t.J(() => { const ov = document.querySelector('#overlay'); if (ov && ov.onclick) ov.onclick(); });
        await t.sleep(150);
      }
    }
    await t.sleep(220);
  }

  // ---- the skill census: every hero's rotation, row by row, plus tree inserts
  const skills = await t.J(() => {
    const out = {};
    Object.keys(ROTATIONS).forEach(hid => {
      const h = { name: HEROES[hid] ? HEROES[hid].name : hid, rows: {}, tree: [] };
      Object.keys(ROTATIONS[hid]).forEach(row => {
        const rot = ROTATIONS[hid][row];
        const seen = new Set(); const chain = [];
        let key = rot.opener, guard = 0;
        while (key && rot.cards[key] && !seen.has(key) && guard++ < 10) {
          seen.add(key);
          const c = rot.cards[key]; chain.push(c.name + (c.chainNext ? '' : ' ◆'));
          key = typeof c.chainNext === 'string' ? c.chainNext
            : (c.chainNext && c.chainNext.key) ? c.chainNext.key : null;
        }
        Object.keys(rot.cards).forEach(k => { if (!seen.has(k)) chain.push('(' + rot.cards[k].name + ')'); });
        h.rows[row] = chain;
      });
      EMBER_TREE.filter(n => n.hero === hid).forEach(n => h.tree.push(`[t${n.tier} ${n.type}] ${n.label}`));
      out[hid] = h;
    });
    return out;
  });

  console.log('\n═══ THE ROAD, AS WALKED ═══');
  console.log('\n— story screens, in order —');
  story.forEach(s => console.log(`  [${s.k}] ${s.e ? s.e + ' · ' : ''}${s.t}${s.l ? '\n        "' + s.l.slice(0, 110) + '"' : ''}`));
  console.log('\n— fit problems —');
  console.log(fit.length ? fit.map(f => '  ✗ ' + f).join('\n') : '  none — every probed control stayed on-screen');
  console.log('\n— combat beat —');
  console.log(`  pose held after card: ${poseHeld} · released after END TURN: ${poseReleased}`);
  console.log('\n— outcome —');
  console.log(bossDown ? '  ◆ FIRST BOSS DOWN — floor 1 cleared' : '  ✗ never reached/killed the boss — read the route above');
  console.log('\npage errors: ' + (errs.length ? errs.join(' | ') : 'none'));

  require('fs').writeFileSync(__dirname + '/skills-census.json', JSON.stringify(skills, null, 2));
  console.log('skill census → test/skills-census.json');
  await t.browser.close(); process.exit(0);
})();
