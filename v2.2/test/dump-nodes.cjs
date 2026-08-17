'use strict';
const { boot } = require('./harness.cjs');
(async () => {
  const t = await boot({ flow: 0 });
  const rows = await t.J(() => EMBER_TREE.map(n => ({ id: n.id, hero: n.hero, type: n.type, tier: n.tier, label: n.label, desc: (n.desc || '').replace(/<[^>]+>/g, '') })));
  const byHero = {};
  rows.forEach(r => { (byHero[r.hero] = byHero[r.hero] || []).push(r); });
  Object.keys(byHero).forEach(h => {
    console.log('\n==================== ' + h.toUpperCase() + ' ====================');
    byHero[h].forEach(r => console.log(`\n[${r.type} T${r.tier}] ${r.label}\n  ${r.desc}`));
  });
  await t.browser.close(); process.exit(0);
})();
