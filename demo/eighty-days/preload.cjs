// The only bridge between the page and the main process: the data files, the
// planted bugs and the layout the game was launched with, the menu's
// commands, the ship's log, the exported ledger, and whether the game has
// ended, which decides whether Set out again is offered in the menu.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('eightyDays', {
  data: () => ipcRenderer.invoke('data:all'),
  options: () => ipcRenderer.invoke('game:options'),
  onMenu: (handler) => ipcRenderer.on('menu', (_event, command) => handler(command)),
  log: (line) => ipcRenderer.send('log:append', line),
  exportLedger: (text) => ipcRenderer.send('ledger:export', text),
  ended: (ended) => ipcRenderer.send('game:ended', ended),
});
