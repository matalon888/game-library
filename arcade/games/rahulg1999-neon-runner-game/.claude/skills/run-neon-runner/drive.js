#!/usr/bin/env node
/* Ad-hoc driver for Neon Runner — loads the REAL index.html (classic <script> tags, real
   global scope, real THREE.js) against a running `node server.js`, using jsdom + a
   stubbed WebGL2 context (see ../../../test/harness.js), then evaluates one JS
   expression inside the game's own global scope and prints the JSON result.

   This is for interactive one-off poking. For anything you'll run more than once, write
   a small script under test/ following the existing suites instead — see SKILL.md.

   Usage:
     node server.js &                          # from the project root, once
     node .claude/skills/run-neon-runner/drive.js "<js expression>"

   Examples:
     node .claude/skills/run-neon-runner/drive.js "state"
     node .claude/skills/run-neon-runner/drive.js "startGame(); state"
     node .claude/skills/run-neon-runner/drive.js "showView('armoury'); \$('shopList').children.length"
     node .claude/skills/run-neon-runner/drive.js "botCount=3; JSON.stringify(Object.keys(MAPS))"

   The expression runs via window.eval AFTER the game has fully booted (all 11 js/*.js
   files executed, THREE.js loaded, first frame warmed up) — see loadGame() in
   test/harness.js for exactly what "booted" means and how long it waits.

   Frame-render errors (WebGL calls the stub doesn't implement — bloom passes etc.) are
   caught by the game's OWN try/catch in loop() and printed as "Frame error: ...". They
   are expected noise, not a driver failure: game LOGIC (state, P, GUNS, MAPS, UI
   builders) runs to completion every frame regardless, because update() is called before
   render() inside that try block. See "Why jsdom, not a real browser" in SKILL.md. */
const path = require('path');
const { loadGame } = require(path.join(__dirname, '..', '..', '..', 'test', 'harness.js'));

async function main() {
  const expr = process.argv[2];
  if (!expr) {
    console.error('usage: node drive.js "<js expression>"');
    process.exit(2);
  }
  const url = process.env.NEON_RUNNER_URL || 'http://localhost:8080/';
  const { window, errors } = await loadGame({ url });
  if (errors.length) {
    console.error('load errors:', errors.length);
    errors.forEach(e => console.error(' -', (e && e.stack) || e));
  }
  let result;
  try {
    result = window.eval(expr);
  } catch (e) {
    console.error('EXPRESSION THREW:', e.message);
    process.exit(1);
  }
  try {
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.log(String(result));   // result wasn't JSON-serialisable (a function, a THREE object, ...)
  }
  process.exit(0);
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
