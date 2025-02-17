const { contextBridge, ipcRenderer } = require('electron');
const { app } = require('@electron/remote');

// Expose all APIs in a single contextBridge call
contextBridge.exposeInMainWorld('electron', {
    // App info
    getVersion: () => app.getVersion(),
    isElectron: true,
    
    // Version info
    versions: {
        node: () => process.versions.node,
        chrome: () => process.versions.chrome,
        electron: () => process.versions.electron
    },

    // IPC functions (commented out but ready to use)
    // ipc: {
    //     send: (channel, data) => ipcRenderer.send(channel, data),
    //     receive: (channel, func) => ipcRenderer.on(channel, (event, ...args) => func(...args))
    // }
});