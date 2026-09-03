// ═══════════════════════════════════════════════════════════════════════════
// THE CLIP MILL — turn a pile of animated GLBs into one small clip library
// ═══════════════════════════════════════════════════════════════════════════
//
// Meshy returns an animation the only way it can: as a whole character. Every
// clip arrives as a ~6 MB GLB carrying the same mesh and the same 5 MB texture
// as the last one, with the twenty seconds of bone motion we actually asked
// for buried inside it. Ten clips that way is 60 MB to ship a few hundred
// kilobytes of curves.
//
// So this strips them. It loads each GLB in a real browser (the same headless
// Chromium the suites use, because three's GLTFLoader is the thing that
// already knows how to read one), takes the AnimationClip out, throws the mesh
// and the texture away, and writes every clip into one JSON file the game
// parses back with THREE.AnimationClip.parse.
//
// WHY THIS WORKS AT ALL: Meshy's humanoid auto-rig is standardised. Ash, Elin
// and Mira came back with the same 24 joints, in the same order, under the
// same names — so a clip authored against one of them drives all three, and
// the library is generated ONCE rather than three times. That is the whole
// reason the animation budget fits.
//
//   node v2.3/tools/clips.cjs <manifest.json> <out.json>
//
// The manifest is { verb: "path/to/animated.glb", … }.
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');

const MANIFEST = process.argv[2];
const OUT = process.argv[3];
if (!MANIFEST || !OUT) {
  console.error('usage: node clips.cjs <manifest.json> <out.json>');
  process.exit(2);
}
const jobs = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));

function requirePlaywright() {
  try { return require('playwright'); } catch (_) {}
  return require('/opt/node22/lib/node_modules/playwright');
}
function findChromium() {
  const c = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'];
  for (const p of c) { try { fs.accessSync(p); return p; } catch (_) {} }
  return null;
}

// SCALE TRACKS ARE DEAD WEIGHT on a rig nothing scales, and four decimals is
// finer than a bone anyone can see at 145 pixels tall. Between them they take
// the library from about a megabyte to something worth shipping.
const DP = 4;
function trim(clip) {
  clip.tracks = clip.tracks.filter(t => !/\.scale$/.test(t.name));
  for (const t of clip.tracks) {
    t.times = t.times.map(v => +v.toFixed(DP));
    t.values = t.values.map(v => +v.toFixed(DP));
  }
  return clip;
}

// ── WHERE THE MOTION ACTUALLY IS ───────────────────────────────────────────
//
// A library clip is authored to be looked at on its own: it settles into the
// pose, does the thing, and settles back, and the settling is most of its
// length. `Sword_Judgment` is 4.4 seconds; the swing inside it is well under
// one. Played whole against a combat beat that resolves in a few hundred
// milliseconds, the clip is mostly a character standing still either side of
// the moment that mattered — which is why the first pass had to run everything
// at two and a half times speed and still felt late.
//
// So the window is MEASURED. Sum how much every joint rotates between one
// sample and the next, and that curve is the clip's motion energy over time.
// Keep the shortest span holding the bulk of it, pad a little either side for
// the anticipation and the follow-through, and drop the rest. Nothing is
// guessed and nothing needs retuning when a clip is swapped.
const KEEP = 0.86;    // fraction of the total motion the window must contain
const PAD = 0.10;     // …plus a tenth of the clip either side, for the wind-up
function windowOf(clipJson) {
  const rots = clipJson.tracks.filter(t => /\.quaternion$/.test(t.name));
  if (!rots.length) return null;
  // one common timeline: the longest track's times will do
  const base = rots.reduce((a, b) => (b.times.length > a.times.length ? b : a));
  const times = base.times;
  const n = times.length;
  if (n < 4) return null;
  const energy = new Array(n).fill(0);
  for (const t of rots) {
    const v = t.values, m = t.times.length;
    for (let i = 1; i < m; i++) {
      // 1 - |dot| is a cheap stand-in for the angle between two quaternions
      let d = 0;
      for (let k = 0; k < 4; k++) d += v[(i - 1) * 4 + k] * v[i * 4 + k];
      const e = 1 - Math.abs(d);
      const at = Math.min(n - 1, Math.round((t.times[i] / times[n - 1]) * (n - 1)));
      energy[at] += e;
    }
  }
  const total = energy.reduce((a, b) => a + b, 0);
  if (total <= 0) return null;
  // the shortest window holding KEEP of the energy
  let best = [0, n - 1], bestLen = Infinity;
  for (let lo = 0; lo < n; lo++) {
    let sum = 0;
    for (let hi = lo; hi < n; hi++) {
      sum += energy[hi];
      if (sum >= total * KEEP) {
        if (hi - lo < bestLen) { bestLen = hi - lo; best = [lo, hi]; }
        break;
      }
    }
  }
  const dur = times[n - 1] || 1;
  const pad = dur * PAD;
  return [Math.max(0, times[best[0]] - pad), Math.min(dur, times[best[1]] + pad)];
}

(async () => {
  const root = path.dirname(path.resolve(MANIFEST));
  // ONE ORIGIN FOR EVERYTHING. The page imports the vendored three.js as a
  // module, and a dynamic import across two localhost ports is cross-origin —
  // so the GLBs and the library are served by the same server as the page.
  const lib = path.resolve(__dirname, '..', 'lib');
  const srv = http.createServer((rq, rs) => {
    const url = decodeURIComponent(rq.url.split('?')[0]);
    if (url === '/__page') {
      rs.writeHead(200, { 'Content-Type': 'text/html' });
      rs.end('<!doctype html><meta charset=utf-8><body>');
      return;
    }
    const lp = url.startsWith('/lib/');
    const f = lp ? path.join(lib, path.basename(url)) : path.join(root, url);
    fs.readFile(f, (e, d) => {
      if (e) { rs.writeHead(404); rs.end(); return; }
      rs.writeHead(200, { 'Content-Type': lp ? 'text/javascript' : 'model/gltf-binary' });
      rs.end(d);
    });
  });
  await new Promise(r => srv.listen(0, r));
  const port = srv.address().port;

  const { chromium } = requirePlaywright();
  const exe = findChromium();
  const browser = await chromium.launch(Object.assign({ args: ['--no-sandbox'] },
    exe ? { executablePath: exe } : {}));
  const page = await browser.newPage();
  page.on('pageerror', e => console.error('  [ERR]', e.message));
  await page.goto('http://127.0.0.1:' + port + '/__page', { waitUntil: 'domcontentloaded' });

  const out = {};
  for (const verb of Object.keys(jobs)) {
    const file = path.basename(jobs[verb]);
    process.stdout.write('  ' + verb.padEnd(10) + file + ' … ');
    const got = await page.evaluate(async ([url, libUrl]) => {
      const THREE = await import(libUrl + '/three.module.min.js');
      const { GLTFLoader } = await import(libUrl + '/GLTFLoader.js');
      const gltf = await new GLTFLoader().loadAsync(url);
      if (!gltf.animations.length) return { error: 'no animation in the file' };
      const a = gltf.animations[0];
      // THE REST POSE TRAVELS WITH THE CLIPS. Every model Meshy returns has its
      // own bind pose — the three characters differ from each other and from
      // the rig these clips were authored on — so a clip cannot be played as-is
      // on anybody. Shipping the source rest pose alongside lets the runtime
      // retarget: the delta a joint takes FROM ITS OWN REST is the part that
      // transfers, and the constant offset between two rigs is the part that
      // must be divided out.
      // …AND SO DOES THE HIERARCHY. Retargeting rotations correctly is a
      // model-space operation — a local rotation only means the same thing on
      // two rigs when their parents agree — so the runtime needs to know which
      // bone hangs off which to accumulate the source pose.
      const rest = {}, parent = {};
      gltf.scene.traverse(o => {
        if (!o.isBone) return;
        rest[o.name] = o.quaternion.toArray().map(v => +v.toFixed(5));
        parent[o.name] = (o.parent && o.parent.isBone) ? o.parent.name : null;
      });
      return { name: a.name, dur: a.duration, tracks: a.tracks.length, rest, parent,
               json: THREE.AnimationClip.toJSON(a) };
    }, ['/' + encodeURIComponent(file), '/lib']);
    if (got.error) { console.log('FAILED — ' + got.error); continue; }
    out[verb] = trim(got.json);
    const win = windowOf(out[verb]);
    if (win) out[verb].window = [+win[0].toFixed(3), +win[1].toFixed(3)];
    // the clip is renamed to the VERB the fight speaks, not the marketing name
    // Meshy gave it, so the game never has to know a clip was called
    // "Armature|Sword_Judgment|baselayer"
    out[verb].name = verb;
    if (!out.__rest) { out.__rest = got.rest; out.__parent = got.parent; }
    const w = out[verb].window;
    console.log(`${got.dur.toFixed(2)}s · ${out[verb].tracks.length} tracks`
      + (w ? ` · motion in ${w[0].toFixed(2)}–${w[1].toFixed(2)}s (${((w[1]-w[0])/got.dur*100).toFixed(0)}%)` : '')
      + ` · from "${got.name}"`);
  }

  await browser.close();
  srv.close();
  fs.writeFileSync(OUT, JSON.stringify(out));
  const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
  console.log(`\n  ${Object.keys(out).length - 2} clips + the source rig → ${OUT} (${kb} KB)`);
})();
