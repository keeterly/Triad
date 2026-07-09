// Playtest: Hask balance & viability. Drives REAL rotations (from ROTATIONS)
// through a generic chain-walker vs a dummy, and reports damage-per-turn and
// resource state. Two views:
//   A) cross-hero baseline — every hero's fully-branched turn, to place Hask
//   B) Hask's four build paths — Rime / Overload / Cast / Weave — each viable?
'use strict';
const { boot } = require('./harness.cjs');

(async () => {
  const t = await boot({ flow: 0 });

  const out = await t.J(async () => {
    window.__autoParry = false;

    // Walk a stance's chain from its opener, following `next` to the DEEPEST
    // gated line the owned nodes unlock. Resolve each card; sum damage + EP.
    async function driveTurn(hero, stance, nodes, opts) {
      opts = opts || {};
      RUN = newRun(hero); RUN.roster = [hero]; RUN.active = [hero];
      RUN.hp = {}; RUN.hp[hero] = HEROES[hero].maxHp; RUN.nodes = nodes.slice();
      RUN.completed = [0,1,2,3,4,5,6,7,8]; RUN.bonds = {}; RUN._rotations = false;
      startMapFight(RUN.map.find(x => x.type === 'fight'));
      const h = S.heroes[0]; h.row = stance;
      if (opts.aether != null) h.aether = opts.aether;
      const e = S.enemies[0]; e.hp = e.maxHp = 600; e.guard = 0;
      S.ep = 99; renderAll();
      const rot = ROTATIONS[hero][stance];
      const hp0 = e.hp;
      let key = rot.opener, ep = 0, steps = [], guard = 0;
      const has = id => RUN.nodes.includes(id);
      while (key && steps.length < 6) {
        const card = rot.cards[key]; if (!card) break;
        ep += card.cost || 0;
        const before = S.enemies[0].hp;
        const tid = (S.enemies[0] || {}).uid;
        await resolveCard(Object.assign({ owner: hero, kind: steps.length === 0 ? 'opener' : 'chain' }, card), tid);
        const dealt = before - S.enemies[0].hp;
        steps.push(card.name + (dealt ? '·' + dealt : ''));
        // choose next: prefer the DEEPEST owned gate (forks listed last), else
        // the base finisher (its gateNot node NOT owned), else a plain string.
        const nx = card.next; if (!nx) break;
        let pick = null;
        for (const n of nx) {
          if (typeof n === 'string') { pick = pick || n; continue; }
          if (n.gate && has(n.gate)) pick = n.key;                    // owned fork/sig — take the deepest
          else if (n.gateNot && !has(n.gateNot) && !pick) pick = n.key; // base finisher when sig unowned
        }
        key = pick;
      }
      return { hero, stance, dmg: hp0 - S.enemies[0].hp, ep, charge: h.charge || 0, aether: h.aether || 0, hp: HEROES[hero].maxHp, chain: steps.join(' → ') };
    }

    const FULL = {   // each hero's sig + fork nodes for the given stance (fully-branched)
      ash:     { stance: 'front', nodes: ['ash.sig.front', 'ash.branch.front'] },
      cassia:  { stance: 'front', nodes: ['cassia.sig.front', 'cassia.branch.front'] },
      elin:    { stance: 'mid',   nodes: ['elin.sig.mid', 'elin.branch.mid'] },
      mira:    { stance: 'mid',   nodes: ['mira.sig.mid', 'mira.branch.mid'] },
      branwen: { stance: 'back',  nodes: ['branwen.sig.back', 'branwen.branch.back'] },
      hask:    { stance: 'front', nodes: ['hask.sig.front', 'hask.branch.front'] },
    };
    const baseline = [];
    for (const hid of Object.keys(FULL)) baseline.push(await driveTurn(hid, FULL[hid].stance, FULL[hid].nodes));

    // Hask's four identities
    const paths = [];
    paths.push(await driveTurn('hask', 'front', ['hask.sig.front', 'hask.branch.front']));                        // RIME (chill/shatter)
    paths.push(await driveTurn('hask', 'mid',   ['hask.sig.mid', 'hask.branch.mid']));                            // OVERLOAD (charge dump)
    paths.push(await driveTurn('hask', 'back',  ['hask.sig.back', 'hask.branch.back']));                          // CAST (Waystone→Starfall begins a cast)
    paths.push(await driveTurn('hask', 'front', ['hask.sig.front', 'hask.weave.astral'], { aether: -1 }));        // WEAVE Emberwake (open in Frost)
    paths.push(await driveTurn('hask', 'front', ['hask.sig.front', 'hask.weave.astral', 'hask.weave.enochian'], { aether: -1 })); // WEAVE + Backdraft

    return { baseline, paths };
  });

  const P = 8;
  console.log('\n=== A) CROSS-HERO BASELINE — one fully-branched turn vs 600hp dummy ===\n');
  console.log('hero'.padEnd(P) + 'HP  dmg  EP  dmg/EP  chain');
  out.baseline.sort((a,b)=>b.dmg-a.dmg).forEach(r => {
    const dpe = r.ep ? (r.dmg / r.ep).toFixed(1) : '∞';
    console.log(`${r.hero.padEnd(P)}${String(r.hp).padEnd(4)}${String(r.dmg).padStart(3)}  ${String(r.ep).padStart(2)}  ${String(dpe).padStart(5)}   ${r.chain}`);
  });
  console.log('\n=== B) HASK BUILD PATHS — is each identity viable? ===\n');
  const label = ['RIME (front)', 'OVERLOAD (mid)', 'CAST (back)', 'WEAVE Emberwake', 'WEAVE +Backdraft'];
  out.paths.forEach((r, i) => {
    console.log(`${label[i].padEnd(18)} dmg ${String(r.dmg).padStart(3)}  EP ${r.ep}  ◆${r.charge}  aether ${r.aether>0?'+'+r.aether:r.aether}   ${r.chain}`);
  });
  console.log('\nNote: CAST begins a pending cast (◈16) that lands NEXT turn — its 16 is not in this turn\'s dmg.');
  await t.browser.close();
  process.exit(0);
})();
