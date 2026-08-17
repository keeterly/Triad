// Screenshot the CHOOSE YOUR SURVIVOR screen to verify the single scrolling row.
'use strict';
const { boot } = require('./harness.cjs');
const path = require('path');

(async () => {
  const t = await boot({ flow: 0 });
  await t.J(() => { try { localStorage.setItem('kizuna2_2.starters', JSON.stringify(['ash','elin','mira','cassia','branwen','hask'])); } catch (_) {} showStarterSelect(() => {}); });
  await t.sleep(500);
  await t.page.screenshot({ path: path.join(__dirname, 'shots', 'starter-onerow.png') });
  const info = await t.J(() => {
    const row = document.querySelector('.ss-row'); const figs = document.querySelectorAll('.ss-fig');
    const tops = [...figs].map(f => Math.round(f.getBoundingClientRect().top));
    const rows = [...new Set(tops)].length;
    return { figs: figs.length, distinctTops: rows, scrollW: row.scrollWidth, clientW: row.clientWidth, overflows: row.scrollWidth > row.clientWidth + 1 };
  });
  console.log('starter select:', JSON.stringify(info));
  console.log(info.distinctTops === 1 ? '✓ single row (all figures share one top)' : '✗ still multi-row: ' + info.distinctTops + ' rows');
  await t.browser.close();
  process.exit(0);
})();
