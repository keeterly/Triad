// ============================================================================
// KIZUNA v2 — "Threads" card prototype.  BUILD 2.
//
// Design thesis: THE PARTY IS THE CHARACTER.  Cards are the expression layer;
// formation + relationships are the game.
//
//  · Each hero: 1 Core + 1 Signature card, re-written by their row (stance),
//    plus battle-generated temporaries (the resonant card is the first).
//  · Resonance is EMERGENT: single-target help forms a visible thread.
//    A full triangle freezes the field — TRIAD FORMED — and a resonant card
//    burns into the hand, keyed to the CLASS composition of the trio.  Every
//    class-triangle has its own vow (Offense / Defense / Formation), so which
//    three walk together IS the build.
//  · Reactive combat: enemy blows are PARRIED on a rhythm window; chaining
//    links / weakness / follow-ups fills BURST, unleashed as an interactive
//    ALL-OUT — the offensive mirror of the parry.
//  · The DESCENT is a procedurally-generated branching map (fight / elite /
//    event / camp / recruit / boss); a fallen party's ashes are remembered by
//    the Abyss and resurface in the next descent.
// ============================================================================

'use strict';

const V2_BUILD = 11;   // MUST match version.json's "v2.2" — the update-check compares them. Bump BOTH every build.
const CHARGE_CAP = 4;   // Hask (Black Mage) — max CHARGE stacks
const CHARGE_DMG = 3;   // damage per CHARGE spent by an OVERLOAD nuke
const MISFIRE_PER_CHARGE = 2;   // self-damage per ◆ CHARGE if Hask MOVES mid-channel (no Steady Cast)
// A pair at this many points is WOVEN — the game's ONE named bond state. It is
// what the victory screen celebrates, what the journal prints, what walks a pair
// into battle already connected, and (Build 247) what opens a crossing.
const BOND_KINDLED = 2;
// TECHNICAL — detonating an OPENED foe (chilled or weakened) off its weakness
// line. Multiplicative on purpose (Build 272): see dealToEnemy.
const TECHNICAL_MULT = 1.6;
function chargeCap(h) { return (h && h.id === 'hask' && hasNode('hask.passive.conduit')) ? 6 : CHARGE_CAP; }
function chargeDmg() { return hasNode('hask.passive.meltdown') ? 5 : CHARGE_DMG; }
const $ = (sel) => document.querySelector(sel);

// ---------------------------------------------------------------------------
// SETTINGS — persisted player options (menu) + dev toggles.
// ---------------------------------------------------------------------------
const SETTINGS_KEY = 'kizuna2_2.settings';
const SETTINGS = Object.assign(
  { sound: true, music: true, haptics: true, fightBg: true, depth: 'auto' },
  (() => { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') || {}; } catch (_) { return {}; } })()
);
function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(SETTINGS)); } catch (_) {} }

// ─────────────────────────────────────────────────────────────────────────────
// DEPTH TIERS (Build 253) — the diorama is the whole frame budget.
//
// Measured in a real fight: hiding #diorama takes the scene from 14fps to a
// clean 60, and nothing else moves the needle by comparison — not the ambient
// animations, not the figure filters, not the JS (renderAll costs 0.64ms). The
// cost is the stack of full-screen 3D layers, and every one you drop buys real
// frames back:
//
//   FULL  everything                                          25 fps
//   SOFT  no foreground lip, no ground plane, no drifting air  50 fps
//   FLAT  also no mid plane — one backdrop, still parallaxed   60 fps
//
// The row depths are untouched at every tier, so the party never collapses into
// a line; what goes is overdraw, not geometry.
const FX_TIERS = ['full', 'soft', 'flat'];
let _fxTier = 'full', _fxTuning = false, _fxNextTune = 0;
function applyFxTier() {
  const st = document.getElementById('stage'); if (!st) return;
  const want = SETTINGS.depth === 'auto' ? _fxTier : SETTINGS.depth;
  st.classList.toggle('fx-soft', want === 'soft' || want === 'flat');
  st.classList.toggle('fx-flat', want === 'flat');
}
// A WATCHDOG, NOT A ONE-SHOT (Build 261).
//
// This used to latch `_fxTuned = true` on its first run, which meant it sampled
// about 700ms into the FIRST fight of the session — an empty board, no status
// chips, no cut-in textures decoded yet, nothing dragging — decided FULL was
// affordable, and then never looked again for the rest of the session. Reported
// from a real device: 5fps, avg 186ms, with the whole backdrop still being
// drawn. The tuner had measured the easiest moment in the run and trusted it
// forever.
//
// It re-samples on a cooldown now, so a fight that gets heavier as it goes gets
// answered as it goes. It still only ever steps DOWN, still only while DEPTH is
// on `auto`, and still never climbs back within a session — a tier that keeps
// re-earning itself would oscillate on every heavy beat.
function autoTuneFx(force) {
  if (SETTINGS.depth !== 'auto' || _fxTuning) return;
  if (_fxTier === FX_TIERS[FX_TIERS.length - 1]) return;      // already as light as it goes
  const now = performance.now();
  if (!force && now < _fxNextTune) return;
  _fxTuning = true;
  _fxNextTune = now + 6000;
  const times = []; let last = performance.now();
  const tick = () => {
    const t = performance.now(); times.push(t - last); last = t;
    if (times.length < 40) { requestAnimationFrame(tick); return; }
    _fxTuning = false;
    times.sort((a, b) => a - b);
    const med = times[Math.floor(times.length / 2)];
    // 24ms ≈ 40fps. A genuinely struggling device takes both steps at once.
    const step = med > 40 ? 2 : med > 24 ? 1 : 0;
    if (!step) return;
    const was = _fxTier;
    _fxTier = FX_TIERS[Math.min(FX_TIERS.length - 1, FX_TIERS.indexOf(_fxTier) + step)];
    if (_fxTier !== was) applyFxTier();
  };
  requestAnimationFrame(tick);
}
// ── MUSIC — a looping combat theme, ducked low under the SFX.  Browsers block
// autoplay until a gesture, so we (re)try on the next pointerdown if a start is
// refused.  Fades in/out so entering and leaving a fight feels intentional. ──
// The combat theme's tempo, measured from the track (autocorrelation): the
// ThornCrown Duel runs at 120 BPM with the downbeat grid offset ~0.14s.  The
// parry cascades quantize to THIS grid so the notes fall on the beat.  Tune by
// ear if a re-export changes the tempo.
const MUSIC_BPM = 120, MUSIC_OFFSET = 0.14, MUSIC_BEAT = 60 / MUSIC_BPM;
// TWO-DECK CROSSFADER.  Games like Clair Obscur don't cut between exploration
// and battle music — they run BOTH stems and equal-power crossfade one into the
// other (incoming rises on sin, outgoing falls on cos, so summed loudness stays
// flat — no dip, no bump).  We do the same with two <audio> decks: combat lives
// on one, the world-map bed on the other, and swapping states dissolves between
// them.  The world theme RESUMES where it left off (a persistent overworld) while
// combat restarts from its downbeat (a fresh entrance).  loop=true keeps each
// track cycling so nothing ever stops dead.
const MUSIC = (() => {
  const CROSS = 2400;                 // crossfade length (ms) — long + gentle, so state changes DISSOLVE
  const decks = [];                   // [{a}, {a}] — two Audio elements
  let active = -1, want = false, wantSrc = null, wantVol = 0.5, xf = null, lvl = null, seqT = null, hiddenPaused = false;
  const posBySrc = {};                // remember where each track was, to resume it
  const baseOf = (s) => (s || '').split('?')[0];
  const mk = () => {
    try { const a = new Audio(); a.loop = true; a.preload = 'auto'; a.volume = 0; return { a }; }
    catch (_) { return null; }
  };
  const ensure = () => {
    if (decks.length || typeof Audio === 'undefined') return;
    const d0 = mk(), d1 = mk(); if (d0 && d1) decks.push(d0, d1);
  };
  // Equal-power crossfade: one timer drives BOTH decks, incoming rising on sin,
  // outgoing falling on cos, so summed loudness stays flat (no dip). Used for the
  // punchy jump INTO combat.  (Leaving combat uses the sequence path in play().)
  const crossfade = (out, inc, vol, ms) => {
    clearInterval(xf);
    const outFrom = out ? out.a.volume : 0;
    const steps = Math.max(1, Math.round(ms / 40)); let i = 0;
    xf = setInterval(() => {
      i++; const t = Math.min(1, i / steps);
      const kin = Math.sin(t * Math.PI / 2), kout = Math.cos(t * Math.PI / 2);
      if (inc) { try { inc.a.volume = Math.max(0, Math.min(1, vol * kin)); } catch (_) {} }
      if (out) { try { out.a.volume = Math.max(0, Math.min(1, outFrom * kout)); } catch (_) {} }
      if (i >= steps) { clearInterval(xf); if (out) { try { out.a.pause(); } catch (_) {} } }
    }, 40);
  };
  // Gentle level nudge from the deck's CURRENT volume to target — never dips to 0,
  // so re-asserting a track that's already playing (map/menu/tree re-entry) is
  // inaudible.  A no-op when it's already there.
  const fadeDeck = (d, target, ms) => {
    if (!d) return;
    clearInterval(lvl);
    const from = d.a.volume; if (Math.abs(from - target) < 0.01) return;
    const steps = Math.max(1, Math.round(ms / 40)); let i = 0;
    lvl = setInterval(() => {
      i++; const t = Math.min(1, i / steps);
      try { d.a.volume = Math.max(0, Math.min(1, from + (target - from) * t)); } catch (_) {}
      if (i >= steps) clearInterval(lvl);
    }, 40);
  };
  const startDeck = (d, src, resume) => {
    if (baseOf(d.a.src) !== baseOf(src)) { try { d.a.src = src; } catch (_) {} }
    const at = resume ? (posBySrc[baseOf(src)] || 0) : 0;
    try { d.a.currentTime = at; } catch (_) {}
    try { d.a.volume = 0; } catch (_) {}
    const p = d.a.play(); if (p && p.catch) p.catch(() => {});   // blocked → pointerdown retries
  };
  // any gesture is a chance to (re)start a wanted-but-blocked track
  try { document.addEventListener('pointerdown', () => {
    if (!want || !SETTINGS.music || hiddenPaused) return;
    const d = active >= 0 ? decks[active] : null;
    if (d && d.a.paused) { const p = d.a.play(); if (p && p.catch) p.catch(() => {}); if (d.a.volume < 0.02) crossfade(null, d, wantVol, 500); }
  }, { capture: true }); } catch (_) {}
  // LOCK / BACKGROUND — pause the music when the tab is hidden (phone locked, app
  // switched) and resume it on return.  Uses currentTime so it picks up exactly
  // where it left off.  visibilitychange is the reliable mobile signal; pagehide
  // covers the hard background/close.
  const pauseForHide = () => { hiddenPaused = false; decks.forEach(d => { if (d && d.a && !d.a.paused) { hiddenPaused = true; try { d.a.pause(); } catch (_) {} } }); };
  const resumeFromHide = () => { if (!hiddenPaused) return; hiddenPaused = false; if (!want || !SETTINGS.music) return; const d = active >= 0 ? decks[active] : null; if (d && d.a.paused) { const p = d.a.play(); if (p && p.catch) p.catch(() => {}); } };
  try {
    document.addEventListener('visibilitychange', () => { if (document.hidden) pauseForHide(); else resumeFromHide(); });
    window.addEventListener('pagehide', pauseForHide);
  } catch (_) {}
  return {
    // Fade FROM the current track TO `src`.  resume=true continues that track from
    // where it paused (world map); resume=false restarts it (combat entrance).
    // opts.ms sets the crossfade length; opts.sequence uses the fade-out→silence→
    // fade-in hand-off (leaving combat) instead of an overlapping crossfade.
    play(src, vol, resume, opts) {
      want = true; wantSrc = src; wantVol = (vol == null ? 0.5 : vol);
      clearTimeout(seqT);
      ensure(); if (!decks.length || !SETTINGS.music) return;
      const cur = active >= 0 ? decks[active] : null;
      if (cur && baseOf(cur.a.src) === baseOf(src)) {   // already foreground — do NOT restart or dip
        if (cur.a.paused) { const p = cur.a.play(); if (p && p.catch) p.catch(() => {}); }
        fadeDeck(cur, wantVol, 800);   // only nudges if the level actually differs; otherwise a no-op
        return;
      }
      if (cur) { try { posBySrc[baseOf(cur.a.src)] = cur.a.currentTime || 0; } catch (_) {} }   // bookmark the outgoing track
      const next = active === 0 ? 1 : 0;
      if (opts && opts.sequence) {
        // SEQUENTIAL hand-off (leaving combat): fade the battle theme fully OUT, a
        // beat of silence, THEN swell the field theme in — no two-track overlap, so
        // two very different pieces never clash.  Cleaner than a crossblend.
        const outMs = opts.outMs || 1100, gap = opts.gap || 300, inMs = opts.inMs || 1900;
        if (cur) crossfade(cur, null, 0, outMs);
        active = next;
        seqT = setTimeout(() => {
          if (!want || baseOf(wantSrc) !== baseOf(src) || !SETTINGS.music || hiddenPaused) return;   // superseded (re-entered combat) or backgrounded
          startDeck(decks[next], src, resume);
          crossfade(null, decks[next], wantVol, inMs);
        }, outMs + gap);
        return;
      }
      startDeck(decks[next], src, resume);
      crossfade(cur, decks[next], wantVol, (opts && opts.ms) || CROSS);
      active = next;
    },
    stop() { want = false; wantSrc = null; if (active >= 0 && decks[active]) { try { posBySrc[baseOf(decks[active].a.src)] = decks[active].a.currentTime || 0; } catch (_) {} crossfade(decks[active], null, 0, 1000); } },
    // reflect a live settings toggle
    refresh() {
      ensure(); if (!decks.length) return;
      if (SETTINGS.music && want && wantSrc) {
        const d = active >= 0 ? decks[active] : null;
        if (d && baseOf(d.a.src) === baseOf(wantSrc)) { const p = d.a.play(); if (p && p.catch) p.catch(() => {}); crossfade(null, d, wantVol, 700); }
        else this.play(wantSrc, wantVol, true);
      } else if (active >= 0 && decks[active]) { crossfade(decks[active], null, 0, 500); }
    },
    // BEAT CLOCK — where is the COMBAT deck, and when's the next grid point?  Parry
    // cascades read this to land their notes ON the beat.  Reads whichever deck is
    // carrying the combat theme (and only while it's actually up), so the world-map
    // bed never drives the parry timing.
    beat() {
      let a = null;
      for (const d of decks) { if (d && d.a && baseOf(d.a.src).indexOf('combat-theme') >= 0) { a = d.a; break; } }
      const playing = !!(a && !a.paused && SETTINGS.music && (a.currentTime || 0) > 0.05 && a.volume > 0.01);
      return {
        playing, beatSec: MUSIC_BEAT,
        now: () => (a ? (a.currentTime || 0) : 0),
        // the next grid point at least `lead` seconds ahead, on a `sub`-second grid
        nextGrid: (lead, sub) => { const g = sub || MUSIC_BEAT; const tt = (a ? (a.currentTime || 0) : 0) + (lead || 0); return Math.ceil((tt - MUSIC_OFFSET) / g) * g + MUSIC_OFFSET; },
      };
    },
  };
})();

// ---------------------------------------------------------------------------
// EMBERS — the PER-RUN progression currency.  Defeating foes yields embers,
// spent on your party's Ember Tree (a skill-tree for cards) to open their kit
// for THIS descent.  Everything resets when the run ends — see below.
// ---------------------------------------------------------------------------
// META now holds only the persistent difficulty setting (HEAT).  Progression is
// NOT permanent — it lives on the RUN.
const META_KEY = 'kizuna2_2.meta';
const META = Object.assign(
  { heat: 0, clears: 0, deaths: 0 },
  (() => { try { const m = JSON.parse(localStorage.getItem(META_KEY) || '{}') || {}; return { heat: +m.heat || 0, clears: +m.clears || 0, deaths: +m.deaths || 0 }; } catch (_) { return {}; } })()
);
function saveMeta() { try { localStorage.setItem(META_KEY, JSON.stringify({ heat: META.heat, clears: META.clears || 0, deaths: META.deaths || 0 })); } catch (_) {} }
// PER-RUN progression — embers and skill-tree unlocks live on the RUN and reset
// when it ends (death OR completion).  Between runs nothing is banked; every
// descent you rebuild your party's kit from scratch.
function runEmbers() { return (RUN && +RUN.embers) || 0; }
function hasNode(id) { return !!(RUN && RUN.nodes && RUN.nodes.indexOf(id) >= 0); }
function unlockNode(id) { if (RUN && !hasNode(id)) { (RUN.nodes = RUN.nodes || []).push(id); saveRun(); } }
function addEmbers(n) { if (!RUN) return; RUN.embers = Math.max(0, (RUN.embers || 0) + n); if (n > 0) RUN._embersTotal = (RUN._embersTotal || 0) + n; saveRun(); }
// A tree TIER opens as you DESCEND: tier 1 from the start, tier 2 once a couple
// of nodes are behind you, tier 3 deeper still — the kit grows across the run.
function runDepth() { return RUN ? ((RUN.depthBase || 0) + (RUN.completed ? RUN.completed.length : 0)) : 0; }
// TRICKLE (Build 286). The gate opened a tier every 2 depth, so with 7 levels a
// floor the WHOLE tree — 156 nodes — was unsealed before the first boss. Every
// tier ships across the descent now, which is also why sealed nodes stopped
// being drawn: a first-time player met 156 orbs, most of them padlocks, and
// read that as the size of the thing they had to learn.
// ═════════════════════════════════════════════════════════════════════════════
// WOUNDS (Build 291) — what the abyss keeps
//
// Measured twice: a duo with a healer finishes a room at 93-96% of the party bar
// while the same-size pair without one lands at 38-47%, and two rounds of
// shaving Elin's numbers moved that by three points. The cliff is not a value,
// it is a SHAPE: any reactive healing sufficient to cover one enemy action a
// turn erases a three-turn fight, so trimming the numbers only moves where
// "sufficient" sits. A rule has to cap it.
//
// A share of every blow that gets through becomes a WOUND — HP that in-fight
// healing cannot reach. Your bar still fills, it just fills to a lower ceiling
// as the floor wears on, and only a REST at a fire clears it. Healing stays
// valuable (it is the difference between standing and not) and stops being
// absolute. It also hands the mid-floor fire from Build 283 a real job.
//
// The fiction wrote this before the balance needed it — fragment f7: "what it
// remembers it keeps: the name first, then the face."
const WOUND_SHARE = 0.4;                       // of damage that actually lands
function woundOf(h) { return (h && h.wound) || 0; }
// The ceiling healing can reach. Every heal in the game clamps to this instead
// of maxHp — one seam, so no call site can forget.
function healCap(h) { return Math.max(1, (h ? h.maxHp : 1) - woundOf(h)); }
function tierOpen(tier) { return runDepth() >= (tier - 1) * 4; }
// The deepest tier the road has unsealed, and what is still to come.
function tierMax() { let t = 1; while (t < TREE_TIERS && tierOpen(t + 1)) t++; return t; }
function sealedAhead(nodes) { return (nodes || []).filter(n => !tierOpen(n.tier)).length; }
// one-time hand-hold: the first time you have embers to spend, the game walks
// you through opening the Ember Tree and kindling a skill.
function treeTaught() { try { return localStorage.getItem('kizuna2_2.treeTaught') === '1'; } catch (_) { return false; } }
function setTreeTaught() { try { localStorage.setItem('kizuna2_2.treeTaught', '1'); } catch (_) {} }

// ---------------------------------------------------------------------------
// THE EMBER TREE — declarative skill-tree for cards.  Each node is pure data
// the engine reads at card-build/move time, so there is no bespoke code per
// node.  Node types:
//   card    — unlocks a hero's signature card for a stance (SIG_GATE)
//   rider   — attaches an effect to an existing card (bridge: adds a keyword)
//   passive — a standing rule fired by a game hook (e.g. moving to FRONT)
//   allout  — an alternate all-out (Phase 3)
// Phase 1 ships Ash's opening constellation; other heroes keep their full kit
// until they get their own constellations.
// ---------------------------------------------------------------------------
// THE ANCHOR RULE (Build 311, Darkest-Dungeon-shaped). A hero's tree GROWS from
// their archetype: tier 1 is the anchor ring — the signature combos of the kit
// they arrived with — and every deeper node must chain back to it through
// `requires`. Nothing above tier 1 floats free, so a build is always a connected
// line of growth out of who the character IS, never a grab-bag of whatever the
// open tier happens to sell. The five nodes that used to float (each hero's
// archetype passive/execute) now hang off the stance line they express: the
// Ronin's vanguard off his FRONT line, the Cleric's ward off her MEND line, the
// Sentinel's vigil off her wall, the two Executioners off the EXECUTION and
// OVERLOAD lines they cash. Enforced by a structural check in the suite.
const EMBER_TREE = [
  { id: 'ash.sig.front', hero: 'ash', tier: 1, cost: 4, type: 'card', gate: { stance: 'front' }, label: 'Rising Slash', desc: 'COMBO · FRONT: inserts <b>Rising Slash</b> (8 dmg) · Cleave → <b>Rising Slash</b> → Crashing Wave' },
  { id: 'ash.sig.back',  hero: 'ash', tier: 1, cost: 4, type: 'card', gate: { stance: 'back'  }, label: 'Deeper Cut', desc: 'COMBO · BACK: inserts <b>Deeper Cut</b> (5 dmg) · Thrown Edge → <b>Deeper Cut</b> → Follow Cut' },
  { id: 'ash.sig.mid',   hero: 'ash', tier: 1, cost: 5, type: 'card', gate: { stance: 'mid'   }, label: 'Parry Step', desc: 'COMBO · MID: inserts <b>Parry Step</b> (<span class="kw kw-guard">⛨5</span> · <span class="kw kw-counter">↺1</span>) · Flowing Cut → <b>Parry Step</b> → Riposte' },
  { id: 'ash.rider.expose', hero: 'ash', tier: 2, cost: 6, type: 'rider', requires: ['ash.sig.back'], label: 'Hunter’s Instinct', desc: 'UPGRADE: Thrown Edge also inflicts <span class="kw kw-exposed">◎ EXPOSED 2</span> — position becomes a debuff', rider: { card: 'Thrown Edge', fx: { mark: 2 }, descAdd: ' · <span class="kw kw-exposed">◎ EXPOSED 2</span>' } },
  { id: 'ash.passive.vanguard', hero: 'ash', tier: 2, cost: 6, type: 'passive', requires: ['ash.sig.mid'], label: 'Vanguard’s Momentum', desc: 'ON MOVE: closing to FRONT grants <span class="kw kw-guard">⛨3</span> — repositioning becomes defense', passive: 'ash_vanguard' },
  { id: 'ash.passive.warstep', hero: 'ash', tier: 2, cost: 6, type: 'passive', requires: ['ash.passive.vanguard'], label: 'Warstep', desc: 'PASSIVE: after Ash lands an ATTACK, his first <b>MOVE</b> that turn is <b>FREE</b> — he repositions as he strikes', passive: 'ash_warstep' },
  { id: 'ash.allout.execution', hero: 'ash', tier: 4, cost: 12, type: 'allout', requires: ['ash.sig.front'], label: 'Rite of Endings', desc: 'ALL-OUT: every strike EXECUTES a foe under <b>25% HP</b> — no wounded walk away', allout: 'execution' },
  { id: 'ash.emergent.tempo', hero: 'ash', tier: 3, cost: 9, type: 'emergent', requires: ['ash.sig.front'], label: 'Rising Tempo',
    desc: 'EVERY 3RD HIT: forge a free <b>Follow Cut</b> (7 dmg) — momentum becomes a card',
    emergent: { on: 'hit', every: 3, stance: 'FORGED · TEMPO', flash: 'Ash finds the rhythm — <b>Follow Cut</b> forged.',
      forge: { name: 'Follow Cut', cost: 0, target: 'enemy', fx: { dmg: 7 }, desc: '<b>7 damage</b> to any foe.' } } },

  // ELIN — the Mender: wards and light
  { id: 'elin.sig.front', hero: 'elin', tier: 1, cost: 4, type: 'card', gate: { stance: 'front' }, label: 'Searing', desc: 'COMBO · FRONT: inserts <b>Searing</b> (7 holy) · Smite → <b>Searing</b> → Radiant Ward' },
  { id: 'elin.sig.mid',   hero: 'elin', tier: 1, cost: 5, type: 'card', gate: { stance: 'mid'   }, label: 'Sanctuary', desc: 'COMBO · MID: inserts <b>Sanctuary</b> (<span class="kw kw-heal">✚4</span> · <span class="kw kw-guard">⛨4</span>) · Mend → <b>Sanctuary</b> → Renew' },
  { id: 'elin.sig.back',  hero: 'elin', tier: 1, cost: 4, type: 'card', gate: { stance: 'back'  }, label: 'Blessing', desc: 'COMBO · BACK: inserts <b>Blessing</b> (<span class="kw kw-heal">✚3</span> · <span class="kw kw-rally">▲+2</span>) · Distant Prayer → <b>Blessing</b> → Benediction' },

  // MIRA — the Assassin: exposure and slips
  { id: 'mira.sig.front', hero: 'mira', tier: 1, cost: 4, type: 'card', gate: { stance: 'front' }, label: 'Twin Cut', desc: 'COMBO · FRONT: inserts <b>Twin Cut</b> (6 dmg) · Backstab → <b>Twin Cut</b> → Vanish Strike' },
  { id: 'mira.sig.mid',   hero: 'mira', tier: 1, cost: 5, type: 'card', gate: { stance: 'mid'   }, label: 'Serrate', desc: 'COMBO · MID: inserts <b>Serrate</b> (4 dmg · <span class="kw kw-exposed">◎+1</span>) · Shadow Knife → <b>Serrate</b> → Twin Daggers' },
  { id: 'mira.sig.back',  hero: 'mira', tier: 1, cost: 4, type: 'card', gate: { stance: 'back'  }, label: 'Quick Throw', desc: 'COMBO · BACK: inserts <b>Quick Throw</b> (4 dmg) · Thrown Dagger → <b>Quick Throw</b> → Execute' },
  { id: 'mira.rider.exploit', hero: 'mira', tier: 2, cost: 6, type: 'rider', requires: ['mira.sig.front'], label: 'Killer’s Eye', desc: 'UPGRADE: Backstab also inflicts <span class="kw kw-exposed">◎ EXPOSED 2</span>', rider: { card: 'Backstab', fx: { mark: 2 }, descAdd: ' · <span class="kw kw-exposed">◎ EXPOSED 2</span>' } },
  { id: 'mira.emergent.bloodscent', hero: 'mira', tier: 3, cost: 9, type: 'emergent', requires: ['mira.sig.back'], label: 'Bloodscent',
    desc: 'EVERY 2ND EXPOSE: forge a free <b>Execute</b> (12 dmg) — the mark becomes a kill',
    emergent: { on: 'expose', every: 2, stance: 'FORGED · BLOOD', flash: 'She smells blood — <b>Execute</b> forged.',
      forge: { name: 'Execute', cost: 0, target: 'enemy', fx: { dmg: 12 }, desc: '<b>12 damage</b> to any foe.' } } },

  // CASSIA — the Warden: guard and retaliation
  { id: 'cassia.sig.front', hero: 'cassia', tier: 1, cost: 4, type: 'card', gate: { stance: 'front' }, label: 'Brace', desc: 'COMBO · FRONT: inserts <b>Brace</b> (<span class="kw kw-guard">⛨4</span>) · Shield Bash → <b>Brace</b> → Bulwark' },
  { id: 'cassia.sig.mid',   hero: 'cassia', tier: 1, cost: 5, type: 'card', gate: { stance: 'mid'   }, label: 'Reinforce', desc: 'COMBO · MID: inserts <b>Reinforce</b> (ally <span class="kw kw-guard">⛨3</span>) · Cover → <b>Reinforce</b> → Aegis' },
  { id: 'cassia.sig.back',  hero: 'cassia', tier: 1, cost: 4, type: 'card', gate: { stance: 'back'  }, label: 'Weighted Shield', desc: 'COMBO · BACK: inserts <b>Weighted Shield</b> (3 dmg) · Thrown Shield → <b>Weighted Shield</b> → Sentinel Throw' },
  { id: 'cassia.emergent.bulwark', hero: 'cassia', tier: 3, cost: 9, type: 'emergent', requires: ['cassia.sig.front'], label: 'Iron Answer',
    desc: 'EVERY 2ND GUARD: forge a free <b>Bulwark Break</b> (9 dmg) — the wall answers back',
    emergent: { on: 'guard', every: 2, stance: 'FORGED · IRON', flash: 'The wall answers — <b>Bulwark Break</b> forged.',
      forge: { name: 'Bulwark Break', cost: 0, target: 'enemy', fx: { dmg: 9 }, desc: '<b>9 damage</b> to any foe.' } } },

  // BRANWEN — the Marksman: marks and repositioning
  { id: 'branwen.sig.front', hero: 'branwen', tier: 1, cost: 4, type: 'card', gate: { stance: 'front' }, label: 'Snap Shot', desc: 'COMBO · FRONT: inserts <b>Snap Shot</b> (5 dmg) · Backstep Shot → <b>Snap Shot</b> → Hail' },
  { id: 'branwen.sig.mid',   hero: 'branwen', tier: 1, cost: 5, type: 'card', gate: { stance: 'mid'   }, label: 'Steady Aim', desc: 'COMBO · MID: inserts <b>Steady Aim</b> (<span class="kw kw-rally">▲+3</span> next shot) · Aimed Shot → <b>Steady Aim</b> → Killshot' },
  { id: 'branwen.sig.back',  hero: 'branwen', tier: 1, cost: 4, type: 'card', gate: { stance: 'back'  }, label: 'Deeper Mark', desc: 'COMBO · BACK: inserts <b>Deeper Mark</b> (<span class="kw kw-exposed">◎+2</span>) · Marking Arrow → <b>Deeper Mark</b> → Killing Arrow' },
  { id: 'branwen.rider.deadeye', hero: 'branwen', tier: 2, cost: 6, type: 'rider', requires: ['branwen.sig.front'], label: 'Deadeye', desc: 'UPGRADE: Backstep Shot also inflicts <span class="kw kw-exposed">◎ EXPOSED 2</span>', rider: { card: 'Backstep Shot', fx: { mark: 2 }, descAdd: ' · <span class="kw kw-exposed">◎ EXPOSED 2</span>' } },
  { id: 'branwen.passive.longshot', hero: 'branwen', tier: 2, cost: 6, type: 'passive', requires: ['branwen.rider.deadeye'], label: 'Longshot', desc: 'PASSIVE: Branwen’s attacks <b>ignore enemy <span class="kw kw-guard">⛨ GUARD</span></b> — her arrows find the gap from range', passive: 'branwen_longshot' },
  { id: 'branwen.emergent.tally', hero: 'branwen', tier: 3, cost: 9, type: 'emergent', requires: ['branwen.sig.back'], label: 'Death’s Tally',
    desc: 'EVERY 2ND EXPOSE: forge a free <b>Killing Arrow</b> (9 dmg · <span class="kw kw-exposed">◎2</span>) — the tally comes due',
    emergent: { on: 'expose', every: 2, stance: 'FORGED · TALLY', flash: 'The tally comes due — <b>Killing Arrow</b> forged.',
      forge: { name: 'Killing Arrow', cost: 0, target: 'enemy', fx: { dmg: 9, mark: 2 }, desc: '<b>9 damage</b> · <span class="kw kw-exposed">◎ EXPOSED 2</span> to any foe.' } } },

  // ═══ DEEP TREES (Phase 2) — each hero grows a layered keyword identity across
  // four tiers: signatures → keyword riders & passives → emergent procs + an
  // all-out upgrade → an identity CAPSTONE.  All data-driven (rider / passive /
  // allout), read by the shared hooks above. ═══════════════════════════════════

  // ASH — TEMPO: momentum, repositioning, follow-ups
  { id: 'ash.passive.relentless', hero: 'ash', tier: 4, cost: 12, type: 'passive', requires: ['ash.emergent.tempo'], label: 'Relentless', desc: 'PASSIVE: your 1st <span class="kw kw-rally">ASSIST</span> each turn refunds <b>1 EP</b> — the duel never lets up', passive: 'ash_relentless' },

  // ELIN — LIGHT: wards, overheal shields, party sustain
  { id: 'elin.passive.ward', hero: 'elin', tier: 2, cost: 6, type: 'passive', requires: ['elin.sig.mid'], label: 'Warding Light', desc: 'TURN START: your most-wounded ally gains <span class="kw kw-guard">⛨2</span> — the light finds the hurt', passive: 'elin_ward' },
  { id: 'elin.passive.mercy', hero: 'elin', tier: 2, cost: 6, type: 'passive', requires: ['elin.passive.ward'], label: 'Mercy', desc: 'PASSIVE: when Elin <b>heals</b> an ally she also <b>cleanses</b> <span class="kw kw-chill">❄ CHILL</span> and <span class="kw kw-exposed">◎ EXPOSED</span> — she mends the omen too', passive: 'elin_mercy' },
  { id: 'elin.passive.wrath', hero: 'elin', tier: 3, cost: 8, type: 'passive', requires: ['elin.passive.ward'], label: 'Wrathful Light', desc: 'PASSIVE: Elin’s <b>✦ smites</b> (her support cards’ strike) hit <b>+2</b> and <span class="kw kw-exposed">◎ EXPOSE 1</span> — her light marks the wicked for the whole party', passive: 'elin_wrath' },
  { id: 'elin.rider.radiance', hero: 'elin', tier: 3, cost: 7, type: 'rider', requires: ['elin.sig.front'], label: 'Radiance', desc: 'UPGRADE: Radiant Ward also heals EVERY ally <span class="kw kw-heal">✚2</span>', rider: { card: 'Radiant Ward', fx: { heal: 2 }, descAdd: ' · <span class="kw kw-heal">✚ 2</span> party' } },
  { id: 'elin.passive.overflow', hero: 'elin', tier: 4, cost: 11, type: 'passive', requires: ['elin.rider.radiance'], label: 'Radiant Overflow', desc: 'PASSIVE: heal OVERFLOW spills as <span class="kw kw-guard">⛨ guard</span> to the WHOLE party — not just the target', passive: 'elin_overflow' },

  // MIRA — EXPOSED: exploit marks, execute the wounded
  { id: 'mira.passive.opportunist', hero: 'mira', tier: 2, cost: 6, type: 'passive', requires: ['mira.sig.back'], label: 'Opportunist', desc: 'PASSIVE: <b>+3 dmg</b> to any <span class="kw kw-exposed">◎ EXPOSED</span> foe — never waste an opening', passive: 'mira_opportunist' },
  { id: 'mira.rider.twin', hero: 'mira', tier: 3, cost: 7, type: 'rider', requires: ['mira.sig.mid'], label: 'Twinned Edge', desc: 'UPGRADE: Twin Daggers also inflicts <span class="kw kw-exposed">◎ EXPOSED 3</span>', rider: { card: 'Twin Daggers', fx: { mark: 3 }, descAdd: ' · <span class="kw kw-exposed">◎ EXPOSED 3</span>' } },
  { id: 'mira.passive.deathmark', hero: 'mira', tier: 4, cost: 12, type: 'passive', requires: ['mira.emergent.bloodscent'], label: 'Death Mark', desc: 'PASSIVE: striking a foe at/under <b>30% HP</b> EXECUTES it — the wounded don’t walk away', passive: 'mira_execute' },

  // CASSIA — GUARD: retaliation, an immovable wall
  { id: 'cassia.passive.vigil', hero: 'cassia', tier: 2, cost: 6, type: 'passive', requires: ['cassia.sig.front'], label: 'Standing Vigil', desc: 'TURN START: Cassia braces for <span class="kw kw-guard">⛨2</span> — never caught flat', passive: 'cassia_vigil' },
  { id: 'cassia.passive.bastion', hero: 'cassia', tier: 2, cost: 6, type: 'passive', requires: ['cassia.passive.vigil'], label: 'Bastion', desc: 'PASSIVE: Cassia resists <span class="kw kw-chill">❄ CHILL</span> AND braces <span class="kw kw-counter">↺ 1</span> each turn — the wall does not slow, and it bites back', passive: 'cassia_bastion' },
  { id: 'cassia.passive.shelter', hero: 'cassia', tier: 3, cost: 8, type: 'passive', requires: ['cassia.passive.vigil'], label: 'Living Bulwark', desc: 'TURN START: if Cassia holds <b>10+ <span class="kw kw-guard">⛨ guard</span></b>, the most-wounded ally <span class="kw kw-heal">✚ 4</span> — bank the wall high and it shelters the line', passive: 'cassia_shelter' },
  { id: 'cassia.rider.aegis', hero: 'cassia', tier: 3, cost: 7, type: 'rider', requires: ['cassia.sig.mid'], label: 'Warded Aegis', desc: 'UPGRADE: Aegis also grants the ally <span class="kw kw-counter">↺1</span> — the ward bites back', rider: { card: 'Aegis', fx: { counter: 1 }, descAdd: ' · <span class="kw kw-counter">↺ 1</span>' } },
  { id: 'cassia.allout.fortress', hero: 'cassia', tier: 3, cost: 9, type: 'allout', requires: ['cassia.emergent.bulwark'], label: 'Fortress', desc: 'ALL-OUT START: the whole party gains <span class="kw kw-guard">⛨5</span> — brace before the storm', allout: 'fortress' },
  { id: 'cassia.passive.immovable', hero: 'cassia', tier: 4, cost: 12, type: 'passive', requires: ['cassia.rider.aegis'], label: 'Immovable', desc: 'PASSIVE: Cassia’s <span class="kw kw-guard">⛨ guard</span> no longer fades at turn’s end — the wall only grows', passive: 'cassia_immovable' },

  // BRANWEN — MARK: marks at range, the tally comes due
  { id: 'branwen.passive.focus', hero: 'branwen', tier: 2, cost: 6, type: 'passive', requires: ['branwen.sig.back'], label: 'Hunter’s Focus', desc: 'PASSIVE: <b>+1 dmg per <span class="kw kw-exposed">◎ EXPOSED</span> stack</b> on the target (max <b>+4</b>) — deepen the mark, deepen the wound', passive: 'branwen_hunter' },
  { id: 'branwen.passive.opening', hero: 'branwen', tier: 3, cost: 8, type: 'passive', requires: ['branwen.passive.focus'], label: 'Opening Shot', desc: 'TURN START: EXPOSE the nearest foe <span class="kw kw-exposed">◎1</span> — the hunt is always on', passive: 'branwen_opening' },
  { id: 'branwen.passive.reckoning', hero: 'branwen', tier: 4, cost: 12, type: 'passive', requires: ['branwen.emergent.tally'], label: 'The Reckoning', desc: 'ON EXPOSED KILL: your 1st kill each turn refunds <b>1 EP</b> — the tally always comes due', passive: 'branwen_reckoning' },

  // ═══ TEAM SYNERGY (Phase 3) — each hero's identity now pays the WHOLE party.
  // These are the cross-hero combos: who you bring changes how everyone plays. ═══
  { id: 'ash.synergy.warcry', hero: 'ash', tier: 4, cost: 11, type: 'synergy', requires: ['ash.passive.exploit'], label: 'Warcry', desc: 'ON ASSIST: the ally you struck alongside gains <span class="kw kw-rally">▲ RALLY +2</span> — the hunt feeds the pack', passive: 'ash_warcry' },
  { id: 'elin.synergy.blessing', hero: 'elin', tier: 4, cost: 11, type: 'synergy', requires: ['elin.passive.ward'], label: 'Blessed Edge', desc: 'ON HEAL / WARD: that ally’s next strike deals <span class="kw kw-rally">▲ +2</span> — her light sharpens their blade', passive: 'elin_blessing' },
  { id: 'mira.synergy.marked', hero: 'mira', tier: 4, cost: 11, type: 'synergy', requires: ['mira.passive.opportunist'], label: 'Marked for Death', desc: 'PASSIVE: <span class="kw kw-exposed">◎ EXPOSED</span> foes take <b>+2</b> from EVERY ally — your openings are the party’s', passive: 'mira_marked' },
  { id: 'cassia.synergy.soak', hero: 'cassia', tier: 4, cost: 11, type: 'synergy', requires: ['cassia.passive.vigil'], label: 'Guardian’s Aegis', desc: 'PASSIVE: allies in rows BEHIND Cassia take <b>−2</b> from every blow — she covers the line', passive: 'cassia_soak' },
  { id: 'branwen.synergy.cadence', hero: 'branwen', tier: 4, cost: 11, type: 'synergy', requires: ['branwen.passive.opening'], label: 'Hunter’s Cadence', desc: 'TURN START: if any foe is <span class="kw kw-exposed">◎ EXPOSED</span>, the WHOLE party gains <span class="kw kw-rally">▲ RALLY +1</span>', passive: 'branwen_cadence' },

  // ═══ STANCE PATHWAYS — every position now grows its own branch, so all three
  // rows reward investment (not just each hero's one favoured stance). ══════════
  // ASH — the MID (flow) line and a deeper BACK (mark) line
  { id: 'ash.passive.exploit', hero: 'ash', tier: 3, cost: 8, type: 'passive', requires: ['ash.rider.expose'], label: 'Spearpoint', desc: 'PASSIVE: <b>+3 dmg</b> to the <b>FRONTMOST</b> foe — Ash hits hardest at the tip of the line', passive: 'ash_exploit' },

  // ELIN — a deeper MID (ward) line
  { id: 'elin.rider.sanctuary', hero: 'elin', tier: 2, cost: 6, type: 'rider', requires: ['elin.sig.mid'], label: 'Warded Sanctuary', desc: 'UPGRADE: Sanctuary also grants the ally <span class="kw kw-counter">↺1</span> — the ward bites back', rider: { card: 'Sanctuary', fx: { counter: 1 }, descAdd: ' · <span class="kw kw-counter">↺ 1</span>' } },

  // MIRA — a deeper FRONT (vanish) line and a MID (twin) line
  { id: 'mira.emergent.flurry', hero: 'mira', tier: 3, cost: 8, type: 'emergent', requires: ['mira.rider.twin'], label: 'Bladestorm', desc: 'EVERY 3RD HIT: forge a free <b>Flurry</b> (6 dmg · <span class="kw kw-exposed">◎1</span>) — the daggers keep coming', emergent: { on: 'hit', every: 3, stance: 'FORGED · STORM', flash: 'The blades multiply — <b>Flurry</b> forged.', forge: { name: 'Flurry', cost: 0, target: 'enemy', fx: { dmg: 6, mark: 1 }, desc: '<b>6 damage</b> · <span class="kw kw-exposed">◎ EXPOSED 1</span> to any foe.' } } },

  // CASSIA — a BACK (sentinel) line

  // BRANWEN — a FRONT (mark) line

  // ═══ COMBO DEPTH (FFXIV-shaped) — completing the thin stance lines so every
  // position grows a full arc: sig opener → keyword rider → emergent finisher →
  // identity capstone.  All data-driven off the existing hooks. ═════════════════
  // ELIN — the FRONT (searing) and BACK (mercy) lines each jumped T1→T3; a T2
  // rider fills the hole, and a BACK capstone finally caps the heal line.

  // MIRA — the MID (twin) line lacked its early rider; a MID capstone caps it.
  { id: 'mira.passive.frenzy', hero: 'mira', tier: 4, cost: 12, type: 'passive', requires: ['mira.emergent.flurry'], label: 'Bloodfrenzy', desc: 'ON HIT vs an <span class="kw kw-exposed">◎ EXPOSED</span> foe: <b>DEVOUR</b> its marks — <b>+3 dmg per stack</b>, <b>DOUBLED</b> vs a foe under <b>½ HP</b>, then clear them. The frenzy feasts on the wounded', passive: 'mira_frenzy' },

  // CASSIA — the MID (aegis) line jumped T1→T3; a T2 rider fills it.

  // BRANWEN — the MID (Killshot) line was the thinnest in the tree: one lone
  // rider.  Now a full single-target execution arc — steady aim → a piercing
  // cadence that forges free shots → the killing blow that finishes the wounded.
  { id: 'branwen.emergent.pierce', hero: 'branwen', tier: 3, cost: 8, type: 'emergent', requires: ['branwen.sig.mid'], label: 'Marksman’s Rhythm', desc: 'EVERY 3RD HIT: forge a free <b>Piercing Shot</b> (10 dmg) — the aim never wavers', emergent: { on: 'hit', every: 3, stance: 'FORGED · AIM', flash: 'The cadence holds — <b>Piercing Shot</b> forged.', forge: { name: 'Piercing Shot', cost: 0, target: 'enemy', fx: { dmg: 10 }, desc: '<b>10 damage</b> to any foe.' } } },
  { id: 'branwen.passive.killingblow', hero: 'branwen', tier: 4, cost: 12, type: 'passive', requires: ['branwen.emergent.pierce'], label: 'The Killing Blow', desc: 'PASSIVE: <b>+4 dmg</b> to any foe at/under <b>half HP</b> — the wounded can’t outrun the arrow', passive: 'branwen_killingblow' },

  // ═══ SIGNATURE MOMENTS — build-defining capstones that turn a hero's identity
  // INSIDE OUT.  Each is one of several ways to build a hero across playthroughs;
  // pick the fantasy you want this run. ════════════════════════════════════════════
  { id: 'cassia.nova', hero: 'cassia', tier: 4, cost: 11, type: 'emergent', requires: ['cassia.emergent.bulwark'], label: 'Aegis Nova',
    desc: 'EVERY 3RD GUARD: forge a free <b>Aegis Nova</b> — hurl ALL your <span class="kw kw-guard">⛨ guard</span> as one hit, then it shatters',
    emergent: { on: 'guard', every: 3, stance: 'FORGED · NOVA', flash: 'The wall becomes the blow — <b>Aegis Nova</b> forged.',
      forge: { name: 'Aegis Nova', cost: 0, target: 'frontmost', fx: { guardBurst: true }, desc: 'Unleash <b>ALL your <span class="kw kw-guard">⛨ guard</span></b> as one hit, then it shatters.' } } },
  { id: 'elin.inverse', hero: 'elin', tier: 4, cost: 11, type: 'emergent', requires: ['elin.rider.sanctuary'], label: 'Inverse Light',
    desc: 'EVERY 2ND HEAL: forge a free <b>Inverse Light</b> (8 holy dmg) — mending, weaponised',
    emergent: { on: 'heal', every: 2, stance: 'FORGED · UMBRA', flash: 'The light turns outward — <b>Inverse Light</b> forged.',
      forge: { name: 'Inverse Light', cost: 0, target: 'enemy', fx: { dmg: 8 }, desc: '<b>8 holy damage</b> to any foe.' } } },

  // ═══ ROTATION BRANCHES — the FORK.  Once a stance's line is complete (its
  // finisher signature), a branch node opens a SECOND path off the opener: play
  // the opener and pick which line to run, the other burns away.  This is where
  // the in-combat choice lives, and it's earned. ═══════════════════════════════
  // ALTERNATE OPENERS (Build 11) \u2014 a SECOND way to open the archetype row.
  // The pool of a position grows by LEARNING: these enter the same line as
  // the row's own opener (forks included) and share its once-per-line latch.
  { id: 'ash.open.front',    hero: 'ash',     tier: 2, cost: 5, type: 'card', requires: ['ash.sig.front'],    label: 'Feint Cut',    desc: 'OPENER \u00b7 FRONT: a second opener \u2014 <b>Feint Cut</b> (3 dmg \u00b7 <span class="kw kw-exposed">\u25ce2</span> ANY foe), entering the same line as Cleave' },
  { id: 'elin.open.mid',     hero: 'elin',    tier: 2, cost: 5, type: 'card', requires: ['elin.sig.mid'],     label: 'Stillness',    desc: 'OPENER \u00b7 MID: a second opener \u2014 <b>Stillness</b> (<span class="kw kw-guard">\u26e85</span> an ally), entering the same line as Mend' },
  { id: 'mira.open.back',    hero: 'mira',    tier: 2, cost: 5, type: 'card', requires: ['mira.sig.back'],    label: 'Marked Knife', desc: 'OPENER \u00b7 BACK: a second opener \u2014 <b>Marked Knife</b> (2 dmg \u00b7 <span class="kw kw-exposed">\u25ce2</span>), entering the same line as Thrown Dagger' },
  { id: 'cassia.open.front', hero: 'cassia',  tier: 2, cost: 5, type: 'card', requires: ['cassia.sig.front'], label: 'Iron Stand',   desc: 'OPENER \u00b7 FRONT: a second opener \u2014 <b>Iron Stand</b> (<span class="kw kw-guard">\u26e84</span> \u00b7 <span class="kw kw-counter">\u21ba1</span>), entering the same line as Shield Bash' },
  { id: 'branwen.open.mid',  hero: 'branwen', tier: 2, cost: 5, type: 'card', requires: ['branwen.sig.mid'],  label: 'Pinning Shot', desc: 'OPENER \u00b7 MID: a second opener \u2014 <b>Pinning Shot</b> (4 dmg \u00b7 <span class="kw kw-exposed">\u25ce1</span> ANY foe), entering the same line as Aimed Shot' },
  { id: 'hask.open.front',   hero: 'hask',    tier: 2, cost: 5, type: 'card', requires: ['hask.sig.front'],   label: 'Cinder Snap',  desc: 'OPENER \u00b7 FRONT: a second opener \u2014 <b>Cinder Snap</b> (5 fire), entering the same line as Frost Touch' },
  { id: 'ash.branch.front', hero: 'ash', tier: 2, cost: 6, type: 'branch', requires: ['ash.sig.front'], label: 'Sunder Fork', desc: 'FORK · FRONT: Cleave also opens <b>Sunder</b> (5 dmg · <span class="kw kw-exposed">◎2</span>) → <b>Marked Fate</b> (<span class="kw kw-exposed">◎4</span>) — the cut or the mark' },
  { id: 'ash.branch.mid',   hero: 'ash', tier: 2, cost: 6, type: 'branch', requires: ['ash.sig.mid'],   label: 'Flow Fork',   desc: 'FORK · MID: Flowing Cut also opens <b>Flow Read</b> (slip FRONT · <span class="kw kw-rally">▲+3</span>) → <b>Crossguard</b> (<span class="kw kw-guard">⛨6</span> ally)' },
  { id: 'ash.branch.back',  hero: 'ash', tier: 2, cost: 6, type: 'branch', requires: ['ash.sig.back'],  label: 'Mark Fork',   desc: 'FORK · BACK: Thrown Edge also opens <b>Hunter’s Read</b> (<span class="kw kw-exposed">◎2</span>) → <b>Marked Fate</b> (<span class="kw kw-exposed">◎4</span>)' },
  { id: 'elin.branch.front', hero: 'elin', tier: 2, cost: 6, type: 'branch', requires: ['elin.sig.front'], label: 'Radiant Fork', desc: 'FORK · FRONT: Smite also opens <b>Raise Ward</b> (party <span class="kw kw-guard">⛨2</span>) → <b>Consecrate</b> (6 holy) — damage or the ward' },
  { id: 'elin.branch.mid',   hero: 'elin', tier: 2, cost: 6, type: 'branch', requires: ['elin.sig.mid'],   label: 'Ward Fork',    desc: 'FORK · MID: Mend also opens <b>Cleanse</b> (<span class="kw kw-heal">✚</span> · <span class="kw kw-guard">⛨</span>) → <b>Warding Circle</b> (party <span class="kw kw-guard">⛨3</span>)' },
  { id: 'elin.branch.back',  hero: 'elin', tier: 2, cost: 6, type: 'branch', requires: ['elin.sig.back'],  label: 'Mercy Fork',   desc: 'FORK · BACK: Distant Prayer also opens <b>Deep Mercy</b> (<span class="kw kw-heal">✚8</span>) → <b>Dawnlight</b> (party <span class="kw kw-heal">✚5</span>)' },
  { id: 'mira.branch.front', hero: 'mira', tier: 2, cost: 6, type: 'branch', requires: ['mira.sig.front'], label: 'Shadow Fork', desc: 'FORK · FRONT: Backstab also opens <b>Shadowstep</b> (<span class="kw kw-exposed">◎2</span> · slip) → <b>Killing Mark</b> (<span class="kw kw-exposed">◎5</span>)' },
  { id: 'mira.branch.mid',   hero: 'mira', tier: 2, cost: 6, type: 'branch', requires: ['mira.sig.mid'],   label: 'Guile Fork',  desc: 'FORK · MID: Shadow Knife also opens <b>Feint</b> (<span class="kw kw-rally">▲+3</span>) → <b>Bloodletting</b> (8 dmg · <span class="kw kw-exposed">◎2</span>)' },
  { id: 'mira.branch.back',  hero: 'mira', tier: 2, cost: 6, type: 'branch', requires: ['mira.sig.back'],  label: 'Hunt Fork',   desc: 'FORK · BACK: Thrown Dagger also opens <b>Mark</b> (<span class="kw kw-exposed">◎3</span>) → <b>Killing Mark</b> (<span class="kw kw-exposed">◎5</span>)' },
  { id: 'cassia.branch.front', hero: 'cassia', tier: 2, cost: 6, type: 'branch', requires: ['cassia.sig.front'], label: 'Iron Fork', desc: 'FORK · FRONT: Shield Bash also opens <b>Provoke</b> (<span class="kw kw-guard">⛨2</span> · <span class="kw kw-counter">↺2</span> · TAUNT) → <b>Iron Answer</b> (9 dmg)' },
  { id: 'cassia.branch.mid',   hero: 'cassia', tier: 2, cost: 6, type: 'branch', requires: ['cassia.sig.mid'],   label: 'Sentinel Fork', desc: 'FORK · MID: Cover also opens <b>Warded</b> (<span class="kw kw-guard">⛨</span> · <span class="kw kw-counter">↺1</span>) → <b>Sentinel Volley</b> (8 dmg)' },
  { id: 'cassia.branch.back',  hero: 'cassia', tier: 2, cost: 6, type: 'branch', requires: ['cassia.sig.back'],  label: 'Rampart Fork', desc: 'FORK · BACK: Thrown Shield also opens <b>Rampart</b> (<span class="kw kw-guard">⛨4</span>) → <b>Sentinel Volley</b> (8 dmg)' },
  { id: 'branwen.branch.front', hero: 'branwen', tier: 2, cost: 6, type: 'branch', requires: ['branwen.sig.front'], label: 'Mark Fork', desc: 'FORK · FRONT: Backstep Shot also opens <b>Hunter’s Mark</b> (<span class="kw kw-exposed">◎4</span> · slip) → <b>Marked Fate</b> (<span class="kw kw-exposed">◎4</span>)' },
  { id: 'branwen.branch.mid',   hero: 'branwen', tier: 2, cost: 6, type: 'branch', requires: ['branwen.sig.mid'],   label: 'Pierce Fork', desc: 'FORK · MID: Aimed Shot also opens <b>Called Shot</b> (<span class="kw kw-exposed">◎2</span>) → <b>Piercing Shot</b> (10 dmg)' },
  { id: 'branwen.branch.back',  hero: 'branwen', tier: 2, cost: 6, type: 'branch', requires: ['branwen.sig.back'],  label: 'Rain Fork',  desc: 'FORK · BACK: Marking Arrow also opens <b>Rapid Nock</b> (4 dmg) → <b>Volley Shot</b> (6 dmg · <span class="kw kw-exposed">◎2</span>)' },

  // ═══ EXECUTIONER — cashing the STAGGER.  Breaking a foe (hitting its weakness
  // twice in a turn) is always worth burst + PRESS-ON EP; but the free
  // Coup de Grâce that ENDS the reeling foe is a per-hero unlock.  Who on your
  // party can execute a break is part of the build. ══════════════════════════════
  // EXECUTIONER — every hero can cash a STAGGER, but each break lands in their OWN
  // voice: a hero-flavoured finisher forged into hand (still doubled vs the
  // staggered foe), plus, for some, an instant reaction that feeds their build.
  { id: 'ash.exec',     hero: 'ash',     tier: 2, cost: 7, type: 'execute', requires: ['ash.sig.front'], label: 'Executioner', desc: 'ON STAGGER: forge a free <b>Coup de Grâce</b> — 10 dmg, <b>doubled</b> vs staggered',
    stagger: { name: 'Coup de Grâce', target: 'enemy', fx: { dmg: 10 }, desc: '<b>10 damage</b> · <b>×2 vs STAGGERED</b>.' } },
  { id: 'elin.exec',    hero: 'elin',    tier: 2, cost: 7, type: 'execute', requires: ['elin.sig.front'], label: 'Executioner', desc: 'ON STAGGER: forge a free <b>Mercy’s End</b> (8 holy, doubled vs staggered) & the party heals <span class="kw kw-heal">✚3</span> — she mends as she ends',
    stagger: { name: 'Mercy’s End', target: 'enemy', fx: { dmg: 8 }, heal: 3, desc: '<b>8 holy</b> · <b>×2 vs STAGGERED</b>.' } },
  { id: 'mira.exec',    hero: 'mira',    tier: 2, cost: 7, type: 'execute', requires: ['mira.sig.back'], label: 'Executioner', desc: 'ON STAGGER: forge a free <b>Death Blossom</b> (7 dmg · <span class="kw kw-exposed">◎4</span>, doubled vs staggered) — paints the kill',
    stagger: { name: 'Death Blossom', target: 'enemy', fx: { dmg: 7, mark: 4 }, desc: '<b>7 damage</b> · <span class="kw kw-exposed">◎ EXPOSED 4</span> · <b>×2 vs STAGGERED</b>.' } },
  { id: 'cassia.exec',  hero: 'cassia',  tier: 2, cost: 7, type: 'execute', requires: ['cassia.sig.front'], label: 'Executioner', desc: 'ON STAGGER: forge a free <b>Wallbreaker</b> (8 dmg, doubled vs staggered) & Cassia gains <span class="kw kw-guard">⛨5</span> — the wall punishes & hardens',
    stagger: { name: 'Wallbreaker', target: 'frontmost', fx: { dmg: 8, guard: 5 }, desc: '<b>8 damage</b> · <b>×2 vs STAGGERED</b> · gain <span class="kw kw-guard">⛨5</span>.' } },
  { id: 'branwen.exec', hero: 'branwen', tier: 2, cost: 7, type: 'execute', requires: ['branwen.sig.mid'], label: 'Executioner', desc: 'ON STAGGER: forge a free <b>Marksman’s Finish</b> (10 dmg, doubled vs staggered) & refund <b>1 EP</b> — the hunt presses on',
    stagger: { name: 'Marksman’s Finish', target: 'enemy', fx: { dmg: 10 }, ep: 1, desc: '<b>10 damage</b> · <b>×2 vs STAGGERED</b>.' } },

  // ═══ AFTERIMAGE — earning the ECHO on the move.  Repositioning (the 1-EP dodge)
  // is always free; but the fading echo it leaves — the stance you left striking
  // once more, this turn only — is a per-hero unlock.  Turns stance-dancing into
  // an earned tempo tool. ═════════════════════════════════════════════════════════
  { id: 'ash.afterimage',     hero: 'ash',     tier: 2, cost: 4, type: 'afterimage', requires: ['ash.sig.mid'], label: 'Afterimage', desc: 'ON REPOSITION: the stance you left <b>strikes again</b> (free echo, −2 dmg, this turn) — a move OR a slip counts' },
  { id: 'elin.afterimage',    hero: 'elin',    tier: 2, cost: 4, type: 'afterimage', requires: ['elin.sig.mid'], label: 'Afterimage', desc: 'ON REPOSITION: the stance she left <b>strikes again</b> (free echo, −2 dmg, this turn)' },
  { id: 'mira.afterimage',    hero: 'mira',    tier: 2, cost: 4, type: 'afterimage', requires: ['mira.sig.front'], label: 'Afterimage', desc: 'ON REPOSITION: the stance she left <b>strikes again</b> (free echo, −2 dmg, this turn) — her slips & vanishes count' },
  { id: 'mira.passive.swiftfoot', hero: 'mira', tier: 2, cost: 6, type: 'passive', requires: ['mira.afterimage'], label: 'Swiftfoot', desc: 'PASSIVE: your <b>first MOVE each turn is FREE</b> (no EP) — slip in and out without paying the tempo, and feed the <b>echo</b>', passive: 'mira_swiftfoot' },
  { id: 'cassia.afterimage',  hero: 'cassia',  tier: 2, cost: 4, type: 'afterimage', requires: ['cassia.sig.mid'], label: 'Afterimage', desc: 'ON REPOSITION: the stance she left <b>strikes again</b> (free echo, −2 dmg, this turn)' },
  { id: 'branwen.afterimage', hero: 'branwen', tier: 2, cost: 4, type: 'afterimage', requires: ['branwen.sig.front'], label: 'Afterimage', desc: 'ON REPOSITION: the stance she left <b>strikes again</b> (free echo, −2 dmg, this turn) — her backstep leaves a parting arrow' },

  // ═══ ALL-OUT FINISHERS — an EARNED per-hero flourish on the marquee moment.
  // Ash (Rite of Endings) and Cassia (Fortress) already have theirs; these give
  // the other three an all-out identity too.  Each fires when the all-out ends,
  // in the hero's own voice.  Optional T3 leaves — the all-out still works
  // without them, but investing makes the climax express who you brought.
  { id: 'elin.allout.dawn',    hero: 'elin',    tier: 3, cost: 9,  type: 'allout', requires: ['elin.sig.mid'],  label: 'Radiant Dawn', desc: 'ALL-OUT END: the whole party heals <span class="kw kw-heal">✚5</span> & gains <span class="kw kw-guard">⛨3</span> — dawn after the storm', allout: 'dawn' },
  { id: 'mira.allout.dance',   hero: 'mira',    tier: 3, cost: 9,  type: 'allout', requires: ['mira.passive.opportunist'], label: 'Death Dance', desc: 'ALL-OUT END: every surviving foe is left <span class="kw kw-exposed">◎ EXPOSED 5</span> — marked for the kill-flow', allout: 'dance' },
  { id: 'branwen.allout.ruin', hero: 'branwen', tier: 3, cost: 10, type: 'allout', requires: ['branwen.sig.back'], label: 'Rain of Ruin', desc: 'ALL-OUT END: loose a <b>volley</b> on the whole line & refund <b>2 EP</b> — the sky goes dark with arrows', allout: 'ruin' },
  { id: 'hask.allout.zero',    hero: 'hask',    tier: 3, cost: 9,  type: 'allout', requires: ['hask.emergent.icicle'], label: 'Absolute Zero', desc: 'ALL-OUT END: the world freezes — <b>frost</b> on every foe, left deeply <span class="kw kw-chill">❄ CHILLED</span>, and Hask gathers <span class="kw kw-charge">◆ CHARGE 3</span> — the deep cold answers', allout: 'zero' },

  // ═══ KIZUNA — the TEAMWORK branch.  These nodes don't upgrade one hero; they
  // deepen the CHAIN itself — the free answer a woven partner plays off your
  // FINISHER.  Hosted on Ash (the Skirmisher who fights side-by-side), they modify
  // the party-wide bond system, so the more you weave, the more the Chain gives. ══
  { id: 'ash.chain.link',   hero: 'ash', tier: 2, cost: 6,  type: 'chain', requires: ['ash.sig.front'], label: 'Momentum Weave', desc: 'ON WEAVE: a partner’s woven strike builds <b>+8 MOMENTUM</b> — every woven answer feeds the burst' },
  { id: 'ash.chain.deep',   hero: 'ash', tier: 3, cost: 9,  type: 'chain', requires: ['ash.chain.link'], label: 'Empowered Bond', desc: 'PASSIVE: each woven bond empowers your <b>ALL-OUT</b> harder (<b>+10%</b> per bond) — deepened bonds strike as one' },
  { id: 'ash.chain.rising', hero: 'ash', tier: 3, cost: 9,  type: 'chain', requires: ['ash.chain.link'], label: 'Rising Weave',   desc: 'ON WEAVE: every woven strike this fight <b>swells the burst container</b> (+3) — the bond keeps building' },
  { id: 'ash.chain.react',  hero: 'ash', tier: 4, cost: 12, type: 'chain', requires: ['ash.chain.deep', 'ash.chain.rising'], label: 'Weave Cascade', desc: 'ON WEAVE: a woven strike is itself a FINISHER — the partner’s OTHER bond weaves in turn, so a full triad <b>cascades</b>' },

  // ═══ HASK — the BLACK MAGE.  Builds ◆ CHARGE on every spell; the MID fork is the
  // OVERLOAD line (build charge → dump it in a nuke).  Three job-paths: OVERLOAD
  // (Meltdown), FROST-CONTROL (Permafrost), and AETHER-SUSTAIN (Elemental Surge).
  { id: 'hask.sig.front', hero: 'hask', tier: 1, cost: 4, type: 'card', gate: { stance: 'front' }, label: 'Ice Spike',   desc: 'COMBO · FRONT: inserts <b>Ice Spike</b> (6 frost · <span class="kw kw-chill">❄</span>) · Frost Touch → <b>Ice Spike</b> → Shatter' },
  { id: 'hask.sig.mid',   hero: 'hask', tier: 1, cost: 5, type: 'card', gate: { stance: 'mid'   }, label: 'Kindle',      desc: 'COMBO · MID: inserts <b>Kindle</b> (5 frost) · Ice Bolt → <b>Kindle</b> → Frostfire' },
  { id: 'hask.sig.back',  hero: 'hask', tier: 1, cost: 4, type: 'card', gate: { stance: 'back'  }, label: 'Frost Lance', desc: 'COMBO · BACK: inserts <b>Frost Lance</b> (6 frost) · Deep Freeze → <b>Frost Lance</b> → Ice Shard' },
  { id: 'hask.afterimage', hero: 'hask', tier: 2, cost: 4, type: 'afterimage', requires: ['hask.sig.mid'], label: 'Afterimage', desc: 'ON REPOSITION: the stance he left <b>strikes again</b> (free echo, −2 dmg, this turn)' },

  { id: 'hask.branch.front', hero: 'hask', tier: 2, cost: 6, type: 'branch', requires: ['hask.sig.front'], label: 'Rime Fork',    desc: 'FORK · FRONT: Frost Touch also opens <b>Rime Blast</b> (4 · <span class="kw kw-chill">❄2</span>) → <b>Glacier</b> (8 · <span class="kw kw-chill">❄1</span>)' },
  { id: 'hask.branch.mid',   hero: 'hask', tier: 2, cost: 6, type: 'branch', requires: ['hask.sig.mid'],   label: 'Overload Fork', desc: 'FORK · MID: Ice Bolt also opens <b>Overcharge</b> (<span class="kw kw-charge">◆ CHARGE 2</span>) → <b>Overload</b> (SPEND <span class="kw kw-charge">◆ CHARGE</span>) — build, then unleash' },
  { id: 'hask.branch.back',  hero: 'hask', tier: 2, cost: 6, type: 'branch', requires: ['hask.sig.back'],  label: 'Cast Fork',     desc: 'FORK · BACK: Deep Freeze also opens <b>Waystone</b> → <b>Starfall</b> — BEGIN a cast that lands <b>◈ 16 frost NEXT turn</b> (moving breaks it)' },
  { id: 'hask.exec', hero: 'hask', tier: 2, cost: 7, type: 'execute', requires: ['hask.sig.mid'], label: 'Executioner', desc: 'ON STAGGER: forge a free <b>Killing Frost</b> — 8 frost · <span class="kw kw-chill">❄2</span> · <b>×2 vs STAGGERED</b>',
    stagger: { name: 'Killing Frost', target: 'enemy', fx: { dmg: 8, lull: 2 }, desc: '<b>8 frost</b> · <span class="kw kw-chill">❄ CHILL 2</span> · <b>×2 vs STAGGERED</b>.' } },
  { id: 'hask.passive.frostbite', hero: 'hask', tier: 2, cost: 6, type: 'passive', requires: ['hask.sig.front'], label: 'Frostbite', desc: 'PASSIVE: <b>+2 dmg</b> to any <span class="kw kw-chill">❄ CHILLED</span> foe — cash the frost', passive: 'hask_frostbite' },
  { id: 'hask.passive.kindling', hero: 'hask', tier: 2, cost: 6, type: 'passive', requires: ['hask.sig.mid'], label: 'Kindling', desc: 'ON CHILL: gain <span class="kw kw-charge">◆ CHARGE 1</span> — frost feeds the fire', passive: 'hask_kindling' },

  { id: 'hask.emergent.icicle', hero: 'hask', tier: 3, cost: 8, type: 'emergent', requires: ['hask.sig.back'], label: 'Ice Age',
    desc: 'EVERY 3RD SPELL: forge a free <b>Icicle</b> (6 frost · <span class="kw kw-chill">❄1</span>) — the cold never stops',
    emergent: { on: 'hit', every: 3, stance: 'FORGED · ICE', flash: 'The cold gathers — <b>Icicle</b> forged.',
      forge: { name: 'Icicle', cost: 0, target: 'enemy', fx: { dmg: 6, lull: 1 }, desc: '<b>6 frost</b> · <span class="kw kw-chill">❄ CHILL 1</span> to any foe.' } } },
  { id: 'hask.passive.conduit', hero: 'hask', tier: 3, cost: 8, type: 'passive', requires: ['hask.passive.kindling'], label: 'Conduit', desc: 'PASSIVE: your <span class="kw kw-charge">◆ CHARGE cap rises to 6</span> — hold more power', passive: 'hask_conduit' },
  { id: 'hask.passive.steady', hero: 'hask', tier: 3, cost: 8, type: 'passive', requires: ['hask.passive.frostbite'], label: 'Steady Cast', desc: 'PASSIVE: moving no longer breaks your channel — <span class="kw kw-charge">◆ CHARGE</span> survives and <b>no MISFIRE</b>. Channel on the move', passive: 'hask_steady' },
  { id: 'hask.passive.shatter', hero: 'hask', tier: 3, cost: 8, type: 'passive', requires: ['hask.passive.frostbite'], label: 'Shatterpoint', desc: 'ON HIT vs a <span class="kw kw-chill">❄ CHILLED</span> foe: <b>SHATTER the frost</b> — spend its <span class="kw kw-chill">❄ CHILL</span> for <b>+2 dmg per stack</b>, then clear it. Spend the cold, or hold it (Permafrost)', passive: 'hask_shatter' },

  { id: 'hask.passive.meltdown', hero: 'hask', tier: 4, cost: 12, type: 'passive', requires: ['hask.branch.mid'], label: 'Meltdown', desc: 'PASSIVE: <b>OVERLOAD</b> spends <span class="kw kw-charge">◆ CHARGE</span> for <b>+5</b> each (was +3) — total meltdown', passive: 'hask_meltdown' },
  { id: 'hask.synergy.permafrost', hero: 'hask', tier: 4, cost: 11, type: 'synergy', requires: ['hask.passive.frostbite'], label: 'Permafrost', desc: 'PASSIVE: <span class="kw kw-chill">❄ CHILLED</span> foes take <b>+3</b> from EVERY ally — the deep cold', passive: 'hask_permafrost' },
  { id: 'hask.passive.surge', hero: 'hask', tier: 4, cost: 12, type: 'passive', requires: ['hask.passive.conduit'], label: 'Elemental Surge', desc: 'ON OVERLOAD: spending <span class="kw kw-charge">◆ CHARGE</span> refunds <b>2 EP</b> — the aether rebounds', passive: 'hask_surge' },
  { id: 'hask.cast.meteor', hero: 'hask', tier: 4, cost: 12, type: 'passive', requires: ['hask.branch.back'], label: 'Cataclysm', desc: 'PASSIVE: your <b>◈ CASTS</b> land on <b>EVERY foe</b> — the sky falls, not a single star', passive: 'hask_meteor' },
  { id: 'hask.weave.astral', hero: 'hask', tier: 3, cost: 8, type: 'branch', requires: ['hask.sig.front'], label: 'Emberwake', desc: 'FORK · FRONT: Frost Touch also opens a FIRE line — <b>Ember Veil</b> → <b>Cinderfall</b>. Spells now swing <span class="kw kw-astral">🔥 PYRE</span> / <span class="kw kw-chill">❄ FROST</span> — Pyre empowers fire (+2/stack), Frost refills <span class="kw kw-charge">◆</span>' },
  { id: 'hask.weave.enochian', hero: 'hask', tier: 4, cost: 12, type: 'passive', requires: ['hask.weave.astral'], label: 'Backdraft', desc: 'PASSIVE: a spell cast <b>AGAINST</b> your element snaps to the far pole and <b>DETONATES</b> — <span class="kw kw-astral">🔥 +6</span> / <span class="kw kw-chill">❄ +4</span>. The weave rewards both', passive: 'hask_enochian' },
];
const NODE_BY_ID = {};
EMBER_TREE.forEach(n => { NODE_BY_ID[n.id] = n; });
// heroId -> stance -> gating nodeId (a hero's signature is hidden until unlocked)
const SIG_GATE = {};
EMBER_TREE.forEach(n => { if (n.type === 'card' && n.gate && n.gate.stance) { (SIG_GATE[n.hero] = SIG_GATE[n.hero] || {})[n.gate.stance] = n.id; } });
// is hero h's signature available in its current stance?  (ungated heroes: yes)
function sigUnlocked(h) {
  const g = SIG_GATE[h.id] && SIG_GATE[h.id][h.row];
  if (!g || hasNode(g)) return true;
  // STARTING SPARK (classic only — rotation heroes never reach here): the chosen
  // starter opens with their FRONT signature lit, WITHOUT owning a tree node, so
  // the descent's tree still starts empty.
  return h.row === 'front' && !!(RUN && RUN.roster && RUN.roster[0] === h.id);
}
// unlocked rider effects attached to a given (owner, card)
function ridersFor(ownerId, cardName) {
  return EMBER_TREE.filter(n => n.type === 'rider' && n.hero === ownerId && n.rider && n.rider.card === cardName && hasNode(n.id));
}
// ember reward for felling a foe — higher HEAT pays out more (risk → reward)
function emberReward(e) {
  // The descent runs one forward-only PATH now (no backtracking for extra kills),
  // so each kill pays MORE — a single road should still fund a growing rotation.
  const base = (e.def.floorBoss || e.def.boss) ? 13 : (e._elite ? 5 : 3);
  return Math.round(base * (1 + (META.heat || 0) * 0.25));
}
// ALT ALL-OUT (Rite of Endings): each all-out strike finishes a foe under 25% HP
function allOutExecutes(e) {
  return hasNode('ash.allout.execution') && e && !e.dead && e.hp > 0 && e.hp <= Math.ceil(e.maxHp * 0.25);
}
// a hero has just entered a new row — fire any unlocked positional passives
function onHeroEnterRow(hero, toRow, fromRow) {
  if (!hero || hero.downed || toRow === fromRow) return;
  // INTERRUPT + MISFIRE (Hask) — a caster who MOVES breaks their channel: they lose
  // their gathered ◆ CHARGE and any in-progress CAST, AND the loose aether detonates
  // INWARD for 2× the charge they were holding (guard soaks first).  The higher he
  // banked, the more it hurts — so hoarding charge in the danger row is a real gamble.
  // Steady Cast (channel on the move) exempts him from all of it.
  if (hero.id === 'hask' && !hasNode('hask.passive.steady')) {
    const ch = hero.charge || 0;
    if (ch) {
      hero.charge = 0;
      let left = ch * MISFIRE_PER_CHARGE;
      if (hero.guard > 0) { const g = Math.min(hero.guard, left); hero.guard -= g; left -= g; }
      if (left > 0) {
        hero.hp = Math.max(0, hero.hp - left);
        const big = left >= 8;
        popupAt(figEl(hero.id), '◆ MISFIRE −' + left, 'dmg' + (big ? ' popup-big' : ''));
        impactFx(figEl(hero.id), 'foe', big); struck(figEl(hero.id), 'l'); SFX.hit(big);
        if (big) stageShake('lg');
        if (hero.hp === 0 && !wardFall(hero)) { hero.downed = true; popupAt(figEl(hero.id), 'DOWN', 'dmg'); }
      } else {
        popupAt(figEl(hero.id), '◆ INTERRUPTED', 'chill');
      }
    }
    if (hero.pendingCast) { hero.pendingCast = null; popupAt(figEl(hero.id), '◈ CAST BROKEN', 'chill'); }
  }
  firePassives('enterRow', hero.id, { toRow, fromRow });
}
// FORCED REPOSITION — a foe's SHOVE ('back', away) or HOOK ('front', into reach)
// drives a hero one row over, swapping with whoever's there.  Returns the new row,
// or null if they were already at the edge.  Routes through onHeroEnterRow, so a
// charged Hask MISFIRES and any enter-row passives fire.
function applyShove(hero, dir) {
  if (!hero || hero.downed) return null;
  const order = ['front', 'mid', 'back'];
  const dest = order[order.indexOf(hero.row) + (dir === 'front' ? -1 : 1)];
  if (!dest) return null;
  const from = hero.row, occ = (typeof heroInRow === 'function') ? heroInRow(dest) : null;
  hero.row = dest; if (occ) occ.row = from;
  popupAt(figEl(hero.id), dir === 'front' ? '⇱ DRAGGED' : '⇲ SHOVED', 'dmg');
  S._morphHeroId = hero.id; if (occ) S._morphHeroId2 = occ.id;   // animate the swap
  onHeroEnterRow(hero, dest, from);
  if (occ) onHeroEnterRow(occ, from, dest);
  return dest;
}
// EMERGENT LOOPS — a kindled tier-3 node installs a per-fight counter that watches
// a hero repeat their archetypal act (strike / expose / heal / raise guard); on the
// Nth repeat it FORGES a signature temp card into that hero's hand.  This is how a
// hero's kit "grows over the run" — the more they play to type, the more their
// story-cards appear.  Data-driven (node.emergent), so no bespoke code per hero.
function emergentNodes(heroId) {
  return EMBER_TREE.filter(n => n.type === 'emergent' && n.hero === heroId && n.emergent && hasNode(n.id));
}
function fireEmergent(heroId, event, card) {
  // don't chain off an all-out burst, and don't let a forged temp card re-forge
  if (!heroId || typeof S === 'undefined' || !S || S._burstResolving) return;
  if (card && card.temp) return;
  const hero = S.heroes.find(h => h.id === heroId);
  if (!hero || hero.downed) return;
  const nodes = emergentNodes(heroId);
  if (!nodes.length) return;
  // the tally accrues across the WHOLE descent (on RUN, not the fight) so trash
  // fights feed the payoff — the loop genuinely grows over the run.
  const tally = (RUN && (RUN.emCount = RUN.emCount || {})) || (S._emCount = S._emCount || {});
  nodes.forEach(n => {
    if (n.emergent.on !== event) return;
    const c = (tally[n.id] = (tally[n.id] || 0) + 1);
    if (c % n.emergent.every !== 0) return;
    const f = n.emergent.forge;
    genTempCard({ kind: 'temp', owner: heroId, ownerName: hero.def.name, tint: hero.def.tint,
      stance: n.emergent.stance || 'FORGED', name: f.name, cost: f.cost || 0, target: f.target || 'enemy',
      school: (f.fx && f.fx.dmg) ? hero.def.school : null, fx: Object.assign({}, f.fx), desc: f.desc });
    popupAt(figEl(heroId), '✦ ' + f.name, 'rally');
    if (n.emergent.flash) flashNarrator(n.emergent.flash);
  });
}

// PASSIVES (Phase 2) — standing rules a kindled node installs, fired by game
// hooks.  Fully data-driven: a passive node carries `passive: '<id>'`, and the
// engine looks up PASSIVE_DEFS[id] at each hook.  A def declares a `trigger`
// and an `apply(ctx)` (side-effect) or, for damage tuning, `trigger:'dmgMod'`
// with `mod(owner, tgt) -> number`.  No bespoke wiring per node.
const PASSIVE_DEFS = {
  // ASH — TEMPO: motion is force, the duel never lets up
  ash_vanguard: { trigger: 'enterRow', apply: (c) => { if (c.toRow === 'front') { c.hero.guard += 3; popupAt(figEl(c.hero.id), '⛨ +3', 'guard'); } } },
  ash_exploit:  { trigger: 'dmgMod', mod: (o, t) => (o.id === 'ash' && t && frontmostEnemy() === t ? 3 : 0) },   // SPEARPOINT — Ash hits hardest at the tip of the line (tempo/position, not marks)
  hask_frostbite:  { trigger: 'dmgMod', mod: (o, t) => (t && t.lull ? 2 : 0) },   // Hask +2 to CHILLED foes
  hask_permafrost: { trigger: 'partyDmgMod', mod: (owner, tgt) => (tgt && tgt.lull ? 3 : 0) },        // CHILLED foes take +3 from EVERY ally
  // SHATTERPOINT — spend a foe's CHILL for burst (the mirror of Mira's mark→execute).
  // Consumes lull, so it competes with Permafrost/control builds → build diversity.
  hask_shatter: { trigger: 'postHit', apply: (c) => { const t = c.tgt; if (c.hero.id === 'hask' && t && !t.dead && t.lull) { const n = t.lull; t.lull = 0; dealToEnemy(t, n * 2, 'frost', 'hask'); popupAt(figEl(t.uid), '❄ SHATTER ' + (n * 2), 'dmg popup-big'); } } },
  ash_relentless: { trigger: 'followup', apply: (c) => { if (!S._flags.ashRefund) { S._flags.ashRefund = true; refundEp(1); } } },
  // ELIN — LIGHT: the ward finds the hurt
  elin_ward:    { trigger: 'turnStart', apply: (c) => { const t = lowestHpAlly(); if (t) { t.guard += 2; popupAt(figEl(t.id), '⛨ +2', 'guard'); } } },
  // MIRA — EXPOSED: never waste an opening; mark the dying
  mira_opportunist: { trigger: 'dmgMod', mod: (owner, tgt) => (tgt && tgt.mark ? 3 : 0) },
  mira_execute: { trigger: 'postHit', apply: (c) => { const t = c.tgt; if (t && !t.dead && t.hp > 0 && t.hp <= Math.ceil(t.maxHp * 0.30)) { popupAt(figEl(t.uid), '☠ DEATH MARK', 'dmg'); dealToEnemy(t, t.hp, c.hero.def.school, c.hero.id); } } },
  // CASSIA — GUARD: the wall is never caught flat, and only grows
  cassia_vigil: { trigger: 'turnStart', apply: (c) => { c.hero.guard += 2; popupAt(figEl(c.hero.id), '⛨ +2', 'guard'); } },
  cassia_immovable: { trigger: 'keepGuard' },   // read by endTurn's guard-reset
  // ── COMMON GROUND (Build 251).  Deliberately plain: these belong to nobody,
  // so they must read the same on every hero and lean on no one's kit.
  common_temper: { trigger: 'dmgMod', mod: () => 1 },
  common_keen:   { trigger: 'dmgMod', mod: (o, t) => (t && t.mark ? 2 : 0) },
  common_brace:  { trigger: 'turnStart', apply: (c) => { c.hero.guard += 2; popupAt(figEl(c.hero.id), '⛨ +2', 'guard'); } },
  common_wind:   { trigger: 'turnStart', apply: (c) => { const h = c.hero;
    if (h.hp > 0 && h.hp * 2 <= h.maxHp) { h.hp = Math.min(healCap(h), h.hp + 2); popupAt(figEl(h.id), '✚2', 'heal'); } } },
  // ── READ-AT-SITE passives (Build 250).  These five have no apply() because
  // their rule lives at one specific seam (a move's cost, a heal's cleanse, a
  // cast's charge).  They were the only tier-2 passives that could not be
  // taught, purely because isTeachable requires a PASSIVE_DEFS entry — and
  // every one of their call sites was already `hero id + hasNode`, the exact
  // shape heroOwnsNode replaces.  Declaring them here lets them cross; the
  // sites below decide what they do.
  ash_warstep:      { trigger: 'moveFree' },
  mira_swiftfoot:   { trigger: 'moveFree' },
  branwen_longshot: { trigger: 'pierce' },
  elin_mercy:       { trigger: 'cleanse' },
  hask_kindling:    { trigger: 'chargeOnCast' },
  // BASTION — the wall bites back: braces a counter each turn (CHILL immunity is
  // handled separately by heroResistsChill).  Turns a near-dead node into her
  // retaliation identity, pairing with Warded Aegis / counter builds.
  cassia_bastion: { trigger: 'turnStart', apply: (c) => { c.hero.counter = Math.max(c.hero.counter || 0, 1); popupAt(figEl(c.hero.id), '↺ REPRISAL', 'guard'); } },
  // LIVING BULWARK — guard→heal: a Cassia sitting on a deep wall shelters the line.
  // Gives her a sustain-tank build (bank guard high, passively mend) distinct from
  // Elin's active healing, and rewards the immovable/vigil guard-battery.
  cassia_shelter: { trigger: 'turnStart', apply: (c) => { if (c.hero.id === 'cassia' && (c.hero.guard || 0) >= 10) { const t = lowestHpAlly(); if (t && t.hp < t.maxHp) { t.hp = Math.min(healCap(t), t.hp + 4); popupAt(figEl(t.id), '✚4', 'heal'); if (SFX.heal) SFX.heal(); } } } },
  // BRANWEN — MARK: the hunt is always on, the tally comes due
  branwen_hunter: { trigger: 'dmgMod', mod: (owner, tgt) => (tgt && tgt.mark ? Math.min(4, tgt.mark) : 0) },   // scales with mark DEPTH — Branwen deepens the mark (Mira executes it)
  branwen_opening: { trigger: 'turnStart', apply: (c) => { if (c.hero.id !== 'branwen') return; const e = frontmostEnemy(); if (e) { e.mark = (e.mark || 0) + 1; popupAt(figEl(e.uid), '◎ +1', 'info'); } } },
  branwen_reckoning: { trigger: 'kill', apply: (c) => { if (c.tgt && c.tgt.mark && !S._flags.brRefund) { S._flags.brRefund = true; refundEp(1); } } },
  // ── COMBO-DEPTH capstones (see EMBER_TREE combo-depth block) ──
  // BLOODFRENZY — spend the marks for burst (an active mark-economy: hold them for
  // opportunist/execute, or DEVOUR them here), execute-scaled so it feeds on the wounded.
  mira_frenzy: { trigger: 'postHit', apply: (c) => { const t = c.tgt; if (c.hero.id === 'mira' && t && !t.dead && t.mark) { const n = t.mark; t.mark = 0; let dmg = n * 3; if (t.hp <= t.maxHp * 0.5) dmg *= 2; dealToEnemy(t, dmg, 'blade', 'mira'); popupAt(figEl(t.uid), '☠ DEVOUR ' + dmg, 'dmg popup-big'); } } },
  branwen_killingblow: { trigger: 'dmgMod', mod: (o, t) => (o.id === 'branwen' && t && t.hp > 0 && t.hp <= t.maxHp * 0.5 ? 4 : 0) },
  // ── TEAM SYNERGY (Phase 3) — a hero's kit pays off for the whole party ──
  ash_warcry:      { trigger: 'followup', apply: (c) => { const a = c.ally && S.heroes.find(h => h.id === c.ally); if (a && !a.downed) { a.buffDmg += 2; popupAt(figEl(a.id), '▲ RALLY +2', 'rally'); } } },
  elin_blessing:   { trigger: 'support', apply: (c) => { const r = c.receiver; if (r && !r.downed && r.id !== c.hero.id) { r.buffDmg += 2; popupAt(figEl(r.id), '▲ BLESSED +2', 'rally'); } } },
  mira_marked:     { trigger: 'partyDmgMod', mod: (owner, tgt) => (tgt && tgt.mark ? 2 : 0) },
  cassia_soak:     { trigger: 'mitigate' },   // read by the enemy-damage step (soakMitigation)
  branwen_cadence: { trigger: 'turnStart', apply: (c) => { if (c.hero.id !== 'branwen') return; if (!livingEnemies().some(e => e.mark)) return; livingHeroes().forEach(h => { h.buffDmg += 1; popupAt(figEl(h.id), '▲ +1', 'rally'); }); } },
};
function refundEp(n) {
  S.ep = Math.min(S.maxEp + 2, S.ep + n);
  pulseEp(); SFX.move();
  popupAt($('#ep-dial'), '+' + n + ' EP', 'rally');
}
function lowestHpAlly() {
  const live = livingHeroes(); if (!live.length) return null;
  return live.slice().sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
}
// a node whose effect is a PASSIVE_DEFS rule — passives + team-synergy nodes
function isPassiveNode(n) { return (n.type === 'passive' || n.type === 'synergy') && n.passive; }

// ─────────────────────────────────────────────────────────────────────────────
// THE WEAVE — per-run crossings between skill trees (Build 245)
//
// Six separate trees meant six separate corridors: the nodes were "not choices
// between kits, they are a purchase order for one kit", and every deep run with
// the same trio converged on the same cards.  A CROSSING lets one hero learn a
// technique standing in another hero's tree.
//
//     BONDS OPEN THE DOOR.  SHARED NATURE MAKES IT CHEAP.
//
// The gate is the bond between the two heroes — the thing this game is named
// after, and until now a reward you could not spend.  The PRICE is archetype
// kinship, read off the `school` and `tempo` axes already authored in HEROES:
// Mira and Branwen (both blade, both swift) trade at list price, while Cassia,
// who shares neither axis with anybody, still learns from a partner she has bled
// beside — she just pays the stranger's rate.  Nobody is topologically stranded,
// and the CHEAP crossings are the ones that read as obvious in fiction.
//
// Crossings are PER RUN: RUN.crossed dies with RUN.nodes, so this is a lattice
// you re-solve each descent, not a hundred-hour grid.
// THE GATE IS THE THREAD (Build 247).  This was a bare 3 — a threshold that sat
// BETWEEN the game's named bond states and therefore meant nothing in fiction:
// nothing happens at three points, so "♡ 2/3" asked the player to care about a
// number the story never mentions.  A crossing is now gated on the pair being
// WOVEN, the one state this game already dramatises — the narrator calls it, the
// victory screen prints it, the pair walks into battle connected because of it.
// You learn from someone you are BONDED to; that sentence is now literally the
// rule.  Scarcity comes from the teacher having to own the node and from the
// kinship price, not from an arbitrary extra point.
const CROSS_BOND = BOND_KINDLED;
// Measured: a crossing cost 18-21 embers ALL-IN (teacher's node + border stone +
// the crossing) against a run that earns ~136 total, and a greedy bot took ZERO
// across a whole floor. The same 21 embers bought FIVE rotation gates worth +8
// chain damage each, so the multiplier was not pricing a luxury — it was pricing
// the feature out of the game. Kinship still matters; it just no longer costs
// more than the thing it is competing with.
const CROSS_MULT = [1.0, 0.8, 0.6];   // indexed by shared axes: strangers · kin · twins
// how many archetype axes two heroes share (school, tempo) — 0, 1 or 2
function kinship(a, b) {
  const A = HEROES[a], B = HEROES[b];
  if (!A || !B || a === b) return 0;
  return (A.school === B.school ? 1 : 0) + (A.tempo === B.tempo ? 1 : 0);
}
// Common ground is priced flat — it is nobody's, so nobody's kinship applies.
function crossCost(learner, n) {
  if (!n) return 0;
  if (n.common) return n.cost;
  return Math.max(1, Math.round(n.cost * CROSS_MULT[kinship(learner, n.hero)]));
}
function crossedNodes(heroId) { return (RUN && RUN.crossed && RUN.crossed[heroId]) || []; }
function hasCrossed(heroId, nodeId) { return crossedNodes(heroId).indexOf(nodeId) >= 0; }
// Does THIS hero carry this node's rule — through their own tree, or learned
// across a bond?  Both passive dispatchers ask this instead of `n.hero === id`.
// the same question by node id, for the rules that are read at a single seam
function heroHas(heroId, nodeId) { return heroOwnsNode(heroId, NODE_BY_ID[nodeId]); }
function heroOwnsNode(heroId, n) {
  return !!n && ((n.hero === heroId && hasNode(n.id)) || hasCrossed(heroId, n.id));
}
// A node is TEACHABLE only if it is a standing rule that can belong to somebody
// else.  Riders and branches patch a NAMED card in a NAMED rotation, so they
// cannot travel — Ash has no Backstab to sharpen.  Nodes read through a bare
// hasNode() flag (Warstep, Swiftfoot, Kindling, Longshot, Mercy) cannot travel
// either: nothing dispatches them per hero, so the crossing would be a silent
// no-op, and a node that costs embers and does nothing is worse than no node.
// TIER 2 ONLY, deliberately — you can learn a colleague's TECHNIQUE, never their
// tier-3/4 soul.  That is the valve against the FFX endgame, where everybody
// eventually knows everything and nobody is anyone.
function isTeachable(n) {
  // baseTier, not tier: Build 290 ASSIGNS `tier` for pacing, so the literal that
  // used to pick out "a hero's mid-tree passives" now moves around. `baseTier` is
  // the authored intent and never changes — which is the whole reason it is kept.
  return !!(n && !n.common && n.baseTier === 2 && isPassiveNode(n) && PASSIVE_DEFS[n.passive]);
}
// every crossing this hero could buy right now
function crossOffersFor(learner) {
  if (!RUN || !learner) return [];
  const party = (RUN.active && RUN.active.length) ? RUN.active : (RUN.roster || []);
  if (party.indexOf(learner) < 0) return [];
  return EMBER_TREE.filter(n => isTeachable(n)
    && n.hero !== learner
    && party.indexOf(n.hero) >= 0                              // they must be HERE to teach it
    && hasNode(n.id)                                           // and must KNOW it — the node is earned twice
    && !hasCrossed(learner, n.id)
    && bondPts(pairKey(learner, n.hero)) >= CROSS_BOND
    && borderOpen(learner, n.hero))                            // cross the ground first
    .concat(COMMON_NODES.filter(n => n.pair.split('|').indexOf(learner) >= 0
      && n.pair.split('|').some(h => h !== learner && party.indexOf(h) >= 0)
      && !hasCrossed(learner, n.id)
      && bondPts(pairKey(learner, n.pair.split('|').find(h => h !== learner))) >= CROSS_BOND));
}
// Every crossing this hero COULD ever hold from the fielded party, with the
// reason each one is shut.  A lattice you can only see the OPEN doors of is not
// a lattice, it is a shop — the closed doorways, and what they are waiting on,
// are what make the screen something you can plan a route through.
function crossViewFor(learner) {
  if (!RUN || !learner) return [];
  const party = (RUN.active && RUN.active.length) ? RUN.active : (RUN.roster || []);
  if (party.indexOf(learner) < 0) return [];
  const out = [];
  // 1) the COMMON GROUND on each of your borders — nobody's nodes, and the
  //    crossover point: taking one is what opens the far side of that border.
  party.forEach(other => {
    if (other === learner) return;
    const bond = bondPts(pairKey(learner, other));
    commonOnBorder(learner, other).forEach(n => {
      let state;
      if (hasCrossed(learner, n.id)) state = 'crossed';
      else if (bond < CROSS_BOND) state = 'unbonded';
      else if (runEmbers() < n.cost) state = 'poor';
      else state = 'open';
      out.push({ node: n, state, cost: n.cost, bond, kin: kinship(learner, other),
                 teacher: other, common: true });
    });
  });
  // 2) the heroes' own techniques on the far side
  EMBER_TREE.forEach(n => {
    if (!isTeachable(n) || n.hero === learner || party.indexOf(n.hero) < 0) return;
    const bond = bondPts(pairKey(learner, n.hero)), cost = crossCost(learner, n);
    let state;
    if (hasCrossed(learner, n.id)) state = 'crossed';
    else if (!hasNode(n.id)) state = 'untaught';        // they cannot teach what they have not learned
    else if (bond < CROSS_BOND) state = 'unbonded';     // the door is there; the bond is not
    else if (!borderOpen(learner, n.hero)) state = 'unbridged';   // you have not set foot on the border
    else if (runEmbers() < cost) state = 'poor';
    else state = 'open';
    out.push({ node: n, state, cost, bond, kin: kinship(learner, n.hero), teacher: n.hero });
  });
  return out.sort((a, b) => (a.teacher + a.node.id) < (b.teacher + b.node.id) ? -1 : 1);
}
const KIN_WORD = ['DISTANT', 'KINDRED', 'TWINNED'];
function learnCrossing(learner, n) {
  if (!RUN || !learner || !n) return false;
  RUN.crossed = RUN.crossed || {};
  const list = RUN.crossed[learner] = RUN.crossed[learner] || [];
  if (list.indexOf(n.id) < 0) list.push(n.id);
  return true;
}

// unlocked passive/synergy nodes for a hero matching a trigger — by their own
// tree OR learned across a bond (Build 245)
function passiveNodesFor(heroId, trigger) {
  return EMBER_TREE.filter(n => isPassiveNode(n) && heroOwnsNode(heroId, n)
    && PASSIVE_DEFS[n.passive] && PASSIVE_DEFS[n.passive].trigger === trigger);
}
// fire all of a hero's owned side-effect passives for a trigger
function firePassives(trigger, heroId, ctx) {
  if (!heroId || typeof S === 'undefined' || !S) return;
  const hero = S.heroes.find(h => h.id === heroId);
  if (!hero || hero.downed) return;
  S._flags = S._flags || {};
  const c = Object.assign({ hero, heroId }, ctx || {});
  passiveNodesFor(heroId, trigger).forEach(n => {
    try { PASSIVE_DEFS[n.passive].apply(c); } catch (_) {}
  });
  // BOONS with the same trigger, gated to this hero (a duo boon fires when EITHER
  // of its heroes is the one acting).
  runBoons().forEach(b => { if ((b.hero === heroId || (b.heroes && b.heroes.indexOf(heroId) >= 0)) && b.trigger === trigger && b.apply) { try { b.apply(c); } catch (_) {} } });
}
// sum of damage-tuning passives against a target: the ATTACKER's own
// dmgMod exploiters, PLUS any living ally's party-wide synergy (partyDmgMod).
function passiveDmg(owner, tgt) {
  if (!owner) return 0;
  let bonus = 0;
  EMBER_TREE.forEach(n => {
    if (isPassiveNode(n) && heroOwnsNode(owner.id, n)) {
      const d = PASSIVE_DEFS[n.passive];
      if (d && d.trigger === 'dmgMod' && d.mod) bonus += d.mod(owner, tgt) || 0;
    }
  });
  // team synergy: a nodeholder anywhere in the LIVING party lifts everyone's hits
  livingHeroes().forEach(ph => {
    EMBER_TREE.forEach(n => {
      if (isPassiveNode(n) && heroOwnsNode(ph.id, n)) {
        const d = PASSIVE_DEFS[n.passive];
        if (d && d.trigger === 'partyDmgMod' && d.mod) bonus += d.mod(owner, tgt) || 0;
      }
    });
  });
  // BOON damage tuners (each gates itself by owner inside .mod)
  runBoons().forEach(b => { if (b.trigger === 'dmgMod' && b.mod) bonus += b.mod(owner, tgt) || 0; });
  return bonus;
}
// team mitigation: Cassia's Guardian's Aegis soaks for allies in rows behind her
function soakMitigation(h) {
  if (!h || !hasNode('cassia.synergy.soak')) return 0;
  const cassia = livingHeroes().find(x => x.id === 'cassia');
  if (!cassia || cassia.id === h.id) return 0;
  return (ROWS.indexOf(h.row) > ROWS.indexOf(cassia.row)) ? 2 : 0;
}
// does this hero keep their guard through the enemy turn? (Cassia's Immovable)
function keepsGuard(heroId) {
  return passiveNodesFor(heroId, 'keepGuard').length > 0;
}

// ---------------------------------------------------------------------------
// BOONS (the roguelite's mid-run randomness engine) — companion "gifts" you
// DRAFT 1-of-3 at elites, events, and the fire.  Each is tied to a hero and is
// only OFFERED / ACTIVE while that hero is in your party, so WHO you bring
// shapes the boon pool: party-as-draft and relic-as-draft reinforce each other.
// Boons reuse the same effect engine as passives/forges — a `card(c)` build-time
// mod and/or a hook `{ trigger, apply }` / `{ trigger:'dmgMod', mod }` — so there
// is no bespoke wiring per boon.  Stored on RUN.boons (per-descent, wiped on death).
// ---------------------------------------------------------------------------
const BOONS = [
  // ASH — tempo
  { id: 'ash_duelist', hero: 'ash', name: 'Duelist’s Focus', icon: '⚔', desc: 'Ash’s <b>signature</b> attacks strike for <b>+3</b>.',
    card: (c) => { if (c.owner === 'ash' && c.kind === 'sig' && c.fx && c.fx.dmg) c.fx.dmg += 3; } },
  { id: 'ash_tide', hero: 'ash', name: 'Rushing Tide', icon: '⇄', desc: 'Ash’s damaging cards cost <b>1 less</b> (min 1).',
    card: (c) => { if (c.owner === 'ash' && c.fx && c.fx.dmg && c.cost > 1) c.cost -= 1; } },
  { id: 'ash_relentless', hero: 'ash', name: 'Second Wind', icon: '↻', desc: 'Ash’s first <span class="kw kw-rally">ASSIST</span> each turn refunds <b>1 EP</b>.',
    trigger: 'followup', apply: () => { if (!S._flags.boonAsh) { S._flags.boonAsh = true; refundEp(1); boonProc('ash', 'ash_relentless'); } } },
  { id: 'ash_deepbond', hero: 'ash', name: 'Deepening Bond', icon: '✦', desc: 'When Ash <b>weaves in</b> off a partner, the whole party gains <span class="kw kw-rally">▲ RALLY 1</span> — the weave sharpens every blade.',
    trigger: 'chain', apply: () => { livingHeroes().forEach(h => { if (!h.downed) { h.buffDmg += 1; popupAt(figEl(h.id), '▲ +1', 'rally'); } }); boonProc('ash', 'ash_deepbond'); } },
  // ELIN — light
  { id: 'elin_grace', hero: 'elin', name: 'Elin’s Grace', icon: '✚', desc: 'When Elin heals or wards an ally, they also gain <span class="kw kw-guard">⛨ 1</span>.',
    trigger: 'support', apply: (c) => { if (c.receiver && !c.receiver.downed) { c.receiver.guard += 1; popupAt(figEl(c.receiver.id), '⛨ +1', 'guard'); boonProc('elin', 'elin_grace'); } } },
  { id: 'elin_warm', hero: 'elin', name: 'Warm Hands', icon: '❂', desc: 'Elin’s healing cards restore <b>+2</b>.',
    card: (c) => { if (c.owner === 'elin' && c.fx && c.fx.heal) c.fx.heal += 2; } },
  { id: 'elin_dawn', hero: 'elin', name: 'Dawnward', icon: '☀', desc: 'At the start of your turn, your most-wounded ally heals <span class="kw kw-heal">✚ 2</span>.',
    trigger: 'turnStart', apply: (c) => { if (c.hero.id !== 'elin') return; const t = lowestHpAlly(); if (t && t.hp < t.maxHp) { t.hp = Math.min(healCap(t), t.hp + 2); popupAt(figEl(t.id), '✚2', 'heal'); boonProc('elin', 'elin_dawn'); } } },
  // MIRA — exposed / execute
  { id: 'mira_scent', hero: 'mira', name: 'Bloodscent', icon: '◎', desc: 'Mira deals <b>+2</b> to any <span class="kw kw-exposed">◎ EXPOSED</span> foe.',
    trigger: 'dmgMod', mod: (o, t) => (o.id === 'mira' && t && t.mark ? 2 : 0) },
  { id: 'mira_patience', hero: 'mira', name: 'Killer’s Patience', icon: '☠', desc: 'The first <span class="kw kw-exposed">◎ EXPOSED</span> foe Mira kills each turn refunds <b>1 EP</b>.',
    trigger: 'kill', apply: (c) => { if (c.tgt && c.tgt.mark && !S._flags.boonMira) { S._flags.boonMira = true; refundEp(1); boonProc('mira', 'mira_patience'); } } },
  { id: 'mira_fang', hero: 'mira', name: 'Twin Fang', icon: '⚔', desc: 'Mira’s <b>signature</b> attacks strike for <b>+2</b>.',
    card: (c) => { if (c.owner === 'mira' && c.kind === 'sig' && c.fx && c.fx.dmg) c.fx.dmg += 2; } },
  { id: 'mira_rhythm', hero: 'mira', name: 'Reaper’s Rhythm', icon: '⚡', desc: 'When Mira fells a foe, gain <b>+8 MOMENTUM</b> — the kills feed the ALL-OUT.',
    trigger: 'kill', apply: () => { gainMomentum(8, { raw: true }); boonProc('mira', 'mira_rhythm', { quiet: true }); } },
  // CASSIA — guard
  { id: 'cassia_vigil', hero: 'cassia', name: 'Bulwark Heart', icon: '⛨', desc: 'At the start of your turn, Cassia braces for <span class="kw kw-guard">⛨ 2</span>.',
    trigger: 'turnStart', apply: (c) => { if (c.hero.id !== 'cassia') return; c.hero.guard += 2; popupAt(figEl(c.hero.id), '⛨ +2', 'guard'); boonProc('cassia', 'cassia_vigil', { quiet: true }); } },
  { id: 'cassia_iron', hero: 'cassia', name: 'Ironclad', icon: '◆', desc: 'Cassia’s guard-granting cards give <span class="kw kw-guard">⛨ +2</span>.',
    card: (c) => { if (c.owner === 'cassia' && c.fx && c.fx.guard) c.fx.guard += 2; } },
  { id: 'cassia_reprisal', hero: 'cassia', name: 'Iron Vengeance', icon: '◆', desc: 'While Cassia holds <span class="kw kw-guard">⛨ guard</span>, her strikes deal <b>+3</b> — the wall turns its weight outward.',
    trigger: 'dmgMod', mod: (o) => (o.id === 'cassia' && o.guard > 0 ? 3 : 0) },
  // BRANWEN — mark
  { id: 'branwen_deadeye', hero: 'branwen', name: 'Deadeye', icon: '◎', desc: 'Branwen’s marks land <b>+1</b> deeper <span class="kw kw-exposed">◎ EXPOSED</span>.',
    card: (c) => { if (c.owner === 'branwen' && c.fx && c.fx.mark) c.fx.mark += 1; } },
  { id: 'branwen_season', hero: 'branwen', name: 'Open Season', icon: '✦', desc: 'While Branwen stands with you, EVERY ally deals <b>+1</b> to <span class="kw kw-exposed">◎ EXPOSED</span> foes.',
    trigger: 'dmgMod', mod: (o, t) => (t && t.mark ? 1 : 0) },
  { id: 'branwen_bounty', hero: 'branwen', name: 'Hunter’s Bounty', icon: '☠', desc: 'The first <span class="kw kw-exposed">◎ EXPOSED</span> foe Branwen kills each turn refunds <b>1 EP</b>.',
    trigger: 'kill', apply: (c) => { if (c.tgt && c.tgt.mark && !S._flags.boonBran) { S._flags.boonBran = true; refundEp(1); boonProc('branwen', 'branwen_bounty'); } } },
  // HASK — frost / charge / weave
  { id: 'hask_deepcold', hero: 'hask', name: 'Deep Cold', icon: '❄', desc: 'Hask’s <span class="kw kw-chill">❄ CHILL</span> cards chill for <b>+1</b>.',
    card: (c) => { if (c.owner === 'hask' && c.fx && c.fx.lull) c.fx.lull += 1; } },
  { id: 'hask_emberheart', hero: 'hask', name: 'Emberheart', icon: '🔥', desc: 'Hask’s <span class="kw kw-astral">🔥 fire</span> spells strike for <b>+3</b>.',
    card: (c) => { if (c.owner === 'hask' && c.fx && c.fx.elem === 'fire' && c.fx.dmg) c.fx.dmg += 3; } },
  { id: 'hask_wellspring', hero: 'hask', name: 'Wellspring', icon: '◆', desc: 'At the start of your turn, Hask gains <span class="kw kw-charge">◆ CHARGE 1</span>.',
    trigger: 'turnStart', apply: (c) => { if (c.hero.id !== 'hask') return; c.hero.charge = Math.min(chargeCap(c.hero), (c.hero.charge || 0) + 1); popupAt(figEl('hask'), '◆ ' + c.hero.charge, 'info'); boonProc('hask', 'hask_wellspring', { quiet: true }); } },
  // ── DUO BOONS (Hades-style) — active only when BOTH heroes are fielded ──
  { id: 'duo_ashmira', duo: true, hero: 'ash', heroes: ['ash', 'mira'], name: 'Twin Shadows’ Edge', icon: '⚔', desc: '<b>Ash + Mira:</b> both strike <b>+3</b> to any <span class="kw kw-exposed">◎ EXPOSED</span> foe — the hunt and the tempo, as one.',
    trigger: 'dmgMod', mod: (o, t) => ((o.id === 'ash' || o.id === 'mira') && t && t.mark ? 3 : 0) },
  { id: 'duo_elincassia', duo: true, hero: 'elin', heroes: ['elin', 'cassia'], name: 'Blessed Bulwark', icon: '⛨', desc: '<b>Elin + Cassia:</b> at the start of your turn, the most-wounded ally gains <span class="kw kw-guard">⛨ 2</span> AND heals <span class="kw kw-heal">✚ 2</span>.',
    trigger: 'turnStart', apply: (c) => { if (c.hero.id !== 'cassia') return; const t = lowestHpAlly(); if (t && !t.downed) { t.guard += 2; if (t.hp < t.maxHp) t.hp = Math.min(healCap(t), t.hp + 2); popupAt(figEl(t.id), '⛨✚', 'guard'); boonProc('elin', 'duo_elincassia', { quiet: true }); } } },
  { id: 'duo_haskcassia', duo: true, hero: 'hask', heroes: ['hask', 'cassia'], name: 'Frostwall', icon: '❄', desc: '<b>Hask + Cassia:</b> <span class="kw kw-chill">❄ CHILLED</span> foes take <b>+2</b> from EVERY ally — the cold behind the wall.',
    trigger: 'dmgMod', mod: (o, t) => (t && t.lull ? 2 : 0) },
  { id: 'duo_branwenmira', duo: true, hero: 'branwen', heroes: ['branwen', 'mira'], name: 'Killer’s Pact', icon: '☠', desc: '<b>Branwen + Mira:</b> the FIRST <span class="kw kw-exposed">◎ EXPOSED</span> foe felled each turn refunds <b>2 EP</b>.',
    trigger: 'kill', apply: (c) => { if (c.tgt && c.tgt.mark && !S._flags.boonDuoBM) { S._flags.boonDuoBM = true; refundEp(2); boonProc('branwen', 'duo_branwenmira'); } } },
  // ── SCALING BOON (Hades build-up) — grows across the whole descent ──
  { id: 'scale_tally', hero: 'mira', name: 'Reaper’s Tally', icon: '☠', desc: 'Each <span class="kw kw-exposed">◎ EXPOSED</span> foe you fell adds <b>+1</b> (max 6) to your <b>signature</b> attacks — <b>for the whole descent</b>.',
    trigger: 'kill', apply: (c) => { if (c.tgt && c.tgt.mark) { bumpBoonStack('scale_tally', 6); boonProc('mira', 'scale_tally', { quiet: true }); } },
    card: (c) => { if (c.kind === 'sig' && c.fx && c.fx.dmg) c.fx.dmg += boonStack('scale_tally'); } },
  // ── RISK / REWARD (Slay-the-Spire relic tension) — power with a real cost ──
  { id: 'curse_glassedge', hero: 'mira', rare: true, curse: true, name: 'Glass Edge', icon: '⚡', desc: '<b>The whole party strikes +3</b> — but takes <b>+2</b> from every hit. Live fast.',
    card: (c) => { if (c.fx && c.fx.dmg) c.fx.dmg += 3; }, trigger: 'incoming', mod: () => 2 },
  { id: 'curse_bloodrush', hero: 'ash', rare: true, curse: true, name: 'Blood Rush', icon: '⇄', desc: 'Start each turn with <b>+2 EP</b> — but the most-wounded ally <b>bleeds 3 HP</b>. Spend it or waste it.',
    trigger: 'turnStart', apply: (c) => { if (c.hero.id !== 'ash' || S._flags.boonBlood) return; S._flags.boonBlood = true; S.ep = Math.min(S.maxEp, S.ep + 2); pulseEp(); const t = lowestHpAlly(); if (t && !t.downed) { t.hp = Math.max(1, t.hp - 3); popupAt(figEl(t.id), '−3', 'dmg'); } boonProc('ash', 'curse_bloodrush'); } },
  // ── CURSED GIFTS (Build 211) — power with a REAL tax.  One is seeded into
  //    every elite draft, so elites read as relic-tension, not free candy. ──
  { id: 'curse_hollowbargain', hero: 'hask', rare: true, curse: true, name: 'Hollow Bargain', icon: '✦', desc: 'Every kill pays <b>+2 embers</b> — but the fire refuses you: camps offer <b>no REST</b>. The fire owes the dark.',
    trigger: 'kill', apply: () => { addEmbers(2); S._embersRun = (S._embersRun || 0) + 2; boonProc('hask', 'curse_hollowbargain', { quiet: true }); } },
  { id: 'curse_feverblade', hero: 'mira', rare: true, curse: true, name: 'Feverblade', icon: '☠', desc: 'Mira’s blades strike <b>+4</b> — but the fever takes <b>2 HP</b> from her each turn. Burn bright, burn down.',
    card: (c) => { if (c.owner === 'mira' && c.fx && c.fx.dmg) c.fx.dmg += 4; },
    trigger: 'turnStart', apply: (c) => { if (c.hero.id !== 'mira' || S._flags.boonFever) return; S._flags.boonFever = true; const m = S.heroes.find(h => h.id === 'mira'); if (m && !m.downed) { m.hp = Math.max(1, m.hp - 2); popupAt(figEl('mira'), '−2', 'dmg'); boonProc('mira', 'curse_feverblade', { quiet: true }); } } },
  { id: 'curse_loudechoes', hero: 'branwen', rare: true, curse: true, name: 'Loud Echoes', icon: '♫', desc: 'Every kill <span class="kw kw-rally">▲ RALLIES</span> the whole party <b>+1</b> — but the song <b>cuts the singer for 2</b>. Every death sings.',
    trigger: 'kill', apply: (c) => { livingHeroes().forEach(h => { h.buffDmg += 1; }); popupAt(figEl(c.hero.id), '▲ ALL +1 · −2', 'rally'); const k = c.hero; if (k && !k.downed) k.hp = Math.max(1, k.hp - 2); boonProc('branwen', 'curse_loudechoes', { quiet: true }); } },
  { id: 'curse_mercyleak', hero: 'elin', rare: true, curse: true, name: 'Mercy’s Leak', icon: '✚', desc: 'Elin’s healing is <b>+3 stronger</b> — but mercy leaks: the frontmost foe <b>mends 2</b> each turn. Kindness feeds everything.',
    card: (c) => { if (c.owner === 'elin' && c.fx && c.fx.heal) c.fx.heal += 3; },
    trigger: 'turnStart', apply: (c) => { if (c.hero.id !== 'elin' || S._flags.boonLeak) return; S._flags.boonLeak = true; const e = frontmostEnemy(); if (e && !e.dead && e.hp < e.maxHp) { e.hp = Math.min(healCap(e), e.hp + 2); popupAt(figEl(e.uid), '✚2', 'heal'); boonProc('elin', 'curse_mercyleak', { quiet: true }); } } },
  // ── TRIO BOONS (Hades "you brought the exact team") — only when a SPECIFIC three
  //    walk together.  The rarest, most build-defining gifts. ──
  { id: 'trio_phalanx', trio: true, hero: 'cassia', heroes: ['ash', 'cassia', 'elin'], name: 'The Phalanx', icon: '⛨', desc: '<b>Ash · Cassia · Elin:</b> every fight OPENS with the whole party at <span class="kw kw-guard">⛨ 3</span> and <span class="kw kw-rally">▲ RALLY 2</span> — the shield-wall marches.',
    trigger: 'turnStart', apply: (c) => { if (c.hero.id !== 'cassia' || S.turn !== 1 || S._flags.boonPhalanx) return; S._flags.boonPhalanx = true; livingHeroes().forEach(h => { h.guard += 3; h.buffDmg += 2; popupAt(figEl(h.id), '⛨3 ▲2', 'guard'); }); boonProc('cassia', 'trio_phalanx'); } },
  { id: 'trio_killwind', trio: true, hero: 'mira', heroes: ['ash', 'mira', 'branwen'], name: 'The Killing Wind', icon: '☠', desc: '<b>Ash · Mira · Branwen:</b> EVERY ally strikes <b>+4</b> to <span class="kw kw-exposed">◎ EXPOSED</span> foes — three blades, one hunt.',
    trigger: 'dmgMod', mod: (o, t) => (t && t.mark ? 4 : 0) },
  { id: 'trio_longwinter', trio: true, hero: 'hask', heroes: ['elin', 'cassia', 'hask'], name: 'The Long Winter', icon: '❄', desc: '<b>Elin · Cassia · Hask:</b> <span class="kw kw-chill">❄ CHILLED</span> foes take <b>+3</b> from EVERY ally — the wall, the light, and the deep cold.',
    trigger: 'dmgMod', mod: (o, t) => (t && t.lull ? 3 : 0) },
  { id: 'trio_bloodmercy', trio: true, hero: 'elin', heroes: ['elin', 'mira', 'branwen'], name: 'Blood & Mercy', icon: '✚', desc: '<b>Elin · Mira · Branwen:</b> the FIRST <span class="kw kw-exposed">◎ EXPOSED</span> foe felled each turn <b>heals the whole party 3</b>.',
    trigger: 'kill', apply: (c) => { if (c.tgt && c.tgt.mark && !S._flags.trioBloodMercy) { S._flags.trioBloodMercy = true; livingHeroes().forEach(h => { if (h.hp < h.maxHp) { h.hp = Math.min(healCap(h), h.hp + 3); popupAt(figEl(h.id), '✚3', 'heal'); } }); boonProc('elin', 'trio_bloodmercy'); } } },
  // ── MORE DUO GIFTS — filling out the roster's pairings ──
  { id: 'duo_ashelin', duo: true, hero: 'elin', heroes: ['ash', 'elin'], name: 'Second Breath', icon: '✚', desc: '<b>Ash + Elin:</b> when Elin heals or wards an ally, that ally also gains <span class="kw kw-rally">▲ RALLY 1</span> — the mend feeds the next blow.',
    trigger: 'support', apply: (c) => { if (c.receiver && !c.receiver.downed) { c.receiver.buffDmg += 1; popupAt(figEl(c.receiver.id), '▲ +1', 'rally'); boonProc('elin', 'duo_ashelin', { quiet: true }); } } },
  { id: 'duo_mirahask', duo: true, hero: 'hask', heroes: ['mira', 'hask'], name: 'Killing Frost', icon: '❄', desc: '<b>Mira + Hask:</b> both strike <b>+2</b> to any <span class="kw kw-chill">❄ CHILLED</span> foe — the shiver before the knife.',
    trigger: 'dmgMod', mod: (o, t) => ((o.id === 'mira' || o.id === 'hask') && t && t.lull ? 2 : 0) },
  { id: 'duo_cassiabranwen', duo: true, hero: 'branwen', heroes: ['cassia', 'branwen'], name: 'Overwatch', icon: '◎', desc: '<b>Cassia + Branwen:</b> while Cassia holds <span class="kw kw-guard">⛨ guard</span>, Branwen strikes for <b>+3</b> — cover fire from behind the wall.',
    trigger: 'dmgMod', mod: (o) => { if (o.id !== 'branwen') return 0; const cas = livingHeroes().find(h => h.id === 'cassia'); return (cas && cas.guard > 0) ? 3 : 0; } },
  { id: 'duo_ashcassia', duo: true, hero: 'cassia', heroes: ['ash', 'cassia'], name: 'Vanguard’s Oath', icon: '⛨', desc: '<b>Ash + Cassia:</b> each of Ash’s <span class="kw kw-rally">ASSISTS</span> braces him for <span class="kw kw-guard">⛨ 2</span> — the wall’s discipline in the skirmish.',
    trigger: 'followup', apply: () => { const ash = livingHeroes().find(h => h.id === 'ash'); if (ash) { ash.guard += 2; popupAt(figEl('ash'), '⛨ +2', 'guard'); boonProc('cassia', 'duo_ashcassia', { quiet: true }); } } },
  { id: 'duo_elinhask', duo: true, hero: 'hask', heroes: ['elin', 'hask'], name: 'Warmth in Winter', icon: '◆', desc: '<b>Elin + Hask:</b> when Elin heals or wards an ally, Hask gathers <span class="kw kw-charge">◆ CHARGE 1</span> — her warmth stokes his cold fire.',
    trigger: 'support', apply: () => { const hask = livingHeroes().find(h => h.id === 'hask'); if (hask) { hask.charge = Math.min(chargeCap(hask), (hask.charge || 0) + 1); popupAt(figEl('hask'), '◆ ' + hask.charge, 'info'); boonProc('hask', 'duo_elinhask', { quiet: true }); } } },
  { id: 'duo_branwenhask', duo: true, hero: 'branwen', heroes: ['branwen', 'hask'], name: 'Frost & Feather', icon: '❄', desc: '<b>Branwen + Hask:</b> a <span class="kw kw-chill">❄ CHILLED</span> foe is also treated as <span class="kw kw-exposed">◎ EXPOSED</span> — cold marks the target for the arrow.',
    trigger: 'dmgMod', mod: (o, t) => (t && t.lull && !t.mark ? 2 : 0) },
];
const BOON_BY_ID = {}; BOONS.forEach(b => { BOON_BY_ID[b.id] = b; });
// BOON CODEX — which gifts you've ever COLLECTED, persisted across runs so the
// Journal fills in as you discover the roster's combos.
const BOON_CODEX_KEY = 'kizuna2_2.boonCodex';
function loadBoonCodex() { try { const a = JSON.parse(localStorage.getItem(BOON_CODEX_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (_) { return []; } }
function markBoonCollected(id) { try { const s = new Set(loadBoonCodex()); if (!s.has(id)) { s.add(id); localStorage.setItem(BOON_CODEX_KEY, JSON.stringify([...s])); } } catch (_) {} }
// BESTIARY CODEX — which foes you've faced, persisted across runs so the Journal's
// bestiary fills in as you meet the dark.  Marked when an enemy spawns into a fight.
const BESTIARY_KEY = 'kizuna2_2.bestiary';
function loadBestiary() { try { const a = JSON.parse(localStorage.getItem(BESTIARY_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (_) { return []; } }
function markEnemySeen(id) { if (!id) return; try { const s = new Set(loadBestiary()); if (!s.has(id)) { s.add(id); localStorage.setItem(BESTIARY_KEY, JSON.stringify([...s])); } } catch (_) {} }
// active boons: OWNED this descent AND their hero is currently fielded
// A boon is ACTIVE when its hero is fielded — or, for a DUO boon (Hades-style),
// when BOTH named heroes are fielded together.  So WHO you bring, and which
// PAIRS, shapes the emergent build.
function boonHeroesOk(b, party) {
  if (!b) return false;
  if (b.heroes) return b.heroes.every(h => party.indexOf(h) >= 0);
  return party.indexOf(b.hero) >= 0;
}
function runBoons() {
  if (typeof RUN === 'undefined' || !RUN || !Array.isArray(RUN.boons)) return [];
  const party = (RUN.active && RUN.active.length) ? RUN.active : RUN.roster || [];
  const held = RUN.boons.map(id => BOON_BY_ID[id]).filter(b => boonHeroesOk(b, party));
  // DUET PERKS (Build 223) ride the same dispatch: dmgMod, incoming, kill,
  // turnStart and card seams all see them with zero extra plumbing.
  return (typeof S !== 'undefined' && S) ? held.concat(duetPerkBoons()) : held;
}
// Per-descent SCALING boons (Hades-style build-up): a running tally that grows on
// a countable event and feeds a card/damage mod.  Stored on RUN so it persists.
function boonStack(id) { return (typeof RUN !== 'undefined' && RUN && RUN.boonStacks && RUN.boonStacks[id]) || 0; }
function bumpBoonStack(id, cap) { if (!RUN) return; RUN.boonStacks = RUN.boonStacks || {}; RUN.boonStacks[id] = Math.min(cap || 99, (RUN.boonStacks[id] || 0) + 1); saveRun(); }
// Incoming-damage tuners (risk/reward boons that make you hit harder but take more).
function boonIncoming(hero) { let d = 0; runBoons().forEach(b => { if (b.trigger === 'incoming' && b.mod) d += b.mod(hero) || 0; }); return d; }
// held boons as a compact icon strip in the combat topbar
function renderCombatBoons() {
  const el = document.getElementById('combat-boons'); if (!el) return;
  const boons = runBoons().filter(b => !b.perk);
  let html = boons.map(b => `<span class="cb-boon" data-boon="${b.id}" style="--tint:${HEROES[b.hero].tint}" title="${HEROES[b.hero].name}’s ${b.name} — ${b.desc.replace(/<[^>]+>/g, '')}">${b.icon}</span>`).join('');
  // live DUET PERKS — one chip per bonded pair, tinted by the pairing
  html += duetPerkBoons().map(d => {
    const [a, b] = d.pairKey.split('|');
    return `<span class="cb-duet" data-duet="${d.pairKey}" style="--tint:${HEROES[a].tint}" title="♡ ${d.name} — ${HEROES[a].name} &amp; ${HEROES[b].name}: ${d.desc.replace(/<[^>]+>/g, '')}">${d.icon}</span>`;
  }).join('');
  // active BOND WEAVES this fight — a distinct gold chip per woven pair
  const weaves = wovenPairKeys();
  html += weaves.map(key => {
    const [a, b] = key.split('|'); const w = BOND_WEAVE[duetClassKey(a, b)]; if (!w) return '';
    return `<span class="cb-weave" data-weave="${key}" title="✦ ${w.name} — ${HEROES[a].name} &amp; ${HEROES[b].name} are woven: play a FINISHER with one and the other weaves in a free strike (once per turn).">${w.icon || '✦'}</span>`;
  }).join('');
  el.innerHTML = html;
  el.querySelectorAll('.cb-boon').forEach(c => attachBoonInspect(c, c.dataset.boon));
  el.classList.toggle('hidden', !html);
}
// INSPECT a boon (StS-style) — press & hold (touch) or hover (mouse) any held
// boon icon to read its full gift.  A floating panel, dismissed on release.
let _boonInspectEl = null, _boonHoldT = null;
function showBoonInspect(boonId, anchor) {
  hideBoonInspect();
  const b = BOON_BY_ID[boonId]; if (!b || !anchor) return;
  const el = document.createElement('div');
  el.id = 'boon-inspect';
  el.style.setProperty('--tint', HEROES[b.hero].tint);
  el.innerHTML = `<span class="bi-icon">${b.icon}</span><span class="bi-from">${HEROES[b.hero].name}’S GIFT</span><span class="bi-name">${b.name}</span><span class="bi-desc">${b.desc}</span>`;
  document.body.appendChild(el);
  const r = anchor.getBoundingClientRect(), bw = el.offsetWidth, bh = el.offsetHeight;
  let x = r.left + r.width / 2 - bw / 2;
  let y = (r.bottom + 10 + bh <= window.innerHeight) ? r.bottom + 10 : r.top - bh - 10;   // below if room, else above
  x = Math.max(6, Math.min(x, window.innerWidth - bw - 6));
  y = Math.max(6, Math.min(y, window.innerHeight - bh - 6));
  el.style.left = x + 'px'; el.style.top = y + 'px';
  requestAnimationFrame(() => el.classList.add('bi-show'));
  _boonInspectEl = el;
}
function hideBoonInspect() {
  if (_boonHoldT) { clearTimeout(_boonHoldT); _boonHoldT = null; }
  if (_boonInspectEl) { _boonInspectEl.remove(); _boonInspectEl = null; }
}
function attachBoonInspect(el, boonId) {
  if (!el || el._boonWired) return; el._boonWired = true;
  el.style.cursor = 'pointer';
  el.addEventListener('pointerdown', () => { _boonHoldT = setTimeout(() => showBoonInspect(boonId, el), 240); });
  el.addEventListener('pointerup', () => { clearTimeout(_boonHoldT); _boonHoldT = null; setTimeout(hideBoonInspect, 40); });
  el.addEventListener('pointercancel', hideBoonInspect);
  el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') showBoonInspect(boonId, el); });
  el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hideBoonInspect(); });
}
// FEEDBACK when a boon fires — a chip pulse in the topbar, and (for discrete
// procs) a labelled pop over the hero, so gifts are FELT the moment they trigger.
// FEEDBACK when a boon fires — a chip pulse in the topbar, and (for discrete
// procs) a labelled pop over the hero, so gifts are FELT the moment they trigger.
function boonProc(heroId, boonId, opts) {
  const b = BOON_BY_ID[boonId]; if (!b) return;
  if (!(opts && opts.quiet)) { try { popupAt(figEl(heroId), '✦ ' + b.name.toUpperCase(), 'boon'); } catch (_) {} }
  const el = document.getElementById('combat-boons');
  const chip = el && el.querySelector(`[data-boon="${boonId}"]`);
  if (chip) { chip.classList.remove('cb-proc'); void chip.offsetWidth; chip.classList.add('cb-proc'); }
}

// IN-RUN FORGING — the temporary (per-descent) ember sink.  At a campfire you
// spend embers to TEMPER the whole kit for the rest of the run; the tempers
// reset next descent.  Each is applied to every card at build time (mkCard).
const FORGE_OFFERS = [
  { id: 'whetstone', cost: 5, label: 'WHETSTONE', desc: 'Every attack strikes for +1 for the rest of this descent.', apply: (c) => { if (c.fx && c.fx.dmg) c.fx.dmg += 1; } },
  { id: 'quicken',   cost: 6, label: 'QUICKENING', desc: 'Your signature cards cost 1 less for the rest of this descent.', apply: (c) => { if (c.kind === 'sig' && c.cost > 0) c.cost -= 1; } },
  { id: 'hexedge',   cost: 6, label: 'HEXED EDGE', desc: 'Your CORE attacks also inflict ◎ EXPOSED 1 for the rest of this descent.', apply: (c) => { if (c.kind === 'core' && c.fx && c.fx.dmg) c.fx.mark = (c.fx.mark || 0) + 1; } },
];
const FORGE_BY_ID = {};
FORGE_OFFERS.forEach(f => { FORGE_BY_ID[f.id] = f; });
function runForges() { return (typeof RUN !== 'undefined' && RUN && Array.isArray(RUN.forges)) ? RUN.forges : []; }

// ---------------------------------------------------------------------------
// SFX — tiny synthesized cues (no assets).  Volumes stay low; every cue is a
// short envelope so rapid plays never smear.  Context wakes on first gesture.
// ---------------------------------------------------------------------------
// ── SFX — a darker, weightier palette to match the ThornCrown / ember-and-frost
// tone.  Impacts are FILTERED NOISE with a low sine body (not thin beeps); steel
// and parries ring through a bandpass; bonds and kills bloom into a small synth
// REVERB.  Every sound is a `voice()` (oscillator OR noise → filter → gain →
// master, with an optional reverb send). ──
const SFX = (() => {
  let ctx = null, master = null, reverb = null;
  const ac = () => {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain(); master.gain.value = 0.85; master.connect(ctx.destination);
        // a small dark hall (synth impulse) so ethereal sounds have space
        reverb = ctx.createConvolver();
        const len = Math.floor(ctx.sampleRate * 1.5), buf = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.8); }
        reverb.buffer = buf;
        const rg = ctx.createGain(); rg.gain.value = 0.55; reverb.connect(rg).connect(master);
        reverb._send = rg;
      } catch (_) { ctx = null; }
    }
    return ctx;
  };
  document.addEventListener('pointerdown', () => { const c = ac(); if (c && c.state === 'suspended') c.resume(); try { ensureHaptic(); } catch (_) {} }, { capture: true });
  function voice(o) {
    if (!SETTINGS.sound) return;
    const c = ac(); if (!c || c.state !== 'running') return;
    const dur = o.dur || 0.15, vol = o.vol || 0.05, t0 = c.currentTime + (o.delay || 0);
    let node;
    if (o.src === 'noise') {
      const n = Math.max(1, Math.floor(c.sampleRate * (dur + 0.05)));
      const b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      node = c.createBufferSource(); node.buffer = b;
    } else {
      node = c.createOscillator(); node.type = o.src || 'sine';
      node.frequency.setValueAtTime(o.freq || 220, t0);
      if (o.slideTo) node.frequency.exponentialRampToValueAtTime(Math.max(1, o.slideTo), t0 + dur);
    }
    let chain = node;
    if (o.filter) {
      const bq = c.createBiquadFilter(); bq.type = o.filter; bq.Q.value = o.q || 1;
      bq.frequency.setValueAtTime(o.fFreq || 1000, t0);
      if (o.fSlide) bq.frequency.exponentialRampToValueAtTime(Math.max(20, o.fSlide), t0 + dur);
      chain.connect(bq); chain = bq;
    }
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + (o.attack || 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    chain.connect(g); g.connect(master);
    if (o.rev && reverb && reverb._send) { const rs = c.createGain(); rs.gain.value = o.rev; g.connect(rs); rs.connect(reverb); }
    node.start(t0); node.stop(t0 + dur + 0.06);
  }
  const v = (o) => voice(o);
  return {
    card:    () => { v({ src: 'noise', dur: 0.09, vol: 0.03, filter: 'lowpass', fFreq: 1500, fSlide: 500 }); v({ src: 'triangle', freq: 190, dur: 0.1, vol: 0.03, slideTo: 130 }); },
    move:    () => v({ src: 'noise', dur: 0.11, vol: 0.03, filter: 'lowpass', fFreq: 700, fSlide: 280 }),
    hit:     (big) => { v({ src: 'noise', dur: big ? 0.18 : 0.1, vol: big ? 0.09 : 0.06, filter: 'lowpass', fFreq: big ? 1300 : 1900, fSlide: big ? 200 : 420 }); v({ src: 'sine', freq: big ? 70 : 110, dur: big ? 0.26 : 0.14, vol: big ? 0.09 : 0.06, slideTo: big ? 40 : 60 }); },
    kill:    () => { v({ src: 'sine', freq: 130, dur: 0.55, vol: 0.07, slideTo: 44, rev: 0.5 }); v({ src: 'noise', dur: 0.32, vol: 0.05, filter: 'lowpass', fFreq: 900, fSlide: 140 }); v({ src: 'sawtooth', freq: 82, dur: 0.4, vol: 0.035, slideTo: 36, delay: 0.03, filter: 'lowpass', fFreq: 600 }); },
    heal:    () => { v({ src: 'sine', freq: 523, dur: 0.42, vol: 0.04, filter: 'lowpass', fFreq: 2400, rev: 0.35, attack: 0.05 }); v({ src: 'sine', freq: 784, dur: 0.5, vol: 0.028, delay: 0.08, rev: 0.35, attack: 0.05 }); },
    guard:   () => { v({ src: 'noise', dur: 0.08, vol: 0.05, filter: 'bandpass', fFreq: 2600, q: 3.5 }); v({ src: 'triangle', freq: 230, dur: 0.11, vol: 0.04, slideTo: 175 }); },
    thread:  () => { v({ src: 'sine', freq: 392, dur: 0.6, vol: 0.04, rev: 0.5, attack: 0.06 }); v({ src: 'sine', freq: 588, dur: 0.7, vol: 0.03, delay: 0.1, rev: 0.5, attack: 0.06 }); },
    // TRIAD — a bonded chord blooming into the hall
    triad:   () => { [392, 494, 588, 784].forEach((f, i) => v({ src: 'sine', freq: f, dur: 0.9, vol: 0.038, delay: i * 0.08, rev: 0.6, attack: 0.05 })); },
    // KINDLE — an ember catches: a noise spark, then a warm rising chord
    kindle:  () => { v({ src: 'noise', dur: 0.1, vol: 0.04, filter: 'highpass', fFreq: 1400 }); [330, 415, 494, 659].forEach((f, i) => v({ src: 'triangle', freq: f, dur: 0.5, vol: 0.038, delay: 0.1 + i * 0.07, filter: 'lowpass', fFreq: 3000, rev: 0.3 })); v({ src: 'sine', freq: 988, dur: 0.6, vol: 0.03, delay: 0.42, rev: 0.45 }); },
    victory: () => { [392, 494, 587].forEach((f, i) => v({ src: 'triangle', freq: f, dur: 0.5, vol: 0.045, delay: i * 0.12, filter: 'lowpass', fFreq: 2600, rev: 0.45 })); v({ src: 'sine', freq: 784, dur: 0.8, vol: 0.03, delay: 0.36, rev: 0.5 }); },
    // ENEMY wind-up — a low menacing growl
    enemy:   () => { v({ src: 'sawtooth', freq: 115, dur: 0.16, vol: 0.045, slideTo: 68, filter: 'lowpass', fFreq: 780 }); v({ src: 'noise', dur: 0.14, vol: 0.028, filter: 'lowpass', fFreq: 480 }); },
    follow:  () => { v({ src: 'triangle', freq: 440, dur: 0.07, vol: 0.045, filter: 'lowpass', fFreq: 2400 }); v({ src: 'triangle', freq: 660, dur: 0.09, vol: 0.045, delay: 0.06, filter: 'lowpass', fFreq: 2800 }); },
    deny:    () => { v({ src: 'square', freq: 130, dur: 0.1, vol: 0.045, slideTo: 88, filter: 'lowpass', fFreq: 620 }); v({ src: 'noise', dur: 0.08, vol: 0.02, filter: 'lowpass', fFreq: 380 }); },
    // PARRY — a metallic ring that BRIGHTENS with the streak; a perfect blooms an overtone
    parry:   (perfect, streak) => { const b = 1500 + Math.min(8, streak || 0) * 120; v({ src: 'noise', dur: 0.06, vol: 0.05, filter: 'bandpass', fFreq: b, q: 7 }); v({ src: 'triangle', freq: b / 2, dur: 0.05, vol: 0.03 }); if (perfect) v({ src: 'sine', freq: b * 1.5, dur: 0.28, vol: 0.04, delay: 0.02, rev: 0.55 }); },
    parryMiss: () => { v({ src: 'sawtooth', freq: 150, dur: 0.14, vol: 0.045, slideTo: 78, filter: 'lowpass', fFreq: 680 }); v({ src: 'noise', dur: 0.1, vol: 0.03, filter: 'lowpass', fFreq: 480 }); },
    // SWOOSH — a blade cutting air
    swoosh:  () => v({ src: 'noise', dur: 0.16, vol: 0.04, filter: 'bandpass', fFreq: 1100, q: 1.4, fSlide: 3600 }),
    // BRACE — a heavy, grounded set
    brace:   () => { v({ src: 'square', freq: 120, dur: 0.18, vol: 0.05, filter: 'lowpass', fFreq: 480 }); v({ src: 'sine', freq: 58, dur: 0.22, vol: 0.045 }); },
    hitstop: () => v({ src: 'sine', freq: 52, dur: 0.06, vol: 0.05 }),
  };
})();

// HAPTICS — physical feedback for gestures on devices that support it (mobile).
// Distinct pulse patterns per event so a tap, a hold, a swipe and a perfect all
// FEEL different in the hand.  No-op on desktop.
const HAP = {
  tap:      [10],
  perfect:  [10, 22, 14],
  good:     [12],
  miss:     [34],
  press:    [16],
  swipe:    [8, 16, 8],
  play:     [7],
  struck:   [26],
  burst:    [16, 30, 16, 30, 24],
};
// iOS Safari has NO Vibration API — the only web haptic there is the switch
// trick: programmatically toggling a hidden <input switch> fires a system tap
// (iOS 17.4+).  Use navigator.vibrate where it exists (Android) and fall back
// to the switch elsewhere so presses/taps are FELT on iPhone too.
let _hapLabel = null, _hapInput = null;
function ensureHaptic() {
  if (_hapLabel || typeof document === 'undefined' || !document.body) return;
  const l = document.createElement('label');
  l.setAttribute('aria-hidden', 'true');
  // rendered (not display:none) but out of the way — hidden elements don't tap.
  l.style.cssText = 'position:fixed;bottom:2px;right:2px;width:6px;height:6px;opacity:0.001;pointer-events:none;z-index:-1;';
  const i = document.createElement('input');
  i.type = 'checkbox'; i.setAttribute('switch', ''); i.tabIndex = -1;
  l.appendChild(i); document.body.appendChild(l);
  _hapLabel = l; _hapInput = i;
}
function haptic(p) {
  if (!SETTINGS.haptics) return;
  let vibrated = false;
  try { if (navigator.vibrate) vibrated = navigator.vibrate(p); } catch (_) {}
  // iOS fallback: click the LABEL (this toggles the switch and fires a system
  // tap on iOS 17.4+).  Do NOT pre-toggle checked — the click does the toggle.
  if (!vibrated) { try { ensureHaptic(); if (_hapLabel) _hapLabel.click(); } catch (_) {} }
}

// ---------------------------------------------------------------------------
// DATA — heroes.
// ---------------------------------------------------------------------------
const ROWS = ['front', 'mid', 'back'];
// Schools — every hero's attacks carry their element; every enemy hides a
// weakness (revealed the first time it takes damage).  Weakness hit ->
// WEAKENED ⌖; second weakness hit the SAME TURN -> STAGGERED ⚡ (+1 EP,
// once per turn); the next hit on a staggered enemy deals ×2.  A staggered
// enemy whose turn comes up on a HEAVY intent is INTERRUPTED.
const SCHOOL_GLYPH = { blade: '⚔', light: '✦', song: '♫', iron: '◆', frost: '❅' };
const ROW_LABEL = { front: 'FRONT', mid: 'MID', back: 'BACK' };
// POSITION, plainly (Build 313). Where a hero stands had THREE naming layers:
// FRONT/MID/BACK, a fantasy coat ('Blade Stance' / 'Flow Stance' / 'Wind
// Stance'), and each hero's per-line flavour words on top — and 'Flow Stance'
// even collided with Ash's FLOW line. The location is now just its name; the
// flavour words stay where they belong, on the PLAYSTYLE each line expresses.
const STANCE = {
  front: { name: 'Front', tag: 'AGGRESSIVE' },
  mid:   { name: 'Mid',   tag: 'BALANCED' },
  back:  { name: 'Back',  tag: 'RANGED' },
};

const HEROES = {
  ash: {
    school: 'blade', tempo: 'steady', name: 'ASH', cls: 'Ronin', archetype: 'Skirmisher', identity: 'Strikes and slips — repositions as he attacks.', tint: 'var(--ash-tint)', maxHp: 32,
    cards: {
      front: {
        core: { name: 'Cleave',        cost: 1, target: 'frontmost', fx: { dmg: 6 },            desc: '6 damage to the nearest enemy.' },
        sig:  { name: 'Crashing Wave', cost: 2, target: 'frontmost', fx: { dmg: 11 },           desc: '11 damage to the nearest enemy.' },
      },
      mid: {
        core: { name: 'Flowing Cut',   cost: 1, target: 'frontmost', fx: { dmg: 4, guard: 3 },  desc: '4 damage · gain 3 guard.' },
        sig:  { name: 'Crossguard',    cost: 2, target: 'ally',      fx: { guard: 6 }, desc: 'Guard an ally: <span class="kw kw-guard">⛨ 6</span>.' },
      },
      back: {
        core: { name: 'Thrown Edge',   cost: 1, target: 'enemy',     fx: { dmg: 4, step: 'front' }, desc: '4 damage to ANY enemy, then close to FRONT.' },
        sig:  { name: 'Marked Fate',   cost: 1, target: 'enemy',     fx: { dmg: 3, mark: 4 },   desc: '3 damage · <span class="kw kw-exposed">◎ EXPOSED 4</span>: +4 from EVERY hit. Fades by 1 each turn.' },
      },
    },
  },
  elin: {
    school: 'light', tempo: 'steady', name: 'ELIN', cls: 'Cleric', archetype: 'Warden of the Light', identity: 'Holds the line with light — wards and smites, and mends on the way.', tint: 'var(--elin-tint)', maxHp: 24,
    cards: {
      front: {
        core: { name: 'Smite',         cost: 1, target: 'frontmost', fx: { dmg: 5 },            desc: '5 holy damage to the nearest enemy.' },
        sig:  { name: 'Radiant Ward',  cost: 2, target: 'allies',    fx: { guard: 3, smite: 3 }, desc: 'Every ally gains 3 guard · <b>3 holy</b> to the nearest foe.' },
      },
      mid: {
        core: { name: 'Mend',          cost: 1, target: 'ally',      fx: { heal: 3, smite: 4 }, desc: 'Heal an ally 3 · <b>4 holy</b> to the nearest foe.' },
        sig:  { name: 'Sanctuary',     cost: 2, target: 'ally',      fx: { heal: 2, guard: 6 }, desc: 'Heal an ally 2 · they gain 6 guard.' },
      },
      back: {
        core: { name: 'Distant Prayer',cost: 1, target: 'allies',    fx: { heal: 1, smite: 3 }, desc: 'Heal every ally 1 · <b>3 holy</b> to the nearest foe.' },
        sig:  { name: 'Benediction',   cost: 2, target: 'ally',      fx: { heal: 4, smite: 5 }, desc: 'Heal an ally 4 · <b>5 holy</b> to the nearest foe.' },
      },
    },
  },
  kiki: {
    school: 'song', tempo: 'swift', name: 'KIKI', cls: 'Bard', archetype: 'Herald', identity: 'Rallies allies and chills foes — cheap, swift.', tint: 'var(--kiki-tint)', maxHp: 20,
    cards: {
      front: {
        core: { name: 'Sharp Note',    cost: 1, target: 'frontmost', fx: { dmg: 3, lull: 1 },   desc: '3 damage · <span class="kw kw-chill">❄ CHILL</span> −1 next attack.' },
        sig:  { name: 'Discord',       cost: 2, target: 'enemy',     fx: { dmg: 5, lull: 2 },   desc: '5 damage to ANY enemy · <span class="kw kw-chill">❄ CHILL</span> −2.' },
      },
      mid: {
        core: { name: 'Inspire',       cost: 1, target: 'ally',      fx: { buffDmg: 4 },        desc: '<span class="kw kw-rally">▲ RALLY</span>: an ally’s next damaging card deals +4.' },
        sig:  { name: 'Battle Hymn',   cost: 2, target: 'allies',    fx: { buffDmg: 2 },        desc: '<span class="kw kw-rally">▲ RALLY</span>: every ally’s next damaging card deals +2.' },
      },
      back: {
        core: { name: 'Lullaby',       cost: 1, target: 'enemy',     fx: { lull: 2 },           desc: '<span class="kw kw-chill">❄ CHILL</span>: an enemy deals −2 on its next attack.' },
        sig:  { name: 'Crescendo',     cost: 2, target: 'ally',      fx: { buffDmg: 5 },        desc: '<span class="kw kw-rally">▲ RALLY</span>: an ally’s next damaging card deals +5.' },
      },
    },
  },
  cassia: {
    // HEAVY: one card per stance — expensive, high-impact, slow.  Her whole
    // turn is a single deliberate play (the guardian anchor).  MID card is
    // ally-target so she can still weave threads from her natural position.
    tempo: 'heavy', school: 'iron', name: 'CASSIA', cls: 'Guardian', archetype: 'Warden', identity: 'An immovable wall — guards the whole party.', tint: 'var(--cassia-tint)', maxHp: 34,
    cards: {
      front: {
        core: { name: 'Shield Bash', cost: 1, target: 'frontmost', fx: { dmg: 4, guard: 2 }, desc: '4 damage · 2 guard.' },
        sig:  { name: 'Bulwark',     cost: 2, target: 'frontmost', fx: { dmg: 6, guard: 6 }, desc: '6 damage · gain 6 guard.' },
      },
      mid: {
        core: { name: 'Cover', cost: 1, target: 'ally', fx: { guard: 4, smite: 3 }, desc: 'An ally gains 4 guard · <b>3</b> to the nearest foe.' },
        sig:  { name: 'Aegis', cost: 2, target: 'ally', fx: { guard: 7, smite: 3 }, desc: 'Guard an ally <span class="kw kw-guard">⛨ 7</span> · <b>3</b> to the nearest foe.' },
      },
      back: {
        core: { name: 'Thrown Shield',  cost: 1, target: 'enemy', fx: { dmg: 4 }, desc: '4 damage to ANY enemy.' },
        sig:  { name: 'Sentinel Throw', cost: 2, target: 'enemy', fx: { dmg: 7 }, desc: '7 damage to ANY enemy.' },
      },
    },
  },
  hask: {
    school: 'frost', tempo: 'steady', name: 'HASK', cls: 'Mage', archetype: 'Frostcaller', identity: 'Frost from range — sets up the shatter.', tint: 'var(--hask-tint)', maxHp: 22,
    cards: {
      front: {
        core: { name: 'Frost Touch',   cost: 1, target: 'frontmost', fx: { dmg: 4, lull: 1 },   desc: '4 frost damage · <span class="kw kw-chill">❄ CHILL</span> −1.' },
        sig:  { name: 'Shatter',       cost: 2, target: 'frontmost', fx: { dmg: 9 },            desc: '9 frost damage to the nearest enemy.' },
      },
      mid: {
        core: { name: 'Ice Bolt',      cost: 1, target: 'enemy',     fx: { dmg: 4 },            desc: '4 frost damage to ANY enemy.' },
        sig:  { name: 'Frost Ward',    cost: 2, target: 'ally',      fx: { guard: 5 }, desc: 'Guard an ally: <span class="kw kw-guard">⛨ 5</span>.' },
      },
      back: {
        core: { name: 'Deep Freeze',   cost: 1, target: 'enemy',     fx: { dmg: 5 },            desc: '5 frost damage to ANY enemy.' },
        sig:  { name: 'Hasten',        cost: 2, target: 'ally',      fx: { buffDmg: 6 },        desc: '<span class="kw kw-rally">▲ RALLY</span>: an ally’s next damaging card deals +6.' },
      },
    },
  },
  mira: {
    school: 'blade', tempo: 'swift', name: 'MIRA', cls: 'Reaver', archetype: 'Assassin',
    identity: 'A shadow that strikes and vanishes — marks prey, slips away.', tint: 'var(--mira-tint)', maxHp: 21,
    cards: {
      front: {
        core: { name: 'Backstab',      cost: 1, target: 'frontmost', fx: { dmg: 6, step: 'back' }, desc: '6 damage · slip to BACK.' },
        sig:  { name: 'Vanish Strike', cost: 2, target: 'frontmost', fx: { dmg: 9, warp: 'back' }, desc: '9 damage · vanish to the BACK line.' },
      },
      mid: {
        core: { name: 'Shadow Knife',  cost: 1, target: 'enemy', fx: { dmg: 4, mark: 3 }, desc: '4 damage · <span class="kw kw-exposed">◎ EXPOSED 3</span>.' },
        sig:  { name: 'Twin Daggers',  cost: 2, target: 'enemy', fx: { dmg: 10 }, desc: '10 damage to ANY enemy.' },
      },
      back: {
        core: { name: 'Thrown Dagger', cost: 1, target: 'enemy', fx: { dmg: 4, step: 'front' }, desc: '4 damage to ANY enemy · close to FRONT.' },
        sig:  { name: 'Killing Mark',  cost: 2, target: 'enemy', fx: { dmg: 3, mark: 5 }, desc: '3 damage · <span class="kw kw-exposed">◎ EXPOSED 5</span>: +5 from every hit. Fades 1/turn.' },
      },
    },
  },
  branwen: {
    // RANGED marksman: every shot reaches ANY enemy (ignores rows), so she
    // hunts from the back line and hates being shoved to the front — her
    // front-stance cards fire and RETREAT.  She marks prey for the party to
    // cash.  The mirror of Ash: he advances into the cut, she falls back to it.
    school: 'blade', tempo: 'swift', name: 'BRANWEN', cls: 'Ranger', archetype: 'Marksman',
    identity: 'Looses from the back line — marks prey from range, never in reach.', tint: 'var(--branwen-tint)', maxHp: 20,
    cards: {
      front: {
        core: { name: 'Backstep Shot', cost: 1, target: 'enemy', fx: { dmg: 5, step: 'back' }, desc: '5 damage to ANY enemy · loose and fall back to BACK.' },
        sig:  { name: 'Hunter’s Mark', cost: 2, target: 'enemy', fx: { dmg: 3, mark: 4, step: 'back' }, desc: '3 damage · <span class="kw kw-exposed">◎ EXPOSED 4</span> · slip to BACK.' },
      },
      mid: {
        core: { name: 'Aimed Shot',    cost: 1, target: 'enemy', fx: { dmg: 6 }, desc: '6 damage to ANY enemy.' },
        sig:  { name: 'Killshot',      cost: 2, target: 'enemy', fx: { dmg: 11 }, desc: '11 damage to ANY enemy.' },
      },
      back: {
        core: { name: 'Marking Arrow', cost: 1, target: 'enemy', fx: { dmg: 4, mark: 3 }, desc: '4 damage · <span class="kw kw-exposed">◎ EXPOSED 3</span>.' },
        sig:  { name: 'Killing Arrow', cost: 2, target: 'enemy', fx: { dmg: 9, mark: 2 }, desc: '9 damage · <span class="kw kw-exposed">◎ EXPOSED 2</span>.' },
      },
    },
  },
};

// ═════════════════════════════════════════════════════════════════════════════
// COMMON GROUND — the generic nodes that make up a border (Build 251)
//
// This is the shape FFX's grid actually has: a character's SIGNATURE abilities
// sit deep in their own lane, and the connective tissue between lanes is plain,
// unowned ground that anybody can walk.  Crossings until now skipped the middle
// entirely — you reached from your hub straight to a named ability of someone
// else's, which is both a strange thing to "learn" and left the space between
// two regions completely empty.
//
// A border now has NODES ON IT.  They belong to no hero, they are the same
// handful of unglamorous rules for everyone, and either partner can take one
// once their bond is WOVEN.  They are also the CROSSOVER POINT: holding a piece
// of common ground on a border is what lets you reach the far side of it, so a
// crossing is walked to rather than bought at range.
const COMMON_POOL = [
  { key: 'temper', label: 'Tempered', glyph: '⚒', passive: 'common_temper',
    desc: 'COMMON: every attack you make strikes for <b>+1</b>.' },
  { key: 'brace', label: 'Braced', glyph: '⛨', passive: 'common_brace',
    desc: 'COMMON · TURN START: you brace for <span class="kw kw-guard">⛨ 2</span>.' },
  { key: 'keen', label: 'Keen Eye', glyph: '◎', passive: 'common_keen',
    desc: 'COMMON: <b>+2</b> damage to any <span class="kw kw-exposed">◎ EXPOSED</span> foe.' },
  { key: 'wind', label: 'Second Wind', glyph: '✚', passive: 'common_wind',
    desc: 'COMMON · TURN START: if you are under half health, <span class="kw kw-heal">✚ 2</span>.' },
];
const COMMON_COST = 4;          // flat — common ground is priced by nobody's kinship
const COMMON_PER_BORDER = 2;
// Built once, for every pair of heroes who own a region, so the border is the
// same every run and the layout never shuffles under the player.
const COMMON_NODES = (function () {
  const out = [], ids = Object.keys(HEROES).filter(h => EMBER_TREE.some(n => n.hero === h)).sort();
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const pair = ids[i] + '|' + ids[j];
    for (let k = 0; k < COMMON_PER_BORDER; k++) {
      // a stable, spread-out pick so a border is not two of the same stone
      const t = COMMON_POOL[(i + j * 3 + k * 2) % COMMON_POOL.length];
      out.push({ id: 'common.' + pair + '.' + k, hero: null, pair, common: true, slot: k,
        tier: 2, cost: COMMON_COST, type: 'passive', passive: t.passive,
        label: t.label, glyph: t.glyph, desc: t.desc });
    }
  }
  return out;
})();
// Common nodes join the tree proper so the passive dispatchers, NODE_BY_ID and
// every ownership test see them without a second code path.  `hero: null` keeps
// them out of anything that filters by hero — a hero's own region, the ordinary
// spark pool — which is exactly right: they are nobody's.
COMMON_NODES.forEach(n => { EMBER_TREE.push(n); NODE_BY_ID[n.id] = n; });
function commonOnBorder(a, b) {
  const pair = [a, b].sort().join('|');
  const out = COMMON_NODES.filter(n => n.pair === pair);
  const bn = bondNodeFor(a, b);            // earned at the fire; absent until then
  return bn ? out.concat([bn]) : out;
}
function borderOpen(learner, other) {
  return commonOnBorder(learner, other).some(n => hasCrossed(learner, n.id));
}


// ---------------------------------------------------------------------------
// BRANCHING ROTATIONS — a stance can declare a ROTATION instead of the classic
// core+signature pair.  The hero shows ONE live card: their OPENER.  Playing a
// chain card FORGES its next step(s) into hand as FREE temp cards — so the hand
// is always the current STATE of the rotation (~1–2 cards/hero), never the whole
// kit.  When a step offers two options they share a branchGroup: picking one
// PURGES its sibling — the choice is real (FFXIV-shaped).  Everything resets each
// turn (forged steps carry expiresTurn; the opener returns fresh next turn).
//   LOCKED: opener costs EP, every forged step is free — EP gates how many HEROES
//   you engage per turn, not how deep you go.  Combos reset each turn.
// Phase 1 ships ASH on rotations across all three stances; the other heroes keep
// the classic core+signature hand until their rotations land.
// ---------------------------------------------------------------------------
const ROTATIONS = {
  // Each stance is a BASE linear chain (opener → builder → finisher) plus ONE
  // tree-gated branch (an alt builder + its finisher) that opens a real "see
  // both and pick" fork.  Branch entries carry `gate:` a run-node id — with the
  // gate owned, the opener forges BOTH options; without it, just the base line.
  // The gates (rot.<hero>.<stance>) map onto Ember-Tree growth; the dev preview
  // grants them all so the fully-branched build is testable end to end.
  ash: {
    front: { opener: 'cleave', cards: {
      cleave:       { name: 'Cleave',        cost: 2, target: 'frontmost', fx: { dmg: 6 },          stance: 'OPENER · AGGRESSION', desc: '6 damage to the nearest foe.', next: [{ key: 'crashingwave', gateNot: 'ash.sig.front' }, { key: 'risingslash', gate: 'ash.sig.front' }, { key: 'sunder', gate: 'ash.branch.front' }] },
      feintcut:     { name: 'Feint Cut',     cost: 1, target: 'enemy',     fx: { dmg: 3, mark: 2 }, stance: 'OPENER \u00b7 EXPOSE', desc: '3 damage \u00b7 <span class="kw kw-exposed">\u25ce EXPOSED 2</span> to ANY foe.', next: [{ key: 'crashingwave', gateNot: 'ash.sig.front' }, { key: 'risingslash', gate: 'ash.sig.front' }, { key: 'sunder', gate: 'ash.branch.front' }] },
      risingslash:  { name: 'Rising Slash',  cost: 0, target: 'frontmost', fx: { dmg: 8 },          stance: 'COMBO · TEMPO',     desc: '8 damage.', next: ['crashingwave'] },
      crashingwave: { name: 'Crashing Wave', cost: 0, target: 'frontmost', fx: { dmg: 11 },         stance: 'FINISHER · TEMPO',    desc: '11 damage cleaves through the nearest foe.' },
      sunder:       { name: 'Sunder',        cost: 0, target: 'enemy',     fx: { dmg: 5, mark: 2 }, stance: 'COMBO · EXPOSE',    desc: '5 damage · <span class="kw kw-exposed">◎ EXPOSED 2</span> to ANY foe.', next: ['markedfate'] },
      markedfate:   { name: 'Marked Fate',   cost: 0, target: 'enemy',     fx: { dmg: 3, mark: 4 }, stance: 'FINISHER · EXPOSE',   desc: '3 damage · <span class="kw kw-exposed">◎ EXPOSED 4</span>: +4 from EVERY hit.' },
    } },
    mid: { opener: 'flowingcut', cards: {
      flowingcut: { name: 'Flowing Cut', cost: 1, target: 'frontmost', fx: { dmg: 4, guard: 3 },        stance: 'OPENER · FLOW',     desc: '4 damage · gain <span class="kw kw-guard">⛨ 3</span>.', next: [{ key: 'riposte', gateNot: 'ash.sig.mid' }, { key: 'parrystep', gate: 'ash.sig.mid' }, { key: 'flowread', gate: 'ash.branch.mid' }] },
      parrystep:  { name: 'Parry Step',  cost: 0, target: 'self',      fx: { guard: 5, counter: 1 },     stance: 'COMBO · GUARD',   desc: 'Gain <span class="kw kw-guard">⛨ 5</span> · <span class="kw kw-counter">↺ 1</span>.', next: ['riposte'] },
      riposte:    { name: 'Riposte',     cost: 0, target: 'frontmost', fx: { dmg: 7 },                   stance: 'FINISHER · FLOW',   desc: '7 damage.' },
      flowread:   { name: 'Flow Read',   cost: 0, target: 'self',      fx: { buffDmg: 3, step: 'front' },stance: 'COMBO · TEMPO',   desc: 'Slip to FRONT · your next strike deals <span class="kw kw-rally">▲ +3</span>.', next: ['crossguard'] },
      crossguard: { name: 'Crossguard',  cost: 0, target: 'ally',      fx: { guard: 6 },                 stance: 'FINISHER · GUARD',  desc: 'Throw <span class="kw kw-guard">⛨ 6</span> onto an ally.' },
    } },
    back: { opener: 'thrownedge', cards: {
      thrownedge:  { name: 'Thrown Edge',   cost: 1, target: 'enemy', fx: { dmg: 4, step: 'front' }, stance: 'OPENER · MARK',    desc: '4 damage to ANY foe · close to FRONT.', next: [{ key: 'followcut', gateNot: 'ash.sig.back' }, { key: 'deepercut', gate: 'ash.sig.back' }, { key: 'huntersread', gate: 'ash.branch.back' }] },
      deepercut:   { name: 'Deeper Cut',    cost: 0, target: 'enemy', fx: { dmg: 5 },                stance: 'COMBO · TEMPO',  desc: '5 damage to any foe.', next: ['followcut'] },
      followcut:   { name: 'Follow Cut',    cost: 0, target: 'enemy', fx: { dmg: 7 },                stance: 'FINISHER · TEMPO', desc: '7 damage.' },
      huntersread: { name: 'Hunter’s Read', cost: 0, target: 'enemy', fx: { dmg: 2, mark: 2 },       stance: 'COMBO · EXPOSE', desc: '2 damage · <span class="kw kw-exposed">◎ EXPOSED 2</span>.', next: ['backmarked'] },
      backmarked:  { name: 'Marked Fate',   cost: 0, target: 'enemy', fx: { dmg: 3, mark: 4 },       stance: 'FINISHER · EXPOSE',desc: '3 damage · <span class="kw kw-exposed">◎ EXPOSED 4</span> on any foe.' },
    } },
  },

  elin: {
    front: { opener: 'smite', cards: {
      smite:      { name: 'Smite',        cost: 2, target: 'frontmost', fx: { dmg: 4 },            stance: 'OPENER · RADIANT', desc: '4 holy damage to the nearest foe.', next: [{ key: 'radiantward', gateNot: 'elin.sig.front' }, { key: 'searing', gate: 'elin.sig.front' }, { key: 'raiseward', gate: 'elin.branch.front' }] },
      searing:    { name: 'Searing',      cost: 0, target: 'frontmost', fx: { dmg: 7 },            stance: 'COMBO · RADIANT',desc: '7 holy damage.', next: ['radiantward'] },
      radiantward:{ name: 'Radiant Ward', cost: 0, target: 'allies',    fx: { guard: 3, heal: 2 }, stance: 'FINISHER · WARD',  desc: 'Every ally gains <span class="kw kw-guard">⛨ 3</span> · <span class="kw kw-heal">✚ 2</span>.' },
      raiseward:  { name: 'Raise Ward',   cost: 0, target: 'allies',    fx: { guard: 2 },          stance: 'COMBO · WARD',   desc: 'Every ally gains <span class="kw kw-guard">⛨ 2</span>.', next: ['consecrate'] },
      consecrate: { name: 'Consecrate',   cost: 0, target: 'frontmost', fx: { dmg: 6 },            stance: 'FINISHER · RADIANT',desc: '6 holy damage.' },
    } },
    mid: { opener: 'mend', cards: {
      mend:      { name: 'Mend',           cost: 1, target: 'ally', fx: { heal: 3, smite: 3 },  stance: 'OPENER · MEND',    desc: 'Heal an ally 3 · <b>3 holy</b> to the nearest foe.', next: [{ key: 'renew', gateNot: 'elin.sig.mid' }, { key: 'sanctuary', gate: 'elin.sig.mid' }, { key: 'cleanse', gate: 'elin.branch.mid' }] },
      stillness: { name: 'Stillness',      cost: 1, target: 'ally', fx: { guard: 5 },           stance: 'OPENER \u00b7 GUARD',   desc: '<span class="kw kw-guard">\u26e8 5</span> onto an ally \u2014 a ward instead of a mend.', next: [{ key: 'renew', gateNot: 'elin.sig.mid' }, { key: 'sanctuary', gate: 'elin.sig.mid' }, { key: 'cleanse', gate: 'elin.branch.mid' }] },
      sanctuary: { name: 'Sanctuary',      cost: 0, target: 'ally', fx: { heal: 2, guard: 3 },  stance: 'COMBO · MEND',   desc: 'Heal an ally 2 · <span class="kw kw-guard">⛨ 4</span>.', next: ['renew'] },
      renew:     { name: 'Renew',          cost: 0, target: 'ally', fx: { heal: 4, smite: 5 },  stance: 'FINISHER · MEND',  desc: 'Heal an ally 4 · <b>5 holy</b> to the nearest foe.' },
      cleanse:   { name: 'Cleanse',        cost: 0, target: 'ally', fx: { heal: 2, guard: 4 },  stance: 'COMBO · WARD',   desc: 'Heal an ally 2 · <span class="kw kw-guard">⛨ 3</span>.', next: ['wardingcircle'] },
      wardingcircle:{ name: 'Warding Circle',cost: 0, target: 'allies', fx: { guard: 3 },       stance: 'FINISHER · WARD',  desc: 'A ring of light — every ally gains <span class="kw kw-guard">⛨ 3</span>.' },
    } },
    back: { opener: 'distantprayer', cards: {
      distantprayer:{ name: 'Distant Prayer', cost: 1, target: 'allies', fx: { heal: 1, smite: 3 }, stance: 'OPENER · BLESS',   desc: 'Heal every ally 1 · <b>3 holy</b> to the nearest foe.', next: [{ key: 'benediction', gateNot: 'elin.sig.back' }, { key: 'blessing', gate: 'elin.sig.back' }, { key: 'deepmercy', gate: 'elin.branch.back' }] },
      blessing:  { name: 'Blessing',        cost: 0, target: 'ally',   fx: { heal: 2, buffDmg: 3 }, stance: 'COMBO · BLESS',  desc: 'Heal an ally <span class="kw kw-heal">✚ 3</span> · their next strike deals <span class="kw kw-rally">▲ +2</span>.', next: ['benediction'] },
      benediction:{ name: 'Benediction',    cost: 0, target: 'ally',   fx: { heal: 3, buffDmg: 5 }, stance: 'FINISHER · BLESS', desc: 'Heal an ally 3 · <span class="kw kw-rally">▲ RALLY +5</span>.' },
      deepmercy: { name: 'Deep Mercy',      cost: 0, target: 'ally',   fx: { heal: 4 },          stance: 'COMBO · MERCY',  desc: 'Heal an ally 4.', next: ['dawnlight'] },
      dawnlight: { name: 'Dawnlight',       cost: 0, target: 'allies', fx: { heal: 2, smite: 6 }, stance: 'FINISHER · MERCY', desc: 'Dawn breaks — every ally heals 2 · <b>6 holy</b> to the nearest foe.' },
    } },
  },

  mira: {
    front: { opener: 'backstab', cards: {
      backstab:   { name: 'Backstab',      cost: 1, target: 'frontmost', fx: { dmg: 6, step: 'back' }, stance: 'OPENER · VANISH', desc: '6 damage · slip to BACK.', next: [{ key: 'vanishstrike', gateNot: 'mira.sig.front' }, { key: 'twincut', gate: 'mira.sig.front' }, { key: 'shadowstep', gate: 'mira.branch.front' }] },
      twincut:    { name: 'Twin Cut',      cost: 0, target: 'frontmost', fx: { dmg: 6 },              stance: 'COMBO · VANISH',desc: '6 damage.', next: ['vanishstrike'] },
      vanishstrike:{ name: 'Vanish Strike',cost: 0, target: 'frontmost', fx: { dmg: 9, warp: 'back' },stance: 'FINISHER · VANISH',desc: '9 damage · vanish to the BACK line.' },
      shadowstep: { name: 'Shadowstep',    cost: 0, target: 'enemy',     fx: { dmg: 3, mark: 2, step: 'back' }, stance: 'COMBO · SHADOW', desc: '3 damage · <span class="kw kw-exposed">◎ EXPOSED 2</span> · slip BACK.', next: ['killingmark'] },
      killingmark:{ name: 'Killing Mark',  cost: 0, target: 'enemy',     fx: { dmg: 3, mark: 5 },     stance: 'FINISHER · SHADOW',desc: '3 damage · <span class="kw kw-exposed">◎ EXPOSED 5</span>.' },
    } },
    mid: { opener: 'shadowknife', cards: {
      shadowknife:{ name: 'Shadow Knife',  cost: 1, target: 'enemy', fx: { dmg: 4, mark: 3 }, stance: 'OPENER · BLEED', desc: '4 damage · <span class="kw kw-exposed">◎ EXPOSED 3</span>.', next: [{ key: 'twindaggers', gateNot: 'mira.sig.mid' }, { key: 'serrate', gate: 'mira.sig.mid' }, { key: 'feint', gate: 'mira.branch.mid' }] },
      serrate:    { name: 'Serrate',       cost: 0, target: 'enemy', fx: { dmg: 4, mark: 1 }, stance: 'COMBO · BLEED',desc: '4 damage · <span class="kw kw-exposed">◎ EXPOSED 1</span>.', next: ['twindaggers'] },
      twindaggers:{ name: 'Twin Daggers',  cost: 0, target: 'enemy', fx: { dmg: 10 },          stance: 'FINISHER · BLEED',desc: '10 damage.' },
      feint:      { name: 'Feint',         cost: 0, target: 'self',  fx: { buffDmg: 3 },       stance: 'COMBO · GUILE',desc: 'Your next strike deals <span class="kw kw-rally">▲ +3</span>.', next: ['bloodletting'] },
      bloodletting:{ name: 'Bloodletting', cost: 0, target: 'enemy', fx: { dmg: 8, mark: 2 },  stance: 'FINISHER · GUILE',desc: '8 damage · <span class="kw kw-exposed">◎ EXPOSED 2</span>.' },
    } },
    back: { opener: 'throwndagger', cards: {
      throwndagger:{ name: 'Thrown Dagger',cost: 1, target: 'enemy', fx: { dmg: 4 },          stance: 'OPENER · MARK', desc: '4 damage to ANY foe.', next: [{ key: 'execute', gateNot: 'mira.sig.back' }, { key: 'quickthrow', gate: 'mira.sig.back' }, { key: 'markblade', gate: 'mira.branch.back' }] },
      markedknife:{ name: 'Marked Knife', cost: 1, target: 'enemy', fx: { dmg: 2, mark: 2 }, stance: 'OPENER \u00b7 EXPOSE', desc: '2 damage \u00b7 <span class="kw kw-exposed">\u25ce EXPOSED 2</span> to ANY foe.', next: [{ key: 'execute', gateNot: 'mira.sig.back' }, { key: 'quickthrow', gate: 'mira.sig.back' }, { key: 'markblade', gate: 'mira.branch.back' }] },
      quickthrow: { name: 'Quick Throw',   cost: 0, target: 'enemy', fx: { dmg: 4 },          stance: 'COMBO · MARK',desc: '4 damage.', next: ['execute'] },
      execute:    { name: 'Execute',       cost: 0, target: 'enemy', fx: { dmg: 10 },         stance: 'FINISHER · MARK',desc: '10 damage.' },
      markblade:  { name: 'Mark',          cost: 0, target: 'enemy', fx: { dmg: 2, mark: 3 }, stance: 'COMBO · HUNT',desc: '2 damage · <span class="kw kw-exposed">◎ EXPOSED 3</span>.', next: ['backkillingmark'] },
      backkillingmark:{ name: 'Killing Mark',cost: 0, target: 'enemy', fx: { dmg: 3, mark: 5 },stance: 'FINISHER · HUNT',desc: '3 damage · <span class="kw kw-exposed">◎ EXPOSED 5</span>.' },
    } },
  },

  cassia: {
    front: { opener: 'shieldbash', cards: {
      shieldbash: { name: 'Shield Bash', cost: 1, target: 'frontmost', fx: { dmg: 4, guard: 2 }, stance: 'OPENER · WALL', desc: '4 damage · <span class="kw kw-guard">⛨ 2</span>.', next: [{ key: 'bulwark', gateNot: 'cassia.sig.front' }, { key: 'brace', gate: 'cassia.sig.front' }, { key: 'provoke', gate: 'cassia.branch.front' }] },
      ironstand:  { name: 'Iron Stand',  cost: 1, target: 'self',      fx: { guard: 4, counter: 1 }, stance: 'OPENER \u00b7 WALL', desc: 'Gain <span class="kw kw-guard">\u26e8 4</span> \u00b7 <span class="kw kw-counter">\u21ba 1</span>.', next: [{ key: 'bulwark', gateNot: 'cassia.sig.front' }, { key: 'brace', gate: 'cassia.sig.front' }, { key: 'provoke', gate: 'cassia.branch.front' }] },
      brace:      { name: 'Brace',       cost: 0, target: 'self',      fx: { guard: 4 },          stance: 'COMBO · WALL',desc: 'Gain <span class="kw kw-guard">⛨ 4</span>.', next: ['bulwark'] },
      bulwark:    { name: 'Bulwark',     cost: 0, target: 'frontmost', fx: { dmg: 8, guard: 6 },  stance: 'FINISHER · WALL',desc: '8 damage · gain <span class="kw kw-guard">⛨ 6</span>.' },
      provoke:    { name: 'Provoke',     cost: 0, target: 'self',      fx: { guard: 2, counter: 2, taunt: true }, stance: 'COMBO · IRON', desc: '<span class="kw kw-guard">⛨ 2</span> · <span class="kw kw-counter">↺ 2</span> · <b>TAUNT</b> — every foe strikes CASSIA’s row next round.', next: ['ironanswer'] },
      ironanswer: { name: 'Iron Answer', cost: 0, target: 'frontmost', fx: { dmg: 9 },            stance: 'FINISHER · IRON',desc: '9 damage.' },
    } },
    mid: { opener: 'cover', cards: {
      cover:      { name: 'Cover',     cost: 1, target: 'ally',  fx: { guard: 4 },           stance: 'OPENER · AEGIS', desc: 'An ally gains <span class="kw kw-guard">⛨ 4</span>.', next: [{ key: 'aegis', gateNot: 'cassia.sig.mid' }, { key: 'reinforce', gate: 'cassia.sig.mid' }, { key: 'warded', gate: 'cassia.branch.mid' }] },
      reinforce:  { name: 'Reinforce', cost: 0, target: 'ally',  fx: { guard: 3 },           stance: 'COMBO · AEGIS',desc: 'An ally gains <span class="kw kw-guard">⛨ 3</span>.', next: ['aegis'] },
      aegis:      { name: 'Aegis',     cost: 0, target: 'ally',  fx: { guard: 7 },           stance: 'FINISHER · AEGIS',desc: 'Ward an ally <span class="kw kw-guard">⛨ 7</span>.' },
      warded:     { name: 'Warded',    cost: 0, target: 'ally',  fx: { guard: 2, counter: 1 },stance: 'COMBO · SENTINEL',desc: 'An ally gains <span class="kw kw-guard">⛨ 2</span> · <span class="kw kw-counter">↺ 1</span>.', next: ['sentinelvolley'] },
      sentinelvolley:{ name: 'Sentinel Volley', cost: 0, target: 'enemy', fx: { dmg: 8 },     stance: 'FINISHER · SENTINEL',desc: 'A shield hurled from the wall — 8 damage.' },
    } },
    back: { opener: 'thrownshield', cards: {
      thrownshield:{ name: 'Thrown Shield', cost: 1, target: 'enemy', fx: { dmg: 4 },        stance: 'OPENER · SENTINEL', desc: '4 damage to ANY foe.', next: [{ key: 'sentinelthrow', gateNot: 'cassia.sig.back' }, { key: 'weighted', gate: 'cassia.sig.back' }, { key: 'rampart', gate: 'cassia.branch.back' }] },
      weighted:   { name: 'Weighted Shield',cost: 0, target: 'enemy', fx: { dmg: 3 },        stance: 'COMBO · SENTINEL',desc: '3 damage.', next: ['sentinelthrow'] },
      sentinelthrow:{ name: 'Sentinel Throw',cost: 0, target: 'enemy', fx: { dmg: 9 },       stance: 'FINISHER · SENTINEL',desc: '9 damage to any foe.' },
      rampart:    { name: 'Rampart',        cost: 0, target: 'self',  fx: { guard: 4 },       stance: 'COMBO · WALL',   desc: 'Gain <span class="kw kw-guard">⛨ 4</span>.', next: ['backvolley'] },
      backvolley: { name: 'Sentinel Volley',cost: 0, target: 'enemy', fx: { dmg: 8 },        stance: 'FINISHER · SENTINEL',desc: '8 damage.' },
    } },
  },

  branwen: {
    front: { opener: 'backstepshot', cards: {
      backstepshot:{ name: 'Backstep Shot', cost: 1, target: 'enemy', fx: { dmg: 5, step: 'back' }, stance: 'OPENER · RETREAT', desc: '5 damage to ANY foe · fall back to BACK.', next: [{ key: 'hail', gateNot: 'branwen.sig.front' }, { key: 'snapshot', gate: 'branwen.sig.front' }, { key: 'huntmark', gate: 'branwen.branch.front' }] },
      snapshot:   { name: 'Snap Shot',    cost: 0, target: 'enemy', fx: { dmg: 5 },                 stance: 'COMBO · RETREAT',desc: '5 damage.', next: ['hail'] },
      hail:       { name: 'Hail',         cost: 0, target: 'enemy', fx: { dmg: 6 },                 stance: 'FINISHER · RETREAT',desc: '6 damage from the dark.' },
      huntmark:   { name: 'Hunter’s Mark',cost: 0, target: 'enemy', fx: { dmg: 3, mark: 4, step: 'back' }, stance: 'COMBO · HUNT', desc: '3 damage · <span class="kw kw-exposed">◎ EXPOSED 4</span> · slip BACK.', next: ['frontmarked'] },
      frontmarked:{ name: 'Marked Fate',  cost: 0, target: 'enemy', fx: { dmg: 3, mark: 4 },       stance: 'FINISHER · HUNT',  desc: '3 damage · <span class="kw kw-exposed">◎ EXPOSED 4</span>.' },
    } },
    mid: { opener: 'aimedshot', cards: {
      aimedshot:  { name: 'Aimed Shot',   cost: 3, target: 'enemy', fx: { dmg: 6 },  stance: 'OPENER · EXECUTION', desc: '6 damage to ANY foe.', next: [{ key: 'killshot', gateNot: 'branwen.sig.mid' }, { key: 'steadyaim', gate: 'branwen.sig.mid' }, { key: 'calledshot', gate: 'branwen.branch.mid' }] },
      pinningshot:{ name: 'Pinning Shot', cost: 2, target: 'enemy', fx: { dmg: 4, mark: 1 },  stance: 'OPENER \u00b7 MARK', desc: '4 damage \u00b7 <span class="kw kw-exposed">\u25ce EXPOSED 1</span> to ANY foe.', next: [{ key: 'killshot', gateNot: 'branwen.sig.mid' }, { key: 'steadyaim', gate: 'branwen.sig.mid' }, { key: 'calledshot', gate: 'branwen.branch.mid' }] },
      steadyaim:  { name: 'Steady Aim',   cost: 0, target: 'self',  fx: { buffDmg: 3 }, stance: 'COMBO · EXECUTION',desc: 'Your next shot deals <span class="kw kw-rally">▲ +3</span>.', next: ['killshot'] },
      killshot:   { name: 'Killshot',     cost: 0, target: 'enemy', fx: { dmg: 11 }, stance: 'FINISHER · EXECUTION',desc: '11 damage.' },
      calledshot: { name: 'Called Shot',  cost: 0, target: 'enemy', fx: { dmg: 3, mark: 2 }, stance: 'COMBO · HUNT', desc: '3 damage · <span class="kw kw-exposed">◎ EXPOSED 2</span>.', next: ['piercingshot'] },
      piercingshot:{ name: 'Piercing Shot',cost: 0, target: 'enemy', fx: { dmg: 10 }, stance: 'FINISHER · HUNT', desc: '10 damage through the gap.' },
    } },
    back: { opener: 'markingarrow', cards: {
      markingarrow:{ name: 'Marking Arrow', cost: 1, target: 'enemy', fx: { dmg: 4, mark: 3 }, stance: 'OPENER · VOLLEY', desc: '4 damage · <span class="kw kw-exposed">◎ EXPOSED 3</span>.', next: [{ key: 'killingarrow', gateNot: 'branwen.sig.back' }, { key: 'deepermark', gate: 'branwen.sig.back' }, { key: 'rapidnock', gate: 'branwen.branch.back' }] },
      deepermark: { name: 'Deeper Mark',  cost: 0, target: 'enemy', fx: { dmg: 2, mark: 2 }, stance: 'COMBO · VOLLEY',desc: '2 damage · <span class="kw kw-exposed">◎ EXPOSED 2</span>.', next: ['killingarrow'] },
      killingarrow:{ name: 'Killing Arrow',cost: 0, target: 'enemy', fx: { dmg: 9, mark: 2 }, stance: 'FINISHER · VOLLEY',desc: '9 damage · <span class="kw kw-exposed">◎ EXPOSED 2</span>.' },
      rapidnock:  { name: 'Rapid Nock',   cost: 0, target: 'enemy', fx: { dmg: 4 },          stance: 'COMBO · RAIN', desc: '4 damage.', next: ['volleyshot'] },
      volleyshot: { name: 'Volley Shot',  cost: 0, target: 'enemy', fx: { dmg: 6, mark: 2 }, stance: 'FINISHER · RAIN', desc: '6 damage · <span class="kw kw-exposed">◎ EXPOSED 2</span>.' },
    } },
  },
  // HASK — the BLACK MAGE.  Every spell that lands builds ◆ CHARGE; his finishers
  // dump it.  The MID fork is the OVERLOAD line: build charge, then unleash it.
  hask: {
    front: { opener: 'frosttouch', cards: {
      frosttouch: { name: 'Frost Touch', cost: 2, target: 'frontmost', fx: { dmg: 4, lull: 1, elem: 'ice' }, stance: 'OPENER · RIME', desc: '4 frost · <span class="kw kw-chill">❄ CHILL 1</span>.', next: [{ key: 'shatter', gateNot: 'hask.sig.front' }, { key: 'icespike', gate: 'hask.sig.front' }, { key: 'rimeblast', gate: 'hask.branch.front' }, { key: 'emberveil', gate: 'hask.weave.astral' }] },
      cindersnap: { name: 'Cinder Snap', cost: 2, target: 'frontmost', fx: { dmg: 5, elem: 'fire' }, stance: 'OPENER \u00b7 PYRE', desc: '5 fire to the nearest foe.', next: [{ key: 'shatter', gateNot: 'hask.sig.front' }, { key: 'icespike', gate: 'hask.sig.front' }, { key: 'rimeblast', gate: 'hask.branch.front' }, { key: 'emberveil', gate: 'hask.weave.astral' }] },
      icespike:   { name: 'Ice Spike',   cost: 0, target: 'frontmost', fx: { dmg: 6, lull: 1, elem: 'ice' }, stance: 'COMBO · RIME', desc: '6 frost · <span class="kw kw-chill">❄ CHILL 1</span>.', next: ['shatter'] },
      shatter:    { name: 'Shatter',     cost: 0, target: 'frontmost', fx: { dmg: 10, elem: 'ice' }, stance: 'FINISHER · RIME', desc: '10 frost — shatters the frozen.' },
      rimeblast:  { name: 'Rime Blast',  cost: 0, target: 'enemy', fx: { dmg: 4, lull: 2, elem: 'ice' }, stance: 'COMBO · FROST', desc: '4 frost · <span class="kw kw-chill">❄ CHILL 2</span> to ANY foe.', next: ['glacier'] },
      glacier:    { name: 'Glacier',     cost: 0, target: 'enemy', fx: { dmg: 8, lull: 1, elem: 'ice' }, stance: 'FINISHER · FROST', desc: '8 frost · <span class="kw kw-chill">❄ CHILL 1</span>.' },
      emberveil:  { name: 'Ember Veil',  cost: 0, target: 'frontmost', fx: { dmg: 5, elem: 'fire' }, stance: 'COMBO · PYRE', desc: '5 fire · swings <span class="kw kw-astral">🔥 PYRE</span>.', next: ['flare'] },
      flare:      { name: 'Cinderfall',  cost: 0, target: 'enemy', fx: { dmg: 8, elem: 'fire' }, stance: 'FINISHER · PYRE', desc: '8 fire · <span class="kw kw-astral">🔥 PYRE</span> empowers (+2 per stack).' },
    } },
    mid: { opener: 'icebolt', cards: {
      icebolt:    { name: 'Ice Bolt',    cost: 2, target: 'enemy', fx: { dmg: 4 }, stance: 'OPENER · CAST', desc: '4 frost to ANY foe.', next: [{ key: 'frostfire', gateNot: 'hask.sig.mid' }, { key: 'kindle', gate: 'hask.sig.mid' }, { key: 'overcharge', gate: 'hask.branch.mid' }] },
      kindle:     { name: 'Kindle',      cost: 0, target: 'enemy', fx: { dmg: 5 }, stance: 'COMBO · CAST', desc: '5 frost to ANY foe.', next: ['frostfire'] },
      frostfire:  { name: 'Frostfire',   cost: 0, target: 'enemy', fx: { dmg: 9 }, stance: 'FINISHER · CAST', desc: '9 frost to ANY foe.' },
      overcharge: { name: 'Overcharge',  cost: 0, target: 'self', fx: { chargeGain: 2 }, stance: 'COMBO · OVERLOAD', desc: 'Gain <b>◆ CHARGE 2</b> — no strike, all power.', next: ['overload'] },
      overload:   { name: 'Overload',    cost: 0, target: 'enemy', fx: { dmg: 6, spendCharge: true }, stance: 'FINISHER · OVERLOAD', desc: '6 frost · <b>SPEND ◆ CHARGE</b> (+3 each) to ANY foe.' },
    } },
    back: { opener: 'deepfreeze', cards: {
      deepfreeze: { name: 'Deep Freeze', cost: 2, target: 'enemy', fx: { dmg: 5 }, stance: 'OPENER · ARTILLERY', desc: '5 frost to ANY foe.', next: [{ key: 'iceshard', gateNot: 'hask.sig.back' }, { key: 'frostlance', gate: 'hask.sig.back' }, { key: 'leyfocus', gate: 'hask.branch.back' }] },
      frostlance: { name: 'Frost Lance', cost: 0, target: 'enemy', fx: { dmg: 6 }, stance: 'COMBO · ARTILLERY', desc: '6 frost to ANY foe.', next: ['iceshard'] },
      iceshard:   { name: 'Ice Shard',   cost: 0, target: 'enemy', fx: { dmg: 8 }, stance: 'FINISHER · ARTILLERY', desc: '8 frost to ANY foe.' },
      leyfocus:   { name: 'Waystone',    cost: 0, target: 'enemy', fx: { dmg: 4 }, stance: 'COMBO · OMEN', desc: '4 frost · steady the waystone.', next: ['comet'] },
      comet:      { name: 'Starfall',    cost: 0, target: 'enemy', fx: { castDmg: 16 }, stance: 'FINISHER · OMEN', desc: 'BEGIN a cast — <b>◈ 16 frost</b> lands NEXT turn. Moving breaks it.' },
    } },
  },
};
// Every branch gate declared across the rotations — the dev preview grants these
// so the fully-branched build is testable; the real system ties them to the tree.
const ROTATION_GATES = (() => {
  const s = new Set();
  Object.values(ROTATIONS).forEach(st => Object.values(st).forEach(rot =>
    Object.values(rot.cards).forEach(c => (c.next || []).forEach(n => { if (n && n.gate) s.add(n.gate); }))));
  return Array.from(s);
})();
// Rotations are OPT-IN per fight (S._rotations) while they're a preview — with
// the flag off, chain heroes fall back to their classic core+signature hand, so
// the tutorial and the whole flow suite are untouched until the swap is default.
function rotationFor(h) { return (S && S._rotations && h && ROTATIONS[h.id] && ROTATIONS[h.id][h.row]) || null; }
// shared builder for any rotation card (opener OR forged step).  Runs the SAME
// rider/forge/boon pipeline as mkCard so the Ember Tree's name-keyed riders keep
// biting (Crashing Wave / Thrown Edge / Flowing Cut are now rotation cards).
function mkRotCard(h, rowKey, def, kind) {
  const tempo = h.def.tempo || 'steady';
  let cost = def.cost || 0;
  if (kind === 'opener') {                          // openers obey the tempo economy
    if (tempo === 'swift' && cost > 1) cost -= 1;
    if (tempo === 'heavy') cost += 1;
  } else if (/FINISHER/.test(def.stance || '')) {
    // THE PAYOFF COSTS EP — the COMBO ramp stays free, but cashing a rotation's
    // FINISHER is now a real decision: which one do you spend EP on this turn?
    // Bigger finishers (mostly the empowered branch lines) cost 2 — worthwhile.
    cost = Math.max(cost, ((def.fx && def.fx.dmg) || 0) >= 9 ? 2 : 1);
    // …and say so. This economy — free ramp, paid cash-out — was written down
    // nowhere: not the tutorial, not HOW TO PLAY, not the card.
    if (typeof S !== 'undefined' && S && !S._finLesson) { S._finLesson = 1;
      setTimeout(() => lesson('fincost', 'COMBO STEPS ARE FREE — the FINISHER is what costs EP. Open with everyone, then choose who cashes out.', 3), 500); }
  }
  let fx = Object.assign({}, def.fx), desc = def.desc;
  const riders = ridersFor(h.id, def.name);
  riders.forEach(n => {
    Object.keys(n.rider.fx).forEach(k => { fx[k] = (fx[k] || 0) + n.rider.fx[k]; });
    if (n.rider.descAdd) desc = desc + n.rider.descAdd;
  });
  const card = { kind, chain: true, chainStance: rowKey, owner: h.id, ownerName: h.def.name, tint: h.def.tint, tempo,
    stance: def.stance || STANCE[h.row].name, name: def.name, cost, target: def.target, fx, desc,
    school: (fx && fx.dmg) ? h.def.school : null };
  if (def.next && def.next.length) card.chainNext = def.next.slice();
  runForges().forEach(fid => { const f = FORGE_BY_ID[fid]; if (f) f.apply(card); });
  runBoons().filter(b => b.card).forEach(b => { try { b.card(card); } catch (_) {} });
  if (card.fx && card.fx.dmg && !card.school) card.school = h.def.school;
  return card;
}
function mkChainOpener(h, rot, rowKey, cardKey) {
  const c = mkRotCard(h, rowKey || h.row, rot.cards[cardKey || rot.opener], 'opener');
  c.spent = S.used.has(h.id + ':opener');
  return c;
}
// ALTERNATE OPENERS (v2.2 Build 11) \u2014 the position's pool, widened by the
// tree. Each hero can LEARN a second way to open their archetype row: a
// tier-2 node puts a second opener card beside the row's own, entering the
// SAME line (same next, forks included). Both share the one opener latch \u2014
// playing either starts the line and the other leaves the table. This is
// the position-purity model paying out: more unlocks, more options, all of
// them the row's own.
const ALT_OPENERS = {
  ash:     { row: 'front', key: 'feintcut',    node: 'ash.open.front' },
  elin:    { row: 'mid',   key: 'stillness',   node: 'elin.open.mid' },
  mira:    { row: 'back',  key: 'markedknife', node: 'mira.open.back' },
  cassia:  { row: 'front', key: 'ironstand',   node: 'cassia.open.front' },
  branwen: { row: 'mid',   key: 'pinningshot', node: 'branwen.open.mid' },
  hask:    { row: 'front', key: 'cindersnap',  node: 'hask.open.front' },
};
// ─────────────────────────────────────────────────────────────────────────────
// THE REACH (Build 258) — make the hand a question instead of a rotation.
// THE REACH IS GONE (v2.2 Build 10, by decree). Builds 258-309 dealt one
// hero a turn an opener from a row they do NOT stand in, to vary the hand.
// The variety measured fine and PLAYED wrong twice over: first the substitute
// read as a bug (294), then the side-by-side offer (Build 9) still broke the
// model the player actually builds with — THE HAND IS THE POSITION. Every
// card a hero is offered comes from what they have learned in the row they
// stand in; unlocks widen that row's pool; the nuance is how the party's
// lines COMBINE; and moving swaps the kit to the new row. Deterministic
// openers are the cost, accepted: sameness is solved by the tree and the
// party, not by dealing off-position cards.
// forge one rotation step into the hand as a free, this-turn-only temp card
function genChainStep(h, rowKey, def, group) {
  if (S.tempCards.length >= 8) return null;
  const c = mkRotCard(h, rowKey, def, 'temp');
  c.temp = true; c.branchGroup = group; c.uid = ++S._tuid; c.expiresTurn = S.turn;
  S.tempCards.push(c);
  return c;
}
// after a chain card resolves: purge the picked branch's siblings, then forge
// this card's own next step(s).  Sibling purge is what makes the choice real.
// Picking one branch BURNS the path you didn't take — the unpicked sibling(s)
// crumble to ash where they sat, then leave the hand.  Called from playCard the
// instant the card drops (see there), so the burn and the strike read together.
function burnUnpickedSiblings(card) {
  if (!card || card.branchGroup == null) return;
  const doomed = S.tempCards.filter(t => t.branchGroup === card.branchGroup && t.uid !== card.uid);
  if (!doomed.length) return;
  doomed.forEach(sib => { const el = document.querySelector(`#hand .card[data-uid="${sib.uid}"]`); if (el) dissolveCardEl(el); });
  S.tempCards = S.tempCards.filter(t => !(t.branchGroup === card.branchGroup && t.uid !== card.uid));
}
// Resolve one `next` list through its gates into rotation DEFS.  A bare string
// always forges; {key, gate} forges only when the node is OWNED; {key, gateNot}
// only when it is NOT.  This is how the tree reshapes a chain: base =
// opener→finisher (gateNot the builder node); the builder node inserts a step
// (gate the builder, gateNot-hides the direct finisher); the fork node adds the
// alt line (gate the branch node).
function gatedSteps(rot, list) {
  const out = [];
  (list || []).forEach(n => {
    const key = (typeof n === 'string') ? n : n.key;
    if (n && n.gate && !hasNode(n.gate)) return;
    if (n && n.gateNot && hasNode(n.gateNot)) return;
    const def = rot.cards[key];
    if (def) out.push(def);
  });
  return out;
}
// ─────────────────────────────────────────────────────────────────────────────
// THE LINE (Build 293) — one combo, three beats, and the party chooses who takes
// each one.
//
// This SUPERSEDES the relay of Build 292, which forced the hand-off: an opener
// there dealt the next step to every hero EXCEPT its owner. Measured, forcing it
// narrowed the fan on every beat (4 legal cards → 4 → 2) and `plays` came back
// flat — the full numbers are in docs/PLAN-relay-chain.md. The answer was not to
// force the pass but to OFFER it.
//
//   somebody plays an OPENER    →  every opener is DISCARDED, and every living
//                                  hero lays out what they can answer with
//   somebody plays a COMBO      →  every combo is discarded, and every living
//                                  hero lays out their FINISHER
//   somebody plays a FINISHER   →  the line is spent. The openers come back for
//                                  whoever has not opened yet, and EP decides
//                                  whether the turn holds another line
//
// The fan therefore stays PARTY-WIDE at all three beats instead of collapsing to
// one hero, and the turn's question becomes "whose line do I finish, and whose
// beats do I borrow?" — a decision at every stage rather than a rule about whose
// turn it is to be holding a card.
//
// STAYING IN YOUR OWN LINE PAYS. A finisher is empowered by how many beats of
// THIS line its owner already played (see LINE_FOCUS), and Hask banks ◆ CHARGE
// for each beat he takes — provisionally, and forfeit unless he is also the one
// who closes. Spreading the line across three heroes pays the other way: acting
// together is already what forms a thread, so a shared line lights bonds. That
// trade is the design. Neither side is meant to be the right answer.
//
// A hero who owns no CARD node has no combo at all — their line is opener →
// finisher, exactly as the tree says it is. If NOBODY can answer, the combo stage
// is SKIPPED rather than stalling the party with an empty table.
// ─────────────────────────────────────────────────────────────────────────────
function lineOn() { return !!(S && S._rotations && S._line); }
// What each hero LEARNED to answer with. `needs` is the trigger read off the card
// that opened the beat — 'strike' only offers the answer when the beat it reacts
// to actually dealt damage, so a react is a reaction and not a free extra card.
// THE FOLLOW-UPS — the bond cards, and the only cards on the table that exist
// because two heroes are in the same line.
//
// NOT a hero's to learn. A follow-up is unlocked by the PAIR, out of the bond
// pool: two heroes who have sat at a fire together hold that pair's BOND NODE,
// and that is what puts a follow-up in the line. Nobody has one by default and
// no amount of a single hero's own tree will buy one — you get it by bonding,
// which is the thing the whole game is named after.
//
// `needs` is the trigger read off the card that opened the beat: 'strike' offers
// the follow-up only when the beat it follows actually struck, so it stays a
// response rather than a free extra card.
const FOLLOWUPS = {
  ash:     { name: 'Follow Up · Blade',   needs: 'strike', target: 'frontmost', fx: { dmg: 6, counter: 1 },          desc: 'Ash follows the blow in — 6 damage · <span class="kw kw-counter">↺ 1</span>.' },
  elin:    { name: 'Follow Up · Mercy',   needs: 'any',    target: 'opener',    fx: { heal: 4, guard: 3 },           desc: 'Elin covers the one who acted — <span class="kw kw-heal">✚ 4</span> · <span class="kw kw-guard">⛨ 3</span>.' },
  mira:    { name: 'Follow Up · Opening', needs: 'strike', target: 'enemy',     fx: { dmg: 3, mark: 4 },             desc: 'Mira opens the wound it made — 3 damage · <span class="kw kw-exposed">◎ EXPOSED 4</span>.' },
  cassia:  { name: 'Follow Up · Wall',    needs: 'any',    target: 'opener',    fx: { guard: 6, counter: 1 },        desc: 'Cassia steps in front of them — <span class="kw kw-guard">⛨ 6</span> · <span class="kw kw-counter">↺ 1</span>.' },
  branwen: { name: 'Follow Up · Aim',     needs: 'any',    target: 'self',      fx: { lineRally: 4 },                desc: 'Branwen steadies on it — this line’s next FINISHER deals <span class="kw kw-rally">▲ +4</span>.' },
  hask:    { name: 'Follow Up · Ley',     needs: 'any',    target: 'self',      fx: { chargeGain: 2, lineRally: 2 }, desc: 'Hask draws on the line — <b>◆ CHARGE 2</b> · the next FINISHER deals <span class="kw kw-rally">▲ +2</span>.' },
};
function followUpFromBond(x, from, opened) {
  if (!lineOn() || !x || !from || x.id === from.id) return null;
  // ONCE PER HERO PER LINE. A follow-up is free and CONTINUES the line, so without
  // this the party ping-pongs free cards and the turn never ends — measured at 134
  // decisions a fight against 11, the Build 292 endless turn wearing a new hat. A
  // follow-up is a cut-in, not a rotation.
  if (S.line && S.line.answered && S.line.answered.indexOf(x.id) >= 0) return null;
  // THE BOND IS THE UNLOCK. Not this hero's tree — the pair's. Two heroes who
  // have not bonded have no follow-up between them, however deep either has
  // grown their own line.
  if (!bondNodeHeld(x.id, from.id)) return null;
  const a = FOLLOWUPS[x.id];
  if (!a) return null;
  if (a.needs === 'strike' && !(opened && opened.fx && (opened.fx.dmg || opened.fx.smite || opened.fx.aoeDmg))) return null;
  return a;
}

// What closing a line you already carried is worth, indexed by how many of this
// line's EARLIER beats the finisher's owner played (0, 1 or 2). This is the whole
// counterweight to spreading a line around, so it is one tunable array.
const LINE_FOCUS = [0, 2, 5];
// A line is LIVE while a stage's cards are actually on the table. Derived from
// the cards rather than trusted from the flag, because a dealt card can leave by
// routes that never touch S.line — a HEX eating it, its owner going down — and
// buildHand withholds every opener while a line is in flight, so a stale flag
// would leave the party holding nothing at all until the turn rolled over.
function lineLive() {
  if (!lineOn() || !S.line) return false;
  const held = S.tempCards.some(t => t.chain && t.lineStage
    && (t.expiresTurn == null || t.expiresTurn >= S.turn)
    && livingHeroes().some(h => h.id === t.owner));
  // NEVER heal MID-PLAY. playCard pulls the played temp out of S.tempCards before
  // it resolves, and resolveCard renders — so during a line's last beat there is
  // momentarily no card behind the flag. Clearing it there wiped the record of
  // which beats had been played, and the next deal started over: two heroes traded
  // free cards forever at 0 EP, a turn that never ended. That bug was found by
  // hand-playing a turn (test/probe-line.cjs), not by the meter, which had a
  // per-turn card cap and reported it as "12 cards a turn".
  if (!held && !S.executing) S.line = null;
  return held || S.executing;
}
// Where a hero's OWN chain stands after `depth` beats of the line. Depth 1 is the
// step after their opener, 2 the step after that, and so on.
//
// A branch that has reached its FINISHER stays on it rather than running out —
// which is the whole reason this counts depth per hero instead of holding one
// party-wide stage. Lines are not all the same length: a hero with no CARD node
// runs opener → finisher, so at depth 1 they are ALREADY at their finisher while
// a treed ally is still on a combo. Both hold a card; they are just different
// distances along their own line. The party-wide-stage version of this left the
// untreed hero holding NOTHING while somebody else's line ran, which is the
// opposite of a combo the party builds together.
//
// `stance` lets the hero who REACHED stay in the line they reached into; everyone
// else answers from the row they stand in, so nobody plays out of their own kit.
function chainAtDepth(h, depth, stance) {
  const rot = ROTATIONS[h.id] && ROTATIONS[h.id][stance || h.row];
  const opener = rot && rot.cards[rot.opener];
  if (!opener) return null;
  let cur = gatedSteps(rot, opener.next);
  for (let d = 1; d < depth && cur.length; d++) {
    const nxt = [];
    cur.forEach(c => {
      // a terminal branch WAITS at its finisher; only unfinished ones advance
      const step = /FINISHER/.test(c.stance || '') ? [c] : gatedSteps(rot, c.next);
      step.forEach(n => { if (!nxt.some(x => x.name === n.name)) nxt.push(n); });
    });
    if (!nxt.length) break;
    cur = nxt;
  }
  return cur.length ? { rot, defs: cur } : null;
}
// The finisher of a line you have been carrying hits harder. Applied at DEAL time,
// not at resolve time, so the empowerment is on the card's face before the player
// chooses it — the whole point is that it is visible while the choice is open.
function applyLineFocus(c, x) {
  const beats = ((S.line && S.line.beats) || []).filter(id => id === x.id).length;
  const bonus = LINE_FOCUS[Math.min(beats, LINE_FOCUS.length - 1)];
  if (!bonus) return;
  // ONE key only, in this order — a card carrying both dmg and heal would
  // otherwise quietly collect the bonus twice.
  const k = ['dmg', 'heal', 'guard'].find(key => c.fx && c.fx[key]);
  if (!k) return;
  c.fx[k] += bonus;
  c.focus = bonus;
  // TERSE ON PURPOSE. This first read '✦ FOCUS +N — <name> has carried this line',
  // and on a card that already carries a two-line description (Crossguard, Renew)
  // it pushed the text past the card's visible area — playtested at Build 294 and
  // the descriptions were truncated mid-word. The boosted number is already on the
  // icon row; this only has to say WHY it is bigger.
  c.desc = c.desc + ' <b>✦ FOCUS +' + bonus + '</b>';
}
// THE CASTER'S BANK. Hask's ◆ CHARGE already builds on every spell he lands and
// already cashes only through OVERLOAD. What a line adds is the part the design
// asked for: the bank is bigger when he OPENS than when he merely answers, and it
// is PROVISIONAL until he closes. Take the opener and walk away and the stack
// never arrives. The field is generic on purpose — the other five heroes each want
// their own conversion of a carried line, and do not have one yet.
function bankLineCharge(h, card) {
  if (!h || h.id !== 'hask') return;
  const gain = (card.kind === 'opener') ? 2 : (card.lineStage === 'combo' ? 1 : 0);
  if (!gain) return;
  h._pendCharge = (h._pendCharge || 0) + gain;
  popupAt(figEl(h.id), '◆ ' + h._pendCharge + ' HELD', 'info');
}
// Deal the line's next beat: DISCARD every chain card on the table, then lay out
// where each living hero's own chain now stands. `ownNext` is the played card's
// own continuation — the hero who just played follows THAT branch, because they
// chose it; everyone else is walked to the same depth along theirs.
function dealBeat(from, ownNext) {
  const line = S.line;
  const laid = [];
  livingHeroes().forEach(x => {
    const stance = (line.stanceOf && line.stanceOf[x.id]) || x.row;
    const step = (x.id === from.id && ownNext && ownNext.length)
      ? { defs: ownNext }                          // you picked this branch; you stay on it
      : chainAtDepth(x, line.depth, stance);
    if (step) laid.push({ x, stance, defs: step.defs });
    // …and, once LEARNED, the thing they can do INSTEAD because an ally just
    // played into them. This is the only card on the table that exists because
    // two heroes are in the same line.
    const fu = followUpFromBond(x, from, line.opened);
    if (fu) laid.push({ x, stance, answer: fu });
  });
  if (!laid.length) return null;
  // The table clears where it sits, the way an unpicked fork sibling does — the
  // cards you did not play are GONE, and that has to be seen, not inferred.
  S.tempCards.filter(t => t.chain).forEach(old => {
    const el = document.querySelector(`#hand .card[data-uid="${old.uid}"]`); if (el) dissolveCardEl(el);
  });
  S.tempCards = S.tempCards.filter(t => !t.chain);
  const uids = [], names = [], who = [];
  laid.forEach(({ x, stance, defs, answer }) => {
    const group = ++S._chainGroup;
    const before = uids.length;
    if (answer) {
      const c = mkRotCard(x, stance, { name: answer.name, cost: 0, target: answer.target === 'opener' ? 'ally' : answer.target,
        fx: Object.assign({}, answer.fx), stance: 'FOLLOW-UP · ' + x.def.name.toUpperCase(), desc: answer.desc }, 'temp');
      c.temp = true; c.chain = true; c.branchGroup = group; c.uid = ++S._tuid; c.expiresTurn = S.turn;
      c.lineStage = 'combo';                    // an answer CONTINUES the line; it never ends it
      c.answer = true;
      c.desc = c.desc + ' <i>Following ' + (from.def ? from.def.name : 'them') + ' — your bond.</i>';
      S.tempCards.push(c);
      uids.push(c.uid); names.push(answer.name);
      if (uids.length > before) who.push(x);
      return;
    }
    defs.forEach(def => {
      const c = genChainStep(x, stance, def, group);
      if (!c) return;
      c.lineStage = /FINISHER/.test(def.stance || '') ? 'finisher' : 'combo';
      // The stance label is left ALONE — half the engine reads `^COMBO` /
      // `^FINISHER` off this string for the finisher's EP cost, the bond chain's
      // trigger and the meters. What is worth saying on the card face is the
      // FOCUS bonus, and applyLineFocus says it.
      if (c.lineStage === 'finisher') {
        applyLineFocus(c, x);
        // A POWER-UP answer earlier in the line pays out HERE, on whoever closes.
        const rally = (S.line && S.line.rally) || 0;
        if (rally) { const k = ['dmg', 'heal', 'guard'].find(key => c.fx && c.fx[key]);
          if (k) { c.fx[k] += rally; c.desc = c.desc + ' <b>▲ +' + rally + '</b>'; } }
      }
      uids.push(c.uid); names.push(def.name);
    });
    if (uids.length > before) who.push(x);
  });
  if (!uids.length) return null;
  S._forgeEvent = { heroId: from.id, uids, pick: uids.length > 1 };
  S._tempNew = S._tuid;
  // A follow-up entry carries `answer`, not `defs` — reading defs off it crashed
  // combat the moment a bonded party opened a line (caught by hand-playing the
  // funmeter's stalled LATE row; the meter's try/catch had swallowed the throw
  // every turn and reported it as a 16-turn fight nobody won). A follow-up on
  // the table also means the beat is NOT all finishers.
  return { uids, names, who, finishing: laid.every(l => l.defs && l.defs.every(d => /FINISHER/.test(d.stance || ''))) };
}
// Everything a line does when one of its beats is played.
//
// ONE RULE, NOT A STAGE TABLE: playing any card advances the line one beat, and a
// FINISHER ends it. There is no party-wide stage to keep in step and no "skip the
// combo stage when nobody has one" special case — a hero whose line is shorter is
// simply already holding their finisher while a treed ally is still on a combo.
function resolveLinePlay(card, h) {
  const line = S.line || { beats: [], depth: 0, opener: h.id, stanceOf: {} };
  if (card.kind === 'opener') { line.opener = h.id; line.depth = 0; line.stanceOf = {}; line.stanceOf[h.id] = card.chainStance; }
  line.beats.push(h.id);
  line.depth++;
  line.opened = card;          // what an ANSWER reads its trigger off
  if (card.answer) { line.answered = line.answered || []; line.answered.push(h.id); }
  S.line = line;
  bankLineCharge(h, card);
  // The card that ENDS a line is the finisher, whenever in the line it lands.
  if (card.lineStage === 'finisher') return closeLine(h, card);
  const rot = ROTATIONS[h.id] && ROTATIONS[h.id][card.chainStance];
  const ownNext = rot ? gatedSteps(rot, card.chainNext) : null;
  const dealt = dealBeat(h, ownNext);
  if (!dealt) return closeLine(h);
  SFX.card();
  // NO QUIZ. This used to shout "✦ WHO ANSWERS?" / "✦ WHO FINISHES?" over the
  // hero every beat — the game asking the player a rhetorical question in the
  // middle of its own combat, which reads as tutorial copy rather than as a
  // fight. The line's state is already legible from the table: the cards say
  // COMBO or FINISHER on their faces. Name the beat and get out of the way.
  popupAt(figEl(h.id), dealt.finishing ? '✦ FINISH' : '✦ THE LINE', 'rally');
  flashNarrator('<b>' + h.def.name + '</b> ' + (card.kind === 'opener' ? 'opens' : 'carries') + ' — '
    + dealt.names.join(' · ') + '.');
  lesson('line', 'THE LINE IS THE PARTY\u2019S — any card deals the next beat to everyone. Carry it for a bigger FINISHER, or pass it and light a bond.', 3);
}
// The line is spent: commit or forfeit what was banked on it, clear the table, and
// give the openers back to whoever has not opened yet. EP decides what happens next.
function closeLine(closer, finisher) {
  // ── THE ECHO REMEMBERS (Build 307) ────────────────────────────────────────
  // Measured at 306: from mid-run on, every boss fight ends untouched at 100%
  // HP in ~3 turns — the engine grows all game and the opposition stops
  // mattering, so the late fights are the least interesting ones. The fix is
  // not bigger numbers; it is a boss that ANSWERS the system the player built.
  // A floor boss is an ECHO, and an echo has heard your ending before: each
  // finisher that closes a line against it is REMEMBERED, and a remembered
  // finisher lands blunted (half) ever after. Repeating your best line stops
  // working; the question the whole design runs on — who closes, with what —
  // comes back on the boss fight, where it was most absent. Mobs never learn;
  // this is a boss's answer, not a global tax.
  if (closer && finisher && finisher.name) {
    livingEnemies().filter(e => e.def.boss).forEach(e => {
      e._echoMem = e._echoMem || new Set();
      if (!e._echoMem.has(finisher.name)) {
        e._echoMem.add(finisher.name);
        popupAt(figEl(e.uid), '◈ IT REMEMBERS ' + finisher.name.toUpperCase(), 'info');
        flashNarrator('<b>' + e.def.name + '</b> has heard that ending — <b>' + finisher.name + '</b> will not land so hard again.');
      }
    });
  }
  livingHeroes().forEach(x => {
    if (!x._pendCharge) return;
    if (closer && x.id === closer.id) {
      x.charge = Math.min(chargeCap(x), (x.charge || 0) + x._pendCharge);
      popupAt(figEl(x.id), '◆ +' + x._pendCharge, 'info');
    } else {
      // He opened, somebody else closed: the stack never arrives.
      popupAt(figEl(x.id), '◆ ' + x._pendCharge + ' LOST', 'dmg');
    }
    x._pendCharge = 0;
  });
  S.tempCards = S.tempCards.filter(t => !t.chain);
  S.line = null;
}
function resolveChainPlay(card) {
  if (!card || !card.chain) return;
  const h = S.heroes.find(x => x.id === card.owner);
  if (!h || h.downed) return;

  if (lineOn() && (card.kind === 'opener' || card.lineStage)) return resolveLinePlay(card, h);
  if (!(card.chainNext && card.chainNext.length)) return;

  const rot = ROTATIONS[card.owner] && ROTATIONS[card.owner][card.chainStance];
  if (!rot) return;
  const group = ++S._chainGroup;
  const forged = [], uids = [];
  gatedSteps(rot, card.chainNext).forEach(def => {
    const c = genChainStep(h, card.chainStance, def, group);
    if (c) { forged.push(def.name); uids.push(c.uid); }
  });
  if (!forged.length) return;
  // Hand the render layer a FORGE EVENT: which hero forged, which card uids, and
  // whether it's a real fork — renderActionBar burns the cards in (staggered) and
  // arcs ember shards from the hero into the new cards so the branch is SEEN.
  S._forgeEvent = { heroId: h.id, uids, pick: forged.length > 1 };
  S._tempNew = S._tuid;
  SFX.card();
  const many = forged.length > 1;
  popupAt(figEl(h.id), many ? '✦ TWO PATHS' : '✦ ' + forged[0], 'rally');
  flashNarrator(h.def.name + (many
    ? ' opens two lines — <b>' + forged.join('</b> or <b>') + '</b>.'
    : ' forges <b>' + forged[0] + '</b>.'));
  // The fork's whole tension is that taking one path BURNS the other, and the
  // line above says "opens two lines" without ever naming that cost.
  if (many) lesson('fork', 'TWO PATHS, ONE CHOICE — play either card and the other burns away. Pick the line this fight needs.', 3);
}
// stance change abandons an in-progress rotation (forged steps clear; the opener
// of the NEW stance returns) — repositioning mid-chain is a real cost.
//
// A LINE IS ABANDONED WHOLE.  The line in flight belongs to the party, not to the
// hero standing in it, so one hero stepping out of formation drops it for
// everyone — the same cost the solo chain always paid, at the scale the thing now
// lives at. Deliberate: purging only the mover's own dealt card would leave a
// stage half-dealt with nobody able to advance it, and the heroes who never moved
// would silently lose the beat with no card and no explanation. Whatever was
// BANKED on the line goes with it (see closeLine with no closer), and the openers
// come back for anyone who has not opened yet, so the party can start over — at
// the cost of every beat already spent.
function purgeChain(heroId) {
  const inFlight = lineLive();
  const had = S.tempCards.some(t => t.chain && (inFlight || t.owner === heroId));
  S.tempCards = S.tempCards.filter(t => !(t.chain && (inFlight || t.owner === heroId)));
  if (inFlight) closeLine(null);
  // Only teach it when it actually COST something — a purge with no open chain
  // is invisible and teaching it there would be noise.
  if (had) {
    const h = S.heroes.find(x => x.id === heroId);
    lesson('purge', inFlight
      ? 'MOVING DROPS THE LINE — ' + ((h && h.def.name) || 'they') + ' left it, so the whole party’s combo is gone, not just theirs. Close the line before anyone repositions.'
      : 'MOVING BREAKS THE COMBO — ' + ((h && h.def.name) || 'they') + ' left the line, so the rest of the rotation is gone. Finish a combo before you reposition.', 3);
  }
}

// ---------------------------------------------------------------------------
// DATA — enemies.  Intents telegraph damage + the PARTY ROW they strike.
// def.art overrides the portrait key (the remembered Echo Knight reuses art).
// ---------------------------------------------------------------------------
const ENEMY_DEFS = {
  // REGULAR MOBS — each reads through the parry AXES (gesture · input size ·
  // speed · damage), so a fight expresses WHO you're facing, not just a number:
  // the Husk lumbers (slow single taps), the Wraith flurries (fast mash), the
  // Cultist channels (braced holds + expose), the Mourner wails (wide arc sweeps
  // over the whole party), the Drone turtles then SLAMS (a big telegraphed tap).
  husk: {
    // 18 HP: survives Cleave+Crashing Wave (17) so the FIRST fight forces one
    // real decision — eat the telegraphed hit, or learn to change stance.
    // A lumbering brute: slow, simple, readable — the game's parry primer.
    weak: 'light', name: 'HOLLOW HUSK', maxHp: 18, parrySpeed: 0.9,
    intents: [
      { name: 'Heavy Claw', dmg: 4, row: 'front', attackArt: 'claw',  parry: { kind: 'tap' } },
      { name: 'Lurch',      dmg: 3, row: 'mid',   attackArt: 'slash', parry: { kind: 'tap' } },
      { name: 'Wither', kind: 'buff', desc: 'hardens', guardSelf: 3 },
    ],
  },
  wraith: {
    // A flitting phantom: FAST and many-handed — a flurry you MASH, a chill wail
    // that sweeps the whole line.  Low damage per touch, but relentless.
    weak: 'blade', name: 'PALE WRAITH', maxHp: 16, parrySpeed: 1.35,
    intents: [
      { name: 'Grasping Flurry', dmg: 4, row: 'back', attackArt: 'claw',  parry: { kind: 'mash', count: 3 } },
      { name: 'Chill Wail',      dmg: 2, row: 'all',  chill: 1, attackArt: 'blast', parry: { kind: 'swipe', arc: 'arcAcross', across: true } },
      { name: 'Phantom Rush',    dmg: 3, row: 'mid',  attackArt: 'slash', parry: { kind: 'multi', count: 2 } },
    ],
  },
  cultist: {
    // A ritual caster: it CHANNELS — a braced HOLD you must weather — and its
    // dark verse leaves you EXPOSED.  Punish the chant before it gathers.
    weak: 'blade', name: 'ASHEN CULTIST', maxHp: 15, parrySpeed: 1.0,
    intents: [
      { name: 'Sacrificial Knife', dmg: 5, row: 'front', attackArt: 'slash', parry: { kind: 'multi', count: 2 } },
      { name: 'Dark Channel',      dmg: 6, row: 'mid', expose: 2, attackArt: 'blast', parry: { kind: 'hold', size: 'big' } },
      { name: 'Blood Chant', kind: 'buff', desc: 'gathers power', powerSelf: 2 },
    ],
  },
  mourner: {
    // A keening wailer: wide, sweeping grief that washes over the WHOLE party —
    // you DEFLECT it along a big arc.  Rallies the horde when left alone.
    weak: 'iron', name: 'GRAVE MOURNER', maxHp: 18, parrySpeed: 1.0,
    intents: [
      { name: 'Dirge',         dmg: 3, row: 'all', attackArt: 'blast', parry: { kind: 'swipe', arc: 'arcAcross', across: true } },
      { name: 'Sorrowing Arc', dmg: 5, row: 'mid', attackArt: 'claw',  parry: { kind: 'swipe', arc: 'arcR' } },
      { name: 'Keening', kind: 'buff', desc: 'keens the horde onward', powerAll: 1 },
    ],
  },
  drone: {
    // An armored turtle: it HARDENS, bides, then drops a single crushing SLAM that
    // KNOCKS the front hero back a row — a big, slow, telegraphed tap.  Deny the
    // shell, weather the hammer, or parry to hold your footing.
    weak: 'iron', name: 'HOLLOW DRONE', maxHp: 20, parrySpeed: 0.9,
    intents: [
      { name: 'Refrain',     dmg: 5, row: 'front', attackArt: 'slash', parry: { kind: 'multi', count: 2 } },
      { name: 'Piston Slam', dmg: 7, row: 'front', shove: 'back', attackArt: 'slam',  parry: { kind: 'tap', size: 'big' } },
      { name: 'Harden', kind: 'buff', desc: 'hardens', guardSelf: 4 },
    ],
  },
  // ── EXPANDED BESTIARY — three foes that open new axes ──────────────────────
  // GNAWING BROOD — the FREQUENCY axis: it strikes TWICE a round, two small fast
  // telegraphs to answer.  Individually weak, lethal when it swarms you.
  brood: {
    weak: 'blade', name: 'GNAWING BROOD', maxHp: 22, parrySpeed: 1.4, attacksPerRound: 2,
    intents: [
      { name: 'Gnaw',       dmg: 3, row: 'front', attackArt: 'claw',  parry: { kind: 'mash', count: 3 } },
      { name: 'Skitter',    dmg: 2, row: 'mid',   attackArt: 'slash', parry: { kind: 'multi', count: 2 } },
      { name: 'Swarm Over', dmg: 2, row: 'all',   attackArt: 'claw',  parry: { kind: 'swipe', arc: 'arcAcross', across: true } },
    ],
  },
  // DIRGE CANTOR — POSITIONAL / status artillery: a back-line caster that debuffs
  // the whole party and EMPOWERS the horde.  Braced channels; kill it first.
  cantor: {
    weak: 'light', name: 'DIRGE CANTOR', maxHp: 20, parrySpeed: 1.0,
    intents: [
      { name: 'Wailing Verse', dmg: 4, row: 'back', chill: 1,  attackArt: 'blast', parry: { kind: 'hold', size: 'big' } },
      { name: 'Dirge of Ruin', dmg: 3, row: 'all',  expose: 2, attackArt: 'blast', parry: { kind: 'swipe', arc: 'arcAcross', across: true } },
      { name: 'Requiem', kind: 'buff', desc: 'empowers the choir', powerAll: 2 },
    ],
  },
  // ECHO REVENANT — the INPUT-SIZE axis: an elite mini-boss with real boss-style
  // multi-note CASCADES you parry as a sequence.  Its Chain Hook DRAGS a back-line
  // hero into the front — punishing squishy casters (and a charged Hask, who
  // MISFIRES when yanked).  The elite fight that bites, positionally too.
  revenant: {
    weak: 'blade', name: 'ECHO REVENANT', maxHp: 38, parrySpeed: 1.1,
    intents: [
      { name: 'Phantom Combo',  dmg: 8,  row: 'front', attackArt: 'slash', parry: { kind: 'seq', notes: [{ t: 'tap' }, { t: 'tap' }, { t: 'swipe', arc: 'arcR' }] } },
      { name: 'Chain Hook', dmg: 4, row: 'back', shove: 'front', attackArt: 'claw', parry: { kind: 'seq', notes: [{ t: 'swipe', arc: 'arcL' }, { t: 'tap' }] } },
      { name: 'Echoed Guard', kind: 'buff', desc: 'echoes a ward', guardSelf: 5 },
      { name: 'REMEMBERED END', dmg: 11, row: 'all', heavy: true, expose: 2, attackArt: 'blast', parry: { kind: 'seq', notes: [{ t: 'tap' }, { t: 'hold' }, { t: 'tap' }, { t: 'swipe', arc: 'arcU' }] } },
    ],
  },
  echoknight: {
    weak: 'blade', name: 'THE ECHO KNIGHT', maxHp: 56, boss: true,
    intents: [
      { name: 'Returning Stroke', dmg: 7, row: 'front' },
      { name: 'Echoed Arc',       dmg: 5, row: 'mid' },
      { name: 'Remembered Blade', dmg: 6, row: 'back' },
      { name: 'OBLIVION ECHO',    dmg: 10, row: 'all', heavy: true },
    ],
  },
  echoknight2: {
    weak: 'blade', name: 'THE ECHO KNIGHT, REMEMBERED', maxHp: 112, boss: true, floorBoss: true, art: 'echoknight',
    attacksPerRound: 2,   // the colossus strikes TWICE each round — two telegraphs to answer
    intents: [
      // The floor boss fills the field; its blows are CASCADES you parry as a
      // sequence — taps racing down an arc, a braced hold, a deflect sweep.
      { name: 'Returning Stroke', dmg: 9,  row: 'front', attackArt: 'slash', parry: { kind: 'seq', notes: [{ t: 'tap' }, { t: 'tap' }, { t: 'tap' }] } },
      { name: 'Gathers the Echo', kind: 'buff', desc: 'the echo swells', powerSelf: 3 },
      { name: 'Echoed Arc',       dmg: 7,  row: 'mid',  attackArt: 'claw', parry: { kind: 'seq', notes: [{ t: 'swipe', arc: 'arcR' }, { t: 'tap' }, { t: 'tap' }] } },
      { name: 'Remembered Blade', dmg: 8,  row: 'back', expose: 2, attackArt: 'slam', parry: { kind: 'seq', notes: [{ t: 'tap' }, { t: 'tap' }, { t: 'hold' }] } },
      { name: 'OBLIVION ECHO',    dmg: 13, row: 'all', heavy: true, attackArt: 'blast', parry: { kind: 'seq', notes: [{ t: 'tap' }, { t: 'tap' }, { t: 'tap' }, { t: 'swipe', arc: 'arcU' }, { t: 'hold' }] } },
    ],
  },
  // FLOOR 2 boss — a different concept from the Echo Knight.  Not a rhythm of
  // remembered strokes but a HUNGER: it HUNTS the weakest of you (smart) and
  // DRAINS life from every blow to heal itself, so you can't just out-race it —
  // you have to deny the damage.  Parries lean on braced HOLDs ("resist the pull").
  echodevourer: {
    weak: 'light', name: 'THE HOLLOW MAW', maxHp: 132, boss: true, floorBoss: true, art: 'echoknight', aura: 'maw',
    attacksPerRound: 2,
    intents: [
      { name: 'Cursed Reach', dmg: 5,  row: 'front', hex: 2, attackArt: 'claw',  parry: { kind: 'seq', notes: [{ t: 'tap' }, { t: 'hold' }] } },
      { name: 'The Hunger Deepens', kind: 'buff', desc: 'it feeds and swells', powerSelf: 2 },
      { name: 'DEVOUR',        dmg: 6,  row: 'front', drain: 0.6, attackArt: 'slam', parry: { kind: 'seq', notes: [{ t: 'hold' }, { t: 'tap' }, { t: 'hold' }] } },
      { name: 'Withering Wail', dmg: 4, row: 'all', chill: 1, attackArt: 'blast', parry: { kind: 'seq', notes: [{ t: 'swipe', arc: 'arcAcross' }, { t: 'tap' }] } },
      { name: 'THE GREAT GORGE', dmg: 7, row: 'all', heavy: true, drain: 0.4, attackArt: 'blast', parry: { kind: 'seq', notes: [{ t: 'hold' }, { t: 'tap' }, { t: 'swipe', arc: 'arcU' }, { t: 'tap' }, { t: 'hold' }] } },
    ],
  },
  // FLOOR 3 boss — a wholly different threat: it does not out-HP or out-drain
  // you, it attacks the KIZUNA itself.  A SEVER strike cuts a formed thread,
  // undoing your resonance progress — the only foe that fights the bond system
  // the whole game is built on.  Weak to SONG (♫ — harmony mends what it cuts).
  // Its blows are cutting strokes you DEFLECT (swipe-heavy parries).  A PERFECT
  // parry holds the thread together; miss it and the bond snaps.
  echosunder: {
    weak: 'frost', name: 'THE SUNDERING', maxHp: 152, boss: true, floorBoss: true, art: 'echoknight', aura: 'sunder',
    attacksPerRound: 2,
    intents: [
      { name: 'Cut the Bond', dmg: 6, row: 'front', sever: 1, attackArt: 'slash', parry: { kind: 'seq', notes: [{ t: 'swipe', arc: 'arcR' }, { t: 'tap' }] } },
      { name: 'The Unmaking', kind: 'buff', desc: 'it unravels the world', powerSelf: 3 },
      { name: 'Isolation', dmg: 8, row: 'mid', chill: 1, attackArt: 'claw', parry: { kind: 'seq', notes: [{ t: 'tap' }, { t: 'swipe', arc: 'arcL' }, { t: 'tap' }] } },
      { name: 'Fraying Chord', dmg: 5, row: 'back', sever: 1, attackArt: 'blast', parry: { kind: 'seq', notes: [{ t: 'swipe', arc: 'arcU' }, { t: 'tap' }] } },
      { name: 'THE GREAT UNRAVELING', dmg: 12, row: 'all', heavy: true, sever: 3, attackArt: 'blast', parry: { kind: 'seq', notes: [{ t: 'tap' }, { t: 'swipe', arc: 'arcAcross' }, { t: 'tap' }, { t: 'swipe', arc: 'arcU' }, { t: 'hold' }] } },
    ],
  },
  // ═══ THE MEGA BOSS (FLOOR 4) — the source the three floor bosses were only
  // fragments of.  A MULTI-STAGE fight: it wears each prior aspect in turn, then
  // becomes the whole.  `stages[]` each carry their own name / weak / aura / HP /
  // intents; the engine swaps `e.def` to the live stage (see enterMegaStage), so
  // every stage teaches its own weakness and telegraphs its own cascades.  Two
  // NEW mechanics debut here, each a fusion of earlier ones:
  //   ECHO    — an unparried echo strike RETURNS next round, stronger (the
  //             Knight's memory).  A PERFECT parry silences it.
  //   DISCORD — an unparried discord strike SEVERS a thread AND heals the Chorus
  //             from the broken bond (the Sundering's cut + the Maw's hunger).
  // Parry sequences run up to FIVE notes in succession — the climax of the game.
  echochorus: {
    name: 'THE HOLLOW CHORUS', weak: 'blade', boss: true, floorBoss: true, megaBoss: true, art: 'echoknight',
    attacksPerRound: 2, maxHp: 1,   // placeholder — real HP is per-stage (see enterMegaStage)
    stages: [
      // STAGE 1 — THE REMEMBERED (blade / rhythm).  Fast TAP cascades that GROW
      // as it gathers the echo; its Remembered Cascade ECHOes if you miss it.
      { key: 'remembered', name: 'THE REMEMBERED', epithet: 'IT KEEPS THE BEAT', aura: null, weak: 'blade', maxHp: 150, eye: '#ff5038', roar: 'blade',
        attacksPerRound: 3,   // stage 1: the parry load rises each stage (3 → 4 → 5)
        quote: 'I wore his face first. You remember the Knight — so does he.',
        intents: [
          { name: 'Returning Stroke', dmg: 8, row: 'front', attackArt: 'slash', parry: { kind: 'seq', notes: [{ t: 'tap' }, { t: 'tap' }, { t: 'tap' }] } },
          { name: 'Gathers the Echo', kind: 'buff', desc: 'the beat quickens', powerSelf: 3 },
          { name: 'Remembered Cascade', dmg: 7, row: 'mid', echo: true, echoBonus: 4, attackArt: 'claw', parry: { kind: 'seq', notes: [{ t: 'tap' }, { t: 'swipe', arc: 'arcR' }, { t: 'tap' }, { t: 'tap' }] } },
          { name: 'CRESCENDO', dmg: 11, row: 'all', heavy: true, attackArt: 'blast', parry: { kind: 'seq', notes: [{ t: 'tap' }, { t: 'tap' }, { t: 'tap' }, { t: 'swipe', arc: 'arcU' }, { t: 'hold' }] } },
        ] },
      // STAGE 2 — THE DEVOURING (light / hunger).  Braced HOLDs; DRAIN heals it,
      // HEX burns your hand, and it HUNTS your weakest.  Deny the damage.
      { key: 'devouring', name: 'THE DEVOURING', epithet: 'IT IS STILL HUNGRY', aura: 'maw', weak: 'light', maxHp: 165, eye: '#a86bff', roar: 'maw',
        attacksPerRound: 4, parrySpeed: 0.82,   // stage 2 — faster cascades
        quote: 'The Maw never stopped eating. It only learned patience.',
        intents: [
          { name: 'Cursed Reach', dmg: 6, row: 'front', hex: 2, attackArt: 'claw', parry: { kind: 'seq', notes: [{ t: 'tap' }, { t: 'hold' }] } },
          { name: 'The Hunger Swells', kind: 'buff', desc: 'it feeds and grows', powerSelf: 2 },
          { name: 'DEVOUR', dmg: 7, row: 'front', drain: 0.6, attackArt: 'slam', parry: { kind: 'seq', notes: [{ t: 'hold' }, { t: 'tap' }, { t: 'hold' }] } },
          { name: 'Withering Chorus', dmg: 5, row: 'all', chill: 1, hex: 1, attackArt: 'blast', parry: { kind: 'seq', notes: [{ t: 'swipe', arc: 'arcAcross' }, { t: 'tap' }, { t: 'hold' }] } },
          { name: 'THE GREAT GORGE', dmg: 9, row: 'all', heavy: true, drain: 0.5, attackArt: 'blast', parry: { kind: 'seq', notes: [{ t: 'hold' }, { t: 'tap' }, { t: 'swipe', arc: 'arcU' }, { t: 'tap' }, { t: 'hold' }] } },
        ] },
      // STAGE 3 — THE UNMAKING (song / bonds).  SWIPE deflects; SEVER cuts threads
      // and the new DISCORD feeds it from every bond it breaks.  THE LAST CHORD is
      // the climax: a five-note sequence that unmakes the whole line at once.
      { key: 'unmaking', name: 'THE UNMAKING', epithet: 'IT FEEDS ON THE BOND', aura: 'sunder', weak: 'iron', maxHp: 190, eye: '#8fe0d0', roar: 'maw',
        attacksPerRound: 5, parrySpeed: 0.68,   // stage 3 — the climax: five fast strikes to read
        quote: 'The fire remembers you to each other. I remember you to me. One of us will keep you forever.',
        intents: [
          { name: 'Cut the Bond', dmg: 7, row: 'front', sever: 1, attackArt: 'slash', parry: { kind: 'seq', notes: [{ t: 'swipe', arc: 'arcR' }, { t: 'tap' }] } },
          { name: 'DISCORD', dmg: 8, row: 'mid', discord: 1, attackArt: 'claw', parry: { kind: 'seq', notes: [{ t: 'swipe', arc: 'arcL' }, { t: 'tap' }, { t: 'swipe', arc: 'arcR' }] } },
          { name: 'The Unmaking', kind: 'buff', desc: 'it unravels the world', powerSelf: 3 },
          { name: 'Fraying Chord', dmg: 6, row: 'back', sever: 1, echo: true, echoBonus: 5, attackArt: 'blast', parry: { kind: 'seq', notes: [{ t: 'swipe', arc: 'arcU' }, { t: 'tap' }] } },
          { name: 'THE LAST CHORD', dmg: 12, row: 'all', heavy: true, discord: 2, attackArt: 'blast', parry: { kind: 'seq', notes: [{ t: 'tap' }, { t: 'swipe', arc: 'arcAcross' }, { t: 'hold' }, { t: 'swipe', arc: 'arcU' }, { t: 'hold' }] } },
        ] },
    ],
  },
};

// ---------------------------------------------------------------------------
// DATA — the ten resonant cards, one per class-triangle of the roster.
// Four families: Offense / Defense / Formation / Utility.  Stage fx verbs:
//   aoeDmg hitFrontmost healAll guardAll guardFront buffAllDmg lullAll
//   markAll counterAll invulnFront pushBack
// ---------------------------------------------------------------------------
const RESONANT_TABLE = {
  'Bard+Cleric+Ronin': {
    name: 'Threefold Vow', type: 'Offense',
    desc: 'Strike ALL enemies 8 · heal the party 6 · the party gains 5 guard.',
    stages: [
      { text: 'the blade answers every line at once',  fx: { aoeDmg: 8 } },
      { text: 'light closes every wound',              fx: { healAll: 6 } },
      { text: 'the song turns to armor',               fx: { guardAll: 5 } },
    ],
  },
  'Bard+Cleric+Guardian': {
    name: 'Divine Bastion', type: 'Defense',
    desc: 'Your FRONT hero becomes INVULNERABLE this round · heal the party 4.',
    stages: [
      { text: 'the gate becomes a sanctum — untouchable', fx: { invulnFront: true } },
      { text: 'grace settles over the line',              fx: { healAll: 4 } },
    ],
  },
  'Bard+Cleric+Mage': {
    name: 'Hymn of Still Water', type: 'Utility',
    desc: 'ALL enemies deal −3 on their next attack · heal the party 5.',
    stages: [
      { text: 'the hymn slows every raised hand', fx: { lullAll: 3 } },
      { text: 'still water closes over the hurt', fx: { healAll: 5 } },
    ],
  },
  'Bard+Guardian+Mage': {
    name: 'Frozen Bulwark', type: 'Defense',
    desc: 'The party gains 7 guard · everyone counters attackers for 3 this round.',
    stages: [
      { text: 'frost climbs the shield-wall',   fx: { guardAll: 7 } },
      { text: 'the wall remembers who struck it', fx: { counterAll: 3 } },
    ],
  },
  'Bard+Guardian+Ronin': {
    name: 'Warsong Phalanx', type: 'Formation',
    desc: 'PUSH every enemy back one row · the party gains 4 guard.',
    stages: [
      { text: 'the warsong drives them backward', fx: { pushBack: true } },
      { text: 'the phalanx sets its feet',        fx: { guardAll: 4 } },
    ],
  },
  'Bard+Mage+Ronin': {
    name: 'Killing Tempo', type: 'Offense',
    desc: 'Strike ALL enemies 5 · every ally’s next damaging card deals +3.',
    stages: [
      { text: 'the tempo sharpens to a knife', fx: { aoeDmg: 5 } },
      { text: 'every hand finds the beat',     fx: { buffAllDmg: 3 } },
    ],
  },
  'Cleric+Guardian+Mage': {
    name: 'Frost Sanctum', type: 'Utility',
    desc: 'Heal the party 6 · the party gains 3 guard · ALL enemies deal −2 next attack.',
    stages: [
      { text: 'the sanctum seals its doors',  fx: { healAll: 6, guardAll: 3 } },
      { text: 'cold quiets the killing mood', fx: { lullAll: 2 } },
    ],
  },
  'Cleric+Guardian+Ronin': {
    name: 'Oathkeepers’ Advance', type: 'Formation',
    desc: 'PUSH every enemy back one row · heal the party 4 · your FRONT hero gains 5 guard.',
    stages: [
      { text: 'the oath walks forward and the dark gives way', fx: { pushBack: true } },
      { text: 'the line holds behind the shield',              fx: { healAll: 4, guardFront: 5 } },
    ],
  },
  'Cleric+Mage+Ronin': {
    name: 'Last Rite', type: 'Offense',
    desc: '12 damage to the NEAREST enemy · heal the party 4.',
    stages: [
      { text: 'one name is written, one rite is read', fx: { hitFrontmost: 12 } },
      { text: 'what was spent returns',                fx: { healAll: 4 } },
    ],
  },
  'Guardian+Mage+Ronin': {
    name: 'Shatterpoint', type: 'Offense',
    desc: 'MARK every enemy (+3 from every hit) · strike ALL enemies 5.',
    stages: [
      { text: 'frost finds every fault-line', fx: { markAll: 3 } },
      { text: 'and the hammer falls',         fx: { aoeDmg: 5 } },
    ],
  },
  // Reaver (Mira) trios — the shadow marks, the party executes.
  'Cleric+Guardian+Reaver': {
    name: 'Veiled Bulwark', type: 'Defense',
    desc: 'The party gains 6 guard · heal the party 4 · MARK every enemy (+3 from every hit).',
    stages: [
      { text: 'shadows fold around the wall', fx: { guardAll: 6 } },
      { text: 'and mend what the dark spared', fx: { healAll: 4, markAll: 3 } },
    ],
  },
  'Cleric+Reaver+Ronin': {
    name: 'Twin Shadows', type: 'Offense',
    desc: 'MARK every enemy (+3) · strike ALL enemies 6 · heal the party 3.',
    stages: [
      { text: 'two blades open the dark', fx: { markAll: 3 } },
      { text: 'and bleed it dry',         fx: { aoeDmg: 6, healAll: 3 } },
    ],
  },
  'Guardian+Reaver+Ronin': {
    name: 'Executioner’s Wall', type: 'Offense',
    desc: 'MARK every enemy (+3) · the FRONT hero gains 6 guard · 12 to the nearest enemy.',
    stages: [
      { text: 'the wall names its mark', fx: { markAll: 3, guardFront: 6 } },
      { text: 'and the shadow ends it',  fx: { hitFrontmost: 12 } },
    ],
  },
  // Ranger (Branwen) trios — she marks from range, the line cashes the wound.
  'Cleric+Ranger+Ronin': {
    name: 'Hunter’s Grace', type: 'Offense',
    desc: 'MARK every enemy (+3) · strike ALL enemies 5 · heal the party 3.',
    stages: [
      { text: 'she names every wound from the dark', fx: { markAll: 3 } },
      { text: 'and the volley falls with mercy behind it', fx: { aoeDmg: 5, healAll: 3 } },
    ],
  },
  'Guardian+Ranger+Ronin': {
    name: 'Killing Field', type: 'Offense',
    desc: 'MARK every enemy (+3) · the FRONT hero gains 5 guard · 12 to the nearest enemy.',
    stages: [
      { text: 'the wall pins them, the arrow marks them', fx: { markAll: 3, guardFront: 5 } },
      { text: 'and the killshot lands',                    fx: { hitFrontmost: 12 } },
    ],
  },
  'Ranger+Reaver+Ronin': {
    name: 'No Quarter', type: 'Offense',
    desc: 'MARK every enemy (+4) · strike ALL enemies 6.',
    stages: [
      { text: 'two hunters call the same mark', fx: { markAll: 4 } },
      { text: 'and nothing walks out',          fx: { aoeDmg: 6 } },
    ],
  },
};
const RESONANT_FALLBACK = {
  name: 'Triad Strike', type: 'Offense',
  desc: 'The three strike as one: 6 damage to every enemy.',
  stages: [{ text: 'the triad strikes as one', fx: { aoeDmg: 6 } }],
};

function duetClassKey(a, b) { return [HEROES[a].cls, HEROES[b].cls].sort().join('+'); }

// ---------------------------------------------------------------------------
// BONDS, REFORGED — a woven pair is no longer a card, nor a hidden passive.  It's
// a live WEAVE that plays out as a legible BOND ASSIST: when you ATTACK with a
// woven hero, their partner STEPS IN with a follow-up (see bondAssist), ONCE per
// bond per turn — a clear "your relationships have your back" beat.  At the
// ALL-OUT the bonds EMPOWER the team's assault, and a full triad crowns it with a
// single team finisher (see resolveAllOut).  BOND_WEAVE names the pair + its save.
const BOND_WEAVE = {
  'Cleric+Ronin':    { name: 'Warded Edge',    icon: '⚔' },
  'Reaver+Ronin':    { name: 'Twin Edge',      icon: '✕' },
  'Cleric+Reaver':   { name: 'Silent Mercy',   icon: '✚' },
  'Guardian+Ronin':  { name: 'Shield & Sword', icon: '⛨' },
  'Guardian+Cleric': { name: 'Sanctified Wall', icon: '✛', save: true },   // while both stand, neither falls (once/fight)
  'Guardian+Reaver': { name: 'Wall & Whisper', icon: '◎' },
  'Ranger+Ronin':    { name: 'Marked Charge',  icon: '➹' },
  'Cleric+Ranger':   { name: 'Covered Advance', icon: '❂' },
  'Ranger+Reaver':   { name: 'Kill Order',     icon: '☠' },
  'Guardian+Ranger': { name: 'Anvil & Arrow',  icon: '➶' },
  'Mage+Ronin':      { name: 'Rimeblade',      icon: '❄' },   // Hask's frost pairs — the shatter setup
  'Cleric+Mage':     { name: 'Hallowed Frost', icon: '❉' },
  'Guardian+Mage':   { name: 'Frostwall',      icon: '❆' },
  'Mage+Ranger':     { name: 'Frostmark',      icon: '❅' },
  'Mage+Reaver':     { name: 'Killing Frost',  icon: '✻' },
};
// ── DUET PERKS (Build 223) — the named weaves finally DO something distinct.
// The moment a pair BONDS this fight (their thread forms), the pairing's named
// perk switches on — live while both stand, gone if either falls.  This is
// where team composition changes what Kizuna IS: a Mira/Branwen line plays
// kill-chains, a Cassia/Hask line plays a frozen fortress.  Each entry is a
// make(a, b) factory returning a boon-shaped effect on the proven trigger
// vocabulary (incoming / dmgMod / kill / turnStart / card), so the existing
// dispatch carries all of it — no new seams.
const DUET_PERKS = {
  'Cleric+Ronin': { line: ['Stay in front. I have you.', 'Then I don\'t have to look back.'],
    desc: 'the Cleric gets there before the next blow — <b>when any ally falls under half</b>, she mends them <b>8</b> and sets <b>⛨4</b>. Once a fight.',
    strike: true, make: () => ({}) },
  'Reaver+Ronin': { line: ['You opened it — I\'ll finish it.', 'Where you cut, I cut deeper.'],
    desc: 'two blades into one opening — <b>when a foe BREAKS</b>, both of them cut it for <b>7</b>. Once a fight.',
    strike: true, make: () => ({}) },
  'Cleric+Reaver': { line: ['Killing is not the end of it.', 'Then mend what I leave standing.'], desc: 'mercy follows the knife — every kill <b>mends the most-wounded ally 2</b>',
    make: (a, b) => ({ trigger: 'kill', apply: () => { const t = lowestHpAlly();
      if (t && t.hp < t.maxHp) { t.hp = Math.min(healCap(t), t.hp + 2); popupAt(figEl(t.id), '✚2', 'heal'); } } }) },
  'Guardian+Ronin': { line: ['Behind the shield. Now.', 'One stance. Shield and sword.'], desc: 'each turn the pair stands <b>+1 guard</b> — shield and sword, one stance',
    make: (a, b) => ({ trigger: 'turnStart', apply: (c) => { if (!c.hero || c.hero.id !== a) return;
      [a, b].forEach(id => { const h = S.heroes.find(x => x.id === id); if (h && !h.downed) h.guard += 1; }); } }) },
  'Guardian+Cleric': { line: ['Nothing gets past this.', 'And nothing that does, stays.'], desc: 'faith mortared into stone — <b>both take 1 less</b> from every hit <i>(woven, their vow can once refuse a death)</i>',
    make: (a, b) => ({ trigger: 'incoming', mod: (h) => (h && (h.id === a || h.id === b) ? -1 : 0) }) },
  'Guardian+Reaver': { line: ['I\'ll hold it still.', 'That\'s all I ever needed.'], desc: 'the wall holds them, the whisper opens them — the <b>Reaver strikes +2</b> into the FRONT row',
    make: (a, b) => { const r = HEROES[a].cls === 'Reaver' ? a : b;
      return { trigger: 'dmgMod', mod: (o, t) => (o && t && o.id === r && t.row === 'front' ? 2 : 0) }; } },
  'Ranger+Ronin': { line: ['Marked. Go.', 'I see it — I\'m already moving.'],
    desc: 'she marks, he charges — <b>when a foe is MARKED</b>, the Ronin is already moving: <b>9 damage</b>. Once a fight.',
    strike: true, make: () => ({}) },
  'Cleric+Ranger': { line: ['Keep your head down, healer.', 'You\'re watching. I know.'], desc: 'an arrow watches over the healer — the <b>Cleric takes 1 less</b> from every hit',
    make: (a, b) => { const c = HEROES[a].cls === 'Cleric' ? a : b;
      return { trigger: 'incoming', mod: (h) => (h && h.id === c ? -1 : 0) }; } },
  'Ranger+Reaver': { line: ['Every death is scheduled.', 'Then let\'s be early.'],
    desc: 'every death is scheduled — <b>when a foe drops under a third</b>, the Reaver keeps the appointment: <b>12 damage</b>. Once a fight.',
    strike: true, make: () => ({}) },
  'Guardian+Ranger': { line: ['Anvil set.', 'Loosing on your mark.'], desc: 'anvil forward, arrow behind — the <b>Ranger strikes +2</b> while she holds BACK and the wall holds FRONT',
    make: (a, b) => { const rg = HEROES[a].cls === 'Ranger' ? a : b, gd = rg === a ? b : a;
      return { trigger: 'dmgMod', mod: (o) => { if (!o || o.id !== rg) return 0;
        const R = S.heroes.find(x => x.id === rg), G = S.heroes.find(x => x.id === gd);
        return (R && G && R.row === 'back' && G.row === 'front') ? 2 : 0; } }; } },
  'Mage+Ronin': { line: ['It\'s slowed — take the tempo.', 'That\'s all the opening I need.'], desc: 'shatter pays tempo — the <b>Ronin’s kills on CHILLED foes refund 1 EP</b>',
    make: (a, b) => { const r = HEROES[a].cls === 'Ronin' ? a : b;
      return { trigger: 'kill', apply: (c) => { if (c && c.hero && c.hero.id === r && c.tgt && (c.tgt.lull || 0) > 0) { refundEp(1); popupAt(figEl(r), '❄ +1 EP', 'tech'); } } }; } },
  'Cleric+Mage': { line: ['Frost keeps what mercy mends.', 'Then hold them a moment longer.'], desc: 'frost preserves what mercy mends — the <b>Cleric’s heals +1</b>',
    make: (a, b) => { const c = HEROES[a].cls === 'Cleric' ? a : b;
      return { card: (cd) => { if (cd.owner === c && cd.fx && cd.fx.heal) cd.fx.heal += 1; } }; } },
  'Guardian+Mage': { line: ['The wall breathes winter.', 'Let them come to it.'], desc: 'the wall breathes winter — each turn the <b>frontmost foe is CHILLED</b>',
    make: (a, b) => ({ trigger: 'turnStart', apply: (c) => { if (!c.hero || c.hero.id !== a) return;
      const e = frontmostEnemy(); if (e && !e.dead) { e.lull = (e.lull || 0) + 1; popupAt(figEl(e.uid), '❄', 'chill'); } } }) },
  'Mage+Ranger': { line: ['Cold makes a steady target.', 'Steady is all I ask.'], desc: 'cold makes a steady target — the <b>Ranger strikes CHILLED foes +2</b>',
    make: (a, b) => { const r = HEROES[a].cls === 'Ranger' ? a : b;
      return { trigger: 'dmgMod', mod: (o, t) => (o && t && o.id === r && (t.lull || 0) > 0 ? 2 : 0) }; } },
  'Mage+Reaver': { line: ['What frost slows —', '— the knife finishes.'],
    desc: 'what frost slows, the knife finishes — <b>when a foe is CHILLED</b>, the Reaver takes the opening: <b>10 damage</b>. Once a fight.',
    strike: true, make: () => ({}) },
};
// any pairing without an authored duet (e.g. the unfinished Bard) still gets one
const DUET_FALLBACK = { name: 'Kindred', icon: '♡', line: ['Together, then.', 'Together.'], desc: 'they steady one another — each turn <b>both stand +1 guard</b>',
  make: (a, b) => ({ trigger: 'turnStart', apply: (c) => { if (!c.hero || c.hero.id !== a) return;
    [a, b].forEach(id => { const h = S.heroes.find(x => x.id === id); if (h && !h.downed) h.guard += 1; }); } }) };
function duetPerkFor(a, b) {
  const key = duetClassKey(a, b);
  const w = BOND_WEAVE[key] || {};
  const p = DUET_PERKS[key] || DUET_FALLBACK;
  return { key, name: w.name || p.name || 'Kindred', icon: w.icon || p.icon || '♡',
           desc: p.desc, line: p.line || DUET_FALLBACK.line, make: p.make, strike: !!p.strike };
}

// ═════════════════════════════════════════════════════════════════════════════
// BOND NODES — the pair's own ability, earned at the fire (Build 264)
//
// Three half-finished things become one loop here, and none of them is new:
//
//   BOND_ARCS   authored campfire beats, already persisted across
//               runs — and they unlocked NOTHING. Good writing paying out none.
//   DUET_PERKS  15 authored pair abilities with real triggers, firing silently
//               behind a topbar glyph whose only explanation is a `title`
//               tooltip, which does nothing at all on touch.
//   COMMON_NODES  border stones I deliberately made generic in Build 251 —
//               "nobody's ground". Right for a bridgehead, wrong as a
//               destination. A border between Ash and Elin should hold
//               something only Ash and Elin have.
//
// So: sharing a fire unlocks that pair's ability as a NODE ON THEIR BORDER, and
// the ability announces itself the first time it fires each fight. The abilities
// key on CLASS pair (15 combos, already written) while the unlock is per HERO
// pair — Ash and Elin earn the Ronin+Cleric bond — so this ships without
// authoring 21 new abilities.
const BOND_NODES = (function () {
  const out = [], ids = Object.keys(HEROES).filter(h => EMBER_TREE.some(n => n.hero === h)).sort();
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = ids[i], b = ids[j], pair = a + '|' + b, p = duetPerkFor(a, b);
    out.push({ id: 'bond.' + pair, hero: null, pair, common: true, bond: true, slot: 9,
      tier: 2, cost: 6, type: 'bond', label: p.name, glyph: p.icon,
      desc: '<b>' + HEROES[a].name + ' &amp; ' + HEROES[b].name + '</b> — ' + p.desc });
  }
  return out;
})();
BOND_NODES.forEach(n => { EMBER_TREE.push(n); NODE_BY_ID[n.id] = n; });

// ═════════════════════════════════════════════════════════════════════════════
// RE-TIER (Build 290) — the tree had four tiers and one of them was the tree
//
// Measured across a fielded trio's 100 nodes: tier 1 held 12, tier 2 held 67,
// tiers 3 and 4 held 11 and 10. The tiers were not pacing anything — there was
// a starter set and then EVERYTHING — so Build 286's trickle had a cliff rather
// than a ramp: what you could see went 12 -> 64 the moment tier 2 opened, and
// the tree became overwhelming in one step.
//
// Nothing is deleted and no node changes what it does. Tiers are ASSIGNED here
// instead of authored, by ranking each hero's own nodes on (prerequisite depth,
// cost, id) and cutting into five even bands. Prerequisite depth is the primary
// key, so a node can never outrank the thing it requires — a property a test
// asserts across the whole tree rather than trusting.
//
// Border stones ladder the same way. BOND stones stay at 2, because their real
// gate is the campfire (bondNodeFor hides them until you have asked for that
// pair's ability) and depth has nothing to do with it.
//
//   seen at depth   0    4    8   12   16
//   before         12   64   75   85   85
//   after          18   35   52   69   85
const TREE_TIERS = 5;
(function retierEmberTree() {
  const chainMemo = {};
  const chainOf = (n, seen) => {
    if (!n) return 0;
    if (chainMemo[n.id] != null) return chainMemo[n.id];
    seen = seen || new Set();
    if (seen.has(n.id)) return 0;                       // authored cycles cannot hang the boot
    seen.add(n.id);
    const rq = (n.requires || []).map(id => NODE_BY_ID[id]).filter(Boolean);
    const d = rq.length ? 1 + Math.max(...rq.map(x => chainOf(x, seen))) : 0;
    return (chainMemo[n.id] = d);
  };
  const band = (list) => list.forEach((n, i) => { n.tier = Math.min(TREE_TIERS, 1 + Math.floor(i * TREE_TIERS / list.length)); });
  // The AUTHORED tier leads the sort. That is deliberate: it is what carries the
  // designer's intent about where a thing belongs — a hero's capstones were
  // written at tier 4 and must stay last, an opening card at tier 1 must stay
  // first. Ranking on (chain, cost) alone scattered capstones into the early
  // bands and basic cards into the late ones, which is a worse tree than the one
  // it replaced. The banding only SPREADS what was already an ordering; it does
  // not invent one.
  const rank = (a, b) => (a.baseTier - b.baseTier) || (chainOf(a) - chainOf(b)) || (a.cost - b.cost) || (a.id < b.id ? -1 : 1);
  // baseTier PERSISTS. `tier` becomes a pacing number the ramp owns; baseTier
  // stays the authored statement of what a node IS, and anything that means
  // "a mid-tree passive" or "a capstone" reads that instead (see isTeachable).
  EMBER_TREE.forEach(n => { n.baseTier = n.tier; });
  [...new Set(EMBER_TREE.filter(n => n.hero).map(n => n.hero))].forEach(h => {
    band(EMBER_TREE.filter(n => n.hero === h && n.type !== 'bond').sort(rank));
  });
  band(EMBER_TREE.filter(n => n.common && n.type !== 'bond').sort(rank));
  EMBER_TREE.forEach(n => { if (n.type === 'bond') n.tier = 2; });
})();
// A pair's node appears on their border only once they have shared a fire.
// Build 269: the gate is no longer "you have sat with them once" — it is "you
// ASKED, at the fire, what they can do together", and asking cost you the
// fragment you could have had instead.
function bondNodeFor(a, b) {
  if (!bondGiftHeld(a, b)) return null;
  return NODE_BY_ID['bond.' + [a, b].sort().join('|')] || null;
}
// Held by EITHER partner — it is the pair's, not one hero's.
function bondNodeHeld(a, b) {
  const nd = NODE_BY_ID['bond.' + [a, b].sort().join('|')];
  return !!nd && (hasCrossed(a, nd.id) || hasCrossed(b, nd.id));
}
// The live perks, derived STRAIGHT from formed threads (no extra state): a
// pair's duet is on iff their edge is lit and both stand.
// ANNOUNCE IT (Build 264). A duet perk used to be a silent number: it fired,
// something was 1 better, and no one on screen said a word. It speaks now — the
// pair's cut-in and their own line — ONCE per fight per pair, through the same
// novelty decay as every other cinematic, because the first is a gift and the
// eighth is a toll booth.
function announcePerk(key, a, b, p) {
  if (!S) return;
  S._perkSaid = S._perkSaid || {};
  if (S._perkSaid[key]) return;
  S._perkSaid[key] = 1;
  const line = p.line || DUET_FALLBACK.line;
  try {
    heroCutIn(a, p.icon + ' ' + p.name.toUpperCase(), HEROES[a].name, '“' + line[0] + '”', 700);
    setTimeout(() => { try { flashNarrator('<b>' + HEROES[b].name + '</b> — “' + line[1] + '”'); } catch (_) {} }, 520);
    sparkThread(a, b);
  } catch (_) {}
}
// Wrap the authored effect so the FIRST time it actually does something, the
// pair says so. A `mod` fires when it returns non-zero; an `apply` fires when it
// runs at all.
function announceWrap(made, key, a, b, p) {
  const out = Object.assign({}, made);
  if (typeof made.mod === 'function') {
    out.mod = function (...args) { const v = made.mod.apply(this, args); if (v) announcePerk(key, a, b, p); return v; };
  }
  if (typeof made.apply === 'function') {
    out.apply = function (...args) { announcePerk(key, a, b, p); return made.apply.apply(this, args); };
  }
  return out;
}
function duetPerkBoons() {
  if (!S) return [];
  // A pair's perk runs when their thread is live THIS fight, or when they hold
  // their BOND NODE — earned at a campfire, kept for the descent. That second
  // route is what makes the ability something you own rather than something you
  // have to re-trigger every fight.
  const keys = new Set();
  if (S.threads) S.threads.forEach(k => keys.add(k));
  (S.heroes || []).forEach(x => (crossedNodes(x.id) || []).forEach(id => {
    if (String(id).indexOf('bond.') === 0) keys.add(String(id).slice(5));
  }));
  const out = [];
  keys.forEach(key => {
    const [a, b] = key.split('|');
    const ha = S.heroes && S.heroes.find(x => x.id === a), hb = S.heroes && S.heroes.find(x => x.id === b);
    if (!ha || ha.downed || !hb || hb.downed) return;
    const p = duetPerkFor(a, b);
    out.push(Object.assign({ id: 'duet_' + key, perk: true, hero: a, heroes: [a, b],
      name: p.name, icon: p.icon, desc: p.desc, strike: p.strike, pairKey: key }, announceWrap(p.make(a, b), key, a, b, p)));
  });
  return out;
}

// ═════════════════════════════════════════════════════════════════════════════
// BOND STRIKES (Build 271) — the pair's ability as a MOVE, not a number
//
// A bond node paid out a modifier: +2 damage into a foe your partner already
// hit, 1 less taken, +1 guard a turn. Build 264 made those announce themselves,
// which helped, but an announced number is still a number — the most cinematic
// thing the game has (two specific people acting together, with a cut-in and
// their own lines) was being delivered as a stat.
//
// Five pairs now carry a real conditional strike instead. Each watches for ONE
// legible board state — the kind of thing you can see without reading a tooltip
// — and when it appears, they act, once per fight, unprompted and announced:
//
//   the foe is MARKED     the Ranger called it; the Ronin is already moving
//   the foe is CHILLED    frost slowed it; the knife finishes it
//   the foe is BROKEN     both blades go into the same opening
//   an ally is under half the Cleric steps in front of the Ronin's charge
//   a foe is nearly dead  the Reaver was told when. It is now.
//
// AUTOMATIC BUT ANNOUNCED, on purpose: a prompt would make it another button in
// a game that already has enough, and the point is that these two have stopped
// needing to be told. The other ten pairs keep their modifier — a stance that
// is always on is the right shape for "the Cleric's ward rides the Ronin's
// blade", and fifteen interrupts a fight would be noise, not drama.
const BOND_STRIKES = {
  'Ranger+Ronin': {
    // she marks, he charges — the perk said "+2 vs marked" and nobody saw it
    find: () => livingEnemies().find(e => (e.mark || 0) > 0),
    lead: (a, b) => (HEROES[a].cls === 'Ranger' ? a : b),
    call: ['Marked. Go.', 'I saw it before you said it.'],
    dmg: 9, note: 'MARKED',
  },
  'Mage+Reaver': {
    find: () => livingEnemies().find(e => (e.lull || 0) > 0),
    lead: (a, b) => (HEROES[a].cls === 'Reaver' ? a : b),
    call: ['It can’t turn. Finish it.', 'Wasn’t going to ask twice.'],
    dmg: 10, note: 'CHILLED',
  },
  'Reaver+Ronin': {
    find: () => livingEnemies().find(e => e.staggered),
    lead: (a, b) => a,
    call: ['It’s open —', '— then we open it further.'],
    dmg: 7, both: true, note: 'BROKEN',
  },
  'Ranger+Reaver': {
    // Kill Order: "every death is scheduled" — so schedule one
    find: () => livingEnemies().find(e => e.hp <= Math.ceil(e.maxHp * 0.3)),
    lead: (a, b) => (HEROES[a].cls === 'Reaver' ? a : b),
    call: ['It’s on the list. Now.', 'Then it’s early.'],
    dmg: 12, note: 'FADING',
  },
  'Cleric+Ronin': {
    // the one that isn't a strike, because this pair isn't one — the Cleric
    // gets there before the blow lands rather than after
    ally: true,
    find: () => livingHeroes().find(h => h.hp > 0 && h.hp <= Math.floor(h.maxHp / 2)),
    lead: (a, b) => (HEROES[a].cls === 'Cleric' ? a : b),
    call: ['Stay in front. I have you.', 'Then I don’t have to look back.'],
    heal: 8, guard: 4, note: 'WOUNDED',
  },
};
// Held pairs whose bond is running THIS fight (thread lit or node taken) — the
// same source the modifiers derive from, so a strike can never be live for a
// pair whose perk isn't.
function bondStrikeFor(key) { const [a, b] = key.split('|'); return BOND_STRIKES[duetClassKey(a, b)] || null; }
async function checkBondStrikes() {
  if (typeof S === 'undefined' || !S || S.over || S._inBondStrike) return;
  S._strikeFired = S._strikeFired || {};
  for (const p of duetPerkBoons()) {
    const key = p.pairKey;
    if (S._strikeFired[key]) continue;                 // once per fight — a moment, not a rotation
    const st = bondStrikeFor(key); if (!st) continue;
    let tgt = null; try { tgt = st.find(); } catch (_) {}
    if (!tgt) continue;
    const [a, b] = key.split('|');
    const lead = st.lead(a, b), other = lead === a ? b : a;
    if (st.ally && tgt.id === lead) continue;          // the healer does not announce herself
    S._strikeFired[key] = 1;
    await runBondStrike(lead, other, st, tgt, p);
    return;                                            // one at a time; the next hook picks up the rest
  }
}
async function runBondStrike(lead, other, st, tgt, perk) {
  S._inBondStrike = true;
  try {
    await heroCutIn(lead, '◈ ' + perk.name.toUpperCase(), HEROES[lead].name, '“' + st.call[0] + '”', 620);
    try { flashNarrator('<b>' + HEROES[other].name + '</b> — “' + st.call[1] + '”'); } catch (_) {}
    try { sparkThread(lead, other); } catch (_) {}
    try { camPunch(2, figEl(st.ally ? tgt.id : tgt.uid)); } catch (_) {}
    const swing = (who) => { try { lungeFig(figEl(who)); } catch (_) {} };
    if (st.ally) {
      swing(lead);
      tgt.hp = Math.min(healCap(tgt), tgt.hp + st.heal);
      tgt.guard = (tgt.guard || 0) + st.guard;
      popupAt(figEl(tgt.id), '♡ ✚' + st.heal + ' ⛨' + st.guard, 'heal');
    } else {
      swing(lead);
      dealToEnemy(tgt, st.dmg, HEROES[lead].school, lead);
      if (st.both && !tgt.dead) { swing(other); dealToEnemy(tgt, st.dmg, HEROES[other].school, other); }
    }
    try { stageShake(st.both ? 2 : 1); } catch (_) {}
    renderAll();
    await new Promise(r => setTimeout(r, 260));
  } catch (_) {} finally { S._inBondStrike = false; }
}

// ══ PRIMED — how a BOND is actually made (Build 227) ═════════════════════
// The loop, and every step of it is caused by ordinary play:
//
//   finish a combo → that hero is PRIMED (standing ready to follow up)
//   → ANOTHER hero finishes their combo → the PRIMED one's FOLLOW-UP opens
//   → play it → their bond forms, or deepens if it already stood
//
// Nothing is bought.  Builds 222-225 let you spend 1 EP on a BOND button, and
// buying a friendship with energy read as exactly what it was: a menu, not a
// moment.  The combo you already run IS the bond-builder now.
//
// THE DIRECTION MATTERS.  This is not "two tokens meet and make a shared
// move" — it is one hero waiting, and a second hero's combo being the thing
// that CUES them in.  The card belongs to whoever was primed FIRST; the hero
// who just finished is the one they answer.  That is why the follow-up reads
// as teamwork rather than as a co-op button.
//
// WHAT they follow up WITH depends on WHICH LINE each ran — combo cards
// already carry that in their stance ('FINISHER · TEMPO' vs 'FINISHER ·
// EXPOSE'), so the Ember Tree's fork nodes now change how your heroes answer
// each other, not just their damage.  The PRIMED hero's type picks the ACTION;
// the hero they answer contributes a KICKER on top.  Three of each — nine
// outcomes from six authored pieces, and only three things to learn.
const PRIME_TYPES = {
  edge: { glyph: '⚔', name: 'EDGE', desc: 'a blade still moving' },
  mark: { glyph: '◎', name: 'MARK', desc: 'an opening still held' },
  ward: { glyph: '⛨', name: 'WARD', desc: 'a shield still raised' },
};
// Every authored FINISHER theme, mapped by hand.  A test asserts full coverage
// so a new combo line can never silently fall through to the fallback.
const PRIME_BY_THEME = {
  ARTILLERY: 'edge', BLEED: 'edge', CAST: 'edge', EXECUTION: 'edge', FLOW: 'edge',
  OVERLOAD: 'edge', PYRE: 'edge', RADIANT: 'edge', RAIN: 'edge', RETREAT: 'edge',
  TEMPO: 'edge', VOLLEY: 'edge',
  EXPOSE: 'mark', FROST: 'mark', GUILE: 'mark', HUNT: 'mark', MARK: 'mark',
  OMEN: 'mark', RIME: 'mark', SHADOW: 'mark', VANISH: 'mark',
  AEGIS: 'ward', BLESS: 'ward', GUARD: 'ward', IRON: 'ward', MEND: 'ward',
  MERCY: 'ward', SENTINEL: 'ward', WALL: 'ward', WARD: 'ward',
};
// Theme first; fall back to what the card actually DOES so an unmapped line
// still yields a sane stance instead of nothing.
function primeTypeForCard(card) {
  const m = /·\s*([A-Z]+)\s*$/.exec(card && card.stance || '');
  const byTheme = m && PRIME_BY_THEME[m[1]];
  if (byTheme) return byTheme;
  const fx = (card && card.fx) || {};
  if (fx.guard || fx.heal) return 'ward';
  if (fx.mark || fx.lull || fx.exposed || fx.taunt) return 'mark';
  return 'edge';
}
// THE ACTION — what the PRIMED hero does when they finally step in.
const FOLLOW_ACTS = {
  edge: { verb: 'steps in swinging', desc: '<b>8 damage</b> to the nearest foe',
    run: (act) => { const t = frontmostEnemy(); if (!t) return 0; dealToEnemy(t, 8, HEROES[act].school, act); return 8; } },
  mark: { verb: 'reads the opening', desc: '<b>5 damage</b> · <span class="kw kw-exposed">◎ EXPOSED 3</span>',
    run: (act) => { const t = frontmostEnemy(); if (!t) return 0;
      t.mark = (t.mark || 0) + 3; popupAt(figEl(t.uid), '◎ 3', 'mark');
      dealToEnemy(t, 5, HEROES[act].school, act); return 5; } },
  ward: { verb: 'covers them', desc: '<b>⛨5</b> to your partner · <b>heal 4</b> to the most wounded',
    run: (act, trg) => { const p = S.heroes.find(h => h.id === trg);
      if (p && !p.downed) { p.guard += 5; popupAt(figEl(trg), '⛨ +5', 'guard'); }
      const w = lowestHpAlly(); if (w && w.hp < w.maxHp) { w.hp = Math.min(healCap(w), w.hp + 4); popupAt(figEl(w.id), '✚4', 'heal'); }
      return 0; } },
};
// THE KICKER — what the hero they ANSWER set up with their own line, riding
// on top.  This is where the second combo's flavour shows through.
const FOLLOW_KICKERS = {
  edge: { desc: '+<b>4 damage</b> off their momentum',
    run: (act) => { const t = frontmostEnemy(); if (t) dealToEnemy(t, 4, HEROES[act].school, act); } },
  mark: { desc: '+<span class="kw kw-exposed">◎ EXPOSED 2</span>',
    run: () => { const t = frontmostEnemy(); if (t) { t.mark = (t.mark || 0) + 2; popupAt(figEl(t.uid), '◎ 2', 'mark'); } } },
  ward: { desc: '+<b>⛨3</b> to them',
    run: (act) => { const h = S.heroes.find(x => x.id === act); if (h && !h.downed) { h.guard += 3; popupAt(figEl(act), '⛨ +3', 'guard'); } },
  },
};
function followUpFor(actorId, triggerId) {
  const ha = S.heroes.find(h => h.id === actorId), hb = S.heroes.find(h => h.id === triggerId);
  const aT = ha && ha.primed && ha.primed.type, bT = hb && hb.primed && hb.primed.type;
  const act = FOLLOW_ACTS[aT] || FOLLOW_ACTS.edge;
  const kick = FOLLOW_KICKERS[bT] || FOLLOW_KICKERS.edge;
  const w = BOND_WEAVE[duetClassKey(actorId, triggerId)] || {};
  return { key: (aT || 'edge') + '>' + (bT || 'edge'), act, kick,
    title: w.name || 'Follow-Up', icon: w.icon || '✦',
    desc: act.desc + ' · ' + kick.desc };
}
// A combo LINE ended — its finisher had nothing left to forge.  That hero is
// now PRIMED.  If someone else was ALREADY primed, this is the cue they were
// waiting for: THEIR follow-up opens.
function grantPrime(card) {
  if (!S || !card || !card.owner) return;
  // ABSORBED BY THE LINE (Build 298). PRIMED existed to notice that two heroes had
  // each finished a combo and hand one of them a free ANSWER that bonded the pair.
  // The line does that natively and better: its beats are ALREADY shared between
  // heroes, so `they struck as one` and `a hand held out` fire on the line itself
  // — measured, a trio goes from no bonds to two inside a single line. Leaving
  // PRIMED running alongside meant two systems teaching the same lesson at once:
  // playtested at 295, closing a line stacked the PRIMED narrator ON TOP of the
  // PRIMED lesson toast, one of them clipped off the left edge, with two dismiss
  // buttons. The bond survives; the parallel bookkeeping does not.
  if (lineOn()) return;
  const h = S.heroes.find(x => x.id === card.owner);
  if (!h || h.downed) return;
  // Who was standing ready BEFORE this combo landed?  Prefer a pair with no
  // thread yet — the point is to make a new bond — then whoever waited longest.
  const waiting = livingHeroes().filter(x => x.id !== h.id && x.primed && PRIME_TYPES[x.primed.type]);
  let former = null;
  waiting.forEach(x => {
    const fresh = S.threads.has(pairKey(x.id, h.id)) ? 0 : 1;
    const score = fresh * 1000 - (x.primed.seq || 0);
    if (!former || score > former.score) former = { hero: x, score };
  });
  const type = primeTypeForCard(card);
  const t = PRIME_TYPES[type];
  S._primeSeq = (S._primeSeq || 0) + 1;
  h.primed = { type, name: card.name || '', expires: S.turn + 1, seq: S._primeSeq };
  popupAt(figEl(h.id), t.glyph + ' PRIMED', 'boon');
  try { SFX.thread(); } catch (_) {}
  if (former) offerFollowUp(former.hero.id, h.id);
  else {
    // Name the SPECIFIC next action, not the abstract rule: this is the one bond
    // path a player can aim at, and it was stated only in a tooltip and a hidden
    // panel. Say who has to do what.
    const waiting = livingHeroes().filter(x => x.id !== h.id && !(x.primed && x.primed.expires >= S.turn));
    const who = waiting.length === 1 ? waiting[0].def.name : (waiting.length ? 'another hero' : 'someone');
    flashNarrator(h.def.name + ' stands <b>' + t.glyph + ' PRIMED</b> — finish <b>' + who + '</b>’s combo and a free FOLLOW-UP opens that <b>bonds them</b>.');
    lesson('primed', '✦ PRIMED — finishing a combo readies a hero. Finish a SECOND hero’s combo and a free gold card appears: play it to BOND the pair.', 3);
  }
}
// A primed stance holds through the turn AFTER the one that earned it.
function expirePrimes() {
  if (!S || !S.heroes) return;
  S.heroes.forEach(h => { if (h.primed && h.primed.expires < S.turn) h.primed = null; });
}
// Both heroes standing ready — a follow-up between them is available.
function primeReady(a, b) {
  if (!S || !S.heroes) return false;
  const ha = S.heroes.find(h => h.id === a), hb = S.heroes.find(h => h.id === b);
  return !!(ha && hb && !ha.downed && !hb.downed && ha.primed && hb.primed);
}
// Forge the primed hero's follow-up into hand as a FREE card.  It is THEIR
// card — owner, tint and cut-in all belong to the one who was waiting.
function offerFollowUp(actorId, triggerId) {
  if (!S || S.over) return;
  if (S.tempCards.some(c => c.fx && c.fx.followUp)) return;        // one on offer at a time
  const ha = S.heroes.find(h => h.id === actorId), hb = S.heroes.find(h => h.id === triggerId);
  if (!ha || !hb || ha.downed || hb.downed || !ha.primed || !hb.primed) return;
  // NB: combo steps push into S.tempCards too (via genChainStep, cap 8), so
  // mid-rotation the array is routinely at genTempCard's cap of 3 and this
  // card would be swallowed with "the moment passes".  Count only NON-CHAIN
  // temps — this offer is the PAYOFF of the combo, not more of it.
  if (S.tempCards.filter(c => !c.chain).length >= 3) return;
  const f = followUpFor(actorId, triggerId);
  const card = { kind: 'temp', follow: actorId, owner: actorId, ownerName: HEROES[actorId].name,
    tint: 'var(--gold-bright)', stance: '✦ ANSWER', name: f.title, cost: 0, target: 'none',
    fx: { followUp: { actor: actorId, trigger: triggerId, key: f.key, title: f.title } },
    desc: `<b>${HEROES[actorId].name}</b> answers <b>${HEROES[triggerId].name}</b>’s combo — ${f.desc}. <i>Free · <b>and it BONDS them</b>.</i>` };
  card.temp = true; card.uid = ++S._tuid; card.expiresTurn = S.turn;
  S.tempCards.push(card);
  S._tempNew = card.uid;
  try { SFX.card(); sparkThread(actorId, triggerId); } catch (_) {}
  flashNarrator('✦ ANSWER — ' + HEROES[actorId].name + ' can answer ' + HEROES[triggerId].name
    + '’s combo with <b>' + f.title + '</b>. Play it and it <b>bonds them</b>.');
  renderAll();
}
// A cue that went unanswered isn't lost: if two heroes are still standing
// primed after the rollover, the one who has waited LONGEST is offered again.
function reofferFollowUp() {
  if (!S || S.over) return;
  const lit = livingHeroes().filter(h => h.primed && PRIME_TYPES[h.primed.type]);
  if (lit.length < 2) return;
  let best = null;
  for (let i = 0; i < lit.length; i++) for (let j = 0; j < lit.length; j++) {
    if (i === j) continue;
    const act = lit[i], trg = lit[j];
    if ((act.primed.seq || 0) > (trg.primed.seq || 0)) continue;   // the FORMER acts
    const fresh = S.threads.has(pairKey(act.id, trg.id)) ? 0 : 1;
    const score = fresh * 1000 - (act.primed.seq || 0);
    if (!best || score > best.score) best = { a: act.id, b: trg.id, score };
  }
  if (best) offerFollowUp(best.a, best.b);
}
// Play it: the waiting hero cuts in, acts, and the act BONDS them.  A pair
// that already stood bonded is REINFORCED instead — once per fight, so the
// follow-up is never a dead beat between two heroes who already fight as one.
async function resolveFollowUp(fu) {
  const ha = S.heroes.find(x => x.id === fu.actor), hb = S.heroes.find(x => x.id === fu.trigger);
  if (!ha || !hb || ha.downed || hb.downed) return;
  const f = (ha.primed && hb.primed) ? followUpFor(fu.actor, fu.trigger) : null;
  const title = f ? f.title : fu.title;
  camFocus([figEl(fu.actor), figEl(fu.trigger)], { z: 1.16, ms: 320 });
  await heroCutIn(fu.actor, '✦ FOLLOW-UP', HEROES[fu.actor].name, title + ' · answers ' + HEROES[fu.trigger].name, 1100);
  try { lungeFig(figEl(fu.actor)); stageShake('lg'); cineFlash('rgba(240,212,136,0.42)'); } catch (_) {}
  await sleep(170);
  const act = f ? f.act : FOLLOW_ACTS.edge, kick = f ? f.kick : FOLLOW_KICKERS.edge;
  try { act.run(fu.actor, fu.trigger); } catch (_) {}
  try { kick.run(fu.actor, fu.trigger); } catch (_) {}
  gainMomentum(10, { raw: true });
  ha.primed = null;                 // the waiting hero has now acted
  flashNarrator('✦ ' + title + ' — ' + HEROES[fu.actor].name + ' ' + (act.verb || 'answers') + '.');
  const key = pairKey(fu.actor, fu.trigger);
  const already = S.threads.has(key);
  await addThread(fu.actor, fu.trigger, 'the follow-up answered');   // THE BOND
  if (already) reinforceBond(key);                    // …or a deeper one
  camReset(620);
  renderAll(); checkEnd();
  await sleep(160);
}
// Answering each other again DEEPENS the bond toward WOVEN — once per pair per
// fight, so it stays a milestone rather than a grind.
function reinforceBond(key) {
  if (!RUN) return;
  S._reinforced = S._reinforced || new Set();
  if (S._reinforced.has(key)) return;
  S._reinforced.add(key);
  RUN.bonds = RUN.bonds || {};
  const before = RUN.bonds[key] || 0;
  RUN.bonds[key] = before + 1;
  const [x, y] = key.split('|');
  flashNarrator(RUN.bonds[key] >= BOND_KINDLED && before < BOND_KINDLED
    ? '✦ WOVEN — ' + HEROES[x].name + ' & ' + HEROES[y].name + ' answer each other’s finishers — and can now learn from each other.'
    : '♡ Their bond deepens.');
  renderResonance();
}

// A partner's ASSIST is flavored by WHO they are (their archetype) — so it reads
// as that character joining the fight.  Returns a short verb for the callout.
// `atk` = the ally who just attacked, `tgt` = the enemy they hit.
// Offensive assists RETARGET to any living foe if the original died, and support
// assists FALL BACK to a ward, so a bond assist NEVER fires a triumphant callout
// for +0 effect.  `foe()` returns a hittable enemy or null.
const BOND_ASSIST = {
  ash:     (p, tgt) => { const t = (tgt && !tgt.dead) ? tgt : frontmostEnemy(); if (t) { dealToEnemy(t, 6, 'blade', p.id); popupAt(figEl(t.uid), '⚔ 6', 'dmg'); } return 'a cutting strike'; },
  mira:    (p, tgt) => { const t = (tgt && !tgt.dead) ? tgt : frontmostEnemy(); if (t) { t.mark = (t.mark || 0) + 2; dealToEnemy(t, 5, 'blade', p.id); popupAt(figEl(t.uid), '◎+2 ✕5', 'dmg'); } return 'a shadow strike'; },
  elin:    (p, tgt, atkId) => { const w = lowestHpAlly(); if (w && !w.downed && w.hp < w.maxHp) { w.hp = Math.min(healCap(w), w.hp + 5); w.chill = 0; w.exposed = 0; popupAt(figEl(w.id), '♡ ✚5', 'heal'); if (SFX.heal) SFX.heal(); return 'a mending light'; } const a = S.heroes.find(h => h.id === atkId) || p; a.guard += 4; popupAt(figEl(a.id), '⛨ +4', 'guard'); return 'a warding light'; },
  cassia:  (p, tgt, atkId) => { const a = S.heroes.find(h => h.id === atkId) || p; a.guard += 5; popupAt(figEl(a.id), '⛨ +5', 'guard'); return 'a raised shield'; },
  branwen: (p, tgt) => { const t = (tgt && !tgt.dead) ? tgt : frontmostEnemy(); if (t) { t.mark = (t.mark || 0) + 2; dealToEnemy(t, 4, 'blade', p.id); popupAt(figEl(t.uid), '➹ ◎+2', 'dmg'); } return 'a marking arrow'; },
  hask:    (p, tgt) => { const t = (tgt && !tgt.dead) ? tgt : frontmostEnemy(); if (t) { t.lull = (t.lull || 0) + 1; dealToEnemy(t, 5, 'frost', p.id); popupAt(figEl(t.uid), '❄ 5 · CHILL', 'dmg'); } return 'a frost bolt'; },
};
function weaveFor(a, b) { return BOND_WEAVE[duetClassKey(a, b)] || null; }
// The set of woven pair-keys this fight (pairsAwake stores hero pairKeys).
function wovenPairKeys() { return (S && S.pairsAwake) ? [...S.pairsAwake] : []; }
// Every woven pair `heroId` is part of, as { w, a, b }.
function wovenWeavesFor(heroId) {
  if (!S || !S.pairsAwake) return [];
  const out = [];
  for (const key of S.pairsAwake) {
    const [a, b] = key.split('|');
    if (a === heroId || b === heroId) { const w = BOND_WEAVE[duetClassKey(a, b)]; if (w) out.push({ w, a, b }); }
  }
  return out;
}
// Pulse a woven pair's topbar chip (feedback that the bond just fired).
function weaveProc(classKey) {
  try {
    const el = document.getElementById('combat-boons');
    if (el && S && S.pairsAwake) { for (const key of S.pairsAwake) { const [a, b] = key.split('|'); if (duetClassKey(a, b) === classKey) { const chip = el.querySelector(`[data-weave="${key}"]`); if (chip) { chip.classList.remove('cb-proc'); void chip.offsetWidth; chip.classList.add('cb-proc'); } } } }
  } catch (_) {}
}
// THE BOND ASSIST — the headline weave beat.  When `attackerId` (a woven hero)
// lands an attack, each bonded PARTNER steps in with their archetype's follow-up,
// ONCE per bond per turn.  A thread flicks between them, the partner lunges, and a
// clear callout fires — so the WHEN (your attack) and WHY (the bond) are legible.
// Icon-first read of what a partner's follow-up does (shown on the offered card
// face), matching the normal card icon language so it parses at a glance.
const FOLLOW_ICONS = {
  ash:     `<span class="ic ic-dmg">⚔6</span>`,
  mira:    `<span class="ic ic-dmg">✕5</span><span class="ic ic-exposed">◎+2</span>`,
  elin:    `<span class="ic ic-heal">✚5</span><span class="ic ic-sep">/</span><span class="ic ic-guard">⛨4</span>`,
  cassia:  `<span class="ic ic-guard">⛨5</span>`,
  branwen: `<span class="ic ic-dmg">➹4</span><span class="ic ic-exposed">◎+2</span>`,
  hask:    `<span class="ic ic-dmg">❄5</span><span class="ic ic-chill">CHILL</span>`,
};
// OFFER A BOND CHAIN — the legible weave beat.  When a WOVEN hero plays a
// FINISHER, their partner's answer becomes a PLAYABLE option: a free CHAIN
// card materializes in the partner's slot (burning in with a thread flourish), so
// the player SEES the option and chooses to spend it.  Once per bond per turn.
function offerBondFollow(attackerId) {
  if (!S || !S.pairsAwake || !S.pairsAwake.size) return;
  S._assistedPairs = S._assistedPairs || new Set();
  const offered = [];   // collect this call's offers so a triad announces them in ONE line
  wovenWeavesFor(attackerId).forEach(({ w, a, b }) => {
    const key = pairKey(a, b);
    if (S._assistedPairs.has(key)) return;                 // one follow-up OFFER per bond per turn
    const partnerId = a === attackerId ? b : a;
    const partner = S.heroes.find(h => h.id === partnerId);
    if (!partner || partner.downed || !BOND_ASSIST[partnerId]) return;
    // LEARNED, NOT GRANTED (Build 298). The free ANSWER used to appear for any
    // woven pair, so a card the player never chose turned up in their hand with
    // no account of where it came from. It is now gated on the pair's BOND NODE —
    // the thing two heroes earn by sitting at a fire together (Build 264), which
    // is already a deliberate, named, spent-embers decision. Under the line the
    // gate is the whole point: everything in the hand is either a beat of the
    // line or something you went and learned.
    if (lineOn() && !bondNodeHeld(a, b)) return;
    if (S.tempCards.some(c => c.fx && c.fx.bondFollow && c.fx.bondFollow.key === key)) return;   // already offered
    S._assistedPairs.add(key);
    genTempCard({ kind: 'temp', follow: partnerId, owner: partnerId, ownerName: HEROES[partnerId].name,
      tint: 'var(--gold-bright)', stance: '✦ ANSWER',
      name: w.name, cost: 0, target: 'none',   // titled by the WEAVE so two offers never share a name
      fx: { bondFollow: { partnerId, attackerId, key, weave: w.name } },
      desc: `<b>${HEROES[partnerId].name}</b> answers <b>${HEROES[attackerId].name}</b> — their bond is already <b>WOVEN</b>, so this is free every time. <i>Free.</i>` });
    try { sparkThread(a, b); } catch (_) {}
    weaveProc(duetClassKey(a, b));
    offered.push(HEROES[partnerId].name);
  });
  // ONE narrator for the whole offer — a full triad offers two chains at once, and
  // separate flashNarrator calls would overwrite each other (only the last showed).
  if (offered.length) {
    const who = offered.length === 1 ? offered[0] : offered.slice(0, -1).join(', ') + ' & ' + offered.slice(-1);
    flashNarrator('✦ ANSWER — ' + who + ' answers ' + HEROES[attackerId].name + '’s finisher, free.');
  }
}
// A reusable JRPG CUT-IN — a hero's PORTRAIT slides in from the side to announce a
// MAJOR, impactful action (a CHAIN, an all-out finisher, a big unleash).  kicker =
// the small gold eyebrow, big = the headline, sub = the detail line.  `hold` (ms)
// lets a marquee moment linger.  Reused so every special beat reads the same way.
// Full cinematic splash art (wide key-art) for the cut-in, per hero.  Where a hero
// has one, the cut-in becomes a big cinematic band; otherwise it falls back to the
// small skewed portrait panel.  Positions frame each character's face in the band.
const CUTIN_SPLASH = {
  cassia:  { url: '../art/splash-cassia.webp',  pos: '62% 20%' },
  hask:    { url: '../art/splash-hask.webp',     pos: '64% 24%' },
  branwen: { url: '../art/splash-branwen.webp',  pos: '58% 18%' },
  elin:    { url: '../art/splash-elin.webp',     pos: '70% 26%' },
  mira:    { url: '../art/splash-mira.webp',      pos: '68% 26%' },
};
async function heroCutIn(heroId, kicker, big, sub, hold) {
  let el = document.getElementById('follow-cutin');
  if (!el) { el = document.createElement('div'); el.id = 'follow-cutin'; $('#stage').appendChild(el); }
  const sp = CUTIN_SPLASH[heroId];
  el.innerHTML = sp ? `
    <div class="fc-panel fc-cine">
      <div class="fc-splash" style="background-image:url('${sp.url}');background-position:${sp.pos}"></div>
      <div class="fc-txt">
        <span class="fc-follow">${kicker}</span>
        <span class="fc-name">${big}</span>
        <span class="fc-sub">${sub || ''}</span>
      </div>
    </div>` : `
    <div class="fc-panel">
      <span class="fc-art">${V2PORTRAITS[heroId] || ''}</span>
      <div class="fc-txt">
        <span class="fc-follow">${kicker}</span>
        <span class="fc-name">${big}</span>
        <span class="fc-sub">${sub || ''}</span>
      </div>
    </div>`;
  el.classList.remove('fc-out'); void el.offsetWidth; el.classList.add('fc-show');
  try { cineFlash('rgba(240,212,136,0.4)'); SFX.triad && SFX.triad(); } catch (_) {}
  // The first time a hero's band slides in this fight it plays in full and you
  // read the name; after that it is a beat, not a reveal — halve the hold, and
  // let a tap cut either one short.  The band is the game's most-repeated
  // cinematic (a woven bond forges one on EVERY finisher), so this is where the
  // dead time actually lives.
  const full = hold || 1150;
  await holdOrTap(tempo('cutin:' + heroId, full, Math.round(full * 0.5)));
  el.classList.remove('fc-show');
  // The cinematic band BURNS away (mask sweep + rising embers) for a climactic
  // exit; the small portrait panel keeps its quick fade.
  if (sp) { try { spawnCutinEmbers(el); } catch (_) {} }
  el.classList.add('fc-out');
  await sleep(tempo('cutout:' + heroId, sp ? 720 : 320, sp ? 340 : 190));
  el.classList.remove('fc-out'); el.innerHTML = '';
}
// Scatter rising embers across the cinematic band as it burns away.
function spawnCutinEmbers(el) {
  const panel = el.querySelector('.fc-panel'); if (!panel) return;
  const r = panel.getBoundingClientRect(), sr = $('#stage').getBoundingClientRect(), s = sr.width / stageDW();
  const top = (r.top - sr.top) / s, left = (r.left - sr.left) / s, w = r.width / s, h = r.height / s;
  for (let i = 0; i < 16; i++) {
    const e = document.createElement('span');
    e.className = 'discard-ash fc-ember';
    e.style.left = (left + w * (0.04 + 0.92 * ((i * 41 % 100) / 100))) + 'px';
    e.style.top = (top + h * (0.35 + 0.5 * ((i * 27 % 100) / 100))) + 'px';
    e.style.animationDelay = (i * 26) + 'ms';
    el.appendChild(e);
  }
}
// The CHAIN cut-in — a woven partner steps in over a thread to the ally they answer.
async function followCutIn(partnerId, attackerId, weave) {
  try { sparkThread(attackerId, partnerId); } catch (_) {}
  await heroCutIn(partnerId, '✦ WEAVE', HEROES[partnerId].name, (weave || '') + ' · answers ' + HEROES[attackerId].name, 1100);
}
// Resolve a played Follow-Up card: a portrait cut-in showcases the partner, they
// LUNGE in, and perform their archetype's assist.
async function resolveBondFollow(bf) {
  const partner = S.heroes.find(h => h.id === bf.partnerId);
  if (!partner || partner.downed) return;
  const tgt = frontmostEnemy();
  await followCutIn(bf.partnerId, bf.attackerId, bf.weave);   // showcase WHO follows up
  try { if (typeof lungeFig === 'function') lungeFig(figEl(bf.partnerId)); popupAt(figEl(bf.partnerId), '✦ WEAVE', 'boon'); stageShake('sm'); } catch (_) {}
  await sleep(200);
  let verb = ''; try { verb = BOND_ASSIST[bf.partnerId](partner, tgt, bf.attackerId) || ''; } catch (_) {}
  // The cut-in already announced WHO answers WHOM; the narrator just adds the effect.
  flashNarrator('✦ ' + (bf.weave || 'BOND') + (verb ? ' — ' + HEROES[bf.partnerId].name + ' answers with ' + verb + '.' : '.'));
  firePassives('chain', bf.partnerId, { attackerId: bf.attackerId });   // boons/nodes can react to the CHAIN beat
  // KIZUNA branch (Ash) — a woven CHAIN can feed the burst and, at the capstone,
  // cascade: the answering partner's OTHER bond gets to chain in turn.
  if (hasNode('ash.chain.link'))   { gainMomentum(8, { combo: true, raw: true }); popupAt(figEl(bf.partnerId), '⚡ +8', 'info'); }
  if (hasNode('ash.chain.rising')) expandBurst(3, '✦ RISING', 20);
  renderAll(); checkEnd();
  if (hasNode('ash.chain.react') && !S.over) { try { offerBondFollow(bf.partnerId); } catch (_) {} }   // the chain is a finisher too → triad cascade
  await sleep(200);
}
// Does a `save` weave (Sanctified Wall) cover this hero — once/fight, both standing?
function weaveSaves(heroId) {
  if (!S || S._weaveSaved) return false;
  return wovenWeavesFor(heroId).some(({ w, a, b }) => {
    if (!w.save) return false;
    const ha = S.heroes.find(x => x.id === a), hb = S.heroes.find(x => x.id === b);
    return ha && !ha.downed && hb && !hb.downed;
  });
}

// ---------------------------------------------------------------------------
// DATA — the tutorial chapters (unchanged), then THE DESCENT map.
// ---------------------------------------------------------------------------
// THE ROAD IN (re-cut, Build 273)
//
// The old tutorial taught four fights of CLASSIC combat and then, in its last
// beat before the cliff, mentioned that the descent runs on ROTATIONS. Since
// `_rot` is true for every useRunHp fight, that meant 80% of onboarding
// rehearsed an engine the player would never touch again — and the one thing
// they'd do every turn for the rest of the game got a single practice fight.
//
// It also taught the payoffs before the mechanisms: WEAVE and the TRIAD FINALE
// were explained in chapter 3, two chapters before the player had formed a
// single bond, while the deliberate way to MAKE one (finish two combos, play
// the FOLLOW-UP that opens) was never mentioned at all — it lived in a coach
// that first fires somewhere down in the descent, long after the game has told
// them bonds come from healing people.
//
// So: every fight runs the real engine, and each one teaches exactly one new
// thing, in the order the things depend on each other.
//
//   1  the ROTATION      opener -> combo -> finisher, and who cashes out
//   2  the TELEGRAPH     dodge the row they name, or stand and parry it
//                        …and learn it costs you the combo, which is the game
//   3  PRIMED            finishing leaves a hero standing ready
//   4  the FOLLOW-UP     a second hero's finish cues them in — THAT is a bond
//   5  the ALL-OUT       burst, and what three bonds are for
//
// WEAVE/TRIAD are gone from here entirely: they are a promise at the cliff, not
// a drill. The descent's own coaches introduce them when they become reachable.
const FLOW = [
  { type: 'story', chapter: 1, title: 'ONE SURVIVOR', eyebrow: 'THE BOTTOM OF IT', scene: 'landing', lines: [
    { text: 'The first thing you understand is that everyone else is gone.' },
    { text: 'The second is that you do not remember arriving. Not the fall, not the road before it. Only that you are at the bottom of something, and it goes up.' },
    { spk: 'ASH', text: '…then I climb it alone.' },
    { text: 'You are <b>Ash</b>. One blade, three ways to hold it — <b>where you stand is how you fight</b>. Each POSITION carries its own line: Front cuts, Mid flows, Back strikes from the wind.' },
    { text: 'Down here nobody swings once and wins. You fight in a <b>line</b>: play an <b>OPENER</b>, and the next strike <b>forges into your hand</b>. Right now your line is short — an opener, then the <b>FINISHER</b> that ends it.' },
    { text: 'Short because you have not grown it yet. The <b>Ember Tree</b> is what puts a <b>COMBO</b> between them, and later a second path to choose from. Every line in this place starts as two strikes and becomes what you make it.' },
    { text: 'The ramp is <b>free</b>. The <b>finisher costs EP</b>. That is the whole question, every turn, for the rest of the climb: <b>who gets to finish?</b>' },
  ]},
  { type: 'fight', chapter: 1, heroes: ['ash'], enemies: ['husk'], rotations: true,
    narrator: 'Play your OPENER — the FINISHER forges into your hand. The Ember Tree is what puts a COMBO between them.' },
  { type: 'story', chapter: 1, title: 'THE POSITIONS', eyebrow: 'CHAPTER 1', lines: [
    { text: 'Every foe <b>telegraphs</b> before it strikes: the damage it will deal, and the <b>row</b> it will hit.' },
    { spk: 'ASH', text: 'So I answer one of two ways — not be there, or meet it.' },
    { text: '<b>Drag Ash to an empty row</b> to dodge the blow, or hold your ground and <b>PARRY</b> — tap each note the instant its ring glows gold. A clean parry blunts the strike and feeds your <b>momentum</b>.' },
    { text: 'One warning, and the road will not repeat it. <b>Moving breaks your combo.</b> Dodging is never free — it costs you the line you were building. Choose which you can afford to lose.' },
  ]},
  { type: 'fight', chapter: 1, heroes: ['ash'], enemies: ['husk', 'wraith'], rotations: true,
    narrator: 'Dodge the row they name — or stand and PARRY it. Moving breaks your combo: pick your moment.' },
  { type: 'story', chapter: 2, title: 'ELIN', eyebrow: 'CHAPTER 2 · TWO', lines: [
    { text: 'A light in the ash-fog — a healer, kneeling over what’s left of her order.' },
    { spk: 'ELIN', text: 'You’re bleeding. Stand still.' },
    { spk: 'ASH', text: '…you’re coming with me.' },
    { text: 'Two now, and two changes everything. <b>A line is not yours — it is the party’s.</b> Play an opener and <b>every</b> opener is discarded: what lands in your hand is what <b>each of them</b> can answer with.' },
    { text: 'So the question stops being "what do I play" and becomes <b>who answers, and who finishes</b>. Carry a line yourself and your finisher hits harder. Share it, and the two of them are <b>♡ BONDED</b> for having fought as one.' },
    { spk: 'ELIN', text: 'You cover me. I’ll cover you. That is all a bond is — it just has to actually happen.' },
  ]},
  { type: 'fight', chapter: 2, heroes: ['ash', 'elin'], enemies: ['cultist', 'husk'], rotations: true,
    narrator: 'One line, between the two of you — open with either, then ANSWER with the other. Fighting as one BONDS them.' },
  { type: 'story', chapter: 3, title: 'MIRA', eyebrow: 'CHAPTER 3 · THREE', lines: [
    { text: 'A blade rests at your throat before you hear a single step. Then, slowly, it lowers.' },
    { spk: 'MIRA', text: 'You came through the dark loud as a funeral. …Lucky I only kill what I mean to. Move.' },
    { text: 'Three now — a triangle. Landing hits and clean parries fills your <b>BURST</b>; when it is full, unleash the <b>ALL-OUT</b> and the whole line strikes at once.' },
    { text: 'And the bonds you hold <b>empower it</b>. That is what they are for. Everything else they become, the road will show you.' },
  ]},
  { type: 'fight', chapter: 3, heroes: ['ash', 'elin', 'mira'], enemies: ['echoknight', 'cultist'], rotations: true,
    narrator: 'Land hits and parries to fill BURST, then unleash your ALL-OUT. Bond who you can along the way.' },
  { type: 'story', chapter: 3, title: 'THE ROAD DOWN', eyebrow: 'THE DESCENT', lines: [
    { text: 'The tutorial road ends at a cliff’s edge. Below waits the <b>Descent</b> — and the Abyss beneath it.' },
    { text: 'You have felt the rhythm now. That short combo is all you start with; how it <b>grows</b> is up to you. The dead give up <b>✦ embers</b>, and the <b>Ember Tree</b> waits below to show you what to do with them.' },
    { text: 'A bond that is lit again and again goes <b>✦ WOVEN</b> — permanent, and worth more than any blade you will find down there. Weave all three and you will learn what a <b>TRIAD</b> is.' },
    { spk: 'ASH', text: 'A strike and a killing blow. Everything between them, I earn.' },
    { spk: 'MIRA', text: 'Down, then. …And you go alone from here. Find the others before something finds you.' },
  ], next: 'descent' },
];

// ---------------------------------------------------------------------------
// THE DESCENT — a PROCEDURALLY GENERATED branching map (v1-aligned).  Every
// run generates a fresh descent: a single funnel FIGHT, then several branching
// stretches (2-3 nodes each — the player chooses the road), a pre-boss CAMP
// gate, and the BOSS.  Node vocabulary: fight · elite · event · camp · recruit
// · boss.  The generated map lives on RUN.map (an array indexed by id) so it
// persists with the run; `mapNode(id)` / `mapAll()` read it.
// ---------------------------------------------------------------------------
// STARTERS & RECRUITS — every run begins SOLO with a hero you choose from your
// UNLOCKED starters (v1-style); the other party members are RECRUITED on the
// road.  Recruiting a hero permanently UNLOCKS them as a future starter, so the
// roster you can open with grows the more you play.
const STARTER_POOL = ['ash', 'elin', 'mira', 'cassia', 'branwen', 'hask'];   // all pickable/recruitable heroes
const DEFAULT_STARTERS = ['ash', 'mira'];                            // unlocked from the first run (solo-viable damage)
const STARTERS_KEY = 'kizuna2_2.starters';
const LAST_STARTER_KEY = 'kizuna2_2.lastStarter';   // whose key-art greets you on the title
function getUnlockedStarters() {
  try { const a = JSON.parse(localStorage.getItem(STARTERS_KEY) || 'null'); if (Array.isArray(a) && a.length) return a.filter(id => STARTER_POOL.includes(id)); } catch (_) {}
  return DEFAULT_STARTERS.slice();
}
function unlockStarter(id) {
  if (!STARTER_POOL.includes(id)) return;
  const a = getUnlockedStarters();
  if (!a.includes(id)) { a.push(id); try { localStorage.setItem(STARTERS_KEY, JSON.stringify(a)); } catch (_) {} }
}
const RECRUIT_NODE_LABELS = {
  ash: 'A LONE BLADE', elin: 'THE LAST LIGHT', mira: 'A SHADOW ON THE ROAD',
  cassia: 'THE GATE HOLDS', branwen: 'THE OUTLAW’S DEBT', hask: 'THE FROST-CALLER’S VIGIL',
};
const COMBAT_POOL = {
  early: ['husk', 'wraith', 'cultist'],
  mid:   ['cultist', 'mourner', 'husk', 'wraith', 'brood'],
  deep:  ['drone', 'mourner', 'cultist', 'wraith', 'brood', 'cantor'],
};
const NODE_LABELS = {
  fight: ['ASHFALL ROAD', 'HOLLOW CHOIR', 'MOURNING FIELD', 'COLD PROCESSION', 'THE GREY MILE', 'SILENT MARCH', 'THE BROKEN CHANCEL', 'DRONE NEST', 'THE WEEPING STAIR'],
  elite: ['THE WARDEN STIRS', 'A DEEPER SIN', 'THE GORGE OF NAMES', 'THE HUNGERING DARK', 'WHERE THE STRONG FELL'],
  event: ['A COLD SHRINE', 'AN OLD CACHE', 'AN ECHO IN THE DARK', 'A FORK IN THE BLACK', 'THE WATCHER’S STONE'],
  camp:  ['EMBER REST', 'HOLLOW REST', 'LAST FIRE', 'THE QUIET HOUR'],
  boss:  ['THE REMEMBERED'],
};
function _rand(n) { return Math.floor(Math.random() * n); }
function _pick(a) { return a[_rand(a.length)]; }
function _shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = _rand(i + 1); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function _labeler(type) { const q = _shuffle(NODE_LABELS[type] || ['THE ROAD']); let i = 0; return () => q[i++ % q.length]; }
// A BODY FOR A BODY (Build 279). Pack size keyed off LEVEL alone, so a trio
// walked into rooms built for a solo hero: three heroes and six EP against two
// foes' two actions. Measured, a trio finished every fight at FULL HP at any
// parry skill, in 2.8 turns — which is not "easy", it is the enemy phase never
// happening, and the parry system, the telegraphs and the whole defensive half
// of the design going with it.
function _combatEnemies(level, party, floor) {
  const ps = Math.max(1, party || 1);
  // THE ROAD DOWN CHANGES WHO WALKS IT (Build 308). The pools graded by level
  // WITHIN a floor but never by floor — so floor 3's opening trash was still
  // husk/wraith/cultist, the same three bodies as the tutorial, and a whole
  // run's worth of mob progression sat unused in the mid/deep pools. Each
  // floor now promotes the tier: what floor 1 calls deep, floor 2 meets at
  // mid-level rooms, and by floor 3 every room draws from the deep roster —
  // the swarming brood, the empowering cantor, the turtling drone — whose
  // parry strings and behaviours the player has NOT already solved. This is
  // mob progression by BEHAVIOUR, not by number: no HP or damage changes.
  const tier = level + ((floor || 1) - 1) * 2;
  const pool = tier <= 2 ? COMBAT_POOL.early : tier <= 4 ? COMBAT_POOL.mid : COMBAT_POOL.deep;
  // The level-1 funnel is a single foe — a gentle opener for a solo starter.
  let count = level <= 1 ? 1 : level <= 2 ? 2 : (Math.random() < 0.45 ? 3 : 2);
  // one more body per companion, so the ramp is GRADED — the first version gave
  // a duo and a trio the same room, which is the bug it was written to fix.
  if (level >= 2) count = Math.min(4, count + Math.max(0, ps - 1));
  const out = []; for (let i = 0; i < count; i++) out.push(_pick(pool)); return out;
}
function _eliteEnemies(level, party) {
  // The elite fight is anchored by a mini-boss — the ECHO REVENANT with its
  // boss-style cascades — flanked by a support caster / adds so it plays like a
  // real set-piece, not just a bigger mob.
  const anchor = 'revenant';
  const adds = (level >= 5 ? 2 : 1) + ((party || 1) >= 3 ? 1 : 0);
  const rest = _shuffle(['cantor', 'cultist', 'wraith', 'drone']).slice(0, adds);
  return [anchor, ...rest];
}
// One branching stretch's node TYPES (2-3), always with at least one fight and
// weighted toward variety as the descent deepens.
function _stretchTypes(level) {
  const types = ['fight'];
  const r = Math.random();
  if (level >= 3 && r < 0.42) types.push('elite');
  else types.push(Math.random() < 0.62 ? 'event' : 'fight');
  if (Math.random() < 0.5) types.push(Math.random() < 0.5 ? 'event' : 'fight');
  return _shuffle(types);
}
// Wire each stretch to the next: every source reaches 1-2 adjacent targets and
// every target keeps at least one incoming edge (no orphans, no dead ends).
function _connect(prev, next, nodes) {
  prev.forEach((pid, pi) => {
    const span = Math.max(1, prev.length - 1);
    const base = Math.min(next.length - 1, Math.round(pi * (next.length - 1) / span));
    const t = new Set([next[base]]);
    if (next[base + 1] && Math.random() < 0.5) t.add(next[base + 1]);
    if (next[base - 1] && Math.random() < 0.3) t.add(next[base - 1]);
    nodes[pid].next = [...t];
  });
  next.forEach(nid => {
    if (!prev.some(pid => nodes[pid].next.includes(nid))) {
      nodes[prev[_rand(prev.length)]].next.push(nid);
    }
  });
}
function generateDescent(roster, floor) {
  roster = roster || ['ash'];
  floor = floor || 1;
  // FLOOR 4 — THE DEEPEST DARK: a deliberate TWO-NODE approach.  A LAST FIRE to
  // steady the line, then the multi-stage MEGA BOSS.  No detours — the mega boss
  // is itself the gauntlet (three stages).  (The map strip keeps a fixed height,
  // so this reads at the same vertical scale as the branching floors.)
  if (floor >= 4) {
    return [
      { id: 0, level: 1, col: 1, type: 'camp', label: 'THE LAST FIRE', next: [1] },
      { id: 1, level: 2, col: 2, type: 'boss', enemies: ['echochorus'], isBoss: true, floorBoss: true, label: 'THE HOLLOW CHORUS', next: [] },
    ];
  }
  // Recruits = anyone not already in the party.  You start solo (or short) and
  // build your trio from the road, so an early recruit is guaranteed close.
  // Anyone not walking with you is still climbing somewhere, so they can surface
  // on any floor — INCLUDING someone you turned away once (that is the whole
  // point of being allowed to turn them away).  Someone you refused a SECOND
  // time is done with you for this descent and drops out of the pool.
  const refused = (typeof RUN !== 'undefined' && RUN && RUN.refused) || [];
  // SOMEONE'S LEFT GLOVE gave you your second hero up front, and the stair now
  // considers your line settled — there is nobody else on this road.
  const sealed = typeof RUN !== 'undefined' && RUN && RUN.relic === 'glove';
  const pending = sealed ? [] : _shuffle(STARTER_POOL.filter(id => !roster.includes(id) && !refused.includes(id)));
  const numLevels = 7;
  // Scatter recruit encounters at RANDOM depths (not clustered up front) —
  // FFT-style, you cross paths with survivors anywhere on the road.  One lands
  // early (level 2) so a solo lead isn't alone for long; the rest fall at random
  // deeper levels among the mid stretch.
  const midLevels = _shuffle(Array.from({ length: Math.max(0, numLevels - 4) }, (_, i) => i + 3));  // 3 .. numLevels-2
  const recruitLevels = [2].concat(midLevels).slice(0, Math.min(pending.length, 3));
  const recruitAtLevel = {};
  recruitLevels.forEach((lvl, i) => { recruitAtLevel[lvl] = pending[i]; });
  const nodes = [];
  const levels = [];
  const lbl = { fight: _labeler('fight'), elite: _labeler('elite'), event: _labeler('event'), camp: _labeler('camp'), boss: _labeler('boss') };
  const eventQ = _shuffle(Object.keys(EVENTS_V2));
  let eventI = 0, idc = 0;
  for (let level = 1; level <= numLevels; level++) {
    let types;
    // A CHILD'S COMPASS shows you the whole stair, and the stair opens its jaws.
    if (level === 1) types = (typeof RUN !== 'undefined' && RUN && RUN.relic === 'compass') ? ['elite'] : ['fight'];
    else if (level === numLevels) types = ['boss'];
    else if (level === numLevels - 1) types = ['camp'];
    // A MID-FLOOR FIRE (Build 283). The only camp sat at level 6 of 7, which did
    // not matter while nothing could hurt you. Now that damage lands, a floor was
    // a one-way attrition slide — 100 -> 92 -> 74 -> dead with no point at which
    // the party could recover, so you lost to arithmetic settled three rooms
    // earlier rather than to a decision. It is one of the level's two or three
    // roads, not the only one, so taking it still costs you the other.
    else types = _stretchTypes(level);
    if (recruitAtLevel[level]) {
      // THE FIRST COMPANION IS NOT A DICE ROLL (Build 274).
      //
      // A recruit used to be inserted as ONE of two or three nodes on its level,
      // so a route could walk straight past it — and measured over 400 generated
      // maps, 34% of runs met NO recruit at all. In those runs the entire Kizuna
      // system simply does not exist: no bonds, no campfire arc, no fragments,
      // no bond strikes, no triad, no duet perks. The game's whole thesis was a
      // coin flip on map generation, which is most of what "bonds are unclear"
      // actually meant.
      //
      // So while you are still short of a full line, the earliest crossing is
      // the ONLY road on its level — you will meet somebody. Every later
      // recruit stays optional and walk-past-able, because by then declining is
      // a real choice rather than an accidental one.
      const forced = roster.length < 3 && level === recruitLevels[0];
      if (forced) types = ['recruit'];
      else { types = types.slice(0, 2); types.splice(_rand(types.length + 1), 0, 'recruit'); }   // random row, not always the bottom
    }
    // …and the mid-floor fire is placed LAST, because the recruit branch above
    // trims the row to two and would otherwise cut it. A forced recruit level is
    // left alone — meeting somebody is the more important beat.
    if (level === Math.ceil(numLevels / 2) && types.length > 1 && types.indexOf('camp') < 0) {
      // take over the last NON-recruit road, so a crossing on the same level
      // survives — meeting somebody and being able to recover are both beats
      // this floor needs, and they are not in competition.
      for (let i = types.length - 1; i >= 0; i--) { if (types[i] !== 'recruit') { types[i] = 'camp'; break; } }
    }
    const ids = [];
    types.forEach(type => {
      const node = { id: idc, level, col: level, type, next: [] };
      if (type === 'fight')        { node.enemies = _combatEnemies(level, roster.length, floor); node.label = lbl.fight(); }
      else if (type === 'elite')   { node.enemies = _eliteEnemies(level, roster.length); node.elite = true; node.label = lbl.elite(); }
      else if (type === 'event')   { node.eventId = eventQ[eventI++ % eventQ.length]; node.label = lbl.event(); }
      else if (type === 'camp')    { node.label = lbl.camp(); }
      else if (type === 'recruit') { node.hero = recruitAtLevel[level]; node.label = RECRUIT_NODE_LABELS[node.hero] || 'A NEW BOND'; }
      else if (type === 'boss')    { const bid = floor >= 3 ? 'echosunder' : floor >= 2 ? 'echodevourer' : 'echoknight2'; node.enemies = [bid]; node.isBoss = true; node.floorBoss = true; node.label = floor >= 3 ? 'THE SUNDERING' : floor >= 2 ? 'THE HOLLOW MAW' : lbl.boss(); }
      nodes[idc] = node; ids.push(idc); idc++;
    });
    levels.push(ids);
  }
  for (let l = 0; l < levels.length - 1; l++) _connect(levels[l], levels[l + 1], nodes);
  // A previous descent's ashes surface once — attach any Abyss memory to a node
  // at the same depth (level) in this fresh map so the ♰ still marks the road.
  const abyss = loadAbyss();
  Object.keys(abyss).forEach(lvlKey => {
    const lv = +lvlKey;
    const candidates = nodes.filter(n => n.level === lv && n.type !== 'boss');
    if (candidates.length) { const n = candidates[_rand(candidates.length)]; n.mem = abyss[lvlKey]; n.memLevel = lv; }
  });
  return nodes;
}
// The map comes back off localStorage, where a truncated or partly-written save
// leaves HOLES in the array. Every consumer treats an entry as a node and reads
// `.id` / `.next` off it, so one hole used to take the whole map screen down and
// strand the run with no way forward. Filter them out at the single seam instead
// of guarding at a dozen call sites.
function mapAll() { return ((RUN && RUN.map) || []).filter(Boolean); }
// by IDENTITY, not by array position — mapAll() now compacts holes out, so the
// two indices are no longer guaranteed to agree.
function mapNode(id) { return mapAll().find(n => n.id === id); }

// EVENT nodes — a crossroads with two choices, each trading in the run's real
// resources (party HP, bonds, a one-fight edge).  Kept small and readable; the
// fx run at click-time so they close over the current RUN.
function _healParty(x) { RUN.roster.forEach(id => { RUN.hp[id] = Math.min(HEROES[id].maxHp, (RUN.hp[id] ?? HEROES[id].maxHp) + x); }); }
// ═════════════════════════════════════════════════════════════════════════════
// DEEDS — the quiet ledger of what a pair has actually DONE together (Build 266)
//
// Build 256 already made every bond name its cause — "a hand held out", "they
// struck as one", "a death avenged" — because three unlabelled paths were firing
// constantly and the player could never build a causal model. That `why` was
// only ever spoken aloud and thrown away. It is kept now.
//
// The fire used to pick whichever pair had the WEAKEST bond, which is the least
// interesting answer available: it hands the scene to the two who have done the
// least together. It goes to the pair with the most between them instead, and
// the scene opens by naming what that was. The counting stays quiet; the
// consequence never does.
const DEED_KINDS = {
  help:   { open: (a, b) => `${b} has not forgotten whose hands closed the wound.` },
  strike: { open: (a, b) => `They fought back to back all day and have not said a word about it.` },
  avenge: { open: (a, b) => `${a} settled a debt today that was never ${a}'s to settle.` },
  shield: { open: (a, b) => `${a} is still carrying the bruise that was meant for ${b}.` },
  answer: { open: (a, b) => `Twice today one moved and the other was already moving.` },
};
const DEED_BY_WHY = {
  'a hand held out': 'help',
  'they struck as one': 'strike',
  'a death avenged': 'avenge',
  'they took the blow': 'shield',
  'the follow-up answered': 'answer',
};
function recordDeed(a, b, why) {
  const kind = DEED_BY_WHY[why]; if (!kind || !RUN) return;
  RUN.deeds = RUN.deeds || {};
  const k = pairKey(a, b);
  const row = RUN.deeds[k] = RUN.deeds[k] || {};
  row[kind] = (row[kind] || 0) + 1;
}
function deedTotal(k) { const r = (RUN && RUN.deeds && RUN.deeds[k]) || {}; return Object.keys(r).reduce((s, x) => s + r[x], 0); }
function deedTop(k) {
  const r = (RUN && RUN.deeds && RUN.deeds[k]) || {};
  return Object.keys(r).sort((x, y) => r[y] - r[x])[0] || null;
}
// The pair with the most between them this descent. Falls back to the weakest
// bond when nobody has done anything yet, so the fire is never empty.
function _fireBondKey() {
  const ids = (RUN && RUN.active) ? RUN.active.slice() : [];
  let best = null, most = 0;
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const k = pairKey(ids[i], ids[j]), t = deedTotal(k);
    if (t > most) { most = t; best = k; }
  }
  return best || _weakestActiveBondKey();
}
function _weakestActiveBondKey() {
  const ids = RUN.active.slice(); let best = null, low = Infinity;
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const k = pairKey(ids[i], ids[j]); const p = bondPts(k);
    if (p < low) { low = p; best = k; }
  }
  return best;
}
function _bumpWeakestBond() { const k = _weakestActiveBondKey(); if (k) { RUN.bonds = RUN.bonds || {}; RUN.bonds[k] = (RUN.bonds[k] || 0) + 1; } return k; }
function _hurtParty(x) { RUN.roster.forEach(id => { const hp = RUN.hp[id] ?? HEROES[id].maxHp; if (hp > 0) RUN.hp[id] = Math.max(1, hp - x); }); }   // events can COST blood — never kill outright
// Each choice is { icon, label (the ACT), effect (the CONSEQUENCE, styled) }
// so every event renders the same two-line choice card — one shared structure.
const EVENTS_V2 = {
  shrine: {
    title: 'A COLD SHRINE', eyebrow: 'A CROSSROADS',
    lines: ['A shrine to a god no one remembers leans in the dark.', 'It asks for something — or gives it. Hard to say which.'],
    a: { icon: '✦', label: 'KNEEL AND PRAY', effect: 'The party heals <b>6</b>.', fx: () => _healParty(6) },
    b: { icon: '♡', label: 'OFFER A NAME', effect: 'Deepen your weakest bond <b>+1</b>.', fx: () => _bumpWeakestBond() },
  },
  cache: {
    title: 'AN OLD CACHE', eyebrow: 'A CROSSROADS',
    lines: ['A dead scout’s pack, half-buried. Whatever killed them is long gone.', 'Two things worth taking. Only time to grab one.'],
    a: { icon: '▲', label: 'THE WHETSTONE', effect: 'Open the next fight with <span class="kw kw-rally">▲ RALLY +2</span>.', fx: () => { RUN.campEdge = true; } },
    b: { icon: '✚', label: 'THE POULTICE', effect: 'The party heals <b>4</b>.', fx: () => _healParty(4) },
  },
  echo: {
    title: 'AN ECHO IN THE DARK', eyebrow: 'A CROSSROADS',
    lines: ['A voice repeats a conversation the party half-remembers having.', 'Stay and listen, or press on before it learns your names.'],
    a: { icon: '♡', label: 'LISTEN', effect: 'Heal <b>3</b> · deepen your weakest bond <b>+1</b>.', fx: () => { _healParty(3); _bumpWeakestBond(); } },
    b: { icon: '▲', label: 'PRESS ON', effect: 'Open the next fight with <span class="kw kw-rally">▲ RALLY +2</span>.', fx: () => { RUN.campEdge = true; } },
  },
  // A companion moment — the third BOON source (alongside elites and the fire).
  companion: {
    title: 'A QUIET WORD', eyebrow: 'A CROSSROADS',
    lines: ['One of them falls into step beside you, turning something over in their hands.', 'They’ve been meaning to show you how they do a certain thing.'],
    a: { icon: '✦', label: 'HEAR THEM OUT', effect: 'A companion shares how they fight — <b>draw 1 of 3</b>.', boon: true },
    b: { icon: '✚', label: 'KEEP MOVING', effect: 'Press on · the party heals <b>4</b>.', fx: () => _healParty(4) },
  },
  // ── Build 211 (Phase 2): events that can GO WRONG — gambles, blood-prices,
  //    and third options only a specific companion can open. ──
  bonedice: {
    title: 'THE BONE DICE', eyebrow: 'A GAMBLE',
    lines: ['A skeleton sits mid-game at a stone table, its opponent long gone. The dice wait.', 'The house has been dead for centuries. The odds have not improved.'],
    a: { icon: '⚄', label: 'STAKE 6 EMBERS', effect: '<b>Even odds</b>: ✦ 12 back — or the dark keeps your stake.',
      fx: () => { addEmbers(-Math.min(6, runEmbers())); if (Math.random() < 0.5) { addEmbers(12); flashNarrator('✦ The bones land kind — twelve embers.'); } else { flashNarrator('The dark rakes the table. The skeleton would laugh, if it could.'); } } },
    b: { icon: '✦', label: 'POCKET A DIE', effect: 'Walk away <b>+1 ember</b>. The safe play.', fx: () => addEmbers(1) },
  },
  thornedidol: {
    title: 'THE THORNED IDOL', eyebrow: 'A BLOOD PRICE',
    lines: ['An idol of woven briars, palms open. Old blood blacks the thorns.', 'It gives to those who bleed. It says nothing about how much.'],
    a: { icon: '☠', label: 'GRASP THE THORNS', effect: 'The party <b>bleeds 4 each</b> — a companion’s gift surfaces: <b>draw 1 of 3</b>.',
      fx: () => _hurtParty(4), boon: true },
    b: { icon: '✚', label: 'LEAVE IT HUNGRY', effect: 'The party heals <b>2</b>. It watches you go.', fx: () => _healParty(2) },
  },
  tollgate: {
    title: 'THE TOLL', eyebrow: 'A CROSSROADS',
    lines: ['A gate of black iron, and a bowl worn smooth by ten thousand payments.', 'Nothing guards it. Somehow that is worse.'],
    a: { icon: '✦', label: 'PAY THE BOWL', effect: '<b>−8 embers</b> · the road beyond is kind: the party heals <b>8</b>.',
      fx: () => { addEmbers(-Math.min(8, runEmbers())); _healParty(8); } },
    b: { icon: '⚔', label: 'FORCE THE GATE', effect: 'The iron fights back — <b>bleed 3 each</b>, but open the next fight with <span class="kw kw-rally">▲ RALLY +2</span>.',
      fx: () => { _hurtParty(3); RUN.campEdge = true; } },
  },
  whisperwell: {
    title: 'THE WHISPERING WELL', eyebrow: 'A CROSSROADS',
    lines: ['A well that repeats what is dropped into it — coins, names, promises.', 'Something at the bottom is collecting them.'],
    a: { icon: '✦', label: 'DROP FOUR EMBERS', effect: '<b>−4 embers</b> · it whispers back what your companions won’t say: weakest bond <b>+2</b>.',
      fx: () => { addEmbers(-Math.min(4, runEmbers())); const k = _bumpWeakestBond(); if (k) { RUN.bonds[k] = (RUN.bonds[k] || 0) + 1; } } },
    b: { icon: '▸', label: 'COVER YOUR EARS', effect: 'Take the road · <b>+2 embers</b> found on the lip.', fx: () => addEmbers(2) },
    c: { needs: 'hask', icon: '❄', label: 'FREEZE THE WATER', effect: '<b>HASK</b> stills the well — the shapes in the ice teach: <b>draw 1 of 3</b>.', boon: true },
  },
  oldbanner: {
    title: 'THE OLD BANNER', eyebrow: 'A CROSSROADS',
    lines: ['A company banner, half-buried — an order nobody living can name.', 'Whoever carried it planted it facing DOWN the road. They meant to hold.'],
    a: { icon: '▲', label: 'BURN IT FOR HEAT', effect: 'Open the next fight with <span class="kw kw-rally">▲ RALLY +2</span>.', fx: () => { RUN.campEdge = true; } },
    b: { icon: '✦', label: 'STRIP THE THREAD-OF-GOLD', effect: '<b>+5 embers</b> · it deserved better.', fx: () => addEmbers(5) },
    c: { needs: 'cassia', icon: '☨', label: 'BURY IT PROPERLY', effect: '<b>CASSIA</b> gives it the rites she still owes another banner. The party heals <b>10</b> · weakest bond <b>+1</b>.',
      fx: () => { _healParty(10); _bumpWeakestBond(); } },
  },
  hungrydark: {
    title: 'THE HUNGRY DARK', eyebrow: 'A BLOOD PRICE',
    lines: ['A patch of dark deeper than the dark around it. It does not move. It is very patient.', 'Things fed to it do not come back. Things traded to it do.'],
    a: { icon: '✦', label: 'FEED IT EMBERS', effect: '<b>−6 embers</b> · it exhales warmth: the party heals <b>10</b>.',
      fx: () => { addEmbers(-Math.min(6, runEmbers())); _healParty(10); } },
    b: { icon: '☠', label: 'FEED IT BLOOD', effect: 'The party <b>bleeds 5 each</b> · it pays in kind: <b>+8 embers</b>.',
      fx: () => { _hurtParty(5); addEmbers(8); } },
  },
  sleepingecho: {
    title: 'A SLEEPING ECHO', eyebrow: 'A GAMBLE',
    lines: ['One of the hollow dead, sat against a stone — dormant, ember-light banked in its chest.', 'Rob it, and hope it dreams deep.'],
    a: { icon: '☠', label: 'ROB THE SLEEPER', effect: '<b>Even odds</b>: <b>+10 embers</b> — or it wakes mid-theft and the party <b>bleeds 6 each</b>.',
      fx: () => { if (Math.random() < 0.5) { addEmbers(10); flashNarrator('✦ Its dream never breaks. Ten embers, still warm.'); } else { _hurtParty(6); flashNarrator('It wakes with your hand in its chest. The party pays in blood.'); } } },
    b: { icon: '▸', label: 'STEP QUIETLY', effect: 'Let it sleep · <b>+1 ember</b> from the floor.', fx: () => addEmbers(1) },
  },
  mirrorpool: {
    title: 'THE MIRROR POOL', eyebrow: 'A CROSSROADS',
    lines: ['Still water that shows the party — but a step out of true. The reflections move a heartbeat late.', 'Or a heartbeat early. Better not to check twice.'],
    a: { icon: '♡', label: 'FACE IT TOGETHER', effect: 'Hold the gaze — <b>bleed 2 each</b>, weakest bond <b>+1</b>. What it shows, you carry as one.',
      fx: () => { _hurtParty(2); _bumpWeakestBond(); } },
    b: { icon: '⚔', label: 'BREAK THE SURFACE', effect: 'Shatter it — open the next fight with <span class="kw kw-rally">▲ RALLY +2</span>.', fx: () => { RUN.campEdge = true; } },
    c: { needs: 'mira', icon: '◎', label: 'READ THE DARK WATER', effect: '<b>MIRA</b> has seen worse in real water. She maps the road ahead: <b>+6 embers</b>.', fx: () => addEmbers(6) },
  },
};

// One voice per hero — camp scenes pair the two least-bonded companions.
const CAMP_VOICES = {
  ash:    '…I don’t talk much. But I’d notice if you were gone.',
  elin:   'Hold still a moment. Even wounds no one can see want tending.',
  kiki:   'I’m writing a song about us, you know. You’re the difficult verse.',
  cassia: 'A wall is only as strong as who it shelters. Stand behind me tomorrow.',
  hask:   'You’re warm. Sit closer. That’s strategy, not sentiment.',
  mira:   'I watch the dark so you don’t have to. …Don’t thank me. I’ll deny it.',
  branwen:'I keep to the treeline so I can see you all. …Habit. Comes from losing people you didn’t.',
};

// ── BOND ARCS (Build 220) — the campfire is where a wound gets its next line.
// Every hero's recruit scene planted something (Cassia's buried knight, Elin's
// "the only thing I've ever been good for", Mira's unanswered "what are you
// running from", Branwen's habit of counting people).  These are the payoffs,
// staged: each pair has an ordered run of scenes, and the fire always plays the
// deepest one you have NEVER seen.  Progress persists across runs and deaths —
// the relationship resumes where it stopped, Hades-style, instead of resetting
// with the descent.  A pair with no authored arc falls back to their one-line
// camp voices, so an unwritten pair is never a blank scene.
// Build 267: all 15 pairs among the six lattice heroes are now authored, three
// beats each.  Before this, nine of them ran the whole loop — arc night, bond
// node, pair ability — on two standing one-liners, which read as filler for
// most party compositions.  The fallback survives for heroes outside the
// lattice (kiki), where it is the correct behaviour rather than a gap.
const ARCS_KEY = 'kizuna2_2.arcs';
function loadArcs() { try { return JSON.parse(localStorage.getItem(ARCS_KEY) || '{}'); } catch (_) { return {}; } }
function arcSeen(a, b) { return loadArcs()[pairKey(a, b)] || 0; }
function markArcSeen(a, b, stage) {
  try { const m = loadArcs(); const k = pairKey(a, b); m[k] = Math.max(m[k] || 0, stage); localStorage.setItem(ARCS_KEY, JSON.stringify(m)); } catch (_) {}
}
function nextArcStage(a, b) { return arcSeen(a, b) + 1; }

// ═════════════════════════════════════════════════════════════════════════════
// WHAT THE FIRE IS FOR (Build 269)
//
// The premise of this game is that nobody remembers falling in, or how long
// they've been down here, and that the way out is found TOGETHER. None of that
// reached the mechanics. The campfire played a beautifully written scene and
// then handed you the same thing every time: +1 bond, node unlocked, exit. A
// cutscene, not a decision — and forty-five authored beats of personal history
// that advanced zero plot.
//
// So the night now ends on a fork, and the two answers are the two things this
// story is actually about:
//
//   THE ABILITY — you ask what they can do together. Their bond node opens on
//                 the lattice, permanently, for this descent and every one after.
//   THE ANSWER  — you ask what they REMEMBER. Two accounts get compared, and
//                 what doesn't line up is a FRAGMENT of what this place is.
//
// You cannot have both from one night, and a descent holds three or four fires.
// Power and truth compete for the same scarce hour, which is the most
// interesting question the game had available and was not asking.
//
// A memory you can't reach alone is one another person can corroborate — that
// is why the fragments come from PAIRS and not from a lore item on the floor.
const FRAGS_KEY = 'kizuna2_2.frags';     // ordered ids of what you've pieced together
const GIFTS_KEY = 'kizuna2_2.bondgifts'; // pairKeys whose bond node you asked for
function loadFrags() { try { const a = JSON.parse(localStorage.getItem(FRAGS_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (_) { return []; } }
function fragsHeld() { return loadFrags().length; }
function hasFrag(id) { return loadFrags().indexOf(id) >= 0; }
function markFrag(id) { try { const a = loadFrags(); if (a.indexOf(id) < 0) { a.push(id); localStorage.setItem(FRAGS_KEY, JSON.stringify(a)); } } catch (_) {} }
function nextFragment() { const held = loadFrags(); return ABYSS_FRAGMENTS.find(f => held.indexOf(f.id) < 0) || null; }
function loadGifts() { try { const a = JSON.parse(localStorage.getItem(GIFTS_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (_) { return []; } }
function bondGiftHeld(a, b) { return loadGifts().indexOf(pairKey(a, b)) >= 0; }
function markBondGift(a, b) { try { const l = loadGifts(), k = pairKey(a, b); if (l.indexOf(k) < 0) { l.push(k); localStorage.setItem(GIFTS_KEY, JSON.stringify(l)); } } catch (_) {} }

// THE CLIMB, IN ORDER.  Each one is the moment two accounts fail to agree, and
// the disagreement is the evidence.  Read end to end they answer the premise's
// own question — and the answer is the game's central mechanic, which is the
// only reason it's worth telling this way.
const ABYSS_FRAGMENTS = [
  { id: 'f1', title: 'NOBODY FELL',
    text: 'They try to place the fall — the ledge, the slip, the drop — and neither of them can. One remembers leaving a room. The other remembers leaving a road. <b>Not one person down here remembers arriving.</b>' },
  { id: 'f2', title: 'THE WOUND IS OLDER THAN THE DAY',
    text: 'A dressing gets changed and the flesh under it has long since closed and greyed. It was tied this morning. <b>The wound has been healing for years.</b>' },
  { id: 'f3', title: 'TWO CITIES, ONE NAME',
    text: 'They name the same city and describe two different places — the same streets, a century apart, both certain, both right. <b>You did not all fall in at the same time.</b>' },
  { id: 'f4', title: 'THE DEAD ARE WEARING OUR GEAR',
    text: 'The bodies on the stair carry the same buckles, the same stitching, the same notch filed into the same blade. One of them is wearing a face somebody at this fire has been shaving for thirty years.' },
  { id: 'f5', title: 'THE MARKS ABOVE US',
    text: 'There are tallies scratched high on the wall, well above the deepest either of them has ever climbed. The hand is familiar. <b>Somebody has been up there already, and it was one of you.</b>' },
  { id: 'f6', title: 'THE STAIR HAS NO TOP',
    text: 'They count landings on the way up and get a different number each time, and the number is never larger. <b>The abyss is not a depth. It is a loop with a story wrapped around it.</b>' },
  { id: 'f7', title: 'IT KEEPS WHAT IT TAKES',
    text: 'It isn’t a place you fell into. It’s a thing that remembers people, and what it remembers it keeps — the name first, then the face, then whatever they were climbing toward. <b>That is what forgetting the fall means.</b>' },
  { id: 'f8', title: 'THE WAY OUT IS SOMEONE ELSE',
    text: 'It can overwrite anything one person holds alone. It cannot overwrite a thing two people hold between them — it would have to take both accounts at once, and it has never managed it. <b>You do not climb out. You are carried out, by someone who refuses to forget you.</b>' },
];
// EVERY BOND YOU FORM HOLDS HARDER, because you know what this place does to the
// ones you don't. The reward IS the thesis of the last fragment, which is why it
// pays into bonds and not into damage.
const CARRY_PER = 3, CARRY_MAX = 2;
function bondCarry() { return Math.min(CARRY_MAX, Math.floor(fragsHeld() / CARRY_PER)); }
// The authored beats.  Keyed by the SORTED pair so order never matters.
const BOND_ARCS = {
  'ash|elin': [
    { set: 'She has his arm turned to the firelight, picking grit from a cut he had already forgotten.',
      lines: [{ spk: 'ELIN', text: 'Hold still. You let this go all day.' },
              { spk: 'ASH', text: '…It stopped bleeding. That was enough.' },
              { spk: 'ELIN', text: 'Enough is what you say when nobody is keeping count. Someone is, now.' }] },
    { set: 'The pot goes round twice. She takes the second turn of the watch without being asked.',
      lines: [{ spk: 'ASH', text: 'You could sleep. I don’t mind the dark.' },
              { spk: 'ELIN', text: 'I know. That’s the part I mind.' },
              { spk: 'ASH', text: '…Sit, then. It’s a long watch.' }] },
    { set: 'A quiet stretch, the fire low. She says it to the coals rather than to him.',
      lines: [{ spk: 'ELIN', text: 'My order is gone. Keeping people standing was the only thing I was ever good for. If I can’t —' },
              { spk: 'ASH', text: 'You kept me standing. Twice today.' },
              { spk: 'ELIN', text: '…That isn’t the same as being good for something.' },
              { spk: 'ASH', text: 'It is from where I’m sitting. Every time.' }] },
  ],
  'ash|mira': [
    { set: 'She sits just outside the light, where the fire won’t ruin her eyes.',
      lines: [{ spk: 'MIRA', text: 'You breathe loud when you fight. Fix it or don’t, but know it.' },
              { spk: 'ASH', text: 'Noted.' },
              { spk: 'MIRA', text: '…That was help. In case that wasn’t clear.' }] },
    { set: 'He sets a bowl down on her side of the fire and walks away before she can refuse it.',
      lines: [{ spk: 'MIRA', text: 'I don’t need feeding.' },
              { spk: 'ASH', text: 'Didn’t say you did.' },
              { spk: 'MIRA', text: '…' },
              { spk: 'MIRA', text: 'It’s cold in an hour. Fine. Don’t look at me.' }] },
    { set: 'The dark is thick tonight. He asks it plainly, the way he asks everything.',
      lines: [{ spk: 'ASH', text: 'On the road you said you were sick of doing it alone. What are you running from?' },
              { spk: 'MIRA', text: '…Nothing, anymore. It caught me years back. I’m what’s left of the running.' },
              { spk: 'MIRA', text: 'Everyone I walked with is down here somewhere. That’s the whole of it.' },
              { spk: 'ASH', text: 'Then we go down together, and we come back up the same way.' }] },
  ],
  'elin|mira': [
    { set: 'Mira lets her look at the shoulder. It takes a long moment to get there.',
      lines: [{ spk: 'ELIN', text: 'This is old. You’ve been favouring it since the gate.' },
              { spk: 'MIRA', text: 'It works.' },
              { spk: 'ELIN', text: 'That isn’t what I asked.' }] },
    { set: 'The healer has fallen asleep sitting up. Mira moves the pot off the flame so it won’t boil dry.',
      lines: [{ spk: 'MIRA', text: '…You patch everyone and nobody patches you.' },
              { spk: 'MIRA', text: 'I’ll take the rest of the watch. Don’t tell her.' }] },
    { set: 'Both awake, neither admitting it.',
      lines: [{ spk: 'MIRA', text: 'You asked once why I keep to the edge of the light.' },
              { spk: 'ELIN', text: 'I remember.' },
              { spk: 'MIRA', text: 'So that when it takes someone, it takes me first. …It’s a stupid plan. I’ve never had a better one.' },
              { spk: 'ELIN', text: 'Then hold still. Even wounds no one can see want tending.' }] },
  ],
  'ash|cassia': [
    { set: 'The knight cleans a sword that is already clean.',
      lines: [{ spk: 'CASSIA', text: 'Stand behind me tomorrow. I mean it as an order.' },
              { spk: 'ASH', text: 'I’ve never been good at that.' },
              { spk: 'CASSIA', text: 'Learn. Walls are cheaper than survivors.' }] },
    { set: 'He notices she never sets the blade down, even to eat.',
      lines: [{ spk: 'ASH', text: 'That sword isn’t yours.' },
              { spk: 'CASSIA', text: '…No.' },
              { spk: 'CASSIA', text: 'Don’t ask me the rest tonight.' }] },
    { set: 'She asks for the fire’s last hour, and gives the answer she owes.',
      lines: [{ spk: 'CASSIA', text: 'Her name was Sera. She carried it before me, and I buried her under a banner nobody will read.' },
              { spk: 'CASSIA', text: 'I told myself I kept the sword to finish her work. I keep it because putting it down would mean she’s over.' },
              { spk: 'ASH', text: 'Then hand me the other end of it. …There. Now two of us carry it.' }] },
  ],
  'branwen|elin': [
    { set: 'The archer counts the party under her breath before she settles.',
      lines: [{ spk: 'ELIN', text: 'You do that every night. Counting.' },
              { spk: 'BRANWEN', text: 'Habit.' },
              { spk: 'ELIN', text: 'Habits come from somewhere.' }] },
    { set: 'She keeps the treeline in view even sitting down.',
      lines: [{ spk: 'BRANWEN', text: 'I lost people I never counted. Now I count.' },
              { spk: 'ELIN', text: 'And when the number is right?' },
              { spk: 'BRANWEN', text: 'Then I sleep. A little.' }] },
    { set: 'She finishes the count and, for once, says the number out loud.',
      lines: [{ spk: 'BRANWEN', text: 'Three.' },
              { spk: 'ELIN', text: 'Three.' },
              { spk: 'BRANWEN', text: '…Tonight the number was right. Go to sleep, healer. I have the treeline.' }] },
  ],
  'cassia|hask': [
    { set: 'The frost-caller has migrated, without comment, to the warmest stone by the fire.',
      lines: [{ spk: 'HASK', text: 'You radiate. It’s the only useful thing about a wall.' },
              { spk: 'CASSIA', text: 'Sit, then. Say nothing.' },
              { spk: 'HASK', text: 'A hard bargain. …Accepted.' }] },
    { set: 'He has fallen asleep against her pauldron. She has not moved in an hour.',
      lines: [{ spk: 'HASK', text: '…You could have shifted me.' },
              { spk: 'CASSIA', text: 'You were cold.' },
              { spk: 'HASK', text: 'That’s strategy, not sentiment. I’m told.' }] },
    { set: 'The fire is down to embers. He does not move to the warm stone tonight.',
      lines: [{ spk: 'HASK', text: 'It isn’t the heat. I should say that once, and then never again.' },
              { spk: 'CASSIA', text: 'Say it, then.' },
              { spk: 'HASK', text: 'Nothing has stood between me and the dark since I was small enough to need it to. …That’s all. Sentiment. Log it as an error.' },
              { spk: 'CASSIA', text: 'Logged. Sit down, Hask.' }] },
  ],
  'ash|branwen': [
    { set: 'He comes back from the dark without a sound and finds her arrow already lowered.',
      lines: [{ spk: 'BRANWEN', text: 'You went out past the stones without telling anyone.' },
              { spk: 'ASH', text: 'I went out quiet. That’s the point of it.' },
              { spk: 'BRANWEN', text: 'It’s the point of my arrow, too. Tell me next time.' }] },
    { set: 'She is counting again. He watches her get to the end and start over.',
      lines: [{ spk: 'ASH', text: 'You always land on me last.' },
              { spk: 'BRANWEN', text: 'Because you’re the one who moves. …It’s not an insult. It’s just where the hard number is.' },
              { spk: 'ASH', text: 'Then I’ll stop moving.' },
              { spk: 'BRANWEN', text: 'Don’t. Just be somewhere I can find you.' }] },
    { set: 'She takes his hand, turns it over, and taps two beats into his palm.',
      lines: [{ spk: 'BRANWEN', text: 'Two short — I see you. Three — go, I have the lane.' },
              { spk: 'ASH', text: 'And one?' },
              { spk: 'BRANWEN', text: 'One means come back to the fire. …You’ve never once heard me give that one. Learn it anyway.' },
              { spk: 'ASH', text: 'Noted.' }] },
  ],
  'ash|hask': [
    { set: 'The mage watches him drill the same cut, over and over, without comment for a long while.',
      lines: [{ spk: 'HASK', text: 'You’ve done that ninety times. The ninetieth was worse than the tenth.' },
              { spk: 'ASH', text: 'I know.' },
              { spk: 'HASK', text: 'Then stop. …I dislike watching a good instrument dull itself out of habit.' }] },
    { set: 'Ash notices the frost never fully leaves the mage’s fingers, even here, even by the coals.',
      lines: [{ spk: 'ASH', text: 'Your hands. Is that you, or is that it?' },
              { spk: 'HASK', text: '…There’s no clean line between those two anymore. That’s the honest answer, and I’d thank you not to ask for a second one.' },
              { spk: 'ASH', text: 'I won’t.' }] },
    { set: 'Later. Hask has moved to the far stone, out of the light, and Ash follows without being invited.',
      lines: [{ spk: 'HASK', text: 'You’re standing very close to a man who is slowly becoming winter.' },
              { spk: 'ASH', text: 'Yes.' },
              { spk: 'HASK', text: 'That is not a rebuttal, Ronin. That is barely a sentence.' },
              { spk: 'ASH', text: 'It’s the whole answer. If it takes you, it goes through me first. Sit.' }] },
  ],
  'branwen|cassia': [
    { set: 'They have been arguing about tomorrow’s formation for some time. Neither has raised their voice.',
      lines: [{ spk: 'CASSIA', text: 'Behind the shield. That is where the archer stands.' },
              { spk: 'BRANWEN', text: 'Behind the shield I can see a shield. That’s all I can see.' },
              { spk: 'CASSIA', text: '…Then we have a problem, and it is not one either of us will win tonight.' }] },
    { set: 'Cassia sets the shield down flat and steps aside — a concession made without saying so.',
      lines: [{ spk: 'BRANWEN', text: 'I count them. Every night, all of them. If the number comes up right, I sleep.' },
              { spk: 'CASSIA', text: 'And if it doesn’t?' },
              { spk: 'BRANWEN', text: 'Then I sit up and watch the gap until morning fills it. Standing behind you, I can’t count.' },
              { spk: 'CASSIA', text: '…Take the high stone tomorrow. I’ll hold the line where you can see it.' }] },
    { set: 'The knight asks it quietly, as though it were a matter of logistics.',
      lines: [{ spk: 'CASSIA', text: 'When you count. Am I in the number?' },
              { spk: 'BRANWEN', text: 'You’re the first one I look for. You’re the biggest thing on the field.' },
              { spk: 'CASSIA', text: 'That isn’t what I asked.' },
              { spk: 'BRANWEN', text: '…You’re in the number, Cassia. Walls get counted too.' }] },
  ],
  'branwen|hask': [
    { set: 'Both have ended up at the cold edge of the camp, for entirely different reasons.',
      lines: [{ spk: 'HASK', text: 'You chose the coldest seat available and you are not even enjoying it.' },
              { spk: 'BRANWEN', text: 'It has the sightline.' },
              { spk: 'HASK', text: 'Ah. A professional. …Move over.' }] },
    { set: 'They fall into planning without either of them proposing it.',
      lines: [{ spk: 'BRANWEN', text: 'The ground by the left arch is loose. They’ll come through there.' },
              { spk: 'HASK', text: 'Then I will make it glass and you will make it a shooting gallery.' },
              { spk: 'BRANWEN', text: '…That’s the first time anyone’s answered a sightline with a plan instead of a shrug.' },
              { spk: 'HASK', text: 'I am told I have very few virtues. Enjoy this one.' }] },
    { set: 'The talk runs out. Hask keeps looking at the treeline instead of the fire.',
      lines: [{ spk: 'HASK', text: 'Range is a lonely trade. You and I die at a distance, out where no one’s reaching.' },
              { spk: 'BRANWEN', text: 'That’s why I count.' },
              { spk: 'HASK', text: 'Then do me the courtesy of a low number, Ranger. I have no interest in being an interesting statistic.' },
              { spk: 'BRANWEN', text: 'Sit where I can see you and you won’t be.' }] },
  ],
  'branwen|mira': [
    { set: 'The fire has two people at its edge tonight and neither will take the last step in.',
      lines: [{ spk: 'MIRA', text: 'You’re in my dark.' },
              { spk: 'BRANWEN', text: 'It’s a big dark.' },
              { spk: 'MIRA', text: '…Fine. Don’t talk to me and we’ll get on beautifully.' }] },
    { set: 'Branwen’s lips move. Mira watches her do it, and works out what it is.',
      lines: [{ spk: 'MIRA', text: 'You’re counting us.' },
              { spk: 'BRANWEN', text: 'Yes.' },
              { spk: 'MIRA', text: 'Leave me out of it. I’m not a number anyone should get attached to.' },
              { spk: 'BRANWEN', text: 'Too late. You were four before you sat down.' }] },
    { set: 'A long silence, and then the thing neither of them planned to say.',
      lines: [{ spk: 'MIRA', text: 'I sit out here so it takes me before it gets to the rest of you. That’s the whole shape of it.' },
              { spk: 'BRANWEN', text: 'I know. I sit out here so I can see all of you at once. We’ve been doing the same thing back to back for weeks.' },
              { spk: 'MIRA', text: '…That’s grim.' },
              { spk: 'BRANWEN', text: 'That’s a formation. Turn around, Mira. I’ll watch the dark. You watch them.' }] },
  ],
  'cassia|elin': [
    { set: 'Elin has found the split under the pauldron that the knight has been pretending is not there.',
      lines: [{ spk: 'ELIN', text: 'Off. All of it. I’m not asking.' },
              { spk: 'CASSIA', text: 'It doesn’t signify.' },
              { spk: 'ELIN', text: 'It signifies to me, and I am the one holding the needle.' }] },
    { set: 'The armour is off. The knight sits very upright, as if that were still armour.',
      lines: [{ spk: 'CASSIA', text: 'A wall isn’t tended. A wall is stood behind. That is the arrangement.' },
              { spk: 'ELIN', text: 'Who told you that?' },
              { spk: 'CASSIA', text: 'The last person who stood behind me. …And I buried her, so perhaps she was wrong.' }] },
    { set: 'Elin ties off the stitch and does not let go of her arm.',
      lines: [{ spk: 'ELIN', text: 'I buried an order. You buried a knight. Between us we have a great deal of practice at being the one still standing.' },
              { spk: 'CASSIA', text: 'That is not a comfort, Cleric.' },
              { spk: 'ELIN', text: 'It isn’t meant to be. It’s an agreement. While I’m standing you don’t fall — and while you’re standing, neither do I.' },
              { spk: 'CASSIA', text: '…Then hold the line, Elin. I’ll hold mine.' }] },
  ],
  'cassia|mira': [
    { set: 'The knight plants the shield in the dirt at the edge of the light, deliberately, in Mira’s way.',
      lines: [{ spk: 'CASSIA', text: 'Tomorrow. Behind me.' },
              { spk: 'MIRA', text: 'No.' },
              { spk: 'CASSIA', text: 'That was not a request.' },
              { spk: 'MIRA', text: 'It wasn’t a refusal either. It was a fact. Learn the difference.' }] },
    { set: 'Cassia does not leave. After a while Mira gives her the reason, because it is faster than arguing.',
      lines: [{ spk: 'MIRA', text: 'I go first so it takes me first. Then it’s slower reaching everyone else. It works.' },
              { spk: 'CASSIA', text: 'That is not a strategy. That is a funeral with steps.' },
              { spk: 'MIRA', text: '…Have you got a better one, wall?' }] },
    { set: 'The knight moves the shield one pace and taps the ground beside it.',
      lines: [{ spk: 'CASSIA', text: 'Here. My shoulder. It is a half-step ahead of the shield — you will meet it before I do, which is what you want.' },
              { spk: 'MIRA', text: 'And what do you get out of that.' },
              { spk: 'CASSIA', text: 'I get to be standing next to it when it happens. Which is what I want.' },
              { spk: 'MIRA', text: '…Fine. Don’t make it a thing.' }] },
  ],
  'elin|hask': [
    { set: 'She takes his hands before he can invent a reason not to give them.',
      lines: [{ spk: 'ELIN', text: 'These are like river stones. How long have they been like this?' },
              { spk: 'HASK', text: 'Longer than you’ve known me. It isn’t an ailment, healer. It’s a bill.' },
              { spk: 'ELIN', text: 'Then I’ll sit with the debt a while.' }] },
    { set: 'She has not let go. He watches her not let go with visible discomfort.',
      lines: [{ spk: 'HASK', text: 'You cannot mend this. There is nothing torn. There is simply less of me each season.' },
              { spk: 'ELIN', text: 'I know.' },
              { spk: 'HASK', text: 'Then why are you still holding them.' },
              { spk: 'ELIN', text: 'Because you’re cold and I’m warm. That’s the whole of the medicine.' }] },
    { set: 'The frost on his knuckles has gone to water. Neither of them mentions it.',
      lines: [{ spk: 'HASK', text: '…Tomorrow night. Same hour.' },
              { spk: 'ELIN', text: 'Say it properly.' },
              { spk: 'HASK', text: 'Tomorrow night, would you sit with me. …That is strategy. I am reliably informed it is strategy.' },
              { spk: 'ELIN', text: 'Of course it is. Hold still.' }] },
  ],
  'hask|mira': [
    { set: 'He has been studying her the way he studies weather that is about to become a problem.',
      lines: [{ spk: 'HASK', text: 'You never sit in the light. I’ve been keeping a record.' },
              { spk: 'MIRA', text: 'Stop keeping it.' },
              { spk: 'HASK', text: 'I’ve stopped. …The record was very short and extremely consistent, if you ever want it.' }] },
    { set: 'She turns it around on him, which he was not expecting and does not enjoy.',
      lines: [{ spk: 'MIRA', text: 'You talk so no one asks. I stay quiet so no one asks. Same coward, two methods.' },
              { spk: 'HASK', text: '…That is an unkind reading.' },
              { spk: 'MIRA', text: 'Is it wrong?' },
              { spk: 'HASK', text: 'It is not wrong. It is unkind. Those are permitted to be the same thing.' }] },
    { set: 'Before the fire dies he draws a small ring of frost into the dirt where she will land tomorrow.',
      lines: [{ spk: 'HASK', text: 'The left flank. I’ll take the footing out from under them a half-beat before you arrive.' },
              { spk: 'MIRA', text: 'I didn’t ask.' },
              { spk: 'HASK', text: 'No. You never do. It’s becoming my favourite thing about you.' },
              { spk: 'MIRA', text: '…Half a beat. Don’t be late.' }] },
  ],
};
function arcBeat(a, b, stage) {
  const arc = BOND_ARCS[pairKey(a, b)];
  if (arc && arc[stage - 1]) return Object.assign({ staged: true }, arc[stage - 1]);
  // no authored beat left (or none written for this pair) — their standing
  // voices still carry the night, and nothing is marked as "seen"
  return { staged: false, lines: [{ spk: HEROES[a].name, text: CAMP_VOICES[a] || '…' }, { spk: HEROES[b].name, text: CAMP_VOICES[b] || '…' }] };
}

const RECRUIT_LINES = {
  cassia: [
    { text: 'A knight holds a shattered gate alone, shield planted like a gravestone.' },
    { spk: 'CASSIA', text: 'If you’re walking down, you’ll want a wall that walks with you.' },
  ],
  hask: [
    { text: 'Frost patterns bloom across the stones. Something small and cold is waiting.' },
    { spk: 'HASK', text: 'You’re warm. Stand near me and I’ll forgive the noise.' },
  ],
  branwen: [
    { text: 'An arrow thuds into the post beside you before you ever saw the archer. She steps from the dark, bow already lowered.' },
    { spk: 'BRANWEN', text: 'Relax — if I’d wanted you dead you wouldn’t be reading this. You walk down there without eyes on the treeline, you don’t walk back. Let me be your eyes.' },
  ],
};

// ---------------------------------------------------------------------------
// STATE
// ---------------------------------------------------------------------------
let S = null;               // battle state
let flowIdx = 0;
let RUN = null;             // descent run state
let targeting = null;       // { card, validIds, drag? } while picking a target
const PROGRESS_KEY = 'kizuna2_2.flow';
const TUTORIAL_KEY = 'kizuna2_2.tutorialSeen';   // set once the scripted FLOW onboarding has been played
const RUN_KEY = 'kizuna2_2.run';
const ABYSS_KEY = 'kizuna2_2.abyss';   // nodeId -> memory of a fallen descent
function loadAbyss() { try { return JSON.parse(localStorage.getItem(ABYSS_KEY) || '{}'); } catch (_) { return {}; } }
function saveAbyss(a) { try { localStorage.setItem(ABYSS_KEY, JSON.stringify(a)); } catch (_) {} }
// Vow ranks — every time a class-triangle actually speaks its vow, the vow
// deepens.  PERSISTS ACROSS RUNS (and deaths): the trio remembers how to
// fight together.  1 use -> rank II, 3 uses -> rank III (+2 to the vow's
// numeric stages per rank above I).
const VOWS_KEY = 'kizuna2_2.vows';
function loadVows() { try { return JSON.parse(localStorage.getItem(VOWS_KEY) || '{}'); } catch (_) { return {}; } }
// VOW RANKS were cut in Build 257: recordVow() was defined and never called
// anywhere, so vowUses() was always 0, vowRank() always returned 1, and both
// consumers (the Roman numeral on the vow title, the ranked boss quote) could
// never fire. The header promised "+2 to the vow's numeric stages per rank" and
// no code ever applied it. A system that cannot happen is not a system.
function vowUses(classKey) { return loadVows()[classKey] || 0; }
function vowRank() { return 1; }
function recordVow(classKey) {
  const v = loadVows(); v[classKey] = (v[classKey] || 0) + 1;
  try { localStorage.setItem(VOWS_KEY, JSON.stringify(v)); } catch (_) {}
}
const ROMAN = ['', 'I', 'II', 'III'];
function trioClassKey(ids) { return ids.map(id => HEROES[id].cls).sort().join('+'); }
const UNLOCK_KEY = 'kizuna2_2.unlocked';

// ═════════════════════════════════════════════════════════════════════════════
// RELICS (Build 277) — objects the abyss did not intend you to have
//
// BOONS are already this game's Slay the Spire relics: forty-one of them, hero-
// gated, drafted mid-run, stacking, several of them curses with real drawbacks.
// A second per-run passive item would have been the same system wearing a hat.
//
// So the line is: A BOON TUNES COMBAT. A RELIC CHANGES THE SHAPE OF THE RUN.
// That is also the Made in Abyss reading of the word — a relic is not a sharper
// sword, it is a compass, a bell, a box that wards a curse. Objects whose
// function is half-understood, recovered from a depth that did not want to give
// them up, and every one of them costs you something on the way back.
//
// One is carried per descent, chosen at the Landing before you climb. That
// makes it a statement of intent rather than a mid-run draft, which is the
// whole reason it is a different thing from a boon.
const RELICS_KEY = 'kizuna2_2.relics';
const RELICS = [
  { id: 'compass', name: 'A CHILD’S COMPASS', icon: '✧',
    found: 'you wake holding it the second time — somebody left it on the landing',
    rule: 'The whole stair is legible from the first step: <b>every node shows what it is</b>, however far ahead.',
    cost: 'The abyss notices you looking. <b>Each floor opens on an ELITE.</b>',
    // Relics arrive when the LANDING does — after a descent has ended. A first
    // run has none, so the picker falls straight through and a new player is
    // never asked to weigh four costs they have no way to read yet.
    at: (m) => ((m.deaths || 0) + (m.clears || 0)) >= 1 },
  { id: 'box', name: 'THE CURSE-WARDING BOX', icon: '⬢',
    found: 'recovered after your first fall',
    rule: 'The first of you who would fall this descent <b>stands instead, at 1 HP</b>.',
    cost: 'The curse goes somewhere. <b>Everyone else takes 4</b>, and the box is empty after.',
    at: (m) => (m.deaths || 0) >= 2 },
  { id: 'glove', name: 'SOMEONE’S LEFT GLOVE', icon: '❖',
    found: 'found once three have walked with you',
    rule: 'You do not wake alone. <b>A second hero walks in with you</b>, wary, from the first step.',
    cost: 'The stair considers your line settled. <b>Nobody else will join you.</b>',
    at: () => getUnlockedStarters().length >= 3 },
  { id: 'ash', name: 'A HANDFUL OF ASH', icon: '◈',
    found: 'it weighs exactly as much as you remember',
    rule: 'You begin with <b>4 embers for every piece</b> of the abyss you have pieced together.',
    cost: 'You arrive already spent. <b>The first camp offers nothing but the fire.</b>',
    at: () => fragsHeld() >= 1 },
];
const RELIC_BY_ID = {}; RELICS.forEach(r => { RELIC_BY_ID[r.id] = r; });
function loadRelics() { try { const a = JSON.parse(localStorage.getItem(RELICS_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (_) { return []; } }
function relicFound(id) { return RELICS.some(r => r.id === id && r.at(META)); }
function relicsFound() { return RELICS.filter(r => r.at(META)); }
// The one you are carrying THIS descent (null if you took nothing, which is a
// legitimate choice — every relic has a cost).
function heldRelic() { return (RUN && RUN.relic && RELIC_BY_ID[RUN.relic]) || null; }
function hasRelic(id) { return !!(RUN && RUN.relic === id); }

function wardFall(h) {
  // THE CURSE-WARDING BOX (Build 277). The curse does not vanish; it is moved.
  // Once per descent, and the whole rest of the line pays for it.
  if (!hasRelic('box') || !S || S._boxSpent) return false;
  S._boxSpent = true;
  h.hp = 1; h.downed = false;
  popupAt(figEl(h.id), '⬢ WARDED', 'boon');
  flashNarrator('<b>⬢ THE CURSE-WARDING BOX</b> opens, takes what was coming for <b>' + h.def.name + '</b>, and hands the rest of it around.');
  livingHeroes().forEach(o => { if (o.id === h.id) return;
    o.hp = Math.max(1, o.hp - 4); popupAt(figEl(o.id), '−4', 'dmg'); });
  try { cineFlash('rgba(150,190,240,0.42)'); stageShake('md'); } catch (_) {}
  return true;
}
function newRun(starterId) {
  // Begin SOLO with the chosen (unlocked) starter; recruit the rest on the road.
  starterId = (starterId && HEROES[starterId]) ? starterId : (getUnlockedStarters()[0] || 'ash');
  const roster = [starterId];
  const hp = {}; hp[starterId] = HEROES[starterId].maxHp;
  // STARTING SPARK — the lone starter opens with their FRONT signature in the
  // CLASSIC tutorial (a solo turn then has a real second action).  It is granted
  // WITHOUT kindling a tree node (see sigUnlocked), so the skill tree — and the
  // rotation DESCENT — start truly empty: every stance begins opener → finisher.
  return {
    roster: roster.slice(),
    active: roster.slice(),
    hp,
    bonds: {},          // pairKey -> points; a pair at 2+ is KINDLED
    floor: 1,           // the descent has FLOORS; clearing a floor boss drops you deeper
    depthBase: 0,       // depth carried from cleared floors, so the ramp keeps rising
    map: generateDescent(roster, 1),   // a fresh branching descent every run
    completed: [],
    embers: 0,          // per-run ember wallet — earned and spent THIS descent only (A HANDFUL OF ASH tops it up in beginRun)
    nodes: [],          // per-run skill-tree unlocks — reset when the run ends; starts EMPTY (everything earned)
    crossed: {},        // heroId -> [nodeId] learned across a BOND from another hero's tree (Build 245)
    wounds: {},         // heroId -> HP that in-fight healing cannot reach; only a REST clears it (Build 291)
    deeds: {},          // pairKey -> { help, strike, avenge, shield, answer } — what they DID together (Build 266)
    forges: [],         // temporary ember tempers bought at camps — reset each descent
    boons: [],          // companion GIFTS drafted on the road — reset each descent (party-gated)
    foes: [],           // travelers you wronged — they ambush a later fight this run
    foesMade: 0,        // count of travelers ever crossed this run — reputation for party MOOD
    emCount: {},        // emergent-loop tallies — accrue ACROSS the whole descent (grow over time)
    done: false,
  };
}
const FLOORS = 4;         // total floors — floor 4 is the short mega-boss gauntlet
const bondRaw = (k) => (RUN && RUN.bonds && RUN.bonds[k]) || 0;   // what this descent actually earned
// …and what it is WORTH, which is more once you know what this place does to the
// people you let go of.  The carry only lifts a bond that already exists —
// fragments make warmth hold faster, they never invent it out of nothing.
// ALWAYS write through bondRaw; writing `bondPts(k) + 1` back into RUN.bonds
// would bank the carry into storage and compound it every fire.
const bondPts = (k) => { const v = bondRaw(k); return v > 0 ? v + bondCarry() : 0; };
function saveRun() { try { localStorage.setItem(RUN_KEY, RUN ? JSON.stringify(RUN) : ''); } catch (_) {} }
function loadRun() { try { const r = localStorage.getItem(RUN_KEY); return r ? JSON.parse(r) : null; } catch (_) { return null; } }

function newBattle(node) {
  // TEST-ONLY: a persisted flag lets the flow suite force CLASSIC combat (to
  // exercise the shared mechanics) regardless of how many runs it spins up.
  // Undefined in production, so it has no effect on the real game.
  let _forceClassic = false;
  try { _forceClassic = localStorage.getItem('kizuna2_2.forceClassic') === '1'; } catch (_) {}
  const ids = node.heroes;
  // POSITION MEMORY — a real DESCENT fight opens where the party stood at the end
  // of the last one (RUN.rows), so a caster who fell back stays back.  Falls back
  // to the default line if a slot's taken or there's no memory (first fight).
  const _usedRows = new Set();
  const heroes = ids.map((id, i) => {
    let row = (node.useRunHp && RUN && RUN.rows && RUN.rows[id]) ? RUN.rows[id] : (['front', 'mid', 'back'][i] || 'front');
    if (_usedRows.has(row)) row = ['front', 'mid', 'back'].find(r => !_usedRows.has(r)) || row;
    _usedRows.add(row);
    // A hero the run remembers as DOWNED (hp 0) enters this fight still downed —
    // out of the fight until a campfire revives them.
    const runHp = (node.useRunHp && RUN) ? RUN.hp[id] : null;
    const startDowned = runHp != null && runHp <= 0;
    return {
      id, def: HEROES[id],
      hp: startDowned ? 0 : ((node.useRunHp && RUN) ? Math.max(1, runHp ?? HEROES[id].maxHp) : HEROES[id].maxHp),
      maxHp: HEROES[id].maxHp,
      row,
      wound: (node.useRunHp && RUN && RUN.wounds) ? (RUN.wounds[id] || 0) : 0,
      guard: 0, buffDmg: 0, counter: 0, invuln: false, downed: startDowned,
      chill: 0, exposed: 0, charge: 0, aether: 0,   // charge: Hask's Black-Mage resource; aether: Pyre(+)/Frost(−) weave meter
    };
  });
  node.enemies.forEach(id => { if (ENEMY_DEFS[id] && !ENEMY_DEFS[id].foeHero) markEnemySeen(id); });   // bestiary discovery
  const enemies = node.enemies.map((id, i) => ({
    id, def: ENEMY_DEFS[id], uid: id + '#' + i,
    hp: ENEMY_DEFS[id].maxHp, maxHp: ENEMY_DEFS[id].maxHp,
    row: ['front', 'mid', 'back'][i] || 'mid',
    guard: 0, power: 0, mark: 0, lull: 0, intentIdx: 0, dead: false, acted: false,
    weakRevealed: false, weakened: false, staggered: false,
    // POISE (Build 234, the Octopath shield) — a VISIBLE break gauge. Every
    // weakness hit chips one pip; at zero the foe BREAKS: it takes amplified
    // damage until it recovers, and its next action is LOST. Sturdier foes
    // carry more pips, so breaking an elite is a plan, not an accident.
    poiseMax: ENEMY_DEFS[id].poise || (ENEMY_DEFS[id].boss ? 4 : ENEMY_DEFS[id].maxHp >= 30 ? 3 : 2),
    poise: ENEMY_DEFS[id].poise || (ENEMY_DEFS[id].boss ? 4 : ENEMY_DEFS[id].maxHp >= 30 ? 3 : 2),
    smart: (node.floor || 1) >= 2,   // deeper foes HUNT the weakest of you (see effIntentRow)
  }));
  // DIFFICULTY — the tutorial (no useRunHp) stays a gentle on-ramp, but the
  // real run (the DESCENT) hits harder and RAMPS as you go deeper, so fights
  // stay threatening instead of being out-tempo'd.  dmgMul feeds the single
  // enemyIntentDmg() source of truth; non-boss HP scales up so foes survive to
  // act (no more turn-1 alpha wipes).  Bosses are already tuned high — they
  // take only a light damage ramp and keep their hand-set HP.
  if (node.useRunHp) {
    // depth carries across floors, so floor 2 continues the ramp (harder) rather
    // than restarting soft.  numLevels-per-floor is 7.
    const depth = Math.max(1, (node.depth || 1) + ((node.floor || 1) - 1) * 7);
    // Small parties (a solo/duo opener before you've recruited) take fewer
    // knocks and face slightly softer foes, so the v1-style solo start is
    // survivable until the road fills your line.  Bosses ignore this — by the
    // final gate you should be a full trio, and the boss is meant to hurt.
    const ps = heroes.length;
    // Build 279: these only ever softened, capping at 1.0 — so the number the
    // whole game is balanced around was the one nobody had measured. Solo stays
    // exactly where it is (already a real fight: 88% -> 36% of the party bar
    // across the skill range, wiping half its runs at 0.4), and the trio's
    // anchor comes up to meet it.
    // Build 283. These were last set when a lone hero DODGED most incoming blows
    // for free — he stands in one row of three, and a dumb foe swung at whatever
    // row its intent named, occupied or not. Build 281 fixed that aiming, which
    // quietly tripled the damage a solo or duo actually takes while changing
    // nothing at all for a trio (a full line already occupies every row). Runs
    // measured after it: 2 of 4 floors ended on the FIRST fight.
    // So the small-party multipliers come down to match what now lands.
    const psDmg = ps >= 3 ? 1.25 : ps === 2 ? 0.62 : 0.38;
    const psHp = ps >= 3 ? 1.12 : ps === 2 ? 0.82 : 0.62;
    enemies.forEach(e => {
      if (e.def.boss) {
        // Bosses already hit hard and strike TWICE a round, so their per-floor
        // ramp is GENTLE (+3 effective depth per floor, not +7): a single
        // UNPARRIED blow should be frightening, not an instant execution.
        const bdepth = Math.max(1, (node.depth || 1) + ((node.floor || 1) - 1) * 3);
        e.dmgMul = 2.3 + (bdepth - 1) * 0.08;
        // A single-target boss gets FOCUS-FIRED by a full trio, so it needs real
        // bulk to be a CLIMAX rather than a 2-turn pushover — but its DIFFICULTY
        // comes from DENSER parry cascades, not more HP (see setParryDifficulty).
        const fl = node.floor || 1;
        // Build 210: bosses bulked ~35-40% (measured: a trio cleared the old
        // floor-1 boss in 3 turns untouched) — the cinematics promise a climax,
        // the HP now backs it up.  Difficulty still comes from the parry gauntlet.
        const bhpMult = fl >= 3 ? 3.3 : fl >= 2 ? 2.6 : 3.9;
        const hp = Math.round(e.maxHp * bhpMult);
        e.maxHp = hp; e.hp = hp;
      } else {
        e.dmgMul = (1.8 + (depth - 1) * 0.08) * psDmg;
        // HP curve is EARLY-WEIGHTED: base 1.9 (was 1.65) so a party's opening
        // rotations don't 1-turn early fights, with a gentler per-depth ramp so the
        // late game (where your rotations are grown) stays where it was tuned.
        const hp = Math.round(e.maxHp * (MOB_HP_BASE + (depth - 1) * 0.055) * psHp);
        e.maxHp = hp; e.hp = hp;
      }
      // ELITE nodes hit harder and last longer — a real spike over a plain fight.
      if (node.elite && !e.def.boss) {
        e._elite = true;                 // pays the bigger ember bounty (emberReward)
        e.dmgMul *= 1.3;
        const hp = Math.round(e.maxHp * 1.6);
        e.maxHp = hp; e.hp = hp;
      }
    });
    // HEAT — the opt-in difficulty valve.  Each level makes every foe hit harder
    // and last longer, so a widening tree meets a rising challenge (and pays more
    // embers — see emberReward).
    const heat = META.heat || 0;
    if (heat > 0) {
      enemies.forEach(e => {
        e.dmgMul = (e.dmgMul || 1) * (1 + heat * 0.15);
        const hp = Math.round(e.maxHp * (1 + heat * 0.12));
        e.maxHp = hp; e.hp = hp;
      });
    }
  }
  // MEGA BOSS — swap the placeholder def for its first live stage (per-stage HP
  // scaled by the same HEAT factor).  Keeps the boss's rolled dmgMul from above.
  enemies.forEach(e => { if (e.def && e.def.megaBoss) initMegaBoss(e, META.heat || 0); });
  // Kindled bonds walk into battle already connected: the pair's thread is
  // pre-formed and the bond-guard applies from turn one.  The triad itself
  // still needs ONE act of help this fight to awaken (see addThread).
  // Sharpened steel from camp: the party opens this fight rallied.
  if (node.useRunHp && RUN && RUN.campEdge) {
    heroes.forEach(h => { h.buffDmg += 2; });
    RUN.campEdge = false;
    saveRun();
  }
  const threads = new Set();
  if (node.useRunHp && RUN && RUN.bonds) {
    const ids = heroes.map(h => h.id);
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const k = pairKey(ids[i], ids[j]);
      if (bondPts(k) >= BOND_KINDLED) {
        threads.add(k);
        [ids[i], ids[j]].forEach(id => { const h = heroes.find(x => x.id === id); if (h) h.guard += 2; });
      }
    }
  }
  // BRANCHING ROTATIONS are the combat system for the real DESCENT (useRunHp
  // fights); the tutorial stays a classic on-ramp.  RUN._rotations can force it.
  // A node can now ASK for rotations (node.rotations), so the tutorial can teach
  // the real engine without also inheriting useRunHp's run-HP and difficulty ramp.
  const _rot = _forceClassic ? false
              : (node && node.rotations === true) ? true
              : (RUN && RUN._rotations === false) ? false
              : (RUN && RUN._rotations === true) ? true
              : !!(node && node.useRunHp);
  return {
    node, heroes, enemies,
    // ROTATION combat now charges EP for FINISHERS, so it opens with +1 EP — the
    // extra energy makes "which rotations do I cash?" an ALLOCATION choice, not a tax.
    maxEp: 2 + heroes.length + (_rot ? 1 : 0), ep: 2 + heroes.length + (_rot ? 1 : 0),
    used: new Set(),
    threads,
    pairsAwake: new Set(),   // kindled pairs whose DUET has awakened THIS fight
    tempCards: [], _tuid: 0, _chainGroup: 0, channelUsed: false,
    _rotations: _rot,
    // THE LINE — one party-wide combo, three beats, whoever takes them (see the
    // block above resolveLinePlay). ON wherever rotations are, because it is the
    // one version of this idea that delivered the number: mid-rotation `plays`
    // roughly DOUBLES for a trio (2.65 → 5.30 easy pack, 2.65 → 5.14 hard), and
    // it rises for every party on both packs — where the forced-pass relay of
    // Build 292 came back flat. It costs throughput: a line cashes ONE finisher
    // where three private chains cashed three, so damage a turn roughly halves
    // and a hard room now bites (see docs/THE-LINE.md). EP is the lever for that
    // and it has not been pulled yet. `RUN._line = false` runs the private
    // per-hero chains, which is the A/B baseline test/linemeter.cjs measures.
    _line: (RUN && RUN._line !== undefined) ? RUN._line : true,
    line: null,                  // the line in flight: { depth, beats[], opener, stanceOf }

    momentum: 0, combo: 0, comboBest: 0, allOutUsed: 0, burstLevel: 1,   // burst container grows via DUET/TRIAD (see expandBurst)
    triadFormed: false, allOutCrowned: false,
    executing: false, over: false, turn: 1,
  };
}

// Generated cards — skills forging skills.  Capped at 3 so the fan never
// floods; each carries temp:true + a uid, and may expire at turn end.
function genTempCard(card) {
  if (S.tempCards.length >= 3) { flashNarrator('The moment passes — too many possibilities in hand.'); return; }
  card.temp = true;
  card.uid = ++S._tuid;
  S.tempCards.push(card);
  S._tempNew = card.uid;
  SFX.card();
  renderAll();
}

const pairKey = (a, b) => [a, b].sort().join('|');
const livingHeroes = () => S.heroes.filter(h => !h.downed);
const livingEnemies = () => S.enemies.filter(e => !e.dead);
const heroInRow = (row) => livingHeroes().find(h => h.row === row) || null;
const frontmostEnemy = () => ['front', 'mid', 'back'].map(r => livingEnemies().find(e => e.row === r)).find(Boolean) || livingEnemies()[0] || null;
// PAINTED FOE ART (Build 215) — a foe with a commissioned plate renders the
// PNG; everything else keeps its vector silhouette.  Listing a key here is the
// ONLY step needed to promote a foe once its plate lands in /art/foe-<key>.png,
// and a missing file degrades to the vector rather than a blank figure.
// A key here promotes that foe to its painted plate at /art/foe-<key>.png.
// KEEP THIS LIST HONEST: a listed foe whose file is missing renders a blank
// figure and 404s on every repaint, so a key goes in only once the art lands.
const ENEMY_ART_PNG = {
  husk: 1,        // the chained beast — Heavy Claw / Lurch
  wraith: 1,      // the plumed crouching flurry
  cultist: 1,     // the hooded channeler
  mourner: 1,     // the veiled moon-staff keener
  revenant: 1,    // the skull-masked duellist (elite)
};
function enemyArtKey(e) { return (e && e.def && e.def.art) || (e && e.id) || ''; }
function foeArtHTML(key, uid, animKey) {
  const vec = V2PORTRAITS[key] || V2PORTRAITS.wraith || '';   // never render a blank figure
  // ANIMATED SHEET — revealed only once its file really loads.  A missing
  // sheet leaves the plate/vector exactly as it was.
  const ak = animKey || (FOE_ANIM[key] ? key : null);
  const anim = ak
    ? `<span class="fig-anim" data-anim-uid="${uid || ak}" style="background-image:url('../art/${FOE_ANIM[ak]}')"></span>`
    : '';
  const base = (!key || !ENEMY_ART_PNG[key]) ? vec
    : `<span class="fig-vec">${vec}</span>`
    + `<img class="fig-png" src="../art/foe-${key}.webp" alt="" decoding="async"`
    + ` onload="this.classList.add('fig-png-on')" onerror="this.remove()">`;
  return base + anim;
}
// reveal + attach animated layers whose sheets have really loaded.  The probe
// result is CACHED per URL — figures rebuild every render, and re-probing a
// missing sheet would 404 once per repaint (the plates learned this lesson in
// Build 215's 404 storm).  One probe, one verdict, per sheet per session.
const _foeAnimSheets = {};   // url -> 'loading' | 'ok' | 'dead'
function foeAnimReveal(scope) {
  (scope || document).querySelectorAll('.fig-anim:not(.fig-anim-on):not(.fig-anim-dead)').forEach(el => {
    const src = /url\(["']?([^"')]+)["']?\)/.exec(el.style.backgroundImage);   // browsers normalize the quoting
    if (!src) return;
    const url = src[1];
    const st = _foeAnimSheets[url];
    if (st === 'ok') { el.classList.add('fig-anim-on'); foeAnimAttach(el.dataset.animUid, el); return; }
    if (st === 'dead') { el.classList.add('fig-anim-dead'); return; }
    if (st === 'loading') return;
    _foeAnimSheets[url] = 'loading';
    // fetch, not Image: a missing file answers 404 without a console error, so
    // an un-uploaded sheet keeps the zero-pageError standard.
    fetch(url, { method: 'HEAD' })
      .then(r => { _foeAnimSheets[url] = r.ok ? 'ok' : 'dead'; foeAnimReveal(); })
      .catch(() => { _foeAnimSheets[url] = 'dead'; foeAnimReveal(); });
  });
}
// animation is keyed by enemy ID (floor bosses share art keys — echoknight2
// and the Maw both draw 'echoknight'), the plate stays keyed by art.
const enemyArt = (e) => foeArtHTML(enemyArtKey(e), e && e.uid, e && FOE_ANIM[e.id] ? e.id : null);

// ══ FOE ANIMATION (Build 235) — sprite-sheet frames driven by COMBAT STATE ══
// One painted sheet per animated foe, cut at runtime by an ATLAS of
// normalized frame rects (background-size/position math — no slicing step,
// no extra files). The engine is a per-figure state machine fed by the real
// fight: the wind-up plays PREP, its strike plays ATTACK 1→4 into RECOVERY,
// damage plays HIT REACT (heavy hits the heavier pair), a POISE break holds
// the stagger frames for the whole reeling window, and death runs the
// three-stage dissolve under the existing fig-dying treatment.
//
// Same degradation contract as ENEMY_ART_PNG: listing a foe here does NOTHING
// until its sheet actually loads — the vector/plate stays, no 404 storms, and
// the sheet lights up the moment the file lands in /art.
const FOE_ANIM = {
  echoknight2: 'boss-anim.webp',   // THE ECHO KNIGHT, REMEMBERED — the floor-1 boss
};
// Frame rects in SHEET PIXELS [x, y, w, h], calibrated against the real
// art's alpha content (rows segmented by opacity profile; the attack row's
// trails bleed across cells, so its boundaries come from the caption centers).
// FOE_ANIM_SHEET is the sheet's natural size — the paint math needs it to
// keep every frame at ONE consistent scale, feet anchored, regardless of how
// wide its cell is (ATTACK 4 spans ~350px, IDLE ~190px; stretch-to-fill would
// balloon the creature on its calm frames).
const FOE_ANIM_SHEET = { w: 1536, h: 1024 };
const FOE_ANIM_ATLAS = {
  idle:     [[24,12,195,230],[250,12,178,230],[457,12,189,230]],
  prep:     [[882,12,208,230],[1108,12,203,230],[1339,12,189,230]],
  attack:   [[8,276,231,220],[239,276,258,220],[497,276,271,220],[768,276,350,220]],
  recovery: [[1120,276,186,220],[1329,276,183,220]],
  hit:      [[9,532,212,196],[219,532,229,196]],
  heavy:    [[455,532,217,196],[674,532,212,196]],
  death:    [[890,532,191,196],[1087,532,215,196],[1316,532,209,196]],
};
// ── the FX row (Build 237): the sheet's projectile orb stages + impact
// burst, cut from the same atlas.  The orb glows overlap on the sheet, so
// these rects are the authored grid rather than alpha clusters.
const FOE_FX = {
  orb:   [[92,782,76,82],[17,782,75,82],[17,866,111,108],[128,866,120,108]],   // small → flaring
  burst: [794,770,180,206],
};
// A CAST: the painted orb flies caster → target (screen-space, camera-safe,
// measured endpoints like every popup), growing through its stages, and
// detonates the sheet's impact burst on arrival.  Resolves AT impact so the
// damage lands on the hit, not before it.
function castProjectileFx(fromEl, toEl, ms) {
  return new Promise(resolve => {
    if (!fromEl || !toEl || (typeof camReduced === 'function' && camReduced())) return resolve();
    const layer = $('#popup-layer'); if (!layer) return resolve();
    const sr = $('#stage').getBoundingClientRect(), sc = (sr.width / stageDW()) || 1;
    const pt = (el) => { const r = figHitRect(el) || el.getBoundingClientRect();
      return { x: (r.left + r.width / 2 - sr.left) / sc, y: (r.top + r.height * 0.42 - sr.top) / sc }; };
    const a = pt(fromEl), b = pt(toEl);
    const dur = ms == null ? 480 : ms;
    const orb = document.createElement('div');
    orb.className = 'fx-orb';
    orb.style.left = a.x + 'px'; orb.style.top = a.y + 'px';
    layer.appendChild(orb);
    const t0 = performance.now();
    const paint = (f) => {
      const [x, y, w, h] = FOE_FX.orb[f];
      const box = 46; const k = box / Math.max(w, h);
      orb.style.width = (w * k) + 'px'; orb.style.height = (h * k) + 'px';
      orb.style.backgroundSize = (FOE_ANIM_SHEET.w * k) + 'px ' + (FOE_ANIM_SHEET.h * k) + 'px';
      orb.style.backgroundPosition = (-x * k) + 'px ' + (-y * k) + 'px';
    };
    paint(0);
    const step = () => {
      const t = Math.min(1, (performance.now() - t0) / dur);
      const e = t * t * (3 - 2 * t);   // smoothstep — the cast leaves slow, arrives fast enough
      orb.style.transform = 'translate(-50%, -50%) translate(' + ((b.x - a.x) * e) + 'px, ' + ((b.y - a.y) * e - Math.sin(t * Math.PI) * 26) + 'px)';
      paint(Math.min(FOE_FX.orb.length - 1, Math.floor(t * FOE_FX.orb.length)));
      if (t < 1) { requestAnimationFrame(step); return; }
      orb.remove();
      burstFxAt(b.x, b.y);
      resolve();
    };
    requestAnimationFrame(step);
  });
}
// the sheet's IMPACT BURST, blooming at a stage point then gone
function burstFxAt(x, y) {
  const layer = $('#popup-layer'); if (!layer) return;
  const el = document.createElement('div');
  el.className = 'fx-burst';
  const [bx, by, bw, bh] = FOE_FX.burst;
  const box = 130; const k = box / Math.max(bw, bh);
  el.style.width = (bw * k) + 'px'; el.style.height = (bh * k) + 'px';
  el.style.backgroundSize = (FOE_ANIM_SHEET.w * k) + 'px ' + (FOE_ANIM_SHEET.h * k) + 'px';
  el.style.backgroundPosition = (-bx * k) + 'px ' + (-by * k) + 'px';
  el.style.left = x + 'px'; el.style.top = y + 'px';
  layer.appendChild(el);
  setTimeout(() => el.remove(), 420);
}

// per-state playback: frame duration, whether it loops, and where it lands
const FOE_ANIM_PLAY = {
  idle:     { ms: 420, loop: true },
  prep:     { ms: 170, hold: true },              // holds the coiled last frame
  attack:   { ms: 110, then: 'recovery' },
  recovery: { ms: 150, then: 'idle' },
  hit:      { ms: 100, then: 'idle' },
  heavy:    { ms: 120, then: 'idle' },
  broken:   { ms: 420, loop: true, frames: 'heavy' },   // reels for the whole break window
  death:    { ms: 240, hold: true },
};
const _foeAnim = {};   // uid -> { el, state, frame, at }
let _foeAnimT = null;
function foeAnimAttach(uid, el) {
  _foeAnim[uid] = { el, state: 'idle', frame: 0, at: performance.now() };
  foeAnimPaint(_foeAnim[uid]);
  if (!_foeAnimT) _foeAnimT = setInterval(foeAnimTick, 80);
}
function foeAnimState(uid, state) {
  const a = _foeAnim[uid];
  if (!a || !a.el || !a.el.isConnected) return;
  if (a.state === 'death') return;                       // nothing interrupts the dissolve
  if (a.state === 'broken' && state !== 'death' && state !== 'idle' && state !== 'attack') return;
  if (!FOE_ANIM_PLAY[state]) return;
  a.state = state; a.frame = 0; a.at = performance.now();
  foeAnimPaint(a);
}
function foeAnimPaint(a) {
  const play = FOE_ANIM_PLAY[a.state];
  const frames = FOE_ANIM_ATLAS[play.frames || a.state];
  const [x, y, w, h] = frames[Math.min(a.frame, frames.length - 1)];
  const boxW = a.el.clientWidth || 1, boxH = a.el.clientHeight || 1;
  // ONE scale for every frame: the tallest frame row fills the box height, so
  // the creature stays the same size whether its cell is narrow (idle) or
  // wide (the attack sweep) — feet anchored, centered on its cell.
  const scale = boxH / 230;
  // the element becomes exactly ONE frame wide — a box wider than the cell
  // (the floor boss's art spans its whole half) would otherwise show the
  // NEIGHBORING sheet cells on either side.
  a.el.style.width = (w * scale) + 'px';
  a.el.style.backgroundSize = (FOE_ANIM_SHEET.w * scale) + 'px ' + (FOE_ANIM_SHEET.h * scale) + 'px';
  a.el.style.backgroundPosition = (-(x * scale)) + 'px ' + (-(y * scale) + (boxH - h * scale)) + 'px';
}
function foeAnimTick() {
  if (document.hidden) return;
  const now = performance.now();
  let live = 0;
  for (const uid in _foeAnim) {
    const a = _foeAnim[uid];
    if (!a.el || !a.el.isConnected) { delete _foeAnim[uid]; continue; }
    live++;
    if (typeof camReduced === 'function' && camReduced()) continue;   // hold the pose
    const play = FOE_ANIM_PLAY[a.state];
    const frames = FOE_ANIM_ATLAS[play.frames || a.state];
    if (now - a.at < play.ms) continue;
    a.at = now;
    if (a.frame + 1 < frames.length) { a.frame++; foeAnimPaint(a); }
    else if (play.loop) { a.frame = 0; foeAnimPaint(a); }
    else if (play.then) { a.state = play.then; a.frame = 0; foeAnimPaint(a); }
    // hold: stay on the last frame
  }
  if (!live) { clearInterval(_foeAnimT); _foeAnimT = null; }
}

// ---------------------------------------------------------------------------
// HAND
// ---------------------------------------------------------------------------
function cardType(card) {
  if (card.kind === 'resonant') return 'resonant';
  if (card.kind === 'temp') return 'temp';
  if (card.kind === 'move') return 'move';
  const fx = card.fx || {};
  if (fx.dmg) return 'attack';
  if (fx.guard || fx.counter) return 'guard';
  return 'skill';
}
function buildHand() {
  // Each hero contributes a Core + their Signature (once it's UNLOCKED) — so the
  // hand GROWS as you kindle skills on the way down.  That breadth is earned, not
  // dumped on you: you open with a single spark and unlock the rest through the
  // ember tree, growing into a wide full-party hand as you go.  HEAVY heroes
  // hold BOTH cards like everyone else, but each costs +1 EP — so fielding
  // both in one turn is a real commitment.  Movement is not a card — you drag.
  // When the triad forms, the resonant card HIJACKS the host's signature slot
  // (the card evolves).  Played cards LEAVE the fan (they return next turn) — what
  // remains is exactly what you can still do.
  const hand = [];
  const temps = S.tempCards.filter(t => t.expiresTurn == null || t.expiresTurn >= S.turn);
  // A rotation grows IN PLACE: a hero's forged builders/finishers sit right where
  // their opener was, not appended to the far right of the fan — so the card that
  // left the slot visibly becomes its next step(s) there.  Non-chain temps (stance
  // echoes, emergent forges) still trail at the end.
  const chainTemps = {};
  temps.forEach(t => { if (t.chain) (chainTemps[t.owner] = chainTemps[t.owner] || []).push(t); });
  const lineIsLive = lineLive();   // once per build — it is stable within the call
  livingHeroes().forEach(h => {
    // CHAIN HEROES show a single OPENER instead of core+sig — their builders and
    // finishers arrive as forged temp cards as the rotation plays out.
    const rot = rotationFor(h);
    if (rot) {
      // A LINE IN FLIGHT OWNS THE TABLE.  While one is live nobody opens a second:
      // every hero shows what they can contribute at the CURRENT stage, in the slot
      // their opener sat in, and the openers themselves are gone until the line is
      // closed. That is what makes discarding them a real cost and what keeps the
      // combo one thing the party is building rather than three running at once.
      if (lineIsLive) { (chainTemps[h.id] || []).forEach(t => hand.push(t)); return; }
      // THE HAND IS THE POSITION (v2.2 Build 10). One opener, and it is the
      // row's own — what this hero has learned to open HERE. See the note on
      // the removed reach above genChainStep for why nothing else is dealt.
      const op = mkChainOpener(h, rot);
      if (!op.spent) hand.push(op);
      // \u2026and the LEARNED second opener for this row, if the node is kindled
      const alt = ALT_OPENERS[h.id];
      if (alt && h.row === alt.row && hasNode(alt.node) && rot.cards[alt.key]) {
        const ao = mkChainOpener(h, rot, null, alt.key);
        if (!ao.spent) hand.push(ao);
      }
      (chainTemps[h.id] || []).forEach(t => hand.push(t));   // forged steps sit in this hero's slot
      return;
    }
    const set = h.def.cards[h.row];
    const core = mkCard(h, 'core', set.core);
    if (!core.spent) hand.push(core);
    if (sigUnlocked(h)) { const sig = mkCard(h, 'sig', set.sig); if (!sig.spent) hand.push(sig); }
    (chainTemps[h.id] || []).forEach(t => hand.push(t));     // (a non-rotation hero can still hold forged temps)
  });
  temps.forEach(t => { if (!t.chain) hand.push(t); });       // echoes / emergent forges trail at the end
  return hand;
}
function mkCard(h, kind, def) {
  const tempo = h.def.tempo || 'steady';
  let cost = def.cost;
  if (tempo === 'swift' && cost > 1) cost -= 1;   // fast heroes play cheap and often
  if (tempo === 'heavy') cost += 1;               // heavy heroes hold BOTH cards, but each carries a premium — playing both commits the whole turn
  // EMBER RIDERS (permanent) + FORGES (temporary, per-run) bolt effects onto the
  // base card.  Clone fx first so the shared def is never mutated.
  let fx = def.fx, desc = def.desc;
  const riders = ridersFor(h.id, def.name);
  const forges = runForges();
  const boons = runBoons().filter(b => b.card);
  if (riders.length || forges.length || boons.length) fx = Object.assign({}, def.fx);
  if (riders.length) {
    riders.forEach(n => {
      Object.keys(n.rider.fx).forEach(k => { fx[k] = (fx[k] || 0) + n.rider.fx[k]; });
      if (n.rider.descAdd) desc = desc + n.rider.descAdd;
    });
  }
  const card = { kind, owner: h.id, ownerName: h.def.name, tint: h.def.tint, tempo,
    stance: STANCE[h.row].name, name: def.name, cost, target: def.target, fx, desc,
    school: (fx && fx.dmg) ? h.def.school : null,
    spent: S.used.has(h.id + ':' + kind) };
  // temper the cloned card with any run forges (mutates card.fx / card.cost)
  forges.forEach(fid => { const f = FORGE_BY_ID[fid]; if (f) f.apply(card); });
  boons.forEach(b => { try { b.card(card); } catch (_) {} });   // companion gifts bend the card too
  if (card.fx && card.fx.dmg && !card.school) card.school = h.def.school;
  return card;
}
// Synthetic move "card" — never shown in hand; movement is a figure-drag
// (or tap-the-hero, then tap a row).  Routed through playCard so EP cost,
// once-per-turn use, and execution flow stay identical to real cards.
// SWIFTFOOT (Mira) — her FIRST move each turn is free.  Since a hero may move
// only once per turn, this makes her sole move cost no EP: slip in and out
// without paying the tempo (and it feeds Afterimage's free echo).
// BASTION (Cassia) — the immovable wall shrugs off ❄ CHILL entirely.
function heroResistsChill(h) {
  if (!h) return false;
  const n = EMBER_TREE.find(x => x.id === 'cassia.passive.bastion');
  return heroOwnsNode(h.id, n);   // Cassia's, or anyone who crossed for it
}
function moveCost(h) {
  if (!h || S.used.has(h.id + ':move')) return 1;                                         // only the FIRST move can be free
  if (heroHas(h.id, 'mira.passive.swiftfoot')) return 0;                      // Swiftfoot — always free
  // Warstep keys off THIS hero having struck, not off Ash specifically, so a
  // hero who crossed for it gets the same deal on their own attack.
  if (heroHas(h.id, 'ash.passive.warstep') && (S._flags || {})[h.id + 'Struck']) return 0;
  return 1;
}
function mkMoveAction(h) {
  return { kind: 'move', owner: h.id, ownerName: h.def.name, tint: h.def.tint,
    stance: STANCE[h.row].name, name: 'Move', cost: moveCost(h), target: 'row',
    desc: '', spent: S.used.has(h.id + ':move') };
}
function canMove(h) {
  return !S.executing && !S.over && !S._staging && !h.downed && S.ep >= moveCost(h) && !S.used.has(h.id + ':move');
}
function triadEntryFor(ids) {
  const classes = ids.map(id => HEROES[id].cls).sort().join('+');
  return RESONANT_TABLE[classes] || RESONANT_FALLBACK;
}
function triadEntry() { return triadEntryFor(livingHeroes().map(h => h.id)); }

// ---------------------------------------------------------------------------
// PLAY — tap or drag.
// ---------------------------------------------------------------------------
function onCardTap(card) {
  if (S.executing || S.over || S._staging || card.spent) return;
  if (card.cost > S.ep) { flashNarrator('Not enough EP.'); return; }
  if (card.kind === 'resonant' && !card.pair && S.ep < S.maxEp) {
    flashNarrator('The Vow needs your ENTIRE turn — play it first.');
    return;
  }
  const spec = targetSpec(card);
  if (spec.pick) { enterTargeting(card, spec.validIds, spec.hint); return; }
  playCard(card, null);
}
// What a card needs: pick=true → tap/drop a specific figure or row.
function targetSpec(card) {
  if (card.target === 'enemy') return { pick: true, validIds: livingEnemies().map(e => e.uid), hint: 'Choose an enemy' };
  if (card.target === 'ally') {
    const others = livingHeroes().filter(h => h.id !== card.owner).map(h => h.id);
    return { pick: true, validIds: others.length ? others : livingHeroes().map(h => h.id), hint: 'Choose an ally' };
  }
  if (card.target === 'row') {
    const owner = S.heroes.find(h => h.id === card.owner);
    return { pick: true, isRow: true, validIds: ROWS.filter(r => r !== owner.row).map(r => 'row:' + r), hint: 'Choose a row' };
  }
  return { pick: false };
}
// ─── THE RACK (v2.2 Build 5) — one rule, strictly kept ──────────────────────
// AT REST everyone is crisp, both sides — no depth blur, no half-racks.
// AIMING is not an action: nothing blurs while a card picks its target (you
// must read every candidate); the actor just LIGHTS, and a hovered candidate
// lights. The moment an action RESOLVES, exactly two figures hold focus —
// the actor and the receiver — and everyone else on BOTH sides falls off
// the lens; when the action finishes, everyone returns.
//
// The focus set lives in _rackIds (STATE, not DOM classes) because
// renderBattlefield rebuilds every figure's className mid-action — the old
// class-only marks were silently wiped by the first re-render, leaving the
// stage racked with nobody in focus. That was the inconsistency.
let _rackIds = null;   // Set of hero ids / enemy uids in focus, or null at rest
function _applyRack() {
  const st = document.getElementById('stage'); if (!st) return;
  st.classList.toggle('rack', !!_rackIds);
  document.querySelectorAll('#battlefield .figure').forEach(el => {
    const id = el.dataset && el.dataset.fig;
    el.classList.toggle('fig-focus', !!(_rackIds && id && _rackIds.has(id)));
  });
}
// THE ACTION BEAT: actor + receiver (either side — a heal's receiver is an
// ally), everyone else off the lens.
function focusPair(actorId, receiverId) {
  try { _rackIds = new Set([actorId, receiverId].filter(Boolean)); _applyRack(); } catch (_) {}
}
function releaseFocus() {
  try {
    _rackIds = null; _applyRack();
    document.querySelectorAll('.figure.fig-actor, .figure.fig-mark').forEach(el => el.classList.remove('fig-actor', 'fig-mark'));
  } catch (_) {}
}
// Aim-time highlight: the acting hero lights while their card aims. The
// renderer re-applies this from `targeting` state, so re-renders keep it.
function pullFocus(heroId) {
  try {
    document.querySelectorAll('#party-half .figure.fig-actor').forEach(el => el.classList.remove('fig-actor'));
    const fig = heroId ? figEl(heroId) : null;
    if (fig) fig.classList.add('fig-actor');
  } catch (_) {}
}
// Aim-time hover: the candidate the drag is snapped to lights. A highlight,
// never a blur — an empty list simply clears it.
function markEnemyFocus(els) {
  try {
    const want = (els || []).filter(Boolean);
    document.querySelectorAll('#enemy-half .figure.fig-mark').forEach(el => {
      if (want.indexOf(el) < 0) el.classList.remove('fig-mark');
    });
    want.forEach(el => el.classList.add('fig-mark'));
  } catch (_) {}
}

function enterTargeting(card, validIds, hint, opts) {
  // The acting hero holds focus for the whole aim, not just the drag — a tapped
  // card that opens a target pick is the same beat as a lifted one.
  pullFocus(card && card.owner);
  // AIMING QUIET (Build 238) — while a card picks its target, every status
  // chip and intent pill fades to a whisper so the CHARACTERS carry the
  // choice.  clearAim restores the info the moment the pick resolves.
  try { $('#stage').classList.add('aiming'); } catch (_) {}
  targeting = Object.assign({ card, validIds }, opts || {});
  if (validIds[0] && validIds[0].startsWith('row:')) targeting.isRow = true;
  $('#target-hint').textContent = hint + (targeting.drag ? '' : ' — tap a figure');
  $('#target-hint').classList.remove('hidden');
  renderBattlefield();
  renderThreads();
}
function cancelTargeting() {
  targeting = null;
  releaseFocus();   // the pick is off — settle back to a party that all reads crisp
  $('#target-hint').classList.add('hidden');
  renderAll();
}
// Hard-reset all transient interaction state — targeting, the aim veil, any
// in-flight card-drag layer — so nothing leaks between fights or across a NEW
// GAME (a run abandoned mid-aim otherwise leaves cards un-draggable).
function clearAim() {
  targeting = null;
  const th = document.getElementById('target-hint'); if (th) { th.classList.add('hidden'); th.classList.remove('th-tech'); }
  const aim = document.getElementById('aim-layer'); if (aim) aim.innerHTML = '';
  document.querySelectorAll('.card.card-dragging, .figure.fig-dragging').forEach(el => { el.classList.remove('card-dragging', 'fig-dragging'); el.style.transform = ''; el.style.transition = ''; });
  // KILL any leaked window-level drag listener from a prior fight — this is the
  // one piece of state that survives an S/RUN reset, and if a drag's pointerup
  // never fired (a re-render swapped the card, the run ended mid-gesture) its
  // window listener lingers and can swallow the NEXT game's card gestures, so the
  // new hand reads as "glitched / un-draggable."  Also drop any frozen/focus/slow
  // stage classes so nothing from the last fight bleeds into the next.
  try { if (_dragWinUp) { window.removeEventListener('pointerup', _dragWinUp, true); window.removeEventListener('pointercancel', _dragWinUp, true); _dragWinUp = null; } } catch (_) {}
  try { _slowmoRef = 0; const st = document.getElementById('stage'); if (st) st.classList.remove('parry-focus', 'parry-slowmo', 'allout-focus', 'cam-in', 'frozen', 'aiming'); } catch (_) {}
  releaseFocus();   // the party must never be left racked out of focus at rest
  try { _camBase = CAM_POSE_HOME; camRelease(); } catch (_) {}   // a held camera (or a turn pose) must never survive a fight
  // Force a CLEAN hand rebuild next render: throw away any stale card DOM (and its
  // drag closure, whose `pid` may be stuck from a gesture the last fight cut short)
  // so the new fight always wires fresh, draggable cards.
  try { const hnd = document.getElementById('hand'); if (hnd) hnd.innerHTML = ''; } catch (_) {}
}
// The single live window-level drag listener (see attachDrag) — tracked module-wide
// so clearAim can guarantee it's gone between games.
let _dragWinUp = null;
function onFigureTap(id) {
  if (!targeting || targeting.isRow || targeting.drag) return;
  if (!targeting.validIds.includes(id)) { cancelTargeting(); return; }
  const card = targeting.card;
  targeting = null;
  releaseFocus();   // the pick resolved — the rack settles before the action plays
  $('#target-hint').classList.add('hidden');
  playCard(card, id);
}
function onRowTap(row) {
  if (!targeting || !targeting.isRow || targeting.drag) return;
  const card = targeting.card;
  if (!targeting.validIds.includes('row:' + row)) { cancelTargeting(); return; }
  targeting = null;
  releaseFocus();
  $('#target-hint').classList.add('hidden');
  playCard(Object.assign({}, card, { toRow: row }), null);
}

// Drag-to-play (the mock's primary gesture).  pointerdown on a card arms it;
// movement past a threshold lifts the card and highlights valid targets;
// release over a target (or over the battlefield, for untargeted cards)
// plays it.  A short press-release without movement falls back to tap-play.
// Aim helpers — StS-style targeting: the card lifts, an arrow curves to the
// SNAPPED target (always the nearest valid one), and releasing anywhere in
// the field plays on it.  Loose, precise, and unmistakable about where a
// card lands.
const _AIMNS = 'http://www.w3.org/2000/svg';
// TRUE stage scale = rendered width ÷ LOGICAL width.  The logical width is 760 on
// mobile but LARGER on desktop (the canvas is enlarged — see fitStage), so every
// screen⇄stage coordinate conversion must divide by the ACTUAL design size, not a
// hardcoded 760/430, or taps and parry rings land in the wrong place on desktop.
function stageDW() { const s = document.getElementById('stage'); return (s && s.offsetWidth) || 760; }
function stageDH() { const s = document.getElementById('stage'); return (s && s.offsetHeight) || 430; }
function stageScale() { const s = document.getElementById('stage'); if (!s) return 1; return (s.getBoundingClientRect().width / (s.offsetWidth || 760)) || 1; }
function _sscale() { return stageScale(); }
function enemyFigEls() { return livingEnemies().map(e => figEl(e.uid)).filter(Boolean); }
function dragTargets(card) {
  const fx = card.fx || {};
  if (fx.notToday) return { mode: 'field', els: [] };
  switch (card.target) {
    case 'enemy':     return { mode: 'enemy', els: enemyFigEls() };
    case 'frontmost': { const f = frontmostEnemy(); return { mode: 'enemy', els: f ? [figEl(f.uid)].filter(Boolean) : [] }; }
    case 'ally': {
      // Match targetSpec (the tap path): when the caster is the ONLY living
      // ally (e.g. Ash alone in the onboarding), an ally card falls back to
      // targeting yourself — otherwise Crossguard & friends can't be dropped.
      const others = livingHeroes().filter(h => h.id !== card.owner);
      const pool = others.length ? others : livingHeroes();
      return { mode: 'ally', els: pool.map(h => figEl(h.id)).filter(Boolean) };
    }
    case 'allies':    return { mode: 'party', els: livingHeroes().map(h => figEl(h.id)).filter(Boolean) };
    case 'self':      return { mode: 'self',  els: [figEl(card.owner)].filter(Boolean) };
    default:          return { mode: 'field', els: [] };
  }
}
// Which figures a field card (Not Today) actually touches — so the aim can light
// them up instead of pointing at empty air.
function fieldTargets(card) {
  const fx = card.fx || {};
  if (fx.notToday)  return fx.notToday.map(id => figEl(id)).filter(Boolean);
  return [];
}
function aimLayer() {
  let svg = document.getElementById('aim-layer');
  if (!svg) {
    svg = document.createElementNS(_AIMNS, 'svg');
    svg.id = 'aim-layer';
    // will-change/translateZ promotes the beam SVG to its OWN compositor layer, so
    // per-frame beam repaints DON'T re-rasterize the filtered figures beneath — the
    // GPU just re-composites this layer over the cached scene.  This is the real
    // drag-lag fix (the beams overlay the drop-shadowed figures).
    svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:55;overflow:visible;will-change:transform;transform:translateZ(0)';
    $('#stage').appendChild(svg);
  }
  // The aim beam/reticle is drawn in DESIGN coords, so the viewBox must match the
  // current design canvas (760×430 on mobile, larger on desktop) — otherwise the
  // reticle points to the wrong place and targeting looks off.
  svg.setAttribute('viewBox', '0 0 ' + stageDW() + ' ' + stageDH());
  return svg;
}
// Cached aim-beam DOM.  PERF: the drag RAF loop redraws the beam ~60×/s.  Rewriting
// svg.innerHTML every frame (and recreating the SMIL <animate> rings each time) was
// the drag stutter — heaviest on a field/DUET beam that fans to every foe.  We now
// build the SVG structure ONCE per beam-shape and per frame only nudge geometry
// (path `d`, dash offset, reticle transform) via setAttribute.
let _aim = null;
function aimClear() {
  const s = document.getElementById('aim-layer'); if (s) s.innerHTML = '';
  _aim = null;
  document.querySelectorAll('.fig-valid, .fig-snapped').forEach(f => f.classList.remove('fig-valid', 'fig-snapped'));
}
// School-tinted aim colour — the beam carries the card's element (JRPG flair).
const SCHOOL_AIM = { blade: '#e05a5a', light: '#f0d488', song: '#c8a0e0', iron: '#a8c8e8', frost: '#8ecbe8' };
function aimColor(card) {
  const fx = card.fx || {};
  if (card.school) return SCHOOL_AIM[card.school] || '#f0d488';
  if (card.target === 'ally' || card.target === 'allies' || fx.heal || fx.guard || fx.notToday) return '#98d878';
  return '#f0d488';
}
function _cornerPath(cx, cy, r) {
  const L = 6;
  return [
    `M ${cx - r} ${cy - r + L} L ${cx - r} ${cy - r} L ${cx - r + L} ${cy - r}`,
    `M ${cx + r - L} ${cy - r} L ${cx + r} ${cy - r} L ${cx + r} ${cy - r + L}`,
    `M ${cx + r} ${cy + r - L} L ${cx + r} ${cy + r} L ${cx + r - L} ${cy + r}`,
    `M ${cx - r + L} ${cy + r} L ${cx - r} ${cy + r} L ${cx - r} ${cy + r - L}`,
  ].join(' ');
}
// A glowing energy ribbon (soft halo + bright core) ending in a rotating
// JRPG targeting reticle — distinct from Slay-the-Spire's flat arrow.
function drawAimJRPG(fx, fy, ex, ey, valid, field, angle, color, tech) {
  const svg = aimLayer();
  // The beam casts FROM THE CARD (its position, clamped to the stage as a
  // safety net).  The card is held in a lower-central zone by the drag clamp,
  // so the origin is always on-screen and reads as coming from the card you're
  // holding — not from a detached point.
  const cx = (v) => Math.max(6, Math.min(754, v)), cy = (v) => Math.max(6, Math.min(424, v));
  fx = cx(fx); fy = cy(fy); ex = cx(ex); ey = cy(ey);
  const c = valid ? color : '#7a7060';
  const R = 16;
  const shape = 'single|' + (valid ? 1 : 0) + (field ? 1 : 0) + (tech ? 1 : 0) + c;
  // Build the beam DOM once per shape; reuse across frames.
  if (!_aim || _aim.type !== 'single' || _aim.shape !== shape) {
    let ret = '';
    if (valid && !field) {
      // reticle centred at local 0,0; the parent <g> is TRANSLATED to (ex,ey)
      // each frame, the inner groups ROTATED — no full re-render.
      ret = `<g class="aimJ-ret">`
          + `<g class="aimJ-r1"><rect x="${-R}" y="${-R}" width="${2 * R}" height="${2 * R}" rx="2" fill="none" stroke="${c}" stroke-width="1.6" opacity="0.85"/></g>`
          + `<g class="aimJ-r2"><path d="${_cornerPath(0, 0, R + 5)}" fill="none" stroke="#fff6d8" stroke-width="2.4" stroke-linecap="round" style="filter:drop-shadow(0 0 4px ${c})"/></g>`
          + `<circle r="3" fill="#fff6d8" style="filter:drop-shadow(0 0 7px ${c})"/>`
          + (tech ? `<text class="aimJ-tech" x="${R + 8}" y="${-R + 2}" font-size="15" fill="#ffe14a" style="filter:drop-shadow(0 0 5px rgba(255,225,74,0.9))">⚡</text>` : '')
          + `</g>`;
    } else if (field) {
      ret = `<g class="aimJ-ret"><circle r="9" fill="none" stroke="${c}" stroke-width="2"><animate attributeName="r" values="7;12;7" dur="0.8s" repeatCount="indefinite"/></circle></g>`;
    }
    // The 3 beam paths update `d` every frame → NO filter on them (a per-frame blur
    // rasterization is the stutter).  A wide low-opacity underlay fakes the glow.
    svg.innerHTML =
        `<path class="aimJ-glow" fill="none" stroke="${c}" stroke-width="10" stroke-linecap="round" opacity="0.2"/>`
      + `<path class="aimJ-core" fill="none" stroke="${c}" stroke-width="4" stroke-linecap="round" opacity="0.55"/>`
      + `<path class="aimJ-dash" fill="none" stroke="#fff6d8" stroke-width="1.8" stroke-linecap="round" stroke-dasharray="2 7"/>`
      + ret;
    _aim = { type: 'single', shape,
      glow: svg.querySelector('.aimJ-glow'), core: svg.querySelector('.aimJ-core'), dash: svg.querySelector('.aimJ-dash'),
      ret: svg.querySelector('.aimJ-ret'), r1: svg.querySelector('.aimJ-r1'), r2: svg.querySelector('.aimJ-r2') };
  }
  const bow = Math.min(60, Math.max(22, Math.abs(ex - fx) * 0.11));
  const midX = (fx + ex) / 2, midY = Math.max(10, Math.min(fy, ey) - bow);
  const d = `M ${fx} ${fy} Q ${midX} ${midY} ${ex} ${ey}`;
  const dash = -angle;
  if (_aim.glow) _aim.glow.setAttribute('d', d);
  if (_aim.core) _aim.core.setAttribute('d', d);
  if (_aim.dash) { _aim.dash.setAttribute('d', d); _aim.dash.setAttribute('stroke-dashoffset', dash); }
  if (_aim.ret) _aim.ret.setAttribute('transform', `translate(${ex} ${ey})`);
  if (_aim.r1) _aim.r1.setAttribute('transform', `rotate(${angle})`);
  if (_aim.r2) _aim.r2.setAttribute('transform', `rotate(${-angle * 0.7})`);
}
// Field-card aim — a vow / bond touches MANY figures at once, so fan a thread
// out to each affected figure and ring it, rather than beaming into the void.
function drawAimField(fx, fy, pts, angle, color) {
  const svg = aimLayer();
  // origin from the card (clamped to the stage; the card is kept on-screen by
  // the drag clamp) so the fan reads as coming from the card, never off-screen
  fx = Math.max(6, Math.min(754, fx)); fy = Math.max(6, Math.min(424, fy));
  // Build the fan ONCE (endpoints + pulse rings are static during a drag); per
  // frame only the ORIGIN moves, so we just nudge each thread's `d` + dash.
  if (!_aim || _aim.type !== 'field' || _aim.count !== pts.length || _aim.color !== color) {
    let s = '';
    pts.forEach((p, i) => {
      // No filter:blur / drop-shadow on the animated THREADS (a per-frame filter
      // re-rasterization is death); a wide low-opacity underlay fakes the glow.
      // Pulse rings are SMIL, built ONCE, so they animate cheaply.
      s += `<path class="aF-core" data-i="${i}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" opacity="0.5"/>`
         + `<path class="aF-dash" data-i="${i}" fill="none" stroke="#fff6d8" stroke-width="1.4" stroke-linecap="round" stroke-dasharray="2 6"/>`
         + `<circle cx="${p.x}" cy="${p.y}" r="7" fill="none" stroke="${color}" stroke-width="1.8"><animate attributeName="r" values="6;10;6" dur="0.8s" repeatCount="indefinite"/></circle>`
         + `<circle cx="${p.x}" cy="${p.y}" r="2.4" fill="#fff6d8"/>`;
    });
    svg.innerHTML = s;
    _aim = { type: 'field', count: pts.length, color,
      core: [...svg.querySelectorAll('.aF-core')], dash: [...svg.querySelectorAll('.aF-dash')] };
  }
  const dash = -angle;
  pts.forEach((p, i) => {
    const bow = Math.min(64, Math.max(20, Math.abs(p.x - fx) * 0.12));
    const midX = (fx + p.x) / 2, midY = Math.max(12, Math.min(fy, p.y) - bow);
    const d = `M ${fx} ${fy} Q ${midX} ${midY} ${p.x} ${p.y}`;
    if (_aim.core[i]) _aim.core[i].setAttribute('d', d);
    if (_aim.dash[i]) { _aim.dash[i].setAttribute('d', d); _aim.dash[i].setAttribute('stroke-dashoffset', dash); }
  });
}

// Damped, finger-following card drag with a JRPG aim ribbon.  A RAF loop
// eases the card toward the pointer (weighted tilt from velocity) and eases
// the beam's endpoint toward the SNAPPED target — loose to aim, fluid to feel.
function attachDrag(el, card) {
  let pid = null, dragging = false, startX = 0, startY = 0;
  let ptrX = 0, ptrY = 0, originX = 0, originY = 0;
  let curTX = 0, curTY = 0, curEX = 0, curEY = 0, vel = 0, angle = 0, raf = 0;
  let snapped = null, _aimTech = false, holdT = null, inspecting = false;
  // PERF: the snapped/tech halos are gradient pseudo-elements over each figure.
  // Removing + re-adding those classes EVERY frame repainted every foe 60×/s (the
  // field-card stutter).  Track the current sets and only mutate on a real change;
  // a field card's targets never change mid-drag, so it settles to zero churn.
  let _snapEls = [], _techEl = null, _fieldPts = null, _lastFX = -1, _lastFY = -1;
  const setSnap = (nextEls) => {
    for (const e of _snapEls) if (nextEls.indexOf(e) < 0) e.classList.remove('fig-snapped');
    for (const e of nextEls) if (_snapEls.indexOf(e) < 0) e.classList.add('fig-snapped');
    _snapEls = nextEls;
    // THE OTHER HALF OF THE RACK (Build 289). Build 244 pulled focus onto the
    // acting HERO and deliberately left the enemy line alone, on the reasoning
    // that you are choosing out of that group so it should stay readable. That
    // holds while you are still choosing — but the moment the aim SNAPS to one
    // foe you have chosen, and the rest of the line is no longer a menu. The
    // enemy you are pointing at pulls focus the same way your own actor does.
    markEnemyFocus(nextEls.filter(e => e && e.dataset && e.dataset.fig));
  };
  const setTech = (nextEl) => {
    if (nextEl === _techEl) return;
    if (_techEl) _techEl.classList.remove('fig-tech-aim');
    if (nextEl) nextEl.classList.add('fig-tech-aim');
    _techEl = nextEl;
  };
  let canSac = false, canPlay = false, overEp = false, winUp = null;
  const sc = () => _sscale();
  // Is the pointer over the EP dial (the sacrifice drop-target)?  Generous pad.
  const epOrbHit = (x, y) => {
    const o = $('#ep-dial'); if (!o) return false;
    const r = o.getBoundingClientRect(); const pad = Math.max(r.width, 26) * 0.6;
    return x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;
  };
  const disarmEp = () => { const c = $('#ep-cluster'); if (c) c.classList.remove('ep-armed', 'ep-sac-hot'); };

  el.addEventListener('pointerdown', (e) => {
    if (S.executing || S.over || S._staging) return;
    if (pid !== null) return;   // a gesture is already in flight — don't let a second touch hijack it
    pid = e.pointerId; startX = e.clientX; startY = e.clientY; ptrX = e.clientX; ptrY = e.clientY; dragging = false; inspecting = false;
    try { el.setPointerCapture(pid); } catch (_) {}
    // SAFETY NET — if a re-render swaps this card out or capture is lost, the
    // card's own pointerup never fires and the aim beam/raf would stick.  A
    // window capture listener guarantees finish() ALWAYS runs on release.
    if (winUp) { window.removeEventListener('pointerup', winUp, true); window.removeEventListener('pointercancel', winUp, true); }
    if (_dragWinUp) { window.removeEventListener('pointerup', _dragWinUp, true); window.removeEventListener('pointercancel', _dragWinUp, true); }   // never let TWO drag listeners coexist
    winUp = (ev) => finish(ev);
    _dragWinUp = winUp;
    window.addEventListener('pointerup', winUp, true);
    window.addEventListener('pointercancel', winUp, true);
    // PRESS & HOLD to INSPECT — a big MtG-style enlarge of the card (works on
    // any card, even one you can't afford or have spent).  A drag or a quick
    // release cancels it.
    clearTimeout(holdT);
    holdT = setTimeout(() => {
      if (pid !== null && !dragging) {
        inspecting = true;
        // Close-from-anywhere safety net: if the ending pointerup never reaches
        // this card (capture lost, a re-render swapped the element, a stray
        // second touch), the inspect + gesture would otherwise stick open.  The
        // window listener guarantees release ALWAYS clears both.
        showCardInspect(card, el, () => {
          inspecting = false;
          const held = pid; pid = null;
          if (held !== null) { try { el.releasePointerCapture(held); } catch (_) {} }
          cancelAnimationFrame(raf);
        });
      }
    }, 340);
    e.preventDefault();
  });
  el.addEventListener('pointermove', (e) => {
    if (pid === null || e.pointerId !== pid) return;
    ptrX = e.clientX; ptrY = e.clientY;
    if (!dragging && !inspecting) {
      if (Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY) < 12) return;
      clearTimeout(holdT);
      // You can drag a card to PLAY it (affordable) or to SACRIFICE it onto the
      // EP dial for +1 EP (once per turn).  Only deny if it can do neither.
      canPlay = !card.spent && card.cost <= S.ep;
      canSac  = !card.spent && !S.channelUsed && card.kind !== 'resonant' && card.kind !== 'move';
      if (!canPlay && !canSac) { if (card.cost > S.ep) denyCard(el, card); pid = null; try { el.releasePointerCapture(e.pointerId); } catch (_) {} return; }
      dragging = true;
      _snapEls = []; _techEl = null; _fieldPts = null; _lastFX = -1; _lastFY = -1;   // fresh snap/tech/field caches per drag
      el.classList.add('card-dragging');
      autoTuneFx();            // a drag lights the aim layer, the brackets, the reticle AND the rack at once
      pullFocus(card.owner);   // the card is off the table — rack onto whoever throws it
      el.style.transition = 'none';
      if (canSac) { const cl = $('#ep-cluster'); if (cl) cl.classList.add('ep-armed'); }   // invite the sacrifice
      const r = el.getBoundingClientRect();
      originX = r.left + r.width / 2; originY = r.top + r.height / 2;
      const sr = $('#stage').getBoundingClientRect();
      curTX = 0; curTY = 0; curEX = (ptrX - sr.left) / sc(); curEY = (ptrY - sr.top) / sc();
      const dt = dragTargets(card);
      const lit = dt.mode === 'field' ? fieldTargets(card) : dt.els;
      lit.forEach(t => t.classList.add('fig-valid'));
      if (dt.mode === 'field') {
        const hint = $('#target-hint');
        hint.textContent = card.kind === 'resonant' ? 'RELEASE TO UNLEASH THE VOW' : 'RELEASE TO SEAL THE BOND';
        hint.classList.remove('hidden');
      }
      loop();
    }
  });
  function loop() {
    if (!dragging) { raf = null; return; }   // STOP the loop when the drag ends — don't keep the main thread hot forever
    raf = requestAnimationFrame(loop);
    const sr = $('#stage').getBoundingClientRect(), s = sc();
    // ease the card toward the finger
    const tgtTX = (ptrX - originX) / s, tgtTY = (ptrY - originY) / s;
    const nx = curTX + (tgtTX - curTX) * 0.26, ny = curTY + (tgtTY - curTY) * 0.26;
    vel = vel * 0.72 + (nx - curTX) * 0.28;
    curTX = nx; curTY = ny;
    // Keep the CARD parked in a comfortable LOWER-CENTRAL zone as it lifts — it
    // leans a little toward the finger but never flies to a corner or off the
    // page.  Only the beam + reticle follow the finger to aim, so targeting is
    // unaffected however far you drag.  (A previous clamp was far too loose —
    // 12% from the edge / 34% from the top — so flicking up-left parked the card
    // in the corner and the beam appeared to shoot in from off-screen.)
    const W = sr.width, H = sr.height;
    const vw = (typeof window !== 'undefined' && window.innerWidth) || sr.right;
    const vh = (typeof window !== 'undefined' && window.innerHeight) || sr.bottom;
    const cx = (sr.left + sr.right) / 2;
    let scx = originX + curTX * s, scy = originY + curTY * s;
    scx = Math.max(cx - W * 0.22, Math.min(cx + W * 0.22, scx));            // stay within a central band
    scy = Math.max(sr.top + H * 0.40, Math.min(sr.bottom - H * 0.03, scy)); // lifts well up, still on-screen
    curTX = (scx - originX) / s; curTY = (scy - originY) / s;
    const tilt = Math.max(-15, Math.min(15, vel * 1.5));
    el.style.transform = `translate(${curTX}px, ${curTY}px) rotate(${tilt}deg) scale(1.07)`;
    // GUARANTEE the whole card stays on screen: measure the actual rendered box
    // (transform-origin + tilt + the 1.07 lift make a predictive clamp unreliable)
    // and push it back inside min(stage, viewport) with a small pad.  This is
    // what finally kills the off-screen-drag glitch.
    {
      const b = el.getBoundingClientRect();
      const padL = Math.max(sr.left, 0) + 4, padR = Math.min(sr.right, vw) - 4;
      const padT = sr.top + 4, padB = Math.min(sr.bottom, vh) - 4;
      let cx = 0, cy = 0;
      if (b.left < padL) cx = padL - b.left; else if (b.right > padR) cx = padR - b.right;
      if (b.top < padT) cy = padT - b.top;  else if (b.bottom > padB) cy = padB - b.bottom;
      if (cx || cy) {
        curTX += cx / s; curTY += cy / s;
        el.style.transform = `translate(${curTX}px, ${curTY}px) rotate(${tilt}deg) scale(1.07)`;
      }
    }
    // snapped target
    const { mode, els } = dragTargets(card);
    // SACRIFICE zone — over the EP dial: light it, drop the aim beam, prompt.
    overEp = canSac && epOrbHit(ptrX, ptrY);
    { const cl = $('#ep-cluster'); if (cl) cl.classList.toggle('ep-sac-hot', overEp); }
    if (overEp) {
      snapped = null; aimClear();
      const hint = $('#target-hint'); hint.textContent = 'SACRIFICE · feed the card for +1 EP'; hint.classList.remove('hidden');
      return;
    }
    if (mode !== 'field' && !targeting) { const h = $('#target-hint'); if ((h.textContent || '').indexOf('SACRIFICE') === 0) h.classList.add('hidden'); }
    let ex, ey, valid, field = false;
    const cr = el.getBoundingClientRect();
    const fromX = (cr.left + cr.width / 2 - sr.left) / s, fromY = (cr.top - sr.top) / s + 2;
    if (mode === 'field') {
      // A field card touches many figures — thread the beam to each and ring them.
      // The targets + their positions are STATIC during a drag, so ring them ONCE
      // and cache the endpoints; per frame only the beam ORIGIN moves.
      snapped = '__field__';
      if (!_fieldPts) {
        const tgs = fieldTargets(card);
        setSnap(tgs.slice());
        _fieldPts = tgs.map(t => { const r = figHitRect(t); return { x: (r.left + r.width / 2 - sr.left) / s, y: (r.top + r.height * 0.4 - sr.top) / s }; });
      }
      angle = (angle + 3) % 360;
      drawAimField(fromX, fromY, _fieldPts, angle, aimColor(card));
      return;
    } else {
      // AIM to the figure's ON-SCREEN BOX, not the inner portrait SVG.  A foe's
      // art svg has transparent padding that can sit off-centre from the visible
      // body (worst on the slim enemy figures), which used to pull the reticle
      // toward mid-field even when the foe stood on the right.  The .figure box is
      // centred on the enemy's actual slot, so the beam lands ON the foe.
      const aimBox = (t) => (t && t.getBoundingClientRect) ? t.getBoundingClientRect() : figHitRect(t);
      let best = null, bd = Infinity;
      els.forEach(t => { const r = aimBox(t); const d = (r.left + r.width / 2 - ptrX) ** 2 + (r.top + r.height / 2 - ptrY) ** 2; if (d < bd) { bd = d; best = t; } });
      snapped = best; setSnap(best ? [best] : []);   // only mutates when the nearest target changes
      valid = !!best;
      if (best) { const r = aimBox(best); ex = (r.left + r.width / 2 - sr.left) / s; ey = (r.top + r.height * 0.42 - sr.top) / s; }
      else { ex = (ptrX - sr.left) / s; ey = (ptrY - sr.top) / s; }
      // TECHNICAL preview — aiming a damaging card at a PRIMED foe (chilled or
      // weakened, off its weakness line) will detonate.  Rather than a flashing
      // banner, the RETICLE itself goes electric-yellow with a ⚡ — a quiet,
      // in-place cue on the very thing you're aiming at.
      let techEl = null;
      if (best && best.dataset.fig && card.fx && (card.fx.dmg || card.fx.hitFrontmost)) {
        const te = S.enemies.find(x => x.uid === best.dataset.fig);
        if (te && (te.lull || te.weakened) && !(card.school && card.school === te.def.weak)) techEl = best;
      }
      setTech(techEl); _aimTech = !!techEl;
    }
    // Snappier lock when a valid foe is snapped (so the reticle sits ON the target
    // fast, not drifting through mid-field); looser when free-aiming empty space.
    const ease = valid ? 0.5 : 0.34;
    curEX += (ex - curEX) * ease; curEY += (ey - curEY) * ease;
    angle = (angle + 3) % 360;
    drawAimJRPG(fromX, fromY, curEX, curEY, valid, field, angle, _aimTech ? '#ffe14a' : aimColor(card), _aimTech);
  }
  const finish = (e) => {
    if (pid === null || (e && e.pointerId !== pid)) return;   // ignore stray / second-pointer releases
    if (winUp) { window.removeEventListener('pointerup', winUp, true); window.removeEventListener('pointercancel', winUp, true); if (_dragWinUp === winUp) _dragWinUp = null; winUp = null; }
    clearTimeout(holdT);
    try { el.releasePointerCapture(pid); } catch (_) {}
    pid = null; cancelAnimationFrame(raf);
    if (inspecting) { inspecting = false; hideCardInspect(); return; }   // release from inspect — don't play
    if (!dragging) { onCardTap(card); return; }
    dragging = false;
    el.classList.remove('card-dragging');
    aimClear();
    disarmEp();
    document.querySelectorAll('.fig-tech-aim').forEach(f => f.classList.remove('fig-tech-aim'));
    // A release that hands off to a target PICK keeps the rack — the choice is
    // still open, so the actor stays the subject.  Anything else settles back to
    // the rest state, where every hero reads crisp.
    if (!targeting) { $('#target-hint').classList.add('hidden'); $('#target-hint').classList.remove('th-tech'); releaseFocus(); }
    // SACRIFICE — released over the EP dial → feed the card for +1 EP.
    if (canSac && epOrbHit(e.clientX, e.clientY)) { channelCard(card); return; }
    const handTop = $('#hand').getBoundingClientRect().top;
    const cancelled = e.clientY > handTop - 8;
    const { mode } = dragTargets(card);
    // hand the forge animation the card's HOME slot (its resting centre from drag
    // start) so the bounce lands back in the slot, not the lifted position
    if (card.chain) _forgeDrag = { name: card.name, owner: card.owner, homeX: originX, homeY: originY };
    // A card you can't AFFORD is draggable only because it can still be SACRIFICED
    // (dropped on the EP dial, handled above).  Dropping it on a TARGET must NOT
    // play it — guard both play paths, or an unaffordable card sneaks through.
    if (!cancelled && !canPlay && (mode === 'field' || (snapped && snapped.dataset))) {
      flashNarrator('Not enough EP.'); denyCard(el, card); _forgeDrag = null; springBack(el); return;
    }
    if (!cancelled && mode === 'field') {
      if (card.kind === 'resonant' && !card.pair && S.ep < S.maxEp) { flashNarrator('The Vow needs your ENTIRE turn — play it first.'); springBack(el); return; }
      playCard(card, null); return;
    }
    if (!cancelled && snapped && snapped.dataset) { playCard(card, snapped.dataset.fig); return; }
    _forgeDrag = null;   // released in the hand / on nothing — no play, clear it
    springBack(el);   // released in the hand or on nothing — ease home
  };
  el.addEventListener('pointerup', finish);
  el.addEventListener('pointercancel', finish);
}
// PRESS & HOLD INSPECT — a big, readable enlarge of the card (Magic-style), a
// clone of the real card so it's pixel-faithful, over a dimmed/blurred field.
function showCardInspect(card, el, onClose) {
  hideCardInspect();
  const wrap = document.createElement('div');
  wrap.id = 'card-inspect';
  const clone = el.cloneNode(true);
  clone.className = 'card kind-' + card.kind + ' ci-card';
  clone.removeAttribute('style');
  clone.style.setProperty('--tint', card.tint || 'var(--gold)');
  const ch = clone.querySelector('.card-channel'); if (ch) ch.remove();
  const scrim = document.createElement('div'); scrim.className = 'ci-scrim';
  const hint = document.createElement('div'); hint.className = 'ci-hint'; hint.textContent = 'release to close';
  wrap.appendChild(scrim); wrap.appendChild(clone); wrap.appendChild(hint);
  $('#stage').appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add('ci-on'));
  try { haptic(HAP.press); } catch (_) {}
  // Release ANYWHERE closes the inspect and runs the gesture cleanup — a window
  // capture listener fires before (and independently of) the card's own pointerup,
  // so a lost capture or swapped element can never leave the overlay stuck open.
  const close = () => {
    window.removeEventListener('pointerup', close, true);
    window.removeEventListener('pointercancel', close, true);
    hideCardInspect();
    if (onClose) onClose();
  };
  window.addEventListener('pointerup', close, true);
  window.addEventListener('pointercancel', close, true);
}
function hideCardInspect() { const el = document.getElementById('card-inspect'); if (el) el.remove(); }
// Denial feedback for an unaffordable card — a short shake + a reason.
function denyCard(el, card) {
  el.classList.remove('card-deny'); void el.offsetWidth; el.classList.add('card-deny');
  setTimeout(() => el.classList.remove('card-deny'), 400);
  const need = card.cost - S.ep;
  flashNarrator(`Not enough EP — ${card.name} needs ${card.cost} (${need} more).`);
  try { SFX.deny && SFX.deny(); } catch (_) {}
}
// Spring the card back to its fan position, then re-render.
function springBack(el) {
  el.style.transition = 'transform 0.26s cubic-bezier(0.34, 1.5, 0.5, 1)';
  el.style.transform = '';
  setTimeout(() => renderAll(), 240);
}

// Drag a HERO to reposition them (1 EP, once per hero per turn).  A short
// tap instead opens the tap-to-move row picker — unless a card is currently
// targeting, in which case the tap is the target pick.
function attachHeroDrag(fig, hero) {
  let startX = 0, startY = 0, dragging = false, pid = null;
  const scale = () => stageScale();
  const highlight = (on) => {
    document.querySelectorAll('#party-half .slot').forEach(sl => {
      sl.classList.toggle('slot-droppable', on && sl.dataset.row !== hero.row);
    });
    const hint = $('#target-hint');
    if (on) { hint.textContent = 'Move ' + hero.def.name + ' — drop on a row'; hint.classList.remove('hidden'); }
    else if (!targeting) hint.classList.add('hidden');
  };
  fig.addEventListener('pointerdown', (e) => {
    if (targeting) return;                    // a card is picking targets — let the tap through
    pid = e.pointerId;
    startX = e.clientX; startY = e.clientY; dragging = false;
    try { fig.setPointerCapture(pid); } catch (_) {}
  });
  fig.addEventListener('pointermove', (e) => {
    if (pid === null) return;
    const dx = e.clientX - startX, dy = e.clientY - startY;
    if (!dragging) {
      if (Math.abs(dx) + Math.abs(dy) < 14) return;
      if (!canMove(hero)) { pid = null; flashNarrator(S.used.has(hero.id + ':move') ? hero.def.name + ' has already moved this turn.' : 'Not enough EP to move.'); return; }
      dragging = true;
      fig.classList.add('fig-dragging');
      fig.style.transition = 'none';
      highlight(true);
    }
    fig.style.transform = `translate(${dx / scale()}px, ${dy / scale()}px)`;
  });
  const finish = (e) => {
    if (pid === null) return;
    try { fig.releasePointerCapture(pid); } catch (_) {}
    pid = null;
    if (!dragging) {
      // tap: target pick beats move; otherwise open the row picker
      if (targeting) { onFigureTap(hero.id); return; }
      if (!canMove(hero)) return;
      enterTargeting(mkMoveAction(hero), ROWS.filter(r => r !== hero.row).map(r => 'row:' + r), 'Move ' + hero.def.name);
      return;
    }
    dragging = false;
    fig.classList.remove('fig-dragging');
    fig.style.transition = '';
    fig.style.transform = '';
    highlight(false);
    fig.style.pointerEvents = 'none';
    const under = document.elementFromPoint(e.clientX, e.clientY);
    fig.style.pointerEvents = '';
    const slot = under && under.closest ? under.closest('#party-half .slot[data-row]') : null;
    if (slot && slot.dataset.row !== hero.row && canMove(hero)) {
      playCard(Object.assign({}, mkMoveAction(hero), { toRow: slot.dataset.row }), null);
      return;
    }
    renderAll();
  };
  fig.addEventListener('pointerup', finish);
  fig.addEventListener('pointercancel', finish);
}

// Visual: the played card lifts out of the fan and flies toward its target
// (or the field's center), shrinking and fading as the effect lands.
function flyCard(cardName, targetEl) {
  const el = document.querySelector(`#hand .card[data-card-name="${CSS.escape(cardName)}"]`);
  if (!el) return;
  const stage = $('#stage');
  const sr = stage.getBoundingClientRect();
  const scale = sr.width / stageDW() || 1;
  const r = el.getBoundingClientRect();
  const ghost = el.cloneNode(true);
  ghost.className = el.className + ' card-ghost';
  ghost.style.cssText = `position:absolute; margin:0; z-index:120; pointer-events:none;
    left:${(r.left - sr.left) / scale}px; top:${(r.top - sr.top) / scale}px;
    width:${r.width / scale}px; height:${r.height / scale}px; transform:none;`;
  $('#popup-layer').appendChild(ghost);
  const tr = (targetEl || $('#battlefield')).getBoundingClientRect();
  const dx = (tr.left + tr.width / 2 - (r.left + r.width / 2)) / scale;
  const dy = (tr.top + tr.height / 2 - (r.top + r.height / 2)) / scale;
  // WEIGHT — a quick wind-up POP, then the card is HURLED at the target and
  // shrinks into the blow, so a play lands with intent instead of drifting off.
  requestAnimationFrame(() => {
    ghost.style.transition = 'transform 0.1s ease-out';
    ghost.style.transform = 'scale(1.13) rotate(-2deg)';
    setTimeout(() => {
      ghost.style.transition = 'transform 0.4s cubic-bezier(0.4, 1.3, 0.5, 1), opacity 0.4s ease';
      ghost.style.transform = `translate(${dx}px, ${dy}px) scale(0.24) rotate(5deg)`;
      ghost.style.opacity = '0';
    }, 100);
  });
  setTimeout(() => ghost.remove(), 560);
}

// Visual: a DISCARDED card burns away where it sat — desaturating to ash,
// crumpling and drifting down with a warm ember glow — so channeling reads as
// "this card is gone, spent for fuel," not a card that silently vanished.
function dissolveCard(cardName) {
  dissolveCardEl(document.querySelector(`#hand .card[data-card-name="${CSS.escape(cardName)}"]`));
}
// burn a SPECIFIC card element away (used for the unpicked rotation branch — the
// path you didn't take crumbles to ash).
function dissolveCardEl(el) {
  if (!el) return;
  const sr = $('#stage').getBoundingClientRect();
  const scale = sr.width / stageDW() || 1;
  const r = el.getBoundingClientRect();
  const ghost = el.cloneNode(true);
  const ch = ghost.querySelector('.card-channel'); if (ch) ch.remove();
  ghost.className = el.className.replace('card-dragging', '') + ' card-dissolve';
  ghost.style.cssText = `position:absolute; margin:0; z-index:118; pointer-events:none;
    left:${(r.left - sr.left) / scale}px; top:${(r.top - sr.top) / scale}px;
    width:${r.width / scale}px; height:${r.height / scale}px; transform:none;`;
  const layer = $('#popup-layer');
  layer.appendChild(ghost);
  // A little rising ash so the eye follows the card out of play.
  for (let i = 0; i < 5; i++) {
    const em = document.createElement('span');
    em.className = 'discard-ash';
    em.style.left = ((r.left - sr.left) / scale + 20 + Math.random() * (r.width / scale - 40)) + 'px';
    em.style.top = ((r.top - sr.top) / scale + 40 + Math.random() * 60) + 'px';
    em.style.animationDelay = (i * 60) + 'ms';
    layer.appendChild(em);
    setTimeout(() => em.remove(), 900);
  }
  setTimeout(() => ghost.remove(), 640);
}

// CHANNEL — DISCARD any card for +1 EP (once per turn): the pressure valve
// that means no card is ever truly dead.  A heal at full HP, a finisher with
// nothing to finish — feed it to the fire and buy a better play.
function channelCard(card) {
  if (S.executing || S.over || S._staging || S.channelUsed || card.spent) return;
  if (card.kind === 'resonant') { flashNarrator('The vow cannot be spent for scraps.'); return; }
  S.channelUsed = true;
  dissolveCard(card.name);            // burn the discarded card away, visibly
  if (card.temp) S.tempCards = S.tempCards.filter(t => t.uid !== card.uid);
  else if (card.owner !== 'triad') S.used.add(card.owner + ':' + card.kind);
  S.ep = Math.min(S.maxEp + 2, S.ep + 1);
  pulseEp();
  SFX.move();
  flashNarrator(card.ownerName + ' DISCARDS ' + card.name + ' to the fire — +1 EP.');
  popupAt($('#ep-dial'), '+1 EP', 'rally');
  renderAll();
}

async function playCard(card, targetId) {
  if (S.executing || S.over || S._staging) return;
  if (card.spent || card.cost > S.ep) { flashNarrator('Not enough EP.'); return; }   // safety net: never play an unaffordable/spent card
  haptic(HAP.play);
  // A rotation card grows into its next step: remember WHERE it sat in the hand
  // and WHAT it struck, so the forged card(s) can fly back to that slot and split
  // out of it — the card that left the hand becomes the next stage.
  if (card.chain) captureForgeAnchors(card, targetId);
  // Picking a branch: the unpicked path BURNS AWAY the moment this card drops and
  // flies at the foe — the two actions happen together, not one after the other.
  if (card.branchGroup != null) burnUnpickedSiblings(card);
  S.executing = true;
  $('#stage').classList.add('executing');
  S.ep -= card.cost;
  if (card.cost > 0) spendEpFx(card.cost);   // animate the cost leaving the EP dial
  if (card.temp) S.tempCards = S.tempCards.filter(t => t.uid !== card.uid);
  else if (card.owner !== 'triad') S.used.add(card.owner + ':' + card.kind);
  if (card.kind !== 'move') {
    SFX.card();
    // THE ACTION SHOT — one glide that frames the ACTOR with their TARGET,
    // held through everything this card resolves, released at the end of
    // playCard. This replaced a lean-punch-settle sawtooth per card.
    if (card.owner && card.owner !== 'triad' && !_camHeld) {
      const actorEl = figEl(card.owner);
      const tgtEl = targetId ? figEl(targetId)
        : (card.target === 'frontmost' && frontmostEnemy() ? figEl(frontmostEnemy().uid) : null);
      const offensive = !!(card.fx && card.fx.dmg);
      camShot([actorEl, tgtEl].filter(Boolean),
        offensive ? { z: 1.085, pull: 0.42, pitch: 1.0, r: 0.35 }
                  : { z: 1.05, pull: 0.34, pitch: 0.7, r: -0.25, ms: 340 });
      // the lens and the focus agree: this shot is about these two
      focusPair(card.owner, tgtEl && tgtEl.dataset ? tgtEl.dataset.fig : null);
    }
    // The card HURLS into the target (the strike).  A forging rotation card then
    // BOUNCES back to its slot and splits — see forgeReturnFx, which waits for the
    // hurl to land before the bounce.
    flyCard(card.name, targetId ? figEl(targetId) : (card.target === 'frontmost' && frontmostEnemy() ? figEl(frontmostEnemy().uid) : null));
  } else { SFX.move(); }
  pulseEp();
  renderAll();
  await resolveCard(card, targetId);
  // the action is resolved — EVERYONE returns to focus before the next beat
  releaseFocus();
  // BOND CHAIN — ANY finisher/signature (attack, heal OR guard) offers its owner's
  // woven partner a free Chain, so every hero chains, not just the attackers.  The
  // Chain card itself never re-triggers.
  if (card.owner && !(card.fx && card.fx.bondFollow) && (/FINISHER/.test(card.stance || '') || card.kind === 'sig')) {
    const o = S.heroes.find(h => h.id === card.owner);
    if (o && !o.downed) offerBondFollow(o.id);
  }
  if (card.kind !== 'move') camShotEnd();   // the action ended — one glide home
  resolveChainPlay(card);                    // forge the rotation's next step(s); purge unpicked siblings
  // THE COMBO ENDED — a chain card with nothing left to forge is the only
  // structural definition of "the line is complete" the engine has (it's the
  // same condition resolveChainPlay early-returns on).  That PRIMES the hero.
  if (card.chain && !(card.chainNext && card.chainNext.length)) grantPrime(card);
  if (card.kind !== 'move') hexBurn(card);   // a hexed hero's card play eats another card
  // THE LINE'S LAST FRAME (v2.2 Build 3). The party holds their forward poses
  // through the whole combo, and the FINISHER resolving is what releases them:
  // the tableau is SEEN for a beat, then everyone springs home together. END
  // TURN stays as the fallback release for a line that never closed.
  if (card.chain && !(card.chainNext && card.chainNext.length) && S.heroes.some(h => h._held)) {
    await sleep(520);
    releaseHeldPoses();
    await sleep(320);
  }
  S.executing = false;
  $('#stage').classList.remove('executing');
  renderAll();
  checkEnd();
}
// HEX (the Maw's curse) — when a hexed hero plays a card, a RANDOM other card in
// the hand burns away.  Balatro-flavoured: your options are eaten as you act.
function hexBurn(playedCard) {
  const owner = playedCard && S.heroes.find(h => h.id === playedCard.owner);
  if (!owner || !(owner.hexed > 0)) return;
  const pool = buildHand().filter(c => c.kind !== 'move' && c.kind !== 'resonant' && !c.spent
    && !(c.owner === playedCard.owner && c.kind === playedCard.kind && !c.temp)   // not the just-played core/sig
    && !(c.temp && c.uid === playedCard.uid));                                     // not the just-played temp
  if (!pool.length) return;
  const victim = pool[Math.floor(Math.random() * pool.length)];
  if (victim.temp) S.tempCards = S.tempCards.filter(t => t.uid !== victim.uid);
  else if (victim.owner !== 'triad') S.used.add(victim.owner + ':' + victim.kind);
  dissolveCard(victim.name);
  popupAt(figEl(owner.id), '☠ HEX burns ' + victim.name, 'dmg');
  if (SFX.deny) SFX.deny();
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ─────────────────────────────────────────────────────────────────────────────
// TEMPO — novelty decay (Build 243)
//
// The pacing audit found the fight is 72–82% non-interactive wall-clock, and
// that almost none of it is the DRAMA — it is the drama REPEATED.  A wind-up
// pose you have never seen is a telegraph; the ninth identical one is a toll
// booth.  So every cinematic hold now asks how many times THIS beat has already
// landed in THIS fight: the first is played in full, the repeats are tightened.
// Nothing is deleted — the two-shot compose, the burning cut-in band, the
// riposte dilation all still fire, they just stop charging full price for a
// moment the player has already read.
function beatCount(key) {
  if (!S) return 0;
  if (!S._beats) S._beats = {};
  const n = S._beats[key] || 0;
  S._beats[key] = n + 1;
  return n;                       // 0 the first time this fight
}
// full hold on first sighting, `repeat` every time after.
function tempo(key, full, repeat) { return beatCount(key) === 0 ? full : repeat; }

// SKIPPABLE HOLD — the same window, except a tap anywhere ends it early.
// The parry notes already prove this plumbing (window-level capture listeners),
// and `bossCine` already lets you tap past a cinematic; cut-ins were the one
// beat that fired ten times a fight with no way out.  A short grace window
// keeps the pointerdown that STARTED the beat from instantly dismissing it.
function holdOrTap(ms, grace) {
  return new Promise(res => {
    let done = false, armed = false;
    const fin = () => {
      if (done) return; done = true;
      clearTimeout(tm); clearTimeout(arm);
      window.removeEventListener('pointerdown', tap, true);
      res();
    };
    const tap = () => { if (armed) fin(); };
    const arm = setTimeout(() => { armed = true; }, grace == null ? 200 : grace);
    const tm = setTimeout(fin, ms);
    window.addEventListener('pointerdown', tap, true);
  });
}

// AFTERIMAGE — the stance a hero LEAVES strikes once more as a free fading echo
// (−2 dmg, this turn only).  Fires on ANY reposition, not just a dedicated MOVE:
// a card that slips/vanishes the caster (fx.step / fx.warp, e.g. Mira's Backstab
// or Vanish Strike) leaves an echo too, so a movement-heavy kit + this node is a
// real emergent engine.  Gated on the earned per-hero afterimage node.
function leaveAfterimage(owner, fromRow) {
  if (!owner || owner.downed || !hasNode(owner.id + '.afterimage')) return;
  const oldCore = owner.def.cards[fromRow] && owner.def.cards[fromRow].core;
  if (!oldCore || !oldCore.fx || !oldCore.fx.dmg) return;
  const dmg = Math.max(2, oldCore.fx.dmg - 2);
  // The echo carries a sliver of WHO left it — so which hero's afterimage you buy
  // expresses their identity, not just a copy-pasted re-hit.
  const extra = {}; let tag = '';
  if (owner.id === 'mira' || owner.id === 'branwen') { extra.mark = 1; tag = ' · <span class="kw kw-exposed">◎1</span>'; }   // the marksman/assassin's echo re-marks
  else if (owner.id === 'hask') { extra.lull = 1; tag = ' · <span class="kw kw-chill">❄1</span>'; }                         // the frost echo chills (feeds SHATTER)
  else if (owner.id === 'cassia') { extra.guard = 2; tag = ' · <span class="kw kw-guard">⛨2</span>'; }                     // the wall's echo braces
  genTempCard({ kind: 'temp', owner: owner.id, ownerName: owner.def.name, tint: owner.def.tint,
    stance: 'AFTERIMAGE', name: 'Echo: ' + oldCore.name, cost: 0, target: oldCore.target,
    school: owner.def.school, fx: Object.assign({ dmg }, extra), expiresTurn: S.turn,
    desc: `<b>${dmg} damage</b>${tag} · fading echo, this turn only.` });
}

async function resolveCard(card, targetId) {
  const owner = S.heroes.find(h => h.id === card.owner);
  if (owner && owner.downed) return;
  // A FINISHER chips POISE (Build 252) — see dealToEnemy. Flagged here because
  // the damage is dealt several layers down and the card's shape is only known
  // at this level.
  S._finisher = !!(card.chain && !card.chainNext);
  S._finisherName = card.chain ? card.name : null;   // what the Echo remembers by

  if (card.kind === 'move') {
    const from = owner.row;
    const occupant = livingHeroes().find(h => h.id !== owner.id && h.row === card.toRow);
    owner.row = card.toRow;
    if (occupant) occupant.row = from;
    // a stance change abandons any in-progress rotation for the heroes who moved
    purgeChain(owner.id);
    if (occupant) purgeChain(occupant.id);
    onHeroEnterRow(owner, card.toRow, from);
    // The departed stance can leave a fading echo of its core (THIS TURN only) —
    // an EARNED per-hero skill (the AFTERIMAGE node), kept OUT of onboarding.
    // With no node, moving is simply a clean reposition / dodge.
    leaveAfterimage(owner, from);
    S._morphHeroId = owner.id;
    if (occupant) S._morphHeroId2 = occupant.id;
    owner._held = false;                     // repositioning breaks the held pose
    endCastAnim(owner);
    if (occupant) { occupant._held = false; endCastAnim(occupant); }
    renderAll();
    popupAt(figEl(owner.id), STANCE[card.toRow].name.toUpperCase(), 'info');
    if (occupant) popupAt(figEl(occupant.id), 'SWAP', 'info');
    await sleep(340);
    return;
  }

  // THE BEAT HOLDS (v2.2 Build 2). A hero who acts advances into the strike
  // and STAYS there — sword down, pose held — until the next card lands its
  // beat or END TURN sends everyone back to idle. The line reads as a combo
  // being built move by move instead of three people flickering in place:
  // strike → hold → next hero strikes → hold → finisher → END TURN releases.
  // A card with a CAST SHEET (Build 7) plays its real frames instead of the
  // dash and holds its own end frame the same way.
  if (owner && !owner.downed) { owner._held = true; beginCastAnim(owner, card); }

  const fx = card.fx || {};
  // CAST-TIME (Hask) — a big spell doesn't hit now; it BEGINS a cast that lands at
  // the START of your next turn.  It telegraphs on the caster, and MOVING before it
  // resolves interrupts it (a rooted big cast).  Cataclysm makes the payoff AoE.
  if (fx.castDmg && owner && !owner.downed) {
    const all = !!(fx.castAll || hasNode('hask.cast.meteor'));
    owner.pendingCast = { dmg: fx.castDmg, all, targetId: targetId || (frontmostEnemy() && frontmostEnemy().uid), name: card.name };
    popupAt(figEl(owner.id), '◈ CASTING', 'info');
    flashNarrator('<b>' + owner.def.name + '</b> begins casting <b>' + card.name + '</b>…');
    renderAll();
    await sleep(260);
    return;
  }
  if (fx.bondFollow) { await resolveBondFollow(fx.bondFollow); return; }
  if (fx.followUp) { await resolveFollowUp(fx.followUp); return; }
  if (fx.notToday) {
    const [prId, wdId] = fx.notToday;
    const pr = S.heroes.find(x => x.id === prId);
    const wd = S.heroes.find(x => x.id === wdId);
    if (!pr || pr.downed || !wd || wd.downed) { flashNarrator('The moment has passed.'); return; }
    // Bodies move: the protector steps into the fire.
    const prRow = pr.row;
    pr.row = wd.row;
    wd.row = prRow;
    S._morphHeroId = prId;
    S._morphHeroId2 = wdId;
    wd.hp = Math.min(healCap(wd), wd.hp + 4);
    pr.guard += 4;
    pr.counter = Math.max(pr.counter, 2);
    pr.chill = (pr.chill || 0) + 2;   // the cost: the next strike comes slower
    renderAll();
    popupAt(figEl(prId), 'NOT TODAY', 'info');
    popupAt(figEl(wdId), '+4', 'heal');
    popupAt(figEl(prId), '❄ OVEREXTENDED −2', 'chill');
    SFX.guard();
    await addThread(prId, wdId, 'they took the blow');   // protecting is a bond act
    await sleep(400);
    return;
  }
  if (fx.dmg || fx.guardBurst) {
    let tgt = null;
    if (card.target === 'frontmost') tgt = frontmostEnemy();
    else if (card.target === 'enemy') tgt = livingEnemies().find(e => e.uid === targetId) || frontmostEnemy();
    if (tgt) {
      let amt = (fx.dmg || 0) + (owner ? owner.buffDmg : 0);
  // DESPERATION (Build 234, the Clair Obscur comeback): a hero at a quarter
  // health strikes +2 harder. The execute-threshold grammar existed only in
  // the player's favour; this is danger paying the PLAYER something too.
  if (owner && owner.hp > 0 && owner.hp * 4 <= owner.maxHp && (fx.dmg || 0) > 0) {
    amt += 2;
    popupAt(figEl(owner.id), '🔥 DESPERATE +2', 'rally');
  }
      // AEGIS NOVA (Cassia) — release the accumulated wall as ONE blow: add all her
      // current guard to the strike, then spend it.  Turtle up, then unleash.
      if (fx.guardBurst && owner) { const g = owner.guard || 0; amt += g; if (g) { owner.guard = 0; popupAt(figEl(owner.id), '⛨→⚔ ' + g, 'dmg'); } }
      // OVERLOAD (Hask) — a nuke SPENDS all CHARGE, adding damage per stack; the
      // Meltdown capstone raises that, and Elemental Surge refunds EP on the dump.
      if (fx.spendCharge && owner && owner.id === 'hask') { const ch = owner.charge || 0; if (ch) { const d = chargeDmg(); amt += ch * d; owner.charge = 0; popupAt(figEl(owner.id), '◆→⚔ +' + (ch * d), 'dmg'); if (hasNode('hask.passive.surge')) refundEp(2); } }
      // PYRE / FROST (Hask, Elemental Weave) — his spells swing an aether meter
      // between fire (+ PYRE) and ice (− FROST).  PYRE empowers fire (+2/stack);
      // FROST refills ◆ CHARGE.  Casting AGAINST your element crosses the meter and
      // IGNITES the opposite pole — the reward for weaving, not camping.  Base
      // Emberwake ignites at ±1; the BACKDRAFT capstone snaps to the FAR pole (±3)
      // and DETONATES a burst.  Casting WITH your element just climbs a step.
      if (owner && owner.id === 'hask' && hasNode('hask.weave.astral')) {
        const elem = fx.elem || 'ice';
        const a = owner.aether || 0;
        const back = hasNode('hask.weave.enochian');
        if (elem === 'fire') {
          if (a < 0) { owner.aether = back ? 3 : 1; if (back) { amt += 6; popupAt(figEl(owner.id), '🔥 BACKDRAFT +6', 'dmg'); } }   // cross Frost→Pyre: ignite
          else owner.aether = Math.min(3, a + 1);                                                                                    // climb Pyre
          if (owner.aether > 0) { amt += 2 * owner.aether; popupAt(figEl(owner.id), '🔥 PYRE +' + (2 * owner.aether), 'dmg'); }
        } else {
          if (a > 0) { owner.aether = back ? -3 : -1; if (back) { amt += 4; popupAt(figEl(owner.id), '❄ BACKDRAFT +4', 'dmg'); } }   // cross Pyre→Frost: chill
          else owner.aether = Math.max(-3, a - 1);                                                                                   // deepen Frost
          owner._umbral = owner.aether < 0 ? -owner.aether : 0;   // Umbral refill, cashed at the CHARGE step
        }
      }
      if (owner && owner.buffDmg) { popupAt(figEl(owner.id), '▲ RALLY +' + owner.buffDmg, 'rally'); owner.buffDmg = 0; }
      if (owner && owner.chill) { amt = Math.max(0, amt - owner.chill); popupAt(figEl(owner.id), '❄ −' + owner.chill, 'chill'); owner.chill = 0; }
      amt += tgt.mark || 0;
      amt += passiveDmg(owner, tgt);   // EXPOSED-exploiter passives + damage-tuning boons
      // subtle feedback when a damage-tuning BOON is lifting this hit (chip pulse, no popup spam)
      if (owner) runBoons().forEach(b => { if (b.trigger === 'dmgMod' && b.mod && (b.mod(owner, tgt) || 0) > 0) boonProc(owner.id, b.id, { quiet: true }); });
      // ASSIST: striking an enemy an ally already hit this turn is a
      // combo — +2 damage, and fighting together forms a thread between
      // the two attackers (Concept 3: assisting strengthens bonds).
      const hitters = tgt._hitBy || (tgt._hitBy = []);
      const prev = hitters.length ? hitters[hitters.length - 1] : null;
      const isFollowUp = !!(owner && prev && prev !== owner.id);
      if (isFollowUp) amt += 2;
      dealToEnemy(tgt, amt, owner ? owner.def.school : null, owner ? owner.id : null);
      if (owner && !tgt.dead) firePassives('postHit', owner.id, { tgt });   // execute thresholds (Death Mark)
      if (owner) {
        hitters.push(owner.id);
        fireEmergent(owner.id, 'hit', card);
        if (tgt.dead) { fireEmergent(owner.id, 'kill', card); firePassives('kill', owner.id, { tgt }); }
        // CHARGE (Hask) — every spell that lands builds a stack (a nuke spends them).
        if (owner.id === 'hask' && !fx.spendCharge) { const gain = 1 + (owner._umbral || 0); owner._umbral = 0; owner.charge = Math.min(chargeCap(owner), (owner.charge || 0) + gain); popupAt(figEl(owner.id), '◆ ' + owner.charge, 'info'); }
        // WARSTEP — landing an attack unlocks a free reposition this turn.  The
        // flag is per-hero now (Build 250): the rule belongs to whoever holds
        // the node, and since it can be TAUGHT that is no longer only Ash.
        { S._flags = S._flags || {}; S._flags[owner.id + 'Struck'] = true; }
        // A small MOMENTUM trickle on every ordinary hit — the burst gauge should
        // feel alive and visibly climb through a normal fight, not sit decorative.
        // (Assists already grant the bigger surge below; still far slower than the
        // old turn-1 pace — bonds & parries remain the fast fill.)
        if (!isFollowUp && amt > 0) gainMomentum(2, { raw: true });
      }
      if (isFollowUp) {
        gainMomentum(12, { combo: true });   // ASSIST — focus-firing a foe builds burst
        // one clean callout (was two stacked ⚡ popups): the +2 bonus and, once a
        // real chain is running, the ASSIST count.
        // This is also a BOND act (see addThread below) — say so when it is
        // about to tie a new pair, instead of only naming the momentum.
        {
          const ties = livingHeroes().some(h2 => h2.id !== owner.id && hitters.indexOf(h2.id) >= 0 && !S.threads.has(pairKey(owner.id, h2.id)));
          popupAt(figEl(owner.id), ties ? '♡ TOGETHER · ASSIST +2'
            : (S.combo >= 2 ? '⚡ ASSIST +2 · ×' + S.combo : '⚡ ASSIST +2'), 'info');
        }
        SFX.follow();
        firePassives('followup', owner.id, { ally: prev });   // ally = the hero Ash followed
        // GANGING UP binds the whole party: thread with EVERY ally who has
        // struck this foe this turn, not just the last — so focus-firing one
        // enemy (the natural strong play) weaves the full triangle instead of
        // leaving the triad's marquee moment locked behind fussy pick order.
        const priorAllies = hitters.filter((id, i) => id !== owner.id && hitters.indexOf(id) === i);
        for (const ally of priorAllies) await addThread(owner.id, ally, 'they struck as one');
      }
      // AVENGE: cutting down an enemy that hurt an ally this fight forms a
      // thread with the one you avenged — protective aggression bonds too.
      if (tgt.dead && owner) {
        const wounded = (tgt._damaged || []).filter(id => id !== owner.id && livingHeroes().some(h => h.id === id));
        if (wounded.length) {
          const avenged = wounded[wounded.length - 1];
          popupAt(figEl(owner.id), '♡ AVENGED', 'info');   // an undocumented bond path until Build 256
          await addThread(owner.id, avenged, 'a death avenged');
        }
      }
      if (tgt.dead) await sleep(140);   // hitstop: let the kill land
    } else {
      flashNarrator('No target in reach — the cut finds only air.');
    }
  }
  if (fx.mark) {
    const tgt = livingEnemies().find(e => e.uid === targetId);
    // ADDITIVE, capped — the old assignment meant marking a foe at ◎4 with a
    // mark:2 card silently LOWERED it to 2 while the popup claimed "+2".
    if (tgt) { tgt.mark = Math.min(6, (tgt.mark || 0) + fx.mark); popupAt(figEl(tgt.uid), '◎ EXPOSED +' + fx.mark, 'info'); if (owner) fireEmergent(owner.id, 'expose', card); }
  }
  if (fx.lull) {
    const tgt = card.target === 'enemy' ? (livingEnemies().find(e => e.uid === targetId) || frontmostEnemy()) : frontmostEnemy();
    if (tgt) { tgt.lull = (tgt.lull || 0) + fx.lull; popupAt(figEl(tgt.uid), '❄ CHILL −' + fx.lull, 'chill'); }
    // KINDLING (Hask) — frost feeds the fire: chilling a foe builds ◆ CHARGE.
    if (owner && heroHas(owner.id, 'hask.passive.kindling')) { owner.charge = Math.min(chargeCap(owner), (owner.charge || 0) + 1); popupAt(figEl(owner.id), '◆ ' + owner.charge, 'info'); }
  }
  // OVERCHARGE (Hask) — a self-cast that only builds ◆ CHARGE, no strike.
  // A POWER-UP answer banks onto the LINE, not onto a hero — it empowers whoever
  // closes, which is the point of answering somebody else's beat.
  if (fx.lineRally && S.line) { S.line.rally = (S.line.rally || 0) + fx.lineRally;
    popupAt(figEl(owner && owner.id), '▲ LINE +' + S.line.rally, 'rally'); }
  if (fx.chargeGain && owner) { owner.charge = Math.min(chargeCap(owner), (owner.charge || 0) + fx.chargeGain); popupAt(figEl(owner.id), '◆ ' + owner.charge, 'info'); }
  if (fx.heal || fx.guard || fx.buffDmg || fx.counter) {
    let receivers = [];
    if (card.target === 'ally')   receivers = [S.heroes.find(h => h.id === targetId)].filter(Boolean);
    if (card.target === 'self')   receivers = [owner];
    if (card.target === 'allies') receivers = livingHeroes();
    if (card.target === 'frontmost' && fx.guard) receivers = [owner];
    for (const rc of receivers) {
      if (!rc || rc.downed) continue;
      if (fx.heal) {
        const room = rc.maxHp - rc.hp, healed = Math.min(room, fx.heal), spill = fx.heal - healed;
        rc.hp += healed;
        if (healed) popupAt(figEl(rc.id), '✚' + healed, 'heal');
        if (spill) {
          // overheal shields — and Elin's RADIANT OVERFLOW spreads the spill to
          // the WHOLE party instead of pooling on one target.
          if (owner && owner.id === 'elin' && hasNode('elin.passive.overflow')) {
            livingHeroes().forEach(h => { h.guard += spill; popupAt(figEl(h.id), '⛨' + spill, 'guard'); });
          } else { rc.guard += spill; popupAt(figEl(rc.id), '⛨' + spill, 'guard'); }
        }
        SFX.heal();
        // MERCY (Elin) — her mending also lifts the omen: cleanse ❄ CHILL / ◎ EXPOSED.
        if (owner && heroHas(owner.id, 'elin.passive.mercy') && (rc.chill || rc.exposed)) {
          rc.chill = 0; rc.exposed = 0; popupAt(figEl(rc.id), '✦ CLEANSED', 'heal');
        }
      }
      if (fx.guard)  { rc.guard += fx.guard; popupAt(figEl(rc.id), '⛨ ' + fx.guard, 'guard'); SFX.guard(); }
      if (fx.buffDmg){ rc.buffDmg += fx.buffDmg; popupAt(figEl(rc.id), '▲ RALLY +' + fx.buffDmg, 'rally'); }
      if (fx.counter){ rc.counter = Math.max(rc.counter, fx.counter); }
      // TEAM SYNERGY: warding/mending an ally can bless their next strike (Elin's Blessed Edge)
      if (owner && (fx.heal || fx.guard)) firePassives('support', owner.id, { receiver: rc });
      // A shared act BONDS: helping an ally forms a thread.  A PARTY-wide ward or
      // heal (target 'allies') weaves the caster to EVERYONE it shelters — so a
      // support hero's whole role knits the triangle, and the triad's marquee
      // moment is reachable through ordinary play instead of fussy pick order.
      if (owner && rc.id !== owner.id && (card.target === 'ally' || card.target === 'allies')) await addThread(owner.id, rc.id, 'a hand held out');
    }
    // one emergent tick per PLAY (not per receiver): the caster's mending / warding loop
    if (owner && receivers.length) {
      if (fx.heal)  fireEmergent(owner.id, 'heal', card);
      if (fx.guard) fireEmergent(owner.id, 'guard', card);
    }
  }
  // SMITE — a SUPPORT card with teeth: it also strikes the frontmost foe, so the
  // support classes (Elin's radiant light, Cassia's punishing wall) never take a
  // dead turn when the party doesn't need a heal or ward.  Routed through the real
  // attack path, so it exploits EXPOSED, builds MOMENTUM, and GANGS UP to weave
  // bonds — a support hero who also fights knits the triangle.
  if (fx.smite && owner && !owner.downed) {
    const tgt = frontmostEnemy();
    if (tgt) {
      // WRATHFUL LIGHT (Elin) — her smites hit harder and EXPOSE, so a support hero
      // sets up the party's mark-exploiters (Mira/Branwen) as she heals.
      const wrath = owner.id === 'elin' && hasNode('elin.passive.wrath');
      let amt = fx.smite + (wrath ? 2 : 0) + passiveDmg(owner, tgt) + (tgt.mark || 0);
      if (wrath) { tgt.mark = (tgt.mark || 0) + 1; popupAt(figEl(tgt.uid), '◎ EXPOSED +1', 'info'); }
      const hitters = tgt._hitBy || (tgt._hitBy = []);
      const prev = hitters.length ? hitters[hitters.length - 1] : null;
      const isFollowUp = !!(prev && prev !== owner.id);
      if (isFollowUp) amt += 2;
      dealToEnemy(tgt, amt, owner.def.school, owner.id);
      popupAt(figEl(tgt.uid), '✦ ' + amt, 'dmg');
      if (!tgt.dead) firePassives('postHit', owner.id, { tgt });
      hitters.push(owner.id);
      fireEmergent(owner.id, 'hit', card);
      if (tgt.dead) { fireEmergent(owner.id, 'kill', card); firePassives('kill', owner.id, { tgt }); }
      if (isFollowUp) {
        gainMomentum(12, { combo: true });
        // This is also a BOND act (see addThread below) — say so when it is
        // about to tie a new pair, instead of only naming the momentum.
        {
          const ties = livingHeroes().some(h2 => h2.id !== owner.id && hitters.indexOf(h2.id) >= 0 && !S.threads.has(pairKey(owner.id, h2.id)));
          popupAt(figEl(owner.id), ties ? '♡ TOGETHER · ASSIST +2'
            : (S.combo >= 2 ? '⚡ ASSIST +2 · ×' + S.combo : '⚡ ASSIST +2'), 'info');
        }
        SFX.follow();
        firePassives('followup', owner.id, { ally: prev });
        const priorAllies = hitters.filter((id, i) => id !== owner.id && hitters.indexOf(id) === i);
        for (const ally of priorAllies) await addThread(owner.id, ally, 'they struck as one');
      } else if (amt > 0) gainMomentum(2, { raw: true });
    }
  }
  // TAUNT (Cassia's Provoke) — drag every foe's blow onto the taunter's ROW for the
  // coming enemy round.  Read by effIntentRow (and the telegraph, so it shows).
  if (fx.taunt && owner && !owner.downed) {
    S._taunt = owner.id;
    popupAt(figEl(owner.id), '⚑ TAUNT', 'info');
    flashNarrator(owner.def.name + ' PROVOKES — every foe turns to strike ' + owner.def.name + '.');
  }
  // Movement built into the action: the caster repositions after resolving,
  // free (no EP, no move-use).  The hand morphs to the new stance.
  //   step — slip ONE row toward front/back.
  //   warp — jump straight to a named row (e.g. a "vanish" to BACK).
  if ((fx.step || fx.warp) && owner && !owner.downed) {
    let to;
    if (fx.warp) to = fx.warp;
    else { const idx = ROWS.indexOf(owner.row); to = fx.step === 'front' ? ROWS[Math.max(0, idx - 1)] : ROWS[Math.min(2, idx + 1)]; }
    if (ROWS.indexOf(to) >= 0 && to !== owner.row) {
      const occ = livingHeroes().find(h => h.id !== owner.id && h.row === to);
      const from = owner.row; owner.row = to; if (occ) occ.row = from;
      onHeroEnterRow(owner, to, from);
      leaveAfterimage(owner, from);   // the slipped-from stance echoes (Mira's vanish, Branwen's backstep, etc.)
      S._morphHeroId = owner.id; if (occ) S._morphHeroId2 = occ.id;
      renderAll();
      popupAt(figEl(owner.id), (fx.warp ? '✦ ' : '⇄ ') + STANCE[to].name.toUpperCase(), 'info');
      SFX.move();
      await sleep(320);
    }
  }
  // The tail exists so impactFx and popupAt get read before the hand comes back.
  // A card that dealt no damage and moved nobody has nothing to read, and this
  // is the beat closest to the player's hands — 100ms here is felt harder than
  // 500ms in the enemy phase (Build 243).
  const loud = !!(fx && (fx.dmg || fx.aoeDmg || fx.castDmg || fx.spendCharge || fx.heal));
  S._finisher = false;   // never let the finisher chip leak into counters or the enemy phase
  await sleep(loud ? 240 : 150);
  // …and THEN a bonded pair may act on what your card just put on the board — a
  // mark laid, a foe broken, a chill landed. It reads as an answer to the play
  // because it happens after the play has been seen. (Build 271)
  await checkBondStrikes();
}

// Single source of truth for how hard an enemy intent hits — base + power,
// scaled by the fight's difficulty multiplier, then reduced by CHILL.  Used by
// the enemy turn AND both telegraphs (intent bubble + threat forecast) so what
// you're shown is exactly what lands.
function enemyIntentDmg(e, intent) {
  let mul = e.dmgMul || 1;
  // SOFT ENRAGE (Build 210) — from turn 8 a boss's blows swell +12% per turn, so
  // a stalled fight tightens instead of dragging.  Lives HERE (the single source
  // of truth) so the telegraph shows exactly what will land.
  if (e.def && e.def.boss && S && S.turn > 8) mul *= 1 + 0.12 * (S.turn - 8);
  const scaled = Math.round(((intent.dmg || 0) + (e.power || 0)) * mul);
  return Math.max(0, scaled - (e.lull || 0));
}
// The intents an enemy will execute on its COMING turn (one, or two for a boss
// that strikes twice).  Drives both the telegraph and the resolution so what is
// shown is exactly what lands.
// ─────────────────────────────────────────────────────────────────────────────
// THE FIGHT ANSWERS BACK (Build 260) — no new mechanics, no new UI.
//
// Every mob has three authored intents on a fixed loop, so turn 4 WAS turn 1
// with a smaller HP bar. Measured from two directions: the arc drill found
// threat falling monotonically, and the decision drill found the same best play
// on 5 of 6 turns because the board never changed.
//
// Nothing new is added here. The foe simply REACHES for a different one of the
// intents it already has, by two rules a player can read off the telegraph they
// already watch:
//
//   CORNERED  under 40% HP it goes for its most dangerous intent — hurt it and
//             it lashes out
//   STEADYING right after a BREAK it takes its most defensive one — break it
//             and it turtles
//
// And because parryPatternFor() derives the RHYTHM from the intent, a cornered
// foe automatically drums a different pattern. The party twist and the rhythm
// twist reinforce each other for free.
//
// This is the ONE source of truth for "what comes next": the telegraph and the
// enemy phase both call it, so the board can never promise one blow and land
// another.
function intentDanger(it) {
  if (!it) return -1;
  if (it.kind === 'buff') return -1;                       // steadying, not striking
  return (it.dmg || 0) + (it.heavy ? 100 : 0) + (it.times || 1) * 2;
}
function chooseIntent(e, offset) {
  const list = e.def.intents, len = list.length;
  const cycle = list[(e.intentIdx + (offset || 0)) % len];
  if (!e || e.dead) return cycle;
  // THE TUTORIAL KEEPS ITS SCRIPT. Its fights are hand-authored beats — the husk
  // casts Wither on turn 3 precisely so the player learns that guard blunts their
  // hits — and a cornered foe reaching for its heaviest intent overrides exactly
  // that. The teaching road stays deterministic; the descent is where the board
  // starts answering back.
  if (!S || !S.node || !S.node.useRunHp) return cycle;
  // STEADYING — it just lost a turn to a break; it braces rather than swinging.
  if (e._steadied) {
    const calm = list.find(it => it.kind === 'buff' || it.guardSelf);
    if (calm) return calm;
  }
  // CORNERED — crossing 40% it lashes out ONCE with the worst thing it has, then
  // resumes its cycle. Measured as a standing state instead, a wounded boss
  // repeated REMEMBERED END every turn: monotony of a different kind, and
  // unreadable besides. A moment lands; a permanent mode just grinds.
  if (e._corner) {
    let worst = cycle;
    list.forEach(it => { if (intentDanger(it) > intentDanger(worst)) worst = it; });
    return worst;
  }
  return cycle;
}
function enemyNextIntents(e) {
  const len = e.def.intents.length;
  const n = e.def.attacksPerRound || 1;   // bosses AND swarms (Gnawing Brood) strike more than once
  const out = [];
  // A stored ECHO returns as the round's FIRST strike (it does not consume a slot
  // in the normal cycle), so the telegraph mirrors exactly what enemyPhase runs.
  const pounce = smartHookIntent(e);   // a smart foe reaching for its hook this round
  for (let k = 0; k < n; k++) {
    if (k === 0 && e.echoStored) { out.push(echoView(e.echoStored)); continue; }
    if (k === 0 && !e.echoStored && pounce) { out.push(pounce); continue; }   // the pounce takes the first slot
    const off = e.echoStored ? k - 1 : k;
    out.push(chooseIntent(e, off));   // same chooser the enemy phase runs — the telegraph cannot lie
  }
  return out;
}
// A returning ECHO: the same blow again, stronger, still parriable — but it does
// not re-echo, sever, or curse (pure damage), so it can't chain into a loop.
function echoView(stored) {
  const s = stored.intent;
  return { name: 'ECHO · ' + s.name, dmg: (s.dmg || 0) + (stored.dmgBonus || 0), row: s.row,
    heavy: s.heavy, attackArt: s.attackArt, parry: s.parry, echoOf: true };
}
// SMART foes (floor 2+) don't hammer a fixed row — they HUNT the most vulnerable
// living hero (lowest hp+guard; ties to the most-exposed).  Computed live, so the
// telegraph always shows the real target — and moving the weak one re-aims it.
function effIntentRow(e, intent) {
  if (!intent || intent.kind === 'buff' || intent.row === 'all') return intent ? intent.row : undefined;
  // TAUNT (Cassia's Provoke) overrides targeting — every single-row blow lands on
  // the taunter's row, even for non-smart foes.  The wall makes itself the target.
  if (typeof S !== 'undefined' && S && S._taunt) {
    const tn = livingHeroes().find(h => h.id === S._taunt);
    if (tn) return tn.row;
  }
  const live = (typeof S !== 'undefined' && S) ? livingHeroes() : [];
  if (!live.length) return intent.row;
  // THE ROW IS DECIDED WHEN THE TELEGRAPH GOES UP, AND DOES NOT FOLLOW YOU
  // (Build 281). This is called for BOTH the telegraph and the resolution, so
  // anything computed fresh would re-aim after you moved — and stepping out of
  // the named row is the whole dodge. Lock it for the turn.
  // Keyed PER INTENT, not per enemy: a boss telegraphs two blows a round, and a
  // single lock collapsed both onto one row.
  const aimKey = (intent.name || '') + '|' + intent.row;
  if (S && e) {
    if (!e._aim || e._aim.turn !== S.turn) e._aim = { turn: S.turn, m: {} };
    if (e._aim.m[aimKey]) return e._aim.m[aimKey];
  }
  const lock = (row) => { if (S && e && e._aim) e._aim.m[aimKey] = row; return row; };
  if (!e || !e.smart) {
    // A dumb foe used to swing at the row its intent names even when nobody was
    // standing in it. Against a lone hero — one occupied row of three — that is
    // most of its attacks hitting furniture: no damage, and NO PARRY WINDOW
    // either, because enemyPhase only opens one when a hero is in the struck row
    // (see `ptRow`). The beat was silently deleted, which is a large part of why
    // a fight offers so few chances to parry.
    if (heroInRow(intent.row)) return lock(intent.row);
    // aim at the nearest row somebody is actually standing in, so a blow meant
    // for the back line still reads as one
    const order = ROWS.indexOf(intent.row);
    const occupied = ROWS.filter(r => heroInRow(r))
      .sort((a, b) => Math.abs(ROWS.indexOf(a) - order) - Math.abs(ROWS.indexOf(b) - order));
    return lock(occupied[0] || intent.row);
  }
  // A SHOVE/HOOK hunts the cruelest victim to displace, not just the weakest hitpool.
  if (intent.shove) { const v = cruelShovePrey(e, intent); if (v) return lock(v.row); }
  const prey = live.slice().sort((a, b) => (a.hp + (a.guard || 0)) - (b.hp + (b.guard || 0)) || (b.exposed || 0) - (a.exposed || 0))[0];
  return lock(prey.row);
}
// DELIBERATELY CRUEL — a shove/hook seeks the victim it hurts MOST to move, not
// merely the lowest hitpool: first a charged Hask (dragging him MISFIRES his ◆),
// then the squishiest / most-wounded back-liner yanked into the melee.  Returns
// the victim hero (or null).
function cruelShovePrey(e, intent) {
  const live = (typeof S !== 'undefined' && S) ? livingHeroes() : [];
  if (!live.length) return null;
  const drag = intent && intent.shove === 'front';   // a hook pulls someone forward, into reach
  const score = (h) => {
    let s = 0;
    if (h.id === 'hask' && (h.charge || 0) > 0 && !hasNode('hask.passive.steady')) s += 200 + (h.charge * 10);  // detonate the caster
    if (drag && h.row !== 'front') s += 30;                        // only worth hooking someone not already up front
    s += (40 - (h.maxHp || 30)) * 2;                              // squishier = juicier target for the drag
    s += Math.round((1 - h.hp / (h.maxHp || 30)) * 20);           // already wounded = finish the cruelty
    return s;
  };
  return live.slice().sort((a, b) => score(b) - score(a))[0] || null;
}
// A smart foe REACHES for its hook the instant a PRIME victim is exposed — a
// charged Hask, or a wounded (≤40% HP) squishy back-liner.  Shared by the
// telegraph and the resolution so the intent pill always shows the real pounce.
function smartHookIntent(e) {
  if (!e || !e.smart) return null;
  const hook = (e.def.intents || []).find(it => it.shove);
  if (!hook) return null;
  const prime = livingHeroes().some(h =>
    (h.id === 'hask' && (h.charge || 0) >= 2 && !hasNode('hask.passive.steady')) ||
    (h.row !== 'front' && (h.maxHp || 30) <= 24 && h.hp / (h.maxHp || 30) <= 0.4));
  return prime ? hook : null;
}
function dealToEnemy(e, amt, school, byHeroId) {
  // A REMEMBERED finisher is half-heard (see closeLine). Read off the resolving
  // card so only the finisher itself is blunted, never riders or bond strikes.
  if (S._finisher && S._finisherName && e._echoMem && e._echoMem.has(S._finisherName)) {
    amt = Math.round(amt * 0.5);
    popupAt(figEl(e.uid), '◈ ECHOED — ×0.5', 'info');
  }
  // BREAK WINDOW (Build 234): a broken foe takes ×1.5 from EVERY hit until it
  // recovers — a window the whole party piles into, not a single consumed ×2.
  // The old one-shot ×2 meant the break and its interrupt were mutually
  // exclusive by accident; the window makes them compound by design.
  if (e.staggered) {
    amt = Math.round(amt * 1.5);
    popupAt(figEl(e.uid), '×1.5 BREAK', 'dmg');
  }
  // TECHNICAL — striking a PRIMED foe (CHILLED or WEAKENED) off the weakness
  // line detonates the setup for bonus damage + momentum.  This is the combo
  // payoff: prime with a status card, then anyone cashes it.  (Suppressed in an
  // all-out, which runs its own detonation.)
  // Teach the setup while it EXISTS rather than after it detonates: a +4 damage,
  // +8 momentum mechanic whose name appeared in exactly one popup, fired after
  // the fact, for a state that had no chip at all.
  if (!e.staggered && (e.lull || e.weakened) && !S._burstResolving) {
    lesson('technical', '⚡ IT IS OPEN — a chilled or weakened foe takes a TECHNICAL: strike it with ANY hero for HALF AGAIN the damage and a burst surge. Cash your biggest hit here.', 3);
  }
  let technical = false;
  if (byHeroId && !S._burstResolving && (e.lull || e.weakened) && !(school && school === e.def.weak)) {
    // Build 272: a MULTIPLIER, not a flat +4. Reading the board has to pay in
    // proportion to the play you spend on it — a flat bonus was worth +67% on a
    // 6-damage chip and +33% on the 12-damage finisher you actually had to
    // choose to cash, so the game rewarded noticing the opening LEAST on the
    // turn that noticing it mattered most. That inversion is most of why
    // playing well only beat playing carelessly by a third.
    amt = Math.round(amt * TECHNICAL_MULT);
    technical = true;
    gainMomentum(8, { combo: true });
  }
  let left = amt;
  // LONGSHOT (Branwen) — her arrows slip past enemy GUARD entirely; everyone else
  // chips the guard first.
  const pierce = heroHas(byHeroId, 'branwen.passive.longshot');
  if (e.guard > 0 && !pierce) { const g = Math.min(e.guard, left); e.guard -= g; left -= g; }
  const _wasAbove = e.hp / Math.max(1, e.maxHp) > 0.4;
  e.hp = Math.max(0, e.hp - left);
  // the wound that takes it past 40% arms ONE desperate answer (see chooseIntent)
  if (_wasAbove && e.hp > 0 && e.hp / Math.max(1, e.maxHp) <= 0.4 && !e._corneredOnce) {
    e._corneredOnce = true; e._corner = true;
    popupAt(figEl(e.uid), '⚠ CORNERED', 'dmg');
    flashNarrator(e.def.name + ' is cornered — it reaches for something worse.');
  }
  // First blood reveals the hidden weakness.
  if (!e.weakRevealed) {
    e.weakRevealed = true;
    flashNarrator(e.def.name + ' — weak to ' + (SCHOOL_GLYPH[e.def.weak] || '?') + ' ' + (e.def.weak || '').toUpperCase() + '.');
  }
  // THREE ROUTES TO A BREAK (Build 252).  Measured: across four real fights a
  // greedy party broke a foe ZERO times.  Poise only ever chipped on a WEAKNESS
  // hit, and a hero has exactly one school — so of a party of three, usually one
  // hero could chip at all, at about a pip a turn, in a fight that ends in three
  // or four. The payoff the game is built around simply never arrived.
  //
  // A weakness hit stays the best route (it alone pays momentum and primes
  // TECHNICAL). But a completed ROTATION now chips too, so every hero has a way
  // to lean on the gauge in their own voice, and a PERFECT PARRY chips from the
  // defensive side (see the parry branch in enemyPhase). A break becomes
  // something a party plans across three turns instead of an accident.
  const weakHit = !!(school && school === e.def.weak);
  // A finisher chips at most ONCE PER FOE PER TURN.  Three heroes each cashing a
  // rotation would otherwise strip a 2-3 pip gauge every single turn and turn the
  // break from a plan into a metronome. Weakness stays uncapped: it is the fast
  // route, and it costs you the school match to use it.
  const finChip = !!S._finisher && e._finTurn !== S.turn;
  if (finChip) e._finTurn = S.turn;
  const chips = (weakHit ? 1 : 0) + (finChip ? 1 : 0);
  if (weakHit && e.hp > 0 && !S._burstResolving) {
    gainMomentum(10, { combo: true });            // exploiting a weakness builds burst
    e.weakened = true;                            // primes TECHNICAL until the enemy phase
  }
  if (chips > 0 && e.hp > 0 && !S._burstResolving) {
    if (!e.staggered && (e.poise || 0) > 0) {
      e.poise = Math.max(0, e.poise - chips);
      popupAt(figEl(e.uid), '◈ POISE −' + chips, 'info');
    }
    if (!e.staggered && (e.poise || 0) <= 0) {
      e.staggered = true;
      S._breaks = (S._breaks || 0) + 1;            // a fight's break count — read by the playtest drills
      foeAnimState(e.uid, 'broken');               // it reels for the whole window
      if (_foeAnim[e.uid]) { try { const r = figHitRect(figEl(e.uid)); const sr = $('#stage').getBoundingClientRect(), k = sr.width / stageDW();
        burstFxAt((r.left + r.width / 2 - sr.left) / k, (r.top + r.height * 0.4 - sr.top) / k); } catch (_) {} }
      gainMomentum(18);                            // the BREAK is a big surge
      popupAt(figEl(e.uid), '⚡ BROKEN', 'dmg popup-big');
      flashNarrator(e.def.name + ' is BROKEN — it reels, and every blow lands harder until it recovers.');
      SFX.follow();
      // EMERGENT: a broken-open foe is also left EXPOSED — the stagger feeds the
      // whole mark ecosystem, so any hero's ◎ payoffs (Opportunist, Hunter's
      // Focus, Death Mark, Bloodscent, Marked-for-Death…) light up on the reeling
      // target.  Staggering and marking now compound instead of living apart.
      e.mark = (e.mark || 0) + 3;
      popupAt(figEl(e.uid), '◎ EXPOSED 3', 'info');
      // The break itself is baseline (burst + PRESS-ON EP below).  CASHING it is an
      // earned per-hero skill (the EXECUTIONER node) — and each hero cashes it in
      // their OWN voice: a hero-flavoured finisher forged into hand, plus, for
      // some, an instant reaction that feeds their build (Elin mends, Cassia
      // hardens, Branwen refunds EP).  Data-driven off node.stagger.
      if (byHeroId && HEROES[byHeroId] && hasNode(byHeroId + '.exec')) {
        const fh = S.heroes.find(x => x.id === byHeroId);
        const st = (NODE_BY_ID[byHeroId + '.exec'] || {}).stagger;
        if (fh && !fh.downed && st) {
          genTempCard({ kind: 'temp', owner: byHeroId, ownerName: fh.def.name, tint: fh.def.tint,
            stance: 'FORGED · FINISHER', name: st.name, cost: 0, target: st.target || 'enemy',
            school: fh.def.school, fx: Object.assign({}, st.fx), desc: st.desc });
          if (st.ep) refundEp(st.ep);                                       // Branwen — the tally comes due
          if (st.heal) livingHeroes().forEach(h => { if (!h.downed && h.hp < h.maxHp) { h.hp = Math.min(healCap(h), h.hp + st.heal); popupAt(figEl(h.id), '✚' + st.heal, 'heal'); } });   // Elin — mends as she ends
        }
      }
      if (!S._pressUsed) {
        S._pressUsed = true;
        S.ep += 1;
        pulseEp();
        popupAt(figEl(e.uid), '+1 EP · PRESS ON', 'rally');
      }
    } else if (!S._weakTaught && !e.staggered) {
      S._weakTaught = true;
      flashNarrator('Weakness! Each ' + SCHOOL_GLYPH[e.def.weak] + ' hit chips a ◈ POISE pip — at zero it BREAKS.');
    }
  }
  // IMPACT TIER — the weight of the blow drives every feel channel (flash,
  // hitstop, shake, popup), so a 4-damage poke and a 30-damage crash land
  // nothing alike.  0 light · 1 solid · 2 heavy · 3 massive.
  const tier = amt >= 20 ? 3 : amt >= 12 ? 2 : amt >= 7 ? 1 : 0;
  const big = tier >= 2;
  // THE DASH LANDS WHEN THE BLADE DOES (v2.2 Build 3, the Golden Sun read).
  // A card-acting hero DASHES across the field (see lungeFig) and their blade
  // arrives ~DASH_CONTACT into the travel — so the whole impact bundle (popup,
  // flash, HITSTOP, shake, recoil, even the death burst) is deferred to that
  // frame. The hitstop then freezes the dash at its fullest extension, which
  // is the exact contact-frame pause that sells the blow. State (hp, embers,
  // death flags) stays synchronous — only the LIGHT is late.
  const _atkH = byHeroId && S && S.heroes ? S.heroes.find(x => x.id === byHeroId) : null;
  const _dash = !!(_atkH && _atkH._held && !_atkH.downed);
  // a CAST's blade is the release frame, deeper into its walk than a dash's
  const DASH_CONTACT = (_atkH && _atkH._castAnim) ? CAST_CONTACT_MS : 190;
  const _land = (fx) => { if (_dash) setTimeout(fx, DASH_CONTACT); else fx(); };
  if (byHeroId) lungeFig(figEl(byHeroId));       // the striker sets off NOW
  _land(() => {
    foeAnimState(e.uid, e.staggered ? 'broken' : big ? 'heavy' : 'hit');
    popupAt(figEl(e.uid), '−' + amt, 'dmg' + (big ? ' popup-big' : ''));
    // (damagedHeroes bookkeeping lives in enemyPhase; kills resolve avenging
    // in resolveCard where the attacker is known)
    impactFx(figEl(e.uid), school || 'phys', big); // school-typed blow lands
    struck(figEl(e.uid), 'r');                 // recoil + flash + brief stun
    hitFlash(tier);                                 // screen flash (+ hitstop if heavy)
    SFX.hit(big);
    // Build 275: a smooth ladder, and XL leaves ordinary combat entirely — it is
    // reserved for the authored moments (all-out, triad, stage break) that ask
    // for it by name. A heavy hit landing as hard as a triad finale is why the
    // big beats stopped reading as big.
    if (tier >= 1) stageShake(['sm', 'sm', 'md', 'lg'][tier]);
    // Inside a SHOT the lens is already composed on this action — hitstop, the
    // shake and the flash carry the impact, and the frame HOLDS. Outside one
    // (ripostes, counters, loose damage) the punch still answers.
    if (!_camShot) camPunch(tier, figEl(e.uid));
    if (technical) {                                // detonation callout
      popupAt(figEl(e.uid), '⚡ TECHNICAL', 'tech');
      techBurst(figEl(e.uid));
      // Build 275: no second shake. The tier shake already fired on this very
      // frame, so a technical used to stack two of them plus a flash plus the
      // burst — the single most violent thing that could happen on screen, for a
      // damage bonus. The burst and the callout carry it.
    }
  });
  if (e.hp === 0 && !e.dead) {
    // MEGA BOSS — dropping a stage is not death: it sheds the aspect and reforms
    // into the next.  (During an ALL-OUT we clamp to 1 HP instead of breaking
    // mid-burst, so the reform cutscene never interrupts the scripted sequence —
    // the next clean hit triggers it.)
    if (e._stages && e.stage < e._stages.length - 1) {
      // Already mid-transition (a same-card follow-up hit landed after the KO)?
      // Don't fire a second break — just hold at 0 until the reform completes.
      if (S && S._staging) return;
      if (S && S._burstResolving) e.hp = 1; else megaStageBreak(e);
      return;
    }
    e.dead = true;
    e._justDied = true;
    const reward = emberReward(e);                  // felling a foe yields embers
    addEmbers(reward);
    if (S) S._embersRun = (S._embersRun || 0) + reward;
    gainMomentum(8);                                // a kill feeds the burst
    // the kill's LIGHT waits for the dash's contact frame like every other hit
    _land(() => {
      const rel = figEl(e.uid); if (rel) popupAt(rel, '✦ +' + reward, 'ember');
      SFX.kill();
      stageShake('lg');
      hitFlash(3);                                    // the kill gets a white flash + slow-mo beat
      foeAnimState(e.uid, 'death');
      const el = figEl(e.uid);
      if (el) { el.classList.add('fig-dying'); deathBurst(el); }
      // THE KILL CUT — hard in on the dying foe, dutched, and HELD long enough
      // to watch it come apart before the slow pull home.
      if (!camReduced() && !_camHeld) {
        _camShot = false;                            // the cut outranks the action shot
        // Build 275: a PUSH, not a cut. It was a 140ms snap dutched 1.2° and
        // yawed 2.6° — which is a stunt. A death is worth a slow move in and a
        // long look, so the roll is nearly gone and the hold is longer than the
        // move that made it.
        camFocus(el, { z: 1.13, dz: 150, r: 0.28, yaw: 1.3, pitch: 0.3, pull: 0.36, ms: 380, ease: CAM_PUSH });
        clearTimeout(_camOutT);
        _camOutT = setTimeout(() => { _camOutT = null; camReset(980); }, 700);
      }
    });
    setTimeout(() => { e._justDied = false; if (S && !S.over) renderAll(); }, 750);
  }
}
// ══ THE CAMERA (Build 225) ═══════════════════════════════════════════════
// One camera for the whole fight.  We write four CSS variables on #stage and
// every world layer (the battlefield and the three HD-2D planes) reads them
// through its own depth factor — see the CAMERA RIG block in styles.css for
// the three hard rules this obeys (never touch #stage's transform, never
// scale #stage, transitions not animations).
//
// The FEEL is all in the asymmetry: a camera move that reads as "snappy"
// goes in FAST on a hard-out curve and settles back SLOW.  Symmetric easing
// reads as a lazy zoom no matter how big the number is.
const CAM_HOME = { x: 0, y: 0, z: 1, r: 0, dz: 0, pitch: 0, yaw: 0 };
const CAM_MAX_PAN = 120;   // px the lens may truck off centre
const CAM_MAX_DZ = 260;    // px it may dolly in
const CAM_MAX_ROLL = 6.5;  // deg of dutch — past this it reads as a broken TV
const CAM_SNAP = 'cubic-bezier(.16,.84,.28,1)';   // hard out — the READ (a parry lands or it doesn't)
// …and the other half of the vocabulary (Build 275): a PUSH. It leaves gently
// and arrives gently, which is what separates a camera move an operator made
// from one an impact caused. Everything that is drama rather than feedback —
// the heavy hit, the kill cut, the riposte — moves on this.
const CAM_PUSH = 'cubic-bezier(.33,.02,.24,1)';
const CAM_SETTLE = 'cubic-bezier(.22,.61,.36,1)'; // soft — the drift home
let _camHeld = 0;      // >0 while a rhythm window owns the frame
let _camOutT = null;   // pending auto-settle
function camReduced() {
  try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  catch (_) { return false; }
}
// Absolute move.  Everything else in this section is sugar over this.
function cam(spec) {
  const st = $('#stage'); if (!st || camReduced()) return;
  if (_camHeld && !(spec && spec.force)) return;   // a parry owns the frame
  const s = spec || {};
  const z = s.z == null ? CAM_HOME.z : s.z;
  // SAFETY RAILS. A subject near the edge of the field can produce a pan big
  // enough to swing half the party out of frame (a flawless riposte on a
  // back-rank hero measured 253px). No single beat may leave the cast.
  const clamp = (v, lim) => Math.max(-lim, Math.min(lim, v || 0));
  st.style.setProperty('--cam-x', clamp(s.x, CAM_MAX_PAN) + 'px');
  st.style.setProperty('--cam-y', clamp(s.y, CAM_MAX_PAN * 0.5) + 'px');
  st.style.setProperty('--cam-z', String(z));
  st.style.setProperty('--cam-r', clamp(s.r, CAM_MAX_ROLL) + 'deg');
  // 3D terms — dz is a real dolly through the diorama's perspective, so a
  // push-in widens and parallaxes the rows instead of flatly magnifying them.
  st.style.setProperty('--cam-dz', clamp(s.dz, CAM_MAX_DZ) + 'px');
  st.style.setProperty('--cam-pitch', clamp(s.pitch, 6) + 'deg');
  st.style.setProperty('--cam-yaw', clamp(s.yaw, 9) + 'deg');
  st.style.setProperty('--cam-ms', (s.ms == null ? 420 : s.ms) + 'ms');
  st.style.setProperty('--cam-ease', s.ease || CAM_SNAP);
  if (s.ox != null) st.style.setProperty('--cam-ox', s.ox);
  if (s.oy != null) st.style.setProperty('--cam-oy', s.oy);
  st.classList.toggle('cam-in', z > 1.02 || (s.dz || 0) > 20);
}
// Home, on the slow curve — the shot breathing back out.
// ── TURN POSES (Build 231) — the camera's HOME is a composition, never a
// dead-centered identity.  On the player's turn the lens hangs a few degrees
// toward the party; on the enemy's turn it swings to feature the other side.
// Every punch, focus and cinematic settles back into the ACTIVE pose, so the
// whole fight reads as photographed rather than surveilled.
const CAM_POSE_HOME   = { x: 0, y: 0, z: 1, r: 0, dz: 0, pitch: 0, yaw: 0 };
const CAM_POSE_PLAYER = { x: 22, y: 2, z: 1.02, r: -0.55, dz: 46, pitch: 1.1, yaw: 5.4 };
// the enemy pose sits a touch LOWER (positive y, higher pitch): the lens looks
// slightly up at them — the classic menace angle.
const CAM_POSE_ENEMY  = { x: -22, y: 5, z: 1.02, r: 0.55, dz: 46, pitch: 1.6, yaw: -5.4 };
let _camBase = CAM_POSE_HOME;
function camPose(pose, ms) {
  _camBase = pose || CAM_POSE_HOME;
  camReset(ms == null ? 750 : ms);
}
function camReset(ms) {
  clearTimeout(_camOutT); _camOutT = null;
  cam(Object.assign({}, _camBase, { ms: ms == null ? 520 : ms, ease: CAM_SETTLE, force: true }));
}
// Where is `el` relative to the stage centre, in LOGICAL stage px?  Same
// convention popupAt/noteAnchor use, so the camera and the FX agree.
function camOffsetTo(els) {
  const list = (Array.isArray(els) ? els : [els]).filter(Boolean);
  if (!list.length) return null;
  const st = $('#stage'); if (!st) return null;
  const sr = st.getBoundingClientRect(), s = (sr.width / stageDW()) || 1;
  let cx = 0, cy = 0;
  list.forEach(el => {
    const r = (typeof figHitRect === 'function' && figHitRect(el)) || el.getBoundingClientRect();
    cx += (r.left + r.width / 2 - sr.left) / s;
    cy += (r.top + r.height * 0.45 - sr.top) / s;
  });
  cx /= list.length; cy /= list.length;
  return { dx: cx - stageDW() / 2, dy: cy - stageDH() / 2 };
}
// THE WORKHORSE — a fast shove toward what just happened, then a slow settle.
// power 1 a solid hit · 2 heavy · 3 massive.  Drifting the lens only a
// FRACTION of the way to the subject keeps the party on screen; a full pan
// on every hit would be seasick.
// Power 0 a graze · 1 solid · 2 heavy · 3 massive.  EVERY landed blow gets a
// response — a hit that moves nothing reads as a hit that didn't happen, and
// the common case in this game is a 4-6 damage poke, so tier 0 is most of what
// a player actually feels.  The curve is steep at the top so a 30-damage crash
// lands nothing like a poke.
// CINEMATIC, NOT PERCUSSIVE (Build 275)
//
// This ladder was tuned as a fighting-game impact frame and it read as one:
// every damaging hit moved the lens, and heavier hits snapped in FASTER — a
// 30-damage crash arrived in 78ms while rolling 0.9°, yawing 3.4°, pitching
// 1.3° and dollying 200 all at once, on top of an 11px shake, a flash and a
// hitstop. Six channels firing together, four times a turn.
//
// Film does the opposite. A big moment PUSHES — slower in than a small one,
// then holds, then leaves reluctantly — and it commits to one axis instead of
// tumbling through four. So:
//
//   · light and solid hits no longer move the camera at all. The shake, the
//     flash and the hitstop already carry them; the frame HOLDS, which is what
//     makes the heavy hit worth a move.
//   · heavier is SLOWER in (the curve is inverted), with a longer hold and a
//     longer drift home.
//   · roll and pitch are most of what read as "intense" — a dutched, tumbling
//     frame is a stunt. Yaw keeps a little, because that is the parallax that
//     sells the diorama's depth, and depth was never the complaint.
//
// The PANS are untouched. camPose and camShot were the good half.
const CAM_PUNCH_MIN_TIER = 2;                       // below this, the frame holds
const CAM_PUNCH_DZ    = [0, 0, 96, 155];
const CAM_PUNCH_ROLL  = [0, 0, 0.14, 0.28];
const CAM_PUNCH_YAW   = [0, 0, 0.85, 1.5];
const CAM_PUNCH_PITCH = [0, 0, 0.18, 0.38];
const CAM_PUNCH_IN    = [0, 0, 210, 280];           // heavier = SLOWER in: a push
const CAM_PUNCH_HOLD  = [0, 0, 260, 380];
const CAM_PUNCH_OUT   = [0, 0, 780, 980];
const CAM_PUNCH_PULL  = [0, 0, 0.11, 0.16];
let _camPunchAt = 0, _camPunchPow = -1;
function camPunch(power, toEl) {
  if (camReduced() || _camHeld) return;
  const p = Math.max(0, Math.min(3, power | 0));
  if (p < CAM_PUNCH_MIN_TIER) return;               // the frame holds for chip damage
  // AoE calls dealToEnemy once PER enemy, which used to fire a stack of
  // competing punches where the LAST (often weakest) won. Collapse a burst
  // into one shove at its strongest power.
  const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  if (now - _camPunchAt < 150 && p <= _camPunchPow) return;
  _camPunchAt = now; _camPunchPow = p;
  const dz = CAM_PUNCH_DZ[p];               // TRUE dolly, not a zoom
  const r = CAM_PUNCH_ROLL[p];
  const yaw = CAM_PUNCH_YAW[p];             // enough orbit to sell depth, no more
  const pitch = CAM_PUNCH_PITCH[p];
  const inMs = CAM_PUNCH_IN[p];
  const o = toEl ? camOffsetTo(toEl) : null;
  const pull = CAM_PUNCH_PULL[p];
  const dir = o && o.dx < 0 ? -1 : 1;
  cam({ x: o ? -o.dx * pull : 0, y: o ? -o.dy * pull * 0.6 : 0,
        z: 1 + (dz / 1150) * 0.35,          // the planes still need a scale cue
        dz, r: dir * r, yaw: dir * yaw, pitch, ms: inMs, ease: CAM_PUSH });
  clearTimeout(_camOutT);
  // HOLD, then leave reluctantly. A shot that starts going home the instant it
  // arrives reads as a twitch; the hold is what makes the move feel authored.
  _camOutT = setTimeout(() => camReset(CAM_PUNCH_OUT[p]), inMs + CAM_PUNCH_HOLD[p]);
}
// ══ PARRY CINEMA (Build 230) — the Clair Obscur defensive camera ═════════
// Their combat sells a block as a piece of film: the lens composes the
// CONFRONTATION rather than a single figure, the shot tightens and dutches
// further with every blow in a string, a clean read SNAPS, and a missed one
// lurches the wrong way.  The tension is in the escalation, not in any one
// move.
//
// Safe to move mid-string, which is not obvious: a cascade's rings are placed
// at PRE-COMPUTED stage points (zonePoints) in #popup-layer, which sits
// outside the camera — and the input itself is position-INDEPENDENT (taps,
// holds and swipes all listen on `window`).  So the camera cannot break a
// parry; it can only decouple the ring from the figure visually.  That is why
// the escalation leans on ROLL and dolly (which barely slide a centred
// defender) and never on a pan.
function parryCam(i, total, q) {
  if (camReduced()) return;
  const t = total > 1 ? Math.min(1, i / (total - 1)) : 1;   // 0..1 through the string
  const dir = (i % 2) ? -1 : 1;                             // the dutch whips side to side
  const perfect = q === 'perfect', miss = q === 'miss';
  // A SWAY, not a whip: half the roll, a third the speed. The escalating
  // dolly still builds the string; the side-to-side is felt, not suffered.
  const dz = 52 + t * 64 + (perfect ? 22 : 0);
  const roll = dir * (0.55 + t * 1.2) + (perfect ? dir * 0.6 : 0) - (miss ? dir * 1.2 : 0);
  cam({ dz, z: 1 + (dz / 1150) * 0.35, r: roll,
        yaw: dir * (0.4 + t * 1.0), pitch: 0.6 + t * 1.0,
        ms: perfect ? 150 : miss ? 240 : 190, ease: CAM_SNAP, force: true });
}
// THE HELD FRAME — a cinematic that owns the camera (the all-out) still wants
// to BREATHE. Steps the shot in a notch and keeps it there, fast enough to
// settle inside the beat between two strikes.
function camStep(dz, opt) {
  const s = opt || {};
  cam({ dz, z: 1 + (dz / 1150) * 0.35, r: s.r || 0, yaw: s.yaw || 0, pitch: s.pitch || 0,
        ms: s.ms == null ? 110 : s.ms, ease: CAM_SNAP, force: true });
}
// ══ THE SHOT (Build 233) ══════════════════════════════════════════════════
// The fix for "it jumps around": the camera stopped reacting per EVENT and
// started thinking per ACTION.  Measured before this change, the framing
// reversed direction 103 times a minute — every blow yanked the lens in and
// let it drift out, three times a turn, a sawtooth.  A film camera takes a
// SHOT: it glides to a composition when a character acts, HOLDS it through
// everything that action does (the impact feel belongs to hitstop, the shake
// and the flash — which we already have), and glides back when the action
// ends.  One move in, one move out, per card.
let _camShot = false, _camShotEndT = null;
function camShot(els, opt) {
  if (camReduced()) return;
  // SHOT-TO-SHOT: if the last action's release glide is still pending, cancel
  // it and glide STRAIGHT to the new composition — the camera never goes home
  // between two quick actions. This is the difference between coverage and
  // a security feed.
  if (_camShotEndT) { clearTimeout(_camShotEndT); _camShotEndT = null; }
  _camShot = true;
  const o = opt || {};
  camFocus(els, { z: o.z == null ? 1.075 : o.z, pull: o.pull == null ? 0.4 : o.pull,
                  yaw: o.yaw || 0, pitch: o.pitch == null ? 0.8 : o.pitch, r: o.r || 0,
                  ms: o.ms == null ? 300 : o.ms });
}
function camShotEnd(ms) {
  _camShot = false;
  if (_camOutT) return;   // a KILL CUT mid-shot owns the scene — let it finish
  // The release waits a beat: if another action starts inside it, camShot
  // cancels this and the lens glides shot-to-shot instead of home-and-back.
  if (_camShotEndT) clearTimeout(_camShotEndT);
  _camShotEndT = setTimeout(() => { _camShotEndT = null; camReset(ms == null ? 680 : ms); }, 260);
}
// Frame one or more subjects and HOLD — the cut-in shot.  Caller resets.
function camFocus(els, opt) {
  if (camReduced() || _camHeld) return;
  const o = camOffsetTo(els);
  const s = opt || {};
  // A framing chosen by a cinematic (a riposte cut-in, a stage break) must not
  // be stomped 10ms later by the damage punch that follows it. Claim the
  // punch-collapse latch at full power so incidental shoves defer to it.
  _camPunchAt = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  _camPunchPow = 3;
  const pull = s.pull == null ? 0.7 : s.pull;
  const z = s.z == null ? 1.12 : s.z;
  cam({ x: o ? -o.dx * pull : 0, y: o ? -o.dy * pull * 0.5 : 0,
        z, dz: s.dz == null ? (z - 1) * 900 : s.dz,
        r: s.r || 0, pitch: s.pitch || 0, yaw: s.yaw || 0,
        ms: s.ms == null ? 380 : s.ms, ease: s.ease || CAM_PUSH });   // Build 275: a composed frame PUSHES; only a parry READ snaps
}
// Rhythm windows own the frame.  Strike/parry notes are placed ONCE from a
// live rect into #popup-layer (which is not under the camera), so a camera
// move mid-cascade would slide the figures out from under their own notes.
// Ref-counted like parrySlowmo so overlapping notes can't release it early.
function camHold(on) {
  if (on) { _camHeld++; clearTimeout(_camOutT); _camOutT = null; }
  else if (_camHeld > 0) { _camHeld--; if (!_camHeld) camReset(360); }
}
function camRelease() { _camHeld = 0; _camShot = false; _camPunchAt = 0; _camPunchPow = -1; clearTimeout(_camOutT); _camOutT = null; clearTimeout(_camShotEndT); _camShotEndT = null; camReset(0); }
// ESTABLISHING SHOT — open pushed in and tilted, then breathe out to true.
// The settle timer goes through _camOutT so camRelease() can cancel it: a
// fight torn down mid-intro must not shove the camera afterwards.
function camIntro(z, r, outMs) {
  // a REAL push: dz dollies through the perspective, pitch drops the lens.
  cam({ z, r, dz: (z - 1) * 900, pitch: r * 0.9, yaw: -r * 0.7, ms: 0, force: true });
  clearTimeout(_camOutT);
  _camOutT = setTimeout(() => camReset(outMs), 60);
}
// Screen-shake, scaled to the moment: 'sm' a nudge, 'xl' a wall-rattling slam.
function stageShake(mag) {
  const st = $('#stage');
  const cls = 'stage-shake-' + (mag || 'md');
  st.classList.remove('stage-shake-sm', 'stage-shake-md', 'stage-shake-lg', 'stage-shake-xl');
  void st.offsetWidth; st.classList.add(cls);
  clearTimeout(st._shakeT); st._shakeT = setTimeout(() => st.classList.remove(cls), 460);
}
// A struck figure: directional recoil + bright flash.  On big hits the global
// HITSTOP (below) freezes this recoil mid-pose for the "the blow connects" beat.
function struck(el, dir) {
  if (!el) return;
  const cls = dir === 'r' ? 'fig-hit-r' : dir === 'l' ? 'fig-hit-l' : 'fig-hit';
  el.classList.remove('fig-hit', 'fig-hit-l', 'fig-hit-r'); void el.offsetWidth;
  el.classList.add(cls);
}
// Full-screen impact flash, scaled by tier (0 light → 3 kill/massive).  Tier ≥ 2
// also HITSTOPs — a freeze of every animation, longer the bigger the blow, for
// that meaty "the blow connects" beat.
function hitFlash(tier) {
  tier = tier | 0;
  const st = $('#stage');
  const f = document.createElement('div');
  f.className = 'hit-flash' + (tier >= 2 ? ' hit-flash-big' : '') + (tier >= 3 ? ' hit-flash-huge' : '');
  st.appendChild(f);
  setTimeout(() => f.remove(), tier >= 3 ? 240 : tier >= 2 ? 190 : 120);
  if (tier >= 2) {
    st.classList.add('hitstop');
    const dur = tier >= 3 ? 155 : 95;
    clearTimeout(st._hsT); st._hsT = setTimeout(() => st.classList.remove('hitstop'), dur);
    try { SFX.hitstop(); } catch (_) {}
  }
}
// A kill blooms a shatter burst at the enemy — a bright core, an expanding ring,
// and shards flung outward: the satisfying "it breaks" beat.
function deathBurst(el) {
  if (!el) return;
  const layer = $('#popup-layer'); if (!layer) return;
  const sr = $('#stage').getBoundingClientRect(), s = sr.width / stageDW() || 1;
  const r = figHitRect(el);
  const x = (r.left + r.width / 2 - sr.left) / s, y = (r.top + r.height * 0.42 - sr.top) / s;
  const b = document.createElement('div');
  b.className = 'death-burst'; b.style.left = x + 'px'; b.style.top = y + 'px';
  let shards = '';
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * 360 + (i * 37 % 24) - 12;
    const d = 46 + (i * 53 % 34);
    shards += `<span class="db-shard" style="--a:${a}deg; --d:${d}px"></span>`;
  }
  b.innerHTML = `<span class="db-core"></span><span class="db-ring"></span>${shards}`;
  layer.appendChild(b);
  setTimeout(() => b.remove(), 720);
}
function pulseEp() {
  const dial = $('#ep-dial');
  if (!dial) return;
  dial.classList.remove('ep-pulse'); void dial.offsetWidth; dial.classList.add('ep-pulse');
}
// SPEND FX — when a card costs EP, energy motes lift off the EP dial and a −N cue
// pops, so the cost visibly LEAVES your reserve (reinforces the finisher economy).
function spendEpFx(cost) {
  const dial = $('#ep-dial'); if (!dial || !cost) return;
  dial.classList.remove('ep-spend'); void dial.offsetWidth; dial.classList.add('ep-spend');
  popupAt(dial, '−' + cost, 'ep-cost');
  const layer = $('#popup-layer'); if (!layer) return;
  const sr = $('#stage').getBoundingClientRect(), s = (sr.width / stageDW()) || 1;
  const r = dial.getBoundingClientRect();
  const cx = (r.left + r.width / 2 - sr.left) / s, cy = (r.top + r.height / 2 - sr.top) / s;
  for (let i = 0; i < Math.min(cost, 4); i++) {                 // one mote per EP, up to 4
    const o = document.createElement('span');
    o.className = 'ep-spark';
    o.style.left = cx + 'px'; o.style.top = cy + 'px';
    o.style.setProperty('--ex', (16 + i * 11) + 'px');           // drift up-and-right, toward the played card
    o.style.setProperty('--ey', (-28 - i * 9) + 'px');
    o.style.animationDelay = (i * 45) + 'ms';
    layer.appendChild(o);
    setTimeout(() => o.remove(), 720);
  }
}

// ---------------------------------------------------------------------------
// MOMENTUM — the combat-earned burst gauge (Persona all-out / Clair Obscur
// gradient).  Exploiting weaknesses, chaining ASSISTS (focus-firing a foe), staggering,
// and killing all feed it.  A running ASSIST combo counter (per player turn)
// scales each gain so chaining pays.  Full gauge → ALL-OUT ATTACK.
// ---------------------------------------------------------------------------
const MOM_MAX = 100;                 // L1 threshold — the all-out is available here
// COMBAT momentum builds ~30% slower now, so the all-out is a turn-3-ish CLIMAX you
// build toward, not a turn-1 reflex that overkills the pack.  BOND rewards (weave
// charge, the Kizuna chain node) pass `raw` and are NOT scaled — so bonding, not
// card-spam, is what accelerates the burst.
const MOM_SCALE = 0.6;   // Build 197 rebalance: combat momentum trimmed ~14% so the ALL-OUT is an earned climax, not a turn-2 formality (bond rewards pass raw and are unaffected)
// BURST LEVELS — the gauge's CONTAINER grows as you speak kizuna.  Landing a DUET
// expands it to L2, the TRIAD vow to L3 (see expandBurst); a bigger container
// holds more charge, and the all-out that fires UPGRADES to whatever level the
// gauge has filled to (see burstFireLevel / resolveAllOut).  Additive & opt-in:
// a fight that never bonds plays exactly like L1 always did.
const BURST_CAPS = [100, 175, 250];
// TWO DIFFERENT NUMBERS, conflated until Build 257:
//
//   burstCap()  — how much momentum the gauge can HOLD. gainMomentum clamps to
//                 it, so bonds must keep raising it or 175/250 are unreachable.
//   BURST_MIN   — the momentum at which the all-out can FIRE.
//
// burstReady() used to test against the CAP, so bonding a pair silently raised
// the firing bar and took away an all-out the player already had: you did the
// thing the game is named after and were punished with a longer wait. The stated
// reason was to stop a woven gauge being spent on a weak Level 1 — a real
// concern, but it was solved by removing the choice instead of surfacing it.
//
// Firing is pinned at 100 now and the tiers are advertised as what HOLDING pays.
// Same information, opposite posture: an invitation to bank rather than a lock.
const BURST_MIN = 100;
function burstCap() { return BURST_CAPS[((S && S.burstLevel) || 1) - 1] || 100; }
// The level the all-out will fire at RIGHT NOW — how far the container is filled.
function burstFireLevel() { const m = (S && S.momentum) || 0; return m >= 250 ? 3 : m >= 175 ? 2 : m >= 100 ? 1 : 0; }
function gainMomentum(amt, opts) {
  if (!S || S.over || S._burstResolving) return;   // bursts don't feed themselves
  opts = opts || {};
  if (opts.combo) {
    S.combo = (S.combo || 0) + 1;
    if (S.combo > (S.comboBest || 0)) S.comboBest = S.combo;
    amt += Math.min(8, S.combo);                    // longer chains fill faster
  }
  if (!opts.raw) amt = Math.round(amt * MOM_SCALE); // combat gains build slower; bond rewards (raw) don't
  const before = S.momentum || 0;
  S.momentum = Math.max(0, Math.min(burstCap(), before + amt));
  const fill = $('#burst-fill');
  if (fill) { fill.classList.remove('burst-gain'); void fill.offsetWidth; fill.classList.add('burst-gain'); }
  // The "READY" beat now fires when the CONTAINER FILLS to its current level — so a
  // woven L2/L3 container isn't prompted to unleash a weak L1 at 100.  You build
  // toward your full burst; crossing an interior tier just charges quietly.
  // Announce READY at 100, and each richer tier as it is REACHED — every one of
  // them is now a choice to fire or hold, never a lock.
  BURST_CAPS.forEach((thr, i) => {
    if (S.momentum < thr || before >= thr) return;
    const top = (S.burstLevel || 1) >= i + 1;
    if (i === 0) flashNarrator('✦ BURST READY — unleash the ALL-OUT now, or hold it and it hits harder.');
    else if (top) flashNarrator((i === 2 ? '✦✦✦' : '✦✦') + ' BURST ' + (i === 2 ? 'TRANSCENDENT' : 'RESONANT')
      + ' — your ALL-OUT is at its strongest. Unleash it, then TAP each strike.');
    SFX.triad();
  });
}
// Grow the burst container.  Called when a DUET (L2) or the TRIAD vow (L3) lands —
// the kizuna also pours in a chunk of charge so the bigger gauge feels reachable.
// Persists for the rest of the fight (the container stays big; you refill it).
// Bonds no longer grow the CONTAINER (that was the trap above) — they raise the
// CEILING the all-out can pay if you choose to bank for it.
function expandBurst(level, label, charge) {
  if (!S || ((S.burstLevel || 1) >= level)) { if (charge) gainMomentum(charge, { raw: true }); return false; }
  S.burstLevel = level;
  const burst = $('#burst');
  if (burst) { burst.classList.remove('burst-expand'); void burst.offsetWidth; burst.classList.add('burst-expand'); }
  flashNarrator('✦ YOUR ALL-OUT DEEPENS — it can now reach LEVEL ' + level + (label ? ' · ' + label : '')
    + '. Hold the burst past ' + BURST_CAPS[level - 1] + ' to cash it.');
  if (SFX.triad) SFX.triad();
  if (charge) gainMomentum(charge, { raw: true });
  renderBurst();
  return true;
}
function burstReady() { return S && (S.momentum || 0) >= BURST_MIN && !S.executing && !S.over && !S._staging; }

// ---------------------------------------------------------------------------
// PARRY — a reactive timing window on enemy attacks (Clair Obscur flavor).
// Tap as the ring closes: PERFECT negates the blow, ripostes, and builds
// momentum; a looser tap BLOCKS half.  Experimental — flip PARRY_ENABLED to
// false to remove the whole layer cleanly (enemy attacks then resolve as before).
// ---------------------------------------------------------------------------
const PARRY_ENABLED = true;
// THE SWING (Build 288). A single read moved damage from 0x to 1.6x: a perfect
// parry negated the blow OUTRIGHT and a missed one landed 60% HARDER. That is
// why the game reads as all-or-nothing — block everything and nothing touches
// you, block nothing and you die — and it is the opposite of what makes Clair
// Obscur's defence work, which is that reads are FREQUENT and individually
// survivable. Builds 281 and 284 bought the frequency; this is the other half.
//
//   perfect  0     -> 0.12   clean play still takes a graze, so a long fight
//                            accumulates and you cannot stand at full HP. The
//                            reward moves to BURST and the riposte, which is a
//                            better prize than "nothing happened".
//   missed   1.6   -> 1.0    fluffing a read means the blow lands. It does not
//                            mean a bigger blow. A trash mob hits for 3-5, so
//                            botching one is now genuinely survivable — which is
//                            what lets a player learn the gesture on cheap
//                            enemies instead of only on the ones that kill them.
// A PERFECT NEGATES AGAIN (Build 303), and the window it costs got tighter.
//
// 288 set this to 0.12 to kill all-or-nothing defence, and the reasoning held —
// but it broke the promise the screen makes. The parry lands GREEN and the hero
// still bleeds, so the best outcome the game shows you is not the outcome you
// get. A player reads that as the parry not working, not as nuance.
//
// So the honesty comes back to the top tier and the DIFFICULTY moves into the
// window instead of into the damage: a perfect turns the blow completely, and a
// perfect is harder to hit (PARRY_PERF_MS 210 → 130). What stops this from being
// 288's all-or-nothing again is the GREAT band underneath it — a read you caught
// well but not perfectly still mostly holds, so missing perfect is a graze rather
// than a cliff. Three tiers, each with a different answer:
//
//   perfect  ≤130ms   0      turned completely — the green means what it says
//   great    ≤340ms   0.12   caught it well; a sliver gets through
//   good     ≤540ms   0.28   read it late; a quarter lands
//   miss              1.0    it lands. Not harder than it would have.
const PARRY_PERFECT_MULT = 0;
const PARRY_GREAT_MULT = 0.22;
const PARRY_MISS_MULT = 1.0;
// ── COMBAT TENSION (the Clair-Obscur dial) ──────────────────────────────────
// Defense is where the game is HARD: every blow is a string you must read and
// execute, the timing bands are tight, and even a mob can hurt if you botch it.
// Three tunable levers — turn them up for more danger, down for more forgiveness.
const PARRY_GOOD_MS = 540;   // the "good" (half-mitigate) band, ms-remaining (Build 207: widened 480→540 — more reaction tolerance)
const PARRY_GREAT_MS = 340;  // the "great" band — caught it, most of the blow held (Build 303)
const PARRY_PERF_MS = 170;   // the "perfect" (full negate + riposte) band — tightened 210→170 (Build 303 — 130 was measured and wiped 3 of 3 floors), because a perfect now costs the blow entirely
// Global PACING multiplier on every parry ring's close time.  >1 = the rings
// close SLOWER, so there's more time to read and react.  Build 207: eased again
// to 1.30 (rings ~30% slower) after a second "still a touch too fast" playtest.
const PARRY_PACE = 1.30;
// ③ FIGHTS ENDED BEFORE THEY COULD HAPPEN (Build 263).
//
// Measured, two ways, independently: a common pack died in TWO turns, took ZERO
// damage off a parrying party, and filled the burst gauge to exactly 100 on the
// turn it ended. Every system this game has spent builds on needs three or four
// turns to breathe — the REACH rotates one hero a turn, a bond needs an act to
// answer, checkTriad needs THREE in-fight threads and a 2-turn fight yields one.
// Instrumented across 8 fights: TRIAD FORMED fired ZERO times, which makes the
// ceremony, the vow stages and the whole TRIAD FINALE resolver dead code in a
// normal run.
//
// The cause is drift I introduced: the party got the x1.5 break window,
// TECHNICAL, finisher poise chips, three routes to a break and the REACH, and
// mob HP never moved. This puts it back — measured at x1.35 a common pack runs 3
// turns, at x1.9 it runs 4. Splitting the difference at 2.0 -> 2.9 (x1.45).
const MOB_HP_BASE   = 2.9;   // non-boss HP curve base — see the note above; the party's damage grew across ~10 builds and this did not

// Each intent carries a rhythm PATTERN — its own way to be turned aside — so
// defense has Project-Diva variety: a clean tap, a quick double-tap flurry, a
// braced HOLD for heavy blows, or a SWIPE to sweep away a wide attack.  Derived
// from the intent so every enemy reads consistently; `intent.parry` can author
// an override.  A short glyph (⊙ / ⊙⊙ / ▭ / ➤) previews it on the telegraph.
function parryPatternFor(intent) {
  const d = intent.dmg || 0;
  // CLAIR-OBSCUR STRINGS — a blow is rarely one tap: you READ and EXECUTE a short
  // cascade to turn it aside, so even a mob's swing is a live gauntlet.
  if (intent.parry) {
    const p = normPattern(intent.parry);
    // Honor rich authored patterns (cascades, braces, flurries, sweeps) — but a
    // plain single TAP or a thin 2-MULTI on a REAL blow (d≥4) is promoted to a
    // short STRING, so even a basic mob attack reads as a live cascade, not a
    // one-tap formality.  Tiny jabs (d≤3) stay a single clean read (the primer).
    // A SINGLE GESTURE IS NOT A READ (Build 284). Trash mobs author one flick or
    // one brace per blow — a lone swipe, a lone hold, a thin 2-multi — so an
    // ordinary attack was over before it began while the revenant's three-note
    // cascade made a set-piece feel like a different game. Any thin pattern on a
    // blow worth reading (d>=3) grows a lead-in beat, and the AUTHORED gesture is
    // kept as the final note so the attack still reads as itself: the mourner's
    // Sorrowing Arc is still a sweep, it just takes a breath first.
    //
    // Two things stay alone on purpose. A MASH is already a flurry of inputs, and
    // an ACROSS sweep is the signature wide-attack read — one big committed arc,
    // which is the whole point of it.
    // An AUTHORED wide sweep was ONE note while the derived one (below) is three
    // — so writing a sweep down made it thinner than leaving it to the default,
    // which is backwards. A blow that reaches the whole line should be the
    // biggest read on the board, not the smallest.
    if (p.kind === 'swipe' && p.across && d >= 2) {
      return { kind: 'seq', notes: [{ t: 'swipe', arc: p.arc || 'arcAcross', across: true }, { t: 'tap' }, { t: 'tap' }] };
    }
    const thin = (p.kind === 'tap' && !p.size)
              || (p.kind === 'multi' && (p.count || 2) <= 2)
              || (p.kind === 'swipe' && !p.across)
              || (p.kind === 'hold' && !p.size);
    if (d >= 3 && thin) {
      const cap = p.kind === 'swipe' ? { t: 'swipe', arc: p.arc || 'arcR' }
                : p.kind === 'hold'  ? { t: 'hold' }
                : { t: 'swipe', arc: 'arcR' };
      return { kind: 'seq', notes: d >= 7
        ? [{ t: 'tap' }, { t: 'tap' }, cap]
        : [{ t: 'tap' }, cap] };
    }
    return p;
  }
  // Derived (un-authored) patterns follow the same shape.
  if (intent.heavy)         return { kind: 'seq', notes: [{ t: 'tap' }, { t: 'hold' }, { t: 'tap' }, { t: 'swipe', arc: 'arcU' }] };
  if (intent.row === 'all') return { kind: 'seq', notes: [{ t: 'swipe', arc: 'arcAcross' }, { t: 'tap' }, { t: 'tap' }] };
  // NOTE COUNT WAS TIED TO DAMAGE (fixed Build 284), and trash mobs correctly
  // hit for 3-5, so nearly every ordinary blow landed in the one-note bucket
  // while an elite's 8-11 bought three. Measured across the roster: ~1.2 notes
  // an attack for a mob against 3.0 for the revenant and up to 3.5 for a boss —
  // a 4x gap, which is why a trash room offered 3 parries and a set-piece
  // offered 11, and why the rhythm this game is named for only really exists in
  // big fights.
  //
  // How MANY beats a blow takes to read and how much it HURTS are different
  // questions. A small swing can still be a two-beat read; it just should not
  // cost much when you fluff it. So the floor comes up to two, and only the
  // smallest jabs stay a single clean gesture — those are the primer that
  // teaches the gesture in the first place.
  if (d <= 2)               return { kind: 'mash', count: 4 };                                            // a frenzied flurry
  if (d <= 4)               return { kind: 'seq', notes: [{ t: 'tap' }, { t: 'tap' }] };                  // a two-beat read
  if (d <= 6)               return { kind: 'seq', notes: [{ t: 'tap' }, { t: 'swipe', arc: 'arcR' }] };   // a two-hit string
  return { kind: 'seq', notes: [{ t: 'tap' }, { t: 'tap' }, { t: 'swipe', arc: 'arcL' }] };               // a heavy three-hit string
}
// legacy dir -> arc, so authored {kind:'swipe',dir:'up'} still works
function normPattern(p) {
  if (p.kind === 'swipe' && !p.arc) p = Object.assign({}, p, { arc: { left: 'arcL', right: 'arcR', up: 'arcU', down: 'arcU' }[p.dir] || 'arcR' });
  return p;
}
// A curved "deflect" sweep — you trace the arc to turn the blow aside, the way
// Project Diva slide-notes and a real parry both carve a curve.
const SWIPE_ARCS = {
  arcR: { d: 'M -42 24 Q 0 -50 42 24', glyph: '↷', ok: (dx, dy) => dx > 34 && Math.abs(dx) > Math.abs(dy) * 0.5 },
  arcL: { d: 'M 42 24 Q 0 -50 -42 24', glyph: '↶', ok: (dx, dy) => dx < -34 && Math.abs(dx) > Math.abs(dy) * 0.5 },
  arcU: { d: 'M -38 34 Q 44 6 -6 -46', glyph: '⤴', ok: (dx, dy) => dy < -34 && Math.abs(dy) > Math.abs(dx) * 0.4 },
  // a wide, shallow sweep ACROSS the party — one flick over all three heroes
  arcAcross: { d: 'M -58 6 Q 0 -30 58 6', glyph: '⟺', ok: (dx, dy) => Math.abs(dx) > 46 && Math.abs(dx) > Math.abs(dy) },
};
const PARRY_GLYPH = { tap: '⊙', multi: '⊙⊙', hold: '▭', swipe: '➤', mash: '⊙⊙⊙' };
// Derives the telegraph glyph for an enemy intent's parry pattern (seq cascades
// read as ✷N where N ramps with depth; single gestures use their kind glyph +
// size hint).  Exercised by the test suite to verify the pattern derivation.
function parryGlyph(intent) {
  const p = parryPatternFor(intent);
  if (p.kind === 'seq') return '✷' + (p.notes.length + Math.min(Math.round(1.6 * parryDepth()), 3));
  const g = p.kind === 'swipe' ? (SWIPE_ARCS[p.arc] || SWIPE_ARCS.arcR).glyph : PARRY_GLYPH[p.kind];
  return (p.size === 'big' ? '◉' : p.size === 'wide' ? '⟺' : '') + g;
}
// The VISIBLE-art rect of a figure — its container box can be much larger than
// the drawn creature (the floor boss's figure spans the whole enemy half), so
// anchoring overlays / reticles / snaps on the box lands them high-and-centre
// instead of ON the creature.  Anchor on the .fig-art svg when there is one.
// Build 225 — anchor on whatever is ACTUALLY DRAWN.  A foe promoted to a
// painted plate hides its vector (`:has(.fig-png-on) .fig-vec { display:none }`),
// and a display:none element measures 0×0 AT THE ORIGIN — so the old
// `.fig-art svg` lookup silently dragged every anchor built on this helper to
// the top-left corner of the screen for every painted foe.  Walk the
// candidates in paint order and take the first with a real box.
function figHitRect(el) {
  if (!el) return null;
  if (!el.querySelector) return el.getBoundingClientRect();
  const cands = [el.querySelector('.fig-png-on'), el.querySelector('.fig-art svg'), el.querySelector('.fig-art')];
  for (let i = 0; i < cands.length; i++) {
    if (!cands[i]) continue;
    const r = cands[i].getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return r;
  }
  return el.getBoundingClientRect();
}
// Stage-space anchor (center) of the parry UI for a given target figure.
function noteAnchor(targetEl) {
  const sr = $('#stage').getBoundingClientRect(), scale = sr.width / stageDW();
  const r = figHitRect(targetEl) || targetEl.getBoundingClientRect();
  return { x: (r.left + r.width / 2 - sr.left) / scale, y: (r.top + r.height * 0.4 - sr.top) / scale };
}
// ── ERGONOMIC INPUT ZONES (touch) ─────────────────────────────────────────
// On a phone held in landscape, DEFENSE (parry) and OFFENSE (all-out strike)
// notes used to spawn wherever the acting figure stood — so both thumbs had to
// chase taps across the ENTIRE screen, and a parry could land under the hand
// that wasn't ready for it.  We bias the tap targets into thumb-sized zones:
// parry to the LEFT (the left thumb guards), all-out strikes to the RIGHT (the
// right thumb attacks).  Detection listens on `window`, so this is purely where
// the ring is DRAWN — timing and hit-testing are unchanged.  Desktop (a mouse
// that reaches the whole board) keeps the original figure-anchored placement.
function ergoZonesOn() { return !isDesktop(); }
function ergoZone(mode) {
  const W = stageDW(), H = stageDH();
  const yc = H * 0.50, yh = H * 0.17;   // a mid band, clear of the top HUD and the hand below
  return (mode === 'strike')
    ? { cx: W * 0.78, cy: yc, x0: W * 0.63, x1: W * 0.93, y0: yc - yh, y1: yc + yh }   // offense → RIGHT
    : { cx: W * 0.20, cy: yc, x0: W * 0.06, x1: W * 0.34, y0: yc - yh, y1: yc + yh };   // defense → LEFT
}
// Single note → the zone's fixed comfortable spot (consistent, so it builds
// muscle memory instead of chasing the figure around).
function zoneAnchor(pt, mode) {
  if (!ergoZonesOn()) return pt;
  const z = ergoZone(mode); return { x: z.cx, y: z.cy };
}
// A run of notes (an arc cascade) → the same shape, remapped to fit the band.
function zonePoints(pts, mode) {
  if (!ergoZonesOn()) return pts;
  if (pts.length < 2) return pts.map(p => zoneAnchor(p, mode));
  const z = ergoZone(mode);
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
  const minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
  const mapX = x => (maxX > minX) ? z.x0 + (x - minX) / (maxX - minX) * (z.x1 - z.x0) : z.cx;
  const mapY = y => (maxY > minY) ? z.y0 + (y - minY) / (maxY - minY) * (z.y1 - z.y0) : z.cy;
  return pts.map(p => ({ x: mapX(p.x), y: mapY(p.y) }));
}
// --- the parry UI base: a ring at a STAGE coordinate (so boss notes can be
// placed anywhere along an arc, not just on the target hero) ---
function mkParryUiAt(ax, ay, innerHtml, cls) {
  const el = document.createElement('div');
  el.className = 'parry-ring ' + (cls || '');
  el.style.left = ax + 'px'; el.style.top = ay + 'px';
  el.innerHTML = innerHtml;
  $('#popup-layer').appendChild(el);
  return { el, close: () => { el.classList.add('pr-out'); setTimeout(() => el.remove(), 160); } };
}
// Immediate per-gesture RESPONSE: rating text + a burst ring at the note, a
// combo streak that escalates, and a pitch-ramped tick.  This is the rhythm
// feedback — you FEEL every tap land the instant you make it.
let _parryStreak = 0;
// FLAWLESS PARRY RIPOSTE (Clair Obscur) — reading a whole cascade PERFECTLY (every
// note perfect, not just caught) counters for damage, scaled by the string length,
// so the big 3–5-note boss cascades are the richest to nail.  Single notes don't
// riposte — the counter is the reward for a real string.
const RIPOSTE_PER_NOTE = 4;
function parryRiposteDmg(noteCount) { return (noteCount >= 2) ? noteCount * RIPOSTE_PER_NOTE : 0; }
function noteFeedback(ui, ax, ay, q) {
  const good = q === 'perfect' || q === 'great' || q === 'good';
  if (good) _parryStreak++; else _parryStreak = 0;
  ui.el.classList.add(q === 'perfect' ? 'pr-land-perfect' : q === 'great' ? 'pr-land-great' : good ? 'pr-land-good' : 'pr-land-miss');
  const layer = $('#popup-layer');
  const rate = document.createElement('div');
  rate.className = 'parry-rate ' + (q === 'perfect' ? 'prt-perfect' : q === 'great' ? 'prt-great' : good ? 'prt-good' : 'prt-miss');
  rate.style.left = ax + 'px'; rate.style.top = (ay - 4) + 'px';
  const word = q === 'perfect' ? 'PERFECT' : q === 'great' ? 'GREAT' : q === 'good' ? 'GOOD' : q === 'early' ? 'EARLY' : 'MISS';
  rate.innerHTML = word + (good && _parryStreak > 1 ? ` <em>×${_parryStreak}</em>` : '');
  layer.appendChild(rate);
  setTimeout(() => rate.remove(), 620);
  const burst = document.createElement('div');
  burst.className = 'parry-burst ' + (q === 'perfect' ? 'pb-perfect' : q === 'great' ? 'pb-great' : good ? 'pb-good' : 'pb-miss');
  burst.style.left = ax + 'px'; burst.style.top = ay + 'px';
  layer.appendChild(burst);
  setTimeout(() => burst.remove(), 440);
  // Screen-level RESPONSE to the press: a quick full-bleed flash sells the
  // impact.  (Cheap — it's a separate fading overlay, so it never forces the
  // paused/blurred battlefield behind it to re-rasterize.)
  const flash = document.createElement('div');
  flash.className = 'parry-flash ' + (q === 'perfect' ? 'pf-perfect' : q === 'great' ? 'pf-great' : good ? 'pf-good' : 'pf-miss');
  layer.appendChild(flash);
  setTimeout(() => flash.remove(), 220);
  try { if (good) SFX.parry(q === 'perfect', _parryStreak); else SFX.parryMiss(); } catch (_) {}
  haptic(q === 'perfect' ? HAP.perfect : good ? HAP.good : HAP.miss);
  comboCounter(good);
}
// A prominent Project-Diva-style COMBO counter — a big number that grows and
// pops with each linked gesture, and clears when the chain breaks.
function comboCounter(good) {
  let el = document.getElementById('parry-combo');
  if (!el) { el = document.createElement('div'); el.id = 'parry-combo'; $('#stage').appendChild(el); }
  if (good && _parryStreak >= 2) {
    el.innerHTML = `<span class="pc-num">${_parryStreak}</span><span class="pc-lbl">COMBO</span>`;
    el.classList.remove('pc-pop'); void el.offsetWidth; el.classList.add('pc-on', 'pc-pop');
    clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('pc-on'), 1500);
  } else if (!good) {
    el.classList.remove('pc-on');
  }
}
// TAP note — an APPROACH ring shrinks onto the sweet spot.  It stays dim while
// closing, then GLOWS GOLD and says "TAP!" the instant it enters the hit
// window, so the moment to press is unmistakable.  Tapping too early no longer
// WASTES the note — it nudges ("WAIT…") and keeps listening, so a single
// mistimed press is forgiven and the timing is teachable rather than punishing.
function parryTapNote(ax, ay, dur, idx, total, size) {
  return new Promise(resolve => {
    const label = total > 1 ? `${idx}/${total}` : (size === 'big' ? 'SLAM' : 'TAP');
    const ui = mkParryUiAt(ax, ay, `<span class="pr-target"></span><span class="pr-close"></span><span class="pr-lbl">${label}</span>`, size === 'big' ? 'pr-big' : '');
    ui.el.querySelector('.pr-close').style.animationDuration = dur + 'ms';
    const lbl = ui.el.querySelector('.pr-lbl');
    const GOOD = Math.round(PARRY_GOOD_MS * _parryWin), GREAT = Math.round(PARRY_GREAT_MS * _parryWin), PERF = Math.round(PARRY_PERF_MS * _parryWin);   // windows (tighten with depth)
    let done = false; const t0 = Date.now();
    // light the note up the moment it becomes tappable — "wait for the glow" — and
    // DILATE time (Clair Obscur slow-mo) so the instant to parry lands with weight
    const liveT = setTimeout(() => { if (!done) { ui.el.classList.add('pr-live'); lbl.textContent = size === 'big' ? 'SLAM!' : 'TAP!'; parrySlowmo(true); } }, Math.max(0, dur - GOOD));
    const finish = (q) => { if (done) return; done = true; clearTimeout(liveT); if (ui.el.classList.contains('pr-live')) parrySlowmo(false); window.removeEventListener('pointerdown', onTap, true); noteFeedback(ui, ax, ay, q); ui.close(); resolve(q); };
    const onTap = () => {
      const rem = dur - (Date.now() - t0);
      if (rem > GOOD) { parryEarlyNudge(ui, ax, ay); return; }   // too soon — forgive, keep listening
      finish(rem <= PERF ? 'perfect' : rem <= GREAT ? 'great' : 'good');
    };
    window.addEventListener('pointerdown', onTap, true);
    setTimeout(() => finish('miss'), dur);
  });
}
// Premature press: a quick "WAIT…" nudge on the note that does NOT consume it.
function parryEarlyNudge(ui, ax, ay) {
  ui.el.classList.remove('pr-earlybump'); void ui.el.offsetWidth; ui.el.classList.add('pr-earlybump');
  const tag = document.createElement('div');
  tag.className = 'parry-rate prt-early';
  tag.style.left = ax + 'px'; tag.style.top = (ay - 4) + 'px';
  tag.textContent = 'WAIT…';
  $('#popup-layer').appendChild(tag);
  setTimeout(() => tag.remove(), 400);
  try { haptic(HAP.tap); } catch (_) {}
}
// ── BOSS TRICK NOTES (Build 211, Phase 2) — the anti-metronome vocabulary.
// FEINT: the ring HESITATES mid-close (a broken rhythm), then snaps shut —
// punishes autopilot tapping, rewards actually watching the ring.  BAIT: a
// crossed red ring you must NOT touch; discipline is the parry.  Boss-only, so
// mobs stay the readable on-ramp.  Both expose their timing to the auto-driver
// (data-pause / class) so the harness stays honest.
function parryFeintNote(ax, ay, dur, idx, total) {
  return new Promise(resolve => {
    const pause = 320;                                       // the held breath
    const label = total > 1 ? `${idx}/${total}` : 'FEINT…';
    const ui = mkParryUiAt(ax, ay, `<span class="pr-target"></span><span class="pr-close"></span><span class="pr-lbl">${label}</span>`, 'pr-feint');
    const cl = ui.el.querySelector('.pr-close');
    cl.style.animationDuration = dur + 'ms';
    ui.el.dataset.pause = pause;                             // the harness reads the true close time
    const lbl = ui.el.querySelector('.pr-lbl');
    const GOOD = Math.round(PARRY_GOOD_MS * _parryWin), GREAT = Math.round(PARRY_GREAT_MS * _parryWin), PERF = Math.round(PARRY_PERF_MS * _parryWin);
    const totalMs = dur + pause;
    let done = false; const t0 = Date.now();
    const pT = setTimeout(() => { if (done) return; cl.style.animationPlayState = 'paused'; ui.el.classList.add('pr-hesitate'); lbl.textContent = '…'; }, Math.round(dur * 0.62));
    const rT = setTimeout(() => { if (done) return; cl.style.animationPlayState = 'running'; ui.el.classList.remove('pr-hesitate'); }, Math.round(dur * 0.62) + pause);
    const liveT = setTimeout(() => { if (!done) { ui.el.classList.add('pr-live'); lbl.textContent = 'NOW!'; parrySlowmo(true); } }, Math.max(0, totalMs - GOOD));
    const finish = (q) => { if (done) return; done = true; [pT, rT, liveT].forEach(clearTimeout); if (ui.el.classList.contains('pr-live')) parrySlowmo(false); window.removeEventListener('pointerdown', onTap, true); noteFeedback(ui, ax, ay, q); ui.close(); resolve(q); };
    const onTap = () => {
      const rem = totalMs - (Date.now() - t0);
      if (rem > GOOD) { parryEarlyNudge(ui, ax, ay); return; }   // fooled by the hesitation — forgiven, keep listening
      finish(rem <= PERF ? 'perfect' : rem <= GREAT ? 'great' : 'good');
    };
    window.addEventListener('pointerdown', onTap, true);
    setTimeout(() => finish('miss'), totalMs);
  });
}
function parryBaitNote(ax, ay, dur) {
  return new Promise(resolve => {
    const ui = mkParryUiAt(ax, ay, `<span class="pr-target"></span><span class="pr-close"></span><span class="pr-lbl">DON’T!</span>`, 'pr-bait pr-live');
    ui.el.querySelector('.pr-close').style.animationDuration = dur + 'ms';
    let done = false;
    const finish = (q) => { if (done) return; done = true; window.removeEventListener('pointerdown', onTap, true); noteFeedback(ui, ax, ay, q); ui.close(); resolve(q); };
    const onTap = () => finish('miss');                        // took the bait — that share of the blow lands
    window.addEventListener('pointerdown', onTap, true);
    setTimeout(() => finish('perfect'), dur);                  // discipline IS the parry
  });
}
// First-few-parries coach — a short caption teaching each gesture.  Budgeted
// PER GESTURE (tap / hold / swipe / mash) so meeting a HOLD or SWIPE for the first
// time still teaches it, even after you've seen the TAP lesson thrice.  Each
// gesture shows at most twice, then never nags a veteran again.
// ─────────────────────────────────────────────────────────────────────────────
// LESSONS (Build 255) — teach the game we actually SHIP.
//
// The audit's most damning finding: the tutorial runs CLASSIC combat while every
// descent fight runs BRANCHING ROTATIONS, so a player is taught one card engine
// and handed another without a word. Three of that engine's rules were written
// down nowhere at all — not in the tutorial, not in HOW TO PLAY, not on a card:
// finishers cost EP while combo steps are free; moving mid-chain DESTROYS the
// chain; taking one fork BURNS the other. A rule you are never told is not
// depth, it is a trap, and it is most of why the hand felt like something to
// spam rather than something to solve.
// The banner itself. Everything that teaches shares this and nothing else.
function showCoach(msg) {
  let el = document.getElementById('parry-coach');
  if (!el) { el = document.createElement('div'); el.id = 'parry-coach'; $('#stage').appendChild(el); }
  el.textContent = msg;
  el.classList.remove('pc-hide'); void el.offsetWidth; el.classList.add('pc-show');
  clearTimeout(el._t); el._t = setTimeout(() => { el.classList.remove('pc-show'); }, 2800);
}
// ── EVERY RULES LESSON WAS SILENTLY DISCARDED (fixed Build 262) ──
//
// lesson() delegated to parryCoach, which buckets a message by gesture keyword —
// HOLD / SWIPE / MASH, else 'tap' — and hard-returns after two uses of that
// bucket. None of the rules lessons contain those words, so every one of them
// landed in the 'tap' bucket, which the PARRY coach exhausts in tutorial fights
// one and two. From fight three onward every rule this game tried to teach was
// dropped on the floor — while lesson() returned true and recorded itself as
// taught, so it never retried either.
//
// Dead this whole time: fincost, purge, fork (the three rotation rules the
// comment above calls traps), bond, technical, primed, resonance. Build 255
// shipped a teaching layer that never once rendered.
//
// lesson() owns its own throttle and its own display now; parryCoach stays a
// gesture-throttled wrapper over the same banner.
function lesson(key, msg, times) {
  const k = 'kizuna2_2.lesson_' + key;
  let seen = 0;
  try { seen = parseInt(localStorage.getItem(k) || '0', 10) || 0; } catch (_) {}
  if (seen >= (times || 2)) return false;
  try { localStorage.setItem(k, String(seen + 1)); } catch (_) {}
  showCoach(msg);
  return true;
}
function parryCoach(msg) {
  const kind = /HOLD/.test(msg) ? 'hold' : /SWIPE/.test(msg) ? 'swipe' : /MASH/.test(msg) ? 'mash' : 'tap';
  const key = 'kizuna2_2.parryLesson_' + kind;
  let n = 0;
  try { n = parseInt(localStorage.getItem(key) || '0', 10) || 0; } catch (_) {}
  if (n >= 2) return;
  try { localStorage.setItem(key, String(n + 1)); } catch (_) {}
  showCoach(msg);
}
// Non-linear rhythm for multi/seq runs: notes carry GROOVE, not an even
// metronome.  Durations stay in the reactive-friendly band while VARYING, and
// the GAPS between notes syncopate (a beat, then a quick pair, an off-beat
// pause).  The first note is the accented downbeat (a touch slower/wider).
function parryRhythm(count) {
  const T = {
    1: [{ d: 700, g: 0 }],
    2: [{ d: 620, g: 150 }, { d: 440, g: 0 }],
    3: [{ d: 620, g: 120 }, { d: 440, g: 70 }, { d: 440, g: 0 }],
    4: [{ d: 600, g: 110 }, { d: 440, g: 230 }, { d: 440, g: 90 }, { d: 420, g: 0 }],
    5: [{ d: 600, g: 100 }, { d: 440, g: 80 }, { d: 440, g: 220 }, { d: 460, g: 90 }, { d: 420, g: 0 }],
  };
  const rows = T[count] || Array.from({ length: count }, (_, i) => ({ d: i === 0 ? 600 : 440, g: i === count - 1 ? 0 : 110 }));
  return rows.map(r => ({ d: Math.round(r.d * PARRY_PACE), g: r.g }));   // Build 206: rings close slower
}
// A boss CASCADE reads differently from a mob's quick double-tap: it's a longer
// chain you have to stay with, so it wants a STEADY, readable groove rather than
// syncopation.  An accented (slower, wider) downbeat announces the run, then even
// beats with a consistent gap — every note catchable, the rhythm never a trick.
const SEQ_LEADIN = 460;   // beat of quiet after the telegraph draws, before note 1
// A per-attack TEMPO scalar (<1 = faster / more frantic).  Set from the current
// foe's def.parrySpeed each strike (the mega boss's later stages crank it up), so
// the same cascade reads calmer or more intense without new note data.
let _parrySpeed = 1;
// RHYTHM RAMP — parries START gentle (the on-ramp) and escalate like a rhythm
// game as you DESCEND: cascades quicken, the tap windows tighten, and extra notes
// stack onto every string.  Set per strike from the foe's base tempo × run depth.
let _parryWin = 1;      // tap-window multiplier (<1 = tighter/harder)
let _parryBonus = 0;    // extra notes appended to a cascade
let _parryBoss = false; // the striker is a BOSS — its cascades may FEINT and BAIT (Build 211)
function parryDepth() {
  const d = (typeof RUN !== 'undefined' && RUN && Array.isArray(RUN.completed)) ? RUN.completed.length : 0;
  return Math.max(0, Math.min(1, d / 12));   // 0 at the surface → 1 by ~floor's end
}
function setParryDifficulty(e) {
  const base = (e && e.def && e.def.parrySpeed) || 1;
  const d = parryDepth();
  _parryBoss = !!(e && e.def && e.def.boss);   // bosses earn the trick vocabulary (feint/bait)
  _parrySpeed = base * (1 - 0.16 * d);   // Build 206: up to 16% faster deep (was 24% — gentler ramp)
  _parryWin   = 1 - 0.20 * d;            // Build 206: up to 20% tighter deep (was 30%)
  _parryBonus = Math.round(1.6 * d);     // +0 → +2 extra notes on cascades deep
  // ROAD BOSSES weaponize DENSITY, not HP: their cascades run a bit LONGER (+1
  // note) and a touch FASTER — a real parry gauntlet, but not a wall.  The floor-4
  // CHORUS (megaBoss) is dialed in already — left untouched.
  if (e && e.def && e.def.boss && !e.def.megaBoss) {
    _parryBonus += 1;        // one extra note on every road-boss cascade
    _parrySpeed *= 0.92;     // ~8% quicker pacing
  }
}
function seqRhythm(count) {
  const out = [];
  for (let i = 0; i < count; i++) out.push({ d: Math.round((i === 0 ? 660 : 560) * _parrySpeed * PARRY_PACE), g: i === count - 1 ? 0 : Math.round(160 * _parrySpeed) });
  return out;
}
// MASH note — a frenzied flurry: tap rapidly to fill the meter before it closes.
function parryMashNote(ax, ay, count, dur) {
  return new Promise(resolve => {
    const ui = mkParryUiAt(ax, ay, `<span class="pr-target"></span><span class="pr-close"></span><span class="pr-mash"><span class="pr-mash-fill"></span></span><span class="pr-lbl">MASH!</span>`, 'parry-mash pr-big');
    ui.el.querySelector('.pr-close').style.animationDuration = dur + 'ms';
    const fill = ui.el.querySelector('.pr-mash-fill');
    let done = false, taps = 0;
    const finish = (q) => { if (done) return; done = true; window.removeEventListener('pointerdown', onTap, true); noteFeedback(ui, ax, ay, q); ui.close(); resolve(q); };
    const onTap = () => {
      taps++; if (fill) fill.style.width = Math.min(100, (taps / count) * 100) + '%';
      haptic(HAP.tap);
      if (taps >= count) finish('perfect');
    };
    window.addEventListener('pointerdown', onTap, true);
    setTimeout(() => finish(taps >= Math.ceil(count / 2) ? 'good' : 'miss'), dur);
  });
}
// HOLD note — press and BRACE; keep held until the bar fills (through impact).
function parryHoldNote(ax, ay, dur, size) {
  return new Promise(resolve => {
    const ui = mkParryUiAt(ax, ay, `<span class="pr-hold-track"><span class="pr-hold-fill"></span></span><span class="pr-lbl">BRACE</span>`, 'parry-hold' + (size === 'big' ? ' pr-big' : ''));
    ui.el.querySelector('.pr-hold-fill').style.animationDuration = dur + 'ms';
    let done = false, holding = false, everHeld = false;
    const finish = (q) => { if (done) return; done = true; window.removeEventListener('pointerdown', onDown, true); window.removeEventListener('pointerup', onUp, true); noteFeedback(ui, ax, ay, q); ui.close(); resolve(q); };
    const onDown = () => { if (!everHeld) { try { SFX.brace(); } catch (_) {} haptic(HAP.press); } holding = true; everHeld = true; ui.el.classList.add('pr-pressed'); };
    const onUp = () => { holding = false; ui.el.classList.remove('pr-pressed'); };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointerup', onUp, true);
    setTimeout(() => finish(holding ? 'perfect' : everHeld ? 'good' : 'miss'), dur);
  });
}
// DEFLECT note — trace the curved arc to sweep the blow aside (a real parry
// carves a curve; so do Project-Diva slide notes).  Detection is forgiving: a
// sweep whose net direction matches the arc counts, so tracing OR flicking works.
function parrySwipeNote(ax, ay, arc, dur, size) {
  return new Promise(resolve => {
    const spec = SWIPE_ARCS[arc] || SWIPE_ARCS.arcR;
    const wide = size === 'wide';
    const ui = mkParryUiAt(ax, ay,
      `<svg class="pr-arc-svg" viewBox="-60 -60 120 120">
         <path class="pr-arc-path" d="${spec.d}"/>
         <path class="pr-arc-draw" d="${spec.d}"/>
         <circle class="pr-arc-dot" r="5"><animateMotion dur="${dur}ms" repeatCount="1" fill="freeze" path="${spec.d}"/></circle>
       </svg><span class="pr-lbl">${wide ? 'SWEEP' : 'DEFLECT'} ${spec.glyph}</span>`, 'parry-swipe' + (wide ? ' pr-wide' : ''));
    ui.el.querySelector('.pr-arc-draw').style.animationDuration = dur + 'ms';
    let done = false, sx = null, sy = null, maxHit = null; const t0 = Date.now();
    const finish = (q) => { if (done) return; done = true; window.removeEventListener('pointerdown', onDown, true); window.removeEventListener('pointermove', onMove, true); window.removeEventListener('pointerup', onUp, true); noteFeedback(ui, ax, ay, q); ui.close(); resolve(q); };
    const onDown = (e) => { sx = e.clientX; sy = e.clientY; };
    const onMove = (e) => {
      if (sx == null || maxHit) return;
      if (spec.ok(e.clientX - sx, e.clientY - sy)) { maxHit = true; try { SFX.swoosh(); } catch (_) {} haptic(HAP.swipe); const rem = dur - (Date.now() - t0); finish(rem <= 250 ? 'perfect' : 'good'); }
    };
    const onUp = () => { sx = null; };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
    setTimeout(() => finish('miss'), dur);
  });
}
// Place N notes along a bowed arc sweeping from the boss toward the target —
// the "bullet-hell for parries" cascade the floor boss unleashes.
function arcPoints(n, anchor) {
  const x0 = 540, y0 = 96;                                   // near the boss
  const x1 = anchor.x, y1 = Math.max(70, anchor.y - 24);     // toward the hero
  const cx = (x0 + x1) / 2, cy = Math.min(y0, y1) - 66;      // bow up
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const u = 1 - t;
    pts.push({ x: u * u * x0 + 2 * u * t * cx + t * t * x1, y: u * u * y0 + 2 * u * t * cy + t * t * y1 });
  }
  return pts;
}
// A faint telegraph of the whole cascade — the arc and every note position —
// so the incoming sequence reads as "a series along an arc" before it starts.
function mkSeqPreview(pts) {
  const dots = pts.map((p, i) => `<circle cx="${p.x}" cy="${p.y}" r="9" class="sq-dot"/><text x="${p.x}" y="${p.y + 3.5}" class="sq-num">${i + 1}</text>`).join('');
  const d = 'M ' + pts.map(p => `${p.x} ${p.y}`).join(' L ');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'seq-preview');
  svg.setAttribute('viewBox', '0 0 ' + stageDW() + ' ' + stageDH());   // design canvas (larger on desktop)
  svg.innerHTML = `<path d="${d}" class="sq-line"/>${dots}`;
  $('#stage').appendChild(svg);
  return svg;
}
// SEQUENCE — a chain of mixed notes (taps along an arc, a hold, a deflect).
// Every note must land to fully turn the attack aside; partial → BLOCK.
async function runParrySeq(notes, anchor, art) {
  // RHYTHM RAMP — deeper foes stack extra taps onto the string (capped so an
  // authored cascade stays readable).  Mobs never exceed +2 from depth; ROAD
  // BOSSES reach +4 (via the boss branch of setParryDifficulty), so the cap of 4
  // only lets a boss's denser gauntlet through.
  if (_parryBonus > 0) {
    notes = notes.concat(Array.from({ length: Math.min(_parryBonus, 4) }, () => ({ t: 'tap' })));
  }
  // BOSS TRICKS (Build 211) — the anti-metronome pass: on a boss cascade of 3+,
  // one middle tap becomes a FEINT (the ring hesitates), and deep in the run a
  // BAIT slips in before the last note (a ring you must NOT touch).  Mobs never
  // trick — they stay the honest on-ramp.
  let tricks = false;
  if (_parryBoss && notes.length >= 3) {
    const mid = Math.floor(notes.length / 2);
    if (notes[mid] && notes[mid].t === 'tap') { notes[mid] = { t: 'feint' }; tricks = true; }
    if (parryDepth() >= 0.4) { notes.splice(notes.length - 1, 0, { t: 'bait' }); tricks = true; }
  }
  const pts = zonePoints(arcPoints(notes.length, anchor), 'parry');   // bias the cascade into the LEFT thumb zone (touch)
  const preview = mkSeqPreview(pts);
  const rh = seqRhythm(notes.length);   // fallback groove when no music is playing
  // BEAT SYNC — if the combat theme is playing, land each note ON the beat grid,
  // re-anchored to the track's live position (so it stays locked even if the tempo
  // read is a hair off).  Dense/fast cascades ride HALF-beats; steady ones whole
  // beats.  With music off, fall back to the free-running groove.  A cascade that
  // TRICKS (feint/bait) leaves the grid — a broken rhythm is the whole point.
  const clock = MUSIC.beat();
  const synced = clock.playing && !tricks;
  // ONE note per beat is the readable default — a steady march that reads as
  // "on the music."  Only the genuine CLIMAX (the Hollow Chorus's later stages,
  // ~0.5–0.6) runs double-time on HALF-beats; road bosses and mobs stay on whole
  // beats so the first boss never feels frantic.
  const sub = synced ? (_parrySpeed < 0.66 ? clock.beatSec / 2 : clock.beatSec) : 0;   // seconds per note
  let land = synced ? clock.nextGrid(0.6, sub) : 0;   // note 0 lands on the next beat ~0.6s out
  // Free-run lead-in — but a wind-up tell IS a lead-in, and playing both stacks
  // two telegraphs of the same blow back to back.  When the creature just posed,
  // take only the short breath needed to read the ring preview (Build 243).
  const told = !!(S && S._justTold); if (S) S._justTold = false;
  if (!synced) await sleep(Math.round((told ? 170 : SEQ_LEADIN) * _parrySpeed));
  let hits = 0, perfects = 0;
  for (let i = 0; i < notes.length; i++) {
    const nt = notes[i], p = pts[i], step = rh[i] || { d: 560, g: 160 };
    let dur = null;   // ms until this note's ring CLOSES (on the beat, when synced)
    if (synced) {
      const spawnAt = land - sub;                                  // this note occupies one sub-interval
      const waitMs = Math.max(0, (spawnAt - clock.now()) * 1000);  // hold until it should appear
      if (waitMs > 4) await sleep(waitMs);
      dur = Math.max(200, Math.round((land - clock.now()) * 1000));   // close exactly on the beat
    }
    const done = preview.querySelectorAll('.sq-dot')[i]; if (done) done.classList.add('sq-active');
    let q;
    if (nt.t === 'hold')       q = await parryHoldNote(p.x, p.y, synced ? Math.max(480, dur) : 820);
    else if (nt.t === 'swipe') q = await parrySwipeNote(p.x, p.y, nt.arc || 'arcR', synced ? Math.max(420, dur) : 760);
    else if (nt.t === 'feint') q = await parryFeintNote(p.x, p.y, step.d, i + 1, notes.length);
    else if (nt.t === 'bait')  q = await parryBaitNote(p.x, p.y, Math.round(700 * _parrySpeed));
    else                       q = await parryTapNote(p.x, p.y, synced ? dur : step.d, i + 1, notes.length);
    const okNote = q === 'perfect' || q === 'good';
    if (art) bossAttackBeat(art, p.x, p.y, okNote);   // the blade STRIKES on the beat — clash if parried, connects if not
    if (done) { done.classList.remove('sq-active'); done.classList.add(okNote ? 'sq-hit' : 'sq-miss'); }
    // WEIGHTED, not counted. A note is not caught-or-not: a perfect turns its
    // whole share, a great turns most of it, a late-but-read one turns half.
    // Counting hits equally is what made "all caught" and "all perfect" the same
    // outcome, which cannot stand now that a perfect negates the blow entirely.
    hits += q === 'perfect' ? 1 : q === 'great' ? 0.88 : q === 'good' ? 0.72 : 0;
    if (q === 'perfect') perfects++;
    parryCam(i, notes.length, q);            // the shot tightens and dutches with the string
    if (synced) land += sub;                 // next note, next grid point
    else if (step.g) await sleep(step.g);    // free-run gap
  }
  preview.remove();
  // PARTIAL: each note you turned aside negates its share; the ones you missed
  // still land.  mit = fraction parried; perfect = caught them all; FLAWLESS =
  // every note read PERFECTLY (the Clair Obscur counter — ripostes, see enemyPhase).
  // `perfect` gates the FULL negate, so it means every note read perfectly — not
  // every note simply caught. Before Build 303 those were the same thing.
  return { mit: hits / notes.length, perfect: perfects === notes.length && notes.length > 0,
    flawless: perfects === notes.length && notes.length > 0, notes: notes.length };
}
// Run a pattern; returns { mit (0..1 damage negated), perfect } | null if off.
// While a parry is live the world behind the notes desaturates, blurs and
// dims (`parry-focus`) so the reactive gesture is the only thing in focus —
// the notes/ratings live in #popup-layer, above the filter, and stay crisp.
// WIND-UP TELL (Build 211) — before any cascade's rings appear, the CREATURE
// itself telegraphs the coming gesture: a 460ms pose keyed to the pattern's
// first verb (brace / sweep / flurry / slash).  Reading the enemy's body — not
// just the UI — is the Expedition 33 fantasy, delivered in cheap CSS.
async function windupTell(e, intent) {
  if (S) S._justTold = false;   // only a tell that actually PLAYS may eat the lead-in
  try {
    const fig = figEl(e.uid); if (!fig) return;
    const p = parryPatternFor(intent);
    const first = p.kind === 'seq' ? ((p.notes[0] || {}).t || 'tap') : p.kind;
    const pose = first === 'hold' ? 'fw-brace' : first === 'swipe' ? 'fw-sweep' : first === 'mash' ? 'fw-flurry' : 'fw-slash';
    fig.classList.add('fig-windup', pose);
    foeAnimState(e.uid, 'prep');
    // THE TWO-SHOT — compose the CONFRONTATION, not the creature alone: the
    // attacker winding up AND the hero who has to answer it, framed together
    // and dutched off true. That composition is the whole reason a Clair
    // Obscur block reads as cinema instead of a QTE prompt.
    const def = (typeof heroInRow === 'function' && intent && intent.row) ? heroInRow(intent.row) : null;
    const subjects = [fig, def && figEl(def.id)].filter(Boolean);
    camFocus(subjects, { z: 1.085, dz: 88, yaw: -2.8, pitch: 1.4, r: -1.0, pull: 0.4, ms: 400 });
    // First time this creature shows you this gesture, hold the pose long enough
    // to LEARN it.  Once you know what a wraith's flurry looks like, the pose is
    // a cue, not a lesson.  And tell the cascade a telegraph just played so it
    // doesn't stack a second lead-in on top of this one (Build 243).
    await sleep(tempo('windup:' + (e.def && e.def.id) + ':' + (intent && intent.name), 460, 270));
    if (S) S._justTold = true;
    fig.classList.remove('fig-windup', pose);
  } catch (_) {}
}
async function runParry(targetEl, pattern, art) {
  if (!PARRY_ENABLED || !targetEl) { await sleep(380); return null; }
  const stage = $('#stage');
  stage.classList.add('parry-focus');
  // The rhythm window owns the frame against INCIDENTAL moves (a stray damage
  // punch mid-cascade would be chaos). parryCam's deliberate beats pass
  // force:true, so the string still gets its own escalating camera.
  camHold(true);
  try {
    return await runParryInner(targetEl, pattern, art);
  } finally {
    stage.classList.remove('parry-focus');
    _slowmoRef = 0; stage.classList.remove('parry-slowmo');   // never leak the dilation past a parry
    camHold(false);
  }
}
async function runParryInner(targetEl, pattern, art) {
  let a = noteAnchor(targetEl);
  // RHYTHM RAMP — deep foes make multi/mash strings denser (extra beats); a lone
  // TAP stays a single, clean read.  (Cascades ramp in runParrySeq.)
  if (_parryBonus > 0 && (pattern.kind === 'multi' || pattern.kind === 'mash')) {
    pattern = Object.assign({}, pattern, { count: (pattern.count || 2) + _parryBonus });
  }
  const k = pattern.kind, sz = pattern.size || '';
  // An across-sweep parries a WHOLE-PARTY blow — center it over the party line.
  if (pattern.across) {
    const figs = livingHeroes().map(h => figEl(h.id)).filter(Boolean);
    if (figs.length) {
      const sr = $('#stage').getBoundingClientRect(), s = sr.width / stageDW();
      let sx = 0, sy = 0;
      figs.forEach(f => { const r = f.getBoundingClientRect(); sx += (r.left + r.width / 2 - sr.left) / s; sy += (r.top + r.height * 0.4 - sr.top) / s; });
      a = { x: sx / figs.length, y: sy / figs.length };
    }
  }
  // first-encounter coaching is gesture-SPECIFIC, so a hold / swipe / mash isn't
  // met with "then TAP" — each gesture teaches its own read.
  if (k === 'hold')       parryCoach('When the ring glows gold — HOLD and brace');
  else if (k === 'swipe') parryCoach('When the ring glows gold — SWIPE the way the arrow points');
  else if (k === 'mash')  parryCoach('When the ring glows gold — MASH fast to break it');
  else                    parryCoach('Wait for the ring to glow gold — then TAP');
  if (k === 'seq')   return await runParrySeq(pattern.notes, a, art);   // (zonePoints biases the cascade inside)
  // Single-figure parries snap to the LEFT thumb zone (touch) so a lone tap /
  // hold / swipe never lands under the wrong hand.
  a = zoneAnchor(a, 'parry');
  // multi is a mini-cascade — partial mitigation too (miss a tap, take its
  // share).  Notes vary in SPEED (a slower downbeat, then a snappier one) but
  // stay CONTIGUOUS — a quick double-tap, no dead gap between them.
  if (k === 'multi') {
    const rh = parryRhythm(pattern.count);
    let hits = 0, perfects = 0;
    for (let i = 0; i < pattern.count; i++) {
      const step = rh[i] || { d: 480 };
      const q = await parryTapNote(a.x, a.y, step.d, i + 1, pattern.count, sz);
      const okNote = q === 'perfect' || q === 'good';
      if (art) bossAttackBeat(art, a.x, a.y, okNote);   // strike on each note's beat
      if (okNote) hits++;
      if (q === 'perfect') perfects++;
      parryCam(i, pattern.count, q);
    }
    return { mit: hits / pattern.count, perfect: hits === pattern.count, flawless: perfects === pattern.count && pattern.count > 0, notes: pattern.count };
  }
  let q;
  if (k === 'hold')       q = await parryHoldNote(a.x, a.y, Math.round(900 * PARRY_PACE), sz);
  else if (k === 'swipe') q = await parrySwipeNote(a.x, a.y, pattern.arc, Math.round(860 * PARRY_PACE), sz);
  else if (k === 'mash')  q = await parryMashNote(a.x, a.y, pattern.count || 4, Math.round(1150 * PARRY_PACE));
  else                    q = await parryTapNote(a.x, a.y, Math.min(Math.round(700 * PARRY_PACE), PARRY_GOOD_MS + 280), 1, 1, sz);   // Build 207: slow the lone tap too (early foes use single taps), capped so the test auto-parry still lands in-window
  const ok1 = q === 'perfect' || q === 'good';
  if (art) bossAttackBeat(art, a.x, a.y, ok1);   // the single strike lands as the note resolves
  parryCam(0, 1, q);                             // a lone read still snaps
  return { mit: q === 'perfect' ? 1 : q === 'great' ? 0.88 : q === 'good' ? 0.72 : 0, perfect: q === 'perfect', flawless: q === 'perfect', notes: 1 };
}
function parryFlash(el) {
  if (!el) return;
  el.classList.remove('fig-parry'); void el.offsetWidth; el.classList.add('fig-parry');
  setTimeout(() => el && el.classList.remove('fig-parry'), 500);
}

// ─────────────────────────────────────────────────────────────────────────────
// BONDS SAY WHY (Build 256).
//
// Six code paths form a bond and every one of them funnels through here, but
// only one of them ever used the word.  Focus-firing a foe with a second hero
// announced "⚡ ASSIST +2" — a MOMENTUM callout. Killing something that had hurt
// an ally announced "⚔ AVENGED" and was documented nowhere at all. A party-wide
// heal bonded the caster to everyone and said nothing, and the ♡ card hint
// explicitly refused to mark it.
//
// So bonds were not hard to trigger — they were impossible to trigger KNOWINGLY.
// Three unlabelled paths fired constantly during ordinary play, the triangle
// filled itself in, and the player never built a causal model. Every path now
// names the act that caused it, in the same words, every time.
async function addThread(a, b, why) {
  recordDeed(a, b, why);   // the quiet ledger (Build 266)
  const key = pairKey(a, b);
  // A KINDLED pair (thread pre-formed at fight start) awakens its DUET on the
  // FIRST act of help this fight — the "kindled bond + a shared act" trigger.
  if (S.threads.has(key)) { await awakenDuet(a, b); await checkTriad(a); return; }
  S.threads.add(key);
  sparkThread(a, b);       // a single arc of connection, then it fades
  renderResonance();       // update the RESONANCE badge (edge lights up)
  SFX.thread();
  // If this newly-threaded pair is ALREADY kindled from earlier fights, this
  // very act awakens their duet — and it stands in for the generic Echo Bond.
  const kindledNow = bondPts(key) >= BOND_KINDLED;
  // A KINDLED pair that threads awakens its WEAVE this instant (no card — see
  // awakenDuet).  A non-kindled thread just forms the connection + its guard.
  if (kindledNow) await awakenDuet(a, b);
  else flashNarrator('♡ LIT — ' + HEROES[a].name + ' ─ ' + HEROES[b].name
    + (why ? ' · <b>' + why + '</b>' : '') + ' — light it again and the pair goes <b>✦ WOVEN</b>.');
  // The first bond of a run explains the whole loop once, at the moment the
  // player has just caused one and can connect the two.
  lesson('bond', '♡ THAT WAS A BOND — helping an ally, striking a foe together, or avenging one of your own lights two heroes for this fight. Light it again and they go ✦ WOVEN, for good. Tap the ◮ badge to see every pair.', 2);
  // a clear beat on BOTH heroes so the connection reads at a glance
  [a, b].forEach(id => { const el = figEl(id); if (el) { el.classList.remove('fig-bond'); void el.offsetWidth; el.classList.add('fig-bond'); setTimeout(() => el.classList.remove('fig-bond'), 900); } });
  // The bond itself protects: both linked heroes steel by 2 guard the moment
  // the thread forms.  Kizuna has immediate tactical weight, not just
  // triad-progress bookkeeping.
  [a, b].forEach(id => {
    const h = S.heroes.find(x => x.id === id);
    if (h && !h.downed) { h.guard += 2; popupAt(figEl(id), '♡ BOND ⛨2', 'guard'); }
  });
  // Nudge: when only one link is missing, say so — the triangle should feel
  // one decision away, not hidden.
  const live = livingHeroes();
  if (!S.triadFormed && live.length >= 3 && !S._triangleNudged) {
    const ids = live.map(h => h.id);
    let missing = 0;
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      if (!S.threads.has(pairKey(ids[i], ids[j]))) missing++;
    }
    if (missing === 1) { S._triangleNudged = true; flashNarrator('One more bond completes the triangle…'); }
  }
  await checkTriad(a);
}
// A pair counts as bonded if their thread is live THIS fight, or if they hold
// the BOND NODE they earned at a fire (Build 265).
function pairBonded(a, b) {
  return !!(S && ((S.threads && S.threads.has(pairKey(a, b))) || bondNodeHeld(a, b)));
}
// THE TRIAD WAS UNREACHABLE. It required all three pairs to be threaded INSIDE a
// single fight — and a fight yields one or two threads, so instrumented across
// eight of them it fired ZERO times. The ceremony, the vow stages and the whole
// TRIAD FINALE resolver were code no player had ever run.
//
// Owned bond nodes count now, which is the point of owning them: three pairs who
// have each sat at a fire together walk in as a triad. Nothing was added to reach
// it — the requirement stopped being something you must re-earn every fight.
async function checkTriad(closer) {
  const live = livingHeroes();
  if (live.length < 3 || S.triadFormed) return;
  const [x, y, z] = live.map(h => h.id);
  if (pairBonded(x, y) && pairBonded(y, z) && pairBonded(x, z)) {
    S.triadFormed = true;
    await triadCeremony();
  }
}

async function triadCeremony() {
  $('#stage').classList.add('frozen');
  SFX.triad();
  // A slow tilt-up onto the three of them.  This is the game's biggest story
  // beat and until Build 225 it played on a completely locked-off shot.
  cam({ z: 1.18, dz: 165, r: -1.4, y: 14, pitch: 3.2, yaw: -5.5, ms: 1400, ease: 'cubic-bezier(.28,.62,.32,1)', force: true });
  await sleep(700);
  const r = triadEntry();
  const names = livingHeroes().map(h => h.def.name).join(' · ');
  showOverlay(`
    <svg class="triad-svg" viewBox="0 0 150 130">
      <path d="M 75 12 L 138 112 L 12 112 Z"/>
    </svg>
    <div class="triad-title">TRIAD FORMED</div>
    <div class="triad-names">${names}</div>
    <div class="triad-cardname">✦ ${r.name}${vowRank(trioClassKey(livingHeroes().map(h => h.id))) > 1 ? ' ' + ROMAN[vowRank(trioClassKey(livingHeroes().map(h => h.id)))] : ''} — ${r.type}</div>
    <div class="ov-tap">your <b>ALL-OUT</b> is crowned — it now ends in a <b>TRIAD FINALE</b> · tap to continue</div>
  `, 'triad-ceremony');
  await new Promise(res => { $('#overlay').onclick = () => { $('#overlay').onclick = null; res(); }; });
  hideOverlay();
  $('#stage').classList.remove('frozen');
  camReset(900);
  S.allOutCrowned = true;   // the triad's vow now crowns the ALL-OUT (see resolveAllOut)
  expandBurst(3, '✦ TRIAD', 40);   // the triangle swells the burst gauge to its fullest (the old resonant's reward)
  renderAll();
}

// The full-screen layer the resonant cinematic paints onto (created lazily).
function cineLayer() {
  let el = document.getElementById('resonant-cine');
  if (!el) { el = document.createElement('div'); el.id = 'resonant-cine'; el.className = 'hidden'; $('#stage').appendChild(el); }
  return el;
}
// BOSS ATTACK ART — one JRPG attack BEAT per parry note, SYNCED to the cascade
// and rendered BEHIND the notes (dim, z-8) so it sells the giant blade/claw/blast
// without ever obscuring the gesture you're reading.  A 4-note claw = 4 rakes
// racing down the arc as you tap.  Purely visual, self-removing.
// The enemy strike ART, fired ON the parry beat (see runParrySeq/runParryInner):
// the blade cut lands exactly when the ring closes.  parried=true recolors it to
// a STEEL CLASH (the blow turned aside) with a lighter shake; a missed note lets
// the red hit CONNECT with a heavier shake — so the telegraph and the parry read
// as one moment.
function bossAttackBeat(kind, ax, ay, parried) {
  const fx = document.createElement('div');
  fx.className = 'boss-beat bb-' + kind + (parried ? ' bb-parried' : '');
  fx.style.setProperty('--by', (ay / stageDH() * 100) + '%');
  fx.style.setProperty('--bx', (ax / stageDW() * 100) + '%');
  $('#stage').appendChild(fx);
  stageShake(parried ? 'sm' : 'md');
  setTimeout(() => fx.remove(), 640);
}
// SLOW-MO PARRY WINDOW (Clair Obscur) — as a note enters its live window the world
// leans in and time dilates, so the instant to parry lands with weight.  Ref-counted
// so overlapping notes never clear it early; runParry force-resets it on exit.
let _slowmoRef = 0;
function parrySlowmo(on) {
  const st = document.getElementById('stage'); if (!st) return;
  if (on) { _slowmoRef++; st.classList.add('parry-slowmo'); }
  else { _slowmoRef = Math.max(0, _slowmoRef - 1); if (!_slowmoRef) st.classList.remove('parry-slowmo'); }
}
// A transient full-screen impact flash + shake — punctuates each vow stage.
function cineFlash(color) {
  const st = $('#stage');
  const f = document.createElement('div');
  f.className = 'rc-flash';
  if (color) f.style.background = `radial-gradient(ellipse at 50% 45%, ${color} 0%, transparent 70%)`;
  st.appendChild(f);
  stageShake();
  setTimeout(() => f.remove(), 420);
}
// Clears the cinematic banner layer (used at the end of the all-out finale).
function resonantCineEnd() {
  const el = cineLayer();
  el.classList.add('hidden'); el.classList.remove('rc-out'); el.innerHTML = '';
  $('#stage').classList.remove('frozen');
}
// VOW VERSE cinematic — the bonds' payoff INSIDE the all-out gets a real beat: the
// pair's portraits + vow name slam in over a bond thread (a triangle for the trio
// CROWN), the field freezes for a breath, then the vow's stages land.  Snappier
// than the pre-fight duet intro so the all-out keeps its momentum.
async function vowVerseIntro(ids, name, isCrown) {
  const el = cineLayer();
  $('#stage').classList.add('frozen');
  el.classList.remove('hidden', 'rc-out');
  const names = ids.map(id => HEROES[id].name).join(isCrown ? ' · ' : ' & ');
  const figs = ids.map(id => `<span class="vv-fig">${V2PORTRAITS[id] || ''}</span>`).join('');
  const glyph = isCrown
    ? `<svg class="rc-tri" viewBox="0 0 150 130"><path d="M 75 12 L 138 112 L 12 112 Z"/></svg>`
    : `<svg class="rc-tri rc-bond" viewBox="0 0 150 130"><line x1="30" y1="66" x2="120" y2="66"/><circle cx="30" cy="66" r="10"/><circle cx="120" cy="66" r="10"/></svg>`;
  el.innerHTML = `
    <div class="rc-wash ${isCrown ? '' : 'rc-duet'}"></div>
    <div class="rc-rays"></div>
    <div class="rc-sweep"></div>
    ${glyph}
    <div class="vv-figs">${figs}</div>
    <div class="rc-host">${names}</div>
    <div class="rc-name">✦ ${name}</div>
    <div class="rc-type">${isCrown ? 'THE CROWN' : 'THE VOW'}</div>`;
  if (SFX.triad) SFX.triad();
  cineFlash(isCrown ? 'rgba(240,212,136,0.55)' : 'rgba(240,212,136,0.4)');
  if (isCrown) { for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) sparkThread(ids[i], ids[j]); }
  else if (ids.length === 2) sparkThread(ids[0], ids[1]);
  await sleep(isCrown ? 1000 : 680);
  el.classList.add('rc-out');
  $('#stage').classList.remove('frozen');
  await sleep(160);
  el.classList.add('hidden'); el.classList.remove('rc-out'); el.innerHTML = '';
}

// STRIKE note — the OFFENSIVE mirror of the parry.  Same closing-ring timing,
// but placed ON the enemy and tinted red: tap as it lands to land the blow with
// an ACCENT.  perfect > good > (missed = a weak, glancing hit).  Reuses the
// .parry-ring plumbing (so the auto-tester can drive it) with a .pr-strike skin.
function strikeNote(targetEl, idx, total, dur, pos) {
  return new Promise(resolve => {
    const a = pos || zoneAnchor(targetEl ? noteAnchor(targetEl) : { x: 500, y: 150 }, 'strike');   // explicit arc point, else the RIGHT thumb zone
    const label = total > 1 ? `${idx}/${total}` : 'STRIKE';
    const ui = mkParryUiAt(a.x, a.y, `<span class="pr-target"></span><span class="pr-close"></span><span class="pr-lbl">${label}</span>`, 'pr-strike');
    ui.el.querySelector('.pr-close').style.animationDuration = dur + 'ms';
    const lbl = ui.el.querySelector('.pr-lbl');
    const GOOD = 580, PERF = 230;   // Build 209: wide, forgiving windows — the all-out is the payoff
    let done = false; const t0 = Date.now();
    const liveT = setTimeout(() => { if (!done) { ui.el.classList.add('pr-live'); lbl.textContent = 'STRIKE!'; } }, Math.max(0, dur - GOOD));
    const finish = (q) => { if (done) return; done = true; clearTimeout(liveT); window.removeEventListener('pointerdown', onTap, true); strikeFeedback(ui, a.x, a.y, q); ui.close(); resolve(q); };
    const onTap = () => { const rem = dur - (Date.now() - t0); if (rem > GOOD) { parryEarlyNudge(ui, a.x, a.y); return; } finish(rem <= PERF ? 'perfect' : 'good'); };
    window.addEventListener('pointerdown', onTap, true);
    setTimeout(() => finish('miss'), dur);
  });
}
// Per-strike RESPONSE — red rating word + burst; a perfect connects hard.
function strikeFeedback(ui, ax, ay, q) {
  const good = q === 'perfect' || q === 'great' || q === 'good';
  ui.el.classList.add(q === 'perfect' ? 'pr-land-perfect' : q === 'great' ? 'pr-land-great' : good ? 'pr-land-good' : 'pr-land-miss');
  const layer = $('#popup-layer');
  const rate = document.createElement('div');
  rate.className = 'parry-rate strike-rate ' + (q === 'perfect' ? 'srt-perfect' : good ? 'srt-good' : 'srt-miss');
  rate.style.left = ax + 'px'; rate.style.top = (ay - 4) + 'px';
  rate.textContent = q === 'perfect' ? 'PERFECT!' : q === 'good' ? 'HIT' : 'WEAK';
  layer.appendChild(rate); setTimeout(() => rate.remove(), 560);
  const burst = document.createElement('div');
  burst.className = 'parry-burst strike-burst ' + (q === 'perfect' ? 'pb-perfect' : good ? 'pb-good' : 'pb-miss');
  burst.style.left = ax + 'px'; burst.style.top = ay + 'px';
  layer.appendChild(burst); setTimeout(() => burst.remove(), 420);
  try { if (good) SFX.parry(q === 'perfect', 1); else SFX.parryMiss(); } catch (_) {}
  haptic(q === 'perfect' ? HAP.perfect : good ? HAP.good : HAP.miss);
}
// STRIKE SWIPE — the offensive slash: flick across the enemy along the arc.
// Same forgiving detection as the parry deflect, red-skinned, its own rating.
function strikeSwipeNote(targetEl, arc, dur, pos) {
  return new Promise(resolve => {
    const a = pos || zoneAnchor(targetEl ? noteAnchor(targetEl) : { x: 500, y: 150 }, 'strike');   // explicit arc point, else the RIGHT thumb zone
    const spec = SWIPE_ARCS[arc] || SWIPE_ARCS.arcR;
    const ui = mkParryUiAt(a.x, a.y,
      `<svg class="pr-arc-svg" viewBox="-60 -60 120 120">
         <path class="pr-arc-path" d="${spec.d}"/>
         <path class="pr-arc-draw" d="${spec.d}"/>
         <circle class="pr-arc-dot" r="5"><animateMotion dur="${dur}ms" repeatCount="1" fill="freeze" path="${spec.d}"/></circle>
       </svg><span class="pr-lbl">SLASH ${spec.glyph}</span>`, 'parry-swipe pr-strike');
    ui.el.querySelector('.pr-arc-draw').style.animationDuration = dur + 'ms';
    let done = false, sx = null, sy = null, maxHit = null; const t0 = Date.now();
    const finish = (q) => { if (done) return; done = true; window.removeEventListener('pointerdown', onDown, true); window.removeEventListener('pointermove', onMove, true); window.removeEventListener('pointerup', onUp, true); strikeFeedback(ui, a.x, a.y, q); ui.close(); resolve(q); };
    const onDown = (e) => { sx = e.clientX; sy = e.clientY; };
    const onMove = (e) => {
      if (sx == null || maxHit) return;
      if (spec.ok(e.clientX - sx, e.clientY - sy)) { maxHit = true; try { SFX.swoosh(); } catch (_) {} haptic(HAP.swipe); const rem = dur - (Date.now() - t0); finish(rem <= 260 ? 'perfect' : 'good'); }
    };
    const onUp = () => { sx = null; };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
    setTimeout(() => finish('miss'), dur);
  });
}
// STRIKE HOLD — the offensive CHARGE: press and hold through the wind-up, then
// it lands as one heavy SLAM.  A guardian's/mage's signature all-out beat.
function strikeHoldNote(targetEl, dur, pos) {
  return new Promise(resolve => {
    const a = pos || zoneAnchor(targetEl ? noteAnchor(targetEl) : { x: 500, y: 150 }, 'strike');   // explicit arc point, else the RIGHT thumb zone
    const ui = mkParryUiAt(a.x, a.y, `<span class="pr-hold-track"><span class="pr-hold-fill"></span></span><span class="pr-lbl">CHARGE</span>`, 'parry-hold pr-strike pr-big');
    ui.el.querySelector('.pr-hold-fill').style.animationDuration = dur + 'ms';
    const lbl = ui.el.querySelector('.pr-lbl');
    let done = false, holding = false, everHeld = false;
    const finish = (q) => { if (done) return; done = true; window.removeEventListener('pointerdown', onDown, true); window.removeEventListener('pointerup', onUp, true); strikeFeedback(ui, a.x, a.y, q); ui.close(); resolve(q); };
    const onDown = () => { if (!everHeld) { try { SFX.brace(); } catch (_) {} haptic(HAP.press); } holding = true; everHeld = true; ui.el.classList.add('pr-pressed'); lbl.textContent = 'SLAM!'; };
    const onUp = () => { holding = false; ui.el.classList.remove('pr-pressed'); };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointerup', onUp, true);
    setTimeout(() => finish(holding ? 'perfect' : everHeld ? 'good' : 'miss'), dur);
  });
}
// ── TRACE GESTURE — draw a shape to unleash a signature beat ───────────────
// The richest input tier: press and DRAG your finger through a shape's points.
// The TRIAD FINALE asks for a TRIANGLE — three heroes, three sides — so the
// marquee "one grand blow only your three can land" is a blow you literally
// draw.  Forgiving (a generous hit radius per vertex), always resolves on its
// timer (so the finale never stalls), and PURELY ADDITIVE: quality only ramps
// the payoff up, never below the un-traced baseline.  Detection reads pointer
// coords against the on-stage vertices, so it works with thumb OR mouse.
function traceFeedback(el, cx, cy, q) {
  const good = q === 'perfect' || q === 'great' || q === 'good';
  el.classList.add(q === 'perfect' ? 'tr-perfect' : good ? 'tr-good' : 'tr-miss');
  const layer = $('#popup-layer');
  const rate = document.createElement('div');
  rate.className = 'parry-rate strike-rate ' + (q === 'perfect' ? 'srt-perfect' : good ? 'srt-good' : 'srt-miss');
  rate.style.left = cx + 'px'; rate.style.top = cy + 'px';
  rate.textContent = q === 'perfect' ? 'PERFECT SIGIL!' : good ? 'SIGIL DRAWN' : 'BROKEN SIGIL';
  layer.appendChild(rate); setTimeout(() => rate.remove(), 720);
  try { if (good) { SFX.triad && SFX.triad(); } else SFX.parryMiss && SFX.parryMiss(); } catch (_) {}
  haptic(q === 'perfect' ? HAP.perfect : good ? HAP.good : HAP.miss);
  if (good) { cineFlash('rgba(255,220,140,0.5)'); stageShake(q === 'perfect' ? 'xl' : 'lg'); }
}
function traceNote(dur) {
  dur = dur || 2600;
  return new Promise(resolve => {
    const W = stageDW(), H = stageDH();
    const cx = W * 0.72, cy = H * 0.50, R = Math.min(W * 0.16, H * 0.24);   // a big, satisfying triangle
    const V = [                                       // point-up triangle
      { x: cx,             y: cy - R },                // top
      { x: cx + R * 0.87,  y: cy + R * 0.5 },          // bottom-right
      { x: cx - R * 0.87,  y: cy + R * 0.5 },          // bottom-left
    ];
    const order = [0, 1, 2, 0];                        // three sides — close the loop
    const el = document.createElement('div');
    el.className = 'trace-note';
    const poly = V.map(p => `${p.x},${p.y}`).join(' ');
    el.innerHTML = `
      <svg class="tr-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
        <polygon class="tr-ghost" points="${poly}"/>
        <path class="tr-draw" d=""/>
        ${V.map((p, i) => `<circle class="tr-dot" data-i="${i}" cx="${p.x}" cy="${p.y}" r="14"/>`).join('')}
      </svg>
      <div class="tr-lbl" style="left:${cx}px; top:${cy + R + 22}px;">TRACE THE △ — THREE SIDES</div>`;
    $('#popup-layer').appendChild(el);
    requestAnimationFrame(() => el.classList.add('tr-show'));
    const drawEl = el.querySelector('.tr-draw');
    const dots = el.querySelectorAll('.tr-dot');
    let step = 0, started = false, done = false, timer = null;
    const t0 = Date.now();
    const cleanup = () => { window.removeEventListener('pointerdown', onDown, true); window.removeEventListener('pointermove', onMove, true); clearTimeout(timer); };
    const finish = (q) => { if (done) return; done = true; cleanup(); traceFeedback(el, cx, cy, q); el.classList.add('tr-out'); setTimeout(() => el.remove(), 220); resolve(q); };
    const toLogical = (e) => { const sr = $('#stage').getBoundingClientRect(), s = sr.width / W; return { x: (e.clientX - sr.left) / s, y: (e.clientY - sr.top) / s }; };
    const advance = (L) => {
      const tgt = V[order[step]];
      if (Math.hypot(L.x - tgt.x, L.y - tgt.y) < R * 0.62) {   // reached the next vertex
        dots.forEach(d => { if (+d.dataset.i === order[step]) d.classList.add('tr-hit'); });
        try { SFX.follow && SFX.follow(); } catch (_) {} haptic(HAP.tap);
        step++;
        if (step >= order.length) { finish((nowMs() - t0) < dur * 0.72 ? 'perfect' : 'good'); return true; }
      }
      const segs = order.slice(0, step).map(i => `${V[i].x} ${V[i].y}`);
      if (segs.length) drawEl.setAttribute('d', 'M ' + [...segs, `${L.x} ${L.y}`].join(' L '));
      return false;
    };
    const onDown = (e) => { started = true; el.classList.add('tr-drawing'); advance(toLogical(e)); };
    const onMove = (e) => { if (started && !done) advance(toLogical(e)); };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointermove', onMove, true);
    // tests auto-complete it (mirrors the strike/parry auto-driver)
    if (window.__autoParry) { timer = setTimeout(() => finish('perfect'), 140); return; }
    timer = setTimeout(() => finish(step >= 2 ? 'good' : 'miss'), dur);   // ran out — never stalls the finale
  });
}
// The rising STREAK counter during the all-out — nailing strikes in a row ramps
// the damage multiplier, so a clean cascade reads as a building finisher.
// (Named STREAK, not CHAIN, to keep it distinct from the bond CHAIN follow-up.)
function allOutCombo(chain, q) {
  let el = document.getElementById('parry-combo');
  if (!el) { el = document.createElement('div'); el.id = 'parry-combo'; $('#stage').appendChild(el); }
  if (chain >= 2) {
    el.innerHTML = `<span class="pc-num">${chain}</span><span class="pc-lbl">STREAK</span>`;
    el.classList.remove('pc-pop'); void el.offsetWidth; el.classList.add('pc-on', 'pc-pop');
    clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('pc-on'), 1400);
  } else if (q === 'miss' || q === 'early') {
    el.classList.remove('pc-on');
  }
}

// ALL-OUT ATTACK — the momentum burst.  The whole party piles onto the enemy
// line one after another; PRIMED foes (exposed / chilled / weakened / staggered)
// take extra, so setting up before you spend the gauge pays off.
async function allOutCineIntro(heroes) {
  $('#stage').classList.add('frozen');
  const el = cineLayer();
  el.classList.remove('hidden', 'rc-out');
  el.innerHTML = `
    <div class="rc-wash allout"></div>
    <div class="rc-rays allout"></div>
    <div class="rc-sweep"></div>
    <div class="rc-host">${heroes.map(h => h.def.name).join('  ·  ')}</div>
    <div class="rc-name allout">⚔ ALL-OUT ATTACK</div>
    <div class="rc-type allout">MOMENTUM UNLEASHED</div>`;
  SFX.triad();
  cineFlash('rgba(255,120,80,0.55)');
  await sleep(1050);
  el.classList.add('rc-out');
  $('#stage').classList.remove('frozen');
  await sleep(200);
}
// The all-out is now INTERACTIVE — the reverse-parry.  As each hero piles on,
// a short cascade of STRIKE notes lands on the enemy line; tap each in time to
// accent the blow.  A running CHAIN of clean strikes ramps a damage multiplier,
// so a nailed cascade is a devastating finisher — but fumbling the timing
// deals a weak, glancing share (skill-gated: miss < a solid hit < perfect).
const ALLOUT = { base: 4, qmul: { perfect: 1.5, good: 1.0, miss: 0.6, early: 0.6 }, comboStep: 0.05, comboCap: 10 };   // Build 209: a fumbled strike still lands a solid blow (miss 0.4→0.6)
const ALLOUT_RHYTHM = [{ d: 560, g: 120 }, { d: 460, g: 80 }, { d: 440, g: 0 }];
// Each ARCHETYPE unleashes differently — the input you make expresses the class:
//   Ronin   flurries TAPS · Reaver rakes twin SWIPES · Guardian/Mage CHARGE a
//   heavy SLAM · Ranger looses an aimed shot then a raking SLASH · supports keep
//   a steady two-tap.  Fewer notes hit harder each (damage is normalised), so a
//   Guardian's single charged slam ≈ a Ronin's two quick cuts.
// ONE signature gesture per hero — the all-out is the PAYOFF, so keep the string
// short and readable (a trio = ~3 beats), not a mash.  Higher BURST adds a beat
// or two (see resolveAllOut).
const ALLOUT_CASCADE = {
  Ronin:    [{ t: 'tap' }],
  Reaver:   [{ t: 'swipe', arc: 'arcR' }],
  Guardian: [{ t: 'hold' }],
  Mage:     [{ t: 'hold' }],
  Ranger:   [{ t: 'swipe', arc: 'arcU' }],
  Cleric:   [{ t: 'tap' }],
  Bard:     [{ t: 'tap' }],
  _default: [{ t: 'tap' }],
};
function allOutCoach() {
  let n = 0;
  try { n = parseInt(localStorage.getItem('kizuna2_2.strikeLessons') || '0', 10) || 0; } catch (_) {}
  if (n >= 3) return;
  try { localStorage.setItem('kizuna2_2.strikeLessons', String(n + 1)); } catch (_) {}
  let el = document.getElementById('parry-coach');
  if (!el) { el = document.createElement('div'); el.id = 'parry-coach'; $('#stage').appendChild(el); }
  el.textContent = 'TAP each STRIKE on the enemy — chain them for more damage';
  el.classList.remove('pc-show'); void el.offsetWidth; el.classList.add('pc-show');
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('pc-show'), 2800);
}
// When a full triad has CROWNED the all-out, hold the LAST living foe at 1 HP
// through the cascade / encore / flawless so the TRIAD FINALE reliably lands the
// killing blow — the marquee "one grand blow only your three can land" always
// detonates instead of being overkilled by the build-up on normal packs.
function finaleClamp(e, dmg) {
  if (S && S.allOutCrowned && livingEnemies().length === 1 && dmg >= e.hp) { S._finaleReserved = true; return Math.max(1, e.hp - 1); }
  return dmg;
}
async function resolveAllOut() {
  S._burstResolving = true;
  S._finaleReserved = false;   // set true if the cascade held a foe back for the TRIAD FINALE
  // The all-out FIRES at whatever level the container is filled to.  Each level
  // scales every strike and adds an auto ENCORE (no extra input) — the kizuna
  // payoff.  L3 also detonates every hit and lifts the party afterward.
  const aoLevel = burstFireLevel() || 1;
  const lvlMul = [1, 1.5, 2][aoLevel - 1] || 1;
  const heroes = livingHeroes();
  // BONDS EMPOWER THE ASSAULT (FF7R-style synergy) — every woven pair lifts EVERY
  // strike of the all-out, so your deepened relationships make the WHOLE team hit
  // harder rather than piling on separate moves.  Each woven bond +25% (a felt
  // payoff), capped at 3 (+75%); EMPOWERED BOND (Ash's Kizuna branch) adds +10%
  // per bond on top (up to +105% at a full woven triad).
  const bondCount = Math.min(wovenPairKeys().length, 3);
  const bondPer = 0.25 + (hasNode('ash.chain.deep') ? 0.10 : 0);
  const bondMul = 1 + bondPer * bondCount;
  // FORTRESS (Cassia) — the party braces before the storm.
  if (hasNode('cassia.allout.fortress') && heroes.some(h => h.id === 'cassia')) {
    heroes.forEach(h => { h.guard += 5; popupAt(figEl(h.id), '⛨ +5', 'guard'); });
  }
  // CAMERA PUSH-IN — the whole diorama dollies forward as the all-out lands:
  // the far sky creeps, the battlefield closes, the near lip rushes past the
  // lens.  That differential is what reads as a camera, not a zoom.
  // The push runs UNDER the cine intro, which is a full-screen overlay moment
  // with nothing rect-anchored on the field — so by the time the cascade
  // starts placing strike notes the lens has already settled.  Then we HOLD,
  // so per-hit punches can't yank the frame out from under those notes.
  cam({ z: 1.12, dz: 120, r: 0.9, pitch: 2.2, yaw: 2.6, ms: 900, ease: 'cubic-bezier(.22,.68,.28,1)', force: true });
  await allOutCineIntro(heroes);
  $('#stage').classList.add('allout-focus');
  camHold(true);
  if (bondCount > 0) { flashNarrator('✦ BONDS ×' + bondCount + ' — the party moves as one, every blow empowered.'); cineFlash('rgba(240,212,136,0.4)'); }
  allOutCoach();
  // ── THE REVERSE-PARRY CASCADE — one flowing, TELEGRAPHED string of strikes that
  // SWEEPS the enemy line and QUICKENS to a climax (the offensive mirror of a parry
  // cascade).  Each hero's archetype gesture takes its turn in the run; a higher
  // BURST level appends a shared FLURRY, so a woven L3 unleash is a longer, faster
  // gauntlet than a bare L1.  The arc is previewed up front so you READ the string.
  let chain = 0, goodHits = 0, allStrikes = 0, perfectStrikes = 0;
  const notes = [];
  heroes.forEach((h, hi) => {
    const casc = ALLOUT_CASCADE[h.def.cls] || ALLOUT_CASCADE._default;
    casc.forEach(n => notes.push({ t: n.t, arc: n.arc, hero: hi }));
  });
  // keep it satisfying but never a mash: ensure at least 3 beats (pad a solo/duo
  // opener) and let the BURST level add just a beat or two.
  while (notes.length < 3) notes.push({ t: 'tap', hero: notes.length % heroes.length });
  const flurry = aoLevel >= 3 ? 2 : aoLevel >= 2 ? 1 : 0;   // L1 = party beats · L2 +1 · L3 +2
  for (let f = 0; f < flurry; f++) notes.push({ t: 'tap', hero: f % heroes.length, flurry: true });
  // per-note damage is NORMALISED to the party's total, so a longer cascade is
  // richer INPUT (and more STREAK), not free raw power.
  const noteBase = ALLOUT.base * 2 * heroes.length / Math.max(1, notes.length);
  // telegraph the whole string as a red arc sweeping the enemy line
  const anchorFoe = frontmostEnemy() || livingEnemies()[0];
  const pts = anchorFoe ? zonePoints(arcPoints(notes.length, noteAnchor(figEl(anchorFoe.uid))), 'strike') : [];
  const preview = pts.length ? mkSeqPreview(pts) : null;
  if (preview) preview.classList.add('seq-strike');
  for (let i = 0; i < notes.length; i++) {
    if (S.over || !livingEnemies().length) break;
    const nt = notes[i], h = heroes[nt.hero] || heroes[0];
    const p = pts[i] || pts[pts.length - 1] || null;
    // STEADY, GENEROUS pacing — the all-out is the reward, not a skill wall, so the
    // rings DON'T accelerate; each beat gets a comfortable, readable window.
    const dur = nt.flurry ? 560 : 700;
    lungeFig(figEl(h.id));
    const dot = preview ? preview.querySelectorAll('.sq-dot')[i] : null; if (dot) dot.classList.add('sq-active');
    let q;
    if (nt.t === 'swipe')     q = await strikeSwipeNote(null, nt.arc || 'arcR', dur + 140, p);
    else if (nt.t === 'hold') q = await strikeHoldNote(null, Math.max(560, dur + 240), p);
    else                      q = await strikeNote(null, i + 1, notes.length, dur, p);
    if (dot) { dot.classList.remove('sq-active'); dot.classList.add(q === 'perfect' || q === 'good' ? 'sq-hit' : 'sq-miss'); }
    const good = q === 'perfect' || q === 'great' || q === 'good';
    if (good) goodHits++;
    allStrikes++; if (q === 'perfect') perfectStrikes++;   // for the FLAWLESS finisher
    chain = good ? chain + 1 : 0;
    allOutCombo(chain, q);
    const comboMul = 1 + Math.min(chain, ALLOUT.comboCap) * ALLOUT.comboStep;
    const qmul = ALLOUT.qmul[q] ?? 0.4;
    cineFlash(q === 'perfect' ? 'rgba(255,120,80,0.5)' : 'rgba(255,240,210,0.4)');
    if (q === 'perfect') stageShake();
    for (const e of livingEnemies()) {
      let dmg = Math.max(1, Math.round(noteBase * qmul * comboMul * lvlMul * bondMul));
      // Build 210: real SETUP (statuses you earned) detonates at the full 1.5×;
      // the L3 detonate-everything blanket pays 1.25× — a transcendent burst is
      // still crowned, but bosses stop melting to a flat +50% on every strike.
      const setUp = e.staggered || e.weakened || e.mark || e.lull;
      const primed = setUp || aoLevel >= 3;
      if (primed) { dmg = Math.round(dmg * (setUp ? 1.5 : 1.25)); }   // detonate the setup
      dealToEnemy(e, finaleClamp(e, dmg), h.def.school, h.id);
      if (primed) popupAt(figEl(e.uid), '⚡ TECHNICAL', 'info');
      // hold the reserved finale foe: don't execute the last enemy when a triad
      // has crowned — the FINALE takes the kill.
      if (allOutExecutes(e) && finaleClamp(e, e.hp) >= e.hp) {     // ALT ALL-OUT: Rite of Endings
        popupAt(figEl(e.uid), '☠ EXECUTED', 'dmg');
        dealToEnemy(e, e.hp, h.def.school, h.id);              // finish the wounded
      }
    }
    renderAll();
    if (checkEnd()) break;
    // THE RATCHET — the shot creeps IN across the cascade and kicks harder on a
    // clean hit, so a long string builds instead of playing on one held frame.
    // Safe to move here: the all-out's notes sit at PRE-COMPUTED stage points
    // (mkSeqPreview), not live figure rects, so the camera cannot drift them.
    // 110ms settles well inside the 150ms beat before the next note appears.
    camStep(118 + Math.min(i, 7) * 17 + (good ? 22 : 0), {
      yaw: 2.6 + Math.min(chain, 5) * 0.7,
      pitch: 2.2 + Math.min(i, 6) * 0.22,
      r: 0.9 + (good ? 0.35 : 0),
    });
    if (i < notes.length - 1) await sleep(150);   // a clear, even beat between strikes
  }
  if (preview) preview.remove();
  // ENCORE — an upgraded all-out (L2+) ends on a resonant finisher: the whole
  // party's charge crashes down on the enemy line at once.  No extra input.
  if (!S.over && livingEnemies().length && aoLevel >= 2) await allOutEncore(aoLevel, heroes);
  // FLAWLESS FINISHER (Clair Obscur) — nailing EVERY strike perfectly (a real
  // string, 3+) earns an extra screen-filling blow.  Rewards INPUT mastery,
  // independent of the burst LEVEL — so a perfect L1 all-out still earns it.
  const flawlessAllOut = allStrikes >= 3 && perfectStrikes === allStrikes;
  if (!S.over && livingEnemies().length && flawlessAllOut) await allOutFinisher(heroes);
  // THE TRIAD FINALE — a full triangle crowns the all-out with ONE climactic team
  // move (the limit break), not a stack of separate vows.  Deepened bonds already
  // empowered every strike above; this is the single grand payoff.
  if (!S.over && livingEnemies().length && S.allOutCrowned) {
    await allOutTriadFinale(heroes);
  }
  // PER-HERO ALL-OUT FINISHERS — each fielded hero who kindled their all-out node
  // ends the storm in their own voice (Ash's execute fires per-strike, above).
  if (!S.over) {
    // ELIN — Radiant Dawn: the light rises after the storm; mend & ward the party.
    if (hasNode('elin.allout.dawn') && heroes.some(h => h.id === 'elin')) {
      await heroCutIn('elin', '✦ ALL-OUT FINISH', 'RADIANT DAWN', 'the light rises after the storm', 950);
      livingHeroes().forEach(h => { if (!h.downed) { h.hp = Math.min(healCap(h), h.hp + 5); h.guard += 3; popupAt(figEl(h.id), '✚5 ⛨3', 'heal'); } });
      if (SFX.heal) SFX.heal();
    }
    // MIRA — Death Dance: she vanishes through the storm, marking every survivor.
    if (hasNode('mira.allout.dance') && heroes.some(h => h.id === 'mira') && livingEnemies().length) {
      await heroCutIn('mira', '✦ ALL-OUT FINISH', 'DEATH DANCE', 'every foe marked for death', 950);
      livingEnemies().forEach(e => { e.mark = (e.mark || 0) + 5; popupAt(figEl(e.uid), '◎ EXPOSED +5', 'info'); });
    }
    // BRANWEN — Rain of Ruin: a parting volley on the whole line, and +2 EP.
    if (hasNode('branwen.allout.ruin') && heroes.some(h => h.id === 'branwen') && livingEnemies().length) {
      await heroCutIn('branwen', '✦ ALL-OUT FINISH', 'RAIN OF RUIN', 'the sky goes dark with arrows', 950);
      const vdmg = Math.round(ALLOUT.base * 2.2 * Math.max(2, heroes.length) / 2);
      for (const e of livingEnemies()) { dealToEnemy(e, vdmg, 'blade', 'branwen'); popupAt(figEl(e.uid), '➹ VOLLEY ' + vdmg, 'dmg'); }
      refundEp(2);
      renderAll();
      await sleep(360);
    }
    // HASK — Absolute Zero: the world freezes; frost on every foe, left deeply
    // CHILLED for the shatter, and Hask gathers charge for the turns to come.
    if (hasNode('hask.allout.zero') && heroes.some(h => h.id === 'hask') && livingEnemies().length) {
      await heroCutIn('hask', '✦ ALL-OUT FINISH', 'ABSOLUTE ZERO', 'the world stops breathing', 950);
      const zd = Math.round(ALLOUT.base * 1.8);
      for (const e of livingEnemies()) { dealToEnemy(e, zd, 'frost', 'hask'); e.lull = (e.lull || 0) + 3; popupAt(figEl(e.uid), '❄ ' + zd + ' · CHILL', 'chill'); }
      const hk = livingHeroes().find(h => h.id === 'hask'); if (hk) { hk.charge = Math.min(chargeCap(hk), (hk.charge || 0) + 3); popupAt(figEl('hask'), '◆ +3', 'info'); }
      renderAll();
      await sleep(360);
    }
  }
  S.momentum = 0;
  S.combo = 0;
  // The container PERSISTS for the fight — you've earned the bigger gauge; refill it.
  S.allOutUsed = (S.allOutUsed || 0) + 1;
  // a clean ALL-OUT pays embers — the better the cascade, the bigger the bounty
  const aoBonus = Math.min(4, Math.floor(goodHits / 2));
  if (aoBonus > 0) {
    addEmbers(aoBonus); if (S) S._embersRun = (S._embersRun || 0) + aoBonus;
    const anchor = livingEnemies()[0] || livingHeroes()[0];
    if (anchor) popupAt(figEl(anchor.uid || anchor.id), '✦ +' + aoBonus, 'ember');
  }
  S._burstResolving = false;
  $('#stage').classList.remove('allout-focus');
  camHold(false);
  camReset(760);   // and the camera actually pulls back out — Build 219 never did
  resonantCineEnd();
  renderAll();
}
// The upgraded-all-out finisher (Level 2+).  A resonant crash on the whole enemy
// line — L2 once, L3 twice — then, at L3, the resonance lifts the party (heal +
// guard).  Damage scales off the all-out base and party size; purely scripted.
async function allOutEncore(level, heroes) {
  heroes = (heroes && heroes.length) ? heroes : livingHeroes();
  const lead = heroes[0];
  const hits = level >= 3 ? 2 : 1;
  const per = Math.round(ALLOUT.base * (level >= 3 ? 2.4 : 1.6) * Math.max(2, heroes.length) / 2);
  flashNarrator(level >= 3 ? '✦✦✦ ENCORE — TRANSCENDENT' : '✦✦ ENCORE — RESONANT');
  for (let r = 0; r < hits; r++) {
    if (S.over || !livingEnemies().length) break;
    cineFlash(level >= 3 ? 'rgba(255,120,80,0.6)' : 'rgba(255,170,90,0.5)');
    stageShake('lg'); if (SFX.triad) SFX.triad();
    for (const e of livingEnemies()) {
      dealToEnemy(e, finaleClamp(e, Math.max(1, per)), lead ? lead.def.school : null, lead ? lead.id : null);
      popupAt(figEl(e.uid), '✦ ENCORE', 'dmg popup-big');
    }
    renderAll();
    if (checkEnd()) return;
    await sleep(380);
  }
  if (level >= 3 && !S.over) {   // the Transcendent resonance lifts the whole party
    livingHeroes().forEach(h => { h.hp = Math.min(healCap(h), h.hp + 5); h.guard += 5; popupAt(figEl(h.id), '✚5 ⛨5', 'heal'); });
    if (SFX.heal) SFX.heal();
    renderAll();
  }
}
// FLAWLESS ALL-OUT FINISHER — the mastery payoff for a perfectly-timed cascade.
// A single blinding blow crashes on the whole enemy line.  Scales off the
// all-out base and party size; earned by input, so it can be strong.
function allOutFinisherDmg(partySize) { return Math.round(ALLOUT.base * 3.2 * Math.max(2, partySize) / 2); }
async function allOutFinisher(heroes) {
  heroes = (heroes && heroes.length) ? heroes : livingHeroes();
  const lead = heroes[0];
  flashNarrator('✦✦✦ FLAWLESS — THE FINISHER');
  $('#stage').classList.add('allout-focus');
  cineFlash('rgba(255,244,190,0.72)'); stageShake('xl'); hitFlash(3);
  if (SFX.kill) SFX.kill();
  await sleep(160);
  const dmg = allOutFinisherDmg(heroes.length);
  for (const e of livingEnemies()) {
    dealToEnemy(e, finaleClamp(e, dmg), lead ? lead.def.school : null, lead ? lead.id : null);
    popupAt(figEl(e.uid), '✦ FINISHER ' + dmg, 'dmg popup-big');
  }
  renderAll();
  await sleep(520);
}
async function triggerAllOut() {
  if (!burstReady()) return;
  haptic(HAP.burst);
  S.executing = true;
  $('#stage').classList.add('executing');
  renderAll();
  await resolveAllOut();
  S.executing = false;
  $('#stage').classList.remove('executing');
  renderAll();
  checkEnd();
}

// AWAKEN A WEAVE — a kindled pair, on a shared act of help this fight, lights its
// live WEAVE (no card, no EP).  From now on attacking with either hero makes their
// PARTNER follow up (see bondAssist), and the bond EMPOWERS the all-out.
// OPENING WEAVES — a kindled bond doesn't need to re-earn its weave every fight.
// Pairs that walked in already KINDLED (their thread is pre-formed, see newBattle)
// enter the fight already WOVEN: the Chain is live from turn one and the all-out
// is empowered.  Only bonds forged DURING a fight still get the awakening beat
// (see addThread → awakenDuet).  This is what makes deepened bonds actually FELT.
function openingWeaves() {
  if (!S || !S.threads || !S.threads.size) return;
  S.pairsAwake = S.pairsAwake || new Set();
  const lit = [];
  for (const key of S.threads) {
    if (S.pairsAwake.has(key)) continue;
    const [a, b] = key.split('|');
    if (bondPts(key) < BOND_KINDLED) continue;                // only KINDLED bonds walk in woven
    const ha = S.heroes.find(x => x.id === a), hb = S.heroes.find(x => x.id === b);
    if (!ha || ha.downed || !hb || hb.downed) continue;
    S.pairsAwake.add(key);
    try { sparkThread(a, b); } catch (_) {}
    const w = weaveFor(a, b);
    lit.push((w && w.name) || 'Woven Bond');
  }
  if (lit.length) {
    expandBurst(2, '✦ WEAVE', 12 * Math.min(lit.length, 3));   // woven bonds swell the burst gauge (level 2, charge per weave)
    renderCombatBoons();                                       // the weaves join the topbar chip strip
    // v2.2 Build 6: toasts are HEADLINES, not paragraphs — a fight is on.
    flashNarrator('✦ WOVEN · ' + lit.join(' · ') + ' — a FINISHER weaves your partner in.');
    renderAll();
  }
}
async function awakenDuet(a, b) {
  const key = pairKey(a, b);
  if (bondPts(key) < BOND_KINDLED) return false;            // only KINDLED bonds awaken
  S.pairsAwake = S.pairsAwake || new Set();
  if (S.pairsAwake.has(key)) return false;                  // once per fight
  const ha = S.heroes.find(x => x.id === a), hb = S.heroes.find(x => x.id === b);
  if (!ha || ha.downed || !hb || hb.downed) return false;
  S.pairsAwake.add(key);
  const w = weaveFor(a, b);
  sparkThread(a, b);
  SFX.thread();
  cineFlash('rgba(240,212,136,0.4)');
  const wname = (w && w.name) || 'Woven Bond';
  flashNarrator('✦ WEAVE — ' + HEROES[a].name + ' & ' + HEROES[b].name + ' are bound as ' + wname
    + ': play a FINISHER with one and the other weaves in a free strike.');
  [a, b].forEach(id => { const h = S.heroes.find(x => x.id === id); if (h && !h.downed) h.guard += 2; });   // the bond steels them
  expandBurst(2, '✦ WEAVE', 25);   // a woven bond also swells the burst gauge
  renderCombatBoons();   // the weave joins the topbar chip strip
  renderAll();
  return true;
}
// Plays a vow's STAGES as the all-out's TRIAD FINALE — a grand combined blow.
// Applies the trio vow's fx (dmg/heal/guard/mark/push), scaled by `mul`.
async function playVowStages(stages, ids, mul, label) {
  flashNarrator('✦ VERSE — ' + label);
  const alive = ids.map(id => S.heroes.find(h => h.id === id)).filter(h => h && !h.downed);
  const m = mul || 1;
  const scaled = (v) => Math.round((v || 0) * m);
  for (const st of (stages || [])) {
    if (S.over || !livingEnemies().length) break;
    const fx = st.fx || {};
    const offensive = fx.aoeDmg || fx.hitFrontmost;
    cineFlash(offensive ? 'rgba(212,69,69,0.5)' : 'rgba(240,212,136,0.45)');
    if (offensive) stageShake('lg');
    await sleep(120);
    if (fx.aoeDmg)      { for (const e of livingEnemies()) { dealToEnemy(e, scaled(fx.aoeDmg) + (e.mark || 0), null, ids[0]); await sleep(110); } }
    if (fx.hitFrontmost){ const t = frontmostEnemy(); if (t) dealToEnemy(t, scaled(fx.hitFrontmost) + (t.mark || 0), null, ids[0]); }
    if (fx.pairHeal || fx.healAll) { const who = fx.healAll ? livingHeroes() : alive; const amt = scaled(fx.pairHeal || fx.healAll); who.forEach(h => { h.hp = Math.min(healCap(h), h.hp + amt); popupAt(figEl(h.id), '✚' + amt, 'heal'); }); if (SFX.heal) SFX.heal(); }
    if (fx.pairGuard || fx.guardAll) { const who = fx.guardAll ? livingHeroes() : alive; const amt = fx.pairGuard || fx.guardAll; who.forEach(h => { h.guard += amt; popupAt(figEl(h.id), '⛨' + amt, 'guard'); }); }
    if (fx.guardFront) { const h = heroInRow('front'); if (h) { h.guard += fx.guardFront; popupAt(figEl(h.id), '⛨' + fx.guardFront, 'guard'); } }
    if (fx.pairRally || fx.buffAllDmg) { const who = fx.buffAllDmg ? livingHeroes() : alive; const amt = fx.pairRally || fx.buffAllDmg; who.forEach(h => { h.buffDmg += amt; popupAt(figEl(h.id), '▲ +' + amt, 'rally'); }); }
    if (fx.markAll)    { for (const e of livingEnemies()) { e.mark = (e.mark || 0) + fx.markAll; popupAt(figEl(e.uid), '◎ +' + fx.markAll, 'info'); await sleep(70); } }
    if (fx.markFront)  { const t = frontmostEnemy(); if (t) { t.mark = (t.mark || 0) + fx.markFront; popupAt(figEl(t.uid), '◎ +' + fx.markFront, 'info'); } }
    if (fx.lullAll)    { for (const e of livingEnemies()) { e.lull = (e.lull || 0) + fx.lullAll; popupAt(figEl(e.uid), '❄ −' + fx.lullAll, 'chill'); } }
    if (fx.invulnFront){ const h = heroInRow('front'); if (h) h.invuln = true; }
    if (fx.counterAll) livingHeroes().forEach(h => { h.counter = Math.max(h.counter, fx.counterAll); });
    if (fx.pushBack) {   // Formation: shove the enemy line one row toward the back
      ['mid', 'front'].forEach(row => {
        const to = row === 'mid' ? 'back' : 'mid';
        livingEnemies().filter(e => e.row === row).forEach(e => { if (!livingEnemies().some(o => o !== e && o.row === to)) { e.row = to; popupAt(figEl(e.uid), 'PUSHED', 'info'); } });
      });
    }
    renderAll();
    await sleep(300);
    if (checkEnd()) return true;
  }
  return false;
}
// THE TRIAD FINALE — one climactic TEAM move that crowns the all-out (the limit
// break).  The trio's vow lands as a single grand combined blow: a cinematic
// intro, then its stages, scaled up.  No stack of separate duo verses.
async function allOutTriadFinale(heroes) {
  if (!S.allOutCrowned || S.over || !livingEnemies().length) return;
  const ids = livingHeroes().map(h => h.id);
  const r = triadEntry();
  await vowVerseIntro(ids, r.name, true);
  // THE SIGIL — trace the triangle to seal the vow.  Purely additive: a clean
  // sigil ramps the grand blow up; a broken one still lands the baseline 1.9×
  // (and the reserved killing blow below fires no matter what).
  parryCoach('TRACE the triangle — press and drag through all three points');
  const sigil = await traceNote(2600);
  const mul = sigil === 'perfect' ? 2.5 : sigil === 'good' ? 2.15 : 1.9;
  if (sigil === 'perfect') flashNarrator('✦✦✦ THE SIGIL BLAZES — the vow lands unbroken.');
  await playVowStages(r.stages, ids, mul, '✦ ' + r.name + ' — THE TRIAD');
  // The crowned finale is the KILLING BLOW: if the cascade held a foe back for
  // this moment, the grand blow always finishes it (even a support-shaped vow).
  if (S._finaleReserved && !S.over) {
    for (const e of livingEnemies()) { dealToEnemy(e, e.hp, null, ids[0]); popupAt(figEl(e.uid), '☠', 'dmg popup-big'); }
    S._finaleReserved = false; renderAll(); checkEnd();
  }
}

// A pending CAST unleashes: single-target, or ALL foes with Cataclysm.  A screen-
// shaking payoff for committing a turn (and staying put) to the big spell.
async function unleashCast(h) {
  const pc = h.pendingCast; h.pendingCast = null;
  if (!pc || h.downed) return;
  await heroCutIn(h.id, '◈ UNLEASH', pc.name.toUpperCase(), h.def.name + '’s channelled spell breaks', 900);
  try { cineFlash('rgba(150,90,224,0.5)'); stageShake('lg'); } catch (_) {}
  const targets = pc.all ? livingEnemies().slice()
    : [livingEnemies().find(e => e.uid === pc.targetId) || frontmostEnemy()].filter(Boolean);
  for (const e of targets) { if (!e) continue; dealToEnemy(e, pc.dmg, 'frost', h.id); popupAt(figEl(e.uid), '◈ ' + pc.dmg, 'dmg popup-big'); }
  renderAll(); checkEnd(); await sleep(420);
}
// ---------------------------------------------------------------------------
// END TURN → enemy phase → next turn
// ---------------------------------------------------------------------------
async function endTurn() {
  // the held opening brief has done its job once the player has taken a turn
  if (S && S._narrHeld) { S._narrHeld = false; const nEl = $('#narrator');
    if (nEl) setTimeout(() => { if (S && !S._narrHeld) nEl.innerHTML = ''; }, 1200); }
  if (S.executing || S.over || S._staging) return;
  S.executing = true;
  $('#stage').classList.add('executing');
  // the party breaks pose FIRST — held strikes spring back to idle as their
  // own visible beat, then the lens swings to the enemy side
  if (S.heroes.some(h => h._held)) { releaseHeldPoses(); await sleep(360); }
  renderAll();
  camPose(CAM_POSE_ENEMY, 950);   // the lens swings to feature THEIR side of the field
  await enemyPhase();
  if (!S.over) {
    S.turn++;
    // EP RESERVE (Build 234): unspent EP is no longer discarded — it banks
    // into the burst gauge. "Spend to zero" stops being automatic: dumping a
    // filler card versus holding the energy for momentum is a real call.
    if (S.ep > 0) {
      gainMomentum(S.ep * 6, { raw: true });
      const bl = document.getElementById('burst'); if (bl) popupAt(bl, '⚡ RESERVE +' + (S.ep * 6), 'rally');
    }
    S.ep = S.maxEp;
    S.used = new Set();
    // A line that did not close does not carry over — and nothing banked on it
    // survives either, which is the whole reason the bank is provisional.
    if (S.line) closeLine(null); else S.line = null;
    S.heroes.forEach(h => { h._pendCharge = 0; });
    S._flags = {};   // per-turn passive latches (EP refunds) reset
    S._assistedPairs = new Set();   // each bond may assist once per turn again
    // IMMOVABLE (Cassia) keeps her guard through the enemy turn — everyone else's fades.
    S.heroes.forEach(h => { h.guard = keepsGuard(h.id) ? h.guard : 0; h.counter = 0; h.invuln = false; h.exposed = 0; h._hitByE = []; h.hexed = Math.max(0, (h.hexed || 0) - 1); });
    // A RALLY IS A WINDOW, NOT A RATCHET (Build 260). Enemy `power` never decayed,
    // so a foe with a self-buff intent climbed forever — the floor-1 boss gathers
    // +3 every third turn, which is +9 to +12 flat on every blow across a long
    // fight, and nothing on screen ever says so. It ebbs by 1 a turn now, so a
    // rally is worth ANSWERING rather than simply enduring.
    //
    // Enemy GUARD is deliberately left alone. It looked like the same problem and
    // is not: guard is spent by taking damage, so it self-limits, and decaying it
    // killed the tutorial husk a turn early — the beat that teaches "guard blunts
    // your hits" needs the guard to still be there on the turn after it is cast.
    livingEnemies().forEach(e => { if (e.power) e.power = Math.max(0, e.power - 1); });
    // EXPOSED (mark) now survives the turn rollover but FADES by 1, so a mark
    // laid down this turn still pays off next turn — making it a real setup,
    // not a same-turn-only tax.
    // NB: e.staggered survives the rollover on purpose — the break is repaid by
    // the enemy LOSING its next action (see enemyPhase), not by a timer.
    S.enemies.forEach(e => { e.mark = Math.max(0, (e.mark || 0) - 1); e.acted = false; e._hitBy = []; });
    S.tempCards = S.tempCards.filter(t => t.expiresTurn == null || t.expiresTurn >= S.turn);
    expirePrimes();   // a PRIMED stance holds through the turn after it was earned
    S._pressUsed = false;
    S._taunt = null;             // Cassia's TAUNT lasted the enemy round it provoked
    S.combo = 0;                 // the ASSIST chain is a within-turn combo
    S.channelUsed = false;
    S.executing = false;
    $('#stage').classList.remove('executing');
    // TURN-START passives — the wall braces, the light finds the hurt, the hunt resumes.
    livingHeroes().forEach(h => firePassives('turnStart', h.id, {}));
    // CAST-TIME payoff — a spell begun last turn UNLEASHES now (Hask's big casts).
    for (const h of livingHeroes()) { if (h.pendingCast && !S.over) await unleashCast(h); }
    turnBanner('TURN ' + S.turn, 'tb-player');
    camPose(CAM_POSE_PLAYER, 1050);   // …and back to feature the party
    reofferFollowUp();   // a stance that survived the rollover can still be cued
    // The other half of the bond-strike window (Build 271). The enemy phase is
    // where an ally drops under half, and a Cleric who only ever notices on YOUR
    // turn is not the character the perk describes.
    await checkBondStrikes();
    renderAll();
  }
}

// Slim center banner marking the turn handoff — combat reads as call and
// response instead of popups appearing out of nowhere.
function turnBanner(text, cls) {
  const b = document.createElement('div');
  b.className = 'turn-banner ' + (cls || '');
  b.textContent = text;
  $('#stage').appendChild(b);
  setTimeout(() => b.remove(), 950);
}

async function enemyPhase() {
  S._finisher = false;
  autoTuneFx();   // the board is heavier than it was at fight open — re-measure (Build 261)
  turnBanner('ENEMY TURN', 'tb-enemy');
  _parryStreak = 0;   // a fresh parry combo for the phase
  // WEAKENED expires if you didn't capitalize this turn; STAGGERED holds
  // through the phase — a staggered enemy can be interrupted below.
  livingEnemies().forEach(e => { e.weakened = false; });
  // The ENEMY TURN banner runs 950ms on its own and is not awaited, so this
  // opener was always overlapping a beat that already reads (Build 243).
  await sleep(380);
  for (const e of livingEnemies()) {
    if (S.over) break;
    // A boss takes MULTIPLE actions per round; each is its own telegraphed,
    // parryable strike drawn from the next intents in its cycle.
    const times = e.def.attacksPerRound || 1;   // bosses AND swarms strike more than once per round
    setParryDifficulty(e);   // foe tempo × run-depth ramp (speed / window / bonus notes)
    for (let atk = 0; atk < times; atk++) {
    if (S.over || e.dead || S._staging) break;
    // A stored ECHO returns as the round's FIRST strike — it does NOT advance the
    // normal cycle (so the cadence resumes where it left off after the echo lands).
    let intent;
    const pounce = atk === 0 ? smartHookIntent(e) : null;   // the same reach the telegraph showed
    if (atk === 0 && e.echoStored) { intent = echoView(e.echoStored); e.echoStored = null; popupAt(figEl(e.uid), '◈ THE ECHO RETURNS', 'info'); }
    else if (pounce) { intent = pounce; flashNarrator(e.def.name + ' reaches for the vulnerable.'); }   // pounce doesn't consume the cycle
    else { intent = chooseIntent(e, 0); e.intentIdx++; e._steadied = false; e._corner = false; }
    e.acted = true;
    renderTimeline();
    // THE BREAK STEALS THE TURN (Build 234, the Octopath payoff): a BROKEN foe
    // loses its action outright — heavy or not — then recovers, poise restored.
    // Turn denial is a payoff that matters against every enemy in the game;
    // the old heavy-only interrupt could not fire on ANY regular foe (none of
    // the eight carries a heavy intent).
    if (e.staggered) {
      e.staggered = false;
      e._steadied = true;                         // its next intent braces, not swings (see chooseIntent)
      e.poise = e.poiseMax || 2;                  // it finds its feet again
      foeAnimState(e.uid, 'idle');                // it stops reeling
      popupAt(figEl(e.uid), 'REELING — TURN LOST', 'info');
      flashNarrator(e.def.name + (intent.heavy ? '’s ' + intent.name + ' collapses — ' : ' staggers, ') + 'the break steals its turn.');
      SFX.kill();
      stageShake();
      renderAll();
      await sleep(650);
      continue;
    }
    const lungeEl = figEl(e.uid);
    if (intent.kind === 'buff') {
      await sleep(tempo('buff:' + (e.def && e.def.id) + ':' + intent.name, 400, 230));
      if (intent.guardSelf) { e.guard += intent.guardSelf; popupAt(figEl(e.uid), '⛨ ' + intent.guardSelf, 'guard'); SFX.guard(); }
      if (intent.powerSelf) { e.power += intent.powerSelf; popupAt(figEl(e.uid), '▲ +' + intent.powerSelf, 'rally'); }
      if (intent.powerAll) {
        livingEnemies().forEach(o => { o.power += intent.powerAll; popupAt(figEl(o.uid), '▲ +' + intent.powerAll, 'rally'); });
        flashNarrator(e.def.name + ' rallies the horde.');
      }
      renderAll();
      continue;
    }
    if (lungeEl) { lungeEl.classList.add('fig-lunge'); SFX.enemy(); }
    foeAnimState(e.uid, 'attack');
    const eRow = effIntentRow(e, intent);                 // smart foes hunt the weakest
    const rows = eRow === 'all' ? ROWS.slice() : [eRow];
    // PARRY — a rhythm window on the wind-up whose PATTERN varies by attack.
    // Turning a blow aside doesn't deal damage; it CHARGES your BURST — parry is
    // the engine that fuels the all-out.  PERFECT negates + a big surge; a partial
    // BLOCKs half + a smaller surge; MISS lets the (heavier) blow land.
    // Reposition beforehand to dodge the row entirely instead.
    let parryMul = 1, perfectParry = false;
    const weightMode = PARRY_ENABLED && S.node && S.node.useRunHp;   // real run hits harder
    const ptRow = rows.find(r => heroInRow(r));
    const ptHero = ptRow ? heroInRow(ptRow) : null;
    if (PARRY_ENABLED && ptHero) {
      await windupTell(e, intent);   // Build 211: the CREATURE telegraphs the gesture before rings appear
      const res = await runParry(figEl(ptHero.id), parryPatternFor(intent), intent.attackArt);
      const mit = res ? res.mit : 0;                    // fraction of the blow negated
      if (res && res.perfect) {
        perfectParry = true; parryMul = PARRY_PERFECT_MULT;
        popupAt(figEl(ptHero.id), '⚔ PERFECT — +BURST ✦', 'tech');
        flashNarrator(ptHero.def.name + ' turns the blow — the burst swells!');
        parryFlash(figEl(ptHero.id));
        addEmbers(1); if (S) S._embersRun = (S._embersRun || 0) + 1;   // mastery pays embers
        // A PERFECT read chips the attacker's POISE (Build 252) — the defensive
        // route to a break, so turtling through a cascade builds toward the same
        // payoff that pressing the attack does.
        if (!e.staggered && (e.poise || 0) > 0) {
          e.poise -= 1;
          popupAt(figEl(e.uid), '◈ POISE −1', 'info');
          if (e.poise <= 0) { e.staggered = true; S._breaks = (S._breaks || 0) + 1; foeAnimState(e.uid, 'broken');
            gainMomentum(18); popupAt(figEl(e.uid), '⚡ BROKEN', 'dmg popup-big');
            flashNarrator(e.def.name + ' overcommits — the read BREAKS it.');
            e.mark = (e.mark || 0) + 3; try { SFX.follow(); } catch (_) {} }
        }
        gainMomentum(18, { combo: true });   // parry FEEDS the burst (Build 197: reined in from 24 — parry still fully NEGATES, but it's no longer also the dominant offense engine, so guard/rows/positioning compete)
        lungeFig(figEl(ptHero.id));
        // FLAWLESS RIPOSTE — a whole cascade read PERFECTLY counters for damage.
        const rip = res.flawless ? parryRiposteDmg(res.notes || 1) : 0;
        if (rip > 0 && !e.dead) {
          flashNarrator('✦ FLAWLESS — ' + ptHero.def.name + ' RIPOSTES for ' + rip + '!');
          // THE COUNTER — Clair Obscur's payoff beat, and the one moment in a
          // fight that earns a full cut. Time DILATES, the lens whips hard onto
          // the hero who read the entire string, they answer out of that held
          // frame, and dealToEnemy's own punch then shoves into the impact.
          // The pause before the blow is the point: a counter that fires
          // instantly reads as a stat, a counter you SEE coming reads as a
          // decision the character made.
          try { parrySlowmo(true); } catch (_) {}
          // Build 275: this was the most violent move in the game — a 78ms snap
          // at 6.5° yaw and 2.2° roll. The BEAT is the point (see above), and a
          // beat needs a move slow enough to read as deliberate.
          camFocus(figEl(ptHero.id), { z: 1.14, dz: 150, r: -0.5, yaw: -2.4, pitch: 0.5, pull: 0.44, ms: 240, ease: CAM_PUSH });
          await sleep(270);
          cineFlash('rgba(255,205,130,0.42)'); stageShake('lg');
          lungeFig(figEl(ptHero.id));
          dealToEnemy(e, rip, ptHero.def.school, ptHero.id);   // through the hero's school → can exploit weakness
          popupAt(figEl(e.uid), '⚔ RIPOSTE ' + rip, 'dmg popup-big');
          gainMomentum(7, { combo: true });   // a flawless string surges extra burst (Build 197: reined in from 10)
          await sleep(130);
          try { parrySlowmo(false); } catch (_) {}   // never leak the dilation
        }
        renderAll();
        // Build 243: this used to read `rip > 0 ? 340 : 240` — reading a whole
        // cascade PERFECTLY made you sit through a LONGER pause than muffing it.
        // The riposte already bought its own 400ms of dilation above; playing
        // well should hand the turn back sooner, not later.
        await sleep(rip > 0 ? 180 : 240);
        if (e.dead || S.over) continue;
      } else if (mit > 0) {
        // PARTIAL — you caught some of the cascade; only the missed share lands
        parryMul = 1 - mit;
        popupAt(figEl(ptHero.id), '⛨ ' + Math.round(mit * 100) + '% PARRIED · +BURST', 'guard');
        gainMomentum(Math.round(5 + mit * 11), { combo: true });   // Build 197: partial-parry burst reined in (was 6 + mit*14)
      } else {
        parryMul = weightMode ? PARRY_MISS_MULT : 1;    // fully unparried = more weight
        if (weightMode) popupAt(figEl(ptHero.id), 'UNPARRIED!', 'dmg');
      }
    } else {
      await sleep(260);   // nobody stands in the struck row — dead air, keep it short
    }
    // The boss was KO'd MID-ATTACK — a flawless-parry RIPOSTE or a COUNTER dropped
    // its stage during the wind-up.  It's reforming: cancel the rest of the string
    // (no un-telegraphed blow lands, no next note fires) and let the cutscene play.
    if (S._staging) break;
    let dmg = Math.round(enemyIntentDmg(e, intent) * parryMul);
    // AN ANIMATED CASTER really CASTS — its painted orb flies to the first
    // hero it will strike and the blow lands ON the detonation.
    if (_foeAnim[e.uid] && dmg > 0) {
      const castH = (eRow === 'all' ? ROWS.slice() : [eRow]).map(r => heroInRow(r)).find(Boolean);
      if (castH) await castProjectileFx(figEl(e.uid), figEl(castH.id));
    }
    // CHILL fades a pip per action instead of deleting itself — ❄2 now shaves
    // two attacks, so chilling is a plan rather than a one-attack shave.
    if (e.lull) e.lull = Math.max(0, e.lull - 1);
    let hitAny = false;
    for (const row of rows) {
      const h = heroInRow(row);
      if (!h) continue;
      hitAny = true;
      if (h.invuln) {
        popupAt(figEl(h.id), 'INVULNERABLE', 'info');
      } else {
        // Enemies fight by the player's grammar: EXPOSED heroes take more,
        // and a second enemy striking the same hero this phase FOLLOWS UP.
        let hitDmg = dmg + (h.exposed || 0) + boonIncoming(h);   // risk/reward boons raise incoming
        const hby = h._hitByE || (h._hitByE = []);
        const prevE = hby.length ? hby[hby.length - 1] : null;
        if (prevE && prevE !== e.uid) {
          hitDmg += 2;
          popupAt(figEl(e.uid), '⚡ ASSIST +2', 'info');
          SFX.follow();
        }
        hby.push(e.uid);
        // TEAM SYNERGY: Cassia soaks for allies in the rows behind her (Guardian's Aegis)
        const soak = soakMitigation(h);
        if (soak) { hitDmg = Math.max(0, hitDmg - soak); popupAt(figEl(h.id), '⛨ COVERED −' + soak, 'guard'); }
        let left = hitDmg;
        if (h.guard > 0) { const g = Math.min(h.guard, left); h.guard -= g; left -= g; popupAt(figEl(h.id), '⛨', 'guard'); }
        // SANCTIFIED WALL (Guardian+Cleric weave) — while both stand, a blow that
        // WOULD fell this hero leaves them at 1 instead.  Once per fight.
        if (left >= h.hp && h.hp > 1 && weaveSaves(h.id)) {
          left = h.hp - 1; S._weaveSaved = true;
          popupAt(figEl(h.id), '✛ SANCTIFIED', 'heal');
        }
        if (left > 0) {
          h.hp = Math.max(0, h.hp - left);
          // …and a share of it is kept. Never enough to floor the ceiling: a hero
          // can always be mended back to a third of their bar.
          const w = Math.round(left * WOUND_SHARE);
          if (w > 0) {
            h.wound = Math.min(Math.floor(h.maxHp * 0.66), woundOf(h) + w);
            if (RUN) { RUN.wounds = RUN.wounds || {}; RUN.wounds[h.id] = h.wound; }
            popupAt(figEl(h.id), '✖ ' + h.wound, 'dmg');
          }
          const dtier = left >= 20 ? 3 : left >= 12 ? 2 : left >= 7 ? 1 : 0;
          const big = dtier >= 2;
          popupAt(figEl(h.id), '−' + left, 'dmg' + (big ? ' popup-big' : ''));
          impactFx(figEl(h.id), 'foe', big);   // red claw-strike on the hero
          struck(figEl(h.id), 'l'); haptic(dtier >= 2 ? HAP.struckBig || HAP.struck : HAP.struck);   // recoil + flash + stun
          hitFlash(dtier);                      // a heavy enemy blow rocks the screen
          SFX.hit(big);
          if (dtier >= 1) stageShake(['sm', 'sm', 'lg', 'xl'][dtier]);
          // THE BLOW LANDS ON US — the lens shoves toward the struck hero, the
          // mirror of dealToEnemy's punch. (After a parry the camHold is
          // already released, so this plays; DURING one, camPunch defers.)
          if (dtier >= 1) camPunch(dtier, figEl(h.id));
          (e._damaged || (e._damaged = [])).push(h.id);   // remembered for AVENGE
          // DRAIN — the Maw feeds: a share of the damage dealt heals it.  Staggered
          // (its wind-up broken) it cannot feed, so STAGGER is the counter.
          if (intent.drain && !e.staggered) {
            const fed = Math.max(1, Math.round(left * intent.drain));
            e.hp = Math.min(healCap(e), e.hp + fed);
            popupAt(figEl(e.uid), '♥ +' + fed, 'heal');
          }
        }
      }
      if (!perfectParry && intent.chill) {
        if (heroResistsChill(h)) { popupAt(figEl(h.id), '❄ RESISTED', 'guard'); }   // BASTION — the wall does not slow
        else { h.chill = (h.chill || 0) + intent.chill; popupAt(figEl(h.id), '❄ CHILL −' + intent.chill, 'chill'); }
      }
      if (!perfectParry && intent.expose) { h.exposed = (h.exposed || 0) + intent.expose; popupAt(figEl(h.id), '◎ EXPOSED +' + intent.expose, 'info'); }
      // HEX — the Maw's curse.  If you don't DODGE the row (or perfect-parry), the
      // hex clings: while hexed, every card you play burns another from your hand.
      if (!perfectParry && intent.hex) { h.hexed = Math.max(h.hexed || 0, intent.hex); popupAt(figEl(h.id), '☠ HEXED', 'dmg'); }
      // SHOVE / HOOK — a heavy foe knocks the struck hero OUT of formation:
      // shove:'back' drives them one row back, 'front' DRAGS them forward into the
      // teeth.  The reposition fires onHeroEnterRow — so a charged Hask MISFIRES and
      // a squishy backliner gets yanked into reach.  A PERFECT parry keeps your footing.
      if (!perfectParry && intent.shove && !h.downed) applyShove(h, intent.shove);
      // REACTIVE: an ally in real danger summons their strongest bond.
      // Costed on purpose — the intercept scrambles formation and chills
      // the protector; declining it is as expressive as playing it.
      if (h.hp > 0 && h.hp * 2 <= h.maxHp && !S._notTodayGiven) {
        const protector = livingHeroes()
          .filter(x => x.id !== h.id)
          .map(x => ({ x, w: bondPts(pairKey(x.id, h.id)) + (S.threads.has(pairKey(x.id, h.id)) ? 1 : 0) }))
          .filter(o => o.w > 0)
          .sort((a, b) => b.w - a.w)[0];
        if (protector) {
          S._notTodayGiven = true;
          const pr = protector.x;
          genTempCard({ kind: 'temp', owner: pr.id, ownerName: pr.def.name, tint: pr.def.tint,
            stance: 'REACTIVE · RESCUE', name: 'Not Today', cost: 0, target: 'none',
            fx: { notToday: [pr.id, h.id] }, expiresTurn: S.turn + 1,
            desc: `<b>Free.</b> ${pr.def.name} throws themselves in the way — swap rows with ${h.def.name}, heal them 4, gain <span class="kw kw-guard">⛨ 4</span> <span class="kw kw-counter">↺ 2</span>. The cost is theirs: <span class="kw kw-chill">❄ CHILL −2</span> on ${pr.def.name}’s next strike.` });
          flashNarrator(pr.def.name + ' sees ' + h.def.name + ' falter — a card takes shape.');
        }
      }
      if (h.counter > 0 && !e.dead) { dealToEnemy(e, h.counter); flashNarrator(h.def.name + ' counters!'); }
      if (h.hp === 0 && !wardFall(h)) { h.downed = true; popupAt(figEl(h.id), 'DOWN', 'dmg'); }
    }
    if (!hitAny) {
      popupAt(figEl(e.uid), 'MISS', 'info');
      flashNarrator(e.def.name + '’s ' + intent.name + ' finds an empty row.');
    }
    // SEVER — THE SUNDERING cuts a formed thread, undoing resonance progress.
    // A PERFECT parry holds the bond together; otherwise the thread snaps.
    if (intent.sever && !perfectParry) severThreads(e, intent.sever);
    // DISCORD — the Chorus feeds on the bonds it breaks: sever a thread AND heal
    // for each one cut.  A PERFECT parry denies both.  (Fusion of sever + drain.)
    if (intent.discord && !perfectParry) {
      const cut = severThreads(e, intent.discord);
      if (cut > 0 && !e.staggered) { const fed = cut * 9; e.hp = Math.min(healCap(e), e.hp + fed); popupAt(figEl(e.uid), '♥ +' + fed, 'heal'); flashNarrator(e.def.name + ' feeds on the broken bond.'); }
    }
    // ECHO — an unparried echo strike is REMEMBERED and returns next round,
    // stronger.  A PERFECT parry silences it before it can ring out again.
    if (intent.echo && !intent.echoOf && !perfectParry) { e.echoStored = { intent, dmgBonus: intent.echoBonus || 4 }; popupAt(figEl(e.uid), '◈ ECHO STORED', 'info'); }
    renderAll();
    // renderAll() has ALREADY painted the result by the time we get here, so
    // this settle is pure dead frame past the point the popups read (Build 243).
    await sleep(240);
    if (checkEnd()) break;
    // A clear BREATHER between the boss's two blows — the second wind-up gets its
    // own telegraph and a beat to read, so the pair lands as call-and-response
    // instead of a single overwhelming wall of notes.
    if (atk + 1 < times) { flashNarrator(e.def.name + ' winds up again…'); await sleep(Math.round(400 * _parrySpeed)); }
    }
    if (S.over) break;
  }
}

// THE SUNDERING's signature: cut up to `count` formed threads, undoing your
// resonance progress (a broken triangle can no longer speak the vow).
function severThreads(e, count) {
  if (!S.threads || !S.threads.size) return 0;
  const keys = [...S.threads];
  const cut = Math.min(count, keys.length);
  for (let i = 0; i < cut; i++) {
    const k = keys.splice(Math.floor(Math.random() * keys.length), 1)[0];
    if (!k) break;
    S.threads.delete(k);
    const [a, b] = k.split('|');
    popupAt(figEl(a), '✂ SEVERED', 'dmg'); popupAt(figEl(b), '✂ SEVERED', 'dmg');
  }
  if (cut) {
    S.triadFormed = false; S.allOutCrowned = false;   // a severed thread un-crowns the all-out
    flashNarrator((e && e.def ? e.def.name : 'It') + ' SEVERS your bonds — the bond snaps.');
    try { SFX.deny(); } catch (_) {}
    renderResonance();
  }
  return cut;
}
function checkEnd() {
  if (S.over) return true;
  if (!livingEnemies().length) { S.over = true; onVictory(); return true; }
  if (!livingHeroes().length) { S.over = true; onDefeat(); return true; }
  return false;
}

function onVictory() {
  // v2.2 narrative OBSERVES combat end (never steers it): an encounter that
  // carries a story id reports its victory so COMBAT_VICTORY:<id> beats can
  // fire. No current encounter sets storyId yet — this is the Act I socket.
  if (S.node.storyId) narrFire('COMBAT_VICTORY:' + S.node.storyId, {}, null);
  // Write survivors' HP back into the run.  A DOWNED hero STAYS down (hp 0) — no
  // free between-fight revive; only a CAMPFIRE brings them back.  Position memory:
  // the next fight opens where each hero stood.
  let bondLines = [];
  if (S.node.useRunHp && RUN) {
    RUN.rows = RUN.rows || {};
    RUN.wounds = RUN.wounds || {};
    S.heroes.forEach(h => { RUN.hp[h.id] = h.downed ? 0 : h.hp; RUN.rows[h.id] = h.row; RUN.wounds[h.id] = woundOf(h); });
    if (S.node.mapId != null && !RUN.completed.includes(S.node.mapId)) RUN.completed.push(S.node.mapId);
    // Fighting together with a thread held IS the reward: the pair grows.
    RUN.bonds = RUN.bonds || {};
    S.threads.forEach(k => {
      const before = RUN.bonds[k] || 0;
      RUN.bonds[k] = before + 1;
      const [a, b] = k.split('|');
      const name = HEROES[a].name + ' ─ ' + HEROES[b].name;
      bondLines.push(before + 1 === BOND_KINDLED ? name + ' · WOVEN' : name + ' +1');
    });
    saveRun();
  }
  const isBoss = S.node.isBoss || S.node.enemies.some(id => ENEMY_DEFS[id].boss);
  // a CLEAR pays a small steady bounty on top of the per-kill embers, so every
  // fight advances the tree a little (not just a trickle between boss lumps).
  const clearBonus = isBoss ? 3 : (S.node.elite ? 2 : 1);
  addEmbers(clearBonus); S._embersRun = (S._embersRun || 0) + clearBonus;
  // THE CORPSE RUN RECLAIMED (Build 210) — beating the fallen trio's echo wins
  // back everything the Abyss kept: their embers AND their bonds.
  let memLine = '';
  if (S.node.memEmbers) {
    addEmbers(S.node.memEmbers); S._embersRun = (S._embersRun || 0) + S.node.memEmbers;
    RUN.bonds = RUN.bonds || {};
    (S.node.memThreads || []).forEach(k => { RUN.bonds[k] = (RUN.bonds[k] || 0) + 1; });
    RUN._ashes = S.node.memLabel || 'the dark';   // set down gently — the ending remembers them
    memLine = `<div class="ov-embers">♰ The echo rests. <b>✦ ${S.node.memEmbers} embers reclaimed</b> — and their bonds pass to you.</div>`;
    saveRun();
  }
  SFX.victory();
  setTimeout(() => {
    if (!S) return;   // the fight was torn down before this deferred beat fired
    // A floor boss pays 16 embers and used to jump straight to the next floor,
    // so four climaxes a run ended with no build beat at all. It draws its spark
    // first now, then descends.
    if (isBoss && S.node.mapId != null) { showEmberSpark(() => onFloorCleared()); return; }
    const th = S.threads.size;
    showOverlay(`
      <div class="ov-eyebrow" style="color:var(--gold-bright)">VICTORY</div>
      <div class="ov-title" style="font-size:22px">${isBoss ? 'THE ECHO FADES' : 'THE ROAD HOLDS'}</div>
      ${th ? `<div class="ov-sub">${th} bond${th > 1 ? 's' : ''} held${S.triadFormed ? ' · the triad answered' : ''}</div>` : ''}
      ${memLine}
      ${S._embersRun ? `<div class="ov-embers">✦ ${S._embersRun} ember${S._embersRun === 1 ? '' : 's'} gathered — spend them on the <b>Ember Tree</b></div>` : ''}
      ${bondLines.length ? `<div class="bond-growth">${bondLines.map(l => `<span class="bg-line${/WOVEN/.test(l) ? ' bg-kindled' : ''}">♡ ${l}</span>`).join('')}</div>` : ''}
      <button class="ov-btn primary" id="ov-next">CONTINUE</button>
    `);
    const wasElite = !!S.node.elite;   // an elite kill hands you a companion's gift
    $('#ov-next').onclick = () => {
      hideOverlay();
      if (S.node.mapId == null) { advanceFlow(); return; }
      // An ELITE used to hand you a boon INSTEAD of a spark, and a BOSS handed
      // you neither — it short-circuited into onFloorCleared before the draft
      // block ran. So the two hardest fights on a floor, worth 14 and 16 embers,
      // were the only ones that could not buy you anything: the game gave you
      // the money and closed the shop. Measured, that is 6 of ~14 combat nodes
      // a run whose entire output was a number going up.  Now the elite pays
      // BOTH — its gift, and then the spark every other clear already offered.
      if (wasElite) showBoonDraft(() => showEmberSpark(() => showMap()), { curse: true, eyebrow: 'THE ELITE FALLS', title: 'SPOILS OF THE ROAD', flavor: 'The harder the fight, the more your companions have to teach. Take one — it holds until you fall.' });
      else showEmberSpark(() => showMap());   // Build 211: every ordinary clear offers a SPARK — the after-fight draft
    };
  }, 700);
}
function onDefeat() {
  MUSIC.stop();   // the theme dies with the party
  META.deaths = (META.deaths || 0) + 1; saveMeta();   // the Chorus counts (Build 211: bosses greet a returner differently)
  // v2.2 narrative observes the death — FIRST_PLAYER_DEATH_AFTER:<id> beats
  // key off this signal once their anchor event is complete. Inert until Act I
  // scenes are authored; unauthored beats are left pending, never burned.
  narrFire('PLAYER_DEATH', {}, null);
  // On the Descent, death is contribution: the run ends, and the Abyss
  // stores a memory of who fell here — the next descent will find it.
  if (S.node.mapId != null && RUN) {
    const memLevel = S.node.level != null ? S.node.level : S.node.depth;
    const abyss = loadAbyss();
    abyss[memLevel] = {
      trio: RUN.active.slice(),
      threads: [...S.threads],
      label: S.node.label || (mapNode(S.node.mapId) || {}).label || 'the dark',
      // Build 210 (the corpse run): the Abyss KEEPS most of what you carried —
      // 60% of the unspent embers wait at the death-marker, guarded by the
      // fallen trio's echo.  Death now creates next-run purpose, not just a stat.
      embers: Math.round((RUN.embers || 0) * 0.6),
    };
    saveAbyss(abyss);
    // GAME OVER — capture the run's arc BEFORE the run is wiped, so the screen
    // shows how far this thread reached: floor, depth, bonds held, skills kindled,
    // embers torn from the dark.  A true ending, not a shrug.
    const trio = RUN.active.slice();
    const stats = {
      floor: RUN.floor || 1,
      label: abyss[memLevel].label,
      threads: (S.threads ? S.threads.size : 0),
      kindled: (RUN.nodes ? RUN.nodes.length : 0),
      embers: RUN._embersTotal || RUN.embers || 0,
      cleared: (RUN.depthBase || 0) + memLevel,
    };
    try { localStorage.removeItem(RUN_KEY); } catch (_) {}
    RUN = null;
    const figs = trio.map(id => `<span class="go-fig">${V2PORTRAITS[id] || ''}</span>`).join('');
    const names = trio.map(id => HEROES[id].name).join(' · ');
    const stat = (v, l) => `<div class="go-stat"><span class="go-stat-v">${v}</span><span class="go-stat-l">${l}</span></div>`;
    setTimeout(() => {
      showOverlay(`
        <div class="go-screen">
          <div class="ov-eyebrow" style="color:#c85a5a">THE DESCENT ENDS</div>
          <div class="ov-title" style="font-size:30px; letter-spacing:0.16em;">GAME OVER</div>
          <div class="go-figs">${figs}</div>
          <div class="go-fell">${names} fall at <b>${stats.label}</b>${stats.floor >= 2 ? ` · <b>Floor ${stats.floor}</b>` : ''}.</div>
          <div class="go-stats">
            ${stat('FL ' + stats.floor, 'reached')}
            ${stat(stats.cleared, 'nodes cleared')}
            ${stat(stats.threads, 'bonds held')}
            ${stat(stats.kindled, 'skills kindled')}
            ${stat(stats.embers, 'embers torn')}
          </div>
          <div class="go-memory">Nothing here is wasted. <b>The Abyss remembers</b> — the next to descend will find where you fell.</div>
          <button class="ov-btn primary" id="ov-fallen">WAKE AT THE BOTTOM</button>
        </div>
      `, 'game-over');
      // Build 276: not "return to the surface" — there is no surface, which is
      // the one thing the fragments are most insistent about. You wake at THE
      // LANDING, where the people you have climbed with are standing around not
      // remembering you, and the loop starts from a scene instead of a menu.
      $('#ov-fallen').onclick = () => { hideOverlay(); showLanding({
        trio, floor: stats.floor, threads: stats.threads, cleared_nodes: stats.cleared,
        wasBoss: !!(S && S.node && S.node.isBoss), cleared: false,
      }); };
    }, 700);
    return;
  }
  // Tutorial defeats stay forgiving: retry the same beat.
  setTimeout(() => {
    showOverlay(`
      <div class="ov-eyebrow">DEFEAT</div>
      <div class="ov-title" style="font-size:22px">THE BOND FRAYS</div>
      <div class="ov-sub">but does not break</div>
      <button class="ov-btn primary" id="ov-retry">TRY AGAIN</button>
    `);
    $('#ov-retry').onclick = () => { hideOverlay(); startFlowNode(); };
  }, 700);
}
// A floor boss falls — either you drop into the next, deeper floor (keeping your
// whole in-run build), or, on the final floor, the descent is truly cleared.
function onFloorCleared() {
  if ((RUN.floor || 1) >= FLOORS) { onRunComplete(); return; }
  RUN.depthBase = (RUN.depthBase || 0) + (RUN.completed ? RUN.completed.length : 0);   // the ramp keeps rising
  RUN.floor = (RUN.floor || 1) + 1;
  RUN.completed = [];
  RUN.map = generateDescent(RUN.roster, RUN.floor);
  // Build 210: the deep grants HALF a breath, not a full night's rest — everyone
  // (the fallen included: clearing a floor boss is the milestone that pulls them
  // back to their feet) recovers to at least 50%.  Full rest still costs a camp.
  RUN.roster.forEach(id => { const hp = RUN.hp[id] ?? HEROES[id].maxHp; RUN.hp[id] = Math.max(hp, Math.ceil(HEROES[id].maxHp * 0.5)); });
  saveRun();
  // The step onto the FINAL floor is its own beat: the deepest dark, where the
  // three you broke were only fragments of the one thing still waiting.
  const finalFloor = RUN.floor >= FLOORS;
  showOverlay(finalFloor ? `
    <div class="ov-eyebrow" style="color:var(--gold-bright)">THE DESCENT · THE LAST FLOOR</div>
    <div class="ov-title" style="font-size:24px">THE DEEPEST DARK</div>
    <div class="ov-lines" style="text-align:center; min-height:0;">
      <div class="ov-line">The Sundering’s pieces do not scatter — they are <b>drawn downward</b>, gathered, remembered.</div>
      <div class="ov-line">Knight, Maw, Sundering: three voices of <b>one throat</b>. It has been singing the whole way down. A threshold, a last fire — then the <b>Hollow Chorus</b>.</div>
    </div>
    <button class="ov-btn primary" id="ov-deeper">INTO THE DEEP</button>
  ` : `
    <div class="ov-eyebrow" style="color:var(--gold-bright)">FLOOR ${RUN.floor - 1} · CLEARED</div>
    <div class="ov-title" style="font-size:24px">THE FLOOR GIVES WAY</div>
    <div class="ov-lines" style="text-align:center; min-height:0;">
      <div class="ov-line">The colossus shatters — and the ground beneath it opens onto a <b>deeper dark</b>.</div>
      <div class="ov-line">Down here the dead are <b>older, hungrier — and they learn</b>. Your kindled skills descend with you… but so does the price of falling.</div>
    </div>
    <button class="ov-btn primary" id="ov-deeper">DESCEND · FLOOR ${RUN.floor}</button>
  `);
  $('#ov-deeper').onclick = () => { hideOverlay(); showMap(); };
}
function onRunComplete() {
  RUN.done = true; saveRun();
  // THE ENDING KNOWS WHO YOU WERE (Build 210) — the closing lines read the run's
  // actual state: the trio and their vow, the ashes they carried, the names they
  // made (or didn't) against them, and whether this is the first silence or a
  // return trip.  A eulogy or a coronation, never a form letter.
  const trio = (RUN.active || []).slice();
  const names = trio.map(id => (HEROES[id] || {}).name || id).join(' · ');
  const vow = trio.length === 3 ? triadEntryFor(trio) : null;
  const firstClear = !(META.clears > 0);
  META.clears = (META.clears || 0) + 1; saveMeta();
  const lines = [];
  lines.push('Three voices in one throat, and every one of them cut. The Chorus comes apart into a hush so complete you can hear your own hearts — <b>all of them, still beating, together</b>.');
  if (vow) lines.push(`<b>${names}</b> — <i>${vow.name}</i>, sworn and kept. Say the names into the quiet. The dark knows them now.`);
  if (RUN._ashes) lines.push(`And not only yours: the ones who fell at <b>${RUN._ashes}</b> came down with you — <b>the silence is theirs too</b>.`);
  if (!(RUN.foesMade > 0)) lines.push('You wronged no one on the road. <b>No name in the dark speaks against you.</b>');
  lines.push(firstClear
    ? '<b>The bond held — all the way to the bottom.</b> No one has ever walked back out to tell it. You will be the first.'
    : '<b>The bond held — again.</b> The Abyss knows this walk now, and still it could not keep you. Every triangle you never formed still waits: other trios, other vows, another descent.');
  showOverlay(`
    <div class="ov-eyebrow" style="color:var(--gold-bright)">THE HOLLOW CHORUS · SILENCED</div>
    <div class="ov-title" style="font-size:26px">THE LAST ECHO FADES</div>
    <div class="ov-lines" style="text-align:center; min-height:0;">
      ${lines.map(l => `<div class="ov-line">${l}</div>`).join('')}
    </div>
    <button class="ov-btn primary" id="ov-title">DOWN, THEN</button>
  `, 'story-screen');
  // Build 276: a clear returns you to THE LANDING too. The stair is a loop —
  // walking out of it is the thing nobody has managed, so "you cleared it, back
  // to the menu" was quietly contradicting the ending it had just given you.
  $('#ov-title').onclick = () => { const t = trio.slice(); RUN = null; saveRun(); hideOverlay();
    showLanding({ trio: t, floor: 3, threads: t.length >= 3 ? 3 : 1, cleared: true }); };
}

// ---------------------------------------------------------------------------
// FLOW (tutorial chapters)
// ---------------------------------------------------------------------------
function advanceFlow() {
  flowIdx++;
  try { localStorage.setItem(PROGRESS_KEY, String(flowIdx)); } catch (_) {}
  startFlowNode();
}
function startFlowNode() {
  const node = FLOW[flowIdx];
  if (!node) { startDescent(); return; }
  $('#chapter-chip').textContent = 'CH ' + (node.chapter || 1);
  if (node.type === 'story') showStory(node);
  else startFight(node);
}
function startFight(node) {
  clearAim();        // a run that ended mid-aim must NOT leak targeting into the next fight (cards would be un-draggable)
  MUSIC.play('audio/combat-theme.mp3?v=1', 0.42, false);   // the ThornCrown duel theme, ducked under the SFX — a fresh entrance from the downbeat (crossfades up from the world bed)
  S = newBattle(node);
  _bossFig = null;   // a fresh fight builds its own boss figure (uids can repeat across fights)
  _partyFigs = {};   // and fresh party figures (drag closures capture this fight's hero objects)
  _enemyFigs = {};   // and fresh enemy-line figures (same reuse cache as the party)
  hideOverlay();
  flashNarrator(node.narrator || '', !!node.narrator);   // hold the brief until they act (Build 262)
  renderAll();
  // ESTABLISHING SHOT — a fight opens pushed in and TILTED, then breathes out
  // to true over a beat and a half.  Costs nothing and every encounter now
  // starts on a move instead of a locked-off plate.
  try { _camBase = CAM_POSE_PLAYER; camIntro(node.isBoss ? 1.3 : 1.16, node.isBoss ? -1.8 : -0.8, node.isBoss ? 1900 : 1250); } catch (_) {}
  openingWeaves();   // kindled bonds enter already woven (their Chain is live from turn one)
  warmCastArt(S.heroes.map(h => h.id));   // sheets decode now, not on the first cast
  // A trio who EARNED all three bond nodes walks in as a triad — checkTriad only
  // ever ran off addThread, so an owned triad would otherwise never fire at all.
  //
  // Deliberately gated on OWNED nodes, not on pre-formed threads: a kindled trio
  // walks in already threaded, and firing the ceremony there would open every
  // single fight with it. The original rule — a woven trio still owes one act of
  // help this fight — is right, and it stays. What changes is that a pair who sat
  // at a fire together has already paid that price, permanently.
  setTimeout(() => { try {
    if (!S || S.over || S.triadFormed) return;
    const live = livingHeroes(); if (live.length < 3) return;
    const [x, y, z] = live.map(h => h.id);
    if (bondNodeHeld(x, y) && bondNodeHeld(y, z) && bondNodeHeld(x, z)) checkTriad();
  } catch (_) {} }, 900);
}

function showStory(node) {
  let revealed = 1;
  const render = () => {
    const linesHtml = node.lines.slice(0, revealed).map(l =>
      `<div class="ov-line">${l.spk ? `<span class="spk">${l.spk}</span>` : ''}${l.text}</div>`).join('');
    const done = revealed >= node.lines.length;
    // A passage can end on a FORK instead of a button — the scene asks, and what
    // you answer is the only thing the night gives you (see showCampScene).
    const fork = done && node.fork ? node.fork : null;
    showOverlay(`
      <div class="ov-eyebrow">${node.eyebrow || ''}</div>
      <div class="ov-title" style="font-size:24px">${node.title}</div>
      <div class="ov-lines">${linesHtml}</div>
      ${fork ? `<div class="ov-fork">
          <div class="ov-fork-prompt">${fork.prompt}</div>
          ${fork.opts.map((o, i) => `<button class="ov-forkopt" data-fk="${i}">
            <span class="ovf-label">${o.label}</span><span class="ovf-desc">${o.desc}</span></button>`).join('')}
        </div>` : ''}
      ${(done && !fork)
        ? `<button class="ov-btn primary" id="ov-go">${(node.next === 'descent' || node.beginDescent) ? 'BEGIN THE DESCENT' : (FLOW[flowIdx + 1] && FLOW[flowIdx + 1].type === 'fight' ? 'TO BATTLE' : 'CONTINUE')}</button>`
        : (done ? '' : `<div class="ov-tap">tap to continue ▸</div>`)}
    `, 'story-screen' + (node.scene ? ' scene-' + node.scene : ''));
    // Keep the newest line (and the button) in view when the passage is long.
    const box = $('#overlay .ov-lines');
    if (box) box.scrollTop = box.scrollHeight;
    if (fork) {
      $('#overlay').onclick = null;
      document.querySelectorAll('#overlay .ov-forkopt').forEach(btn => { btn.onclick = (ev) => {
        ev.stopPropagation();
        hideOverlay();
        fork.onPick(node.fork.opts[+btn.dataset.fk], +btn.dataset.fk);
      }; });
    } else if (done) {
      $('#ov-go').onclick = (ev) => {
        ev.stopPropagation();
        hideOverlay();
        if (node.campDone) showPartySelect(() => showMap());
        else if (node.beginDescent) showMap();
        else if (node.next === 'descent') startDescent();
        else advanceFlow();
      };
    } else {
      $('#overlay').onclick = () => { $('#overlay').onclick = null; revealed++; render(); };
    }
  };
  render();
}

// ---------------------------------------------------------------------------
// THE DESCENT — map, recruits, camps, party composition.
// ---------------------------------------------------------------------------
function startDescent() {
  if (!RUN || RUN.done) RUN = newRun();
  // The tutorial is FINISHED here — this is where "seen" becomes true (Build 262).
  try { localStorage.setItem(TUTORIAL_KEY, '1'); } catch (_) {}
  try { localStorage.setItem(PROGRESS_KEY, String(FLOW.length)); } catch (_) {}
  saveRun();
  showMap();
}
// The descent runs strictly LEFT → RIGHT.  A node is reachable only from your
// CURRENT position (the deepest node you've completed) — so once you pick a branch,
// the sibling you passed up is locked behind you.  No going back for embers.
function nodeReachable(n) {
  if (RUN.completed.includes(n.id)) return false;
  const done = mapAll().filter(p => RUN.completed.includes(p.id));
  if (!done.length) return n.col === 1;                       // the descent's mouth
  const cur = done.reduce((a, b) => (b.col >= a.col ? b : a)); // where the trail ends
  return cur.next.includes(n.id);                             // only forward, from here
}
function showMap() {
  S = null;
  MUSIC.play('audio/worldmap-theme.mp3?v=1', 0.5, true, { sequence: true, outMs: 1100, gap: 300, inMs: 1900 });   // leaving combat: the battle theme fades fully out, a breath of quiet, then the road's song swells in — no clashing overlap
  $('#stage').classList.remove('show-bg');
  $('#chapter-chip').textContent = 'DESCENT';
  $('#timeline').innerHTML = '';
  const cols = {};
  mapAll().forEach(n => { (cols[n.col] = cols[n.col] || []).push(n); });
  const glyph = { fight: '⚔', elite: '✸', event: '?', recruit: '☉', camp: '⌂', boss: '☠' };
  // Your CURRENT position = the deepest completed node (where the trail ends).
  const doneNodes = mapAll().filter(n => RUN.completed.includes(n.id));
  const curNode = doneNodes.length ? doneNodes.reduce((a, b) => (b.col >= a.col ? b : a)) : null;
  const colHtml = Object.keys(cols).sort((a, b) => a - b).map(c => `
    <div class="map-col">
      ${cols[c].map(n => {
        const done = RUN.completed.includes(n.id);
        const reach = nodeReachable(n);
        const cur = curNode && n.id === curNode.id;
        // A CHILD'S COMPASS reads the whole stair — a locked node still says
        // what it is, so you can plan a route instead of discovering one.
        const seen = done || reach || hasRelic('compass');
        return `<button class="map-node mn-${n.type}${done ? ' mn-done' : ''}${reach ? ' mn-reach' : ''}${cur ? ' mn-current' : ''}${(!done && !reach) ? ' mn-locked' : ''}${(!done && !reach && seen) ? ' mn-scried' : ''}"
          data-node="${n.id}" ${reach ? '' : 'disabled'} title="${seen ? n.label : '?'}">
          <span class="mn-pulse" aria-hidden="true"></span>
          <span class="mn-icon">${glyph[n.type]}</span>
          ${cur ? '<span class="mn-here" aria-hidden="true">▾</span>' : ''}
          ${done && !cur ? '<span class="mn-check" aria-hidden="true">✓</span>' : ''}
          ${n.mem ? '<span class="mn-mem" title="A previous descent fell here">♰</span>' : ''}
          <span class="mn-label">${n.label}</span>
        </button>`;
      }).join('')}
    </div>`).join('');
  // Show the active trio AND any BENCHED roster members (dimmed) — a benched hero
  // must never read as "removed"; the whole chip opens the swap screen.
  const benched = (RUN.roster || []).filter(id => !RUN.active.includes(id));
  const trio = RUN.active.map(id => `<span class="party-chip-fig">${V2PORTRAITS[id] || ''}</span>`).join('')
    + benched.map(id => `<span class="party-chip-fig benched" title="${HEROES[id].name} — benched · tap to swap in">${V2PORTRAITS[id] || ''}</span>`).join('');
  const r = triadEntryFor(RUN.active);
  const mood = partyMood(), moodDef = MOODS[mood];
  // Only nag "kindle a skill" when you can actually AFFORD one — otherwise it
  // prompts an impossible action (and, since the teach never completes, nags
  // forever).  With embers-but-not-enough, coach toward gathering more.
  const hasEmbers = runEmbers() > 0;
  const canKindle = hasEmbers && !treeTaught() && canKindleNow();
  const coach = canKindle
    ? `<div class="map-coach">✦ You tore <b>${runEmbers()} embers</b> from the dead — open your <b>EMBER TREE</b> below and kindle your first skill before you press on.</div>`
    : (hasEmbers && !treeTaught()
      ? `<div class="map-coach map-coach-soft">✦ <b>${runEmbers()} embers</b> gathered. Fell a few more foes and you’ll have enough to kindle a skill in the <b>EMBER TREE</b>.</div>`
      : '');
  // WHAT YOU CARRIED DOWN (Build 285) — the relic was chosen on a screen you
  // passed through once and then never saw again, so a decision made before the
  // first step spent the whole run invisible. It rides the descent header now,
  // named, with its cost, because a cost you have forgotten is not a cost.
  const rl = heldRelic();
  const relicStrip = rl
    ? `<span class="map-relic" title="${rl.name} — ${rl.rule.replace(/<[^>]+>/g, '')} ✕ ${rl.cost.replace(/<[^>]+>/g, '')}">${rl.icon}<span class="mr-n">${rl.name}</span></span>`
    : '';
  const boonStrip = (RUN.boons && RUN.boons.length)
    ? `<span class="map-boons">${RUN.boons.map(id => { const b = BOON_BY_ID[id]; return b ? `<span class="map-boon" data-boon="${id}" style="--tint:${HEROES[b.hero].tint}" title="${HEROES[b.hero].name}’s ${b.name} — ${b.desc.replace(/<[^>]+>/g, '')}">${b.icon}</span>` : ''; }).join('')}</span>`
    : '';
  showOverlay(`
    <div class="ov-eyebrow">THE DESCENT${(RUN.floor || 1) >= 2 ? ` · FLOOR ${RUN.floor}` : ''}${moodDef && moodDef.label ? ` <span class="map-mood" style="color:${moodDef.tint}; border-color:${moodDef.tint}66">♦ ${moodDef.label}</span>` : ''}${relicStrip}${boonStrip}</div>
    <div class="ov-title" style="font-size:20px; margin-bottom:14px;">${(RUN.floor || 1) >= 2 ? 'THE DEEPER DARK' : 'CHOOSE THE ROAD'}</div>
    <div class="map-strip"><svg class="map-edges" aria-hidden="true"></svg>${colHtml}</div>
    ${coach}
    <div class="map-footer">
      <button class="party-chip" id="map-party">
        ${trio}
        <span class="party-chip-meta">PARTY · resonates as <b>✦ ${r.name}</b> <i>(${r.type})</i>${benched.length ? ` · <b>${benched.length} benched</b> — tap to swap` : ''}</span>
      </button>
      <button class="map-tree-btn${canKindle ? ' mt-glow mt-teach' : (hasEmbers ? ' mt-glow' : '')}" id="map-tree">✦ EMBER TREE<span class="mt-embers">${runEmbers()}</span></button>
    </div>
  `, 'map-screen');
  document.querySelectorAll('.map-boon').forEach(el => attachBoonInspect(el, el.dataset.boon));
  document.querySelectorAll('.map-node.mn-reach').forEach(el => {
    el.onclick = () => enterMapNode(mapNode(+el.dataset.node));
  });
  $('#map-party').onclick = () => showPartySelect(() => showMap());
  // the tree only holds your PARTY's constellations — open on the first member
  $('#map-tree').onclick = () => showEmberTree(showMap, (RUN.active && RUN.active[0]) || 'ash');
  // draw the connecting edges once the overlay has laid out (two frames so the
  // scale/opacity intro is settled and node positions are final)
  requestAnimationFrame(() => requestAnimationFrame(drawMapEdges));
}
// Curved connector edges: a bright GOLD trail through the nodes you've walked,
// highlighted edges for the choices open right now, dim for the road ahead.
function drawMapEdges() {
  const strip = document.querySelector('.map-strip');
  const svg = strip && strip.querySelector('.map-edges');
  if (!strip || !svg) return;
  const sr = strip.getBoundingClientRect();
  if (!sr.width) return;
  svg.setAttribute('viewBox', `0 0 ${sr.width} ${sr.height}`);
  const centerOf = (id) => {
    const el = strip.querySelector(`.map-node[data-node="${id}"] .mn-icon`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2 - sr.left, y: r.top + r.height / 2 - sr.top };
  };
  let html = '';
  mapAll().forEach(n => {
    const a = centerOf(n.id); if (!a) return;
    (n.next || []).forEach(nid => {
      const b = centerOf(nid); if (!b) return;
      const nDone = RUN.completed.includes(n.id);
      const mDone = RUN.completed.includes(nid);
      const mReach = nodeReachable(mapNode(nid));
      const cls = (nDone && mDone) ? 'me-taken' : (nDone && mReach) ? 'me-open' : 'me-future';
      const mx = (a.x + b.x) / 2;
      html += `<path class="me ${cls}" d="M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}"/>`;
    });
  });
  svg.innerHTML = html;
}
function resolveMapNode(n) {
  if (n.type === 'fight' || n.type === 'elite' || n.type === 'boss') startMapFight(n);
  else if (n.type === 'recruit') showRecruit(n);
  else if (n.type === 'camp') showCamp(n);
  else if (n.type === 'event') showEvent(n);
}
function enterMapNode(n) {
  hideOverlay();
  if (n.mem) { showMemory(n, n.mem); return; }
  resolveMapNode(n);
}
// Discovery of a fallen descent.  Build 210 (the corpse run): if the fallen
// carried embers, the Abyss KEEPS them — and what it keeps, it USES.  Their
// echo guards the ashes: face it to take everything back, or let them rest and
// carry only the blessing.  This is the twist said out loud — the echoes you
// fight on this road are previous descents.
function showMemory(n, mem) {
  const names = mem.trio.map(id => (HEROES[id] || {}).name || id).join(' · ');
  const th = (mem.threads || []).length;
  const emb = mem.embers || 0;
  const consume = () => {
    const abyss = loadAbyss();
    delete abyss[n.memLevel != null ? n.memLevel : n.level];
    saveAbyss(abyss);
    n.mem = null;
    saveRun();
  };
  const bless = () => {
    RUN.bonds = RUN.bonds || {};
    (mem.threads || []).forEach(k => { RUN.bonds[k] = (RUN.bonds[k] || 0) + 1; });
    RUN.roster.forEach(id => { RUN.hp[id] = Math.min(HEROES[id].maxHp, (RUN.hp[id] || HEROES[id].maxHp) + 4); });
    RUN._ashes = mem.label || 'the dark';   // carried — the ending remembers them (Build 210)
  };
  showOverlay(`
    <div class="ov-eyebrow">♰ ASHES OF A DESCENT</div>
    <div class="ov-title" style="font-size:20px">SOMEONE FELL HERE</div>
    <div class="ov-lines" style="text-align:center; min-height:0">
      <div class="ov-line"><b>${names}</b> — they made it this far, once.</div>
      <div class="ov-line">${th ? `Their ${th} bond${th > 1 ? 's' : ''} still hum in the cold air.` : 'The ashes are quiet, but still warm.'}</div>
      ${emb ? `<div class="ov-line">And they did not fall alone. <b>The Abyss kept them</b> — and what it keeps, it <b>uses</b>. Their echo stands over <b>✦ ${emb} embers</b> that were theirs.</div>` : ''}
    </div>
    ${emb ? `<button class="ov-btn primary" id="ov-face">FACE THEIR ECHO</button>
    <button class="ov-btn" id="ov-takeup">LET THEM REST</button>
    <div class="ov-hint">FACE: WIN BACK ✦ ${emb} + THEIR BONDS · REST: ${th ? '+1 ♡ PER BOND · ' : ''}HEAL 4 — THE EMBERS STAY THEIRS</div>`
    : `<button class="ov-btn primary" id="ov-takeup">TAKE UP THEIR BOND</button>
    <div class="ov-hint">${th ? '+1 ♡ TO EACH BOND THEY HELD · ' : ''}THE PARTY HEALS 4 BY THEIR FIRE</div>`}
  `);
  const faceBtn = $('#ov-face');
  if (faceBtn) faceBtn.onclick = () => {
    consume();
    hideOverlay();
    flashNarrator('The ashes rise wearing the faces of the fallen — the Abyss spends what it keeps.');
    startFight({ type: 'fight', chapter: 3, heroes: RUN.active.slice(),
      enemies: mem.trio.map(id => ensureFoeDef(id)),
      useRunHp: true, mapId: n.id, depth: n.level || n.col, floor: RUN.floor || 1,
      nodeType: 'fight', label: 'ECHOES OF THE FALLEN', level: n.level,
      memEmbers: emb, memThreads: (mem.threads || []).slice(), memLabel: mem.label || 'the dark',
      narrator: 'ECHOES OF THE FALLEN — they were a descent, once. Set them down gently.' });
    $('#chapter-chip').textContent = 'ECHOES';
  };
  $('#ov-takeup').onclick = () => {
    bless();
    consume();
    hideOverlay();
    resolveMapNode(n);
  };
}
function showEvent(n) {
  const ev = EVENTS_V2[n.eventId] || EVENTS_V2.shrine;
  const choice = (c, id, extra) => `
    <button class="ev-choice${extra ? ' ' + extra : ''}" id="${id}">
      <span class="ev-choice-icon">${c.icon || '◆'}</span>
      <span class="ev-choice-body">
        <span class="ev-choice-label">${c.label}</span>
        <span class="ev-choice-effect">${c.effect || ''}</span>
      </span>
    </button>`;
  // Build 211: a third option can hide behind a COMPANION — party composition
  // pays off outside combat ("only Hask could open this door").
  const cOpen = ev.c && (!ev.c.needs || ((RUN.active || []).includes(ev.c.needs)));
  showOverlay(`
    <div class="ov-eyebrow">${ev.eyebrow || 'A CROSSROADS'}</div>
    <div class="ov-title" style="font-size:22px">${ev.title}</div>
    <div class="ov-lines" style="text-align:center; min-height:0">${ev.lines.map(t => `<div class="ov-line">${t}</div>`).join('')}</div>
    <div class="ev-choices">${choice(ev.a, 'ev-a')}${choice(ev.b, 'ev-b')}${cOpen ? choice(ev.c, 'ev-c', 'ev-locked-in') : ''}</div>
  `, 'event-screen');
  const finish = (choice) => {
    if (!RUN.completed.includes(n.id)) RUN.completed.push(n.id);
    if (choice.fx) choice.fx();   // a blood-price can PRECEDE the gift (Thorned Idol)
    if (choice.boon) {   // this branch offers a companion's gift — into the draft
      saveRun();
      showBoonDraft(() => showMap(), { eyebrow: ev.title.toUpperCase(), title: 'A COMPANION’S GIFT', flavor: 'They show you a piece of how they fight. Take one — it holds until you fall.' });
      return;
    }
    saveRun();
    showMap();
  };
  $('#ev-a').onclick = () => finish(ev.a);
  $('#ev-b').onclick = () => finish(ev.b);
  const evC = $('#ev-c'); if (evC) evC.onclick = () => finish(ev.c);
}
function startMapFight(n) {
  const boss = !!n.isBoss;
  const floor = RUN.floor || 1;
  const begin = () => {
    let enemies = n.enemies.slice();
    let ambush = '';
    // A wronged traveler has been waiting on the road — they spring the ambush
    // now (never onto a boss; the boss is its own reckoning).
    if (!boss && RUN.foes && RUN.foes.length) {
      const foes = RUN.foes.splice(0);
      foes.forEach(fid => enemies.push(ensureFoeDef(fid)));
      ambush = ' — ' + foes.map(fid => 'VENGEFUL ' + HEROES[fid].name).join(' & ') + ' springs from cover.';
      saveRun();
    }
    startFight({ type: 'fight', chapter: 3, heroes: RUN.active.slice(), enemies,
      useRunHp: true, mapId: n.id, depth: n.level || n.col, floor, elite: !!n.elite, isBoss: boss,
      nodeType: n.type, label: n.label, level: n.level, ambush: !!ambush,
      narrator: ambush ? (n.label + ambush) : n.label + (boss ? (floor >= 2 ? ' — it is hungry.' : ' — it remembers you.') : (n.elite ? ' — a deeper sin waits.' : (floor >= 2 ? ' — the deep dark stirs.' : ''))) });
    $('#chapter-chip').textContent = ambush ? 'AMBUSH' : (boss ? 'BOSS' : (n.elite ? 'ELITE' : 'DESCENT')) + (floor >= 2 ? ' · FL' + floor : '');
  };
  if (boss) bossIntro(n.enemies[0], begin);   // a dramatic cutscene precedes the boss
  else begin();
}

// ---------------------------------------------------------------------------
// BOSS INTRO — a dramatic full-screen cutscene: the colossus rises from the
// dark, its eyes ignite, its NAME slams the screen, it speaks — then the fight.
// ---------------------------------------------------------------------------
const BOSS_CINE = {
  echoknight2:  { name: 'THE ECHO KNIGHT', epithet: 'THE REMEMBERED', eye: '#ff5038', roar: 'blade',
    quote: 'You buried me once. I have counted every hand that threw the dirt.' },
  echodevourer: { name: 'THE HOLLOW MAW', epithet: 'IT HUNGERS', eye: '#a86bff', roar: 'maw',
    quote: 'Down here, everything is food. Even the little light you carry.' },
  echosunder:   { name: 'THE SUNDERING', epithet: 'IT CUTS THE BONDS', eye: '#8fe0d0', roar: 'maw',
    quote: 'Every bond you tie, I have already cut. You came down together — you will not leave that way.' },
  echochorus:   { name: 'THE HOLLOW CHORUS', epithet: 'ALL ECHOES ARE ITS VOICE', eye: '#e8b84a', roar: 'maw',
    quote: 'Knight. Maw. Sundering — three voices you have already silenced. I am the one that sang them all.' },
};
// ── THE CHORUS NARRATES YOUR DEATHS (Build 211, Phase 2) — boss greetings key
// off PERSISTENT history, Hades-style: a fresh meeting gets the authored quote;
// a returner after a death, a road carrying a fallen trio's ashes, or a trio
// with a ranked vow each get their own line.  Every death mints dialogue free.
const BOSS_HISTORY = {
  echoknight2: {
    fallen: 'You fell at {WHERE}. I know — I was given the memory. It tasted of you.',
    deaths: 'Again. I have worn the faces of everyone who kept coming back. Yours is nearly ready.',
    death:  'Back again. The dirt remembers being thrown, and I remember the throwing.',
    vow:    'A vow. The last company that swore one swore it to me, at the end. Say yours louder.',
  },
  echodevourer: {
    fallen: 'The ones from {WHERE} passed this way. Do not worry — nothing is wasted in me.',
    deaths: 'You keep bringing me the same three flavors. I keep making room.',
    death:  'I remember your taste. Come — the second bite is the honest one.',
    vow:    'A sworn trio. Marrow and vow together — the rarest meal on the road.',
  },
  echosunder: {
    fallen: 'I cut the bonds of the three who fell at {WHERE}. They held hands anyway, at the end. It changed nothing.',
    deaths: 'Every time you return, you arrive more tightly woven. Good. Taut threads cut cleanest.',
    death:  'You again — and still knotted to each other. I unpicked you once. Hold still.',
    vow:    'That vow again. I have cut it twice in older throats. Say it anyway — I collect the brave ones.',
  },
  echochorus: {
    fallen: 'The three from {WHERE} sing in me now. Listen as we fight — you will know the voices.',
    deaths: 'Every party you have lost is a verse of mine now. You are not climbing down to silence me. You are climbing down to hear them.',
    death:  'You died below me once already. I kept it — the note you made. Shall I sing it back?',
    vow:    'A ranked vow, carried to the bottom. When I take you, it will be the finest thing I hold.',
  },
};
function bossHistoryQuote(bossId) {
  const alt = BOSS_HISTORY[bossId]; if (!alt) return null;
  try {
    const abyss = loadAbyss();
    const lvls = Object.keys(abyss);
    const fell = lvls.length ? abyss[lvls[0]] : null;
    if (fell && alt.fallen) return alt.fallen.replace('{WHERE}', (fell.label || 'the dark').toUpperCase());
    const deaths = META.deaths || 0;
    if (deaths >= 3 && alt.deaths) return alt.deaths;
    const trio = (RUN && RUN.active && RUN.active.length === 3) ? RUN.active : null;
    if (trio && vowRank(trio.map(id => HEROES[id].cls).sort().join('+')) >= 2 && alt.vow) return alt.vow;
    if (deaths > 0 && alt.death) return alt.death;
  } catch (_) {}
  return null;
}
let _bossCineBusy = false;
function bossIntro(bossId, onDone) {
  const c = BOSS_CINE[bossId] || BOSS_CINE.echoknight2;
  const def = ENEMY_DEFS[bossId] || {};
  const art = V2PORTRAITS[def.art || bossId] || '';
  const hq = bossHistoryQuote(bossId);
  bossCine(Object.assign({ art, skip: 'TAP TO FACE IT' }, c, hq ? { quote: hq } : {}), onDone);
}
// A mid-fight STAGE cutscene for the mega boss: its form shatters and reforms
// into the next aspect.  Reuses the boss-intro presentation with the stage's own
// name / epithet / eye-colour / quote.
function megaStageCine(stage, onDone) {
  bossCine({ name: 'THE HOLLOW CHORUS', epithet: stage.epithet || stage.name, sub: stage.name,
    eye: stage.eye || '#e8b84a', roar: stage.roar || 'maw', quote: stage.quote || '',
    art: V2PORTRAITS[ENEMY_DEFS.echochorus.art] || '', skip: 'TAP TO FACE WHAT COMES', transition: true }, onDone);
}
// Shared boss cutscene: the colossus rises, eyes ignite, its NAME slams, it
// speaks — then the fight (or the next stage) begins.
function bossCine(c, onDone) {
  onDone = onDone || function () {};
  hideOverlay();
  $('#stage').classList.remove('show-bg');
  const old = document.getElementById('boss-cine'); if (old) old.remove();
  const el = document.createElement('div');
  el.id = 'boss-cine';
  el.className = (c.roar === 'maw' ? 'bc-maw' : 'bc-knight') + (c.transition ? ' bc-transition' : '');
  el.style.setProperty('--bc-eye', c.eye);
  el.innerHTML = `
    <div class="bc-bar bc-bar-t"></div>
    <div class="bc-bar bc-bar-b"></div>
    <div class="bc-rays"></div>
    <div class="bc-vign"></div>
    <div class="bc-boss"><div class="bc-glow"></div><div class="bc-art">${c.art || ''}</div><div class="bc-eyes"><span></span><span></span></div></div>
    ${Array.from({ length: 16 }).map((_, i) => `<span class="bc-ember" style="--i:${i}"></span>`).join('')}
    <div class="bc-flash"></div>
    <div class="bc-txt">
      <div class="bc-epithet">${c.epithet}</div>
      <div class="bc-name">${c.name}</div>
      ${c.sub ? `<div class="bc-sub">— ${c.sub} —</div>` : ''}
      <div class="bc-rule"></div>
      <div class="bc-quote">“${c.quote}”</div>
    </div>
    <div class="bc-skip">${c.skip || 'TAP TO FACE IT'}</div>`;
  $('#stage').appendChild(el);
  _bossCineBusy = true;
  requestAnimationFrame(() => el.classList.add('bc-run'));
  const timers = [];
  const at = (ms, fn) => timers.push(setTimeout(fn, ms));
  at(260,  () => { if (SFX.enemy) SFX.enemy(); stageShake('sm'); });                        // the ground rumbles
  at(1150, () => { if (SFX.kill) SFX.kill(); stageShake('lg'); el.classList.add('bc-eyes-on'); });  // eyes ignite
  at(2050, () => { if (SFX.kill) SFX.kill(); if (SFX.enemy) SFX.enemy(); stageShake('xl'); el.classList.add('bc-slam'); });  // NAME slams
  at(2450, () => stageShake('md'));
  let done = false;
  const finish = () => {
    if (done) return; done = true;
    timers.forEach(clearTimeout);
    el.classList.add('bc-out');
    setTimeout(() => { el.remove(); _bossCineBusy = false; onDone(); }, 460);
  };
  el.addEventListener('pointerdown', finish);
  at(6400, finish);   // auto-advance if they don't tap
  return el;
}
// ── MEGA-BOSS STAGES ────────────────────────────────────────────────────────
// The Hollow Chorus is one body with three aspects.  `e.def` is swapped to the
// live stage (a merge of the base def + the stage), so every read of intents /
// weak / aura / name / HP just works with no other engine changes.
function initMegaBoss(e, heat) {
  e._baseDef = ENEMY_DEFS.echochorus;       // the shared shell (art, flags, attacksPerRound)
  e._stages = e._baseDef.stages;
  e.stageHpMul = 1 + (heat || 0) * 0.12;    // HEAT scales EACH stage, not just the first
  enterMegaStage(e, 0);                     // dmgMul was already rolled by the boss ramp
}
function enterMegaStage(e, i) {
  const st = e._stages[i];
  e.stage = i;
  e.def = Object.assign({}, e._baseDef, st);   // live stage view (st overrides name/weak/aura/intents/maxHp)
  e.maxHp = Math.round((st.maxHp || 160) * (e.stageHpMul || 1));
  e.hp = e.maxHp;
  e.intentIdx = 0; e.power = 0; e.guard = 0; e.mark = 0; e.lull = 0;
  e.weakRevealed = false; e.weakened = false; e.staggered = false; e.echoStored = null;
}
// A stage falls in TWO beats: (1) the current aspect visibly DIES — it shatters,
// a death-burst blooms, the field rocks — held long enough to read as a KILL;
// then (2) the reform cutscene, and the Chorus rises in its next aspect at full
// stage HP.  The party's HP/threads carry over — the war of attrition is the point.
function megaStageBreak(e) {
  const next = e.stage + 1;
  const st = e._stages[next];
  S._staging = true;
  e.hp = 0; e.staggered = false;
  e._justDied = true;                       // renderFloorBoss keeps the dying treatment through the beat
  const el = figEl(e.uid);
  const fell = (e.def && e.def.name) || 'THE CHORUS';
  // BEAT 1 — the death.  Same visual language as a real kill, dialed up.
  flashNarrator('✦ ' + fell + ' — SILENCED.');
  popupAt(el, '☠ ' + fell + ' FALLS', 'dmg popup-big');
  if (SFX.kill) SFX.kill();
  stageShake('xl'); hitFlash(3);
  if (el) { el.classList.add('fig-dying'); deathBurst(el); }
  // A hard whip-pan onto the thing that just came apart, tilted off true —
  // the biggest single camera move in a normal fight.
  camFocus(el, { z: 1.22, dz: 190, r: 1.8, yaw: 6.5, pitch: 2.1, ms: 115, pull: 0.85 });
  renderAll();
  // BEAT 2 — after the death lands, the reform cutscene, then rise anew.
  setTimeout(() => {
    e._justDied = false;
    camReset(700);
    megaStageCine(st, () => {
      enterMegaStage(e, next);
      S._staging = false;
      _bossFig = null;   // rebuild the boss figure for the new aspect (fresh aura/filters)
      flashNarrator('THE HOLLOW CHORUS reforms — ' + st.name + '.');
      if (SFX.enemy) SFX.enemy();
      renderAll();
    });
  }, 1250);   // let the death read as a KILL before the reform begins
}
// KINDLE BURST — the moment a skill catches.  A full-screen ember-bloom over the
// tree: the node's glyph ignites, ember shards fan out, the skill NAME slams in
// and its effect line resolves.  Short, skippable, then back to the tree.
let _kindleBusy = false;
function kindleBurst(node, onDone) {
  const heroName = (HEROES[node.hero] && HEROES[node.hero].name) || '';
  const tint = (HEROES[node.hero] && HEROES[node.hero].tint) || '#e8b84a';
  const glyph = TREE_TYPE_GLYPH[node.type] || '✦';
  const kind = TREE_TYPE_LABEL[node.type] || 'SKILL';
  const old = document.getElementById('kindle-fx'); if (old) old.remove();
  const el = document.createElement('div');
  el.id = 'kindle-fx';
  el.className = 'kf t-' + node.type;
  el.style.setProperty('--kf-tint', tint);
  el.innerHTML = `
    <div class="kf-scrim"></div>
    <div class="kf-rays"></div>
    <div class="kf-flash"></div>
    <div class="kf-core">
      <div class="kf-halo"></div>
      <div class="kf-glyph">${glyph}</div>
      ${Array.from({ length: 18 }).map((_, i) => `<span class="kf-shard" style="--i:${i}"></span>`).join('')}
    </div>
    <div class="kf-txt">
      <div class="kf-eyebrow">${heroName} · NEW ${kind}</div>
      <div class="kf-name">${node.label}</div>
      <div class="kf-rule"></div>
      <div class="kf-desc">${nodeDescHTML(node.desc)}</div>
    </div>
    <div class="kf-skip">TAP TO CONTINUE</div>`;
  $('#stage').appendChild(el);
  _kindleBusy = true;
  if (SFX.kindle) SFX.kindle();
  requestAnimationFrame(() => el.classList.add('kf-run'));
  const timers = [];
  const at = (ms, fn) => timers.push(setTimeout(fn, ms));
  at(120, () => stageShake('sm'));
  at(620, () => { stageShake('md'); el.classList.add('kf-slam'); if (SFX.follow) SFX.follow(); });
  let done = false;
  const finish = () => {
    if (done) return; done = true;
    timers.forEach(clearTimeout);
    el.classList.add('kf-out');
    setTimeout(() => { el.remove(); _kindleBusy = false; (onDone || function () {})(); }, 360);
  };
  el.addEventListener('pointerdown', () => { if (el.classList.contains('kf-ready')) finish(); });
  at(700, () => el.classList.add('kf-ready'));   // ignore stray taps during the slam
  at(3600, finish);   // auto-advance
  return el;
}
// ===========================================================================
// TRAVELER ENCOUNTERS — you're all clawing out of the same abyss, and you cross
// paths on the way up.  Recruitment is a short BG3-style CONVERSATION: what you
// SAY across two beats decides how it lands.  The talk sets the TERMS:
//   friend  — you met them warm         → they walk with you, a bond already bound
//   neutral — pragmatic / wary          → they walk with you, no bond yet (warmth is earned)
//   decline — "not this time"           → nobody joins, nobody is wronged; they stay
//                                          in the pool and can surface again, but the
//                                          WARM opening is spent (Build 268)
//   refuse  — you decline them TWICE    → they stop offering and leave the descent
//   foe     — you crossed them          → they leave resentful and AMBUSH you later
// It all lives on RUN and wipes on death — every descent the conversation can
// go a different way and hand you a differently-tempered party.
// Each option carries a `tone` (warm > 0, guarded = 0, cold < 0); `hostile`
// marks the line that crosses them for good.  b1 tone picks the reply bucket;
// the running total resolves the encounter.
// ===========================================================================
const TRAVELERS = {
  cassia: {
    eyebrow: 'A BANNER IN THE DUST', speaker: 'CASSIA',
    scene: 'A knight kneels in a broken gate, her sword driven through a fallen banner. Same climb as you — she only stopped to bury one of her own.',
    line1: 'If you’re here for the sword, take it and go. If you’re here to ask who carried it — don’t.',
    opts1: [
      { text: 'Keep your sword. Keep the grief, too. Just carry them up with us.', tone: 2 },
      { text: 'I only need to know one thing. Can you still fight?', tone: 0 },
      { text: 'Then finish burying your dead and stay out of our way.', tone: -1 },
    ],
    react: {
      warm:    'Plenty have offered to take the blade. You’re the first to offer to share the weight.',
      guarded: 'Blunt. I can respect blunt. Yes — I can still fight.',
      cold:    'Travel light, travel fast. That’s exactly how the last group climbed. None of them made it.',
    },
    opts2: {
      warm:    [ { text: 'Then get up. Whatever you buried, it’s behind you now.', tone: 2 }, { text: 'We hold the line together, or none of us climb.', tone: 1 } ],
      guarded: [ { text: 'Good. Then walk with us — the whole way up.', tone: 2 }, { text: 'Then take the front. That’s all I’m asking.', tone: 0 } ],
      cold:    [ { text: '…Alright. Come on, then. Just keep pace.', tone: 2 }, { text: 'Take the sword. Leave her in the dirt.', tone: -2, hostile: true } ],
    },
  },
  elin: {
    eyebrow: 'A TRAIL OF LINEN', speaker: 'ELIN',
    scene: 'She’s binding a dead man’s wound as gently as if he could still feel it. Climbing out like everyone — she just can’t bring herself to step over the fallen.',
    line1: 'I mend anyone still walking. So — are you walking? Or just bleeding somewhere quiet?',
    opts1: [
      { text: 'Still walking. And we’d get a lot farther with you beside us.', tone: 2 },
      { text: 'Bleeding, if I’m honest. Can you do anything about that?', tone: 0 },
      { text: 'The dead are past helping. We don’t have time — for them or you.', tone: -1 },
    ],
    react: {
      warm:    'Then let me keep you on your feet. It’s the only thing I’ve ever been good for.',
      guarded: 'Most things, yes. Now hold still and stop arguing with me.',
      cold:    'They had names, the dead. …But the living have farther to go. I know that better than anyone.',
    },
    opts2: {
      warm:    [ { text: 'Stay close behind us. We’ll keep the dark off you.', tone: 2 }, { text: 'Come with us. No one else dies today.', tone: 1 } ],
      guarded: [ { text: 'Fair enough. From here, you’re one of us.', tone: 2 }, { text: 'Just keep the party breathing. That’s the deal.', tone: 0 } ],
      cold:    [ { text: '…You’re right to stay. Come with us instead — please.', tone: 2 }, { text: 'Take whatever supplies she’s got and move on.', tone: -2, hostile: true } ],
    },
  },
  mira: {
    eyebrow: 'A KNIFE IN THE DARK', speaker: 'MIRA',
    scene: 'Three bodies cool behind her, and you never heard a sound. She’s been carving her own way up — alone, and sick of it.',
    line1: 'You move loud enough to wake the dead. Someone ought to watch the dark for you. …Don’t make me sorry I offered.',
    opts1: [
      { text: 'We’re all clawing out of the same hole. Watch it with us.', tone: 2 },
      { text: 'You’re good in the dark. Keep pace and you’ve earned a place.', tone: 0 },
      { text: 'Go watch the dark for someone else. We’re fine.', tone: -1 },
    ],
    react: {
      warm:    'Huh. Most people flinch when I speak. …Fine. I’ll keep you breathing.',
      guarded: 'A clean arrangement. I can work with clean arrangements.',
      cold:    'Suit yourself. The dark’s patient. So am I.',
    },
    opts2: {
      warm:    [ { text: 'So what are you really running from?', tone: 2 }, { text: 'Then stay close. We don’t leave people behind.', tone: 1 } ],
      guarded: [ { text: 'Carry your weight and there’s no trouble.', tone: 2 }, { text: 'Keep your eyes on the dark. Nothing more.', tone: 0 } ],
      cold:    [ { text: '…Actually — wait. We could use eyes like yours.', tone: 2 }, { text: 'Try lifting her blades while she’s talking.', tone: -2, hostile: true } ],
    },
  },
  branwen: {
    eyebrow: 'EYES ON THE TREELINE', speaker: 'BRANWEN',
    scene: 'An arrow buries itself by your head before you ever see her. She steps out with the bow already lowered — one more climber who’d sooner watch you than trust you.',
    line1: 'Relax. If I wanted you dead, you’d never have read this far. Climb with no eyes on the treeline and you don’t climb at all. Let me be yours.',
    opts1: [
      { text: 'Eyes we can trust would be worth a lot. Walk with us.', tone: 2 },
      { text: 'Lower that a little further and we’ll talk.', tone: 0 },
      { text: 'We don’t take arrows from strangers in the dark.', tone: -1 },
    ],
    react: {
      warm:    'Trust. That’s a bold word, this far down. …I’ll earn it, then.',
      guarded: 'Already lowered, see? The reasonable sort of dangerous.',
      cold:    'Smart. Trust gets people killed down here. …Doesn’t mean you don’t still need me.',
    },
    opts2: {
      warm:    [ { text: 'You take the high ground, we’ll take the low.', tone: 2 }, { text: 'Then no one walks into the dark blind again.', tone: 1 } ],
      guarded: [ { text: 'Good enough for me. Fall in.', tone: 2 }, { text: 'Just call out what you see.', tone: 0 } ],
      cold:    [ { text: '…But we do need you. Come on.', tone: 2 }, { text: 'Cut her bowstring and leave her here.', tone: -2, hostile: true } ],
    },
  },
  _default: {
    eyebrow: 'A STRANGER ON THE PATH', speaker: 'STRANGER',
    scene: 'Another climber out of the same dark. They stop when you stop, and wait.',
    line1: 'You’re climbing out too, then. …Two backs are better than one down here.',
    opts1: [
      { text: 'Then let’s climb together.', tone: 2 },
      { text: 'Keep pace, and we’ll see how it goes.', tone: 0 },
      { text: 'We climb on our own.', tone: -1 },
    ],
    react: {
      warm:    'Good. I was getting tired of my own company.',
      guarded: 'Fair. I’ll earn my place on the way up.',
      cold:    '…Going it alone gets you killed. But it’s your climb.',
    },
    opts2: {
      warm:    [ { text: 'Then stay close.', tone: 2 }, { text: 'No one gets left behind.', tone: 1 } ],
      guarded: [ { text: 'Alright — you’re one of us now.', tone: 2 }, { text: 'Just keep up.', tone: 0 } ],
      cold:    [ { text: '…Fine. Come on.', tone: 2 }, { text: 'Take what they’re carrying and go.', tone: -2, hostile: true } ],
    },
  },
};
const toneBucket = (t) => t > 0 ? 'warm' : t < 0 ? 'cold' : 'guarded';
// PARTY-AWARE DEPTH — when a specific ally is already in your line, they speak
// up in the encounter and open a warm shortcut: shared history vouching for the
// stranger.  (Bonus option lands friend; tone 3.)
const TRAVELER_ALLIES = {
  cassia:  { elin:    { line: 'She held the gate at Vael Crossing until every last one of us was through. I owe her my life.', bonus: 'Elin says you held the line. That’s good enough for me.' } },
  elin:    { cassia:  { line: 'She stitched me back together once. I only walked away because of her. Bring her along.',       bonus: 'Cassia’s alive because of you. Come with us.' } },
  mira:    { branwen: { line: 'I’ve held a treeline beside this one. She kills quiet, and she never misses.',                  bonus: 'Branwen vouches for you. Watch the dark with us.' } },
  branwen: { mira:    { line: 'She was the knife I never heard coming. I’d rather she watched our backs than a stranger’s.',    bonus: 'Mira trusts you. Take the high line with us.' } },
};
function activeAllyFor(n) {
  const map = TRAVELER_ALLIES[n.hero];
  if (!map || !RUN || !RUN.active) return null;
  for (const id of RUN.active) { if (id !== n.hero && map[id]) return { id, entry: map[id] }; }
  return null;
}
// PARTY MOOD — a per-run read on how your line is carrying itself, drawn from
// the bonds you've kindled and the names you've made enemies of.  Travelers
// read it in their opening; the map shows it as a chip.  Resets with the run.
const MOODS = {
  lonely:    { label: 'ALONE',     tint: '#8ea2c8', read: 'You’re travelling light. Too light for a place like this.' },
  hunted:    { label: 'HUNTED',    tint: '#e8604a', read: 'Word travels fast down here. You’ve left angry names in your wake.' },
  ironbound: { label: 'IRONBOUND', tint: '#f0d488', read: 'There’s real trust between your people. I can see it from here.' },
  warm:      { label: 'HOLDING',   tint: '#e8b84a', read: 'Your line watches each other’s backs. That’s rare, this deep.' },
  wary:      { label: 'WARY',      tint: '#c89a5a', read: 'You carry yourselves like people who’ve been crossed. Can’t blame you.' },
  steady:    { label: 'STEADY',    tint: '#b8a88a', read: '' },
};
function partyMood() {
  if (!RUN) return 'steady';
  const active = RUN.active || [];
  const bonds = RUN.bonds || {};
  const kindled = Object.values(bonds).filter(v => v >= BOND_KINDLED).length;
  const warm = Object.values(bonds).filter(v => v >= 1).length;
  const foesMade = RUN.foesMade || 0;   // reputation persists past the ambush
  if (foesMade >= 2) return 'hunted';
  if (active.length <= 1) return 'lonely';
  if (kindled >= 2) return 'ironbound';
  if (foesMade >= 1) return 'wary';
  if (warm && warm >= active.length - 1) return 'warm';
  return 'steady';
}
// JRPG CUTSCENE — the party stands stage-LEFT, the stranger stage-RIGHT, and
// they talk across a dialogue box that advances one line at a time (tap to
// continue), then hands you a couple of short replies.  The lit side is whoever
// is speaking.  A present ally steps in to vouch; the traveler reads your mood
// as a first aside.  Resolves into the terms of the alliance — or a foe.
// Once you've MET a hero (they're unlocked from a past run), crossing paths
// again needs no unlock ceremony — just a familiar face and a quick word.
const REUNION_LINES = {
  cassia:  'Still climbing, I see. Good. …Room in that line for a shield?',
  elin:    'You look worse than the last time I patched you up. …Shall I walk with you again?',
  mira:    'You again. Loud as ever. …I’ll watch the dark for you. Same as before.',
  branwen: 'Knew our paths would cross again. Still no eyes on your treeline. Let me fix that.',
  hask:    'The cold followed me here too. …It’s warmer with company. Shall I?',
};
function showReunion(n) {
  const h = HEROES[n.hero];
  const trav = Object.assign({}, TRAVELERS[n.hero] || TRAVELERS._default, { eyebrow: 'A FAMILIAR FACE' });
  const st = { n, trav, tone: 0, hostile: false, ally: null, _beat2: true };   // one beat, no crossing
  const line = REUNION_LINES[n.hero] || 'A familiar face, this deep. …Room for one more?';
  jcPlay(st, [{ side: 'them', speaker: h.name, text: line }], () => {
    jcChoose(st, [
      { text: 'Always. Fall in.', tone: 2 },
      { text: 'We can use the hands. Keep pace.', tone: 0 },
      Object.assign({}, DECLINE_OPT.guarded),
    ]);
  });
}
// ── TURNED AWAY (Build 268) — the second meeting, after you climbed on without
// them.  They are not hostile; they are just no longer offering you the warm
// version.  This is the price of "not yet": you can still take them, but only on
// the wary terms, and refusing a second time ends it for the descent.
const TURNED_AWAY_LINES = {
  cassia:  'You walked past me once. I didn’t hold it against you — this place makes hard arithmetic of everyone. …The offer stands. It does not stand a third time.',
  elin:    'You went on without me. I hope nobody in your line paid for that. …I’m still here. I’m still willing. Ask properly this time.',
  mira:    'Oh, it’s you. You looked right at me and kept walking. …I’m not sulking. I’m just done pretending I don’t remember.',
  branwen: 'I watched you leave. Counted you out of my number and everything. …Say the word and I’ll count you back in. Say it once.',
  hask:    'You declined. I filed it, quite calmly, under *reasonable*. …I have since revised the entry twice. Well? Am I useful yet?',
  ash:     'You left me on that landing. …I’m not asking why. I’m asking whether you’ve changed your mind.',
};
function showTurnedAway(n) {
  const h = HEROES[n.hero];
  const trav = Object.assign({}, TRAVELERS[n.hero] || TRAVELERS._default, { eyebrow: 'THE ONE YOU PASSED' });
  const st = { n, trav, tone: 0, hostile: false, ally: null, _beat2: true, _turned: true };
  const line = TURNED_AWAY_LINES[n.hero] || 'You passed me once already. …Changed your mind, or just lost?';
  jcPlay(st, [{ side: 'them', speaker: h.name, text: line }], () => {
    // tone is capped at 0 on purpose — the WARM opening is gone for good, so
    // whatever you say here they walk in wary and the bond starts from nothing.
    jcChoose(st, [
      { text: 'I was wrong to leave you. Walk with us.', tone: 0 },
      { text: 'Nothing has changed. Climb your own way.', tone: 0, refuse: true },
    ]);
  });
}
function showRecruit(n) {
  // Someone you already turned away this descent gets the colder scene.
  if (RUN && RUN.declined && RUN.declined[n.hero]) return showTurnedAway(n);
  // A hero you've already met is a lighter beat — no full unlock cutscene.
  if (getUnlockedStarters().includes(n.hero)) return showReunion(n);
  const trav = TRAVELERS[n.hero] || TRAVELERS._default;
  const st = { n, trav, tone: 0, hostile: false, ally: activeAllyFor(n) };
  const open = [{ side: 'them', speaker: trav.speaker, scene: trav.scene, text: trav.line1 }];
  const mood = partyMood(), moodDef = MOODS[mood];
  if (moodDef && moodDef.read) open.push({ side: 'them', speaker: trav.speaker, text: moodDef.read, tint: moodDef.tint, aside: true });
  if (st.ally) open.push({ side: 'us', speaker: HEROES[st.ally.id].name, heroId: st.ally.id, text: st.ally.entry.line });
  jcPlay(st, open, () => {
    let opts = trav.opts1.slice();
    if (st.ally) opts = opts.concat([{ text: st.ally.entry.bonus, tone: 3, ally: true }]);
    jcChoose(st, opts);
  });
}
function jcPlay(st, lines, done) { st._lines = lines; st._li = 0; st._onDone = done; jcRenderSay(st); }
function jcRenderSay(st) { jcRender(st, { say: st._lines[st._li], more: st._li < st._lines.length - 1 }); }
function jcAdvance(st) {
  st._li++;
  if (st._li < st._lines.length) jcRenderSay(st);
  else st._onDone();
}
function jcChoose(st, opts) { st._opts = opts; jcRender(st, { choose: opts }); }
// THE THIRD ANSWER (Build 268).  Every traveler used to end in exactly two
// places: they walk with you, or you were cruel enough to make an enemy.  "No"
// was only reachable through malice — so a party you could not field kept
// growing, and a recruit node deep in a descent read as a reward while behaving
// as a chore.  This is the honest refusal: no debt, no grudge, no ambush.
const DECLINE_OPT = {
  warm:    { text: 'You’d be welcome. …But our line is full, and I won’t promise you a place I can’t give.', tone: 0, decline: true },
  guarded: { text: 'Not this time. Keep your own pace — the abyss isn’t so wide. We’ll cross again.', tone: 0, decline: true },
  cold:    { text: 'Then we climb our own ways. No hard words. Good luck with the dark.', tone: 0, decline: true },
};
function jcPick(st, o) {
  st.tone += (o.tone || 0);
  if (o.hostile) st.hostile = true;
  if (o.decline) st.declined = true;
  if (o.refuse) st.refused = true;
  if (!st._beat2) {
    st._beat2 = true;
    st.bucket = toneBucket(o.tone || 0);
    jcPlay(st, [{ side: 'them', speaker: st.trav.speaker, text: st.trav.react[st.bucket] }],
      () => jcChoose(st, st.trav.opts2[st.bucket].slice().concat([Object.assign({}, DECLINE_OPT[st.bucket] || DECLINE_OPT.guarded)])));
  } else {
    hideOverlay();
    if (st.hostile) return foeTraveler(st.n);
    if (st.refused) return refuseTraveler(st.n);
    if (st.declined) return declineTraveler(st.n);
    return joinTraveler(st.n, st.tone >= 2);   // warm total → friend; else a wary join
  }
}
// Render one frame: the party group (stage-LEFT), the stranger (stage-RIGHT),
// and the dialogue box (a typed line, or your replies).  The speaking side is
// lit; the other dims back.  The whole active line stands on the left, with the
// current speaker brought to the front.
function jcRender(st, content) {
  if (st._typeTimer) { clearInterval(st._typeTimer); st._typeTimer = null; }
  const n = st.n, trav = st.trav;
  const party = (RUN && RUN.active && RUN.active.length) ? RUN.active.slice() : ['ash'];
  const lead = party[0];
  let speaker = lead, lit = 'them', box = '';
  if (content.say) {
    const s = content.say;
    lit = s.side;
    if (s.side === 'us' && s.heroId) speaker = s.heroId;
    box = `
      <div class="jc-plate jc-plate-${s.side}">${s.speaker}</div>
      ${s.scene ? `<div class="jc-scene-cap">${s.scene}</div>` : ''}
      <div class="jc-line${s.aside ? ' jc-aside' : ''}"${s.tint ? ` style="color:${s.tint}"` : ''}></div>
      <div class="jc-next">tap ▸</div>`;
  } else {
    lit = 'us';
    box = `
      <div class="jc-plate jc-plate-us">${HEROES[lead].name}</div>
      <div class="jc-opts">${content.choose.map((o, i) =>
        `<button class="jc-opt tc-say${o.ally ? ' tc-vouch jc-vouch' : ''}" id="rc-say-${i}">${o.text}</button>`).join('')}</div>`;
  }
  // the party lineup: the speaker (or lead) stands front-and-lit; the rest fall
  // in behind, smaller and dimmer.
  const ordered = [speaker].concat(party.filter(id => id !== speaker));
  const leftFigs = ordered.map((id, i) =>
    `<span class="jc-hero${i === 0 ? ' jc-hero-lead jc-art' : ' jc-hero-back'}" style="--i:${i}">${V2PORTRAITS[id] || ''}</span>`).join('');
  showOverlay(`
    <div class="jc-scene jc-lit-${lit}">
      <div class="jc-eyebrow">${trav.eyebrow}</div>
      <div class="jc-fig jc-fig-l">${leftFigs}</div>
      <div class="jc-fig jc-fig-r"><span class="jc-art">${V2PORTRAITS[n.hero] || ''}</span></div>
      <div class="jc-box">${box}</div>
    </div>
  `, 'traveler-cine jc');
  // Advance on a tap of the SCENE itself (not #overlay) — the click that OPENED
  // this scene bubbles through the old DOM to #overlay, so binding there would
  // auto-skip the first line.  The fresh .jc-scene isn't in that bubble path.
  $('#overlay').onclick = null;
  const scene = $('.jc-scene');
  if (content.say) {
    const lineEl = $('.jc-line');
    jcType(st, lineEl, content.say.text);
    if (scene) scene.onclick = () => {
      if (st._typing) jcTypeDone(st, lineEl, content.say.text);   // first tap: finish the reveal
      else jcAdvance(st);                                         // second tap: next line
    };
  } else {
    content.choose.forEach((o, i) => { const b = $('#rc-say-' + i); if (b) b.onclick = (e) => { e.stopPropagation(); jcPick(st, o); }; });
  }
}
// TYPEWRITER — reveal a spoken line character by character; a tap completes it.
function jcType(st, el, text) {
  if (!el) return;
  st._typing = true;
  el.textContent = '';
  const scene = $('.jc-scene'); if (scene) scene.classList.add('jc-typing');
  let i = 0;
  st._typeTimer = setInterval(() => {
    i += 2;
    el.textContent = text.slice(0, i);
    if (i >= text.length) jcTypeDone(st, el, text);
  }, 20);
}
function jcTypeDone(st, el, text) {
  if (st._typeTimer) { clearInterval(st._typeTimer); st._typeTimer = null; }
  st._typing = false;
  if (el) el.textContent = text;
  const scene = $('.jc-scene'); if (scene) scene.classList.remove('jc-typing');
}
// FRIEND / NEUTRAL join — a friend arrives already threaded to the whole line.
function joinTraveler(n, friend) {
  const rid = n.hero, h = HEROES[rid];
  if (!RUN.roster.includes(rid)) RUN.roster.push(rid);
  RUN.hp[rid] = h.maxHp;
  unlockStarter(rid);
  if (RUN.active.length < 3 && !RUN.active.includes(rid)) RUN.active.push(rid);
  if (friend) {
    RUN.bonds = RUN.bonds || {};
    RUN.active.filter(id => id !== rid).forEach(id => { const k = pairKey(id, rid); RUN.bonds[k] = Math.max(RUN.bonds[k] || 0, 1); });
  }
  if (!RUN.completed.includes(n.id)) RUN.completed.push(n.id);
  saveRun();
  const beat = friend
    ? `You climb on together — and the talk carried. <b>${h.name}</b> walks at your side with a bond <b>already formed</b> between you.`
    : `<b>${h.name}</b> falls in with you — pragmatic, watchful. Two climbers, one dark. The warmth will have to be earned on the way up.`;
  showTravelerOutcome(rid, friend ? '♡ A BOND IS FORMED' : 'A WARY ALLIANCE', h.name + ' WALKS WITH YOU', beat, false, rid);
}
// DECLINE — you climb on without them, and nothing is owed either way.  They
// stay in the abyss, still climbing, so they stay in the recruit pool and can
// surface again on this floor or a deeper one.  What it costs you is the WARM
// opening: `showTurnedAway` caps the second meeting's tone, so a hero you passed
// can only ever join wary, and their bond starts from nothing.
function declineTraveler(n) {
  const rid = n.hero, h = HEROES[rid];
  RUN.declined = RUN.declined || {};
  RUN.declined[rid] = (RUN.declined[rid] || 0) + 1;
  if (!RUN.completed.includes(n.id)) RUN.completed.push(n.id);
  saveRun();
  showTravelerOutcome(rid, '◇ YOU CLIMB ON WITHOUT THEM', h.name + ' STAYS BEHIND',
    `You leave <b>${h.name}</b> to their own climb, and neither of you owes the other anything for it. They are still down here, still going up — <b>the abyss is not so wide</b>.<br><br>But you don’t get to be a stranger twice. Cross paths again and <b>the warm terms are gone</b>: they walk in wary, or not at all.`, false, null);
}
// REFUSE — the second no.  They stop offering, and drop out of the descent's
// recruit pool entirely (see `generateDescent`), so this floor and every floor
// below it is one companion shorter.
function refuseTraveler(n) {
  const rid = n.hero, h = HEROES[rid];
  RUN.refused = RUN.refused || [];
  if (!RUN.refused.includes(rid)) RUN.refused.push(rid);
  if (!RUN.completed.includes(n.id)) RUN.completed.push(n.id);
  saveRun();
  showTravelerOutcome(rid, '◇ THE OFFER IS WITHDRAWN', h.name + ' IS DONE ASKING',
    `Twice now. <b>${h.name}</b> doesn’t argue it — they simply stop looking at you, and the dark takes them the way it takes everyone who climbs alone.<br><br>They will <b>not surface again this descent</b>. Whatever they knew goes up the other way.`, false, null);
}
// FOE — you wrong them, and they mark you for it.  They vanish, then spring an
// AMBUSH at the next fight (a "vengeful <name>" built from their own kit).
function foeTraveler(n) {
  const rid = n.hero, h = HEROES[rid];
  RUN.foes = RUN.foes || [];
  if (!RUN.foes.includes(rid)) RUN.foes.push(rid);
  RUN.foesMade = (RUN.foesMade || 0) + 1;   // reputation — persists past the ambush (feeds mood)
  if (!RUN.completed.includes(n.id)) RUN.completed.push(n.id);
  saveRun();
  showTravelerOutcome(rid, '⚔ A NAME AGAINST YOU', h.name + ' TURNS AWAY',
    `You wrong <b>${h.name}</b>, and they mark you for it. They melt into the dark — but the reach is long, and they are <b>waiting on the road ahead</b>.`, true, null);
    // mustInclude is null: they did NOT join. It used to pass `rid`, which meant
    // that wronging someone while you already had four in the roster PINNED your
    // new enemy into the walking line.
}
// Shared cinematic outcome beat for friend / neutral / decline / refuse / foe.
// `mustInclude` is the hero who actually JOINED (null on every outcome where
// nobody did), and it is also what decides whether the exit re-opens the line —
// declining is now a way to keep your three and NOT be sent to the formation
// editor for a party that did not change.
function showTravelerOutcome(figId, eyebrow, title, beat, foe, mustInclude) {
  const reline = !!mustInclude && RUN.roster.length > 3;
  showOverlay(`
    <div class="tc-bar tc-bar-t"></div>
    <div class="tc-bar tc-bar-b"></div>
    <div class="tc-vign"></div>
    <div class="tc-body">
      <div class="tc-eyebrow${foe ? ' tc-eyebrow-foe' : ''}">${eyebrow}</div>
      ${figId ? `<div class="tc-portrait${foe ? ' tc-foe-art' : ''}"><span class="tc-glow"></span><span class="tc-art">${V2PORTRAITS[figId] || ''}</span></div>` : '<div class="tc-portrait tc-portrait-empty"></div>'}
      <div class="tc-name">${title}</div>
      <div class="tc-scene tc-scene-wide">${beat}</div>
      <div class="tc-choices"><button class="tc-choice tc-friend" id="rc-next"><span class="tc-c-label">${reline ? 'CHOOSE YOUR LINE' : 'ONWARD'}</span></button></div>
    </div>
  `, 'traveler-cine' + (foe ? ' tc-foe-scene' : ''));
  $('#rc-next').onclick = () => { hideOverlay(); reline ? showPartySelect(() => showMap(), mustInclude) : showMap(); };
}
// A "vengeful traveler" enemy synthesized from a wronged hero's own kit — you
// know how they fight, so they're weak to their own school.  Registered once.
function ensureFoeDef(heroId) {
  const id = 'foe_' + heroId;
  if (ENEMY_DEFS[id]) return id;
  const h = HEROES[heroId];
  const intents = [], seen = {};
  ['front', 'mid', 'back'].forEach(row => {
    const set = h.cards[row]; if (!set) return;
    [set.core, set.sig].forEach(cd => {
      if (cd && cd.fx && cd.fx.dmg && intents.length < 2 && !seen[cd.name]) {
        seen[cd.name] = 1; intents.push({ name: cd.name, dmg: Math.max(4, cd.fx.dmg), row });
      }
    });
  });
  if (!intents.length) intents.push({ name: 'Vengeful Strike', dmg: 5, row: 'front' });
  intents.push({ name: 'Steel Themselves', kind: 'buff', desc: 'sets their guard', guardSelf: 3 });
  ENEMY_DEFS[id] = { weak: h.school, name: 'VENGEFUL ' + h.name, maxHp: Math.round(h.maxHp * 0.6), art: heroId, intents, foeHero: heroId };
  return id;
}
// BOON DRAFT — a companion offers a GIFT: pick 1 of 3 (party-gated), held for
// this descent.  The mid-run randomness beat, shown at elites, events, the fire.
// ── EMBER SPARK (Build 211, Phase 2) — the after-every-fight draft.  Three
// unowned, reachable tree nodes from the FIELDED party surface at −30% cost;
// take one, or bank the pass for +2 embers.  The static tree becomes a per-run
// offer without a single new content system — this is the StS after-combat beat.
function showEmberSpark(onDone) {
  const done = onDone || (() => showMap());
  if (!RUN) { done(); return; }
  const party = (RUN.active && RUN.active.length) ? RUN.active : (RUN.roster || []);
  RUN.nodes = RUN.nodes || [];
  const pool = EMBER_TREE.filter(n => party.includes(n.hero) && !hasNode(n.id)
    && tierOpen(n.tier) && (n.requires || []).every(r => hasNode(r)))
    .map(n => ({ node: n, hero: n.hero }));
  // THE WEAVE (Build 245) — every bonded pair in the field also offers what one
  // can teach the other.  A crossing is a genuinely different pick from a node:
  // it is the only offer whose availability you CAUSED, by bonding those two.
  party.forEach(learner => crossOffersFor(learner)
    .forEach(n => pool.push({ node: n, hero: learner, cross: true })));
  if (!pool.length) { done(); return; }
  // prefer variety — one offer per fielded hero when possible
  const shuffled = _shuffle(pool.slice());
  const picks = [], used = new Set();
  shuffled.forEach(o => { if (picks.length < 3 && !used.has(o.hero)) { picks.push(o); used.add(o.hero); } });
  shuffled.forEach(o => { if (picks.length < 3 && picks.indexOf(o) < 0) picks.push(o); });
  // A node is offered at 30% off.  A CROSSING is priced by kinship instead —
  // it is already a discount on a thing you otherwise could not buy at all.
  const sparkCost = (o) => o.cross ? crossCost(o.hero, o.node) : Math.max(1, Math.round(o.node.cost * 0.7));
  // Reuse the BOON-DRAFT card language (portrait art · medallion · tinted frame)
  // so a post-fight reward reads instantly as "a gift from THIS companion",
  // not as a spreadsheet row.  Build 212.
  const cardHtml = (o) => {
    const n = o.node, cost = sparkCost(o), afford = runEmbers() >= cost;
    const h = HEROES[o.hero];                       // the card is always about the LEARNER
    // A COMMON stone belongs to nobody, so there is no `from` hero to name — and
    // reading HEROES[null] here is what killed the whole post-fight overlay.
    const other = n.common ? (n.pair.split('|').find(x => x !== o.hero) || null) : n.hero;
    const from = other ? HEROES[other] : null;
    const kin = (o.cross && other) ? kinship(o.hero, other) : 0;
    return `<button class="boon-card spark-card${o.cross ? ' cross-card' : ''}${afford ? '' : ' spark-poor'}" data-spark="${(o.cross ? 'x:' + o.hero + ':' : '') + n.id}" style="--tint:${h.tint}" ${afford ? '' : 'disabled'}>
      <span class="boon-portrait">${V2PORTRAITS[o.hero] || ''}</span>
      <span class="boon-scrim"></span>
      <span class="boon-medallion">${n.common ? (n.glyph || '◈') : o.cross ? '⟡' : (TREE_TYPE_GLYPH[n.type] || '✦')}</span>
      <span class="spark-price${afford ? '' : ' spark-cant'}">${o.cross ? '' : `<s>${n.cost}</s> `}✦ ${cost}</span>
      <span class="boon-body">
        <span class="boon-from">${n.common ? `${h.name} claims COMMON GROUND${from ? ` · ${h.name}–${from.name} border` : ''}`
          : o.cross ? `${h.name} learns from <b>${from.name}</b> · ${KIN_WORD[kin]}`
          : `${h.name} · ${TREE_TYPE_LABEL[n.type] || 'SKILL'}`}</span>
        <span class="boon-name">${n.label}</span>
        <span class="boon-desc">${n.desc}</span>
      </span>
    </button>`;
  };
  showOverlay(`
    <div class="ov-eyebrow" style="color:var(--gold-bright)">THE EMBERS STILL GLOW</div>
    <div class="ov-title" style="font-size:22px">A SPARK FROM THE FIGHT</div>
    <div class="ov-lines" style="text-align:center; min-height:0"><div class="ov-line">Something learned in the blood — offered at <b>30% off</b>, this once. You hold <b class="spark-wallet">✦ ${runEmbers()}</b>.</div></div>
    <div class="boon-choices spark-choices">${picks.map(cardHtml).join('')}</div>
    <button class="ov-btn" id="spark-skip">TAKE NONE · BANK <b>+2 ✦</b></button>
  `, 'boon-screen spark-screen');
  picks.forEach(o => {
    const n = o.node, key = (o.cross ? 'x:' + o.hero + ':' : '') + n.id;
    const el = document.querySelector(`[data-spark="${key}"]`);
    if (el && runEmbers() >= sparkCost(o)) el.onclick = () => {
      addEmbers(-sparkCost(o));
      if (o.cross) learnCrossing(o.hero, n); else RUN.nodes.push(n.id);
      saveRun();
      try { SFX.kindle(); } catch (_) {}
      flashNarrator(n.common
        ? '◈ ' + HEROES[o.hero].name + ' claims ' + n.label + ' — ground held on the border.'
        : o.cross
        ? '⟡ ' + HEROES[o.hero].name + ' learns ' + n.label + ' from ' + HEROES[n.hero].name + ' — the bond taught it.'
        : '✦ ' + n.label + ' — kindled from the spark, ' + (n.cost - sparkCost(o)) + ' embers saved.');
      // SHOW IT LAND (Build 286). The spark granted a node from a floating card
      // and went straight back to the map, so the tree was where the thing lived
      // and never where the player was standing when they got it — which is most
      // of why the tree felt like a separate, optional screen. The burst plays
      // and then the tree opens ON the new node, so the reward and the place it
      // belongs are the same moment.
      hideOverlay();
      const focus = o.cross ? 'x:' + o.hero + ':' + n.id : ('__kindled:' + n.id);
      kindleBurst(n, () => showEmberTree(() => done(), o.hero, focus));
    };
  });
  $('#spark-skip').onclick = () => { addEmbers(2); saveRun(); done(); };
}
function showBoonDraft(onDone, opts) {
  opts = opts || {};
  const done = onDone || (() => showMap());
  const party = (RUN.active && RUN.active.length) ? RUN.active : (RUN.roster || []);
  RUN.boons = RUN.boons || [];
  const pool = BOONS.filter(b => boonHeroesOk(b, party) && RUN.boons.indexOf(b.id) < 0);
  if (!pool.length) { done(); return; }
  // Prefer VARIETY — gifts from different companions when we can, so a draft
  // reads as "who's offering" rather than three of the same hero.
  const shuffled = _shuffle(pool);
  const picks = [], usedHeroes = new Set();
  shuffled.forEach(b => { if (picks.length < 3 && !usedHeroes.has(b.hero)) { picks.push(b); usedHeroes.add(b.hero); } });
  shuffled.forEach(b => { if (picks.length < 3 && picks.indexOf(b) < 0) picks.push(b); });
  // Build 211: an ELITE draft always carries one CURSED gift — power with a tax,
  // so the elite reward reads as relic-tension, not free candy.
  if (opts.curse && !picks.some(b => b.curse)) {
    const curses = _shuffle(pool.filter(b => b.curse));
    if (curses.length && picks.length) picks[picks.length - 1] = curses[0];
  }
  const cardHtml = (b) => `
    <button class="boon-card${b.trio ? ' boon-trio' : b.duo ? ' boon-duo' : ''}${b.rare ? ' boon-rare' : ''}${b.curse ? ' boon-curse' : ''}" id="boon-${b.id}" style="--tint:${HEROES[b.hero].tint}">
      ${(() => { const hs = b.heroes || [b.hero]; return hs.length > 1
        ? `<span class="boon-portrait boon-portrait-multi bp-${hs.length}">${hs.map(h => `<span class="bp-fig" style="--tint:${HEROES[h].tint}">${V2PORTRAITS[h] || ''}</span>`).join('')}</span>`
        : `<span class="boon-portrait">${V2PORTRAITS[b.hero] || ''}</span>`; })()}
      <span class="boon-scrim"></span>
      <span class="boon-medallion">${b.icon}</span>
      <span class="boon-body">
        <span class="boon-from">${b.trio ? '✦ TRIO · ' + b.heroes.map(h => HEROES[h].name).join(' + ') : b.duo ? '⚭ DUO · ' + b.heroes.map(h => HEROES[h].name).join(' + ') : b.rare ? '✦ RARE · ' + HEROES[b.hero].name : HEROES[b.hero].name + '’S GIFT'}</span>
        <span class="boon-name">${b.name}</span>
        <span class="boon-desc">${b.desc}</span>
      </span>
    </button>`;
  showOverlay(`
    <div class="ov-eyebrow" style="color:var(--gold-bright)">${opts.eyebrow || 'A BOND DEEPENS'}</div>
    <div class="ov-title" style="font-size:22px">${opts.title || 'A COMPANION’S GIFT'}</div>
    <div class="ov-lines" style="text-align:center; min-height:0"><div class="ov-line">${opts.flavor || 'Someone shares a piece of how they fight. Take one — it holds until you fall.'}</div></div>
    <div class="boon-choices">${picks.map(cardHtml).join('')}</div>
  `, 'boon-screen');
  picks.forEach(b => { const el = $('#boon-' + b.id); if (el) el.onclick = () => {
    RUN.boons.push(b.id); markBoonCollected(b.id); saveRun();
    try { SFX.kindle(); } catch (_) {}
    done();
  }; });
}
// ── JOURNAL — a tabbed discovery compendium: BOONS (companion gifts), BESTIARY
//    (foes faced), and HEROES (survivors unlocked).  Each fills in as you play,
//    with fog-of-war on the undiscovered.  Persisted across runs. ──
const _heroOrder = ['ash', 'elin', 'mira', 'cassia', 'branwen', 'hask'];
function journalBoonsHtml() {
  const codex = new Set(loadBoonCodex());
  const got = BOONS.filter(b => codex.has(b.id)).length;
  const entry = (b) => {
    const hs = b.heroes || [b.hero];
    const tier = b.trio ? 'TRIO' : b.duo ? 'DUO' : b.rare ? 'RARE' : (HEROES[b.hero].name);
    const owned = codex.has(b.id);
    const name = owned ? b.name : '<span class="bj-q">? ? ?</span>';
    const med = owned ? b.icon : '<span class="bj-q">?</span>';
    const desc = owned ? b.desc : '<span class="bj-mystery">an undiscovered gift — take it once to reveal what it does</span>';
    return `<div class="bj-entry${owned ? ' bj-owned' : ' bj-locked'}${b.trio ? ' bj-trio' : b.duo ? ' bj-duo' : b.rare ? ' bj-rare' : ''}" style="--tint:${HEROES[b.hero].tint}">
      <span class="bj-figs bj-figs-${hs.length}">${hs.map(h => `<span class="bj-fig" style="--tint:${HEROES[h].tint}">${V2PORTRAITS[h] || ''}</span>`).join('')}</span>
      <span class="bj-info">
        <span class="bj-line"><span class="bj-med">${med}</span><span class="bj-name">${name}</span><span class="bj-tier bt-${b.trio ? 'trio' : b.duo ? 'duo' : b.rare ? 'rare' : 'single'}">${tier}</span>${owned ? '<span class="bj-check" title="collected">✓</span>' : '<span class="bj-lock" title="undiscovered">🔒</span>'}</span>
        <span class="bj-desc">${desc}</span>
        ${b.heroes ? `<span class="bj-req">◈ needs <b>${hs.map(h => HEROES[h].name).join(' + ')}</b> in the party together</span>` : ''}
      </span>
    </div>`;
  };
  const byHero = {};
  BOONS.filter(b => !b.heroes).forEach(b => { (byHero[b.hero] = byHero[b.hero] || []).push(b); });
  const singleSecs = _heroOrder.filter(h => byHero[h]).map(h =>
    `<div class="bj-sec-title" style="--tint:${HEROES[h].tint}"><span class="bj-sec-fig">${V2PORTRAITS[h] || ''}</span>${HEROES[h].name}</div><div class="bj-grid">${byHero[h].map(entry).join('')}</div>`).join('');
  const section = (title, list) => list.length ? `<div class="bj-sec-title bj-combo">${title}</div><div class="bj-grid">${list.map(entry).join('')}</div>` : '';
  return `<div class="bj-count">${got} / ${BOONS.length} gifts discovered</div><div class="bj-scroll">${singleSecs}
    ${section('⚭ DUO GIFTS — appear only when both walk together', BOONS.filter(b => b.duo))}
    ${section('✦ TRIO GIFTS — the exact three, the rarest bond', BOONS.filter(b => b.trio))}</div>`;
}
// The foes worth a page — the fixed bestiary (no run-synthesised vengeful heroes).
const BESTIARY_IDS = ['husk', 'wraith', 'cultist', 'mourner', 'drone', 'brood', 'cantor', 'revenant', 'echoknight', 'echodevourer', 'echosunder', 'echochorus'];
function enemyBlurb(def) {
  if (def.megaBoss) return 'the gathered voice — three stages, one throat';
  if (def.floorBoss) return 'a FLOOR BOSS — strikes twice, ends a floor';
  if (def.boss) return 'a BOSS — a remembered blow, relentless';
  if (def.attacksPerRound >= 2) return 'a SWARM — strikes ' + def.attacksPerRound + '× a round';
  if ((def.parrySpeed || 1) <= 0.9) return 'SLOW & HEAVY — big, telegraphed blows';
  if ((def.parrySpeed || 1) >= 1.3) return 'FAST — a flurry you must keep pace with';
  return 'a foe of the dark';
}
function journalBestiaryHtml() {
  const seen = new Set(loadBestiary());
  const defs = BESTIARY_IDS.filter(id => ENEMY_DEFS[id]);
  const got = defs.filter(id => seen.has(id)).length;
  const entry = (id) => {
    const def = ENEMY_DEFS[id]; const met = seen.has(id);
    const art = foeArtHTML(def.art || id);   // painted plate when one exists (Build 215)
    const name = met ? def.name : '<span class="bj-q">? ? ?</span>';
    return `<div class="bj-entry${met ? ' bj-owned' : ' bj-locked'}${def.boss ? ' bj-trio' : ''}">
      <span class="bj-figs bj-figs-1"><span class="bj-fig bj-foe">${art}</span></span>
      <span class="bj-info">
        <span class="bj-line"><span class="bj-name">${name}</span>${def.boss ? '<span class="bj-tier bt-trio">BOSS</span>' : ''}${met ? `<span class="bj-weak" title="weakness">${SCHOOL_GLYPH[def.weak] || '?'} ${(def.weak || '').toUpperCase()}</span>` : ''}${met ? '<span class="bj-check">✓</span>' : '<span class="bj-lock">🔒</span>'}</span>
        <span class="bj-desc">${met ? enemyBlurb(def) + ' · <b>' + def.maxHp + ' HP</b> base' : '<span class="bj-mystery">unmet — face it in the dark to record it</span>'}</span>
      </span>
    </div>`;
  };
  const mobs = defs.filter(id => !ENEMY_DEFS[id].boss);
  const bosses = defs.filter(id => ENEMY_DEFS[id].boss);
  return `<div class="bj-count">${got} / ${defs.length} foes recorded</div><div class="bj-scroll">
    <div class="bj-sec-title bj-combo">THE DARK’S CREATURES</div><div class="bj-grid">${mobs.map(entry).join('')}</div>
    <div class="bj-sec-title bj-combo">THE ECHOES — floor bosses</div><div class="bj-grid">${bosses.map(entry).join('')}</div></div>`;
}
function journalHeroesHtml() {
  const unlocked = new Set(getUnlockedStarters());
  const pool = STARTER_POOL.filter(id => HEROES[id]);
  const got = pool.filter(id => unlocked.has(id)).length;
  const entry = (id) => {
    const h = HEROES[id]; const open = unlocked.has(id);
    return `<div class="bj-entry${open ? ' bj-owned' : ' bj-locked'}" style="--tint:${h.tint}">
      <span class="bj-figs bj-figs-1"><span class="bj-fig" style="--tint:${h.tint}">${V2PORTRAITS[id] || ''}</span></span>
      <span class="bj-info">
        <span class="bj-line"><span class="bj-name">${h.name}</span><span class="bj-tier bt-single">${h.cls} · ${h.archetype || ''}</span>${open ? '<span class="bj-check" title="unlocked">✓</span>' : '<span class="bj-lock" title="locked">🔒</span>'}</span>
        <span class="bj-desc">${open ? (h.identity || '') : '<span class="bj-mystery">recruit them on the road to unlock as a starter</span>'}</span>
      </span>
    </div>`;
  };
  return `<div class="bj-count">${got} / ${pool.length} survivors unlocked</div><div class="bj-scroll"><div class="bj-grid">${pool.map(entry).join('')}</div></div>`;
}
function showJournal(onBack, tab) {
  tab = tab || 'boons';
  // v2.2: ECHOES — the narrative archive. What happened to you is replayable
  // here (the bible's rule: essential story must survive an interrupted phone
  // session). Titles come reveal-safe from narrative.js.
  const TABS = [['boons', '✦ BOONS'], ['bestiary', '☠ BESTIARY'], ['heroes', '⚔ HEROES'], ['echoes', '✧ ECHOES']];
  const body = tab === 'bestiary' ? journalBestiaryHtml() : tab === 'heroes' ? journalHeroesHtml()
    : tab === 'echoes' ? journalEchoesHtml() : journalBoonsHtml();
  showOverlay(`
    <div class="ov-eyebrow" style="color:var(--gold-bright)">DISCOVERY</div>
    <div class="ov-title" style="font-size:21px; margin-bottom:8px;">JOURNAL</div>
    <div class="bj-tabs">${TABS.map(([k, l]) => `<button class="bj-tab${k === tab ? ' bj-tab-on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>
    ${body}
    <button class="ov-btn et-back-btn" id="bj-back">◂ BACK</button>
  `, 'map-screen bj-screen');
  document.querySelectorAll('.bj-tab').forEach(el => { el.onclick = () => { if (el.dataset.tab !== tab) showJournal(onBack, el.dataset.tab); }; });
  document.querySelectorAll('.nv-arc-row').forEach(el => {
    el.onclick = () => { hideOverlay(); narrReplay(el.dataset.narr, () => showJournal(onBack, 'echoes')); };
  });
  $('#bj-back').onclick = onBack || showTitle;
}
// Back-compat alias — older callers open the Journal on the Boons tab.
function showBoonJournal(onBack) { showJournal(onBack, 'boons'); }
function showCamp(n) {
  // Build 210 (Phase 1): the fire no longer heals on arrival.  The night is long
  // enough for ONE thing done well — resting, raising, bonding, communing, or
  // forging — so the pre-boss camp becomes a real decision, not a toll booth.
  if (!RUN.completed.includes(n.id)) RUN.completed.push(n.id);
  saveRun();
  const fallen = (RUN.roster || []).filter(id => (RUN.hp[id] ?? 1) <= 0);
  const bargained = (RUN.boons || []).includes('curse_hollowbargain');   // the fire refuses the bargainer — no REST
  const wounded = !bargained && (RUN.roster || []).some(id => { const hp = RUN.hp[id] ?? HEROES[id].maxHp; return hp > 0 && hp < HEROES[id].maxHp; });
  // A HANDFUL OF ASH bought you the run's opening; the first fire pays for it.
  const ashSpent = hasRelic('ash') && !RUN._ashCampUsed;
  if (ashSpent) { RUN._ashCampUsed = true; saveRun(); }
  // CINEMATIC CAMPFIRE — the party gathers, lit warm by the fire; the night's
  // one choice is offered as cards over the scene (mirrors the JRPG cutscenes).
  const party = ((RUN.active && RUN.active.length) ? RUN.active : RUN.roster).slice();
  const mid = (party.length - 1) / 2;
  const heroes = party.map((id, i) => {
    const side = i < mid ? 'l' : i > mid ? 'r' : 'c';   // right side faces the fire (flipped)
    const down = (RUN.hp[id] ?? 1) <= 0;   // the fallen must not stand like the living (Build 213)
    return `<span class="camp-hero camp-hero-${side}${down ? ' camp-hero-down' : ''}" style="--off:${(i - mid).toFixed(2)}">${V2PORTRAITS[id] || ''}</span>`;
  }).join('');
  const embers = Array.from({ length: 9 }, (_, i) => `<span class="cf-ember" style="--i:${i}"></span>`).join('');
  const choice = (id, icon, label, effect) => `
    <button class="ev-choice camp-choice" id="${id}">
      <span class="ev-choice-icon">${icon}</span>
      <span class="ev-choice-body"><span class="ev-choice-label">${label}</span><span class="ev-choice-effect">${effect}</span></span>
    </button>`;
  showOverlay(`
    <div class="camp-scene">
      <div class="camp-glow"></div>
      <div class="camp-party">${heroes}</div>
      <div class="camp-fire"><span class="cf-core"></span><span class="cf-flame"></span>${embers}</div>
      <div class="camp-top">
        <div class="camp-eyebrow">CAMPFIRE</div>
        <div class="camp-title">${n.label}</div>
        <div class="camp-flavor">The fire holds back the dark — but the night is long enough for <b>one thing done well</b>.${bargained ? ' <b>The fire will not warm a bargainer</b> — no rest tonight.' : ''}${fallen.length ? ` And <b>${fallen.map(id => HEROES[id].name).join(' & ')}</b> ${fallen.length > 1 ? 'lie' : 'lies'} still…` : ''}</div>
      </div>
      <div class="camp-choices">
        ${(wounded && !ashSpent) ? choice('camp-rest', '✺', 'REST BY THE FIRE', 'Every wound on the <b>living</b> closes.') : ''}
        ${fallen.length ? choice('camp-raise', '☨', 'RAISE THE FALLEN', `<b>${fallen.map(id => HEROES[id].name).join(' & ')}</b> ${fallen.length > 1 ? 'return' : 'returns'} at <b>half HP</b> — the fire’s only gift tonight.`) : ''}
        ${choice('camp-fire', '♡', 'SHARE THE FIRE', (() => {
          const k = _fireBondKey();
          if (!k) return 'Deepen a bond <b>+1</b>.';
          const [fa, fb] = k.split('|');
          return deedTotal(k) > 0
            ? `<b>${HEROES[fa].name}</b> and <b>${HEROES[fb].name}</b> have something to say. Bond <b>+1</b>.`
            : 'Deepen your weakest bond <b>+1</b>.';
        })())}
        ${ashSpent ? '' : choice('camp-boon', '✦', 'COMMUNE AT THE FIRE', 'A companion shares a gift — <b>draw 1 of 3</b>.')}
        ${ashSpent ? '' : choice('camp-forge', '⚒', 'THE EMBER FORGE', 'Spend embers on tempers that hold <b>this descent</b>.')}
        ${ashSpent ? '<div class="camp-spent">◈ <b>A HANDFUL OF ASH</b> — you arrived already spent. This fire offers nothing but itself.</div>' : ''}
      </div>
    </div>
  `, 'camp-cine');
  const restBtn = $('#camp-rest');
  if (restBtn) restBtn.onclick = () => {
    RUN.roster.forEach(id => { const hp = RUN.hp[id] ?? HEROES[id].maxHp; if (hp > 0) RUN.hp[id] = HEROES[id].maxHp; });
    RUN.wounds = {};   // the ONLY thing that closes a wound — see WOUND_SHARE
    saveRun();
    flashNarrator('The fire takes the night — and every wound on the living with it, even the ones that would not close on the road.');
    showMap();
  };
  const raiseBtn = $('#camp-raise');
  if (raiseBtn) raiseBtn.onclick = () => {
    fallen.forEach(id => { RUN.hp[id] = Math.max(1, Math.ceil(HEROES[id].maxHp / 2)); });
    saveRun();
    showTravelerOutcome(fallen[0], '☨ RAISED FROM THE DARK', fallen.map(id => HEROES[id].name).join(' & ') + (fallen.length > 1 ? ' RISE' : ' RISES'),
      `The fire takes what the dark left. <b>${fallen.map(id => HEROES[id].name).join(' & ')}</b> ${fallen.length > 1 ? 'stand' : 'stands'} again — half-alive, wholly here. Tonight the fire had only this to give.`, false, fallen[0]);
  };
  $('#camp-fire').onclick = () => showCampScene(n);
  // these two rows can be absent (A HANDFUL OF ASH shuts them), so bind defensively
  const forgeBtn = $('#camp-forge'); if (forgeBtn) forgeBtn.onclick = () => showForge(n);
  const boonBtn = $('#camp-boon'); if (boonBtn) boonBtn.onclick = () => showBoonDraft(() => showMap(), { eyebrow: n.label.toUpperCase(), title: 'A COMPANION’S GIFT', flavor: 'By the fire, someone shares a piece of how they fight. Take one — it holds until you fall.' });
}

// IN-RUN FORGE — spend embers on a TEMPORARY temper that lasts this descent.
// A different sink from the permanent tree: depth for this run, not breadth.
function showForge(n) {
  RUN.forges = RUN.forges || [];
  const offers = FORGE_OFFERS.map(f => {
    const owned = RUN.forges.includes(f.id);
    const afford = runEmbers() >= f.cost;
    const state = owned ? 'owned' : afford ? 'ready' : 'poor';
    const foot = owned ? '<span class="et-owned">✓ TEMPERED</span>' : `<span class="et-cost${afford ? '' : ' et-cant'}">✦ ${f.cost}</span>`;
    return `<button class="et-node et-forge et-${state}" data-id="${f.id}" ${owned || !afford ? 'disabled' : ''}>
      <span class="et-type t-forge">TEMPER</span>
      <span class="et-name">${f.label}</span>
      <span class="et-desc">${f.desc}</span>
      <span class="et-foot">${foot}</span>
    </button>`;
  }).join('');
  showOverlay(`
    <div class="ov-eyebrow" style="color:#ffb469">THE EMBER FORGE</div>
    <div class="et-wallet">✦ <b>${runEmbers()}</b> <span>embers</span></div>
    <div class="et-forge-note">These tempers hold only for this descent — spend freely, or bank toward the tree. The forge takes the night.</div>
    <div class="et-tier-row">${offers}</div>
    <button class="ov-btn" id="forge-back">◂ TAKE THE ROAD</button>
  `, 'map-screen et-screen forge-screen');
  document.querySelectorAll('.et-node:not([disabled])').forEach(el => {
    el.onclick = () => {
      const f = FORGE_BY_ID[el.dataset.id];
      if (!f || RUN.forges.includes(f.id) || runEmbers() < f.cost) return;
      addEmbers(-f.cost); RUN.forges.push(f.id); saveRun();
      SFX.thread();
      showForge(n);
    };
  });
  $('#forge-back').onclick = () => showMap();   // the forge was the night's one act — morning comes
}
// A small scene by the fire between the two LEAST-bonded active companions —
// where the numbers become people.
function showCampScene(n) {
  // THE FIRE GOES TO THE PAIR WITH THE MOST BETWEEN THEM (Build 266). It used to
  // pick the WEAKEST bond, which hands the night's one scene to the two who have
  // done the least together — the least interesting answer available, and one the
  // player has no way to influence. It follows the deed ledger now, so who gets a
  // scene is decided by how you actually played the descent.
  const fireKey = _fireBondKey();
  if (!fireKey) { showPartySelect(() => showMap()); return; }
  const [a, b] = fireKey.split('|');
  const key = pairKey(a, b);
  // WRITE THROUGH bondRaw. Reading bondPts here would bank the fragment carry
  // into storage and compound it at every fire.
  const before = bondPts(key);
  RUN.bonds = RUN.bonds || {};
  RUN.bonds[key] = bondRaw(key) + 1;
  saveRun();
  const kindledNow = before < BOND_KINDLED && bondPts(key) >= BOND_KINDLED;
  // THE ARC ADVANCES (Build 220) — the fire is where a pair's wound gets its
  // next line.  Which scene plays is the deepest stage this pair has NEVER been
  // shown, so a relationship RESUMES across runs instead of rewinding; the fire
  // never repeats a beat you've already had.
  const stage = nextArcStage(a, b);
  const beat = arcBeat(a, b, stage);
  // …and it opens by naming the thing they did, so the counter's consequence is
  // never invisible even though the counting is.
  const top = deedTop(key);
  const deedLine = (top && DEED_KINDS[top])
    ? DEED_KINDS[top].open(HEROES[a].name, HEROES[b].name) : null;
  const lines = [];
  if (deedLine) lines.push({ text: '<i>' + deedLine + '</i>' });
  lines.push({ text: beat.set || 'The pot is shared. The watch is set. Two of them sit a little apart from the dark.' });
  beat.lines.forEach(l => lines.push(l));
  lines.push({ text: `The fire holds. <b>♡ ${HEROES[a].name} ─ ${HEROES[b].name}${kindledNow ? ' · WOVEN' : ' +1'}</b>${kindledNow ? ' — they will walk into every battle already connected.' : '.'}` });
  if (beat.staged) markArcSeen(a, b, stage);
  // ── THE FORK (Build 269). The night has room for one more question, and the
  // two you can ask are the two things this game is about: what these people can
  // do together, or what they remember about where they are. You get one.
  const A = HEROES[a].name, B = HEROES[b].name;
  const giftHeld = bondGiftHeld(a, b);
  const frag = nextFragment();
  const bondNd = NODE_BY_ID['bond.' + key];
  const askOpt = giftHeld
    ? { key: 'more', label: '♡ LET IT LIE', desc: `You already know what <b>${A}</b> and <b>${B}</b> are together. Sit with them instead — the bond deepens <b>+1</b> again.` }
    : { key: 'gift', label: `${bondNd ? bondNd.glyph : '✦'} ASK WHAT THEY ARE TOGETHER`,
        desc: `They work it out at the fire. <b>${bondNd ? bondNd.label : 'Their bond'}</b> opens on the lattice — ${bondNd ? bondNd.desc.replace(/^<b>.*?<\/b> — /, '') : 'their own ability'} — theirs to take this descent and <b>every one after</b>.` };
  const memOpt = frag
    ? { key: 'frag', label: '◇ ASK WHAT THEY REMEMBER', desc: `Two accounts, compared out loud. What doesn’t line up is <b>a piece of what this place is</b> — and every third piece makes every bond you form <b>hold one step harder, forever</b>.` }
    : { key: 'more', label: '◇ NOTHING LEFT TO COMPARE', desc: `You have the whole of it. There is nothing either of them can tell you that you don’t already know — so let the night be warm instead. Bond <b>+1</b> again.` };
  showStory({
    type: 'story', chapter: 3, title: 'BY THE FIRE', eyebrow: n.label.toUpperCase(),
    lines,
    fork: {
      prompt: 'The night is long enough for <b>one more question</b>.',
      opts: [askOpt, memOpt],
      onPick: (o) => {
        if (o.key === 'gift') {
          markBondGift(a, b);
          flashNarrator(`<b>${A}</b> and <b>${B}</b> work out what they are together — it is on the lattice now, and it stays there.`);
          showPartySelect(() => showMap());
          return;
        }
        if (o.key === 'frag' && frag) { markFrag(frag.id); showFragment(frag, a, b); return; }
        RUN.bonds[key] = bondRaw(key) + 1;
        saveRun();
        flashNarrator(`The fire holds a while longer. <b>♡ ${A} ─ ${B} +1</b>`);
        showPartySelect(() => showMap());
      },
    },
  });
}
// THE FRAGMENT LANDS AS ITS OWN BEAT — the pair says the thing, and then you are
// told plainly where it sits in the whole, because a collectible you can't count
// is a collectible nobody collects.
function showFragment(frag, a, b) {
  const held = fragsHeld(), total = ABYSS_FRAGMENTS.length;
  const carry = bondCarry(), nextAt = (carry < CARRY_MAX) ? (carry + 1) * CARRY_PER - held : 0;
  const lines = [
    { text: `<i>${HEROES[a].name} says it first. ${HEROES[b].name} was going to say the same thing, and that is the whole problem.</i>` },
    { text: frag.text },
    { text: `<b>◇ ${frag.title}</b> — <b>${held} of ${total}</b> of the abyss pieced together.` },
  ];
  if (carry > 0) lines.push({ text: `What you know holds your people together: <b>every bond you form starts ${carry} step${carry > 1 ? 's' : ''} deeper</b>.` });
  if (nextAt > 0) lines.push({ text: `<i>${nextAt} more and they will hold harder still.</i>` });
  showStory({ type: 'story', chapter: 3, title: 'WHAT DOESN’T LINE UP', eyebrow: 'THE ABYSS REMEMBERS', lines, campDone: true });
}
// Party composition — pick exactly 3 (or all, if fewer).  The preview line
// shows WHICH resonant this trio unlocks, so composition reads as a build.
// THE LINE — a Final-Fantasy-style formation editor.  Three ordered POSITIONS
// (FRONT / MID / BACK) hold the walking trio; the rest wait on the BENCH.  A
// hero's slot IS their opening row in the fight (front draws fire, back sits
// shielded), so arranging the line matters.  Rearrange by DRAGGING a hero onto
// another (desktop) or TAPPING one then another to swap them (touch) — the two
// simply trade places, whether slot↔slot (reorder), slot↔bench (swap in/out), or
// bench↔bench.  A ◆-pinned hero (a fresh recruit you must field) can reorder but
// can't be sent back to the bench.
function showPartySelect(onDone, mustInclude) {
  const POS = [
    { row: 'front', label: 'FRONT', role: 'takes the blows' },
    { row: 'mid',   label: 'MID',   role: 'the middle' },
    { row: 'back',  label: 'BACK',  role: 'kept safe' },
  ];
  const need = Math.min(3, RUN.roster.length);
  let line = RUN.active.slice(0, need);
  if (mustInclude && !line.includes(mustInclude)) line = [mustInclude].concat(line).slice(0, need);
  RUN.roster.forEach(id => { if (line.length < need && !line.includes(id)) line.push(id); });   // top up if short
  // Open on the party's REAL current formation: order the line by the combat rows
  // it will actually field (front → mid → back), so the editor mirrors the fight.
  if (RUN.rows) { const rank = { front: 0, mid: 1, back: 2 }; line.sort((a, b) => ((rank[RUN.rows[a]] != null ? rank[RUN.rows[a]] : 9) - (rank[RUN.rows[b]] != null ? rank[RUN.rows[b]] : 9))); }
  let bench = RUN.roster.filter(id => !line.includes(id));
  let sel = null;   // the picked-up hero (tap-to-swap)

  // Trade two heroes wherever they live.  Returns false (and no-ops) if the move
  // would bench a pinned recruit.
  const swap = (a, b) => {
    if (!a || !b || a === b) return false;
    const la = line.indexOf(a), lb = line.indexOf(b), ba = bench.indexOf(a), bb = bench.indexOf(b);
    if (la >= 0 && lb >= 0) { line[la] = b; line[lb] = a; return true; }              // reorder the line
    if (la >= 0 && bb >= 0) { if (a === mustInclude) return false; line[la] = b; bench[bb] = a; return true; }  // swap in from bench
    if (ba >= 0 && lb >= 0) { if (b === mustInclude) return false; line[lb] = a; bench[ba] = b; return true; }
    if (ba >= 0 && bb >= 0) { bench[ba] = b; bench[bb] = a; return true; }             // reorder the bench
    return false;
  };

  const card = (id, where, slotIdx) => {
    const h = HEROES[id]; const hp = RUN.hp[id] ?? h.maxHp; const pinned = id === mustInclude;
    return `<button class="ps-card${sel === id ? ' ps-sel' : ''}${pinned ? ' ps-pinned' : ''}" draggable="true"
        data-id="${id}" data-where="${where}"${slotIdx != null ? ` data-slot="${slotIdx}"` : ''}
        title="${h.name} — ${h.identity || h.cls}">
        <span class="ps-art">${V2PORTRAITS[id] || ''}</span>
        <span class="ps-name">${h.name}${pinned ? ' <span class="ps-lock" title="a new companion — can’t be benched yet">◆</span>' : ''}</span>
        <span class="ps-cls">${h.cls} · <b>${h.archetype || ''}</b></span>
        <span class="ps-hp"><span class="ps-hp-fill" style="width:${(hp / h.maxHp) * 100}%"></span></span>
        <span class="ps-hp-num">${hp}<i>/${h.maxHp}</i></span>
      </button>`;
  };

  const render = () => {
    // MIRROR COMBAT: on the battlefield the party faces RIGHT, so the FRONT hero
    // sits nearest the foe (rightmost) and the BACK hero is furthest back (left).
    // Render the slots in that same left→right order — BACK … FRONT — so the
    // formation editor reads exactly like the fight.
    const order = POS.slice(0, need).map((_, i) => i).reverse();
    const slotsHtml = order.map(i => {
      const p = POS[i];
      return `<div class="ps-slot" data-slot="${i}">
        <div class="ps-slotlabel"><b>${p.label}</b><span>${p.role}</span></div>
        ${card(line[i], 'slot', i)}
      </div>`;
    }).join('');
    const benchHtml = bench.length
      ? `<div class="ps-bench-wrap"><div class="ps-bench-title">BENCH · resting — swap anyone in</div>
         <div class="ps-bench">${bench.map(id => card(id, 'bench')).join('')}</div></div>`
      : '';
    const r = line.length === 3 ? triadEntryFor(line) : null;
    const bonds = (() => {
      const out = [];
      for (let i = 0; i < line.length; i++) for (let j = i + 1; j < line.length; j++) {
        const pts = bondPts(pairKey(line[i], line[j]));
        if (pts >= BOND_KINDLED) out.push(`♡ ${HEROES[line[i]].name} ─ ${HEROES[line[j]].name} · woven`);
        else if (pts > 0) out.push(`♡ ${HEROES[line[i]].name} ─ ${HEROES[line[j]].name} · ${pts}/${BOND_KINDLED}`);
      }
      return out.join('<span class="ps-bond-sep"> · </span>');
    })();
    // Full-screen page — same shell as the Ember Tree.
    showOverlay(`
      <div class="et-head"><span class="et-h-title">THE MARCHING ORDER</span><span class="et-h-boss">drag or tap two heroes to swap · front takes the blows, back stays shielded</span></div>
      <div class="ps-stage">
        <div class="ps-orient"><span class="po-rear">◂ REAR</span><span class="po-track"></span><span class="po-foe">THE FOE ▸</span></div>
        <div class="ps-slots">${slotsHtml}</div>
        ${benchHtml}
        <div class="ps-reso">${r
          ? `this trio resonates as <b>✦ ${r.name}</b> — ${r.type}<br><span class="ps-reso-desc">${r.desc}</span>`
          : ''}</div>
        <div class="ps-bonds">${bonds}</div>
      </div>
      <button class="ov-btn primary ps-walk" id="ps-go">WALK ON ▸</button>
    `, 'map-screen party-screen');
    // TAP-TO-SWAP + native DRAG (drag is coordinate-free, so the stage scale never
    // throws it off; tap covers touch, where native DnD often doesn't fire).
    const attempt = (a, b) => { const ok = swap(a, b); try { (ok ? SFX.move : SFX.deny)(); } catch (_) {} sel = null; render(); };
    document.querySelectorAll('.ps-card').forEach(el => {
      const id = el.dataset.id;
      el.onclick = () => {
        if (sel == null) { sel = id; try { SFX.card(); } catch (_) {} render(); return; }
        if (sel === id) { sel = null; render(); return; }
        attempt(sel, id);
      };
      el.ondragstart = (e) => { sel = null; try { e.dataTransfer.setData('text/plain', id); e.dataTransfer.effectAllowed = 'move'; } catch (_) {} el.classList.add('ps-dragging'); };
      el.ondragend = () => el.classList.remove('ps-dragging');
      el.ondragenter = (e) => { e.preventDefault(); el.classList.add('ps-over'); };
      el.ondragover = (e) => { e.preventDefault(); };
      el.ondragleave = () => el.classList.remove('ps-over');
      el.ondrop = (e) => { e.preventDefault(); el.classList.remove('ps-over'); let src = ''; try { src = e.dataTransfer.getData('text/plain'); } catch (_) {} if (src && src !== id) attempt(src, id); };
    });
    $('#ps-go').onclick = () => {
      RUN.active = line.slice();
      // The marching order IS the formation — write it into position memory so the
      // NEXT fight opens with these exact rows (front → mid → back).  Without this,
      // newBattle keeps reading the stale RUN.rows and ignores your arrangement.
      RUN.rows = RUN.rows || {};
      const rowNames = ['front', 'mid', 'back'];
      line.forEach((id, i) => { RUN.rows[id] = rowNames[i] || 'back'; });
      saveRun(); hideOverlay(); onDone();
    };
  };
  render();
}

// ---------------------------------------------------------------------------
// RENDER
// ---------------------------------------------------------------------------
function figEl(id) { return document.querySelector(`[data-fig="${id}"]`); }

// Animated status chips (ported feel from v1): a chip whose value GREW since
// the last render gets a one-shot pop-and-glow, so gaining guard / rally /
// stagger visibly lands rather than silently appearing in the chip row.
function chipPop(who, key, val) {
  const prev = who._fxPrev || {};
  return (val > (prev[key] || 0)) ? ' chip-pop' : '';
}
function snapFx(who, obj) { who._fxPrev = obj; }
// Party figures are REUSED across renders (their SVG portrait is expensive to
// re-parse — the same optimisation the floor boss uses).  These build the
// mutable bits so a re-render only swaps chips / hp / aura, never the art.
let _partyFigs = {};
let _enemyFigs = {};   // uid -> cached enemy figure element (see renderEnemies)
function partyChipsHtml(who) {
  return `
    ${who.invuln ? `<span class="chip buff${chipPop(who,'invuln',1)}">✦ INVULN</span>` : ''}
    ${who.guard ? `<span class="chip guard${chipPop(who,'guard',who.guard)}">⛨ ${who.guard}</span>` : ''}
    ${who.buffDmg ? `<span class="chip buff${chipPop(who,'buffDmg',who.buffDmg)}">▲ ${who.buffDmg}</span>` : ''}
    ${who.counter ? `<span class="chip counter${chipPop(who,'counter',who.counter)}">↺ ${who.counter}</span>` : ''}
    ${who.exposed ? `<span class="chip mark${chipPop(who,'exposed',who.exposed)}">◎ ${who.exposed}</span>` : ''}
    ${who.chill ? `<span class="chip chill${chipPop(who,'chill',who.chill)}">❄ ${who.chill}</span>` : ''}
    ${who.charge ? `<span class="chip charge${chipPop(who,'charge',who.charge)}" title="CHARGE — builds on Hask's spells; an OVERLOAD nuke spends it for +3 damage each. MOVING mid-channel MISFIRES for 2× held ◆ (unless Steady Cast)">◆ ${who.charge}</span>` : ''}
    ${who.pendingCast ? `<span class="chip charge" title="CASTING — unleashes at the start of your next turn; moving interrupts it">◈ CAST</span>` : ''}
    ${who.aether > 0 ? `<span class="chip astral${chipPop(who,'aether',who.aether)}" title="PYRE — fire spells hit +2 per stack. Cast ice to swing back to FROST.">🔥 ${who.aether}</span>` : ''}
    ${who.aether < 0 ? `<span class="chip umbral${chipPop(who,'aether',-who.aether)}" title="FROST — ice spells refill ◆ CHARGE. Cast fire to swing back to PYRE.">❄ ${-who.aether}</span>` : ''}
    ${who.hexed ? `<span class="chip hex${chipPop(who,'hexed',who.hexed)}" title="HEXED — your card plays burn your hand">☠ HEXED</span>` : ''}
    ${who.primed && PRIME_TYPES[who.primed.type] ? `<span class="chip primed primed-${who.primed.type}${chipPop(who,'primed',1)}" title="PRIMED (${PRIME_TYPES[who.primed.type].name}) — ${PRIME_TYPES[who.primed.type].desc}. They finished their combo and stand ready. When ANOTHER hero finishes a combo, this hero's FOLLOW-UP opens in your hand — playing it bonds the pair. Fades at the end of next turn.">${PRIME_TYPES[who.primed.type].glyph}</span>` : ''}`;
}
function partyAuraObj(who) { return { guard: who.guard, rally: who.buffDmg, chill: who.chill, exposed: who.exposed, counter: who.counter, invuln: who.invuln }; }
// Refresh a REUSED party figure in place — swap only what changed.
function refreshPartyFig(fig, who, solo) {
  const chips = fig.querySelector('.fig-chips'); if (chips) chips.innerHTML = partyChipsHtml(who);
  const fill = fig.querySelector('.hp-fill'); if (fill) fill.style.width = ((who.hp / who.maxHp) * 100) + '%';
  const wd = fig.querySelector('.hp-wound');
  if (wd) { wd.style.width = ((woundOf(who) / who.maxHp) * 100) + '%'; wd.classList.toggle('hidden', !woundOf(who)); }
  const num = fig.querySelector('.hp-num'); if (num) num.textContent = who.hp + '/' + who.maxHp;
  const art = fig.querySelector('.fig-art');
  if (art) { const oa = art.querySelector('.fig-aura'); if (oa) oa.remove(); if (!who.downed) { const a = auraHTML(partyAuraObj(who)); if (a) art.insertAdjacentHTML('beforeend', a); } }
  let tag = fig.querySelector('.stance-tag');
  if (solo && !tag) fig.insertAdjacentHTML('afterbegin', `<span class="stance-tag">${STANCE[who.row].name.toUpperCase()}</span>`);
  else if (solo && tag) tag.textContent = STANCE[who.row].name.toUpperCase();
  else if (!solo && tag) tag.remove();
}

// Status AURA — persistent particle/glow effects painted OVER the character
// body so an active status reads as an atmosphere around the figure, not just
// a pill.  fx flags: guard, rally, chill, exposed, counter, invuln (allies);
// weak, stagger add for enemies.  CSS drives the looping motion; --i staggers
// each particle so a field of them shimmers rather than pulsing in lockstep.
function auraHTML(fx) {
  const field = (cls, n) => {
    let s = '';
    for (let i = 0; i < n; i++) s += `<span class="ap ${cls}" style="--i:${i};--x:${Math.round(12 + (i + 0.5) * (76 / n))}"></span>`;
    return `<div class="ap-field">${s}</div>`;
  };
  let html = '';
  if (fx.invuln)  html += `<span class="aura-glow aura-invuln"></span>`;
  if (fx.guard)   html += `<span class="aura-shield"></span>`;
  if (fx.exposed) html += `<span class="aura-glow aura-expose"></span>`;
  if (fx.weak)    html += `<span class="aura-glow aura-weak"></span>`;
  if (fx.stagger) html += `<span class="aura-glow aura-stagger"></span>` + field('ap-stagger', 5);
  if (fx.rally)   html += field('ap-rally', 5);
  if (fx.chill)   html += `<span class="aura-glow aura-chill"></span>` + field('ap-chill', 5);
  if (fx.counter) html += field('ap-counter', 4);
  return html ? `<div class="fig-aura">${html}</div>` : '';
}

function renderAll() {
  setTimeout(() => { try { foeAnimReveal(); } catch (_) {} }, 0);
  if (!S) return;
  applyFightBg();
  renderTimeline();
  renderBattlefield();
  renderThreads();
  renderResonance();
  renderCombatBoons();
  renderActionBar();
  renderCriticalHp();
}
// CRITICAL HEALTH — a pulsing red frame is the universal "you're in danger"
// language, so it lives HERE (not on the all-out).  Lights whenever a living
// hero is at or below a quarter HP, clears when they're mended.  Suppressed
// during the all-out (the CSS gates it) so the two never fight.
function renderCriticalHp() {
  const st = $('#stage'); if (!st) return;
  const crit = !!(S && !S.over && livingHeroes().some(h => h.hp > 0 && h.hp / h.maxHp <= 0.25));
  st.classList.toggle('hp-critical', crit);
}
// The fight backdrop shows only during battle (S set) and only if the player
// hasn't switched it off in DEV.  Toggled here + cleared by the map/title.
function applyFightBg() {
  applyFxTier();
  setTimeout(() => autoTuneFx(true), 700);   // let the scene settle, then measure real frames
  const st = $('#stage');
  if (st) st.classList.toggle('show-bg', !!(S && SETTINGS.fightBg));
}

// Combat no longer has an action-scripted / ATB order (your whole turn, then
// theirs), so a turn-order strip would be dishonest.  This spot instead
// carries a THREAT FORECAST: total enemy damage that would land on OCCUPIED
// party rows next phase.  Vacate a telegraphed row and the number drops —
// the forecast is the formation puzzle made numeric, and it drives the
// guard / intercept / dodge decision.
function renderTimeline() {
  // The threat forecast used to sit here as a top banner (round number + "N
  // incoming — parry to negate").  That hand-holding is gone: the danger now
  // reads straight off the battlefield — the lock-on brackets and the ✕N (or a
  // ☠ when it's lethal) on the threatened hero.  The player learns the UI.
  const tl = $('#timeline');
  if (tl) tl.innerHTML = '';
}

function renderBattlefield() {
  // Per-row INCOMING DAMAGE, so the telegraph can look as scary as the blow is
  // big — a small poke barely glows, a boss's OBLIVION swells huge and red.
  const rowDmg = { front: 0, mid: 0, back: 0 };
  let anyHeavy = false;
  livingEnemies().forEach(e => {
    enemyNextIntents(e).forEach(it => {          // sum EVERY blow this foe will throw (a boss throws two)
      if (!it || it.kind === 'buff') return;
      const dmg = enemyIntentDmg(e, it);
      if (it.heavy) anyHeavy = true;
      const row = effIntentRow(e, it);           // smart foes aim at the weakest — shown honestly
      (row === 'all' ? ROWS.slice() : (row ? [row] : [])).forEach(r => { rowDmg[r] += dmg; });
    });
  });
  // Classify a row's threat: how big, and would it drop the hero standing there?
  const dangerClass = (row) => {
    const d = rowDmg[row]; if (d <= 0) return '';
    const h = S.heroes.find(x => x.row === row && !x.downed);
    const lethal = h && !h.invuln && d >= h.hp + h.guard;
    const tier = lethal ? 'sd-lethal' : (d >= 16 || anyHeavy) ? 'sd-lg' : d >= 9 ? 'sd-md' : 'sd-sm';
    return ' slot-telegraphed ' + tier;
  };

  const party = $('#party-half');
  party.innerHTML = '';
  ['back', 'mid', 'front'].forEach(row => {
    const slot = document.createElement('div');
    slot.className = 'slot' + dangerClass(row);
    slot.dataset.row = row;
    const h = S.heroes.find(x => x.row === row && !x.downed);
    const downedHere = S.heroes.find(x => x.row === row && x.downed);
    const dRow = rowDmg[row];
    const hRow = S.heroes.find(x => x.row === row && !x.downed);
    const lethalRow = hRow && !hRow.invuln && dRow >= hRow.hp + hRow.guard;
    slot.innerHTML = `<span class="slot-ring"></span><span class="slot-danger" aria-hidden="true"><span class="sd-ground"></span><span class="sd-brackets"><i></i><i></i><i></i><i></i></span><span class="sd-wave"></span></span>${dRow > 0 ? `<span class="slot-dmg${lethalRow ? ' sd-dmg-lethal' : ''}">${lethalRow ? '☠' : '✕'} ${dRow}</span>` : ''}`;
    const who = h || downedHere;
    if (who) {
      const solo = livingHeroes().length === 1;
      const targetable = targeting && !targeting.isRow && targeting.validIds.includes(who.id);
      // REUSE the hero's figure across renders (its SVG portrait is expensive) —
      // build once, then only swap chips / hp / aura.  Freed each fight.
      let fig = _partyFigs[who.id];
      if (fig && fig.querySelector('.fig-art svg')) {
        refreshPartyFig(fig, who, solo);
      } else {
        fig = document.createElement('div');
        fig.dataset.fig = who.id;
        fig.innerHTML = `
          ${solo ? `<span class="stance-tag">${STANCE[who.row].name.toUpperCase()}</span>` : ''}
          <div class="fig-art">${V2PORTRAITS[who.id] || ''}${who.downed ? '' : auraHTML(partyAuraObj(who))}</div>
          <div class="hp-bar"><div class="hp-fill" style="width:${(who.hp / who.maxHp) * 100}%"></div>${
            woundOf(who) ? `<div class="hp-wound" style="width:${(woundOf(who) / who.maxHp) * 100}%" title="✖ WOUNDED ${woundOf(who)} — healing cannot reach this. Only a REST at a fire closes it."></div>` : ''}</div>
          <div class="fig-name">${who.def.name} <span class="hp-num">${who.hp}/${who.maxHp}</span></div>
          <div class="fig-chips">${partyChipsHtml(who)}</div>
        `;
        attachHeroDrag(fig, who);
        _partyFigs[who.id] = fig;
      }
      fig.className = 'figure party' + (who.downed ? ' downed' : '') + (who._held && !who.downed ? ' fig-held' : '')
        + (who._castAnim ? ' fig-casting' : '')
        + (_rackIds && _rackIds.has(who.id) ? ' fig-focus' : '')
        + (targeting && targeting.card && targeting.card.owner === who.id ? ' fig-actor' : '')
        + (targetable ? ' fig-targetable' : '') + (canMove(who) ? ' can-move' : '');
      snapFx(who, { invuln: who.invuln ? 1 : 0, guard: who.guard, buffDmg: who.buffDmg, counter: who.counter, exposed: who.exposed, chill: who.chill, primed: who.primed ? 1 : 0 });
      // Click fallback for target-picking (synthetic clicks / accessibility
      // tools).  Safe alongside the pointer path: onFigureTap no-ops once
      // targeting clears, so a double-fire can't double-play.
      fig.onclick = () => { if (targeting) onFigureTap(who.id); };
      slot.appendChild(fig);
    }
    const lbl = document.createElement('span');
    lbl.className = 'slot-label';
    lbl.textContent = ROW_LABEL[row];
    slot.appendChild(lbl);
    if (targeting && targeting.isRow && targeting.validIds.includes('row:' + row)) {
      slot.style.cursor = 'pointer';
      slot.querySelector('.slot-ring').style.borderColor = 'var(--gold-bright)';
      if (!targeting.drag) slot.onclick = () => onRowTap(row);
    }
    party.appendChild(slot);
  });

  const enemyHalf = $('#enemy-half');
  // FLOOR BOSS — one colossal foe that fills the enemy half, rendered as a
  // single big figure (reused across renders — see renderFloorBoss) instead of
  // the three-slot line.
  const fboss = S.enemies.find(x => x.def.floorBoss && (!x.dead || x._justDied));
  enemyHalf.classList.toggle('has-floor-boss', !!fboss);
  enemyHalf.classList.toggle('boss-maw', !!(fboss && fboss.def.aura === 'maw'));      // the Maw glows a sickly amethyst
  enemyHalf.classList.toggle('boss-sunder', !!(fboss && fboss.def.aura === 'sunder'));  // the Sundering glows spectral cyan
  if (fboss) { renderFloorBoss(enemyHalf, fboss, targeting); return; }
  _bossFig = null;
  enemyHalf.innerHTML = '';
  ['front', 'mid', 'back'].forEach(row => {
    const slot = document.createElement('div');
    slot.className = 'slot';
    slot.dataset.row = row;
    const e = S.enemies.find(x => x.row === row && (!x.dead || x._justDied));
    if (e) {
      const primed = !!(e.lull || e.weakened || e.staggered);
      // REUSE the figure across renders (Build 241) — this was the LAG: every
      // renderAll rebuilt each enemy from scratch, re-parsing its SVG portrait
      // and re-rasterizing its drop-shadow filters, several times per action.
      // The boss and the party were cached builds ago for exactly this reason;
      // the line never was.  Moving a cached node between slots is free.
      let fig = _enemyFigs[e.uid];
      if (fig && !e._justDied && fig.querySelector('.fig-art *')) {
        const swap = (sel, html) => { const el = fig.querySelector(sel); if (el && html) { const t = document.createElement('div'); t.innerHTML = html; el.replaceWith(t.firstElementChild); } };
        swap('.intent', enemyIntentHtml(e));
        swap('.fig-chips', enemyChipsHtml(e));
        const art = fig.querySelector('.fig-art');
        if (art) { const oa = art.querySelector('.fig-aura'); if (oa) oa.remove(); const a = enemyAuraHtml(e); if (a) art.insertAdjacentHTML('beforeend', a); }
        const fill = fig.querySelector('.hp-fill'); if (fill) fill.style.width = (e.hp / e.maxHp * 100) + '%';
        const hpNum = fig.querySelector('.hp-num'); if (hpNum) hpNum.textContent = e.hp + '/' + e.maxHp;
      } else {
        fig = document.createElement('div');
        fig.dataset.fig = e.uid;
        fig.innerHTML = enemyFigInner(e);
        _enemyFigs[e.uid] = fig;
      }
      const targetable = targeting && !targeting.isRow && targeting.validIds.includes(e.uid);
      fig.className = 'figure enemy' + (e._justDied ? ' fig-dying' : '') + (primed && !e._justDied ? ' fig-primed' : '')
        + (_rackIds && _rackIds.has(e.uid) ? ' fig-focus' : '') + (targetable ? ' fig-targetable' : '');
      snapFx(e, { weakened: e.weakened ? 1 : 0, staggered: e.staggered ? 1 : 0, guard: e.guard, power: e.power, mark: e.mark, lull: e.lull });
      fig.onclick = () => onFigureTap(e.uid);
      slot.appendChild(fig);
    } else {
      const dead = S.enemies.find(x => x.row === row && x.dead && !x._justDied);
      if (dead) delete _enemyFigs[dead.uid];
    }
    enemyHalf.appendChild(slot);
  });
  // arcs measure real rects, so they draw after this layout settles
  requestAnimationFrame(() => renderTelegraphArcs());
}
// ── TELEGRAPH ARCS (v2.2 Build 4) ───────────────────────────────────────────
// The telegraph marks GROUND, not people. A blow is aimed at a ROW — a hero
// can dodge out of it by moving, and since the dash a hero may be holding a
// pose halfway across the field while their home slot is the thing actually
// threatened. So the slot carries a ground decal (.sd-ground) and each
// attacker is CONNECTED to the ground it will strike by a low dashed arc:
// who → where, still readable with three intents in the air, and honest when
// a smart foe re-aims. Measured from real rects like every thread is.
function renderTelegraphArcs() {
  const bfEl = $('#battlefield'); if (!bfEl) return;
  let svg = document.getElementById('telegraph-layer');
  if (!svg) {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'telegraph-layer';
    svg.setAttribute('aria-hidden', 'true');
    bfEl.appendChild(svg);
  }
  if (!S || S.over) { svg.innerHTML = ''; return; }
  const scale = stageScale() || 1;
  const bf = bfEl.getBoundingClientRect();
  if (!bf.width) return;
  svg.setAttribute('viewBox', `0 0 ${Math.round(bf.width / scale)} ${Math.round(bf.height / scale)}`);
  const groundOf = (row) => {
    const el = document.querySelector('#party-half .slot[data-row="' + row + '"]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: (r.left + r.width / 2 - bf.left) / scale, y: (r.bottom - 26 - bf.top) / scale };
  };
  // Gather every arc first, then draw only the few that matter (v2.2 Build 6):
  // four foes all aiming at one row drew four crossing dashes — spaghetti that
  // said less than the slot's summed damage chip already says. The heaviest
  // three threats (lethal first) keep their arcs; the rest speak through the
  // ground ring and the total.
  const cand = [];
  livingEnemies().forEach(e => {
    const el = figEl(e.uid); if (!el) return;
    const r = el.getBoundingClientRect();
    if (!r.width) return;
    const from = { x: (r.left + r.width * 0.3 - bf.left) / scale, y: (r.top + r.height * 0.78 - bf.top) / scale };
    enemyNextIntents(e).forEach(it => {
      if (!it || it.kind === 'buff') return;
      const dmg = enemyIntentDmg(e, it);
      const row = effIntentRow(e, it);
      (row === 'all' ? ROWS.slice() : (row ? [row] : [])).forEach(rw => {
        const to = groundOf(rw); if (!to) return;
        const h = S.heroes.find(x => x.row === rw && !x.downed);
        const lethal = h && !h.invuln && dmg >= h.hp + h.guard;
        cand.push({ from, to, dmg, lethal, heavy: !!(it.heavy || dmg >= 12) });
      });
    });
  });
  cand.sort((a, b) => (b.lethal - a.lethal) || (b.heavy - a.heavy) || (b.dmg - a.dmg));
  svg.innerHTML = cand.slice(0, 3).map(c => {
    const cls = 'tg-arc' + (c.lethal ? ' tg-lethal' : c.heavy ? ' tg-heavy' : '');
    const mx = (c.from.x + c.to.x) / 2;
    const my = Math.min(c.from.y, c.to.y) - 30 - Math.abs(c.from.x - c.to.x) * 0.05;
    return `<path class="${cls}" d="M ${c.from.x.toFixed(1)} ${c.from.y.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${c.to.x.toFixed(1)} ${c.to.y.toFixed(1)}"/>`;
  }).join('');
}
// one intent rendered as an inline segment (glyph · dmg → row · riders)
function intentSeg(e, it) {
  if (it.kind === 'buff') {
    // Telegraph the MECHANICAL effect, not the flavor line — a compact glyph so
    // the pill stays one short, readable segment (the flavor lives in the title).
    let eff = 'GATHERS';
    if (it.powerAll) eff = '▲ ALL +' + it.powerAll;
    else if (it.powerSelf) eff = '▲ +' + it.powerSelf;
    else if (it.guardSelf) eff = '⛨ +' + it.guardSelf;
    return `<span class="i-seg" title="${it.desc || ''}"><span class="i-glyph">◈</span><span class="i-row">${eff}</span></span>`;
  }
  const row = effIntentRow(e, it);   // smart foes point at the hero they're hunting
  // v2.2 Build 6: the pill carries only WHO hits HOW HARD (+ status riders).
  // WHERE lives on the ground now — the slot's impact ring, its summed damage
  // chip, and the telegraph arc — so four packed foes stop colliding into a
  // wall of "→ BACK → BACK → BACK". The one exception is ALL: a blow no
  // reposition dodges is information the ground of one slot cannot carry.
  return `<span class="i-seg"><span class="i-glyph">⚔</span><span class="i-dmg">${enemyIntentDmg(e, it)}</span>${row === 'all' ? '<span class="i-row">ALL</span>' : ''}${it.hex ? '<span class="i-st kw-hex" title="HEX — if it lands, your card plays burn your hand; dodge it">☠</span>' : ''}${it.drain ? '<span class="i-st kw-drain" title="drains life — heals the Maw">♥</span>' : ''}${it.chill ? '<span class="i-st kw-chill" title="chills you">❄</span>' : ''}${it.expose ? '<span class="i-st kw-exposed" title="exposes you">◎</span>' : ''}${it.shove === 'front' ? '<span class="i-st kw-shove" title="DRAGS the struck hero one row forward — parry to hold your ground">⇱</span>' : ''}${it.shove === 'back' ? '<span class="i-st kw-shove" title="SHOVES the struck hero one row back — parry to hold your ground">⇲</span>' : ''}</span>`;
}
// the intent telegraph markup for an enemy (one or a boss's chained two)
function enemyIntentHtml(e) {
  const its = enemyNextIntents(e);
  const heavy = its.some(x => x.heavy);
  return its.length > 1
    ? `<div class="intent intent-multi${heavy ? ' intent-heavy' : ''}">${its.map(x => intentSeg(e, x)).join('<span class="i-div">+</span>')}</div>`
    : `<div class="intent${its[0].kind === 'buff' ? ' intent-buff' : ''}${heavy ? ' intent-heavy' : ''}">${intentSeg(e, its[0])}</div>`;
}
function enemyChipsHtml(e) {
  return `<div class="fig-chips">
      <span class="chip weak${e.weakRevealed ? ' revealed' : ''}" title="weakness — each hit of this element chips a ◈ POISE pip; at zero the foe BREAKS">${e.weakRevealed ? `<span class="ru-i">${SCHOOL_GLYPH[e.def.weak] || '?'}</span>${(e.def.weak || '?').toUpperCase()}` : `<span class="ru-i">◇</span>?`}</span>
      ${!e.staggered && e.poiseMax ? `<span class="chip poise${chipPop(e,'poiseInv',(e.poiseMax - e.poise))}" title="POISE — weakness hits chip these pips; at zero the foe BREAKS: ×1.5 damage taken and its next action is LOST">${'◈'.repeat(e.poise)}${'◇'.repeat(Math.max(0, e.poiseMax - e.poise))}</span>` : ''}
      ${e.staggered ? `<span class="chip stagger${chipPop(e,'staggered',1)}"><span class="ru-i">⚡</span>BROKEN</span>` : ''}
      ${!e.staggered && (e.weakened || e.lull) ? `<span class="chip tech${chipPop(e,'weakened',1)}" title="OPENED — it just took a weakness hit or a CHILL. Strike it now with ANY school for a TECHNICAL: half again the damage and a burst surge — so spend your BIGGEST hit on it.">${'<span class="ru-i">⚡</span>'}OPEN</span>` : ''}
      ${e.guard ? `<span class="chip guard${chipPop(e,'guard',e.guard)}"><span class="ru-i">⛨</span>${e.guard}</span>` : ''}
      ${e.power ? `<span class="chip buff${chipPop(e,'power',e.power)}"><span class="ru-i">▲</span>${e.power}</span>` : ''}
      ${e.mark ? `<span class="chip mark${chipPop(e,'mark',e.mark)}"><span class="ru-i">◎</span>${e.mark}</span>` : ''}
      ${e.lull ? `<span class="chip chill${chipPop(e,'lull',e.lull)}"><span class="ru-i">❄</span>${e.lull}</span>` : ''}
    </div>`;
}
function enemyAuraHtml(e) {
  return e._justDied ? '' : auraHTML({ guard: e.guard, rally: e.power, chill: e.lull, exposed: e.mark, weak: e.weakened, stagger: e.staggered });
}
// The inner markup for an enemy figure (shared by the line + the floor boss).
function enemyFigInner(e) {
  // THE ART ZONE IS SACRED (Build 239): the telegraph rides above the figure,
  // the STATUS lives in the nameplate below it.  Nothing covers a character.
  return `
    ${enemyIntentHtml(e)}
    <div class="fig-art">${enemyArt(e)}${enemyAuraHtml(e)}</div>
    <div class="hp-bar"><div class="hp-fill" style="width:${(e.hp / e.maxHp) * 100}%"></div></div>
    <div class="fig-name">${e.def.name} <span class="hp-num">${e.hp}/${e.maxHp}</span></div>
    ${enemyChipsHtml(e)}
  `;
}
// PERF: the floor boss's art is a big, heavily-filtered SVG.  Recreating it on
// every renderAll re-rasterizes that filter — a stutter machine mid-fight.  So we
// KEEP the same figure element across renders and update only the cheap dynamic
// bits (intent, chips, hp, aura, classes); the expensive .fig-art SVG stays put.
let _bossFig = null;
function renderFloorBoss(enemyHalf, fboss, tgt) {
  const primed = !!(fboss.lull || fboss.weakened || fboss.staggered);
  const justDied = fboss._justDied;
  const reuse = _bossFig && _bossFig.dataset.fig === fboss.uid && !justDied && _bossFig.querySelector('.fig-art svg');
  let fig;
  if (reuse) {
    fig = _bossFig;
    const swap = (sel, html) => { const el = fig.querySelector(sel); if (el && html) { const t = document.createElement('div'); t.innerHTML = html; el.replaceWith(t.firstElementChild); } };
    swap('.intent', enemyIntentHtml(fboss));
    swap('.fig-chips', enemyChipsHtml(fboss));
    const art = fig.querySelector('.fig-art');
    if (art) { const oa = art.querySelector('.fig-aura'); if (oa) oa.remove(); const a = enemyAuraHtml(fboss); if (a) art.insertAdjacentHTML('beforeend', a); }
    const fill = fig.querySelector('.hp-fill'); if (fill) fill.style.width = (fboss.hp / fboss.maxHp * 100) + '%';
    const hpNum = fig.querySelector('.hp-num'); if (hpNum) hpNum.textContent = fboss.hp + '/' + fboss.maxHp;
  } else {
    fig = document.createElement('div');
    fig.dataset.fig = fboss.uid;
    fig.innerHTML = enemyFigInner(fboss);
    _bossFig = fig;
  }
  fig.className = 'figure enemy floor-boss' + (justDied ? ' fig-dying' : '') + (primed && !justDied ? ' fig-primed' : '')
    + ((tgt && !tgt.isRow && tgt.validIds.includes(fboss.uid)) ? ' fig-targetable' : '');
  fig.onclick = () => onFigureTap(fboss.uid);
  if (enemyHalf.firstElementChild !== fig || enemyHalf.childElementCount !== 1) {
    while (enemyHalf.firstChild) enemyHalf.removeChild(enemyHalf.firstChild);
    enemyHalf.appendChild(fig);
  }
  snapFx(fboss, { weakened: fboss.weakened ? 1 : 0, staggered: fboss.staggered ? 1 : 0, guard: fboss.guard, power: fboss.power, mark: fboss.mark, lull: fboss.lull });
}

// Bonds no longer draw a permanent web of lines across the party (it cluttered
// the field and read vaguely).  The thread layer stays clear; a bond forming
// plays a single quick SPARK between the pair (see sparkThread), and the running
// state lives in the compact RESONANCE badge (see renderResonance).
function renderThreads() {
  const svg = $('#thread-layer');
  if (svg) svg.innerHTML = '';
}
// A one-shot spark that arcs between two bonded heroes, then fades — the moment
// of connection, not a persistent tether.
function sparkThread(a, b) {
  const ea = figEl(a), eb = figEl(b); if (!ea || !eb) return;
  const bf = $('#battlefield').getBoundingClientRect(), scale = stageScale();
  const ra = ea.getBoundingClientRect(), rb = eb.getBoundingClientRect();
  const x1 = (ra.left + ra.width / 2 - bf.left) / scale, y1 = (ra.top + ra.height * 0.42 - bf.top) / scale;
  const x2 = (rb.left + rb.width / 2 - bf.left) / scale, y2 = (rb.top + rb.height * 0.42 - bf.top) / scale;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'thread-spark');
  svg.setAttribute('viewBox', `0 0 ${Math.round(bf.width / scale)} ${Math.round(bf.height / scale)}`);
  svg.innerHTML = `<path d="M ${x1} ${y1} Q ${(x1 + x2) / 2} ${Math.min(y1, y2) - 26} ${x2} ${y2}" class="ts-line"/>`;
  $('#battlefield').appendChild(svg);
  setTimeout(() => svg.remove(), 850);
}
// The RESONANCE badge — a small triangle of the trio's three bonds.  Each edge
// lights as its thread forms; a full triangle is TRIAD READY.  Replaces the old
// web of lines with one legible "how close am I to the vow" read.
// ── THE KIZUNA TRIANGLE (Build 222) — the meter IS the interface.  Its three
// edges ARE the three pairs: dim = strangers, gold = bonded this fight,
// pulsing = a WOVEN pair.  Tap it to open the bond panel, where the whole
// system is legible in one card — and where BOND is a VERB: spend 1 EP to
// deepen an edge deliberately instead of hoping your hand cooperates.
function renderResonance() {
  const el = $('#resonance'); if (!el) return;
  const live = S ? livingHeroes() : [];
  // Build 224: the interface DEGRADES instead of hiding.  A duo still has an
  // edge, a duet perk and the BOND verb — losing your third hero must not
  // erase the whole system from the screen mid-boss.
  if (!S || S.node.chapter < 2 || live.length < 2) { el.classList.add('hidden'); el.classList.remove('rz-ready'); hideBondPanel(); return; }
  el.classList.remove('hidden');
  const ids = live.slice(0, 3).map(h => h.id);
  const duo = ids.length === 2;
  const C = duo ? [{ x: 5, y: 23 }, { x: 41, y: 23 }] : [{ x: 23, y: 7 }, { x: 43, y: 39 }, { x: 3, y: 39 }];
  const E = duo ? [[0, 1]] : [[0, 1], [1, 2], [0, 2]];
  let formed = 0, ripe = false;
  const edges = E.map(([i, j]) => {
    const key = pairKey(ids[i], ids[j]);
    const on = S.threads.has(key); if (on) formed++;
    // an edge whose BOTH heroes stand primed is one card away from forming
    if (!on && primeReady(ids[i], ids[j])) ripe = true;
    const woven = bondPts(key) >= BOND_KINDLED;
    return `<line x1="${C[i].x}" y1="${C[i].y}" x2="${C[j].x}" y2="${C[j].y}" class="rz-edge${on ? ' on' : ''}${woven ? ' woven' : ''}"/>`;
  }).join('');
  const fill = !duo && formed === 3 ? `<polygon points="${C.map(c => c.x + ',' + c.y).join(' ')}" class="rz-fill"/>` : '';
  const dots = ids.map((id, i) => `<circle cx="${C[i].x}" cy="${C[i].y}" r="4.2" class="rz-dot" style="fill:${HEROES[id].tint}"/>`).join('');
  const ready = !!S.triadFormed;
  el.classList.toggle('rz-ready', ready);
  el.classList.toggle('rz-ripe', ripe);
  const label = ready ? '✦ TRIAD · ALL-OUT CROWNED' : '♡ KIZUNA ' + formed + '/' + (duo ? 1 : 3);
  el.innerHTML = `<svg viewBox="-3 -3 52 48" class="rz-svg">${fill}${edges}${dots}</svg><span class="rz-lbl">${label}</span>${ripe ? '<span class="rz-ripe-pip" title="A FOLLOW-UP is open — play it to bond the pair">✦</span>' : ''}`;
  // The bond panel is the only always-available explanation of the loop, and it
  // sat behind a tap with no title, no hint and a desktop-only hover glow — on a
  // touch game with a PWA manifest, effectively undiscoverable.
  el.title = 'KIZUNA — tap to see each pair: how deep the bond is, whether it is LIT or WOVEN, and what their move is.';
  el.classList.toggle('rz-ripe', !!ripe);
  el.onclick = () => { if (_bondPanelEl) hideBondPanel(); else showBondPanel(); };
  if (!el._taught && formed === 0 && live.length >= 2) { el._taught = 1;
    setTimeout(() => lesson('resonance', '◮ TAP THE KIZUNA BADGE — every pair, and what each one still needs.', 2), 1400); }
}
// ♡ SIGNPOST — an ally-target card whose play could form a NEW bond wears a
// small heart, so cause-and-effect reads BEFORE the card is committed.
// (Helping an ally still bonds — that path was never the confusing one.)
function cardBondHint(card) {
  // `allies` was excluded, which meant a party-wide heal — the biggest bond
  // source in the game, since it ties the caster to EVERYONE — was the one card
  // that never wore the mark.
  if (!S || (card.target !== 'ally' && card.target !== 'allies') || card.spent) return '';
  const o = card.owner;
  const would = livingHeroes().some(h => h.id !== o && !S.threads.has(pairKey(o, h.id)));
  return would ? '<span class="c-bond-hint" title="Helping an ally forms a ♡ BOND">♡</span>' : '';
}

let _bondPanelEl = null;
function hideBondPanel() { if (_bondPanelEl) { _bondPanelEl.remove(); _bondPanelEl = null; } }
function showBondPanel() {
  hideBondPanel();
  if (!S || S.over) return;
  const live = livingHeroes().slice(0, 3);
  if (live.length < 2) return;   // Build 224: a duo's single edge still gets its panel
  const ids = live.slice(0, 3).map(h => h.id);
  const pairs = (ids.length === 2 ? [[0, 1]] : [[0, 1], [1, 2], [0, 2]]).map(([i, j]) => [ids[i], ids[j]]);
  // A READOUT, not a shop.  Build 226 removed the "BOND · 1 EP" button — the
  // only way to bond deliberately is now to finish two combos and play the
  // FOLLOW-UP they open.  So the useful thing to show for an unformed pair is
  // what it still NEEDS, read live off who is standing primed.
  const primeTag = (id) => {
    const h = S.heroes.find(x => x.id === id);
    const t = h && h.primed && PRIME_TYPES[h.primed.type];
    return t ? `<b>${t.glyph}</b>` : '<span class="bp-need-miss">◦</span>';
  };
  // ONE LADDER, ONE PLACE (Build 270).  Four different numbers all called some
  // flavour of "bond" used to live in four different screens: the run's points,
  // the fight's live thread, the arc stage, and whether the pair's node was
  // taken.  Nobody could hold that.  The panel now shows the whole ladder for
  // each pair, in one grammar, with the same words the rest of the game uses:
  //
  //   ♡ n/2   what this descent has earned them
  //   ♡ LIT   their bond is live for THIS fight (a deed lit it)
  //   ✦ WOVEN they walk in connected, every fight, for the rest of the descent
  //   ◈ <move> their own ability — asked for at a fire, taken on the lattice
  const row = ([a, b]) => {
    const key = pairKey(a, b);
    const lit = S.threads.has(key), woven = bondPts(key) >= BOND_KINDLED;
    const pts = Math.min(bondPts(key), BOND_KINDLED);
    const state = woven ? '<span class="bp-state bp-woven">✦ WOVEN</span>'
      : lit ? '<span class="bp-state bp-bonded">♡ LIT</span>'
      : '<span class="bp-state bp-none">—</span>';
    const need = (lit || woven) ? ''
      : primeReady(a, b) ? '<span class="bp-need bp-ready">✦ READY — play their FOLLOW-UP</span>'
      : `<span class="bp-need">both must be ${primeTag(a)} + ${primeTag(b)} <i>primed</i></span>`;
    const perk = duetPerkFor(a, b);
    // The fourth rung, which the panel never showed at all: their MOVE, and
    // exactly where it is on the way to being yours.
    const held = bondNodeHeld(a, b), offered = bondGiftHeld(a, b);
    const running = held || lit || woven;
    const moveWhere = held ? '<b>YOURS</b>'
      : offered ? 'on the lattice — <b>not taken yet</b>'
      : 'ask for it at a <b>fire</b>';
    return `<div class="bp-row">
      <span class="bp-pair"><i style="background:${HEROES[a].tint}"></i><i style="background:${HEROES[b].tint}"></i> ${HEROES[a].name} ─ ${HEROES[b].name}</span>
      <span class="bp-pts">♡ ${pts}/${BOND_KINDLED}</span>
      ${state}${need}
      <span class="bp-perk${running ? ' bp-perk-live' : ''}">◈ <b>${perk.name}</b> — ${perk.desc}</span>
      <span class="bp-move">${running ? (perk.strike ? (S._strikeFired && S._strikeFired[key] ? '<b>SPENT</b> this fight · ' : '<b>WATCHING</b> · ') : '<b>RUNNING</b> · ') : ''}${moveWhere}</span>
    </div>`;
  };
  const el = document.createElement('div');
  el.id = 'bond-panel';
  el.innerHTML = `
    <div class="bp-head">♡ KIZUNA</div>
    <div class="bp-teach">Finish a hero's <b>combo</b> and they stand <b>PRIMED</b>. When another hero finishes theirs, the primed hero's <b>FOLLOW-UP</b> opens in your hand — play it and their bond goes <b>♡ LIT</b> for this fight. Two of those and the pair is <b>✦ WOVEN</b>: connected from turn one, every fight after. ${pairs.length === 1 ? 'A pair’s <b>◈ move</b> runs while both stand.' : 'Weave all three to <b>crown the ALL-OUT</b>.'}</div>
    ${pairs.map(row).join('')}`;
  $('#stage').appendChild(el);
  _bondPanelEl = el;
}

// The MOMENTUM gauge — fills as you exploit weaknesses / chain ASSISTS; when
// full it becomes a tappable ALL-OUT button.
// CARD CHARACTER ART — each card wears the OWNER's portrait behind its face, like
// a JRPG action card.  The url is parsed once from V2PORTRAITS (the same art as
// the combat figure), so a card always reads as that character.  A hero with only
// a drawn SVG portrait (no PNG) simply keeps the classic dark card.
const CARD_ART = {};
function cardArtUrl(id) {
  if (id in CARD_ART) return CARD_ART[id];
  const p = (typeof V2PORTRAITS !== 'undefined' && V2PORTRAITS[id]) || '';
  const m = p.match(/href="(\.\.\/art\/[^"]+\.(?:webp|png))"/);   // Build 254: art is WebP now
  return CARD_ART[id] = (m ? m[1] : '');
}
// Per-hero BUST framing — each portrait is composed differently (Elin has a tall
// staff + headroom above her head), so a single crop can't frame them all.  These
// override the CSS default (`auto 205% / 50% 2%`) to land each character's face in
// the card.  `size | position` (CSS background-size | background-position).
// Tuned per hero so every character's EYES land at the same card height and heads
// are a consistent size — the source arts frame each figure differently (Ash sits
// high in frame, Elin low behind a tall staff), so a single crop can't align them.
const CARD_ART_FRAME = {
  ash:     'auto 230% | 50% 0%',
  elin:    'auto 230% | 50% 23%',
  cassia:  'auto 230% | 50% 7%',
  mira:    'auto 230% | 50% 2%',
  branwen: 'auto 230% | 50% 0%',
  hask:    'auto 230% | 50% 2%',
};
function cardArtHTML(card) {
  const id = card && card.owner ? card.owner : '';
  const url = id ? cardArtUrl(id) : '';
  if (!url) return '';
  const f = CARD_ART_FRAME[id];
  let extra = '';
  if (f) { const [size, pos] = f.split('|').map(s => s.trim()); extra = `;background-size:${size};background-position:${pos}`; }
  return `<div class="c-art" style="background-image:url('${url}')${extra}"></div>`;
}
function renderBurst() {
  const burst = $('#burst'); if (!burst) return;
  const cap = burstCap();
  const level = (S.burstLevel || 1);
  const frac = Math.max(0, Math.min(1, (S.momentum || 0) / cap));
  $('#burst-fill').style.width = (frac * 100) + '%';
  burst.style.setProperty('--charge', frac.toFixed(3));   // glow intensity ramps with charge
  // container LEVEL theming (richer as it expands) + the tier notches that show
  // where L2 / L3 sit inside the widened gauge.
  burst.classList.toggle('bl-2', level >= 2);
  burst.classList.toggle('bl-3', level >= 3);
  let ticks = burst.querySelector('.burst-ticks');
  if (!ticks) { ticks = document.createElement('div'); ticks.className = 'burst-ticks'; burst.insertBefore(ticks, burst.querySelector('#burst-lbl')); }
  ticks.innerHTML = BURST_CAPS.slice(1).map((thr, i) => {
    const lv = i + 2;
    return level >= lv ? `<span class="burst-tick bt-${lv}" style="left:${(thr / cap * 100).toFixed(1)}%"></span>` : '';
  }).join('');
  // Build 257: the all-out is TAPPABLE from BURST_MIN. A widened gauge used to
  // read "HOLD" and refuse the tap until it was full, which is how bonding took
  // an all-out away. It still SAYS holding pays more — it just no longer decides
  // for you.
  const full = burstReady();                          // momentum ≥ BURST_MIN
  const holding = false;
  const wasFull = burst.classList.contains('burst-ready');
  burst.classList.toggle('burst-ready', full);
  const fl = burstFireLevel();
  $('#burst-lbl').textContent = full
    ? (fl >= 2 ? '⚡ TAP · ALL-OUT ' + '✦'.repeat(fl) : '⚡ TAP · ALL-OUT')
    : holding ? 'BURST ✦' + level + ' · HOLD'
    : (level > 1 ? 'BURST ✦' + level : 'BURST');
  burst.onclick = full ? () => triggerAllOut() : null;
  burst.style.cursor = full ? 'pointer' : 'default';
  if (full && !wasFull) haptic(HAP.good);
}
function renderActionBar() {
  $('#ep-num').textContent = S.ep;
  $('#ep-max').textContent = '/' + S.maxEp;
  renderBurst();
  $('#btn-endturn').disabled = S.executing || S.over;
  // Build the hand ONCE (it applies riders/forges/boons per card — not free).
  const hand = buildHand();
  // When nothing is playable, softly pulse END TURN so the next step is obvious.
  const anyPlayable = hand.some(c => !c.spent && c.cost <= S.ep)
    || livingHeroes().some(h => canMove(h));
  $('#btn-endturn').classList.toggle('et-nudge', !S.executing && !S.over && !anyPlayable);

  const handEl = $('#hand');
  if (S.over) { handEl.innerHTML = ''; S._handStructSig = S._handAffSig = null; return; }
  // PERF: renderAll fires after every hit / parry / animation beat.  Rebuilding the
  // hand DOM (+ re-attaching drag per card) is the single biggest cost — ~10× a
  // skipped render.  So split the signature: the STRUCTURAL sig (which cards, their
  // faces) drives a rebuild; but EP and SPENT only change a card's *affordability
  // styling*, not its face — so those take a cheap class-toggle pass, no teardown.
  // This turns "played an opener / EP shifted" (very common in rotation play) from
  // a full rebuild into a handful of classList toggles.
  const structSig = hand.map(c => `${c.uid || (c.owner + c.name)}:${c.cost}:${c.kind}`).join('|')
    + (S._tempNew || '') + (S._forgeEvent ? 'F' + S._forgeEvent.uids.join(',') : '')
    + (S.executing ? 'X' : '') + (targeting ? 'T' : '')
    + '♡' + S.threads.size;   // the ♡ bond-hint on ally cards keys off formed threads (Build 222)
  const affSig = S.ep + '/' + S.maxEp + '|' + hand.map(c => (c.spent ? 1 : 0)).join('');
  if (structSig === S._handStructSig && handEl.childElementCount === hand.length) {
    if (affSig !== S._handAffSig) {                 // structure unchanged — only affordability shifted
      S._handAffSig = affSig;
      const kids = handEl.children;
      for (let i = 0; i < hand.length && i < kids.length; i++) {
        const card = hand[i], el = kids[i];
        el.classList.toggle('card-spent', !!card.spent);
        el.classList.toggle('disabled', !card.spent && card.cost > S.ep);
      }
    }
    return;
  }
  S._handStructSig = structSig; S._handAffSig = affSig;
  handEl.innerHTML = '';
  // Icon-first card face — legibility over prose (mobile).  Full text lives
  // in the card's title attribute for anyone who wants the detail.
  const fxIconStr = (fx, hasAll, dg) => {
    dg = dg || '⚔';   // the damage glyph carries the card's ELEMENT (blade/light/…)
    const b = [];
    const d = fx.dmg || fx.hitFrontmost;
    if (fx.aoeDmg) b.push(`<span class="ic ic-dmg">${dg}${fx.aoeDmg}<em>·ALL</em></span>`);
    else if (d)    b.push(`<span class="ic ic-dmg">${dg}${d}</span>`);
    if (fx.smite)  b.push(`<span class="ic ic-dmg">✦${fx.smite}</span>`);   // support-with-teeth strike
    const heal = fx.heal || fx.healAll;
    if (heal) b.push(`<span class="ic ic-heal">✚${heal}${fx.healAll ? '<em>·ALL</em>' : ''}</span>`);
    const g = fx.guard || fx.guardAll || fx.guardFront;
    if (g) b.push(`<span class="ic ic-guard">⛨${g}</span>`);
    const r = fx.buffDmg || fx.buffAllDmg;
    if (r) b.push(`<span class="ic ic-rally">▲${r}</span>`);
    const co = fx.counter || fx.counterAll;
    if (co) b.push(`<span class="ic ic-counter">↺${co}</span>`);
    const l = fx.lull || fx.lullAll;
    if (l) b.push(`<span class="ic ic-chill">❄${l}</span>`);
    const m = fx.mark || fx.markAll;
    if (m) b.push(`<span class="ic ic-exposed">◎${m}</span>`);
    if (fx.invulnFront) b.push(`<span class="ic ic-guard">✦INV</span>`);
    if (fx.pushBack) b.push(`<span class="ic ic-move">⇄PUSH</span>`);
    if (fx.step) b.push(`<span class="ic ic-move">⇄${fx.step === 'front' ? 'F' : 'B'}</span>`);
    if (fx.warp) b.push(`<span class="ic ic-move">✦${(fx.warp[0] || '').toUpperCase()}</span>`);
    return b.join('');
  };
  const cardIcons = (card) => {
    const fx = card.fx || {};
    const dg = SCHOOL_GLYPH[card.school] || '⚔';   // element carried on the damage number
    if (fx.notToday) return `<span class="ic ic-move">⇄</span><span class="ic ic-heal">✚4</span><span class="ic ic-guard">⛨4</span><span class="ic ic-counter">↺2</span>`;
    if (fx.bondFollow) return FOLLOW_ICONS[fx.bondFollow.partnerId] || '';   // a follow-up reads at a glance too
    return fxIconStr(fx, false, dg);
  };
  // Reach: a 3-cell front/mid/back diagram for enemy cards (filled = can hit),
  // so 'nearest' vs 'any' reads without words; support targets stay labelled.
  const reachPips = (cells) => `<span class="rch-pips" title="enemy reach — front · mid · back">${cells.map(c => `<i class="rp${c ? ' on' : ''}"></i>`).join('')}</span>`;
  const cardReach = (card) => {
    const fx = card.fx || {};
    if (fx.notToday) return `<span class="rch rch-t">◇ BOND</span>`;
    switch (card.target) {
      case 'frontmost': return `${reachPips([1, 0, 0])}`;
      case 'enemy':     return `${reachPips([1, 1, 1])}`;
      case 'ally':      return `<span class="rch rch-a">♥ ALLY</span>`;
      case 'allies':    return `<span class="rch rch-a">♥ PARTY</span>`;
      case 'self':      return `<span class="rch rch-a">SELF</span>`;
      default:          return '';
    }
  };
  // Chain-position readout — shows where a rotation card sits in its combo as a
  // DIRECTIONAL role label (OPENER → · → COMBO → · → FINISHER).  The arrows carry
  // the sequence without asserting a fixed length, so it stays correct for a
  // 2-step base line, a fork, or any number of middle steps.  Purely textual, so
  // it never reads as the red enemy-reach pips above it.
  const chainStep = (card) => {
    if (!card.chain) return '';
    const head = String(card.stance || '').split('·')[0].trim().toUpperCase();
    const A = '<span class="c-arrow">→</span>';
    let inner = '';
    // A REACHED opener reads 'REACH · MID', not 'OPENER · …', so it used to fall
    // through this table and render NO role line at all — the one card on the
    // table that did not say what it was. Harmless while the reach sat beside the
    // hero's real opener; since Build 294 it IS that hero's whole hand, so on a
    // reach turn one hero's card silently stopped announcing itself. Trust the
    // card's KIND over its label.
    if (head === 'OPENER' || card.kind === 'opener') inner = `<span class="c-role">OPENER</span>${A}`;
    else if (head === 'COMBO') inner = `${A}<span class="c-role">COMBO</span>${A}`;
    else if (head === 'FINISHER') inner = `${A}<span class="c-role">FINISHER</span>`;
    else return '';
    return `<div class="c-step">${inner}</div>`;
  };
  hand.forEach(card => {
    const type = cardType(card);
    const el = document.createElement('div');
    el.className = `card kind-${card.kind}${card.follow ? ' card-follow' : ''}`
      + (card.spent ? ' card-spent' : (card.cost > S.ep ? ' disabled' : ''));
    if (card.temp && S._tempNew === card.uid) { el.classList.add('card-burn-in'); S._tempNew = null; }
    // FORGED-THIS-PLAY cards burn in together, staggered so a two-path fork reads
    // as "one → two" (and the shard flourish below lands on each in turn).
    if (card.temp && S._forgeEvent && S._forgeEvent.uids.indexOf(card.uid) >= 0) {
      const oi = S._forgeEvent.uids.indexOf(card.uid);
      el.classList.add('card-forge-in');
      el.style.setProperty('--forge-delay', (oi * 150 + 220) + 'ms');   // land as the shard arrives
    }
    el.style.setProperty('--tint', card.tint);
    el.dataset.owner = card.owner;
    if (card.uid != null) el.dataset.uid = card.uid;
    el.dataset.cardName = card.name;
    el.dataset.target = card.target || 'none';
    el.dataset.kind = card.kind;
    el.title = card.name + ' — ' + card.desc.replace(/<[^>]+>/g, '');
    // SACRIFICE is a gesture now (drag the card onto the EP dial) — no button.
    // Forged/temporary cards need no ✧ badge — their dashed gold frame (and, for
    // rotation steps, the COMBO/FINISHER role line) already reads as temporary.
    el.innerHTML = `
      ${cardArtHTML(card)}
      <div class="c-top">
        <span class="c-cost tempo-${card.tempo || 'steady'}${card.cost === 0 ? ' c-free' : ''}"${card.cost === 0 ? ' title="Free — costs no EP"' : ''}>${card.cost === 0 ? '✦' : card.cost}</span>
        <span class="c-name">${card.name}</span>${cardBondHint(card)}
      </div>
      <div class="c-fx">${cardIcons(card)}</div>
      <div class="c-desc">${card.desc}</div>
      <div class="c-reach">${cardReach(card)}</div>
      <div class="c-owner"><span>${card.ownerName}</span>${card.chain ? '' : `<span class="c-stance">· ${card.stance}</span>`}</div>
      ${chainStep(card)}
    `;
    attachDrag(el, card);
    handEl.appendChild(el);
  });

  // Arc the hand like a held fan: slight rotation + parabolic lift around the
  // center card, overlapping only when width demands it.  Hover/drag straightens
  // the card.  Cards of a hero who just changed rows morph-flip into their new
  // forms — position visibly rewrites the hand.
  const morphIds = [S._morphHeroId, S._morphHeroId2].filter(Boolean);
  S._morphHeroId = S._morphHeroId2 = null;
  // Lay the fan out SYNCHRONOUSLY, before the browser's first paint, so a
  // fresh hand never flickers through its un-fanned (rotate 0) state on the
  // way in.  Transitions are suppressed for this placement pass so a reshuffle
  // snaps cleanly into shape instead of sliding in from center every render.
  const kids = [...handEl.children];
  if (kids.length) {
    const avail = handEl.clientWidth || handEl.offsetWidth;
    let total = 0;
    kids.forEach(k => { total += k.offsetWidth + 6; });
    // THE FAN MUST FIT THE PHONE. This capped overlap at 86px, so once the line
    // deals six cards on an 880-wide screen the fan ran 12px off the stage —
    // audited, and the cards, their art and their role pills all bled past the
    // edge. The cap now yields to whatever it takes to fit, floored only by
    // keeping a readable sliver (44%) of each card visible.
    const need = total > avail ? (total - avail) / Math.max(1, kids.length - 1) : 0;
    const maxOverlap = Math.max(86, (kids[0].offsetWidth || 150) * 0.56);
    const overlap = Math.min(need, maxOverlap);
    const mid = (kids.length - 1) / 2;
    kids.forEach((k, i) => {
      k.style.transition = 'none';
      if (i > 0 && overlap) k.style.marginLeft = (-overlap) + 'px';
      k.style.zIndex = i + 1;
      const d = i - mid;
      k.style.transformOrigin = '50% 130%';
      k.style.setProperty('--fan-rot', (d * 3.4).toFixed(2) + 'deg');
      k.style.setProperty('--fan-y', (d * d * 2.4).toFixed(1) + 'px');
    });
    // Force one reflow so the fanned transform is committed with transitions
    // off, then restore the CSS transition (for hover/drag) on the next frame.
    void handEl.offsetWidth;
    requestAnimationFrame(() => {
      kids.forEach(k => {
        k.style.transition = '';
        if (morphIds.includes(k.dataset.owner)) k.classList.add('card-morph');
      });
    });
  }
  // The branch is SEEN: the played card flies BACK to its home slot and the
  // forged step(s) split out of it.  Consume the event so it fires once per forge.
  if (S._forgeEvent) { const ev = S._forgeEvent; S._forgeEvent = null; forgeReturnFx(ev); }
}
// a client point → stage-local (unscaled) coords, the space flyCard / popup-layer
// live in, so animation tracks desktop/mobile scaling.
function clientPtLocal(cx, cy) {
  const stage = $('#stage'); if (!stage) return null;
  const sr = stage.getBoundingClientRect();
  const scale = sr.width / stageDW() || 1;
  return { x: (cx - sr.left) / scale, y: (cy - sr.top) / scale };
}
function rectCenterLocal(r) { return r ? clientPtLocal(r.left + r.width / 2, r.top + r.height / 2) : null; }
// A DRAG lifts the card toward the finger, so by play time its element rect is the
// lifted position, NOT its home slot.  The drag closure hands us the card's resting
// centre (home slot, from drag start) so the bounce lands back in the true slot.
let _forgeDrag = null;   // { name, owner, homeX, homeY }
// Snapshot, at play time, the slot the rotation card sat in (its ORIGIN) and the
// figure it HURLED into (the IMPACT) — the card bounces back from the impact to the
// slot.  Read later by forgeReturnFx.
function captureForgeAnchors(card, targetId) {
  S._forgeOrigin = S._forgeStart = S._forgeFace = null;
  // clone the played card's FACE now (it's about to leave the hand) — the returning
  // ghost shows THIS card, then transforms into its forged next step(s).
  const playedEl = (card.uid != null && document.querySelector(`#hand .card[data-uid="${card.uid}"]`))
    || Array.from(document.querySelectorAll('#hand .card')).find(c => c.dataset.cardName === card.name && c.dataset.owner === card.owner);
  S._forgeFace = playedEl ? playedEl.cloneNode(true) : null;
  if (_forgeDrag && _forgeDrag.name === card.name && _forgeDrag.owner === card.owner) {
    S._forgeOrigin = clientPtLocal(_forgeDrag.homeX, _forgeDrag.homeY);   // drag: home slot from drag start
  } else {
    S._forgeOrigin = playedEl ? rectCenterLocal(playedEl.getBoundingClientRect()) : null;   // tap: card is at rest
  }
  _forgeDrag = null;
  // the bounce starts from the struck figure (where the card hurled to)
  let tgtEl = targetId ? figEl(targetId) : null;
  if (!tgtEl && card.target === 'frontmost') { const f = frontmostEnemy(); if (f) tgtEl = figEl(f.uid); }
  if (!tgtEl) tgtEl = figEl(card.owner);
  S._forgeStart = tgtEl ? rectCenterLocal(figHitRect(tgtEl) || tgtEl.getBoundingClientRect()) : S._forgeOrigin;
}
// The played card RETURNS to its home slot and GROWS: a ghost flies (in REVERSE
// of the hurl) from the struck figure back to the origin slot, then the real
// forged card(s) emerge FROM that slot — a single builder, or a SPLIT into two.
// The ghost is driven by INLINE JS transitions (exactly like flyCard), NOT a CSS
// @keyframes animation, so it plays even under `prefers-reduced-motion` and can't
// be suppressed by that media query — the reverse flight is core feedback.
function forgeReturnFx(ev) {
  if (!ev || !ev.uids || !ev.uids.length) return;
  const origin = S._forgeOrigin, start = S._forgeStart || S._forgeOrigin;
  const els = ev.uids.map(uid => document.querySelector(`#hand .card[data-uid="${uid}"]`)).filter(Boolean);
  S._forgeOrigin = S._forgeStart = null;
  if (!els.length || !origin) return;   // graceful fallback: cards keep their plain burn-in
  const HOLD = 220;     // let the HURL reach the target before the bounce begins
  const BOUNCE = 360;   // the reverse-flight time
  const LAND = HOLD + BOUNCE;
  // The DIVIDE point: the midpoint of the forged cards' slots.  The single card
  // returns HERE, then cleanly divides into its next steps that glide apart from it.
  const centers = els.map(el => rectCenterLocal(el.getBoundingClientRect()) || origin);
  const mid = { x: centers.reduce((s, c) => s + c.x, 0) / centers.length,
                y: centers.reduce((s, c) => s + c.y, 0) / centers.length };
  // hide the real cards (synchronously, before paint) until the hand-off
  els.forEach(el => { el.classList.remove('card-forge-in', 'card-forge-split'); el.style.transition = 'none'; el.style.opacity = '0'; });
  // Phase A — a ghost showing the PLAYED card's own face flies back (reverse of the
  // hurl) from the struck figure to the DIVIDE point.  It's literally the opener
  // returning to the hand; on landing it TRANSFORMS into its forged next step(s).
  const w = els[0].offsetWidth, h = els[0].offsetHeight;
  const face = S._forgeFace; S._forgeFace = null;
  const ghost = face || els[0].cloneNode(true);
  ghost.className = (ghost.className || 'card').replace(/card-dragging/g, '');
  ghost.style.cssText = `position:absolute; margin:0; z-index:121; pointer-events:none; opacity:0;`
    + `left:${mid.x - w / 2}px; top:${mid.y - h / 2}px; width:${w}px; height:${h}px; transform-origin:50% 50%;`
    + `filter:brightness(1.22); --tint:${els[0].style.getPropertyValue('--tint')};`
    + `transform:translate(${start.x - mid.x}px, ${start.y - mid.y}px) scale(0.86) rotate(4deg);`;
  $('#popup-layer').appendChild(ghost);
  setTimeout(() => {
    ghost.style.opacity = '1';
    ghost.style.transition = `transform ${BOUNCE}ms cubic-bezier(0.33,0.66,0.3,1), opacity 120ms ease`;
    requestAnimationFrame(() => { ghost.style.transform = 'translate(0px,0px) scale(1.03) rotate(0deg)'; });
  }, HOLD);
  // Phase B — the TRANSFORM.  On landing the opener card hands off to its next step:
  //   • one step  → a card FLIP: the opener turns edge-on and the builder turns in.
  //   • two steps → a DIVIDE: two cards appear stacked (reading as the one card) and
  //                 glide APART to their slots together — one card becoming two.
  setTimeout(() => {
    forgeSplitGlow(mid, els.length > 1);
    if (els.length === 1) {
      const el = els[0];
      ghost.style.transition = 'transform 180ms cubic-bezier(0.5,0,0.9,0.35), opacity 60ms ease 150ms';
      ghost.style.transform = 'perspective(780px) rotateY(90deg) scale(1.03)';   // opener flips edge-on
      ghost.style.opacity = '0';
      el.style.transition = 'none';
      el.style.transformOrigin = '50% 50%';
      el.style.opacity = '0';
      el.style.transform = 'perspective(780px) rotateY(-90deg)';
      void el.offsetWidth;
      setTimeout(() => {                                                          // builder turns in to face-on
        el.style.transition = 'transform 220ms cubic-bezier(0.2,0.7,0.35,1), opacity 120ms ease';
        el.style.opacity = '1';
        el.style.transform = 'perspective(780px) rotateY(0deg)';
        setTimeout(() => { el.style.transition = 'none'; el.style.transform = ''; el.style.transformOrigin = ''; requestAnimationFrame(() => { el.style.transition = ''; }); }, 240);
      }, 150);
    } else {
      ghost.style.transition = 'opacity 110ms ease, transform 160ms ease-out';
      ghost.style.opacity = '0'; ghost.style.transform = 'scale(1.04)';
      els.forEach((el, i) => {
        const c = centers[i];
        el.style.transition = 'none';
        el.style.opacity = '1';
        el.style.transform = `translate(${mid.x - c.x}px, ${mid.y - c.y}px)`;   // stacked at the divide point
        void el.offsetWidth;
        requestAnimationFrame(() => {
          el.style.transition = 'transform 400ms cubic-bezier(0.22,0.62,0.28,1), opacity 220ms ease';
          el.style.transform = '';   // glide out to its own slot — the two part
          setTimeout(() => { el.style.transition = ''; }, 440);
        });
      });
    }
  }, LAND);
  setTimeout(() => ghost.remove(), LAND + 320);
}
// A soft radial bloom at the divide point — a gentle accent on the moment one card
// becomes two.  JS-driven (reduced-motion safe).  `wide` for a two-card split.
function forgeSplitGlow(pt, wide) {
  if (!pt) return;
  const g = document.createElement('div');
  const s = wide ? 150 : 96;
  g.style.cssText = `position:absolute; left:${pt.x}px; top:${pt.y}px; width:${s}px; height:${s}px;`
    + `margin:${-s / 2}px 0 0 ${-s / 2}px; z-index:120; pointer-events:none; border-radius:50%; opacity:0.7;`
    + `transform:scale(0.45); background:radial-gradient(circle, rgba(244,206,128,0.5) 0%, rgba(240,190,96,0.14) 46%, transparent 70%);`;
  $('#popup-layer').appendChild(g);
  requestAnimationFrame(() => {
    g.style.transition = 'transform 320ms cubic-bezier(0.2,0.7,0.3,1), opacity 340ms ease';
    g.style.transform = 'scale(1.5)';
    g.style.opacity = '0';
  });
  setTimeout(() => g.remove(), 380);
}

// ---------------------------------------------------------------------------
// FX helpers
// ---------------------------------------------------------------------------
// Popups that land on the SAME figure within a short window cascade upward and
// stagger in time, so a card that does several things (damage + rally + bond)
// reads as a sequence of legible numbers instead of one illegible stack.
const _popupStacks = new Map();   // figId -> { n, last }
function popupAt(el, text, cls) {
  if (!el) return;
  const layer = $('#popup-layer');
  const stageR = $('#stage').getBoundingClientRect();
  const scale = stageR.width / stageDW();
  const r = figHitRect(el);
  const key = el.dataset.fig || 'x';
  const now = Date.now();
  let st = _popupStacks.get(key);
  if (!st || now - st.last > 850) st = { n: 0, last: now };
  st.n++; st.last = now; _popupStacks.set(key, st);
  const idx = st.n - 1;
  const p = document.createElement('div');
  p.className = 'popup ' + (cls || '');
  p.textContent = text;
  // Stack readably: each rapid follow-up rides HIGHER (a clear gap, not a pile)
  // and ZIGZAGS left/right so consecutive numbers never sit on top of each other.
  const dx = idx === 0 ? 0 : ((idx % 2) ? 1 : -1) * (16 + Math.floor((idx - 1) / 2) * 7);
  p.style.left = ((r.left + r.width / 2 - stageR.left) / scale + dx) + 'px';
  p.style.top = ((r.top - stageR.top) / scale + 4 - idx * 24) + 'px';
  if (idx) { p.style.animationDelay = (idx * 110) + 'ms'; p.style.animationFillMode = 'both'; }
  layer.appendChild(p);
  setTimeout(() => p.remove(), 1050 + idx * 110);
}
function shake(el, dir) {
  if (!el) return;
  const cls = dir === 'r' ? 'fig-hit-r' : dir === 'l' ? 'fig-hit-l' : 'fig-hit';
  el.classList.remove('fig-hit', 'fig-hit-l', 'fig-hit-r'); void el.offsetWidth; el.classList.add(cls);
}
// A short forward lunge on the attacker — heroes drive right toward the enemy
// line, enemies drive left toward the party (direction from the .party class).
function lungeFig(el) {
  if (!el) return;
  if (el.classList.contains('enemy')) {
    el.classList.remove('fig-lunge'); void el.offsetWidth; el.classList.add('fig-lunge');
    setTimeout(() => el.classList.remove('fig-lunge'), 420);
    return;
  }
  // THE DASH (v2.2 Build 3). A hero acting in the line doesn't nudge — they
  // CROSS the field: art dashes toward the enemy half, the blade arrives at
  // ~DASH_CONTACT (dealToEnemy holds the impact light for that frame, and the
  // hitstop freezes the dash at full extension), then the travel settles into
  // the held forward stance instead of walking home. The keyframes carry no
  // 0% frame on purpose: a FRESH strike departs from idle, a combo's next
  // beat departs from the held forward position — same animation, both reads.
  const hid = el.dataset && el.dataset.fig;
  const h = (typeof S !== 'undefined' && S && S.heroes) ? S.heroes.find(x => x.id === hid) : null;
  if (h && h._castAnim) return;   // a caster casts IN PLACE — the sheet is the action
  if (h && h._held && !h.downed) {
    el.classList.remove('fig-strike'); void el.offsetWidth; el.classList.add('fig-strike');
    setTimeout(() => el.classList.remove('fig-strike'), 600);
    return;
  }
  el.classList.remove('fig-lunge-hero'); void el.offsetWidth; el.classList.add('fig-lunge-hero');
  setTimeout(() => el.classList.remove('fig-lunge-hero'), 420);
}
// ── CAST SHEETS (v2.2 Build 7) — real skill animation, per card ─────────────
// Eight-frame sheets (4×2): idle → charge → build → swirl → aim → release →
// linger → wind-down. A mapped card hides the hero's static portrait and
// walks the frames, then HOLDS the last one — the wind-down stance with its
// residual magic — exactly like the dash holds its end frame, until the line's
// finisher (or END TURN) releases everyone. A caster casts IN PLACE: the fx
// already project across the field, so the dash translate is suppressed while
// a sheet is playing. `u` is where the BODY's centreline sits within a cell
// (the fx canvas extends toward the enemies), so the sprite lands on the same
// ground the portrait stood on.
const HERO_CASTS = {
  hask: {
    'Ice Spike':   { src: 'art/hask/ice-spike.webp',   cols: 4, rows: 2, cw: 300, ch: 300, u: 0.30 },
    'Frost Touch': { src: 'art/hask/frost-touch.webp', cols: 4, rows: 2, cw: 266, ch: 300, u: 0.33 },
    'Rime Blast':  { src: 'art/hask/rime-blast.webp',  cols: 4, rows: 2, cw: 200, ch: 300, u: 0.42 },
    'Ember Veil':  { src: 'art/hask/ember-veil.webp',  cols: 4, rows: 2, cw: 200, ch: 300, u: 0.42 },
  },
};
const CAST_FRAME_MS = 85;          // 8 frames ≈ 600ms of cast; release lands mid-walk
const CAST_CONTACT_MS = 5 * 85;    // the blow's LIGHT waits for the release frame
function castAnimFor(heroId, cardName) {
  const t = HERO_CASTS[heroId]; return (t && t[cardName]) || null;
}
// warm the party's sheets at fight start so the first cast never flickers
function warmCastArt(heroIds) {
  try { (heroIds || []).forEach(id => Object.values(HERO_CASTS[id] || {}).forEach(a => { const i = new Image(); i.src = a.src; })); } catch (_) {}
}
function beginCastAnim(h, card) {
  const a = castAnimFor(h.id, card && card.name); if (!a) return false;
  const fig = figEl(h.id); const art = fig && fig.querySelector('.fig-art'); if (!art) return false;
  endCastAnim(h);
  const svg = art.querySelector('svg'); if (svg) svg.style.visibility = 'hidden';
  const el = document.createElement('div');
  el.className = 'cast-anim';
  el.style.aspectRatio = String(a.cw / a.ch);
  el.style.backgroundImage = `url(${a.src})`;
  el.style.backgroundSize = `${a.cols * 100}% ${a.rows * 100}%`;
  el.style.transform = `translateX(-${(a.u * 100).toFixed(1)}%)`;
  art.appendChild(el);
  h._castAnim = el;
  fig.classList.add('fig-casting');
  // walk the cells; STOP on the last (the held end frame). setInterval is
  // time-scaled by the harness, so the rigs see the same rhythm a player does.
  let f = 0;
  const total = a.cols * a.rows;
  const step = () => {
    el.style.backgroundPosition = `${(f % a.cols) / (a.cols - 1) * 100}% ${Math.floor(f / a.cols) / (a.rows - 1) * 100}%`;
  };
  step();
  el._t = setInterval(() => { if (f < total - 1) { f++; step(); } else clearInterval(el._t); }, CAST_FRAME_MS);
  return true;
}
function endCastAnim(h) {
  if (h._castAnim) { try { clearInterval(h._castAnim._t); h._castAnim.remove(); } catch (_) {} h._castAnim = null; }
  const fig = figEl(h.id);
  if (fig) {
    fig.classList.remove('fig-casting');
    const svg = fig.querySelector('.fig-art svg'); if (svg) svg.style.visibility = '';
  }
}
// END TURN breaks the pose (v2.2 Build 2) — every hero who has been holding a
// strike springs back to idle in one beat, so the hand-over to the enemy phase
// reads as the party resetting its feet. The return is a keyframe rather than
// a transition because the next renderAll rebuilds className and would eat a
// transition mid-flight; the keyframe survives long enough to land.
function releaseHeldPoses() {
  ((S && S.heroes) || []).forEach(h => {
    if (!h._held && !h._castAnim) return;
    h._held = false;
    endCastAnim(h);
    const el = figEl(h.id);
    if (el) {
      el.classList.remove('fig-held');
      el.classList.add('fig-return');
      setTimeout(() => el.classList.remove('fig-return'), 400);
    }
  });
}

// ATTACK-TYPE IMPACT VFX — each school reads differently when it lands, so the
// player feels WHAT kind of blow struck: a blade slashes, light bursts, song
// rings out, iron shocks, frost shatters.  Enemy blows use a red claw-strike.
const IMPACT_SVG = {
  blade: `<span class="im-slash s1"></span><span class="im-slash s2"></span><span class="im-spark"></span>`,
  light: `<span class="im-flare"></span><span class="im-rays"></span><span class="im-ring gold"></span>`,
  song:  `<span class="im-ring song r1"></span><span class="im-ring song r2"></span><span class="im-ring song r3"></span>`,
  iron:  `<span class="im-shock"></span><span class="im-ring iron"></span><span class="im-spark iron"></span>`,
  frost: `<span class="im-shatter"><i></i><i></i><i></i><i></i><i></i><i></i></span><span class="im-ring frost"></span>`,
  foe:   `<span class="im-claw c1"></span><span class="im-claw c2"></span><span class="im-claw c3"></span>`,
  phys:  `<span class="im-burst"></span><span class="im-ring phys"></span>`,
};
function impactFx(el, school, big) {
  if (!el) return;
  const layer = $('#popup-layer');
  const stageR = $('#stage').getBoundingClientRect();
  const scale = stageR.width / stageDW();
  const r = figHitRect(el);
  const fx = document.createElement('div');
  fx.className = 'impact impact-' + (school || 'phys') + (big ? ' impact-big' : '');
  fx.style.left = ((r.left + r.width / 2 - stageR.left) / scale) + 'px';
  fx.style.top = ((r.top + r.height * 0.42 - stageR.top) / scale) + 'px';
  fx.innerHTML = IMPACT_SVG[school] || IMPACT_SVG.phys;
  layer.appendChild(fx);
  setTimeout(() => fx.remove(), 660);
}
// A distinct electric detonation burst for a TECHNICAL hit on a primed foe.
function techBurst(el) {
  if (!el) return;
  const layer = $('#popup-layer');
  const stageR = $('#stage').getBoundingClientRect();
  const scale = stageR.width / stageDW();
  const r = figHitRect(el);
  const fx = document.createElement('div');
  fx.className = 'impact impact-tech';
  fx.style.left = ((r.left + r.width / 2 - stageR.left) / scale) + 'px';
  fx.style.top = ((r.top + r.height * 0.42 - stageR.top) / scale) + 'px';
  fx.innerHTML = `<span class="tb-ring"></span><span class="tb-bolt b1"></span><span class="tb-bolt b2"></span><span class="tb-bolt b3"></span><span class="tb-bolt b4"></span>`;
  layer.appendChild(fx);
  setTimeout(() => fx.remove(), 620);
}
let _narrTimer = null;
function flashNarrator(text) {
  // Narrator lines are authored WITH markup (<b>…</b>, keyword spans) and are all
  // internal strings (hero/card names, numbers — no user input), so render as HTML.
  $('#narrator').innerHTML = text || '';
  clearTimeout(_narrTimer);
  if (text) _narrTimer = setTimeout(() => { $('#narrator').innerHTML = ''; }, 4200);
}

// ---------------------------------------------------------------------------
// OVERLAY / TITLE / GATE
// ---------------------------------------------------------------------------
function showOverlay(html, extraClass) {
  const ov = $('#overlay');
  ov.className = extraClass || '';
  ov.classList.remove('hidden');
  $('#overlay-inner').innerHTML = html;
}
function hideOverlay() {
  $('#overlay').classList.add('hidden');
  $('#overlay').onclick = null;
}

// ---------------------------------------------------------------------------
// MENU — a standard mobile-RPG pause menu, reachable from the ☰ button.
// ---------------------------------------------------------------------------
function toggleSetting(key) {
  SETTINGS[key] = !SETTINGS[key]; saveSettings();
  if (key === 'fightBg') applyFightBg();
  if (key === 'sound' && SETTINGS.sound) { try { SFX.card(); } catch (_) {} }
  if (key === 'music') { try { MUSIC.refresh(); } catch (_) {} }
}
function resumeFromMenu() {
  hideOverlay();
  if (S) renderAll();
  else if (RUN && !RUN.done) showMap();
  else showTitle();
}
function showMenu() {
  const inRun = !!(RUN && !RUN.done);
  const onOff = (v) => `<span class="menu-val ${v ? 'mv-on' : 'mv-off'}">${v ? 'ON' : 'OFF'}</span>`;
  showOverlay(`
    <div class="ov-eyebrow">PAUSED</div>
    <div class="ov-title" style="font-size:22px; margin-bottom:14px;">MENU</div>
    <div class="menu-list">
      <button class="menu-item menu-primary" id="m-resume">▸ RESUME</button>
      <button class="menu-item" id="m-sound"><span>SOUND</span>${onOff(SETTINGS.sound)}</button>
      <button class="menu-item" id="m-music"><span>MUSIC</span>${onOff(SETTINGS.music)}</button>
      <button class="menu-item" id="m-haptics"><span>HAPTICS</span>${onOff(SETTINGS.haptics)}</button>
      <button class="menu-item" id="m-journal"><span>JOURNAL</span><span class="menu-val">✦</span></button>
      <button class="menu-item" id="m-codex"><span>WHAT WE KNOW</span><span class="menu-val">◇ ${fragsHeld()}/${ABYSS_FRAGMENTS.length}</span></button>
      <button class="menu-item" id="m-howto"><span>HOW TO PLAY</span><span class="menu-val">?</span></button>
      ${inRun ? `<button class="menu-item menu-warn" id="m-abandon"><span>ABANDON RUN</span><span class="menu-val">✕</span></button>` : ''}
      <button class="menu-item" id="m-title"><span>RETURN TO TITLE</span><span class="menu-val">⌂</span></button>
      <button class="menu-item menu-dev" id="m-dev"><span>⚙ DEV TOOLS</span><span class="menu-val">›</span></button>
    </div>
  `, 'menu-screen');
  $('#m-resume').onclick = resumeFromMenu;
  $('#m-sound').onclick = () => { toggleSetting('sound'); showMenu(); };
  $('#m-music').onclick = () => { toggleSetting('music'); showMenu(); };
  $('#m-haptics').onclick = () => { toggleSetting('haptics'); showMenu(); };
  $('#m-journal').onclick = () => showBoonJournal(showMenu);
  $('#m-codex').onclick = () => showCodex(showMenu);
  $('#m-howto').onclick = () => showHowTo();
  $('#m-title').onclick = () => { RUN = null; S = null; try { localStorage.removeItem(RUN_KEY); } catch (_) {} showTitle(); };
  const ab = $('#m-abandon');
  if (ab) ab.onclick = () => { RUN = null; S = null; try { localStorage.removeItem(RUN_KEY); } catch (_) {} showTitle(); };
  $('#m-dev').onclick = () => showDevPanel();
}
// DEV — jump straight to the FINAL BOSS with a fresh full trio (whole kit
// kindled + bonds pre-formed), so the multi-stage Chorus can be re-tested fast.
function devChallengeFinalBoss() {
  RUN = newRun('ash');
  RUN.roster = ['ash', 'elin', 'mira']; RUN.active = ['ash', 'elin', 'mira'];
  RUN.hp = {}; RUN.roster.forEach(id => { RUN.hp[id] = HEROES[id].maxHp; });
  RUN.nodes = EMBER_TREE.filter(n => n.type === 'card').map(n => n.id);   // full signature kit
  RUN.bonds = { 'ash|elin': BOND_KINDLED, 'ash|mira': BOND_KINDLED, 'elin|mira': BOND_KINDLED };  // kindled → duets + triad live
  RUN.floor = 4; RUN.completed = [0];     // past the Last Fire
  RUN.map = generateDescent(RUN.roster, 4);
  saveRun();
  const bossNode = RUN.map.find(n => n.isBoss);
  if (bossNode) startMapFight(bossNode); else showMap();
}
// PREVIEW the FULL branching-rotation build AS INTENDED: the whole party on
// rotations, every stance's tree-gated branch UNLOCKED (so each opener forges a
// real "see both and pick" fork), against a normal pack so you feel the
// opener → branch → finisher loop across every hero.  The live game is untouched
// — this is the only place S._rotations is on.
function devPreviewRotations() {
  RUN = newRun('ash');
  RUN.roster = ['ash', 'elin', 'mira']; RUN.active = ['ash', 'elin', 'mira'];
  RUN.hp = {}; RUN.roster.forEach(id => { RUN.hp[id] = HEROES[id].maxHp; });
  // full card kit + every hero's riders (so name-keyed riders bite) + ALL branch
  // gates (the fully-grown rotation — the intended endgame shape)
  RUN.nodes = EMBER_TREE.filter(n => ['card', 'rider', 'execute', 'afterimage', 'emergent'].includes(n.type)).map(n => n.id).concat(ROTATION_GATES);
  RUN.bonds = { 'ash|elin': BOND_KINDLED, 'ash|mira': BOND_KINDLED, 'elin|mira': BOND_KINDLED };
  RUN.floor = 2; RUN.completed = [0];
  RUN._rotations = true;   // the whole point — this run runs the new engine
  RUN.map = generateDescent(RUN.roster, 2);
  saveRun();
  const fight = RUN.map.find(n => n.type === 'fight' && !n.isBoss) || RUN.map.find(n => n.type === 'fight');
  if (fight) startMapFight(fight); else showMap();
}
function showHowTo(back) {
  showOverlay(`
    <div class="ov-eyebrow">HOW TO PLAY</div>
    <div class="ov-title" style="font-size:20px; margin-bottom:10px;">THE BASICS</div>
    <div class="ov-lines howto" style="text-align:left; max-width:620px; margin:0 auto; max-height:72vh; overflow-y:auto; padding-right:8px;">
      <div class="ht-head">On your turn</div>
      <div class="ov-line"><b>Play cards to fight.</b> Drag a card onto an enemy to attack, or onto an ally to help. Each card costs <b>EP</b> — your energy, which refills every turn.</div>
      <div class="ov-line"><b>Reposition your heroes.</b> Drag a hero between the <b>FRONT · MID · BACK</b> rows. Where they stand sets their stance, so their cards change to match.</div>
      <div class="ht-head">When a foe attacks</div>
      <div class="ov-line"><b>Dodge or parry.</b> Each enemy shows the <b>row</b> it will hit. Drag that hero to a safe row to <b>DODGE</b> — or stand and <b>PARRY</b>: tap each note the instant its ring flashes gold. Good timing turns the blow aside.</div>
      <div class="ht-head">Break their POISE</div>
      <div class="ov-line"><b>Chip the pips, steal the turn.</b> Every foe carries <b>◈ POISE</b> pips. Each hit of its weak element chips one — at zero it <b>BREAKS</b>: every blow lands <b>×1.5</b> until it recovers, and its next action is <b>LOST</b>. Sturdier foes carry more pips.</div>
      <div class="ht-head">Build your BURST</div>
      <div class="ov-line"><b>Fill the gauge, then unleash.</b> Landing hits and clean parries fill your <b>BURST</b> — and <b>unspent EP banks into it</b> at the end of your turn. When it glows ready, <b>tap the gauge</b> to unleash an <b>ALL-OUT</b> — the whole party piles onto the enemy line at once.</div>
      <div class="ht-head">Bonds — the KIZUNA loop</div>
      <div class="ov-line"><b>Finish a combo, stand PRIMED.</b> When a hero plays the last card of their line, they hold their stance — ready to follow up. <i>Which</i> stance depends on <i>which</i> line you ran: <b>⚔ EDGE</b>, <b>◎ MARK</b> or <b>⛨ WARD</b>.</div>
      <div class="ov-line"><b>Another hero's combo cues them in.</b> The moment a second hero finishes theirs, the <b>primed</b> hero's <b>FOLLOW-UP</b> opens in your hand — free. Their stance decides what they do; the hero they answer adds a bonus on top.</div>
      <div class="ov-line"><b>Playing it lights the bond — ♡ LIT</b> — for the rest of this fight, and that pair's <b>◈ move</b> runs while both stand. Helping an ally directly lights one too.</div>
      <div class="ov-line">A bond that gets lit again <b>deepens</b>. At <b>♡ 2/2</b> it is <b>✦ WOVEN</b>: from then on they walk into every fight already connected, and a <b>FINISHER</b> from one <b>weaves in</b> a free strike from the other.</div>
      <div class="ov-line">Weave all three and they <b>empower your ALL-OUT</b> — ending it in a <b>TRIAD FINALE</b>. Tap the <b>♡ KIZUNA</b> badge in a fight to see every pair's whole ladder at once.</div>
      <div class="ht-head">Between fights</div>
      <div class="ov-line"><b>Grow stronger.</b> Winning earns <b>✦ embers</b> — spend them on your <b>Ember Tree</b> to unlock new cards. Take companion <b>gifts</b>, and <b>rest</b> at campfires to heal.</div>
      <div class="ht-head">The fire asks a question</div>
      <div class="ov-line">At a campfire, <b>SHARE THE FIRE</b> gives the night to the pair who did the most for each other, and their scene ends on a choice you only get one of:</div>
      <div class="ov-line"><b>◈ Ask what they are together</b> — their own move opens on the lattice, permanently, for this descent and every one after.</div>
      <div class="ov-line"><b>◇ Ask what they remember</b> — nobody down here remembers falling in. Two accounts compared is the only way to recover any of it. Every third piece you assemble makes <b>every bond you form hold one step deeper, forever</b>. Read what you have under <b>WHAT WE KNOW</b>.</div>
      <div class="ov-line ht-tip">Tip: press &amp; hold any card to read it up close.</div>
    </div>
    <button class="ov-btn primary" id="ht-back">◂ BACK</button>
  `, 'menu-screen howto-screen');
  $('#ht-back').onclick = () => (back || showMenu)();
}
// FULL PROGRESS RESET (dev) — wipe everything that makes the game "not
// first-time": unlocked heroes, tutorial flow, one-time coaches, the abyss
// memories and vow ranks, the current run, and Heat.  Device prefs (sound,
// fight background) and the entry gate are left alone.
// WHAT WE KNOW — the fragments you've assembled, in the order they were meant to
// be read, with the gaps left visible.  A found piece keeps its full text so the
// story can be re-read end to end; an unfound one shows only its shape, because
// the reason to go back down is knowing exactly what is missing.
function showCodex(back) {
  const held = loadFrags(), carry = bondCarry();
  const nextAt = (carry < CARRY_MAX) ? (carry + 1) * CARRY_PER - held.length : 0;
  const rows = ABYSS_FRAGMENTS.map((f, i) => {
    const got = held.indexOf(f.id) >= 0;
    return `<div class="cx-frag${got ? '' : ' cx-locked'}">
      <div class="cx-ftitle">◇ ${String(i + 1).padStart(2, '0')} · ${got ? f.title : '—— ——'}</div>
      <div class="cx-ftext">${got ? f.text : 'Nobody at your fire has said this out loud yet. <b>Ask a pair what they remember.</b>'}</div>
    </div>`;
  }).join('');
  showOverlay(`
    <div class="ov-eyebrow">THE ABYSS REMEMBERS</div>
    <div class="ov-title" style="font-size:24px">WHAT WE KNOW</div>
    <div class="cx-carry">${held.length} of ${ABYSS_FRAGMENTS.length} pieced together.${carry > 0 ? ` Every bond you form starts <b>${carry} step${carry > 1 ? 's' : ''} deeper</b>.` : ''}${nextAt > 0 ? ` <i>${nextAt} more to hold harder.</i>` : ''}</div>
    <div class="cx-list">${rows}</div>
    <button class="ov-btn primary" id="cx-back" style="margin-top:16px">BACK</button>
  `, 'story-screen codex-screen');
  $('#cx-back').onclick = () => { hideOverlay(); (back || showMap)(); };
}
function resetProgress() {
  [STARTERS_KEY, LAST_STARTER_KEY, PROGRESS_KEY, RUN_KEY, ABYSS_KEY, VOWS_KEY, META_KEY, ARCS_KEY,
   FRAGS_KEY, GIFTS_KEY, TUTORIAL_KEY, 'kizuna2_2.treeTaught']
    .forEach(k => { try { localStorage.removeItem(k); } catch (_) {} });
  narrWipe();   // first-time flow includes the prologue now (v2.2)
  // …and every per-lesson counter, by prefix. Naming them individually meant
  // naming two keys that never existed while missing the dozen that do.
  try {
    Object.keys(localStorage)
      .filter(k => k.indexOf('kizuna2_2.lesson_') === 0 || k.indexOf('kizuna2_2.parryLesson_') === 0)
      .forEach(k => localStorage.removeItem(k));
  } catch (_) {}
  RUN = null; S = null; flowIdx = 0; META.heat = 0;
}
let _devResetArmed = false;
function showDevPanel(back) {
  const onOff = (v) => `<span class="menu-val ${v ? 'mv-on' : 'mv-off'}">${v ? 'ON' : 'OFF'}</span>`;
  const armed = _devResetArmed;
  showOverlay(`
    <div class="ov-eyebrow">DEV</div>
    <div class="ov-title" style="font-size:20px; margin-bottom:12px;">DEV TOOLS</div>
    <div class="menu-list">
      <button class="menu-item menu-primary" id="d-rotations"><span>🔥 PREVIEW ROTATIONS (FULL)</span><span class="menu-val">›</span></button>
      <button class="menu-item menu-primary" id="d-megaboss"><span>⚔ CHALLENGE FINAL BOSS</span><span class="menu-val">›</span></button>
      <button class="menu-item" id="d-narrative"><span>📖 NARRATIVE INSPECTOR</span><span class="menu-val">›</span></button>
      <button class="menu-item" id="d-unlockall"><span>🔓 UNLOCK ALL CHARACTERS</span><span class="menu-val">${getUnlockedStarters().length}/${STARTER_POOL.length}</span></button>
      <button class="menu-item" id="d-bg"><span>FIGHT BACKGROUND</span>${onOff(SETTINGS.fightBg)}</button>
      <button class="menu-item${armed ? ' mi-danger' : ''}" id="d-reset">
        <span>${armed ? '⚠ TAP AGAIN TO WIPE' : 'RESET PROGRESS'}</span>
        <span class="menu-val mv-off">${armed ? 'CONFIRM' : 'unlocks · tutorial · abyss'}</span>
      </button>
      <button class="menu-item" id="d-back">◂ BACK</button>
    </div>
    <div class="ov-hint">Reset wipes unlocks &amp; tutorial to test first-time flow. Device settings are kept.</div>
  `, 'menu-screen');
  $('#d-rotations').onclick = () => { _devResetArmed = false; hideOverlay(); devPreviewRotations(); };
  $('#d-megaboss').onclick = () => { _devResetArmed = false; hideOverlay(); devChallengeFinalBoss(); };
  $('#d-narrative').onclick = () => { _devResetArmed = false; showNarrativeInspector(() => showDevPanel(back)); };
  $('#d-unlockall').onclick = () => { _devResetArmed = false;
    STARTER_POOL.forEach(unlockStarter);
    flashNarrator('🔓 All ' + STARTER_POOL.length + ' characters unlocked — pick anyone at the Landing.');
    showDevPanel(back); };
  $('#d-bg').onclick = () => { toggleSetting('fightBg'); showDevPanel(); };
  $('#d-reset').onclick = () => {
    if (!_devResetArmed) { _devResetArmed = true; showDevPanel(); return; }   // two-tap confirm
    _devResetArmed = false;
    resetProgress();
    flashNarrator('Progress wiped — the reach forgets you.');
    showTitle();
  };
  $('#d-back').onclick = () => { _devResetArmed = false; (back || showMenu)(); };
}

function showTitle() {
  S = null;
  clearAim();   // never carry aim/drag state to the title (or into the next new game)
  MUSIC.play('audio/worldmap-theme.mp3?v=1', 0.44, true);   // the ambient bed opens on the title and carries seamlessly into the descent (same track — no restart)
  $('#stage').classList.remove('show-bg');
  $('#timeline').innerHTML = '';
  $('#chapter-chip').textContent = 'KIZUNA';
  const savedRun = loadRun();
  // CONTINUE appears ONLY when there's a LIVE run to resume.  After a GAME OVER the
  // run is gone, so the party's death is final — NEW GAME only.  (Meta progress —
  // unlocked heroes, the boon codex, the Abyss's memory of the fallen — lives in
  // its OWN storage and carries over regardless.)
  const canContinue = !!(savedRun && !savedRun.done);
  // A full-screen JRPG title: a key-art figure fills the frame, the logo sits
  // top-center, and a horizontal menu bar runs across the bottom.  The key art
  // is whoever you LAST descended as (falls back to Ash).
  let artHero = 'ash';
  try { const l = localStorage.getItem(LAST_STARTER_KEY); if (l && HEROES[l] && V2PORTRAITS[l]) artHero = l; } catch (_) {}
  showOverlay(`
    <div class="tt-rays"></div>
    <div class="tt-keyart tt-art-${artHero}"><span class="tt-keyart-glow"></span><span class="tt-keyart-fig">${V2PORTRAITS[artHero] || ''}</span></div>
    <div class="tt-vign"></div>
    <div class="tt-scrim"></div>
    ${Array.from({ length: 14 }).map((_, i) => `<span class="tt-ember" style="--i:${i}"></span>`).join('')}
    <div class="tt-top">
      <div class="tt-title">KIZUNA</div>
      <div class="tt-rule"></div>
      <div class="tt-sub">RESONANCE</div>
    </div>
    <div class="tt-menu-bar">
      <button class="tt-opt tt-opt-primary" id="t-new">NEW GAME</button>
      ${canContinue ? `<button class="tt-opt" id="t-continue">CONTINUE</button>` : ''}
      <button class="tt-opt" id="t-journal">JOURNAL</button>
      <button class="tt-opt" id="t-settings">SETTINGS</button>
    </div>
    <div class="tt-ver">V2.2 · BUILD ${V2_BUILD}</div>
  `, 'title-cine');
  // Build 282: NEW GAME wakes you at THE LANDING, the same as dying does.
  // It used to drop a veteran straight onto a character grid — the one entry
  // into the game that skipped the place every other run begins and ends at,
  // which made the hub read as a death screen rather than the bottom of the
  // stair. A first-EVER player still gets the tutorial.
  // v2.2: a fresh soul gets the PROLOGUE first (narrative.js) — the previous
  // cycle's last memory, the awakening, "Rise.", the title — and only then the
  // game. narrFire is a no-op once the prologue is spent, so this stays one line.
  $('#t-new').onclick = () => narrFire('NEW_GAME', {}, () => { if (!tutorialSeen()) beginTutorial(); else showLanding({ cold: true }); });
  const c = $('#t-continue');
  if (c) c.onclick = () => {
    const r = loadRun();
    if (r && !r.done) { RUN = r; showMap(); }
    else showStarterSelect(id => showRelicSelect(id));
  };
  $('#t-journal').onclick = () => showBoonJournal(showTitle);
  $('#t-settings').onclick = () => showSettings();
}
// SETTINGS (from the title) — device prefs, difficulty (Heat), and dev tools.
function showSettings() {
  const onOff = (v) => `<span class="menu-val ${v ? 'mv-on' : 'mv-off'}">${v ? 'ON' : 'OFF'}</span>`;
  showOverlay(`
    <div class="ov-eyebrow">TITLE</div>
    <div class="ov-title" style="font-size:22px; margin-bottom:14px;">SETTINGS</div>
    <div class="menu-list">
      <button class="menu-item" id="s-sound"><span>SOUND</span>${onOff(SETTINGS.sound)}</button>
      <button class="menu-item" id="s-music"><span>MUSIC</span>${onOff(SETTINGS.music)}</button>
      <button class="menu-item" id="s-haptics"><span>HAPTICS</span>${onOff(SETTINGS.haptics)}</button>
      <button class="menu-item" id="s-bg"><span>FIGHT BACKGROUND</span>${onOff(SETTINGS.fightBg)}</button>
      <button class="menu-item" id="s-depth"><span>DEPTH</span><span class="menu-val">${
        SETTINGS.depth === 'auto' ? 'AUTO · ' + _fxTier.toUpperCase() : SETTINGS.depth.toUpperCase()}</span></button>
      <button class="menu-item" id="s-heat"><span>HEAT</span><span class="menu-heat"><button id="s-heat-dn" aria-label="lower heat">−</button><b>${META.heat || 0}</b><button id="s-heat-up" aria-label="raise heat">+</button></span></button>
      <button class="menu-item" id="s-howto"><span>HOW TO PLAY</span><span class="menu-val">?</span></button>
      <button class="menu-item menu-dev" id="s-dev"><span>⚙ DEV TOOLS</span><span class="menu-val">›</span></button>
      <button class="menu-item menu-primary" id="s-back">◂ BACK</button>
    </div>
  `, 'menu-screen');
  // AUTO → FULL → SOFT → FLAT.  Auto measures the device and steps itself down;
  // the explicit tiers let a player who knows their phone skip the measuring.
  $('#s-depth').onclick = () => {
    const order = ['auto', 'full', 'soft', 'flat'];
    SETTINGS.depth = order[(order.indexOf(SETTINGS.depth) + 1) % order.length];
    saveSettings(); applyFxTier(); showSettings();
  };
  $('#s-sound').onclick = () => { toggleSetting('sound'); showSettings(); };
  $('#s-music').onclick = () => { toggleSetting('music'); showSettings(); };
  $('#s-haptics').onclick = () => { toggleSetting('haptics'); showSettings(); };
  $('#s-bg').onclick = () => { toggleSetting('fightBg'); showSettings(); };
  const setHeat = (d) => { META.heat = Math.max(0, Math.min(5, (META.heat || 0) + d)); saveMeta(); showSettings(); };
  $('#s-heat-dn').onclick = (e) => { e.stopPropagation(); setHeat(-1); };
  $('#s-heat-up').onclick = (e) => { e.stopPropagation(); setHeat(1); };
  $('#s-howto').onclick = () => showHowTo(showSettings);
  $('#s-dev').onclick = () => showDevPanel(showSettings);
  $('#s-back').onclick = () => showTitle();
}

// THE EMBER TREE — a branching constellation.  Each hero's nodes hang from a
// root along lit paths; a node's PREREQUISITE feeds it down a thread.  Pick a
// node to read it in the detail bar, then kindle it.
// FOUR KINDS, NOT ELEVEN (Build 286).
//
// The tree has 156 nodes under ELEVEN type labels — but `passive` (60),
// `branch` (19), `card` (18) and `bond` (15) are 112 of them. The other seven
// names split 44 nodes between them: `chain` is four nodes and Ash-only,
// `synergy` is six and tier-4-only, `afterimage` is six. Seven separate words
// for near-singletons is most of why the tree reads as overwhelming — it is not
// that there is a lot to learn, it is that there appear to be eleven CATEGORIES
// of thing to learn, and nine of them turn out to mean roughly "a passive".
//
// Nothing is removed and no node changes what it does. They simply stop being
// separately NAMED, so the player is reading four kinds instead of eleven:
//
//   COMBO    a card enters a stance's rotation
//   FORK     a rotation splits, and taking one path burns the other
//   PASSIVE  a standing rule — most of the tree, and now honestly labelled
//   BOND     a pair's own ability, on the border between them
const TREE_KIND = {
  card: 'COMBO', branch: 'FORK', bond: 'BOND',
  rider: 'PASSIVE', passive: 'PASSIVE', allout: 'PASSIVE', emergent: 'PASSIVE',
  synergy: 'PASSIVE', execute: 'PASSIVE', afterimage: 'PASSIVE', chain: 'PASSIVE',
};
const TREE_TYPE_LABEL = TREE_KIND;
const TREE_TYPE_GLYPH = { card: '❖', rider: '⊕', passive: '❉', allout: '✷', emergent: '✦', synergy: '☍', branch: '⑂', execute: '☠', afterimage: '⧉', chain: '⛓' };
// Node descriptions follow a "TRIGGER: effect — flavor" grammar so they read at a
// glance: the TRIGGER (when it fires) becomes a chip, the effect stays crisp with
// symbols, and the trailing flavor dims out.  Split flavor on the FIRST ' — '
// (effects use ·, →, commas — never a spaced em-dash).
function nodeDescHTML(desc) {
  if (!desc) return '';
  let main = desc, flav = '';
  const fi = main.indexOf(' — ');
  if (fi >= 0) { flav = main.slice(fi + 3); main = main.slice(0, fi); }
  let trig = '';
  const m = main.match(/^([A-Z][A-Z0-9 ’·×\/&+\-]{1,22}):\s+/);
  if (m) { trig = m[1].trim(); main = main.slice(m[0].length); }
  return (trig ? `<span class="et-trig">${trig}</span> ` : '') + main
    + (flav ? `<span class="et-flav"> — ${flav}</span>` : '');
}
const TREE_HEROES = EMBER_TREE.reduce((a, n) => (a.includes(n.hero) ? a : a.concat(n.hero)), []);
// (Build 248) The per-hero TREE_PAN/TREE_ZOOM maps are gone: there is one world
// now, so there is one camera over it — see TREE_VIEW.
const TREE_ZMIN = 0.42, TREE_ZMAX = 3.4;   // ZMIN has to reach the fit-everything zoom (see treeFitZoom)
// Drag-to-pan AND pinch/button-ZOOM the constellation, so the tier-3/4 arms that
// reach past the canvas are always tap-able and you can pull back for the whole
// map or lean in on one branch.  Suppresses the orb SELECT click on a real drag.
function attachTreePan(heroId, opts) {
  const canvas = document.getElementById('et-canvas');
  const pan = document.getElementById('et-pan');
  if (!canvas || !pan) return;
  const world = opts && opts.world;
  // ONE camera over ONE world (Build 248).  The pan limit follows the world's
  // real size instead of a fixed 165px: with six regions on the board a hard
  // cap meant the far lobes simply could not be reached.
  // The travel limit has to scale with the zoom, or focusing a far region gets
  // pinned before it arrives — this clamped a focus target to -450 on both axes.
  const clamp = (v) => { const c = 130 + 330 * z; return Math.max(-c, Math.min(c, v)); };
  let ox = TREE_VIEW.x, oy = TREE_VIEW.y, z = TREE_VIEW.z || treeFitZoom();
  const apply = () => {
    pan.style.transform = `translate(${ox}px, ${oy}px) scale(${z})`;
    // Labels live INSIDE the zoomed layer, so a 62px name rendered 132px wide at
    // zoom 2.1 while node centres were only 74px apart — the words were twice the
    // width of the gap they had to fit in.  Counter-scale the text so it holds a
    // constant size on screen no matter how close the camera is (and never grow
    // it past 1:1 when zoomed out, or the whole-tree view fills up with words).
    pan.style.setProperty('--lbl', String(Math.min(1, 1 / Math.max(0.01, z))));
  };
  const store = () => { TREE_VIEW.x = ox; TREE_VIEW.y = oy; TREE_VIEW.z = z; TREE_VIEW._seeded = true; };
  apply();
  // FLY TO THE REGION — apply the OLD transform first, then set the target on
  // the next frame so the CSS transition actually has two states to move
  // between (the element is rebuilt on every render, so it starts with no
  // history of its own).
  if (opts && opts.focus && world && world.hubs[heroId]) {
    const fz = treeFocusZoom(world);
    const target = treeFocusOffset(world.hubs[heroId], world.W, fz);
    requestAnimationFrame(() => {
      pan.classList.add('et-flying');
      z = fz;                                 // zoom FIRST — clamp scales with it
      ox = clamp(target.x); oy = clamp(target.y); store(); apply();
      setTimeout(() => pan.classList.remove('et-flying'), 640);
    });
  }
  const setZoom = (nz) => { z = Math.max(TREE_ZMIN, Math.min(TREE_ZMAX, nz)); ox = clamp(ox); oy = clamp(oy); store(); apply(); };
  // ---- PINCH (two pointers) + PAN (one) --------------------------------------
  const pts = new Map();
  let sx = 0, sy = 0, drag = false, pid = null, pinchStart = 0, zStart = 1;
  canvas.addEventListener('pointerdown', (e) => {
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinchStart = Math.hypot(a.x - b.x, a.y - b.y) || 1; zStart = z; drag = false; }
    else { pid = e.pointerId; sx = e.clientX; sy = e.clientY; drag = true; canvas._dragMoved = false; canvas.classList.add('et-grabbing'); }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (pts.has(e.pointerId)) pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size >= 2) {                              // PINCH — scale from the current gap
      const [a, b] = [...pts.values()]; const gap = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      canvas._dragMoved = true; setZoom(zStart * (gap / pinchStart)); return;
    }
    if (!drag || e.pointerId !== pid) return;
    const s = stageScale();                          // the tree pans INSIDE the scaled stage — divide so it tracks the pointer 1:1
    const dx = (e.clientX - sx) / s, dy = (e.clientY - sy) / s;
    if (Math.abs(dx) + Math.abs(dy) > 6) canvas._dragMoved = true;
    pan.style.transform = `translate(${clamp(ox + dx)}px, ${clamp(oy + dy)}px) scale(${z})`;
  });
  const end = (e) => {
    pts.delete(e.pointerId);
    if (pts.size < 2) pinchStart = 0;
    if (!drag) { canvas.classList.remove('et-grabbing'); return; }
    drag = false; canvas.classList.remove('et-grabbing');
    const s = stageScale();
    ox = clamp(ox + (e.clientX - sx) / s); oy = clamp(oy + (e.clientY - sy) / s);
    store(); apply();
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  // ---- BUTTONS ---------------------------------------------------------------
  const zin = document.getElementById('et-zoom-in'), zout = document.getElementById('et-zoom-out');
  if (zin) zin.onclick = (ev) => { ev.stopPropagation(); setZoom(z + 0.25); };
  if (zout) zout.onclick = (ev) => { ev.stopPropagation(); setZoom(z - 0.25); };
}
// node state for the current META: owned / ready(buyable) / poor(can't afford)
// / needs(prereq) / sealed(tier).
function nodeState(n) {
  if (hasNode(n.id)) return 'owned';
  if (!tierOpen(n.tier)) return 'sealed';
  if (!(n.requires || []).every(r => hasNode(r))) return 'needs';
  return runEmbers() >= n.cost ? 'ready' : 'poor';
}
// You can only build the heroes you're FIELDING — the tree shows your party.
function partyHeroes() { return (RUN && RUN.active && RUN.active.length) ? RUN.active.filter(id => TREE_HEROES.indexOf(id) >= 0) : []; }
// Is at least one node in the party's trees kindle-able RIGHT NOW (affordable,
// prereqs met, tier open)?  Gates the map's "kindle a skill" coach.
function canKindleNow() {
  return partyHeroes().some(hid => EMBER_TREE.some(n => n.hero === hid && nodeState(n) === 'ready'));
}
// ═════════════════════════════════════════════════════════════════════════════
// THE WORLD (Build 248) — ONE tree, not six.
//
// Every fielded hero used to get their own canvas and switching tabs swapped the
// whole thing out, so a crossing had to be re-drawn as a phantom orb on the rim
// of whoever was looking — the same skill existed twice on screen and the
// screen stopped meaning anything.  Now all of the party's regions live in ONE
// coordinate space: each hero is a lobe on a shared ring (a party of three makes
// a triangle, which is the shape this game is about), a crossing is an EDGE
// between two regions rather than a copy of a node, and the tabs move the CAMERA
// instead of the map.  Zoom 1 is the whole tree; a tab focuses its region.
// RADIAL ROOM (Build 249).  Measured: an orb's box is ~61-72px tall while a ring
// step rendered only ~43px, so adjacent rings were guaranteed to collide no
// matter how well the angles were spread — the crowding was never angular, it
// was radial.  On-screen ring spacing works out to RING·viewport·0.94/(2·regionR),
// which rises with RING and tops out around 82px, so widening the rings really
// does buy separation (62 -> 130 takes it from ~43px to ~55px).  The region grows
// with it, but the focus zoom is derived from the region, so a focused hero
// still fills the screen; only the zoomed-out world gets denser, and that view
// is for orientation rather than reading.
const TREE_R0 = 74, TREE_RING = 130, TREE_PAD = 58;
// The on-screen gap a tab flies in to.  It has to CLEAR an orb's box (measured
// 64px tall with a two-line label), not merely equal it — at 66 the adjacent
// rings had 2px between them and any label that wrapped ate straight through.
// BREATHING ROOM (Build 314). 82px of ring step against ~62px orbs plus label
// chips left ~20px of air between depth rings — everything touched. The focus
// zoom pins a ring step to THIS many on-screen px, so raising it spreads the
// whole constellation at the zoom people actually read it at.
const TREE_RING_PX = 108;
// How much of a region's RADIUS one orb's footprint eats.  This is the unit
// conversion the layout was missing: node positions are world units, but an orb
// is a fixed ~58 CSS px, and the two are related through the focus zoom.  That
// zoom works out to viewport·0.94/(2·regionR), which cancels the world size
// entirely and leaves footprint/regionR = 2·58/(0.94·viewport) — so a spacing
// rule written in raw pixels (the old "66") was wrong by nearly 2x and no amount
// of angular relaxation could fix it.
// At the legibility zoom a ring step is pinned to TREE_RING_PX on screen, which
// fixes the world-units-per-pixel rate at TREE_RING/TREE_RING_PX — so the space
// one orb occupies is a plain constant, with no dependence on the world size,
// the region size or the viewport.  That is what the earlier attempts kept
// getting wrong: a spacing rule in raw px, then one as a fraction of a region
// that was itself still being solved.
// 74px is the LABEL's width plus a little air, not the glyph's — the glyph is
// only 28px, but two names printing over each other is just as unreadable as
// two orbs doing it.
function treeOrbSpan() { return 74 * TREE_RING / TREE_RING_PX; }
// Grow a hub's inner ring until every ring can seat its own nodes.  regionR
// depends on r0 and r0 depends on regionR, so settle it by iteration — it
// converges in two or three passes.
// Grow the hub ring until EVERY ring can seat its own nodes side by side.  No
// iteration needed now that a node's footprint is a constant.
function solveHubRadius(byDepth) {
  const S = treeOrbSpan();
  let r0 = TREE_R0;
  Object.keys(byDepth).forEach(d => {
    const c = byDepth[d].length; if (c < 2) return;
    r0 = Math.max(r0, (c * S) / (2 * Math.PI) - Number(d) * TREE_RING);
  });
  return r0 + 12;   // a little air so a label can hang under the innermost ring
}
function buildTreeWorld(party) {
  const per = {};
  party.forEach(hid => {
    const nodes = EMBER_TREE.filter(n => n.hero === hid);
    const depth = {};
    const depthOf = (n) => {
      if (depth[n.id] != null) return depth[n.id];
      const reqs = (n.requires || []).map(r => NODE_BY_ID[r]).filter(Boolean);
      return depth[n.id] = reqs.length ? 1 + Math.max.apply(null, reqs.map(depthOf)) : 0;
    };
    nodes.forEach(depthOf);
    const byDepth = {}; nodes.forEach(n => { (byDepth[depth[n.id]] = byDepth[depth[n.id]] || []).push(n); });
    const angle = {};
    // ── THREE BRANCHES, ONE PER STANCE (Build 312) ─────────────────────────────
    // The anchor rule (311) made every chain root at a tier-1 anchor, but the
    // layout still let relaxation shove a FRONT-line node into the BACK line's
    // arc — logically three branches, visually a cloud. Each anchor now OWNS an
    // angular SECTOR of the region and its entire chain stays inside it, so a
    // hero's tree reads as three big pathways (front / mid / back) with the odd
    // pieces — Executioner, Afterimage — visibly hanging off the branch they
    // grow from. Pick a pathway, not a node.
    const rootOf = (n) => {
      let cur = n, hops = 0;
      while (cur && (cur.requires || []).length && hops++ < 12) cur = NODE_BY_ID[cur.requires[0]] || cur;
      return cur ? cur.id : n.id;
    };
    const roots = (byDepth[0] || []);
    const sector = {};   // root id -> { c: centre angle, w: half-width }
    // inner ring: spokes spread evenly, an even count offset a half-step so the
    // arms sit DIAGONAL and no two labels stack on a flat horizontal spoke
    roots.forEach((n, i, a) => { const off = a.length % 2 === 0 ? 0.5 : 0; angle[n.id] = -90 + (i + off) * (360 / a.length); });
    roots.forEach(n => { sector[n.id] = { c: angle[n.id], w: Math.max(24, 360 / Math.max(1, roots.length) / 2 - 6) }; });
    const sectorOf = {}; nodes.forEach(n => { sectorOf[n.id] = sector[rootOf(n)] || null; });
    const clampSector = (id, a) => {
      const sc = sectorOf[id]; if (!sc) return a;
      let d2 = a - sc.c; while (d2 > 180) d2 -= 360; while (d2 < -180) d2 += 360;
      return sc.c + Math.max(-sc.w, Math.min(sc.w, d2));
    };
    Object.keys(byDepth).map(Number).filter(d => d > 0).sort((a, b) => a - b).forEach(d => {
      const groups = {};
      byDepth[d].forEach(n => { const k = (n.requires || [])[0] || 'root'; (groups[k] = groups[k] || []).push(n); });
      Object.keys(groups).forEach(k => {
        const base = angle[k] != null ? angle[k] : 0, arr = groups[k];
        arr.forEach((n, i) => { angle[n.id] = base + (arr.length > 1 ? (i - (arr.length - 1) / 2) * 34 : 0); });
      });
    });
    // SEPARATE THE RING (Build 248).  Siblings were fanned around their own
    // parent and nothing checked the result globally, so the children of two
    // parents whose arms happened to converge landed on top of each other —
    // that is the "Killer's E‸Shadow Fork" overprint, and it long predates the
    // shared world.  Walk each ring in angle order and push neighbours apart to
    // the arc the orbs actually need, then recentre so the arm keeps pointing
    // where its prerequisite does.
    const maxD0 = nodes.length ? Math.max.apply(null, nodes.map(n => depth[n.id])) : 0;
    const r0pre = solveHubRadius(byDepth);
    for (let d = 0; d <= maxD0; d++) {
      const ring = (byDepth[d] || []).slice().sort((x, y) => angle[x.id] - angle[y.id]);
      if (ring.length < 2) continue;
      const r = r0pre + d * TREE_RING;
      const S = treeOrbSpan();                                                // world units, not px
      const need = 2 * Math.asin(Math.min(1, S / (2 * r))) * 180 / Math.PI;    // arc one orb needs
      if (need * ring.length >= 360) {                                          // too many to fan — space them evenly
        ring.forEach((n, i) => { angle[n.id] = -90 + i * (360 / ring.length); });
        continue;
      }
      const before = ring.reduce((a2, n) => a2 + angle[n.id], 0) / ring.length;
      for (let i = 1; i < ring.length; i++) {
        const gap = angle[ring[i].id] - angle[ring[i - 1].id];
        if (gap < need) angle[ring[i].id] = angle[ring[i - 1].id] + need;
      }
      // The seam between the last node and the first (across 360°) also has to
      // clear.  An earlier attempt nudged each node by a DIFFERENT amount to
      // close it, which quietly re-compressed the gaps the forward pass had just
      // opened; if the ring has genuinely run out of circle, spread it evenly
      // instead — that is the only arrangement that can still fit.
      if ((angle[ring[0].id] + 360) - angle[ring[ring.length - 1].id] < need) {
        ring.forEach((n2, i) => { angle[n2.id] = -90 + i * (360 / ring.length); });
        continue;
      }
      const after = ring.reduce((a2, n2) => a2 + angle[n2.id], 0) / ring.length;
      ring.forEach(n2 => { angle[n2.id] += before - after; });                   // keep the arm aimed where it was
      ring.forEach(n2 => { angle[n2.id] = clampSector(n2.id, angle[n2.id]); }); // …but never out of its branch
    }
    // GLOBAL PASS.  Spreading each ring on its own still lets a node graze one on
    // a NEIGHBOURING ring — the per-ring sweep simply cannot see that pair.  Walk
    // every pair that is still closer than an orb's footprint and rotate them
    // apart (radius is fixed by prerequisite depth, so angle is the only thing
    // free to give). A handful of passes settles it.
    {
      const S = treeOrbSpan(), rOf = (n) => r0pre + depth[n.id] * TREE_RING;
      for (let it = 0; it < 30; it++) {
        let moved = false;
        for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
          const A = nodes[i], B = nodes[j], ra = rOf(A), rb = rOf(B);
          const aa = angle[A.id] * Math.PI / 180, ab = angle[B.id] * Math.PI / 180;
          const dx = ra * Math.cos(aa) - rb * Math.cos(ab), dy = ra * Math.sin(aa) - rb * Math.sin(ab);
          const dist = Math.hypot(dx, dy);
          if (dist >= S) continue;
          // how far each has to turn to open the gap, scaled by its own radius
          const push = (S - dist) / 2;
          const da = (push / Math.max(1, ra)) * 180 / Math.PI;
          const db = (push / Math.max(1, rb)) * 180 / Math.PI;
          let diff = angle[A.id] - angle[B.id];
          while (diff > 180) diff -= 360;
          while (diff < -180) diff += 360;
          const sign = diff === 0 ? (i % 2 ? 1 : -1) : (diff > 0 ? 1 : -1);
          angle[A.id] = clampSector(A.id, angle[A.id] + sign * da);
          angle[B.id] = clampSector(B.id, angle[B.id] - sign * db);
          moved = true;
        }
        if (!moved) break;
      }
    }
    // STRAIGHT ARMS (Build 314). Within a pathway, each depth's members sit
    // EVENLY about the rail rather than wherever relaxation shoved them — a lone
    // child sits ON the rail, so single chains line up dead straight, and the
    // sector clamp can no longer pile two siblings onto the same wedge edge
    // (the chain.deep/chain.rising overlap the LATTICE check caught: relaxation
    // pushed them apart, the clamp snapped both onto the boundary).
    {
      const S2 = treeOrbSpan();
      const groups = {};
      nodes.forEach(n => { const k = rootOf(n) + '|' + depth[n.id]; (groups[k] = groups[k] || []).push(n); });
      Object.keys(groups).forEach(k => {
        const arr = groups[k].slice().sort((a, b) => angle[a.id] - angle[b.id]);
        const rid = k.split('|')[0], d = +k.split('|')[1];
        const sc = sector[rid]; if (!sc || d === 0) return;
        const r = r0pre + d * TREE_RING;
        const needDeg = 2 * Math.asin(Math.min(1, S2 / (2 * r))) * 180 / Math.PI + 2;
        // spilling past the wedge slightly beats overlapping inside it
        const step = arr.length > 1 ? Math.max(needDeg, Math.min(36, (2 * sc.w - 6) / (arr.length - 1))) : 0;
        arr.forEach((n2, i) => { angle[n2.id] = sc.c + (i - (arr.length - 1) / 2) * step; });
      });
    }
    const maxD = maxD0;
    // THE INNER RING MUST HOLD ITS SPOKES.  A fixed 66px hub ring is only 415px
    // around, and a hero with eight depth-0 spokes was trying to seat eight
    // 62px-wide orbs in 52px each — which is why the dense kits printed
    // "Killer's E‸Shadow Fork" over themselves. Grow the ring to fit instead.
    per[hid] = { nodes, depth, angle, maxD, r0: r0pre, radius: r0pre + maxD * TREE_RING };
  });
  // Hubs sit on a ring wide enough that no two regions collide: the chord
  // between neighbouring hubs is 2·R·sin(π/N), and it must clear two region
  // radii.  A lone hero simply owns the middle.
  const N = party.length || 1;
  const regionR = Math.max.apply(null, party.map(h => per[h].radius).concat([TREE_R0])) + TREE_PAD;
  const HUB_R = N < 2 ? 0 : regionR / Math.sin(Math.PI / N);
  const hubs = {}, pos = {};
  party.forEach((hid, i) => {
    const a = (-90 + i * (360 / N)) * Math.PI / 180;
    const hx = HUB_R * Math.cos(a), hy = HUB_R * Math.sin(a);
    hubs[hid] = { x: hx, y: hy };
    per[hid].nodes.forEach(n => {
      const na = (per[hid].angle[n.id] || 0) * Math.PI / 180, r = per[hid].r0 + per[hid].depth[n.id] * TREE_RING;
      pos[n.id] = { x: hx + r * Math.cos(na), y: hy + r * Math.sin(na) };
    });
  });
  // COMMON GROUND sits ON the border, strung between the two hubs it joins, so
  // the space between regions stops being empty and a crossing visibly passes
  // THROUGH something instead of leaping the gap.
  for (let i = 0; i < party.length; i++) for (let j = i + 1; j < party.length; j++) {
    const A = hubs[party[i]], B = hubs[party[j]];
    const ns = commonOnBorder(party[i], party[j]);
    ns.forEach((cn, k) => {
      const t = (k + 1) / (ns.length + 1);                  // evenly spaced along the span
      pos[cn.id] = { x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t };
    });
  }
  // BORDER STONES ARE OBSTACLES (Build 311). The per-hero relaxation above can
  // only see a hero's own nodes, so a ring node could land exactly on a common
  // stone strung between two hubs — re-anchoring the tree (the anchor rule)
  // shifted ring populations and the LATTICE check caught two such collisions
  // in a row. Chasing them by hand-picking prerequisites is angle roulette;
  // instead the stones now push intruders off deterministically. The stone
  // stays put (it marks a real place on a border); the NODE gives way along
  // its own ring, where angle is the only free dimension.
  {
    const span = treeOrbSpan();
    const stones = Object.keys(pos).filter(k => k.indexOf('common.') === 0 || k.indexOf('bond.') === 0);
    party.forEach(hid => {
      const P = per[hid], hub = hubs[hid];
      for (let it = 0; it < 20; it++) {
        let moved = false;
        P.nodes.forEach(n => {
          const q = pos[n.id];
          stones.forEach(k => {
            const st = pos[k], d = Math.hypot(q.x - st.x, q.y - st.y);
            if (d >= span) return;
            const r = P.r0 + P.depth[n.id] * TREE_RING;
            const na = Math.atan2(q.y - hub.y, q.x - hub.x);
            const push = ((span - d) / Math.max(1, r)) * 1.15;
            const sa = Math.atan2(st.y - hub.y, st.x - hub.x);
            let diff = na - sa; while (diff > Math.PI) diff -= 2 * Math.PI; while (diff < -Math.PI) diff += 2 * Math.PI;
            const nn = na + (diff >= 0 ? push : -push);
            q.x = hub.x + r * Math.cos(nn); q.y = hub.y + r * Math.sin(nn);
            P.angle[n.id] = nn * 180 / Math.PI;
            moved = true;
          });
        });
        // …and giving way must not create a NEW collision: re-relax node pairs
        // on the same final coordinates in the same loop, or the stone push just
        // hands the overlap to a neighbour (it did — exploit/chain.rising).
        for (let i = 0; i < P.nodes.length; i++) for (let j = i + 1; j < P.nodes.length; j++) {
          const A = P.nodes[i], B = P.nodes[j];
          const qa = pos[A.id], qb = pos[B.id];
          const d = Math.hypot(qa.x - qb.x, qa.y - qb.y);
          if (d >= span) continue;
          const turn = (id) => {
            const q = pos[id], r = P.r0 + P.depth[id] * TREE_RING;
            return { q, r, a: Math.atan2(q.y - hub.y, q.x - hub.x) };
          };
          const ta = turn(A.id), tb = turn(B.id);
          let diff = ta.a - tb.a; while (diff > Math.PI) diff -= 2 * Math.PI; while (diff < -Math.PI) diff += 2 * Math.PI;
          const sign = diff === 0 ? 1 : (diff > 0 ? 1 : -1);
          const push = ((span - d) / 2 + 0.5);
          [[ta, sign, A.id], [tb, -sign, B.id]].forEach(([t2, sg, id]) => {
            const nn = t2.a + sg * (push / Math.max(1, t2.r));
            t2.q.x = hub.x + t2.r * Math.cos(nn); t2.q.y = hub.y + t2.r * Math.sin(nn);
            P.angle[id] = nn * 180 / Math.PI;
          });
          moved = true;
        }
        if (!moved) break;
      }
    });
  }
  // Fit the WHOLE world to one square box (square keeps the ring guides circular
  // under preserveAspectRatio="none") and re-origin every point into it.
  const pts = Object.keys(pos).map(k => pos[k]).concat(party.map(h => hubs[h]));
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const minX = Math.min.apply(null, xs) - TREE_PAD, maxX = Math.max.apply(null, xs) + TREE_PAD;
  const minY = Math.min.apply(null, ys) - TREE_PAD, maxY = Math.max.apply(null, ys) + TREE_PAD;
  const span = Math.max(maxX - minX, maxY - minY);
  const ox = minX - (span - (maxX - minX)) / 2, oy = minY - (span - (maxY - minY)) / 2;
  Object.keys(pos).forEach(k => { pos[k].x -= ox; pos[k].y -= oy; });
  party.forEach(h => { hubs[h].x -= ox; hubs[h].y -= oy; });
  return { per, pos, hubs, W: span, regionR };
}
// The view is ONE camera over the shared world, not a per-hero scroll position —
// that is what lets a tab switch PAN instead of cutting.
const TREE_VIEW = { x: 0, y: 0, z: 1 };
// How close a tab pulls in is DERIVED, not picked: a focused region should just
// fill the viewport.  A hand-set 2.15 buried the region off every edge and ran
// its labels into each other — with only three lobes on the board the whole
// world is barely 1.7x one region, so the honest magnification is small.
// Where the camera must sit for a WORLD point to land in the middle of the
// canvas.  Orbs are positioned as a percentage of .et-pan's fixed 560px side,
// so a world coordinate has to be converted into that box FIRST — passing world
// units straight in put the focus hundreds of pixels off.  With
// transform-origin at the box centre the rest reduces to -(p - centre)·z,
// independent of how big the canvas happens to be.
const TREE_BOX = 560;
// The zoom at which the entire world is on screen.  .et-pan is a fixed 560px
// square but the canvas is landscape and shorter than that, so "scale 1" showed
// the world with its bottom two regions hanging off the edge.
function treeViewportPx() {
  const c = document.getElementById('et-canvas');
  if (!c) return TREE_BOX;
  const r = c.getBoundingClientRect(), s = stageScale() || 1;
  return Math.min(r.width, r.height) / s;
}
function treeFitZoom() {
  return Math.max(TREE_ZMIN, Math.min(TREE_ZMAX, treeViewportPx() / TREE_BOX * 0.98));
}
// FOCUS FOR LEGIBILITY, NOT FOR FIT (Build 249).
// Making a whole region fit the canvas was the wrong target: a 21-node kit in a
// 348px-tall viewport cannot be both complete and readable — measured, its ring
// step lands at ~45px against a ~47px orb, so the rings overlap by construction
// and no layout tuning closes that gap.  So the tab flies in to a zoom where a
// ring step CLEARS an orb, and the player pans within the region — which is what
// a sphere grid does anyway.  The ◎ button is the "see everything" view.
function treeFocusZoom(world) {
  if (!world || !world.W) return treeFitZoom();
  const ringPerZ = (TREE_RING / world.W) * TREE_BOX;    // px of ring step at zoom 1
  const legible = TREE_RING_PX / Math.max(1, ringPerZ);
  // never pull in so far that a SMALL region rattles around: cap at the zoom
  // that would fill the viewport with this world's biggest region.
  const fillRegion = treeViewportPx() / ((2 * world.regionR / world.W) * TREE_BOX) * 0.94;
  return Math.max(TREE_ZMIN, Math.min(TREE_ZMAX, Math.max(legible, fillRegion)));
}
function treeFocusOffset(p, W, z) {
  const C = TREE_BOX / 2;
  return { x: -((p.x / W) * TREE_BOX - C) * z, y: -((p.y / W) * TREE_BOX - C) * z };
}

function showEmberTree(onBack, heroId, selId, opts) {
  $('#stage').classList.remove('show-bg');
  // a "__kindled:" prefix on selId means we just bought that node — celebrate it
  let justKindled = false;
  if (selId && String(selId).indexOf('__kindled:') === 0) { justKindled = true; selId = selId.slice(10); }
  const party = partyHeroes();
  // only your fielded party has constellations here; clamp to a party member
  if (party.length && party.indexOf(heroId) < 0) heroId = party[0];
  heroId = heroId && HEROES[heroId] ? heroId : (party[0] || 'ash');
  // ---- THE WORLD: every fielded region in one space (Build 248) ---------------
  const world = buildTreeWorld(party);
  const { pos, hubs } = world;
  const W = world.W, H = world.W;
  const nodes = world.per[heroId] ? world.per[heroId].nodes : [];
  const depth = world.per[heroId] ? world.per[heroId].depth : {};
  const maxD = world.per[heroId] ? world.per[heroId].maxD : 0;
  const allNodes = party.reduce((a, h) => a.concat(world.per[h].nodes), []);
  const root = hubs[heroId] || { x: W / 2, y: H / 2 };
  // A crossing is now an EDGE from your hub to the teacher's ACTUAL node, so the
  // skill exists exactly once on screen.  Keyed by node id for the orb badges.
  const crossings = crossViewFor(heroId);
  const crossBy = {}; crossings.forEach(c => { crossBy[c.node.id] = c; });
  // ---- LINKS: straight spokes — prereq → node, or hub → a depth-0 node ---------
  const links = [];
  allNodes.forEach(n => {
    // A SEALED TIER IS NOT DRAWN (see the orb filter below) — so its links must
    // not be either. Dashed spokes running to empty space were most of what made
    // the early tree read as noise: ink for nodes that do not exist yet.
    if (!(tierOpen(n.tier) || hasNode(n.id))) return;
    const hub = hubs[n.hero];
    const reqs = (n.requires || []).filter(r => pos[r]);
    const far = n.hero !== heroId;
    if (reqs.length) reqs.forEach(r => links.push({ h: hub, a: pos[r], b: pos[n.id], on: hasNode(r), full: hasNode(r) && hasNode(n.id), far }));
    else links.push({ h: hub, a: hub, b: pos[n.id], on: tierOpen(n.tier), full: hasNode(n.id), far });
  });
  // A LINK FOLLOWS THE CONSTELLATION (Build 310). Straight prereq chords cut
  // across the ring guides at arbitrary angles, which is what made the lattice
  // read as sharp and random — the lines fought the radial geometry everything
  // else obeys. Each link now bends through the polar midpoint of its region:
  // a radial spoke stays effectively straight (its polar midpoint IS on the
  // chord), while a link that hops between angles arcs gently along the rings.
  // One rule, no per-link tuning, and the ring guides become what the lines
  // agree with instead of what they slice through.
  const curveIn = (H, A, B) => {
    const rA = Math.hypot(A.x - H.x, A.y - H.y), rB = Math.hypot(B.x - H.x, B.y - H.y);
    if (rA < 6 || rB < 6) return `M ${A.x} ${A.y} L ${B.x} ${B.y}`;   // hub spokes stay straight
    const aA = Math.atan2(A.y - H.y, A.x - H.x); let d = Math.atan2(B.y - H.y, B.x - H.x) - aA;
    while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    const am = aA + d / 2, rm = (rA + rB) / 2;
    const cx = 2 * (H.x + Math.cos(am) * rm) - (A.x + B.x) / 2;
    const cy = 2 * (H.y + Math.sin(am) * rm) - (A.y + B.y) / 2;
    return `M ${A.x} ${A.y} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${B.x} ${B.y}`;
  };
  const linkSvg = links.map(l => {
    const cls = l.full ? 'et-link-full' : l.on ? 'et-link-on' : 'et-link-off';
    return `<path class="et-link ${cls}${l.far ? ' et-far' : ''}" vector-effect="non-scaling-stroke" d="${curveIn(l.h, l.a, l.b)}" />`;
  }).join('');
  // ── PATHWAY CAPTIONS (Build 313) — the three branches, named by PLAYSTYLE ──
  // Each tier-1 anchor's wedge is captioned with the flavour word its line
  // already carries in the rotation data ('OPENER · AGGRESSION' → AGGRESSION),
  // plus the POSITION it is played from — so the tree answers "what does this
  // branch DO" before a single node is read, and the flavour words finally have
  // one consistent job: naming a playstyle, never a place.
  let pathSvg = '';
  {
    const P = world.per[heroId];
    if (P) {
      const hub = hubs[heroId];
      (P.nodes || []).filter(n => n.tier === 1).forEach(n => {
        const m = /^(\w+)\.sig\.(\w+)$/.exec(n.id); if (!m) return;
        const row = m[2], rot = ROTATIONS[heroId] && ROTATIONS[heroId][row];
        const op = rot && rot.cards[rot.opener]; if (!op) return;
        const style = (String(op.stance || '').split('\u00b7')[1] || '').trim();
        if (!style) return;
        const a = (P.angle[n.id] || 0) * Math.PI / 180;
        // just past the SECOND ring, not the region's outermost — deep chains
        // pushed maxD past the focus zoom and the captions rendered off-view
        const r = P.r0 + 2.45 * TREE_RING;
        const x = hub.x + r * Math.cos(a), y = hub.y + r * Math.sin(a);
        // FONT IN WORLD UNITS. This SVG's viewBox is the world (W wide, ~3x the
        // 560px pan layer), so CSS pixel sizes shrink by 560/W and an 11px
        // caption rendered at ~3px — present, invisible. Scale with the world.
        // Sized for the FOCUS zoom (~2.5x), where a pathway is actually read —
        // 11px-equivalent here rendered as ~29px shouting across the canvas.
        const fs = (5 * W / TREE_BOX).toFixed(1), fs2 = (3.6 * W / TREE_BOX).toFixed(1);
        pathSvg += `<text class="et-path-cap" style="font-size:${fs}px" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle">${style}</text>`
                 + `<text class="et-path-sub" style="font-size:${fs2}px" x="${x.toFixed(1)}" y="${(y + 1.3 * fs).toFixed(1)}" text-anchor="middle">from ${row.toUpperCase()}</text>`;
      });
    }
  }
  // BRANCH RAILS, NOT ORBIT RINGS (Build 314). The concentric depth circles made
  // the region read as a spiral — nodes seemed to orbit rather than to GROW, and
  // with the three-pathway layout in (312/313) the circles cut across all three
  // wedges as if they connected them. Each branch now gets one faint straight
  // rail from the hub out through its anchor's angle: the eye follows a rail out
  // a pathway, which is the read the whole tree is built around.
  let ringSvg = '';
  party.forEach(hid => {
    const hub = hubs[hid], P = world.per[hid];
    // A rail runs only as deep as the deepest node actually DRAWN on ITS OWN
    // branch — sealed tiers are hidden, so a rail pointing past the last
    // visible orb was a guide to nothing, and one branch's depth must not
    // stretch its siblings' rails. Each grows as the descent unseals tiers.
    (P.nodes || []).filter(n => n.tier === 1).forEach(n => {
      const aDeg = P.angle[n.id] || 0;
      const secD = (P.nodes || []).reduce((m, n2) => {
        if (!(tierOpen(n2.tier) || hasNode(n2.id))) return m;
        const d = ((P.angle[n2.id] || 0) - aDeg + 540) % 360 - 180;
        return Math.abs(d) <= 61 ? Math.max(m, P.depth[n2.id] || 0) : m;
      }, 0);
      const a = aDeg * Math.PI / 180;
      const rIn = P.r0 * 0.45, rOut = P.r0 + (secD + 0.35) * TREE_RING;
      ringSvg += `<line class="et-rail${hid === heroId ? ' et-rail-here' : ''}"
        x1="${(hub.x + rIn * Math.cos(a)).toFixed(1)}" y1="${(hub.y + rIn * Math.sin(a)).toFixed(1)}"
        x2="${(hub.x + rOut * Math.cos(a)).toFixed(1)}" y2="${(hub.y + rOut * Math.sin(a)).toFixed(1)}"
        vector-effect="non-scaling-stroke" />`;
    });
  });
  // A doorway hangs off a BOND, not a prerequisite, so it is drawn as a thread
  // rather than a spoke — dashed while the bond is short of CROSS_BOND, drawn
  // solid once the door is open, in the teaching hero's own colour.
  // MANY BRIDGES, NOT ONE (Build 250).  Every thread used to leave the same
  // point — your hub — so the border between two regions read as a single
  // crossing no matter how many skills spanned it.  Each one now springs from
  // the node of YOURS that sits nearest its target, preferring one you have
  // actually kindled, so the bridges land at different places along the border
  // and they MIGRATE as you build: grow toward a companion and your crossings
  // set off from there instead of from the middle of your own tree.
  // Nearest node wins outright.  Preferring an OWNED anchor sounded better and
  // measured worse: early on a hero owns two or three nodes clustered by their
  // hub, so every bridge collapsed back onto the same one and the border read as
  // a single crossing again — exactly the thing this is meant to fix.  Ownership
  // is carried in the STYLE instead: a bridge that sets off from a node you have
  // kindled is drawn established, one from bare ground stays faint.
  const anchorFor = (target) => {
    let best = null, bestD = Infinity, bestOwned = false;
    nodes.forEach(n => {
      const p = pos[n.id]; if (!p) return;
      const d = Math.hypot(p.x - target.x, p.y - target.y);
      if (d < bestD) { best = p; bestD = d; bestOwned = hasNode(n.id); }
    });
    return best ? { p: best, owned: bestOwned } : { p: root, owned: true };
  };
  const threadSvg = crossings.map(c => {
    const p = pos[c.node.id]; if (!p) return '';
    const a = anchorFor(p);
    const open = c.state === 'open' || c.state === 'poor' || c.state === 'crossed';
    // A crossing to a hero's own technique routes THROUGH the common ground you
    // hold on that border — the bridgehead is a place on the map, not a rule in
    // a tooltip, so the path bends to touch it.
    let via = '';
    if (!c.common) {
      const held = commonOnBorder(heroId, c.teacher).find(cn => hasCrossed(heroId, cn.id));
      if (held && pos[held.id]) via = ` L ${pos[held.id].x} ${pos[held.id].y}`;
    }
    // a thread HANGS — a soft bow, not a spear. A via-path (through a border
    // stone) keeps its stations and bows each leg would be over-engineering;
    // those stay straight and read as routed on purpose.
    let d;
    if (via) d = `M ${a.p.x} ${a.p.y}${via} L ${p.x} ${p.y}`;
    else {
      const mx = (a.p.x + p.x) / 2 - (p.y - a.p.y) * 0.12, my = (a.p.y + p.y) / 2 + (p.x - a.p.x) * 0.12;
      d = `M ${a.p.x} ${a.p.y} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${p.x} ${p.y}`;
    }
    return `<path class="et-thread${open ? ' et-thread-on' : ''}${c.state === 'crossed' ? ' et-thread-full' : ''}${a.owned ? ' et-thread-rooted' : ''}"
      vector-effect="non-scaling-stroke" fill="none" stroke="${HEROES[heroId].tint}"
      d="${d}" />`;
  }).join('');
  const crossRing = '';
  // the border stones — nobody's colour, so they read as neutral ground
  const commonOrbs = party.map((h2, i) => party.slice(i + 1).map(h3 => commonOnBorder(h2, h3).map(cn => {
    const p = pos[cn.id]; if (!p) return '';
    const mine = (h2 === heroId || h3 === heroId);
    const c = mine ? crossings.find(x => x.node.id === cn.id) : null;
    const held = hasCrossed(h2, cn.id) || hasCrossed(h3, cn.id);
    const id = mine ? 'x:' + heroId + ':' + cn.id : cn.id;
    const st = !mine ? 'far' : (c ? c.state : 'unbonded');
    const foot = !mine ? '' : st === 'crossed' ? 'HELD'
      : st === 'unbonded' ? '♡ ' + (c ? c.bond : 0) + '/' + CROSS_BOND + ' WOVEN' : '✦' + cn.cost;
    return `<button class="et-orb et-common${cn.bond ? ' et-bond' : ''} et-c-${st}${held ? ' et-c-held' : ''}${id === selId ? ' et-sel' : ''}" data-id="${id}"
       style="left:${(p.x / W) * 100}%; top:${(p.y / H) * 100}%">
       <span class="et-orb-glyph">${st === 'crossed' ? '✓' : cn.glyph}</span>
       <span class="et-orb-name">${cn.label}</span>
       ${foot ? `<span class="et-orb-cost${st === 'poor' ? ' et-cant' : ''}">${foot}</span>` : ''}
     </button>`;
  }).join('')).join('')).join('');
  // ---- ORBS -------------------------------------------------------------------
  // A SEALED TIER IS NOT DRAWN. It was a padlocked orb, so the first tree a new
  // player opened was 156 circles they mostly could not touch — which reads as
  // the size of the thing they have to learn rather than as the size of what
  // they have. What is still coming is one honest line under the tree instead.
  const orbs = allNodes.filter(n => tierOpen(n.tier) || hasNode(n.id)).map(n => {
    const p = pos[n.id], mine = n.hero === heroId, x = crossBy[n.id];
    // A neighbour's node you can reach is selected AS A CROSSING, so the id
    // carries who is learning it; your own nodes keep their plain id.
    const id = (!mine && x) ? 'x:' + heroId + ':' + n.id : n.id;
    const st = nodeState(n);
    const cls = mine ? 'et-' + st : 'et-far' + (x ? ' et-cross et-x-' + x.state : '');
    const glyph = (!mine && x)
      ? (x.state === 'crossed' ? '✓' : x.state === 'open' || x.state === 'poor' ? '⟡' : '🔒')
      : (st === 'owned' ? '✓' : st === 'sealed' ? '🔒' : TREE_TYPE_GLYPH[n.type]);
    let foot = '';
    if (mine && (st === 'ready' || st === 'poor')) foot = `<span class="et-orb-cost${st === 'poor' ? ' et-cant' : ''}">✦${n.cost}</span>`;
    else if (x) foot = `<span class="et-orb-cost${x.state === 'poor' ? ' et-cant' : ''}">${
      x.state === 'crossed' ? 'LEARNED' : x.state === 'untaught' ? 'unlearned'
      : x.state === 'unbonded' ? '♡ ' + x.bond + '/' + CROSS_BOND + ' WOVEN' : '✦' + x.cost}</span>`;
    // Labels radiate AWAY from the hub: a node in the upper half of its region
    // carries its name above the glyph, one in the lower half below.  That
    // doubles the vertical room labels have to share and reads better anyway —
    // the words lean outward instead of all stacking downward into the next ring.
    const na = (world.per[n.hero].angle[n.id] || 0) * Math.PI / 180;
    const up = Math.sin(na) < -0.15;
    return `<button class="et-orb ${cls} t-${n.type}${up ? ' et-lbl-up' : ''}${id === selId ? ' et-sel' : ''}" data-id="${id}"
       style="left:${(p.x / W) * 100}%; top:${(p.y / H) * 100}%${!mine ? `; --tint:${HEROES[n.hero].tint}` : ''}">
       <span class="et-orb-glyph">${glyph}</span>
       <span class="et-orb-name">${n.label}</span>
       ${(!mine && x) ? `<span class="et-x-from">${HEROES[n.hero].name}</span>` : ''}
       ${foot}
     </button>`;
  }).join('');
  // one hub per region, the focused one lit
  const rootOrb = party.map(hid => `<div class="et-orb et-root${hid === heroId ? ' et-root-here' : ''}"
      style="left:${(hubs[hid].x / W) * 100}%; top:${(hubs[hid].y / H) * 100}%; --tint:${HEROES[hid].tint}">
      <span class="et-orb-glyph">◆</span>${hid === heroId ? '' : `<span class="et-orb-name et-root-name">${HEROES[hid].name}</span>`}</div>`).join('');
  // ---- DETAIL BAR (selected node) ---------------------------------------------
  // a doorway selection carries an "x:<learner>:" prefix — it is a different
  // KIND of thing to own, so it gets its own panel rather than being squeezed
  // into the node one.
  const selCross = (selId && String(selId).indexOf('x:') === 0)
    ? crossings.find(c => c.node.id === String(selId).replace(/^x:[a-z]+:/, '')) : null;
  const sel = selCross ? null : (selId ? NODE_BY_ID[selId] : nodes.find(n => nodeState(n) === 'ready') || nodes[0]);
  let detail = '<div class="et-detail-empty">Pick a node to inspect it.</div>';
  if (selCross) {
    const c = selCross, T = HEROES[c.teacher], L = HEROES[heroId];
    const act = c.state === 'crossed' ? `<span class="et-d-owned">⟡ ${c.common ? 'HELD' : 'LEARNED'}</span>`
      : c.state === 'untaught' ? `<span class="et-d-lock">${T.name} has not kindled it yet</span>`
      : c.state === 'unbonded' ? `<span class="et-d-lock">their bond is not <b>WOVEN</b> yet (♡ ${c.bond}/${CROSS_BOND}) — hold the thread through another fight</span>`
      : c.state === 'unbridged' ? `<span class="et-d-lock">you hold no ground on this border — claim a <b>COMMON</b> stone between you and ${T.name} first</span>`
      : `<button class="et-d-buy${c.state === 'poor' ? ' et-d-cant' : ''}" id="et-cross-buy" ${c.state === 'poor' ? 'disabled' : ''}>${c.common ? 'CLAIM' : 'LEARN'} · ✦ ${c.cost}</button>`;
    // Common ground belongs to nobody, so it gets neither a teacher nor a
    // kinship price, and the panel says so rather than dressing it as a gift.
    const head = c.node.bond
      ? `<div class="et-d-head"><span class="et-d-type t-bond">${c.node.glyph} BOND</span><span class="et-d-name">${c.node.label}</span></div>
         <div class="et-d-cross">What <b style="color:${L.tint}">${L.name}</b> and <b style="color:${T.tint}">${T.name}</b> learned at the fire. It holds for the whole descent — no thread to re-earn each fight — and it <b>announces itself</b> the first time it lands.</div>`
      : c.common
      ? `<div class="et-d-head"><span class="et-d-type t-common">COMMON GROUND</span><span class="et-d-name">${c.node.label}</span></div>
         <div class="et-d-cross">Neutral ground on the road between <b style="color:${L.tint}">${L.name}</b> and <b style="color:${T.tint}">${T.name}</b> — it belongs to neither of you, and holding it is what opens the far side of this border.</div>`
      : `<div class="et-d-head"><span class="et-d-type t-cross">${KIN_WORD[c.kin]}</span><span class="et-d-name">${c.node.label}</span></div>
         <div class="et-d-cross">${L.name} learns this from <b style="color:${T.tint}">${T.name}</b>${c.kin ? ` — ${c.kin === 2 ? 'the same school AND the same tempo' : 'a shared ' + (T.school === L.school ? 'school' : 'tempo')}, so it comes cheap` : ' — nothing in common, so it comes dear'}.</div>`;
    detail = `${head}
      <div class="et-d-desc">${nodeDescHTML(c.node.desc)}</div>
      <div class="et-d-foot">${act}</div>`;
  } else if (sel) {
    const st = nodeState(sel);
    const reqNames = (sel.requires || []).filter(r => !hasNode(r)).map(r => NODE_BY_ID[r].label);
    const action = st === 'owned' ? '<span class="et-d-owned">✓ TAKEN</span>'
      : st === 'sealed' ? `<span class="et-d-lock">descend deeper to unseal tier ${sel.tier}</span>`
      : st === 'needs' ? `<span class="et-d-lock">needs ${reqNames.join(' · ')}</span>`
      : `<button class="et-d-buy${st === 'poor' ? ' et-d-cant' : ''}" id="et-buy" ${st === 'poor' ? 'disabled' : ''}>KINDLE · ✦ ${sel.cost}</button>`;
    detail = `<div class="et-d-head"><span class="et-d-type t-${sel.type}">${TREE_TYPE_LABEL[sel.type]}</span><span class="et-d-name">${sel.label}</span></div>
      <div class="et-d-desc">${nodeDescHTML(sel.desc)}</div>
      <div class="et-d-foot">${action}</div>`;
  }
  // THE WEAVE STRIP IS GONE (v2.2 Build 6). Three wide pills restated what the
  // field already draws — the dashed doorway threads between regions ARE the
  // bonds, and the combat KIZUNA badge is where pair progress gets read. A
  // header row of "WOVEN · KINDRED · claim the ground" was jargon spent on
  // information the picture carries better.
  // tabs are ONLY your fielded party's constellations
  const tabHeroes = party.length ? party : [heroId];
  const tabs = tabHeroes.map(hid => {
    const done = EMBER_TREE.filter(n => n.hero === hid).every(n => hasNode(n.id));
    return `<button class="et-tab${hid === heroId ? ' et-tab-on' : ''}${done ? ' et-tab-done' : ''}" data-hero="${hid}">${HEROES[hid].name}</button>`;
  }).join('');
  showOverlay(`
    <div class="et-head"><span class="et-h-title">THE EMBER TREE</span><span class="et-h-wallet">✦ <b>${runEmbers()}</b></span><span class="et-h-boss">this descent only · resets if you fall</span>${(() => {
      // What the road has not shown you yet, said once and plainly — instead of
      // as a field of padlocks you have to look past.
      const ahead = sealedAhead(allNodes);
      return ahead ? `<span class="et-h-ahead" title="deeper tiers unseal as you descend">${ahead} more wait deeper</span>` : '';
    })()}</div>
    <div class="et-tabs">${tabs}</div>
    <div class="et-body">
      <div class="et-canvas et-grid" id="et-canvas">
        <div class="et-pan" id="et-pan">
          <svg class="et-links" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${ringSvg}${pathSvg}${crossRing}${linkSvg}${threadSvg}</svg>
          ${rootOrb}${orbs}${commonOrbs}
        </div>
        <div class="et-legend">
          <span class="et-lg t-card"><i>\u2756</i>COMBO</span>
          <span class="et-lg t-passive"><i>\u2749</i>PASSIVE</span>
          <span class="et-lg t-emergent"><i>\u2726</i>EMERGENT</span>
          <span class="et-lg t-chain"><i>\u26d3</i>WEAVE</span>
        </div>
        <div class="et-zoom">
          <button class="et-zoom-btn" id="et-zoom-out" title="Zoom out">−</button>
          <button class="et-zoom-btn" id="et-zoom-in" title="Zoom in">+</button>
          <button class="et-zoom-btn et-zoom-all" id="et-zoom-all" title="See the whole tree">◎</button>
        </div>
      </div>
      <div class="et-side">
        ${!treeTaught() ? `<div class="et-coach">Tap a <b>lit node</b>, then <b>KINDLE</b> it. Tap a <b>tab</b> to fly to that hero’s region — where your threads reach into it, you can <b>LEARN</b> from them.</div>` : ''}
        <div class="et-detail">${detail}</div>
        <button class="ov-btn et-back-btn" id="et-back">◂ BACK</button>
      </div>
    </div>
  `, 'map-screen et-screen');
  document.querySelectorAll('.et-tab').forEach(el => {
    // Switching hero no longer swaps the map — it flies the camera to that
    // region.  Re-render first (so the focused region lights up and its
    // crossings re-key), then hand attachTreePan the focus target so the
    // transform animates from wherever the camera already was.
    el.onclick = () => { if (el.dataset.hero !== heroId) showEmberTree(onBack, el.dataset.hero, null, { focus: true }); };
  });
  const etCanvas = document.getElementById('et-canvas');
  document.querySelectorAll('.et-orb[data-id]').forEach(el => {
    el.onclick = () => { if (etCanvas && etCanvas._dragMoved) return; showEmberTree(onBack, heroId, el.dataset.id); };   // a drag pans; a tap selects
  });
  attachTreePan(heroId, { world, focus: (opts && opts.focus) || !TREE_VIEW._seeded });
  const buy = $('#et-buy');
  if (buy && sel) buy.onclick = () => {
    if (nodeState(sel) !== 'ready') return;
    const first = !treeTaught();
    const bought = sel;
    addEmbers(-bought.cost); unlockNode(bought.id); setTreeTaught();   // learning the tree, once
    // the skill CATCHES — a full-screen ember-bloom before dropping back to the tree
    kindleBurst(bought, () => showEmberTree(onBack, heroId, first ? '__kindled:' + bought.id : bought.id));
  };
  const xbuy = $('#et-cross-buy');
  if (xbuy && selCross) xbuy.onclick = () => {
    if (selCross.state !== 'open') return;
    addEmbers(-selCross.cost); learnCrossing(heroId, selCross.node); saveRun();
    kindleBurst(selCross.node, () => showEmberTree(onBack, heroId, selId));
  };
  // celebrate the very first kindle so the loop clicks: node → KINDLE → in hand
  if (justKindled) {
    const c = document.querySelector('.et-side');
    if (c) { const b = document.createElement('div'); b.className = 'et-kindled-note'; b.innerHTML = '✓ <b>Kindled!</b> It’s in your hand now. Spend more embers here between fights — but it all resets if you fall.'; c.insertBefore(b, c.firstChild); }
  }
  const zAll = document.getElementById('et-zoom-all');
  if (zAll) zAll.onclick = () => {
    const pan = document.getElementById('et-pan'); if (!pan) return;
    pan.classList.add('et-flying');
    // Fit WHAT IS DRAWN, not the world's full square. A solo starter's tree is
    // one small cluster; fitting the whole world put a thumbnail in an empty
    // field. Frame the drawn orbs (hubs included) with a ring of margin.
    const drawnPts = allNodes.filter(n => tierOpen(n.tier) || hasNode(n.id))
      .map(n => pos[n.id]).filter(Boolean)
      .concat(party.map(h => hubs[h]).filter(Boolean));
    let zf = treeFitZoom(), cx = W / 2, cy = W / 2;
    if (drawnPts.length) {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      drawnPts.forEach(p => { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); });
      const span = Math.max(x1 - x0, y1 - y0) + 2.4 * TREE_RING;
      cx = (x0 + x1) / 2; cy = (y0 + y1) / 2;
      zf = Math.max(TREE_ZMIN, Math.min(TREE_ZMAX, treeViewportPx() / ((span / W) * TREE_BOX) * 0.94));
    }
    const o = treeFocusOffset({ x: cx, y: cy }, W, zf);
    TREE_VIEW.x = o.x; TREE_VIEW.y = o.y; TREE_VIEW.z = zf; TREE_VIEW._seeded = true;
    pan.style.transform = `translate(${o.x}px, ${o.y}px) scale(${zf})`;
    pan.style.setProperty('--lbl', String(Math.min(1, 1 / Math.max(0.01, zf))));
    setTimeout(() => pan.classList.remove('et-flying'), 640);
  };
  $('#et-back').onclick = () => { hideOverlay(); (onBack || showTitle)(); };
}
// CHOOSE YOUR SURVIVOR — pick the hero you begin (solo) with, from the ones
// you've UNLOCKED.  Locked heroes are shown dimmed: recruit them on the road to
// unlock them as a future starter.
function showStarterSelect(onPick) {
  const unlocked = getUnlockedStarters();
  const cards = STARTER_POOL.map(id => {
    const h = HEROES[id]; const open = unlocked.includes(id);
    return `<button class="ss-fig${open ? '' : ' ss-locked'}" data-id="${id}" ${open ? '' : 'disabled'}>
      <span class="ss-art">${V2PORTRAITS[id] || ''}</span>
      <span class="ss-name">${h.name}</span>
      <span class="ss-cls">${h.cls} · <b>${h.archetype || ''}</b></span>
      <span class="ss-identity">${open ? (h.identity || '') : '🔒 recruit them on the road to unlock'}</span>
    </button>`;
  }).join('');
  showOverlay(`
    <div class="ov-eyebrow">THE ABYSS TAKES EVERYONE · WHO WALKS BACK IN?</div>
    <div class="ov-title" style="font-size:20px; margin-bottom:12px;">CHOOSE YOUR SURVIVOR</div>
    <div class="ss-row">${cards}</div>
    <div class="ov-hint">You descend ALONE — the rest of your bonds are found on the road.</div>
    <button class="ov-btn" id="ss-back">◂ BACK</button>
  `, 'map-screen');
  document.querySelectorAll('.ss-fig:not(.ss-locked)').forEach(el => {
    el.onclick = () => { hideOverlay(); onPick(el.dataset.id); };
  });
  $('#ss-back').onclick = () => showTitle();
}
function tutorialSeen() { try { return !!localStorage.getItem(TUTORIAL_KEY); } catch (_) { return false; } }
// FIRST-EVER RUN — play the scripted FLOW onboarding (Ash → Elin → Mira) that
// TEACHES the hook: stances, parry, threads, weave, CHAIN, and the ALL-OUT.  It
// ends by dropping into the real solo descent (newRun('ash') keeps the roster
// solo — the tutorial trio were teaching companions), so a new player learns the
// bond fantasy in the first minutes, THEN plays the recruit loop knowing the
// payoff they're building toward.  Veterans (tutorialSeen) skip straight to the
// survivor-select + fast solo start.
function beginTutorial() {
  // NOT tutorialSeen here (Build 262): this fires before the first story line
  // renders, so quitting anywhere in onboarding used to mark the player taught
  // forever — CONTINUE then dropped them onto the descent map having been shown
  // nothing, and NEW GAME went to survivor-select. It is set when the tutorial
  // is FINISHED, in startDescent.
  try { localStorage.removeItem(RUN_KEY); localStorage.setItem(LAST_STARTER_KEY, 'ash'); } catch (_) {}
  RUN = newRun('ash');
  flowIdx = 0;
  try { localStorage.setItem(PROGRESS_KEY, '0'); } catch (_) {}
  saveRun();
  startFlowNode();
}
// ═════════════════════════════════════════════════════════════════════════════
// THE LANDING (Build 276) — where the loop actually happens
//
// Death used to be a scoreboard and a menu: a stats card, then "RETURN TO THE
// SURFACE", then the title screen. At the one moment a player is most
// receptive — having just lost a party they spent forty minutes bonding — not
// one of the 45 authored campfire beats, 8 fragments or six hero voices was
// anywhere on screen. A number card and a main menu.
//
// And that button was wrong in a way that gave the fix away. There IS no
// surface. The fragments already say so:
//
//   f6  "the number is never larger. The abyss is not a depth. It is a loop
//        with a story wrapped around it."
//   f5  "somebody has been up there already, and it was one of you"
//   f7  "what it remembers it keeps — the name first, then the face"
//
// So the canon is already written: you have died here many times, and the
// abyss takes the memory each time. Waking at the bottom is not a game over.
// It is what this place DOES. The Landing is that bottom — the hub every run
// begins and ends at, with the heroes you have unlocked standing in it,
// because they are looping too.
//
// THE HOOK, and it is the thing that makes this a story rather than a menu:
// they do not remember you. You remember them. Every FRAGMENT you hold is a
// piece the abyss has not taken yet — so as the codex fills, the people here
// remember more, and what they say to you changes. The meta-progression, the
// story and bondCarry become one thing instead of three.
const LANDING_STAGES = [
  { at: 0, eyebrow: 'THE BOTTOM OF IT',
    line: 'They look up when you come back down, and there is nothing behind their eyes at all. No one here has met you before. No one here has met anyone before.' },
  { at: 1, eyebrow: 'SOMETHING IS OFF',
    line: 'One of them almost says your name and stops, the way you stop at the top of a stair that is not there. It passes. But it happened.' },
  { at: 3, eyebrow: 'THEY ARE STARTING TO KEEP THINGS',
    line: 'Two of them are already arguing about a fight neither of them can place. They get the details right. They cannot say why.' },
  { at: 5, eyebrow: 'THEY REMEMBER THE SHAPE OF YOU',
    line: 'Nobody has your name yet. But they leave a space at the fire that is exactly your size, and none of them can explain who taught them to.' },
  { at: 8, eyebrow: 'THEY REMEMBER',
    line: 'Somebody says your name before you say it. The stair has been holding that back for a very long time, and it has just lost its grip.' },
];
function landingStage() {
  const n = fragsHeld();
  return LANDING_STAGES.slice().reverse().find(s => n >= s.at) || LANDING_STAGES[0];
}
// WHAT THEY SAY ABOUT WHAT JUST HAPPENED — the Hypnos seat. Keyed to the shape
// of the run that ended, spoken by somebody who was actually in it where
// possible, so the line is never generic when it could be personal.
const LANDING_DEATH = {
  boss:   { need: 1, say: (h, c) => `It was bigger than us. That is not the same as it being impossible. …Ask me again at the bottom of the next one.` },
  deep:   { need: 1, say: (h, c) => `Floor ${c.floor}. Further than last time, if last time happened, which nobody here will confirm.` },
  alone:  { need: 1, say: (h, c) => `You went down that stair on your own. …Don't. There is a reason the ones who come back come back in threes.` },
  bonded: { need: 2, say: (h, c) => `We held ${c.threads} of them, at the end. I keep thinking that should have been enough. I keep being wrong about that in a way that feels practised.` },
  early:  { need: 1, say: (h, c) => `That was quick. …I'm not judging. I have a very strong feeling I have been quicker.` },
  clear:  { need: 1, say: (h, c) => `You came back up. People do not come back up. …Sit down. Tell me it twice, I want to see if it survives being said.` },
  // the COLD open — you did not arrive here from a death this session, you just
  // opened your eyes, which is the one thing everybody down here has in common
  wake:   { need: 1, say: (h, c) => `You’re awake. …Don’t bother with the part where you ask how long. Nobody has ever had an answer, and the asking is how it starts.` },
};
function landingBeat(ctx) {
  const cast = getUnlockedStarters().filter(id => HEROES[id]);
  const spoke = (ctx.trio || []).filter(id => cast.includes(id));
  // ROTATE the seat. Taking [0] meant the run's lead always talked, and the run's
  // lead is nearly always Ash — so a hub built to show off six voices only ever
  // used one. Prefer somebody who was actually there, and move down the line
  // each time you wake, so the cast takes turns across runs.
  const pool = spoke.length ? spoke : cast;
  const who = pool[(META.deaths || 0) % pool.length] || 'ash';
  const name = HEROES[who] ? HEROES[who].name : 'A VOICE';
  const key = ctx.cold ? 'wake'
    : ctx.cleared ? 'clear'
    : ctx.wasBoss ? 'boss'
    : (ctx.trio || []).length <= 1 ? 'alone'
    : (ctx.threads || 0) >= 2 ? 'bonded'
    : (ctx.floor || 1) >= 2 ? 'deep'
    : (ctx.cleared_nodes || 0) <= 2 ? 'early' : 'deep';
  const d = LANDING_DEATH[key] || LANDING_DEATH.deep;
  return { who, name, text: d.say(name, ctx) };
}
// The hub itself. Everything that used to be a menu row is a place here: the
// codex is the wall you read, the starter select is who you wake next to.
// WHAT DO YOU TAKE DOWN WITH YOU — the last thing before the stair. One relic
// or none, and "none" is a real answer, because every one of them costs.
function showRelicSelect(starterId) {
  const found = relicsFound();
  if (!found.length) { beginRun(starterId); return; }
  const rows = found.map(r => `
    <button class="rl-card" data-id="${r.id}">
      <span class="rl-icon">${r.icon}</span>
      <span class="rl-body">
        <span class="rl-name">${r.name}</span>
        <span class="rl-found">${r.found}</span>
        <span class="rl-rule">${r.rule}</span>
        <span class="rl-cost">✕ ${r.cost}</span>
      </span>
    </button>`).join('');
  showOverlay(`
    <div class="ov-eyebrow">THE ABYSS DID NOT INTEND YOU TO HAVE THESE</div>
    <div class="ov-title" style="font-size:22px">WHAT DO YOU CARRY DOWN?</div>
    <div class="rl-list">${rows}
      <button class="rl-card rl-none" data-id=""><span class="rl-icon">—</span>
        <span class="rl-body"><span class="rl-name">NOTHING</span>
        <span class="rl-rule">Go down clean. Every one of them takes something back.</span></span></button>
    </div>
  `, 'story-screen relic-screen');
  document.querySelectorAll('.rl-card').forEach(el => {
    el.onclick = () => { hideOverlay(); beginRun(starterId, el.dataset.id || null); };
  });
}
function showLanding(ctx) {
  const c = ctx || {};
  const stage = landingStage();
  const beat = landingBeat(c);
  const cast = getUnlockedStarters().filter(id => HEROES[id]);
  const mid = (cast.length - 1) / 2;
  const figs = cast.map((id, i) => `<span class="ld-hero${id === beat.who ? ' ld-speaking' : ''}" style="--off:${(i - mid).toFixed(2)}" data-id="${id}">${V2PORTRAITS[id] || ''}</span>`).join('');
  const frags = fragsHeld(), total = ABYSS_FRAGMENTS.length;
  showOverlay(`
    <div class="ld-scene">
      <div class="ld-dark"></div>
      <div class="ld-shaft"></div>
      <div class="ld-cast">${figs}</div>
      <div class="ld-top">
        <div class="ld-eyebrow">${stage.eyebrow}</div>
        <div class="ld-title">THE LANDING</div>
        <div class="ld-sub">${c.cleared ? 'you came back — and the stair put you right back at the bottom of itself'
          : c.cold ? 'the stair is exactly where you left it'
          : 'you woke at the bottom again' + ((META.deaths || 0) > 1 ? ` · the ${ordinal(META.deaths)} time` : '')}</div>
      </div>
      <div class="ld-body">
        <div class="ld-state">${stage.line}</div>
        <div class="ld-plate">${HEROES[beat.who] ? HEROES[beat.who].name : ''}</div>
        <div class="ld-said">“${beat.text}”</div>
      </div>
      <!-- ONE ACTION (Build 285). Three stacked cards ate a third of the frame
           and made the bottom of the abyss look like a settings menu; the scene
           was competing with its own navigation. The climb is the only thing
           worth a button. What you know and the way out are quiet marks in the
           corner — reachable, unobtrusive, and they do not ask to be read. -->
      <div class="ld-marks">
        <button class="ld-mark" id="ld-codex" title="WHAT WE KNOW — ${frags} of ${total} pieced together">◇<span class="ldm-n">${frags}/${total}</span></button>
        <button class="ld-mark" id="ld-title" title="rest a while — back to the title">⌂</button>
      </div>
      <button class="ld-climb" id="ld-go"><span class="ldc-l">CLIMB</span><span class="ldc-d">${cast.length > 1 ? 'choose who you wake beside' : 'there is only one way out of here'}</span></button>
    </div>
  `, 'landing-screen');
  $('#ld-go').onclick = () => { hideOverlay(); showStarterSelect(id => showRelicSelect(id)); };
  $('#ld-codex').onclick = () => showCodex(() => showLanding(c));
  $('#ld-title').onclick = () => { hideOverlay(); showTitle(); };
  // v2.2 narrative observes an arrival at the hub — LANDING_AFTER:<id> beats
  // key off this. A future beat's scene plays OVER the hub and hands back to
  // it; today nothing is eligible, so this is a no-op.
  narrFire('LANDING', c, () => { if (!document.querySelector('.ld-scene')) showLanding(c); });
}
function ordinal(n) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return n + 'th';
  return n + ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th');
}
// A short, hero-specific opening beat, then into the Descent.
function beginRun(starterId, relicId) {
  RUN = newRun(starterId);
  // THE RELIC IS CARRIED IN, not found on the road — so it has to land before
  // the map is read, and the map is generated inside newRun. Re-roll it here so
  // SOMEONE'S LEFT GLOVE and A CHILD'S COMPASS can actually shape the descent.
  if (relicId && RELIC_BY_ID[relicId]) {
    RUN.relic = relicId;
    if (relicId === 'glove') {
      const mate = getUnlockedStarters().filter(id => id !== starterId)[0];
      if (mate) { RUN.roster.push(mate); RUN.active.push(mate); RUN.hp[mate] = HEROES[mate].maxHp; }
    }
    if (relicId === 'ash') RUN.embers = fragsHeld() * 4;
    RUN.map = generateDescent(RUN.roster, 1);   // now that the relic is on the run
  }
  flowIdx = FLOW.length;
  try { localStorage.setItem(PROGRESS_KEY, String(FLOW.length)); localStorage.removeItem(RUN_KEY); localStorage.setItem(LAST_STARTER_KEY, starterId); } catch (_) {}
  saveRun();
  const h = HEROES[starterId];
  showStory({
    type: 'story', chapter: 3, title: h.name, eyebrow: 'ONE SURVIVOR',
    lines: [
      { text: 'The first thing you understand is that everyone else is gone.' },
      { spk: h.name, text: '…then I carry it alone. For now.' },
      { text: `You are <b>${h.name}</b> — ${h.identity || h.cls}. Your <b>row is your stance</b>; when a blow falls, <b>dodge</b> the row or <b>parry</b> its rhythm, note by note.` },
      { text: `The dead give up <b>✦ embers</b> to grow your kit, and companions share <b>gifts</b> — but the <b>bonds</b> you weave between the living are the real weapon. Descend, and find the others. <i>(Full rules live in the menu’s How to Play.)</i>` },
    ],
    beginDescent: true,
  });
}

function showGate() {
  showOverlay(`
    <div class="ov-title" style="font-size:24px">KIZUNA</div>
    <div class="ov-sub">BONDS</div>
    <div class="gate-card">
      <input type="password" id="gate-input" autocomplete="off" placeholder="…" />
      <button class="ov-btn primary" id="gate-go">ENTER</button>
      <div class="gate-err" id="gate-err"></div>
    </div>
  `);
  const tryIt = () => {
    if (($('#gate-input').value || '').toLowerCase() === 'keeter') {
      try { localStorage.setItem(UNLOCK_KEY, '1'); } catch (_) {}
      showTitle();
    } else { $('#gate-err').textContent = 'incorrect'; $('#gate-input').value = ''; }
  };
  $('#gate-go').onclick = tryIt;
  $('#gate-input').addEventListener('keydown', e => { if (e.key === 'Enter') tryIt(); });
  setTimeout(() => $('#gate-input').focus(), 60);
}

// ---------------------------------------------------------------------------
// FIT-TO-SCREEN + BOOT
// ---------------------------------------------------------------------------
// Fit the 760×430 design canvas into whatever the device gives us, preserving
// the iOS proportions everywhere (contain-scale + centre).  visualViewport is
// the source of truth on mobile — it reflects the ACTUAL visible area as the
// browser's toolbar slides in/out and survives pinch-zoom, so Android/iOS don't
// get left letterboxed by a stale window.innerHeight.
// DESKTOP (mouse-primary) still fills the screen edge-to-edge — but it has more
// real estate than the 760×430 phone canvas needs, so a straight fill blows the
// UI up huge.  Instead, on desktop we ENLARGE the LOGICAL canvas by DESK_K (same
// 16:9 aspect, so it still fills): every fixed-size element becomes a smaller
// fraction of the bigger canvas → the UI reads smaller and the board gets more
// breathing room, MTG-Arena style.  Mobile keeps the native phone canvas.
const DESK_K = 1.3;
function isDesktop() { try { return !!(window.matchMedia && window.matchMedia('(pointer: fine)').matches); } catch (_) { return false; } }
function fitStage() {
  // MEASURE the true full-screen box.  #stage-scale is position:fixed; inset:0,
  // so with viewport-fit=cover its rect spans the WHOLE screen (under the notch
  // included) — more reliable on iOS than visualViewport.width, which can
  // under-report in landscape and leave black bars.  Take the widest/tallest of
  // every source so the fullest measure wins.
  const vv = window.visualViewport;
  const box = document.getElementById('stage-scale');
  const br = box ? box.getBoundingClientRect() : null;
  let w = Math.round(Math.max((br && br.width) || 0, (vv && vv.width) || 0, window.innerWidth || 0, document.documentElement.clientWidth || 0));
  let h = Math.round(Math.max((br && br.height) || 0, (vv && vv.height) || 0, window.innerHeight || 0, document.documentElement.clientHeight || 0));
  // SAFE AREA (Build 213) — #stage-scale is padded by the device insets, so fit
  // the board to the CONTENT box.  Without this the notch eats the BURST gauge
  // and the home indicator sits on the hand cards.
  if (box) {
    try {
      const cs = getComputedStyle(box);
      w -= (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
      h -= (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    } catch (_) {}
  }
  if (!w || !h) return;
  const desktop = isDesktop();
  const k = desktop ? DESK_K : 1;
  const dh = 430 * k;
  // FULL-BLEED on touch: the design canvas is 760×430, but a phone in landscape
  // is wider than that (≈2.0–2.17:1), so a fixed-width canvas letterboxes with
  // black bars left/right.  Widen the canvas to the viewport's OWN aspect ratio
  // (never below the 760 design width, capped so an ultra-wide screen doesn't
  // overstretch the layout).  The grid/flex board reflows to fill it — no
  // distortion, no cropping.  Desktop keeps its fixed, deliberately-framed canvas.
  let dw = 760 * k;
  if (!desktop) {
    const DESIGN_AR = 760 / 430, MAX_AR = 2.4;   // covers up to 21.6:9 phones; beyond that a sliver letterboxes
    const ar = Math.min(Math.max(w / h, DESIGN_AR), MAX_AR);
    dw = Math.round(dh * ar);
  }
  const st = document.getElementById('stage');
  if (!st) return;
  st.style.width = dw + 'px';
  st.style.height = dh + 'px';
  st.style.transform = 'scale(' + Math.min(w / dw, h / dh) + ')';   // fills the screen; content just renders smaller
  // a class the CSS uses to give desktop its OWN tuning (bigger figures that
  // fill the taller board, so the extra room reads premium, not empty).
  if (st.classList.contains('ui-desktop') !== desktop) st.classList.toggle('ui-desktop', desktop);
}
// Layout can settle a frame or two after load/rotate on mobile — re-fit a few times.
function scheduleFit() { fitStage(); requestAnimationFrame(fitStage); setTimeout(fitStage, 250); }
window.addEventListener('resize', fitStage);
window.addEventListener('load', scheduleFit);
window.addEventListener('orientationchange', () => { scheduleFit(); setTimeout(fitStage, 550); });
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', fitStage);
  window.visualViewport.addEventListener('scroll', fitStage);
}

// ANDROID in-browser FULLSCREEN.  iOS Safari has no element Fullscreen API, so
// iPhones go fullscreen by INSTALLING the PWA (see manifest + apple- metas).
// Android Chrome DOES support it, so on a touch device that isn't already an
// installed PWA, quietly enter true fullscreen (hiding the address/nav bars) on
// the player's first tap — the one user gesture the API requires.  Desktop and
// already-standalone launches are left alone; every call is guarded so an
// unsupported browser is a silent no-op.
function isStandalonePWA() {
  try {
    if (navigator.standalone) return true;   // iOS installed
    return !!(window.matchMedia && window.matchMedia('(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui)').matches);
  } catch (_) { return false; }
}
function tryEnterFullscreen() {
  try {
    if (isDesktop() || isStandalonePWA()) return;
    if (document.fullscreenElement) return;
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!req) return;                         // no support (e.g. iOS Safari) — PWA install covers it
    const p = req.call(el);
    if (p && p.then) p.then(() => setTimeout(fitStage, 60)).catch(() => {});
    else setTimeout(fitStage, 60);
  } catch (_) {}
}
(function armFullscreen() {
  const arm = () => {
    window.removeEventListener('pointerdown', arm, true);
    window.removeEventListener('touchend', arm, true);
    tryEnterFullscreen();
  };
  window.addEventListener('pointerdown', arm, true);
  window.addEventListener('touchend', arm, true);
})();
// Register the service worker so the game is INSTALLABLE as a PWA (Android
// Chrome only surfaces "Install app" with a fetch handler + PNG icons).  The
// worker is network-first, so it never hides a fresh deploy.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { try { navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (_) {} });
}
document.addEventListener('fullscreenchange', () => setTimeout(fitStage, 60));

// Cancel tap-targeting on stray taps (drag mode manages its own lifecycle).
document.addEventListener('pointerdown', (e) => {
  if (!targeting || targeting.drag) return;
  if (e.target.closest('.fig-targetable') || (targeting.isRow && e.target.closest('.slot'))) return;
  cancelTargeting();
}, true);
// Dismiss a boon inspect panel on any tap that isn't on a boon chip.
document.addEventListener('pointerdown', (e) => {
  if (_boonInspectEl && !e.target.closest('.cb-boon, .map-boon')) hideBoonInspect();
}, true);
// Dismiss the KIZUNA bond panel on any tap that isn't on it (or its chip).
document.addEventListener('pointerdown', (e) => {
  if (_bondPanelEl && !e.target.closest('#bond-panel, #resonance')) hideBondPanel();
}, true);

$('#btn-endturn').addEventListener('click', endTurn);

// ---------------------------------------------------------------------------
// AUTO-UPDATE — GitHub Pages caches HTML for ~10 minutes, so a fresh deploy
// can sit invisible behind a stale index.html.  We poll a tiny version
// manifest (cache: no-store beats the CDN), and when a newer build exists an
// UPDATE chip appears; tapping it reloads with a cache-busting query so the
// fresh HTML (and its fresh ?v= asset URLs) actually arrive.
function checkForUpdate() {
  fetch('../version.json?ts=' + Date.now(), { cache: 'no-store' })
    .then(r => r.ok ? r.json() : null)
    .then(v => {
      if (!v || !(v['v2.2'] > V2_BUILD)) return;
      if (document.getElementById('update-chip')) return;
      const chip = document.createElement('button');
      chip.id = 'update-chip';
      chip.textContent = '✦ UPDATE READY · BUILD ' + v['v2.2'] + ' — TAP';
      chip.onclick = () => location.replace(location.pathname + '?u=' + v['v2.2']);
      document.body.appendChild(chip);
    })
    .catch(() => {});
}
setInterval(checkForUpdate, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkForUpdate(); });
setTimeout(checkForUpdate, 2500);

fitStage();
// Drive the on-screen build stamp from the single source of truth (V2_BUILD),
// so the HTML can't drift out of sync with what the game actually reports.
{ const bs = document.getElementById('build-stamp'); if (bs) bs.textContent = 'V2.2 BUILD ' + V2_BUILD; }
{ const mb = $('#menu-btn'); if (mb) mb.onclick = showMenu; }
let unlocked = false;
try { unlocked = localStorage.getItem(UNLOCK_KEY) === '1'; } catch (_) {}
if (unlocked) showTitle(); else showGate();

// ── PERF HUD — TAP THE BUILD STAMP (top-right "V2.2 BUILD n") to toggle a live
// frame-time readout: fps · avg · WORST-frame ms (green→yellow→red).  A worst
// spike while dragging pinpoints an on-device paint/layout hitch.  Tap-to-toggle
// so no URL editing is needed on mobile (#fps still auto-enables it).
(function fpsHud() {
  let on = false, last = 0, frames = 0, acc = 0, worst = 0;
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;top:42px;left:50%;transform:translateX(-50%);z-index:2147483647;background:rgba(0,0,0,0.82);color:#6f6;font:14px/1.4 monospace;padding:5px 12px;border-radius:7px;pointer-events:none;white-space:pre;display:none';
  const mount = () => (document.body || document.documentElement).appendChild(el);
  if (document.body) mount(); else window.addEventListener('DOMContentLoaded', mount);
  function tick(t) {
    if (!on) return;
    if (last) { const dt = t - last; acc += dt; frames++; if (dt > worst) worst = dt;
      if (acc >= 400) { const avg = acc / frames; el.textContent = Math.round(1000 / avg) + ' fps · avg ' + avg.toFixed(1) + ' · worst ' + worst.toFixed(0) + 'ms'; el.style.color = worst > 32 ? '#f66' : worst > 20 ? '#fd6' : '#6f6'; acc = 0; frames = 0; worst = 0; } }
    last = t; requestAnimationFrame(tick);
  }
  // DIAGNOSTIC toggles — two buttons under the readout that turn off continuous
  // ANIMATIONS and figure FILTERS.  Whichever recovers idle fps is the culprit.
  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;top:74px;left:50%;transform:translateX(-50%);z-index:2147483647;display:none;gap:8px;pointer-events:auto';
  const mkBtn = (label, cls) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = 'font:12px monospace;padding:5px 10px;border-radius:6px;border:1px solid #555;background:rgba(0,0,0,0.82);color:#ccc';
    b.onclick = () => { const doc = document.documentElement; const off = doc.classList.toggle(cls); b.style.background = off ? '#3a5' : 'rgba(0,0,0,0.82)'; b.style.color = off ? '#000' : '#ccc'; };
    return b;
  };
  bar.appendChild(mkBtn('anims off', 'diag-noanim'));
  bar.appendChild(mkBtn('filters off', 'diag-nofilter'));
  const mountBar = () => (document.body || document.documentElement).appendChild(bar);
  if (document.body) mountBar(); else window.addEventListener('DOMContentLoaded', mountBar);
  const toggle = () => { on = !on; el.style.display = on ? 'block' : 'none'; bar.style.display = on ? 'flex' : 'none'; el.textContent = 'measuring…'; last = acc = frames = worst = 0; if (on) requestAnimationFrame(tick); };
  const wire = () => {
    const bs = document.getElementById('build-stamp');
    if (bs) { bs.style.pointerEvents = 'auto'; bs.style.cursor = 'pointer'; bs.title = 'tap: FPS meter'; bs.addEventListener('click', toggle); }
    try { if ((location.hash || '').indexOf('fps') >= 0) toggle(); } catch (_) {}
  };
  if (document.readyState !== 'loading') wire(); else window.addEventListener('DOMContentLoaded', wire);
})();
