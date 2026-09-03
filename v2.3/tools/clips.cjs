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
      return { name: a.name, dur: a.duration, tracks: a.tracks.length, json: THREE.AnimationClip.toJSON(a) };
    }, ['/' + encodeURIComponent(file), '/lib']);
    if (got.error) { console.log('FAILED — ' + got.error); continue; }
    out[verb] = trim(got.json);
    // the clip is renamed to the VERB the fight speaks, not the marketing name
    // Meshy gave it, so the game never has to know a clip was called
    // "Armature|Sword_Judgment|baselayer"
    out[verb].name = verb;
    console.log(`${got.dur.toFixed(2)}s · ${out[verb].tracks.length} tracks (was ${got.tracks}) · from "${got.name}"`);
  }

  await browser.close();
  srv.close();
  fs.writeFileSync(OUT, JSON.stringify(out));
  const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
  console.log(`\n  ${Object.keys(out).length} clips → ${OUT} (${kb} KB)`);
})();
