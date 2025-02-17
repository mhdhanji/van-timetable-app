const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    isElectron: true,
    versions: {
        node: () => process.versions.node,
        chrome: () => process.versions.chrome,
        electron: () => process.versions.electron
    }
});