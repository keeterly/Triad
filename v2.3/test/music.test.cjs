// KIZUNA v2.3 — the MUSIC suite. Two decks, one crossfader, and a parry grid
// that locks to the track.
//
// This suite is the only one that boots with `&music=1`. Music is OFF under
// ?test=1 by default and deliberately so: every other check boots a fresh page
// and most of them enter combat, and leaving two 11MB fetches behind several
// hundred boots buys no assertion anything. The flag is an opt-in rather than a
// mock, so what runs here is the shipping path with real <audio> elements —
// which matters, because almost every bug this system can have (autoplay
// refusal, a track restarting when it should resume, a crossfade that dips to
// silence) lives in the browser's audio object rather than in our state.
//
// Headless Chromium has no audio output device. It will still load, decode,
// seek and report currentTime — so everything asserted here is real — but it
// may refuse to leave `paused` without a gesture. Checks that need a track
// genuinely rolling arrange a real click first, exactly as a player would.
'use strict';
const { boot } = require('./harness.cjs');

(async () => {
  const H = await boot({ query: 'road=1&music=1' });
  const { J, check, report, sleep, page } = H;

  const M = () => J(() => window.K.MUSIC._state());
  // A real gesture: autoplay is blocked until the player touches something, and
  // the engine hangs a capturing pointerdown retry off exactly that.
  const gesture = () => page.mouse.click(466, 400);

  // ── the two beds ─────────────────────────────────────────────────────────
  // The road opens on a screen, and a screen is what decides the music, so the
  // bed should already be wanted before anything is clicked.
  const opened = await M();
  check('MUSIC: the road wants its own bed from the first screen, without a click',
    opened.want === true && /worldmap-theme/.test(opened.wantSrc || '')
    && opened.decks === 2,
    JSON.stringify(opened));

  await gesture();
  await sleep(900);
  const rolling = await M();
  check('MUSIC: a touch is enough to start it — the world bed is playing and audible',
    /worldmap-theme/.test(rolling.src || '') && rolling.paused === false
    && rolling.vol > 0.05,
    JSON.stringify(rolling));

  // ── the switch into a fight ──────────────────────────────────────────────
  // Combat is an ENTRANCE: the battle theme replaces the bed and restarts from
  // its downbeat rather than resuming where it last was.
  await J(() => { window.K.startCombat({ seed: 7 }); window.R.screen('combat'); });
  await sleep(1400);
  const inFight = await M();
  check('MUSIC: entering a fight swaps the bed for the battle theme',
    /combat-theme/.test(inFight.src || '') && /combat-theme/.test(inFight.wantSrc || ''),
    JSON.stringify(inFight));
  // Ducked under the effects on purpose — the parry's own sounds and the
  // numbers are what the player is reading during a volley.
  check('MUSIC: the battle theme is ducked below the road bed, not level with it',
    inFight.wantVol < rolling.wantVol,
    JSON.stringify({ combat: inFight.wantVol, world: rolling.wantVol }));

  // ── the parry locks to the track ─────────────────────────────────────────
  // THE POINT OF THE PORT. The parry grid has always run at 120 BPM, which is
  // the track's tempo — what it never did was start on one of the track's
  // beats. Right interval, wrong phase. `gridStart()` rounds the runway forward
  // to the next grid point, so a volley's rings close ON the music.
  const lock = await J(async () => {
    const b = window.K.MUSIC.beat();
    if (!b.playing) return { playing: false };
    const t0 = window.K.gridStart();
    // Convert that performance.now() instant back into the track's own clock,
    // reading the two timebases as a pair, and ask how far it sits from a beat.
    const audioNow = b.now(), perfNow = performance.now();
    const atSec = audioNow + (t0 - perfNow) / 1000;
    // the track's grid is offset by MUSIC_OFFSET; distance to the nearest line
    const g = b.beatSec, off = 0.14;
    const k = (atSec - off) / g;
    const dist = Math.abs(k - Math.round(k)) * g;
    return { playing: true, dist, lead: (t0 - perfNow) / 1000, beatSec: g };
  });
  check('MUSIC: the parry runway is rounded onto the track — a volley opens on a beat',
    lock.playing === true && lock.dist < 0.02,
    JSON.stringify(lock));
  // …and it never SHORTENS the runway the hand is promised. Rounding forward,
  // not to nearest, is what guarantees that.
  // THE FLOOR IS THE GAME'S OWN CONSTANT, NOT A COPY OF IT. This asserted
  // `lead >= 1.0` — BEAT_LEADIN 2 x BEAT_MS 500, written out — so shortening
  // the lead-in in Build 94 read as the rounding stealing runway when nothing
  // about the rounding had changed. What is actually promised is that rounding
  // FORWARD onto the track never shortens whatever the runway is.
  const floor = await J(() => window.K.BEAT_LEADIN * window.K.BEAT_MS / 1000);
  check('MUSIC: locking to the beat never steals the lead-in from the player',
    lock.playing === true && lock.lead >= floor - 0.002
    && lock.lead < floor + lock.beatSec + 0.02,
    JSON.stringify({ lead: lock.lead, floor, ceil: floor + (lock.beatSec || 0) }));

  // The grid must not depend on the music. A player with the sound off gets the
  // same parry, on the same free-running clock, which is how it worked before.
  const silent = await J(() => {
    window.K.musicSet(false);
    const t0 = window.K.gridStart(), lead = (t0 - performance.now()) / 1000;
    window.K.musicSet(true);
    return { lead, playing: window.K.MUSIC.beat().playing };
  });
  check('MUSIC: with the music off the parry keeps its own clock, unchanged',
    Math.abs(silent.lead - floor) < 0.05,
    JSON.stringify({ ...silent, floor }));

  // ── leaving a fight ──────────────────────────────────────────────────────
  // NOT a crossfade. The two pieces are too different to overlap, so the battle
  // theme goes fully out, there is a breath of quiet, and the road swells back.
  // ONE DECK PER TRACK. `a.src` reads back as the browser's resolved absolute
  // URL while what we hand in is relative, so the module's "is this already
  // foreground?" test compared two spellings of the same file and always said
  // no — and since the bed is cued both by startCombat and by the screen
  // change, entering a fight tore down a playing deck and rebuilt the same
  // track on the other one. Two decks, one file, crossfading into itself.
  const beds = inFight.deck.map(d => d && d.src).filter(Boolean);
  check('MUSIC: the two decks carry two different tracks, never the same one twice',
    new Set(beds).size === beds.length && beds.length === 2,
    JSON.stringify(beds));

  // ── leaving a fight ──────────────────────────────────────────────────────
  // NOT a crossfade. The two pieces are too different to overlap, so the battle
  // theme goes fully out, there is a breath of quiet, and the road swells back.
  // …defensively, because if that check has just failed there may BE no world
  // deck, and a suite that throws reports nothing at all about the rest.
  const worldDeck = inFight.deck.find(d => d && /worldmap/.test(d.src));
  const leftAt = worldDeck ? worldDeck.at : -1;
  await J(() => window.R.screen('map'));
  await sleep(700);                       // mid hand-off: the fade-out is 1100ms
  const mid = await M();
  const midCombat = mid.deck.find(d => d && /combat/.test(d.src));
  const midWorld = mid.deck.find(d => d && /worldmap/.test(d.src));
  check('MUSIC: leaving a fight fades the battle theme OUT before the road returns',
    !!midCombat && midCombat.vol < 0.3 && midCombat.vol > 0
    && /worldmap-theme/.test(mid.wantSrc || ''),
    JSON.stringify({ combat: midCombat, want: mid.wantSrc }));
  // AN INTERRUPTED CROSSFADE MUST NOT STRAND THE DECK IT WAS RETIRING. Leaving
  // a fight inside the 2.4s entrance crossfade — a one-turn kill, a defeat on
  // the opening volley — used to freeze the road's bed at whatever level it had
  // reached and leave it playing under the battle theme for the rest of the
  // session, because cancelling a fade was only `clearInterval`.
  check('MUSIC: a fade cut short still finishes retiring its outgoing deck',
    !!midWorld && midWorld.vol < 0.02 && midWorld.paused === true,
    JSON.stringify(midWorld));

  await sleep(2600);
  const back = await M();
  check('MUSIC: and the road bed comes back up on the far side of the silence',
    /worldmap-theme/.test(back.src || '') && back.paused === false && back.vol > 0.05,
    JSON.stringify({ src: back.src, vol: back.vol, paused: back.paused }));
  // THE ROAD IS A PLACE, NOT A MENU. It resumes where it left off rather than
  // restarting, so stepping out for a fight and back feels like returning to a
  // room the music was still playing in. The bookmark was written under one
  // spelling of the track's URL and read under the other, so `resume` always
  // resumed from zero — the road's theme restarted from the top after every
  // single fight, which is precisely what the flag exists to prevent.
  check('MUSIC: the road resumes where it was — it does not restart from zero',
    leftAt > 0 && back.at > leftAt - 0.1 && Math.abs(back.at - leftAt) < 2.5,
    JSON.stringify({ leftAt, cameBackAt: back.at, mark: back.marks }));

  // ── re-cueing the same bed is a no-op ────────────────────────────────────
  // Screens change constantly and most of those changes want the bed already
  // playing. If re-cueing restarted or dipped it, the road's theme would
  // stutter every time a camp or a scene opened.
  const before = await M();
  await J(() => { window.R.screen('camp'); window.R.screen('scene'); window.R.screen('map'); });
  await sleep(500);
  const after = await M();
  check('MUSIC: moving between road screens never restarts or dips the bed',
    after.at >= before.at && after.vol >= before.vol - 0.01 && after.paused === false
    && after.active === before.active,
    JSON.stringify({ before: { at: before.at, vol: before.vol, deck: before.active },
                     after: { at: after.at, vol: after.vol, deck: after.active } }));

  // ── the one setting ──────────────────────────────────────────────────────
  const muted = await J(() => {
    window.K.musicSet(false);
    return { on: window.K.musicOn(), stored: localStorage.getItem('kizuna23.music') };
  });
  await sleep(700);
  const quiet = await M();
  check('MUSIC: muting silences it and the choice is written down',
    muted.on === false && muted.stored === '0' && quiet.vol < 0.05,
    JSON.stringify({ muted, vol: quiet.vol }));

  await J(() => window.K.musicSet(true));
  await sleep(900);
  const unmuted = await M();
  await sleep(400);
  const stillRunning = await M();
  // ROLLING, not merely loud. The first version of this check asked only for a
  // volume above zero, and passed while unmute was broken: cancelling the
  // fade-to-silence paused the very deck the ramp-up was restoring, so the
  // level climbed on a stopped track and nothing came out. A rising number on
  // a frozen clock is exactly the shape of a hollow check.
  check('MUSIC: unmuting brings back the track that was playing, and it is rolling',
    /worldmap-theme/.test(unmuted.src || '') && unmuted.vol > 0.05
    && unmuted.paused === false && stillRunning.at > unmuted.at + 0.2,
    JSON.stringify({ src: unmuted.src, vol: unmuted.vol, paused: unmuted.paused,
                     at: unmuted.at, then: stillRunning.at }));

  // The control itself: one row, BEHIND THE MENU in the road's header, that says
  // which state it is in with a shape rather than with opacity alone.
  // WHAT MOVED: the mute used to be a bare icon pinned to the end of the header.
  // It is a menu row now — the header carries two doors, the deck and the menu,
  // and everything that was loose up there went behind one of them. So the
  // check has to OPEN the menu before it measures, or it reads a zero-width
  // button inside a hidden panel and calls a working control broken.
  const btn = await J(() => {
    const b = document.getElementById('k-mute');
    if (!b) return null;
    const menu = document.getElementById('k-menu');
    const inMenu = !!b.closest('#k-menu');
    const menuInHeader = !!(menu && menu.closest('#k-map-top'));
    const shutFirst = menu.classList.contains('k-hidden');
    document.getElementById('k-menu-btn').click();
    const opened = !menu.classList.contains('k-hidden');
    const on = { muted: b.classList.contains('k-muted'), html: b.innerHTML };
    b.click();
    const off = { muted: b.classList.contains('k-muted'), html: b.innerHTML };
    b.click();
    const out = { inHeader: inMenu && menuInHeader, shutFirst, opened,
                  on, off, back: b.classList.contains('k-muted'),
                  r: b.getBoundingClientRect().width };
    document.getElementById('k-menu-btn').click();
    out.shutAfter = menu.classList.contains('k-hidden');
    return out;
  });
  check('MUSIC: the mute lives behind the header menu, which opens and shuts, and it changes SHAPE',
    !!btn && btn.inHeader && btn.shutFirst && btn.opened && btn.shutAfter
    && btn.on.muted === false && btn.off.muted === true
    && btn.on.html !== btn.off.html && btn.back === false && btn.r > 40,
    JSON.stringify({ inMenuInHeader: btn && btn.inHeader, shutFirst: btn && btn.shutFirst,
                     opened: btn && btn.opened, shutAfter: btn && btn.shutAfter,
                     w: btn && btn.r, changed: btn && btn.on.html !== btn.off.html }));

  // Nothing about the mute may reach the battlefield: this build has spent
  // several passes taking permanent furniture OFF the combat screen.
  const onStage = await J(() => {
    const b = document.getElementById('k-mute');
    return { inStage: !!(b && b.closest('#k-stage')) };
  });
  check('MUSIC: the control is not furniture on the combat screen',
    onStage.inStage === false, JSON.stringify(onStage));

  // ── COMBAT SFX (Build 55) ────────────────────────────────────────────────
  // This suite is the only page where sound is genuinely on, so it is the only
  // place these can be asked honestly. A version of the thinning check briefly
  // sat in the flow suite and passed for the wrong reason: with audio off every
  // call returns false, so "at most two got through" was true of a system that
  // played nothing whatsoever.
  //
  // The sounds are SYNTHESISED rather than sampled, because a parry is graded in
  // tens of milliseconds and an <audio> element's play() lands 50-200ms after it
  // is asked. So what matters here is that a real WebAudio graph exists and runs.
  await gesture();
  await sleep(300);
  // the graph is built LAZILY, on the first sound rather than at boot — a
  // browser will not start an AudioContext before the player has touched
  // something, so there is nothing to build until there is something to play
  const fired = await J(() => {
    const out = [];
    for (const n of ['slash', 'perfect', 'hurt', 'brk']) out.push([n, window.K.sfx(n, 1)]);
    return out;
  });
  check('SFX: every voice actually reaches the synth and plays',
    fired.every(([, ok]) => ok === true), JSON.stringify(fired));
  const sx = await J(() => window.K.SFX._state());
  check('SFX: it is a real audio graph, and it is running rather than suspended',
    sx.ctx === true && sx.state === 'running' && sx.on === true, JSON.stringify(sx));

  // A VOLLEY IS NOT A MACHINE GUN. Identical voices inside a few milliseconds
  // stack into one click rather than reading as several blows, so a repeat of
  // the same voice is thinned — and then allowed again once the ear has moved on.
  const burst = await J(async () => {
    const rush = [];
    for (let i = 0; i < 6; i++) rush.push(window.K.sfx('slash', 1));
    await new Promise(r => setTimeout(r, 120));
    const later = window.K.sfx('slash', 1);
    // a DIFFERENT voice at the same instant is a different blow, not a repeat
    const other = window.K.sfx('hurt', 1);
    return { rush, played: rush.filter(Boolean).length, later, other };
  });
  check('SFX: a burst of one voice is thinned, but it is not stuck off',
    burst.played === 1 && burst.later === true, JSON.stringify(burst));
  check('SFX: thinning is per voice — a different sound at the same moment still lands',
    burst.other === true, JSON.stringify({ other: burst.other }));

  // ONE MUTE, BOTH SYSTEMS. A player who silenced the game silenced the game;
  // sound effects that survived the music's mute would be a bug with a volume.
  const quietFx = await J(() => {
    window.K.musicSet(false);
    const off = window.K.sfx('brk', 1);
    window.K.musicSet(true);
    return { off, backOn: window.K.sfx('allout', 1) };
  });
  check('SFX: the mute silences the effects too, and unmuting brings them back',
    quietFx.off === false && quietFx.backOn === true, JSON.stringify(quietFx));

  const r = report();
  process.exit(r.passed === r.total && r.errs === 0 ? 0 : 1);
})();
