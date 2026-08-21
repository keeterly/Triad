# COMBAT-SPEC — making KIZUNA read like StS2 without losing its body

**Status:** design specification, v2.2 Build 36 era. Written after (a) a source
read of the combat core (`buildHand`, `mkRotCard`/`mkCard`, `playCard`,
`resolveCard`, `enemyPhase`, `checkEnd`, the line engine at
`resolveLinePlay`/`dealBeat`/`chainAtDepth`, the burst block at
`gainMomentum`/`resolveAllOut`), (b) several headless hands-on fights through
the real pointer/eval pipeline (scripts in scratchpad; screenshots
`test/shots/01-t1-open.png` … `e3-enemy-parry.png`, `p2-parry-a.png`,
`p6-allout-intro.png`), and (c) research on Slay the Spire 2's early-access
design (sources and caveats in §2).

**The brief, kept whole:** party of THREE · combo-based combat · team attacks
that develop over the run · "smooth and understandable like StS2" · a JRPG
version of StS2. Nothing below trades any of the first three away; everything
below is in service of the fourth.

---

## 1. What I saw playing it

The good news first, because it is real: the parry cascade is the best screen
in the game (`p2-parry-a.png` — one huge ring, a gesture word, a combo count,
nothing else lit), the telegraph is *honest* (`enemyIntentDmg()` is a single
source of truth feeding both the pill and the resolution — StS's own golden
rule), the diorama is gorgeous, and "the hand is the position" is a genuinely
original core loop that StS2 does not have.

Then the problems, each one observed, not inferred:

**O1 — The face of a card lies about what will land.** Turn 1, trio with woven
bonds, I played Ash's opener (face: 6), then Elin's `Renew` (face: heal 4).
Between the two dumps the HOLLOW HUSK went **56 → 13 HP** — a ~43-damage beat
off a heal card, because the finisher's resolution silently fired the woven
follow cut, the duet perk, the assist bonus, the weakness school and the mark.
The visible cards that turn carried face values totalling ~10.
`resolveCard()` applies at resolve time: weakness ×, `mark +`, ASSIST +2,
DESPERATE +2, duet `dmgMod`, `passiveDmg`, rally — none of which the card face
or any preview shows. StS1/2's discipline is the exact opposite: the number
printed on the card **is** the number that lands, recomputed live with every
modifier (and per-enemy when you aim). We have the honest telegraph for *their*
blows and a dishonest one for *ours*.

**O2 — The game is solved by the break, and the enemy never gets a turn.** I
sent a bot with zero tactics (play anything affordable, frontmost target) into
an ELITE (`ECHO REVENANT`, 135 HP after scaling). Result: **135 → 20 HP on
turn 1**, the revenant BROKE (poise 3 chipped by weakness hits riding the
weave cascades), the break stole its entire multi-attack round
(`e3-enemy-parry.png`: "REMEMBERED END collapses — the break steals its
turn"), and turn 2 killed it. The party ended at full HP having never seen a
single parry ring. `window.__parryLog` after the fight: `{clean: 0, botched:
0}`. The defensive minigame — the game's whole identity — can be skipped by
its own offense. StS2's stated direction is the reverse: "doesn't want you to
be able to hit autopilot," adaptive intents, anti-infinite limiters.

**O3 — Seven team-attack systems wear the same trench coat.** Counted in the
source, all live at once: ① ASSIST (+2 focus fire, forms threads), ② in-line
FOLLOW-UPS (bond-gated answer cards, `FOLLOWUPS`), ③ BOND WEAVE follow
(`offerBondFollow` — a free chain card after any finisher/sig), ④ DUET PERKS
(15 authored passives, `DUET_PERKS`), ⑤ BOND STRIKES (auto cut-ins, once a
fight, `runBondStrike`), ⑥ PRIMED→KIZUNA follow-ups (combo-completion pairs),
⑦ the TRIAD → crowned ALL-OUT → FINALE. Each has its own trigger grammar, its
own once-per-X rule, and its own UI voice. On screen they compress into one
row of icon-only chips in the top bar that — measured against my own eyes —
**read as close buttons** (`01-t1-open.png`: four `✕` glyphs in gold circles;
that is Twin Edge's icon, but nobody will ever know). The owner asked for
"team attacks that develop over time." We have that — five times over — and no
player can tell you which of the five just did the damage in O1.

**O4 — The burst economy is illegible.** `gainMomentum` has **12+ distinct
sources** (raw hit +2, assist +12+combo, perfect parry +18, partial 5–16,
break +18, riposte +7, EP reserve +6/EP, thread/bond acts in raw chunks,
boons…), a hidden 0.6 `MOM_SCALE` on some but not others, thresholds at
100/175/250, and a *container level* (`burstLevel`, grown by duet/triad)
distinct from the *fire level* (`burstFireLevel`, read off momentum). All of
this renders as one thin unnumbered bar in the bottom-left corner. In my
fights momentum went 24 → 66 → 104 → 187 and I could not have told you why at
any step without reading the source.

**O5 — Keyword mass.** Player-facing combat vocabulary counted from the source
and screenshots: EP, guard, counter, rally, EXPOSED, CHILL (twice — hero
`chill` and enemy `lull` are different mechanics sharing one name and one ❄),
CHARGE, PYRE/FROST, HEX, SEVER, WOUND, POISE, BROKEN, WEAKENED, TECHNICAL,
DESPERATE, ASSIST, MOMENTUM, BURST (L1/RESONANT/TRANSCENDENT), RESERVE,
OPENER/COMBO/FINISHER, LINE, FOCUS, RALLY-on-the-line, PRIMED, THREAD, LIT,
WOVEN, KIZUNA, DUET, BOND STRIKE, FOLLOW-UP, WEAVE, TRIAD, CROWNED, ALL-OUT,
ENCORE, FLAWLESS, FINALE, RIPOSTE, AFTERIMAGE, CAST-TIME, TAUNT, plus six
weakness schools and seven parry note types. **40+ terms.** StS1 shipped its
combat on ~a dozen; StS2 added keywords specifically "to condense complex card
text." We are far past the budget, and the collisions (two CHILLs, enemy
`mark`=EXPOSED vs hero `exposed`) are the worst kind of spend.

**O6 — The turn's central question has no UI.** THE-LINE.md names the turn's
question perfectly: *"whose line do I finish, and whose beats do I borrow?"*
The screen never asks it. While a line is live the only trace is a floating
"✦ THE LINE" title (`02-t1-after-opener.png`) and whichever cards happen to be
dealt this beat. Not shown anywhere: how many beats deep the line is, who has
carried it (FOCUS is only visible after the finisher is dealt), what rally is
banked on it, what closing costs per candidate, or that walking away forfeits
Hask's provisional bank. The player is asked to hold the whole tree-walk in
their head; StS asks you to hold nothing — every option's full consequence is
on its face.

**O7 — Two telegraph voices, plus four more.** A threatened turn draws: the
per-foe intent pill ("✕ 21 → F ↴"), the per-lane sum ("☠ 30" at the hero's
feet), the narrator line, the turn banner, coach lessons ("COMBO STEPS ARE
FREE…"), and the chip row. The pill's row letter (F/M/B) is a decode step; the
pill floats high above the foe, spatially attached to nothing
(`p7-allout-notes.png`: "✕ 21 → F" hangs in the sky). StS2's answer per the
intent guide: icons side-by-side over the attacker's head, each shape
visually distinct, with numbers — one voice, one anchor.

---

## 2. What StS2 actually does (and what I could verify)

Caveat up front: StS2 is in early access (launched March 2026) and most deep
sources were egress-blocked from this environment; I worked from search
snippets of the pieces below plus StS1's grammar, which the sequel visibly
inherits. Confidence flags per claim.

- **Intent is one anchored voice.** Icons sit side-by-side over the enemy (the
  original stacked them), each with "a very specific signature," numbers
  attached where relevant ([Untapped.gg intent guide][u], via snippet —
  HIGH confidence). Multi-action foes show multiple segments side by side.
- **The number shown is the number that lands.** Card damage and intent
  numbers are recomputed with Strength/Weak/Vulnerable applied (series
  grammar; HIGH confidence — StS1 verified behavior, no source suggests StS2
  dropped it).
- **A turn is bounded and cheap to parse:** draw 5, 3 energy, block decays,
  end turn ([Game8 review][g], snippet). One resource, one hand, everything
  else is on the board.
- **Enemies now adapt** — elites/bosses can change intent in response to your
  board state (e.g. stacking huge block flips an attack to a buff), and some
  bosses carry explicit anti-infinite "limiters" ([xmodhub mechanics
  guide][x], snippet — MEDIUM confidence, could not read full article).
- **The sequel's stated aim is less autopilot, better offense/defense
  balance** ([GamesRadar EA review][gr] via snippet; [Punished Backlog][pb]).
- **UI polish is about *access*, not addition:** "rapidly access important
  information like relic effects, status conditions, and deck contents
  without making the interface look cluttered … better tooltips and sharper
  visual cues" ([GamesRadar][gr] snippet).
- **What it refuses to show:** anything beyond the next action (no full
  rotation preview), deck order (absent scry effects), the AI's rules. The
  future is one step deep, always.
- New characters bolt complexity onto the *character*, not the shared system —
  the Necrobinder's minion slots live and die inside her kit ([mobalytics
  guide][m], snippet). The shared battle screen stays the same size.

[u]: https://sts2.untapped.gg/en/guides/how-to-read-enemy-intent
[g]: https://game8.co/articles/reviews/slay-the-spire-2-review-early-access
[x]: https://www.xmodhub.com/info/blog/slay-the-spire-2-new-mechanics-guide/
[gr]: https://www.gamesradar.com/slay-the-spire-2-review/
[pb]: https://punishedbacklog.com/slay-the-spire-2-so-far-early-access/
[m]: https://mobalytics.gg/slay-the-spire-2/characters/necrobinder-guide

The transferable law, in one line: **StS shows you the complete consequence of
every option you hold, exactly one step into the future, in exactly one place
— and shows you nothing else.** Our game shows atmosphere everywhere,
consequence nowhere.

---

## 3. The spec

Ranked by impact per unit of work. Effort: **S** = a session, **M** = a day or
two, **L** = multi-day rewrite (defer). Every item names what it replaces and
its success test. The owner's three non-negotiables are marked ✦ where an item
touches them.

### P0-1 · True Faces — the number on the card is the number that lands
**Effort M · the single highest-leverage change in this document.**

*What:* a pure `previewFx(card, target)` that runs the same arithmetic
`resolveCard`→`dealToEnemy` will run — owner `buffDmg`, DESPERATE, weakness
school ×, `mark`, `passiveDmg` (duet `dmgMod` + boons), ASSIST (+2 if an ally
already hit the target this turn), chill −, LINE FOCUS and rally (already
face-applied — keep) — and paints the result:

- On the card face, the damage/heal number is the *final* number against the
  current default target, tinted gold when modifiers raised it, grey-struck
  when lowered (StS's green/red grammar, our palette).
- While aiming, each candidate enemy shows a floating `−N` (and `BREAK in 2`
  if the hit chips poise to ≤0) before commit. The husk in O1 would have said
  `−43` before I understood why; the *why* is the tooltip, the *what* must be
  free.
- Deterministic bond cascades that will auto-fire on this play (weave follow,
  duet strike whose condition is already true) are included as a second line:
  `+ Twin Edge 7`.

*Replaces:* base-value faces; the "TECHNICAL/ASSIST/DESPERATE" popup storm
after the fact (keep the popups, they become confirmation instead of
revelation).
*Why:* O1. The engine already centralizes enemy damage in `enemyIntentDmg()`
for honesty; this is the identical discipline pointed the other way.
*Success test:* a rig plays 200 random cards and asserts previewed == dealt
within ±0 for every deterministic play; a hand-check that no fight shows a
kill the preview did not predict.

### P0-2 · The Line Track — put the turn's one question on screen ✦combo
**Effort M.**

*What:* a slim horizontal strip docked directly above the hand, present only
in rotation combat, replacing the floating "✦ THE LINE" title:

```
  ◈──◈──◇      ASH ●●        ELIN ○        MIRA ○       ▲ +4 banked
  beat 3       carried ×2    can close 1EP  can close 2EP  ◆2 held (Hask)
```

- Left: beats played as filled pips (the line's depth — the thing currently
  stored invisibly in `S.line.depth/beats`).
- Middle: one cell per living hero: portraits of who carried beats (FOCUS
  bonus preview under the next-finisher rule, i.e. `LINE_FOCUS[beats]`), and
  for every hero whose current dealt card is a FINISHER, its EP cost.
- Right: `S.line.rally` banked on the line, and any provisional bank
  (Hask's `_pendCharge`) with the explicit warning color when a move/turn-end
  would forfeit it.
- END TURN while a line is live gets a confirm shade on the button itself:
  "line unclosed — banked ▲4 will be lost."

*Replaces:* the "✦ THE LINE" floating label; the FOCUS surprise-on-deal; the
silent forfeiture rules.
*Why:* O6. The design doc says the turn is one question; the UI must be that
question. This is also the tutorialization of the line — the strip teaches
open → carry → close by existing.
*Success test:* `uxaudit`-style probe: from a screenshot alone (no source
access), an annotator can answer "how deep is the line, who can close, for
how much" — currently impossible. `linemeter` MID stays ≥ its Build 294
numbers (the strip adds no mechanics, so it must not move them).

### P0-3 · One Kizuna ladder — merge the five pair systems into one visible
### progression ✦team-attacks-that-develop
**Effort L (multi-day — mechanics + UI + tests). Do the UI half first (S).**

*What (UI half, ship first):* one chip per active pair in the top bar, always
the two portrait slivers + state, never a bare icon: `[A|E ♡ LIT]`,
`[A|M ✦ WOVEN]`. Tap/hold a chip → a card-sized panel naming exactly what
this pair does now and what it unlocks next ("WOVEN: a FINISHER offers
Mira's follow · once/turn. Next: fight together at camp → Bond Strike").
Chips pulse when their rule fires and the popup that lands *names the chip*
("✦ TWIN EDGE — bond", not a bare number).

*What (mechanics half):* collapse the five pair-systems into one ladder the
run climbs — this is the "develops over time" the owner asked for, made
literal:

| stage | earned by | grants (one rule per stage) |
|---|---|---|
| **LIT** (thread, in-fight) | one act of help (assist/heal/avenge — keep `addThread` triggers) | +2 guard both (exists) · ASSIST +2 vs shared targets (exists) |
| **WOVEN** (kindled across fights) | bond points ≥ `BOND_KINDLED` | the pair's **follow-up card** in the line (`FOLLOWUPS`) — the *offered, chosen* team attack |
| **SWORN** (new name for the duet tier) | bond node at camp | the pair's **named passive** (`DUET_PERKS`) *or* its once-a-fight **bond strike** — each pair keeps ONE, authored, not both |
| **TRIAD** | all three pairs SWORN + one act this fight | crowned ALL-OUT + FINALE (exists) |

Concretely cut: the automatic `offerBondFollow` free-chain on every
finisher/sig (its job — "a finisher weaves your partner in" — is the WOVEN
follow-up's job, done with player agency inside the line), and the
`strike:true`/passive duplication where a pair currently owns both.
*Replaces:* systems ②③⑤⑥ existing as separate grammars; the ✕-glyph chips.
*Why:* O3. Same content, one story. Every payoff the owner loves survives —
it just becomes *findable*.
*Success test:* damage attribution probe: after any fight, the log can say
what fraction of damage came from bonds, and a player shown the chip row can
predict which pair fires next turn. Keyword count for pair-play drops from
~9 (thread/lit/woven/duet/weave/strike/follow/prime/kizuna) to 4 (LIT, WOVEN,
SWORN, TRIAD).

### P0-4 · Break that bends, not deletes — the anti-autopilot pass
**Effort S–M.**

*What:*
1. A multi-action foe (boss `attacksPerRound ≥ 2`, swarms) loses **one**
   action to a break, not the round. Single-action mobs keep losing their
   turn (the payoff stays real where it isn't degenerate).
2. Poise hardens within a fight: each break raises `poiseMax` by +1 (the
   Octopath rule), so the second stunlock is a plan, not a rhythm.
3. Free-card damage throttle: damage dealt by $0-cost auto/offered cards
   (weave follows, bond strikes, forged temp cards) counts toward a per-turn
   cap of ~1.5× the party's paid-card damage that turn; past it they still
   fire but land at half. Tune the exact ratio against `roommeter`.
4. (Elite+boss only, StS2's lesson, MEDIUM effort) one **adaptive intent**
   each: the Revenant re-aims its hook at the hero with the most banked
   charge; the floor boss swaps a strike for a poise-restoring brace when
   broken twice. Keep it honest — the telegraph updates the moment it adapts.

*Replaces:* unconditional turn-theft; unbounded cascade stacking.
*Why:* O2 — a zero-skill bot deleted the game's tension centerpiece without
facing one parry ring. The parry *is* the game; offense must not be able to
refuse the fight on the game's behalf.
*Success test:* re-run my O2 script: the revenant must land ≥1 cascade
against a greedy bot before dying; `playtest-hask-balance` and `runmeter`
survival bands stay inside their current envelopes (this is a nerf to a
degenerate line, not to the party).

### P1-5 · The burst gauge grows up
**Effort S.**

*What:* the bottom-left bar becomes a numbered gauge: `⚡ 84/100` with three
threshold ticks (100/175/250), the container level shown as which ticks are
*lit* vs *locked* (so `burstLevel` vs `burstFireLevel` is finally visible).
Momentum sources consolidate to **four named streams** — PARRY, ASSIST,
BREAK, RESERVE — every gain flying to the gauge labeled with its stream, and
the myriad micro-trickles (raw +2 per hit, riposte +7, etc.) folded into
those four rates. Kill `MOM_SCALE` as a hidden constant; bake it into the
stream values.
*Replaces:* 12-source invisible arithmetic; the unnumbered sliver.
*Why:* O4. The all-out is the climax of every fight; a climax you cannot see
coming is a random event.
*Success test:* screenshot annotator can state momentum, next threshold, and
what to do to reach it. Fun check: `funmeter` all-out frequency unchanged ±10%.

### P1-6 · End-turn shows its price; EP shows its plan
**Effort S.**

*What:* END TURN button carries the reserve conversion live: "END TURN · bank
2 EP → +12 ⚡". While a card is aimed, the EP dial previews the spend
(6 → ghost 4). The "Vow needs your ENTIRE turn" rule and finisher costs stop
being narrator flashes and become disabled-state labels on the cards
themselves.
*Why:* the EP reserve (Build 234) is a genuinely good decision — currently a
secret. Decisions the player can't see aren't decisions.
*Success test:* new-player probe (fresh profile, no tutorial): can they state
what END TURN will do to the burst gauge before pressing it.

### P1-7 · Keyword diet + collision fixes
**Effort S–M (rename pass + gating pass).**

*What:*
- Rename hero `chill` (the self-slow from overextension) to **DULLED** with
  its own glyph; enemy `lull` keeps ❄ CHILL. One word, one mechanic.
- Enemy `mark` is EXPOSED everywhere (audit the places hero `exposed` leaks
  into copy).
- Gate boss-grammar statuses (HEX, SEVER, drain, echo) so they never appear
  on floor-1 trash; floor 1's status vocabulary is exactly: guard, EXPOSED,
  CHILL, POISE/BROKEN, rally. Everything else enters when its enemy does.
- Every status chip answers a long-press with a plain-language tooltip
  (StS2's "rapid access" lesson) — the data exists in `desc` strings already.
*Why:* O5 — 40+ terms vs StS's dozen; two of them collide outright.
*Success test:* grep-level audit: no glyph maps to two mechanics; tutorial
floor's status census ≤ 6 terms.

### P1-8 · One telegraph voice, anchored
**Effort S.**

*What:* dock the intent pill to the foe's nameplate strip (which never moves —
TELEGRAPH.md's own Family-B conclusion, finished), and replace the row letter
with a micro 3-slot diagram (▢▢▣) with the struck lane lit — no decode step.
Multi-blow foes show segments side by side (the StS2 pattern we researched).
The lane sum at the hero's feet stays (it is the *defender's* read; the pill
is the *attacker's*) but the narrator no longer restates threats the pills
already carry, and coach lessons never overlap a live telegraph.
*Why:* O7.
*Success test:* the existing "INTENT: the pill carries damage, riders, and
the RANK of the lane" check updated for the new anatomy; screenshot shows
zero floating unanchored red UI.

### P2-9 · Third-line EP lever (the docs' own unpulled lever) ✦three-heroes
**Effort S to try, M to tune. Defer behind P0-4** (throughput math changes
twice otherwise).

*What:* THE-LINE.md already proves the line halved throughput and names the
fix: EP. Try `maxEp 2+heroes+1 → 2+heroes+2` for trios only, or a
"first opener each turn costs 1 less" rule, so a trio affords a third
open/close cycle. Tune against `roommeter`/`runmeter` (survival), not
`linemeter` (already passing).
*Why:* the duo/trio survival gap the docs measured (55% end-HP duo case);
also makes "whose line" a three-way question, which is the party-of-three
promise.

### P2-10 · Adaptive elites everywhere + boss limiters
**Effort L — defer.** The full StS2-style reactive-intent system (every elite
reads board state; bosses carry authored anti-turtle/anti-stunlock limiters)
beyond the two pilots in P0-4.4. Multi-day: needs per-enemy authoring, new
telegraph states, and a re-tune of the parry ramp.

### P2-11 · Formation HUD
**Effort L — defer, explicitly held in reserve** (TELEGRAPH.md §5 already
made this call and the reasoning stands). If P1-8 still tests badly with the
lunge theatre, a Grandia-style strip is the fallback, not the plan.

---

## 4. What we deliberately keep (the anti-spec)

- **The parry cascade and its gesture-per-enemy identity.** It is our body,
  the thing StS2 cannot do. Every change above funnels attention *toward* it.
- **`enemyIntentDmg` as single source of truth.** P0-1 extends the principle;
  nothing may fork it.
- **The hand is the position.** No reach, no off-row deals — Build 10's
  decree survives contact with this spec.
- **The Line as the one party combo.** ✦ It doubled mid-turn legal plays
  (linemeter, both packs, every party). We are building it a face, not a
  replacement.
- **Momentum-as-reserve, poise pips, honest boss enrage.** Good bones.
- **The diorama, the beat-hold poses, the all-out as reverse-parry.** The
  JRPG half of "JRPG StS2" lives here.

## 5. Sequencing

1. **P0-1 True Faces** (unblocks everything — every later screen quotes it)
2. **P0-2 Line Track** + **P1-6 end-turn price** (one hand-area rework)
3. **P0-4 break/cascade throttle** (before any EP tuning)
4. **P0-3 Kizuna chips (UI half)** → then the ladder merge
5. **P1-5 burst gauge · P1-7 keyword diet · P1-8 telegraph dock**
6. **P2s** behind fresh `roommeter`/`funmeter` baselines after 1–5.

Measured claims worth re-verifying after each step: elite-turn-1 deletion
(must die), 43-damage-off-a-heal surprise (must become a predicted 43), the
screenshot-annotator probes in P0-2/P1-5, and the linemeter/roommeter bands
that already gate the line design.
