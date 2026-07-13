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

const V2_BUILD = 187;   // MUST match version.json's "v2.1" — the update-check compares them. Bump BOTH every build.
const CHARGE_CAP = 4;   // Hask (Black Mage) — max CHARGE stacks
const CHARGE_DMG = 3;   // damage per CHARGE spent by an OVERLOAD nuke
const MISFIRE_PER_CHARGE = 2;   // self-damage per ◆ CHARGE if Hask MOVES mid-channel (no Steady Cast)
function chargeCap(h) { return (h && h.id === 'hask' && hasNode('hask.passive.conduit')) ? 6 : CHARGE_CAP; }
function chargeDmg() { return hasNode('hask.passive.meltdown') ? 5 : CHARGE_DMG; }
const $ = (sel) => document.querySelector(sel);

// ---------------------------------------------------------------------------
// SETTINGS — persisted player options (menu) + dev toggles.
// ---------------------------------------------------------------------------
const SETTINGS_KEY = 'kizuna2_1.settings';
const SETTINGS = Object.assign(
  { sound: true, music: true, haptics: true, fightBg: true },
  (() => { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') || {}; } catch (_) { return {}; } })()
);
function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(SETTINGS)); } catch (_) {} }
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
const META_KEY = 'kizuna2_1.meta';
const META = Object.assign(
  { heat: 0 },
  (() => { try { const m = JSON.parse(localStorage.getItem(META_KEY) || '{}') || {}; return { heat: +m.heat || 0 }; } catch (_) { return {}; } })()
);
function saveMeta() { try { localStorage.setItem(META_KEY, JSON.stringify({ heat: META.heat })); } catch (_) {} }
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
function tierOpen(tier) { return runDepth() >= (tier - 1) * 2; }
// one-time hand-hold: the first time you have embers to spend, the game walks
// you through opening the Ember Tree and kindling a skill.
function treeTaught() { try { return localStorage.getItem('kizuna2_1.treeTaught') === '1'; } catch (_) { return false; } }
function setTreeTaught() { try { localStorage.setItem('kizuna2_1.treeTaught', '1'); } catch (_) {} }

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
const EMBER_TREE = [
  { id: 'ash.sig.front', hero: 'ash', tier: 1, cost: 4, type: 'card', gate: { stance: 'front' }, label: 'Rising Slash', desc: 'COMBO · FRONT: inserts <b>Rising Slash</b> (8 dmg) · Cleave → <b>Rising Slash</b> → Crashing Wave' },
  { id: 'ash.sig.back',  hero: 'ash', tier: 1, cost: 4, type: 'card', gate: { stance: 'back'  }, label: 'Deeper Cut', desc: 'COMBO · BACK: inserts <b>Deeper Cut</b> (5 dmg) · Thrown Edge → <b>Deeper Cut</b> → Follow Cut' },
  { id: 'ash.sig.mid',   hero: 'ash', tier: 1, cost: 5, type: 'card', gate: { stance: 'mid'   }, label: 'Parry Step', desc: 'COMBO · MID: inserts <b>Parry Step</b> (<span class="kw kw-guard">⛨5</span> · <span class="kw kw-counter">↺1</span>) · Flowing Cut → <b>Parry Step</b> → Riposte' },
  { id: 'ash.rider.expose', hero: 'ash', tier: 2, cost: 6, type: 'rider', requires: ['ash.sig.back'], label: 'Hunter’s Instinct', desc: 'UPGRADE: Thrown Edge also inflicts <span class="kw kw-exposed">◎ EXPOSED 2</span> — position becomes a debuff', rider: { card: 'Thrown Edge', fx: { mark: 2 }, descAdd: ' · <span class="kw kw-exposed">◎ EXPOSED 2</span>' } },
  { id: 'ash.passive.vanguard', hero: 'ash', tier: 2, cost: 6, type: 'passive', label: 'Vanguard’s Momentum', desc: 'ON MOVE: closing to FRONT grants <span class="kw kw-guard">⛨3</span> — repositioning becomes defense', passive: 'ash_vanguard' },
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
  { id: 'ash.passive.relentless', hero: 'ash', tier: 4, cost: 12, type: 'passive', requires: ['ash.emergent.tempo'], label: 'Relentless', desc: 'PASSIVE: your 1st <span class="kw kw-rally">FOLLOW-UP</span> each turn refunds <b>1 EP</b> — the duel never lets up', passive: 'ash_relentless' },

  // ELIN — LIGHT: wards, overheal shields, party sustain
  { id: 'elin.passive.ward', hero: 'elin', tier: 2, cost: 6, type: 'passive', label: 'Warding Light', desc: 'TURN START: your most-wounded ally gains <span class="kw kw-guard">⛨2</span> — the light finds the hurt', passive: 'elin_ward' },
  { id: 'elin.passive.mercy', hero: 'elin', tier: 2, cost: 6, type: 'passive', requires: ['elin.passive.ward'], label: 'Mercy', desc: 'PASSIVE: when Elin <b>heals</b> an ally she also <b>cleanses</b> <span class="kw kw-chill">❄ CHILL</span> and <span class="kw kw-exposed">◎ EXPOSED</span> — she mends the omen too', passive: 'elin_mercy' },
  { id: 'elin.rider.radiance', hero: 'elin', tier: 3, cost: 7, type: 'rider', requires: ['elin.sig.front'], label: 'Radiance', desc: 'UPGRADE: Radiant Ward also heals EVERY ally <span class="kw kw-heal">✚2</span>', rider: { card: 'Radiant Ward', fx: { heal: 2 }, descAdd: ' · <span class="kw kw-heal">✚ 2</span> party' } },
  { id: 'elin.passive.overflow', hero: 'elin', tier: 4, cost: 11, type: 'passive', requires: ['elin.rider.radiance'], label: 'Radiant Overflow', desc: 'PASSIVE: heal OVERFLOW spills as <span class="kw kw-guard">⛨ guard</span> to the WHOLE party — not just the target', passive: 'elin_overflow' },

  // MIRA — EXPOSED: exploit marks, execute the wounded
  { id: 'mira.passive.opportunist', hero: 'mira', tier: 2, cost: 6, type: 'passive', requires: ['mira.sig.back'], label: 'Opportunist', desc: 'PASSIVE: <b>+3 dmg</b> to any <span class="kw kw-exposed">◎ EXPOSED</span> foe — never waste an opening', passive: 'mira_opportunist' },
  { id: 'mira.rider.twin', hero: 'mira', tier: 3, cost: 7, type: 'rider', requires: ['mira.sig.mid'], label: 'Twinned Edge', desc: 'UPGRADE: Twin Daggers also inflicts <span class="kw kw-exposed">◎ EXPOSED 3</span>', rider: { card: 'Twin Daggers', fx: { mark: 3 }, descAdd: ' · <span class="kw kw-exposed">◎ EXPOSED 3</span>' } },
  { id: 'mira.passive.deathmark', hero: 'mira', tier: 4, cost: 12, type: 'passive', requires: ['mira.emergent.bloodscent'], label: 'Death Mark', desc: 'PASSIVE: striking a foe at/under <b>30% HP</b> EXECUTES it — the wounded don’t walk away', passive: 'mira_execute' },

  // CASSIA — GUARD: retaliation, an immovable wall
  { id: 'cassia.passive.vigil', hero: 'cassia', tier: 2, cost: 6, type: 'passive', label: 'Standing Vigil', desc: 'TURN START: Cassia braces for <span class="kw kw-guard">⛨2</span> — never caught flat', passive: 'cassia_vigil' },
  { id: 'cassia.passive.bastion', hero: 'cassia', tier: 2, cost: 6, type: 'passive', requires: ['cassia.passive.vigil'], label: 'Bastion', desc: 'PASSIVE: Cassia takes no <span class="kw kw-chill">❄ CHILL</span> — the wall does not slow', passive: 'cassia_bastion' },
  { id: 'cassia.rider.aegis', hero: 'cassia', tier: 3, cost: 7, type: 'rider', requires: ['cassia.sig.mid'], label: 'Warded Aegis', desc: 'UPGRADE: Aegis also grants the ally <span class="kw kw-counter">↺1</span> — the ward bites back', rider: { card: 'Aegis', fx: { counter: 1 }, descAdd: ' · <span class="kw kw-counter">↺ 1</span>' } },
  { id: 'cassia.allout.fortress', hero: 'cassia', tier: 3, cost: 9, type: 'allout', requires: ['cassia.emergent.bulwark'], label: 'Fortress', desc: 'ALL-OUT START: the whole party gains <span class="kw kw-guard">⛨5</span> — brace before the storm', allout: 'fortress' },
  { id: 'cassia.passive.immovable', hero: 'cassia', tier: 4, cost: 12, type: 'passive', requires: ['cassia.rider.aegis'], label: 'Immovable', desc: 'PASSIVE: Cassia’s <span class="kw kw-guard">⛨ guard</span> no longer fades at turn’s end — the wall only grows', passive: 'cassia_immovable' },

  // BRANWEN — MARK: marks at range, the tally comes due
  { id: 'branwen.passive.focus', hero: 'branwen', tier: 2, cost: 6, type: 'passive', requires: ['branwen.sig.back'], label: 'Hunter’s Focus', desc: 'PASSIVE: <b>+2 dmg</b> to any <span class="kw kw-exposed">◎ EXPOSED</span> foe', passive: 'branwen_hunter' },
  { id: 'branwen.passive.opening', hero: 'branwen', tier: 3, cost: 8, type: 'passive', requires: ['branwen.passive.focus'], label: 'Opening Shot', desc: 'TURN START: EXPOSE the nearest foe <span class="kw kw-exposed">◎1</span> — the hunt is always on', passive: 'branwen_opening' },
  { id: 'branwen.passive.reckoning', hero: 'branwen', tier: 4, cost: 12, type: 'passive', requires: ['branwen.emergent.tally'], label: 'The Reckoning', desc: 'ON EXPOSED KILL: your 1st kill each turn refunds <b>1 EP</b> — the tally always comes due', passive: 'branwen_reckoning' },

  // ═══ TEAM SYNERGY (Phase 3) — each hero's identity now pays the WHOLE party.
  // These are the cross-hero combos: who you bring changes how everyone plays. ═══
  { id: 'ash.synergy.warcry', hero: 'ash', tier: 4, cost: 11, type: 'synergy', requires: ['ash.passive.exploit'], label: 'Warcry', desc: 'ON FOLLOW-UP: the ally you followed gains <span class="kw kw-rally">▲ RALLY +2</span> — the hunt feeds the pack', passive: 'ash_warcry' },
  { id: 'elin.synergy.blessing', hero: 'elin', tier: 4, cost: 11, type: 'synergy', requires: ['elin.passive.ward'], label: 'Blessed Edge', desc: 'ON HEAL / WARD: that ally’s next strike deals <span class="kw kw-rally">▲ +2</span> — her light sharpens their blade', passive: 'elin_blessing' },
  { id: 'mira.synergy.marked', hero: 'mira', tier: 4, cost: 11, type: 'synergy', requires: ['mira.passive.opportunist'], label: 'Marked for Death', desc: 'PASSIVE: <span class="kw kw-exposed">◎ EXPOSED</span> foes take <b>+2</b> from EVERY ally — your openings are the party’s', passive: 'mira_marked' },
  { id: 'cassia.synergy.soak', hero: 'cassia', tier: 4, cost: 11, type: 'synergy', requires: ['cassia.passive.vigil'], label: 'Guardian’s Aegis', desc: 'PASSIVE: allies in rows BEHIND Cassia take <b>−2</b> from every blow — she covers the line', passive: 'cassia_soak' },
  { id: 'branwen.synergy.cadence', hero: 'branwen', tier: 4, cost: 11, type: 'synergy', requires: ['branwen.passive.opening'], label: 'Hunter’s Cadence', desc: 'TURN START: if any foe is <span class="kw kw-exposed">◎ EXPOSED</span>, the WHOLE party gains <span class="kw kw-rally">▲ RALLY +1</span>', passive: 'branwen_cadence' },

  // ═══ STANCE PATHWAYS — every position now grows its own branch, so all three
  // rows reward investment (not just each hero's one favoured stance). ══════════
  // ASH — the MID (flow) line and a deeper BACK (mark) line
  { id: 'ash.passive.exploit', hero: 'ash', tier: 3, cost: 8, type: 'passive', requires: ['ash.rider.expose'], label: 'Opening Read', desc: 'PASSIVE: <b>+3 dmg</b> to any <span class="kw kw-exposed">◎ EXPOSED</span> foe — your marks are yours to cash', passive: 'ash_exploit' },

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
  { id: 'mira.passive.frenzy', hero: 'mira', tier: 4, cost: 12, type: 'passive', requires: ['mira.emergent.flurry'], label: 'Bloodfrenzy', desc: 'ON EXPOSED HIT: your NEXT strike deals <span class="kw kw-rally">▲ +2</span> — the kill feeds the next', passive: 'mira_frenzy' },

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
  { id: 'ash.exec',     hero: 'ash',     tier: 2, cost: 7, type: 'execute', label: 'Executioner', desc: 'ON STAGGER: forge a free <b>Coup de Grâce</b> — 10 dmg, <b>doubled</b> vs staggered',
    stagger: { name: 'Coup de Grâce', target: 'enemy', fx: { dmg: 10 }, desc: '<b>10 damage</b> · <b>×2 vs STAGGERED</b>.' } },
  { id: 'elin.exec',    hero: 'elin',    tier: 2, cost: 7, type: 'execute', label: 'Executioner', desc: 'ON STAGGER: forge a free <b>Mercy’s End</b> (8 holy, doubled vs staggered) & the party heals <span class="kw kw-heal">✚3</span> — she mends as she ends',
    stagger: { name: 'Mercy’s End', target: 'enemy', fx: { dmg: 8 }, heal: 3, desc: '<b>8 holy</b> · <b>×2 vs STAGGERED</b>.' } },
  { id: 'mira.exec',    hero: 'mira',    tier: 2, cost: 7, type: 'execute', label: 'Executioner', desc: 'ON STAGGER: forge a free <b>Death Blossom</b> (7 dmg · <span class="kw kw-exposed">◎4</span>, doubled vs staggered) — paints the kill',
    stagger: { name: 'Death Blossom', target: 'enemy', fx: { dmg: 7, mark: 4 }, desc: '<b>7 damage</b> · <span class="kw kw-exposed">◎ EXPOSED 4</span> · <b>×2 vs STAGGERED</b>.' } },
  { id: 'cassia.exec',  hero: 'cassia',  tier: 2, cost: 7, type: 'execute', label: 'Executioner', desc: 'ON STAGGER: forge a free <b>Wallbreaker</b> (8 dmg, doubled vs staggered) & Cassia gains <span class="kw kw-guard">⛨5</span> — the wall punishes & hardens',
    stagger: { name: 'Wallbreaker', target: 'frontmost', fx: { dmg: 8, guard: 5 }, desc: '<b>8 damage</b> · <b>×2 vs STAGGERED</b> · gain <span class="kw kw-guard">⛨5</span>.' } },
  { id: 'branwen.exec', hero: 'branwen', tier: 2, cost: 7, type: 'execute', label: 'Executioner', desc: 'ON STAGGER: forge a free <b>Marksman’s Finish</b> (10 dmg, doubled vs staggered) & refund <b>1 EP</b> — the hunt presses on',
    stagger: { name: 'Marksman’s Finish', target: 'enemy', fx: { dmg: 10 }, ep: 1, desc: '<b>10 damage</b> · <b>×2 vs STAGGERED</b>.' } },

  // ═══ AFTERIMAGE — earning the ECHO on the move.  Repositioning (the 1-EP dodge)
  // is always free; but the fading echo it leaves — the stance you left striking
  // once more, this turn only — is a per-hero unlock.  Turns stance-dancing into
  // an earned tempo tool. ═════════════════════════════════════════════════════════
  { id: 'ash.afterimage',     hero: 'ash',     tier: 1, cost: 4, type: 'afterimage', label: 'Afterimage', desc: 'ON REPOSITION: the stance you left <b>strikes again</b> (free echo, −2 dmg, this turn) — a move OR a slip counts' },
  { id: 'elin.afterimage',    hero: 'elin',    tier: 1, cost: 4, type: 'afterimage', label: 'Afterimage', desc: 'ON REPOSITION: the stance she left <b>strikes again</b> (free echo, −2 dmg, this turn)' },
  { id: 'mira.afterimage',    hero: 'mira',    tier: 1, cost: 4, type: 'afterimage', label: 'Afterimage', desc: 'ON REPOSITION: the stance she left <b>strikes again</b> (free echo, −2 dmg, this turn) — her slips & vanishes count' },
  { id: 'mira.passive.swiftfoot', hero: 'mira', tier: 2, cost: 6, type: 'passive', requires: ['mira.afterimage'], label: 'Swiftfoot', desc: 'PASSIVE: your <b>first MOVE each turn is FREE</b> (no EP) — slip in and out without paying the tempo, and feed the <b>echo</b>', passive: 'mira_swiftfoot' },
  { id: 'cassia.afterimage',  hero: 'cassia',  tier: 1, cost: 4, type: 'afterimage', label: 'Afterimage', desc: 'ON REPOSITION: the stance she left <b>strikes again</b> (free echo, −2 dmg, this turn)' },
  { id: 'branwen.afterimage', hero: 'branwen', tier: 1, cost: 4, type: 'afterimage', label: 'Afterimage', desc: 'ON REPOSITION: the stance she left <b>strikes again</b> (free echo, −2 dmg, this turn) — her backstep leaves a parting arrow' },

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
  { id: 'ash.chain.link',   hero: 'ash', tier: 2, cost: 6,  type: 'chain', requires: ['ash.sig.front'], label: 'Momentum Weave', desc: 'ON CHAIN: a partner’s CHAIN builds <b>+8 MOMENTUM</b> — every woven answer feeds the burst' },
  { id: 'ash.chain.deep',   hero: 'ash', tier: 3, cost: 9,  type: 'chain', requires: ['ash.chain.link'], label: 'Empowered Bond', desc: 'PASSIVE: each woven bond empowers your <b>ALL-OUT</b> harder (<b>+10%</b> per bond) — deepened bonds strike as one' },
  { id: 'ash.chain.rising', hero: 'ash', tier: 3, cost: 9,  type: 'chain', requires: ['ash.chain.link'], label: 'Rising Chain',   desc: 'ON CHAIN: every CHAIN this fight <b>swells the burst container</b> (+3) — the bond keeps building' },
  { id: 'ash.chain.react',  hero: 'ash', tier: 4, cost: 12, type: 'chain', requires: ['ash.chain.deep', 'ash.chain.rising'], label: 'Chain Reaction', desc: 'ON CHAIN: a CHAIN is itself a FINISHER — the partner’s OTHER bond CHAINS in turn, so a full triad <b>cascades</b>' },

  // ═══ HASK — the BLACK MAGE.  Builds ◆ CHARGE on every spell; the MID fork is the
  // OVERLOAD line (build charge → dump it in a nuke).  Three job-paths: OVERLOAD
  // (Meltdown), FROST-CONTROL (Permafrost), and AETHER-SUSTAIN (Elemental Surge).
  { id: 'hask.sig.front', hero: 'hask', tier: 1, cost: 4, type: 'card', gate: { stance: 'front' }, label: 'Ice Spike',   desc: 'COMBO · FRONT: inserts <b>Ice Spike</b> (6 frost · <span class="kw kw-chill">❄</span>) · Frost Touch → <b>Ice Spike</b> → Shatter' },
  { id: 'hask.sig.mid',   hero: 'hask', tier: 1, cost: 5, type: 'card', gate: { stance: 'mid'   }, label: 'Kindle',      desc: 'COMBO · MID: inserts <b>Kindle</b> (5 frost) · Ice Bolt → <b>Kindle</b> → Frostfire' },
  { id: 'hask.sig.back',  hero: 'hask', tier: 1, cost: 4, type: 'card', gate: { stance: 'back'  }, label: 'Frost Lance', desc: 'COMBO · BACK: inserts <b>Frost Lance</b> (6 frost) · Deep Freeze → <b>Frost Lance</b> → Ice Shard' },
  { id: 'hask.afterimage', hero: 'hask', tier: 1, cost: 4, type: 'afterimage', label: 'Afterimage', desc: 'ON REPOSITION: the stance he left <b>strikes again</b> (free echo, −2 dmg, this turn)' },

  { id: 'hask.branch.front', hero: 'hask', tier: 2, cost: 6, type: 'branch', requires: ['hask.sig.front'], label: 'Rime Fork',    desc: 'FORK · FRONT: Frost Touch also opens <b>Rime Blast</b> (4 · <span class="kw kw-chill">❄2</span>) → <b>Glacier</b> (8 · <span class="kw kw-chill">❄1</span>)' },
  { id: 'hask.branch.mid',   hero: 'hask', tier: 2, cost: 6, type: 'branch', requires: ['hask.sig.mid'],   label: 'Overload Fork', desc: 'FORK · MID: Ice Bolt also opens <b>Overcharge</b> (<span class="kw kw-charge">◆ CHARGE 2</span>) → <b>Overload</b> (SPEND <span class="kw kw-charge">◆ CHARGE</span>) — build, then unleash' },
  { id: 'hask.branch.back',  hero: 'hask', tier: 2, cost: 6, type: 'branch', requires: ['hask.sig.back'],  label: 'Cast Fork',     desc: 'FORK · BACK: Deep Freeze also opens <b>Waystone</b> → <b>Starfall</b> — BEGIN a cast that lands <b>◈ 16 frost NEXT turn</b> (moving breaks it)' },
  { id: 'hask.exec', hero: 'hask', tier: 2, cost: 7, type: 'execute', label: 'Executioner', desc: 'ON STAGGER: forge a free <b>Killing Frost</b> — 8 frost · <span class="kw kw-chill">❄2</span> · <b>×2 vs STAGGERED</b>',
    stagger: { name: 'Killing Frost', target: 'enemy', fx: { dmg: 8, lull: 2 }, desc: '<b>8 frost</b> · <span class="kw kw-chill">❄ CHILL 2</span> · <b>×2 vs STAGGERED</b>.' } },
  { id: 'hask.passive.frostbite', hero: 'hask', tier: 2, cost: 6, type: 'passive', requires: ['hask.sig.front'], label: 'Frostbite', desc: 'PASSIVE: <b>+2 dmg</b> to any <span class="kw kw-chill">❄ CHILLED</span> foe — cash the frost', passive: 'hask_frostbite' },
  { id: 'hask.passive.kindling', hero: 'hask', tier: 2, cost: 6, type: 'passive', requires: ['hask.sig.mid'], label: 'Kindling', desc: 'ON CHILL: gain <span class="kw kw-charge">◆ CHARGE 1</span> — frost feeds the fire', passive: 'hask_kindling' },

  { id: 'hask.emergent.icicle', hero: 'hask', tier: 3, cost: 8, type: 'emergent', requires: ['hask.sig.back'], label: 'Ice Age',
    desc: 'EVERY 3RD SPELL: forge a free <b>Icicle</b> (6 frost · <span class="kw kw-chill">❄1</span>) — the cold never stops',
    emergent: { on: 'hit', every: 3, stance: 'FORGED · ICE', flash: 'The cold gathers — <b>Icicle</b> forged.',
      forge: { name: 'Icicle', cost: 0, target: 'enemy', fx: { dmg: 6, lull: 1 }, desc: '<b>6 frost</b> · <span class="kw kw-chill">❄ CHILL 1</span> to any foe.' } } },
  { id: 'hask.passive.conduit', hero: 'hask', tier: 3, cost: 8, type: 'passive', requires: ['hask.passive.kindling'], label: 'Conduit', desc: 'PASSIVE: your <span class="kw kw-charge">◆ CHARGE cap rises to 6</span> — hold more power', passive: 'hask_conduit' },
  { id: 'hask.passive.steady', hero: 'hask', tier: 3, cost: 8, type: 'passive', requires: ['hask.passive.frostbite'], label: 'Steady Cast', desc: 'PASSIVE: moving no longer breaks your channel — <span class="kw kw-charge">◆ CHARGE</span> survives and <b>no MISFIRE</b>. Channel on the move', passive: 'hask_steady' },

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
        if (hero.hp === 0) { hero.downed = true; popupAt(figEl(hero.id), 'DOWN', 'dmg'); }
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
  ash_exploit:  { trigger: 'dmgMod', mod: (o, t) => (o.id === 'ash' && t && t.mark ? 3 : 0) },
  hask_frostbite:  { trigger: 'dmgMod', mod: (o, t) => (o.id === 'hask' && t && t.lull ? 2 : 0) },   // Hask +2 to CHILLED foes
  hask_permafrost: { trigger: 'partyDmgMod', mod: (owner, tgt) => (tgt && tgt.lull ? 3 : 0) },        // CHILLED foes take +3 from EVERY ally
  ash_relentless: { trigger: 'followup', apply: (c) => { if (!S._flags.ashRefund) { S._flags.ashRefund = true; refundEp(1); } } },
  // ELIN — LIGHT: the ward finds the hurt
  elin_ward:    { trigger: 'turnStart', apply: (c) => { if (c.hero.id !== 'elin') return; const t = lowestHpAlly(); if (t) { t.guard += 2; popupAt(figEl(t.id), '⛨ +2', 'guard'); } } },
  // MIRA — EXPOSED: never waste an opening; mark the dying
  mira_opportunist: { trigger: 'dmgMod', mod: (owner, tgt) => (tgt && tgt.mark ? 3 : 0) },
  mira_execute: { trigger: 'postHit', apply: (c) => { const t = c.tgt; if (t && !t.dead && t.hp > 0 && t.hp <= Math.ceil(t.maxHp * 0.30)) { popupAt(figEl(t.uid), '☠ DEATH MARK', 'dmg'); dealToEnemy(t, t.hp, c.hero.def.school, c.hero.id); } } },
  // CASSIA — GUARD: the wall is never caught flat, and only grows
  cassia_vigil: { trigger: 'turnStart', apply: (c) => { if (c.hero.id !== 'cassia') return; c.hero.guard += 2; popupAt(figEl(c.hero.id), '⛨ +2', 'guard'); } },
  cassia_immovable: { trigger: 'keepGuard' },   // read by endTurn's guard-reset
  // BRANWEN — MARK: the hunt is always on, the tally comes due
  branwen_hunter: { trigger: 'dmgMod', mod: (owner, tgt) => (tgt && tgt.mark ? 2 : 0) },
  branwen_opening: { trigger: 'turnStart', apply: (c) => { if (c.hero.id !== 'branwen') return; const e = frontmostEnemy(); if (e) { e.mark = (e.mark || 0) + 1; popupAt(figEl(e.uid), '◎ +1', 'info'); } } },
  branwen_reckoning: { trigger: 'kill', apply: (c) => { if (c.tgt && c.tgt.mark && !S._flags.brRefund) { S._flags.brRefund = true; refundEp(1); } } },
  // ── COMBO-DEPTH capstones (see EMBER_TREE combo-depth block) ──
  mira_frenzy: { trigger: 'postHit', apply: (c) => { if (c.hero.id !== 'mira') return; const t = c.tgt; if (t && t.mark) { c.hero.buffDmg += 2; popupAt(figEl(c.hero.id), '▲ FRENZY +2', 'rally'); } } },
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
// unlocked passive/synergy nodes for a hero matching a trigger
function passiveNodesFor(heroId, trigger) {
  return EMBER_TREE.filter(n => isPassiveNode(n) && n.hero === heroId
    && hasNode(n.id) && PASSIVE_DEFS[n.passive] && PASSIVE_DEFS[n.passive].trigger === trigger);
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
    if (isPassiveNode(n) && n.hero === owner.id && hasNode(n.id)) {
      const d = PASSIVE_DEFS[n.passive];
      if (d && d.trigger === 'dmgMod' && d.mod) bonus += d.mod(owner, tgt) || 0;
    }
  });
  // team synergy: a nodeholder anywhere in the LIVING party lifts everyone's hits
  livingHeroes().forEach(ph => {
    EMBER_TREE.forEach(n => {
      if (isPassiveNode(n) && n.hero === ph.id && hasNode(n.id)) {
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
  { id: 'ash_relentless', hero: 'ash', name: 'Second Wind', icon: '↻', desc: 'Ash’s first <span class="kw kw-rally">FOLLOW-UP</span> each turn refunds <b>1 EP</b>.',
    trigger: 'followup', apply: () => { if (!S._flags.boonAsh) { S._flags.boonAsh = true; refundEp(1); boonProc('ash', 'ash_relentless'); } } },
  // ELIN — light
  { id: 'elin_grace', hero: 'elin', name: 'Elin’s Grace', icon: '✚', desc: 'When Elin heals or wards an ally, they also gain <span class="kw kw-guard">⛨ 1</span>.',
    trigger: 'support', apply: (c) => { if (c.receiver && !c.receiver.downed) { c.receiver.guard += 1; popupAt(figEl(c.receiver.id), '⛨ +1', 'guard'); boonProc('elin', 'elin_grace'); } } },
  { id: 'elin_warm', hero: 'elin', name: 'Warm Hands', icon: '❂', desc: 'Elin’s healing cards restore <b>+2</b>.',
    card: (c) => { if (c.owner === 'elin' && c.fx && c.fx.heal) c.fx.heal += 2; } },
  { id: 'elin_dawn', hero: 'elin', name: 'Dawnward', icon: '☀', desc: 'At the start of your turn, your most-wounded ally heals <span class="kw kw-heal">✚ 2</span>.',
    trigger: 'turnStart', apply: (c) => { if (c.hero.id !== 'elin') return; const t = lowestHpAlly(); if (t && t.hp < t.maxHp) { t.hp = Math.min(t.maxHp, t.hp + 2); popupAt(figEl(t.id), '✚2', 'heal'); boonProc('elin', 'elin_dawn'); } } },
  // MIRA — exposed / execute
  { id: 'mira_scent', hero: 'mira', name: 'Bloodscent', icon: '◎', desc: 'Mira deals <b>+2</b> to any <span class="kw kw-exposed">◎ EXPOSED</span> foe.',
    trigger: 'dmgMod', mod: (o, t) => (o.id === 'mira' && t && t.mark ? 2 : 0) },
  { id: 'mira_patience', hero: 'mira', name: 'Killer’s Patience', icon: '☠', desc: 'The first <span class="kw kw-exposed">◎ EXPOSED</span> foe Mira kills each turn refunds <b>1 EP</b>.',
    trigger: 'kill', apply: (c) => { if (c.tgt && c.tgt.mark && !S._flags.boonMira) { S._flags.boonMira = true; refundEp(1); boonProc('mira', 'mira_patience'); } } },
  { id: 'mira_fang', hero: 'mira', name: 'Twin Fang', icon: '⚔', desc: 'Mira’s <b>signature</b> attacks strike for <b>+2</b>.',
    card: (c) => { if (c.owner === 'mira' && c.kind === 'sig' && c.fx && c.fx.dmg) c.fx.dmg += 2; } },
  // CASSIA — guard
  { id: 'cassia_vigil', hero: 'cassia', name: 'Bulwark Heart', icon: '⛨', desc: 'At the start of your turn, Cassia braces for <span class="kw kw-guard">⛨ 2</span>.',
    trigger: 'turnStart', apply: (c) => { if (c.hero.id !== 'cassia') return; c.hero.guard += 2; popupAt(figEl(c.hero.id), '⛨ +2', 'guard'); boonProc('cassia', 'cassia_vigil', { quiet: true }); } },
  { id: 'cassia_iron', hero: 'cassia', name: 'Ironclad', icon: '◆', desc: 'Cassia’s guard-granting cards give <span class="kw kw-guard">⛨ +2</span>.',
    card: (c) => { if (c.owner === 'cassia' && c.fx && c.fx.guard) c.fx.guard += 2; } },
  { id: 'cassia_reprisal', hero: 'cassia', name: 'Reprisal', icon: '↺', desc: 'While Cassia holds <span class="kw kw-guard">⛨ guard</span>, her strikes deal <b>+3</b>.',
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
    trigger: 'turnStart', apply: (c) => { if (c.hero.id !== 'cassia') return; const t = lowestHpAlly(); if (t && !t.downed) { t.guard += 2; if (t.hp < t.maxHp) t.hp = Math.min(t.maxHp, t.hp + 2); popupAt(figEl(t.id), '⛨✚', 'guard'); boonProc('elin', 'duo_elincassia', { quiet: true }); } } },
  { id: 'duo_haskcassia', duo: true, hero: 'hask', heroes: ['hask', 'cassia'], name: 'Frostwall', icon: '❄', desc: '<b>Hask + Cassia:</b> <span class="kw kw-chill">❄ CHILLED</span> foes take <b>+2</b> from EVERY ally — the cold behind the wall.',
    trigger: 'dmgMod', mod: (o, t) => (t && t.lull ? 2 : 0) },
  { id: 'duo_branwenmira', duo: true, hero: 'branwen', heroes: ['branwen', 'mira'], name: 'Killer’s Pact', icon: '☠', desc: '<b>Branwen + Mira:</b> the FIRST <span class="kw kw-exposed">◎ EXPOSED</span> foe felled each turn refunds <b>2 EP</b>.',
    trigger: 'kill', apply: (c) => { if (c.tgt && c.tgt.mark && !S._flags.boonDuoBM) { S._flags.boonDuoBM = true; refundEp(2); boonProc('branwen', 'duo_branwenmira'); } } },
  // ── SCALING BOON (Hades build-up) — grows across the whole descent ──
  { id: 'scale_tally', hero: 'mira', name: 'Reaper’s Tally', icon: '☠', desc: 'Each <span class="kw kw-exposed">◎ EXPOSED</span> foe you fell adds <b>+1</b> (max 6) to your <b>signature</b> attacks — <b>for the whole descent</b>.',
    trigger: 'kill', apply: (c) => { if (c.tgt && c.tgt.mark) { bumpBoonStack('scale_tally', 6); boonProc('mira', 'scale_tally', { quiet: true }); } },
    card: (c) => { if (c.kind === 'sig' && c.fx && c.fx.dmg) c.fx.dmg += boonStack('scale_tally'); } },
  // ── RISK / REWARD (Slay-the-Spire relic tension) — power with a real cost ──
  { id: 'curse_glassedge', hero: 'mira', rare: true, name: 'Glass Edge', icon: '⚡', desc: '<b>The whole party strikes +3</b> — but takes <b>+2</b> from every hit. Live fast.',
    card: (c) => { if (c.fx && c.fx.dmg) c.fx.dmg += 3; }, trigger: 'incoming', mod: () => 2 },
  { id: 'curse_bloodrush', hero: 'ash', rare: true, name: 'Blood Rush', icon: '⇄', desc: 'Start each turn with <b>+2 EP</b> — but the most-wounded ally <b>bleeds 3 HP</b>. Spend it or waste it.',
    trigger: 'turnStart', apply: (c) => { if (c.hero.id !== 'ash' || S._flags.boonBlood) return; S._flags.boonBlood = true; S.ep = Math.min(S.maxEp, S.ep + 2); pulseEp(); const t = lowestHpAlly(); if (t && !t.downed) { t.hp = Math.max(1, t.hp - 3); popupAt(figEl(t.id), '−3', 'dmg'); } boonProc('ash', 'curse_bloodrush'); } },
  // ── TRIO BOONS (Hades "you brought the exact team") — only when a SPECIFIC three
  //    walk together.  The rarest, most build-defining gifts. ──
  { id: 'trio_phalanx', trio: true, hero: 'cassia', heroes: ['ash', 'cassia', 'elin'], name: 'The Phalanx', icon: '⛨', desc: '<b>Ash · Cassia · Elin:</b> every fight OPENS with the whole party at <span class="kw kw-guard">⛨ 3</span> and <span class="kw kw-rally">▲ RALLY 2</span> — the shield-wall marches.',
    trigger: 'turnStart', apply: (c) => { if (c.hero.id !== 'cassia' || S.turn !== 1 || S._flags.boonPhalanx) return; S._flags.boonPhalanx = true; livingHeroes().forEach(h => { h.guard += 3; h.buffDmg += 2; popupAt(figEl(h.id), '⛨3 ▲2', 'guard'); }); boonProc('cassia', 'trio_phalanx'); } },
  { id: 'trio_killwind', trio: true, hero: 'mira', heroes: ['ash', 'mira', 'branwen'], name: 'The Killing Wind', icon: '☠', desc: '<b>Ash · Mira · Branwen:</b> EVERY ally strikes <b>+4</b> to <span class="kw kw-exposed">◎ EXPOSED</span> foes — three blades, one hunt.',
    trigger: 'dmgMod', mod: (o, t) => (t && t.mark ? 4 : 0) },
  { id: 'trio_longwinter', trio: true, hero: 'hask', heroes: ['elin', 'cassia', 'hask'], name: 'The Long Winter', icon: '❄', desc: '<b>Elin · Cassia · Hask:</b> <span class="kw kw-chill">❄ CHILLED</span> foes take <b>+3</b> from EVERY ally — the wall, the light, and the deep cold.',
    trigger: 'dmgMod', mod: (o, t) => (t && t.lull ? 3 : 0) },
  { id: 'trio_bloodmercy', trio: true, hero: 'elin', heroes: ['elin', 'mira', 'branwen'], name: 'Blood & Mercy', icon: '✚', desc: '<b>Elin · Mira · Branwen:</b> the FIRST <span class="kw kw-exposed">◎ EXPOSED</span> foe felled each turn <b>heals the whole party 3</b>.',
    trigger: 'kill', apply: (c) => { if (c.tgt && c.tgt.mark && !S._flags.trioBloodMercy) { S._flags.trioBloodMercy = true; livingHeroes().forEach(h => { if (h.hp < h.maxHp) { h.hp = Math.min(h.maxHp, h.hp + 3); popupAt(figEl(h.id), '✚3', 'heal'); } }); boonProc('elin', 'trio_bloodmercy'); } } },
  // ── MORE DUO GIFTS — filling out the roster's pairings ──
  { id: 'duo_ashelin', duo: true, hero: 'elin', heroes: ['ash', 'elin'], name: 'Second Breath', icon: '✚', desc: '<b>Ash + Elin:</b> when Elin heals or wards an ally, that ally also gains <span class="kw kw-rally">▲ RALLY 1</span> — the mend feeds the next blow.',
    trigger: 'support', apply: (c) => { if (c.receiver && !c.receiver.downed) { c.receiver.buffDmg += 1; popupAt(figEl(c.receiver.id), '▲ +1', 'rally'); boonProc('elin', 'duo_ashelin', { quiet: true }); } } },
  { id: 'duo_mirahask', duo: true, hero: 'hask', heroes: ['mira', 'hask'], name: 'Killing Frost', icon: '❄', desc: '<b>Mira + Hask:</b> both strike <b>+2</b> to any <span class="kw kw-chill">❄ CHILLED</span> foe — the shiver before the knife.',
    trigger: 'dmgMod', mod: (o, t) => ((o.id === 'mira' || o.id === 'hask') && t && t.lull ? 2 : 0) },
  { id: 'duo_cassiabranwen', duo: true, hero: 'branwen', heroes: ['cassia', 'branwen'], name: 'Overwatch', icon: '◎', desc: '<b>Cassia + Branwen:</b> while Cassia holds <span class="kw kw-guard">⛨ guard</span>, Branwen strikes for <b>+3</b> — cover fire from behind the wall.',
    trigger: 'dmgMod', mod: (o) => { if (o.id !== 'branwen') return 0; const cas = livingHeroes().find(h => h.id === 'cassia'); return (cas && cas.guard > 0) ? 3 : 0; } },
  { id: 'duo_ashcassia', duo: true, hero: 'cassia', heroes: ['ash', 'cassia'], name: 'Vanguard’s Oath', icon: '⛨', desc: '<b>Ash + Cassia:</b> each of Ash’s <span class="kw kw-rally">FOLLOW-UPS</span> braces him for <span class="kw kw-guard">⛨ 2</span> — the wall’s discipline in the skirmish.',
    trigger: 'followup', apply: () => { const ash = livingHeroes().find(h => h.id === 'ash'); if (ash) { ash.guard += 2; popupAt(figEl('ash'), '⛨ +2', 'guard'); boonProc('cassia', 'duo_ashcassia', { quiet: true }); } } },
  { id: 'duo_elinhask', duo: true, hero: 'hask', heroes: ['elin', 'hask'], name: 'Warmth in Winter', icon: '◆', desc: '<b>Elin + Hask:</b> when Elin heals or wards an ally, Hask gathers <span class="kw kw-charge">◆ CHARGE 1</span> — her warmth stokes his cold fire.',
    trigger: 'support', apply: () => { const hask = livingHeroes().find(h => h.id === 'hask'); if (hask) { hask.charge = Math.min(chargeCap(hask), (hask.charge || 0) + 1); popupAt(figEl('hask'), '◆ ' + hask.charge, 'info'); boonProc('hask', 'duo_elinhask', { quiet: true }); } } },
  { id: 'duo_branwenhask', duo: true, hero: 'branwen', heroes: ['branwen', 'hask'], name: 'Frost & Feather', icon: '❄', desc: '<b>Branwen + Hask:</b> a <span class="kw kw-chill">❄ CHILLED</span> foe is also treated as <span class="kw kw-exposed">◎ EXPOSED</span> — cold marks the target for the arrow.',
    trigger: 'dmgMod', mod: (o, t) => (t && t.lull && !t.mark ? 2 : 0) },
];
const BOON_BY_ID = {}; BOONS.forEach(b => { BOON_BY_ID[b.id] = b; });
// BOON CODEX — which gifts you've ever COLLECTED, persisted across runs so the
// Journal fills in as you discover the roster's combos.
const BOON_CODEX_KEY = 'kizuna2_1.boonCodex';
function loadBoonCodex() { try { const a = JSON.parse(localStorage.getItem(BOON_CODEX_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (_) { return []; } }
function markBoonCollected(id) { try { const s = new Set(loadBoonCodex()); if (!s.has(id)) { s.add(id); localStorage.setItem(BOON_CODEX_KEY, JSON.stringify([...s])); } } catch (_) {} }
// BESTIARY CODEX — which foes you've faced, persisted across runs so the Journal's
// bestiary fills in as you meet the dark.  Marked when an enemy spawns into a fight.
const BESTIARY_KEY = 'kizuna2_1.bestiary';
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
  return RUN.boons.map(id => BOON_BY_ID[id]).filter(b => boonHeroesOk(b, party));
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
  const boons = runBoons();
  let html = boons.map(b => `<span class="cb-boon" data-boon="${b.id}" style="--tint:${HEROES[b.hero].tint}" title="${HEROES[b.hero].name}’s ${b.name} — ${b.desc.replace(/<[^>]+>/g, '')}">${b.icon}</span>`).join('');
  // active BOND WEAVES this fight — a distinct gold chip per woven pair
  const weaves = wovenPairKeys();
  html += weaves.map(key => {
    const [a, b] = key.split('|'); const w = BOND_WEAVE[duetClassKey(a, b)]; if (!w) return '';
    return `<span class="cb-weave" data-weave="${key}" title="✦ ${w.name} — ${HEROES[a].name} &amp; ${HEROES[b].name} are bound: play a FINISHER with one and the other gets a free CHAIN card (once per turn).">${w.icon || '✦'}</span>`;
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
const STANCE = {
  front: { name: 'Blade Stance', tag: 'AGGRESSIVE' },
  mid:   { name: 'Flow Stance',  tag: 'BALANCED' },
  back:  { name: 'Wind Stance',  tag: 'RANGED' },
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
    school: 'light', tempo: 'steady', name: 'ELIN', cls: 'Cleric', archetype: 'Mender', identity: 'Keeps the line standing — wards and heals.', tint: 'var(--elin-tint)', maxHp: 24,
    cards: {
      front: {
        core: { name: 'Smite',         cost: 1, target: 'frontmost', fx: { dmg: 4 },            desc: '4 holy damage to the nearest enemy.' },
        sig:  { name: 'Radiant Ward',  cost: 2, target: 'allies',    fx: { guard: 3 },          desc: 'Every ally gains 3 guard.' },
      },
      mid: {
        core: { name: 'Mend',          cost: 1, target: 'ally',      fx: { heal: 5 },           desc: 'Heal an ally 5.' },
        sig:  { name: 'Sanctuary',     cost: 2, target: 'ally',      fx: { heal: 4, guard: 4 }, desc: 'Heal an ally 4 · they gain 4 guard.' },
      },
      back: {
        core: { name: 'Distant Prayer',cost: 1, target: 'allies',    fx: { heal: 2 },           desc: 'Heal every ally 2.' },
        sig:  { name: 'Benediction',   cost: 2, target: 'ally',      fx: { heal: 8 },           desc: 'Heal an ally 8.' },
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
        core: { name: 'Cover', cost: 1, target: 'ally', fx: { guard: 4 }, desc: 'An ally gains 4 guard.' },
        sig:  { name: 'Aegis', cost: 2, target: 'ally', fx: { guard: 7 }, desc: 'Guard an ally: <span class="kw kw-guard">⛨ 7</span>.' },
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
      mend:      { name: 'Mend',           cost: 1, target: 'ally', fx: { heal: 5 },            stance: 'OPENER · MEND',    desc: 'Heal an ally 5.', next: [{ key: 'renew', gateNot: 'elin.sig.mid' }, { key: 'sanctuary', gate: 'elin.sig.mid' }, { key: 'cleanse', gate: 'elin.branch.mid' }] },
      sanctuary: { name: 'Sanctuary',      cost: 0, target: 'ally', fx: { heal: 4, guard: 4 },  stance: 'COMBO · MEND',   desc: 'Heal an ally 4 · <span class="kw kw-guard">⛨ 4</span>.', next: ['renew'] },
      renew:     { name: 'Renew',          cost: 0, target: 'ally', fx: { heal: 8 },            stance: 'FINISHER · MEND',  desc: 'Heal an ally 8.' },
      cleanse:   { name: 'Cleanse',        cost: 0, target: 'ally', fx: { heal: 3, guard: 3 },  stance: 'COMBO · WARD',   desc: 'Heal an ally 3 · <span class="kw kw-guard">⛨ 3</span>.', next: ['wardingcircle'] },
      wardingcircle:{ name: 'Warding Circle',cost: 0, target: 'allies', fx: { guard: 3 },       stance: 'FINISHER · WARD',  desc: 'A ring of light — every ally gains <span class="kw kw-guard">⛨ 3</span>.' },
    } },
    back: { opener: 'distantprayer', cards: {
      distantprayer:{ name: 'Distant Prayer', cost: 1, target: 'allies', fx: { heal: 2 },        stance: 'OPENER · BLESS',   desc: 'Heal every ally 2.', next: [{ key: 'benediction', gateNot: 'elin.sig.back' }, { key: 'blessing', gate: 'elin.sig.back' }, { key: 'deepmercy', gate: 'elin.branch.back' }] },
      blessing:  { name: 'Blessing',        cost: 0, target: 'ally',   fx: { heal: 3, buffDmg: 2 }, stance: 'COMBO · BLESS',  desc: 'Heal an ally <span class="kw kw-heal">✚ 3</span> · their next strike deals <span class="kw kw-rally">▲ +2</span>.', next: ['benediction'] },
      benediction:{ name: 'Benediction',    cost: 0, target: 'ally',   fx: { heal: 8 },          stance: 'FINISHER · BLESS', desc: 'Heal an ally 8.' },
      deepmercy: { name: 'Deep Mercy',      cost: 0, target: 'ally',   fx: { heal: 8 },          stance: 'COMBO · MERCY',  desc: 'Heal an ally 8.', next: ['dawnlight'] },
      dawnlight: { name: 'Dawnlight',       cost: 0, target: 'allies', fx: { heal: 5 },          stance: 'FINISHER · MERCY', desc: 'Dawn breaks — heal every ally 5.' },
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
      quickthrow: { name: 'Quick Throw',   cost: 0, target: 'enemy', fx: { dmg: 4 },          stance: 'COMBO · MARK',desc: '4 damage.', next: ['execute'] },
      execute:    { name: 'Execute',       cost: 0, target: 'enemy', fx: { dmg: 10 },         stance: 'FINISHER · MARK',desc: '10 damage.' },
      markblade:  { name: 'Mark',          cost: 0, target: 'enemy', fx: { dmg: 2, mark: 3 }, stance: 'COMBO · HUNT',desc: '2 damage · <span class="kw kw-exposed">◎ EXPOSED 3</span>.', next: ['backkillingmark'] },
      backkillingmark:{ name: 'Killing Mark',cost: 0, target: 'enemy', fx: { dmg: 3, mark: 5 },stance: 'FINISHER · HUNT',desc: '3 damage · <span class="kw kw-exposed">◎ EXPOSED 5</span>.' },
    } },
  },

  cassia: {
    front: { opener: 'shieldbash', cards: {
      shieldbash: { name: 'Shield Bash', cost: 1, target: 'frontmost', fx: { dmg: 4, guard: 2 }, stance: 'OPENER · WALL', desc: '4 damage · <span class="kw kw-guard">⛨ 2</span>.', next: [{ key: 'bulwark', gateNot: 'cassia.sig.front' }, { key: 'brace', gate: 'cassia.sig.front' }, { key: 'provoke', gate: 'cassia.branch.front' }] },
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
  if (kind === 'opener') {                          // openers obey the tempo economy; forged steps are always free
    if (tempo === 'swift' && cost > 1) cost -= 1;
    if (tempo === 'heavy') cost += 1;
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
function mkChainOpener(h, rot) {
  const c = mkRotCard(h, h.row, rot.cards[rot.opener], 'opener');
  c.spent = S.used.has(h.id + ':opener');
  return c;
}
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
function resolveChainPlay(card) {
  if (!card || !card.chain) return;
  if (!card.chainNext || !card.chainNext.length) return;
  const h = S.heroes.find(x => x.id === card.owner);
  if (!h || h.downed) return;
  const rot = ROTATIONS[card.owner] && ROTATIONS[card.owner][card.chainStance];
  if (!rot) return;
  const group = ++S._chainGroup;
  const forged = [], uids = [];
  // a next entry may be gated: {key, gate} forges only when the node is OWNED;
  // {key, gateNot} forges only when it's NOT owned.  This is how the tree reshapes
  // the chain: base = opener→finisher (gateNot the builder node); the builder node
  // inserts a step (gate the builder, gateNot-hides the direct finisher); the fork
  // node adds the alt line (gate the branch node).  A bare string always forges.
  card.chainNext.forEach(n => {
    const key = (typeof n === 'string') ? n : n.key;
    if (n && n.gate && !hasNode(n.gate)) return;
    if (n && n.gateNot && hasNode(n.gateNot)) return;
    const def = rot.cards[key];
    const c = def && genChainStep(h, card.chainStance, def, group);
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
}
// stance change abandons an in-progress rotation (forged steps clear; the opener
// of the NEW stance returns) — repositioning mid-chain is a real cost.
function purgeChain(heroId) { S.tempCards = S.tempCards.filter(t => !(t.chain && t.owner === heroId)); }

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
    weak: 'song', name: 'THE SUNDERING', maxHp: 152, boss: true, floorBoss: true, art: 'echoknight', aura: 'sunder',
    attacksPerRound: 2,
    intents: [
      { name: 'Cut the Thread', dmg: 6, row: 'front', sever: 1, attackArt: 'slash', parry: { kind: 'seq', notes: [{ t: 'swipe', arc: 'arcR' }, { t: 'tap' }] } },
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
    name: 'THE HOLLOW CHORUS', weak: 'song', boss: true, floorBoss: true, megaBoss: true, art: 'echoknight',
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
      { key: 'unmaking', name: 'THE UNMAKING', epithet: 'IT FEEDS ON THE BOND', aura: 'sunder', weak: 'song', maxHp: 190, eye: '#8fe0d0', roar: 'maw',
        attacksPerRound: 5, parrySpeed: 0.68,   // stage 3 — the climax: five fast strikes to read
        quote: 'You came down together. I keep every echo you leave behind.',
        intents: [
          { name: 'Cut the Thread', dmg: 7, row: 'front', sever: 1, attackArt: 'slash', parry: { kind: 'seq', notes: [{ t: 'swipe', arc: 'arcR' }, { t: 'tap' }] } },
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
// A partner's ASSIST is flavored by WHO they are (their archetype) — so it reads
// as that character joining the fight.  Returns a short verb for the callout.
// `atk` = the ally who just attacked, `tgt` = the enemy they hit.
// Offensive assists RETARGET to any living foe if the original died, and support
// assists FALL BACK to a ward, so a bond assist NEVER fires a triumphant callout
// for +0 effect.  `foe()` returns a hittable enemy or null.
const BOND_ASSIST = {
  ash:     (p, tgt) => { const t = (tgt && !tgt.dead) ? tgt : frontmostEnemy(); if (t) { dealToEnemy(t, 6, 'blade', p.id); popupAt(figEl(t.uid), '⚔ 6', 'dmg'); } return 'a cutting strike'; },
  mira:    (p, tgt) => { const t = (tgt && !tgt.dead) ? tgt : frontmostEnemy(); if (t) { t.mark = (t.mark || 0) + 2; dealToEnemy(t, 5, 'blade', p.id); popupAt(figEl(t.uid), '◎+2 ✕5', 'dmg'); } return 'a shadow strike'; },
  elin:    (p, tgt, atkId) => { const w = lowestHpAlly(); if (w && !w.downed && w.hp < w.maxHp) { w.hp = Math.min(w.maxHp, w.hp + 5); w.chill = 0; w.exposed = 0; popupAt(figEl(w.id), '♡ ✚5', 'heal'); if (SFX.heal) SFX.heal(); return 'a mending light'; } const a = S.heroes.find(h => h.id === atkId) || p; a.guard += 4; popupAt(figEl(a.id), '⛨ +4', 'guard'); return 'a warding light'; },
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
// OFFER A BOND FOLLOW-UP — the legible weave beat.  When a WOVEN hero plays a
// FINISHER, their partner's follow-up becomes a PLAYABLE option: a free Follow-Up
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
    if (S.tempCards.some(c => c.fx && c.fx.bondFollow && c.fx.bondFollow.key === key)) return;   // already offered
    S._assistedPairs.add(key);
    genTempCard({ kind: 'temp', follow: partnerId, owner: partnerId, ownerName: HEROES[partnerId].name,
      tint: 'var(--gold-bright)', stance: '✦ CHAIN',
      name: w.name, cost: 0, target: 'none',   // titled by the WEAVE so two offered chains never share a name
      fx: { bondFollow: { partnerId, attackerId, key, weave: w.name } },
      desc: `<b>${HEROES[partnerId].name}</b> chains off <b>${HEROES[attackerId].name}</b>. <i>Free.</i>` });
    try { sparkThread(a, b); } catch (_) {}
    weaveProc(duetClassKey(a, b));
    offered.push(HEROES[partnerId].name);
  });
  // ONE narrator for the whole offer — a full triad offers two chains at once, and
  // separate flashNarrator calls would overwrite each other (only the last showed).
  if (offered.length) {
    const who = offered.length === 1 ? offered[0] : offered.slice(0, -1).join(', ') + ' & ' + offered.slice(-1);
    flashNarrator('✦ CHAIN — ' + who + ' can answer ' + HEROES[attackerId].name + '’s finisher!');
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
  cassia:  { url: '../art/splash-cassia.png',  pos: '62% 20%' },
  hask:    { url: '../art/splash-hask.png',     pos: '64% 24%' },
  branwen: { url: '../art/splash-branwen.png',  pos: '58% 18%' },
  elin:    { url: '../art/splash-elin.png',     pos: '70% 26%' },
  mira:    { url: '../art/splash-mira.png',      pos: '68% 26%' },
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
  await sleep(hold || 1150);
  el.classList.remove('fc-show'); el.classList.add('fc-out');
  await sleep(320);
  el.classList.remove('fc-out'); el.innerHTML = '';
}
// The CHAIN cut-in — a woven partner steps in over a thread to the ally they answer.
async function followCutIn(partnerId, attackerId, weave) {
  try { sparkThread(attackerId, partnerId); } catch (_) {}
  await heroCutIn(partnerId, '✦ CHAIN', HEROES[partnerId].name, (weave || '') + ' · answers ' + HEROES[attackerId].name, 1100);
}
// Resolve a played Follow-Up card: a portrait cut-in showcases the partner, they
// LUNGE in, and perform their archetype's assist.
async function resolveBondFollow(bf) {
  const partner = S.heroes.find(h => h.id === bf.partnerId);
  if (!partner || partner.downed) return;
  const tgt = frontmostEnemy();
  await followCutIn(bf.partnerId, bf.attackerId, bf.weave);   // showcase WHO follows up
  try { if (typeof lungeFig === 'function') lungeFig(figEl(bf.partnerId)); popupAt(figEl(bf.partnerId), '✦ CHAIN', 'boon'); stageShake('sm'); } catch (_) {}
  await sleep(200);
  let verb = ''; try { verb = BOND_ASSIST[bf.partnerId](partner, tgt, bf.attackerId) || ''; } catch (_) {}
  // The cut-in already announced WHO answers WHOM; the narrator just adds the effect.
  flashNarrator('✦ ' + (bf.weave || 'BOND') + (verb ? ' — ' + HEROES[bf.partnerId].name + ' answers with ' + verb + '.' : '.'));
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
const FLOW = [
  { type: 'story', chapter: 1, title: 'ONE SURVIVOR', eyebrow: 'CHAPTER 1', lines: [
    { text: 'The first thing you understand is that everyone else is gone.' },
    { spk: 'ASH', text: '…then I carry it alone.' },
    { text: 'You are <b>Ash</b>. One blade, three ways to hold it — your <b>row is your stance</b>: Front cuts, Mid flows, Back strikes from the wind. <b>Drag Ash himself</b> between rows and his cards rewrite to match.' },
    { text: 'You begin lean: a <b>basic strike</b> in each stance, and <b>one opening signature</b> already lit. Everything deeper — new arts, upgrades, ruinous finishers — you’ll <b>earn on the way down</b>.' },
  ]},
  { type: 'fight', chapter: 1, heroes: ['ash'], enemies: ['husk'],
    narrator: 'Tap or drag a card to strike. DRAG ASH to change stance (1 EP). When the husk winds up, TAP in time to turn the blow.' },
  { type: 'story', chapter: 1, title: 'THE STANCES', eyebrow: 'CHAPTER 1', lines: [
    { text: 'Every foe <b>telegraphs</b> before it strikes: the damage it will deal, and the <b>row</b> it will hit.' },
    { spk: 'ASH', text: 'So I answer one of two ways — not be there, or meet it.' },
    { text: '<b>Drag to an empty row</b> to dodge the blow, or hold your ground and <b>PARRY</b> it — tap each note the instant its ring glows gold. A clean parry blunts the strike and feeds your <b>momentum</b>.' },
  ]},
  { type: 'fight', chapter: 1, heroes: ['ash'], enemies: ['husk', 'wraith'],
    narrator: 'Dodge the row they call — or stand and PARRY it. The row they name is the row they strike.' },
  { type: 'story', chapter: 2, title: 'ELIN', eyebrow: 'CHAPTER 2 · TWO', lines: [
    { text: 'A light in the ash-fog — a healer, kneeling over what’s left of her order.' },
    { spk: 'ELIN', text: 'You’re bleeding. Stand still.' },
    { spk: 'ASH', text: '…you’re coming with me.' },
    { text: 'Two now. When one of you <b>helps</b> the other — a heal, a guard, a follow-up on a wounded foe — a <b>thread</b> forms between them. The threads are the whole point. Watch.' },
  ]},
  { type: 'fight', chapter: 2, heroes: ['ash', 'elin'], enemies: ['cultist', 'husk'],
    narrator: 'Have Elin heal Ash — a thread kindles between them. Fight side by side and it deepens.' },
  { type: 'story', chapter: 3, title: 'MIRA', eyebrow: 'CHAPTER 3 · THREE', lines: [
    { text: 'A blade rests at your throat before you hear a single step. Then, slowly, it lowers.' },
    { spk: 'MIRA', text: 'You came through the dark loud as a funeral. …Lucky I only kill what I mean to. Move.' },
    { text: 'Three now — a triangle. A kindled pair <b>weaves</b>: play a <b>FINISHER</b> with one and their partner gets a free <b>CHAIN</b> to play. Bond all three and your bonds <b>crown your ALL-OUT</b> with a <b>TRIAD FINALE</b> — one grand blow only your exact three can land.' },
  ]},
  { type: 'fight', chapter: 3, heroes: ['ash', 'elin', 'mira'], enemies: ['echoknight', 'cultist'],
    narrator: 'Help one another until all three threads hold. Chain hits &amp; parries to fill BURST, then unleash your ALL-OUT.' },
  { type: 'story', chapter: 3, title: 'THE ROAD DOWN', eyebrow: 'THE DESCENT', lines: [
    { text: 'The tutorial road ends at a cliff’s edge. Below waits the <b>Descent</b> — and the Abyss beneath it.' },
    { text: 'Down here your steel finds its <b>rhythm</b>. Each hero shows a single <b>opener</b> — play it and it <b>flows into a finisher</b>. That short combo is all you start with; how it <b>grows</b> is up to you.' },
    { spk: 'ASH', text: 'A strike and a killing blow. Everything between them, I earn.' },
    { text: 'The dead give up <b>✦ embers</b>. Between fights, open your party’s <b>Ember Tree</b> and spend them — a <b>combo</b> node <b>inserts a middle strike</b> (opener → combo → finisher), and a <b>fork</b> node opens a <b>second line</b> off the opener (play it, pick one path, the other burns away). Grow each rotation one earned choice at a time. Only for the heroes you field, and only for <b>this descent</b>.' },
    { text: 'Every trio you form <b>fights differently</b> — their bonds, weaves and finale are all their own — so <b>who walks beside whom is your build</b>. And when a party falls, the Abyss remembers where — your next descent finds their ashes still warm.' },
    { spk: 'MIRA', text: 'Down, then. Stay close. …That’s not sentiment. It’s tactics.' },
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
const STARTERS_KEY = 'kizuna2_1.starters';
const LAST_STARTER_KEY = 'kizuna2_1.lastStarter';   // whose key-art greets you on the title
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
function _combatEnemies(level) {
  const pool = level <= 2 ? COMBAT_POOL.early : level <= 4 ? COMBAT_POOL.mid : COMBAT_POOL.deep;
  // The level-1 funnel is a single foe — a gentle opener for a solo starter.
  const count = level <= 1 ? 1 : level <= 2 ? 2 : (Math.random() < 0.45 ? 3 : 2);
  const out = []; for (let i = 0; i < count; i++) out.push(_pick(pool)); return out;
}
function _eliteEnemies(level) {
  // The elite fight is anchored by a mini-boss — the ECHO REVENANT with its
  // boss-style cascades — flanked by a support caster / adds so it plays like a
  // real set-piece, not just a bigger mob.
  const anchor = 'revenant';
  const rest = _shuffle(['cantor', 'cultist', 'wraith', 'drone']).slice(0, level >= 5 ? 2 : 1);
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
  const pending = _shuffle(STARTER_POOL.filter(id => !roster.includes(id)));
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
    if (level === 1) types = ['fight'];
    else if (level === numLevels) types = ['boss'];
    else if (level === numLevels - 1) types = ['camp'];
    else types = _stretchTypes(level);
    if (recruitAtLevel[level]) { types = types.slice(0, 2); types.splice(_rand(types.length + 1), 0, 'recruit'); }   // random row, not always the bottom
    const ids = [];
    types.forEach(type => {
      const node = { id: idc, level, col: level, type, next: [] };
      if (type === 'fight')        { node.enemies = _combatEnemies(level); node.label = lbl.fight(); }
      else if (type === 'elite')   { node.enemies = _eliteEnemies(level); node.elite = true; node.label = lbl.elite(); }
      else if (type === 'event')   { node.eventId = eventQ[eventI++ % eventQ.length]; node.label = lbl.event(); }
      else if (type === 'camp')    { node.label = lbl.camp(); }
      else if (type === 'recruit') { node.hero = recruitAtLevel[level]; node.label = RECRUIT_NODE_LABELS[node.hero] || 'A NEW THREAD'; }
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
function mapAll() { return (RUN && RUN.map) || []; }
function mapNode(id) { return mapAll()[id]; }

// EVENT nodes — a crossroads with two choices, each trading in the run's real
// resources (party HP, bonds, a one-fight edge).  Kept small and readable; the
// fx run at click-time so they close over the current RUN.
function _healParty(x) { RUN.roster.forEach(id => { RUN.hp[id] = Math.min(HEROES[id].maxHp, (RUN.hp[id] ?? HEROES[id].maxHp) + x); }); }
function _weakestActiveBondKey() {
  const ids = RUN.active.slice(); let best = null, low = Infinity;
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const k = pairKey(ids[i], ids[j]); const p = bondPts(k);
    if (p < low) { low = p; best = k; }
  }
  return best;
}
function _bumpWeakestBond() { const k = _weakestActiveBondKey(); if (k) { RUN.bonds = RUN.bonds || {}; RUN.bonds[k] = (RUN.bonds[k] || 0) + 1; } return k; }
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
const PROGRESS_KEY = 'kizuna2_1.flow';
const RUN_KEY = 'kizuna2_1.run';
const ABYSS_KEY = 'kizuna2_1.abyss';   // nodeId -> memory of a fallen descent
function loadAbyss() { try { return JSON.parse(localStorage.getItem(ABYSS_KEY) || '{}'); } catch (_) { return {}; } }
function saveAbyss(a) { try { localStorage.setItem(ABYSS_KEY, JSON.stringify(a)); } catch (_) {} }
// Vow ranks — every time a class-triangle actually speaks its vow, the vow
// deepens.  PERSISTS ACROSS RUNS (and deaths): the trio remembers how to
// fight together.  1 use -> rank II, 3 uses -> rank III (+2 to the vow's
// numeric stages per rank above I).
const VOWS_KEY = 'kizuna2_1.vows';
function loadVows() { try { return JSON.parse(localStorage.getItem(VOWS_KEY) || '{}'); } catch (_) { return {}; } }
function vowUses(classKey) { return loadVows()[classKey] || 0; }
function vowRank(classKey) { const u = vowUses(classKey); return u >= 3 ? 3 : u >= 1 ? 2 : 1; }
function recordVow(classKey) {
  const v = loadVows(); v[classKey] = (v[classKey] || 0) + 1;
  try { localStorage.setItem(VOWS_KEY, JSON.stringify(v)); } catch (_) {}
}
const ROMAN = ['', 'I', 'II', 'III'];
function trioClassKey(ids) { return ids.map(id => HEROES[id].cls).sort().join('+'); }
const UNLOCK_KEY = 'kizuna2_1.unlocked';

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
    embers: 0,          // per-run ember wallet — earned and spent THIS descent only
    nodes: [],          // per-run skill-tree unlocks — reset when the run ends; starts EMPTY (everything earned)
    forges: [],         // temporary ember tempers bought at camps — reset each descent
    boons: [],          // companion GIFTS drafted on the road — reset each descent (party-gated)
    foes: [],           // travelers you wronged — they ambush a later fight this run
    foesMade: 0,        // count of travelers ever crossed this run — reputation for party MOOD
    emCount: {},        // emergent-loop tallies — accrue ACROSS the whole descent (grow over time)
    done: false,
  };
}
const FLOORS = 4;         // total floors — floor 4 is the short mega-boss gauntlet
const BOND_KINDLED = 2;
const bondPts = (k) => (RUN && RUN.bonds && RUN.bonds[k]) || 0;
function saveRun() { try { localStorage.setItem(RUN_KEY, RUN ? JSON.stringify(RUN) : ''); } catch (_) {} }
function loadRun() { try { const r = localStorage.getItem(RUN_KEY); return r ? JSON.parse(r) : null; } catch (_) { return null; } }

function newBattle(node) {
  // TEST-ONLY: a persisted flag lets the flow suite force CLASSIC combat (to
  // exercise the shared mechanics) regardless of how many runs it spins up.
  // Undefined in production, so it has no effect on the real game.
  let _forceClassic = false;
  try { _forceClassic = localStorage.getItem('kizuna2_1.forceClassic') === '1'; } catch (_) {}
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
    const psDmg = ps >= 3 ? 1 : ps === 2 ? 0.82 : 0.64;
    const psHp = ps >= 3 ? 1 : ps === 2 ? 0.86 : 0.72;
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
        const bhpMult = fl >= 3 ? 2.4 : fl >= 2 ? 1.9 : 2.9;
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
  return {
    node, heroes, enemies,
    maxEp: 2 + heroes.length, ep: 2 + heroes.length,
    used: new Set(),
    threads,
    pairsAwake: new Set(),   // kindled pairs whose DUET has awakened THIS fight
    tempCards: [], _tuid: 0, _chainGroup: 0, channelUsed: false,
    // BRANCHING ROTATIONS are the combat system for the real DESCENT (useRunHp
    // fights); the tutorial stays a classic on-ramp.  RUN._rotations (persisted on
    // the run) can force it either way — true = dev preview / everywhere; false =
    // classic (used by the flow suite to exercise the shared combat mechanics).
    _rotations: _forceClassic ? false
              : (RUN && RUN._rotations === false) ? false
              : (RUN && RUN._rotations === true) ? true
              : !!(node && node.useRunHp),
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
const enemyArt = (e) => V2PORTRAITS[e.def.art || e.id] || V2PORTRAITS.wraith || '';   // never render a blank figure

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
  livingHeroes().forEach(h => {
    // CHAIN HEROES show a single OPENER instead of core+sig — their builders and
    // finishers arrive as forged temp cards as the rotation plays out.
    const rot = rotationFor(h);
    if (rot) {
      const op = mkChainOpener(h, rot); if (!op.spent) hand.push(op);
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
function heroResistsChill(h) { return !!(h && h.id === 'cassia' && hasNode('cassia.passive.bastion')); }
function moveCost(h) {
  if (!h || S.used.has(h.id + ':move')) return 1;                                         // only the FIRST move can be free
  if (h.id === 'mira' && hasNode('mira.passive.swiftfoot')) return 0;                      // Swiftfoot — always free
  if (h.id === 'ash' && hasNode('ash.passive.warstep') && (S._flags || {}).ashStruck) return 0;   // Warstep — free after an attack
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
function enterTargeting(card, validIds, hint, opts) {
  targeting = Object.assign({ card, validIds }, opts || {});
  if (validIds[0] && validIds[0].startsWith('row:')) targeting.isRow = true;
  $('#target-hint').textContent = hint + (targeting.drag ? '' : ' — tap a figure');
  $('#target-hint').classList.remove('hidden');
  renderBattlefield();
  renderThreads();
}
function cancelTargeting() {
  targeting = null;
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
  try { _slowmoRef = 0; const st = document.getElementById('stage'); if (st) st.classList.remove('parry-focus', 'parry-slowmo', 'allout-focus', 'frozen'); } catch (_) {}
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
  $('#target-hint').classList.add('hidden');
  playCard(card, id);
}
function onRowTap(row) {
  if (!targeting || !targeting.isRow || targeting.drag) return;
  const card = targeting.card;
  if (!targeting.validIds.includes('row:' + row)) { cancelTargeting(); return; }
  targeting = null;
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
    if (!targeting) { $('#target-hint').classList.add('hidden'); $('#target-hint').classList.remove('th-tech'); }
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
  if (card.temp) S.tempCards = S.tempCards.filter(t => t.uid !== card.uid);
  else if (card.owner !== 'triad') S.used.add(card.owner + ':' + card.kind);
  if (card.kind !== 'move') {
    SFX.card();
    // The card HURLS into the target (the strike).  A forging rotation card then
    // BOUNCES back to its slot and splits — see forgeReturnFx, which waits for the
    // hurl to land before the bounce.
    flyCard(card.name, targetId ? figEl(targetId) : (card.target === 'frontmost' && frontmostEnemy() ? figEl(frontmostEnemy().uid) : null));
  } else { SFX.move(); }
  pulseEp();
  renderAll();
  await resolveCard(card, targetId);
  // BOND CHAIN — ANY finisher/signature (attack, heal OR guard) offers its owner's
  // woven partner a free Chain, so every hero chains, not just the attackers.  The
  // Chain card itself never re-triggers.
  if (card.owner && !(card.fx && card.fx.bondFollow) && (/FINISHER/.test(card.stance || '') || card.kind === 'sig')) {
    const o = S.heroes.find(h => h.id === card.owner);
    if (o && !o.downed) offerBondFollow(o.id);
  }
  resolveChainPlay(card);                    // forge the rotation's next step(s); purge unpicked siblings
  if (card.kind !== 'move') hexBurn(card);   // a hexed hero's card play eats another card
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
  genTempCard({ kind: 'temp', owner: owner.id, ownerName: owner.def.name, tint: owner.def.tint,
    stance: 'AFTERIMAGE', name: 'Echo: ' + oldCore.name, cost: 0, target: oldCore.target,
    school: owner.def.school, fx: { dmg }, expiresTurn: S.turn,
    desc: `<b>${dmg} damage</b> · fading echo, this turn only.` });
}

async function resolveCard(card, targetId) {
  const owner = S.heroes.find(h => h.id === card.owner);
  if (owner && owner.downed) return;

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
    renderAll();
    popupAt(figEl(owner.id), STANCE[card.toRow].name.toUpperCase(), 'info');
    if (occupant) popupAt(figEl(occupant.id), 'SWAP', 'info');
    await sleep(340);
    return;
  }

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
    wd.hp = Math.min(wd.maxHp, wd.hp + 4);
    pr.guard += 4;
    pr.counter = Math.max(pr.counter, 2);
    pr.chill = (pr.chill || 0) + 2;   // the cost: the next strike comes slower
    renderAll();
    popupAt(figEl(prId), 'NOT TODAY', 'info');
    popupAt(figEl(wdId), '+4', 'heal');
    popupAt(figEl(prId), '❄ OVEREXTENDED −2', 'chill');
    SFX.guard();
    await addThread(prId, wdId);   // protecting is a bond act
    await sleep(400);
    return;
  }
  if (fx.dmg || fx.guardBurst) {
    let tgt = null;
    if (card.target === 'frontmost') tgt = frontmostEnemy();
    else if (card.target === 'enemy') tgt = livingEnemies().find(e => e.uid === targetId) || frontmostEnemy();
    if (tgt) {
      let amt = (fx.dmg || 0) + (owner ? owner.buffDmg : 0);
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
      // FOLLOW-UP: striking an enemy an ally already hit this turn is a
      // combo — +2 damage, and fighting together forms a thread between
      // the two attackers (Concept 3: following up strengthens bonds).
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
        // WARSTEP (Ash) — landing an attack unlocks a free reposition this turn.
        if (owner.id === 'ash') { S._flags = S._flags || {}; S._flags.ashStruck = true; }
        // A small MOMENTUM trickle on every ordinary hit — the burst gauge should
        // feel alive and visibly climb through a normal fight, not sit decorative.
        // (Follow-ups already grant the bigger LINK below; still far slower than the
        // old turn-1 pace — bonds & parries remain the fast fill.)
        if (!isFollowUp && amt > 0) gainMomentum(2, { raw: true });
      }
      if (isFollowUp) {
        gainMomentum(12, { combo: true });   // LINK — chaining allies builds burst
        // one clean callout (was two stacked ⚡ popups): the +2 bonus and, once a
        // real chain is running, the LINK count.
        popupAt(figEl(owner.id), S.combo >= 2 ? '⚡ FOLLOW-UP +2 · ×' + S.combo : '⚡ FOLLOW-UP +2', 'info');
        SFX.follow();
        firePassives('followup', owner.id, { ally: prev });   // ally = the hero Ash followed
        // GANGING UP binds the whole party: thread with EVERY ally who has
        // struck this foe this turn, not just the last — so focus-firing one
        // enemy (the natural strong play) weaves the full triangle instead of
        // leaving the triad's marquee moment locked behind fussy pick order.
        const priorAllies = hitters.filter((id, i) => id !== owner.id && hitters.indexOf(id) === i);
        for (const ally of priorAllies) await addThread(owner.id, ally);
      }
      // AVENGE: cutting down an enemy that hurt an ally this fight forms a
      // thread with the one you avenged — protective aggression bonds too.
      if (tgt.dead && owner) {
        const wounded = (tgt._damaged || []).filter(id => id !== owner.id && livingHeroes().some(h => h.id === id));
        if (wounded.length) {
          const avenged = wounded[wounded.length - 1];
          popupAt(figEl(owner.id), '⚔ AVENGED', 'info');
          await addThread(owner.id, avenged);
        }
      }
      if (tgt.dead) await sleep(140);   // hitstop: let the kill land
    } else {
      flashNarrator('No target in reach — the cut finds only air.');
    }
  }
  if (fx.mark) {
    const tgt = livingEnemies().find(e => e.uid === targetId);
    if (tgt) { tgt.mark = fx.mark; popupAt(figEl(tgt.uid), '◎ EXPOSED +' + fx.mark, 'info'); if (owner) fireEmergent(owner.id, 'expose', card); }
  }
  if (fx.lull) {
    const tgt = card.target === 'enemy' ? (livingEnemies().find(e => e.uid === targetId) || frontmostEnemy()) : frontmostEnemy();
    if (tgt) { tgt.lull = (tgt.lull || 0) + fx.lull; popupAt(figEl(tgt.uid), '❄ CHILL −' + fx.lull, 'chill'); }
    // KINDLING (Hask) — frost feeds the fire: chilling a foe builds ◆ CHARGE.
    if (owner && owner.id === 'hask' && hasNode('hask.passive.kindling')) { owner.charge = Math.min(chargeCap(owner), (owner.charge || 0) + 1); popupAt(figEl(owner.id), '◆ ' + owner.charge, 'info'); }
  }
  // OVERCHARGE (Hask) — a self-cast that only builds ◆ CHARGE, no strike.
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
        if (owner && owner.id === 'elin' && hasNode('elin.passive.mercy') && (rc.chill || rc.exposed)) {
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
      if (owner && rc.id !== owner.id && (card.target === 'ally' || card.target === 'allies')) await addThread(owner.id, rc.id);
    }
    // one emergent tick per PLAY (not per receiver): the caster's mending / warding loop
    if (owner && receivers.length) {
      if (fx.heal)  fireEmergent(owner.id, 'heal', card);
      if (fx.guard) fireEmergent(owner.id, 'guard', card);
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
  await sleep(280);
}

// Single source of truth for how hard an enemy intent hits — base + power,
// scaled by the fight's difficulty multiplier, then reduced by CHILL.  Used by
// the enemy turn AND both telegraphs (intent bubble + threat forecast) so what
// you're shown is exactly what lands.
function enemyIntentDmg(e, intent) {
  const scaled = Math.round(((intent.dmg || 0) + (e.power || 0)) * (e.dmgMul || 1));
  return Math.max(0, scaled - (e.lull || 0));
}
// The intents an enemy will execute on its COMING turn (one, or two for a boss
// that strikes twice).  Drives both the telegraph and the resolution so what is
// shown is exactly what lands.
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
    out.push(e.def.intents[(e.intentIdx + off) % len]);
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
  if (!e || !e.smart) return intent.row;
  const live = (typeof S !== 'undefined' && S) ? livingHeroes() : [];
  if (!live.length) return intent.row;
  // A SHOVE/HOOK hunts the cruelest victim to displace, not just the weakest hitpool.
  if (intent.shove) { const v = cruelShovePrey(e, intent); if (v) return v.row; }
  const prey = live.slice().sort((a, b) => (a.hp + (a.guard || 0)) - (b.hp + (b.guard || 0)) || (b.exposed || 0) - (a.exposed || 0))[0];
  return prey.row;
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
  // STAGGER payoff: the next hit on a staggered enemy lands double.
  if (e.staggered) {
    amt *= 2;
    e.staggered = false;
    popupAt(figEl(e.uid), '×2!', 'dmg popup-big');
    stageShake();
  }
  // TECHNICAL — striking a PRIMED foe (CHILLED or WEAKENED) off the weakness
  // line detonates the setup for bonus damage + momentum.  This is the combo
  // payoff: prime with a status card, then anyone cashes it.  (Suppressed in an
  // all-out, which runs its own detonation.)
  let technical = false;
  if (byHeroId && !S._burstResolving && (e.lull || e.weakened) && !(school && school === e.def.weak)) {
    amt += 4;
    technical = true;
    gainMomentum(8, { combo: true });
  }
  let left = amt;
  // LONGSHOT (Branwen) — her arrows slip past enemy GUARD entirely; everyone else
  // chips the guard first.
  const pierce = byHeroId === 'branwen' && hasNode('branwen.passive.longshot');
  if (e.guard > 0 && !pierce) { const g = Math.min(e.guard, left); e.guard -= g; left -= g; }
  e.hp = Math.max(0, e.hp - left);
  // First blood reveals the hidden weakness.
  if (!e.weakRevealed) {
    e.weakRevealed = true;
    flashNarrator(e.def.name + ' — weak to ' + (SCHOOL_GLYPH[e.def.weak] || '?') + ' ' + (e.def.weak || '').toUpperCase() + '.');
  }
  // Weakness state machine: WEAKENED, then STAGGERED on the same-turn repeat.
  // (Suppressed during an ALL-OUT so the burst stays clean damage, not a
  // cascade of forged finishers.)
  if (school && school === e.def.weak && e.hp > 0 && !S._burstResolving) {
    gainMomentum(10, { combo: true });            // exploiting a weakness builds burst
    if (e.weakened) {
      e.weakened = false;
      e.staggered = true;
      gainMomentum(18);                            // the BREAK is a big surge
      popupAt(figEl(e.uid), '⚡ STAGGERED', 'info');
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
          if (st.heal) livingHeroes().forEach(h => { if (!h.downed && h.hp < h.maxHp) { h.hp = Math.min(h.maxHp, h.hp + st.heal); popupAt(figEl(h.id), '✚' + st.heal, 'heal'); } });   // Elin — mends as she ends
        }
      }
      if (!S._pressUsed) {
        S._pressUsed = true;
        S.ep += 1;
        pulseEp();
        popupAt(figEl(e.uid), '+1 EP · PRESS ON', 'rally');
      }
    } else {
      e.weakened = true;
      popupAt(figEl(e.uid), '⌖ WEAKENED', 'info');
      if (!S._weakTaught) { S._weakTaught = true; flashNarrator('Weakness! Hit ' + SCHOOL_GLYPH[e.def.weak] + ' again THIS turn to STAGGER.'); }
    }
  }
  // IMPACT TIER — the weight of the blow drives every feel channel (flash,
  // hitstop, shake, popup), so a 4-damage poke and a 30-damage crash land
  // nothing alike.  0 light · 1 solid · 2 heavy · 3 massive.
  const tier = amt >= 20 ? 3 : amt >= 12 ? 2 : amt >= 7 ? 1 : 0;
  const big = tier >= 2;
  popupAt(figEl(e.uid), '−' + amt, 'dmg' + (big ? ' popup-big' : ''));
  // (damagedHeroes bookkeeping lives in enemyPhase; kills resolve avenging
  // in resolveCard where the attacker is known)
  if (byHeroId) lungeFig(figEl(byHeroId));       // the striker drives forward
  impactFx(figEl(e.uid), school || 'phys', big); // school-typed blow lands
  struck(figEl(e.uid), 'r');                 // recoil + flash + brief stun
  hitFlash(tier);                                 // screen flash (+ hitstop if heavy)
  SFX.hit(big);
  if (tier >= 1) stageShake(['sm', 'sm', 'lg', 'xl'][tier]);
  if (technical) {                                // detonation callout
    popupAt(figEl(e.uid), '⚡ TECHNICAL', 'tech');
    techBurst(figEl(e.uid));
    stageShake('lg');
  }
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
    const rel = figEl(e.uid); if (rel) popupAt(rel, '✦ +' + reward, 'ember');
    gainMomentum(8);                                // a kill feeds the burst
    SFX.kill();
    stageShake('lg');
    hitFlash(3);                                    // the kill gets a white flash + slow-mo beat
    const el = figEl(e.uid);
    if (el) { el.classList.add('fig-dying'); deathBurst(el); }
    setTimeout(() => { e._justDied = false; if (S && !S.over) renderAll(); }, 750);
  }
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

// ---------------------------------------------------------------------------
// MOMENTUM — the combat-earned burst gauge (Persona all-out / Clair Obscur
// gradient).  Exploiting weaknesses, chaining LINKs (follow-ups), staggering,
// and killing all feed it.  A running LINK combo counter (per player turn)
// scales each gain so chaining pays.  Full gauge → ALL-OUT ATTACK.
// ---------------------------------------------------------------------------
const MOM_MAX = 100;                 // L1 threshold — the all-out is available here
// COMBAT momentum builds ~30% slower now, so the all-out is a turn-3-ish CLIMAX you
// build toward, not a turn-1 reflex that overkills the pack.  BOND rewards (weave
// charge, the Kizuna chain node) pass `raw` and are NOT scaled — so bonding, not
// card-spam, is what accelerates the burst.
const MOM_SCALE = 0.7;
// BURST LEVELS — the gauge's CONTAINER grows as you speak kizuna.  Landing a DUET
// expands it to L2, the TRIAD vow to L3 (see expandBurst); a bigger container
// holds more charge, and the all-out that fires UPGRADES to whatever level the
// gauge has filled to (see burstFireLevel / resolveAllOut).  Additive & opt-in:
// a fight that never bonds plays exactly like L1 always did.
const BURST_CAPS = [100, 175, 250];
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
  const cap = burstCap();
  if (S.momentum >= cap && before < cap) {
    const lv = S.burstLevel || 1;
    flashNarrator(lv >= 3 ? '✦✦✦ BURST FULL — your ALL-OUT is TRANSCENDENT. Unleash it, then TAP each strike.'
                : lv === 2 ? '✦✦ BURST FULL — your ALL-OUT is RESONANT. Unleash it, then TAP each strike.'
                : '✦ BURST READY — unleash the ALL-OUT, then TAP each strike to chain it.');
    SFX.triad();
  }
}
// Grow the burst container.  Called when a DUET (L2) or the TRIAD vow (L3) lands —
// the kizuna also pours in a chunk of charge so the bigger gauge feels reachable.
// Persists for the rest of the fight (the container stays big; you refill it).
function expandBurst(level, label, charge) {
  if (!S || ((S.burstLevel || 1) >= level)) { if (charge) gainMomentum(charge, { raw: true }); return false; }
  S.burstLevel = level;
  const burst = $('#burst');
  if (burst) { burst.classList.remove('burst-expand'); void burst.offsetWidth; burst.classList.add('burst-expand'); }
  flashNarrator('✦ THE BURST EXPANDS — LEVEL ' + level + (label ? ' · ' + label : '') + '.');
  if (SFX.triad) SFX.triad();
  if (charge) gainMomentum(charge, { raw: true });
  renderBurst();
  return true;
}
function burstReady() { return S && (S.momentum || 0) >= MOM_MAX && !S.executing && !S.over && !S._staging; }

// ---------------------------------------------------------------------------
// PARRY — a reactive timing window on enemy attacks (Clair Obscur flavor).
// Tap as the ring closes: PERFECT negates the blow, ripostes, and builds
// momentum; a looser tap BLOCKS half.  Experimental — flip PARRY_ENABLED to
// false to remove the whole layer cleanly (enemy attacks then resolve as before).
// ---------------------------------------------------------------------------
const PARRY_ENABLED = true;
const PARRY_MISS_MULT = 1.6;   // an UNPARRIED blow lands HARDER (real-run only)
// ── COMBAT TENSION (the Clair-Obscur dial) ──────────────────────────────────
// Defense is where the game is HARD: every blow is a string you must read and
// execute, the timing bands are tight, and even a mob can hurt if you botch it.
// Three tunable levers — turn them up for more danger, down for more forgiveness.
const PARRY_GOOD_MS = 400;   // the "good" (half-mitigate) band, ms-remaining (was 460 — less tolerance)
const PARRY_PERF_MS = 150;   // the "perfect" (full negate + riposte) band (was 175 — tighter)
const MOB_HP_BASE   = 1.6;   // non-boss HP curve base — dropped ~30% (from 2.3): the parry STRINGS carry the difficulty now, so foes don't need to be HP sponges

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
    if (d >= 5 && ((p.kind === 'tap' && !p.size) || (p.kind === 'multi' && (p.count || 2) <= 2))) {
      return { kind: 'seq', notes: d >= 7
        ? [{ t: 'tap' }, { t: 'tap' }, { t: 'swipe', arc: 'arcL' }]
        : [{ t: 'tap' }, { t: 'swipe', arc: 'arcR' }] };
    }
    return p;
  }
  // Derived (un-authored) patterns follow the same shape.
  if (intent.heavy)         return { kind: 'seq', notes: [{ t: 'tap' }, { t: 'hold' }, { t: 'tap' }, { t: 'swipe', arc: 'arcU' }] };
  if (intent.row === 'all') return { kind: 'seq', notes: [{ t: 'swipe', arc: 'arcAcross' }, { t: 'tap' }, { t: 'tap' }] };
  if (d <= 2)               return { kind: 'mash', count: 4 };                                            // a frenzied flurry
  if (d <= 4)               return { kind: 'tap' };                                                       // a single clean read (the primer)
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
function figHitRect(el) {
  if (!el) return null;
  const art = el.querySelector && (el.querySelector('.fig-art svg') || el.querySelector('.fig-art'));
  return (art || el).getBoundingClientRect();
}
// Stage-space anchor (center) of the parry UI for a given target figure.
function noteAnchor(targetEl) {
  const sr = $('#stage').getBoundingClientRect(), scale = sr.width / stageDW();
  const r = figHitRect(targetEl) || targetEl.getBoundingClientRect();
  return { x: (r.left + r.width / 2 - sr.left) / scale, y: (r.top + r.height * 0.4 - sr.top) / scale };
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
  const good = q === 'perfect' || q === 'good';
  if (good) _parryStreak++; else _parryStreak = 0;
  ui.el.classList.add(q === 'perfect' ? 'pr-land-perfect' : good ? 'pr-land-good' : 'pr-land-miss');
  const layer = $('#popup-layer');
  const rate = document.createElement('div');
  rate.className = 'parry-rate ' + (q === 'perfect' ? 'prt-perfect' : good ? 'prt-good' : 'prt-miss');
  rate.style.left = ax + 'px'; rate.style.top = (ay - 4) + 'px';
  const word = q === 'perfect' ? 'PERFECT' : q === 'good' ? 'GOOD' : q === 'early' ? 'EARLY' : 'MISS';
  rate.innerHTML = word + (good && _parryStreak > 1 ? ` <em>×${_parryStreak}</em>` : '');
  layer.appendChild(rate);
  setTimeout(() => rate.remove(), 620);
  const burst = document.createElement('div');
  burst.className = 'parry-burst ' + (q === 'perfect' ? 'pb-perfect' : good ? 'pb-good' : 'pb-miss');
  burst.style.left = ax + 'px'; burst.style.top = ay + 'px';
  layer.appendChild(burst);
  setTimeout(() => burst.remove(), 440);
  // Screen-level RESPONSE to the press: a quick full-bleed flash sells the
  // impact.  (Cheap — it's a separate fading overlay, so it never forces the
  // paused/blurred battlefield behind it to re-rasterize.)
  const flash = document.createElement('div');
  flash.className = 'parry-flash ' + (q === 'perfect' ? 'pf-perfect' : good ? 'pf-good' : 'pf-miss');
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
    const GOOD = Math.round(PARRY_GOOD_MS * _parryWin), PERF = Math.round(PARRY_PERF_MS * _parryWin);   // windows (tighten with depth)
    let done = false; const t0 = Date.now();
    // light the note up the moment it becomes tappable — "wait for the glow" — and
    // DILATE time (Clair Obscur slow-mo) so the instant to parry lands with weight
    const liveT = setTimeout(() => { if (!done) { ui.el.classList.add('pr-live'); lbl.textContent = size === 'big' ? 'SLAM!' : 'TAP!'; parrySlowmo(true); } }, Math.max(0, dur - GOOD));
    const finish = (q) => { if (done) return; done = true; clearTimeout(liveT); if (ui.el.classList.contains('pr-live')) parrySlowmo(false); window.removeEventListener('pointerdown', onTap, true); noteFeedback(ui, ax, ay, q); ui.close(); resolve(q); };
    const onTap = () => {
      const rem = dur - (Date.now() - t0);
      if (rem > GOOD) { parryEarlyNudge(ui, ax, ay); return; }   // too soon — forgive, keep listening
      finish(rem <= PERF ? 'perfect' : 'good');
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
// First-few-parries coach — a short caption teaching each gesture.  Budgeted
// PER GESTURE (tap / hold / swipe / mash) so meeting a HOLD or SWIPE for the first
// time still teaches it, even after you've seen the TAP lesson thrice.  Each
// gesture shows at most twice, then never nags a veteran again.
function parryCoach(msg) {
  const kind = /HOLD/.test(msg) ? 'hold' : /SWIPE/.test(msg) ? 'swipe' : /MASH/.test(msg) ? 'mash' : 'tap';
  const key = 'kizuna2_1.parryLesson_' + kind;
  let n = 0;
  try { n = parseInt(localStorage.getItem(key) || '0', 10) || 0; } catch (_) {}
  if (n >= 2) return;
  try { localStorage.setItem(key, String(n + 1)); } catch (_) {}
  let el = document.getElementById('parry-coach');
  if (!el) { el = document.createElement('div'); el.id = 'parry-coach'; $('#stage').appendChild(el); }
  el.textContent = msg;
  el.classList.remove('pc-hide'); void el.offsetWidth; el.classList.add('pc-show');
  clearTimeout(el._t); el._t = setTimeout(() => { el.classList.remove('pc-show'); }, 2800);
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
  return T[count] || Array.from({ length: count }, (_, i) => ({ d: i === 0 ? 600 : 440, g: i === count - 1 ? 0 : 110 }));
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
function parryDepth() {
  const d = (typeof RUN !== 'undefined' && RUN && Array.isArray(RUN.completed)) ? RUN.completed.length : 0;
  return Math.max(0, Math.min(1, d / 12));   // 0 at the surface → 1 by ~floor's end
}
function setParryDifficulty(e) {
  const base = (e && e.def && e.def.parrySpeed) || 1;
  const d = parryDepth();
  _parrySpeed = base * (1 - 0.24 * d);   // up to 24% faster cascades deep
  _parryWin   = 1 - 0.30 * d;            // up to 30% tighter windows (460→322 / 175→123)
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
  for (let i = 0; i < count; i++) out.push({ d: Math.round((i === 0 ? 660 : 560) * _parrySpeed), g: i === count - 1 ? 0 : Math.round(160 * _parrySpeed) });
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
  const pts = arcPoints(notes.length, anchor);
  const preview = mkSeqPreview(pts);
  const rh = seqRhythm(notes.length);   // fallback groove when no music is playing
  // BEAT SYNC — if the combat theme is playing, land each note ON the beat grid,
  // re-anchored to the track's live position (so it stays locked even if the tempo
  // read is a hair off).  Dense/fast cascades ride HALF-beats; steady ones whole
  // beats.  With music off, fall back to the free-running groove.
  const clock = MUSIC.beat();
  const synced = clock.playing;
  // ONE note per beat is the readable default — a steady march that reads as
  // "on the music."  Only the genuine CLIMAX (the Hollow Chorus's later stages,
  // ~0.5–0.6) runs double-time on HALF-beats; road bosses and mobs stay on whole
  // beats so the first boss never feels frantic.
  const sub = synced ? (_parrySpeed < 0.66 ? clock.beatSec / 2 : clock.beatSec) : 0;   // seconds per note
  let land = synced ? clock.nextGrid(0.6, sub) : 0;   // note 0 lands on the next beat ~0.6s out
  if (!synced) await sleep(Math.round(SEQ_LEADIN * _parrySpeed));   // free-run lead-in
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
    else                       q = await parryTapNote(p.x, p.y, synced ? dur : step.d, i + 1, notes.length);
    const okNote = q === 'perfect' || q === 'good';
    if (art) bossAttackBeat(art, p.x, p.y, okNote);   // the blade STRIKES on the beat — clash if parried, connects if not
    if (done) { done.classList.remove('sq-active'); done.classList.add(okNote ? 'sq-hit' : 'sq-miss'); }
    if (q === 'perfect' || q === 'good') hits++;
    if (q === 'perfect') perfects++;
    if (synced) land += sub;                 // next note, next grid point
    else if (step.g) await sleep(step.g);    // free-run gap
  }
  preview.remove();
  // PARTIAL: each note you turned aside negates its share; the ones you missed
  // still land.  mit = fraction parried; perfect = caught them all; FLAWLESS =
  // every note read PERFECTLY (the Clair Obscur counter — ripostes, see enemyPhase).
  return { mit: hits / notes.length, perfect: hits === notes.length, flawless: perfects === notes.length && notes.length > 0, notes: notes.length };
}
// Run a pattern; returns { mit (0..1 damage negated), perfect } | null if off.
// While a parry is live the world behind the notes desaturates, blurs and
// dims (`parry-focus`) so the reactive gesture is the only thing in focus —
// the notes/ratings live in #popup-layer, above the filter, and stay crisp.
async function runParry(targetEl, pattern, art) {
  if (!PARRY_ENABLED || !targetEl) { await sleep(380); return null; }
  const stage = $('#stage');
  stage.classList.add('parry-focus');
  try {
    return await runParryInner(targetEl, pattern, art);
  } finally {
    stage.classList.remove('parry-focus');
    _slowmoRef = 0; stage.classList.remove('parry-slowmo');   // never leak the dilation past a parry
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
  if (k === 'seq')   return await runParrySeq(pattern.notes, a, art);
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
    }
    return { mit: hits / pattern.count, perfect: hits === pattern.count, flawless: perfects === pattern.count && pattern.count > 0, notes: pattern.count };
  }
  let q;
  if (k === 'hold')       q = await parryHoldNote(a.x, a.y, 900, sz);
  else if (k === 'swipe') q = await parrySwipeNote(a.x, a.y, pattern.arc, 860, sz);
  else if (k === 'mash')  q = await parryMashNote(a.x, a.y, pattern.count || 4, 1150);
  else                    q = await parryTapNote(a.x, a.y, 700, 1, 1, sz);
  const ok1 = q === 'perfect' || q === 'good';
  if (art) bossAttackBeat(art, a.x, a.y, ok1);   // the single strike lands as the note resolves
  return { mit: q === 'perfect' ? 1 : q === 'good' ? 0.5 : 0, perfect: q === 'perfect', flawless: q === 'perfect', notes: 1 };
}
function parryFlash(el) {
  if (!el) return;
  el.classList.remove('fig-parry'); void el.offsetWidth; el.classList.add('fig-parry');
  setTimeout(() => el && el.classList.remove('fig-parry'), 500);
}

async function addThread(a, b) {
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
  else flashNarrator('◇ THREAD — ' + HEROES[a].name + ' ─ ' + HEROES[b].name + ' · fight together again to KINDLE it (then they CHAIN off each other’s finishers)');
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
async function checkTriad(closer) {
  const live = livingHeroes();
  if (live.length < 3 || S.triadFormed) return;
  const [x, y, z] = live.map(h => h.id);
  if (S.threads.has(pairKey(x, y)) && S.threads.has(pairKey(y, z)) && S.threads.has(pairKey(x, z))) {
    S.triadFormed = true;
    await triadCeremony();
  }
}

async function triadCeremony() {
  $('#stage').classList.add('frozen');
  SFX.triad();
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
function strikeNote(targetEl, idx, total, dur) {
  return new Promise(resolve => {
    const a = targetEl ? noteAnchor(targetEl) : { x: 500, y: 150 };
    const label = total > 1 ? `${idx}/${total}` : 'STRIKE';
    const ui = mkParryUiAt(a.x, a.y, `<span class="pr-target"></span><span class="pr-close"></span><span class="pr-lbl">${label}</span>`, 'pr-strike');
    ui.el.querySelector('.pr-close').style.animationDuration = dur + 'ms';
    const lbl = ui.el.querySelector('.pr-lbl');
    const GOOD = 440, PERF = 165;
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
  const good = q === 'perfect' || q === 'good';
  ui.el.classList.add(q === 'perfect' ? 'pr-land-perfect' : good ? 'pr-land-good' : 'pr-land-miss');
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
function strikeSwipeNote(targetEl, arc, dur) {
  return new Promise(resolve => {
    const a = targetEl ? noteAnchor(targetEl) : { x: 500, y: 150 };
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
function strikeHoldNote(targetEl, dur) {
  return new Promise(resolve => {
    const a = targetEl ? noteAnchor(targetEl) : { x: 500, y: 150 };
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
const ALLOUT = { base: 4, qmul: { perfect: 1.5, good: 1.0, miss: 0.4, early: 0.4 }, comboStep: 0.05, comboCap: 10 };
const ALLOUT_RHYTHM = [{ d: 560, g: 120 }, { d: 460, g: 80 }, { d: 440, g: 0 }];
// Each ARCHETYPE unleashes differently — the input you make expresses the class:
//   Ronin   flurries TAPS · Reaver rakes twin SWIPES · Guardian/Mage CHARGE a
//   heavy SLAM · Ranger looses an aimed shot then a raking SLASH · supports keep
//   a steady two-tap.  Fewer notes hit harder each (damage is normalised), so a
//   Guardian's single charged slam ≈ a Ronin's two quick cuts.
const ALLOUT_CASCADE = {
  Ronin:    [{ t: 'tap' }, { t: 'tap' }],
  Reaver:   [{ t: 'swipe', arc: 'arcR' }, { t: 'swipe', arc: 'arcL' }],
  Guardian: [{ t: 'hold' }],
  Mage:     [{ t: 'hold' }, { t: 'tap' }],
  Ranger:   [{ t: 'tap' }, { t: 'swipe', arc: 'arcU' }],
  Cleric:   [{ t: 'tap' }, { t: 'tap' }],
  Bard:     [{ t: 'tap' }, { t: 'tap' }],
  _default: [{ t: 'tap' }, { t: 'swipe', arc: 'arcR' }],
};
function allOutCoach() {
  let n = 0;
  try { n = parseInt(localStorage.getItem('kizuna2_1.strikeLessons') || '0', 10) || 0; } catch (_) {}
  if (n >= 3) return;
  try { localStorage.setItem('kizuna2_1.strikeLessons', String(n + 1)); } catch (_) {}
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
  await allOutCineIntro(heroes);
  $('#stage').classList.add('allout-focus');
  if (bondCount > 0) { flashNarrator('✦ BONDS ×' + bondCount + ' — the party moves as one, every blow empowered.'); cineFlash('rgba(240,212,136,0.4)'); }
  allOutCoach();
  let chain = 0, goodHits = 0, allStrikes = 0, perfectStrikes = 0;
  for (const h of heroes) {
    if (S.over || !livingEnemies().length) break;
    lungeFig(figEl(h.id));
    await sleep(90);
    // the hero's cascade is keyed to their ARCHETYPE — the gesture IS the class
    const casc = ALLOUT_CASCADE[h.def.cls] || ALLOUT_CASCADE._default;
    const noteBase = ALLOUT.base * (2 / casc.length);   // fewer notes → each hits harder
    for (let i = 0; i < casc.length; i++) {
      if (S.over || !livingEnemies().length) break;
      const tgt = frontmostEnemy() || livingEnemies()[0];
      if (!tgt) break;
      const nt = casc[i];
      const step = ALLOUT_RHYTHM[i] || { d: 480, g: 0 };
      let q;
      if (nt.t === 'swipe')     q = await strikeSwipeNote(figEl(tgt.uid), nt.arc || 'arcR', step.d + 140);
      else if (nt.t === 'hold') q = await strikeHoldNote(figEl(tgt.uid), 860);
      else                      q = await strikeNote(figEl(tgt.uid), i + 1, casc.length, step.d);
      const good = q === 'perfect' || q === 'good';
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
        const primed = e.staggered || e.weakened || e.mark || e.lull || aoLevel >= 3;   // L3 detonates everything
        if (primed) { dmg = Math.round(dmg * 1.5); }                 // detonate the setup
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
      if (step.g) await sleep(step.g);
    }
    if (checkEnd()) break;
  }
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
      livingHeroes().forEach(h => { if (!h.downed) { h.hp = Math.min(h.maxHp, h.hp + 5); h.guard += 3; popupAt(figEl(h.id), '✚5 ⛨3', 'heal'); } });
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
    livingHeroes().forEach(h => { h.hp = Math.min(h.maxHp, h.hp + 5); h.guard += 5; popupAt(figEl(h.id), '✚5 ⛨5', 'heal'); });
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
    flashNarrator('✦ WOVEN — your kindled bonds enter already woven: ' + lit.join(' · ')
      + '. Play a FINISHER and a partner CHAINS; your bonds empower the ALL-OUT.');
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
    + ': play a FINISHER with one and the other gets a free CHAIN.');
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
    if (fx.pairHeal || fx.healAll) { const who = fx.healAll ? livingHeroes() : alive; const amt = scaled(fx.pairHeal || fx.healAll); who.forEach(h => { h.hp = Math.min(h.maxHp, h.hp + amt); popupAt(figEl(h.id), '✚' + amt, 'heal'); }); if (SFX.heal) SFX.heal(); }
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
  await playVowStages(r.stages, ids, 1.9, '✦ ' + r.name + ' — THE TRIAD');
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
  if (S.executing || S.over || S._staging) return;
  S.executing = true;
  $('#stage').classList.add('executing');
  renderAll();
  await enemyPhase();
  if (!S.over) {
    S.turn++;
    S.ep = S.maxEp;
    S.used = new Set();
    S._flags = {};   // per-turn passive latches (EP refunds) reset
    S._assistedPairs = new Set();   // each bond may assist once per turn again
    // IMMOVABLE (Cassia) keeps her guard through the enemy turn — everyone else's fades.
    S.heroes.forEach(h => { h.guard = keepsGuard(h.id) ? h.guard : 0; h.counter = 0; h.invuln = false; h.exposed = 0; h._hitByE = []; h.hexed = Math.max(0, (h.hexed || 0) - 1); });
    // EXPOSED (mark) now survives the turn rollover but FADES by 1, so a mark
    // laid down this turn still pays off next turn — making it a real setup,
    // not a same-turn-only tax.
    S.enemies.forEach(e => { e.mark = Math.max(0, (e.mark || 0) - 1); e.acted = false; e._hitBy = []; e.staggered = false; });
    S.tempCards = S.tempCards.filter(t => t.expiresTurn == null || t.expiresTurn >= S.turn);
    S._pressUsed = false;
    S._taunt = null;             // Cassia's TAUNT lasted the enemy round it provoked
    S.combo = 0;                 // the LINK chain is a within-turn combo
    S.channelUsed = false;
    S.executing = false;
    $('#stage').classList.remove('executing');
    // TURN-START passives — the wall braces, the light finds the hurt, the hunt resumes.
    livingHeroes().forEach(h => firePassives('turnStart', h.id, {}));
    // CAST-TIME payoff — a spell begun last turn UNLEASHES now (Hask's big casts).
    for (const h of livingHeroes()) { if (h.pendingCast && !S.over) await unleashCast(h); }
    turnBanner('TURN ' + S.turn, 'tb-player');
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
  turnBanner('ENEMY TURN', 'tb-enemy');
  _parryStreak = 0;   // a fresh parry combo for the phase
  // WEAKENED expires if you didn't capitalize this turn; STAGGERED holds
  // through the phase — a staggered enemy can be interrupted below.
  livingEnemies().forEach(e => { e.weakened = false; });
  await sleep(620);
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
    else { intent = e.def.intents[e.intentIdx % e.def.intents.length]; e.intentIdx++; }
    e.acted = true;
    renderTimeline();
    // INTERRUPT: a staggered enemy cannot release a HEAVY intent — the
    // wind-up breaks (the Bloodborne moment: aggression stops the big hit).
    if (e.staggered && intent.heavy) {
      e.staggered = false;
      popupAt(figEl(e.uid), 'INTERRUPTED', 'info');
      flashNarrator(e.def.name + '’s ' + intent.name + ' is BROKEN by the stagger.');
      SFX.kill();
      stageShake();
      renderAll();
      await sleep(650);
      continue;
    }
    const lungeEl = figEl(e.uid);
    if (intent.kind === 'buff') {
      await sleep(400);
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
      const res = await runParry(figEl(ptHero.id), parryPatternFor(intent), intent.attackArt);
      const mit = res ? res.mit : 0;                    // fraction of the blow negated
      if (res && res.perfect) {
        perfectParry = true; parryMul = 0;
        popupAt(figEl(ptHero.id), '⚔ PERFECT — +BURST ✦', 'tech');
        flashNarrator(ptHero.def.name + ' turns the blow — the burst swells!');
        parryFlash(figEl(ptHero.id));
        addEmbers(1); if (S) S._embersRun = (S._embersRun || 0) + 1;   // mastery pays embers
        gainMomentum(24, { combo: true });   // parry FEEDS the burst
        lungeFig(figEl(ptHero.id));
        // FLAWLESS RIPOSTE — a whole cascade read PERFECTLY counters for damage.
        const rip = res.flawless ? parryRiposteDmg(res.notes || 1) : 0;
        if (rip > 0 && !e.dead) {
          flashNarrator('✦ FLAWLESS — ' + ptHero.def.name + ' RIPOSTES for ' + rip + '!');
          cineFlash('rgba(255,205,130,0.42)'); stageShake('lg');
          lungeFig(figEl(ptHero.id));
          dealToEnemy(e, rip, ptHero.def.school, ptHero.id);   // through the hero's school → can exploit weakness
          popupAt(figEl(e.uid), '⚔ RIPOSTE ' + rip, 'dmg popup-big');
          gainMomentum(10, { combo: true });   // a flawless string surges extra burst
        }
        renderAll();
        await sleep(rip > 0 ? 340 : 240);
        if (e.dead || S.over) continue;
      } else if (mit > 0) {
        // PARTIAL — you caught some of the cascade; only the missed share lands
        parryMul = 1 - mit;
        popupAt(figEl(ptHero.id), '⛨ ' + Math.round(mit * 100) + '% PARRIED · +BURST', 'guard');
        gainMomentum(Math.round(6 + mit * 14), { combo: true });
      } else {
        parryMul = weightMode ? PARRY_MISS_MULT : 1;    // fully unparried = more weight
        if (weightMode) popupAt(figEl(ptHero.id), 'UNPARRIED!', 'dmg');
      }
    } else {
      await sleep(400);
    }
    // The boss was KO'd MID-ATTACK — a flawless-parry RIPOSTE or a COUNTER dropped
    // its stage during the wind-up.  It's reforming: cancel the rest of the string
    // (no un-telegraphed blow lands, no next note fires) and let the cutscene play.
    if (S._staging) break;
    let dmg = Math.round(enemyIntentDmg(e, intent) * parryMul);
    if (e.lull) e.lull = 0;
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
          popupAt(figEl(e.uid), '⚡ FOLLOW-UP +2', 'info');
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
          const dtier = left >= 20 ? 3 : left >= 12 ? 2 : left >= 7 ? 1 : 0;
          const big = dtier >= 2;
          popupAt(figEl(h.id), '−' + left, 'dmg' + (big ? ' popup-big' : ''));
          impactFx(figEl(h.id), 'foe', big);   // red claw-strike on the hero
          struck(figEl(h.id), 'l'); haptic(dtier >= 2 ? HAP.struckBig || HAP.struck : HAP.struck);   // recoil + flash + stun
          hitFlash(dtier);                      // a heavy enemy blow rocks the screen
          SFX.hit(big);
          if (dtier >= 1) stageShake(['sm', 'sm', 'lg', 'xl'][dtier]);
          (e._damaged || (e._damaged = [])).push(h.id);   // remembered for AVENGE
          // DRAIN — the Maw feeds: a share of the damage dealt heals it.  Staggered
          // (its wind-up broken) it cannot feed, so STAGGER is the counter.
          if (intent.drain && !e.staggered) {
            const fed = Math.max(1, Math.round(left * intent.drain));
            e.hp = Math.min(e.maxHp, e.hp + fed);
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
      if (h.hp === 0) { h.downed = true; popupAt(figEl(h.id), 'DOWN', 'dmg'); }
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
      if (cut > 0 && !e.staggered) { const fed = cut * 9; e.hp = Math.min(e.maxHp, e.hp + fed); popupAt(figEl(e.uid), '♥ +' + fed, 'heal'); flashNarrator(e.def.name + ' feeds on the broken bond.'); }
    }
    // ECHO — an unparried echo strike is REMEMBERED and returns next round,
    // stronger.  A PERFECT parry silences it before it can ring out again.
    if (intent.echo && !intent.echoOf && !perfectParry) { e.echoStored = { intent, dmgBonus: intent.echoBonus || 4 }; popupAt(figEl(e.uid), '◈ ECHO STORED', 'info'); }
    renderAll();
    await sleep(400);
    if (checkEnd()) break;
    // A clear BREATHER between the boss's two blows — the second wind-up gets its
    // own telegraph and a beat to read, so the pair lands as call-and-response
    // instead of a single overwhelming wall of notes.
    if (atk + 1 < times) { flashNarrator(e.def.name + ' winds up again…'); await sleep(Math.round(560 * _parrySpeed)); }
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
    flashNarrator((e && e.def ? e.def.name : 'It') + ' SEVERS your bonds — the thread snaps.');
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
  // Write survivors' HP back into the run.  A DOWNED hero STAYS down (hp 0) — no
  // free between-fight revive; only a CAMPFIRE brings them back.  Position memory:
  // the next fight opens where each hero stood.
  let bondLines = [];
  if (S.node.useRunHp && RUN) {
    RUN.rows = RUN.rows || {};
    S.heroes.forEach(h => { RUN.hp[h.id] = h.downed ? 0 : h.hp; RUN.rows[h.id] = h.row; });
    if (S.node.mapId != null && !RUN.completed.includes(S.node.mapId)) RUN.completed.push(S.node.mapId);
    // Fighting together with a thread held IS the reward: the pair grows.
    RUN.bonds = RUN.bonds || {};
    S.threads.forEach(k => {
      const before = RUN.bonds[k] || 0;
      RUN.bonds[k] = before + 1;
      const [a, b] = k.split('|');
      const name = HEROES[a].name + ' ─ ' + HEROES[b].name;
      bondLines.push(before + 1 === BOND_KINDLED ? name + ' · KINDLED' : name + ' +1');
    });
    saveRun();
  }
  const isBoss = S.node.isBoss || S.node.enemies.some(id => ENEMY_DEFS[id].boss);
  // a CLEAR pays a small steady bounty on top of the per-kill embers, so every
  // fight advances the tree a little (not just a trickle between boss lumps).
  const clearBonus = isBoss ? 3 : (S.node.elite ? 2 : 1);
  addEmbers(clearBonus); S._embersRun = (S._embersRun || 0) + clearBonus;
  SFX.victory();
  setTimeout(() => {
    if (!S) return;   // the fight was torn down before this deferred beat fired
    if (isBoss && S.node.mapId != null) { onFloorCleared(); return; }   // floor boss → deeper, or the run's end
    const th = S.threads.size;
    showOverlay(`
      <div class="ov-eyebrow" style="color:var(--gold-bright)">VICTORY</div>
      <div class="ov-title" style="font-size:22px">${isBoss ? 'THE ECHO FADES' : 'THE ROAD HOLDS'}</div>
      ${th ? `<div class="ov-sub">${th} thread${th > 1 ? 's' : ''} held${S.triadFormed ? ' · the triad answered' : ''}</div>` : ''}
      ${S._embersRun ? `<div class="ov-embers">✦ ${S._embersRun} embers gathered — spend them on the <b>Ember Tree</b></div>` : ''}
      ${bondLines.length ? `<div class="bond-growth">${bondLines.map(l => `<span class="bg-line${/KINDLED/.test(l) ? ' bg-kindled' : ''}">♡ ${l}</span>`).join('')}</div>` : ''}
      <button class="ov-btn primary" id="ov-next">CONTINUE</button>
    `);
    const wasElite = !!S.node.elite;   // an elite kill hands you a companion's gift
    $('#ov-next').onclick = () => {
      hideOverlay();
      if (S.node.mapId == null) { advanceFlow(); return; }
      if (wasElite) showBoonDraft(() => showMap(), { eyebrow: 'THE ELITE FALLS', title: 'SPOILS OF THE ROAD', flavor: 'The harder the fight, the more your companions have to teach. Take one — it holds until you fall.' });
      else showMap();
    };
  }, 700);
}
function onDefeat() {
  MUSIC.stop();   // the theme dies with the party
  // On the Descent, death is contribution: the run ends, and the Abyss
  // stores a memory of who fell here — the next descent will find it.
  if (S.node.mapId != null && RUN) {
    const memLevel = S.node.level != null ? S.node.level : S.node.depth;
    const abyss = loadAbyss();
    abyss[memLevel] = {
      trio: RUN.active.slice(),
      threads: [...S.threads],
      label: S.node.label || (mapNode(S.node.mapId) || {}).label || 'the dark',
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
            ${stat(stats.threads, 'threads held')}
            ${stat(stats.kindled, 'skills kindled')}
            ${stat(stats.embers, 'embers torn')}
          </div>
          <div class="go-memory">Nothing here is wasted. <b>The Abyss remembers</b> — the next to descend will find where you fell.</div>
          <button class="ov-btn primary" id="ov-fallen">RETURN TO THE SURFACE</button>
        </div>
      `, 'game-over');
      $('#ov-fallen').onclick = () => { hideOverlay(); showTitle(); };
    }, 700);
    return;
  }
  // Tutorial defeats stay forgiving: retry the same beat.
  setTimeout(() => {
    showOverlay(`
      <div class="ov-eyebrow">DEFEAT</div>
      <div class="ov-title" style="font-size:22px">THE THREAD FRAYS</div>
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
  RUN.roster.forEach(id => { RUN.hp[id] = HEROES[id].maxHp; });   // catch your breath before the deep
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
  showOverlay(`
    <div class="ov-eyebrow" style="color:var(--gold-bright)">THE HOLLOW CHORUS · SILENCED</div>
    <div class="ov-title" style="font-size:26px">THE LAST ECHO FADES</div>
    <div class="ov-lines" style="text-align:center; min-height:0;">
      <div class="ov-line">Three voices in one throat, and every one of them cut. The Chorus comes apart into a hush so complete you can hear your own hearts — <b>all of them, still beating, together</b>.</div>
      <div class="ov-line"><b>The thread held — all the way to the bottom.</b> Every triangle you never formed still waits in the dark: other trios, other vows, another descent.</div>
    </div>
    <button class="ov-btn primary" id="ov-title">BACK TO TITLE</button>
  `);
  $('#ov-title').onclick = () => { RUN = null; saveRun(); showTitle(); };
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
  hideOverlay();
  flashNarrator(node.narrator || '');
  renderAll();
  openingWeaves();   // kindled bonds enter already woven (their Chain is live from turn one)
}

function showStory(node) {
  let revealed = 1;
  const render = () => {
    const linesHtml = node.lines.slice(0, revealed).map(l =>
      `<div class="ov-line">${l.spk ? `<span class="spk">${l.spk}</span>` : ''}${l.text}</div>`).join('');
    const done = revealed >= node.lines.length;
    showOverlay(`
      <div class="ov-eyebrow">${node.eyebrow || ''}</div>
      <div class="ov-title" style="font-size:24px">${node.title}</div>
      <div class="ov-lines">${linesHtml}</div>
      ${done
        ? `<button class="ov-btn primary" id="ov-go">${(node.next === 'descent' || node.beginDescent) ? 'BEGIN THE DESCENT' : (FLOW[flowIdx + 1] && FLOW[flowIdx + 1].type === 'fight' ? 'TO BATTLE' : 'CONTINUE')}</button>`
        : `<div class="ov-tap">tap to continue ▸</div>`}
    `);
    if (done) {
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
        return `<button class="map-node mn-${n.type}${done ? ' mn-done' : ''}${reach ? ' mn-reach' : ''}${cur ? ' mn-current' : ''}${(!done && !reach) ? ' mn-locked' : ''}"
          data-node="${n.id}" ${reach ? '' : 'disabled'} title="${n.label}">
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
  const boonStrip = (RUN.boons && RUN.boons.length)
    ? `<span class="map-boons">${RUN.boons.map(id => { const b = BOON_BY_ID[id]; return b ? `<span class="map-boon" data-boon="${id}" style="--tint:${HEROES[b.hero].tint}" title="${HEROES[b.hero].name}’s ${b.name} — ${b.desc.replace(/<[^>]+>/g, '')}">${b.icon}</span>` : ''; }).join('')}</span>`
    : '';
  showOverlay(`
    <div class="ov-eyebrow">THE DESCENT${(RUN.floor || 1) >= 2 ? ` · FLOOR ${RUN.floor}` : ''}${moodDef && moodDef.label ? ` <span class="map-mood" style="color:${moodDef.tint}; border-color:${moodDef.tint}66">♦ ${moodDef.label}</span>` : ''}${boonStrip}</div>
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
// Discovery of a fallen descent — take up their thread, and their bonds echo
// into this run.  Consumed once found.
function showMemory(n, mem) {
  const names = mem.trio.map(id => (HEROES[id] || {}).name || id).join(' · ');
  const th = (mem.threads || []).length;
  showOverlay(`
    <div class="ov-eyebrow">♰ ASHES OF A DESCENT</div>
    <div class="ov-title" style="font-size:20px">SOMEONE FELL HERE</div>
    <div class="ov-lines" style="text-align:center; min-height:0">
      <div class="ov-line"><b>${names}</b> — they made it this far, once.</div>
      <div class="ov-line">${th ? `Their ${th} thread${th > 1 ? 's' : ''} still hum in the cold air.` : 'The ashes are quiet, but still warm.'}</div>
    </div>
    <button class="ov-btn primary" id="ov-takeup">TAKE UP THEIR THREAD</button>
    <div class="ov-hint">${th ? '+1 ♡ TO EACH BOND THEY HELD · ' : ''}THE PARTY HEALS 4 BY THEIR FIRE</div>
  `);
  $('#ov-takeup').onclick = () => {
    RUN.bonds = RUN.bonds || {};
    (mem.threads || []).forEach(k => { RUN.bonds[k] = (RUN.bonds[k] || 0) + 1; });
    RUN.roster.forEach(id => { RUN.hp[id] = Math.min(HEROES[id].maxHp, (RUN.hp[id] || HEROES[id].maxHp) + 4); });
    const abyss = loadAbyss();
    delete abyss[n.memLevel != null ? n.memLevel : n.level];
    saveAbyss(abyss);
    n.mem = null;
    saveRun();
    hideOverlay();
    resolveMapNode(n);
  };
}
function showEvent(n) {
  const ev = EVENTS_V2[n.eventId] || EVENTS_V2.shrine;
  const choice = (c, id) => `
    <button class="ev-choice" id="${id}">
      <span class="ev-choice-icon">${c.icon || '◆'}</span>
      <span class="ev-choice-body">
        <span class="ev-choice-label">${c.label}</span>
        <span class="ev-choice-effect">${c.effect || ''}</span>
      </span>
    </button>`;
  showOverlay(`
    <div class="ov-eyebrow">${ev.eyebrow || 'A CROSSROADS'}</div>
    <div class="ov-title" style="font-size:22px">${ev.title}</div>
    <div class="ov-lines" style="text-align:center; min-height:0">${ev.lines.map(t => `<div class="ov-line">${t}</div>`).join('')}</div>
    <div class="ev-choices">${choice(ev.a, 'ev-a')}${choice(ev.b, 'ev-b')}</div>
  `, 'event-screen');
  const finish = (choice) => {
    if (!RUN.completed.includes(n.id)) RUN.completed.push(n.id);
    if (choice.boon) {   // this branch offers a companion's gift — into the draft
      saveRun();
      showBoonDraft(() => showMap(), { eyebrow: ev.title.toUpperCase(), title: 'A COMPANION’S GIFT', flavor: 'They show you a piece of how they fight. Take one — it holds until you fall.' });
      return;
    }
    if (choice.fx) choice.fx();
    saveRun();
    showMap();
  };
  $('#ev-a').onclick = () => finish(ev.a);
  $('#ev-b').onclick = () => finish(ev.b);
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
  echosunder:   { name: 'THE SUNDERING', epithet: 'IT CUTS THE THREADS', eye: '#8fe0d0', roar: 'maw',
    quote: 'Every bond you tie, I have already cut. You came down together — you will not leave that way.' },
  echochorus:   { name: 'THE HOLLOW CHORUS', epithet: 'ALL ECHOES ARE ITS VOICE', eye: '#e8b84a', roar: 'maw',
    quote: 'Knight. Maw. Sundering — three voices you have already silenced. I am the one that sang them all.' },
};
let _bossCineBusy = false;
function bossIntro(bossId, onDone) {
  const c = BOSS_CINE[bossId] || BOSS_CINE.echoknight2;
  const def = ENEMY_DEFS[bossId] || {};
  const art = V2PORTRAITS[def.art || bossId] || '';
  bossCine(Object.assign({ art, skip: 'TAP TO FACE IT' }, c), onDone);
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
  renderAll();
  // BEAT 2 — after the death lands, the reform cutscene, then rise anew.
  setTimeout(() => {
    e._justDied = false;
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
// SAY across two beats decides how it lands.  There's only one way to travel
// together — but the talk sets the TERMS:
//   friend  — you met them warm         → they walk with you, a bond already bound
//   neutral — pragmatic / wary          → they walk with you, no bond yet (warmth is earned)
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
    ]);
  });
}
function showRecruit(n) {
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
function jcPick(st, o) {
  st.tone += (o.tone || 0);
  if (o.hostile) st.hostile = true;
  if (!st._beat2) {
    st._beat2 = true;
    st.bucket = toneBucket(o.tone || 0);
    jcPlay(st, [{ side: 'them', speaker: st.trav.speaker, text: st.trav.react[st.bucket] }],
      () => jcChoose(st, st.trav.opts2[st.bucket].slice()));
  } else {
    hideOverlay();
    if (st.hostile) return foeTraveler(st.n);
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
    ? `You climb on together — and the talk carried. <b>${h.name}</b> walks at your side with a thread <b>already bound</b> between you.`
    : `<b>${h.name}</b> falls in with you — pragmatic, watchful. Two climbers, one dark. The warmth will have to be earned on the way up.`;
  showTravelerOutcome(rid, friend ? '♡ A THREAD IS BOUND' : 'A WARY ALLIANCE', h.name + ' WALKS WITH YOU', beat, false, rid);
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
    `You wrong <b>${h.name}</b>, and they mark you for it. They melt into the dark — but the reach is long, and they are <b>waiting on the road ahead</b>.`, true, rid);
}
// Shared cinematic outcome beat for friend / neutral / decline / foe.
function showTravelerOutcome(figId, eyebrow, title, beat, foe, mustInclude) {
  showOverlay(`
    <div class="tc-bar tc-bar-t"></div>
    <div class="tc-bar tc-bar-b"></div>
    <div class="tc-vign"></div>
    <div class="tc-body">
      <div class="tc-eyebrow${foe ? ' tc-eyebrow-foe' : ''}">${eyebrow}</div>
      ${figId ? `<div class="tc-portrait${foe ? ' tc-foe-art' : ''}"><span class="tc-glow"></span><span class="tc-art">${V2PORTRAITS[figId] || ''}</span></div>` : '<div class="tc-portrait tc-portrait-empty"></div>'}
      <div class="tc-name">${title}</div>
      <div class="tc-scene tc-scene-wide">${beat}</div>
      <div class="tc-choices"><button class="tc-choice tc-friend" id="rc-next"><span class="tc-c-label">${RUN.roster.length > 3 ? 'CHOOSE YOUR LINE' : 'ONWARD'}</span></button></div>
    </div>
  `, 'traveler-cine' + (foe ? ' tc-foe-scene' : ''));
  $('#rc-next').onclick = () => { hideOverlay(); (RUN.roster.length > 3) ? showPartySelect(() => showMap(), mustInclude) : showMap(); };
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
  const cardHtml = (b) => `
    <button class="boon-card${b.trio ? ' boon-trio' : b.duo ? ' boon-duo' : ''}${b.rare ? ' boon-rare' : ''}" id="boon-${b.id}" style="--tint:${HEROES[b.hero].tint}">
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
    const art = V2PORTRAITS[def.art || id] || '';
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
  const TABS = [['boons', '✦ BOONS'], ['bestiary', '☠ BESTIARY'], ['heroes', '⚔ HEROES']];
  const body = tab === 'bestiary' ? journalBestiaryHtml() : tab === 'heroes' ? journalHeroesHtml() : journalBoonsHtml();
  showOverlay(`
    <div class="ov-eyebrow" style="color:var(--gold-bright)">DISCOVERY</div>
    <div class="ov-title" style="font-size:21px; margin-bottom:8px;">JOURNAL</div>
    <div class="bj-tabs">${TABS.map(([k, l]) => `<button class="bj-tab${k === tab ? ' bj-tab-on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>
    ${body}
    <button class="ov-btn et-back-btn" id="bj-back">◂ BACK</button>
  `, 'map-screen bj-screen');
  document.querySelectorAll('.bj-tab').forEach(el => { el.onclick = () => { if (el.dataset.tab !== tab) showJournal(onBack, el.dataset.tab); }; });
  $('#bj-back').onclick = onBack || showTitle;
}
// Back-compat alias — older callers open the Journal on the Boons tab.
function showBoonJournal(onBack) { showJournal(onBack, 'boons'); }
function showCamp(n) {
  // The fire closes every wound on the LIVING — but the fallen do not rise on
  // their own.  Raising them is a deliberate camp act (see the RAISE choice).
  RUN.roster.forEach(id => { const hp = RUN.hp[id] ?? HEROES[id].maxHp; if (hp > 0) RUN.hp[id] = HEROES[id].maxHp; });
  if (!RUN.completed.includes(n.id)) RUN.completed.push(n.id);
  saveRun();
  const fallen = (RUN.roster || []).filter(id => (RUN.hp[id] ?? 1) <= 0);
  // CINEMATIC CAMPFIRE — the party gathers, lit warm by the fire; the night's
  // one choice is offered as cards over the scene (mirrors the JRPG cutscenes).
  const party = ((RUN.active && RUN.active.length) ? RUN.active : RUN.roster).slice();
  const mid = (party.length - 1) / 2;
  const heroes = party.map((id, i) => {
    const side = i < mid ? 'l' : i > mid ? 'r' : 'c';   // right side faces the fire (flipped)
    return `<span class="camp-hero camp-hero-${side}" style="--off:${(i - mid).toFixed(2)}">${V2PORTRAITS[id] || ''}</span>`;
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
        <div class="camp-flavor">The fire holds back the dark. <b>Every wound on the living closes.</b>${fallen.length ? ` But <b>${fallen.map(id => HEROES[id].name).join(' & ')}</b> ${fallen.length > 1 ? 'lie' : 'lies'} still — the fire alone will not raise them.` : ''}</div>
      </div>
      <div class="camp-choices">
        ${fallen.length ? choice('camp-raise', '☨', 'RAISE THE FALLEN', `<b>${fallen.map(id => HEROES[id].name).join(' & ')}</b> ${fallen.length > 1 ? 'return' : 'returns'} at <b>half HP</b> — the fire’s only gift tonight.`) : ''}
        ${choice('camp-fire', '♡', 'SHARE THE FIRE', 'Deepen your weakest bond <b>+1</b>.')}
        ${choice('camp-steel', '▲', 'SHARPEN STEEL', 'Open the next fight with <span class="kw kw-rally">▲ RALLY +2</span>.')}
        ${choice('camp-boon', '✦', 'COMMUNE AT THE FIRE', 'A companion shares a gift — <b>draw 1 of 3</b>.')}
      </div>
    </div>
  `, 'camp-cine');
  const raiseBtn = $('#camp-raise');
  if (raiseBtn) raiseBtn.onclick = () => {
    fallen.forEach(id => { RUN.hp[id] = Math.max(1, Math.ceil(HEROES[id].maxHp / 2)); });
    saveRun();
    showTravelerOutcome(fallen[0], '☨ RAISED FROM THE DARK', fallen.map(id => HEROES[id].name).join(' & ') + (fallen.length > 1 ? ' RISE' : ' RISES'),
      `The fire takes what the dark left. <b>${fallen.map(id => HEROES[id].name).join(' & ')}</b> ${fallen.length > 1 ? 'stand' : 'stands'} again — half-alive, wholly here. Tonight the fire had only this to give.`, false, fallen[0]);
  };
  $('#camp-fire').onclick = () => showCampScene(n);
  $('#camp-steel').onclick = () => {
    RUN.campEdge = true;
    saveRun();
    showPartySelect(() => showMap());
  };
  $('#camp-boon').onclick = () => showBoonDraft(() => showMap(), { eyebrow: n.label.toUpperCase(), title: 'A COMPANION’S GIFT', flavor: 'By the fire, someone shares a piece of how they fight. Take one — it holds until you fall.' });
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
    <div class="et-forge-note">These tempers hold only for this descent — spend freely, or bank toward the tree.</div>
    <div class="et-tier-row">${offers}</div>
    <button class="ov-btn" id="forge-back">◂ BACK TO THE FIRE</button>
  `, 'map-screen et-screen');
  document.querySelectorAll('.et-node:not([disabled])').forEach(el => {
    el.onclick = () => {
      const f = FORGE_BY_ID[el.dataset.id];
      if (!f || RUN.forges.includes(f.id) || runEmbers() < f.cost) return;
      addEmbers(-f.cost); RUN.forges.push(f.id); saveRun();
      SFX.thread();
      showForge(n);
    };
  });
  $('#forge-back').onclick = () => showCamp(n);
}
// A small scene by the fire between the two LEAST-bonded active companions —
// where the numbers become people.
function showCampScene(n) {
  const ids = RUN.active.slice();
  let pair = null, low = Infinity;
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const pts = bondPts(pairKey(ids[i], ids[j]));
    if (pts < low) { low = pts; pair = [ids[i], ids[j]]; }
  }
  if (!pair) { showPartySelect(() => showMap()); return; }
  const [a, b] = pair;
  const key = pairKey(a, b);
  const before = bondPts(key);
  RUN.bonds = RUN.bonds || {};
  RUN.bonds[key] = before + 1;
  saveRun();
  const kindledNow = before + 1 === BOND_KINDLED;
  showStory({
    type: 'story', chapter: 3, title: 'BY THE FIRE', eyebrow: n.label.toUpperCase(),
    lines: [
      { text: 'The pot is shared. The watch is set. Two of them sit a little apart from the dark.' },
      { spk: HEROES[a].name, text: CAMP_VOICES[a] || '…' },
      { spk: HEROES[b].name, text: CAMP_VOICES[b] || '…' },
      { text: `The fire holds. <b>♡ ${HEROES[a].name} ─ ${HEROES[b].name}${kindledNow ? ' · KINDLED' : ' +1'}</b>${kindledNow ? ' — they will walk into every battle already connected.' : '.'}` },
    ],
    campDone: true,
  });
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
        if (pts >= BOND_KINDLED) out.push(`♡ ${HEROES[line[i]].name} ─ ${HEROES[line[j]].name} · kindled`);
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
    ${who.hexed ? `<span class="chip hex${chipPop(who,'hexed',who.hexed)}" title="HEXED — your card plays burn your hand">☠ HEXED</span>` : ''}`;
}
function partyAuraObj(who) { return { guard: who.guard, rally: who.buffDmg, chill: who.chill, exposed: who.exposed, counter: who.counter, invuln: who.invuln }; }
// Refresh a REUSED party figure in place — swap only what changed.
function refreshPartyFig(fig, who, solo) {
  const chips = fig.querySelector('.fig-chips'); if (chips) chips.innerHTML = partyChipsHtml(who);
  const fill = fig.querySelector('.hp-fill'); if (fill) fill.style.width = ((who.hp / who.maxHp) * 100) + '%';
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
  if (!S) return;
  applyFightBg();
  renderTimeline();
  renderBattlefield();
  renderThreads();
  renderResonance();
  renderCombatBoons();
  renderActionBar();
}
// The fight backdrop shows only during battle (S set) and only if the player
// hasn't switched it off in DEV.  Toggled here + cleared by the map/title.
function applyFightBg() {
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
    slot.innerHTML = `<span class="slot-ring"></span><span class="slot-danger" aria-hidden="true"><span class="sd-brackets"><i></i><i></i><i></i><i></i></span><span class="sd-wave"></span></span>${dRow > 0 ? `<span class="slot-dmg${lethalRow ? ' sd-dmg-lethal' : ''}">${lethalRow ? '☠' : '✕'} ${dRow}</span>` : ''}`;
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
          <div class="fig-art">${V2PORTRAITS[who.id] || ''}${who.downed ? '' : auraHTML(partyAuraObj(who))}<div class="fig-chips">${partyChipsHtml(who)}</div></div>
          <div class="hp-bar"><div class="hp-fill" style="width:${(who.hp / who.maxHp) * 100}%"></div></div>
          <div class="fig-name">${who.def.name} <span class="hp-num">${who.hp}/${who.maxHp}</span></div>
        `;
        attachHeroDrag(fig, who);
        _partyFigs[who.id] = fig;
      }
      fig.className = 'figure party' + (who.downed ? ' downed' : '') + (targetable ? ' fig-targetable' : '') + (canMove(who) ? ' can-move' : '');
      snapFx(who, { invuln: who.invuln ? 1 : 0, guard: who.guard, buffDmg: who.buffDmg, counter: who.counter, exposed: who.exposed, chill: who.chill });
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
      const fig = document.createElement('div');
      // PRIMED — this foe is set up for a TECHNICAL detonation (chilled or
      // weakened).  A pulsing electric ring + ⚡ tag reads "hit me for a combo".
      const primed = !!(e.lull || e.weakened || e.staggered);
      fig.className = 'figure enemy' + (e._justDied ? ' fig-dying' : '') + (primed && !e._justDied ? ' fig-primed' : '');
      fig.dataset.fig = e.uid;
      const targetable = targeting && !targeting.isRow && targeting.validIds.includes(e.uid);
      if (targetable) fig.classList.add('fig-targetable');
      fig.innerHTML = enemyFigInner(e);
      snapFx(e, { weakened: e.weakened ? 1 : 0, staggered: e.staggered ? 1 : 0, guard: e.guard, power: e.power, mark: e.mark, lull: e.lull });
      fig.onclick = () => onFigureTap(e.uid);
      slot.appendChild(fig);
    }
    enemyHalf.appendChild(slot);
  });
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
  // The pill stays clean: damage + target row + status.  The parry GESTURE is NOT
  // previewed — you read the foe's type & the attack and react at the ring.
  return `<span class="i-seg"><span class="i-glyph">⚔</span><span class="i-dmg">${enemyIntentDmg(e, it)}</span><span class="i-arrow">→</span><span class="i-row">${row === 'all' ? 'ALL' : ROW_LABEL[row]}</span>${it.hex ? '<span class="i-st kw-hex" title="HEX — if it lands, your card plays burn your hand; dodge it">☠</span>' : ''}${it.drain ? '<span class="i-st kw-drain" title="drains life — heals the Maw">♥</span>' : ''}${it.chill ? '<span class="i-st kw-chill" title="chills you">❄</span>' : ''}${it.expose ? '<span class="i-st kw-exposed" title="exposes you">◎</span>' : ''}${it.shove === 'front' ? '<span class="i-st kw-shove" title="DRAGS the struck hero one row forward — parry to hold your ground">⇱</span>' : ''}${it.shove === 'back' ? '<span class="i-st kw-shove" title="SHOVES the struck hero one row back — parry to hold your ground">⇲</span>' : ''}</span>`;
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
      <span class="chip weak${e.weakRevealed ? ' revealed' : ''}" title="weakness — strike this element to WEAKEN, again to STAGGER">${e.weakRevealed ? `<span class="ru-i">${SCHOOL_GLYPH[e.def.weak] || '?'}</span>WEAK: ${(e.def.weak || '?').toUpperCase()}` : `<span class="ru-i">◇</span>? ? ?`}</span>
      ${e.weakened ? `<span class="chip mark${chipPop(e,'weakened',1)}"><span class="ru-i">⌖</span>WEAKENED</span>` : ''}
      ${e.staggered ? `<span class="chip stagger${chipPop(e,'staggered',1)}"><span class="ru-i">⚡</span>STAGGERED</span>` : ''}
      ${e.guard ? `<span class="chip guard${chipPop(e,'guard',e.guard)}"><span class="ru-i">⛨</span>GUARD ${e.guard}</span>` : ''}
      ${e.power ? `<span class="chip buff${chipPop(e,'power',e.power)}"><span class="ru-i">▲</span>RAGE ${e.power}</span>` : ''}
      ${e.mark ? `<span class="chip mark${chipPop(e,'mark',e.mark)}"><span class="ru-i">◎</span>EXPOSED ${e.mark}</span>` : ''}
      ${e.lull ? `<span class="chip chill${chipPop(e,'lull',e.lull)}"><span class="ru-i">❄</span>CHILL ${e.lull}</span>` : ''}
    </div>`;
}
function enemyAuraHtml(e) {
  return e._justDied ? '' : auraHTML({ guard: e.guard, rally: e.power, chill: e.lull, exposed: e.mark, weak: e.weakened, stagger: e.staggered });
}
// The inner markup for an enemy figure (shared by the line + the floor boss).
function enemyFigInner(e) {
  return `
    ${enemyIntentHtml(e)}
    <div class="fig-art">${enemyArt(e)}${enemyAuraHtml(e)}${enemyChipsHtml(e)}</div>
    <div class="hp-bar"><div class="hp-fill" style="width:${(e.hp / e.maxHp) * 100}%"></div></div>
    <div class="fig-name">${e.def.name} <span class="hp-num">${e.hp}/${e.maxHp}</span></div>
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
function renderResonance() {
  const el = $('#resonance'); if (!el) return;
  const live = S ? livingHeroes() : [];
  if (!S || S.node.chapter < 2 || live.length < 3) { el.classList.add('hidden'); el.classList.remove('rz-ready'); return; }
  el.classList.remove('hidden');
  const ids = live.slice(0, 3).map(h => h.id);
  const C = [{ x: 23, y: 7 }, { x: 43, y: 39 }, { x: 3, y: 39 }];
  const E = [[0, 1], [1, 2], [0, 2]];
  let formed = 0;
  const edges = E.map(([i, j]) => {
    const on = S.threads.has(pairKey(ids[i], ids[j])); if (on) formed++;
    return `<line x1="${C[i].x}" y1="${C[i].y}" x2="${C[j].x}" y2="${C[j].y}" class="rz-edge${on ? ' on' : ''}"/>`;
  }).join('');
  const fill = formed === 3 ? `<polygon points="${C.map(c => c.x + ',' + c.y).join(' ')}" class="rz-fill"/>` : '';
  const dots = ids.map((id, i) => `<circle cx="${C[i].x}" cy="${C[i].y}" r="4.2" class="rz-dot" style="fill:${HEROES[id].tint}"/>`).join('');
  const ready = !!S.triadFormed;
  el.classList.toggle('rz-ready', ready);
  const label = ready ? '✦ TRIAD · ALL-OUT CROWNED' : 'RESONANCE ' + formed + '/3';
  el.innerHTML = `<svg viewBox="-3 -3 52 48" class="rz-svg">${fill}${edges}${dots}</svg><span class="rz-lbl">${label}</span>`;
}

// The MOMENTUM gauge — fills as you exploit weaknesses / chain LINKs; when
// full it becomes a tappable ALL-OUT button.
// CARD CHARACTER ART — each card wears the OWNER's portrait behind its face, like
// a JRPG action card.  The url is parsed once from V2PORTRAITS (the same art as
// the combat figure), so a card always reads as that character.  A hero with only
// a drawn SVG portrait (no PNG) simply keeps the classic dark card.
const CARD_ART = {};
function cardArtUrl(id) {
  if (id in CARD_ART) return CARD_ART[id];
  const p = (typeof V2PORTRAITS !== 'undefined' && V2PORTRAITS[id]) || '';
  const m = p.match(/href="(\.\.\/art\/[^"]+\.png)"/);
  return CARD_ART[id] = (m ? m[1] : '');
}
// Per-hero BUST framing — each portrait is composed differently (Elin has a tall
// staff + headroom above her head), so a single crop can't frame them all.  These
// override the CSS default (`auto 205% / 50% 2%`) to land each character's face in
// the card.  `size | position` (CSS background-size | background-position).
const CARD_ART_FRAME = {
  elin: 'auto 232% | 50% 15%',   // skip the staff/headroom, center her face
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
  const ready = burstReady();                         // the all-out is TAPPABLE (m ≥ 100) — the escape hatch stays
  const full = (S.momentum || 0) >= cap;              // the container is CHARGED to its level — the real "ready" beat
  const wasFull = burst.classList.contains('burst-ready');
  burst.classList.toggle('burst-ready', full);        // the urgent glow only lights when the container fills
  // The label reads the level the all-out will FIRE at right now — so the choice
  // to unleash or hold-and-charge is legible without a percentage.  A woven
  // container that isn't full yet reads "HOLD" (tap still works in a pinch).
  const fl = burstFireLevel();
  $('#burst-lbl').textContent = full
    ? (fl >= 2 ? '⚡ TAP · ALL-OUT ' + '✦'.repeat(fl) : '⚡ TAP · ALL-OUT')
    : ready ? 'BURST ✦' + level + ' · HOLD'
    : (level > 1 ? 'BURST ✦' + level : 'BURST');
  burst.onclick = ready ? () => triggerAllOut() : null;
  burst.style.cursor = ready ? 'pointer' : 'default';
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
    + (S.executing ? 'X' : '') + (targeting ? 'T' : '');
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
    if (head === 'OPENER') inner = `<span class="c-role">OPENER</span>${A}`;
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
      ${card.follow ? `<span class="c-follow-avatar">${V2PORTRAITS[card.follow] || ''}</span>` : ''}
      <div class="c-top">
        <span class="c-cost tempo-${card.tempo || 'steady'}${card.cost === 0 ? ' c-free' : ''}"${card.cost === 0 ? ' title="Free — costs no EP"' : ''}>${card.cost === 0 ? '✦' : card.cost}</span>
        <span class="c-name">${card.name}</span>
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
    const overlap = total > avail ? Math.min(86, (total - avail) / Math.max(1, kids.length - 1)) : 0;
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
  const cls = el.classList.contains('enemy') ? 'fig-lunge' : 'fig-lunge-hero';
  el.classList.remove('fig-lunge', 'fig-lunge-hero'); void el.offsetWidth; el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), 420);
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
    <div class="ov-lines howto" style="text-align:left; max-width:448px; margin:0 auto; max-height:64vh; overflow-y:auto; padding-right:6px;">
      <div class="ht-head">On your turn</div>
      <div class="ov-line"><b>Play cards to fight.</b> Drag a card onto an enemy to attack, or onto an ally to help. Each card costs <b>EP</b> — your energy, which refills every turn.</div>
      <div class="ov-line"><b>Reposition your heroes.</b> Drag a hero between the <b>FRONT · MID · BACK</b> rows. Where they stand sets their stance, so their cards change to match.</div>
      <div class="ht-head">When a foe attacks</div>
      <div class="ov-line"><b>Dodge or parry.</b> Each enemy shows the <b>row</b> it will hit. Drag that hero to a safe row to <b>DODGE</b> — or stand and <b>PARRY</b>: tap each note the instant its ring flashes gold. Good timing turns the blow aside.</div>
      <div class="ht-head">Build your BURST</div>
      <div class="ov-line"><b>Fill the gauge, then unleash.</b> Landing hits and clean parries fill your <b>BURST</b>. When it glows ready, <b>tap the gauge</b> to unleash an <b>ALL-OUT</b> — the whole party piles onto the enemy line at once.</div>
      <div class="ht-head">Bonds</div>
      <div class="ov-line"><b>Fight as one.</b> Help one another to form <b>threads</b>; fight together again and a pair <b>kindles</b> into a <b>weave</b>. Then, when you play a <b>FINISHER</b> with one, their partner gets a free <b>CHAIN</b> card to play. Your bonds also <b>empower your ALL-OUT</b> — bond all three and it ends in a <b>TRIAD FINALE</b>.</div>
      <div class="ht-head">Between fights</div>
      <div class="ov-line"><b>Grow stronger.</b> Winning earns <b>✦ embers</b> — spend them on your <b>Ember Tree</b> to unlock new cards. Take companion <b>gifts</b>, and <b>rest</b> at campfires to heal.</div>
      <div class="ov-line ht-tip">Tip: press &amp; hold any card to read it up close.</div>
    </div>
    <button class="ov-btn primary" id="ht-back">◂ BACK</button>
  `, 'menu-screen');
  $('#ht-back').onclick = () => (back || showMenu)();
}
// FULL PROGRESS RESET (dev) — wipe everything that makes the game "not
// first-time": unlocked heroes, tutorial flow, one-time coaches, the abyss
// memories and vow ranks, the current run, and Heat.  Device prefs (sound,
// fight background) and the entry gate are left alone.
function resetProgress() {
  [STARTERS_KEY, LAST_STARTER_KEY, PROGRESS_KEY, RUN_KEY, ABYSS_KEY, VOWS_KEY, META_KEY,
   'kizuna2_1.treeTaught', 'kizuna2_1.parryLessons', 'kizuna2_1.strikeLessons']
    .forEach(k => { try { localStorage.removeItem(k); } catch (_) {} });
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
    <div class="tt-ver">V2.1 · BUILD ${V2_BUILD}</div>
  `, 'title-cine');
  $('#t-new').onclick = () => showStarterSelect(id => beginRun(id));
  const c = $('#t-continue');
  if (c) c.onclick = () => {
    const r = loadRun();
    if (r && !r.done) { RUN = r; showMap(); }
    else showStarterSelect(id => beginRun(id));
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
      <button class="menu-item" id="s-heat"><span>HEAT <i style="opacity:.6">· foes hit harder, +embers</i></span><span class="menu-heat"><button id="s-heat-dn" aria-label="lower heat">−</button><b>${META.heat || 0}</b><button id="s-heat-up" aria-label="raise heat">+</button></span></button>
      <button class="menu-item" id="s-howto"><span>HOW TO PLAY</span><span class="menu-val">?</span></button>
      <button class="menu-item menu-dev" id="s-dev"><span>⚙ DEV TOOLS</span><span class="menu-val">›</span></button>
      <button class="menu-item menu-primary" id="s-back">◂ BACK</button>
    </div>
  `, 'menu-screen');
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
const TREE_TYPE_LABEL = { card: 'COMBO', rider: 'UPGRADE', passive: 'PASSIVE', allout: 'ALL-OUT', emergent: 'EMERGENT', synergy: 'TEAM SYNERGY', branch: 'FORK', execute: 'EXECUTIONER', afterimage: 'AFTERIMAGE', chain: 'KIZUNA' };
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
const TREE_PAN = {};    // per-hero pan offset, kept across re-renders (selecting a node re-renders)
const TREE_ZOOM = {};   // per-hero zoom (1 = default, same as before)
const TREE_ZMIN = 0.6, TREE_ZMAX = 2.0;
// Drag-to-pan AND pinch/button-ZOOM the constellation, so the tier-3/4 arms that
// reach past the canvas are always tap-able and you can pull back for the whole
// map or lean in on one branch.  Suppresses the orb SELECT click on a real drag.
function attachTreePan(heroId) {
  const canvas = document.getElementById('et-canvas');
  const pan = document.getElementById('et-pan');
  if (!canvas || !pan) return;
  const clamp = (v) => { const c = 165 * (TREE_ZOOM[heroId] || 1); return Math.max(-c, Math.min(c, v)); };
  let ox = (TREE_PAN[heroId] && TREE_PAN[heroId].x) || 0;
  let oy = (TREE_PAN[heroId] && TREE_PAN[heroId].y) || 0;
  let z = TREE_ZOOM[heroId] || 1;
  const apply = () => { pan.style.transform = `translate(${ox}px, ${oy}px) scale(${z})`; };
  apply();
  const setZoom = (nz) => { z = Math.max(TREE_ZMIN, Math.min(TREE_ZMAX, nz)); TREE_ZOOM[heroId] = z; ox = clamp(ox); oy = clamp(oy); TREE_PAN[heroId] = { x: ox, y: oy }; apply(); };
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
    TREE_PAN[heroId] = { x: ox, y: oy }; apply();
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
function showEmberTree(onBack, heroId, selId) {
  $('#stage').classList.remove('show-bg');
  // a "__kindled:" prefix on selId means we just bought that node — celebrate it
  let justKindled = false;
  if (selId && String(selId).indexOf('__kindled:') === 0) { justKindled = true; selId = selId.slice(10); }
  const party = partyHeroes();
  // only your fielded party has constellations here; clamp to a party member
  if (party.length && party.indexOf(heroId) < 0) heroId = party[0];
  heroId = heroId && HEROES[heroId] ? heroId : (party[0] || 'ash');
  const nodes = EMBER_TREE.filter(n => n.hero === heroId);
  // ---- SPHERE GRID: a hub at the centre, rings growing OUTWARD.  A node's ring
  // is its prerequisite DEPTH (0 = spokes off the hub), its angle inherited from
  // the prerequisite so a chain reads as one radial arm. --------------------------
  const W = 300, H = 300, CX = 150, CY = 150, R0 = 66, RING = 62;
  const depth = {};
  const depthOf = (n) => {
    if (depth[n.id] != null) return depth[n.id];
    const reqs = (n.requires || []).map(r => NODE_BY_ID[r]).filter(Boolean);
    return depth[n.id] = reqs.length ? 1 + Math.max.apply(null, reqs.map(depthOf)) : 0;
  };
  nodes.forEach(depthOf);
  const byDepth = {}; nodes.forEach(n => { (byDepth[depth[n.id]] = byDepth[depth[n.id]] || []).push(n); });
  const angle = {};
  // inner ring: spread the hub's spokes evenly; an even count is offset a
  // half-step so the arms sit DIAGONAL (never axis-aligned) — no two labels
  // stack on a flat horizontal spoke.
  (byDepth[0] || []).forEach((n, i, a) => { const off = a.length % 2 === 0 ? 0.5 : 0; angle[n.id] = -90 + (i + off) * (360 / a.length); });
  // deeper rings: sit at the prerequisite's angle (siblings fan apart a little)
  Object.keys(byDepth).map(Number).filter(d => d > 0).sort((a, b) => a - b).forEach(d => {
    const groups = {};
    byDepth[d].forEach(n => { const k = (n.requires || [])[0] || 'root'; (groups[k] = groups[k] || []).push(n); });
    Object.keys(groups).forEach(k => {
      const base = angle[k] != null ? angle[k] : 0, arr = groups[k];
      arr.forEach((n, i) => { angle[n.id] = base + (arr.length > 1 ? (i - (arr.length - 1) / 2) * 24 : 0); });
    });
  });
  const pos = {};
  nodes.forEach(n => {
    const a = (angle[n.id] || 0) * Math.PI / 180, r = R0 + depth[n.id] * RING;
    pos[n.id] = { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
  });
  const root = { x: CX, y: CY };
  // ---- LINKS: straight spokes — prereq → node, or hub → a depth-0 node ---------
  const links = [];
  nodes.forEach(n => {
    const reqs = (n.requires || []).filter(r => pos[r]);
    if (reqs.length) reqs.forEach(r => links.push({ a: pos[r], b: pos[n.id], on: hasNode(r), full: hasNode(r) && hasNode(n.id) }));
    else links.push({ a: root, b: pos[n.id], on: tierOpen(n.tier), full: hasNode(n.id) });
  });
  const linkSvg = links.map(l => {
    const cls = l.full ? 'et-link-full' : l.on ? 'et-link-on' : 'et-link-off';
    return `<path class="et-link ${cls}" vector-effect="non-scaling-stroke" d="M ${l.a.x} ${l.a.y} L ${l.b.x} ${l.b.y}" />`;
  }).join('');
  // faint ring guides behind the spokes, one per depth present
  const maxDepth = Math.max.apply(null, nodes.map(n => depth[n.id]));
  let ringSvg = '';
  for (let d = 0; d <= maxDepth; d++) ringSvg += `<circle class="et-ring" cx="${CX}" cy="${CY}" r="${R0 + d * RING}" vector-effect="non-scaling-stroke" />`;
  // ---- ORBS -------------------------------------------------------------------
  const orbs = nodes.map(n => {
    const st = nodeState(n);
    const p = pos[n.id];
    return `<button class="et-orb et-${st} t-${n.type}${n.id === selId ? ' et-sel' : ''}" data-id="${n.id}"
       style="left:${(p.x / W) * 100}%; top:${(p.y / H) * 100}%">
       <span class="et-orb-glyph">${st === 'owned' ? '✓' : st === 'sealed' ? '🔒' : TREE_TYPE_GLYPH[n.type]}</span>
       <span class="et-orb-name">${n.label}</span>
       ${st === 'ready' || st === 'poor' ? `<span class="et-orb-cost${st === 'poor' ? ' et-cant' : ''}">✦${n.cost}</span>` : ''}
     </button>`;
  }).join('');
  const rootOrb = `<div class="et-orb et-root" style="left:${(root.x / W) * 100}%; top:${(root.y / H) * 100}%"><span class="et-orb-glyph">◆</span></div>`;
  // ---- DETAIL BAR (selected node) ---------------------------------------------
  const sel = selId ? NODE_BY_ID[selId] : nodes.find(n => nodeState(n) === 'ready') || nodes[0];
  let detail = '<div class="et-detail-empty">Pick a node to inspect it.</div>';
  if (sel) {
    const st = nodeState(sel);
    const reqNames = (sel.requires || []).filter(r => !hasNode(r)).map(r => NODE_BY_ID[r].label);
    const action = st === 'owned' ? '<span class="et-d-owned">✓ KINDLED</span>'
      : st === 'sealed' ? `<span class="et-d-lock">descend deeper to unseal tier ${sel.tier}</span>`
      : st === 'needs' ? `<span class="et-d-lock">needs ${reqNames.join(' · ')}</span>`
      : `<button class="et-d-buy${st === 'poor' ? ' et-d-cant' : ''}" id="et-buy" ${st === 'poor' ? 'disabled' : ''}>KINDLE · ✦ ${sel.cost}</button>`;
    detail = `<div class="et-d-head"><span class="et-d-type t-${sel.type}">${TREE_TYPE_LABEL[sel.type]}</span><span class="et-d-name">${sel.label}</span></div>
      <div class="et-d-desc">${nodeDescHTML(sel.desc)}</div>
      <div class="et-d-foot">${action}</div>`;
  }
  // tabs are ONLY your fielded party's constellations
  const tabHeroes = party.length ? party : [heroId];
  const tabs = tabHeroes.map(hid => {
    const done = EMBER_TREE.filter(n => n.hero === hid).every(n => hasNode(n.id));
    return `<button class="et-tab${hid === heroId ? ' et-tab-on' : ''}${done ? ' et-tab-done' : ''}" data-hero="${hid}">${HEROES[hid].name}</button>`;
  }).join('');
  showOverlay(`
    <div class="et-head"><span class="et-h-title">THE EMBER TREE</span><span class="et-h-wallet">✦ <b>${runEmbers()}</b></span><span class="et-h-boss">this descent only · resets if you fall</span></div>
    <div class="et-tabs">${tabs}</div>
    <div class="et-body">
      <div class="et-canvas et-grid" id="et-canvas">
        <div class="et-pan" id="et-pan">
          <svg class="et-links" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${ringSvg}${linkSvg}</svg>
          ${rootOrb}${orbs}
        </div>
        <div class="et-zoom">
          <button class="et-zoom-btn" id="et-zoom-out" title="Zoom out">−</button>
          <button class="et-zoom-btn" id="et-zoom-in" title="Zoom in">+</button>
        </div>
      </div>
      <div class="et-side">
        ${!treeTaught() ? `<div class="et-coach">Tap a <b>lit node</b>, then press <b>KINDLE</b> — the skill joins ${HEROES[heroId].name}’s hand for this descent.</div>` : ''}
        <div class="et-detail">${detail}</div>
        <button class="ov-btn et-back-btn" id="et-back">◂ BACK</button>
      </div>
    </div>
  `, 'map-screen et-screen');
  document.querySelectorAll('.et-tab').forEach(el => {
    el.onclick = () => { if (el.dataset.hero !== heroId) showEmberTree(onBack, el.dataset.hero); };
  });
  const etCanvas = document.getElementById('et-canvas');
  document.querySelectorAll('.et-orb[data-id]').forEach(el => {
    el.onclick = () => { if (etCanvas && etCanvas._dragMoved) return; showEmberTree(onBack, heroId, el.dataset.id); };   // a drag pans; a tap selects
  });
  attachTreePan(heroId);
  const buy = $('#et-buy');
  if (buy && sel) buy.onclick = () => {
    if (nodeState(sel) !== 'ready') return;
    const first = !treeTaught();
    const bought = sel;
    addEmbers(-bought.cost); unlockNode(bought.id); setTreeTaught();   // learning the tree, once
    // the skill CATCHES — a full-screen ember-bloom before dropping back to the tree
    kindleBurst(bought, () => showEmberTree(onBack, heroId, first ? '__kindled:' + bought.id : bought.id));
  };
  // celebrate the very first kindle so the loop clicks: node → KINDLE → in hand
  if (justKindled) {
    const c = document.querySelector('.et-side');
    if (c) { const b = document.createElement('div'); b.className = 'et-kindled-note'; b.innerHTML = '✓ <b>Kindled!</b> It’s in your hand now. Spend more embers here between fights — but it all resets if you fall.'; c.insertBefore(b, c.firstChild); }
  }
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
    <div class="ov-hint">You descend ALONE — the rest of your thread is found on the road.</div>
    <button class="ov-btn" id="ss-back">◂ BACK</button>
  `, 'map-screen');
  document.querySelectorAll('.ss-fig:not(.ss-locked)').forEach(el => {
    el.onclick = () => { hideOverlay(); onPick(el.dataset.id); };
  });
  $('#ss-back').onclick = () => showTitle();
}
// A short, hero-specific opening beat, then into the Descent.
function beginRun(starterId) {
  RUN = newRun(starterId);
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
      { text: `The dead give up <b>✦ embers</b> to grow your kit, and companions share <b>gifts</b> — but the <b>threads</b> you weave between the living are the real weapon. Descend, and find the others. <i>(Full rules live in the menu’s How to Play.)</i>` },
    ],
    beginDescent: true,
  });
}

function showGate() {
  showOverlay(`
    <div class="ov-title" style="font-size:24px">KIZUNA</div>
    <div class="ov-sub">THREADS</div>
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
  const vv = window.visualViewport;
  const w = Math.round((vv && vv.width) || window.innerWidth || document.documentElement.clientWidth || 0);
  const h = Math.round((vv && vv.height) || window.innerHeight || document.documentElement.clientHeight || 0);
  if (!w || !h) return;
  const desktop = isDesktop();
  const k = desktop ? DESK_K : 1;
  const dw = 760 * k, dh = 430 * k;
  const st = document.getElementById('stage');
  if (!st) return;
  st.style.width = dw + 'px';
  st.style.height = dh + 'px';
  st.style.transform = 'scale(' + Math.min(w / dw, h / dh) + ')';   // still fills; content just renders smaller
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
      if (!v || !(v['v2.1'] > V2_BUILD)) return;
      if (document.getElementById('update-chip')) return;
      const chip = document.createElement('button');
      chip.id = 'update-chip';
      chip.textContent = '✦ UPDATE READY · BUILD ' + v['v2.1'] + ' — TAP';
      chip.onclick = () => location.replace(location.pathname + '?u=' + v['v2.1']);
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
{ const bs = document.getElementById('build-stamp'); if (bs) bs.textContent = 'V2.1 BUILD ' + V2_BUILD; }
{ const mb = $('#menu-btn'); if (mb) mb.onclick = showMenu; }
let unlocked = false;
try { unlocked = localStorage.getItem(UNLOCK_KEY) === '1'; } catch (_) {}
if (unlocked) showTitle(); else showGate();

// ── PERF HUD — TAP THE BUILD STAMP (top-right "V2.1 BUILD n") to toggle a live
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
