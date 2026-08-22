// ANCHORMETER — does anything the board says ever move while you are reading it?
//
// The telegraph is a nameplate flashing red and a pill saying what is coming.
// Both live inside the `.figure` they describe. Every combat animation used to
// transform that `.figure`, so at the exact frame the player reads the warning,
// the warning slid: the wind-up tell moved a foe seven to nine pixels sideways,
// the lunge sixteen, and a striking hero left their own nameplate up to 126px
// behind. Plates and pills belong to the board; only the drawn body may move.
//
// This walks every combat animation class the game applies, samples the live
// rect of each figure's nameplate and intent pill through the animation, and
// reports any that travel.
//
//   node test/anchormeter.cjs
'use strict';
const { boot } = require(require('path').join(__dirname, 'harness.cjs'));

// every class the game stamps on a .figure during combat
const CLASSES = [
  'fig-lunge', 'fig-lunge-hero', 'fig-hit', 'fig-hit-l', 'fig-hit-r',
  'fig-parry', 'fig-bond', 'fig-held', 'fig-strike', 'fig-return',
  'fig-windup fw-slash', 'fig-windup fw-brace', 'fig-windup fw-sweep', 'fig-windup fw-flurry',
];
const TOL = 1.5;   // sub-pixel layout noise, nothing more

(async () => {
  const t = await boot({});
  const J = t.J.bind(t);
  await t.page.setViewportSize({ width: 1000, height: 462 });

  await J(() => {
    try { localStorage.setItem('kizuna2_2.tutorialSeen', '1'); } catch (_) {}
    RUN = newRun('ash'); RUN.roster = ['ash', 'hask', 'mira']; RUN.active = RUN.roster.slice();
    RUN.hp = {}; RUN.active.forEach(h => RUN.hp[h] = HEROES[h].maxHp);
    RUN.floor = 1; RUN.completed = []; RUN.map = generateDescent(RUN.roster, 1);
    const n = mapAll().find(x => x.type === 'fight');
    RUN.completed = mapAll().filter(x => x.col < n.col).map(x => x.id);
    enterMapNode(n);
  });
  await t.sleep(1400);

  const drift = [];
  for (const cls of CLASSES) {
    for (const side of ['#party-half', '#enemy-half']) {
      const rows = await J((o) => {
        const fig = document.querySelector(o.side + ' .figure[data-fig]');
        if (!fig) return null;
        const rect = (q) => { const n = fig.querySelector(q); if (!n) return null;
          const r = n.getBoundingClientRect(); return [r.left, r.top]; };
        const before = { name: rect('.fig-name'), pill: rect('.intent'), hp: rect('.hp-bar') };
        o.cls.split(' ').forEach(c => fig.classList.add(c));
        return { before, has: !!before.name };
      }, { side, cls });
      if (!rows || !rows.has) continue;
      // sample through the animation rather than at one instant — a keyframe
      // peak at 32% is invisible to a single reading taken at the start
      let worst = { name: 0, pill: 0, hp: 0 };
      for (let i = 0; i < 8; i++) {
        await t.sleep(45);
        const now = await J((o) => {
          const fig = document.querySelector(o.side + ' .figure[data-fig]');
          const rect = (q) => { const n = fig.querySelector(q); if (!n) return null;
            const r = n.getBoundingClientRect(); return [r.left, r.top]; };
          return { name: rect('.fig-name'), pill: rect('.intent'), hp: rect('.hp-bar') };
        }, { side });
        for (const k of ['name', 'pill', 'hp']) {
          const a = rows.before[k], b = now[k];
          if (!a || !b) continue;
          worst[k] = Math.max(worst[k], Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
        }
      }
      await J((o) => { const fig = document.querySelector(o.side + ' .figure[data-fig]');
        o.cls.split(' ').forEach(c => fig.classList.remove(c)); }, { side, cls });
      await t.sleep(120);
      const moved = Object.entries(worst).filter(([, v]) => v > TOL);
      if (moved.length) drift.push({ cls, side, moved: moved.map(([k, v]) => k + ' ' + v.toFixed(1) + 'px').join(', ') });
    }
  }

  console.log('\n=== ANCHORMETER · v2.2 ===\n');
  console.log('  ' + CLASSES.length + ' combat animations × 2 sides, sampled through each');
  if (!drift.length) console.log('\n  ✓ nothing the board says ever moves — plates and pills stay on their ground');
  else drift.forEach(d => console.log('   ✗ ' + d.cls + ' on ' + d.side + ' drags: ' + d.moved));
  await t.browser.close();
  process.exit(drift.length ? 1 : 0);
})();
