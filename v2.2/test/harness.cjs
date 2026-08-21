// Playwright harness for KIZUNA v2.  Zero-config:
//   node v2/test/flow.test.cjs
// Finds Chromium (env PLAYWRIGHT chromium, /opt/pw-browsers, or default
// install), starts a static server for the repo root if one isn't already
// answering, and hands back { browser, page, J, shot, check, report }.
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { execSync, spawn } = require('child_process');

function findChromium() {
  const candidates = [
    process.env.V2_CHROMIUM,
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  ].filter(Boolean);
  for (const c of candidates) { try { fs.accessSync(c); return c; } catch (_) {} }
  const roots = ['/opt/pw-browsers', path.join(process.env.HOME || '', '.cache/ms-playwright')];
  for (const root of roots) {
    try {
      for (const d of fs.readdirSync(root)) {
        const p = path.join(root, d, 'chrome-linux/chrome');
        try { fs.accessSync(p); return p; } catch (_) {}
      }
    } catch (_) {}
  }
  return null;   // let playwright use its default
}
function requirePlaywright() {
  try { return require('playwright'); } catch (_) {}
  return require('/opt/node22/lib/node_modules/playwright');
}
function ping(url) {
  return new Promise(res => {
    const req = http.get(url, r => { r.resume(); res(r.statusCode === 200); });
    req.on('error', () => res(false));
    req.setTimeout(1500, () => { req.destroy(); res(false); });
  });
}
async function ensureServer(port, root) {
  if (await ping(`http://127.0.0.1:${port}/index.html`)) return null;
  const server = spawn('npx', ['http-server', root, '-p', String(port), '-s'],
    { stdio: 'ignore', detached: true });
  server.unref();
  for (let i = 0; i < 20; i++) {
    if (await ping(`http://127.0.0.1:${port}/index.html`)) return server;
    await new Promise(r => setTimeout(r, 300));
  }
  throw new Error('static server failed to start on :' + port);
}

async function boot(opts = {}) {
  const port = opts.port || 8099;
  const repoRoot = opts.root || path.resolve(__dirname, '..', '..');
  await ensureServer(port, repoRoot);
  const { chromium } = requirePlaywright();
  const exe = findChromium();
  const browser = await chromium.launch(Object.assign(
    { args: ['--no-sandbox'] }, exe ? { executablePath: exe } : {}));
  const ctx = await browser.newContext({ viewport: { width: 880, height: 430 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message)));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await page.addInitScript((init) => {
    try {
      localStorage.setItem('kizuna2_2.unlocked', '1');
      // v2.2: the rigs measure COMBAT, and the prologue now stands in front of
      // it — so boot with the prologue already spent (the exact state playing
      // it leaves behind; narrSeedPrologueComplete applies the same effects).
      // A narrative test that wants the fresh-soul path passes freshNarrative
      // and gets a clean slate.
      if (init.freshNarrative) localStorage.removeItem('kizuna2_2.narrative');
      else if (!localStorage.getItem('kizuna2_2.narrative')) localStorage.setItem('kizuna2_2.narrative', JSON.stringify({
        version: 7,
        campaign: { act: 'ACT_I', chapter: 'ACT1_FIRST_ASCENT', highestDomainReached: null, rebirthCount: 0 },
        events: { completed: ['PRO_000_LAST_MEMORY', 'PRO_001_TRIO_ENGAGEMENT', 'PRO_002_FALLEN_HESITATES',
          'PRO_003_LIBERATION_STRIKE', 'PRO_004_REBIRTH', 'PRO_005_RISE', 'PRO_006_TITLE',
          'PRO_007_FIRST_ECHO', 'PRO_008_ASCENT_BEGINS'],
          seenCount: {} },
        reveals: {}, resonance: { unlocked: ['PROLOGUE_ECHO_01'], characterStage: {} },
        kizuna: { pairs: {} }, roles: {},
      }));
      // Apply the test's initial state ONCE per browser context — reloads
      // within a test must keep whatever state the test has since written.
      if (!sessionStorage.getItem('__v2_1init')) {
        sessionStorage.setItem('__v2_1init', '1');
        if (init.flow != null) localStorage.setItem('kizuna2_2.flow', String(init.flow));
        if (init.clearRun) { localStorage.removeItem('kizuna2_2.run'); localStorage.removeItem('kizuna2_2.abyss'); localStorage.removeItem('kizuna2_2.vows'); }
      }
    } catch (_) {}
  }, { flow: opts.flow, clearRun: opts.clearRun !== false, freshNarrative: !!opts.freshNarrative });
  // AUTO-PARRY — lets the test bot play like a real (parrying) player, so we can
  // tune difficulty for a skilled human instead of a bot that eats every blow.
  // Watches for parry notes and performs the right gesture at a good time.
  // TIME SCALE (Build 280 harness) — the measurement rigs were spending ten
  // minutes on a handful of rooms, so the questions that mattered (does a healer
  // out-sustain a pack? is an elite-per-floor a tradeoff or a run-ender?) were
  // simply unaffordable. Every wait in combat is a setTimeout: the game's own
  // `sleep`, the parry note close timers, the banners, the camera settles — AND
  // the auto-parry's own gesture delays. Scaling setTimeout itself collapses all
  // of them PROPORTIONALLY, so the bot's timing relationship to the notes it is
  // reading survives intact. Nothing here touches game code.
  await page.addInitScript(() => {
    window.__timeScale = 1;
    const _st = window.setTimeout.bind(window);
    window.setTimeout = (fn, ms, ...a) => _st(fn, Math.max(0, Math.round((+ms || 0) * (window.__timeScale || 1))), ...a);
    const _si = window.setInterval.bind(window);
    window.setInterval = (fn, ms, ...a) => _si(fn, Math.max(1, Math.round((+ms || 0) * (window.__timeScale || 1))), ...a);
    // AND THE CLOCK THE GAME READS MUST SCALE WITH THEM (v2.2 Build 38).
    //
    // Scaling only the timers left Date.now() running at real speed, so under
    // fastCombat a note scheduled for 700 game-ms closed after 42 real ms while
    // the parry grader — which measures `Date.now() - t0` — still saw 42ms
    // elapsed against a 700ms beat. EVERY bot tap read as wildly early. Every
    // difficulty number the rig has ever produced about parries was measuring
    // that skew, not the game. A monotonic virtual clock, rebased on each scale
    // change, makes game-time and timer-time the same time again.
    const _now = Date.now.bind(Date);
    let _lastReal = _now(), _game = _lastReal;
    Date.now = () => { const r = _now(); _game += (r - _lastReal) / (window.__timeScale || 1); _lastReal = r; return Math.round(_game); };
  });
  await page.addInitScript(() => {
    window.__autoParry = false;
    // SKILL (Build 278 harness) — the bot used to hit every note perfectly, which
    // made every difficulty reading useless: a party that never drops below full
    // HP tells you nothing about whether the game is too easy, only that a robot
    // with frame-perfect timing finds it easy. __parrySkill is the probability of
    // a CLEAN read on any given note; the rest are botched the way people botch
    // them — early, late, short on the mash, wrong way on the swipe, and biting
    // on the bait, which is the discipline failure rather than a timing one.
    window.__parrySkill = 1;
    // Deliberate aim BIAS in game-ms (+ = late, − = early). The suite leaves it
    // at 0; the parry probe sweeps it to measure where the grade bands actually
    // sit rather than trusting the constants.
    window.__parryOffset = 0;
    window.__parryLog = { clean: 0, botched: 0, byKind: {} };
    // deterministic, so two runs at the same skill are comparable
    window.__parrySeed = 0x9e3779b9;
    const rnd = () => { let x = window.__parrySeed |= 0; x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
      window.__parrySeed = x | 0; return ((x >>> 0) % 100000) / 100000; };
    const note = (kind, ok) => { const L = window.__parryLog;
      L[ok ? 'clean' : 'botched']++; const b = L.byKind[kind] = L.byKind[kind] || { clean: 0, botched: 0 };
      b[ok ? 'clean' : 'botched']++; };
    const fire = (ring) => {
      const cx = Math.round(innerWidth / 2), cy = Math.round(innerHeight / 2);
      const P = (type, x, y) => window.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 31, pointerType: 'touch' }));
      const skill = Math.max(0, Math.min(1, window.__parrySkill == null ? 1 : window.__parrySkill));
      const clean = rnd() < skill;
      // every note publishes the instant it wants to be answered
      const beat = () => { const v = ring.dataset && ring.dataset.impact ? parseInt(ring.dataset.impact, 10) : NaN;
        return (v && !isNaN(v)) ? Math.max(0, v - Date.now() + (window.__parryOffset || 0)) : null; };
      if (ring.classList.contains('parry-hold')) {
        note('hold', clean);
        // a brace is two beats now — take it on the marked one, let go on the close
        const pv = ring.dataset && ring.dataset.press ? parseInt(ring.dataset.press, 10) : NaN;
        const pd = (pv && !isNaN(pv)) ? Math.max(0, pv - Date.now() + (window.__parryOffset || 0)) : 0;
        const b = beat();
        setTimeout(() => P('pointerdown', cx, cy), pd);
        setTimeout(() => P('pointerup', cx, cy), clean ? (b == null ? 1200 : b) : Math.round(pd + 120));   // let go too soon
      } else if (ring.classList.contains('parry-swipe')) {
        note('swipe', clean);
        const lbl = (ring.querySelector('.pr-lbl') || {}).textContent || '';
        let dx = 150, dy = -30;
        if (lbl.indexOf('↶') >= 0) { dx = -150; } else if (lbl.indexOf('⤴') >= 0) { dx = 0; dy = -170; }
        if (!clean) { dx = -dx; dy = -dy; }                  // wrong way
        const b = beat();
        setTimeout(() => { P('pointerdown', cx, cy + 40); P('pointermove', cx + dx * 0.5, cy + 40 + dy * 0.5); P('pointermove', cx + dx, cy + 40 + dy); P('pointerup', cx + dx, cy + 40 + dy); }, b == null ? 200 : b);
      } else if (ring.classList.contains('pr-bait')) {
        // a BAIT is parried by NOT touching it. Discipline is a skill too, so a
        // sloppy bot bites — the one failure mode that is not about timing.
        note('bait', clean);
        if (!clean) setTimeout(() => { P('pointerdown', cx, cy); P('pointerup', cx, cy); }, 180);
      } else {
        // Tap ADAPTIVELY, relative to THIS ring's own close time (read off the
        // .pr-close animation, plus any FEINT hesitation via data-pause), so the
        // auto-parry stays inside the hit window no matter how the game tunes
        // ring speed / window width / trick notes. ~200ms before close.
        note('tap', clean);
        // AIM AT THE BEAT (v2.2 Build 38). Windows are centred on the impact
        // instant now, so "close minus 200ms" is not a clean read — it is a
        // 200ms-early read, which is exactly the band the grader downgrades.
        // Notes publish `data-impact` (game-clock epoch ms of the beat); a
        // frame-perfect bot lands on it.
        const cl = ring.querySelector('.pr-close');
        let delay;
        const imp = ring.dataset && ring.dataset.impact ? parseInt(ring.dataset.impact, 10) : NaN;
        let dur = 700; try { dur = parseInt((cl && cl.style.animationDuration) || '700', 10) || 700; } catch (_) {}
        if (imp && !isNaN(imp)) delay = Math.max(0, imp - Date.now() + (window.__parryOffset || 0));
        else {
          // A note with no published beat is an OFFENSIVE strike note, which
          // still resolves the old way: it grades on time REMAINING and kills
          // itself at the close, so a tap scheduled exactly on the close loses
          // the race and reads as a miss. Aim inside the window, as before.
          let pause = 0; try { pause = parseInt((ring.dataset && ring.dataset.pause) || '0', 10) || 0; } catch (_) {}
          delay = Math.max(120, dur + pause - 200);
        }
        if (!clean) delay = (rnd() < 0.5) ? Math.round(delay * 0.3)      // twitchy: too early
                                          : Math.round(delay + dur * 0.5); // asleep: too late
        setTimeout(() => { P('pointerdown', cx, cy); P('pointerup', cx, cy); }, delay);
      }
    };
    const obs = new MutationObserver((muts) => {
      if (!window.__autoParry) return;
      for (const m of muts) for (const n of m.addedNodes) {
        if (n.nodeType === 1 && n.classList && n.classList.contains('parry-ring') && !n.__ap) { n.__ap = 1; fire(n); }
      }
    });
    const start = () => { try { obs.observe(document.documentElement, { childList: true, subtree: true }); } catch (_) {} };
    if (document.body) start(); else addEventListener('DOMContentLoaded', start);
  });
  await page.goto(`http://127.0.0.1:${port}/v2.2/index.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  const results = [];
  const shotsDir = opts.shotsDir || path.join(__dirname, 'shots');
  fs.mkdirSync(shotsDir, { recursive: true });
  let shotN = 0;
  const api = {
    autoParry: (on) => page.evaluate((v) => { window.__autoParry = v; }, on !== false),
    // 1 = frame-perfect (the old behaviour, and what the suite runs on).
    // Anything lower botches that share of notes the way people botch them.
    parrySkill: (v, seed) => page.evaluate((o) => { window.__parrySkill = o.v;
      window.__parrySeed = o.seed || 0x9e3779b9;
      window.__parryLog = { clean: 0, botched: 0, byKind: {} }; }, { v, seed }),
    parryLog: () => page.evaluate(() => window.__parryLog),
    // Bias every clean tap by N game-ms off the beat (+ late, − early).
    parryAim: (ms) => page.evaluate((v) => { window.__parryOffset = v | 0; }, ms | 0),
    // 1 = real time. 0.06 runs a room in seconds. Combat MATHS is untouched —
    // only how long the game waits between the same steps.
    fastCombat: (scale) => page.evaluate((v) => { window.__timeScale = v == null ? 0.06 : v; }, scale),
    browser, ctx, page, errs, results,
    J: (fn, ...a) => page.evaluate(fn, ...a),
    sleep: ms => page.waitForTimeout(ms),
    shot: async (tag) => { await page.screenshot({ path: path.join(shotsDir, `${String(++shotN).padStart(2, '0')}-${tag}.png`) }); },
    check: (name, ok, detail) => {
      results.push({ name, ok: !!ok, detail: detail || '' });
      console.log((ok ? '  ✓ ' : '  ✗ ') + name + (detail ? ' — ' + detail : ''));
      return !!ok;
    },
    report: () => {
      const passed = results.filter(r => r.ok).length;
      console.log(`\n=== ${passed}/${results.length} checks passed · pageErrors: ${errs.length} ===`);
      results.filter(r => !r.ok).forEach(r => console.log('  FAILED:', r.name, r.detail));
      errs.slice(0, 8).forEach(e => console.log('  ERR:', e));
      return { passed, total: results.length, errs: errs.length };
    },
    // simulated tap that goes through the real pointer pipeline
    tapCard: async (name) => {
      await page.evaluate((n) => {
        const c = document.querySelector(`#hand .card[data-card-name="${n}"]`);
        if (!c) throw new Error('no card ' + n);
        c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7 }));
        c.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7 }));
      }, name);
      await page.waitForTimeout(250);
    },
    pickTarget: async (figId) => {
      await page.evaluate((t) => {
        const figs = [...document.querySelectorAll('.fig-targetable')];
        const pick = (t && figs.find(x => x.dataset.fig === t)) || figs[0];
        if (pick) pick.click();
      }, figId || null);
      await page.waitForTimeout(300);
    },
    pickRow: async (row) => {
      await page.evaluate((r) => {
        const slot = document.querySelector(`#party-half .slot[data-row="${r}"]`);
        if (slot && slot.onclick) slot.onclick();
      }, row);
      await page.waitForTimeout(300);
    },
    endTurn: async () => {
      await page.evaluate(() => document.querySelector('#btn-endturn').click());
      let w = 0;
      while (w++ < 80) {
        const busy = await page.evaluate(() => typeof S !== 'undefined' && S && S.executing);
        if (!busy) break;
        await page.waitForTimeout(140);
      }
      await page.waitForTimeout(200);
    },
    // THE TRIAD LANDS WITHOUT A SPLASH (v2.2 Build 34). It used to freeze the
    // field and hold a full-screen TRIAD FORMED card until you tapped it, so
    // this waited for that card and clicked it. There is nothing to dismiss
    // now — the badge flips to crowned, the burst swells, the narrator names
    // the vow — so this waits for the triad to LAND. (Kept under the old name
    // because every call site means "get past the triad".)
    dismissCeremony: async () => {
      for (let i = 0; i < 16; i++) {
        // `S` is a lexical global, not a property of window — reading it as
        // window.S is silently undefined and this poll never fires
        if (await page.evaluate(() => typeof S !== 'undefined' && !!S && !!S.triadFormed && !!S.allOutCrowned)) return true;
        const splash = await page.evaluate(() => !!document.querySelector('.triad-title'));
        if (splash) { await page.evaluate(() => document.querySelector('#overlay').click()); await page.waitForTimeout(350); }
        await page.waitForTimeout(250);
      }
      return false;
    },
    // real pointer drag between two selectors (cards, figures, slots)
    drag: async (fromSel, toSel) => {
      const pt = async (sel) => page.evaluate((q) => {
        const el = document.querySelector(q);
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }, sel);
      const a = await pt(fromSel), b = await pt(toSel);
      await page.mouse.move(a.x, a.y); await page.mouse.down();
      await page.mouse.move(a.x, a.y - 30, { steps: 4 });
      await page.mouse.move(b.x, b.y, { steps: 8 });
      await page.mouse.up();
      await page.waitForTimeout(550);
    },
    clickOverlayBtn: async (id) => {
      await page.evaluate((i) => document.querySelector(i)?.click(), id);
      await page.waitForTimeout(450);
    },
  };
  return api;
}
module.exports = { boot };
