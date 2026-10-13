/* ============================================================
   Desktop shell for Dig for Bharat.

   The game is ES modules with an import map, which Chromium will
   not load over file:// — so the app registers its own standard
   scheme and serves the project directory through it. No local
   port is opened and nothing is bundled or copied at build time.
   ============================================================ */
const { app, BrowserWindow, protocol, net, Menu, shell, dialog } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ROOT = path.join(__dirname, "..");
const DEV = process.argv.includes("--dev");
const SELFTEST = process.argv.includes("--selftest");
const PLAYTEST = process.argv.includes("--playtest");
const DIAGLIFT = process.argv.includes("--diaglift");
const FILM = process.argv.includes("--film");
const SCHEME = "app";
const ORIGIN = SCHEME + "://dig-for-bharat";

protocol.registerSchemesAsPrivileged([{
  scheme: SCHEME,
  privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true }
}]);

let win = null;

function serveProject() {
  protocol.handle(SCHEME, (request) => {
    let rel;
    try { rel = decodeURIComponent(new URL(request.url).pathname); }
    catch { return new Response("Bad request", { status: 400 }); }
    if (rel === "" || rel === "/") rel = "/index.html";

    /* keep the handler inside the project directory */
    const target = path.normalize(path.join(ROOT, rel));
    if (target !== ROOT && !target.startsWith(ROOT + path.sep))
      return new Response("Forbidden", { status: 403 });

    const res = net.fetch(pathToFileURL(target).toString());
    if (process.argv.includes("--trace")) res.then(
      (r) => console.log("  serve", rel, r.status, r.headers.get("content-type")),
      (e) => console.log("  serve FAIL", rel, e.message));
    return res;
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: FILM ? 1280 : 1440, height: FILM ? 760 : 900, minWidth: 900, minHeight: 560,
    title: "Dig for Bharat",
    backgroundColor: "#100C09",
    show: false,
    autoHideMenuBar: process.platform !== "darwin",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false      // a game should not stutter when it loses focus
    }
  });

  win.once("ready-to-show", () => {
    if (!SELFTEST && !PLAYTEST && !DIAGLIFT) win.show();
    if (DEV) win.webContents.openDevTools({ mode: "detach" });
  });
  win.loadURL(ORIGIN + "/index.html" + (SELFTEST || PLAYTEST || DIAGLIFT || FILM ? "?probe=1" : ""));
  if (FILM) runFilm();
  else if (SELFTEST || PLAYTEST || DIAGLIFT) runSelfTest(DIAGLIFT ? "diaglift.js" : PLAYTEST ? "playtest.js" : "selftest.js");

  /* stay inside the app; anything external opens in the real browser */
  win.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith(ORIGIN)) { e.preventDefault(); shell.openExternal(url); }
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(ORIGIN)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.on("closed", () => { win = null; });
}

function go(page) { if (win) win.loadURL(ORIGIN + "/" + page); }

/* `electron . --selftest` builds a world in the real desktop runtime,
   digs a clue target out of the ground, prints what happened and quits.
   Runs without showing a window, so it works in CI or over a shell. */
function runSelfTest(file) {
  const fs = require("node:fs");
  const script = fs.readFileSync(path.join(__dirname, file || "selftest.js"), "utf8");

  win.webContents.on("did-fail-load", (_e, code, desc, url) =>
    console.error("did-fail-load", code, desc, url));
  setTimeout(() => { console.error("\nHARD TIMEOUT - nothing came back\n"); app.exit(2); }, 90000);

  win.webContents.once("did-finish-load", async () => {
    console.log("did-finish-load fired; injecting probe");
    let out;
    try { out = await win.webContents.executeJavaScript(script, true); }
    catch (e) { out = { error: "executeJavaScript failed: " + e.message }; }
    console.log("\n=== Dig for Bharat - desktop self-test ===");
    console.log(JSON.stringify(out, null, 2));
    const ok = out && !out.error && (out.found > 0 || out.rounds || out.trace);
    console.log(ok ? "\nPASS\n" : "\nFAIL\n");
    app.exit(ok ? 0 : 1);
  });
  win.webContents.on("console-message", (e) => {
    if (e.level === "error" || e.level === 3) console.error("renderer:", e.message);
  });
  win.webContents.on("render-process-gone", (_e, d) => {
    console.error("renderer gone:", d.reason);
    app.exit(1);
  });
}

function buildMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    ...(isMac ? [{ role: "appMenu" }] : []),
    {
      label: "Excavation",
      submenu: [
        { label: "The Trench (first person)", accelerator: "CmdOrCtrl+1", click: () => go("index.html") },
        { label: "Section View (2D record)", accelerator: "CmdOrCtrl+2", click: () => go("section.html") },
        { type: "separator" },
        {
          label: "Reset all progress…",
          click: async () => {
            const { response } = await dialog.showMessageBox(win, {
              type: "warning", buttons: ["Cancel", "Reset"], defaultId: 0, cancelId: 0,
              message: "Reset all progress?",
              detail: "Every season you have filed will be cleared and you will start again at Rakhigarhi."
            });
            if (response !== 1) return;
            await win.webContents.executeJavaScript("try{localStorage.clear()}catch(e){}; location.reload();");
          }
        },
        { type: "separator" },
        isMac ? { role: "close" } : { role: "quit" }
      ]
    },
    {
      label: "View",
      submenu: [
        { role: "togglefullscreen" },
        { role: "reload" },
        { type: "separator" },
        { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" },
        ...(DEV ? [{ type: "separator" }, { role: "toggleDevTools" }] : [])
      ]
    },
    {
      label: "Help",
      submenu: [{
        label: "How a season works",
        click: () => dialog.showMessageBox(win, {
          type: "info",
          message: "How a season works",
          detail: [
            "1. Read the clue. It stays on screen; press J for the full notebook.",
            "2. Find the landmark it names — the burnt ground, the hollow, the stack of stones.",
            "3. Hold the left mouse button to dig. The block cracks as it goes.",
            "4. Depth is the answer, not a hint. A find only appears at the depth its layer says.",
            "5. When something appears, switch to the brush. The pick will break it.",
            "",
            "Right-click puts spoil back. G sieves it at the station by the datum peg.",
            "Stuck? The magnetometer gives a bearing.",
            "",
            "Every object and every note in this game is real."
          ].join("\n")
        })
      }]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* Grab the window a frame at a time while a scripted playthrough runs.
   The game is advanced by exactly 1/30 s per captured frame, so the
   result plays back smoothly no matter how slow capturePage is. */
function runFilm() {
  const fs = require("node:fs");
  const FRAMES = parseInt(process.env.FILM_FRAMES || "1000", 10);
  const dir = path.join(ROOT, "film");
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });

  win.webContents.once("did-finish-load", async () => {
    try {
      const script = fs.readFileSync(path.join(__dirname, "film.js"), "utf8");
      await win.webContents.executeJavaScript(script, true);
      const info = await win.webContents.executeJavaScript("window.__film.setup()", true);
      console.log("filming: landmark " + info.landmark + ", find at " + info.depth + " m");
      for (let i = 0; i < FRAMES; i++) {
        await win.webContents.executeJavaScript("window.__film.tick()", true);
        const img = await win.webContents.capturePage();
        fs.writeFileSync(path.join(dir, "f" + String(i).padStart(5, "0") + ".png"), img.toPNG());
        if (i % 100 === 0) console.log("  frame " + i + " / " + FRAMES);
      }
      console.log("done: " + FRAMES + " frames in film/");
      app.exit(0);
    } catch (e) {
      console.error("film failed:", e.message);
      app.exit(1);
    }
  });
}

app.whenReady().then(() => {
  serveProject();
  buildMenu();
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
