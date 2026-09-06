'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// A BLOW IS THROWN AT SOMETHING, SO DOES THE BODY GO TO IT
// ═══════════════════════════════════════════════════════════════════════════
//
// Three things, and the third is the one that can fail for the right reason:
//
//   IT CROSSES GROUND on a swing — the root travels toward the foe rather
//   than carrying the four centimetres the clip's own footwork moves it.
//   IT COMES BACK — a step that does not return is a party slowly migrating
//   into the enemy line over the course of a fight.
//   AND ONLY A SWING DOES IT. A ward is a brace and a heal is a hand held
//   out; if those charge the enemy too then this is not a step, it is a
//   figure that moves whenever anything happens.
//
// ── ONE CARD PER FIGHT, AND THE FIGHT IS RESTARTED BETWEEN THEM ────────────
//
// A first cut played every case into the same turn. The second card found no
// AP and did not play at all, which reported as "a heal does not step" —
// perfectly true and no evidence whatever, since nothing happened. Worse, the
// figure was still out from the previous card when its home was sampled, so
// the return read as a failure to return. Whether the card PLAYED is now part
// of the reading, so a case that never ran cannot pass by silence.
//
// ── AND THE STEP IS READ WHERE IT IS SET, NOT WHERE THE BODY GOT TO ────────
//
// This browser draws at about two frames a second, so the slot ease runs with
// a dt of half a second and snaps to its mark in a single frame: a position
// sampled out here catches the travel at whatever fraction the sampler and the
// renderer happen to line up at, and a 0.62m step read as 0.222. The lunge
// vector is set at play time and is exactly what the ease walks toward, so it
// is the same fact with the frame rate taken out of it. The RETURN still has
// to be sampled, because that is a thing the ease does over time — but it is
// only asked to be home eventually, which survives a coarse clock.
const { boot } = require('./harness.cjs');

(async () => {
  const { J, sleep, browser, page } = await boot({ query: 'cast=3d' });
  page.on('pageerror', e => console.log('!! PAGE ERROR:', e.message));
  await sleep(600);

  const CASES = [
    { card: 'serrate', who: 'mira', verb: 'slash', wants: 'steps' },
    { card: 'mend',    who: 'elin', verb: 'heal',  wants: 'stands' },
  ];
  const rows = [];
  for (const c of CASES) {
    await J(() => startCombat({ foes: ['husk'] }));
    // …AND FOR THE FOE, not only for the attacker. The step is aimed at the
    // enemy, so a card played before the bestiary model arrives measures the
    // fallback rather than the swing — which is how a 3.1m run read as 0.34m.
    for (let i = 0; i < 40 && !(await J((w) => !!(window.Cast3D && window.Cast3D._figure(w)
        && window.Cast3D._figure('foe0')), c.who)); i++)
      await sleep(250);
    await sleep(700);
    const r = await J(({ card, who }) => {
      const f = window.Cast3D._figure(who);
      if (!f) return { err: 'no figure ' + who };
      const home = [f.root.position.x, f.root.position.z];
      // THE CARD IS PUT IN THE HAND RATHER THAN HOPED FOR. `mend` is not in
      // the opening deal, so asking for it simply did nothing and the run
      // reported "a heal does not step" — which was true, and was about a
      // heal that never happened.
      if (window.K.forceHand) window.K.forceHand([card, 'cleave', 'serrate', 'qthrow', 'frostbind']);
      const ap0 = window.K.state().ap;
      try { window.K.playCard(card); } catch (e) { return { err: e.message }; }
      const played = window.K.state().ap !== ap0;
      const L = f.lunge;
      window.__home = home;
      return { played, step: L ? +Math.hypot(L.x, L.z).toFixed(3) : 0 };
    }, c);
    if (r.err) { rows.push({ ...c, err: r.err }); continue; }
    // …and then long enough for a recovery to have finished
    let back = 9;
    for (let i = 0; i < 22; i++) {
      await sleep(160);
      back = await J((w) => {
        const f = window.Cast3D._figure(w), h = window.__home;
        return +Math.hypot(f.root.position.x - h[0], f.root.position.z - h[1]).toFixed(3);
      }, c.who);
      if (back < 0.05) break;
    }
    rows.push({ ...c, ...r, back });
  }

  console.log('');
  console.log('  ' + 'card'.padEnd(10) + 'verb'.padEnd(8) + 'played'.padStart(8)
    + 'step m'.padStart(9) + 'home after'.padStart(12) + '   wanted');
  for (const r of rows) {
    if (r.err) { console.log('  ' + r.card.padEnd(10) + 'ERR ' + r.err); continue; }
    console.log('  ' + r.card.padEnd(10) + r.verb.padEnd(8) + String(r.played).padStart(8)
      + r.step.toFixed(3).padStart(9) + r.back.toFixed(3).padStart(12) + '   ' + r.wants);
  }
  console.log('');
  console.log('  a card that did not play proves nothing either way');
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
