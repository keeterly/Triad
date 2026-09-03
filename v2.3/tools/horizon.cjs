// ═══════════════════════════════════════════════════════════════════════════
// THE HORIZON MILL — split one painting into a sky and a floor
// ═══════════════════════════════════════════════════════════════════════════
//
// Build 120 lets the camera leave the spot it has stood on since Build 4, and
// the moment it does, a painted backdrop stops working. A plate is correct from
// exactly one viewpoint; swing thirty degrees and the painted floor is a
// painted floor seen edge-on, and the painted buildings slide with you.
//
// But a painting of a street is really two things stuck together, and they come
// apart cleanly AT THE HORIZON:
//
//   ABOVE it is far away. Buildings, mist, sky — things whose parallax is
//   negligible, which is exactly what a CYCLORAMA is for. Wrapped on a cylinder
//   around the fight it is geometrically right from every angle.
//
//   BELOW it is the ground, and a ground is a PLANE. Inverse-project the
//   painted floor back onto that plane and it is right from every angle too.
//
// The join needs no blending: at the horizon both are infinitely far, so they
// meet by construction. That is the whole trick, and it is why this is a build
// step rather than a shader.
//
// THE LENS IS MEASURED, NOT ASSUMED. To un-project the floor you need the
// camera the painting was made with. Two numbers are found by looking:
//
//   THE HORIZON, as the row where the image stops changing vertically. A street
//   receding to a vanishing point has its least vertical gradient exactly where
//   everything converges — and in this painting the far end is deliberately
//   lost in mist, which makes the minimum unmistakable.
//
//   THE SCALE, by finding the original 1600x893 plate inside the outpainted
//   3168x1344 one. The outpaint invented the wings but kept the middle, so a
//   downsampled cross-correlation over a few candidate scales locates it, and
//   with it the focal length: the plate's own lens is known exactly, because
//   #k-field has been rendering it at `perspective: 700px` since Build 21.
//
//   node v2.3/tools/horizon.cjs <panorama.webp> <plate.webp> <outdir>
//
// The panorama is `art/bg23-plaza-pano.webp` — the plaza plate outpainted to
// twice its width, which is where the wings of the horizon came from.
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');

const PANO = process.argv[2], PLATE = process.argv[3], OUT = process.argv[4];
if (!PANO || !PLATE || !OUT) {
  console.error('usage: node horizon.cjs <panorama.webp> <plate.webp> <outdir>');
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

// THE STAGE'S OWN LENS, which is where every number below is anchored.
// #k-field: perspective 700px, origin 50% 22%, on a 932x430 board. The plate is
// drawn into it with object-fit: cover and object-position 50% 42%.
const STAGE = { w: 932, h: 430, focal: 700, px: 466, py: 94.6 };
const PLATE_WH = [1600, 893];
const COVER = Math.max(STAGE.w / PLATE_WH[0], STAGE.h / PLATE_WH[1]);
const PLATE_TOP = (PLATE_WH[1] * COVER - STAGE.h) * 0.42;

(async () => {
  const root = path.dirname(path.resolve(PANO));
  const srv = http.createServer((rq, rs) => {
    const url = decodeURIComponent(rq.url.split('?')[0]);
    if (url === '/__page') {
      rs.writeHead(200, { 'Content-Type': 'text/html' });
      rs.end('<!doctype html><meta charset=utf-8><body>');
      return;
    }
    fs.readFile(path.join(root, url), (e, d) => {
      if (e) { rs.writeHead(404); rs.end(); return; }
      rs.writeHead(200, { 'Content-Type': /\.png$/.test(url) ? 'image/png' : 'image/webp' });
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

  const out = await page.evaluate(async ([panoUrl, plateUrl, S, PWH, cover, plateTop]) => {
    const load = (u) => new Promise((res, rej) => {
      const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = u;
    });
    const pano = await load(panoUrl), plate = await load(plateUrl);
    const grab = (img, w, h) => {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0, w, h);
      return { c, x, d: x.getImageData(0, 0, w, h).data, w, h };
    };
    const P = grab(pano, pano.width, pano.height);
    const log = [];

    // ── 1. THE HORIZON, by least vertical change ────────────────────────────
    // Summed over the middle half of the width, so the buildings at the edges
    // (which have strong horizontal edges of their own at every height) do not
    // outvote the vanishing point they all converge on.
    const x0 = Math.round(P.w * 0.30), x1 = Math.round(P.w * 0.70);
    const rowEnergy = [];
    for (let y = 1; y < P.h; y++) {
      let s = 0;
      for (let x = x0; x < x1; x += 3) {
        const a = (y * P.w + x) * 4, b = ((y - 1) * P.w + x) * 4;
        s += Math.abs(P.d[a] - P.d[b]) + Math.abs(P.d[a + 1] - P.d[b + 1]) + Math.abs(P.d[a + 2] - P.d[b + 2]);
      }
      rowEnergy.push(s);
    }
    // smooth, then take the minimum in the middle band — the horizon is never
    // in the top or bottom fifth of a street painting
    const sm = rowEnergy.map((_, i) => {
      let s = 0, n = 0;
      for (let k = -12; k <= 12; k++) { const j = i + k; if (j >= 0 && j < rowEnergy.length) { s += rowEnergy[j]; n++; } }
      return s / n;
    });
    let hy = 0, best = Infinity;
    for (let y = Math.round(P.h * 0.18); y < Math.round(P.h * 0.62); y++)
      if (sm[y] < best) { best = sm[y]; hy = y; }
    log.push('horizon row ' + hy + ' of ' + P.h + ' (' + (hy / P.h * 100).toFixed(1) + '%)');

    // ── 2. THE SCALE, by finding the plate inside the panorama ──────────────
    // Downsampled grayscale cross-correlation. The outpaint invented the wings
    // and kept the middle, so the original is in there at SOME scale; trying a
    // range and keeping the best match is how you find out which.
    const gray = (g) => {
      const o = new Float32Array(g.w * g.h);
      for (let i = 0; i < o.length; i++) o[i] = (g.d[i * 4] + g.d[i * 4 + 1] + g.d[i * 4 + 2]) / 3;
      return o;
    };
    const TW = 160;                                   // template width, downsampled
    const th = Math.round(TW * PWH[1] / PWH[0]);
    const T = grab(plate, TW, th); const tg = gray(T);
    let tm = 0; for (const v of tg) tm += v; tm /= tg.length;
    let tv = 0; for (const v of tg) tv += (v - tm) * (v - tm);
    tv = Math.sqrt(tv) || 1;

    let bestS = null, bestScore = -2;
    for (let s = 0.40; s <= 1.001; s += 0.01) {
      // the plate at this fraction of the panorama's width
      const pw = Math.max(8, Math.round(TW / s));      // panorama, downsampled so
      const ph = Math.round(pw * P.h / P.w);           // the plate is TW wide in it
      const G = grab(pano, pw, ph); const pg = gray(G);
      // slide over a coarse grid; the outpaint keeps the source near the middle
      for (let oy = 0; oy + th <= ph; oy += 2) {
        for (let ox = 0; ox + TW <= pw; ox += 2) {
          let m = 0;
          for (let y = 0; y < th; y += 2) for (let x = 0; x < TW; x += 2) m += pg[(oy + y) * pw + ox + x];
          m /= (Math.ceil(th / 2) * Math.ceil(TW / 2));
          let num = 0, den = 0;
          for (let y = 0; y < th; y += 2) for (let x = 0; x < TW; x += 2) {
            const a = pg[(oy + y) * pw + ox + x] - m, b = tg[y * TW + x] - tm;
            num += a * b; den += a * a;
          }
          const score = num / (Math.sqrt(den || 1) * tv);
          if (score > bestScore) { bestScore = score; bestS = { s, ox, oy, pw, ph }; }
        }
      }
    }
    log.push('plate found at ' + (bestS.s * 100).toFixed(0) + '% of the panorama width'
      + ' (correlation ' + bestScore.toFixed(3) + ')');

    // the plate occupies `s` of the panorama's width, so one plate pixel is
    // (P.w * s / PWH[0]) panorama pixels — and the plate's own focal length in
    // plate pixels is the stage focal divided by the cover scale.
    const plateToPano = P.w * bestS.s / PWH[0];
    const focalPlate = S.focal / cover;
    const focal = focalPlate * plateToPano;            // panorama pixels
    const cx = (bestS.ox / bestS.pw) * P.w + plateToPano * (S.px / cover);
    log.push('focal ' + focal.toFixed(0) + ' px, principal x ' + cx.toFixed(0)
      + ', horizontal field ' + (2 * Math.atan(P.w / 2 / focal) * 180 / Math.PI).toFixed(1) + ' degrees');
    // ── 3. THE SKY, AS A CURVED PANEL ───────────────────────────────────────
    //
    // The first version wrapped the painting all the way around a cylinder,
    // mirror-folded into the 276 degrees it does not cover. Two things were
    // wrong with it and both are arithmetic rather than taste:
    //
    //   THE DETAIL IS NOT THERE TO SPREAD. The painting is 3168 px across 84
    //   degrees. Holding that angular resolution around a full circle needs a
    //   texture 13,600 px wide; at any size worth shipping the painted wedge is
    //   downsampled five-fold, and a five-fold downsample of a building is a
    //   smear. What came out looked like a cathedral of vertical streaks.
    //
    //   AND A MIRROR-FOLD REPEATS. Four copies of the same lit doorway around
    //   the horizon is not more city, it is wallpaper.
    //
    // So the painting stays a PANEL — one 84-degree arc at its own resolution,
    // undistorted, facing the way the board has always faced — and the rest of
    // the horizon is fog, generated in the game where fog costs nothing. In a
    // city this ruined that is not a compromise; a plaza that fades into weather
    // is the whole mood, and it is the honest thing to show when there is no
    // painting of what is behind you.
    //
    // The mapping is linear in v and that is exact, not an approximation: on a
    // cylinder of radius R a point at height h has tan(elevation) = h/R, and
    // the source row v gives tan(elevation) = (hy - v)/focal. So h = R*(hy-v)
    // /focal — linear. A straight blit lands the painting on the cylinder
    // correctly, and the caller picks R to choose how tall the skyline stands.
    const halfFov = Math.atan(P.w / 2 / focal);
    const aboveT = hy / focal;                       // tan of the top elevation
    // THE BAND STOPS JUST UNDER THE HORIZON. Everything the painting shows
    // below it is floor, and a floor is a plane, not a wall twenty metres away
    // — so the panel carries a hand's width of it to tuck under the ground
    // plane's far edge, and no more.
    const belowT = 0.055;
    const SKY_W = 2048;
    const SKY_H = Math.round(SKY_W * (aboveT + belowT) * focal / P.w);
    const sky = document.createElement('canvas');
    sky.width = SKY_W; sky.height = SKY_H;
    const sxc = sky.getContext('2d');
    const vTopSky = Math.max(0, hy - focal * aboveT);
    const vBotSky = Math.min(P.h, hy + focal * belowT);
    sxc.drawImage(pano, 0, vTopSky, P.w, vBotSky - vTopSky, 0, 0, SKY_W, SKY_H);
    // THE PANEL MUST NOT END. It covers 84 degrees of a 360-degree horizon, and
    // wherever it stops there is a hard vertical edge with fog on the other
    // side of it — which is exactly what the first orbit found, a rectangle of
    // painting hanging in the weather. So the panel carries its own alpha: it
    // dissolves at the sides into the same mist the rest of the ring is made
    // of, and at the top into the sky. Nothing is ever seen to end.
    const sim = sxc.getImageData(0, 0, SKY_W, SKY_H);
    const FADE_X = 0.16, FADE_TOP = 0.22;
    for (let y = 0; y < SKY_H; y++) {
      const ty = y / SKY_H;
      const aTop = ty < FADE_TOP ? Math.pow(ty / FADE_TOP, 0.85) : 1;
      for (let x = 0; x < SKY_W; x++) {
        const tx = x / SKY_W;
        const e = Math.min(tx, 1 - tx) / FADE_X;
        const aX = e < 1 ? Math.pow(Math.max(0, e), 0.9) : 1;
        sim.data[(y * SKY_W + x) * 4 + 3] = Math.round(255 * aTop * aX);
      }
    }
    sxc.putImageData(sim, 0, 0);
    log.push('sky panel ' + SKY_W + 'x' + SKY_H + ' over ' + (halfFov * 2 * 180 / Math.PI).toFixed(1)
      + ' degrees, band ' + (aboveT + belowT).toFixed(3) + ' of the radius');

    // ── 4. THE FLOOR — AND WHY IT IS NOT UN-PROJECTED ───────────────────────
    //
    // The first version of this did the textbook thing: the painting's camera
    // stands at eye height looking level, so a floor point d ahead and X across
    // lands at (cx + f*X/d, hy + f*eye/d); run that backwards for every texel
    // and the painted stone drops onto the real ground plane, correct from any
    // angle. It produced a fan of radial smears, and the reason is worth
    // writing down:
    //
    //   THAT FLOOR IS A MIRROR, NOT A TEXTURE. The plaza is soaked. Nearly
    //   every pixel below the horizon is a REFLECTION of something above it —
    //   the buildings, the lit doorway, the sky. A reflection is not a property
    //   of the floor, it is a property of the view, and un-projecting it as if
    //   it were paint stretches every vertical feature to infinity. The maths
    //   was right and the assumption underneath it was wrong.
    //
    // So the floor is TILED from the painting instead of rectified out of it.
    // The bottom of the frame is the nearest ground and therefore the least
    // compressed — the closest the painting comes to showing its floor flat —
    // and squashed by the perspective factor and mirror-tiled it gives real wet
    // stone in the real palette, without ever claiming to know what any
    // reflection was reflecting.
    const F_PX = 1024, F_M = 10.0, EYE_M = 1.70, CAM_Z = 7.5;

    // Sampling the palette is the part worth keeping from the painting; tiling
    // its PIXELS is not. Two attempts proved that:
    //
    //   Un-projecting the floor made a fan of radial smears, because that floor
    //   is a MIRROR — nearly every pixel below the horizon is a reflection of
    //   something above it, and a reflection is a property of the view, not of
    //   the ground.
    //
    //   Tiling the nearest strip instead made choppy water. The nearest ground
    //   is also the darkest ground — it is the part in shadow, mean luminance
    //   17 of 255 — so lifting it to something a floor can be meant a gain of
    //   nearly six, which amplifies mottling into waves, and a 6.5 m tile
    //   repeated over forty metres reads as a pattern rather than as stone.
    //
    // So the painting is asked for the only thing it can answer reliably: what
    // COLOUR this plaza is. Everything else is drawn — flagstones, pooling and
    // grain, the same way the cast is painted — at a tile big enough that the
    // repeat falls off into fog before anybody can count it.
    let mr = 0, mg = 0, mb = 0, mn = 0;
    for (let v = hy + 60; v < P.h; v += 3) for (let u = 0; u < P.w; u += 3) {
      const i2 = (v * P.w + u) * 4; mr += P.d[i2]; mg += P.d[i2 + 1]; mb += P.d[i2 + 2]; mn++;
    }
    mr /= mn; mg /= mn; mb /= mn;
    const lum = mr * 0.299 + mg * 0.587 + mb * 0.114;
    // keep the painting's HUE, choose the value: wet stone under a grey sky
    const BASE = 74;
    const kk = BASE / Math.max(1, lum);
    const base = [Math.min(255, mr * kk), Math.min(255, mg * kk), Math.min(255, mb * kk)];
    log.push('floor palette from the painting: rgb(' + base.map(v => v.toFixed(0)).join(',')
      + ') — its own hue at value ' + BASE + ', tile ' + F_M + ' m');

    const flr = document.createElement('canvas');
    flr.width = flr.height = F_PX;
    const fx = flr.getContext('2d');
    const rgb = (c, a) => 'rgba(' + c.map(v => Math.round(v)).join(',') + ',' + a + ')';
    fx.fillStyle = rgb(base, 1); fx.fillRect(0, 0, F_PX, F_PX);
    // WET AND DRY, in big soft patches. Drawn wrapped so the tile has no edge.
    for (let i2 = 0; i2 < 150; i2++) {
      const cx2 = Math.random() * F_PX, cy2 = Math.random() * F_PX;
      const r = 40 + Math.random() * 190;
      const wet = Math.random() < 0.5;
      for (const [ox, oy] of [[0,0],[F_PX,0],[-F_PX,0],[0,F_PX],[0,-F_PX]]) {
        const g = fx.createRadialGradient(cx2+ox, cy2+oy, 0, cx2+ox, cy2+oy, r);
        g.addColorStop(0, wet ? 'rgba(22,24,27,0.30)' : 'rgba(216,214,206,0.16)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        fx.fillStyle = g; fx.beginPath(); fx.arc(cx2+ox, cy2+oy, r, 0, 7); fx.fill();
      }
    }
    // THE JOINTS WOBBLE. A flagstone edge drawn with a ruler is the fastest way
    // to lose a painted look. They stop short of the border, because a wobbling
    // line cannot meet its own other end across a seam — so the seam carries no
    // line and the wash hides where it falls.
    fx.lineCap = 'round';
    const stroke = (x0, y0, x1, y1, w, a) => {
      fx.strokeStyle = 'rgba(18,19,22,' + a + ')'; fx.lineWidth = w;
      fx.beginPath(); fx.moveTo(x0, y0);
      for (let k2 = 1; k2 <= 10; k2++) {
        const t = k2 / 10;
        fx.lineTo(x0 + (x1 - x0) * t + (Math.random() - 0.5) * 7,
                  y0 + (y1 - y0) * t + (Math.random() - 0.5) * 7);
      }
      fx.stroke();
    };
    const N = 8, cell = F_PX / N, pad = 16;
    for (let i2 = 1; i2 < N; i2++) {
      stroke(i2 * cell, pad, i2 * cell, F_PX - pad, 2.0 + Math.random() * 1.4, 0.20 + Math.random() * 0.14);
      stroke(pad, i2 * cell, F_PX - pad, i2 * cell, 2.0 + Math.random() * 1.4, 0.20 + Math.random() * 0.14);
    }
    // standing water: a few long, faint, brighter smears — the plaza is soaked,
    // and this is as much of that as a floor texture is allowed to claim
    for (let i2 = 0; i2 < 26; i2++) {
      const x0 = Math.random() * F_PX, y0 = Math.random() * F_PX;
      const g = fx.createLinearGradient(x0, y0, x0 + 20, y0 + 130 + Math.random() * 160);
      g.addColorStop(0, 'rgba(232,232,228,0)');
      g.addColorStop(0.45, 'rgba(232,232,228,0.10)');
      g.addColorStop(1, 'rgba(232,232,228,0)');
      fx.fillStyle = g;
      fx.fillRect(x0 - 12, y0, 30 + Math.random() * 26, 150 + Math.random() * 180);
    }
    // …and the paper tooth the cast itself wears, so floor and figures share a
    // surface rather than sitting on two different ones
    const fim = fx.getImageData(0, 0, F_PX, F_PX);
    for (let i2 = 0; i2 < fim.data.length; i2 += 4) {
      const n = (Math.random() - 0.5) * 15;
      fim.data[i2] += n; fim.data[i2 + 1] += n; fim.data[i2 + 2] += n;
    }
    fx.putImageData(fim, 0, 0);

    return { hy, focal, cx, w: P.w, h: P.h, log, corr: bestScore, scale: bestS.s,
             halfFov, aboveT, belowT, floorM: F_M, camZ: CAM_Z,
             skyW: SKY_W, skyH: SKY_H,
             sky: sky.toDataURL('image/webp', 0.92),
             floor: flr.toDataURL('image/webp', 0.90) };
  }, ['/' + path.basename(PANO), '/' + path.basename(PLATE), STAGE, PLATE_WH, COVER, PLATE_TOP]);

  out.log.forEach(l => console.log('  ' + l));
  const write = (name, dataUrl) => {
    const b = Buffer.from(dataUrl.split(',')[1], 'base64');
    fs.writeFileSync(path.join(OUT, name), b);
    console.log('  ' + name.padEnd(12) + (b.length / 1024).toFixed(0) + ' KB');
  };
  write('sky.webp', out.sky);
  write('floor.webp', out.floor);
  fs.writeFileSync(path.join(OUT, 'lens.json'), JSON.stringify({
    // what the world needs to place these two textures correctly
    horizon: out.hy, focal: +out.focal.toFixed(2), cx: +out.cx.toFixed(2),
    halfFov: +(out.halfFov * 180 / Math.PI).toFixed(3),
    skyW: out.skyW, skyH: out.skyH,
    // the sky band, in units of the cyclorama's radius: pick R and multiply
    skyAbove: +out.aboveT.toFixed(5), skyBelow: +out.belowT.toFixed(5),
    // the floor tile covers this many metres square, centred on the board
    floorM: out.floorM, camZ: out.camZ,
    corr: +out.corr.toFixed(4), scale: +out.scale.toFixed(3),
  }, null, 1));
  console.log('  lens.json    ' + JSON.stringify({ horizon: out.hy, focal: +out.focal.toFixed(0) }));
  await browser.close();
  srv.close();
})();
