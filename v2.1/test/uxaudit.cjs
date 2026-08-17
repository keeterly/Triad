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
  // A MOBILE GAME AUDITED AT A PHONE. The reporting screenshots are ~2.26:1
  // landscape, which is where the hand is tightest and text has least room.
  await t.page.setViewportSize({ width: 880, height: 390 });
  await t.page.emulateMedia({ reducedMotion: 'reduce' });
  await t.J(() => { try { localStorage.clear(); localStorage.setItem('kizuna2_1.tutorialSeen','1'); } catch(_){} });

  await t.J(() => {
    window.__audit = () => {
      const st = document.querySelector('#stage').getBoundingClientRect();
      const out = [];
      const seen = new Set();
      const CONTROLS = ['#btn-endturn', '#menu-btn', '#ep-cluster'];
      // MEANT TO BLEED. Backgrounds, ground planes and full-screen layers overflow
      // the stage by design; flagging them buried the one real finding last time.
      const BLEED = /^(#fight-bg|#diorama|#battlefield|#ground|#stage-scale|#popup-layer|#overlay|#party-half|#enemy-half|#thread-layer|#action-bar|#topbar|\.hd-|\.pr-|\.bg-|\.fx-)/;
      const ctl = CONTROLS.map(s => { const e = document.querySelector(s);
        return e && e.offsetParent !== null ? { s, r: e.getBoundingClientRect() } : null; }).filter(Boolean);
      // AUDIT WHAT IS ON TOP. An overlay screen paints over a live fight, and the
      // fight's DOM stays mounted underneath — so scanning #stage reported the
      // battle's geometry for the menu, the journal, party select and the camp,
      // four screens that therefore never got audited at all. When an overlay is
      // up, IT is the screen; everything under it is not being looked at.
      const ov = document.querySelector('#overlay');
      const root = (ov && !ov.classList.contains('hidden') && ov.offsetParent !== null) ? ov : document.querySelector('#stage');
      root.querySelectorAll('*').forEach(el => {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return;
        const r = el.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) return;
        const id = (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/)[0] : '');
        if (!id || seen.has(id) || BLEED.test(id)) return;
        // 1. escapes the stage
        const over = Math.max(st.left - r.left, r.right - st.right, st.top - r.top, r.bottom - st.bottom);
        if (over > 2) { seen.add(id); out.push(`OFFSTAGE ${Math.round(over)}px  ${id}`); return; }
        // 2. its text overflows its own box (the clipped-toast class of bug)
        if (el.scrollWidth > el.clientWidth + 4 && el.clientWidth > 0 && cs.overflow !== 'auto' && cs.overflowX !== 'auto') {
          seen.add(id); out.push(`TEXT OVERFLOWS by ${el.scrollWidth - el.clientWidth}px  ${id}`); return; }
        // 3. sits on top of a primary control
        // COVERS means the browser would hand the TAP to this element instead of
        // the control — not merely that the two share coordinates.
        for (const c of ctl) {
          if (el.closest(c.s)) continue;
          if (root.id === 'overlay') continue;   // an overlay covering the fight is the POINT, not a bug
          const cx = c.r.left + c.r.width / 2, cy = c.r.top + c.r.height / 2;
          if (cx < r.left || cx > r.right || cy < r.top || cy > r.bottom) continue;
          const hit = document.elementFromPoint(cx, cy);
          if (hit && (hit === el || el.contains(hit)) && !hit.closest(c.s)) {
            seen.add(id); out.push(`STEALS THE TAP on ${c.s}  ${id}`); return; }
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
    ['EMBER TREE', () => { window.__run(); showEmberTree(showMap, 'ash'); }],
    ['FIGHT · turn open', () => { window.__run();
        startFight({ type:'fight', chapter:3, heroes:RUN.active.slice(), enemies:['husk','wraith','cultist'],
          useRunHp:true, floor:1, depth:3, narrator:'ux' }); renderAll(); }],
    ['FIGHT · mid-line', () => { const op = buildHand().find(c => c.kind === 'opener');
        S.tempCards = []; resolveChainPlay(op); renderAll(); }],
    ['FIGHT · lesson toast', () => { lesson('uxprobe',
        'ONE LINE, THE PARTY’S — the combo does not belong to a hero. Whoever answers answers for everyone, and the cards you did not play are gone.', 3); }],
    ['MENU',       () => { showMenu(); }],
    ['JOURNAL',    () => { showJournal(showMap); }],
    ['PARTY SELECT', () => { window.__run(); showPartySelect(showMap); }],
    ['CAMP',       () => { window.__run(); showCamp(RUN.map.find(n => n.type === 'camp') || { type:'camp' }); }],
  ];
  console.log('\n=== UX AUDIT · 880x390 (phone landscape) ===');
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
