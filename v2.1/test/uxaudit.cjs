// UXAUDIT — walk every screen and report what does not FIT.
//
// Every UI bug reported in this project so far has been geometry: a lesson toast
// clipped off the left edge, map labels colliding with their neighbours, a card
// under the END TURN button, dashed frames reading as selection. Those are all
// findable without a human eye. This visits each screen and reports anything that
// escapes the stage, overlaps a primary control, or overflows its own box.
//
//   node test/uxaudit.cjs
//
// AS WRITTEN IT IS TOO NAIVE TO TRUST. First run, most of what it reported was
// false: #fight-bg, #diorama, #ground and .hd-plane are full-bleed backgrounds and
// 3D planes that overflow the stage BY DESIGN, and "covers #btn-endturn" fires for
// every full-screen layer beneath it. Of everything it flagged, exactly one was
// real — .mn-label overflowing 5px, which is the known single-word overhang
// accepted in Build 297. Before this is worth running again it needs an
// allow-list of layers that are meant to bleed, and a z-order test so "covers"
// means "paints on top of", not "shares coordinates with". Two screens (tree,
// menu) never opened because the entry points were guessed, not looked up.
'use strict';
const { boot } = require('./harness.cjs');

(async () => {
  const t = await boot({ ux: 0 });
  const errs = []; t.page.on('pageerror', e => errs.push(e.message));
  await t.page.setViewportSize({ width: 1600, height: 720 });
  await t.page.emulateMedia({ reducedMotion: 'reduce' });
  await t.J(() => { try { localStorage.clear(); localStorage.setItem('kizuna2_1.tutorialSeen','1'); } catch(_){} });

  await t.J(() => {
    window.__audit = () => {
      const st = document.querySelector('#stage').getBoundingClientRect();
      const out = [];
      const seen = new Set();
      const CONTROLS = ['#btn-endturn', '#menu-btn', '#ep-cluster'];
      const ctl = CONTROLS.map(s => { const e = document.querySelector(s);
        return e && e.offsetParent !== null ? { s, r: e.getBoundingClientRect() } : null; }).filter(Boolean);
      document.querySelectorAll('#stage *').forEach(el => {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return;
        const r = el.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) return;
        const id = (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/)[0] : '');
        if (!id || seen.has(id)) return;
        // 1. escapes the stage
        const over = Math.max(st.left - r.left, r.right - st.right, st.top - r.top, r.bottom - st.bottom);
        if (over > 2) { seen.add(id); out.push(`OFFSTAGE ${Math.round(over)}px  ${id}`); return; }
        // 2. its text overflows its own box (the clipped-toast class of bug)
        if (el.scrollWidth > el.clientWidth + 4 && el.clientWidth > 0 && cs.overflow !== 'auto' && cs.overflowX !== 'auto') {
          seen.add(id); out.push(`TEXT OVERFLOWS by ${el.scrollWidth - el.clientWidth}px  ${id}`); return; }
        // 3. sits on top of a primary control
        for (const c of ctl) {
          if (el.closest(c.s)) continue;
          const ox = Math.min(r.right, c.r.right) - Math.max(r.left, c.r.left);
          const oy = Math.min(r.bottom, c.r.bottom) - Math.max(r.top, c.r.top);
          if (ox > 8 && oy > 8 && +cs.zIndex >= 0) { seen.add(id); out.push(`COVERS ${c.s} (${Math.round(ox)}x${Math.round(oy)}px)  ${id}`); return; }
        }
      });
      return out;
    };
    window.__party = ['ash','elin','mira'];
    window.__run = () => { RUN = newRun('ash'); RUN.roster = window.__party.slice(); RUN.active = RUN.roster.slice();
      RUN.hp = {}; RUN.active.forEach(h => RUN.hp[h] = HEROES[h].maxHp);
      RUN.nodes = ROTATION_GATES.slice(); RUN.completed = [0,1,2]; RUN.floor = 1;
      RUN.map = generateDescent(RUN.roster, 1); return true; };
  });

  const screens = [
    ['MAP',        () => { window.__run(); showMap(); }],
    ['EMBER TREE', () => { window.__run(); showTree(); }],
    ['FIGHT · turn open', () => { window.__run();
        startFight({ type:'fight', chapter:3, heroes:RUN.active.slice(), enemies:['husk','wraith','cultist'],
          useRunHp:true, floor:1, depth:3, narrator:'ux' }); renderAll(); }],
    ['FIGHT · mid-line', () => { const op = buildHand().find(c => c.kind === 'opener');
        S.tempCards = []; resolveChainPlay(op); renderAll(); }],
    ['FIGHT · lesson toast', () => { lesson('uxprobe',
        'ONE LINE, THE PARTY’S — the combo does not belong to a hero. Whoever answers answers for everyone, and the cards you did not play are gone.', 3); }],
    ['MENU',       () => { showGameMenu ? showGameMenu() : showMenu(); }],
  ];
  console.log('\n=== UX AUDIT · 1600x720 ===');
  for (const [name, fn] of screens) {
    try { await t.J(fn); } catch (e) { console.log(`\n${name}\n  (could not open: ${String(e).split('\n')[0]})`); continue; }
    await t.sleep(600);
    const found = await t.J(() => window.__audit());
    console.log(`\n${name}`);
    if (!found.length) console.log('  clean');
    else found.slice(0, 8).forEach(f => console.log('  ' + f));
  }
  console.log('\npage errors: ' + (errs.length ? errs.slice(0,3).join(' | ') : 'none'));
  await t.browser.close(); process.exit(0);
})();
