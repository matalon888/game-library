/* The game does not need Node. This only tells the page that it is
   running as a desktop app, so it can label its own controls right. */
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("digDesktop", {
  isDesktop: true,
  platform: process.platform,
  electron: process.versions.electron,
  chrome: process.versions.chrome
});
