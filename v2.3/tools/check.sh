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
#
# ── AND PARSING IS NOT THE ONLY QUESTION ──────────────────────────────────
#
# A backtick inside a shader comment ends the template literal, and whether
# that is a syntax error depends on whether the JavaScript left over happens
# to parse. Sometimes it does — and then this script says ok and the page
# throws at load. `shaderlint.cjs` asks the question parsing cannot.
#
# ── AND DO NOT PIPE THIS TO `tail` ────────────────────────────────────────
#
# `check.sh f | tail -1` reports TAIL's exit status, which is always 0. Every
# gate in here is invisible through a pipe; the failure that prompted this
# note was read as a pass for exactly that reason. Run it plainly, or use
# `set -o pipefail`.
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
  case "$f" in
    *cast3d.js) node tools/shaderlint.cjs "$f" ;;
  esac
  echo "ok  $f"
done
rm -rf "$d"
