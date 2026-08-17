// Playtest analysis: dump each hero's tree, the ember economy across a descent,
// and the build-path structure so we can judge expression & build variation.
'use strict';
const { boot } = require('./harness.cjs');

(async () => {
  const t = await boot({ flow: 0 });
  const data = await t.J(() => {
    const out = { heroes: {}, economy: {}, map: null };

    // ---- MAP: what a single forward path yields ----
    RUN = newRun('ash');
    RUN.roster = ['ash', 'cassia', 'elin']; RUN.active = RUN.roster.slice();
    const mapNodes = mapAll ? mapAll() : (RUN.map || []);
    const counts = { fight: 0, elite: 0, boss: 0, event: 0, other: 0 };
    mapNodes.forEach(n => {
      const ty = n.isBoss ? 'boss' : n.elite ? 'elite' : n.type || 'other';
      counts[ty] = (counts[ty] || 0) + 1;
    });
    out.map = { total: mapNodes.length, counts };

    // ---- ECONOMY: embers from one descent path (forward-only) ----
    // A single path visits roughly: several normals, an elite or two, one boss.
    // Reward: normal 3, elite 5, boss 13 (heat 0).
    const perFloorPath = { normals: 4, elites: 1, boss: 1 };  // typical forward path
    const floorEmbers = perFloorPath.normals * 3 + perFloorPath.elites * 5 + perFloorPath.boss * 13;
    out.economy.perFloorPath = floorEmbers;
    out.economy.threeFloors = floorEmbers * 3;

    // ---- PER HERO ----
    const HERO_IDS = ['ash', 'cassia', 'elin', 'mira', 'branwen'];
    HERO_IDS.forEach(hid => {
      const nodes = EMBER_TREE.filter(n => n.hero === hid);
      const byTier = {};
      let totalCost = 0;
      nodes.forEach(n => {
        totalCost += n.cost;
        (byTier[n.tier] = byTier[n.tier] || []).push({ id: n.id.replace(hid + '.', ''), type: n.type, cost: n.cost, req: (n.requires || []).map(r => r.replace(hid + '.', '')), label: n.label });
      });
      // capstones = tier-4 nodes (the build-defining endpoints)
      const caps = nodes.filter(n => n.tier === 4).map(n => ({ id: n.id.replace(hid + '.', ''), label: n.label, req: (n.requires || []).map(r => r.replace(hid + '.', '')) }));
      // leaf endpoints (nothing requires them) = terminal build choices
      const required = new Set();
      nodes.forEach(n => (n.requires || []).forEach(r => required.add(r)));
      const leaves = nodes.filter(n => !required.has(n.id)).map(n => n.id.replace(hid + '.', ''));
      out.heroes[hid] = { count: nodes.length, totalCost, byTier, caps, leaves };
    });
    return out;
  });

  // ---- render report ----
  const L = [];
  L.push('=== ECONOMY ===');
  L.push(`Map nodes total: ${data.map.total}  counts: ${JSON.stringify(data.map.counts)}`);
  L.push(`Embers per floor-path (~4 normal + 1 elite + 1 boss @ heat0): ${data.economy.perFloorPath}`);
  L.push(`Embers across 3 floors: ${data.economy.threeFloors}`);
  L.push('');
  Object.keys(data.heroes).forEach(hid => {
    const h = data.heroes[hid];
    L.push(`=== ${hid.toUpperCase()} — ${h.count} nodes, full-tree cost ${h.totalCost}✦ ===`);
    [1,2,3,4].forEach(tier => {
      const ns = h.byTier[tier] || [];
      if (!ns.length) return;
      L.push(`  T${tier} (opens depth ${(tier-1)*2}): ` + ns.map(n => `${n.id}[${n.type} ${n.cost}✦${n.req.length ? ' ←'+n.req.join(',') : ''}]`).join('  '));
    });
    L.push(`  CAPSTONES (T4): ${h.caps.map(c => c.label + ' ←' + c.req.join(',')).join(' | ')}`);
    L.push(`  LEAF endpoints (terminal picks): ${h.leaves.join(', ')}`);
    L.push('');
  });
  console.log(L.join('\n'));
  await t.browser.close();
  process.exit(0);
})();
