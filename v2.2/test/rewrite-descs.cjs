'use strict';
// One-time rewrite of every EMBER_TREE node's top-level `desc` into the
// "TRIGGER: effect — flavor" grammar (symbols + keywords, dim flavor).
const fs = require('fs');
const path = require('path');
const F = path.join(__dirname, '..', 'game.js');

const KG = '<span class="kw kw-guard">';
const KH = '<span class="kw kw-heal">';
const KE = '<span class="kw kw-exposed">';
const KR = '<span class="kw kw-rally">';
const KC = '<span class="kw kw-counter">';
const S = '</span>';
const g = (t) => KG + t + S, h = (t) => KH + t + S, e = (t) => KE + t + S, r = (t) => KR + t + S, c = (t) => KC + t + S;

const D = {
  // ── ASH ──
  'ash.sig.front': `COMBO · FRONT: inserts <b>Rising Slash</b> (8 dmg) · Cleave → <b>Rising Slash</b> → Crashing Wave`,
  'ash.sig.back': `COMBO · BACK: inserts <b>Deeper Cut</b> (5 dmg) · Thrown Edge → <b>Deeper Cut</b> → Follow Cut`,
  'ash.sig.mid': `COMBO · MID: inserts <b>Parry Step</b> (${g('⛨5')} · ${c('↺1')}) · Flowing Cut → <b>Parry Step</b> → Riposte`,
  'ash.rider.expose': `UPGRADE: Thrown Edge also inflicts ${e('◎ EXPOSED 2')} — position becomes a debuff`,
  'ash.passive.vanguard': `ON MOVE: closing to FRONT grants ${g('⛨3')} — repositioning becomes defense`,
  'ash.allout.execution': `ALL-OUT: every strike EXECUTES a foe under <b>25% HP</b> — no wounded walk away`,
  'ash.emergent.tempo': `EVERY 3RD HIT: forge a free <b>Follow Cut</b> (7 dmg) — momentum becomes a card`,
  'ash.passive.relentless': `PASSIVE: your 1st ${r('FOLLOW-UP')} each turn refunds <b>1 EP</b> — the duel never lets up`,
  'ash.synergy.warcry': `ON FOLLOW-UP: the ally you followed gains ${r('▲ RALLY +2')} — the hunt feeds the pack`,
  'ash.passive.exploit': `PASSIVE: <b>+3 dmg</b> to any ${e('◎ EXPOSED')} foe — your marks are yours to cash`,
  'ash.branch.front': `FORK · FRONT: Cleave also opens <b>Sunder</b> (5 dmg · ${e('◎2')}) → <b>Marked Fate</b> (${e('◎4')}) — the cut or the mark`,
  'ash.branch.mid': `FORK · MID: Flowing Cut also opens <b>Flow Read</b> (slip FRONT · ${r('▲+3')}) → <b>Crossguard</b> (${g('⛨6')} ally)`,
  'ash.branch.back': `FORK · BACK: Thrown Edge also opens <b>Hunter’s Read</b> (${e('◎2')}) → <b>Marked Fate</b> (${e('◎4')})`,
  'ash.exec': `ON STAGGER: forge a free <b>Coup de Grâce</b> — 10 dmg, <b>doubled</b> vs staggered`,
  'ash.afterimage': `ON REPOSITION: the stance you left <b>strikes again</b> (free echo, −2 dmg, this turn) — a move OR a slip counts`,

  // ── ELIN ──
  'elin.sig.front': `COMBO · FRONT: inserts <b>Searing</b> (7 holy) · Smite → <b>Searing</b> → Radiant Ward`,
  'elin.sig.mid': `COMBO · MID: inserts <b>Sanctuary</b> (${h('✚4')} · ${g('⛨4')}) · Mend → <b>Sanctuary</b> → Renew`,
  'elin.sig.back': `COMBO · BACK: inserts <b>Blessing</b> (${h('✚3')} · ${r('▲+2')}) · Distant Prayer → <b>Blessing</b> → Benediction`,
  'elin.passive.ward': `TURN START: your most-wounded ally gains ${g('⛨2')} — the light finds the hurt`,
  'elin.rider.radiance': `UPGRADE: Radiant Ward also heals EVERY ally ${h('✚2')}`,
  'elin.passive.overflow': `PASSIVE: heal OVERFLOW spills as ${g('⛨ guard')} to the WHOLE party — not just the target`,
  'elin.synergy.blessing': `ON HEAL / WARD: that ally’s next strike deals ${r('▲ +2')} — her light sharpens their blade`,
  'elin.rider.sanctuary': `UPGRADE: Sanctuary also grants the ally ${c('↺1')} — the ward bites back`,
  'elin.inverse': `EVERY 2ND HEAL: forge a free <b>Inverse Light</b> (8 holy dmg) — mending, weaponised`,
  'elin.branch.front': `FORK · FRONT: Smite also opens <b>Raise Ward</b> (party ${g('⛨2')}) → <b>Consecrate</b> (6 holy) — damage or the ward`,
  'elin.branch.mid': `FORK · MID: Mend also opens <b>Cleanse</b> (${h('✚')} · ${g('⛨')}) → <b>Warding Circle</b> (party ${g('⛨3')})`,
  'elin.branch.back': `FORK · BACK: Distant Prayer also opens <b>Deep Mercy</b> (${h('✚8')}) → <b>Dawnlight</b> (party ${h('✚5')})`,
  'elin.exec': `ON STAGGER: forge a free <b>Mercy’s End</b> (8 holy, doubled vs staggered) & the party heals ${h('✚3')} — she mends as she ends`,
  'elin.afterimage': `ON REPOSITION: the stance she left <b>strikes again</b> (free echo, −2 dmg, this turn)`,
  'elin.allout.dawn': `ALL-OUT END: the whole party heals ${h('✚5')} & gains ${g('⛨3')} — dawn after the storm`,

  // ── MIRA ──
  'mira.sig.front': `COMBO · FRONT: inserts <b>Twin Cut</b> (6 dmg) · Backstab → <b>Twin Cut</b> → Vanish Strike`,
  'mira.sig.mid': `COMBO · MID: inserts <b>Serrate</b> (4 dmg · ${e('◎+1')}) · Shadow Knife → <b>Serrate</b> → Twin Daggers`,
  'mira.sig.back': `COMBO · BACK: inserts <b>Quick Throw</b> (4 dmg) · Thrown Dagger → <b>Quick Throw</b> → Execute`,
  'mira.rider.exploit': `UPGRADE: Backstab also inflicts ${e('◎ EXPOSED 2')}`,
  'mira.emergent.bloodscent': `EVERY 2ND EXPOSE: forge a free <b>Execute</b> (12 dmg) — the mark becomes a kill`,
  'mira.passive.opportunist': `PASSIVE: <b>+3 dmg</b> to any ${e('◎ EXPOSED')} foe — never waste an opening`,
  'mira.rider.twin': `UPGRADE: Twin Daggers also inflicts ${e('◎ EXPOSED 3')}`,
  'mira.passive.deathmark': `PASSIVE: striking a foe at/under <b>30% HP</b> EXECUTES it — the wounded don’t walk away`,
  'mira.synergy.marked': `PASSIVE: ${e('◎ EXPOSED')} foes take <b>+2</b> from EVERY ally — your openings are the party’s`,
  'mira.emergent.flurry': `EVERY 3RD HIT: forge a free <b>Flurry</b> (6 dmg · ${e('◎1')}) — the daggers keep coming`,
  'mira.passive.frenzy': `ON EXPOSED HIT: your NEXT strike deals ${r('▲ +2')} — the kill feeds the next`,
  'mira.branch.front': `FORK · FRONT: Backstab also opens <b>Shadowstep</b> (${e('◎2')} · slip) → <b>Killing Mark</b> (${e('◎5')})`,
  'mira.branch.mid': `FORK · MID: Shadow Knife also opens <b>Feint</b> (${r('▲+3')}) → <b>Bloodletting</b> (8 dmg · ${e('◎2')})`,
  'mira.branch.back': `FORK · BACK: Thrown Dagger also opens <b>Mark</b> (${e('◎3')}) → <b>Killing Mark</b> (${e('◎5')})`,
  'mira.exec': `ON STAGGER: forge a free <b>Death Blossom</b> (7 dmg · ${e('◎4')}, doubled vs staggered) — paints the kill`,
  'mira.afterimage': `ON REPOSITION: the stance she left <b>strikes again</b> (free echo, −2 dmg, this turn) — her slips & vanishes count`,
  'mira.allout.dance': `ALL-OUT END: every surviving foe is left ${e('◎ EXPOSED 5')} — marked for the kill-flow`,

  // ── CASSIA ──
  'cassia.sig.front': `COMBO · FRONT: inserts <b>Brace</b> (${g('⛨4')}) · Shield Bash → <b>Brace</b> → Bulwark`,
  'cassia.sig.mid': `COMBO · MID: inserts <b>Reinforce</b> (ally ${g('⛨3')}) · Cover → <b>Reinforce</b> → Aegis`,
  'cassia.sig.back': `COMBO · BACK: inserts <b>Weighted Shield</b> (3 dmg) · Thrown Shield → <b>Weighted Shield</b> → Sentinel Throw`,
  'cassia.emergent.bulwark': `EVERY 2ND GUARD: forge a free <b>Bulwark Break</b> (9 dmg) — the wall answers back`,
  'cassia.passive.vigil': `TURN START: Cassia braces for ${g('⛨2')} — never caught flat`,
  'cassia.rider.aegis': `UPGRADE: Aegis also grants the ally ${c('↺1')} — the ward bites back`,
  'cassia.allout.fortress': `ALL-OUT START: the whole party gains ${g('⛨5')} — brace before the storm`,
  'cassia.passive.immovable': `PASSIVE: Cassia’s ${g('⛨ guard')} no longer fades at turn’s end — the wall only grows`,
  'cassia.synergy.soak': `PASSIVE: allies in rows BEHIND Cassia take <b>−2</b> from every blow — she covers the line`,
  'cassia.nova': `EVERY 3RD GUARD: forge a free <b>Aegis Nova</b> — hurl ALL your ${g('⛨ guard')} as one hit, then it shatters`,
  'cassia.branch.front': `FORK · FRONT: Shield Bash also opens <b>Provoke</b> (${g('⛨2')} · ${c('↺2')} · TAUNT) → <b>Iron Answer</b> (9 dmg)`,
  'cassia.branch.mid': `FORK · MID: Cover also opens <b>Warded</b> (${g('⛨')} · ${c('↺1')}) → <b>Sentinel Volley</b> (8 dmg)`,
  'cassia.branch.back': `FORK · BACK: Thrown Shield also opens <b>Rampart</b> (${g('⛨4')}) → <b>Sentinel Volley</b> (8 dmg)`,
  'cassia.exec': `ON STAGGER: forge a free <b>Bulwark Break</b> (8 dmg, doubled vs staggered) & Cassia gains ${g('⛨5')} — the wall punishes & hardens`,
  'cassia.afterimage': `ON REPOSITION: the stance she left <b>strikes again</b> (free echo, −2 dmg, this turn)`,

  // ── BRANWEN ──
  'branwen.sig.front': `COMBO · FRONT: inserts <b>Snap Shot</b> (5 dmg) · Backstep Shot → <b>Snap Shot</b> → Hail`,
  'branwen.sig.mid': `COMBO · MID: inserts <b>Steady Aim</b> (${r('▲+3')} next shot) · Aimed Shot → <b>Steady Aim</b> → Killshot`,
  'branwen.sig.back': `COMBO · BACK: inserts <b>Deeper Mark</b> (${e('◎+2')}) · Marking Arrow → <b>Deeper Mark</b> → Killing Arrow`,
  'branwen.rider.deadeye': `UPGRADE: Backstep Shot also inflicts ${e('◎ EXPOSED 2')}`,
  'branwen.emergent.tally': `EVERY 2ND EXPOSE: forge a free <b>Killing Arrow</b> (9 dmg · ${e('◎2')}) — the tally comes due`,
  'branwen.passive.focus': `PASSIVE: <b>+2 dmg</b> to any ${e('◎ EXPOSED')} foe`,
  'branwen.passive.opening': `TURN START: EXPOSE the nearest foe ${e('◎1')} — the hunt is always on`,
  'branwen.passive.reckoning': `ON EXPOSED KILL: your 1st kill each turn refunds <b>1 EP</b> — the tally always comes due`,
  'branwen.synergy.cadence': `TURN START: if any foe is ${e('◎ EXPOSED')}, the WHOLE party gains ${r('▲ RALLY +1')}`,
  'branwen.emergent.pierce': `EVERY 3RD HIT: forge a free <b>Piercing Shot</b> (10 dmg) — the aim never wavers`,
  'branwen.passive.killingblow': `PASSIVE: <b>+4 dmg</b> to any foe at/under <b>half HP</b> — the wounded can’t outrun the arrow`,
  'branwen.branch.front': `FORK · FRONT: Backstep Shot also opens <b>Hunter’s Mark</b> (${e('◎4')} · slip) → <b>Marked Fate</b> (${e('◎4')})`,
  'branwen.branch.mid': `FORK · MID: Aimed Shot also opens <b>Called Shot</b> (${e('◎2')}) → <b>Piercing Shot</b> (10 dmg)`,
  'branwen.branch.back': `FORK · BACK: Marking Arrow also opens <b>Rapid Nock</b> (4 dmg) → <b>Volley Shot</b> (6 dmg · ${e('◎2')})`,
  'branwen.exec': `ON STAGGER: forge a free <b>Marksman’s Finish</b> (10 dmg, doubled vs staggered) & refund <b>1 EP</b> — the hunt presses on`,
  'branwen.afterimage': `ON REPOSITION: the stance she left <b>strikes again</b> (free echo, −2 dmg, this turn) — her backstep leaves a parting arrow`,
  'branwen.allout.ruin': `ALL-OUT END: loose a <b>volley</b> on the whole line & refund <b>2 EP</b> — the sky goes dark with arrows`,
};

let src = fs.readFileSync(F, 'utf8');
let done = 0, miss = [];
for (const [id, desc] of Object.entries(D)) {
  if (desc.indexOf("'") >= 0) { console.error('SINGLE QUOTE in', id); process.exit(1); }
  const idIdx = src.indexOf(`id: '${id}'`);
  if (idIdx < 0) { miss.push(id); continue; }
  const re = /desc: '[^']*'/g; re.lastIndex = idIdx;
  const m = re.exec(src);
  if (!m) { miss.push(id + ' (no desc)'); continue; }
  src = src.slice(0, m.index) + `desc: '${desc}'` + src.slice(m.index + m[0].length);
  done++;
}
fs.writeFileSync(F, src);
console.log('rewrote', done, 'descs;', miss.length ? 'MISSED: ' + miss.join(', ') : 'none missed');
