# Boon Combos — coverage & backlog

Reference for the Hades-style party-composition boons (DUO = both fielded,
TRIO = the exact three). Combos live in the `BOONS` array in `game.js`; adding
one is a single data entry (see existing duo/trio boons for the shape). The
Journal (title menu / in-run ☰) shows them with fog-of-war until collected.

## DUO coverage — 10 / 15 pairs done

| Pair | Boon | Status |
|---|---|---|
| Ash + Elin | Second Breath (heal → ▲ rally) | ✅ |
| Ash + Mira | Twin Shadows' Edge (+3 vs EXPOSED) | ✅ |
| Ash + Cassia | Vanguard's Oath (follow-up → ⛨2) | ✅ |
| Ash + Branwen | — | ⬜ TODO |
| Ash + Hask | — | ⬜ TODO |
| Elin + Mira | — | ⬜ TODO |
| Elin + Cassia | Sanctified Wall (turn-start ⛨2 + ✚2) | ✅ |
| Elin + Branwen | — | ⬜ TODO |
| Elin + Hask | Warmth in Winter (heal → ◆ charge) | ✅ |
| Mira + Cassia | — | ⬜ TODO |
| Mira + Branwen | Killer's Pact (first EXPOSED kill → 2 EP) | ✅ |
| Mira + Hask | Killing Frost (+2 vs CHILLED) | ✅ |
| Cassia + Branwen | Overwatch (Branwen +3 while Cassia guards) | ✅ |
| Cassia + Hask | Frostwall (CHILLED foes +2 from all) | ✅ |
| Branwen + Hask | Frost & Feather (CHILLED counts as EXPOSED) | ✅ |

### Remaining 5 pairs — effect sketches (unbuilt)
- **Ash + Branwen** — "Skirmish Line": Ash's melee follow-up on a foe Branwen
  marked deals +3 (melee cashes the mark). *trigger: dmgMod, gated on tgt.mark + ash.*
- **Ash + Hask** — "Flashfreeze": when Ash repositions (enterRow), the row he
  left is CHILLED / nearest foe chilled — tempo feeds the frost.
- **Elin + Mira** — "Mercy's Blade": the first EXPOSED foe Mira kills each turn
  heals the most-wounded ally 3 (the kill mends the line).
- **Elin + Branwen** — "Guiding Light": at turn start, the nearest foe is
  EXPOSED 1 AND the most-wounded ally heals 1 (mark + mend).
- **Mira + Cassia** — "Shield & Dagger": while Cassia holds guard, Mira's
  strikes also EXPOSE +1 (the wall creates the opening).

## TRIO coverage — 4 built

| Trio | Boon | Status |
|---|---|---|
| Ash · Cassia · Elin | The Phalanx Vow (open ⛨3 + ▲2) | ✅ |
| Ash · Mira · Branwen | The Killing Wind (+4 vs EXPOSED) | ✅ |
| Elin · Cassia · Hask | The Long Winter (+3 vs CHILLED) | ✅ |
| Elin · Mira · Branwen | Blood & Mercy (EXPOSED kill heals party 3) | ✅ |

### Trio ideas (unbuilt)
- **Ash · Cassia · Hask** — "Ember & Iron": front-line + caster — the party's
  first strike each turn is empowered behind the wall.
- **Mira · Branwen · Hask** — "The Cold Hunt": CHILLED **and** EXPOSED foes take
  a big bonus (stacks the two setups).
- **Ash · Elin · Mira** — "Dance of Threads": follow-ups also heal the follower
  (tempo + mend + assassin).
- A "full six seen" / meta unlock could reward discovering every combo.

## Notes
- Balance: combos are conditional (need the comp), so they can run a little hot
  (+2/+3 to a status, a small heal/charge/guard). Keep single-target dmgMods
  in the +2..+4 band; party-wide effects toward the low end.
- The `incoming` hook (risk boons) and `boonStack` (scaling boons) engine paths
  are in place if a combo wants those patterns.
