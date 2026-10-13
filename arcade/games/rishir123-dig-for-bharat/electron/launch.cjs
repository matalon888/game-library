/* ============================================================
   Launcher.

   Terminals spawned by Electron-based editors (VS Code, Claude
   Code, Atom's descendants) export ELECTRON_RUN_AS_NODE=1 for
   their own tooling. Inherit that and Electron boots as plain
   Node: no app, no BrowserWindow, and `require("electron")`
   hands back the path to the binary instead of the API. So the
   launcher strips it before spawning.
   ============================================================ */
const { spawn } = require("node:child_process");
const path = require("node:path");
const electron = require("electron");        // npm shim: absolute path to the binary

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.ELECTRON_NO_ATTACH_CONSOLE;

const args = [path.join(__dirname, "..")].concat(process.argv.slice(2));
const child = spawn(electron, args, { stdio: "inherit", env, windowsHide: false });
child.on("close", (code) => process.exit(code === null ? 1 : code));
