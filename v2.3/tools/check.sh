#!/bin/sh
# SYNTAX-CHECK THE LAYER AS WHAT IT ACTUALLY IS.
#
# `node --check cast3d.js` parses a .js file as CommonJS, and cast3d.js is an ES
# module — so `import` at the top should have failed it outright and instead it
# passed silently on a file whose `class Figure` was missing its closing brace.
# A gate that cannot fail is not a gate. Copying to .mjs makes node parse it the
# way the browser does.
#
# AND A GATE THAT PASSES ON NOTHING IS NOT A GATE EITHER. Called with no
# arguments this script used to run its loop zero times and exit 0, which is
# indistinguishable from a clean check — it reported success over a cast3d.js
# broken by a stray backtick inside a shader comment, and the fault only
# surfaced as a blank page four probes later. So: no arguments means check the
# layer, and an argument that names nothing is a failure.
set -e
cd "$(dirname "$0")/.."
[ "$#" -gt 0 ] || set -- cast3d.js game.js tools/unreal.cjs
d=$(mktemp -d)
for f in "$@"; do
  [ -f "$f" ] || { echo "no such file: $f" >&2; rm -rf "$d"; exit 1; }
  case "$f" in
    *cast3d.js|*.mjs) cp "$f" "$d/$(basename "$f" .js).mjs"; node --check "$d/$(basename "$f" .js).mjs" ;;
    *) node --check "$f" ;;
  esac
  echo "ok  $f"
done
rm -rf "$d"
