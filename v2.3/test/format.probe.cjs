'use strict';
// PHOTOGRAPH EVERY SCREEN, AND MEASURE THE TYPE ON IT.
//
// "The rest of the game doesn't match combat's formatting" is a judgement about
// pictures, so the pictures come first. But a picture cannot tell you WHY, and
// the why is measurable: every screen's distinct font sizes, families, weights,
// letter-spacings and corner radii, read off the live computed styles rather
// than off the stylesheet — because the stylesheet says what was written and
// getComputedStyle says what the player got.
const { boot } = require('./harness.cjs');
(async () => {
  const { page, J, sleep, browser } = await boot({ query: 'cast=3d' });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.waitForFunction(() => window.R && window.K, null, { timeout: 60000 });
  await J(() => { window.R.newRun(4100); return true; });
  await sleep(600);

  const census = (rootId) => J((id) => {
    const root = document.getElementById(id);
    if (!root) return { missing: id };
    const seen = new Map();
    const push = (k, v) => { if (!seen.has(k)) seen.set(k, new Set()); seen.get(k).add(v); };
    let n = 0;
    for (const el of root.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;        // not on screen
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
      n++;
      const txt = (el.textContent || '').trim();
      if (txt && el.children.length === 0) {
        push('size', parseFloat(cs.fontSize).toFixed(1));
        push('weight', cs.fontWeight);
        push('family', cs.fontFamily.split(',')[0].replace(/["']/g, ''));
        push('track', cs.letterSpacing === 'normal' ? 'normal'
                    : parseFloat(cs.letterSpacing).toFixed(2));
      }
      if (cs.borderRadius !== '0px') push('radius', cs.borderRadius.split(' ')[0]);
    }
    const out = { shown: n };
    for (const [k, v] of seen) out[k] = [...v].sort((a, b) => parseFloat(a) - parseFloat(b));
    return out;
  }, rootId);

  const screens = [['title', 'k-title'], ['map', 'k-map'], ['combat', 'k-stage'],
                   ['camp', 'k-camp'], ['mark', 'k-mark'], ['deck', 'k-deck']];
  for (const [name, id] of screens) {
    await J((s) => { window.R.screen(s); if (window.R.render) window.R.render(); return true; }, name);
    if (name === 'combat') await J(() => window.K.startCombat({ seed: 7 }));
    await sleep(900);
    await page.screenshot({ path: '/tmp/fmt-' + name + '.png' });
    const c = await census(id);
    console.log('\n' + name.toUpperCase().padEnd(8), 'elements shown:', c.shown);
    console.log('  sizes  ', JSON.stringify(c.size || []));
    console.log('  weights', JSON.stringify(c.weight || []));
    console.log('  family ', JSON.stringify(c.family || []));
    console.log('  track  ', JSON.stringify(c.track || []));
    console.log('  radius ', JSON.stringify(c.radius || []));
  }
  console.log('\npageErrors', errs.length, errs.slice(0, 2).join(' | '));
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
