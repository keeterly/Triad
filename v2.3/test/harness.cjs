// Playwright harness for KIZUNA v2.3 — boots /v2.3/index.html?test=1 against
// the same repo-root static server the v2.2 suite uses (shared port 8099).
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

function findChromium() {
  const candidates = [process.env.V2_CHROMIUM, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].filter(Boolean);
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
  return null;
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
  if (await ping(`http://127.0.0.1:${port}/v2.3/index.html`)) return null;
  const server = spawn('npx', ['http-server', root, '-p', String(port), '-s'], { stdio: 'ignore', detached: true });
  server.unref();
  for (let i = 0; i < 20; i++) {
    if (await ping(`http://127.0.0.1:${port}/v2.3/index.html`)) return server;
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
  const browser = await chromium.launch(Object.assign({ args: ['--no-sandbox'] }, exe ? { executablePath: exe } : {}));
  const ctx = await browser.newContext({ viewport: { width: 932, height: 430 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message)));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    // the sandboxed test browser cannot reach Google Fonts — the game falls
    // back to Georgia there; that reset is environment noise, not a bug
    const src = (m.location() && m.location().url) || '';
    if (/fonts\.(googleapis|gstatic)\.com/.test(src)) return;
    // the foe-sheet degradation check ASKS for a file that is not there — the
    // 404 is the thing under test, not noise, and the filename says so
    if (/THIS-DOES-NOT-EXIST/.test(src)) return;
    errs.push('console: ' + m.text());
  });
  const query = opts.query ? '&' + String(opts.query).replace(/^[?&]/, '') : '';
  await page.goto(`http://127.0.0.1:${port}/v2.3/index.html?test=1${query}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 8000 });

  const results = [];
  const shotsDir = path.join(__dirname, 'shots');
  fs.mkdirSync(shotsDir, { recursive: true });
  let shotN = 0;
  return {
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
  };
}
module.exports = { boot };
