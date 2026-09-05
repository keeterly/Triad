# Bringing an Unreal (or Mixamo) animation onto this rig

```
mkdir -p import/                      # gitignored: source packs never ship
cp ~/packs/combat/Block_High.fbx import/
cat > import/manifest.json <<'J'
{ "parryU": { "file": "import/Block_High.fbx" } }
J
node v2.3/tools/unreal.cjs import/manifest.json v2.3/art/cast/clips.json
node v2.3/tools/rewindow.cjs v2.3/art/cast/clips.json
```

`unreal.cjs` reads **FBX** (what Unreal exports) and **GLB** alike, converts, and
merges into the existing library. `rewindow.cjs` then gives the new clip the same
beat and window rule as everything already in it.

Add `"clip": "Hit_Front"` to pick one animation out of a file that holds several
— the tool prints the names it found when the one you named is not there.

## Why the tool is small

The runtime retargeter is already general. `retarget()` in `cast3d.js` does not
compare skeletons; it computes each bone's **departure from a rest pose** and
replays that departure on the target's own rest:

```
D(b)   = A_s(b) · G_s(b)⁻¹
A_t(b) = D(b) · G_t(b)
```

That is orientation-agnostic — it does not care that Unreal's upper arm points
down a different axis than Meshy's. What it cannot guess is **which bone is
which** and **what the source skeleton's rest pose was**. This tool supplies
both, offline, and re-expresses the animation against `__rest`, the rest pose the
library already carries, so an imported clip enters as a peer of the milled ones.
Nothing at runtime changes and the library stays homogeneous.

## The bone map

| Unreal | ours |
|---|---|
| `pelvis` | `Hips` |
| `spine_01` / `_02` / `_03` | `Spine02` / `Spine01` / `Spine` |
| `spine_04`, `spine_05` (UE5) | folded onto `Spine` |
| `clavicle_l` → `hand_l` | `LeftShoulder` / `LeftArm` / `LeftForeArm` / `LeftHand` |
| `thigh_l` / `calf_l` / `foot_l` / `ball_l` | `LeftUpLeg` / `LeftLeg` / `LeftFoot` / `LeftToeBase` |
| `neck_01` | `neck` |
| `head` | `Head` |
| `root` | folded into the `Hips` position track |

Mixamo naming is recognised too, and the `mixamorig:` prefix is stripped.

**The spine is the trap.** Meshy's rig calls the *lowest* vertebra `Spine02` and
the highest `Spine` — `__parent` reads `Spine02 → Spine01 → Spine` going up.
Unreal counts the other way. Mapped by number rather than by position, every
imported torso would be inverted, and it would look like a bad retarget rather
than a bad table.

## What is dropped, and what that costs

Twist bones (`upperarm_twist_01`, `thigh_twist_01`) have no home on a 24-joint
rig. Dropping them flattens forearm roll: a sword that rotates in the hand
mid-swing will arrive rotating at the elbow instead. That is a real loss and it
is the price of the rig we have. IK bones and weapon sockets are drivers, not
anatomy, and belong nowhere.

## Stride is rescaled, not copied

The Mannequin is not our proportions, so a step measured in its centimetres is
the wrong number of ours. Hip height is the ratio the tool uses — it is what sets
how far a leg can reach — so a stride arrives as the same *fraction* of a stride
rather than the same distance. The scale factor is printed per clip.

## Licensing — check before you convert

A lot of Unreal Marketplace content is licensed under the Unreal Engine EULA,
which permits use **only in Unreal Engine projects**. Fab sells some content
under an engine-agnostic Standard License and some as Unreal-only. This game is
three.js, so a pack under UE-only terms cannot ship in it however good it is.
It is per-pack and worth checking first.

## STATE: verified. Imports land at 0.1° of the source.

End to end on a real Mixamo FBX (three's `Samba Dancing.fbx`): naming detected,
22 of 22 joints mapped, stride scaled 0.907, merged, loaded and played on the
party. `test/import.probe.cjs` compares how far every joint turns from its own
frame zero, on the source rig and on ours:

```
LeftForeArm    source 98.1°   ours 98.0°   gap 0.2°
RightHand      source 109.8°  ours 109.8°  gap 0.2°
Hips           source 60.4°   ours 60.4°   gap 0.1°
   …
mean gap 0.1°   worst 1.4°
```

The tool prints three readings per clip and **refuses to merge one that
converted to nothing** — a corpse in the library is worse than a crash:

```
testsamba  mixamo  22 bones  18.2s/547f  scale 0.907
           turns clip 156.7° rig 179.2° out 101°  (52 doubled bone names)
```

Read as: the FBX's tracks hold 156.7° of rotation, the rig moves 179.2° when the
mixer is asked for a frame, and 101° survives into the output. All three non-zero
is the pass condition.

### The bug that took five metrics to corner: two skeletons, one set of names

The converter wrote out the REST POSE — every emitted quaternion exactly
`__rest`, constant across all 547 frames — and every stage looked healthy while
it did it. Tracks bound. The mixer ran. The clip loaded, retargeted and played,
and the figure stood there translating on its hips track, intact and faintly
alive.

**An FBX can carry two skeletons whose bones share names.** This one has 52 such
names. `PropertyBinding.findNode` resolves a track to the FIRST it finds; a
`traverse` that writes `bones[o.name] = o` keeps the LAST. So the mixer posed one
skeleton and this tool sampled the other, which never moves — every departure came
out identity, and identity is exactly the rest pose.

Bones are resolved through `PropertyBinding.findNode` now, the way the animation
system resolves them, and the count of disagreeing names is reported so the trap
is visible rather than silent.

**The fidelity probe needs a fixture** and the packs are not in the repo, so it is
a probe rather than a suite check. Run it against whatever you imported:
`node v2.3/test/import.probe.cjs /import/YourClip.fbx yourverb`.

### Five invalid metrics, and why each failed

Worth reading before writing a sixth:

1. **World positions** — drove the *source* skeleton with a clip expressed
   against *our* rest pose: the exact mismatch the retarget exists to resolve.
   Errors larger than the limbs.
2. **Bone directions in world space** — added our characters' facing yaw to every
   segment. A yaw barely moves a vertical thigh and moves a horizontal arm by its
   full angle, so it read as an arm-specific bug that did not exist.
3. **Normalising by the hips' world quaternion** — Meshy's `Hips` bind is
   `(-0.49, -0.49, -0.58, 0.43)`; that is not a body frame. Every number worsened.
4. **Directions in a body-relative basis** — valid, and the wrong *question*:
   departure-based retargeting preserves relative motion, not absolute pose, so
   comparing poses measures the two rest poses against each other.
5. **Departure from an observed rest** — right question, but reading the rest by
   zeroing every weight left the action unable to pose the body afterwards, and
   the metric reported perfect agreement with a corpse.

What finally worked needs no rest pose and no common frame at all: measure how
far each joint has turned **from its own frame zero**, on each rig, and compare
those two angles. The angle of a rotation is unchanged by a change of frame, and
both rigs are playing the same performance, so frame zero means the same instant
on both. `test/import.probe.cjs` does this, and it refuses to report agreement
when our figure is not moving.

## Checking a conversion — the only comparison that means anything

Two commands, from the repo root and then from `v2.3/`:

```
node v2.3/test/trunk.probe.cjs attack_1,sword_heavy,idle_relaxed,death
node v2.3/test/pose.probe.cjs ash 31
```

The first reads the FBX and measures the angle of the pelvis-to-head line away
from the source's own up axis, per frame, taking the largest. The second does
the same on the game's rig after conversion. They should agree within about ten
degrees; the two skeletons have different proportions, so they will not agree
exactly.

Measured on the UE4 pack, source against converted:

| clip | source | converted |
|---|---|---|
| `attack_1` | 40° | 31° |
| `sword_heavy` | 50° | 55° |
| `death` | 88° | 93° |
| `idle_relaxed` | 4° | 11° |

**Nothing else is a valid comparison, and three things that look like one are
not.** Bone quaternions cannot be compared between two rigs that hold their
bones in different frames. How far a joint TURNED cannot either — the angle of
a rotation does not change when you change the frame you measure it in, which
is why the converter's own gate read healthy over a party folded in half. And
frame-invariance is not a property a retarget has: a conversion has to know
which way the source was standing, because that is the whole of what `R` is
for. A probe asserting the opposite shipped briefly and was wrong.

Where the head ends up over the hips is anatomy, and anatomy is the one thing
two skeletons share.

## R, and the two ways to get it wrong

    D = A · G_s⁻¹          the bone's turn, in the SOURCE's world
    D' = R · D · R⁻¹       the same turn, in OURS
    A_t = D' · G_t         applied to our rest pose

Both halves matter and each was shipped alone:

* **Without R** the departure arrives about the source's axes. Unreal is Z-up
  and this library is Y-up, so the party stood permanently hunched at 37° and a
  heavy swing folded the figure into a ball.
* **Measuring in each bone's own rest frame instead** — `G_s⁻¹ · A`, then
  `G_t · D` — needs no up axis and is also wrong, because the two rigs do not
  hold a bone the same way relative to the body it is in. A yaw about the
  source's spine came out as a pitch about ours, and the error grew with how
  much a clip yawed: attack clips carrying 110-169° of shoulder yaw arrived at
  roughly 2.5x their true trunk pitch, while an idle carrying 9° came through
  clean.
