'use strict';
const { boot } = require('./harness.cjs');
(async () => {
  const t = await boot({ flow: 0 });
  const out = await t.J(async () => {
    const res = await fetch('audio/combat-theme.mp3?v=1');
    const buf = await res.arrayBuffer();
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const audio = await ac.decodeAudioData(buf.slice(0));
    const sr = audio.sampleRate, ch = audio.getChannelData(0);
    const hop = Math.floor(sr * 0.01161), frames = Math.floor(ch.length / hop);
    const env = new Float32Array(frames); let prev = 0;
    for (let f = 0; f < frames; f++) { let e = 0; const s = f*hop; for (let i=0;i<hop;i++){const x=ch[s+i]||0;e+=x*x;} e=Math.sqrt(e/hop); env[f]=Math.max(0,e-prev); prev=e; }
    const fps = sr/hop, beat = 0.5;           // 120 BPM
    // find phase offset (0..beat) that lands the grid on the most onset energy
    let bestPh=0,bestScore=-1;
    for (let ph=0; ph<beat; ph+=0.005) {
      let score=0; for (let bt=ph; bt<audio.duration; bt+=beat){ const fi=Math.round(bt*fps); if(fi<frames) score+=env[fi]; }
      if(score>bestScore){bestScore=score;bestPh=ph;}
    }
    return { offset: bestPh.toFixed(3), fps: fps.toFixed(2) };
  });
  console.log('best beat offset (s):', out.offset, '· fps', out.fps);
  await t.browser.close(); process.exit(0);
})();
