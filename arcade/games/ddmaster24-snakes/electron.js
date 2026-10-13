const { app, BrowserWindow } = require('electron');
const { createServer } = require('./server.js');

let serverHandle = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
    backgroundColor: '#000000',
    title: 'Snakes IO Game',
  });
  win.loadURL('http://localhost:3000');
}

app.whenReady().then(() => {
  serverHandle = createServer(3000); // desktop app hosts on :3000 (shareable on LAN)
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (serverHandle && serverHandle.close) serverHandle.close();
  if (process.platform !== 'darwin') app.quit();
});
