'use strict';
// DOES DEFINING THE TOKEN ACTUALLY CHANGE THE FACE, AND DOES ANYTHING STOP
// FITTING WHEN IT DOES?
//
// `var(--serif, Georgia, serif)` appears 28 times and `var(--ui, system-ui)` 37,
// and NEITHER token is defined — so all 65 sites take their fallback while
// `body` is set in Cormorant Garamond. The game is laid out in two serifs
// depending on whether a rule spelled the token out.
//
// Only `--serif` is wrong. `--ui` falls back to system-ui, which is what those
// 37 small-caps labels are meant to be — defining it to a serif would be a
// redesign, not a repair, so it is defined AS the sans stack it already gets.
//
// The first cut of this probe reported "net newly-clipped: 0" with every cell
// identical before and after — which is exactly what a change that never
// applied looks like. So the face is now read off a real element first: if
// nothing moved, the clipping result means nothing and is not reported.
const { boot } = require('./harness.cjs');
const SERIF = "'Cormorant Garamond', Georgia, 'Times New Roman', serif";
const UI = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
(async () => {
  const { page, J, sleep, browser } = await boot({ query: 'cast=3d' });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.waitForFunction(() => window.R && window.K, null, { timeout: 60000 });
  await J(() => { window.R.newRun(4100); return true; });
  await J(() => document.fonts ? document.fonts.ready.then(() => true) : true);
  await sleep(600);

  // a known `var(--serif)` site, and a known `var(--ui)` one, read live
  const faces = () => J(() => {
    const pick = (sel) => { const n = document.querySelector(sel);
      return n ? getComputedStyle(n).fontFamily.split(',')[0].replace(/["']/g, '') : null; };
    return { markName: pick('#k-bi-name'), markTitle: pick('#k-mark-title'),
             uiLabel: pick('#k-mark-ask'), body: getComputedStyle(document.body)
               .fontFamily.split(',')[0].replace(/["']/g, '') };
  });

  const clipped = (rootId) => J((id) => {
    const root = document.getElementById(id);
    if (!root) return { missing: id };
    const bad = []; let leaves = 0;
    for (const el of root.querySelectorAll('*')) {
      if (el.children.length || !(el.textContent || '').trim()) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
      leaves++;
      const ox = el.scrollWidth - el.clientWidth, oy = el.scrollHeight - el.clientHeight;
      if (ox > 1 || oy > 1)
        bad.push((el.id || el.className || el.tagName).toString().slice(0, 26) + ':' + ox + 'x' + oy);
    }
    return { leaves, clipped: bad.length, which: bad.slice(0, 8) };
  }, rootId);

  const SCREENS = [['title', 'k-title'], ['map', 'k-map'], ['combat', 'k-stage'],
                   ['camp', 'k-camp'], ['mark', 'k-mark'], ['deck', 'k-deck']];
  const pass = async (label) => {
    const out = {};
    for (const [name, id] of SCREENS) {
      await J((s) => { window.R.screen(s); if (window.R.render) window.R.render(); return true; }, name);
      if (name === 'combat') await J(() => window.K.startCombat({ seed: 7 }));
      await sleep(700);
      out[name] = await clipped(id);
      await page.screenshot({ path: '/tmp/srf-' + label + '-' + name + '.png' });
    }
    return out;
  };

  console.log('\nBEFORE faces', JSON.stringify(await faces()));
  const before = await pass('before');

  await J(([s, u]) => { const r = document.documentElement;
    r.style.setProperty('--serif', s); r.style.setProperty('--ui', u); return true; }, [SERIF, UI]);
  await J(() => document.fonts ? document.fonts.ready.then(() => true) : true);
  await sleep(500);
  const af = await faces();
  console.log('AFTER  faces', JSON.stringify(af));

  const moved = af.markTitle && af.markTitle.indexOf('Cormorant') === 0;
  if (!moved) {
    console.log('\n!! THE PROPERTY DID NOT TAKE — the clipping differential below would');
    console.log('   be meaningless, so it is not reported. Fix the instrument first.');
    console.log('\npageErrors', errs.length);
    await browser.close();
    return;
  }
  const after = await pass('after');
  console.log('\n── the differential ──');
  let worse = 0;
  for (const k of Object.keys(before)) {
    const b = before[k].clipped, a = after[k].clipped;
    if (a > b) worse += a - b;
    console.log('  ' + k.padEnd(8) + ' leaves ' + before[k].leaves
                + ' · clipped ' + b + ' -> ' + a
                + (a > b ? '   WORSE ' + JSON.stringify(after[k].which) : a < b ? '   better' : ''));
  }
  console.log('  net newly-clipped elements:', worse);
  console.log('\npageErrors', errs.length, errs.slice(0, 2).join(' | '));
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
