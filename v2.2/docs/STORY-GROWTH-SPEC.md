# STORY-GROWTH-SPEC — making the fire the reason the tree grows

**Status:** design specification. Written after a source read of the ember
tree (`hasNode`/`unlockNode`/`EMBER_TREE`/`BOND_NODES`, game.js), the
campfire (`showCamp`/`showCampScene`/`_fireCanTeach`/`fireTeachings`,
game.js), the bond ledger (`addThread`/`S.threads`/`pairKey`/`bondPts`,
game.js), and the narrative engine in full (`narrative.js`, all 892 lines),
plus a headless run through `test/harness.cjs` that fired every narrative
signal the game emits and watched `RUN.nodes` the whole way.

**The premise, stated once so the rest of this document can just point at
it:** a cutscene where two heroes finally understand each other should be
the same event, mechanically, as that pair's node opening on the lattice.
Right now it is two unconnected events wearing each other's clothes.

---

## 1. What I measured

**The narrative engine has 29 authored beats and seven effect verbs, and
none of the seven touches a hero, a node, or a bond.** `narrApplyEffects()`
(narrative.js:555) recognizes exactly `SET_EVENT_COMPLETE`, `SET_CAMPAIGN_ACT`,
`SET_CHAPTER`, `UNLOCK_RESONANCE`, `UNLOCK_SYSTEM`, `SET_REVEAL`, `INCREMENT`
— bookkeeping for the plot, not the party. Counted across the 29 beats' `effects` arrays: 18 uses of `SET_EVENT_COMPLETE`
(every beat has one — it's how `narrDone()` works), 8 `SET_REVEAL`, 2
`UNLOCK_SYSTEM`, 2 `SET_WORLD_STATE`, one each of `SET_CAMPAIGN_ACT`,
`SET_CHAPTER`, `UNLOCK_RESONANCE`, `INCREMENT`. Two
authored effects — `SET_WORLD_STATE` on `A5_420_FINAL_LIBERATION` and
`A5_430_STEWARD_CHOICE`, the game's own ending — aren't implemented at all;
they fall through to
the `console.warn('[narrative] unknown effect', fx)` branch at the bottom of
the function. `grep -n "unlockNode\|addThread\|RUN\.nodes\|hasNode" narrative.js`
returns nothing. The engine cannot reach the tree because it was never given
a hand that could.

**Only 9 of the 29 beats have a scene at all.** `NARR_SCENES` (narrative.js:671)
holds exactly the prologue, `PRO_000` through `PRO_008` — confirmed by
`test/flow.test.cjs`'s own check (`NARR_BEATS.filter(b =>
b.id.indexOf('PRO_') === 0).length === 9`) and by `docs/NARRATIVE.md`'s own
roadmap, which lists `A1_010`–`A1_060` as **not yet written** ("N3 — Act I
skeleton... each beat needs its scene"). The runner's own discipline
(`narrRunBeat`, narrative.js:587) leaves an unstaged beat PENDING rather than
burning it — correct, and the reason none of Act I through the epilogue has
happened to a real player yet. So today's honest denominator for "beats a
player can actually see" is 9, and every one of them is prologue table-setting
(a nameless trio, an unnamed voice, a title card) with no companion identity
attached yet — `PROTAGONIST`/`PREV_TRIO_A/B/C` are roles, not Ash or Elin,
and the bible keeps them that way on purpose (spoiler safety; see
`NARRATIVE.md` §"Spoiler safety").

**Meanwhile there are 45 authored beats that already ARE about two heroes
understanding each other, and they unlock nothing.** `BOND_ARCS` (game.js:3881)
holds three staged scenes for all 15 pairs among the six lattice heroes
(Ash, Elin, Cassia, Hask, Mira, Branwen — `15 = 6×5/2`, confirmed by
counting `Object.keys(BOND_ARCS).length === 15` against the code's own Build
267 comment). The file's own header is blunt about it: "The campfire played a
beautifully written scene and then handed you the same thing every time: +1
bond, node unlocked, exit... forty-five authored beats of personal history
that advanced zero plot" (game.js, the block above `BOND_ARCS`). That comment
predates Build 269's fork (THE ABILITY / THE ANSWER) and is no longer
literally true — a bond node CAN open at the fire now — but the opening is
disconnected from which of the three stages just played. `showCampScene()`
(game.js:10843) computes `stage = nextArcStage(a, b)` and plays whatever the
pair's next unseen beat is, then **independently** offers a fork where "ASK
WHAT THEY ARE TOGETHER" opens the pair's bond node — available the first
night you ever sit that pair down, stage 1, before either of them has said
anything that resembles understanding. Nothing in `showCampScene` reads
`stage` when deciding whether the fork's gift option exists. The node and
the story arrived at the same table but never introduced themselves.

**Every route onto the character sheet runs through embers, with one
exception that is itself story-blind.** `unlockNode()` (game.js:287) has
exactly one caller outside its own definition: `etBindDetail`'s buy handler
(game.js:11226), the ember-tree purchase button. Two more sites push directly
onto `RUN.nodes`/`RUN.crossed`: the post-fight Ember Spark draft
(game.js:10542, still ember-priced at 70%) and crossing a bond
(`learnCrossing`, game.js:906, priced by `crossCost` — still embers, just
scaled by kinship). The **one** non-ember route is `RUN._teach`, "the fire
teaches" (game.js:13024) — a free kindle token the campfire can grant, spent
on **whatever node the player picks**, not one the story names. It removes
the ember tax; it does not point.

**I drove this with the harness rather than trust the read.** `boot()` +
`newRun('ash')`, then `narrFire('NEW_GAME', …)` to walk the full nine-beat
prologue, then `narrFire('LANDING', …)`, `narrFire('COMBAT_VICTORY:A1_040_FIRST_PRESENT_FALLEN', …)`,
`narrFire('PLAYER_DEATH', …)` — every signal the game ever emits into the
narrative engine (there are exactly four call sites: game.js:12894, 9185,
9261, 14411). `RUN.nodes.length` before: 0. After all four signals and the
entire prologue: 0. `RUN.bonds`: `{}`. `S.threads`: never touched. **A
player can walk the whole of the currently-playable story — the entire
prologue, an act-one boss kill, a death and rebirth — and their character
sheet will not have moved once.** The only thing that has ever moved it is
spending embers earned in combat, which has no dependency on story having
happened at all; you can max a hero's tree having skipped every campfire
scene by choosing THE ABILITY at the very first fire you ever sit at.

---

## 2. The fix: `GRANT_NODE`, a beat effect that opens a door instead of a wallet

### 2.1 Signature and validation

```js
// beat.effects entry: 'GRANT_NODE:<nodeId>' or 'GRANT_NODE:<heroA>|<heroB>:<nodeId>'
// (the pair form is required for type:'bond' nodes, whose id alone — 'bond.ash|elin'
// — already carries the pair; the colon form exists so a solo node like
// 'elin.passive.wrath' can be granted without inventing a second grammar)
function narrGrantNode(nodeId, ctx) {
  const n = NODE_BY_ID[nodeId];
  if (!n) { console.warn('[narrative] GRANT_NODE: no such node', nodeId); return false; }
  const owners = n.hero ? [n.hero] : n.pair.split('|');
  if (!RUN) { narrQueueGrant(nodeId, ctx); return false; }           // no run in progress — see 2.2
  if (!owners.every(id => RUN.roster.indexOf(id) >= 0)) {
    narrQueueGrant(nodeId, ctx); return false;                        // hero not recruited yet — see 2.2
  }
  if (hasNode(n.id)) return true;                                     // already theirs — a quiet no-op, not an error
  unlockNode(n.id);
  narrRevealNode(n, ctx);                                             // 2.3 — the payoff, not unlockNode's silence
  return true;
}
```

Three validation questions, answered the way the rest of the tree already
answers them: **does the node exist** — look it up in `NODE_BY_ID`, same
table `EMBER_TREE`/`BOND_NODES`/`COMMON_NODES` all register into, so a typo
in an authored beat fails loud in dev (`console.warn`) instead of quietly
appending a garbage string to `RUN.nodes` forever, which is what
`unlockNode()` does today for *any* caller — it never checks `NODE_BY_ID[id]`
at all. **Does the node belong to the right hero(es)** — read it off the node
itself (`n.hero` for a solo node, `n.pair.split('|')` for a bond node) rather
than trust the beat's authoring; the beat names a node id, the node says who
it's for, and a beat that names Ash's node while narrating an Elin scene is a
content bug the validator catches instead of ships. **Is the hero in the
party** — checked against `RUN.roster` (recruited-ever), deliberately not
`RUN.active` (fielded this fight). The ordinary kindle UI is narrower than
that: `showEmberTree`'s hero picker comes from `partyHeroes()`
(game.js:13106), which is `RUN.active` filtered to `TREE_HEROES` — a benched
companion cannot be selected to spend embers on at all today. `GRANT_NODE`
should not inherit that restriction. A scripted payoff fires because a scene
played, not because the player happened to have that pair fielded when it
did — `BOND_ARCS` scenes require both present at the fire (§3.1 makes this
moot in practice), but a macro beat like `A4_300` (§3.3) has no such
guarantee, and benching a companion is not a story reason for her earned
understanding with the protagonist to fail to land.

### 2.2 Not recruited yet: queue, don't drop

`BOND_ARCS` scenes structurally cannot fire for an unrecruited hero — both
must already share a fire — so this branch is dead weight for the campfire
wiring in §3. It is not dead weight for the macro engine: `A4_300_PRIOR_KIZUNA_REVEAL`
names a bond between `PROTAGONIST` and whichever `PREV_TRIO_*` turns out to
share it (§3.3), and nothing guarantees that hero is recruited, or alive, or
fielded, the moment Act IV's `STORY_GATE:TRIO_PRIOR_KIZUNA` fires — a run can
reach Act IV having never drafted that companion. The engine already has a
discipline for "authored content, conditions not met yet": `narrRunBeat`
leaves an unstaged beat PENDING rather than burning it silently. `GRANT_NODE`
should follow the same law rather than invent a second one: an unrecruited
target queues the grant (a short list on `narrState()`, `n.pendingGrants`,
schema-versioned like everything else in that object) and `narrApplyEffects`
still marks the *beat* complete — the scene played, the plot advanced, the
grant just hasn't landed yet. The queue drains the moment `RUN.roster` grows
to include the missing hero (one check, alongside the recruit-scene call
site), each grant re-presented with its **own** reveal at that moment rather
than merged silently into the recruit screen's noise — the story payoff a
player earned in Act IV should not arrive as a footnote to "Branwen joins."

### 2.3 The reveal is the whole point

`unlockNode()` is silent by design — it's a bookkeeping primitive, called by
UI that does its own presentation (`kindleBurst`, the ember-tree buy flow).
`GRANT_NODE` is never called from a purchase flow, so it needs its own
presentation, and it should not reuse `kindleBurst` unmodified: that overlay
reads `node.hero` for its eyebrow line (`${heroName} · NEW ${kind}`) and says
nothing for a `type:'bond'` node, whose `hero` is `null` — the exact node
type this whole document is about would render its own unlock screen with a
blank name. `narrRevealNode(n, ctx)` is a variant that: (a) resolves the
byline from `n.pair` when `n.hero` is null — "ASH & ELIN · NEW BOND" — using
the same two-hero name-join `showCampScene`'s fork description already
builds; (b) opens **from the scene that earned it**, not from the tree — the
beat's `after()` callback (narrative.js:596) calls it before handing control
back, so the sequence reads scene → reveal → done, the same rhythm
`kindleBurst` already uses for a first kindle inside the tree; (c) names the
*reason* in its subhead the way `addThread`'s narrator line already does for
bonds formed in combat ("♡ LIT · a hand held out" — game.js, `addThread`) —
here, the beat's own `summary` or a short authored `grantReason` string, so
the overlay reads "WARDED EDGE — because you finally asked what she's
running from," not a bare node name with no antecedent.

---

## 3. Where it plugs in — real beats, real nodes

### 3.1 The campfire: the third stage IS the reveal, not a menu option

The concrete, present-tense fix. `showCampScene()`'s fork currently offers
"ASK WHAT THEY ARE TOGETHER" at any stage a pair has bonded at all. It should
stop offering it as a question and start firing it as a consequence: **when
`arcBeat(a, b, 3)` is the scene that just played** — the pair's final,
already-written stage, the one the game's own authors used to write the
moment two people stop talking past each other — the fork's gift branch
should not exist as a choice, because there is no longer a decision to make;
`GRANT_NODE` fires automatically as part of that scene's payoff, and the
fork narrows to the one question that's still actually a question this
descent: THE ANSWER (a fragment) vs. one more ordinary night (+1 bond).
Stages 1 and 2 keep the fork exactly as it is now — reaching for the bond
node early is still available *as a fragment trade*, so a player who wants
the mechanical payoff before the story is that far along still can, but the
free, no-cost, first-night version of "ask what they are together" goes
away, because it was never earned by anything.

Three pairs, read end to end, to make the wiring concrete rather than
hypothetical:

| pair | stage-3 beat (the moment) | node | what it reads as |
|---|---|---|---|
| Ash + Elin | *"You kept me standing. Twice today." / "…That isn't the same as being good for something." / "It is from where I'm sitting. Every time."* | `bond.ash|elin` — **Warded Edge** ⚔ | Elin's whole arc is "keeping people standing was the only thing I was ever good for"; Ash answering her, on the record, is the exact understanding the node should reward. |
| Cassia + Elin | *"While I'm standing you don't fall — and while you're standing, neither do I." / "…Then hold the line, Elin. I'll hold mine."* | `bond.cassia|elin` — **Sanctified Wall** ✛ (`BOND_WEAVE['Guardian+Cleric'].save = true` — while both stand, neither falls, once a fight) | this is the one pairing where the mechanic and the vow are the *same sentence* already — the node's rule is a literal restatement of what they just promised each other. No other pair in the fifteen makes the case this plainly; ship this one first. |
| Branwen + Hask | *"Range is a lonely trade... Then do me the courtesy of a low number, Ranger." / "Sit where I can see you and you won't be."* | `bond.branwen|hask` — **Frostmark** ❅ | two heroes who both fight alone at range agreeing, in-scene, to watch each other's — the node is a targeting synergy between exactly the two schools this conversation is about. |

Twelve pairs remain unlisted here only because the doc doesn't need to spell
out all fifteen to prove the wiring is mechanical, not bespoke: any pair's
`arcBeat(a, b, 3)` maps to `bond.` + `pairKey(a, b)` by construction — the
loop that builds `BOND_NODES` (game.js:2653) already keys them identically.
The 12 remaining rows are the same one-line change repeated.

### 3.2 The Ember Spark draft: let a fresh bond surface its own reward

Independent of the campfire, `showEmberSpark()` (game.js:10487) already
prefers "one offer per fielded hero" from a shuffled pool. The instant a
`GRANT_NODE` lands mid-descent (a pair's stage-3 fires while camped, then the
run continues into more fights), nothing currently tells the player their
new bond node exists beyond the campfire's own flash. No change is being
proposed here — flagging it only so whoever ships §3.1 doesn't also need to
touch the spark pool: `hasNode()` already excludes owned nodes from
`showEmberSpark`'s pool (game.js:10492), so a `GRANT_NODE`-granted bond node
correctly stops appearing as a purchasable offer the moment it's earned, for
free, with zero additional code.

### 3.3 The narrative engine proper: one beat, held in reserve

`NARR_BEATS` doesn't yet reference real heroes — `PROTAGONIST` and
`PREV_TRIO_A/B/C` are roles, unbound by design until the bible locks
identities (`NARRATIVE.md`, "TBD lore stays TBD"). One beat is already
written to be exactly this document's premise once that binding happens:
`A4_300_PRIOR_KIZUNA_REVEAL` (`STORY_GATE:TRIO_PRIOR_KIZUNA`) pays off
`PRO_002_FALLEN_HESITATES`'s hidden truth — "that hero holds the strongest
prior-cycle Kizuna bond with PROTAGONIST" — with a reveal of *which* hero it
was. The day the roles resolve to real ids, `A4_300`'s effects list is where
`GRANT_NODE:<protagonist>|<revealed-hero>:bond.<pair>` belongs: the reveal
*is* two people recognizing what they already were to each other, which is
this document's whole thesis, at the scale the main plot actually operates
on. Do not author it before the bible locks the mapping — that would be
inventing lore this spec has no authority to invent. The effect grammar
should exist and be tested (§4) so that the day N5's later-act hooks get
written, the wiring is a one-line addition to an effects array, not a new
capability.

---

## 4. Division of labor: two systems, not two names for one

The risk in shipping `GRANT_NODE` is collapsing the campfire and the
narrative engine into the same thing wearing two skins, which is the
opposite of `NARRATIVE.md`'s own founding discipline ("five responsibilities,
kept separate on purpose"). The line:

**The campfire owns *whether and when* a pair's story advances.**
`nextArcStage`, `arcSeen`, `_fireBondKey` (which pair gets tonight) all stay
exactly where they are, in game.js, driven by the deed ledger — that
machinery has nothing to do with the macro plot and shouldn't start
routing through `narrFire`. `showCampScene` calling `narrGrantNode` directly
when it plays a stage-3 beat is a **function call**, not a signal — there is
no `STORY_GATE` for "third campfire scene with this pair," because that
gate is entirely local, per-pair, per-save, and the narrative engine's
`STORY_GATE:` grammar is for gates the *whole campaign* needs to agree
happened (act transitions, reveals). Wiring 45 pair-local beats through the
global signal bus would mean 45 new trigger strings for content that will
never chain, never gate an act, and never appear in the Narrative Inspector
next to `PROLOGUE`.

**The narrative engine owns *what a beat is allowed to do once it fires*.**
`GRANT_NODE` — the validation, the queue, the reveal — is one function,
`narrGrantNode`, and it is the *only* place `RUN.nodes` gets written to from
outside a purchase flow, whether the caller is `showCampScene` reaching in
directly or a future `narrApplyEffects` op reaching in from a `STORY_GATE`.
Two call sites, one implementation, so "does a story payoff validate the
node, gate on the party, and present as a reveal" is answered once and never
drifts between the two systems that ask it.

**What must never happen:** a `BOND_ARCS` stage becoming a row in
`NARR_BEATS`, or vice versa. The macro engine's beats are singular,
campaign-wide, spoiler-gated, and about the abyss; the campfire's beats are
per-pair, replay-visible in the Journal the moment they're seen, and about
two people. Keeping `GRANT_NODE` a shared *function*, called from two
separate *authoring* systems that stay separately authored, is what keeps
this a plumbing fix instead of a rewrite.

---

## 5. Test invariants

Written in the suite's own voice — each one states what a player should be
able to count on, not which line of code produces it.

`check('GRANT_NODE: a beat that names a real node opens it on the lattice — and does nothing if it already was',
  <fires GRANT_NODE for an unowned node, asserts hasNode() flips true and RUN.nodes grows by exactly one; fires it again, asserts RUN.nodes is unchanged — a replayed or re-triggered beat can never double-grant>)`

`check('GRANT_NODE: a bond node resolves both owners off n.pair, not off whichever hero the beat happened to be about',
  <grants a bond.a|b node from a scene ostensibly "about" hero a only; asserts both a and b see it on their lattice, since the pair owns it jointly, no one owns it alone>)`

`check('GRANT_NODE: an unknown node id warns and changes nothing — a content typo cannot silently corrupt RUN.nodes',
  <fires GRANT_NODE for a garbage id; asserts RUN.nodes is byte-identical before and after, and console carried a warning>)`

`check('GRANT_NODE: a hero not yet recruited gets a QUEUED grant, not a dropped one — it lands the moment they join',
  <fires GRANT_NODE against a hero absent from RUN.roster; asserts the node is NOT on the lattice yet but the grant is recorded in narrState().pendingGrants; adds the hero to the roster; asserts the node lands and its own reveal fires, not silently folded into the recruit screen>)`

`check('CAMPFIRE: the pair''s bond node opens on their THIRD scene, never their first',
  <drives a fresh pair through arcBeat stage 1 twice, asserting the fork still offers "ASK WHAT THEY ARE TOGETHER" as a fragment-priced choice rather than firing it for free; drives stage 3; asserts the node is already open and the fork no longer offers it as a choice at all>)`

`check('CAMPFIRE: reaching a pair''s stage-3 scene grants their bond node with no ember cost and no fork choice consumed',
  <plays a pair to stage 3 with RUN.embers at 0; asserts hasNode('bond.'+pairKey(a,b)) is true and RUN.embers is unchanged — the reveal is the payment>)`

`check('NARRATOR: a story-granted node announces itself as a reveal, not as a kindle — its overlay names the pair, not a bare node label',
  <fires GRANT_NODE for a bond node from a scripted scene; inspects the reveal overlay's text; asserts it contains both hero names and does NOT reuse kindleBurst's bare "NEW SKILL" eyebrow verbatim>)`

`check('NARRATIVE: the engine still owns no combat verbs after GRANT_NODE ships — growth is not steering',
  <extends the existing "combat is observed, never steered" source-scan to also assert narrGrantNode's source contains no playCard/dealToEnemy/startFight/endTurn — a node UNLOCKING must never itself deal damage or alter a live fight>)`

`check('RUN: a full walk of the currently-playable story (prologue, an act-one victory, a death) leaves RUN.nodes exactly as story-granted as the beats fired — never more, never silently zero when a GRANT_NODE beat completed',
  <the harness-driven regression for the measurement in §1: fires NEW_GAME through the prologue, then every other signal socket; asserts RUN.nodes.length equals the count of GRANT_NODE effects among beats that actually completed this walk — today that number is correctly 0 because no shipped beat carries one; the day §3 ships, this check is what stops the wiring from rotting silently again>)`
