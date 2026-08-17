// Best-effort BPM detection: decode the combat theme in the harness browser and
// autocorrelate an onset-energy envelope to find the dominant tempo (90–160).
'use strict';
const { boot } = require('./harness.cjs');
(async () => {
  const t = await boot({ flow: 0 });
  const out = await t.J(async () => {
    const res = await fetch('audio/combat-theme.mp3?v=1');
    const buf = await res.arrayBuffer();
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const audio = await ac.decodeAudioData(buf.slice(0));
    const sr = audio.sampleRate;
    const ch = audio.getChannelData(0);
    // onset envelope: energy per ~11.6ms frame, then positive flux
    const hop = Math.floor(sr * 0.01161);
    const frames = Math.floor(ch.length / hop);
    const env = new Float32Array(frames);
    let prev = 0;
    for (let f = 0; f < frames; f++) {
      let e = 0; const s = f * hop;
      for (let i = 0; i < hop; i++) { const x = ch[s + i] || 0; e += x * x; }
      e = Math.sqrt(e / hop);
      env[f] = Math.max(0, e - prev); prev = e;
    }
    // autocorrelate the flux for lags in the 90..160 BPM band
    const fps = sr / hop;   // frames per second
    const best = [];
    for (let bpm = 80; bpm <= 170; bpm += 0.5) {
      const lag = Math.round((60 / bpm) * fps);
      let sum = 0, n = 0;
      for (let i = 0; i + lag < frames; i++) { sum += env[i] * env[i + lag]; n++; }
      best.push([bpm, sum / (n || 1)]);
    }
    best.sort((a, b) => b[1] - a[1]);
    return { dur: audio.duration.toFixed(1), sr, top: best.slice(0, 6).map(([b, s]) => b + '(' + s.toExponential(2) + ')') };
  });
  console.log('duration', out.dur, 's · sampleRate', out.sr);
  console.log('BPM candidates (strongest first):', out.top.join('  '));
  await t.browser.close(); process.exit(0);
})();
