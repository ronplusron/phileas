// The main process of Eighty Days, a game built to show Phileas at work.
// docs/DEMO_PLAN_EIGHTY_DAYS.md is its plan.
//
// It uses none of Phileas's own terms -- Journey, Route, Trip, Hop, Fix, Map --
// so that a person watching the demo never confuses the engine's words with
// the game's. Fogg makes a circuit of passages, and the picture of it is the
// chart.
//
// Nothing here or in the page is random or runs on a timer, so the same moves
// always play the same game: the engine's replay rests on that.
const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const read = (name) => JSON.parse(fs.readFileSync(path.join(__dirname, 'data', name), 'utf8'));
const data = {
  places: read('places.json'),
  departures: read('departures.json'),
  story: read('story.json'),
};

// The ship's log, which the adapter names for the engine's log check. Created
// empty at start, because a named log that does not exist is reported on
// every Hop as a check that could not run, not as a clean log. No ordinary
// line may contain the word the check looks for.
function logFile() {
  return process.env.EIGHTY_DAYS_LOG || path.join(app.getPath('userData'), 'ship.log');
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    title: 'Eighty Days',
    backgroundColor: '#f3ead7',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Links to the outside world open in the person's browser, never in the
  // game's window.
  const openExternally = (url) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
  };
  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternally(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    event.preventDefault();
    openExternally(url);
  });
  return win;
}

ipcMain.handle('data:all', () => data);

ipcMain.on('log:append', (_event, line) => {
  fs.appendFileSync(logFile(), `${line}\n`);
});

// Written into the profile, which a Route throws away, and never through a
// native file dialog, which would hold the main process until a person
// answered it.
ipcMain.on('ledger:export', (_event, text) => {
  fs.writeFileSync(path.join(app.getPath('userData'), 'ledger.txt'), `${text}\n`);
});

// Set out again is offered only once the game has ended. Offered all the
// time, a Route would keep sending itself back to London.
ipcMain.on('game:ended', (_event, ended) => {
  const item = Menu.getApplicationMenu()?.getMenuItemById('set-out-again');
  if (item) item.enabled = !!ended;
});

// A menu click reaches the focused window, and a watched run may have none
// focused for a moment; the first window is the sensible fallback.
function send(win, command) {
  (win ?? BrowserWindow.getAllWindows()[0])?.webContents.send('menu', command);
}

function buildMenu() {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: 'Eighty Days',
        submenu: [{ label: 'Quit Eighty Days', role: 'quit' }],
      },
      {
        label: 'Edit',
        submenu: [{ role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }],
      },
      {
        label: 'Game',
        submenu: [
          { id: 'set-out-again', label: 'Set out again', enabled: false, click: (_i, win) => send(win, 'restart') },
          { label: 'Consult Bradshaw', click: (_i, win) => send(win, 'bradshaw') },
          { label: 'Export the ledger', click: (_i, win) => send(win, 'export') },
        ],
      },
      {
        label: 'View',
        submenu: [
          { label: 'Show the chart', click: (_i, win) => send(win, 'circuit') },
          { label: 'Show the Ledger', click: (_i, win) => send(win, 'ledger') },
          { label: 'Show the clock', type: 'checkbox', checked: true, click: (_i, win) => send(win, 'clock') },
        ],
      },
    ])
  );
}

app.whenReady().then(() => {
  fs.writeFileSync(logFile(), '', { flag: 'a' });
  buildMenu();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => app.quit());
