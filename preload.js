const { contextBridge } = require('electron');

// Expose a minimal API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
    isElectron: true
});

// preload.js
const { contextBridge, ipcRenderer } = require('electron');
const { app } = require('@electron/remote');

contextBridge.exposeInMainWorld('electron', {
    getVersion: () => app.getVersion()
});

// You can also expose any other safe APIs you might need
contextBridge.exposeInMainWorld('versions', {
    node: () => process.versions.node,
    chrome: () => process.versions.chrome,
    electron: () => process.versions.electron
});

// If you need to expose any IPC functions in the future, you can add them here
contextBridge.exposeInMainWorld('ipcAPI', {
    // Example:
    // send: (channel, data) => ipcRenderer.send(channel, data),
    // receive: (channel, func) => ipcRenderer.on(channel, (event, ...args) => func(...args))
});