// ============================================================================
// KIZUNA v2.3 — THE ROAD  ·  run.js
// ============================================================================
// Combat knows about one fight. This file knows about the six of them in a row.
//
// The brief was "node-based travel that reads at a glance", benchmarked against
// Slay the Spire 2, and the thing StS gets right is not the graph — it is that
// the graph answers three questions without being read: WHERE AM I, WHERE MAY I
// GO, and WHAT IS THERE. So the road here is deliberately small (six stops, two
// choices at each) and every one of those three answers is carried by a
// different channel: position by a pinned marker, permission by brightness and
// a gold pulse, content by an icon shape that is distinct in silhouette before
// it is distinct in colour. Nothing on this screen requires reading a word to
// make the decision; the words are there to confirm a decision already made by
// the eye.
//
// The run layer owns: the map, the party's carried wounds, the ember purse,
// and the outcome card at the end of a fight. It talks to combat through
// exactly two seams — `startCombat({foe, partyHp, onEnd})` going in, and the
// `combatSummary` it hands back coming out.
// ============================================================================
(function () {
  'use strict';

  const RUN_KEY = 'kizuna23.run';
  // WHAT A CAMPFIRE IS WORTH. The last campfire on the road sits one stop from
  // the Regent, and it exists so that fight is a FIGHT rather than the last
  // instalment of an attrition sum: at 0.35 the run sim walked a competent
  // party into her at 60% health, where a 33% encounter becomes a 10% one.
  const CAMP_FRAC = 0.55;
  const COLS = 6;
  const STOPS = COLS;                       // one node visited per column

  // ── the run's own RNG, kept apart from the fight's ────────────────────────
  // A fight reseeds constantly; the map must not move underneath the player
  // because a fight happened. Same mulberry32, its own cursor.
  let _rs = 1;
  function rseed(n) { _rs = (n >>> 0) || 1; }
  function rr() {
    _rs |= 0; _rs = (_rs + 0x6D2B79F5) | 0;
    let t = Math.imul(_rs ^ (_rs >>> 15), 1 | _rs);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const pick = (a) => a[Math.floor(rr() * a.length) % a.length];

  // ── what a stop can be ────────────────────────────────────────────────────
  // Four kinds, and each one is a different SHAPE at a glance: blades cross,
  // a crown sits on a skull, a flame stands alone, an eye opens. Colour is the
  // second channel, never the only one — the map has to survive being small.
  const KIND = {
    fight: { id: 'fight', word: 'BATTLE', tone: 'steel',
             blurb: 'One of the Regent’s lesser kin. Embers for the winning.' },
    elite: { id: 'elite', word: 'ELITE', tone: 'red',
             blurb: 'It kneels, and it does not tire. Twice the embers, twice the price.' },
    camp:  { id: 'camp', word: 'CAMPFIRE', tone: 'gold',
             blurb: 'Rest and mend, or spend what you carry on what you can become.' },
    story: { id: 'story', word: 'MEMORY', tone: 'violet',
             blurb: 'Something the three of them have not said out loud yet.' },
    boss:  { id: 'boss', word: 'THE REGENT', tone: 'crown',
             blurb: 'The end of the descent. She has been singing the whole way down.' },
  };

  // The column plan. Fixed, not procedural — a six-stop road is short enough
  // that authored pacing beats generated pacing every time, and it means the
  // shape of a run is a thing that can be reasoned about and tested.
  //   0  two easy fights: the opening is a choice, but not yet a gamble
  //   1  fight or memory: pay a fight's embers, or take the tier unlock
  //   2  campfire or fight: the first real fork
  //   3  elite or fight: the gamble, placed where a full purse can answer it
  //   4  campfire or memory: no fighting on the Regent's doorstep
  //   5  the Regent
  const PLAN = [
    ['fight', 'fight'],
    ['fight', 'story'],
    ['camp', 'fight'],
    ['elite', 'fight'],
    ['camp', 'story'],
    ['boss'],
  ];
  // Which foe stands at a fight node, by depth. The ladder is legible: you
  // meet the Husk before you meet the Wraith, always.
  const FOE_BY_COL = [['husk', 'cultist'], ['husk', 'cultist'], ['cultist', 'wraith'],
                      ['wraith'], ['wraith'], ['mourner']];

  // ── geometry of the road ──────────────────────────────────────────────────
  // 932×430 with a header to clear: the road runs left to right across the
  // middle band, which is the same axis the fight is fought along, so "forward"
  // means the same thing on both screens.
  // The band the road runs through has to clear BOTH the header (74px) and the
  // confirmation card (62px tall, 20px off the floor → its top edge is y=348).
  // A stop is a 52px disc plus a word beneath it plus, for the one you are
  // standing on, a pin above it — so the lowest row can reach y+42 and the
  // highest can reach y-50.
  const MAP_X0 = 104, MAP_X1 = 838, MAP_Y = 224, MAP_SPREAD = 66;
  function nodeXY(col, ix, n) {
    const x = MAP_X0 + (MAP_X1 - MAP_X0) * (col / (COLS - 1));
    const y = n === 1 ? MAP_Y : MAP_Y + (ix === 0 ? -MAP_SPREAD : MAP_SPREAD);
    return { x, y };
  }

  // ── building a road ───────────────────────────────────────────────────────
  function buildMap(seed) {
    rseed(seed);
    const nodes = [];
    PLAN.forEach((kinds, col) => {
      kinds.forEach((kind, ix) => {
        const p = nodeXY(col, ix, kinds.length);
        const n = { id: col + ':' + ix, col, ix, kind, x: p.x, y: p.y, to: [] };
        if (kind === 'fight' || kind === 'elite' || kind === 'boss') {
          n.foe = kind === 'elite' ? 'revenant' : pick(FOE_BY_COL[col] || ['wraith']);
        }
        nodes.push(n);
      });
    });
    const at = (col) => nodes.filter(n => n.col === col);
    // EVERY NODE HAS A WAY IN AND A WAY OUT, and at least one crossing per
    // column. Without the forced crossing the road degenerates into two
    // parallel corridors, where the only decision in the whole run is the
    // first one — which is exactly the failure StS's map generator guards
    // against with the same rule.
    for (let c = 0; c < COLS - 1; c++) {
      const a = at(c), b = at(c + 1);
      a.forEach((n, i) => n.to.push(b[Math.min(i, b.length - 1)].id));
      if (b.length > 1 && a.length > 1) {
        let crossed = false;
        if (rr() < 0.55) { a[0].to.push(b[1].id); crossed = true; }
        if (rr() < 0.55) { a[1].to.push(b[0].id); crossed = true; }
        if (!crossed) (rr() < 0.5 ? a[0] : a[1]).to.push(rr() < 0.5 ? b[1].id : b[0].id);
      } else if (b.length === 1) {
        a.forEach(n => { if (n.to.indexOf(b[0].id) < 0) n.to.push(b[0].id); });
      }
      a.forEach(n => { n.to = [...new Set(n.to)]; });
    }
    return nodes;
  }

  // ── run state ─────────────────────────────────────────────────────────────
  let RUN = null;
  let _pick = null;                  // the node the finger is asking about
  let _busy = false;

  function freshRun(seed) {
    const s = (seed != null ? seed : (Date.now() >>> 0)) || 1;
    return {
      seed: s, map: buildMap(s), at: null, path: [], stop: 0,
      embers: 0, nodes: [],                       // unlocked skill nodes (Build 27)
      flash: null,                                // the receipt from the last stop
      tier: 1,                                    // raised by MEMORY stops (Build 28)
      hp: null,                                   // null = everyone is whole
      over: null,                                 // 'win' | 'loss'
      last: null,                                 // the summary of the last fight
    };
  }
  function save() { try { localStorage.setItem(RUN_KEY, JSON.stringify(RUN)); } catch (_) {} }
  function load() {
    try {
      const raw = localStorage.getItem(RUN_KEY);
      if (!raw) return null;
      const r = JSON.parse(raw);
      return (r && r.map && r.map.length) ? r : null;
    } catch (_) { return null; }
  }
  function clear() { try { localStorage.removeItem(RUN_KEY); } catch (_) {} }

  const node = (id) => RUN.map.find(n => n.id === id);
  const here = () => (RUN.at ? node(RUN.at) : null);
  function reachable() {
    if (RUN.over) return [];
    if (!RUN.at) return RUN.map.filter(n => n.col === 0).map(n => n.id);
    const h = here();
    return h ? h.to.slice() : [];
  }
  const visited = (id) => RUN.path.indexOf(id) >= 0;

  // ── the screen ────────────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  function screen(which) {
    const map = $('k-map'), stage = $('k-stage');
    if (map) map.classList.toggle('k-hidden', which !== 'map');
    if (stage) stage.classList.toggle('k-hidden', which === 'map');
  }

  // Icons carry the kind. Drawn rather than lettered, because the decision has
  // to survive a glance from arm's length on a phone.
  const GLYPH = {
    fight: '<path d="M5 5 L19 19 M19 5 L5 19" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round"/>',
    elite: '<path d="M4 10 L7 5 L12 9 L17 5 L20 10 Z" fill="currentColor"/><circle cx="9" cy="15" r="1.5" fill="currentColor"/><circle cx="15" cy="15" r="1.5" fill="currentColor"/><path d="M6 12 h12 v5 a6 6 0 0 1 -12 0 z" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    camp:  '<path d="M12 3 c3 4 5 6 5 9 a5 5 0 0 1 -10 0 c0 -3 2 -5 5 -9 z" fill="currentColor"/><path d="M4 20 h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    story: '<ellipse cx="12" cy="12" rx="9" ry="6" fill="none" stroke="currentColor" stroke-width="1.9"/><circle cx="12" cy="12" r="2.6" fill="currentColor"/>',
    boss:  '<path d="M3 18 L5 7 L9 12 L12 5 L15 12 L19 7 L21 18 Z" fill="currentColor"/><path d="M3 20 h18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  };
  const svgIcon = (kind) => '<svg viewBox="0 0 24 24" aria-hidden="true">' + GLYPH[kind] + '</svg>';

  function renderMap() {
    const wrap = $('k-map-nodes'), edges = $('k-map-edges');
    if (!wrap || !edges) return;
    const open = reachable();

    // EDGES FIRST, and in three weights. The road you walked is solid gold; the
    // roads you may take now are bright; everything else is a rumour. Three
    // weights is the most a glance can sort, so there are exactly three.
    let d = '';
    RUN.map.forEach(n => n.to.forEach(tid => {
      const t = node(tid); if (!t) return;
      const walked = visited(n.id) && visited(tid)
        && RUN.path.indexOf(tid) === RUN.path.indexOf(n.id) + 1;
      const live = RUN.at === n.id && open.indexOf(tid) >= 0;
      const cls = walked ? 'k-e-walk' : (live ? 'k-e-live' : 'k-e-dim');
      const mx = (n.x + t.x) / 2;
      d += '<path class="k-edge ' + cls + '" d="M' + n.x + ' ' + n.y
        + ' C' + mx + ' ' + n.y + ' ' + mx + ' ' + t.y + ' ' + t.x + ' ' + t.y + '"/>';
    }));
    edges.innerHTML = d;

    wrap.innerHTML = RUN.map.map(n => {
      const k = KIND[n.kind];
      const isHere = RUN.at === n.id;
      const isOpen = open.indexOf(n.id) >= 0;
      const been = visited(n.id);
      const cls = ['k-node', 'k-n-' + n.kind, 'k-tone-' + k.tone];
      if (isHere) cls.push('k-n-here');
      if (isOpen) cls.push('k-n-open');
      if (been && !isHere) cls.push('k-n-done');
      if (!isOpen && !been && !isHere) cls.push('k-n-far');
      if (_pick === n.id) cls.push('k-n-pick');
      return '<button type="button" class="' + cls.join(' ') + '" data-node="' + n.id + '"'
        + ' style="left:' + n.x + 'px; top:' + n.y + 'px"'
        + (isOpen ? '' : ' tabindex="-1"')
        + ' aria-label="' + k.word + '">'
        + '<span class="k-n-disc">' + svgIcon(n.kind) + '</span>'
        + '<span class="k-n-word">' + k.word + '</span>'
        + (isHere ? '<span class="k-n-pin">YOU ARE HERE</span>' : '')
        + '</button>';
    }).join('');

    wrap.querySelectorAll('.k-node').forEach(b => {
      b.addEventListener('click', (e) => { e.stopPropagation(); tapNode(b.dataset.node); });
    });

    $('k-map-prog').textContent = RUN.over ? (RUN.over === 'win' ? 'THE DESCENT IS ENDED' : 'THE ROAD ENDS HERE')
      : 'STOP ' + Math.min(RUN.stop + 1, STOPS) + ' OF ' + STOPS;
    $('k-embers-n').textContent = RUN.embers;
    renderRoster();
    renderCard();
  }

  function renderRoster() {
    const box = $('k-map-party'); if (!box) return;
    const H = { ash: { n: 'Ash', art: 'kai', max: 42 }, elin: { n: 'Elin', art: 'elin', max: 36 },
                mira: { n: 'Mira', art: 'mira', max: 34 } };
    box.innerHTML = Object.keys(H).map(id => {
      const h = H[id];
      const hp = RUN.hp && RUN.hp[id] != null ? RUN.hp[id] : h.max;
      const pct = Math.max(0, Math.min(100, hp / h.max * 100));
      const low = pct <= 34 ? ' k-mp-low' : '';
      return '<div class="k-mp' + low + '" data-hero="' + id + '">'
        + '<img src="../art/' + h.art + '.webp" alt="">'
        + '<span class="k-mp-hp"><b>' + hp + '</b>/' + h.max + '</span>'
        + '<span class="k-mp-bar"><i style="width:' + pct + '%"></i></span></div>';
    }).join('');
  }

  // THE CARD IS THE CONFIRMATION STEP. A phone map with one-tap travel is a map
  // that sends you into an elite by accident; the first tap asks, the second
  // commits, and in between the card says exactly what the stop is and what it
  // is worth. It doubles as the run's outcome card when the run is over.
  function renderCard() {
    const card = $('k-map-card'); if (!card) return;
    if (RUN.over) {
      const won = RUN.over === 'win';
      card.className = 'k-map-card k-mc-end' + (won ? ' k-mc-win' : ' k-mc-loss');
      card.innerHTML = '<div class="k-mc-body"><b>' + (won ? 'THE REGENT FALLS' : 'THE PARTY FALLS') + '</b>'
        + '<span>' + (won ? 'Six stops, ' + RUN.embers + ' embers, and the singing has stopped.'
                          : 'The descent keeps what it takes. Begin again.') + '</span></div>'
        + '<button type="button" id="k-map-go" class="k-mc-go">NEW RUN</button>';
      $('k-map-go').addEventListener('click', (e) => { e.stopPropagation(); newRun(); });
      return;
    }
    if (!_pick && RUN.flash) {
      const f = RUN.flash;
      card.className = 'k-map-card k-mc-flash k-tone-' + (f.tone || 'gold');
      card.innerHTML = (f.icon ? '<span class="k-mc-ico">' + svgIcon(f.icon) + '</span>' : '')
        + '<div class="k-mc-body"><b>' + f.title + '</b><span>' + f.sub + '</span></div>'
        + (f.gain ? '<div class="k-mc-gain"><b>' + f.gain + '</b><em>' + (f.gainSub || '') + '</em></div>' : '');
      return;
    }
    if (!_pick) {
      card.className = 'k-map-card k-mc-idle';
      card.innerHTML = '<div class="k-mc-body"><b>CHOOSE THE NEXT STOP</b>'
        + '<span>Tap a lit stop to see what waits there.</span></div>';
      return;
    }
    const n = node(_pick), k = KIND[n.kind];
    const foe = n.foe && window.K && window.K.FOES ? window.K.FOES[n.foe] : null;
    card.className = 'k-map-card k-tone-' + k.tone;
    card.innerHTML = '<span class="k-mc-ico">' + svgIcon(n.kind) + '</span>'
      + '<div class="k-mc-body"><b>' + (foe ? foe.name : k.word) + '</b>'
      + '<span>' + k.blurb + '</span></div>'
      + '<div class="k-mc-gain">' + gainText(n) + '</div>'
      + '<button type="button" id="k-map-go" class="k-mc-go">TRAVEL</button>';
    $('k-map-go').addEventListener('click', (e) => { e.stopPropagation(); travel(_pick); });
  }

  // WHAT IS THERE, in numbers. A choice between two stops is only a choice if
  // both prices are on screen at the same time as the decision.
  function gainText(n) {
    const foe = n.foe && window.K && window.K.FOES ? window.K.FOES[n.foe] : null;
    if (n.kind === 'camp') return '<b>REST</b><em>mend + spend</em>';
    if (n.kind === 'story') return '<b>+1</b><em>ember · tier</em>';
    if (foe) return '<b>+' + foe.embers + '</b><em>embers · ' + window.K.foeHp(foe) + ' hp</em>';
    return '';
  }

  function tapNode(id) {
    if (_busy || RUN.over) return;
    if (reachable().indexOf(id) < 0) return;      // a stop you cannot reach says nothing
    if (_pick === id) { travel(id); return; }     // second tap on the same stop commits
    _pick = id; RUN.flash = null;
    renderMap();
  }

  // ── travelling ────────────────────────────────────────────────────────────
  function travel(id) {
    if (_busy) return;
    const n = node(id);
    if (!n || reachable().indexOf(id) < 0) return;
    _busy = true;
    RUN.at = id; RUN.path.push(id); RUN.stop = n.col + 1; _pick = null; RUN.flash = null;
    save();
    renderMap();
    setTimeout(() => { _busy = false; enter(n); }, 260);
  }

  function enter(n) {
    if (n.kind === 'camp') return enterCamp(n);
    if (n.kind === 'story') return enterStory(n);
    return enterFight(n);
  }

  function enterFight(n) {
    const foe = window.K.FOES[n.foe] || window.K.FOES.wraith;
    screen('combat');
    window.K.startCombat({ foe, partyHp: RUN.hp, onEnd: onFightEnd });
  }

  function onFightEnd(sum) {
    RUN.last = sum;
    RUN.hp = sum.partyHp;
    if (sum.outcome === 'defeat') { RUN.over = 'loss'; save(); return toMap(); }
    // EMBERS ARE PAID FOR THE FIGHT AND FOR THE PARRY, separately. The base is
    // the foe's worth; the bonus is what the parry earned, so the best thing in
    // the game is also the thing that funds the tree.
    const foe = window.K.FOES[sum.foe];
    const base = foe ? foe.embers : 2;
    const clean = sum.cleanliness >= 0.92 ? 2 : sum.cleanliness >= 0.7 ? 1 : 0;
    RUN.embers += base + clean;
    RUN.lastGain = { base, clean };
    RUN.flash = {
      icon: foe && foe.tier === 'elite' ? 'elite' : 'fight', tone: 'gold',
      title: (foe ? foe.name : 'IT FALLS') + ' — DOWN',
      sub: clean === 2 ? 'The whole song turned aside. The road pays for that.'
         : clean === 1 ? 'Most of it turned aside.'
         : 'You took the blows and kept walking.',
      gain: '+' + (base + clean), gainSub: 'embers' + (clean ? ' · ' + base + '+' + clean + ' parry' : ''),
    };
    if (foe && foe.tier === 'boss') RUN.over = 'win';
    save();
    toMap();
  }

  // Build 27 lands the campfire proper — mending and the skill tree. Until
  // then the stop still has to DO something, and what it does is the half that
  // does not need a tree: it mends.
  function enterCamp(n) {
    const H = { ash: 42, elin: 36, mira: 34 };
    RUN.hp = RUN.hp || { ...H };
    for (const id of Object.keys(H)) {
      RUN.hp[id] = Math.min(H[id], Math.round((RUN.hp[id] != null ? RUN.hp[id] : H[id]) + H[id] * CAMP_FRAC));
    }
    RUN.camped = (RUN.camped || 0) + 1;
    RUN.flash = { icon: 'camp', tone: 'gold', title: 'THE FIRE BURNS DOWN',
      sub: 'Wounds close. Nobody says much.',
      gain: '+' + Math.round(CAMP_FRAC * 100) + '%', gainSub: 'mended' };
    save();
    toMap();
  }
  // Build 28 lands the cutscene proper. The mechanical half — the tier the
  // memory opens — is live now so the road already has the shape it will keep.
  function enterStory(n) {
    RUN.tier = Math.min(5, RUN.tier + 1);
    RUN.embers += 1;
    RUN.flash = { icon: 'story', tone: 'violet', title: 'SOMETHING IS SAID OUT LOUD',
      sub: 'Tier ' + RUN.tier + ' of the tree opens to the three of them.',
      gain: '+1', gainSub: 'ember · tier' };
    save();
    toMap();
  }

  function toMap() { screen('map'); renderMap(); }

  function newRun(seed) {
    RUN = freshRun(seed);
    _pick = null; _busy = false;
    save();
    toMap();
  }

  // ── boot ──────────────────────────────────────────────────────────────────
  function boot(opts) {
    opts = opts || {};
    const saved = opts.fresh ? null : load();
    RUN = saved || freshRun(opts.seed);
    _pick = null; _busy = false;
    if (!saved) save();
    // A saved run that was mid-fight comes back to the map, not to the fight:
    // combat is not serialisable and pretending otherwise loses the run.
    toMap();
  }

  window.R = {
    boot,
    active: () => !!RUN && !RUN.over,
    state: () => RUN,
    map: () => (RUN ? RUN.map : []),
    reachable,
    travel, tapNode, newRun, clear,
    screen,
    render: renderMap,
    // test-only
    _set(patch) { Object.assign(RUN, patch || {}); save(); renderMap(); },
    _pick: () => _pick,
    KIND, PLAN, STOPS, CAMP_FRAC,
  };
})();
