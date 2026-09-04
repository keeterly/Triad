#!/bin/sh
# SYNTAX-CHECK THE LAYER AS WHAT IT ACTUALLY IS.
#
# `node --check cast3d.js` parses a .js file as CommonJS, and cast3d.js is an ES
# module — so `import` at the top should have failed it outright and instead it
# passed silently on a file whose `class Figure` was missing its closing brace.
# A gate that cannot fail is not a gate. Copying to .mjs makes node parse it the
# way the browser does.
set -e
d=$(mktemp -d)
for f in "$@"; do
  case "$f" in
    *cast3d.js|*.mjs) cp "$f" "$d/$(basename "$f" .js).mjs"; node --check "$d/$(basename "$f" .js).mjs" ;;
    *) node --check "$f" ;;
  esac
  echo "ok  $f"
done
rm -rf "$d"
