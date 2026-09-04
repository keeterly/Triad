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

## STATE: the tool refuses to write a corpse, and says which stage failed

The converter runs end to end on a real Mixamo FBX — naming detected, 22 of 22
joints mapped, stride scaled — and **the clip it writes is the rest pose**. Every
emitted quaternion is exactly `__rest`, constant across all 547 frames. Verified
three ways: the raw values at frames 0, 200 and 540 are byte-identical to
`__rest`; the departure-from-rest angle is 0.0° at every joint across 60 samples;
and the runtime retarget passes 16-19° per bone where milled clips pass 127-140°.

The tool now reports three separate numbers and **refuses to merge a clip that
converted to nothing**, because a corpse in the library is worse than a crash:

```
testsamba: CONVERTED TO NOTHING — clip 156.7°, rig 0°, output 0°.
  The clip holds motion but the RIG never moved: 0 of its rotation tracks
  name a node this tool did not find as a bone, so the mixer is animating air.
```

Read that as: the FBX's own tracks hold 156.7° of rotation, so the file is fine;
every one of those tracks binds to a node the tool holds as a bone, so **naming
is not the problem**; and yet the bones do not move when the mixer is asked for a
frame. The fault is between `mixer.update` and the bone objects, and the two
things already ruled out are the source data and the track-to-node binding.

`mixer.setTime(t)` and `action.time = t; mixer.update(0)` both produce it, so it
is not the way the clock is driven either.

**Do not use an imported clip until that line reads three non-zero numbers.**

### The guard was wrong first, in a way worth remembering

Its first version compared each track's FIRST keyframe against its LAST and
declared a samba motionless. The clip loops, so its last key *is* its first — and
it came back NEGATED, `(0.036, -0.298, 0, -0.954)` against
`(-0.036, 0.298, 0, 0.954)`, which is the same rotation written the other way
round, so the sign did not give it away either. It samples the middle against
both ends now.

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
