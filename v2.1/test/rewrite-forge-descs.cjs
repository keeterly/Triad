'use strict';
// Rewrite forged-card descriptions (emergent forges + stagger finishers) into
// mechanics-first, keyword-reinforced text.  Drops "Free." (the ✦ pill shows it)
// and surfaces the loop keywords: ◎ EXPOSED, ×2 vs STAGGERED, ⛨ guard.
const fs = require('fs');
const path = require('path');
const F = path.join(__dirname, '..', 'game.js');
let src = fs.readFileSync(F, 'utf8');

const E = '<span class="kw kw-exposed">';
const G = '<span class="kw kw-guard">';
const S = '</span>';

const M = [
  // emergent forges
  ['<b>Free.</b> The rhythm carries the blade — <b>7 damage</b> to any foe. Landed on the beat.',
   '<b>7 damage</b> to any foe.'],
  ['<b>Free.</b> The opening is hers — <b>12 damage</b> to any foe. An EXPOSED target has nowhere to hide.',
   '<b>12 damage</b> to any foe.'],
  ['<b>Free.</b> The shield becomes the blow — <b>9 damage</b> to any foe. Every wall she raises is a blade held back.',
   '<b>9 damage</b> to any foe.'],
  ['<b>Free.</b> The counted shot lands — <b>9 damage</b> and <span class="kw kw-exposed">◎ EXPOSED 2</span> to any foe.',
   `<b>9 damage</b> · ${E}◎ EXPOSED 2${S} to any foe.`],
  ['<b>Free.</b> A whirl of steel — <b>6 damage</b> and <span class="kw kw-exposed">◎ EXPOSED 1</span> to any foe.',
   `<b>6 damage</b> · ${E}◎ EXPOSED 1${S} to any foe.`],
  ['<b>Free.</b> A shaft through the gap — <b>10 damage</b> to any foe.',
   '<b>10 damage</b> to any foe.'],
  ['<b>Free.</b> Loose the whole wall in one strike — <b>damage equal to your current</b> <span class="kw kw-guard">⛨ guard</span>, then it shatters. Stack it high, then unleash.',
   `Unleash <b>ALL your ${G}⛨ guard${S}</b> as one hit, then it shatters.`],
  ['<b>Free.</b> Mercy, reversed — <b>8 holy damage</b> to any foe. The mender bares her light.',
   '<b>8 holy damage</b> to any foe.'],
  // stagger finishers — reinforce the ×2 STAGGER payoff
  ['<b>Free.</b> The break leaves them open — <b>10 damage</b>, doubled against a STAGGERED foe.',
   '<b>10 damage</b> · <b>×2 vs STAGGERED</b>.'],
  ['<b>Free.</b> A ray through the break — <b>8 holy damage</b>, doubled vs a STAGGERED foe.',
   '<b>8 holy</b> · <b>×2 vs STAGGERED</b>.'],
  ['<b>Free.</b> A whirl of blades — <b>7 damage</b> (doubled vs STAGGERED) and <span class="kw kw-exposed">◎ EXPOSED 4</span>.',
   `<b>7 damage</b> · ${E}◎ EXPOSED 4${S} · <b>×2 vs STAGGERED</b>.`],
  ['<b>Free.</b> The shield-edge crashes down — <b>8 damage</b> (doubled vs STAGGERED), and Cassia gains <span class="kw kw-guard">⛨ 5</span>.',
   `<b>8 damage</b> · <b>×2 vs STAGGERED</b> · gain ${G}⛨5${S}.`],
  ['<b>Free.</b> A called shot through the break — <b>10 damage</b>, doubled vs a STAGGERED foe.',
   '<b>10 damage</b> · <b>×2 vs STAGGERED</b>.'],
];

let n = 0, miss = [];
for (const [oldD, newD] of M) {
  if (src.indexOf(oldD) < 0) { miss.push(newD); continue; }
  src = src.split(oldD).join(newD); n++;
}
fs.writeFileSync(F, src);
console.log('rewrote', n, 'forge/stagger descs;', miss.length ? 'MISSED: ' + miss.join(' | ') : 'none missed');
