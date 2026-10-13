const { app, BrowserWindow, session } = require('electron');
const path = require('node:path');

app.setName('Raincoil');
// Automation may not have access to normal per-user application storage.
// This opt-in test profile is never selected during an ordinary player launch.
if (process.argv.includes('--smoke-test') && process.env.RAINCOIL_TEST_PROFILE) {
  require('node:fs').mkdirSync(process.env.RAINCOIL_TEST_PROFILE, { recursive: true });
  app.setPath('userData', process.env.RAINCOIL_TEST_PROFILE);
}
app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: !/^(file|devtools|data|blob):/.test(details.url) });
  });
  const window = new BrowserWindow({
    show: !process.argv.includes('--smoke-test'),
    width: 1280, height: 880, minWidth: 900, minHeight: 700,
    title: 'RAINCOIL', backgroundColor: '#080b16', autoHideMenuBar: true,
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false }
  });
  window.setMenu(null);
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      event.preventDefault();
      window.setFullScreen(!window.isFullScreen());
    }
  });
  window.loadFile(path.join(__dirname, '..', 'index.html'));
});
app.on('window-all-closed', () => app.quit());
