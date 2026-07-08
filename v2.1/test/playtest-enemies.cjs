// Playtest the regular-mob identity pass: for each foe, show how each intent
// RESOLVES through the parry system (gesture · size · speed · glyph · art), and
// measure raw damage per round so we can sanity-check both feel and balance.
'use strict';
const { boot } = require('./harness.cjs');

(async () => {
  const t = await boot({ flow: 0 });
  const out = await t.J(() => {
    const mobs = ['husk', 'wraith', 'cultist', 'mourner', 'drone'];
    const rep = [];
    mobs.forEach(id => {
      const def = ENEMY_DEFS[id];
      const intents = def.intents.map(i => {
        if (!i.dmg) return { name: i.name, kind: 'BUFF', detail: i.desc || '' };
        const p = parryPatternFor(i);
        const g = parryGlyph(i);
        const shape = p.kind + (p.count ? '×' + p.count : '') + (p.size ? '/' + p.size : '') + (p.arc ? '/' + p.arc : '');
        return { name: i.name, dmg: i.dmg, row: i.row, art: i.attackArt || '(none)', gesture: shape, glyph: g, status: [i.chill && 'chill', i.expose && 'expose', i.hex && 'hex'].filter(Boolean).join(',') };
      });
      rep.push({ id, name: def.name, hp: def.maxHp, speed: def.parrySpeed || 1, weak: def.weak, intents });
    });
    return rep;
  });

  const L = [];
  out.forEach(m => {
    L.push(`\n=== ${m.name} (${m.id}) · ${m.hp}hp · weak ${m.weak} · parrySpeed ${m.speed} ===`);
    m.intents.forEach(i => {
      if (i.kind === 'BUFF') { L.push(`   • ${i.name.padEnd(18)} [BUFF] ${i.detail}`); return; }
      L.push(`   • ${i.name.padEnd(18)} dmg ${String(i.dmg).padEnd(2)} ${i.row.padEnd(5)} art:${i.art.padEnd(6)} gesture:${i.gesture.padEnd(20)} glyph:${i.glyph.padEnd(4)} ${i.status ? '· ' + i.status : ''}`);
    });
  });

  // Raw damage per round (no parry) vs a fresh solo hero — a rough balance read.
  const bal = await t.J(async () => {
    const mobs = ['husk', 'wraith', 'cultist', 'mourner', 'drone'];
    window.__autoParry = false;   // no defense — measure the full incoming hit
    const res = {};
    for (const id of mobs) {
      startFight({ type: 'fight', chapter: 2, heroes: ['ash'], enemies: [id], narrator: 'bal' });
      const h = S.heroes[0]; const before = h.hp;
      // force each DAMAGE intent once and tally what lands with zero mitigation
      const dmgIntents = S.enemies[0].def.intents.filter(i => i.dmg);
      let total = 0;
      for (const it of dmgIntents) total += it.dmg;
      res[id] = { hp: before, sumOfIntentDmg: total, maxHitVsHero: Math.max(...dmgIntents.map(i => i.dmg)) };
    }
    return res;
  });
  L.push('\n=== RAW DAMAGE (balance read, no parry) ===');
  Object.keys(bal).forEach(id => L.push(`   ${id.padEnd(8)} biggest single hit ${bal[id].maxHitVsHero}  · sum of its damage intents ${bal[id].sumOfIntentDmg}`));

  console.log(L.join('\n'));
  await t.browser.close();
  process.exit(0);
})();
