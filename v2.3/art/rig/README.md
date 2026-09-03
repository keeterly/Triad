# Rigging references

These are **not** game art. Nothing in the game loads them.

They exist because Meshy's auto-rigger fits a humanoid skeleton to a
silhouette, and two of the bestiary's paintings do not contain one: the Ashen
Cultist is a floor-length robe with no legs and a staff crossing the whole
frame, and the Silent Wraith is a hunched near-quadruped trailing a banner
wider than its body. Both came back with `skins: 0, joints: 0` twice, with and
without `pose_mode: 'a-pose'` — which retargets a skeleton the rigger found and
cannot invent one it did not.

So each was redrawn as a **standing A-pose**: same character, same palette,
same ink-wash rendering, same ornaments, but square to camera with the ankles
apart and a gap of background between each arm and the torso. Both rigged first
try, 24 joints, the same joint names as every other character.

The painted plates the player actually sees (`art/foe-*.webp`) are untouched.

Keep these files. If a creature's model is ever regenerated, this is the input
that works — regenerating from the painted plate will fail the same way again.
