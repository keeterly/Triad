# ═══════════════════════════════════════════════════════════════════════════
# BATCH-EXPORT ANIMATIONS FROM UNREAL, WITH THE SETTINGS THIS PIPELINE NEEDS
# ═══════════════════════════════════════════════════════════════════════════
#
# Paste into Unreal's Output Log Python field, or run:
#     py "C:/path/to/Triad/v2.3/tools/export-anims.py"
#
# Set SOURCE and OUT below first. Run with LIST_ONLY = True to see what is in
# the pack before exporting any of it — a sword pack is often hundreds of
# sequences and this pipeline wants about ten.
#
# It writes the FBX files AND an `manifest.json` next to them, ready for:
#     node v2.3/tools/unreal.cjs import/manifest.json v2.3/art/cast/clips.json
#
# WHY A SCRIPT AND NOT AN MCP SERVER: an MCP server runs where the agent runs.
# This game's agent runs in a cloud container with no Unreal in it, so a local
# server on your machine is unreachable from there and exposing the editor to
# the internet is not a trade worth making. Running Claude Code locally would
# change that — but for batch export it would still be doing exactly this.
import unreal
import json
import os

# ── SET THESE ──────────────────────────────────────────────────────────────
SOURCE    = '/Game/SwordAnimationPack'      # content path of the pack
OUT       = 'C:/Triad/import'               # where the FBX should land
LIST_ONLY = True                            # True: print what is there, export nothing
ONLY      = []                              # export only these asset names; [] = all

# ── THE SETTINGS THAT MATTER ───────────────────────────────────────────────
#
# EXPORT PREVIEW MESH is the one that silently breaks everything downstream.
# three.js only creates real Bone objects when a skinned mesh is in the file;
# without it the importer traverses the scene, finds zero joints, and converts
# an animation into nothing. It also carries the bind pose, which is the frame
# every departure is measured from.
#
# The rest: binary not ASCII (the loader needs FBX 7.x), no axis conversion,
# and root motion LEFT WHERE IT IS — the importer folds it into the hips,
# which is where the game's layer expects travel to live.
def options():
    o = unreal.FbxExportOption()
    o.set_editor_property('ascii', False)
    o.set_editor_property('export_preview_mesh', True)
    o.set_editor_property('map_skeletal_motion_to_root', False)
    o.set_editor_property('force_front_x_axis', False)
    o.set_editor_property('level_of_detail', False)
    o.set_editor_property('collision', False)
    try:
        o.set_editor_property('fbx_export_compatibility',
                              unreal.FbxExportCompatibility.FBX_2018)
    except Exception as e:
        # PROPERTY NAMES DRIFT BETWEEN ENGINE VERSIONS. Rather than guess, say
        # so and carry on with the default — everything above matters more.
        unreal.log_warning('fbx_export_compatibility not set (%s). Run '
                           'help(unreal.FbxExportOption) to see this build\'s names.' % e)
    return o


def export(anim, path):
    task = unreal.AssetExportTask()
    task.set_editor_property('object', anim)
    task.set_editor_property('filename', path)
    task.set_editor_property('automated', True)      # no dialog per file
    task.set_editor_property('prompt', False)
    task.set_editor_property('replace_identical', True)
    task.set_editor_property('exporter', unreal.AnimSequenceExporterFBX())
    task.set_editor_property('options', options())
    return unreal.Exporter.run_asset_export_task(task)


def main():
    lib = unreal.EditorAssetLibrary
    if not lib.does_directory_exist(SOURCE):
        unreal.log_error('No such content path: %s — check SOURCE.' % SOURCE)
        return
    found = []
    for p in lib.list_assets(SOURCE, recursive=True, include_folder=False):
        asset = lib.load_asset(p)
        if isinstance(asset, unreal.AnimSequence):
            found.append((asset.get_name(), asset))
    found.sort(key=lambda x: x[0])

    if LIST_ONLY:
        unreal.log('%d animation sequences under %s:' % (len(found), SOURCE))
        for name, a in found:
            unreal.log('    %-44s %5.2fs' % (name, a.get_play_length()))
        unreal.log('Set LIST_ONLY = False (and ONLY = [...] to narrow) to export.')
        return

    os.makedirs(OUT, exist_ok=True)
    manifest, done = {}, 0
    for name, a in found:
        if ONLY and name not in ONLY:
            continue
        path = os.path.join(OUT, name + '.fbx').replace('\\', '/')
        if export(a, path):
            done += 1
            # The verb is a judgement call — a human names these — so the
            # manifest goes out keyed by asset name for you to rename.
            manifest[name] = {'file': 'import/%s.fbx' % name}
            unreal.log('  exported %s' % path)
        else:
            unreal.log_error('  FAILED %s' % name)

    mpath = os.path.join(OUT, 'manifest.json').replace('\\', '/')
    with open(mpath, 'w') as f:
        json.dump(manifest, f, indent=2)
    unreal.log('%d of %d exported. Manifest: %s' % (done, len(found), mpath))
    unreal.log('Rename its keys to the verbs the game speaks — parry, parryL, '
               'parryR, parryU, parryD, hurt, down, idle, sword — then run '
               'tools/unreal.cjs.')


main()
