# Animation drop — 34 FBX from Unreal 5.8.2

Exported from the `ExportAnim` project over the Remote Control API. All are
**UE4 mannequin** (`Sequence1`, three-bone spine) and all are **FBX 2020**
(binary, version 7700) — not the FBX 2013 set that was handed over earlier.

Settings, per `import/README.md`: preview mesh **on**, ASCII off, Force Front
XAxis off, Map Skeletal Motion to Root **off**.

Two source packs, both on the UE4 rig:

- **Sword_and_Shield** — one-hand sword, for Ash
- **Dual_Sword** — paired blades, for Mira

## Measured before handover

Horizontal drift of the hips over the clip, in the game's units, and the
lowest foot. These were measured on the game's own rig after conversion, and
they are the reason several of these were exported but never shipped:

| file | drift | note |
|---|---|---|
| `parry_l`, `parry_r` | 0.03, 0.02 | stay on the tile |
| `daggers_heavy` | 0.92 | |
| `sword` (`attack_1`) | 1.50 | |
| `daggers` (`dual_attack_1`) | 1.12 | |
| `sword_heavy` | 2.16 | |
| `sword_combo` (`_All` chain) | ~4.5 | **wanders off the tile** |
| `daggers_combo` (`_All` chain) | 6.16 | **wanders off the tile** |
| `speed_all` (flurry) | 6.16 | **wanders off the tile** |

**Nothing here was checked for feet leaving the ground.** The grounding check
used only measured the *lowest* foot, so a clip that lifts both feet passed it.
That is the failure `tools/ground.mjs` was written for and these have not been
through it.

## What is what

### Sword_and_Shield — `/Game/Sword_and_Shield/Animations/Sequence1/...`

| file | source asset |
|---|---|
| `attack_1` | `02_Attack/01_Combo_Attack_01/Combo_Attack_01_01_Seq` |
| `attack_2` | `02_Attack/01_Combo_Attack_01/Combo_Attack_01_02_Seq` |
| `attack_3` | `02_Attack/01_Combo_Attack_01/Combo_Attack_01_03_Seq` |
| `sword_heavy` | `02_Attack/02_Combo_Attack_02/Combo_Attack_02_01_Seq` |
| `sword_combo` | `02_Attack/01_Combo_Attack_01/Combo_Attack_01_All_Seq` |
| `block_start` | `08_Hit/12_Block/Block_Start_Seq` |
| `block_loop` | `08_Hit/12_Block/Block_Loop_Seq` |
| `block_end` | `08_Hit/12_Block/Block_End_Seq` |
| `block_hit` | `08_Hit/12_Block/Block_Hit_Seq` |
| `parry_l` | `08_Hit/12_Block/Parry_L_Seq` |
| `parry_r` | `08_Hit/12_Block/Parry_R_Seq` |
| `death` | `08_Hit/Hit_Combat_Death_Seq` |
| `get_up` | `08_Hit/Get_Up_Combat_Seq` |
| `idle` | `01_Idle/Idle_Combat_Seq` |
| `idle_relaxed` | `01_Idle/Idle_Seq` |
| `walk_forward` | `03_Walk/Walk_Combat_Loop_F_0_Seq` |
| `walk_back` | `03_Walk/Walk_Combat_Loop_B_180_Seq` |
| `run_forward` | `04_Run/Run_Combat_Loop_F_0_Seq` |
| `run_back` | `04_Run/Run_Combat_Loop_B_180_Seq` |
| `jump_start` | `05_Jump/Jump_Combat_Start_0_Seq` |
| `jump_loop` | `05_Jump/Jump_Combat_Loop_0_Seq` |
| `jump_land` | `05_Jump/Jump_Combat_End_0_Seq` |
| `dodge_forward` | `06_Dodge/Dodge_Combat_F_0_Seq` |
| `dodge_back` | `06_Dodge/Dodge_Combat_B_180_Seq` |
| `roll_forward` | `07_Roll/Roll_Combat_F_0_Seq` |
| `turn_left` | `09_Turn/Turn_Combat_90_L_Seq` |
| `turn_right` | `09_Turn/Turn_Combat_90_R_Seq` |

### Dual_Sword — `/Game/Dual_Sword/Animations/Sequence1/...`

| file | source asset |
|---|---|
| `dual_attack_1` | `02_Attack/01_Combo_Attack_01/AS_Combo_Attack_01_01_Seq` |
| `dual_attack_2` | `02_Attack/01_Combo_Attack_01/AS_Combo_Attack_01_02_Seq` |
| `dual_attack_3` | `02_Attack/01_Combo_Attack_01/AS_Combo_Attack_01_03_Seq` |
| `daggers_heavy` | `02_Attack/02_Combo_Attack_02/AS_Combo_Attack_02_01_Seq` |
| `daggers_combo` | `02_Attack/01_Combo_Attack_01/AS_Combo_Attack_01_All_Seq` |
| `speed_all` | `02_Attack/08_Attack_Speed/01_Attack_Speed/AS_Attack_Speed_All_Seq` |
| `speed_loop` | `02_Attack/08_Attack_Speed/01_Attack_Speed/AS_Attack_Speed_Loop_Seq` |

## Two things learned the hard way

**A chain's later hits do not stand alone.** `Combo_Attack_01_02` and `_03`
begin in the crouch the previous hit left behind, so played on their own they
never stand up and the feet finish below the floor. Only `_01` of any chain,
or another chain's `_01`, opens from a neutral stance.

**No up or down parry exists.** Every one of the five packs carries `Parry_L`
and `Parry_R` and nothing else — 4,506 clips, no `Parry_U`, no `Parry_D`.

## There is much more where this came from

The full library is **4,506 sequences** across five packs — Sword_and_Shield,
Dual_Sword, Great_Sword, Scythe, Sword_Animations — each in a UE4 and a UE5
variant. Categories: Idle 98, Attack 594, Walk 1147, Run 1046, Jump 278,
Dodge 462, Roll 304, Hit 477, Turn 100. Anything in it can be exported to the
same spec on request.
