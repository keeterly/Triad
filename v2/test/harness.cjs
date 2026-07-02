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
      localStorage.setItem('kizuna.unlocked', '1');
      // Apply the test's initial state ONCE per browser context — reloads
      // within a test must keep whatever state the test has since written.
      if (!sessionStorage.getItem('__v2init')) {
        sessionStorage.setItem('__v2init', '1');
        if (init.flow != null) localStorage.setItem('kizuna2.flow', String(init.flow));
        if (init.clearRun) localStorage.removeItem('kizuna2.run');
      }
    } catch (_) {}
  }, { flow: opts.flow, clearRun: opts.clearRun !== false });
  await page.goto(`http://127.0.0.1:${port}/v2/index.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  const results = [];
  const shotsDir = opts.shotsDir || path.join(__dirname, 'shots');
  fs.mkdirSync(shotsDir, { recursive: true });
  let shotN = 0;
  const api = {
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
    dismissCeremony: async () => {
      for (let i = 0; i < 12; i++) {
        const up = await page.evaluate(() => !!document.querySelector('.triad-title'));
        if (up) { await page.evaluate(() => document.querySelector('#overlay').click()); await page.waitForTimeout(350); return true; }
        await page.waitForTimeout(250);
      }
      return false;
    },
    clickOverlayBtn: async (id) => {
      await page.evaluate((i) => document.querySelector(i)?.click(), id);
      await page.waitForTimeout(450);
    },
  };
  return api;
}
module.exports = { boot };
