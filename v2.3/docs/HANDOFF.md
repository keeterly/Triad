# KIZUNA v2.3 — session handoff

*Written 2026-11-01 at the end of a cloud session, for a Claude Code session
running locally on a Windows PC. Point the new session at this file first.*

## Where things stand

- Work happens on branch **`claude/kizuna-ability-system-7oyy2s`**. `main` is
  what GitHub Pages deploys; it is updated by mirroring the branch
  (`git push origin claude/kizuna-ability-system-7oyy2s:main`) only once a
  build is verified.
- **Build 241** (the Regent retune, below) is on the branch. Check
  `git log origin/main -1` against the branch to see whether it has been
  mirrored; the live build is `https://keeterly.github.io/Triad/version.json`.
- A build is bumped in three places, together: `V23_BUILD` in
  `v2.3/game.js`, every `?v=NN` in `v2.3/index.html` (4 of them), and
  `"v2.3"` in the repo-root `version.json` (a number).
- The repo-root `game.js` / `styles.css` are the old v1 game. **Never edit
  them.** Everything for this game is under `v2.3/`.

## Running things on Windows

From PowerShell in the repo root:

```powershell
git checkout claude/kizuna-ability-system-7oyy2s
git pull
npm install --no-save playwright http-server
npx playwright install chromium

cd v2.3
node test/flow.test.cjs        # any suite: flow line bond camp slice road beat music cast
```

- The harness now spawns its static server through a shell on Windows
  (`test/harness.cjs`); before Build 241 every suite died with ENOENT there.
- `tools/check.sh` (lint/parse check) is bash — run it from Git Bash, or run
  `node --check` on the file you changed.
- Never pipe a suite into `tail`/`Select-Object` when you need its pass/fail:
  it hides the exit code.
- This cloud container rendered at ~1.5–2 fps, so only one browser could run
  at a time and many timing checks were written to survive that. A real GPU
  should be several times faster; if a timing check now behaves differently,
  suspect the check before the game.

## What this session found (Builds 239–241 and the instruments)

**The run simulator was wrong for ~180 builds.** `test/run.sim.cjs` read only
each road node's `foe`. Event nodes have no `foe`, and `startCombat` defaults a
missing foe to the Mourning Regent — so every simulated crossroads was a fight
against the **final boss**. Packs were simulated as one creature. This is the
sim that owns the run-difficulty gates. Fixed: events apply a real pick's `fx`
exactly as `takeEvent` does; packs fight as packs.

Corrected, the road read **15.0 / 72.5 / 97.5%** (no / half / excellent
parry) against gates of 0–6 / 8–45 / 65–100. `pace.sim.cjs` — which plays the
real road and never had the bug — agreed once it routed the same way
(`PACE_ROUTE=runsim`: 60% at clumsy). With random routing it reads 32.5%:
**route choice alone swings an average run ~30 points**, mostly through
whether you visit the fire when hurt.

**The Regent was the least dangerous fight on the road.** A half-parry party
that reached her won 29/31; an excellent one left with 85/112. Build 241:
her `dmgMul` 1 → **1.9**, her phase-2 dirge 3 → **4**. Corrected road:
**0 / 47.5 / 97.5%**, and she now kills 12 of 31 half-parry parties — the
largest share of deaths on the road. Above 1.9 the same 19/40 parties win on
the same seeds and survivors only lose margin, so it stops there. The
half-parry run ceiling was re-derived 45 → 50 (45 was fitted to the broken
sim) and `balance.sim`'s fresh-party half band became a ceiling (0–40):
nobody meets her with a starter deck.

**Two hypotheses this session tested and refuted** — worth knowing before
anyone proposes them again:
- *"The card layer is decoration."* No. `test/skill.probe.cjs`: same seeds,
  same parry, greedy vs random card play — **61.7% vs 38.3%** at half parry
  against the Regent. In ordinary fights card skill never changes the outcome
  but is worth ~6 HP each. Thin (1.56 real contenders a turn,
  `combo.probe.cjs`), not decoration.
- *"Half the enemy turn is dead air."* No. `test/tail.probe.cjs`: the 2.1 s
  tail after the last ring is 2056 ms of readable content (numbers, the dirge
  sweep, the draw) and 11 ms dead. `turnbudget.cjs`'s "nothing to play 49%"
  is about input, not the screen.

**Other instrument fixes:** `feel.playtest.cjs` kept playing fights that had
already ended (it checked `C.over`, which the engine never sets — a finished
fight is `phase === 'VICTORY' | 'DEFEAT'`) and counted "live combos" in the
opening hand, where FOLLOW_UP can never be live.

**Builds 239–240 (shipped):** the camera follow is a critically-damped spring
(first-frame speed 1.00 → 0.394 of peak); `.k-frozen` no longer freezes the
damage numbers and deflect it exists to show; sword hits throw `fall` debris;
the all-out dim lifts before the heroes act; the boss intro is staged in four
beats; and `--serif` / `--ui` are finally defined (the game had been set in
two serifs).

## Open items

1. **Known-flaky check:** cast's `LENS: …without fogging the picture` read
   fog 0.82 (fail) then 0.36 (pass) on the identical tree; its gate of 0.6 sits
   inside its own noise. Suspected source: the Build 238 quality governor
   changing render scale mid-measurement. Sample it properly (10+ runs) before
   changing the gate.
2. **Formatting:** the font family is unified; the size ramp is not. 41
   distinct font sizes, ~20 of them one-offs within half a pixel of a real
   step; radii scattered 0–9 px. Several were fitted to a specific box, so
   verify each screen rather than snapping blind.
3. **Excellent parriers still beat the Regent comfortably** (76/112 left).
   That is the design's stated thesis ("mastery is decisive"), not a bug — but
   it is the top of the curve with no challenge, and a future decision.
4. **`docs/THE-BENCHMARK.md` is stale** — last re-measured around Build 70.
   Its tables predate the run-sim fix.

## Working conventions that held up

- Measure the mechanism before changing a number, and prove a check can fail
  (run it against the old code) before trusting it.
- When a threshold's premise changes, re-derive it and write down why beside
  it; when an instrument cannot answer, say so rather than tuning it.
- A check that waits a fixed wall-clock time is a check that depends on the
  machine. Wait for the state instead.
