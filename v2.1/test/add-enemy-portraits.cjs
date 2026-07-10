'use strict';
// Add missing enemy portraits (revenant / brood / cantor) to portraits.js, in the
// existing dark-fantasy SVG style. Idempotent: skips a key that already exists.
const fs = require('fs');
const path = require('path');
const F = path.join(__dirname, '..', 'portraits.js');
let s = fs.readFileSync(F, 'utf8');

const ART = {
  revenant: `
<svg viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <defs>
    <radialGradient id="rev-body" cx="50%" cy="42%" r="62%">
      <stop offset="0" stop-color="#b49ce8" stop-opacity="0.85"/>
      <stop offset="0.55" stop-color="#5a3f8a" stop-opacity="0.5"/>
      <stop offset="1" stop-color="#160a28" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <ellipse cx="50" cy="66" rx="34" ry="46" fill="url(#rev-body)"/>
  <path d="M20 130 L16 66 Q50 52 84 66 L80 130 Z" fill="#2a2440" stroke="#0c0820" stroke-width="0.6"/>
  <path d="M24 130 L21 70 Q50 58 79 70 L76 130 Z" fill="#3a3160" opacity="0.35"/>
  <ellipse cx="50" cy="60" rx="15" ry="16" fill="#191330"/>
  <ellipse cx="50" cy="60" rx="15" ry="16" fill="none" stroke="#7c5ad0" stroke-width="0.5" opacity="0.5"/>
  <rect x="39" y="57" width="22" height="3" fill="#2a2050"/>
  <rect x="43" y="57.5" width="5" height="2" fill="#c4a6ff"/>
  <rect x="54" y="57.5" width="5" height="2" fill="#c4a6ff"/>
  <path d="M44 46 L50 37 L56 46 Z" fill="#6a3a8a"/>
  <rect x="77" y="74" width="3" height="30" fill="#8a82a2"/>
  <path d="M78.5 74 L82 60 L79 68 L83 58" stroke="#b0a0d8" stroke-width="1" fill="none" opacity="0.8"/>
  <rect x="75" y="72" width="7" height="3" fill="#3a2a4a"/>
  <path d="M40 88 L40 120 M50 90 L50 124 M60 88 L60 120" stroke="#0c0820" stroke-width="0.6"/>
  <ellipse cx="50" cy="60" rx="22" ry="24" fill="none" stroke="#7c5ad0" stroke-width="0.3" opacity="0.3"/>
</svg>`,
  brood: `
<svg viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <defs>
    <radialGradient id="brood-bg" cx="50%" cy="55%" r="60%">
      <stop offset="0" stop-color="#3a2a1a"/><stop offset="1" stop-color="#0a0604" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <ellipse cx="50" cy="82" rx="34" ry="30" fill="url(#brood-bg)"/>
  <path d="M26 112 Q22 84 34 74 Q42 66 50 70 Q58 66 66 74 Q78 84 74 112 Q62 118 50 116 Q38 118 26 112 Z" fill="#1a120c" stroke="#080402" stroke-width="0.6"/>
  <path d="M30 108 Q28 88 38 80 Q50 74 62 80 Q72 88 70 108" fill="#2a1c12" opacity="0.7"/>
  <circle cx="40" cy="84" r="2" fill="#d86a2a"/><circle cx="40" cy="84" r="0.8" fill="#150a04"/>
  <circle cx="52" cy="80" r="2.2" fill="#e87a2a"/><circle cx="52" cy="80" r="0.9" fill="#150a04"/>
  <circle cx="61" cy="86" r="1.8" fill="#d86a2a"/><circle cx="61" cy="86" r="0.7" fill="#150a04"/>
  <circle cx="46" cy="92" r="1.6" fill="#c85a22"/><circle cx="46" cy="92" r="0.6" fill="#150a04"/>
  <circle cx="57" cy="94" r="1.5" fill="#c85a22"/>
  <path d="M40 100 L42 104 L44 100 L46 104 L48 100 L50 104 L52 100 L54 104 L56 100 L58 104 L60 100" fill="none" stroke="#e8d0a0" stroke-width="0.8"/>
  <path d="M28 100 L18 96 M30 106 L20 108 M72 100 L82 96 M70 106 L80 108" stroke="#2a1c12" stroke-width="1.2" fill="none"/>
  <path d="M34 114 L30 124 M50 116 L50 126 M66 114 L70 124" stroke="#1a120c" stroke-width="1.4" fill="none"/>
</svg>`,
  cantor: `
<svg viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <defs>
    <radialGradient id="cantor-halo" cx="50%" cy="40%" r="55%">
      <stop offset="0" stop-color="#e8e0c0" stop-opacity="0.5"/><stop offset="1" stop-color="#e8e0c0" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <ellipse cx="50" cy="58" rx="30" ry="34" fill="url(#cantor-halo)"/>
  <path d="M28 130 L26 74 Q50 62 74 74 L72 130 Z" fill="#201a26" stroke="#0a0710" stroke-width="0.6"/>
  <path d="M42 78 Q50 74 58 78 L56 128 Q50 130 44 128 Z" fill="#e8e0c0" opacity="0.18"/>
  <path d="M34 62 Q50 38 66 62 L64 84 L36 84 Z" fill="#2a2432"/>
  <ellipse cx="50" cy="66" rx="11" ry="13" fill="#0a0710"/>
  <ellipse cx="50" cy="70" rx="3.5" ry="6" fill="#c8b8e0" opacity="0.7"/>
  <ellipse cx="45" cy="60" rx="1.4" ry="2" fill="#f0e8c0"/>
  <ellipse cx="55" cy="60" rx="1.4" ry="2" fill="#f0e8c0"/>
  <path d="M20 66 Q16 58 20 50" stroke="#c8b090" stroke-width="0.6" fill="none" opacity="0.5"/>
  <path d="M15 70 Q9 58 15 46" stroke="#a89070" stroke-width="0.5" fill="none" opacity="0.35"/>
  <path d="M80 66 Q84 58 80 50" stroke="#c8b090" stroke-width="0.6" fill="none" opacity="0.5"/>
  <path d="M85 70 Q91 58 85 46" stroke="#a89070" stroke-width="0.5" fill="none" opacity="0.35"/>
</svg>`,
};

const marker = '\n};';
const idx = s.lastIndexOf(marker);
if (idx < 0) throw new Error('could not find end of V2PORTRAITS');
let add = '';
for (const [k, svg] of Object.entries(ART)) {
  if (new RegExp('"' + k + '":').test(s)) { console.log('skip (exists):', k); continue; }
  add += '  ' + JSON.stringify(k) + ': ' + JSON.stringify(svg) + ',\n';
}
if (add) s = s.slice(0, idx) + ',\n' + add.replace(/,\n$/, '') + s.slice(idx);   // comma joins to the prior entry
fs.writeFileSync(F, s);
console.log('added portraits:', Object.keys(ART).join(', '));
