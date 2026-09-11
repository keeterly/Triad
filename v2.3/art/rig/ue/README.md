# Unreal-ready Ash rig

`SK_Ash.fbx` is `../../cast/ash.glb` rebuilt so Unreal animation packs can drive it.

**This does not replace `art/cast/ash.glb`.** The web game still loads that file, and
`art/cast/clips.json` drives it through the original 24 Meshy joint names
(`Hips`, `LeftArm`, `Spine02`, `head_end` …). This FBX uses UE Mannequin names
(`pelvis`, `upperarm_l`, `spine_01` …) and shares only one name with them, so
swapping it in would break all 19 web clips. Keep both.

## What changed vs ash.glb

| | ash.glb | SK_Ash.fbx |
|---|---|---|
| Bones | 24 | 76 |
| Root | none | `root` at origin |
| Spine | `Hips→Spine02→Spine01→Spine` (inverted names) | `pelvis→spine_01→spine_02→spine_03` |
| Fingers | 0 | 30 (5 per hand × 3) |
| Twists | 0 | 16 |
| IK bones | 0 | 7 |
| Pivot | off by X+10.1cm Z+9.3cm | centred, feet symmetric ±0.1726 |
| Ground | floating | Z range 0.0 → 1.75 |
| Bone tails | 13–40 m garbage | rebuilt, 0.014–0.40 m |
| Baked anim | 72 channels | stripped |

`head_end` held 5,786 weighted verts (the whole head/hair); its weights were merged
into `head` before removal.

## Verified against the 9CG one-hand Sword Animation Pack

UE 5.8, source skeleton `UE4_Mannequin_Skeleton` (what the pack's 1,190 sequences use).

- UE auto-characterisation derived **identical chains** for this rig and the UE4 Mannequin
  — 21 chains, same start/end bones, retarget root `pelvis`.
- IK Retargeter mapped **21/21 chains** exactly.
- 10 clips batch-retargeted: **10/10** correct skeleton, **10/10** matching duration,
  **10/10** carrying real rotation (attacks 112–137° upperarm, 60–349° hand).
- Finger chains receive animation where the source has it (39.5° on `index_01_r`
  in the grip transition).

## Import settings
Skeleton **None**, Import Animation **off**, **uncheck** "Convert Scene Unit"
(mesh is in metres; UE scales ×100). UE 5.8 routes this through Interchange.

Expect one benign warning: `BindPose Matrix ... FbxCluster vs FbxPose`.

## Not fixed
Twist and finger bones carry no skin weights — they exist so UE animation drives them
without error, but they do not deform. The sword is fused into the body mesh (one
material, not socketable). UVs remain a shredded auto-atlas; base colour only.
