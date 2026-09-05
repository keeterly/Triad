'use strict';
// ── NO BACKTICKS INSIDE A SHADER ───────────────────────────────────────────
//
// Every shader in this layer lives in a JS template literal, so a backtick in a
// GLSL comment does not comment anything — it ENDS THE STRING. What follows is
// then parsed as JavaScript, and the failure of the day is decided by whether
// that leftover happens to be valid: if it is, `node --check` passes and the
// page throws at load; if it is not, the check catches it for the wrong reason.
//
// This has now happened five times. `check.sh` was written after one of them
// and still cannot see it, because parsing is the wrong instrument: the file is
// syntactically fine. The right question is not "does this parse" but "is there
// a backtick somewhere it can only be a mistake", and that needs a walk.
//
// So: track whether we are inside a template literal, and flag any backtick
// that appears inside a line comment while we are.
const fs = require('fs');
let bad = 0;
for (const file of process.argv.slice(2)) {
  const src = fs.readFileSync(file, 'utf8');
  let tpl = false, line = 1;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '\n') { line++; continue; }
    if (c === '\\') { i++; continue; }            // escaped anything
    // a line comment: read it whole, and judge it by where we are
    if (c === '/' && src[i + 1] === '/') {
      const end = src.indexOf('\n', i);
      const text = src.slice(i, end < 0 ? src.length : end);
      if (tpl && text.includes('`')) {
        console.error(file + ':' + line + ': backtick inside a shader comment — '
          + 'this ends the template literal\n    ' + text.trim().slice(0, 96));
        bad++;
      }
      i = (end < 0 ? src.length : end) - 1;
      continue;
    }
    // a block comment: skip it entirely, in or out of a template
    if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      const skipped = src.slice(i, end < 0 ? src.length : end);
      line += (skipped.match(/\n/g) || []).length;
      i = (end < 0 ? src.length : end + 1);
      continue;
    }
    if (c === '`') tpl = !tpl;
  }
  if (tpl) { console.error(file + ': ends inside a template literal — unbalanced backtick'); bad++; }
}
process.exit(bad ? 1 : 0);
