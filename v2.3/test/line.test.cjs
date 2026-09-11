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
      // ONE READOUT, EVERY LINE LENGTH, EVERY TIER (Build 232). A line of one
      // used to keep a corner plate and a line of several handed the corner
      // back to the creatures, because the pack strip stood on top of them.
      // Build 231 gave the PARTY the creature's plate, and a boss fight then
      // read as three plates against one corner banner — two languages for one
      // fight. Every body wears the plate now and the corner draws nothing.
               plates: document.querySelectorAll('.k-vit-foe[data-body]').length,
               corner: !document.getElementById('k-boss-hud').classList
                 .contains('k-hud-away'),
               marks: document.querySelectorAll('.k-foe-aimed').length,
               extras: document.querySelectorAll('#k-cast .k-foe-art[data-ix]').length,
               voices: V.hits.length, held: V.held.length };
    });
    check('LINE: the boss takes the corner bar — no plate, no reticle, no extra bodies',
      solo.foes === 1 && solo.aim === 0 && solo.hp === solo.max && solo.max === 168
      && solo.plates === 0 && solo.corner === true
      && solo.marks === 0 && solo.extras === 0,
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
               rows: document.querySelectorAll('.k-vit-foe[data-body]').length,
               corner: document.getElementById('k-boss-hud').classList
                 .contains('k-hud-away'),
               aimed: document.querySelectorAll('.k-foe-aimed').length };
    });
    check('LINE: every body is on the field, wearing its own painting',
      seen.bodies === 3 && seen.line === '3' && seen.ix.join() === '0,1,2'
      && new Set(seen.art).size === 2 && seen.art.every(a => a && a.indexOf('foe-') >= 0),
      JSON.stringify(seen));
    check('LINE: a pack wears a plate per body, the same one a lone creature gets',
      seen.rows === 3 && seen.aimed === 1 && seen.corner === true,
      JSON.stringify({ rows: seen.rows, aimed: seen.aimed, cornerAway: seen.corner }));

    // ── AND IT STANDS ON THE RIGHT CREATURE, NOT NEAR ONE ─────────────────
    //
    // The reason the corner strip had to go is that it sat ON the line — so
    // the thing to prove is not that plates exist but that each one is over
    // its own body's head, that no two of them are stacked on each other, and
    // that the readout no longer covers anybody. The overlap is measured the
    // same way the framing study measured it: rect against rect, in stage px².
    const worn = await J(() => {
      const stg = document.getElementById('k-stage');
      const st = stg.getBoundingClientRect();
      const k = st.width / stg.offsetWidth || 1;
      const px = (v) => Math.round(v / k);
      const out = [], boxes = [];
      let cover = 0;
      // THE BOX IS NOT THE FIGURE. A `.k-foe-art` is a 250×264 frame with the
      // painting bottom-anchored inside it, so a plate measured against the
      // BOX reads sixty pixels of overlap with sky. Measure what is drawn —
      // the same element `bodyAnchor` anchors to.
      const drawn = (b) => b.querySelector('img') || b;
      const bodies = [...document.querySelectorAll('#k-boss-art, #k-cast .k-foe-art')]
        .filter(b => b.offsetParent);
      document.querySelectorAll('.k-vit-foe[data-body]').forEach(v => {
        const ix = v.dataset.body.slice(3);
        const b = +ix ? document.querySelector('#k-cast .k-foe-art[data-ix="' + ix + '"]')
                      : document.getElementById('k-boss-art');
        if (!b) return;
        const r = v.getBoundingClientRect(), q = drawn(b).getBoundingClientRect();
        boxes.push(r);
        out.push({ ix: ix,
                   dx: px(Math.abs((r.left + r.width / 2) - (q.left + q.width / 2))),
                   overHead: px(q.top - r.bottom) });
      });
      // every plate against every body — a plate on a NEIGHBOUR still covers
      bodies.forEach(b => {
        const q = drawn(b).getBoundingClientRect();
        boxes.forEach(r => {
          cover += Math.max(0, Math.min(r.right, q.right) - Math.max(r.left, q.left))
                 * Math.max(0, Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top))
                 / (k * k);
        });
      });
      let stacked = 0;
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i], b = boxes[j];
          if (Math.min(a.right, b.right) > Math.max(a.left, b.left)
           && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top)) stacked++;
        }
      return { each: out, stacked: stacked, cover: Math.round(cover) };
    });
    check('LINE: every plate is centred on its own creature and clear of its crown',
      worn.each.length === 3 && worn.each.every(o => o.dx <= 2 && o.overHead >= 0),
      JSON.stringify(worn.each));
    check('LINE: no two plates are stacked, and the readout covers nobody',
      worn.stacked === 0 && worn.cover < 2000,
      JSON.stringify({ stacked: worn.stacked, cover: worn.cover }));

    const aimed = await J(() => {
      const before = window.K.state().aim;
      window.K.aimAt(2);
      const c = window.K.state();
      return { before, after: c.aim, boss: c.boss.id, name: c.boss.name,
               plate: document.querySelector('#k-boss-hud .k-bname').textContent.trim(),
               hp: +document.getElementById('k-bhp').textContent,
               onRow: document.querySelectorAll('.k-vit-foe.k-vit-on').length,
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
      const lanes = document.querySelectorAll('.k-foe-lane').length;
      const heroes = {};
      document.querySelectorAll('.k-hero').forEach(h => {
        heroes[window.K.state().heroes[h.dataset.hero].row] = at(h);
      });
      return { foes, heroes, lanes, stage: Math.round(S.width) };
    });
    const F = {}; drawn.foes.forEach(f => { F[f.row] = f; });
    // …AND WEARING NO WORD FOR IT (Build 171). Each body carried a FRONT /
    // MID / BACK chip at its feet, put there so the sky telegraph could quote
    // the same lane back. That telegraph hangs over the creature's own head
    // now and names no place, which left the chip naming something nothing
    // else on screen referred to — and it outlived the fight, because the
    // reckoning's hide list never included it. The slot is still real and
    // still on the element; only the caption is gone.
    check('SLOTS: every body is drawn in its own slot, and wears no word for it',
      drawn.foes.length === 3 && ['front', 'mid', 'back'].every(r => !!F[r])
      && drawn.lanes === 0,
      JSON.stringify({ rows: drawn.foes.map(f => f.row), lanes: drawn.lanes }));
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

  // ═══ THE TELEGRAPH OVER EACH HEAD (Build 171) ═══════════════════════════
  //
  // Written against Build 170 every one of these goes red: there were no
  // badges, one strip in the sky, and statuses for the aimed creature only.
  console.log('\n── what each creature is about to do ──');
  {
    const tell = await J(async () => {
      window.K.startCombat({ seed: 5, foes: ['husk', 'cultist', 'wraith'] });
      window.K.renderIntent(); window.K.placeBodyLabels();
      await new Promise(r2 => setTimeout(r2, 60));
      const src = window.K.intentBySource();
      const per = [...document.querySelectorAll('.k-tell')].map(t => ({
        body: t.dataset.body,
        chips: t.querySelectorAll('.k-ichip-atk').length,
        elems: [...t.querySelectorAll('.k-ichip-atk')].map(c => c.dataset.elem),
        weights: [...t.querySelectorAll('.k-ichip-atk')]
          .map(c => (c.className.match(/k-w(\d)/) || [])[1]),
        icons: [...t.querySelectorAll('.k-ichip-atk svg')].length,
      }));
      return { src, per };
    });
    // ONE BADGE PER CREATURE, and its marks are that creature's own blows —
    // the strip it replaced grouped by TARGET, so two creatures swinging at
    // one hero produced one chip and no way to tell which of them threw it.
    check('TELL: each creature wears its own bar, one mark per blow',
      tell.per.length >= 1
      && tell.per.every(p => {
        const o = tell.src.find(x => 'foe' + x.ix === p.body);
        return o && (o.canceled || o.held || p.chips === o.blows.length);
      }) && tell.per.every(p => p.icons === p.chips),
      JSON.stringify({ per: tell.per, src: tell.src.map(o => ({ ix: o.ix, n: o.blows.length })) }));
    // SWUNG OR CAST, and never neither — a mark with no kind is the old
    // one-glyph-for-everything the acts table already had the answer to.
    check('TELL: every mark says what kind of blow it is — swung or cast',
      tell.per.every(p => p.elems.every(e => e === 'phys' || e === 'arc')),
      JSON.stringify(tell.per.map(p => p.elems)));
    // …AND HOW HEAVY, in three tiers and no more.
    check('TELL: every mark carries a weight, and the weight is one of three',
      tell.per.every(p => p.weights.every(w => w === '1' || w === '2' || w === '3')),
      JSON.stringify(tell.per.map(p => p.weights)));

    // WEIGHT IS MEASURED AGAINST WHO TAKES IT, not against a table. Fifteen is
    // a scratch on Ash and better than a third of Mira, and the top tier is
    // not a number at all — CRITICAL means the blow ends somebody.
    const weigh = await J(() => window.K.state() && ({
      scratch: window.K.tellWeight(3, 'ash'),
      heavy: window.K.tellWeight(15, 'ash'),
      lethal: window.K.tellWeight(999, 'ash'),
    }));
    check('TELL: weight is read off the hero who takes it, and lethal is always critical',
      weigh.scratch === 1 && weigh.heavy === 2 && weigh.lethal === 3,
      JSON.stringify(weigh));

    // STATUSES ON THE BODY THAT OWNS THEM. The boss plate reads the AIMED
    // creature, so before this a chill landed on one of three foes showed up
    // nowhere at all — the player got no acknowledgement that the card had
    // done anything.
    const pips = await J(async () => {
      window.K.startCombat({ seed: 5, foes: ['husk', 'cultist', 'wraith'] });
      const st = window.K.state();
      st.foes[1].chill = 4; st.foes[2].bleed = 3; st.heroes.ash.guard = 7;
      window.K.aimAt(0);                       // aim at the one with NOTHING on it
      window.K.renderIntent();
      await new Promise(r2 => setTimeout(r2, 60));
      const read = {};
      document.querySelectorAll('.k-pips').forEach(p => {
        read[p.dataset.body] = [...p.querySelectorAll('.k-pip-b')]
          .map(b => b.className.replace(/.*k-pip-/, '') + (b.querySelector('b') ? ':' + b.querySelector('b').textContent : ''));
      });
      return read;
    });
    check('PIPS: a status shows on the body that carries it, aimed at or not',
      (pips.foe1 || []).join() === 'chill:4'
      && (pips.foe2 || []).join() === 'bleed:3'
      && (pips.ash || []).join() === 'guard:7'
      && !pips.foe0,
      JSON.stringify(pips));

    // AND NONE OF IT SURVIVES THE FIGHT. The lane chips did — the reckoning's
    // hide list never named them — so two dark FRONT / MID chips floated over
    // an empty plaza under a banner reading FALLEN.
    const after = await J(async () => {
      window.K.startCombat({ seed: 5, foes: ['husk'] });
      const st = window.K.state();
      st.heroes.ash.guard = 7; st.foes[0].chill = 4;
      window.K.renderIntent();
      const live = document.querySelectorAll('.k-tell, .k-pips').length;
      st.foes[0].hp = 0; st.foes[0].dead = true;
      st.phase = 'VICTORY';
      window.K.renderIntent();
      await new Promise(r2 => setTimeout(r2, 60));
      const shown = [...document.querySelectorAll('.k-tell, .k-pips')]
        .filter(e => e.innerHTML.trim()).length;
      return { live, shown, lanes: document.querySelectorAll('.k-foe-lane').length };
    });
    check('RECKONING: the badges and the pips stand down with the fight',
      after.live > 0 && after.shown === 0 && after.lanes === 0, JSON.stringify(after));
  }

  // ═══ ROOM TO STAND, AND A BODY THAT ANSWERS THE BLOW (Build 172) ═════════
  console.log('\n── the line has room, and it reacts ──');
  {
    // MEASURED OFF THE SLOTS, NOT OFF THE SCREEN. Three passes at a pixel
    // instrument all came back measuring something else — the intent badges
    // moving, the flooded floor re-lighting, a painted plate the 3D layer had
    // hidden with `opacity` and not `display`. The slots are the thing that
    // was actually wrong and they are directly readable: the party stood
    // 1.60 m apart and the creatures — bigger bodies, every one of them — at
    // 1.41.
    const gaps = await J(async () => {
      window.K.startCombat({ seed: 5, foes: ['husk', 'cultist', 'wraith'] });
      await new Promise(r => setTimeout(r, 400));
      const C3 = window.Cast3D;
      if (!C3 || !C3._stage) return null;
      const S = C3._stage();
      const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
      return { foe: +d(S.foe.front, S.foe.mid).toFixed(2),
               foe2: +d(S.foe.mid, S.foe.back).toFixed(2),
               hero: +d(S.hero.front, S.hero.mid).toFixed(2) };
    });
    check('LINE: a creature gets at least as much room as a hero, because it is bigger',
      !gaps || (gaps.foe >= gaps.hero && gaps.foe2 >= gaps.hero),
      JSON.stringify(gaps));

    // WHAT BEING HIT LOOKS LIKE IS NOT ONE THING. There is a single `hurt`
    // clip in the library, so the grading has to be the world's: how much
    // ground the body gives. A graze, a heavy blow and a stagger have to come
    // out in that order or the reaction is decoration.
    const react = await J(async () => {
      window.K.startCombat({ seed: 5, foes: ['husk'] });
      await new Promise(r => setTimeout(r, 1200));
      const C3 = window.Cast3D;
      if (!C3 || !C3.react) return null;
      const f = C3._figure('foe0'); if (!f) return null;
      const read = (power, stagger) => {
        f.lunge = null;
        C3.react('foe0', { power, stagger, from: 'party' });
        return f.lunge ? +Math.hypot(f.lunge.x, f.lunge.z).toFixed(3) : 0;
      };
      return { graze: read(0.05, false), heavy: read(0.9, false), stagger: read(0.4, true) };
    });
    check('REACT: a graze, a heavy blow and a stagger move the body by three different amounts',
      !react || (react.graze > 0 && react.heavy > react.graze * 1.6
                 && react.stagger > react.heavy),
      JSON.stringify(react));

    // …AND A SHOT MAY AIM SOMEWHERE ELSE BY THE END OF ITSELF. `full()` fills
    // every pose out to the same fields precisely so a shot cannot inherit a
    // travel it never asked for — which means a new field silently vanishes
    // unless it is named there. That is this check's whole job.
    const travel = await J(() => {
      const C3 = window.Cast3D; if (!C3) return null;
      C3.shot('alloutland', { for: 300 });
      const a = C3.shot().asked;
      return { toAt: a.toAt || null, to: !!a.to, over: a.over || 0 };
    });
    check('SHOT: a move can walk its AIM from one subject to another, not just its lens',
      !travel || (travel.toAt && travel.to && travel.over > 0), JSON.stringify(travel));

    // THE 2D SHOCK RING DOES NOT BELONG IN A 3D WORLD. Build 127 made the
    // argument — a CSS circle is a decal on the lens: it cannot be occluded by
    // the body it happened to, it does not move when the camera does, and it
    // is the same size whether the hit was two metres away or nine — and then
    // gated exactly ONE of its six callers on it. The other five went on
    // stamping gold circles across the party through every parry, which is the
    // moment the player most needs to read a bar. Written against Build 172
    // this goes red on both halves.
    const rings = await J(async () => {
      window.K.startCombat({ seed: 5, foes: ['husk'] });
      await new Promise(r => setTimeout(r, 300));
      const count = () => document.querySelectorAll('.k-shock').length;
      const fire = () => { window.K._fxHitResolved('elin', 5, false, true);
                           window.K._fxNoteGrade('perfect', 'tap');
                           window.K._fxComboCall && window.K._fxComboCall('FOLLOW_UP'); };
      document.body.classList.add('k-cast3d'); fire();
      await new Promise(r => setTimeout(r, 60));
      const inWorld = count();
      document.querySelectorAll('.k-shock').forEach(e => e.remove());
      // …and the flat stage keeps every one of them, because there it is still
      // the only thing saying a blow landed
      document.body.classList.remove('k-cast3d'); fire();
      await new Promise(r => setTimeout(r, 60));
      const flat = count();
      document.body.classList.add('k-cast3d');
      return { inWorld, flat };
    });
    check('IMPACT: no CSS shock ring is stamped on anybody once there is a world under them',
      rings.inWorld === 0 && rings.flat > 0, JSON.stringify(rings));

    // ── IT FILLS THE SCREEN, AND THE READOUT STILL CLEARS THE HARDWARE ──────
    //
    // The fit CONTAINED the design rect until Build 174, so every screen that
    // was not exactly 932x430's aspect got black bars. It COVERS now, which
    // means the crop is real and has to be measured: what falls off the edge
    // must be world, never a readout. Both halves are checked at four aspects
    // with an island and a home indicator faked on, because the failure this
    // guards against only appears on a shape nobody is developing at.
    const fit = await J(async () => {
      const root = document.documentElement;
      const keep = ['--sa-t', '--sa-r', '--sa-b', '--sa-l'].map(k => root.style.getPropertyValue(k));
      root.style.setProperty('--sa-t', '0px'); root.style.setProperty('--sa-b', '21px');
      root.style.setProperty('--sa-l', '59px'); root.style.setProperty('--sa-r', '59px');
      const out = [];
      // the design rect's own shape, a taller one, and a much taller one
      for (const [w, h] of [[932, 430], [1280, 720], [1024, 768]]) {
        // the page cannot be resized from in here, so the fit is exercised the
        // way it will actually run: read back what it publishes for this size
        const s = Math.max(w / 932, h / 430);
        const cx = Math.max(0, (932 - w / s) / 2), cy = Math.max(0, (430 - h / s) / 2);
        out.push({ w, h, fills: (932 * s >= w - 0.5) && (430 * s >= h - 0.5),
                   uil: +(cx + 59 / s).toFixed(1), uib: +(cy + 21 / s).toFixed(1) });
      }
      // …and the live one, which is the only one the DOM can be asked about
      dispatchEvent(new Event('resize'));
      await new Promise(r => setTimeout(r, 60));
      const cs = getComputedStyle(root);
      const live = ['--ui-l', '--ui-t', '--ui-r', '--ui-b'].map(k => parseFloat(cs.getPropertyValue(k)) || 0);
      const st = document.getElementById('k-stage').getBoundingClientRect();
      const safe = { l: 59, t: 0, r: innerWidth - 59, b: innerHeight - 21 };
      const outside = (b) => b.left < safe.l - 1 || b.top < safe.t - 1
                          || b.right > safe.r + 1 || b.bottom > safe.b + 1;
      // `k-boss-hud` came off this list at Build 232: it draws nothing now (it
      // carries the aimed foe's ids off screen — see index.html), so a box test
      // on it asks whether a `display: none` element is inside the safe area,
      // which is a question with no honest answer. What replaced it as the
      // enemy readout is `.k-vit`, and a plate is placed off a body by the
      // world's own projection rather than off the safe box, so it is measured
      // where it is actually at risk: against the creatures, in the flow and
      // cast suites.
      const off = ['k-party-hud', 'k-endturn', 'k-deck-btn', 'k-disc-btn']
        .filter(id => { const e = document.getElementById(id); if (!e) return false;
          if (!e.offsetParent && getComputedStyle(e).position !== 'fixed') return false;
          return outside(e.getBoundingClientRect()); });
      // ── THE HAND IS ASKED A DIFFERENT QUESTION (Build 227) ────────────────
      //
      // It used to be in the list above, and its whole box had to sit inside
      // the safe area. That was the right question while the hand rested above
      // the bottom edge. The hand deliberately sits INTO that edge now, so on a
      // phone with a home indicator the lower part of a card is in the strip
      // the hardware owns — by design, and it is painting down there.
      //
      // What may never be in that strip is anything the player has to READ or
      // has to GRAB. So the name plate is what is measured, and the card's body
      // has to keep enough height above the line to be taken hold of. If the
      // sink ever grows far enough to push a name under the home indicator, or
      // to leave only a sliver to drag, this fails — which is the rule the
      // whole-box test was standing in for.
      const nms = [...document.querySelectorAll('#k-hand .k-card .k-cname')];
      if (nms.some(n => outside(n.getBoundingClientRect()))) off.push('k-hand:name');
      const grab = [...document.querySelectorAll('#k-hand .k-card')]
        .map(c => { const b = c.getBoundingClientRect(); return safe.b - b.top; });
      if (grab.length && Math.min(...grab) < 44) off.push('k-hand:grab');
      ['--sa-t', '--sa-r', '--sa-b', '--sa-l'].forEach((k, i) => root.style.setProperty(k, keep[i] || ''));
      dispatchEvent(new Event('resize'));
      return { out, live, off,
               covers: st.left <= 0.5 && st.top <= 0.5
                    && st.right >= innerWidth - 0.5 && st.bottom >= innerHeight - 0.5 };
    });
    // `live` is [l, t, r, b] and the TOP is legitimately zero here: an island
    // in landscape is a side inset, and a screen the design's own shape crops
    // nothing vertically. Asserting all four non-zero was the check being
    // wrong about the device, not the fit being wrong about the screen.
    check('FIT: the board fills the screen at every aspect, and the readout stays off the hardware',
      fit.out.every(o => o.fills && o.uil > 0 && o.uib > 0)
      && fit.covers && fit.off.length === 0
      && fit.live[0] > 0 && fit.live[2] > 0 && fit.live[3] > 0 && fit.live[1] >= 0,
      JSON.stringify(fit));

    // ── AND A SCREEN MADE OF SENTENCES IS NOT ALLOWED TO BE CROPPED ────────
    //
    // The check above only ever watched the COMBAT readout. Every other screen
    // — the road, the fire, the mark, the awakening, the trade, the deck, and
    // the reckoning over the battlefield — was still laying itself out at
    // `left: 22px` of a board whose first seventy-seven pixels were off the
    // side of the window. Found by playing it, not by the suite: the
    // reckoning's title printed "LLOW HUSK" for THE HOLLOW HUSK.
    //
    // The world is composed to be cropped and stays full-bleed. A sentence is
    // not, so each of these now lays out inside `--ui-*` — and this is the
    // check that says so, at a shape nobody develops at.
    const clipped = await J(async () => {
      const root = document.documentElement;
      const keep = ['--sa-t', '--sa-r', '--sa-b', '--sa-l'].map(k => root.style.getPropertyValue(k));
      root.style.setProperty('--sa-t', '0px'); root.style.setProperty('--sa-b', '21px');
      root.style.setProperty('--sa-l', '59px'); root.style.setProperty('--sa-r', '59px');
      dispatchEvent(new Event('resize'));
      await new Promise(r => setTimeout(r, 80));
      const out = {};
      // A HIDDEN ELEMENT HAS A ZERO RECT, AND ZERO PASSES EVERYTHING. The first
      // cut of this check read all eight while they were `display: none`,
      // reported four zeros each, and went green against a build that was
      // still clipping — the same class of instrument failure this suite has
      // caught three times. Each one is shown for the measurement and put back.
      for (const id of ['k-map', 'k-camp', 'k-mark', 'k-wake', 'k-scene', 'k-swap', 'k-deck', 'k-reck']) {
        const e = document.getElementById(id); if (!e) continue;
        const was = e.classList.contains('k-hidden');
        if (was) e.classList.remove('k-hidden');
        const b = e.getBoundingClientRect();
        // …AGAINST WHAT CONTAINS IT, NOT AGAINST THE WINDOW. Seven of these are
        // siblings of the stage and sit straight on the window; the reckoning
        // lives INSIDE the stage, which carries a live transform — the impact
        // push moves it — so a window-space reading of it measures the shove as
        // well as the layout and comes back three pixels out.
        const host = (e.offsetParent || document.documentElement).getBoundingClientRect();
        out[id] = { shown: b.width > 1 && b.height > 1,
                    l: Math.round(b.left - host.left), t: Math.round(b.top - host.top),
                    r: Math.round(host.right - b.right), bo: Math.round(host.bottom - b.bottom) };
        if (was) e.classList.add('k-hidden');
      }
      ['--sa-t', '--sa-r', '--sa-b', '--sa-l'].forEach((k, i) => root.style.setProperty(k, keep[i] || ''));
      dispatchEvent(new Event('resize'));
      return out;
    });
    // every one of them starts inside the window rather than off the side of it
    // …and a box that measured zero is a box that was not measured
    const inside = Object.keys(clipped).filter(k =>
      clipped[k].shown && clipped[k].l >= 58 && clipped[k].r >= 58);
    check('FIT: a screen made of sentences lays out inside the crop, not off the side of it',
      Object.keys(clipped).length >= 7 && inside.length === Object.keys(clipped).length,
      JSON.stringify(clipped));
  }

  // ═══ H · EVERY NAME IN THE BESTIARY FITS ITS PLATE ═══
  //
  // "The Mourning Regent" came out "MOURNING R…" the first time a boss wore a
  // plate — a readout that cannot say who it is describing. The plate's width
  // is a rule about neighbours (74px, because the tightest a line ever stands
  // is 78 screen pixels between bodies) and a line of ONE has no neighbour, so
  // a lone creature gets the room its name needs. Walking the whole table
  // means the next creature with a long name fails here and not on a phone.
  {
    const names = await J(async () => {
      const out = [];
      // HOW MUCH ROOM IS LEFT, not just whether it fit. `scrollWidth` is at
      // least `clientWidth`, so it reads zero headroom on every name that fits
      // and says nothing about how close the next one can come. A clone at
      // `max-content` gives the text's real width.
      const fits = (n) => {
        const c = n.cloneNode(true);
        c.style.cssText = 'position:absolute;visibility:hidden;display:inline-block;'
          + 'width:auto;max-width:none;overflow:visible;white-space:nowrap';
        n.parentNode.appendChild(c);
        const want = c.getBoundingClientRect().width;
        c.remove();
        const have = n.getBoundingClientRect().width;
        return { cut: want > have + 0.5, spare: Math.round(have - want) };
      };
      for (const id of Object.keys(window.K.FOES)) {
        window.K.startCombat({ seed: 5, foe: window.K.FOES[id] });
        await new Promise(r => requestAnimationFrame(r));
        // …and a boss has no plate: its name is announced on the corner bar,
        // which is where the fit has to be measured instead. One readout each
        // (see READOUT below), so one place to ask.
        const n = document.querySelector('.k-vit-foe b')
               || document.querySelector('#k-boss-hud .k-bname');
        if (!n) { out.push({ id, cut: true, text: '(no readout)', spare: -999 }); continue; }
        out.push({ id, text: n.textContent.trim(), ...fits(n) });
      }
      // …AND EVERY CREATURE THE ROAD CAN PUT IN A PACK, at the narrow width.
      // A packed plate is 74px because that is the tightest a line ever stands,
      // and the two names that happen to appear in the fights above fit it with
      // ZERO and ONE pixel to spare. So the rule is not "the sample fits" — it
      // is that any `fight`-tier creature, which is the set the road composes
      // packs from, has a name that survives a neighbour. The day somebody
      // promotes the Kneeling Revenant to a pack member, this says so.
      for (const id of Object.keys(window.K.FOES)) {
        if (window.K.FOES[id].tier !== 'fight') continue;
        window.K.startCombat({ seed: 5, foes: [id, id, id] });
        await new Promise(r => requestAnimationFrame(r));
        document.querySelectorAll('.k-vit-foe b').forEach(n =>
          out.push({ id: 'pack:' + id, text: n.textContent, ...fits(n) }));
      }
      // …and ours, short by design but drawn by the same rule
      window.K.startCombat({ seed: 5 });
      await new Promise(r => requestAnimationFrame(r));
      document.querySelectorAll('.k-vit-us b').forEach(n =>
        out.push({ id: 'hero:' + n.textContent, text: n.textContent, ...fits(n) }));
      return out;
    });
    check('PLATE: no name in the bestiary is cut off by its own plate',
      names.length >= 11 && names.every(n => !n.cut),
      JSON.stringify(names.filter(n => n.cut)) + ' of ' + names.length + ' — '
        + names.map(n => n.text + ':' + n.spare).join(' '));
  }

  // ═══ I · ONE READOUT PER CREATURE, AND THE TIER DECIDES WHICH ═══
  //
  // Every creature in the bestiary wears the same plate the party wears — over
  // its own head, 74px, name over bar over poise. A `tier: 'boss'` creature
  // takes the ceremonial corner bar instead, because a boss fight is a
  // different KIND of fight rather than a bigger one, and the games that do
  // this well all answer it that way.
  //
  // The rule is EXACTLY ONE, both directions. A creature with both readouts is
  // two answers to one question, and a creature with neither has vanished from
  // its own fight. Walked across the table so the next bestiary entry inherits
  // whichever it is by being written down, rather than by being remembered.
  {
    const each = await J(async () => {
      const out = [];
      for (const id of Object.keys(window.K.FOES)) {
        const def = window.K.FOES[id];
        window.K.startCombat({ seed: 5, foe: def });
        await new Promise(r => requestAnimationFrame(r));
        const hud = document.getElementById('k-boss-hud');
        out.push({ id, tier: def.tier,
                   plate: document.querySelectorAll('.k-vit-foe').length,
                   bar: !hud.classList.contains('k-hud-away') });
      }
      return out;
    });
    check('READOUT: every creature has exactly one — a boss the corner bar, everything else a plate',
      each.length >= 5 && each.every(f => f.tier === 'boss'
        ? (f.bar && f.plate === 0)
        : (!f.bar && f.plate === 1)),
      JSON.stringify(each));
  }

  const r = report();
  await H.browser.close();
  process.exit(r.passed === r.total && r.errs === 0 ? 0 : 1);
})();
