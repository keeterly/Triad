// PLAYTEST-PROLOGUE — walk the v2.2 opening the way a brand-new player meets
// it: title → NEW GAME → the nine prologue beats → the tutorial, tapping the
// real screen, photographing every beat.
//
// Deliberately not a meter. What it is looking for is whether the sequence
// READS: does the memory-city look like a place, does the Fallen loom, does
// "Rise." land as one word given the whole dark, does the title card arrive
// where a film would put it — and does control hand off to the game the
// player actually came for.
//
//   node test/playtest-prologue.cjs
//
// Shots land in test/shots/prologue-*.png
'use strict';
const { boot } = require('./harness.cjs');

(async () => {
  const t = await boot({ freshNarrative: true });
  const errs = []; t.page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await t.page.emulateMedia({ reducedMotion: 'reduce' });

  await t.J(() => { try { localStorage.removeItem('kizuna2_2.tutorialSeen'); } catch (_) {} showTitle(); });
  await t.sleep(400);
  await t.shot('prologue-0-title');

  await t.J(() => document.querySelector('#t-new').onclick());
  await t.sleep(600);

  // Photograph each beat once, at its first frame, then tap it through.
  const SHOT_OF = {
    PRO_000_LAST_MEMORY: 'prologue-1-memory-city',
    PRO_001_TRIO_ENGAGEMENT: 'prologue-2-engagement',
    PRO_002_FALLEN_HESITATES: 'prologue-3-hesitation',
    PRO_003_LIBERATION_STRIKE: 'prologue-4-strike',
    PRO_004_REBIRTH: 'prologue-5-water',
    PRO_005_RISE: 'prologue-6-rise',
    PRO_006_TITLE: 'prologue-7-titlecard',
    PRO_007_FIRST_ECHO: 'prologue-8-echo',
    PRO_008_ASCENT_BEGINS: 'prologue-9-ascend',
  };
  const taken = new Set();
  const log = [];
  for (let i = 0; i < 80; i++) {
    const st = await t.J(() => {
      const running = NARR_BEATS.find(b => b.id.indexOf('PRO_') === 0 && !narrDone(b.id));
      return {
        beat: running ? running.id : null,
        done: narrDone('PRO_008_ASCENT_BEGINS'),
        btn: !!document.querySelector('#nv-go'),
        tap: !!document.querySelector('.ov-tap'),
      };
    });
    if (st.done) break;
    if (st.beat && !taken.has(st.beat)) {
      taken.add(st.beat);
      await t.sleep(350);                     // let the scene's paint settle
      await t.shot(SHOT_OF[st.beat] || st.beat);
      log.push(st.beat);
    }
    if (st.btn) await t.J(() => document.querySelector('#nv-go').onclick({ stopPropagation: () => {} }));
    else if (st.tap) await t.J(() => { const ov = document.querySelector('#overlay'); if (ov && ov.onclick) ov.onclick(); });
    else await t.J(() => { const ov = document.querySelector('#overlay'); if (ov && ov.onclick) ov.onclick(); });
    await t.sleep(160);
  }
  await t.sleep(500);
  await t.shot('prologue-10-handoff');

  const end = await t.J(() => ({
    act: narrState().campaign.act,
    chapter: narrState().campaign.chapter,
    completed: narrState().events.completed.length,
    resonance: narrState().resonance.unlocked.join(','),
    tutorialUp: !!document.querySelector('#overlay.scene-landing'),
  }));
  console.log('\n=== PLAYTEST: the v2.2 prologue, tapped through the actual screen ===\n');
  log.forEach(b => console.log('  beat  ' + b));
  console.log(`\n  after: act ${end.act} · chapter ${end.chapter} · ${end.completed} events · resonance [${end.resonance}]`);
  console.log('  control handed to: ' + (end.tutorialUp ? 'the tutorial, staged at the bottom' : 'NOT the tutorial — LOOK AT THIS'));
  console.log('\npage errors: ' + (errs.length ? errs.join(' | ') : 'none'));
  console.log('shots: v2.2/test/shots/prologue-*.png');
  await t.browser.close(); process.exit(0);
})();
