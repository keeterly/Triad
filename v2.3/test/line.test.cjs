// KIZUNA v2.3 — the LINE suite. More than one thing standing there.
//
// The rule this whole build turns on: A SMALL THING SWINGS AT ONE PLACE. It may
// swing several times; every blow lands on the same hero. Bosses keep their
// reach — a bar that crosses the party is what a boss IS — and that reads
// because a boss stands alone.
//
// Everything here is derived from the bestiary and the intent table rather than
// restated from them, so a re-tuned hand or a fourth foe is a change these
// checks follow rather than a change they fail.
'use strict';
const { boot } = require('./harness.cjs');

(async () => {
  const H = await boot({});
  const { J, check, report } = H;

  // ═══ A · ONE PLACE, ONE VOICE ═══
  console.log('\n── what a small thing may ask ──');
  {
    const hands = await J(() => {
      const out = { small: [], big: [] };
      for (const id of Object.keys(window.K.FOES)) {
        const F = window.K.FOES[id];
        window.K.startCombat({ seed: 5, foe: F });
        const c = window.K.state();
        const rows = c.foes[0].intents.filter(i => i.kind === 'attack').map(i => ({
          foe: id, intent: i.id,
          places: [...new Set(i.hits.map(h => h.row || h.target))].length,
          hits: i.hits.length,
          notes: i.hits.reduce((n, h) => n + h.notes.length, 0),
          byPlace: i.hits.every(h => !!h.row),
        }));
        (F.tier === 'fight' ? out.small : out.big).push(...rows);
      }
      return out;
    });
    check('LINE: every blow a small thing throws lands on ONE place',
      hands.small.length >= 6 && hands.small.every(r => r.places === 1),
      JSON.stringify(hands.small.filter(r => r.places !== 1).slice(0, 4))
        || hands.small.map(r => r.foe + '/' + r.intent).join(' '));
    // …and it says so as a PLACE, not a person: which hero eats it is the
    // player's answer, decided by where the party is standing.
    check('LINE: a small thing aims at a row, so who takes it is the party’s decision',
      hands.small.every(r => r.byPlace), JSON.stringify(hands.small.filter(r => !r.byPlace)));
    // A BOSS KEEPS ITS REACH. If every intent in the game hit one place, the
    // Regent would be a large Husk.
    check('LINE: an elite or a boss still crosses the party',
      hands.big.some(r => r.places >= 2),
      JSON.stringify(hands.big.map(r => r.foe + '/' + r.intent + ':' + r.places)));
    // …and a small thing is still allowed to swing more than once.
    check('LINE: swinging twice at one person is still allowed — it is aiming twice that is not',
      hands.small.some(r => r.notes >= 2), JSON.stringify(hands.small.map(r => r.intent + ':' + r.notes)));
  }

  // ═══ B · THE COMPOSED BAR ═══
  console.log('\n── one bar, however many voices ──');
  {
    const pack = await J(() => {
      window.K.startCombat({ seed: 5, foes: ['husk', 'husk', 'cultist'] });
      const c = window.K.state();
      const turns = [];
      for (let t = 0; t < 6; t++) {
        const V = window.K._composeVolley();
        turns.push({ notes: V.notes, voices: V.hits.length,
                     rows: V.hits.map(h => h.resolvedRow),
                     held: V.held.length,
                     acting: V.acting.filter(a => !a.canceled).length });
        c.foes.filter(f => !f.dead).forEach(F => { F.intentIx = (F.intentIx + 1) % F.intents.length; });
      }
      return { turns, cap: window.K.VOLLEY_NOTES, line: c.foes.length };
    });
    check('LINE: no hero is ever asked to answer two creatures in one bar',
      pack.turns.every(t => new Set(t.rows).size === t.rows.length),
      JSON.stringify(pack.turns.map(t => t.rows.join('/'))));
    // THE BACKSTOP. The heaviest bar in the game is the Regent's Crescendo;
    // no ordinary fight may out-throw the final boss.
    const heaviest = await J(() => {
      let n = 0;
      for (const it of window.K.currentIntentTable())
        n = Math.max(n, it.hits.reduce((a, h) => a + h.notes.length, 0));
      return n;
    });
    check('LINE: a composed bar never out-throws the hardest single bar in the game',
      pack.cap === heaviest && pack.turns.every(t => t.notes <= pack.cap),
      JSON.stringify({ cap: pack.cap, heaviest, notes: pack.turns.map(t => t.notes) }));
    // A LINE OF THREE FILLS THE BOARD. If the composition were quietly
    // dropping voices, every turn would read as a solo fight with extra HP.
    check('LINE: three creatures really do all get to swing',
      pack.turns.some(t => t.voices === 3), JSON.stringify(pack.turns.map(t => t.voices)));
  }

  // ═══ C · A PACK IS ONE ENCOUNTER ═══
  console.log('\n── the weight of a line ──');
  {
    const weight = await J(() => {
      const read = (opts) => { window.K.startCombat(Object.assign({ seed: 5 }, opts));
        const c = window.K.state();
        return { hp: c.foes.reduce((n, f) => n + f.max, 0), n: c.foes.length,
                 each: c.foes.map(f => f.max), brk: c.foes.map(f => f.breakMax) }; };
      return { solo: read({ foe: window.K.FOES.husk }),
               two: read({ foes: ['husk', 'husk'] }),
               three: read({ foes: ['husk', 'husk', 'husk'] }) };
    });
    check('LINE: a pack shares one encounter’s health rather than multiplying it',
      Math.abs(weight.two.hp - weight.solo.hp) <= 2 && Math.abs(weight.three.hp - weight.solo.hp) <= 3,
      JSON.stringify(weight));
    // …AND EVERY BODY IS STILL BREAKABLE. A pack member you cannot stagger
    // inside its own short life is one that Break does nothing to.
    check('LINE: every body in a line can still be staggered',
      weight.three.brk.every(b => b >= 4), JSON.stringify(weight.three.brk));
  }

  // ═══ D · THE FIGHT ENDS WHEN THE LINE DOES ═══
  console.log('\n── killing things ──');
  {
    const run = await J(async () => {
      window.K.startCombat({ seed: 5, foes: ['husk', 'husk', 'cultist'] });
      const c = window.K.state();
      const seen = [];
      for (let t = 0; t < 20 && c.phase !== 'VICTORY' && c.phase !== 'DEFEAT'; t++) {
        // heal the party each turn: this measures the LINE, not the parry
        Object.keys(c.heroes).forEach(id => { c.heroes[id].hp = c.heroes[id].max; c.heroes[id].downed = false; });
        window.K._deal(40, 'hit', 'ash');
        seen.push({ alive: c.foes.filter(f => !f.dead).length,
                    voices: c.phase === 'VICTORY' ? 0 : window.K._composeVolley().hits.length,
                    // …and resting on a corpse is only wrong while something
                    // is still standing. When the last one falls there is
                    // nothing left to point at, and that is the fight ending.
                    aim: c.aim,
                    aimDead: !!c.foes[c.aim].dead && c.foes.some(f => !f.dead) });
        if (c.phase === 'VICTORY' || c.phase === 'DEFEAT') break;
        await window.K.endTurn({ grades: [] });
      }
      return { phase: c.phase, seen, dead: c.foes.filter(f => f.dead).length,
               felled: (c.deeds && c.deeds.felled) || [] };
    });
    check('LINE: the fight ends when the LAST body falls, not the first',
      run.phase === 'VICTORY' && run.dead === 3 && run.seen.some(s => s.alive === 2),
      JSON.stringify({ phase: run.phase, dead: run.dead, alive: run.seen.map(s => s.alive) }));
    // THE POINT OF THE WHOLE FEATURE. Killing something is not an abstract step
    // toward winning — it is the next bar being shorter.
    const voices = run.seen.map(s => s.voices).filter(v => v > 0);
    check('LINE: the bar gets shorter as the line does — a kill is felt, not just counted',
      voices.length >= 2 && voices[voices.length - 1] < voices[0],
      JSON.stringify(voices));
    check('LINE: the aim never sits on a corpse',
      run.seen.every(s => !s.aimDead), JSON.stringify(run.seen.map(s => s.aim + (s.aimDead ? '!' : ''))));
    check('LINE: the fight reports everything it put down, not just the one the stop was named for',
      run.felled.length === 3, JSON.stringify(run.felled));
  }

  // ═══ E · WHAT THE SKY PROMISES ═══
  console.log('\n── the telegraph ──');
  {
    const sky = await J(() => {
      window.K.startCombat({ seed: 5, foes: ['husk', 'husk', 'cultist'] });
      const c = window.K.state();
      const V = window.K._composeVolley();
      const rows = window.K.intentByTarget();
      return { promised: rows.map(r => r.who + '=' + r.total),
               people: rows.length, voices: V.hits.length,
               dirge: window.K.dirgeAmount(),
               each: c.foes.map(f => f.def.dirge) };
    });
    check('LINE: the sky promises one number per person, and one per voice',
      sky.people === sky.voices && sky.promised.every(p => +p.split('=')[1] > 0),
      JSON.stringify(sky.promised));
    // THE DIRGE IS THE ROOM, NOT A CREATURE. It is the half of the fight skill
    // cannot answer; three of them would be tripling the part the player does
    // not get to play.
    check('LINE: the line sings ONE dirge — the heaviest voice in it, not the sum',
      sky.dirge === Math.max(...sky.each) && sky.dirge < sky.each.reduce((a, b) => a + b, 0),
      JSON.stringify({ dirge: sky.dirge, each: sky.each }));
  }

  // ═══ F · A FIGHT AGAINST ONE THING IS UNCHANGED ═══
  console.log('\n── a line of one ──');
  {
    const solo = await J(() => {
      window.K.startCombat({ seed: 5, foe: window.K.FOES.mourner });
      const c = window.K.state();
      const V = window.K._composeVolley();
      return { foes: c.foes.length, aim: c.aim,
               bossIsFoe: c.boss === c.foes[0], hp: c.boss.hp, max: c.boss.max,
               strip: !!document.querySelector('.k-line-strip'),
               marks: document.querySelectorAll('.k-foe-aimed').length,
               extras: document.querySelectorAll('#k-cast .k-foe-art[data-ix]').length,
               voices: V.hits.length, held: V.held.length };
    });
    check('LINE: one opponent is a line of one — same health, no strip, no reticle, no extra bodies',
      solo.foes === 1 && solo.aim === 0 && solo.hp === solo.max && solo.max === 168
      && !solo.strip && solo.marks === 0 && solo.extras === 0,
      JSON.stringify(solo));
    check('LINE: …and the Regent still throws her whole bar at the party',
      solo.voices >= 2 && solo.held === 0, JSON.stringify({ voices: solo.voices, held: solo.held }));
  }

  // ═══ G · THE FIELD SAYS WHAT THE READOUT SAYS ═══
  console.log('\n── the line on screen ──');
  {
    const seen = await J(() => {
      window.K.startCombat({ seed: 5, foes: ['husk', 'husk', 'cultist'] });
      const cast = document.getElementById('k-cast');
      const bodies = [...document.querySelectorAll('#k-boss-art, #k-cast .k-foe-art')];
      return { line: cast.dataset.line,
               bodies: bodies.length,
               ix: bodies.map(b => b.dataset.ix),
               art: bodies.map(b => (b.querySelector('img') || {}).getAttribute
                 ? b.querySelector('img').getAttribute('src') : null),
               rows: document.querySelectorAll('.k-line-strip .k-lrow').length,
               aimed: document.querySelectorAll('.k-foe-aimed').length };
    });
    check('LINE: every body is on the field, wearing its own painting',
      seen.bodies === 3 && seen.line === '3' && seen.ix.join() === '0,1,2'
      && new Set(seen.art).size === 2 && seen.art.every(a => a && a.indexOf('foe-') >= 0),
      JSON.stringify(seen));
    check('LINE: the readout carries a row per body, and exactly one is aimed',
      seen.rows === 3 && seen.aimed === 1, JSON.stringify({ rows: seen.rows, aimed: seen.aimed }));

    const aimed = await J(() => {
      const before = window.K.state().aim;
      window.K.aimAt(2);
      const c = window.K.state();
      return { before, after: c.aim, boss: c.boss.id, name: c.boss.name,
               plate: document.querySelector('#k-boss-hud .k-bname').textContent.trim(),
               hp: +document.getElementById('k-bhp').textContent,
               onRow: document.querySelectorAll('.k-lrow-on').length,
               mark: (document.querySelector('.k-foe-aimed') || {}).dataset };
    });
    check('LINE: aiming moves the plate, the reticle and the readout together',
      aimed.after === 2 && aimed.boss === 'cultist' && aimed.plate.indexOf('Choir') >= 0
      && aimed.onRow === 1 && aimed.mark && +aimed.mark.ix === 2,
      JSON.stringify(aimed));

    const lands = await J(() => {
      const c = window.K.state();
      const before = c.foes.map(f => f.hp);
      window.K._deal(9, 'hit', 'ash');
      return { before, after: c.foes.map(f => f.hp), aim: c.aim };
    });
    check('LINE: a card lands on what you are aimed at, and on nothing else',
      lands.after[2] < lands.before[2]
      && lands.after[0] === lands.before[0] && lands.after[1] === lands.before[1],
      JSON.stringify(lands));
  }


  // ═══ H · THREE PLACES ON THEIR SIDE TOO ═══
  // The party has stood in FRONT / MID / BACK since Build 20 and the things it
  // fought had nowhere at all. Build 99 gave a small foe a lane to SWING at,
  // decided by an allocation rule; Build 101 gives it a lane to STAND in, and
  // the swing follows from where it is. The effect is nearly the same and the
  // cause is now on the screen: two Husks both wanting the front used to mean
  // the second was silently reassigned, and "why is this one hitting Mira?"
  // had no answer anywhere in the game.
  console.log('\n── where a thing stands ──');
  {
    const slots = await J(() => {
      window.K.startCombat({ seed: 5, foes: ['husk', 'cultist', 'wraith'] });
      const c = window.K.state();
      const V = window.K._composeVolley();
      return { rows: c.foes.map(f => f.row),
               places: window.K.ROWS,
               // every blow comes down the lane its thrower stands in
               lanes: V.hits.map(h => ({ src: h.src, from: c.foes[h.src].row, to: h.resolvedRow })),
               hp: c.foes.map(f => f.hp) };
    });
    check('SLOTS: the line stands in the same three places the party does, one to a place',
      slots.rows.join() === slots.places.join()
      && new Set(slots.rows).size === slots.rows.length,
      JSON.stringify(slots.rows));
    check('SLOTS: a blow comes down the lane its thrower is standing in',
      slots.lanes.length === 3 && slots.lanes.every(l => l.from === l.to),
      JSON.stringify(slots.lanes));
    // …AND EACH BODY KEEPS ITS OWN HEALTH. Three bars, three numbers, three
    // things to kill in whatever order the player likes.
    check('SLOTS: every body carries its own health',
      new Set(slots.hp).size >= 2 && slots.hp.every(h => h > 0), JSON.stringify(slots.hp));

    // THREE PLACES MEANS AT MOST THREE THINGS. A fourth would have nowhere to
    // stand and would have to share a lane, which is the exact ambiguity the
    // slots exist to remove.
    const four = await J(() => {
      window.K.startCombat({ seed: 5, foes: ['husk', 'husk', 'husk', 'husk'] });
      const c = window.K.state();
      return { n: c.foes.length, rows: c.foes.map(f => f.row) };
    });
    check('SLOTS: a line never holds more things than there are places to stand',
      four.n === slots.places.length && new Set(four.rows).size === four.n,
      JSON.stringify(four));

    // MOVING A HERO CHANGES WHO ANSWERS WHAT. This is the whole point of giving
    // the line slots: the board decision the game already asks every turn now
    // decides the matchups, and it does so visibly.
    const swapped = await J(() => {
      window.K.startCombat({ seed: 5, foes: ['husk', 'cultist', 'wraith'] });
      const c = window.K.state();
      const before = window.K.intentByTarget().map(r => r.who + ':' + r.total);
      const front = Object.keys(c.heroes).find(id => c.heroes[id].row === 'front');
      const back = Object.keys(c.heroes).find(id => c.heroes[id].row === 'back');
      window.K.placeHero(front, 'back');
      const after = window.K.intentByTarget().map(r => r.who + ':' + r.total);
      return { front, back, before, after,
               frontNow: c.heroes[front].row, backNow: c.heroes[back].row };
    });
    check('SLOTS: trading places trades who answers which of them',
      swapped.frontNow === 'back' && swapped.backNow === 'front'
      && swapped.before.join() !== swapped.after.join(),
      JSON.stringify(swapped));

    // AND IT IS ON THE FLOOR, not only in a table. A body is placed by the slot
    // it stands in, so the field and the rule agree by construction.
    const drawn = await J(() => {
      window.K.startCombat({ seed: 5, foes: ['husk', 'cultist', 'wraith'] });
      const S = document.getElementById('k-stage').getBoundingClientRect();
      const at = (el) => { const r = el.getBoundingClientRect();
        return { cx: Math.round(r.left + r.width / 2 - S.left),
                 base: Math.round(r.top + r.height - S.top), w: Math.round(r.width) }; };
      const foes = [...document.querySelectorAll('#k-boss-art, #k-cast .k-foe-art')]
        .map(b => ({ row: b.dataset.row, lane: (b.querySelector('.k-foe-lane') || {}).textContent, ...at(b) }));
      const heroes = {};
      document.querySelectorAll('.k-hero').forEach(h => {
        heroes[window.K.state().heroes[h.dataset.hero].row] = at(h);
      });
      return { foes, heroes, stage: Math.round(S.width) };
    });
    const F = {}; drawn.foes.forEach(f => { F[f.row] = f; });
    check('SLOTS: every body is drawn in its own slot, wearing the floor’s own word for it',
      drawn.foes.length === 3 && ['front', 'mid', 'back'].every(r => !!F[r])
      && F.front.lane === 'FRONT' && F.mid.lane === 'MID' && F.back.lane === 'BACK',
      JSON.stringify(drawn.foes.map(f => f.row + '=' + f.lane)));
    // ONE FLOOR, NOT TWO DRAWINGS — and the claim is that the two ladders are
    // PARALLEL, not that a rank lands on the same pixel as its opposite number.
    //
    // The first version asserted the second thing: each foe's ground line
    // within 12px of the hero standing opposite. It passed until Build 102
    // swapped the hero art, whose different aspect ratios nudged the party's
    // measured baselines a few pixels — and a check that a change of ARTWORK
    // can break was never measuring the geometry it claimed to.
    //
    // What the design actually says is that a rank STEPS the same distance on
    // whichever side of the board it is on: the party rises 26 then 23 between
    // its ranks, and the line rises 25 then 22. That is the ladder, and it
    // holds under a global nudge the way a real floor does.
    const step = (a, b) => a.base - b.base;
    const partyStep = [step(drawn.heroes.front, drawn.heroes.mid),
                       step(drawn.heroes.mid, drawn.heroes.back)];
    const lineStep = [step(F.front, F.mid), step(F.mid, F.back)];
    check('SLOTS: the line recedes on the party’s own ladder, and stays on the stage',
      F.front.cx < F.mid.cx && F.mid.cx < F.back.cx
      && F.front.w > F.mid.w && F.mid.w > F.back.w
      && lineStep.every(n => n > 0) && partyStep.every(n => n > 0)
      && lineStep.every((n, i) => Math.abs(n - partyStep[i]) <= 8)
      && F.back.cx + F.back.w / 2 <= drawn.stage,
      JSON.stringify({ foes: drawn.foes.map(f => f.row + ':' + f.cx + '/' + f.base + '/' + f.w),
                       partyStep, lineStep, stage: drawn.stage }));
  }

  // ═══ I · THE CARD NAMES WHAT IT HITS ═══
  console.log('\n── which one ──');
  {
    // "ENEMY — ONE ANSWER, THE FOE" WAS TRUE WHEN THERE WAS ONE FOE. Both ways
    // of playing an attack offered exactly one target, `#k-boss-art`, so every
    // blow in a pack fight landed on whichever creature `C.aim` happened to be
    // — and the aim could only be moved by separately tapping a body or a
    // readout row, which nothing on the screen announces. A player with a card
    // in their hand, pointing at a creature, should hit that creature.
    const aim = await J(() => {
      window.K.startCombat({ seed: 5, foes: ['husk', 'cultist', 'wraith'] });
      window.K.forceHand(['cleave', 'serrate', 'mend', 'qthrow', 'frostbind']);
      window.K.render();
      const btn = document.querySelector('.k-card[data-card="cleave"]');
      btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
      btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }));
      const rets = [...document.querySelectorAll('#k-pick .k-pk-ret')];
      const before = window.K.state().foes.map(f => f.hp);
      // press the arc drawn over the LAST creature — the one furthest from the
      // aim, so a fall-through to `C.aim` cannot pass by accident
      rets[rets.length - 1].dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, pointerId: 2 }));
      const after = window.K.state().foes.map(f => f.hp);
      return { arcs: rets.length, before, after, aim: window.K.state().aim,
               moved: before.map((v, i) => v - after[i]) };
    });
    check('AIM: an attack draws an arc to every living creature, not one to the first',
      aim.arcs === 3, JSON.stringify({ arcs: aim.arcs }));
    check('AIM: the arc the player presses is the creature that takes the blow',
      aim.moved[0] === 0 && aim.moved[1] === 0 && aim.moved[2] > 0 && aim.aim === 2,
      JSON.stringify(aim));

    // …AND THE SAME IS TRUE OF THE DRAG, which is the gesture the game teaches
    // first. Only `#k-boss-art` was a drop zone, so dragging an attack at the
    // second or third creature snapped back to the first and the card went
    // where the aim already was — the drag saying otherwise the whole way down.
    const drops = await J(() => {
      window.K.startCombat({ seed: 5, foes: ['husk', 'cultist', 'wraith'] });
      window.K.forceHand(['cleave', 'serrate', 'mend', 'qthrow', 'frostbind']);
      window.K.render();
      return [0, 1, 2].map(ix => {
        const b = ix ? document.querySelector('#k-cast .k-foe-art[data-ix="' + ix + '"]')
                     : document.getElementById('k-boss-art');
        const r2 = b.getBoundingClientRect();
        const t = window.K.dropTargetAt(r2.left + r2.width / 2, r2.top + r2.height / 2, 'cleave');
        return t ? { zone: t.zone, foe: t.foe == null ? 0 : t.foe } : null;
      });
    });
    check('AIM: dropping a card on a body targets THAT body — every one of them is a drop zone',
      drops.every((d, i) => d && d.zone === 'enemy' && d.foe === i),
      JSON.stringify(drops));

    // A FIGHT AGAINST ONE THING IS UNCHANGED: one arc, one zone, and no
    // decision the player did not have before.
    const solo = await J(() => {
      window.K.startCombat({ seed: 5 });
      window.K.forceHand(['cleave', 'serrate', 'mend', 'qthrow', 'frostbind']);
      window.K.render();
      const btn = document.querySelector('.k-card[data-card="cleave"]');
      btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 3 }));
      btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 3 }));
      const n = document.querySelectorAll('#k-pick .k-pk-ret').length;
      const b = document.getElementById('k-boss-art').getBoundingClientRect();
      const t = window.K.dropTargetAt(b.left + b.width / 2, b.top + b.height / 2, 'cleave');
      return { arcs: n, zone: t && t.zone, foes: window.K.state().foes.length };
    });
    check('AIM: one creature is still one answer — a solo fight asks nothing new',
      solo.foes === 1 && solo.arcs === 1 && solo.zone === 'enemy', JSON.stringify(solo));
  }

  const r = report();
  await H.browser.close();
  process.exit(r.passed === r.total && r.errs === 0 ? 0 : 1);
})();
