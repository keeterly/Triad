'use strict';
const fs = require('fs');
const path = require('path');
const F = path.join(__dirname, '..', 'portraits.js');
let s = fs.readFileSync(F, 'utf8');
function imgVal(png) {
  return '"\\n<svg viewBox=\\"0 0 100 130\\" xmlns=\\"http://www.w3.org/2000/svg\\" xmlns:xlink=\\"http://www.w3.org/1999/xlink\\" preserveAspectRatio=\\"xMidYMid meet\\">\\n  <image href=\\"../art/' + png + '.png\\" xlink:href=\\"../art/' + png + '.png\\" x=\\"0\\" y=\\"0\\" width=\\"100\\" height=\\"130\\" preserveAspectRatio=\\"xMidYMid slice\\"/>\\n</svg>"';
}
function setPortrait(src, key, png) {
  const k = '"' + key + '":';
  const i = src.indexOf(k); if (i < 0) throw new Error('no ' + key);
  const vStart = src.indexOf('"', i + k.length);
  const vEnd = src.indexOf('</svg>",', vStart);
  if (vEnd < 0) throw new Error('no end for ' + key);
  const end = vEnd + '</svg>"'.length;
  return src.slice(0, vStart) + imgVal(png) + src.slice(end);
}
s = setPortrait(s, 'ash', 'kai');    // Ash now wears Kai's (v1) art
s = setPortrait(s, 'hask', 'ash');   // Hask now wears Ash's current art
fs.writeFileSync(F, s);
console.log('swapped: ash→kai.png, hask→ash.png');
