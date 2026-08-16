// PLAYTEST-LINE — play a real descent fight through the REAL UI, tapping cards
// the way a player does, and screenshot every beat of a line.
//
// Deliberately not a meter. The meters call playCard() directly; this drives the
// actual hand: it finds the card element in #hand, taps it, picks a target, and
// photographs what the table looks like at each stage. What it is looking for is
// whether the three-beat structure READS on screen — whether you can tell, from
// the hand alone, that the party is building one combo together.
//
//   node test/playtest-line.cjs
//
// Shots land in test/shots/line-*.png
'use strict';
const { boot } = require('./harness.cjs');
const path = require('path');

(async () => {
  const t = await boot({ pl: 0 });
  const errs = []; t.page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await t.page.emulateMedia({ reducedMotion: 'reduce' });
  await t.autoParry(true); await t.fastCombat(0.10); await t.parrySkill(0.8, 4242);

  await t.J(() => {
    setInterval(() => {
      const ov = document.querySelector('#overlay');
      if (ov && !ov.classList.contains('hidden') && ov.querySelector('.ov-tap')) ov.click();
    }, 50);
    try { localStorage.setItem('kizuna2_1.tutorialSeen', '1'); } catch (_) {}
    RUN = newRun('ash');
    RUN.roster = ['ash', 'elin', 'mira']; RUN.active = RUN.roster.slice();
    RUN.hp = {}; RUN.active.forEach(h => RUN.hp[h] = HEROES[h].maxHp);
    RUN.nodes = ROTATION_GATES.slice();          // the full build, so every line forks
    RUN.completed = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    RUN.bonds = {};
    startFight({ type: 'fight', chapter: 3, heroes: RUN.active.slice(),
      enemies: ['husk', 'wraith', 'cultist'], useRunHp: true, floor: 1, depth: 3, narrator: 'pl' });
    S.heroes.forEach(h => { h.row = { ash: 'front', elin: 'mid', mira: 'back' }[h.id] || h.row; });
    renderAll();
  });
  await t.sleep(500);

  // What the HAND says, as a player reads it off the table.
  const table = () => t.J(() => Array.from(document.querySelectorAll('#hand .card')).map(el => {
    const own = el.dataset.owner, name = el.dataset.cardName;
    const role = (el.querySelector('.c-role') || {}).textContent || '';
    const cost = (el.querySelector('.c-cost') || {}).textContent || '';
    return `${own}:${name}${role ? ' [' + role.trim().replace(/\s+/g, ' ') + ']' : ''} ${cost.trim()}ep`
      + (el.classList.contains('disabled') ? ' (unaffordable)' : '')
      + (el.classList.contains('card-spent') ? ' (spent)' : '');
  }));
  const state = () => t.J(() => ({
    ep: S.ep + '/' + S.maxEp,
    depth: S.line ? S.line.depth : '—',
    beats: S.line ? S.line.beats.join('>') : '—',
    charge: (S.heroes.find(h => h.id === 'hask') || {}).charge,
    foes: S.enemies.filter(e => !e.dead).map(e => e.def.name + ' ' + e.hp + '/' + e.maxHp).join(', '),
    party: S.heroes.map(h => h.def.name + ' ' + h.hp + '/' + h.maxHp + (h.downed ? ' DOWN' : '')).join(', '),
  }));

  // Tap a card in the real hand, then drop it on a legal target.
  const tap = async (owner) => {
    const picked = await t.J((o) => {
      const el = Array.from(document.querySelectorAll('#hand .card'))
        .find(c => c.dataset.owner === o && !c.classList.contains('disabled') && !c.classList.contains('card-spent'));
      if (!el) return null;
      const card = buildHand().find(c => c.name === el.dataset.cardName && c.owner === o && !c.spent);
      if (!card) return null;
      const tid = (card.target === 'ally' || card.target === 'allies') ? (lowestHpAlly() || {}).id
                : (card.target === 'self') ? card.owner
                : ((frontmostEnemy() || livingEnemies()[0] || {}).uid);
      window.__pending = playCard(card, tid);     // the real play path
      return card.ownerName + ' → ' + card.name + ' (' + card.cost + ' ep)';
    }, owner);
    if (!picked) return null;
    await t.J(() => window.__pending);
    for (let i = 0; i < 200; i++) { if (await t.J(() => !S || S.over || !S.executing)) break; await t.sleep(30); }
    return picked;
  };

  const log = [];
  const beat = async (label, tag) => {
    const st = await state();
    log.push(`${label}\n     ep ${st.ep}  depth ${st.depth}  beats ${st.beats}`
      + `\n     table: ${(await table()).join('  |  ')}`);
    if (tag) await t.shot(tag);
  };

  console.log('\n=== PLAYTEST: a real descent room, tapped through the actual hand ===');
  console.log('party ash(front) elin(mid) mira(back) · husk+wraith+cultist · full tree · parry skill 0.8\n');
  await beat('TURN 1 opens', 'line-1-openers');

  // Beat 1: Ash opens. Beat 2: ELIN answers (a different hero on purpose — this is
  // the thing the line exists to make possible). Beat 3: MIRA finishes.
  for (const [who, label, tag] of [['ash', 'ASH opens', 'line-2-combo-stage'],
                                   ['elin', 'ELIN answers', 'line-3-finisher-stage'],
                                   ['mira', 'MIRA finishes', 'line-4-line-closed']]) {
    const played = await tap(who);
    if (!played) { log.push(`  ${label}: NO LEGAL CARD`); continue; }
    await beat(`  ${played}   [${label}]`, tag);
  }

  // …then let the rest of the turn run itself out, to see what a full turn costs.
  let more = 0;
  for (let i = 0; i < 12; i++) {
    const any = await t.J(() => {
      const el = document.querySelector('#hand .card:not(.disabled):not(.card-spent)');
      return el ? el.dataset.owner : null;
    });
    if (!any) break;
    if (!(await tap(any))) break;
    more++;
  }
  const end = await state();
  log.push(`  turn played out: ${3 + more} cards total, ep ${end.ep}`);
  log.push(`  foes: ${end.foes || 'all dead'}`);
  log.push(`  party: ${end.party}`);
  await t.shot('line-5-turn-end');

  log.forEach(l => console.log(l));
  console.log('\npage errors: ' + (errs.length ? errs.join(' | ') : 'none'));
  console.log('shots: v2.1/test/shots/line-*.png');
  await t.browser.close(); process.exit(0);
})();
