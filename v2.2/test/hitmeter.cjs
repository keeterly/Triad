// HITMETER — what actually happens when a blow lands, and how much of it is
// doing any work.
//
// A single ordinary hit fires ten things at once: the foe's sprite changes
// state, a damage number pops, a school-typed impact bursts, the figure recoils
// and flashes, the whole screen flashes, a sound plays, the stage shakes, the
// camera punches toward the target, and on a primed foe a TECHNICAL callout and
// a second burst land on the same frame. This rig fires one controlled blow per
// tier and photographs it — once with everything on, then once per element with
// that element alone removed — so the contribution of each can be LOOKED AT
// rather than argued about. It also counts what is alive on screen at the peak.
//
//   node test/hitmeter.cjs          full sweep, frames into test/shots/hit/
'use strict';
const { boot } = require(require('path').join(__dirname, 'harness.cjs'));
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'shots', 'hit');

// every element the on-hit bundle fires, and the global it lives behind
const ELEMENTS = [
  { key: 'foeAnimState', label: 'foe sprite state' },
  { key: 'popupAt',      label: 'damage number' },
  { key: 'impactFx',     label: 'school impact burst' },
  { key: 'struck',       label: 'figure recoil + flash' },
  { key: 'hitFlash',     label: 'full-screen flash (+hitstop)' },
  { key: 'stageShake',   label: 'screen shake' },
  { key: 'camPunch',     label: 'camera punch' },
  { key: 'techBurst',    label: 'TECHNICAL burst' },
];

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const t = await boot({});
  const J = t.J.bind(t);
  await t.page.setViewportSize({ width: 1000, height: 462 });

  const setup = () => J(() => {
    try { localStorage.setItem('kizuna2_2.tutorialSeen', '1'); } catch (_) {}
    RUN = newRun('ash'); RUN.roster = ['ash', 'hask', 'mira']; RUN.active = RUN.roster.slice();
    RUN.hp = {}; RUN.active.forEach(h => RUN.hp[h] = HEROES[h].maxHp);
    RUN.floor = 1; RUN.completed = []; RUN.map = generateDescent(RUN.roster, 1);
    SETTINGS.fightBg = true;
    const n = mapAll().find(x => x.type === 'fight');
    RUN.completed = mapAll().filter(x => x.col < n.col).map(x => x.id);
    enterMapNode(n);
  });

  // keep the originals so an ablation can be undone
  await J(() => {
    window.__orig = {};
    ['foeAnimState', 'popupAt', 'impactFx', 'struck', 'hitFlash', 'stageShake', 'camPunch', 'techBurst']
      .forEach(k => { window.__orig[k] = window[k]; });
    window.__ablate = (k) => { Object.keys(window.__orig).forEach(x => { window[x] = window.__orig[x]; });
      if (k) window[k] = function () {}; };
  });

  // fire one blow of a chosen weight at the frontmost foe and hold the board
  const strike = (amt, primed) => J((o) => {
    const e = frontmostEnemy() || livingEnemies()[0];
    e.hp = e.maxHp = 4000; e.guard = 0; e.poise = e.poiseMax = 99;
    e.staggered = false; e.lull = o.primed ? 2 : 0; e.weakened = false;
    S._burstResolving = false;
    dealToEnemy(e, o.amt, 'blade', 'ash');
  }, { amt, primed });

  // what is alive on the screen at this instant, and what it is
  const census = () => J(() => {
    const st = document.getElementById('stage');
    const q = (s) => document.querySelectorAll(s).length;
    return {
      popups: q('#popup-layer .popup'),
      impacts: q('#popup-layer .impact'),
      flashes: q('.hit-flash'),
      bursts: q('.death-burst') + q('.impact-tech'),
      shaking: /stage-shake/.test(st.className),
      hitstop: st.classList.contains('hitstop'),
      camMoved: (() => { const v = getComputedStyle(st);
        return Math.abs(parseFloat(v.getPropertyValue('--cam-x')) || 0)
             + Math.abs(parseFloat(v.getPropertyValue('--cam-dz')) || 0)
             + Math.abs(parseFloat(v.getPropertyValue('--cam-r')) || 0) > 0.5; })(),
      recoiling: q('.figure.fig-hit-r, .figure.fig-hit-l, .figure.fig-hit'),
      total: q('#popup-layer > *') + q('.hit-flash'),
    };
  });

  let n = 0;
  const shot = async (tag) => {
    const f = path.join(OUT, String(++n).padStart(2, '0') + '-' + tag.replace(/\W+/g, '-') + '.png');
    await t.page.screenshot({ path: f });
    return f;
  };

  console.log('\n=== HITMETER · v2.2 ===\n');

  // ── 1. the filmstrip: one ordinary hit, frame by frame ───────────────────
  await setup(); await t.sleep(1600);
  await J(() => window.__ablate(null));
  console.log('AN ORDINARY HIT (12 damage), frame by frame');
  await strike(12, false);
  for (const at of [30, 90, 180, 320, 520]) {
    await t.sleep(at === 30 ? 30 : 60);
    const c = await census();
    await shot('strip-' + at + 'ms');
    console.log('  +' + String(at).padStart(3) + 'ms  ' + JSON.stringify(c));
  }
  await t.sleep(900);

  // ── 2. the census at the peak, per weight ────────────────────────────────
  console.log('\nWHAT IS ALIVE AT THE PEAK, BY WEIGHT OF BLOW');
  for (const [label, amt, primed] of [['chip 4', 4, false], ['solid 9', 9, false],
                                      ['heavy 14', 14, false], ['massive 24', 24, false],
                                      ['technical 14', 14, true]]) {
    await J(() => window.__ablate(null));
    await strike(amt, primed);
    await t.sleep(70);
    const c = await census();
    await shot('peak-' + label);
    console.log('  ' + label.padEnd(13) + JSON.stringify(c));
    await t.sleep(1000);
  }

  // ── 3. ablation: the same blow with one element removed at a time ────────
  console.log('\nABLATION — the same 14-damage blow, one element removed each time');
  for (const el of [{ key: null, label: 'everything on' }].concat(ELEMENTS)) {
    await J((k) => window.__ablate(k), el.key);
    await strike(14, false);
    await t.sleep(70);
    const f = await shot('ablate-' + (el.key || 'all'));
    console.log('  without ' + el.label.padEnd(30) + ' → ' + path.basename(f));
    await t.sleep(1000);
  }
  await J(() => window.__ablate(null));

  console.log('\nframes in ' + OUT);
  await t.browser.close();
})();
