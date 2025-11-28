const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  setUserId: (id) => ipcRenderer.send('set-user-id', id)
});
