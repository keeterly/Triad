// KIZUNA v2.3 — Build 5 acceptance suite: the RESONANCE core mechanics pass
// (docs/RESONANCE-DECK.md). Covers the deck's must-have tests — opening hero
// coverage, immediate Follow-Up, Finale gating, no dual conditional bonus,
// Guard expiry, Bleed decay, Break cancellation, one Resonance per phase —
// plus economy, parry outcomes, Intercession, and the UI presentation gates.
'use strict';
const { boot } = require('./harness.cjs');

(async () => {
  const H = await boot();
  const { J, check, report } = H;

  const fresh = (seed) => J((s) => { window.K.startCombat({ seed: s }); return true; }, seed);
  // a flat grade list for the whole barrage: 'clean' answers every string
  const grades = (kind) => J((k) => (window.K.currentIntent().hits || [])
    .flatMap(h => h.notes.map(() => k)), kind);
  // what the barrage is about to do, straight from the engine
  // a live bar runs ~4s; let it finish before the next block touches the DOM
  // WAIT FOR THE STAGE, NOT JUST THE RING. This watched for the beat bar and
  // the ring and called it quiet — but `k-slowmo` outlives both: it comes off
  // in `finish()` and its filter then transitions back over 130ms. A check that
  // started here and polled for `.k-slowmo` could catch the PREVIOUS bar's
  // drain on its way OUT and read a half-returned filter as a half-arrived one.
  // DILATION did exactly that, reporting saturate(0.10) and (0.15) against a
  // 0.05 target — the drain works, it was being measured backwards. Anything
  // still wearing the parry's clothes counts as not-quiet.
  const settle = () => J(async () => {
    for (let i = 0; i < 160; i++) {
      const st = document.getElementById('k-stage');
      if (!document.getElementById('k-beat') && !document.querySelector('.k-pring')
          && !(st && st.classList.contains('k-slowmo'))) {
        await new Promise(r => setTimeout(r, 180));   // …and let the filter land
        return true;
      }
      await new Promise(r => setTimeout(r, 60));
    }
    return false;
  });
  const volley = () => J(() => {
    const it = window.K.currentIntent();
    return { total: window.K.intentPreviewDmg(), hits: (it.hits || []).length,
             dirge: window.K.dirgeAmount() };
  });
  const S = () => J(() => {
    const c = window.K.state();
    return {
      phase: c.phase, turn: c.turn, ap: c.ap,
      heroes: JSON.parse(JSON.stringify(c.heroes)),
      boss: JSON.parse(JSON.stringify(c.boss)),
      hand: c.hand.slice(), deck: c.deck.length, discard: c.discard.slice(),
      exhausted: c.exhausted.slice(),
      bond: JSON.parse(JSON.stringify(c.bond)),
      counterstance: c.counterstance, intercession: c.intercession,
      pendingDiscard: c.pendingDiscard,
      moved: c.turnState.moved, cycled: c.turnState.cycled,
      actions: c.turnState.actionsPlayed.length,
    };
  });

  // ═══ A00 · ONE PRESS ANSWERS ONE NOTE ═══
  // The Hymn opens with two taps half a beat apart — 250ms — inside a grading
  // window that runs land−260ms to land+290ms. Both notes were listening, both
  // had their own stage-level pointerdown, and one finger fired both: the
  // first graded PERFECT and the second was silently eaten as an early GOOD
  // the player never played. The Regent's signature intent could not be played
  // FLAWLESS at all. Nothing in the suite noticed, because nothing in the
  // suite had ever pressed a real button.
  console.log('\n── one press, one note ──');
  {
    const arb = await J(() => {
      // two notes 250ms apart, a press dead on the first
      const now = 1000;
      const A = { landAt: now, kind: 'tap' }, B = { landAt: now + 250, kind: 'tap' };
      const K = window.K;
      if (!K._liveTest) return null;
      return K._liveTest([A, B], [
        { at: now,       want: 'A' },   // dead on A
        { at: now + 250, want: 'B' },   // dead on B
        { at: now + 100, want: 'A' },   // nearer A
        { at: now + 160, want: 'B' },   // nearer B
      ]);
    });
    check('PRESS: two notes a half-beat apart never both answer one finger',
      arb && arb.every(r => r.got === r.want), JSON.stringify(arb));

    // and the same rule is what stops a bait being "touched" by a press aimed
    // at the note after it
    const bait = await J(() => {
      const K = window.K;
      const now = 2000;
      const skull = { landAt: now, kind: 'bait' }, tap = { landAt: now + 500, kind: 'tap' };
      return K._liveTest([skull, tap], [
        { at: now,       want: 'A' },   // touching the skull is touching the skull
        { at: now + 260, want: 'B' },   // eager about the TAP, not the skull
        { at: now + 500, want: 'B' },
      ]);
    });
    check('PRESS: a press aimed at the note after a bait never counts as touching the skull',
      bait && bait.every(r => r.got === r.want), JSON.stringify(bait));
  }

  // ═══ A0b · NOTHING IN THE DECK CORNER RUNS OFF THE EDGE ═══
  {
    // The swap caption used to live here. It was a 200px sentence hung off a
    // 62px pile in the bottom-left corner and it ran off the screen; the check
    // that replaced it asks the stronger question, of everything in that
    // corner rather than of the one element that was wrong.
    const clear = await J(() => {
      const st = document.getElementById('k-stage').getBoundingClientRect();
      const bad = [];
      document.querySelectorAll('#k-deck-btn, #k-deck-btn *, #k-disc-btn, #k-disc-btn *')
        .forEach(e => {
          const r = e.getBoundingClientRect();
          if (!r.width && !r.height) return;
          if (r.left < st.left - 0.5 || r.right > st.right + 0.5
              || r.top < st.top - 0.5 || r.bottom > st.bottom + 0.5) {
            bad.push((e.id || e.className || e.tagName) + ' @' + Math.round(r.left));
          }
        });
      return { bad, hint: !!document.querySelector('.k-cycle-hint') };
    });
    check('CORNER: nothing on either pile hangs off the edge of the stage',
      clear.bad.length === 0 && !clear.hint, JSON.stringify(clear));
  }
  // ═══ A07 · A BLOW LOOKS LIKE WHAT THREW IT ═══
  console.log('\n── the verb of the blow ──');
  {
    // The kind is DERIVED from the same effects the card face reads, so the
    // animation can never disagree with the card. A card that stops dealing
    // damage stops swinging, with nobody remembering to change anything.
    const kinds = await J(() => {
      const K = window.K, out = {};
      for (const id of ['cleave', 'crosssever', 'twinfang', 'backstab', 'serrate',
                        'frostbind', 'lcascade', 'sgrace', 'mend', 'cstance', 'intercession']) {
        const c = K.CARD_DEFS[id];
        out[id] = K.actionKind(c, c.base) + '/' + K.castTone(c.base);
      }
      return out;
    });
    check('VERB: steel swings, the Oracle casts, and a mend is neither',
      /^slash/.test(kinds.cleave) && /^slash/.test(kinds.twinfang) && /^slash/.test(kinds.backstab)
      && /^cast/.test(kinds.frostbind) && /^cast/.test(kinds.lcascade) && /^cast/.test(kinds.sgrace)
      && /^heal/.test(kinds.mend) && /^ward/.test(kinds.cstance),
      JSON.stringify(kinds));
    check('VERB: a cast is coloured by what it is made of — frost is cold, a ward is steel',
      /ice$/.test(kinds.frostbind) && /ward$/.test(kinds.sgrace) && /life$/.test(kinds.mend),
      JSON.stringify({ frost: kinds.frostbind, grace: kinds.sgrace, mend: kinds.mend }));

    // A STEEL CARD CUTS. Two hits are two cuts at two angles — one thing
    // flickering twice is what this replaces.
    const cut = await J(async () => {
      window.K.startCombat({ seed: 7 });
      window.K.forceHand(['twinfang', 'mend', 'frostbind', 'serrate', 'qthrow']);
      window.K.playCard('twinfang');
      await new Promise(r => setTimeout(r, 40));
      const sl = [...document.querySelectorAll('.k-slash')];
      return { n: sl.length,
               angles: sl.map(e => e.style.getPropertyValue('--ang')),
               // an invalid timing function silently drops the whole shorthand,
               // and the cut would simply never play
               dur: sl[0] ? getComputedStyle(sl[0]).animationDuration : null,
               name: sl[0] ? getComputedStyle(sl[0]).animationName : null,
               ease: sl[0] ? getComputedStyle(sl[0]).animationTimingFunction : null };
    });
    check('SLASH: two hits are two cuts, at two different angles',
      cut.n === 2 && cut.angles[0] !== cut.angles[1], JSON.stringify(cut.angles));
    check('SLASH: the cut actually animates — a bad easing drops the whole shorthand',
      cut.name === 'k-slash' && parseFloat(cut.dur) > 0 && /cubic-bezier/.test(cut.ease || ''),
      JSON.stringify({ name: cut.name, dur: cut.dur, ease: cut.ease }));

    // A SPELL IS ANNOUNCED. The ring is on screen BEFORE the damage lands.
    const spell = await J(async () => {
      // A cut lives 340ms and the check above fired one 40ms ago, so without
      // clearing them this measures the previous card's steel, not this one's
      // absence of it.
      document.querySelectorAll('.k-slash').forEach(e => e.remove());
      window.K.startCombat({ seed: 7 });
      window.K.forceHand(['frostbind', 'mend', 'cleave', 'serrate', 'qthrow']);
      const hpBefore = window.K.state().boss.hp;
      window.K.playCard('frostbind');
      await new Promise(r => setTimeout(r, 40));
      const rune = document.querySelector('.k-rune');
      const mote = document.querySelector('.k-mote');
      const burst = document.querySelector('.k-burst');
      // An element can be in the DOM with its rule DROPPED — a stray brace
      // earlier in the sheet cost .k-rune its entire body for a whole build,
      // and a !!querySelector check called that a pass. --rune is no witness
      // either: it comes from .k-tone-*, a different rule that survives. Ask
      // each effect for the geometry only its OWN rule can give it.
      const box = (e) => { if (!e) return null; const cs = getComputedStyle(e);
        return { pos: cs.position, w: e.offsetWidth, h: e.offsetHeight,
                 anim: cs.animationName, z: cs.zIndex }; };
      return { rune: box(rune), mote: box(mote), burst: box(burst),
               tone: rune ? getComputedStyle(rune).getPropertyValue('--rune').trim() : null,
               motes: document.querySelectorAll('.k-mote').length,
               bursts: document.querySelectorAll('.k-burst').length,
               noSlash: document.querySelectorAll('.k-slash').length,
               casting: !!document.querySelector('.k-hero.k-casting'),
               hit: window.K.state().boss.hp < hpBefore };
    });
    check('CAST: a spell blooms a ring on its caster, throws motes, and breaks over the target',
      spell.rune && spell.motes >= 3 && spell.bursts >= 1 && spell.casting && spell.hit,
      JSON.stringify({ motes: spell.motes, bursts: spell.bursts,
                       casting: spell.casting, hit: spell.hit }));
    // The check the last build did not have, and needed.
    check('CAST: the ring, the motes and the burst are actually STYLED — not just present',
      ['rune', 'mote', 'burst'].every(k => { const b = spell[k];
        return b && b.pos === 'absolute' && b.w > 0 && b.h > 0
               && b.anim && b.anim !== 'none'; }),
      JSON.stringify({ rune: spell.rune, mote: spell.mote, burst: spell.burst }));
    check('CAST: a spell does not swing a sword',
      spell.noSlash === 0, spell.noSlash + ' slashes on a cast');

    // HEALING WAS INVISIBLE — a number in the roster changed and nothing moved.
    const mend = await J(async () => {
      window.K.startCombat({ seed: 7 });
      const c = window.K.state();
      c.heroes.ash.hp = 20;
      window.K.forceHand(['mend', 'cleave', 'serrate', 'qthrow', 'frostbind']);
      window.K.playCard('mend');
      await new Promise(r => setTimeout(r, 40));
      const pop = document.querySelector('.k-pop-heal');
      return { motes: document.querySelectorAll('.k-life').length,
               bloom: !!document.querySelector('.k-hero.k-mended'),
               pop: pop ? pop.textContent : null,
               healed: window.K.state().heroes.ash.hp > 20 };
    });
    check('MEND: healing is seen — motes rise, the mended hero blooms, and the number is green',
      mend.motes >= 4 && mend.bloom && /^\+\d+$/.test(mend.pop || '') && mend.healed,
      JSON.stringify(mend));

    // THE FOURTH VERB. Build 36 sorted every card into heal | cast | slash |
    // ward and shipped animations for three of them.
    const ward = await J(async () => {
      window.K.startCombat({ seed: 7 });
      window.K.forceHand(['sgrace', 'cleave', 'serrate', 'qthrow', 'mend']);
      window.K.playCard('sgrace');
      await new Promise(r => setTimeout(r, 40));
      const pl = document.querySelector('.k-ward');
      const pop = document.querySelector('.k-pop-ward');
      const cs = pl ? getComputedStyle(pl) : null;
      return { plates: document.querySelectorAll('.k-ward').length,
               styled: !!(cs && cs.position === 'absolute' && pl.offsetWidth > 0
                          && cs.animationName && cs.animationName !== 'none'),
               bloom: !!document.querySelector('.k-hero.k-warded'),
               pop: pop ? pop.textContent : null,
               guarded: window.K.state().heroes.ash.guard > 0,
               noSlash: document.querySelectorAll('.k-slash').length };
    });
    // Shared Grace guards all three, so all three plates come up.
    check('WARD: guarding is seen — a plate snaps up on every hero it covers',
      ward.plates >= 3 && ward.styled && ward.bloom && ward.guarded && /\d/.test(ward.pop || ''),
      JSON.stringify(ward));
    check('WARD: raising a guard does not swing a sword',
      ward.noSlash === 0, ward.noSlash + ' slashes on a ward');

    // THE BUG THIS CHECK EXISTS FOR: a bloom that sets `animation:` on .k-fig
    // REPLACES the idle breathe instead of layering over it, so a healed or
    // guarded hero stops breathing and snaps back when the class comes off.
    // Build 36 shipped that on k-mended and the ward repeated it. Every other
    // transient state here pauses the breathe rather than overwriting it, and
    // this asks the next verb to do the same.
    const breath = await J(async () => {
      window.K.startCombat({ seed: 7 });
      window.K.forceHand(['sgrace', 'mend', 'cleave', 'serrate', 'qthrow']);
      const fig = (id) => document.querySelector('.k-hero[data-hero="' + id + '"] .k-fig');
      const nameOf = (id) => getComputedStyle(fig(id)).animationName;
      const idle = ['ash', 'elin', 'mira'].map(nameOf);
      window.K.playCard('sgrace');
      await new Promise(r => setTimeout(r, 40));
      const warded = ['ash', 'elin', 'mira'].map(nameOf);
      window.K.startCombat({ seed: 7 });
      const c = window.K.state(); c.heroes.ash.hp = 20;
      window.K.forceHand(['mend', 'cleave', 'serrate', 'qthrow', 'sgrace']);
      window.K.playCard('mend');
      await new Promise(r => setTimeout(r, 40));
      const mended = ['ash', 'elin', 'mira'].map(nameOf);
      return { idle, warded, mended };
    });
    check('BLOOM: being healed or guarded never costs a figure its breathing',
      breath.idle.every(n => n === 'k-breathe')
      && breath.warded.every(n => n === 'k-breathe')
      && breath.mended.every(n => n === 'k-breathe'),
      JSON.stringify(breath));
  }

  // ═══ A04d · SIGILS — what a bond changes about a card you carry ═══
  {
    // The complaint these answer: cards are hard to CONNECT. FOLLOW_UP wants a
    // different hero to have just acted, and a five-card hand rarely offers
    // the order. Three of the five marks exist to loosen exactly that.
    //
    // CHAIN READS BACKWARD NOW, which is the whole change. As RELAY it set a
    // flag for the card played AFTER it — so the card wearing the mark did
    // nothing for itself, and the player had to carry "the next thing I play
    // gets this" across a decision. It opens the condition of the card it is
    // ON, when an ally has already acted.
    //
    // WHICH MAKES IT WORTHLESS ON A FOLLOW_UP CARD — an ally acting already
    // satisfies that natively — and valuable on a combo you cannot otherwise
    // reach. Last Light is Ash's FINALE: it wants all three to have acted, and
    // one ally is not three. That is the case worth marking, and the fact that
    // there is a wrong place to put it is what makes it a decision.
    const chain = await J(() => {
      const run = (sigils) => {
        window.K.startCombat({ seed: 7, sigils });
        window.K.forceHand(['serrate', 'lastlight', 'cleave', 'qthrow', 'mend']);
        const alone = window.K.evaluateCard('lastlight').condActive;
        window.K.playCard('serrate');                    // Mira acts — one ally
        const ev = window.K.evaluateCard('lastlight');
        return { alone, after: ev.condActive, lands: ev.resolvedEffects.length };
      };
      const followUp = (sigils) => {
        window.K.startCombat({ seed: 7, sigils });
        window.K.forceHand(['serrate', 'crosssever', 'cleave', 'qthrow', 'mend']);
        window.K.playCard('serrate');
        return window.K.evaluateCard('crosssever').condActive;
      };
      return { bare: run({}), marked: run({ lastlight: 'chain' }),
               fu: { bare: followUp({}), marked: followUp({ crosssever: 'chain' }) } };
    });
    check('CHAIN: an unreachable combo opens when an ally has gone first — on the card that wears it',
      chain.bare.alone === false && chain.bare.after === false
      && chain.marked.after === true && chain.marked.lands > chain.bare.lands,
      JSON.stringify({ bare: chain.bare, marked: chain.marked }));
    check('CHAIN: it buys nothing on a card an ally already connects — the choice is WHERE it goes',
      chain.fu.bare === true && chain.fu.marked === true, JSON.stringify(chain.fu));

    // OPENING answers the other half of the same problem: the turn's FIRST
    // card has nobody to follow, which is exactly where a FOLLOW_UP card is
    // stranded when it is the only thing you can afford.
    const opening = await J(() => {
      const first = (sigils) => {
        window.K.startCombat({ seed: 7, sigils });
        window.K.forceHand(['crosssever', 'cleave', 'serrate', 'qthrow', 'mend']);
        const ev = window.K.evaluateCard('crosssever');
        return { on: ev.condActive, cost: ev.currentCost };
      };
      const bare = first({}), marked = first({ crosssever: 'lead' });
      // and it stops applying once the turn is under way
      // Cleave is ALSO Ash's, so once the turn is under way Cross Sever has
      // neither the mark's reason (it is no longer first) nor the ordinary
      // one (no ally has acted). That is the case that catches OPENING
      // quietly becoming "always on".
      window.K.startCombat({ seed: 7, sigils: { crosssever: 'lead' } });
      window.K.forceHand(['cleave', 'crosssever', 'serrate', 'qthrow', 'mend']);
      window.K.playCard('cleave');
      const later = window.K.evaluateCard('crosssever').condActive;
      // and an ALLY acting still opens it the ordinary way
      window.K.startCombat({ seed: 7 });
      window.K.forceHand(['serrate', 'crosssever', 'cleave', 'qthrow', 'mend']);
      window.K.playCard('serrate');
      const byAlly = window.K.evaluateCard('crosssever').condActive;
      return { bare, marked, later, byAlly };
    });
    check('OPENING: the turn’s first card has nobody to follow — the mark says that counts',
      opening.bare.on === false && opening.marked.on === true
      && opening.marked.cost < opening.bare.cost,
      JSON.stringify(opening));
    // After an ally HAS acted the ally is the reason, not the mark — this is
    // the check that would catch OPENING quietly turning into "always on".
    check('OPENING: it is the OPENING, not a permanent pass — and the ally route still works',
      opening.later === false && opening.byAlly === true,
      JSON.stringify({ afterSameHero: opening.later, afterAlly: opening.byAlly }));

    const held = await J(async () => {
      window.K.startCombat({ seed: 7, sigils: { mend: 'retain' } });
      window.K.forceHand(['mend', 'cleave', 'serrate', 'qthrow', 'frostbind']);
      const before = window.K.state().hand.slice();
      await window.K.endTurn({ skipParry: true });
      const after = window.K.state().hand.slice();
      return { before, after, discard: window.K.state().discard.slice() };
    });
    check('RETAIN: the marked card stays in hand when the turn ends, and nothing else does',
      held.after.indexOf('mend') >= 0
      && held.before.filter(id => id !== 'mend').every(id => held.after.indexOf(id) < 0
                                                            || held.discard.indexOf(id) >= 0),
      JSON.stringify({ before: held.before, after: held.after }));
    // THE SWEEP USED TO SHIFT FROM THE FRONT until the hand was empty. A kept
    // card has to be stepped over rather than counted out, or the loop walks
    // off the end of a hand that never empties — and every other card would
    // have survived with it.
    // The turn ends and the next one DRAWS BACK UP, so the hand is five again
    // — the question is which four went, not how many are left.
    check('RETAIN: keeping one card does not keep the rest — the sweep still empties around it',
      held.before.filter(id => id !== 'mend').every(id => held.discard.indexOf(id) >= 0)
      && held.discard.indexOf('mend') < 0,
      JSON.stringify({ before: held.before, discard: held.discard }));

    const kindled = await J(() => {
      const run = (sigils) => {
        window.K.startCombat({ seed: 7, sigils });
        window.K.forceHand(['cleave', 'serrate', 'qthrow', 'mend', 'frostbind']);
        window.K.playCard('cleave');
        return window.K.state().kizuna;
      };
      return { bare: run({}), marked: run({ cleave: 'rally' }) };
    });
    check('RALLY: the marked card pays the bond on top of whatever it does',
      Math.abs((kindled.marked - kindled.bare) - 6) < 1e-9, JSON.stringify(kindled));

    const bright = await J(() => {
      const ev = (sigils) => {
        window.K.startCombat({ seed: 7, sigils });
        window.K.forceHand(['cleave', 'serrate', 'qthrow', 'mend', 'frostbind']);
        return window.K.evaluateCard('cleave');
      };
      const bare = ev({}), lit = ev({ cleave: 'surge' });
      const dmg = (e) => e.resolvedEffects.reduce((n, fx) => n + (fx.dmg || 0), 0);
      window.K.startCombat({ seed: 7, sigils: { cleave: 'surge' } });
      window.K.forceHand(['cleave', 'serrate', 'qthrow', 'mend', 'frostbind']);
      window.K.playCard('cleave');
      const st = window.K.state();
      return { bare: dmg(bare), lit: dmg(lit), exhaustFlag: lit.exhaust,
               exhausted: st.exhausted.indexOf('cleave') >= 0,
               inDiscard: st.discard.indexOf('cleave') >= 0 };
    });
    check('SURGE: half again as strong, and it leaves the fight rather than the discard',
      bright.lit === Math.ceil(bright.bare * 1.5) && bright.exhaustFlag
      && bright.exhausted && !bright.inDiscard, JSON.stringify(bright));
    // A true flag is not a quantity. Intercession carries `intercede: true`,
    // and multiplying that by 1.5 would turn the atom into 2 and quietly
    // change what the effect resolver is being handed.
    const flags = await J(() => {
      window.K.startCombat({ seed: 7, sigils: { intercession: 'surge' } });
      const ev = window.K.evaluateCard('intercession');
      return ev.resolvedEffects.map(fx => JSON.stringify(fx));
    });
    check('SURGE: it scales the numbers and leaves the flags alone',
      flags.join('|').indexOf('"intercede":true') >= 0
      && flags.join('|').indexOf('"intercede":2') < 0, flags.join(' '));

    const face = await J(() => {
      window.K.startCombat({ seed: 7, sigils: { cleave: 'surge' } });
      window.K.forceHand(['cleave', 'serrate', 'qthrow', 'mend', 'frostbind']);
      const btn = document.querySelector('.k-card[data-card="cleave"]');
      const chip = btn && btn.querySelector('.k-csig');
      const plain = document.querySelector('.k-card[data-card="serrate"] .k-csig');
      // What the face SHOULD say, computed from the evaluator rather than
      // written down here — a literal would have to be re-guessed every time
      // the card or the multiplier moves.
      const lands = window.K.evaluateCard('cleave').resolvedEffects
        .reduce((n, fx) => n + (fx.dmg || 0), 0);
      return { chip: chip ? chip.textContent : null,
               tinted: !!btn && btn.classList.contains('k-card-sig'),
               vis: chip ? getComputedStyle(chip).display : null,
               w: chip ? Math.round(chip.getBoundingClientRect().width) : 0,
               onPlain: !!plain, lands,
               says: (btn.querySelector('.k-cprose') || {}).textContent };
    });
    // A mark that changes how a card plays and does not appear on it is a rule
    // the player has to remember per card.
    // A CARD IS 150px AND .k-ctext IS THE FLEX-GROW CHILD WITH overflow:hidden,
    // so a new row in the flow gets paid for by clipping the combo strip — the
    // part of the face a mark most often changes. The band's height has to come
    // out of the art zone, and this is the check that says so.
    const room = await J(() => {
      // EVERY CARD IN THE DECK, marked and unmarked, five at a time. The
      // question is not "does anything clip" — it is whether the BAND clips
      // anything, so the same cards are measured both ways and compared.
      const ids = Object.keys(window.K.CARD_DEFS);
      const measure = (sigils) => {
        const out = {};
        window.K.startCombat({ seed: 7, sigils });
        for (let i = 0; i + 5 <= ids.length; i += 5) {
          window.K.forceHand(ids.slice(i, i + 5));
          document.querySelectorAll('.k-card').forEach(c => {
            const t = c.querySelector('.k-ctext');
            const cr = c.getBoundingClientRect(), tr = t.getBoundingClientRect();
            // BOTH DIRECTIONS. Only the vertical was ever measured, and a
            // row is a flex line — a clause longer than the card ran off the
            // side rather than clipping downward, so Quick Throw read
            // "draw 1, discard" with the last word cut off the face and no
            // check saw it. `wide` is the text block's own overflow, `past`
            // is any row breaking the card's edge.
            const rows = [...c.querySelectorAll('.k-crow, .k-combo-pay')];
            const past = rows.reduce((m, r) => { const rr = r.getBoundingClientRect();
              return Math.max(m, rr.right - cr.right, cr.left - rr.left); }, 0);
            out[c.dataset.card] = { over: t.scrollHeight - t.clientHeight,
                                    wide: t.scrollWidth - t.clientWidth,
                                    past: +past.toFixed(1),
                                    spills: tr.bottom > cr.bottom + 0.5,
                                    marked: c.classList.contains('k-card-sig'),
                                    combo: !!c.querySelector('.k-combo') };
          });
        }
        return out;
      };
      const bare = measure({});
      const all = {}; ids.forEach(id => { all[id] = 'chain'; });
      const lit = measure(all);
      return { bare, lit, ids: Object.keys(bare) };
    });
    // The band's height comes out of the art zone, so it must cost the text
    // block nothing at all — not "a little less than before".
    const worse = room.ids.filter(id => room.lit[id].over > room.bare[id].over
                                        || room.lit[id].spills);
    check('MARK: the band costs art, not text — it clips nothing the unmarked card did not',
      worse.length === 0 && room.ids.every(id => room.lit[id].marked)
      && room.ids.every(id => room.lit[id].combo === room.bare[id].combo),
      JSON.stringify({ worse, n: room.ids.length }));
    // And while this was being written it turned out two cards were ALREADY
    // clipping their own payoff strip, marked or not, and had been for many
    // builds. That is a separate bug and it is fixed; this keeps it fixed.
    const clipped = room.ids.filter(id => room.bare[id].over > 1);
    check('CARD: no card in the deck clips its own text — all twenty-eight fit their face',
      clipped.length === 0, JSON.stringify({ clipped, n: room.ids.length }));
    // The same question sideways, which nothing asked until Build 42.
    const spilled = room.ids.filter(id => room.bare[id].wide > 1 || room.bare[id].past > 0.5);
    check('CARD: no clause runs off the side of its card — rows wrap, they do not clip',
      spilled.length === 0,
      JSON.stringify({ spilled: spilled.map(id => ({ id, ...room.bare[id] })), n: room.ids.length }));

    check('MARK: a marked card wears its mark, an unmarked one does not, and the number is the new number',
      face.chip === 'Surge' && face.tinted && face.vis !== 'none' && face.w > 20
      && !face.onPlain && new RegExp('\\b' + face.lands + '\\b').test(face.says || ''),
      JSON.stringify(face));
  }

  // ═══ A05a · THE FAR PLANE MOVES TOO, JUST LESS ═══
  {
    const par = await J(async () => {
      window.K.startCombat({ seed: 7 });
      const bg = document.getElementById('k-backdrop');
      const cast = document.getElementById('k-cast');
      const read = (e, n) => e.style.getPropertyValue(n).trim();
      const snap = () => ({
        bx: parseFloat(read(bg, '--bg-x')), by: parseFloat(read(bg, '--bg-y')),
        br: parseFloat(read(bg, '--bg-r')), bs: parseFloat(read(bg, '--bg-s')),
        cx: parseFloat(read(cast, '--cam-x')), cr: parseFloat(read(cast, '--cam-r')),
        tf: getComputedStyle(bg).transform });
      // ms: 0 — with a transition running, getComputedStyle returns the value
      // MID-FLIGHT, so two snapshots taken back to back read identical and
      // the check learns nothing about where the plate was going.
      window.K.cam({ x: 30, y: 12, dz: 90, r: 2.0, yaw: 5, ms: 0 });
      const pushed = snap();
      window.K.cam({ x: -30, y: -12, dz: 0, r: -2.0, yaw: -5, ms: 0 });
      const pulled = snap();
      return { pushed, pulled };
    });
    // Same direction as the cast, smaller magnitude — that is the whole of
    // parallax. A backdrop that moved the other way would read as a mistake,
    // and one that moved the same amount would not be a backdrop.
    const p1 = par.pushed, p2 = par.pulled;
    check('PARALLAX: the backdrop follows the lens the same way the cast does, and by less',
      p1.bx > 0 && p1.bx < p1.cx && p2.bx < 0 && p2.bx > p2.cx
      && Math.abs(p1.br) < Math.abs(p1.cr) && p1.br * p1.cr > 0,
      JSON.stringify({ bx: [p1.bx, p2.bx], cx: [p1.cx, p2.cx], br: p1.br, cr: p1.cr }));
    check('PARALLAX: it is actually transformed — a var nothing reads is not a camera',
      p1.tf !== 'none' && p1.tf !== p2.tf, JSON.stringify({ pushed: p1.tf, pulled: p2.tf }));
    // THE SLACK MUST COVER THE TRAVEL. The plate is over-scaled so the pan has
    // somewhere to go; if the scale ever buys less room than the largest pan
    // asks for, the painting's edge walks into frame.
    const slack = await J(() => {
      const bg = document.getElementById('k-backdrop');
      const st = document.getElementById('k-stage');
      const worst = [];
      for (const x of [-40, 40]) for (const y of [-20, 20]) for (const r of [-3, 3]) {
        window.K.cam({ x, y, dz: 0, r, ms: 0 });
        const b = bg.getBoundingClientRect(), s2 = st.getBoundingClientRect();
        if (b.left > s2.left + 0.5 || b.right < s2.right - 0.5
            || b.top > s2.top + 0.5 || b.bottom < s2.bottom - 0.5) worst.push([x, y, r]);
      }
      window.K.cam({ x: 0, y: 0, dz: 0, r: 0, ms: 0 });
      return worst;
    });
    check('PARALLAX: the plate still covers the stage at every extreme of the pan',
      slack.length === 0, JSON.stringify(slack));
  }

  // ═══ A05b · A BAR THAT EASES DOWN IS NOT A WOUND ═══
  {
    const bar = await J(async () => {
      window.K.startCombat({ seed: 7 });
      window.K.forceHand(['cleave', 'serrate', 'qthrow', 'mend', 'sgrace']);
      const box = document.getElementById('k-bhp-fill').parentNode;
      const g = () => box.querySelector('.k-bar-ghost');
      const w = (e) => (e ? parseFloat(e.style.width) : null);
      const before = w(document.getElementById('k-bhp-fill'));
      window.K.playCard('cleave');
      await new Promise(r => setTimeout(r, 30));
      const fillNow = w(document.getElementById('k-bhp-fill'));
      const ghostHeld = w(g());
      const snapped = getComputedStyle(document.getElementById('k-bhp-fill')).transitionDuration;
      await new Promise(r => setTimeout(r, 320));
      const ghostFell = w(g());
      return { exists: !!g(), before, fillNow, ghostHeld, ghostFell, snapped,
               ghostTrans: g() ? getComputedStyle(g()).transitionDuration : null };
    });
    // The fill takes the hit at once; the ghost is still standing where the
    // health used to be, and only then falls to meet it.
    check('BAR: the fill snaps to the truth and a ghost holds where the health was',
      bar.exists && bar.fillNow < bar.before
      && Math.abs(bar.ghostHeld - bar.before) < 0.01
      && bar.snapped === '0s',
      JSON.stringify({ before: bar.before, fillNow: bar.fillNow,
                       ghostHeld: bar.ghostHeld, snapped: bar.snapped }));
    // FFXIV's read: the lost amount goes WHITE before it drains.
    const flash = await J(async () => {
      window.K.startCombat({ seed: 7 });
      window.K.forceHand(['cleave', 'serrate', 'qthrow', 'mend', 'sgrace']);
      const box = document.getElementById('k-bhp-fill').parentNode;
      window.K.playCard('cleave');
      await new Promise(r => setTimeout(r, 20));
      const g = box.querySelector('.k-bar-ghost');
      const cs = getComputedStyle(g);
      return { hit: g.classList.contains('k-bar-hit'), anim: cs.animationName,
               dur: cs.animationDuration };
    });
    check('BAR: the wound flashes white before it drains — the amount lost, not the whole bar',
      flash.hit && flash.anim === 'k-bar-hit' && parseFloat(flash.dur) > 0,
      JSON.stringify(flash));
    check('BAR: the ghost then falls to meet it — it is a trail, not a second bar',
      Math.abs(bar.ghostFell - bar.fillNow) < 0.01 && parseFloat(bar.ghostTrans) > 0,
      JSON.stringify({ ghostFell: bar.ghostFell, fillNow: bar.fillNow, trans: bar.ghostTrans }));

    // Healing runs the other way: nothing should be left behind.
    const healBar = await J(async () => {
      window.K.startCombat({ seed: 7 });
      const c = window.K.state(); c.heroes.ash.hp = 20; window.K.render();
      await new Promise(r => setTimeout(r, 20));
      const row = document.querySelector('.k-pt-hero[data-hero="ash"] .k-bar');
      const w = (sel) => parseFloat(row.querySelector(sel).style.width);
      const before = w('.k-bar-fill');
      window.K.forceHand(['mend', 'cleave', 'serrate', 'qthrow', 'sgrace']);
      window.K.playCard('mend');
      await new Promise(r => setTimeout(r, 30));
      return { before, fill: w('.k-bar-fill'), ghost: w('.k-bar-ghost') };
    });
    check('BAR: a heal leaves no ghost behind it — the trail is for wounds',
      healBar.fill > healBar.before && Math.abs(healBar.ghost - healBar.fill) < 0.01,
      JSON.stringify(healBar));

    // A 2-break card used to repaint the row in silence. The gauge counts
    // DOWN — brk is the resistance still standing — so the event to animate
    // is a pip going OUT. The first pass of this animated pips coming on,
    // which is a thing that only happens when a fight starts.
    const pips = await J(async () => {
      window.K.startCombat({ seed: 7 });
      const brk0 = window.K.state().boss.brk;
      window.K.forceHand(['sgrace', 'cleave', 'serrate', 'qthrow', 'mend']);
      window.K.playCard('sgrace');
      await new Promise(r => setTimeout(r, 40));
      const out = document.querySelectorAll('#k-break .k-pip-out');
      const cs = out[0] ? getComputedStyle(out[0]) : null;
      return { brk0, brk1: window.K.state().boss.brk,
               lit: document.querySelectorAll('#k-break .k-pip.on').length,
               out: out.length,
               anim: cs ? cs.animationName : null,
               stagger: [...out].map(e => getComputedStyle(e).animationDelay) };
    });
    check('BREAK: every pip the card knocked out goes out, one after another',
      pips.brk1 < pips.brk0 && pips.out === pips.brk0 - pips.brk1
      && pips.lit === pips.brk1 && pips.anim === 'k-pip-out'
      && new Set(pips.stagger).size === pips.out,
      JSON.stringify(pips));
  }

  // ═══ A06 · THE BOND ARRIVES WITH THE PARTY ═══
  {
    const kz = await J(() => {
      window.K.startCombat({ seed: 7, kizuna: 40 });
      const seeded = window.K.state().kizuna;
      const bar = document.getElementById('k-kz-fill');
      const shown = bar ? bar.style.width : null;
      window.K.startCombat({ seed: 7 });
      const bare = window.K.state().kizuna;
      window.K.startCombat({ seed: 7, kizuna: 900 });
      const capped = window.K.state().kizuna;
      return { seeded, shown, bare, capped };
    });
    // A four-round fodder fight cannot fill the bar from nothing, so without a
    // carry the all-out is a thing that happens against the elite and the
    // Regent and nowhere else — which makes Crescendo, the most expensive node
    // in the tree, an upgrade to a button pressed twice a run.
    check('BOND: a fight can open with the bond the run already built, and it is drawn',
      kz.seeded === 40 && kz.shown === '40%' && kz.bare === 0 && kz.capped === 100,
      JSON.stringify(kz));
  }

  // ═══ A02 · THE TELEGRAPH SAYS WHO, AND HOW MUCH EACH ═══
  console.log('\n── the telegraph ──');
  {
    const tel = await J(() => {
      window.K.startCombat({ seed: 7 });
      window.K.forceIntent('hymn');
      const rows = window.K.intentByTarget();
      const chips = [...document.querySelectorAll('#k-intent .k-ichip-atk')].map(c => ({
        n: (c.querySelector('b') || {}).textContent,
        mul: (c.querySelector('i') || {}).textContent || '',
        // WHAT MOVED: the chip carried the target as a 17px circular crop of
        // their head, so "who is about to be hit" — the single most important
        // fact on the screen — was seventeen pixels of dark hair on dark
        // armour. cardFaceHTML had already made this exact call for the card
        // corner and swapped the disc for a name; the telegraph kept the disc.
        // It reads the name now, which is also the thing a player reads.
        // …AND THE NAME BECAME A PLACE. Rows are exclusive — moveHero trades
        // places, one hero per row — so the row identifies the target exactly,
        // in ONE character instead of nine, and names the thing the player can
        // actually act on. Three blows plus a dirge ran 425px of sky with names
        // on them.
        face: (c.querySelector('u') || {}).textContent,
      }));
      const it = window.K.currentIntent();
      const total = window.K.intentPreviewDmg();
      const letters = {}; ['ash', 'elin', 'mira'].forEach(id => {
        letters[id] = window.K.ROW_LETTER[window.K.state().heroes[id].row];
      });
      // the letter is LIVE: step the hero the first blow is aimed at and the
      // chip has to follow them, or it is a label rather than a readout
      const first = rows[0].who;
      const was = letters[first];
      window.K.moveHero(first);
      const moved = [...document.querySelectorAll('#k-intent .k-ichip-atk u')]
        .map(u => u.textContent);
      const nowRow = window.K.ROW_LETTER[window.K.state().heroes[first].row];
      return { rows, chips, hits: it.hits.length, total, letters,
               live: { first, was, nowRow, moved, changed: was !== nowRow } };
    });
    // The Hymn strikes Ash twice and Elin once. The old chip read the VOLLEY
    // TOTAL with the FIRST target's face — so Elin's player was given no sign
    // they were targeted at all, and an StS-trained player read the total as
    // landing on Ash.
    // EVERY INTENT IN THE BESTIARY, AGAINST THE BOARD. The telegraph was centred
    // on a fixed x, so its width grew outward in both directions — and a
    // three-target intent that also carries a dirge measured 356px wide, ending
    // at x=943 on a 932 board. Four of the seventeen intents hung off the screen,
    // and naming the targets (see OK_WORDS above) made it worse, because a name
    // is wider than the 17px portrait crop it replaced. A centred readout of
    // variable width will always find a case that does not fit; this sweeps for
    // that case rather than waiting to meet it.
    const fits = await J(async () => {
      const bad = [];
      let n = 0;
      for (const f of Object.keys(window.K.FOES)) {
        window.K.startCombat({ foe: window.K.FOES[f], seed: 3 });
        for (const id of window.K.FOES[f].intents) {
          try { window.K.forceIntent(id); } catch (e) { continue; }
          await new Promise(r => setTimeout(r, 20));
          n++;
          const st = document.getElementById('k-stage').getBoundingClientRect();
          const r2 = document.getElementById('k-intent').getBoundingClientRect();
          if (r2.right > st.right + 0.5 || r2.left < st.left - 0.5)
            bad.push(f + '/' + id + ':' + Math.round(r2.right - st.right));
        }
      }
      return { n, bad, W: Math.round(document.getElementById('k-stage').getBoundingClientRect().width) };
    });
    // THE ROW AND THE CHIP MUST NOT DISAGREE. The incoming badge exists so the
    // threat sits beside the health bar it will empty — and a first pass folded
    // the dirge into one total, so Ash's row read a flat 12 while the telegraph
    // beside it read `9 ASH` and `3 all`. Two authoritative numbers for one
    // event is worse than the journey across the screen the badge removed. And
    // the AIMED outline has to mean aimed: every foe carries a dirge and the
    // dirge reaches everybody, so keying it on total incoming lit all three
    // rows on every turn of every fight, which is chrome.
    const rows = await J(async () => {
      window.K.startCombat({ seed: 7 });
      window.K.forceIntent('hymn');           // ash twice, elin once, mira not at all
      await new Promise(r => setTimeout(r, 60));
      const by = {};
      window.K.intentByTarget().forEach(r2 => { by[r2.who] = r2.total; });
      const dg = window.K.dirgeAmount();
      const read = {};
      ['ash', 'elin', 'mira'].forEach(id => {
        const e = document.querySelector('.k-pt-hero[data-hero="' + id + '"] .k-pt-inc');
        read[id] = e ? e.textContent.replace(/[^0-9+]/g, '') : null;
      });
      return { by, dg, read,
               aimed: [...document.querySelectorAll('.k-pt-hero.k-pt-aimed')].map(e => e.dataset.hero) };
    });
    const want = (id) => (rows.by[id] ? rows.by[id] + '+' + rows.dg : String(rows.dg));
    check('HUD: each hero’s badge shows the same two numbers the telegraph does — aimed, then shared',
      ['ash', 'elin', 'mira'].every(id => rows.read[id] === want(id)),
      JSON.stringify({ read: rows.read, aimed: rows.by, dirge: rows.dg }));
    check('HUD: the aimed outline means AIMED — not merely alive under a dirge that reaches everyone',
      rows.aimed.length === Object.keys(rows.by).length
      && rows.aimed.every(id => rows.by[id] > 0),
      JSON.stringify({ outlined: rows.aimed, targeted: Object.keys(rows.by) }));

    // THE LANE IS THE BIGGEST DEFENSIVE LEVER AND IT HAS TO BE VISIBLE. Making
    // the word bigger was not enough: at `bottom: -16px` it hangs under the
    // figure's feet, and the two heroes nearest the camera have their feet
    // INSIDE the hand — MID at y256 and FRONT at y278 against a hand beginning
    // at y253 — so two of the three were painted behind the cards and the only
    // one ever seen was whoever stood in the back.
    const lanes = await J(() => {
      const hand = document.getElementById('k-hand').getBoundingClientRect();
      return [...document.querySelectorAll('.k-hero')].map(h => {
        const w = h.querySelector('.k-hero-row'), r = w.getBoundingClientRect();
        const cs = getComputedStyle(w);
        return { who: h.dataset.hero, txt: w.textContent.trim(), px: parseFloat(cs.fontSize),
                 behind: r.top < hand.bottom && r.bottom > hand.top
                      && r.left < hand.right && r.right > hand.left };
      });
    });
    check('LANES: all three lane words are readable and none is painted behind the hand',
      lanes.length === 3 && lanes.every(l => l.txt && l.px >= 9 && !l.behind),
      JSON.stringify(lanes));

    // A TEST HOOK THAT SILENTLY SELECTS SOMETHING ELSE IS WORSE THAN NO HOOK.
    // forceIntent found the intent's index in REGENT_INTENTS — the full table of
    // eight — and assigned it to C.boss.intentIx, which currentIntent() reads
    // against the FOE'S filtered subset. Measured across the bestiary: 11 of 17
    // calls selected a different intent from the one they named. Every check in
    // this suite that names an intent on a non-Regent foe was asserting against
    // something else, and passing.
    const hook = await J(() => {
      const bad = [];
      let n = 0;
      for (const f of Object.keys(window.K.FOES)) {
        window.K.startCombat({ foe: window.K.FOES[f], seed: 3 });
        for (const want of window.K.FOES[f].intents) {
          n++;
          window.K.forceIntent(want);
          const got = window.K.currentIntent().id;
          if (got !== want) bad.push(f + ':' + want + '\u2192' + got);
        }
      }
      return { n, bad };
    });
    check('HOOK: forceIntent selects the intent it was asked for, on every foe in the bestiary',
      hook.n >= 15 && hook.bad.length === 0, JSON.stringify(hook));

    // …AND THE LANE IS A PRICED READ. A sweep loses most of its weight with
    // distance — front 1, mid 0.62, back 0.3 — so stepping back is the best
    // single AP in the game on the turn it is offered, and the telegraph showed
    // a sweep as an ordinary number with nothing to say distance mattered. The
    // mark carries the damage it would land for, computed by the same function
    // that will land it, so the promise and the outcome cannot drift.
    const swept = await J(async () => {
      // ASK THE FOE WHICH OF ITS BLOWS IS THE SWEEP. This named `scythe` on the
      // Grief-Wraith, and Build 99 dealt the Wraith its own hand — so the check
      // was forcing an intent the creature had never heard of, and measuring a
      // telegraph for a bar that was not being thrown.
      // ASK THE BESTIARY WHO ACTUALLY SWEEPS. This named `scythe` on the
      // Grief-Wraith; Build 99 dealt the Wraith its own hand and made distance
      // a BOSS's axis — a small thing aims at a place, and a place cannot be
      // stepped away from — so the sweep now lives only on the foes that reach
      // across the party. The check finds one rather than naming one.
      const sweepFoe = Object.keys(window.K.FOES).find(id =>
        window.K.currentIntentTable().some(i =>
          window.K.FOES[id].intents.indexOf(i.id) >= 0 && (i.hits || []).some(h => h.sweep)));
      window.K.startCombat({ foe: window.K.FOES[sweepFoe], seed: 3 });
      const sweeper = window.K.state().foes[0].intents.find(i => (i.hits || []).some(h => h.sweep));
      window.K.forceIntent(sweeper.id);
      await new Promise(r => setTimeout(r, 40));
      const rows = window.K.intentByTarget().filter(r => r.sweep);
      const marks = [...document.querySelectorAll('.k-ichip-sweep')].map(e => e.textContent.replace(/[^0-9]/g, ''));
      if (!rows.length) return { swept: 0 };
      const who = rows[0].who, promised = rows[0].back, before = rows[0].total;
      window.K.moveHero(who);                       // take the offer
      const after = (window.K.intentByTarget().find(r => r.who === who) || {}).total;
      return { swept: rows.length, marks, who, before, promised, after };
    });
    check('LANES: a sweep says so, and the number it promises one row back is the number that lands',
      swept.swept >= 1 && swept.marks.length === swept.swept
      && swept.after === swept.promised && swept.after < swept.before,
      JSON.stringify(swept));

    check('TELEGRAPH: every intent in the bestiary fits the board, dirge and three targets and all',
      fits.W > 900 && fits.n >= 15 && fits.bad.length === 0,
      JSON.stringify({ measured: fits.n, W: fits.W, off: fits.bad }));
    await fresh(7);
    await J(() => { window.K.startCombat({ seed: 7 }); window.K.forceIntent('hymn'); });

    // ONE CHIP PER BLOW, NOT PER TARGET. Repeats used to collapse to "9 ×2"
    // because at name-width a second chip was unaffordable; at three characters
    // two chips fit, and two marks in a row is how a player counts blows
    // without doing arithmetic. The Hymn strikes Ash twice and Elin once, so
    // this is three chips reading 9F 9F 9M — not two.
    check('TELEGRAPH: one chip per BLOW — a hero struck twice shows two marks, not a ×2',
      tel.chips.length === tel.hits && tel.hits >= 3
      && tel.chips.every(c => !c.mul),
      JSON.stringify({ chips: tel.chips.length, hits: tel.hits,
                       muls: tel.chips.map(c => c.mul) }));
    // A PLACE, NOT A PERSON. Written against the old code this goes red twice
    // over: `face` was ASH/ELIN/MIRA, which is neither one character nor a row.
    check('TELEGRAPH: each blow names the ROW it lands in, in one character, never a hero',
      tel.chips.length > 0
      && tel.chips.every(c => /^[FMB]$/.test((c.face || '').trim()))
      && tel.rows.every(r => tel.chips.some(c => c.face === tel.letters[r.who])),
      JSON.stringify({ faces: tel.chips.map(c => c.face), letters: tel.letters }));
    // …and it is a READOUT, not a label: step the target and the letter follows,
    // because that is the whole reason a row beats a name here.
    check('TELEGRAPH: the row letter is live — moving the target moves the reading',
      tel.live.changed && tel.live.moved.indexOf(tel.live.nowRow) >= 0
      && tel.live.moved.indexOf(tel.live.was) < 0,
      JSON.stringify(tel.live));
    // the numbers are still PER BLOW, the same grammar the player's own cards
    // use — each chip carries what that one blow lands for
    check('TELEGRAPH: every chip carries what THAT blow lands for',
      tel.rows.every(r => r.hits.every(d =>
        tel.chips.some(c => c.face === tel.letters[r.who] && +c.n === d))),
      JSON.stringify({ chips: tel.chips, rows: tel.rows }));
    check('TELEGRAPH: the per-target numbers still add up to the volley',
      tel.rows.reduce((n, r) => n + r.total, 0) === tel.total,
      JSON.stringify({ sum: tel.rows.reduce((n, r) => n + r.total, 0), total: tel.total }));
  }

  // ═══ A04 · A DEAD HERO LOOKS DEAD ═══
  {
    const dead = await J(async () => {
      window.K.startCombat({ seed: 7 });
      const c = window.K.state();
      c.heroes.mira.hp = 0; c.heroes.mira.downed = true;
      window.K.render();
      const fig = document.querySelector('.k-hero[data-hero="mira"]');
      const row = document.querySelector('.k-pt-hero[data-hero="mira"]');
      // opacity and filter are transitioned, so a read taken in the same frame
      // as the class returns the value it is animating FROM, not TO
      await new Promise(r => setTimeout(r, 420));
      return { field: fig.classList.contains('k-downed'),
               hud: !!(row && row.className.indexOf('down') >= 0),
               dimmed: parseFloat(getComputedStyle(fig).opacity) < 0.8,
               grey: /grayscale/.test(getComputedStyle(fig).filter) };
    });
    check('FIELD: a downed hero is down on the BOARD, not only in the roster',
      dead.field && dead.dimmed && dead.grey, JSON.stringify(dead));
  }

  // ═══ A05 · ENDING A TURN WITH AP IN HAND ASKS ONCE ═══
  {
    const et = await J(() => {
      window.K.startCombat({ seed: 7 });
      const btn = document.getElementById('k-endturn');
      const turn0 = window.K.state().turn, ap = window.K.state().ap;
      btn.onclick();                            // first press: should only arm
      const armed = btn.classList.contains('k-et-armed');
      const same = window.K.state().turn === turn0;
      return { ap, armed, same, text: btn.textContent };
    });
    check('END TURN: with AP unspent the first press asks, and says how much is left',
      et.ap > 0 && et.armed && et.same && /AP LEFT/.test(et.text), JSON.stringify(et));
  }

  console.log('\n── the string track ──');
  {
    const t = await J(async () => {
      window.K.startCombat({ seed: 7 });
      window.K.forceIntent('hymn');
      const p = window.K.endTurn();          // a live bar, not scripted grades
      for (let i = 0; i < 80; i++) {
        const tr = document.querySelectorAll('.k-strack');
        if (tr.length) {
          const first = [...tr].find(x => !x.classList.contains('k-strack-idle')) || tr[0];
          const out = { tracks: tr.length,
                        awake: [...tr].filter(x => !x.classList.contains('k-strack-idle')).length,
                        pips: first.children.length,
                        notes: (window.K.currentIntent().hits[0].notes || []).length,
                        placed: first.style.left !== '' && first.style.top !== '' };
          await p;                            // let the bar finish
          return out;
        }
        await new Promise(r => setTimeout(r, 50));
      }
      await p;
      return null;
    });
    check('TRACK: the string shows one pip per note of the hit, over the hero being struck',
      t && t.tracks >= 1 && t.pips === t.notes && t.placed, JSON.stringify(t));
    // A track belongs to its HIT, not to the bar: all hits are scheduled up
    // front, so undamped this put three rows of pips on screen at once — two
    // for blows that had not been thrown yet.
    check('TRACK: only the hit being thrown shows its pips',
      t && t.awake === 1, JSON.stringify({ tracks: t && t.tracks, awake: t && t.awake }));

    // and the rule it teaches: one dropped note kills the whole string
    const lost = await J(() => {
      const R = window.K.readString;
      return { allGreat: R(['great', 'great', 'great'], 3).turned,
               oneGood: R(['great', 'good', 'great'], 3).turned,
               allPerfect: R(['perfect', 'perfect'], 2).flawless,
               onePerfectShort: R(['perfect', 'great'], 2).flawless };
    });
    check('TRACK: the rule the pips draw is the rule the engine plays — one drop loses the string',
      lost.allGreat === true && lost.oneGood === false
      && lost.allPerfect === true && lost.onePerfectShort === false, JSON.stringify(lost));
  }

  // ═══ A0 · WHAT THE SCREEN ACTUALLY SAYS OUT LOUD ═══
  // A comprehension pass found five things a first-time player is never told.
  // Each fix is one line of text or one icon; each is worth a gate, because
  // the failure mode of a hint is that it silently stops being rendered and
  // nobody notices for six builds.
  console.log('\n── what the screen says ──');
  {
    const dirge = await J(() => {
      window.K.forceIntent('hymn');
      const t = (document.getElementById('k-intent') || {}).textContent || '';
      return { text: t, dirge: window.K.dirgeAmount() };
    });
    // WHAT MOVED at Build 72: the chip said `all · no parry`, which is true and
    // is not the whole truth — and on the single largest source of damage in
    // the fight, half a truth reads as "there is nothing to be done". There
    // are two answers. Guard absorbs it, and BROKEN cancels the entire action,
    // hymn included (`if (dirge > 0 && !result.canceled)`), and neither was
    // mentioned anywhere in the build. The rule this check is about — the
    // unparryable blow must not look like the ones you can parry — now holds by
    // naming what DOES reach it rather than by denying that anything does.
    check('SAYS: the dirge does not read as a parryable blow — it names the two things that answer it',
      dirge.dirge <= 0 || (/guard/i.test(dirge.text) && /break/i.test(dirge.text)),
      JSON.stringify(dirge));

    // THE CUE TEACHES ONCE AND THEN GETS OUT OF THE PAINTING. It used to be
    // three gold arrows standing permanently in the middle of the battlefield
    // saying a thing that is true on every turn of every fight, and the middle
    // of the battlefield is the one part of this screen meant to be a picture.
    // Written against the old code this goes red on `restVisible`: the cue was
    // opacity 0.75 at all times, so there was no turn on which it was quiet.
    const cue = await J(async () => {
      const rows = [...document.querySelectorAll('.k-hero .k-hero-row')];
      const vis = () => [...document.querySelectorAll('.k-movecue')]
        .filter(c => +getComputedStyle(c).opacity > 0.05).length;
      const out = { n: rows.length, cues: rows.filter(r => r.querySelector('.k-movecue')).length,
                    words: rows.map(r => (r.querySelector('b') || {}).textContent).join(','),
                    turn: window.K.state().turn, taught: vis() };
      // …past the opening turn it goes quiet
      window.K.state().turn = 3; window.K.render();
      await new Promise(r => setTimeout(r, 220));
      out.restVisible = vis();
      // …and comes back for the figure the finger is on
      const h = document.querySelector('.k-hero[data-hero="mira"]');
      h.classList.add('k-hero-drag');
      await new Promise(r => setTimeout(r, 220));
      out.onPoint = vis();
      h.classList.remove('k-hero-drag');
      return out;
    });
    check('SAYS: every hero carries a step cue, it teaches on turn one, then leaves the board',
      cue.n === 3 && cue.cues === 3 && /FRONT/.test(cue.words)
      && cue.taught === 3 && cue.restVisible === 0 && cue.onPoint === 1,
      JSON.stringify(cue));

    // renderHeroes writes the row word on every render; if it ever writes over
    // the whole plate again the cue disappears and only this notices
    const survives = await J(() => {
      window.K.render();
      return document.querySelectorAll('.k-hero .k-hero-row .k-movecue').length;
    });
    check('SAYS: the step cue survives a re-render — it used to be written over',
      survives === 3, survives + ' of 3');

    // THE CAPTION IS GONE — it ran off the bottom-left corner — so the free
    // swap is signalled by the gold dot on the pile alone. The invariant that
    // still matters is the one that put the caption there in the first place:
    // a touchscreen has no hover, so this must never retreat into a title
    // tooltip. What it costs is that the dot shows the swap is AVAILABLE and
    // no longer says what it is; that is a known trade, not an oversight.
    const swap = await J(() => {
      const dot = document.getElementById('k-cycle-dot');
      const vis = dot && getComputedStyle(dot).opacity;
      return { dot: !!dot, vis, spent: document.getElementById('k-deck-btn').classList.contains('k-cycle-spent'),
               titles: document.querySelectorAll('#k-deck-btn[title], #k-cycle-dot[title]').length };
    });
    check('SAYS: the free swap is shown on the pile, never in a hover tooltip a finger cannot reach',
      swap.dot && parseFloat(swap.vis) > 0 && !swap.spent && swap.titles === 0,
      JSON.stringify(swap));

    // A FEINT IS GRADED LIKE A TAP — press on the beat; doing nothing MISSES.
    // Its arrival label is WAIT, which two independent reviewers of this game
    // read as "do nothing" (the bait's rule). The note has to say NOW when the
    // window opens or the label is teaching the wrong answer.
    const feint = await J(() => {
      const words = window.K._noteWords ? window.K._noteWords() : null;
      return words;
    });
    check('SAYS: a feint says WAIT while it closes and NOW when it opens — doing nothing misses it',
      feint && feint.feint === 'WAIT' && feint.feintLive === 'NOW!'
      && feint.holdLive === 'RELEASE!' && feint.tapLive === 'TAP!'
      && feint.burstLive === null,          // a burst keeps its live tally
      JSON.stringify(feint));

    const early = await J(() => window.K.parryGrade(-400));
    check('SAYS: a rushed input is EARLY, not WAIT — WAIT is a feint’s own correct answer',
      early === null, 'way-early holds the note: ' + JSON.stringify(early));
  }

  // ═══ A · DECK INTEGRITY + THE EVALUATOR ═══
  console.log('\n── invariants ──');
  {
    const d = await J(() => {
      const c = window.K.state();
      const all = [...c.hand, ...c.deck, ...c.discard];
      const owners = {};
      all.forEach(id => { const o = window.K.evaluateCard(id).card.owner; owners[o] = (owners[o] || 0) + 1; });
      return { n: all.length, uniq: new Set(all).size, owners, hasBond: all.includes('lightsteel') };
    });
    check('DECK: 15 unique cards, 5 per hero, Resonance never in the deck',
      d.n === 15 && d.uniq === 15 && d.owners.ash === 5 && d.owners.elin === 5 && d.owners.mira === 5 && !d.hasBond,
      JSON.stringify(d.owners));
  }
  {
    let ok = true, detail = '';
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      await fresh(seed);
      const cov = await J(() => {
        const c = window.K.state();
        const o = new Set(c.hand.map(id => window.K.evaluateCard(id).card.owner));
        return { n: c.hand.length, cov: o.size };
      });
      if (cov.n !== 5 || cov.cov !== 3) { ok = false; detail = 'seed ' + seed + ': ' + JSON.stringify(cov); break; }
    }
    check('OPENING COVERAGE: 5 cards, at least one per hero, across 8 seeds', ok, detail);
  }
  {
    const src = await J(async () => (await (await fetch('game.js?v=14')).text()));
    const phaseWrites = (src.match(/C\.phase = /g) || []).length;
    check('ONE TRANSITION OWNER: setPhase is the only C.phase mutator', phaseWrites === 1, phaseWrites + ' assignments');
    check('NO FLOW METER, NO ACTION TRAIL: nothing renders a meter or a trail', await J(() =>
      !document.querySelector('#k-flow, .k-flow, .k-trail, .k-action-trail')), '');
    // The name used to promise the Follow-Up floor as well, which this check
    // never exercised — it only read printed costs. The clamp is now actually
    // driven here: a 1-cost card whose condition would discount it further has
    // to come out at 1, never 0.
    check('COST FLOOR: every printed cost ≥ 1, and a discount can never reach 0', await J(() => {
      const defs = ['cleave','guardcut','cstance','crosssever','lastlight','lcascade','mend','frostbind','sgrace','intercession','serrate','qthrow','twinfang','backstab','execute','lightsteel'];
      const printed = defs.every(id => window.K.evaluateCard(id).card.cost >= 1);
      // DRIVE THE CLAMP, do not restate it. `Math.max(1, 0) === 1` would be a
      // test of JavaScript, not of this deck. Both paths into currentCost get
      // a zero pushed through them via the per-fight card overlay, and both
      // have to come back 1.
      const C = window.K.state();
      const keepA = C.cards.cleave, keepB = C.cards.crosssever;
      C.cards.cleave = { ...keepA, cost: 0 };
      const basePath = window.K.evaluateCard('cleave').currentCost;
      C.cards.crosssever = { ...keepB, cond: { ...keepB.cond, costTo: 0 } };
      const ev = window.K.evaluateCard('crosssever');
      // only meaningful while the condition is live; when it is not, the base
      // cost is what is read and the base cost is already ≥ 1
      const condPath = ev.condActive ? ev.currentCost : 1;
      C.cards.cleave = keepA; C.cards.crosssever = keepB;
      return printed && basePath === 1 && condPath === 1
        && defs.every(id => window.K.evaluateCard(id).currentCost >= 1);
    }), '');
  }

  // ═══ B · SEQUENCING: FOLLOW-UP + FINALE ═══
  console.log('\n── sequencing ──');
  await fresh(11);
  {
    await J(() => window.K.state() && window.K.forceHand(['lcascade', 'crosssever', 'cleave', 'mend', 'serrate']));
    const before = await J(() => window.K.evaluateCard('crosssever').currentCost);
    await J(() => window.K.playCard('lcascade'));
    const after = await J(() => {
      const ev = window.K.evaluateCard('crosssever');
      return { cost: ev.currentCost, active: ev.condActive };
    });
    check('FOLLOW-UP: Cross Sever reads 2 AP cold, 1 AP right after another hero',
      before === 2 && after.cost === 1 && after.active, before + '→' + after.cost);
    await J(() => window.K.playCard('crosssever'));
    const s = await S();
    check('FOLLOW-UP: the discount actually charges 1 AP', s.ap === 1, 'ap=' + s.ap);
  }
  await fresh(12);
  {
    // THE FINALE IS THE LAST BLOW, not something bought after it. The card
    // completing the trio is what fires it — the old rule wanted all three to
    // have already acted, which costs the whole turn and left nothing to
    // finish with. Measured firing 0 times in 466 turns.
    await J(() => window.K.forceHand(['lcascade', 'serrate', 'lastlight', 'mend', 'cleave']));
    const cold = await J(() => window.K.evaluateCard('lastlight'));
    await J(() => window.K.playCard('lcascade'));                 // Elin
    const two = await J(() => window.K.evaluateCard('lastlight').condActive);
    await J(() => window.K.playCard('serrate'));                  // Mira
    const fin = await J(() => {
      const ev = window.K.evaluateCard('lastlight');
      return { active: ev.condActive, cost: ev.currentCost,
               dmg: ev.resolvedEffects.reduce((n, fx) => n + (fx.dmg || 0), 0),
               ap: window.K.state().ap };
    });
    const cs = await J(() => {
      const ev = window.K.evaluateCard('crosssever');   // follow-up is live after Mira
      return { cost: ev.currentCost, dmg: ev.resolvedEffects.reduce((n, fx) => n + (fx.dmg || 0), 0) };
    });
    const landed = await J(() => {
      const before = window.K.state().boss.hp;
      const ok = window.K.playCard('lastlight');                  // Ash completes it
      return { ok, dealt: before - window.K.state().boss.hp, ap: window.K.state().ap };
    });
    check('FINALE: the card that completes the trio IS the finale',
      !cold.condActive && !two && fin.active, 'after one other hero: ' + two);
    check('FINALE IS REACHABLE: Elin, Mira, then the finisher — inside one 3 AP turn',
      fin.ap === 1 && landed.ok && landed.dealt === 15 && landed.ap === 0,
      JSON.stringify({ apBefore: fin.ap, landed }));
    check('NO DUAL BONUS: Finale grants output, cost stays 1',
      fin.cost === 1 && fin.dmg === 15 && cold.currentCost === 1, JSON.stringify(fin));

    // A LIVE COMBO HAS TO BE SEEN, not merely be true. A card that is armed
    // reads gold and BREATHES; a follow-up — the combo the player is being
    // taught to look for, the one that exists only because of the card somebody
    // else just played and stops existing the moment anyone else acts — also
    // runs a wisp of light around its border. That is an EVENT, and a still
    // glow cannot say "right now" the way something moving can.
    //
    // Driven, not observed in passing: a first draft read whichever armed card
    // happened to be in the fan at this point in the walk, which was the FINALE
    // and then a Mend — armed, wisped, and not the thing this check is about.
    //
    // And MEASURED rather than read off the stylesheet: the wisp rides an
    // @property angle, which fails silently to a static gradient if custom
    // property animation is ever unavailable — a still ring being exactly the
    // thing this was built to stop being.
    await fresh(7);
    const wisp = await J(async () => {
      const D = window.K.CARD_DEFS, ids = Object.keys(D);
      const fu = ids.find(i2 => D[i2].cond && D[i2].cond.type === 'FOLLOW_UP');
      const other = ids.find(i2 => D[i2].owner && D[i2].owner.indexOf('|') < 0
        && D[i2].owner !== D[fu].owner && !D[i2].cond);
      window.K.forceHand([other, fu]);
      window.K.playCard(other);                        // now the follow-up is live
      await new Promise(r => setTimeout(r, 120));
      const card = document.querySelector('#k-hand .k-card-active[data-card="' + fu + '"]');
      if (!card) return { armed: false, wanted: fu };
      const w = card.querySelector('.k-wisp');
      if (!w) return { armed: true, wisp: false, id: fu };
      const r2 = w.getBoundingClientRect();
      const read = () => parseFloat(getComputedStyle(w).getPropertyValue('--wisp')) || 0;
      const a = read();
      await new Promise(res => setTimeout(res, 300));
      const b = read();
      return { armed: true, wisp: true, id: fu, ally: w.classList.contains('k-wisp-ally'),
               w: Math.round(r2.width), h: Math.round(r2.height), moved: Math.abs(b - a) > 1 };
    });
    check('ARMED: a live follow-up wears a gold wisp that actually travels its border',
      wisp.armed && wisp.wisp && wisp.ally && wisp.moved && wisp.w > 40 && wisp.h > 40,
      JSON.stringify(wisp));

    // THE ALL-OUT SAYS PRESS ME, and says it by MOVING. A ready bar used to
    // breathe a box-shadow and nothing else — a soft halo on a 15px strip,
    // beside three health bars and a damage number, is not a call to action.
    const kzPulse = await J(async () => {
      window.K.state().kizuna = 100; window.K.render();
      await new Promise(r => setTimeout(r, 120));
      const b = document.getElementById('k-kizuna');
      if (!b.classList.contains('k-kz-ready')) return { ready: false };
      const scale = () => {
        const m = getComputedStyle(b).transform.match(/matrix\(([-\d.]+)/);
        return m ? +m[1] : 1;
      };
      const seen = [];
      for (let i2 = 0; i2 < 9; i2++) { seen.push(scale()); await new Promise(r => setTimeout(r, 110)); }
      return { ready: true, anim: getComputedStyle(b).animationName,
               swell: +(Math.max(...seen) - Math.min(...seen)).toFixed(4) };
    });
    check('READY: the all-out bar swells on its own beat, not only glows',
      kzPulse.ready && kzPulse.anim === 'k-kzready' && kzPulse.swell > 0.005,
      JSON.stringify(kzPulse));
    await fresh(7);
    check('NO DUAL BONUS: Follow-Up Cross Sever costs 1, output stays 9',
      cs.cost === 1 && cs.dmg === 9, JSON.stringify(cs));
  }

  // ── the load a hand of five actually puts on you ──
  await fresh(11);
  {
    const load = await J(() => {
      const ALL = ['cleave','guardcut','cstance','crosssever','lastlight','lcascade','mend',
        'frostbind','sgrace','intercession','serrate','qthrow','twinfang','backstab','execute'];
      const conds = ALL.map(id => window.K.evaluateCard(id).card.cond)
        .filter(Boolean).map(c => c.type);
      const perHero = {};
      for (const id of ALL) {
        const c = window.K.evaluateCard(id).card;
        perHero[c.owner] = (perHero[c.owner] || 0) + (c.cond ? 1 : 0);
      }
      // every keyword must state its own rule in full somewhere the player can reach
      window.K.forceHand(['crosssever', 'cleave', 'mend', 'serrate', 'twinfang']);
      const card = document.querySelector('.k-card[data-card="crosssever"]');
      const r = card.getBoundingClientRect();
      card.dispatchEvent(new PointerEvent('pointerdown',
        { bubbles: true, clientX: r.left + 20, clientY: r.top + 20, pointerId: 21 }));
      return { conds, kinds: [...new Set(conds)].sort(), perHero, count: conds.length };
    });
    const taught = await J(async () => {
      await new Promise(r => setTimeout(r, 500));        // past the hold threshold
      const box = document.querySelector('.k-insp-cond');
      const out = { tag: box && box.querySelector('b').textContent.trim(),
                    rule: box && box.querySelector('span').textContent.trim() };
      window.K.render();
      return out;
    });
    // 15 cards, three heroes: no hero may carry more than three clauses to
    // check, and the whole deck may not exceed four distinct KEYWORDS.
    //
    // THE COUNT MOVED FROM SIX TO EIGHT AND THE KEYWORDS DID NOT MOVE AT ALL,
    // and that split is the whole argument. Build 25 set this budget after
    // measuring nine conditional cards as too much to read; the realtime
    // playtest then measured the opposite failure at six — deliberate play lit
    // 0.87 combos a turn, and 74% of turns lit none, so the ordering question
    // the deck is built on was live in barely half of them.
    //
    // Both findings are real, and they are about different costs. A new KEYWORD
    // is vocabulary: paid once by every player, forever, and it is what made
    // nine unreadable. A second card wearing a keyword the deck ALREADY teaches
    // costs a glance. So the two cards added in Build 94 both wear FOLLOW_UP —
    // the keyword count is untouched at four — and a fifth keyword that was
    // designed for this build was cut rather than spend the budget (see
    // evalCondition). Measured over 60 opening hands: clauses per hand 1.88 →
    // 2.48, combos lit by deliberate play 0.87 → 1.88, and the reward for
    // playing well rather than greedily widened from x3.25 to x3.77.
    check('LOAD: at most three conditional cards per hero, and four keywords in the whole deck',
      Object.values(load.perHero).every(n => n <= 3) && load.count <= 8
      && load.kinds.length <= 4,
      JSON.stringify({ perHero: load.perHero, total: load.count, keywords: load.kinds }));
    // …AND THE BUDGET HAS TO SURVIVE THE ROAD. `LOAD` measures the cards a run
    // STARTS with, because that is what `evaluateCard` returns on a fresh
    // combat — so for eleven builds the sharpened faces were outside it
    // entirely. That was harmless while every upgrade was the same card with a
    // bigger number, and stopped being harmless the moment Build 96 rewrote
    // them as role changes: two of them ADD a clause to a card that had none.
    //
    // The looser ceiling is deliberate and it is the whole shape of the
    // progression: a deck is meant to get more interesting as a player chooses
    // to make it so, and every clause here was PAID for at a fire. What may not
    // move is the vocabulary — a fully sharpened deck must still teach exactly
    // the four keywords the starting deck taught, or the road has smuggled in a
    // fifth without anyone deciding to.
    const grown = await J(() => {
      const ids = Object.keys(window.K.CARD_UPS);
      window.K.startCombat({ seed: 5, upgrades: ids });      // every node bought
      const ALL = ['cleave','guardcut','cstance','crosssever','lastlight','lcascade','mend',
        'frostbind','sgrace','intercession','serrate','qthrow','twinfang','backstab','execute'];
      const perHero = {}, kinds = new Set();
      let count = 0, changed = 0;
      for (const id of ALL) {
        const c = window.K.evaluateCard(id).card;
        const own = window.K.CARD_DEFS[id].owner;
        perHero[own] = (perHero[own] || 0) + (c.cond ? 1 : 0);
        if (c.cond) { count++; kinds.add(c.cond.type); }
        // …AND EVERY SHARPENED CARD IS A DIFFERENT CARD, NOT A BIGGER ONE.
        // Two ways to qualify, and both are real:
        //
        //   IT CHANGED SHAPE — different atoms, a different condition, or a
        //   different kind of reward. The bonus atoms count: Last Light+ keeps
        //   its base and its FINALE and adds Guard to what the finale pays,
        //   which the first version of this check could not see because it only
        //   looked at `.base` — it reported 6 of 9 and three false negatives.
        //
        //   IT TRADED SOMETHING AWAY — its cold face got WORSE. Execute+ is the
        //   one card here whose change is purely numeric, and it is 6 cold /14
        //   live becoming 4 cold /19 live: not a bigger execute, a sharper one,
        //   and a card you now hold rather than play. A pure buff in every
        //   state is the thing this rule exists to refuse.
        const up = window.K.CARD_UPS[id];
        if (up) {
          const base = window.K.CARD_DEFS[id];
          const atoms = (fx) => (fx || []).map(f => Object.keys(f).sort().join('+')).sort().join(',');
          const shape = (x) => [atoms(x.base), x.cond && x.cond.type, x.cond && x.cond.reward,
                                x.cond && atoms(x.cond.bonus)].join('|');
          const cold = (x) => (x.base || []).reduce((n, f) =>
            n + Object.values(f).reduce((m, v) => m + (typeof v === 'number' ? v : 0), 0), 0);
          if (shape(up) !== shape(base) || cold(up) < cold(base)) changed++;
        }
      }
      return { perHero, count, kinds: [...kinds].sort(), ups: Object.keys(window.K.CARD_UPS).length, changed };
    });
    check('LOAD: a fully sharpened deck still teaches four keywords and no more',
      grown.kinds.length <= 4 && Object.values(grown.perHero).every(n => n <= 4)
      && grown.count <= 10,
      JSON.stringify({ perHero: grown.perHero, total: grown.count, keywords: grown.kinds }));
    // A NUMBER GOING UP IS NOT A CARD. Every upgrade has to change the card's
    // SHAPE — the atoms it resolves, the condition it asks for, or the kind of
    // reward it pays — rather than only the size of what it already did.
    check('DECK: every sharpened card is a different card, not a bigger one',
      grown.changed === grown.ups,
      grown.changed + ' of ' + grown.ups + ' change shape');

    // ── THE VOCABULARY BUDGET, NOW IN TWO PARTS ────────────────────────────
    // Build 97 spends two new keywords, and the case for spending them is
    // entirely about WHERE they live. The starting fifteen still teach four:
    // a new player is taught exactly what they were taught before. JUST MOVED
    // and BEHIND A GUARD arrive only on BOND cards — earned one at a time,
    // each inside a scene that has stopped the game to explain it, and each
    // arriving next to the card that sets it up.
    //
    // That is the difference between a fifth keyword in the opening hand
    // (which Build 94 measured as too expensive and cut) and a fifth keyword
    // on a card you chose, at a moment the game is already talking to you.
    // The two ceilings are asserted separately so the distinction cannot rot:
    // the starting deck may never drift past four.
    const pool = await J(() => {
      const D = window.K.CARD_DEFS;
      const deck = Object.keys(D).filter(id => D[id].owner !== 'bond'
        && window.K.BOND_IDS.indexOf(id) < 0);
      const kinds = (ids) => [...new Set(ids.map(id => D[id].cond && D[id].cond.type)
        .filter(Boolean))].sort();
      return { start: kinds(deck), all: kinds(Object.keys(D)),
               bondsWithClause: window.K.BOND_IDS.filter(id => D[id].cond).length,
               bonds: window.K.BOND_IDS.length };
    });
    // ── A PAIR CARD'S SELF IS A PERSON ─────────────────────────────────────
    // Shipped broken for two builds: `resolveEffects` resolved self-atoms
    // against `card.owner`, which for a bond card is the string 'ash|mira', and
    // `C.heroes['ash|mira']` is undefined — so Cut the Cord's "step out of
    // reach" moved nobody and Last Vigil's "from behind a raised shield" gave
    // zero Guard, silently, while both faces said otherwise. The oldest rule in
    // this deck is that a card may not lie about itself.
    const pairSelf = await J(() => {
      const K = window.K;
      const play = (roster, id) => {
        K.startCombat({ seed: 3 });
        const st = K.state(); st.ap = 9;
        Object.keys(roster).forEach(h => { st.roster[h][0] = roster[h]; });
        K.forceHand([id, 'cleave', 'mend', 'serrate', 'frostbind']);
        const g0 = ['ash', 'elin', 'mira'].map(h => st.heroes[h].guard);
        const before = { rows: { ash: st.heroes.ash.row, mira: st.heroes.mira.row } };
        K.playCard(id);
        const s2 = K.state();
        return { before, rows: { ash: s2.heroes.ash.row, mira: s2.heroes.mira.row },
                 guardedWho: ['ash', 'elin', 'mira'].filter((h, i) => s2.heroes[h].guard > g0[i]) };
      };
      // Cut the Cord names MIRA as its self — she is the one stepping out
      const cut = play({ ash: 'cutthecord' }, 'cutthecord');
      // …and the same family, third instance: Shield the Blade targets the
      // ENEMY and reads "5 Guard · ally", so it resolved with no ally at all.
      const blade = play({ mira: 'shieldblade' }, 'shieldblade');
      // …and a pair card must never hand its own guard to one of its owners
      const bladeOwners = K.ownerHeroes(K.CARD_DEFS.shieldblade);
      return { cut, blade, bladeOwners };
    });
    check('PAIR: a bond card\u2019s self-effects land on a PERSON, and on the one it names',
      pairSelf.cut.rows.mira !== pairSelf.cut.before.rows.mira
      && pairSelf.cut.rows.mira === 'back',
      JSON.stringify({ mira: pairSelf.cut.before.rows.mira + ' -> ' + pairSelf.cut.rows.mira }));
    check('PAIR: an ally is resolved when a card NEEDS one, whatever the card is aimed at',
      pairSelf.blade.guardedWho.length === 1
      && pairSelf.blade.guardedWho.every(h => pairSelf.bladeOwners.indexOf(h) < 0),
      JSON.stringify({ target: 'enemy', guarded: pairSelf.blade.guardedWho,
                       owners: pairSelf.bladeOwners }));

    // ── AND THE TWO THINGS THE NEW KEYWORDS WATCH ──────────────────────────
    // Every other condition in the deck is about play ORDER. These are about
    // what has been DONE to a hero, which is what lets one card set up another.
    const pairs = await J(() => {
      const K = window.K;
      const dmg = (ev) => ev.resolvedEffects.reduce((n, f) => n + (f.dmg || 0), 0);
      const arm = (roster, hand) => {
        K.startCombat({ seed: 3 }); const st = K.state(); st.ap = 9;
        Object.keys(roster).forEach(h => { st.roster[h][0] = roster[h]; });
        K.forceHand(hand); return st;
      };
      arm({ ash: 'lastvigil', elin: 'shieldsong' },
          ['shieldsong', 'lastvigil', 'cleave', 'serrate', 'frostbind']);
      const vCold = K.evaluateCard('lastvigil');
      K.playCard('shieldsong');
      const warded = ['ash', 'elin', 'mira'].map(h => K.state().heroes[h].guard);
      const songDmg = 0;
      const apMid = K.state().ap;
      const vWarm = K.evaluateCard('lastvigil');
      K.playCard('lastvigil');
      const vigilCost = apMid - K.state().ap;

      arm({ ash: 'cutthecord', mira: 'twinshadow' },
          ['cutthecord', 'twinshadow', 'cleave', 'mend', 'frostbind']);
      const sCold = dmg(K.evaluateCard('twinshadow'));
      const miraWas = K.state().heroes.mira.row;
      K.playCard('cutthecord');
      // SNAPSHOT, DO NOT HOLD A HANDLE. `K.state().turnState` is the live
      // object — reading `.freeMoves` off it after the free step reads the
      // value the step just spent, so the check reported 0 banked while the
      // step it was banked for had visibly cost nothing.
      const banked = K.state().turnState.freeMoves;
      const sWarm = dmg(K.evaluateCard('twinshadow'));
      const apB = K.state().ap;
      const stepped = K.moveHero('elin', 'front');
      return { vCold: vCold.condActive, vWarm: vWarm.condActive, warded, songDmg, vigilCost,
               sCold, sWarm, miraWas, miraNow: K.state().heroes.mira.row,
               movedBy: K.state().turnState.movedBy.slice(), freeMoves: banked,
               spentTo: K.state().turnState.freeMoves,
               stepped, stepCost: apB - K.state().ap };
    });
    check('SETUP: Shieldsong wards the whole line and deals nothing — and Last Vigil then costs nothing',
      pairs.songDmg === 0 && pairs.warded.every(g => g >= 6)
      && pairs.vCold === false && pairs.vWarm === true && pairs.vigilCost === 0,
      JSON.stringify({ warded: pairs.warded, cold: pairs.vCold, warm: pairs.vWarm,
                       cost: pairs.vigilCost }));
    check('SETUP: Cut the Cord moves her, banks a free step, and Twin Shadow doubles behind it',
      pairs.miraNow === 'back' && pairs.miraNow !== pairs.miraWas
      && pairs.movedBy.indexOf('mira') >= 0
      && pairs.freeMoves === 1 && pairs.spentTo === 0
      && pairs.sWarm > pairs.sCold * 2 && pairs.stepped === true && pairs.stepCost === 0,
      JSON.stringify({ mira: pairs.miraWas + ' -> ' + pairs.miraNow, movedBy: pairs.movedBy,
                       shadow: pairs.sCold + ' -> ' + pairs.sWarm,
                       freeStepCostAp: pairs.stepCost }));
    // …and the hero who was PUSHED counts as having moved, because they are
    // standing somewhere they were not.
    check('SETUP: a hero displaced by somebody else\u2019s step has moved too',
      pairs.movedBy.length >= 2, pairs.movedBy.join(', '));

    check('LOAD: the starting fifteen still teach four keywords and no more',
      pool.start.length <= 4, pool.start.join(', '));
    check('LOAD: …and the two the road can add arrive on bond cards, never in the opening hand',
      pool.all.length <= 6 && pool.all.length - pool.start.length === 2
      && pool.all.indexOf('REPOSITIONED') >= 0 && pool.all.indexOf('WARDED') >= 0
      && pool.start.indexOf('REPOSITIONED') < 0 && pool.start.indexOf('WARDED') < 0,
      JSON.stringify({ start: pool.start, whole: pool.all }));

    check('LOAD: a keyword states its own rule — the name alone teaches nothing',
      /After an Ally/.test(taught.tag || '') && /different hero/.test(taught.rule || ''),
      JSON.stringify(taught));
  }
  await settle();
  // ── two finales, so the trio is a fork and not a script ──
  await fresh(21);
  {
    const fork = await J(() => {
      window.K.forceHand(['serrate', 'cleave', 'mend', 'twinfang', 'frostbind']);
      const st = window.K.state();
      st.heroes.elin.hp = 20; st.heroes.ash.hp = 30; st.heroes.mira.hp = 24;
      window.K.playCard('serrate');                      // Mira
      window.K.playCard('cleave');                       // Ash
      const ev = window.K.evaluateCard('mend');          // Elin closes the round
      const before = { ash: st.heroes.ash.hp, elin: st.heroes.elin.hp, mira: st.heroes.mira.hp };
      window.K.playCard('mend');
      const s2 = window.K.state();
      return { armed: ev.condActive,
               ash: s2.heroes.ash.hp - before.ash, elin: s2.heroes.elin.hp - before.elin,
               mira: s2.heroes.mira.hp - before.mira };
    });
    // Mend heals the most-hurt hero 6, and the FINALE adds 5 to everyone
    check('TWO FINALES: closing with Elin stands the party up instead of killing',
      fork.armed && fork.elin === 11 && fork.ash === 5 && fork.mira === 5, JSON.stringify(fork));
  }
  await settle();
  // ── the combo announces itself ──
  await fresh(21);
  {
    const call = await J(async () => {
      window.K.forceHand(['serrate', 'lcascade', 'lastlight', 'mend', 'cleave']);
      window.K.playCard('serrate'); window.K.playCard('lcascade');
      document.querySelectorAll('.k-combo-call').forEach(t => t.remove());
      window.K.playCard('lastlight');                    // Ash closes: FINALE
      await new Promise(r => setTimeout(r, 40));
      const tags = [...document.querySelectorAll('.k-combo-call')];
      const tag = tags[tags.length - 1];
      return { shown: !!tag, all: tags.map(t => t.textContent.trim()),
               text: tag && tag.textContent.trim(),
               big: !!(tag && tag.classList.contains('k-combo-call-big')),
               shock: document.querySelectorAll('.k-shock-gold').length };
    });
    check('COMBO CALL: a combo you built announces itself, and a FINALE takes the board',
      call.all.length === 1 && call.text === 'All Three' && call.big && call.shock >= 1,
      JSON.stringify(call));
  }
  await settle();
  // ── the three cards the combo probe indicted ──
  await fresh(17);
  {
    const back = await J(() => {
      window.K.forceHand(['backstab', 'cleave', 'mend', 'serrate', 'twinfang']);
      const front = window.K.evaluateCard('backstab');
      window.K.moveHero('mira');                       // step her upstage
      const ev = window.K.evaluateCard('backstab');
      const hp0 = window.K.state().boss.hp;
      window.K.playCard('backstab');
      return { fromFront: front.condActive, fromBack: ev.condActive,
               row: window.K.state().heroes.mira.row,   // Backstab steps her out again
               dealt: hp0 - window.K.state().boss.hp,
               coldDmg: front.resolvedEffects.reduce((n, f) => n + (f.dmg || 0), 0) };
    });
    check('FROM THE BACK: Backstab pays for the row Mira stands in, and steps her out of it',
      !back.fromFront && back.fromBack && back.coldDmg === 5 && back.dealt === 10
      && back.row === 'front', JSON.stringify(back));

    const chain = await J(() => {
      window.K.startCombat({ seed: 17 });
      window.K.forceHand(['serrate', 'cstance', 'sgrace', 'cleave', 'mend']);
      const cold = window.K.evaluateCard('cstance').condActive;
      window.K.playCard('serrate');                    // Mira opens
      const held = window.K.state().hand.length;
      window.K.playCard('cstance');                    // Ash follows: draws
      const drew = window.K.state().hand.length - (held - 1);
      const brk0 = window.K.state().boss.brk;
      window.K.playCard('sgrace');                     // Elin follows: 2 Break
      return { cold, drew, broke: brk0 - window.K.state().boss.brk,
               ap: window.K.state().ap, cost: window.K.evaluateCard('sgrace').currentCost };
    });
    check('CHAIN: a follow-up Counterstance draws, and a follow-up Shared Grace chips Break',
      !chain.cold && chain.drew === 1 && chain.broke === 2 && chain.ap === 0 && chain.cost === 1,
      JSON.stringify(chain));
  }

  // ── the Regent is not a rotation ──
  {
    const vary = await J(async () => {
      const runs = [];
      for (let seed = 0; seed < 6; seed++) {
        window.K.startCombat({ seed: 300 + seed });
        const seq = [];
        for (let t = 0; t < 7; t++) {
          seq.push(window.K.currentIntent().id);
          const r = await window.K.endTurn({ grades: Array(8).fill('miss') });
          if (!r || r.outcome !== 'continue') break;
        }
        runs.push(seq.join(','));
      }
      // count repeats WITHIN a fight — flattening across runs counts the seam
      // between one fight's last intent and the next fight's first
      let repeats = 0;
      for (const r of runs) { const q = r.split(',');
        for (let i = 1; i < q.length; i++) if (q[i] && q[i] === q[i - 1]) repeats++; }
      return { runs, distinct: new Set(runs).size, repeats,
               openers: new Set(runs.map(r => r.split(',')[0])).size,
               kinds: new Set(runs.join(',').split(',')).size };
    });
    // the same seed must still replay exactly; different seeds must not
    const replay = await J(async () => {
      const go = async () => {
        window.K.startCombat({ seed: 777 });
        const seq = [];
        for (let t = 0; t < 6; t++) {
          seq.push(window.K.currentIntent().id);
          const r = await window.K.endTurn({ grades: Array(8).fill('miss') });
          if (!r || r.outcome !== 'continue') break;
        }
        return seq.join(',');
      };
      return { a: await go(), b: await go() };
    });
    check('THE REGENT IS NOT A ROTATION: seeds fight differently, openings vary, and she never repeats back to back',
      vary.distinct >= 4 && vary.repeats === 0 && vary.kinds >= 3 && vary.openers >= 2,
      JSON.stringify({ distinctFights: vary.distinct, backToBackRepeats: vary.repeats,
        distinctOpenings: vary.openers, intentsSeen: vary.kinds, sample: vary.runs.slice(0, 2) }));
    check('THE REGENT IS DETERMINISTIC: the same seed replays the same fight',
      replay.a === replay.b && replay.a.length > 0, JSON.stringify(replay));
  }
  await settle();
  // ── the KIZUNA ladder: what the three of them build together ──
  await fresh(19);
  {
    const kz = await J(async () => {
      const st = window.K.state();
      const bar = document.getElementById('k-kizuna');
      const out = { start: st.kizuna, disabled: bar.disabled, refused: await window.K.allOut() };
      window.K.forceHand(['cleave', 'mend', 'serrate', 'frostbind', 'twinfang']);
      window.K.playCard('cleave');                      // 6 damage
      out.fromDamage = window.K.state().kizuna;
      return out;
    });
    check('KIZUNA: the ladder starts empty and cannot be spent until it is full',
      kz.start === 0 && kz.disabled && kz.refused === false && kz.fromDamage > 0,
      JSON.stringify(kz));

    const turned = await J(async () => {
      const s0 = window.K.state();
      s0.kizuna = 0;
      // THE GRADE LIST IS AS LONG AS THE BAR. It was two literal 'perfect's,
      // because the intent it named happened to be two notes; Build 94 gave the
      // Regent a heavier heal and the short list was padded out with misses, so
      // the string was never read FLAWLESS and the check measured nothing.
      window.K.forceIntent('dirgesong');
      const before = window.K.state().kizuna;
      const all = (window.K.currentIntent().hits || [])
        .flatMap(h => h.notes.map(() => 'perfect'));
      await window.K.endTurn({ grades: all });                       // FLAWLESS
      return { before, after: window.K.state().kizuna };
    });
    check('KIZUNA: turning a blow aside charges it — mastery is what builds the ladder',
      turned.after - turned.before >= 14, JSON.stringify(turned));

    const fired = await J(async () => {
      const st = window.K.state();
      st.kizuna = 100; st.boss.hp = 140; window.K.render();
      const bar = document.getElementById('k-kizuna');
      const out = { ready: bar.classList.contains('k-kz-ready'), label: bar.textContent.trim(),
                    enabled: !bar.disabled, hp0: st.boss.hp, brk0: st.boss.brk };
      const ok = await window.K.allOut();
      const s2 = window.K.state();
      out.ok = ok; out.dealt = out.hp0 - s2.boss.hp; out.broke = out.brk0 - s2.boss.brk;
      out.spent = s2.kizuna; out.ap = s2.ap; out.phase = s2.phase;
      out.again = await window.K.allOut();
      return out;
    });
    // …and it LEAVES THEM STRONGER. The all-out used to be a firework: the bar
    // filled, three of them hit at once, the bar emptied, and the party was in
    // exactly the state it had been in a second before. For a game whose
    // premise is team attacks that DEVELOP, that is the premise not happening.
    // It now raises the party's AP ceiling for the rest of the fight, which is
    // why this reads 4 where it once read 3.
    check('KIZUNA: full, it becomes a button — all three strike, it costs no AP, and it empties',
      fired.ready && /ALL-OUT/.test(fired.label) && fired.enabled && fired.ok
      && fired.dealt >= 24 && fired.broke === 4 && fired.spent === 0 && fired.ap === 4
      && fired.phase === 'PLAYER_READY' && fired.again === false,
      JSON.stringify(fired));

    // ── THE AP LADDER: three timescales, three different things earned ──────
    //
    // Slay the Spire modulates energy with relics and cards; FF7 Rebirth builds
    // its action economy out of what the party does together. This game's
    // version is one resource moved on three clocks, each paid for by a
    // different thing the party is good at:
    //
    //   THE TURN   a combo whose reward is its own AP back — order the turn
    //              right and the turn gets longer.
    //   THE FIGHT  the all-out raises the ceiling until the fight ends —
    //              earned by parrying, because kizuna charges from turned
    //              strings, and it compounds.
    //   THE ROAD   the campfire's RESOLVE node raises the base for the run.
    //
    // Each rung is asserted here except the road's, which camp.test owns.
    const gear = await J(async () => {
      window.K.startCombat({ seed: 5 });
      const st = window.K.state();
      const base = st.apMax;
      st.kizuna = 100; st.boss.hp = 400;
      await window.K.allOut();
      const one = window.K.state().apMax;
      // …and it cannot run away with a long fight
      for (let i = 0; i < 5; i++) {
        window.K.state().kizuna = 100;
        window.K._setPhase('PLAYER_READY');
        await window.K.allOut();
      }
      const many = window.K.state().apMax;
      window.K.startCombat({ seed: 6 });          // …and nothing leaks onto the road
      return { base, one, many, next: window.K.state().apMax };
    });
    check('AP · THE FIGHT: the all-out finds them another gear, capped, and it does not leave the fight',
      gear.base === 3 && gear.one === 4 && gear.many === 5 && gear.next === 3,
      JSON.stringify(gear));

    const refund = await J(() => {
      window.K.startCombat({ seed: 5 });
      window.K.forceHand(['lcascade', 'cleave', 'serrate', 'mend', 'frostbind']);
      const cold = window.K.evaluateCard('lcascade');
      const ap0 = window.K.state().ap;
      window.K.playCard('lcascade');              // led with it: nothing to follow
      const afterCold = window.K.state().ap;
      window.K.startCombat({ seed: 5 });
      window.K.forceHand(['lcascade', 'cleave', 'serrate', 'mend', 'frostbind']);
      window.K.playCard('cleave');                // an ally acts first
      const mid = window.K.state().ap;
      const warm = window.K.evaluateCard('lcascade');
      window.K.playCard('lcascade');
      return { coldLive: cold.condActive, coldRefund: cold.refund, ap0, afterCold,
               warmLive: warm.condActive, warmRefund: warm.refund,
               mid, afterWarm: window.K.state().ap };
    });
    // ONE A TURN. Measured: uncapped, two refund cards in a hand is two free
    // cards, and the ~half-parry band moved 59% -> 75% on the refunds alone
    // (the all-out's gear, for comparison, moved it one point). The cap is what
    // keeps the refund a line-enabler rather than a way to play the whole hand.
    const once = await J(() => {
      window.K.startCombat({ seed: 5 });
      window.K.state().ap = 9;
      window.K.forceHand(['cleave', 'lcascade', 'qthrow', 'mend', 'serrate']);
      window.K.playCard('cleave');                       // an ally acts
      const first = window.K.evaluateCard('lcascade').refund;
      window.K.playCard('lcascade');                     // …and is refunded
      const second = window.K.evaluateCard('qthrow').refund;   // the ally still acted
      return { first, second, live: window.K.evaluateCard('qthrow').condActive };
    });
    check('AP · THE TURN: only the first combo of a turn pays its AP back',
      once.first === 1 && once.live === true && once.second === 0,
      JSON.stringify(once));

    check('AP · THE TURN: a combo can pay its own AP back — led with it costs 1, played in the line costs 0',
      refund.coldLive === false && refund.coldRefund === 0
      && refund.afterCold === refund.ap0 - 1
      && refund.warmLive === true && refund.warmRefund === 1
      && refund.afterWarm === refund.mid,
      JSON.stringify(refund));

    // AN UPGRADE MAY NEVER TAKE A COMBO AWAY. CARD_UPS entries are whole card
    // faces rather than deltas, which is what makes them readable — and what
    // makes it possible to forget a clause and quietly hand the player a
    // sharpened card that does less. Two of them did exactly that the moment
    // the combos above landed.
    const kept = await J(() => window.K.INTENTS && Object.keys(window.K.CARD_UPS)
      .filter(id => window.K.CARD_DEFS[id].cond && !window.K.CARD_UPS[id].cond));
    check('DECK: no sharpened card loses the combo its base face carries',
      kept.length === 0, kept.join(',') || 'none');

    // …AND IT PAYS EVERY PAIR THAT THREW IT. The bond used to be bought with
    // fight LENGTH — stitches accrue once per pair per turn — so pace.sim
    // measured the social layer going the wrong way as skill rose: 0.93 / 0.50
    // / 0.29 cards won per run from a 45% parry to a 92% one. The all-out is
    // the one thing on this board that skill makes MORE frequent, because
    // kizuna charges from turned strings. So it is what the bond is paid for.
    const paid = await J(async () => {
      const st = window.K.state();
      const before = { ...st.pairBond };
      st.kizuna = 100; st.boss.hp = 200;
      const ok = await window.K.allOut();
      const s2 = window.K.state();
      const moved = Object.keys(s2.pairBond)
        .filter(k => (s2.pairBond[k] || 0) > (before[k] || 0))
        .map(k => k + ':+' + ((s2.pairBond[k] || 0) - (before[k] || 0)));
      return { ok, moved, pairs: Object.keys(s2.pairBond).length };
    });
    check('KIZUNA: three as one deepens all three — the one bond source that skill makes MORE frequent',
      paid.ok && paid.moved.length === 3 && paid.moved.every(m => /:\+4$/.test(m)),
      JSON.stringify(paid));

    // …and a party down to two pays the pair that is actually standing, not a
    // bond with somebody who is on the floor.
    const short = await J(async () => {
      const st = window.K.state();
      st.heroes.mira.downed = true; st.heroes.mira.hp = 0;
      const before = { ...st.pairBond };
      st.kizuna = 100; st.boss.hp = 200;
      const ok = await window.K.allOut();
      const s2 = window.K.state();
      const moved = Object.keys(s2.pairBond).filter(k => (s2.pairBond[k] || 0) > (before[k] || 0));
      st.heroes.mira.downed = false; st.heroes.mira.hp = 20;
      return { ok, moved };
    });
    check('KIZUNA: …and only the pairs who were standing for it',
      short.ok && short.moved.length === 1 && short.moved[0] === 'ash|elin',
      JSON.stringify(short));

    // ── THE DEEDS LEDGER ──────────────────────────────────────────────────
    // What the reckoning is allowed to talk about afterwards. Every entry has
    // to be a thing that MEASURABLY happened — a scene selected by an inferred
    // deed is a scene that will eventually describe a fight nobody had.
    const ledger = await J(async () => {
      const K = window.K;
      K.startCombat({ seed: 3 });
      const st = K.state();
      const d0 = JSON.parse(JSON.stringify(st.deeds));
      // nobody has done anything yet
      const fresh = { finisher: d0.finisher, shields: d0.shields.length,
                      stitches: Object.keys(d0.stitches).length, brink: d0.brink.length,
                      fell: d0.fell.length, asOne: d0.asOne, untouched: d0.untouched };
      // an all-out is a deed
      st.kizuna = 100; st.boss.hp = 400;
      await K.allOut();
      const afterAllOut = K.state().deeds.asOne;
      // a hero taken to a quarter of their health is on the brink; taken to
      // zero, they fell — and either way somebody has been touched
      st.heroes.mira.hp = 8;                       // 8 of 34 is under a quarter
      K._markBrink('mira');
      const brinked = K.state().deeds.brink.slice();
      st.heroes.mira.hp = 0;
      K._markBrink('mira');
      const fellen = K.state().deeds.fell.slice();
      // …and the killing blow is attributed to whoever swung it
      st.heroes.mira.hp = 20; st.heroes.mira.downed = false;
      st.boss.hp = 1;
      K._dealToBoss(50, 'hit', 'elin');
      const fin = K.state().deeds.finisher;
      return { fresh, afterAllOut, brinked, fellen, fin,
               touched: K.state().deeds.untouched };
    });
    check('DEEDS: a fresh fight has no deeds in it — nothing is assumed before it happens',
      ledger.fresh.finisher === null && ledger.fresh.shields === 0
      && ledger.fresh.stitches === 0 && ledger.fresh.brink === 0
      && ledger.fresh.fell === 0 && ledger.fresh.asOne === 0 && ledger.fresh.untouched === true,
      JSON.stringify(ledger.fresh));
    // THE KILL NEEDS TIME TO LAND. The hand-off used to fire 620ms after
    // VICTORY, which is enough to see a number and not enough to see a death —
    // the foe was still mid-recoil when the next screen arrived. On a win the
    // board now holds while it goes down, on the `broken` frames that already
    // existed and were only ever used for a stagger.
    // WHAT MOVED: this used to assert the foe was on the ground 60ms after the
    // killing blow, and it passed because the fall began in the same frame the
    // health hit zero. The beat instrument caught that at 13ms — the collapse
    // starting underneath the killing hit's own flash, so impact and death
    // arrived as one smear. The fall is now held for FOE_DEATH_HOLD, and the
    // check asserts the SEQUENCE rather than the speed: standing while the blow
    // reads, down before the road takes the board back.
    const dying = await J(async () => {
      window.K.startCombat({ seed: 3 });
      const box = document.getElementById('k-boss-art');
      const before = box.className;
      window.K.state().boss.hp = 1;
      window.K._dealToBoss(40, 'hit', 'ash');
      await new Promise(r => setTimeout(r, 60));
      const held = box.classList.contains('k-foe-down');
      let falling = false;
      for (let i = 0; i < 60 && !falling; i++) {
        await new Promise(r => setTimeout(r, 25));
        falling = box.classList.contains('k-foe-down');
      }
      return { phase: window.K.state().phase, before, held, falling };
    });
    check('DYING: the killing blow reads before the body falls, and then it falls',
      dying.phase === 'VICTORY' && !dying.held && dying.falling && !/k-foe-down/.test(dying.before),
      JSON.stringify(dying));

    // A PAIR CARD IS NOT A PERSON. Pair cards carry owner ids like 'ash|elin',
    // and dealToBoss wrote whatever it was handed straight into the ledger's
    // `finisher` — so when a pair card landed the kill, THE LAST BLOW built a
    // cast naming somebody who does not exist, openReckoning read `.n` off
    // nothing, and the whole hand-off died: the fight over, the conversation
    // never opening, the road left holding a board with no way out. Eight soak
    // runs never reached it. Sixteen did, twice. The ledger names a person or
    // nobody now, and the reckoning refuses a cast that names a stranger.
    const pairKill = await J(() => {
      window.K.startCombat({ seed: 3 });
      // …and the brink has to be REAL, not asked for. A first version called
      // _markBrink on a hero at full health, which does nothing — so THE LAST
      // BLOW had no second name, never got selected, and the reckoning half of
      // this check passed without ever building the malformed cast it exists to
      // catch. Hurt her first, then mark it.
      window.K.state().heroes.elin.hp = 2;
      window.K._markBrink('elin');
      window.K.state().boss.hp = 1;
      window.K._dealToBoss(40, 'hit', 'ash|elin');       // the two of them, together
      const d = window.K.state().deeds;
      const REAL = ['ash', 'elin', 'mira'];
      let hit = null, threw = null;
      try { hit = window.R.pickReckoning(d, REAL); } catch (e) { threw = String(e.message); }
      return { finisher: d.finisher, finishPair: d.finishPair, lastHit: d.lastHit, threw,
               brink: d.brink,
               cast: hit ? hit.cast : null,
               castReal: hit ? hit.cast.every(id => REAL.indexOf(id) >= 0) : true };
    });
    check('DEEDS: a pair card that lands the kill is recorded as the pair, never as a person who is not there',
      pairKill.finisher === null && pairKill.finishPair === 'ash|elin' && !pairKill.threw,
      JSON.stringify(pairKill));
    check('RECK: a reckoning never casts somebody who does not exist',
      pairKill.castReal && !pairKill.threw && pairKill.brink.indexOf('elin') >= 0,
      JSON.stringify(pairKill));

    check('DEEDS: striking as one, standing at a quarter, going down, and who swung last are all recorded',
      ledger.afterAllOut === 1
      && ledger.brinked.join() === 'mira' && ledger.fellen.join() === 'mira'
      && ledger.fin === 'elin',
      JSON.stringify(ledger));
  }
  await settle();

  // ═══ C · ECONOMY: cycle, hand persistence, move, Quick Throw ═══
  console.log('\n── economy ──');
  await fresh(13);
  {
    const before = await S();
    const ok1 = await J(() => window.K.cycleCard(window.K.state().hand[0]));
    const mid = await S();
    const ok2 = await J(() => window.K.cycleCard(window.K.state().hand[0]));
    check('FREE CYCLE: discard 1 draw 1, no AP, once per phase',
      ok1 && !ok2 && mid.hand.length === 5 && mid.ap === 3 && mid.discard.length === 1 && mid.cycled,
      'second cycle: ' + ok2);
  }
  await fresh(14);
  {
    await J(() => window.K.forceHand(['cleave', 'mend', 'serrate', 'frostbind', 'twinfang']));
    await J(() => window.K.playCard('cleave'));
    const keep = (await S()).hand;
    const r = await J(() => window.K.endTurn({ grades: ['miss', 'miss', 'miss', 'miss', 'miss'] }));
    const s = await S();
    check('END-OF-TURN SWEEP: the hand goes to the discard and a fresh 5 is drawn',
      keep.every(id => s.discard.includes(id)) && s.hand.length === 5
      && !keep.some(id => s.hand.includes(id) && s.discard.indexOf(id) < 0),
      'swept ' + keep.length + ' → discard ' + s.discard.length + ', hand ' + s.hand.length);
  }
  await fresh(15);
  {
    const a = await J(() => window.K.moveHero('ash'));
    const b = await J(() => window.K.moveHero('mira'));
    const s = await S();
    check('MOVE: 1 AP and once per phase', a && !b && s.ap === 2 && s.moved === 1, 'second move: ' + b);
  }
  await fresh(16);
  {
    await J(() => window.K.forceHand(['backstab', 'cleave', 'mend', 'serrate', 'frostbind']));
    const row0 = await J(() => window.K.state().heroes.mira.row);
    await J(() => window.K.playCard('backstab'));
    const s = await S();
    const canStillMove = await J(() => window.K.moveHero('ash'));
    check('PRINTED MOVEMENT: Backstab lunges Mira to the FRONT without spending the phase Move',
      row0 === 'mid' && s.heroes.mira.row === 'front' && s.moved === 0 && canStillMove,
      row0 + '→' + s.heroes.mira.row);
  }
  await fresh(17);
  {
    await J(() => window.K.forceHand(['qthrow', 'cleave', 'mend', 'serrate', 'frostbind']));
    await J(() => window.K.playCard('qthrow'));
    const mid = await S();
    const blockedPlay = await J(() => window.K.playCard('cleave'));
    const blockedEnd = await J(() => window.K.endTurn());
    await J(() => window.K.pickDiscard(window.K.state().hand[0]));
    const s = await S();
    check('QUICK THROW: draw 1 then the player discards 1 — everything else waits',
      mid.pendingDiscard && mid.hand.length === 5 && !blockedPlay && blockedEnd === null
      && !s.pendingDiscard && s.hand.length === 4,
      JSON.stringify({ mid: mid.hand.length, blockedPlay, after: s.hand.length }));
  }

  // ═══ D · STATUSES: Guard, Bleed, Chill, Break/Broken ═══
  console.log('\n── statuses ──');
  await fresh(21);
  {
    await J(() => { window.K.forceHand(['guardcut', 'cleave', 'mend', 'serrate', 'frostbind']); window.K.forceIntent('hymn'); });
    await J(() => window.K.playCard('guardcut'));
    const g = await J(() => window.K.state().heroes.ash.guard);
    const v = await volley();
    const r = await J(() => window.K.endTurn({ grades: [] }));   // no input: every string misses
    const s = await S();
    // the whole party loses HP+Guard equal to the volley plus the dirge
    const lost = (42 - s.heroes.ash.hp) + (36 - s.heroes.elin.hp) + (34 - s.heroes.mira.hp);
    check('GUARD ABSORBS FIRST: an unanswered volley spends Guard before flesh',
      g === 4 && lost === v.total + v.dirge * 3 - 4,
      JSON.stringify({ guard: g, volley: v, lost }));
  }
  await fresh(22);
  {
    await J(() => { window.K.forceHand(['sgrace', 'cleave', 'mend', 'serrate', 'frostbind']); window.K.forceIntent('dirgesong'); });
    await J(() => window.K.playCard('sgrace'));
    const g0 = await J(() => { const h = window.K.state().heroes; return [h.ash.guard, h.elin.guard, h.mira.guard]; });
    await J(() => window.K.endTurn({ grades: [] }));
    await J(() => window.K.render());
    const g1 = await J(() => { const h = window.K.state().heroes; return [h.ash.guard, h.elin.guard, h.mira.guard]; });
    check('GUARD EXPIRY: survives the enemy phase, gone at the next player phase',
      g0.every(g => g === 3) && g1.every(g => g === 0), g0 + ' → ' + g1);
  }
  await fresh(23);
  {
    await J(() => { window.K.forceHand(['serrate', 'cleave', 'mend', 'frostbind', 'twinfang']); window.K.forceIntent('hymn'); });
    await J(() => window.K.playCard('serrate'));
    const hp0 = await J(() => window.K.state().boss.hp);
    await J(() => window.K.endTurn({ grades: [] }));
    const t1 = await J(() => ({ hp: window.K.state().boss.hp, bleed: window.K.state().boss.bleed }));
    await J(() => window.K.endTurn({ grades: [] }));
    const t2 = await J(() => ({ hp: window.K.state().boss.hp, bleed: window.K.state().boss.bleed }));
    check('BLEED DECAY: ticks 3 then 2 at enemy-phase start, decreasing by 1',
      t1.hp === hp0 - 3 && t1.bleed === 2 && t2.hp === t1.hp - 2 && t2.bleed === 1,
      JSON.stringify({ hp0, t1, t2 }));
  }
  await fresh(24);
  {
    await J(() => { window.K.forceHand(['frostbind', 'cleave', 'mend', 'serrate', 'twinfang']); window.K.forceIntent('hymn'); });
    const raw = await J(() => window.K.intentPreviewDmg());
    await J(() => window.K.playCard('frostbind'));
    const chilled = await J(() => window.K.intentPreviewDmg());
    const r = await J(() => window.K.endTurn({ grades: [] }));
    const after = await J(() => window.K.state().boss.chill);
    check('CHILL: blunts the volley\'s first hit by 4 (previewed live), then clears',
      raw - chilled === 4 && r.taken === chilled && after === 0,
      raw + '→' + chilled + ' taken=' + r.taken);
  }
  await fresh(25);
  {
    await J(() => { window.K.forceHand(['crosssever', 'cleave', 'backstab', 'execute', 'mend']); window.K.forceIntent('hymn');
      window.K.state().boss.brk = 2; window.K.render(); });
    await J(() => window.K.playCard('crosssever'));
    const b = await J(() => { const s = window.K.state().boss; return { brk: s.brk, broken: s.broken, cancel: s.cancelNext }; });
    const conds = await J(() => ({ backstab: window.K.evaluateCard('backstab').condActive,
                                   execute: window.K.evaluateCard('execute').condActive }));
    const hp0 = await J(() => window.K.state().boss.hp);
    await J(() => window.K.playCard('cleave'));
    const hp1 = await J(() => window.K.state().boss.hp);
    const r = await J(() => window.K.endTurn({ grades: [] }));
    const s = await S();
    check('BREAK → BROKEN: meter to zero staggers the Regent and arms the cancel',
      b.brk === 0 && b.broken && b.cancel && conds.execute, JSON.stringify(b));
    // Cleave is a flat 7, and BROKEN takes a quarter more
    check('BROKEN: +25% damage taken during the player phase (7 → 9)',
      hp0 - hp1 === 9, 'took ' + (hp0 - hp1));
    check('BREAK CANCELLATION: the next enemy action dies; the meter refills to 12',
      r.canceled === true && s.boss.brk === 12 && !s.boss.broken && !s.boss.cancelNext,
      JSON.stringify({ canceled: r.canceled, brk: s.boss.brk }));
  }

  // ═══ E · PARRY OUTCOMES (deck §5 on the rhythm strings) ═══
  console.log('\n── defense ──');
  await fresh(31);
  {
    await J(() => { window.K.forceHand(['cleave', 'mend', 'serrate', 'frostbind', 'twinfang']); window.K.forceIntent('hymn'); });
    const v = await volley();
    const r = await J(() => window.K.endTurn({ grades: [] }));
    check('FAILED PARRY: every hit of the volley lands in full',
      r.taken === v.total && r.negated === 0, 'taken=' + r.taken + ' of ' + v.total);
  }
  await fresh(32);
  {
    await J(() => { window.K.forceHand(['cleave', 'mend', 'serrate', 'frostbind', 'twinfang']); window.K.forceIntent('hymn'); });
    const hp0 = await J(() => window.K.state().boss.hp);
    const v = await volley();
    const r = await J(async () => window.K.endTurn({ grades:
      (window.K.currentIntent().hits || []).flatMap(h => h.notes.map(() => 'great')) }));
    const hp1 = await J(() => window.K.state().boss.hp);
    // v2.2: a string read GREAT-or-better throughout is TURNED — negated whole.
    // Ash answers two hits of the Hymn and may only fully turn one; the second
    // still holds 75% of itself.
    check('TURNED: a whole string read GREAT-or-better negates its hit outright',
      r.hits.filter(h => h.turned).length === 2 && r.hits.filter(h => h.turned).every(h => h.taken === 0),
      JSON.stringify(r.hits.map(h => ({ t: h.turned, taken: h.taken }))));
    check('GREAT is not PERFECT: a turned string does not riposte',
      hp1 === hp0 && !r.riposte, hp0 + '→' + hp1 + ' riposte=' + r.riposte);
  }
  await fresh(33);
  {
    await J(() => { window.K.forceHand(['guardcut', 'cleave', 'mend', 'serrate', 'frostbind']); window.K.forceIntent('hymn'); });
    const brk0 = await J(() => window.K.state().boss.brk);
    const r = await J(async () => window.K.endTurn({ grades:
      (window.K.currentIntent().hits || []).flatMap(h => h.notes.map(() => 'great')) }));
    const brk1 = await J(() => window.K.state().boss.brk);
    const ashHits = r.hits.filter(h => h.targetId === 'ash');
    check('TURNED chips the Regent: each turned string costs it 1 Break',
      brk0 - brk1 === r.negated && r.negated === 2, 'brkDelta=' + (brk0 - brk1) + ' turned=' + r.negated);
    check('RESPONSE LIMIT: a hero fully turns only ONE hit per enemy action',
      ashHits.length === 2 && ashHits.filter(h => h.turned).length === 1
      && ashHits.some(h => !h.turned && h.mit === 1 && h.taken > 0),
      JSON.stringify(ashHits.map(h => ({ turned: h.turned, taken: h.taken }))));
  }
  await fresh(34);
  {
    await J(() => { window.K.forceHand(['cstance', 'cleave', 'mend', 'serrate', 'frostbind']); window.K.forceIntent('hymn'); });
    await J(() => window.K.playCard('cstance'));
    const brk0 = await J(() => window.K.state().boss.brk);
    const r = await J(async () => window.K.endTurn({ grades:
      (window.K.currentIntent().hits || []).flatMap(h => h.notes.map(() => 'great')) }));
    const brk1 = await J(() => window.K.state().boss.brk);
    // 1 Break per turned string, +2 from the stance on the first one only
    check('COUNTERSTANCE: the next turned string deals +2 Break, once',
      r.negated >= 1 && brk0 - brk1 === r.negated + 2, 'delta=' + (brk0 - brk1) + ' turned=' + r.negated);
  }
  // ── FLAWLESS: the summit above TURNED ──
  await fresh(36);
  {
    await J(() => { window.K.forceHand(['cleave', 'mend', 'serrate', 'frostbind', 'twinfang']); window.K.forceIntent('hymn'); });
    const hp0 = await J(() => window.K.state().boss.hp);
    const notes = await J(() => (window.K.currentIntent().hits || []).reduce((n, h) => n + h.notes.length, 0));
    const r = await J(async () => window.K.endTurn({ grades:
      (window.K.currentIntent().hits || []).flatMap(h => h.notes.map(() => 'perfect')) }));
    const hp1 = await J(() => window.K.state().boss.hp);
    check('FLAWLESS: a string read PERFECTLY throughout ripostes, 2 per note',
      r.riposte === notes * 2 && hp0 - hp1 === r.riposte,
      'riposte=' + r.riposte + ' over ' + notes + ' notes, boss ' + hp0 + '→' + hp1);
  }
  // ── PARTIAL: the grades spread across the damage instead of bunching ──
  await fresh(37);
  {
    await J(() => { window.K.forceHand(['cleave', 'mend', 'serrate', 'frostbind', 'twinfang']); window.K.forceIntent('hymn'); });
    // THE RAW IS WHAT THE ENGINE WOULD DEAL, not what the table has written in
    // it. This read `hits[0].dmg[0]` — the AUTHORED number — and every hit is
    // then scaled by `TUNE.dmgScale` and the foe's own multiplier before it
    // lands. The two agreed only while dmgScale was exactly 1.0, so the moment
    // Build 94 raised it to absorb the AP ladder this check reported the
    // mitigation maths as broken when the only thing that had changed was the
    // number it was comparing against.
    const raw = await J(() => {
      const it = window.K.currentIntent();
      return Math.round(it.hits[0].dmg[window.K.state().boss.phase - 1] * window.K.tune().dmgScale
                        * (window.K.state().foe ? window.K.state().foe.dmgMul : 1));
    });
    const mixed = await J(async () => {
      const hits = window.K.currentIntent().hits;
      // first string: one great, one miss -> weighted 0.9/2 = 0.45 mitigation
      const g = ['great', 'miss'];
      for (let i = 1; i < hits.length; i++) hits[i].notes.forEach(() => g.push('miss'));
      return window.K.endTurn({ grades: g });
    });
    const first = mixed.hits[0];
    check('PARTIAL: each note turned aside negates its share, weighted by grade',
      Math.abs(first.mit - 0.45) < 0.001 && first.taken === Math.round(raw * 0.55) && !first.turned,
      JSON.stringify({ raw, mit: first.mit, taken: first.taken }));
  }
  // ── the grading windows themselves ──
  {
    const w = await J(() => ({
      perfect: window.K.parryGrade(60), perfectEarly: window.K.parryGrade(-60),
      great: window.K.parryGrade(120), good: window.K.parryGrade(-200),
      late: window.K.parryGrade(300), tooEarly: window.K.parryGrade(-400),
    }));
    check('WINDOWS: the beat is the CENTRE of the window — a late catch is a catch',
      w.perfect === 'perfect' && w.perfectEarly === 'perfect' && w.great === 'great'
      && w.good === 'good' && w.late === 'late' && w.tooEarly === null, JSON.stringify(w));
  }
  await fresh(35);
  {
    await J(() => { window.K.forceHand(['intercession', 'cleave', 'mend', 'serrate', 'frostbind']); window.K.forceIntent('scythe'); });
    await J(() => window.K.playCard('intercession', 'mira'));
    const g = await J(() => ({ elin: window.K.state().heroes.elin.guard, mira: window.K.state().heroes.mira.guard,
                               who: window.K.state().intercession }));
    const r = await J(async () => window.K.endTurn({ grades:
      (window.K.currentIntent().hits || []).flatMap(h => h.notes.map(() => 'great')) }));
    const s = await S();
    const miraHit = r.hits.find(h => h.targetId === 'mira');
    check('INTERCESSION: both gain 3 Guard and Elin steps into Mira\'s window',
      g.elin === 3 && g.mira === 3 && g.who === 'mira' && miraHit && miraHit.parrierId === 'elin',
      JSON.stringify(g));
    check('INTERCESSION NEGATE: Elin\'s Guard pays and the blow aimed at Mira is erased',
      miraHit && miraHit.negated && miraHit.taken === 0 && s.intercession === null,
      JSON.stringify(miraHit));
  }

  // ═══ F · BOND AND RESONANCE ═══
  console.log('\n── resonance ──');
  await fresh(41);
  {
    await J(() => { window.K.forceHand(['lcascade', 'cleave', 'mend', 'guardcut', 'serrate']); window.K.forceIntent('dirgesong'); });
    await J(() => { window.K.playCard('lcascade'); window.K.playCard('cleave'); });   // elin → ash: stitch
    const s1 = await J(() => ({ res: window.K.state().bond.stitches,
                                pair: window.K.state().pairBond['ash|elin'] || 0 }));
    await J(() => { window.K.playCard('mend'); });                                     // ash → elin adjacency again
    const s2 = await J(() => ({ res: window.K.state().bond.stitches,
                                pair: window.K.state().pairBond['ash|elin'] || 0 }));
    // THIS CHECK WAS HOLLOW. It read `bond.stitches` — the RESONANCE counter,
    // which is the one thing the cap was correctly applied to — and never
    // touched `pairBond`, the currency actually at risk. The only line that
    // recorded a pair as stitched lived inside the Resonance branch, so the cap
    // held for exactly one case (ash|elin, before Light Through Steel exists)
    // and that is precisely the case this check drove. Measured with the guard
    // removed: elin|mira paid 2 → 4 across two adjacencies in one turn and
    // ash|elin paid 2 → 6 across four, while this check stayed green.
    check('BOND STITCH: an Ash↔Elin Follow-Up stitches the pair — max 1 per phase, in POINTS as well as in the counter',
      s1.res === 1 && s2.res === 1 && s1.pair > 0 && s2.pair === s1.pair,
      JSON.stringify({ s1, s2 }));
    await J(() => window.K.endTurn({ grades: [] }));
    await J(() => { window.K.forceHand(['lcascade', 'cleave', 'mend', 'guardcut', 'serrate']); window.K.forceIntent('dirgesong'); });
    await J(() => { window.K.playCard('lcascade'); window.K.playCard('cleave'); });
    const gen = await S();
    // …AND FOR THE PAIRS WITH NO COUNTER TO HIDE BEHIND. ash|mira and elin|mira
    // generate no Resonance card, so nothing about them was ever recorded and
    // nothing ever checked them. They are the two thirds of the social layer
    // the old check could not see.
    const others = await J(async () => {
      const D = window.K.CARD_DEFS, ids = Object.keys(D);
      // ONE HERO, TWO OF THEIR CARDS. This filtered on `!D[i].cond` — cards
      // with nothing to read — which had nothing to do with what it is
      // testing (a stitch is owner adjacency; a condition cannot change who
      // owns a card) and everything to do with how many plain cards happened
      // to be in the deck that week. Build 94 gave three vanilla cards a
      // combo, Mira was left with one, `solo('mira')[1]` came back undefined
      // and the whole suite crashed inside renderHand. It asks for what it
      // actually needs now: a hero's own cards, at the cost this turn can pay.
      const solo = (who) => ids.filter(i => D[i].owner === who && D[i].cost === 1);
      const out = {};
      for (const [pair, x, y] of [['elin|mira', 'mira', 'elin'], ['ash|mira', 'mira', 'ash']]) {
        window.K.startCombat({ seed: 3 });
        window.K.state().ap = 9;
        window.K.forceHand([solo(x)[0], solo(y)[0], solo(x)[1]]);
        window.K.playCard(solo(x)[0]); window.K.playCard(solo(y)[0]);
        const two = window.K.state().pairBond[pair] || 0;
        window.K.playCard(solo(x)[1]);                       // a second adjacency, same turn
        out[pair] = { two, three: window.K.state().pairBond[pair] || 0 };
      }
      return out;
    });
    check('BOND STITCH: the cap holds for the two pairs that have no Resonance counter',
      Object.values(others).every(o => o.two > 0 && o.three === o.two),
      JSON.stringify(others));
    await fresh(41);
    await J(() => { window.K.forceHand(['lcascade', 'cleave', 'mend', 'guardcut', 'serrate']); window.K.forceIntent('dirgesong'); });
    await J(() => { window.K.playCard('lcascade'); window.K.playCard('cleave'); });
    await J(() => window.K.endTurn({ grades: [] }));
    await J(() => { window.K.forceHand(['lcascade', 'cleave', 'mend', 'guardcut', 'serrate']); window.K.forceIntent('dirgesong'); });
    await J(() => { window.K.playCard('lcascade'); window.K.playCard('cleave'); });

    check('RESONANCE GENERATED: two stitches put Light Through Steel in the hand',
      gen.bond.stitches === 2 && gen.bond.generated && gen.hand.includes('lightsteel'),
      JSON.stringify(gen.bond) + ' hand=' + gen.hand.join(','));
    const hp0 = await J(() => window.K.state().boss.hp);
    await J(() => window.K.playCard('lightsteel'));
    const s = await S();
    check('LIGHT THROUGH STEEL: 1 AP, 10 damage, all heroes +4 Guard, EXHAUSTS',
      hp0 - s.boss.hp === 10 && s.heroes.ash.guard >= 4 && s.heroes.elin.guard >= 4 && s.heroes.mira.guard >= 4
      && s.exhausted.includes('lightsteel') && !s.discard.includes('lightsteel'),
      JSON.stringify({ dmg: hp0 - s.boss.hp, ex: s.exhausted }));
    await J(() => window.K.endTurn({ grades: [] }));
    await J(() => { window.K.forceHand(['lcascade', 'cleave', 'mend', 'guardcut', 'serrate']); window.K.forceIntent('dirgesong'); });
    await J(() => { window.K.playCard('lcascade'); window.K.playCard('cleave'); });
    const again = await S();
    check('ONE AUTHORED CLIMAX: the Resonance never regenerates this encounter',
      !again.hand.includes('lightsteel') && again.bond.generated, 'hand=' + again.hand.join(','));
  }

  // ═══ G · THE REGENT ═══
  console.log('\n── the regent ──');
  await fresh(51);
  {
    // THE REGENT'S HEAL IS ITS OWN INTENT NOW. `benediction` was two notes, and
    // it was the bar dragging the boss's floor down to the Hollow Husk's — the
    // first fight of a run and the last could open on the same amount. The
    // Regent sings the Mourning Dirge instead: the same act at the weight of
    // the thing singing it, five notes, a feint inside it. The Choir of One
    // keeps the light one, which is the fodder's whole character.
    await J(() => { window.K.forceIntent('dirgesong'); window.K.state().boss.hp = 100; window.K.render(); });
    await J(() => window.K.endTurn({ grades: [] }));
    const hp = await J(() => window.K.state().boss.hp);
    check('DIRGESONG: the Regent sings itself whole (+7)', hp === 107, 'hp=' + hp);
  }
  await fresh(52);
  {
    await J(() => { window.K.state().boss.hp = 61; window.K.render(); });
    await J(() => { window.K.forceHand(['cleave', 'mend', 'serrate', 'frostbind', 'twinfang']); });
    await J(() => window.K.playCard('cleave'));
    const p = await J(() => window.K.state().boss.phase);
    check('PHASE II: the dirge sharpens at half health', p === 2, 'phase=' + p);
  }
  await fresh(53);
  {
    await J(() => { window.K.state().heroes.ash.hp = 0; window.K.state().heroes.ash.downed = true;
      window.K.forceIntent('hymn'); window.K.render(); });
    const tgt = await J(() => window.K.intentTargetId());
    const dead = await J(() => {
      window.K.forceHand(['cleave', 'mend', 'serrate', 'frostbind', 'twinfang']);
      return { play: window.K.playCard('cleave'),
               deadInHand: !!document.querySelector('.k-card[data-card="cleave"].k-card-dead') };
    });
    check('DOWNED: the Hymn finds a hero still standing; the fallen\'s cards are dead',
      tgt !== 'ash' && tgt != null && !dead.play && dead.deadInHand, 'tgt=' + tgt);
  }

  // ═══ H · PRESENTATION ═══
  console.log('\n── presentation ──');
  await fresh(7);
  // A FRESH FIGHT PUTS EVERYONE BACK IN THEIR OPENING LANE, BUT NOT INSTANTLY.
  // The figures GLIDE there from wherever the last section left them, and a
  // lane is a depth — so a hero measured mid-glide is measured at the wrong
  // size and the wrong x. That is what made the KIZUNA overlap check flaky:
  // Elin's box read 33px further left while she was still walking back. The
  // rule is unchanged; the measurement now waits for the board to stand still.
  await J(async () => {
    const box = () => [...document.querySelectorAll('.k-hero')]
      .map(n => { const r = n.getBoundingClientRect(); return [r.left, r.top, r.width].join(); }).join('|');
    let last = '', same = 0;
    for (let i = 0; i < 90; i++) {
      const now = box();
      same = now === last ? same + 1 : 0;
      if (same >= 3) return true;
      last = now;
      await new Promise(r => requestAnimationFrame(r));
    }
    return false;
  });
  {
    const ui = await J(async () => {
      // MEASURE A STILL BOARD. The heroes GLIDE between lanes on a 620ms
      // transition, and a rect read mid-glide reports a hero 33px to the left
      // of where they will stop, in a wider box — which is how kzClear kept
      // reporting the all-out bar colliding with Elin on some runs and not
      // others. This has been re-rolled past several times; a fixed sleep only
      // moves the odds. It polls until two consecutive frames agree about where
      // everybody is, and measures that.
      const snap = () => [...document.querySelectorAll('.k-hero')]
        .map(n => { const r = n.getBoundingClientRect();
          return Math.round(r.left) + ',' + Math.round(r.top) + ',' + Math.round(r.width); }).join('|');
      let was = snap();
      for (let i = 0; i < 90; i++) {
        await new Promise(r => requestAnimationFrame(r));
        const now = snap();
        if (now === was && now) break;
        was = now;
      }
      const ir = document.getElementById('k-intent').getBoundingClientRect();
      const br = document.getElementById('k-boss-art').getBoundingClientRect();
      const clearOf = (r) => ir.right < r.left || ir.left > r.right || ir.bottom < r.top || ir.top > r.bottom;
      // the telegraph floats in the sky ABOVE the Regent's head: horizontally
      // over the figure, vertically clear of it and of the boss HUD
      const hud = document.getElementById('k-boss-hud').getBoundingClientRect();
      const disjoint = ir.bottom < br.top + br.height * 0.45
        && clearOf(document.getElementById('k-party-hud').getBoundingClientRect());
      // WHAT MOVED at Build 73: this required the row to fit INSIDE the Regent's
      // sprite, ±40px. That held while the telegraph was three bare numbers and
      // stopped holding the moment it started saying WHO each blow is for and
      // what stepping back would cost — the readout outgrew the figure it
      // describes. It is also why the row used to hang 11px off the board: a
      // thing centred on her and grown outward has nowhere to go.
      //
      // The rule the check is really about is that you read the threat where the
      // threatener is. That is now expressed as: the row covers her, ends on her
      // side of the board rather than drifting away from it, and stays clear of
      // the HUD above it.
      const overHead = ir.left < br.right && br.left < ir.right
        && Math.abs(ir.right - br.right) < 60
        && ir.top >= hud.bottom - 1;
      const oneLine = ir.height < 34;
      const chips = document.querySelectorAll('#k-intent .k-ichip');
      const iconed = [...chips].every(c => c.querySelector('svg.k-ico') && c.querySelector('b'));
      // THE TELEGRAPH IS ICONS AND NUMBERS, plus a fixed, tiny vocabulary of
      // qualifiers — never a name, never a sentence. This used to be "no word
      // of four letters or more", which was a proxy for the real rule and duly
      // failed the moment the dirge had to admit it cannot be parried. The
      // rule is now stated directly: every word on the telegraph must come
      // from the allow-list, so a name or a hint sentence still fails it.
      // …and REWRITTEN AGAIN at Build 71. The allow-list existed to keep the
      // telegraph from growing back into the prose banner it replaced — a name,
      // a hint sentence, a rule restated. It also forbade the one word the
      // telegraph most needs: WHO. The target was carried instead by a 17px
      // circular crop of character art, three dark-haired figures on dark
      // armour, which cardFaceHTML had already rejected for the card corner on
      // exactly those grounds. The rule it was always really about — no
      // sentences, no restated rules — holds with the three heroes' names
      // added, and nothing else.
      // 'guard' and 'break' join the list at Build 72: the dirge chip names the
      // two counterplays that reach it instead of saying `no parry`.
      // …AND THE THREE HERO NAMES LEAVE IT AT BUILD 77. The target is a row
      // letter now — rows are exclusive, so one character says it exactly — and
      // the names are not merely no longer needed, they are forbidden: three
      // nine-letter names is the 425px of sky this readout is climbing out of.
      const OK_WORDS = ['all', 'or', 'guard', 'break', 'f', 'm', 'b'];
      // PER ELEMENT, not off the raw textContent. The row plate and the
      // counterplay hint are adjacent spans with no whitespace between them, so
      // reading the container whole glued ALL to Guard and reported a word
      // nobody wrote. The probe was measuring its own concatenation.
      const iEl = document.getElementById('k-intent');
      const words = [...iEl.querySelectorAll('b, u, i, em')]
        .flatMap(e => e.textContent.match(/[A-Za-z]+/g) || []);
      const noWords = words.every(w => OK_WORDS.indexOf(w.toLowerCase()) >= 0)
        && !/ash|elin|mira/i.test(iEl.textContent);
      const noBanner = !document.getElementById('k-int-notes') && !document.getElementById('k-int-hint')
        && !document.getElementById('k-int-name');
      const rows = document.querySelectorAll('.k-pt-hero').length;
      const bars = document.querySelectorAll('.k-pt-hero .k-bar-fill').length;
      const cards = document.querySelectorAll('#k-hand .k-card');
      const fanned = [...cards].some(c => (c.style.getPropertyValue('--rot') || '0deg') !== '0deg');
      const pips = document.querySelectorAll('#k-break .k-pip').length;

      // no card may hang off the stage — the fan grew when the faces were redesigned
      const st = document.getElementById('k-stage').getBoundingClientRect();
      const over = [...cards].map(c => {
        const b = c.getBoundingClientRect();
        return Math.max(b.bottom - st.bottom, st.top - b.top, st.left - b.left, b.right - st.right);
      });
      const clipped = over.filter(o => o > 0.5).length;
      const worstOver = Math.round(Math.max(...over));

      return { disjoint, rows, bars, cards: cards.length,
        fanned, pips,
        noMove: !document.querySelector('.k-hero-move'),
        ap: document.getElementById('k-ap-num').textContent,
        apPips: document.querySelectorAll('#k-ap-pips .k-ap-pip').length,
        apLit: document.querySelectorAll('#k-ap-pips .k-ap-pip:not(.k-ap-off)').length,
        // the far-left furniture is gone: no bond meter, no log line, no CYCLE chip
        gone: !document.querySelector('.k-bond-row') && !document.getElementById('k-piles')
              && !document.querySelector('#k-log:not(.k-sr)'),
        // the telegraph must not print over the Break pips
        breakClear: (() => {
          const a = document.getElementById('k-intent').getBoundingClientRect();
          const b = document.getElementById('k-break').getBoundingClientRect();
          return a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom;
        })(),
        // THE RULE MOVED IN BUILD 56. The ladder used to live in the open sky
        // between the two HUDs and this asked it to clear everything including
        // the party HUD — which was right while it floated, and is wrong now
        // that it is deliberately PART of the party block. It reads as the
        // party's meter because it sits with the party.
        //
        // What still has to hold is the thing this was really guarding: it must
        // not print over the battlefield or the far HUD, and it must sit BELOW
        // every hero row rather than on top of one. Flowing inside the block
        // rather than pinned to a `top` is also what makes that durable — the
        // party stack grows as status chips appear, and a fixed offset under it
        // would eventually collide, which is exactly how this check failed.
        // …and it reports WHICH of the three it broke. A bare false here cost a
        // whole debugging session: the collision is state-dependent (it needs a
        // hero moved or a chip grown), so a failure that names neither the
        // clause nor the element it hit cannot be reproduced from the log.
        kzClear: (() => {
          const kz = document.getElementById('k-kizuna');
          const k = kz.getBoundingClientRect();
          const hit = (r) => !(k.right <= r.left || k.left >= r.right
            || k.bottom <= r.top || k.top >= r.bottom);
          const named = [['boss-hud', document.getElementById('k-boss-hud')],
            ['intent', document.getElementById('k-intent')]]
            .concat([...document.querySelectorAll('.k-hero')]
              .map(n => ['hero:' + n.dataset.hero, n]));
          const hits = named.filter(([, n]) => hit(n.getBoundingClientRect())).map(([nm]) => nm);
          const rows = [...document.querySelectorAll('.k-pt-hero')];
          const low = Math.max(...rows.map(n => n.getBoundingClientRect().bottom));
          const belowRows = low <= k.top + 0.5;
          const inParty = document.getElementById('k-party-hud').contains(kz);
          const boxes = {};
          named.filter(([nm]) => hits.indexOf(nm) >= 0).forEach(([nm, n]) => {
            const r = n.getBoundingClientRect();
            boxes[nm] = [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)];
          });
          const cast = document.getElementById('k-cast');
          return { ok: !hits.length && belowRows && inParty, hits, inParty, boxes,
                   kz: [Math.round(k.left), Math.round(k.top), Math.round(k.right), Math.round(k.bottom)],
                   camx: cast ? cast.style.getPropertyValue('--cam-x') : '',
                   castCls: cast ? cast.className : '',
                   belowRows, rowsBottom: Math.round(low) };
        })(),
        clipped, worstOver,
        overHead, oneLine, noBanner, iconed, noWords, chipN: chips.length,
        preview: window.K.intentPreviewDmg(),
        dirge: !!document.querySelector('#k-intent .k-ichip-dirge'),
        atk: (document.querySelector('#k-intent .k-ichip-atk b') || {}).textContent,
        // one chip per hero struck: the numbers must ADD UP to the volley, and
        // no single chip is expected to equal it any more
        perTargetSums: window.K.intentByTarget().reduce((n, r) => n + r.total, 0)
          === window.K.intentPreviewDmg(),
        // the target is NAMED now, not cropped — see OK_WORDS above
        hasTargetFace: !!document.querySelector('#k-intent .k-ichip-atk u'),
        hasDirge: !!document.querySelector('#k-intent .k-ichip-dirge') };
    });
    check('UI: intent clear of the Regent AND both HUDs; stacked rows; fanned hand; 12 Break pips; telegraph is icon chips above the Regent; no card clipped',
      ui.disjoint && ui.rows === 3 && ui.bars === 3 && ui.cards === 5 && ui.fanned
      && ui.pips === 12 && ui.noMove && ui.ap === '3' && ui.apPips === 3 && ui.apLit === 3
      && ui.gone && ui.breakClear && ui.kzClear.ok
      && ui.clipped === 0 && ui.overHead && ui.oneLine && ui.noBanner
      && ui.iconed && ui.noWords && ui.perTargetSums && ui.hasTargetFace && ui.hasDirge,
      JSON.stringify(ui));
    const hover = await J(async () => {
      const card = document.querySelector('#k-hand .k-card');
      const r = card.getBoundingClientRect();
      card.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: r.left + 200, clientY: r.top - 100 }));
      await new Promise(res => setTimeout(res, 60));
      return !card.classList.contains('k-dragging');
    });
    check('UI: a bare hover is not a drag — pointer tracking arms only on a real press', hover, '');
  }
  // ── the aim beam, restored from v2.2 ──
  await fresh(7);
  {
    const beam = await J(async () => {
      const card = [...document.querySelectorAll('#k-hand .k-card')]
        .find(c => c.dataset.card && window.K.evaluateCard(c.dataset.card).card.target === 'enemy');
      const r = card.getBoundingClientRect();
      const boss = document.getElementById('k-boss-art').getBoundingClientRect();
      const at = (x, y, t) => card.dispatchEvent(new PointerEvent(t, { bubbles: true, clientX: x, clientY: y, pointerId: 1 }));
      at(r.left + r.width / 2, r.top + 10, 'pointerdown');
      at(boss.left + boss.width / 2, boss.top + boss.height / 2, 'pointermove');
      await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
      const svg = document.getElementById('k-aim');
      const out = {
        layer: !!svg,
        glow: !!svg && !!svg.querySelector('.k-aim-glow'),
        dotted: !!svg && svg.querySelector('.k-aim-dash')
          && svg.querySelector('.k-aim-dash').getAttribute('stroke-dasharray') === '3 9',
        crimson: !!svg && /#e05b52/i.test(svg.querySelector('.k-aim-dash').getAttribute('stroke') || ''),
        reticle: !!svg && !!svg.querySelector('.k-aim-ret'),
        brackets: !!svg && !!svg.querySelector('.k-aim-r1 path') && !!svg.querySelector('.k-aim-dot'),
        bowed: !!svg && /^M .+ Q .+ .+$/.test(svg.querySelector('.k-aim-dash').getAttribute('d') || ''),
        snapped: document.getElementById('k-boss-art').classList.contains('k-aim-snap'),
      };
      // the card TRACKS the finger (v2.2 feel), trailing down-left of it so it
      // never covers the arc and reticle it is casting
      const held = card.getBoundingClientRect();
      const pxx = boss.left + boss.width / 2, pyy = boss.top + boss.height / 2;
      out.tracksFinger = Math.abs(held.left + held.width / 2 - pxx) < 140;
      out.trailsBelowLeft = (held.top + held.height / 2) > pyy
        && (held.left + held.width / 2) < pxx;
      at(boss.left + boss.width / 2, boss.top + boss.height / 2, 'pointerup');
      // "cleared" means no beam is drawn. An absent layer satisfies that as
      // fully as an empty one, and assuming the element survives made this a
      // crash rather than a failure.
      const aim = document.getElementById('k-aim');
      out.cleared = !aim || !aim.querySelector('.k-aim-dash');
      return out;
    });
    check('AIM: picking a card casts the v2.2 beam — crimson dotted arc, bracket reticle',
      beam.layer && beam.glow && beam.dotted && beam.crimson && beam.reticle
      && beam.brackets && beam.bowed, JSON.stringify(beam));
    check('AIM: the beam snaps to a legal target and clears on release',
      beam.snapped && beam.cleared, JSON.stringify({ snapped: beam.snapped, cleared: beam.cleared }));
    check('AIM: the card follows the finger, trailing clear of its own reticle',
      beam.tracksFinger && beam.trailsBelowLeft,
      JSON.stringify({ tracks: beam.tracksFinger, trails: beam.trailsBelowLeft }));
  }
  // ── card anatomy: Slay-the-Spire readability on a phone ──
  await fresh(11);
  {
    const anat = await J(() => {
      window.K.forceHand(['crosssever', 'guardcut', 'mend', 'serrate', 'twinfang']);
      const q = (id) => document.querySelector('.k-card[data-card="' + id + '"]');
      // guardcut is the card with NO combo band — Cleave earned one in Build 23
      const cs = q('crosssever'), cl = q('guardcut');
      const px = (el, p) => el ? parseFloat(getComputedStyle(el)[p]) : 0;
      return {
        gem: cs.querySelector('.k-cgem').textContent.trim(),
        // innerText, not textContent: the clauses are on separate lines now and
        // textContent glues them into "9 damage.2 Break."
        prose: cs.querySelector('.k-cprose').innerText.replace(/\s+/g, ' ').trim(),
        // one ROW per clause now, not one <br> between them
        proseLines: cs.querySelectorAll('.k-crow').length,
        bolded: cs.querySelectorAll('.k-cprose b').length,
        icons: cs.querySelectorAll('.k-cprose .k-ico').length,
        condIcon: !!cs.querySelector('.k-combo-tag .k-ico'),
        ratio: +(cs.offsetWidth / cs.offsetHeight).toFixed(3),
        tag: cs.querySelector('.k-combo-tag').textContent.replace(/\s+/g, ' ').trim(),
        state: (cs.querySelector('.k-combo-state') || {}).textContent || '',
        pay: cs.querySelector('.k-combo-pay').textContent.replace(/\s+/g, ' ').trim(),
        plainProse: cl.querySelector('.k-cprose').innerText.replace(/\s+/g, ' ').trim(),
        noCondOnCore: !cl.querySelector('.k-combo'),
        proseSize: px(cs.querySelector('.k-crow'), 'fontSize'),
        numSize: px(cs.querySelector('.k-cprose b'), 'fontSize'),
        rowRule: getComputedStyle(cs.querySelectorAll('.k-crow')[1]).borderTopWidth,
        nRows: cs.querySelectorAll('.k-crow').length,
        paySize: px(cs.querySelector('.k-combo-pay'), 'fontSize'),
        gemSize: px(cs.querySelector('.k-cgem'), 'fontSize'),
        banded: getComputedStyle(cs.querySelector('.k-combo')).borderTopWidth,
        textBox: !!cs.querySelector('.k-ctext'),
      };
    });
    // A ROW IS NOT A SENTENCE. The clauses are set in small caps without a
    // trailing full stop now — the period was punctuating a line that is a
    // list item, and read as a smudge at 8px. The rule the check is really
    // holding is unchanged: one clause per row, a mark on each, the number
    // bolded, and the plain card carrying no combo.
    check('CARD: the rules are one clause per row, marked, with the numbers bolded',
      anat.prose === '9 DAMAGE 2 BREAK' && anat.proseLines === 2
      && anat.bolded === 2 && anat.icons === 2
      && anat.plainProse === '4 DAMAGE 4 GUARD' && anat.textBox && anat.noCondOnCore,
      JSON.stringify(anat));
    // The combo must not read as one more grey sentence: it is a named,
    // banded block, and the base line is the biggest type on the face.
    // THE ART IS BEHIND THE WORDS, AND THE WORDS ARE LIGHT ON DARK. The card
    // is a dark plate with a portrait bled through it now, which buys the look
    // and costs a risk the parchment card did not have: if the art layer ever
    // rises over the text, or the scrim under the rules stops being dark, the
    // face is still "there" and completely unreadable — and nothing else in
    // the suite would notice.
    const legible = await J(() => {
      window.K.startCombat({ seed: 7 });
      window.K.forceHand(['crosssever', 'mend', 'serrate', 'cleave', 'frostbind']);
      const c = document.querySelector('.k-card[data-card="crosssever"]');
      const lum = (col) => {
        const m = (col || '').match(/[\d.]+/g); if (!m) return null;
        const [r, g, b] = m.map(Number);
        return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      };
      const zi = (el) => { const v = getComputedStyle(el).zIndex; return v === 'auto' ? 0 : +v; };
      const art = c.querySelector('.k-cart'), bg = c.querySelector('.k-cbg');
      const text = c.querySelector('.k-ctext'), name = c.querySelector('.k-cname');
      return {
        hasArt: !!bg, artZ: zi(art), textZ: zi(text), nameZ: zi(name),
        scrim: getComputedStyle(art, '::after').backgroundImage.indexOf('gradient') >= 0,
        plate: lum(getComputedStyle(c).backgroundColor) ,
        plateImg: getComputedStyle(c).backgroundImage.indexOf('gradient') >= 0,
        nameLum: lum(getComputedStyle(name).color),
        proseLum: lum(getComputedStyle(c.querySelector('.k-crow')).color),
        numLum: lum(getComputedStyle(c.querySelector('.k-cprose b')).color),
        payLum: lum(getComputedStyle(c.querySelector('.k-combo-pay')).color),
      };
    });
    // EVERY CARD ITS OWN PAINTING. Until Build 42 the picture was the hero's
    // portrait, so all five of a hero's cards carried one image and the art
    // could only say WHOSE card this was, never WHICH. This asserts the thing
    // that changed: five different cards show five different pictures, and a
    // painting fills the plate as composed rather than being blown up to 172%
    // and anchored high the way a full-body portrait has to be. The fallback
    // is asserted too — a card with no painting yet must still get the bust,
    // not a stretched portrait or an empty plate.
    const art = await J(() => {
      window.K.startCombat({ seed: 7 });
      window.K.forceHand(['cleave', 'mend', 'serrate', 'frostbind', 'execute']);
      const srcs = [...document.querySelectorAll('#k-hand .k-card .k-cbg')]
        .map(i => i.getAttribute('src'));
      const one = document.querySelector('#k-hand .k-card[data-card="cleave"]');
      const img = one.querySelector('.k-cbg'), plate = one.querySelector('.k-cart');
      // LAYOUT SIZE, NOT SCREEN SIZE. The hand is a FAN — every card carries a
      // rotate and a 3D lean — and `getBoundingClientRect` returns the
      // axis-aligned box AROUND a rotated element, which is wider and shorter
      // than the element is. Measured that way a 0.75 painting reads as 0.85
      // and the card looks like it is cropping something it is not.
      const ir = { width: img.offsetWidth, height: img.offsetHeight };
      const pr = { width: plate.offsetWidth, height: plate.offsetHeight };
      // THE WHOLE DECK IS PAINTED NOW. This used to assert that a bond card
      // FALLS BACK to its owner's portrait, which was true and worth asserting
      // while the twelve bond cards had no art of their own. They do now, so
      // the rule it guards has CHANGED rather than gone: every card in the deck
      // carries its own painting, and no card anywhere falls back.
      const every = Object.keys(window.K.CARD_DEFS).map(id => ({
        id, art: window.K.cardArt(id) }));
      return {
        srcs, distinct: new Set(srcs).size,
        painted: /cards\/cleave\.webp$/.test(srcs[0]),
        // THE PAINTING IS DROPPED IN WHOLE — and "whole" means its own shape,
        // not the plate's. This asserted the image box EQUALS the plate box,
        // which is what `height: 100%` gave it and is exactly the bug: the
        // paintings are 420x560 (0.75) and the faces have drifted narrower —
        // 0.68 in the hand, 0.63 on the inspect panel — so filling the plate
        // meant `cover` cutting 16% off the card you press and hold to READ,
        // eight per cent from each side. On Quick Throw that is the raised
        // dagger and the trailing cloak.
        //
        // What must hold is that the picture spans the plate's WIDTH and keeps
        // its own ratio, so nothing is cropped on either axis. The lower band
        // of the face is under the text box either way.
        fills: Math.abs(ir.width - pr.width) < 2
               && Math.abs(ir.width / ir.height - img.naturalWidth / img.naturalHeight) < 0.02
               && ir.height <= pr.height + 1,
        _fill: { iw: Math.round(ir.width), ih: Math.round(ir.height),
                 pw: Math.round(pr.width), ph: Math.round(pr.height),
                 nat: img.naturalWidth + 'x' + img.naturalHeight,
                 ratio: +(ir.width / ir.height).toFixed(3) },
        deck: every.length,
        unpainted: every.filter(c => !c.art).map(c => c.id),
        allDistinct: new Set(every.map(c => c.art)).size,
        // …and the fallback is still WIRED, because it is what a card added
        // tomorrow lands on before anyone paints it
        unknownFallsBack: window.K.cardArt('__no_such_card__') === null,
      };
    });
    check('CARD: every card in the deck carries its own painting — none falls back',
      art.distinct === 5 && art.painted && art.fills
      && art.unpainted.length === 0 && art.allDistinct === art.deck
      && art.unknownFallsBack,
      JSON.stringify({ distinct: art.distinct, fills: art.fills, fill: art._fill, deck: art.deck,
        unpainted: art.unpainted, allDistinct: art.allDistinct,
        fallbackWired: art.unknownFallsBack }));

    check('CARD: the portrait is bled through the plate and stays UNDER the words',
      legible.hasArt && legible.scrim && legible.plateImg
      && legible.artZ < legible.textZ && legible.artZ < legible.nameZ,
      JSON.stringify({ art: legible.artZ, text: legible.textZ, name: legible.nameZ,
                       scrim: legible.scrim }));
    check('CARD: light type on a dark plate — every readout well clear of its ground',
      legible.nameLum > 0.7 && legible.proseLum > 0.55 && legible.numLum > 0.85
      && legible.payLum > 0.55,
      JSON.stringify({ name: legible.nameLum, prose: legible.proseLum,
                       num: legible.numLum, pay: legible.payLum }));

    // THE RULES ARE A LIST OF THINGS, RULED. The combo used to be a banded
    // block because it was the only way to stop it reading as one more grey
    // sentence in a paragraph. There is no paragraph now — every clause has
    // its own hairlined row and the combo is simply the last one, named and
    // iconed like the concept sets it. What still has to hold is the
    // hierarchy: the base NUMBER is the biggest type on the face, and the
    // payoff never out-sizes it.
    check('CARD: every clause is its own ruled row, and the combo is the last of them',
      anat.tag === 'After an Ally' && anat.pay === 'costs 1 AP.' && anat.condIcon
      && anat.nRows >= 2 && parseFloat(anat.rowRule) >= 1
      && parseFloat(anat.banded) >= 1
      && anat.numSize > anat.proseSize && anat.numSize > anat.paySize
      && anat.gemSize >= 11,
      JSON.stringify({ tag: anat.tag, pay: anat.pay, icon: anat.condIcon, rows: anat.nRows,
        rowRule: anat.rowRule, num: anat.numSize, row_px: anat.proseSize,
        pay_px: anat.paySize, band: anat.banded, gem: anat.gemSize }));
    const face = await J(() => {
      window.K.startCombat({ seed: 11 });
      window.K.forceHand(['serrate', 'crosssever', 'mend', 'lastlight', 'cstance']);
      window.K.playCard('serrate');                    // arms the Follow-Ups
      const c = document.querySelector('.k-card[data-card="crosssever"]');
      const r = c.getBoundingClientRect();
      // LAYOUT GEOMETRY, NOT SCREEN GEOMETRY. The hand is a fan: every card
      // carries a rotate/rotateY/rotateX, and a transformed element's client
      // rect is the projected quad — so "is this above that" read through it
      // depends on where the two sit horizontally. offset* is untransformed.
      const box = (sel) => { const n = c.querySelector(sel);
        return { l: n.offsetLeft, t: n.offsetTop, r: n.offsetLeft + n.offsetWidth,
                 b: n.offsetTop + n.offsetHeight }; };
      const r2 = { width: c.offsetWidth, height: c.offsetHeight };
      const gem = box('.k-cgem'), who = box('.k-cwho'), name = box('.k-cname');
      const ty = box('.k-ctype'), art = box('.k-cart');
      const out = {
        // THE TYPE, TOP-RIGHT, OPPOSITE THE COST. Build 41 put the verb glyph
        // at 34px in the MIDDLE of the art, which read as a stamp across the
        // picture. A card has two indices and they belong at the two top
        // corners: what it costs on the left, what kind of thing it is on the
        // right. This asserts the corner AND the restraint — a mark that grows
        // back past a fifth of the card's width is a stamp again.
        typeTopRight: ty.r > r2.width * 0.7 && ty.t < r2.height * 0.16,
        typeMarks: c.querySelectorAll('.k-ctype .k-cverb').length,
        typeSmall: (ty.r - ty.l) < r2.width * 0.35 && (ty.b - ty.t) < r2.height * 0.12,
        typeClearOfCost: ty.l > gem.r,
        // and it is no longer INSIDE the art plate — the portrait is alone in
        // there, which is the whole point of the move
        typeOutOfArt: !c.querySelector('.k-cart .k-cverb'),
        artFills: art.b - art.t > r2.height * 0.9,
        // what it costs, top-LEFT. WHOSE IT IS, named directly above the
        // title — the 17px portrait disc that used to sit top-right was the
        // same face as the art behind it, at a size where two of the three
        // heroes are one silhouette.
        costTopLeft: gem.l < r2.width * 0.3 && gem.t < r2.height * 0.16,
        noOwnerDisc: !c.querySelector('.k-owner'),
        whoText: c.querySelector('.k-cwho').textContent,
        whoAboveName: who.b <= name.t + 1 && who.t > r2.height * 0.3,
        nameClear: name.t >= gem.b - 1 && name.t >= who.b - 1,
        nameOneLine: c.querySelector('.k-cname').getBoundingClientRect().height < 26
          && getComputedStyle(c.querySelector('.k-cname')).whiteSpace === 'nowrap',
        armedGlow: getComputedStyle(c).animationName,
      };
      window.K.state().ap = 0; window.K.render();      // nothing affordable now
      const p = document.querySelector('.k-card[data-card="crosssever"]');
      out.poor = p.classList.contains('k-card-poor');
      out.veil = getComputedStyle(p, '::after').backgroundColor;
      out.orbRed = getComputedStyle(p.querySelector('.k-cgem')).borderTopColor;
      out.stillGlows = getComputedStyle(p).animationName;
      return out;
    });
    check('CARD: the type marks the top-right corner, small, and off the portrait',
      face.typeTopRight && face.typeMarks >= 1 && face.typeSmall
      && face.typeClearOfCost && face.typeOutOfArt && face.artFills,
      JSON.stringify({ topRight: face.typeTopRight, marks: face.typeMarks,
        small: face.typeSmall, clearOfCost: face.typeClearOfCost,
        outOfArt: face.typeOutOfArt, artFills: face.artFills }));
    check('CARD: cost top-left, the owner NAMED above the title, the name on its own line',
      face.costTopLeft && face.noOwnerDisc && face.whoAboveName
      && /^ASH$|^ELIN$|^MIRA$|\+/.test((face.whoText || '').trim().toUpperCase())
      && face.nameClear && face.nameOneLine,
      JSON.stringify(face));
    check('CARD: an armed combo glows gold; an unaffordable card greys out and reddens its cost',
      face.armedGlow === 'k-armed' && face.poor && /rgba?\(/.test(face.veil)
      && face.veil !== 'rgba(0, 0, 0, 0)' && face.stillGlows === 'none'
      && (() => { const m = /rgb\((\d+), (\d+), (\d+)\)/.exec(face.orbRed);
                  return !!m && +m[1] > +m[2] + 40 && +m[1] > +m[3] + 40; })(),
      JSON.stringify({ glow: face.armedGlow, poor: face.poor, veil: face.veil,
        orb: face.orbRed, glowWhenPoor: face.stillGlows }));
    // THE PROPORTION MOVED, deliberately. 63:88 is a physical playing card and
    // it was the right target while the face was a parchment rectangle. The
    // concept this build is cut to is a TALLER card — 0.63 rather than 0.72 —
    // which is what gives the art the top half and the rules a column rather
    // than a box. This asserts the new proportion, not the absence of one.
    check('CARD: the concept proportion — a tall face at 0.63, not a playing card at 0.72',
      Math.abs(anat.ratio - 0.634) < 0.02, 'w/h = ' + anat.ratio + ' (target 0.634)');
    const live = await J(() => {
      window.K.playCard('serrate');   // Mira first — Follow-Up needs a DIFFERENT hero
      const cs = document.querySelector('.k-card[data-card="crosssever"]');
      return { on: cs.querySelector('.k-combo').classList.contains('on'),
               state: (cs.querySelector('.k-combo-state') || {}).textContent.trim(),
               gem: cs.querySelector('.k-cgem').textContent.replace(/\s+/g, ''),
               gemLit: cs.querySelector('.k-cgem').classList.contains('on') };
    });
    check('CARD: a live combo lights its whole band, says ON, and restrikes the cost orb',
      live.on && live.state === 'ON' && !anat.state && live.gem === '12' && live.gemLit,
      JSON.stringify(Object.assign({ asleep: anat.state }, live)));
  }
  // ── StS numbers: nothing on screen should read in thousands ──
  await fresh(9);
  {
    const scale = await J(() => ({
      ash: document.querySelector('.k-pt-hero[data-hero="ash"] .k-pt-hp b').textContent.trim(),
      boss: document.getElementById('k-bhp').textContent.trim(),
      intent: (document.querySelector('#k-intent .k-ichip-atk b') || {}).textContent,
      commas: [...document.querySelectorAll('#k-hand .k-cprose, .k-pt-hp, #k-bhp, #k-intent b')]
        .filter(e => /\d,\d/.test(e.textContent)).length,
    }));
    check('SCALE: HP and damage read at Slay-the-Spire size — no four-digit numbers',
      scale.ash === '42' && scale.boss === '168' && scale.commas === 0
      && Number(scale.intent) < 100, JSON.stringify(scale));
  }
  // ── lifting a card: it follows the finger, the way v2.2 played ──
  await fresh(7);
  {
    const lift = await J(async () => {
      const card = [...document.querySelectorAll('#k-hand .k-card')]
        .find(c => window.K.evaluateCard(c.dataset.card).card.target === 'enemy');
      const st = document.getElementById('k-stage').getBoundingClientRect();
      const r0 = card.getBoundingClientRect();
      const at = (x, y, t) => card.dispatchEvent(new PointerEvent(t, { bubbles: true, clientX: x, clientY: y, pointerId: 1 }));
      at(r0.left + r0.width / 2, r0.top + 10, 'pointerdown');
      at(r0.left + r0.width / 2, r0.top - 60, 'pointermove');
      await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
      const a1 = card.getBoundingClientRect();
      const boss = document.getElementById('k-boss-art').getBoundingClientRect();
      at(boss.left + boss.width / 2, boss.top + boss.height / 2, 'pointermove');
      await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
      const a2 = card.getBoundingClientRect();
      const out = {
        aiming: card.classList.contains('k-aiming'),
        lifted: a1.top < r0.top - 20,
        // the whole point: the card KEEPS moving with the finger, no wall
        followed: a2.left - a1.left > 60,
        onStage: a2.top > st.top && a2.bottom < st.bottom + 1,
        snapped: document.getElementById('k-boss-art').classList.contains('k-aim-snap'),
      };
      at(boss.left + boss.width / 2, boss.top + boss.height / 2, 'pointerup');
      return out;
    });
    check('LIFT: the card tracks the finger the whole way — nothing parks or sticks',
      lift.aiming && lift.lifted && lift.followed && lift.onStage && lift.snapped,
      JSON.stringify(lift));
  }
  // ── the rows: v2.2's slots, as ground you can see and drop onto ──
  await fresh(12);
  {
    const rows = await J(async () => {
      const stage = document.getElementById('k-stage');
      const h = document.querySelector('.k-hero[data-hero="ash"]');
      const hr = h.getBoundingClientRect();
      const back = document.querySelector('.k-row[data-row="back"]');
      const mid = document.querySelector('.k-row[data-row="mid"]');
      const front = document.querySelector('.k-row[data-row="front"]');
      const vis = (n) => parseFloat(getComputedStyle(n).opacity);
      const out = { hidden: vis(back), slots: document.querySelectorAll('#k-rows .k-row').length,
                    named: [...document.querySelectorAll('#k-rows .k-row-lbl')]
                      .map(n => n.textContent.trim()).join(',') };
      const at = (x, y, t) => h.dispatchEvent(new PointerEvent(t,
        { bubbles: true, clientX: x, clientY: y, pointerId: 7 }));
      const sr = stage.getBoundingClientRect(), k = sr.width / stage.offsetWidth || 1;
      const centre = (n) => ({ x: sr.left + (n.offsetLeft + n.offsetWidth / 2) * k,
                               y: sr.top + (n.offsetTop + n.offsetHeight / 2) * k });
      at(hr.left + hr.width / 2, hr.top + hr.height / 2, 'pointerdown');
      await new Promise(r => setTimeout(r, 260));      // past the rise transition
      out.raised = vis(back) > 0.9 && vis(mid) > 0.9 && vis(front) > 0.9;
      // MEASURED, not laid out — the lanes sit at real translateZ depths, so
      // offsetLeft is where the box was before the lens moved it.
      const cx = (n) => { const b = n.getBoundingClientRect(); return b.left + b.width / 2; };
      // they run left to right, BACK furthest from the Regent and FRONT nearest
      out.order = cx(back) < cx(mid) && cx(mid) < cx(front);
      out.toward = cx(front) < document.getElementById('k-boss-art').getBoundingClientRect().left;
      // and they must be separable by a thumb, not stacked on each other
      out.spread = Math.min(cx(mid) - cx(back), cx(front) - cx(mid));
      out.here = front.classList.contains('k-row-here');   // Ash starts FRONT
      const hint = document.getElementById('k-movehint');
      out.hint = hint.classList.contains('k-hidden') ? null : hint.textContent.trim();
      const b = centre(back);
      at(b.x, b.y, 'pointermove');
      await new Promise(r => setTimeout(r, 30));
      out.lit = back.classList.contains('k-row-hot');
      at(b.x, b.y, 'pointerup');
      await new Promise(r => setTimeout(r, 60));
      const st = window.K.state();
      out.row = st.heroes.ash.row; out.ap = st.ap; out.moved = st.turnState.moved;
      out.cleared = document.getElementById('k-movehint').classList.contains('k-hidden')
        && !stage.classList.contains('k-moving');
      return out;
    });
    check('ROWS: three named slots run BACK to FRONT toward the Regent, the move is priced',
      rows.slots === 3 && rows.named === 'BACK,MID,FRONT' && rows.hidden < 0.1
      && rows.raised && rows.order && rows.toward && rows.spread >= 70
      && rows.here && /MOVE/.test(rows.hint || ''),
      JSON.stringify({ slots: rows.slots, named: rows.named, order: rows.order,
        toward: rows.toward, spread: Math.round(rows.spread), here: rows.here, hint: rows.hint }));
    check('ROWS: carrying a hero to a named slot and letting go puts them there',
      rows.lit && rows.row === 'back' && rows.ap === 2 && rows.moved === 1 && rows.cleared,
      JSON.stringify({ lit: rows.lit, row: rows.row, ap: rows.ap, moved: rows.moved, cleared: rows.cleared }));
  }
  await settle();
  await fresh(12);
  {
    const sealed = await J(async () => {
      window.K.moveHero('mira');                    // the phase's one move, spent
      const stage = document.getElementById('k-stage');
      const h = document.querySelector('.k-hero[data-hero="ash"]');
      const hr = h.getBoundingClientRect();
      const back = document.querySelector('.k-row[data-row="back"]');
      const sr = stage.getBoundingClientRect(), k = sr.width / stage.offsetWidth || 1;
      const at = (x, y, t) => h.dispatchEvent(new PointerEvent(t,
        { bubbles: true, clientX: x, clientY: y, pointerId: 8 }));
      at(hr.left + hr.width / 2, hr.top + hr.height / 2, 'pointerdown');
      await new Promise(r => setTimeout(r, 30));
      const hint = document.getElementById('k-movehint');
      const out = { why: hint.textContent.trim(), sealed: stage.classList.contains('k-moving-no'),
                    reason: window.K.moveReason('ash') };
      const bx = sr.left + (back.offsetLeft + back.offsetWidth / 2) * k;
      const by = sr.top + (back.offsetTop + back.offsetHeight / 2) * k;
      at(bx, by, 'pointermove');
      await new Promise(r => setTimeout(r, 20));
      out.lit = back.classList.contains('k-row-hot');
      at(bx, by, 'pointerup');
      await new Promise(r => setTimeout(r, 40));
      out.row = window.K.state().heroes.ash.row;
      return out;
    });
    check('ROWS: a move that cannot happen says why and refuses — never a silent nothing',
      sealed.reason === 'already moved' && /ALREADY MOVED/.test(sealed.why)
      && sealed.sealed && !sealed.lit && sealed.row === 'front', JSON.stringify(sealed));
  }
  await settle();
  // ── a blow lands NOW, not at the top of the next turn ──
  await fresh(7);
  {
    const live = await J(async () => {
      window.K.forceIntent('hymn');
      const bar = () => document.querySelector('.k-pt-hero[data-hero="ash"] .k-bar-fill').style.width;
      const num = () => document.querySelector('.k-pt-hero[data-hero="ash"] .k-pt-hp b').textContent;
      const before = { bar: bar(), num: num() };
      const done = window.K.endTurn({ grades: Array(8).fill('miss') });
      const out = { before, drainedDuring: false, phaseWhen: null };
      for (let i = 0; i < 400; i++) {
        const ph = window.K.state().phase;
        if (ph === 'PLAYER_READY' || ph === 'DEFEAT') break;
        if (bar() !== before.bar) { out.drainedDuring = true; out.phaseWhen = ph;
                                    out.midNum = num(); break; }
        await new Promise(r => setTimeout(r, 6));
      }
      await done;
      out.after = { bar: bar(), num: num() };
      return out;
    });
    check('DAMAGE LANDS NOW: the party bar drains while the blow is resolving, not at the next turn',
      live.drainedDuring && live.phaseWhen !== 'PLAYER_READY' && live.after.num !== live.before.num,
      JSON.stringify(live));
  }
  await settle();
  // ── damage numbers are the loudest voice on the board ──
  await fresh(7);
  {
    const nums = await J(async () => {
      const clear = () => document.querySelectorAll('.k-pop').forEach(n => n.remove());
      const px = () => { const p = document.querySelector('.k-pop-dmg');
        return p ? parseFloat(getComputedStyle(p).fontSize) : null; };
      clear();                       // nothing from an earlier block may be measured
      window.K.forceHand(['serrate', 'cleave', 'frostbind', 'lcascade', 'lastlight']);
      window.K.playCard('serrate');            // 3 — the chip tier
      const small = px();
      clear(); window.K.state().ap = 3;
      window.K.playCard('cleave');             // 6 — a step up
      const mid = px();
      // a volley must not print its numbers on top of each other
      window.K.playCard('frostbind');
      const dx = new Set([...document.querySelectorAll('.k-pop')]
        .map(n => n.style.getPropertyValue('--pop-dx'))).size;
      const pops = document.querySelectorAll('.k-pop').length;
      // and a FINALE has to LOOK like one: Elin, Mira, then the finisher
      clear();
      window.K.startCombat({ seed: 7 });
      window.K.forceHand(['lcascade', 'serrate', 'lastlight', 'mend', 'cleave']);
      window.K.playCard('lcascade'); window.K.playCard('serrate');
      clear();
      window.K.playCard('lastlight');          // 15
      const big = px();
      return { small, mid, big, dx, pops };
    });
    check('NUMBERS: damage is legible at a glance and scales with the blow',
      nums.small >= 28 && nums.mid > nums.small && nums.big > nums.mid && nums.big >= 44,
      JSON.stringify({ chip: nums.small, mid: nums.mid, finale: nums.big }));
    check('NUMBERS: a volley fans its numbers apart instead of stacking them',
      nums.pops >= 2 && nums.dx >= 2, JSON.stringify({ pops: nums.pops, distinctOffsets: nums.dx }));
  }
  await settle();
  // ── the diorama: real depth, and a board that is not a stack of decals ──
  await fresh(12);
  {
    const dio = await J(async () => {
      const st = document.getElementById('k-stage');
      const field = document.getElementById('k-field');
      // the figures GLIDE between lanes, so a fresh board is still settling
      await new Promise(r => setTimeout(r, 460));
      const q = (r) => document.querySelector('.k-hero.k-row-' + r).getBoundingClientRect();
      const back = q('back'), mid = q('mid'), front = q('front');
      const out = {
        // the lens is real, not a scale fake
        lens: getComputedStyle(field).perspective,
        // DEPTH: further from the Regent is further away, so smaller and higher
        shrinks: back.width < mid.width && mid.width < front.width,
        lifts: back.bottom < mid.bottom && mid.bottom < front.bottom,
        // and further LEFT — the axis the fight is fought along
        leftward: back.left < mid.left && mid.left < front.left,
        raw: [back, mid, front].map(r => [Math.round(r.left), Math.round(r.bottom),
          Math.round(r.width)].join('/')).join('  '),
        who: [...document.querySelectorAll('.k-hero')].map(h =>
          h.dataset.hero + ':' + (h.className.match(/k-row-\w+/) || [''])[0]).join(' '),
        // atmospheric perspective: the back rank is cooler and dimmer
        airBack: getComputedStyle(document.querySelector('.k-hero.k-row-back img')).filter,
        airFront: getComputedStyle(document.querySelector('.k-hero.k-row-front img')).filter,
        // the figures breathe, each on its own clock
        breathing: [...document.querySelectorAll('.k-hero .k-fig')]
          .map(n => getComputedStyle(n).animationName),
        clocks: new Set([...document.querySelectorAll('.k-hero .k-fig')]
          .map(n => getComputedStyle(n).animationDuration)).size,
      };
      // and the lens answers a blow
      window.K.forceHand(['lastlight', 'cleave', 'mend', 'serrate', 'frostbind']);
      const cast = document.getElementById('k-cast');
      const dz = () => parseFloat(cast.style.getPropertyValue('--cam-dz')) || 0;
      const home = dz();
      window.K.playCard('cleave');
      out.pushed = dz() > home + 20;            // a real dolly, not a scale
      out.rolled = Math.abs(parseFloat(cast.style.getPropertyValue('--cam-r')) || 0) > 0.2;
      await new Promise(r => setTimeout(r, 900));
      out.released = Math.abs(dz() - home) < 12;   // and it comes home
      return out;
    });
    const sat = (f) => { const m = /saturate\(([\d.]+)\)/.exec(f || ''); return m ? +m[1] : 1; };
    check('DIORAMA: the rows are real depth — the far rank is smaller, higher, further left and hazier',
      /px/.test(dio.lens) && dio.shrinks && dio.lifts && dio.leftward
      && sat(dio.airBack) < sat(dio.airFront),
      JSON.stringify({ lens: dio.lens, shrinks: dio.shrinks, lifts: dio.lifts,
        leftward: dio.leftward, back: sat(dio.airBack), front: sat(dio.airFront),
        raw: dio.raw, who: dio.who }));
    check('DIORAMA: the board is not static — every figure breathes on its own clock, and the lens answers a blow',
      dio.breathing.length === 3 && dio.breathing.every(n => n === 'k-breathe')
      && dio.clocks === 3 && dio.pushed && dio.rolled && dio.released,
      JSON.stringify({ breathing: dio.breathing, clocks: dio.clocks,
        pushed: dio.pushed, rolled: dio.rolled, released: dio.released }));
  }
  await settle();
  // ── the beam cannot outlive the card that is throwing it ──
  await fresh(7);
  {
    const stale = await J(async () => {
      const st = document.getElementById('k-stage');
      const card = document.querySelector('.k-card');
      const r = card.getBoundingClientRect();
      const at = (x, y, t) => card.dispatchEvent(new PointerEvent(t,
        { bubbles: true, clientX: x, clientY: y, pointerId: 5 }));
      at(r.left + r.width / 2, r.top + 10, 'pointerdown');
      at(r.left + r.width / 2 + 120, r.top - 60, 'pointermove');
      at(r.left + r.width / 2 + 240, r.top - 90, 'pointermove');
      const drawn = !!document.querySelector('#k-aim .k-aim-dash');
      window.K.render();                       // anything that rebuilds the hand
      await new Promise(res => setTimeout(res, 140));
      const svg = document.getElementById('k-aim');
      const d = svg && svg.querySelector('.k-aim-dash');
      return { drawn, left: !!d, path: d ? d.getAttribute('d') : null };
    });
    check('AIM: the beam dies with the card — a re-render cannot strand it in the corner',
      stale.drawn && !stale.left, JSON.stringify(stale));
  }
  await settle();
  // ── the parry: v2.2's closing ring over a dimmed board ──
  await fresh(7);
  {
    const ring = await J(async () => {
      window.K.forceIntent('hymn');
      window.K.endTurn();                      // live rhythm, no grades passed
      // WAIT FOR THE RING, DO NOT GUESS AT IT. This slept a flat 620ms and then
      // asked whether the ring was up. Under load — a slower render, a heavier
      // hand, another suite sharing the browser — the lead-in and that constant
      // drift apart, and the check reports the parry bar missing when it is
      // merely late. Three separate parry checks were wandering in and out of
      // red on exactly this, never the same one twice, which is the signature
      // of a racing probe rather than a broken feature. Poll for the thing.
      for (let i = 0; i < 200 && !document.querySelector('.k-pring'); i++) {
        await new Promise(res => setTimeout(res, 10));
      }
      await new Promise(res => setTimeout(res, 60));   // …and let it settle in
      const st = document.getElementById('k-stage');
      const r = st.querySelector('.k-pring');
      const cs = r && getComputedStyle(r.querySelector('.k-pr-close'));
      const out = {
        ring: !!r,
        target: !!(r && r.querySelector('.k-pr-target')),
        closing: !!(cs && cs.animationName === 'k-prclose'),
        label: r && r.querySelector('.k-pr-lbl').textContent.trim(),
        count: r && r.querySelector('.k-pr-n') && r.querySelector('.k-pr-n').textContent.trim(),
        focus: st.classList.contains('k-parry-focus'),
        thread: !!st.querySelector('.k-pthread'),
        lit: !!st.querySelector('.k-hero.k-parrying'),
        noTravellers: !st.querySelector('.k-note'),
      };
      await new Promise(res => setTimeout(res, 420));
      out.livesUp = !!st.querySelector('.k-pring.k-pr-live');
      return out;
    });
    check('PARRY: a ring closes on a dashed sweet spot over a desaturated board',
      ring.ring && ring.target && ring.closing && ring.focus && ring.thread
      && ring.lit && ring.noTravellers, JSON.stringify(ring));
    // The ASK is readable from the first frame — a ring that only says "1/6"
    // tells you when and never what — and the beat count keeps its own line.
    // IT NAMES THE ATTACK, NOT THE INPUT. "TAP" describes the thumb; "THRUST"
    // describes the thing coming at you, and the thumb follows from it. That
    // is the whole point of the acts: the player reads the foe, not a notation.
    check('PARRY: the ring names the ATTACK from the first frame and lights when gradeable',
      /^THRUST!?$/.test(ring.label) && /^1\/\d+$/.test(ring.count || '') && ring.livesUp,
      JSON.stringify({ label: ring.label, count: ring.count, live: ring.livesUp }));
  }
  await settle();
  // ── the beat: one metronome across the whole volley ──
  await fresh(7);
  {
    const beat = await J(async () => {
      window.K.forceIntent('hymn');
      window.K.endTurn();
      await new Promise(res => setTimeout(res, 620));
      const st = document.getElementById('k-stage');
      const seq = st.querySelector('#k-seq');   // must no longer exist
      const out = {
        pulse: !!st.querySelector('#k-beat'),
        beatMs: st.querySelector('#k-beat') && st.querySelector('#k-beat').style.getPropertyValue('--beat'),
        noTracker: !seq,
      };
      // ring closes ON the beat: measure two successive impacts
      const stamps = new Set();
      for (let i = 0; i < 60; i++) {
        st.querySelectorAll('.k-pring').forEach(r => {
          if (r.dataset.impact) stamps.add(Math.round(+r.dataset.impact));
        });
        await new Promise(res => setTimeout(res, 40));
      }
      const sorted = [...stamps].sort((a, b) => a - b);
      out.gaps = sorted.slice(1).map((v, i) => v - sorted[i]);
      return out;
    });
    // every gap must be a whole number of beats — a skipped beat is still on grid
    // ONE GRID, HALF-BEATS ALLOWED. The strings syncopate now — a hesitation
    // before the last blow, a jab on the off-beat — so the unit is the eighth
    // note. Everything still lands on the same clock; nothing floats.
    const onGrid = beat.gaps.length && beat.gaps.every(g => Math.abs(g / 250 - Math.round(g / 250)) < 0.08);
    const syncopated = beat.gaps.some(g => Math.abs(g / 500 - Math.round(g / 500)) > 0.08);
    // …and it BREATHES: six notes end to end is a wall, six in phrases with a
    // rest between hits is a bar you can read your way through.
    //
    // THE REST IS A BEAT NOW, NOT TWO. The scheduler used to close each hit with
    // a flat +1 and open the next with a flat +1, and the two stacked into a
    // full second between every pair of hits regardless of what had just been
    // asked — 1.5s of an 8s enemy turn, spent on nothing a probe could see (the
    // rings' runways are long enough that no frame of that gap was ever empty).
    // Build 94 replaced both with one rule: the gap after a hit is the same
    // MIN_GAP_AFTER floor that governs two notes inside a hit, never less than
    // one beat. So the threshold moves with it — a rest is still a rest, it is
    // just no longer twice as long as the thing it separates.
    const rests = beat.gaps.filter(g => g > 450).length;
    check('BEAT: the whole volley runs on one 120 BPM clock, and the strings syncopate on it',
      beat.pulse && beat.beatMs === '500ms' && onGrid && syncopated && beat.noTracker,
      JSON.stringify({ pulse: beat.pulse, beat: beat.beatMs, gaps: beat.gaps,
        onGrid, syncopated, noTracker: beat.noTracker }));
    check('BEAT: the volley breathes — a rest beat separates one hit from the next',
      rests >= 1, JSON.stringify({ gaps: beat.gaps, rests }));
  }
  await settle();
  // ── the lens moves during a bar, and the rings ride it ──
  await fresh(7);
  {
    const ride = await J(async () => {
      // THIS CHECK WAS READING THE PREVIOUS CHECK'S BAR. It forced an intent and
      // ended a turn on whatever fight happened to be live — and `endTurn` is a
      // no-op unless the phase is PLAYER_READY, so when the block before it left
      // the game mid-enemy-phase the call did nothing, the `.k-pring` on screen
      // belonged to the LAST bar, and the sampler measured a camera that was
      // still in the player pose. Reproduced directly: start a bar, wait 900ms,
      // start another, and the first samples come back ring-up at dz 26 / yaw
      // 3.4 before the new composition lands at t≈50. That is the whole flake —
      // three different parry checks taking turns going red for one reason.
      // …and waiting for ONE quiet instant was not enough either: `startCombat`
      // does not cancel an in-flight `runVolleyRhythm`, so the previous bar goes
      // on posting rings onto the new fight's stage and driving the lens home
      // between them. The wait is for SUSTAINED quiet — twenty consecutive
      // samples with no ring — before the new fight starts at all.
      let quiet = 0;
      for (let i = 0; i < 400 && quiet < 20; i++) {
        quiet = document.querySelector('.k-pring') ? 0 : quiet + 1;
        await new Promise(res => setTimeout(res, 8));
      }
      window.K.startCombat({ seed: 7 });
      for (let i = 0; i < 60 && window.K.state().phase !== 'PLAYER_READY'; i++) {
        await new Promise(res => setTimeout(res, 8));
      }
      window.K.forceIntent('hymn');
      window.K.endTurn();
      const cast = document.getElementById('k-cast');
      const out = { swung: 0, drift: 0, samples: 0, composed: false };
      let base = null;
      for (let i = 0; i < 260; i++) {
        const r = document.querySelector('.k-pring[data-hero]');
        if (r) {
          const dz = parseFloat(cast.style.getPropertyValue('--cam-dz')) || 0;
          if (base == null) base = dz;
          out.composed = out.composed || dz > 40;      // it DID lean in, once
          // …and then held: no dutching side to side between reads, which is
          // exactly when the player needs the world to stand still
          out.swung = Math.max(out.swung,
            Math.abs(parseFloat(cast.style.getPropertyValue('--cam-yaw')) || 0),
            Math.abs(parseFloat(cast.style.getPropertyValue('--cam-r')) || 0));
          // the ring must stay ON its hero however far the lens travels
          const h = document.querySelector('.k-hero[data-hero="' + r.dataset.hero + '"]');
          const hr = h.getBoundingClientRect(), rr = r.getBoundingClientRect();
          const hx = hr.left + hr.width / 2, hy = hr.top + hr.height * 0.26;
          out.drift = Math.max(out.drift,
            Math.hypot(rr.left + rr.width / 2 - hx - (+r.dataset.ox || 0), rr.top + rr.height / 2 - hy));
          out.samples++;
        }
        await new Promise(res => setTimeout(res, 8));
      }
      return out;
    });
    check('LENS: the parry is ONE held shot — it leans in once and never pivots between notes',
      ride.samples > 10 && ride.composed && ride.swung < 0.2 && ride.drift < 26,
      JSON.stringify({ samples: ride.samples, leanedIn: ride.composed,
        worstPivot: ride.swung, worstDrift: Math.round(ride.drift) }));
  }
  await settle();
  // ── the dilation: pausing animations is not the effect ──
  await fresh(7);
  {
    // POLL FOR THE DRAIN; DO NOT SLEEP THROUGH IT. This waited for `k-slowmo`,
    // slept a flat 190ms — "past the 130ms transition" — and read the filter
    // once. That holds only if the class goes on once and stays on. It does
    // not: slowmo is per NOTE, so the drain restarts every time the class comes
    // back, and a single read landing mid-transition reported saturate(0.10)
    // and (0.13) against a 0.05 target. Build 94's tighter bar made those
    // restarts more frequent and the single read started losing the race
    // outright.
    //
    // The claim being tested is that the world DRAINS during a bar, not that it
    // is drained at one arbitrary instant, so it samples across the bar and
    // keeps the deepest value it saw.
    const dil = await J(async () => {
      window.K.forceIntent('hymn');
      window.K.endTurn();
      const st = document.getElementById('k-stage');
      const bg = document.getElementById('k-backdrop');
      let best = null, vig = false, sawSlowmo = false;
      for (let i = 0; i < 400; i++) {
        if (st.classList.contains('k-slowmo')) {
          sawSlowmo = true;
          const f = getComputedStyle(bg).filter;
          const sat = /saturate\(([\d.]+)\)/.exec(f);
          const br = /brightness\(([\d.]+)\)/.exec(f);
          const now = { sat: sat ? +sat[1] : 1, bright: br ? +br[1] : 1 };
          if (!best || now.sat < best.sat) best = now;
          vig = vig || getComputedStyle(st, '::before').backgroundImage !== 'none';
          if (best.sat <= 0.06) break;
        }
        await new Promise(r => setTimeout(r, 10));
      }
      return best ? { ...best, vig } : { none: true, sawSlowmo };
    });
    check('DILATION: the world drains and a vignette rushes in — not just paused animation',
      !!dil && !dil.none && dil.sat <= 0.1 && dil.bright <= 0.4 && dil.vig, JSON.stringify(dil));
  }
  await settle();
  // ── a gesture always has time to finish before the next is asked for ──
  {
    const gaps = await J(() => {
      const MIN = { tap: 0.5, feint: 1, bait: 1, slide: 1.5, hold: 1.5, burst: 2 };
      const bad = [];
      for (const id of ['hymn', 'scythe', 'dirgesong', 'rain']) {
        window.K.forceIntent(id);
        for (const h of window.K.currentIntent().hits) {
          const want = h.beats || h.notes.map((_, i) => i);
          for (let i = 1; i < h.notes.length; i++) {
            const prev = String(h.notes[i - 1]).split(':')[0];
            const gap = (want[i] == null ? i : want[i]) - (want[i - 1] == null ? i - 1 : want[i - 1]);
            if (gap < MIN[prev]) bad.push(id + ' ' + h.notes[i - 1] + '→' + h.notes[i] + ' @' + gap);
          }
        }
      }
      return { bad, min: MIN };
    });
    // authored as well as enforced: the clamp is the safety net, not the design
    check('RHYTHM: no string asks for a travelling gesture before the last one could finish',
      gaps.bad.length === 0, JSON.stringify(gaps.bad));
  }
  await settle();
  // ── a mash gets its own air, and counts itself out loud ──
  await fresh(7);
  {
    const mash = await J(async () => {
      window.K.forceIntent('rain');                 // its first two hits are flurries
      window.K.endTurn();
      const st = document.getElementById('k-stage');
      let ring = null;
      for (let i = 0; i < 300 && !ring; i++) {
        ring = st.querySelector('.k-pring-burst');
        if (!ring) await new Promise(r => setTimeout(r, 10));
      }
      if (!ring) return { found: false };
      const out = { found: true, label0: ring.querySelector('.k-pr-lbl').textContent.trim() };
      const pt = (t) => st.dispatchEvent(new PointerEvent(t,
        { bubbles: true, clientX: 400, clientY: 200, pointerId: 11 }));
      pt('pointerdown'); pt('pointerup');
      out.label1 = ring.querySelector('.k-pr-lbl').textContent.trim();
      out.arc = ring.style.getPropertyValue('--burst');
      // every press sparks, whether or not it grades anything
      out.sparked = document.querySelectorAll('.k-press').length;
      // and NOTHING else is closing while the flurry is being played
      out.alone = st.querySelectorAll('.k-pring.k-pr-live').length <= 1;
      return out;
    });
    check('MASH: the flurry counts itself, sparks every press, and plays alone',
      mash.found && /0\/3/.test(mash.label0) && /1\/3/.test(mash.label1)
      && parseFloat(mash.arc) > 0 && mash.sparked >= 1 && mash.alone,
      JSON.stringify(mash));
  }
  await settle();
  // ── an early press is forgiven, not consumed ──
  await fresh(7);
  {
    const early = await J(async () => {
      // WAIT FOR A QUIET BOARD FIRST. `startCombat` does not cancel an
      // in-flight volley, so a ring from the PREVIOUS check's bar can still be
      // up when this one opens — and then the poll below returns instantly,
      // hands back a ring that has already been alive 400ms of its 500ms lead,
      // and the press lands late into a note that is nearly over. Measured: the
      // lead is ~500ms, so a press a few ms after a FRESH ring is ~476ms early
      // and cannot fail; the failures were all stale rings. This is the third
      // check in this suite to catch the same disease (LENS, TRACE, now this),
      // and the same remedy: twenty consecutive ring-free samples.
      for (let q = 0, i = 0; q < 20 && i < 400; i++) {
        q = document.querySelector('.k-pring') ? 0 : q + 1;
        await new Promise(res => setTimeout(res, 5));
      }
      window.K.forceIntent('hymn');
      window.K.endTurn();
      // WAIT FOR THE RING, DO NOT GUESS AT IT. This slept a flat 620ms and then
      // asked whether the ring was up. Under load — a slower render, a heavier
      // hand, another suite sharing the browser — the lead-in and that constant
      // drift apart, and the check reports the parry bar missing when it is
      // merely late. Three separate parry checks were wandering in and out of
      // red on exactly this, never the same one twice, which is the signature
      // of a racing probe rather than a broken feature. Poll for the thing.
      // PRESS AS EARLY AS THE RING EXISTS. "Way early" is more than 260ms
      // before the note lands, and this used to poll in 10ms steps and then
      // sleep a further 60ms before pressing — so the press went in up to
      // ~70ms + overshoot into a lead that is not much longer than the window
      // itself. Under load that lands INSIDE the window, the note grades
      // normally, and the check reports a missing nudge for a feature that
      // works. Seen once in a loaded run, three times clean alone; the margin
      // was the bug, not the nudge. Poll finely and press on the next frame.
      const t0 = performance.now();
      for (let i = 0; i < 500 && !document.querySelector('.k-pring'); i++) {
        await new Promise(res => setTimeout(res, 4));
      }
      const sawRing = performance.now() - t0;
      await new Promise(res => requestAnimationFrame(res));   // laid out, no more
      const pressedAt = performance.now() - t0;
      const st = document.getElementById('k-stage');
      st.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 400, clientY: 200, pointerId: 3 }));
      await new Promise(res => setTimeout(res, 60));
      return { stillLive: !!st.querySelector('.k-pring'),
               nudged: !!st.querySelector('.k-grade-early') || !!st.querySelector('.k-pr-early'),
               // how long after the ring appeared the press actually went in —
               // if this is ever near 260 the margin has gone, not the feature
               afterRingMs: Math.round(pressedAt - sawRing),
               // if this is ever ~0 the ring was already there and the reading
               // is about someone else's note
               ringWaitMs: Math.round(sawRing) };
    });
    check('PARRY: pressing way early nudges and keeps listening — the note is not spent',
      early.stillLive && early.nudged, JSON.stringify(early));
  }
  await settle();
  // ── THE ACTS: the gesture IS the attack, mirrored ──
  // THE WHOLE POINT OF THE REWORK, asserted as a rule rather than case by case.
  // Before it, a hit named a rhythm token and the foe's body was made to agree
  // with the token — backwards — and measured badly: of seven intents, three
  // had gestures that matched what the foe appeared to do and four were
  // arbitrary. The Hymn was a bell being struck and asked for two taps. Grief
  // in Threes wore the SWEEP pose and asked for three taps. Worse, the pose was
  // per INTENT, so a three-blow bar held one posture and the foe struck three
  // different ways looking identical.
  {
    const acts = await J(() => {
      const K = window.K, bad = [], seen = new Set();
      const poses = new Set(), swings = new Set();
      for (const it of K.INTENTS()) {
        for (const h of it.hits) {
          // every blow is authored as an act, and its note is DERIVED
          if (!h.acts || !h.acts.length) { bad.push(it.id + ':no-acts'); continue; }
          if (!h.notes || h.notes.length !== h.acts.length) { bad.push(it.id + ':count'); continue; }
          h.acts.forEach((a, i) => {
            const def = K.parseAct(a).def;
            if (!def) { bad.push(it.id + ':' + a + ':unknown'); return; }
            seen.add(K.parseAct(a).id);
            poses.add(def.pose); swings.add(def.swing);
            // the note the hand plays must be the one the act asks for —
            // authored beside it, they could disagree; derived, they cannot
            if (h.notes[i] !== K.noteForAct(a)) bad.push(it.id + ':' + a + ':drift');
            // …and the act must carry all three things it is the source of
            if (!def.word || !def.pose || !def.swing || !def.mark)
              bad.push(it.id + ':' + a + ':incomplete');
          });
        }
      }
      return { bad, acts: [...seen].sort(), poses: [...poses].sort(),
               swings: [...swings].sort(),
               // every animation an act can ask for must be in the list that
               // takes it off again, or the class sticks forever
               posesCleared: [...poses].every(p => K.FOE_POSES.indexOf(p) >= 0),
               swingsCleared: [...swings].every(w => K.FOE_SWINGS.indexOf(w) >= 0) };
    });
    check('ACTS: every blow is authored as an act, and its gesture is derived from it — they cannot drift',
      acts.bad.length === 0, acts.bad.slice(0, 5).join(' | ') || 'clean');
    check('ACTS: the bestiary throws more than one kind of blow, and each carries its own animation',
      acts.acts.length >= 6 && acts.poses.length >= 3 && acts.swings.length >= 4,
      JSON.stringify({ acts: acts.acts, poses: acts.poses.length, swings: acts.swings.length }));
    check('ACTS: every animation an act can wear is in the list that takes it off again',
      acts.posesCleared && acts.swingsCleared,
      JSON.stringify({ poses: acts.posesCleared, swings: acts.swingsCleared }));

    // …AND THE BODY CHANGES BLOW TO BLOW. A bar whose blows differ must not
    // look the same all the way through — that is the failure this build is
    // named after, and it is invisible to every check that samples once.
    const shapes = await J(async () => {
      let quiet = 0;
      for (let i = 0; i < 400 && quiet < 20; i++) {
        quiet = document.querySelector('.k-pring') ? 0 : quiet + 1;
        await new Promise(r => setTimeout(r, 5));
      }
      window.K.forceIntent('scythe');        // claw, thrust / claw, toll, thrust
      window.K.endTurn();
      const art = document.getElementById('k-boss-art');
      const seen = new Set();
      const t0 = performance.now();
      while (performance.now() - t0 < 6000) {
        [...art.classList].filter(c => c.indexOf('k-fs-') === 0).forEach(c => seen.add(c));
        await new Promise(r => setTimeout(r, 16));
      }
      return [...seen].sort();
    });
    check('ACTS: a bar of different blows does not play one animation throughout',
      shapes.length >= 2, JSON.stringify({ swings: shapes }));
  }
  await settle();
  // ── THE DRAW: press anywhere, make the shape, release ──
  // THIS REPLACES SIX TRACE CHECKS, and they went out with the note they were
  // written for. Every one of them was about the RAIL — that the ring's own
  // silhouette was dragged to a mouth, that reaching for the far end took no
  // hold, that straying off the tube said so. A draw has no rail: the whole
  // point of the rework is that the shape can be made anywhere, at any size,
  // starting from wherever the thumb already is. What survives is the part
  // that was always the real subject — that a gesture with a shape in it is
  // read as a shape, and that making it does not disturb the board.
  await fresh(7);
  {
    const dr = await J(async () => {
      // AGAINST THE CHOIR, NOT THE REGENT. This forced the Regent's heal, and
      // Build 94 made that heal five notes with the sigil THIRD — so by the
      // time the ring for it is up, the thrust before it is still live, and
      // `claimsPress` correctly hands the stroke to the note that is landing
      // sooner. The draw then read zero points and the check reported that
      // drawing does not work, when what it had actually done was press during
      // somebody else's note.
      //
      // What this needs is a bar where the draw is the only thing being asked,
      // and the Choir of One's Benediction is exactly that: lure, then SIGIL.
      window.K.startCombat({ seed: 7, foe: window.K.FOES.cultist });
      // WAIT FOR QUIET FIRST — the same lesson LENS and TRACE both taught.
      let quiet = 0;
      for (let i = 0; i < 400 && quiet < 20; i++) {
        quiet = document.querySelector('.k-pring') ? 0 : quiet + 1;
        await new Promise(r => setTimeout(r, 5));
      }
      window.K.forceIntent('benediction');   // lure, then the SIGIL that closes it
      window.K.endTurn();
      for (let i = 0; i < 300 && !document.querySelector('.k-pring-draw'); i++) {
        await new Promise(r => setTimeout(r, 10));
      }
      const ring = document.querySelector('.k-pring-draw');
      if (!ring) return { found: false };
      const st = document.getElementById('k-stage');
      const rb = ring.getBoundingClientRect();
      const before = { rows: [...document.querySelectorAll('.k-hero')].map(h => h.dataset.row || ''),
                       lifted: document.querySelectorAll('.k-hero.k-lift').length };
      // THE FIGURE IS SHOWN, and the ask is named by the ACT rather than by
      // the input — this note answers a cast, so the ring says SIGIL.
      const shown = { sigil: !!ring.querySelector('.k-pr-sigil'),
                      ink: !!ring.querySelector('.k-pr-inkline'),
                      label: (ring.querySelector('.k-pr-lbl') || {}).textContent };
      // …and it is drawn FAR from the ring, deliberately: a draw that only
      // works near its own ring is the trace again.
      const cx = rb.left - 190, cy = rb.top + 40, R = 46;
      const pt = (a) => ({ x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R });
      const send = (type, p, id) => st.dispatchEvent(new PointerEvent(type,
        { bubbles: true, clientX: p.x, clientY: p.y, pointerId: id || 9 }));
      send('pointerdown', pt(0));
      for (let a = 0; a <= Math.PI * 2 + 0.2; a += Math.PI / 14) {
        send('pointermove', pt(a));
        await new Promise(r => setTimeout(r, 6));
      }
      const inked = ring.classList.contains('k-pr-inked');
      // RELEASE ON THE BEAT, NOT WHEN THE SHAPE IS DONE. A draw is graded on the
      // release exactly like a hold: the figure is made during the runway and
      // the LIFT is the answer. The first version of this check released the
      // instant the circle closed — hundreds of ms early — and the note
      // correctly refused it, which read as "releasing does not grade".
      const land = +ring.dataset.impact || 0;
      while (performance.now() < land - 40) await new Promise(r => setTimeout(r, 8));
      const trail = (ring.querySelector('.k-pr-inkline') || {}).getAttribute
        ? ring.querySelector('.k-pr-inkline').getAttribute('points') : '';
      const said = (ring.querySelector('.k-pr-lbl') || {}).textContent;
      send('pointerup', pt(0));
      await new Promise(r => setTimeout(r, 260));
      const after = { rows: [...document.querySelectorAll('.k-hero')].map(h => h.dataset.row || ''),
                      lifted: document.querySelectorAll('.k-hero.k-lift').length };
      return { found: true, shown, inked, said,
               trailPts: (trail || '').trim().split(/\s+/).filter(Boolean).length,
               gone: !document.body.contains(ring),
               boardStill: before.rows.join() === after.rows.join()
                        && before.lifted === after.lifted };
    });
    check('DRAW: a cast is answered by a drawn figure — the ring shows the shape and names the act',
      dr.found && dr.shown.sigil && dr.shown.ink && /SIGIL/.test(dr.shown.label || ''),
      JSON.stringify(dr.shown));
    check('DRAW: the shape is read from the STROKE, made far from the ring and still counted',
      dr.found && dr.inked && dr.trailPts > 10 && /RELEASE/.test(dr.said || ''),
      JSON.stringify({ inked: dr.inked, points: dr.trailPts, said: dr.said }));
    check('DRAW: releasing a made figure grades the note, and drawing moved nothing on the board',
      dr.found && dr.gone && dr.boardStill,
      JSON.stringify({ graded: dr.gone, boardStill: dr.boardStill }));

    // THE JUDGE ITSELF, in isolation — a circle reads, a straight line does not,
    // and a twitch too small to be a gesture reads as nothing at all.
    const judge = await J(() => {
      const K = window.K, R = 50;
      const ring = (n, turns) => Array.from({ length: n }, (_, i) => {
        const a = (i / (n - 1)) * Math.PI * 2 * turns;
        return [Math.cos(a) * R, Math.sin(a) * R];
      });
      const line = Array.from({ length: 30 }, (_, i) => [i * 6, 0]);
      const twitch = Array.from({ length: 30 }, (_, i) => {
        const a = (i / 29) * Math.PI * 2; return [Math.cos(a) * 4, Math.sin(a) * 4];
      });
      return { circle: +K.drawScore('circle', ring(40, 1)).toFixed(2),
               widdershins: +K.drawScore('circle', ring(40, -1)).toFixed(2),
               line: +K.drawScore('circle', line).toFixed(2),
               twitch: +K.drawScore('circle', twitch).toFixed(2),
               ok: K.DRAW_OK };
    });
    check('DRAW: the judge reads a circle either way round, and refuses a line or a twitch',
      judge.circle >= judge.ok && judge.widdershins >= judge.ok
      && judge.line < judge.ok && judge.twitch < judge.ok,
      JSON.stringify(judge));
  }
  await settle();
  // ── the note vocabulary: six kinds, each a different ask ──
  // …AND IT ASKS THE REGENT, so it starts by putting her back on the board.
  // The DRAW block above swaps in the Choir of One (the only foe left with a
  // clean two-note draw) and this block inherited it — then asked the Choir for
  // the Regent's hymn and scythe. Under Build 94 that is four loud console
  // errors instead of four silent substitutions, which is the entire reason
  // `forceIntent` learned to shout.
  await fresh(7);
  {
    const vocab = await J(() => {
      const kinds = new Set();
      for (const it of ['hymn', 'scythe', 'dirgesong', 'rain']) {
        window.K.forceIntent(it);
        (window.K.currentIntent().hits || []).forEach(h =>
          h.notes.forEach(n => kinds.add(String(n).split(':')[0])));
      }
      window.K.forceIntent('scythe');
      const dirs = (window.K.currentIntent().hits || [])
        .flatMap(h => h.notes).filter(n => /:/.test(n));
      return { kinds: [...kinds].sort().join(','), dirs: dirs.join(','),
               dirOK: window.K.dirOK('R', 40, 4) && !window.K.dirOK('R', -40, 4)
                   && window.K.dirOK('L', -40, 2) && !window.K.dirOK('L', 5, 40) };
    });
    check('NOTES: the volley draws on six kinds, not one gesture repeated',
      /bait/.test(vocab.kinds) && /burst/.test(vocab.kinds) && /feint/.test(vocab.kinds)
      && /hold/.test(vocab.kinds) && /slide/.test(vocab.kinds) && /tap/.test(vocab.kinds),
      vocab.kinds);
    check('NOTES: a directional slide only answers to its own direction',
      /slide:R/.test(vocab.dirs) && /slide:L/.test(vocab.dirs) && vocab.dirOK,
      JSON.stringify(vocab.dirs));
  }
  // ── wrong way on the beat: a misread arrow costs a grade, not the string ──
  await fresh(7);
  {
    const wrong = await J(async () => {
      window.K.forceIntent('scythe');
      const done = window.K.endTurn();
      const st = document.getElementById('k-stage');
      let ring = null;
      for (let i = 0; i < 300 && !ring; i++) {           // wait for the first arrow
        ring = st.querySelector('.k-pring[data-dir]');
        if (!ring) await new Promise(res => setTimeout(res, 12));
      }
      if (!ring) return { found: false };
      const dir = ring.dataset.dir;
      const ax = { L: 70, R: -70, U: 0, D: 0 }[dir], ay = { U: 70, D: -70, L: 0, R: 0 }[dir];
      const wait = +ring.dataset.impact - performance.now() - 60;    // commit just early
      if (wait > 0) await new Promise(res => setTimeout(res, wait));
      const pt = (t, x, y) => st.dispatchEvent(new PointerEvent(t,
        { bubbles: true, clientX: x, clientY: y, pointerId: 9 }));
      pt('pointerdown', 400, 200);
      pt('pointermove', 400 + ax, 200 + ay);             // straight the wrong way
      pt('pointerup', 400 + ax, 200 + ay);
      const r = await done;
      return { found: true, dir, first: r.grades[0] };
    });
    check('NOTES: a misread arrow answered on the beat pays a grade, not the whole string',
      wrong.found && wrong.first !== 'miss' && wrong.first !== 'late', JSON.stringify(wrong));
  }
  await settle();
  // ── bait and burst resolve on their own rules ──
  await fresh(7);
  {
    const bait = await J(async () => {
      window.K.forceIntent('dirgesong');            // its first note is a bait
      const r = window.K.endTurn();
      // WAIT FOR THE RING, DO NOT GUESS AT IT. This slept a flat 620ms and then
      // asked whether the ring was up. Under load — a slower render, a heavier
      // hand, another suite sharing the browser — the lead-in and that constant
      // drift apart, and the check reports the parry bar missing when it is
      // merely late. Three separate parry checks were wandering in and out of
      // red on exactly this, never the same one twice, which is the signature
      // of a racing probe rather than a broken feature. Poll for the thing.
      for (let i = 0; i < 200 && !document.querySelector('.k-pring'); i++) {
        await new Promise(res => setTimeout(res, 10));
      }
      await new Promise(res => setTimeout(res, 60));   // …and let it settle in
      const ring = document.querySelector('.k-pring');
      const kind = ring && ring.dataset;
      const mark = ring && ring.querySelector('.k-pr-x svg');
      // leave it strictly alone
      await new Promise(res => setTimeout(res, 900));
      const out = await r;
      return { firstKind: kind && kind.kind, skull: !!mark,
               grades: out.grades.slice(0, 1) };
    });
    check('BAIT: the do-not-touch ring wears a skull, not a glyph to be learned',
      bait.skull, JSON.stringify({ skull: bait.skull, kind: bait.firstKind }));
    check('BAIT: a crossed ring left untouched is the best read there is',
      bait.firstKind === 'bait' && bait.grades[0] === 'perfect', JSON.stringify(bait));
  }
  await settle();
  await fresh(7);
  {
    const burst = await J(async () => {
      window.K.forceIntent('rain');                 // opens on a burst
      const r = window.K.endTurn();
      // WAIT FOR THE RING, DO NOT GUESS AT IT. This slept a flat 620ms and then
      // asked whether the ring was up. Under load — a slower render, a heavier
      // hand, another suite sharing the browser — the lead-in and that constant
      // drift apart, and the check reports the parry bar missing when it is
      // merely late. Three separate parry checks were wandering in and out of
      // red on exactly this, never the same one twice, which is the signature
      // of a racing probe rather than a broken feature. Poll for the thing.
      for (let i = 0; i < 200 && !document.querySelector('.k-pring'); i++) {
        await new Promise(res => setTimeout(res, 10));
      }
      await new Promise(res => setTimeout(res, 60));   // …and let it settle in
      const st = document.getElementById('k-stage');
      const kind = (document.querySelector('.k-pring') || {}).dataset;
      for (let i = 0; i < 3; i++) {                 // land the flurry
        st.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 400, clientY: 200, pointerId: 9 }));
        await new Promise(res => setTimeout(res, 40));
      }
      const out = await r;
      return { firstKind: kind && kind.kind, first: out.grades[0] };
    });
    check('BURST: landing the whole flurry before the ring shuts reads clean',
      burst.firstKind === 'burst' && burst.first !== 'miss', JSON.stringify(burst));
  }
  await settle();
  // ── the clash: a turned blow is the best thing in the game and hits like it ──
  await fresh(7);
  {
    const clash = await J(async () => {
      window.K.forceIntent('scythe');
      const notes = window.K.currentIntent().hits.reduce((n, h) => n + h.notes.length, 0);
      const done = window.K.endTurn({ grades: Array(notes).fill('perfect') });
      const out = { crescent: 0, shards: 0, flash: 0, flared: false, shock: 0, pulse: false };
      for (let i = 0; i < 90; i++) {
        const d = document.querySelector('.k-deflect');
        if (d) {
          out.crescent = Math.max(out.crescent, d.querySelectorAll('.k-df-crescent').length);
          out.shards = Math.max(out.shards, d.querySelectorAll('.k-df-shard').length);
          out.flash = Math.max(out.flash, d.querySelectorAll('.k-df-flash').length);
        }
        out.shock = Math.max(out.shock, document.querySelectorAll('.k-shock-gold').length);
        out.flared = out.flared || !!document.querySelector('.k-hero.k-deflected');
        out.pulse = out.pulse || !!document.querySelector('.k-pulse-gold');
        await new Promise(res => setTimeout(res, 14));
      }
      const r = await done;
      out.negated = r.negated;
      out.taken = r.taken;
      return out;
    });
    check('CLASH: a deflected blow throws a crescent, shards and a flash — not one ring',
      clash.negated > 0 && clash.taken === 0 && clash.crescent === 1 && clash.shards >= 6
      && clash.flash === 1 && clash.flared && clash.shock >= 2 && clash.pulse,
      JSON.stringify(clash));
  }
  await settle();
  // ── impact: a blow stops, kicks and shocks ──
  await fresh(7);
  {
    const hit = await J(async () => {
      window.K.forceHand(['lastlight', 'cleave', 'mend', 'serrate', 'frostbind']);
      window.K.playCard('cleave');
      const st = document.getElementById('k-stage');
      const out = {
        shock: document.querySelectorAll('.k-shock').length,
        kicked: /k-kick/.test(st.className),
        frozen: st.classList.contains('k-frozen'),
        struck: !!document.querySelector('#k-boss-art.k-struck'),
        // the Regent is thrown AWAY from the party, not merely lit
        thrown: !!document.querySelector('#k-boss-art.k-struck-r'),
        // an ORDINARY blow flashes too — the old rule only flashed above 1.2
        flash: document.querySelectorAll('.k-hitflash').length,
        pop: !!document.querySelector('.k-pop-dmg'),
      };
      // the freeze has to be long enough to perceive: under ~70ms it reads as a
      // dropped frame rather than a held one
      await new Promise(r => setTimeout(r, 66));
      out.stillFrozen = st.classList.contains('k-frozen');
      await new Promise(r => setTimeout(r, 600));
      out.left = { shock: document.querySelectorAll('.k-shock').length,
                   kick: /k-kick/.test(st.className),
                   flash: document.querySelectorAll('.k-hitflash').length,
                   frozen: st.classList.contains('k-frozen') };
      out.cleared = !out.left.shock && !out.left.kick && !out.left.flash && !out.left.frozen;
      return out;
    });
    check('IMPACT: an ordinary blow flashes, throws the figure, and holds the frame',
      hit.flash >= 1 && hit.thrown && hit.stillFrozen,
      JSON.stringify({ flash: hit.flash, thrown: hit.thrown, heldPast66ms: hit.stillFrozen }));
    check('IMPACT: a strike stops the frame, kicks the screen, and blows a shock ring',
      hit.shock >= 1 && hit.kicked && hit.frozen && hit.struck && hit.pop && hit.cleared,
      JSON.stringify(hit));
  }
  // ── snapping: a blunt finger still finds the right target ──
  await fresh(7);
  {
    const snap = await J(() => {
      const enemyCard = [...document.querySelectorAll('#k-hand .k-card')]
        .find(c => window.K.evaluateCard(c.dataset.card).card.target === 'enemy');
      const partyCard = [...document.querySelectorAll('#k-hand .k-card')]
        .find(c => window.K.evaluateCard(c.dataset.card).card.target !== 'enemy');
      const boss = document.getElementById('k-boss-art').getBoundingClientRect();
      const ash = document.querySelector('.k-hero[data-hero="ash"]').getBoundingClientRect();
      const K = window.K;
      return {
        // well short of the Regent, but nothing else is nearer: still snaps
        nearMiss: K.dropTargetAt(boss.left - 70, boss.top + boss.height / 2, enemyCard.dataset.card),
        // an attack never snaps to a hero, however close the finger is
        wrongSide: K.dropTargetAt(ash.left + 5, ash.top + 20, enemyCard.dataset.card),
        // a party card over Ash picks Ash specifically
        ally: K.dropTargetAt(ash.left + ash.width / 2, ash.top + ash.height / 2,
                             partyCard.dataset.card),
        // and nothing at all when the finger is miles away. NOT the bottom-left
        // corner any more — that is the draw pile, which is now the swap zone.
        far: K.dropTargetAt(6, 6, enemyCard.dataset.card),
      };
    });
    check('SNAP: a near miss still finds the Regent, and an attack never snaps to an ally',
      snap.nearMiss && snap.nearMiss.zone === 'enemy' && snap.nearMiss.snapped
      && (!snap.wrongSide || snap.wrongSide.zone === 'enemy'),
      JSON.stringify({ near: snap.nearMiss, wrong: snap.wrongSide }));
    check('SNAP: a party card picks the nearest hero, and a wild throw picks nothing',
      snap.ally && snap.ally.zone === 'party' && snap.ally.hero === 'ash' && !snap.far,
      JSON.stringify({ ally: snap.ally, far: snap.far }));
  }
  // ── the piles open, Slay-the-Spire style ──
  await fresh(7);
  {
    const pile = await J(() => {
      document.getElementById('k-deck-btn').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      const f = document.getElementById('k-focus');
      const out = {
        open: !f.classList.contains('k-hidden'),
        head: f.querySelector('.k-pile-head') && f.querySelector('.k-pile-head').textContent.replace(/\s+/g, ' ').trim(),
        cards: f.querySelectorAll('.k-pile-grid .k-card').length,
        deckN: window.K.state().deck.length,
        readable: !!f.querySelector('.k-pile-grid .k-cprose'),
        // opening the draw pile must not leak the shuffle
        sorted: [...f.querySelectorAll('.k-pile-grid .k-cname')].map(n => n.textContent),
        drawOrder: window.K.state().deck.slice().map(id => window.K.evaluateCard(id).card.name),
      };
      document.getElementById('k-stage').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 460, clientY: 40 }));
      out.closed = document.getElementById('k-focus').classList.contains('k-hidden');
      return out;
    });
    check('PILES: the draw pile opens as readable cards and closes on a tap',
      pile.open && pile.cards === pile.deckN && pile.readable && pile.closed
      && /DRAW PILE/.test(pile.head), JSON.stringify({ head: pile.head, cards: pile.cards, deck: pile.deckN }));
    check('PILES: opening the draw pile does not leak the shuffle order',
      pile.sorted.join('|') !== pile.drawOrder.join('|') || pile.cards <= 1,
      'shown: ' + pile.sorted.slice(0, 3).join(',') + ' … actual: ' + pile.drawOrder.slice(0, 3).join(','));
  }
  // ── the piles are visible objects, and cards are SEEN entering them ──
  await fresh(7);
  {
    const piles = await J(async () => {
      const st = document.getElementById('k-stage').getBoundingClientRect();
      const d = document.getElementById('k-deck-btn').getBoundingClientRect();
      const x = document.getElementById('k-disc-btn').getBoundingClientRect();
      const ap = document.getElementById('k-ap').getBoundingClientRect();
      const et = document.getElementById('k-endturn').getBoundingClientRect();
      const dot = document.getElementById('k-cycle-dot').getBoundingClientRect();
      const overlaps = (a, b) => !(a.right <= b.left || a.left >= b.right
        || a.bottom <= b.top || a.top >= b.bottom);
      // THE ORB IS GONE. AP was a 66px ring with a numeral in it stacked over
      // three diamonds, in the bottom-left corner — the one corner a player
      // reading their hand never looks at. It is a row of marks under the hand
      // now, so what this check must prove moved with it: the marks are BELOW
      // the cards (that is the whole point of the move), there is one per AP in
      // the budget, and lit-vs-hollow tracks what is left. A check that still
      // measured a border-radius would have gone green on a deleted element.
      const hand = document.getElementById('k-hand').getBoundingClientRect();
      const pips = Array.from(document.querySelectorAll('.k-ap-pip'));
      const st23 = window.K.state();
      const out = {
        deckLeft: d.left - st.left < st.width * 0.35,
        discRight: st.right - x.right < st.width * 0.35,
        lowerThird: d.top - st.top > st.height * 0.6 && x.top - st.top > st.height * 0.6,
        // one mark per point of budget, lit for what is still spendable
        apMarks: pips.length,
        apBudget: st23.apMax,
        apLit: pips.filter(p => !p.classList.contains('k-ap-off')).length,
        apLeft: st23.ap,
        // …and they sit BELOW THE CARD FACES, which is where the spending
        // happens. It asked `ap.top >= hand.bottom` — the hand CONTAINER's
        // bottom — which is a different thing from the cards in it: the fan
        // arcs up in the middle, so the container's box runs well past the
        // lowest card and any AP row taller than a hairline failed a test it
        // was not actually failing. What matters is that no card is painted
        // over, and that the row is not jammed into the last few pixels of the
        // stage where a phone puts its home indicator.
        apUnderHand: ap.top >= Math.max.apply(null,
          [...document.querySelectorAll('#k-hand .k-card')]
            .map(c => c.getBoundingClientRect().top)) ,
        apClearOfCards: ![...document.querySelectorAll('#k-hand .k-card')]
          .some(c => overlaps(ap, c.getBoundingClientRect())),
        apOffTheEdge: (st.bottom - ap.bottom) >= 4,
        apArea: Math.round(ap.width * ap.height),
        apCentred: Math.abs((ap.left + ap.right) / 2 - (hand.left + hand.right) / 2) < 8,
        endTurnAboveDiscard: et.bottom <= x.top,
        noOverlap: !overlaps(ap, d) && !overlaps(ap, x) && !overlaps(et, x)
          && !overlaps(et, d) && !overlaps(d, x),
        // the free swap is a dot ON the draw pile, not a chip of its own
        swapOnDeck: dot.left >= d.left - 6 && dot.right <= d.right + 6
          && dot.top >= d.top - 6 && dot.bottom <= d.bottom + 6,
        deckN: document.getElementById('k-deck-n').textContent,
        discN: document.getElementById('k-disc-n').textContent,
        stateDeck: String(window.K.state().deck.length),
        stacked: !!document.querySelector('#k-deck-btn .k-pile-stack'),
      };
      // playing a card sends a ghost of it to the discard, and the pile thumps
      window.K.forceHand(['cleave', 'mend', 'serrate', 'frostbind', 'twinfang']);
      window.K.playCard('cleave');
      out.flying = document.querySelectorAll('.k-fly').length;
      out.thumped = document.getElementById('k-disc-btn').classList.contains('k-pile-thump');
      await new Promise(r => setTimeout(r, 260));
      out.landed = document.querySelectorAll('.k-fly').length === 0;
      out.discAfter = document.getElementById('k-disc-n').textContent;
      return out;
    });
    check('PILES: a draw stack and a discard stack sit in the lower corners, counting live',
      piles.deckLeft && piles.discRight && piles.lowerThird && piles.stacked
      && piles.deckN === piles.stateDeck, JSON.stringify(piles));
    // THE ROW IS BIGGER THAN A HAIRLINE, and the area is asserted because that
    // is the finding it answers. The realtime playtest counted 23.3 things to
    // parse per turn and found the number gating every decision was 41x9px —
    // 369 square pixels, 0.09% of the board — in the last row of pixels on the
    // stage. 600 is the floor now: not four times bigger, which was tried and
    // measured into the centre card of the fan, but enough that it is not the
    // smallest thing on a screen it is the most important thing on.
    check('BOTTOM BAR: AP is a row of marks under the hand, one per point, and nothing overlaps',
      piles.apMarks === piles.apBudget && piles.apLit === piles.apLeft
      && piles.apUnderHand && piles.apCentred && piles.apClearOfCards
      && piles.apOffTheEdge && piles.apArea >= 600
      && piles.endTurnAboveDiscard && piles.noOverlap && piles.swapOnDeck,
      JSON.stringify({ marks: piles.apMarks, budget: piles.apBudget, lit: piles.apLit,
        left: piles.apLeft, under: piles.apUnderHand, clearOfCards: piles.apClearOfCards,
        offEdge: piles.apOffTheEdge, area: piles.apArea, centred: piles.apCentred,
        etAbove: piles.endTurnAboveDiscard, clear: piles.noOverlap, swap: piles.swapOnDeck }));

    // …AND IT ANSWERS THE QUESTION THE HAND ACTUALLY ASKS. Not "how much do I
    // have" — the marks already said that — but "if I play THIS, what is left".
    // That was arithmetic done in the player's head on every card.
    const preview = await J(() => {
      window.K.startCombat({ seed: 4 });
      window.K.forceHand(['crosssever', 'cleave', 'mend', 'serrate', 'frostbind']);
      const going = () => document.querySelectorAll('.k-ap-pip.k-ap-going').length;
      const idle = going();
      const tap = (id) => {
        const c = document.querySelector('.k-card[data-card="' + id + '"]');
        const r = c.getBoundingClientRect();
        c.dispatchEvent(new PointerEvent('pointerdown',
          { bubbles: true, clientX: r.left + 20, clientY: r.top + 20, pointerId: 31 }));
        c.dispatchEvent(new PointerEvent('pointerup',
          { bubbles: true, clientX: r.left + 20, clientY: r.top + 20, pointerId: 31 }));
      };
      tap('cleave');                                   // costs 1
      const one = going();
      tap('crosssever');                               // costs 2 cold
      const two = going();
      return { idle, one, two, short: document.getElementById('k-ap').classList.contains('k-ap-short') };
    });
    check('BOTTOM BAR: holding a card shows which marks it would take, before it takes them',
      preview.idle === 0 && preview.one === 1 && preview.two === 2,
      JSON.stringify(preview));
    // ── A CARD DRAWN MID-TURN HAS TO ARRIVE ────────────────────────────────
    // Measured before this was written: the card Quick Throw draws wore an
    // arrival state for exactly **0ms**. `drawOne()` pushed it into the hand
    // and the next render painted it there — and because Quick Throw plays one
    // and draws one, the hand never changed size either, so there was no signal
    // of any kind that a draw had happened. Worse, the discard prompt and the
    // red pick-pulse appeared 76ms after the play, while the card being PLAYED
    // was still 340ms from landing: the question arrived on top of its own
    // setup, and all five cards pulsed identically so the new one was
    // indistinguishable from the four that were not.
    // …and it is asserted STRUCTURALLY, not on the clock. The suite runs under
    // `?test=1`, where every flight is 40ms and every sleep 6ms, so a wall-clock
    // threshold here would measure the harness. The ordering is the claim, and
    // it holds at any speed: the question is not armed at the moment the card
    // is played, the card flies, it lands wearing a mark, and only then is the
    // hand asked. (The real durations were measured separately at `?realtime=1`
    // — 305ms of arrival, the prompt at 791ms instead of 76ms.)
    const drew = await J(async () => {
      window.K.startCombat({ seed: 7 });
      window.K.state().ap = 9;
      window.K.forceHand(['qthrow', 'cstance', 'serrate', 'mend', 'frostbind']);
      let sawFlight = 0, sawArrival = 0, freshTicks = 0, armedTicks = 0;
      const tick = setInterval(() => {
        sawFlight = Math.max(sawFlight, document.querySelectorAll('.k-fly').length);
        if (document.querySelector('#k-hand .k-card.k-arriving, #k-hand .k-card.k-landed'))
          sawArrival++;
        if (document.querySelector('#k-hand .k-card.k-card-fresh')) freshTicks++;
        if (document.getElementById('k-hand').classList.contains('k-pick-discard')) armedTicks++;
      }, 8);
      window.K.playCard('qthrow');
      // the two halves, read at the instant the play resolves
      const atPlay = { pending: !!window.K.state().pendingDiscard,
                       armed: !!window.K.state().discardArmed,
                       promptUp: !document.getElementById('k-discard-prompt')
                                    .classList.contains('k-hidden') };
      await new Promise(r => setTimeout(r, 900));
      clearInterval(tick);
      return { atPlay, sawFlight, sawArrival, freshTicks, armedTicks,
               marked: document.querySelectorAll('#k-hand .k-card.k-card-fresh').length,
               armedAfter: !!window.K.state().discardArmed };
    });
    // two ghosts in the air at once: the card being played on its way out, and
    // the card being drawn on its way in — the second of which did not exist
    check('DRAW: a card drawn mid-turn flies in and is MARKED as the new one',
      drew.sawFlight >= 2 && drew.sawArrival > 0 && drew.freshTicks > 10
      && drew.marked === 1, JSON.stringify(drew));
    check('DRAW: …and the discard is asked AFTER it lands, not on top of it',
      drew.atPlay.pending && !drew.atPlay.armed && !drew.atPlay.promptUp
      && drew.armedAfter && drew.armedTicks > 0 && drew.armedTicks < drew.freshTicks,
      JSON.stringify(drew.atPlay));

    check('PILES: a played card is seen flying into the discard, and the pile thumps',
      piles.flying >= 1 && piles.thumped && piles.landed && piles.discAfter === '1',
      JSON.stringify({ flying: piles.flying, thump: piles.thumped, after: piles.discAfter }));
  }
  // ── the draw is SEEN: cards fly out of the deck and grow into the hand ──
  await fresh(9);
  {
    const draw = await J(async () => {
      window.K.forceHand(['cleave', 'mend', 'serrate', 'frostbind', 'twinfang']);
      window.K.forceIntent('dirgesong');
      window.K.endTurn({ grades: ['miss', 'miss'] });
      const out = { flew: 0, faceDown: 0, grew: false, hidden: false };
      for (let i = 0; i < 200; i++) {
        if (window.K.state().phase === 'HAND_DRAWING') {
          const g = document.querySelectorAll('.k-fly');
          out.flew = Math.max(out.flew, g.length);
          out.faceDown = Math.max(out.faceDown,
            document.querySelectorAll('.k-fly.k-fly-back').length);
          // the real card stays invisible until its ghost lands on it
          if ([...document.querySelectorAll('#k-hand .k-card')].some(c => c.style.opacity === '0'))
            out.hidden = true;
        }
        await new Promise(r => setTimeout(r, 6));
      }
      await new Promise(r => setTimeout(r, 400));
      out.settled = [...document.querySelectorAll('#k-hand .k-card')].every(c => c.style.opacity !== '0');
      out.hand = window.K.state().hand.length;
      return out;
    });
    check('DRAW: a card is seen leaving the deck face down and arriving in the hand',
      draw.flew >= 1 && draw.faceDown >= 1 && draw.hidden && draw.settled && draw.hand === 5,
      JSON.stringify(draw));
    const fan = await J(() => {
      const cards = [...document.querySelectorAll('#k-hand .k-card')];
      const v = (c, n) => parseFloat(c.style.getPropertyValue(n));
      return {
        // the hand has its own lens, and the cards lean away from it
        lens: getComputedStyle(document.getElementById('k-hand')).perspective,
        tilts: cards.map(c => v(c, '--tilt')),
        // the OUTER cards lean hardest and the centre stands square
        splayed: Math.abs(v(cards[0], '--tilt')) > 4
          && Math.abs(v(cards[2], '--tilt')) < 1
          && v(cards[0], '--tilt') * v(cards[4], '--tilt') < 0,
        // and the fan re-flows rather than snapping when a card joins it
        eased: /cubic-bezier/.test(getComputedStyle(cards[0]).transitionTimingFunction)
          && parseFloat(getComputedStyle(cards[0]).transitionDuration) > 0.1,
      };
    });
    check('HAND: the fan sits in its own perspective and leans away at the edges',
      /px/.test(fan.lens) && fan.splayed && fan.eased, JSON.stringify(fan));
  }
  await settle();
  // ── the end-of-turn sweep, card by card ──
  await fresh(8);
  {
    const sweep = await J(async () => {
      window.K.forceHand(['cleave', 'mend', 'serrate', 'frostbind', 'twinfang']);
      window.K.forceIntent('dirgesong');
      const held = window.K.state().hand.length;
      window.K.endTurn({ grades: ['miss', 'miss'] });
      // A card must LEAVE the hand as its ghost launches. If the original sits
      // there until the last one has flown, hand + ghosts exceeds what was held
      // and the sweep reads as the hand duplicating itself.
      // SAMPLE THE GHOSTS, NOT THE PHASE. This gated on
      // `phase === 'HAND_DISCARDING'`, and Build 94 stopped AWAITING the sweep
      // — it plays under the foe drawing breath now, because nothing in the
      // enemy phase reads the hand and the 0.78s it cost was 0.78s of an enemy
      // turn measured at 7.95s. So the phase is HAND_DISCARDING for a single
      // frame, `samples` came back 0, and a check that had found a real bug
      // twice reported nothing at all. What it is actually asserting is a
      // VISUAL invariant — a card leaves the hand as its ghost launches, so
      // hand + ghosts never exceeds what was held — and ghosts on screen is
      // exactly when that can be observed.
      // …and it stops at the DRAW. Ghosts fly in both directions — the sweep
      // throws cards to the discard, the top of the next turn pulls five out of
      // the deck — and a sampler that only looked for `.k-fly` counted the
      // arriving hand as the leaving one and reported five cards of overflow
      // that were simply the next turn beginning.
      let over = 0, mid = 0, shrank = false, samples = 0;
      for (let i = 0; i < 220; i++) {
        if (window.K.state().phase === 'HAND_DRAWING') break;
        const fly = document.querySelectorAll('.k-fly').length;
        const inHand = document.querySelectorAll('#k-hand .k-card').length;
        if (fly > 0) {
          mid = Math.max(mid, fly);
          over = Math.max(over, inHand + fly - held);
          if (inHand < held) shrank = true;
          samples++;
        }
        await new Promise(r => setTimeout(r, 4));
      }
      await new Promise(r => setTimeout(r, 900));
      const s = window.K.state();
      return { held, mid, over, shrank, samples, hand: s.hand.length, discard: s.discard.length };
    });
    check('SWEEP: the hand empties as the cards fly — it never duplicates itself',
      sweep.samples > 0 && sweep.over <= 0 && sweep.shrank,
      JSON.stringify({ over: sweep.over, shrank: sweep.shrank, samples: sweep.samples }));
    check('SWEEP: ending the turn throws the whole hand to the discard, one card at a time',
      sweep.mid >= 1 && sweep.discard >= sweep.held && sweep.hand === 5,
      JSON.stringify(sweep));
  }
  // ── hold to inspect, release to dismiss (MTG Arena) ──
  await fresh(7);
  {
    const insp = await J(async () => {
      const card = document.querySelector('#k-hand .k-card');
      const id = card.dataset.card;
      const r = card.getBoundingClientRect();
      const at = (t) => card.dispatchEvent(new PointerEvent(t, { bubbles: true, clientX: r.left + 20, clientY: r.top + 20, pointerId: 1 }));
      const before = window.K.state().hand.length;
      at('pointerdown');
      await new Promise(res => setTimeout(res, 560));
      const f = document.getElementById('k-focus');
      const open = !f.classList.contains('k-hidden');
      const big = !!f.querySelector('.k-insp-card .k-cprose');
      const dimmed = document.getElementById('k-stage').classList.contains('k-inspecting');
      const noCommit = !f.querySelector('#k-focus-commit');
      at('pointerup');
      return { open, big, dimmed, noCommit,
               closed: document.getElementById('k-focus').classList.contains('k-hidden'),
               unplayed: window.K.state().hand.length === before && window.K.state().hand.includes(id) };
    });
    check('INSPECT: holding blows the card up over a dimmed board, MTG-Arena style',
      insp.open && insp.big && insp.dimmed && insp.noCommit, JSON.stringify(insp));
    check('INSPECT: releasing dismisses it and never plays the card',
      insp.closed && insp.unplayed, JSON.stringify({ closed: insp.closed, unplayed: insp.unplayed }));
    // A THUMB IS NOT A MOUSE. This is the check that was missing, and its
    // absence hid the worst bug in the build for six builds. A deliberate drag
    // on a phone does not clear the 14px threshold inside the hold timer's
    // 420ms, so the hold latched first and pointermove returned early FOREVER:
    // the player swept the card onto the Regent, let go, and nothing happened.
    // A mouse crosses 14px almost instantly, so every desktop-shaped gesture in
    // this suite — including the two checks directly above — sailed past it.
    // The rule is that a hold which turns into a move becomes a drag, which is
    // what the inspect panel has been promising in words since Build 28.
    await fresh(7);
    {
      const slow = await J(async () => {
        window.K.forceHand(['cleave', 'mend', 'serrate', 'frostbind', 'execute']);
        const card = document.querySelector('#k-hand .k-card[data-card="cleave"]');
        const id = card.dataset.card, r = card.getBoundingClientRect();
        const x0 = r.left + r.width / 2, y0 = r.top + r.height / 2;
        const at = (t, x, y) => card.dispatchEvent(new PointerEvent(t, {
          bubbles: true, clientX: x, clientY: y, pointerId: 1 }));
        const wait = (ms) => new Promise(res => setTimeout(res, ms));
        const before = window.K.state().hand.length;
        at('pointerdown', x0, y0);
        // creep: six tiny moves over ~540ms, never clearing the threshold
        for (let i = 0; i < 6; i++) { at('pointermove', x0 + i, y0 - i); await wait(90); }
        const inspected = !document.getElementById('k-focus').classList.contains('k-hidden');
        // then a real sweep to the Regent
        const boss = document.getElementById('k-boss-art').getBoundingClientRect();
        for (let i = 1; i <= 10; i++)
          at('pointermove', x0 + (boss.left + boss.width / 2 - x0) * i / 10,
                            y0 + (boss.top + boss.height / 2 - y0) * i / 10);
        const drags = card.classList.contains('k-aiming')
          && ((document.getElementById('k-aim') || {}).innerHTML || '').length > 0;
        at('pointerup', boss.left + boss.width / 2, boss.top + boss.height / 2);
        await wait(240);
        return { inspected, drags, played: window.K.state().hand.length < before,
                 closed: document.getElementById('k-focus').classList.contains('k-hidden'),
                 lifted: [...document.querySelectorAll('#k-hand .k-card')]
                   .some(c => c.classList.contains('k-aiming')
                              || c.style.getPropertyValue('--dragx')) };
      });
      check('DRAG: a slow thumb-speed drag becomes a drag, not a dead inspect',
        slow.inspected && slow.drags && slow.played && slow.closed && !slow.lifted,
        JSON.stringify(slow));
    }

    // ── THE FOE ACTS ────────────────────────────────────────────────────
    // It used to be a still picture with a breathe on it: no wind-up, no swing,
    // no recovery, so a whole barrage played out as rings appearing over the
    // party while the thing throwing them stood perfectly still.
    await fresh(7);
    {
      const act = await J(async () => {
        const b = document.getElementById('k-boss-art');
        const seen = new Set();
        const poses = new Set(), swings = new Set(), both = [];
        const tick = setInterval(() => {
          seen.add(b.className);
          const cls = b.className.split(/\s+/).filter(Boolean);
          const p = cls.filter(c => /^k-foe-/.test(c));
          const w = cls.filter(c => /^k-fs-/.test(c));
          p.forEach(c => poses.add(c)); w.forEach(c => swings.add(c));
          if (p.length && w.length) both.push(1);
        }, 60);
        await window.K.endTurn();
        clearInterval(tick);
        return { poses: [...poses], swings: [...swings], both: both.length,
                 rest: b.className, restPose: /k-foe-|k-fs-/.test(b.className),
                 idle: getComputedStyle(b.querySelector('.k-fig')).animationName,
                 phase: window.K.state().phase };
      });
      // A POSE AND A BLOW MUST RUN TOGETHER. They are on different CSS
      // properties (translate/scale vs transform) precisely so they compose —
      // and the first version cleared both from one list, so every note
      // stripped the posture off the foe and all four intents looked alike.
      check('FOE: it takes a posture for its intent and swings on every note, at once',
        act.poses.length >= 1 && act.swings.length >= 1 && act.both > 0,
        JSON.stringify({ poses: act.poses, swings: act.swings, overlapping: act.both }));
      // …and stands down when the turn comes back. A posture held past its act
      // is a foe frozen mid-lunge for the rest of the fight.
      check('FOE: it stands down when the turn returns to the player',
        act.restPose === false && act.phase === 'PLAYER_READY',
        JSON.stringify({ rest: act.rest, phase: act.phase }));
    }

    // FIVE OPPONENTS, FIVE IDLES — and five different hands. The bestiary's
    // stated promise is that each foe's handwriting is legible after one turn;
    // it was false in both halves at once, because all five shared the party's
    // breathe and every one of them opened with the Hymn.
    const bestiary = await J(() => {
      const ids = ['husk', 'cultist', 'wraith', 'revenant', 'mourner'];
      const idles = {}, hands = {};
      for (const id of ids) {
        window.K.startCombat({ seed: 4, foe: window.K.FOES[id] });
        const b = document.getElementById('k-boss-art');
        idles[id] = getComputedStyle(b.querySelector('.k-fig')).animationName;
        hands[id] = window.K.FOES[id].intents.slice().sort().join(',');
      }
      return { idles, hands };
    });
    check('FOE: every opponent has its own idle — five figures, five ways of standing',
      new Set(Object.values(bestiary.idles)).size === 5
      && !Object.values(bestiary.idles).some(n => !n || n === 'none' || n === 'k-breathe'),
      JSON.stringify(bestiary.idles));
    check('FOE: no two opponents play the same hand of intents',
      new Set(Object.values(bestiary.hands)).size === 5,
      JSON.stringify(bestiary.hands));

    // THE NOTE LADDER — what the bar ASKS has to rise with what the foe IS.
    //
    // The realtime playtest found this inverted at the top and flat at the
    // bottom: the Grief-Wraith (84 HP, a third fight) had a floor of 4 notes
    // while the Mourning Regent (98 HP, the boss) could open a bar on 2. The
    // first opponent in a run and the last could ask the same amount, and the
    // curve meant to teach the vocabulary taught nothing.
    //
    // The FLOOR is the statistic that matters. A mean is something no player
    // ever experiences; the lightest bar a foe can open on is the first thing
    // they meet of it. Both floor and ceiling are asserted non-decreasing down
    // the ladder, so a future re-deal cannot quietly flatten it again.
    const rungs = await J(() => {
      const order = ['husk', 'cultist', 'wraith', 'revenant', 'mourner'];
      const all = window.K.INTENTS();
      return order.map(id => {
        const counts = window.K.FOES[id].intents.map(iid => {
          const it = all.find(x => x.id === iid);
          return it ? it.hits.reduce((a, h) => a + h.notes.length, 0) : 0;
        });
        return { id, floor: Math.min(...counts), ceil: Math.max(...counts) };
      });
    });
    const rising = (k) => rungs.every((r, i) => i === 0 || r[k] >= rungs[i - 1][k]);
    check('LADDER: the lightest bar a foe can open on rises with its place in the run',
      rising('floor') && rungs[0].floor < rungs[4].floor,
      rungs.map(r => r.id + ' ' + r.floor + '\u2013' + r.ceil).join('  '));
    check('LADDER: …and so does the heaviest',
      rising('ceil') && rungs[0].ceil < rungs[4].ceil,
      rungs.map(r => r.id + ' ' + r.floor + '\u2013' + r.ceil).join('  '));

    // A DEAD FOE ENDS THE FIGHT, asserted on the paint rather than only where
    // the damage is dealt. Inside a run combat draws no outcome card — the road
    // owns it — so a board left playable at 0 HP has nothing on it to press.
    const net = await J(() => {
      window.K.startCombat({ seed: 7 });
      const s = window.K.state();
      s.boss.hp = 0;                       // by some route other than dealToBoss
      window.K.render();
      const zero = window.K.state().phase;
      window.K.startCombat({ seed: 7 });
      window.K.state().boss.hp = NaN;      // …and the one that compares false
      window.K.render();
      return { zero, nan: window.K.state().phase };
    });
    check('FOE: a foe at zero — or at NaN — ends the fight on the next paint',
      net.zero === 'VICTORY' && net.nan === 'VICTORY', JSON.stringify(net));

    // COMBAT MUST NEVER BE A DEAD END. A player has been stranded twice on a
    // finished fight: foe at zero, no outcome card, nothing to press. Inside a
    // run combat draws no outcome card by design — the road owns it — so the
    // only thing between a won fight and a dead board was one setTimeout. This
    // simulates exactly that failure (the hand-off is consumed and the road
    // never moves) and asserts the player is still given a door.
    const deadend = await J(async () => {
      window.K.startCombat({ seed: 7, onEnd: () => {} });   // a run-shaped fight
      const stage = document.getElementById('k-stage');
      stage.classList.remove('k-hidden');
      // pretend a run is live, and that its hand-off did nothing at all
      const realActive = window.R && window.R.active;
      if (window.R) window.R.active = () => true;
      window.K.state().boss.hp = 0;
      window.K.render();                                    // the net fires VICTORY
      const duringHandoff = document.getElementById('k-overlay').className;
      // WAIT FOR THE DOOR, not for a number. This was `1800` — "past 620ms +
      // the repaint" — and the moment the win got a death beat the hand-off
      // moved to 1750ms and the fixed wait was measuring the wrong instant.
      for (let i = 0; i < 60; i++) {
        if (document.getElementById('k-ov-go')) break;
        await new Promise(r => setTimeout(r, 80));
      }
      const ov = document.getElementById('k-overlay');
      const out = { phase: window.K.state().phase, duringHandoff,
                    after: ov.className, hasDoor: !!document.getElementById('k-ov-go'),
                    title: (ov.querySelector('.k-ov-title') || {}).textContent };
      if (window.R) window.R.active = realActive;
      return out;
    });
    check('END: a finished fight the road never collects still gives the player a door',
      deadend.phase === 'VICTORY'
      && /k-hidden/.test(deadend.duringHandoff)          // silent while the road may still come
      && !/k-hidden/.test(deadend.after) && deadend.hasDoor,
      JSON.stringify(deadend));

    // ── THE WAY BACK OUT OF A DRAG ──────────────────────────────────────
    // The snap takes the NEAREST legal target within 210px, and the hand sits
    // well inside 210px of every hero — so bringing a card back down and
    // letting go of it played the card. There was no gesture anywhere on the
    // board that meant "no": once you picked a card up you were committed.
    await fresh(7);
    {
      const back = await J(async () => {
        window.K.forceHand(['cleave', 'mend', 'serrate', 'frostbind', 'execute']);
        const card = document.querySelector('#k-hand .k-card[data-card="cleave"]');
        const r = card.getBoundingClientRect();
        const x0 = r.left + r.width / 2, y0 = r.top + r.height / 2;
        const at = (t, x, y) => card.dispatchEvent(new PointerEvent(t, {
          bubbles: true, clientX: x, clientY: y, pointerId: 1 }));
        const hand = document.getElementById('k-hand');
        const before = window.K.state().hand.length, ap = window.K.state().ap;
        at('pointerdown', x0, y0);
        // out over the board…
        for (let i = 1; i <= 8; i++) at('pointermove', x0 + i * 40, y0 - i * 22);
        const outHint = hand.classList.contains('k-hand-cancel');
        const armed = card.classList.contains('k-aiming');
        // …then all the way home again
        for (let i = 8; i >= 0; i--) at('pointermove', x0 + i * 40, y0 - i * 22);
        const homeHint = hand.classList.contains('k-hand-cancel');
        at('pointerup', x0, y0);
        await new Promise(res => setTimeout(res, 200));
        return { armed, outHint, homeHint,
                 kept: window.K.state().hand.length === before && window.K.state().ap === ay(ap),
                 hand: window.K.state().hand.length, ap: window.K.state().ap,
                 apWas: ap, lifted: [...document.querySelectorAll('#k-hand .k-card')]
                   .some(c => c.classList.contains('k-aiming') || c.style.getPropertyValue('--dragx')),
                 hint: hand.classList.contains('k-hand-cancel') };
        function ay(v) { return v; }
      });
      check('DRAG: releasing a card back over the hand puts it back — it never plays',
        back.armed && !back.outHint && back.homeHint
        && back.hand === 5 && back.ap === back.apWas && !back.lifted && !back.hint,
        JSON.stringify(back));
    }

    // THE DECK RUNNING OUT IS AN EVENT. It used to happen between frames: the
    // discard count dropped to zero and the draw count jumped, with no moment
    // on screen, so a player never saw their pile come back.
    const shuffled = await J(async () => {
      window.K.startCombat({ seed: 7 });
      const s = window.K.state();
      s.discard = s.discard.concat(s.deck); s.deck = [];        // next draw must reshuffle
      let flew = 0;
      const watch = setInterval(() => {
        flew = Math.max(flew, document.querySelectorAll('.k-fly').length); }, 25);
      await window.K.endTurn({ grades: new Array(24).fill('miss') });
      clearInterval(watch);
      const a = window.K.state();
      return { reshuffles: a.reshuffles || 0, deck: a.deck.length,
               disc: a.discard.length, hand: a.hand.length, flew };
    });
    check('DECK: running out shuffles the discard back, and it is SEEN doing it',
      shuffled.reshuffles === 1 && shuffled.deck > 0 && shuffled.hand === 5
      && shuffled.flew >= 3,
      JSON.stringify(shuffled));

    // THE ALL-OUT HAS TO BE REACHABLE AND PRESSABLE. Both paths into it worked
    // and a player still called it broken: it almost never charged, and when it
    // did the only change was a glow behind a 15px strip with a noun on it.
    const kz = await J(async () => {
      window.K.startCombat({ seed: 7 });
      window.K.state().kizuna = 100;
      window.K.render();
      const bar = document.getElementById('k-kizuna');
      const hp0 = window.K.state().boss.hp;
      const r = bar.getBoundingClientRect();
      const cs = getComputedStyle(bar, '::before');
      // READ THE LIVE STATE BEFORE PRESSING IT. Taken afterwards these report
      // the bar correctly disabled again — the meter is spent — which looks
      // exactly like the bar never having been pressable at all.
      const live = { disabled: bar.disabled, ready: bar.classList.contains('k-kz-ready'),
                     grew: parseFloat(cs.width) > r.width,   // the press reaches past the paint
                     label: document.getElementById('k-kz-n').textContent };
      bar.click();
      await new Promise(res => setTimeout(res, 1600));
      return { ...live, hp0, hp: window.K.state().boss.hp, kz: window.K.state().kizuna,
               offAfter: bar.disabled };
    });
    check('ALL-OUT: at full it is live, reads as a press, and actually strikes',
      kz.ready && !kz.disabled && /\u25B8/.test(kz.label) && kz.grew
      && kz.hp < kz.hp0 && kz.kz === 0,
      JSON.stringify(kz));
    // …and hand the suite back the board it expects. Three later checks read a
    // fresh fight, and this block leaves one that has been played out.
    await fresh(7);

    // the iOS long-press callout must be suppressed on cards
    const ios = await J(async () => {
      // EVERY figure on the board, not just the cards. A long press on a hero
      // or on the Regent raised Copy / Save Image because the guards only ever
      // lived on .k-card, and all of those are <img> elements.
      const targets = ['#k-hand .k-card', '.k-hero[data-hero="ash"] img',
                       '#k-boss-art img', '#k-bg'];
      const out = { prevented: 0, sel: 0, n: targets.length, missing: [] };
      for (const sel of targets) {
        const node = document.querySelector(sel);
        if (!node) { out.missing.push(sel); continue; }
        const cs = getComputedStyle(node);
        if (!node.dispatchEvent(new Event('contextmenu', { bubbles: true, cancelable: true })))
          out.prevented++;
        if ((cs.userSelect || cs.webkitUserSelect) === 'none') out.sel++;
      }
      // Chromium does not implement -webkit-touch-callout, so assert the
      // declaration ships in the stylesheet rather than reading it back — and
      // that it ships on the WHOLE stage, not one component.
      const css = await (await fetch('styles.css')).text();
      const i = css.indexOf('#k-stage, #k-stage * {');
      const rule = i < 0 ? '' : css.slice(i, i + 260);
      out.calloutShipped = /-webkit-touch-callout:\s*none/.test(rule);
      out.highlightShipped = /-webkit-tap-highlight-color:\s*transparent/.test(rule);
      out.noDrag = /#k-stage img\s*\{[^}]*-webkit-user-drag:\s*none/.test(css);
      out.touch = getComputedStyle(document.getElementById('k-stage')).touchAction;
      return out;
    });
    check('LONG PRESS: no iOS callout on ANY figure — cards, heroes, the Regent, the plate',
      ios.missing.length === 0 && ios.prevented === ios.n && ios.sel === ios.n
      && ios.calloutShipped && ios.highlightShipped && ios.noDrag && ios.touch === 'none',
      JSON.stringify(ios));
  }

  // ═══ Z · THE HAND DOES NOT PLAY ITSELF ═══
  // Parked LAST on purpose: it dispatches real pointer events at the fan, and
  // run early it left the page mid-gesture in a way that cost three later
  // checks their drag. An input test that fakes a finger belongs where it
  // cannot poison anything downstream of it.
  {
    const runaway = await J(async () => {
      window.K.startCombat({ seed: 7 });
      window.K.forceHand(['cleave', 'guardcut', 'lcascade', 'serrate', 'frostbind']);
      const hand = document.getElementById('k-hand');
      const first = hand.querySelector('.k-card');
      const r = first.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const ap0 = window.K.state().ap;
      // one finger, one fixed spot, four taps — an idle thumb
      for (let i = 0; i < 4; i++) {
        const el2 = document.elementFromPoint(x, y);
        const card = el2 && el2.closest ? el2.closest('.k-card') : null;
        if (card) {
          card.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y, bubbles: true, pointerId: 9 }));
          card.dispatchEvent(new PointerEvent('pointerup', { clientX: x, clientY: y, bubbles: true, pointerId: 9 }));
        }
        await new Promise(res => setTimeout(res, 40));
      }
      return { spent: ap0 - window.K.state().ap, ap0 };
    });
    // Tapping one spot four times used to play two cards — two thirds of the
    // turn — without the player ever choosing a card or a target, because the
    // fan closes ranks and the next card slides under a finger that has not
    // moved.
    check('HAND: an idle finger on one spot cannot spend the turn by itself',
      runaway.spent <= 1, JSON.stringify(runaway));
    // this block drives real pointer events; hand the page back clean
    await J(() => { window.K.startCombat({ seed: 7 }); });
  }


  // ── THE PAINTED IDLE (Build 50) ─────────────────────────────────────────────
  // The Regent's idle is six real frames cut out of a generated clip, stepped
  // across one strip. Every check here asks for a PROPERTY, never for presence:
  // a layer that exists but never advances, or advances while the plate is still
  // showing through underneath, would satisfy "is the sheet wired up?" and still
  // be broken on screen.
  {
    await J(() => { window.K.startCombat({ seed: 7 }); });
    await H.sleep(900);
    const on = await J(() => {
      const box = document.getElementById('k-boss-art');
      const l = box && box.querySelector('.k-fanim');
      const img = box && box.querySelector('img');
      const fig = box && box.querySelector('.k-fig');
      const cs = l && getComputedStyle(l);
      const br = box && box.getBoundingClientRect();
      const lr = l && l.getBoundingClientRect();
      return {
        armed: !!(box && box.classList.contains('k-has-anim')),
        shown: cs && cs.display,
        grid: cs && cs.backgroundSize,
        plate: img && getComputedStyle(img).display,
        figIdle: fig && getComputedStyle(fig).animationName,
        w: lr && lr.width, h: lr && lr.height, boxW: br && br.width,
        // MEASURED IN LAYOUT SPACE, NOT ON SCREEN. The Regent stands inside the
        // field's perspective volume, so a client rect is a PROJECTED rect — and
        // the projection is not uniform: at this position the box measures 0.996x
        // across and 1.024x down, and the layer, sitting lower in the frustum,
        // 0.990x and 1.041x. Comparing two projected numbers taken at different
        // heights says nothing about whether they are the same size. offsetHeight
        // is the layout box, which is what the sizing maths actually controls.
        lay: l && l.offsetHeight,
        gap: l && (box.clientHeight - (l.offsetTop + l.offsetHeight)),
        plateH: img && img.naturalWidth
          ? Math.min(box.clientHeight, box.clientWidth * img.naturalHeight / img.naturalWidth)
          : null,
        sheet: window.K.FOE_SHEETS.mourner,
      };
    });
    check('FOE ANIM: the Regent wears her sheet, and it is really on screen',
      on.armed === true && on.shown === 'block' && on.w > 100 && on.h > 60,
      JSON.stringify(on));
    // ONE FOE, ONE FIGURE. The sheet REPLACES the plate; if the plate were still
    // painted underneath, the two would show as a doubled, ghosting Regent.
    check('FOE ANIM: the painted plate steps aside rather than showing through',
      on.plate === 'none', JSON.stringify({ plate: on.plate }));
    // …and the CSS breathe goes quiet, because the frames ARE the breathing.
    // This one is here because the first version lost it: the per-foe idles are
    // declared far below at equal specificity, and source order handed them the
    // win, so the Regent was being animated twice.
    check('FOE ANIM: the CSS idle underneath is switched off, not left doubling up',
      on.figIdle === 'none', JSON.stringify({ figIdle: on.figIdle }));
    // THE RULE MOVED IN BUILD 51, and this check moved with it. It used to ask
    // that the layer be the width of the box, which was right while the sheet
    // held one state: the cell was the idle and nothing else. Now the cell also
    // has to hold the acts, which reach further, and each foe's clip framed it
    // differently — so a box-width layer renders a visibly smaller creature, by
    // a different amount per foe. The layer is sized by the FIGURE now, so what
    // is asked here is the thing that actually matters: the creature inside the
    // cell stands as tall as the painting it replaced, and on the same line.
    const figLaidOut = on.lay * on.sheet.figH / on.sheet.cellH;
    check('FOE ANIM: the creature stands at the plate\'s size, on the plate\'s ground line',
      on.plateH > 0 && Math.abs(figLaidOut - on.plateH) < 3 && Math.abs(on.gap - 8) <= 1,
      JSON.stringify({ figure: +figLaidOut.toFixed(1), plate: +on.plateH.toFixed(1),
                       layerH: on.lay, groundGap: on.gap }));

    // IT MOVES. A still layer showing frame 0 forever passes every check above.
    const moved = await J(async () => {
      const l = document.querySelector('.k-fanim');
      const seen = new Set();
      for (let i = 0; i < 14; i++) {
        seen.add(l.style.backgroundPositionX);
        await new Promise(r => setTimeout(r, 90));
      }
      return { frames: [...seen], n: seen.size };
    });
    check('FOE ANIM: the frames actually advance — it is animation, not one still',
      moved.n >= 4, JSON.stringify(moved));
    // BOUNCE, NOT WRAP. Six frames of drift do not close into a ring, so a wrap
    // snaps the robes back across the whole excursion. Played out and back, the
    // walk returns through the middle instead of jumping the ends.
    const bounce = await J(async () => {
      const l = document.querySelector('.k-fanim');
      const seq = [];
      for (let i = 0; i < 26; i++) {
        const v = parseFloat(l.style.backgroundPositionX) || 0;
        if (!seq.length || seq[seq.length - 1] !== v) seq.push(v);
        await new Promise(r => setTimeout(r, 70));
      }
      let jump = 0;
      for (let i = 1; i < seq.length; i++) jump = Math.max(jump, Math.abs(seq[i] - seq[i - 1]));
      return { seq, jump };
    });
    check('FOE ANIM: the loop bounces back through its frames, never snapping end to end',
      bounce.seq.length >= 4 && bounce.jump <= 21,
      JSON.stringify(bounce));

    // THE DEGRADATION CONTRACT. In Build 50 this was checked by switching to a
    // foe that had no entry at all — but every foe has a sheet now, so the only
    // way left to reach the path is the one that still matters in the wild: an
    // entry whose FILE does not load. Naming a foe changes NOTHING until its
    // sheet really arrives; a missing or broken file leaves the painted plate
    // up rather than an empty box, which is what lets art land one foe at a
    // time and what protects a build against a bad deploy.
    const bare = await J(async () => {
      const real = window.K.FOE_SHEETS.husk.file;
      window.K.FOE_SHEETS.husk.file = 'foe-husk-anim-THIS-DOES-NOT-EXIST.webp';
      window.K.startCombat({ seed: 7, foe: window.K.FOES.husk });
      await new Promise(r => setTimeout(r, 800));
      const box = document.getElementById('k-boss-art');
      const img = box.querySelector('img');
      const out = { armed: box.classList.contains('k-has-anim'),
                    layer: !!box.querySelector('.k-fanim'),
                    plate: getComputedStyle(img).display,
                    src: (img.getAttribute('src') || '') };
      window.K.FOE_SHEETS.husk.file = real;
      return out;
    });
    check('FOE ANIM: a sheet that fails to load leaves the painted plate standing',
      bare.armed === false && bare.layer === false && bare.plate !== 'none'
      && /foe-husk/.test(bare.src), JSON.stringify(bare));

    // EVERY FOE, not just the one that was piloted. A sheet that loads for the
    // Regent and quietly fails for the other four would pass every check above.
    const all = await J(async () => {
      const out = {};
      for (const id of ['husk', 'cultist', 'wraith', 'revenant', 'mourner']) {
        window.K.startCombat({ seed: 7, foe: window.K.FOES[id] });
        await new Promise(r => setTimeout(r, 700));
        const box = document.getElementById('k-boss-art');
        const l = box.querySelector('.k-fanim');
        out[id] = !!(box.classList.contains('k-has-anim') && l
                     && getComputedStyle(l).display === 'block'
                     && l.getBoundingClientRect().height > 60
                     && l.style.backgroundImage.indexOf('foe-' + id + '-anim') >= 0);
      }
      return out;
    });
    check('FOE ANIM: all five foes wear their own sheet, each the right one',
      Object.values(all).every(Boolean), JSON.stringify(all));

    // THE ACTS DRIVE THE FRAMES. The Regent's sheet carries a wind-up and four
    // acts beyond the idle, and the whole point is that the intent picks them —
    // a sheet stuck on its idle while the CSS pose does all the work would look
    // exactly like Build 50 and pass everything written for it.
    const acts = await J(async () => {
      window.K.startCombat({ seed: 7 });
      await new Promise(r => setTimeout(r, 700));
      const l = document.querySelector('.k-fanim');
      const sh = window.K.FOE_SHEETS.mourner;
      const frameNow = () => {
        const x = parseFloat(l.style.backgroundPositionX) || 0;
        const y = parseFloat(l.style.backgroundPositionY) || 0;
        return Math.round(x / 100 * (sh.cols - 1)) + Math.round(y / 100 * (sh.rows - 1)) * sh.cols;
      };
      const seen = {};
      // drive the real hooks the fight drives, one intent at a time
      const idle = frameNow();
      window.K._fxFoeWind();
      await new Promise(r => setTimeout(r, 60));
      seen.wind = frameNow();
      for (const [intent, state] of [['hymn', 'toll'], ['scythe', 'sweep'],
                                     ['rain', 'rain'], ['dirgesong', 'gather']]) {
        window.K._fxFoeAct(intent);
        await new Promise(r => setTimeout(r, 60));
        seen[state] = frameNow();
      }
      window.K._fxFoeSettle();
      await new Promise(r => setTimeout(r, 60));
      seen.settled = frameNow();
      return { idle, seen, sheet: sh.states };
    });
    const inState = (f, st) => acts.sheet[st].indexOf(f) >= 0;
    check('FOE ANIM: the wind-up and all four acts each pull their own frames',
      inState(acts.seen.wind, 'wind') && inState(acts.seen.toll, 'toll')
      && inState(acts.seen.sweep, 'sweep') && inState(acts.seen.rain, 'rain')
      && inState(acts.seen.gather, 'gather'),
      JSON.stringify(acts.seen));
    // …and the foe comes back to rest when the turn does, rather than holding
    // its last swing for the remainder of the fight.
    check('FOE ANIM: settling drops the foe back onto its idle frames',
      inState(acts.seen.settled, 'idle'), JSON.stringify({ settled: acts.seen.settled }));

    // …and coming back to the Regent re-arms it, rather than leaving the last
    // encounter's layer behind or stacking a second one on top. TWO FIGHTS IN
    // ONE FRAME is the case that caught the real bug: both arms fire a probe,
    // a cached sheet resolves both, and each mounted its own layer while the
    // teardown retired only the first — so switching to a sheetless foe left an
    // orphan behind, holding its own clock, one class away from a doubled foe.
    const back = await J(async () => {
      window.K.startCombat({ seed: 7 });
      window.K.startCombat({ seed: 7 });
      await new Promise(r => setTimeout(r, 700));
      const box = document.getElementById('k-boss-art');
      const layers = box.querySelectorAll('.k-fanim').length;
      // and it survives being handed off to a foe with no sheet at all
      window.K.startCombat({ seed: 7, foe: window.K.FOES.husk });
      await new Promise(r => setTimeout(r, 800));
      return { layers, armed: box.classList.contains('k-has-anim'),
               orphans: box.querySelectorAll('.k-fanim').length };
    });
    // The Husk has a sheet of its own now, so handing off no longer means going
    // bare — but the thing being guarded is unchanged: ONE layer, never two.
    check('FOE ANIM: two fights in one frame still leave exactly one layer, and no orphan',
      back.layers === 1 && back.orphans === 1 && back.armed === true,
      JSON.stringify(back));

    // EVERY FOE'S OWN ACTS. Each of the five carries only the states its intent
    // list can actually ask for — the Husk has no rain, the Wraith no toll — so
    // this walks each foe's real intents through the real hook and asks that the
    // frames it landed on belong to the state that intent maps to. A sheet with
    // an act missing, or a mapping pointing at the wrong block, reads on screen
    // as a foe that goes oddly still at the exact moment it should swing.
    const everyAct = await J(async () => {
      // RESTATED ON PURPOSE, not read out of FOE_ACT. Deriving it from the
      // table under test would only prove the lookup works; written out, it
      // also pins the design decision — a crescendo is a RAIN, not a toll,
      // which is exactly the entry this check first got wrong.
      // …and it is restated for the CURRENT design, which changed: the opening
      // posture is the first BLOW's act rather than a per-intent label, so the
      // Rising Dirge — which opens on two thrusts — stands in the toll shape
      // and not the rain one. That is the entry this check caught, and it was
      // right to: a foe that opens in a posture it is not about to throw is
      // the mismatch this whole build exists to remove.
      // …AND IT IS DERIVED, NOT RESTATED. This was a hand-written table of nine
      // intents mapped to nine poses, which is a copy of a rule that lives in
      // `fxFoeAct` — so it went stale the moment Build 94 added two intents to
      // the bestiary, and the failure it reported ("lash:no-undefined") was the
      // check being out of date rather than the game being wrong. It now asks
      // the same two tables the game asks: the intent's FIRST act, and that
      // act's pose. A new intent is covered the day it is authored.
      const ACTS = window.K.ACTS, INTENTS = window.K.INTENTS();
      const poseOf = (iid) => {
        const it = INTENTS.find(x => x.id === iid);
        const spec = it && it.hits[0] && it.hits[0].acts && it.hits[0].acts[0];
        const def = spec && ACTS[String(spec).split(':')[0]];
        return def ? def.pose.replace('k-foe-', '') : null;
      };
      const map = INTENTS.reduce((a, it) => { a[it.id] = poseOf(it.id); return a; }, {});
      const out = {};
      for (const id of ['husk', 'cultist', 'wraith', 'revenant', 'mourner']) {
        window.K.startCombat({ seed: 7, foe: window.K.FOES[id] });
        await new Promise(r => setTimeout(r, 700));
        const l = document.querySelector('.k-fanim');
        const sh = window.K.FOE_SHEETS[id];
        const frameNow = () => {
          const x = parseFloat(l.style.backgroundPositionX) || 0;
          const y = parseFloat(l.style.backgroundPositionY) || 0;
          return Math.round(x / 100 * (sh.cols - 1))
               + Math.round(y / 100 * (sh.rows - 1)) * sh.cols;
        };
        const bad = [];
        for (const intent of window.K.FOES[id].intents) {
          const want = map[intent];
          window.K._fxFoeAct(intent);
          await new Promise(r => setTimeout(r, 60));
          if (!sh.states[want]) { bad.push(intent + ':no-' + want); continue; }
          if (sh.states[want].indexOf(frameNow()) < 0) bad.push(intent + ':wrong');
        }
        out[id] = bad;
      }
      return out;
    });
    check('FOE ANIM: every foe pulls its own frames for every intent it can throw',
      Object.values(everyAct).every(v => v.length === 0), JSON.stringify(everyAct));

    // REACTIONS INTERRUPT, AND GIVE THE STATE BACK. Being hit does not change
    // what a foe is DOING — it was coiled before the blow and is still coiled
    // after — so a reaction that dumped the creature onto its idle would undo
    // the wind-up in the middle of a volley, and the telegraph would vanish at
    // the moment it matters most.
    const react = await J(async () => {
      window.K.startCombat({ seed: 7 });
      await new Promise(r => setTimeout(r, 700));
      const l = document.querySelector('.k-fanim');
      const sh = window.K.FOE_SHEETS.mourner;
      const frameNow = () => {
        const x = parseFloat(l.style.backgroundPositionX) || 0;
        const y = parseFloat(l.style.backgroundPositionY) || 0;
        return Math.round(x / 100 * (sh.cols - 1))
             + Math.round(y / 100 * (sh.rows - 1)) * sh.cols;
      };
      window.K._fxFoeAct('scythe');                 // it is mid wind-up
      await new Promise(r => setTimeout(r, 60));
      const acting = frameNow();
      window.K._fxStrikeBoss(9, 'hit');             // and it takes a blow
      await new Promise(r => setTimeout(r, 80));
      const struck = frameNow();
      await new Promise(r => setTimeout(r, 420));   // past the 340ms window
      const after = frameNow();
      // and a break reels for its own, longer window
      window.K._fxInterrupt();
      await new Promise(r => setTimeout(r, 120));
      const broke = frameNow();
      await new Promise(r => setTimeout(r, 900));
      const settled = frameNow();
      return { acting, struck, after, broke, settled, st: sh.states };
    });
    const inS = (f, st) => react.st[st].indexOf(f) >= 0;
    check('FOE ANIM: a blow lands on struck frames, not on a shake alone',
      inS(react.acting, 'sweep') && inS(react.struck, 'hit'),
      JSON.stringify({ acting: react.acting, struck: react.struck }));
    check('FOE ANIM: and the foe goes back to the act it was interrupted mid-way through',
      inS(react.after, 'sweep'),
      JSON.stringify({ after: react.after, wanted: react.st.sweep }));
    check('FOE ANIM: a break reels on its own frames, then hands the act back',
      inS(react.broke, 'broken') && inS(react.settled, 'sweep'),
      JSON.stringify({ broke: react.broke, settled: react.settled }));

    // leave the page on a clean Regent fight for whatever runs after this block
    await J(() => { window.K.startCombat({ seed: 7 }); });
    await H.sleep(400);
  }


  // ── TAP TO AIM (Build 54) ───────────────────────────────────────────────────
  // Tapping a card used to raise a spinning dashed circle over the party HUD.
  // It said nothing about who the card could reach, it sat on the PORTRAITS
  // rather than on the people, and its shape belonged to no other part of this
  // interface. Tap now casts the drag path's own arcs onto the figures.
  {
    await J(() => { window.K.startCombat({ seed: 7 }); });
    await H.sleep(600);
    const enemyPick = await J(() => {
      // an enemy card: one target, and it is the foe
      const ids = window.K.state().hand.slice();
      const eid = ids.filter(i => window.K.cardDef(i).target === 'enemy')[0];
      const btn = document.querySelector('.k-card[data-card="' + eid + '"]');
      btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 3,
        clientX: btn.getBoundingClientRect().left + 10, clientY: btn.getBoundingClientRect().top + 10 }));
      btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 3,
        clientX: btn.getBoundingClientRect().left + 10, clientY: btn.getBoundingClientRect().top + 10 }));
      const svg = document.getElementById('k-pick');
      const lit = [...document.querySelectorAll('.k-pick-valid')].map(n => n.id || n.dataset.hero);
      return { card: eid, ring: !!document.getElementById('k-target-ring'),
               arcs: svg ? svg.querySelectorAll('.k-pk-dash').length : 0,
               rets: svg ? svg.querySelectorAll('.k-pk-ret').length : 0, lit };
    });
    // THE RING IS GONE, not merely hidden — the shape itself was the problem.
    check('AIM: the spinning target ring is retired outright',
      enemyPick.ring === false, JSON.stringify({ stillInDom: enemyPick.ring }));
    check('AIM: tapping an enemy card draws one dotted arc, onto the foe',
      enemyPick.arcs === 1 && enemyPick.rets === 1
      && enemyPick.lit.join() === 'k-boss-art', JSON.stringify(enemyPick));

    // …and a card that tends the party draws one arc PER LIVING ALLY, onto the
    // characters standing in the scene rather than onto the HUD portraits.
    const allyPick = await J(async () => {
      // the hand rebuilds with a flight, so the element is not there on the
      // same tick the state changes — wait for the card rather than assume it
      const waitFor = async (sel) => {
        for (let i = 0; i < 60; i++) {
          const n = document.querySelector(sel);
          if (n) return n;
          await new Promise(r => setTimeout(r, 25));
        }
        return null;
      };
      window.K.startCombat({ seed: 7 });
      const s0 = window.K.state();
      s0.heroes.elin.hp = 12; s0.heroes.ash.hp = 40; s0.heroes.mira.hp = 33;
      window.K.forceHand(['mend', 'cleave', 'serrate', 'guardcut', 'lcascade']);
      const btn = await waitFor('.k-card[data-card="mend"]');
      const r = btn.getBoundingClientRect();
      btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 4,
        clientX: r.left + 10, clientY: r.top + 10 }));
      btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 4,
        clientX: r.left + 10, clientY: r.top + 10 }));
      const svg = document.getElementById('k-pick');
      const lit = [...document.querySelectorAll('.k-pick-valid')];
      const hud = document.getElementById('k-party-hud');
      return { arcs: svg ? svg.querySelectorAll('.k-pk-dash').length : 0,
               heroes: lit.map(n => n.dataset.hero).filter(Boolean).sort(),
               onHud: lit.some(n => n === hud || hud.contains(n)),
               allHero: lit.every(n => n.classList.contains('k-hero')) };
    });
    // THE RULE MOVED, AND THIS CHECK MOVED WITH IT. It first asked that any
    // non-enemy card reach all three, and that was wrong in a way worth keeping
    // written down: `mend` has no ally argument, it finds the most wounded by
    // itself, so three arcs promised a pick the rules do not offer — and the
    // next check proved it by healing the wrong hero. A party card now draws
    // arcs to whoever it will ACTUALLY reach. Elin is the most hurt here, so
    // Mend has exactly one answer and it is her.
    check('AIM: a party card points only where its own rule will send it',
      allyPick.arcs === 1 && allyPick.heroes.join() === 'elin',
      JSON.stringify(allyPick));
    check('AIM: it lights the CHARACTERS on the field, never the HUD portraits',
      allyPick.allHero === true && allyPick.onHud === false, JSON.stringify(allyPick));

    // THE ARC MOVES. A static dotted line is a diagram; the travelling dash is
    // what reads as a thing being thrown.
    const moving = await J(async () => {
      const d = document.querySelector('#k-pick .k-pk-dash');
      const a = d.getAttribute('stroke-dashoffset');
      await new Promise(r => setTimeout(r, 180));
      return { a, b: d.getAttribute('stroke-dashoffset') };
    });
    check('AIM: the dashes travel along the arc rather than sitting still',
      moving.a !== moving.b, JSON.stringify(moving));

    // AND THE RETICLE IS THE BUTTON — pressing the one over ELIN heals ELIN,
    // which is the thing a single ring pinned to the HUD could never express.
    const aimed = await J(async () => {
      const waitFor = async (sel) => {
        for (let i = 0; i < 60; i++) {
          const n = document.querySelector(sel);
          if (n) return n;
          await new Promise(r => setTimeout(r, 25));
        }
        return null;
      };
      window.K.startCombat({ seed: 7 });
      // DROP ANY STANDING SELECTION FIRST. The previous check left `mend`
      // selected, and tapping an already-selected card COMMITS it — so the tap
      // below played the card instead of opening a pick, and there was no
      // reticle to press. A tap on bare stage is how a player clears one.
      document.getElementById('k-stage')
        .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 91 }));
      window.K.forceHand(['mend', 'cleave', 'serrate', 'guardcut', 'lcascade']);
      const st = window.K.state();
      st.heroes.elin.hp = 12; st.heroes.ash.hp = 40; st.heroes.mira.hp = 33;
      const btn = await waitFor('.k-card[data-card="mend"]');
      if (!btn) return { err: 'no mend card in hand' };
      const r = btn.getBoundingClientRect();
      btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 5,
        clientX: r.left + 10, clientY: r.top + 10 }));
      btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 5,
        clientX: r.left + 10, clientY: r.top + 10 }));
      const rets = [...document.querySelectorAll('#k-pick .k-pk-ret')];
      const elinFig = document.querySelector('.k-hero[data-hero="elin"]');
      const er = elinFig.getBoundingClientRect();
      const ex = er.left + er.width / 2;
      // the reticle nearest Elin is the one drawn on her
      let best = null, bd = 1e9;
      for (const g of rets) {
        const gr = g.getBoundingClientRect();
        const d = Math.abs(gr.left + gr.width / 2 - ex);
        if (d < bd) { bd = d; best = g; }
      }
      if (!best) return { err: 'no reticles were drawn', rets: rets.length };
      best.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 6 }));
      await new Promise(r => setTimeout(r, 260));
      const s2 = window.K.state();
      return { elin: s2.heroes.elin.hp, ash: s2.heroes.ash.hp, mira: s2.heroes.mira.hp,
               gone: !document.querySelector('#k-pick .k-pk-ret') };
    });
    check('AIM: the arc lands the card where it said it would',
      aimed.elin > 12 && aimed.ash === 40 && aimed.mira === 33, JSON.stringify(aimed));
    check('AIM: committing clears the arcs behind it',
      aimed.gone === true, JSON.stringify({ gone: aimed.gone }));

    // AN 'ALLY' CARD IS THE ONE REAL CHOICE, and there the pick must be honoured.
    const chose = await J(async () => {
      const waitFor = async (sel) => {
        for (let i = 0; i < 60; i++) {
          const n = document.querySelector(sel);
          if (n) return n;
          await new Promise(r => setTimeout(r, 25));
        }
        return null;
      };
      window.K.startCombat({ seed: 7 });
      document.getElementById('k-stage')
        .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 92 }));
      window.K.forceHand(['intercession', 'cleave', 'serrate', 'guardcut', 'lcascade']);
      const btn = await waitFor('.k-card[data-card="intercession"]');
      if (!btn) return { err: 'no intercession in hand' };
      const r = btn.getBoundingClientRect();
      btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7,
        clientX: r.left + 10, clientY: r.top + 10 }));
      btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7,
        clientX: r.left + 10, clientY: r.top + 10 }));
      const rets = [...document.querySelectorAll('#k-pick .k-pk-ret')];
      const n = rets.length;
      const mira = document.querySelector('.k-hero[data-hero="mira"]');
      const mx = mira.getBoundingClientRect();
      const cx = mx.left + mx.width / 2;
      let best = null, bd = 1e9;
      for (const g of rets) {
        const gr = g.getBoundingClientRect();
        const d = Math.abs(gr.left + gr.width / 2 - cx);
        if (d < bd) { bd = d; best = g; }
      }
      if (!best) return { err: 'no reticles', n };
      best.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 8 }));
      await new Promise(r => setTimeout(r, 260));
      const s2 = window.K.state();
      return { n, guard: { ash: s2.heroes.ash.guard, elin: s2.heroes.elin.guard,
                           mira: s2.heroes.mira.guard } };
    });
    check('AIM: an ALLY card offers every living ally, and wards the one chosen',
      chose.n === 3 && chose.guard && chose.guard.mira > 0, JSON.stringify(chose));

    await J(() => { window.K.startCombat({ seed: 7 }); });
    await H.sleep(300);
  }


  // ── COMBAT AUDIO (Build 55) ────────────────────────────────────────────────
  // There was no combat sound at all: a volley resolved in silence, and a parry
  // — a rhythm mechanic — gave the ear nothing to time against. These checks
  // record which VOICE each moment reaches for, by standing in front of the one
  // function every sound passes through. The bug they exist to catch is a
  // mistyped voice name, which fails completely silently and looks like nothing.
  {
    await J(() => { window.K.startCombat({ seed: 7 }); });
    await H.sleep(500);
    const named = await J(() => {
      const v = window.K.SFX._state().voices;
      return { voices: v, has: ['slash','heavy','cast','hurt','guard','perfect','great',
                                'good','late','miss','brk','allout','heal']
        .filter(n => v.indexOf(n) < 0) };
    });
    check('SFX: every voice the fight asks for actually exists',
      named.has.length === 0, JSON.stringify(named));

    // THE PARRY LADDER, heard in the order it is scored. Four grades that have
    // to be distinguishable with the eyes shut, so each one must reach its own
    // voice and never fall through to a neighbour's.
    const ladder = await J(async () => {
      const heard = [];
      const real = window.K.SFX.play;
      window.K.SFX.play = (n, k) => { heard.push(n); return true; };
      for (const g of ['perfect', 'great', 'good', 'late', 'miss']) {
        window.K._fxNoteGrade(g, 'tap');
        await new Promise(r => setTimeout(r, 60));
      }
      window.K.SFX.play = real;
      return heard;
    });
    check('SFX: each parry grade reaches its own voice, none falling through',
      ladder.join() === 'perfect,great,good,late,miss', JSON.stringify(ladder));

    // WHAT THREW THE BLOW is what it sounds like — the same rule the visual
    // effect follows. Steel scrapes, a spell blooms.
    const blows = await J(async () => {
      const heard = [];
      const real = window.K.SFX.play;
      window.K.SFX.play = (n, k) => { heard.push({ n, k: Math.round(k * 100) / 100 }); return true; };
      window.K.startCombat({ seed: 7 });
      window.K.forceHand(['cleave', 'lcascade', 'serrate', 'guardcut', 'mend']);
      await new Promise(r => setTimeout(r, 320));
      window.K.playCard('cleave');
      await new Promise(r => setTimeout(r, 700));
      const steel = heard.slice();
      heard.length = 0;
      window.K._fxHitResolved('ash', 9, false, false);
      await new Promise(r => setTimeout(r, 120));
      const took = heard.slice();
      heard.length = 0;
      window.K._fxHitResolved('ash', 0, true, true);
      await new Promise(r => setTimeout(r, 120));
      const warded = heard.slice();
      heard.length = 0;
      window.K._fxInterrupt();
      await new Promise(r => setTimeout(r, 120));
      const broke = heard.slice();
      window.K.SFX.play = real;
      return { steel: steel.map(x => x.n), took: took.map(x => x.n),
               warded: warded.map(x => x.n), broke: broke.map(x => x.n),
               steelK: steel.map(x => x.k) };
    });
    check('SFX: a blade landing on the foe is heard as steel',
      blows.steel.indexOf('slash') >= 0 || blows.steel.indexOf('heavy') >= 0,
      JSON.stringify(blows.steel));
    check('SFX: a hero taking it and a hero warding it are different sounds',
      blows.took.indexOf('hurt') >= 0 && blows.warded.indexOf('guard') >= 0
      && blows.took.indexOf('guard') < 0, JSON.stringify(blows));
    check('SFX: poise giving way has its own voice',
      blows.broke.indexOf('brk') >= 0, JSON.stringify(blows.broke));
    // …and the blow SCALES with the number, so a 4 and a 24 are not the same
    // sound at the same loudness
    check('SFX: the blow is scaled by how hard it landed',
      blows.steelK.length > 0 && blows.steelK.every(k => k > 0 && k <= 1.6),
      JSON.stringify(blows.steelK));

    // The repeat-thinning and the audio graph itself are checked in the MUSIC
    // suite, not here. A version of that check lived at this spot and passed
    // for entirely the wrong reason: audio is off under ?test=1, so every call
    // returned false and "at most two got through" was true of a system that
    // played nothing at all. It needs a page where the sound is really on.

    await J(() => { window.K.startCombat({ seed: 7 }); });
    await H.sleep(300);
  }


  // ── UI PASS (Build 56) ──────────────────────────────────────────────────────
  {
    await J(() => { window.K.startCombat({ seed: 7 }); });
    await H.sleep(500);
    const lay = await J(() => {
      const st = document.getElementById('k-stage');
      const box = (n) => { const r = n.getBoundingClientRect(); const s = st.getBoundingClientRect();
        const k = s.width / st.offsetWidth || 1;
        return { x: (r.left - s.left) / k, y: (r.top - s.top) / k,
                 w: r.width / k, h: r.height / k, b: (r.bottom - s.top) / k }; };
      const boss = box(document.getElementById('k-boss-hud'));
      const kz = box(document.getElementById('k-kizuna'));
      const party = box(document.getElementById('k-party-hud'));
      return { boss, kz, party, stageW: st.offsetWidth,
               inParty: document.getElementById('k-party-hud')
                 .contains(document.getElementById('k-kizuna')),
               plates: document.querySelectorAll('#k-boss-hud .k-foe-plate').length };
    });
    // THE FOE READOUT WAS 43% OF THE STAGE for a single opponent, in a game that
    // will have to show three. Held under a third of the width so the others fit.
    check('UI: the foe readout is under a third of the stage, not half of it',
      lay.boss.w / lay.stageW < 0.33, JSON.stringify({ w: Math.round(lay.boss.w),
        pct: Math.round(lay.boss.w / lay.stageW * 100) }));
    // …and it is ONE PLATE, so a second foe is another plate rather than another
    // layout. Everything about an opponent lives inside it.
    check('UI: a foe is a self-contained plate that a second one could stack under',
      lay.plates === 1, JSON.stringify({ plates: lay.plates }));
    // THE LADDER BELONGS TO THE PARTY. It floated in the sky between the two
    // HUDs — clear of everything, which was the requirement, and belonging to
    // nothing, which is why it read as awkward. It sits under the party now.
    check('UI: the kizuna ladder is docked with the party, not adrift mid-screen',
      lay.inParty === true && Math.abs(lay.kz.x - lay.party.x) < 1
      && lay.kz.w <= lay.party.w && lay.kz.w > lay.party.w * 0.7,
      JSON.stringify({ inParty: lay.inParty, kzX: Math.round(lay.kz.x),
                       partyX: Math.round(lay.party.x), kzW: Math.round(lay.kz.w),
                       partyW: Math.round(lay.party.w) }));

    // BREAKING TURNS THE GAUGE INTO THE WORD. A tag beside the name was a
    // footnote on the least-read line, with the empty pips still sitting there
    // saying nothing.
    const stag = await J(() => {
      const read = () => {
        const w = document.querySelector('#k-boss-hud .k-break-wrap');
        return { stag: w.classList.contains('k-is-stag'),
                 pips: getComputedStyle(document.getElementById('k-break')).display,
                 tag: getComputedStyle(w.querySelector('.k-brk-stag')).display,
                 flag: document.getElementById('k-bflag').textContent.trim() };
      };
      const s = window.K.state();
      s.boss.broken = false; window.K.render();
      const whole = read();
      s.boss.broken = true; window.K.render();
      const broken = read();
      s.boss.broken = false; window.K.render();
      return { whole, broken, back: read() };
    });
    check('UI: unbroken, the gauge is pips and there is no tag',
      stag.whole.pips !== 'none' && stag.whole.tag === 'none' && stag.whole.flag === '',
      JSON.stringify(stag.whole));
    check('UI: breaking replaces the whole gauge with STAGGERED, and drops the name tag',
      stag.broken.stag === true && stag.broken.pips === 'none'
      && stag.broken.tag !== 'none' && stag.broken.flag === '',
      JSON.stringify(stag.broken));
    check('UI: and recovering gives the gauge back',
      stag.back.pips !== 'none' && stag.back.tag === 'none', JSON.stringify(stag.back));

    await J(() => { window.K.startCombat({ seed: 7 }); });
    await H.sleep(300);
  }


  const summary = report();
  await H.browser.close();
  process.exit(summary.passed === summary.total && summary.errs === 0 ? 0 : 1);
})().catch(e => { console.error('SUITE CRASH:', e); process.exit(2); });
