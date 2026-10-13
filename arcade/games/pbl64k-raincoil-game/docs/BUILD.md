# Building RAINCOIL

## Prerequisites

- Node.js 22.12 or newer (with npm). Check `node --version` and `npm --version`.
- For the Windows executable: Windows x64 and PowerShell 5.1 or newer. No compiler or global npm package is required.
- Internet access for the first Windows dependency/runtime download. Later builds reuse local caches.

Run commands from the repository root. Web development, web packaging, source packaging and rules tests need only Node.js; do not install Electron just to build the web game.

## Web and tests (any supported Node host)

```sh
node tools/serve.mjs
```

Open http://127.0.0.1:8080. Stop the server with Ctrl+C. Direct `file://` loading is unsupported because the browser uses ES modules.

In a second terminal:

```sh
npm test
npm run build:web
npm run build:source
```

The ZIPs appear in `dist/`, named using package.json's version, with SHA-256 sidecars. The web ZIP has index.html at its root and includes the license. Source packaging explicitly excludes local media, handoffs, caches and dependencies. Distributions are generated files and are not committed.

## Windows executable and both targets

```powershell
.\Build.ps1 -Install
```

This restores the committed lockfile, explicitly downloads the pinned Electron runtime, generates the launcher icon from source, and builds web/source ZIPs plus `dist/windows/Raincoil-0.3.0-Windows-x64.exe`. It bootstraps npm 11.6.0 locally to make the install path consistent. Caches and bootstrap tools are kept under `.cache/build/`, dependencies under `node_modules/`. No global tools are installed. First packaging also downloads electron-builder helper binaries.

Subsequent builds:

```powershell
.\Build.ps1
.\Build.ps1 -Target Windows
.\Build.ps1 -Target Web
.\Build.ps1 -Target Source
```

If PowerShell blocks the downloaded script, review it and run `powershell -NoProfile -ExecutionPolicy Bypass -File .\Build.ps1 -Install`; the override applies to that process. If multiple Node installations exist, pass `-NodePath 'C:\path\to\node.exe'`. Optional `-ToolsPath` selects another cache directory.

To install without the helper script:

```sh
npm ci
node node_modules/electron/install.js
npm start
npm run build:windows
```

Electron 44 requires the explicit runtime installation step. `npm start` and the Windows build command regenerate the icon automatically. The web build needs no runtime download.

The portable executable is self-contained and unsigned. It extracts its runtime to a temporary directory; players need no Node install or network. Settings use normal per-user application storage. Retain the Electron/Chromium notices if redistributing `dist/windows/win-unpacked/`.

## Optional browser and desktop integration checks

Rules tests (`npm test`) have no dependencies. Browser checks additionally need Playwright and a supported browser. Install Playwright locally without changing the project lockfile:

```sh
npm install --no-save --package-lock=false playwright
```

With Microsoft Edge installed, start the local server on port 8080, then:

```sh
node tests/browser-smoke.mjs
node tests/variants-browser.mjs
node tests/relaxed-browser.mjs
```

Alternatively install Chromium with `npx playwright install chromium` and set `BROWSER_CHANNEL=chromium`. `PLAYWRIGHT_PATH` optionally points to an existing Playwright module directory. Reports and captures are saved under `.cache/test-results/`.

After building both distributions, `node tests/distribution-smoke.mjs` checks the packaged iframe, native file equality and runtime notices. On Windows, `node_modules/electron/dist/electron.exe tools/smoke-desktop.cjs --smoke-test` checks the actual desktop host with a separate test profile.

The development automation environment could only exercise packaged Electron using `node tests/distribution-smoke.mjs --native-diagnostic`, which adds explicit `--no-sandbox --disable-gpu` flags and a test profile. This is a diagnostic, not normal launch validation. The shipped application's sandbox remains enabled. See [VALIDATION.md](VALIDATION.md).

## itch.io

Upload the web ZIP as an HTML project and mark it playable in-browser. Suggested manual viewport: 1280 by 960, with fullscreen enabled. Upload the Windows executable separately. Build commands do not publish anything.
