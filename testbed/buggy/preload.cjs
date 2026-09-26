// The only bridge between the renderer and the main process.
//
// Deliberately narrow: the renderer asks for the items and listens for the
// menu asking it to change view. The planted defects cross too, and only
// when buggy was launched with their flags.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('buggy', {
  items: () => ipcRenderer.invoke('items:all'),
  onShowView: (handler) => ipcRenderer.on('view:show', (_event, view) => handler(view)),
  // Planted defects, present only when buggy was launched with their flags.
  plants: () => ipcRenderer.invoke('plants:list'),
  plant: (name) => ipcRenderer.invoke(`plant:${name}`),
});
