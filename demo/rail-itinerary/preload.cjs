// The only bridge between the page and the main process: the data files, the
// planted bugs the application was launched with, and the menu asking for a
// screen.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rail', {
  data: () => ipcRenderer.invoke('data:all'),
  plants: () => ipcRenderer.invoke('plants'),
  onShowScreen: (handler) => ipcRenderer.on('screen:show', (_event, screen) => handler(screen)),
});
