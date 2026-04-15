const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  /** The current OS platform (e.g. 'win32', 'darwin', 'linux') */
  platform: process.platform,

  /** Register a callback that fires when an update has been downloaded and is ready to install */
  onUpdateReady: (callback) => {
    ipcRenderer.on('update-ready', (_event, ...args) => callback(...args));
  },

  /** Flag so renderer code can detect it is running inside Electron */
  isElectron: true,
});
