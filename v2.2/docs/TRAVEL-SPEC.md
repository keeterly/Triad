# TRAVEL-SPEC — the descent map, measured against the best map in the genre

**Status:** design specification, v2.2 Build 38 era. Written after a source read
of the travel core (`generateDescent`, `_stretchTypes`, `_connect`, `mapAll`,
`mapNode`, `nodeReachable`, `showMap`, `drawMapEdges`, `enterMapNode`,
`resolveMapNode`, `onVictory`, `showEmberSpark`, `showBoonDraft`), and three
measurement rigs driven through the shipping harness (`test/harness.cjs`):
`probeA-legibility.cjs` (screenshots at four viewports + a portrait phone,
per-state computed styles, alpha-composited contrast, 14px-thumbnail pixel
distances), `probeB-routes.cjs` (200 generated maps × three roster/floor
configurations, path counts and fork honesty), and `probeC-traversal.cjs`
(transition timings and the tap chain from a won fight back onto the road).
Probes and screenshots live in the session scratchpad
(`map-phone-844x390.png` … `map-portrait-390x844.png`, `probeA-report.json`).

Slay the Spire's map is the best-read screen in the genre because it makes four
promises at a glance: you see the whole act, you know where you are, you know
where you can go, and every node type is unmistakable from its icon alone —
and it previews *nothing else*. That restraint is an information budget, not a
limitation. This spec measures KIZUNA's descent map against those four
promises, finds it keeps one of them, and specifies how to keep the other three
without spending a single new screen.

---

## 1 · What the map already does right, measured

**The whole act fits on one phone screen.** At every viewport tested —
844×390 and 667×375 landscape phones, 1024×768, 1280×800 — all 16 nodes of a
floor render fully inside the viewport, no horizontal scroll, strip 669×186px
on the 844×390 phone. StS *scrolls* its act map on a phone. This is the
descent's one structural advantage over the thing it is benchmarked against,
and everything below is constrained to not spend it.

**Where you stand is genuinely unambiguous.** `mn-current` is the brightest
coin on the chart (opacity 1, 48px coin, 2px gold ring, animated glow, bobbing
▾, label lit) and the walked road is a solid gold trail (`me-taken`, 0.85
alpha). Between `current` and any other state, 10 computed-style properties
differ. The four states (`mn-current` / `mn-reach` / `mn-done` / `mn-locked`)
differ pairwise by 8–10 properties each — the state machine is not the
problem.

**Transitions are instant.** `showMap()` to edges-drawn-and-node-clickable:
35–56ms. `enterMapNode(fight)` to hand rendered: 29–40ms (the 1250ms
`camIntro` settle is a deliberate establishing shot, not jank). Tapping the
victory overlay through to standing in the next node: 11ms of actual work. The
tap chain from a won ordinary fight to the next room is **3 taps** (VICTORY →
CONTINUE · spark → TAKE NONE · map → node), 4 after an elite (the boon draft
has no skip), plus a fixed 700ms beat before the victory overlay. StS is 2
taps (skip card reward → tap node). Three is acceptable; nothing below changes
the reward chain.

**The generator builds real routes.** Over 200 trio floor-1 maps: 10.85
distinct start→boss paths on average (solo: 6.5), 5.24 fork decisions per map,
and only 8% of forks offer successors that are all the same type. Critically,
**70–71% of forks change which node types remain reachable** — pick left and
you can still hit the mid-floor camp, pick right and you've routed past it.
The structure *contains* the planning game StS players play.

## 2 · What the map fails to do, measured

**The road ahead is invisible — so the 70% of honest forks are spent blind.**
Three findings compound into this:

- **Locked nodes erase their type.** `.wm-screen .map-node.mn-locked .mn-icon`
  overrides `color` to `rgba(216,200,170,0.42)` — one washed parchment tone for
  every type — beating the per-type tints at 1384–1389 of `styles.css` on
  specificity. Same for `mn-done` (`rgba(200,186,158,0.38)`). Alpha-composited
  and multiplied by the node opacity (0.5 locked / 0.62 done), every locked
  glyph sits at **1.52:1** contrast against its own coin and every done glyph
  at 1.56:1. WCAG's floor for meaningful graphics is 3:1. Only the boss
  (4.75:1) and gates (3.29:1) — the two deliberately exempted landmarks — are
  actually visible ahead of you. On the phone screenshot the twelve
  not-yet-reachable coins are dark discs on a dark painting; you cannot tell
  the mid-floor camp from an elite from a fight. StS shows every node's icon
  at full identity from row 1 — that is the *entire mechanism* of its route
  planning.

- **Future edges are painted at 0.12 alpha** (`me-future`,
  `rgba(232,220,196,0.12)`, 1.4px). On the phone screenshot they simply do not
  survive the painting. So even if you could read a distant camp, you cannot
  tell *which of the two open doors leads toward it*. The topology — the plan
  itself — renders below the noise floor of the background art.

- **Locked labels are `opacity: 0`** (`.wm-screen .map-node .mn-label`), their
  `title` attribute is `"?"`, and `title` is hover-only — dead on the game's
  primary (touch, landscape-locked) platform anyway.

Net effect, stated plainly: the player can plan **zero steps ahead**. Every
"choice" is made between one and three glowing coins whose consequences are
invisible, on a map whose generator was measured to make 70% of those
consequences real. The presentation throws away the information the generator
paid for.

**Node types don't survive thumbnail size even when lit.** Rendering all seven
types side by side in the reachable state and downscaling to 14px (the phone
renders glyphs at 10.5–12.6 physical px, so 14px is generous): the mean
per-pixel gray distance between **event `?` and camp `⌂` is 5.0** out of 255;
camp/recruit 7.5; event/recruit 9.1; fight/event 10.5. (Most-distinct pair for
scale: elite/boss at 17.3.) The rest-vs-mystery distinction — in StS the single
most consequential read on the map — is the *least* legible pair on this one.
Three of the seven types (elite `✸`, recruit `☉`, gate `✦`) are near-identical
gold-on-dark stars, and `✦` is simultaneously the ember-currency glyph in the
header, the tree button, and the coach line, so the map's own legend competes
with the wallet. Worse, the reachable state *replaces* the per-type rim tint
with one uniform gold ring (`.wm-screen .map-node.mn-reach .mn-icon` — measured:
fight, elite, event, camp, recruit all share `rgba(242,216,150,0.9)`), so at
the exact moment a node becomes a decision, its color identity is stripped to
glyph-only. A legend panel (`wm-legend`) exists to compensate; needing it is
the symptom.

**Labels are decorative at every size.** `mn-label` renders at 8.4px logical =
**5.3 physical px** on an 844×390 phone (the stage scales by 0.698), 5.1px on
an SE, 10.9px even at 1280×800 desktop. No human reads 5px type. They also
carry flavor, not information — "COLD PROCESSION" and "DRONE NEST" are both
fights; nothing on the map says the second is three drones. The map spends
33px of reserved height per node (a third of each node's footprint) on text
nobody can read.

**What a node costs is answered nowhere.** A fight node carries `n.enemies` —
the exact bodies you will face, already generated — and shows none of it, not
even the count. A recruit node knows *who* is waiting (`n.hero`) and hides it
behind an oblique label. An elite is distinguishable from a fight only by a
gold `✸` vs a parchment `⚔` at 12px. StS's budget is: type always, elite/rest
distinctly, contents never. This game currently shows *less* than that (type
only when reachable) while sitting on *more* generated information than StS
ever previews.

**Portrait is a wall, not a layout.** A touch device held upright gets the
rotate prompt (`#rotate-prompt` display:flex at 390×844, measured). That is a
deliberate whole-game decision and this spec does not fight it — but it means
"as readable as StS2's map on a phone" must be won at 390px of *height*, where
every physical pixel number above is what it is.

## 3 · The information budget, decided

The budget this map should run, in one paragraph: **every node's type is
readable in every state, from the first screen of the floor** — that is the
StS baseline and it is non-negotiable. **Reachable nodes additionally name
themselves and their price**: a fight shows its enemy count, a recruit shows
who, a camp shows that it heals, an elite warns and names its stake (boon +
curse draft), an event shows nothing (the `?` *is* the content — StS is right
about this). **Locked nodes never show contents, only type.** The boss and
gates stay named landmarks at all times, as they already are. Nothing else —
no HP predictions, no reward tables, no odds.

## 4 · The fix

### 4.1 Let the road ahead keep its identity — CSS only

In `styles.css`, **delete the `color` declarations** (keep the sizing) from
`.wm-screen .map-node.mn-locked .mn-icon` and
`.wm-screen .map-node.mn-done .mn-icon`, and **delete the flat
`.map-node.mn-done .mn-icon` / base locked color** overrides at 1361 — the
per-type tints at 1384–1389 then cascade into every state. Raise locked node
opacity from 0.5 to 0.72 and done from 0.62 to 0.55 (done should now read
*quieter* than the road ahead — it is the only set you can no longer use).
Depth still runs current → reach → locked → done, but by ring weight, size and
glow, not by destroying hue. Acceptance: every type's glyph in the locked
state ≥3:1 composited against its coin (probe A2 methodology).

Future edges: raise `me-future` to `rgba(232,220,196,0.30)`, width 1.6, and
add a fourth edge class in `drawMapEdges` — `me-next`, for edges *out of* the
currently reachable nodes, at 0.5 alpha dashed. The player's decision is
"which door", and the doors' own onward roads are the argument; one step of
consequence must be visibly attached to each choice.

### 4.2 One silhouette per type, heavier than a text glyph

The seven text glyphs go. Replace the `glyph` table in `showMap()` with
inline SVG marks (14px-safe, filled silhouettes, one per type), keeping the
existing hues: fight = crossed blades (filled), elite = the same blades over a
flame (elite must read as "a fight, but worse" — same family, escalated, the
StS burning-elite trick), event = `?` in a diamond (filled field, not a bare
glyph), camp = campfire triangle-flame (not a house — `⌂` reads "building"
and measured 5.0 gray-distance from `?`), recruit = a head-and-shoulders
figure (it is a *person*; the party is the premise), boss = skull (kept), gate
= arch/door (kept `✦` fails: three gold stars currently share the screen with
the ember wallet). Acceptance: minimum pairwise 14px gray distance across all
seven ≥ 12 (today's floor is 5.0; today's *best* pair is 17.3).

Then **delete the uniform gold rim on reachable coins** — in
`.wm-screen .map-node.mn-reach .mn-icon`, replace the fixed
`rgba(242,216,150,…)` ring with `box-shadow` driven by a per-type `--mn-tint`
custom property set in the same rules as the glyph colors. Reachability keeps
its pulse (`mn-pulse`), its glow and its size; it stops costing the node its
color. The `wm-legend` panel stays for now, but the test below asserts the map
is readable without hovering it, and once the silhouettes land it should be
retired to the pause menu.

### 4.3 Delete the on-map labels; add the door strip

**Delete `mn-label` from every node except boss and gates** (the two
landmarks). 5.3 physical px is not text, it is lint, and it reserves a third
of every node's height. The freed room raises the coin from 46 to 56px logical
(≈39 physical px on the 844×390 phone; the whole `.map-node` button must keep
≥60×60 logical so the touch target clears ~42 physical px).

Names and prices move to where they can be read: a **door strip** — a single
row of 1–3 compact cards under the map strip (class `.map-doors`, built in
`showMap()` from exactly the `mn-reach` set, which is never larger than 3).
Each card: the type mark + tint, the node's `label` at a size a human reads
(11px+ logical), and one line of price in the §3 budget — fight: "3 FOES" (from
`n.enemies.length`, plus the pack's dominant name: "DRONE NEST · 3 FOES");
elite: "ELITE · SPOILS & A PRICE"; recruit: the hero's name and portrait chip
(`V2PORTRAITS[n.hero]`); camp: "REST · HEAL & TEACH"; event: "?"; gate: its
destination (already named). Tapping a door card calls the same
`enterMapNode(mapNode(id))` the coin does; the coins stay tappable — two ways
in, one function. This adds zero taps to traversal and finally gives the
recruit decision (the roster *is* the run) a face.

`title="?"` on locked nodes is **deleted** — hover-only affordances are dead
on the target platform, and with labels gone the attribute serves nobody. The
compass relic (`mn-scried`) changes meaning: instead of un-hiding 5px labels
it upgrades locked fights' door-strip preview when they become reachable —
concretely, `hasRelic('compass')` adds the enemy names, not just the count,
and keeps its dashed ring on locked coins.

### 4.4 Kill the fake forks in `_connect`

Measured: **41% (solo) / 32% (trio) of forks re-merge to an identical
next-set one step later** — the player picks a door and both doors open into
the same hallway. In `_connect`, after wiring, detect sibling sources whose
target sets are identical where the next level has width >1, and re-deal one
of them (drop the shared extra target, or shift `base` by one). The forced
single-node levels (mouth, pre-boss camp, boss) are exempt — merging *there*
is the floor's shape. Acceptance: ≤10% of forks at levels whose successor
level has width >1 may share an identical next-set. Same-type-successor forks
are already at 8% and need no change. `generateDescent`'s level plan
(1 / branch / … / camp / boss) is untouched; this is wiring, not structure.

### 4.5 What is deliberately not changed

The reward chain (`onVictory` → spark → map) stays at 3 taps — it is the
game's build beat, and its timing measured clean. The painted-chart
presentation, the jitter (`--jx/--jy`, already bounded by Build 32), the fixed
`min-height` strip, the current-position treatment, the gold trail, the
landmark exemptions for boss and gates, and the one-way `nodeReachable` rule
(no backtracking — a locked sibling is a road not taken, and now you'll be
able to *see* what you're not taking) all stay exactly as shipped.

## 5 · Test invariants

In the voice of `test/flow.test.cjs` — each states intent, not implementation:

```js
check('MAP: the whole floor fits one phone screen — every node inside an 844×390 viewport, no scroll',
  nodesFullyVisible === nodesTotal && !anyHScroll);
check('MAP: the road ahead keeps its identity — a locked camp is the same hue as a reachable one',
  lockedCampHue === reachCampHue && lockedGlyphContrast >= 3.0);
check('MAP: becoming reachable never strips a node of its color — the elite ring is not the fight ring',
  reachEliteRing !== reachFightRing);
check('MAP: two node types survive thumbnail size — no pair closer than gray-distance 12 at 14px',
  minPairwiseGrayDistance >= 12);
check('MAP: you are exactly one place — one mn-current, and it is the brightest coin on the chart',
  currentCount === 1 && currentOpacity === 1);
check('MAP: a choice shows its consequence — every reachable node\'s outgoing edges render above the art',
  meNextEdges === reachOutDegreeSum && meNextAlpha >= 0.4);
check('MAP: a fight names its price before you commit — the door strip counts its enemies',
  doorFightText.includes(String(node.enemies.length)));
check('MAP: a recruit is a face, not a riddle — the door strip shows who is waiting',
  doorRecruitHasPortrait);
check('MAP: an event previews nothing — the ? is the whole answer',
  doorEventText.trim() === '?');
check('MAP: no fake forks — at most 1 in 10 branch choices re-merges identically one step later',
  fakeForkRate <= 0.10);   // measured 0.32–0.41 before the fix
check('MAP: a fork is still a fork — most choices change which node types the rest of the road can reach',
  typeChangingForkRate >= 0.60);   // the generator already earns 0.70; don't lose it
check('MAP: three taps from a won fight to the next room, and the map stands up in under 250ms',
  tapChain === 3 && showMapMs < 250);
```

## 6 · Summary of deletions

Deleted, and why: the `mn-locked`/`mn-done` glyph-color overrides in the
`wm-screen` block (they cost the map its future for a depth cue that opacity
and size already provide); the uniform gold reachable rim (it strips type
color at decision time); `mn-label` on all non-landmark nodes (5.3 physical px
is not communication); `title="?"` on locked nodes (hover-only, on a touch
game); the seven text glyphs (three are gold stars, and the two that matter
most measured 5/255 apart). Everything deleted is presentation; no graph,
save-shape, or reachability semantics change, which is the same boundary the
`wm-screen` block itself promised when it was introduced.
