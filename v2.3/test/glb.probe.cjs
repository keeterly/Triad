'use strict';
const { boot } = require('./harness.cjs');
(async () => {
  const { page, J, browser } = await boot({ query: 'cast=3d' });
  page.on('pageerror', e => console.log('!! PAGE ERROR:', e.message));
  const ok = await page.waitForFunction(() => window.Cast3D && window.Cast3D._state().ready,
    null, { timeout: 60000 }).then(() => true).catch(() => false);
  const st0 = await J(() => window.Cast3D._state());
  console.log('ready', ok, 'party', JSON.stringify(st0.figures), 'failed', st0.failed);
  // and now the bestiary, which arrives behind the party
  await J(() => window.Cast3D.warm());
  const st = await J(() => window.Cast3D._state());
  console.log('warm  figures', st.figures.length, 'foes', JSON.stringify(st.foes),
              'missing', JSON.stringify(st.missing));
  const bones = await J(() => Object.fromEntries(
    window.Cast3D._state().figures.map(id => [id, Object.keys(window.Cast3D._figure(id).bones).length])));
  console.log('bones per figure:', JSON.stringify(bones));
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
