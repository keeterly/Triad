'use strict';
// What is the floor of the _cover measurement? If 73 pixels survive a finished
// burn, either something in the body is not burning, or something that is not
// the body is being counted.
const { boot } = require('./harness.cjs');
(async () => {
  const { page, J, browser } = await boot({ query: 'cast=3d' });
  page.on('pageerror', e => console.log('!! PAGE ERROR:', e.message));
  await page.waitForFunction(() => window.Cast3D && window.Cast3D._state().ready, null, { timeout: 60000 });
  await J(() => window.Cast3D.warm());
  const out = await J(() => {
    const C3 = window.Cast3D, f = C3._figure('foe0');
    const u = f.root.userData.mat.userData;
    f.dead = false; f.burn = null; f.mixer.timeScale = 0;
    const r = {};
    u.burn.value = 0;   r.whole = C3._cover('foe0');
    u.burn.value = 1;   r.burnt = C3._cover('foe0');
    u.burn.value = 1.6; r.past = C3._cover('foe0');
    // and the true floor: nothing of this body drawn at all
    const keep = [];
    f.root.traverse(o => { if (o.isMesh || o.isSkinnedMesh) { keep.push([o, o.visible]); o.visible = false; } });
    r.nothing = C3._cover('foe0');
    for (const [o, v] of keep) o.visible = v;
    // how many meshes does this body actually have, and do they share a material?
    const mats = new Set();
    let meshes = 0;
    f.root.traverse(o => { if (o.isMesh || o.isSkinnedMesh) { meshes++; mats.add(o.material.uuid); } });
    r.meshes = meshes; r.materials = mats.size;
    r.sameAsRoot = mats.has(f.root.userData.mat.uuid);
    u.burn.value = 0; f.mixer.timeScale = 1;
    return r;
  });
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
