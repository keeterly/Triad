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

## STATE: it runs, and the clip arrives FLAT — a real bug, precisely located

Verified end to end against a real Mixamo FBX (three's `Samba Dancing.fbx`):
naming detected, 22 of 22 joints mapped, stride scaled 0.907, merged, loaded and
played on all three heroes without error.

**But the rotations never reach the rig.** Measured with `test/import.probe.cjs`:

| clip | rotation surviving the runtime retarget |
|---|---|
| `hurt` (milled) | 127-140° per bone over 50 frames |
| `parryU` (authored) | 297-299° per bone over 27 frames |
| **`testsamba` (imported)** | **16-19° per bone over 547 frames** |

The imported clip is essentially the rest pose with jitter. The figure translates
— the `Hips.position` track works — so it *looks* intact and slightly alive,
which is exactly why five earlier readings were confusing. It is not animating.

The JSON itself is fine: 4934° of authored rotation, tracks named, typed and
sized identically to the clips that do work. So the loss happens between the file
and the mixer, in `retarget()` — and the shape of the loss (departure ≈ identity)
says the tool is emitting locals that already equal `__rest`, i.e. **its own
accumulation and `retarget`'s disagree somewhere.** The prime suspect is the
localisation step in `unreal.cjs`: when a bone's parent is absent from `At` it
falls back to treating that bone as a root, while `retarget` accumulates through
the parent's REST instead. Any disagreement in that chain collapses the
departure.

**Do not use an imported clip in the game until the table above shows the
imported row in the same range as the other two.**

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
