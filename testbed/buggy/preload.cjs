// The only bridge between the renderer and the main process.
//
// Deliberately narrow: the renderer asks for the items and listens for the
// menu asking it to change view, and nothing else crosses.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('buggy', {
  items: () => ipcRenderer.invoke('items:all'),
  onShowView: (handler) => ipcRenderer.on('view:show', (_event, view) => handler(view)),
});
