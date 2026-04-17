const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,

  onUpdateReady: (callback) => {
    ipcRenderer.on('update-ready', (_event, ...args) => callback(...args));
  },

  // Open a URL in the system default browser
  openExternal: (url) => ipcRenderer.send('open-external', url),
});
