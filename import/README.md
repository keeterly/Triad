# Drop exported animation FBX here

Source files for `v2.3/tools/unreal.cjs`. **Nothing in this folder is served to
players** — the game loads only `v2.3/art/cast/clips.json`, which is the derived
form (baked bone rotations, no mesh, no texture).

## Sending a pack that is already exported — copy, paste, done

If `v2.3/tools/export-anims.py` has already written the FBX and a
`manifest.json`, the whole handover is five commands. From a terminal in the
clone of this repo, with `<repo>` being wherever that clone lives:

**PowerShell (Windows)**

```powershell
cd <repo>
git checkout main
git pull
git checkout -b anim-dropbox
Copy-Item "$env:USERPROFILE\Documents\Unreal Projects\ExportAnim\Exported\kizuna\ue4\*" import\ -Recurse
git add -f import/
git commit -m "temp: animation pack for conversion"
git push -u origin anim-dropbox
```

**Git Bash / macOS / Linux** — same thing with a forward-slash path:

```bash
cd <repo>
git checkout main && git pull
git checkout -b anim-dropbox
cp -r "/c/Users/keete/Documents/Unreal Projects/ExportAnim/Exported/kizuna/ue4/." import/
git add -f import/
git commit -m "temp: animation pack for conversion"
git push -u origin anim-dropbox
```

Send the **ue4** folder, not ue5 — see the note further down about the spine.

`git add -f` is required: this folder is gitignored on purpose, so a pack can
never reach `main` by accident. The branch is the point — see below.

When the conversion has landed, delete it and the files go with it:

```
git push origin --delete anim-dropbox
git checkout main
git branch -D anim-dropbox
```

### If the push is rejected for size

GitHub refuses a single file over 100 MB and warns over 50. The ue4 folder is
about 47 MB in total across 23 files, so it goes through — but if one clip is
enormous, push the rest and say which one was left out rather than reaching for
Git LFS, which does not undo cleanly and is the thing this branch exists to
avoid.

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

See `v2.3/tools/README-import.md`. Two bugs that were open here are fixed and
worth knowing about, because both produced an import that looked healthy by
every number the tools reported:

* An imported clip arrived FLAT — the FBX carried two skeletons sharing bone
  names and the tool sampled the one the mixer never posed. `import.probe.cjs`
  covers it.
* Every rotation arrived about the WRONG AXES, because the departure from rest
  was measured in a frame the two skeletons do not share. Unreal is Z-up and
  this library is Y-up, so the party stood permanently hunched and a heavy
  swing folded the figure into a ball. `retarget.probe.cjs` covers it, by
  converting the same clip twice with the source stood on its side and
  requiring the two to agree.

After any import, run `node test/cast.test.cjs` — its BODY checks are the ones
that read the posed skeleton's real world positions, which is the one thing a
wrong frame cannot fake.
