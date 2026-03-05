const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // We can add IPC renderers here later if needed (e.g. for saving/loading)
});
