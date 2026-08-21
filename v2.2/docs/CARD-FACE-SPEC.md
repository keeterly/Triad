# CARD-FACE-SPEC — the number on the card must be the number that lands

**Status:** design specification with measurements, v2.2 Build 38 era. This is
the dedicated follow-through on COMBAT-SPEC O1 ("the face of a card lies about
what will land"). Written after a source read of the two card pipelines
(`mkCard` @4788 / `mkRotCard` @1722 build-time; `resolveCard` @5773 /
`dealToEnemy` @6271 resolve-time; face renderer `renderActionBar` @11780,
`fxIconStr` @11822) and a full instrumented sweep of the card pool through the
Playwright harness (probe scripts in the session scratchpad:
`face-probe.cjs`, `face-probe2.cjs`; raw records in
`face-probe-results.json` there). Line numbers refer to `game.js` as measured;
they will drift, the function names will not.

**The brief:** keep the three-person party, the combo lines, the team attacks
that grow over a run — and make the card face do what Slay the Spire's does:
show the number that will actually land against the current target, recomputed
live as the board changes, with a modified number visibly marked as modified.

---

## 1. The measurement

The probe stands up a real fight, replaces the encounter with one 500-HP dummy
(no weakness, unbreakable poise), fields the card's owner **solo** (so no
assist, no bond strikes, no duet perks contaminate the reading), builds every
card through the game's own builders (`buildHand` for classic cores/sigs and
openers, `genChainStep` for forged rotation steps), scrapes the icon row of
the rendered `#hand .card` DOM node, resolves the card with `playCard`, and
measures the true delta — enemy hp+guard, ally hp, guard, rally, counter,
mark, chill — per channel. Each card is probed on a clean board and then under
each single live modifier the game can put on the board.

**Pool:** 140 card entries — 42 classic core/signature cards (7 heroes × 3
stances × 2) and 98 rotation cards (6 heroes' openers, alt openers, combo
steps and finishers). 686 resolutions, 989 (channel × state) face readings.

**On a clean board the faces are honest: 198 readings, 0 divergent.** This is
worth saying loudly because it identifies the fault line exactly. Everything
that modifies a card **at build time** — ember-tree riders, run forges, boon
`card()` mods, line FOCUS (`applyLineFocus` @1955), the line-rally payout in
`dealBeat` (@2038), the finisher EP repricing — mutates `card.fx` **before the
face is rendered**, so the face tells the truth. `applyLineFocus` even says
why in its own comment: *"Applied at DEAL time, not at resolve time, so the
empowerment is on the card's face before the player chooses it — the whole
point is that it is visible while the choice is open."* The game already knows
the rule. It just stops following it the moment a modifier lives on the board
instead of on the card.

**Under any live modifier the faces lie, near-universally:**

| board state (one modifier) | damage faces wrong | mean error |
|---|---|---|
| clean board | 0 / 108 | — |
| owner has ▲ RALLY 4 | 98 / 108 | +4.0 |
| target ◎ EXPOSED 3 | 108 / 108 | +3.0 |
| target primed (❄/weakened → TECHNICAL ×1.6) | 108 / 108 | +3.3 |
| target BROKEN (×1.5 window) | 108 / 108 | +3.0 |
| owner at ¼ HP (DESPERATE +2) | 98 / 108 | +2.0 |
| Hask holding ◆3 (Overload) | 1 / 1 | +9 |

Across all channels and states: **530 of 989 readings diverge (54%), median
error 3, p90 4.** The ten cards that *don't* move under RALLY and DESPERATE
are the `fx.smite` cards — the support-with-teeth strike runs a **parallel
damage ladder** (@6031) that takes mark, passives and assist but skips rally
and desperation. Two hand-maintained copies of "how hard does a hit land"
already disagree about which modifiers apply. That is the drift this spec
exists to make structurally impossible.

**The single-modifier errors are small; the game stacks them multiplicatively,
and that is where the ✚4-heals-for-43 class of lie comes from.** Measured on a
realistic late-fight board (rally 4, target exposed 3, primed, broken, owner
desperate):

- **Crashing Wave** — face `⚔11` → landed **48** (+37). Ladder: 11 +4 rally
  +2 desperate +3 mark = 20, ×1.5 break = 30, ×1.6 technical = 48.
- **Overload with ◆3** — face `❅6` → landed **53** (8.8× the printed number).
- **Elin's Mend** — face `✦4 ✚3` → healed 3 and dealt **18**. The heal was
  honest; the "4" beside it landed at four and a half times its face. This is
  the probe's reproduction of the observed "✚4 card produced a 43-damage
  beat" — a support card whose rider damage rides every board multiplier the
  face knows nothing about (the original observation additionally had woven
  follow-ups firing off the same play; see §4 on those).
- **ASSIST** — second hero striking the same foe: face `⚔4` → landed 6. The
  flat +2 the game's own tutorial teaches is never on the card.
- **Starfall** — `castDmg: 16` is not handled by `fxIconStr` at all, so the
  biggest number in Hask's kit renders an **empty icon row**. The face shows
  *nothing*, the card deals 16.

And one authored-text stratum underneath all of it: three cards in
`ROTATIONS.elin` have descriptions that disagree with their own `fx` —
Sanctuary (fx guard 3, desc "⛨ 4"), Cleanse (fx guard 4, desc "⛨ 3"),
Blessing (fx heal 2 / rally 3, desc "✚ 3 · ▲ +2"). The icon row is right and
the prose lies, because the prose is a second hand-written copy of the
numbers. Same disease, smaller organ.

## 2. Where the resolve-time ladder lives (what the face never sees)

Additive, in `resolveCard` @5773: `owner.buffDmg` (rally, consumed on play) ·
DESPERATE +2 (owner ≤¼ HP) · `guardBurst` (+ all of Cassia's current guard) ·
`spendCharge` (+◆ × `chargeDmg()`, 3 or 5) · Hask's aether pyre/frost swings ·
`owner.chill` (−N, consumed) · `tgt.mark` (+N) · `passiveDmg` @936 (tree
passives, COMMON temper/keen, boon `dmgMod`s) · ASSIST +2. Multiplicative, in
`dealToEnemy` @6271: boss echo ×0.5 (remembered finisher) · BREAK ×1.5 ·
TECHNICAL ×1.6 (`TECHNICAL_MULT` @34). Every one of these is deterministic
from state the player can already see on the field — which is precisely why
the enemy side of this game got it right: `enemyIntentDmg` @6107 is *"a single
source of truth… used by the enemy turn AND both telegraphs so what you're
shown is exactly what lands."* Our foes' blows are honestly telegraphed
through one function. Our own are the only dishonest numbers on the screen.

## 3. The fix — one arithmetic, two readers

**Do not write a preview function beside the resolver.** A second
implementation of the ladder is how the smite path drifted. Extract the
arithmetic the resolver already performs into pure functions, and make the
face and the resolver both read them.

**`attackAmount(card, owner, tgt)`** — pure. Lifts the additive ladder out of
`resolveCard` verbatim and returns `{ amt, steps }` where `steps` is the
itemized breakdown (`[{k:'base',v:11},{k:'rally',v:4},{k:'mark',v:3},…]`). No
popups, no mutation. `resolveCard` calls it, then walks `steps` to perform the
side effects it currently interleaves with the math (consume `buffDmg`, spend
guard/charge, fire the popups) — the narration is driven *by* the breakdown
instead of being a fork of it. The smite branch calls the same function with a
flag (`{smite:true}`) so its exceptions (no rally, no desperation — keep the
current behaviour, but keep it in one place as an explicit rule) are encoded
once.

**`hitScale(e, school, byHeroId, opts)`** — pure. Lifts the multiplier head of
`dealToEnemy` (echo, break, technical) and returns `{ mul, steps }`.
`dealToEnemy` applies it and keeps its own side effects (momentum, poise,
lessons) at the call site.

**`previewFx(card, tgt)`** — the one function the UI is allowed to get
numbers from. Composes the two above per channel:
`dmg: round(attackAmount(...).amt × hitScale(...).mul)`, plus `heal` (capped
by `healCap` and the receiver's wound — show what will actually restore, with
overheal-to-guard shown as the ⛨ it becomes), `guard`, `rally`, `counter`,
`mark` (respecting the cap of 6), `chill`, and `deferred: {castDmg, turns:1}`.
It resolves the card's *default target* when none is given: `frontmostEnemy()`
for `frontmost` and (un-aimed) `enemy` cards, the owner for `self`, the
listed receivers for `ally`/`allies`. It also returns the `steps` so the face
can explain itself.

**The face reads the preview.** `cardIcons` (@11847) takes
`previewFx(card, defaultTarget(card))` instead of raw `card.fx`. Where a
channel's previewed value differs from the authored base, the `.ic` span gets
`ic-mod-up` / `ic-mod-down` (StS's green/red modified number — tint, don't
just recolor the glyph, this must survive the small icon row) and a `title`
built from `steps` ("11 base · +4 rally · +3 exposed · ×1.6 technical ·
×1.5 break = 48"). `castDmg` renders `◈16` with a `NEXT` tag — a number and
when it lands, never an empty row.

**Live updates.** `renderAll` already fires after every state change; the only
reason faces are stale is the perf fast-path in `renderActionBar` @11786,
whose `structSig` deliberately excludes anything but card identity. Extend the
signature with the preview: `previewSig = hand.map(c => sig of previewFx(c))`.
A rally landing, a mark laid, a foe breaking, EP-neutral repositioning that
changes `frontmostEnemy()` — each changes `previewSig` and re-renders the
faces. This keeps the fast-path (signature comparison stays cheap; `previewFx`
on ~6 cards per render is trivial next to the DOM rebuild it gates).

**Aiming previews per-enemy.** While a `target:'enemy'` card is being aimed,
recompute `previewFx(card, hoveredEnemy)` and show the number in the aim
flow — update the dragged card's icon row, and echo it over the target with
the existing `popupAt` grammar the way enemy intents already sit on figures.
This is the StS behaviour of the number changing as you hover Vulnerable vs
clean enemies, and it is what finally makes TECHNICAL *legible*: the ×1.6 is
on the number before you commit, so "cash your biggest hit into the primed
foe" becomes a choice you can see instead of a lesson() popup after the fact.

**The prose stops carrying numbers it doesn't own.** Every digit in a card
`desc` that names a face channel either gets generated from `fx` at build
time or is asserted equal to it by the test below. That retires the
Sanctuary/Cleanse/Blessing drift and prevents its recurrence.

## 4. What the face must NOT absorb

The observed 43-damage beat had a second ingredient beyond multipliers: woven
follow-ups and bond strikes firing *off* the played card. Those are separate
plays by other actors and must stay off this card's face — folding an ally's
answer into your heal's number would un-teach the bond system and make ✚4
read as a lie in the other direction. The rule: **a card's face previews that
card's own resolution; every follow-on act gets its own honest face at the
moment it exists** — the offered follow-up/weave card previews through the
same `previewFx` when it appears in hand, and the automatic bond strike
telegraphs on the bond badge (a small `◈N` chip via the same function) before
the enemy phase, exactly as enemy intents do.

Genuinely non-previewable, and what to do instead: the random victim of a HEX
burn (not a number — keep the text warning); which foe will be frontmost
after mid-turn deaths (preview the board as it stands, StS's own answer);
EP-refund and momentum side effects (badges, not face numbers — they are not
promises about this target). Nothing else in card resolution is random: even
the boss's echo memory is public state the game announces ("IT REMEMBERS
Crashing Wave"), so the ×0.5 **must** be previewed — showing the blunted
number is the whole point of that mechanic.

## 5. Test invariants (flow.test.cjs voice)

```js
check('CARD FACES TELL THE TRUTH on a clean board: the icon row equals the landed delta, every card',
  await J(async () => { /* per card: scrape face, playCard vs dummy, compare each channel */ }));

check('the face already includes the board: a ◎3 / primed / broken foe raises the printed number before the play',
  await J(() => { const d = S.enemies[0]; d.mark = 3; d.staggered = true; renderAll();
    return faceDmg('Crashing Wave') === previewFx(handCard('Crashing Wave'), d).dmg
        && faceDmg('Crashing Wave') > 11; }));

check('a modified number is MARKED as modified — ic-mod present iff preview differs from the authored base',
  await J(() => { /* rally the owner, assert .ic-dmg has ic-mod-up; clean board, assert it does not */ }));

check('ONE ARITHMETIC: previewFx(card, tgt) equals the measured delta after playCard, fuzzed over board states',
  await J(async () => { /* seed rally/mark/lull/staggered/charge randomly N times; assert equality every time */ }));

check('the resolver consumes the same breakdown it shows: rally is spent exactly once and only by the path the preview said',
  await J(async () => { /* smite card under rally: preview shows no rally, buffDmg survives the play */ }));

check('a cast that lands NEXT turn says so — castDmg renders its number with a NEXT tag, never a blank icon row',
  await J(() => !!document.querySelector('#hand .card[data-card-name="Starfall"] .ic-dmg')));

check('the prose owns no number the fx disputes: every digit in a card desc matches its built fx',
  await J(() => allCards().every(c => descDigitsConsistent(c))));

check('AIMING previews the enemy under the finger: the number over a primed foe is ×1.6 the number over a clean one',
  /* drive the real drag pipeline over two foes, read the aim popup */);
```

The fuzzed one-arithmetic check is the regression fence. It is the same
invariant the probe in this spec's scratchpad already runs; once `previewFx`
exists it graduates from a measurement into a promise.

## 6. Order of work

1. Extract `attackAmount` / `hitScale` from `resolveCard` / `dealToEnemy`;
   re-express both call sites through the returned breakdowns. Behaviour
   change: none (the flow suite must pass untouched).
2. Add `previewFx` + `defaultTarget`; wire `cardIcons` and the desc digits.
3. Extend `renderActionBar`'s signature with `previewSig`; add `ic-mod-*` CSS.
4. Aim-time per-enemy preview; bond-strike/follow-up telegraph chips.
5. Land the §5 checks in `flow.test.cjs`.

Step 1 is the whole battle. Steps 2–4 are rendering; they cannot drift because
after step 1 there is nothing left to drift from.
