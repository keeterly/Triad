'use strict';
// Strip the pure-FLAVOR tail (" — then build the duel." etc.) from CARD descs —
// rotation cards (stance:) and classic core/sig cards.  Leaves the mechanics.
// Safe by construction:
//  · only touches lines with stance: / core: { / sig: {  (never EMBER_TREE nodes)
//  · a tail is stripped only if it holds NO digit, NO <span>, NO ' (i.e. pure
//    prose) — so "flavor — 8 damage" (effect after the dash) is left intact
//  · TAUNT lines skipped (Provoke's tail explains a keyword, not flavor)
const fs = require('fs');
const path = require('path');
const F = path.join(__dirname, '..', 'game.js');
let src = fs.readFileSync(F, 'utf8');
const lines = src.split('\n');
let n = 0;
const RE = / — [^'<0-9]*?\.'/;   // ' — <pure prose>.'  → close the desc after the effect
for (let i = 0; i < lines.length; i++) {
  const L = lines[i];
  if (!/stance:|core:\s*\{|sig:\s*\{/.test(L)) continue;
  if (/TAUNT/.test(L)) continue;
  if (RE.test(L)) { lines[i] = L.replace(RE, ".'"); n++; }
}
fs.writeFileSync(F, lines.join('\n'));
console.log('stripped flavor from', n, 'card descs');
