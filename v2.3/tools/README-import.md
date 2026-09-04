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

## STATE: it runs; fidelity is NOT yet proven

Verified end to end against a real Mixamo FBX (three's `Samba Dancing.fbx`):
naming detected, 22 of 22 joints mapped, stride scaled 0.907, merged, loaded by
the game and played on all three heroes **without error and without visible
disfigurement** — the figure stands intact, which is the main failure mode of a
bad retarget.

**Whether the resulting pose actually matches the source is unmeasured.** Three
attempts at that metric were all invalid:

1. Comparing world positions — drove the *source* skeleton with a clip expressed
   against *our* rest pose, which is precisely the mismatch the retarget exists
   to resolve. Errors larger than the limbs, confidently produced.
2. Comparing bone directions in world space — added our characters' facing yaw
   to every segment. The legs and spine reported 16-26°, which is about the size
   of that yaw; the arms reported 72-97°, which is not.
3. Normalising by the hips' world quaternion — Meshy's `Hips` has a bind
   orientation of `(-0.49, -0.49, -0.58, 0.43)`, so dividing by it is not a body
   frame. Every number got worse.

**The next step** is a metric that is independent of both proportion and
orientation: evaluate the converted clip on a skeleton whose rest *is* `__rest`,
in isolation from any character and any yaw, and compare segment directions
against the source in a frame anchored on the hips-and-shoulders triangle rather
than on any single bone's bind quaternion. Reading (2) is the one worth chasing:
if the arms really are wrong while the legs are right, it is arm-specific and
findable. Do not trust an imported clip in the game until that reads clean.
