'use strict';
// TRUNK PITCH AT THE SOURCE, so the conversion has something to be judged
// against. Reads the FBX directly and measures the angle of the pelvis-to-head
// line away from the SOURCE's own up axis, per frame, taking the largest.
//
// This is the one comparison that means anything across two rigs. Bone
// quaternions cannot be compared — the two skeletons hold their bones in
// different frames and always will. How far a joint TURNED cannot be compared
// either: the angle of a rotation does not change when you change the frame you
// measure it in, so it reads healthy over an animation rotated into nonsense.
// Where the head ends up over the hips is anatomy, and anatomy is shared.
//
//   node test/trunk.probe.cjs attack_1,sword_heavy,idle_relaxed
const fs = require('fs'), path = require('path'), http = require('http');
const REPO = path.resolve(__dirname, '../..');
const SERVE = path.dirname(REPO);
const PORT = 8099;
const TYPES = { '.js':'text/javascript', '.mjs':'text/javascript', '.json':'application/json',
                '.glb':'model/gltf-binary', '.fbx':'application/octet-stream', '.html':'text/html' };
const server = http.createServer((req,res)=>{
  const f = path.join(SERVE, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(f,(e,b)=>{ if(e){res.writeHead(404);return res.end('no');}
    res.writeHead(200,{'content-type':TYPES[path.extname(f)]||'application/octet-stream','access-control-allow-origin':'*'});
    res.end(b); }); }).listen(PORT);
const pw = (()=>{ try { return require('playwright'); } catch(_){} return require('/opt/node22/lib/node_modules/playwright'); })();
const BASE = '/' + path.basename(REPO);

(async () => {
  const browser = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('PAGE ERROR', e.message));
  await page.goto(`http://127.0.0.1:${PORT}${BASE}/v2.3/index.html?test=1&cast=2d`, { waitUntil:'domcontentloaded' });
  const files = (process.argv[2] || 'attack_1,sword_heavy,dual_attack_1,idle_relaxed,death').split(',');
  console.log('clip'.padEnd(18) + 'trunk°   yaw°   note');
  for (const file of files) {
    const out = await page.evaluate(async ({ file, BASE }) => {
      const THREE = await import(BASE + '/v2.3/lib/three.module.min.js');
      const { FBXLoader } = await import(BASE + '/v2.3/tools/lib/FBXLoader.js');
      const root = await new FBXLoader().loadAsync(BASE + '/import/' + file + '.fbx');
      const clip = (root.animations || [])[0];
      if (!clip) return { file, err: 'no clip' };
      const B = {};
      root.traverse(o => { if (o.isBone) B[o.name] = o; });
      const pick = (re) => Object.keys(B).find(n => re.test(n));
      const pelvis = B[pick(/(^|:)pelvis$/i)], head = B[pick(/(^|:)head$/i)];
      const lsh = B[pick(/clavicle_l$/i)], rsh = B[pick(/clavicle_r$/i)];
      if (!pelvis || !head) return { file, err: 'no pelvis/head' };
      const wp = (o) => o.getWorldPosition(new THREE.Vector3());
      root.updateMatrixWorld(true);
      // WHICH WAY IS UP IN THIS FILE, read from the bind pose rather than
      // assumed: whichever axis carries the pelvis-to-head rise.
      const b0 = wp(pelvis), b1 = wp(head);
      const rise = b1.clone().sub(b0);
      const up = Math.abs(rise.z) > Math.abs(rise.y) ? new THREE.Vector3(0,0,1) : new THREE.Vector3(0,1,0);
      const mixer = new THREE.AnimationMixer(root);
      const a = mixer.clipAction(clip); a.play();
      let trunk = 0, yaw = 0;
      const sh0 = lsh && rsh ? wp(rsh).sub(wp(lsh)).normalize() : null;
      for (let i = 0; i <= 30; i++) {
        a.time = clip.duration * (i / 30); mixer.update(0); root.updateMatrixWorld(true);
        const v = wp(head).sub(wp(pelvis)).normalize();
        trunk = Math.max(trunk, Math.acos(Math.max(-1, Math.min(1, v.dot(up)))) * 180 / Math.PI);
        if (sh0) {
          const s = wp(rsh).sub(wp(lsh)).normalize();
          yaw = Math.max(yaw, Math.acos(Math.max(-1, Math.min(1, s.dot(sh0)))) * 180 / Math.PI);
        }
      }
      return { file, trunk: +trunk.toFixed(0), yaw: +yaw.toFixed(0), upIsZ: up.z === 1 };
    }, { file, BASE });
    if (out.err) { console.log(out.file.padEnd(18) + out.err); continue; }
    console.log(out.file.padEnd(18) + String(out.trunk).padStart(5) + String(out.yaw).padStart(7)
      + '   source up is ' + (out.upIsZ ? 'Z' : 'Y'));
  }
  await browser.close(); server.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
