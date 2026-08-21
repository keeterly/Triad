// PARRYMETER — does the defence actually deliver the outcome it promises?
//
// The parry is the one system whose quality is a number: where the grade bands
// sit relative to the beat, and how often real play reaches the top of them.
// Before Build 38 nobody had measured either, and both were broken — the bands
// were one-sided (a tap 1ms after the ring closed was a full MISS) and the
// harness aimed 200ms EARLY on purpose, so every reading the rig had ever
// produced described a bot fighting the measurement, not the game.
//
// This drives real cascades with a bot whose aim we can bias by a known number
// of milliseconds, and reports:
//   · the grade histogram at dead-on aim        (is the top tier REACHABLE?)
//   · the cascade outcomes: TURNED / FLAWLESS   (is the fantasy REACHED?)
//   · a sweep across ±ms                        (do the bands match the spec?)
//
//   node test/parrymeter.cjs
'use strict';
const { boot } = require(require('path').join(__dirname, 'harness.cjs'));

const NOTES_WANTED = +(process.env.NOTES || 40);

(async () => {
  const t = await boot({});
  const J = t.J.bind(t);
  await t.page.setViewportSize({ width: 1000, height: 462 });

  // Record every rating and every cascade receipt straight off the screen —
  // what the probe counts is exactly what a player is shown.
  await J(() => {
    window.__pm = { grades: [], receipts: [] };
    const G = { PERFECT: 'perfect', GREAT: 'great', GOOD: 'good', LATE: 'late', MISS: 'miss' };
    new MutationObserver(ms => {
      for (const m of ms) for (const n of m.addedNodes) {
        if (n.nodeType !== 1 || !n.classList) continue;
        if (n.classList.contains('parry-rate')) {
          const w = (n.textContent || '').trim().split(/\s|×/)[0];
          if (G[w]) window.__pm.grades.push(G[w]);
        } else if (n.classList.contains('parry-receipt')) {
          const b = (n.querySelector('b') || {}).textContent || '';
          window.__pm.receipts.push(/FLAWLESS/.test(b) ? 'flawless' : /TURNED/.test(b) ? 'turned' : 'partial');
        }
      }
    }).observe(document.getElementById('popup-layer'), { childList: true, subtree: true });
  });
  const reset = () => J(() => { window.__pm = { grades: [], receipts: [] }; });
  const read = () => J(() => window.__pm);

  const startFight = (kind) => J((k) => {
    try { localStorage.setItem('kizuna2_2.tutorialSeen', '1'); } catch (_) {}
    RUN = newRun('ash');
    RUN.roster = ['ash', 'hask', 'mira']; RUN.active = RUN.roster.slice();
    RUN.hp = {}; RUN.active.forEach(h => RUN.hp[h] = HEROES[h].maxHp);
    RUN.embers = 24; RUN.floor = 1; RUN.completed = [];
    RUN.map = generateDescent(RUN.roster, 1);
    const node = mapAll().find(x => x.type === k) || mapAll().find(x => x.type === 'fight');
    RUN.completed = mapAll().filter(x => x.col < node.col).map(x => x.id);
    enterMapNode(node);
    return node.type;
  }, kind);

  // Take blows and nothing else: the party never attacks, so the fight lasts and
  // the enemies keep swinging. Heroes are kept standing between turns so the
  // sample is about the PARRY, not about attrition.
  const takeBlows = async (want) => {
    let guard = 0;
    while ((await read()).grades.length < want && guard++ < 40) {
      const alive = await J(() => !!(typeof S !== 'undefined' && S) && !S.over);
      if (!alive) { await t.sleep(300); return false; }
      await J(() => { S.heroes.forEach(h => { h.downed = false; h.hp = h.maxHp; }); });
      await J(async () => { if (S && !S.over && !S.executing) await endTurn(); });
      for (let i = 0; i < 300; i++) { if (await J(() => typeof S === 'undefined' || !S || S.over || !S.executing)) break; await t.sleep(60); }
    }
    return true;
  };

  // A fight can end under a party that never attacks — the foes finish the job.
  // Stand a new one up and keep sampling until the ask is met.
  const sample = async (aimMs, want, kind) => {
    await reset();
    for (let round = 0; round < 6; round++) {
      await startFight(kind || 'elite');
      await t.sleep(900);
      await t.autoParry(true);
      await t.parrySkill(1);
      await t.parryAim(aimMs);
      await takeBlows(want);
      if ((await read()).grades.length >= want) break;
    }
    return read();
  };

  await t.fastCombat(0.2);

  const hist = (g) => {
    const h = { perfect: 0, great: 0, good: 0, late: 0, miss: 0 };
    g.forEach(x => h[x]++);
    return h;
  };
  const pct = (n, d) => d ? Math.round((n / d) * 100) + '%' : '—';

  console.log('\n=== PARRYMETER · v2.2 ===\n');

  // 1. dead-on — the reachability question
  const on = await sample(0, NOTES_WANTED, 'elite');
  const H = hist(on.grades), N = on.grades.length;
  console.log('DEAD ON THE BEAT (' + N + ' notes)');
  console.log('  perfect ' + on.grades.filter(x => x === 'perfect').length + '  great ' + H.great +
              '  good ' + H.good + '  late ' + H.late + '  miss ' + H.miss);
  const R = on.receipts, turned = R.filter(x => x !== 'partial').length;
  console.log('  cascades: ' + R.length + '  turned+ ' + turned + ' (' + pct(turned, R.length) + ')' +
              '  flawless ' + R.filter(x => x === 'flawless').length);

  // 2. the sweep — where the bands really sit
  console.log('\nAIM SWEEP (share of notes at each grade)');
  const rows = [];
  for (const off of [-260, -160, -100, -40, 60, 120, 190, 300]) {
    const s = await sample(off, 12, 'fight');
    const h = hist(s.grades), n = s.grades.length;
    rows.push({ off, n, h });
    console.log('  ' + String(off).padStart(5) + 'ms  n=' + String(n).padStart(2) +
      '  perfect ' + pct(h.perfect, n) + '  great ' + pct(h.great, n) +
      '  good ' + pct(h.good, n) + '  late ' + pct(h.late, n) + '  miss ' + pct(h.miss, n));
  }

  // 3. the verdict — the two things the rebuild promised
  const problems = [];
  if (!N) problems.push('no notes played at all — the probe never reached a cascade');
  if (N && H.perfect / N < 0.6) problems.push('a dead-on read grades PERFECT only ' + pct(H.perfect, N) + ' of the time');
  if (R.length && turned / R.length < 0.6) problems.push('a dead-on read TURNS only ' + pct(turned, R.length) + ' of cascades');
  const late150 = rows.find(r => r.off === 120);
  if (late150 && late150.n && (late150.h.miss / late150.n) > 0.2) problems.push('a 120ms-late catch still reads as a MISS');
  const wayEarly = rows.find(r => r.off === -260);
  if (wayEarly && wayEarly.n && wayEarly.h.perfect > 0) problems.push('a 260ms-early tap still grades PERFECT — the early side is not graded');

  console.log('');
  if (problems.length) { problems.forEach(p => console.log('  ✗ ' + p)); }
  else console.log('  ✓ the top of the parry is reachable and the bands are symmetric');
  await t.browser.close();
  process.exit(problems.length ? 1 : 0);
})();
