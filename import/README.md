# Drop exported animation FBX here

Source files for `v2.3/tools/unreal.cjs`. **Nothing in this folder is served to
players** — the game loads only `v2.3/art/cast/clips.json`, which is the derived
form (baked bone rotations, no mesh, no texture).

## Handing a pack over so it can actually be deleted again

This folder is **gitignored**, so a pack cannot reach `main` by accident. To pass
one over, put it on a side branch that never merges:

```
git checkout -b anim-dropbox
git add -f import/Block_High.fbx
git commit -m "temp: sword pack sample for conversion"
git push -u origin anim-dropbox
```

Once it is converted, delete the branch — `git push origin --delete
anim-dropbox` — and the commit becomes unreachable and is garbage-collected.

**This is the only route that undoes cleanly.** Committing to `main` and
deleting the file later removes it from the working tree but NOT from history:
the blob stays in every clone and remains downloadable from GitHub. Getting it
out of `main` afterwards needs a history rewrite and a force push, which is a
much worse afternoon than using a branch in the first place.

## Exporting from Unreal

**Easiest: run the script.** `v2.3/tools/export-anims.py` batch-exports with the
right settings and writes a `manifest.json` beside the FBX. Set `SOURCE` and
`OUT`, and leave `LIST_ONLY = True` for the first run to see what is in the pack
— these run to hundreds of sequences and this pipeline wants about ten. Then set
`ONLY = [...]` to the ones you want and `LIST_ONLY = False`.

In Unreal: **Output Log → the Python field at the bottom** →
`py "C:/path/to/Triad/v2.3/tools/export-anims.py"`. If that field is not there,
enable **Edit → Plugins → Python Editor Script Plugin** and restart.

**By hand, if you prefer:** Content Browser → select the animation sequences →
right-click → **Asset Actions → Export…** → FBX.

| setting | value | why |
|---|---|---|
| Export Preview Mesh | **ON** | three's FBX loader only creates real `Bone` nodes when a skinned mesh is present. Without it the importer sees zero joints. It also carries the bind pose, which every departure is measured from. |
| FBX Compatibility | 2018 or 2020 | the loader needs FBX 7.x |
| ASCII | OFF | binary only |
| Force Front XAxis | OFF | |
| Map Skeletal Motion to Root | OFF | root motion is folded into the hips by the importer, which is where the layer expects travel to live |

If a pack ships both **UE4 mannequin** and **UE5 Manny** versions, send the UE4
one: its three-bone spine maps one-to-one onto ours, where Manny's five folds
onto three and loses a joint.

Prefer in-place variants over root-motion ones — the slot system already decides
where people stand.

## Then

```
node v2.3/tools/unreal.cjs import/manifest.json v2.3/art/cast/clips.json
node v2.3/tools/rewindow.cjs v2.3/art/cast/clips.json
```

with a manifest naming each file against the verb it should become:

```json
{ "parryU": { "file": "import/Block_High.fbx" },
  "hurt":   { "file": "import/Reactions.fbx", "clip": "Hit_Front" } }
```

See `v2.3/tools/README-import.md` — and note the open bug recorded there: an
imported clip currently arrives flat. Do not trust one in the game until
`v2.3/test/import.probe.cjs` reads clean.
