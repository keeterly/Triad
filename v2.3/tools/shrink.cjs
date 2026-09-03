// ═══════════════════════════════════════════════════════════════════════════
// THE SHRINK — make a generated character small enough to ship
// ═══════════════════════════════════════════════════════════════════════════
//
// A model comes back from Meshy as a six-megabyte GLB, and nearly four of those
// megabytes are one JPEG. The three heroes and the Regent all ship at two to
// three, because somebody re-encoded their textures by hand before Build 114 —
// which worked once and left no way to do it again. Four more creatures makes
// that a pipeline step, so here it is.
//
// WHAT THIS DOES: re-encodes the baked texture as WebP at a stated size, and
// rewrites the container to say so. What it does NOT do is touch the mesh — the
// shipped models are also decimated and vertex-quantised, and doing either
// properly needs tooling this box does not have. The texture is where the bytes
// are, so the texture is what this takes.
//
// A GLB IS A CONTAINER, NOT A FORMAT: a 12-byte header, a JSON chunk and a BIN
// chunk. Images live in BIN as byte ranges the JSON points at, so replacing one
// means swapping its bytes and moving every bufferView that came after it. That
// is all this is, plus the WebP extension declaration that tells a loader what
// it is now looking at.
//
// The encoder is the browser's, because there isn't one in Node — the same
// headless Chromium the suites use, decoding into a canvas and encoding back
// out. It is the third mill in this directory to do that and it will not be the
// last.
//
//   node v2.3/tools/shrink.cjs <in.glb> <out.glb> [maxSize] [quality]
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');

const IN = process.argv[2], OUT = process.argv[3];
const MAX = Number(process.argv[4] || 2048);
const Q = Number(process.argv[5] || 0.90);
if (!IN || !OUT) {
  console.error('usage: node shrink.cjs <in.glb> <out.glb> [maxSize] [quality]');
  process.exit(2);
}
function requirePlaywright() {
  try { return require('playwright'); } catch (_) {}
  return require('/opt/node22/lib/node_modules/playwright');
}
function findChromium() {
  for (const p of ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'])
    { try { fs.accessSync(p); return p; } catch (_) {} }
  return null;
}

// ── read the container ──────────────────────────────────────────────────────
const buf = fs.readFileSync(IN);
if (buf.readUInt32LE(0) !== 0x46546C67) { console.error('not a GLB'); process.exit(1); }
let off = 12;
const chunks = [];
while (off < buf.length) {
  const len = buf.readUInt32LE(off), type = buf.readUInt32LE(off + 4);
  chunks.push({ type, data: buf.subarray(off + 8, off + 8 + len) });
  off += 8 + len + ((4 - (len % 4)) % 4);
}
const jsonChunk = chunks.find(c => c.type === 0x4E4F534A);
const binChunk = chunks.find(c => c.type === 0x004E4942);
const js = JSON.parse(jsonChunk.data.toString('utf8'));
const bin = binChunk ? Buffer.from(binChunk.data) : Buffer.alloc(0);

const images = (js.images || []).filter(i => i.bufferView != null);
if (!images.length) { console.error('no embedded images — nothing to shrink'); process.exit(1); }

(async () => {
  // serve the source image bytes to the page: a data: URL of four megabytes is
  // not something to push through an evaluate call
  const pending = images.map((img, i) => ({
    i, view: js.bufferViews[img.bufferView], mime: img.mimeType || 'image/png',
  }));
  const srv = http.createServer((rq, rs) => {
    const m = /^\/img(\d+)$/.exec(rq.url.split('?')[0]);
    if (m) {
      const p = pending[Number(m[1])];
      const b = bin.subarray(p.view.byteOffset || 0, (p.view.byteOffset || 0) + p.view.byteLength);
      rs.writeHead(200, { 'Content-Type': p.mime });
      rs.end(b);
      return;
    }
    rs.writeHead(200, { 'Content-Type': 'text/html' });
    rs.end('<!doctype html><meta charset=utf-8><body>');
  });
  await new Promise(r => srv.listen(0, r));
  const port = srv.address().port;
  const { chromium } = requirePlaywright();
  const exe = findChromium();
  const browser = await chromium.launch(Object.assign({ args: ['--no-sandbox'] },
    exe ? { executablePath: exe } : {}));
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:' + port + '/__page', { waitUntil: 'domcontentloaded' });

  const encoded = [];
  for (const p of pending) {
    const out = await page.evaluate(async ([url, max, q]) => {
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
      // longest side to `max`, and never UP: a 1k texture asked for 2k would
      // come back four times the pixels and none of the detail
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * s), h = Math.round(img.height * s);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      return { was: [img.width, img.height], now: [w, h],
               data: c.toDataURL('image/webp', q) };
    }, ['/img' + p.i, MAX, Q]);
    const bytes = Buffer.from(out.data.split(',')[1], 'base64');
    encoded.push({ p, bytes, was: out.was, now: out.now });
    console.log(`  image ${p.i}  ${out.was.join('x')} ${p.mime.split('/')[1]}`
      + ` ${(p.view.byteLength / 1024).toFixed(0)} KB  ->  ${out.now.join('x')} webp`
      + ` ${(bytes.length / 1024).toFixed(0)} KB`);
  }
  await browser.close();
  srv.close();

  // ── rebuild BIN, moving everything that came after each image ─────────────
  //
  // Every bufferView is an offset into one blob, so replacing a range with a
  // shorter one shifts all of them. Rebuilding the blob in bufferView order and
  // rewriting the offsets as it goes is simpler than patching, and it cannot
  // leave a stale offset behind.
  const swap = new Map(encoded.map(e => [e.p.view, e.bytes]));
  const order = js.bufferViews.map((v, i) => ({ v, i }))
    .sort((a, b) => (a.v.byteOffset || 0) - (b.v.byteOffset || 0));
  const parts = [];
  let cursor = 0;
  for (const { v } of order) {
    const src = swap.has(v)
      ? swap.get(v)
      : bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength);
    // GLB wants four-byte alignment for anything an accessor reads
    const pad = (4 - (cursor % 4)) % 4;
    if (pad) { parts.push(Buffer.alloc(pad)); cursor += pad; }
    v.byteOffset = cursor;
    v.byteLength = src.length;
    parts.push(src);
    cursor += src.length;
  }
  const newBin = Buffer.concat(parts);
  js.buffers = [{ byteLength: newBin.length }];

  // ── and say what the images are now ──────────────────────────────────────
  // EXT_texture_webp is how a glTF states a WebP texture, and three.js reads
  // it. Every texture pointing at a re-encoded image moves its `source` under
  // the extension, which is exactly the shape the models that already ship use.
  for (const e of encoded) js.images[e.p.i].mimeType = 'image/webp';
  const reencoded = new Set(encoded.map(e => e.p.i));
  for (const t of (js.textures || [])) {
    if (t.source == null || !reencoded.has(t.source)) continue;
    t.extensions = Object.assign({}, t.extensions,
      { EXT_texture_webp: { source: t.source } });
    delete t.source;
  }
  js.extensionsUsed = Array.from(new Set([...(js.extensionsUsed || []), 'EXT_texture_webp']));

  const jsonBuf = Buffer.from(JSON.stringify(js), 'utf8');
  const jsonPad = (4 - (jsonBuf.length % 4)) % 4;
  const binPad = (4 - (newBin.length % 4)) % 4;
  const total = 12 + 8 + jsonBuf.length + jsonPad + 8 + newBin.length + binPad;
  const out = Buffer.alloc(total);
  let o = 0;
  out.writeUInt32LE(0x46546C67, o); o += 4;
  out.writeUInt32LE(2, o); o += 4;
  out.writeUInt32LE(total, o); o += 4;
  out.writeUInt32LE(jsonBuf.length + jsonPad, o); o += 4;
  out.writeUInt32LE(0x4E4F534A, o); o += 4;
  jsonBuf.copy(out, o); o += jsonBuf.length;
  for (let i = 0; i < jsonPad; i++) out[o++] = 0x20;      // JSON pads with spaces
  out.writeUInt32LE(newBin.length + binPad, o); o += 4;
  out.writeUInt32LE(0x004E4942, o); o += 4;
  newBin.copy(out, o); o += newBin.length;
  for (let i = 0; i < binPad; i++) out[o++] = 0;          // BIN pads with zeroes
  fs.writeFileSync(OUT, out);
  console.log(`  ${path.basename(IN)} ${(buf.length / 1048576).toFixed(2)} MB`
    + `  ->  ${path.basename(OUT)} ${(out.length / 1048576).toFixed(2)} MB`);
})();
