// Run: node_modules/electron/dist/electron.exe tools/smoke-desktop.cjs --smoke-test
// Exercises the actual secure desktop host; uses a separate disposable profile.
const { app } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const output = path.resolve(__dirname, '../.cache/test-results/desktop-smoke');
fs.mkdirSync(output, { recursive: true });
app.setPath('userData', path.join(output, 'profile'));
const errors = [], checks = [];
let finished = false;
function finish(code) {
  if (finished) return;
  finished = true;
  const runtimeFlags = {
    noSandbox: app.commandLine.hasSwitch('no-sandbox'),
    disableGpu: app.commandLine.hasSwitch('disable-gpu'),
    disableGpuSandbox: app.commandLine.hasSwitch('disable-gpu-sandbox'),
    argv: process.argv
  };
  const report = { passed: code === 0 && errors.length === 0, electron: process.versions.electron, runtimeFlags, checks, errors };
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  app.exit(report.passed ? 0 : 1);
}
const deadline = setTimeout(() => { errors.push('Desktop smoke timed out after 30 seconds'); finish(1); }, 30000);
deadline.unref();
app.on('browser-window-created', (_event, window) => {
  const contents = window.webContents;
  contents.on('console-message', (_event, levelOrDetails, message) => {
    const level = typeof levelOrDetails === 'object' ? levelOrDetails.level : levelOrDetails;
    const text = typeof levelOrDetails === 'object' ? levelOrDetails.message : message;
    if (level === 'error' || level === 3) errors.push('Renderer console: ' + text);
  });
  contents.on('did-fail-load', (_event, code, description) => { errors.push(`Load error ${code}: ${description}`); finish(1); });
  contents.on('render-process-gone', (_event, details) => { errors.push('Renderer gone: ' + details.reason); finish(1); });
  contents.once('did-finish-load', async () => {
    try {
      const evaluate = source => contents.executeJavaScript(source, true);
      async function check(name, expression) {
        if (!await evaluate(expression)) throw new Error('Failed: ' + name);
        checks.push(name);
      }
      async function waitFor(expression) {
        const until = Date.now() + 5000;
        while (!await evaluate(expression)) {
          if (Date.now() > until) throw new Error('Timed out waiting for: ' + expression);
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
      await waitFor('document.querySelector("#game")?.getBoundingClientRect().width > 100');
      await check('Node globals unavailable to renderer', 'typeof require === "undefined" && typeof process === "undefined"');
      await check('Canvas present at meaningful size', 'document.querySelector("#game").width > 100 && document.querySelector("#game").height > 100');
      await new Promise(resolve => setTimeout(resolve, 300));
      fs.writeFileSync(path.join(output, 'menu.png'), (await contents.capturePage()).toPNG());
      await evaluate('document.querySelector("#start-button").click()');
      await waitFor('document.querySelector("#menu").classList.contains("hidden")');
      checks.push('Storm starts');
      await new Promise(resolve => setTimeout(resolve, 500));
      await check('Game canvas draws multiple colors', `(() => {
        const canvas = document.querySelector('#game');
        const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        const colors = new Set();
        for (let i = 0; i < pixels.length; i += 160) colors.add(pixels[i] + ',' + pixels[i+1] + ',' + pixels[i+2]);
        return colors.size > 8;
      })()`);
      fs.writeFileSync(path.join(output, 'playing.png'), (await contents.capturePage()).toPNG());
      await evaluate('document.querySelector("#pause-button").click()');
      await check('Pause opens', '!document.querySelector("#pause-overlay").classList.contains("hidden")');
      await evaluate('document.querySelector("#resume-button").click()');
      await check('Resume closes pause', 'document.querySelector("#pause-overlay").classList.contains("hidden")');
      await evaluate('document.querySelector("#settings-button").click()');
      await check('Settings opens', 'document.querySelector("#settings").open');
      await evaluate('document.querySelector("#settings").close()');
      const prefs = contents.getLastWebPreferences();
      if (!prefs.sandbox || !prefs.contextIsolation || prefs.nodeIntegration) throw new Error('Desktop security preferences incorrect');
      checks.push(app.commandLine.hasSwitch('no-sandbox')
        ? 'Host CONFIGURES sandbox + context isolation and disables Node integration; --no-sandbox overrides runtime sandbox for this diagnostic'
        : 'Host configures sandbox + context isolation and disables Node integration; no --no-sandbox override');
      finish(0);
    } catch (error) { errors.push(error.stack || String(error)); finish(1); }
  });
});
require('../desktop/main.cjs');
