// The only bridge between the page and the main process: the data files, and
// the menu asking for a screen.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rail', {
  data: () => ipcRenderer.invoke('data:all'),
  onShowScreen: (handler) => ipcRenderer.on('screen:show', (_event, screen) => handler(screen)),
});
